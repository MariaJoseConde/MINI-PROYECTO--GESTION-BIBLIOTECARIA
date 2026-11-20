/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  BookOpen,
  BookmarkCheck,
  ChevronRight,
  FileCheck2,
  Home,
  Layers,
  LogIn,
  LogOut,
  Map as MapIcon,
  Menu,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AccessibilityMenu } from './components/AccessibilityMenu.tsx';
import { CatalogoView } from './components/CatalogoView.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ToastBanner, type ToastMessage } from './components/ToastBanner.tsx';
import { apiClient } from './lib/apiClient.ts';
import type { Categoria, Libro, Usuario } from './types/sgbi.ts';

// Carga perezosa (Lazy loading) de vistas pesadas para optimizar la carga en la intranet
const AdminView = lazy(() =>
  import('./components/AdminView.tsx').then((m) => ({ default: m.AdminView })),
);
const CategoriasView = lazy(() =>
  import('./components/CategoriasView.tsx').then((m) => ({ default: m.CategoriasView })),
);
const EvaluacionesView = lazy(() =>
  import('./components/EvaluacionesView.tsx').then((m) => ({ default: m.EvaluacionesView })),
);
const LibroDetalleModal = lazy(() =>
  import('./components/LibroDetalleModal.tsx').then((m) => ({ default: m.LibroDetalleModal })),
);
const LoginModal = lazy(() =>
  import('./components/LoginModal.tsx').then((m) => ({ default: m.LoginModal })),
);
const MisPrestamosView = lazy(() =>
  import('./components/MisPrestamosView.tsx').then((m) => ({ default: m.MisPrestamosView })),
);
const MostradorView = lazy(() =>
  import('./components/MostradorView.tsx').then((m) => ({ default: m.MostradorView })),
);
const SalasView = lazy(() =>
  import('./components/SalasView.tsx').then((m) => ({ default: m.SalasView })),
);

type ActiveRoute =
  | 'catalogo'
  | 'categorias'
  | 'salas'
  | 'mostrador'
  | 'mis-prestamos'
  | 'evaluaciones'
  | 'admin';

const VALID_ROUTES: ActiveRoute[] = [
  'catalogo',
  'categorias',
  'salas',
  'mostrador',
  'mis-prestamos',
  'evaluaciones',
  'admin',
];

const ROUTE_LABELS: Record<ActiveRoute, { section: string; label: string }> = {
  catalogo: { section: 'Acervo', label: 'Mis Temas y Catálogo' },
  categorias: { section: 'Acervo', label: 'Categorías y Colecciones' },
  salas: { section: 'Orientación', label: 'Salas y Pasillos' },
  mostrador: { section: 'Circulación', label: 'Mostrador de Préstamos' },
  'mis-prestamos': { section: 'Cuenta', label: 'Mi Progreso y Préstamos' },
  evaluaciones: { section: 'Estudio IA', label: 'Tutoría y Práctica Guiada' },
  admin: { section: 'Sistema', label: 'Administración' },
};

function parseHashState(): { route: ActiveRoute; category: string } {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw || raw === 'inicio') {
    return { route: 'catalogo', category: 'Todas' };
  }
  const [pathPart, queryPart] = raw.split('?');
  const candidate = pathPart as ActiveRoute;
  const route: ActiveRoute = VALID_ROUTES.includes(candidate) ? candidate : 'catalogo';
  let category = 'Todas';
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    const catParam = params.get('cat');
    if (catParam && catParam.trim()) {
      category = catParam.trim();
    }
  }
  return { route, category };
}

function buildHashUrl(route: ActiveRoute, category: string): string {
  if (route === 'catalogo' && category === 'Todas') {
    return '#/inicio';
  }
  if (route === 'catalogo' && category !== 'Todas') {
    return `#/catalogo?cat=${encodeURIComponent(category)}`;
  }
  return `#/${route}`;
}

