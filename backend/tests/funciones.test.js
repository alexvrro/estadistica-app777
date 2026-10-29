/**
 * Pruebas del modo práctica, la comparación y las utilidades de IA.
 * Ejecutar: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { analizar } = require('../src/services/estadistica.service');
const { normalizarIntento, resumirProgreso } = require('../src/services/practica.service');
const { comparacionLocal, resumirResultados, reintentarSiEsTemporal, limpiarLatex } = require('../src/services/ia.service');
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

test('IA: reintenta una vez los errores temporales, pero no los demás', async () => {
  let llamadas = 0;
  const saturado = async () => {
    llamadas += 1;
    if (llamadas === 1) throw new Error('Gemini 503: high demand');
    return 'ok';
  };
  assert.equal(await reintentarSiEsTemporal(saturado, 0), 'ok');
  assert.equal(llamadas, 2);

  let otras = 0;
  const claveMala = async () => {
    otras += 1;
    throw new Error('Gemini 400: API key not valid');
  };
  await assert.rejects(reintentarSiEsTemporal(claveMala, 0), /400/);
  assert.equal(otras, 1);
});

test('limpiarLatex convierte las fórmulas de Gemini a texto plano', () => {
  // Fragmentos reales devueltos por Gemini
  assert.equal(limpiarLatex('con la fórmula $n / 2$:'), 'con la fórmula n / 2:');
  assert.equal(limpiarLatex('$$\\text{Posición} = \\frac{40}{2} = 20$$'), 'Posición = 40/2 = 20');
  assert.equal(limpiarLatex('($g_2 = -0.7513$)'), '(g2 = -0.7513)');
  assert.equal(limpiarLatex('$52.35\\text{ ms}$'), '52.35 ms');
  assert.equal(limpiarLatex('$\\bar{x} = \\frac{\\sum x_i f_i}{n}$'), 'x̄ = (Σ xi fi)/n');
  assert.equal(limpiarLatex('$s = \\sqrt{67.36} \\approx 8.21$ y $s^2$'), 's = √(67.36) ≈ 8.21 y s²');
  assert.equal(limpiarLatex('$L_i + \\left(\\frac{n/2 - F_{i-1}}{f_i}\\right) \\cdot A$'), 'Li + ((n/2 - Fi-1)/fi) · A');
  // Sin LaTeX no cambia nada
  assert.equal(limpiarLatex('La **media** es 52.35 (CV = 15.68 %).'), 'La **media** es 52.35 (CV = 15.68 %).');
});

test('comparación local: la muestra con menor CV es la más homogénea', () => {
  const a = resumirResultados(analizar(MUESTRA_EJEMPLO, {}), { variable: 'A' });
  const masDispersa = MUESTRA_EJEMPLO.map((x, i) => (i % 2 ? x * 1.6 : x * 0.5));
  const b = resumirResultados(analizar(masDispersa, {}), { variable: 'B' });
  assert.ok(a.dispersion.coeficienteVariacionPct < b.dispersion.coeficienteVariacionPct);
  assert.match(comparacionLocal(a, b), /La muestra \*\*A\*\* es más homogénea/);
});
