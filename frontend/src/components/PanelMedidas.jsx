import { useState } from 'react';
import Tarjeta from './Tarjeta';
import { num } from '../utils/formato';
import { conMacron } from './Simbolo';

/**
 * Tarjeta de una medida con su procedimiento desplegable.
 * `acento`: media | mediana | moda | neutro (mismos colores que la gráfica).
 */
function Medida({ simbolo, nombre, valor, sufijo = '', nota, pasos = [], clase, setClaseResaltada, acento = 'neutro' }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <div
      className={`medida medida--${acento}`}
      onMouseEnter={() => clase && setClaseResaltada(clase)}
      onMouseLeave={() => clase && setClaseResaltada(null)}
    >
      <div className="medida__cabecera">
        <span className="medida__simbolo">{conMacron(simbolo)}</span>
        <span className="medida__nombre">{nombre}</span>
      </div>
      <div className="medida__valor num">
        {valor}
        {sufijo && <span className="medida__sufijo">{sufijo}</span>}
      </div>
      {nota && <div className="medida__nota">{nota}</div>}
      {pasos.length > 0 && (
        <>
          <button className="medida__boton" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}>
            {abierta ? 'Ocultar procedimiento' : 'Ver procedimiento'}
          </button>
          {abierta && (
            <div className="medida__pasos">
              {pasos.map((p, i) => (
                <div key={i}>{conMacron(p)}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Grupo({ titulo, descripcion, children }) {
  return (
    <div>
      <div className="medidas__cabecera">
        <h3 className="medidas__titulo">{titulo}</h3>
        <span className="medidas__descripcion">{descripcion}</span>
      </div>
      <div className="medidas__rejilla">{children}</div>
    </div>
  );
}

export default function PanelMedidas({ medidas: m, decimales: d, setClaseResaltada }) {
  const t = m.tendenciaCentral;
  const disp = m.dispersion;
  const pos = m.posicion;
  const cv = disp.coeficienteVariacion.valor;
  const nivelCV = cv === null ? '' : cv < 15 ? 'Variabilidad baja' : cv <= 30 ? 'Variabilidad moderada' : 'Variabilidad alta';
  const sk = m.forma.asimetriaPearson.valor;
  const forma = Math.abs(sk) < 0.1 ? 'Aprox. simétrica' : sk > 0 ? 'Asimetría positiva (derecha)' : 'Asimetría negativa (izquierda)';
  const comun = { setClaseResaltada };

  return (
    <Tarjeta
      id="bloque-medidas"
      antetitulo="Paso 3 · Medidas"
      titulo="Medidas descriptivas"
      subtitulo="Fórmulas para datos agrupados · pase el mouse para resaltar la clase usada"
    >
      <div className="medidas">
        <Grupo titulo="Tendencia central" descripcion="¿Alrededor de qué valor se concentran los datos?">
          <Medida {...comun} acento="media" simbolo="x̄" nombre="Media aritmética" valor={num(t.media.valor, d)} pasos={t.media.pasos} />
          <Medida
            {...comun}
            acento="mediana"
            simbolo="Me"
            nombre="Mediana"
            valor={num(t.mediana.valor, d)}
            nota={`Clase ${t.mediana.clase}`}
            clase={t.mediana.clase}
            pasos={t.mediana.pasos}
          />
          {t.moda.valores.map((mo, i) => (
            <Medida
              {...comun}
              key={i}
              acento="moda"
              simbolo={t.moda.valores.length > 1 ? `Mo${i + 1}` : 'Mo'}
              nombre={`Moda (${t.moda.tipo})`}
              valor={num(mo.valor, d)}
              nota={`Clase modal ${mo.clase}`}
              clase={mo.clase}
              pasos={mo.pasos}
            />
          ))}
          <Medida {...comun} simbolo="Sk" nombre="Asimetría de Pearson" valor={num(sk, d + 1)} nota={forma} pasos={m.forma.asimetriaPearson.pasos} />
        </Grupo>

        <Grupo titulo="Dispersión y variabilidad" descripcion="¿Qué tan alejados están los datos de la media?">
          <Medida {...comun} simbolo="A" nombre="Amplitud de intervalo" valor={num(disp.amplitud.valor, d, true)} nota={`Rango R = ${num(disp.rango.valor, d, true)}`} pasos={[...disp.rango.pasos, ...disp.amplitud.pasos]} />
          <Medida
            {...comun}
            simbolo="s²"
            nombre="Varianza muestral"
            valor={num(disp.varianza.valor, d)}
            nota={`Poblacional σ² = ${num(disp.varianza.poblacional, d)}`}
            pasos={disp.varianza.pasos}
          />
          <Medida
            {...comun}
            simbolo="s"
            nombre="Desviación estándar"
            valor={num(disp.desviacion.valor, d)}
            nota={`Poblacional σ = ${num(disp.desviacion.poblacional, d)}`}
            pasos={disp.desviacion.pasos}
          />
          <Medida {...comun} simbolo="CV" nombre="Coeficiente de variación" valor={num(cv, 2)} sufijo="%" nota={nivelCV} pasos={disp.coeficienteVariacion.pasos} />
        </Grupo>

        <Grupo titulo="Posición" descripcion="Valores que dividen la distribución ordenada (interpolación lineal)">
          {pos.cuartiles.map((q) => (
            <Medida
              {...comun}
              key={`Q${q.k}`}
              acento={q.k === 2 ? 'mediana' : 'neutro'}
              simbolo={`Q${q.k}`}
              nombre={`Cuartil ${q.k}`}
              valor={num(q.valor, d)}
              nota={`${q.k * 25} % de los datos ≤ este valor · clase ${q.clase}`}
              clase={q.clase}
              pasos={q.pasos}
            />
          ))}
          <Medida {...comun} simbolo="RIC" nombre="Rango intercuartil" valor={num(disp.rangoIntercuartil.valor, d)} nota="50 % central de los datos" pasos={disp.rangoIntercuartil.pasos} />
        </Grupo>

        {pos.percentiles.length + pos.deciles.length > 0 && (
          <Grupo titulo="Percentiles y deciles" descripcion="Valores solicitados en las opciones">
            {[...pos.percentiles.map((p) => ({ ...p, letra: 'P', nombre: 'Percentil', pct: p.k })), ...pos.deciles.map((p) => ({ ...p, letra: 'D', nombre: 'Decil', pct: p.k * 10 }))].map((p) => (
              <Medida
                {...comun}
                key={`${p.letra}${p.k}`}
                simbolo={`${p.letra}${p.k}`}
                nombre={`${p.nombre} ${p.k}`}
                valor={num(p.valor, d)}
                nota={`${p.pct} % de los datos ≤ este valor · clase ${p.clase}`}
                clase={p.clase}
                pasos={p.pasos}
              />
            ))}
          </Grupo>
        )}
      </div>
    </Tarjeta>
  );
}
