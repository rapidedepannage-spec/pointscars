import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { fmt } from '../utils/helpers';
import { uploadToStorage, uploadBase64ToStorage, deleteFromStorage } from '../utils/storage';
import { searchTecDoc } from '../utils/api';

function PiecesTab({ d, up, curUser }) {
  // === MODE FACTURE ===
  const [modeFac, setModeFac] = useState("pieces"); // "pieces" | "facture" | "editFac" | "listFac"
  const [facRemises, setFacRemises] = useState({});
  const [facRemiseGlobale, setFacRemiseGlobale] = useState(0);
  const [facRemiseType, setFacRemiseType] = useState("pct");
  const [facDate, setFacDate] = useState(new Date().toISOString().slice(0, 10));
  const [facAdresse, setFacAdresse] = useState("");
  const [facSaving, setFacSaving] = useState(false);
  const [facEditId, setFacEditId] = useState(null);
  const [facEditLignes, setFacEditLignes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [tecdocSearching, setTecdocSearching] = useState(false);
  const [tecdocResults, setTecdocResults] = useState(null);

  // Migration anciennes pièces
  var initPcs = (d.pcs || []).map(function (piece) {
    var out = { ...piece };
    if (out.pv === undefined || out.pv === null) out.pv = out.p || 0;
    if (out.pa === undefined || out.pa === null) out.pa = out.p || 0;
    return out;
  });

  // Brouillon local — rien ne part Firebase tant qu'on clique pas Appliquer
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(initPcs)));
  const [saved, setSaved] = useState(true);
  const [ad, sA] = useState(false);
  const [np, sN] = useState({
    ref: "",
    d: "",
    q: 1,
    pv: 0,
    pa: 0,
    f: ""
  });
  const [sel, setSel] = useState({});

  // Sync quand Firebase change ET qu'on n'a pas de modifs en cours
  useEffect(function () {
    if (saved) {
      var fresh = (d.pcs || []).map(function (piece) {
        var out = { ...piece };
        if (out.pv === undefined || out.pv === null) out.pv = out.p || 0;
        if (out.pa === undefined || out.pa === null) out.pa = out.p || 0;
        return out;
      });
      setDraft(JSON.parse(JSON.stringify(fresh)));
    }
  }, [d.pcs]);

  // Calculs sur le brouillon
  var totalChiffrage = draft.reduce(function (a, p) {
    return a + (p.q || 0) * (p.pv || 0);
  }, 0);
  var totalAchat = draft.reduce(function (a, p) {
    return a + (p.q || 0) * (p.pa || 0);
  }, 0);
  var margeEuro = totalChiffrage - totalAchat;
  var margePct = totalChiffrage > 0 ? Math.round(margeEuro / totalChiffrage * 100) : null;
  var margeColor = margePct === null ? "#8B5CF6" : margePct < 45 ? "#EF4444" : margePct <= 55 ? "#F97316" : margePct <= 60 ? "#EAB308" : "#10B981";

  // Modifier le brouillon (PAS Firebase)
  var updateDraft = function (newPcs) {
    setDraft(newPcs);
    setSaved(false);
  };

  // Sauvegarder dans Firebase
  var appliquer = function () {
    var chiff = draft.reduce(function (a, p) {
      return a + (p.q || 0) * (p.pv || 0);
    }, 0);
    up(d.id, {
      pcs: draft,
      mt: String(Math.round(chiff * 100) / 100)
    });
    setSaved(true);
  };

  // Annuler les modifs
  var annuler = function () {
    var fresh = (d.pcs || []).map(function (piece) {
      var out = { ...piece };
      if (out.pv === undefined || out.pv === null) out.pv = out.p || 0;
      if (out.pa === undefined || out.pa === null) out.pa = out.p || 0;
      return out;
    });
    setDraft(JSON.parse(JSON.stringify(fresh)));
    setSaved(true);
  };

  return (
    <div>
      {!saved && (
        <div
          style={{
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 8,
            padding: "8px 14px",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fi .2s"
          }}
        >
          <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>
            ⚠️ Modifications non enregistrées
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={annuler}
              style={{
                padding: "5px 12px",
                background: "rgba(239,68,68,0.15)",
                border: "none",
                borderRadius: 6,
                color: "#FCA5A5",
                fontSize: 10,
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              ✕ Annuler
            </button>
            <button
              onClick={appliquer}
              style={{
                padding: "5px 14px",
                background: "linear-gradient(135deg,#10B981,#059669)",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontSize: 10,
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              ✓ Appliquer
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 9
        }}
      >
        <p style={{ color: "#94A3B8", fontSize: 11 }}>
          {draft.length} ligne{draft.length > 1 ? "s" : ""}
        </p>
        <button onClick={() => sA(!ad)} style={S.b}>
          {ad ? "✕" : "+ Ajouter"}
        </button>
      </div>

      {ad && (
        <div style={{ ...S.c, padding: "12px", marginBottom: 10 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 50px 75px 75px 90px",
              gap: 6,
              alignItems: "end"
            }}
          >
            <div>
              <label style={S.l}>Réf</label>
              <input
                style={S.i}
                value={np.ref}
                onChange={(e) => sN({ ...np, ref: e.target.value })}
              />
            </div>
            <div>
              <label style={S.l}>Désignation*</label>
              <input
                style={S.i}
                value={np.d}
                onChange={(e) => sN({ ...np, d: e.target.value })}
              />
            </div>
            <div>
              <label style={S.l}>Qté</label>
              <input
                type="number"
                style={S.i}
                value={np.q}
                onChange={(e) => sN({ ...np, q: +e.target.value || 0 })}
              />
            </div>
            <div>
              <label style={{ ...S.l, color: "#10B981" }}>Chiffrage €</label>
              <input
                type="number"
                style={S.i}
                value={np.pv}
                onChange={(e) => sN({ ...np, pv: +e.target.value || 0 })}
              />
            </div>
            <div>
              <label style={{ ...S.l, color: "#F97316" }}>Px Achat €</label>
              <input
                type="number"
                style={S.i}
                value={np.pa}
                onChange={(e) => sN({ ...np, pa: +e.target.value || 0 })}
              />
            </div>
            <div>
              <label style={S.l}>Fourn.</label>
              <input
                style={S.i}
                value={np.f}
                onChange={(e) => sN({ ...np, f: e.target.value })}
              />
            </div>
          </div>
          <div style={{ textAlign: "right", marginTop: 7 }}>
            <button
              onClick={function () {
                if (!np.d) return;
                updateDraft([...draft, { ...np, id: uid() }]);
                sN({ ref: "", d: "", q: 1, pv: 0, pa: 0, f: "" });
                sA(false);
              }}
              style={S.b}
            >
              ✓ Ajouter
            </button>
          </div>
        </div>
      )}

      <div style={{ ...S.c, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 11,
            minWidth: 650
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid #334155" }}>
              <th style={{ padding: "8px", width: 30 }}>
                <input
                  type="checkbox"
                  checked={
                    draft.length > 0 &&
                    draft.every(function (p) {
                      return sel[p.id || p.d];
                    })
                  }
                  onChange={function (e) {
                    var ns = {};
                    if (e.target.checked)
                      draft.forEach(function (p) {
                        ns[p.id || p.d] = true;
                      });
                    setSel(ns);
                  }}
                />
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "left",
                  color: "#94A3B8",
                  fontSize: 9
                }}
              >
                Réf
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "left",
                  color: "#94A3B8",
                  fontSize: 9
                }}
              >
                Désignation
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "center",
                  color: "#94A3B8",
                  fontSize: 9
                }}
              >
                Qté
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  color: "#10B981",
                  fontSize: 9
                }}
              >
                Chiffrage
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  color: "#F97316",
                  fontSize: 9
                }}
              >
                Px Achat
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  color: "#8B5CF6",
                  fontSize: 9
                }}
              >
                Marge
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "left",
                  color: "#94A3B8",
                  fontSize: 9
                }}
              >
                Fourn
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  color: "#F8FAFC",
                  fontSize: 9
                }}
              >
                Total
              </th>
              <th style={{ padding: "8px", fontSize: 9 }} />
            </tr>
          </thead>
          <tbody>
            {draft.map(function (p, i) {
              var chL = (p.q || 0) * (p.pv || 0);
              var acL = (p.q || 0) * (p.pa || 0);
              var mgL = chL - acL;
              var mpL = chL > 0 ? Math.round(mgL / chL * 100) : 0;
              var mc =
                acL === 0
                  ? "#64748B"
                  : mpL < 45
                  ? "#EF4444"
                  : mpL <= 55
                  ? "#F97316"
                  : mpL <= 60
                  ? "#EAB308"
                  : "#10B981";
              return (
                <tr
                  key={p.id || i}
                  style={{
                    borderBottom: "1px solid #33415525",
                    background: i % 2 ? "#172033" : "#1E293B"
                  }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="checkbox"
                      checked={!!sel[p.id || p.d]}
                      onChange={function () {
                        var ns = { ...sel };
                        if (ns[p.id || p.d]) delete ns[p.id || p.d];
                        else ns[p.id || p.d] = true;
                        setSel(ns);
                      }}
                    />
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: "#94A3B8"
                    }}
                  >
                    {p.ref || "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontWeight: 500 }}>
                    {p.d}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="number"
                      value={p.q}
                      onChange={function (e) {
                        updateDraft(
                          draft.map(function (x, j) {
                            return j === i
                              ? { ...x, q: +e.target.value || 0 }
                              : x;
                          })
                        );
                      }}
                      style={{
                        ...S.i,
                        width: 45,
                        padding: "3px",
                        textAlign: "center"
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="number"
                      value={p.pv || 0}
                      onChange={function (e) {
                        updateDraft(
                          draft.map(function (x, j) {
                            return j === i
                              ? { ...x, pv: +e.target.value || 0 }
                              : x;
                          })
                        );
                      }}
                      style={{
                        ...S.i,
                        width: 70,
                        padding: "3px",
                        textAlign: "right",
                        borderColor: "#10B98140"
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="number"
                      value={p.pa || 0}
                      onChange={function (e) {
                        updateDraft(
                          draft.map(function (x, j) {
                            return j === i
                              ? { ...x, pa: +e.target.value || 0 }
                              : x;
                          })
                        );
                      }}
                      style={{
                        ...S.i,
                        width: 70,
                        padding: "3px",
                        textAlign: "right",
                        borderColor: "#F9731640"
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {acL > 0 ? (
                      <span>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: mc,
                            fontSize: 10
                          }}
                        >
                          {mgL.toFixed(2)}€
                        </span>
                        <br />
                        <span
                          style={{
                            fontSize: 8,
                            color: mc,
                            fontWeight: 700
                          }}
                        >
                          {mpL}%
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "#64748B", fontSize: 9 }}>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "#94A3B8",
                      fontSize: 10
                    }}
                  >
                    {p.f || "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: 12,
                      color: "#F8FAFC"
                    }}
                  >
                    {chL.toFixed(2)}€
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <span
                      onClick={function () {
                        updateDraft(
                          draft.filter(function (x, j) {
                            return j !== i;
                          })
                        );
                      }}
                      style={{ color: "#EF4444", cursor: "pointer" }}
                    >
                      ✕
                    </span>
                  </td>
                </tr>
              );
            })}
            {!draft.length && (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: 26,
                    textAlign: "center",
                    color: "#64748B"
                  }}
                >
                  Aucune pièce
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 9,
          marginTop: 10
        }}
      >
        <div
          style={{
            background: "#10B9810A",
            borderRadius: 9,
            padding: "12px",
            textAlign: "center",
            border: "1px solid #10B98130"
          }}
        >
          <div style={{ fontSize: 8, color: "#94A3B8" }}>CHIFFRAGE</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#10B981",
              fontFamily: "monospace"
            }}
          >
            {totalChiffrage.toFixed(2)}€
          </div>
        </div>
        <div
          style={{
            background: "#F976160A",
            borderRadius: 9,
            padding: "12px",
            textAlign: "center",
            border: "1px solid #F9761630"
          }}
        >
          <div style={{ fontSize: 8, color: "#94A3B8" }}>PRIX D'ACHAT</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#F97316",
              fontFamily: "monospace"
            }}
          >
            {totalAchat.toFixed(2)}€
          </div>
        </div>
        <div
          style={{
            background: margeColor + "0A",
            borderRadius: 9,
            padding: "12px",
            textAlign: "center",
            border: "1px solid " + margeColor + "30"
          }}
        >
          <div style={{ fontSize: 8, color: "#94A3B8" }}>MARGE</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: margeColor,
              fontFamily: "monospace"
            }}
          >
            {margeEuro.toFixed(2)}€
          </div>
          {margePct !== null && (
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: margeColor,
                marginTop: 2
              }}
            >
              {margePct}%
            </div>
          )}
        </div>
      </div>

      {!saved && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            onClick={appliquer}
            style={{
              padding: "10px 30px",
              background: "linear-gradient(135deg,#10B981,#059669)",
              border: "none",
              borderRadius: 8,
              color: "white",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            ✓ Appliquer les modifications
          </button>
        </div>
      )}

      {draft.length > 0 &&
        (function () {
          var selPieces = draft.filter(function (p) {
            return sel[p.id || p.d];
          });
          var piecesToSend = selPieces.length > 0 ? selPieces : draft;
          var count = piecesToSend.length;
          var isAll = selPieces.length === 0;
          var commandeWhatsApp = function () {
            var lines = piecesToSend.map(function (p) {
              return (
                "- " + p.q + "x " + p.d + (p.ref ? " (réf: " + p.ref + ")" : "")
              );
            });
            var msg =
              "Bonjour, commande Point S Guignes\n" +
              "Client : " +
              (d.cli || "") +
              "\n" +
              "Véhicule : " +
              (d.veh || "") +
              " — Immat : " +
              (d.imm || "") +
              "\n\n" +
              "Pièces :\n" +
              lines.join("\n") +
              "\n\n" +
              "Merci de confirmer disponibilité et délai. Cordialement.";
            var phone = "33763016822";
            var url =
              "https://wa.me/" + phone + "?text=" + encodeURIComponent(msg);
            window.open(url, "_blank");
          };
          return (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                onClick={commandeWhatsApp}
                style={{
                  padding: "12px 28px",
                  background: "linear-gradient(135deg,#25D366,#128C7E)",
                  border: "none",
                  borderRadius: 10,
                  color: "white",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <span style={{ fontSize: 18 }}>📱</span> Commander{" "}
                {isAll ? "toutes les" : "" + count} pièce
                {count > 1 ? "s" : ""} via WhatsApp
              </button>
              {isAll && (
                <div
                  style={{ fontSize: 9, color: "#64748B", marginTop: 4 }}
                >
                  💡 Cochez des pièces pour envoyer une sélection
                </div>
              )}
            </div>
          );
        })()}

      {/* === BOUTON FACTURER === */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 12,
          flexWrap: "wrap"
        }}
      >
        {draft.filter(function (p) {
          return sel[p.id || p.d];
        }).length > 0 && (
          <button
            onClick={function () {
              setFacRemises({});
              setFacRemiseGlobale(0);
              setFacRemiseType("pct");
              setFacDate(new Date().toISOString().slice(0, 10));
              setFacAdresse("");
              setModeFac("facture");
            }}
            style={{
              padding: "12px 28px",
              background: "linear-gradient(135deg,#3B82F6,#1D4ED8)",
              border: "none",
              borderRadius: 10,
              color: "white",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}
          >
            🧾 Facturer{" "}
            {
              draft.filter(function (p) {
                return sel[p.id || p.d];
              }).length
            }{" "}
            pièce(s)
          </button>
        )}
        <button
          onClick={function () {
            setModeFac("listFac");
          }}
          style={{
            padding: "12px 28px",
            background: "rgba(139,92,246,0.1)",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: 10,
            color: "#A78BFA",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          🧾 Factures ({(d.factures || []).length})
        </button>
        {/* Bouton recherche pièce Perplexity */}
        {draft.filter(function (p) {
          return sel[p.id || p.d];
        }).length > 0 && (
          <button
            onClick={async function () {
              setSearching(true);
              setSearchResult(null);
              try {
                var selPcs = draft.filter(function (p) {
                  return sel[p.id || p.d];
                });
                var vehicule = (d.veh || "inconnu") + " " + (d.imm || "");
                var query =
                  "Véhicule : " +
                  vehicule.trim() +
                  "\n\nTrouve ces pièces détachées en ligne :\n";
                selPcs.forEach(function (p) {
                  query +=
                    "- Référence : " +
                    (p.ref || "non renseignée") +
                    " — " +
                    p.d +
                    "\n";
                });
                query +=
                  "\nPour chaque pièce, recherche avec le numéro de référence et le modèle du véhicule. Cherche EN PRIORITÉ sur le site piecescarrosseriepaschère.com (pieces carrosserie pas cher), puis aussi sur les autres sites de vente en ligne. Donne les résultats trouvés avec : le nom du site, le prix, et le lien URL complet vers la page du produit. Classe par prix croissant. Réponds en français.";
                var result = await askPerplexity(
                  "Tu es un assistant spécialisé en recherche de pièces détachées automobiles sur internet. Quand on te donne une référence de pièce et un véhicule, tu cherches cette pièce sur les sites de vente en ligne. Tu dois TOUJOURS inclure le site piecescarrosseriepaschère.com (pieces carrosserie pas cher) dans tes recherches en priorité, en plus des autres sites habituels. Tu donnes TOUJOURS les URLs complètes des pages produit que tu trouves. Formate chaque résultat clairement avec le nom du site, le prix et l'URL.",
                  query
                );
                setSearchResult(result);
              } catch (e) {
                setSearchResult("Erreur : " + e.message);
              }
              setSearching(false);
            }}
            disabled={searching}
            style={{
              padding: "12px 28px",
              background: "linear-gradient(135deg,#8B5CF6,#6D28D9)",
              border: "none",
              borderRadius: 10,
              color: "white",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: searching ? 0.6 : 1
            }}
          >
            {searching
              ? "⏳ Recherche en cours…"
              : "🔍 Rechercher pièce (" +
                draft.filter(function (p) {
                  return sel[p.id || p.d];
                }).length +
                ")"}
          </button>
        )}
      </div>

      {/* Bouton recherche TecDoc */}
      {draft.filter(function (p) {
        return sel[p.id || p.d];
      }).length > 0 && (
        <button
          onClick={async function () {
            setTecdocSearching(true);
            setTecdocResults(null);
            try {
              var selPcs = draft.filter(function (p) {
                return sel[p.id || p.d];
              });
              var results = [];
              for (var i = 0; i < selPcs.length; i++) {
                var p = selPcs[i];
                var ref = (p.ref || "").trim();
                if (!ref) {
                  results.push({
                    piece: p.d,
                    ref: ref,
                    error: "Pas de référence renseignée",
                    articles: []
                  });
                  continue;
                }
                if (i > 0)
                  await new Promise(function (r) {
                    setTimeout(r, 1500);
                  });
                try {
                  var data = await searchTecDoc(ref);
                  results.push({
                    piece: p.d,
                    ref: ref,
                    articles: data.articles || [],
                    count: data.countArticles || 0
                  });
                } catch (err) {
                  if (err.message.includes("429")) {
                    await new Promise(function (r) {
                      setTimeout(r, 3000);
                    });
                    try {
                      var data2 = await searchTecDoc(ref);
                      results.push({
                        piece: p.d,
                        ref: ref,
                        articles: data2.articles || [],
                        count: data2.countArticles || 0
                      });
                    } catch (err2) {
                      results.push({
                        piece: p.d,
                        ref: ref,
                        error: err2.message,
                        articles: []
                      });
                    }
                  } else {
                    results.push({
                      piece: p.d,
                      ref: ref,
                      error: err.message,
                      articles: []
                    });
                  }
                }
              }
              setTecdocResults(results);
            } catch (e) {
              setTecdocResults([
                { piece: "Erreur", ref: "", error: e.message, articles: [] }
              ]);
            }
            setTecdocSearching(false);
          }}
          disabled={tecdocSearching}
          style={{
            padding: "12px 28px",
            background: "linear-gradient(135deg,#10B981,#059669)",
            border: "none",
            borderRadius: 10,
            color: "white",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            opacity: tecdocSearching ? 0.6 : 1
          }}
        >
          {tecdocSearching
            ? "⏳ TecDoc en cours…"
            : "🔧 TecDoc (" +
              draft.filter(function (p) {
                return sel[p.id || p.d];
              }).length +
              ")"}
        </button>
      )}

      {/* Résultats TecDoc — cliquables pour intégrer */}
      {tecdocResults && (
        <div
          style={{
            ...S.c,
            padding: 16,
            marginTop: 12,
            border: "1px solid rgba(16,185,129,0.3)",
            animation: "fi .2s"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12
            }}
          >
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>
              🔧 Résultats TecDoc
            </h3>
            <button
              onClick={function () {
                setTecdocResults(null);
              }}
              style={{ ...S.bg, padding: "4px 10px", fontSize: 10 }}
            >
              ✕
            </button>
          </div>
          {tecdocResults.map(function (r, idx) {
            return (
              <div
                key={idx}
                style={{
                  marginBottom: 14,
                  padding: 12,
                  background: "rgba(16,185,129,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(16,185,129,0.15)"
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#E2E8F0",
                    marginBottom: 6
                  }}
                >
                  📦 {r.piece}
                  {r.ref ? " — Réf: " + r.ref : ""}
                </div>
                {r.error ? (
                  <div style={{ fontSize: 11, color: "#FCA5A5" }}>
                    ⚠️ {r.error}
                  </div>
                ) : r.articles.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    Aucun résultat TecDoc pour cette référence
                  </div>
                ) : (
                  r.articles.map(function (art, aidx) {
                    return (
                      <div
                        key={aidx}
                        onClick={function () {
                          // Vérifier si déjà ajoutée (anti-doublon)
                          var refClean = (art.articleNo || "").replace(
                            /\s+/g,
                            ""
                          );
                          var existe = draft.some(function (p) {
                            return (
                              (p.ref || "").replace(/\s+/g, "") === refClean &&
                              p.source === "tecdoc"
                            );
                          });
                          if (existe) {
                            alert("Cette pièce TecDoc est déjà dans la liste !");
                            return;
                          }
                          // Ajouter la pièce TecDoc au brouillon
                          var newPiece = {
                            id: "td_" + Date.now() + "_" + aidx,
                            d: art.articleProductName || "Pièce TecDoc",
                            ref: art.articleNo || "",
                            q: 1,
                            pu: 0,
                            f: art.supplierName || "TecDoc",
                            tecdocId: art.articleId,
                            source: "tecdoc"
                          };
                          var newDraft = [].concat(draft, [newPiece]);
                          setDraft(newDraft);
                          up(d.id, { pcs: newDraft });
                          alert(
                            "✅ " +
                              (art.articleProductName || "Pièce") +
                              " ajoutée !"
                          );
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          marginTop: 4,
                          background: "rgba(16,185,129,0.08)",
                          borderRadius: 8,
                          border: "1px solid rgba(16,185,129,0.2)",
                          cursor: "pointer",
                          transition: "all .15s"
                        }}
                        onMouseEnter={function (e) {
                          e.currentTarget.style.background =
                            "rgba(16,185,129,0.18)";
                        }}
                        onMouseLeave={function (e) {
                          e.currentTarget.style.background =
                            "rgba(16,185,129,0.08)";
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#E2E8F0"
                            }}
                          >
                            {art.articleProductName || "Pièce"}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#94A3B8",
                              marginTop: 2
                            }}
                          >
                            Réf: {art.articleNo || "N/A"} — Fournisseur:{" "}
                            {art.supplierName || "N/A"}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "4px 10px",
                            background: "rgba(16,185,129,0.15)",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#10B981"
                          }}
                        >
                          + Ajouter
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Résultat recherche Perplexity — liens cliquables */}
      {searchResult && (
        <div
          style={{
            ...S.c,
            padding: 16,
            marginTop: 12,
            border: "1px solid rgba(139,92,246,0.3)",
            animation: "fi .2s"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10
            }}
          >
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA" }}>
              🔍 Résultats de recherche
            </h3>
            <button
              onClick={function () {
                setSearchResult(null);
              }}
              style={{ ...S.bg, padding: "4px 10px", fontSize: 10 }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.8,
              color: "#E2E8F0",
              whiteSpace: "pre-wrap"
            }}
            dangerouslySetInnerHTML={{
              __html: searchResult.replace(
                /(https?:\/\/[^\s\)<>,]+)/g,
                '<a href="$1" target="_blank" rel="noopener" style="color:#818CF8;text-decoration:underline;word-break:break-all">$1</a>'
              )
            }}
          />
        </div>
      )}

      {/* === MODE FACTURE : création === */}
      {modeFac === "facture" &&
        (function () {
          var selPieces = draft.filter(function (p) {
            return sel[p.id || p.d];
          });
          var sousTotal = selPieces.reduce(function (a, p) {
            var rem = facRemises[p.id || p.d] || 0;
            return a + (p.q || 0) * (p.pv || 0) * (1 - rem / 100);
          }, 0);
          var montantRemise =
            facRemiseType === "pct"
              ? sousTotal * (facRemiseGlobale || 0) / 100
              : facRemiseGlobale || 0;
          var totalHT = sousTotal - montantRemise;
          var tva = totalHT * 0.2;
          var totalTTC = totalHT + tva;

          var doSave = async function (print) {
            setFacSaving(true);
            try {
              if (selPieces.length === 0) {
                alert("Sélectionnez au moins une pièce");
                setFacSaving(false);
                return;
              }
              var counterRef = db.collection("settings").doc("factureCounter");
              var num = await db.runTransaction(function (tx) {
                return tx.get(counterRef).then(function (doc) {
                  var current = doc.exists ? doc.data().lastNum || 0 : 0;
                  var next = current + 1;
                  tx.set(counterRef, { lastNum: next }, { merge: true });
                  return next;
                });
              });
              var year = new Date().getFullYear();
              var facNum =
                "FAC-" + year + "-" + String(num).padStart(3, "0");
              var lignes = selPieces.map(function (p) {
                var rem = facRemises[p.id || p.d] || 0;
                var pu = p.pv || 0;
                var tot = (p.q || 0) * pu * (1 - rem / 100);
                return {
                  id: p.id || p.d,
                  ref: p.ref || "",
                  d: p.d || "",
                  q: p.q || 0,
                  pu: pu,
                  remise: rem,
                  totalHT: Math.round(tot * 100) / 100
                };
              });
              var facObj = {
                id: uid(),
                num: facNum,
                date: facDate,
                dateCreation: new Date().toISOString(),
                etat: "brouillon",
                client: d.cli || "",
                telClient: d.tel || "",
                emailClient: d.email || "",
                adresseClient: facAdresse,
                vehicule: d.veh || "",
                immat: d.imm || "",
                assureur: d.ass || "",
                numDossier: d.num || "",
                lignes: lignes,
                remiseGlobale: facRemiseType === "pct" ? facRemiseGlobale : 0,
                remiseGlobaleType: facRemiseType,
                remiseGlobaleValeur:
                  facRemiseType === "eur" ? facRemiseGlobale : 0,
                sousTotal: Math.round(sousTotal * 100) / 100,
                montantRemiseGlobale: Math.round(montantRemise * 100) / 100,
                totalHT: Math.round(totalHT * 100) / 100,
                tva: Math.round(tva * 100) / 100,
                totalTTC: Math.round(totalTTC * 100) / 100,
                creePar: curUser ? curUser.nom : ""
              };
              facObj.html = generateFactureHtml(facObj);
              up(d.id, { factures: [...(d.factures || []), facObj] });
              botMsg(
                "general",
                "🧾 Facture " +
                  facNum +
                  " créée pour " +
                  (d.cli || "") +
                  " — " +
                  facObj.totalTTC.toFixed(2) +
                  "€ TTC"
              );
              if (print) {
                var w = window.open("", "", "width=800,height=1000");
                w.document.write(facObj.html);
                w.document.close();
                w.focus();
                setTimeout(function () {
                  w.print();
                }, 400);
              }
              setModeFac("pieces");
            } catch (e) {
              alert("Erreur: " + e.message);
            }
            setFacSaving(false);
          };

          return (
            <div
              style={{
                ...S.c,
                padding: 16,
                marginTop: 14,
                animation: "fi .2s",
                border: "1px solid rgba(59,130,246,0.3)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12
                }}
              >
                <h3
                  style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6" }}
                >
                  🧾 Créer une facture
                </h3>
                <button
                  onClick={function () {
                    setModeFac("pieces");
                  }}
                  style={{ ...S.bg, padding: "4px 10px", fontSize: 10 }}
                >
                  ✕ Fermer
                </button>
              </div>
              {/* Date + Adresse */}
              <div
                style={{ display: "flex", gap: 10, marginBottom: 12 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={S.l}>Date</div>
                  <input
                    type="date"
                    value={facDate}
                    onChange={function (e) {
                      setFacDate(e.target.value);
                    }}
                    style={S.i}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <div style={S.l}>Adresse client</div>
                  <input
                    value={facAdresse}
                    onChange={function (e) {
                      setFacAdresse(e.target.value);
                    }}
                    placeholder="Adresse de facturation"
                    style={S.i}
                  />
                </div>
              </div>
              {/* Tableau pièces sélectionnées avec remise */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                  marginBottom: 12
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "left"
                      }}
                    >
                      Réf.
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "left"
                      }}
                    >
                      Désignation
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "center"
                      }}
                    >
                      Qté
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "right"
                      }}
                    >
                      P.U. HT
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "center",
                        width: 65
                      }}
                    >
                      Remise %
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "right"
                      }}
                    >
                      Total HT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selPieces.map(function (p, i) {
                    var key = p.id || p.d;
                    var rem = facRemises[key] || 0;
                    var lineTotal =
                      (p.q || 0) * (p.pv || 0) * (1 - rem / 100);
                    return (
                      <tr
                        key={key}
                        style={{ borderBottom: "1px solid #1E293B" }}
                      >
                        <td
                          style={{
                            padding: 6,
                            fontSize: 10,
                            color: "#94A3B8"
                          }}
                        >
                          {p.ref || "—"}
                        </td>
                        <td style={{ padding: 6, color: "#E2E8F0" }}>
                          {p.d}
                        </td>
                        <td style={{ padding: 6, textAlign: "center" }}>
                          {p.q}
                        </td>
                        <td style={{ padding: 6, textAlign: "right" }}>
                          {(p.pv || 0).toFixed(2)} €
                        </td>
                        <td style={{ padding: 6, textAlign: "center" }}>
                          <input
                            type="number"
                            value={rem}
                            min={0}
                            max={100}
                            onChange={function (e) {
                              var nr = { ...facRemises };
                              nr[key] = Math.min(
                                100,
                                Math.max(0, +e.target.value || 0)
                              );
                              setFacRemises(nr);
                            }}
                            style={{
                              ...S.i,
                              width: 50,
                              textAlign: "center",
                              padding: "3px"
                            }}
                          />
                        </td>
                        <td
                          style={{
                            padding: 6,
                            textAlign: "right",
                            fontWeight: 600,
                            color: "#F8FAFC"
                          }}
                        >
                          {lineTotal.toFixed(2)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Remise globale */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 12
                }}
              >
                <span
                  style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}
                >
                  REMISE GLOBALE
                </span>
                <select
                  value={facRemiseType}
                  onChange={function (e) {
                    setFacRemiseType(e.target.value);
                    setFacRemiseGlobale(0);
                  }}
                  style={{ ...S.i, width: 60 }}
                >
                  <option value="pct">%</option>
                  <option value="eur">€</option>
                </select>
                <input
                  type="number"
                  value={facRemiseGlobale}
                  min={0}
                  step={facRemiseType === "pct" ? 1 : 0.01}
                  onChange={function (e) {
                    setFacRemiseGlobale(+e.target.value || 0);
                  }}
                  style={{ ...S.i, width: 80, textAlign: "right" }}
                />
              </div>
              {/* Récapitulatif */}
              <div
                style={{
                  background: "#0F172A",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                {[
                  ["Sous-total HT", sousTotal.toFixed(2) + " €", "#E2E8F0"],
                  montantRemise > 0
                    ? [
                        "Remise globale",
                        "-" + montantRemise.toFixed(2) + " €",
                        "#EF4444"
                      ]
                    : null,
                  ["Total HT", totalHT.toFixed(2) + " €", "#F8FAFC"],
                  ["TVA 20%", tva.toFixed(2) + " €", "#94A3B8"],
                  ["Total TTC", totalTTC.toFixed(2) + " €", "#10B981"]
                ]
                  .filter(Boolean)
                  .map(function (r, i) {
                    var last = r[0] === "Total TTC";
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          borderTop: last ? "2px solid #334155" : "none",
                          marginTop: last ? 6 : 0
                        }}
                      >
                        <span
                          style={{
                            fontSize: last ? 14 : 11,
                            fontWeight: last ? 700 : 400,
                            color: r[2]
                          }}
                        >
                          {r[0]}
                        </span>
                        <span
                          style={{
                            fontSize: last ? 16 : 11,
                            fontWeight: 700,
                            color: r[2]
                          }}
                        >
                          {r[1]}
                        </span>
                      </div>
                    );
                  })}
              </div>
              {/* Boutons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={function () {
                    doSave(false);
                  }}
                  disabled={facSaving}
                  style={S.bg}
                >
                  {facSaving ? "..." : "💾 Enregistrer"}
                </button>
                <button
                  onClick={function () {
                    doSave(true);
                  }}
                  disabled={facSaving}
                  style={S.b}
                >
                  {facSaving ? "..." : "🖨 Enregistrer & Imprimer"}
                </button>
              </div>
            </div>
          );
        })()}

      {/* === MODE LISTE FACTURES === */}
      {modeFac === "listFac" &&
        (function () {
          var factures = d.factures || [];
          var viewFac = function (fac) {
            var w = window.open("", "", "width=800,height=1000");
            w.document.write(fac.html);
            w.document.close();
            w.focus();
          };
          var printFac = function (fac) {
            var w = window.open("", "", "width=800,height=1000");
            w.document.write(fac.html);
            w.document.close();
            w.focus();
            setTimeout(function () {
              w.print();
            }, 400);
          };
          var deleteFac = function (facId) {
            if (!confirm("Supprimer cette facture ?")) return;
            up(d.id, {
              factures: factures.filter(function (f) {
                return f.id !== facId;
              })
            });
          };
          var startEditFac = function (fac) {
            setFacEditId(fac.id);
            setFacDate(fac.date || "");
            setFacAdresse(fac.adresseClient || "");
            setFacEditLignes(JSON.parse(JSON.stringify(fac.lignes || [])));
            var rm = {};
            (fac.lignes || []).forEach(function (l) {
              rm[l.id] = l.remise || 0;
            });
            setFacRemises(rm);
            setFacRemiseGlobale(
              fac.remiseGlobaleType === "pct"
                ? fac.remiseGlobale || 0
                : fac.remiseGlobaleValeur || 0
            );
            setFacRemiseType(fac.remiseGlobaleType || "pct");
            setModeFac("editFac");
          };

          return (
            <div
              style={{
                ...S.c,
                padding: 16,
                marginTop: 14,
                animation: "fi .2s",
                border: "1px solid rgba(139,92,246,0.3)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12
                }}
              >
                <h3
                  style={{ fontSize: 14, fontWeight: 700, color: "#A78BFA" }}
                >
                  🧾 Factures ({factures.length})
                </h3>
                <button
                  onClick={function () {
                    setModeFac("pieces");
                  }}
                  style={{ ...S.bg, padding: "4px 10px", fontSize: 10 }}
                >
                  ✕ Fermer
                </button>
              </div>
              {factures.length === 0 && (
                <div
                  style={{
                    color: "#64748B",
                    fontSize: 11,
                    textAlign: "center",
                    padding: 20
                  }}
                >
                  Aucune facture
                </div>
              )}
              {factures.map(function (fac) {
                return (
                  <div
                    key={fac.id}
                    style={{
                      background: "#0F172A",
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#F8FAFC"
                          }}
                        >
                          {fac.num}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "#94A3B8",
                            marginLeft: 8
                          }}
                        >
                          {(fac.date
                            ? fac.date.split("-").reverse().join("/")
                            : "") +
                            " — " +
                            (fac.client || "")}
                        </span>
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: "#10B981"
                        }}
                      >
                        {fac.totalTTC.toFixed(2)} €
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={function () {
                            viewFac(fac);
                          }}
                          style={{
                            ...S.bg,
                            padding: "5px 8px",
                            fontSize: 10
                          }}
                        >
                          👁
                        </button>
                        <button
                          onClick={function () {
                            printFac(fac);
                          }}
                          style={{
                            ...S.bg,
                            padding: "5px 8px",
                            fontSize: 10
                          }}
                        >
                          🖨
                        </button>
                        <button
                          onClick={function () {
                            startEditFac(fac);
                          }}
                          style={{
                            ...S.bg,
                            padding: "5px 8px",
                            fontSize: 10
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={function () {
                            deleteFac(fac.id);
                          }}
                          style={{
                            ...S.bg,
                            padding: "5px 8px",
                            fontSize: 10,
                            color: "#FCA5A5",
                            borderColor: "rgba(239,68,68,0.2)"
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

      {/* === MODE EDIT FACTURE === */}
      {modeFac === "editFac" &&
        (function () {
          var sousTotal = facEditLignes.reduce(function (a, l) {
            var rem = facRemises[l.id] || 0;
            return a + (l.q || 0) * (l.pu || 0) * (1 - rem / 100);
          }, 0);
          var montantRemise =
            facRemiseType === "pct"
              ? sousTotal * (facRemiseGlobale || 0) / 100
              : facRemiseGlobale || 0;
          var totalHT = sousTotal - montantRemise;
          var tva = totalHT * 0.2;
          var totalTTC = totalHT + tva;

          var doSaveEdit = async function (print) {
            setFacSaving(true);
            try {
              var lignes = facEditLignes.map(function (l) {
                var rem = facRemises[l.id] || 0;
                var tot = (l.q || 0) * (l.pu || 0) * (1 - rem / 100);
                return {
                  ...l,
                  remise: rem,
                  totalHT: Math.round(tot * 100) / 100
                };
              });
              var oldFac = (d.factures || []).find(function (f) {
                return f.id === facEditId;
              });
              var facObj = {
                ...oldFac,
                date: facDate,
                adresseClient: facAdresse,
                lignes: lignes,
                remiseGlobale:
                  facRemiseType === "pct" ? facRemiseGlobale : 0,
                remiseGlobaleType: facRemiseType,
                remiseGlobaleValeur:
                  facRemiseType === "eur" ? facRemiseGlobale : 0,
                sousTotal: Math.round(sousTotal * 100) / 100,
                montantRemiseGlobale:
                  Math.round(montantRemise * 100) / 100,
                totalHT: Math.round(totalHT * 100) / 100,
                tva: Math.round(tva * 100) / 100,
                totalTTC: Math.round(totalTTC * 100) / 100
              };
              facObj.html = generateFactureHtml(facObj);
              var updated = (d.factures || []).map(function (f) {
                return f.id === facEditId ? facObj : f;
              });
              up(d.id, { factures: updated });
              if (print) {
                var w = window.open("", "", "width=800,height=1000");
                w.document.write(facObj.html);
                w.document.close();
                w.focus();
                setTimeout(function () {
                  w.print();
                }, 400);
              }
              setModeFac("listFac");
            } catch (e) {
              alert("Erreur: " + e.message);
            }
            setFacSaving(false);
          };

          return (
            <div
              style={{
                ...S.c,
                padding: 16,
                marginTop: 14,
                animation: "fi .2s",
                border: "1px solid rgba(245,158,11,0.3)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12
                }}
              >
                <h3
                  style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}
                >
                  ✏️ Modifier la facture
                </h3>
                <button
                  onClick={function () {
                    setModeFac("listFac");
                  }}
                  style={{ ...S.bg, padding: "4px 10px", fontSize: 10 }}
                >
                  ← Retour
                </button>
              </div>
              {/* Date + Adresse */}
              <div
                style={{ display: "flex", gap: 10, marginBottom: 12 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={S.l}>Date</div>
                  <input
                    type="date"
                    value={facDate}
                    onChange={function (e) {
                      setFacDate(e.target.value);
                    }}
                    style={S.i}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <div style={S.l}>Adresse client</div>
                  <input
                    value={facAdresse}
                    onChange={function (e) {
                      setFacAdresse(e.target.value);
                    }}
                    placeholder="Adresse"
                    style={S.i}
                  />
                </div>
              </div>
              {/* Tableau lignes modifiables */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                  marginBottom: 12
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "left"
                      }}
                    >
                      Réf.
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "left"
                      }}
                    >
                      Désignation
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "center"
                      }}
                    >
                      Qté
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "right"
                      }}
                    >
                      P.U. HT
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "center",
                        width: 65
                      }}
                    >
                      Remise %
                    </th>
                    <th
                      style={{
                        padding: 6,
                        fontSize: 9,
                        color: "#94A3B8",
                        textAlign: "right"
                      }}
                    >
                      Total HT
                    </th>
                    <th style={{ padding: 6, width: 25 }} />
                  </tr>
                </thead>
                <tbody>
                  {facEditLignes.map(function (l, i) {
                    var rem = facRemises[l.id] || 0;
                    var lineTotal =
                      (l.q || 0) * (l.pu || 0) * (1 - rem / 100);
                    return (
                      <tr
                        key={l.id || i}
                        style={{ borderBottom: "1px solid #1E293B" }}
                      >
                        <td
                          style={{
                            padding: 6,
                            fontSize: 10,
                            color: "#94A3B8"
                          }}
                        >
                          {l.ref || "—"}
                        </td>
                        <td style={{ padding: 6, color: "#E2E8F0" }}>
                          {l.d}
                        </td>
                        <td style={{ padding: 6, textAlign: "center" }}>
                          <input
                            type="number"
                            value={l.q}
                            min={1}
                            onChange={function (e) {
                              var nl = [...facEditLignes];
                              nl[i] = {
                                ...nl[i],
                                q: +e.target.value || 1
                              };
                              setFacEditLignes(nl);
                            }}
                            style={{
                              ...S.i,
                              width: 45,
                              textAlign: "center",
                              padding: "3px"
                            }}
                          />
                        </td>
                        <td style={{ padding: 6, textAlign: "right" }}>
                          <input
                            type="number"
                            value={l.pu}
                            step="0.01"
                            onChange={function (e) {
                              var nl = [...facEditLignes];
                              nl[i] = {
                                ...nl[i],
                                pu: +e.target.value || 0
                              };
                              setFacEditLignes(nl);
                            }}
                            style={{
                              ...S.i,
                              width: 70,
                              textAlign: "right",
                              padding: "3px"
                            }}
                          />
                        </td>
                        <td style={{ padding: 6, textAlign: "center" }}>
                          <input
                            type="number"
                            value={rem}
                            min={0}
                            max={100}
                            onChange={function (e) {
                              var nr = { ...facRemises };
                              nr[l.id] = Math.min(
                                100,
                                Math.max(0, +e.target.value || 0)
                              );
                              setFacRemises(nr);
                            }}
                            style={{
                              ...S.i,
                              width: 50,
                              textAlign: "center",
                              padding: "3px"
                            }}
                          />
                        </td>
                        <td
                          style={{
                            padding: 6,
                            textAlign: "right",
                            fontWeight: 600,
                            color: "#F8FAFC"
                          }}
                        >
                          {lineTotal.toFixed(2)} €
                        </td>
                        <td style={{ padding: 6 }}>
                          <button
                            onClick={function () {
                              setFacEditLignes(
                                facEditLignes.filter(function (_, j) {
                                  return j !== i;
                                })
                              );
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#EF4444",
                              cursor: "pointer",
                              fontSize: 13
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Remise globale */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 12
                }}
              >
                <span
                  style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}
                >
                  REMISE GLOBALE
                </span>
                <select
                  value={facRemiseType}
                  onChange={function (e) {
                    setFacRemiseType(e.target.value);
                    setFacRemiseGlobale(0);
                  }}
                  style={{ ...S.i, width: 60 }}
                >
                  <option value="pct">%</option>
                  <option value="eur">€</option>
                </select>
                <input
                  type="number"
                  value={facRemiseGlobale}
                  min={0}
                  step={facRemiseType === "pct" ? 1 : 0.01}
                  onChange={function (e) {
                    setFacRemiseGlobale(+e.target.value || 0);
                  }}
                  style={{ ...S.i, width: 80, textAlign: "right" }}
                />
              </div>
              {/* Récap */}
              <div
                style={{
                  background: "#0F172A",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                {[
                  ["Sous-total HT", sousTotal.toFixed(2) + " €", "#E2E8F0"],
                  montantRemise > 0
                    ? [
                        "Remise globale",
                        "-" + montantRemise.toFixed(2) + " €",
                        "#EF4444"
                      ]
                    : null,
                  ["Total HT", totalHT.toFixed(2) + " €", "#F8FAFC"],
                  ["TVA 20%", tva.toFixed(2) + " €", "#94A3B8"],
                  ["Total TTC", totalTTC.toFixed(2) + " €", "#10B981"]
                ]
                  .filter(Boolean)
                  .map(function (r, i) {
                    var last = r[0] === "Total TTC";
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          borderTop: last ? "2px solid #334155" : "none",
                          marginTop: last ? 6 : 0
                        }}
                      >
                        <span
                          style={{
                            fontSize: last ? 14 : 11,
                            fontWeight: last ? 700 : 400,
                            color: r[2]
                          }}
                        >
                          {r[0]}
                        </span>
                        <span
                          style={{
                            fontSize: last ? 16 : 11,
                            fontWeight: 700,
                            color: r[2]
                          }}
                        >
                          {r[1]}
                        </span>
                      </div>
                    );
                  })}
              </div>
              {/* Boutons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={function () {
                    doSaveEdit(false);
                  }}
                  disabled={facSaving}
                  style={S.bg}
                >
                  {facSaving ? "..." : "💾 Enregistrer"}
                </button>
                <button
                  onClick={function () {
                    doSaveEdit(true);
                  }}
                  disabled={facSaving}
                  style={S.b}
                >
                  {facSaving ? "..." : "🖨 Enregistrer & Imprimer"}
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export default PiecesTab;
