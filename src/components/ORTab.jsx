import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { ROLES } from '../config/constants';
import { S } from '../styles/theme';
import { uid, fmt, fd } from '../utils/helpers';

function ORTab({ d, up }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);

  const handleFile = async function (f) {
    if (!f || !f.type.includes("pdf")) return alert("Fichier PDF uniquement");
    setUploading(true);
    try {
      var spath = "dossiers/" + d.id + "/or/" + uid() + "_" + f.name;
      var uploaded = await uploadToStorage(spath, f);
      // Supprimer ancien si existait
      if (d.orPdf && d.orPdf.storagePath) await deleteFromStorage(d.orPdf.storagePath);
      up(d.id, {
        orPdf: {
          name: f.name,
          size: f.size,
          date: new Date().toISOString(),
          url: uploaded.url,
          storagePath: uploaded.storagePath
        }
      });
    } catch (e) {
      alert("Erreur upload: " + e.message);
    }
    setUploading(false);
  };

  var current = d.orPdf || null;
  var hasGenerated = d.orHtml && d.orDate;

  var viewOR = function () {
    var w = window.open("", "", "width=800,height=1000");
    w.document.write(d.orHtml);
    w.document.close();
    w.focus();
  };

  var printOR = function () {
    var w = window.open("", "", "width=800,height=1000");
    w.document.write(d.orHtml);
    w.document.close();
    w.focus();
    setTimeout(function () {
      w.print();
    }, 400);
  };

  var deleteOR = function () {
    if (confirm("Supprimer l'OR généré ?")) up(d.id, {
      orHtml: null,
      orDate: null
    });
  };

  var deleteUploadedOR = async function () {
    if (!confirm("Supprimer l'OR uploadé ?")) return;
    if (current && current.storagePath) await deleteFromStorage(current.storagePath);
    up(d.id, {
      orPdf: null
    });
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>📄 Ordre de réparation</h3>

      {hasGenerated && (
        <div style={{ ...S.c, padding: "16px", marginBottom: 14, border: "1px solid rgba(139,92,246,0.3)", animation: "fi .2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: "#A78BFA" }}>OR généré par l'IA</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>{new Date(d.orDate).toLocaleString("fr-FR")}</div>
            </div>
            <button onClick={viewOR} style={S.b}>👁 Voir</button>
            <button
              onClick={printOR}
              style={{ ...S.b, background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#FFF" }}
            >
              🖨 Imprimer
            </button>
            <button
              onClick={deleteOR}
              style={{
                padding: "8px 10px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 8,
                color: "#FCA5A5",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              🗑
            </button>
          </div>
        </div>
      )}

      <div
        onDragOver={function (e) { e.preventDefault(); }}
        onDrop={function (e) { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        onClick={function () { ref.current && ref.current.click(); }}
        style={{
          border: "2px dashed #475569",
          borderRadius: 12,
          padding: "30px 20px",
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
          onChange={function (e) { handleFile(e.target.files[0]); }}
          style={{ display: "none" }}
        />
        {uploading ? (
          <div>
            <div style={{
              width: 30,
              height: 30,
              border: "3px solid #334155",
              borderTop: "3px solid #F59E0B",
              borderRadius: "50%",
              margin: "0 auto 8px",
              animation: "sp 1s linear infinite"
            }} />
            <div style={{ fontSize: 11, color: "#F59E0B" }}>Upload en cours…</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 12 }}>Glissez un OR au format PDF</div>
            <div style={{ fontSize: 10, color: "#94A3B8" }}>ou cliquez pour parcourir</div>
          </div>
        )}
      </div>

      {current && (
        <div style={{ ...S.c, padding: "16px", animation: "fi .2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{current.name}</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>
                {current.size ? Math.round(current.size / 1024) + "Ko" : ""} — {current.date ? new Date(current.date).toLocaleString("fr-FR") : ""}
              </div>
            </div>
            <button
              onClick={function () { window.open(current.url || current.data, "_blank"); }}
              style={S.b}
            >
              👁 Voir
            </button>
            <button
              onClick={function () {
                var a = document.createElement("a");
                a.href = current.url || current.data;
                a.download = current.name || "OR.pdf";
                a.target = "_blank";
                a.click();
              }}
              style={S.b}
            >
              ⬇
            </button>
            <button
              onClick={deleteUploadedOR}
              style={{
                padding: "8px 12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 8,
                color: "#FCA5A5",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              🗑
            </button>
          </div>
        </div>
      )}

      {!current && !hasGenerated && (
        <div style={{ ...S.c, padding: "20px", textAlign: "center" }}>
          <p style={{ color: "#64748B", fontSize: 11 }}>Aucun ordre de réparation — générez-le depuis l'onglet Rapport IA</p>
        </div>
      )}
    </div>
  );
}

export default ORTab;
