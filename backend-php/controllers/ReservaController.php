<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Auth;
use Sgbi\Config\Response;
use DateTime;
use Exception;

class ReservaController {
    public function listReservas(): void {
        $user = Auth::requireAuth();
        $isAdmin = $user['rol'] === 'ADMIN';
        $db = Database::getConnection();

        $sql = "
            SELECT
                r.*,
                l.titulo AS libro_titulo,
                l.isbn AS libro_isbn,
                l.copias_disp AS libro_copias_disp,
                u.nombre_completo AS usuario_nombre,
                u.numero_documento AS usuario_documento
            FROM reservas r
            JOIN libros l ON l.id_libro = r.id_libro
            JOIN usuarios u ON u.id_usuario = r.id_usuario
        ";

        if (!$isAdmin) {
            $sql .= " WHERE r.id_usuario = ? ";
        }

        $sql .= "
            ORDER BY
                CASE
                    WHEN r.estado = 'DISPONIBLE' THEN 0
                    WHEN r.estado = 'PENDIENTE' THEN 1
                    ELSE 2
                END,
                r.id_reserva DESC
        ";

        $stmt = $db->prepare($sql);
        if ($isAdmin) {
            $stmt->execute();
        } else {
            $stmt->execute([(int)$user['id_usuario']]);
        }

        $reservas = $stmt->fetchAll();
        foreach ($reservas as &$r) {
            $r['id_reserva'] = (int)$r['id_reserva'];
            $r['id_libro'] = (int)$r['id_libro'];
            $r['id_usuario'] = (int)$r['id_usuario'];
            $r['libro_copias_disp'] = (int)$r['libro_copias_disp'];
        }

        Response::json(['reservas' => $reservas]);
    }

