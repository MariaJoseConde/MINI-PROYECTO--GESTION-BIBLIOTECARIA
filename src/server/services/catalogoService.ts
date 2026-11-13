import { db, logSystemEvent } from '../db.ts';
import { semanticSearchCache } from './cacheService.ts';
import type { Autor, Libro } from '../../types/sgbi.ts';

export class CatalogoError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RawLibroRow {
  id_libro: number;
  isbn: string;
  titulo: string;
  sinopsis: string | null;
  categoria: string;
  anio_publicacion: number | null;
  editorial: string | null;
  idioma: string;
  paginas: number | null;
  ubicacion_estante: string | null;
  temas_clave: string | null;
  copias_totales: number;
  copias_disp: number;
  created_at: string;
  pruebas_count: number;
}

function hydrateLibros(rows: RawLibroRow[]): Libro[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id_libro);
  const placeholders = ids.map(() => '?').join(',');
  const autorRows = db
    .prepare(
      `SELECT la.id_libro, a.id_autor, a.nombre, a.nacionalidad, a.created_at
       FROM libro_autor la
       JOIN autores a ON a.id_autor = la.id_autor
       WHERE la.id_libro IN (${placeholders})
       ORDER BY a.nombre ASC`,
    )
    .all(...ids) as Array<Autor & { id_libro: number }>;

  const autoresMap = new Map<number, Autor[]>();
  for (const ar of autorRows) {
    const list = autoresMap.get(ar.id_libro) || [];
    list.push({
      id_autor: ar.id_autor,
      nombre: ar.nombre,
      nacionalidad: ar.nacionalidad,
      created_at: ar.created_at,
    });
    autoresMap.set(ar.id_libro, list);
  }

  return rows.map((r) => ({
    ...r,
    autores: autoresMap.get(r.id_libro) || [],
  }));
}

export function listAllLibros(): Libro[] {
  const rows = db
    .prepare(
      `SELECT l.*,
              (SELECT COUNT(*) FROM pruebas_lectura pl WHERE pl.id_libro = l.id_libro) AS pruebas_count
       FROM libros l
       ORDER BY l.id_libro DESC`,
    )
    .all() as RawLibroRow[];
  return hydrateLibros(rows);
}

export function getLibroById(idLibro: number): Libro | null {
  const row = db
    .prepare(
      `SELECT l.*,
              (SELECT COUNT(*) FROM pruebas_lectura pl WHERE pl.id_libro = l.id_libro) AS pruebas_count
       FROM libros l
       WHERE l.id_libro = ?`,
    )
    .get(idLibro) as RawLibroRow | undefined;
  if (!row) return null;
  return hydrateLibros([row])[0] ?? null;
}

