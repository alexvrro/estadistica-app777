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
- Compara media, mediana y moda para comentar la asimetría, y usa la curtosis (g2) para comentar el apuntamiento.
- Si hay datos atípicos (fuera de las vallas de Tukey), menciónalos y su posible efecto en la media.
- Interpreta el CV (< 15 % baja, 15–30 % moderada, > 30 % alta variabilidad) y el percentil solicitado
  ("el X % de las observaciones es menor o igual a ...").
- Máximo ~450 palabras. Sin tablas.`;

function construirPrompt(resumen) {
  return `Resultados del análisis (JSON):\n\n${JSON.stringify(resumen, null, 2)}\n\nRedacta la interpretación.`;
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

async function llamarGemini(sistema, mensajes, maxTokens = 2048) {
  const modelo = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensajes.map((m) => ({ role: m.rol === 'tutor' ? 'model' : 'user', parts: [{ text: m.texto }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
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
  const curtosis = s.curtosis
    ? ` La curtosis es g2 = ${n2(s.curtosis.g2)}: la distribución es **${s.curtosis.tipo}** (${
        s.curtosis.tipo === 'leptocúrtica' ? 'más apuntada que la normal' : s.curtosis.tipo === 'platicúrtica' ? 'más achatada que la normal' : 'con un apuntamiento similar al de la normal'
      }).`
    : '';
  const atipicos = s.atipicos
    ? s.atipicos.valores.length
      ? ` Hay ${s.atipicos.valores.length} dato(s) atípico(s) fuera de las vallas [${n2(s.atipicos.vallaInferior)}, ${n2(s.atipicos.vallaSuperior)}]: ${s.atipicos.valores.join(', ')}${u}; conviene revisarlos porque desplazan la media.`
      : ` No hay datos atípicos: todos están dentro de las vallas [${n2(s.atipicos.vallaInferior)}, ${n2(s.atipicos.vallaSuperior)}].`
    : '';
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
El coeficiente de asimetría de Pearson es Sk = ${n2(sk)}, por lo que la distribución es ${forma}. ${t.media > t.mediana ? 'Es coherente con que la media sea mayor que la mediana.' : t.media < t.mediana ? 'Es coherente con que la media sea menor que la mediana.' : 'La media y la mediana coinciden.'}${curtosis}${atipicos}

## Conclusión para el reporte
El valor típico de ${v} se sitúa entre ${n2(Math.min(t.media, t.mediana))} y ${n2(Math.max(t.media, t.mediana))}${u}, con una variabilidad ${nivelCV} (CV = ${n2(cv)} %). ${nivelCV === 'alta' ? 'Se recomienda reportar también la mediana y el RIC, que son más robustos.' : 'La media y la desviación estándar resumen adecuadamente el comportamiento de la muestra.'}

> *Interpretación generada en modo local (sin IA externa). Configure una clave de API en el backend para obtener un análisis redactado por IA.*`;
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
      const { texto, modelo } = await llamar();
      return { proveedor, modelo, texto, respaldo: false };
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

async function generarInterpretacion(resultados, contexto = {}) {
  const resumen = resumirResultados(resultados, contexto);
  return conProveedor(SISTEMA, [{ rol: 'usuario', texto: construirPrompt(resumen) }], () => interpretacionLocal(resumen));
}

/* --- Chat con el tutor ------------------------------------------------------- */

const SISTEMA_CHAT = `Eres un tutor de Estadística I para estudiantes de ingeniería en Latinoamérica.
Conversas en español claro y cercano, como un buen profesor en asesoría.
Tienes los resultados YA CALCULADOS de una tabla de distribución de frecuencias para datos agrupados (JSON abajo).
Reglas:
- NO inventes cifras: usa exactamente los valores del JSON. Si algo no está, dilo.
- Cuando expliques un cálculo, muéstralo paso a paso con la fórmula de datos agrupados y los números reales.
- Respuestas cortas (máximo ~200 palabras), en Markdown, sin tablas.
- Si la pregunta no es de estadística, redirige amablemente al tema.`;

