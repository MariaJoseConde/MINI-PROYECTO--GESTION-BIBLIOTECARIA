import React from 'react';
import { Database, Download, RefreshCw, Server } from 'lucide-react';
import type { InfraestructuraMetrics } from '../../types/sgbi.ts';

interface AdminInfraPanelProps {
  metrics: InfraestructuraMetrics | null;
  loading: boolean;
  onRefresh: () => void;
  onClearCache: () => void;
}

export const AdminInfraPanel: React.FC<AdminInfraPanelProps> = ({
  metrics,
  loading,
  onRefresh,
  onClearCache,
}) => {
  return (
    <section className="space-y-6">
      <div className="card-monday bg-[#ffffff] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#d0d4e4]">
          <div>
            <h2 className="text-lg font-bold text-[#333333] tracking-tight">
              Arquitectura, Caché y Respaldo SQLite
            </h2>
            <p className="text-xs text-[#535768] mt-0.5">
              Monitoreo en tiempo real del servidor Express modular, caché LRU semántica, compresión gzip y base de datos WAL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="btn-outline-pill text-xs py-2 px-4 cursor-pointer gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <a
              href="/api/libros/exportar/csv"
              download="sgbi-catalogo.csv"
              className="btn-outline-pill text-xs py-2 px-4 cursor-pointer gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </a>
            <a
              href="/api/admin/respaldo"
              className="btn-primary-pill text-xs py-2 px-4.5 cursor-pointer gap-2 shadow-xs"
            >
              <Database className="w-3.5 h-3.5" />
              Respaldo SQLite (.db)
            </a>
          </div>
        </div>

        {metrics ? (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-[18px] border border-[#d0d4e4] bg-[#e7ecff]/40 p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#333333]">
                  <Server className="w-4 h-4 text-[#6161ff]" />
                  <span>Servidor y API</span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#808080]">Node.js</dt>
                    <dd className="font-mono font-semibold text-[#333333]">
                      {metrics.server.nodeVersion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Uptime</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.server.uptimeSeconds}s
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Latencia prom. / p95</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.api.avgLatencyMs} / {metrics.api.p95LatencyMs} ms
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Memoria RSS / Heap</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.server.memoryRssMb} / {metrics.server.memoryHeapUsedMb} MB
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[18px] border border-[#d0d4e4] bg-[#bcfe90]/20 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#333333]">
                  <span className="inline-flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#00854d]" />
                    Motor SQLite WAL
                  </span>
                  <span className="badge-monday bg-[#ffffff] text-[10px] text-[#535768] font-mono border border-[#d0d4e4]">
                    {metrics.database.schemaVersion}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#808080]">Modo Diario</dt>
                    <dd className="font-mono font-bold uppercase text-[#00854d]">
                      {metrics.database.journalMode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Integridad</dt>
                    <dd
                      className={`font-mono font-bold ${
                        metrics.database.integrityOk ? 'text-[#00854d]' : 'text-[#c2410c]'
                      }`}
                    >
                      {metrics.database.integrityOk ? 'OK' : 'Revisar'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Índices B-Tree</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.database.indexesCount} activos
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Tamaño DB</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.database.fileSizeKb} KB
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[18px] border border-[#d0d4e4] bg-[#abf0ff]/25 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#333333]">
                  <span>Caché Semántica TTL</span>
                  <button
                    type="button"
                    onClick={onClearCache}
                    className="text-[11px] font-semibold text-[#6161ff] hover:underline cursor-pointer"
                  >
                    Limpiar caché
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#808080]">Tasa de aciertos</dt>
                    <dd className="font-mono font-bold tabular-nums text-[#6161ff]">
                      {metrics.iaCache.hitRatePct}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Entradas en memoria</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.iaCache.entries} (TTL {metrics.iaCache.ttlSeconds}s)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Hits / Misses</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.iaCache.hits} / {metrics.iaCache.misses}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#808080]">Peticiones API</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#333333]">
                      {metrics.api.totalRequests} ({metrics.api.errorRequests} err.)
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="rounded-[18px] border border-[#d0d4e4] overflow-hidden">
              <div className="px-6 py-3.5 border-b border-[#d0d4e4] bg-[#f5f6f8] text-xs font-bold text-[#333333]">
                Trazas recientes de API (X-Response-Time)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#d0d4e4] bg-[#ffffff] text-[11px] font-semibold uppercase tracking-wider text-[#535768]">
                      <th className="py-3 px-6">Método</th>
                      <th className="py-3 px-6">Ruta</th>
                      <th className="py-3 px-6">Estado</th>
                      <th className="py-3 px-6 text-right">Duración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f6f8]">
                    {metrics.api.recentTraces.slice(0, 10).map((t, i) => (
                      <tr key={`${t.timestamp}-${i}`} className="hover:bg-[#f5f6f8]/70 transition-colors">
                        <td className="py-2.5 px-6 font-mono font-semibold text-[#6161ff]">
                          {t.method}
                        </td>
                        <td className="py-2.5 px-6 font-mono text-[#333333]">{t.path}</td>
                        <td className="py-2.5 px-6">
                          <span
                            className={`badge-monday font-mono font-semibold text-[10px] ${
                              t.status >= 400
                                ? 'bg-[#fcd0f8] text-[#991b1b]'
                                : 'bg-[#bcfe90]/70 text-[#14532d]'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-6 text-right font-mono tabular-nums text-[#808080]">
                          {t.durationMs} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-[#808080]">
            Cargando métricas de infraestructura...
          </div>
        )}
      </div>
    </section>
  );
};
