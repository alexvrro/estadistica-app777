import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Tarjeta, { Aviso, Boton, Segmentado } from './Tarjeta';
import Icono from './Icono';
import { descargarSvgComoPng } from '../utils/exportar';
import { num } from '../utils/formato';
import { conMacron } from './Simbolo';

/**
 * Panel interactivo de la distribución, en SVG puro:
 *   - Frecuencias: columnas por clase (fi o fr %) con x̄, Me y Mo.
 *   - Acumulada: curva Fr % acumulada con la lectura de Q1, Q2 y Q3.
 *   - Caja: diagrama de caja (bigotes hasta las vallas de Tukey) con la media y los atípicos.
 * Paleta validada para daltonismo (ver estilos/base.css, variables --graf-*).
 */

// El viewBox sigue el ancho real del contenedor (entre 320 y 1100) para que
// el texto del SVG mantenga su tamaño en cualquier pantalla.
const W_MIN = 320;
const W_MAX = 1100;
const AnchoCtx = createContext(W_MAX);
const M = { r: 24, b: 48, l: 56 };
const C = {
  datos: 'var(--graf-datos)',
  datosFuerte: 'var(--graf-datos-fuerte)',
  media: 'var(--graf-media)',
  mediana: 'var(--graf-mediana)',
  moda: 'var(--graf-moda)',
  rejilla: 'var(--graf-rejilla)',
  eje: 'var(--graf-eje)',
  tenue: 'var(--texto-3)',
  tinta: 'var(--texto)',
  superficie: 'var(--superficie)',
};

const VISTAS = [
  ['frecuencias', 'Frecuencias'],
  ['acumulada', 'Acumulada'],
  ['caja', 'Caja'],
];

/** Paso "redondo" (1, 2, 2.5, 5 × 10ⁿ) para ~5 marcas del eje. */
function pasoBonito(max, entero) {
  const bruto = max / 5 || 1;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  const paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return entero ? Math.max(1, Math.ceil(paso)) : paso;
}

/** Columna con esquinas superiores redondeadas (4 px) y base recta. */
function columna(x, y, w, h, r = 4) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Reparte etiquetas en filas para que no se encimen. */
function repartirEtiquetas(refs, sx, separacion = 78) {
  const ultimos = [];
  return refs
    .map((r) => ({ ...r, px: sx(r.x) }))
    .sort((a, b) => a.px - b.px)
    .map((r) => {
      let fila = ultimos.findIndex((p) => r.px - p >= separacion);
      if (fila === -1) {
        fila = ultimos.length;
        ultimos.push(r.px);
      } else ultimos[fila] = r.px;
      return { ...r, fila };
    });
}

