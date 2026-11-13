import { Router } from 'express';
import { requireRole, type AuthenticatedRequest } from '../auth.ts';
import { db, logSystemEvent } from '../db.ts';
import { getClientIp } from '../middleware/observability.ts';
import { validateBody } from '../middleware/validate.ts';
import { semanticSearchCache } from '../services/cacheService.ts';
import {
  CatalogoError,
  createLibro,
  deleteLibro,
  exportCatalogCsv,
  getLibroById,
  listAllLibros,
  updateLibro,
} from '../services/catalogoService.ts';
import type {
  Autor,
  Categoria,
  PruebaLectura,
  PruebaLecturaContenido,
} from '../../types/sgbi.ts';

export const catalogoRouter = Router();

catalogoRouter.get('/libros', (req, res) => {
  const categoriaFilter = typeof req.query.categoria === 'string' ? req.query.categoria.trim() : '';
  const all = listAllLibros();
  const libros =
    categoriaFilter && categoriaFilter !== 'Todas'
      ? all.filter((l) => l.categoria === categoriaFilter)
      : all;
  return res.json({ libros });
});

catalogoRouter.get('/libros/exportar/csv', requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const csv = exportCatalogCsv();
  logSystemEvent(
    'CATALOGO_EXPORTADO_CSV',
    'Exportación completa del inventario bibliográfico en formato CSV.',
    req.user?.id_usuario ?? null,
    getClientIp(req),
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sgbi-catalogo.csv"');
  return res.send(csv);
});

catalogoRouter.get('/libros/:id', (req: AuthenticatedRequest, res) => {
  const idLibro = Number(req.params.id);
  if (!Number.isInteger(idLibro) || idLibro <= 0) {
    return res.status(400).json({ error: 'Identificador de libro inválido.' });
  }
  const libro = getLibroById(idLibro);
  if (!libro) {
    return res.status(404).json({ error: 'Libro no encontrado.' });
  }

  let pruebas: PruebaLectura[] = [];
  if (req.user && (req.user.rol === 'DOCENTE' || req.user.rol === 'ADMIN')) {
    const rows = db
      .prepare(
        `SELECT p.*, u.nombre_completo AS docente_nombre, l.titulo AS libro_titulo
         FROM pruebas_lectura p
         JOIN usuarios u ON u.id_usuario = p.id_docente
         JOIN libros l ON l.id_libro = p.id_libro
         WHERE p.id_libro = ?
         ORDER BY p.id_prueba DESC`,
      )
      .all(idLibro) as Array<{
      id_prueba: number;
      id_libro: number;
      id_docente: number;
      docente_nombre: string;
      libro_titulo: string;
      contenido_json: string;
      created_at: string;
    }>;

    pruebas = rows.map((r) => ({
      id_prueba: r.id_prueba,
      id_libro: r.id_libro,
      id_docente: r.id_docente,
      docente_nombre: r.docente_nombre,
      libro_titulo: r.libro_titulo,
      contenido: JSON.parse(r.contenido_json) as PruebaLecturaContenido,
      created_at: r.created_at,
    }));
  }

  return res.json({ libro, pruebas });
});

catalogoRouter.post(
  '/libros',
  requireRole('ADMIN'),
  validateBody([
    { field: 'isbn', required: true, type: 'string', minLength: 5, message: 'El ISBN es obligatorio (mínimo 5 caracteres).' },
    { field: 'titulo', required: true, type: 'string', minLength: 2, message: 'El título de la obra es obligatorio.' },
  ]),
  (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as {
      isbn?: string;
      titulo?: string;
      sinopsis?: string | null;
      categoria?: string;
      anio_publicacion?: number | null;
      editorial?: string | null;
      idioma?: string | null;
      paginas?: number | null;
      ubicacion_estante?: string | null;
      temas_clave?: string | null;
      copias_totales?: number;
      copias_disp?: number;
      autor_ids?: number[];
    };
    const created = createLibro(
      {
        isbn: String(body.isbn ?? ''),
        titulo: String(body.titulo ?? ''),
        sinopsis: body.sinopsis ?? null,
        categoria: String(body.categoria ?? 'Literatura General'),
        anio_publicacion: body.anio_publicacion ? Number(body.anio_publicacion) : null,
        editorial: body.editorial ?? null,
        idioma: body.idioma ?? 'Español',
        paginas: body.paginas ? Number(body.paginas) : null,
        ubicacion_estante: body.ubicacion_estante ?? null,
        temas_clave: body.temas_clave ?? null,
        copias_totales: Number(body.copias_totales ?? 1),
        copias_disp: Number(body.copias_disp ?? body.copias_totales ?? 1),
        autor_ids: Array.isArray(body.autor_ids) ? body.autor_ids.map(Number) : [],
      },
      req.user?.id_usuario ?? null,
      getClientIp(req),
    );
    return res.status(201).json({ libro: created });
  } catch (err) {
    if (err instanceof CatalogoError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error interno al crear el libro.' });
  }
});

