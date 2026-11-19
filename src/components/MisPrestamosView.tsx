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
    <div className="space-y-8">
      <div className="card-monday p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#e7ecff] text-[#6161ff] text-xs font-semibold uppercase tracking-wider mb-2.5">
            <BookCheck className="w-3.5 h-3.5" />
            <span>Estado de Cuenta y Circulación</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#333333]">
            {user.nombre_completo}
          </h1>
          <p className="mt-1 text-xs font-mono text-[#535768] tabular-nums">
            Documento {user.numero_documento} · Rol <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-semibold text-[10px] ml-1">{user.rol}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user.estado === 'SANCIONADO' ? (
            <span className="badge-monday bg-[#fcd0f8] text-[#991B1B] text-xs py-1 px-3.5 font-semibold">
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              SANCIONADO (Mora pendiente)
            </span>
          ) : (
            <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e] text-xs py-1 px-3.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              ACTIVO (Habilitado para préstamo)
            </span>
          )}
        </div>
      </div>

      <section className="card-monday bg-[#ffffff] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8]">
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">
            Préstamos Vigentes ({activos.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#808080]">Cargando historial...</div>
        ) : activos.length === 0 ? (
          <div className="p-12 text-center">
            <BookCheck className="w-8 h-8 text-[#2a5c4e] mx-auto mb-2.5" />
            <p className="text-base font-bold text-[#333333]">No tienes préstamos activos</p>
            <p className="text-xs text-[#535768] mt-1">
              Puedes solicitar nuevos volúmenes en el mostrador presentando tu documento.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f6f8]">
            {activos.map((p) => (
              <div
                key={p.id_prestamo}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#f5f6f8]/60 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#535768]">
                    <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-bold">Folio #{p.id_prestamo}</span>
                    <span>·</span>
                    <span>ISBN {p.libro_isbn}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#333333] mt-1">
                    {p.libro_titulo}
                  </h3>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <div className="text-[#535768]">Fecha límite</div>
                    <div className="font-mono font-bold tabular-nums text-[#333333]">
                      {p.fecha_limite}
                    </div>
                  </div>
                  <div>
                    {p.estado === 'MORA' ? (
                      <span className="badge-monday bg-[#fcd0f8] text-[#991B1B] font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                        EN MORA
                      </span>
                    ) : (
                      <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e] font-semibold">
                        <Clock className="w-3.5 h-3.5 mr-1" />
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
        <section className="card-monday bg-[#ffffff] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8]">
            <h2 className="text-xl font-bold text-[#333333] tracking-tight">
              Historial de Devoluciones ({historial.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#d0d4e4] bg-[#f5f6f8] text-[#535768] uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-6">Folio</th>
                  <th className="py-3 px-6">Libro</th>
                  <th className="py-3 px-6">Préstamo</th>
                  <th className="py-3 px-6">Límite</th>
                  <th className="py-3 px-6">Entrega</th>
                  <th className="py-3 px-6">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f6f8]">
                {historial.map((p) => (
                  <tr key={p.id_prestamo} className="hover:bg-[#f5f6f8]/80 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-[#6161ff] tabular-nums">#{p.id_prestamo}</td>
                    <td className="py-3.5 px-6 font-semibold text-[#333333]">{p.libro_titulo}</td>
                    <td className="py-3.5 px-6 font-mono tabular-nums text-[#535768]">
                      {p.fecha_prestamo}
                    </td>
                    <td className="py-3.5 px-6 font-mono tabular-nums text-[#535768]">
                      {p.fecha_limite}
                    </td>
                    <td className="py-3.5 px-6 font-mono tabular-nums text-[#333333] font-semibold">
                      {p.fecha_entrega}
                    </td>
                    <td className="py-3.5 px-6">
                      {p.estado === 'MORA' ? (
                        <span className="badge-monday bg-[#fcd0f8] text-[#991B1B] font-semibold">Devuelto con mora</span>
                      ) : (
                        <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e] font-semibold">Devuelto a tiempo</span>
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
