# estadistica-app777 · Distribución de frecuencias + MySQL + comparación con IA (Gemini)

Aplicación para datos agrupados (tabla de frecuencias, medidas de tendencia central, dispersión y posición).
Incluye un **registro de análisis con sus datos**, un **historial de operaciones** y el **progreso del modo práctica**,
todo guardado en **MySQL** (5.7 u 8.0), y la comparación de dos análisis redactada con **Google Gemini**.

- **Backend:** Node.js 20.19+ + Express + mysql2
- **Frontend:** React + Vite + CSS puro (`frontend/src/estilos/`, tema claro y oscuro)

### Funciones

| Función | Cómo se usa |
|---|---|
| Tabla de frecuencias y medidas | Escribe o pega los datos y pulsa **Enter** (o **Calcular**). Cada medida trae su procedimiento. |
| Importar datos | Botón **Importar archivo** o arrastra un `.csv`, `.tsv` o `.txt` al área de datos. En tablas toma la primera columna numérica que no sea un número de fila; acepta coma decimal con `;` o tabulador. |
| Forma de la distribución | Asimetría de Pearson, **curtosis** por momentos (g2) y percentílica (K), y **datos atípicos** con las vallas de Tukey (Q1 − 1.5·RIC, Q3 + 1.5·RIC). |
| Agrupados vs. sin agrupar | Compara media, mediana y desviación de la tabla con las de los datos originales. |
| Gráficas | Histograma (fi / fr %), **polígono de frecuencias**, **ojiva** con la lectura de cuartiles, diagrama de caja con atípicos y **tallo y hoja** de los datos sin agrupar. Botón **PNG** para descargarlas como imagen. |
| Modo práctica | Botón **Modo práctica** en *Medidas*: oculta los resultados, calculas a mano y la app te dice cuáles están bien (margen de 1 %) y muestra el procedimiento de los incorrectos. **Ejercicio nuevo** genera datos al azar (normal, sesgada o uniforme) y el primer intento de cada ejercicio se guarda en MySQL: aciertos por medida y racha. |
| Exportar | **Excel** (.xlsx con la tabla, las medidas y los datos, sin librerías externas), **Copiar CSV** y reporte en **PDF** (botón de impresora o **Ctrl + P** → «Guardar como PDF»). |
| Compartir por enlace | Botón de enlace en la barra superior: los datos y las opciones viajan comprimidos dentro de la URL (no pasan por el servidor). |
| Registro e historial (MySQL) | **Guardar análisis**, y **Abrir** para recuperar uno guardado con sus datos y opciones. |
| Comparar dos análisis | Elige dos registros guardados: tabla lado a lado, polígonos superpuestos, cuál es más homogéneo (CV) y una comparación redactada con Gemini (o en modo local si no hay clave). |
| Paleta de comandos | **Ctrl + K**: todas las acciones con el teclado, incluido el cambio de tema claro / oscuro. |

## 1. Estructura

```
estadistica-app777/
├── package.json
├── README.md
├── backend/
│   ├── .env.example          ← plantilla de .env (npm run configurar la usa)
│   ├── scripts/configurar.js ← asistente que crea .env
│   ├── sql/esquema.sql       ← crea la base y las tablas en MySQL 5.7
│   ├── src/
│   │   ├── server.js · app.js
│   │   ├── db/mysql.js                 ← conexión y creación de tablas
│   │   ├── repositories/
│   │   │   ├── registro.repo.js        ← registro de análisis (MySQL)
│   │   │   ├── historial.repo.js       ← historial de operaciones (MySQL)
│   │   │   └── practica.repo.js        ← intentos del modo práctica (MySQL)
│   │   ├── controllers/                ← estadística, registro, historial, práctica
│   │   ├── services/
│   │   │   ├── estadistica.service.js  ← motor estadístico
│   │   │   ├── ia.service.js           ← comparación redactada (Gemini) y modo local
│   │   │   ├── practica.service.js     ← validación y progreso de la práctica
│   │   │   └── historial.service.js
│   │   └── routes/ · utils/ · data/
│   └── tests/                         ← motor estadístico y utilidades de .env
└── frontend/
    └── src/
        ├── App.jsx
        ├── components/   ← EntradaDatos, TablaFrecuencias, PanelMedidas, Practica,
        │                   GraficaDistribucion, RegistroPanel, HistorialPanel, Comparacion,
        │                   PaletaComandos, Encabezado, …
        ├── estilos/      ← base, layout, componentes, secciones e impresión (CSS puro)
        └── utils/        ← formato, exportar PNG, xlsx (Excel), compartir por enlace,
                            generador de ejercicios y tallo y hoja
```

## 2. Requisitos

- Node.js **20.19 o superior**
- **MySQL Server 5.7** (o 8.0)
- Clave de API de **Gemini**: https://aistudio.google.com/apikey

## 3. Base de datos (MySQL 5.7)

Como administrador de MySQL:

```bash
mysql -u root -p < backend/sql/esquema.sql
```

Crea la base `estadistica` y las tablas `registros_analisis`, `historial_operaciones` y `practicas`.
Si prefieres, crea solo la base vacía y el backend creará las tablas al arrancar.

Para un usuario de aplicación (recomendado en lugar de `root`):

```sql
CREATE USER 'estadistica'@'localhost' IDENTIFIED BY 'una_clave_segura';
GRANT ALL PRIVILEGES ON estadistica.* TO 'estadistica'@'localhost';
FLUSH PRIVILEGES;
```

> **MySQL 5.7:** la conexión usa `mysql_native_password`, que es el método por defecto en esa versión.
> Si tu servidor usa `caching_sha2_password` (MySQL 8.0) y ves errores de autenticación, cambia el usuario o su método.

