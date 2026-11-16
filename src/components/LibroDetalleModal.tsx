import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  Printer,
  Sparkles,
  X,
} from 'lucide-react';
import { BookCover } from './BookCover.tsx';
import type { Categoria, Libro, PruebaLectura, Usuario } from '../types/sgbi.ts';

interface LibroDetalleModalProps {
  libro: Libro | null;
  categorias: Categoria[];
  user: Usuario | null;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
  onPruebaCreated?: () => void;
}

export const LibroDetalleModal: React.FC<LibroDetalleModalProps> = ({
  libro,
  categorias,
  user,
  onClose,
  onNotify,
  onPruebaCreated,
}) => {
  const [pruebas, setPruebas] = useState<PruebaLectura[]>([]);
  const [loadingPruebas, setLoadingPruebas] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activePrueba, setActivePrueba] = useState<PruebaLectura | null>(null);
  const [viewMode, setViewMode] = useState<'estudiante' | 'docente'>('docente');

  const canManageTests = user && (user.rol === 'DOCENTE' || user.rol === 'ADMIN');
  const hasSinopsis = Boolean(libro?.sinopsis && libro.sinopsis.trim().length >= 20);

  useEffect(() => {
    if (!libro) {
      setPruebas([]);
      setActivePrueba(null);
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      setLoadingPruebas(true);
      try {
        const res = await fetch(`/api/libros/${libro!.id_libro}`);
        if (!res.ok) return;
        const data = (await res.json()) as { pruebas?: PruebaLectura[] };
        if (!cancelled && data.pruebas) {
          setPruebas(data.pruebas);
          setActivePrueba(data.pruebas[0] ?? null);
        }
      } finally {
        if (!cancelled) setLoadingPruebas(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [libro, user]);

  if (!libro) return null;

  async function handleGeneratePrueba() {
    if (!libro || !hasSinopsis) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ia/generar-prueba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_libro: libro.id_libro }),
      });
      const data = (await res.json()) as { prueba?: PruebaLectura; error?: string };
      if (!res.ok || !data.prueba) {
        onNotify(
          'error',
          data.error ||
            'No fue posible generar la prueba. Verifique la sinopsis e intente de nuevo.',
        );
        return;
      }
      setPruebas((prev) => [data.prueba!, ...prev]);
      setActivePrueba(data.prueba);
      setViewMode('docente');
      onNotify('success', 'Evaluación pedagógica generada y guardada en base de datos.');
      onPruebaCreated?.();
    } catch {
      onNotify(
        'error',
        'No fue posible generar la prueba. Verifique la conexión e intente de nuevo.',
      );
    } finally {
      setGenerating(false);
    }
  }

  function handlePrintQuiz(mode: 'estudiante' | 'docente') {
    setViewMode(mode);
    setTimeout(() => {
      window.print();
    }, 80);
  }

  const autoresTexto = libro.autores.map((a) => `${a.nombre}${a.nacionalidad ? ` (${a.nacionalidad})` : ''}`).join(' · ');
  const categoriaMeta = categorias.find((c) => c.nombre === libro.categoria);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="libro-detalle-title"
    >
      <div className="w-full max-w-4xl rounded-[24px] border border-[#d0d4e4] bg-[#ffffff] shadow-[0px_5px_55px_rgba(0,0,0,0.35)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera del Modal (oculta en impresión cuando hay prueba activa) */}
        <div className="no-print flex items-center justify-between border-b border-[#d0d4e4] bg-[#ffffff] px-6 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full prism-mark-circle shrink-0 flex items-center justify-center p-0.5">
              <div className="w-full h-full rounded-full bg-white/40" />
            </div>
            <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-semibold text-xs">
              Ficha Bibliográfica · Folio #{libro.id_libro}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#535768] hover:bg-[#f5f6f8] transition-colors cursor-pointer"
            aria-label="Cerrar ficha del libro"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 sm:p-8 space-y-8">
          {/* Bloque principal de ficha (oculto al imprimir si se imprime evaluación) */}
          <div className={activePrueba ? 'no-print' : ''}>
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
              <div className="mx-auto md:mx-0 w-48 md:w-full">
                <BookCover libro={libro} size="lg" />
              </div>

              <div className="space-y-4">
                <div>
                  <span className="badge-monday bg-[#e7ecff] text-[#6161ff] font-semibold text-xs">
                    {libro.categoria}
                    {categoriaMeta ? ` · CDU ${categoriaMeta.codigo_archivo}` : ''}
                  </span>
                  <h2
                    id="libro-detalle-title"
                    className="mt-2 text-2xl sm:text-3xl font-bold text-[#333333] leading-tight tracking-tight"
                  >
                    {libro.titulo}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#535768]">{autoresTexto}</p>
                </div>

                {/* Tabla de metadatos bibliográficos ampliada */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-[#d0d4e4] py-4 text-xs">
                  <div>
                    <dt className="text-[#535768] font-medium">ISBN</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-[#333333] tabular-nums">
                      {libro.isbn}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#535768] font-medium">Año</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-[#333333] tabular-nums">
                      {libro.anio_publicacion ?? 'Sin dato'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#535768] font-medium">Extensión</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-[#333333] tabular-nums">
                      {libro.paginas ? `${libro.paginas} págs.` : 'Sin dato'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#535768] font-medium">Disponibilidad</dt>
                    <dd className="mt-0.5">
                      <span
                        className={`badge-monday font-mono text-[11px] tabular-nums ${
                          libro.copias_disp === 0
                            ? 'bg-[#fcd0f8] text-[#991B1B]'
                            : 'bg-[#bcfe90] text-[#2a5c4e]'
                        }`}
                      >
                        {libro.copias_disp} / {libro.copias_totales} uds.
                      </span>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[#535768] font-medium">Editorial / Colección</dt>
                    <dd className="mt-0.5 font-medium text-[#333333]">
                      {libro.editorial || 'Edición de catálogo'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#535768] font-medium">Idioma</dt>
                    <dd className="mt-0.5 font-medium text-[#333333]">
                      {libro.idioma || 'Español'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#535768] font-medium">Ubicación en sala</dt>
                    <dd className="mt-0.5 font-mono font-medium text-[#333333]">
                      {libro.ubicacion_estante || categoriaMeta?.ubicacion_sala || 'Sala General'}
                    </dd>
                  </div>
                </dl>

                {libro.temas_clave && (
                  <div className="text-xs text-[#535768]">
                    <span className="font-semibold text-[#333333] uppercase tracking-wider mr-2">
                      Temas clave:
                    </span>
                    <span>{libro.temas_clave}</span>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#535768] mb-1.5">
                    Sinopsis de la obra
                  </h3>
                  {hasSinopsis ? (
                    <p className="text-sm text-[#535768] leading-relaxed">{libro.sinopsis}</p>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-[12px] border border-[#ff8940]/40 bg-[#ff8940]/10 p-3.5 text-xs text-[#333333]">
                      <AlertTriangle className="w-4 h-4 text-[#ff8940] shrink-0 mt-0.5" />
                      <span>
                        Este volumen no tiene una sinopsis descriptiva registrada. Para habilitar la generación automática de pruebas de comprensión lectora, un administrador debe completar la sinopsis en el catálogo.
                      </span>
                    </div>
                  )}
                </div>

                {categoriaMeta && (
                  <div className="rounded-[16px] border border-[#d0d4e4] bg-[#f5f6f8] p-4 text-xs space-y-1">
                    <div className="font-semibold text-[#333333]">
                      Sobre la categoría: {categoriaMeta.nombre} (CDU {categoriaMeta.codigo_archivo})
                    </div>
                    <p className="text-[#535768] leading-relaxed">{categoriaMeta.descripcion}</p>
                    <div className="text-[11px] text-[#808080] pt-1">
                      Público recomendado: {categoriaMeta.publico_recomendado} · Enfoque:{' '}
                      {categoriaMeta.enfoque_lector}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Módulo Pedagógico IA (Solo DOCENTE o ADMIN) */}
          {canManageTests && (
            <div className="pt-6 border-t border-[#d0d4e4] space-y-5">
              <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#333333]">
                    Evaluación de Comprensión Lectora (IA)
                  </h3>
                  <p className="text-xs text-[#535768] mt-0.5">
                    Cuestionario estructurado de selección múltiple (A–D) generado y validado a partir de la sinopsis.
                  </p>
                </div>

                <div className="relative group shrink-0">
                  <button
                    type="button"
                    onClick={handleGeneratePrueba}
                    disabled={!hasSinopsis || generating}
                    title={
                      !hasSinopsis
                        ? 'Requiere sinopsis descriptiva registrada en el libro'
                        : 'Generar nueva prueba con Gemini'
                    }
                    className="btn-primary-pill text-xs py-2.5 px-5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {!hasSinopsis ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {generating
                      ? 'Analizando obra...'
                      : 'Generar Prueba (IA)'}
                  </button>
                </div>
              </div>

              {generating && (
                <div className="no-print rounded-[16px] border border-[#6161ff]/30 bg-[#e7ecff]/40 p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-[#6161ff]">
                    <div className="w-4 h-4 rounded-full border-2 border-[#6161ff] border-t-transparent animate-spin" />
                    Analizando obra y estructurando preguntas bajo esquema PruebaLecturaDTO...
                  </div>
                  <div className="h-1.5 w-full bg-[#dddfeb] rounded-full overflow-hidden">
                    <div className="h-full bg-[#6161ff] w-2/3 animate-pulse rounded-full" />
                  </div>
                </div>
              )}

              {/* Selector de pruebas guardadas si hay varias */}
              {pruebas.length > 1 && (
                <div className="no-print flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs text-[#535768] shrink-0 font-medium">Versiones guardadas:</span>
                  {pruebas.map((p, idx) => (
                    <button
                      key={p.id_prueba}
                      type="button"
                      onClick={() => setActivePrueba(p)}
                      className={`px-3.5 py-1 rounded-[160px] text-xs font-medium transition-all shrink-0 cursor-pointer ${
                        activePrueba?.id_prueba === p.id_prueba
                          ? 'bg-[#6161ff] text-white shadow-xs'
                          : 'bg-[#f5f6f8] text-[#535768] hover:text-[#333333]'
                      }`}
                    >
                      Prueba #{p.id_prueba} ({idx === 0 ? 'Reciente' : p.created_at.slice(0, 10)})
                    </button>
                  ))}
                </div>
              )}

              {/* Renderizado de la prueba activa */}
              {!loadingPruebas && activePrueba && (
                <div className="rounded-[20px] border border-[#d0d4e4] bg-[#f5f6f8] p-5 sm:p-6 space-y-5">
                  <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#d0d4e4]">
                    <div className="inline-flex rounded-[160px] border border-[#dddfeb] bg-[#ffffff] p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('estudiante')}
                        className={`inline-flex items-center gap-1.5 rounded-[160px] px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          viewMode === 'estudiante'
                            ? 'bg-[#6161ff] text-white shadow-xs'
                            : 'text-[#535768] hover:text-[#333333]'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Evaluación (Estudiante)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('docente')}
                        className={`inline-flex items-center gap-1.5 rounded-[160px] px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          viewMode === 'docente'
                            ? 'bg-[#6161ff] text-white shadow-xs'
                            : 'text-[#535768] hover:text-[#333333]'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Clave Docente
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintQuiz('estudiante')}
                        className="btn-outline-pill text-xs py-1.5 px-3.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir / PDF Alumno
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintQuiz('docente')}
                        className="btn-primary-pill text-xs py-1.5 px-3.5 cursor-pointer shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir Clave Docente
                      </button>
                    </div>
                  </div>

                  {/* Encabezado formal para hoja impresa */}
                  <div className="border-b border-[#d0d4e4] pb-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-lg font-bold text-[#333333]">
                        {viewMode === 'estudiante'
                          ? `Evaluación de Comprensión Lectora: ${libro.titulo}`
                          : `Hoja de Claves Docentes: ${libro.titulo}`}
                      </h4>
                      <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-mono text-xs">
                        Prueba #{activePrueba.id_prueba} · ISBN {libro.isbn}
                      </span>
                    </div>
                    {viewMode === 'estudiante' && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#535768]">
                        <div>Nombre del estudiante: ________________________________________</div>
                        <div>Fecha: ____ / ____ / ________ &nbsp;&nbsp; Curso: __________</div>
                      </div>
                    )}
                  </div>

                  <ol className="space-y-4">
                    {activePrueba.contenido.evaluacion.map((q, idx) => (
                      <li
                        key={idx}
                        className="print-break-avoid rounded-[16px] border border-[#d0d4e4] bg-[#ffffff] p-5 space-y-3 shadow-2xs"
                      >
                        <p className="text-sm font-semibold text-[#333333] leading-snug">
                          {idx + 1}. {q.pregunta}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(['A', 'B', 'C', 'D'] as const).map((letra) => {
                            const isCorrect = q.respuesta_correcta === letra;
                            const showAnswer = viewMode === 'docente' && isCorrect;
                            return (
                              <div
                                key={letra}
                                className={`rounded-[8px] border px-3.5 py-2 text-xs flex items-start gap-2.5 transition-all ${
                                  showAnswer
                                    ? 'border-[#2a5c4e] bg-[#bcfe90]/40 text-[#2a5c4e] font-semibold'
                                    : 'border-[#dddfeb] bg-[#f5f6f8] text-[#333333]'
                                }`}
                              >
                                <span className="font-mono font-bold shrink-0">{letra}.</span>
                                <span className="flex-1">{q.opciones[letra]}</span>
                                {showAnswer && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2a5c4e] shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {viewMode === 'docente' && (
                          <div className="pt-2.5 border-t border-[#f5f6f8] text-xs text-[#535768]">
                            <span className="font-semibold text-[#2a5c4e]">
                              Respuesta correcta ({q.respuesta_correcta}):
                            </span>{' '}
                            {q.justificacion}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
