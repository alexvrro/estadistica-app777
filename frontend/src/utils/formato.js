/** Formatea un número con `d` decimales, quitando ceros sobrantes si `compacto`. */
export function num(x, d = 2, compacto = false) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  const s = Number(x).toFixed(d);
  return compacto ? String(Number(s)) : s;
}

/** Convierte el texto del área de datos en números (para el contador en vivo). */
export function parsearDatos(texto) {
  const tokens = texto.split(/[\s,;]+/).filter(Boolean);
  const validos = [];
  const invalidos = [];
  for (const t of tokens) {
    const n = Number(t);
    if (Number.isFinite(n)) validos.push(n);
    else invalidos.push(t);
  }
  return { validos, invalidos };
}

/** Lista "17, 90" → [17, 90] */
export function parsearLista(texto) {
  return String(texto)
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}
