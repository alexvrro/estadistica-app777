import { useState } from 'react';
import Tarjeta, { Boton } from './Tarjeta';
import { num } from '../utils/formato';
import { conMacron } from './Simbolo';

/** Una respuesta es correcta si se aleja menos del 1 % (o de 0.01) del valor real. */
const TOLERANCIA_RELATIVA = 0.01;

const leerNumero = (texto) => {
  const limpio = String(texto).trim().replace(',', '.');
  return limpio === '' || !Number.isFinite(Number(limpio)) ? null : Number(limpio);
};

/**
 * Modo práctica: el estudiante calcula las medidas a mano con la tabla y la app
 * le dice cuáles están bien. En las incorrectas muestra el procedimiento.
 */
export default function Practica({ medidas: m, decimales: d, onSalir }) {
  const t = m.tendenciaCentral;
  const disp = m.dispersion;
  const [q1, , q3] = m.posicion.cuartiles;
  const preguntas = [
    { id: 'media', simbolo: 'x̄', nombre: 'Media aritmética', valor: t.media.valor, pasos: t.media.pasos },
    { id: 'mediana', simbolo: 'Me', nombre: 'Mediana', valor: t.mediana.valor, pasos: t.mediana.pasos },
    { id: 'moda', simbolo: 'Mo', nombre: 'Moda (primera clase modal)', valor: t.moda.valores[0].valor, pasos: t.moda.valores[0].pasos },
    { id: 'varianza', simbolo: 's²', nombre: 'Varianza muestral', valor: disp.varianza.valor, pasos: disp.varianza.pasos },
    { id: 'desviacion', simbolo: 's', nombre: 'Desviación estándar', valor: disp.desviacion.valor, pasos: disp.desviacion.pasos },
    { id: 'cv', simbolo: 'CV %', nombre: 'Coeficiente de variación', valor: disp.coeficienteVariacion.valor, pasos: disp.coeficienteVariacion.pasos },
    { id: 'q1', simbolo: 'Q1', nombre: 'Primer cuartil', valor: q1.valor, pasos: q1.pasos },
    { id: 'q3', simbolo: 'Q3', nombre: 'Tercer cuartil', valor: q3.valor, pasos: q3.pasos },
  ].filter((p) => p.valor !== null);

  const [respuestas, setRespuestas] = useState({});
  const [revisado, setRevisado] = useState(false);

  const estado = (p) => {
    const r = leerNumero(respuestas[p.id] ?? '');
    if (r === null) return 'vacia';
    return Math.abs(r - p.valor) <= Math.max(Math.abs(p.valor) * TOLERANCIA_RELATIVA, 0.01) ? 'correcta' : 'incorrecta';
  };
  const correctas = preguntas.filter((p) => estado(p) === 'correcta').length;

  return (
    <Tarjeta
      id="bloque-medidas"
      antetitulo="Paso 3 · Modo práctica"
      titulo="Calcula las medidas tú mismo"
      subtitulo="Usa la tabla de frecuencias. Se acepta un error de hasta 1 % por redondeo."
      acciones={
        <Boton chico variante="fantasma" onClick={onSalir}>
          Salir y ver todo
        </Boton>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setRevisado(true);
        }}
      >
        <div className="practica__rejilla">
          {preguntas.map((p) => {
            const e = revisado ? estado(p) : null;
            return (
              <div key={p.id} className={`practica__pregunta${e ? ` practica__pregunta--${e}` : ''}`}>
                <label className="practica__etiqueta" htmlFor={`pr-${p.id}`}>
                  <span className="medida__simbolo">{conMacron(p.simbolo)}</span>
                  <span>{p.nombre}</span>
                </label>
                <input
                  id={`pr-${p.id}`}
                  className="campo num"
                  inputMode="decimal"
                  autoComplete="off"
                  value={respuestas[p.id] ?? ''}
                  onChange={(ev) => {
                    setRespuestas((r) => ({ ...r, [p.id]: ev.target.value }));
                    setRevisado(false);
                  }}
                  placeholder="Tu resultado"
                />
                {e === 'correcta' && <p className="practica__resultado">✓ Correcto ({num(p.valor, d)})</p>}
                {e === 'vacia' && <p className="practica__resultado">Sin responder · era {num(p.valor, d)}</p>}
                {e === 'incorrecta' && (
                  <>
                    <p className="practica__resultado">✗ El valor correcto es {num(p.valor, d)}</p>
                    <div className="medida__pasos">
                      {p.pasos.map((paso, i) => (
                        <div key={i}>{conMacron(paso)}</div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="entrada__pie">
          <p className="practica__puntaje" aria-live="polite">
            {revisado ? `${correctas} de ${preguntas.length} correctas${correctas === preguntas.length ? ' · ¡excelente!' : ''}` : 'Escribe tus resultados y pulsa Revisar.'}
          </p>
          <div className="entrada__botones">
            <Boton
              type="button"
              variante="fantasma"
              onClick={() => {
                setRespuestas({});
                setRevisado(false);
              }}
            >
              Borrar respuestas
            </Boton>
            <Boton type="submit" variante="primario">
              Revisar
            </Boton>
          </div>
        </div>
      </form>
    </Tarjeta>
  );
}
