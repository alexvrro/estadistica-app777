import Icono, { Logo } from './Icono';
import { Kbd } from './Tarjeta';

/** Estado del backend, la IA y MySQL (se muestra en el menú lateral). */
export function EstadoServicios({ salud }) {
  const caido = salud?.estado === 'caido';
  const filas = [
    ['Backend', !salud ? 'cargando' : caido ? 'error' : 'ok', !salud ? 'conectando…' : caido ? 'sin conexión' : 'en línea'],
    ...(salud?.ia ? [['Tutor IA', salud.ia.configurada ? 'ok' : 'aviso', salud.ia.configurada ? salud.ia.proveedor : 'modo local']] : []),
    ...(salud?.mysql ? [['MySQL', salud.mysql.configurada ? 'ok' : 'aviso', salud.mysql.configurada ? 'activo' : 'desactivado']] : []),
  ];
  return filas.map(([nombre, estado, texto]) => (
    <div key={nombre} className="estado-servicio">
      <span>{nombre}</span>
      <span className="estado-servicio__valor">
        {texto}
        <span className={`punto punto--${estado}${estado === 'cargando' ? ' punto--cargando' : ''}`} />
      </span>
    </div>
  ));
}

/** Chips de estado compactos (en móvil, bajo el título). */
export function ChipsServicios({ salud }) {
  const caido = salud?.estado === 'caido';
  const chips = [
    [!salud ? 'cargando' : caido ? 'error' : 'ok', caido ? 'Backend sin conexión' : 'Backend'],
    ...(salud?.ia ? [[salud.ia.configurada ? 'ok' : 'aviso', salud.ia.configurada ? `IA: ${salud.ia.proveedor}` : 'IA local']] : []),
    ...(salud?.mysql ? [[salud.mysql.configurada ? 'ok' : 'aviso', 'MySQL']] : []),
  ];
  return chips.map(([estado, texto]) => (
    <span key={texto} className="chip">
      <span className={`punto punto--${estado}`} />
      {texto}
    </span>
  ));
}

/** Menú lateral de escritorio con las secciones y el estado de los servicios. */
export function MenuLateral({ secciones, activa, onIr, salud }) {
  return (
    <aside className="lateral">
      <div className="marca">
        <Logo />
        <div>
          <div className="marca__nombre">Estadística I</div>
          <span className="marca__detalle">Datos agrupados</span>
        </div>
      </div>

      <p className="lateral__titulo">Secciones</p>
      <nav className="lateral__nav" aria-label="Secciones">
        {secciones.map(({ id, corto, icono }) => (
          <button key={id} className="lateral__enlace" aria-current={activa === id ? 'location' : undefined} onClick={() => onIr(id)}>
            <Icono nombre={icono} />
            {corto}
          </button>
        ))}
      </nav>

      <div className="lateral__pie">
        <EstadoServicios salud={salud} />
      </div>
    </aside>
  );
}

/** Barra superior: migas, buscador de comandos y cambio de tema. */
export default function Encabezado({ secciones, activa, onIr, onPaleta, oscuro, onTema, onExportar }) {
  const actual = secciones.find((s) => s.id === activa);
  return (
    <header className="barra-superior">
      <div className="barra-superior__fila">
        <div className="barra-superior__marca">
          <Logo tamano={16} />
          <span className="marca__nombre">Estadística I</span>
        </div>

        <div className="migas">
          <span>Análisis</span>
          <Icono nombre="flecha" tamano={14} />
          <strong>{actual?.titulo || 'Distribución de frecuencias'}</strong>
        </div>

        <div className="barra-superior__acciones">
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
          <button className="boton-icono" onClick={onTema} aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} title={oscuro ? 'Tema claro' : 'Tema oscuro'}>
            <Icono nombre={oscuro ? 'sol' : 'luna'} />
          </button>
        </div>
      </div>

      <nav className="nav-movil sin-barra" aria-label="Secciones">
        {secciones.map(({ id, corto }) => (
          <button key={id} className="nav-movil__enlace" aria-current={activa === id ? 'location' : undefined} onClick={() => onIr(id)}>
            {corto}
          </button>
        ))}
      </nav>
    </header>
  );
}
