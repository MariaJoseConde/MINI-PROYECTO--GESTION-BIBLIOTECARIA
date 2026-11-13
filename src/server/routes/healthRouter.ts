import { Router } from 'express';
import { db } from '../db.ts';
import { checkGeminiConnectivity } from '../services/geminiService.ts';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    const dbCheck = db.prepare('SELECT 1 AS ok').get() as { ok: number };
    const iaStatus = await checkGeminiConnectivity();
    return res.status(200).json({
      status: 'ok',
      database: dbCheck.ok === 1 ? 'connected' : 'error',
      ia: iaStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Service unavailable',
    });
  }
});
