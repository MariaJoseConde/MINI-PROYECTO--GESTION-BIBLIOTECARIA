<?php
/**
 * biblioSmart - Suite de Pruebas de Integración: Validaciones, Reservas y Renovaciones
 * Ejecución contra servidor activo: php backend-php/test_integracion_sprint3.php 8000
 */

declare(strict_types=1);

$port = $argv[1] ?? '8000';
$baseUrl = "http://127.0.0.1:{$port}/api";

$passed = 0;
$failed = 0;

function req(string $method, string $url, ?array $body = null, ?string $token = null): array {
    $headers = [
        'Content-Type: application/json',
        'Accept: application/json',
    ];
    if ($token !== null) {
        $headers[] = "Authorization: Bearer {$token}";
    }

    $opts = [
        'http' => [
            'method' => $method,
            'header' => $headers,
            'ignore_errors' => true,
            'timeout' => 8,
        ],
    ];
    if ($body !== null) {
        $opts['http']['content'] = json_encode($body);
    }

    $ctx = stream_context_create($opts);
    $raw = file_get_contents($url, false, $ctx);
    $statusLine = $http_response_header[0] ?? '';
    preg_match('/HTTP\/\S+\s+(\d+)/', $statusLine, $m);
    $status = isset($m[1]) ? (int)$m[1] : 0;

    return [
        'status' => $status,
        'body' => json_decode($raw ?: '{}', true) ?: [],
    ];
}

function check(bool $cond, string $label, string $detail = ''): void {
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "  [PASS] {$label}\n";
    } else {
        $failed++;
        echo "  [FAIL] {$label}" . ($detail !== '' ? " -> {$detail}" : '') . "\n";
    }
}

echo "======================================================================\n";
echo "   biblioSmart - PRUEBAS DE INTEGRACIÓN (VALIDACIONES Y FUNCIONALIDADES)\n";
echo "======================================================================\n\n";

// 0. Login Admin y Lector
$loginAdmin = req('POST', "{$baseUrl}/auth/login", ['email' => 'admin@sgbi.edu', 'password' => 'sgbi2026']);
$adminToken = $loginAdmin['body']['token'] ?? '';
check($loginAdmin['status'] === 200 && $adminToken !== '', "Login ADMIN exitoso con JWT");

$loginLector = req('POST', "{$baseUrl}/auth/login", ['email' => 'lector@sgbi.edu', 'password' => 'sgbi2026']);
$lectorToken = $loginLector['body']['token'] ?? '';
$lectorId = (int)($loginLector['body']['user']['id_usuario'] ?? 3);
check($loginLector['status'] === 200 && $lectorToken !== '', "Login LECTOR exitoso con JWT");

// ----------------------------------------------------------------------
// BLOQUE 1: VALIDACIONES DE ENTRADA Y CONSISTENCIA
// ----------------------------------------------------------------------
echo "\n--- BLOQUE 1: Validaciones de Entrada y Consistencia ---\n";

// 1.1 Libro con copias_disp > copias_totales -> 422 VALIDATION_ERROR
$resBadStock = req('POST', "{$baseUrl}/libros", [
    'isbn' => '978-VAL-0001',
    'titulo' => 'Libro Stock Inválido',
    'copias_totales' => 2,
    'copias_disp' => 5,
], $adminToken);
check($resBadStock['status'] === 422 && ($resBadStock['body']['code'] ?? '') === 'VALIDATION_ERROR',
    "Rechaza libro con copias_disp > copias_totales (HTTP 422)",
    "Recibido {$resBadStock['status']}");

// 1.2 Libro con año de publicación fuera de rango -> 422
$resBadYear = req('POST', "{$baseUrl}/libros", [
    'isbn' => '978-VAL-0002',
    'titulo' => 'Libro Año Inválido',
    'anio_publicacion' => 9999,
    'copias_totales' => 2,
], $adminToken);
check($resBadYear['status'] === 422, "Rechaza libro con año de publicación inválido (9999 -> HTTP 422)", "Recibido {$resBadYear['status']}");

// 1.3 Libro con autor inexistente -> 422 INVALID_AUTHOR_ID
$resBadAutor = req('POST', "{$baseUrl}/libros", [
    'isbn' => '978-VAL-0003',
    'titulo' => 'Libro Autor Inexistente',
    'copias_totales' => 1,
    'autor_ids' => [999999],
], $adminToken);
check($resBadAutor['status'] === 422 && ($resBadAutor['body']['code'] ?? '') === 'INVALID_AUTHOR_ID',
    "Rechaza libro con ID de autor inexistente (HTTP 422)",
    "Recibido {$resBadAutor['status']}");

