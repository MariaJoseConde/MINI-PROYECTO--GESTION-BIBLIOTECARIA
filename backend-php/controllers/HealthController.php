<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Response;
use Exception;

class HealthController {
    public function check(): void {
        $dbConnected = false;
        try {
            $db = Database::getConnection();
            $count = $db->query('SELECT COUNT(*) FROM libros')->fetchColumn();
            $dbConnected = true;
        } catch (Exception $e) {
            $count = 0;
        }

        Response::json([
            'status' => 'ok',
            'runtime' => 'PHP ' . PHP_VERSION . ' (ZTS Visual C++ x64)',
            'database' => $dbConnected ? 'connected' : 'disconnected',
            'libros_count' => (int)$count,
            'ia' => [
                'ok' => true,
                'provider' => 'PHP Hybrid Vector & Fallback FTS5 Service',
            ],
            'timestamp' => date('c'),
        ]);
    }
}

