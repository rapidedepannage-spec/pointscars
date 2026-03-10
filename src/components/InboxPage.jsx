import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { OUTLOOK_SCOPES } from '../config/constants';
import { fd } from '../utils/helpers';

function InboxPage({ curUser, users }) {
  const [tab, setTab] = useState("received");
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [toUser, setToUser] = useState("");
  const [msgText, setMsgText] = useState("");
  const [viewMsg, setViewMsg] = useState(null);

  // Charger messages reçus
  useEffect(function () {
    var unsub = db.collection("inbox").where("toId", "==", curUser.id).onSnapshot(function (snap) {
      var list = snap.docs.map(function (d) {
        return {
          id: d.id,
          ...d.data()
        };
      });
      list.sort(function (a, b) {
        return (b.date || "").localeCompare(a.date || "");
      });
      setReceived(list);
    });
    return function () {
      unsub();
    };
  }, [curUser.id]);

  // Charger messages envoyés
  useEffect(function () {
    var unsub = db.collection("inbox").where("fromId", "==", curUser.id).onSnapshot(function (snap) {
      var list = snap.docs.map(function (d) {
        return {
          id: d.id,
          ...d.data()
        };
      });
      list.sort(function (a, b) {
        return (b.date || "").localeCompare(a.date || "");
      });
      setSent(list);
    });
    return function () {
      unsub();
    };
  }, [curUser.id]);

  var activeUsers = users.filter(function (u) {
    return u.actif && u.id !== curUser.id;
  });

  var sendMessage = function () {
    if (!toUser || !msgText.trim()) return alert("Choisissez un destinataire et écrivez un message");
    var dest = users.find(function (u) {
      return u.id === toUser;
    });
    if (!dest) return alert("Destinataire introuvable");
    db.collection("inbox").add({
      fromId: curUser.id,
      fromName: curUser.nom,
      fromRole: curUser.role,
      toId: dest.id,
      toName: dest.nom,
      toRole: dest.role,
      text: msgText.trim(),
      date: new Date().toISOString(),
      read: false
    });
    botMsg("general", "📬 " + curUser.nom + " a envoyé un message privé à " + dest.nom);
    setMsgText("");
    setToUser("");
    setShowNew(false);
  };

  var markRead = function (msg) {
    if (!msg.read) db.collection("inbox").doc(msg.id).update({
      read: true
    });
    setViewMsg(msg);
  };

  var deleteMsg = function (id) {
    if (confirm("Supprimer ce message ?")) db.collection("inbox").doc(id).delete();
    if (viewMsg && viewMsg.id === id) setViewMsg(null);
  };

  var replyTo = function (msg) {
    setToUser(msg.fromId);
    setMsgText("");
    setShowNew(true);
    setViewMsg(null);
  };

  var formatDate = function (d) {
    if (!d) return "";
    var dt = new Date(d);
    return dt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    }) + " " + dt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  var getColor = function (role) {
    var r = ROLES.find(function (x) {
      return x.id === role;
    });
    return r ? r.c : "#94A3B8";
  };

  var messages = tab === "received" ? received : sent;
  var unreadCount = received.filter(function (m) {
    return !m.read;
  }).length;

  // Vue message ouvert
  if (viewMsg) {
    var isFrom = viewMsg.fromId === curUser.id;
    return (
      <div style={{ animation: "fi .3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span onClick={function () { setViewMsg(null); }}
            style={{ fontSize: 18, cursor: "pointer", color: "#94A3B8" }}>←</span>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>📬 Message</h1>
        </div>
        <div style={{ ...S.c, padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: getColor(viewMsg.fromRole) + "25",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 16, color: getColor(viewMsg.fromRole)
              }}>
                {(viewMsg.fromName || "?").charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {isFrom ? "Vous → " + viewMsg.toName : viewMsg.fromName}
                </div>
                <div style={{ fontSize: 9, color: "#94A3B8" }}>{formatDate(viewMsg.date)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!isFrom && (
                <button onClick={function () { replyTo(viewMsg); }}
                  style={{ ...S.b, background: "linear-gradient(135deg,#3B82F6,#2563EB)", color: "#FFF" }}>
                  ↩ Répondre
                </button>
              )}
              <button onClick={function () { deleteMsg(viewMsg.id); }}
                style={{
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: 8,
                  color: "#FCA5A5",
                  fontSize: 11,
                  cursor: "pointer"
                }}>🗑</button>
            </div>
          </div>
          <div style={{
            background: "#0F172A", borderRadius: 10, padding: "16px",
            fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
            border: "1px solid #334155"
          }}>
            {viewMsg.text}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fi .3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>📬 Boîte aux lettres</h1>
        <button onClick={function () { setShowNew(!showNew); }}
          style={{
            ...S.b,
            background: showNew ? "rgba(239,68,68,0.1)" : "linear-gradient(135deg,#F59E0B,#D97706)",
            color: showNew ? "#FCA5A5" : "#0F172A",
            fontWeight: 700
          }}>
          {showNew ? "✕ Annuler" : "✏️ Nouveau message"}
        </button>
      </div>

      {showNew && (
        <div style={{
          ...S.c, padding: "18px", marginBottom: 14,
          border: "1px solid rgba(245,158,11,0.3)", animation: "fi .2s"
        }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#F59E0B" }}>✏️ Nouveau message</h4>
          <div style={{ marginBottom: 8 }}>
            <label style={S.l}>@ Destinataire</label>
            <select style={S.i} value={toUser} onChange={function (e) { setToUser(e.target.value); }}>
              <option value="">Choisir un destinataire…</option>
              {activeUsers.map(function (u) {
                var rc = ROLES.find(function (r) { return r.id === u.role; });
                return (
                  <option key={u.id} value={u.id}>@{u.nom} — {rc ? rc.l : u.role}</option>
                );
              })}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={S.l}>Message</label>
            <textarea
              style={{ ...S.i, height: 100, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              value={msgText}
              onChange={function (e) { setMsgText(e.target.value); }}
              placeholder="Écrivez votre message…"
            />
          </div>
          <div style={{ textAlign: "right" }}>
            <button onClick={sendMessage} disabled={!toUser || !msgText.trim()}
              style={{
                padding: "10px 20px",
                background: toUser && msgText.trim() ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#334155",
                border: "none", borderRadius: 8,
                color: toUser && msgText.trim() ? "#0F172A" : "#64748B",
                fontWeight: 700, fontSize: 12,
                cursor: toUser && msgText.trim() ? "pointer" : "default"
              }}>📤 Envoyer</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <div onClick={function () { setTab("received"); }}
          style={{
            padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 11,
            fontWeight: tab === "received" ? 700 : 400,
            background: tab === "received" ? "rgba(59,130,246,0.15)" : "#1E293B",
            color: tab === "received" ? "#60A5FA" : "#94A3B8",
            border: "1px solid " + (tab === "received" ? "rgba(59,130,246,0.3)" : "#334155")
          }}>
          📥 Reçus ({received.length}){unreadCount > 0 ? " · " + unreadCount + " nouveau" + (unreadCount > 1 ? "x" : "") : ""}
        </div>
        <div onClick={function () { setTab("sent"); }}
          style={{
            padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 11,
            fontWeight: tab === "sent" ? 700 : 400,
            background: tab === "sent" ? "rgba(139,92,246,0.15)" : "#1E293B",
            color: tab === "sent" ? "#A78BFA" : "#94A3B8",
            border: "1px solid " + (tab === "sent" ? "rgba(139,92,246,0.3)" : "#334155")
          }}>
          📤 Envoyés ({sent.length})
        </div>
        <div onClick={function () { setTab("outlook"); }}
          style={{
            padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 11,
            fontWeight: tab === "outlook" ? 700 : 400,
            background: tab === "outlook" ? "rgba(0,120,212,0.15)" : "#1E293B",
            color: tab === "outlook" ? "#60A5FA" : "#94A3B8",
            border: "1px solid " + (tab === "outlook" ? "rgba(0,120,212,0.3)" : "#334155")
          }}>
          📧 Outlook
        </div>
      </div>

      {tab === "outlook" ? (
        <OutlookPage curUser={curUser} />
      ) : (
        <div style={{ ...S.c, padding: "8px" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: 30, color: "#64748B", fontSize: 12 }}>
              {tab === "received" ? "Aucun message reçu" : "Aucun message envoyé"}
            </div>
          )}
          {messages.map(function (m) {
            var isUnread = tab === "received" && !m.read;
            var person = tab === "received" ? m.fromName : m.toName;
            var personRole = tab === "received" ? m.fromRole : m.toRole;
            var preview = m.text.length > 80 ? m.text.slice(0, 80) + "…" : m.text;
            return (
              <div key={m.id} onClick={function () { markRead(m); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", cursor: "pointer",
                  borderBottom: "1px solid #1E293B",
                  background: isUnread ? "rgba(59,130,246,0.04)" : "transparent"
                }}>
                {isUnread && (
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: "#3B82F6", flexShrink: 0 }} />
                )}
                {!isUnread && (
                  <div style={{ width: 8, flexShrink: 0 }} />
                )}
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: getColor(personRole) + "25",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 13, color: getColor(personRole), flexShrink: 0
                }}>
                  {(person || "?").charAt(0)}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontWeight: isUnread ? 700 : 500, fontSize: 12 }}>
                      {tab === "received" ? "De" : "À"} @{person}
                    </span>
                    <span style={{ fontSize: 8, color: "#64748B", flexShrink: 0 }}>{formatDate(m.date)}</span>
                  </div>
                  <div style={{
                    fontSize: 11, color: isUnread ? "#E2E8F0" : "#94A3B8",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                  }}>
                    {preview}
                  </div>
                </div>
                <span onClick={function (e) { e.stopPropagation(); deleteMsg(m.id); }}
                  style={{ color: "#64748B", cursor: "pointer", fontSize: 10, opacity: 0.5, flexShrink: 0 }}>
                  ✕
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default InboxPage;
