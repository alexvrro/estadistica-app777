const repo = require('../repositories/registro.repo');
const { procesar } = require('./estadistica.controller');
const { registrar } = require('../services/historial.service');
const { compararAnalisis } = require('../services/ia.service');

const idValido = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

/** POST /api/registros — recalcula en el servidor y guarda el análisis con sus datos. */
async function guardar(req, res, next) {
  try {
    const { datos: _datos, contexto = {}, ...opciones } = req.body || {};
    const r = procesar(req.body);
    const t = r.medidas.tendenciaCentral;
    const d = r.medidas.dispersion;

    const id = await repo.insertar({
      variable: contexto.variable ?? null,
      unidad: contexto.unidad ?? null,
      n: r.parametros.n,
      media: t.media.valor,
      mediana: t.mediana.valor,
      desviacion: d.desviacion.valor,
      cv: d.coeficienteVariacion.valor,
      datos: JSON.stringify(r.datos.ordenados),
      opciones: JSON.stringify(opciones),
      resultado: JSON.stringify(r),
    });

    res.status(201).json({ id, mensaje: 'Registro guardado' });
    registrar('GUARDAR_REGISTRO', `#${id}${contexto.variable ? ' ' + contexto.variable : ''}`);
  } catch (err) {
    next(err);
  }
}

/** GET /api/registros — lista resumida. */
async function listar(_req, res, next) {
  try {
    res.json({ registros: await repo.listar() });
  } catch (err) {
    next(err);
  }
}

/** GET /api/registros/:id — registro completo con datos y resultado. */
async function obtener(req, res, next) {
  try {
    const id = idValido(req.params.id);
    const fila = id ? await repo.obtener(id) : null;
    if (!fila) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({
      ...fila,
      datos: JSON.parse(fila.datos),
      opciones: JSON.parse(fila.opciones),
      resultado: JSON.parse(fila.resultado),
    });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/registros/:id */
async function eliminar(req, res, next) {
  try {
    const id = idValido(req.params.id);
    const filas = id ? await repo.eliminar(id) : 0;
    if (!filas) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ mensaje: 'Registro eliminado' });
    registrar('ELIMINAR_REGISTRO', `#${id}`);
  } catch (err) {
    next(err);
  }
}

/** POST /api/registros/comparar { a, b } — comparación redactada de dos registros guardados. */
async function comparar(req, res, next) {
  try {
    const a = idValido(req.body?.a);
    const b = idValido(req.body?.b);
    if (!a || !b) return res.status(400).json({ error: 'Elige dos registros para comparar.' });
    if (a === b) return res.status(400).json({ error: 'Elige dos registros distintos.' });
    const [filaA, filaB] = await Promise.all([repo.obtener(a), repo.obtener(b)]);
    if (!filaA || !filaB) return res.status(404).json({ error: 'Registro no encontrado' });

    const ctx = (f, letra) => ({ variable: f.variable || `registro #${f.id} (${letra})`, unidad: f.unidad || '' });
    const texto = await compararAnalisis(JSON.parse(filaA.resultado), ctx(filaA, 'A'), JSON.parse(filaB.resultado), ctx(filaB, 'B'));
    res.json(texto);
    registrar('COMPARACION', `#${a} vs #${b} · proveedor=${texto.proveedor}`);
  } catch (err) {
    next(err);
  }
}

module.exports = { guardar, listar, obtener, eliminar, comparar };
