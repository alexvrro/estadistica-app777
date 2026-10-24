const { analizar } = require('../services/estadistica.service');
const { generarInterpretacion, responderChat } = require('../services/ia.service');
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

/** POST /api/estadistica/interpretar */
async function interpretar(req, res, next) {
  try {
    const resultados = procesar(req.body);
    const contexto = req.body?.contexto || {};
    const interpretacion = await generarInterpretacion(resultados, contexto);
    res.json(interpretacion);
    registrar(
      'INTERPRETACION',
      `${contexto.variable ? contexto.variable + ': ' : ''}proveedor=${interpretacion.proveedor}${interpretacion.respaldo ? ' (respaldo local)' : ''}`
    );
  } catch (err) {
    next(err);
  }
}

/** Conversación del chat: hasta 20 mensajes de 2000 caracteres; el último es del usuario. */
function normalizarMensajes(mensajes) {
  if (!Array.isArray(mensajes) || !mensajes.length) throw new ErrorValidacion('"mensajes" debe ser una lista con al menos una pregunta.');
  const lista = mensajes.slice(-20).map((m) => ({
    rol: m?.rol === 'tutor' ? 'tutor' : 'usuario',
    texto: String(m?.texto ?? '').trim().slice(0, 2000),
  }));
  if (lista.at(-1).rol !== 'usuario' || !lista.at(-1).texto) throw new ErrorValidacion('Escribe una pregunta.');
  // Los proveedores exigen que la conversación empiece con el usuario
  while (lista[0].rol !== 'usuario') lista.shift();
  return lista;
}

/** POST /api/estadistica/chat — pregunta de seguimiento al tutor sobre el análisis actual. */
async function chat(req, res, next) {
  try {
    const mensajes = normalizarMensajes(req.body?.mensajes);
    const resultados = procesar(req.body);
    const respuesta = await responderChat(resultados, req.body?.contexto || {}, mensajes);
    res.json(respuesta);
    registrar('CHAT_TUTOR', mensajes.at(-1).texto.slice(0, 200));
  } catch (err) {
    next(err);
  }
}

/** GET /api/estadistica/ejemplo */
function ejemplo(_req, res) {
  res.json({ datos: MUESTRA_EJEMPLO, contexto: { variable: 'tiempo de respuesta de un servidor', unidad: 'ms' } });
}

module.exports = { analizarDatos, interpretar, chat, ejemplo, procesar, normalizarMensajes };
