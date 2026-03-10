import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { ROLES } from '../config/constants';
import { S } from '../styles/theme';
import { uid, fmt, fd } from '../utils/helpers';

function generateFactureHtml(fac) {
  var dateFR = fac.date ? fac.date.split("-").reverse().join("/") : new Date().toLocaleDateString("fr-FR");
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture ' + fac.num + '</title>';
  h += '<style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:30px;max-width:800px;margin:0 auto}';
  h += 'table{width:100%;border-collapse:collapse}th{background:#1a365d;color:#FFF;padding:8px;text-align:left;font-size:10px}';
  h += 'td{padding:6px 8px;border-bottom:1px solid #eee;font-size:11px}';
  h += '@media print{body{padding:15px}button,.noprint{display:none!important}}</style></head><body>';
  h += '<div style="display:flex;justify-content:space-between;margin-bottom:25px"><div>';
  h += '<strong style="font-size:18px;color:#1a365d">RAPIDE DÉPANNAGE</strong><br>';
  h += '<span style="font-size:9px;color:#666">SAS au capital de 10 000€</span><br>';
  h += '24 Rue Saint Abdon<br>77390 Guignes<br>';
  h += 'Tél: 01 89 43 16 83<br>';
  h += 'SIRET: 84483885400025<br>TVA: FR82844838854<br>APE: 4520A';
  h += '</div><div style="text-align:right">';
  h += '<h1 style="margin:0;font-size:24px;color:#1a365d">FACTURE</h1>';
  h += '<div style="font-size:14px;font-weight:700;margin-top:5px">' + fac.num + '</div>';
  h += '<div style="margin-top:8px">Date : ' + dateFR + '</div></div></div>';
  h += '<div style="display:flex;gap:15px;margin-bottom:20px">';
  h += '<div style="flex:1;border:1px solid #ddd;border-radius:6px;padding:12px">';
  h += '<strong style="color:#1a365d;font-size:10px;text-transform:uppercase">Client</strong><br>';
  h += '<strong style="font-size:14px">' + (fac.client || "") + '</strong><br>';
  h += (fac.adresseClient ? fac.adresseClient + '<br>' : '');
  h += 'Tél: ' + (fac.telClient || "") + '<br>' + (fac.emailClient || "") + '</div>';
  h += '<div style="flex:1;border:1px solid #ddd;border-radius:6px;padding:12px">';
  h += '<strong style="color:#1a365d;font-size:10px;text-transform:uppercase">Véhicule</strong><br>';
  h += '<strong style="font-size:14px">' + (fac.vehicule || "") + '</strong><br>';
  h += 'Immat: <strong>' + (fac.immat || "") + '</strong><br>';
  h += 'Assureur: ' + (fac.assureur || "") + '<br>';
  h += 'N° dossier: ' + (fac.numDossier || "") + '</div></div>';
  h += '<table><thead><tr><th>Réf.</th><th>Désignation</th><th style="text-align:center">Qté</th>';
  h += '<th style="text-align:right">P.U. HT</th><th style="text-align:center">Remise</th><th style="text-align:right">Total HT</th></tr></thead><tbody>';
  (fac.lignes || []).forEach(function(l, i) {
    var bg = i % 2 ? '#f8fafc' : '#fff';
    h += '<tr style="background:' + bg + '"><td>' + (l.ref || "") + '</td><td>' + l.d + '</td>';
    h += '<td style="text-align:center">' + l.q + '</td>';
    h += '<td style="text-align:right">' + l.pu.toFixed(2) + ' €</td>';
    h += '<td style="text-align:center">' + (l.remise ? l.remise + ' %' : '—') + '</td>';
    h += '<td style="text-align:right;font-weight:600">' + l.totalHT.toFixed(2) + ' €</td></tr>';
  });
  h += '</tbody></table>';
  h += '<div style="margin-top:20px;display:flex;justify-content:flex-end"><table style="width:300px">';
  h += '<tr><td style="padding:5px 8px">Sous-total HT</td><td style="padding:5px 8px;text-align:right;font-weight:600">' + fac.sousTotal.toFixed(2) + ' €</td></tr>';
  if (fac.montantRemiseGlobale > 0) {
    var rl = fac.remiseGlobaleType === "pct" ? "Remise globale " + fac.remiseGlobale + " %" : "Remise globale";
    h += '<tr><td style="padding:5px 8px;color:#dc2626">' + rl + '</td><td style="padding:5px 8px;text-align:right;color:#dc2626;font-weight:600">-' + fac.montantRemiseGlobale.toFixed(2) + ' €</td></tr>';
  }
  h += '<tr style="border-top:2px solid #333"><td style="padding:6px 8px;font-weight:700;font-size:13px">Total HT</td>';
  h += '<td style="padding:6px 8px;text-align:right;font-weight:700;font-size:13px;color:#1a365d">' + fac.totalHT.toFixed(2) + ' €</td></tr>';
  h += '<tr><td style="padding:5px 8px">TVA 20 %</td><td style="padding:5px 8px;text-align:right">' + fac.tva.toFixed(2) + ' €</td></tr>';
  h += '<tr style="background:#1a365d;color:#fff"><td style="padding:8px;font-weight:700;font-size:14px">TOTAL TTC</td>';
  h += '<td style="padding:8px;text-align:right;font-weight:700;font-size:14px">' + fac.totalTTC.toFixed(2) + ' €</td></tr>';
  h += '</table></div>';
  h += '<div style="margin-top:30px;border-top:1px solid #ddd;padding-top:15px;font-size:9px;color:#666">';
  h += '<strong>Conditions de règlement :</strong> Paiement à réception de facture.<br>';
  h += 'En cas de retard, pénalité de 3 fois le taux d\u2019intérêt légal. Indemnité forfaitaire de recouvrement : 40 €.<br>';
  h += 'RAPIDE DÉPANNAGE SAS — SIRET 84483885400025 — TVA FR82844838854 — APE 4520A</div>';
  h += '<div class="noprint" style="margin-top:20px;text-align:center"><button onclick="window.print()" style="padding:10px 30px;background:#1a365d;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer">Imprimer</button></div>';
  h += '</body></html>';
  return h;
}

