import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { OUTLOOK_SCOPES } from '../config/constants';
import { fd } from '../utils/helpers';

function OutlookPage({ curUser }) {
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookAccount, setOutlookAccount] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewEmail, setViewEmail] = useState(null);
  const [tab, setTab] = useState("inbox");
  const [showNew, setShowNew] = useState(false);
  const [newTo, setNewTo] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [savingAttId, setSavingAttId] = useState(null);
  const [allDos, setAllDos] = useState([]);
  const [savedMsg, setSavedMsg] = useState(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const [dosSearch, setDosSearch] = useState("");

  useEffect(function() {
    if(!window.msalInstance) return;
    var accounts = window.msalInstance.getAllAccounts();
    if(accounts.length > 0) { setOutlookAccount(accounts[0]); setOutlookConnected(true); }
  }, []);

  // Charger les dossiers pour le selecteur
  useEffect(function() {
    var unsub = db.collection("dossiers").onSnapshot(function(snap) {
      setAllDos(snap.docs.map(function(d){return {id:d.id,cli:d.data().cli||"",imm:d.data().imm||"",num:d.data().num||"",veh:d.data().veh||""};}));
    });
    return function(){unsub();};
  }, []);

  useEffect(function() {
    if(outlookConnected) fetchEmails();
  }, [outlookConnected, tab]);

  function getToken() {
    if(!window.msalInstance) return Promise.reject(new Error("MSAL non disponible"));
    var account = window.msalInstance.getAllAccounts()[0];
    if(!account) return Promise.reject(new Error("Non connecté"));
    return window.msalInstance.acquireTokenSilent({ scopes: OUTLOOK_SCOPES, account: account }).catch(function() {
      return window.msalInstance.acquireTokenPopup({ scopes: OUTLOOK_SCOPES });
    });
  }

  function connectOutlook() {
    if(!window.msalInstance) { setError("MSAL non chargé. Vérifiez la connexion internet."); return; }
    setLoading(true); setError(null);
    window.msalInstance.loginPopup({ scopes: OUTLOOK_SCOPES }).then(function(resp) {
      setOutlookAccount(resp.account); setOutlookConnected(true); setLoading(false);
    }).catch(function(err) { setError("Connexion échouée: " + (err.message || err)); setLoading(false); });
  }

  function disconnectOutlook() {
    if(!window.msalInstance) return;
    var account = window.msalInstance.getAllAccounts()[0];
    if(account) window.msalInstance.logoutPopup({ account: account }).catch(function(){});
    setOutlookConnected(false); setOutlookAccount(null); setEmails([]); setViewEmail(null);
  }

  function fetchEmails() {
    setLoading(true); setError(null);
    getToken().then(function(tokenResp) {
      var url = "https://graph.microsoft.com/v1.0/me/";
      url += tab === "sent" ? "mailFolders('SentItems')/messages" : "messages";
      url += "?$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead&$top=30&$orderby=receivedDateTime desc";
      if(search.trim()) url += "&$search=\"" + encodeURIComponent(search.trim()) + "\"";
      return fetch(url, { headers: { "Authorization": "Bearer " + tokenResp.accessToken } });
    }).then(function(r) { return r.json(); }).then(function(data) {
      if(data.error) { setError(data.error.message); setEmails([]); }
      else setEmails(data.value || []);
      setLoading(false);
    }).catch(function(err) { setError("Erreur: " + err.message); setLoading(false); });
  }

  function openEmail(msg) {
    setLoadingDetail(true); setShowReply(false); setReplyBody("");
    setAttachments([]); setSavingAttId(null); setSavedMsg(null); setDosSearch("");
    getToken().then(function(tokenResp) {
      // Charger le contenu du mail
      fetch("https://graph.microsoft.com/v1.0/me/messages/" + msg.id + "?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,hasAttachments", {
        headers: { "Authorization": "Bearer " + tokenResp.accessToken }
      }).then(function(r){return r.json();}).then(function(data) {
        setViewEmail(data); setLoadingDetail(false);
        if(!msg.isRead) {
          fetch("https://graph.microsoft.com/v1.0/me/messages/" + msg.id, {
            method: "PATCH", headers: { "Authorization": "Bearer " + tokenResp.accessToken, "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true })
          }).catch(function(){});
        }
        // Charger les pieces jointes si presentes
        if(data.hasAttachments) {
          fetch("https://graph.microsoft.com/v1.0/me/messages/" + msg.id + "/attachments", {
            headers: { "Authorization": "Bearer " + tokenResp.accessToken }
          }).then(function(r){return r.json();}).then(function(attData) {
            var atts = (attData.value || []).filter(function(a){return !a.isInline && a.contentBytes;});
            setAttachments(atts);
          }).catch(function(){});
        }
      }).catch(function(err) { setError("Erreur lecture: " + err.message); setLoadingDetail(false); });
    }).catch(function(err) { setError("Erreur token: " + err.message); setLoadingDetail(false); });
  }

  function sendEmail() {
    if(!newTo.trim() || !newSubject.trim()) { setError("Destinataire et objet requis"); return; }
    setSending(true); setError(null);
    getToken().then(function(tokenResp) {
      return fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST", headers: { "Authorization": "Bearer " + tokenResp.accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { subject: newSubject, body: { contentType: "Text", content: newBody },
          toRecipients: newTo.split(",").map(function(e) { return { emailAddress: { address: e.trim() } }; }) }, saveToSentItems: true })
      });
    }).then(function(r) {
      if(r.status === 202 || r.ok) { setShowNew(false); setNewTo(""); setNewSubject(""); setNewBody(""); fetchEmails(); }
      else { return r.json().then(function(d) { setError("Erreur envoi: " + (d.error ? d.error.message : "inconnu")); }); }
      setSending(false);
    }).catch(function(err) { setError("Erreur envoi: " + err.message); setSending(false); });
  }

  function sendReply() {
    if(!replyBody.trim() || !viewEmail) return;
    setSending(true);
    getToken().then(function(tokenResp) {
      return fetch("https://graph.microsoft.com/v1.0/me/messages/" + viewEmail.id + "/reply", {
        method: "POST", headers: { "Authorization": "Bearer " + tokenResp.accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: replyBody })
      });
    }).then(function(r) {
      if(r.status === 202 || r.ok) { setShowReply(false); setReplyBody(""); }
      setSending(false);
    }).catch(function(err) { setError("Erreur réponse: " + err.message); setSending(false); });
  }

  function saveAttachmentToDossier(att, dosId) {
    setSavingBusy(true); setSavedMsg(null);
    try {
      var id = uid();
      var cleanName = (att.name || "fichier").replace(/[^a-zA-Z0-9._-]/g, "_");
      var spath = "dossiers/" + dosId + "/photos/" + id + "_" + cleanName;
      var dataUrl = "data:" + (att.contentType || "application/octet-stream") + ";base64," + att.contentBytes;
      var ref = storage.ref(spath);
      ref.putString(dataUrl, "data_url").then(function(snap) {
        return snap.ref.getDownloadURL();
      }).then(function(url) {
        return db.collection("dossiers").doc(dosId).collection("photos").doc(id).set({
          id: id,
          url: url,
          path: spath,
          name: att.name || "fichier",
          cat: "non_classee",
          date: new Date().toISOString(),
          size: att.size || 0
        });
      }).then(function() {
        var dos = allDos.find(function(d){return d.id === dosId;});
        setSavedMsg("Enregistré dans " + (dos ? dos.cli + " " + dos.imm : "dossier"));
        setSavingAttId(null); setSavingBusy(false); setDosSearch("");
        setTimeout(function(){setSavedMsg(null);}, 3000);
      }).catch(function(err) {
        setError("Erreur sauvegarde: " + err.message);
        setSavingBusy(false);
      });
    } catch(e) { setError("Erreur: " + e.message); setSavingBusy(false); }
  }

  function fmtSize(bytes) {
    if(!bytes) return "";
    if(bytes < 1024) return bytes + " o";
    if(bytes < 1048576) return Math.round(bytes/1024) + " Ko";
    return (bytes/1048576).toFixed(1) + " Mo";
  }

  function getFileIcon(name) {
    if(!name) return "\uD83D\uDCCE";
    var ext = name.split(".").pop().toLowerCase();
    if(["jpg","jpeg","png","gif","bmp","webp"].indexOf(ext) >= 0) return "\uD83D\uDDBC\uFE0F";
    if(ext === "pdf") return "\uD83D\uDCC4";
    if(["doc","docx"].indexOf(ext) >= 0) return "\uD83D\uDCC3";
    if(["xls","xlsx"].indexOf(ext) >= 0) return "\uD83D\uDCCA";
    if(["zip","rar","7z"].indexOf(ext) >= 0) return "\uD83D\uDDDC\uFE0F";
    return "\uD83D\uDCCE";
  }

  function fmtDate(d) {
    if(!d) return "";
    var dt = new Date(d);
    var now = new Date();
    var isToday = dt.toDateString() === now.toDateString();
    var yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
    var isYesterday = dt.toDateString() === yesterday.toDateString();
    var time = dt.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"});
    if(isToday) return time;
    if(isYesterday) return "Hier " + time;
    return dt.toLocaleDateString("fr-FR", {day:"2-digit",month:"short"}) + " " + time;
  }

  function getInitial(name) {
    if(!name) return "?";
    return name.charAt(0).toUpperCase();
  }

  var avatarColors = ["#F59E0B","#3B82F6","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
  function getAvatarColor(str) {
    if(!str) return avatarColors[0];
    var h = 0; for(var i=0;i<str.length;i++) h = str.charCodeAt(i) + ((h<<5)-h);
    return avatarColors[Math.abs(h) % avatarColors.length];
  }

  // === PAGE NON CONNECTE ===
  if(!outlookConnected) {
    return (
      <div style={{animation:"fi .3s",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}>
        <div style={{...S.c, padding:"48px 40px", textAlign:"center", maxWidth:420, width:"100%"}}>
          <div style={{width:80,height:80,borderRadius:20,background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:36}}>📧</div>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:6,color:"#F8FAFC"}}>Outlook</h2>
          <p style={{color:"#94A3B8",fontSize:13,marginBottom:28,lineHeight:1.5}}>Consultez et envoyez vos emails Outlook directement depuis l'application.</p>
          {error && <div style={{color:"#EF4444",fontSize:12,marginBottom:16,padding:"8px 12px",background:"#EF444415",borderRadius:8,border:"1px solid #EF444430"}}>{error}</div>}
          <button onClick={connectOutlook} disabled={loading} style={{...S.b,padding:"14px 36px",fontSize:14,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading ? "Connexion en cours..." : "Se connecter avec Microsoft"}
          </button>
          <p style={{color:"#475569",fontSize:10,marginTop:20}}>Fonctionne uniquement en HTTPS (Netlify)</p>
        </div>
      </div>
    );
  }

  // === VUE DETAIL EMAIL ===
  if(viewEmail) {
    var fromName = viewEmail.from ? (viewEmail.from.emailAddress.name || viewEmail.from.emailAddress.address) : "Inconnu";
    var fromEmail = viewEmail.from ? viewEmail.from.emailAddress.address : "";
    var toList = viewEmail.toRecipients ? viewEmail.toRecipients.map(function(r){return r.emailAddress.name || r.emailAddress.address;}).join(", ") : "";
    var ccList = viewEmail.ccRecipients ? viewEmail.ccRecipients.map(function(r){return r.emailAddress.name || r.emailAddress.address;}).join(", ") : "";

    return (
      <div style={{animation:"fi .3s"}}>
        {/* Barre d'actions */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
          <button onClick={function(){ setViewEmail(null); setShowReply(false); }}
            style={{...S.bg,display:"flex",alignItems:"center",gap:6,padding:"8px 16px"}}>← Retour</button>
          <div style={{flex:1}} />
          <button onClick={function(){ setShowReply(!showReply); }}
            style={{...S.b,display:"flex",alignItems:"center",gap:6,padding:"8px 18px"}}>↩️ Répondre</button>
        </div>
        {/* Carte email */}
        <div style={{...S.c,padding:0,overflow:"hidden"}}>
          {/* En-tete */}
          <div style={{padding:"20px 24px",borderBottom:"1px solid #334155"}}>
            <h2 style={{fontSize:18,fontWeight:700,color:"#F8FAFC",marginBottom:16,lineHeight:1.4}}>{viewEmail.subject || "(Sans objet)"}</h2>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:42,height:42,borderRadius:12,background:getAvatarColor(fromName)+"20",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,color:getAvatarColor(fromName),flexShrink:0}}>{getInitial(fromName)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,color:"#F8FAFC"}}>{fromName}</div>
                <div style={{fontSize:11,color:"#64748B",marginTop:1}}>{fromEmail}</div>
              </div>
              <div style={{fontSize:11,color:"#64748B",whiteSpace:"nowrap",flexShrink:0}}>{fmtDate(viewEmail.receivedDateTime)}</div>
            </div>
            {toList && <div style={{fontSize:11,color:"#94A3B8",marginTop:10,paddingLeft:54}}>{"À : " + toList}</div>}
            {ccList && <div style={{fontSize:11,color:"#94A3B8",marginTop:3,paddingLeft:54}}>{"Cc : " + ccList}</div>}
            {viewEmail.hasAttachments && <div style={{fontSize:11,color:"#F59E0B",marginTop:6,paddingLeft:54}}>📎 Pièce(s) jointe(s)</div>}
          </div>
          {/* Corps */}
          {loadingDetail ? (
            <div style={{padding:40,textAlign:"center",color:"#94A3B8"}}>Chargement...</div>
          ) : viewEmail.body ? (
            <div style={{padding:"4px",background:"#F8FAFC",borderRadius:"0 0 12px 12px",overflowX:"auto",maxHeight:600,overflowY:"auto"}}>
              <div style={{padding:"20px 24px",fontSize:14,lineHeight:1.7,color:"#1E293B",fontFamily:"Segoe UI, Arial, sans-serif",wordBreak:"break-word"}}
                dangerouslySetInnerHTML={{__html: "<style>body,div,p,span,td,th,li,ul,ol,h1,h2,h3,h4{font-family:Segoe UI,Arial,sans-serif!important} a{color:#2563EB!important} img{max-width:100%;height:auto} table{max-width:100%!important} blockquote{border-left:3px solid #CBD5E1;margin:8px 0;padding:4px 12px;color:#475569}</style>" + viewEmail.body.content}} />
            </div>
          ) : (
            <div style={{padding:"20px 24px",fontSize:13,color:"#94A3B8",textAlign:"center"}}>Contenu indisponible</div>
          )}
        </div>
        {/* Pieces jointes */}
        {attachments.length > 0 && (
          <div style={{...S.c,padding:"16px 20px",marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{fontSize:15}}>📎</span>
              <span style={{fontSize:13,fontWeight:600,color:"#F8FAFC"}}>{"Pièces jointes (" + attachments.length + ")"}</span>
            </div>
            {savedMsg && <div style={{fontSize:12,color:"#10B981",padding:"8px 12px",background:"#10B98115",borderRadius:8,marginBottom:10,border:"1px solid #10B98130"}}>{"✅ " + savedMsg}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {attachments.map(function(att, idx) {
                var isOpen = savingAttId === att.id;
                var filteredDos = allDos;
                if(dosSearch.trim()) {
                  var q = dosSearch.trim().toLowerCase();
                  filteredDos = allDos.filter(function(d){
                    return (d.cli||"").toLowerCase().indexOf(q)>=0 || (d.imm||"").toLowerCase().indexOf(q)>=0 || (d.num||"").toLowerCase().indexOf(q)>=0;
                  });
                }
                return (
                  <div key={att.id||idx}>
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#0F172A",borderRadius:8,border:"1px solid #334155"}}>
                      <span style={{fontSize:20,flexShrink:0}}>{getFileIcon(att.name)}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name || "Fichier"}</div>
                        <div style={{fontSize:10,color:"#64748B",marginTop:2}}>{fmtSize(att.size) + " — " + (att.contentType || "").split("/").pop()}</div>
                      </div>
                      <button onClick={function(){
                        if(isOpen) { setSavingAttId(null); setDosSearch(""); }
                        else setSavingAttId(att.id);
                      }} style={{...S.b,padding:"6px 14px",fontSize:11,whiteSpace:"nowrap"}}>
                        {isOpen ? "✕ Fermer" : "📁 Dossier"}
                      </button>
                    </div>
                    {/* Selecteur de dossier */}
                    {isOpen && (
                      <div style={{marginTop:6,marginLeft:30,padding:"12px",background:"#1E293B",borderRadius:8,border:"1px solid #334155",maxHeight:250,overflowY:"auto"}}>
                        <input type="text" value={dosSearch} onChange={function(e){setDosSearch(e.target.value);}}
                          placeholder="🔍 Rechercher un dossier (client, immat, n°)..."
                          style={{...S.i,marginBottom:8,fontSize:12}} />
                        {savingBusy ? (
                          <div style={{textAlign:"center",padding:12,color:"#F59E0B",fontSize:12}}>⏳ Enregistrement en cours...</div>
                        ) : filteredDos.length === 0 ? (
                          <div style={{textAlign:"center",padding:12,color:"#64748B",fontSize:11}}>Aucun dossier trouvé</div>
                        ) : (
                          <div style={{display:"flex",flexDirection:"column",gap:3}}>
                            {filteredDos.slice(0,15).map(function(dos) {
                              return (
                                <div key={dos.id}
                                  onClick={function(){ saveAttachmentToDossier(att, dos.id); }}
                                  style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:6,cursor:"pointer",
                                    background:"#0F172A",border:"1px solid #334155",transition:"all .15s"}}>
                                  <span style={{fontSize:13}}>📁</span>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:12,fontWeight:600,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dos.cli || "Sans nom"}</div>
                                    <div style={{fontSize:10,color:"#64748B"}}>{[dos.num,dos.veh,dos.imm].filter(Boolean).join(" — ")}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Zone de reponse */}
        {showReply && (
          <div style={{...S.c,padding:"20px 24px",marginTop:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{fontSize:14}}>↩️</span>
              <span style={{fontSize:13,fontWeight:600,color:"#F8FAFC"}}>{"Répondre à " + fromName}</span>
            </div>
            <textarea value={replyBody} onChange={function(e){setReplyBody(e.target.value);}}
              placeholder="Votre réponse..." rows={5}
              style={{...S.i,width:"100%",marginBottom:12,resize:"vertical",lineHeight:1.6}} />
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={function(){ setShowReply(false); setReplyBody(""); }} style={S.bg}>Annuler</button>
              <button onClick={sendReply} disabled={sending||!replyBody.trim()} style={S.b}>
                {sending ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === VUE LISTE ===
  var unreadCount = emails.filter(function(m){return !m.isRead;}).length;

  return (
    <div style={{animation:"fi .3s"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
        <h1 style={{fontSize:22,fontWeight:700,flex:1}}>📧 Outlook</h1>
        {outlookAccount && <div style={{fontSize:11,color:"#94A3B8",background:"#1E293B",padding:"4px 12px",borderRadius:20,border:"1px solid #334155",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{outlookAccount.username}</div>}
      </div>
      {/* Barre d'actions */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={function(){setShowNew(!showNew);}} style={{...S.b,display:"flex",alignItems:"center",gap:6}}>{showNew ? "Annuler" : "+ Nouveau"}</button>
        <div style={{flex:1}} />
        <button onClick={fetchEmails} disabled={loading} style={{...S.bg,padding:"8px 14px"}}>{loading ? "⏳" : "↻ Actualiser"}</button>
        <button onClick={disconnectOutlook} style={{...S.bg,color:"#EF4444",padding:"8px 14px"}}>Déconnecter</button>
      </div>
      {/* Erreur */}
      {error && (
        <div style={{color:"#EF4444",fontSize:12,marginBottom:12,padding:"10px 14px",background:"#EF444415",borderRadius:8,border:"1px solid #EF444430",display:"flex",alignItems:"center",gap:8}}>
          <span>⚠️</span>
          <span style={{flex:1}}>{error}</span>
          <span onClick={function(){setError(null);}} style={{cursor:"pointer",opacity:0.6}}>✕</span>
        </div>
      )}
      {/* Nouveau mail */}
      {showNew && (
        <div style={{...S.c,padding:"20px 24px",marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:14,color:"#F8FAFC"}}>✉️ Nouveau message</h3>
          <label style={S.l}>Destinataire(s)</label>
          <input type="email" value={newTo} onChange={function(e){setNewTo(e.target.value);}}
            placeholder="email@exemple.com (séparer par virgule)" style={{...S.i,marginBottom:10}} />
          <label style={S.l}>Objet</label>
          <input type="text" value={newSubject} onChange={function(e){setNewSubject(e.target.value);}}
            placeholder="Objet du message" style={{...S.i,marginBottom:10}} />
          <label style={S.l}>Message</label>
          <textarea value={newBody} onChange={function(e){setNewBody(e.target.value);}}
            placeholder="Votre message..." rows={6} style={{...S.i,marginBottom:14,resize:"vertical",lineHeight:1.6}} />
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={function(){setShowNew(false);setNewTo("");setNewSubject("");setNewBody("");}} style={S.bg}>Annuler</button>
            <button onClick={sendEmail} disabled={sending} style={S.b}>{sending ? "Envoi..." : "📨 Envoyer"}</button>
          </div>
        </div>
      )}
      {/* Onglets + Recherche */}
      <div style={{...S.c,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        {[["inbox","📥 Réception" + (unreadCount > 0 ? " (" + unreadCount + ")" : "")],["sent","📤 Envoyés"]].map(function(t){
          var active = tab === t[0];
          return (
            <button key={t[0]} onClick={function(){setTab(t[0]);}}
              style={{padding:"6px 16px",fontSize:12,fontWeight:active?700:500,
                background:active?"linear-gradient(135deg,#F59E0B,#D97706)":"transparent",
                color:active?"#0F172A":"#94A3B8",border:active?"none":"1px solid #334155",
                borderRadius:8,cursor:"pointer",transition:"all .2s"}}>{t[1]}</button>
          );
        })}
        <div style={{flex:1}} />
        <div style={{display:"flex",gap:4,alignItems:"center",minWidth:180,maxWidth:280,flex:"0 1 280px"}}>
          <input type="text" value={search} onChange={function(e){setSearch(e.target.value);}}
            onKeyDown={function(e){if(e.key==="Enter")fetchEmails();}}
            placeholder="🔍 Rechercher..." style={{...S.i,padding:"6px 10px",fontSize:12}} />
          {search && <span onClick={function(){setSearch("");setTimeout(fetchEmails,100);}}
            style={{cursor:"pointer",color:"#94A3B8",fontSize:14}}>✕</span>}
        </div>
      </div>
      {/* Liste emails */}
      {loading && emails.length === 0 ? (
        <div style={{...S.c,padding:40,textAlign:"center"}}>
          <div style={{fontSize:24,marginBottom:8}}>⏳</div>
          <p style={{color:"#94A3B8",fontSize:13}}>Chargement des emails...</p>
        </div>
      ) : emails.length === 0 ? (
        <div style={{...S.c,padding:40,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>{tab === "sent" ? "📤" : "📥"}</div>
          <p style={{color:"#64748B",fontSize:13}}>{tab === "sent" ? "Aucun email envoyé" : "Boîte de réception vide"}</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          {emails.map(function(msg) {
            var from = msg.from ? (msg.from.emailAddress.name || msg.from.emailAddress.address) : "?";
            var fromAddr = msg.from ? msg.from.emailAddress.address : "";
            var to = msg.toRecipients ? msg.toRecipients.map(function(r){return r.emailAddress.name||r.emailAddress.address;}).join(", ") : "";
            var unread = !msg.isRead;
            var displayName = tab === "sent" ? to : from;
            var color = getAvatarColor(displayName);

            return (
              <div key={msg.id} onClick={function(){openEmail(msg);}}
                style={{...S.c,padding:"14px 18px",cursor:"pointer",
                  borderLeft:unread?"3px solid #F59E0B":"3px solid transparent",
                  background:unread?"#F59E0B06":"transparent",
                  transition:"all .15s",display:"flex",alignItems:"flex-start",gap:14}}>
                {/* Avatar */}
                <div style={{width:40,height:40,borderRadius:12,background:color+"20",
                  display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:16,color:color,flexShrink:0,marginTop:2}}>
                  {getInitial(displayName)}
                </div>
                {/* Contenu */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{fontSize:13,fontWeight:unread?700:500,color:unread?"#F8FAFC":"#CBD5E1",flex:1,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {tab === "sent" ? "→ " + to : from}
                    </span>
                    <span style={{fontSize:10,color:"#64748B",whiteSpace:"nowrap",flexShrink:0}}>{fmtDate(msg.receivedDateTime)}</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:unread?600:400,color:unread?"#E2E8F0":"#94A3B8",marginBottom:3,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msg.subject || "(Sans objet)"}</div>
                  <div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.4}}>
                    {msg.bodyPreview || ""}
                  </div>
                </div>
                {/* Indicateur non lu */}
                {unread && <div style={{width:8,height:8,borderRadius:4,background:"#F59E0B",flexShrink:0,marginTop:6}} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OutlookPage;
