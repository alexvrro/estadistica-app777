const { pool } = require('../db/mysql');

/** Inserta una operación. La fecha la asigna MySQL. */
async function insertar(tipoOperacion, detalle) {
  const [res] = await pool.execute(
    'INSERT INTO historial_operaciones (tipo_operacion, detalle) VALUES (?, ?)',
    [tipoOperacion, detalle]
  );
  return res.insertId;
}

/** Operaciones más recientes primero. El límite se valida como entero antes de usarlo. */
async function listar(limite = 200) {
  const n = Math.min(Math.max(parseInt(limite, 10) || 200, 1), 500);
  const [filas] = await pool.query(
    `SELECT id, tipo_operacion, detalle, fecha FROM historial_operaciones ORDER BY id DESC LIMIT ${n}`
  );
  return filas;
}

module.exports = { insertar, listar };
