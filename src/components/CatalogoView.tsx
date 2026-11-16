import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Map as MapIcon,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { BookCover } from './BookCover.tsx';
import { apiClient, ApiRequestError } from '../lib/apiClient.ts';
import { LIBRARY_MEDIA, resolveCategoryBannerArt } from '../lib/mediaAssets.ts';
import type { Categoria, Libro, SearchResponse } from '../types/sgbi.ts';

type AvailabilityFilter = 'all' | 'available';
type CatalogSortBy = 'recent' | 'title' | 'year';

interface CatalogoViewProps {
  libros: Libro[];
  categorias: Categoria[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onOpenSalas?: () => void;
  homeResetKey?: number;
  loadingInitial: boolean;
  onSelectLibro: (libro: Libro) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

const PASTEL_PALETTES = [
  { bg: 'bg-[#eddff7]', text: 'text-[#333333]', border: 'border-[#eddff7]', badge: 'bg-[#ffffff]/85 text-[#333333]' },
  { bg: 'bg-[#abf0ff]', text: 'text-[#333333]', border: 'border-[#abf0ff]', badge: 'bg-[#ffffff]/85 text-[#333333]' },
  { bg: 'bg-[#bcfe90]', text: 'text-[#333333]', border: 'border-[#bcfe90]', badge: 'bg-[#ffffff]/85 text-[#333333]' },
  { bg: 'bg-[#e7ecff]', text: 'text-[#333333]', border: 'border-[#e7ecff]', badge: 'bg-[#ffffff]/85 text-[#333333]' },
  { bg: 'bg-[#fcd0f8]', text: 'text-[#333333]', border: 'border-[#fcd0f8]', badge: 'bg-[#ffffff]/85 text-[#333333]' },
  { bg: 'bg-[#d1faff]', text: 'text-[#333333]', border: 'border-[#d1faff]', badge: 'bg-[#ffffff]/85 text-[#333333]' },
];

export const CatalogoView: React.FC<CatalogoViewProps> = ({
  libros,
  categorias,
  selectedCategory,
  onSelectCategory,
  onOpenSalas,
  homeResetKey = 0,
  loadingInitial,
  onSelectLibro,
  onNotify,
}) => {
  const [query, setQuery] = useState('');
  const [useIa, setUseIa] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [sortBy, setSortBy] = useState<CatalogSortBy>('recent');

  useEffect(() => {
    if (homeResetKey > 0) {
      setQuery('');
      setSearchResult(null);
      setAvailabilityFilter('all');
      setSortBy('recent');
    }
  }, [homeResetKey]);

  const activeCategoryMeta = useMemo(() => {
    if (selectedCategory === 'Todas') return null;
    return categorias.find((c) => c.nombre === selectedCategory) ?? null;
  }, [categorias, selectedCategory]);

  const displayedBooks = useMemo(() => {
    const source = searchResult ? searchResult.libros : libros;
    let list =
      selectedCategory === 'Todas'
        ? [...source]
        : source.filter((l) => l.categoria === selectedCategory);

    if (availabilityFilter === 'available') {
      list = list.filter((l) => l.copias_disp > 0);
    }

    if (sortBy === 'title') {
      list.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
    } else if (sortBy === 'year') {
      list.sort((a, b) => (b.anio_publicacion ?? 0) - (a.anio_publicacion ?? 0));
    }

    return list;
  }, [libros, searchResult, selectedCategory, availabilityFilter, sortBy]);

  async function executeSearch(customQuery?: string) {
    const targetQuery = customQuery !== undefined ? customQuery : query;
    if (customQuery !== undefined) {
      setQuery(customQuery);
    }
    const trimmed = targetQuery.trim();
    if (!trimmed) {
      setSearchResult(null);
      return;
    }

    setSearching(true);
    try {
      const data = await apiClient.post<SearchResponse>('/api/ia/buscar', {
        query: trimmed,
        useIa,
      });
      setSearchResult(data);

      if (data.mode === 'fallback') {
        onNotify(
          'info',
          'Servicio IA no disponible. Mostrando resultados de catálogo local.',
        );
      }
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudo completar la consulta en el catálogo. Intenta nuevamente.',
      );
    } finally {
      setSearching(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeSearch();
  }

  function clearSearch() {
    setQuery('');
    setSearchResult(null);
    setAvailabilityFilter('all');
    setSortBy('recent');
    onSelectCategory('Todas');
  }

  const disponiblesEnSala = useMemo(
    () => libros.reduce((acc, b) => acc + b.copias_disp, 0),
    [libros],
  );

  return (
    <div className="space-y-10">
      {/* Hero Visual Monday.com White Workshop Canvas con Búsqueda Integrada */}
      <section className="relative overflow-hidden card-monday bg-[#ffffff] p-8 sm:p-10 lg:p-12">
        {/* Soft pastel decorative gradient wash */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#abf0ff]/25 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#eddff7]/35 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] bg-[#e7ecff] text-[#6161ff] text-xs font-semibold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Acervo Bibliográfico Inteligente</span>
              </div>
              <h1 className="font-light text-3xl sm:text-4xl lg:text-[2.75rem] tracking-[-0.03em] leading-[1.15] text-[#333333] text-balance">
                Explora la colección con{' '}
                <span className="gradient-hero-text font-normal">inteligencia artificial</span>
              </h1>
              <p className="mt-3 text-base text-[#535768] leading-relaxed max-w-xl">
                Descubre obras por temática o lenguaje natural y consulta la disponibilidad física en sala al instante.
              </p>
            </div>

            {/* Metric counters monday pill style */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#f5f6f8] border border-[#dddfeb]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#6161ff]" />
                <div>
                  <div className="text-[11px] font-medium text-[#535768]">Obras</div>
                  <div className="font-mono text-xl font-bold tabular-nums text-[#333333]">
                    {libros.length}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#f5f6f8] border border-[#dddfeb]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#abf0ff]" />
                <div>
                  <div className="text-[11px] font-medium text-[#535768]">Colecciones</div>
                  <div className="font-mono text-xl font-bold tabular-nums text-[#333333]">
                    {categorias.length}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#f5f6f8] border border-[#dddfeb]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#bcfe90]" />
                <div>
                  <div className="text-[11px] font-medium text-[#535768]">Disponibles</div>
                  <div className="font-mono text-xl font-bold tabular-nums text-[#2a5c4e]">
                    {disponiblesEnSala}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monday AI Prompt Search Card */}
          <form onSubmit={handleFormSubmit} className="pt-2">
            <div className="flex flex-col md:flex-row gap-2.5 rounded-[160px] bg-[#ffffff] border border-[#dddfeb] p-2 shadow-sm focus-within:border-[#6161ff] focus-within:ring-3 focus-within:ring-[#6161ff]/15 transition-all">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-[#808080] absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca por título, autor o temática conceptual (ej. distopías tecnológicas, cosmos, filosofía)..."
                  aria-label="Buscar libros por tema, título, autor o ISBN"
                  className="w-full bg-transparent pl-11 pr-4 py-2.5 text-sm text-[#333333] placeholder:text-[#808080] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap px-2 pb-1 md:p-0">
                <div
                  className="inline-flex rounded-[160px] bg-[#f5f6f8] p-1 border border-[#dddfeb]"
                  role="group"
                  aria-label="Modo de búsqueda"
                >
                  <button
                    type="button"
                    onClick={() => setUseIa(true)}
                    className={`inline-flex items-center gap-1.5 rounded-[160px] px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      useIa
                        ? 'bg-[#6161ff] text-white shadow-xs'
                        : 'text-[#535768] hover:text-[#333333]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Búsqueda IA
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseIa(false)}
                    className={`rounded-[160px] px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      !useIa
                        ? 'bg-[#ffffff] text-[#333333] shadow-xs'
                        : 'text-[#535768] hover:text-[#333333]'
                    }`}
                  >
                    Local
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  className="btn-primary-pill text-xs py-2 px-5 cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {(searchResult || selectedCategory !== 'Todas') && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="btn-outline-pill text-xs py-2 px-4 cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </form>

          {searchResult && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-[#535768]">
              <div>
                Mostrando <span className="font-mono tabular-nums font-semibold text-[#333333]">{displayedBooks.length}</span> resultados para{' '}
                <span className="font-semibold text-[#6161ff]">“{searchResult.query}”</span>
              </div>
              <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-mono tabular-nums">
                {searchResult.mode === 'ia' ? 'Motor IA' : 'Catálogo Local'} · {searchResult.latencyMs} ms
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Salas y Colecciones: Monday Pastel Feature Cards */}
      {!searchResult && selectedCategory === 'Todas' && categorias.length > 0 && (
        <section aria-label="Salas y colecciones por categoría" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl font-bold text-[#333333] tracking-tight">
                Salas y colecciones
              </h2>
              <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-medium">
                {categorias.length} colecciones
              </span>
            </div>

            {onOpenSalas && (
              <button
                type="button"
                onClick={onOpenSalas}
                className="btn-outline-pill text-xs py-1.5 px-4 cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Ver plano de salas
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categorias.map((cat, idx) => {
              const count = cat.libros_count ?? 0;
              const palette = PASTEL_PALETTES[idx % PASTEL_PALETTES.length];

              return (
                <button
                  key={cat.id_categoria}
                  type="button"
                  onClick={() => onSelectCategory(cat.nombre)}
                  className={`group relative w-full overflow-hidden rounded-[24px] ${palette.bg} border ${palette.border} p-5 text-left cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0px_5px_30px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[170px]`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#535768] tracking-wider uppercase">
                      {cat.ubicacion_sala.split('·')[0]?.trim()}
                    </span>
                    <span className={`badge-monday ${palette.badge} font-mono text-[11px] tabular-nums`}>
                      {count} {count === 1 ? 'obra' : 'obras'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold leading-snug text-[#333333] line-clamp-1 group-hover:text-[#6161ff] transition-colors">
                        {cat.nombre}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-[#535768] shrink-0 opacity-80 transition-transform group-hover:translate-x-1 group-hover:text-[#6161ff]" />
                    </div>
                    <p className="mt-1 text-xs text-[#535768] line-clamp-2 leading-relaxed">
                      {cat.descripcion}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Dossier Visual de Categoría Activa */}
      {activeCategoryMeta && (
        <motion.section
          key={activeCategoryMeta.id_categoria}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="overflow-hidden card-monday bg-[#ffffff] grid grid-cols-1 md:grid-cols-[260px_1fr]"
        >
          <div className="relative aspect-[4/3] md:aspect-auto md:h-full bg-[#eddff7] overflow-hidden">
            <img
              src={resolveCategoryBannerArt(activeCategoryMeta.nombre)}
              alt={`Colección ${activeCategoryMeta.nombre}`}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          <div className="p-6 sm:p-8 flex flex-col justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#535768]">
                  <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-semibold">CDU {activeCategoryMeta.codigo_archivo}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeCategoryMeta.ubicacion_sala}</span>
                </div>
                <h2 className="text-2xl font-bold text-[#333333] tracking-tight">
                  {activeCategoryMeta.nombre}
                </h2>
                <p className="text-sm text-[#535768] leading-relaxed max-w-2xl">
                  {activeCategoryMeta.descripcion}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectCategory('Todas')}
                className="btn-outline-pill text-xs py-1.5 px-3.5 whitespace-nowrap shrink-0 self-start cursor-pointer"
              >
                Ver todo el catálogo
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-[#f5f6f8] text-xs text-[#535768]">
              <span>
                <strong className="font-semibold text-[#333333]">Público:</strong>{' '}
                {activeCategoryMeta.publico_recomendado}
              </span>
              <span>
                <strong className="font-semibold text-[#333333]">Enfoque:</strong>{' '}
                {activeCategoryMeta.enfoque_lector}
              </span>
            </div>
          </div>
        </motion.section>
      )}

      {/* Cabecera de la Grilla de Libros con Filtros y Ordenamiento */}
      <div
        id="catalogo-obras"
        className="scroll-mt-24 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#d0d4e4]"
      >
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">
            {activeCategoryMeta ? `Obras en ${activeCategoryMeta.nombre}` : 'Catálogo de obras'}
          </h2>
          <span className="badge-monday bg-[#e7ecff] text-[#6161ff] font-mono tabular-nums">
            {displayedBooks.length} {displayedBooks.length === 1 ? 'título' : 'títulos'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="inline-flex rounded-[160px] border border-[#dddfeb] bg-[#ffffff] p-1 shadow-2xs"
            role="group"
            aria-label="Filtrar por disponibilidad"
          >
            <button
              type="button"
              onClick={() => setAvailabilityFilter('all')}
              className={`rounded-[160px] px-3.5 py-1 text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                availabilityFilter === 'all'
                  ? 'bg-[#6161ff] text-white shadow-xs font-semibold'
                  : 'text-[#535768] hover:text-[#333333]'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('available')}
              className={`rounded-[160px] px-3.5 py-1 text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                availabilityFilter === 'available'
                  ? 'bg-[#6161ff] text-white shadow-xs font-semibold'
                  : 'text-[#535768] hover:text-[#333333]'
              }`}
            >
              Solo disponibles
            </button>
          </div>

          <select
            aria-label="Ordenar catálogo"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CatalogSortBy)}
            className="rounded-[6px] border border-[#dddfeb] bg-[#ffffff] px-3 py-1.5 text-xs font-medium text-[#333333] focus:border-[#6161ff] focus:outline-none cursor-pointer shadow-2xs"
          >
            <option value="recent">Orden: Recientes</option>
            <option value="title">Orden: Título (A–Z)</option>
            <option value="year">Orden: Año de edición</option>
          </select>
        </div>
      </div>

      {/* Estado de carga con Skeletons */}
      {(loadingInitial || searching) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="card-monday overflow-hidden animate-pulse"
            >
              <div className="aspect-[4/3] bg-[#dddfeb]/50" />
              <div className="p-6 space-y-3">
                <div className="h-5 bg-[#dddfeb]/60 rounded-md w-3/4" />
                <div className="h-3 bg-[#f5f6f8] rounded-md w-full" />
                <div className="h-3 bg-[#f5f6f8] rounded-md w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado Vacío */}
      {!loadingInitial && !searching && displayedBooks.length === 0 && (
        <div className="card-monday py-16 px-6 text-center">
          <BookOpen className="w-10 h-10 text-[#808080] mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#333333]">
            No se encontraron obras afines
          </h3>
          <p className="mt-1.5 text-sm text-[#535768] max-w-md mx-auto">
            Prueba con términos conceptuales o restablece el filtro para explorar todo el acervo.
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="mt-5 btn-primary-pill text-xs py-2 px-5 cursor-pointer"
          >
            Ver todo el catálogo
          </button>
        </div>
      )}

      {/* Grilla Visual de Libros (Monday Board Mockup Cards) */}
      {!loadingInitial && !searching && displayedBooks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayedBooks.map((libro, idx) => {
            const isOut = libro.copias_disp === 0;
            const isLow = libro.copias_disp === 1 && libro.copias_totales > 1;

            return (
              <motion.article
                key={libro.id_libro}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.025, 0.15) }}
                onClick={() => onSelectLibro(libro)}
                className="group card-monday flex flex-col justify-between overflow-hidden cursor-pointer"
              >
                <div>
                  <BookCover libro={libro} size="card" />

                  <div className="p-5 space-y-2">
                    <h3 className="text-lg font-bold leading-snug text-[#333333] line-clamp-2 group-hover:text-[#6161ff] transition-colors">
                      {libro.titulo}
                    </h3>

                    <p className="text-xs text-[#535768] leading-relaxed line-clamp-2">
                      {libro.sinopsis
                        ? libro.sinopsis
                        : 'Edición histórica disponible para consulta en sala y ficha técnica.'}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-[#f5f6f8] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
                    {isOut ? (
                      <span className="badge-monday bg-[#fcd0f8] text-[#991B1B]">
                        <XCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                        Agotado
                      </span>
                    ) : isLow ? (
                      <span className="badge-monday bg-[#ff8940]/20 text-[#333333]">
                        <Clock className="w-3.5 h-3.5 mr-1 text-[#ff8940] shrink-0" />
                        Última copia ({libro.copias_disp}/{libro.copias_totales})
                      </span>
                    ) : (
                      <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e]">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                        Disponible ({libro.copias_disp}/{libro.copias_totales})
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6161ff] group-hover:translate-x-1 transition-transform whitespace-nowrap shrink-0">
                    Ver ficha
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
