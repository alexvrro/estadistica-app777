/**
 * Diagrama de tallo y hoja para datos sin agrupar.
 * Elige la unidad de la hoja (…, 0.1, 1, 10, …) para que haya entre 5 y 20 tallos
 * siempre que se pueda, y redondea cada dato a esa unidad.
 */

const MAX_TALLOS = 20;

/** Cantidad de decimales que usa el dato con más decimales (máximo 6). */
function decimalesDe(datos) {
  return Math.min(6, Math.max(0, ...datos.map((x) => (String(x).split('.')[1] || '').length)));
}

function tallosCon(unidad, min, max) {
  return Math.floor(Math.round(max / unidad) / 10) - Math.floor(Math.round(min / unidad) / 10) + 1;
}

/**
 * @param {number[]} ordenados datos ordenados de menor a mayor
 * @returns {{ unidad: number, filas: { tallo: number, hojas: number[] }[], redondeados: boolean }}
 */
export function talloHoja(ordenados) {
  const min = ordenados[0];
  const max = ordenados.at(-1);
  const dec = decimalesDe(ordenados);

  // La hoja más fina posible es la precisión de los datos; se engrosa si hay demasiados tallos
  let unidad = 10 ** -dec;
  while (tallosCon(unidad, min, max) > MAX_TALLOS) unidad *= 10;
  unidad = Number(unidad.toPrecision(1));

  const filas = new Map();
  let redondeados = false;
  for (const x of ordenados) {
    const entero = Math.round(x / unidad);
    if (Math.abs(entero * unidad - x) > 1e-9) redondeados = true;
    // Con floor los negativos quedan en el tallo correcto: −7 → tallo −1, hoja 3
    const tallo = Math.floor(entero / 10);
    const hoja = entero - tallo * 10;
    if (!filas.has(tallo)) filas.set(tallo, []);
    filas.get(tallo).push(hoja);
  }

  // También se muestran los tallos vacíos intermedios
  const primero = Math.floor(Math.round(min / unidad) / 10);
  const ultimo = Math.floor(Math.round(max / unidad) / 10);
  const lista = [];
  for (let t = primero; t <= ultimo; t++) lista.push({ tallo: t, hojas: (filas.get(t) || []).sort((a, b) => a - b) });

  return { unidad, filas: lista, redondeados };
}

/** Texto de la clave: «4 | 5 = 45». */
export function claveTalloHoja({ unidad, filas }) {
  const ejemplo = filas.find((f) => f.hojas.length) || { tallo: 0, hojas: [0] };
  const valor = (ejemplo.tallo * 10 + ejemplo.hojas[0]) * unidad;
  const decimales = Math.max(0, -Math.floor(Math.log10(unidad)));
  return `${ejemplo.tallo} | ${ejemplo.hojas[0]} = ${valor.toFixed(decimales)}`;
}
