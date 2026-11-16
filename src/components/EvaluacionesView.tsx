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
    <div className="space-y-8">
      <div className="card-monday bg-[#ffffff] p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#eddff7] text-[#6161ff] text-xs font-semibold uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Módulo Pedagógico Docente</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-light tracking-[-0.03em] text-[#333333] text-balance">
            Evaluaciones de <span className="gradient-hero-text font-normal">comprensión lectora</span>
          </h1>
          <p className="mt-2 text-sm text-[#535768]">
            Consulta las pruebas estructuradas almacenadas o selecciona un volumen del acervo con sinopsis para generar una nueva evaluación con IA.
          </p>
        </div>

        <div className="badge-monday bg-[#dbdbff] text-[#6161ff] font-medium text-xs px-3 py-1.5 shrink-0">
          {pruebas.length} pruebas generadas
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <section className="card-monday bg-[#ffffff] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8]">
            <h2 className="text-lg font-bold text-[#333333] tracking-tight">
              Pruebas Persistidas en Repositorio ({pruebas.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-[#808080]">Cargando evaluaciones...</div>
          ) : pruebas.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#535768]">
              Aún no se han generado pruebas de lectura.
            </div>
          ) : (
            <div className="divide-y divide-[#f5f6f8]">
              {pruebas.map((p) => {
                const libro = libros.find((l) => l.id_libro === p.id_libro);
                return (
                  <div
                    key={p.id_prueba}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f5f6f8]/70 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#535768] tabular-nums">
                        <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-semibold text-[10px]">
                          Prueba #{p.id_prueba}
                        </span>
                        <span>·</span>
                        <span>{p.contenido.evaluacion.length} preguntas</span>
                        <span>·</span>
                        <span>{p.created_at.slice(0, 10)}</span>
                      </div>
                      <h3 className="text-base font-bold text-[#333333] mt-1">
                        {p.libro_titulo}
                      </h3>
                      <p className="text-xs text-[#535768] mt-0.5">
                        Docente: <strong className="text-[#333333]">{p.docente_nombre}</strong>
                      </p>
                    </div>
                    {libro && (
                      <button
                        type="button"
                        onClick={() => onSelectLibro(libro)}
                        className="btn-primary-pill text-xs py-1.5 px-4 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Abrir e imprimir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card-monday bg-[#ffffff] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8]">
            <h2 className="text-lg font-bold text-[#333333] tracking-tight">
              Generar desde Obra
            </h2>
          </div>
          <div className="divide-y divide-[#f5f6f8] max-h-[520px] overflow-y-auto">
            {libros.map((l) => {
              const hasSinopsis = Boolean(l.sinopsis && l.sinopsis.trim().length >= 20);
              return (
                <div
                  key={l.id_libro}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#f5f6f8]/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#333333] truncate">{l.titulo}</div>
                    <div className="text-xs text-[#535768] truncate">
                      {hasSinopsis ? (
                        <span className="badge-monday bg-[#bcfe90]/60 text-[#2a5c4e] text-[10px]">
                          {l.pruebas_count ?? 0} prueba(s)
                        </span>
                      ) : (
                        <span className="badge-monday bg-[#e6e7ea] text-[#808080] text-[10px]">
                          Sin sinopsis
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectLibro(l)}
                    className={`btn-pill text-xs py-1.5 px-3.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      hasSinopsis
                        ? 'btn-primary-pill py-1.5 px-3.5 shadow-xs'
                        : 'btn-outline-pill py-1.5 px-3 text-[#808080] border-[#dddfeb]'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {hasSinopsis ? 'Abrir' : 'Ver ficha'}
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
