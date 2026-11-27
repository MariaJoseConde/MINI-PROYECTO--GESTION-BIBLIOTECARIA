<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Auth;
use Sgbi\Config\Response;
use DateTime;
use Exception;

class CirculacionController {
    public static function calcularFechaLimite(DateTime $fechaInicio, int $diasHabiles = 8): string {
        $fecha = clone $fechaInicio;
        $diasAgregados = 0;

        while ($diasAgregados < $diasHabiles) {
            $fecha->modify('+1 day');
            // 1 (Monday) to 5 (Friday) are business days
            $diaSemana = (int)$fecha->format('N');
            if ($diaSemana >= 1 && $diaSemana <= 5) {
                $diasAgregados++;
            }
        }

        return $fecha->format('Y-m-d');
    }

    public function calcularFecha(): void {
        Auth::requireRole('ADMIN');
        $hoy = new DateTime();
        Response::json([
            'fecha_prestamo' => $hoy->format('Y-m-d'),
            'fecha_limite' => self::calcularFechaLimite($hoy, 8),
            'dias_habiles' => 8,
        ]);
    }

    public function listPrestamos(): void {
        $user = Auth::requireAuth();
        $isAdmin = $user['rol'] === 'ADMIN';

        $db = Database::getConnection();

        $sql = "
            SELECT 
                p.*,
                l.titulo AS libro_titulo,
                l.isbn AS libro_isbn,
                u.nombre_completo AS usuario_nombre,
                u.numero_documento AS usuario_documento,
                u.estado AS usuario_estado
            FROM prestamos p
            JOIN libros l ON l.id_libro = p.id_libro
            JOIN usuarios u ON u.id_usuario = p.id_usuario
        ";

        if (!$isAdmin) {
            $sql .= " WHERE p.id_usuario = ? ";
        }

        $sql .= "
            ORDER BY
                CASE 
                    WHEN p.estado = 'MORA' AND p.fecha_entrega IS NULL THEN 0
                    WHEN p.estado = 'ACTIVO' THEN 1
                    ELSE 2 
                END,
                p.id_prestamo DESC
        ";

        $stmt = $db->prepare($sql);
        if ($isAdmin) {
            $stmt->execute();
        } else {
            $stmt->execute([(int)$user['id_usuario']]);
        }

        $prestamos = $stmt->fetchAll();
        foreach ($prestamos as &$p) {
            $p['id_prestamo'] = (int)$p['id_prestamo'];
            $p['id_libro'] = (int)$p['id_libro'];
            $p['id_usuario'] = (int)$p['id_usuario'];
            $p['multa_calculada'] = (float)($p['multa_calculada'] ?? 0);
        }

        Response::json(['prestamos' => $prestamos]);
    }

    public function getPrestamo(int $id): void {
        $user = Auth::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT 
                p.*,
                l.titulo AS libro_titulo,
                l.isbn AS libro_isbn,
                u.nombre_completo AS usuario_nombre,
                u.numero_documento AS usuario_documento,
                u.estado AS usuario_estado
            FROM prestamos p
            JOIN libros l ON l.id_libro = p.id_libro
            JOIN usuarios u ON u.id_usuario = p.id_usuario
            WHERE p.id_prestamo = ?
        ");
        $stmt->execute([$id]);
        $prestamo = $stmt->fetch();

        if (!$prestamo) {
            Response::error('Préstamo no encontrado.', 404, 'LOAN_NOT_FOUND');
        }

        if ($user['rol'] !== 'ADMIN' && (int)$prestamo['id_usuario'] !== (int)$user['id_usuario']) {
            Response::error('No tiene permisos para ver este préstamo.', 403, 'FORBIDDEN');
        }

        $prestamo['id_prestamo'] = (int)$prestamo['id_prestamo'];
        $prestamo['id_libro'] = (int)$prestamo['id_libro'];
        $prestamo['id_usuario'] = (int)$prestamo['id_usuario'];
        $prestamo['multa_calculada'] = (float)($prestamo['multa_calculada'] ?? 0);

        Response::json(['prestamo' => $prestamo]);
    }

