import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../auth.ts';
import { db } from '../db.ts';
import { getClientIp } from '../middleware/observability.ts';
import { validateBody } from '../middleware/validate.ts';
import {
  CirculacionError,
  calcularFechaLimite,
  registrarDevolucion,
  registrarPrestamo,
} from '../services/circulacionService.ts';
import type { Prestamo } from '../../types/sgbi.ts';

export const circulacionRouter = Router();

circulacionRouter.get('/prestamos/calcular-fecha', requireRole('ADMIN'), (_req, res) => {
  const hoy = new Date();
  return res.json({
    fecha_prestamo: hoy.toISOString().slice(0, 10),
    fecha_limite: calcularFechaLimite(hoy, 8),
    dias_habiles: 8,
  });
});

circulacionRouter.get('/prestamos', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const isAdmin = user.rol === 'ADMIN';

  const sql = `
    SELECT
      p.*,
      l.titulo AS libro_titulo,
      l.isbn AS libro_isbn,
      u.nombre_completo AS usuario_nombre,
      u.numero_documento AS usuario_documento,
      u.estado AS usuario_estado
    FROM prestamos p
    JOIN libros l ON l.id_libro = p.id_libro
    JOIN usuarios u ON u.id_usuario = p.id_usuario
    ${isAdmin ? '' : 'WHERE p.id_usuario = ?'}
    ORDER BY
      CASE WHEN p.estado = 'MORA' AND p.fecha_entrega IS NULL THEN 0
           WHEN p.estado = 'ACTIVO' THEN 1
           ELSE 2 END,
      p.id_prestamo DESC
  `;

  const prestamos = (isAdmin
    ? db.prepare(sql).all()
    : db.prepare(sql).all(user.id_usuario)) as Prestamo[];

  return res.json({ prestamos });
});

circulacionRouter.post(
  '/prestamos',
  requireRole('ADMIN'),
  validateBody([
    { field: 'id_libro', required: true, type: 'number', min: 1, message: 'Debe seleccionar un libro válido.' },
    { field: 'id_usuario', required: true, type: 'number', min: 1, message: 'Debe seleccionar un lector válido.' },
  ]),
  (req: AuthenticatedRequest, res) => {
    const { id_libro, id_usuario } = req.body as { id_libro: number; id_usuario: number };
    const libroId = Number(id_libro);
    const usuarioId = Number(id_usuario);

    if (!Number.isInteger(libroId) || !Number.isInteger(usuarioId)) {
      return res.status(400).json({ error: 'Debe seleccionar un lector y un libro válidos.' });
    }

  try {
    const prestamo = registrarPrestamo(
      libroId,
      usuarioId,
      req.user?.id_usuario ?? null,
      getClientIp(req),
    );
    return res.status(201).json({ prestamo });
  } catch (err) {
    if (err instanceof CirculacionError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'Error transaccional al registrar el préstamo.' });
  }
});

circulacionRouter.post('/prestamos/:id/devolver', requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const prestamoId = Number(req.params.id);
  if (!Number.isInteger(prestamoId) || prestamoId <= 0) {
    return res.status(400).json({ error: 'Folio de préstamo inválido.' });
  }

  try {
    const result = registrarDevolucion(
      prestamoId,
      req.user?.id_usuario ?? null,
      getClientIp(req),
    );
    return res.json(result);
  } catch (err) {
    if (err instanceof CirculacionError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: 'Error transaccional al registrar la devolución.' });
  }
});
