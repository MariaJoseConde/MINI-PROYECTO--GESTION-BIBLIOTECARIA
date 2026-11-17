-- Migración 002: Índices de Búsqueda y Optimización de Rendimiento
-- Autores
ALTER TABLE `autores` ADD INDEX IF NOT EXISTS `idx_autores_nombre` (`nombre`);

-- Categorías
ALTER TABLE `categorias` ADD INDEX IF NOT EXISTS `idx_categorias_codigo` (`codigo_archivo`);

-- Libros
ALTER TABLE `libros` ADD INDEX IF NOT EXISTS `idx_libros_categoria` (`categoria`);
ALTER TABLE `libros` ADD INDEX IF NOT EXISTS `idx_libros_titulo` (`titulo`);
ALTER TABLE `libros` ADD INDEX IF NOT EXISTS `idx_libros_editorial` (`editorial`);
ALTER TABLE `libros` ADD FULLTEXT INDEX IF NOT EXISTS `ft_libros_busqueda` (`titulo`, `sinopsis`, `temas_clave`);

-- Libro Autor
ALTER TABLE `libro_autor` ADD INDEX IF NOT EXISTS `idx_la_autor` (`id_autor`);

-- Usuarios
ALTER TABLE `usuarios` ADD INDEX IF NOT EXISTS `idx_usuarios_email` (`email`);
ALTER TABLE `usuarios` ADD INDEX IF NOT EXISTS `idx_usuarios_documento` (`numero_documento`);
ALTER TABLE `usuarios` ADD INDEX IF NOT EXISTS `idx_usuarios_rol` (`rol`);
ALTER TABLE `usuarios` ADD INDEX IF NOT EXISTS `idx_usuarios_estado` (`estado`);

-- Préstamos
ALTER TABLE `prestamos` ADD INDEX IF NOT EXISTS `idx_prestamos_usuario_estado` (`id_usuario`, `estado`);
ALTER TABLE `prestamos` ADD INDEX IF NOT EXISTS `idx_prestamos_libro` (`id_libro`);
ALTER TABLE `prestamos` ADD INDEX IF NOT EXISTS `idx_prestamos_estado` (`estado`);
ALTER TABLE `prestamos` ADD INDEX IF NOT EXISTS `idx_prestamos_fecha_limite` (`fecha_limite`);

-- Pruebas de lectura
ALTER TABLE `pruebas_lectura` ADD INDEX IF NOT EXISTS `idx_pruebas_libro` (`id_libro`);
ALTER TABLE `pruebas_lectura` ADD INDEX IF NOT EXISTS `idx_pruebas_docente` (`id_docente`);

-- Logs del sistema
ALTER TABLE `logs_sistema` ADD INDEX IF NOT EXISTS `idx_logs_created_at` (`created_at`);
ALTER TABLE `logs_sistema` ADD INDEX IF NOT EXISTS `idx_logs_evento` (`tipo_evento`);
ALTER TABLE `logs_sistema` ADD INDEX IF NOT EXISTS `idx_logs_usuario` (`id_usuario`);