    public function createPrestamo(): void {
        $admin = Auth::requireRole('ADMIN');
        $body = Response::getBody();

        $idLibro = (int)($body['id_libro'] ?? 0);
        $idUsuario = (int)($body['id_usuario'] ?? 0);

        if ($idLibro <= 0 || $idUsuario <= 0) {
            Response::error('Debe seleccionar un lector y un libro válidos.', 400);
        }

        $db = Database::getConnection();

        // 1. Check user exists and status
        $stmtUser = $db->prepare('SELECT id_usuario, nombre_completo, estado FROM usuarios WHERE id_usuario = ?');
        $stmtUser->execute([$idUsuario]);
        $lector = $stmtUser->fetch();

        if (!$lector) {
            Response::error('El usuario especificado no existe.', 404);
        }

        if ($lector['estado'] === 'SANCIONADO' || $lector['estado'] === 'INACTIVO') {
            Response::error(
                "El lector {$lector['nombre_completo']} se encuentra en estado {$lector['estado']} y no puede recibir préstamos.",
                409,
                'USUARIO_BLOQUEADO'
            );
        }

        // 2. Check if user has active MORA loans
        $stmtMora = $db->prepare("SELECT COUNT(*) FROM prestamos WHERE id_usuario = ? AND estado = 'MORA' AND fecha_entrega IS NULL");
        $stmtMora->execute([$idUsuario]);
        if ((int)$stmtMora->fetchColumn() > 0) {
            Response::error(
                "El lector {$lector['nombre_completo']} presenta préstamos vencidos en mora activa.",
                409,
                'USUARIO_CON_MORA'
            );
        }

        // 2b. Check duplicate active loan for the same book & max concurrent loans (5)
        $stmtSame = $db->prepare("SELECT COUNT(*) FROM prestamos WHERE id_usuario = ? AND id_libro = ? AND fecha_entrega IS NULL");
        $stmtSame->execute([$idUsuario, $idLibro]);
        if ((int)$stmtSame->fetchColumn() > 0) {
            Response::error(
                "El lector {$lector['nombre_completo']} ya tiene un préstamo vigente de este mismo título.",
                409,
                'DUPLICATE_ACTIVE_LOAN'
            );
        }

        $stmtActiveCount = $db->prepare("SELECT COUNT(*) FROM prestamos WHERE id_usuario = ? AND fecha_entrega IS NULL");
        $stmtActiveCount->execute([$idUsuario]);
        if ((int)$stmtActiveCount->fetchColumn() >= 5) {
            Response::error(
                "El lector {$lector['nombre_completo']} alcanzó el límite máximo de 5 préstamos simultáneos.",
                409,
                'MAX_ACTIVE_LOANS_REACHED'
            );
        }

        // 3. Check book stock
        $stmtLibro = $db->prepare('SELECT id_libro, titulo, copias_disp FROM libros WHERE id_libro = ?');
        $stmtLibro->execute([$idLibro]);
        $libro = $stmtLibro->fetch();

        if (!$libro) {
            Response::error('El libro seleccionado no existe.', 404);
        }

        if ((int)$libro['copias_disp'] <= 0) {
            Response::error(
                "No hay copias disponibles para el ejemplar \"{$libro['titulo']}\".",
                409,
                'SIN_COPIAS_DISPONIBLES'
            );
        }

        $hoy = new DateTime();
        $fechaPrestamo = $hoy->format('Y-m-d');
        $fechaLimite = self::calcularFechaLimite($hoy, 8);

        $db->beginTransaction();
        try {
            // Decrement copies
            $db->prepare('UPDATE libros SET copias_disp = copias_disp - 1 WHERE id_libro = ?')->execute([$idLibro]);

            // Insert loan
            $stmtInsert = $db->prepare("
                INSERT INTO prestamos (id_libro, id_usuario, fecha_prestamo, fecha_limite, estado)
                VALUES (?, ?, ?, ?, 'ACTIVO')
            ");
            $stmtInsert->execute([$idLibro, $idUsuario, $fechaPrestamo, $fechaLimite]);
            $idPrestamo = (int)$db->lastInsertId();

            Database::logEvent(
                'PRESTAMO_REGISTRADO',
                "Préstamo #{$idPrestamo} concedido: \"{$libro['titulo']}\" a {$lector['nombre_completo']} (Fecha límite: {$fechaLimite}).",
                (int)$admin['id_usuario']
            );

            $db->commit();

            // Fetch created loan details
            $stmtPrestamo = $db->prepare("
                SELECT 
                    p.*,
                    l.titulo AS libro_titulo,
                    l.isbn AS libro_isbn,
                    u.nombre_completo AS usuario_nombre,
                    u.numero_documento AS usuario_documento,
                    u.estado AS usuario_estado
                FROM prestamos p
                JOIN libros l ON l.id_libro = p.id_libro
                JOIN usuarios u ON u.id_usuario = p.id_usuario
                WHERE p.id_prestamo = ?
            ");
            $stmtPrestamo->execute([$idPrestamo]);
            $prestamo = $stmtPrestamo->fetch();
            $prestamo['id_prestamo'] = (int)$prestamo['id_prestamo'];

            Response::json(['prestamo' => $prestamo], 201);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error('Error transaccional al registrar préstamo: ' . $e->getMessage(), 500);
        }
    }

    public function devolverPrestamo(int $id): void {
        $admin = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM prestamos WHERE id_prestamo = ?');
        $stmt->execute([$id]);
        $prestamo = $stmt->fetch();

        if (!$prestamo) {
            Response::error('Folio de préstamo no encontrado.', 404);
        }

        if (!empty($prestamo['fecha_entrega'])) {
            Response::error('Este préstamo ya fue devuelto previamente.', 400);
        }

        $hoy = new DateTime();
        $fechaEntrega = $hoy->format('Y-m-d');
        $fechaLimite = new DateTime($prestamo['fecha_limite']);

        $esMora = $hoy > $fechaLimite;
        $diasMora = 0;
        $multa = 0.0;

        if ($esMora) {
            $diff = $fechaLimite->diff($hoy);
            $diasMora = (int)$diff->format('%a');
            $multa = $diasMora * 1500.0; // $1,500 COP por dia de mora
        }

        $nuevoEstado = $esMora ? 'DEVUELTO' : 'DEVUELTO';

        $db->beginTransaction();
        try {
            // Update loan
            $stmtUpdate = $db->prepare("
                UPDATE prestamos 
                SET fecha_entrega = ?, estado = ?, multa_calculada = ?
                WHERE id_prestamo = ?
            ");
            $stmtUpdate->execute([$fechaEntrega, $nuevoEstado, $multa, $id]);

            // Increment book available copies
            $db->prepare('UPDATE libros SET copias_disp = copias_disp + 1 WHERE id_libro = ?')->execute([(int)$prestamo['id_libro']]);

            // Check if user has other mora loans; if none, ensure user is ACTIVO
            $stmtCheckMora = $db->prepare("SELECT COUNT(*) FROM prestamos WHERE id_usuario = ? AND id_prestamo != ? AND estado = 'MORA' AND fecha_entrega IS NULL");
            $stmtCheckMora->execute([(int)$prestamo['id_usuario'], $id]);
            if ((int)$stmtCheckMora->fetchColumn() === 0) {
                $db->prepare("UPDATE usuarios SET estado = 'ACTIVO' WHERE id_usuario = ? AND estado = 'SANCIONADO'")->execute([(int)$prestamo['id_usuario']]);
            }

            // Si existe una reserva PENDIENTE para este libro, marcar la más antigua como DISPONIBLE
            try {
                $stmtResPend = $db->prepare("SELECT id_reserva, id_usuario FROM reservas WHERE id_libro = ? AND estado = 'PENDIENTE' ORDER BY id_reserva ASC LIMIT 1");
                $stmtResPend->execute([(int)$prestamo['id_libro']]);
                $nextReserva = $stmtResPend->fetch();
                if ($nextReserva) {
                    $db->prepare("UPDATE reservas SET estado = 'DISPONIBLE' WHERE id_reserva = ?")->execute([(int)$nextReserva['id_reserva']]);
                    Database::logEvent(
                        'RESERVA_DISPONIBLE',
                        "Reserva #{$nextReserva['id_reserva']} pasó a DISPONIBLE tras devolución del préstamo #{$id}.",
                        (int)$nextReserva['id_usuario']
                    );
                }
            } catch (Exception) {
                // Ignorar si la tabla reservas aún no existe en entornos legados
            }

            Database::logEvent(
                'DEVOLUCION_REGISTRADA',
                "Devolución recibida para préstamo #{$id}. " . ($esMora ? "Mora: {$diasMora} días (Multa: \${$multa})." : "Entrega a tiempo."),
                (int)$admin['id_usuario']
            );

            $db->commit();

            Response::json([
                'ok' => true,
                'mensaje' => $esMora ? "Devolución registrada con {$diasMora} días de retraso." : 'Devolución registrada a tiempo sin penalizaciones.',
                'dias_retraso' => $diasMora,
                'multa_total' => $multa,
            ]);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error('Error transaccional al registrar la devolución: ' . $e->getMessage(), 500);
        }
    }

    public function updatePrestamo(int $id): void {
        $admin = Auth::requireRole('ADMIN');
        $body = Response::getBody();
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM prestamos WHERE id_prestamo = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            Response::error('Préstamo no encontrado.', 404, 'LOAN_NOT_FOUND');
        }

        $fechaLimite = trim($body['fecha_limite'] ?? $existing['fecha_limite']);
        $estado = trim($body['estado'] ?? $existing['estado']);
        $multa = isset($body['multa_calculada']) ? (float)$body['multa_calculada'] : (float)$existing['multa_calculada'];

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaLimite)) {
            Response::error('El formato de fecha_limite debe ser YYYY-MM-DD.', 422, 'INVALID_DATE_FORMAT');
        }

        if (!in_array($estado, ['ACTIVO', 'DEVUELTO', 'MORA'], true)) {
            Response::error('Estado de préstamo inválido. Valores permitidos: ACTIVO, DEVUELTO, MORA.', 422, 'INVALID_STATUS');
        }

        if ($multa < 0) {
            Response::error('La multa calculada no puede ser negativa.', 422, 'INVALID_FINE');
        }

        if ($fechaLimite < $existing['fecha_prestamo']) {
            Response::error('La fecha límite no puede ser anterior a la fecha de préstamo.', 422, 'INVALID_DATE_RANGE');
        }

        $stmtUpdate = $db->prepare('UPDATE prestamos SET fecha_limite = ?, estado = ?, multa_calculada = ? WHERE id_prestamo = ?');
        $stmtUpdate->execute([$fechaLimite, $estado, $multa, $id]);

        Database::logEvent('PRESTAMO_ACTUALIZADO', "Préstamo #{$id} actualizado (Estado: {$estado}, Límite: {$fechaLimite}).", (int)$admin['id_usuario']);

        $this->getPrestamo($id);
    }

