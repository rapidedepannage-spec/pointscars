import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { STATUTS } from '../config/constants'
import { S } from '../styles/theme'
import { fd, fmt } from '../utils/helpers'
import Badge from './Badge'
import MailsTab from './MailsTab'
import RapportIA from './RapportIA'
import PhotosTab from './PhotosTab'
import PiecesTab from './PiecesTab'
import ORTab from './ORTab'
import PECTab from './PECTab'
import PretTab from './PretTab'
import PIECTab from './PIECTab'

function DetailView({
  d,
  tab,
  sT,
  bk,
  up,
  curUser
}) {
  const pt = (d.pcs || []).reduce(function (a, pc) {
    var pa = pc.pa !== undefined && pc.pa !== null ? pc.pa : pc.p || 0;
    return a + (pc.q || 0) * pa;
  }, 0);
  const pvt = (d.pcs || []).reduce(function (a, pc) {
    var pv = pc.pv !== undefined && pc.pv !== null ? pc.pv : pc.p || 0;
    return a + (pc.q || 0) * (pv || 0);
  }, 0);
  const phT = (d.ph || []).reduce((a, b) => a + b, 0);
  const [contacts, setContacts] = useState([]);
  useEffect(() => {
    const unsub = db.collection("contacts").onSnapshot(function (snap) {
      setContacts(snap.docs.map(function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      }));
    }, function (err) {
      console.error(err);
    });
    return function () {
      unsub();
    };
  }, []);

  return (
    <div style={{ animation: "fi .3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <button
          onClick={bk}
          style={{
            background: "none",
            border: "1px solid #475569",
            color: "#94A3B8",
            padding: "6px 12px",
            borderRadius: 7,
            cursor: "pointer",
            fontSize: 11
          }}
        >
          ← Retour
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 19, fontWeight: 700 }}>{d.cli}</h1>
            <Badge s={d.sta} />
          </div>
          <p style={{ color: "#94A3B8", fontSize: 10 }}>
            {d.num} — {d.veh} — {d.imm}{d.fr ? " — Fr:" + d.fr + "€" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            const q = encodeURIComponent((d.cli || "") + " " + (d.imm || ""));
            window.open("https://outlook.live.com/mail/0/search?query=" + q, "_blank");
          }}
          style={{
            background: "linear-gradient(135deg,#0078D4,#106EBE)",
            color: "#FFF",
            border: "none",
            padding: "7px 14px",
            borderRadius: 7,
            fontWeight: 600,
            fontSize: 11,
            cursor: "pointer"
          }}
        >
          📧 Outlook
        </button>
      </div>

      <div
        className="tabs-row"
        style={{ display: "flex", gap: 2, marginBottom: 14, borderBottom: "2px solid #334155" }}
      >
        {[["rapport", "🤖 IA"], ["infos", "📋 Infos"], ["mails", "✉️ Mails"], ["photos", "📷 Photos"], ["pieces", "🔩 Pièces(" + (d.pcs || []).length + ")"], ["or", "📄 OR"], ["pec", "📝 PEC"], ["pret", "🚗 Prêt"], ["piec", "♻️ PIEC"]].map(([id, l]) => (
          <div
            key={id}
            onClick={() => sT(id)}
            style={{
              padding: "8px 14px",
              cursor: "pointer",
              borderBottom: tab === id ? "2px solid #F59E0B" : "2px solid transparent",
              marginBottom: -2,
              color: tab === id ? "#F59E0B" : "#94A3B8",
              fontWeight: tab === id ? 600 : 400,
              fontSize: 11,
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {tab === "infos" && (
        <div
          className="modal-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {[
            ["N° dossier", d.num],
            ["Date", fd(d.dt)],
            ["Client", d.cli],
            ["Tél", d.tel],
            ["Email", d.email || "—", "#06B6D4"],
            ["Véhicule", d.veh],
            ["Immat", d.imm],
            ["Assureur", d.ass],
            ["Cabinet expertise", d.exp || "—", "#F59E0B"],
            ["Franchise", d.fr ? d.fr + "€" : "—", "#EF4444"],
            ["Chiffrage", d.mt ? d.mt + "€" : "—", "#10B981"],
            ["Livraison", fd(d.liv)],
            ["Créé par", d.creePar ? d.creePar + " — " + (d.creeAt ? new Date(d.creeAt).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            }) : "") : "—", "#06B6D4"]
          ].map(([l, v, c], i) => (
            <div key={i} style={{ ...S.c, padding: "10px 13px" }}>
              <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>
                {l}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: c || "#F8FAFC" }}>
                {v}
              </div>
            </div>
          ))}

          <div style={{ ...S.c, padding: "10px 13px", gridColumn: "1/-1" }}>
            <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600 }}>REMARQUES</div>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>{d.rem || "—"}</div>
          </div>

          <div
            style={{
              gridColumn: "1/-1",
              background: "rgba(139,92,246,0.05)",
              borderRadius: 11,
              padding: "14px",
              border: "1px solid rgba(139,92,246,0.15)"
            }}
          >
            <h3 style={{ fontSize: 11, fontWeight: 600, color: "#A78BFA", marginBottom: 9 }}>
              💰 Récapitulatif
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {[
                ["ACHAT", fmt(pt), "#F97316"],
                ["VENTE", fmt(pvt), "#10B981"],
                ["FRANCHISE", d.fr ? d.fr + "€" : "—", "#EF4444"],
                ["MARGE", pvt && pt ? fmt(pvt - pt) : "—", "#8B5CF6"]
              ].map(([l, v, c], i) => (
                <div key={i}>
                  <div style={{ fontSize: 8, color: "#94A3B8" }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c, fontFamily: "monospace" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "mails" && <MailsTab d={d} contacts={contacts} />}
      {tab === "rapport" && <RapportIA d={d} up={up} curUser={curUser} />}
      {tab === "photos" && <PhotosTab d={d} up={up} />}
      {tab === "pieces" && <PiecesTab d={d} up={up} curUser={curUser} />}
      {tab === "or" && <ORTab d={d} up={up} />}
      {tab === "pec" && <PECTab d={d} up={up} />}
      {tab === "pret" && <PretTab d={d} up={up} />}
      {tab === "piec" && <PIECTab d={d} contacts={contacts} />}
    </div>
  );
}

export default DetailView
