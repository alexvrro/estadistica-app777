import { Fragment, useState } from 'react';
import Tarjeta, { Boton } from './Tarjeta';
import Icono from './Icono';
import { num } from '../utils/formato';

/**
 * Tabla de distribución de frecuencias para datos agrupados.
 * - Pase el mouse por una fila para resaltarla en el histograma.
 * - Haga clic en una fila para ver los datos que caen en esa clase.
 */
export default function TablaFrecuencias({ resultado, decimales: d, claseResaltada, setClaseResaltada }) {
  const { filas, totales, parametros, datos } = resultado;
  const discreto = parametros.modo === 'discreto';
  const [abierta, setAbierta] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const columnas = [
    { id: 'clase', titulo: 'Clase', ayuda: 'Número de clase o intervalo', valor: (f) => f.clase, total: () => 'Σ' },
    { id: 'li', titulo: 'Li', ayuda: 'Límite inferior', valor: (f) => num(f.li, d, true) },
    { id: 'ls', titulo: 'Ls', ayuda: discreto ? 'Límite superior aparente' : 'Límite superior', valor: (f) => num(f.ls, d, true) },
    ...(discreto
      ? [
          { id: 'lri', titulo: 'LRi', ayuda: 'Límite real inferior (frontera)', valor: (f) => num(f.lri, d, true) },
          { id: 'lrs', titulo: 'LRs', ayuda: 'Límite real superior (frontera)', valor: (f) => num(f.lrs, d, true) },
        ]
      : []),
    { id: 'fi', titulo: 'fi', ayuda: 'Frecuencia absoluta', valor: (f) => f.fi, total: () => totales.fi, fuerte: true },
    { id: 'Fi', titulo: 'Fi', ayuda: 'Frecuencia absoluta acumulada', valor: (f) => f.Fi },
    { id: 'xi', titulo: 'xi', ayuda: 'Marca de clase mi = (Li + Ls) / 2', valor: (f) => num(f.xi, d, true) },
    { id: 'xiFi', titulo: 'xi·fi', ayuda: 'Producto marca × frecuencia', valor: (f) => num(f.xiFi, d), total: () => num(totales.xiFi, d) },
    { id: 'xi2', titulo: 'xi²', ayuda: 'Cuadrado de la marca de clase', valor: (f) => num(f.xi2, d) },
    { id: 'xi2Fi', titulo: 'xi²·fi', ayuda: 'Cuadrado de la marca por la frecuencia', valor: (f) => num(f.xi2Fi, d), total: () => num(totales.xi2Fi, d) },
    { id: 'fr', titulo: 'fr', ayuda: 'Frecuencia relativa fi / n', valor: (f) => num(f.fr, Math.max(d, 2) + 2), total: () => num(totales.fr, Math.max(d, 2) + 2) },
    { id: 'frPct', titulo: 'fr %', ayuda: 'Frecuencia relativa porcentual', valor: (f) => num(f.frPct, d), total: () => num(totales.frPct, d) },
    { id: 'FrPct', titulo: 'Fr % acum.', ayuda: 'Frecuencia relativa acumulada porcentual', valor: (f) => num(f.FrPct, d) },
  ];

  const datosDeClase = (f) =>
    datos.ordenados.filter((x) =>
      discreto
        ? x >= f.li && x <= f.ls
        : f.clase === filas.length
          ? x >= f.li && x <= f.ls
          : x >= f.li && x < f.ls
    );

  const copiarCSV = async () => {
    const cab = columnas.map((c) => c.titulo).join(',');
    const cuerpo = filas.map((f) => columnas.map((c) => c.valor(f)).join(',')).join('\n');
    const tot = columnas.map((c) => (c.total ? c.total() : '')).join(',');
    try {
      await navigator.clipboard.writeText(`${cab}\n${cuerpo}\n${tot}`);
    } catch {
      return; // el navegador bloqueó el portapapeles
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <Tarjeta
      id="bloque-tabla"
      antetitulo="Paso 2 · Tabla"
      titulo="Tabla de distribución de frecuencias"
      subtitulo={`${filas.length} clases · intervalos ${discreto ? 'discretos con límites reales' : 'continuos [Li, Ls), último cerrado'} · clic en una fila para ver sus datos`}
      acciones={
        <Boton chico onClick={copiarCSV}>
          <Icono nombre="copiar" tamano={15} />
          {copiado ? 'Copiado' : 'Copiar CSV'}
        </Boton>
      }
      sinRelleno
    >
      <div className="tabla-envoltura scroll-fino">
        <table className="tabla tabla-frecuencias">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.id} title={c.ayuda} className="num">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <Fragment key={f.clase}>
                <tr
                  className={claseResaltada === f.clase ? 'activa' : undefined}
                  onMouseEnter={() => setClaseResaltada(f.clase)}
                  onMouseLeave={() => setClaseResaltada(null)}
                  onClick={() => setAbierta(abierta === f.clase ? null : f.clase)}
                  aria-expanded={abierta === f.clase}
                >
                  {columnas.map((c) => (
                    <td key={c.id} className={`num${c.fuerte ? ' tabla__fuerte' : ''}`}>
                      {c.valor(f)}
                    </td>
                  ))}
                </tr>
                {abierta === f.clase && (
                  <tr className="tabla-frecuencias__detalle">
                    <td colSpan={columnas.length}>
                      <b>
                        Clase {f.clase} · {f.intervalo}
                      </b>{' '}
                      — {f.fi} dato{f.fi === 1 ? '' : 's'}: <span className="num">{datosDeClase(f).join(', ') || 'ninguno'}</span>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              {columnas.map((c) => (
                <td key={c.id} className="num">
                  {c.total ? c.total() : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Tarjeta>
  );
}
