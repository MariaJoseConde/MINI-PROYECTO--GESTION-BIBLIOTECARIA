<?php
/**
 * SGBI - Enrutador Front-Controller para API REST y Servidor Web en PHP 8.2+
 */

// Simple PSR-4 Autoloader for Sgbi namespace
spl_autoload_register(function ($class) {
    $prefix = 'Sgbi\\';
    $baseDir = __DIR__ . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

use Sgbi\Config\Response;
use Sgbi\Controllers\AuthController;
use Sgbi\Controllers\CatalogoController;
use Sgbi\Controllers\CirculacionController;
use Sgbi\Controllers\AdminController;
use Sgbi\Controllers\IaController;
use Sgbi\Controllers\HealthController;

// Handle CORS
Response::initCors();

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$rootPath = dirname(__DIR__);
$distPath = $rootPath . '/dist';

// 1. Router for /api/* endpoints (Pure PHP Controllers)
if (str_starts_with($uri, '/api/')) {
    $path = substr($uri, 4); // Remove '/api'

    // Health
    if ($path === '/health' && $method === 'GET') {
        (new HealthController())->check();
    }

    // Auth
    if ($path === '/auth/login' && $method === 'POST') {
        (new AuthController())->login();
    }
    if ($path === '/auth/me' && $method === 'GET') {
        (new AuthController())->me();
    }
    if ($path === '/auth/logout' && $method === 'POST') {
        (new AuthController())->logout();
    }

    // Libros
    if ($path === '/libros/exportar/csv' && $method === 'GET') {
        (new CatalogoController())->exportCsv();
    }
    if ($path === '/libros' && $method === 'GET') {
        (new CatalogoController())->listLibros();
    }
    if ($path === '/libros' && $method === 'POST') {
        (new CatalogoController())->createLibro();
    }
    if (preg_match('#^/libros/(\d+)$#', $path, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET') (new CatalogoController())->getLibro($id);
        if ($method === 'PUT') (new CatalogoController())->updateLibro($id);
        if ($method === 'DELETE') (new CatalogoController())->deleteLibro($id);
    }

    // Categorias
    if ($path === '/categorias' && $method === 'GET') {
        (new CatalogoController())->listCategorias();
    }
    if ($path === '/categorias' && $method === 'POST') {
        (new CatalogoController())->createCategoria();
    }

    // Autores
    if ($path === '/autores' && $method === 'GET') {
        (new CatalogoController())->listAutores();
    }
    if ($path === '/autores' && $method === 'POST') {
        (new CatalogoController())->createAutor();
    }

    // Circulacion (Prestamos)
    if ($path === '/prestamos/calcular-fecha' && $method === 'GET') {
        (new CirculacionController())->calcularFecha();
    }
    if ($path === '/prestamos' && $method === 'GET') {
        (new CirculacionController())->listPrestamos();
    }
    if ($path === '/prestamos' && $method === 'POST') {
        (new CirculacionController())->createPrestamo();
    }
    if (preg_match('#^/prestamos/(\d+)/devolver$#', $path, $m) && $method === 'POST') {
        (new CirculacionController())->devolverPrestamo((int)$m[1]);
    }

    // IA y Evaluaciones
    if ($path === '/ia/buscar' && $method === 'POST') {
        (new IaController())->buscar();
    }
    if ($path === '/ia/generar-prueba' && $method === 'POST') {
        (new IaController())->generarPrueba();
    }
    if ($path === '/pruebas' && $method === 'GET') {
        (new IaController())->listPruebas();
    }

    // Admin
    if ($path === '/admin/usuarios' && $method === 'GET') {
        (new AdminController())->listUsuarios();
    }
    if ($path === '/admin/usuarios' && $method === 'POST') {
        (new AdminController())->createUsuario();
    }
    if (preg_match('#^/admin/usuarios/(\d+)$#', $path, $m) && $method === 'PUT') {
        (new AdminController())->updateUsuario((int)$m[1]);
    }
    if ($path === '/admin/auditoria/test-fallback' && $method === 'POST') {
        (new AdminController())->testFallback();
    }
    if ($path === '/admin/auditoria' && $method === 'GET') {
        (new AdminController())->listAuditoria();
    }
    if ($path === '/admin/metricas' && $method === 'GET') {
        (new AdminController())->getMetricas();
    }
    if ($path === '/admin/respaldo' && $method === 'GET') {
        (new AdminController())->descargarRespaldo();
    }

    // 404 for unmatched API routes
    Response::error("Recurso API no encontrado: {$method} {$uri}", 404);
}

// 2. Serve static assets from dist/
$targetFile = $distPath . $uri;
if ($uri !== '/' && file_exists($targetFile) && !is_dir($targetFile)) {
    $ext = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));
    $mimes = [
        'js' => 'text/javascript; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
    ];
    if (isset($mimes[$ext])) {
        header("Content-Type: {$mimes[$ext]}");
    }
    header('Cache-Control: public, max-age=31536000');
    readfile($targetFile);
    exit;
}

// 3. Fallback: serve dist/index.html (or root index.html) for all SPA views
$indexFile = file_exists($distPath . '/index.html') ? $distPath . '/index.html' : $rootPath . '/index.html';
if (file_exists($indexFile)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($indexFile);
    exit;
}

Response::error('Página no encontrada.', 404);