catalogoRouter.put('/libros/:id', requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const idLibro = Number(req.params.id);
  if (!Number.isInteger(idLibro) || idLibro <= 0) {
    return res.status(400).json({ error: 'Identificador inválido.' });
  }
  try {
    const body = req.body as {
      isbn?: string;
      titulo?: string;
      sinopsis?: string | null;
      categoria?: string;
      anio_publicacion?: number | null;
      editorial?: string | null;
      idioma?: string | null;
      paginas?: number | null;
      ubicacion_estante?: string | null;
      temas_clave?: string | null;
      copias_totales?: number;
      copias_disp?: number;
      autor_ids?: number[];
    };
    const updated = updateLibro(
      idLibro,
      {
        isbn: String(body.isbn ?? ''),
        titulo: String(body.titulo ?? ''),
        sinopsis: body.sinopsis ?? null,
        categoria: String(body.categoria ?? 'Literatura General'),
        anio_publicacion: body.anio_publicacion ? Number(body.anio_publicacion) : null,
        editorial: body.editorial ?? null,
        idioma: body.idioma ?? 'Español',
        paginas: body.paginas ? Number(body.paginas) : null,
        ubicacion_estante: body.ubicacion_estante ?? null,
        temas_clave: body.temas_clave ?? null,
        copias_totales: Number(body.copias_totales ?? 1),
        copias_disp: Number(body.copias_disp ?? 0),
        autor_ids: Array.isArray(body.autor_ids) ? body.autor_ids.map(Number) : [],
      },
      req.user?.id_usuario ?? null,
      getClientIp(req),
    );
    return res.json({ libro: updated });
  } catch (err) {
    if (err instanceof CatalogoError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error interno al actualizar el libro.' });
  }
});

catalogoRouter.delete('/libros/:id', requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const idLibro = Number(req.params.id);
  if (!Number.isInteger(idLibro) || idLibro <= 0) {
    return res.status(400).json({ error: 'Identificador inválido.' });
  }
  try {
    deleteLibro(idLibro, req.user?.id_usuario ?? null, getClientIp(req));
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof CatalogoError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error interno al eliminar el libro.' });
  }
});

catalogoRouter.get('/autores', (_req, res) => {
  const autores = db
    .prepare('SELECT * FROM autores ORDER BY nombre ASC')
    .all() as Autor[];
  return res.json({ autores });
});

catalogoRouter.post(
  '/autores',
  requireRole('ADMIN'),
  validateBody([
    { field: 'nombre', required: true, type: 'string', minLength: 2, message: 'El nombre del autor es obligatorio.' },
  ]),
  (req: AuthenticatedRequest, res) => {
    const { nombre, nacionalidad } = req.body as { nombre: string; nacionalidad?: string | null };
  const result = db
    .prepare('INSERT INTO autores (nombre, nacionalidad) VALUES (?, ?)')
    .run(nombre.trim(), nacionalidad?.trim() || null);
  const autor = db
    .prepare('SELECT * FROM autores WHERE id_autor = ?')
    .get(Number(result.lastInsertRowid)) as Autor;

  logSystemEvent(
    'AUTOR_CREADO',
    `Autor registrado: ${autor.nombre}.`,
    req.user?.id_usuario ?? null,
    getClientIp(req),
  );
  return res.status(201).json({ autor });
});

