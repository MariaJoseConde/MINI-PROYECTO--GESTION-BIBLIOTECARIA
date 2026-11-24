import React, { useEffect, useState } from 'react';
import {
  Edit3,
  FolderPlus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { AdminAuditoriaPanel } from './admin/AdminAuditoriaPanel.tsx';
import { AdminInfraPanel } from './admin/AdminInfraPanel.tsx';
import { apiClient, ApiRequestError } from '../lib/apiClient.ts';
import type {
  Autor,
  Categoria,
  InfraestructuraMetrics,
  Libro,
  LogSistema,
  SearchResponse,
  UserRole,
  UserStatus,
  Usuario,
} from '../types/sgbi.ts';

interface AdminViewProps {
  libros: Libro[];
  categorias: Categoria[];
  onRefreshCatalog: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  libros,
  categorias,
  onRefreshCatalog,
  onNotify,
}) => {
  const [tab, setTab] = useState<
    'inventario' | 'categorias' | 'usuarios' | 'infraestructura' | 'auditoria'
  >('inventario');
  const [autores, setAutores] = useState<Autor[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [infraMetrics, setInfraMetrics] = useState<InfraestructuraMetrics | null>(null);
  const [loadingInfra, setLoadingInfra] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Modal de Crear / Editar Libro
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Libro | null>(null);
  const [isbn, setIsbn] = useState('');
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('Literatura General');
  const [anio, setAnio] = useState('');
  const [editorial, setEditorial] = useState('');
  const [idioma, setIdioma] = useState('Español');
  const [paginas, setPaginas] = useState('');
  const [ubicacionEstante, setUbicacionEstante] = useState('');
  const [temasClave, setTemasClave] = useState('');
  const [copiasTotales, setCopiasTotales] = useState(1);
  const [copiasDisp, setCopiasDisp] = useState(1);
  const [sinopsis, setSinopsis] = useState('');
  const [selectedAutores, setSelectedAutores] = useState<number[]>([]);
  const [savingBook, setSavingBook] = useState(false);

  // Modal de Crear / Editar Categoría
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [catNombre, setCatNombre] = useState('');
  const [catCodigo, setCatCodigo] = useState('800');
  const [catDescripcion, setCatDescripcion] = useState('');
  const [catSala, setCatSala] = useState('Sala General');
  const [catPublico, setCatPublico] = useState('Público general');
  const [catEnfoque, setCatEnfoque] = useState('Lectura integral');
  const [savingCat, setSavingCat] = useState(false);

  // Nuevo Autor rápido
  const [newAutorNombre, setNewAutorNombre] = useState('');
  const [newAutorNac, setNewAutorNac] = useState('');
  const [addingAutor, setAddingAutor] = useState(false);

  // Nuevo Usuario
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newDoc, setNewDoc] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('sgbi2026');
  const [newRol, setNewRol] = useState<UserRole>('LECTOR');
  const [savingUser, setSavingUser] = useState(false);

  // Prueba diagnóstica de resiliencia
  const [testingFallback, setTestingFallback] = useState(false);

  async function loadInfraMetrics() {
    setLoadingInfra(true);
    try {
      const data = await apiClient.get<
        InfraestructuraMetrics | { metrics: InfraestructuraMetrics }
      >('/api/admin/metricas');
      setInfraMetrics('metrics' in data ? data.metrics : data);
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudieron cargar las métricas de infraestructura.',
      );
    } finally {
      setLoadingInfra(false);
    }
  }

  async function loadAdminData() {
    setLoadingAdmin(true);
    setAdminError(null);
    try {
      const [aData, uData, lData, iData] = await Promise.all([
        apiClient.get<{ autores: Autor[] }>('/api/autores'),
        apiClient.get<{ usuarios: Usuario[] }>('/api/usuarios'),
        apiClient.get<{ logs: LogSistema[] }>('/api/admin/auditoria'),
        apiClient.get<InfraestructuraMetrics | { metrics: InfraestructuraMetrics }>(
          '/api/admin/metricas',
        ),
      ]);
      setAutores(aData.autores ?? []);
      setUsuarios(uData.usuarios ?? []);
      setLogs(lData.logs ?? []);
      setInfraMetrics('metrics' in iData ? iData.metrics : iData);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'Error de conexión al cargar datos administrativos.';
      setAdminError(msg);
      onNotify('error', msg);
    } finally {
      setLoadingAdmin(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function handleClearIaCache() {
    await loadInfraMetrics();
    onNotify('info', 'Métricas de servidor y caché actualizadas.');
  }

  function openNewBookModal() {
    setEditingBook(null);
    setIsbn('');
    setTitulo('');
    setCategoria(categorias[0]?.nombre ?? 'Literatura General');
    setAnio('');
    setEditorial('');
    setIdioma('Español');
    setPaginas('');
    setUbicacionEstante('');
    setTemasClave('');
    setCopiasTotales(2);
    setCopiasDisp(2);
    setSinopsis('');
    setSelectedAutores(autores[0] ? [autores[0].id_autor] : []);
    setBookModalOpen(true);
  }

  function openEditBookModal(libro: Libro) {
    setEditingBook(libro);
    setIsbn(libro.isbn);
    setTitulo(libro.titulo);
    setCategoria(libro.categoria);
    setAnio(libro.anio_publicacion ? String(libro.anio_publicacion) : '');
    setEditorial(libro.editorial ?? '');
    setIdioma(libro.idioma ?? 'Español');
    setPaginas(libro.paginas ? String(libro.paginas) : '');
    setUbicacionEstante(libro.ubicacion_estante ?? '');
    setTemasClave(libro.temas_clave ?? '');
    setCopiasTotales(libro.copias_totales);
    setCopiasDisp(libro.copias_disp);
    setSinopsis(libro.sinopsis ?? '');
    setSelectedAutores(libro.autores.map((a) => a.id_autor));
    setBookModalOpen(true);
  }

  function openNewCatModal() {
    setEditingCat(null);
    setCatNombre('');
    setCatCodigo('800');
    setCatDescripcion('');
    setCatSala('Sala General · Nivel 1');
    setCatPublico('Lectores generales y estudiantes');
    setCatEnfoque('Lectura formativa e investigación');
    setCatModalOpen(true);
  }

  function openEditCatModal(cat: Categoria) {
    setEditingCat(cat);
    setCatNombre(cat.nombre);
    setCatCodigo(cat.codigo_archivo);
    setCatDescripcion(cat.descripcion);
    setCatSala(cat.ubicacion_sala);
    setCatPublico(cat.publico_recomendado);
    setCatEnfoque(cat.enfoque_lector);
    setCatModalOpen(true);
  }

  function toggleAutorSelection(idAutor: number) {
    setSelectedAutores((prev) =>
      prev.includes(idAutor) ? prev.filter((id) => id !== idAutor) : [...prev, idAutor],
    );
  }

  async function handleQuickAddAutor() {
    if (!newAutorNombre.trim()) return;
    setAddingAutor(true);
    try {
      const data = await apiClient.post<{ autor?: Autor; error?: string }>('/api/autores', {
        nombre: newAutorNombre,
        nacionalidad: newAutorNac || null,
      });
      if (!data.autor) {
        onNotify('error', data.error || 'No se pudo registrar el autor.');
        return;
      }
      setAutores((prev) => [...prev, data.autor!].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setSelectedAutores((prev) => [...prev, data.autor!.id_autor]);
      setNewAutorNombre('');
      setNewAutorNac('');
      onNotify('success', `Autor "${data.autor.nombre}" agregado.`);
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError ? err.message : 'No se pudo registrar el autor.',
      );
    } finally {
      setAddingAutor(false);
    }
  }

  async function handleSaveBook(e: React.FormEvent) {
    e.preventDefault();
    setSavingBook(true);
    try {
      const url = editingBook ? `/api/libros/${editingBook.id_libro}` : '/api/libros';
      const payload = {
        isbn,
        titulo,
        categoria,
        anio_publicacion: anio ? Number(anio) : null,
        editorial: editorial.trim() || null,
        idioma: idioma.trim() || 'Español',
        paginas: paginas ? Number(paginas) : null,
        ubicacion_estante: ubicacionEstante.trim() || null,
        temas_clave: temasClave.trim() || null,
        copias_totales: Number(copiasTotales),
        copias_disp: Number(copiasDisp),
        sinopsis: sinopsis.trim() || null,
        autor_ids: selectedAutores,
      };
      const data = editingBook
        ? await apiClient.put<{ libro?: Libro; error?: string }>(url, payload)
        : await apiClient.post<{ libro?: Libro; error?: string }>(url, payload);

      if (!data.libro) {
        onNotify('error', data.error || 'Error al guardar el libro.');
        return;
      }
      onNotify('success', editingBook ? 'Libro actualizado correctamente.' : 'Libro creado en catálogo.');
      setBookModalOpen(false);
      onRefreshCatalog();
      loadAdminData();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError ? err.message : 'Error al guardar el libro.',
      );
    } finally {
      setSavingBook(false);
    }
  }

  async function handleSaveCategoria(e: React.FormEvent) {
    e.preventDefault();
    setSavingCat(true);
    try {
      const url = editingCat ? `/api/categorias/${editingCat.id_categoria}` : '/api/categorias';
      const payload = {
        nombre: catNombre,
        codigo_archivo: catCodigo,
        descripcion: catDescripcion,
        ubicacion_sala: catSala,
        publico_recomendado: catPublico,
        enfoque_lector: catEnfoque,
      };
      const data = editingCat
        ? await apiClient.put<{ categoria?: Categoria; error?: string }>(url, payload)
        : await apiClient.post<{ categoria?: Categoria; error?: string }>(url, payload);

      if (!data.categoria) {
        onNotify('error', data.error || 'Error al guardar la categoría.');
        return;
      }
      onNotify(
        'success',
        editingCat ? 'Categoría y descripción actualizadas.' : 'Nueva categoría registrada.',
      );
      setCatModalOpen(false);
      onRefreshCatalog();
      loadAdminData();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError ? err.message : 'Error al guardar la categoría.',
      );
    } finally {
      setSavingCat(false);
    }
  }

  async function handleDeleteBook(libro: Libro) {
    try {
      await apiClient.del<{ ok?: boolean; error?: string }>(`/api/libros/${libro.id_libro}`);
      onNotify('success', `Libro "${libro.titulo}" eliminado del inventario.`);
      onRefreshCatalog();
      loadAdminData();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError
          ? err.message
          : 'Error de red al intentar eliminar el libro.',
      );
    }
  }

  async function handleToggleUserStatus(u: Usuario) {
    const nextStatus: UserStatus = u.estado === 'ACTIVO' ? 'SANCIONADO' : 'ACTIVO';
    try {
      const data = await apiClient.put<{ usuario?: Usuario; error?: string }>(
        `/api/usuarios/${u.id_usuario}`,
        { estado: nextStatus },
      );
      if (!data.usuario) {
        onNotify('error', data.error || 'No se pudo cambiar el estado del usuario.');
        return;
      }
      onNotify(
        'success',
        `Usuario ${data.usuario.nombre_completo} actualizado a estado ${data.usuario.estado}.`,
      );
      loadAdminData();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError ? err.message : 'No se pudo cambiar el estado del usuario.',
      );
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    try {
      const data = await apiClient.post<{ usuario?: Usuario; error?: string }>('/api/usuarios', {
        numero_documento: newDoc,
        nombre_completo: newName,
        email: newEmail,
        password: newPass,
        rol: newRol,
      });
      if (!data.usuario) {
        onNotify('error', data.error || 'No se pudo crear el usuario.');
        return;
      }
      onNotify('success', `Usuario ${data.usuario.nombre_completo} registrado.`);
      setUserModalOpen(false);
      setNewDoc('');
      setNewName('');
      setNewEmail('');
      loadAdminData();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError ? err.message : 'No se pudo crear el usuario.',
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function handleTestFallbackResilience() {
    setTestingFallback(true);
    try {
      const data = await apiClient.post<SearchResponse>('/api/ia/buscar', {
        query: 'totalitarismo vigilancia historia',
        useIa: true,
        simulateFailure: true,
      });
      if (data.mode === 'fallback') {
        onNotify(
          'info',
          `Prueba de resiliencia exitosa: conmutó a SQLite FTS5 (${data.libros.length} resultados en ${data.latencyMs}ms).`,
        );
      }
      loadAdminData();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiRequestError ? err.message : 'No se pudo ejecutar la prueba de fallback.',
      );
    } finally {
      setTestingFallback(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="card-monday p-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#287A65]/12 dark:bg-[#287A65]/25 text-[#287A65] dark:text-[#38a58a] text-xs font-semibold uppercase tracking-wider mb-2.5 border border-[#287A65]/30 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Consola de Administración</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#183B4E] dark:text-white text-balance">
            Gestión de <span className="text-[#287A65] dark:text-[#38a58a] font-bold">inventario, roles y sistema</span>
          </h1>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            Administración centralizada de títulos, clasificaciones CDU, permisos RBAC, infraestructura y auditoría transaccional.
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-[160px] border border-[#183B4E]/15 dark:border-slate-700/70 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md p-1 shadow-2xs self-start">
          {(
            [
              ['inventario', 'Catálogo'],
              ['categorias', 'Categorías'],
              ['usuarios', 'Usuarios'],
              ['infraestructura', 'Infraestructura'],
              ['auditoria', 'Auditoría'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                if (key === 'infraestructura') loadInfraMetrics();
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-[160px] transition-all whitespace-nowrap cursor-pointer ${
                tab === key
                  ? 'bg-[#287A65] text-white shadow-xs font-semibold'
                  : 'text-[#183B4E] dark:text-slate-300 hover:text-[#287A65] dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {adminError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/70 bg-rose-50/80 dark:bg-rose-950/40 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3"
        >
          <span className="text-xs font-medium text-rose-800 dark:text-rose-200">{adminError}</span>
          <button
            type="button"
            onClick={loadAdminData}
            className="btn-outline-pill text-xs py-1 px-3 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {loadingAdmin && (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/60 px-5 py-3 text-xs text-slate-600 dark:text-slate-300" role="status">
          Sincronizando registros administrativos con el servidor...
        </div>
      )}

      {/* TAB 1: INVENTARIO CRUD */}
      {tab === 'inventario' && (
        <section className="card-monday bg-[#ffffff] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#333333] tracking-tight">
                Libros y Autores ({libros.length})
              </h2>
              <p className="text-xs text-[#535768]">
                Unicidad de ISBN y validación CHECK de existencias en SQLite transaccional.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewBookModal}
              className="btn-primary-pill text-xs py-2 px-4.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Libro
            </button>
          </div>

          <div
            className="table-accessible-wrapper w-full focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Directorio de libros y autores del catálogo"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <th className="py-3 px-5">ISBN</th>
                  <th className="py-3 px-5">Título y Autores</th>
                  <th className="py-3 px-5">Categoría</th>
                  <th className="py-3 px-5 text-right">Stock</th>
                  <th className="py-3 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f6f8]">
                {libros.map((l) => (
                  <tr key={l.id_libro} className="hover:bg-[#f5f6f8]/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono tabular-nums text-[#535768] whitespace-nowrap font-medium">
                      {l.isbn}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#333333] text-sm">{l.titulo}</div>
                      <div className="text-[#535768] text-xs">
                        {l.autores.map((a) => a.nombre).join(', ')}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="badge-monday bg-[#287A65]/12 text-[#287A65] font-medium">{l.categoria}</span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono tabular-nums font-semibold">
                      <span className={`badge-monday ${l.copias_disp === 0 ? 'bg-[#fcd0f8] text-[#991B1B]' : 'bg-[#bcfe90] text-[#2a5c4e]'}`}>
                        {l.copias_disp} / {l.copias_totales}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditBookModal(l)}
                          className="btn-outline-pill text-xs py-1 px-3 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(l)}
                          className="btn-outline-pill text-xs py-1 px-3 text-[#991B1B] border-[#fcd0f8] hover:bg-[#fcd0f8]/40 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: CATEGORÍAS Y DESCRIPCIONES */}
      {tab === 'categorias' && (
        <section className="card-monday bg-[#ffffff] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#333333] tracking-tight">
                Categorías y Descripciones ({categorias.length})
              </h2>
              <p className="text-xs text-[#535768]">
                Administre las colecciones temáticas, códigos de clasificación CDU y su descripción curatorial.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewCatModal}
              className="btn-primary-pill text-xs py-2 px-4.5 cursor-pointer shadow-xs"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Nueva Categoría
            </button>
          </div>

          <div
            className="table-accessible-wrapper w-full focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Directorio de categorías y colecciones"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <th className="py-3 px-5">CDU</th>
                  <th className="py-3 px-5">Categoría</th>
                  <th className="py-3 px-5">Descripción</th>
                  <th className="py-3 px-5 text-right">Títulos</th>
                  <th className="py-3 px-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f6f8]">
                {categorias.map((c) => (
                  <tr key={c.id_categoria} className="hover:bg-[#f5f6f8]/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono tabular-nums text-[#535768] whitespace-nowrap">
                      <span className="badge-monday bg-[#183B4E]/10 dark:bg-[#183B4E]/30 text-[#183B4E] dark:text-[#a5c4d4] font-bold">CDU {c.codigo_archivo}</span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[#333333] whitespace-nowrap">
                      {c.nombre}
                    </td>
                    <td className="py-3.5 px-5 text-[#535768] max-w-md">{c.descripcion}</td>
                    <td className="py-3.5 px-5 text-right font-mono tabular-nums font-bold text-[#333333]">
                      {c.libros_count ?? 0}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => openEditCatModal(c)}
                        className="btn-outline-pill text-xs py-1 px-3 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: USUARIOS Y SANCIONES */}
      {tab === 'usuarios' && (
        <section className="card-monday bg-[#ffffff] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d0d4e4] bg-[#f5f6f8] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#333333] tracking-tight">
                Directorio de Usuarios RBAC ({usuarios.length})
              </h2>
              <p className="text-xs text-[#535768]">
                Gestione perfiles y habilite lectores rehabilitados tras devolución de mora.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUserModalOpen(true)}
              className="btn-primary-pill text-xs py-2 px-4.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Registrar Usuario
            </button>
          </div>

          <div
            className="table-accessible-wrapper w-full focus:outline-none"
            tabIndex={0}
            role="region"
            aria-label="Directorio de usuarios registrados"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <th className="py-3 px-5">Documento</th>
                  <th className="py-3 px-5">Nombre completo</th>
                  <th className="py-3 px-5">Correo</th>
                  <th className="py-3 px-5">Rol</th>
                  <th className="py-3 px-5">Estado</th>
                  <th className="py-3 px-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f6f8]">
                {usuarios.map((u) => (
                  <tr key={u.id_usuario} className="hover:bg-[#f5f6f8]/80 transition-colors">
                    <td className="py-3.5 px-5 font-mono tabular-nums text-[#535768]">
                      {u.numero_documento}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[#333333]">{u.nombre_completo}</td>
                    <td className="py-3.5 px-5 font-mono text-[#535768]">{u.email}</td>
                    <td className="py-3.5 px-5">
                      <span className="badge-monday bg-[#287A65]/12 text-[#287A65] font-bold">{u.rol}</span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold">
                      {u.estado === 'SANCIONADO' ? (
                        <span className="badge-monday bg-[#fcd0f8] text-[#991B1B]">SANCIONADO</span>
                      ) : (
                        <span className="badge-monday bg-[#bcfe90] text-[#2a5c4e]">ACTIVO</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleUserStatus(u)}
                        className={`btn-outline-pill text-xs py-1 px-3 cursor-pointer ${
                          u.estado === 'SANCIONADO'
                            ? 'text-[#2a5c4e] border-[#bcfe90] hover:bg-[#bcfe90]/30'
                            : 'text-[#991B1B] border-[#fcd0f8] hover:bg-[#fcd0f8]/30'
                        }`}
                      >
                        {u.estado === 'SANCIONADO' ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Reactivar lector
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Sancionar
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: INFRAESTRUCTURA Y RESPALDOS */}
      {tab === 'infraestructura' && (
        <AdminInfraPanel
          metrics={infraMetrics}
          loading={loadingInfra}
          onRefresh={loadInfraMetrics}
          onClearCache={handleClearIaCache}
        />
      )}

      {/* TAB 5: AUDITORÍA Y RESILIENCIA */}
      {tab === 'auditoria' && (
        <AdminAuditoriaPanel
          logs={logs}
          testingFallback={testingFallback}
          onTestFallback={handleTestFallbackResilience}
        />
      )}

      {/* MODAL CREAR / EDITAR LIBRO */}
      {bookModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl glass-modal rounded-[24px] border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#d0d4e4] bg-[#ffffff] px-6 py-4">
              <h3 className="text-lg font-bold text-[#333333]">
                {editingBook ? `Editar Libro: ${editingBook.titulo}` : 'Registrar Nuevo Libro'}
              </h3>
              <button
                type="button"
                onClick={() => setBookModalOpen(false)}
                className="p-1.5 rounded-full text-[#535768] hover:bg-[#f5f6f8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="p-6 sm:p-8 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">ISBN *</label>
                  <input
                    type="text"
                    required
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978-..."
                    className="w-full input-monday font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Año de publicación
                  </label>
                  <input
                    type="number"
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    placeholder="1984"
                    className="w-full input-monday font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Título de la obra *
                  </label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full input-monday"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Categoría *
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full input-monday bg-white cursor-pointer"
                  >
                    {categorias.map((c) => (
                      <option key={c.id_categoria} value={c.nombre}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Editorial / Edición
                  </label>
                  <input
                    type="text"
                    value={editorial}
                    onChange={(e) => setEditorial(e.target.value)}
                    placeholder="Alianza Editorial"
                    className="w-full input-monday"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Idioma
                  </label>
                  <input
                    type="text"
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value)}
                    placeholder="Español"
                    className="w-full input-monday"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Páginas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={paginas}
                    onChange={(e) => setPaginas(e.target.value)}
                    placeholder="320"
                    className="w-full input-monday font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Ubicación física (Estante)
                  </label>
                  <input
                    type="text"
                    value={ubicacionEstante}
                    onChange={(e) => setUbicacionEstante(e.target.value)}
                    placeholder="Sala A · Estante 01 · Nivel 2"
                    className="w-full input-monday font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Temas clave (separados por coma)
                  </label>
                  <input
                    type="text"
                    value={temasClave}
                    onChange={(e) => setTemasClave(e.target.value)}
                    placeholder="Vigilancia, Memoria, Libertad"
                    className="w-full input-monday"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Copias totales *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={copiasTotales}
                    onChange={(e) => setCopiasTotales(Number(e.target.value))}
                    className="w-full input-monday font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Copias disponibles *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={copiasTotales}
                    required
                    value={copiasDisp}
                    onChange={(e) => setCopiasDisp(Number(e.target.value))}
                    className="w-full input-monday font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#535768] mb-1.5">
                  Autores asociados *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto rounded-[12px] border border-[#d0d4e4] p-3 bg-[#f5f6f8]">
                  {autores.map((a) => (
                    <label
                      key={a.id_autor}
                      className="flex items-center gap-2 text-xs text-[#333333] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAutores.includes(a.id_autor)}
                        onChange={() => toggleAutorSelection(a.id_autor)}
                        className="rounded text-[#287A65] focus:ring-[#287A65]"
                      />
                      <span className="truncate">{a.nombre}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newAutorNombre}
                    onChange={(e) => setNewAutorNombre(e.target.value)}
                    placeholder="Nuevo autor..."
                    className="flex-1 min-w-[140px] input-monday py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={newAutorNac}
                    onChange={(e) => setNewAutorNac(e.target.value)}
                    placeholder="Nacionalidad"
                    className="w-32 input-monday py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={addingAutor || !newAutorNombre.trim()}
                    onClick={handleQuickAddAutor}
                    className="btn-outline-pill text-xs py-1.5 px-3 disabled:opacity-50 cursor-pointer"
                  >
                    + Añadir autor
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#535768] mb-1">
                  Sinopsis descriptiva (habilita búsqueda IA y pruebas de lectura)
                </label>
                <textarea
                  rows={4}
                  value={sinopsis}
                  onChange={(e) => setSinopsis(e.target.value)}
                  placeholder="Resumen temático y argumentos centrales de la obra..."
                  className="w-full input-monday"
                />
              </div>

              <div className="pt-4 border-t border-[#d0d4e4] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setBookModalOpen(false)}
                  className="btn-outline-pill text-xs py-2 px-4 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBook}
                  className="btn-primary-pill text-xs py-2 px-5 disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  {savingBook ? 'Guardando...' : 'Guardar Libro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR CATEGORÍA */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md glass-modal rounded-[24px] border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#d0d4e4] bg-[#ffffff] px-6 py-4">
              <h3 className="text-lg font-bold text-[#333333]">
                {editingCat ? `Editar Categoría: ${editingCat.nombre}` : 'Nueva Categoría'}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1.5 rounded-full text-[#535768] hover:bg-[#f5f6f8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategoria} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Nombre de categoría *
                  </label>
                  <input
                    type="text"
                    required
                    value={catNombre}
                    onChange={(e) => setCatNombre(e.target.value)}
                    placeholder="Ensayo Contemporáneo"
                    className="w-full input-monday"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Código CDU
                  </label>
                  <input
                    type="text"
                    value={catCodigo}
                    onChange={(e) => setCatCodigo(e.target.value)}
                    placeholder="804"
                    className="w-full input-monday font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#535768] mb-1">
                  Descripción curatorial *
                </label>
                <textarea
                  rows={3}
                  required
                  value={catDescripcion}
                  onChange={(e) => setCatDescripcion(e.target.value)}
                  placeholder="Descripción temática de los volúmenes agrupados en esta colección..."
                  className="w-full input-monday"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Ubicación en sala
                  </label>
                  <input
                    type="text"
                    value={catSala}
                    onChange={(e) => setCatSala(e.target.value)}
                    className="w-full input-monday font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Público recomendado
                  </label>
                  <input
                    type="text"
                    value={catPublico}
                    onChange={(e) => setCatPublico(e.target.value)}
                    className="w-full input-monday"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#535768] mb-1">
                  Enfoque de lectura
                </label>
                <input
                  type="text"
                  value={catEnfoque}
                  onChange={(e) => setCatEnfoque(e.target.value)}
                  className="w-full input-monday"
                />
              </div>
              <div className="pt-4 border-t border-[#d0d4e4] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="btn-outline-pill text-xs py-2 px-4 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="btn-primary-pill text-xs py-2 px-5 cursor-pointer shadow-xs"
                >
                  {savingCat ? 'Guardando...' : 'Guardar Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR USUARIO */}
      {userModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md glass-modal rounded-[24px] border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#d0d4e4] bg-[#ffffff] px-6 py-4">
              <h3 className="text-lg font-bold text-[#333333]">
                Registrar Nuevo Usuario
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-full text-[#535768] hover:bg-[#f5f6f8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#535768] mb-1">
                  Número de documento *
                </label>
                <input
                  type="text"
                  required
                  value={newDoc}
                  onChange={(e) => setNewDoc(e.target.value)}
                  className="w-full input-monday font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#535768] mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full input-monday"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#535768] mb-1">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full input-monday"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">Rol *</label>
                  <select
                    value={newRol}
                    onChange={(e) => setNewRol(e.target.value as UserRole)}
                    className="w-full input-monday bg-white cursor-pointer"
                  >
                    <option value="LECTOR">LECTOR</option>
                    <option value="DOCENTE">DOCENTE</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#535768] mb-1">
                    Contraseña inicial *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full input-monday font-mono"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-[#d0d4e4] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="btn-outline-pill text-xs py-2 px-4 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="btn-primary-pill text-xs py-2 px-5 cursor-pointer shadow-xs"
                >
                  {savingUser ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
