/** Formatea un número con `d` decimales, quitando ceros sobrantes si `compacto`. */
export function num(x, d = 2, compacto = false) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  const s = Number(x).toFixed(d);
  return compacto ? String(Number(s)) : s;
}

/** MySQL devuelve la fecha en UTC; se muestra en la hora local del navegador. */
export function formatearFecha(f) {
  if (!f) return '—';
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? String(f) : d.toLocaleString('es-MX');
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

const esNumero = (t) => t !== '' && Number.isFinite(Number(t));

/**
 * Extrae los datos numéricos del contenido de un archivo (.csv, .tsv, .txt) o de
 * texto pegado desde Excel.
 * - Si es una tabla (separada por tabulador o «;», o por comas con encabezado),
 *   toma la primera columna mayormente numérica que no sea un número de fila. Con «;» o tabulador
 *   acepta coma decimal (12,5).
 * - Si no, toma todos los números del texto.
 * Devuelve { valores, columna, ignorados }.
 */
export function extraerDatosDeTexto(texto) {
  const lineas = String(texto)
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const separador = ['\t', ';', ','].find((d) => {
    if (lineas.length < 2 || lineas.filter((l) => l.includes(d)).length < lineas.length * 0.8) return false;
    // Con comas solo es tabla si la primera fila es un encabezado (no numérico)
    return d !== ',' || lineas[0].split(',').some((c) => !esNumero(c.trim()));
  });

  if (separador) {
    const celdas = lineas.map((l) => l.split(separador).map((c) => c.trim().replace(/^"|"$/g, '')));
    const limpiar = (c) => (separador === ',' ? c : c.replace(/\s/g, '').replace(',', '.'));
    const conEncabezado = celdas[0].some((c) => c && !esNumero(limpiar(c)));
    const filas = conEncabezado ? celdas.slice(1) : celdas;
    const columnas = Math.max(...celdas.map((f) => f.length));
    // Una columna 1, 2, 3, … es un número de fila (id), no un dato
    const esIndice = (v) => v.length > 2 && v.every((x, i) => x === v[0] + i);
    const candidatas = Array.from({ length: columnas }, (_, j) => ({
      j,
      valores: filas.map((f) => limpiar(f[j] ?? '')).filter(esNumero).map(Number),
    })).filter((c) => c.valores.length && !esIndice(c.valores));
    // La primera con ≥ 80 % de números; si no hay, la que tenga más (al menos la mitad)
    const elegida =
      candidatas.find((c) => c.valores.length >= filas.length * 0.8) ||
      candidatas.filter((c) => c.valores.length >= filas.length * 0.5).sort((a, b) => b.valores.length - a.valores.length)[0];
    if (elegida) {
      return {
        valores: elegida.valores,
        columna: conEncabezado ? celdas[0][elegida.j] || `columna ${elegida.j + 1}` : `columna ${elegida.j + 1}`,
        ignorados: filas.length - elegida.valores.length,
      };
    }
  }

  const tokens = String(texto).split(/[\s,;]+/).filter(Boolean);
  const valores = tokens.filter(esNumero).map(Number);
  return { valores, columna: null, ignorados: tokens.length - valores.length };
}