## 4. Instalación y configuración

```bash
npm run instalar      # instala raíz, backend y frontend
npm run configurar    # asistente que crea backend/.env desde cero
```

El asistente `npm run configurar`:

1. **Gemini:** te pide la clave (créala gratis en https://aistudio.google.com/apikey → *Create API key*),
   la **verifica** contra la API de Google, muestra los modelos disponibles para tu clave y hace una prueba rápida.
   Si la dejas vacía, la comparación se redacta en *modo local* (sin IA externa).
2. **MySQL (opcional):** pide host, puerto, usuario y contraseña, **prueba la conexión** y crea la base
   `estadistica` si no existe. Las tablas se crean solas al arrancar el backend.
3. Escribe `backend/.env`. Si ya existía, usa sus valores como predeterminados y pide confirmación antes de sobrescribirlo.

Las claves no se muestran en pantalla mientras las escribes. `backend/.env` está en `.gitignore`: no lo compartas ni lo subas a GitHub.

<details><summary>Configuración manual (sin asistente)</summary>

```bash
cd backend && cp .env.example .env     # Windows: copy .env.example .env
```

Edita `backend/.env`:

```ini
IA_PROVEEDOR=gemini
GEMINI_API_KEY=tu_clave_de_gemini
GEMINI_MODEL=gemini-3.8-flash

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=estadistica
MYSQL_PASSWORD=una_clave_segura
MYSQL_DATABASE=estadistica
```

</details>

## 5. Ejecución

```bash
npm run dev          # API en http://localhost:3001 y web en http://localhost:5173
```

Al arrancar, la consola debe mostrar `✔ MySQL conectado`. Si ves `⚠`, revisa el bloque MySQL de `.env`.

Pruebas del motor estadístico: `npm test`.

## 6. Qué se guarda en MySQL

| Tabla | Contenido |
|---|---|
| `registros_analisis` | Cada análisis guardado con sus **datos**, opciones, resultado completo y medidas principales |
| `historial_operaciones` | Cada acción: `ANALISIS`, `GUARDAR_REGISTRO`, `ELIMINAR_REGISTRO`, `PRACTICA`, `REINICIAR_PRACTICAS`, `COMPARACION` |
| `practicas` | Cada ejercicio revisado del modo práctica: tamaño de muestra, aciertos y qué medidas acertó (JSON) |

La carga automática del ejemplo al abrir la app no genera entradas en el historial.

## 7. API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/estadistica/analizar` | Calcula tabla y medidas |
| GET | `/api/registros` | Lista de registros |
| POST | `/api/registros` | Guarda un análisis con sus datos |
| GET | `/api/registros/:id` | Registro completo |
| DELETE | `/api/registros/:id` | Elimina un registro |
| POST | `/api/registros/comparar` | Comparación redactada de dos registros `{ a, b }` (Gemini o modo local) |
| GET | `/api/historial?limite=100` | Historial de operaciones |
| POST | `/api/practicas` | Guarda un intento `{ n, detalle }` y devuelve el progreso |
| GET | `/api/practicas/progreso` | Ejercicios, % de aciertos por medida y racha |
| DELETE | `/api/practicas` | Reinicia el progreso |
| GET | `/api/salud` | Estado del servidor, IA y MySQL |

Si MySQL no está configurado, las rutas de registros responden `503` con un mensaje claro.

## 8. Solución de problemas

- **`ER_NOT_SUPPORTED_AUTH_MODE` o error de autenticación:** revisa usuario y clave en `.env`. En MySQL 8.0 crea el usuario con `mysql_native_password` o actualiza mysql2.
- **`Incorrect column type` o error con `DEFAULT CURRENT_TIMESTAMP`:** el esquema ya usa `TIMESTAMP`, que es compatible con 5.7. Si modificaste las tablas, vuelve a usar `esquema.sql`.
- **La comparación dice "modo local":** la clave de Gemini falta o es inválida, o Google estaba saturado (se reintenta una vez); el aviso amarillo indica el motivo. Vuelve a ejecutar `npm run configurar` para verificar la clave.
- **`⚠ No existe backend/.env` al arrancar:** ejecuta `npm run configurar`.
- **Puerto 3001 ocupado:** cambia `PORT` en `.env`.

## 9. Publicar en internet

El backend también entrega la página compilada, así que basta **un solo servicio** con Node.js más una base MySQL.
Ejemplo con [Railway](https://railway.com) (otros servicios como Render funcionan igual):

1. Sube el proyecto a un repositorio de GitHub (el archivo `backend/.env` **no** se sube: está en `.gitignore`).
2. En Railway: **New Project → Deploy from GitHub repo** y elige el repositorio.
3. En el mismo proyecto: **+ New → Database → MySQL**.
4. En el servicio de la app, pestaña **Variables**, agrega:

   | Variable | Valor |
   |---|---|
   | `MYSQL_URL` | la referencia `${{MySQL.MYSQL_URL}}` que ofrece Railway |
   | `GEMINI_API_KEY` | tu clave de Gemini |
   | `GEMINI_MODEL` | el modelo que usas en local (ver `backend/.env`) |

5. Railway ejecuta `npm run build` (instala dependencias y compila el frontend) y luego `npm start`.
   El puerto lo asigna el servicio con la variable `PORT`.
6. En **Settings → Networking → Generate Domain** obtienes la dirección pública.

Las tablas de MySQL se crean solas al arrancar. Para probarlo en tu computadora igual que en producción:

```bash
npm run build   # compila el frontend en frontend/dist
npm start       # la app completa en http://localhost:3001
```
