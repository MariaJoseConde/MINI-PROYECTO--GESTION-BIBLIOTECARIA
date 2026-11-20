import React from 'react';
import { ArrowRight, BookOpen, MapPin, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { resolveCategoryBannerArt } from '../lib/mediaAssets.ts';
import type { Categoria } from '../types/sgbi.ts';

interface CategoriasViewProps {
  categorias: Categoria[];
  onExploreCategory: (categoriaNombre: string) => void;
}

const CATEGORY_PASTELS = [
  { bg: 'bg-[#eddff7]/40', badge: 'bg-[#eddff7] text-[#6161ff]', border: 'border-[#eddff7]' },
  { bg: 'bg-[#abf0ff]/30', badge: 'bg-[#abf0ff] text-[#2a5c4e]', border: 'border-[#abf0ff]' },
  { bg: 'bg-[#bcfe90]/35', badge: 'bg-[#bcfe90] text-[#2a5c4e]', border: 'border-[#bcfe90]' },
  { bg: 'bg-[#e7ecff]/50', badge: 'bg-[#e7ecff] text-[#6161ff]', border: 'border-[#e7ecff]' },
  { bg: 'bg-[#fcd0f8]/35', badge: 'bg-[#fcd0f8] text-[#9450fd]', border: 'border-[#fcd0f8]' },
  { bg: 'bg-[#d1faff]/40', badge: 'bg-[#d1faff] text-[#2a5c4e]', border: 'border-[#d1faff]' },
];

export const CategoriasView: React.FC<CategoriasViewProps> = ({
  categorias,
  onExploreCategory,
}) => {
  return (
    <div className="space-y-8">
      <div className="card-monday p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2.5 border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs">
            <span>Clasificación Temática</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Categorías y <span className="text-indigo-600 dark:text-indigo-400 font-bold">colecciones bibliográficas</span>
          </h1>
          <p className="mt-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            Explora la descripción curatorial, ubicación física en sala, público recomendado y enfoque de lectura de cada colección del catálogo.
          </p>
        </div>

        <div className="badge-monday bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium text-xs px-3 py-1.5 shrink-0">
          {categorias.length} colecciones catalogadas
        </div>
      </div>

      {categorias.length === 0 ? (
        <div className="card-monday p-12 text-center">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No hay categorías registradas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categorias.map((cat, idx) => {
            const count = cat.libros_count ?? 0;
            const avail = cat.copias_disp_sum ?? 0;
            const bannerImg = resolveCategoryBannerArt(cat.nombre);
            const pastel = CATEGORY_PASTELS[idx % CATEGORY_PASTELS.length];

            return (
              <motion.article
                key={cat.id_categoria}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.025, 0.15) }}
                className="group card-monday overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden rounded-t-[15px]">
                    <img
                      src={bannerImg}
                      alt={cat.nombre}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
                      aria-hidden="true"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-2 text-white">
                      <h2 className="text-xl font-bold leading-tight">
                        {cat.nombre}
                      </h2>
                      <span className="badge-monday bg-white/90 text-slate-900 font-mono text-xs tabular-nums shrink-0">
                        CDU {cat.codigo_archivo}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {cat.descripcion}
                    </p>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                      <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xs">
                        <dt className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          Ubicación física
                        </dt>
                        <dd className="mt-1 font-mono text-slate-900 dark:text-slate-100 font-medium">
                          {cat.ubicacion_sala}
                        </dd>
                      </div>
                      <div className="p-3 rounded-xl bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xs">
                        <dt className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                          <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          Público recomendado
                        </dt>
                        <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                          {cat.publico_recomendado}
                        </dd>
                      </div>
                      <div className="sm:col-span-2 p-3 rounded-xl bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xs">
                        <dt className="text-slate-600 dark:text-slate-400 font-medium">Enfoque de lectura</dt>
                        <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                          {cat.enfoque_lector}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#f5f6f8] bg-[#f5f6f8]/40 flex items-center justify-between">
                  <span className="text-xs text-[#535768] font-mono tabular-nums">
                    <strong className="text-[#333333]">{count}</strong> {count === 1 ? 'título' : 'títulos'} · <strong className="text-[#2a5c4e]">{avail}</strong> disponibles
                  </span>

                  <button
                    type="button"
                    onClick={() => onExploreCategory(cat.nombre)}
                    className="btn-primary-pill text-xs py-1.5 px-4 cursor-pointer"
                  >
                    Explorar obras
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
