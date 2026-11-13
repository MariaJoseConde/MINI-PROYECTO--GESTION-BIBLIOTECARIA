import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookCheck, CheckCircle2, Clock } from 'lucide-react';
import type { Prestamo, Usuario } from '../types/sgbi.ts';

interface MisPrestamosViewProps {
  user: Usuario;
}

export const MisPrestamosView: React.FC<MisPrestamosViewProps> = ({ user }) => {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/prestamos');
        if (!res.ok) return;
        const data = (await res.json()) as { prestamos: Prestamo[] };
        if (!cancelled) setPrestamos(data.prestamos);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user.id_usuario]);

  const activos = prestamos.filter((p) => p.fecha_entrega === null);
  const historial = prestamos.filter((p) => p.fecha_entrega !== null);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-[#78716C]">
            Estado de Cuenta y Circulación Personal
          </p>
          <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-[#1C1917]">
            {user.nombre_completo}
          </h1>
          <p className="mt-1 text-xs font-mono text-[#57534E] tabular-nums">
            Documento {user.numero_documento} · Perfil {user.rol}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold">
          {user.estado === 'SANCIONADO' ? (
            <div className="flex items-center gap-2 rounded-md border border-[#B91C1C]/35 bg-[#FEF2F2] px-4 py-2 text-[#991B1B]">
              <AlertTriangle className="w-4 h-4" />
              <span>Estado: SANCIONADO (Mora pendiente)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-[#15803D]/30 bg-[#F0FDF4] px-4 py-2 text-[#14532D]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Estado: ACTIVO (Habilitado para préstamo)</span>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5]">
          <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
            Préstamos Vigentes ({activos.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#78716C]">Cargando historial...</div>
        ) : activos.length === 0 ? (
          <div className="p-10 text-center">
            <BookCheck className="w-8 h-8 text-[#15803D] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#1C1917]">No tiene préstamos activos</p>
            <p className="text-xs text-[#57534E] mt-1">
              Puede solicitar nuevos volúmenes en el mostrador presentando su documento.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F3EFE7]">
            {activos.map((p) => (
              <div
                key={p.id_prestamo}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#78716C]">
                    <span>Folio #{p.id_prestamo}</span>
                    <span>·</span>
                    <span>ISBN {p.libro_isbn}</span>
                  </div>
                  <h3 className="font-serif text-base font-semibold text-[#1C1917] mt-0.5">
                    {p.libro_titulo}
                  </h3>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <div className="text-[#78716C]">Fecha límite</div>
                    <div className="font-mono font-semibold tabular-nums text-[#1C1917]">
                      {p.fecha_limite}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    {p.estado === 'MORA' ? (
                      <span className="text-[#B91C1C] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        EN MORA
                      </span>
                    ) : (
                      <span className="text-[#15803D] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        ACTIVO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {historial.length > 0 && (
        <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5]">
            <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
              Historial de Devoluciones ({historial.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E7E2D8] text-[#57534E] uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-6">Folio</th>
                  <th className="py-3 px-6">Libro</th>
                  <th className="py-3 px-6">Préstamo</th>
                  <th className="py-3 px-6">Límite</th>
                  <th className="py-3 px-6">Entrega</th>
                  <th className="py-3 px-6">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EFE7]">
                {historial.map((p) => (
                  <tr key={p.id_prestamo}>
                    <td className="py-3 px-6 font-mono tabular-nums">#{p.id_prestamo}</td>
                    <td className="py-3 px-6 font-medium text-[#1C1917]">{p.libro_titulo}</td>
                    <td className="py-3 px-6 font-mono tabular-nums text-[#57534E]">
                      {p.fecha_prestamo}
                    </td>
                    <td className="py-3 px-6 font-mono tabular-nums text-[#57534E]">
                      {p.fecha_limite}
                    </td>
                    <td className="py-3 px-6 font-mono tabular-nums text-[#1C1917]">
                      {p.fecha_entrega}
                    </td>
                    <td className="py-3 px-6 font-semibold">
                      {p.estado === 'MORA' ? (
                        <span className="text-[#B91C1C]">Devuelto con mora</span>
                      ) : (
                        <span className="text-[#15803D]">Devuelto a tiempo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
