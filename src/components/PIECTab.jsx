import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, firebase } from '../firebase';
import { S } from '../styles/theme';
import { fd, fmt, uid } from '../utils/helpers';
import { uploadToStorage, deleteFromStorage } from '../utils/storage';

function PIECTab({ d, contacts }) {
  const printRef = useRef(null);

  var dateFR = new Date().toLocaleDateString("fr-FR");
  var ct = contacts || [];

  var assContact = ct.find(function (c) {
    return c.type === "assureur" && d.ass && d.ass.toLowerCase().includes(c.nom.toLowerCase());
  });

  var expContact = ct.find(function (c) {
    return c.type === "expert" && d.exp && d.exp.toLowerCase().includes(c.nom.toLowerCase());
  });

  const doPrint = function () {
    var w = window.open("", "", "width=800,height=1000");
    w.document.write(printRef.current.innerHTML);
    w.document.close();
    w.focus();
    w.print();
  };

  var piecSubject = (d.cli || "") + " — " + (d.imm || "") + " — Document pièces de réemploi";
  var piecBody = "Bonjour,\n\nVeuillez trouver ci-joint le document d'information sur les pièces issues de l'économie circulaire pour le véhicule :\n\n- Client : " + (d.cli || "___") + "\n- Véhicule : " + (d.veh || "___") + "\n- Immatriculation : " + (d.imm || "___") + "\n- N° dossier : " + (d.num || "___") + "\n\nLe client a accepté l'utilisation de pièces de réemploi.\n\nCordialement,\nPoint S Guignes\n07.75.78.43.34\nautocenter77@outlook.fr";

  var openMailPiec = function (to) {
    var url = "https://outlook.live.com/mail/0/deeplink/compose?to=" + encodeURIComponent(to || "") + "&subject=" + encodeURIComponent(piecSubject) + "&body=" + encodeURIComponent(piecBody);
    window.open(url, "_blank");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>
          ♻️ Pièces de réemploi — Économie circulaire
        </h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {d.email && (
            <button
              onClick={function () { openMailPiec(d.email); }}
              style={{
                padding: "7px 14px",
                background: "linear-gradient(135deg,#0078D4,#106EBE)",
                color: "#FFF",
                border: "none",
                borderRadius: 7,
                fontWeight: 600,
                fontSize: 10,
                cursor: "pointer"
              }}
            >
              ✉️ Client ({d.email.split("@")[0]})
            </button>
          )}
          {assContact && assContact.email && (
            <button
              onClick={function () { openMailPiec(assContact.email); }}
              style={{
                padding: "7px 14px",
                background: "linear-gradient(135deg,#3B82F6,#2563EB)",
                color: "#FFF",
                border: "none",
                borderRadius: 7,
                fontWeight: 600,
                fontSize: 10,
                cursor: "pointer"
              }}
            >
              🏢 {assContact.nom}
            </button>
          )}
          {expContact && expContact.email && (
            <button
              onClick={function () { openMailPiec(expContact.email); }}
              style={{
                padding: "7px 14px",
                background: "linear-gradient(135deg,#F59E0B,#D97706)",
                color: "#0F172A",
                border: "none",
                borderRadius: 7,
                fontWeight: 600,
                fontSize: 10,
                cursor: "pointer"
              }}
            >
              🔍 {expContact.nom}
            </button>
          )}
          <button onClick={doPrint} style={S.b}>🖨 Imprimer</button>
        </div>
      </div>

      <div ref={printRef}>
        <div style={{
          background: "#FFF",
          color: "#000",
          borderRadius: 12,
          padding: "30px",
          fontSize: 12,
          lineHeight: 1.6,
          maxWidth: 700
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>RAPIDE DEPANNAGE</div>
              <div style={{ fontSize: 10, color: "#555" }}>
                24 RUE SAINT ABDON<br />
                77390 GUIGNES France<br />
                Tel : 07.75.78.43.34 — autocenter77@outlook.fr<br />
                SIRET 84483885400025 — RCS Melun B 844 838 854<br />
                TVA FR82844838854 — APE 5221Z<br />
                Sas au capital de 10 000,00€
              </div>
            </div>
            <img src={LOGO} alt="Point S" style={{ height: 50 }} />
          </div>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0078D4" }}>PIÈCES AUTO</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0078D4" }}>ISSUES DE L'ÉCONOMIE CIRCULAIRE</div>
          </div>

          <p>
            Vous vous apprêtez à effectuer les réparations de votre véhicule. Vous pouvez opter pour l'utilisation de pièces issues de l'économie circulaire pour la réparation ou l'entretien de votre véhicule automobile.
          </p>

          <div style={{ fontWeight: 700, color: "#0078D4", marginTop: 14, marginBottom: 4 }}>À savoir</div>
          <p>
            Une pièce issue de l'économie circulaire :<br />
            — provient d'un centre de véhicules hors d'usage (VHU) agréé par l'État,<br />
            — ou est remise en état selon les spécifications du fabricant, sous l'appellation échange standard.
          </p>

          <div style={{ fontWeight: 700, color: "#0078D4", marginTop: 14, marginBottom: 4 }}>Pièces concernées</div>
          <p>
            — Pièces de carrosserie amovibles<br />
            — Pièces de garnissage intérieur et de sellerie<br />
            — Vitrages non collés<br />
            — Pièces d'optique<br />
            — Pièces mécaniques ou électroniques (à l'exception des trains roulants, organes de direction, organes de freinage et éléments de liaison au sol assemblés et soumis à usure mécanique non démontables)
          </p>

          <div style={{ fontWeight: 700, color: "#0078D4", marginTop: 14, marginBottom: 4 }}>Conditions de fourniture</div>
          <p>
            Le garage peut vous fournir la pièce si :<br />
            — elle est disponible dans un délai compatible avec l'immobilisation du véhicule,<br />
            — elle ne présente pas de risque important pour l'environnement, la santé ou la sécurité routière.
          </p>

          <p style={{ fontSize: 10, color: "#555" }}>
            Cette pratique est encadrée par les dispositions légales relatives à la réparation automobile, notamment le décret n°2016-448 du 13 avril 2016.
          </p>

          <div style={{ fontWeight: 700, color: "#0078D4", marginTop: 14, marginBottom: 4 }}>Engagements du garage</div>
          <p>
            — Informer systématiquement le client de la nature des pièces utilisées (neuves, PIEC ou d'occasion),<br />
            — Obtenir son accord préalable avant toute intervention,<br />
            — Garantir la traçabilité des pièces posées,<br />
            — Assurer la conformité des pièces avec les exigences du constructeur et les normes en vigueur.
          </p>

          <div style={{ fontWeight: 700, color: "#0078D4", marginTop: 20, marginBottom: 8, fontSize: 14 }}>Client</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <span style={{ color: "#555" }}>Nom du client : </span>
              <strong style={{ borderBottom: "1px solid #000", paddingBottom: 2 }}>{d.cli || "_______________"}</strong>
            </div>
            <div>
              <span style={{ color: "#555" }}>Immatriculation : </span>
              <strong style={{ borderBottom: "1px solid #000", paddingBottom: 2 }}>{d.imm || "_______________"}</strong>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={{ color: "#555" }}>Date : </span>
            <strong style={{ borderBottom: "1px solid #000", paddingBottom: 2 }}>{dateFR}</strong>
          </div>

          <p>
            Je déclare avoir pris connaissance :<br />
            — de ce qu'est une pièce issue de l'économie circulaire, des pièces concernées ainsi que des conditions générales de disponibilité.
          </p>

          <div style={{ display: "flex", gap: 40, marginTop: 10, marginBottom: 10, fontSize: 14 }}>
            <span><strong style={{ color: "#0078D4", fontSize: 18 }}>☑</strong> OUI</span>
            <span><span style={{ fontSize: 18 }}>☐</span> NON</span>
          </div>

          <p style={{ fontStyle: "italic" }}>
            souhaite l'utilisation de pièces issues de l'économie circulaire pour la réparation de mon véhicule.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 30 }}>
            <div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 30 }}>Signature de l'entreprise :</div>
              <div style={{ borderBottom: "1px solid #ccc" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 30 }}>Signature du client :</div>
              <div style={{ borderBottom: "1px solid #ccc" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PIECTab;
