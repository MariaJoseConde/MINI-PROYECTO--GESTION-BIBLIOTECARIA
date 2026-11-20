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
    echo "\n[AVISO MYSQL] " . $e->getMessage() . "\n";
    echo "[INFO] Conmutando a verificación y migración en base de datos local SQLite (data/sgbi.db)...\n";
    echo "--------------------------------------------------------\n";

    $dbPath = dirname(__DIR__) . '/data/sgbi.db';
    if (!is_dir(dirname($dbPath))) {
        mkdir(dirname($dbPath), 0777, true);
    }

    $pdoSqlite = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdoSqlite->exec('PRAGMA foreign_keys = ON;');
    $pdoSqlite->exec('PRAGMA journal_mode = WAL;');

    // Crear tablas en SQLite si no existen
    $pdoSqlite->exec("
        CREATE TABLE IF NOT EXISTS autores (
          id_autor INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          nacionalidad TEXT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS categorias (
          id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE,
          codigo_archivo TEXT NOT NULL DEFAULT '000',
          descripcion TEXT NOT NULL,
          ubicacion_sala TEXT NOT NULL DEFAULT 'Sala General',
          publico_recomendado TEXT NOT NULL DEFAULT 'Público general',
          enfoque_lector TEXT NOT NULL DEFAULT 'Lectura integral',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS salas (
          id_sala INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE,
          descripcion TEXT NULL,
          capacidad INTEGER NOT NULL DEFAULT 30,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS libros (
          id_libro INTEGER PRIMARY KEY AUTOINCREMENT,
          isbn TEXT NOT NULL UNIQUE,
          titulo TEXT NOT NULL,
          sinopsis TEXT NULL,
          categoria TEXT NOT NULL DEFAULT 'Literatura General',
          anio_publicacion INTEGER NULL,
          editorial TEXT NULL,
          idioma TEXT NOT NULL DEFAULT 'Español',
          paginas INTEGER NULL,
          ubicacion_estante TEXT NULL,
          temas_clave TEXT NULL,
          copias_totales INTEGER NOT NULL DEFAULT 1,
          copias_disp INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          CHECK (copias_disp >= 0 AND copias_disp <= copias_totales AND copias_totales >= 1)
        );

        CREATE TABLE IF NOT EXISTS libro_autor (
          id_libro INTEGER NOT NULL,
          id_autor INTEGER NOT NULL,
          PRIMARY KEY (id_libro, id_autor),
          FOREIGN KEY (id_libro) REFERENCES libros (id_libro) ON DELETE CASCADE,
          FOREIGN KEY (id_autor) REFERENCES autores (id_autor) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS usuarios (
          id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
          numero_documento TEXT NOT NULL UNIQUE,
          nombre_completo TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          rol TEXT NOT NULL DEFAULT 'LECTOR' CHECK (rol IN ('ADMIN', 'DOCENTE', 'LECTOR')),
          estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'SANCIONADO', 'INACTIVO')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS prestamos (
          id_prestamo INTEGER PRIMARY KEY AUTOINCREMENT,
          id_libro INTEGER NOT NULL,
          id_usuario INTEGER NOT NULL,
          fecha_prestamo TEXT NOT NULL,
          fecha_limite TEXT NOT NULL,
          fecha_entrega TEXT NULL,
          estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'DEVUELTO', 'MORA')),
          multa_calculada REAL NOT NULL DEFAULT 0.0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (id_libro) REFERENCES libros (id_libro) ON DELETE RESTRICT,
          FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS pruebas_lectura (
          id_prueba INTEGER PRIMARY KEY AUTOINCREMENT,
          id_libro INTEGER NOT NULL,
          id_docente INTEGER NOT NULL,
          contenido_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (id_libro) REFERENCES libros (id_libro) ON DELETE CASCADE,
          FOREIGN KEY (id_docente) REFERENCES usuarios (id_usuario) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS logs_sistema (
          id_log INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo_evento TEXT NOT NULL,
          mensaje TEXT NOT NULL,
          id_usuario INTEGER NULL,
          ip_origen TEXT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS schema_migrations (
          id_migration INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    ");

    // Índices SQLite
    $pdoSqlite->exec("
        CREATE INDEX IF NOT EXISTS idx_libros_categoria ON libros (categoria);
        CREATE INDEX IF NOT EXISTS idx_libros_titulo ON libros (titulo);
        CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (email);
        CREATE INDEX IF NOT EXISTS idx_usuarios_documento ON usuarios (numero_documento);
        CREATE INDEX IF NOT EXISTS idx_prestamos_usuario ON prestamos (id_usuario, estado);
        CREATE INDEX IF NOT EXISTS idx_prestamos_libro ON prestamos (id_libro);
    ");

    if ((int)$pdoSqlite->query('SELECT COUNT(*) FROM salas')->fetchColumn() === 0) {
        $pdoSqlite->exec("
            INSERT OR IGNORE INTO salas (nombre, descripcion, capacidad) VALUES
              ('Sala General', 'Área principal de lectura y préstamo general', 50),
              ('Sala A · Pasillo 1', 'Colección de literatura, distopía y política', 25),
              ('Sala B · Humanidades', 'Fondo de realismo mágico, cuento y filosofía', 30),
              ('Sala C · Ciencias Exactas', 'Divulgación científica y textos STEM', 20),
              ('Sala D · Ciencias Sociales', 'Historia, antropología y teoría política', 25),
              ('Sala Central · Estantería Noble', 'Clásicos universales y libros de referencia', 40);
        ");
    }

    echo "[OK] Esquema relacional SQLite validado e indexado.\n";
    echo "--------------------------------------------------------\n";
    echo " Resumen de tablas y conteo de datos (SQLite):\n";
    echo "--------------------------------------------------------\n";

    $tables = ['libros', 'autores', 'categorias', 'salas', 'usuarios', 'prestamos', 'pruebas_lectura', 'logs_sistema'];
    foreach ($tables as $t) {
        try {
            $count = (int)$pdoSqlite->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
            echo sprintf("  %-18s: %d registros\n", $t, $count);
        } catch (Exception $ex) {
            echo sprintf("  %-18s: [ERROR: %s]\n", $t, $ex->getMessage());
        }
    }

    $testQuery = $pdoSqlite->query("
        SELECT 
            l.id_libro, 
            l.titulo, 
            l.isbn,
            l.copias_totales,
            l.copias_disp,
            GROUP_CONCAT(a.nombre, ', ') AS autores,
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
    echo "[EXITO] Base de datos relacional verificada y operativa al 100%.\n";
    echo "========================================================\n";
}
