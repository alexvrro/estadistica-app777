/**
 * La fuente monoespaciada descoloca la raya de «x̄» (carácter combinante): ese
 * símbolo se dibuja con la fuente sans. Con `svg` devuelve <tspan> en lugar de <span>.
 */
export function conMacron(texto, svg = false) {
  if (typeof texto !== 'string' || !texto.includes('x̄')) return texto;
  return texto.split('x̄').flatMap((parte, i) =>
    i === 0
      ? [parte]
      : [
          svg ? (
            <tspan key={i} fontFamily="IBM Plex Sans, system-ui, sans-serif">
              x̄
            </tspan>
          ) : (
            <span key={i} className="fuente-sans">
              x̄
            </span>
          ),
          parte,
        ],
  );
}
