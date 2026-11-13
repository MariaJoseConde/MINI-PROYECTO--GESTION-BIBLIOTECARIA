import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Compass,
  MapPin,
  Search,
} from 'lucide-react';
import { motion } from 'motion/react';
import { LIBRARY_MEDIA, resolveCategoryBannerArt } from '../lib/mediaAssets.ts';
import type { Categoria, Libro } from '../types/sgbi.ts';

interface SalasViewProps {
  categorias: Categoria[];
  libros: Libro[];
  onExploreCategory: (categoriaNombre: string) => void;
  onSelectLibro: (libro: Libro) => void;
}

interface SalaDescriptor {
  nombre: string;
  subtitulo: string;
  nivel: string;
  pinPosition: { top: string; left: string };
}

const SALA_META: Record<string, SalaDescriptor> = {
  'Sala A': {
    nombre: 'Sala A',
    subtitulo: 'Ala Oeste · Ficción especulativa, distopía y futuro tecnológico',
    nivel: 'Planta Alta · Ala Oeste',
    pinPosition: { top: '34%', left: '22%' },
  },
  'Sala Central': {
    nombre: 'Sala Central',
    subtitulo: 'Rotonda Principal · Estantería noble y clásicos universales',
    nivel: 'Rotonda Central · Nivel 2',
    pinPosition: { top: '32%', left: '51%' },
  },
  'Sala B': {
    nombre: 'Sala B',
    subtitulo: 'Ala Sur · Letras iberoamericanas, filosofía y fondo antiguo',
    nivel: 'Planta Baja · Ala Sur',
    pinPosition: { top: '66%', left: '34%' },
  },
  'Sala C': {
    nombre: 'Sala C',
    subtitulo: 'Ala Este Superior · Ciencias exactas, astronomía y divulgación',
    nivel: 'Planta Alta · Ala Este',
    pinPosition: { top: '42%', left: '78%' },
  },
  'Sala D': {
    nombre: 'Sala D',
    subtitulo: 'Ala Este Inferior · Historia, antropología y pensamiento político',
    nivel: 'Planta Baja · Ala Este',
    pinPosition: { top: '72%', left: '78%' },
  },
  'Sala General': {
    nombre: 'Sala General',
    subtitulo: 'Vestíbulo Norte · Acervo general y consulta rápida',
    nivel: 'Nivel 1 · Acceso Principal',
    pinPosition: { top: '57%', left: '56%' },
  },
};

function extractSalaName(ubicacion: string): string {
  const prefix = ubicacion.split('·')[0]?.trim();
  return prefix || 'Sala General';
}

function extractPasilloLabel(ubicacion: string): string {
  const parts = ubicacion
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return 'Estantería principal';
  return parts.slice(1).join(' · ');
}

