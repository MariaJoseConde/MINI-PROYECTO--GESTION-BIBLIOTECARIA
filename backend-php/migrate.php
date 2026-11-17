<?php
/**
 * SGBI - Ejecutor de Migraciones y Verificación de Base de Datos MySQL
 * Ejecutar vía CLI: php backend-php/migrate.php
 */

declare(strict_types=1);

// Cargar variables de entorno desde .env si existe en la raíz
$envPath = dirname(__DIR__) . '/.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
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

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$database = getenv('DB_DATABASE') ?: 'sgbi';
$username = getenv('DB_USERNAME') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';

echo "========================================================\n";
echo " SGBI - Migrador y Verificador de Base de Datos MySQL\n";
echo "========================================================\n";
echo "Host:     {$host}:{$port}\n";
echo "Database: {$database}\n";
echo "User:     {$username}\n";
echo "--------------------------------------------------------\n";

try {
    // 1. Conexión al servidor MySQL (sin especificar base de datos inicial)
    $dsnServer = "mysql:host={$host};port={$port};charset=utf8mb4";
    $pdoServer = new PDO($dsnServer, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // 2. Crear base de datos de forma idempotente
    $pdoServer->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "[OK] Base de datos '{$database}' verificada/creada exitosamente.\n";

    // 3. Conexión a la base de datos específica
    $dsnDb = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
    $pdo = new PDO($dsnDb, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    ]);

    // 4. Asegurar tabla de control de migraciones
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `schema_migrations` (
            `id_migration` INT AUTO_INCREMENT PRIMARY KEY,
            `version` VARCHAR(50) NOT NULL UNIQUE,
            `description` VARCHAR(255) NOT NULL,
            `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 5. Aplicar migraciones ordenadas desde database/migrations/
    $migrationsDir = dirname(__DIR__) . '/database/migrations';
    if (is_dir($migrationsDir)) {
        $files = glob($migrationsDir . '/*.sql');
        sort($files);

        foreach ($files as $filePath) {
            $filename = basename($filePath);
            $version = pathinfo($filename, PATHINFO_FILENAME);

            // Verificar si ya fue aplicada
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM `schema_migrations` WHERE `version` = ?');
            $stmt->execute([$version]);
            $alreadyApplied = (int)$stmt->fetchColumn() > 0;

            if ($alreadyApplied) {
                echo "[SKIP] Migración ya aplicada: {$filename}\n";
                continue;
            }

            echo "[APPLY] Aplicando migración: {$filename}... ";
            $sql = file_get_contents($filePath);
            
            // Ejecutar sentencias del archivo
            $pdo->exec($sql);

            // Registrar en historial de migraciones
            $desc = "Ejecución de {$filename}";
            $insert = $pdo->prepare('INSERT INTO `schema_migrations` (`version`, `description`) VALUES (?, ?)');
            $insert->execute([$version, $desc]);

            echo "Completada.\n";
        }
    }

    // 6. Consulta de comprobación y verificación de integridad
    echo "--------------------------------------------------------\n";
    echo " Verificación del estado de tablas y conteo de datos:\n";
    echo "--------------------------------------------------------\n";

    $tables = ['libros', 'autores', 'categorias', 'salas', 'usuarios', 'prestamos', 'pruebas_lectura', 'logs_sistema'];
    $summary = [];
    foreach ($tables as $t) {
        try {
            $count = (int)$pdo->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
            $summary[$t] = $count;
            echo sprintf("  %-18s: %d registros\n", $t, $count);
        } catch (Exception $e) {
            echo sprintf("  %-18s: [ERROR: %s]\n", $t, $e->getMessage());
        }
    }

    // Comprobación de una consulta de negocio compleja (Join libros, autores y préstamos)
    $testQuery = $pdo->query("
        SELECT 
            l.id_libro, 
            l.titulo, 
            l.isbn,
            l.copias_totales,
            l.copias_disp,
            GROUP_CONCAT(a.nombre SEPARATOR ', ') AS autores,
            (SELECT COUNT(*) FROM prestamos p WHERE p.id_libro = l.id_libro AND p.estado = 'ACTIVO') AS prestamos_activos
        FROM libros l
        LEFT JOIN libro_autor la ON la.id_libro = l.id_libro
        LEFT JOIN autores a ON a.id_autor = la.id_autor
        GROUP BY l.id_libro
        ORDER BY l.id_libro ASC
        LIMIT 3
    ")->fetchAll();

    echo "--------------------------------------------------------\n";
    echo " Consulta de comprobación relacional (primeros 3 libros):\n";
    foreach ($testQuery as $row) {
        echo sprintf("  - [#%d] \"%s\" | ISBN: %s | Stock: %d/%d | Autores: %s | Préstamos activos: %d\n",
            $row['id_libro'],
            $row['titulo'],
            $row['isbn'],
            $row['copias_disp'],
            $row['copias_totales'],
            $row['autores'] ?? 'Sin autor',
            $row['prestamos_activos']
        );
    }

    echo "========================================================\n";
    echo "[EXITO] Base de datos MySQL configurada y funcionando al 100%.\n";
    echo "========================================================\n";

} catch (Exception $e) {
    echo "\n[ERROR CRITICO] " . $e->getMessage() . "\n";
    exit(1);
}
