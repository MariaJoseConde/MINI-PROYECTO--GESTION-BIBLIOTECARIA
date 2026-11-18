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
}

