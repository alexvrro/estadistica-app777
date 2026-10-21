/**
 * Asistente para crear backend/.env desde cero.
 * Ejecutar: npm run configurar   (desde la raíz o desde backend/)
 *
 * 1. Clave de Gemini: la valida contra la API y elige un modelo disponible.
 * 2. MySQL: prueba la conexión y crea la base de datos si no existe.
 * 3. Escribe backend/.env a partir de .env.example.
 */
const fs = require('fs');
const readline = require('readline/promises');
const { Writable } = require('stream');
const mysql = require('mysql2/promise');
const { RUTA_ENV, RUTA_EJEMPLO, claveReal, parsearEnv, serializarEnv } = require('../src/utils/entorno');

const API_GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

// Salida intermedia: mientras `silenciar` es true no se muestra lo que se escribe (claves).
let silenciar = false;
const salida = new Writable({
  write(trozo, codificacion, listo) {
    if (!silenciar) process.stdout.write(trozo, codificacion);
    listo();
  },
});
salida.isTTY = process.stdout.isTTY;
Object.defineProperty(salida, 'columns', { get: () => process.stdout.columns });
const rl = readline.createInterface({
  input: process.stdin,
  output: salida,
  terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
});

const titulo = (t) => console.log(`\n\x1b[1m\x1b[36m── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}\x1b[0m`);
const ok = (t) => console.log(`\x1b[32m✔ ${t}\x1b[0m`);
const aviso = (t) => console.log(`\x1b[33m⚠ ${t}\x1b[0m`);
const error = (t) => console.log(`\x1b[31m✖ ${t}\x1b[0m`);

async function preguntar(texto, predeterminado = '') {
  const sufijo = predeterminado ? ` [${predeterminado}]` : '';
  const r = (await rl.question(`${texto}${sufijo}: `)).trim();
  return r || predeterminado;
}

async function confirmar(texto, si = true) {
  const r = (await rl.question(`${texto} ${si ? '[S/n]' : '[s/N]'}: `)).trim().toLowerCase();
  return r ? r.startsWith('s') || r.startsWith('y') : si;
}

/** Pregunta sin mostrar lo que se escribe (claves). Enter vacío = conservar el actual. */
async function preguntarOculto(texto, hayActual) {
  process.stdout.write(`${texto}${hayActual ? ' [Enter = conservar la actual]' : ''}: `);
  silenciar = true;
  const r = await rl.question('');
  silenciar = false;
  process.stdout.write('\n');
  return r.trim();
}

const ocultar = (clave) => (clave.length > 10 ? `${clave.slice(0, 4)}…${clave.slice(-4)}` : '****');

// ── Gemini ─────────────────────────────────────────────────

