/**
 * Motor estadístico para DATOS AGRUPADOS (tabla de distribución de frecuencias).
 *
 * Sin dependencias externas: se puede probar con `node --test`.
 *
 * Convenciones (las de un curso típico de Estadística I):
 *   - Número de clases por la regla de Sturges: k = 1 + 3.322·log10(n), redondeado.
 *   - Rango R = Xmax − Xmin.
 *   - Amplitud A = R / k, redondeada SIEMPRE hacia arriba a la precisión de los datos
 *     (si los datos son enteros, A es entera; si tienen 1 decimal, A tiene 1 decimal).
 *   - Modo "continuo": intervalos [Li, Ls) y el último cerrado [Li, Ls].
 *   - Modo "discreto": límites aparentes (ej. 20–26) y límites reales/fronteras
 *     (19.5–26.5). Las fórmulas de interpolación usan los límites reales.
 *   - Varianza MUESTRAL con divisor n − 1 (también se reporta la poblacional).
 */

const EPS = 1e-9;

/* ---------------------------- utilidades ---------------------------- */

/** Cantidad de decimales que trae un número (1.25 → 2, 40 → 0). */
function decimalesDe(x) {
  if (!Number.isFinite(x)) return 0;
  const s = String(x);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  const p = s.split('.')[1];
  return p ? p.length : 0;
}

/** Redondeo seguro (evita 0.1 + 0.2 = 0.30000000000000004). */
function redondear(x, d = 6) {
  const f = 10 ** d;
  return Math.round((x + Number.EPSILON) * f) / f;
}

/** Redondea hacia arriba a múltiplos de `unidad`. */
function techoA(x, unidad) {
  return redondear(Math.ceil(redondear(x / unidad, 9) - EPS) * unidad, 10);
}

const fmt = (x, d = 4) => {
  const r = redondear(x, d);
  return Number.isInteger(r) ? String(r) : String(r);
};

/* ------------------------- construcción de tabla ------------------------- */

/**
 * @param {number[]} datos
 * @param {object} opciones
 * @param {number} [opciones.clases]   k forzado (si no, Sturges)
 * @param {number} [opciones.amplitud] A forzada (si no, R/k redondeado hacia arriba)
 * @param {number} [opciones.limiteInicial] Li de la primera clase (si no, Xmin)
 * @param {'continuo'|'discreto'} [opciones.modo]
 */
function construirTabla(datos, opciones = {}) {
  const n = datos.length;
  const ordenados = [...datos].sort((a, b) => a - b);
  const min = ordenados[0];
  const max = ordenados[n - 1];
  const rango = redondear(max - min, 10);

  const precision = Math.max(...datos.map(decimalesDe));
  const unidad = 10 ** -precision; // 1, 0.1, 0.01 ...
  const modo = opciones.modo === 'discreto' ? 'discreto' : 'continuo';

  const kSturges = 1 + 3.322 * Math.log10(n);
  let k = opciones.clases ? Math.round(opciones.clases) : Math.round(kSturges);
  k = Math.max(1, k);

  // En modo discreto el último límite aparente debe alcanzar a Xmax:
  //   Xmin + k·A − u ≥ Xmax  ⇔  k·A ≥ R + u
  const rangoCubrir = modo === 'discreto' ? rango + unidad : rango;
  let amplitud;
  let pasosAmplitud;
  if (opciones.amplitud) {
    amplitud = Number(opciones.amplitud);
  } else {
    const bruta = rangoCubrir / k;
    amplitud = techoA(bruta === 0 ? unidad : bruta, unidad);
    pasosAmplitud =
      modo === 'discreto'
        ? `A = (R + u) / k = (${fmt(rango)} + ${fmt(unidad)}) / ${k} = ${fmt(bruta)} → ${fmt(amplitud)}`
        : `A = R / k = ${fmt(rango)} / ${k} = ${fmt(bruta)} → ${fmt(amplitud)}`;
  }
  const li0 = opciones.limiteInicial ?? min;

  // Si con la amplitud elegida no se cubre Xmax, se agregan clases.
  while (li0 + k * amplitud - (modo === 'discreto' ? unidad : 0) < max - EPS) k += 1;

  const filas = [];
  let Fi = 0;
  for (let i = 0; i < k; i++) {
    const li = redondear(li0 + i * amplitud, 10);
    const lsReal = redondear(li + amplitud, 10);
    const ultima = i === k - 1;

    let lsAparente = lsReal;
    let lri = li;
    let lrs = lsReal;
    if (modo === 'discreto') {
      lsAparente = redondear(lsReal - unidad, 10);
      lri = redondear(li - unidad / 2, 10);
      lrs = redondear(lsAparente + unidad / 2, 10);
    }

    const fi = datos.filter((x) =>
      modo === 'discreto'
        ? x >= li - EPS && x <= lsAparente + EPS
        : ultima
          ? x >= li - EPS && x <= lsReal + EPS
          : x >= li - EPS && x < lsReal - EPS
    ).length;

    Fi += fi;
    const xi = redondear((lri + lrs) / 2, 10);
    filas.push({
      clase: i + 1,
      li,
      ls: lsAparente,
      lri, // límite real inferior (frontera)
      lrs, // límite real superior (frontera)
      intervalo:
        modo === 'discreto'
          ? `${fmt(li)} – ${fmt(lsAparente)}`
          : `[${fmt(li)}, ${fmt(lsReal)}${ultima ? ']' : ')'}`,
      fi,
      Fi,
      xi,
      xiFi: xi * fi,
      xi2: xi * xi,
      xi2Fi: xi * xi * fi,
      fr: fi / n,
      frPct: (fi / n) * 100,
      FrPct: (Fi / n) * 100,
    });
  }

  const totales = {
    fi: filas.reduce((s, f) => s + f.fi, 0),
    xiFi: filas.reduce((s, f) => s + f.xiFi, 0),
    xi2Fi: filas.reduce((s, f) => s + f.xi2Fi, 0),
    fr: filas.reduce((s, f) => s + f.fr, 0),
    frPct: filas.reduce((s, f) => s + f.frPct, 0),
  };

  return {
    parametros: {
      n,
      min,
      max,
      rango,
      precision,
      unidad,
      modo,
      kSturges,
      k,
      amplitud,
      limiteInicial: li0,
      pasos: {
        rango: `R = Xmax − Xmin = ${fmt(max)} − ${fmt(min)} = ${fmt(rango)}`,
        sturges: `k = 1 + 3.322·log10(${n}) = ${fmt(kSturges)} ≈ ${k}`,
        amplitud: pasosAmplitud ?? `A = ${fmt(amplitud)} (definida por el usuario)`,
      },
    },
    filas,
    totales,
  };
}

