import { Router } from 'express';
import {
  clearSessionCookie,
  setSessionCookie,
  type AuthenticatedRequest,
} from '../auth.ts';
import { db, logSystemEvent, verifyPassword } from '../db.ts';
import { getClientIp } from '../middleware/observability.ts';
import { createRateLimiter } from '../middleware/security.ts';
import { validateBody } from '../middleware/validate.ts';
import type { Usuario } from '../../types/sgbi.ts';

export const authRouter = Router();
const authLimiter = createRateLimiter(20, 60_000);

authRouter.get('/auth/me', (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user ?? null });
});

authRouter.post(
  '/auth/login',
  authLimiter,
  validateBody([
    { field: 'email', required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ingrese un correo electrónico válido.' },
    { field: 'password', required: true, type: 'string', message: 'Debe ingresar su contraseña.' },
  ]),
  (req: AuthenticatedRequest, res) => {
    const { email, password } = req.body as { email: string; password: string };

  const row = db
    .prepare('SELECT * FROM usuarios WHERE lower(email) = lower(?)')
    .get(email.trim()) as (Usuario & { password_hash: string }) | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    logSystemEvent(
      'LOGIN_FALLIDO',
      `Intento fallido de inicio de sesión para ${email.trim()}.`,
      null,
      getClientIp(req),
    );
    return res.status(401).json({ error: 'Credenciales inválidas. Verifique correo y contraseña.' });
  }

  setSessionCookie(res, row.id_usuario);
  logSystemEvent(
    'LOGIN_EXITOSO',
    `Sesión iniciada (${row.rol}): ${row.nombre_completo}.`,
    row.id_usuario,
    getClientIp(req),
  );

  const { password_hash: _ph, ...safeUser } = row;
  return res.json({ user: safeUser });
});

authRouter.post('/auth/logout', (req: AuthenticatedRequest, res) => {
  if (req.user) {
    logSystemEvent(
      'LOGOUT',
      `Cierre de sesión de ${req.user.nombre_completo}.`,
      req.user.id_usuario,
      getClientIp(req),
    );
  }
  clearSessionCookie(res);
  return res.json({ ok: true });
});
