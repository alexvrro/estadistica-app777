import { useEffect, useRef, useState } from 'react';
import Tarjeta, { Aviso, Boton } from './Tarjeta';
import Icono from './Icono';
import Markdown from './Markdown';
import { api } from '../api/cliente';
import { num } from '../utils/formato';
import { conMacron } from './Simbolo';

const COLOR = { A: 'var(--graf-datos)', B: 'var(--acento)' };

const etiquetaRegistro = (r) => `#${r.id} · ${r.variable || 'sin nombre'} (n = ${r.n})`;

/** Medidas que se comparan: [nombre, símbolo, función que la extrae del resultado, decimales extra] */
const FILAS = [
  ['Tamaño de muestra', 'n', (r) => r.parametros.n, 0],
  ['Media', 'x̄', (r) => r.medidas.tendenciaCentral.media.valor],
  ['Mediana', 'Me', (r) => r.medidas.tendenciaCentral.mediana.valor],
  ['Moda', 'Mo', (r) => r.medidas.tendenciaCentral.moda.valores[0].valor],
  ['Desviación estándar', 's', (r) => r.medidas.dispersion.desviacion.valor],
  ['Coeficiente de variación', 'CV %', (r) => r.medidas.dispersion.coeficienteVariacion.valor],
  ['Rango intercuartil', 'RIC', (r) => r.medidas.dispersion.rangoIntercuartil.valor],
  ['Asimetría de Pearson', 'Sk', (r) => r.medidas.forma.asimetriaPearson.valor],
  ['Curtosis', 'g2', (r) => r.medidas.forma.curtosis.valor],
];

/**
 * Polígonos de frecuencia relativa (fr %) superpuestos. Se usa fr % y no fi para
 * que muestras de distinto tamaño sean comparables.
 */
function PoligonosSuperpuestos({ a, b }) {
  const W = 720;
  const H = 280;
  const M = { t: 16, r: 20, b: 40, l: 48 };
  const puntos = (r) => {
    const { filas } = r;
    const A = filas[0].lrs - filas[0].lri;
    // El polígono se cierra en las marcas de clase vecinas con frecuencia 0
    return [{ x: filas[0].xi - A, y: 0 }, ...filas.map((f) => ({ x: f.xi, y: f.frPct })), { x: filas.at(-1).xi + A, y: 0 }];
  };
  const pa = puntos(a);
  const pb = puntos(b);
  const x0 = Math.min(pa[0].x, pb[0].x);
  const x1 = Math.max(pa.at(-1).x, pb.at(-1).x);
  const ymax = Math.ceil(Math.max(...pa.map((p) => p.y), ...pb.map((p) => p.y)) / 10) * 10 || 10;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (y) => H - M.b - (y / ymax) * (H - M.t - M.b);
  const ticksY = Array.from({ length: ymax / 10 + 1 }, (_, i) => i * 10).filter((t, i, arr) => arr.length <= 6 || i % 2 === 0);
  const ticksX = Array.from({ length: 6 }, (_, i) => x0 + ((x1 - x0) * i) / 5);
  const linea = (ps) => ps.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const media = (r) => r.medidas.tendenciaCentral.media.valor;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="grafica__svg" role="img" aria-label="Polígonos de frecuencia relativa de A y B">
      {ticksY.map((t) => (
        <g key={t}>
          {t > 0 && <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--graf-rejilla)" />}
          <text x={M.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="num" fontSize="11" fill="var(--texto-3)">
            {t} %
          </text>
        </g>
      ))}
      <line x1={M.l} x2={W - M.r} y1={sy(0)} y2={sy(0)} stroke="var(--graf-eje)" />
      {ticksX.map((t) => (
        <text key={t} x={sx(t)} y={sy(0) + 18} textAnchor="middle" className="num" fontSize="11" fill="var(--texto-3)">
          {num(t, 1, true)}
        </text>
      ))}
      {[
        ['A', a, pa],
        ['B', b, pb],
      ].map(([letra, r, ps]) => (
        <g key={letra}>
          <line x1={sx(media(r))} x2={sx(media(r))} y1={M.t} y2={sy(0)} stroke={COLOR[letra]} strokeDasharray="5 4" strokeWidth="1.5" />
          <polygon points={`${linea(ps)}`} fill={COLOR[letra]} fillOpacity="0.1" />
          <polyline points={linea(ps)} fill="none" stroke={COLOR[letra]} strokeWidth="2.5" strokeLinejoin="round" />
          {ps.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill={COLOR[letra]} stroke="var(--superficie)" strokeWidth="1.5" />
          ))}
        </g>
      ))}
    </svg>
  );
}

