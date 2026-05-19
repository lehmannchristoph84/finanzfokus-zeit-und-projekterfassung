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
    // range:2 = Zeile 3 als Kopfzeile verwenden (0-indexiert)
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', range: 2 });

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
    let lastClientName = '';
    let lastTopic = '';
    let lastStatus = 'offen';

    const importAll = db.transaction(() => {
      for (const row of rows) {
        // Kundenname wird nur in der ersten Zeile des Blocks eingetragen
        const rawClient = String(row['Kunde / Name'] || row['Kunde'] || row['client_name'] || '').trim();
        const rawTopic  = String(row['Thema'] || row['topic'] || '').trim();
        if (rawClient) { lastClientName = rawClient; lastTopic = rawTopic; }
        if (rawTopic)  { lastTopic = rawTopic; }

        const clientName = lastClientName;
        const topic      = lastTopic;
        if (!clientName) continue;

        const description = String(
          row['Arbeit / Bemerkung'] || row['Arbeit/Bemerkung'] || row['Bemerkung'] || row['description'] || ''
        ).trim();
        const hours = parseFloat(row['Stunden'] || row['hours'] || 0) || 0;

        // Leere Zeilen oder Summenzeilen überspringen
        if (!description || hours === 0) continue;

        // Datum steht in Spalte "Kanal" (so hat der User seine Excel aufgebaut)
        let entryDate = row['Kanal'] || row['Datum'] || null;
        if (entryDate instanceof Date) {
          entryDate = entryDate.toISOString().split('T')[0];
        } else if (entryDate) {
          const s = String(entryDate).trim();
          // Format DD.MM.YY oder DD.MM.YYYY
          const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
          if (m) {
            let y = m[3]; if (y.length === 2) y = '20' + y;
            entryDate = `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
          } else {
            entryDate = s;
          }
        }

        // Jahr aus Datum ableiten
        let year = new Date().getFullYear();
        if (entryDate) { const d = new Date(entryDate); if (!isNaN(d)) year = d.getFullYear(); }

        // Status aus der letzten Statusangabe im Block
        const rawStatus = String(row['Rechnungs Status'] || row['RechnungsStatus'] || '').trim().toLowerCase();
        if (rawStatus) lastStatus = rawStatus;

        // is_free wenn Beschreibung "Kostenlos" enthält oder Total = 0
        const total = parseFloat(row['Total'] || 0) || 0;
        const is_free = (description.toLowerCase().includes('kostenlos') || (hours > 0 && total === 0)) ? 1 : 0;

        const hourlyRate = 125;

        const key = `${clientName}|${topic}`;
        if (!projectCache[key]) {
          const existing = db.prepare(
            'SELECT id FROM projects WHERE client_name = ? AND topic = ?'
          ).get(clientName, topic);
          if (existing) {
            projectCache[key] = existing.id;
          } else {
            const p = insertProject.run(clientName, topic || null, hourlyRate,
              mapStatus(lastStatus), year);
            projectCache[key] = p.lastInsertRowid;
          }
        }

        insertEntry.run(projectCache[key], entryDate || null, null, description, hours, is_free);
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