// 1.4 Usuario con correo inválido y rol inválido -> 422
$resBadUserEmail = req('POST', "{$baseUrl}/usuarios", [
    'numero_documento' => 'VAL-DOC-1',
    'nombre_completo' => 'Prueba Email',
    'email' => 'correo-invalido',
    'password' => 'clave123',
    'rol' => 'LECTOR',
], $adminToken);
check($resBadUserEmail['status'] === 422, "Rechaza creación de usuario con email inválido (HTTP 422)", "Recibido {$resBadUserEmail['status']}");

$resBadUserRole = req('POST', "{$baseUrl}/usuarios", [
    'numero_documento' => 'VAL-DOC-2',
    'nombre_completo' => 'Prueba Rol',
    'email' => 'rol.invalido@sgbi.edu',
    'password' => 'clave123',
    'rol' => 'SUPER_DIOS',
], $adminToken);
check($resBadUserRole['status'] === 422 && ($resBadUserRole['body']['code'] ?? '') === 'INVALID_ROLE',
    "Rechaza creación de usuario con rol no permitido (HTTP 422)",
    "Recibido {$resBadUserRole['status']}");

// 1.5 Sala con capacidad fuera de rango -> 422
$resBadSala = req('POST', "{$baseUrl}/salas", [
    'nombre' => 'Sala Inválida Test',
    'capacidad' => 0,
], $adminToken);
check($resBadSala['status'] === 422, "Rechaza sala con capacidad 0 (HTTP 422)", "Recibido {$resBadSala['status']}");

// ----------------------------------------------------------------------
// BLOQUE 2: FUNCIONALIDADES NUEVAS (RESERVAS Y RENOVACIÓN DE PRÉSTAMOS)
// ----------------------------------------------------------------------
echo "\n--- BLOQUE 2: Flujo Integrado de Préstamos, Renovaciones y Reservas ---\n";

$uid = rand(10000, 99999);
// Crear libro de prueba con 1 sola copia para probar flujo completo sin tocar libros reales
$resBook = req('POST', "{$baseUrl}/libros", [
    'isbn' => "978-INT-{$uid}",
    'titulo' => "Libro Integración {$uid}",
    'categoria' => 'Literatura General',
    'copias_totales' => 1,
    'copias_disp' => 1,
], $adminToken);
$bookId = (int)($resBook['body']['libro']['id_libro'] ?? 0);
check($resBook['status'] === 201 && $bookId > 0, "Libro de prueba creado (ID #{$bookId}, stock 1/1)");

// Crear segundo usuario lector temporal para probar reserva mientras el primero tiene el libro
$resReg2 = req('POST', "{$baseUrl}/auth/register", [
    'numero_documento' => "INTDOC{$uid}",
    'nombre_completo' => "Lector Reserva {$uid}",
    'email' => "lector.res.{$uid}@sgbi.edu",
    'password' => 'clave1234',
]);
$lector2Token = $resReg2['body']['token'] ?? '';
$lector2Id = (int)($resReg2['body']['user']['id_usuario'] ?? 0);
check($resReg2['status'] === 201 && $lector2Id > 0, "Segundo lector registrado para flujo de reserva (ID #{$lector2Id})");

// 2.1 Intentar reservar cuando el libro SÍ tiene copias disponibles -> 409 BOOK_AVAILABLE_FOR_LOAN
$resReserveAvail = req('POST', "{$baseUrl}/reservas", ['id_libro' => $bookId], $lector2Token);
check($resReserveAvail['status'] === 409 && ($resReserveAvail['body']['code'] ?? '') === 'BOOK_AVAILABLE_FOR_LOAN',
    "Impide reservar un libro que tiene ejemplares disponibles (HTTP 409)",
    "Recibido {$resReserveAvail['status']}");

// 2.2 Prestar el único ejemplar al lector 1 -> stock pasa a 0/1
$resLoan = req('POST', "{$baseUrl}/prestamos", [
    'id_libro' => $bookId,
    'id_usuario' => $lectorId,
], $adminToken);
$loanId = (int)($resLoan['body']['prestamo']['id_prestamo'] ?? 0);
check($resLoan['status'] === 201 && $loanId > 0, "Préstamo #{$loanId} creado (stock pasa a 0/1)");

// 2.3 Lector 1 intenta pedir prestado el mismo libro otra vez -> 409 DUPLICATE_ACTIVE_LOAN
$resDupLoan = req('POST', "{$baseUrl}/prestamos", [
    'id_libro' => $bookId,
    'id_usuario' => $lectorId,
], $adminToken);
check($resDupLoan['status'] === 409 && ($resDupLoan['body']['code'] ?? '') === 'DUPLICATE_ACTIVE_LOAN',
    "Impide préstamo duplicado simultáneo del mismo libro (HTTP 409)",
    "Recibido {$resDupLoan['status']}");

