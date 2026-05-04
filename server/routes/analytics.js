const express = require('express');
const router = express.Router();
const db = require('../db');
const PDFDocument = require('pdfkit');

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

// Subquery: korrekte Aggregation pro Projekt (verhindert Multiplikation bei JOINs)
const PROJEKT_SUBQUERY = `
  SELECT
    p.id, p.client_name, p.year, p.topic, p.status,
    p.hourly_rate, p.flat_rate, p.flat_rate_note,
    p.discount_percent, p.invoice_date, p.created_at,
    COALESCE(SUM(CASE WHEN e.is_free = 0 THEN e.hours ELSE 0 END), 0) AS billable_hours,
    COALESCE(SUM(e.hours), 0) AS all_hours,
    CASE
      WHEN p.flat_rate IS NOT NULL
        THEN p.flat_rate * (1.0 - COALESCE(p.discount_percent, 0) / 100.0)
      ELSE
        COALESCE(SUM(CASE WHEN e.is_free = 0 THEN e.hours ELSE 0 END), 0)
        * p.hourly_rate * (1.0 - COALESCE(p.discount_percent, 0) / 100.0)
    END AS umsatz
  FROM projects p
  LEFT JOIN time_entries e ON e.project_id = p.id
  GROUP BY p.id
`;

// ── API: Alle Kunden (optional nach Jahr filtern) ──────────────
router.get('/clients', (req, res) => {
  const { year } = req.query;
  const whereClause = year ? `WHERE sub.year = ${parseInt(year)}` : '';

  const rows = db.prepare(`
    SELECT
      sub.client_name,
      COUNT(sub.id)                                         AS project_count,
      MIN(sub.year)                                         AS first_year,
      MAX(sub.year)                                         AS last_year,
      SUM(sub.billable_hours)                               AS total_hours,
      SUM(sub.all_hours)                                    AS all_hours,
      SUM(sub.umsatz)                                       AS total_umsatz,
      GROUP_CONCAT(DISTINCT sub.year ORDER BY sub.year)     AS jahre,
      GROUP_CONCAT(DISTINCT sub.topic ORDER BY sub.topic)   AS themen
    FROM (${PROJEKT_SUBQUERY}) sub
    ${whereClause}
    GROUP BY sub.client_name
    ORDER BY total_umsatz DESC
  `).all();
  res.json(rows);
});

// ── API: Monatliche Aufstellung ────────────────────────────────
router.get('/monthly/:year', (req, res) => {
  const rows = db.prepare(`
    SELECT
      strftime('%m', e.entry_date)                                        AS monat,
      COUNT(DISTINCT p.id)                                                AS projekte,
      COUNT(e.id)                                                         AS eintraege,
      COALESCE(SUM(CASE WHEN e.is_free = 0 THEN e.hours ELSE 0 END), 0)  AS stunden,
      COALESCE(SUM(e.hours), 0)                                           AS alle_stunden,
      -- Umsatz pro Monat (stundenbasiert, Pauschal-Projekte anteilig nach Stunden)
      COALESCE(SUM(CASE WHEN e.is_free = 0 THEN e.hours * p.hourly_rate ELSE 0 END), 0) AS umsatz
    FROM time_entries e
    JOIN projects p ON p.id = e.project_id
    WHERE p.year = ? AND e.entry_date IS NOT NULL
    GROUP BY monat
    ORDER BY monat
  `).all(req.params.year);

  const monate = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    const found = rows.find(r => r.monat === m);
    return found || { monat: m, projekte: 0, eintraege: 0, stunden: 0, alle_stunden: 0, umsatz: 0 };
  });
  res.json(monate);
});

// ── API: Jahresvergleich pro Kunde ─────────────────────────────
router.get('/client/:name', (req, res) => {
  const name = req.params.name;
  const jahresDaten = db.prepare(`
    SELECT
      sub.year,
      COUNT(sub.id)           AS projekte,
      SUM(sub.billable_hours) AS stunden,
      SUM(sub.all_hours)      AS alle_stunden,
      SUM(sub.umsatz)         AS umsatz,
      GROUP_CONCAT(DISTINCT sub.topic ORDER BY sub.topic)   AS themen,
      GROUP_CONCAT(DISTINCT sub.status ORDER BY sub.status) AS status_liste
    FROM (${PROJEKT_SUBQUERY}) sub
    WHERE sub.client_name = ?
    GROUP BY sub.year
    ORDER BY sub.year DESC
  `).all(name);

  const projekte = db.prepare(`
    SELECT sub.* FROM (${PROJEKT_SUBQUERY}) sub
    WHERE sub.client_name = ?
    ORDER BY sub.year DESC, sub.created_at DESC
  `).all(name);

  res.json({ jahresDaten, projekte });
});

