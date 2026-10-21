import { num } from '../utils/formato';

/** Fila de indicadores: n, Xmín, Xmáx, R, k, A con su procedimiento. */
export default function ResumenParametros({ parametros: p, decimales }) {
  const items = [
    { simbolo: 'n', nombre: 'Tamaño de muestra', valor: p.n },
    { simbolo: 'Xmín', nombre: 'Dato menor', valor: num(p.min, decimales, true) },
    { simbolo: 'Xmáx', nombre: 'Dato mayor', valor: num(p.max, decimales, true) },
    { simbolo: 'R', nombre: 'Rango', valor: num(p.rango, decimales, true), paso: p.pasos.rango },
    { simbolo: 'k', nombre: 'Nº de clases', valor: p.k, paso: p.pasos.sturges },
    { simbolo: 'A', nombre: 'Amplitud', valor: num(p.amplitud, decimales, true), paso: p.pasos.amplitud },
  ];

  return (
    <div className="kpis">
      {items.map((it) => (
        <div key={it.simbolo} className="kpi">
          <div className="kpi__cabecera">
            <span className="kpi__simbolo num">{it.simbolo}</span>
            <span className="kpi__nombre">{it.nombre}</span>
          </div>
          <div className="kpi__valor num">{it.valor}</div>
          {it.paso && <div className="kpi__paso">{it.paso}</div>}
        </div>
      ))}
    </div>
  );
}
