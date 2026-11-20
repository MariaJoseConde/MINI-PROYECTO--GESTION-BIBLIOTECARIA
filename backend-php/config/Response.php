<?php
namespace Sgbi\Config;

class Response {
    private static ?string $requestId = null;

    public static function getRequestId(): string {
        if (self::$requestId === null) {
            self::$requestId = $_SERVER['HTTP_X_REQUEST_ID'] ?? bin2hex(random_bytes(8));
        }
        return self::$requestId;
    }

    public static function initCors(): void {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
        header("Access-Control-Allow-Origin: {$origin}");
        header("Access-Control-Allow-Credentials: true");
        header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Request-Id, Accept");
        header("Access-Control-Expose-Headers: X-API-Version, X-Request-Id, Location");
        header("Vary: Origin");
        header("X-API-Version: 1.0");
        header("X-Request-Id: " . self::getRequestId());
        // Cabeceras de seguridad para contexto de navegación confiable (W3C / RFC 6761)
        header("X-Content-Type-Options: nosniff");
        header("X-Frame-Options: SAMEORIGIN");
        header("Referrer-Policy: strict-origin-when-cross-origin");

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public static function json(mixed $data, int $status = 200, array $extraHeaders = []): void {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            header('X-API-Version: 1.0');
            header('X-Request-Id: ' . self::getRequestId());
            foreach ($extraHeaders as $key => $val) {
                header("{$key}: {$val}");
            }
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!defined('SGBI_TEST_RUNNING')) {
            exit;
        }
    }

    public static function created(mixed $data, ?string $location = null): void {
        $headers = [];
        if ($location !== null) {
            $headers['Location'] = $location;
        }
        self::json($data, 201, $headers);
    }

    public static function noContent(): void {
        if (!headers_sent()) {
            http_response_code(204);
            header('X-API-Version: 1.0');
            header('X-Request-Id: ' . self::getRequestId());
        }
        if (!defined('SGBI_TEST_RUNNING')) {
            exit;
        }
    }

    public static function error(string $message, int $status = 400, ?string $code = null, ?array $details = null): void {
        $payload = [
            'error' => $message,
            'status' => $status,
            'timestamp' => date('c'),
            'request_id' => self::getRequestId(),
        ];
        if ($code !== null) {
            $payload['code'] = $code;
        }
        if ($details !== null) {
            $payload['details'] = $details;
        }
        self::json($payload, $status);
    }

    public static function methodNotAllowed(array $allowedMethods): void {
        $allowHeader = implode(', ', $allowedMethods);
        if (!headers_sent()) {
            header("Allow: {$allowHeader}");
        }
        self::error("Método HTTP no permitido. Métodos permitidos: {$allowHeader}.", 405, 'METHOD_NOT_ALLOWED');
    }

    public static function html(string $html, int $status = 200): void {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: text/html; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
            header('X-Frame-Options: SAMEORIGIN');
        }
        echo $html;
        if (!defined('SGBI_TEST_RUNNING')) {
            exit;
        }
    }

    public static function getBody(): array {
        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            return [];
        }
        $data = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            self::error('El cuerpo de la solicitud no es un JSON válido.', 400, 'INVALID_JSON');
        }
        return is_array($data) ? $data : [];
    }
}
