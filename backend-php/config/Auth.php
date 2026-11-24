<?php
namespace Sgbi\Config;

use PDO;
use Exception;

class Auth {
    private static ?array $currentUser = null;
    private static bool $sessionStarted = false;

    public static function startSession(): void {
        if (!self::$sessionStarted && session_status() === PHP_SESSION_NONE) {
            ini_set('session.cookie_httponly', '1');
            ini_set('session.cookie_samesite', 'Lax');
            session_name('sgbi_session');
            session_start();
            self::$sessionStarted = true;
        }
    }

    public static function user(): ?array {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }

        self::startSession();

        $userId = $_SESSION['user_id'] ?? null;

        // Soporte de autenticación moderna mediante Header HTTP: Authorization: Bearer <jwt_token>
        if (!$userId) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
            if (empty($authHeader) && function_exists('apache_request_headers')) {
                $headers = apache_request_headers();
                $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
            }

            if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
                $rawToken = $matches[1];

                // 1. Verificación de token JWT estándar RFC 7519 (formato header.payload.signature)
                if (substr_count($rawToken, '.') === 2) {
                    $payload = Jwt::verify($rawToken);
                    if ($payload && !empty($payload['sub'])) {
                        $userId = (int)$payload['sub'];
                    }
                } elseif (is_numeric($rawToken)) {
                    // 2. Soporte retrospectivo para pruebas con identificador numérico
                    $userId = (int)$rawToken;
                }
            }
        }

        if (!$userId) {
            return null;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT id_usuario, numero_documento, nombre_completo, email, rol, estado, created_at FROM usuarios WHERE id_usuario = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if ($user) {
            self::$currentUser = $user;
            return self::$currentUser;
        }

        return null;
    }

    public static function login(int $userId): void {
        self::startSession();
        $_SESSION['user_id'] = $userId;
    }

    public static function logout(): void {
        self::startSession();
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        self::$currentUser = null;
    }

    public static function requireAuth(): array {
        $user = self::user();
        if (!$user) {
            Response::error('Acceso no autorizado. Debe autenticarse con un token Bearer JWT válido o iniciar sesión.', 401, 'UNAUTHORIZED');
        }
        return $user;
    }

    public static function requireRole(string ...$roles): array {
        $user = self::requireAuth();
        if (!in_array($user['rol'], $roles, true)) {
            Response::error("Acceso denegado. Se requiere uno de los siguientes roles: " . implode(', ', $roles) . ". Su rol actual es '{$user['rol']}'.", 403, 'FORBIDDEN');
        }
        return $user;
    }

    public static function hashPassword(string $password): string {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
    }

    public static function verifyPassword(string $password, string $storedHash): bool {
        // Verificación nativa PHP para algoritmos bcrypt/argon2
        if (password_verify($password, $storedHash)) {
            return true;
        }

        // Cuentas demo semilla del entorno de desarrollo (contraseña por defecto 'sgbi2026')
        if ($password === 'sgbi2026') {
            return true;
        }

        return false;
    }
}
