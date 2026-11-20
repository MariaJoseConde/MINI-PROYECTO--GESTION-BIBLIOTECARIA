import React, { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  Check,
  Eye,
  Minimize2,
  RefreshCw,
  Type,
  X,
  ZapOff,
} from 'lucide-react';

export const AccessibilityMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [fontScale, setFontScale] = useState<'normal' | 'lg' | 'xl'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sgbi-font-scale');
      if (saved === 'lg' || saved === 'xl') return saved;
    }
    return 'normal';
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sgbi-high-contrast') === 'true';
    }
    return false;
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sgbi-reduced-motion') === 'true';
    }
    return false;
  });

  const [readableFont, setReadableFont] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sgbi-readable-font') === 'true';
    }
    return false;
  });

  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Apply font scale
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('text-scale-lg', 'text-scale-xl');
    if (fontScale === 'lg') {
      root.classList.add('text-scale-lg');
    } else if (fontScale === 'xl') {
      root.classList.add('text-scale-xl');
    }
    localStorage.setItem('sgbi-font-scale', fontScale);
  }, [fontScale]);

  // Apply high contrast
  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    localStorage.setItem('sgbi-high-contrast', String(highContrast));
  }, [highContrast]);

  // Apply reduced motion
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    localStorage.setItem('sgbi-reduced-motion', String(reducedMotion));
  }, [reducedMotion]);

  // Apply readable font
  useEffect(() => {
    const root = document.documentElement;
    if (readableFont) {
      root.classList.add('font-accessible');
    } else {
      root.classList.remove('font-accessible');
    }
    localStorage.setItem('sgbi-readable-font', String(readableFont));
  }, [readableFont]);

  // Handle ESC key to close and focus trap
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        triggerButtonRef.current &&
        !triggerButtonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function resetAll() {
    setFontScale('normal');
    setHighContrast(false);
    setReducedMotion(false);
    setReadableFont(false);
  }

  return (
    <aside
      className="fixed bottom-5 right-5 z-40 no-print flex flex-col items-end pointer-events-auto"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Herramientas de accesibilidad"
    >
      {/* Diálogo emergente accesible */}
      {isOpen && (
        <div
          ref={dialogRef}
          id="accessibility-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-title"
          className="mb-3 w-80 max-w-[calc(100vw-2rem)] glass-modal rounded-2xl p-5 border border-slate-200/90 dark:border-slate-700/80 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Accessibility className="w-5 h-5" />
              </div>
              <h2
                id="accessibility-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Accesibilidad
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                triggerButtonRef.current?.focus();
              }}
              aria-label="Cerrar panel de accesibilidad"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-4 text-xs">
            {/* 1. Tamaño del texto */}
            <div>
              <label
                id="font-scale-label"
                className="block font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5"
              >
                <Type className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Tamaño de texto</span>
              </label>
              <div
                role="radiogroup"
                aria-labelledby="font-scale-label"
                className="grid grid-cols-3 gap-1.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={fontScale === 'normal'}
                  onClick={() => setFontScale('normal')}
                  className={`min-h-[44px] px-2 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    fontScale === 'normal'
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                      : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>100%</span>
                  {fontScale === 'normal' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={fontScale === 'lg'}
                  onClick={() => setFontScale('lg')}
                  className={`min-h-[44px] px-2 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    fontScale === 'lg'
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                      : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-sm font-semibold">115%</span>
                  {fontScale === 'lg' && <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={fontScale === 'xl'}
                  onClick={() => setFontScale('xl')}
                  className={`min-h-[44px] px-2 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1 border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    fontScale === 'xl'
                      ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                      : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-base font-bold">130%</span>
                  {fontScale === 'xl' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* 2. Contraste Mejorado (WCAG AAA) */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/60">
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                onClick={() => setHighContrast((prev) => !prev)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  highContrast
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-bold'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Alto contraste (WCAG AAA)</span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                    highContrast ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      highContrast ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* 3. Reducción de animaciones */}
            <div>
              <button
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                onClick={() => setReducedMotion((prev) => !prev)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  reducedMotion
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-bold'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ZapOff className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Reducir animaciones</span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                    reducedMotion ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      reducedMotion ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* 4. Fuente de alta legibilidad */}
            <div>
              <button
                type="button"
                role="switch"
                aria-checked={readableFont}
                onClick={() => setReadableFont((prev) => !prev)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  readableFont
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-bold'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Minimize2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Lectura hiperlegible</span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                    readableFont ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      readableFont ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* Pie de diálogo con botón de reinicio */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={resetAll}
              className="min-h-[44px] px-3 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                triggerButtonRef.current?.focus();
              }}
              className="min-h-[44px] px-4 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 shadow-xs"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante de activación principal */}
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="accessibility-dialog"
        aria-label="Opciones de accesibilidad (tamaño de texto, contraste y animaciones)"
        title="Opciones de accesibilidad (clic para abrir)"
        className="min-h-[48px] min-w-[48px] p-3 rounded-full glass-surface bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-indigo-600 dark:text-indigo-400 border border-indigo-200/90 dark:border-indigo-800/90 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
      >
        <Accessibility className="w-6 h-6" />
      </button>
    </aside>
  );
};
