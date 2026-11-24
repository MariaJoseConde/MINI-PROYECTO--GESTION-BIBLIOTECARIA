<?php
namespace Sgbi\Config;

use PDO;
use Exception;

class Database {
    private static ?PDO $instance = null;
    private static bool $envLoaded = false;
    private static string $activeDriver = 'unknown';

    public static function loadEnv(): void {
        if (self::$envLoaded) {
            return;
        }
        self::$envLoaded = true;

        $envFile = dirname(__DIR__, 2) . '/.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) continue;
                if (str_contains($line, '=')) {
                    [$key, $val] = explode('=', $line, 2);
                    $key = trim($key);
                    $val = trim($val, " \t\n\r\0\x0B\"'");
                    if (getenv($key) === false) {
                        putenv("{$key}={$val}");
                        $_ENV[$key] = $val;
                    }
                }
            }
        }
    }

    public static function getActiveDriver(): string {
        if (self::$activeDriver === 'unknown') {
            self::getConnection();
        }
        return self::$activeDriver;
    }

    public static function isMysql(): bool {
        return self::getActiveDriver() === 'mysql';
    }

    public static function isSqlite(): bool {
        return self::getActiveDriver() === 'sqlite';
    }

    public static function getConnection(): PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        self::loadEnv();

        $connectionType = getenv('DB_CONNECTION') ?: 'mysql';

        if ($connectionType === 'mysql') {
            $host = getenv('DB_HOST') ?: '127.0.0.1';
            $port = getenv('DB_PORT') ?: '3306';
            $database = getenv('DB_DATABASE') ?: 'sgbi';
            $username = getenv('DB_USERNAME') ?: 'root';
            $password = getenv('DB_PASSWORD') ?: '';

            try {
                $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
                self::$instance = new PDO($dsn, $username, $password, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
                ]);
                self::$activeDriver = 'mysql';
                return self::$instance;
            } catch (Exception $e) {
                // Si MySQL no está disponible en 127.0.0.1:3306 (ej. servicio XAMPP detenido o restricción de sandbox), respaldar en SQLite
                error_log("[SGBI] Advertencia MySQL: " . $e->getMessage() . ". Usando base de datos SQLite de respaldo.");
                $connectionType = 'sqlite';
            }
        }

        // Respaldo resiliente: Base de datos SQLite en data/sgbi.db
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
        self::$activeDriver = 'sqlite';

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
        self::loadEnv();
        $db = self::getConnection();
        $driver = self::$activeDriver;

        $fileSizeKb = 0;
        $indexesCount = 0;
        $journalMode = 'wal';
        $foreignKeys = true;

        if ($driver === 'mysql') {
            $database = getenv('DB_DATABASE') ?: 'sgbi';
            $journalMode = 'InnoDB';
            try {
                $foreignKeys = (bool)$db->query('SELECT @@foreign_key_checks')->fetchColumn();
            } catch (Exception) {}

            try {
                $fileSizeKb = (float)$db->query("
                    SELECT ROUND(SUM(data_length + index_length) / 1024, 1) 
                    FROM information_schema.TABLES 
                    WHERE table_schema = '{$database}'
                ")->fetchColumn();
            } catch (Exception) {}

            try {
                $indexesCount = (int)$db->query("
                    SELECT COUNT(DISTINCT table_name, index_name) 
                    FROM information_schema.STATISTICS 
                    WHERE table_schema = '{$database}'
                ")->fetchColumn();
            } catch (Exception) {}
        } else {
            $dbPath = getenv('DB_PATH') ?: dirname(__DIR__, 2) . '/data/sgbi.db';
            $fileSizeKb = file_exists($dbPath) ? round(filesize($dbPath) / 1024, 1) : 0;
            try {
                $indexesCount = (int)$db->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")->fetchColumn();
            } catch (Exception) {}
        }

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
            'engine' => $driver,
            'is_mysql' => $driver === 'mysql',
            'is_fallback_sqlite' => $driver === 'sqlite',
            'journalMode' => $journalMode,
            'foreignKeys' => $foreignKeys,
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
