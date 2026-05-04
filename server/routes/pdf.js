const express = require('express');
const router = express.Router({ mergeParams: true });
const PDFDocument = require('pdfkit');
const db = require('../db');

// Finanzfokus Markenfarben (Hex)
const C = {
  blau:       '#7291a0',
  dunkel:     '#454451',
  blau_hell:  '#d0dde3',
  dunkel_mid: '#8a8897',
  weiss:      '#ffffff',
  orange:     '#d88d5b',
  orange_hell:'#f2d9c5',
  gruen:      '#4aa366',
};

router.get('/', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });

  const entries = db.prepare(
    'SELECT * FROM time_entries WHERE project_id = ? ORDER BY entry_date ASC'
  ).all(req.params.projectId);

  const totalHours = entries.filter(e => !e.is_free).reduce((s, e) => s + e.hours, 0);
  const allHours   = entries.reduce((s, e) => s + e.hours, 0);

  let rechnungsBetrag = project.flat_rate
    ? project.flat_rate
    : totalHours * (project.hourly_rate || 125);
  if (project.discount_percent) rechnungsBetrag *= 1 - project.discount_percent / 100;
  rechnungsBetrag = Math.round(rechnungsBetrag * 20) / 20;

  const heute = new Date().toLocaleDateString('de-CH');

  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Rapport_${project.client_name.replace(/\s+/g, '_')}.pdf"`
  );
  doc.pipe(res);

  const W = 595.28;
  const H = 841.89;
  const M = 50; // margin
  const CW = W - M * 2; // content width

  // ── HEADER ────────────────────────────────────────────────
  doc.rect(0, 0, W, 72).fill(C.dunkel);

  doc.font('Helvetica-Bold')
    .fontSize(17)
    .fillColor(C.weiss)
    .text('Finanzfokus GmbH – Projektrapport', M, 25, { width: 360 });

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor(C.blau_hell)
    .text(`Erstellt: ${heute}`, W - M - 110, 30, { width: 110, align: 'right' });

  // ── KUNDENDATEN ────────────────────────────────────────────
  let y = 88;

  doc.rect(M, y, CW, 88).fill(C.blau_hell);

  const info = [
    ['Kunde:',       project.client_name],
    ['Projekt:',     project.topic || '–'],
    ['Stundensatz:', `CHF ${project.hourly_rate || 125}.–/h`],
  ];
  if (project.flat_rate) {
    info.push(['Pauschalpreis:', `CHF ${fmt(project.flat_rate)} (${project.flat_rate_note || 'gemäss Vereinbarung'})`]);
  }

  let iy = y + 12;
  for (const [label, value] of info) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.dunkel_mid)
      .text(label, M + 12, iy);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.dunkel)
      .text(value, M + 108, iy);
    iy += 16;
  }

  // ── TABELLE HEADER ─────────────────────────────────────────
  y += 100;

  const cols  = [62, 225, 68, 42, 68]; // Datum | Beschreibung | Kanal | Std | CHF
  const heads = ['Datum', 'Beschreibung', 'Kanal', 'Std.', 'CHF'];
  const cx    = [M];
  for (let i = 1; i < cols.length; i++) cx.push(cx[i - 1] + cols[i - 1]);

  doc.rect(M, y, CW, 22).fill(C.blau);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.weiss);
  heads.forEach((h, i) => {
    doc.text(h, cx[i] + 4, y + 7, { width: cols[i] - 8, align: i >= 3 ? 'right' : 'left' });
  });
  y += 22;

  // ── EINTRAGSZEILEN ─────────────────────────────────────────
  entries.forEach((e, idx) => {
    const ROW_H = 18;

    if (y > H - 130) {
      doc.addPage();
      y = 50;
    }

    // Zeilenhintergrund
    if (e.is_free) {
      doc.rect(M, y, CW, ROW_H).fill(C.orange_hell);
    } else if (idx % 2 === 0) {
      doc.rect(M, y, CW, ROW_H).fill(C.blau_hell);
    } else {
      doc.rect(M, y, CW, ROW_H).fill(C.weiss);
    }

    const chf   = e.is_free ? 0 : e.hours * (project.hourly_rate || 125);
    const datum = e.entry_date ? new Date(e.entry_date).toLocaleDateString('de-CH') : '–';

    const vals = [
      datum,
      e.is_free ? `${e.description} (kostenlos)` : e.description,
      e.channel || '–',
      parseFloat(e.hours).toFixed(2),
      e.is_free ? '0.–' : `CHF ${fmt(chf)}`,
    ];

    doc.font(e.is_free ? 'Helvetica-Oblique' : 'Helvetica')
      .fontSize(8.5)
      .fillColor(C.dunkel);

    vals.forEach((v, i) => {
      doc.text(String(v), cx[i] + 4, y + 5, {
        width: cols[i] - 8,
        align: i >= 3 ? 'right' : 'left',
        ellipsis: true,
        lineBreak: false,
      });
    });

    // Trennlinie
    doc.moveTo(M, y + ROW_H).lineTo(M + CW, y + ROW_H)
      .strokeColor(C.blau_hell).lineWidth(0.3).stroke();

    y += ROW_H;
  });

  // ── TOTAL ZEILE ─────────────────────────────────────────────
  y += 4;
  doc.rect(M, y, CW, 24).fill(C.dunkel);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.weiss);
  doc.text('Total', M + 4, y + 8);
  doc.text(`${allHours.toFixed(2)} h`, cx[3] + 4, y + 8, { width: cols[3] - 8, align: 'right' });

  const stundenbetrag = totalHours * (project.hourly_rate || 125);
  doc.text(`CHF ${fmt(stundenbetrag)}`, cx[4] + 4, y + 8, { width: cols[4] - 8, align: 'right' });

  // ── ABRECHNUNG BOX ──────────────────────────────────────────
  y += 40;
  const boxH = project.flat_rate ? 110 : 60;
  doc.rect(M, y, CW, boxH).fill(C.blau_hell);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.blau)
    .text('Abrechnung', M + 12, y + 10);

  let ry = y + 28;

  if (project.flat_rate) {
    infoZeile(doc, M, ry, CW, C, 'Erfasste Stunden:', `${allHours.toFixed(2)} h`);
    ry += 18;
    infoZeile(doc, M, ry, CW, C, 'Stundenbasiert (zur Info):', `CHF ${fmt(stundenbetrag)}`);
    ry += 18;
    infoZeile(doc, M, ry, CW, C, 'Pauschalpreis gemäss Vereinbarung:', `CHF ${fmt(project.flat_rate)}`);
    ry += 18;
  }

  if (project.discount_percent) {
    const base = project.flat_rate || stundenbetrag;
    infoZeile(doc, M, ry, CW, C, `Rabatt ${project.discount_percent}%:`,
      `- CHF ${fmt(base * project.discount_percent / 100)}`);
    ry += 18;
  }

  // Rechnungsbetrag fett
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.dunkel)
    .text('Rechnungsbetrag:', M + 12, ry + 2);
  doc.text(`CHF ${fmt(rechnungsBetrag)}`, W - M - 130, ry + 2, { width: 120, align: 'right' });

  // Status-Badge
  const statusFarbe = project.status === 'bezahlt' ? C.gruen
    : project.status === 'rechnung_gestellt' ? C.blau : C.orange;

  doc.rect(M + 12, ry + 22, 115, 16).fill(statusFarbe);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.weiss)
    .text(statusLabel(project.status), M + 12, ry + 27, { width: 115, align: 'center' });

  // ── FUSSZEILE ────────────────────────────────────────────────
  doc.rect(0, H - 36, W, 36).fill(C.dunkel);
  doc.moveTo(M, H - 36).lineTo(W - M, H - 36)
    .strokeColor(C.blau).lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(C.dunkel_mid)
    .text(
      'Finanzfokus GmbH  |  Bahnweg 24  |  8589 Sitterdorf  |  christoph@finanzfokus.ch  |  www.finanzfokus.ch',
      M, H - 22, { width: CW, align: 'center' }
    );

  doc.end();
});

// Hilfsfunktionen
function fmt(n) {
  return parseFloat(n || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function statusLabel(s) {
  if (s === 'bezahlt') return 'BEZAHLT';
  if (s === 'rechnung_gestellt') return 'RECHNUNG GESTELLT';
  return 'OFFEN';
}

function infoZeile(doc, x, y, w, C, label, value) {
  doc.font('Helvetica').fontSize(9).fillColor(C.dunkel_mid)
    .text(label, x + 12, y);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dunkel)
    .text(value, x + w - 130, y, { width: 120, align: 'right' });
}

module.exports = router;
