/**
 * Generador de ejercicios para el modo práctica: muestras aleatorias con
 * distintas formas, como las de un examen de Estadística I.
 */

const FORMAS = [
  { id: 'normal', nombre: 'aproximadamente normal' },
  { id: 'derecha', nombre: 'con sesgo a la derecha' },
  { id: 'izquierda', nombre: 'con sesgo a la izquierda' },
  { id: 'uniforme', nombre: 'casi uniforme' },
];

const CONTEXTOS = [
  { variable: 'calificaciones de un examen parcial', unidad: 'puntos', centro: [55, 75], escala: [8, 14] },
  { variable: 'tiempo de respuesta de un servidor', unidad: 'ms', centro: [120, 260], escala: [20, 45] },
  { variable: 'estatura de estudiantes', unidad: 'cm', centro: [158, 172], escala: [5, 9] },
  { variable: 'consumo diario de agua', unidad: 'L', centro: [1.8, 2.6], escala: [0.3, 0.6], decimales: 1 },
  { variable: 'peso de paquetes enviados', unidad: 'kg', centro: [8, 20], escala: [2, 5], decimales: 1 },
  { variable: 'horas de estudio por semana', unidad: 'h', centro: [10, 18], escala: [3, 6] },
];

const entre = (a, b, azar) => a + (b - a) * azar();

/** Normal estándar con Box–Muller. */
function normal(azar) {
  const u = 1 - azar();
  const v = azar();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Un valor con media ≈ 0 y desviación ≈ 1 según la forma pedida. */
function muestra(forma, azar) {
  switch (forma) {
    case 'derecha': {
      // Exponencial centrada: cola larga hacia los valores altos
      return -Math.log(1 - azar()) - 1;
    }
    case 'izquierda':
      return 1 + Math.log(1 - azar());
    case 'uniforme':
      return (azar() - 0.5) * Math.sqrt(12);
    default:
      return normal(azar);
  }
}

/**
 * Devuelve { datos, contexto, forma }. `azar` permite fijar la semilla en pruebas.
 * Los datos nunca son negativos y tienen entre 30 y 60 valores.
 */
export function generarEjercicio(azar = Math.random) {
  const forma = FORMAS[Math.floor(azar() * FORMAS.length)];
  const ctx = CONTEXTOS[Math.floor(azar() * CONTEXTOS.length)];
  const n = 30 + Math.floor(azar() * 31);
  const centro = entre(...ctx.centro, azar);
  const escala = entre(...ctx.escala, azar);
  const factor = 10 ** (ctx.decimales ?? 0);

  const datos = Array.from({ length: n }, () => {
    const x = Math.max(0, centro + muestra(forma.id, azar) * escala);
    return Math.round(x * factor) / factor;
  });

  return {
    datos,
    contexto: { variable: ctx.variable, unidad: ctx.unidad, descripcion: `Ejercicio generado: muestra ${forma.nombre}.` },
    forma: forma.nombre,
  };
}