/** Tooltip HTML posicionado sobre el SVG (coordenadas del viewBox). */
function Tooltip({ punto, alto }) {
  const W = useContext(AnchoCtx);
  if (!punto) return null;
  const x = Math.min(Math.max(punto.x, 90), W - 90);
  return (
    <div className="tooltip" style={{ left: `${(x / W) * 100}%`, top: `${(punto.y / alto) * 100}%` }} role="status">
      <div className="tooltip__titulo">{punto.titulo}</div>
      {punto.filas.map(([color, valor, etiqueta]) => (
        <div key={etiqueta} className="tooltip__fila">
          <span className="tooltip__clave" style={{ background: color }} />
          <span className="tooltip__valor num">{valor}</span>
          <span className="tooltip__etiqueta">{etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

function Leyenda({ items }) {
  return (
    <div className="leyenda">
      {items.map(({ color, texto, forma }) => (
        <span key={texto} className="leyenda__item">
          <span className={`leyenda__muestra leyenda__muestra--${forma === 'caja' ? 'caja' : 'linea'}`} style={{ background: color }} />
          <span className="num">{conMacron(texto)}</span>
        </span>
      ))}
    </div>
  );
}

/** Eje X con los límites reales de clase (se omiten algunos si no caben). */
function EjeX({ limites, sx, y, decimales, titulo }) {
  const ancho = (sx(limites.at(-1)) - sx(limites[0])) / (limites.length - 1);
  const cada = ancho < 44 ? Math.ceil(44 / ancho) : 1;
  return (
    <g>
      <line x1={sx(limites[0])} x2={sx(limites.at(-1))} y1={y} y2={y} stroke={C.eje} />
      {limites.map((l, i) =>
        i % cada === 0 || i === limites.length - 1 ? (
          <text key={l} x={sx(l)} y={y + 18} textAnchor="middle" className="num" fontSize="11" fill={C.tenue}>
            {num(l, decimales, true)}
          </text>
        ) : null,
      )}
      <text x={(sx(limites[0]) + sx(limites.at(-1))) / 2} y={y + 40} textAnchor="middle" fontSize="11" fill={C.tenue}>
        {titulo}
      </text>
    </g>
  );
}

/** Líneas de referencia verticales (x̄, Me, Mo) con etiqueta arriba. */
function Referencias({ refs, sx, arriba, abajo }) {
  const W = useContext(AnchoCtx);
  return repartirEtiquetas(refs, sx).map((r) => {
    const px = Math.min(Math.max(r.px, M.l + 36), W - M.r - 36);
    const ty = 14 + r.fila * 15;
    return (
      <g key={r.etiqueta}>
        <line x1={r.px} x2={r.px} y1={arriba} y2={abajo} stroke={r.color} strokeWidth="1.5" />
        <circle cx={px - r.etiqueta.length * 3.3 - 6} cy={ty - 4} r="3.5" fill={r.color} />
        <text x={px} y={ty} textAnchor="middle" className="num" fontSize="11" fill={C.tinta}>
          {conMacron(r.etiqueta, true)}
        </text>
      </g>
    );
  });
}

function VistaFrecuencias({ resultado, decimales, claseResaltada, refs, unidad }) {
  const [activa, setActiva] = useState(null);
  const W = useContext(AnchoCtx);
  const { filas } = resultado;
  const valor = (f) => (unidad === 'fi' ? f.fi : f.frPct);
  const filasRef = Math.max(...repartirEtiquetas(refs, () => 0).map((r) => r.fila)) + 1;
  const top = 18 + filasRef * 15;
  const H = 340;

  const max = Math.max(...filas.map(valor));
  const paso = pasoBonito(max, unidad === 'fi');
  const tope = Math.ceil(max / paso) * paso || 1;
  const x0 = filas[0].lri;
  const x1 = filas.at(-1).lrs;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - (y / tope) * (H - top - M.b);
  const ticks = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => +(i * paso).toFixed(6));
  const limites = [x0, ...filas.map((f) => f.lrs)];
  const resaltada = activa ?? claseResaltada;
  const modal = filas.reduce((a, b) => (valor(b) > valor(a) ? b : a));
  const fmtValor = (f) => (unidad === 'fi' ? f.fi : `${num(f.frPct, 1)} %`);

  const sel = filas.find((f) => f.clase === activa);
  const punto = sel && {
    x: sx(sel.xi),
    y: sy(valor(sel)),
    titulo: `Clase ${sel.clase} · ${sel.intervalo}`,
    filas: [
      [C.datos, sel.fi, 'fi'],
      [C.datos, `${num(sel.frPct, 2)} %`, 'fr %'],
      [C.eje, sel.Fi, 'Fi (acumulada)'],
      [C.eje, num(sel.xi, decimales, true), 'xi (marca de clase)'],
    ],
  };

  return (
    <div className="grafica__lienzo">
      <svg viewBox={`0 0 ${W} ${H}`} className="grafica__svg" role="img" aria-label="Columnas de frecuencia por clase">
        {ticks.map((t) => (
          <g key={t}>
            {t > 0 && <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={C.rejilla} />}
            <text x={M.l - 10} y={sy(t)} dy="0.32em" textAnchor="end" className="num" fontSize="11" fill={C.tenue}>
              {unidad === 'fi' ? t : `${num(t, 1, true)} %`}
            </text>
          </g>
        ))}
        <text x={14} y={(top + H - M.b) / 2} textAnchor="middle" fontSize="11" fill={C.tenue} transform={`rotate(-90 14 ${(top + H - M.b) / 2})`}>
          {unidad === 'fi' ? 'Frecuencia absoluta (fi)' : 'Frecuencia relativa (fr %)'}
        </text>

        {filas.map((f) => {
          const x = sx(f.lri) + 1;
          const w = Math.max(1, sx(f.lrs) - sx(f.lri) - 2);
          const y = sy(valor(f));
          const atenuada = resaltada != null && resaltada !== f.clase;
          return (
            <path
              key={f.clase}
              d={columna(x, y, w, sy(0) - y)}
              fill={resaltada === f.clase ? C.datosFuerte : C.datos}
              opacity={atenuada ? 0.35 : 1}
              style={{ transition: 'opacity 150ms' }}
            />
          );
        })}

        <Referencias refs={refs} sx={sx} arriba={top - 4} abajo={sy(0)} />

        {/* valor de la clase modal y de la columna activa: dentro de la columna si cabe */}
        {[...new Set([modal, sel].filter(Boolean))].map((f) => {
          const dentro = sy(0) - sy(valor(f)) > 28;
          return (
            <text
              key={f.clase}
              x={sx(f.xi)}
              y={dentro ? sy(valor(f)) + 18 : sy(valor(f)) - 7}
              textAnchor="middle"
              className="num"
              fontSize="12"
              fontWeight="600"
              fill={dentro ? '#ffffff' : C.tinta}
              stroke={dentro ? (f.clase === resaltada ? C.datosFuerte : C.datos) : C.superficie}
              strokeWidth="5"
              paintOrder="stroke"
              pointerEvents="none"
            >
              {fmtValor(f)}
            </text>
          );
        })}

        <EjeX limites={limites} sx={sx} y={sy(0)} decimales={decimales} titulo="Límites reales de clase" />

        {/* zonas de interacción: toda la franja de cada clase */}
        {filas.map((f) => (
          <rect
            key={f.clase}
            x={sx(f.lri)}
            y={top}
            width={sx(f.lrs) - sx(f.lri)}
            height={sy(0) - top}
            fill="transparent"
            tabIndex={0}
            aria-label={`Clase ${f.clase}, ${f.intervalo}: fi = ${f.fi}`}
            className="grafica__zona"
            onPointerEnter={() => setActiva(f.clase)}
            onPointerLeave={() => setActiva(null)}
            onFocus={() => setActiva(f.clase)}
            onBlur={() => setActiva(null)}
          />
        ))}
      </svg>
      <Tooltip punto={punto} alto={H} />
    </div>
  );
}

function VistaAcumulada({ resultado, decimales, cuartiles }) {
  const [activo, setActivo] = useState(null);
  const W = useContext(AnchoCtx);
  const { filas } = resultado;
  const H = 340;
  const top = 24;
  const x0 = filas[0].lri;
  const x1 = filas.at(-1).lrs;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - (y / 100) * (H - top - M.b);
  const puntos = [{ x: x0, y: 0, Fi: 0 }, ...filas.map((f) => ({ x: f.lrs, y: f.FrPct, Fi: f.Fi, f }))];
  const linea = puntos.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const area = `M${sx(x0)},${sy(0)}L${linea.replaceAll(' ', 'L')}L${sx(x1)},${sy(0)}Z`;
  const limites = puntos.map((p) => p.x);

  function mover(e) {
    const caja = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - caja.left) / caja.width) * W;
    let mejor = 0;
    puntos.forEach((p, i) => {
      if (Math.abs(sx(p.x) - px) < Math.abs(sx(puntos[mejor].x) - px)) mejor = i;
    });
    setActivo(mejor);
  }

  const p = activo != null ? puntos[activo] : null;
  const punto = p && {
    x: sx(p.x),
    y: sy(p.y),
    titulo: activo === 0 ? `Antes de ${num(p.x, decimales, true)}` : `Hasta ${num(p.x, decimales, true)} (clase ${p.f.clase})`,
    filas: [
      [C.datos, `${num(p.y, 2)} %`, 'Fr % acumulada'],
      [C.eje, p.Fi, 'Fi (datos acumulados)'],
    ],
  };

  return (
    <div className="grafica__lienzo">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="grafica__svg grafica__svg--tactil"
        role="img"
        aria-label="Curva de frecuencia relativa acumulada"
        onPointerMove={mover}
        onPointerLeave={() => setActivo(null)}
      >
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            {t > 0 && <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke={C.rejilla} />}
            <text x={M.l - 10} y={sy(t)} dy="0.32em" textAnchor="end" className="num" fontSize="11" fill={C.tenue}>
              {t} %
            </text>
          </g>
        ))}
        <text x={14} y={(top + H - M.b) / 2} textAnchor="middle" fontSize="11" fill={C.tenue} transform={`rotate(-90 14 ${(top + H - M.b) / 2})`}>
          Fr % acumulada
        </text>

        {/* lectura de los cuartiles: 25 %, 50 %, 75 % → Q1, Q2, Q3 */}
        {cuartiles.map((q) => (
          <g key={q.k}>
            <polyline
              points={`${M.l},${sy(q.k * 25)} ${sx(q.valor)},${sy(q.k * 25)} ${sx(q.valor)},${sy(0)}`}
              fill="none"
              stroke={q.k === 2 ? C.mediana : C.tenue}
              strokeWidth="1"
              opacity="0.8"
            />
            <text x={sx(q.valor) + 6} y={sy(q.k * 25) + 14} className="num" fontSize="11" fill={C.tinta}>
              {`Q${q.k} = ${num(q.valor, decimales)}`}
            </text>
          </g>
        ))}

        <path d={area} fill={C.datos} opacity="0.1" />
        <polyline points={linea} fill="none" stroke={C.datos} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {p && <line x1={sx(p.x)} x2={sx(p.x)} y1={top} y2={sy(0)} stroke={C.eje} />}
        {puntos.map((pt, i) => (
          <circle
            key={i}
            cx={sx(pt.x)}
            cy={sy(pt.y)}
            r={activo === i ? 6 : 4}
            fill={C.datos}
            stroke={C.superficie}
            strokeWidth="2"
          />
        ))}

        <EjeX limites={limites} sx={sx} y={sy(0)} decimales={decimales} titulo="Límite real superior de clase" />
      </svg>
      <Tooltip punto={punto} alto={H} />
    </div>
  );
}

