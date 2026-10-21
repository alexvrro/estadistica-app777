import { useCallback, useEffect, useState } from 'react';
import { api } from './api/cliente';
import { parsearDatos, parsearLista } from './utils/formato';
import Encabezado, { ChipsServicios, MenuLateral } from './components/Encabezado';
import EntradaDatos from './components/EntradaDatos';
import ResumenParametros from './components/ResumenParametros';
import TablaFrecuencias from './components/TablaFrecuencias';
import GraficaDistribucion from './components/GraficaDistribucion';
import PanelMedidas from './components/PanelMedidas';
import TutorIA from './components/TutorIA';
import RegistroPanel from './components/RegistroPanel';
import HistorialPanel from './components/HistorialPanel';
import PaletaComandos from './components/PaletaComandos';

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

  const [interpretacion, setInterpretacion] = useState(null);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [errorIA, setErrorIA] = useState('');
  const [salud, setSalud] = useState(null);

  // Clase resaltada en la tabla/histograma (al pasar el mouse por una medida)
  const [claseResaltada, setClaseResaltada] = useState(null);

  // Cambia cada vez que el usuario hace una operación; el historial se vuelve a consultar
  const [versionHistorial, setVersionHistorial] = useState(0);
  const notificarOperacion = useCallback(() => setVersionHistorial((v) => v + 1), []);

  const [paleta, setPaleta] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false); // opciones del análisis

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
  const alternarTema = () => setTema(oscuro ? 'light' : 'dark');

  const construirPayload = useCallback(
    (textoDatos = texto) => ({
      datos: parsearDatos(textoDatos).validos,
      modo: opciones.modo,
      clases: opciones.clases || undefined,
      amplitud: opciones.amplitud || undefined,
      limiteInicial: opciones.limiteInicial === '' ? undefined : opciones.limiteInicial,
      percentiles: parsearLista(opciones.percentiles),
      deciles: parsearLista(opciones.deciles),
    }),
    [texto, opciones]
  );

  const calcular = useCallback(
    async (textoDatos, origen = 'usuario') => {
      const { invalidos } = parsearDatos(textoDatos ?? texto);
      if (invalidos.length) {
        setError(`Hay valores no numéricos: ${invalidos.slice(0, 5).join(', ')}`);
        return;
      }
      setCargando(true);
      setError('');
      try {
        const payload = construirPayload(textoDatos ?? texto);
        const r = await api.analizar({ ...payload, origen });
        setResultado(r);
        setUltimoPayload(payload);
        setInterpretacion(null); // la interpretación anterior ya no corresponde
        notificarOperacion();
      } catch (e) {
        setError(e.message);
      } finally {
        setCargando(false);
      }
    },
    [texto, construirPayload, notificarOperacion]
  );

  const generarIA = async () => {
    setCargandoIA(true);
    setErrorIA('');
    try {
      const r = await api.interpretar({ ...construirPayload(), contexto });
      setInterpretacion(r);
      notificarOperacion();
    } catch (e) {
      setErrorIA(e.message);
    } finally {
      setCargandoIA(false);
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

  // Al abrir la app: estado del backend + muestra de ejemplo
  useEffect(() => {
    api.salud().then(setSalud).catch(() => setSalud({ estado: 'caido' }));
    cargarEjemplo();
  }, [cargarEjemplo]);

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
    'bloque-tutor': ['Tutor IA', 'tutor'],
    'bloque-registro': ['Registro', 'registro'],
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
          ['bloque-tutor', 'Tutor de IA', 'gemini interpretacion'],
        ]
      : []),
    ['bloque-registro', 'Registro de análisis', 'mysql guardados'],
    ['bloque-historial', 'Historial de operaciones', 'mysql'],
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
    ...(resultado
      ? [
          {
            id: 'ia',
            grupo: 'Acciones',
            titulo: 'Generar interpretación con IA',
            palabras: 'tutor gemini analisis',
            accion: () => {
              irA('bloque-tutor');
              generarIA();
            },
          },
        ]
      : []),
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
      <MenuLateral secciones={secciones} activa={activa} onIr={(id) => irA(id, id === 'bloque-datos' ? 'entrada-datos' : undefined)} salud={salud} />
      <PaletaComandos abierta={paleta} onCerrar={() => setPaleta(false)} comandos={comandos} />

      <div className="principal">
        <Encabezado
          secciones={secciones}
          activa={activa}
          onIr={(id) => irA(id, id === 'bloque-datos' ? 'entrada-datos' : undefined)}
          onPaleta={() => setPaleta(true)}
          oscuro={oscuro}
          onTema={alternarTema}
        />

        <main className="contenido">
          <section className="heroe">
            <div>
              <span className="heroe__insignia">Estadística I · Ingeniería</span>
              <h1 className="heroe__titulo">
                Distribución de <span className="heroe__degradado">frecuencias</span>
              </h1>
              <p className="heroe__texto">
                Tabla para datos agrupados, medidas de tendencia central, dispersión y posición, gráficas interactivas e
                interpretación asistida por IA.
              </p>
            </div>
            <div className="heroe__estados">
              <ChipsServicios salud={salud} />
            </div>
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
              />
              <PanelMedidas medidas={resultado.medidas} decimales={dec} setClaseResaltada={setClaseResaltada} />
              <div className="rejilla-grafica">
                <GraficaDistribucion resultado={resultado} decimales={dec} claseResaltada={claseResaltada} />
                <TutorIA
                  interpretacion={interpretacion}
                  cargando={cargandoIA}
                  error={errorIA}
                  onGenerar={generarIA}
                  salud={salud}
                />
              </div>
            </>
          )}

          <div className="rejilla-dos">
            <RegistroPanel payload={ultimoPayload} contexto={contexto} onCambio={notificarOperacion} />
            <HistorialPanel version={versionHistorial} />
          </div>
        </main>

        <footer className="pie">Estadística I · Distribución de frecuencias para datos agrupados · Express + React</footer>
      </div>
    </div>
  );
}
