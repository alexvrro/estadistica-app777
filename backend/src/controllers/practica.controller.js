const repo = require('../repositories/practica.repo');
const { normalizarIntento, resumirProgreso } = require('../services/practica.service');
const { registrar } = require('../services/historial.service');

/** POST /api/practicas — guarda el resultado de un ejercicio y devuelve el progreso. */
async function guardar(req, res, next) {
  try {
    const intento = normalizarIntento(req.body);
    const id = await repo.insertar(intento);
    res.status(201).json({ id, progreso: resumirProgreso(await repo.listar()) });
    registrar('PRACTICA', `${intento.aciertos}/${intento.total} correctas · n=${intento.n}`);
  } catch (err) {
    next(err);
  }
}

/** GET /api/practicas/progreso */
async function progreso(_req, res, next) {
  try {
    res.json(resumirProgreso(await repo.listar()));
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/practicas — reinicia el progreso. */
async function reiniciar(_req, res, next) {
  try {
    const filas = await repo.borrarTodo();
    res.json({ mensaje: 'Progreso reiniciado', eliminados: filas });
    registrar('REINICIAR_PRACTICAS', `${filas} intento(s) eliminados`);
  } catch (err) {
    next(err);
  }
}

module.exports = { guardar, progreso, reiniciar };
