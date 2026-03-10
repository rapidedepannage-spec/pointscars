import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { STATUTS, ASSUREURS } from '../config/constants'
import { S } from '../styles/theme'
import { uid, fd, fmt } from '../utils/helpers'

function AgendaPage({ dos, onOpen, curUser }) {
  const [cur, setCur] = useState(new Date());
  const [rdvs, setRdvs] = useState([]);
  const [showAdd, setShowAdd] = useState(null); // null or date string
  const [nrdv, setNrdv] = useState({
    titre: "",
    heure: "09:00",
    type: "rdv",
    note: ""
  });
  const y = cur.getFullYear(),
    m = cur.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const today = new Date();
  const isToday = d => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
  const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const RDV_TYPES = [
    { id: "rdv", l: "🗓 RDV Client", c: "#A855F7" },
    { id: "expertise_rdv", l: "🔍 Expertise", c: "#F59E0B" },
    { id: "livraison_rdv", l: "🚗 Livraison", c: "#10B981" },
    { id: "rappel", l: "📞 Rappel", c: "#06B6D4" },
    { id: "autre", l: "📌 Autre", c: "#F97316" }
  ];

  // Charger RDVs depuis Firebase
  useEffect(() => {
    const unsub = db.collection("rdvs").onSnapshot(snap => {
      setRdvs(snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
    }, function (err) {
      console.error(err);
    });
    return function () {
      unsub();
    };
  }, []);

  // Ajouter un RDV
  const addRdv = () => {
    if (!nrdv.titre || !showAdd) return;
    const r = {
      id: uid(),
      date: showAdd,
      titre: nrdv.titre,
      heure: nrdv.heure,
      type: nrdv.type,
      note: nrdv.note,
      creePar: curUser.nom,
      creeAt: new Date().toISOString()
    };
    db.collection("rdvs").doc(r.id).set(r);
    setNrdv({
      titre: "",
      heure: "09:00",
      type: "rdv",
      note: ""
    });
    setShowAdd(null);
  };
  const delRdv = id => {
    if (confirm("Supprimer ce RDV?")) db.collection("rdvs").doc(id).delete();
  };

  // Events par jour (dossiers + rdvs)
  const events = day => {
    const ds = String(y) + "-" + String(m + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    const evts = [];
    dos.forEach(d => {
      if (d.dt === ds) evts.push({
        type: "dossier",
        label: "📁 " + d.cli,
        color: "#3B82F6",
        d: d,
        isRdv: false
      });
      if (d.liv === ds) evts.push({
        type: "livraison",
        label: "🚗 " + d.cli,
        color: "#10B981",
        d: d,
        isRdv: false
      });
    });
    rdvs.filter(r => r.date === ds).sort(function (a, b) {
      return (a.heure || "").localeCompare(b.heure || "");
    }).forEach(r => {
      const tp = RDV_TYPES.find(t => t.id === r.type) || RDV_TYPES[0];
      evts.push({
        type: "rdv",
        label: (r.heure ? r.heure + " " : "") + r.titre,
        color: tp.c,
        rdv: r,
        isRdv: true
      });
    });
    return evts;
  };

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ animation: "fi .3s" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>📅 Agenda</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <button onClick={() => setCur(new Date(y, m - 1, 1))} style={S.bg}>◀</button>
        <h2 style={{ fontSize: 16, fontWeight: 600, minWidth: 200, textAlign: "center" }}>
          {MOIS[m]} {y}
        </h2>
        <button onClick={() => setCur(new Date(y, m + 1, 1))} style={S.bg}>▶</button>
        <button
          onClick={() => setCur(new Date())}
          style={{ ...S.b, marginLeft: "auto", fontSize: 12, padding: "8px 16px" }}
        >
          📍 Aujourd'hui
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        {[["📁 Réception", "#3B82F6"], ["🚗 Livraison", "#10B981"], ["🗓 RDV", "#A855F7"], ["📞 Rappel", "#06B6D4"], ["📌 Autre", "#F97316"]].map(([l, c], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
            <span style={{ fontSize: 12, color: "#64748B" }}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{
        borderRadius: 12,
        overflow: "hidden",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {JOURS.map(j => (
            <div
              key={j}
              style={{
                padding: "10px 8px",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                borderBottom: "2px solid #E2E8F0",
                background: "#F8FAFC",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              {j}
            </div>
          ))}
          {cells.map((day, i) => {
            const evts = day ? events(day) : [];
            const ds = day ? String(y) + "-" + String(m + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0") : "";
            return (
              <div
                key={i}
                onClick={() => { if (day) setShowAdd(ds); }}
                style={{
                  minHeight: 90,
                  padding: "6px",
                  borderBottom: "1px solid #E2E8F0",
                  borderRight: "1px solid #E2E8F0",
                  background: day && isToday(day) ? "#FFFBEB" : day ? "#FFFFFF" : "#F8FAFC",
                  cursor: day ? "pointer" : "default",
                  transition: "background .15s"
                }}
              >
                {day && (
                  <div>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 3,
                      paddingRight: 2
                    }}>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#94A3B8",
                          cursor: "pointer",
                          fontWeight: 700,
                          lineHeight: 1,
                          width: 20,
                          height: 20,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          background: "#F1F5F9"
                        }}
                        onClick={e => { e.stopPropagation(); setShowAdd(ds); }}
                      >
                        +
                      </span>
                      <span style={{
                        fontSize: 13,
                        fontWeight: isToday(day) ? 800 : 500,
                        color: isToday(day) ? "#D97706" : "#334155"
                      }}>
                        {day}
                      </span>
                    </div>
                    {evts.map((e, j) => (
                      <div
                        key={j}
                        onClick={ev => {
                          ev.stopPropagation();
                          if (e.isRdv) {} else if (e.d) onOpen(e.d);
                        }}
                        style={{
                          fontSize: 10,
                          padding: "3px 5px",
                          marginBottom: 2,
                          borderRadius: 5,
                          background: e.color + "18",
                          color: e.color,
                          fontWeight: 600,
                          cursor: e.isRdv ? "default" : "pointer",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          borderLeft: "2px solid " + e.color,
                          position: "relative"
                        }}
                      >
                        {e.label}
                        {e.isRdv && (
                          <span
                            onClick={ev => { ev.stopPropagation(); delRdv(e.rdv.id); }}
                            style={{
                              position: "absolute",
                              right: 2,
                              top: 0,
                              fontSize: 8,
                              cursor: "pointer",
                              color: "#EF4444",
                              opacity: 0.6
                            }}
                          >
                            ✕
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showAdd && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 12
          }}
          onClick={() => setShowAdd(null)}
        >
          <div
            className="modal-dialog"
            onClick={e => e.stopPropagation()}
            style={{
              background: "#1E293B",
              borderRadius: 13,
              padding: "22px",
              width: "100%",
              maxWidth: 420,
              border: "1px solid #334155",
              animation: "fi .2s"
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📅 Nouveau RDV</h2>
            <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 14 }}>
              {showAdd.split("-").reverse().join("/")}
            </p>
            <div
              className="modal-grid"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 9 }}
            >
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.l}>Titre *</label>
                <input
                  style={S.i}
                  value={nrdv.titre}
                  onChange={e => setNrdv({ ...nrdv, titre: e.target.value })}
                  placeholder="Ex: RDV M. Dupont, Expertise Clio…"
                  onKeyDown={e => e.key === "Enter" && addRdv()}
                />
              </div>
              <div>
                <label style={S.l}>Heure</label>
                <input
                  type="time"
                  style={S.i}
                  value={nrdv.heure}
                  onChange={e => setNrdv({ ...nrdv, heure: e.target.value })}
                />
              </div>
              <div>
                <label style={S.l}>Type</label>
                <select
                  style={S.i}
                  value={nrdv.type}
                  onChange={e => setNrdv({ ...nrdv, type: e.target.value })}
                >
                  {RDV_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.l}>Note</label>
              <textarea
                rows={2}
                style={{ ...S.i, resize: "vertical" }}
                value={nrdv.note}
                onChange={e => setNrdv({ ...nrdv, note: e.target.value })}
                placeholder="Détails…"
              />
            </div>
            <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAdd(null)} style={S.bg}>Annuler</button>
              <button onClick={addRdv} style={S.b}>✓ Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const monthEvts = [];
        for (var d = 1; d <= daysInMonth; d++) {
          events(d).forEach(function (e) {
            monthEvts.push({ ...e, day: d });
          });
        }
        if (!monthEvts.length) return null;
        return (
          <div style={{ marginTop: 16, ...S.c, padding: "14px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
              📋 Ce mois : {monthEvts.length} événements
            </h3>
            {monthEvts.map((e, i) => (
              <div
                key={i}
                onClick={() => { if (!e.isRdv && e.d) onOpen(e.d); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  cursor: e.isRdv ? "default" : "pointer",
                  borderRadius: 6,
                  marginBottom: 2,
                  background: "#0F172A"
                }}
              >
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#F59E0B",
                  fontFamily: "monospace",
                  minWidth: 28
                }}>
                  {e.day}/{m + 1}
                </div>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: e.color,
                  flexShrink: 0
                }} />
                <div style={{ fontSize: 11, fontWeight: 500, flex: 1 }}>{e.label}</div>
                {e.isRdv && e.rdv.note && (
                  <div style={{ fontSize: 9, color: "#64748B" }}>{e.rdv.note.slice(0, 30)}</div>
                )}
                {e.isRdv && (
                  <span
                    onClick={ev => { ev.stopPropagation(); delRdv(e.rdv.id); }}
                    style={{ fontSize: 10, cursor: "pointer", color: "#EF4444", opacity: 0.5 }}
                  >
                    🗑
                  </span>
                )}
                {!e.isRdv && e.d && (
                  <div style={{ fontSize: 9, color: "#64748B" }}>{e.d.veh} {e.d.imm}</div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

export default AgendaPage
