import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { OUTLOOK_SCOPES } from '../config/constants';
import { fd } from '../utils/helpers';

function ChatPage({ curUser, users }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [channel, setChannel] = useState("general");
  const bottomRef = useRef(null);

  // Phrases d'encouragement et réflexions profondes
  var PHRASES_ENCOUR = ["💪 Allez l'équipe, on donne tout aujourd'hui !", "🔥 Chaque voiture réparée, c'est un client heureux. Continuez !", "⚡ L'énergie d'aujourd'hui construit le succès de demain.", "🚀 Vous êtes une équipe en or, n'oubliez jamais ça !", "👊 Le travail bien fait est la meilleure des cartes de visite.", "🏆 Petit à petit, on devient les meilleurs. Fier de cette équipe !", "💯 Chaque détail compte. La perfection, c'est votre marque.", "☕ Pause café méritée ! Rechargez les batteries et on repart.", "🎯 Restez concentrés, la fin de journée approche, on finit fort !", "🤝 Le travail d'équipe fait la force. Merci à chacun d'entre vous.", "🌟 Un bon mécanicien ne répare pas que des voitures, il redonne confiance.", "🔧 Vos mains font des miracles chaque jour, soyez-en fiers.", "💼 Le professionnalisme, c'est faire bien même quand personne ne regarde.", "🛠 Chaque problème a une solution. On trouve, on répare, on avance.", "🏁 La journée est un marathon, pas un sprint. Gérez votre rythme !"];
  var PHRASES_REFLEX = ["🌊 \"La mer est calme, mais le marin reste prêt.\" — Sagesse ancienne", "🌱 \"Ce n'est pas la force, mais la constance qui fait les grandes œuvres.\" — Nietzsche", "🔑 \"Le succès, c'est tomber sept fois et se relever huit.\" — Proverbe japonais", "🌅 \"Chaque matin est une chance de tout recommencer.\"", "🧭 \"Celui qui déplace la montagne commence par les petites pierres.\" — Confucius", "💎 \"La patience est amère, mais son fruit est doux.\" — Aristote", "🌳 \"Un arbre qui pousse fait moins de bruit qu'une forêt qui tombe.\"", "🕊 \"Le meilleur moment pour planter un arbre, c'était il y a 20 ans. Le deuxième meilleur, c'est maintenant.\"", "⭐ \"On ne peut pas diriger le vent, mais on peut ajuster les voiles.\"", "🏔 \"Ce qui compte, ce n'est pas la hauteur de la montagne, mais la volonté de la gravir.\"", "🌻 \"Là où il y a de la volonté, il y a un chemin.\"", "🦅 \"L'aigle ne chasse pas les mouches.\" — Proverbe africain", "💫 \"Le talent gagne des matchs, l'équipe gagne des championnats.\" — Michael Jordan", "🎋 \"Le bambou qui plie ne se rompt pas.\" — Proverbe japonais", "🌙 \"Les étoiles ne brillent que dans l'obscurité.\""];

  // Message à l'ouverture du chat (1 fois par session)
  useEffect(function () {
    try {
      var k = "psg_chatopen_" + curUser.id;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
      var prenom = curUser.nom.split(" ")[0];
      var msgs = ["Salut " + prenom + " ! Content de te voir ici 😊", "Hey " + prenom + " ! Bienvenue dans le chat 👋", "Hello " + prenom + " ! L'équipe est là, on avance ensemble 💪", prenom + " est dans la place ! 🔥 Bonne journée à toi !"];
      botMsg("general", msgs[Math.floor(Math.random() * msgs.length)]);
    } catch (e) {}
  }, []);

  // Messages périodiques (toutes les 2h)
  useEffect(function () {
    var sendPeriodic = function () {
      try {
        var now = new Date();
        var h = now.getHours();
        var slot = Math.floor(h / 2);
        var k = "psg_periodic_" + now.toISOString().slice(0, 10) + "_" + slot;
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
        var allPhrases = PHRASES_ENCOUR.concat(PHRASES_REFLEX);
        var phrase = allPhrases[Math.floor(Math.random() * allPhrases.length)];
        botMsg("general", phrase);
      } catch (e) {}
    };
    sendPeriodic();
    var iv = setInterval(sendPeriodic, 300000);
    return function () {
      clearInterval(iv);
    };
  }, []);

  const channels = [{
    id: "general",
    label: "💬 Général",
    color: "#F59E0B"
  }, {
    id: "carrosserie",
    label: "🔧 Carrosserie",
    color: "#3B82F6"
  }, {
    id: "mecanique",
    label: "⚙️ Mécanique",
    color: "#10B981"
  }, {
    id: "urgent",
    label: "🚨 Urgent",
    color: "#EF4444"
  }, {
    id: "bot",
    label: "🤖 Bot IA",
    color: "#8B5CF6"
  }];

  useEffect(function () {
    var unsub = db.collection("chat").doc(channel).collection("messages").orderBy("date", "asc").limitToLast(100).onSnapshot(function (snap) {
      var msgs = snap.docs.map(function (d) {
        return {
          id: d.id,
          ...d.data()
        };
      });
      setMessages(msgs);
      setTimeout(function () {
        if (bottomRef.current) bottomRef.current.scrollIntoView({
          behavior: "smooth"
        });
      }, 100);
    });
    return function () {
      unsub();
    };
  }, [channel]);

  var sendMsg = function () {
    var txt = newMsg.trim();
    if (!txt) return;
    db.collection("chat").doc(channel).collection("messages").add({
      text: txt,
      userId: curUser.id,
      userName: curUser.nom,
      userRole: curUser.role,
      date: new Date().toISOString()
    });
    setNewMsg("");
    // Bot IA — réponse automatique dans les canaux carrosserie, mecanique, bot
    if (channel === "carrosserie" || channel === "mecanique" || channel === "bot") {
      var systemPrompts = {
        carrosserie: "Tu es un expert en carrosserie automobile chez Point S. Tu maîtrises parfaitement : débosselage, redressage, soudure, mastic polyester, apprêt, peinture (base, vernis, teinte), marouflage, ponçage, lustrage, remplacement d'éléments (ailes, capot, pare-chocs, portières), collage de vitrage, réparation de plastiques. Réponds de façon précise, technique et professionnelle en français. Donne des conseils pratiques avec les produits et techniques adaptés.",
        mecanique: "Tu es un expert en mécanique automobile chez Point S. Tu maîtrises parfaitement : moteur (essence, diesel, hybride), distribution, embrayage, boîte de vitesses, freinage (disques, plaquettes, étriers), suspension (amortisseurs, triangles, rotules), direction, climatisation, diagnostic électronique (OBD), injection, turbo, échappement, pneumatiques. Réponds de façon précise, technique et professionnelle en français. Donne des conseils pratiques avec les références et procédures adaptées.",
        bot: "Tu es l'assistant IA de Point S Guignes, un centre de réparation automobile. Tu aides l'équipe sur toutes les questions : assurances, sinistres, procédures administratives, relations clients, devis, facturation, gestion de stock, commandes de pièces, planning. Réponds de façon claire, utile et professionnelle en français."
      };
      var sysP = systemPrompts[channel];
      // Récupérer les derniers messages comme contexte
      var contextMsgs = messages.slice(-10).map(function(m) {
        return (m.isBot ? "Assistant" : m.userName) + ": " + m.text;
      }).join("\n");
      var fullMsg = contextMsgs ? contextMsgs + "\n" + curUser.nom + ": " + txt : txt;
      botMsg(channel, "⏳ Réflexion en cours...");
      askPerplexity(sysP, fullMsg).then(function(response) {
        // Supprimer le message "Réflexion en cours"
        db.collection("chat").doc(channel).collection("messages").where("text", "==", "⏳ Réflexion en cours...").where("isBot", "==", true).get().then(function(snap) {
          snap.docs.forEach(function(d) { d.ref.delete(); });
        });
        botMsg(channel, response);
      }).catch(function(err) {
        db.collection("chat").doc(channel).collection("messages").where("text", "==", "⏳ Réflexion en cours...").where("isBot", "==", true).get().then(function(snap) {
          snap.docs.forEach(function(d) { d.ref.delete(); });
        });
        botMsg(channel, "❌ Erreur : " + err.message);
      });
    }
  };

  var deleteMsg = function (msgId) {
    db.collection("chat").doc(channel).collection("messages").doc(msgId).delete();
  };

  var formatTime = function (d) {
    if (!d) return "";
    var dt = new Date(d);
    var now = new Date();
    var isToday = dt.toDateString() === now.toDateString();
    if (isToday) return dt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
    return dt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit"
    }) + " " + dt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  var getColor = function (role) {
    if (role === "bot") return "#F59E0B";
    var r = ROLES.find(function (x) {
      return x.id === role;
    });
    return r ? r.c : "#94A3B8";
  };

  return (
    <div style={{ animation: "fi .3s", display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>💬 Chat équipe</h1>
        <div style={{ fontSize: 10, color: "#64748B" }}>
          {users.filter(function (u) { return u.actif; }).length} membres actifs
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {channels.map(function (ch) {
          var isActive = channel === ch.id;
          return (
            <div key={ch.id} onClick={function () { setChannel(ch.id); }}
              style={{
                padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 11,
                fontWeight: isActive ? 700 : 400,
                background: isActive ? ch.color + "20" : "#1E293B",
                color: isActive ? ch.color : "#94A3B8",
                border: "1px solid " + (isActive ? ch.color + "40" : "#334155")
              }}>
              {ch.label}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "auto", ...S.c, padding: "14px", marginBottom: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#64748B", fontSize: 12 }}>
            Aucun message dans ce canal. Lancez la conversation !
          </div>
        )}
        {messages.map(function (m, i) {
          var isMe = m.userId === curUser.id;
          var isBot = m.isBot || m.userId === "bot";
          var showName = i === 0 || messages[i - 1].userId !== m.userId;
          return (
            <div key={m.id} style={{ marginBottom: showName ? 10 : 3 }}>
              {showName && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: isBot ? "rgba(245,158,11,0.2)" : getColor(m.userRole) + "25",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: isBot ? 12 : 10, fontWeight: 700, color: getColor(m.userRole)
                  }}>
                    {isBot ? "🤖" : (m.userName || "?").charAt(0)}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: getColor(m.userRole) }}>{m.userName}</span>
                  {isBot && (
                    <span style={{
                      fontSize: 7, background: "rgba(245,158,11,0.15)", color: "#F59E0B",
                      padding: "1px 5px", borderRadius: 3, fontWeight: 700
                    }}>BOT</span>
                  )}
                  <span style={{ fontSize: 8, color: "#64748B" }}>{formatTime(m.date)}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 27 }}>
                <div style={{
                  maxWidth: "75%",
                  background: isBot ? "rgba(245,158,11,0.06)" : isMe ? "rgba(245,158,11,0.1)" : "#0F172A",
                  border: "1px solid " + (isBot ? "rgba(245,158,11,0.15)" : isMe ? "rgba(245,158,11,0.2)" : "#334155"),
                  borderRadius: isMe ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  padding: "8px 12px", fontSize: isBot ? 11 : 12,
                  lineHeight: 1.4, wordBreak: "break-word",
                  fontStyle: isBot ? "italic" : "normal"
                }}>
                  {m.text}
                </div>
                {!showName && (
                  <span style={{ fontSize: 8, color: "#475569" }}>{formatTime(m.date)}</span>
                )}
                {(isMe || curUser.role === "admin") && !isBot && (
                  <span onClick={function () { deleteMsg(m.id); }}
                    style={{ fontSize: 9, color: "#64748B", cursor: "pointer", opacity: 0.5 }}>✕</span>
                )}
                {curUser.role === "admin" && isBot && (
                  <span onClick={function () { deleteMsg(m.id); }}
                    style={{ fontSize: 9, color: "#64748B", cursor: "pointer", opacity: 0.5 }}>✕</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newMsg}
          onChange={function (e) { setNewMsg(e.target.value); }}
          onKeyDown={function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMsg();
            }
          }}
          placeholder={"Message dans #" + channel + "…"}
          style={{ ...S.i, flex: 1, padding: "12px 16px", fontSize: 13, borderRadius: 12 }}
        />
        <button onClick={sendMsg} disabled={!newMsg.trim()}
          style={{
            padding: "12px 20px",
            background: newMsg.trim() ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#334155",
            border: "none", borderRadius: 12,
            color: newMsg.trim() ? "#0F172A" : "#64748B",
            fontWeight: 700, fontSize: 13,
            cursor: newMsg.trim() ? "pointer" : "default"
          }}>
          Envoyer
        </button>
      </div>
    </div>
  );
}

export default ChatPage;
