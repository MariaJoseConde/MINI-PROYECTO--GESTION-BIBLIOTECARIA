import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { attachSessionUser } from './src/server/auth.ts';
import { db, initDatabase } from './src/server/db.ts';
import { apiGzipMiddleware } from './src/server/middleware/compression.ts';
import {
  centralizedErrorHandler,
  observabilityMiddleware,
} from './src/server/middleware/observability.ts';
import { requestCorrelation, securityHeaders } from './src/server/middleware/security.ts';
import { adminRouter } from './src/server/routes/adminRouter.ts';
import { authRouter } from './src/server/routes/authRouter.ts';
import { catalogoRouter } from './src/server/routes/catalogoRouter.ts';
import { circulacionRouter } from './src/server/routes/circulacionRouter.ts';
import { healthRouter } from './src/server/routes/healthRouter.ts';
import { iaRouter } from './src/server/routes/iaRouter.ts';

initDatabase();

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(requestCorrelation);
app.use(observabilityMiddleware);
app.use(apiGzipMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(attachSessionUser);

// Modular REST API v1 routes
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', catalogoRouter);
app.use('/api', iaRouter);
app.use('/api', circulacionRouter);
app.use('/api', adminRouter);

// API 404 fallback for unknown /api/* endpoints
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Recurso API no encontrado.' });
});

app.use(centralizedErrorHandler);

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`SGBI server running on http://0.0.0.0:${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[SGBI] ${signal} recibido. Cerrando servidor HTTP y base de datos SQLite...`);
    server.close(() => {
      try {
        db.pragma('optimize');
        db.close();
      } catch (err) {
        console.error('[SGBI] Error cerrando SQLite:', err);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