export const SalasView: React.FC<SalasViewProps> = ({
  categorias,
  libros,
  onExploreCategory,
  onSelectLibro,
}) => {
  const [selectedSala, setSelectedSala] = useState<string>('Todas');
  const [filterText, setFilterText] = useState('');
  const [planImgFailed, setPlanImgFailed] = useState(false);

  const salasAgrupadas = useMemo(() => {
    const map = new Map<
      string,
      {
        sala: string;
        meta: SalaDescriptor;
        pasillos: Array<{
          categoria: Categoria;
          pasilloLabel: string;
          libros: Libro[];
        }>;
        totalLibros: number;
        totalDisp: number;
      }
    >();

    for (const cat of categorias) {
      const salaKey = extractSalaName(cat.ubicacion_sala || 'Sala General');
      if (!map.has(salaKey)) {
        map.set(salaKey, {
          sala: salaKey,
          meta: SALA_META[salaKey] ?? {
            nombre: salaKey,
            subtitulo: 'Colecciones organizadas por clasificación CDU',
            nivel: 'Edificio Principal',
            pinPosition: { top: '50%', left: '50%' },
          },
          pasillos: [],
          totalLibros: 0,
          totalDisp: 0,
        });
      }

      const group = map.get(salaKey)!;
      const librosCat = libros.filter((l) => l.categoria === cat.nombre);
      group.pasillos.push({
        categoria: cat,
        pasilloLabel: extractPasilloLabel(cat.ubicacion_sala || ''),
        libros: librosCat,
      });
      group.totalLibros += librosCat.length;
      group.totalDisp += librosCat.reduce((acc, l) => acc + l.copias_disp, 0);
    }

    const order = ['Sala Central', 'Sala A', 'Sala B', 'Sala C', 'Sala D', 'Sala General'];
    return Array.from(map.values()).sort((a, b) => {
      const ia = order.indexOf(a.sala);
      const ib = order.indexOf(b.sala);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.sala.localeCompare(b.sala);
    });
  }, [categorias, libros]);

  const filteredSalas = useMemo(() => {
    const q = filterText.trim().toLowerCase();

    return salasAgrupadas
      .filter((s) => selectedSala === 'Todas' || s.sala === selectedSala)
      .map((s) => {
        if (!q) return s;

        const matchingPasillos = s.pasillos
          .map((p) => {
            const catMatches =
              s.sala.toLowerCase().includes(q) ||
              p.pasilloLabel.toLowerCase().includes(q) ||
              p.categoria.nombre.toLowerCase().includes(q) ||
              p.categoria.codigo_archivo.toLowerCase().includes(q);

            const matchingLibros = p.libros.filter(
              (l) =>
                l.titulo.toLowerCase().includes(q) ||
                (l.ubicacion_estante ?? '').toLowerCase().includes(q) ||
                l.autores.some((a) => a.nombre.toLowerCase().includes(q)),
            );

            if (catMatches) return p;
            if (matchingLibros.length > 0) {
              return { ...p, libros: matchingLibros };
            }
            return null;
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));

        return { ...s, pasillos: matchingPasillos };
      })
      .filter((s) => s.pasillos.length > 0);
  }, [salasAgrupadas, selectedSala, filterText]);

  return (
    <div className="space-y-7">
      {/* Cabecera */}
      <div className="border-b border-[#E7E2D8] pb-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-widest uppercase text-[#78716C]">
            Orientación Espacial y Señalización
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1C1917] text-balance">
            Organización de salas, pasillos y estanterías
          </h1>
          <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
            Ubica físicamente cada colección dentro del edificio, explora la distribución de pasillos y consulta en qué estante se encuentra cada obra.
          </p>
        </div>

        <div className="relative w-full lg:w-80 shrink-0">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Buscar sala, pasillo, estante o libro..."
            aria-label="Localizar sala, pasillo o estante"
            className="w-full rounded-lg border border-[#D6CEBE] bg-[#FFFFFF] pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder:text-[#78716C] focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15"
          />
        </div>
      </div>

      {/* Plano Arquitectónico Interactivo */}
      <section className="rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1917]">
            <Compass className="w-4 h-4 text-[#1E3A8A]" />
            <span>Plano arquitectónico del edificio bibliotecario</span>
          </div>
          <span className="text-xs text-[#78716C]">
            Haz clic en una sala del plano o en los filtros inferiores para aislar sus pasillos
          </span>
        </div>

        <div className="relative aspect-[16/9] max-h-[460px] w-full bg-[#EBE6DF] overflow-hidden">
          {!planImgFailed ? (
            <img
              src={LIBRARY_MEDIA.planoSalas}
              alt="Plano arquitectónico isométrico de las salas y pasillos de la biblioteca"
              referrerPolicy="no-referrer"
              onError={() => setPlanImgFailed(true)}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-[#57534E]">
              Vista esquemática de salas disponible en el directorio inferior
            </div>
          )}

          {/* Pines interactivos posicionados sobre cada ala del plano */}
          <div className="hidden sm:block">
            {salasAgrupadas.map((s) => {
              const isSelected = selectedSala === s.sala;
              return (
                <button
                  key={s.sala}
                  type="button"
                  onClick={() =>
                    setSelectedSala((prev) => (prev === s.sala ? 'Todas' : s.sala))
                  }
                  style={{ top: s.meta.pinPosition.top, left: s.meta.pinPosition.left }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#1E3A8A] text-white ring-2 ring-white scale-105'
                      : 'bg-[#1C1917]/90 text-white hover:bg-[#1E3A8A] hover:scale-105'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{s.sala}</span>
                  <span className="font-mono text-[10px] opacity-80 tabular-nums">
                    ({s.pasillos.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector rápido de Salas */}
        <div className="px-5 py-3.5 border-t border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedSala('Todas')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              selectedSala === 'Todas'
                ? 'bg-[#1E3A8A] text-white'
                : 'bg-[#FFFFFF] border border-[#D6CEBE] text-[#44403C] hover:bg-[#F3EFE7]'
            }`}
          >
            Todas las salas ({salasAgrupadas.length})
          </button>

          {salasAgrupadas.map((s) => (
            <button
              key={s.sala}
              type="button"
              onClick={() => setSelectedSala(s.sala)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                selectedSala === s.sala
                  ? 'bg-[#1E3A8A] text-white'
                  : 'bg-[#FFFFFF] border border-[#D6CEBE] text-[#44403C] hover:bg-[#F3EFE7]'
              }`}
            >
              {s.sala} · {s.pasillos.length} {s.pasillos.length === 1 ? 'pasillo' : 'pasillos'}
            </button>
          ))}
        </div>
      </section>

      {/* Directorio Detallado por Sala y Pasillo */}
      {filteredSalas.length === 0 ? (
        <div className="rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] py-14 px-6 text-center">
          <BookOpen className="w-9 h-9 text-[#A8A29E] mx-auto mb-2.5" />
          <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
            Sin coincidencias en salas o estantes
          </h3>
          <p className="mt-1 text-xs text-[#57534E]">
            Intenta con otro término como “Pasillo 2”, “Estante 01”, “Sala B” o limpia el filtro.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSalas.map((grupo) => (
            <motion.section
              key={grupo.sala}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#78716C]">
                    {grupo.meta.nivel}
                  </div>
                  <h2 className="font-serif text-2xl font-semibold text-[#1C1917]">
                    {grupo.sala}
                  </h2>
                  <p className="text-xs text-[#57534E] mt-0.5">{grupo.meta.subtitulo}</p>
                </div>

                <div className="flex items-center gap-5 text-xs font-mono tabular-nums shrink-0 text-[#44403C]">
                  <span>
                    {grupo.pasillos.length}{' '}
                    {grupo.pasillos.length === 1 ? 'pasillo / zona' : 'pasillos / zonas'}
                  </span>
                  <span className="text-[#D6CEBE]">·</span>
                  <span>{grupo.totalLibros} títulos</span>
                  <span className="text-[#D6CEBE]">·</span>
                  <span className="font-semibold text-[#15803D]">{grupo.totalDisp} disponibles</span>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                {grupo.pasillos.map(({ categoria, pasilloLabel, libros: librosPasillo }) => (
                  <article
                    key={categoria.id_categoria}
                    className="rounded-lg border border-[#E7E2D8] bg-[#FBF9F5] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex gap-4 p-4 bg-[#FFFFFF] border-b border-[#E7E2D8]">
                        <div className="w-24 h-20 rounded-md overflow-hidden shrink-0 bg-[#1E293B]">
                          <img
                            src={resolveCategoryBannerArt(categoria.nombre)}
                            alt={categoria.nombre}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#1E3A8A] font-semibold">
                            <span className="truncate">{pasilloLabel}</span>
                            <span className="text-[#78716C] shrink-0">
                              CDU {categoria.codigo_archivo}
                            </span>
                          </div>
                          <h3 className="mt-1 font-serif text-lg font-semibold text-[#1C1917] truncate">
                            {categoria.nombre}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#57534E] line-clamp-2">
                            {categoria.descripcion}
                          </p>
                        </div>
                      </div>

                      {/* Estanterías y Obras en este pasillo */}
                      <div className="p-4 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
                          Estantes y ejemplares ubicados aquí ({librosPasillo.length})
                        </div>

                        {librosPasillo.length === 0 ? (
                          <p className="text-xs text-[#78716C] py-2">
                            Espacio reservado para nuevas adquisiciones de esta colección.
                          </p>
                        ) : (
                          <ul className="divide-y divide-[#E7E2D8]">
                            {librosPasillo.map((libro) => (
                              <li key={libro.id_libro} className="py-2 first:pt-1 last:pb-0">
                                <button
                                  type="button"
                                  onClick={() => onSelectLibro(libro)}
                                  className="w-full text-left group flex items-start justify-between gap-3 cursor-pointer"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#1C1917] group-hover:text-[#1E3A8A] group-hover:underline underline-offset-2 truncate">
                                      {libro.titulo}
                                    </div>
                                    <div className="text-[11px] font-mono text-[#57534E] truncate">
                                      {libro.ubicacion_estante || categoria.ubicacion_sala}
                                    </div>
                                  </div>

                                  <span
                                    className={`text-[11px] font-mono font-semibold tabular-nums shrink-0 ${
                                      libro.copias_disp === 0
                                        ? 'text-[#B91C1C]'
                                        : 'text-[#15803D]'
                                    }`}
                                  >
                                    {libro.copias_disp}/{libro.copias_totales} disp.
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-[#E7E2D8] bg-[#FFFFFF] flex items-center justify-between text-xs">
                      <span className="text-[#78716C] truncate">{categoria.enfoque_lector}</span>
                      <button
                        type="button"
                        onClick={() => onExploreCategory(categoria.nombre)}
                        className="inline-flex items-center gap-1 font-semibold text-[#1E3A8A] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Abrir colección
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
};
