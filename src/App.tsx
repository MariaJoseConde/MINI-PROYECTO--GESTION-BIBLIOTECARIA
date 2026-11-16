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
  catalogo: { section: 'Acervo', label: 'Catálogo Bibliográfico' },
  categorias: { section: 'Acervo', label: 'Categorías y Colecciones' },
  salas: { section: 'Orientación', label: 'Salas y Pasillos' },
  mostrador: { section: 'Circulación', label: 'Mostrador de Préstamos' },
  'mis-prestamos': { section: 'Cuenta', label: 'Mis Préstamos' },
  evaluaciones: { section: 'Pedagogía', label: 'Evaluaciones IA' },
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
    { id: 'catalogo', label: 'Catálogo', icon: BookOpen },
    { id: 'categorias', label: 'Categorías', icon: Layers },
    { id: 'salas', label: 'Salas y Pasillos', icon: MapIcon },
  ];

  const accountItems: Array<{
    id: ActiveRoute;
    label: string;
    icon: typeof BookOpen;
    visible: boolean;
  }> = [
    {
      id: 'mis-prestamos',
      label: 'Mis Préstamos',
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
      id: 'evaluaciones',
      label: 'Evaluaciones',
      icon: FileCheck2,
      visible: user?.rol === 'DOCENTE' || user?.rol === 'ADMIN',
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
    <div className="flex flex-col h-full bg-[#ffffff]">
      {/* Brand Wordmark with Monday.com Conic Prism Mark */}
      <div className="px-5 h-16 flex items-center justify-between border-b border-[#d0d4e4] shrink-0">
        <button
          type="button"
          onClick={goToMainScreen}
          className="flex items-center gap-2.5 font-sans text-lg font-bold tracking-tight text-[#333333] whitespace-nowrap cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-full prism-mark-circle shrink-0 shadow-sm flex items-center justify-center p-0.5 transition-transform duration-300 group-hover:rotate-45">
            <div className="w-full h-full rounded-full bg-[#ffffff]/30 backdrop-blur-[1px]" />
          </div>
          <span className="font-bold text-[#333333]">SGBI <span className="text-[#6161ff] font-medium">· Acervo</span></span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-full text-[#535768] hover:bg-[#f5f6f8]"
          aria-label="Cerrar menú lateral"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navegación Lateral Estructurada en 3 Secciones */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Sección 1: Explorar */}
        <nav aria-label="Explorar biblioteca" className="space-y-1.5">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#535768]">
            Explorar
          </div>
          <button
            type="button"
            onClick={goToMainScreen}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-[160px] text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
              route === 'catalogo' && selectedCategory === 'Todas'
                ? 'bg-[#6161ff] text-white shadow-sm font-semibold'
                : 'text-[#535768] hover:bg-[#e7ecff] hover:text-[#333333]'
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
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-[160px] text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#6161ff] text-white shadow-sm font-semibold'
                    : 'text-[#535768] hover:bg-[#e7ecff] hover:text-[#333333]'
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
          <nav aria-label="Operación y cuenta" className="pt-4 border-t border-[#d0d4e4] space-y-1.5">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#535768]">
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
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-[160px] text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#6161ff] text-white shadow-sm font-semibold'
                      : 'text-[#535768] hover:bg-[#e7ecff] hover:text-[#333333]'
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
        <div className="pt-4 border-t border-[#d0d4e4] space-y-1">
          <div className="px-3 pb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#535768]">
              Colecciones
            </span>
            <button
              type="button"
              onClick={() => navigateToRoute('categorias')}
              className="text-[11px] font-medium text-[#6161ff] hover:underline underline-offset-2 cursor-pointer"
            >
              Ver todas
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleJumpToCategory('Todas')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-[6px] text-xs transition-colors cursor-pointer ${
              route === 'catalogo' && selectedCategory === 'Todas'
                ? 'bg-[#e7ecff] text-[#6161ff] font-semibold'
                : 'text-[#535768] hover:bg-[#f5f6f8] hover:text-[#333333]'
            }`}
          >
            <span className="truncate">Todas las colecciones</span>
            <span className="font-mono text-[11px] tabular-nums text-[#808080]">
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
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-[6px] text-xs transition-colors cursor-pointer ${
                  isActiveCat
                    ? 'bg-[#e7ecff] text-[#6161ff] font-semibold'
                    : 'text-[#535768] hover:bg-[#f5f6f8] hover:text-[#333333]'
                }`}
              >
                <span className="truncate">{cat.nombre}</span>
                <span className="font-mono text-[11px] tabular-nums text-[#808080] shrink-0">
                  {cat.libros_count ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pie de barra lateral: Cuenta y Sesión */}
      <div className="p-4 border-t border-[#d0d4e4] bg-[#ffffff] shrink-0">
        {user ? (
          <div className="space-y-3">
            <div className="px-1 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#eddff7] text-[#6161ff] font-bold text-xs flex items-center justify-center shrink-0 border border-[#6161ff]/20">
                {user.nombre_completo.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#333333] truncate">
                  {user.nombre_completo}
                </div>
                <div className="text-[11px] text-[#535768] truncate">
                  <span className="badge-monday bg-[#dbdbff] text-[#6161ff] text-[10px] py-0 px-1.5 mr-1 font-semibold">{user.rol}</span>
                  {user.estado}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full btn-outline-pill py-2 text-xs font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
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
            className="w-full btn-primary-pill py-2.5 text-xs font-medium shadow-sm cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            Iniciar Sesión
          </button>
        )}
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex bg-[#f5f6f8] text-[#333333] font-sans">
        {/* Barra Lateral Izquierda (Escritorio) */}
        <aside className="no-print hidden lg:flex lg:flex-col lg:w-68 lg:shrink-0 border-r border-[#d0d4e4] bg-[#ffffff] sticky top-0 h-screen shadow-sm">
          {renderSidebarContent()}
        </aside>

        {/* Drawer Lateral Móvil */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="no-print fixed inset-0 z-50 lg:hidden flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-72 max-w-[85vw] bg-[#ffffff] border-r border-[#d0d4e4] h-full z-10 shadow-2xl"
              >
                {renderSidebarContent()}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Área Principal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar contextual monday style */}
          <header className="no-print sticky top-0 z-30 h-16 border-b border-[#d0d4e4] bg-[#ffffff]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-full border border-[#d0d4e4] bg-[#ffffff] text-[#333333] hover:bg-[#f5f6f8]"
                aria-label="Abrir navegación lateral"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-xs text-[#535768] truncate">
                <span className="font-medium text-[#535768]">{currentBreadcrumb.section}</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#808080]" />
                <span className="font-semibold text-[#333333] truncate">
                  {currentBreadcrumb.label}
                </span>
                {route === 'catalogo' && selectedCategory !== 'Todas' && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#808080]" />
                    <span className="badge-monday bg-[#dbdbff] text-[#6161ff] font-semibold truncate">
                      {selectedCategory}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2.5">
              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-outline-pill text-xs py-1.5 px-4 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Salir
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="btn-primary-pill text-xs py-2 px-5 cursor-pointer shadow-sm"
                >
                  Iniciar Sesión
                </button>
              )}
            </div>
          </header>

          {/* Contenido de la Ruta Activa protegido con ErrorBoundary */}
          <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

                  {route === 'evaluaciones' &&
                    (user?.rol === 'DOCENTE' || user?.rol === 'ADMIN') && (
                      <EvaluacionesView libros={libros} onSelectLibro={setSelectedLibro} />
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

          {/* Pie de página monday style */}
          <footer className="no-print border-t border-[#d0d4e4] bg-[#ffffff] py-6 px-4 sm:px-6 lg:px-8 mt-auto">
            <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#535768]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full prism-mark-circle shrink-0" />
                <span>
                  SGBI · Sistema de Gestión Bibliotecaria Inteligente
                </span>
              </div>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => navigateToRoute('catalogo')}
                  className="hover:text-[#6161ff] transition-colors cursor-pointer"
                >
                  Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('categorias')}
                  className="hover:text-[#6161ff] transition-colors cursor-pointer"
                >
                  Categorías
                </button>
                <button
                  type="button"
                  onClick={() => navigateToRoute('salas')}
                  className="hover:text-[#6161ff] transition-colors cursor-pointer"
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
