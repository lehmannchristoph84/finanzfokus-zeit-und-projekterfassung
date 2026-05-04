const express = require('express');
const router = express.Router({ mergeParams: true });
const PDFDocument = require('pdfkit');
const db = require('../db');

// Finanzfokus Markenfarben
const FARBEN = {
  blau:       [114, 145, 160],
  dunkel:     [69,  68,  81],
  blau_hell:  [208, 221, 227],
  dunkel_mid: [138, 136, 151],
  weiss:      [255, 255, 255],
  orange:     [216, 141, 91],
  gruen:      [74,  163, 102],
};

function hex2rgb(arr) {
  return { r: arr[0] / 255, g: arr[1] / 255, b: arr[2] / 255 };
}

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

  if (project.discount_percent) {
    rechnungsBetrag *= 1 - project.discount_percent / 100;
  }
  rechnungsBetrag = Math.round(rechnungsBetrag * 20) / 20;

  const heute = new Date().toLocaleDateString('de-CH');

  // PDF erstellen
  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Rapport_${project.client_name.replace(/\s+/g, '_')}_${Date.now()}.pdf"`
  );
  doc.pipe(res);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const COL_W  = PAGE_W - MARGIN * 2;

  // ── KOPFZEILE ──────────────────────────────────────────────
  // Blauer Header-Balken
  doc.rect(0, 0, PAGE_W, 70).fill(rgbFill(FARBEN.blau));

  // Titel links
  doc.font('Helvetica-Bold').fontSize(16).fillColor('white')
    .text('Finanzfokus GmbH – Projektrapport', MARGIN, 22, { width: 350 });

  // Datum rechts
  doc.font('Helvetica').fontSize(9).fillColor('white')
    .text(`Erstellt: ${heute}`, PAGE_W - MARGIN - 120, 28, { width: 120, align: 'right' });

  // ── KUNDENDATEN BLOCK ──────────────────────────────────────
  let y = 90;

  doc.rect(MARGIN, y, COL_W, 90).fill(rgbFill(FARBEN.blau_hell));

  doc.font('Helvetica-Bold').fontSize(10).fillColor(rgbFill(FARBEN.dunkel));

  const infoLines = [
    ['Kunde:', project.client_name],
    ['Projekt:', project.topic || '–'],
    ['Stundensatz:', `CHF ${project.hourly_rate || 125}.–/h`],
    ...(project.flat_rate ? [['Pauschalpreis:', `CHF ${project.flat_rate}.– (${project.flat_rate_note || 'gemäss Vereinbarung'})`]] : []),
  ];

  let iy = y + 12;
  for (const [label, value] of infoLines) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(rgbFill(FARBEN.dunkel_mid))
      .text(label, MARGIN + 12, iy, { continued: false });
    doc.font('Helvetica').fontSize(9).fillColor(rgbFill(FARBEN.dunkel))
      .text(value, MARGIN + 110, iy);
    iy += 16;
  }

  // ── ZEITEINTRÄGE TABELLE ────────────────────────────────────
  y = 195;
  const COLS = [65, 230, 70, 45, 65]; // Datum | Beschreibung | Kanal | Std | CHF
  const HEADERS = ['Datum', 'Beschreibung', 'Kanal', 'Std.', 'CHF'];
  const colX = [MARGIN];
  for (let i = 1; i < COLS.length; i++) colX.push(colX[i - 1] + COLS[i - 1]);

  // Tabellenheader
  doc.rect(MARGIN, y, COL_W, 22).fill(rgbFill(FARBEN.blau));
  doc.font('Helvetica-Bold').fontSize(9).fillColor('white');
  HEADERS.forEach((h, i) => {
    const align = i >= 3 ? 'right' : 'left';
    doc.text(h, colX[i] + 4, y + 7, { width: COLS[i] - 8, align });
  });

  y += 22;

  // Eintragszeilen
  entries.forEach((e, idx) => {
    const rowH = 18;
    const isEven = idx % 2 === 0;

    // Kostenlos = leicht orange hinterlegte Zeile
    if (e.is_free) {
      doc.rect(MARGIN, y, COL_W, rowH).fill([242, 217, 197]);
    } else if (isEven) {
      doc.rect(MARGIN, y, COL_W, rowH).fill(rgbFill(FARBEN.blau_hell));
    } else {
      doc.rect(MARGIN, y, COL_W, rowH).fill('white');
    }

    const chf = e.is_free ? 0 : e.hours * (project.hourly_rate || 125);
    const datum = e.entry_date
      ? new Date(e.entry_date).toLocaleDateString('de-CH')
      : '–';

    doc.font(e.is_free ? 'Helvetica-Oblique' : 'Helvetica')
      .fontSize(8.5).fillColor(rgbFill(FARBEN.dunkel));

    const vals = [
      datum,
      e.is_free ? e.description + ' (kostenlos)' : e.description,
      e.channel || '–',
      formatNum(e.hours),
      e.is_free ? '0.–' : `${formatCHF(chf)}`,
    ];

    vals.forEach((v, i) => {
      const align = i >= 3 ? 'right' : 'left';
      doc.text(String(v), colX[i] + 4, y + 5, {
        width: COLS[i] - 8,
        align,
        ellipsis: true,
      });
    });

    // Trennlinie
    doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + COL_W, y + rowH)
      .strokeColor(rgbFill(FARBEN.blau_hell)).lineWidth(0.3).stroke();

    y += rowH;

    // Neue Seite falls nötig
    if (y > PAGE_H - 150) {
      doc.addPage();
      y = 50;
    }
  });

  // ── TOTAL ZEILE ─────────────────────────────────────────────
  y += 4;
  doc.rect(MARGIN, y, COL_W, 24).fill(rgbFill(FARBEN.dunkel));
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('white');
  doc.text('Total', MARGIN + 4, y + 8, { width: 200 });
  doc.text(formatNum(allHours) + ' h', colX[3] + 4, y + 8, { width: COLS[3] - 8, align: 'right' });
  doc.text(
    project.flat_rate
      ? `CHF ${formatCHF(totalHours * (project.hourly_rate || 125))}`
      : `CHF ${formatCHF(totalHours * (project.hourly_rate || 125))}`,
    colX[4] + 4, y + 8, { width: COLS[4] - 8, align: 'right' }
  );

  // ── RECHNUNGSBLOCK ──────────────────────────────────────────
  y += 40;
  const boxH = project.flat_rate ? 95 : project.discount_percent ? 80 : 55;
  doc.rect(MARGIN, y, COL_W, boxH).fill(rgbFill(FARBEN.blau_hell));

  doc.font('Helvetica-Bold').fontSize(10).fillColor(rgbFill(FARBEN.blau))
    .text('Abrechnung', MARGIN + 12, y + 10);

  let ry = y + 28;

  if (project.flat_rate) {
    zeileBlock(doc, MARGIN, ry, COL_W, FARBEN,
      'Erfasste Stunden:',
      `${formatNum(allHours)} h = CHF ${formatCHF(totalHours * (project.hourly_rate || 125))}`);
    ry += 18;
    zeileBlock(doc, MARGIN, ry, COL_W, FARBEN,
      'Pauschalpreis gemäss Vereinbarung:',
      `CHF ${formatCHF(project.flat_rate)}`);
    ry += 18;
  }

  if (project.discount_percent) {
    zeileBlock(doc, MARGIN, ry, COL_W, FARBEN,
      `Rabatt ${project.discount_percent}%:`,
      `- CHF ${formatCHF((project.flat_rate || totalHours * (project.hourly_rate || 125)) * project.discount_percent / 100)}`);
    ry += 18;
  }

  // Rechnungsbetrag fett
  doc.font('Helvetica-Bold').fontSize(11).fillColor(rgbFill(FARBEN.dunkel))
    .text('Rechnungsbetrag:', MARGIN + 12, ry + 4)
    .text(`CHF ${formatCHF(rechnungsBetrag)}`, PAGE_W - MARGIN - 120, ry + 4, { width: 110, align: 'right' });

  // Status
  const statusColor = project.status === 'bezahlt' ? FARBEN.gruen
    : project.status === 'rechnung_gestellt' ? FARBEN.blau
    : FARBEN.orange;

  doc.rect(MARGIN + 12, ry + 22, 100, 16).fill(rgbFill(statusColor));
  doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
    .text(statusLabel(project.status), MARGIN + 12, ry + 27, { width: 100, align: 'center' });

  // ── FUSSZEILE ───────────────────────────────────────────────
  doc.rect(0, PAGE_H - 35, PAGE_W, 35).fill(rgbFill(FARBEN.dunkel));
  doc.font('Helvetica').fontSize(8).fillColor(rgbFill(FARBEN.dunkel_mid))
    .text(
      'Finanzfokus GmbH  |  Bahnweg 24  |  8589 Sitterdorf  |  christoph@finanzfokus.ch  |  www.finanzfokus.ch',
      MARGIN, PAGE_H - 20, { width: COL_W, align: 'center' }
    );

  doc.end();
});

// Hilfsfunktionen
function rgbFill(arr) {
  return `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`;
}

function formatNum(n) {
  return parseFloat(n || 0).toFixed(2).replace('.', '.');
}

function formatCHF(n) {
  return parseFloat(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function statusLabel(s) {
  return s === 'bezahlt' ? 'BEZAHLT'
    : s === 'rechnung_gestellt' ? 'RECHNUNG GESTELLT'
    : 'OFFEN';
}

function zeileBlock(doc, x, y, w, farben, label, value) {
  doc.font('Helvetica').fontSize(9).fillColor(rgbFill(farben.dunkel_mid))
    .text(label, x + 12, y);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(rgbFill(farben.dunkel))
    .text(value, x + w - 150, y, { width: 138, align: 'right' });
}

module.exports = router;
