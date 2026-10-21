/**
 * Utilidades para leer y escribir backend/.env (sin dependencias).
 * Las usan server.js, el tutor de IA y el asistente `npm run configurar`.
 */
const path = require('path');

const RUTA_ENV = path.join(__dirname, '..', '..', '.env');
const RUTA_EJEMPLO = path.join(__dirname, '..', '..', '.env.example');

// Valores de relleno de .env.example: no son claves reales.
const MARCADOR = /^(pon_aqui|tu_clave)/i;

/** true si el valor parece una clave real (no vacío ni de ejemplo). */
function claveReal(valor) {
  return Boolean(valor && valor.trim() && !MARCADOR.test(valor.trim()));
}

/** Convierte el texto de un .env en un objeto { CLAVE: valor }. */
function parsearEnv(texto) {
  const valores = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let valor = m[2].trim();
    const comillas = valor.match(/^(['"])(.*)\1$/);
    if (comillas) valor = comillas[2];
    else valor = valor.replace(/\s+#.*$/, '');
    valores[m[1]] = valor;
  }
  return valores;
}

/** Entrecomilla el valor si contiene espacios, # o comillas. */
function formatearValor(valor) {
  const v = String(valor ?? '');
  if (!/[\s#'"]/.test(v)) return v;
  return v.includes("'") ? `"${v.replace(/"/g, '\\"')}"` : `'${v}'`;
}

/**
 * Rellena la plantilla (.env.example) con los valores dados, conservando
 * comentarios y orden. Las claves que no están en la plantilla se agregan al final.
 */
function serializarEnv(plantilla, valores) {
  const usadas = new Set();
  const lineas = plantilla.split(/\r?\n/).map((linea) => {
    const m = linea.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m || !(m[2] in valores)) return linea;
    usadas.add(m[2]);
    return `${m[1]}${m[2]}=${formatearValor(valores[m[2]])}`;
  });
  const extra = Object.keys(valores).filter((k) => !usadas.has(k));
  if (extra.length) {
    lineas.push('', '# ── Otras variables ───────────────────────────────────────');
    for (const k of extra) lineas.push(`${k}=${formatearValor(valores[k])}`);
  }
  return `${lineas.join('\n').trimEnd()}\n`;
}

module.exports = { RUTA_ENV, RUTA_EJEMPLO, claveReal, parsearEnv, serializarEnv };
