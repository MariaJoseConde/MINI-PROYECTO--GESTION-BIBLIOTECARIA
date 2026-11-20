import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Printer,
  RotateCcw,
  Search,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { Libro, Prestamo, Usuario } from '../types/sgbi.ts';

interface MostradorViewProps {
  libros: Libro[];
  onRefreshCatalog: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const MostradorView: React.FC<MostradorViewProps> = ({
  libros,
  onRefreshCatalog,
  onNotify,
}) => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [loadingPrestamos, setLoadingPrestamos] = useState(true);

  // Inputs de nuevo préstamo
  const [docQuery, setDocQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<Libro | null>(null);
  const [fechaPreview, setFechaPreview] = useState<{
    fecha_prestamo: string;
    fecha_limite: string;
    dias_habiles: number;
  } | null>(null);
  const [submittingLoan, setSubmittingLoan] = useState(false);

  // Comprobante modal tras préstamo exitoso
  const [ticketPrestamo, setTicketPrestamo] = useState<Prestamo | null>(null);

  // Tabla de devoluciones
  const [loanFilter, setLoanFilter] = useState<'pendientes' | 'devueltos' | 'todos'>('pendientes');
  const [tableSearch, setTableSearch] = useState('');
  const [returningId, setReturningId] = useState<number | null>(null);

  const readerInputRef = useRef<HTMLInputElement>(null);

  async function loadOperationalData() {
    setLoadingPrestamos(true);
    try {
      const [uRes, pRes, fRes] = await Promise.all([
        fetch('/api/usuarios'),
        fetch('/api/prestamos'),
        fetch('/api/prestamos/calcular-fecha'),
      ]);
      if (uRes.ok) {
        const uData = (await uRes.json()) as { usuarios: Usuario[] };
        setUsuarios(uData.usuarios);
      }
      if (pRes.ok) {
        const pData = (await pRes.json()) as { prestamos: Prestamo[] };
        setPrestamos(pData.prestamos);
      }
      if (fRes.ok) {
        const fData = (await fRes.json()) as {
          fecha_prestamo: string;
          fecha_limite: string;
          dias_habiles: number;
        };
        setFechaPreview(fData);
      }
    } finally {
      setLoadingPrestamos(false);
    }
  }

  useEffect(() => {
    loadOperationalData();
  }, []);

  // Sincronizar libro seleccionado con stock actualizado tras refrescar catálogo
  useEffect(() => {
    if (selectedBook) {
      const updated = libros.find((l) => l.id_libro === selectedBook.id_libro);
      if (updated) setSelectedBook(updated);
    }
  }, [libros, selectedBook]);

  const matchingUsers = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.numero_documento.toLowerCase().includes(q) ||
        u.nombre_completo.toLowerCase().includes(q),
    );
  }, [usuarios, docQuery]);

  const matchingBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    if (!q) return libros;
    return libros.filter(
      (l) =>
        l.isbn.toLowerCase().includes(q) ||
        l.titulo.toLowerCase().includes(q),
    );
  }, [libros, bookQuery]);

  const filteredPrestamos = useMemo(() => {
    return prestamos.filter((p) => {
      if (loanFilter === 'pendientes') {
        if (p.fecha_entrega !== null) return false;
      } else if (loanFilter === 'devueltos') {
        if (p.fecha_entrega === null) return false;
      }

      if (tableSearch.trim()) {
        const q = tableSearch.trim().toLowerCase();
        const matchFolio = String(p.id_prestamo) === q;
        const matchDoc = (p.usuario_documento ?? '').toLowerCase().includes(q);
        const matchName = (p.usuario_nombre ?? '').toLowerCase().includes(q);
        const matchBook = (p.libro_titulo ?? '').toLowerCase().includes(q);
        const matchIsbn = (p.libro_isbn ?? '').toLowerCase().includes(q);
        return matchFolio || matchDoc || matchName || matchBook || matchIsbn;
      }
      return true;
    });
  }, [prestamos, loanFilter, tableSearch]);

  const userHasMora = useMemo(() => {
    if (!selectedUser) return false;
    if (selectedUser.estado === 'SANCIONADO') return true;
    return prestamos.some(
      (p) =>
        p.id_usuario === selectedUser.id_usuario &&
        p.estado === 'MORA' &&
        p.fecha_entrega === null,
    );
  }, [selectedUser, prestamos]);

  const canConfirmLoan =
    Boolean(selectedUser) &&
    !userHasMora &&
    Boolean(selectedBook) &&
    (selectedBook?.copias_disp ?? 0) >= 1 &&
    !submittingLoan;

  async function handleConfirmLoan() {
    if (!selectedUser || !selectedBook) return;
    setSubmittingLoan(true);
    try {
      const res = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_libro: selectedBook.id_libro,
          id_usuario: selectedUser.id_usuario,
        }),
      });
      const data = (await res.json()) as { prestamo?: Prestamo; error?: string };
      if (!res.ok || !data.prestamo) {
        onNotify('error', data.error || 'No fue posible registrar el préstamo.');
        await Promise.all([loadOperationalData(), Promise.resolve(onRefreshCatalog())]);
        return;
      }

      setTicketPrestamo(data.prestamo);
      onNotify(
        'success',
        `Préstamo #${data.prestamo.id_prestamo} confirmado. Stock descontado (-1).`,
      );
      await Promise.all([loadOperationalData(), Promise.resolve(onRefreshCatalog())]);
    } catch {
      onNotify('error', 'Error de conexión al registrar el préstamo.');
    } finally {
      setSubmittingLoan(false);
    }
  }

  async function handleReturnLoan(prestamo: Prestamo) {
    setReturningId(prestamo.id_prestamo);
    try {
      const res = await fetch(`/api/prestamos/${prestamo.id_prestamo}/devolver`, {
        method: 'POST',
      });
      const data = (await res.json()) as {
        prestamo?: Prestamo;
        enMora?: boolean;
        usuarioSancionado?: boolean;
        error?: string;
      };
      if (!res.ok || !data.prestamo) {
        onNotify('error', data.error || 'Error al registrar la devolución. Operación abortada.');
        return;
      }

      if (data.enMora) {
        onNotify(
          'info',
          `Devolución tardía registrada (+1 stock). El préstamo pasó a MORA y el lector quedó SANCIONADO.`,
        );
      } else {
        onNotify(
          'success',
          'Devolución registrada. Ejemplar reintegrado al inventario (+1 disponible).',
        );
      }
      await Promise.all([loadOperationalData(), Promise.resolve(onRefreshCatalog())]);
    } catch {
      onNotify('error', 'Error al registrar la devolución. Operación abortada.');
    } finally {
      setReturningId(null);
    }
  }

  function resetLoanForm() {
    setTicketPrestamo(null);
    setSelectedUser(null);
    setSelectedBook(null);
    setDocQuery('');
    setBookQuery('');
    setTimeout(() => readerInputRef.current?.focus(), 60);
  }

  function inspectMoraUserLoans(doc: string) {
    setLoanFilter('pendientes');
    setTableSearch(doc);
    document.getElementById('tabla-circulacion')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="space-y-8">
      {/* Encabezado de Mostrador */}
      <div className="no-print card-monday p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#287A65]/12 text-[#287A65] text-xs font-semibold uppercase tracking-wider mb-2.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Circulación Transaccional</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#183B4E] dark:text-white text-balance">
            Mostrador de <span className="text-[#287A65] dark:text-[#38a58a] font-bold">préstamos y devoluciones</span>
          </h1>
          <p className="mt-2 text-sm text-[#535768]">
            Operaciones atómicas con verificación de solvencia del lector, descuento de inventario y cálculo automático de 8 días hábiles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            loadOperationalData();
            onRefreshCatalog();
          }}
          className="btn-outline-pill text-xs py-2 px-4 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Actualizar mostrador
        </button>
      </div>

      {/* Formulario de Nuevo Préstamo */}
      <section className="no-print card-monday bg-[#ffffff] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d0d4e4]">
          <h2 className="text-xl font-bold text-[#183B4E] dark:text-white tracking-tight">
            Registrar Salida de Ejemplar
          </h2>
          {fechaPreview && (
            <div className="badge-monday bg-[#183B4E]/10 dark:bg-[#183B4E]/30 text-[#183B4E] dark:text-[#a5c4d4] font-mono text-xs py-1 px-3">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              <span>
                Salida: {fechaPreview.fecha_prestamo} → Límite (+8 días):{' '}
                <strong className="text-[#183B4E] dark:text-white">{fechaPreview.fecha_limite}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Paso 1: Selección de Lector */}
          <div className="space-y-3">
            <label
              htmlFor="mostrador-lector-input"
              className="block text-xs font-semibold uppercase tracking-wider text-[#535768]"
            >
              1. Identificación del lector (Documento o nombre)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#808080] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={readerInputRef}
                id="mostrador-lector-input"
                type="text"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="Ingrese número de documento (ej. 30303030 o 40404040)..."
                className={`w-full input-monday pl-10 pr-3 py-2 text-sm ${
                  selectedUser && userHasMora
                    ? 'border-[#991B1B] focus:border-[#991B1B] focus:ring-[#991B1B]/15'
                    : ''
                }`}
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-[12px] border border-[#d0d4e4] divide-y divide-[#f5f6f8] bg-[#ffffff]">
              {matchingUsers.length === 0 ? (
                <div className="p-4 text-xs text-[#808080]">
                  No hay lectores coincidentes con ese documento.
                </div>
              ) : (
                matchingUsers.map((u) => {
                  const isSelected = selectedUser?.id_usuario === u.id_usuario;
                  const isSanctioned = u.estado === 'SANCIONADO';
                  return (
                    <button
                      key={u.id_usuario}
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected
                          ? isSanctioned
                            ? 'bg-[#fcd0f8]/40'
                            : 'bg-[#e7ecff]'
                          : 'hover:bg-[#f5f6f8]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#333333] truncate">
                          {u.nombre_completo}
                        </div>
                        <div className="text-xs font-mono text-[#535768] tabular-nums">
                          Doc: {u.numero_documento} · {u.rol}
                        </div>
                      </div>
                      <span
                        className={`badge-monday shrink-0 ${
                          isSanctioned ? 'bg-[#fcd0f8] text-[#991B1B]' : 'bg-[#bcfe90] text-[#2a5c4e]'
                        }`}
                      >
                        {isSanctioned ? (
                          <>
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            SANCIONADO
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                            ACTIVO
                          </>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {selectedUser && userHasMora && (
              <div className="rounded-[12px] border border-[#fcd0f8] bg-[#fcd0f8]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-[#991B1B]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Usuario sancionado o con mora activa</p>
                    <p className="mt-0.5 text-[#535768]">
                      El préstamo está bloqueado hasta que devuelva sus ejemplares vencidos.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => inspectMoraUserLoans(selectedUser.numero_documento)}
                  className="btn-outline-pill text-xs py-1 px-3.5 text-[#991B1B] border-[#991B1B] hover:bg-[#fcd0f8] shrink-0"
                >
                  Ver préstamos en mora
                </button>
              </div>
            )}
          </div>

          {/* Paso 2: Selección de Libro / ISBN */}
          <div className="space-y-3">
            <label
              htmlFor="mostrador-libro-input"
              className="block text-xs font-semibold uppercase tracking-wider text-[#535768]"
            >
              2. Selección de ejemplar (Título o ISBN)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#808080] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="mostrador-libro-input"
                type="text"
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                placeholder="Buscar o escanear ISBN del volumen..."
                className="w-full input-monday pl-10 pr-3 py-2 text-sm"
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-[12px] border border-[#d0d4e4] divide-y divide-[#f5f6f8] bg-[#ffffff]">
              {matchingBooks.length === 0 ? (
                <div className="p-4 text-xs text-[#808080]">
                  No hay libros que coincidan con ese ISBN o título.
                </div>
              ) : (
                matchingBooks.map((b) => {
                  const isSelected = selectedBook?.id_libro === b.id_libro;
                  const outOfStock = b.copias_disp <= 0;
                  return (
                    <button
                      key={b.id_libro}
                      type="button"
                      disabled={outOfStock}
                      onClick={() => setSelectedBook(b)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        outOfStock
                          ? 'bg-[#f5f6f8] opacity-50 cursor-not-allowed'
                          : isSelected
                            ? 'bg-[#e7ecff]'
                            : 'hover:bg-[#f5f6f8]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#333333] truncate">
                          {b.titulo}
                        </div>
                        <div className="text-xs font-mono text-[#535768] tabular-nums truncate">
                          ISBN {b.isbn}
                        </div>
                      </div>
                      <span
                        className={`badge-monday font-mono text-xs tabular-nums shrink-0 ${
                          outOfStock
                            ? 'bg-[#e6e7ea] text-[#808080]'
                            : b.copias_disp === 1
                              ? 'bg-[#ff8940]/20 text-[#333333]'
                              : 'bg-[#bcfe90] text-[#2a5c4e]'
                        }`}
                      >
                        {outOfStock
                          ? 'Agotado en sala'
                          : `${b.copias_disp}/${b.copias_totales} disp.`}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Barra de confirmación */}
        <div className="pt-4 border-t border-[#d0d4e4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-[#535768]">
            {!selectedUser && !selectedBook ? (
              <span>Seleccione un lector activo y un libro con existencias para iniciar la operación.</span>
            ) : (
              <span>
                Operación:{' '}
                <strong className="text-[#333333]">
                  {selectedUser ? selectedUser.nombre_completo : 'Lector pendiente'}
                </strong>{' '}
                →{' '}
                <strong className="text-[#333333]">
                  {selectedBook ? selectedBook.titulo : 'Ejemplar pendiente'}
                </strong>
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!canConfirmLoan}
            onClick={handleConfirmLoan}
            className="btn-primary-pill text-xs py-2.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {submittingLoan ? 'Procesando transacción...' : 'Confirmar Préstamo'}
          </button>
        </div>
      </section>

      {/* Tabla de Devoluciones y Circulación (Monday Board Rows) */}
      <section
        id="tabla-circulacion"
        className="no-print card-monday bg-[#ffffff] overflow-hidden"
      >
        <div className="p-6 border-b border-[#d0d4e4] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#333333] tracking-tight">
              Control de Devoluciones y Morosidad
            </h2>
            <p className="text-xs text-[#535768] mt-0.5">
              Reintegre ejemplares al inventario verificando automáticamente la fecha límite de entrega.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-[160px] border border-[#183B4E]/15 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/60 p-1 shadow-2xs">
              {(
                [
                  ['pendientes', 'Pendientes / Mora'],
                  ['devueltos', 'Devueltos'],
                  ['todos', 'Todos'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLoanFilter(key)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-[160px] transition-all cursor-pointer whitespace-nowrap ${
                    loanFilter === key
                      ? 'bg-[#287A65] text-white shadow-xs font-semibold'
                      : 'text-[#183B4E] dark:text-slate-300 hover:text-[#287A65]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#808080] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filtrar folio, documento o libro..."
                className="input-monday pl-8 pr-3 py-1.5 text-xs shadow-2xs"
              />
            </div>
          </div>
        </div>

        {loadingPrestamos ? (
          <div className="p-8 text-center text-sm text-[#808080]">
            Cargando registros de circulación...
          </div>
        ) : filteredPrestamos.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#2a5c4e] mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-[#333333]">
              No hay préstamos en esta vista
            </p>
            <p className="text-xs text-[#535768] mt-1">
              {loanFilter === 'pendientes'
                ? 'No hay préstamos activos pendientes de entrega con los filtros actuales.'
                : 'Ajuste los criterios de búsqueda para consultar otros registros.'}
            </p>
          </div>
        ) : (
          <div
            className="table-accessible-wrapper w-full focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Historial y registros de préstamos de libros"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <th className="py-3 px-5">Folio</th>
                  <th className="py-3 px-5">Lector</th>
                  <th className="py-3 px-5">Ejemplar</th>
                  <th className="py-3 px-5">Salida</th>
                  <th className="py-3 px-5">Fecha Límite</th>
                  <th className="py-3 px-5">Estado</th>
                  <th className="py-3 px-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f6f8] text-xs">
                {filteredPrestamos.map((p) => {
                  const isClosed = p.fecha_entrega !== null;
                  const isMora = p.estado === 'MORA';
                  const isReturning = returningId === p.id_prestamo;

                  return (
                    <tr
                      key={p.id_prestamo}
                      className={`hover:bg-[#f5f6f8]/80 transition-colors ${
                        isReturning ? 'opacity-60 animate-pulse' : ''
                      }`}
                    >
                      <td className="py-3.5 px-5 font-mono font-bold tabular-nums text-[#287A65] dark:text-[#38a58a]">
                        #{p.id_prestamo}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-[#333333]">{p.usuario_nombre}</div>
                        <div className="font-mono text-[11px] text-[#535768] tabular-nums">
                          Doc. {p.usuario_documento}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-[#333333]">{p.libro_titulo}</div>
                        <div className="font-mono text-[11px] text-[#535768] tabular-nums">
                          {p.libro_isbn}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono tabular-nums text-[#535768]">
                        {p.fecha_prestamo}
                      </td>
                      <td className="py-3.5 px-5 font-mono tabular-nums text-[#333333] font-semibold">
                        {p.fecha_limite}
                      </td>
                      <td className="py-3.5 px-5">
                        {isMora ? (
                          <span className="badge-monday bg-[#fcd0f8] text-[#991B1B] font-semibold">
                            {isClosed ? `MORA (${p.fecha_entrega})` : 'MORA ACTIVA'}
                          </span>
                        ) : p.estado === 'DEVUELTO' ? (
                          <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e] font-semibold">
                            DEVUELTO ({p.fecha_entrega})
                          </span>
                        ) : (
                          <span className="badge-monday bg-[#287A65]/12 text-[#287A65] font-semibold">
                            ACTIVO
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {!isClosed ? (
                          <button
                            type="button"
                            disabled={isReturning}
                            onClick={() => handleReturnLoan(p)}
                            className="btn-outline-pill text-xs py-1.5 px-3.5 whitespace-nowrap cursor-pointer hover:bg-[#287A65] hover:text-white hover:border-[#287A65]"
                          >
                            {isReturning ? 'Procesando...' : 'Registrar Devolución'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setTicketPrestamo(p)}
                            className="btn-pill text-xs text-[#287A65] hover:underline cursor-pointer"
                          >
                            Ver ticket
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal & Ticket Imprimible de Comprobante de Préstamo */}
      {ticketPrestamo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-title"
        >
          <div className="w-full max-w-md glass-modal rounded-[24px] border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="no-print flex items-center justify-between border-b border-[#d0d4e4] bg-[#ffffff] px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e] font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Comprobante Oficial
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTicketPrestamo(null)}
                className="p-1.5 rounded-full text-[#535768] hover:bg-[#f5f6f8] cursor-pointer"
                aria-label="Cerrar comprobante"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido Ticket Imprimible (@media print) */}
            <div className="p-6 font-mono text-xs space-y-4 text-[#333333]">
              <div className="text-center border-b border-dashed border-[#d0d4e4] pb-4">
                <div className="w-7 h-7 rounded-full prism-mark-circle mx-auto mb-2" />
                <h3 id="ticket-title" className="text-base font-bold text-[#333333]">
                  SGBI · BIBLIOTECA CENTRAL
                </h3>
                <p className="text-[11px] text-[#535768] mt-0.5">
                  COMPROBANTE OFICIAL DE CIRCULACIÓN
                </p>
                <p className="mt-1 font-bold text-sm text-[#287A65]">FOLIO #{ticketPrestamo.id_prestamo}</p>
              </div>

              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#535768]">Lector:</dt>
                  <dd className="text-right font-semibold text-[#333333]">{ticketPrestamo.usuario_nombre}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#535768]">Documento:</dt>
                  <dd className="text-right tabular-nums">{ticketPrestamo.usuario_documento}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-dashed border-[#d0d4e4] pt-2">
                  <dt className="text-[#535768]">Obra:</dt>
                  <dd className="text-right font-semibold text-[#333333]">{ticketPrestamo.libro_titulo}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#535768]">ISBN:</dt>
                  <dd className="text-right tabular-nums">{ticketPrestamo.libro_isbn}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-dashed border-[#d0d4e4] pt-2">
                  <dt className="text-[#535768]">Fecha salida:</dt>
                  <dd className="text-right tabular-nums">{ticketPrestamo.fecha_prestamo}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#535768]">Fecha límite (+8d háb.):</dt>
                  <dd className="text-right font-bold text-[#287A65] tabular-nums">{ticketPrestamo.fecha_limite}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#535768]">Estado:</dt>
                  <dd className="text-right font-semibold text-[#333333]">{ticketPrestamo.estado}</dd>
                </div>
              </dl>

              <p className="text-[10px] text-center text-[#535768] border-t border-dashed border-[#d0d4e4] pt-3">
                La entrega posterior a la fecha límite genera suspensión automática de préstamos.
              </p>
            </div>

            <div className="no-print flex items-center justify-end gap-2.5 border-t border-[#d0d4e4] bg-[#f5f6f8] px-6 py-4">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-outline-pill text-xs py-2 px-4 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={resetLoanForm}
                className="btn-primary-pill text-xs py-2 px-5 cursor-pointer shadow-xs"
              >
                Registrar Otro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
