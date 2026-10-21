/**
 * Exporta un <svg> de la página como imagen PNG. Los colores de la página vienen
 * de variables CSS, que no existen fuera del documento: se copian los estilos ya
 * calculados a una copia del SVG antes de dibujarla en un canvas.
 */
const PROPIEDADES = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'font-size', 'font-weight', 'paint-order'];
const FUENTE = 'Segoe UI, Arial, sans-serif';

const variable = (valor) => {
  const m = /^var\((--[\w-]+)\)$/.exec(valor || '');
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : valor;
};

/**
 * @param {SVGSVGElement} svg
 * @param {{ nombre: string, titulo?: string, leyenda?: { color: string, texto: string, forma?: string }[] }} opciones
 */
export async function descargarSvgComoPng(svg, { nombre, titulo, leyenda = [] }) {
  const [, , ancho, alto] = svg.getAttribute('viewBox').split(' ').map(Number);
  const copia = svg.cloneNode(true);
  const originales = [svg, ...svg.querySelectorAll('*')];
  [copia, ...copia.querySelectorAll('*')].forEach((el, i) => {
    const estilo = getComputedStyle(originales[i]);
    for (const p of PROPIEDADES) el.style.setProperty(p, estilo.getPropertyValue(p));
    el.style.fontFamily = FUENTE;
  });
  copia.querySelectorAll('[tabindex]').forEach((el) => el.removeAttribute('tabindex'));

  const ns = 'http://www.w3.org/2000/svg';
  const arriba = titulo ? 40 : 12;
  const abajo = leyenda.length ? 40 : 12;
  const fondo = variable('var(--superficie)');
  const tinta = variable('var(--texto)');
  const lienzo = document.createElementNS(ns, 'svg');
  lienzo.setAttribute('xmlns', ns);
  lienzo.setAttribute('viewBox', `0 0 ${ancho} ${alto + arriba + abajo}`);
  lienzo.innerHTML = `<rect width="100%" height="100%" fill="${fondo}"/>`;

  if (titulo) {
    const t = document.createElementNS(ns, 'text');
    Object.entries({ x: 20, y: 28, fill: tinta, 'font-size': 16, 'font-weight': 600, 'font-family': FUENTE }).forEach(([k, v]) => t.setAttribute(k, v));
    t.textContent = titulo;
    lienzo.appendChild(t);
  }

  copia.setAttribute('x', 0);
  copia.setAttribute('y', arriba);
  copia.setAttribute('width', ancho);
  copia.setAttribute('height', alto);
  lienzo.appendChild(copia);

  let x = 20;
  const y = arriba + alto + 22;
  for (const item of leyenda) {
    const color = variable(item.color);
    lienzo.insertAdjacentHTML(
      'beforeend',
      item.forma === 'caja'
        ? `<rect x="${x}" y="${y - 9}" width="11" height="11" rx="2" fill="${color}"/>`
        : `<rect x="${x}" y="${y - 4}" width="16" height="2" rx="1" fill="${color}"/>`,
    );
    const t = document.createElementNS(ns, 'text');
    Object.entries({ x: x + 22, y, fill: tinta, 'font-size': 12, 'font-family': FUENTE }).forEach(([k, v]) => t.setAttribute(k, v));
    t.textContent = item.texto;
    lienzo.appendChild(t);
    x += 34 + item.texto.length * 7;
  }

  const datos = new XMLSerializer().serializeToString(lienzo);
  const url = URL.createObjectURL(new Blob([datos], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((ok, error) => {
      img.onload = ok;
      img.onerror = () => error(new Error('No se pudo generar la imagen.'));
      img.src = url;
    });
    const escala = 2;
    const canvas = document.createElement('canvas');
    canvas.width = ancho * escala;
    canvas.height = (alto + arriba + abajo) * escala;
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(png);
    enlace.download = `${nombre}.png`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
