import { Router } from 'express';
import { requireRole, type AuthenticatedRequest } from '../auth.ts';
import { db, logSystemEvent } from '../db.ts';
import { getClientIp } from '../middleware/observability.ts';
import { createRateLimiter } from '../middleware/security.ts';
import { getLibroById } from '../services/catalogoService.ts';
import { buscarSemantica, generarYGuardarPrueba } from '../services/geminiService.ts';
import type { PruebaLectura, PruebaLecturaContenido } from '../../types/sgbi.ts';

export const iaRouter = Router();
const iaLimiter = createRateLimiter(30, 60_000);

iaRouter.post('/ia/buscar', iaLimiter, async (req: AuthenticatedRequest, res) => {
  const { query, useIa = true, simulateFailure = false } = req.body as {
    query?: string;
    useIa?: boolean;
    simulateFailure?: boolean;
  };
  const result = await buscarSemantica(
    String(query ?? ''),
    Boolean(useIa),
    req.user?.id_usuario ?? null,
    getClientIp(req),
    Boolean(simulateFailure),
  );
  return res.json(result);
});

iaRouter.post(
  '/ia/generar-prueba',
  iaLimiter,
  requireRole('DOCENTE', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const { id_libro } = req.body as { id_libro?: number };
    const libroId = Number(id_libro);
    if (!Number.isInteger(libroId) || libroId <= 0) {
      return res.status(400).json({ error: 'Debe indicar un libro válido.' });
    }

    const libro = getLibroById(libroId);
    if (!libro) {
      return res.status(404).json({ error: 'Libro no encontrado.' });
    }
    if (!libro.sinopsis || libro.sinopsis.trim().length < 20) {
      return res.status(400).json({
        error: 'Este libro no posee sinopsis descriptiva registrada para generar una evaluación.',
      });
    }

    try {
      const prueba = await generarYGuardarPrueba(
        libro,
        req.user!.id_usuario,
        getClientIp(req),
      );
      return res.status(201).json({ prueba });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No fue posible procesar la evaluación.';
      logSystemEvent(
        'IA_PRUEBA_ERROR',
        `Fallo generando prueba para libro #${libroId}: ${msg}`,
        req.user!.id_usuario,
        getClientIp(req),
      );
      return res.status(502).json({ error: msg });
    }
  },
);

iaRouter.get('/pruebas', requireRole('DOCENTE', 'ADMIN'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.nombre_completo AS docente_nombre, l.titulo AS libro_titulo
       FROM pruebas_lectura p
       JOIN usuarios u ON u.id_usuario = p.id_docente
       JOIN libros l ON l.id_libro = p.id_libro
       ORDER BY p.id_prueba DESC`,
    )
    .all() as Array<{
    id_prueba: number;
    id_libro: number;
    id_docente: number;
    docente_nombre: string;
    libro_titulo: string;
    contenido_json: string;
    created_at: string;
  }>;

  const pruebas: PruebaLectura[] = rows.map((r) => ({
    id_prueba: r.id_prueba,
    id_libro: r.id_libro,
    id_docente: r.id_docente,
    docente_nombre: r.docente_nombre,
    libro_titulo: r.libro_titulo,
    contenido: JSON.parse(r.contenido_json) as PruebaLecturaContenido,
    created_at: r.created_at,
  }));

  return res.json({ pruebas });
});
