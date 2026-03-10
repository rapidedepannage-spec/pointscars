import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { STATUTS } from '../config/constants'
import { S } from '../styles/theme'
import { fd, fmt, uid } from '../utils/helpers'

const DEFAULT_TPLS = [{
  id: "t1",
  ic: "📩",
  titre: "Accusé réception",
  objet: "{CLIENT} — {IMMAT} — Prise en charge",
  corps: "Bonjour,\n\nNous accusons réception de la mission {NUM} pour {VEHICULE} {IMMAT}.\nClient contacté sous 2h.\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34\nautocenter77@outlook.fr"
}, {
  id: "t2",
  ic: "📋",
  titre: "Chiffrage",
  objet: "{CLIENT} — {IMMAT} — Chiffrage",
  corps: "Bonjour,\n\nCi-joint chiffrage {VEHICULE} {IMMAT}.\nMontant HT: {MONTANT}€\nFranchise: {FRANCHISE}€\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34"
}, {
  id: "t3",
  ic: "✅",
  titre: "Accord",
  objet: "{CLIENT} — {IMMAT} — Demande accord",
  corps: "Bonjour,\n\nAccord demandé pour {VEHICULE} {IMMAT}.\nMontant: {MONTANT}€ — Franchise: {FRANCHISE}€\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34"
}, {
  id: "t4",
  ic: "🚗",
  titre: "Fin réparation",
  objet: "{CLIENT} — {IMMAT} — Véhicule prêt",
  corps: "Bonjour {CLIENT},\n\nVotre véhicule {VEHICULE} {IMMAT} est prêt.\nVous pouvez le récupérer aux horaires d'ouverture.\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34"
}, {
  id: "t5",
  ic: "⚠️",
  titre: "Relance",
  objet: "{CLIENT} — {IMMAT} — Relance règlement",
  corps: "Bonjour,\n\nSauf erreur, la facture {NUM} de {MONTANT}€ reste impayée.\nRèglement sous 15 jours SVP.\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34"
}, {
  id: "t6",
  ic: "📄",
  titre: "Ordre de réparation",
  objet: "{CLIENT} — {IMMAT} — Ordre de réparation",
  corps: "Bonjour,\n\nVeuillez trouver ci-joint l'ordre de réparation pour {VEHICULE} {IMMAT}.\nClient: {CLIENT}\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34"
}];

