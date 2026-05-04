# Finanzfokus Zeiterfassung

Projektzeiterfassung für Finanzfokus GmbH – intern, kein Login erforderlich.

## Setup

```bash
# Alle Abhängigkeiten installieren
npm run install:all

# App starten (Backend + Frontend gleichzeitig)
npm run dev
```

**Frontend:** http://localhost:5173  
**Backend API:** http://localhost:3001

Die SQLite-Datenbank wird automatisch unter `server/zeiterfassung.db` erstellt und mit Beispieldaten befüllt.

## Funktionen

- **Dashboard** – Übersicht nach Status (offen / Rechnung gestellt / bezahlt)
- **Projektverwaltung** – CRUD mit Pauschalpreis, Rabatt, Stundensatz
- **Stoppuhr** – Start/Stop, automatische Stundenberechnung (auf ¼h gerundet)
- **Zeiteinträge** – Manuell oder via Stoppuhr, mit Kanal und kostenlos-Markierung
- **PDF Rapport** – A4-Rapport mit Finanzfokus-Branding
- **Excel Import** – .xlsx Dateien importieren
- **Bexio-Notiz** – Formatierter Text für Clipboard-Kopie

## Technologie

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express + SQLite (better-sqlite3)
- PDF: pdfkit
- Import: xlsx
