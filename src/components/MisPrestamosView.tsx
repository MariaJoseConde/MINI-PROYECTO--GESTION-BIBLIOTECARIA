import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookCheck, Bookmark, CheckCircle2, Clock, RotateCw, XCircle } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/apiClient.ts';
import type { Prestamo, Reserva, Usuario } from '../types/sgbi.ts';

interface MisPrestamosViewProps {
  user: Usuario;
}

export const MisPrestamosView: React.FC<MisPrestamosViewProps> = ({ user }) => {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busyLoanId, setBusyLoanId] = useState<number | null>(null);
  const [busyReservaId, setBusyReservaId] = useState<number | null>(null);

  const loadPrestamos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pData, rData] = await Promise.all([
        apiClient.get<{ prestamos: Prestamo[] }>('/api/prestamos'),
        apiClient.get<{ reservas: Reserva[] }>('/api/reservas').catch(() => ({ reservas: [] as Reserva[] })),
      ]);
      setPrestamos(pData.prestamos ?? []);
      setReservas(rData.reservas ?? []);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudo cargar tu historial de préstamos.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrestamos();
  }, [user.id_usuario, loadPrestamos]);

  async function handleRenewLoan(p: Prestamo) {
    setBusyLoanId(p.id_prestamo);
    setActionNotice(null);
    try {
      const data = await apiClient.post<{ prestamo?: Prestamo }>(`/api/prestamos/${p.id_prestamo}/renovar`);
      if (data.prestamo) {
        setPrestamos((prev) =>
          prev.map((item) => (item.id_prestamo === p.id_prestamo ? data.prestamo! : item)),
        );
        setActionNotice({
          type: 'success',
          text: `Préstamo #${p.id_prestamo} renovado. Nueva fecha límite: ${data.prestamo.fecha_limite}.`,
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        text: err instanceof ApiRequestError ? err.message : 'No se pudo renovar el préstamo.',
      });
    } finally {
      setBusyLoanId(null);
    }
  }

  async function handleCancelReserva(r: Reserva) {
    setBusyReservaId(r.id_reserva);
    setActionNotice(null);
    try {
      await apiClient.post(`/api/reservas/${r.id_reserva}/cancelar`);
      setReservas((prev) =>
        prev.map((item) => (item.id_reserva === r.id_reserva ? { ...item, estado: 'CANCELADA' } : item)),
      );
      setActionNotice({
        type: 'success',
        text: `Reserva #${r.id_reserva} cancelada correctamente.`,
      });
    } catch (err) {
      setActionNotice({
        type: 'error',
        text: err instanceof ApiRequestError ? err.message : 'No se pudo cancelar la reserva.',
      });
    } finally {
      setBusyReservaId(null);
    }
  }

  const activos = prestamos.filter((p) => p.fecha_entrega === null);
  const historial = prestamos.filter((p) => p.fecha_entrega !== null);

  return (
    <div className="space-y-8">
      <div className="card-monday p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#287A65]/12 text-[#287A65] text-xs font-semibold uppercase tracking-wider mb-2.5">
            <BookCheck className="w-3.5 h-3.5" />
            <span>Estado de Cuenta y Circulación</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#183B4E] dark:text-white">
            {user.nombre_completo}
          </h1>
          <p className="mt-1 text-xs font-mono text-[#535768] tabular-nums">
            Documento {user.numero_documento} · Rol <span className="badge-monday bg-[#287A65]/12 text-[#287A65] font-semibold text-[10px] ml-1">{user.rol}</span>
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

      {actionNotice && (
        <div
          role="status"
          className={`rounded-2xl border px-5 py-3 text-xs font-medium ${
            actionNotice.type === 'success'
              ? 'border-emerald-300/70 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
              : 'border-rose-300/70 dark:border-rose-700/60 bg-rose-50/80 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
          }`}
        >
          {actionNotice.text}
        </div>
      )}

      <section className="card-monday bg-[#ffffff] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8]">
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">
            Préstamos Vigentes ({activos.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[#808080]">Cargando historial...</div>
        ) : error ? (
          <div className="p-8 text-center space-y-3" role="alert">
            <p className="text-sm font-medium text-rose-700">{error}</p>
            <button
              type="button"
              onClick={loadPrestamos}
              className="btn-outline-pill text-xs py-1.5 px-4 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
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
                    <span className="badge-monday bg-[#183B4E]/10 dark:bg-[#183B4E]/30 text-[#183B4E] dark:text-[#a5c4d4] font-bold">Folio #{p.id_prestamo}</span>
                    <span>·</span>
                    <span>ISBN {p.libro_isbn}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#183B4E] dark:text-white mt-1">
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
                      <div className="flex items-center gap-2.5">
                        <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e] font-semibold">
                          <Clock className="w-3.5 h-3.5 mr-1" />
                          ACTIVO ({p.renovaciones ?? 0}/2 ren.)
                        </span>
                        {(p.renovaciones ?? 0) < 2 && (
                          <button
                            type="button"
                            disabled={busyLoanId === p.id_prestamo}
                            onClick={() => handleRenewLoan(p)}
                            className="btn-outline-pill text-[11px] py-1 px-2.5 cursor-pointer disabled:opacity-60"
                          >
                            <RotateCw className={`w-3 h-3 ${busyLoanId === p.id_prestamo ? 'animate-spin' : ''}`} />
                            Renovar (+8 días)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mis Reservas */}
      <section className="card-monday bg-[#ffffff] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8] flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#333333] tracking-tight inline-flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-[#287A65]" />
            Mis Reservas ({reservas.length})
          </h2>
        </div>
        {reservas.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#535768]">
            No tienes reservas registradas. Cuando un título esté agotado (0 copias disponibles), puedes reservarlo desde su ficha técnica.
          </div>
        ) : (
          <div className="divide-y divide-[#f5f6f8]">
            {reservas.map((r) => (
              <div
                key={r.id_reserva}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-mono text-[#535768]">
                    Reserva #{r.id_reserva} · ISBN {r.libro_isbn} · Expira {r.fecha_expiracion}
                  </div>
                  <div className="text-sm font-bold text-[#183B4E] dark:text-white mt-0.5">{r.libro_titulo}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`badge-monday text-[11px] font-semibold ${
                      r.estado === 'DISPONIBLE'
                        ? 'bg-[#bcfe90] text-[#14532d]'
                        : r.estado === 'PENDIENTE'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                          : r.estado === 'COMPLETADA'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {r.estado}
                  </span>
                  {(r.estado === 'PENDIENTE' || r.estado === 'DISPONIBLE') && (
                    <button
                      type="button"
                      disabled={busyReservaId === r.id_reserva}
                      onClick={() => handleCancelReserva(r)}
                      className="btn-outline-pill text-[11px] py-1 px-2.5 text-rose-700 dark:text-rose-300 cursor-pointer disabled:opacity-60"
                    >
                      <XCircle className="w-3 h-3" />
                      Cancelar
                    </button>
                  )}
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
          <div
            className="table-accessible-wrapper w-full focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Historial de préstamos y devoluciones del lector"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] font-semibold">
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
                    <td className="py-3.5 px-6 font-mono font-bold text-[#287A65] dark:text-[#38a58a] tabular-nums">#{p.id_prestamo}</td>
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
