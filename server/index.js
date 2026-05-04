const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routen
const projectsRouter = require('./routes/projects');
const entriesRouter  = require('./routes/entries');
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
app.post('/api/import', require('./routes/entries'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
