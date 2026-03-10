import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { fd, fmt, uid } from '../utils/helpers';
import { uploadToStorage, deleteFromStorage } from '../utils/storage';

function PretTab({ d, up }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [docs, setLocalDocs] = useState(d.pretDocs || []);

  useEffect(function () {
    setLocalDocs(d.pretDocs || []);
  }, [d.pretDocs]);

  var handleFile = async function (f) {
    if (!f) return;
    setUploading(true);
    try {
      var fid = uid();
      var spath = "dossiers/" + d.id + "/pret/" + fid + "_" + f.name;
      var uploaded = await uploadToStorage(spath, f);
      var newDoc = {
        id: fid,
        name: f.name,
        size: f.size,
        date: new Date().toISOString(),
        url: uploaded.url,
        storagePath: uploaded.storagePath,
        type: f.type
      };
      var nd = [...docs, newDoc];
      setLocalDocs(nd);
      up(d.id, {
        pretDocs: nd
      });
    } catch (e) {
      alert("Erreur upload: " + e.message);
    }
    setUploading(false);
  };

  var viewDoc = function (doc) {
    window.open(doc.url || doc.data, "_blank");
  };

  var printDoc = function (doc) {
    var src = doc.url || doc.data;
    var w = window.open("", "", "width=900,height=700");
    if (doc.type && doc.type.includes("pdf")) {
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

  var deleteDoc = async function (docId) {
    if (!confirm("Supprimer ce document ?")) return;
    var docToDelete = docs.find(function (x) {
      return x.id === docId;
    });
    if (docToDelete && docToDelete.storagePath) await deleteFromStorage(docToDelete.storagePath);
    var nr = docs.filter(function (x) {
      return x.id !== docId;
    });
    setLocalDocs(nr);
    up(d.id, {
      pretDocs: nr
    });
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        🚗 Contrat véhicule de prêt
      </h3>

      {docs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {docs.map(function (doc, i) {
            return (
              <div
                key={doc.id || i}
                style={{ ...S.c, padding: "14px", marginBottom: 6, border: "1px solid rgba(59,130,246,0.2)", animation: "fi .2s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>
                    {doc.type && doc.type.includes("pdf") ? "📄" : "🖼"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 11 }}>{doc.name}</div>
                    <div style={{ fontSize: 9, color: "#94A3B8" }}>
                      {doc.size ? Math.round(doc.size / 1024) + "Ko" : ""} — {doc.date ? new Date(doc.date).toLocaleString("fr-FR") : ""}
                    </div>
                  </div>
                  <button onClick={function () { viewDoc(doc); }} style={S.b}>👁 Voir</button>
                  <button
                    onClick={function () { printDoc(doc); }}
                    style={{ ...S.b, background: "linear-gradient(135deg,#3B82F6,#2563EB)", color: "#FFF" }}
                  >
                    🖨
                  </button>
                  <button
                    onClick={function () {
                      var a = document.createElement("a");
                      a.href = doc.url || doc.data;
                      a.download = doc.name;
                      a.target = "_blank";
                      a.click();
                    }}
                    style={S.b}
                  >
                    ⬇
                  </button>
                  <span
                    onClick={function () { deleteDoc(doc.id); }}
                    style={{ color: "#EF4444", cursor: "pointer", fontSize: 12 }}
                  >
                    ✕
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        onDragOver={function (e) { e.preventDefault(); }}
        onDrop={function (e) {
          e.preventDefault();
          Array.from(e.dataTransfer.files).forEach(function (f) { handleFile(f); });
        }}
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
          multiple={true}
          onChange={function (e) {
            Array.from(e.target.files).forEach(function (f) { handleFile(f); });
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        {uploading ? (
          <div>
            <div style={{
              width: 30,
              height: 30,
              border: "3px solid #334155",
              borderTop: "3px solid #3B82F6",
              borderRadius: "50%",
              margin: "0 auto 8px",
              animation: "sp 1s linear infinite"
            }} />
            <div style={{ fontSize: 11, color: "#3B82F6" }}>Upload en cours…</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 6 }}>🚗</div>
            <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 12 }}>Ajouter un document</div>
            <div style={{ fontSize: 10, color: "#94A3B8" }}>Contrat de prêt, état des lieux… (PDF, JPG, PNG)</div>
          </div>
        )}
      </div>

      {!docs.length && (
        <div style={{ ...S.c, padding: "18px", textAlign: "center", marginTop: 12 }}>
          <p style={{ color: "#64748B", fontSize: 11 }}>Aucun document de prêt déposé</p>
        </div>
      )}
    </div>
  );
}

export default PretTab;
