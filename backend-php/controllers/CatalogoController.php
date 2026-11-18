<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Auth;
use Sgbi\Config\Response;
use PDO;
use Exception;

class CatalogoController {
    public function listLibros(): void {
        $db = Database::getConnection();
        $categoria = trim($_GET['categoria'] ?? '');
        $q = trim($_GET['q'] ?? '');
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : null;
        $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : null;

        $whereClauses = [];
        $params = [];

        if (!empty($categoria) && $categoria !== 'Todas') {
            $whereClauses[] = "l.categoria = ?";
            $params[] = $categoria;
        }

        if (!empty($q)) {
            $whereClauses[] = "(LOWER(l.titulo) LIKE LOWER(?) OR LOWER(l.isbn) LIKE LOWER(?) OR LOWER(COALESCE(l.sinopsis, '')) LIKE LOWER(?) OR LOWER(COALESCE(l.temas_clave, '')) LIKE LOWER(?) OR EXISTS (SELECT 1 FROM libro_autor la_q JOIN autores a_q ON a_q.id_autor = la_q.id_autor WHERE la_q.id_libro = l.id_libro AND LOWER(a_q.nombre) LIKE LOWER(?)))";
            $like = "%{$q}%";
            array_push($params, $like, $like, $like, $like, $like);
        }

        $whereSql = !empty($whereClauses) ? ' WHERE ' . implode(' AND ', $whereClauses) : '';

        $countStmt = $db->prepare("SELECT COUNT(*) FROM libros l{$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $sql = "
            SELECT 
                l.*,
                (SELECT COUNT(*) FROM pruebas_lectura pl WHERE pl.id_libro = l.id_libro) AS pruebas_count
            FROM libros l
            {$whereSql}
            ORDER BY l.id_libro DESC
        ";

        if ($limit !== null) {
            $offset = (($page ?? 1) - 1) * $limit;
            $sql .= " LIMIT {$limit} OFFSET {$offset}";
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $libros = $stmt->fetchAll();

        // Attach authors to each book
        $stmtAutores = $db->prepare("
            SELECT a.id_autor, a.nombre, a.nacionalidad, a.created_at
            FROM autores a
            JOIN libro_autor la ON la.id_autor = a.id_autor
            WHERE la.id_libro = ?
            ORDER BY a.nombre ASC
        ");

        foreach ($libros as &$libro) {
            $stmtAutores->execute([(int)$libro['id_libro']]);
            $libro['autores'] = $stmtAutores->fetchAll();
            $libro['copias_totales'] = (int)$libro['copias_totales'];
            $libro['copias_disp'] = (int)$libro['copias_disp'];
            $libro['id_libro'] = (int)$libro['id_libro'];
            $libro['pruebas_count'] = (int)$libro['pruebas_count'];
        }

        Response::json([
            'libros' => $libros,
            'meta' => [
                'total' => $total,
                'count' => count($libros),
                'page' => $page ?? 1,
                'limit' => $limit ?? $total,
            ],
        ]);
    }

    public function getLibro(int $id, int $status = 200): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT 
                l.*,
                (SELECT COUNT(*) FROM pruebas_lectura pl WHERE pl.id_libro = l.id_libro) AS pruebas_count
            FROM libros l
            WHERE l.id_libro = ?
        ");
        $stmt->execute([$id]);
        $libro = $stmt->fetch();

        if (!$libro) {
            Response::error('Libro no encontrado.', 404);
        }

        // Fetch authors
        $stmtAutores = $db->prepare("
            SELECT a.id_autor, a.nombre, a.nacionalidad, a.created_at
            FROM autores a
            JOIN libro_autor la ON la.id_autor = a.id_autor
            WHERE la.id_libro = ?
            ORDER BY a.nombre ASC
        ");
        $stmtAutores->execute([$id]);
        $libro['autores'] = $stmtAutores->fetchAll();
        $libro['copias_totales'] = (int)$libro['copias_totales'];
        $libro['copias_disp'] = (int)$libro['copias_disp'];
        $libro['id_libro'] = (int)$libro['id_libro'];
        $libro['pruebas_count'] = (int)$libro['pruebas_count'];

        // If user is ADMIN or DOCENTE, return generated tests
        $pruebas = [];
        $user = Auth::user();
        if ($user && in_array($user['rol'], ['ADMIN', 'DOCENTE'], true)) {
            $stmtPruebas = $db->prepare("
                SELECT p.*, u.nombre_completo AS docente_nombre, l.titulo AS libro_titulo
                FROM pruebas_lectura p
                JOIN usuarios u ON u.id_usuario = p.id_docente
                JOIN libros l ON l.id_libro = p.id_libro
                WHERE p.id_libro = ?
                ORDER BY p.id_prueba DESC
            ");
            $stmtPruebas->execute([$id]);
            $rows = $stmtPruebas->fetchAll();
            foreach ($rows as $r) {
                $pruebas[] = [
                    'id_prueba' => (int)$r['id_prueba'],
                    'id_libro' => (int)$r['id_libro'],
                    'id_docente' => (int)$r['id_docente'],
                    'docente_nombre' => $r['docente_nombre'],
                    'libro_titulo' => $r['libro_titulo'],
                    'contenido' => json_decode($r['contenido_json'], true),
                    'created_at' => $r['created_at'],
                ];
            }
        }

        $extraHeaders = $status === 201 ? ['Location' => "/api/libros/{$id}"] : [];
        Response::json(['libro' => $libro, 'pruebas' => $pruebas], $status, $extraHeaders);
    }

    public function createLibro(): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();

        $isbn = trim($body['isbn'] ?? '');
        $titulo = trim($body['titulo'] ?? '');
        $categoria = trim($body['categoria'] ?? 'General');
        $copiasTotales = max(1, (int)($body['copias_totales'] ?? 1));
        $copiasDisp = isset($body['copias_disp']) ? max(0, (int)$body['copias_disp']) : $copiasTotales;

        if (empty($isbn) || empty($titulo)) {
            Response::error('El ISBN y el título son obligatorios.', 400);
        }

        $db = Database::getConnection();

        // Check unique ISBN
        $check = $db->prepare('SELECT id_libro FROM libros WHERE isbn = ?');
        $check->execute([$isbn]);
        if ($check->fetch()) {
            Response::error("Ya existe un libro registrado con el ISBN {$isbn}.", 409);
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare("
                INSERT INTO libros (isbn, titulo, sinopsis, categoria, anio_publicacion, editorial, idioma, paginas, ubicacion_estante, temas_clave, copias_totales, copias_disp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $isbn,
                $titulo,
                $body['sinopsis'] ?? null,
                $categoria,
                $body['anio_publicacion'] ?? null,
                $body['editorial'] ?? null,
                $body['idioma'] ?? 'Español',
                $body['paginas'] ?? null,
                $body['ubicacion_estante'] ?? null,
                $body['temas_clave'] ?? null,
                $copiasTotales,
                $copiasDisp,
            ]);

            $idLibro = (int)$db->lastInsertId();

            if (!empty($body['autor_ids']) && is_array($body['autor_ids'])) {
                $stmtLa = $db->prepare('INSERT INTO libro_autor (id_libro, id_autor) VALUES (?, ?)');
                foreach ($body['autor_ids'] as $idAutor) {
                    $stmtLa->execute([$idLibro, (int)$idAutor]);
                }
            }

            Database::logEvent('LIBRO_CREADO', "Libro registrado: \"{$titulo}\" (ISBN {$isbn}).", (int)$user['id_usuario']);
            $db->commit();

            $this->getLibro($idLibro, 201);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error('Error al registrar el libro: ' . $e->getMessage(), 500);
        }
    }

    public function updateLibro(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();

        $db = Database::getConnection();
        $stmtExisting = $db->prepare('SELECT * FROM libros WHERE id_libro = ?');
        $stmtExisting->execute([$id]);
        $existing = $stmtExisting->fetch();

        if (!$existing) {
            Response::error('Libro no encontrado.', 404);
        }

        $isbn = trim($body['isbn'] ?? $existing['isbn']);
        $titulo = trim($body['titulo'] ?? $existing['titulo']);

        if (empty($isbn) || empty($titulo)) {
            Response::error('El ISBN y el título no pueden estar vacíos.', 400);
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare("
                UPDATE libros SET
                    isbn = ?,
                    titulo = ?,
                    sinopsis = ?,
                    categoria = ?,
                    anio_publicacion = ?,
                    editorial = ?,
                    idioma = ?,
                    paginas = ?,
                    ubicacion_estante = ?,
                    temas_clave = ?,
                    copias_totales = ?,
                    copias_disp = ?
                WHERE id_libro = ?
            ");

            $copiasTotales = isset($body['copias_totales']) ? (int)$body['copias_totales'] : (int)$existing['copias_totales'];
            $copiasDisp = isset($body['copias_disp']) ? (int)$body['copias_disp'] : (int)$existing['copias_disp'];

            $stmt->execute([
                $isbn,
                $titulo,
                $body['sinopsis'] ?? $existing['sinopsis'],
                $body['categoria'] ?? $existing['categoria'],
                $body['anio_publicacion'] ?? $existing['anio_publicacion'],
                $body['editorial'] ?? $existing['editorial'],
                $body['idioma'] ?? $existing['idioma'],
                $body['paginas'] ?? $existing['paginas'],
                $body['ubicacion_estante'] ?? $existing['ubicacion_estante'],
                $body['temas_clave'] ?? $existing['temas_clave'],
                $copiasTotales,
                $copiasDisp,
                $id,
            ]);

            if (isset($body['autor_ids']) && is_array($body['autor_ids'])) {
                $db->prepare('DELETE FROM libro_autor WHERE id_libro = ?')->execute([$id]);
                $stmtLa = $db->prepare('INSERT INTO libro_autor (id_libro, id_autor) VALUES (?, ?)');
                foreach ($body['autor_ids'] as $idAutor) {
                    $stmtLa->execute([$id, (int)$idAutor]);
                }
            }

            Database::logEvent('LIBRO_ACTUALIZADO', "Libro actualizado: \"{$titulo}\" (ID {$id}).", (int)$user['id_usuario']);
            $db->commit();

            $this->getLibro($id);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error('Error al actualizar el libro: ' . $e->getMessage(), 500);
        }
    }

    public function deleteLibro(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT id_libro, titulo FROM libros WHERE id_libro = ?');
        $stmt->execute([$id]);
        $libro = $stmt->fetch();

        if (!$libro) {
            Response::error('Libro no encontrado.', 404);
        }

        // Verify no active loans
        $stmtLoans = $db->prepare("SELECT COUNT(*) FROM prestamos WHERE id_libro = ? AND estado IN ('ACTIVO', 'MORA')");
        $stmtLoans->execute([$id]);
        $activeLoans = (int)$stmtLoans->fetchColumn();

        if ($activeLoans > 0) {
            Response::error('No se puede eliminar el libro porque tiene préstamos en curso o en mora.', 409);
        }

        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM libro_autor WHERE id_libro = ?')->execute([$id]);
            $db->prepare('DELETE FROM pruebas_lectura WHERE id_libro = ?')->execute([$id]);
            $db->prepare('DELETE FROM libros WHERE id_libro = ?')->execute([$id]);

            Database::logEvent('LIBRO_ELIMINADO', "Libro eliminado: \"{$libro['titulo']}\" (ID {$id}).", (int)$user['id_usuario']);
            $db->commit();

            Response::json(['ok' => true]);
        } catch (Exception $e) {
            $db->rollBack();
            Response::error('Error al eliminar libro: ' . $e->getMessage(), 500);
        }
    }

    public function exportCsv(): void {
        $user = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $isMysql = (getenv('DB_CONNECTION') ?: 'mysql') === 'mysql';
        $concatAutores = $isMysql ? "GROUP_CONCAT(a.nombre SEPARATOR ' / ')" : "GROUP_CONCAT(a.nombre, ' / ')";

        $stmt = $db->query("
            SELECT 
                l.id_libro, l.isbn, l.titulo, l.categoria, l.anio_publicacion,
                l.editorial, l.copias_totales, l.copias_disp, l.ubicacion_estante,
                COALESCE((SELECT {$concatAutores} FROM autores a JOIN libro_autor la ON la.id_autor = a.id_autor WHERE la.id_libro = l.id_libro), 'Sin autor') AS autores
            FROM libros l
            ORDER BY l.id_libro ASC
        ");
        $rows = $stmt->fetchAll();

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="sgbi-catalogo.csv"');

        $out = fopen('php://output', 'w');
        // UTF-8 BOM for Excel
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
        fputcsv($out, ['ID', 'ISBN', 'Título', 'Autores', 'Categoría', 'Año', 'Editorial', 'Copias Totales', 'Copias Disponibles', 'Ubicación']);

        foreach ($rows as $r) {
            fputcsv($out, [
                $r['id_libro'],
                $r['isbn'],
                $r['titulo'],
                $r['autores'],
                $r['categoria'],
                $r['anio_publicacion'],
                $r['editorial'],
                $r['copias_totales'],
                $r['copias_disp'],
                $r['ubicacion_estante'],
            ]);
        }
        fclose($out);
        Database::logEvent('CATALOGO_EXPORTADO_CSV', 'Catálogo exportado a CSV.', (int)$user['id_usuario']);
        exit;
    }

    public function listCategorias(): void {
        $db = Database::getConnection();
        $stmt = $db->query("
            SELECT 
                c.*,
                COUNT(l.id_libro) AS libros_count,
                COALESCE(SUM(l.copias_disp), 0) AS copias_disp_sum
            FROM categorias c
            LEFT JOIN libros l ON l.categoria = c.nombre
            GROUP BY c.id_categoria
            ORDER BY c.nombre ASC
        ");
        $categorias = $stmt->fetchAll();
        foreach ($categorias as &$cat) {
            $cat['id_categoria'] = (int)$cat['id_categoria'];
            $cat['libros_count'] = (int)$cat['libros_count'];
            $cat['copias_disp_sum'] = (int)$cat['copias_disp_sum'];
        }
        Response::json(['categorias' => $categorias]);
    }

    public function createCategoria(): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();

        $nombre = trim($body['nombre'] ?? '');
        $descripcion = trim($body['descripcion'] ?? '');
        $codigo = trim($body['codigo_archivo'] ?? '000');
        $sala = trim($body['ubicacion_sala'] ?? 'Sala General');
        $publico = trim($body['publico_recomendado'] ?? 'Público general');
        $enfoque = trim($body['enfoque_lector'] ?? 'Lectura integral');

        if (empty($nombre) || strlen($descripcion) < 5) {
            Response::error('Nombre y descripción (mínimo 5 caracteres) requeridos.', 400);
        }

        $db = Database::getConnection();
        try {
            $stmt = $db->prepare("
                INSERT INTO categorias (nombre, codigo_archivo, descripcion, ubicacion_sala, publico_recomendado, enfoque_lector)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$nombre, $codigo, $descripcion, $sala, $publico, $enfoque]);
            $id = (int)$db->lastInsertId();

            $stmtGet = $db->prepare('SELECT * FROM categorias WHERE id_categoria = ?');
            $stmtGet->execute([$id]);
            $categoria = $stmtGet->fetch();

            Database::logEvent('CATEGORIA_CREADA', "Categoría \"{$nombre}\" creada.", (int)$user['id_usuario']);
            Response::created(['categoria' => $categoria], "/api/v1/categorias/{$id}");
        } catch (Exception $e) {
            if (str_contains($e->getMessage(), 'UNIQUE') || str_contains($e->getMessage(), 'Duplicate')) {
                Response::error("La categoría \"{$nombre}\" ya existe.", 409, 'DUPLICATE_RESOURCE');
            }
            Response::error('Error al registrar categoría: ' . $e->getMessage(), 500);
        }
    }

    public function getCategoria(int $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM categorias WHERE id_categoria = ?');
        $stmt->execute([$id]);
        $cat = $stmt->fetch();
        if (!$cat) {
            Response::error('Categoría no encontrada.', 404, 'CATEGORY_NOT_FOUND');
        }
        $cat['id_categoria'] = (int)$cat['id_categoria'];
        Response::json(['categoria' => $cat]);
    }

    public function updateCategoria(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM categorias WHERE id_categoria = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            Response::error('Categoría no encontrada.', 404, 'CATEGORY_NOT_FOUND');
        }

        $nombre = trim($body['nombre'] ?? $existing['nombre']);
        $descripcion = trim($body['descripcion'] ?? $existing['descripcion']);
        $codigo = trim($body['codigo_archivo'] ?? $existing['codigo_archivo']);
        $sala = trim($body['ubicacion_sala'] ?? $existing['ubicacion_sala']);
        $publico = trim($body['publico_recomendado'] ?? $existing['publico_recomendado']);
        $enfoque = trim($body['enfoque_lector'] ?? $existing['enfoque_lector']);

        try {
            $stmtUp = $db->prepare('UPDATE categorias SET nombre = ?, codigo_archivo = ?, descripcion = ?, ubicacion_sala = ?, publico_recomendado = ?, enfoque_lector = ? WHERE id_categoria = ?');
            $stmtUp->execute([$nombre, $codigo, $descripcion, $sala, $publico, $enfoque, $id]);

            $stmt->execute([$id]);
            $updated = $stmt->fetch();
            $updated['id_categoria'] = (int)$updated['id_categoria'];

            Database::logEvent('CATEGORIA_ACTUALIZADA', "Categoría \"{$nombre}\" actualizada.", (int)$user['id_usuario']);
            Response::json(['categoria' => $updated]);
        } catch (Exception $e) {
            if (str_contains($e->getMessage(), 'UNIQUE') || str_contains($e->getMessage(), 'Duplicate')) {
                Response::error("Ya existe una categoría con el nombre \"{$nombre}\".", 409, 'DUPLICATE_RESOURCE');
            }
            Response::error('Error al actualizar categoría: ' . $e->getMessage(), 500);
        }
    }

    public function deleteCategoria(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM categorias WHERE id_categoria = ?');
        $stmt->execute([$id]);
        $cat = $stmt->fetch();
        if (!$cat) {
            Response::error('Categoría no encontrada.', 404, 'CATEGORY_NOT_FOUND');
        }

        // Verify no books use this category
        $check = $db->prepare('SELECT COUNT(*) FROM libros WHERE categoria = ?');
        $check->execute([$cat['nombre']]);
        if ((int)$check->fetchColumn() > 0) {
            Response::error('No se puede eliminar la categoría porque hay libros asignados a ella.', 409, 'CATEGORY_IN_USE');
        }

        $db->prepare('DELETE FROM categorias WHERE id_categoria = ?')->execute([$id]);
        Database::logEvent('CATEGORIA_ELIMINADA', "Categoría eliminada: \"{$cat['nombre']}\".", (int)$user['id_usuario']);
        Response::json(['ok' => true, 'deleted_id' => $id]);
    }

    public function listAutores(): void {
        $db = Database::getConnection();
        $stmt = $db->query('SELECT * FROM autores ORDER BY nombre ASC');
        $autores = $stmt->fetchAll();
        foreach ($autores as &$a) {
            $a['id_autor'] = (int)$a['id_autor'];
        }
        Response::json(['autores' => $autores]);
    }

    public function getAutor(int $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM autores WHERE id_autor = ?');
        $stmt->execute([$id]);
        $autor = $stmt->fetch();
        if (!$autor) {
            Response::error('Autor no encontrado.', 404, 'AUTHOR_NOT_FOUND');
        }
        $autor['id_autor'] = (int)$autor['id_autor'];
        Response::json(['autor' => $autor]);
    }

    public function updateAutor(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM autores WHERE id_autor = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            Response::error('Autor no encontrado.', 404, 'AUTHOR_NOT_FOUND');
        }

        $nombre = trim($body['nombre'] ?? $existing['nombre']);
        $nacionalidad = array_key_exists('nacionalidad', $body) ? ($body['nacionalidad'] ?: null) : $existing['nacionalidad'];

        if (empty($nombre)) {
            Response::error('El nombre del autor no puede estar vacío.', 422, 'VALIDATION_ERROR');
        }

        $db->prepare('UPDATE autores SET nombre = ?, nacionalidad = ? WHERE id_autor = ?')->execute([$nombre, $nacionalidad, $id]);

        $stmt->execute([$id]);
        $updated = $stmt->fetch();
        $updated['id_autor'] = (int)$updated['id_autor'];

        Database::logEvent('AUTOR_ACTUALIZADO', "Autor actualizado: {$nombre}.", (int)$user['id_usuario']);
        Response::json(['autor' => $updated]);
    }

    public function deleteAutor(int $id): void {
        $user = Auth::requireRole('ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM autores WHERE id_autor = ?');
        $stmt->execute([$id]);
        $autor = $stmt->fetch();
        if (!$autor) {
            Response::error('Autor no encontrado.', 404, 'AUTHOR_NOT_FOUND');
        }

        $check = $db->prepare('SELECT COUNT(*) FROM libro_autor WHERE id_autor = ?');
        $check->execute([$id]);
        if ((int)$check->fetchColumn() > 0) {
            Response::error('No se puede eliminar el autor porque tiene libros asociados.', 409, 'AUTHOR_IN_USE');
        }

        $db->prepare('DELETE FROM autores WHERE id_autor = ?')->execute([$id]);
        Database::logEvent('AUTOR_ELIMINADO', "Autor eliminado: \"{$autor['nombre']}\".", (int)$user['id_usuario']);
        Response::json(['ok' => true, 'deleted_id' => $id]);
    }

    public function createAutor(): void {
        $user = Auth::requireRole('ADMIN');
        $body = Response::getBody();
        $nombre = trim($body['nombre'] ?? '');
        $nacionalidad = trim($body['nacionalidad'] ?? '') ?: null;

        if (empty($nombre)) {
            Response::error('El nombre del autor es obligatorio.', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare('INSERT INTO autores (nombre, nacionalidad) VALUES (?, ?)');
        $stmt->execute([$nombre, $nacionalidad]);
        $id = (int)$db->lastInsertId();

        $stmtGet = $db->prepare('SELECT * FROM autores WHERE id_autor = ?');
        $stmtGet->execute([$id]);
        $autor = $stmtGet->fetch();
        $autor['id_autor'] = (int)$autor['id_autor'];

        Database::logEvent('AUTOR_CREADO', "Autor registrado: {$nombre}.", (int)$user['id_usuario']);
        Response::created(['autor' => $autor], "/api/v1/autores/{$id}");
    }
}
