import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { S } from '../styles/theme'
import { askPerplexity } from '../utils/api'
import { fmt, fd } from '../utils/helpers'
import { botMsg } from '../utils/bot'
import { ROLES } from '../config/constants'

function TodoPage({ curUser, users }) {
  var isAdmin = curUser.role === "admin";
  var [todos, setTodos] = useState([]);
  var [viewUser, setViewUser] = useState(curUser.id);
  var [newTask, setNewTask] = useState("");
  var [newDate, setNewDate] = useState("");
  var [newTime, setNewTime] = useState("");
  var [newPrio, setNewPrio] = useState("normal");
  var [showDone, setShowDone] = useState(false);
  var [addFor, setAddFor] = useState("");
  var prenom = curUser.nom.split(" ")[0];
  var TODO_PHRASES = [
    ["🎯", "Chaque tâche cochée te rapproche du succès, " + prenom + " !"],
    ["🔥", "On lâche rien " + prenom + " ! Une tâche à la fois, tu vas tout déchirer."],
    ["💪", "Hey " + prenom + ", montre à cette liste qui est le patron !"],
    ["⚡", "Plus tu avances, plus tu deviens fort. Go " + prenom + " !"],
    ["🚀", "Prêt à conquérir ta journée " + prenom + " ? Let's go !"],
    ["🏆", "Chaque case cochée, c'est une petite victoire. Cumule-les " + prenom + " !"],
    ["☕", "Un bon café + une bonne liste = une journée productive. À toi " + prenom + " !"],
    ["🌟", "Les grands accomplissements commencent par de petites tâches. Force " + prenom + " !"],
    ["👊", "" + prenom + ", ta to-do list n'a aucune chance face à toi !"],
    ["🎉", "Allez " + prenom + ", imagine la satisfaction quand tout sera coché !"],
    ["🧠", "Organiser, c'est déjà avancer. T'es sur la bonne voie " + prenom + " !"],
    ["🦁", "Attaque cette liste comme un lion " + prenom + " ! Rien ne t'arrête."],
    ["💎", "La discipline d'aujourd'hui, c'est la liberté de demain. Go " + prenom + " !"],
    ["🌈", "Même les journées chargées finissent. Courage " + prenom + " !"],
    ["🏅", "Un pro, c'est quelqu'un qui fait ce qu'il faut, même quand c'est dur. Respect " + prenom + " !"]
  ];
  var [todoPhrase] = useState(function () {
    return TODO_PHRASES[Math.floor(Math.random() * TODO_PHRASES.length)];
  });
  var emojis = ["🎯", "⚡", "🔧", "📞", "📋", "🚗", "💼", "📦", "🔍", "✏️", "📐", "🛠", "💡", "📊", "🏁"];
  var prioConfig = {
    urgent: {
      label: "🔴 Urgent",
      color: "#EF4444",
      bg: "rgba(239,68,68,0.08)"
    },
    normal: {
      label: "🟡 Normal",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.06)"
    },
    cool: {
      label: "🟢 Tranquille",
      color: "#10B981",
      bg: "rgba(16,185,129,0.06)"
    }
  };

  // Charger tâches
  var [assigned, setAssigned] = useState([]);
  useEffect(function () {
    var unsub = db.collection("todos").where("userId", "==", viewUser).onSnapshot(function (snap) {
      var list = snap.docs.map(function (d) {
        return { id: d.id, ...d.data() };
      });
      list.sort(function (a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        var pa = { urgent: 0, normal: 1, cool: 2 };
        if ((pa[a.prio] || 1) !== (pa[b.prio] || 1)) return (pa[a.prio] || 1) - (pa[b.prio] || 1);
        return (a.date || "9999").localeCompare(b.date || "9999");
      });
      setTodos(list);
    });
    return function () {
      unsub();
    };
  }, [viewUser]);

  // Charger tâches assignées par l'admin à d'autres
  useEffect(function () {
    if (!isAdmin || viewUser !== curUser.id) {
      setAssigned([]);
      return;
    }
    var unsub = db.collection("todos").where("createdById", "==", curUser.id).orderBy("date", "asc").onSnapshot(function (snap) {
      var all = snap.docs.map(function (d) {
        return { id: d.id, ...d.data() };
      });
      setAssigned(all.filter(function (t) {
        return t.userId !== curUser.id;
      }));
    });
    return function () {
      unsub();
    };
  }, [viewUser, curUser.id]);

  var pending = todos.filter(function (t) {
    return !t.done;
  });
  var done = todos.filter(function (t) {
    return t.done;
  });
  var progress = todos.length > 0 ? Math.round(done.length / todos.length * 100) : 0;

  // Ajouter tâche
  var addTask = function (targetUserId) {
    if (!newTask.trim()) return;
    var emoji = emojis[Math.floor(Math.random() * emojis.length)];
    db.collection("todos").add({
      userId: targetUserId || viewUser,
      text: newTask.trim(),
      emoji: emoji,
      prio: newPrio,
      date: newDate || null,
      time: newTime || null,
      done: false,
      createdAt: new Date().toISOString(),
      createdBy: curUser.nom,
      createdById: curUser.id
    });
    if (targetUserId && targetUserId !== curUser.id) {
      var u = users.find(function (x) {
        return x.id === targetUserId;
      });
      botMsg("general", "📝 " + curUser.nom + " a assigné une tâche à " + (u ? u.nom : "?") + ' : "' + newTask.trim() + '"');
    }
    setNewTask("");
    setNewDate("");
    setNewTime("");
    setNewPrio("normal");
    setAddFor("");
  };

  // Toggle done
  var toggleDone = function (t) {
    db.collection("todos").doc(t.id).update({
      done: !t.done,
      doneAt: !t.done ? new Date().toISOString() : null
    });
    if (!t.done) {
      var cheers = ["🎉 Bravo !", "💪 Bien joué !", "✨ Nickel !", "🏆 Champion !", "🔥 En feu !", "👏 Super !"];
      var cheer = cheers[Math.floor(Math.random() * cheers.length)];
      // Mini animation dans le state
    }
  };

  // Supprimer
  var delTask = function (id) {
    db.collection("todos").doc(id).delete();
  };

  // Vérif retard
  var isLate = function (t) {
    if (!t.date || t.done) return false;
    var d = new Date(t.date + (t.time ? "T" + t.time : "T23:59"));
    return d < new Date();
  };

  var formatDeadline = function (t) {
    if (!t.date) return null;
    var d = new Date(t.date);
    var now = new Date();
    var diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    var str = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    if (t.time) str += " " + t.time;
    if (diff === 0) return { text: "Aujourd'hui" + (t.time ? " " + t.time : ""), color: "#F59E0B" };
    if (diff === 1) return { text: "Demain" + (t.time ? " " + t.time : ""), color: "#3B82F6" };
    if (diff < 0) return { text: str + " (" + Math.abs(diff) + "j de retard)", color: "#EF4444" };
    return { text: str, color: "#94A3B8" };
  };

  var activeUsers = users.filter(function (u) {
    return u.actif;
  });

  return (
    <div style={{ animation: "fi .3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>
            📝 {isAdmin && viewUser !== curUser.id
              ? "Tâches de " + ((users.find(function (u) { return u.id === viewUser; }) || {}).nom || "")
              : "Mes tâches"}
          </h1>
          {todos.length > 0 && (
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
              {done.length}/{todos.length} terminées — {progress}% 🎯
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(135deg,rgba(245,158,11,0.08),rgba(139,92,246,0.06))",
          border: "1px solid rgba(245,158,11,0.15)",
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
          animation: "fi .5s"
        }}
      >
        <span style={{ fontSize: 22 }}>{todoPhrase[0]}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#E2E8F0", fontStyle: "italic" }}>{todoPhrase[1]}</span>
      </div>

      {isAdmin && (
        <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
          {activeUsers.map(function (u) {
            var isActive = viewUser === u.id;
            var rc = ROLES.find(function (r) { return r.id === u.role; });
            var col = rc ? rc.c : "#94A3B8";
            return (
              <div
                key={u.id}
                onClick={function () { setViewUser(u.id); }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 16,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                  background: isActive ? col + "20" : "#1E293B",
                  color: isActive ? col : "#94A3B8",
                  border: "1px solid " + (isActive ? col + "40" : "#334155"),
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                {u.id === curUser.id ? "🏠 " : ""}{u.nom.split(" ")[0]}
              </div>
            );
          })}
        </div>
      )}

      {todos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 10, background: "#1E293B", borderRadius: 5, overflow: "hidden", border: "1px solid #334155" }}>
            <div
              style={{
                height: "100%",
                width: progress + "%",
                background: progress === 100
                  ? "linear-gradient(90deg,#10B981,#34D399)"
                  : progress > 50
                    ? "linear-gradient(90deg,#F59E0B,#FBBF24)"
                    : "linear-gradient(90deg,#3B82F6,#60A5FA)",
                borderRadius: 5,
                transition: "width 0.5s ease"
              }}
            />
          </div>
          {progress === 100 && (
            <div style={{ textAlign: "center", marginTop: 6, fontSize: 13, fontWeight: 700, color: "#10B981" }}>
              🎉 Toutes les tâches sont terminées ! Bravo ! 🏆
            </div>
          )}
        </div>
      )}

      <div style={{ ...S.c, padding: "14px", marginBottom: 14, border: "1px solid rgba(245,158,11,0.2)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={S.l}>✏️ Nouvelle tâche</label>
            <input
              style={{ ...S.i, padding: "10px 14px", fontSize: 13 }}
              value={newTask}
              onChange={function (e) { setNewTask(e.target.value); }}
              onKeyDown={function (e) {
                if (e.key === "Enter") addTask(isAdmin ? addFor || viewUser : curUser.id);
              }}
              placeholder="Ex: Rappeler client Dupont, Commander pare-choc…"
            />
          </div>
          <div style={{ width: 130 }}>
            <label style={S.l}>📅 Date</label>
            <input
              type="date"
              style={S.i}
              value={newDate}
              onChange={function (e) { setNewDate(e.target.value); }}
            />
          </div>
          <div style={{ width: 90 }}>
            <label style={S.l}>🕐 Heure</label>
            <input
              type="time"
              style={S.i}
              value={newTime}
              onChange={function (e) { setNewTime(e.target.value); }}
            />
          </div>
          <div style={{ width: 120 }}>
            <label style={S.l}>Priorité</label>
            <select
              style={S.i}
              value={newPrio}
              onChange={function (e) { setNewPrio(e.target.value); }}
            >
              <option value="urgent">🔴 Urgent</option>
              <option value="normal">🟡 Normal</option>
              <option value="cool">🟢 Tranquille</option>
            </select>
          </div>
          {isAdmin && (
            <div style={{ width: 130 }}>
              <label style={S.l}>👤 Pour</label>
              <select
                style={S.i}
                value={addFor || viewUser}
                onChange={function (e) { setAddFor(e.target.value); }}
              >
                {activeUsers.map(function (u) {
                  return (
                    <option key={u.id} value={u.id}>
                      {u.id === curUser.id ? "Moi" : u.nom.split(" ")[0]}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          <button
            onClick={function () {
              addTask(isAdmin ? addFor || viewUser : curUser.id);
            }}
            disabled={!newTask.trim()}
            style={{
              padding: "10px 18px",
              background: newTask.trim() ? "linear-gradient(135deg,#F59E0B,#D97706)" : "#334155",
              border: "none",
              borderRadius: 8,
              color: newTask.trim() ? "#0F172A" : "#64748B",
              fontWeight: 700,
              fontSize: 12,
              cursor: newTask.trim() ? "pointer" : "default",
              whiteSpace: "nowrap"
            }}
          >
            + Ajouter
          </button>
        </div>
      </div>

      {pending.length === 0 && done.length === 0 && (
        <div style={{ ...S.c, padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🌟</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Rien à faire pour le moment !</div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>Ajoutez une tâche ci-dessus pour commencer</div>
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {pending.map(function (t) {
            var pc = prioConfig[t.prio || "normal"];
            var late = isLate(t);
            var deadline = formatDeadline(t);
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  marginBottom: 6,
                  background: late ? "rgba(239,68,68,0.05)" : pc.bg,
                  borderRadius: 10,
                  border: "1px solid " + (late ? "rgba(239,68,68,0.25)" : pc.color + "20"),
                  animation: "fi .3s",
                  transition: "all 0.3s"
                }}
              >
                <div
                  onClick={function () { toggleDone(t); }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    border: "2px solid " + pc.color,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s"
                  }}
                />
                <span style={{ fontSize: 18 }}>{t.emoji || "📝"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.text}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
                    {deadline && (
                      <span style={{ fontSize: 9, color: deadline.color, fontWeight: 600 }}>
                        📅 {deadline.text}
                      </span>
                    )}
                    {t.createdById !== viewUser && (
                      <span style={{ fontSize: 9, color: "#A78BFA" }}>
                        assigné par {t.createdBy}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 8,
                      color: pc.color,
                      fontWeight: 700,
                      background: pc.color + "15",
                      padding: "2px 7px",
                      borderRadius: 10
                    }}
                  >
                    {pc.label}
                  </span>
                  {(curUser.role === "admin" || curUser.id === t.userId) && (
                    <span
                      onClick={function () { delTask(t.id); }}
                      style={{ color: "#64748B", cursor: "pointer", fontSize: 10, opacity: 0.5 }}
                    >
                      ✕
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <div
            onClick={function () { setShowDone(!showDone); }}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 8 }}
          >
            <span style={{ fontSize: 10, color: "#10B981", fontWeight: 700 }}>
              ✅ Terminées ({done.length})
            </span>
            <span style={{ fontSize: 10, color: "#64748B" }}>
              {showDone ? "▼" : "▶"}
            </span>
          </div>
          {showDone && done.map(function (t) {
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  marginBottom: 4,
                  background: "rgba(16,185,129,0.04)",
                  borderRadius: 10,
                  border: "1px solid rgba(16,185,129,0.1)",
                  opacity: 0.7
                }}
              >
                <div
                  onClick={function () { toggleDone(t); }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: "rgba(16,185,129,0.2)",
                    border: "2px solid #10B981",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <span style={{ color: "#10B981", fontSize: 14, fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ fontSize: 18 }}>{t.emoji || "📝"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, textDecoration: "line-through", color: "#64748B" }}>
                    {t.text}
                  </div>
                  {t.doneAt && (
                    <div style={{ fontSize: 8, color: "#10B981" }}>
                      Fait le {new Date(t.doneAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  )}
                </div>
                <span
                  onClick={function () { delTask(t.id); }}
                  style={{ color: "#64748B", cursor: "pointer", fontSize: 10, opacity: 0.4 }}
                >
                  ✕
                </span>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && viewUser === curUser.id && assigned.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#A78BFA" }}>
            📤 Tâches que j'ai assignées ({assigned.filter(function (t) { return !t.done; }).length} en cours / {assigned.length} total)
          </h3>
          {assigned.map(function (t) {
            var pc = prioConfig[t.prio || "normal"];
            var dest = users.find(function (u) { return u.id === t.userId; });
            var destName = dest ? dest.nom : "?";
            var rc = ROLES.find(function (r) { return dest && r.id === dest.role; });
            var col = rc ? rc.c : "#94A3B8";
            var deadline = formatDeadline(t);
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  marginBottom: 5,
                  background: t.done ? "rgba(16,185,129,0.04)" : "rgba(139,92,246,0.05)",
                  borderRadius: 10,
                  border: "1px solid " + (t.done ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)"),
                  opacity: t.done ? 0.6 : 1
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: col + "25",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: col,
                    flexShrink: 0
                  }}
                >
                  {destName.charAt(0)}
                </div>
                <span style={{ fontSize: 16 }}>{t.emoji || "📝"}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: t.done ? 500 : 600,
                      fontSize: 12,
                      textDecoration: t.done ? "line-through" : "none",
                      color: t.done ? "#64748B" : "#E2E8F0"
                    }}
                  >
                    {t.text}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 9, color: col, fontWeight: 600 }}>→ {destName}</span>
                    {deadline && (
                      <span style={{ fontSize: 8, color: deadline.color }}>📅 {deadline.text}</span>
                    )}
                    {t.done && t.doneAt && (
                      <span style={{ fontSize: 8, color: "#10B981" }}>
                        ✅ {new Date(t.doneAt).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 8,
                    color: pc.color,
                    fontWeight: 700,
                    background: pc.color + "15",
                    padding: "2px 7px",
                    borderRadius: 10
                  }}
                >
                  {t.done ? "✅ Fait" : pc.label}
                </span>
                <span
                  onClick={function () { delTask(t.id); }}
                  style={{ color: "#64748B", cursor: "pointer", fontSize: 10, opacity: 0.4 }}
                >
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

export default TodoPage;
