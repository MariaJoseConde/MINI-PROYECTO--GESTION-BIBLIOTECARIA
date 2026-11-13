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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="libro-detalle-title"
    >
      <div className="w-full max-w-4xl rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera del Modal (oculta en impresión cuando hay prueba activa) */}
        <div className="no-print flex items-center justify-between border-b border-[#E7E2D8] bg-[#FBF9F5] px-6 py-4 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-[#57534E]">
            <BookOpen className="w-4 h-4 text-[#1E3A8A]" />
            <span>Ficha Bibliográfica Completa · Folio #{libro.id_libro}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#57534E] hover:bg-[#EBE6DF] transition-colors"
            aria-label="Cerrar ficha del libro"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8">
          {/* Bloque principal de ficha (oculto al imprimir si se imprime evaluación) */}
          <div className={activePrueba ? 'no-print' : ''}>
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
              <div className="mx-auto md:mx-0 w-48 md:w-full">
                <BookCover libro={libro} size="lg" />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium tracking-wider uppercase text-[#78716C]">
                    {libro.categoria}
                    {categoriaMeta ? ` · CDU ${categoriaMeta.codigo_archivo}` : ''}
                  </p>
                  <h2
                    id="libro-detalle-title"
                    className="mt-1 font-serif text-2xl sm:text-3xl font-semibold text-[#1C1917] leading-tight"
                  >
                    {libro.titulo}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#57534E]">{autoresTexto}</p>
                </div>

                {/* Tabla de metadatos bibliográficos ampliada */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-[#E7E2D8] py-3.5 text-xs">
                  <div>
                    <dt className="text-[#78716C]">ISBN</dt>
                    <dd className="mt-0.5 font-mono font-medium text-[#1C1917] tabular-nums">
                      {libro.isbn}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Año</dt>
                    <dd className="mt-0.5 font-mono font-medium text-[#1C1917] tabular-nums">
                      {libro.anio_publicacion ?? 'Sin dato'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Extensión</dt>
                    <dd className="mt-0.5 font-mono font-medium text-[#1C1917] tabular-nums">
                      {libro.paginas ? `${libro.paginas} págs.` : 'Sin dato'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Disponibilidad</dt>
                    <dd
                      className={`mt-0.5 font-mono font-semibold tabular-nums ${
                        libro.copias_disp === 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
                      }`}
                    >
                      {libro.copias_disp} / {libro.copias_totales} uds.
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[#78716C]">Editorial / Colección</dt>
                    <dd className="mt-0.5 font-medium text-[#1C1917]">
                      {libro.editorial || 'Edición de catálogo'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Idioma</dt>
                    <dd className="mt-0.5 font-medium text-[#1C1917]">
                      {libro.idioma || 'Español'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Ubicación en sala</dt>
                    <dd className="mt-0.5 font-mono text-[#1C1917]">
                      {libro.ubicacion_estante || categoriaMeta?.ubicacion_sala || 'Sala General'}
                    </dd>
                  </div>
                </dl>

                {libro.temas_clave && (
                  <div className="text-xs text-[#44403C]">
                    <span className="font-semibold text-[#78716C] uppercase tracking-wider mr-2">
                      Temas clave:
                    </span>
                    <span>{libro.temas_clave}</span>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-1.5">
                    Sinopsis de la obra
                  </h3>
                  {hasSinopsis ? (
                    <p className="text-sm text-[#44403C] leading-relaxed">{libro.sinopsis}</p>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-md border border-[#E7E2D8] bg-[#FBF9F5] p-3 text-xs text-[#57534E]">
                      <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                      <span>
                        Este volumen no tiene una sinopsis descriptiva registrada. Para habilitar la generación automática de pruebas de comprensión lectora, un administrador debe completar la sinopsis en el catálogo.
                      </span>
                    </div>
                  )}
                </div>

                {categoriaMeta && (
                  <div className="rounded-md border border-[#E7E2D8] bg-[#FBF9F5] p-3.5 text-xs space-y-1">
                    <div className="font-semibold text-[#1C1917]">
                      Sobre la categoría: {categoriaMeta.nombre} (CDU {categoriaMeta.codigo_archivo})
                    </div>
                    <p className="text-[#57534E] leading-relaxed">{categoriaMeta.descripcion}</p>
                    <div className="text-[11px] text-[#78716C] pt-1">
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
            <div className="pt-6 border-t border-[#E7E2D8] space-y-5">
              <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                    Evaluación de Comprensión Lectora (IA)
                  </h3>
                  <p className="text-xs text-[#57534E] mt-0.5">
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
                    className="inline-flex items-center gap-2 rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554] disabled:bg-[#A8A29E] disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {!hasSinopsis ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {generating
                      ? 'Analizando obra y estructurando preguntas...'
                      : 'Generar Prueba (IA)'}
                  </button>
                </div>
              </div>

              {generating && (
                <div className="no-print rounded-md border border-[#1E3A8A]/25 bg-[#F8FAFC] p-4 space-y-2">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-[#1E3A8A]">
                    <div className="w-4 h-4 rounded-full border-2 border-[#1E3A8A] border-t-transparent animate-spin" />
                    Analizando obra y estructurando preguntas bajo esquema PruebaLecturaDTO...
                  </div>
                  <div className="h-1.5 w-full bg-[#E2E8F0] rounded overflow-hidden">
                    <div className="h-full bg-[#1E3A8A] w-2/3 animate-pulse rounded" />
                  </div>
                </div>
              )}

              {/* Selector de pruebas guardadas si hay varias */}
              {pruebas.length > 1 && (
                <div className="no-print flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs text-[#78716C] shrink-0">Versiones guardadas:</span>
                  {pruebas.map((p, idx) => (
                    <button
                      key={p.id_prueba}
                      type="button"
                      onClick={() => setActivePrueba(p)}
                      className={`px-3 py-1 rounded text-xs font-mono transition-colors shrink-0 ${
                        activePrueba?.id_prueba === p.id_prueba
                          ? 'bg-[#1C1917] text-white'
                          : 'bg-[#F3EFE7] text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      Prueba #{p.id_prueba} ({idx === 0 ? 'Reciente' : p.created_at.slice(0, 10)})
                    </button>
                  ))}
                </div>
              )}

              {/* Renderizado de la prueba activa (con soporte @media print) */}
              {!loadingPruebas && activePrueba && (
                <div className="rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] p-5 sm:p-6 space-y-5">
                  <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E7E2D8]">
                    <div className="inline-flex rounded-md border border-[#D6CEBE] bg-[#F3EFE7] p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('estudiante')}
                        className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                          viewMode === 'estudiante'
                            ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                            : 'text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Evaluación (Estudiante)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('docente')}
                        className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                          viewMode === 'docente'
                            ? 'bg-[#FFFFFF] text-[#1E3A8A] shadow-xs'
                            : 'text-[#57534E] hover:text-[#1C1917]'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Clave de Corrección (Docente)
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintQuiz('estudiante')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#1C1917] hover:bg-[#F3EFE7] transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir / PDF Alumno
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintQuiz('docente')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] hover:bg-[#F3EFE7] transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir Clave Docente
                      </button>
                    </div>
                  </div>

                  {/* Encabezado formal para hoja impresa / vista previa */}
                  <div className="border-b border-[#D6CEBE] pb-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-serif text-lg font-semibold text-[#1C1917]">
                        {viewMode === 'estudiante'
                          ? `Evaluación de Comprensión Lectora: ${libro.titulo}`
                          : `Hoja de Claves Docentes: ${libro.titulo}`}
                      </h4>
                      <span className="font-mono text-xs text-[#57534E]">
                        Prueba #{activePrueba.id_prueba} · ISBN {libro.isbn}
                      </span>
                    </div>
                    {viewMode === 'estudiante' && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#57534E]">
                        <div>Nombre del estudiante: ________________________________________</div>
                        <div>Fecha: ____ / ____ / ________ &nbsp;&nbsp; Curso: __________</div>
                      </div>
                    )}
                  </div>

                  <ol className="space-y-5">
                    {activePrueba.contenido.evaluacion.map((q, idx) => (
                      <li
                        key={idx}
                        className="print-break-avoid rounded-md border border-[#E7E2D8] bg-[#FFFFFF] p-4 space-y-3"
                      >
                        <p className="text-sm font-semibold text-[#1C1917] leading-snug">
                          {idx + 1}. {q.pregunta}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(['A', 'B', 'C', 'D'] as const).map((letra) => {
                            const isCorrect = q.respuesta_correcta === letra;
                            const showAnswer = viewMode === 'docente' && isCorrect;
                            return (
                              <div
                                key={letra}
                                className={`rounded border px-3 py-2 text-xs flex items-start gap-2 ${
                                  showAnswer
                                    ? 'border-[#15803D] bg-[#F0FDF4] text-[#14532D] font-medium'
                                    : 'border-[#E7E2D8] bg-[#FBF9F5] text-[#44403C]'
                                }`}
                              >
                                <span className="font-mono font-bold shrink-0">{letra}.</span>
                                <span className="flex-1">{q.opciones[letra]}</span>
                                {showAnswer && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {viewMode === 'docente' && (
                          <div className="pt-2 border-t border-[#F3EFE7] text-xs text-[#44403C]">
                            <span className="font-semibold text-[#15803D]">
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
