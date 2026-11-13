export type UserRole = 'ADMIN' | 'DOCENTE' | 'LECTOR';
export type UserStatus = 'ACTIVO' | 'SANCIONADO';
export type LoanStatus = 'ACTIVO' | 'DEVUELTO' | 'MORA';

export interface Autor {
  id_autor: number;
  nombre: string;
  nacionalidad: string | null;
  created_at: string;
}

export interface Categoria {
  id_categoria: number;
  nombre: string;
  codigo_archivo: string;
  descripcion: string;
  ubicacion_sala: string;
  publico_recomendado: string;
  enfoque_lector: string;
  libros_count?: number;
  copias_disp_sum?: number;
  created_at: string;
}

export interface Libro {
  id_libro: number;
  isbn: string;
  titulo: string;
  sinopsis: string | null;
  categoria: string;
  anio_publicacion: number | null;
  editorial: string | null;
  idioma: string;
  paginas: number | null;
  ubicacion_estante: string | null;
  temas_clave: string | null;
  copias_totales: number;
  copias_disp: number;
  created_at: string;
  autores: Autor[];
  pruebas_count?: number;
}

export interface Usuario {
  id_usuario: number;
  numero_documento: string;
  nombre_completo: string;
  email: string;
  rol: UserRole;
  estado: UserStatus;
  created_at: string;
}

export interface Prestamo {
  id_prestamo: number;
  id_libro: number;
  id_usuario: number;
  fecha_prestamo: string;
  fecha_limite: string;
  fecha_entrega: string | null;
  estado: LoanStatus;
  created_at: string;
  libro_titulo?: string;
  libro_isbn?: string;
  usuario_nombre?: string;
  usuario_documento?: string;
  usuario_estado?: UserStatus;
}

export interface PreguntaEvaluacion {
  pregunta: string;
  opciones: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  respuesta_correcta: 'A' | 'B' | 'C' | 'D';
  justificacion: string;
}

export interface PruebaLecturaContenido {
  libro_id: number;
  titulo_libro: string;
  evaluacion: PreguntaEvaluacion[];
}

export interface PruebaLectura {
  id_prueba: number;
  id_libro: number;
  id_docente: number;
  docente_nombre?: string;
  libro_titulo?: string;
  contenido: PruebaLecturaContenido;
  created_at: string;
}

export interface LogSistema {
  id_log: number;
  tipo_evento: string;
  mensaje: string;
  id_usuario: number | null;
  usuario_nombre?: string | null;
  ip_origen: string | null;
  created_at: string;
}

export interface SearchResponse {
  mode: 'ia' | 'fallback' | 'local';
  fallbackReason?: string;
  cached?: boolean;
  latencyMs: number;
  query: string;
  libros: Libro[];
}

export interface InfraestructuraMetrics {
  server: {
    uptimeSeconds: number;
    nodeVersion: string;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
    environment: string;
  };
  api: {
    totalRequests: number;
    errorRequests: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    recentTraces: Array<{
      method: string;
      path: string;
      status: number;
      durationMs: number;
      timestamp: string;
    }>;
  };
  database: {
    journalMode: string;
    foreignKeys: boolean;
    integrityOk: boolean;
    schemaVersion: string;
    fileSizeKb: number;
    indexesCount: number;
    tables: {
      libros: number;
      autores: number;
      categorias: number;
      usuarios: number;
      prestamos: number;
      pruebas_lectura: number;
      logs_sistema: number;
    };
  };
  iaCache: {
    hits: number;
    misses: number;
    entries: number;
    hitRatePct: number;
    ttlSeconds: number;
    geminiConfigured: boolean;
  };
}
