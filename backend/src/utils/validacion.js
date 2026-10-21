/**
 * Validación y normalización de la entrada del endpoint.
 * Acepta un arreglo de números o un texto con números separados por
 * comas, espacios, punto y coma, tabs o saltos de línea.
 */

class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.status = 400;
  }
}

function normalizarDatos(entrada) {
  let crudos;
  if (Array.isArray(entrada)) {
    crudos = entrada;
  } else if (typeof entrada === 'string') {
    crudos = entrada.split(/[\s,;]+/).filter(Boolean);
  } else {
    throw new ErrorValidacion('El campo "datos" debe ser un arreglo de números o un texto con números.');
  }

  const datos = [];
  const invalidos = [];
  for (const v of crudos) {
    const num = typeof v === 'number' ? v : Number(String(v).trim());
    if (Number.isFinite(num)) datos.push(num);
    else invalidos.push(v);
  }

  if (invalidos.length) {
    throw new ErrorValidacion(`Valores no numéricos: ${invalidos.slice(0, 5).join(', ')}${invalidos.length > 5 ? '…' : ''}`);
  }
  if (datos.length < 2) throw new ErrorValidacion('Se necesitan al menos 2 datos.');
  if (datos.length > 100000) throw new ErrorValidacion('Máximo 100 000 datos por solicitud.');
  return datos;
}

function normalizarOpciones(body = {}) {
  const opciones = {};
  const entero = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

  const k = entero(body.clases);
  if (k !== undefined) {
    if (!Number.isInteger(k) || k < 1 || k > 50) throw new ErrorValidacion('"clases" debe ser un entero entre 1 y 50.');
    opciones.clases = k;
  }

  const A = entero(body.amplitud);
  if (A !== undefined) {
    if (!(A > 0)) throw new ErrorValidacion('"amplitud" debe ser mayor que 0.');
    opciones.amplitud = A;
  }

  const li = entero(body.limiteInicial);
  if (li !== undefined) {
    if (!Number.isFinite(li)) throw new ErrorValidacion('"limiteInicial" debe ser numérico.');
    opciones.limiteInicial = li;
  }

  opciones.modo = body.modo === 'discreto' ? 'discreto' : 'continuo';

  const lista = (v) =>
    (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,;]+/) : [])
      .filter((x) => x !== '')
      .map(Number)
      .filter(Number.isFinite);

  opciones.percentiles = lista(body.percentiles);
  opciones.deciles = lista(body.deciles);
  return opciones;
}

module.exports = { normalizarDatos, normalizarOpciones, ErrorValidacion };
