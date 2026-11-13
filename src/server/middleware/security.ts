import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

export function requestCorrelation(req: Request, res: Response, next: NextFunction) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', String(reqId));
  next();
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, BucketEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const fwd = req.headers['x-forwarded-for'];
    const ip =
      typeof fwd === 'string'
        ? fwd.split(',')[0].trim()
        : req.socket.remoteAddress || '127.0.0.1';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now > current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Demasiadas solicitudes. Intenta nuevamente en ${retryAfter} segundos.`,
      });
    }

    current.count += 1;
    return next();
  };
}
