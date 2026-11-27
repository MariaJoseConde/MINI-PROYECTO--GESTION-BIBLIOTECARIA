-- Migración 004: Sistema de Reservas de Libros y Renovación de Préstamos

CREATE TABLE IF NOT EXISTS `reservas` (
  `id_reserva` INT AUTO_INCREMENT PRIMARY KEY,
  `id_libro` INT NOT NULL,
  `id_usuario` INT NOT NULL,
  `fecha_reserva` DATE NOT NULL,
  `fecha_expiracion` DATE NOT NULL,
  `estado` ENUM('PENDIENTE', 'DISPONIBLE', 'COMPLETADA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_reserva_libro` FOREIGN KEY (`id_libro`) REFERENCES `libros` (`id_libro`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_reserva_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_reservas_usuario_estado` (`id_usuario`, `estado`),
  INDEX `idx_reservas_libro_estado` (`id_libro`, `estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