async function listarModelosGemini(clave) {
  const resp = await fetch(`${API_GEMINI}/models?pageSize=1000`, {
    headers: { 'x-goog-api-key': clave },
    signal: AbortSignal.timeout(20_000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const motivo = json?.error?.message || `HTTP ${resp.status}`;
    const err = new Error(resp.status === 400 || resp.status === 403 ? `la clave no es válida (${motivo})` : motivo);
    err.invalida = resp.status === 400 || resp.status === 403;
    throw err;
  }
  return (json.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => n.startsWith('gemini-'));
}

/** Ordena para recomendar primero los "flash" estables más recientes. */
function ordenarModelos(modelos) {
  const version = (n) => parseFloat(n.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] || '0');
  const puntaje = (n) =>
    (/-flash$/.test(n) ? 3 : /-flash/.test(n) && !/lite/.test(n) ? 2 : /flash/.test(n) ? 1 : 0) -
    (/preview|exp|tts|image|live|embedding|thinking/.test(n) ? 4 : 0);
  return [...modelos].sort((a, b) => puntaje(b) - puntaje(a) || version(b) - version(a) || a.localeCompare(b));
}

async function probarGemini(clave, modelo) {
  const resp = await fetch(`${API_GEMINI}/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Responde solo con la palabra: listo' }] }],
      generationConfig: { maxOutputTokens: 20 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error?.message || `HTTP ${resp.status}`);
}

async function configurarGemini(actual) {
  titulo('1/2 · Tutor de IA (Google Gemini)');
  console.log('Necesitas una clave de API gratuita de Google AI Studio:');
  console.log('  1. Entra a https://aistudio.google.com/apikey con tu cuenta de Google.');
  console.log('  2. Pulsa "Create API key" (o "Crear clave de API") y cópiala.');
  console.log('  3. Pégala aquí (no se mostrará en pantalla).');
  console.log('Si la dejas vacía, el tutor funcionará en "modo local" (sin IA externa).\n');

  const claveActual = claveReal(actual.GEMINI_API_KEY) ? actual.GEMINI_API_KEY : '';

  for (;;) {
    const escrita = await preguntarOculto('Clave de Gemini', Boolean(claveActual));
    const clave = escrita || claveActual;
    if (!clave) {
      aviso('Sin clave: el tutor usará el modo local.');
      return { IA_PROVEEDOR: 'gemini', GEMINI_API_KEY: '', GEMINI_MODEL: actual.GEMINI_MODEL || '' };
    }

    console.log(`Verificando la clave ${ocultar(clave)} …`);
    let modelos;
    try {
      modelos = ordenarModelos(await listarModelosGemini(clave));
    } catch (err) {
      error(`No se pudo verificar: ${err.message}`);
      if (await confirmar('¿Intentar con otra clave?')) continue;
      if (err.invalida) {
        aviso('Sin clave válida: el tutor usará el modo local.');
        return { IA_PROVEEDOR: 'gemini', GEMINI_API_KEY: '', GEMINI_MODEL: actual.GEMINI_MODEL || '' };
      }
      aviso('Se guardará la clave sin verificar (puede ser un problema de conexión).');
      return { IA_PROVEEDOR: 'gemini', GEMINI_API_KEY: clave, GEMINI_MODEL: actual.GEMINI_MODEL || '' };
    }
    if (!modelos.length) {
      error('La clave es válida pero no tiene modelos Gemini disponibles.');
      return { IA_PROVEEDOR: 'gemini', GEMINI_API_KEY: clave, GEMINI_MODEL: actual.GEMINI_MODEL || '' };
    }
    ok(`Clave válida: ${modelos.length} modelos disponibles.`);

    const recomendado = modelos.includes(actual.GEMINI_MODEL) ? actual.GEMINI_MODEL : modelos[0];
    const opciones = [recomendado, ...modelos.filter((m) => m !== recomendado)].slice(0, 8);
    opciones.forEach((m, i) => console.log(`  ${i + 1}. ${m}${i === 0 ? '  (recomendado)' : ''}`));
    const eleccion = await preguntar('Modelo (número o nombre)', '1');
    const modelo = opciones[Number(eleccion) - 1] || (modelos.includes(eleccion) ? eleccion : recomendado);

    console.log(`Probando ${modelo} …`);
    try {
      await probarGemini(clave, modelo);
      ok(`${modelo} respondió correctamente.`);
    } catch (err) {
      aviso(`El modelo no respondió (${err.message}). Puedes cambiar GEMINI_MODEL en .env más tarde.`);
    }
    return { IA_PROVEEDOR: 'gemini', GEMINI_API_KEY: clave, GEMINI_MODEL: modelo };
  }
}

// ── MySQL ──────────────────────────────────────────────────

function explicarErrorMySQL(err) {
  switch (err.code) {
    case 'ECONNREFUSED':
      return 'MySQL no está corriendo en ese host/puerto. En Windows abre "Servicios" e inicia "MySQL80" (o MySQL57).';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Usuario o contraseña incorrectos.';
    case 'ENOTFOUND':
      return 'No se encontró el host.';
    case 'ER_NOT_SUPPORTED_AUTH_MODE':
      return 'Método de autenticación no soportado por el usuario (ver README, sección 8).';
    default:
      return err.message;
  }
}

async function configurarMySQL(actual) {
  titulo('2/2 · MySQL (registro e historial)');
  console.log('Se usa para guardar los análisis y el historial. Es opcional:');
  console.log('sin MySQL, la tabla de frecuencias y el tutor funcionan igual.\n');

  if (!(await confirmar('¿Configurar MySQL ahora?'))) {
    aviso('MySQL quedará desactivado (MYSQL_DATABASE vacío).');
    return { MYSQL_DATABASE: '' };
  }

  let v = {
    MYSQL_HOST: actual.MYSQL_HOST || 'localhost',
    MYSQL_PORT: actual.MYSQL_PORT || '3306',
    MYSQL_USER: actual.MYSQL_USER || 'root',
    MYSQL_PASSWORD: claveReal(actual.MYSQL_PASSWORD) ? actual.MYSQL_PASSWORD : '',
    MYSQL_DATABASE: actual.MYSQL_DATABASE || 'estadistica',
  };

  for (;;) {
    v.MYSQL_HOST = await preguntar('Host', v.MYSQL_HOST);
    v.MYSQL_PORT = await preguntar('Puerto', v.MYSQL_PORT);
    v.MYSQL_USER = await preguntar('Usuario', v.MYSQL_USER);
    v.MYSQL_PASSWORD = (await preguntarOculto('Contraseña de MySQL', Boolean(v.MYSQL_PASSWORD))) || v.MYSQL_PASSWORD;
    v.MYSQL_DATABASE = await preguntar('Nombre de la base de datos', v.MYSQL_DATABASE);

    console.log('Probando la conexión …');
    let conexion;
    try {
      conexion = await mysql.createConnection({
        host: v.MYSQL_HOST,
        port: Number(v.MYSQL_PORT) || 3306,
        user: v.MYSQL_USER,
        password: v.MYSQL_PASSWORD,
        connectTimeout: 10_000,
      });
      const [[{ version }]] = await conexion.query('SELECT VERSION() AS version');
      ok(`Conectado a MySQL ${version}.`);
      await conexion.query(
        `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(v.MYSQL_DATABASE)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      ok(`Base de datos "${v.MYSQL_DATABASE}" lista (las tablas se crean al arrancar el backend).`);
      return v;
    } catch (err) {
      error(explicarErrorMySQL(err));
      if (!(await confirmar('¿Reintentar con otros datos?'))) {
        if (await confirmar('¿Guardar estos datos de todos modos?', false)) return v;
        aviso('MySQL quedará desactivado (MYSQL_DATABASE vacío).');
        return { ...v, MYSQL_DATABASE: '' };
      }
    } finally {
      await conexion?.end().catch(() => {});
    }
  }
}

