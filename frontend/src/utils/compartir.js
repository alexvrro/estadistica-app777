/**
 * Compartir un análisis por enlace: los datos, las opciones y el contexto viajan
 * comprimidos en el fragmento de la URL (#a=…), así que no pasan por el servidor.
 * Prefijo «z»: JSON comprimido con deflate · prefijo «j»: JSON sin comprimir
 * (navegadores sin CompressionStream).
 */

const aBase64Url = (bytes) => {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const deBase64Url = (texto) => {
  const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
};

async function transformar(bytes, flujo) {
  const salida = new Blob([bytes]).stream().pipeThrough(flujo);
  return new Uint8Array(await new Response(salida).arrayBuffer());
}

/** { datos, opciones, contexto } → URL completa para compartir. */
export async function crearEnlace({ datos, opciones, contexto }) {
  const paquete = {
    d: datos,
    o: {
      modo: opciones.modo,
      clases: opciones.clases,
      amplitud: opciones.amplitud,
      limiteInicial: opciones.limiteInicial,
      percentiles: opciones.percentiles,
      deciles: opciones.deciles,
    },
    c: { variable: contexto.variable, unidad: contexto.unidad },
  };
  const json = new TextEncoder().encode(JSON.stringify(paquete));
  const codigo =
    typeof CompressionStream === 'function'
      ? `z${aBase64Url(await transformar(json, new CompressionStream('deflate-raw')))}`
      : `j${aBase64Url(json)}`;
  const url = new URL(window.location.href);
  url.hash = `a=${codigo}`;
  return url.toString();
}

/** Lee el análisis compartido del fragmento actual, o null si no hay (o está dañado). */
export async function leerEnlace(hash = window.location.hash) {
  const m = /^#a=([zj])([\w-]+)$/.exec(hash);
  if (!m) return null;
  try {
    let bytes = deBase64Url(m[2]);
    if (m[1] === 'z') bytes = await transformar(bytes, new DecompressionStream('deflate-raw'));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(p.d) || p.d.length < 2 || !p.d.every(Number.isFinite)) return null;
    return { datos: p.d, opciones: p.o || {}, contexto: p.c || {} };
  } catch {
    return null;
  }
}
