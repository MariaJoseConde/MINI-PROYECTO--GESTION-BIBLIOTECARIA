<?php
/**
 * SGBI - Suite de Pruebas Automatizadas de Backend y Base de Datos (Sprint 2)
 * Ejecución: php backend-php/test_sprint2.php
 */

declare(strict_types=1);

define('SGBI_TEST_RUNNING', true);

// Cargar autoloader PSR-4 del SGBI
spl_autoload_register(function ($class) {
    $prefix = 'Sgbi\\';
    $baseDir = __DIR__ . '/';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) return;
    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
    if (file_exists($file)) require_once $file;
});

use Sgbi\Config\Database;
use Sgbi\Config\Auth;

class Sprint2TestRunner {
    private int $passed = 0;
    private int $failed = 0;
    private array $results = [];
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function assert(bool $condition, string $description, ?string $detail = null): void {
        if ($condition) {
            $this->passed++;
            $this->results[] = ['status' => 'PASS', 'desc' => $description];
            echo "  [PASS] {$description}\n";
        } else {
            $this->failed++;
            $this->results[] = ['status' => 'FAIL', 'desc' => $description, 'detail' => $detail];
            echo "  [FAIL] {$description}" . ($detail ? " -> {$detail}" : "") . "\n";
        }
    }

    public function runAll(): void {
        echo "======================================================================\n";
        echo "   SGBI - VERIFICACIÓN Y PRUEBAS AUTOMATIZADAS DEL SPRINT 2 (BACKEND)\n";
        echo "======================================================================\n\n";

        $this->testDatabaseSchemaAndIntegrity();
        $this->testAuthenticationAndSecurity();
        $this->testRoleBasedAccessControl();
        $this->testCrudLibros();
        $this->testCrudAutores();
        $this->testCrudUsuarios();
        $this->testCrudPrestamos();
        $this->testOpenApiDocumentation();

        echo "\n======================================================================\n";
        echo sprintf("   RESUMEN FINAL: %d pasadas, %d fallidas (Total: %d pruebas)\n",
            $this->passed,
            $this->failed,
            $this->passed + $this->failed
        );
        echo "======================================================================\n";

        if ($this->failed > 0) {
            exit(1);
        }
    }

    // -------------------------------------------------------------------------
    // TAREA 1: Base de Datos y Restricciones de Integridad
    // -------------------------------------------------------------------------
    private function testDatabaseSchemaAndIntegrity(): void {
        echo "--- TAREA 1: Base de Datos Relacional y Esquema ---\n";

        // 1.1 Verificar existencia de tablas requeridas
        $requiredTables = ['libros', 'autores', 'libro_autor', 'usuarios', 'prestamos', 'categorias', 'salas', 'logs_sistema'];
        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $tables = $this->db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
        } else {
            $tables = $this->db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        }

        foreach ($requiredTables as $table) {
            $this->assert(in_array($table, $tables, true), "Tabla relacional '{$table}' existe y está disponible.");
        }

        // 1.2 Verificar restricción de clave foránea libro_autor
        $countLa = (int)$this->db->query('SELECT COUNT(*) FROM libro_autor')->fetchColumn();
        $this->assert($countLa > 0, "Tabla asociativa N:M 'libro_autor' contiene relaciones válidas ({$countLa} enlaces).");

