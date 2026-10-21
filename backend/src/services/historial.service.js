const { configurado } = require('../db/mysql');
const repo = require('../repositories/historial.repo');

/**
 * Registra una operación del usuario. Nunca lanza errores: si MySQL falla,
 * la operación principal sigue funcionando y solo queda un aviso en consola.
 */
async function registrar(tipo, detalle) {
  if (!configurado) return;
  try {
    await repo.insertar(tipo, String(detalle ?? '').slice(0, 60000));
  } catch (err) {
    console.error('[historial] no se pudo guardar la operación:', err.message);
  }
}

/** Resumen corto de un análisis para el detalle del historial. */
function resumenAnalisis(payload, r) {
  const v = payload?.contexto?.variable ? `${payload.contexto.variable}: ` : '';
  const m = r.medidas.tendenciaCentral;
  return `${v}n=${r.parametros.n}, x̄=${m.media.valor.toFixed(2)}, Me=${m.mediana.valor.toFixed(2)}, k=${r.parametros.k}, A=${r.parametros.amplitud}`;
}

module.exports = { registrar, resumenAnalisis, listar: repo.listar };
