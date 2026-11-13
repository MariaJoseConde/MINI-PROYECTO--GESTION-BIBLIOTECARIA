import React from 'react';
import { ArrowRight, BookOpen, MapPin, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { resolveCategoryBannerArt } from '../lib/mediaAssets.ts';
import type { Categoria } from '../types/sgbi.ts';

interface CategoriasViewProps {
  categorias: Categoria[];
  onExploreCategory: (categoriaNombre: string) => void;
}

export const CategoriasView: React.FC<CategoriasViewProps> = ({
  categorias,
  onExploreCategory,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-[#E7E2D8] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-widest uppercase text-[#78716C]">
            Clasificación Temática del Acervo
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1C1917] text-balance">
            Categorías y colecciones bibliográficas
          </h1>
          <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
            Explore la descripción curatorial, ubicación física en sala, público recomendado y enfoque de lectura de cada colección del catálogo.
          </p>
        </div>

        <div className="text-xs text-[#57534E] font-mono tabular-nums shrink-0">
          {categorias.length} colecciones catalogadas
        </div>
      </div>

      {categorias.length === 0 ? (
        <div className="rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] p-12 text-center">
          <BookOpen className="w-8 h-8 text-[#A8A29E] mx-auto mb-2.5" />
          <p className="text-sm font-semibold text-[#1C1917]">
            No hay categorías registradas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categorias.map((cat, idx) => {
            const count = cat.libros_count ?? 0;
            const avail = cat.copias_disp_sum ?? 0;
            const bannerImg = resolveCategoryBannerArt(cat.nombre);

            return (
              <motion.article
                key={cat.id_categoria}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.025, 0.15) }}
                className="group rounded-xl border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden flex flex-col justify-between hover:border-[#C7BFA9] transition-colors"
              >
                <div>
                  <div className="relative h-36 bg-[#1E293B] overflow-hidden">
                    <img
                      src={bannerImg}
                      alt={cat.nombre}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
                      aria-hidden="true"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2 text-white">
                      <h2 className="font-serif text-xl font-semibold leading-tight">
                        {cat.nombre}
                      </h2>
                      <span className="font-mono text-xs tabular-nums text-white/85 shrink-0">
                        CDU {cat.codigo_archivo}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5">
                    <p className="text-sm text-[#44403C] leading-relaxed">
                      {cat.descripcion}
                    </p>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#F3EFE7] text-xs">
                      <div>
                        <dt className="flex items-center gap-1.5 text-[#78716C]">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          Ubicación física
                        </dt>
                        <dd className="mt-0.5 font-mono text-[#1C1917]">
                          {cat.ubicacion_sala}
                        </dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-1.5 text-[#78716C]">
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          Público recomendado
                        </dt>
                        <dd className="mt-0.5 font-medium text-[#1C1917]">
                          {cat.publico_recomendado}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[#78716C]">Enfoque de lectura</dt>
                        <dd className="mt-0.5 font-medium text-[#44403C]">
                          {cat.enfoque_lector}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-[#F3EFE7] flex items-center justify-between">
                  <span className="text-xs text-[#78716C] font-mono tabular-nums">
                    {count} {count === 1 ? 'título' : 'títulos'} · {avail} disponibles
                  </span>

                  <button
                    type="button"
                    onClick={() => onExploreCategory(cat.nombre)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] hover:text-[#172554] hover:underline underline-offset-4 cursor-pointer"
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
