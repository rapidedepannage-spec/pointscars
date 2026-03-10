import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { ROLES } from '../config/constants';
import { S } from '../styles/theme';
import { uid, fmt, fd } from '../utils/helpers';

function ParamPage({ users, setUsers, curUser }) {
  const isAdmin = curUser.role === "admin";
  const [showAdd, setShowAdd] = useState(false);
  const [nf, setNf] = useState({
    nom: "",
    login: "",
    pwd: "",
    email: "",
    role: "reception",
    actif: true
  });
  const [myPwd, setMyPwd] = useState({
    old: "",
    n1: "",
    n2: ""
  });
  const [msg, setMsg] = useState(null);
  const rl = ROLES.find(r => r.id === curUser.role) || ROLES[0];

  // Suivi temps — admin only
  const [timeData, setTimeData] = useState([]);
  const [timeDate, setTimeDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeWeek, setTimeWeek] = useState(false);

  useEffect(function () {
    if (!isAdmin) return;
    if (timeWeek) {
      // Charger 7 jours
      var dates = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }
      var unsub = db.collection("timetrack").where("date", "in", dates).onSnapshot(function (snap) {
        setTimeData(snap.docs.map(function (d) {
          return {
            id: d.id,
            ...d.data()
          };
        }));
      });
      return function () {
        unsub();
      };
    } else {
      var unsub = db.collection("timetrack").where("date", "==", timeDate).onSnapshot(function (snap) {
        setTimeData(snap.docs.map(function (d) {
          return {
            id: d.id,
            ...d.data()
          };
        }));
      });
      return function () {
        unsub();
      };
    }
  }, [isAdmin, timeDate, timeWeek]);

  const addUser = () => {
    if (!nf.nom || !nf.login || !nf.pwd) return alert("Remplissez tous les champs");
    if (users.find(u => u.login === nf.login)) return alert("Login déjà pris");
    const nu = {
      ...nf,
      id: uid()
    };
    db.collection("users").doc(nu.id).set(nu);
    setNf({
      nom: "",
      login: "",
      pwd: "",
      email: "",
      role: "reception",
      actif: true
    });
    setShowAdd(false);
  };

  const updateUser = (id, u) => db.collection("users").doc(id).update(u);

  const deleteUser = id => {
    if (id === curUser.id) return alert("Impossible");
    if (confirm("Supprimer?")) db.collection("users").doc(id).delete();
  };

  const changePwd = () => {
    if (myPwd.old !== curUser.pwd) {
      setMsg({
        ok: false,
        m: "Ancien MDP incorrect"
      });
      return;
    }
    if (myPwd.n1.length < 3) {
      setMsg({
        ok: false,
        m: "Min 3 caractères"
      });
      return;
    }
    if (myPwd.n1 !== myPwd.n2) {
      setMsg({
        ok: false,
        m: "MDP ne correspondent pas"
      });
      return;
    }
    db.collection("users").doc(curUser.id).update({
      pwd: myPwd.n1
    });
    try {
      var s = JSON.parse(localStorage.getItem("psg_session") || "{}");
      s.pwd = myPwd.n1;
      localStorage.setItem("psg_session", JSON.stringify(s));
    } catch (e) {}
    setMsg({
      ok: true,
      m: "✓ Mot de passe modifié — reconnectez-vous"
    });
    setMyPwd({
      old: "",
      n1: "",
      n2: ""
    });
  };

  return (
    <div style={{ animation: "fi .3s" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Paramètres</h1>

      <div style={{ ...S.c, padding: "18px", marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>👤 Mon compte</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ background: "#0F172A", borderRadius: 7, padding: "9px" }}>
            <div style={{ fontSize: 9, color: "#94A3B8" }}>NOM</div>
            <div style={{ fontWeight: 600 }}>{curUser.nom}</div>
          </div>
          <div style={{ background: "#0F172A", borderRadius: 7, padding: "9px" }}>
            <div style={{ fontSize: 9, color: "#94A3B8" }}>LOGIN</div>
            <div style={{ fontWeight: 600, fontFamily: "monospace" }}>{curUser.login}</div>
          </div>
          <div style={{ background: "#0F172A", borderRadius: 7, padding: "9px" }}>
            <div style={{ fontSize: 9, color: "#94A3B8" }}>RÔLE</div>
            <div style={{ fontWeight: 600, color: rl.c }}>{rl.l}</div>
          </div>
        </div>

        <h4 style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8 }}>🔒 Changer mot de passe</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 7, alignItems: "end" }}>
          <div>
            <label style={S.l}>Ancien</label>
            <input
              type="password"
              style={S.i}
              value={myPwd.old}
              onChange={e => setMyPwd({ ...myPwd, old: e.target.value })}
            />
          </div>
          <div>
            <label style={S.l}>Nouveau</label>
            <input
              type="password"
              style={S.i}
              value={myPwd.n1}
              onChange={e => setMyPwd({ ...myPwd, n1: e.target.value })}
            />
          </div>
          <div>
            <label style={S.l}>Confirmer</label>
            <input
              type="password"
              style={S.i}
              value={myPwd.n2}
              onChange={e => setMyPwd({ ...myPwd, n2: e.target.value })}
            />
          </div>
          <button onClick={changePwd} style={S.b}>OK</button>
        </div>

        {msg && (
          <div style={{
            marginTop: 7,
            padding: "6px 10px",
            borderRadius: 5,
            fontSize: 11,
            background: msg.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            color: msg.ok ? "#10B981" : "#FCA5A5"
          }}>
            {msg.m}
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ ...S.c, padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>👥 Utilisateurs ({users.length})</h3>
            <button onClick={() => setShowAdd(!showAdd)} style={S.b}>
              {showAdd ? "✕" : "+ Ajouter"}
            </button>
          </div>

          {showAdd && (
            <div style={{
              background: "#0F172A",
              borderRadius: 9,
              padding: "14px",
              marginBottom: 12,
              border: "1px solid #334155"
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={S.l}>Nom</label>
                  <input
                    style={S.i}
                    value={nf.nom}
                    onChange={e => setNf({ ...nf, nom: e.target.value })}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <label style={S.l}>Login</label>
                  <input
                    style={S.i}
                    value={nf.login}
                    onChange={e => setNf({ ...nf, login: e.target.value.toLowerCase().replace(/\s/g, "") })}
                    placeholder="jdupont"
                  />
                </div>
                <div>
                  <label style={S.l}>Mot de passe</label>
                  <input
                    type="password"
                    style={S.i}
                    value={nf.pwd}
                    onChange={e => setNf({ ...nf, pwd: e.target.value })}
                  />
                </div>
                <div>
                  <label style={S.l}>Rôle</label>
                  <select
                    style={S.i}
                    value={nf.role}
                    onChange={e => setNf({ ...nf, role: e.target.value })}
                  >
                    {ROLES.map(r => (
                      <option key={r.id} value={r.id}>{r.l}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ ...S.l, color: "#06B6D4" }}>📧 Email (pour réinitialisation MDP)</label>
                  <input
                    type="email"
                    style={S.i}
                    value={nf.email}
                    onChange={e => setNf({ ...nf, email: e.target.value })}
                    placeholder="prenom@email.com (optionnel)"
                  />
                </div>
              </div>
              <div style={{ textAlign: "right", marginTop: 9 }}>
                <button onClick={addUser} style={S.b}>✓ Créer</button>
              </div>
            </div>
          )}

          {users.map(u => {
            const url2 = ROLES.find(r => r.id === u.role) || ROLES[0];
            const isMe = u.id === curUser.id;
            return (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 13px",
                  marginBottom: 5,
                  background: isMe ? "rgba(245,158,11,0.04)" : "#0F172A",
                  borderRadius: 8,
                  border: isMe ? "1px solid rgba(245,158,11,0.15)" : "1px solid #334155"
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: url2.c + "20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: url2.c,
                  flexShrink: 0
                }}>
                  {u.nom.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{u.nom}</span>
                    {isMe && (
                      <span style={{
                        fontSize: 8,
                        color: "#F59E0B",
                        background: "rgba(245,158,11,0.1)",
                        padding: "1px 5px",
                        borderRadius: 3
                      }}>
                        VOUS
                      </span>
                    )}
                    {!u.actif && (
                      <span style={{
                        fontSize: 8,
                        color: "#EF4444",
                        background: "rgba(239,68,68,0.1)",
                        padding: "1px 5px",
                        borderRadius: 3
                      }}>
                        INACTIF
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>
                    {u.login} — <span style={{ color: url2.c }}>{url2.l}</span>
                    {u.email ? (
                      <span style={{ marginLeft: 5, color: "#06B6D4", fontSize: 9 }}>📧 {u.email}</span>
                    ) : (
                      <span style={{ marginLeft: 5, color: "#64748B", fontSize: 9 }}>pas d'email</span>
                    )}
                  </div>
                  {u.message && (
                    <div style={{ fontSize: 9, color: "#FCD34D", marginTop: 1 }}>💬 "{u.message}"</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => updateUser(u.id, { actif: !u.actif })}
                    style={{
                      padding: "4px 8px",
                      background: u.actif ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                      border: "none",
                      borderRadius: 5,
                      color: u.actif ? "#FCA5A5" : "#6EE7B7",
                      fontSize: 9,
                      cursor: "pointer"
                    }}
                  >
                    {u.actif ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    onClick={function () {
                      var em = prompt("Email de " + u.nom + ":", u.email || "");
                      if (em !== null) updateUser(u.id, { email: em.trim() });
                    }}
                    style={{
                      padding: "4px 8px",
                      background: "rgba(6,182,212,0.1)",
                      border: "none",
                      borderRadius: 5,
                      color: "#67E8F9",
                      fontSize: 9,
                      cursor: "pointer"
                    }}
                  >
                    📧
                  </button>
                  <button
                    onClick={function () {
                      var msg = prompt("💬 Message pour " + u.nom + " :\n(il le verra à la connexion)", u.message || "");
                      if (msg !== null) updateUser(u.id, { message: msg.trim() });
                    }}
                    style={{
                      padding: "4px 8px",
                      background: "rgba(245,158,11,0.1)",
                      border: "none",
                      borderRadius: 5,
                      color: "#FCD34D",
                      fontSize: 9,
                      cursor: "pointer"
                    }}
                  >
                    💬
                  </button>
                  <button
                    onClick={function () {
                      if (confirm("Réinitialiser le mot de passe de " + u.nom + " ?\nNouveau MDP : 0000")) {
                        updateUser(u.id, { pwd: "0000" });
                        setMsg({ ok: true, m: "✓ MDP de " + u.nom + " réinitialisé à 0000" });
                      }
                    }}
                    style={{
                      padding: "4px 8px",
                      background: "rgba(59,130,246,0.1)",
                      border: "none",
                      borderRadius: 5,
                      color: "#93C5FD",
                      fontSize: 9,
                      cursor: "pointer"
                    }}
                  >
                    Reset MDP
                  </button>
                  {!isMe && (
                    <button
                      onClick={() => deleteUser(u.id)}
                      style={{
                        padding: "4px 8px",
                        background: "rgba(239,68,68,0.08)",
                        border: "none",
                        borderRadius: 5,
                        color: "#FCA5A5",
                        fontSize: 9,
                        cursor: "pointer"
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isAdmin && (
        <div style={{ ...S.c, padding: "16px" }}>
          <p style={{ fontSize: 11, color: "#94A3B8" }}>🔒 Gestion utilisateurs réservée aux administrateurs.</p>
        </div>
      )}

      {isAdmin && (
        <div style={{ ...S.c, padding: "18px", marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>⏱ Temps de travail sur l'appli</h3>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div
                onClick={function () { setTimeWeek(false); }}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: timeWeek ? 400 : 700,
                  background: timeWeek ? "transparent" : "rgba(245,158,11,0.1)",
                  color: timeWeek ? "#94A3B8" : "#F59E0B",
                  border: "1px solid " + (timeWeek ? "#334155" : "rgba(245,158,11,0.3)")
                }}
              >
                Jour
              </div>
              <div
                onClick={function () { setTimeWeek(true); }}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: timeWeek ? 700 : 400,
                  background: timeWeek ? "rgba(245,158,11,0.1)" : "transparent",
                  color: timeWeek ? "#F59E0B" : "#94A3B8",
                  border: "1px solid " + (timeWeek ? "rgba(245,158,11,0.3)" : "#334155")
                }}
              >
                Semaine
              </div>
            </div>
          </div>

          {!timeWeek && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
              <button
                onClick={function () {
                  var d = new Date(timeDate);
                  d.setDate(d.getDate() - 1);
                  setTimeDate(d.toISOString().slice(0, 10));
                }}
                style={{ ...S.b, padding: "5px 10px" }}
              >
                ←
              </button>
              <input
                type="date"
                value={timeDate}
                onChange={function (e) { setTimeDate(e.target.value); }}
                style={{ ...S.i, width: 150, textAlign: "center" }}
              />
              <button
                onClick={function () {
                  var d = new Date(timeDate);
                  d.setDate(d.getDate() + 1);
                  setTimeDate(d.toISOString().slice(0, 10));
                }}
                style={{ ...S.b, padding: "5px 10px" }}
              >
                →
              </button>
              <button
                onClick={function () {
                  setTimeDate(new Date().toISOString().slice(0, 10));
                }}
                style={{ ...S.b, padding: "5px 10px", fontSize: 9 }}
              >
                Aujourd'hui
              </button>
            </div>
          )}

          {(function () {
            // Agréger par utilisateur
            var byUser = {};
            timeData.forEach(function (t) {
              if (!byUser[t.userId]) byUser[t.userId] = {
                nom: t.userName,
                role: t.userRole,
                totalMin: 0,
                days: {},
                lastSeen: null,
                logins: []
              };
              byUser[t.userId].totalMin += t.minutes || 0;
              byUser[t.userId].days[t.date] = (byUser[t.userId].days[t.date] || 0) + (t.minutes || 0);
              if (t.lastSeen && (!byUser[t.userId].lastSeen || t.lastSeen > byUser[t.userId].lastSeen)) byUser[t.userId].lastSeen = t.lastSeen;
              if (t.loginAt) byUser[t.userId].logins = byUser[t.userId].logins.concat(t.loginAt);
            });
            var userList = Object.keys(byUser).map(function (uid2) {
              return {
                ...byUser[uid2],
                id: uid2
              };
            });
            userList.sort(function (a, b) {
              return b.totalMin - a.totalMin;
            });
            if (userList.length === 0) return (
              <div style={{ textAlign: "center", padding: 20, color: "#64748B", fontSize: 11 }}>
                Aucune activité {timeWeek ? "cette semaine" : "ce jour"}
              </div>
            );
            return (
              <div>
                {userList.map(function (u) {
                  var h = Math.floor(u.totalMin / 60);
                  var m = u.totalMin % 60;
                  var timeStr = h > 0 ? h + "h" + String(m).padStart(2, "0") : m + "min";
                  var rc = ROLES.find(function (r) {
                    return r.id === u.role;
                  });
                  var col = rc ? rc.c : "#94A3B8";
                  var maxMin = timeWeek ? 2400 : 480;
                  var pct = Math.min(100, Math.round(u.totalMin / maxMin * 100));
                  var isOnline = u.lastSeen && new Date() - new Date(u.lastSeen) < 120000;
                  return (
                    <div
                      key={u.id}
                      style={{
                        marginBottom: 8,
                        background: "#0F172A",
                        borderRadius: 8,
                        padding: "12px",
                        border: "1px solid #334155"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: isOnline ? "#10B981" : "#475569"
                          }} />
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{u.nom}</span>
                          <span style={{ fontSize: 9, color: col }}>{rc ? rc.l : ""}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#F59E0B" }}>{timeStr}</span>
                          {isOnline && (
                            <span style={{
                              fontSize: 8,
                              color: "#10B981",
                              background: "rgba(16,185,129,0.1)",
                              padding: "2px 6px",
                              borderRadius: 4
                            }}>
                              EN LIGNE
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ height: 6, background: "#1E293B", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: pct + "%",
                          background: "linear-gradient(90deg,#F59E0B,#D97706)",
                          borderRadius: 3,
                          transition: "width 0.5s"
                        }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontSize: 8, color: "#64748B" }}>
                          {u.logins.length} connexion{u.logins.length > 1 ? "s" : ""}
                        </span>
                        <span style={{ fontSize: 8, color: "#64748B" }}>
                          {u.lastSeen ? "Vu à " + new Date(u.lastSeen).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit"
                          }) : ""}
                        </span>
                      </div>
                      {timeWeek && Object.keys(u.days).length > 1 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                          {Object.keys(u.days).sort().map(function (day) {
                            var dm = u.days[day];
                            var dh = Math.floor(dm / 60);
                            var dmm = dm % 60;
                            return (
                              <span
                                key={day}
                                style={{
                                  fontSize: 8,
                                  background: "#1E293B",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  color: "#94A3B8"
                                }}
                              >
                                {day.slice(5)}: {dh > 0 ? dh + "h" + String(dmm).padStart(2, "0") : dmm + "min"}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default ParamPage;
