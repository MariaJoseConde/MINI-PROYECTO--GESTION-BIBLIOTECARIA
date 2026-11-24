import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Compass,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { apiClient, ApiRequestError } from '../lib/apiClient.ts';
import { LIBRARY_MEDIA, resolveCategoryBannerArt } from '../lib/mediaAssets.ts';
import type { Categoria, Libro, Sala, Usuario } from '../types/sgbi.ts';

interface SalasViewProps {
  categorias: Categoria[];
  libros: Libro[];
  user?: Usuario | null;
  onNotify?: (type: 'success' | 'error' | 'info', text: string) => void;
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
  user,
  onNotify,
  onExploreCategory,
  onSelectLibro,
}) => {
  const [selectedSala, setSelectedSala] = useState<string>('Todas');
  const [filterText, setFilterText] = useState('');
  const [planImgFailed, setPlanImgFailed] = useState(false);

  const [salasApi, setSalasApi] = useState<Sala[]>([]);
  const [loadingSalas, setLoadingSalas] = useState(true);
  const [salasError, setSalasError] = useState<string | null>(null);
  const [newSalaNombre, setNewSalaNombre] = useState('');
  const [newSalaDesc, setNewSalaDesc] = useState('');
  const [newSalaCap, setNewSalaCap] = useState(30);
  const [savingSala, setSavingSala] = useState(false);

  const loadSalas = useCallback(async () => {
    setLoadingSalas(true);
    setSalasError(null);
    try {
      const data = await apiClient.get<{ salas: Sala[] }>('/api/salas');
      setSalasApi(data.salas ?? []);
    } catch (err) {
      setSalasError(
        err instanceof ApiRequestError ? err.message : 'No se pudieron cargar las salas.',
      );
    } finally {
      setLoadingSalas(false);
    }
  }, []);

  useEffect(() => {
    loadSalas();
  }, [loadSalas]);

  async function handleCreateSala(e: React.FormEvent) {
    e.preventDefault();
    if (!newSalaNombre.trim()) return;
    setSavingSala(true);
    try {
      const data = await apiClient.post<{ sala?: Sala }>('/api/salas', {
        nombre: newSalaNombre.trim(),
        descripcion: newSalaDesc.trim() || null,
        capacidad: Number(newSalaCap) || 30,
      });
      if (data.sala) {
        setSalasApi((prev) => [...prev, data.sala!].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setNewSalaNombre('');
        setNewSalaDesc('');
        setNewSalaCap(30);
        onNotify?.('success', `Sala "${data.sala.nombre}" registrada.`);
      }
    } catch (err) {
      onNotify?.(
        'error',
        err instanceof ApiRequestError ? err.message : 'Error al registrar la sala.',
      );
    } finally {
      setSavingSala(false);
    }
  }

  async function handleDeleteSala(sala: Sala) {
    try {
      await apiClient.del(`/api/salas/${sala.id_sala}`);
      setSalasApi((prev) => prev.filter((s) => s.id_sala !== sala.id_sala));
      onNotify?.('success', `Sala "${sala.nombre}" eliminada.`);
    } catch (err) {
      onNotify?.(
        'error',
        err instanceof ApiRequestError ? err.message : 'No se pudo eliminar la sala.',
      );
    }
  }

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
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="card-monday bg-[#ffffff] dark:bg-slate-900/60 p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#287A65]/12 dark:bg-[#287A65]/25 text-[#287A65] dark:text-[#38a58a] text-xs font-semibold uppercase tracking-wider mb-2.5 border border-[#287A65]/30">
            <Compass className="w-3.5 h-3.5" />
            <span>Orientación Espacial</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#183B4E] dark:text-white text-balance">
            Organización de salas, <span className="text-[#287A65] dark:text-[#38a58a] font-bold">pasillos y estanterías</span>
          </h1>
          <p className="mt-2.5 text-sm text-[#183B4E]/80 dark:text-slate-300 leading-relaxed">
            Ubica físicamente cada colección dentro del edificio, explora la distribución de pasillos y consulta en qué estante se encuentra cada obra.
          </p>
        </div>

        <div className="relative w-full lg:w-80 shrink-0">
          <Search className="w-4 h-4 text-[#808080] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Buscar sala, pasillo, estante o libro..."
            aria-label="Localizar sala, pasillo o estante"
            className="w-full input-monday pl-10 pr-4 py-2 text-sm shadow-2xs"
          />
        </div>
      </div>

      {/* Plano Arquitectónico Interactivo */}
      <section className="card-monday overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Plano arquitectónico del edificio bibliotecario</span>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Haz clic en una sala del plano o en los filtros inferiores para aislar sus pasillos
          </span>
        </div>

        <div className="relative aspect-[16/9] max-h-[460px] w-full bg-[#f5f6f8] overflow-hidden">
          {!planImgFailed ? (
            <img
              src={LIBRARY_MEDIA.planoSalas}
              alt="Plano arquitectónico isométrico de las salas y pasillos de la biblioteca"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setPlanImgFailed(true)}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-[#535768]">
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
                  className={`absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-[160px] px-3 py-1.5 text-xs font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#287A65] text-white ring-2 ring-white scale-105'
                      : 'bg-[#183B4E]/90 text-white hover:bg-[#287A65] hover:scale-105'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{s.sala}</span>
                  <span className="font-mono text-[10px] text-white/80 font-semibold tabular-nums">
                    ({s.pasillos.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector rápido de Salas (Pills) */}
        <div className="px-6 py-4 border-t border-[#183B4E]/12 dark:border-slate-800/80 bg-[#ffffff] dark:bg-slate-900/60 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedSala('Todas')}
            className={`px-3.5 py-1.5 rounded-[160px] text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              selectedSala === 'Todas'
                ? 'bg-[#287A65] text-white shadow-xs font-semibold'
                : 'bg-[#F3EBDD] dark:bg-slate-800/60 text-[#183B4E] dark:text-slate-300 hover:text-[#287A65] dark:hover:text-white hover:bg-[#287A65]/15'
            }`}
          >
            Todas las salas ({salasAgrupadas.length})
          </button>

          {salasAgrupadas.map((s) => (
            <button
              key={s.sala}
              type="button"
              onClick={() => setSelectedSala(s.sala)}
              className={`px-3.5 py-1.5 rounded-[160px] text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedSala === s.sala
                  ? 'bg-[#287A65] text-white shadow-xs font-semibold'
                  : 'bg-[#F3EBDD] dark:bg-slate-800/60 text-[#183B4E] dark:text-slate-300 hover:text-[#287A65] dark:hover:text-white hover:bg-[#287A65]/15'
              }`}
            >
              {s.sala} · {s.pasillos.length} {s.pasillos.length === 1 ? 'pasillo' : 'pasillos'}
            </button>
          ))}
        </div>
      </section>

      {/* Directorio Detallado por Sala y Pasillo */}
      {filteredSalas.length === 0 ? (
        <div className="card-monday bg-[#ffffff] py-14 px-6 text-center">
          <BookOpen className="w-9 h-9 text-[#808080] mx-auto mb-2.5" />
          <h3 className="text-lg font-bold text-[#333333]">
            Sin coincidencias en salas o estantes
          </h3>
          <p className="mt-1 text-xs text-[#535768]">
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
              className="card-monday bg-[#ffffff] overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-[#d0d4e4] bg-[#f5f6f8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="badge-monday bg-[#183B4E]/10 dark:bg-[#183B4E]/30 text-[#183B4E] dark:text-[#a5c4d4] font-semibold text-[10px] mb-1">
                    {grupo.meta.nivel}
                  </div>
                  <h2 className="text-2xl font-bold text-[#183B4E] dark:text-white tracking-tight">
                    {grupo.sala}
                  </h2>
                  <p className="text-xs text-[#535768] mt-0.5">{grupo.meta.subtitulo}</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono tabular-nums shrink-0 text-[#535768]">
                  <span>
                    {grupo.pasillos.length}{' '}
                    {grupo.pasillos.length === 1 ? 'pasillo / zona' : 'pasillos / zonas'}
                  </span>
                  <span className="text-[#cacbcd]">·</span>
                  <span>{grupo.totalLibros} títulos</span>
                  <span className="text-[#cacbcd]">·</span>
                  <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e] font-semibold">{grupo.totalDisp} disponibles</span>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                {grupo.pasillos.map(({ categoria, pasilloLabel, libros: librosPasillo }) => (
                  <article
                    key={categoria.id_categoria}
                    className="rounded-[16px] border border-[#d0d4e4] bg-[#ffffff] overflow-hidden flex flex-col justify-between shadow-xs hover:border-[#287A65]/50 transition-colors"
                  >
                    <div>
                      <div className="flex gap-4 p-4 bg-[#f5f6f8] border-b border-[#d0d4e4]">
                        <div className="w-24 h-20 rounded-[12px] overflow-hidden shrink-0 bg-[#e7ecff]">
                          <img
                            src={resolveCategoryBannerArt(categoria.nombre)}
                            alt={categoria.nombre}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#287A65] dark:text-[#38a58a] font-semibold">
                            <span className="truncate">{pasilloLabel}</span>
                            <span className="badge-monday bg-[#ffffff] text-[#535768] shrink-0">
                              CDU {categoria.codigo_archivo}
                            </span>
                          </div>
                          <h3 className="mt-1 text-base font-bold text-[#183B4E] dark:text-white truncate">
                            {categoria.nombre}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#535768] line-clamp-2">
                            {categoria.descripcion}
                          </p>
                        </div>
                      </div>

                      {/* Estanterías y Obras en este pasillo */}
                      <div className="p-4 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#535768]">
                          Estantes y ejemplares ({librosPasillo.length})
                        </div>

                        {librosPasillo.length === 0 ? (
                          <p className="text-xs text-[#808080] py-2">
                            Espacio reservado para nuevas adquisiciones de esta colección.
                          </p>
                        ) : (
                          <ul className="divide-y divide-[#f5f6f8]">
                            {librosPasillo.map((libro) => (
                              <li key={libro.id_libro} className="py-2 first:pt-1 last:pb-0">
                                <button
                                  type="button"
                                  onClick={() => onSelectLibro(libro)}
                                  className="w-full text-left group flex items-start justify-between gap-3 cursor-pointer"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#333333] dark:text-slate-200 group-hover:text-[#287A65] dark:group-hover:text-[#38a58a] group-hover:underline underline-offset-2 truncate">
                                      {libro.titulo}
                                    </div>
                                    <div className="text-[11px] font-mono text-[#535768] truncate">
                                      {libro.ubicacion_estante || categoria.ubicacion_sala}
                                    </div>
                                  </div>

                                  <span
                                    className={`badge-monday font-mono text-[10px] tabular-nums shrink-0 ${
                                      libro.copias_disp === 0
                                        ? 'bg-[#fcd0f8] text-[#991B1B]'
                                        : 'bg-[#bcfe90] text-[#2a5c4e]'
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

                    <div className="px-4 py-3 border-t border-[#f5f6f8] bg-[#f5f6f8]/40 flex items-center justify-between text-xs">
                      <span className="text-[#535768] truncate">{categoria.enfoque_lector}</span>
                      <button
                        type="button"
                        onClick={() => onExploreCategory(categoria.nombre)}
                        className="btn-outline-pill text-xs py-1 px-3.5 cursor-pointer"
                      >
                        Abrir colección
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}

      {/* Sección Salas Físicas conectada a /api/salas */}
      <section className="card-monday p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d0d4e4] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#183B4E] dark:text-white tracking-tight">
              Directorio de Salas de Lectura ({salasApi.length})
            </h2>
            <p className="text-xs text-[#535768] dark:text-slate-400">
              Aforos y áreas físicas sincronizadas en tiempo real con la base de datos de biblioSmart.
            </p>
          </div>
          {salasError && (
            <button
              type="button"
              onClick={loadSalas}
              className="btn-outline-pill text-xs py-1.5 px-3.5 cursor-pointer"
            >
              Reintentar
            </button>
          )}
        </div>

        {loadingSalas ? (
          <div className="py-6 text-center text-xs text-slate-600 dark:text-slate-400" role="status">
            Cargando salas registradas...
          </div>
        ) : salasError ? (
          <div className="rounded-xl border border-rose-300/70 bg-rose-50/70 px-4 py-3 text-xs text-rose-800" role="alert">
            {salasError}
          </div>
        ) : salasApi.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-600 dark:text-slate-400">
            No hay salas registradas en el sistema.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {salasApi.map((s) => (
              <div
                key={s.id_sala}
                className="rounded-2xl border border-[#d0d4e4]/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/50 p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#183B4E] dark:text-white">{s.nombre}</h3>
                    <span className="badge-monday bg-[#287A65]/12 text-[#287A65] text-[10px] font-mono shrink-0">
                      <Users className="w-3 h-3 mr-1" />
                      {s.capacidad} cupos
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5">
                    {s.descripcion || 'Sala disponible para lectura y consulta.'}
                  </p>
                </div>
                {user?.rol === 'ADMIN' && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteSala(s)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {user?.rol === 'ADMIN' && (
          <form onSubmit={handleCreateSala} className="pt-4 border-t border-[#d0d4e4] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="new-sala-name" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nueva sala
              </label>
              <input
                id="new-sala-name"
                type="text"
                required
                value={newSalaNombre}
                onChange={(e) => setNewSalaNombre(e.target.value)}
                placeholder="Ej. Sala E · Posgrado"
                className="input-monday w-full text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-sala-desc" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Descripción
              </label>
              <input
                id="new-sala-desc"
                type="text"
                value={newSalaDesc}
                onChange={(e) => setNewSalaDesc(e.target.value)}
                placeholder="Área de estudio silencioso..."
                className="input-monday w-full text-xs"
              />
            </div>
            <div className="flex gap-2 items-end">
              <div className="w-20">
                <label htmlFor="new-sala-cap" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Aforo
                </label>
                <input
                  id="new-sala-cap"
                  type="number"
                  min={1}
                  value={newSalaCap}
                  onChange={(e) => setNewSalaCap(Number(e.target.value))}
                  className="input-monday w-full text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={savingSala}
                className="btn-primary-pill text-xs py-2 px-3.5 cursor-pointer shrink-0 disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" />
                {savingSala ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};
