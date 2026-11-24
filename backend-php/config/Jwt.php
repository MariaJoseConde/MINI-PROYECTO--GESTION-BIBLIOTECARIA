<?php
/**
 * SGBI - Implementación Nativa de JSON Web Tokens (JWT) según RFC 7519
 * Algoritmo: HMAC-SHA256 (HS256)
 */

declare(strict_types=1);

namespace Sgbi\Config;

use Exception;

class Jwt {
    private static ?string $secretKey = null;

    /**
     * Obtiene la clave secreta para la firma criptográfica HMAC-SHA256
     */
    public static function getSecretKey(): string {
        if (self::$secretKey !== null) {
            return self::$secretKey;
        }

        Database::loadEnv();
        $secret = getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? null);

        // Clave de respaldo para entorno de desarrollo seguro
        if (empty($secret)) {
            $secret = 'sgbi_jwt_secret_key_sprint2_2026_super_secure_hash';
        }

        self::$secretKey = (string)$secret;
        return self::$secretKey;
    }

    /**
     * Codificación en Base64 URL-Safe sin padding
     */
    public static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Decodificación desde Base64 URL-Safe
     */
    public static function base64UrlDecode(string $data): string|false {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $padLen = 4 - $remainder;
            $data .= str_repeat('=', $padLen);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }

    /**
     * Genera un token JWT firmado criptográficamente
     *
     * @param array $payload Datos a incluir en el cuerpo del token
     * @param int $expiresIn Duración del token en segundos (por defecto 24h = 86400s)
     * @return string Token JWT en formato header.payload.signature
     */
    public static function generate(array $payload, int $expiresIn = 86400): string {
        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256',
        ];

        $now = time();
        $fullPayload = array_merge([
            'iss' => 'sgbi-api',
            'iat' => $now,
            'exp' => $now + $expiresIn,
        ], $payload);

        $headerEncoded = self::base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $payloadEncoded = self::base64UrlEncode(json_encode($fullPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        $signature = hash_hmac('sha256', "{$headerEncoded}.{$payloadEncoded}", self::getSecretKey(), true);
        $signatureEncoded = self::base64UrlEncode($signature);

        return "{$headerEncoded}.{$payloadEncoded}.{$signatureEncoded}";
    }

    /**
     * Valida la firma y vigencia de un token JWT
     *
     * @param string $token Token JWT a verificar
     * @return array|null Retorna el payload decodificado si es válido, o null si es inválido/expirado
     */
    public static function verify(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$headerB64, $payloadB64, $signatureB64] = $parts;

        // Validar cabecera
        $headerJson = self::base64UrlDecode($headerB64);
        if ($headerJson === false) {
            return null;
        }
        $header = json_decode($headerJson, true);
        if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
            return null;
        }

        // Verificar firma digital mediante hash_equals (mitiga timing attacks)
        $expectedSignature = hash_hmac('sha256', "{$headerB64}.{$payloadB64}", self::getSecretKey(), true);
        $providedSignature = self::base64UrlDecode($signatureB64);
        if ($providedSignature === false || !hash_equals($expectedSignature, $providedSignature)) {
            return null;
        }

        // Validar payload y tiempo de expiración
        $payloadJson = self::base64UrlDecode($payloadB64);
        if ($payloadJson === false) {
            return null;
        }
        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return null;
        }

        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Token expirado
        }

        return $payload;
    }
}
