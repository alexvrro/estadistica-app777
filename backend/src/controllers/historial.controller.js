const { configurado } = require('../db/mysql');
const { listar } = require('../services/historial.service');

/** GET /api/historial */
async function obtener(req, res, next) {
  try {
    if (!configurado) {
      return res.json({ disponible: false, operaciones: [], aviso: 'MySQL no configurado (defina MYSQL_DATABASE en .env).' });
    }
    const operaciones = await listar(req.query.limite);
    res.json({ disponible: true, operaciones });
  } catch (err) {
    next(err);
  }
}

module.exports = { obtener };