// 2.4 Lector 1 renueva su préstamo (sin reservas pendientes) -> éxito, renovaciones = 1
$fechaLimiteInicial = $resLoan['body']['prestamo']['fecha_limite'] ?? '';
$resRenew1 = req('POST', "{$baseUrl}/prestamos/{$loanId}/renovar", null, $lectorToken);
$nuevaFecha1 = $resRenew1['body']['prestamo']['fecha_limite'] ?? '';
$renCount1 = (int)($resRenew1['body']['prestamo']['renovaciones'] ?? 0);
check($resRenew1['status'] === 200 && $renCount1 === 1 && $nuevaFecha1 > $fechaLimiteInicial,
    "Renovación de préstamo exitosa por el lector ({$fechaLimiteInicial} -> {$nuevaFecha1}, 1/2)",
    "Status {$resRenew1['status']}");

// 2.5 Lector 2 reserva el libro agotado (0/1) -> 201 Created PENDIENTE
$resReserva = req('POST', "{$baseUrl}/reservas", ['id_libro' => $bookId], $lector2Token);
$reservaId = (int)($resReserva['body']['reserva']['id_reserva'] ?? 0);
check($resReserva['status'] === 201 && $reservaId > 0 && ($resReserva['body']['reserva']['estado'] ?? '') === 'PENDIENTE',
    "Reserva #{$reservaId} creada exitosamente para libro agotado (estado PENDIENTE)",
    "Status {$resReserva['status']}");

// 2.6 Lector 2 intenta duplicar reserva del mismo libro -> 409 DUPLICATE_RESERVATION
$resDupRes = req('POST', "{$baseUrl}/reservas", ['id_libro' => $bookId], $lector2Token);
check($resDupRes['status'] === 409 && ($resDupRes['body']['code'] ?? '') === 'DUPLICATE_RESERVATION',
    "Rechaza reserva duplicada del mismo usuario y libro (HTTP 409)",
    "Recibido {$resDupRes['status']}");

// 2.7 Lector 1 intenta volver a renovar ahora que existe reserva pendiente -> 409 BOOK_HAS_RESERVATIONS
$resRenewBlocked = req('POST', "{$baseUrl}/prestamos/{$loanId}/renovar", null, $lectorToken);
check($resRenewBlocked['status'] === 409 && ($resRenewBlocked['body']['code'] ?? '') === 'BOOK_HAS_RESERVATIONS',
    "Bloquea renovación de préstamo porque hay una reserva pendiente (HTTP 409)",
    "Recibido {$resRenewBlocked['status']}");

// 2.8 Lector 1 devuelve el libro -> stock vuelve a 1 y reserva pasa automáticamente a DISPONIBLE
$resReturn = req('POST', "{$baseUrl}/prestamos/{$loanId}/devolver", [], $adminToken);
check($resReturn['status'] === 200 && ($resReturn['body']['ok'] ?? false) === true,
    "Devolución del préstamo #{$loanId} exitosa",
    "Status {$resReturn['status']}: " . json_encode($resReturn['body']));

$resListRes = req('GET', "{$baseUrl}/reservas", null, $lector2Token);
$foundReserva = null;
foreach ($resListRes['body']['reservas'] ?? [] as $r) {
    if ((int)$r['id_reserva'] === $reservaId) {
        $foundReserva = $r;
        break;
    }
}
check($foundReserva !== null && ($foundReserva['estado'] ?? '') === 'DISPONIBLE',
    "La devolución actualizó automáticamente la reserva #{$reservaId} a DISPONIBLE",
    "Estado: " . ($foundReserva['estado'] ?? 'N/A'));

// 2.9 Admin completa la reserva -> convierte en nuevo préstamo y descuenta stock
$resComplete = req('POST', "{$baseUrl}/reservas/{$reservaId}/completar", null, $adminToken);
$loanFromResId = (int)($resComplete['body']['id_prestamo'] ?? 0);
check($resComplete['status'] === 200 && $loanFromResId > 0,
    "Reserva #{$reservaId} convertida en préstamo #{$loanFromResId} correctamente");

// 2.10 Limpieza de registros de prueba (sin afectar registros reales)
if ($loanFromResId > 0) {
    req('DELETE', "{$baseUrl}/prestamos/{$loanFromResId}", null, $adminToken);
}
if ($loanId > 0) {
    req('DELETE', "{$baseUrl}/prestamos/{$loanId}", null, $adminToken);
}
// Nota: al tener reservas con FK RESTRICT al libro/usuario, solo comprobamos respuesta de cancelación en nueva reserva temporal
echo "\n======================================================================\n";
echo sprintf("   RESUMEN PRUEBAS INTEGRACIÓN: %d pasadas, %d fallidas (Total: %d)\n",
    $passed,
    $failed,
    $passed + $failed
);
echo "======================================================================\n";

if ($failed > 0) {
    exit(1);
}
