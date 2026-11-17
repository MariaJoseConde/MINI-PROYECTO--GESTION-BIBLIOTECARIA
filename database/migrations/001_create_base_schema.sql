-- Migración 001: Esquema Base Bibliotecario y RBAC
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id_migration` INT AUTO_INCREMENT PRIMARY KEY,
  `version` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `autores` (
  `id_autor` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(255) NOT NULL,
  `nacionalidad` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categorias` (
  `id_categoria` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(150) NOT NULL UNIQUE,
  `codigo_archivo` VARCHAR(50) NOT NULL DEFAULT '000',
  `descripcion` TEXT NOT NULL,
  `ubicacion_sala` VARCHAR(150) NOT NULL DEFAULT 'Sala General',
  `publico_recomendado` VARCHAR(150) NOT NULL DEFAULT 'Público general',
  `enfoque_lector` VARCHAR(255) NOT NULL DEFAULT 'Lectura integral',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `salas` (
  `id_sala` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `descripcion` TEXT NULL,
  `capacidad` INT NOT NULL DEFAULT 30,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `libros` (
  `id_libro` INT AUTO_INCREMENT PRIMARY KEY,
  `isbn` VARCHAR(30) NOT NULL UNIQUE,
  `titulo` VARCHAR(255) NOT NULL,
  `sinopsis` TEXT NULL,
  `categoria` VARCHAR(150) NOT NULL DEFAULT 'Literatura General',
  `anio_publicacion` INT NULL,
  `editorial` VARCHAR(255) NULL,
  `idioma` VARCHAR(100) NOT NULL DEFAULT 'Español',
  `paginas` INT NULL,
  `ubicacion_estante` VARCHAR(150) NULL,
  `temas_clave` TEXT NULL,
  `copias_totales` INT NOT NULL DEFAULT 1,
  `copias_disp` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `chk_stock_valido` CHECK (`copias_disp` >= 0 AND `copias_disp` <= `copias_totales` AND `copias_totales` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `libro_autor` (
  `id_libro` INT NOT NULL,
  `id_autor` INT NOT NULL,
  PRIMARY KEY (`id_libro`, `id_autor`),
  CONSTRAINT `fk_la_libro` FOREIGN KEY (`id_libro`) REFERENCES `libros` (`id_libro`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_la_autor` FOREIGN KEY (`id_autor`) REFERENCES `autores` (`id_autor`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` INT AUTO_INCREMENT PRIMARY KEY,
  `numero_documento` VARCHAR(50) NOT NULL UNIQUE,
  `nombre_completo` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('ADMIN', 'DOCENTE', 'LECTOR') NOT NULL DEFAULT 'LECTOR',
  `estado` ENUM('ACTIVO', 'SANCIONADO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prestamos` (
  `id_prestamo` INT AUTO_INCREMENT PRIMARY KEY,
  `id_libro` INT NOT NULL,
  `id_usuario` INT NOT NULL,
  `fecha_prestamo` DATE NOT NULL,
  `fecha_limite` DATE NOT NULL,
  `fecha_entrega` DATE NULL,
  `estado` ENUM('ACTIVO', 'DEVUELTO', 'MORA') NOT NULL DEFAULT 'ACTIVO',
  `multa_calculada` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_prestamo_libro` FOREIGN KEY (`id_libro`) REFERENCES `libros` (`id_libro`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_prestamo_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pruebas_lectura` (
  `id_prueba` INT AUTO_INCREMENT PRIMARY KEY,
  `id_libro` INT NOT NULL,
  `id_docente` INT NOT NULL,
  `contenido_json` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_prueba_libro` FOREIGN KEY (`id_libro`) REFERENCES `libros` (`id_libro`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_prueba_docente` FOREIGN KEY (`id_docente`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `logs_sistema` (
  `id_log` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_evento` VARCHAR(100) NOT NULL,
  `mensaje` TEXT NOT NULL,
  `id_usuario` INT NULL,
  `ip_origen` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
