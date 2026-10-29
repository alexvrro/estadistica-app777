/** Iconos de trazo (24 × 24) usados en la navegación y los botones. */
const RUTAS = {
  datos: 'M4 7h11M4 12h16M4 17h8',
  parametros: 'M4 6h8M16 6h4M4 12h2M10 12h10M4 18h11M19 18h1M14 4v4M8 10v4M17 16v4',
  tabla: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
  medidas: 'M18 5H6l6 7-6 7h12',
  grafica: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  tutor: 'M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z',
  registro: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  historial: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  buscar: 'M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  sol: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  luna: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  flecha: 'M9 6l6 6-6 6',
  imprimir: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z',
  descargar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  subir: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  practica: 'M9 11l3 3 8-8M20 12v7H4V5h11',
  abrir: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  dado: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  compartir: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  comparar: 'M8 3v18M16 3v18M4 7h4M16 17h4M4 17h4M16 7h4',
  enviar: 'M4 12l16-8-6 16-2.5-6.5z',
};

export default function Icono({ nombre, tamano = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={RUTAS[nombre]} />
    </svg>
  );
}

export function Logo({ tamano = 18 }) {
  return (
    <span className="marca__logo">
      <svg viewBox="0 0 24 24" width={tamano} height={tamano} fill="currentColor" aria-hidden="true">
        <rect x="4" y="12" width="3.5" height="8" rx="1" />
        <rect x="10.25" y="5" width="3.5" height="15" rx="1" />
        <rect x="16.5" y="9" width="3.5" height="11" rx="1" />
      </svg>
    </span>
  );
}