/* ------------------------- medidas para datos agrupados ------------------------- */

/**
 * Cuantil por interpolación lineal dentro de la clase:
 *   Q = LRi + ((pos − F(i−1)) / fi) · A,   pos = p · n
 */
function cuantil(tabla, p, etiqueta, posTexto) {
  const { filas, parametros } = tabla;
  const { n, amplitud: A } = parametros;
  const pos = p * n;

  let idx = filas.findIndex((f) => f.Fi >= pos - EPS && f.fi > 0);
  if (idx === -1) idx = filas.length - 1;
  const f = filas[idx];
  const Fant = idx === 0 ? 0 : filas[idx - 1].Fi;
  const valor = f.lri + ((pos - Fant) / f.fi) * A;

  return {
    valor,
    clase: f.clase,
    posicion: pos,
    pasos: [
      `Posición = ${posTexto} = ${fmt(pos)} → clase ${f.clase} (${f.intervalo}), primera con Fi ≥ ${fmt(pos)}`,
      `${etiqueta} = Li + ((pos − Fi₋₁) / fi) · A`,
      `${etiqueta} = ${fmt(f.lri)} + ((${fmt(pos)} − ${Fant}) / ${f.fi}) · ${fmt(A)} = ${fmt(valor)}`,
    ],
  };
}

