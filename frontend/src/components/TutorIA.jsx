import { useState } from 'react';
import Tarjeta, { Aviso, Boton } from './Tarjeta';
import Icono from './Icono';
import Markdown from './Markdown';

const NOMBRES = { anthropic: 'Claude (Anthropic)', gemini: 'Google Gemini', local: 'Modo local' };

export default function TutorIA({ interpretacion, cargando, error, onGenerar, salud }) {
  const [copiado, setCopiado] = useState(false);
  const iaLista = salud?.ia?.configurada;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(interpretacion.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* el navegador bloqueó el portapapeles */
    }
  };

  return (
    <Tarjeta
      id="bloque-tutor"
      antetitulo="Paso 5 · Interpretación"
      titulo="Tutor de IA"
      subtitulo="Interpretación redactada para su reporte universitario"
      acciones={
        <>
          {interpretacion && (
            <Boton chico onClick={copiar}>
              <Icono nombre="copiar" tamano={15} />
              {copiado ? 'Copiado' : 'Copiar'}
            </Boton>
          )}
          <Boton chico variante="ia" onClick={onGenerar} disabled={cargando}>
            <Icono nombre="tutor" tamano={15} />
            {cargando ? 'Redactando…' : interpretacion ? 'Regenerar' : 'Generar análisis'}
          </Boton>
        </>
      }
    >
      {error && (
        <Aviso tipo="error" className="entrada__error">
          {error}
        </Aviso>
      )}

      {cargando && (
        <div className="esqueleto" aria-live="polite">
          {[92, 100, 85, 96, 70, 88].map((w, i) => (
            <div key={i} className="esqueleto__linea" style={{ width: `${w}%` }} />
          ))}
          <p className="esqueleto__nota">El tutor está leyendo la tabla y las medidas…</p>
        </div>
      )}

      {!cargando && !interpretacion && (
        <div className="tutor__presentacion">
          <span className="tutor__icono">
            <Icono nombre="tutor" />
          </span>
          <p>
            El tutor recibe la tabla de frecuencias y todas las medidas calculadas por el backend, y redacta una interpretación
            por secciones: descripción, tendencia central, dispersión, posición, forma y conclusión.
          </p>
          <p className="tutor__nota">
            {iaLista
              ? `Proveedor configurado: ${NOMBRES[salud.ia.proveedor] || salud.ia.proveedor}.`
              : 'No hay clave de API en el backend: se usará una interpretación automática local. Ejecute npm run configurar para agregarla.'}
          </p>
        </div>
      )}

      {!cargando && interpretacion && (
        <>
          <div className="tutor__meta">
            <span className="tutor__proveedor">{NOMBRES[interpretacion.proveedor] || interpretacion.proveedor}</span>
            <span className="tutor__modelo num">{interpretacion.modelo}</span>
          </div>
          {interpretacion.aviso && (
            <Aviso tipo="advertencia" className="entrada__error">
              {interpretacion.aviso}
            </Aviso>
          )}
          <div className="tutor__texto scroll-fino">
            <Markdown texto={interpretacion.texto} />
          </div>
        </>
      )}
    </Tarjeta>
  );
}
