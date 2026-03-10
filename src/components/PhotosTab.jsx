import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { fmt } from '../utils/helpers';
import { uploadToStorage, uploadBase64ToStorage, deleteFromStorage } from '../utils/storage';
import { searchTecDoc } from '../utils/api';

function PhotosTab({ d, up }) {
  const CATS = [
    ["non_classee", "📥 Non classées", "#94A3B8"],
    ["avant", "🔴 Avant", "#EF4444"],
    ["expertise", "🔍 Expertise", "#F59E0B"],
    ["pendant", "🔵 Pendant", "#3B82F6"],
    ["apres", "🟢 Après", "#10B981"]
  ];
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProg, setUploadProg] = useState(0);
  const [viewer, setViewer] = useState(null);
  const [movePh, setMovePh] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);

  // Charger photos depuis Firestore
  useEffect(function () {
    var unsub = db.collection("dossiers").doc(d.id).collection("photos").onSnapshot(function (snap) {
      setPhotos(snap.docs.map(function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      }).sort(function (a, b) {
        return (a.date || "").localeCompare(b.date || "");
      }));
    }, function (err) {
      console.error(err);
    });
    return function () {
      unsub();
    };
  }, [d.id]);

  // Upload photo
  var doUpload = function (files) {
    if (!files || !files.length) return;
    setUploading(true);
    var total = files.length;
    var done = 0;
    Array.from(files).forEach(function (file) {
      if (!file.type.startsWith("image/")) {
        done++;
        return;
      }
      var id = uid();
      var path = "dossiers/" + d.id + "/photos/" + id + "_" + file.name;
      var ref = storage.ref(path);
      var task = ref.put(file);
      task.on("state_changed", function (snap) {
        setUploadProg(Math.round(snap.bytesTransferred / snap.totalBytes * 100));
      }, function (err) {
        console.error(err);
        done++;
        if (done >= total) setUploading(false);
      }, function () {
        task.snapshot.ref.getDownloadURL().then(function (url) {
          db.collection("dossiers").doc(d.id).collection("photos").doc(id).set({
            id: id,
            url: url,
            path: path,
            name: file.name,
            cat: "non_classee",
            date: new Date().toISOString(),
            size: file.size
          });
          done++;
          if (done >= total) {
            setUploading(false);
            setUploadProg(0);
          }
        });
      });
    });
  };

  // Changer catégorie
  var setCat = function (photoId, cat) {
    db.collection("dossiers").doc(d.id).collection("photos").doc(photoId).update({
      cat: cat
    });
    setMovePh(null);
  };

  // Supprimer photo
  var delPhoto = function (ph) {
    if (!confirm("Supprimer cette photo?")) return;
    storage.ref(ph.path).delete().catch(function (e) {
      console.error(e);
    });
    db.collection("dossiers").doc(d.id).collection("photos").doc(ph.id).delete();
    if (viewer && viewer.id === ph.id) setViewer(null);
  };

  var countCat = function (cat) {
    return photos.filter(function (p) {
      return p.cat === cat;
    }).length;
  };

  return (
    <div>
      <div
        onDragOver={function (e) {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#F59E0B";
        }}
        onDragLeave={function (e) {
          e.currentTarget.style.borderColor = "#475569";
        }}
        onDrop={function (e) {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#475569";
          doUpload(e.dataTransfer.files);
        }}
        style={{
          border: "2px dashed #475569",
          borderRadius: 12,
          padding: "25px 20px",
          textAlign: "center",
          background: "rgba(15,23,42,0.4)",
          marginBottom: 16,
          transition: "border-color .2s"
        }}
      >
        {uploading ? (
          <div>
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid #334155",
                borderTop: "3px solid #F59E0B",
                borderRadius: "50%",
                margin: "0 auto 10px",
                animation: "sp 1s linear infinite"
              }}
            />
            <div style={{ fontWeight: 600, color: "#F59E0B" }}>
              Upload {uploadProg}%
            </div>
            <div
              style={{
                background: "#334155",
                borderRadius: 4,
                height: 6,
                marginTop: 8,
                maxWidth: 200,
                margin: "8px auto 0"
              }}
            >
              <div
                style={{
                  background: "#F59E0B",
                  borderRadius: 4,
                  height: 6,
                  width: uploadProg + "%",
                  transition: "width .3s"
                }}
              />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Glissez vos photos ici
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap"
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple={true}
                onChange={function (e) {
                  doUpload(e.target.files);
                }}
                style={{ display: "none" }}
              />
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={function (e) {
                  doUpload(e.target.files);
                }}
                style={{ display: "none" }}
              />
              <button
                onClick={function () {
                  camRef.current && camRef.current.click();
                }}
                style={{
                  padding: "9px 18px",
                  background: "linear-gradient(135deg,#F59E0B,#D97706)",
                  color: "#0F172A",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                📸 Prendre une photo
              </button>
              <button
                onClick={function () {
                  fileRef.current && fileRef.current.click();
                }}
                style={{
                  padding: "9px 18px",
                  background: "linear-gradient(135deg,#3B82F6,#2563EB)",
                  color: "#FFF",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                🖼 Galerie
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 6 }}>
              JPG, PNG — Plusieurs photos à la fois
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          flexWrap: "wrap"
        }}
      >
        {CATS.map(function (c) {
          var n = countCat(c[0]);
          return (
            <div
              key={c[0]}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                background: n ? c[2] + "15" : "#0F172A",
                border: "1px solid " + (n ? c[2] + "30" : "#334155")
              }}
            >
              <span style={{ fontSize: 10 }}>{c[1].split(" ")[0]}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: n ? c[2] : "#475569"
                }}
              >
                {n}
              </span>
            </div>
          );
        })}
        <div
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "#94A3B8",
            alignSelf: "center"
          }}
        >
          {photos.length} photo{photos.length > 1 ? "s" : ""}
        </div>
      </div>

      {CATS.map(function (cat) {
        var catPhotos = photos.filter(function (p) {
          return p.cat === cat[0];
        });
        if (!catPhotos.length) return null;
        return (
          <div key={cat[0]} style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 20,
                  borderRadius: 2,
                  background: cat[2]
                }}
              />
              <h4 style={{ fontSize: 13, fontWeight: 600 }}>{cat[1]}</h4>
              <span style={{ fontSize: 10, color: "#64748B" }}>
                ({catPhotos.length})
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
                gap: 8
              }}
            >
              {catPhotos.map(function (ph) {
                return (
                  <div
                    key={ph.id}
                    style={{
                      position: "relative",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#0F172A",
                      border: "1px solid #334155",
                      aspectRatio: "1"
                    }}
                  >
                    <img
                      src={ph.url}
                      alt=""
                      onClick={function () {
                        setViewer(ph);
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        cursor: "pointer",
                        display: "block"
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "linear-gradient(transparent,rgba(0,0,0,.8))",
                        padding: "20px 6px 6px",
                        display: "flex",
                        justifyContent: "space-between"
                      }}
                    >
                      <span
                        onClick={function () {
                          setMovePh(ph);
                        }}
                        style={{
                          cursor: "pointer",
                          fontSize: 12,
                          background: "rgba(255,255,255,.15)",
                          borderRadius: 4,
                          padding: "2px 6px"
                        }}
                      >
                        📂
                      </span>
                      <span
                        onClick={function () {
                          delPhoto(ph);
                        }}
                        style={{
                          cursor: "pointer",
                          fontSize: 12,
                          background: "rgba(239,68,68,.2)",
                          borderRadius: 4,
                          padding: "2px 6px"
                        }}
                      >
                        🗑
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!photos.length && (
        <div style={{ ...S.c, padding: "30px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
          <div style={{ fontWeight: 600, color: "#94A3B8" }}>Aucune photo</div>
          <p style={{ fontSize: 11, color: "#64748B" }}>
            Prenez une photo ou glissez des fichiers ci-dessus
          </p>
        </div>
      )}

      {movePh && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 12
          }}
          onClick={function () {
            setMovePh(null);
          }}
        >
          <div
            className="modal-dialog"
            onClick={function (e) {
              e.stopPropagation();
            }}
            style={{
              background: "#1E293B",
              borderRadius: 13,
              padding: "22px",
              width: "100%",
              maxWidth: 360,
              border: "1px solid #334155",
              animation: "fi .2s"
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              📂 Classer cette photo
            </h3>
            <p
              style={{ fontSize: 10, color: "#94A3B8", marginBottom: 14 }}
            >
              {movePh.name}
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {CATS.map(function (cat) {
                var isCurrent = movePh.cat === cat[0];
                return (
                  <button
                    key={cat[0]}
                    onClick={function () {
                      if (!isCurrent) setCat(movePh.id, cat[0]);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: isCurrent ? cat[2] + "20" : "#0F172A",
                      border: isCurrent
                        ? "2px solid " + cat[2]
                        : "1px solid #334155",
                      borderRadius: 8,
                      color: isCurrent ? cat[2] : "#94A3B8",
                      fontWeight: isCurrent ? 700 : 400,
                      fontSize: 12,
                      cursor: isCurrent ? "default" : "pointer",
                      textAlign: "left"
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: cat[2]
                      }}
                    />
                    {cat[1]}
                    {isCurrent && (
                      <span style={{ marginLeft: "auto", fontSize: 9 }}>
                        ✓ Actuel
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.95)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
            padding: 12
          }}
          onClick={function () {
            setViewer(null);
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              display: "flex",
              gap: 8
            }}
          >
            <button
              onClick={function (e) {
                e.stopPropagation();
                setMovePh(viewer);
                setViewer(null);
              }}
              style={{
                padding: "8px 14px",
                background: "rgba(255,255,255,.1)",
                border: "none",
                borderRadius: 8,
                color: "#FFF",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              📂 Classer
            </button>
            <button
              onClick={function (e) {
                e.stopPropagation();
                delPhoto(viewer);
              }}
              style={{
                padding: "8px 14px",
                background: "rgba(239,68,68,.2)",
                border: "none",
                borderRadius: 8,
                color: "#FCA5A5",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              🗑 Supprimer
            </button>
            <button
              onClick={function () {
                setViewer(null);
              }}
              style={{
                padding: "8px 14px",
                background: "rgba(255,255,255,.1)",
                border: "none",
                borderRadius: 8,
                color: "#FFF",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              ✕ Fermer
            </button>
          </div>
          <img
            src={viewer.url}
            alt=""
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: 8
            }}
            onClick={function (e) {
              e.stopPropagation();
            }}
          />
          <div style={{ marginTop: 10, color: "#94A3B8", fontSize: 11 }}>
            {viewer.name} —{" "}
            {CATS.find(function (c) {
              return c[0] === viewer.cat;
            })
              ? CATS.find(function (c) {
                  return c[0] === viewer.cat;
                })[1]
              : ""}{" "}
            —{" "}
            {viewer.date
              ? new Date(viewer.date).toLocaleString("fr-FR")
              : ""}
          </div>
          {photos.length > 1 && (
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              <button
                onClick={function (e) {
                  e.stopPropagation();
                  var idx = photos.findIndex(function (p) {
                    return p.id === viewer.id;
                  });
                  if (idx > 0) setViewer(photos[idx - 1]);
                }}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,.1)",
                  border: "none",
                  borderRadius: 8,
                  color: "#FFF",
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                ◀
              </button>
              <button
                onClick={function (e) {
                  e.stopPropagation();
                  var idx = photos.findIndex(function (p) {
                    return p.id === viewer.id;
                  });
                  if (idx < photos.length - 1) setViewer(photos[idx + 1]);
                }}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,.1)",
                  border: "none",
                  borderRadius: 8,
                  color: "#FFF",
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                ▶
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PhotosTab;
