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
    <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
            Registro de Auditoría (logs_sistema)
          </h2>
          <p className="text-xs text-[#57534E]">
            Trazabilidad de transacciones de circulación, eventos de búsqueda IA y conmutaciones a respaldo FTS5.
          </p>
        </div>

        <button
          type="button"
          disabled={testingFallback}
          onClick={onTestFallback}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#F3EFE7] disabled:opacity-60 transition-colors cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5 text-[#1E3A8A]" />
          {testingFallback ? 'Ejecutando prueba...' : 'Probar Fallback IA → FTS5'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#E7E2D8] text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
              <th className="py-3 px-5">ID</th>
              <th className="py-3 px-5">Evento</th>
              <th className="py-3 px-5">Detalle</th>
              <th className="py-3 px-5">Actor</th>
              <th className="py-3 px-5">Fecha / Hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3EFE7]">
            {logs.map((log) => (
              <tr key={log.id_log} className="hover:bg-[#FBF9F5]">
                <td className="py-2.5 px-5 font-mono tabular-nums text-[#78716C]">
                  #{log.id_log}
                </td>
                <td className="py-2.5 px-5 font-mono font-semibold text-[#1E3A8A] whitespace-nowrap">
                  {log.tipo_evento}
                </td>
                <td className="py-2.5 px-5 text-[#1C1917]">{log.mensaje}</td>
                <td className="py-2.5 px-5 text-[#57534E] whitespace-nowrap">
                  {log.usuario_nombre || 'Público / Sistema'}
                </td>
                <td className="py-2.5 px-5 font-mono tabular-nums text-[#78716C] whitespace-nowrap">
                  {log.created_at}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
