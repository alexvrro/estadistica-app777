// En desarrollo Vite redirige /api → http://localhost:3001 (ver vite.config.js).
// En producción se puede definir VITE_API_URL=https://mi-servidor.com
const BASE = import.meta.env.VITE_API_URL || '';

async function peticion(ruta, opciones = {}) {
  let resp;
  try {
    resp = await fetch(`${BASE}${ruta}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
  } catch {
    throw new Error('No se pudo conectar con el backend. ¿Está corriendo en el puerto 3001?');
  }
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
  return json;
}

export const api = {
  salud: () => peticion('/api/salud'),
  ejemplo: () => peticion('/api/estadistica/ejemplo'),
  analizar: (payload) => peticion('/api/estadistica/analizar', { method: 'POST', body: JSON.stringify(payload) }),
  interpretar: (payload) => peticion('/api/estadistica/interpretar', { method: 'POST', body: JSON.stringify(payload) }),
  registros: () => peticion('/api/registros'),
  registro: (id) => peticion(`/api/registros/${id}`),
  guardarRegistro: (payload) => peticion('/api/registros', { method: 'POST', body: JSON.stringify(payload) }),
  eliminarRegistro: (id) => peticion(`/api/registros/${id}`, { method: 'DELETE' }),
  historial: (limite = 100) => peticion(`/api/historial?limite=${limite}`),
};
