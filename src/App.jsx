import React, { useState, useEffect, useRef, useCallback } from 'react';
import { STATUTS, ASSUREURS, MASTER_CODE, LOGO, DEFAULT_USERS } from './config/constants';
import { S } from './styles/theme';
import { db } from './firebase';
import emailjs from '@emailjs/browser';
import MainApp from './components/MainApp';
import Badge from './components/Badge';

function App() {
  const [loading, setLoading] = useState(true);
  const [users, setUsersState] = useState([]);
  const [curUser, setCurUser] = useState(() => {
    try {
      const u = localStorage.getItem("psg_session");
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  });
  const [loginErr, setLoginErr] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetF, setResetF] = useState({
    login: "",
    code: "",
    newPwd: "",
    newPwd2: ""
  });
  const [resetMsg, setResetMsg] = useState("");
  const [resetCode, setResetCode] = useState(null);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetSending, setResetSending] = useState(false);
  const [loginF, setLoginF] = useState({
    login: "",
    pwd: ""
  });

  /* === FIREBASE: charger users === */
  useEffect(() => {
    const unsub = db.collection("users").onSnapshot(snap => {
      const u = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      if (u.length === 0) {
        DEFAULT_USERS.forEach(usr => db.collection("users").doc(usr.id).set(usr));
      } else {
        setUsersState(u);
      }
      setLoading(false);
    }, err => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      if (curUser) localStorage.setItem("psg_session", JSON.stringify(curUser));
      else localStorage.removeItem("psg_session");
    } catch (e) {}
  }, [curUser]);

  useEffect(() => {
    if (curUser && users.length) {
      const fresh = users.find(u => u.id === curUser.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(curUser)) setCurUser(fresh);
    }
  }, [users]);

  const setUsers = fn => {
    const newUsers = typeof fn === "function" ? fn(users) : fn;
    newUsers.forEach(u => db.collection("users").doc(u.id).set(u));
    users.forEach(old => {
      if (!newUsers.find(n => n.id === old.id)) db.collection("users").doc(old.id).delete();
    });
  };

  const doLogin = () => {
    const lg = loginF.login.trim().toLowerCase();
    const pw = loginF.pwd.trim();
    const u = users.find(x => x.login.toLowerCase() === lg && x.pwd === pw && x.actif);
    if (u) {
      var sid = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem("psg_sid", sid); } catch(e) {}
      db.collection("users").doc(u.id).update({ sessionId: sid }).catch(function(){});
      setCurUser(u);
      setLoginErr("");
    } else setLoginErr("Identifiant ou mot de passe incorrect");
  };

  const doLogout = () => {
    if (curUser && curUser.id) {
      db.collection("users").doc(curUser.id).update({ sessionId: "" }).catch(function(){});
    }
    try { localStorage.removeItem("psg_sid"); } catch(e) {}
    setCurUser(null);
  };

  // Étape 1: envoyer code par email
  const sendResetCode = async () => {
    setResetMsg("");
    if (!resetF.login.trim()) return setResetMsg("Entrez votre identifiant");
    var u = users.find(function (x) {
      return x.login.toLowerCase() === resetF.login.trim().toLowerCase();
    });
    if (!u) return setResetMsg("Identifiant introuvable");
    if (!u.email) return setResetMsg("Aucun email sur ce compte. Utilisez le code maître ci-dessous.");
    var code = String(Math.floor(100000 + Math.random() * 900000));
    setResetCode(code);
    setResetUserId(u.id);
    setResetSending(true);
    try {
      await emailjs.send("service_zd2qmzh", "template_et7jwlo", {
        to_name: u.nom,
        to_email: u.email,
        code: code
      });
      setResetStep(2);
      setResetMsg("✅ Code envoyé à " + u.email.replace(/(.{2}).*(@.*)/, "$1***$2"));
    } catch (e) {
      setResetMsg("Erreur d'envoi: " + (e.text || e.message || "vérifiez EmailJS"));
    }
    setResetSending(false);
  };

  // Étape 2: valider code + nouveau mdp
  const doReset = () => {
    setResetMsg("");
    if (resetF.code !== resetCode && resetF.code !== MASTER_CODE) return setResetMsg("Code incorrect");
    if (!resetF.newPwd || resetF.newPwd.length < 3) return setResetMsg("Mot de passe trop court (min 3 car.)");
    if (resetF.newPwd !== resetF.newPwd2) return setResetMsg("Les mots de passe ne correspondent pas");
    var targetId = resetUserId;
    if (!targetId) {
      var u = users.find(function (x) {
        return x.login.toLowerCase() === resetF.login.trim().toLowerCase();
      });
      if (!u) return setResetMsg("Identifiant introuvable");
      targetId = u.id;
    }
    db.collection("users").doc(targetId).update({
      pwd: resetF.newPwd
    });
    setResetMsg("✅ Mot de passe modifié ! Vous pouvez vous connecter.");
    setResetF({
      login: "",
      code: "",
      newPwd: "",
      newPwd2: ""
    });
    setResetCode(null);
    setResetUserId(null);
    setTimeout(function () {
      setShowReset(false);
      setResetMsg("");
      setResetStep(1);
    }, 2000);
  };

  // Raccourci code maître (sans email)
  const useCodeMaitre = () => {
    setResetMsg("");
    if (!resetF.login.trim()) return setResetMsg("Entrez votre identifiant");
    var u = users.find(function (x) {
      return x.login.toLowerCase() === resetF.login.trim().toLowerCase();
    });
    if (!u) return setResetMsg("Identifiant introuvable");
    setResetUserId(u.id);
    setResetStep(2);
    setResetMsg("Entrez le code maître + nouveau mot de passe");
  };

  /* === LOADING === */
  if (loading) return (
    <div
      style={{
        background: "#0F172A",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 14
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          border: "4px solid #334155",
          borderTop: "4px solid #F59E0B",
          borderRadius: "50%",
          animation: "sp 1s linear infinite"
        }}
      />
      <div style={{ color: "#94A3B8", fontSize: 13 }}>
        Connexion à la base de données…
      </div>
    </div>
  );

  /* === LOGIN === */
  if (!curUser) return (
    <div
      style={{
        background: "#0F172A",
        color: "#E2E8F0",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          background: "#1E293B",
          borderRadius: 16,
          padding: "36px",
          width: "100%",
          maxWidth: 380,
          border: "1px solid #334155",
          animation: "fi .4s"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src={LOGO}
            alt="Point S"
            style={{ height: 50, marginBottom: 10 }}
          />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Point S Guignes</h1>
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>
            Gestion Sinistres
          </p>
          <div
            style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(16,185,129,0.08)",
              padding: "3px 10px",
              borderRadius: 12,
              border: "1px solid rgba(16,185,129,0.2)"
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: "#10B981"
              }}
            />
            <span style={{ fontSize: 9, color: "#10B981", fontWeight: 600 }}>
              En ligne — Base partagée
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={S.l}>Identifiant</label>
          <input
            style={S.i}
            value={loginF.login}
            onChange={e => setLoginF({ ...loginF, login: e.target.value })}
            placeholder="admin"
            onKeyDown={e => e.key === "Enter" && doLogin()}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={S.l}>Mot de passe</label>
          <input
            type="password"
            style={S.i}
            value={loginF.pwd}
            onChange={e => setLoginF({ ...loginF, pwd: e.target.value })}
            placeholder="admin"
            onKeyDown={e => e.key === "Enter" && doLogin()}
          />
        </div>

        {loginErr && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 7,
              padding: "9px 12px",
              color: "#FCA5A5",
              fontSize: 11,
              marginBottom: 14,
              textAlign: "center"
            }}
          >
            {loginErr}
          </div>
        )}

        <button
          onClick={doLogin}
          style={{ ...S.b, width: "100%", padding: "11px" }}
        >
          Se connecter
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span
            onClick={function () {
              setShowReset(!showReset);
              setResetMsg("");
              setResetStep(1);
              setResetF({
                login: "",
                code: "",
                newPwd: "",
                newPwd2: ""
              });
            }}
            style={{
              fontSize: 10,
              color: "#F59E0B",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            🔑 Mot de passe oublié ?
          </span>
        </div>

        {showReset && (
          <div
            style={{
              marginTop: 14,
              background: "#0F172A",
              borderRadius: 10,
              padding: "16px",
              border: "1px solid #334155",
              animation: "fi .2s"
            }}
          >
            <h4
              style={{
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 10,
                color: "#F59E0B"
              }}
            >
              Réinitialiser le mot de passe
            </h4>

            {resetStep === 1 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <label style={S.l}>Identifiant</label>
                  <input
                    style={S.i}
                    value={resetF.login}
                    onChange={function (e) {
                      setResetF({ ...resetF, login: e.target.value });
                    }}
                    placeholder="Votre login"
                  />
                </div>

                {resetMsg && (
                  <div
                    style={{
                      background: resetMsg.includes("✅") ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                      border: "1px solid " + (resetMsg.includes("✅") ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"),
                      borderRadius: 7,
                      padding: "8px 12px",
                      color: resetMsg.includes("✅") ? "#10B981" : "#FCA5A5",
                      fontSize: 11,
                      marginBottom: 10,
                      textAlign: "center"
                    }}
                  >
                    {resetMsg}
                  </div>
                )}

                <button
                  onClick={sendResetCode}
                  disabled={resetSending}
                  style={{
                    ...S.b,
                    width: "100%",
                    padding: "10px",
                    background: "linear-gradient(135deg,#F59E0B,#D97706)",
                    color: "#0F172A"
                  }}
                >
                  {resetSending ? "Envoi en cours…" : "📧 Recevoir un code par email"}
                </button>

                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <span
                    onClick={useCodeMaitre}
                    style={{
                      fontSize: 9,
                      color: "#94A3B8",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    Pas d'email ? Utiliser le code maître
                  </span>
                </div>
              </div>
            )}

            {resetStep === 2 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <label style={S.l}>Identifiant</label>
                  <input
                    style={S.i}
                    value={resetF.login}
                    disabled={true}
                  />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={S.l}>Code reçu par email (ou code maître)</label>
                  <input
                    style={S.i}
                    value={resetF.code}
                    onChange={function (e) {
                      setResetF({ ...resetF, code: e.target.value });
                    }}
                    placeholder="6 chiffres ou code maître"
                    autoFocus={true}
                  />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={S.l}>Nouveau mot de passe</label>
                  <input
                    type="password"
                    style={S.i}
                    value={resetF.newPwd}
                    onChange={function (e) {
                      setResetF({ ...resetF, newPwd: e.target.value });
                    }}
                    placeholder="Nouveau mot de passe"
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={S.l}>Confirmer</label>
                  <input
                    type="password"
                    style={S.i}
                    value={resetF.newPwd2}
                    onChange={function (e) {
                      setResetF({ ...resetF, newPwd2: e.target.value });
                    }}
                    placeholder="Retapez le mot de passe"
                    onKeyDown={function (e) {
                      if (e.key === "Enter") doReset();
                    }}
                  />
                </div>

                {resetMsg && (
                  <div
                    style={{
                      background: resetMsg.includes("✅") ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                      border: "1px solid " + (resetMsg.includes("✅") ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"),
                      borderRadius: 7,
                      padding: "8px 12px",
                      color: resetMsg.includes("✅") ? "#10B981" : "#FCA5A5",
                      fontSize: 11,
                      marginBottom: 10,
                      textAlign: "center"
                    }}
                  >
                    {resetMsg}
                  </div>
                )}

                <button
                  onClick={doReset}
                  style={{
                    ...S.b,
                    width: "100%",
                    padding: "10px",
                    background: "linear-gradient(135deg,#F59E0B,#D97706)",
                    color: "#0F172A"
                  }}
                >
                  Réinitialiser
                </button>

                <div style={{ textAlign: "center", marginTop: 6 }}>
                  <span
                    onClick={function () {
                      setResetStep(1);
                      setResetMsg("");
                    }}
                    style={{
                      fontSize: 9,
                      color: "#94A3B8",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    ← Retour
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 9, color: "#475569", textAlign: "center", marginTop: 14 }}>
          Premier accès: {" "}
          <strong style={{ color: "#94A3B8" }}>admin</strong>
          {" "}/{" "}
          <strong style={{ color: "#94A3B8" }}>admin</strong>
        </p>
      </div>
    </div>
  );

  return (
    <MainApp
      curUser={curUser}
      users={users}
      setUsers={setUsers}
      doLogout={doLogout}
    />
  );
}

export default App;
