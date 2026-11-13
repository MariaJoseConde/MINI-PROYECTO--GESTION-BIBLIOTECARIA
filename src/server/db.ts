import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'sgbi.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function getDbPath(): string {
  return dbPath;
}

export function getDatabaseStats() {
  const journalMode = String(db.pragma('journal_mode', { simple: true }));
  const foreignKeys = Number(db.pragma('foreign_keys', { simple: true })) === 1;
  let fileSizeKb = 0;
  try {
    fileSizeKb = Math.round((fs.statSync(dbPath).size / 1024) * 10) / 10;
  } catch {
    fileSizeKb = 0;
  }

  const indexesRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`,
    )
    .get() as { count: number };

  const integrityRow = db.prepare('PRAGMA quick_check(1)').get() as Record<string, string>;
  const integrityVal = Object.values(integrityRow)[0] || '';

  let schemaVersion = 'v3';
  try {
    const verRow = db
      .prepare('SELECT version FROM schema_migrations ORDER BY id_migration DESC LIMIT 1')
      .get() as { version: string } | undefined;
    if (verRow?.version) schemaVersion = verRow.version;
  } catch {
    schemaVersion = 'v3';
  }

  const countOf = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

  return {
    journalMode,
    foreignKeys,
    integrityOk: integrityVal.toLowerCase() === 'ok',
    schemaVersion,
    fileSizeKb,
    indexesCount: indexesRow.count,
    tables: {
      libros: countOf('libros'),
      autores: countOf('autores'),
      categorias: countOf('categorias'),
      usuarios: countOf('usuarios'),
      prestamos: countOf('prestamos'),
      pruebas_lectura: countOf('pruebas_lectura'),
      logs_sistema: countOf('logs_sistema'),
    },
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function logSystemEvent(
  tipoEvento: string,
  mensaje: string,
  idUsuario: number | null = null,
  ipOrigen: string | null = null,
) {
  try {
    db.prepare(
      `INSERT INTO logs_sistema (tipo_evento, mensaje, id_usuario, ip_origen) VALUES (?, ?, ?, ?)`,
    ).run(tipoEvento, mensaje, idUsuario, ipOrigen);
  } catch (err) {
    console.error('[logs_sistema] Error writing audit log:', err);
  }
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS autores (
      id_autor INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      nacionalidad TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS libros (
      id_libro INTEGER PRIMARY KEY AUTOINCREMENT,
      isbn TEXT NOT NULL UNIQUE,
      titulo TEXT NOT NULL,
      sinopsis TEXT NULL,
      categoria TEXT NOT NULL DEFAULT 'Literatura General',
      anio_publicacion INTEGER NULL,
      editorial TEXT NULL,
      idioma TEXT NOT NULL DEFAULT 'Español',
      paginas INTEGER NULL,
      ubicacion_estante TEXT NULL,
      temas_clave TEXT NULL,
      copias_totales INTEGER NOT NULL DEFAULT 1,
      copias_disp INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT chk_stock_valido CHECK (copias_disp >= 0 AND copias_disp <= copias_totales AND copias_totales >= 1)
    );

    CREATE TABLE IF NOT EXISTS libro_autor (
      id_libro INTEGER NOT NULL,
      id_autor INTEGER NOT NULL,
      PRIMARY KEY (id_libro, id_autor),
      CONSTRAINT fk_la_libro FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE CASCADE,
      CONSTRAINT fk_la_autor FOREIGN KEY (id_autor) REFERENCES autores(id_autor) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_documento TEXT NOT NULL UNIQUE,
      nombre_completo TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'LECTOR' CHECK (rol IN ('ADMIN', 'DOCENTE', 'LECTOR')),
      estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'SANCIONADO')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prestamos (
      id_prestamo INTEGER PRIMARY KEY AUTOINCREMENT,
      id_libro INTEGER NOT NULL,
      id_usuario INTEGER NOT NULL,
      fecha_prestamo TEXT NOT NULL,
      fecha_limite TEXT NOT NULL,
      fecha_entrega TEXT NULL,
      estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'DEVUELTO', 'MORA')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT fk_prestamo_libro FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE RESTRICT,
      CONSTRAINT fk_prestamo_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS pruebas_lectura (
      id_prueba INTEGER PRIMARY KEY AUTOINCREMENT,
      id_libro INTEGER NOT NULL,
      id_docente INTEGER NOT NULL,
      contenido_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT fk_prueba_libro FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE CASCADE,
      CONSTRAINT fk_prueba_docente FOREIGN KEY (id_docente) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS logs_sistema (
      id_log INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_evento TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      id_usuario INTEGER NULL,
      ip_origen TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      codigo_archivo TEXT NOT NULL DEFAULT '000',
      descripcion TEXT NOT NULL,
      ubicacion_sala TEXT NOT NULL DEFAULT 'Sala General',
      publico_recomendado TEXT NOT NULL DEFAULT 'Público general',
      enfoque_lector TEXT NOT NULL DEFAULT 'Lectura integral',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS libros_fts USING fts5(
      titulo,
      sinopsis,
      categoria,
      content='libros',
      content_rowid='id_libro'
    );

    CREATE TRIGGER IF NOT EXISTS libros_ai AFTER INSERT ON libros BEGIN
      INSERT INTO libros_fts(rowid, titulo, sinopsis, categoria)
      VALUES (new.id_libro, new.titulo, COALESCE(new.sinopsis, ''), new.categoria);
    END;

    CREATE TRIGGER IF NOT EXISTS libros_ad AFTER DELETE ON libros BEGIN
      INSERT INTO libros_fts(libros_fts, rowid, titulo, sinopsis, categoria)
      VALUES ('delete', old.id_libro, old.titulo, COALESCE(old.sinopsis, ''), old.categoria);
    END;

    CREATE TRIGGER IF NOT EXISTS libros_au AFTER UPDATE ON libros BEGIN
      INSERT INTO libros_fts(libros_fts, rowid, titulo, sinopsis, categoria)
      VALUES ('delete', old.id_libro, old.titulo, COALESCE(old.sinopsis, ''), old.categoria);
      INSERT INTO libros_fts(rowid, titulo, sinopsis, categoria)
      VALUES (new.id_libro, new.titulo, COALESCE(new.sinopsis, ''), new.categoria);
    END;

    CREATE INDEX IF NOT EXISTS idx_libros_categoria ON libros(categoria);
    CREATE INDEX IF NOT EXISTS idx_prestamos_usuario_estado ON prestamos(id_usuario, estado);
    CREATE INDEX IF NOT EXISTS idx_prestamos_libro ON prestamos(id_libro);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs_sistema(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_evento ON logs_sistema(tipo_evento);

    CREATE TABLE IF NOT EXISTS schema_migrations (
      id_migration INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureColumnMigrations();
  recordSchemaMigrations();
  ensureCategoriasSeeded();

  const bookCount = (db.prepare('SELECT COUNT(*) as c FROM libros').get() as { c: number }).c;
  if (bookCount === 0) {
    seedInitialData();
  }
  backfillRichLibroMetadata();
}

function recordSchemaMigrations() {
  const migrations: Array<[string, string]> = [
    ['v1.0.0', 'Esquema base bibliotecario, RBAC, préstamos ACID y FTS5'],
    ['v1.1.0', 'Metadatos enriquecidos de catálogo y dosieres de categorías'],
    ['v1.2.0', 'Índices B-tree de rendimiento y tabla de migraciones'],
  ];
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (?, ?)',
  );
  for (const [ver, desc] of migrations) {
    stmt.run(ver, desc);
  }
}

function ensureColumnMigrations() {
  const libroCols = (
    db.prepare('PRAGMA table_info(libros)').all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!libroCols.includes('editorial')) db.exec('ALTER TABLE libros ADD COLUMN editorial TEXT NULL');
  if (!libroCols.includes('idioma')) db.exec("ALTER TABLE libros ADD COLUMN idioma TEXT NOT NULL DEFAULT 'Español'");
  if (!libroCols.includes('paginas')) db.exec('ALTER TABLE libros ADD COLUMN paginas INTEGER NULL');
  if (!libroCols.includes('ubicacion_estante')) db.exec('ALTER TABLE libros ADD COLUMN ubicacion_estante TEXT NULL');
  if (!libroCols.includes('temas_clave')) db.exec('ALTER TABLE libros ADD COLUMN temas_clave TEXT NULL');

  const catCols = (
    db.prepare('PRAGMA table_info(categorias)').all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!catCols.includes('ubicacion_sala')) {
    db.exec("ALTER TABLE categorias ADD COLUMN ubicacion_sala TEXT NOT NULL DEFAULT 'Sala General'");
  }
  if (!catCols.includes('publico_recomendado')) {
    db.exec("ALTER TABLE categorias ADD COLUMN publico_recomendado TEXT NOT NULL DEFAULT 'Público general'");
  }
  if (!catCols.includes('enfoque_lector')) {
    db.exec("ALTER TABLE categorias ADD COLUMN enfoque_lector TEXT NOT NULL DEFAULT 'Lectura integral'");
  }
}

function ensureCategoriasSeeded() {
  const defaultCategorias: Array<[string, string, string, string, string, string]> = [
    [
      'Distopía y Política',
      '823.91',
      'Ficción especulativa sobre sociedades sometidas a vigilancia masiva, control estatal, censura lingüística y resistencia cívica frente al poder absoluto.',
      'Sala A · Pasillo 1',
      'Bachillerato, Pregrado y Clubes de Debate',
      'Análisis crítico del poder y libertades civiles',
    ],
    [
      'Realismo Mágico',
      '863.44',
      'Narrativa iberoamericana donde lo cotidiano, la memoria colectiva y las tensiones históricas dialogan con acontecimientos prodigiosos y simbólicos.',
      'Sala B · Pasillo 2',
      'Lectores generales y Humanidades',
      'Comprensión simbólica y genealogía literaria',
    ],
    [
      'Ciencia Ficción',
      '813.54',
      'Relatos sobre futuros tecnológicos, preservación de la cultura escrita, exploración espacial y dilemas éticos ante la automatización social.',
      'Sala A · Pasillo 3',
      'Jóvenes, Ciencia y Literatura Contemporánea',
      'Prospectiva tecnológica y pensamiento crítico',
    ],
    [
      'Clásicos Universales',
      '808.83',
      'Obras fundacionales de la literatura mundial que indagan en la responsabilidad moral, la ambición del conocimiento y la condición humana.',
      'Sala Central · Estantería Noble',
      'Toda la comunidad académica y lectores generales',
      'Lectura comparada e historia de las ideas',
    ],
    [
      'Cuento y Filosofía',
      '863.01',
      'Ficción breve, metafísica y ensayos narrativos centrados en bibliotecas infinitas, el tiempo, los espejos y los límites del conocimiento.',
      'Sala B · Pasillo 4',
      'Pregrado, Filosofía y Literatura',
      'Lectura analítica de estructura y paradojas',
    ],
    [
      'Divulgación Científica',
      '520.9',
      'Textos rigurosos y accesibles sobre astronomía, evolución cósmica, historia de la ciencia y método experimental para el público no especializado.',
      'Sala C · Ciencias Exactas',
      'Estudiantes STEM y divulgación general',
      'Pensamiento científico y método empírico',
    ],
    [
      'Historia y Filosofía Política',
      '320.53',
      'Estudios históricos y teóricos sobre la formación de las democracias modernas, los orígenes del totalitarismo y la defensa de los derechos ciudadanos.',
      'Sala D · Ciencias Sociales',
      'Ciencias Políticas, Derecho e Historia',
      'Investigación documental y teoría política',
    ],
    [
      'Historia y Antropología',
      '909.04',
      'Síntesis interdisciplinarias sobre la evolución biológica, cognitiva, económica y cultural de las sociedades humanas desde la prehistoria al siglo XXI.',
      'Sala D · Ciencias Sociales',
      'Lectores generales, Antropología e Historia',
      'Visión macrohistórica e interdisciplinaria',
    ],
    [
      'Narrativa Latinoamericana',
      '863.6',
      'Novelas experimentales y del boom latinoamericano que renovaron la estructura del relato, el lenguaje urbano y la experiencia del lector activo.',
      'Sala B · Pasillo 1',
      'Estudios Literarios y Lectores Avanzados',
      'Lectura no lineal y vanguardia narrativa',
    ],
    [
      'Poesía y Ensayo',
      '861.3',
      'Lírica barroca y contemporánea, epístolas intelectuales y prosa ensayística de alto valor estético, histórico y pedagógico.',
      'Sala B · Fondo Antiguo',
      'Investigadores, Docentes y Poesía',
      'Estilística, métrica y retórica clásica',
    ],
    [
      'Literatura General',
      '800.1',
      'Acervo multidisciplinario de ficción, crónica y ensayo general disponible para lectura en sala o préstamo domiciliario estándar.',
      'Sala General · Nivel 1',
      'Público general',
      'Lectura recreativa y formativa',
    ],
  ];

  const upsertCat = db.prepare(`
    INSERT INTO categorias (nombre, codigo_archivo, descripcion, ubicacion_sala, publico_recomendado, enfoque_lector)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(nombre) DO UPDATE SET
      codigo_archivo = excluded.codigo_archivo,
      descripcion = CASE WHEN length(categorias.descripcion) < 125 THEN excluded.descripcion ELSE categorias.descripcion END,
      ubicacion_sala = CASE WHEN categorias.ubicacion_sala = 'Sala General' THEN excluded.ubicacion_sala ELSE categorias.ubicacion_sala END,
      publico_recomendado = CASE WHEN categorias.publico_recomendado = 'Público general' THEN excluded.publico_recomendado ELSE categorias.publico_recomendado END,
      enfoque_lector = CASE WHEN categorias.enfoque_lector = 'Lectura integral' THEN excluded.enfoque_lector ELSE categorias.enfoque_lector END
  `);

  for (const [nombre, codigo, desc, sala, publico, enfoque] of defaultCategorias) {
    upsertCat.run(nombre, codigo, desc, sala, publico, enfoque);
  }
}

function backfillRichLibroMetadata() {
  const enrichments: Array<{
    isbn: string;
    editorial: string;
    idioma: string;
    paginas: number;
    ubicacion: string;
    temas: string;
    sinopsis?: string;
  }> = [
    {
      isbn: '978-0-452-28423-4',
      editorial: 'Debolsillo · Edición Anotada',
      idioma: 'Español (Traducción)',
      paginas: 352,
      ubicacion: 'Sala A · Estante 01 · Nivel 2',
      temas: 'Vigilancia estatal, Neolengua, Totalitarismo, Memoria histórica',
      sinopsis:
        'En un Londres sombrío bajo el régimen totalitario del Gran Hermano, Winston Smith trabaja reescribiendo archivos en el Ministerio de la Verdad para ajustar el pasado a las consignas del Partido. Mediante la vigilancia ubicua de las telepantallas, la reducción del lenguaje con la neolengua y el control de la Policía del Pensamiento, la novela examina la manipulación de la verdad y la resistencia íntima por preservar la libertad de conciencia.',
    },
    {
      isbn: '978-84-376-0494-7',
      editorial: 'Cátedra · Letras Hispánicas',
      idioma: 'Español (Original)',
      paginas: 496,
      ubicacion: 'Sala B · Estante 05 · Nivel 1',
      temas: 'Macondo, Genealogía Buendía, Soledad, Memoria cíclica',
    },
    {
      isbn: '978-84-9759-425-7',
      editorial: 'Minotauro · Biblioteca Bradbury',
      idioma: 'Español (Traducción)',
      paginas: 224,
      ubicacion: 'Sala A · Estante 07 · Nivel 1',
      temas: 'Censura literaria, Cultura audiovisual, Pensamiento crítico',
    },
    {
      isbn: '978-0-14-143947-1',
      editorial: 'Alianza Editorial · Clásicos',
      idioma: 'Español (Traducción)',
      paginas: 288,
      ubicacion: 'Sala Central · Estante 02 · Nivel 2',
      temas: 'Ética científica, Prometeo moderno, Otredad, Responsabilidad moral',
    },
    {
      isbn: '978-84-206-3312-1',
      editorial: 'Alianza Editorial · Biblioteca Borges',
      idioma: 'Español (Original)',
      paginas: 216,
      ubicacion: 'Sala B · Estante 09 · Nivel 1',
      temas: 'Laberintos, Biblioteca de Babel, Tiempo circular, Metafísica',
    },
    {
      isbn: '978-84-08-05469-6',
      editorial: 'Planeta · Divulgación Científica',
      idioma: 'Español (Traducción)',
      paginas: 384,
      ubicacion: 'Sala C · Estante 03 · Nivel 2',
      temas: 'Astrofísica, Biblioteca de Alejandría, Evolución cósmica, Escepticismo',
    },
    {
      isbn: '978-84-264-1849-4',
      editorial: 'Taurus · Pensamiento Político',
      idioma: 'Español (Traducción)',
      paginas: 640,
      ubicacion: 'Sala D · Estante 04 · Nivel 3',
      temas: 'Instituciones democráticas, Propaganda, Masas, Derechos humanos',
    },
    {
      isbn: '978-84-9992-622-3',
      editorial: 'Debate · Historia Universal',
      idioma: 'Español (Traducción)',
      paginas: 492,
      ubicacion: 'Sala D · Estante 01 · Nivel 1',
      temas: 'Revolución cognitiva, Agricultura, Ficciones compartidas, Ciencia',
    },
    {
      isbn: '978-84-376-2481-5',
      editorial: 'Alfaguara · Edición Conmemorativa',
      idioma: 'Español (Original)',
      paginas: 688,
      ubicacion: 'Sala B · Estante 02 · Nivel 2',
      temas: 'Tablero de dirección, París y Buenos Aires, Vanguardia narrativa',
    },
    {
      isbn: '978-968-16-6122-9',
      editorial: 'Fondo de Cultura Económica',
      idioma: 'Español (Original)',
      paginas: 310,
      ubicacion: 'Sala B · Fondo Antiguo · Vitrina 1',
      temas: 'Barroco novohispano, Sonetos, Redondillas, Defensa intelectual',
    },
  ];

  const updateStmt = db.prepare(`
    UPDATE libros
    SET editorial = COALESCE(editorial, ?),
        idioma = COALESCE(NULLIF(idioma, ''), ?),
        paginas = COALESCE(paginas, ?),
        ubicacion_estante = COALESCE(ubicacion_estante, ?),
        temas_clave = COALESCE(temas_clave, ?),
        sinopsis = COALESCE(?, sinopsis)
    WHERE isbn = ?
  `);

  for (const item of enrichments) {
    updateStmt.run(
      item.editorial,
      item.idioma,
      item.paginas,
      item.ubicacion,
      item.temas,
      item.sinopsis ?? null,
      item.isbn,
    );
  }
}

function seedInitialData() {
  const seed = db.transaction(() => {
    const insertAutor = db.prepare(
      'INSERT INTO autores (nombre, nacionalidad) VALUES (?, ?)',
    );

    const autoresData: Array<[string, string]> = [
      ['Gabriel García Márquez', 'Colombiana'],
      ['George Orwell', 'Británica'],
      ['Mary Shelley', 'Británica'],
      ['Jorge Luis Borges', 'Argentina'],
      ['Ray Bradbury', 'Estadounidense'],
      ['Carl Sagan', 'Estadounidense'],
      ['Hannah Arendt', 'Alemana'],
      ['Yuval Noah Harari', 'Israelí'],
      ['Sor Juana Inés de la Cruz', 'Mexicana'],
      ['Julio Cortázar', 'Argentina'],
    ];

    const autorIds = autoresData.map(
      ([nombre, nac]) => Number(insertAutor.run(nombre, nac).lastInsertRowid),
    );

    const insertLibro = db.prepare(`
      INSERT INTO libros (isbn, titulo, sinopsis, categoria, anio_publicacion, copias_totales, copias_disp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertLA = db.prepare('INSERT INTO libro_autor (id_libro, id_autor) VALUES (?, ?)');

    const librosSeed: Array<{
      isbn: string;
      titulo: string;
      sinopsis: string | null;
      categoria: string;
      anio: number;
      totales: number;
      disp: number;
      autorIndexes: number[];
    }> = [
      {
        isbn: '978-0-452-28423-4',
        titulo: '1984',
        sinopsis:
          'En un Londres sombrío bajo el régimen totalitario del Gran Hermano, Winston Smith trabaja reescribiendo la historia en el Ministerio de la Verdad. A través de la vigilancia masiva, la neolengua y la policía del pensamiento, la novela explora la manipulación de la memoria colectiva, el control tecnológico y la resistencia íntima por preservar la libertad individual.',
        categoria: 'Distopía y Política',
        anio: 1949,
        totales: 4,
        disp: 3,
        autorIndexes: [1],
      },
      {
        isbn: '978-84-376-0494-7',
        titulo: 'Cien años de soledad',
        sinopsis:
          'Crónica de siete generaciones de la familia Buendía en el mítico pueblo de Macondo. Entre guerras civiles, lluvias interminables, inventos prodigiosos y amores condenados al olvido, la obra entrelaza el realismo mágico con la historia latinoamericana y el peso cíclico del destino familiar.',
        categoria: 'Realismo Mágico',
        anio: 1967,
        totales: 5,
        disp: 4,
        autorIndexes: [0],
      },
      {
        isbn: '978-84-9759-425-7',
        titulo: 'Fahrenheit 451',
        sinopsis:
          'En una sociedad futurista dominada por pantallas interactivas y el consumo superficial, los bomberos no apagan incendios: queman libros prohibidos. Guy Montag comienza a cuestionar la censura estatal tras conocer a una joven vecina y descubrir el valor subversivo de la lectura y el pensamiento crítico.',
        categoria: 'Ciencia Ficción',
        anio: 1953,
        totales: 3,
        disp: 1,
        autorIndexes: [4],
      },
      {
        isbn: '978-0-14-143947-1',
        titulo: 'Frankenstein o el moderno Prometeo',
        sinopsis:
          'Victor Frankenstein, un joven científico obsesionado con descifrar los secretos de la vida y la muerte, ensambla y anima una criatura consciente en su laboratorio. Rechazado por su creador y por la sociedad, el ser busca comprender su propia existencia, planteando profundos dilemas sobre la ética científica y la responsabilidad moral.',
        categoria: 'Clásicos Universales',
        anio: 1818,
        totales: 2,
        disp: 2,
        autorIndexes: [2],
      },
      {
        isbn: '978-84-206-3312-1',
        titulo: 'Ficciones',
        sinopsis:
          'Colección magistral de cuentos filosóficos que exploran bibliotecas infinitas, laberintos temporales, espejos y enciclopedias apócrifas. Borges transforma la metafísica y la erudición literaria en relatos breves sobre la identidad, el azar y los límites del conocimiento humano.',
        categoria: 'Cuento y Filosofía',
        anio: 1944,
        totales: 3,
        disp: 3,
        autorIndexes: [3],
      },
      {
        isbn: '978-84-08-05469-6',
        titulo: 'Cosmos',
        sinopsis:
          'Un recorrido divulgativo por quince mil millones de años de evolución cósmica, desde el origen de las galaxias y la química de las estrellas hasta la biblioteca de Alejandría y la exploración espacial moderna. Defiende el método científico y la curiosidad humana como herramientas esenciales para comprender nuestro lugar en el universo.',
        categoria: 'Divulgación Científica',
        anio: 1980,
        totales: 3,
        disp: 2,
        autorIndexes: [5],
      },
      {
        isbn: '978-84-264-1849-4',
        titulo: 'Los orígenes del totalitarismo',
        sinopsis:
          'Análisis histórico y filosófico del siglo XX que examina cómo el antisemitismo, el imperialismo y la desintegración de las instituciones democráticas prepararon el terreno para los regímenes totalitarios. Estudia los mecanismos del terror, la propaganda y la transformación de los ciudadanos en masas aisladas.',
        categoria: 'Historia y Filosofía Política',
        anio: 1951,
        totales: 2,
        disp: 0,
        autorIndexes: [6],
      },
      {
        isbn: '978-84-9992-622-3',
        titulo: 'Sapiens: De animales a dioses',
        sinopsis:
          'Síntesis interdisciplinaria de la historia de la humanidad desde la aparición del Homo sapiens en África hasta la revolución tecnológica contemporánea. Examina cómo las ficciones compartidas, la agricultura, el dinero, los imperios y la ciencia han moldeado las sociedades actuales.',
        categoria: 'Historia y Antropología',
        anio: 2011,
        totales: 4,
        disp: 4,
        autorIndexes: [7],
      },
      {
        isbn: '978-84-376-2481-5',
        titulo: 'Rayuela',
        sinopsis:
          'Novela experimental que sigue a Horacio Oliveira entre el París bohemio y el Buenos Aires de los años cincuenta en busca de la Maga y de un sentido trascendente de la existencia. Propone múltiples órdenes de lectura para desafiar las convenciones tradicionales de la narrativa.',
        categoria: 'Narrativa Latinoamericana',
        anio: 1963,
        totales: 2,
        disp: 2,
        autorIndexes: [9],
      },
      {
        isbn: '978-968-16-6122-9',
        titulo: 'Obras selectas de Sor Juana',
        sinopsis: null,
        categoria: 'Poesía y Ensayo',
        anio: 1689,
        totales: 2,
        disp: 2,
        autorIndexes: [8],
      },
    ];

    const libroIds: number[] = [];
    for (const item of librosSeed) {
      const id = Number(
        insertLibro.run(
          item.isbn,
          item.titulo,
          item.sinopsis,
          item.categoria,
          item.anio,
          item.totales,
          item.disp,
        ).lastInsertRowid,
      );
      libroIds.push(id);
      for (const aIdx of item.autorIndexes) {
        insertLA.run(id, autorIds[aIdx]);
      }
    }

    const insertUser = db.prepare(`
      INSERT INTO usuarios (numero_documento, nombre_completo, email, password_hash, rol, estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const defaultPassHash = hashPassword('sgbi2026');

    const adminId = Number(
      insertUser.run(
        '10101010',
        'Clara Mendoza Vargas',
        'admin@sgbi.edu',
        defaultPassHash,
        'ADMIN',
        'ACTIVO',
      ).lastInsertRowid,
    );
    const docenteId = Number(
      insertUser.run(
        '20202020',
        'Prof. Julián Restrepo Gil',
        'docente@sgbi.edu',
        defaultPassHash,
        'DOCENTE',
        'ACTIVO',
      ).lastInsertRowid,
    );
    const lectorActivoId = Number(
      insertUser.run(
        '30303030',
        'Sofía Morales Pardo',
        'lector@sgbi.edu',
        defaultPassHash,
        'LECTOR',
        'ACTIVO',
      ).lastInsertRowid,
    );
    const lectorSancionadoId = Number(
      insertUser.run(
        '40404040',
        'Mateo Castaño Ruiz',
        'mateo.mora@sgbi.edu',
        defaultPassHash,
        'LECTOR',
        'SANCIONADO',
      ).lastInsertRowid,
    );

    const insertPrestamo = db.prepare(`
      INSERT INTO prestamos (id_libro, id_usuario, fecha_prestamo, fecha_limite, fecha_entrega, estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Active loan for Sofia (Libro: 1984 -> disp=3 of 4)
    insertPrestamo.run(libroIds[0], lectorActivoId, '2026-11-09', '2026-11-19', null, 'ACTIVO');
    // Active loan for Docente (Libro: Cien años -> disp=4 of 5)
    insertPrestamo.run(libroIds[1], docenteId, '2026-11-10', '2026-11-20', null, 'ACTIVO');
    // Overdue MORA loans matching disp deductions:
    // Fahrenheit 451 (tot=3, disp=1 -> 2 loans out: 1 active, 1 mora)
    insertPrestamo.run(libroIds[2], lectorSancionadoId, '2026-10-15', '2026-10-27', null, 'MORA');
    insertPrestamo.run(libroIds[2], lectorActivoId, '2026-11-11', '2026-11-23', null, 'ACTIVO');
    // Cosmos (tot=3, disp=2 -> 1 active loan)
    insertPrestamo.run(libroIds[5], docenteId, '2026-11-12', '2026-11-24', null, 'ACTIVO');
    // Los origenes del totalitarismo (tot=2, disp=0 -> 2 loans out)
    insertPrestamo.run(libroIds[6], lectorSancionadoId, '2026-10-10', '2026-10-22', null, 'MORA');
    insertPrestamo.run(libroIds[6], docenteId, '2026-11-06', '2026-11-18', null, 'ACTIVO');

    // Historical returned loan
    insertPrestamo.run(
      libroIds[3],
      lectorActivoId,
      '2026-10-01',
      '2026-10-13',
      '2026-10-11',
      'DEVUELTO',
    );

    // Seed one pre-generated reading test for 1984
    const sampleQuiz = {
      libro_id: libroIds[0],
      titulo_libro: '1984',
      evaluacion: [
        {
          pregunta:
            '¿Cuál es la función principal de Winston Smith dentro del Ministerio de la Verdad?',
          opciones: {
            A: 'Vigilar las telepantallas instaladas en los hogares del Partido',
            B: 'Modificar registros históricos para alinear el pasado con la versión oficial del Partido',
            C: 'Redactar el diccionario oficial de la neolengua para eliminar sinónimos',
            D: 'Dirigir los interrogatorios de la Policía del Pensamiento',
          },
          respuesta_correcta: 'B',
          justificacion:
            'Según la sinopsis, Winston reescribe la historia en el Ministerio de la Verdad, mostrando cómo el régimen manipula la memoria colectiva.',
        },
        {
          pregunta:
            '¿Qué papel cumple la "neolengua" dentro de la estructura de control social descrita en la obra?',
          opciones: {
            A: 'Facilitar la traducción científica entre superestados aliados',
            B: 'Preservar el vocabulario literario clásico para las élites del Partido',
            C: 'Restringir el pensamiento crítico mediante la reducción del lenguaje disponible',
            D: 'Permitir la comunicación cifrada entre los miembros de la resistencia',
          },
          respuesta_correcta: 'C',
          justificacion:
            'La neolengua opera junto con la vigilancia masiva como instrumento para controlar el pensamiento y anular conceptos disidentes.',
        },
        {
          pregunta:
            '¿Qué conflicto central atraviesa el protagonista frente al régimen del Gran Hermano?',
          opciones: {
            A: 'La búsqueda de riqueza material fuera de Oceanía',
            B: 'La tensión entre el control tecnológico estatal y la defensa de la libertad interior',
            C: 'Una disputa sucesoria por el liderazgo del Ministerio de la Verdad',
            D: 'El intento de reconstruir la infraestructura industrial tras una guerra civil',
          },
          respuesta_correcta: 'B',
          justificacion:
            'La obra contrasta la vigilancia totalitaria del Estado con la resistencia íntima del protagonista por conservar su autonomía individual.',
        },
      ],
    };

    db.prepare(
      'INSERT INTO pruebas_lectura (id_libro, id_docente, contenido_json) VALUES (?, ?, ?)',
    ).run(libroIds[0], docenteId, JSON.stringify(sampleQuiz));

    db.prepare(
      'INSERT INTO logs_sistema (tipo_evento, mensaje, id_usuario, ip_origen) VALUES (?, ?, ?, ?)',
    ).run(
      'SISTEMA_INICIALIZADO',
      'Catálogo base, usuarios RBAC, préstamos iniciales y prueba de ejemplo inicializados correctamente.',
      adminId,
      '127.0.0.1',
    );
  });

  seed();
}
