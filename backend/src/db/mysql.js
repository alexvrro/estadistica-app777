/**
 * Conexión a MySQL (driver mysql2). Compatible con MySQL 5.7 y 8.0.
 * Se activa cuando MYSQL_DATABASE está definido en backend/.env, o con MYSQL_URL
 * (mysql://usuario:clave@host:puerto/base), que es lo que entregan los hostings.
 */
const mysql = require('mysql2/promise');

const url = process.env.MYSQL_URL;
const configurado = Boolean(url || process.env.MYSQL_DATABASE);

const pool = !configurado
  ? null
  : url
    ? mysql.createPool({ uri: url, charset: 'utf8mb4', waitForConnections: true, connectionLimit: 5 })
    : mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 5,
      });

/** Devuelve el pool o lanza un error 503 con un mensaje claro. */
function requerirMySQL() {
  if (!pool) {
    const err = new Error('MySQL no está configurado. Defina MYSQL_DATABASE en backend/.env.');
    err.status = 503;
    throw err;
  }
  return pool;
}

// Nota MySQL 5.7: DATETIME no admite DEFAULT CURRENT_TIMESTAMP; se usa TIMESTAMP.
const TABLAS = [
  `CREATE TABLE IF NOT EXISTS historial_operaciones (
     id              INT AUTO_INCREMENT PRIMARY KEY,
     tipo_operacion  VARCHAR(50) NOT NULL,
     detalle         TEXT,
     fecha           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS registros_analisis (
     id          INT AUTO_INCREMENT PRIMARY KEY,
     creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     variable    VARCHAR(255) NULL,
     unidad      VARCHAR(50) NULL,
     n           INT NOT NULL,
     media       DOUBLE NULL,
     mediana     DOUBLE NULL,
     desviacion  DOUBLE NULL,
     cv          DOUBLE NULL,
     datos       LONGTEXT NOT NULL,
     opciones    TEXT NOT NULL,
     resultado   LONGTEXT NOT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

/** Crea las tablas si no existen. Devuelve false si MySQL no está configurado. */
async function iniciar() {
  if (!pool) return false;
  for (const sql of TABLAS) await pool.query(sql);
  return true;
}

module.exports = { pool, configurado, iniciar, requerirMySQL };
