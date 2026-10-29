import { useCallback, useEffect, useState } from 'react';
import { api } from './api/cliente';
import { num, parsearDatos, parsearLista } from './utils/formato';
import Encabezado, { ChipsServicios } from './components/Encabezado';
import EntradaDatos from './components/EntradaDatos';
import ResumenParametros from './components/ResumenParametros';
import TablaFrecuencias from './components/TablaFrecuencias';
import GraficaDistribucion from './components/GraficaDistribucion';
import PanelMedidas from './components/PanelMedidas';
import RegistroPanel from './components/RegistroPanel';
import HistorialPanel from './components/HistorialPanel';
import PaletaComandos from './components/PaletaComandos';
import Practica from './components/Practica';
import Comparacion from './components/Comparacion';
import { generarEjercicio } from './utils/generador';
import { crearEnlace, leerEnlace } from './utils/compartir';

/** Identifica un resultado (para reiniciar el modo práctica al cambiar los datos). */
const idResultado = (r) => `${r.parametros.n}-${r.totales.xiFi}-${r.totales.xi2Fi}-${r.parametros.k}`;

const OPCIONES_INICIALES = {
  modo: 'continuo',
  clases: '',
  amplitud: '',
  limiteInicial: '',
  percentiles: '17',
  deciles: '',
  decimales: 2,
};

