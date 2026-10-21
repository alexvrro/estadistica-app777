/**
 * "Tutor de IA": genera la interpretación del análisis para un reporte universitario.
 *
 * Proveedores (variable IA_PROVEEDOR en .env):
 *   - anthropic → Claude (ANTHROPIC_API_KEY, ANTHROPIC_MODEL)
 *   - gemini    → Google Gemini (GEMINI_API_KEY, GEMINI_MODEL)
 *   - local     → interpretación determinística sin internet (respaldo)
 *
 * Si el proveedor elegido no tiene clave o falla, se usa el modo local para que
 * la aplicación nunca se quede sin análisis.
 */

const { claveReal } = require('../utils/entorno');

const r = (x, d = 2) => (x === null || x === undefined ? 'N/D' : Number(x).toFixed(d));

/** Resumen compacto de los resultados (lo que se le envía al modelo). */
function resumirResultados(res, contexto = {}) {
  const { parametros: p, filas, totales, medidas: m } = res;
  return {
    contexto: {
      variable: contexto.variable || 'datos de la muestra',
      unidad: contexto.unidad || '',
      descripcion: contexto.descripcion || '',
    },
    parametros: {
      n: p.n, min: p.min, max: p.max, rango: p.rango, clases: p.k, amplitud: p.amplitud, modo: p.modo,
    },
    tabla: filas.map((f) => ({
      clase: f.clase, intervalo: f.intervalo, fi: f.fi, Fi: f.Fi, xi: +r(f.xi, 3),
      'fr%': +r(f.frPct), 'Fr%': +r(f.FrPct),
    })),
    totales: { fi: totales.fi, 'Σxi·fi': +r(totales.xiFi, 3), 'Σxi²·fi': +r(totales.xi2Fi, 3) },
    tendenciaCentral: {
      media: +r(m.tendenciaCentral.media.valor, 4),
      mediana: +r(m.tendenciaCentral.mediana.valor, 4),
      moda: m.tendenciaCentral.moda.valores.map((x) => +r(x.valor, 4)),
    },
    dispersion: {
      varianzaMuestral: +r(m.dispersion.varianza.valor, 4),
      desviacionEstandar: +r(m.dispersion.desviacion.valor, 4),
      coeficienteVariacionPct: m.dispersion.coeficienteVariacion.valor === null ? null : +r(m.dispersion.coeficienteVariacion.valor),
      rangoIntercuartil: +r(m.dispersion.rangoIntercuartil.valor, 4),
    },
    posicion: {
      cuartiles: Object.fromEntries(m.posicion.cuartiles.map((q) => [`Q${q.k}`, +r(q.valor, 4)])),
      percentiles: Object.fromEntries(m.posicion.percentiles.map((q) => [`P${q.k}`, +r(q.valor, 4)])),
    },
    asimetriaPearson: +r(m.forma.asimetriaPearson.valor, 4),
  };
}

const SISTEMA = `Eres un tutor de Estadística I para estudiantes de ingeniería en Latinoamérica.
Redactas en español claro, formal y didáctico, como para un reporte universitario.
Recibirás resultados YA CALCULADOS de una tabla de distribución de frecuencias para datos agrupados.
Reglas:
- NO recalcules ni inventes cifras: usa exactamente los valores recibidos.
- Responde en Markdown con estas secciones (encabezados ##):
  ## Descripción general
  ## Tendencia central
  ## Dispersión y variabilidad
  ## Medidas de posición
  ## Forma de la distribución
  ## Conclusión para el reporte
- Interpreta cada medida en el contexto de la variable (qué significa para los datos, no solo la definición).
- Compara media, mediana y moda para comentar la asimetría.
- Interpreta el CV (< 15 % baja, 15–30 % moderada, > 30 % alta variabilidad) y el percentil solicitado
  ("el X % de las observaciones es menor o igual a ...").
- Máximo ~450 palabras. Sin tablas.`;

function construirPrompt(resumen) {
  return `Resultados del análisis (JSON):\n\n${JSON.stringify(resumen, null, 2)}\n\nRedacta la interpretación.`;
}

async function llamarAnthropic(resumen) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 1500,
      system: SISTEMA,
      messages: [{ role: 'user', content: construirPrompt(resumen) }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${json?.error?.message || 'error desconocido'}`);
  const texto = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!texto) throw new Error('Anthropic devolvió una respuesta vacía.');
  return { texto, modelo: json.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' };
}

async function llamarGemini(resumen) {
  const modelo = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SISTEMA }] },
      contents: [{ role: 'user', parts: [{ text: construirPrompt(resumen) }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${json?.error?.message || 'error desconocido'}`);
  const texto = (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!texto) throw new Error('Gemini devolvió una respuesta vacía.');
  return { texto, modelo };
}

