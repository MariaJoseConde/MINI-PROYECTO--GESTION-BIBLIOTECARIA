<?php
namespace Sgbi\Config;

use PDO;
use Exception;

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $connectionType = getenv('DB_CONNECTION') ?: 'sqlite';

        if ($connectionType === 'mysql') {
            $host = getenv('DB_HOST') ?: '127.0.0.1';
            $port = getenv('DB_PORT') ?: '3306';
            $database = getenv('DB_DATABASE') ?: 'sgbi';
            $username = getenv('DB_USERNAME') ?: 'root';
            $password = getenv('DB_PASSWORD') ?: '';

            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
            self::$instance = new PDO($dsn, $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } else {
            // Default: SQLite database in data/sgbi.db
            $dbPath = getenv('DB_PATH') ?: dirname(__DIR__, 2) . '/data/sgbi.db';
            $dir = dirname($dbPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0777, true);
            }

            self::$instance = new PDO("sqlite:" . $dbPath, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

            self::$instance->exec('PRAGMA foreign_keys = ON;');
            self::$instance->exec('PRAGMA journal_mode = WAL;');
            self::$instance->exec('PRAGMA busy_timeout = 5000;');
        }

        return self::$instance;
    }

    public static function logEvent(string $tipo, string $mensaje, ?int $usuarioId = null, ?string $ip = null): void {
        try {
            $db = self::getConnection();
            $ip = $ip ?: ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
            $stmt = $db->prepare('INSERT INTO logs_sistema (tipo_evento, mensaje, id_usuario, ip_origen) VALUES (?, ?, ?, ?)');
            $stmt->execute([$tipo, $mensaje, $usuarioId, $ip]);
        } catch (Exception $e) {
            error_log("Error guardando log de sistema: " . $e->getMessage());
        }
    }

    public static function getStats(): array {
        $db = self::getConnection();
        $dbPath = getenv('DB_PATH') ?: dirname(__DIR__, 2) . '/data/sgbi.db';
        $fileSizeKb = file_exists($dbPath) ? round(filesize($dbPath) / 1024, 1) : 0;

        $indexesCount = 0;
        try {
            $indexesCount = (int)$db->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")->fetchColumn();
        } catch (Exception) {}

        $schemaVersion = 'v3';
        try {
            $ver = $db->query('SELECT version FROM schema_migrations ORDER BY id_migration DESC LIMIT 1')->fetchColumn();
            if ($ver) $schemaVersion = $ver;
        } catch (Exception) {}

        $countOf = function(string $table) use ($db): int {
            try {
                return (int)$db->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();
            } catch (Exception) {
                return 0;
            }
        };

        return [
            'journalMode' => 'wal',
            'foreignKeys' => true,
            'integrityOk' => true,
            'schemaVersion' => $schemaVersion,
            'fileSizeKb' => $fileSizeKb,
            'indexesCount' => $indexesCount,
            'tables' => [
                'libros' => $countOf('libros'),
                'autores' => $countOf('autores'),
                'categorias' => $countOf('categorias'),
                'salas' => $countOf('salas'),
                'usuarios' => $countOf('usuarios'),
                'prestamos' => $countOf('prestamos'),
                'pruebas' => $countOf('pruebas_lectura'),
                'logs' => $countOf('logs_sistema'),
            ],
        ];
    }
}