export function getLibrosByIds(ids: number[]): Libro[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT l.*,
              (SELECT COUNT(*) FROM pruebas_lectura pl WHERE pl.id_libro = l.id_libro) AS pruebas_count
       FROM libros l
       WHERE l.id_libro IN (${placeholders})`,
    )
    .all(...ids) as RawLibroRow[];

  const hydrated = hydrateLibros(rows);
  const byId = new Map(hydrated.map((b) => [b.id_libro, b]));
  return ids.map((id) => byId.get(id)).filter((b): b is Libro => Boolean(b));
}

export function searchLibrosLocal(query: string): Libro[] {
  const q = query.trim();
  if (!q) return listAllLibros();

  // Intentar primero FTS5 sanitizado, y respaldar con LIKE en título/sinopsis/autor/ISBN
  const tokens = q
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  let ftsIds: number[] = [];
  if (tokens.length > 0) {
    try {
      const ftsQuery = tokens.map((t) => `"${t}"*`).join(' OR ');
      const ftsRows = db
        .prepare(
          `SELECT rowid AS id_libro FROM libros_fts WHERE libros_fts MATCH ? ORDER BY rank LIMIT 30`,
        )
        .all(ftsQuery) as Array<{ id_libro: number }>;
      ftsIds = ftsRows.map((r) => r.id_libro);
    } catch {
      ftsIds = [];
    }
  }

  const likePattern = `%${q}%`;
  const likeRows = db
    .prepare(
      `SELECT DISTINCT l.id_libro
       FROM libros l
       LEFT JOIN libro_autor la ON la.id_libro = l.id_libro
       LEFT JOIN autores a ON a.id_autor = la.id_autor
       WHERE l.titulo LIKE ? OR l.sinopsis LIKE ? OR l.isbn LIKE ? OR l.categoria LIKE ? OR a.nombre LIKE ?`,
    )
    .all(likePattern, likePattern, likePattern, likePattern, likePattern) as Array<{
    id_libro: number;
  }>;

  const combinedIds = Array.from(new Set([...ftsIds, ...likeRows.map((r) => r.id_libro)]));
  return getLibrosByIds(combinedIds);
}

export interface SaveLibroInput {
  isbn: string;
  titulo: string;
  sinopsis: string | null;
  categoria: string;
  anio_publicacion: number | null;
  editorial?: string | null;
  idioma?: string | null;
  paginas?: number | null;
  ubicacion_estante?: string | null;
  temas_clave?: string | null;
  copias_totales: number;
  copias_disp: number;
  autor_ids: number[];
}

export function createLibro(
  input: SaveLibroInput,
  actorId: number | null,
  ipOrigen: string | null,
): Libro {
  if (!input.isbn.trim() || !input.titulo.trim()) {
    throw new CatalogoError('El ISBN y el título son obligatorios.', 400);
  }
  if (input.copias_totales < 1) {
    throw new CatalogoError('Las copias totales deben ser al menos 1.', 400);
  }
  if (input.copias_disp < 0 || input.copias_disp > input.copias_totales) {
    throw new CatalogoError(
      'Las copias disponibles no pueden ser negativas ni superar las copias totales.',
      400,
    );
  }
  if (!input.autor_ids || input.autor_ids.length === 0) {
    throw new CatalogoError('Debe asociar al menos un autor al libro.', 400);
  }

  try {
    const idLibro = db.transaction(() => {
      const catNombre = input.categoria.trim() || 'Literatura General';
      db.prepare(
        `INSERT OR IGNORE INTO categorias (nombre, codigo_archivo, descripcion) VALUES (?, '800', ?)`,
      ).run(catNombre, `Colección temática de obras clasificadas en ${catNombre}.`);

      const res = db
        .prepare(
          `INSERT INTO libros (isbn, titulo, sinopsis, categoria, anio_publicacion, editorial, idioma, paginas, ubicacion_estante, temas_clave, copias_totales, copias_disp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.isbn.trim(),
          input.titulo.trim(),
          input.sinopsis?.trim() || null,
          catNombre,
          input.anio_publicacion,
          input.editorial?.trim() || null,
          input.idioma?.trim() || 'Español',
          input.paginas ?? null,
          input.ubicacion_estante?.trim() || null,
          input.temas_clave?.trim() || null,
          input.copias_totales,
          input.copias_disp,
        );
      const newId = Number(res.lastInsertRowid);
      const insertLA = db.prepare('INSERT INTO libro_autor (id_libro, id_autor) VALUES (?, ?)');
      for (const autorId of input.autor_ids) {
        insertLA.run(newId, autorId);
      }

      logSystemEvent(
        'LIBRO_CREADO',
        `Libro "${input.titulo.trim()}" (ISBN: ${input.isbn.trim()}) registrado con ${input.copias_totales} copias.`,
        actorId,
        ipOrigen,
      );
      return newId;
    })();

    semanticSearchCache.invalidateAll();
    return getLibroById(idLibro)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE constraint failed: libros.isbn')) {
      throw new CatalogoError(`Ya existe un libro registrado con el ISBN ${input.isbn}.`, 409);
    }
    throw err;
  }
}

