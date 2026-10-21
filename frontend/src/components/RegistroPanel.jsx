import { useCallback, useEffect, useState } from 'react';
import Tarjeta, { Aviso, Boton } from './Tarjeta';
import { api } from '../api/cliente';
import { num } from '../utils/formato';
import { conMacron } from './Simbolo';

/**
 * Registro de análisis guardados en MySQL en el servidor.
 * `payload` es la solicitud con la que se calculó el resultado que se muestra.
 */
export default function RegistroPanel({ payload, contexto, onCambio }) {
  const [lista, setLista] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const r = await api.registros();
      setLista(r.registros);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    setAviso('');
    setError('');
    try {
      const r = await api.guardarRegistro({ ...payload, contexto });
      setAviso(`Registro #${r.id} guardado`);
      cargar();
      onCambio?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm(`¿Eliminar el registro #${id}?`)) return;
    try {
      await api.eliminarRegistro(id);
      cargar();
      onCambio?.();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Tarjeta
      id="bloque-registro"
      antetitulo="MySQL"
      titulo="Registro de análisis"
      subtitulo={`${lista.length} guardado${lista.length === 1 ? '' : 's'} en la base de datos`}
      acciones={
        <Boton chico variante="primario" onClick={guardar} disabled={guardando || !payload}>
          {guardando ? 'Guardando…' : 'Guardar análisis'}
        </Boton>
      }
      sinRelleno
    >
      {(aviso || error || lista.length === 0) && (
        <div className="contenido-tarjeta">
          {aviso && <Aviso tipo="exito">✓ {aviso}</Aviso>}
          {error && <Aviso tipo="error">{error}</Aviso>}
          {lista.length === 0 && !error && <p className="vacio">Aún no hay análisis guardados.</p>}
        </div>
      )}

      {lista.length > 0 && (
        <div className="tabla-envoltura scroll-fino">
          <table className="tabla tabla--izquierda tabla-registro">
            <thead>
              <tr>
                {['#', 'Fecha', 'Variable', 'n', 'x̄', 'Me', 's', 'CV %', ''].map((h, i) => (
                  <th key={i}>{conMacron(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.id}</td>
                  <td className="num">{r.creado_en}</td>
                  <td>{r.variable || '—'}</td>
                  <td className="num">{r.n}</td>
                  <td className="num">{num(r.media, 2)}</td>
                  <td className="num">{num(r.mediana, 2)}</td>
                  <td className="num">{num(r.desviacion, 2)}</td>
                  <td className="num">{num(r.cv, 2)}</td>
                  <td>
                    <button className="boton-texto-peligro" onClick={() => eliminar(r.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}
