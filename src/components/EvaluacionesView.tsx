import React, { useEffect, useState } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    let cancelled = false;
    async function loadPruebas() {
      setLoading(true);
      try {
        const res = await fetch('/api/pruebas');
        if (!res.ok) return;
        const data = (await res.json()) as { pruebas: PruebaLectura[] };
        if (!cancelled) setPruebas(data.pruebas);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPruebas();
    return () => {
      cancelled = true;
    };
  }, [libros]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E7E2D8] pb-5">
        <p className="text-xs font-medium tracking-widest uppercase text-[#78716C]">
          Módulo Pedagógico Docente
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1C1917]">
          Evaluaciones de Comprensión Lectora
        </h1>
        <p className="mt-1 text-sm text-[#57534E]">
          Consulte las pruebas estructuradas almacenadas o seleccione un volumen del catálogo con sinopsis para generar una nueva evaluación con IA.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5]">
            <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
              Pruebas Persistidas en Repositorio ({pruebas.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-[#78716C]">Cargando evaluaciones...</div>
          ) : pruebas.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#57534E]">
              Aún no se han generado pruebas de lectura.
            </div>
          ) : (
            <div className="divide-y divide-[#F3EFE7]">
              {pruebas.map((p) => {
                const libro = libros.find((l) => l.id_libro === p.id_libro);
                return (
                  <div
                    key={p.id_prueba}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FBF9F5] transition-colors"
                  >
                    <div>
                      <div className="text-xs font-mono text-[#78716C] tabular-nums">
                        Prueba #{p.id_prueba} · {p.contenido.evaluacion.length} preguntas ·{' '}
                        {p.created_at.slice(0, 10)}
                      </div>
                      <h3 className="font-serif text-base font-semibold text-[#1C1917] mt-0.5">
                        {p.libro_titulo}
                      </h3>
                      <p className="text-xs text-[#57534E] mt-0.5">
                        Generada por: {p.docente_nombre}
                      </p>
                    </div>
                    {libro && (
                      <button
                        type="button"
                        onClick={() => onSelectLibro(libro)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white hover:border-[#1E3A8A] transition-colors whitespace-nowrap shrink-0"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Abrir evaluación e imprimir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5]">
            <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
              Generar desde Obra del Catálogo
            </h2>
          </div>
          <div className="divide-y divide-[#F3EFE7] max-h-[520px] overflow-y-auto">
            {libros.map((l) => {
              const hasSinopsis = Boolean(l.sinopsis && l.sinopsis.trim().length >= 20);
              return (
                <div
                  key={l.id_libro}
                  className="px-5 py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#1C1917] truncate">{l.titulo}</div>
                    <div className="text-xs text-[#78716C] truncate">
                      {hasSinopsis
                        ? `${l.pruebas_count ?? 0} prueba(s) guardada(s)`
                        : 'Sin sinopsis registrada'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectLibro(l)}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      hasSinopsis
                        ? 'bg-[#1E3A8A] text-white hover:bg-[#172554]'
                        : 'border border-[#E7E2D8] text-[#78716C] hover:bg-[#F3EFE7]'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {hasSinopsis ? 'Abrir' : 'Sin sinopsis'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