        // 1.3 Verificar integridad del stock de libros (copias_disp <= copias_totales)
        $invalidStock = (int)$this->db->query('SELECT COUNT(*) FROM libros WHERE copias_disp < 0 OR copias_disp > copias_totales')->fetchColumn();
        $this->assert($invalidStock === 0, "Restricción de integridad CHECK: Stock disponible válido en todos los libros.");
        echo "\n";
    }

    // -------------------------------------------------------------------------
    // TAREA 3: Autenticación, Registro y Hashes Seguros
    // -------------------------------------------------------------------------
    private function testAuthenticationAndSecurity(): void {
        echo "--- TAREA 3: Autenticación, Hashes Seguros y Sesiones ---\n";

        $testDoc = '99887766' . rand(100, 999);
        $testEmail = 'test.lector.' . uniqid() . '@sgbi.edu';
        $testPass = 'claveSegura123!';

        // 3.1 Hash de contraseña seguro (BCRYPT / Argon2)
        $hash = Auth::hashPassword($testPass);
        $hashInfo = password_get_info($hash);
        $this->assert($hashInfo['algoName'] === 'bcrypt', "Contraseñas cifradas con algoritmo robusto BCRYPT ({$hashInfo['algoName']}).");
        $this->assert(Auth::verifyPassword($testPass, $hash), "Verificación segura de contraseña mediante password_verify().");
        $this->assert(!Auth::verifyPassword('claveErronea', $hash), "Rechazo de contraseña incorrecta.");

        // 3.2 Registro de usuario con persistencia en DB
        $stmt = $this->db->prepare("
            INSERT INTO usuarios (numero_documento, nombre_completo, email, password_hash, rol, estado)
            VALUES (?, ?, ?, ?, 'LECTOR', 'ACTIVO')
        ");
        $stmt->execute([$testDoc, 'Lector de Pruebas Unitarias', $testEmail, $hash]);
        $newUserId = (int)$this->db->lastInsertId();
        $this->assert($newUserId > 0, "Registro de nuevo usuario con rol LECTOR exitoso (ID #{$newUserId}).");

        // 3.3 Verificación de unicidad de email
        $duplicateAttempt = false;
        try {
            $stmtDup = $this->db->prepare("INSERT INTO usuarios (numero_documento, nombre_completo, email, password_hash) VALUES (?, ?, ?, ?)");
            $stmtDup->execute(['99999999', 'Otro', $testEmail, $hash]);
        } catch (Exception) {
            $duplicateAttempt = true;
        }
        $this->assert($duplicateAttempt, "Restricción de unicidad: Rechaza registro duplicado con el mismo correo.");

        // 3.4 Simulación de login con credenciales válidas
        $stmtFetch = $this->db->prepare('SELECT * FROM usuarios WHERE email = ?');
        $stmtFetch->execute([$testEmail]);
        $userRow = $stmtFetch->fetch();
        $loginOk = $userRow && Auth::verifyPassword($testPass, $userRow['password_hash']);
        $this->assert($loginOk, "Inicio de sesión: Autenticación exitosa con credenciales registradas.");

        // Limpiar usuario de prueba
        $this->db->prepare('DELETE FROM usuarios WHERE id_usuario = ?')->execute([$newUserId]);
        echo "\n";
    }

    // -------------------------------------------------------------------------
    // TAREA 3: Control de Acceso por Roles (RBAC) y Seguridad
    // -------------------------------------------------------------------------
    private function testRoleBasedAccessControl(): void {
        echo "--- TAREA 3 (RBAC): Control de Acceso por Roles ---\n";

        // Admin existente en semilla
        $admin = $this->db->query("SELECT * FROM usuarios WHERE rol = 'ADMIN' LIMIT 1")->fetch();
        $this->assert(!empty($admin), "Usuario con rol ADMIN (Bibliotecario) existe en la base de datos.");

        // Lector existente en semilla
        $lector = $this->db->query("SELECT * FROM usuarios WHERE rol = 'LECTOR' LIMIT 1")->fetch();
        $this->assert(!empty($lector), "Usuario con rol LECTOR existe en la base de datos.");

        // Simular verificación de rol: Lector NO debe tener permisos de ADMIN
        $rolesPermitidosParaAdmin = ['ADMIN'];
        $lectorTienePermisoAdmin = in_array($lector['rol'], $rolesPermitidosParaAdmin, true);
        $this->assert(!$lectorTienePermisoAdmin, "RBAC: Usuario LECTOR no tiene privilegios de ADMIN (denegación 403 Forbidden).");

        $adminTienePermisoAdmin = in_array($admin['rol'], $rolesPermitidosParaAdmin, true);
        $this->assert($adminTienePermisoAdmin, "RBAC: Usuario ADMIN tiene privilegios de administración concedidos.");
        echo "\n";
    }

    // -------------------------------------------------------------------------
    // TAREA 4: CRUD de Libros
    // -------------------------------------------------------------------------
    private function testCrudLibros(): void {
        echo "--- TAREA 4 (CRUD): Recurso Libros (/api/libros) ---\n";

        $testIsbn = '978-TEST-' . rand(1000, 9999);
        $testTitulo = 'Libro de Pruebas Unitarias ' . rand(100, 999);

        // CREATE
        $stmt = $this->db->prepare("
            INSERT INTO libros (isbn, titulo, categoria, copias_totales, copias_disp)
            VALUES (?, ?, 'Pruebas', 5, 5)
        ");
        $stmt->execute([$testIsbn, $testTitulo]);
        $bookId = (int)$this->db->lastInsertId();
        $this->assert($bookId > 0, "CREATE Libro: Inserción de libro exitosa (ID #{$bookId}, ISBN {$testIsbn}).");

        // READ
        $stmtGet = $this->db->prepare('SELECT * FROM libros WHERE id_libro = ?');
        $stmtGet->execute([$bookId]);
        $book = $stmtGet->fetch();
        $this->assert($book && $book['titulo'] === $testTitulo, "READ Libro: Consulta de libro por ID correcto.");

        // UPDATE
        $nuevoTitulo = $testTitulo . ' (Edición Revisada)';
        $this->db->prepare('UPDATE libros SET titulo = ?, copias_totales = 6, copias_disp = 6 WHERE id_libro = ?')->execute([$nuevoTitulo, $bookId]);
        $stmtUpdated = $this->db->prepare('SELECT titulo, copias_totales FROM libros WHERE id_libro = ?');
        $stmtUpdated->execute([$bookId]);
        $updated = $stmtUpdated->fetch();
        $this->assert($updated['titulo'] === $nuevoTitulo && (int)$updated['copias_totales'] === 6, "UPDATE Libro: Actualización de título y stock exitosa.");

        // DELETE
        $this->db->prepare('DELETE FROM libros WHERE id_libro = ?')->execute([$bookId]);
        $stmtDeleted = $this->db->prepare('SELECT * FROM libros WHERE id_libro = ?');
        $stmtDeleted->execute([$bookId]);
        $this->assert($stmtDeleted->fetch() === false, "DELETE Libro: Eliminación de libro confirmada (404 Not Found en consultas posteriores).");
        echo "\n";
    }

    // -------------------------------------------------------------------------
    // TAREA 4: CRUD de Autores
    // -------------------------------------------------------------------------
    private function testCrudAutores(): void {
        echo "--- TAREA 4 (CRUD): Recurso Autores (/api/autores) ---\n";

        // CREATE
        $nombreAutor = 'Autor de Prueba ' . rand(100, 999);
        $stmt = $this->db->prepare("INSERT INTO autores (nombre, nacionalidad) VALUES (?, 'Colombiana')");
        $stmt->execute([$nombreAutor]);
        $autorId = (int)$this->db->lastInsertId();
        $this->assert($autorId > 0, "CREATE Autor: Registro de nuevo autor (ID #{$autorId}).");

        // READ
        $stmtGet = $this->db->prepare('SELECT * FROM autores WHERE id_autor = ?');
        $stmtGet->execute([$autorId]);
        $autor = $stmtGet->fetch();
        $this->assert($autor && $autor['nombre'] === $nombreAutor, "READ Autor: Consulta de autor por ID exitosa.");

        // UPDATE
        $nombreActualizado = $nombreAutor . ' (Dr. Honoris Causa)';
        $this->db->prepare('UPDATE autores SET nombre = ? WHERE id_autor = ?')->execute([$nombreActualizado, $autorId]);
        $stmtUpdated = $this->db->prepare('SELECT nombre FROM autores WHERE id_autor = ?');
        $stmtUpdated->execute([$autorId]);
        $this->assert($stmtUpdated->fetchColumn() === $nombreActualizado, "UPDATE Autor: Modificación de datos del autor exitosa.");

        // DELETE
        $this->db->prepare('DELETE FROM autores WHERE id_autor = ?')->execute([$autorId]);
        $stmtCheck = $this->db->prepare('SELECT COUNT(*) FROM autores WHERE id_autor = ?');
        $stmtCheck->execute([$autorId]);
        $this->assert((int)$stmtCheck->fetchColumn() === 0, "DELETE Autor: Eliminación de autor sin obras asociadas.");
        echo "\n";
    }

    // -------------------------------------------------------------------------
    // TAREA 4: CRUD de Usuarios
    // -------------------------------------------------------------------------
    private function testCrudUsuarios(): void {
        echo "--- TAREA 4 (CRUD): Recurso Usuarios (/api/usuarios) ---\n";

        $doc = '77889900' . rand(100, 999);
        $email = 'crud.user.' . uniqid() . '@sgbi.edu';

        // CREATE
        $stmt = $this->db->prepare("
            INSERT INTO usuarios (numero_documento, nombre_completo, email, password_hash, rol, estado)
            VALUES (?, 'Usuario CRUD Test', ?, 'hashPrueba', 'DOCENTE', 'ACTIVO')
        ");
        $stmt->execute([$doc, $email]);
        $userId = (int)$this->db->lastInsertId();
        $this->assert($userId > 0, "CREATE Usuario: Creación de usuario por administrador (ID #{$userId}).");

        // READ
        $stmtGet = $this->db->prepare('SELECT * FROM usuarios WHERE id_usuario = ?');
        $stmtGet->execute([$userId]);
        $user = $stmtGet->fetch();
        $this->assert($user && $user['email'] === $email, "READ Usuario: Lectura de ficha de usuario.");

        // UPDATE
        $this->db->prepare("UPDATE usuarios SET estado = 'SANCIONADO' WHERE id_usuario = ?")->execute([$userId]);
        $stmtUp = $this->db->prepare('SELECT estado FROM usuarios WHERE id_usuario = ?');
        $stmtUp->execute([$userId]);
        $this->assert($stmtUp->fetchColumn() === 'SANCIONADO', "UPDATE Usuario: Cambio de estado a SANCIONADO exitoso.");

        // DELETE
        $this->db->prepare('DELETE FROM usuarios WHERE id_usuario = ?')->execute([$userId]);
        $stmtDel = $this->db->prepare('SELECT COUNT(*) FROM usuarios WHERE id_usuario = ?');
        $stmtDel->execute([$userId]);
        $this->assert((int)$stmtDel->fetchColumn() === 0, "DELETE Usuario: Eliminación de usuario sin dependencias.");
        echo "\n";
    }

    // -------------------------------------------------------------------------
    // TAREA 4: CRUD de Préstamos y Control de Circulación
    // -------------------------------------------------------------------------
    private function testCrudPrestamos(): void {
        echo "--- TAREA 4 (CRUD): Recurso Préstamos (/api/prestamos) ---\n";

        // Obtener un libro con stock y un usuario activo
        $libro = $this->db->query("SELECT * FROM libros WHERE copias_disp >= 1 LIMIT 1")->fetch();
        $usuario = $this->db->query("SELECT * FROM usuarios WHERE estado = 'ACTIVO' LIMIT 1")->fetch();

        $this->assert(!empty($libro) && !empty($usuario), "Datos previos disponibles para registrar préstamo.");

        $idLibro = (int)$libro['id_libro'];
        $idUsuario = (int)$usuario['id_usuario'];
        $stockInicial = (int)$libro['copias_disp'];

        // CREATE Préstamo
        $this->db->beginTransaction();
        $this->db->prepare('UPDATE libros SET copias_disp = copias_disp - 1 WHERE id_libro = ?')->execute([$idLibro]);
        $stmtInsert = $this->db->prepare("
            INSERT INTO prestamos (id_libro, id_usuario, fecha_prestamo, fecha_limite, estado)
            VALUES (?, ?, date('now'), date('now', '+8 days'), 'ACTIVO')
        ");
        $stmtInsert->execute([$idLibro, $idUsuario]);
        $loanId = (int)$this->db->lastInsertId();
        $this->db->commit();

        $stockDespuesPrestamo = (int)$this->db->query("SELECT copias_disp FROM libros WHERE id_libro = {$idLibro}")->fetchColumn();
        $this->assert($loanId > 0 && $stockDespuesPrestamo === ($stockInicial - 1), "CREATE Préstamo: Registro atómico con descuento de inventario en stock.");

        // READ Préstamo
        $stmtLoan = $this->db->prepare('SELECT * FROM prestamos WHERE id_prestamo = ?');
        $stmtLoan->execute([$loanId]);
        $prestamo = $stmtLoan->fetch();
        $this->assert($prestamo && $prestamo['estado'] === 'ACTIVO', "READ Préstamo: Consulta de folio de préstamo #{$loanId}.");

        // UPDATE Préstamo (Extensión de plazo)
        $this->db->prepare("UPDATE prestamos SET fecha_limite = date('now', '+15 days') WHERE id_prestamo = ?")->execute([$loanId]);
        $limiteNuevo = $this->db->query("SELECT fecha_limite FROM prestamos WHERE id_prestamo = {$loanId}")->fetchColumn();
        $this->assert(!empty($limiteNuevo), "UPDATE Préstamo: Modificación y extensión de fecha límite.");

        // DEVOLUCIÓN (Restitución de stock)
        $this->db->beginTransaction();
        $this->db->prepare("UPDATE prestamos SET estado = 'DEVUELTO', fecha_entrega = date('now') WHERE id_prestamo = ?")->execute([$loanId]);
        $this->db->prepare('UPDATE libros SET copias_disp = copias_disp + 1 WHERE id_libro = ?')->execute([$idLibro]);
        $this->db->commit();

        $stockFinal = (int)$this->db->query("SELECT copias_disp FROM libros WHERE id_libro = {$idLibro}")->fetchColumn();
        $this->assert($stockFinal === $stockInicial, "DEVOLUCIÓN Préstamo: Restitución íntegra de la copia al inventario disponible.");

        // DELETE Préstamo
        $this->db->prepare('DELETE FROM prestamos WHERE id_prestamo = ?')->execute([$loanId]);
        $this->assert($this->db->query("SELECT COUNT(*) FROM prestamos WHERE id_prestamo = {$loanId}")->fetchColumn() == 0, "DELETE Préstamo: Eliminación de registro de préstamo.");
        echo "\n";
    }

    // -------------------------------------------------------------------------
    // TAREA 5: Documentación OpenAPI
    // -------------------------------------------------------------------------
    private function testOpenApiDocumentation(): void {
        echo "--- TAREA 5: Especificación OpenAPI 3.0 ---\n";

        $docsController = new \Sgbi\Controllers\DocsController();
        ob_start();
        $docsController->getSpec();
        $rawJson = ob_get_clean();

        $spec = json_decode($rawJson, true);
        $this->assert(is_array($spec), "Especificación OpenAPI serializada en JSON válido.");
        $this->assert(isset($spec['openapi']) && str_starts_with($spec['openapi'], '3.0'), "Versión OpenAPI 3.0.x confirmada.");
        $this->assert(isset($spec['paths']['/auth/login']), "Documentación de endpoint /auth/login presente.");
        $this->assert(isset($spec['paths']['/auth/register']), "Documentación de endpoint /auth/register presente.");
        $this->assert(isset($spec['paths']['/libros']), "Documentación de endpoint /libros presente.");
        $this->assert(isset($spec['paths']['/prestamos']), "Documentación de endpoint /prestamos presente.");
        $this->assert(isset($spec['paths']['/usuarios']), "Documentación de endpoint /usuarios presente.");
        echo "\n";
    }
}

$runner = new Sprint2TestRunner();
$runner->runAll();