function VistaCaja({ resultado, decimales, cuartiles, media, ric, atipicos }) {
  const [activo, setActivo] = useState(null);
  const W = useContext(AnchoCtx);
  const { filas, parametros: p } = resultado;
  const H = 210;
  const x0 = Math.min(filas[0].lri, p.min);
  const x1 = Math.max(filas.at(-1).lrs, p.max);
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const [q1, q2, q3] = cuartiles.map((q) => q.valor);
  const yc = 92;
  const alto = 56;
  const base = 160;
  const limites = [filas[0].lri, ...filas.map((f) => f.lrs)];
  const d = (x) => num(x, decimales);

  // Los bigotes llegan al último dato dentro de las vallas; lo demás es atípico.
  // Con datos agrupados un cuartil puede pasar a ese dato: el bigote nunca entra en la caja.
  const ordenados = resultado.datos.ordenados;
  const enValla = (x) => !atipicos || (x >= atipicos.vallaInferior - 1e-9 && x <= atipicos.vallaSuperior + 1e-9);
  const bigoteMin = Math.min(ordenados.find(enValla) ?? p.min, q1);
  const bigoteMax = Math.max(ordenados.findLast(enValla) ?? p.max, q3);
  const fuera = [...new Set(ordenados.filter((x) => !enValla(x)))];

  const partes = [
    { id: 'izq', x: bigoteMin, x2: q1, titulo: 'Bigote inferior', filas: [[C.datos, d(bigoteMin), bigoteMin === p.min ? 'mínimo' : 'menor dato dentro de las vallas'], [C.datos, d(q1), 'Q1']] },
    { id: 'caja', x: q1, x2: q3, titulo: 'Caja: 50 % central de los datos', filas: [[C.datos, d(q1), 'Q1'], [C.mediana, d(q2), 'Me = Q2'], [C.datos, d(q3), 'Q3'], [C.eje, d(ric), 'RIC = Q3 − Q1']] },
    { id: 'der', x: q3, x2: bigoteMax, titulo: 'Bigote superior', filas: [[C.datos, d(q3), 'Q3'], [C.datos, d(bigoteMax), bigoteMax === p.max ? 'máximo' : 'mayor dato dentro de las vallas']] },
  ];
  const sel = partes.find((t) => t.id === activo);
  const punto = sel && { x: (sx(sel.x) + sx(sel.x2)) / 2, y: yc - alto / 2, titulo: sel.titulo, filas: sel.filas };

  const marcas = [
    ...(bigoteMin < q1 ? [{ x: bigoteMin, t: bigoteMin === p.min ? 'mín' : 'bigote' }] : []),
    { x: q1, t: 'Q1' },
    { x: q3, t: 'Q3' },
    ...(bigoteMax > q3 ? [{ x: bigoteMax, t: bigoteMax === p.max ? 'máx' : 'bigote' }] : []),
  ];

  return (
    <div>
      <div className="grafica__lienzo">
        <svg viewBox={`0 0 ${W} ${H}`} className="grafica__svg" role="img" aria-label="Diagrama de caja">
          {limites.map((l) => (
            <line key={l} x1={sx(l)} x2={sx(l)} y1={24} y2={base} stroke={C.rejilla} />
          ))}

          {/* bigotes */}
          <line x1={sx(bigoteMin)} x2={sx(q1)} y1={yc} y2={yc} stroke={C.datos} strokeWidth="2" />
          <line x1={sx(q3)} x2={sx(bigoteMax)} y1={yc} y2={yc} stroke={C.datos} strokeWidth="2" />
          {[bigoteMin, bigoteMax].map((x) => (
            <line key={x} x1={sx(x)} x2={sx(x)} y1={yc - 14} y2={yc + 14} stroke={C.datos} strokeWidth="2" strokeLinecap="round" />
          ))}

          {/* caja Q1–Q3 */}
          <rect
            x={sx(q1)}
            y={yc - alto / 2}
            width={Math.max(1, sx(q3) - sx(q1))}
            height={alto}
            rx="4"
            fill={C.datos}
            fillOpacity={activo === 'caja' ? 0.32 : 0.18}
            stroke={C.datos}
            strokeWidth="2"
          />
          <line x1={sx(q2)} x2={sx(q2)} y1={yc - alto / 2} y2={yc + alto / 2} stroke={C.mediana} strokeWidth="3" />

          {/* datos atípicos: círculos huecos */}
          {fuera.map((x) => (
            <circle key={x} cx={sx(x)} cy={yc} r="5" fill={C.superficie} stroke={C.tinta} strokeWidth="2">
              <title>{`Dato atípico: ${d(x)}`}</title>
            </circle>
          ))}

          {/* media: rombo */}
          <path
            d={`M${sx(media)},${yc - 8}L${sx(media) + 8},${yc}L${sx(media)},${yc + 8}L${sx(media) - 8},${yc}Z`}
            fill={C.media}
            stroke={C.superficie}
            strokeWidth="2"
          />

          {/* etiquetas arriba: Me y x̄ */}
          {repartirEtiquetas(
            [
              { x: q2, etiqueta: `Me = ${d(q2)}`, color: C.mediana },
              { x: media, etiqueta: `x̄ = ${d(media)}`, color: C.media },
            ],
            sx,
            90,
          ).map((r) => (
            <text key={r.etiqueta} x={Math.min(Math.max(r.px, M.l + 40), W - M.r - 40)} y={yc - alto / 2 - 10 - r.fila * 15} textAnchor="middle" className="num" fontSize="11" fill={C.tinta}>
              {conMacron(r.etiqueta, true)}
            </text>
          ))}

          {/* etiquetas abajo: mín, Q1, Q3, máx */}
          {repartirEtiquetas(marcas.map((m) => ({ ...m, etiqueta: m.t })), sx, 30).map((m, i) => (
            <text key={i} x={m.px} y={yc + alto / 2 + 18 + m.fila * 13} textAnchor="middle" className="num" fontSize="11" fill={C.tenue}>
              {m.t}
            </text>
          ))}

          <EjeX limites={limites} sx={sx} y={base} decimales={decimales} titulo="Límites reales de clase" />

          {partes.map((t) => (
            <rect
              key={t.id}
              x={sx(t.x)}
              y={yc - alto / 2 - 8}
              width={Math.max(12, sx(t.x2) - sx(t.x))}
              height={alto + 16}
              fill="transparent"
              tabIndex={0}
              aria-label={t.titulo}
              className="grafica__zona"
              onPointerEnter={() => setActivo(t.id)}
              onPointerLeave={() => setActivo(null)}
              onFocus={() => setActivo(t.id)}
              onBlur={() => setActivo(null)}
            />
          ))}
        </svg>
        <Tooltip punto={punto} alto={H} />
      </div>

      <dl className="cinco-numeros">
        {[
          ['Mínimo', p.min],
          ['Q1', q1],
          ['Mediana', q2],
          ['Q3', q3],
          ['Máximo', p.max],
          ['RIC', ric],
        ].map(([t, v]) => (
          <div key={t}>
            <dt>{t}</dt>
            <dd className="num">{d(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function GraficaDistribucion({ resultado, decimales, claseResaltada }) {
  const [vista, setVista] = useState('frecuencias');
  const [unidad, setUnidad] = useState('fi');
  const caja = useRef(null);
  const [ancho, setAncho] = useState(W_MAX);
  const [errorPng, setErrorPng] = useState('');

  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(Math.min(W_MAX, Math.max(W_MIN, e.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { medidas } = resultado;
  const media = medidas.tendenciaCentral.media.valor;
  const mediana = medidas.tendenciaCentral.mediana.valor;
  const modas = medidas.tendenciaCentral.moda.valores.map((m) => m.valor);
  const cuartiles = medidas.posicion.cuartiles;
  const ric = medidas.dispersion.rangoIntercuartil.valor;
  const atipicos = medidas.atipicos;
  const nAtipicos = atipicos ? new Set(atipicos.valores).size : 0;

  const refs = [
    { x: media, color: C.media, etiqueta: `x̄ = ${num(media, decimales)}` },
    { x: mediana, color: C.mediana, etiqueta: `Me = ${num(mediana, decimales)}` },
    ...modas.map((m, i) => ({ x: m, color: C.moda, etiqueta: `Mo${modas.length > 1 ? i + 1 : ''} = ${num(m, decimales)}` })),
  ];

  const textos = {
    frecuencias: ['Distribución de frecuencias', 'Pasa el cursor sobre una clase para ver su detalle'],
    acumulada: ['Frecuencia acumulada', 'Los cuartiles se leen donde la curva cruza 25 %, 50 % y 75 %'],
    caja: ['Diagrama de caja', 'Resumen de cinco números: mín, Q1, Me, Q3 y máx'],
  };

  const leyendas = {
    frecuencias: [{ color: C.datos, texto: unidad === 'fi' ? 'fi por clase' : 'fr % por clase', forma: 'caja' }, ...refs.map((r) => ({ color: r.color, texto: r.etiqueta }))],
    acumulada: [
      { color: C.datos, texto: 'Fr % acumulada' },
      { color: C.mediana, texto: `Q2 = Me = ${num(mediana, decimales)}` },
      { color: C.tenue, texto: 'Q1 y Q3' },
    ],
    caja: [
      { color: C.datos, texto: 'Caja Q1–Q3 y bigotes', forma: 'caja' },
      { color: C.mediana, texto: `Me = ${num(mediana, decimales)}` },
      { color: C.media, texto: `x̄ = ${num(media, decimales)} (rombo)` },
      ...(nAtipicos ? [{ color: C.tinta, texto: `Atípicos: ${atipicos.valores.join(', ')}` }] : []),
    ],
  };

  const descargarPng = async () => {
    setErrorPng('');
    try {
      await descargarSvgComoPng(caja.current.querySelector('svg'), {
        nombre: `grafica-${vista}`,
        titulo: textos[vista][0],
        leyenda: leyendas[vista],
      });
    } catch (e) {
      setErrorPng(e.message || 'No se pudo generar la imagen.');
    }
  };

  // La paleta de comandos pide la descarga con un evento
  const refDescargar = useRef(descargarPng);
  refDescargar.current = descargarPng;
  useEffect(() => {
    const alPedir = () => refDescargar.current();
    window.addEventListener('descargar-grafica', alPedir);
    return () => window.removeEventListener('descargar-grafica', alPedir);
  }, []);

  return (
    <Tarjeta
      id="bloque-grafica"
      antetitulo="Paso 4 · Visualización"
      titulo={textos[vista][0]}
      subtitulo={textos[vista][1]}
      acciones={
        <>
          {vista === 'frecuencias' && (
            <Segmentado etiqueta="Eje vertical" opciones={[['fi', 'fi'], ['fr', 'fr %']]} valor={unidad} onCambio={setUnidad} />
          )}
          <Segmentado etiqueta="Tipo de gráfica" opciones={VISTAS} valor={vista} onCambio={setVista} />
          <Boton chico onClick={descargarPng} title="Descargar la gráfica como imagen PNG">
            <Icono nombre="descargar" tamano={15} />
            PNG
          </Boton>
        </>
      }
    >
      <div ref={caja}>
        <AnchoCtx.Provider value={ancho}>
          {vista === 'frecuencias' && (
            <VistaFrecuencias resultado={resultado} decimales={decimales} claseResaltada={claseResaltada} refs={refs} unidad={unidad} />
          )}
          {vista === 'acumulada' && <VistaAcumulada resultado={resultado} decimales={decimales} cuartiles={cuartiles} />}
          {vista === 'caja' && <VistaCaja resultado={resultado} decimales={decimales} cuartiles={cuartiles} media={media} ric={ric} atipicos={atipicos} />}
        </AnchoCtx.Provider>
      </div>
      <Leyenda items={leyendas[vista]} />
      {errorPng && (
        <Aviso tipo="error" className="entrada__error">
          {errorPng}
        </Aviso>
      )}
    </Tarjeta>
  );
}
