<?php
/**
 * SGBI - Enrutador Front-Controller para API RESTful y Servidor Web en PHP 8.2+
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
use Sgbi\Controllers\SalasController;
use Sgbi\Controllers\DocsController;
use Sgbi\Controllers\HealthController;

// Handle CORS & Preflight OPTIONS
Response::initCors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$rootPath = dirname(__DIR__);
$distPath = $rootPath . '/dist';

// ---------------------------------------------------------------------
// 1. Router for /api/* and /api/v1/* RESTful Endpoints
// ---------------------------------------------------------------------
if (str_starts_with($uri, '/api')) {
    $path = substr($uri, 4); // Remove leading '/api'
    if (empty($path)) {
        $path = '/';
    }

    // Normalizar versionamiento REST: /api/v1/libros -> /libros
    if (str_starts_with($path, '/v1/')) {
        $path = substr($path, 3);
    }

    // --- Documentación Interactiva Swagger / OpenAPI ---
    if (($path === '/' || $path === '/docs') && $method === 'GET') {
        (new DocsController())->renderSwaggerUi();
    }
    if ($path === '/openapi.json' && $method === 'GET') {
        (new DocsController())->getSpec();
    }

    // --- Health Check & Monitoreo MySQL ---
    if ($path === '/health' && $method === 'GET') {
        (new HealthController())->check();
    }

    // --- Autenticación y Sesiones ---
    if ($path === '/auth/login' && $method === 'POST') {
        (new AuthController())->login();
    }
    if ($path === '/auth/me' && $method === 'GET') {
        (new AuthController())->me();
    }
    if ($path === '/auth/logout' && $method === 'POST') {
        (new AuthController())->logout();
    }

    // --- Libros (Colección y Recursos Individuales) ---
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
        if ($method === 'PUT' || $method === 'PATCH') (new CatalogoController())->updateLibro($id);
        if ($method === 'DELETE') (new CatalogoController())->deleteLibro($id);
        Response::methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']);
    }

    // --- Categorías ---
    if ($path === '/categorias' && $method === 'GET') {
        (new CatalogoController())->listCategorias();
    }
    if ($path === '/categorias' && $method === 'POST') {
        (new CatalogoController())->createCategoria();
    }
    if (preg_match('#^/categorias/(\d+)$#', $path, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET') (new CatalogoController())->getCategoria($id);
        if ($method === 'PUT' || $method === 'PATCH') (new CatalogoController())->updateCategoria($id);
        if ($method === 'DELETE') (new CatalogoController())->deleteCategoria($id);
        Response::methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']);
    }

    // --- Autores ---
    if ($path === '/autores' && $method === 'GET') {
        (new CatalogoController())->listAutores();
    }
    if ($path === '/autores' && $method === 'POST') {
        (new CatalogoController())->createAutor();
    }
    if (preg_match('#^/autores/(\d+)$#', $path, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET') (new CatalogoController())->getAutor($id);
        if ($method === 'PUT' || $method === 'PATCH') (new CatalogoController())->updateAutor($id);
        if ($method === 'DELETE') (new CatalogoController())->deleteAutor($id);
        Response::methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']);
    }

    // --- Salas de Lectura ---
    if ($path === '/salas' && $method === 'GET') {
        (new SalasController())->listSalas();
    }
    if ($path === '/salas' && $method === 'POST') {
        (new SalasController())->createSala();
    }
    if (preg_match('#^/salas/(\d+)$#', $path, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET') (new SalasController())->getSala($id);
        if ($method === 'PUT' || $method === 'PATCH') (new SalasController())->updateSala($id);
        if ($method === 'DELETE') (new SalasController())->deleteSala($id);
        Response::methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']);
    }

    // --- Circulación y Préstamos ---
    if ($path === '/prestamos/calcular-fecha' && $method === 'GET') {
        (new CirculacionController())->calcularFecha();
    }
    if ($path === '/prestamos' && $method === 'GET') {
        (new CirculacionController())->listPrestamos();
    }
    if ($path === '/prestamos' && $method === 'POST') {
        (new CirculacionController())->createPrestamo();
    }
    if (preg_match('#^/prestamos/(\d+)$#', $path, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET') (new CirculacionController())->getPrestamo($id);
        Response::methodNotAllowed(['GET']);
    }
    if (preg_match('#^/prestamos/(\d+)/devolver$#', $path, $m) && $method === 'POST') {
        (new CirculacionController())->devolverPrestamo((int)$m[1]);
    }

    // --- IA y Evaluaciones de Lectura ---
    if ($path === '/ia/buscar' && $method === 'POST') {
        (new IaController())->buscar();
    }
    if ($path === '/ia/generar-prueba' && $method === 'POST') {
        (new IaController())->generarPrueba();
    }
    if ($path === '/pruebas' && $method === 'GET') {
        (new IaController())->listPruebas();
    }
    if (preg_match('#^/pruebas/(\d+)$#', $path, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET') (new IaController())->getPrueba($id);
        if ($method === 'DELETE') (new IaController())->deletePrueba($id);
        Response::methodNotAllowed(['GET', 'DELETE']);
    }

    // --- Administración y Auditoría ---
    if ($path === '/admin/usuarios' && $method === 'GET') {
        (new AdminController())->listUsuarios();
    }
    if ($path === '/admin/usuarios' && $method === 'POST') {
        (new AdminController())->createUsuario();
    }
    if (preg_match('#^/admin/usuarios/(\d+)$#', $path, $m)) {
        $id = (int)$m[1];
        if ($method === 'GET') (new AdminController())->getUsuario($id);
        if ($method === 'PUT' || $method === 'PATCH') (new AdminController())->updateUsuario($id);
        if ($method === 'DELETE') (new AdminController())->deleteUsuario($id);
        Response::methodNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE']);
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

    // 404 para rutas API no coincidentes con cabecera estándar
    Response::error("Recurso API no encontrado: {$method} {$uri}", 404, 'ROUTE_NOT_FOUND');
}

// ---------------------------------------------------------------------
// 2. Servir recursos estáticos compilados desde dist/ o public/
// ---------------------------------------------------------------------
$targetFile = $distPath . $uri;
if (!file_exists($targetFile) || is_dir($targetFile)) {
    $publicCandidate = $rootPath . '/public' . $uri;
    if (file_exists($publicCandidate) && !is_dir($publicCandidate)) {
        $targetFile = $publicCandidate;
    }
}

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
        'webp' => 'image/webp',
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
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    readfile($targetFile);
    exit;
}

// ---------------------------------------------------------------------
// 3. Fallback SPA para vistas React (dist/index.html o root index.html)
// ---------------------------------------------------------------------
$indexFile = file_exists($distPath . '/index.html') ? $distPath . '/index.html' : $rootPath . '/index.html';
if (file_exists($indexFile)) {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    readfile($indexFile);
    exit;
}

Response::error('Página no encontrada.', 404, 'NOT_FOUND');
