<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Response;
use Exception;

class HealthController {
    public function check(): void {
        $dbConnected = false;
        $count = 0;
        try {
            $db = Database::getConnection();
            $count = $db->query('SELECT COUNT(*) FROM libros')->fetchColumn();
            $dbConnected = true;
        } catch (Exception $e) {
            $count = 0;
        }

        $engine = Database::getActiveDriver();

        Response::json([
            'status' => 'ok',
            'runtime' => 'PHP ' . PHP_VERSION,
            'database' => [
                'status' => $dbConnected ? 'connected' : 'disconnected',
                'engine' => $engine,
                'is_mysql' => Database::isMysql(),
                'is_fallback_sqlite' => Database::isSqlite(),
                'libros_count' => (int)$count,
            ],
            'ia' => [
                'ok' => true,
                'provider' => 'PHP Hybrid Vector & Fallback FTS5 Service',
            ],
            'timestamp' => date('c'),
        ]);
    }
}