function MailsTab({
  d,
  contacts
}) {
  const [tpls, setTpls] = useState([]);
  const [tplLoaded, setTplLoaded] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [newCt, setNewCt] = useState({
    nom: "",
    type: "expert",
    email: "",
    tel: ""
  });
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({
    ic: "",
    titre: "",
    objet: "",
    corps: ""
  });
  const [showNew, setShowNew] = useState(false);
  const [newF, setNewF] = useState({
    ic: "✉️",
    titre: "",
    objet: "",
    corps: "Bonjour,\n\n\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34"
  });

  // Charger templates depuis Firebase
  useEffect(function () {
    var unsub = db.collection("mailTemplates").onSnapshot(function (snap) {
      var t = snap.docs.map(function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      });
      t.sort(function (a, b) {
        return (a.ordre || 0) - (b.ordre || 0);
      });
      if (t.length === 0 && !tplLoaded) {
        // Premier lancement: créer les templates par défaut
        DEFAULT_TPLS.forEach(function (tpl, i) {
          db.collection("mailTemplates").doc(tpl.id).set({
            ...tpl,
            ordre: i
          });
        });
      } else {
        setTpls(t);
      }
      setTplLoaded(true);
    }, function (err) {
      console.error(err);
      setTplLoaded(true);
    });
    return function () {
      unsub();
    };
  }, []);

  // Remplacer variables par données dossier
  var replacer = function (txt) {
    return (txt || "").replace(/\{CLIENT\}/g, d.cli || "___").replace(/\{IMMAT\}/g, d.imm || "___").replace(/\{VEHICULE\}/g, d.veh || "___").replace(/\{NUM\}/g, d.num || "___").replace(/\{MONTANT\}/g, d.mt || "___").replace(/\{FRANCHISE\}/g, d.fr || "___").replace(/\{LIVRAISON\}/g, d.liv ? fd(d.liv) : "___").replace(/\{TEL\}/g, d.tel || "___").replace(/\{EMAIL\}/g, d.email || "___").replace(/\{ASSUREUR\}/g, d.ass || "___").replace(/\{EXPERT\}/g, d.exp || "___");
  };

  const addContact = function () {
    if (!newCt.nom || !newCt.email) return alert("Nom et email requis");
    var c = {
      ...newCt,
      id: uid()
    };
    db.collection("contacts").doc(c.id).set(c);
    setNewCt({
      nom: "",
      type: "expert",
      email: "",
      tel: ""
    });
  };

  const delContact = function (id) {
    if (confirm("Supprimer?")) db.collection("contacts").doc(id).delete();
  };

  const expContact = contacts.find(function (c) {
    return c.type === "expert" && d.exp && d.exp.toLowerCase().includes(c.nom.toLowerCase());
  });
  const assContact = contacts.find(function (c) {
    return c.type === "assureur" && d.ass && d.ass.toLowerCase().includes(c.nom.toLowerCase());
  });

  const openOutlook = function (to, subject, body) {
    var url = "https://outlook.live.com/mail/0/deeplink/compose?to=" + encodeURIComponent(to || "") + "&subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    window.open(url, "_blank");
  };

  // Sauvegarder modification template
  var saveEdit = function () {
    if (!editF.titre) return;
    db.collection("mailTemplates").doc(editId).update(editF);
    setEditId(null);
  };

  // Ajouter nouveau template
  var addTpl = function () {
    if (!newF.titre) return alert("Titre requis");
    var id = uid();
    db.collection("mailTemplates").doc(id).set({
      ...newF,
      id: id,
      ordre: tpls.length
    });
    setNewF({
      ic: "✉️",
      titre: "",
      objet: "",
      corps: "Bonjour,\n\n\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34"
    });
    setShowNew(false);
  };

  // Supprimer template
  var delTpl = function (id) {
    if (confirm("Supprimer ce modèle?")) db.collection("mailTemplates").doc(id).delete();
  };

  var ICONES = ["📩", "📋", "✅", "🚗", "⚠️", "📄", "💰", "📞", "🔧", "📦", "🏢", "📊", "✉️"];

  return (
    <div>
      <div style={{ ...S.c, padding: "14px", marginBottom: 14, borderLeft: "4px solid #F59E0B" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>N° SINISTRE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B", fontFamily: "monospace" }}>
              {d.num || "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>CLIENT</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{d.cli || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>EMAIL CLIENT</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: d.email ? "#06B6D4" : "#EF4444" }}>
              {d.email || "⚠️ Non renseigné"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>IMMATRICULATION</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{d.imm || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>VÉHICULE</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{d.veh || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>ASSUREUR</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{d.ass || "—"}{assContact ? " ✅" : ""}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>EXPERT</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{d.exp || "—"}{expContact ? " ✅" : ""}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600 }}>MONTANT / FRANCHISE</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>
              {d.mt ? d.mt + "€" : "—"}{" "}
              <span style={{ color: "#EF4444" }}>{d.fr ? " / " + d.fr + "€" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Mails pré-remplis</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={function () { setShowNew(!showNew); }} style={S.b}>
            {showNew ? "✕" : "+ Nouveau modèle"}
          </button>
          <button onClick={function () { setShowContacts(!showContacts); }} style={S.bg}>
            {showContacts ? "✕" : "📇 Contacts"}
          </button>
          <button
            onClick={function () {
              var q = encodeURIComponent((d.cli || "") + " " + (d.imm || ""));
              window.open("https://outlook.live.com/mail/0/search?query=" + q, "_blank");
            }}
            style={{
              background: "linear-gradient(135deg,#0078D4,#106EBE)",
              color: "#FFF",
              border: "none",
              padding: "8px 16px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 11,
              cursor: "pointer"
            }}
          >
            📧 Outlook
          </button>
        </div>
      </div>

      <div style={{ background: "#0F172A", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 9, color: "#64748B" }}>
        💡 Variables : <span style={{ color: "#F59E0B" }}>
          {"{CLIENT}"} {"{IMMAT}"} {"{VEHICULE}"} {"{NUM}"} {"{MONTANT}"} {"{FRANCHISE}"} {"{LIVRAISON}"} {"{TEL}"} {"{EMAIL}"} {"{ASSUREUR}"} {"{EXPERT}"}
        </span>
      </div>

      {showNew && (
        <div style={{ ...S.c, padding: "14px", marginBottom: 14, animation: "fi .2s", border: "1px solid rgba(245,158,11,0.3)" }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>✨ Nouveau modèle de mail</h4>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={S.l}>Icône</label>
              <select
                style={S.i}
                value={newF.ic}
                onChange={function (e) { setNewF({ ...newF, ic: e.target.value }); }}
              >
                {ICONES.map(function (x) {
                  return <option key={x} value={x}>{x}</option>;
                })}
              </select>
            </div>
            <div>
              <label style={S.l}>Titre du modèle</label>
              <input
                style={S.i}
                value={newF.titre}
                onChange={function (e) { setNewF({ ...newF, titre: e.target.value }); }}
                placeholder="Ex: Demande de pièces"
              />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={S.l}>Objet du mail</label>
            <input
              style={S.i}
              value={newF.objet}
              onChange={function (e) { setNewF({ ...newF, objet: e.target.value }); }}
              placeholder="Ex: {CLIENT} — {IMMAT} — Objet"
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={S.l}>Corps du mail</label>
            <textarea
              rows={5}
              style={{ ...S.i, resize: "vertical" }}
              value={newF.corps}
              onChange={function (e) { setNewF({ ...newF, corps: e.target.value }); }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={function () { setShowNew(false); }} style={S.bg}>Annuler</button>
            <button onClick={addTpl} style={S.b}>✓ Créer</button>
          </div>
        </div>
      )}

      {showContacts && (
        <div style={{ ...S.c, padding: "14px", marginBottom: 14, animation: "fi .2s" }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>📇 Carnet de contacts</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 10, alignItems: "end" }}>
            <div>
              <label style={S.l}>Nom</label>
              <input
                style={S.i}
                value={newCt.nom}
                onChange={function (e) { setNewCt({ ...newCt, nom: e.target.value }); }}
                placeholder="BCA, MAAF…"
              />
            </div>
            <div>
              <label style={S.l}>Type</label>
              <select
                style={S.i}
                value={newCt.type}
                onChange={function (e) { setNewCt({ ...newCt, type: e.target.value }); }}
              >
                <option value="expert">Expert</option>
                <option value="assureur">Assureur</option>
              </select>
            </div>
            <div>
              <label style={S.l}>Email</label>
              <input
                style={S.i}
                value={newCt.email}
                onChange={function (e) { setNewCt({ ...newCt, email: e.target.value }); }}
                placeholder="contact@..."
              />
            </div>
            <div>
              <label style={S.l}>Tél</label>
              <input
                style={S.i}
                value={newCt.tel}
                onChange={function (e) { setNewCt({ ...newCt, tel: e.target.value }); }}
                placeholder="01..."
              />
            </div>
            <button onClick={addContact} style={S.b}>+</button>
          </div>

          {contacts.map(function (c) {
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  background: "#0F172A",
                  borderRadius: 5,
                  marginBottom: 3
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: c.type === "expert" ? "rgba(245,158,11,0.1)" : "rgba(59,130,246,0.1)",
                    color: c.type === "expert" ? "#F59E0B" : "#3B82F6",
                    fontWeight: 600
                  }}
                >
                  {c.type === "expert" ? "EXPERT" : "ASSUREUR"}
                </span>
                <span style={{ fontWeight: 600, fontSize: 11, flex: 1 }}>{c.nom}</span>
                <span style={{ fontSize: 10, color: "#06B6D4" }}>{c.email}</span>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>{c.tel}</span>
                <span
                  onClick={function () { delContact(c.id); }}
                  style={{ cursor: "pointer", color: "#EF4444", fontSize: 10 }}
                >
                  🗑
                </span>
              </div>
            );
          })}

          {!contacts.length && (
            <p style={{ fontSize: 10, color: "#64748B", textAlign: "center", padding: 8 }}>
              Aucun contact — ajoutez vos experts et assureurs
            </p>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 9 }}>
        {tpls.map(function (tpl) {
          var obj = replacer(tpl.objet);
          var body = replacer(tpl.corps);
          var isEditing = editId === tpl.id;

          if (isEditing) return (
            <div
              key={tpl.id}
              style={{ ...S.c, padding: "14px", border: "1px solid rgba(245,158,11,0.4)", animation: "fi .2s" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", gap: 6, marginBottom: 6 }}>
                <div>
                  <label style={S.l}>Icône</label>
                  <select
                    style={S.i}
                    value={editF.ic}
                    onChange={function (e) { setEditF({ ...editF, ic: e.target.value }); }}
                  >
                    {ICONES.map(function (x) {
                      return <option key={x} value={x}>{x}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label style={S.l}>Titre</label>
                  <input
                    style={S.i}
                    value={editF.titre}
                    onChange={function (e) { setEditF({ ...editF, titre: e.target.value }); }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <label style={S.l}>Objet</label>
                <input
                  style={S.i}
                  value={editF.objet}
                  onChange={function (e) { setEditF({ ...editF, objet: e.target.value }); }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={S.l}>Corps</label>
                <textarea
                  rows={5}
                  style={{ ...S.i, resize: "vertical" }}
                  value={editF.corps}
                  onChange={function (e) { setEditF({ ...editF, corps: e.target.value }); }}
                />
              </div>
              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                <button onClick={function () { setEditId(null); }} style={S.bg}>Annuler</button>
                <button onClick={saveEdit} style={S.b}>✓ Enregistrer</button>
              </div>
            </div>
          );

          return (
            <div
              key={tpl.id}
              style={{ ...S.c, padding: "16px", display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: 20 }}>{tpl.ic}</span>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{tpl.titre}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <span
                    onClick={function () {
                      setEditId(tpl.id);
                      setEditF({
                        ic: tpl.ic,
                        titre: tpl.titre,
                        objet: tpl.objet,
                        corps: tpl.corps
                      });
                    }}
                    style={{ cursor: "pointer", fontSize: 12 }}
                  >
                    ✏️
                  </span>
                  <span
                    onClick={function () { delTpl(tpl.id); }}
                    style={{ cursor: "pointer", fontSize: 12 }}
                  >
                    🗑
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: 9,
                  color: "#94A3B8",
                  fontFamily: "monospace",
                  background: "#0F172A",
                  padding: "5px 8px",
                  borderRadius: 5,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {obj}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "auto" }}>
                {d.email && (
                  <button
                    onClick={function () { openOutlook(d.email, obj, body); }}
                    style={{
                      width: "100%",
                      padding: "7px",
                      background: "linear-gradient(135deg,#0078D4,#106EBE)",
                      color: "#FFF",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 10,
                      cursor: "pointer"
                    }}
                  >
                    ✉️ Client ({d.email.split("@")[0]})
                  </button>
                )}
                {expContact && (
                  <button
                    onClick={function () { openOutlook(expContact.email, obj, body); }}
                    style={{
                      width: "100%",
                      padding: "7px",
                      background: "linear-gradient(135deg,#F59E0B,#D97706)",
                      color: "#0F172A",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 10,
                      cursor: "pointer"
                    }}
                  >
                    🔍 Expert ({expContact.nom})
                  </button>
                )}
                {assContact && (
                  <button
                    onClick={function () { openOutlook(assContact.email, obj, body); }}
                    style={{
                      width: "100%",
                      padding: "7px",
                      background: "linear-gradient(135deg,#3B82F6,#2563EB)",
                      color: "#FFF",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 10,
                      cursor: "pointer"
                    }}
                  >
                    🏢 Assureur ({assContact.nom})
                  </button>
                )}
                {!d.email && !expContact && !assContact && (
                  <button
                    onClick={function () { openOutlook("", obj, body); }}
                    style={{
                      width: "100%",
                      padding: "7px",
                      background: "linear-gradient(135deg,#0078D4,#106EBE)",
                      color: "#FFF",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 10,
                      cursor: "pointer"
                    }}
                  >
                    ✉️ Outlook
                  </button>
                )}
                <button
                  onClick={function () { navigator.clipboard.writeText("Objet: " + obj + "\n\n" + body); }}
                  style={{
                    width: "100%",
                    padding: "7px",
                    background: "#0F172A",
                    color: "#94A3B8",
                    border: "1px solid #475569",
                    borderRadius: 6,
                    fontSize: 10,
                    cursor: "pointer"
                  }}
                >
                  📋 Copier
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MailsTab
