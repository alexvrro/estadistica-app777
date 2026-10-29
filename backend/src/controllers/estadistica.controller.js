const { analizar } = require('../services/estadistica.service');
const { registrar, resumenAnalisis } = require('../services/historial.service');
const { normalizarDatos, normalizarOpciones, ErrorValidacion } = require('../utils/validacion');
const { MUESTRA_EJEMPLO } = require('../data/muestra');

function procesar(body) {
  const datos = normalizarDatos(body?.datos);
  const opciones = normalizarOpciones(body);
  if (opciones.limiteInicial !== undefined && opciones.limiteInicial > Math.min(...datos)) {
    throw new ErrorValidacion('El límite inicial no puede ser mayor que el dato mínimo.');
  }
  return analizar(datos, opciones);
}

/** POST /api/estadistica/analizar — `origen: "automatico"` no se registra en el historial. */
function analizarDatos(req, res, next) {
  try {
    const r = procesar(req.body);
    res.json(r);
    if (req.body?.origen !== 'automatico') {
      registrar('ANALISIS', resumenAnalisis(req.body, r));
    }
  } catch (err) {
    next(err);
  }
}

/** GET /api/estadistica/ejemplo */
function ejemplo(_req, res) {
  res.json({ datos: MUESTRA_EJEMPLO, contexto: { variable: 'tiempo de respuesta de un servidor', unidad: 'ms' } });
}

module.exports = { analizarDatos, ejemplo, procesar };
