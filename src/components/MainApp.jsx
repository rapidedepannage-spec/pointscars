import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { STATUTS, CHECKLIST, ROLES, MOTIV_MSGS, LOGO } from '../config/constants'
import { S } from '../styles/theme'
import { uid, tot, fd, fmt } from '../utils/helpers'
import { botMsg } from '../utils/bot'
import Badge from './Badge'
import DetailView from './DetailView'
import MailsTab from './MailsTab'
import PhotosTab from './PhotosTab'
import PiecesTab from './PiecesTab'
import RapportIA from './RapportIA'
import TodoPage from './TodoPage'
import OutlookPage from './OutlookPage'
import InboxPage from './InboxPage'
import ChatPage from './ChatPage'
import ParamPage from './ParamPage'
import ORTab from './ORTab'
import FactureTab from './FactureTab'
import PECTab from './PECTab'
import PretTab from './PretTab'
import PIECTab from './PIECTab'
import ContactsPage from './ContactsPage'
import AgendaPage from './AgendaPage'
import ChartPage from './ChartPage'
import FormModal from './FormModal'

function MainApp({
  curUser,
  users,
  setUsers,
  doLogout
}) {
  const [pg, sP] = useState("dash");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dosState, setDosState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chk, sC] = useState(() => {
    try {
      const r = localStorage.getItem("psg_chk_" + new Date().toISOString().slice(0, 10));
      return r ? JSON.parse(r) : {};
    } catch (e) {
      return {};
    }
  });
  const [dd, sDd] = useState(null);
  const [dt, sDt] = useState("infos");
  const [sf, sSf] = useState(null);
  const [sm, sSm] = useState(null);
  const [cp, sCp] = useState(false);
  const [fi, sFi] = useState("all");
  const [sr, sSr] = useState("");

  const [showMotiv, setShowMotiv] = useState(false);
  // Envoie un message bot au premier login du jour
  useEffect(function () {
    try {
      var k = "psg_botmotiv_" + new Date().toISOString().slice(0, 10) + "_" + curUser.id;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
      var prenom = curUser.nom.split(" ")[0];
      // Message perso du patron OU message aléatoire
      if (curUser.message) {
        botMsg("general", "\u{1F4AC} Message pour " + prenom + " : " + curUser.message);
      } else {
        var msg = MOTIV_MSGS[Math.floor(Math.random() * MOTIV_MSGS.length)].replace("{nom}", prenom);
        botMsg("general", msg);
      }
      // Afficher bandeau si message du patron
      if (curUser.message) setShowMotiv(true);
    } catch (e) {}
  }, []);

  // Suivi temps de travail (heartbeat toutes les 60s si page visible)
  const [inboxUnread, setInboxUnread] = useState(0);
  const [todoPending, setTodoPending] = useState(0);
  useEffect(function () {
    var unsub = db.collection("inbox").where("toId", "==", curUser.id).onSnapshot(function (snap) {
      var count = 0;
      snap.docs.forEach(function (d) {
        if (!d.data().read) count++;
      });
      setInboxUnread(count);
    });
    return function () {
      unsub();
    };
  }, [curUser.id]);
  useEffect(function () {
    var unsub = db.collection("todos").where("userId", "==", curUser.id).onSnapshot(function (snap) {
      var count = 0;
      snap.docs.forEach(function (d) {
        if (!d.data().done) count++;
      });
      setTodoPending(count);
    });
    return function () {
      unsub();
    };
  }, [curUser.id]);
  useEffect(function () {
    var mySid = null;
    try { mySid = localStorage.getItem("psg_sid"); } catch(e) {}
    if(!mySid) return;
    var unsub = db.collection("users").doc(curUser.id).onSnapshot(function(snap) {
      var data = snap.data();
      var localSid = null;
      try { localSid = localStorage.getItem("psg_sid"); } catch(e) {}
      if(data && data.sessionId && localSid && data.sessionId !== localSid) {
        alert("Votre compte a ete connecte depuis un autre appareil. Deconnexion.");
        try { localStorage.removeItem("psg_sid"); } catch(e) {}
        setCurUser(null);
      }
    });
    return function() { unsub(); };
  }, [curUser.id]);
  useEffect(function () {
    var today = new Date().toISOString().slice(0, 10);
    var docRef = db.collection("timetrack").doc(today + "_" + curUser.id);
    var active = true;
    // Marquer connexion
    docRef.set({
      userId: curUser.id,
      userName: curUser.nom,
      userRole: curUser.role,
      date: today,
      minutes: firebase.firestore.FieldValue.increment(0),
      lastSeen: new Date().toISOString(),
      loginAt: firebase.firestore.FieldValue.arrayUnion(new Date().toISOString())
    }, {
      merge: true
    });
    // Visibilité page
    var onVis = function () {
      active = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);
    // Heartbeat: +1 minute si actif
    var iv = setInterval(function () {
      if (!active) return;
      var d = new Date().toISOString().slice(0, 10);
      var ref = db.collection("timetrack").doc(d + "_" + curUser.id);
      ref.set({
        userId: curUser.id,
        userName: curUser.nom,
        userRole: curUser.role,
        date: d,
        minutes: firebase.firestore.FieldValue.increment(1),
        lastSeen: new Date().toISOString()
      }, {
        merge: true
      });
    }, 60000);
    return function () {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [curUser.id]);

  /* === FIREBASE: charger dossiers en temps réel === */
  const [migrated, setMigrated] = useState(false);
  useEffect(() => {
    const unsub = db.collection("dossiers").onSnapshot(snap => {
      const d = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      d.sort((a, b) => (b.creeAt || "").localeCompare(a.creeAt || ""));
      setDosState(d);
      setLoading(false);
      // Migration pv/pa: une seule fois
      if (!migrated) {
        setMigrated(true);
        d.forEach(function (dos) {
          var pcs = dos.pcs || [];
          var needFix = pcs.some(function (p) {
            return p.pv === undefined || p.pv === null || p.pa === undefined || p.pa === null;
          });
          if (needFix) {
            var fixed = pcs.map(function (p) {
              var out = {
                ...p
              };
              if (out.pv === undefined || out.pv === null) out.pv = out.p || 0;
              if (out.pa === undefined || out.pa === null) out.pa = out.p || 0;
              return out;
            });
            var chiff = fixed.reduce(function (a, p) {
              return a + (p.q || 0) * (p.pv || 0);
            }, 0);
            db.collection("dossiers").doc(dos.id).update({
              pcs: fixed,
              mt: String(Math.round(chiff * 100) / 100)
            });
          }
        });
      }
    }, err => {
      console.error("Firestore error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Sync selected dossier
  useEffect(() => {
    if (dd) {
      const fresh = dosState.find(x => x.id === dd.id);
      if (fresh) sDd(fresh);
    }
  }, [dosState]);
  useEffect(() => {
    try {
      localStorage.setItem("psg_chk_" + new Date().toISOString().slice(0, 10), JSON.stringify(chk));
    } catch (e) {}
  }, [chk]);
  const dos = loading ? [] : [...dosState];

  /* === FIREBASE: opérations dossiers === */
  const addDos = v => {
    const newDoc = {
      ...v,
      id: uid(),
      ph: [0, 0, 0, 0],
      pcs: [],
      creePar: curUser.nom,
      creeAt: new Date().toISOString()
    };
    db.collection("dossiers").doc(newDoc.id).set(newDoc);
    botMsg("general", "\u{1F4C1} Nouveau dossier créé par " + curUser.nom + " : " + (v.cli || "") + " — " + (v.imm || "") + (v.veh ? " (" + v.veh + ")" : ""));
  };
  const updDos = (id, u) => {
    // Si passage en "facture", stocker la date
    if (u.sta === "facture") u.dateFacture = new Date().toISOString();
    // Si on change de statut depuis facture/relance, nettoyer
    if (u.sta && u.sta !== "facture" && u.sta !== "relance") u.dateFacture = null;
    db.collection("dossiers").doc(id).update(u);
    // Bot notif: changements de statut
    if (u.sta) {
      var d = dos.find(function (x) {
        return x.id === id;
      });
      var nom = d ? (d.cli || "") + " — " + (d.imm || "") : id;
      var labels = {
        attente: "\u23F3 En attente",
        expertise: "\u{1F50D} Expertise",
        reparation: "\u{1F527} En réparation",
        facture: "\u{1F4B0} Facturé",
        relance: "\u26A0\uFE0F Relance",
        termine: "\u2705 Terminé"
      };
      var label = labels[u.sta] || u.sta;
      botMsg("general", label + " → " + nom + " (par " + curUser.nom + ")");
    }
  };

  // Auto-relance: vérifier toutes les 60s si un dossier facturé > 10 jours
  useEffect(function () {
    var checkRelance = function () {
      var now = new Date();
      dos.forEach(function (d) {
        if (d.sta === "facture" && d.dateFacture) {
          var diff = (now - new Date(d.dateFacture)) / (1000 * 60 * 60 * 24);
          if (diff >= 10) {
            db.collection("dossiers").doc(d.id).update({
              sta: "relance"
            });
            botMsg("urgent", "\u26A0\uFE0F Relance automatique : " + (d.cli || "") + " — " + (d.imm || "") + " (facturé depuis " + Math.round(diff) + " jours)");
          }
        }
      });
    };
    checkRelance();
    var interval = setInterval(checkRelance, 60000);
    return function () {
      clearInterval(interval);
    };
  }, [dos]);
  const delDos = id => {
    var d = dos.find(function (x) {
      return x.id === id;
    });
    db.collection("dossiers").doc(id).delete();
    if (d) botMsg("general", "\u{1F5D1} Dossier supprimé : " + (d.cli || "") + " — " + (d.imm || "") + " (par " + curUser.nom + ")");
  };
  const cd = Object.values(chk).filter(Boolean).length;
  const fD = dos.filter(d => (fi === "all" || d.sta === fi) && (!sr || [d.cli, d.imm, d.num, d.ass].some(x => (x || "").toLowerCase().includes(sr.toLowerCase()))));
  const rl = ROLES.find(r => r.id === curUser.role) || ROLES[0];

  /* === LOADING DOSSIERS === */
  if (loading) return (
    <div style={{
      background: "#0F172A",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10
    }}>
      <div style={{
        width: 30,
        height: 30,
        border: "3px solid #334155",
        borderTop: "3px solid #F59E0B",
        borderRadius: "50%",
        animation: "sp 1s linear infinite"
      }} />
      <span style={{
        color: "#94A3B8",
        fontSize: 12
      }}>Chargement des dossiers…</span>
    </div>
  );

  var navItems = [["dash", "\u{1F4CA}", "Tableau de bord"], ["dos", "\u{1F4C1}", "Dossiers"], ["contacts", "\u{1F4C7}", "Contacts"], ["agenda", "\u{1F4C5}", "Agenda"], ["chart", "\u{1F4C8}", "Chiffre d'affaires"], ["mail", "\u2709\uFE0F", "Mails types"], ["chat", "\u{1F4AC}", "Chat équipe"], ["inbox", "\u{1F4EC}", "Boîte aux lettres"], ["todo", "\u{1F4DD}", "Mes tâches"], ["chk", "\u2611\uFE0F", "Check-list"], ["param", "\u2699\uFE0F", "Paramètres"]];

  var sidebarContent = function(onNav) {
    return [
      <div key="hdr" style={{
        padding: "16px 14px",
        borderBottom: "1px solid #334155",
        display: "flex",
        alignItems: "center",
        gap: 9
      }}>
        <img src={LOGO} alt="Point S" style={{
          height: 28,
          flexShrink: 0
        }} />
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#F8FAFC"
          }}>Point S Guignes</div>
          <div style={{
            fontSize: 9,
            color: "#94A3B8"
          }}>Gestion Sinistres</div>
        </div>
      </div>,
      <nav key="nav" style={{
        padding: "10px 6px",
        flex: 1
      }}>
        {[["dash", "\u{1F4CA}", "Tableau de bord"], ["dos", "\u{1F4C1}", "Dossiers"], ["contacts", "\u{1F4C7}", "Contacts"], ["agenda", "\u{1F4C5}", "Agenda"], ["chart", "\u{1F4C8}", "Chiffre d'affaires"], ["mail", "\u2709\uFE0F", "Mails types"], ["chat", "\u{1F4AC}", "Chat équipe"], ["inbox", "\u{1F4EC}", "Boîte aux lettres"], ["todo", "\u{1F4DD}", "Mes tâches"], ["chk", "\u2611\uFE0F", "Check-list"], ["param", "\u2699\uFE0F", "Paramètres"]].map(([id, ic, l]) => {
          const act = pg === id || pg === "det" && id === "dos";
          return (
            <div key={id} onClick={() => {
              sP(id);
              sDd(null);
              if(onNav) onNav();
            }} style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 11px",
              borderRadius: 8,
              cursor: "pointer",
              marginBottom: 2,
              background: act ? "rgba(245,158,11,0.1)" : "transparent",
              border: act ? "1px solid rgba(245,158,11,0.22)" : "1px solid transparent",
              position: "relative"
            }}>
              <span style={{ fontSize: 16 }}>{ic}</span>
              <span style={{
                fontSize: 11,
                fontWeight: act ? 600 : 400,
                color: act ? "#F59E0B" : "#94A3B8"
              }}>{l}</span>
              {id === "inbox" && inboxUnread > 0 && (
                <span style={{
                  position: "absolute",
                  right: 8,
                  background: "#EF4444",
                  color: "#FFF",
                  fontSize: 9,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px"
                }}>{inboxUnread}</span>
              )}
              {id === "todo" && todoPending > 0 && (
                <span style={{
                  position: "absolute",
                  right: 8,
                  background: "#F59E0B",
                  color: "#0F172A",
                  fontSize: 9,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px"
                }}>{todoPending}</span>
              )}
            </div>
          );
        })}
      </nav>,
      <div key="footer" style={{
        padding: "10px 12px",
        borderTop: "1px solid #334155"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 6
        }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: rl.c + "25",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: rl.c
          }}>{curUser.nom.charAt(0)}</div>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#F8FAFC"
            }}>{curUser.nom}</div>
            <div style={{
              fontSize: 8,
              color: "#94A3B8"
            }}>{rl.l}</div>
          </div>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 5
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: "#10B981"
          }} />
          <span style={{
            fontSize: 8,
            color: "#10B981"
          }}>En ligne</span>
        </div>
        <button onClick={doLogout} style={{
          width: "100%",
          padding: "5px",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 5,
          color: "#FCA5A5",
          fontSize: 9,
          cursor: "pointer",
          fontWeight: 600
        }}>{"\u{1F6AA}"} Déconnexion</button>
      </div>
    ];
  };

  return (
    <div style={{display:"flex",height:"100vh"}}>
      {/* Mobile header */}
      <div className="mobile-header" style={{display:"none",position:"fixed",top:0,left:0,right:0,height:52,background:"#1E293B",borderBottom:"1px solid #334155",alignItems:"center",justifyContent:"space-between",padding:"0 14px",zIndex:1000}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={function(){setMobileMenu(!mobileMenu);}} style={{background:"none",border:"none",color:"#F8FAFC",fontSize:22,cursor:"pointer",padding:4}}>{"\u2630"}</button>
          <img src={LOGO} alt="Point S" style={{height:22}} />
          <span style={{fontSize:12,fontWeight:700,color:"#F8FAFC"}}>Point S Guignes</span>
        </div>
        <div style={{fontSize:9,color:"#94A3B8"}}>{curUser.nom}</div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenu && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:2000,display:"flex"}}>
          <div onClick={function(){setMobileMenu(false);}} style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)"}} />
          <div style={{position:"relative",width:270,maxWidth:"80vw",height:"100vh",background:"#1E293B",display:"flex",flexDirection:"column",overflowY:"auto",zIndex:1}}>
            {...sidebarContent(function(){setMobileMenu(false);})}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="sidebar-desktop" style={{width:210,background:"#1E293B",display:"flex",flexDirection:"column",borderRight:"1px solid #334155"}}>
        {...sidebarContent()}
      </div>

      {/* Main content */}
      <div className="main-content" style={{flex:1,overflow:"auto",padding:"20px 26px"}}>
        {/* Bandeau message du patron */}
        {showMotiv && curUser.message && (
          <div style={{
            background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.1))",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fi .5s"
          }}>
            <div>
              <div style={{
                fontSize: 8,
                color: "#A78BFA",
                fontWeight: 700,
                marginBottom: 3
              }}>{"\u{1F4AC}"} MESSAGE DU PATRON</div>
              <div style={{
                fontSize: 14,
                fontWeight: 600
              }}>{curUser.message}</div>
            </div>
            <span onClick={function () {
              setShowMotiv(false);
            }} style={{
              color: "#94A3B8",
              cursor: "pointer",
              fontSize: 16,
              marginLeft: 12
            }}>{"\u2715"}</span>
          </div>
        )}

        {/* Dashboard */}
        {pg === "dash" && (
          <div style={{ animation: "fi .3s" }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 3
            }}>Tableau de bord</h1>
            <p style={{
              color: "#94A3B8",
              fontSize: 11,
              marginBottom: 20
            }}>{new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric"
            })}</p>
            <div className="stats-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
              gap: 10,
              marginBottom: 20
            }}>
              {[["\u{1F4C1}", "Dossiers", dos.length, "#3B82F6"], ["\u26A1", "En cours", dos.filter(d => !["regle", "facture", "relance"].includes(d.sta)).length, "#F59E0B"], ["\u23F3", "Attente", dos.filter(d => d.sta === "attente").length, "#EF4444"], ["\u{1F4B6}", "À facturer", dos.filter(d => d.sta === "termine").length, "#10B981"], ["\u{1F534}", "Relances", dos.filter(d => d.sta === "relance").length, "#DC2626"], ["\u{1F4C8}", "CA", dos.reduce((a, d) => a + (+d.mt || 0), 0).toLocaleString("fr-FR") + "\u20AC", "#8B5CF6"]].map(([ic, l, v, c], i) => (
                <div key={i} style={{
                  ...S.c,
                  padding: "14px"
                }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 5
                  }}>
                    <span style={{
                      fontSize: 9,
                      color: "#94A3B8",
                      fontWeight: 600,
                      textTransform: "uppercase"
                    }}>{l}</span>
                    <span style={{ fontSize: 14 }}>{ic}</span>
                  </div>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: c,
                    fontFamily: "monospace"
                  }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Pipeline */}
            <div style={{
              ...S.c,
              padding: "16px",
              marginBottom: 16
            }}>
              <h3 style={{
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 10
              }}>Pipeline</h3>
              <div className="pipeline-row" style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap"
              }}>
                {STATUTS.map(x => {
                  const n = dos.filter(d => d.sta === x.id).length;
                  return (
                    <div key={x.id} onClick={() => {
                      sFi(x.id);
                      sP("dos");
                    }} style={{
                      flex: "1 1 80px",
                      padding: "8px 4px",
                      borderRadius: 9,
                      cursor: "pointer",
                      background: x.c + "10",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: x.c,
                        fontFamily: "monospace"
                      }}>{n}</div>
                      <div style={{
                        fontSize: 8,
                        color: "#94A3B8"
                      }}>{x.l}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* En attente d'accord */}
            {dos.filter(d => d.sta === "attente").length > 0 && (
              <div style={{
                background: "rgba(239,68,68,0.05)",
                borderRadius: 11,
                padding: "14px",
                border: "1px solid rgba(239,68,68,0.15)"
              }}>
                <h3 style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#FCA5A5",
                  marginBottom: 8
                }}>{"\u26A0\uFE0F"} En attente d'accord</h3>
                {dos.filter(d => d.sta === "attente").map(d => (
                  <div key={d.id} onClick={() => {
                    sDd(d);
                    sDt("rapport");
                    sP("det");
                  }} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "5px 0",
                    cursor: "pointer"
                  }}>
                    <span style={{
                      fontWeight: 600,
                      fontSize: 12
                    }}>{d.cli} <span style={{
                      color: "#94A3B8",
                      fontWeight: 400,
                      fontSize: 11
                    }}>{d.imm}</span></span>
                    <span style={{
                      color: "#FCA5A5",
                      fontSize: 11,
                      fontWeight: 600
                    }}>{d.mt ? d.mt + "\u20AC" : "\u2014"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Relances */}
            {dos.filter(d => d.sta === "relance").length > 0 && (
              <div style={{
                background: "rgba(220,38,38,0.08)",
                borderRadius: 11,
                padding: "14px",
                border: "1px solid rgba(220,38,38,0.2)"
              }}>
                <h3 style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#FCA5A5",
                  marginBottom: 8
                }}>{"\u{1F534}"} Relances (facturés &gt; 10 jours)</h3>
                {dos.filter(d => d.sta === "relance").map(d => (
                  <div key={d.id} onClick={() => {
                    sDd(d);
                    sDt("mails");
                    sP("det");
                  }} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "5px 0",
                    cursor: "pointer"
                  }}>
                    <span style={{
                      fontWeight: 600,
                      fontSize: 12
                    }}>{d.cli} <span style={{
                      color: "#94A3B8",
                      fontWeight: 400,
                      fontSize: 11
                    }}>{d.imm}</span></span>
                    <span style={{
                      color: "#DC2626",
                      fontSize: 11,
                      fontWeight: 600
                    }}>{d.mt ? d.mt + "\u20AC" : "\u2014"}{d.dateFacture ? " — facturé le " + new Date(d.dateFacture).toLocaleDateString("fr-FR") : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dossiers list */}
        {pg === "dos" && (
          <div style={{ animation: "fi .3s" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14
            }}>
              <div>
                <h1 style={{
                  fontSize: 22,
                  fontWeight: 700
                }}>Dossiers ({fD.length})</h1>
              </div>
              <button onClick={() => sSf({})} style={S.b}>+ Nouveau</button>
            </div>
            <div style={{
              display: "flex",
              gap: 7,
              marginBottom: 10
            }}>
              <input value={sr} onChange={e => sSr(e.target.value)} placeholder={"\u{1F50D} Rechercher\u2026"} style={{
                ...S.i,
                flex: 1
              }} />
              <select value={fi} onChange={e => sFi(e.target.value)} style={{
                ...S.i,
                width: "auto"
              }}>
                <option value="all">Tous</option>
                {STATUTS.map(x => (
                  <option key={x.id} value={x.id}>{x.l}</option>
                ))}
              </select>
            </div>

            {/* Desktop table */}
            <div className="table-desktop" style={{
              ...S.c,
              overflow: "hidden"
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11
                }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #334155" }}>
                      {["N°", "Client", "Véhicule", "Assureur", "Expert", "Fr.", "Total", "Statut", "Créé par", ""].map(h => (
                        <th key={h} style={{
                          padding: "9px 7px",
                          textAlign: "left",
                          color: "#94A3B8",
                          fontSize: 9,
                          textTransform: "uppercase"
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fD.map((d, i) => (
                      <tr key={d.id} className="hr" onClick={() => {
                        sDd(d);
                        sDt("rapport");
                        sP("det");
                      }} style={{
                        borderBottom: "1px solid #33415530",
                        background: i % 2 ? "#172033" : "#1E293B",
                        cursor: "pointer"
                      }}>
                        <td style={{
                          padding: "7px",
                          fontFamily: "monospace",
                          color: "#F59E0B",
                          fontSize: 10
                        }}>{d.num}</td>
                        <td style={{ padding: "7px" }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: 12
                          }}>{d.cli}</div>
                          <div style={{
                            fontSize: 9,
                            color: "#64748B"
                          }}>{d.tel}</div>
                          <div style={{
                            fontSize: 8,
                            color: "#06B6D4"
                          }}>{d.email || ""}</div>
                        </td>
                        <td style={{ padding: "7px" }}>
                          <div>{d.veh}</div>
                          <div style={{
                            fontSize: 9,
                            color: "#64748B",
                            fontFamily: "monospace"
                          }}>{d.imm}</div>
                        </td>
                        <td style={{ padding: "7px" }}>{d.ass}</td>
                        <td style={{
                          padding: "7px",
                          fontSize: 10,
                          color: "#94A3B8"
                        }}>{d.exp || "\u2014"}</td>
                        <td style={{
                          padding: "7px",
                          fontFamily: "monospace",
                          color: "#EF4444",
                          fontSize: 10
                        }}>{d.fr ? d.fr + "\u20AC" : "\u2014"}</td>
                        <td style={{
                          padding: "7px",
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: "#10B981"
                        }}>{d.mt ? d.mt + "\u20AC" : "\u2014"}</td>
                        <td style={{ padding: "7px" }}>
                          <Badge s={d.sta} />
                        </td>
                        <td style={{ padding: "7px" }}>
                          {d.creePar ? (
                            <div>
                              <div style={{ fontSize: 10 }}>{d.creePar}</div>
                              <div style={{
                                fontSize: 8,
                                color: "#64748B"
                              }}>{d.creeAt ? new Date(d.creeAt).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit"
                              }) : ""}</div>
                            </div>
                          ) : "\u2014"}
                        </td>
                        <td style={{ padding: "7px" }} onClick={e => e.stopPropagation()}>
                          <span onClick={() => sSf(d)} style={{ cursor: "pointer" }}>{"\u270F\uFE0F"}</span>
                          {" "}
                          <span onClick={() => {
                            if (confirm("Supprimer?")) delDos(d.id);
                          }} style={{ cursor: "pointer" }}>{"\u{1F5D1}"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="cards-mobile" style={{display:"none",flexDirection:"column",gap:10}}>
              {fD.map(function(d) {
                var stObj = (STATUTS.find(function(s){return s.id===d.sta}) || {c:"#475569",l:"?"});
                return (
                  <div key={d.id} onClick={function(){sDd(d);sDt("rapport");sP("det");}} style={{...S.c,padding:14,cursor:"pointer",borderLeft:"3px solid "+stObj.c,marginBottom:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontFamily:"monospace",color:"#F59E0B",fontSize:11,fontWeight:700}}>{d.num}</span>
                      <Badge s={d.sta} />
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:"#F8FAFC",marginBottom:4}}>{d.cli||"Sans nom"}</div>
                    <div style={{display:"flex",gap:10,fontSize:11,color:"#94A3B8",marginBottom:6,flexWrap:"wrap"}}>
                      <span>{"\u{1F697} "+(d.veh||"")}</span>
                      {d.imm && <span style={{fontFamily:"monospace",background:"#334155",padding:"1px 6px",borderRadius:4,fontSize:10}}>{d.imm}</span>}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#64748B"}}>
                      <span>{d.ass||""}</span>
                      <span>{d.mt?d.mt+"\u20AC":""}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Form modal */}
            {sf && (
              <FormModal d={sf} n={dos.length} cls={() => sSf(null)} sav={v => {
                if (sf.id) {
                  updDos(sf.id, v);
                } else {
                  addDos(v);
                }
                sSf(null);
              }} />
            )}
          </div>
        )}

        {/* Detail view */}
        {pg === "det" && dd && (
          <DetailView d={dd} tab={dt} sT={sDt} bk={() => {
            sDd(null);
            sP("dos");
          }} up={updDos} curUser={curUser} />
        )}

        {/* Mail templates */}
        {pg === "mail" && (
          <div style={{ animation: "fi .3s" }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 3
            }}>Modèles de mails</h1>
            <p style={{
              color: "#94A3B8",
              fontSize: 11,
              marginBottom: 18
            }}>Cliquez pour voir, puis copiez</p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
              gap: 9,
              marginBottom: 14
            }}>
              {[["\u{1F4E9}", "Accusé réception", "Prise en charge", "Bonjour,\n\nNous accusons réception de la mission [N°] pour [VÉHICULE] [IMMAT].\nClient contacté sous 2h.\n\nCordialement,\nPoint S Guignes"], ["\u{1F4CB}", "Chiffrage", "Envoi chiffrage", "Bonjour,\n\nCi-joint chiffrage [VÉHICULE] [IMMAT].\nMontant HT: [MONTANT]\u20AC\nDélai: [DÉLAI]j\n\nCordialement,\nPoint S Guignes"], ["\u2705", "Accord", "Demande accord", "Bonjour,\n\nAccord demandé pour [IMMAT].\nMontant: [MONTANT]\u20AC\n\nCordialement,\nPoint S Guignes"], ["\u{1F697}", "Fin réparation", "Véhicule prêt", "Bonjour,\n\nVéhicule [IMMAT] prêt.\nPhotos en PJ.\n\nCordialement,\nPoint S Guignes"], ["\u26A0\uFE0F", "Relance", "Relance impayé", "Bonjour,\n\nFacture [N°] de [MONTANT]\u20AC impayée.\nRèglement sous 15j SVP.\n\nCordialement,\nPoint S Guignes"]].map(([ic, t, o, b], j) => (
                <div key={j} onClick={() => sSm({
                  ic,
                  t,
                  o,
                  b
                })} style={{
                  ...S.c,
                  padding: "14px",
                  cursor: "pointer",
                  border: sm && sm.t === t ? "1.5px solid #F59E0B" : "1px solid #334155"
                }}>
                  <span style={{ fontSize: 22 }}>{ic}</span>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    marginTop: 5
                  }}>{t}</div>
                </div>
              ))}
            </div>
            {sm && (
              <div style={{
                ...S.c,
                padding: "18px",
                animation: "fi .2s"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10
                }}>
                  <h3 style={{
                    fontSize: 14,
                    fontWeight: 600
                  }}>{sm.ic} {sm.t}</h3>
                  <button onClick={() => {
                    navigator.clipboard.writeText("Objet: " + sm.o + "\n\n" + sm.b);
                    sCp(true);
                    setTimeout(() => sCp(false), 2000);
                  }} style={{
                    ...S.b,
                    background: cp ? "#10B981" : "linear-gradient(135deg,#F59E0B,#D97706)",
                    color: cp ? "#FFF" : "#0F172A"
                  }}>{cp ? "\u2713 Copié" : "\u{1F4CB} Copier"}</button>
                </div>
                <div style={{
                  padding: "8px 12px",
                  background: "#0F172A",
                  borderRadius: 6,
                  marginBottom: 8,
                  fontSize: 12,
                  color: "#F59E0B",
                  fontFamily: "monospace"
                }}>{sm.o}</div>
                <pre style={{
                  padding: "12px",
                  background: "#0F172A",
                  borderRadius: 6,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                  fontFamily: "inherit"
                }}>{sm.b}</pre>
              </div>
            )}
          </div>
        )}

        {/* Checklist */}
        {pg === "chk" && (
          <div style={{ animation: "fi .3s" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16
            }}>
              <div>
                <h1 style={{
                  fontSize: 22,
                  fontWeight: 700
                }}>Check-list</h1>
                <p style={{
                  color: "#94A3B8",
                  fontSize: 11,
                  marginTop: 2
                }}>{new Date().toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long"
                })} — {cd}/{CHECKLIST.length}</p>
              </div>
              <button onClick={() => sC({})} style={S.bg}>{"\u21BB"} Reset</button>
            </div>
            <div style={{
              background: "#1E293B",
              borderRadius: 6,
              height: 5,
              marginBottom: 18,
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                width: cd / CHECKLIST.length * 100 + "%",
                background: "linear-gradient(90deg,#F59E0B,#10B981)",
                transition: "width .4s"
              }} />
            </div>
            {CHECKLIST.map((it, i) => {
              const dn = chk[it.id];
              return (
                <div key={it.id} onClick={() => sC(p => ({
                  ...p,
                  [it.id]: !p[it.id]
                }))} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  marginBottom: 5,
                  background: dn ? "rgba(16,185,129,0.04)" : it.m ? "rgba(239,68,68,0.03)" : "#1E293B",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: dn ? "1px solid rgba(16,185,129,0.18)" : it.m ? "1px solid rgba(239,68,68,0.1)" : "1px solid #334155"
                }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    border: dn ? "none" : "2px solid #475569",
                    background: dn ? "#10B981" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: "#FFF",
                    flexShrink: 0
                  }}>{dn ? "\u2713" : ""}</div>
                  {it.m && !dn && (
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: "#EF4444",
                      background: "rgba(239,68,68,0.1)",
                      padding: "2px 6px",
                      borderRadius: 3
                    }}>MAIL</span>
                  )}
                  <div style={{
                    flex: 1,
                    fontSize: 12,
                    color: dn ? "#64748B" : "#F8FAFC",
                    textDecoration: dn ? "line-through" : "none",
                    fontWeight: 500
                  }}>{it.t}</div>
                  <span style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: dn ? "#475569" : "#F59E0B",
                    fontWeight: 600
                  }}>{it.h}</span>
                </div>
              );
            })}
            {cd === CHECKLIST.length && (
              <div style={{
                marginTop: 18,
                padding: 16,
                background: "rgba(16,185,129,0.06)",
                borderRadius: 11,
                textAlign: "center"
              }}>
                <div style={{ fontSize: 30 }}>{"\u{1F389}"}</div>
                <div style={{
                  fontWeight: 700,
                  color: "#10B981"
                }}>Journée complète !</div>
              </div>
            )}
          </div>
        )}

        {/* Param page */}
        {pg === "param" && (
          <ParamPage users={users} setUsers={setUsers} curUser={curUser} />
        )}

        {/* Agenda page */}
        {pg === "agenda" && (
          <AgendaPage dos={dos} onOpen={d => {
            sDd(d);
            sDt("rapport");
            sP("det");
          }} curUser={curUser} />
        )}

        {/* Chart page */}
        {pg === "chart" && (
          <ChartPage dos={dos} curUser={curUser} />
        )}

        {/* Chat page */}
        {pg === "chat" && (
          <ChatPage curUser={curUser} users={users} />
        )}

        {/* Inbox page */}
        {pg === "inbox" && (
          <InboxPage curUser={curUser} users={users} />
        )}

        {/* Todo page */}
        {pg === "todo" && (
          <TodoPage curUser={curUser} users={users} />
        )}

        {/* Contacts page */}
        {pg === "contacts" && (
          <ContactsPage />
        )}
      </div>
    </div>
  );
}

export default MainApp
