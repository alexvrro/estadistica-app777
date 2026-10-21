/** Tarjeta base de cada sección: antetítulo, título, acciones y contenido. */
export default function Tarjeta({ id, antetitulo, titulo, subtitulo, acciones, children, sinRelleno = false, className = '' }) {
  return (
    <section id={id} tabIndex={-1} className={`tarjeta aparecer ${className}`}>
      {(titulo || acciones) && (
        <header className="tarjeta__cabecera">
          <div className="tarjeta__textos">
            {antetitulo && <p className="tarjeta__antetitulo">{antetitulo}</p>}
            <h2 className="tarjeta__titulo">{titulo}</h2>
            {subtitulo && <p className="tarjeta__subtitulo">{subtitulo}</p>}
          </div>
          {acciones && <div className="tarjeta__acciones">{acciones}</div>}
        </header>
      )}
      <div className={`tarjeta__cuerpo${sinRelleno ? ' tarjeta__cuerpo--sin-relleno' : ''}`}>{children}</div>
    </section>
  );
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** variante: primario | secundario | fantasma | ia */
export function Boton({ variante = 'secundario', chico = false, className = '', ...props }) {
  return <button className={`boton boton--${variante}${chico ? ' boton--chico' : ''} ${className}`} {...props} />;
}

/** tipo: error | exito | advertencia | info */
export function Aviso({ tipo = 'info', children, className = '' }) {
  return (
    <p className={`aviso aviso--${tipo} ${className}`} role={tipo === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  );
}

export function Segmentado({ opciones, valor, onCambio, ancho = false, etiqueta }) {
  return (
    <div className={`segmentado${ancho ? ' segmentado--ancho' : ''}`} role="group" aria-label={etiqueta}>
      {opciones.map(([v, t]) => (
        <button key={v} type="button" className="segmentado__opcion" aria-pressed={valor === v} onClick={() => onCambio(v)}>
          {t}
        </button>
      ))}
    </div>
  );
}
