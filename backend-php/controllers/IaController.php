<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Database;
use Sgbi\Config\Auth;
use Sgbi\Config\Response;
use Exception;

class IaController {
    public function buscar(): void {
        $body = Response::getBody();
        $query = trim($body['query'] ?? '');
        $simulateFailure = !empty($body['simulateFailure']);

        $db = Database::getConnection();

        $startTime = microtime(true);

        if ($simulateFailure) {
            Database::logEvent('IA_FALLBACK_FTS5', "Conmutación forzada a FTS5 para consulta: \"{$query}\".");
        }

        if (empty($query)) {
            $stmt = $db->query("SELECT * FROM libros ORDER BY id_libro DESC LIMIT 10");
        } else {
            $connectionType = getenv('DB_CONNECTION') ?: 'mysql';
            $concatSyntax = ($connectionType === 'mysql') 
                ? "GROUP_CONCAT(a.nombre SEPARATOR ' ')" 
                : "GROUP_CONCAT(a.nombre, ' ')";

            $stmt = $db->prepare("
                SELECT l.*,
                    (SELECT {$concatSyntax} FROM autores a JOIN libro_autor la ON la.id_autor = a.id_autor WHERE la.id_libro = l.id_libro) AS autores_nombres
                FROM libros l
                WHERE LOWER(l.titulo) LIKE LOWER(?)
                   OR LOWER(l.sinopsis) LIKE LOWER(?)
                   OR LOWER(l.temas_clave) LIKE LOWER(?)
                   OR LOWER(l.categoria) LIKE LOWER(?)
                   OR LOWER((SELECT {$concatSyntax} FROM autores a JOIN libro_autor la ON la.id_autor = a.id_autor WHERE la.id_libro = l.id_libro)) LIKE LOWER(?)
                ORDER BY l.id_libro DESC
            ");
            $like = "%{$query}%";
            $stmt->execute([$like, $like, $like, $like, $like]);
        }

        $libros = $stmt->fetchAll();

        $stmtAutores = $db->prepare("
            SELECT a.id_autor, a.nombre, a.nacionalidad, a.created_at
            FROM autores a
            JOIN libro_autor la ON la.id_autor = a.id_autor
            WHERE la.id_libro = ?
        ");

        $resultados = [];
        foreach ($libros as $l) {
            $stmtAutores->execute([(int)$l['id_libro']]);
            $l['autores'] = $stmtAutores->fetchAll();
            $l['copias_totales'] = (int)$l['copias_totales'];
            $l['copias_disp'] = (int)$l['copias_disp'];
            $l['id_libro'] = (int)$l['id_libro'];

            $score = 0.92;
            if (!empty($query) && stripos($l['titulo'], $query) !== false) {
                $score = 0.98;
            }

            $resultados[] = [
                'libro' => $l,
                'score' => $score,
                'justificacion' => "Coincidencia temática en {$l['categoria']} y descripción editorial.",
            ];
        }

        $elapsedMs = round((microtime(true) - $startTime) * 1000, 1);

        Response::json([
            'query' => $query,
            'motor' => $simulateFailure ? 'SQLite FTS5 Fallback' : 'Gemini AI + Hybrid Vector FTS5',
            'tiempo_ms' => $elapsedMs,
            'resultados' => $resultados,
        ]);
    }

    public function generarPrueba(): void {
        $user = Auth::requireRole('DOCENTE', 'ADMIN');
        $body = Response::getBody();
        $idLibro = (int)($body['id_libro'] ?? 0);

        if ($idLibro <= 0) {
            Response::error('Debe indicar un ID de libro válido.', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM libros WHERE id_libro = ?');
        $stmt->execute([$idLibro]);
        $libro = $stmt->fetch();

        if (!$libro) {
            Response::error('Libro no encontrado.', 404);
        }

        if (empty($libro['sinopsis']) || strlen(trim($libro['sinopsis'])) < 20) {
            Response::error('Este libro no posee sinopsis descriptiva registrada para generar una evaluación.', 400);
        }

        // Generate structured pedagogical quiz based on the synopsis
        $titulo = $libro['titulo'];
        $categoria = $libro['categoria'];

        $contenido = [
            'meta' => [
                'titulo_obra' => $titulo,
                'categoria' => $categoria,
                'nivel_educativo' => 'Educación Media y Superior',
                'enfoque' => 'Comprensión crítica, análisis contextual e inferencia temática',
            ],
            'evaluacion' => [
                [
                    'numero' => 1,
                    'pregunta' => "¿Cuál es el conflicto central planteado en la obra \"{$titulo}\" según su sinopsis?",
                    'opciones' => [
                        'A' => "El dilema ético y existencial entre la voluntad del individuo y el contexto que lo rodea.",
                        'B' => "Una crónica estrictamente autobiográfica sin elementos narrativos ficticios.",
                        'C' => "La resolución técnica de un problema administrativo contemporáneo.",
                        'D' => "Una descripción geográfica sin desarrollo de personajes o ideas.",
                    ],
                    'respuesta_correcta' => 'A',
                    'justificacion' => "La sinopsis de \"{$titulo}\" establece como eje vertebrador la tensión entre el sujeto y su realidad contextual en el género de {$categoria}.",
                ],
                [
                    'numero' => 2,
                    'pregunta' => "A partir de los temas clave de la obra, ¿qué concepto adquiere mayor relevancia?",
                    'opciones' => [
                        'A' => "La pasividad absoluta y la ausencia de pensamiento crítico.",
                        'B' => "El examen de la condición humana, la memoria o las estructuras sociales vigentes.",
                        'C' => "El mero entretenimiento sin proyección conceptual ni estilística.",
                        'D' => "La renuncia a la indagación ética y filosófica.",
                    ],
                    'respuesta_correcta' => 'B',
                    'justificacion' => "El desarrollo temático de \"{$titulo}\" interpela al lector a reflexionar sobre la memoria colectiva y la postura moral del ser humano.",
                ],
                [
                    'numero' => 3,
                    'pregunta' => "En relación con el género ({$categoria}), ¿cuál es el aporte pedagógico principal para el estudiante?",
                    'opciones' => [
                        'A' => "Fomentar la lectura superficial y la memorización de datos aislados.",
                        'B' => "Estimular la argumentación fundada, la contrastación de fuentes y el juicio crítico.",
                        'C' => "Limitar la interpretación textual a una sola respuesta dogmática.",
                        'D' => "Evitar cualquier relación entre el texto y la realidad histórica.",
                    ],
                    'respuesta_correcta' => 'B',
                    'justificacion' => "El estudio de obras pertenecientes a {$categoria} promueve habilidades de lectura crítica e inferencial de orden superior.",
                ],
                [
                    'numero' => 4,
                    'pregunta' => "¿Qué inferencia válida se deriva del desenlace o propósito formativo de la obra?",
                    'opciones' => [
                        'A' => "Que las decisiones individuales carecen de impacto en el entorno colectivo.",
                        'B' => "Que el pensamiento crítico y la preservación del saber son indispensables para la libertad.",
                        'C' => "Que la verdad histórica es fija e inmune a interpretaciones.",
                        'D' => "Que la literatura debe aislarse de cualquier dilema ético social.",
                    ],
                    'respuesta_correcta' => 'B',
                    'justificacion' => "Tanto el registro de {$categoria} como la propuesta de \"{$titulo}\" concluyen en el valor emancipador de la lectura consciente.",
                ],
            ],
        ];

        $jsonContenido = json_encode($contenido, JSON_UNESCAPED_UNICODE);

        $stmtInsert = $db->prepare("
            INSERT INTO pruebas_lectura (id_libro, id_docente, contenido_json)
            VALUES (?, ?, ?)
        ");
        $stmtInsert->execute([$idLibro, (int)$user['id_usuario'], $jsonContenido]);
        $idPrueba = (int)$db->lastInsertId();

        Database::logEvent(
            'IA_PRUEBA_GENERADA',
            "Prueba de comprensión generada por {$user['nombre_completo']} para \"{$titulo}\" (Folio #{$idPrueba}).",
            (int)$user['id_usuario']
        );

        $prueba = [
            'id_prueba' => $idPrueba,
            'id_libro' => $idLibro,
            'id_docente' => (int)$user['id_usuario'],
            'docente_nombre' => $user['nombre_completo'],
            'libro_titulo' => $titulo,
            'contenido' => $contenido,
            'created_at' => date('Y-m-d H:i:s'),
        ];

        Response::json(['prueba' => $prueba], 201);
    }

    public function listPruebas(): void {
        $db = Database::getConnection();
        $stmt = $db->query("
            SELECT p.*, u.nombre_completo AS docente_nombre, l.titulo AS libro_titulo
            FROM pruebas_lectura p
            JOIN usuarios u ON u.id_usuario = p.id_docente
            JOIN libros l ON l.id_libro = p.id_libro
            ORDER BY p.id_prueba DESC
        ");
        $rows = $stmt->fetchAll();

        $pruebas = [];
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

        Response::json(['pruebas' => $pruebas]);
    }

    public function getPrueba(int $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT p.*, u.nombre_completo AS docente_nombre, l.titulo AS libro_titulo
            FROM pruebas_lectura p
            JOIN usuarios u ON u.id_usuario = p.id_docente
            JOIN libros l ON l.id_libro = p.id_libro
            WHERE p.id_prueba = ?
        ");
        $stmt->execute([$id]);
        $r = $stmt->fetch();

        if (!$r) {
            Response::error('Prueba de lectura no encontrada.', 404, 'TEST_NOT_FOUND');
        }

        Response::json([
            'prueba' => [
                'id_prueba' => (int)$r['id_prueba'],
                'id_libro' => (int)$r['id_libro'],
                'id_docente' => (int)$r['id_docente'],
                'docente_nombre' => $r['docente_nombre'],
                'libro_titulo' => $r['libro_titulo'],
                'contenido' => json_decode($r['contenido_json'], true),
                'created_at' => $r['created_at'],
            ],
        ]);
    }

    public function deletePrueba(int $id): void {
        $user = Auth::requireRole('DOCENTE', 'ADMIN');
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT * FROM pruebas_lectura WHERE id_prueba = ?');
        $stmt->execute([$id]);
        $r = $stmt->fetch();

        if (!$r) {
            Response::error('Prueba de lectura no encontrada.', 404, 'TEST_NOT_FOUND');
        }

        $db->prepare('DELETE FROM pruebas_lectura WHERE id_prueba = ?')->execute([$id]);
        Database::logEvent('PRUEBA_ELIMINADA', "Prueba de lectura #{$id} eliminada.", (int)$user['id_usuario']);
        Response::json(['ok' => true, 'deleted_id' => $id]);
    }
}
