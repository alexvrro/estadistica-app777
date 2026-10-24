const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const estadisticaRoutes = require('./routes/estadistica.routes');
const registroRoutes = require('./routes/registro.routes');
const historialRoutes = require('./routes/historial.routes');
const practicaRoutes = require('./routes/practica.routes');
const { configurado: mysqlConfigurado } = require('./db/mysql');
const { claveReal } = require('./utils/entorno');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/salud', (_req, res) => {
  const proveedor = (process.env.IA_PROVEEDOR || 'gemini').toLowerCase();
  const clave = { anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }[proveedor];
  res.json({
    estado: 'ok',
    ia: { proveedor, configurada: Boolean(clave && claveReal(process.env[clave])) },
    mysql: { configurada: mysqlConfigurado },
  });
});

app.use('/api/estadistica', estadisticaRoutes);
app.use('/api/registros', registroRoutes);
app.use('/api/historial', historialRoutes);
app.use('/api/practicas', practicaRoutes);

// En producción el mismo servidor entrega el frontend compilado (npm run build)
const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile('index.html', { root: DIST }));
}

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejador central de errores
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor' : err.message });
});

module.exports = app;
