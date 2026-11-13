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
    <div className="space-y-8">
      {/* Hero Visual Arquitectónico con Búsqueda Integrada */}
      <section className="relative overflow-hidden rounded-xl bg-[#0F172A] text-white shadow-sm">
        {!heroImgFailed && (
          <img
            src={LIBRARY_MEDIA.heroBiblioteca}
            alt="Sala principal de lectura e investigación de la biblioteca"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#0F172A]/92 via-[#0F172A]/78 to-[#0F172A]/45"
          aria-hidden="true"
        />

        <div className="relative z-10 p-6 sm:p-9 lg:p-11 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-widest uppercase text-[#CBD5E1]">
                Acervo Bibliográfico
              </p>
              <h1 className="mt-2 font-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold tracking-tight leading-[1.1] text-white text-balance">
                Explora la colección con búsqueda inteligente
              </h1>
              <p className="mt-2.5 text-sm sm:text-base text-[#E2E8F0] leading-relaxed max-w-xl">
                Descubre obras por tema, autor o pregunta natural y consulta su disponibilidad en sala al instante.
              </p>
            </div>

            <div className="flex items-center gap-6 shrink-0 text-sm border-t lg:border-t-0 pt-4 lg:pt-0 border-white/15">
              <div>
                <div className="text-xs text-[#CBD5E1]">Obras</div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-white">
                  {libros.length}
                </div>
              </div>
              <div className="h-9 w-px bg-white/20" />
              <div>
                <div className="text-xs text-[#CBD5E1]">Colecciones</div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-white">
                  {categorias.length}
                </div>
              </div>
              <div className="h-9 w-px bg-white/20" />
              <div>
                <div className="text-xs text-[#CBD5E1]">Disponibles</div>
                <div className="font-mono text-2xl font-semibold tabular-nums text-[#86EFAC]">
                  {disponiblesEnSala}
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Búsqueda Limpia */}
          <form onSubmit={handleFormSubmit} className="pt-1">
            <div className="flex flex-col md:flex-row gap-2.5 rounded-lg bg-white/95 backdrop-blur-md p-2 shadow-lg">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca por título, autor o temática (ej. distopías tecnológicas, cosmos, realismo mágico)..."
                  aria-label="Buscar libros por tema, título, autor o ISBN"
                  className="w-full rounded-md bg-transparent pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap px-1 pb-1 md:p-0">
                <div
                  className="inline-flex rounded-md border border-[#E7E2D8] bg-[#F3EFE7] p-0.5"
                  role="group"
                  aria-label="Modo de búsqueda"
                >
                  <button
                    type="button"
                    onClick={() => setUseIa(true)}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      useIa
                        ? 'bg-[#FFFFFF] text-[#1E3A8A] shadow-xs'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Búsqueda IA
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseIa(false)}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      !useIa
                        ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    Local
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#172554] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>

                {(searchResult || selectedCategory !== 'Todas') && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="rounded-md border border-[#D6CEBE] bg-[#FFFFFF] px-3 py-2.5 text-xs font-medium text-[#57534E] hover:bg-[#F3EFE7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </form>

          {searchResult && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#E2E8F0]">
              <div>
                Mostrando <span className="font-mono tabular-nums font-semibold text-white">{displayedBooks.length}</span> resultados para{' '}
                <span className="font-semibold text-white">“{searchResult.query}”</span>
              </div>
              <span className="font-mono tabular-nums text-[#CBD5E1]">
                {searchResult.mode === 'ia' ? 'Motor IA' : 'Catálogo Local'} · {searchResult.latencyMs} ms
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Salas y Colecciones: Una imagen dedicada para CADA categoría */}
      {!searchResult && selectedCategory === 'Todas' && categorias.length > 0 && (
        <section aria-label="Salas y colecciones por categoría" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
                Salas y colecciones
              </h2>
              <span className="font-mono text-xs tabular-nums text-[#78716C]">
                {categorias.length} categorías temáticas
              </span>
            </div>

            {onOpenSalas && (
              <button
                type="button"
                onClick={onOpenSalas}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] hover:underline underline-offset-4 whitespace-nowrap cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Ver plano de salas y pasillos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {categorias.map((cat) => {
              const imgUrl = resolveCategoryBannerArt(cat.nombre);
              const count = cat.libros_count ?? 0;

              return (
                <button
                  key={cat.id_categoria}
                  type="button"
                  onClick={() => onSelectCategory(cat.nombre)}
                  className="group relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#1E293B] text-left cursor-pointer"
                >
                  <img
                    src={imgUrl}
                    alt={`Sala ${cat.nombre}`}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/35 to-black/10"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 h-full p-4 flex flex-col justify-between text-white">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-white/85">
                      <span className="truncate">{cat.ubicacion_sala}</span>
                      <span className="tabular-nums shrink-0">
                        {count} {count === 1 ? 'obra' : 'obras'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-serif text-base font-semibold leading-snug line-clamp-1">
                          {cat.nombre}
                        </h3>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-80 transition-transform group-hover:translate-x-1" />
                      </div>
                      <p className="mt-1 text-[11px] text-white/80 line-clamp-1">
                        {cat.enfoque_lector}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Dossier Visual de Categoría Activa (al filtrar desde barra lateral o salas) */}
      {activeCategoryMeta && (
        <motion.section
          key={activeCategoryMeta.id_categoria}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="overflow-hidden rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] grid grid-cols-1 md:grid-cols-[260px_1fr]"
        >
          <div className="relative aspect-[4/3] md:aspect-auto md:h-full bg-[#1E293B]">
            <img
              src={resolveCategoryBannerArt(activeCategoryMeta.nombre)}
              alt={`Colección ${activeCategoryMeta.nombre}`}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          <div className="p-6 flex flex-col justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#78716C]">
                  <span>CDU {activeCategoryMeta.codigo_archivo}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeCategoryMeta.ubicacion_sala}</span>
                </div>
                <h2 className="font-serif text-2xl font-semibold text-[#1C1917]">
                  {activeCategoryMeta.nombre}
                </h2>
                <p className="text-sm text-[#44403C] leading-relaxed max-w-2xl">
                  {activeCategoryMeta.descripcion}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectCategory('Todas')}
                className="text-xs font-semibold text-[#1E3A8A] hover:underline underline-offset-4 whitespace-nowrap shrink-0 self-start cursor-pointer"
              >
                Ver todo el catálogo
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 border-t border-[#F3EFE7] text-xs text-[#57534E]">
              <span>
                <strong className="font-medium text-[#1C1917]">Público:</strong>{' '}
                {activeCategoryMeta.publico_recomendado}
              </span>
              <span>
                <strong className="font-medium text-[#1C1917]">Enfoque:</strong>{' '}
                {activeCategoryMeta.enfoque_lector}
              </span>
            </div>
          </div>
        </motion.section>
      )}

      {/* Cabecera de la Grilla de Libros con Filtros y Ordenamiento */}
      <div
        id="catalogo-obras"
        className="scroll-mt-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E7E2D8]"
      >
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
            {activeCategoryMeta ? `Obras en ${activeCategoryMeta.nombre}` : 'Catálogo de obras'}
          </h2>
          <span className="font-mono text-xs tabular-nums text-[#78716C]">
            {displayedBooks.length} {displayedBooks.length === 1 ? 'título' : 'títulos'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-[#E7E2D8] bg-[#FFFFFF] p-0.5"
            role="group"
            aria-label="Filtrar por disponibilidad"
          >
            <button
              type="button"
              onClick={() => setAvailabilityFilter('all')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                availabilityFilter === 'all'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setAvailabilityFilter('available')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                availabilityFilter === 'available'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Solo disponibles
            </button>
          </div>

          <select
            aria-label="Ordenar catálogo"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CatalogSortBy)}
            className="rounded-md border border-[#E7E2D8] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#1C1917] focus:border-[#1E3A8A] focus:outline-none cursor-pointer"
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
              className="rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden animate-pulse"
            >
              <div className="aspect-[4/3] bg-[#EBE6DF]" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-[#EBE6DF] rounded w-3/4" />
                <div className="h-3 bg-[#F3EFE7] rounded w-full" />
                <div className="h-3 bg-[#F3EFE7] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado Vacío */}
      {!loadingInitial && !searching && displayedBooks.length === 0 && (
        <div className="rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] py-16 px-6 text-center">
          <BookOpen className="w-10 h-10 text-[#A8A29E] mx-auto mb-3" />
          <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
            No se encontraron obras afines
          </h3>
          <p className="mt-1.5 text-sm text-[#57534E] max-w-md mx-auto">
            Prueba con términos generales o restablece el filtro para explorar todo el catálogo.
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="mt-5 inline-flex items-center rounded-md border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#F3EFE7] transition-colors cursor-pointer"
          >
            Ver todo el catálogo
          </button>
        </div>
      )}

      {/* Grilla Visual de Libros */}
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
                className="group rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] flex flex-col justify-between overflow-hidden transition-all hover:border-[#C7BFA9] hover:shadow-md cursor-pointer"
              >
                <div>
                  <BookCover libro={libro} size="card" />

                  <div className="p-5 space-y-2">
                    <h3 className="font-serif text-xl font-semibold leading-snug text-[#1C1917] line-clamp-2 group-hover:text-[#1E3A8A] transition-colors">
                      {libro.titulo}
                    </h3>

                    <p className="text-xs text-[#57534E] leading-relaxed line-clamp-2">
                      {libro.sinopsis
                        ? libro.sinopsis
                        : 'Edición histórica disponible para consulta en sala y ficha técnica.'}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-[#F3EFE7] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
                    {isOut ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-[#B91C1C] shrink-0" />
                        <span className="text-[#B91C1C] truncate">Agotado</span>
                      </>
                    ) : isLow ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                        <span className="text-[#B45309] tabular-nums truncate">
                          Última copia ({libro.copias_disp}/{libro.copias_totales})
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                        <span className="text-[#15803D] tabular-nums truncate">
                          Disponible ({libro.copias_disp}/{libro.copias_totales})
                        </span>
                      </>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
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
