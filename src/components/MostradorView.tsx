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
      <div className="no-print flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E7E2D8] pb-5">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-[#78716C]">
            Circulación Transaccional ACID
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1C1917]">
            Mostrador de Préstamos y Devoluciones
          </h1>
          <p className="mt-1 text-sm text-[#57534E]">
            Operaciones atómicas con verificación de solvencia del lector, descuento de inventario y cálculo automático de 8 días hábiles.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            loadOperationalData();
            onRefreshCatalog();
          }}
          className="inline-flex items-center gap-2 rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#F3EFE7] transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Actualizar mostrador
        </button>
      </div>

      {/* Formulario de Nuevo Préstamo */}
      <section className="no-print rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
            Registrar Salida de Ejemplar
          </h2>
          {fechaPreview && (
            <div className="flex items-center gap-2 text-xs text-[#57534E] font-mono tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>
                Salida: {fechaPreview.fecha_prestamo} → Límite (+8 días hábiles):{' '}
                <strong className="text-[#1C1917]">{fechaPreview.fecha_limite}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Paso 1: Selección de Lector */}
          <div className="space-y-3">
            <label
              htmlFor="mostrador-lector-input"
              className="block text-xs font-semibold uppercase tracking-wider text-[#57534E]"
            >
              1. Identificación del lector (Documento o nombre)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={readerInputRef}
                id="mostrador-lector-input"
                type="text"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="Ingrese número de documento (ej. 30303030 o 40404040)..."
                className={`w-full rounded-md border pl-9 pr-3 py-2 text-sm bg-[#FBF9F5] focus:bg-[#FFFFFF] focus:outline-none focus:ring-2 ${
                  selectedUser && userHasMora
                    ? 'border-[#B91C1C] focus:border-[#B91C1C] focus:ring-[#B91C1C]/15'
                    : 'border-[#D6CEBE] focus:border-[#1E3A8A] focus:ring-[#1E3A8A]/15'
                }`}
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-md border border-[#E7E2D8] divide-y divide-[#F3EFE7]">
              {matchingUsers.length === 0 ? (
                <div className="p-3 text-xs text-[#78716C]">
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
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? isSanctioned
                            ? 'bg-[#FEF2F2]'
                            : 'bg-[#EFF6FF]'
                          : 'hover:bg-[#FBF9F5]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1C1917] truncate">
                          {u.nombre_completo}
                        </div>
                        <div className="text-xs font-mono text-[#57534E] tabular-nums">
                          Doc: {u.numero_documento} · {u.rol}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 flex items-center gap-1 ${
                          isSanctioned ? 'text-[#B91C1C]' : 'text-[#15803D]'
                        }`}
                      >
                        {isSanctioned ? (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            SANCIONADO
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
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
              <div className="rounded-md border border-[#B91C1C]/40 bg-[#FEF2F2] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-[#991B1B]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Usuario sancionado o con mora activa</p>
                    <p className="mt-0.5">
                      El préstamo está bloqueado hasta que devuelva sus ejemplares vencidos.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => inspectMoraUserLoans(selectedUser.numero_documento)}
                  className="text-xs font-semibold text-[#991B1B] underline underline-offset-4 shrink-0"
                >
                  Ver préstamos en mora de este usuario
                </button>
              </div>
            )}
          </div>

          {/* Paso 2: Selección de Libro / ISBN */}
          <div className="space-y-3">
            <label
              htmlFor="mostrador-libro-input"
              className="block text-xs font-semibold uppercase tracking-wider text-[#57534E]"
            >
              2. Selección de ejemplar (Título o ISBN)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="mostrador-libro-input"
                type="text"
                value={bookQuery}
                onChange={(e) => setBookQuery(e.target.value)}
                placeholder="Buscar o escanear ISBN del volumen..."
                className="w-full rounded-md border border-[#D6CEBE] bg-[#FBF9F5] pl-9 pr-3 py-2 text-sm focus:bg-[#FFFFFF] focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-md border border-[#E7E2D8] divide-y divide-[#F3EFE7]">
              {matchingBooks.length === 0 ? (
                <div className="p-3 text-xs text-[#78716C]">
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
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        outOfStock
                          ? 'bg-[#FBF9F5] opacity-60 cursor-not-allowed'
                          : isSelected
                            ? 'bg-[#EFF6FF]'
                            : 'hover:bg-[#FBF9F5]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1C1917] truncate">
                          {b.titulo}
                        </div>
                        <div className="text-xs font-mono text-[#57534E] tabular-nums truncate">
                          ISBN {b.isbn}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold tabular-nums shrink-0 ${
                          outOfStock
                            ? 'text-[#78716C]'
                            : b.copias_disp === 1
                              ? 'text-[#B45309]'
                              : 'text-[#15803D]'
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
        <div className="pt-4 border-t border-[#E7E2D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-[#57534E]">
            {!selectedUser && !selectedBook ? (
              <span>Seleccione un lector activo y un libro con existencias para iniciar la operación.</span>
            ) : (
              <span>
                Operación:{' '}
                <strong className="text-[#1C1917]">
                  {selectedUser ? selectedUser.nombre_completo : 'Lector pendiente'}
                </strong>{' '}
                →{' '}
                <strong className="text-[#1C1917]">
                  {selectedBook ? selectedBook.titulo : 'Ejemplar pendiente'}
                </strong>
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!canConfirmLoan}
            onClick={handleConfirmLoan}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#172554] disabled:bg-[#A8A29E] disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {submittingLoan ? 'Procesando transacción...' : 'Confirmar Préstamo'}
          </button>
        </div>
      </section>

      {/* Tabla de Devoluciones y Circulación */}
      <section
        id="tabla-circulacion"
        className="no-print rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden"
      >
        <div className="p-5 border-b border-[#E7E2D8] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
              Control de Devoluciones y Morosidad
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Reintegre ejemplares al inventario verificando automáticamente la fecha límite de entrega.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-[#D6CEBE] bg-[#F3EFE7] p-0.5">
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    loanFilter === key
                      ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filtrar folio, documento o libro..."
                className="rounded-md border border-[#D6CEBE] bg-[#FBF9F5] pl-8 pr-3 py-1.5 text-xs focus:bg-[#FFFFFF] focus:border-[#1E3A8A] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {loadingPrestamos ? (
          <div className="p-8 text-center text-sm text-[#78716C]">
            Cargando registros de circulación...
          </div>
        ) : filteredPrestamos.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-[#1C1917]">
              No hay préstamos en esta vista
            </p>
            <p className="text-xs text-[#57534E] mt-1">
              {loanFilter === 'pendientes'
                ? 'No hay préstamos activos pendientes de entrega con los filtros actuales.'
                : 'Ajuste los criterios de búsqueda para consultar otros registros.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E2D8] bg-[#FBF9F5] text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Lector</th>
                  <th className="py-3 px-4">Ejemplar</th>
                  <th className="py-3 px-4">Salida</th>
                  <th className="py-3 px-4">Fecha Límite</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EFE7] text-xs">
                {filteredPrestamos.map((p) => {
                  const isClosed = p.fecha_entrega !== null;
                  const isMora = p.estado === 'MORA';
                  const isReturning = returningId === p.id_prestamo;

                  return (
                    <tr
                      key={p.id_prestamo}
                      className={`hover:bg-[#FBF9F5] transition-colors ${
                        isReturning ? 'opacity-60 animate-pulse' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold tabular-nums text-[#1C1917]">
                        #{p.id_prestamo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#1C1917]">{p.usuario_nombre}</div>
                        <div className="font-mono text-[11px] text-[#78716C] tabular-nums">
                          Doc. {p.usuario_documento}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#1C1917]">{p.libro_titulo}</div>
                        <div className="font-mono text-[11px] text-[#78716C] tabular-nums">
                          {p.libro_isbn}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#57534E]">
                        {p.fecha_prestamo}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#1C1917] font-medium">
                        {p.fecha_limite}
                      </td>
                      <td className="py-3 px-4">
                        {isMora ? (
                          <span className="font-semibold text-[#B91C1C]">
                            {isClosed ? `MORA (Entregado ${p.fecha_entrega})` : 'MORA ACTIVA'}
                          </span>
                        ) : p.estado === 'DEVUELTO' ? (
                          <span className="font-medium text-[#57534E]">
                            DEVUELTO ({p.fecha_entrega})
                          </span>
                        ) : (
                          <span className="font-semibold text-[#15803D]">ACTIVO</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isClosed ? (
                          <button
                            type="button"
                            disabled={isReturning}
                            onClick={() => handleReturnLoan(p)}
                            className="inline-flex items-center gap-1.5 rounded border border-[#D6CEBE] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#1C1917] hover:bg-[#1E3A8A] hover:text-white hover:border-[#1E3A8A] disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {isReturning ? 'Procesando...' : 'Registrar Devolución'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setTicketPrestamo(p)}
                            className="text-xs font-medium text-[#1E3A8A] hover:underline underline-offset-4 whitespace-nowrap"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-title"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] shadow-xl overflow-hidden">
            <div className="no-print flex items-center justify-between border-b border-[#E7E2D8] bg-[#FBF9F5] px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#15803D]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Comprobante de Circulación</span>
              </div>
              <button
                type="button"
                onClick={() => setTicketPrestamo(null)}
                className="p-1 rounded text-[#57534E] hover:bg-[#EBE6DF]"
                aria-label="Cerrar comprobante"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido Ticket Imprimible (@media print) */}
            <div className="p-6 font-mono text-xs space-y-4 text-[#1C1917]">
              <div className="text-center border-b border-dashed border-[#A8A29E] pb-3">
                <h3 id="ticket-title" className="font-serif text-base font-bold">
                  SGBI · BIBLIOTECA CENTRAL
                </h3>
                <p className="text-[11px] text-[#57534E] mt-0.5">
                  COMPROBANTE OFICIAL DE PRÉSTAMO
                </p>
                <p className="mt-1 font-bold text-sm">FOLIO #{ticketPrestamo.id_prestamo}</p>
              </div>

              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#57534E]">Lector:</dt>
                  <dd className="text-right font-semibold">{ticketPrestamo.usuario_nombre}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#57534E]">Documento:</dt>
                  <dd className="text-right tabular-nums">{ticketPrestamo.usuario_documento}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-dashed border-[#E7E2D8] pt-2">
                  <dt className="text-[#57534E]">Obra:</dt>
                  <dd className="text-right font-semibold">{ticketPrestamo.libro_titulo}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#57534E]">ISBN:</dt>
                  <dd className="text-right tabular-nums">{ticketPrestamo.libro_isbn}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-dashed border-[#E7E2D8] pt-2">
                  <dt className="text-[#57534E]">Fecha salida:</dt>
                  <dd className="text-right tabular-nums">{ticketPrestamo.fecha_prestamo}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#57534E]">Fecha límite (+8d háb.):</dt>
                  <dd className="text-right font-bold tabular-nums">{ticketPrestamo.fecha_limite}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#57534E]">Estado:</dt>
                  <dd className="text-right font-semibold">{ticketPrestamo.estado}</dd>
                </div>
              </dl>

              <p className="text-[10px] text-center text-[#57534E] border-t border-dashed border-[#A8A29E] pt-3">
                La entrega posterior a la fecha límite genera suspensión automática de préstamos.
              </p>
            </div>

            <div className="no-print flex items-center justify-end gap-2.5 border-t border-[#E7E2D8] bg-[#FBF9F5] px-5 py-3.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#F3EFE7] transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Comprobante
              </button>
              <button
                type="button"
                onClick={resetLoanForm}
                className="rounded-md bg-[#1E3A8A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#172554] transition-colors"
              >
                Registrar Otro Préstamo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
