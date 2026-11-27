<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Auth;
use Sgbi\Config\Response;
use Exception;

class SalasController {
    public function listSalas(): void {
        $db = Database::getConnection();
        $stmt = $db->query('SELECT * FROM salas ORDER BY nombre ASC');
        $salas = $stmt->fetchAll();
        foreach ($salas as &$s) {
            $s['id_sala'] = (int)$s['id_sala'];
            $s['capacidad'] = (int)$s['capacidad'];
        }
        Response::json([
            'salas' => $salas,
            'total' => count($salas),
        ]);
    }

    public function getSala(int $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM salas WHERE id_sala = ?');
        $stmt->execute([$id]);
        $sala = $stmt->fetch();

        if (!$sala) {
            Response::error('Sala no encontrada.', 404, 'SALA_NOT_FOUND');
        }

        $sala['id_sala'] = (int)$sala['id_sala'];
        $sala['capacidad'] = (int)$sala['capacidad'];

        Response::json(['sala' => $sala]);
    }

    public function createSala(): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();

        $nombre = trim($body['nombre'] ?? '');
        $descripcion = trim($body['descripcion'] ?? '') ?: null;
        $capacidadRaw = $body['capacidad'] ?? 30;
        $capacidad = filter_var($capacidadRaw, FILTER_VALIDATE_INT);

        if (empty($nombre)) {
            Response::error('El nombre de la sala es obligatorio.', 422, 'VALIDATION_ERROR', ['nombre' => 'Campo requerido']);
        }
        if ($capacidad === false || $capacidad < 1 || $capacidad > 1000) {
            Response::error('La capacidad de la sala debe estar entre 1 y 1000 personas.', 422, 'VALIDATION_ERROR', ['capacidad' => 'Rango permitido: 1 a 1000']);
        }

        $db = Database::getConnection();
        try {
            $stmt = $db->prepare('INSERT INTO salas (nombre, descripcion, capacidad) VALUES (?, ?, ?)');
            $stmt->execute([$nombre, $descripcion, $capacidad]);
            $id = (int)$db->lastInsertId();

            $stmtGet = $db->prepare('SELECT * FROM salas WHERE id_sala = ?');
            $stmtGet->execute([$id]);
            $sala = $stmtGet->fetch();
            $sala['id_sala'] = (int)$sala['id_sala'];
            $sala['capacidad'] = (int)$sala['capacidad'];

            Database::logEvent('SALA_CREADA', "Sala creada: \"{$nombre}\" (capacidad {$capacidad}).", (int)$user['id_usuario']);
            Response::created(['sala' => $sala], "/api/v1/salas/{$id}");
        } catch (Exception $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), 'Duplicate') || str_contains($e->getMessage(), 'UNIQUE')) {
                Response::error("Ya existe una sala registrada con el nombre \"{$nombre}\".", 409, 'DUPLICATE_RESOURCE');
            }
            Response::error('Error al crear la sala: ' . $e->getMessage(), 500);
        }
    }

    public function updateSala(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();

        $db = Database::getConnection();
        $stmtExisting = $db->prepare('SELECT * FROM salas WHERE id_sala = ?');
        $stmtExisting->execute([$id]);
        $existing = $stmtExisting->fetch();

        if (!$existing) {
            Response::error('Sala no encontrada.', 404, 'SALA_NOT_FOUND');
        }

        $nombre = trim($body['nombre'] ?? $existing['nombre']);
        $descripcion = array_key_exists('descripcion', $body) ? ($body['descripcion'] ?: null) : $existing['descripcion'];
        $capacidad = isset($body['capacidad']) ? max(1, (int)$body['capacidad']) : (int)$existing['capacidad'];

        if (empty($nombre)) {
            Response::error('El nombre de la sala no puede estar vacío.', 422, 'VALIDATION_ERROR');
        }

        try {
            $stmt = $db->prepare('UPDATE salas SET nombre = ?, descripcion = ?, capacidad = ? WHERE id_sala = ?');
            $stmt->execute([$nombre, $descripcion, $capacidad, $id]);

            $stmtGet = $db->prepare('SELECT * FROM salas WHERE id_sala = ?');
            $stmtGet->execute([$id]);
            $sala = $stmtGet->fetch();
            $sala['id_sala'] = (int)$sala['id_sala'];
            $sala['capacidad'] = (int)$sala['capacidad'];

            Database::logEvent('SALA_ACTUALIZADA', "Sala actualizada: \"{$nombre}\" (ID {$id}).", (int)$user['id_usuario']);
            Response::json(['sala' => $sala]);
        } catch (Exception $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), 'Duplicate') || str_contains($e->getMessage(), 'UNIQUE')) {
                Response::error("Ya existe otra sala con el nombre \"{$nombre}\".", 409, 'DUPLICATE_RESOURCE');
            }
            Response::error('Error al actualizar la sala: ' . $e->getMessage(), 500);
        }
    }

    public function deleteSala(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM salas WHERE id_sala = ?');
        $stmt->execute([$id]);
        $sala = $stmt->fetch();

        if (!$sala) {
            Response::error('Sala no encontrada.', 404, 'SALA_NOT_FOUND');
        }

        $db->prepare('DELETE FROM salas WHERE id_sala = ?')->execute([$id]);
        Database::logEvent('SALA_ELIMINADA', "Sala eliminada: \"{$sala['nombre']}\" (ID {$id}).", (int)$user['id_usuario']);
        Response::json(['ok' => true, 'deleted_id' => $id]);
    }
}
