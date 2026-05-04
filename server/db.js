const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'zeiterfassung.db');
const db = new Database(DB_PATH);

// WAL-Modus für bessere Performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema erstellen
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name     TEXT NOT NULL,
    topic           TEXT,
    hourly_rate     REAL DEFAULT 125,
    flat_rate       REAL,
    flat_rate_note  TEXT,
    status          TEXT DEFAULT 'offen' CHECK(status IN ('offen','rechnung_gestellt','bezahlt')),
    invoice_date    TEXT,
    invoice_note    TEXT,
    discount_percent INTEGER,
    year            INTEGER DEFAULT 2026,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entry_date  TEXT,
    channel     TEXT,
    description TEXT NOT NULL,
    hours       REAL DEFAULT 0,
    billable    INTEGER DEFAULT 1,
    is_free     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// Seed-Daten nur einfügen wenn DB leer
const count = db.prepare('SELECT COUNT(*) as c FROM projects').get();
if (count.c === 0) {
  const insertProject = db.prepare(`
    INSERT INTO projects (client_name, topic, hourly_rate, flat_rate, flat_rate_note, status, year)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEntry = db.prepare(`
    INSERT INTO time_entries (project_id, entry_date, channel, description, hours, is_free)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const p1 = insertProject.run('Hofer Barbara', 'Pensionsplanung', 125, 550, 'max. Pauschal 550.- abgemacht', 'offen', 2026);
  insertEntry.run(p1.lastInsertRowid, '2026-01-15', 'Vor Ort', 'Erstgespräch – Analyse Pensionssituation', 1.5, 1);
  insertEntry.run(p1.lastInsertRowid, '2026-02-03', 'E-Mail', 'Unterlagen zusammengestellt und geprüft', 1.0, 0);
  insertEntry.run(p1.lastInsertRowid, '2026-02-20', 'Teams', 'Pensionsplanung besprochen, Optimierungen definiert', 2.0, 0);

  const p2 = insertProject.run('Leu Helena', 'Pensionsplanung', 125, null, null, 'offen', 2026);
  insertEntry.run(p2.lastInsertRowid, '2026-03-10', 'Telefon', 'Erstgespräch – Situation besprochen', 0.5, 1);
  insertEntry.run(p2.lastInsertRowid, '2026-03-25', 'Vor Ort', 'Detailanalyse 3. Säule und BVG', 2.5, 0);

  console.log('Seed-Daten eingefügt');
}

module.exports = db;
