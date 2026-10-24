import Icono, { Logo } from './Icono';
import { Kbd } from './Tarjeta';

/** Chips con el estado del backend, la IA y MySQL. */
export function ChipsServicios({ salud }) {
  const caido = salud?.estado === 'caido';
  const chips = [
    [!salud ? 'cargando' : caido ? 'error' : 'ok', caido ? 'Backend sin conexión' : 'Backend'],
    ...(salud?.ia ? [[salud.ia.configurada ? 'ok' : 'aviso', salud.ia.configurada ? `IA: ${salud.ia.proveedor}` : 'IA local']] : []),
    ...(salud?.mysql ? [[salud.mysql.configurada ? 'ok' : 'aviso', 'MySQL']] : []),
  ];
  return chips.map(([estado, texto]) => (
    <span key={texto} className="chip">
      <span className={`punto punto--${estado}${estado === 'cargando' ? ' punto--cargando' : ''}`} />
      {texto}
    </span>
  ));
}

/** Barra superior: marca, buscador de comandos, estado, tema y pestañas de secciones. */
export default function Encabezado({ secciones, activa, onIr, onPaleta, oscuro, onTema, onExportar, salud }) {
  return (
    <header className="barra-superior">
      <div className="barra-superior__fila">
        <div className="marca">
          <Logo />
          <div>
            <div className="marca__nombre">Estadística I</div>
            <span className="marca__detalle">cuaderno de datos agrupados</span>
          </div>
        </div>

        <div className="barra-superior__acciones">
          <div className="barra-superior__estados">
            <ChipsServicios salud={salud} />
          </div>
          <button className="buscador" onClick={onPaleta} aria-label="Buscar comandos">
            <Icono nombre="buscar" tamano={16} />
            <span className="buscador__texto">Buscar comandos…</span>
            <span className="buscador__atajo">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          {onExportar && (
            <button className="boton-icono" onClick={onExportar} aria-label="Exportar reporte a PDF" title="Exportar reporte a PDF">
              <Icono nombre="imprimir" />
            </button>
          )}
          <button className="boton-icono" onClick={onTema} aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} title={oscuro ? 'Cuaderno (claro)' : 'Pizarra (oscuro)'}>
            <Icono nombre={oscuro ? 'sol' : 'luna'} />
          </button>
        </div>
      </div>

      <nav className="pestanas sin-barra" aria-label="Secciones">
        {secciones.map(({ id, corto, icono }) => (
          <button key={id} className="pestana" aria-current={activa === id ? 'location' : undefined} onClick={() => onIr(id)}>
            <Icono nombre={icono} tamano={15} />
            {corto}
          </button>
        ))}
      </nav>
    </header>
  );
}
