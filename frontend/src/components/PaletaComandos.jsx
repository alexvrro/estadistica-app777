import { useEffect, useMemo, useRef, useState } from 'react';
import Icono from './Icono';
import { Kbd } from './Tarjeta';

const normalizar = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Paleta de comandos (Ctrl + K): buscar y ejecutar acciones con el teclado.
 * `comandos`: [{ id, grupo, titulo, atajo?, palabras?, accion }]
 */
export default function PaletaComandos({ abierta, onCerrar, comandos }) {
  const [consulta, setConsulta] = useState('');
  const [indice, setIndice] = useState(0);
  const entrada = useRef(null);
  const lista = useRef(null);

  useEffect(() => {
    if (!abierta) return;
    setConsulta('');
    setIndice(0);
    entrada.current?.focus();
  }, [abierta]);

  const filtrados = useMemo(() => {
    const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
    return comandos.filter((c) => {
      const texto = normalizar(`${c.grupo} ${c.titulo} ${c.palabras || ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [consulta, comandos]);

  useEffect(() => {
    lista.current?.querySelector('[data-activo="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [indice, filtrados]);

  if (!abierta) return null;

  const ejecutar = (c) => {
    onCerrar();
    c.accion();
  };

  const teclas = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => (filtrados.length ? (i + 1) % filtrados.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => (filtrados.length ? (i - 1 + filtrados.length) % filtrados.length : 0));
    } else if (e.key === 'Enter' && filtrados[indice]) {
      e.preventDefault();
      ejecutar(filtrados[indice]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCerrar();
    }
  };

  return (
    <div className="paleta-fondo" onMouseDown={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label="Paleta de comandos" className="paleta" onMouseDown={(e) => e.stopPropagation()}>
        <div className="paleta__entrada">
          <Icono nombre="buscar" />
          <input
            ref={entrada}
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setIndice(0);
            }}
            onKeyDown={teclas}
            placeholder="¿Qué quieres hacer? Calcular, gráfica, tema…"
            aria-controls="paleta-lista"
          />
        </div>

        <ul id="paleta-lista" ref={lista} role="listbox" className="paleta__lista scroll-fino">
          {filtrados.length === 0 && <li className="paleta__vacio">Sin coincidencias.</li>}
          {filtrados.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === indice}>
              {(i === 0 || filtrados[i - 1].grupo !== c.grupo) && <div className="paleta__grupo">{c.grupo}</div>}
              <button className="paleta__item" data-activo={i === indice} onMouseMove={() => setIndice(i)} onClick={() => ejecutar(c)}>
                <span className="paleta__item-texto">{c.titulo}</span>
                {c.atajo && (
                  <span className="paleta__atajo">
                    {c.atajo.map((t) => (
                      <Kbd key={t}>{t}</Kbd>
                    ))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="paleta__pie">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navegar
          </span>
          <span>
            <Kbd>Enter</Kbd> ejecutar
          </span>
          <span>
            <Kbd>Esc</Kbd> cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
