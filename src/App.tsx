/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AdminView } from './components/AdminView.tsx';
import { CatalogoView } from './components/CatalogoView.tsx';
import { CategoriasView } from './components/CategoriasView.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { EvaluacionesView } from './components/EvaluacionesView.tsx';
import { LibroDetalleModal } from './components/LibroDetalleModal.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { MisPrestamosView } from './components/MisPrestamosView.tsx';
import { MostradorView } from './components/MostradorView.tsx';
import { SalasView } from './components/SalasView.tsx';
import { ToastBanner, type ToastMessage } from './components/ToastBanner.tsx';
import { apiClient } from './lib/apiClient.ts';
import type { Categoria, Libro, Usuario } from './types/sgbi.ts';

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
    <div className="flex flex-col h-full bg-white">
      {/* Brand Header */}
      <div className="px-5 h-16 min-h-16 flex items-center justify-between border-b border-slate-200 shrink-0 bg-white">
        <button
          type="button"
          onClick={goToMainScreen}
          className="min-h-[44px] flex items-center gap-2.5 font-sans text-base font-bold tracking-tight text-slate-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            S
          </div>
          <span className="font-bold text-slate-900">SGBI <span className="text-indigo-600 font-semibold">· Estudio IA</span></span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          aria-label="Cerrar menú lateral"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navegación Lateral Estructurada en 3 Secciones */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Sección 1: Explorar */}
        <nav aria-label="Explorar biblioteca" className="space-y-1.5">
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
            Explorar
          </div>
          <button
            type="button"
            onClick={goToMainScreen}
            className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              route === 'catalogo' && selectedCategory === 'Todas'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
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
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
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
          <nav aria-label="Operación y cuenta" className="pt-4 border-t border-slate-200 space-y-1.5">
            <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
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
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
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
        <div className="pt-4 border-t border-slate-200 space-y-1">
          <div className="px-3 pb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Colecciones
            </span>
            <button
              type="button"
              onClick={() => navigateToRoute('categorias')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
            >
              Ver todas
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleJumpToCategory('Todas')}
            className={`w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              route === 'catalogo' && selectedCategory === 'Todas'
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <span className="truncate">Todas las colecciones</span>
            <span className="font-mono text-xs tabular-nums text-slate-600">
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
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <span className="truncate">{cat.nombre}</span>
                <span className="font-mono text-xs tabular-nums text-slate-600 shrink-0">
                  {cat.libros_count ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pie de barra lateral: Cuenta y Sesión */}
      <div className="p-4 border-t border-slate-200 bg-white shrink-0">
        {user ? (
          <div className="space-y-3">
            <div className="px-1 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0 border border-indigo-200">
                {user.nombre_completo.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {user.nombre_completo}
                </div>
                <div className="text-xs text-slate-600 truncate">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mr-1.5">
                    {user.rol}
                  </span>
                  {user.estado}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full min-h-[44px] rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
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

      <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
        {/* Barra Lateral Izquierda (Escritorio) */}
        <aside className="no-print hidden lg:flex lg:flex-col lg:w-68 lg:shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen shadow-xs">
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
                className="fixed inset-0 bg-slate-900/50"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-72 max-w-[85vw] bg-white border-r border-slate-200 h-full z-10 shadow-2xl"
              >
                {renderSidebarContent()}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Área Principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Sólido y Proporcionado (WCAG 2.1/2.2 AA) */}
          <header className="no-print sticky top-0 z-30 min-h-16 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 cursor-pointer"
                aria-label="Abrir navegación lateral"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Marca y Navegación Predecible (3 o 4 opciones esenciales) */}
              <button
                type="button"
                onClick={goToMainScreen}
                className="min-h-[44px] flex items-center gap-2 font-sans text-base font-bold tracking-tight text-slate-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md shrink-0 mr-1"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  S
                </div>
                <span className="font-bold text-slate-900 hidden sm:inline">
                  SGBI <span className="text-indigo-600 font-semibold">· Estudio IA</span>
                </span>
              </button>

              <nav aria-label="Navegación principal de estudio" className="hidden md:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigateToRoute('catalogo')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'catalogo'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  Mis Temas
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('evaluaciones')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'evaluaciones'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  Práctica e IA
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('salas')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'salas'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  Salas
                </button>
                <button
                  type="button"
                  onClick={() => (user ? navigateToRoute('mis-prestamos') : navigateToRoute('categorias'))}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    route === 'mis-prestamos' || route === 'categorias'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  {user ? 'Mi Progreso' : 'Colecciones'}
                </button>
              </nav>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              {/* Ruta constante de migas de pan en header */}
              <nav aria-label="Ubicación constante" className="hidden xl:flex items-center gap-2 text-xs font-medium text-slate-500 mr-2">
                <span>{currentBreadcrumb.section}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-900">{currentBreadcrumb.label}</span>
              </nav>

              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[44px] px-4 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Salir</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="min-h-[44px] px-5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Iniciar Sesión</span>
                </button>
              )}
            </div>
          </header>

          {/* Contenido de la Ruta Activa protegido con ErrorBoundary */}
          <main id="main-content" tabIndex={-1} className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none">
            <ErrorBoundary onReset={goToMainScreen}>
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
            </ErrorBoundary>
          </main>

          {/* Pie de página accesible */}
          <footer className="no-print border-t border-slate-200 bg-white py-6 px-4 sm:px-6 lg:px-8 mt-auto">
            <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                <span className="font-medium text-slate-700">
                  SGBI · Sistema de Gestión Bibliotecaria y Estudio IA
                </span>
              </div>
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => navigateToRoute('catalogo')}
                  className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                >
                  Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('categorias')}
                  className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                >
                  Categorías
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('salas')}
                  className="min-h-[44px] inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
                >
                  Salas y Pasillos
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* Modales y Notificaciones */}
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

        <ToastBanner toasts={toasts} onDismiss={dismissToast} />
      </div>
    </MotionConfig>
  );
}
