-- Esquema para MySQL 5.7 (y 8.0). Ejecutar una vez como administrador.
-- Alternativa: dejar que el backend cree las tablas al arrancar.

CREATE DATABASE IF NOT EXISTS estadistica
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE estadistica;

CREATE TABLE IF NOT EXISTS historial_operaciones (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tipo_operacion  VARCHAR(50) NOT NULL,   -- ANALISIS, INTERPRETACION, GUARDAR_REGISTRO, ELIMINAR_REGISTRO
  detalle         TEXT,
  fecha           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registros_analisis (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  variable    VARCHAR(255) NULL,
  unidad      VARCHAR(50) NULL,
  n           INT NOT NULL,
  media       DOUBLE NULL,
  mediana     DOUBLE NULL,
  desviacion  DOUBLE NULL,
  cv          DOUBLE NULL,
  datos       LONGTEXT NOT NULL,          -- JSON con los datos ordenados
  opciones    TEXT NOT NULL,              -- JSON con modo, k, A, percentiles...
  resultado   LONGTEXT NOT NULL           -- JSON con tabla y medidas completas
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS practicas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  n           INT NOT NULL,               -- tamaño de la muestra del ejercicio
  aciertos    INT NOT NULL,
  total       INT NOT NULL,
  detalle     TEXT NOT NULL               -- JSON { media: true, varianza: false, ... }
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