    public function deletePrestamo(int $id): void {
        $admin = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM prestamos WHERE id_prestamo = ?');
        $stmt->execute([$id]);
        $prestamo = $stmt->fetch();

        if (!$prestamo) {
            Response::error('Préstamo no encontrado.', 404, 'LOAN_NOT_FOUND');
        }

        $db->beginTransaction();
        try {
            // Si el préstamo estaba ACTIVO o en MORA y sin devolver, reponer el stock disponible
            if (empty($prestamo['fecha_entrega']) && in_array($prestamo['estado'], ['ACTIVO', 'MORA'], true)) {
                $db->prepare('UPDATE libros SET copias_disp = copias_disp + 1 WHERE id_libro = ?')->execute([(int)$prestamo['id_libro']]);
            }

            $db->prepare('DELETE FROM prestamos WHERE id_prestamo = ?')->execute([$id]);

            Database::logEvent('PRESTAMO_ELIMINADO', "Préstamo #{$id} eliminado por administración.", (int)$admin['id_usuario']);

            $db->commit();
            Response::json(['ok' => true, 'mensaje' => "Préstamo #{$id} eliminado exitosamente.", 'deleted_id' => $id]);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error('Error al eliminar el préstamo: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Renueva un préstamo activo extendiendo su fecha límite 8 días hábiles.
     * Reglas: solo dueño o ADMIN, máximo 2 renovaciones, sin mora ni reservas pendientes.
     */
    public function renovarPrestamo(int $id): void {
        $user = Auth::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM prestamos WHERE id_prestamo = ?');
        $stmt->execute([$id]);
        $prestamo = $stmt->fetch();

        if (!$prestamo) {
            Response::error('Préstamo no encontrado.', 404, 'LOAN_NOT_FOUND');
        }

        if ($user['rol'] !== 'ADMIN' && (int)$prestamo['id_usuario'] !== (int)$user['id_usuario']) {
            Response::error('No tiene permisos para renovar este préstamo.', 403, 'FORBIDDEN');
        }

        if (!empty($prestamo['fecha_entrega']) || $prestamo['estado'] === 'DEVUELTO') {
            Response::error('No se puede renovar un préstamo ya devuelto.', 409, 'LOAN_ALREADY_RETURNED');
        }

        $hoy = new DateTime();
        $fechaLimiteActual = new DateTime($prestamo['fecha_limite']);
        if ($prestamo['estado'] === 'MORA' || $hoy->format('Y-m-d') > $fechaLimiteActual->format('Y-m-d')) {
            Response::error('No se puede renovar un préstamo vencido o en mora.', 409, 'LOAN_OVERDUE');
        }

        $renovacionesActuales = (int)($prestamo['renovaciones'] ?? 0);
        if ($renovacionesActuales >= 2) {
            Response::error('Se alcanzó el límite máximo de 2 renovaciones para este préstamo.', 409, 'MAX_RENEWALS_REACHED');
        }

        // Verificar que no haya reservas pendientes para este libro
        try {
            $stmtRes = $db->prepare("SELECT COUNT(*) FROM reservas WHERE id_libro = ? AND estado = 'PENDIENTE'");
            $stmtRes->execute([(int)$prestamo['id_libro']]);
            if ((int)$stmtRes->fetchColumn() > 0) {
                Response::error('No es posible renovar porque existen reservas pendientes para este libro.', 409, 'BOOK_HAS_RESERVATIONS');
            }
        } catch (Exception) {
            // Ignorar si tabla reservas no existe
        }

        $nuevaFechaLimite = self::calcularFechaLimite($fechaLimiteActual, 8);
        $nuevasRenovaciones = $renovacionesActuales + 1;

        $db->prepare('UPDATE prestamos SET fecha_limite = ?, renovaciones = ? WHERE id_prestamo = ?')
            ->execute([$nuevaFechaLimite, $nuevasRenovaciones, $id]);

        Database::logEvent(
            'PRESTAMO_RENOVADO',
            "Préstamo #{$id} renovado ({$nuevasRenovaciones}/2). Nueva fecha límite: {$nuevaFechaLimite}.",
            (int)$user['id_usuario']
        );

        $this->getPrestamo($id);
    }
}

