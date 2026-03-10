import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db, firebase } from '../firebase'
import { S } from '../styles/theme'
import { askPerplexity } from '../utils/api'
import { fmt, fd } from '../utils/helpers'
import { uid } from '../utils/helpers'
import { uploadBase64ToStorage, deleteFromStorage } from '../utils/storage'
import { botMsg } from '../utils/bot'

function RapportIA({ d, up, curUser }) {
  const [ld, sL] = useState(false);
  const [er, sE] = useState(null);
  const [rs, sR] = useState(null);
  const [ap, sA] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const ref = useRef(null);

  // Charger clé API depuis Firebase
  useEffect(function () {
    var unsub = db.collection("settings").doc("apiKey").onSnapshot(function (snap) {
      if (snap.exists) setApiKey(snap.data().key || "");
    }, function (err) {
      console.error(err);
    });
    return function () {
      unsub();
    };
  }, []);

  const saveKey = function (k) {
    setApiKey(k);
    db.collection("settings").doc("apiKey").set({ key: k });
  };

  const proc = async f => {
    if (!apiKey) {
      sE("Clé API requise — configurez-la ci-dessous.");
      setShowKey(true);
      return;
    }
    if (!f || !(f.type || "").includes("pdf")) {
      sE("Fichier PDF uniquement.");
      return;
    }
    sL(true);
    sE(null);
    sR(null);
    sA(false);
    try {
      const fullB64 = await new Promise((ok, ko) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = () => ko(new Error("Lecture impossible"));
        r.readAsDataURL(f);
      });
      const b = fullB64.split(",")[1];
      // Sauvegarder le PDF dans Firebase Storage
      var rapId = uid();
      var spath = "dossiers/" + d.id + "/rapports/" + rapId + "_" + f.name;
      var uploaded = await uploadBase64ToStorage(spath, fullB64);
      var rapports = d.rapports || [];
      rapports = [...rapports, {
        id: rapId,
        name: f.name,
        size: f.size,
        date: new Date().toISOString(),
        url: uploaded.url,
        storagePath: uploaded.storagePath
      }];
      up(d.id, { rapports: rapports });
      botMsg("general", "📄 Rapport d'expertise importé sur " + (d.cli || "") + " — " + (d.imm || "") + " (par " + curUser.nom + ")");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [{
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: b
              }
            }, {
              type: "text",
              text: 'Analyse ce rapport/procès-verbal d\'expertise automobile. Extrais TOUTES les informations. ATTENTION aux distinctions suivantes:\n- "cabinetExpertise": le NOM DE LA SOCIETE D\'EXPERTISE en haut à gauche du document (ex: ROADIA, BCA EXPERTISE, EUREXO, CREATIV EXPERTIZ, ALLIANCE EXPERTS, etc.), PAS le nom de la personne\n- "expert": le nom de la PERSONNE expert (ex: ROMAIN SCHAEFFER), souvent après "Vu par"\n- "assureur": la compagnie d\'assurance mandante (ex: GROUPAMA, MAAF, AXA), souvent après "Nom société" ou "MANDANT"\n- "client": le nom de l\'ASSURE/LESE (propriétaire du véhicule)\n- "reparateur": le garage réparateur\n- Pour les pièces: extrais chaque ligne avec son prix HT unitaire ET la quantité\n- TRES IMPORTANT pour la main d\'oeuvre, peinture et ingrédients:\n  * "heures" = le NOMBRE D\'HEURES (ex: 3.5, 2, 10.5). Souvent noté "Temps", "Nb heures", "H" dans le rapport. NE JAMAIS mettre 0 si une valeur existe.\n  * "tauxHoraire" = le TAUX HORAIRE unitaire en euros (ex: 55, 62, 45). Souvent noté "Taux", "T.H.", "€/h".\n  * "total" = heures × tauxHoraire = le montant total de la ligne. Fournis-le aussi pour vérification.\n  * EXEMPLE: si le rapport indique "Tôlerie: 3.5h à 55€/h = 192.50€" alors heures=3.5, tauxHoraire=55, total=192.50\n  * Si tu ne trouves que le total sans détail heures/taux, mets heures=1 et tauxHoraire=total\n- "montantTotal": le TOTAL HT final\n- "remisePieces": le pourcentage de remise sur pièces si indiqué\nJSON UNIQUEMENT sans backticks:\n{"client":"","adresseClient":"","telClient":"","numSinistre":"","dateSinistre":"","dateExpertise":"","vehicule":"","immat":"","numSerie":"","assureur":"","cabinetExpertise":"","expert":"","numRapport":"","franchise":0,"montantTotal":0,"montantTTC":0,"remisePieces":0,"pieces":[{"designation":"","reference":"","qte":1,"prixUnit":0}],"mainOeuvre":[{"designation":"","heures":0,"tauxHoraire":0,"total":0}],"peinture":[{"designation":"","heures":0,"tauxHoraire":0,"total":0}],"ingredients":[{"designation":"","heures":0,"tauxHoraire":0,"total":0}],"observations":"","pointChoc":"","intensite":""}'
            }]
          }]
        })
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Clé API invalide — vérifiez votre clé et votre facturation sur console.anthropic.com" : res.status === 429 ? "Trop de requêtes, réessayez" : "Erreur " + res.status);
      const data = await res.json();
      const txt = (data.content || []).map(i => i.text || "").join("").trim();
      sR(JSON.parse(txt.replace(/```json|```/g, "").trim()));
    } catch (e) {
      sE(e.message);
    }
    sL(false);
  };

  const apply = () => {
    if (!rs) return;
    const np = [];
    (rs.pieces || []).forEach(p => np.push({
      id: uid(),
      ref: p.reference || "",
      d: p.designation || "",
      q: p.qte || 1,
      pa: p.prixUnit || 0,
      pv: p.prixUnit || 0,
      f: ""
    }));
    var moLine = function(prefix, m) {
      var h = m.heures || 0;
      var t = m.tauxHoraire || 0;
      var tot = m.total || 0;
      // Si heures=0 mais total et taux existent, calculer heures
      if (!h && t > 0 && tot > 0) h = Math.round(tot / t * 100) / 100;
      // Si heures=0 mais total existe, mettre q=1 et pv=total
      if (!h && tot > 0) { h = 1; t = tot; }
      // Si heures=0 et pas de total, fallback q=1
      if (!h) h = 1;
      // Si taux=0 mais total et heures existent, calculer taux
      if (!t && h > 0 && tot > 0) t = Math.round(tot / h * 100) / 100;
      return { id: uid(), ref: "", d: prefix + m.designation, q: h, pa: t, pv: t, f: "" };
    };
    (rs.mainOeuvre || []).forEach(function(m) { np.push(moLine("MO Tôlerie ", m)); });
    (rs.peinture || []).forEach(function(p) { np.push(moLine("Peinture ", p)); });
    (rs.ingredients || []).forEach(function(p) { np.push(moLine("Ingr. ", p)); });
    const u = {};
    if (rs.client) u.cli = rs.client;
    if (rs.telClient) u.tel = rs.telClient;
    if (rs.vehicule) u.veh = rs.vehicule;
    if (rs.immat) u.imm = rs.immat;
    if (rs.assureur) u.ass = rs.assureur;
    if (rs.cabinetExpertise) u.exp = rs.cabinetExpertise;
    if (rs.numSinistre) u.num = rs.numSinistre;
    if (rs.franchise) u.fr = String(rs.franchise);
    if (rs.montantTotal) u.mt = String(rs.montantTotal);
    if (np.length) u.pcs = [...(d.pcs || []), ...np];
    up(d.id, u);
    sA(true);
  };

  // Générer OR PDF
  var generateOR = function () {
    if (!rs) return;
    var totalPieces = (rs.pieces || []).reduce(function (s, p) {
      return s + (p.qte || 1) * (p.prixUnit || 0);
    }, 0);
    var fixMoLine = function(m) {
      var h = m.heures || 0, t = m.tauxHoraire || 0, tot = m.total || 0;
      if (!h && t > 0 && tot > 0) h = Math.round(tot / t * 100) / 100;
      if (!h && tot > 0) { h = 1; t = tot; }
      if (!h) h = 1;
      if (!t && h > 0 && tot > 0) t = Math.round(tot / h * 100) / 100;
      return { h: h, t: t };
    };
    var totalMO = (rs.mainOeuvre || []).reduce(function (s, m) {
      var f = fixMoLine(m); return s + f.h * f.t;
    }, 0);
    var totalPeinture = (rs.peinture || []).reduce(function (s, p) {
      var f = fixMoLine(p); return s + f.h * f.t;
    }, 0);
    var totalIngr = (rs.ingredients || []).reduce(function (s, p) {
      var f = fixMoLine(p); return s + f.h * f.t;
    }, 0);
    var totalHT = rs.montantTotal || totalPieces + totalMO + totalPeinture + totalIngr;
    var tva = Math.round(totalHT * 0.2 * 100) / 100;
    var totalTTC = Math.round((totalHT + tva) * 100) / 100;
    var dateFR = new Date().toLocaleDateString("fr-FR");
    var rows = "";
    (rs.pieces || []).forEach(function (p) {
      var t = (p.qte || 1) * (p.prixUnit || 0);
      rows += "<tr><td style='padding:5px 8px;border-bottom:1px solid #EEE'>" + (p.reference || "") + "</td><td style='padding:5px 8px;border-bottom:1px solid #EEE'>" + p.designation + "</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:center'>" + (p.qte || 1) + "</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right'>" + (p.prixUnit || 0).toFixed(2) + "€</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right;font-weight:600'>" + t.toFixed(2) + "€</td></tr>";
    });
    (rs.mainOeuvre || []).forEach(function (m) {
      var f = fixMoLine(m);
      rows += "<tr style='background:#F0F9FF'><td style='padding:5px 8px;border-bottom:1px solid #EEE'></td><td style='padding:5px 8px;border-bottom:1px solid #EEE'>MO: " + m.designation + "</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:center'>" + f.h + "h</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right'>" + f.t.toFixed(2) + "€/h</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right;font-weight:600'>" + (f.h * f.t).toFixed(2) + "€</td></tr>";
    });
    (rs.peinture || []).forEach(function (p) {
      var f = fixMoLine(p);
      rows += "<tr style='background:#FFF7ED'><td style='padding:5px 8px;border-bottom:1px solid #EEE'></td><td style='padding:5px 8px;border-bottom:1px solid #EEE'>Peinture: " + p.designation + "</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:center'>" + f.h + "h</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right'>" + f.t.toFixed(2) + "€/h</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right;font-weight:600'>" + (f.h * f.t).toFixed(2) + "€</td></tr>";
    });
    (rs.ingredients || []).forEach(function (p) {
      var f = fixMoLine(p);
      rows += "<tr style='background:#F0FDF4'><td style='padding:5px 8px;border-bottom:1px solid #EEE'></td><td style='padding:5px 8px;border-bottom:1px solid #EEE'>Ingrédients: " + p.designation + "</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:center'>" + f.h + "h</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right'>" + f.t.toFixed(2) + "€/h</td><td style='padding:5px 8px;border-bottom:1px solid #EEE;text-align:right;font-weight:600'>" + (f.h * f.t).toFixed(2) + "€</td></tr>";
    });
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OR - ' + (rs.client || d.cli || "") + '</title><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}table{width:100%;border-collapse:collapse}th{background:#0070C0;color:#FFF;padding:6px 8px;text-align:left;font-size:10px}h2{color:#0070C0}</style></head><body>';
    html += '<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><strong style="font-size:16px">RAPIDE DEPANNAGE</strong><br>24 RUE SAINT ABDON<br>77390 GUIGNES France<br>Tel: 07.75.78.43.34<br>autocenter77@outlook.fr<br><small>SIRET 84483885400025 — RCS Melun B 844 838 854</small></div><div style="text-align:right"><h2 style="margin:0">ORDRE DE RÉPARATION</h2><br>N° : ' + (d.num || "___") + '<br>Date : ' + dateFR + '</div></div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px"><div style="border:1px solid #CCC;border-radius:6px;padding:12px"><strong style="color:#0070C0">CLIENT</strong><br><strong style="font-size:14px">' + (rs.client || d.cli || "") + '</strong><br>' + (rs.adresseClient || "") + '<br>Tél: ' + (rs.telClient || d.tel || "") + '</div>';
    html += '<div style="border:1px solid #CCC;border-radius:6px;padding:12px"><strong style="color:#0070C0">VÉHICULE</strong><br><strong style="font-size:14px">' + (rs.vehicule || d.veh || "") + '</strong><br>Immat: <strong>' + (rs.immat || d.imm || "") + '</strong><br>Assureur: ' + (rs.assureur || d.ass || "") + '<br>Cabinet expertise: ' + (rs.cabinetExpertise || "") + '<br>Expert: ' + (rs.expert || "") + '<br>N° sinistre: ' + (rs.numSinistre || d.num || "") + '</div></div>';
    html += '<table><thead><tr><th>Réf.</th><th>Désignation</th><th style="text-align:center">Qté</th><th style="text-align:right">P.U. HT</th><th style="text-align:right">Total HT</th></tr></thead><tbody>' + rows + '</tbody></table>';
    html += '<div style="margin-top:15px;text-align:right"><table style="width:250px;margin-left:auto"><tr><td style="padding:4px 8px">Total pièces HT</td><td style="padding:4px 8px;text-align:right;font-weight:600">' + totalPieces.toFixed(2) + '€</td></tr>';
    html += '<tr><td style="padding:4px 8px">Main d\'œuvre HT</td><td style="padding:4px 8px;text-align:right;font-weight:600">' + totalMO.toFixed(2) + '€</td></tr>';
    if (totalPeinture) html += '<tr><td style="padding:4px 8px">Peinture HT</td><td style="padding:4px 8px;text-align:right;font-weight:600">' + totalPeinture.toFixed(2) + '€</td></tr>';
    if (totalIngr) html += '<tr><td style="padding:4px 8px">Ingrédients HT</td><td style="padding:4px 8px;text-align:right;font-weight:600">' + totalIngr.toFixed(2) + '€</td></tr>';
    if (rs.remisePieces) html += '<tr><td style="padding:4px 8px;color:#E00">Remise pièces ' + rs.remisePieces + '%</td><td style="padding:4px 8px;text-align:right;color:#E00;font-weight:600">-' + (totalPieces * rs.remisePieces / 100).toFixed(2) + '€</td></tr>';
    html += '<tr style="border-top:2px solid #333"><td style="padding:6px 8px;font-weight:700;font-size:13px">TOTAL HT</td><td style="padding:6px 8px;text-align:right;font-weight:700;font-size:13px;color:#0070C0">' + totalHT.toFixed(2) + '€</td></tr>';
    html += '<tr><td style="padding:4px 8px">TVA 20%</td><td style="padding:4px 8px;text-align:right">' + tva.toFixed(2) + '€</td></tr>';
    html += '<tr style="background:#0070C0;color:#FFF"><td style="padding:8px;font-weight:700;font-size:14px">TOTAL TTC</td><td style="padding:8px;text-align:right;font-weight:700;font-size:14px">' + totalTTC.toFixed(2) + '€</td></tr>';
    if (rs.franchise) html += '<tr><td style="padding:4px 8px;color:#E00">Franchise</td><td style="padding:4px 8px;text-align:right;color:#E00;font-weight:600">' + rs.franchise + '€</td></tr>';
    html += '</table></div>';
    if (rs.observations) html += '<div style="margin-top:15px;border:1px solid #CCC;border-radius:6px;padding:10px"><strong style="color:#0070C0">Observations</strong><br>' + rs.observations + '</div>';
    html += '<div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:30px"><div style="border-top:1px solid #999;padding-top:8px">Signature de l\'entreprise</div><div style="border-top:1px solid #999;padding-top:8px">Signature du client</div></div>';
    html += '</body></html>';
    var w = window.open("", "", "width=800,height=1000");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () {
      w.print();
    }, 400);

    // Sauvegarder l'OR dans le dossier
    up(d.id, {
      orHtml: html,
      orDate: new Date().toISOString()
    });
    botMsg("general", "🤖 OR généré automatiquement pour " + (d.cli || "") + " — " + (d.imm || ""));
  };

  // === Sous-composant clé Perplexity (IIFE inliné dans le JSX original) ===
  function PerplexityKeySection() {
    const [pxKey, setPxKey] = useState("");
    const [showPx, setShowPx] = useState(false);
    useEffect(function() {
      var unsub = db.collection("settings").doc("perplexityKey").onSnapshot(function(snap) {
        if (snap.exists) setPxKey(snap.data().key || "");
      });
      return function() { unsub(); };
    }, []);
    var savePxKey = function(k) { setPxKey(k); db.collection("settings").doc("perplexityKey").set({ key: k }); };
    return (
      <div style={{ marginTop: 10 }}>
        <div
          onClick={function() { setShowPx(!showPx); }}
          style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "8px 12px", background: "#1E293B", borderRadius: 8, border: "1px solid #334155" }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: pxKey ? "#10B981" : "#F59E0B" }}>
            {pxKey ? "🔑 Perplexity configurée" : "⚙️ Configurer Perplexity"}
          </span>
          <span style={{ fontSize: 9, color: "#64748B", marginLeft: 4 }}>{showPx ? "▲" : "▼"}</span>
        </div>
        {showPx && (
          <div style={{ background: "#0F172A", borderRadius: 8, padding: "12px", border: "1px solid #334155", marginTop: 4 }}>
            <label style={S.l}>Clé API Perplexity (pplx-…)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="password" value={pxKey} onChange={function(e) { savePxKey(e.target.value); }} placeholder="pplx-..." style={{ ...S.i, flex: 1, fontFamily: "monospace", fontSize: 11 }} />
              {pxKey && (
                <button onClick={function() { savePxKey(""); }} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#FCA5A5", fontSize: 10, cursor: "pointer" }}>✕</button>
              )}
            </div>
            <p style={{ fontSize: 9, color: "#64748B", marginTop: 6 }}>Clé partagée — perplexity.ai/settings/api</p>
          </div>
        )}
      </div>
    );
  }

  // === Sous-composant clé TecDoc (IIFE inliné dans le JSX original) ===
  function TecDocKeySection() {
    const [tdKey, setTdKey] = useState("");
    const [showTd, setShowTd] = useState(false);
    useEffect(function() {
      var unsub = db.collection("settings").doc("tecdocKey").onSnapshot(function(snap) {
        if (snap.exists) setTdKey(snap.data().key || "");
      });
      return function() { unsub(); };
    }, []);
    var saveTdKey = function(k) { setTdKey(k); db.collection("settings").doc("tecdocKey").set({ key: k }); };
    return (
      <div style={{ marginTop: 10 }}>
        <div
          onClick={function() { setShowTd(!showTd); }}
          style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "8px 12px", background: "#1E293B", borderRadius: 8, border: "1px solid #334155" }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: tdKey ? "#10B981" : "#F59E0B" }}>
            {tdKey ? "🔑 TecDoc configurée" : "⚙️ Configurer TecDoc"}
          </span>
          <span style={{ fontSize: 9, color: "#64748B", marginLeft: 4 }}>{showTd ? "▲" : "▼"}</span>
        </div>
        {showTd && (
          <div style={{ background: "#0F172A", borderRadius: 8, padding: "12px", border: "1px solid #334155", marginTop: 4 }}>
            <label style={S.l}>Clé API TecDoc (RapidAPI)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="password" value={tdKey} onChange={function(e) { saveTdKey(e.target.value); }} placeholder="x-rapidapi-key..." style={{ ...S.i, flex: 1, fontFamily: "monospace", fontSize: 11 }} />
              {tdKey && (
                <button onClick={function() { saveTdKey(""); }} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#FCA5A5", fontSize: 10, cursor: "pointer" }}>✕</button>
              )}
            </div>
            <p style={{ fontSize: 9, color: "#64748B", marginTop: 6 }}>Clé RapidAPI — rapidapi.com/ronhartman/api/tecdoc-catalog</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {(d.rapports || []).length > 0 && (
        <div style={{ ...S.c, padding: "14px", marginBottom: 14 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: "#F59E0B" }}>
            📂 Rapports d'expertise sauvegardés ({(d.rapports || []).length})
          </h4>
          {(d.rapports || []).map(function (r, i) {
            return (
              <div
                key={r.id || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  marginBottom: 4,
                  background: "#0F172A",
                  borderRadius: 7,
                  border: "1px solid #334155"
                }}
              >
                <span style={{ fontSize: 20 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 11 }}>{r.name}</div>
                  <div style={{ fontSize: 9, color: "#94A3B8" }}>
                    {r.size ? Math.round(r.size / 1024) + "Ko" : ""} — {r.date ? new Date(r.date).toLocaleString("fr-FR") : ""}
                  </div>
                </div>
                <button
                  onClick={function () {
                    var a = document.createElement("a");
                    a.href = r.url || r.data;
                    a.download = r.name || "rapport.pdf";
                    a.target = "_blank";
                    a.click();
                  }}
                  style={S.b}
                >
                  ⬇ Télécharger
                </button>
                <button
                  onClick={function () {
                    window.open(r.url || r.data, "_blank");
                  }}
                  style={{ ...S.b, padding: "6px 10px" }}
                >
                  👁
                </button>
                <span
                  onClick={function () {
                    if (confirm("Supprimer ce rapport ?")) {
                      if (r.storagePath) deleteFromStorage(r.storagePath);
                      var nr = (d.rapports || []).filter(function (x) {
                        return x.id !== r.id;
                      });
                      up(d.id, { rapports: nr });
                    }
                  }}
                  style={{ color: "#EF4444", cursor: "pointer", fontSize: 12 }}
                >
                  ✕
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          proc(e.dataTransfer.files[0]);
        }}
        onClick={() => ref.current && ref.current.click()}
        style={{
          border: "2px dashed #475569",
          borderRadius: 12,
          padding: "40px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: "rgba(15,23,42,0.4)",
          marginBottom: 16
        }}
      >
        <input
          ref={ref}
          type="file"
          accept=".pdf"
          onChange={e => proc(e.target.files[0])}
          style={{ display: "none" }}
        />
        {ld ? (
          <div>
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid #334155",
                borderTop: "3px solid #F59E0B",
                borderRadius: "50%",
                margin: "0 auto 12px",
                animation: "sp 1s linear infinite"
              }}
            />
            <div style={{ fontWeight: 600, color: "#F59E0B" }}>🤖 Analyse en cours…</div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
              Extraction des informations client, pièces, chiffrage…
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Glissez le PDF d'expertise</div>
            <div style={{ fontSize: 11, color: "#94A3B8" }}>
              Audatex, GT Motive, Alpha Scale — Extraction automatique
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div
          onClick={() => setShowKey(!showKey)}
          style={{ cursor: "pointer", marginBottom: showKey ? 8 : 0 }}
        >
          <span style={{ fontSize: 10, color: apiKey ? "#10B981" : "#F59E0B", fontWeight: 600 }}>
            {apiKey ? "🔑 Clé configurée" : "⚙️ Configurer clé API"}
          </span>
          <span style={{ fontSize: 9, color: "#64748B", marginLeft: 4 }}>
            {showKey ? "▲" : "▼"}
          </span>
        </div>
        {showKey && (
          <div style={{ background: "#0F172A", borderRadius: 8, padding: "12px", border: "1px solid #334155" }}>
            <label style={S.l}>Clé API Anthropic (sk-ant-…)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="password"
                value={apiKey}
                onChange={e => saveKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                style={{ ...S.i, flex: 1, fontFamily: "monospace", fontSize: 11 }}
              />
              {apiKey && (
                <button
                  onClick={() => saveKey("")}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 6,
                    color: "#FCA5A5",
                    fontSize: 10,
                    cursor: "pointer"
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <p style={{ fontSize: 9, color: "#64748B", marginTop: 6 }}>
              Clé partagée entre tous les postes — console.anthropic.com
            </p>
          </div>
        )}

        <PerplexityKeySection />
        <TecDocKeySection />
      </div>

      {er && (
        <div
          style={{
            background: "rgba(239,68,68,0.07)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#FCA5A5",
            fontSize: 11,
            marginBottom: 12
          }}
        >
          ❌ {er}
        </div>
      )}

      {rs && (
        <div style={{ ...S.c, padding: "18px", animation: "fi .3s" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 8
            }}
          >
            <h3 style={{ fontWeight: 700 }}>🤖 Résultat de l'analyse</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={generateOR}
                style={{
                  padding: "8px 14px",
                  background: "linear-gradient(135deg,#8B5CF6,#7C3AED)",
                  color: "#FFF",
                  border: "none",
                  borderRadius: 7,
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: "pointer"
                }}
              >
                📄 Générer OR
              </button>
              <button
                onClick={apply}
                disabled={ap}
                style={{
                  ...S.b,
                  background: ap ? "#10B981" : "linear-gradient(135deg,#F59E0B,#D97706)",
                  color: ap ? "#FFF" : "#0F172A"
                }}
              >
                {ap ? "✓ Appliqué" : "Appliquer au dossier"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "#0F172A", borderRadius: 8, padding: "10px", border: "1px solid #334155" }}>
              <div style={{ fontSize: 9, color: "#F59E0B", fontWeight: 700, marginBottom: 6 }}>👤 CLIENT</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{rs.client || "—"}</div>
              {rs.adresseClient && (
                <div style={{ fontSize: 10, color: "#94A3B8" }}>{rs.adresseClient}</div>
              )}
              {rs.telClient && (
                <div style={{ fontSize: 10, color: "#06B6D4" }}>📞 {rs.telClient}</div>
              )}
            </div>
            <div style={{ background: "#0F172A", borderRadius: 8, padding: "10px", border: "1px solid #334155" }}>
              <div style={{ fontSize: 9, color: "#F59E0B", fontWeight: 700, marginBottom: 6 }}>🚗 VÉHICULE</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{rs.vehicule || "—"}</div>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "#F8FAFC" }}>{rs.immat || "—"}</div>
              {rs.numSerie && (
                <div style={{ fontSize: 9, color: "#64748B" }}>N° série: {rs.numSerie}</div>
              )}
              <div style={{ fontSize: 10, color: "#3B82F6", marginTop: 4 }}>🏢 {rs.assureur || "—"}</div>
              <div style={{ fontSize: 10, color: "#F59E0B" }}>🔍 Cabinet: {rs.cabinetExpertise || "—"}</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>👤 Expert: {rs.expert || "—"}</div>
              {rs.numSinistre && (
                <div style={{ fontSize: 10, color: "#64748B" }}>N° sinistre: {rs.numSinistre}</div>
              )}
              {rs.numRapport && (
                <div style={{ fontSize: 10, color: "#64748B" }}>N° rapport: {rs.numRapport}</div>
              )}
              {rs.pointChoc && (
                <div style={{ fontSize: 10, color: "#EF4444" }}>💥 {rs.pointChoc} — {rs.intensite || ""}</div>
              )}
            </div>
          </div>

          {(rs.pieces || []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#F97316", marginBottom: 4 }}>🔩 PIÈCES</div>
              {(rs.pieces || []).map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    background: "#0F172A",
                    marginBottom: 1,
                    borderRadius: 3,
                    fontSize: 10
                  }}
                >
                  <span>
                    {p.reference ? <span style={{ color: "#64748B" }}>[{p.reference}] </span> : ""}
                    {p.designation} x{p.qte || 1}
                  </span>
                  <span style={{ color: "#F59E0B", fontFamily: "monospace", fontWeight: 600 }}>
                    {((p.qte || 1) * (p.prixUnit || 0)).toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          )}

          {(rs.mainOeuvre || []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6", marginBottom: 4 }}>🔧 MAIN D'ŒUVRE</div>
              {(rs.mainOeuvre || []).map((m, i) => {
                var h = m.heures || 0, t = m.tauxHoraire || 0, tot = m.total || 0;
                if (!h && t > 0 && tot > 0) h = Math.round(tot / t * 100) / 100;
                if (!h && tot > 0) { h = 1; t = tot; }
                if (!h) h = 1;
                if (!t && h > 0 && tot > 0) t = Math.round(tot / h * 100) / 100;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      background: "#0F172A",
                      marginBottom: 1,
                      borderRadius: 3,
                      fontSize: 10
                    }}
                  >
                    <span>{m.designation} — {h}h x {t}€/h</span>
                    <span style={{ color: "#3B82F6", fontFamily: "monospace", fontWeight: 600 }}>
                      {(h * t).toFixed(2)}€
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {(rs.peinture || []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#A855F7", marginBottom: 4 }}>🎨 PEINTURE</div>
              {(rs.peinture || []).map((p, i) => {
                var h = p.heures || 0, t = p.tauxHoraire || 0, tot = p.total || 0;
                if (!h && t > 0 && tot > 0) h = Math.round(tot / t * 100) / 100;
                if (!h && tot > 0) { h = 1; t = tot; }
                if (!h) h = 1;
                if (!t && h > 0 && tot > 0) t = Math.round(tot / h * 100) / 100;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      background: "#0F172A",
                      marginBottom: 1,
                      borderRadius: 3,
                      fontSize: 10
                    }}
                  >
                    <span>{p.designation} — {h}h x {t}€/h</span>
                    <span style={{ color: "#A855F7", fontFamily: "monospace", fontWeight: 600 }}>
                      {(h * t).toFixed(2)}€
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {(rs.ingredients || []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#10B981", marginBottom: 4 }}>🧪 INGRÉDIENTS</div>
              {(rs.ingredients || []).map((p, i) => {
                var h = p.heures || 0, t = p.tauxHoraire || 0, tot = p.total || 0;
                if (!h && t > 0 && tot > 0) h = Math.round(tot / t * 100) / 100;
                if (!h && tot > 0) { h = 1; t = tot; }
                if (!h) h = 1;
                if (!t && h > 0 && tot > 0) t = Math.round(tot / h * 100) / 100;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 8px",
                      background: "#0F172A",
                      marginBottom: 1,
                      borderRadius: 3,
                      fontSize: 10
                    }}
                  >
                    <span>{p.designation} — {h}h x {t}€/h</span>
                    <span style={{ color: "#10B981", fontFamily: "monospace", fontWeight: 600 }}>
                      {(h * t).toFixed(2)}€
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {rs.remisePieces > 0 && (
            <div
              style={{
                background: "rgba(239,68,68,0.05)",
                borderRadius: 6,
                padding: "6px 10px",
                marginBottom: 10,
                border: "1px solid rgba(239,68,68,0.15)"
              }}
            >
              <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 600 }}>
                📉 Remise pièces: {rs.remisePieces}%
              </span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
            {[
              ["TOTAL HT", rs.montantTotal, "#F97316"],
              ["TVA 20%", rs.montantTotal ? Math.round(rs.montantTotal * 0.2 * 100) / 100 : null, "#94A3B8"],
              ["TOTAL TTC", rs.montantTTC || (rs.montantTotal ? Math.round(rs.montantTotal * 1.2 * 100) / 100 : null), "#0078D4"],
              ["FRANCHISE", rs.franchise, "#EF4444"]
            ].map(([l, v, c], i) => (
              <div
                key={i}
                style={{
                  background: c + "0A",
                  borderRadius: 7,
                  padding: "8px",
                  textAlign: "center",
                  border: "1px solid " + c + "20"
                }}
              >
                <div style={{ fontSize: 8, color: "#94A3B8" }}>{l}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: c, fontFamily: "monospace" }}>
                  {v != null ? (v.toFixed ? v.toFixed(2) + "€" : v + "€") : "—"}
                </div>
              </div>
            ))}
          </div>

          {rs.observations && (
            <div
              style={{
                marginTop: 10,
                background: "#0F172A",
                borderRadius: 6,
                padding: "8px 10px",
                border: "1px solid #334155"
              }}
            >
              <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600 }}>OBSERVATIONS</div>
              <div style={{ fontSize: 11 }}>{rs.observations}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RapportIA;
