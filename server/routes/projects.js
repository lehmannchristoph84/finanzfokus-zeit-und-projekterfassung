const express = require('express');
const router = express.Router();
const db = require('../db');

// Alle Projekte mit aggregierten Stunden/Betrag
router.get('/', (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const projects = db.prepare(`
    SELECT
      p.*,
      COALESCE(SUM(CASE WHEN e.is_free = 0 THEN e.hours ELSE 0 END), 0) AS total_hours,
      COALESCE(SUM(e.hours), 0) AS all_hours,
      COUNT(e.id) AS entry_count,
      MAX(e.entry_date) AS last_activity
    FROM projects p
    LEFT JOIN time_entries e ON e.project_id = p.id
    WHERE p.year = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(year);

  // Berechnete Felder anhängen
  const result = projects.map(p => ({
    ...p,
    calculated_amount: berechneRechnungsbetrag(p),
  }));

  res.json(result);
});

// Einzelnes Projekt mit Einträgen
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Nicht gefunden' });

  const entries = db.prepare(
    'SELECT * FROM time_entries WHERE project_id = ? ORDER BY entry_date ASC, created_at ASC'
  ).all(req.params.id);

  const total_hours = entries.filter(e => !e.is_free).reduce((s, e) => s + e.hours, 0);
  const all_hours = entries.reduce((s, e) => s + e.hours, 0);

  res.json({
    ...project,
    entries,
    total_hours,
    all_hours,
    calculated_amount: berechneRechnungsbetrag({ ...project, total_hours }),
  });
});

// Projekt erstellen
router.post('/', (req, res) => {
  const { client_name, topic, hourly_rate, flat_rate, flat_rate_note, year, discount_percent } = req.body;
  if (!client_name) return res.status(400).json({ error: 'Kundenname erforderlich' });

  const stmt = db.prepare(`
    INSERT INTO projects (client_name, topic, hourly_rate, flat_rate, flat_rate_note, year, discount_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    client_name,
    topic || null,
    hourly_rate || 125,
    flat_rate || null,
    flat_rate_note || null,
    year || new Date().getFullYear(),
    discount_percent || null
  );
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// Projekt aktualisieren
router.put('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Nicht gefunden' });

  const {
    client_name, topic, hourly_rate, flat_rate, flat_rate_note,
    status, invoice_date, invoice_note, discount_percent, year
  } = req.body;

  db.prepare(`
    UPDATE projects SET
      client_name     = COALESCE(?, client_name),
      topic           = COALESCE(?, topic),
      hourly_rate     = COALESCE(?, hourly_rate),
      flat_rate       = ?,
      flat_rate_note  = ?,
      status          = COALESCE(?, status),
      invoice_date    = ?,
      invoice_note    = ?,
      discount_percent = ?,
      year            = COALESCE(?, year)
    WHERE id = ?
  `).run(
    client_name || null,
    topic || null,
    hourly_rate || null,
    flat_rate !== undefined ? flat_rate : project.flat_rate,
    flat_rate_note !== undefined ? flat_rate_note : project.flat_rate_note,
    status || null,
    invoice_date !== undefined ? invoice_date : project.invoice_date,
    invoice_note !== undefined ? invoice_note : project.invoice_note,
    discount_percent !== undefined ? discount_percent : project.discount_percent,
    year || null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Projekt löschen
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json({ success: true });
});

// Hilfsfunktion: Rechnungsbetrag berechnen
function berechneRechnungsbetrag(p) {
  let betrag = p.flat_rate ? p.flat_rate : (p.total_hours || 0) * (p.hourly_rate || 125);
  if (p.discount_percent) {
    betrag = betrag * (1 - p.discount_percent / 100);
  }
  return Math.round(betrag * 20) / 20; // Auf 5 Rappen runden
}

module.exports = router;
