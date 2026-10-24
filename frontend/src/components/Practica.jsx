import { useCallback, useEffect, useState } from 'react';
import Tarjeta, { Aviso, Boton } from './Tarjeta';
import Icono from './Icono';
import { api } from '../api/cliente';
import { num } from '../utils/formato';
import { conMacron } from './Simbolo';

/** Una respuesta es correcta si se aleja menos del 1 % (o de 0.01) del valor real. */
const TOLERANCIA_RELATIVA = 0.01;

const NOMBRES_CORTOS = { media: 'x̄', mediana: 'Me', moda: 'Mo', varianza: 's²', desviacion: 's', cv: 'CV', q1: 'Q1', q3: 'Q3' };

const leerNumero = (texto) => {
  const limpio = String(texto).trim().replace(',', '.');
  return limpio === '' || !Number.isFinite(Number(limpio)) ? null : Number(limpio);
};

/** Progreso guardado en MySQL: totales, racha y barra de aciertos por medida. */
function Progreso({ progreso, onReiniciar }) {
  if (!progreso.ejercicios) {
    return <p className="progreso__vacio">Aún no hay ejercicios revisados. ¡Haz el primero!</p>;
  }
  return (
    <div className="progreso">
      <div className="progreso__resumen">
        <div>
          <span className="progreso__cifra num">{progreso.ejercicios}</span>
          <span className="progreso__etiqueta">ejercicios</span>
        </div>
        <div>
          <span className="progreso__cifra num">{num(progreso.porcentaje, 0)} %</span>
          <span className="progreso__etiqueta">de aciertos</span>
        </div>
        <div>
          <span className="progreso__cifra num">{progreso.rachaPerfecta}</span>
          <span className="progreso__etiqueta">racha perfecta</span>
        </div>
        <button type="button" className="boton-texto-peligro progreso__reiniciar" onClick={onReiniciar}>
          Reiniciar progreso
        </button>
      </div>
      <ul className="progreso__barras">
        {progreso.porMedida.map((m) => (
          <li key={m.medida} className="progreso__barra">
            <span className="progreso__medida num">{conMacron(NOMBRES_CORTOS[m.medida] || m.medida)}</span>
            <span className="progreso__pista" title={`${m.aciertos} de ${m.intentos}`}>
              <span
                className={`progreso__relleno${m.porcentaje < 60 ? ' progreso__relleno--bajo' : ''}`}
                style={{ width: `${Math.max(m.porcentaje, 2)}%` }}
              />
            </span>
            <span className="progreso__pct num">{num(m.porcentaje, 0)} %</span>
          </li>
        ))}
      </ul>
      {progreso.porMedida.some((m) => m.porcentaje < 60) && (
        <p className="progreso__consejo">
          Repasa: {progreso.porMedida.filter((m) => m.porcentaje < 60).map((m) => NOMBRES_CORTOS[m.medida]).join(', ')}. Abre su
          procedimiento cuando falles para ver dónde está el error.
        </p>
      )}
    </div>
  );
}

/**
 * Modo práctica: el estudiante calcula las medidas a mano con la tabla y la app
 * le dice cuáles están bien. En las incorrectas muestra el procedimiento.
 * Cada revisión se guarda una vez en MySQL (tabla practicas) para medir el progreso.
 */
export default function Practica({ medidas: m, decimales: d, n, ejercicio, mysql, onSalir, onNuevo, onCambio }) {
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
  const [guardado, setGuardado] = useState(false); // el intento de estos datos ya está en MySQL
  const [progreso, setProgreso] = useState(null);
  const [errorBD, setErrorBD] = useState('');

  const estado = (p) => {
    const r = leerNumero(respuestas[p.id] ?? '');
    if (r === null) return 'vacia';
    return Math.abs(r - p.valor) <= Math.max(Math.abs(p.valor) * TOLERANCIA_RELATIVA, 0.01) ? 'correcta' : 'incorrecta';
  };
  const correctas = preguntas.filter((p) => estado(p) === 'correcta').length;

  const cargarProgreso = useCallback(async () => {
    if (!mysql) return;
    try {
      setProgreso(await api.progresoPracticas());
      setErrorBD('');
    } catch (e) {
      setErrorBD(e.message);
    }
  }, [mysql]);

  useEffect(() => {
    cargarProgreso();
  }, [cargarProgreso]);

  const revisar = async () => {
    setRevisado(true);
    // Solo cuenta el primer intento con todas las respuestas escritas
    const completas = preguntas.every((p) => estado(p) !== 'vacia');
    if (!mysql || guardado || !completas) return;
    setGuardado(true);
    try {
      const detalle = Object.fromEntries(preguntas.map((p) => [p.id, estado(p) === 'correcta']));
      const r = await api.guardarPractica({ n, detalle });
      setProgreso(r.progreso);
      setErrorBD('');
      onCambio?.();
    } catch (e) {
      setGuardado(false);
      setErrorBD(e.message);
    }
  };

  const reiniciar = async () => {
    if (!window.confirm('¿Borrar todo el progreso del modo práctica?')) return;
    try {
      await api.reiniciarPracticas();
      await cargarProgreso();
      onCambio?.();
    } catch (e) {
      setErrorBD(e.message);
    }
  };

  const completas = preguntas.every((p) => estado(p) !== 'vacia');

  return (
    <Tarjeta
      id="bloque-medidas"
      antetitulo="Paso 3 · Modo práctica"
      titulo="Calcula las medidas tú mismo"
      subtitulo="Usa la tabla de frecuencias. Se acepta un error de hasta 1 % por redondeo."
      acciones={
        <>
          <Boton chico variante="primario" onClick={onNuevo}>
            <Icono nombre="dado" tamano={15} />
            Ejercicio nuevo
          </Boton>
          <Boton chico variante="fantasma" onClick={onSalir}>
            Salir y ver todo
          </Boton>
        </>
      }
    >
      {ejercicio && (
        <p className="practica__enunciado">
          <b>Ejercicio:</b> se midió <i>{ejercicio.contexto.variable}</i> ({ejercicio.contexto.unidad}) en una muestra de {n}{' '}
          observaciones, {ejercicio.forma}. Con la tabla de frecuencias de arriba, calcula:
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          revisar();
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
            {revisado
              ? `${correctas} de ${preguntas.length} correctas${correctas === preguntas.length ? ' · ¡excelente!' : ''}${guardado ? ' · guardado en tu progreso' : ''}`
              : mysql
                ? 'Responde todas y pulsa Revisar: tu primer intento se guarda en tu progreso.'
                : 'Escribe tus resultados y pulsa Revisar.'}
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
            <Boton type="submit" variante="primario" title={completas ? undefined : 'Puedes revisar aunque falten respuestas, pero no se guardará en tu progreso'}>
              Revisar
            </Boton>
          </div>
        </div>
      </form>

      <section className="practica__progreso" aria-label="Tu progreso">
        <h3 className="medidas__titulo">Tu progreso</h3>
        {!mysql && <p className="progreso__vacio">Conecta MySQL para guardar tus puntajes y ver tu avance.</p>}
        {errorBD && <Aviso tipo="error">{errorBD}</Aviso>}
        {mysql && progreso && <Progreso progreso={progreso} onReiniciar={reiniciar} />}
      </section>
    </Tarjeta>
  );
}
