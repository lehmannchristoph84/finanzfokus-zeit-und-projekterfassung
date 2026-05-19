const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// In Production: gebautes React-Frontend ausliefern
if (isProd) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Routen
const projectsRouter = require('./routes/projects');
const entriesRouter = require('./routes/entries');
const pdfRouter      = require('./routes/pdf');

app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/entries', entriesRouter);
app.use('/api/projects/:projectId/pdf', pdfRouter);

// Globale Eintrags-Routen (PUT/DELETE /api/entries/:id)
app.use('/api/entries', entriesRouter);

// Analyse-Routen
const analyticsRouter = require('./routes/analytics');
app.use('/api/analytics', analyticsRouter);

// Import-Route
app.post('/api/import', (req, res, next) => { req.url = '/import'; entriesRouter(req, res, next); });

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// SPA Fallback: alle nicht-API Routen → index.html
if (isProd) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