export function updateLibro(
  idLibro: number,
  input: SaveLibroInput,
  actorId: number | null,
  ipOrigen: string | null,
): Libro {
  if (!input.isbn.trim() || !input.titulo.trim()) {
    throw new CatalogoError('El ISBN y el título son obligatorios.', 400);
  }
  if (input.copias_totales < 1) {
    throw new CatalogoError('Las copias totales deben ser al menos 1.', 400);
  }
  if (input.copias_disp < 0 || input.copias_disp > input.copias_totales) {
    throw new CatalogoError(
      'Las copias disponibles no pueden ser negativas ni superar las copias totales.',
      400,
    );
  }
  if (!input.autor_ids || input.autor_ids.length === 0) {
    throw new CatalogoError('Debe asociar al menos un autor al libro.', 400);
  }

  try {
    db.transaction(() => {
      const existing = db.prepare('SELECT id_libro FROM libros WHERE id_libro = ?').get(idLibro);
      if (!existing) {
        throw new CatalogoError('Libro no encontrado.', 404);
      }

      const catNombre = input.categoria.trim() || 'Literatura General';
      db.prepare(
        `INSERT OR IGNORE INTO categorias (nombre, codigo_archivo, descripcion) VALUES (?, '800', ?)`,
      ).run(catNombre, `Colección temática de obras clasificadas en ${catNombre}.`);

      db.prepare(
        `UPDATE libros
         SET isbn = ?, titulo = ?, sinopsis = ?, categoria = ?, anio_publicacion = ?,
             editorial = ?, idioma = ?, paginas = ?, ubicacion_estante = ?, temas_clave = ?,
             copias_totales = ?, copias_disp = ?
         WHERE id_libro = ?`,
      ).run(
        input.isbn.trim(),
        input.titulo.trim(),
        input.sinopsis?.trim() || null,
        catNombre,
        input.anio_publicacion,
        input.editorial?.trim() || null,
        input.idioma?.trim() || 'Español',
        input.paginas ?? null,
        input.ubicacion_estante?.trim() || null,
        input.temas_clave?.trim() || null,
        input.copias_totales,
        input.copias_disp,
        idLibro,
      );

      db.prepare('DELETE FROM libro_autor WHERE id_libro = ?').run(idLibro);
      const insertLA = db.prepare('INSERT INTO libro_autor (id_libro, id_autor) VALUES (?, ?)');
      for (const autorId of input.autor_ids) {
        insertLA.run(idLibro, autorId);
      }

      logSystemEvent(
        'LIBRO_ACTUALIZADO',
        `Libro #${idLibro} "${input.titulo.trim()}" actualizado (Stock: ${input.copias_disp}/${input.copias_totales}).`,
        actorId,
        ipOrigen,
      );
    })();

    semanticSearchCache.invalidateAll();
    return getLibroById(idLibro)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE constraint failed: libros.isbn')) {
      throw new CatalogoError(`El ISBN ${input.isbn} ya pertenece a otro ejemplar.`, 409);
    }
    throw err;
  }
}

export function deleteLibro(
  idLibro: number,
  actorId: number | null,
  ipOrigen: string | null,
): void {
  const existing = db
    .prepare('SELECT id_libro, titulo FROM libros WHERE id_libro = ?')
    .get(idLibro) as { id_libro: number; titulo: string } | undefined;

  if (!existing) {
    throw new CatalogoError('Libro no encontrado.', 404);
  }

  try {
    db.prepare('DELETE FROM libros WHERE id_libro = ?').run(idLibro);
    semanticSearchCache.invalidateAll();
    logSystemEvent(
      'LIBRO_ELIMINADO',
      `Libro #${idLibro} "${existing.titulo}" eliminado del catálogo.`,
      actorId,
      ipOrigen,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('FOREIGN KEY constraint failed')) {
      throw new CatalogoError(
        'No es posible eliminar el libro porque posee registros de préstamo asociados (integridad referencial ON DELETE RESTRICT).',
        409,
      );
    }
    throw err;
  }
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCatalogCsv(): string {
  const libros = listAllLibros();
  const headers = [
    'ID',
    'ISBN',
    'Titulo',
    'Autores',
    'Categoria',
    'Anio',
    'Editorial',
    'Idioma',
    'Paginas',
    'Ubicacion_Estante',
    'Temas_Clave',
    'Copias_Disponibles',
    'Copias_Totales',
  ];

  const rows = libros.map((l) =>
    [
      l.id_libro,
      l.isbn,
      l.titulo,
      l.autores.map((a) => a.nombre).join('; '),
      l.categoria,
      l.anio_publicacion ?? '',
      l.editorial ?? '',
      l.idioma ?? '',
      l.paginas ?? '',
      l.ubicacion_estante ?? '',
      l.temas_clave ?? '',
      l.copias_disp,
      l.copias_totales,
    ]
      .map(escapeCsvCell)
      .join(','),
  );

  return `\uFEFF${[headers.join(','), ...rows].join('\n')}`;
}
