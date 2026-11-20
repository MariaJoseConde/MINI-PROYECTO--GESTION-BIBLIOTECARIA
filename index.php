<?php
/**
 * SGBI - Sistema de Gestión Bibliotecaria Inteligente
 * Punto de entrada principal (index.php) para desarrollo local y servidores web (PHP CLI, Apache, Nginx, XAMPP).
 *
 * Ejecución local:
 *   php -S localhost:8000 index.php
 * o abrir en el navegador:
 *   http://localhost:8000
 */

declare(strict_types=1);

// Redirigir la ejecución al enrutador central de PHP
require_once __DIR__ . '/backend-php/router.php';
