# estadistica-app777 · Distribución de frecuencias + Tutor de IA (Gemini) + MySQL 5.7

Aplicación para datos agrupados (tabla de frecuencias, medidas de tendencia central, dispersión y posición).
Incluye un tutor de IA con **Google Gemini**, un **registro de análisis con sus datos** y un **historial de operaciones**, ambos guardados en **MySQL 5.7**.

- **Backend:** Node.js 20.19+ + Express + mysql2
- **Frontend:** React + Vite + CSS puro (`frontend/src/estilos/`, tema claro y oscuro)

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
│   │   │   └── historial.repo.js       ← historial de operaciones (MySQL)
│   │   ├── controllers/                ← estadística, registro, historial
│   │   ├── services/
│   │   │   ├── estadistica.service.js  ← motor estadístico
│   │   │   ├── ia.service.js           ← tutor (Gemini)
│   │   │   └── historial.service.js
│   │   └── routes/ · utils/ · data/
│   └── tests/estadistica.test.js
└── frontend/
    └── src/ (App.jsx, components/: TablaFrecuencias, PanelMedidas, Histograma,
              TutorIA, RegistroPanel, HistorialPanel, …)
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

Crea la base `estadistica` y las tablas `registros_analisis` e `historial_operaciones`.
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
   Si la dejas vacía, el tutor funciona en *modo local* (sin IA externa).
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
| `historial_operaciones` | Cada acción: `ANALISIS`, `INTERPRETACION`, `GUARDAR_REGISTRO`, `ELIMINAR_REGISTRO` |

La carga automática del ejemplo al abrir la app no genera entradas en el historial.

## 7. API

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/estadistica/analizar` | Calcula tabla y medidas |
| POST | `/api/estadistica/interpretar` | Interpretación con Gemini (o modo local si falla) |
| GET | `/api/registros` | Lista de registros |
| POST | `/api/registros` | Guarda un análisis con sus datos |
| GET | `/api/registros/:id` | Registro completo |
| DELETE | `/api/registros/:id` | Elimina un registro |
| GET | `/api/historial?limite=100` | Historial de operaciones |
| GET | `/api/salud` | Estado del servidor, IA y MySQL |

Si MySQL no está configurado, las rutas de registros responden `503` con un mensaje claro.

## 8. Solución de problemas

- **`ER_NOT_SUPPORTED_AUTH_MODE` o error de autenticación:** revisa usuario y clave en `.env`. En MySQL 8.0 crea el usuario con `mysql_native_password` o actualiza mysql2.
- **`Incorrect column type` o error con `DEFAULT CURRENT_TIMESTAMP`:** el esquema ya usa `TIMESTAMP`, que es compatible con 5.7. Si modificaste las tablas, vuelve a usar `esquema.sql`.
- **El tutor muestra "respaldo local":** la clave de Gemini falta o es inválida; el aviso amarillo indica el motivo. Vuelve a ejecutar `npm run configurar` para verificarla.
- **`⚠ No existe backend/.env` al arrancar:** ejecuta `npm run configurar`.
- **Puerto 3001 ocupado:** cambia `PORT` en `.env`.