/** Interpretación determinística (sin IA externa). */
function interpretacionLocal(s) {
  const { tendenciaCentral: t, dispersion: d, posicion: pos, parametros: p } = s;
  const v = `la variable «${s.contexto.variable}»`;
  const u = s.contexto.unidad ? ` ${s.contexto.unidad}` : '';
  const n2 = (x) => (x === null || x === undefined ? 'N/D' : r(x, 2));
  const cv = d.coeficienteVariacionPct;
  const nivelCV = cv === null ? 'no determinable' : cv < 15 ? 'baja' : cv <= 30 ? 'moderada' : 'alta';
  const sk = s.asimetriaPearson;
  const intensidad = Math.abs(sk) < 0.5 ? 'ligera ' : '';
  const forma =
    Math.abs(sk) < 0.1
      ? 'aproximadamente simétrica'
      : sk > 0
        ? `de ${intensidad}asimetría positiva (sesgo a la derecha): algunos valores altos desplazan la media hacia arriba`
        : `de ${intensidad}asimetría negativa (sesgo a la izquierda): algunos valores bajos desplazan la media hacia abajo`;
  const modal = s.tabla.reduce((a, b) => (b.fi > a.fi ? b : a));
  const percentiles = Object.entries(pos.percentiles)
    .map(([k, val]) => `- **${k} = ${n2(val)}${u}**: el ${k.slice(1)} % de las observaciones es menor o igual a este valor.`)
    .join('\n');

  return `## Descripción general
Se analizaron **${p.n} observaciones** de ${v}, con valores entre ${p.min}${u} y ${p.max}${u} (rango ${p.rango}${u}). Los datos se agruparon en **${p.clases} clases** de amplitud **${p.amplitud}${u}**. La clase con mayor frecuencia es ${modal.intervalo}, que concentra el ${modal['fr%']} % de los datos.

## Tendencia central
- **Media (x̄ = ${n2(t.media)}${u})**: valor promedio de ${v} en la muestra.
- **Mediana (Me = ${n2(t.mediana)}${u})**: la mitad de las observaciones está por debajo de este valor y la otra mitad por encima.
- **Moda (Mo = ${t.moda.map(n2).join(' y ')}${u})**: valor más frecuente estimado dentro de la clase modal${t.moda.length > 1 ? ' (la distribución tiene más de una moda)' : ''}.

## Dispersión y variabilidad
La varianza muestral es s² = ${n2(d.varianzaMuestral)} y la desviación estándar es **s = ${n2(d.desviacionEstandar)}${u}**: en promedio, las observaciones se alejan unas ${n2(d.desviacionEstandar)}${u} de la media. El coeficiente de variación es **CV = ${n2(cv)} %**, lo que indica una variabilidad **${nivelCV}** y ${nivelCV === 'baja' ? 'una media muy representativa del conjunto' : nivelCV === 'moderada' ? 'una media razonablemente representativa' : 'que la media debe interpretarse con cautela'}.

## Medidas de posición
- **Q1 = ${n2(pos.cuartiles.Q1)}${u}**, **Q2 = ${n2(pos.cuartiles.Q2)}${u}**, **Q3 = ${n2(pos.cuartiles.Q3)}${u}**: el 50 % central de los datos está entre Q1 y Q3 (RIC = ${n2(d.rangoIntercuartil)}${u}).
- **Q3**: el 75 % de las observaciones es menor o igual a ${n2(pos.cuartiles.Q3)}${u}, y solo el 25 % lo supera.
${percentiles}

## Forma de la distribución
El coeficiente de asimetría de Pearson es Sk = ${n2(sk)}, por lo que la distribución es ${forma}. ${t.media > t.mediana ? 'Es coherente con que la media sea mayor que la mediana.' : t.media < t.mediana ? 'Es coherente con que la media sea menor que la mediana.' : 'La media y la mediana coinciden.'}

## Conclusión para el reporte
El valor típico de ${v} se sitúa entre ${n2(Math.min(t.media, t.mediana))} y ${n2(Math.max(t.media, t.mediana))}${u}, con una variabilidad ${nivelCV} (CV = ${n2(cv)} %). ${nivelCV === 'alta' ? 'Se recomienda reportar también la mediana y el RIC, que son más robustos.' : 'La media y la desviación estándar resumen adecuadamente el comportamiento de la muestra.'}

> *Interpretación generada en modo local (sin IA externa). Configure una clave de API en el backend para obtener un análisis redactado por IA.*`;
}

async function generarInterpretacion(resultados, contexto = {}) {
  const resumen = resumirResultados(resultados, contexto);
  const proveedor = (process.env.IA_PROVEEDOR || 'gemini').toLowerCase();

  const intentos = {
    anthropic: claveReal(process.env.ANTHROPIC_API_KEY) ? () => llamarAnthropic(resumen) : null,
    gemini: claveReal(process.env.GEMINI_API_KEY) ? () => llamarGemini(resumen) : null,
  };

  const llamar = intentos[proveedor];
  if (llamar) {
    try {
      const { texto, modelo } = await llamar();
      return { proveedor, modelo, texto, respaldo: false };
    } catch (err) {
      console.error(`[IA] Falló ${proveedor}:`, err.message);
      return { proveedor: 'local', modelo: 'reglas', texto: interpretacionLocal(resumen), respaldo: true, aviso: err.message };
    }
  }

  return {
    proveedor: 'local',
    modelo: 'reglas',
    texto: interpretacionLocal(resumen),
    respaldo: true,
    aviso: proveedor === 'local' ? undefined : `No hay clave de API configurada para "${proveedor}".`,
  };
}

module.exports = { generarInterpretacion, resumirResultados, interpretacionLocal };
