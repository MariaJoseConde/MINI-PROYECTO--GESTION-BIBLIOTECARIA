<?php
namespace Sgbi\Controllers;

use Sgbi\Config\Response;

class DocsController {
    public function getSpec(): void {
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $baseUrl = "{$protocol}://{$host}";

        $spec = [
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'SGBI - API RESTful de Gestión Bibliotecaria',
                'description' => 'API RESTful completa de nivel empresarial para el Sistema de Gestión de Biblioteca Integral (SGBI). Desarrollada en PHP 8.2 con persistencia MySQL InnoDB, autenticación por sesión/Bearer token, control de concurrencia y búsqueda semántica híbrida.',
                'version' => '1.0.0',
                'contact' => [
                    'name' => 'Equipo de Desarrollo SGBI',
                    'email' => 'admin@sgbi.edu',
                ],
            ],
            'servers' => [
                [
                    'url' => $baseUrl . '/api',
                    'description' => 'Servidor de API Local / Producción (PHP 8.2 + MySQL)',
                ],
            ],
            'tags' => [
                ['name' => 'Autenticación', 'description' => 'Inicio, validación de credenciales y cierre de sesión'],
                ['name' => 'Catálogo de Libros', 'description' => 'Gestión completa de libros, stock, ISBN y autores'],
                ['name' => 'Categorías', 'description' => 'Clasificación temática y asignación de salas'],
                ['name' => 'Autores', 'description' => 'Catálogo de autores literarios e históricos'],
                ['name' => 'Salas', 'description' => 'Espacios físicos de consulta y lectura'],
                ['name' => 'Circulación y Préstamos', 'description' => 'Control de préstamos, cálculo de fechas y devolución con mora'],
                ['name' => 'IA y Evaluaciones', 'description' => 'Búsqueda contextual y generación de pruebas de comprensión'],
                ['name' => 'Administración y Auditoría', 'description' => 'Gestión de usuarios RBAC, métricas y bitácora de auditoría'],
                ['name' => 'Salud del Sistema', 'description' => 'Health check y monitoreo del estado de conexión a MySQL'],
            ],
            'paths' => [
                '/health' => [
                    'get' => [
                        'tags' => ['Salud del Sistema'],
                        'summary' => 'Comprobar estado del servidor y conexión a MySQL',
                        'responses' => [
                            '200' => [
                                'description' => 'Servidor y base de datos funcionando correctamente.',
                            ],
                        ],
                    ],
                ],
                '/auth/register' => [
                    'post' => [
                        'tags' => ['Autenticación'],
                        'summary' => 'Registrar un nuevo usuario lector en la biblioteca',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['numero_documento', 'nombre_completo', 'email', 'password'],
                                        'properties' => [
                                            'numero_documento' => ['type' => 'string', 'example' => '1020304050'],
                                            'nombre_completo' => ['type' => 'string', 'example' => 'Laura Marcela Gómez'],
                                            'email' => ['type' => 'string', 'example' => 'laura.gomez@sgbi.edu'],
                                            'password' => ['type' => 'string', 'example' => 'claveSegura123'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'Usuario registrado exitosamente.'],
                            '400' => ['description' => 'Campos obligatorios faltantes.'],
                            '409' => ['description' => 'Documento o correo electrónico ya registrado.'],
                            '422' => ['description' => 'Formato de correo inválido o contraseña menor a 6 caracteres.'],
                        ],
                    ],
                ],
                '/auth/login' => [
                    'post' => [
                        'tags' => ['Autenticación'],
                        'summary' => 'Iniciar sesión con correo institucional y contraseña',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['email', 'password'],
                                        'properties' => [
                                            'email' => ['type' => 'string', 'example' => 'admin@sgbi.edu'],
                                            'password' => ['type' => 'string', 'example' => 'sgbi2026'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Inicio de sesión exitoso.'],
                            '401' => ['description' => 'Credenciales inválidas.'],
                        ],
                    ],
                ],
                '/auth/me' => [
                    'get' => [
                        'tags' => ['Autenticación'],
                        'summary' => 'Obtener información del usuario autenticado actualmente',
                        'responses' => [
                            '200' => ['description' => 'Perfil del usuario.'],
                            '401' => ['description' => 'No autenticado.'],
                        ],
                    ],
                ],
                '/auth/logout' => [
                    'post' => [
                        'tags' => ['Autenticación'],
                        'summary' => 'Cerrar la sesión actual',
                        'responses' => [
                            '200' => ['description' => 'Sesión cerrada correctamente.'],
                        ],
                    ],
                ],
                '/libros' => [
                    'get' => [
                        'tags' => ['Catálogo de Libros'],
                        'summary' => 'Listar libros con filtros opcionales de búsqueda y paginación',
                        'parameters' => [
                            ['name' => 'categoria', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Filtrar por categoría'],
                            ['name' => 'q', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Búsqueda por texto (título, ISBN, sinopsis)'],
                            ['name' => 'page', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 1]],
                            ['name' => 'limit', 'in' => 'query', 'schema' => ['type' => 'integer', 'default' => 20]],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Lista de libros obtenida exitosamente.'],
                        ],
                    ],
                    'post' => [
                        'tags' => ['Catálogo de Libros'],
                        'summary' => 'Crear un nuevo libro en el catálogo (Requiere ADMIN)',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['isbn', 'titulo', 'categoria'],
                                        'properties' => [
                                            'isbn' => ['type' => 'string', 'example' => '978-958-00-1234-5'],
                                            'titulo' => ['type' => 'string', 'example' => 'Crónica de una muerte anunciada'],
                                            'categoria' => ['type' => 'string', 'example' => 'Realismo Mágico'],
                                            'anio_publicacion' => ['type' => 'integer', 'example' => 1981],
                                            'editorial' => ['type' => 'string', 'example' => 'Editorial Oveja Negra'],
                                            'copias_totales' => ['type' => 'integer', 'example' => 3],
                                            'autor_ids' => ['type' => 'array', 'items' => ['type' => 'integer'], 'example' => [1]],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'Libro creado exitosamente.'],
                            '400' => ['description' => 'Datos inválidos.'],
                            '409' => ['description' => 'ISBN duplicado.'],
                        ],
                    ],
                ],
                '/libros/{id}' => [
                    'get' => [
                        'tags' => ['Catálogo de Libros'],
                        'summary' => 'Obtener detalles de un libro por su ID',
                        'parameters' => [
                            ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Detalle del libro.'],
                            '404' => ['description' => 'Libro no encontrado.'],
                        ],
                    ],
                    'put' => [
                        'tags' => ['Catálogo de Libros'],
                        'summary' => 'Actualizar información de un libro existente (Requiere ADMIN)',
                        'parameters' => [
                            ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Libro actualizado.'],
                            '404' => ['description' => 'Libro no encontrado.'],
                        ],
                    ],
                    'delete' => [
                        'tags' => ['Catálogo de Libros'],
                        'summary' => 'Eliminar un libro si no tiene préstamos activos (Requiere ADMIN)',
                        'parameters' => [
                            ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Libro eliminado.'],
                            '409' => ['description' => 'Libro tiene préstamos en curso.'],
                        ],
                    ],
                ],
                '/libros/exportar/csv' => [
                    'get' => [
                        'tags' => ['Catálogo de Libros'],
                        'summary' => 'Exportar catálogo completo a archivo CSV UTF-8 con BOM',
                        'responses' => [
                            '200' => ['description' => 'Archivo CSV para descarga.'],
                        ],
                    ],
                ],
                '/categorias' => [
                    'get' => [
                        'tags' => ['Categorías'],
                        'summary' => 'Listar todas las categorías con conteo de libros asociados',
                        'responses' => ['200' => ['description' => 'Lista de categorías.']],
                    ],
                    'post' => [
                        'tags' => ['Categorías'],
                        'summary' => 'Crear una nueva categoría (Requiere ADMIN)',
                        'responses' => ['201' => ['description' => 'Categoría creada.']],
                    ],
                ],
                '/categorias/{id}' => [
                    'get' => [
                        'tags' => ['Categorías'],
                        'summary' => 'Obtener una categoría por ID',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Categoría encontrada.']],
                    ],
                    'put' => [
                        'tags' => ['Categorías'],
                        'summary' => 'Actualizar una categoría (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Categoría actualizada.']],
                    ],
                    'delete' => [
                        'tags' => ['Categorías'],
                        'summary' => 'Eliminar categoría sin libros asignados (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Categoría eliminada.']],
                    ],
                ],
                '/autores' => [
                    'get' => [
                        'tags' => ['Autores'],
                        'summary' => 'Listar todos los autores registrados',
                        'responses' => ['200' => ['description' => 'Lista de autores.']],
                    ],
                    'post' => [
                        'tags' => ['Autores'],
                        'summary' => 'Registrar un nuevo autor (Requiere ADMIN)',
                        'responses' => ['201' => ['description' => 'Autor creado.']],
                    ],
                ],
                '/autores/{id}' => [
                    'get' => [
                        'tags' => ['Autores'],
                        'summary' => 'Obtener autor por ID',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Autor encontrado.']],
                    ],
                    'put' => [
                        'tags' => ['Autores'],
                        'summary' => 'Actualizar datos de un autor (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Autor actualizado.']],
                    ],
                    'delete' => [
                        'tags' => ['Autores'],
                        'summary' => 'Eliminar autor sin obras asociadas (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Autor eliminado.']],
                    ],
                ],
                '/salas' => [
                    'get' => [
                        'tags' => ['Salas'],
                        'summary' => 'Listar salas físicas de lectura y aforo',
                        'responses' => ['200' => ['description' => 'Lista de salas.']],
                    ],
                    'post' => [
                        'tags' => ['Salas'],
                        'summary' => 'Registrar una nueva sala (Requiere ADMIN)',
                        'responses' => ['201' => ['description' => 'Sala creada.']],
                    ],
                ],
                '/salas/{id}' => [
                    'get' => [
                        'tags' => ['Salas'],
                        'summary' => 'Obtener sala por ID',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Detalle de la sala.']],
                    ],
                    'put' => [
                        'tags' => ['Salas'],
                        'summary' => 'Actualizar sala (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Sala actualizada.']],
                    ],
                    'delete' => [
                        'tags' => ['Salas'],
                        'summary' => 'Eliminar sala (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Sala eliminada.']],
                    ],
                ],
                '/prestamos' => [
                    'get' => [
                        'tags' => ['Circulación y Préstamos'],
                        'summary' => 'Listar préstamos (Lectores ven sus propios préstamos; ADMIN ve todos)',
                        'responses' => ['200' => ['description' => 'Lista de préstamos.']],
                    ],
                    'post' => [
                        'tags' => ['Circulación y Préstamos'],
                        'summary' => 'Crear un nuevo préstamo domiciliario (Requiere ADMIN)',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['id_libro', 'id_usuario'],
                                        'properties' => [
                                            'id_libro' => ['type' => 'integer', 'example' => 1],
                                            'id_usuario' => ['type' => 'integer', 'example' => 3],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'Préstamo creado con fecha límite calculada (8 días hábiles).'],
                            '400' => ['description' => 'Libro sin copias disponibles.'],
                            '409' => ['description' => 'Lector sancionado o con préstamos en mora.'],
                        ],
                    ],
                ],
                '/prestamos/{id}' => [
                    'get' => [
                        'tags' => ['Circulación y Préstamos'],
                        'summary' => 'Consultar un préstamo por su ID',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Detalle del préstamo.']],
                    ],
                    'put' => [
                        'tags' => ['Circulación y Préstamos'],
                        'summary' => 'Actualizar plazo, estado o multa de un préstamo (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'fecha_limite' => ['type' => 'string', 'format' => 'date', 'example' => '2026-12-05'],
                                            'estado' => ['type' => 'string', 'enum' => ['ACTIVO', 'DEVUELTO', 'MORA'], 'example' => 'ACTIVO'],
                                            'multa_calculada' => ['type' => 'number', 'example' => 0.0],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '200' => ['description' => 'Préstamo actualizado exitosamente.'],
                            '404' => ['description' => 'Préstamo no encontrado.'],
                            '422' => ['description' => 'Formato de fecha o estado inválido.'],
                        ],
                    ],
                    'delete' => [
                        'tags' => ['Circulación y Préstamos'],
                        'summary' => 'Eliminar o cancelar un préstamo, reintegrando stock si estaba activo (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => [
                            '200' => ['description' => 'Préstamo eliminado y stock restaurado si aplicaba.'],
                            '404' => ['description' => 'Préstamo no encontrado.'],
                        ],
                    ],
                ],
                '/prestamos/{id}/devolver' => [
                    'post' => [
                        'tags' => ['Circulación y Préstamos'],
                        'summary' => 'Registrar devolución de un libro con cálculo de mora si aplica (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Devolución procesada y stock restaurado en MySQL.']],
                    ],
                ],
                '/usuarios' => [
                    'get' => [
                        'tags' => ['Usuarios'],
                        'summary' => 'Listar usuarios del sistema con filtro opcional de documento/nombre (Requiere ADMIN)',
                        'parameters' => [
                            ['name' => 'documento', 'in' => 'query', 'schema' => ['type' => 'string'], 'description' => 'Buscar por número de documento o nombre'],
                        ],
                        'responses' => ['200' => ['description' => 'Lista de usuarios.']],
                    ],
                    'post' => [
                        'tags' => ['Usuarios'],
                        'summary' => 'Crear un usuario con rol RBAC asignado (Requiere ADMIN)',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['numero_documento', 'nombre_completo', 'email', 'password', 'rol'],
                                        'properties' => [
                                            'numero_documento' => ['type' => 'string', 'example' => '1099887766'],
                                            'nombre_completo' => ['type' => 'string', 'example' => 'Carlos Alberto Ruiz'],
                                            'email' => ['type' => 'string', 'example' => 'carlos.ruiz@sgbi.edu'],
                                            'password' => ['type' => 'string', 'example' => 'clave123'],
                                            'rol' => ['type' => 'string', 'enum' => ['ADMIN', 'DOCENTE', 'LECTOR'], 'example' => 'LECTOR'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => [
                            '201' => ['description' => 'Usuario creado exitosamente.'],
                            '409' => ['description' => 'Documento o email ya registrado.'],
                        ],
                    ],
                ],
                '/usuarios/{id}' => [
                    'get' => [
                        'tags' => ['Usuarios'],
                        'summary' => 'Consultar usuario por su ID (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => [
                            '200' => ['description' => 'Detalle del usuario.'],
                            '404' => ['description' => 'Usuario no encontrado.'],
                        ],
                    ],
                    'put' => [
                        'tags' => ['Usuarios'],
                        'summary' => 'Actualizar datos, rol o estado de un usuario (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => ['200' => ['description' => 'Usuario actualizado.']],
                    ],
                    'delete' => [
                        'tags' => ['Usuarios'],
                        'summary' => 'Eliminar usuario si no tiene préstamos activos o desactivarlo preventivamente (Requiere ADMIN)',
                        'parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]],
                        'responses' => [
                            '200' => ['description' => 'Usuario eliminado o desactivado.'],
                            '409' => ['description' => 'No se puede eliminar un usuario con préstamos vigentes o la propia cuenta admin.'],
                        ],
                    ],
                ],
                '/ia/buscar' => [
                    'post' => [
                        'tags' => ['IA y Evaluaciones'],
                        'summary' => 'Búsqueda contextual inteligente sobre títulos, sinopsis y descriptores temáticos',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'query' => ['type' => 'string', 'example' => 'vigilancia totalitaria y control del lenguaje'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => ['200' => ['description' => 'Resultados ordenados por relevancia semántica.']],
                    ],
                ],
                '/ia/generar-prueba' => [
                    'post' => [
                        'tags' => ['IA y Evaluaciones'],
                        'summary' => 'Generar cuestionario de lectura pedagógico con IA (Requiere DOCENTE o ADMIN)',
                        'requestBody' => [
                            'required' => true,
                            'content' => [
                                'application/json' => [
                                    'schema' => [
                                        'type' => 'object',
                                        'required' => ['id_libro'],
                                        'properties' => [
                                            'id_libro' => ['type' => 'integer', 'example' => 1],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                        'responses' => ['201' => ['description' => 'Prueba generada y guardada en MySQL.']],
                    ],
                ],
                '/admin/usuarios' => [
                    'get' => [
                        'tags' => ['Administración y Auditoría'],
                        'summary' => 'Listar usuarios del sistema (Requiere ADMIN)',
                        'responses' => ['200' => ['description' => 'Lista de usuarios.']],
                    ],
                    'post' => [
                        'tags' => ['Administración y Auditoría'],
                        'summary' => 'Crear un usuario con rol RBAC (Requiere ADMIN)',
                        'responses' => ['201' => ['description' => 'Usuario creado.']],
                    ],
                ],
                '/admin/metricas' => [
                    'get' => [
                        'tags' => ['Administración y Auditoría'],
                        'summary' => 'Obtener métricas del motor MySQL, índices, tamaño y memoria (Requiere ADMIN)',
                        'responses' => ['200' => ['description' => 'Estadísticas del sistema.']],
                    ],
                ],
                '/admin/auditoria' => [
                    'get' => [
                        'tags' => ['Administración y Auditoría'],
                        'summary' => 'Consultar los últimos 100 eventos de auditoría (Requiere ADMIN)',
                        'security' => [['BearerAuth' => []]],
                        'responses' => ['200' => ['description' => 'Logs del sistema.']],
                    ],
                ],
            ],
            'components' => [
                'securitySchemes' => [
                    'BearerAuth' => [
                        'type' => 'http',
                        'scheme' => 'bearer',
                        'bearerFormat' => 'JWT',
                        'description' => 'Autenticación mediante token JWT en la cabecera: Authorization: Bearer <token>',
                    ],
                ],
            ],
        ];

        Response::json($spec);
    }

    public function renderSwaggerUi(): void {
        $html = <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SGBI · API RESTful Explorer & Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z'/><path d='M6 6h10'/><path d='M6 10h10'/></svg>" />
  <style>
    body {
      margin: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .top-bar-sgbi {
      background: #0f172a;
      color: #ffffff;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #2563eb;
    }
    .brand-title {
      font-size: 1.15rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-status {
      background: #059669;
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .nav-links a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.88rem;
      margin-left: 16px;
      transition: color 0.2s;
    }
    .nav-links a:hover {
      color: #ffffff;
    }
    .swagger-ui .topbar {
      display: none;
    }
    .swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
    }
  </style>
</head>
<body>
  <div class="top-bar-sgbi">
    <div class="brand-title">
      <span>📚 SGBI API RESTful v1.0</span>
      <span class="badge-status">MySQL InnoDB Online</span>
    </div>
    <div class="nav-links">
      <a href="/" target="_blank">💻 Ir al Sitio Web</a>
      <a href="/api/openapi.json" target="_blank">📄 Especificación OpenAPI (JSON)</a>
      <a href="/api/health" target="_blank">🩺 Health Check</a>
    </div>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        docExpansion: "list",
        filter: true
      });
    };
  </script>
</body>
</html>
HTML;

        Response::html($html);
    }
}