function FactureTab({ d, up, curUser }) {
  const [mode, setMode] = useState("list");
  const [editId, setEditId] = useState(null);
  const [sel, setSel] = useState({});
  const [saving, setSaving] = useState(false);
  const [draftDate, setDraftDate] = useState(new Date().toISOString().slice(0, 10));
  const [draftAdresse, setDraftAdresse] = useState("");
  const [remises, setRemises] = useState({});
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [remiseGlobaleType, setRemiseGlobaleType] = useState("pct");
  const [draftLignes, setDraftLignes] = useState([]);

  var factures = d.factures || [];
  var pcs = (d.pcs || []).map(function(p) {
    var out = { ...p };
    if (out.pv === undefined || out.pv === null) out.pv = out.p || 0;
    return out;
  });

  var selCount = Object.keys(sel).filter(function(k) { return sel[k]; }).length;
  var allSel = pcs.length > 0 && selCount === pcs.length;

  // En mode edit, on travaille sur draftLignes
  var activeLignes = mode === "edit" ? draftLignes : pcs.filter(function(p) { return sel[p.id || p.d]; });

  var computeTotals = function(lignes) {
    var sousTotal = lignes.reduce(function(a, l) {
      var rem = remises[l.id || l.d] || 0;
      return a + (l.q || 0) * (l.pv || l.pu || 0) * (1 - rem / 100);
    }, 0);
    var montantRemise = remiseGlobaleType === "pct" ? sousTotal * (remiseGlobale || 0) / 100 : (remiseGlobale || 0);
    var totalHT = sousTotal - montantRemise;
    var tva = totalHT * 0.20;
    var totalTTC = totalHT + tva;
    return {
      sousTotal: Math.round(sousTotal * 100) / 100,
      montantRemiseGlobale: Math.round(montantRemise * 100) / 100,
      totalHT: Math.round(totalHT * 100) / 100,
      tva: Math.round(tva * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100
    };
  };

  var totals = computeTotals(activeLignes);

  var initCreate = function() {
    setSel({});
    setRemises({});
    setRemiseGlobale(0);
    setRemiseGlobaleType("pct");
    setDraftDate(new Date().toISOString().slice(0, 10));
    setDraftAdresse("");
    setMode("create");
  };

  var initEdit = function(fac) {
    setEditId(fac.id);
    setDraftDate(fac.date || "");
    setDraftAdresse(fac.adresseClient || "");
    setDraftLignes(JSON.parse(JSON.stringify(fac.lignes || [])));
    var rm = {};
    (fac.lignes || []).forEach(function(l) { rm[l.id] = l.remise || 0; });
    setRemises(rm);
    setRemiseGlobale(fac.remiseGlobaleType === "pct" ? (fac.remiseGlobale || 0) : (fac.remiseGlobaleValeur || 0));
    setRemiseGlobaleType(fac.remiseGlobaleType || "pct");
    setMode("edit");
  };

  var buildLignes = function(srcLignes) {
    return srcLignes.map(function(p) {
      var rem = remises[p.id || p.d] || 0;
      var pu = p.pv || p.pu || 0;
      var totalHT = (p.q || 0) * pu * (1 - rem / 100);
      return { id: p.id || p.d, ref: p.ref || "", d: p.d || "", q: p.q || 0, pu: pu, remise: rem, totalHT: Math.round(totalHT * 100) / 100 };
    });
  };

  var saveFacture = async function(finalize) {
    setSaving(true);
    try {
      var srcLignes = mode === "edit" ? draftLignes : pcs.filter(function(p) { return sel[p.id || p.d]; });
      if (srcLignes.length === 0) { alert("Sélectionnez au moins une pièce"); setSaving(false); return; }
      var lignes = buildLignes(srcLignes);
      var t = computeTotals(srcLignes);
      var facObj;

      if (mode === "edit") {
        var oldFac = factures.find(function(f) { return f.id === editId; });
        facObj = {
          ...oldFac,
          date: draftDate,
          adresseClient: draftAdresse,
          lignes: lignes,
          remiseGlobale: remiseGlobaleType === "pct" ? remiseGlobale : 0,
          remiseGlobaleType: remiseGlobaleType,
          remiseGlobaleValeur: remiseGlobaleType === "eur" ? remiseGlobale : 0,
          sousTotal: t.sousTotal,
          montantRemiseGlobale: t.montantRemiseGlobale,
          totalHT: t.totalHT,
          tva: t.tva,
          totalTTC: t.totalTTC,
          etat: "brouillon"
        };
        facObj.html = generateFactureHtml(facObj);
        var updated = factures.map(function(f) { return f.id === editId ? facObj : f; });
        up(d.id, { factures: updated });
      } else {
        // Nouveau: generer numero
        var counterRef = db.collection("settings").doc("factureCounter");
        var num = await db.runTransaction(function(tx) {
          return tx.get(counterRef).then(function(doc) {
            var current = doc.exists ? (doc.data().lastNum || 0) : 0;
            var next = current + 1;
            tx.set(counterRef, { lastNum: next }, { merge: true });
            return next;
          });
        });
        var year = new Date().getFullYear();
        var facNum = "FAC-" + year + "-" + String(num).padStart(3, "0");

        facObj = {
          id: uid(),
          num: facNum,
          date: draftDate,
          dateCreation: new Date().toISOString(),
          etat: "brouillon",
          client: d.cli || "",
          telClient: d.tel || "",
          emailClient: d.email || "",
          adresseClient: draftAdresse,
          vehicule: d.veh || "",
          immat: d.imm || "",
          assureur: d.ass || "",
          numDossier: d.num || "",
          lignes: lignes,
          remiseGlobale: remiseGlobaleType === "pct" ? remiseGlobale : 0,
          remiseGlobaleType: remiseGlobaleType,
          remiseGlobaleValeur: remiseGlobaleType === "eur" ? remiseGlobale : 0,
          sousTotal: t.sousTotal,
          montantRemiseGlobale: t.montantRemiseGlobale,
          totalHT: t.totalHT,
          tva: t.tva,
          totalTTC: t.totalTTC,
          creePar: curUser ? curUser.nom : ""
        };
        facObj.html = generateFactureHtml(facObj);
        up(d.id, { factures: [...factures, facObj] });
        botMsg("general", "🧾 Facture " + facNum + " créée pour " + (d.cli || "") + " — " + facObj.totalTTC.toFixed(2) + "€ TTC");
      }
      if (finalize) { printFacture(facObj); }
      setMode("list");
      setSel({});
      setEditId(null);
    } catch(e) { alert("Erreur: " + e.message); }
    setSaving(false);
  };

  var deleteFacture = function(facId) {
    if (!confirm("Supprimer cette facture ?")) return;
    up(d.id, { factures: factures.filter(function(f) { return f.id !== facId; }) });
  };

  var printFacture = function(fac) {
    var w = window.open("", "", "width=800,height=1000");
    w.document.write(fac.html);
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 400);
  };

  var viewFacture = function(fac) {
    var w = window.open("", "", "width=800,height=1000");
    w.document.write(fac.html);
    w.document.close();
    w.focus();
  };

  // === RENDU ===
  if (mode === "list") {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC" }}>🧾 Factures ({factures.length})</h3>
          <button onClick={initCreate} style={S.b}>+ Nouvelle facture</button>
        </div>

        {factures.length === 0 && (
          <div style={{ ...S.c, padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🧾</div>
            <div style={{ color: "#64748B", fontSize: 12 }}>Aucune facture — créez-en une depuis les pièces</div>
          </div>
        )}

        {factures.map(function(fac) {
          return (
            <div key={fac.id} style={{ ...S.c, padding: 14, marginBottom: 8, animation: "fi .2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#F8FAFC" }}>{fac.num}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>
                    {(fac.date ? fac.date.split("-").reverse().join("/") : "") + " — " + (fac.client || "") + " — " + (fac.immat || "")}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#10B981", minWidth: 90, textAlign: "right" }}>
                  {fac.totalTTC.toFixed(2) + " €"}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={function() { viewFacture(fac); }} style={{ ...S.bg, padding: "6px 10px", fontSize: 11 }}>👁</button>
                  <button onClick={function() { printFacture(fac); }} style={{ ...S.bg, padding: "6px 10px", fontSize: 11 }}>🖨</button>
                  <button onClick={function() { initEdit(fac); }} style={{ ...S.bg, padding: "6px 10px", fontSize: 11 }}>✏️</button>
                  <button onClick={function() { deleteFacture(fac.id); }} style={{ ...S.bg, padding: "6px 10px", fontSize: 11, color: "#FCA5A5", borderColor: "rgba(239,68,68,0.2)" }}>🗑</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // MODE CREATE ou EDIT
  var displayLignes = mode === "edit" ? draftLignes : pcs;
  var isEdit = mode === "edit";

  return (
    <div>
      <button onClick={function() { setMode("list"); setSel({}); setEditId(null); }} style={{ ...S.bg, marginBottom: 12, fontSize: 11 }}>← Retour aux factures</button>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC", marginBottom: 12 }}>
        {isEdit ? "✏️ Modifier la facture" : "🧾 Nouvelle facture"}
      </h3>

      {/* Date + Adresse client */}
      <div style={{ ...S.c, padding: 14, marginBottom: 10, display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={S.l}>Date</div>
          <input type="date" value={draftDate} onChange={function(e) { setDraftDate(e.target.value); }} style={S.i} />
        </div>
        <div style={{ flex: 2 }}>
          <div style={S.l}>Adresse client</div>
          <input value={draftAdresse} onChange={function(e) { setDraftAdresse(e.target.value); }} placeholder="Adresse de facturation" style={S.i} />
        </div>
      </div>

      {/* Tableau des pieces */}
      <div style={{ ...S.c, padding: 14, marginBottom: 10 }}>
        <div style={{ ...S.l, marginBottom: 8 }}>{isEdit ? "LIGNES DE FACTURE" : "SÉLECTIONNER LES PIÈCES"}</div>
        {!isEdit && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={allSel}
              onChange={function() {
                if (allSel) { setSel({}); }
                else { var ns = {}; pcs.forEach(function(p) { ns[p.id || p.d] = true; }); setSel(ns); }
              }}
            />
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Tout sélectionner ({pcs.length} pièces)</span>
          </div>
        )}
        {displayLignes.length === 0 && (
          <div style={{ color: "#64748B", fontSize: 11, padding: 10 }}>Aucune pièce dans ce dossier</div>
        )}
        <div style={{ overflowX: "auto" }}>
          {displayLignes.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155" }}>
                  {!isEdit && <th style={{ padding: 6, width: 30 }} />}
                  <th style={{ padding: 6, fontSize: 9, color: "#94A3B8", textAlign: "left" }}>Réf.</th>
                  <th style={{ padding: 6, fontSize: 9, color: "#94A3B8", textAlign: "left" }}>Désignation</th>
                  <th style={{ padding: 6, fontSize: 9, color: "#94A3B8", textAlign: "center" }}>Qté</th>
                  <th style={{ padding: 6, fontSize: 9, color: "#94A3B8", textAlign: "right" }}>P.U. HT</th>
                  <th style={{ padding: 6, fontSize: 9, color: "#94A3B8", textAlign: "center", width: 70 }}>Remise %</th>
                  <th style={{ padding: 6, fontSize: 9, color: "#94A3B8", textAlign: "right" }}>Total HT</th>
                  {isEdit && <th style={{ padding: 6, width: 30 }} />}
                </tr>
              </thead>
              <tbody>
                {displayLignes.map(function(p, i) {
                  var key = p.id || p.d || i;
                  var checked = isEdit || sel[key];
                  var rem = remises[key] || 0;
                  var pu = p.pv || p.pu || 0;
                  var lineTotal = (p.q || 0) * pu * (1 - rem / 100);
                  return (
                    <tr key={key} style={{ borderBottom: "1px solid #1E293B", opacity: !isEdit && !checked ? 0.4 : 1 }}>
                      {!isEdit && (
                        <td style={{ padding: 6 }}>
                          <input type="checkbox" checked={!!sel[key]} onChange={function() { var ns = { ...sel }; ns[key] = !ns[key]; if (!ns[key]) delete ns[key]; setSel(ns); }} />
                        </td>
                      )}
                      <td style={{ padding: 6, fontSize: 11, color: "#94A3B8" }}>{p.ref || ""}</td>
                      <td style={{ padding: 6, fontSize: 11, color: "#E2E8F0" }}>{p.d || ""}</td>
                      {isEdit
                        ? (
                          <td style={{ padding: 6, textAlign: "center" }}>
                            <input type="number" value={p.q} min={1} onChange={function(e) {
                              var nl = [...draftLignes]; nl[i] = { ...nl[i], q: +e.target.value || 1 }; setDraftLignes(nl);
                            }} style={{ ...S.i, width: 50, textAlign: "center", padding: "4px" }} />
                          </td>
                        )
                        : <td style={{ padding: 6, textAlign: "center", fontSize: 11 }}>{p.q || 0}</td>
                      }
                      {isEdit
                        ? (
                          <td style={{ padding: 6, textAlign: "right" }}>
                            <input type="number" value={p.pu || p.pv} step="0.01" onChange={function(e) {
                              var nl = [...draftLignes]; nl[i] = { ...nl[i], pu: +e.target.value || 0, pv: +e.target.value || 0 }; setDraftLignes(nl);
                            }} style={{ ...S.i, width: 80, textAlign: "right", padding: "4px" }} />
                          </td>
                        )
                        : <td style={{ padding: 6, textAlign: "right", fontSize: 11 }}>{pu.toFixed(2) + " €"}</td>
                      }
                      <td style={{ padding: 6, textAlign: "center" }}>
                        <input type="number" value={rem} min={0} max={100} onChange={function(e) {
                          var nr = { ...remises }; nr[key] = Math.min(100, Math.max(0, +e.target.value || 0)); setRemises(nr);
                        }} style={{ ...S.i, width: 55, textAlign: "center", padding: "4px" }} />
                      </td>
                      <td style={{ padding: 6, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#F8FAFC" }}>{lineTotal.toFixed(2) + " €"}</td>
                      {isEdit && (
                        <td style={{ padding: 6 }}>
                          <button onClick={function() { var nl = draftLignes.filter(function(_, j) { return j !== i; }); setDraftLignes(nl); }} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}>×</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Remise globale */}
      <div style={{ ...S.c, padding: 14, marginBottom: 10 }}>
        <div style={{ ...S.l, marginBottom: 8 }}>REMISE GLOBALE (PIED DE FACTURE)</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={remiseGlobaleType} onChange={function(e) { setRemiseGlobaleType(e.target.value); setRemiseGlobale(0); }} style={{ ...S.i, width: 80 }}>
            <option value="pct">%</option>
            <option value="eur">€</option>
          </select>
          <input
            type="number"
            value={remiseGlobale}
            min={0}
            step={remiseGlobaleType === "pct" ? 1 : 0.01}
            onChange={function(e) { setRemiseGlobale(+e.target.value || 0); }}
            style={{ ...S.i, width: 100, textAlign: "right" }}
            placeholder={remiseGlobaleType === "pct" ? "0 %" : "0.00 €"}
          />
        </div>
      </div>

      {/* Recapitulatif */}
      <div style={{ ...S.c, padding: 14, marginBottom: 14 }}>
        <div style={{ ...S.l, marginBottom: 8 }}>RÉCAPITULATIF</div>
        {[
          ["Sous-total HT", totals.sousTotal.toFixed(2) + " €", "#E2E8F0"],
          totals.montantRemiseGlobale > 0 ? ["Remise globale", "-" + totals.montantRemiseGlobale.toFixed(2) + " €", "#EF4444"] : null,
          ["Total HT", totals.totalHT.toFixed(2) + " €", "#F8FAFC"],
          ["TVA 20 %", totals.tva.toFixed(2) + " €", "#94A3B8"],
          ["Total TTC", totals.totalTTC.toFixed(2) + " €", "#10B981"]
        ].filter(Boolean).map(function(r, i) {
          var isLast = r[0] === "Total TTC";
          return (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderTop: isLast ? "2px solid #334155" : "none",
              marginTop: isLast ? 6 : 0
            }}>
              <span style={{ fontSize: isLast ? 14 : 12, fontWeight: isLast ? 700 : 400, color: r[2] }}>{r[0]}</span>
              <span style={{ fontSize: isLast ? 16 : 12, fontWeight: 700, color: r[2] }}>{r[1]}</span>
            </div>
          );
        })}
      </div>

      {/* Boutons d'action */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={function() { saveFacture(false); }} disabled={saving} style={S.bg}>
          {saving ? "Enregistrement…" : "💾 Enregistrer brouillon"}
        </button>
        <button onClick={function() { saveFacture(true); }} disabled={saving} style={S.b}>
          {saving ? "Enregistrement…" : "🖨 Enregistrer & Imprimer"}
        </button>
        <button onClick={function() { setMode("list"); setSel({}); setEditId(null); }} style={{ ...S.bg, color: "#FCA5A5", borderColor: "rgba(239,68,68,0.2)" }}>Annuler</button>
      </div>
    </div>
  );
}

export default FactureTab;