// ── API: Jahresvergleich (alle Jahre) ──────────────────────────
router.get('/yearly', (req, res) => {
  const rows = db.prepare(`
    SELECT
      sub.year,
      COUNT(DISTINCT sub.id)          AS projekte,
      COUNT(DISTINCT sub.client_name) AS kunden,
      SUM(sub.billable_hours)         AS stunden,
      SUM(sub.umsatz)                 AS umsatz
    FROM (${PROJEKT_SUBQUERY}) sub
    GROUP BY sub.year
    ORDER BY sub.year ASC
  `).all();
  res.json(rows);
});

// ── PDF: Alle Kunden Übersicht ─────────────────────────────────
router.get('/clients/pdf', (req, res) => {
  const clients = db.prepare(`
    SELECT
      sub.client_name,
      COUNT(sub.id)                                       AS project_count,
      MIN(sub.year)                                       AS first_year,
      MAX(sub.year)                                       AS last_year,
      SUM(sub.billable_hours)                             AS total_hours,
      SUM(sub.umsatz)                                     AS total_umsatz,
      GROUP_CONCAT(DISTINCT sub.year ORDER BY sub.year)   AS jahre,
      GROUP_CONCAT(DISTINCT sub.topic ORDER BY sub.topic) AS themen
    FROM (${PROJEKT_SUBQUERY}) sub
    GROUP BY sub.client_name
    ORDER BY total_umsatz DESC
  `).all();

  const totalUmsatz = clients.reduce((s, c) => s + (c.total_umsatz || 0), 0);
  const totalStunden = clients.reduce((s, c) => s + (c.total_hours || 0), 0);
  const heute = new Date().toLocaleDateString('de-CH');

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Kundenuebersicht_${heute.replace(/\./g, '-')}.pdf"`);
  doc.pipe(res);

  const W = 595.28, H = 841.89, M = 45, CW = W - M * 2;

  // Header
  doc.rect(0, 0, W, 68).fill(C.dunkel);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.weiss)
    .text('Finanzfokus GmbH – Kundenübersicht', M, 20);
  doc.font('Helvetica').fontSize(9).fillColor(C.blau_hell)
    .text(`Erstellt: ${heute}  ·  Alle Jahre`, W - M - 160, 26, { width: 160, align: 'right' });

  // Summary
  let y = 82;
  doc.rect(M, y, CW, 44).fill(C.blau_hell);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dunkel_mid)
    .text('Kunden total:', M + 12, y + 8);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.dunkel)
    .text(String(clients.length), M + 100, y + 4);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dunkel_mid)
    .text('Stunden total:', M + 160, y + 8);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.dunkel)
    .text(`${totalStunden.toFixed(2)} h`, M + 250, y + 4);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dunkel_mid)
    .text('Umsatz total:', M + 340, y + 8);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.blau)
    .text(`CHF ${fmt(totalUmsatz)}`, M + 420, y + 4);

  // Tabellenkopf
  y += 58;
  const cols  = [160, 130, 55, 60, 90];
  const heads = ['Kunde', 'Themen', 'Proj.', 'Stunden', 'Umsatz CHF'];
  const cx = [M]; for (let i = 1; i < cols.length; i++) cx.push(cx[i-1] + cols[i-1]);

  doc.rect(M, y, CW, 20).fill(C.blau);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.weiss);
  heads.forEach((h, i) =>
    doc.text(h, cx[i]+4, y+6, { width: cols[i]-8, align: i >= 2 ? 'right' : 'left' })
  );
  y += 20;

  clients.forEach((c, idx) => {
    const ROW_H = 20;
    if (y > H - 80) { doc.addPage(); y = 50; }
    doc.rect(M, y, CW, ROW_H).fill(idx % 2 === 0 ? C.blau_hell : C.weiss);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.dunkel)
      .text(c.client_name, cx[0]+4, y+6, { width: cols[0]-8, ellipsis: true, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.dunkel_mid)
      .text(c.themen || '–', cx[1]+4, y+6, { width: cols[1]-8, ellipsis: true, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.dunkel)
      .text(String(c.project_count), cx[2]+4, y+6, { width: cols[2]-8, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.dunkel)
      .text(`${parseFloat(c.total_hours).toFixed(2)} h`, cx[3]+4, y+6, { width: cols[3]-8, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.dunkel)
      .text(fmt(c.total_umsatz), cx[4]+4, y+6, { width: cols[4]-8, align: 'right', lineBreak: false });
    y += ROW_H;
  });

  // Total
  doc.rect(M, y+4, CW, 22).fill(C.dunkel);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.weiss)
    .text('Total', M+4, y+10)
    .text(`${totalStunden.toFixed(2)} h`, cx[3]+4, y+10, { width: cols[3]-8, align: 'right' })
    .text(fmt(totalUmsatz), cx[4]+4, y+10, { width: cols[4]-8, align: 'right' });

  fusszeile(doc, W, H, M, CW, C);
  doc.end();
});

