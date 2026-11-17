-- =====================================================================
-- SGBI - Sistema de Gestión de Biblioteca Integral
-- Script SQL Idempotente de Esquema y Datos Iniciales (MySQL / MariaDB)
-- Motor: InnoDB | Codificación: utf8mb4_unicode_ci
-- =====================================================================

-- 1. Creación de la Base de Datos
CREATE DATABASE IF NOT EXISTS `sgbi`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `sgbi`;

-- ---------------------------------------------------------------------
-- 2. Tabla de Control de Migraciones
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id_migration` INT AUTO_INCREMENT PRIMARY KEY,
  `version` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. Tabla: autores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `autores` (
  `id_autor` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(255) NOT NULL,
  `nacionalidad` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_autores_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. Tabla: categorias
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categorias` (
  `id_categoria` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(150) NOT NULL UNIQUE,
  `codigo_archivo` VARCHAR(50) NOT NULL DEFAULT '000',
  `descripcion` TEXT NOT NULL,
  `ubicacion_sala` VARCHAR(150) NOT NULL DEFAULT 'Sala General',
  `publico_recomendado` VARCHAR(150) NOT NULL DEFAULT 'Público general',
  `enfoque_lector` VARCHAR(255) NOT NULL DEFAULT 'Lectura integral',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_categorias_codigo` (`codigo_archivo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. Tabla: salas (Ubicaciones y áreas físicas de lectura)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `salas` (
  `id_sala` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL UNIQUE,
  `descripcion` TEXT NULL,
  `capacidad` INT NOT NULL DEFAULT 30,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. Tabla: libros
-- ---------------------------------------------------------------------
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
  CONSTRAINT `chk_stock_valido` CHECK (`copias_disp` >= 0 AND `copias_disp` <= `copias_totales` AND `copias_totales` >= 1),
  INDEX `idx_libros_categoria` (`categoria`),
  INDEX `idx_libros_titulo` (`titulo`),
  INDEX `idx_libros_editorial` (`editorial`),
  FULLTEXT INDEX `ft_libros_busqueda` (`titulo`, `sinopsis`, `temas_clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. Tabla Intermedia: libro_autor
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `libro_autor` (
  `id_libro` INT NOT NULL,
  `id_autor` INT NOT NULL,
  PRIMARY KEY (`id_libro`, `id_autor`),
  CONSTRAINT `fk_la_libro` FOREIGN KEY (`id_libro`) REFERENCES `libros` (`id_libro`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_la_autor` FOREIGN KEY (`id_autor`) REFERENCES `autores` (`id_autor`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_la_autor` (`id_autor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. Tabla: usuarios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` INT AUTO_INCREMENT PRIMARY KEY,
  `numero_documento` VARCHAR(50) NOT NULL UNIQUE,
  `nombre_completo` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('ADMIN', 'DOCENTE', 'LECTOR') NOT NULL DEFAULT 'LECTOR',
  `estado` ENUM('ACTIVO', 'SANCIONADO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_usuarios_email` (`email`),
  INDEX `idx_usuarios_documento` (`numero_documento`),
  INDEX `idx_usuarios_rol` (`rol`),
  INDEX `idx_usuarios_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. Tabla: prestamos
-- ---------------------------------------------------------------------
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
  CONSTRAINT `fk_prestamo_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_prestamos_usuario_estado` (`id_usuario`, `estado`),
  INDEX `idx_prestamos_libro` (`id_libro`),
  INDEX `idx_prestamos_estado` (`estado`),
  INDEX `idx_prestamos_fecha_limite` (`fecha_limite`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. Tabla: pruebas_lectura
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pruebas_lectura` (
  `id_prueba` INT AUTO_INCREMENT PRIMARY KEY,
  `id_libro` INT NOT NULL,
  `id_docente` INT NOT NULL,
  `contenido_json` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_prueba_libro` FOREIGN KEY (`id_libro`) REFERENCES `libros` (`id_libro`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_prueba_docente` FOREIGN KEY (`id_docente`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_pruebas_libro` (`id_libro`),
  INDEX `idx_pruebas_docente` (`id_docente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11. Tabla: logs_sistema
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `logs_sistema` (
  `id_log` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo_evento` VARCHAR(100) NOT NULL,
  `mensaje` TEXT NOT NULL,
  `id_usuario` INT NULL,
  `ip_origen` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_logs_created_at` (`created_at`),
  INDEX `idx_logs_evento` (`tipo_evento`),
  INDEX `idx_logs_usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 12. DATOS DE PRUEBA INICIALES (Idempotentes)
-- =====================================================================

-- Registro de versiones de migración
INSERT INTO `schema_migrations` (`version`, `description`)
VALUES
  ('v1.0.0', 'Esquema base bibliotecario, RBAC, préstamos y tablas iniciales'),
  ('v1.1.0', 'Metadatos enriquecidos de catálogo y dosieres de categorías'),
  ('v1.2.0', 'Índices de rendimiento B-tree y Fulltext'),
  ('v1.3.0-mysql', 'Migración integral a motor MySQL / MariaDB con integridad referencial completa')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- Salas físicas
INSERT INTO `salas` (`nombre`, `descripcion`, `capacidad`)
VALUES
  ('Sala General', 'Área principal de lectura y préstamo general', 50),
  ('Sala A · Pasillo 1', 'Colección de literatura, distopía y política', 25),
  ('Sala B · Humanidades', 'Fondo de realismo mágico, cuento y filosofía', 30),
  ('Sala C · Ciencias Exactas', 'Divulgación científica y textos STEM', 20),
  ('Sala D · Ciencias Sociales', 'Historia, antropología y teoría política', 25),
  ('Sala Central · Estantería Noble', 'Clásicos universales y libros de referencia', 40)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`);

-- Categorías
INSERT INTO `categorias` (`nombre`, `codigo_archivo`, `descripcion`, `ubicacion_sala`, `publico_recomendado`, `enfoque_lector`)
VALUES
  ('Distopía y Política', '823.91', 'Ficción especulativa sobre vigilancia masiva, control estatal y resistencia cívica.', 'Sala A · Pasillo 1', 'Bachillerato, Pregrado y Debate', 'Análisis crítico del poder y libertades'),
  ('Realismo Mágico', '863.44', 'Narrativa iberoamericana donde lo prodigioso y la memoria histórica conviven.', 'Sala B · Pasillo 2', 'Lectores generales y Humanidades', 'Comprensión simbólica y genealogía'),
  ('Ciencia Ficción', '813.54', 'Relatos sobre futuros tecnológicos, preservación del saber y ética digital.', 'Sala A · Pasillo 3', 'Jóvenes y literatura contemporánea', 'Prospectiva tecnológica y ética'),
  ('Clásicos Universales', '808.83', 'Obras fundacionales de la literatura sobre la condición humana y la moral.', 'Sala Central · Estantería Noble', 'Toda la comunidad académica', 'Lectura comparada e historia'),
  ('Cuento y Filosofía', '863.01', 'Ficción breve, laberintos, espejos y paradojas del conocimiento.', 'Sala B · Pasillo 4', 'Pregrado y Filosofía', 'Lectura analítica de paradojas'),
  ('Divulgación Científica', '520.9', 'Textos sobre astronomía, química, evolución cósmica y método empírico.', 'Sala C · Ciencias Exactas', 'Estudiantes STEM y general', 'Pensamiento científico y empírico'),
  ('Historia y Filosofía Política', '320.53', 'Estudios sobre democracia, instituciones republicanas y derechos ciudadanos.', 'Sala D · Ciencias Sociales', 'Ciencias Políticas y Derecho', 'Investigación documental y cívica'),
  ('Historia y Antropología', '909.04', 'Síntesis interdisciplinarias sobre la evolución social desde la prehistoria.', 'Sala D · Ciencias Sociales', 'Antropología e Historia', 'Visión macrohistórica'),
  ('Narrativa Latinoamericana', '863.6', 'Novelas del boom latinoamericano y vanguardia experimental.', 'Sala B · Pasillo 1', 'Estudios Literarios y Avanzados', 'Lectura no lineal'),
  ('Poesía y Ensayo', '861.3', 'Lírica barroca, sonetos y prosa intelectual de alto valor formativo.', 'Sala B · Fondo Antiguo', 'Investigadores y Docentes', 'Estilística y retórica clásica'),
  ('Literatura General', '800.1', 'Acervo multidisciplinario de libre consulta y préstamo domiciliario estándar.', 'Sala General · Nivel 1', 'Público general', 'Lectura recreativa y formativa')
ON DUPLICATE KEY UPDATE
  `codigo_archivo` = VALUES(`codigo_archivo`),
  `descripcion` = VALUES(`descripcion`),
  `ubicacion_sala` = VALUES(`ubicacion_sala`),
  `publico_recomendado` = VALUES(`publico_recomendado`),
  `enfoque_lector` = VALUES(`enfoque_lector`);

-- Autores
INSERT INTO `autores` (`id_autor`, `nombre`, `nacionalidad`)
VALUES
  (1, 'Gabriel García Márquez', 'Colombiana'),
  (2, 'George Orwell', 'Británica'),
  (3, 'Mary Shelley', 'Británica'),
  (4, 'Jorge Luis Borges', 'Argentina'),
  (5, 'Ray Bradbury', 'Estadounidense'),
  (6, 'Carl Sagan', 'Estadounidense'),
  (7, 'Hannah Arendt', 'Alemana'),
  (8, 'Yuval Noah Harari', 'Israelí'),
  (9, 'Sor Juana Inés de la Cruz', 'Mexicana'),
  (10, 'Julio Cortázar', 'Argentina')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `nacionalidad` = VALUES(`nacionalidad`);

-- Libros
INSERT INTO `libros` (`id_libro`, `isbn`, `titulo`, `sinopsis`, `categoria`, `anio_publicacion`, `editorial`, `idioma`, `paginas`, `ubicacion_estante`, `temas_clave`, `copias_totales`, `copias_disp`)
VALUES
  (1, '978-0-452-28423-4', '1984', 'En un Londres sombrío bajo el régimen totalitario del Gran Hermano, Winston Smith trabaja reescribiendo archivos en el Ministerio de la Verdad para ajustar el pasado a las consignas del Partido.', 'Distopía y Política', 1949, 'Debolsillo · Edición Anotada', 'Español (Traducción)', 352, 'Sala A · Estante 01 · Nivel 2', 'Vigilancia estatal, Neolengua, Totalitarismo, Memoria histórica', 4, 3),
  (2, '978-84-376-0494-7', 'Cien años de soledad', 'Crónica de siete generaciones de la familia Buendía en el mítico pueblo de Macondo, entre guerras civiles, lluvias interminables y amores condenados al olvido.', 'Realismo Mágico', 1967, 'Cátedra · Letras Hispánicas', 'Español (Original)', 496, 'Sala B · Estante 05 · Nivel 1', 'Macondo, Genealogía Buendía, Soledad, Memoria cíclica', 5, 4),
  (3, '978-84-9759-425-7', 'Fahrenheit 451', 'En una sociedad dominada por el consumo y pantallas interactivas, los bomberos queman libros hasta que Guy Montag descubre el valor subversivo de la lectura.', 'Ciencia Ficción', 1953, 'Minotauro · Biblioteca Bradbury', 'Español (Traducción)', 224, 'Sala A · Estante 07 · Nivel 1', 'Censura literaria, Cultura audiovisual, Pensamiento crítico', 3, 1),
  (4, '978-0-14-143947-1', 'Frankenstein o el moderno Prometeo', 'Victor Frankenstein desafía las leyes naturales creando vida artificial, desatando una profunda reflexión sobre la ética científica y la soledad moral.', 'Clásicos Universales', 1818, 'Alianza Editorial · Clásicos', 'Español (Traducción)', 288, 'Sala Central · Estante 02 · Nivel 2', 'Ética científica, Prometeo moderno, Otredad, Responsabilidad moral', 2, 2),
  (5, '978-84-206-3312-1', 'Ficciones', 'Colección magistral de relatos filosóficos que exploran laberintos infinitos, bibliotecas de Babel, espejos y los límites del conocimiento humano.', 'Cuento y Filosofía', 1944, 'Alianza Editorial · Biblioteca Borges', 'Español (Original)', 216, 'Sala B · Estante 09 · Nivel 1', 'Laberintos, Biblioteca de Babel, Tiempo circular, Metafísica', 3, 3),
  (6, '978-84-08-05469-6', 'Cosmos', 'Recorrido divulgativo por la evolución de las galaxias, la ciencia y la Biblioteca de Alejandría, defendiendo la curiosidad humana y el escepticismo empírico.', 'Divulgación Científica', 1980, 'Planeta · Divulgación Científica', 'Español (Traducción)', 384, 'Sala C · Estante 03 · Nivel 2', 'Astrofísica, Biblioteca de Alejandría, Evolución cósmica, Escepticismo', 3, 2),
  (7, '978-84-264-1849-4', 'Los orígenes del totalitarismo', 'Análisis imprescindible de Hannah Arendt sobre el antisemitismo, el imperialismo y la destrucción de las libertades civiles en los regímenes totalitarios.', 'Historia y Filosofía Política', 1951, 'Taurus · Pensamiento Político', 'Español (Traducción)', 640, 'Sala D · Estante 04 · Nivel 3', 'Instituciones democráticas, Propaganda, Masas, Derechos humanos', 2, 0),
  (8, '978-84-9992-622-3', 'Sapiens: De animales a dioses', 'Historia de la humanidad desde los primeros cazadores recolectores hasta la revolución biotecnológica moderna y las ficciones comunitarias.', 'Historia y Antropología', 2011, 'Debate · Historia Universal', 'Español (Traducción)', 492, 'Sala D · Estante 01 · Nivel 1', 'Revolución cognitiva, Agricultura, Ficciones compartidas, Ciencia', 4, 4),
  (9, '978-84-376-2481-5', 'Rayuela', 'Novela experimental con tablero de dirección que desafía la cronología tradicional y acompaña la búsqueda existencial de Horacio Oliveira.', 'Narrativa Latinoamericana', 1963, 'Alfaguara · Edición Conmemorativa', 'Español (Original)', 688, 'Sala B · Estante 02 · Nivel 2', 'Tablero de dirección, París y Buenos Aires, Vanguardia narrativa', 2, 2),
  (10, '978-968-16-6122-9', 'Obras selectas de Sor Juana', 'Compilación de poesía lírica, redondillas y prosa filosófica de la máxima exponente del barroco hispanoamericano.', 'Poesía y Ensayo', 1689, 'Fondo de Cultura Económica', 'Español (Original)', 310, 'Sala B · Fondo Antiguo · Vitrina 1', 'Barroco novohispano, Sonetos, Redondillas, Defensa intelectual', 2, 2)
ON DUPLICATE KEY UPDATE
  `titulo` = VALUES(`titulo`),
  `sinopsis` = VALUES(`sinopsis`),
  `categoria` = VALUES(`categoria`),
  `anio_publicacion` = VALUES(`anio_publicacion`),
  `editorial` = VALUES(`editorial`),
  `idioma` = VALUES(`idioma`),
  `paginas` = VALUES(`paginas`),
  `ubicacion_estante` = VALUES(`ubicacion_estante`),
  `temas_clave` = VALUES(`temas_clave`),
  `copias_totales` = VALUES(`copias_totales`),
  `copias_disp` = VALUES(`copias_disp`);

-- Relación libro_autor
INSERT IGNORE INTO `libro_autor` (`id_libro`, `id_autor`) VALUES
  (1, 2),  -- 1984 -> George Orwell
  (2, 1),  -- Cien años de soledad -> Gabriel García Márquez
  (3, 5),  -- Fahrenheit 451 -> Ray Bradbury
  (4, 3),  -- Frankenstein -> Mary Shelley
  (5, 4),  -- Ficciones -> Jorge Luis Borges
  (6, 6),  -- Cosmos -> Carl Sagan
  (7, 7),  -- Los origenes del totalitarismo -> Hannah Arendt
  (8, 8),  -- Sapiens -> Yuval Noah Harari
  (9, 10), -- Rayuela -> Julio Cortázar
  (10, 9); -- Obras selectas -> Sor Juana Inés de la Cruz

-- Usuarios de Prueba (Contraseña por defecto: 'sgbi2026')
INSERT INTO `usuarios` (`id_usuario`, `numero_documento`, `nombre_completo`, `email`, `password_hash`, `rol`, `estado`)
VALUES
  (1, '10101010', 'Clara Mendoza Vargas', 'admin@sgbi.edu', '$2y$10$lKACUlYa9WEj4e8J8wrhLuZgnHn04UDoBGId8.N3mfgSXaA6l3wKe', 'ADMIN', 'ACTIVO'),
  (2, '20202020', 'Prof. Julián Restrepo Gil', 'docente@sgbi.edu', '$2y$10$lKACUlYa9WEj4e8J8wrhLuZgnHn04UDoBGId8.N3mfgSXaA6l3wKe', 'DOCENTE', 'ACTIVO'),
  (3, '30303030', 'Sofía Morales Pardo', 'lector@sgbi.edu', '$2y$10$lKACUlYa9WEj4e8J8wrhLuZgnHn04UDoBGId8.N3mfgSXaA6l3wKe', 'LECTOR', 'ACTIVO'),
  (4, '40404040', 'Mateo Castaño Ruiz', 'mateo.mora@sgbi.edu', '$2y$10$lKACUlYa9WEj4e8J8wrhLuZgnHn04UDoBGId8.N3mfgSXaA6l3wKe', 'LECTOR', 'SANCIONADO')
ON DUPLICATE KEY UPDATE
  `nombre_completo` = VALUES(`nombre_completo`),
  `email` = VALUES(`email`),
  `password_hash` = VALUES(`password_hash`),
  `rol` = VALUES(`rol`),
  `estado` = VALUES(`estado`);

-- Préstamos de Prueba
INSERT INTO `prestamos` (`id_prestamo`, `id_libro`, `id_usuario`, `fecha_prestamo`, `fecha_limite`, `fecha_entrega`, `estado`, `multa_calculada`)
VALUES
  (1, 1, 3, '2026-11-09', '2026-11-19', NULL, 'ACTIVO', 0.00),
  (2, 2, 2, '2026-11-10', '2026-11-20', NULL, 'ACTIVO', 0.00),
  (3, 3, 4, '2026-10-15', '2026-10-27', NULL, 'MORA', 5.00),
  (4, 3, 3, '2026-11-11', '2026-11-23', NULL, 'ACTIVO', 0.00),
  (5, 6, 2, '2026-11-12', '2026-11-24', NULL, 'ACTIVO', 0.00),
  (6, 7, 4, '2026-10-10', '2026-10-22', NULL, 'MORA', 8.50),
  (7, 7, 2, '2026-11-06', '2026-11-18', NULL, 'ACTIVO', 0.00),
  (8, 4, 3, '2026-10-01', '2026-10-13', '2026-10-11', 'DEVUELTO', 0.00)
ON DUPLICATE KEY UPDATE
  `estado` = VALUES(`estado`),
  `fecha_entrega` = VALUES(`fecha_entrega`),
  `multa_calculada` = VALUES(`multa_calculada`);

-- Prueba de Lectura de Ejemplo
INSERT INTO `pruebas_lectura` (`id_prueba`, `id_libro`, `id_docente`, `contenido_json`)
VALUES
  (1, 1, 2, '{"libro_id":1,"titulo_libro":"1984","evaluacion":[{"pregunta":"¿Cuál es la función principal de Winston Smith dentro del Ministerio de la Verdad?","opciones":{"A":"Vigilar telepantallas","B":"Modificar registros históricos para alinear el pasado con la consigna del Partido","C":"Redactar el diccionario oficial de la neolengua","D":"Dirigir interrogatorios de la Policía del Pensamiento"},"respuesta_correcta":"B","justificacion":"Winston reescribe la historia en el Ministerio de la Verdad, ilustrando el control del Partido sobre la memoria colectiva."}]}')
ON DUPLICATE KEY UPDATE `contenido_json` = VALUES(`contenido_json`);

-- Log de Auditoría Inicial
INSERT INTO `logs_sistema` (`tipo_evento`, `mensaje`, `id_usuario`, `ip_origen`)
VALUES
  ('SISTEMA_INICIALIZADO', 'Base de datos MySQL sgbi desplegada con éxito, tablas creadas y datos semilla cargados.', 1, '127.0.0.1')
ON DUPLICATE KEY UPDATE `mensaje` = VALUES(`mensaje`);
