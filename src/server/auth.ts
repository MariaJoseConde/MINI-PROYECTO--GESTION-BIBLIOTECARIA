import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';
import type { UserRole, Usuario } from '../types/sgbi.ts';

const COOKIE_NAME = 'sgbi_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'sgbi-local-dev-secret-key-2026';

export interface AuthenticatedRequest extends Request {
  user?: Usuario | null;
}

interface SessionPayload {
  uid: number;
  exp: number;
}

function signPayload(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || typeof parsed.uid !== 'number' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = decodeURIComponent(part.slice(eqIdx + 1).trim());
    out[k] = v;
  }
  return out;
}

export function setSessionCookie(res: Response, userId: number) {
  const token = signPayload({
    uid: userId,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function attachSessionUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  req.user = null;
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[COOKIE_NAME];
  if (!rawToken) {
    return next();
  }
  const payload = verifyToken(rawToken);
  if (!payload) {
    return next();
  }
  const row = db
    .prepare(
      `SELECT id_usuario, numero_documento, nombre_completo, email, rol, estado, created_at
       FROM usuarios WHERE id_usuario = ?`,
    )
    .get(payload.uid) as Usuario | undefined;
  req.user = row ?? null;
  return next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Autenticación requerida. Inicia sesión para continuar.',
    });
  }
  return next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Autenticación requerida.',
      });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere perfil: ${roles.join(' o ')}.`,
      });
    }
    return next();
  };
}
