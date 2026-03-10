import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { STATUTS, ASSUREURS } from '../config/constants'
import { S } from '../styles/theme'
import { uid, fd, fmt, tot } from '../utils/helpers'

function ChartPage({ dos, curUser }) {
  const [period, setPeriod] = useState("mois");

  // Calcul données par mois (12 derniers mois)
  const now = new Date();
  const MOIS_COURT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const monthData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const dossiers = dos.filter(x => x.dt && x.dt.startsWith(key));
    const ca = dossiers.reduce((s, x) => s + (+x.mt || 0), 0);
    const nb = dossiers.length;
    const pieces = dossiers.reduce((s, x) => s + tot(x.pcs), 0);
    monthData.push({
      label: MOIS_COURT[d.getMonth()] + " " + d.getFullYear(),
      ca,
      nb,
      pieces,
      marge: ca - pieces
    });
  }
  const maxCA = Math.max(...monthData.map(d => d.ca), 1);
  const totalCA = monthData.reduce((s, d) => s + d.ca, 0);
  const totalDos = monthData.reduce((s, d) => s + d.nb, 0);
  const totalMarge = monthData.reduce((s, d) => s + d.marge, 0);
  const avgCA = Math.round(totalCA / 12);

  // SVG chart dimensions
  const W = 800,
    H = 300,
    PAD = 50,
    PB = 30;
  const chartW = W - PAD * 2,
    chartH = H - PAD - PB;
  const points = monthData.map((d, i) => ({
    x: PAD + i / (monthData.length - 1) * chartW,
    y: PAD + chartH - d.ca / maxCA * chartH,
    ...d
  }));
  const margePoints = monthData.map((d, i) => ({
    x: PAD + i / (monthData.length - 1) * chartW,
    y: PAD + chartH - Math.max(d.marge, 0) / maxCA * chartH,
    ...d
  }));
  const line = points.map((p, i) => (i === 0 ? "M" : "L") + p.x + "," + p.y).join(" ");
  const area = line + " L" + points[points.length - 1].x + "," + (PAD + chartH) + " L" + points[0].x + "," + (PAD + chartH) + " Z";
  const margeLine = margePoints.map((p, i) => (i === 0 ? "M" : "L") + p.x + "," + p.y).join(" ");

  function rentaColor(pct) {
    if (pct >= 55) return "#10B981";
    if (pct >= 40) return "#F59E0B";
    if (pct >= 25) return "#F97316";
    return "#EF4444";
  }

  return (
    <div style={{ animation: "fi .3s" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>📊 Chiffre d'affaires</h1>
      <p style={{ color: "#94A3B8", fontSize: 13, marginBottom: 20 }}>Évolution sur les 12 derniers mois</p>

      <div
        className="stats-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 22 }}
      >
        {[
          ["📈", "CA total", totalCA.toLocaleString("fr-FR") + "€", "#F59E0B"],
          ["📁", "Dossiers traités", totalDos, "#3B82F6"],
          ["💰", "Marge totale", totalMarge.toLocaleString("fr-FR") + "€", totalMarge >= 0 ? "#10B981" : "#EF4444"],
          ["📊", "CA moyen/mois", avgCA.toLocaleString("fr-FR") + "€", "#8B5CF6"]
        ].map(([ic, l, v, c], i) => (
          <div
            key={i}
            style={{
              ...S.c,
              padding: "18px",
              borderLeft: "3px solid " + c,
              background: "linear-gradient(135deg, #1E293B, " + c + "08)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{
                fontSize: 11,
                color: "#94A3B8",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {l}
              </span>
              <span style={{ fontSize: 20, opacity: 0.8 }}>{ic}</span>
            </div>
            <div style={{
              fontSize: 26,
              fontWeight: 800,
              color: c,
              fontFamily: "monospace",
              letterSpacing: "-0.5px"
            }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...S.c, padding: "20px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600 }}>📈 Évolution CA &amp; Marge</h3>
          <div style={{ display: "flex", gap: 16 }}>
            {[["—", "CA (chiffrage)", "#F59E0B"], ["- -", "Marge (CA - pièces)", "#10B981"]].map(([s, l, c], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 3, background: c, borderRadius: 2 }} />
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: "auto" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const yPos = PAD + chartH - r * chartH;
            return (
              <g key={i}>
                <line
                  x1={PAD}
                  y1={yPos}
                  x2={PAD + chartW}
                  y2={yPos}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray={r === 0 ? "" : "4,4"}
                />
                <text
                  x={PAD - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {Math.round(maxCA * r).toLocaleString("fr-FR")}
                </text>
              </g>
            );
          })}
          <path d={area} fill="url(#caGrad)" opacity="0.15" />
          <defs>
            <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={line}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={margeLine}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeDasharray="6,3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={4} fill="#F59E0B" stroke="#1E293B" strokeWidth="2" />
              {p.ca > 0 && (
                <text
                  x={p.x}
                  y={p.y - 12}
                  textAnchor="middle"
                  fill="#F59E0B"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {p.ca.toLocaleString("fr-FR")}
                </text>
              )}
              <text
                x={p.x}
                y={PAD + chartH + 16}
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="8"
              >
                {p.label.split(" ")[0]}
              </text>
            </g>
          ))}
          {margePoints.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3} fill="#10B981" stroke="#1E293B" strokeWidth="2" />
            </g>
          ))}
        </svg>
      </div>

      <div style={{ ...S.c, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #334155", background: "#0F172A" }}>
                {["Mois", "Dossiers", "CA HT", "Pièces&MO", "Marge", "% Marge"].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "11px 12px",
                      textAlign: "left",
                      color: "#94A3B8",
                      fontSize: 10,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      letterSpacing: "0.5px"
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...monthData].reverse().map((d, i) => (
                <tr
                  key={i}
                  className="hr"
                  style={{
                    borderBottom: "1px solid #33415530",
                    background: i % 2 ? "#172033" : "#1E293B"
                  }}
                >
                  <td style={{ padding: "9px 12px", fontWeight: 600, fontSize: 12 }}>{d.label}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#3B82F6", fontWeight: 600 }}>{d.nb}</td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: "#F59E0B", fontSize: 13 }}>
                    {d.ca.toLocaleString("fr-FR")}€
                  </td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: "#F97316" }}>
                    {d.pieces.toLocaleString("fr-FR")}€
                  </td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: d.marge >= 0 ? "#10B981" : "#EF4444" }}>
                    {d.marge.toLocaleString("fr-FR")}€
                  </td>
                  <td style={{ padding: "9px 12px", fontFamily: "monospace", color: d.ca > 0 ? "#8B5CF6" : "#475569", fontWeight: 600 }}>
                    {d.ca > 0 ? Math.round(d.marge / d.ca * 100) + "%" : "—"}
                  </td>
                </tr>
              ))}
              {/* === LIGNE TOTAUX === */}
              <tr
                key="total"
                style={{ borderTop: "2px solid #F59E0B40", background: "#F59E0B08" }}
              >
                <td style={{ padding: "11px 12px", fontWeight: 800, fontSize: 13, color: "#F59E0B" }}>∑ TOTAL</td>
                <td style={{ padding: "11px 12px", fontFamily: "monospace", fontWeight: 800, color: "#3B82F6", fontSize: 13 }}>{totalDos}</td>
                <td style={{ padding: "11px 12px", fontFamily: "monospace", fontWeight: 800, color: "#F59E0B", fontSize: 14 }}>
                  {totalCA.toLocaleString("fr-FR")}€
                </td>
                <td style={{ padding: "11px 12px", fontFamily: "monospace", fontWeight: 800, color: "#F97316", fontSize: 13 }}>
                  {monthData.reduce(function(s,d){return s+d.pieces},0).toLocaleString("fr-FR")}€
                </td>
                <td style={{ padding: "11px 12px", fontFamily: "monospace", fontWeight: 800, color: totalMarge >= 0 ? "#10B981" : "#EF4444", fontSize: 14 }}>
                  {totalMarge.toLocaleString("fr-FR")}€
                </td>
                <td style={{ padding: "11px 12px", fontFamily: "monospace", fontWeight: 800, color: "#8B5CF6", fontSize: 13 }}>
                  {totalCA > 0 ? Math.round(totalMarge / totalCA * 100) + "%" : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* === RENTABILITE PAR EMPLOYE (ADMIN ONLY) === */}
      {curUser && curUser.role === "admin" && (() => {
        var byEmp = {};
        dos.forEach(function(d) {
          var nom = d.creePar || "Non assigné";
          if (!byEmp[nom]) byEmp[nom] = { nom: nom, nb: 0, ca: 0, pieces: 0, marge: 0, enCours: 0, factures: 0 };
          byEmp[nom].nb++;
          var mt = +d.mt || 0;
          var pc = tot(d.pcs);
          byEmp[nom].ca += mt;
          byEmp[nom].pieces += pc;
          byEmp[nom].marge += mt - pc;
          if (d.sta === "FACTURE" || d.sta === "facture") byEmp[nom].factures++;
          if (d.sta !== "FACTURE" && d.sta !== "facture" && d.sta !== "ANNULE" && d.sta !== "annule") byEmp[nom].enCours++;
        });
        var empList = Object.values(byEmp).sort(function(a, b) { return b.nb - a.nb; });
        var maxNb = Math.max.apply(null, empList.map(function(e) { return e.nb; })) || 1;
        var maxCAEmp = Math.max.apply(null, empList.map(function(e) { return e.ca; })) || 1;
        var empColors = ["#F59E0B", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#EF4444"];
        var totalNb = empList.reduce(function(s, e) { return s + e.nb; }, 0);
        var totalCAEmp = empList.reduce(function(s, e) { return s + e.ca; }, 0);
        var totalMargeEmp = empList.reduce(function(s, e) { return s + e.marge; }, 0);

        return (
          <div style={{ marginTop: 24 }}>
            {/* --- Section 1 : Nombre de dossiers par employé (barres) --- */}
            <div style={{ ...S.c, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#F8FAFC" }}>📋 Nombre de dossiers par employé</h3>
              <p style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>Répartition du volume de dossiers par collaborateur</p>
              {empList.length === 0
                ? <p style={{ color: "#64748B", fontSize: 12 }}>Aucune donnée</p>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {empList.map(function(emp, i) {
                      var pctNb = Math.round(emp.nb / maxNb * 100);
                      var col = empColors[i % empColors.length];
                      var pctTotal = totalNb > 0 ? Math.round(emp.nb / totalNb * 100) : 0;
                      return (
                        <div key={"nb-" + emp.nom} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ minWidth: 90, fontSize: 12, fontWeight: 600, color: "#E2E8F0", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {emp.nom}
                          </div>
                          <div style={{ flex: 1, position: "relative", height: 30, background: "#0F172A", borderRadius: 6, overflow: "hidden" }}>
                            <div style={{ width: pctNb + "%", height: "100%", background: "linear-gradient(90deg," + col + "," + col + "90)", borderRadius: 6, transition: "width .5s", minWidth: pctNb > 0 ? 4 : 0 }} />
                            <div style={{ position: "absolute", top: 0, left: 8, height: "100%", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700, color: "#FFF" }}>
                              {emp.nb + " dossier" + (emp.nb > 1 ? "s" : "") + " (" + pctTotal + "%)"}
                            </div>
                          </div>
                          <div style={{ minWidth: 50, textAlign: "right", fontSize: 18, fontWeight: 800, color: col, fontFamily: "monospace" }}>
                            {emp.nb}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </div>

            {/* --- Section 2 : Rentabilité par employé (barres + %) --- */}
            <div style={{ ...S.c, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#F8FAFC" }}>💰 Rentabilité par employé</h3>
              <p style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>Taux de marge et performance financière par collaborateur</p>
              {empList.length === 0
                ? <p style={{ color: "#64748B", fontSize: 12 }}>Aucune donnée</p>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {empList.map(function(emp, i) {
                      var renta = emp.ca > 0 ? Math.round(emp.marge / emp.ca * 100) : 0;
                      var col = rentaColor(renta);
                      var ticketMoyen = emp.nb > 0 ? Math.round(emp.ca / emp.nb) : 0;
                      var pctCA = Math.round(emp.ca / maxCAEmp * 100);
                      return (
                        <div key={"renta-" + emp.nom} style={{ background: "#0F172A", borderRadius: 8, padding: "12px 14px", borderLeft: "3px solid " + col }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{emp.nom}</span>
                              <span style={{ fontSize: 10, color: "#64748B", background: "#1E293B", padding: "2px 6px", borderRadius: 4 }}>
                                {emp.nb + " dossier" + (emp.nb > 1 ? "s" : "")}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 22, fontWeight: 800, color: col, fontFamily: "monospace" }}>{renta + "%"}</span>
                              <span style={{ fontSize: 9, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>marge</span>
                            </div>
                          </div>
                          {/* Barre CA */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 9, color: "#64748B", minWidth: 30 }}>CA</span>
                            <div style={{ flex: 1, height: 6, background: "#1E293B", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: pctCA + "%", height: "100%", background: col, borderRadius: 3, transition: "width .5s" }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#E2E8F0", fontFamily: "monospace", minWidth: 70, textAlign: "right" }}>
                              {emp.ca.toLocaleString("fr-FR") + "€"}
                            </span>
                          </div>
                          {/* Barre Marge */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 9, color: "#64748B", minWidth: 30 }}>Marge</span>
                            <div style={{ flex: 1, height: 6, background: "#1E293B", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: (emp.ca > 0 ? Math.round(emp.marge / maxCAEmp * 100) : 0) + "%", height: "100%", background: emp.marge >= 0 ? col : "#EF4444", borderRadius: 3, transition: "width .5s" }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: emp.marge >= 0 ? "#10B981" : "#EF4444", fontFamily: "monospace", minWidth: 70, textAlign: "right" }}>
                              {emp.marge.toLocaleString("fr-FR") + "€"}
                            </span>
                          </div>
                          {/* Ligne infos */}
                          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 9, color: "#94A3B8" }}>🎫 Ticket moyen: {ticketMoyen.toLocaleString("fr-FR") + "€"}</span>
                            <span style={{ fontSize: 9, color: "#94A3B8" }}>✅ Facturés: {emp.factures}</span>
                            <span style={{ fontSize: 9, color: "#94A3B8" }}>🔄 En cours: {emp.enCours}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </div>

            {/* --- Section 3 : Tableau récapitulatif --- */}
            <div style={{ ...S.c, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#F8FAFC" }}>📊 Tableau récapitulatif</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #334155" }}>
                      {["Employé", "Dossiers", "CA", "Coût pièces", "Marge", "Rentabilité", "Ticket moyen"].map(function(h, i) {
                        return (
                          <th
                            key={i}
                            style={{
                              padding: "8px 6px",
                              textAlign: i === 0 ? "left" : "right",
                              color: "#94A3B8",
                              fontWeight: 700,
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {empList.map(function(emp, i) {
                      var renta = emp.ca > 0 ? Math.round(emp.marge / emp.ca * 100) : 0;
                      var ticketMoyen = emp.nb > 0 ? Math.round(emp.ca / emp.nb) : 0;
                      var col = rentaColor(renta);
                      return (
                        <tr key={"tab-" + emp.nom} style={{ borderBottom: "1px solid #1E293B", background: i % 2 === 0 ? "transparent" : "#0F172A08" }}>
                          <td style={{ padding: "10px 6px", fontWeight: 600, color: "#E2E8F0", whiteSpace: "nowrap" }}>{emp.nom}</td>
                          <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, color: "#3B82F6", fontFamily: "monospace", fontSize: 14 }}>{emp.nb}</td>
                          <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "monospace", color: "#F8FAFC" }}>{emp.ca.toLocaleString("fr-FR") + "€"}</td>
                          <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "monospace", color: "#F97316" }}>{emp.pieces.toLocaleString("fr-FR") + "€"}</td>
                          <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: emp.marge >= 0 ? "#10B981" : "#EF4444" }}>{emp.marge.toLocaleString("fr-FR") + "€"}</td>
                          <td style={{ padding: "10px 6px", textAlign: "right" }}>
                            <span style={{ background: col + "20", color: col, padding: "3px 8px", borderRadius: 12, fontWeight: 700, fontSize: 12, fontFamily: "monospace" }}>
                              {renta + "%"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "monospace", color: "#94A3B8" }}>{ticketMoyen.toLocaleString("fr-FR") + "€"}</td>
                        </tr>
                      );
                    })}
                    {/* Ligne TOTAL */}
                    <tr style={{ borderTop: "2px solid #F59E0B", background: "#F59E0B10" }}>
                      <td style={{ padding: "10px 6px", fontWeight: 800, color: "#F59E0B" }}>TOTAL</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 800, color: "#F59E0B", fontFamily: "monospace", fontSize: 14 }}>{totalNb}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, fontFamily: "monospace", color: "#F59E0B" }}>{totalCAEmp.toLocaleString("fr-FR") + "€"}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "monospace", color: "#F97316" }}>
                        {empList.reduce(function(s, e) { return s + e.pieces; }, 0).toLocaleString("fr-FR") + "€"}
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontWeight: 700, fontFamily: "monospace", color: totalMargeEmp >= 0 ? "#10B981" : "#EF4444" }}>
                        {totalMargeEmp.toLocaleString("fr-FR") + "€"}
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right" }}>
                        <span style={{
                          background: rentaColor(totalCAEmp > 0 ? Math.round(totalMargeEmp / totalCAEmp * 100) : 0) + "20",
                          color: rentaColor(totalCAEmp > 0 ? Math.round(totalMargeEmp / totalCAEmp * 100) : 0),
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 12,
                          fontFamily: "monospace"
                        }}>
                          {(totalCAEmp > 0 ? Math.round(totalMargeEmp / totalCAEmp * 100) : 0) + "%"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 6px", textAlign: "right", fontFamily: "monospace", color: "#94A3B8" }}>
                        {(totalNb > 0 ? Math.round(totalCAEmp / totalNb) : 0).toLocaleString("fr-FR") + "€"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default ChartPage