export default function Comparacion({ version, onCambio }) {
  const [lista, setLista] = useState([]);
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [par, setPar] = useState(null); // { a: registro, b: registro }
  const [texto, setTexto] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [redactando, setRedactando] = useState(false);
  const [error, setError] = useState('');
  const vista = useRef(null);

  useEffect(() => {
    api
      .registros()
      .then((r) => setLista(r.registros))
      .catch((e) => setError(e.message));
  }, [version]);

  // Preselecciona los dos registros más recientes
  useEffect(() => {
    if (lista.length >= 2 && !idA && !idB) {
      setIdA(String(lista[1].id));
      setIdB(String(lista[0].id));
    }
  }, [lista, idA, idB]);

  const comparar = async () => {
    setCargando(true);
    setError('');
    setTexto(null);
    try {
      const [a, b] = await Promise.all([api.registro(idA), api.registro(idB)]);
      setPar({ a, b });
      requestAnimationFrame(() => vista.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const redactar = async () => {
    setRedactando(true);
    setError('');
    try {
      setTexto(await api.comparar(par.a.id, par.b.id));
      onCambio?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setRedactando(false);
    }
  };

  const ra = par?.a.resultado;
  const rb = par?.b.resultado;
  const cvA = ra?.medidas.dispersion.coeficienteVariacion.valor;
  const cvB = rb?.medidas.dispersion.coeficienteVariacion.valor;
  const homogenea = ra && cvA !== null && cvB !== null && cvA !== cvB ? (cvA < cvB ? 'A' : 'B') : null;

  return (
    <Tarjeta
      id="bloque-comparar"
      antetitulo="MySQL · Comparación"
      titulo="Comparar dos análisis"
      subtitulo="Elige dos registros guardados para verlos lado a lado"
    >
      {lista.length < 2 ? (
        <p className="vacio">Guarda al menos dos análisis en el registro para poder compararlos.</p>
      ) : (
        <div className="comparar__selectores">
          {[
            ['A', idA, setIdA],
            ['B', idB, setIdB],
          ].map(([letra, valor, set]) => (
            <label key={letra} className="comparar__selector">
              <span className={`comparar__letra comparar__letra--${letra}`}>{letra}</span>
              <select className="campo" value={valor} onChange={(e) => set(e.target.value)} aria-label={`Registro ${letra}`}>
                {lista.map((r) => (
                  <option key={r.id} value={r.id}>
                    {etiquetaRegistro(r)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <Boton variante="primario" onClick={comparar} disabled={cargando || !idA || !idB || idA === idB}>
            <Icono nombre="comparar" tamano={16} />
            {cargando ? 'Cargando…' : 'Comparar'}
          </Boton>
        </div>
      )}
      {idA && idA === idB && <p className="comparar__nota">Elige dos registros distintos.</p>}
      {error && <Aviso tipo="error" className="entrada__error">{error}</Aviso>}

      {par && (
        <div ref={vista} className="comparar__resultado aparecer">
          <div className="comparacion">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Medida</th>
                  <th>
                    <span className="comparar__letra comparar__letra--A">A</span> #{par.a.id}
                  </th>
                  <th>
                    <span className="comparar__letra comparar__letra--B">B</span> #{par.b.id}
                  </th>
                  <th>B − A</th>
                </tr>
              </thead>
              <tbody>
                {FILAS.map(([nombre, simbolo, valor, dec = 2]) => {
                  const va = valor(ra);
                  const vb = valor(rb);
                  const dif = va === null || vb === null ? null : vb - va;
                  return (
                    <tr key={simbolo}>
                      <td>
                        <span className="medida__simbolo">{conMacron(simbolo)}</span> {nombre}
                      </td>
                      <td className="num">{num(va, dec)}</td>
                      <td className="num">{num(vb, dec)}</td>
                      <td className="num comparacion__pct">{dif === null ? '—' : `${dif > 0 ? '+' : ''}${num(dif, dec)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {homogenea && (
            <p className="comparar__veredicto">
              La muestra <b className={`comparar__letra comparar__letra--${homogenea}`}>{homogenea}</b> es más homogénea: su CV es{' '}
              {num(Math.min(cvA, cvB), 2)} % contra {num(Math.max(cvA, cvB), 2)} %.
            </p>
          )}

          <div className="comparar__grafica">
            <p className="medidas__titulo">Polígonos de frecuencia relativa</p>
            <PoligonosSuperpuestos a={ra} b={rb} />
            <div className="leyenda">
              {['A', 'B'].map((l) => (
                <span key={l} className="leyenda__item">
                  <span className="leyenda__muestra leyenda__muestra--linea" style={{ background: COLOR[l] }} />
                  {l}: {etiquetaRegistro(par[l.toLowerCase()])} · línea punteada = media
                </span>
              ))}
            </div>
          </div>

          <div className="comparar__ia">
            <Boton variante="ia" onClick={redactar} disabled={redactando}>
              <Icono nombre="tutor" tamano={16} />
              {redactando ? 'Redactando…' : texto ? 'Volver a redactar' : 'Redactar comparación con IA'}
            </Boton>
            {texto && (
              <div className="comparar__texto">
                {texto.aviso && <Aviso tipo="advertencia">{texto.aviso}</Aviso>}
                <Markdown texto={texto.texto} />
              </div>
            )}
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
