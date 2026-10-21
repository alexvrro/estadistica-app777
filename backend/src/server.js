const fs = require('fs');
const { RUTA_ENV } = require('./utils/entorno');

require('dotenv').config({ path: RUTA_ENV });
const app = require('./app');
const { iniciar } = require('./db/mysql');

const PORT = Number(process.env.PORT) || 3001;

(async () => {
  if (!fs.existsSync(RUTA_ENV)) {
    console.warn('⚠ No existe backend/.env. Créalo con: npm run configurar');
  }

  try {
    if (await iniciar()) {
      console.log('✔ MySQL conectado: tablas historial_operaciones y registros_analisis listas');
    } else {
      console.warn('⚠ MYSQL_DATABASE vacío: el registro y el historial no funcionarán');
    }
  } catch (err) {
    console.warn('⚠ No se pudo conectar a MySQL:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`✔ API de Estadística escuchando en http://localhost:${PORT}`);
    console.log(`  Proveedor de IA: ${process.env.IA_PROVEEDOR || 'gemini'}`);
  });
})();