catalogoRouter.get('/categorias', (_req, res) => {
  const categorias = db
    .prepare(
      `SELECT
         c.*,
         COUNT(l.id_libro) AS libros_count,
         COALESCE(SUM(l.copias_disp), 0) AS copias_disp_sum
       FROM categorias c
       LEFT JOIN libros l ON l.categoria = c.nombre
       GROUP BY c.id_categoria
       ORDER BY c.nombre ASC`,
    )
    .all() as Categoria[];
  return res.json({ categorias });
});

catalogoRouter.post(
  '/categorias',
  requireRole('ADMIN'),
  validateBody([
    { field: 'nombre', required: true, type: 'string', minLength: 2, message: 'El nombre de la categoría es obligatorio.' },
    { field: 'descripcion', required: true, type: 'string', minLength: 10, message: 'La descripción de la categoría debe tener al menos 10 caracteres.' },
  ]),
  (req: AuthenticatedRequest, res) => {
    const { nombre, codigo_archivo, descripcion, ubicacion_sala, publico_recomendado, enfoque_lector } =
      req.body as {
        nombre: string;
        codigo_archivo?: string;
        descripcion: string;
        ubicacion_sala?: string;
        publico_recomendado?: string;
        enfoque_lector?: string;
      };
  try {
    const result = db
      .prepare(
        `INSERT INTO categorias (nombre, codigo_archivo, descripcion, ubicacion_sala, publico_recomendado, enfoque_lector)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        nombre.trim(),
        codigo_archivo?.trim() || '000',
        descripcion.trim(),
        ubicacion_sala?.trim() || 'Sala General',
        publico_recomendado?.trim() || 'Público general',
        enfoque_lector?.trim() || 'Lectura integral',
      );
    const categoria = db
      .prepare('SELECT * FROM categorias WHERE id_categoria = ?')
      .get(Number(result.lastInsertRowid)) as Categoria;
    semanticSearchCache.invalidateAll();
    logSystemEvent(
      'CATEGORIA_CREADA',
      `Categoría "${categoria.nombre}" (${categoria.codigo_archivo}) creada.`,
      req.user?.id_usuario ?? null,
      getClientIp(req),
    );
    return res.status(201).json({ categoria });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({ error: `La categoría "${nombre.trim()}" ya existe.` });
    }
    return res.status(500).json({ error: 'Error al registrar la categoría.' });
  }
});

catalogoRouter.put('/categorias/:id', requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const idCategoria = Number(req.params.id);
  const { nombre, codigo_archivo, descripcion, ubicacion_sala, publico_recomendado, enfoque_lector } =
    req.body as {
      nombre?: string;
      codigo_archivo?: string;
      descripcion?: string;
      ubicacion_sala?: string;
      publico_recomendado?: string;
      enfoque_lector?: string;
    };
  if (!Number.isInteger(idCategoria) || idCategoria <= 0 || !nombre?.trim() || !descripcion?.trim()) {
    return res.status(400).json({ error: 'Datos de categoría inválidos.' });
  }
  const existing = db
    .prepare('SELECT * FROM categorias WHERE id_categoria = ?')
    .get(idCategoria) as Categoria | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Categoría no encontrada.' });
  }
  try {
    db.transaction(() => {
      db.prepare(
        `UPDATE categorias
         SET nombre = ?, codigo_archivo = ?, descripcion = ?, ubicacion_sala = ?, publico_recomendado = ?, enfoque_lector = ?
         WHERE id_categoria = ?`,
      ).run(
        nombre.trim(),
        codigo_archivo?.trim() || existing.codigo_archivo,
        descripcion.trim(),
        ubicacion_sala?.trim() || existing.ubicacion_sala,
        publico_recomendado?.trim() || existing.publico_recomendado,
        enfoque_lector?.trim() || existing.enfoque_lector,
        idCategoria,
      );
      if (existing.nombre !== nombre.trim()) {
        db.prepare('UPDATE libros SET categoria = ? WHERE categoria = ?').run(
          nombre.trim(),
          existing.nombre,
        );
      }
    })();
    semanticSearchCache.invalidateAll();
    const updated = db
      .prepare('SELECT * FROM categorias WHERE id_categoria = ?')
      .get(idCategoria) as Categoria;
    return res.json({ categoria: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({ error: `Ya existe una categoría llamada "${nombre.trim()}".` });
    }
    return res.status(500).json({ error: 'Error al actualizar la categoría.' });
  }
});
