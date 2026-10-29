import { useCallback, useEffect, useState } from 'react';
import Tarjeta, { Aviso, Boton } from './Tarjeta';
import { api } from '../api/cliente';
import { formatearFecha } from '../utils/formato';

const ETIQUETAS = {
  ANALISIS: { texto: 'Análisis', clase: 'operacion--analisis' },
  INTERPRETACION: { texto: 'Interpretación IA', clase: 'operacion--interpretacion' },
  GUARDAR_REGISTRO: { texto: 'Guardar registro', clase: 'operacion--guardar' },
  ELIMINAR_REGISTRO: { texto: 'Eliminar registro', clase: 'operacion--eliminar' },
  PRACTICA: { texto: 'Práctica', clase: 'operacion--guardar' },
  REINICIAR_PRACTICAS: { texto: 'Reiniciar progreso', clase: 'operacion--eliminar' },
  CHAT_TUTOR: { texto: 'Pregunta al tutor', clase: 'operacion--interpretacion' },
  COMPARACION: { texto: 'Comparación', clase: 'operacion--analisis' },
};

/**
 * Historial de operaciones guardado en MySQL.
 * `version` cambia cada vez que el usuario hace algo; al cambiar, se vuelve a consultar.
 */
export default function HistorialPanel({ version }) {
  const [operaciones, setOperaciones] = useState([]);
  const [disponible, setDisponible] = useState(true);
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.historial(100);
      setOperaciones(r.operaciones);
      setDisponible(r.disponible);
      setAviso(r.aviso || '');
    } catch (e) {
      setAviso(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  const sinFilas = operaciones.length === 0;

  return (
    <Tarjeta
      id="bloque-historial"
      antetitulo="MySQL"
      titulo="Historial de operaciones"
      subtitulo="Cada acción del usuario queda guardada (tabla historial_operaciones)"
      acciones={
        <Boton chico onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </Boton>
      }
      sinRelleno
    >
      {(!disponible || aviso || sinFilas) && (
        <div className="contenido-tarjeta">
          {!disponible && <Aviso tipo="advertencia">{aviso || 'MySQL no está configurado.'}</Aviso>}
          {disponible && aviso && <Aviso tipo="error">{aviso}</Aviso>}
          {disponible && sinFilas && !aviso && <p className="vacio">Todavía no hay operaciones registradas.</p>}
        </div>
      )}

      {!sinFilas && (
        <div className="tabla-envoltura tabla-envoltura--alta scroll-fino">
          <table className="tabla tabla--izquierda tabla-registro">
            <thead>
              <tr>
                {['#', 'Fecha', 'Operación', 'Detalle'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {operaciones.map((op) => {
                const etiqueta = ETIQUETAS[op.tipo_operacion] || { texto: op.tipo_operacion, clase: '' };
                return (
                  <tr key={op.id}>
                    <td className="num">{op.id}</td>
                    <td className="num">{formatearFecha(op.fecha)}</td>
                    <td>
                      <span className={`operacion ${etiqueta.clase}`}>{etiqueta.texto}</span>
                    </td>
                    <td className="celda-detalle">{op.detalle}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}