    public function createReserva(): void {
        $user = Auth::requireAuth();
        $body = Response::getBody();

        $idLibro = filter_var($body['id_libro'] ?? 0, FILTER_VALIDATE_INT);
        $idUsuario = ($user['rol'] === 'ADMIN' && !empty($body['id_usuario']))
            ? filter_var($body['id_usuario'], FILTER_VALIDATE_INT)
            : (int)$user['id_usuario'];

        if ($idLibro === false || $idLibro <= 0 || $idUsuario === false || $idUsuario <= 0) {
            Response::error('Debe indicar un libro válido para reservar.', 422, 'VALIDATION_ERROR');
        }

        $db = Database::getConnection();

        // 1. Verificar usuario activo
        $stmtUser = $db->prepare('SELECT id_usuario, nombre_completo, estado FROM usuarios WHERE id_usuario = ?');
        $stmtUser->execute([$idUsuario]);
        $lector = $stmtUser->fetch();
        if (!$lector) {
            Response::error('Usuario no encontrado.', 404, 'USER_NOT_FOUND');
        }
        if ($lector['estado'] !== 'ACTIVO') {
            Response::error("No puedes realizar reservas mientras tu cuenta esté en estado {$lector['estado']}.", 409, 'USUARIO_BLOQUEADO');
        }

        // 2. Verificar libro y disponibilidad
        $stmtLibro = $db->prepare('SELECT id_libro, titulo, copias_disp FROM libros WHERE id_libro = ?');
        $stmtLibro->execute([$idLibro]);
        $libro = $stmtLibro->fetch();
        if (!$libro) {
            Response::error('El libro seleccionado no existe.', 404, 'BOOK_NOT_FOUND');
        }
        if ((int)$libro['copias_disp'] > 0) {
            Response::error(
                "El libro \"{$libro['titulo']}\" tiene ejemplares disponibles actualmente. Puedes solicitarlo directamente en mostrador sin reserva.",
                409,
                'BOOK_AVAILABLE_FOR_LOAN'
            );
        }

        // 3. Evitar reserva si ya tiene préstamo activo o reserva vigente para el mismo libro
        $stmtLoan = $db->prepare("SELECT COUNT(*) FROM prestamos WHERE id_usuario = ? AND id_libro = ? AND fecha_entrega IS NULL");
        $stmtLoan->execute([$idUsuario, $idLibro]);
        if ((int)$stmtLoan->fetchColumn() > 0) {
            Response::error('Ya tienes un préstamo vigente de este libro.', 409, 'DUPLICATE_ACTIVE_LOAN');
        }

        $stmtRes = $db->prepare("SELECT COUNT(*) FROM reservas WHERE id_usuario = ? AND id_libro = ? AND estado IN ('PENDIENTE', 'DISPONIBLE')");
        $stmtRes->execute([$idUsuario, $idLibro]);
        if ((int)$stmtRes->fetchColumn() > 0) {
            Response::error('Ya cuentas con una reserva activa para este libro.', 409, 'DUPLICATE_RESERVATION');
        }

        $hoy = new DateTime();
        $fechaReserva = $hoy->format('Y-m-d');
        $fechaExpiracion = CirculacionController::calcularFechaLimite($hoy, 5);

        $stmtInsert = $db->prepare("
            INSERT INTO reservas (id_libro, id_usuario, fecha_reserva, fecha_expiracion, estado)
            VALUES (?, ?, ?, ?, 'PENDIENTE')
        ");
        $stmtInsert->execute([$idLibro, $idUsuario, $fechaReserva, $fechaExpiracion]);
        $newId = (int)$db->lastInsertId();

        Database::logEvent(
            'RESERVA_CREADA',
            "Reserva #{$newId} registrada para \"{$libro['titulo']}\" por {$lector['nombre_completo']}.",
            (int)$user['id_usuario']
        );

        $stmtFetch = $db->prepare("
            SELECT
                r.*,
                l.titulo AS libro_titulo,
                l.isbn AS libro_isbn,
                l.copias_disp AS libro_copias_disp,
                u.nombre_completo AS usuario_nombre,
                u.numero_documento AS usuario_documento
            FROM reservas r
            JOIN libros l ON l.id_libro = r.id_libro
            JOIN usuarios u ON u.id_usuario = r.id_usuario
            WHERE r.id_reserva = ?
        ");
        $stmtFetch->execute([$newId]);
        $reserva = $stmtFetch->fetch();
        $reserva['id_reserva'] = (int)$reserva['id_reserva'];
        $reserva['id_libro'] = (int)$reserva['id_libro'];
        $reserva['id_usuario'] = (int)$reserva['id_usuario'];
        $reserva['libro_copias_disp'] = (int)$reserva['libro_copias_disp'];

        Response::created(['reserva' => $reserva], "/api/reservas/{$newId}");
    }

    public function cancelarReserva(int $id): void {
        $user = Auth::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM reservas WHERE id_reserva = ?');
        $stmt->execute([$id]);
        $reserva = $stmt->fetch();

        if (!$reserva) {
            Response::error('Reserva no encontrada.', 404, 'RESERVATION_NOT_FOUND');
        }

        if ($user['rol'] !== 'ADMIN' && (int)$reserva['id_usuario'] !== (int)$user['id_usuario']) {
            Response::error('No tienes permisos para cancelar esta reserva.', 403, 'FORBIDDEN');
        }

        if (in_array($reserva['estado'], ['COMPLETADA', 'CANCELADA'], true)) {
            Response::error("La reserva ya se encuentra en estado {$reserva['estado']}.", 409, 'RESERVATION_CLOSED');
        }

        $db->prepare("UPDATE reservas SET estado = 'CANCELADA' WHERE id_reserva = ?")->execute([$id]);
        Database::logEvent('RESERVA_CANCELADA', "Reserva #{$id} cancelada.", (int)$user['id_usuario']);

        Response::json(['ok' => true, 'mensaje' => "Reserva #{$id} cancelada correctamente.", 'estado' => 'CANCELADA']);
    }

    public function completarReserva(int $id): void {
        $admin = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM reservas WHERE id_reserva = ?');
        $stmt->execute([$id]);
        $reserva = $stmt->fetch();

        if (!$reserva) {
            Response::error('Reserva no encontrada.', 404, 'RESERVATION_NOT_FOUND');
        }

        if (in_array($reserva['estado'], ['COMPLETADA', 'CANCELADA'], true)) {
            Response::error("La reserva ya se encuentra {$reserva['estado']}.", 409, 'RESERVATION_CLOSED');
        }

        $stmtLibro = $db->prepare('SELECT id_libro, titulo, copias_disp FROM libros WHERE id_libro = ?');
        $stmtLibro->execute([(int)$reserva['id_libro']]);
        $libro = $stmtLibro->fetch();
        if (!$libro || (int)$libro['copias_disp'] <= 0) {
            Response::error('Aún no hay copias disponibles para convertir esta reserva en préstamo.', 409, 'SIN_COPIAS_DISPONIBLES');
        }

        $hoy = new DateTime();
        $fechaPrestamo = $hoy->format('Y-m-d');
        $fechaLimite = CirculacionController::calcularFechaLimite($hoy, 8);

        $db->beginTransaction();
        try {
            $db->prepare('UPDATE libros SET copias_disp = copias_disp - 1 WHERE id_libro = ?')->execute([(int)$reserva['id_libro']]);
            $stmtLoan = $db->prepare("
                INSERT INTO prestamos (id_libro, id_usuario, fecha_prestamo, fecha_limite, estado)
                VALUES (?, ?, ?, ?, 'ACTIVO')
            ");
            $stmtLoan->execute([(int)$reserva['id_libro'], (int)$reserva['id_usuario'], $fechaPrestamo, $fechaLimite]);
            $idPrestamo = (int)$db->lastInsertId();

            $db->prepare("UPDATE reservas SET estado = 'COMPLETADA' WHERE id_reserva = ?")->execute([$id]);

            Database::logEvent(
                'RESERVA_COMPLETADA',
                "Reserva #{$id} entregada y convertida en préstamo #{$idPrestamo}.",
                (int)$admin['id_usuario']
            );
            $db->commit();

            Response::json([
                'ok' => true,
                'mensaje' => "Reserva #{$id} convertida en préstamo #{$idPrestamo}.",
                'id_prestamo' => $idPrestamo,
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error('Error transaccional al completar la reserva: ' . $e->getMessage(), 500);
        }
    }
}
