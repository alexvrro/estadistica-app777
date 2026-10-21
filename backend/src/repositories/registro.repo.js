const { requerirMySQL } = require('../db/mysql');

// mysql2 no acepta undefined como parámetro: se convierte a NULL
const nulos = (valores) => valores.map((v) => (v === undefined ? null : v));

async function insertar(r) {
  const [res] = await requerirMySQL().execute(
    `INSERT INTO registros_analisis
       (variable, unidad, n, media, mediana, desviacion, cv, datos, opciones, resultado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    nulos([r.variable, r.unidad, r.n, r.media, r.mediana, r.desviacion, r.cv, r.datos, r.opciones, r.resultado])
  );
  return res.insertId;
}

/** Lista resumida (sin datos ni resultado completo), la más reciente primero. */
async function listar() {
  const [filas] = await requerirMySQL().query(
    `SELECT id, creado_en, variable, unidad, n, media, mediana, desviacion, cv
       FROM registros_analisis ORDER BY id DESC LIMIT 200`
  );
  return filas;
}

async function obtener(id) {
  const [filas] = await requerirMySQL().execute('SELECT * FROM registros_analisis WHERE id = ?', [id]);
  return filas[0] || null;
}

async function eliminar(id) {
  const [res] = await requerirMySQL().execute('DELETE FROM registros_analisis WHERE id = ?', [id]);
  return res.affectedRows;
}

module.exports = { insertar, listar, obtener, eliminar };