export default function App() {
  const initialHash = parseHashState();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
  });
  const [user, setUser] = useState<Usuario | null>(null);
  const [libros, setLibros] = useState<Libro[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingLibros, setLoadingLibros] = useState(true);
  const [route, setRoute] = useState<ActiveRoute>(initialHash.route);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialHash.category);
  const [homeResetKey, setHomeResetKey] = useState(0);
  const [selectedLibro, setSelectedLibro] = useState<Libro | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(1);

  const notify = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchCatalogAndCategories = useCallback(async () => {
    try {
      const [lData, cData] = await Promise.all([
        apiClient.get<{ libros: Libro[] }>('/api/libros'),
        apiClient.get<{ categorias: Categoria[] }>('/api/categorias'),
      ]);
      setLibros(lData.libros);
      setSelectedLibro((prev) =>
        prev ? lData.libros.find((b) => b.id_libro === prev.id_libro) ?? null : null,
      );
      setCategorias(cData.categorias);
    } finally {
      setLoadingLibros(false);
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [meData] = await Promise.all([
          apiClient.get<{ user: Usuario | null }>('/api/auth/me'),
          fetchCatalogAndCategories(),
        ]);
        setUser(meData.user);
      } catch {
        setLoadingLibros(false);
      }
    }
    bootstrap();
  }, [fetchCatalogAndCategories]);

  useEffect(() => {
    const expectedHash = buildHashUrl(route, selectedCategory);
    if (window.location.hash !== expectedHash) {
      window.history.replaceState(null, '', expectedHash);
    }
  }, [route, selectedCategory]);

  useEffect(() => {
    function onHashChange() {
      const parsed = parseHashState();
      setRoute(parsed.route);
      setSelectedCategory(parsed.category);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      if (meta) meta.setAttribute('content', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      if (meta) meta.setAttribute('content', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }

  async function handleLogout() {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Clear local session state even if network call fails
    }
    setUser(null);
    setRoute('catalogo');
    setSelectedCategory('Todas');
    setMobileMenuOpen(false);
    notify('info', 'Sesión cerrada.');
  }

  function handleLoginSuccess(loggedUser: Usuario) {
    setUser(loggedUser);
    notify('success', `Bienvenido, ${loggedUser.nombre_completo} (${loggedUser.rol}).`);
    if (loggedUser.rol === 'ADMIN') {
      setRoute('mostrador');
    } else if (loggedUser.rol === 'DOCENTE') {
      setRoute('evaluaciones');
    } else {
      setRoute('mis-prestamos');
    }
  }

  function navigateToRoute(nextRoute: ActiveRoute) {
    setRoute(nextRoute);
    setMobileMenuOpen(false);
    if (nextRoute === 'catalogo') {
      requestAnimationFrame(() => {
        const el = document.getElementById('catalogo-obras');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goToMainScreen() {
    setSelectedCategory('Todas');
    setHomeResetKey((k) => k + 1);
    setRoute('catalogo');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleJumpToCategory(catNombre: string) {
    setSelectedCategory(catNombre);
    setRoute('catalogo');
    setMobileMenuOpen(false);
  }

  const exploreItems: Array<{
    id: ActiveRoute;
    label: string;
    icon: typeof BookOpen;
  }> = [
    { id: 'catalogo', label: 'Mis Temas / Catálogo', icon: BookOpen },
    { id: 'evaluaciones', label: 'Práctica y Tutoría IA', icon: FileCheck2 },
    { id: 'salas', label: 'Salas y Pasillos', icon: MapIcon },
    { id: 'categorias', label: 'Categorías y CDU', icon: Layers },
  ];

  const accountItems: Array<{
    id: ActiveRoute;
    label: string;
    icon: typeof BookOpen;
    visible: boolean;
  }> = [
    {
      id: 'mis-prestamos',
      label: 'Mi Progreso y Préstamos',
      icon: BookmarkCheck,
      visible: Boolean(user),
    },
    {
      id: 'mostrador',
      label: 'Mostrador',
      icon: ArrowRightLeft,
      visible: user?.rol === 'ADMIN',
    },
    {
      id: 'admin',
      label: 'Administración',
      icon: SlidersHorizontal,
      visible: user?.rol === 'ADMIN',
    },
  ];

  const visibleAccountItems = accountItems.filter((item) => item.visible);
  const currentBreadcrumb = ROUTE_LABELS[route];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-transparent">
      {/* Brand Header */}
      <div className="px-5 h-16 min-h-16 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/60 shrink-0 bg-transparent">
        <button
          type="button"
          onClick={goToMainScreen}
          className="min-h-[44px] flex items-center gap-2.5 font-sans text-base font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            S
          </div>
          <span className="font-bold text-slate-900 dark:text-white">SGBI <span className="text-indigo-600 dark:text-indigo-400 font-semibold">· Estudio IA</span></span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          aria-label="Cerrar menú lateral"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navegación Lateral Estructurada en 3 Secciones */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Sección 1: Explorar */}
        <nav aria-label="Explorar biblioteca" className="space-y-1.5">
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
            Explorar
          </div>
          <button
            type="button"
            onClick={goToMainScreen}
            className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              route === 'catalogo' && selectedCategory === 'Todas'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="truncate">Vista principal</span>
          </button>

          {exploreItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.id === 'catalogo'
                ? route === 'catalogo' && selectedCategory !== 'Todas'
                : route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToRoute(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  active
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sección 2: Operación y Cuenta (RBAC) */}
        {visibleAccountItems.length > 0 && (
          <nav aria-label="Operación y cuenta" className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              Operación y Cuenta
            </div>
            {visibleAccountItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateToRoute(item.id)}
                  className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    active
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Sección 3: Colecciones por Categoría */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <div className="px-3 pb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              Colecciones
            </span>
            <button
              type="button"
              onClick={() => navigateToRoute('categorias')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline underline-offset-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
            >
              Ver todas
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleJumpToCategory('Todas')}
            className={`w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              route === 'catalogo' && selectedCategory === 'Todas'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <span className="truncate">Todas las colecciones</span>
            <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
              {libros.length}
            </span>
          </button>

          {categorias.map((cat) => {
            const isActiveCat = route === 'catalogo' && selectedCategory === cat.nombre;
            return (
              <button
                key={cat.id_categoria}
                type="button"
                onClick={() => handleJumpToCategory(cat.nombre)}
                title={cat.descripcion}
                className={`w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  isActiveCat
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <span className="truncate">{cat.nombre}</span>
                <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                  {cat.libros_count ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pie de barra lateral: Cuenta y Sesión */}
      <div className="p-4 border-t border-slate-200/70 dark:border-slate-800/60 bg-transparent shrink-0">
        {/* Selector de Tema con icono de Sol (Modo Claro / Oscuro) */}
        <div className="mb-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-800/50 backdrop-blur-md hover:bg-white/80 dark:hover:bg-slate-800/80 flex items-center justify-between transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <Sun className={`w-4 h-4 ${theme === 'dark' ? 'text-amber-400 rotate-90' : 'text-amber-500'} transition-transform duration-500`} />
              <span>Tema de pantalla</span>
            </div>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {theme === 'dark' ? 'Oscuro' : 'Claro'}
            </span>
          </button>
        </div>

        {user ? (
          <div className="space-y-3">
            <div className="px-1 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                {user.nombre_completo.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user.nombre_completo}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mr-1.5">
                    {user.rol}
                  </span>
                  {user.estado}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full min-h-[44px] rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setLoginOpen(true);
            }}
            className="w-full min-h-[44px] rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <LogIn className="w-4 h-4" />
            Iniciar Sesión
          </button>
        )}
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {/* Enlace de accesibilidad para saltar al contenido principal (WCAG 2.4.1) */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <div className={`min-h-screen flex ${theme === 'dark' ? 'dark bg-[#0b1120] text-slate-100' : 'bg-slate-50/70 text-slate-800'} font-sans relative`}>
        {/* Fondo ambiental difuso con formas orgánicas para realzar el efecto Glassmorphism */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
          {/* Orbe 1: Superior derecha (índigo suave) */}
          <div className="absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full bg-gradient-to-br from-indigo-400/20 via-sky-300/15 to-transparent dark:from-indigo-600/15 dark:via-blue-900/10 blur-[130px] transform-gpu" />
          {/* Orbe 2: Central izquierda (celeste / violeta) */}
          <div className="absolute top-1/3 -left-40 w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-sky-400/15 via-indigo-300/15 to-transparent dark:from-blue-600/10 dark:via-purple-900/10 blur-[120px] transform-gpu" />
          {/* Orbe 3: Inferior derecha (lavanda / púrpura sutil) */}
          <div className="absolute -bottom-32 right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-violet-400/15 via-indigo-200/10 to-transparent dark:from-purple-800/10 dark:via-indigo-950/20 blur-[140px] transform-gpu" />
          {/* Gradiente base sutil */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/30 to-indigo-50/15 dark:from-transparent dark:via-slate-950/40 dark:to-slate-900/30" />
        </div>

        {/* Barra Lateral Izquierda (Escritorio) */}
        <aside className="no-print hidden lg:flex lg:flex-col lg:w-68 lg:shrink-0 glass-sidebar sticky top-0 h-screen">
          {renderSidebarContent()}
        </aside>

        {/* Drawer Lateral Móvil */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación móvil"
              className="no-print fixed inset-0 z-50 lg:hidden flex"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-sm"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-72 max-w-[85vw] glass-sidebar h-full z-10 shadow-2xl"
              >
                {renderSidebarContent()}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Área Principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Sólido y Proporcionado (WCAG 2.1/2.2 AA) con Glassmorphism */}
          <header className="no-print sticky top-0 z-30 min-h-16 h-16 glass-nav px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-slate-800 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 cursor-pointer shadow-2xs"
                aria-label="Abrir navegación lateral"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Marca y Navegación Predecible (3 o 4 opciones esenciales) */}
              <button
                type="button"
                onClick={goToMainScreen}
                className="min-h-[44px] flex items-center gap-2 font-sans text-base font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md shrink-0 mr-1"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  S
                </div>
                <span className="font-bold text-slate-900 dark:text-white hidden sm:inline">
                  SGBI <span className="text-indigo-600 dark:text-indigo-400 font-semibold">· Estudio IA</span>
                </span>
              </button>

              <nav aria-label="Navegación principal de estudio" className="hidden md:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigateToRoute('catalogo')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'catalogo'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Mis Temas
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('evaluaciones')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'evaluaciones'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Práctica e IA
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('salas')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'salas'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Salas
                </button>
                <button
                  type="button"
                  onClick={() => (user ? navigateToRoute('mis-prestamos') : navigateToRoute('categorias'))}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'mis-prestamos' || route === 'categorias'
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {user ? 'Mi Progreso' : 'Colecciones'}
                </button>
              </nav>
            </div>

            <div className="shrink-0 flex items-center gap-2 sm:gap-3">
              {/* Ruta constante de migas de pan en header */}
              <nav aria-label="Ubicación constante" className="hidden xl:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 sm:mr-2">
                <span>{currentBreadcrumb.section}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{currentBreadcrumb.label}</span>
              </nav>

              {/* Botón selector de tema Claro / Oscuro con icono de Sol (WCAG 2.1/2.2 AA) */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                title={theme === 'dark' ? 'Tema actual: Oscuro (Clic para cambiar a Claro)' : 'Tema actual: Claro (Clic para cambiar a Oscuro)'}
                className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  theme === 'dark'
                    ? 'border-amber-500/40 bg-slate-800/60 backdrop-blur-md text-amber-400 hover:bg-slate-700/70 hover:border-amber-400/60 shadow-xs'
                    : 'border-slate-300/80 bg-white/70 backdrop-blur-md text-amber-600 hover:bg-amber-50/80 hover:border-amber-300 shadow-xs'
                }`}
              >
                <Sun className={`w-5 h-5 transition-transform duration-500 ${theme === 'dark' ? 'rotate-90 text-amber-400 fill-amber-400/20' : 'text-amber-500 fill-amber-500/20'}`} />
                <span className="hidden sm:inline text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {theme === 'dark' ? 'Oscuro' : 'Claro'}
                </span>
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-slate-800 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-700 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 shadow-2xs"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Salir</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="min-h-[44px] px-5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Iniciar Sesión</span>
                </button>
              )}
            </div>
          </header>

          {/* Contenido de la Ruta Activa protegido con ErrorBoundary y Suspense */}
          <main id="main-content" tabIndex={-1} className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none">
            <ErrorBoundary onReset={goToMainScreen}>
              <Suspense
                fallback={
                  <div
                    className="flex flex-col items-center justify-center p-12 min-h-[360px] text-center"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="w-10 h-10 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mb-3" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Cargando módulo de estudio...
                    </p>
                    <span className="sr-only">Cargando vista...</span>
                  </div>
                }
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={route}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {route === 'catalogo' && (
                      <CatalogoView
                        libros={libros}
                        categorias={categorias}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                        onOpenSalas={() => navigateToRoute('salas')}
                        homeResetKey={homeResetKey}
                        loadingInitial={loadingLibros}
                        onSelectLibro={setSelectedLibro}
                        onNotify={notify}
                      />
                    )}

                    {route === 'categorias' && (
                      <CategoriasView
                        categorias={categorias}
                        onExploreCategory={handleJumpToCategory}
                      />
                    )}

                    {route === 'salas' && (
                      <SalasView
                        categorias={categorias}
                        libros={libros}
                        onExploreCategory={handleJumpToCategory}
                        onSelectLibro={setSelectedLibro}
                      />
                    )}

                    {route === 'mostrador' && user?.rol === 'ADMIN' && (
                      <MostradorView
                        libros={libros}
                        onRefreshCatalog={fetchCatalogAndCategories}
                        onNotify={notify}
                      />
                    )}

                    {route === 'mis-prestamos' && user && <MisPrestamosView user={user} />}

                    {route === 'evaluaciones' && (
                      <EvaluacionesView
                        libros={libros}
                        onSelectLibro={setSelectedLibro}
                        user={user}
                      />
                    )}

                    {route === 'admin' && user?.rol === 'ADMIN' && (
                      <AdminView
                        libros={libros}
                        categorias={categorias}
                        onRefreshCatalog={fetchCatalogAndCategories}
                        onNotify={notify}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </ErrorBoundary>
          </main>

          {/* Pie de página accesible con estilo Glass */}
          <footer className="no-print glass-nav !border-b-0 !border-t border-slate-200/70 dark:border-slate-800/60 py-6 px-4 sm:px-6 lg:px-8 mt-auto">
            <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  SGBI · Sistema de Gestión Bibliotecaria y Estudio IA
                </span>
              </div>
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => navigateToRoute('catalogo')}
                  className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                >
                  Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('categorias')}
                  className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                >
                  Categorías
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('salas')}
                  className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                >
                  Salas y Pasillos
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* Modales y Notificaciones diferidas */}
        <Suspense fallback={null}>
          <LibroDetalleModal
            libro={selectedLibro}
            categorias={categorias}
            user={user}
            onClose={() => setSelectedLibro(null)}
            onNotify={notify}
            onPruebaCreated={fetchCatalogAndCategories}
          />

          <LoginModal
            open={loginOpen}
            onClose={() => setLoginOpen(false)}
            onSuccess={handleLoginSuccess}
          />
        </Suspense>

        <ToastBanner toasts={toasts} onDismiss={dismissToast} />

        {/* Botón flotante accesible de configuración universal */}
        <AccessibilityMenu />
      </div>
    </MotionConfig>
  );
}
