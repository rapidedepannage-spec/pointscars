import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { STATUTS, ASSUREURS } from '../config/constants'
import { S } from '../styles/theme'
import { uid, fd, fmt } from '../utils/helpers'

const ST = STATUTS;
const ASS = ASSUREURS;

function FormModal({ d, n, cls, sav }) {
  const ed = !!d.id;
  const [f, sF] = useState({
    num: d.num || "SIN-2026-" + String(n + 1).padStart(3, "0"),
    dt: d.dt || new Date().toISOString().slice(0, 10),
    cli: d.cli || "",
    tel: d.tel || "",
    email: d.email || "",
    veh: d.veh || "",
    imm: d.imm || "",
    ass: d.ass || "",
    exp: d.exp || "",
    sta: d.sta || "nouveau",
    mt: d.mt || "",
    liv: d.liv || "",
    rem: d.rem || "",
    fr: d.fr || ""
  });

  return (
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
      onClick={cls}
    >
      <div
        className="modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1E293B",
          borderRadius: 13,
          padding: "22px",
          width: "100%",
          maxWidth: 560,
          maxHeight: "88vh",
          overflow: "auto",
          border: "1px solid #334155",
          animation: "fi .2s"
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          {ed ? "✏️ Modifier" : "📁 Nouveau dossier"}
        </h2>

        <div
          className="modal-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}
        >
          <div>
            <label style={S.l}>N°</label>
            <input
              style={S.i}
              value={f.num}
              onChange={e => sF({ ...f, num: e.target.value })}
            />
          </div>
          <div>
            <label style={S.l}>Date</label>
            <input
              type="date"
              style={S.i}
              value={f.dt}
              onChange={e => sF({ ...f, dt: e.target.value })}
            />
          </div>
          <div>
            <label style={S.l}>Client</label>
            <input
              style={S.i}
              value={f.cli}
              onChange={e => sF({ ...f, cli: e.target.value })}
              placeholder="Nom"
            />
          </div>
          <div>
            <label style={S.l}>Tél</label>
            <input
              style={S.i}
              value={f.tel}
              onChange={e => sF({ ...f, tel: e.target.value })}
              placeholder="06…"
            />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.l}>Email client</label>
            <input
              type="email"
              style={S.i}
              value={f.email}
              onChange={e => sF({ ...f, email: e.target.value })}
              placeholder="client@email.com"
            />
          </div>
          <div>
            <label style={S.l}>Véhicule</label>
            <input
              style={S.i}
              value={f.veh}
              onChange={e => sF({ ...f, veh: e.target.value })}
              placeholder="Marque Modèle"
            />
          </div>
          <div>
            <label style={S.l}>Immat</label>
            <input
              style={S.i}
              value={f.imm}
              onChange={e => sF({ ...f, imm: e.target.value })}
              placeholder="AA-123-BB"
            />
          </div>
          <div>
            <label style={S.l}>Assureur</label>
            <select
              style={S.i}
              value={f.ass}
              onChange={e => sF({ ...f, ass: e.target.value })}
            >
              <option value="">—</option>
              {ASS.map(a => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.l}>Statut</label>
            <select
              style={S.i}
              value={f.sta}
              onChange={e => sF({ ...f, sta: e.target.value })}
            >
              {ST.map(x => (
                <option key={x.id} value={x.id}>{x.l}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.l}>Expert</label>
            <input
              style={S.i}
              value={f.exp}
              onChange={e => sF({ ...f, exp: e.target.value })}
              placeholder="Cabinet — Nom"
            />
          </div>
          <div>
            <label style={S.l}>Franchise €</label>
            <input
              type="number"
              style={S.i}
              value={f.fr}
              onChange={e => sF({ ...f, fr: e.target.value })}
            />
          </div>
          <div>
            <label style={S.l}>Montant HT €</label>
            <input
              type="number"
              style={S.i}
              value={f.mt}
              onChange={e => sF({ ...f, mt: e.target.value })}
            />
          </div>
          <div>
            <label style={S.l}>Livraison</label>
            <input
              type="date"
              style={S.i}
              value={f.liv}
              onChange={e => sF({ ...f, liv: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={S.l}>Remarques</label>
          <textarea
            rows={2}
            style={{ ...S.i, resize: "vertical" }}
            value={f.rem}
            onChange={e => sF({ ...f, rem: e.target.value })}
          />
        </div>

        <div style={{ display: "flex", gap: 7, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={cls} style={S.bg}>Annuler</button>
          <button onClick={() => sav(f)} style={S.b}>
            {ed ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FormModal
