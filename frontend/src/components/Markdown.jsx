/**
 * Renderizador mínimo y seguro de Markdown (sin dangerouslySetInnerHTML).
 * Soporta: ## títulos, listas con - o 1., citas >, párrafos, **negrita**, *cursiva* y `código`.
 */
function enLinea(texto, clave = '') {
  const partes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let ultimo = 0;
  let m;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const t = m[0];
    const k = `${clave}-${i++}`;
    if (t.startsWith('**')) partes.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) partes.push(<code key={k}>{t.slice(1, -1)}</code>);
    else partes.push(<em key={k}>{t.slice(1, -1)}</em>);
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export default function Markdown({ texto }) {
  const lineas = texto.replace(/\r/g, '').split('\n');
  const bloques = [];
  let lista = null;
  let parrafo = [];

  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: 'p', texto: parrafo.join(' ') });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) bloques.push(lista);
    lista = null;
  };

  for (const cruda of lineas) {
    const l = cruda.trim();
    if (!l) {
      cerrarParrafo();
      cerrarLista();
    } else if (/^#{1,4}\s/.test(l)) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: 'h', texto: l.replace(/^#+\s*/, '') });
    } else if (/^([-*•]|\d+[.)])\s+/.test(l)) {
      cerrarParrafo();
      const ordenada = /^\d/.test(l);
      if (!lista || lista.ordenada !== ordenada) {
        cerrarLista();
        lista = { tipo: 'lista', ordenada, items: [] };
      }
      lista.items.push(l.replace(/^([-*•]|\d+[.)])\s+/, ''));
    } else if (l.startsWith('>')) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: 'cita', texto: l.replace(/^>\s*/, '') });
    } else {
      cerrarLista();
      parrafo.push(l);
    }
  }
  cerrarParrafo();
  cerrarLista();

  return (
    <div className="md">
      {bloques.map((b, i) => {
        if (b.tipo === 'h')
          return (
            <h4 key={i}>
              {enLinea(b.texto, i)}
            </h4>
          );
        if (b.tipo === 'cita')
          return (
            <blockquote key={i}>
              {enLinea(b.texto, i)}
            </blockquote>
          );
        if (b.tipo === 'lista') {
          const Etiqueta = b.ordenada ? 'ol' : 'ul';
          return (
            <Etiqueta key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{enLinea(it, `${i}-${j}`)}</li>
              ))}
            </Etiqueta>
          );
        }
        return <p key={i}>{enLinea(b.texto, i)}</p>;
      })}
    </div>
  );
}
