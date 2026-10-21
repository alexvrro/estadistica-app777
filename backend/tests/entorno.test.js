/**
 * Pruebas de las utilidades de backend/.env (node:test, sin dependencias).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');
const { claveReal, parsearEnv, serializarEnv } = require('../src/utils/entorno');

test('claveReal ignora valores vacíos y de ejemplo', () => {
  assert.equal(claveReal(''), false);
  assert.equal(claveReal(undefined), false);
  assert.equal(claveReal('pon_aqui_tu_clave_de_gemini'), false);
  assert.equal(claveReal('tu_clave_mysql'), false);
  assert.equal(claveReal('AIzaSyEjemplo123'), true);
});

test('serializarEnv conserva comentarios y agrega claves nuevas', () => {
  const plantilla = '# comentario\nPORT=3001\nGEMINI_API_KEY=\n';
  const texto = serializarEnv(plantilla, { PORT: '4000', GEMINI_API_KEY: 'abc', EXTRA: 'x' });
  assert.match(texto, /^# comentario\nPORT=4000\nGEMINI_API_KEY=abc\n/);
  assert.match(texto, /\nEXTRA=x\n$/);
});

test('valores con espacios, # y comillas sobreviven ida y vuelta (también con dotenv)', () => {
  const valores = { A: 'clave con espacios', B: 'p#ss word', C: "it's", D: 'simple' };
  const texto = serializarEnv('A=\nB=\nC=\nD=\n', valores);
  assert.deepEqual(parsearEnv(texto), valores);
  assert.deepEqual(dotenv.parse(texto), valores);
});