// Palabras clave → medida, para responder sin IA externa
const TEMAS = [
  // «mediana» va antes que «media» porque la contiene
  { claves: ['mediana', 'q2'], medida: (m) => ['Mediana', m.tendenciaCentral.mediana], idea: 'Deja el 50 % de los datos a cada lado. Se interpola dentro de la clase donde Fi alcanza n/2.' },
  { claves: ['media', 'promedio', 'x̄'], medida: (m) => ['Media aritmética', m.tendenciaCentral.media], idea: 'Es el centro de gravedad de los datos: suma de xi·fi dividida entre n.' },
  { claves: ['moda', 'modal'], medida: (m) => ['Moda', m.tendenciaCentral.moda.valores[0]], idea: 'Es el valor más frecuente; se estima dentro de la clase con mayor fi usando las diferencias con las clases vecinas.' },
  { claves: ['varianza', 's²', 's2'], medida: (m) => ['Varianza muestral', m.dispersion.varianza], idea: 'Promedia los cuadrados de las distancias a la media (dividiendo entre n − 1 por ser muestra).' },
  { claves: ['desviación', 'desviacion', 'estándar', 'estandar'], medida: (m) => ['Desviación estándar', m.dispersion.desviacion], idea: 'Es la raíz de la varianza: cuánto se alejan, en promedio, los datos de la media, en las mismas unidades.' },
  { claves: ['coeficiente de variación', 'coeficiente de variacion', 'cv'], medida: (m) => ['Coeficiente de variación', m.dispersion.coeficienteVariacion], idea: 'Compara la desviación con la media: < 15 % es baja, 15–30 % moderada y > 30 % alta variabilidad.' },
  { claves: ['ric', 'intercuartil'], medida: (m) => ['Rango intercuartil', m.dispersion.rangoIntercuartil], idea: 'Mide la anchura del 50 % central de los datos: Q3 − Q1.' },
  { claves: ['q1', 'primer cuartil'], medida: (m) => ['Primer cuartil', m.posicion.cuartiles[0]], idea: 'El 25 % de los datos es menor o igual a este valor.' },
  { claves: ['q3', 'tercer cuartil'], medida: (m) => ['Tercer cuartil', m.posicion.cuartiles[2]], idea: 'El 75 % de los datos es menor o igual a este valor.' },
  { claves: ['cuartil'], medida: (m) => ['Segundo cuartil', m.posicion.cuartiles[1]], idea: 'Los cuartiles dividen los datos ordenados en cuatro partes iguales; Q2 coincide con la mediana.' },
  { claves: ['asimetr', 'asimétr', 'sesgo', 'pearson'], medida: (m) => ['Asimetría de Pearson', m.forma.asimetriaPearson], idea: 'Positiva: cola a la derecha (media > mediana). Negativa: cola a la izquierda. Cerca de 0: simétrica.' },
  { claves: ['curtosis', 'apuntamiento', 'apuntada', 'achatada'], medida: (m) => [`Curtosis (${m.forma.curtosis.tipo})`, m.forma.curtosis], idea: 'Compara el apuntamiento con la normal: g2 > 0 leptocúrtica, g2 < 0 platicúrtica, ≈ 0 mesocúrtica.' },
  { claves: ['atípic', 'atipic', 'tukey', 'valla'], medida: (m) => ['Datos atípicos', { valor: m.atipicos.valores.length, pasos: m.atipicos.pasos }], idea: 'Son los datos fuera de las vallas de Tukey [Q1 − 1.5·RIC, Q3 + 1.5·RIC].' },
];

// Las claves cortas («me», «cv», «ric») solo cuentan como palabra completa:
// «ric» no debe coincidir dentro de «asimétrica».
const mencionaClave = (texto, clave) =>
  clave.length > 3 ? texto.includes(clave) : new RegExp(`(^|[^\\p{L}\\d])${clave}($|[^\\p{L}\\d])`, 'u').test(texto);

/** Respuesta sin IA externa: busca la medida mencionada y muestra su procedimiento. */
function respuestaLocal(resultados, pregunta) {
  const p = String(pregunta).toLowerCase();
  const tema = TEMAS.find((t) => t.claves.some((c) => mencionaClave(p, c)));
  if (!tema) {
    return `Puedo explicarte cualquiera de estas medidas con tus datos: media, mediana, moda, varianza, desviación estándar, CV, cuartiles, RIC, asimetría, curtosis o atípicos. Pregúntame, por ejemplo: *«¿cómo se calcula la mediana?»*.

> *Respuesta en modo local (sin IA externa). Configure una clave de API para conversar libremente con el tutor.*`;
  }
  const [nombre, medida] = tema.medida(resultados.medidas);
  const pasos = (medida.pasos || []).map((x) => `- \`${x}\``).join('\n');
  return `**${nombre} = ${r(medida.valor, 4)}**

${tema.idea}

**Procedimiento con tus datos:**
${pasos}

> *Respuesta en modo local (sin IA externa). Configure una clave de API para conversar libremente con el tutor.*`;
}

/** `mensajes`: conversación completa; el último es la pregunta del usuario. */
async function responderChat(resultados, contexto, mensajes) {
  const resumen = resumirResultados(resultados, contexto);
  const sistema = `${SISTEMA_CHAT}\n\nResultados del análisis (JSON):\n${JSON.stringify(resumen)}`;
  const ultima = mensajes.at(-1)?.texto || '';
  return conProveedor(sistema, mensajes, () => respuestaLocal(resultados, ultima), 800);
}

/* --- Comparación de dos análisis ---------------------------------------------- */

const SISTEMA_COMPARAR = `Eres un tutor de Estadística I. Recibirás dos análisis YA CALCULADOS (A y B) de datos agrupados.
Redacta en español, en Markdown, una comparación para un reporte universitario con estas secciones (##):
  ## Tendencia central
  ## Dispersión
  ## Forma
  ## Conclusión
- NO inventes cifras. Compara con el CV (no con s) cuando las medias sean distintas.
- Indica claramente cuál muestra es más homogénea y por qué. Máximo ~300 palabras. Sin tablas.`;

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

module.exports = {
  generarInterpretacion,
  responderChat,
  compararAnalisis,
  resumirResultados,
  interpretacionLocal,
  respuestaLocal,
  comparacionLocal,
};
