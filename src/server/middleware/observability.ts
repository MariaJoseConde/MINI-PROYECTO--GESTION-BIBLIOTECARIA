import type { NextFunction, Request, Response } from 'express';

interface ApiTrace {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  timestamp: string;
}

const MAX_LATENCY_SAMPLES = 250;
const MAX_RECENT_TRACES = 20;

const startTime = Date.now();
let totalRequests = 0;
let errorRequests = 0;
const latencySamples: number[] = [];
const recentTraces: ApiTrace[] = [];

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

export function observabilityMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const startNs = process.hrtime.bigint();
  const originalEnd = res.end.bind(res);

  res.end = ((...args: Parameters<Response['end']>) => {
    const elapsedMs = Math.round((Number(process.hrtime.bigint() - startNs) / 1_000_000) * 10) / 10;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${elapsedMs}ms`);
    }

    totalRequests += 1;
    if (res.statusCode >= 400) {
      errorRequests += 1;
    }

    latencySamples.push(elapsedMs);
    if (latencySamples.length > MAX_LATENCY_SAMPLES) {
      latencySamples.shift();
    }

    recentTraces.unshift({
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: elapsedMs,
      timestamp: new Date().toISOString(),
    });
    if (recentTraces.length > MAX_RECENT_TRACES) {
      recentTraces.pop();
    }

    return originalEnd(...args);
  }) as Response['end'];

  next();
}

export function getApiTelemetry() {
  const sorted = [...latencySamples].sort((a, b) => a - b);
  const avg =
    sorted.length > 0
      ? Math.round((sorted.reduce((sum, v) => sum + v, 0) / sorted.length) * 10) / 10
      : 0;
  const p95Index = sorted.length > 0 ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
  const p95 = sorted.length > 0 ? sorted[p95Index] : 0;

  return {
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    totalRequests,
    errorRequests,
    avgLatencyMs: avg,
    p95LatencyMs: p95,
    recentTraces: [...recentTraces],
  };
}

export function centralizedErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = res.getHeader('X-Request-Id');
  const message = err instanceof Error ? err.message : 'Error interno del servidor';
  console.error(`[API Error] ${req.method} ${req.originalUrl} (${String(requestId)}):`, err);

  if (res.headersSent) return;
  res.status(500).json({
    error: 'Error interno al procesar la solicitud.',
    detail: process.env.NODE_ENV === 'production' ? undefined : message,
    requestId: requestId ? String(requestId) : undefined,
  });
}
