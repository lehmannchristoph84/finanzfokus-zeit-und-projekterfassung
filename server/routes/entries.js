const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

// Alle Einträge eines Projekts
router.get('/', (req, res) => {
  const entries = db.prepare(
    'SELECT * FROM time_entries WHERE project_id = ? ORDER BY entry_date ASC, created_at ASC'
  ).all(req.params.projectId);
  res.json(entries);
});

// Eintrag hinzufügen
router.post('/', (req, res) => {
  const { entry_date, channel, description, hours, billable, is_free } = req.body;
  if (!description) return res.status(400).json({ error: 'Beschreibung erforderlich' });

  const result = db.prepare(`
    INSERT INTO time_entries (project_id, entry_date, channel, description, hours, billable, is_free)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.projectId,
    entry_date || null,
    channel || null,
    description,
    hours || 0,
    billable !== false ? 1 : 0,
    is_free ? 1 : 0
  );

  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// Eintrag aktualisieren (globale Route /api/entries/:id)
router.put('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Nicht gefunden' });

  const { entry_date, channel, description, hours, billable, is_free } = req.body;

  db.prepare(`
    UPDATE time_entries SET
      entry_date  = COALESCE(?, entry_date),
      channel     = ?,
      description = COALESCE(?, description),
      hours       = COALESCE(?, hours),
      billable    = COALESCE(?, billable),
      is_free     = COALESCE(?, is_free)
    WHERE id = ?
  `).run(
    entry_date || null,
    channel !== undefined ? channel : entry.channel,
    description || null,
    hours !== undefined ? hours : null,
    billable !== undefined ? (billable ? 1 : 0) : null,
    is_free !== undefined ? (is_free ? 1 : 0) : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Eintrag löschen (globale Route /api/entries/:id)
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json({ success: true });
});

// Excel-Import
router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const insertProject = db.prepare(`
      INSERT INTO projects (client_name, topic, hourly_rate, status, year)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertEntry = db.prepare(`
      INSERT INTO time_entries (project_id, entry_date, channel, description, hours, is_free)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    const projectCache = {};

    const importAll = db.transaction(() => {
      for (const row of rows) {
        const clientName = String(row['Kunde'] || row['client_name'] || '').trim();
        const topic = String(row['Thema'] || row['topic'] || '').trim();
        const description = String(row['Arbeit/Bemerkung'] || row['Bemerkung'] || row['description'] || '').trim();
        const hours = parseFloat(row['Stunden'] || row['hours'] || 0) || 0;
        const channel = String(row['Kanal'] || row['channel'] || '').trim();
        const hourlyRate = parseFloat(row['Stundensatz'] || 125) || 125;
        const status = String(row['RechnungsStatus'] || 'offen').trim().toLowerCase();
        let entryDate = row['Datum'] || null;

        if (!clientName || !description) continue;

        // Datum normalisieren
        if (entryDate instanceof Date) {
          entryDate = entryDate.toISOString().split('T')[0];
        } else if (entryDate) {
          entryDate = String(entryDate).trim();
        }

        const key = `${clientName}|${topic}`;
        if (!projectCache[key]) {
          const existing = db.prepare(
            'SELECT id FROM projects WHERE client_name = ? AND topic = ?'
          ).get(clientName, topic);

          if (existing) {
            projectCache[key] = existing.id;
          } else {
            const p = insertProject.run(clientName, topic || null, hourlyRate,
              mapStatus(status), new Date().getFullYear());
            projectCache[key] = p.lastInsertRowid;
          }
        }

        insertEntry.run(projectCache[key], entryDate, channel || null, description, hours, 0);
        imported++;
      }
    });

    importAll();
    res.json({ success: true, imported });
  } catch (err) {
    console.error('Import-Fehler:', err);
    res.status(500).json({ error: 'Import fehlgeschlagen: ' + err.message });
  }
});

function mapStatus(s) {
  if (s.includes('bezahlt') || s.includes('paid')) return 'bezahlt';
  if (s.includes('rechnung') || s.includes('invoice')) return 'rechnung_gestellt';
  return 'offen';
}

module.exports = router;
