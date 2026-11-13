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
      const res = await fetch('/api/admin/infraestructura');
      if (res.ok) {
        const data = (await res.json()) as { metrics: InfraestructuraMetrics };
        setInfraMetrics(data.metrics);
      }
    } finally {
      setLoadingInfra(false);
    }
  }

  async function loadAdminData() {
    const [aRes, uRes, lRes, iRes] = await Promise.all([
      fetch('/api/autores'),
      fetch('/api/usuarios'),
      fetch('/api/logs'),
      fetch('/api/admin/infraestructura'),
    ]);
    if (aRes.ok) {
      const aData = (await aRes.json()) as { autores: Autor[] };
      setAutores(aData.autores);
    }
    if (uRes.ok) {
      const uData = (await uRes.json()) as { usuarios: Usuario[] };
      setUsuarios(uData.usuarios);
    }
    if (lRes.ok) {
      const lData = (await lRes.json()) as { logs: LogSistema[] };
      setLogs(lData.logs);
    }
    if (iRes.ok) {
      const iData = (await iRes.json()) as { metrics: InfraestructuraMetrics };
      setInfraMetrics(iData.metrics);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function handleClearIaCache() {
    const res = await fetch('/api/admin/cache/limpiar', { method: 'POST' });
    if (res.ok) {
      onNotify('success', 'Caché semántica de búsqueda limpiada correctamente.');
      loadInfraMetrics();
      loadAdminData();
    } else {
      onNotify('error', 'No se pudo limpiar la caché.');
    }
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
      const res = await fetch('/api/autores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newAutorNombre, nacionalidad: newAutorNac || null }),
      });
      const data = (await res.json()) as { autor?: Autor; error?: string };
      if (!res.ok || !data.autor) {
        onNotify('error', data.error || 'No se pudo registrar el autor.');
        return;
      }
      setAutores((prev) => [...prev, data.autor!].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setSelectedAutores((prev) => [...prev, data.autor!.id_autor]);
      setNewAutorNombre('');
      setNewAutorNac('');
      onNotify('success', `Autor "${data.autor.nombre}" agregado.`);
    } finally {
      setAddingAutor(false);
    }
  }

  async function handleSaveBook(e: React.FormEvent) {
    e.preventDefault();
    setSavingBook(true);
    try {
      const url = editingBook ? `/api/libros/${editingBook.id_libro}` : '/api/libros';
      const method = editingBook ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const data = (await res.json()) as { libro?: Libro; error?: string };
      if (!res.ok || !data.libro) {
        onNotify('error', data.error || 'Error al guardar el libro.');
        return;
      }
      onNotify('success', editingBook ? 'Libro actualizado correctamente.' : 'Libro creado en catálogo.');
      setBookModalOpen(false);
      onRefreshCatalog();
      loadAdminData();
    } finally {
      setSavingBook(false);
    }
  }

  async function handleSaveCategoria(e: React.FormEvent) {
    e.preventDefault();
    setSavingCat(true);
    try {
      const url = editingCat ? `/api/categorias/${editingCat.id_categoria}` : '/api/categorias';
      const method = editingCat ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: catNombre,
          codigo_archivo: catCodigo,
          descripcion: catDescripcion,
          ubicacion_sala: catSala,
          publico_recomendado: catPublico,
          enfoque_lector: catEnfoque,
        }),
      });
      const data = (await res.json()) as { categoria?: Categoria; error?: string };
      if (!res.ok || !data.categoria) {
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
    } finally {
      setSavingCat(false);
    }
  }

  async function handleDeleteBook(libro: Libro) {
    try {
      const res = await fetch(`/api/libros/${libro.id_libro}`, { method: 'DELETE' });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        onNotify('error', data.error || 'No fue posible eliminar el libro.');
        return;
      }
      onNotify('success', `Libro "${libro.titulo}" eliminado del inventario.`);
      onRefreshCatalog();
      loadAdminData();
    } catch {
      onNotify('error', 'Error de red al intentar eliminar el libro.');
    }
  }

  async function handleToggleUserStatus(u: Usuario) {
    const nextStatus: UserStatus = u.estado === 'ACTIVO' ? 'SANCIONADO' : 'ACTIVO';
    const res = await fetch(`/api/usuarios/${u.id_usuario}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nextStatus }),
    });
    const data = (await res.json()) as { usuario?: Usuario; error?: string };
    if (!res.ok || !data.usuario) {
      onNotify('error', data.error || 'No se pudo cambiar el estado del usuario.');
      return;
    }
    onNotify(
      'success',
      `Usuario ${data.usuario.nombre_completo} actualizado a estado ${data.usuario.estado}.`,
    );
    loadAdminData();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_documento: newDoc,
          nombre_completo: newName,
          email: newEmail,
          password: newPass,
          rol: newRol,
        }),
      });
      const data = (await res.json()) as { usuario?: Usuario; error?: string };
      if (!res.ok || !data.usuario) {
        onNotify('error', data.error || 'No se pudo crear el usuario.');
        return;
      }
      onNotify('success', `Usuario ${data.usuario.nombre_completo} registrado.`);
      setUserModalOpen(false);
      setNewDoc('');
      setNewName('');
      setNewEmail('');
      loadAdminData();
    } finally {
      setSavingUser(false);
    }
  }

  async function handleTestFallbackResilience() {
    setTestingFallback(true);
    try {
      const res = await fetch('/api/ia/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'totalitarismo vigilancia historia',
          useIa: true,
          simulateFailure: true,
        }),
      });
      const data = (await res.json()) as SearchResponse;
      if (data.mode === 'fallback') {
        onNotify(
          'info',
          `Prueba de resiliencia exitosa: conmutó a SQLite FTS5 (${data.libros.length} resultados en ${data.latencyMs}ms).`,
        );
      }
      loadAdminData();
    } finally {
      setTestingFallback(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-[#E7E2D8] pb-5">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-[#78716C]">
            Consola Administrativa
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1C1917]">
            Inventario, Categorías, Usuarios y Auditoría
          </h1>
        </div>

        <div className="inline-flex flex-wrap rounded-md border border-[#D6CEBE] bg-[#F3EFE7] p-0.5 self-start">
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
              className={`px-3.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                tab === key
                  ? 'bg-[#FFFFFF] text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: INVENTARIO CRUD */}
      {tab === 'inventario' && (
        <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                Libros y Autores ({libros.length})
              </h2>
              <p className="text-xs text-[#57534E]">
                Unicidad de ISBN y validación CHECK de existencias en SQLite transaccional.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewBookModal}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Libro
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E7E2D8] text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                  <th className="py-3 px-5">ISBN</th>
                  <th className="py-3 px-5">Título y Autores</th>
                  <th className="py-3 px-5">Categoría</th>
                  <th className="py-3 px-5 text-right">Stock</th>
                  <th className="py-3 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EFE7]">
                {libros.map((l) => (
                  <tr key={l.id_libro} className="hover:bg-[#FBF9F5]">
                    <td className="py-3 px-5 font-mono tabular-nums text-[#57534E] whitespace-nowrap">
                      {l.isbn}
                    </td>
                    <td className="py-3 px-5">
                      <div className="font-semibold text-[#1C1917]">{l.titulo}</div>
                      <div className="text-[#57534E]">
                        {l.autores.map((a) => a.nombre).join(', ')}
                      </div>
                    </td>
                    <td className="py-3 px-5 text-[#57534E]">{l.categoria}</td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold">
                      <span className={l.copias_disp === 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'}>
                        {l.copias_disp}
                      </span>
                      <span className="text-[#78716C]"> / {l.copias_totales}</span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditBookModal(l)}
                          className="inline-flex items-center gap-1 rounded border border-[#D6CEBE] px-2.5 py-1 text-xs font-medium text-[#1C1917] hover:bg-[#F3EFE7]"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(l)}
                          className="inline-flex items-center gap-1 rounded border border-[#B91C1C]/30 px-2.5 py-1 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
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
        <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                Categorías y Descripciones ({categorias.length})
              </h2>
              <p className="text-xs text-[#57534E]">
                Administre las colecciones temáticas, códigos de clasificación CDU y su descripción curatorial.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewCatModal}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554] transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Nueva Categoría
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E7E2D8] text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                  <th className="py-3 px-5">CDU</th>
                  <th className="py-3 px-5">Categoría</th>
                  <th className="py-3 px-5">Descripción</th>
                  <th className="py-3 px-5 text-right">Títulos</th>
                  <th className="py-3 px-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EFE7]">
                {categorias.map((c) => (
                  <tr key={c.id_categoria} className="hover:bg-[#FBF9F5]">
                    <td className="py-3 px-5 font-mono tabular-nums text-[#57534E] whitespace-nowrap">
                      {c.codigo_archivo}
                    </td>
                    <td className="py-3 px-5 font-semibold text-[#1C1917] whitespace-nowrap">
                      {c.nombre}
                    </td>
                    <td className="py-3 px-5 text-[#57534E] max-w-md">{c.descripcion}</td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-[#1C1917]">
                      {c.libros_count ?? 0}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => openEditCatModal(c)}
                        className="inline-flex items-center gap-1 rounded border border-[#D6CEBE] px-2.5 py-1 text-xs font-medium text-[#1C1917] hover:bg-[#F3EFE7]"
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
        <section className="rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E7E2D8] bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                Directorio de Usuarios RBAC ({usuarios.length})
              </h2>
              <p className="text-xs text-[#57534E]">
                Gestione perfiles y habilite lectores rehabilitados tras devolución de mora.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUserModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554] transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Registrar Usuario
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E7E2D8] text-[11px] font-semibold uppercase tracking-wider text-[#57534E]">
                  <th className="py-3 px-5">Documento</th>
                  <th className="py-3 px-5">Nombre completo</th>
                  <th className="py-3 px-5">Correo</th>
                  <th className="py-3 px-5">Rol</th>
                  <th className="py-3 px-5">Estado</th>
                  <th className="py-3 px-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EFE7]">
                {usuarios.map((u) => (
                  <tr key={u.id_usuario} className="hover:bg-[#FBF9F5]">
                    <td className="py-3 px-5 font-mono tabular-nums text-[#57534E]">
                      {u.numero_documento}
                    </td>
                    <td className="py-3 px-5 font-semibold text-[#1C1917]">{u.nombre_completo}</td>
                    <td className="py-3 px-5 font-mono text-[#57534E]">{u.email}</td>
                    <td className="py-3 px-5 font-mono font-medium text-[#1C1917]">{u.rol}</td>
                    <td className="py-3 px-5 font-semibold">
                      {u.estado === 'SANCIONADO' ? (
                        <span className="text-[#B91C1C]">SANCIONADO</span>
                      ) : (
                        <span className="text-[#15803D]">ACTIVO</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleUserStatus(u)}
                        className={`inline-flex items-center gap-1.5 rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                          u.estado === 'SANCIONADO'
                            ? 'border-[#15803D]/35 text-[#15803D] hover:bg-[#F0FDF4]'
                            : 'border-[#B91C1C]/35 text-[#B91C1C] hover:bg-[#FEF2F2]'
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] shadow-xl overflow-hidden my-auto">
            <div className="flex items-center justify-between border-b border-[#E7E2D8] bg-[#FBF9F5] px-6 py-4">
              <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                {editingBook ? `Editar Libro: ${editingBook.titulo}` : 'Registrar Nuevo Libro'}
              </h3>
              <button
                type="button"
                onClick={() => setBookModalOpen(false)}
                className="p-1 rounded text-[#57534E] hover:bg-[#EBE6DF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">ISBN *</label>
                  <input
                    type="text"
                    required
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978-..."
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Año de publicación
                  </label>
                  <input
                    type="number"
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    placeholder="1984"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Título de la obra *
                  </label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Categoría *
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm bg-white"
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
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Editorial / Edición
                  </label>
                  <input
                    type="text"
                    value={editorial}
                    onChange={(e) => setEditorial(e.target.value)}
                    placeholder="Alianza Editorial"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Idioma
                  </label>
                  <input
                    type="text"
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value)}
                    placeholder="Español"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Páginas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={paginas}
                    onChange={(e) => setPaginas(e.target.value)}
                    placeholder="320"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Ubicación física (Estante)
                  </label>
                  <input
                    type="text"
                    value={ubicacionEstante}
                    onChange={(e) => setUbicacionEstante(e.target.value)}
                    placeholder="Sala A · Estante 01 · Nivel 2"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Temas clave (separados por coma)
                  </label>
                  <input
                    type="text"
                    value={temasClave}
                    onChange={(e) => setTemasClave(e.target.value)}
                    placeholder="Vigilancia, Memoria, Libertad"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Copias totales *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={copiasTotales}
                    onChange={(e) => setCopiasTotales(Number(e.target.value))}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Copias disponibles *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={copiasTotales}
                    required
                    value={copiasDisp}
                    onChange={(e) => setCopiasDisp(Number(e.target.value))}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1.5">
                  Autores asociados *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto rounded-md border border-[#E7E2D8] p-2.5 bg-[#FBF9F5]">
                  {autores.map((a) => (
                    <label
                      key={a.id_autor}
                      className="flex items-center gap-2 text-xs text-[#1C1917] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAutores.includes(a.id_autor)}
                        onChange={() => toggleAutorSelection(a.id_autor)}
                        className="rounded border-[#D6CEBE]"
                      />
                      <span className="truncate">{a.nombre}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newAutorNombre}
                    onChange={(e) => setNewAutorNombre(e.target.value)}
                    placeholder="Nuevo autor..."
                    className="flex-1 min-w-[140px] rounded border border-[#D6CEBE] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={newAutorNac}
                    onChange={(e) => setNewAutorNac(e.target.value)}
                    placeholder="Nacionalidad"
                    className="w-32 rounded border border-[#D6CEBE] px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={addingAutor || !newAutorNombre.trim()}
                    onClick={handleQuickAddAutor}
                    className="rounded border border-[#D6CEBE] bg-[#F3EFE7] px-3 py-1.5 text-xs font-semibold text-[#1C1917] hover:bg-[#EBE6DF] disabled:opacity-50"
                  >
                    + Añadir autor
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Sinopsis descriptiva (habilita búsqueda IA y pruebas de lectura)
                </label>
                <textarea
                  rows={4}
                  value={sinopsis}
                  onChange={(e) => setSinopsis(e.target.value)}
                  placeholder="Resumen temático y argumentos centrales de la obra..."
                  className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E2D8] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setBookModalOpen(false)}
                  className="rounded-md border border-[#D6CEBE] px-4 py-2 text-xs font-semibold text-[#57534E] hover:bg-[#F3EFE7]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingBook}
                  className="rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554] disabled:opacity-60"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E7E2D8] bg-[#FBF9F5] px-6 py-4">
              <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                {editingCat ? `Editar Categoría: ${editingCat.nombre}` : 'Nueva Categoría'}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="p-1 rounded text-[#57534E] hover:bg-[#EBE6DF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategoria} className="p-6 space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Nombre de categoría *
                  </label>
                  <input
                    type="text"
                    required
                    value={catNombre}
                    onChange={(e) => setCatNombre(e.target.value)}
                    placeholder="Ensayo Contemporáneo"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Código CDU
                  </label>
                  <input
                    type="text"
                    value={catCodigo}
                    onChange={(e) => setCatCodigo(e.target.value)}
                    placeholder="804"
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Descripción curatorial *
                </label>
                <textarea
                  rows={3}
                  required
                  value={catDescripcion}
                  onChange={(e) => setCatDescripcion(e.target.value)}
                  placeholder="Descripción temática de los volúmenes agrupados en esta colección..."
                  className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Ubicación en sala
                  </label>
                  <input
                    type="text"
                    value={catSala}
                    onChange={(e) => setCatSala(e.target.value)}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Público recomendado
                  </label>
                  <input
                    type="text"
                    value={catPublico}
                    onChange={(e) => setCatPublico(e.target.value)}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Enfoque de lectura
                </label>
                <input
                  type="text"
                  value={catEnfoque}
                  onChange={(e) => setCatEnfoque(e.target.value)}
                  className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                />
              </div>
              <div className="pt-3 border-t border-[#E7E2D8] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="rounded-md border border-[#D6CEBE] px-4 py-2 text-xs font-semibold text-[#57534E]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554]"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E7E2D8] bg-[#FFFFFF] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E7E2D8] bg-[#FBF9F5] px-6 py-4">
              <h3 className="font-serif text-lg font-semibold text-[#1C1917]">
                Registrar Nuevo Usuario
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1 rounded text-[#57534E] hover:bg-[#EBE6DF]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Número de documento *
                </label>
                <input
                  type="text"
                  required
                  value={newDoc}
                  onChange={(e) => setNewDoc(e.target.value)}
                  className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">Rol *</label>
                  <select
                    value={newRol}
                    onChange={(e) => setNewRol(e.target.value as UserRole)}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm bg-white"
                  >
                    <option value="LECTOR">LECTOR</option>
                    <option value="DOCENTE">DOCENTE</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#44403C] mb-1">
                    Contraseña inicial *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full rounded-md border border-[#D6CEBE] px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-[#E7E2D8] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="rounded-md border border-[#D6CEBE] px-4 py-2 text-xs font-semibold text-[#57534E]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="rounded-md bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#172554]"
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