// ── PDF: Einzelner Kunde ───────────────────────────────────────
router.get('/client/:name/pdf', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const heute = new Date().toLocaleDateString('de-CH');

  const jahresDaten = db.prepare(`
    SELECT
      sub.year, COUNT(sub.id) AS projekte,
      SUM(sub.billable_hours) AS stunden,
      SUM(sub.all_hours) AS alle_stunden,
      SUM(sub.umsatz) AS umsatz,
      GROUP_CONCAT(DISTINCT sub.topic ORDER BY sub.topic) AS themen
    FROM (${PROJEKT_SUBQUERY}) sub
    WHERE sub.client_name = ?
    GROUP BY sub.year ORDER BY sub.year ASC
  `).all(name);

  const projekte = db.prepare(`
    SELECT sub.* FROM (${PROJEKT_SUBQUERY}) sub
    WHERE sub.client_name = ?
    ORDER BY sub.year ASC, sub.created_at ASC
  `).all(name);

  // Alle Einträge pro Projekt laden
  const entries = {};
  projekte.forEach(p => {
    entries[p.id] = db.prepare(
      'SELECT * FROM time_entries WHERE project_id = ? ORDER BY entry_date ASC'
    ).all(p.id);
  });

  const totalUmsatz = jahresDaten.reduce((s, j) => s + j.umsatz, 0);
  const totalStunden = jahresDaten.reduce((s, j) => s + j.stunden, 0);

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="Kunde_${name.replace(/\s+/g, '_')}_${heute.replace(/\./g,'-')}.pdf"`);
  doc.pipe(res);

  const W = 595.28, H = 841.89, M = 45, CW = W - M * 2;

  // Header
  doc.rect(0, 0, W, 68).fill(C.dunkel);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.weiss)
    .text(name, M, 18);
  doc.font('Helvetica').fontSize(10).fillColor(C.blau_hell)
    .text('Kundenprojekte – Alle Jahre', M, 38);
  doc.font('Helvetica').fontSize(9).fillColor(C.blau_hell)
    .text(`Erstellt: ${heute}`, W-M-110, 26, { width: 110, align: 'right' });

  // Summary
  let y = 82;
  doc.rect(M, y, CW, 44).fill(C.blau_hell);
  const summaryItems = [
    ['Projekte:', String(projekte.length)],
    ['Stunden total:', `${totalStunden.toFixed(2)} h`],
    ['Umsatz total:', `CHF ${fmt(totalUmsatz)}`],
    ['Zeitraum:', jahresDaten.length > 0 ? `${jahresDaten[0].year}–${jahresDaten[jahresDaten.length-1].year}` : '–'],
  ];
  summaryItems.forEach(([label, val], i) => {
    const x = M + 12 + i * 130;
    doc.font('Helvetica').fontSize(8).fillColor(C.dunkel_mid).text(label, x, y+8);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.dunkel).text(val, x, y+20);
  });

  // Jahresübersicht
  y += 58;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.blau).text('Jahresübersicht', M, y);
  y += 18;

  doc.rect(M, y, CW, 20).fill(C.blau);
  const jCols = [60, 180, 60, 60, 90];
  const jHeads = ['Jahr', 'Themen', 'Proj.', 'Stunden', 'Umsatz CHF'];
  const jx = [M]; for (let i=1;i<jCols.length;i++) jx.push(jx[i-1]+jCols[i-1]);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.weiss);
  jHeads.forEach((h,i) => doc.text(h, jx[i]+4, y+6, { width: jCols[i]-8, align: i>=2?'right':'left' }));
  y += 20;

  jahresDaten.forEach((j, idx) => {
    doc.rect(M, y, CW, 18).fill(idx%2===0 ? C.blau_hell : C.weiss);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.blau).text(String(j.year), jx[0]+4, y+5);
    doc.font('Helvetica').fontSize(8).fillColor(C.dunkel_mid)
      .text(j.themen||'–', jx[1]+4, y+5, { width: jCols[1]-8, ellipsis: true, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor(C.dunkel)
      .text(String(j.projekte), jx[2]+4, y+5, { width: jCols[2]-8, align: 'right', lineBreak: false })
      .text(`${parseFloat(j.stunden).toFixed(2)} h`, jx[3]+4, y+5, { width: jCols[3]-8, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.dunkel)
      .text(fmt(j.umsatz), jx[4]+4, y+5, { width: jCols[4]-8, align: 'right', lineBreak: false });
    y += 18;
  });

  // Total Jahreszeile
  doc.rect(M, y+2, CW, 20).fill(C.dunkel);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.weiss)
    .text('Total', M+4, y+7)
    .text(`${totalStunden.toFixed(2)} h`, jx[3]+4, y+7, { width: jCols[3]-8, align: 'right' })
    .text(fmt(totalUmsatz), jx[4]+4, y+7, { width: jCols[4]-8, align: 'right' });

  y += 36;

  // Alle Projekte mit Einträgen
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.blau).text('Projektdetails', M, y);
  y += 18;

  for (const p of projekte) {
    if (y > H - 140) { doc.addPage(); y = 50; }

    // Projekt-Header
    doc.rect(M, y, CW, 22).fill(C.blau);
    const statusFarbe = p.status === 'bezahlt' ? C.gruen : p.status === 'rechnung_gestellt' ? C.blau_hell : C.orange;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.weiss)
      .text(`${p.year}  ·  ${p.topic || '–'}`, M+6, y+7);
    doc.font('Helvetica').fontSize(8).fillColor(statusFarbe)
      .text(statusLabel(p.status), W-M-90, y+7, { width: 80, align: 'right' });
    y += 22;

    // Projekt-Info
    doc.rect(M, y, CW, 18).fill(C.blau_hell);
    doc.font('Helvetica').fontSize(8).fillColor(C.dunkel_mid)
      .text(`CHF ${p.hourly_rate}/h${p.flat_rate ? `  ·  Pauschal CHF ${fmt(p.flat_rate)}` : ''}  ·  ${parseFloat(p.all_hours).toFixed(2)} h total  ·  CHF ${fmt(p.umsatz)}`, M+6, y+5);
    y += 18;

    const ents = entries[p.id] || [];
    if (ents.length > 0) {
      // Eintrags-Header
      const eCols = [62, 220, 65, 40, 65];
      const eHeads = ['Datum', 'Beschreibung', 'Kanal', 'Std.', 'CHF'];
      const ex = [M]; for (let i=1;i<eCols.length;i++) ex.push(ex[i-1]+eCols[i-1]);

      doc.rect(M, y, CW, 16).fill(C.dunkel_mid);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.weiss);
      eHeads.forEach((h,i) => doc.text(h, ex[i]+3, y+5, { width: eCols[i]-6, align: i>=3?'right':'left' }));
      y += 16;

      ents.forEach((e, ei) => {
        if (y > H - 60) { doc.addPage(); y = 50; }
        const ROW_H = 15;
        doc.rect(M, y, CW, ROW_H).fill(e.is_free ? C.orange_hell : (ei%2===0 ? C.blau_hell : C.weiss));
        const chf = e.is_free ? 0 : e.hours * (p.hourly_rate || 125);
        const datum = e.entry_date ? new Date(e.entry_date).toLocaleDateString('de-CH') : '–';
        doc.font(e.is_free ? 'Helvetica-Oblique' : 'Helvetica').fontSize(7.5).fillColor(C.dunkel)
          .text(datum, ex[0]+3, y+4, { lineBreak: false })
          .text(e.is_free ? e.description+' (kostenlos)' : e.description, ex[1]+3, y+4, { width: eCols[1]-6, ellipsis: true, lineBreak: false })
          .text(e.channel||'–', ex[2]+3, y+4, { width: eCols[2]-6, lineBreak: false })
          .text(parseFloat(e.hours).toFixed(2), ex[3]+3, y+4, { width: eCols[3]-6, align: 'right', lineBreak: false })
          .text(e.is_free ? '0.–' : fmt(chf), ex[4]+3, y+4, { width: eCols[4]-6, align: 'right', lineBreak: false });
        y += ROW_H;
      });
    }
    y += 10;
  }

  fusszeile(doc, W, H, M, CW, C);
  doc.end();
});

// ── Hilfsfunktionen ────────────────────────────────────────────
function fmt(n) {
  return parseFloat(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}
function statusLabel(s) {
  return s === 'bezahlt' ? 'BEZAHLT' : s === 'rechnung_gestellt' ? 'RECHNUNG GESTELLT' : 'OFFEN';
}
function fusszeile(doc, W, H, M, CW, C) {
  doc.rect(0, H-34, W, 34).fill(C.dunkel);
  doc.moveTo(M, H-34).lineTo(W-M, H-34).strokeColor(C.blau).lineWidth(1).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(C.dunkel_mid)
    .text('Finanzfokus GmbH  |  Bahnweg 24  |  8589 Sitterdorf  |  christoph@finanzfokus.ch  |  www.finanzfokus.ch',
      M, H-20, { width: CW, align: 'center' });
}

module.exports = router;
