import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  Printer,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { Libro, PruebaLectura } from '../types/sgbi.ts';

interface EvaluacionesViewProps {
  libros: Libro[];
  onSelectLibro: (libro: Libro) => void;
}

export const EvaluacionesView: React.FC<EvaluacionesViewProps> = ({
  libros,
  onSelectLibro,
}) => {
  const [pruebas, setPruebas] = useState<PruebaLectura[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePrueba, setActivePrueba] = useState<PruebaLectura | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [generatingForLibroId, setGeneratingForLibroId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPruebas() {
      setLoading(true);
      try {
        const res = await fetch('/api/pruebas');
        if (!res.ok) return;
        const data = (await res.json()) as { pruebas: PruebaLectura[] };
        if (!cancelled) {
          setPruebas(data.pruebas);
          if (data.pruebas.length > 0 && !activePrueba) {
            setActivePrueba(data.pruebas[0]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPruebas();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectPrueba(p: PruebaLectura) {
    setActivePrueba(p);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setActionMessage(null);
  }

  function handleAnswerOption(letra: 'A' | 'B' | 'C' | 'D') {
    if (!activePrueba) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: letra,
    }));
  }

  function handleResetAnswers() {
    setUserAnswers({});
    setCurrentQuestionIndex(0);
  }

  async function handleQuickGenerate(libro: Libro) {
    if (!libro.sinopsis || libro.sinopsis.trim().length < 20) {
      setActionMessage({
        type: 'error',
        text: `El libro "${libro.titulo}" no cuenta con sinopsis registrada para alimentar a la IA.`,
      });
      return;
    }

    setGeneratingForLibroId(libro.id_libro);
    setActionMessage(null);
    try {
      const res = await fetch('/api/ia/generar-prueba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_libro: libro.id_libro }),
      });
      const data = (await res.json()) as { prueba?: PruebaLectura; error?: string };
      if (!res.ok || !data.prueba) {
        setActionMessage({
          type: 'error',
          text: data.error || 'Error al generar la prueba con IA.',
        });
        return;
      }
      setPruebas((prev) => [data.prueba!, ...prev]);
      setActivePrueba(data.prueba);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setActionMessage({
        type: 'success',
        text: `Evaluación pedagógica generada para "${libro.titulo}" con 4 preguntas estructuradas.`,
      });
    } catch {
      setActionMessage({
        type: 'error',
        text: 'Error de conexión al generar la evaluación.',
      });
    } finally {
      setGeneratingForLibroId(null);
    }
  }

  const currentQuestions = activePrueba?.contenido?.evaluacion || [];
  const currentQuestion = currentQuestions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestionIndex];
  const isAnswered = selectedAnswer !== undefined;
  const isCorrect = isAnswered && selectedAnswer === currentQuestion?.respuesta_correcta;

  // Estadísticas del cuestionario activo
  const totalQuestions = currentQuestions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = Object.entries(userAnswers).reduce((acc, [idxStr, ans]) => {
    const q = currentQuestions[Number(idxStr)];
    return q && q.respuesta_correcta === ans ? acc + 1 : acc;
  }, 0);

  return (
    <div className="space-y-8 font-sans">
      {/* Banner Superior Principal (60-30-10) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider border border-indigo-200">
              <Sparkles className="w-4 h-4 shrink-0 text-indigo-600" />
              <span>Plataforma Pedagógica y Estudio con IA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 text-left">
              Centro de Estudio y Comprensión Lectora
            </h1>
            <p className="text-base font-normal text-slate-700 max-w-prose text-left leading-relaxed">
              Practica de forma interactiva con cuestionarios estructurados por inteligencia artificial. Obtén retroalimentación didáctica inmediata, explicaciones pedagógicas y seguimiento de aciertos.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:items-end gap-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-sm font-semibold border border-slate-300">
              <BookOpen className="w-4 h-4 text-slate-700" />
              {pruebas.length} {pruebas.length === 1 ? 'evaluación registrada' : 'evaluaciones registradas'}
            </span>
          </div>
        </div>

        {actionMessage && (
          <div
            role="status"
            className={`mt-6 p-4 rounded-lg border text-sm font-medium flex items-start gap-3 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-700 mt-0.5" />
            )}
            <span className="leading-relaxed">{actionMessage.text}</span>
          </div>
        )}
      </section>

      {/* Grid Principal: Modo Estudio Activo (Izquierda) + Selector y Generador (Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Entorno Interactivo de Estudio (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activePrueba ? (
            <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
              {/* Encabezado del Cuestionario Activo */}
              <div className="border-b border-slate-200 pb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                    Prueba #{activePrueba.id_prueba} · Comprensión Lectora
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600">
                      Progreso: <strong className="text-slate-900 font-semibold">{answeredCount}/{totalQuestions}</strong>
                    </span>
                    {answeredCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        {correctCount} correctas
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-left leading-snug">
                  {activePrueba.libro_titulo || activePrueba.contenido?.titulo_libro || 'Lectura de Análisis'}
                </h2>

                <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-600">
                  <span>Docente autor: <strong className="text-slate-800 font-semibold">{activePrueba.docente_nombre || 'Equipo Pedagógico'}</strong></span>
                  <span>·</span>
                  <span>Registrada: <span className="font-mono">{activePrueba.created_at.slice(0, 10)}</span></span>
                </div>
              </div>

              {/* Barra de Progreso y Paginador de Preguntas */}
              <nav aria-label="Navegación de preguntas del cuestionario" className="flex items-center justify-between gap-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    Pregunta {currentQuestionIndex + 1} de {totalQuestions}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentQuestions.map((_, qIdx) => {
                    const isAnsweredQ = userAnswers[qIdx] !== undefined;
                    const isCurrentQ = currentQuestionIndex === qIdx;
                    return (
                      <button
                        key={qIdx}
                        type="button"
                        onClick={() => setCurrentQuestionIndex(qIdx)}
                        aria-label={`Ir a pregunta ${qIdx + 1}`}
                        className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                          isCurrentQ
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : isAnsweredQ
                            ? 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {qIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Enunciado de la Pregunta */}
              {currentQuestion ? (
                <div className="space-y-6 pt-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                    <p className="text-base sm:text-lg font-semibold text-slate-900 text-left leading-relaxed max-w-prose">
                      {currentQuestion.pregunta}
                    </p>
                  </div>

                  {/* Opciones Interactivas (A, B, C, D) con accesibilidad táctil y contraste */}
                  <fieldset className="space-y-3">
                    <legend className="sr-only">Seleccione una respuesta</legend>
                    {(['A', 'B', 'C', 'D'] as const).map((letra) => {
                      const isOptionSelected = selectedAnswer === letra;
                      const isOptionCorrect = currentQuestion.respuesta_correcta === letra;

                      let buttonStyles = 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400';
                      if (isAnswered) {
                        if (isOptionCorrect) {
                          buttonStyles = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold';
                        } else if (isOptionSelected) {
                          buttonStyles = 'bg-rose-50 border-rose-500 text-rose-900 font-semibold';
                        } else {
                          buttonStyles = 'bg-slate-50 border-slate-200 text-slate-600';
                        }
                      }

                      return (
                        <button
                          key={letra}
                          type="button"
                          onClick={() => handleAnswerOption(letra)}
                          className={`w-full min-h-[52px] text-left p-4 rounded-lg border flex items-start gap-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${buttonStyles}`}
                        >
                          <span
                            className={`min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md font-mono font-bold text-xs shrink-0 ${
                              isAnswered && isOptionCorrect
                                ? 'bg-emerald-600 text-white'
                                : isAnswered && isOptionSelected
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            {letra}
                          </span>
                          <span className="text-sm font-medium leading-relaxed flex-1 pt-0.5">
                            {currentQuestion.opciones[letra]}
                          </span>
                          {isAnswered && isOptionCorrect && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                          )}
                          {isAnswered && isOptionSelected && !isOptionCorrect && (
                            <XCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </fieldset>

                  {/* Retroalimentación Didáctica y Pistas Pedagógicas (Regla 5: 10% Semántica Educativa) */}
                  {isAnswered && (
                    <div
                      role="region"
                      aria-live="polite"
                      className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                        <Lightbulb className="w-5 h-5 text-amber-800 shrink-0" />
                        <span>Justificación Pedagógica de la IA</span>
                      </div>
                      <p className="text-sm font-medium text-amber-900 leading-relaxed text-left max-w-prose">
                        {currentQuestion.justificacion}
                      </p>
                      <div className="text-xs font-semibold text-amber-800 pt-1">
                        Respuesta correcta identificada: Opción ({currentQuestion.respuesta_correcta})
                      </div>
                    </div>
                  )}

                  {/* Botones de Navegación de la Pregunta */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                      className="min-h-[44px] px-4 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Anterior</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleResetAnswers}
                        className="min-h-[44px] px-4 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Reiniciar respuestas</span>
                      </button>

                      {currentQuestionIndex < totalQuestions - 1 ? (
                        <button
                          type="button"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                          className="min-h-[44px] px-5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                        >
                          <span>Siguiente</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="inline-flex items-center px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-sm border border-emerald-300">
                          ¡Evaluación completada! ({correctCount}/{totalQuestions})
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
              <HelpCircle className="w-12 h-12 text-slate-400 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">
                Selecciona una evaluación para iniciar la sesión de estudio
              </h2>
              <p className="text-sm font-medium text-slate-600 max-w-prose mx-auto">
                Elige una de las pruebas guardadas en la lista lateral o genera una nueva evaluación pedagógica desde los libros con sinopsis del acervo.
              </p>
            </div>
          )}
        </div>

        {/* Columna Derecha: Catálogo de Pruebas y Generador con IA (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tarjeta: Pruebas Guardadas */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 text-left">
                Evaluaciones Guardadas ({pruebas.length})
              </h2>
              <p className="text-xs font-medium text-slate-600 mt-0.5 text-left">
                Selecciona una prueba para cargarla en el área de práctica.
              </p>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm font-medium text-slate-600">
                Cargando evaluaciones...
              </div>
            ) : pruebas.length === 0 ? (
              <div className="py-6 text-center text-sm font-medium text-slate-600">
                No hay evaluaciones registradas aún.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {pruebas.map((p) => {
                  const isSelected = activePrueba?.id_prueba === p.id_prueba;
                  const matchingBook = libros.find((l) => l.id_libro === p.id_libro);

                  return (
                    <div
                      key={p.id_prueba}
                      className={`p-3.5 rounded-lg border transition-colors space-y-2 text-left ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-400'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectPrueba(p)}
                        className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-700">
                            Prueba #{p.id_prueba}
                          </span>
                          <span className="text-[11px] font-mono font-medium text-slate-600">
                            {p.created_at.slice(0, 10)}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-1 line-clamp-2">
                          {p.libro_titulo || p.contenido?.titulo_libro}
                        </h3>
                        <p className="text-xs font-medium text-slate-600 mt-0.5 truncate">
                          {p.contenido?.evaluacion?.length ?? 4} preguntas · {p.docente_nombre || 'Docente'}
                        </p>
                      </button>

                      {matchingBook && (
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectLibro(matchingBook)}
                            className="min-h-[36px] px-3 rounded-md bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Ver Ficha e Imprimir</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Tarjeta: Generador IA desde Libros con Sinopsis */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 text-left">
                Generar Evaluación con IA
              </h2>
              <p className="text-xs font-medium text-slate-600 mt-0.5 text-left">
                Obras del acervo con sinopsis lista para estructurar preguntas automáticas.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {libros.map((l) => {
                const hasSinopsis = Boolean(l.sinopsis && l.sinopsis.trim().length >= 20);
                const isGenerating = generatingForLibroId === l.id_libro;

                return (
                  <div
                    key={l.id_libro}
                    className="p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {l.titulo}
                      </div>
                      <div className="text-xs font-medium text-slate-600 truncate mt-0.5">
                        {hasSinopsis ? (
                          <span className="text-emerald-700 font-medium">Sinopsis disponible</span>
                        ) : (
                          <span className="text-slate-500 font-normal">Sin sinopsis</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!hasSinopsis || isGenerating}
                      onClick={() => handleQuickGenerate(l)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed ${
                        hasSinopsis
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-300'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isGenerating ? 'Generando...' : 'Generar'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
