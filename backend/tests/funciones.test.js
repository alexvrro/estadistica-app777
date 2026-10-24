/**
 * Pruebas del modo práctica, el chat del tutor (modo local) y la comparación.
 * Ejecutar: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { analizar } = require('../src/services/estadistica.service');
const { normalizarIntento, resumirProgreso } = require('../src/services/practica.service');
const { respuestaLocal, comparacionLocal, resumirResultados } = require('../src/services/ia.service');
const { normalizarMensajes } = require('../src/controllers/estadistica.controller');
const { MUESTRA_EJEMPLO } = require('../src/data/muestra');

test('normalizarIntento cuenta aciertos e ignora medidas desconocidas', () => {
  const i = normalizarIntento({ n: 40, detalle: { media: true, mediana: false, varianza: true, inventada: true } });
  assert.deepEqual(i, { n: 40, aciertos: 2, total: 3, detalle: { media: true, mediana: false, varianza: true } });
  assert.throws(() => normalizarIntento({ n: 1, detalle: { media: true } }), /"n"/);
  assert.throws(() => normalizarIntento({ n: 40, detalle: { otra: true } }), /medidas válidas/);
});

test('resumirProgreso: porcentajes por medida y racha perfecta', () => {
  // El más reciente primero
  const intentos = [
    { id: 3, n: 40, aciertos: 2, total: 2, detalle: { media: true, cv: true } },
    { id: 2, n: 40, aciertos: 2, total: 2, detalle: { media: true, cv: true } },
    { id: 1, n: 30, aciertos: 1, total: 2, detalle: { media: true, cv: false } },
  ];
  const p = resumirProgreso(intentos);
  assert.equal(p.ejercicios, 3);
  assert.ok(Math.abs(p.porcentaje - (5 / 6) * 100) < 1e-9);
  assert.equal(p.rachaPerfecta, 2);
  assert.deepEqual(
    p.porMedida.map((m) => [m.medida, m.aciertos, m.intentos]),
    [['media', 3, 3], ['cv', 2, 3]]
  );
  assert.equal(resumirProgreso([]).porcentaje, null);
});

test('chat en modo local: reconoce la medida aunque otra palabra la contenga', () => {
  const r = analizar(MUESTRA_EJEMPLO, {});
  assert.match(respuestaLocal(r, '¿Cómo se calcula la mediana?'), /\*\*Mediana = /);
  assert.match(respuestaLocal(r, 'explícame la media'), /\*\*Media aritmética = 52\.35/);
  // «asimétrica» contiene «ric», pero debe responder sobre la asimetría
  assert.match(respuestaLocal(r, '¿Es asimétrica?'), /Asimetría de Pearson/);
  assert.match(respuestaLocal(r, '¿cuánto vale el RIC?'), /Rango intercuartil/);
  assert.match(respuestaLocal(r, 'hola'), /Puedo explicarte/);
});

test('normalizarMensajes exige que la última sea una pregunta del usuario', () => {
  const m = normalizarMensajes([{ rol: 'tutor', texto: 'hola' }, { rol: 'usuario', texto: '  ¿y la moda?  ' }]);
  assert.deepEqual(m, [{ rol: 'usuario', texto: '¿y la moda?' }]);
  assert.throws(() => normalizarMensajes([{ rol: 'usuario', texto: 'a' }, { rol: 'tutor', texto: 'b' }]), /pregunta/);
  assert.throws(() => normalizarMensajes([]), /al menos una/);
});

test('comparación local: la muestra con menor CV es la más homogénea', () => {
  const a = resumirResultados(analizar(MUESTRA_EJEMPLO, {}), { variable: 'A' });
  const masDispersa = MUESTRA_EJEMPLO.map((x, i) => (i % 2 ? x * 1.6 : x * 0.5));
  const b = resumirResultados(analizar(masDispersa, {}), { variable: 'B' });
  assert.ok(a.dispersion.coeficienteVariacionPct < b.dispersion.coeficienteVariacionPct);
  assert.match(comparacionLocal(a, b), /La muestra \*\*A\*\* es más homogénea/);
});
