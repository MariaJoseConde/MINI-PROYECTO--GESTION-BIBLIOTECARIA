import zlib from 'node:zlib';
import type { NextFunction, Request, Response } from 'express';

const MIN_COMPRESS_BYTES = 1024;

export function apiGzipMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (!acceptEncoding.includes('gzip')) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    const jsonStr = JSON.stringify(body);
    if (Buffer.byteLength(jsonStr, 'utf8') < MIN_COMPRESS_BYTES) {
      return originalJson(body);
    }

    const compressed = zlib.gzipSync(jsonStr);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', String(compressed.length));
    return res.send(compressed);
  }) as Response['json'];

  next();
}