export default function App() {
  const [texto, setTexto] = useState('');
  const [opciones, setOpciones] = useState(OPCIONES_INICIALES);
  const [contexto, setContexto] = useState({ variable: '', unidad: '', descripcion: '' });

  const [resultado, setResultado] = useState(null);
  const [ultimoPayload, setUltimoPayload] = useState(null); // solicitud que produjo el resultado mostrado
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [salud, setSalud] = useState(null);

  // Clase resaltada en la tabla/histograma (al pasar el mouse por una medida)
  const [claseResaltada, setClaseResaltada] = useState(null);

  // Cambia cada vez que el usuario hace una operación; el historial se vuelve a consultar
  const [versionHistorial, setVersionHistorial] = useState(0);
  const notificarOperacion = useCallback(() => setVersionHistorial((v) => v + 1), []);

  const [paleta, setPaleta] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false); // opciones del análisis
  const [practica, setPractica] = useState(false); // oculta medidas y gráfica para practicar
  const [ejercicio, setEjercicio] = useState(null); // ejercicio generado que se está resolviendo
  const [notificacion, setNotificacion] = useState('');

  const notificar = useCallback((texto) => {
    setNotificacion(texto);
    setTimeout(() => setNotificacion((n) => (n === texto ? '' : n)), 3500);
  }, []);

  // Tema: 'light' | 'dark' elegido con el botón, o null para seguir al sistema
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem('tema');
    } catch {
      return null;
    }
  });
  const [sistemaOscuro, setSistemaOscuro] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = (e) => setSistemaOscuro(e.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);
  useEffect(() => {
    const raiz = document.documentElement;
    if (tema) raiz.dataset.theme = tema;
    else delete raiz.dataset.theme;
    try {
      if (tema) localStorage.setItem('tema', tema);
      else localStorage.removeItem('tema');
    } catch {
      /* almacenamiento no disponible: el tema solo dura esta visita */
    }
  }, [tema]);
  const oscuro = tema ? tema === 'dark' : sistemaOscuro;

  // El reporte se imprime siempre con el tema claro (también con Ctrl + P)
  useEffect(() => {
    const raiz = document.documentElement;
    let previo;
    const antes = () => {
      previo = raiz.dataset.theme;
      raiz.dataset.theme = 'light';
    };
    const despues = () => {
      if (previo) raiz.dataset.theme = previo;
      else delete raiz.dataset.theme;
    };
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', despues);
    return () => {
      window.removeEventListener('beforeprint', antes);
      window.removeEventListener('afterprint', despues);
    };
  }, []);
  const exportarPDF = () => window.print();
  const alternarTema = () => setTema(oscuro ? 'light' : 'dark');

  // `ops` permite calcular con opciones recién elegidas, antes de que React actualice el estado
  const construirPayload = useCallback(
    (textoDatos = texto, ops = opciones) => ({
      datos: parsearDatos(textoDatos).validos,
      modo: ops.modo,
      clases: ops.clases || undefined,
      amplitud: ops.amplitud || undefined,
      limiteInicial: ops.limiteInicial === '' ? undefined : ops.limiteInicial,
      percentiles: parsearLista(ops.percentiles),
      deciles: parsearLista(ops.deciles),
    }),
    [texto, opciones]
  );

  const calcular = useCallback(
    async (textoDatos, origen = 'usuario', ops) => {
      const { invalidos } = parsearDatos(textoDatos ?? texto);
      if (invalidos.length) {
        setError(`Hay valores no numéricos: ${invalidos.slice(0, 5).join(', ')}`);
        return;
      }
      setCargando(true);
      setError('');
      try {
        const payload = construirPayload(textoDatos ?? texto, ops);
        const r = await api.analizar({ ...payload, origen });
        setResultado(r);
        setUltimoPayload(payload);
        if (origen !== 'ejercicio') setEjercicio(null);
        notificarOperacion();
      } catch (e) {
        setError(e.message);
      } finally {
        setCargando(false);
      }
    },
    [texto, construirPayload, notificarOperacion]
  );

  /** Modo práctica: genera una muestra al azar y la calcula sin salir de la práctica. */
  const nuevoEjercicio = useCallback(async () => {
    const ej = generarEjercicio();
    const t = ej.datos.join(', ');
    // Las opciones manuales (k, A, límite) del análisis anterior podrían no servir para estos datos
    const ops = { ...OPCIONES_INICIALES, decimales: opciones.decimales };
    setTexto(t);
    setOpciones(ops);
    setContexto(ej.contexto);
    setPractica(true);
    await calcular(t, 'ejercicio', ops);
    setEjercicio(ej);
    requestAnimationFrame(() => document.getElementById('bloque-tabla')?.scrollIntoView({ behavior: 'smooth' }));
  }, [calcular, opciones.decimales]);

  const compartir = async () => {
    const { validos } = parsearDatos(texto);
    if (validos.length < 2) return;
    let enlace;
    try {
      enlace = await crearEnlace({ datos: validos, opciones: construirPayload(), contexto });
    } catch {
      notificar('No se pudo crear el enlace');
      return;
    }
    // El enlace también queda en la barra de direcciones: sirve si el navegador bloquea el portapapeles
    window.history.replaceState(null, '', enlace);
    try {
      await navigator.clipboard.writeText(enlace);
      notificar(enlace.length > 8000 ? 'Enlace copiado (es muy largo: algunos chats podrían cortarlo)' : 'Enlace copiado: pégalo para compartir este análisis');
    } catch {
      notificar('El navegador no dejó copiar: copia el enlace de la barra de direcciones');
    }
  };

  const abrirRegistro = async (reg) => {
    const op = reg.opciones || {};
    const nuevas = {
      ...OPCIONES_INICIALES,
      decimales: opciones.decimales,
      modo: op.modo === 'discreto' ? 'discreto' : 'continuo',
      clases: op.clases ?? '',
      amplitud: op.amplitud ?? '',
      limiteInicial: op.limiteInicial ?? '',
      percentiles: (op.percentiles || []).join(', '),
      deciles: (op.deciles || []).join(', '),
    };
    const payload = {
      datos: reg.datos,
      modo: nuevas.modo,
      clases: op.clases,
      amplitud: op.amplitud,
      limiteInicial: op.limiteInicial,
      percentiles: op.percentiles || [],
      deciles: op.deciles || [],
    };
    setCargando(true);
    setError('');
    try {
      const r = await api.analizar({ ...payload, origen: 'automatico' });
      setTexto(reg.datos.join(', '));
      setOpciones(nuevas);
      setContexto({ variable: reg.variable || '', unidad: reg.unidad || '', descripcion: '' });
      setResultado(r);
      setUltimoPayload(payload);
      setPractica(false);
      requestAnimationFrame(() => document.getElementById('bloque-parametros')?.scrollIntoView({ behavior: 'smooth' }));
    } finally {
      setCargando(false);
    }
  };

  const cargarEjemplo = useCallback(async () => {
    try {
      const { datos, contexto: ctx } = await api.ejemplo();
      const t = datos.join(', ');
      setTexto(t);
      setContexto((c) => ({ ...c, ...ctx }));
      calcular(t, 'automatico'); // carga inicial: no se registra en el historial
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Abre un análisis recibido por enlace (#a=…). */
  const cargarCompartido = useCallback(
    async ({ datos, opciones: op, contexto: ctx }) => {
      const ops = {
        ...OPCIONES_INICIALES,
        modo: op.modo === 'discreto' ? 'discreto' : 'continuo',
        clases: op.clases ?? '',
        amplitud: op.amplitud ?? '',
        limiteInicial: op.limiteInicial ?? '',
        percentiles: (op.percentiles || []).join(', '),
        deciles: (op.deciles || []).join(', '),
      };
      const t = datos.join(', ');
      setTexto(t);
      setOpciones(ops);
      setContexto({ variable: ctx.variable || '', unidad: ctx.unidad || '', descripcion: '' });
      await calcular(t, 'automatico', ops);
      notificar('Abriste un análisis compartido por enlace');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Al abrir la app: estado del backend + análisis compartido (si viene en la URL) o la muestra de ejemplo
  useEffect(() => {
    api.salud().then(setSalud).catch(() => setSalud({ estado: 'caido' }));
    leerEnlace().then((compartido) => (compartido ? cargarCompartido(compartido) : cargarEjemplo()));
  }, [cargarEjemplo, cargarCompartido]);

  // Ctrl + K (o Ctrl + Shift + P) abre la paleta de comandos
  useEffect(() => {
    const alPulsar = (e) => {
      const tecla = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (tecla === 'k' || (e.shiftKey && tecla === 'p'))) {
        e.preventDefault();
        setPaleta((p) => !p);
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  const dec = Number(opciones.decimales);

  const irA = (id, enfocar) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (enfocar ? document.getElementById(enfocar) : el)?.focus({ preventScroll: true });
  };

  // Nombre corto e icono de cada sección en la navegación
  const NAV = {
    'bloque-datos': ['Datos', 'datos'],
    'bloque-parametros': ['Parámetros', 'parametros'],
    'bloque-tabla': ['Tabla', 'tabla'],
    'bloque-medidas': ['Medidas', 'medidas'],
    'bloque-grafica': ['Gráfica', 'grafica'],
    'bloque-registro': ['Registro', 'registro'],
    'bloque-comparar': ['Comparar', 'comparar'],
    'bloque-historial': ['Historial', 'historial'],
  };

  const bloques = [
    ['bloque-datos', 'Datos de la muestra', 'entrada textarea', 'entrada-datos'],
    ...(resultado
      ? [
          ['bloque-parametros', 'Parámetros (n, R, k, A)', 'sturges rango amplitud'],
          ['bloque-tabla', 'Tabla de frecuencias', 'fi fr intervalos'],
          ['bloque-medidas', 'Medidas descriptivas', 'media mediana moda varianza cuartiles'],
          ['bloque-grafica', 'Gráfica de la distribución', 'histograma ojiva caja'],
        ]
      : []),
    ['bloque-registro', 'Registro de análisis', 'mysql guardados'],
    ['bloque-historial', 'Historial de operaciones', 'mysql'],
    ['bloque-comparar', 'Comparar dos análisis', 'mysql comparacion lado a lado'],
  ];

  const comandos = [
    { id: 'calcular', grupo: 'Acciones', titulo: 'Calcular tabla y medidas', atajo: ['Enter'], accion: () => calcular() },
    {
      id: 'opciones',
      grupo: 'Acciones',
      titulo: panelAbierto ? 'Ocultar opciones del análisis' : 'Mostrar opciones del análisis',
      palabras: 'variable unidad percentiles deciles clases amplitud decimales',
      accion: () => setPanelAbierto((a) => !a),
    },
    { id: 'ejemplo', grupo: 'Acciones', titulo: 'Cargar ejemplo (40 datos)', palabras: 'muestra', accion: cargarEjemplo },
    {
      id: 'ejercicio',
      grupo: 'Acciones',
      titulo: 'Ejercicio nuevo (datos al azar para practicar)',
      palabras: 'generar aleatorio practica examen dado',
      accion: nuevoEjercicio,
    },
    {
      id: 'compartir',
      grupo: 'Exportar',
      titulo: 'Copiar enlace para compartir este análisis',
      palabras: 'link url enviar',
      accion: compartir,
    },
    {
      id: 'importar',
      grupo: 'Acciones',
      titulo: 'Importar datos desde un archivo (.csv, .txt)',
      palabras: 'excel subir abrir',
      accion: () => document.getElementById('importar-archivo')?.click(),
    },
    ...(resultado
      ? [
          { id: 'pdf', grupo: 'Exportar', titulo: 'Exportar reporte a PDF / imprimir', atajo: ['Ctrl', 'P'], palabras: 'descargar imprimir', accion: exportarPDF },
          {
            id: 'png',
            grupo: 'Exportar',
            titulo: 'Descargar la gráfica como imagen PNG',
            palabras: 'imagen foto',
            accion: () => {
              setPractica(false);
              requestAnimationFrame(() => window.dispatchEvent(new Event('descargar-grafica')));
            },
          },
          {
            id: 'practica',
            grupo: 'Acciones',
            titulo: practica ? 'Salir del modo práctica' : 'Modo práctica: calcular las medidas a mano',
            palabras: 'ejercicio examen estudiar',
            accion: () => {
              setPractica((p) => !p);
              requestAnimationFrame(() => irA('bloque-medidas'));
            },
          },
        ]
      : []),
    { id: 'tema', grupo: 'Acciones', titulo: oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro', palabras: 'modo noche dia apariencia', accion: alternarTema },
    {
      id: 'limpiar',
      grupo: 'Acciones',
      titulo: 'Limpiar datos',
      palabras: 'borrar',
      accion: () => {
        setTexto('');
        irA('bloque-datos', 'entrada-datos');
      },
    },
    {
      id: 'modo',
      grupo: 'Acciones',
      titulo: opciones.modo === 'continuo' ? 'Cambiar a intervalos discretos' : 'Cambiar a intervalos continuos',
      palabras: 'modo tipo',
      accion: () => setOpciones((o) => ({ ...o, modo: o.modo === 'continuo' ? 'discreto' : 'continuo' })),
    },
    ...bloques.map(([id, titulo, palabras, enfocar]) => ({ id, grupo: 'Ir a', titulo, palabras, accion: () => irA(id, enfocar) })),
  ];

  const secciones = bloques.map(([id, titulo]) => ({ id, titulo, corto: NAV[id][0], icono: NAV[id][1] }));

  // Sección visible: la última cuyo borde superior ya pasó bajo el encabezado.
  const idsBloques = secciones.map(({ id }) => id).join(',');
  const [activa, setActiva] = useState(null);
  useEffect(() => {
    const ids = idsBloques.split(',');
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      let actual = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) actual = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) actual = ids.at(-1);
      setActiva(actual);
    };
    const alDesplazar = () => {
      if (!cuadro) cuadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, [idsBloques]);

  return (
    <div className="app">
      <PaletaComandos abierta={paleta} onCerrar={() => setPaleta(false)} comandos={comandos} />

      <div className="principal">
        <Encabezado
          secciones={secciones}
          activa={activa}
          onIr={(id) => irA(id, id === 'bloque-datos' ? 'entrada-datos' : undefined)}
          onPaleta={() => setPaleta(true)}
          oscuro={oscuro}
          onTema={alternarTema}
          onExportar={resultado ? exportarPDF : undefined}
          onCompartir={resultado ? compartir : undefined}
          salud={salud}
        />

        <main className="contenido">
          {resultado && (
            <header className="reporte solo-impresion">
              <h1 className="reporte__titulo">Reporte · Distribución de frecuencias</h1>
              <p className="reporte__meta">
                {contexto.variable ? `Variable: ${contexto.variable}${contexto.unidad ? ` (${contexto.unidad})` : ''} · ` : ''}
                n = {resultado.parametros.n} · intervalos {resultado.parametros.modo === 'discreto' ? 'discretos' : 'continuos'} ·{' '}
                {new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}
              </p>
              <p className="reporte__datos num">
                Datos: {resultado.datos.ordenados.map((x) => num(x, resultado.parametros.precision, true)).join(', ')}
              </p>
            </header>
          )}

          <section className="heroe">
            <div className="heroe__textos">
              <span className="heroe__insignia">Estadística I · Ingeniería</span>
              <h1 className="heroe__titulo">
                Distribución de <span className="heroe__degradado">frecuencias</span>
              </h1>
              <p className="heroe__texto">
                Tabla para datos agrupados, medidas de tendencia central, dispersión y posición, gráficas interactivas e
                interpretación asistida por IA.
              </p>
              <div className="heroe__estados">
                <ChipsServicios salud={salud} />
              </div>
            </div>
            {resultado && (
              <aside className="nota-adhesiva" aria-label="Resumen del análisis actual">
                <p className="nota-adhesiva__titulo">resumen rápido</p>
                <dl className="nota-adhesiva__lista">
                  <div>
                    <dt>n</dt>
                    <dd className="num">{resultado.parametros.n}</dd>
                  </div>
                  <div>
                    <dt>x̄</dt>
                    <dd className="num">{num(resultado.medidas.tendenciaCentral.media.valor, dec, true)}</dd>
                  </div>
                  <div>
                    <dt>Me</dt>
                    <dd className="num">{num(resultado.medidas.tendenciaCentral.mediana.valor, dec, true)}</dd>
                  </div>
                  <div>
                    <dt>s</dt>
                    <dd className="num">{num(resultado.medidas.dispersion.desviacion.valor, dec, true)}</dd>
                  </div>
                </dl>
              </aside>
            )}
          </section>

          <EntradaDatos
            texto={texto}
            setTexto={setTexto}
            opciones={opciones}
            setOpciones={setOpciones}
            contexto={contexto}
            setContexto={setContexto}
            onCalcular={() => calcular()}
            cargando={cargando}
            error={error}
            panelAbierto={panelAbierto}
            setPanelAbierto={setPanelAbierto}
          />

          {!resultado && !cargando && !error && (
            <p className="vacio">
              Escriba los datos de la muestra y pulse <b>Calcular</b> para ver la tabla, las medidas y las gráficas.
            </p>
          )}

          {resultado && (
            <>
              <section id="bloque-parametros" tabIndex={-1} className="seccion aparecer">
                <div className="seccion__cabecera">
                  <h2 className="seccion__titulo">Parámetros de la tabla</h2>
                  <span className="seccion__detalle">Regla de Sturges</span>
                </div>
                <ResumenParametros parametros={resultado.parametros} decimales={dec} />
              </section>
              <TablaFrecuencias
                resultado={resultado}
                decimales={dec}
                claseResaltada={claseResaltada}
                setClaseResaltada={setClaseResaltada}
                contexto={contexto}
              />
              {practica ? (
                <Practica
                  key={idResultado(resultado)}
                  medidas={resultado.medidas}
                  decimales={dec}
                  n={resultado.parametros.n}
                  ejercicio={ejercicio}
                  mysql={Boolean(salud?.mysql?.configurada)}
                  onSalir={() => setPractica(false)}
                  onNuevo={nuevoEjercicio}
                  onCambio={notificarOperacion}
                />
              ) : (
                <>
                  <PanelMedidas
                    medidas={resultado.medidas}
                    decimales={dec}
                    setClaseResaltada={setClaseResaltada}
                    onPractica={() => setPractica(true)}
                  />
                  <GraficaDistribucion resultado={resultado} decimales={dec} claseResaltada={claseResaltada} />
                </>
              )}
            </>
          )}

          <div className="rejilla-dos">
            <RegistroPanel payload={ultimoPayload} contexto={contexto} onCambio={notificarOperacion} onAbrir={abrirRegistro} />
            <HistorialPanel version={versionHistorial} />
          </div>

          <Comparacion version={versionHistorial} onCambio={notificarOperacion} />
        </main>

        {notificacion && (
          <div className="notificacion" role="status">
            {notificacion}
          </div>
        )}

        <footer className="pie">Estadística I · hecho con lápiz, papel, Express y React ✎</footer>
      </div>
    </div>
  );
}
