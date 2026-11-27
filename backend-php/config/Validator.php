<?php
/**
 * SGBI / biblioSmart - Utilidad Centralizada de Validación de Entradas y Consistencia
 */

declare(strict_types=1);

namespace Sgbi\Config;

class Validator {
    public static function validateLibroPayload(array $body, ?array $existing = null): array {
        $errors = [];

        $isbn = trim((string)($body['isbn'] ?? ($existing['isbn'] ?? '')));
        $titulo = trim((string)($body['titulo'] ?? ($existing['titulo'] ?? '')));
        $categoria = trim((string)($body['categoria'] ?? ($existing['categoria'] ?? 'Literatura General')));

        if ($isbn === '' || mb_strlen($isbn) < 5 || mb_strlen($isbn) > 30) {
            $errors['isbn'] = 'El ISBN es obligatorio y debe tener entre 5 y 30 caracteres.';
        }

        if ($titulo === '' || mb_strlen($titulo) > 255) {
            $errors['titulo'] = 'El título es obligatorio y no puede superar 255 caracteres.';
        }

        if ($categoria === '' || mb_strlen($categoria) > 150) {
            $errors['categoria'] = 'La categoría es obligatoria (máximo 150 caracteres).';
        }

        $copiasTotalesRaw = $body['copias_totales'] ?? ($existing['copias_totales'] ?? 1);
        $copiasTotales = filter_var($copiasTotalesRaw, FILTER_VALIDATE_INT);
        if ($copiasTotales === false || $copiasTotales < 1) {
            $errors['copias_totales'] = 'Las copias totales deben ser un número entero mayor o igual a 1.';
            $copiasTotales = 1;
        }

        $copiasDispRaw = array_key_exists('copias_disp', $body)
            ? $body['copias_disp']
            : ($existing ? $existing['copias_disp'] : $copiasTotales);
        $copiasDisp = filter_var($copiasDispRaw, FILTER_VALIDATE_INT);
        if ($copiasDisp === false || $copiasDisp < 0) {
            $errors['copias_disp'] = 'Las copias disponibles no pueden ser negativas.';
        } elseif ($copiasDisp > $copiasTotales) {
            $errors['copias_disp'] = "Las copias disponibles ({$copiasDisp}) no pueden superar las copias totales ({$copiasTotales}).";
        }

        $anio = array_key_exists('anio_publicacion', $body)
            ? $body['anio_publicacion']
            : ($existing['anio_publicacion'] ?? null);
        if ($anio !== null && $anio !== '') {
            $anioInt = filter_var($anio, FILTER_VALIDATE_INT);
            $maxYear = (int)date('Y') + 1;
            if ($anioInt === false || $anioInt < -3000 || $anioInt > $maxYear) {
                $errors['anio_publicacion'] = "El año de publicación debe estar entre -3000 y {$maxYear}.";
            } else {
                $anio = $anioInt;
            }
        } else {
            $anio = null;
        }

        $paginas = array_key_exists('paginas', $body)
            ? $body['paginas']
            : ($existing['paginas'] ?? null);
        if ($paginas !== null && $paginas !== '') {
            $paginasInt = filter_var($paginas, FILTER_VALIDATE_INT);
            if ($paginasInt === false || $paginasInt < 1) {
                $errors['paginas'] = 'El número de páginas debe ser un entero positivo mayor a 0.';
            } else {
                $paginas = $paginasInt;
            }
        } else {
            $paginas = null;
        }

        if (!empty($errors)) {
            $firstMessage = reset($errors);
            Response::error((string)$firstMessage, 422, 'VALIDATION_ERROR', $errors);
        }

        return [
            'isbn' => $isbn,
            'titulo' => $titulo,
            'categoria' => $categoria,
            'anio_publicacion' => $anio,
            'paginas' => $paginas,
            'copias_totales' => (int)$copiasTotales,
            'copias_disp' => (int)$copiasDisp,
        ];
    }

    public static function validateEmail(string $email): void {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('El formato del correo electrónico es inválido.', 422, 'INVALID_EMAIL', [
                'email' => 'Ingrese un correo electrónico válido.',
            ]);
        }
    }

    public static function validateUserRole(string $rol): void {
        if (!in_array($rol, ['ADMIN', 'DOCENTE', 'LECTOR'], true)) {
            Response::error('Rol inválido. Valores permitidos: ADMIN, DOCENTE, LECTOR.', 422, 'INVALID_ROLE', [
                'rol' => 'Rol no permitido.',
            ]);
        }
    }

    public static function validateUserStatus(string $estado): void {
        if (!in_array($estado, ['ACTIVO', 'SANCIONADO', 'INACTIVO'], true)) {
            Response::error('Estado de usuario inválido. Valores permitidos: ACTIVO, SANCIONADO, INACTIVO.', 422, 'INVALID_STATUS', [
                'estado' => 'Estado no permitido.',
            ]);
        }
    }
}
