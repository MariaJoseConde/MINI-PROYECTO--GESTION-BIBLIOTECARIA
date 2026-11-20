import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { Libro, PruebaLectura, Usuario } from '../types/sgbi.ts';

interface EvaluacionesViewProps {
  libros: Libro[];
  onSelectLibro: (libro: Libro) => void;
  user?: Usuario | null;
}

interface AiTutorMessage {
  pregunta: string;
  respuesta: {
    concepto: string;
    ejemplo: string;
    resumen: string;
  };
  timestamp: string;
}

export const EvaluacionesView: React.FC<EvaluacionesViewProps> = ({
  libros,
  onSelectLibro,
}) => {
  const [pruebas, setPruebas] = useState<PruebaLectura[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePrueba, setActivePrueba] = useState<PruebaLectura | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [copiedCode, setCopiedCode] = useState(false);

  // Estados de consulta interactiva a la IA con reserva de espacio (Anti-CLS)
  const [inquiryText, setInquiryText] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiTutorResponse, setAiTutorResponse] = useState<AiTutorMessage | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPruebas() {
      setLoading(true);
      try {
        const res = await fetch('/api/pruebas');
        if (!res.ok) return;
        const data = (await res.json()) as { pruebas: PruebaLectura[] };
        if (!cancelled && data.pruebas) {
          setPruebas(data.pruebas);
          if (data.pruebas.length > 0) {
            setActivePrueba(data.pruebas[0]);
            setSelectedBookId(data.pruebas[0].id_libro);
          } else if (libros.length > 0) {
            setSelectedBookId(libros[0].id_libro);
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
  }, [libros]);

  // Selección de libro / tema activo
  const activeBook = libros.find((l) => l.id_libro === selectedBookId) || libros[0] || null;

  function handleSelectBookChange(newBookId: number) {
    setSelectedBookId(newBookId);
    const existingPrueba = pruebas.find((p) => p.id_libro === newBookId);
    if (existingPrueba) {
      setActivePrueba(existingPrueba);
    } else {
      setActivePrueba(null);
    }
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setAiTutorResponse(null);
    setActionMessage(null);
  }

  function handleAnswerOption(letra: 'A' | 'B' | 'C' | 'D') {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: letra,
    }));
  }

  function handleResetAnswers() {
    setUserAnswers({});
    setCurrentQuestionIndex(0);
  }

  async function handleCopyCode(codeText: string) {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      // Fallback
    }
  }

  async function handleAskTutor(e: React.FormEvent) {
    e.preventDefault();
    const query = inquiryText.trim();
    if (!query) return;

    setIsAiGenerating(true);
    setActionMessage(null);

    // Simulación de procesamiento pedagógico con temporizador estructurado
    setTimeout(() => {
      setIsAiGenerating(false);
      setAiTutorResponse({
        pregunta: query,
        respuesta: {
          concepto: `En el contexto de "${activeBook?.titulo || 'esta obra'}", la temática plantea interrogantes sobre la condición humana y los principios estructurales del relato. El autor utiliza un estilo directo que favorece la introspección del lector.`,
          ejemplo: `// Ejemplo de estructura de análisis pedagógico\nconst analisis = {\n  obra: "${activeBook?.titulo || 'Obra literaria'}",\n  categoria: "${activeBook?.categoria || 'General'}",\n  ejeTematico: "${query}",\n  metodologia: "Lectura crítica estructurada y comprensión deductiva"\n};\nconsole.log(analisis);`,
          resumen: `1. La clave interpretativa radica en relacionar los motivos del autor con el contexto social de la época.\n2. La comprensión profunda requiere contrastar las hipótesis iniciales con los argumentos textuales.\n3. Este concepto permite responder con precisión a preguntas de evaluación inferencial.`,
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setInquiryText('');
    }, 1100);
  }

  async function handleGenerateNewEvaluation() {
    if (!activeBook) return;
    if (!activeBook.sinopsis || activeBook.sinopsis.trim().length < 20) {
      setActionMessage({
        type: 'error',
        text: `El título "${activeBook.titulo}" no cuenta con sinopsis suficiente para estructurar la evaluación con IA.`,
      });
      return;
    }

    setIsAiGenerating(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/ia/generar-prueba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_libro: activeBook.id_libro }),
      });
      const data = (await res.json()) as { prueba?: PruebaLectura; error?: string };
      if (!res.ok || !data.prueba) {
        setActionMessage({
          type: 'error',
          text: data.error || 'No fue posible estructurar la prueba pedagógica.',
        });
        return;
      }
      setPruebas((prev) => [data.prueba!, ...prev]);
      setActivePrueba(data.prueba);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setActionMessage({
        type: 'success',
        text: `Evaluación pedagógica generada exitosamente para "${activeBook.titulo}".`,
      });
    } catch {
      setActionMessage({
        type: 'error',
        text: 'Error de conexión con el motor de IA.',
      });
    } finally {
      setIsAiGenerating(false);
    }
  }

  const currentQuestions = activePrueba?.contenido?.evaluacion || [];
  const currentQuestion = currentQuestions[currentQuestionIndex];
  const selectedAnswer = userAnswers[currentQuestionIndex];
  const isAnswered = selectedAnswer !== undefined;
  const isCorrect = isAnswered && selectedAnswer === currentQuestion?.respuesta_correcta;

  const totalQuestions = currentQuestions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = Object.entries(userAnswers).reduce((acc, [idxStr, ans]) => {
    const q = currentQuestions[Number(idxStr)];
    return q && q.respuesta_correcta === ans ? acc + 1 : acc;
  }, 0);

  // Ejemplo de código / cita técnica para la tarjeta de chunking 2
  const technicalExampleCode = activeBook
    ? `// Ficha técnica del modelo de estudio SGBI · IA\nconst moduloEstudio = {\n  isbn: "${activeBook.isbn}",\n  titulo: "${activeBook.titulo}",\n  clasificacionCDU: "${activeBook.categoria}",\n  nivelComprension: "Avanzado",\n  progresoActual: "${answeredCount}/${totalQuestions || 4} preguntas respondidas"\n};\n\nexport default moduloEstudio;`
    : `// Sesión de comprensión con IA activa`;

  return (
    <div className="space-y-8 font-sans">
      {/* ========================================================= */}
      {/* ZONA 1: CONTEXTO / TEMA (Arriba)                          */}
      {/* ========================================================= */}
      <section
        aria-labelledby="zona-contexto-heading"
        className="card-monday p-6 sm:p-8 space-y-5"
      >
        {/* Migas de pan de la sesión de estudio (WCAG Ubicación Constante) */}
        <nav aria-label="Migas de pan de la sesión de estudio">
          <ol className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
            <li>
              <a
                href="#/inicio"
                className="text-slate-600 hover:text-indigo-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
              >
                Inicio
              </a>
            </li>
            <li aria-hidden="true" className="text-slate-400">/</li>
            <li>
              <a
                href="#/catalogo"
                className="text-slate-600 hover:text-indigo-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
              >
                Acervo y Temas
              </a>
            </li>
            <li aria-hidden="true" className="text-slate-400">/</li>
            <li className="text-slate-900 font-bold truncate max-w-xs sm:max-w-md">
              {activeBook?.titulo || 'Sesión de Estudio'}
            </li>
          </ol>
        </nav>

        {/* Encabezado contextual y selector explícito de tema */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#287A65]/12 dark:bg-[#287A65]/25 text-[#287A65] dark:text-[#38a58a] text-xs font-semibold uppercase tracking-wider border border-[#287A65]/30">
              <Sparkles className="w-4 h-4 text-[#287A65] dark:text-[#38a58a] shrink-0" />
              <span>Módulo de Estudio Guiado e Inteligencia Artificial</span>
            </div>
            <h1
              id="zona-contexto-heading"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-[#183B4E] dark:text-white text-left"
            >
              {activeBook?.titulo || 'Sesión de Comprensión y Aprendizaje'}
            </h1>
            <p className="text-base font-normal text-slate-800 dark:text-slate-200 max-w-prose text-left leading-relaxed">
              Analiza los conceptos clave estructurados por IA, examina ejemplos aplicados y consolida tu comprensión con preguntas de verificación inmediata.
            </p>
          </div>

          {/* Formulario explícito con <label> para seleccionar tema (Una acción principal por vista) */}
          <div className="shrink-0 w-full lg:w-80 space-y-2">
            <label
              htmlFor="selector-obra-estudio"
              className="block text-sm font-medium text-[#183B4E] dark:text-slate-100 text-left"
            >
              Seleccionar tema u obra para estudiar:
            </label>
            <select
              id="selector-obra-estudio"
              value={selectedBookId || ''}
              onChange={(e) => handleSelectBookChange(Number(e.target.value))}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-lg border border-[#183B4E]/20 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/70 text-[#183B4E] dark:text-slate-100 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287A65] cursor-pointer shadow-2xs"
            >
              {libros.map((l) => (
                <option key={l.id_libro} value={l.id_libro} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {l.titulo} ({l.categoria})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metadatos del tema y barra de progreso de la sesión */}
        {activeBook && (
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Colección: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{activeBook.categoria}</strong>
              </span>
              <span>·</span>
              <span>
                Autor(es): <strong className="text-slate-900 dark:text-slate-100 font-semibold">{activeBook.autores.map((a) => a.nombre).join(', ') || 'Equipo editorial'}</strong>
              </span>
              <span>·</span>
              <span>
                Ubicación: <span className="font-mono text-slate-800 dark:text-slate-200">{activeBook.ubicacion_estante || 'Sala General'}</span>
              </span>
            </div>

            {totalQuestions > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-700 dark:text-slate-300">Progreso de la sesión:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                  {answeredCount}/{totalQuestions} respondidas
                </span>
                {answeredCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80">
                    {correctCount} aciertos
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {actionMessage && (
          <div
            role="status"
            className={`p-4 rounded-lg border text-sm font-medium flex items-start gap-3 ${
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
            <span className="leading-relaxed text-left">{actionMessage.text}</span>
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* ZONA 2: CONTENIDO GENERADO POR IA (Centro) — CHUNKING     */}
      {/* ========================================================= */}
      <section aria-labelledby="zona-contenido-heading" className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="zona-contenido-heading"
            className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 text-left"
          >
            Contenido Didáctico Sintetizado por IA
          </h2>
          <span className="text-xs font-medium text-slate-600">
            Progresión guiada en bloques independientes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Bloque 1: Definición y Concepto Clave */}
          <article className="card-monday p-6 sm:p-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#287A65]/12 dark:bg-[#287A65]/25 border border-[#287A65]/30 text-[#287A65] dark:text-[#38a58a] flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#183B4E] dark:text-white text-left">
                1. Concepto y Definición
              </h3>
              <p className="text-base font-normal text-slate-800 dark:text-slate-200 leading-relaxed max-w-prose text-left">
                {activeBook?.sinopsis ||
                  'Esta obra presenta los principios teóricos y metodológicos fundamentales para la comprensión de su temática central, estructurando un marco de referencia aplicable.'}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-slate-600 dark:text-slate-400 text-left">
              Eje conceptual fundamental · Comprensión literal
            </div>
          </article>

          {/* Bloque 2: Ejemplo Práctico y Bloque de Código / Cita Técnica */}
          <article className="card-monday p-6 sm:p-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#287A65]/12 dark:bg-[#287A65]/25 border border-[#287A65]/30 text-[#287A65] dark:text-[#38a58a] flex items-center justify-center shrink-0">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#183B4E] dark:text-white text-left">
                2. Aplicación Práctica y Estructura
              </h3>
              <p className="text-base font-normal text-slate-800 dark:text-slate-200 leading-relaxed max-w-prose text-left">
                El siguiente bloque refleja la estructura formal de análisis y catalogación de la obra dentro del sistema bibliotecario:
              </p>

              {/* Bloque de código con fuente monoespaciada, fondo diferenciado y botón de copiado ≥44x44 */}
              <div className="rounded-xl bg-slate-900 text-slate-50 p-4 font-mono text-xs overflow-x-auto space-y-3 shadow-inner">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <span className="text-slate-400 text-[11px] font-medium font-sans">
                    Estructura técnica
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(technicalExampleCode)}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287A65]"
                    aria-label="Copiar código al portapapeles"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-sans">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="font-sans">Copiar código</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-slate-200 leading-normal text-left">
                  <code>{technicalExampleCode}</code>
                </pre>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-slate-600 dark:text-slate-400 text-left">
              Demostración práctica · Enfoque computacional y analítico
            </div>
          </article>

          {/* Bloque 3: Resumen Clave y Puntos de Retención */}
          <article className="card-monday p-6 sm:p-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#287A65]/12 dark:bg-[#287A65]/25 border border-[#287A65]/30 text-[#287A65] dark:text-[#38a58a] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#183B4E] dark:text-white text-left">
                3. Resumen Clave para Estudio
              </h3>
              <ul className="space-y-2.5 text-base font-normal text-slate-800 dark:text-slate-200 leading-relaxed text-left max-w-prose">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2.5 shrink-0" />
                  <span>
                    <strong>Identificación:</strong> Localización rápida mediante CDU y ficha bibliográfica normalizada.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2.5 shrink-0" />
                  <span>
                    <strong>Deducción:</strong> La sinopsis descriptiva alimenta directamente el razonamiento inferencial de la IA.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2.5 shrink-0" />
                  <span>
                    <strong>Verificación:</strong> Cada respuesta del cuestionario se valida contra las premisas de la obra.
                  </span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs font-medium text-slate-600 text-left">
              Síntesis didáctica · Memoria de trabajo
            </div>
          </article>
        </div>
      </section>

      {/* ========================================================= */}
      {/* ZONA 3: ZONA DE INTERACCIÓN, PREGUNTA Y TUTORÍA (Abajo)   */}
      {/* ========================================================= */}
      <section aria-labelledby="zona-interaccion-heading" className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="zona-interaccion-heading"
            className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 text-left"
          >
            Zona de Interacción y Verificación
          </h2>
          {activeBook && !activePrueba && (
            <button
              type="button"
              disabled={isAiGenerating}
              onClick={handleGenerateNewEvaluation}
              className="min-h-[44px] px-4 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generar Cuestionario con IA</span>
            </button>
          )}
        </div>

        {/* Tarjeta de Cuestionario de Verificación Interactiva */}
        {activePrueba && currentQuestion ? (
          <article className="card-monday p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                Pregunta {currentQuestionIndex + 1} de {totalQuestions} · Evaluación Activa
              </span>
              <div className="flex items-center gap-2">
                {currentQuestions.map((_, qIdx) => (
                  <button
                    key={qIdx}
                    type="button"
                    onClick={() => setCurrentQuestionIndex(qIdx)}
                    aria-label={`Ir a pregunta ${qIdx + 1}`}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                      currentQuestionIndex === qIdx
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : userAnswers[qIdx] !== undefined
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        : 'bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {qIdx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Enunciado */}
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white text-left leading-relaxed max-w-prose">
                {currentQuestion.pregunta}
              </p>
            </div>

            {/* Opciones Interactivas A, B, C, D (≥44px de área táctil) */}
            <fieldset className="space-y-3">
              <legend className="sr-only">Seleccione una respuesta para la pregunta</legend>
              {(['A', 'B', 'C', 'D'] as const).map((letra) => {
                const isOptionSelected = selectedAnswer === letra;
                const isOptionCorrect = currentQuestion.respuesta_correcta === letra;

                let btnStyles =
                  'bg-white dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-400 dark:hover:border-slate-600';
                if (isAnswered) {
                  if (isOptionCorrect) {
                    btnStyles = 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 font-semibold';
                  } else if (isOptionSelected) {
                    btnStyles = 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 dark:border-rose-600 text-rose-900 dark:text-rose-200 font-semibold';
                  } else {
                    btnStyles = 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400';
                  }
                }

                return (
                  <button
                    key={letra}
                    type="button"
                    onClick={() => handleAnswerOption(letra)}
                    className={`w-full min-h-[52px] text-left p-4 rounded-lg border flex items-start gap-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${btnStyles}`}
                  >
                    <span
                      className={`min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md font-mono font-bold text-xs shrink-0 ${
                        isAnswered && isOptionCorrect
                          ? 'bg-emerald-600 text-white'
                          : isAnswered && isOptionSelected
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {letra}
                    </span>
                    <span className="text-sm font-medium leading-relaxed flex-1 pt-0.5">
                      {currentQuestion.opciones[letra]}
                    </span>
                    {isAnswered && isOptionCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {isAnswered && isOptionSelected && !isOptionCorrect && (
                      <XCircle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </fieldset>

            {/* Retroalimentación didáctica inmediata y pista pedagógica */}
            {isAnswered && (
              <div
                role="region"
                aria-live="polite"
                className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 rounded-lg p-5 space-y-2"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                  <Lightbulb className="w-5 h-5 text-amber-800 dark:text-amber-300 shrink-0" />
                  <span>Justificación Pedagógica y Pista de la IA</span>
                </div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed text-left max-w-prose">
                  {currentQuestion.justificacion}
                </p>
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 pt-1 text-left">
                  Opción correcta identificada: ({currentQuestion.respuesta_correcta})
                </div>
              </div>
            )}

            {/* Paginación de preguntas */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                className="min-h-[44px] px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800/40 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border-slate-200 dark:disabled:border-slate-800 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Pregunta anterior</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetAnswers}
                  className="min-h-[44px] px-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reiniciar sesión</span>
                </button>

                {currentQuestionIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    className="min-h-[44px] px-5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  >
                    <span>Siguiente pregunta</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="inline-flex items-center px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-sm border border-emerald-300 dark:border-emerald-800">
                    ¡Evaluación completada! ({correctCount}/{totalQuestions})
                  </div>
                )}
              </div>
            </div>
          </article>
        ) : (
          <article className="card-monday p-8 text-center space-y-4">
            <HelpCircle className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No hay cuestionario activo para esta obra
            </h3>
            <p className="text-base font-normal text-slate-700 dark:text-slate-300 max-w-prose mx-auto">
              Presiona el botón de &ldquo;Generar Cuestionario con IA&rdquo; para estructurar automáticamente una prueba de comprensión pedagógica basada en la sinopsis de este título.
            </p>
          </article>
        )}

        {/* Zona de Consulta y Ampliación con el Tutor IA (Reserva de espacio Anti-CLS) */}
        <article className="card-monday p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white text-left flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Consulta Abierta con el Tutor Pedagógico IA</span>
            </h3>
            <p className="text-sm font-normal text-slate-700 dark:text-slate-300 text-left max-w-prose leading-relaxed">
              Escribe una pregunta sobre el tema, solicita un ejemplo adicional o pide clarificación sobre cualquier pasaje de la obra.
            </p>
          </div>

          {/* Formulario semántico con <label> visible */}
          <form onSubmit={handleAskTutor} className="space-y-3">
            <label
              htmlFor="ai-inquiry-input"
              className="block text-sm font-medium text-slate-900 dark:text-slate-100 text-left"
            >
              ¿Qué deseas consultar o profundizar con la IA?
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="ai-inquiry-input"
                type="text"
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
                placeholder="Ej. Explica la metáfora central del capítulo o dame otro ejemplo práctico..."
                className="flex-1 min-h-[44px] px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              />
              <button
                type="submit"
                disabled={isAiGenerating || !inquiryText.trim()}
                className="min-h-[44px] min-w-[44px] px-5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:bg-slate-200 dark:disabled:bg-slate-800/40 disabled:text-slate-500 dark:disabled:text-slate-600 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Consultar</span>
              </button>
            </div>
          </form>

          {/* Contenedor reservado para evitar Cumulative Layout Shift (CLS) */}
          <div className="min-h-[140px] rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-6 flex items-center justify-center">
            {isAiGenerating ? (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center justify-center gap-3 text-center"
              >
                <div className="w-6 h-6 rounded-full border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  Analizando tu consulta y sintetizando la respuesta pedagógica...
                </span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Espacio reservado para evitar saltos bruscos en el diseño (Anti-CLS)
                </span>
              </div>
            ) : aiTutorResponse ? (
              <div className="w-full text-left space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    Respuesta del Tutor IA · {aiTutorResponse.timestamp}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-xs">
                    Consulta: &ldquo;{aiTutorResponse.pregunta}&rdquo;
                  </span>
                </div>
                <p className="text-base font-normal text-slate-800 dark:text-slate-200 leading-relaxed max-w-prose">
                  {aiTutorResponse.respuesta.concepto}
                </p>
                <div className="rounded-md bg-slate-900 text-slate-100 p-3 font-mono text-xs overflow-x-auto">
                  <pre>{aiTutorResponse.respuesta.ejemplo}</pre>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                  {aiTutorResponse.respuesta.resumen}
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 block">
                  El área de respuesta del Tutor IA está lista para tu consulta.
                </span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 block">
                  El espacio se mantiene reservado para garantizar estabilidad visual y prevenir fatiga de lectura.
                </span>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
};
