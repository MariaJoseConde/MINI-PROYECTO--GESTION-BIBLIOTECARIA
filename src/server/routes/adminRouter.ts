import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import { requireRole, type AuthenticatedRequest } from '../auth.ts';
import { db, getDatabaseStats, hashPassword, logSystemEvent } from '../db.ts';
import { getApiTelemetry, getClientIp } from '../middleware/observability.ts';
import { validateBody } from '../middleware/validate.ts';
import { semanticSearchCache } from '../services/cacheService.ts';
import { checkGeminiConnectivity } from '../services/geminiService.ts';
import type {
  InfraestructuraMetrics,
  LogSistema,
  UserRole,
  UserStatus,
  Usuario,
} from '../../types/sgbi.ts';

export const adminRouter = Router();

adminRouter.get('/usuarios', requireRole('ADMIN'), (req, res) => {
  const doc = typeof req.query.documento === 'string' ? req.query.documento.trim() : '';
  if (doc) {
    const usuarios = db
      .prepare(
        `SELECT id_usuario, numero_documento, nombre_completo, email, rol, estado, created_at
         FROM usuarios
         WHERE numero_documento LIKE ? OR lower(nombre_completo) LIKE lower(?)
         ORDER BY nombre_completo ASC`,
      )
      .all(`%${doc}%`, `%${doc}%`) as Usuario[];
    return res.json({ usuarios });
  }

  const usuarios = db
    .prepare(
      `SELECT id_usuario, numero_documento, nombre_completo, email, rol, estado, created_at
       FROM usuarios
       ORDER BY id_usuario ASC`,
    )
    .all() as Usuario[];
  return res.json({ usuarios });
});

adminRouter.post(
  '/usuarios',
  requireRole('ADMIN'),
  validateBody([
    { field: 'numero_documento', required: true, type: 'string', minLength: 4, message: 'El número de documento es obligatorio (mínimo 4 caracteres).' },
    { field: 'nombre_completo', required: true, type: 'string', minLength: 3, message: 'El nombre completo es obligatorio.' },
    { field: 'email', required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ingresa un correo electrónico válido.' },
    { field: 'password', required: true, type: 'string', minLength: 6, message: 'La contraseña debe tener al menos 6 caracteres.' },
  ]),
  (req: AuthenticatedRequest, res) => {
    const { numero_documento, nombre_completo, email, password, rol } = req.body as {
      numero_documento: string;
      nombre_completo: string;
      email: string;
      password: string;
      rol?: UserRole;
    };

  const validRoles: UserRole[] = ['ADMIN', 'DOCENTE', 'LECTOR'];
  const assignedRole: UserRole = rol && validRoles.includes(rol) ? rol : 'LECTOR';

  try {
    const result = db
      .prepare(
        `INSERT INTO usuarios (numero_documento, nombre_completo, email, password_hash, rol, estado)
         VALUES (?, ?, ?, ?, ?, 'ACTIVO')`,
      )
      .run(
        numero_documento.trim(),
        nombre_completo.trim(),
        email.trim().toLowerCase(),
        hashPassword(password),
        assignedRole,
      );

    const created = db
      .prepare(
        `SELECT id_usuario, numero_documento, nombre_completo, email, rol, estado, created_at
         FROM usuarios WHERE id_usuario = ?`,
      )
      .get(Number(result.lastInsertRowid)) as Usuario;

    logSystemEvent(
      'USUARIO_CREADO',
      `Usuario ${created.nombre_completo} (${created.rol}, Doc: ${created.numero_documento}) creado.`,
      req.user?.id_usuario ?? null,
      getClientIp(req),
    );
    return res.status(201).json({ usuario: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('UNIQUE')) {
      return res.status(409).json({
        error: 'Ya existe un usuario registrado con ese número de documento o correo electrónico.',
      });
    }
    return res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
});

adminRouter.patch('/usuarios/:id/estado', requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  const idUsuario = Number(req.params.id);
  const { estado } = req.body as { estado?: UserStatus };

  if (!Number.isInteger(idUsuario) || idUsuario <= 0 || (estado !== 'ACTIVO' && estado !== 'SANCIONADO')) {
    return res.status(400).json({ error: 'Estado o identificador de usuario inválido.' });
  }

  const target = db
    .prepare('SELECT id_usuario, nombre_completo, estado FROM usuarios WHERE id_usuario = ?')
    .get(idUsuario) as { id_usuario: number; nombre_completo: string; estado: UserStatus } | undefined;

  if (!target) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  db.prepare('UPDATE usuarios SET estado = ? WHERE id_usuario = ?').run(estado, idUsuario);
  logSystemEvent(
    'USUARIO_ESTADO_CAMBIADO',
    `Estado de ${target.nombre_completo} actualizado de ${target.estado} a ${estado}.`,
    req.user?.id_usuario ?? null,
    getClientIp(req),
  );

  const updated = db
    .prepare(
      `SELECT id_usuario, numero_documento, nombre_completo, email, rol, estado, created_at
       FROM usuarios WHERE id_usuario = ?`,
    )
    .get(idUsuario) as Usuario;

  return res.json({ usuario: updated });
});

adminRouter.get('/logs', requireRole('ADMIN'), (_req, res) => {
  const logs = db
    .prepare(
      `SELECT l.*, u.nombre_completo AS usuario_nombre
       FROM logs_sistema l
       LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
       ORDER BY l.id_log DESC
       LIMIT 60`,
    )
    .all() as LogSistema[];
  return res.json({ logs });
});

adminRouter.get('/admin/infraestructura', requireRole('ADMIN'), async (_req, res) => {
  const mem = process.memoryUsage();
  const api = getApiTelemetry();
  const database = getDatabaseStats();
  const cacheStats = semanticSearchCache.getStats();
  const iaStatus = await checkGeminiConnectivity();

  const metrics: InfraestructuraMetrics = {
    server: {
      uptimeSeconds: api.uptimeSeconds,
      nodeVersion: process.version,
      memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      environment: process.env.NODE_ENV || 'development',
    },
    api: {
      totalRequests: api.totalRequests,
      errorRequests: api.errorRequests,
      avgLatencyMs: api.avgLatencyMs,
      p95LatencyMs: api.p95LatencyMs,
      recentTraces: api.recentTraces,
    },
    database,
    iaCache: {
      ...cacheStats,
      geminiConfigured: iaStatus.ok,
    },
  };

  return res.json({ metrics });
});

adminRouter.post('/admin/cache/limpiar', requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  semanticSearchCache.invalidateAll();
  logSystemEvent(
    'CACHE_IA_LIMPIADA',
    'Caché semántica de búsqueda limpiada manualmente por administrador.',
    req.user?.id_usuario ?? null,
    getClientIp(req),
  );
  return res.json({ ok: true });
});

adminRouter.get('/admin/respaldo', requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const tmpFile = path.join(os.tmpdir(), `sgbi-backup-${Date.now()}.db`);
  try {
    await db.backup(tmpFile);
    logSystemEvent(
      'RESPALDO_SQLITE',
      'Copia de seguridad consistente de base de datos generada y descargada.',
      req.user?.id_usuario ?? null,
      getClientIp(req),
    );
    return res.download(tmpFile, `sgbi-respaldo-${new Date().toISOString().slice(0, 10)}.db`, () => {
      fs.unlink(tmpFile, () => {});
    });
  } catch (err) {
    fs.unlink(tmpFile, () => {});
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'No fue posible generar el respaldo de SQLite.',
    });
  }
});
