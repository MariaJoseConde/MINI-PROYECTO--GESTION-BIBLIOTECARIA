<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Auth;
use Sgbi\Config\Response;

class AuthController {
    public function me(): void {
        $user = Auth::user();
        Response::json(['user' => $user]);
    }

    public function login(): void {
        $body = Response::getBody();
        $email = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (empty($email) || empty($password)) {
            Response::error('Debe ingresar correo institucional y contraseña.', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if (!$row || !Auth::verifyPassword($password, $row['password_hash'])) {
            Database::logEvent('LOGIN_FALLIDO', "Intento fallido de inicio de sesión para {$email}.");
            Response::error('Credenciales inválidas. Verifique correo y contraseña.', 401);
        }

        Auth::login((int)$row['id_usuario']);

        Database::logEvent(
            'LOGIN_EXITOSO',
            "Sesión iniciada ({$row['rol']}): {$row['nombre_completo']}.",
            (int)$row['id_usuario']
        );

        unset($row['password_hash']);
        Response::json(['user' => $row]);
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
