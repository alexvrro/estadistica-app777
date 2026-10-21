/**
 * Pruebas del motor estadístico (node:test, sin dependencias).
 * Ejecutar: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { analizar } = require('../src/services/estadistica.service');
const { normalizarDatos } = require('../src/utils/validacion');
const { MUESTRA_EJEMPLO } = require('../src/data/muestra');

const cerca = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

test('tabla de la muestra de 40 datos (modo continuo)', () => {
  const r = analizar(MUESTRA_EJEMPLO, { percentiles: [17] });
  assert.equal(r.parametros.k, 6); // Sturges: 6.32 → 6
  assert.equal(r.parametros.amplitud, 6); // 34/6 = 5.67 → 6
  assert.deepEqual(r.filas.map((f) => f.fi), [4, 9, 11, 8, 6, 2]);
  assert.deepEqual(r.filas.map((f) => f.Fi), [4, 13, 24, 32, 38, 40]);
  assert.deepEqual(r.filas.map((f) => f.xi), [39, 45, 51, 57, 63, 69]);
  assert.equal(r.totales.fi, 40);
  assert.equal(r.totales.xiFi, 2094);
  assert.equal(r.totales.xi2Fi, 112248);
  cerca(r.totales.frPct, 100);
  cerca(r.filas.at(-1).FrPct, 100);

  const m = r.medidas;
  cerca(m.tendenciaCentral.media.valor, 52.35);
  cerca(m.tendenciaCentral.mediana.valor, 48 + (7 / 11) * 6);
  cerca(m.tendenciaCentral.moda.valores[0].valor, 50.4);
  cerca(m.dispersion.varianza.valor, 2627.1 / 39);
  cerca(m.dispersion.desviacion.valor, Math.sqrt(2627.1 / 39));
  cerca(m.dispersion.coeficienteVariacion.valor, (Math.sqrt(2627.1 / 39) / 52.35) * 100);
  cerca(m.posicion.cuartiles[2].valor, 58.5); // Q3
  cerca(m.posicion.percentiles[0].valor, 42 + (2.8 / 9) * 6); // P17
});

test('modo discreto usa límites reales (fronteras)', () => {
  const r = analizar(MUESTRA_EJEMPLO, { modo: 'discreto' });
  assert.equal(r.filas[0].li, 36);
  assert.equal(r.filas[0].ls, 41);
  assert.equal(r.filas[0].lri, 35.5);
  assert.equal(r.filas[0].lrs, 41.5);
  assert.equal(r.totales.fi, 40);
  cerca(r.medidas.posicion.cuartiles[2].valor, 58); // 53.5 + (6/8)·6
});

test('el dato máximo siempre queda dentro de la última clase', () => {
  // R = 10, k forzado 5 → A = 2 exacto: el 10 debe caer en la última clase cerrada
  const r = analizar([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { clases: 5 });
  assert.equal(r.totales.fi, 11);
  assert.equal(r.filas.at(-1).fi, 3); // 8, 9, 10
});

test('datos con decimales: la amplitud respeta la precisión', () => {
  const datos = [1.2, 1.5, 2.3, 2.8, 3.1, 3.3, 3.9, 4.4, 4.8, 5.0, 5.6, 6.1];
  const r = analizar(datos);
  assert.equal(r.parametros.precision, 1);
  assert.equal(r.totales.fi, datos.length);
  assert.equal(Math.round(r.parametros.amplitud * 10), r.parametros.amplitud * 10);
});

test('distribución bimodal reporta dos modas', () => {
  const r = analizar([1, 1, 1, 2, 5, 9, 9, 9, 10, 13], { clases: 4, amplitud: 4, limiteInicial: 1 });
  assert.equal(r.medidas.tendenciaCentral.moda.tipo, 'bimodal');
});

test('validación de entrada en texto', () => {
  assert.deepEqual(normalizarDatos('1, 2;3\n4\t5'), [1, 2, 3, 4, 5]);
  assert.throws(() => normalizarDatos('1, a, 3'), /no numéricos/);
  assert.throws(() => normalizarDatos([5]), /al menos 2/);
});
