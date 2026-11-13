import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { resolveBookCoverArt } from '../lib/mediaAssets.ts';
import type { Libro } from '../types/sgbi.ts';

interface BookCoverProps {
  libro: Libro;
  size?: 'sm' | 'md' | 'lg' | 'card';
}

const EDITION_PALETTES = [
  { bg: 'bg-[#1E293B]', accent: 'border-[#94A3B8]/40', text: 'text-[#F8FAFC]', sub: 'text-[#CBD5E1]' },
  { bg: 'bg-[#1E3A8A]', accent: 'border-[#93C5FD]/35', text: 'text-[#F8FAFC]', sub: 'text-[#DBEAFE]' },
  { bg: 'bg-[#3F2E26]', accent: 'border-[#D6CEBE]/40', text: 'text-[#FBF9F5]', sub: 'text-[#E7E2D8]' },
  { bg: 'bg-[#14532D]', accent: 'border-[#86EFAC]/30', text: 'text-[#F7FEE7]', sub: 'text-[#DCFCE7]' },
  { bg: 'bg-[#581C1C]', accent: 'border-[#FCA5A5]/30', text: 'text-[#FEF2F2]', sub: 'text-[#FEE2E2]' },
  { bg: 'bg-[#292524]', accent: 'border-[#A8A29E]/35', text: 'text-[#FAFAF9]', sub: 'text-[#D6D3D1]' },
];

export const BookCover: React.FC<BookCoverProps> = ({ libro, size = 'md' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const palette = EDITION_PALETTES[libro.id_libro % EDITION_PALETTES.length];
  const primaryAuthor = libro.autores[0]?.nombre ?? 'Autor anónimo';
  const coverSrc = resolveBookCoverArt(libro.categoria, libro.id_libro);

  if (size === 'sm') {
    return (
      <div
        className={`w-14 h-20 relative flex flex-col justify-end rounded-sm border border-black/15 shrink-0 select-none overflow-hidden ${palette.bg}`}
        aria-hidden="true"
      >
        {!imgFailed ? (
          <img
            src={coverSrc}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover scale-105"
          />
        ) : (
          <div className="p-2 flex flex-col justify-between h-full">
            <span className={`font-serif text-[10px] leading-tight font-semibold line-clamp-2 ${palette.text}`}>
              {libro.titulo}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (size === 'card') {
    return (
      <div
        className={`relative w-full aspect-[4/3] overflow-hidden rounded-t-lg select-none ${palette.bg}`}
      >
        {!imgFailed ? (
          <img
            src={coverSrc}
            alt={`Portada editorial de ${libro.titulo}`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover scale-[1.04] transition-transform duration-500 ease-out group-hover:scale-[1.09]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <BookOpen className={`w-8 h-8 mb-2 opacity-60 ${palette.text}`} />
            <span className={`font-serif text-base font-semibold line-clamp-2 ${palette.text}`}>
              {libro.titulo}
            </span>
          </div>
        )}

        {/* Scrim medido inferior para legibilidad sobre fotografía */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-2 text-white">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-white/85 truncate">
              {libro.categoria}
            </p>
            <p className="font-serif text-sm font-medium text-white truncate">
              {primaryAuthor}
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-white/90 shrink-0">
            {libro.anio_publicacion ?? 'S.F.'}
          </span>
        </div>
      </div>
    );
  }

  const sizeClasses =
    size === 'lg'
      ? 'w-full aspect-[3/4] max-w-[260px]'
      : 'w-full aspect-[3/4]';

  return (
    <div
      className={`${sizeClasses} ${palette.bg} relative flex flex-col justify-between rounded-md border border-black/15 select-none overflow-hidden shadow-sm`}
    >
      {!imgFailed ? (
        <img
          src={coverSrc}
          alt={`Cubierta de ${libro.titulo}`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover scale-[1.04]"
        />
      ) : null}

      <div
        className={`absolute inset-0 ${
          imgFailed
            ? ''
            : 'bg-gradient-to-t from-black/85 via-black/30 to-black/35'
        } pointer-events-none`}
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center justify-between gap-2 p-5">
        <span className="font-mono text-[10px] tracking-wider uppercase truncate text-white/85">
          {libro.categoria}
        </span>
        <span className="font-mono text-[10px] tabular-nums shrink-0 text-white/85">
          {libro.anio_publicacion ?? '—'}
        </span>
      </div>

      <div className="relative z-10 p-5 mt-auto">
        <h4
          className={`font-serif font-semibold leading-snug tracking-tight text-white ${
            size === 'lg' ? 'text-2xl' : 'text-lg'
          } line-clamp-3`}
        >
          {libro.titulo}
        </h4>
        <p className="mt-1.5 text-xs font-medium truncate text-white/85">{primaryAuthor}</p>
        <div className="mt-3 pt-2 border-t border-white/20">
          <span className="font-mono text-[10px] tracking-tight tabular-nums text-white/75">
            ISBN {libro.isbn}
          </span>
        </div>
      </div>
    </div>
  );
};
