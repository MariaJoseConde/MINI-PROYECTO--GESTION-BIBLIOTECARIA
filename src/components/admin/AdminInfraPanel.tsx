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
      <div className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E7E2D8]">
          <div>
            <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
              Arquitectura, Caché y Respaldo SQLite
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Monitoreo en tiempo real del servidor Express modular, caché LRU semántica, compresión gzip y base de datos WAL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#F3EFE7] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <a
              href="/api/libros/exportar/csv"
              download="sgbi-catalogo.csv"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#F3EFE7]"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </a>
            <a
              href="/api/admin/respaldo"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#172554]"
            >
              <Database className="w-3.5 h-3.5" />
              Respaldo SQLite (.db)
            </a>
          </div>
        </div>

        {metrics ? (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1917]">
                  <Server className="w-4 h-4 text-[#1E3A8A]" />
                  <span>Servidor y API</span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#78716C]">Node.js</dt>
                    <dd className="font-mono font-medium text-[#1C1917]">
                      {metrics.server.nodeVersion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Uptime</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.server.uptimeSeconds}s
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Latencia prom. / p95</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.api.avgLatencyMs} / {metrics.api.p95LatencyMs} ms
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Memoria RSS / Heap</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.server.memoryRssMb} / {metrics.server.memoryHeapUsedMb} MB
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#1C1917]">
                  <span className="inline-flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#15803D]" />
                    Motor SQLite WAL
                  </span>
                  <span className="font-mono text-[11px] text-[#57534E]">
                    {metrics.database.schemaVersion}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#78716C]">Modo Diario</dt>
                    <dd className="font-mono font-semibold uppercase text-[#15803D]">
                      {metrics.database.journalMode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Integridad</dt>
                    <dd
                      className={`font-mono font-semibold ${
                        metrics.database.integrityOk ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {metrics.database.integrityOk ? 'OK' : 'Revisar'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Índices B-Tree</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.database.indexesCount} activos
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Tamaño DB</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.database.fileSizeKb} KB
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#1C1917]">
                  <span>Caché Semántica TTL</span>
                  <button
                    type="button"
                    onClick={onClearCache}
                    className="text-[11px] font-medium text-[#1E3A8A] hover:underline cursor-pointer"
                  >
                    Limpiar caché
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#78716C]">Tasa de aciertos</dt>
                    <dd className="font-mono font-semibold tabular-nums text-[#1E3A8A]">
                      {metrics.iaCache.hitRatePct}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Entradas en memoria</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.iaCache.entries} (TTL {metrics.iaCache.ttlSeconds}s)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Hits / Misses</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.iaCache.hits} / {metrics.iaCache.misses}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Peticiones API</dt>
                    <dd className="font-mono font-medium tabular-nums text-[#1C1917]">
                      {metrics.api.totalRequests} ({metrics.api.errorRequests} err.)
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="rounded-lg border border-[#E7E2D8] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E7E2D8] bg-[#FBF9F5] text-xs font-semibold text-[#1C1917]">
                Trazas recientes de API (X-Response-Time)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E7E2D8] text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                      <th className="py-2.5 px-5">Método</th>
                      <th className="py-2.5 px-5">Ruta</th>
                      <th className="py-2.5 px-5">Estado</th>
                      <th className="py-2.5 px-5 text-right">Duración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EFE7]">
                    {metrics.api.recentTraces.slice(0, 10).map((t, i) => (
                      <tr key={`${t.timestamp}-${i}`} className="hover:bg-[#FBF9F5]">
                        <td className="py-2 px-5 font-mono font-semibold text-[#1E3A8A]">
                          {t.method}
                        </td>
                        <td className="py-2 px-5 font-mono text-[#1C1917]">{t.path}</td>
                        <td
                          className={`py-2 px-5 font-mono font-semibold tabular-nums ${
                            t.status >= 400 ? 'text-[#B91C1C]' : 'text-[#15803D]'
                          }`}
                        >
                          {t.status}
                        </td>
                        <td className="py-2 px-5 text-right font-mono tabular-nums text-[#57534E]">
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
          <div className="py-10 text-center text-xs text-[#78716C]">
            Cargando métricas de infraestructura...
          </div>
        )}
      </div>
    </section>
  );
};
