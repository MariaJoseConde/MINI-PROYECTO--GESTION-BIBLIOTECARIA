import React from 'react';
import { Activity } from 'lucide-react';
import type { LogSistema } from '../../types/sgbi.ts';

interface AdminAuditoriaPanelProps {
  logs: LogSistema[];
  testingFallback: boolean;
  onTestFallback: () => void;
}

export const AdminAuditoriaPanel: React.FC<AdminAuditoriaPanelProps> = ({
  logs,
  testingFallback,
  onTestFallback,
}) => {
  return (
    <section className="card-monday bg-[#ffffff] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#d0d4e4] bg-[#ffffff] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#333333] tracking-tight">
            Registro de Auditoría (logs_sistema)
          </h2>
          <p className="text-xs text-[#535768] mt-0.5">
            Trazabilidad de transacciones de circulación, eventos de búsqueda IA y conmutaciones a respaldo FTS5.
          </p>
        </div>

        <button
          type="button"
          disabled={testingFallback}
          onClick={onTestFallback}
          className="btn-outline-pill text-xs py-2 px-4 cursor-pointer gap-2 disabled:opacity-60"
        >
          <Activity className="w-3.5 h-3.5 text-[#6161ff]" />
          {testingFallback ? 'Ejecutando prueba...' : 'Probar Fallback IA → FTS5'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#d0d4e4] bg-[#f5f6f8] text-[11px] font-semibold uppercase tracking-wider text-[#535768]">
              <th className="py-3.5 px-6">ID</th>
              <th className="py-3.5 px-6">Evento</th>
              <th className="py-3.5 px-6">Detalle</th>
              <th className="py-3.5 px-6">Actor</th>
              <th className="py-3.5 px-6">Fecha / Hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f6f8]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-[#808080]">
                  No hay registros de auditoría disponibles.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id_log} className="hover:bg-[#f5f6f8]/70 transition-colors">
                  <td className="py-3 px-6 font-mono tabular-nums text-[#808080]">
                    #{log.id_log}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-semibold text-[11px]">
                      {log.tipo_evento}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-[#333333] font-medium max-w-md">{log.mensaje}</td>
                  <td className="py-3 px-6 text-[#535768] whitespace-nowrap">
                    {log.usuario_nombre || 'Público / Sistema'}
                  </td>
                  <td className="py-3 px-6 font-mono tabular-nums text-[#808080] whitespace-nowrap">
                    {log.created_at}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
