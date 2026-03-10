import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { fd, fmt, uid } from '../utils/helpers';
import { uploadToStorage, deleteFromStorage } from '../utils/storage';

function PECTab({ d, up }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);

  var handleFile = async function (f) {
    if (!f) return;
    setUploading(true);
    try {
      var spath = "dossiers/" + d.id + "/pec/" + uid() + "_" + f.name;
      var uploaded = await uploadToStorage(spath, f);
      if (d.pec && d.pec.storagePath) await deleteFromStorage(d.pec.storagePath);
      up(d.id, {
        pec: {
          name: f.name,
          size: f.size,
          date: new Date().toISOString(),
          url: uploaded.url,
          storagePath: uploaded.storagePath,
          type: f.type
        }
      });
    } catch (e) {
      alert("Erreur upload: " + e.message);
    }
    setUploading(false);
  };

  var current = d.pec || null;

  var viewPec = function () {
    if (!current) return;
    window.open(current.url || current.data, "_blank");
  };

  var printPec = function () {
    if (!current) return;
    var src = current.url || current.data;
    var w = window.open("", "", "width=900,height=700");
    if (current.type && current.type.includes("pdf")) {
      w.document.write('<iframe src="' + src + '" style="width:100%;height:100%;border:none"></iframe>');
    } else {
      w.document.write('<img src="' + src + '" style="max-width:100%;height:auto">');
    }
    w.document.close();
    w.focus();
    setTimeout(function () {
      w.print();
    }, 500);
  };

  var deletePec = async function () {
    if (!confirm("Supprimer la prise en charge ?")) return;
    if (current && current.storagePath) await deleteFromStorage(current.storagePath);
    up(d.id, {
      pec: null
    });
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        📝 Prise en charge
      </h3>

      {current && (
        <div style={{ ...S.c, padding: "16px", marginBottom: 14, border: "1px solid rgba(16,185,129,0.3)", animation: "fi .2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>📝</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{current.name}</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>
                {current.size ? Math.round(current.size / 1024) + "Ko" : ""} — {current.date ? new Date(current.date).toLocaleString("fr-FR") : ""}
              </div>
            </div>
            <button onClick={viewPec} style={S.b}>👁 Voir</button>
            <button
              onClick={printPec}
              style={{ ...S.b, background: "linear-gradient(135deg,#10B981,#059669)", color: "#FFF" }}
            >
              🖨 Imprimer
            </button>
            <button
              onClick={function () {
                var a = document.createElement("a");
                a.href = current.url || current.data;
                a.download = current.name;
                a.target = "_blank";
                a.click();
              }}
              style={S.b}
            >
              ⬇
            </button>
            <button
              onClick={deletePec}
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
          padding: "35px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: "rgba(15,23,42,0.4)"
        }}
      >
        <input
          ref={ref}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={function (e) { handleFile(e.target.files[0]); }}
          style={{ display: "none" }}
        />
        {uploading ? (
          <div>
            <div style={{
              width: 30,
              height: 30,
              border: "3px solid #334155",
              borderTop: "3px solid #10B981",
              borderRadius: "50%",
              margin: "0 auto 8px",
              animation: "sp 1s linear infinite"
            }} />
            <div style={{ fontSize: 11, color: "#10B981" }}>Upload en cours…</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 6 }}>📝</div>
            <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 12 }}>
              {current ? "Remplacer la prise en charge" : "Déposez la prise en charge"}
            </div>
            <div style={{ fontSize: 10, color: "#94A3B8" }}>PDF, JPG ou PNG</div>
          </div>
        )}
      </div>

      {!current && (
        <div style={{ ...S.c, padding: "18px", textAlign: "center", marginTop: 12 }}>
          <p style={{ color: "#64748B", fontSize: 11 }}>Aucune prise en charge déposée</p>
        </div>
      )}
    </div>
  );
}

export default PECTab;
