import { useEffect, useRef, useState } from 'react';
import { Aviso, Boton } from './Tarjeta';
import Icono from './Icono';
import Markdown from './Markdown';
import { api } from '../api/cliente';

const SUGERENCIAS = ['¿Cómo se calculó la mediana?', '¿Por qué la curtosis tiene ese signo?', '¿Qué tan representativa es la media?', 'Explícame el Q3 paso a paso'];

/**
 * Preguntas de seguimiento al tutor sobre el análisis que se muestra.
 * `payload` es la solicitud que produjo el resultado (datos + opciones): el backend
 * la recalcula para que el tutor responda con las cifras exactas.
 */
export default function ChatTutor({ payload, contexto }) {
  const [mensajes, setMensajes] = useState([]); // { rol: 'usuario' | 'tutor', texto, aviso? }
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState('');
  const lista = useRef(null);

  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes, pensando]);

  const enviar = async (texto) => {
    const limpio = texto.trim();
    if (!limpio || pensando || !payload) return;
    const conversacion = [...mensajes, { rol: 'usuario', texto: limpio }];
    setMensajes(conversacion);
    setPregunta('');
    setPensando(true);
    setError('');
    try {
      const r = await api.chat({
        ...payload,
        contexto,
        mensajes: conversacion.map(({ rol, texto: t }) => ({ rol, texto: t })),
      });
      setMensajes((m) => [...m, { rol: 'tutor', texto: r.texto, aviso: r.respaldo ? r.aviso : undefined }]);
    } catch (e) {
      setError(e.message);
      setMensajes((m) => m.slice(0, -1)); // la pregunta vuelve a la caja para reintentar
      setPregunta(limpio);
    } finally {
      setPensando(false);
    }
  };

  return (
    <div className="chat">
      <h3 className="chat__titulo">
        <Icono nombre="chat" tamano={16} /> Pregúntale al tutor
      </h3>

      {mensajes.length > 0 && (
        <div className="chat__mensajes scroll-fino" ref={lista} aria-live="polite">
          {mensajes.map((m, i) => (
            <div key={i} className={`chat__mensaje chat__mensaje--${m.rol}`}>
              {m.rol === 'tutor' ? <Markdown texto={m.texto} /> : m.texto}
            </div>
          ))}
          {pensando && (
            <div className="chat__mensaje chat__mensaje--tutor chat__pensando">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      )}

      {mensajes.length === 0 && (
        <div className="chat__sugerencias">
          {SUGERENCIAS.map((s) => (
            <button key={s} type="button" className="chat__sugerencia" onClick={() => enviar(s)} disabled={!payload || pensando}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <Aviso tipo="error">{error}</Aviso>}

      <form
        className="chat__formulario"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pregunta);
        }}
      >
        <input
          className="campo"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Escribe tu duda sobre estos datos…"
          maxLength={2000}
          aria-label="Pregunta para el tutor"
          disabled={!payload}
        />
        <Boton type="submit" variante="ia" disabled={!pregunta.trim() || pensando || !payload} aria-label="Enviar pregunta">
          <Icono nombre="enviar" tamano={16} />
        </Boton>
      </form>
    </div>
  );
}