function medidas(tabla, consultas = {}) {
  const { filas, totales, parametros } = tabla;
  const { n, amplitud: A } = parametros;

  /* Tendencia central */
  const media = totales.xiFi / n;

  const mediana = cuantil(tabla, 0.5, 'Me', `n/2 = ${n}/2`);

  // Moda (fórmula de Czuber). Puede haber más de una clase modal.
  const fmax = Math.max(...filas.map((f) => f.fi));
  const modales = filas.filter((f) => f.fi === fmax);
  const modas = modales.map((f) => {
    const i = f.clase - 1;
    const fAnt = i > 0 ? filas[i - 1].fi : 0;
    const fSig = i < filas.length - 1 ? filas[i + 1].fi : 0;
    const d1 = f.fi - fAnt;
    const d2 = f.fi - fSig;
    const valor = d1 + d2 === 0 ? f.xi : f.lri + (d1 / (d1 + d2)) * A;
    return {
      valor,
      clase: f.clase,
      pasos: [
        `Clase modal: ${f.clase} (${f.intervalo}), fi = ${f.fi}`,
        `Δ1 = fi − fi₋₁ = ${f.fi} − ${fAnt} = ${d1};  Δ2 = fi − fi₊₁ = ${f.fi} − ${fSig} = ${d2}`,
        d1 + d2 === 0
          ? `Δ1 + Δ2 = 0 → se toma la marca de clase: Mo = ${fmt(valor)}`
          : `Mo = Li + (Δ1 / (Δ1 + Δ2)) · A = ${fmt(f.lri)} + (${d1} / ${d1 + d2}) · ${fmt(A)} = ${fmt(valor)}`,
      ],
    };
  });

  /* Dispersión */
  const sumaCuadrados = totales.xi2Fi - n * media * media; // Σ(xi − x̄)²·fi
  const varianzaMuestral = n > 1 ? sumaCuadrados / (n - 1) : 0;
  const varianzaPoblacional = sumaCuadrados / n;
  const desviacion = Math.sqrt(Math.max(varianzaMuestral, 0));
  const desviacionPoblacional = Math.sqrt(Math.max(varianzaPoblacional, 0));
  const cv = media !== 0 ? (desviacion / Math.abs(media)) * 100 : null;

  /* Posición */
  const cuartiles = [1, 2, 3].map((q) => ({
    k: q,
    ...cuantil(tabla, q / 4, `Q${q}`, `${q}·n/4 = ${q}·${n}/4`),
  }));
  const listaPercentiles = (consultas.percentiles?.length ? consultas.percentiles : [17])
    .map(Number)
    .filter((p) => p > 0 && p < 100);
  const percentiles = [...new Set(listaPercentiles)].map((p) => ({
    k: p,
    ...cuantil(tabla, p / 100, `P${p}`, `${p}·n/100 = ${p}·${n}/100`),
  }));
  const deciles = (consultas.deciles ?? [])
    .map(Number)
    .filter((d) => d > 0 && d < 10)
    .map((d) => ({ k: d, ...cuantil(tabla, d / 10, `D${d}`, `${d}·n/10 = ${d}·${n}/10`) }));

  const q1 = cuartiles[0].valor;
  const q3 = cuartiles[2].valor;

  /* Forma (extra útil para el reporte) */
  const asimetriaPearson = desviacion > 0 ? (3 * (media - mediana.valor)) / desviacion : 0;

  return {
    tendenciaCentral: {
      media: {
        valor: media,
        pasos: [`x̄ = Σ(xi·fi) / n = ${fmt(totales.xiFi)} / ${n} = ${fmt(media)}`],
      },
      mediana,
      moda: { valores: modas, tipo: modas.length === 1 ? 'unimodal' : modas.length === 2 ? 'bimodal' : 'multimodal' },
    },
    dispersion: {
      rango: { valor: parametros.rango, pasos: [parametros.pasos.rango] },
      amplitud: { valor: A, pasos: [parametros.pasos.amplitud] },
      varianza: {
        valor: varianzaMuestral,
        poblacional: varianzaPoblacional,
        pasos: [
          `s² = (Σ(xi²·fi) − n·x̄²) / (n − 1)`,
          `s² = (${fmt(totales.xi2Fi)} − ${n}·${fmt(media)}²) / ${n - 1} = ${fmt(varianzaMuestral)}`,
        ],
      },
      desviacion: {
        valor: desviacion,
        poblacional: desviacionPoblacional,
        pasos: [`s = √s² = √${fmt(varianzaMuestral)} = ${fmt(desviacion)}`],
      },
      coeficienteVariacion: {
        valor: cv,
        pasos: cv === null ? ['CV no definido (x̄ = 0)'] : [`CV = (s / x̄)·100 = (${fmt(desviacion)} / ${fmt(media)})·100 = ${fmt(cv, 2)} %`],
      },
      rangoIntercuartil: {
        valor: q3 - q1,
        pasos: [`RIC = Q3 − Q1 = ${fmt(q3)} − ${fmt(q1)} = ${fmt(q3 - q1)}`],
      },
    },
    posicion: { cuartiles, percentiles, deciles },
    forma: {
      asimetriaPearson: {
        valor: asimetriaPearson,
        pasos: [`Sk = 3(x̄ − Me) / s = 3(${fmt(media)} − ${fmt(mediana.valor)}) / ${fmt(desviacion)} = ${fmt(asimetriaPearson)}`],
      },
    },
  };
}

/** Punto de entrada: datos en bruto → tabla + todas las medidas. */
function analizar(datos, opciones = {}) {
  const tabla = construirTabla(datos, opciones);
  return {
    datos: { n: datos.length, ordenados: [...datos].sort((a, b) => a - b) },
    ...tabla,
    medidas: medidas(tabla, opciones),
  };
}

module.exports = { analizar, construirTabla, medidas, decimalesDe, redondear };
