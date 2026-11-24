<?php
/**
 * SGBI - Prueba de Endpoints HTTP Reales contra Servidor Activo (127.0.0.1:8000)
 */

declare(strict_types=1);

$port = $argv[1] ?? '8000';
$baseUrl = "http://127.0.0.1:{$port}/api";

function httpRequest(string $method, string $url, ?array $body = null, array $headers = []): array {
    $opts = [
        'http' => [
            'method' => $method,
            'header' => array_merge([
                'Content-Type: application/json',
                'Accept: application/json',
            ], $headers),
            'ignore_errors' => true,
            'timeout' => 5,
        ],
    ];

    if ($body !== null) {
        $opts['http']['content'] = json_encode($body);
    }

    $context = stream_context_create($opts);
    $response = file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    preg_match('/HTTP\/\S+\s+(\d+)/', $statusLine, $m);
    $statusCode = isset($m[1]) ? (int)$m[1] : 0;

    return [
        'status' => $statusCode,
        'body' => json_decode($response ?: '{}', true),
        'raw' => $response,
    ];
}

echo "=== PRUEBA DE ENDPOINTS HTTP RESTful EN VIVO (127.0.0.1:8000) ===\n\n";

// 1. Health check
$resHealth = httpRequest('GET', "{$baseUrl}/health");
echo "[1] GET /api/health -> Status: {$resHealth['status']}\n";
assert($resHealth['status'] === 200, "Health check falló");

// 2. OpenAPI Spec
$resOpenApi = httpRequest('GET', "{$baseUrl}/openapi.json");
echo "[2] GET /api/openapi.json -> Status: {$resOpenApi['status']} (OpenAPI v" . ($resOpenApi['body']['openapi'] ?? 'desconocida') . ")\n";
assert($resOpenApi['status'] === 200, "OpenAPI spec falló");

// 3. Catálogo de libros (Público)
$resLibros = httpRequest('GET', "{$baseUrl}/libros");
echo "[3] GET /api/libros -> Status: {$resLibros['status']} (Total libros: " . count($resLibros['body']['libros'] ?? []) . ")\n";
assert($resLibros['status'] === 200, "Listado de libros falló");

// 4. Operación protegida sin credenciales (POST /api/libros) -> Debe ser 401
$resUnauthorized = httpRequest('POST', "{$baseUrl}/libros", [
    'isbn' => '978-0-000-00000-0',
    'titulo' => 'Libro sin autorizacion',
]);
echo "[4] POST /api/libros (Sin auth) -> Status: {$resUnauthorized['status']} (Esperado: 401 Unauthorized)\n";
assert($resUnauthorized['status'] === 401, "Se esperaba 401 para petición sin auth");

// 5. Registro de nuevo usuario (POST /api/auth/register)
$uniqueId = rand(1000, 9999);
$resRegister = httpRequest('POST', "{$baseUrl}/auth/register", [
    'numero_documento' => 'DOC-' . $uniqueId,
    'nombre_completo' => 'Lector HTTP ' . $uniqueId,
    'email' => "lector.http.{$uniqueId}@sgbi.edu",
    'password' => 'clave123456',
]);
echo "[5] POST /api/auth/register -> Status: {$resRegister['status']} (Nuevo ID: " . ($resRegister['body']['user']['id_usuario'] ?? 'N/A') . ")\n";
assert($resRegister['status'] === 201, "Registro de usuario falló");

// 6. Login exitoso de Administrador (POST /api/auth/login)
$resLogin = httpRequest('POST', "{$baseUrl}/auth/login", [
    'email' => 'admin@sgbi.edu',
    'password' => 'sgbi2026',
]);
$adminToken = $resLogin['body']['token'] ?? '1';
echo "[6] POST /api/auth/login (Admin) -> Status: {$resLogin['status']} (Rol: " . ($resLogin['body']['user']['rol'] ?? 'N/A') . ", Token: {$adminToken})\n";
assert($resLogin['status'] === 200, "Login de administrador falló");

// 7. Login con credenciales incorrectas -> Debe ser 401
$resLoginFail = httpRequest('POST', "{$baseUrl}/auth/login", [
    'email' => 'admin@sgbi.edu',
    'password' => 'claveIncorrecta',
]);
echo "[7] POST /api/auth/login (Clave errónea) -> Status: {$resLoginFail['status']} (Esperado: 401)\n";
assert($resLoginFail['status'] === 401, "Se esperaba 401 para credenciales incorrectas");

// 8. Crear libro con autenticación de Administrador (Bearer Token)
$testIsbn = '978-HTTP-' . $uniqueId;
$resCreateLibro = httpRequest('POST', "{$baseUrl}/libros", [
    'isbn' => $testIsbn,
    'titulo' => 'Libro Creado via HTTP ' . $uniqueId,
    'categoria' => 'Literatura General',
    'copias_totales' => 4,
    'copias_disp' => 4,
], ["Authorization: Bearer {$adminToken}"]);
$createdLibroId = $resCreateLibro['body']['libro']['id_libro'] ?? 0;
echo "[8] POST /api/libros (Con Bearer Admin) -> Status: {$resCreateLibro['status']} (ID Libro: {$createdLibroId})\n";
assert($resCreateLibro['status'] === 201, "Creación de libro autenticada falló");

// 9. Operación protegida denegada por permisos: El nuevo Lector intenta crear libro con su JWT -> 403 Forbidden
$lectorToken = $resRegister['body']['token'] ?? '3';
$resForbidden = httpRequest('POST', "{$baseUrl}/libros", [
    'isbn' => '978-FORBIDDEN-01',
    'titulo' => 'Intento No Autorizado',
], ["Authorization: Bearer {$lectorToken}"]);
echo "[9] POST /api/libros (Con Bearer Lector) -> Status: {$resForbidden['status']} (Esperado: 403 Forbidden)\n";
assert($resForbidden['status'] === 403, "Se esperaba 403 para LECTOR intentando crear libros");

// 10. Actualizar libro (PUT /api/libros/{id})
$resUpdateLibro = httpRequest('PUT', "{$baseUrl}/libros/{$createdLibroId}", [
    'isbn' => $testIsbn,
    'titulo' => 'Libro Actualizado via HTTP ' . $uniqueId,
    'categoria' => 'Literatura General',
    'copias_totales' => 5,
    'copias_disp' => 5,
], ["Authorization: Bearer {$adminToken}"]);
echo "[10] PUT /api/libros/{$createdLibroId} -> Status: {$resUpdateLibro['status']}\n";
assert($resUpdateLibro['status'] === 200, "Actualización de libro falló");

// 11. Eliminar libro (DELETE /api/libros/{id})
$resDeleteLibro = httpRequest('DELETE', "{$baseUrl}/libros/{$createdLibroId}", null, ["Authorization: Bearer {$adminToken}"]);
echo "[11] DELETE /api/libros/{$createdLibroId} -> Status: {$resDeleteLibro['status']}\n";
assert($resDeleteLibro['status'] === 200, "Eliminación de libro falló");

// 12. Consultar libro eliminado -> Debe ser 404 Not Found
$resGetDeleted = httpRequest('GET', "{$baseUrl}/libros/{$createdLibroId}");
echo "[12] GET /api/libros/{$createdLibroId} (Eliminado) -> Status: {$resGetDeleted['status']} (Esperado: 404 Not Found)\n";
assert($resGetDeleted['status'] === 404, "Se esperaba 404 para libro eliminado");

echo "\n>>> TODAS LAS 12 PRUEBAS HTTP EN VIVO SE COMPLETARON CON ÉXITO <<<\n";
