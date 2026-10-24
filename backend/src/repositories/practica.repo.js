const { requerirMySQL } = require('../db/mysql');

/** `detalle`: { media: true, varianza: false, ... } (qué medidas acertó). */
async function insertar({ n, aciertos, total, detalle }) {
  const [res] = await requerirMySQL().execute(
    'INSERT INTO practicas (n, aciertos, total, detalle) VALUES (?, ?, ?, ?)',
    [n, aciertos, total, JSON.stringify(detalle)]
  );
  return res.insertId;
}

/** Todos los intentos, el más reciente primero (para calcular el progreso). */
async function listar(limite = 500) {
  const [filas] = await requerirMySQL().query(
    `SELECT id, creado_en, n, aciertos, total, detalle FROM practicas ORDER BY id DESC LIMIT ${Number(limite)}`
  );
  return filas.map((f) => ({ ...f, detalle: JSON.parse(f.detalle) }));
}

async function borrarTodo() {
  const [res] = await requerirMySQL().execute('DELETE FROM practicas');
  return res.affectedRows;
}

module.exports = { insertar, listar, borrarTodo };