// ── Principal ──────────────────────────────────────────────

async function main() {
  console.log('\x1b[1mAsistente de configuración · estadistica-app777\x1b[0m');
  console.log(`Archivo a crear: ${RUTA_ENV}`);

  const plantilla = fs.readFileSync(RUTA_EJEMPLO, 'utf8');
  const existe = fs.existsSync(RUTA_ENV);
  const actual = { ...parsearEnv(plantilla), ...(existe ? parsearEnv(fs.readFileSync(RUTA_ENV, 'utf8')) : {}) };
  if (existe) aviso('Ya existe un .env: sus valores se ofrecen como predeterminados.');

  const valores = { ...actual, ...(await configurarGemini(actual)), ...(await configurarMySQL(actual)) };

  titulo('Resumen');
  console.log(`  Gemini : ${claveReal(valores.GEMINI_API_KEY) ? `${ocultar(valores.GEMINI_API_KEY)} · ${valores.GEMINI_MODEL}` : 'sin clave (modo local)'}`);
  console.log(`  MySQL  : ${valores.MYSQL_DATABASE ? `${valores.MYSQL_USER}@${valores.MYSQL_HOST}:${valores.MYSQL_PORT}/${valores.MYSQL_DATABASE}` : 'desactivado'}`);
  console.log(`  Puerto : ${valores.PORT || 3001}`);

  if (existe && !(await confirmar('\n¿Sobrescribir el .env actual?'))) {
    aviso('No se modificó nada.');
    return;
  }
  fs.writeFileSync(RUTA_ENV, serializarEnv(plantilla, valores), 'utf8');
  ok(`Guardado ${RUTA_ENV}`);
  console.log('\nSiguiente paso: \x1b[1mnpm run dev\x1b[0m  (desde la raíz del proyecto)');
}

main()
  .catch((err) => {
    error(err.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
