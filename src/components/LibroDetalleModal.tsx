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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/65 backdrop-blur-md p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="libro-detalle-title"
    >
      <div className="w-full max-w-4xl rounded-2xl glass-modal overflow-hidden my-auto max-h-[92vh] flex flex-col font-sans">
        {/* Cabecera del Modal (oculta en impresión cuando hay prueba activa) */}
        <div className="no-print flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 bg-transparent px-6 py-4 shrink-0 min-h-16">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs">
              Ficha Bibliográfica · Folio #{libro.id_libro}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            aria-label="Cerrar ficha del libro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 sm:p-8 space-y-8 bg-transparent">
          {/* Bloque principal de ficha (oculto al imprimir si se imprime evaluación) */}
          <div className={`card-monday p-6 sm:p-8 ${activePrueba ? 'no-print' : ''}`}>
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
              <div className="mx-auto md:mx-0 w-48 md:w-full">
                <BookCover libro={libro} size="lg" />
              </div>

              <div className="space-y-4">
                <div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs">
                    {libro.categoria}
                    {categoriaMeta ? ` · CDU ${categoriaMeta.codigo_archivo}` : ''}
                  </span>
                  <h2
                    id="libro-detalle-title"
                    className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tracking-tight text-left"
                  >
                    {libro.titulo}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-700 text-left">{autoresTexto}</p>
                </div>

                {/* Tabla de metadatos bibliográficos ampliada */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-slate-200 py-4 text-sm">
                  <div>
                    <dt className="text-slate-600 font-medium">ISBN</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {libro.isbn}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-600 font-medium">Año</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {libro.anio_publicacion ?? 'Sin dato'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-600 font-medium">Extensión</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                      {libro.paginas ? `${libro.paginas} págs.` : 'Sin dato'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-600 font-medium">Disponibilidad</dt>
                    <dd className="mt-0.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums border ${
                          libro.copias_disp === 0
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {libro.copias_disp} / {libro.copias_totales} uds.
                      </span>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-600 font-medium">Editorial / Colección</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {libro.editorial || 'Edición de catálogo'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-600 font-medium">Idioma</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {libro.idioma || 'Español'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-600 font-medium">Ubicación en sala</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                      {libro.ubicacion_estante || categoriaMeta?.ubicacion_sala || 'Sala General'}
                    </dd>
                  </div>
                </dl>

                {libro.temas_clave && (
                  <div className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900 uppercase tracking-wider mr-2 text-xs">
                      Temas clave:
                    </span>
                    <span className="font-medium">{libro.temas_clave}</span>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 text-left">
                    Sinopsis de la obra
                  </h3>
                  {hasSinopsis ? (
                    <p className="text-sm font-normal text-slate-800 leading-relaxed max-w-prose text-left">{libro.sinopsis}</p>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900">
                      <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        Este volumen no tiene una sinopsis descriptiva registrada. Para habilitar la generación automática de pruebas pedagógicas, un docente o administrador debe completar la sinopsis en el catálogo.
                      </span>
                    </div>
                  )}
                </div>

                {categoriaMeta && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-1 text-left">
                    <div className="font-bold text-slate-900">
                      Sobre la categoría: {categoriaMeta.nombre} (CDU {categoriaMeta.codigo_archivo})
                    </div>
                    <p className="text-slate-700 leading-relaxed font-normal">{categoriaMeta.descripcion}</p>
                    <div className="text-xs font-medium text-slate-600 pt-1">
                      Público recomendado: {categoriaMeta.publico_recomendado} · Enfoque: {categoriaMeta.enfoque_lector}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Módulo Pedagógico IA (Solo DOCENTE o ADMIN) */}
          {canManageTests && (
            <div className="card-monday p-6 sm:p-8 space-y-6">
              <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 text-left">
                    Evaluación de Comprensión Lectora (IA)
                  </h3>
                  <p className="text-sm font-normal text-slate-700 text-left max-w-prose leading-relaxed">
                    Cuestionario estructurado de selección múltiple (A–D) generado y validado a partir de la sinopsis de la obra.
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={handleGeneratePrueba}
                    disabled={!hasSinopsis || generating}
                    className="min-h-[44px] px-5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    {!hasSinopsis ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>{generating ? 'Estructurando con IA...' : 'Generar Prueba con IA'}</span>
                  </button>
                </div>
              </div>

              {generating && (
                <div className="no-print rounded-lg border border-indigo-200 bg-indigo-50 p-5 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-indigo-700">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                    Analizando obra y estructurando preguntas bajo esquema PruebaLecturaDTO...
                  </div>
                  <div className="h-1.5 w-full bg-indigo-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-2/3 animate-pulse rounded-full" />
                  </div>
                </div>
              )}

              {/* Selector de pruebas guardadas si hay varias */}
              {pruebas.length > 1 && (
                <div className="no-print flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-sm text-slate-700 shrink-0 font-medium">Versiones guardadas:</span>
                  {pruebas.map((p, idx) => (
                    <button
                      key={p.id_prueba}
                      type="button"
                      onClick={() => setActivePrueba(p)}
                      className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                        activePrueba?.id_prueba === p.id_prueba
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Prueba #{p.id_prueba} ({idx === 0 ? 'Reciente' : p.created_at.slice(0, 10)})
                    </button>
                  ))}
                </div>
              )}

              {/* Renderizado de la prueba activa */}
              {!loadingPruebas && activePrueba && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6 space-y-6">
                  <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setViewMode('estudiante')}
                        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-md px-3.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                          viewMode === 'estudiante'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Evaluación (Estudiante)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('docente')}
                        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-md px-3.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                          viewMode === 'docente'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Clave Docente
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handlePrintQuiz('estudiante')}
                        className="min-h-[40px] px-3.5 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir / PDF Alumno
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintQuiz('docente')}
                        className="min-h-[40px] px-3.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir Clave Docente
                      </button>
                    </div>
                  </div>

                  {/* Encabezado formal para hoja impresa */}
                  <div className="border-b border-slate-200 pb-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-lg font-bold text-slate-900 text-left">
                        {viewMode === 'estudiante'
                          ? `Evaluación de Comprensión Lectora: ${libro.titulo}`
                          : `Hoja de Claves Docentes: ${libro.titulo}`}
                      </h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Prueba #{activePrueba.id_prueba} · ISBN {libro.isbn}
                      </span>
                    </div>
                    {viewMode === 'estudiante' && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium text-slate-700">
                        <div>Nombre del estudiante: ________________________________________</div>
                        <div>Fecha: ____ / ____ / ________ &nbsp;&nbsp; Curso: __________</div>
                      </div>
                    )}
                  </div>

                  <ol className="space-y-4">
                    {activePrueba.contenido.evaluacion.map((q, idx) => (
                      <li
                        key={idx}
                        className="print-break-avoid rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs"
                      >
                        <p className="text-base font-semibold text-slate-900 leading-relaxed text-left max-w-prose">
                          {idx + 1}. {q.pregunta}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(['A', 'B', 'C', 'D'] as const).map((letra) => {
                            const isCorrect = q.respuesta_correcta === letra;
                            const showAnswer = viewMode === 'docente' && isCorrect;
                            return (
                              <div
                                key={letra}
                                className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 transition-colors ${
                                  showAnswer
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                                    : 'border-slate-300 bg-slate-50 text-slate-800'
                                }`}
                              >
                                <span className="font-mono font-bold shrink-0">{letra}.</span>
                                <span className="flex-1 font-medium leading-relaxed">{q.opciones[letra]}</span>
                                {showAnswer && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {viewMode === 'docente' && (
                          <div className="pt-3 border-t border-slate-100 text-sm font-medium text-slate-700">
                            <span className="font-bold text-emerald-800">
                              Respuesta correcta ({q.respuesta_correcta}):
                            </span>{' '}
                            <span className="text-slate-800 font-normal leading-relaxed">{q.justificacion}</span>
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
