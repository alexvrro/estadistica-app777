const { ErrorValidacion } = require('../utils/validacion');

// Medidas que puede incluir un intento del modo práctica (ver frontend/Practica.jsx)
const MEDIDAS = ['media', 'mediana', 'moda', 'varianza', 'desviacion', 'cv', 'q1', 'q3'];

/** Valida el cuerpo de POST /api/practicas y lo deja listo para guardar. */
function normalizarIntento(body = {}) {
  const n = Number(body.n);
  if (!Number.isInteger(n) || n < 2) throw new ErrorValidacion('"n" debe ser un entero mayor o igual a 2.');
  if (!body.detalle || typeof body.detalle !== 'object' || Array.isArray(body.detalle)) {
    throw new ErrorValidacion('"detalle" debe ser un objeto { medida: true | false }.');
  }
  const detalle = {};
  for (const [medida, acierto] of Object.entries(body.detalle)) {
    if (MEDIDAS.includes(medida)) detalle[medida] = Boolean(acierto);
  }
  const total = Object.keys(detalle).length;
  if (!total) throw new ErrorValidacion('El intento no tiene medidas válidas.');
  const aciertos = Object.values(detalle).filter(Boolean).length;
  return { n, aciertos, total, detalle };
}

/**
 * Resume los intentos (el más reciente primero): totales, porcentaje por medida
 * y la racha de intentos perfectos más reciente.
 */
function resumirProgreso(intentos) {
  const porMedida = {};
  for (const intento of intentos) {
    for (const [medida, acierto] of Object.entries(intento.detalle)) {
      porMedida[medida] ??= { intentos: 0, aciertos: 0 };
      porMedida[medida].intentos += 1;
      if (acierto) porMedida[medida].aciertos += 1;
    }
  }
  const aciertos = intentos.reduce((s, i) => s + i.aciertos, 0);
  const total = intentos.reduce((s, i) => s + i.total, 0);
  const racha = intentos.findIndex((i) => i.aciertos < i.total);

  return {
    ejercicios: intentos.length,
    porcentaje: total ? (aciertos / total) * 100 : null,
    rachaPerfecta: racha === -1 ? intentos.length : racha,
    porMedida: MEDIDAS.filter((m) => porMedida[m]).map((m) => ({
      medida: m,
      ...porMedida[m],
      porcentaje: (porMedida[m].aciertos / porMedida[m].intentos) * 100,
    })),
    recientes: intentos.slice(0, 10).map(({ id, creado_en, n, aciertos: a, total: t }) => ({ id, creado_en, n, aciertos: a, total: t })),
  };
}

module.exports = { MEDIDAS, normalizarIntento, resumirProgreso };
