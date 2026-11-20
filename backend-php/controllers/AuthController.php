<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Auth;
use Sgbi\Config\Response;

class AuthController {
    public function me(): void {
        $user = Auth::user();
        if (!$user) {
            Response::error('No autenticado. Inicie sesión.', 401, 'UNAUTHORIZED');
        }
        Response::json(['user' => $user]);
    }

    public function register(): void {
        $body = Response::getBody();
        $doc = trim($body['numero_documento'] ?? '');
        $nombre = trim($body['nombre_completo'] ?? '');
        $email = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (empty($doc) || empty($nombre) || empty($email) || empty($password)) {
            Response::error('Todos los campos son obligatorios: numero_documento, nombre_completo, email y password.', 400, 'VALIDATION_ERROR');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('El formato del correo electrónico es inválido.', 422, 'INVALID_EMAIL');
        }

        if (strlen($password) < 6) {
            Response::error('La contraseña debe tener un mínimo de 6 caracteres.', 422, 'PASSWORD_TOO_SHORT');
        }

        $db = Database::getConnection();

        // Verificar duplicidad de email o documento
        $check = $db->prepare('SELECT id_usuario, email, numero_documento FROM usuarios WHERE LOWER(email) = LOWER(?) OR numero_documento = ?');
        $check->execute([$email, $doc]);
        $existing = $check->fetch();

        if ($existing) {
            if (strtolower($existing['email']) === strtolower($email)) {
                Response::error("El correo electrónico '{$email}' ya se encuentra registrado.", 409, 'EMAIL_ALREADY_EXISTS');
            } else {
                Response::error("El número de documento '{$doc}' ya se encuentra registrado.", 409, 'DOCUMENT_ALREADY_EXISTS');
            }
        }

        $hash = Auth::hashPassword($password);
        $rol = 'LECTOR';
        $estado = 'ACTIVO';

        $stmt = $db->prepare("
            INSERT INTO usuarios (numero_documento, nombre_completo, email, password_hash, rol, estado)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$doc, $nombre, $email, $hash, $rol, $estado]);
        $newId = (int)$db->lastInsertId();

        // Autenticar la sesión del nuevo usuario
        Auth::login($newId);

        Database::logEvent('USUARIO_REGISTRADO', "Nuevo registro de lector: {$nombre} ({$email}).", $newId);

        $stmtUser = $db->prepare('SELECT id_usuario, numero_documento, nombre_completo, email, rol, estado, created_at FROM usuarios WHERE id_usuario = ?');
        $stmtUser->execute([$newId]);
        $newUser = $stmtUser->fetch();
        $newUser['id_usuario'] = (int)$newUser['id_usuario'];

        Response::created([
            'mensaje' => 'Usuario registrado exitosamente en el sistema bibliotecario.',
            'user' => $newUser,
            'token' => (string)$newId,
        ], "/api/usuarios/{$newId}");
    }

    public function login(): void {
        $body = Response::getBody();
        $email = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (empty($email) || empty($password)) {
            Response::error('Debe ingresar correo institucional y contraseña.', 400, 'VALIDATION_ERROR');
        }

        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if (!$row || !Auth::verifyPassword($password, $row['password_hash'])) {
            Database::logEvent('LOGIN_FALLIDO', "Intento fallido de inicio de sesión para {$email}.");
            Response::error('Credenciales inválidas. Verifique correo y contraseña.', 401, 'INVALID_CREDENTIALS');
        }

        if ($row['estado'] === 'INACTIVO') {
            Response::error('La cuenta se encuentra inactiva. Contacte al bibliotecario.', 403, 'ACCOUNT_INACTIVE');
        }

        Auth::login((int)$row['id_usuario']);

        Database::logEvent(
            'LOGIN_EXITOSO',
            "Sesión iniciada ({$row['rol']}): {$row['nombre_completo']}.",
            (int)$row['id_usuario']
        );

        unset($row['password_hash']);
        $row['id_usuario'] = (int)$row['id_usuario'];

        Response::json([
            'mensaje' => 'Autenticación exitosa.',
            'user' => $row,
            'token' => (string)$row['id_usuario'],
        ]);
    }

    public function logout(): void {
        $user = Auth::user();
        if ($user) {
            Database::logEvent(
                'LOGOUT',
                "Cierre de sesión de {$user['nombre_completo']}.",
                (int)$user['id_usuario']
            );
        }
        Auth::logout();
        Response::json(['ok' => true]);
    }
}

