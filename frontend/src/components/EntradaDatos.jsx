import { useMemo } from 'react';
import Tarjeta, { Aviso, Boton, Kbd, Segmentado } from './Tarjeta';
import Icono from './Icono';
import { parsearDatos } from '../utils/formato';

/**
 * Tarjeta de entrada de la muestra. Enter calcula; Shift + Enter agrega un salto de línea.
 * Las opciones del análisis se despliegan dentro de la misma tarjeta.
 */
export default function EntradaDatos({
  texto,
  setTexto,
  opciones,
  setOpciones,
  contexto,
  setContexto,
  onCalcular,
  cargando,
  error,
  panelAbierto,
  setPanelAbierto,
}) {
  const { validos, invalidos } = useMemo(() => parsearDatos(texto), [texto]);
  const set = (k) => (e) => setOpciones((o) => ({ ...o, [k]: e.target.value }));
  const setCtx = (k) => (e) => setContexto((c) => ({ ...c, [k]: e.target.value }));
  const puedeCalcular = !cargando && validos.length >= 2;

  const enviar = (e) => {
    e.preventDefault();
    if (puedeCalcular) onCalcular();
  };

  return (
    <Tarjeta
      id="bloque-datos"
      antetitulo="Paso 1 · Entrada"
      titulo="Datos de la muestra"
      subtitulo="Pega o escribe los valores separados por comas, espacios o saltos de línea"
      acciones={
        <Boton chico variante="secundario" onClick={() => setPanelAbierto((a) => !a)} aria-expanded={panelAbierto}>
          <Icono nombre="parametros" tamano={15} />
          {panelAbierto ? 'Ocultar opciones' : 'Opciones'}
        </Boton>
      }
    >
      <form onSubmit={enviar}>
        <div className="entrada__marco">
          <textarea
            id="entrada-datos"
            className="entrada__area scroll-fino"
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) enviar(e);
            }}
            spellCheck={false}
            aria-label="Datos de la muestra"
            placeholder="45, 52, 38, 61, 47, 55 …"
          />
          <div className="entrada__estado">
            <span className={`entrada__contador num${invalidos.length ? ' entrada__contador--error' : ''}`}>
              {validos.length} datos válidos
              {invalidos.length > 0 && ` · ${invalidos.length} inválidos`}
            </span>
          </div>
        </div>

        {panelAbierto && (
          <div className="entrada__opciones aparecer">
            <div className="ancho-2">
              <label className="etiqueta" htmlFor="op-variable">
                Variable en estudio (para el reporte)
              </label>
              <input id="op-variable" className="campo" value={contexto.variable} onChange={setCtx('variable')} placeholder="Ej. resistencia del concreto" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="op-unidad">
                Unidad
              </label>
              <input id="op-unidad" className="campo" value={contexto.unidad} onChange={setCtx('unidad')} placeholder="Ej. MPa" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="op-percentiles">
                Percentiles (Pk)
              </label>
              <input id="op-percentiles" className="campo num" value={opciones.percentiles} onChange={set('percentiles')} placeholder="17, 90" />
            </div>

            <div className="ancho-2">
              <span className="etiqueta">Tipo de intervalos</span>
              <Segmentado
                ancho
                etiqueta="Tipo de intervalos"
                opciones={[
                  ['continuo', 'Continuos [Li, Ls)'],
                  ['discreto', 'Discretos + reales'],
                ]}
                valor={opciones.modo}
                onCambio={(modo) => setOpciones((o) => ({ ...o, modo }))}
              />
            </div>
            <div className="ancho-2">
              <label className="etiqueta" htmlFor="op-decimales">
                Decimales a mostrar: {opciones.decimales}
              </label>
              <input id="op-decimales" className="deslizador" type="range" min="0" max="6" value={opciones.decimales} onChange={set('decimales')} />
            </div>

            <div>
              <label className="etiqueta" htmlFor="op-clases">
                Nº de clases k
              </label>
              <input id="op-clases" className="campo num" type="number" min="1" max="50" value={opciones.clases} onChange={set('clases')} placeholder="Sturges" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="op-amplitud">
                Amplitud A
              </label>
              <input id="op-amplitud" className="campo num" type="number" step="any" min="0" value={opciones.amplitud} onChange={set('amplitud')} placeholder="Auto" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="op-li">
                Límite inicial
              </label>
              <input id="op-li" className="campo num" type="number" step="any" value={opciones.limiteInicial} onChange={set('limiteInicial')} placeholder="Xmín" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="op-deciles">
                Deciles (Dk)
              </label>
              <input id="op-deciles" className="campo num" value={opciones.deciles} onChange={set('deciles')} placeholder="1, 9" />
            </div>
          </div>
        )}

        {(error || invalidos.length > 0) && (
          <Aviso tipo="error" className="entrada__error">
            {error || `Valores no numéricos: ${invalidos.slice(0, 5).join(', ')}`}
          </Aviso>
        )}

        <div className="entrada__pie">
          <div className="entrada__atajos">
            <span>
              <Kbd>Enter</Kbd> calcular
            </span>
            <span>
              <Kbd>Shift</Kbd>
              <Kbd>Enter</Kbd> nueva línea
            </span>
          </div>
          <div className="entrada__botones">
            <Boton type="button" variante="fantasma" onClick={() => setTexto('')}>
              Limpiar
            </Boton>
            <Boton type="submit" variante="primario" disabled={!puedeCalcular}>
              {cargando ? 'Calculando…' : 'Calcular'}
            </Boton>
          </div>
        </div>
      </form>
    </Tarjeta>
  );
}
