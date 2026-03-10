import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { STATUTS, ASSUREURS } from '../config/constants'
import { S } from '../styles/theme'
import { uid, fd, fmt } from '../utils/helpers'

const ALL_ASS = ["MAAF", "MMA", "GMF", "AXA", "Allianz", "Macif", "MAIF", "Groupama", "Matmut", "Generali", "Direct Assurance", "Pacifica", "BPCE", "Covéa", "Axa Courtage", "Thélem Assurances", "Aviva", "Zurich", "GAN", "AGPM", "SMACL", "MACSF", "Ethias", "SwissLife", "Crédit Mutuel", "SMA", "L'Olivier", "Abeille Assurances", "La Parisienne", "Wafa Assurance", "Autre"];

function ContactsPage() {
  const [tab, setTab] = useState("assureurs");
  const [assureurs, setAssureurs] = useState([]);
  const [experts, setExperts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [newExp, setNewExp] = useState({
    nom: "",
    email: "",
    tel: "",
    adresse: ""
  });
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const [search, setSearch] = useState("");

  // Charger contacts Firebase
  useEffect(function () {
    var unsub1 = db.collection("contacts").onSnapshot(function (snap) {
      var all = snap.docs.map(function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      });
      setAssureurs(all.filter(function (c) {
        return c.type === "assureur";
      }));
      setExperts(all.filter(function (c) {
        return c.type === "expert";
      }));
      // Init assureurs si vide
      if (!loaded) {
        var existingAss = all.filter(function (c) {
          return c.type === "assureur";
        });
        if (existingAss.length === 0) {
          ALL_ASS.forEach(function (nom) {
            var id = uid();
            db.collection("contacts").doc(id).set({
              id: id,
              type: "assureur",
              nom: nom,
              email: "",
              tel: "",
              adresse: ""
            });
          });
        }
      }
      setLoaded(true);
    }, function (err) {
      console.error(err);
      setLoaded(true);
    });
    return function () {
      unsub1();
    };
  }, []);

  var updateContact = function (id, data) {
    db.collection("contacts").doc(id).update(data);
  };
  var deleteContact = function (id) {
    if (confirm("Supprimer ce contact?")) db.collection("contacts").doc(id).delete();
  };
  var addExpert = function () {
    if (!newExp.nom) return alert("Nom requis");
    var id = uid();
    db.collection("contacts").doc(id).set({
      id: id,
      type: "expert",
      nom: newExp.nom,
      email: newExp.email,
      tel: newExp.tel,
      adresse: newExp.adresse
    });
    setNewExp({
      nom: "",
      email: "",
      tel: "",
      adresse: ""
    });
    setShowAddExp(false);
  };
  var startEdit = function (c) {
    setEditId(c.id);
    setEditF({
      nom: c.nom || "",
      email: c.email || "",
      tel: c.tel || "",
      adresse: c.adresse || ""
    });
  };
  var saveEdit = function () {
    if (!editF.nom) return;
    updateContact(editId, editF);
    setEditId(null);
  };
  var filteredAss = assureurs.filter(function (a) {
    return !search || a.nom.toLowerCase().includes(search.toLowerCase()) || (a.email || "").toLowerCase().includes(search.toLowerCase());
  });
  var filteredExp = experts.filter(function (e) {
    return !search || e.nom.toLowerCase().includes(search.toLowerCase()) || (e.email || "").toLowerCase().includes(search.toLowerCase());
  });

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{
        width: 30,
        height: 30,
        border: "3px solid #334155",
        borderTop: "3px solid #F59E0B",
        borderRadius: "50%",
        animation: "sp 1s linear infinite"
      }} />
    </div>
  );

  return (
    <div style={{ animation: "fi .3s" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 3 }}>Contacts</h1>
      <p style={{ color: "#94A3B8", fontSize: 11, marginBottom: 16 }}>Assurances et cabinets d'expertise</p>

      <div style={{ display: "flex", gap: 2, marginBottom: 14, borderBottom: "2px solid #334155" }}>
        {[["assureurs", "🏢 Assurances (" + assureurs.length + ")"], ["experts", "🔍 Cabinets d'expertise (" + experts.length + ")"]].map(function (x) {
          return (
            <div
              key={x[0]}
              onClick={function () {
                setTab(x[0]);
                setSearch("");
              }}
              style={{
                padding: "8px 18px",
                cursor: "pointer",
                borderBottom: tab === x[0] ? "2px solid #F59E0B" : "2px solid transparent",
                marginBottom: -2,
                color: tab === x[0] ? "#F59E0B" : "#94A3B8",
                fontWeight: tab === x[0] ? 600 : 400,
                fontSize: 12
              }}
            >
              {x[1]}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          value={search}
          onChange={function (e) { setSearch(e.target.value); }}
          placeholder="🔍 Rechercher…"
          style={{ ...S.i, flex: 1 }}
        />
        {tab === "experts" && (
          <button
            onClick={function () { setShowAddExp(!showAddExp); }}
            style={S.b}
          >
            {showAddExp ? "✕" : "+ Ajouter un cabinet"}
          </button>
        )}
      </div>

      {tab === "experts" && showAddExp && (
        <div style={{ ...S.c, padding: "16px", marginBottom: 14, animation: "fi .2s", border: "1px solid rgba(245,158,11,0.3)" }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>🔍 Nouveau cabinet d'expertise</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={S.l}>Nom du cabinet *</label>
              <input
                style={S.i}
                value={newExp.nom}
                onChange={function (e) { setNewExp({ ...newExp, nom: e.target.value }); }}
                placeholder="Ex: BCA Expertise, Eurexo…"
              />
            </div>
            <div>
              <label style={S.l}>Email</label>
              <input
                type="email"
                style={S.i}
                value={newExp.email}
                onChange={function (e) { setNewExp({ ...newExp, email: e.target.value }); }}
                placeholder="contact@cabinet.fr"
              />
            </div>
            <div>
              <label style={S.l}>Téléphone</label>
              <input
                style={S.i}
                value={newExp.tel}
                onChange={function (e) { setNewExp({ ...newExp, tel: e.target.value }); }}
                placeholder="01 23 45 67 89"
              />
            </div>
            <div>
              <label style={S.l}>Adresse</label>
              <input
                style={S.i}
                value={newExp.adresse}
                onChange={function (e) { setNewExp({ ...newExp, adresse: e.target.value }); }}
                placeholder="Ville…"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={function () { setShowAddExp(false); }} style={S.bg}>Annuler</button>
            <button onClick={addExpert} style={S.b}>✓ Ajouter</button>
          </div>
        </div>
      )}

      {tab === "assureurs" && (
        <div>
          <p style={{ fontSize: 10, color: "#64748B", marginBottom: 10 }}>
            Cliquez sur ✏️ pour ajouter email et téléphone d'un assureur
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {filteredAss.map(function (a) {
              var isEdit = editId === a.id;
              if (isEdit) return (
                <div
                  key={a.id}
                  style={{ ...S.c, padding: "14px", border: "1px solid rgba(245,158,11,0.3)", animation: "fi .2s" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={S.l}>Assureur</label>
                      <input
                        style={S.i}
                        value={editF.nom}
                        onChange={function (e) { setEditF({ ...editF, nom: e.target.value }); }}
                      />
                    </div>
                    <div>
                      <label style={S.l}>Email</label>
                      <input
                        type="email"
                        style={S.i}
                        value={editF.email}
                        onChange={function (e) { setEditF({ ...editF, email: e.target.value }); }}
                        placeholder="sinistres@assureur.fr"
                      />
                    </div>
                    <div>
                      <label style={S.l}>Téléphone</label>
                      <input
                        style={S.i}
                        value={editF.tel}
                        onChange={function (e) { setEditF({ ...editF, tel: e.target.value }); }}
                        placeholder="01 23 45 67 89"
                      />
                    </div>
                    <div>
                      <label style={S.l}>Adresse</label>
                      <input
                        style={S.i}
                        value={editF.adresse}
                        onChange={function (e) { setEditF({ ...editF, adresse: e.target.value }); }}
                        placeholder="Ville…"
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={function () { setEditId(null); }} style={S.bg}>Annuler</button>
                    <button onClick={saveEdit} style={S.b}>✓ Enregistrer</button>
                  </div>
                </div>
              );
              return (
                <div
                  key={a.id}
                  style={{ ...S.c, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: "rgba(59,130,246,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#3B82F6",
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0
                  }}>
                    {a.nom.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.nom}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                      {a.email
                        ? <span style={{ fontSize: 10, color: "#06B6D4" }}>📧 {a.email}</span>
                        : <span style={{ fontSize: 10, color: "#475569" }}>📧 Non renseigné</span>
                      }
                      {a.tel
                        ? <span style={{ fontSize: 10, color: "#94A3B8" }}>📞 {a.tel}</span>
                        : <span style={{ fontSize: 10, color: "#475569" }}>📞 —</span>
                      }
                      {a.adresse ? <span style={{ fontSize: 10, color: "#94A3B8" }}>📍 {a.adresse}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span
                      onClick={function () { startEdit(a); }}
                      style={{ cursor: "pointer", fontSize: 14 }}
                    >
                      ✏️
                    </span>
                    {a.email && (
                      <span
                        onClick={function () {
                          window.open("https://outlook.live.com/mail/0/deeplink/compose?to=" + encodeURIComponent(a.email), "_blank");
                        }}
                        style={{ cursor: "pointer", fontSize: 14 }}
                      >
                        ✉️
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "experts" && (
        <div>
          {!filteredExp.length && !showAddExp && (
            <div style={{ ...S.c, padding: "30px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun cabinet d'expertise</div>
              <p style={{ fontSize: 11, color: "#94A3B8" }}>Cliquez sur "+ Ajouter un cabinet" pour commencer</p>
            </div>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            {filteredExp.map(function (e) {
              var isEdit = editId === e.id;
              if (isEdit) return (
                <div
                  key={e.id}
                  style={{ ...S.c, padding: "14px", border: "1px solid rgba(245,158,11,0.3)", animation: "fi .2s" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={S.l}>Cabinet</label>
                      <input
                        style={S.i}
                        value={editF.nom}
                        onChange={function (ev) { setEditF({ ...editF, nom: ev.target.value }); }}
                      />
                    </div>
                    <div>
                      <label style={S.l}>Email</label>
                      <input
                        type="email"
                        style={S.i}
                        value={editF.email}
                        onChange={function (ev) { setEditF({ ...editF, email: ev.target.value }); }}
                      />
                    </div>
                    <div>
                      <label style={S.l}>Téléphone</label>
                      <input
                        style={S.i}
                        value={editF.tel}
                        onChange={function (ev) { setEditF({ ...editF, tel: ev.target.value }); }}
                      />
                    </div>
                    <div>
                      <label style={S.l}>Adresse</label>
                      <input
                        style={S.i}
                        value={editF.adresse}
                        onChange={function (ev) { setEditF({ ...editF, adresse: ev.target.value }); }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={function () { setEditId(null); }} style={S.bg}>Annuler</button>
                    <button onClick={saveEdit} style={S.b}>✓ Enregistrer</button>
                  </div>
                </div>
              );
              return (
                <div
                  key={e.id}
                  style={{ ...S.c, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    background: "rgba(245,158,11,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#F59E0B",
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0
                  }}>
                    {e.nom.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{e.nom}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                      {e.email
                        ? <span style={{ fontSize: 10, color: "#06B6D4" }}>📧 {e.email}</span>
                        : <span style={{ fontSize: 10, color: "#475569" }}>📧 Non renseigné</span>
                      }
                      {e.tel
                        ? <span style={{ fontSize: 10, color: "#94A3B8" }}>📞 {e.tel}</span>
                        : <span style={{ fontSize: 10, color: "#475569" }}>📞 —</span>
                      }
                      {e.adresse ? <span style={{ fontSize: 10, color: "#94A3B8" }}>📍 {e.adresse}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span
                      onClick={function () { startEdit(e); }}
                      style={{ cursor: "pointer", fontSize: 14 }}
                    >
                      ✏️
                    </span>
                    {e.email && (
                      <span
                        onClick={function () {
                          window.open("https://outlook.live.com/mail/0/deeplink/compose?to=" + encodeURIComponent(e.email), "_blank");
                        }}
                        style={{ cursor: "pointer", fontSize: 14 }}
                      >
                        ✉️
                      </span>
                    )}
                    <span
                      onClick={function () { deleteContact(e.id); }}
                      style={{ cursor: "pointer", fontSize: 14 }}
                    >
                      🗑
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactsPage
