/**
 * IA para redactar la comparación de dos análisis guardados.
 *
 * Proveedores (variable IA_PROVEEDOR en .env):
 *   - anthropic → Claude (ANTHROPIC_API_KEY, ANTHROPIC_MODEL)
 *   - gemini    → Google Gemini (GEMINI_API_KEY, GEMINI_MODEL)
 *   - local     → comparación determinística sin internet (respaldo)
 *
 * Si el proveedor elegido no tiene clave o falla, se usa el modo local para que
 * la aplicación nunca se quede sin respuesta.
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
    ...(m.forma.curtosis && {
      curtosis: { g2: +r(m.forma.curtosis.valor, 4), tipo: m.forma.curtosis.tipo },
    }),
    ...(m.atipicos && {
      atipicos: {
        vallaInferior: +r(m.atipicos.vallaInferior, 4),
        vallaSuperior: +r(m.atipicos.vallaSuperior, 4),
        valores: m.atipicos.valores,
      },
    }),
  };
}

/**
 * `mensajes`: [{ rol: 'usuario' | 'tutor', texto }]. Cada proveedor recibe el mismo
 * sistema y la misma conversación, traducidos a su formato.
 */
async function llamarAnthropic(sistema, mensajes, maxTokens = 1500) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system: sistema,
      messages: mensajes.map((m) => ({ role: m.rol === 'tutor' ? 'assistant' : 'user', content: m.texto })),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${json?.error?.message || 'error desconocido'}`);
  const texto = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!texto) throw new Error('Anthropic devolvió una respuesta vacía.');
  return { texto, modelo: json.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5' };
}

// Los modelos Gemini con razonamiento descuentan los tokens de «pensamiento» del
// mismo límite que la respuesta: con 1200 tokens pensaban ~1100 y la respuesta
// salía cortada. Se reserva este margen extra; la extensión la controla el prompt.
const MARGEN_PENSAMIENTO_GEMINI = 6144;

async function llamarGemini(sistema, mensajes, maxTokens = 2048) {
  const modelo = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensajes.map((m) => ({ role: m.rol === 'tutor' ? 'model' : 'user', parts: [{ text: m.texto }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens + MARGEN_PENSAMIENTO_GEMINI },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${json?.error?.message || 'error desconocido'}`);
  const candidato = json.candidates?.[0];
  const texto = (candidato?.content?.parts || []).map((p) => p.text || '').join('').trim();
  if (!texto) throw new Error('Gemini devolvió una respuesta vacía.');
  // Una respuesta cortada a media frase es peor que el respaldo local
  if (candidato.finishReason === 'MAX_TOKENS') throw new Error('Gemini cortó la respuesta por el límite de tokens.');
  return { texto, modelo };
}

/* --- LaTeX → texto plano --------------------------------------------------------
 * Gemini a veces responde con fórmulas LaTeX ($\frac{40}{2}$) aunque se le pida
 * texto plano, y el renderizador de Markdown del frontend las mostraría crudas.
 */
const SIMBOLOS_LATEX = {
  cdot: '·', times: '×', div: '÷', sum: 'Σ', approx: '≈', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', pm: '±',
  infty: '∞', Delta: 'Δ', sigma: 'σ', mu: 'μ', alpha: 'α', rightarrow: '→', to: '→', Rightarrow: '⇒', quad: ' ', qquad: ' ',
};
const SUPERINDICES = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };

function formulaAPlano(f) {
  let s = f;
  // Primero lo que envuelve contenido, de adentro hacia afuera (hasta 5 niveles)
  for (let i = 0; i < 5; i++) {
    s = s
      // Subíndices y exponentes primero: suelen ir dentro de una fracción (F_{i-1})
      .replace(/\^\{([-\d]+)\}|\^([-\d])/g, (_, a, b) => [...(a ?? b)].map((c) => SUPERINDICES[c] ?? c).join(''))
      .replace(/_\{([^{}]*)\}|_([a-zA-Z0-9])/g, (_, a, b) => a ?? b)
      .replace(/\\(?:text|mathrm|mathbf|textbf|operatorname)\{([^{}]*)\}/g, '$1')
      .replace(/\\(?:bar|overline)\{\s*([^{}])\s*\}/g, '$1̄')
      .replace(/\\(?:bar|overline)\{([^{}]*)\}/g, '$1̄')
      .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => {
        const envolver = (x) => (/^[\w.,·²³x̄]+$/u.test(x.trim()) ? x.trim() : `(${x.trim()})`);
        return `${envolver(a)}/${envolver(b)}`;
      });
  }
  return s
    .replace(/\\left|\\right/g, '')
    .replace(/\\([a-zA-Z]+)/g, (m, nombre) => SIMBOLOS_LATEX[nombre] ?? m)
    .replace(/\\%/g, '%')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function limpiarLatex(texto) {
  return texto
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => formulaAPlano(f))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => formulaAPlano(f))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => formulaAPlano(f))
    .replace(/\$([^$\n]+?)\$/g, (_, f) => formulaAPlano(f));
}

// Saturación del modelo (503), límite de peticiones (429) o un corte de red:
// suelen pasar en segundos, así que vale la pena un segundo intento.
const ERROR_TEMPORAL = /\b(429|500|502|503|504)\b|fetch failed|ECONNRESET|ETIMEDOUT/;

async function reintentarSiEsTemporal(llamar, espera = 1500) {
  try {
    return await llamar();
  } catch (err) {
    if (!ERROR_TEMPORAL.test(`${err.message} ${err.cause?.code ?? ''}`)) throw err;
    console.warn(`[IA] Error temporal (${err.message}); reintentando…`);
    await new Promise((listo) => setTimeout(listo, espera));
    return llamar();
  }
}

/**
 * Llama al proveedor configurado. Si no hay clave o la llamada falla, devuelve
 * el texto de `respaldo()` (modo local) con un aviso del motivo.
 */
async function conProveedor(sistema, mensajes, respaldo, maxTokens) {
  const proveedor = (process.env.IA_PROVEEDOR || 'gemini').toLowerCase();
  const intentos = {
    anthropic: claveReal(process.env.ANTHROPIC_API_KEY) ? () => llamarAnthropic(sistema, mensajes, maxTokens) : null,
    gemini: claveReal(process.env.GEMINI_API_KEY) ? () => llamarGemini(sistema, mensajes, maxTokens) : null,
  };

  const llamar = intentos[proveedor];
  if (llamar) {
    try {
      const { texto, modelo } = await reintentarSiEsTemporal(llamar);
      return { proveedor, modelo, texto: limpiarLatex(texto), respaldo: false };
    } catch (err) {
      console.error(`[IA] Falló ${proveedor}:`, err.message);
      return { proveedor: 'local', modelo: 'reglas', texto: respaldo(), respaldo: true, aviso: err.message };
    }
  }

  return {
    proveedor: 'local',
    modelo: 'reglas',
    texto: respaldo(),
    respaldo: true,
    aviso: proveedor === 'local' ? undefined : `No hay clave de API configurada para "${proveedor}".`,
  };
}

/* --- Comparación de dos análisis ---------------------------------------------- */

const SISTEMA_COMPARAR = `Eres un tutor de Estadística I. Recibirás dos análisis YA CALCULADOS (A y B) de datos agrupados.
Redacta en español, en Markdown, una comparación para un reporte universitario con estas secciones (##):
  ## Tendencia central
  ## Dispersión
  ## Forma
  ## Conclusión
- NO inventes cifras. Compara con el CV (no con s) cuando las medias sean distintas.
- Indica claramente cuál muestra es más homogénea y por qué. Máximo ~300 palabras. Sin tablas.
- No uses LaTeX ni signos $: escribe las fórmulas en texto plano (x̄, s², √, Σ).`;

function comparacionLocal(a, b) {
  const nombre = (s, letra) => `**${letra}** (${s.contexto.variable})`;
  const ta = a.tendenciaCentral;
  const tb = b.tendenciaCentral;
  const cva = a.dispersion.coeficienteVariacionPct;
  const cvb = b.dispersion.coeficienteVariacionPct;
  const homogenea = cva === null || cvb === null ? null : cva < cvb ? 'A' : cvb < cva ? 'B' : null;
  const forma = (sk) => (Math.abs(sk) < 0.1 ? 'aproximadamente simétrica' : sk > 0 ? 'con asimetría positiva' : 'con asimetría negativa');
  const dif = tb.media - ta.media;

  return `## Tendencia central
${nombre(a, 'A')} tiene media x̄ = ${r(ta.media)} y mediana Me = ${r(ta.mediana)}; ${nombre(b, 'B')} tiene x̄ = ${r(tb.media)} y Me = ${r(tb.mediana)}. La media de B es ${dif >= 0 ? 'mayor' : 'menor'} en ${r(Math.abs(dif))} unidades${ta.media ? ` (${r((Math.abs(dif) / Math.abs(ta.media)) * 100, 1)} % respecto de A)` : ''}.

## Dispersión
Desviaciones estándar: s(A) = ${r(a.dispersion.desviacionEstandar)} y s(B) = ${r(b.dispersion.desviacionEstandar)}. Como las medias pueden ser distintas, se comparan los coeficientes de variación: CV(A) = ${r(cva)} % y CV(B) = ${r(cvb)} %. ${homogenea ? `La muestra **${homogenea}** es más homogénea (menor variabilidad relativa).` : 'Ambas muestras tienen una variabilidad relativa similar.'}

## Forma
A es ${forma(a.asimetriaPearson)} (Sk = ${r(a.asimetriaPearson)}) y B es ${forma(b.asimetriaPearson)} (Sk = ${r(b.asimetriaPearson)}).${a.curtosis && b.curtosis ? ` Por apuntamiento, A es ${a.curtosis.tipo} y B es ${b.curtosis.tipo}.` : ''}

## Conclusión
${homogenea ? `La media de la muestra ${homogenea} es más representativa de sus datos.` : 'Las dos medias son igual de representativas.'} ${Math.abs(dif) > 0 ? `En valores típicos, B se ubica ${dif > 0 ? 'por encima' : 'por debajo'} de A.` : 'Ambas muestras tienen el mismo valor típico.'}

> *Comparación generada en modo local (sin IA externa).*`;
}

async function compararAnalisis(resA, ctxA, resB, ctxB) {
  const a = resumirResultados(resA, ctxA);
  const b = resumirResultados(resB, ctxB);
  const prompt = `Análisis A (JSON):\n${JSON.stringify(a)}\n\nAnálisis B (JSON):\n${JSON.stringify(b)}\n\nRedacta la comparación.`;
  return conProveedor(SISTEMA_COMPARAR, [{ rol: 'usuario', texto: prompt }], () => comparacionLocal(a, b), 1200);
}

module.exports = { compararAnalisis, comparacionLocal, resumirResultados, limpiarLatex, reintentarSiEsTemporal };
