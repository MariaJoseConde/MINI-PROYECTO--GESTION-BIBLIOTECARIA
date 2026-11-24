/**
 * Generador de documento Word (.docx) – Resumen Sprint 2
 * SGBI – Sistema de Gestión de Biblioteca Integral
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType,
  PageBreak, Footer, Header,
  convertInchesToTwip
} from "docx";
import { writeFileSync } from "node:fs";

// ─── Helpers ──────────────────────────────────────────────────────────
const TEAL  = "183B4E";
const GREEN = "287A65";
const BLACK = "1A1A1A";
const GREY  = "666666";
const LIGHT_GREY = "F8F9FA";

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 400 : 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22, color: TEAL, font: "Calibri" })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, size: 22, font: "Calibri", color: opts.color || BLACK, bold: !!opts.bold, italics: !!opts.italics })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: "Calibri", color: BLACK })],
  });
}

function richBullet(runs, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: runs.map(r => new TextRun({ size: 22, font: "Calibri", color: BLACK, ...r })),
  });
}

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function headerCell(text, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: TEAL },
    borders,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 20, font: "Calibri", color: "FFFFFF" })] })],
  });
}

function cell(text, widthPct, opts = {}) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: opts.shade ? { type: ShadingType.SOLID, color: LIGHT_GREY } : undefined,
    borders,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text, size: 20, font: "Calibri", color: BLACK, bold: !!opts.bold })]
    })],
  });
}

function tableFromRows(headerTexts, widths, rows) {
  const hdrRow = new TableRow({ children: headerTexts.map((t, i) => headerCell(t, widths[i])), tableHeader: true });
  const dataRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((t, ci) => cell(t, widths[ci], { shade: ri % 2 === 1 })),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [hdrRow, ...dataRows],
  });
}

// ─── Definiciones de tablas de la BD ──────────────────────────────────
const tables = [
  {
    name: "autores",
    purpose: "Almacena los autores de las obras del catálogo bibliográfico.",
    cols: [
      ["id_autor", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["nombre", "VARCHAR(255)", "—", "No", "—"],
      ["nacionalidad", "VARCHAR(100)", "—", "Sí", "NULL"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "Relacionada con libros a través de la tabla asociativa libro_autor (N:M).",
  },
  {
    name: "categorias",
    purpose: "Catálogo de categorías temáticas que clasifican el acervo bibliográfico.",
    cols: [
      ["id_categoria", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["nombre", "VARCHAR(150)", "UNIQUE", "No", "—"],
      ["codigo_archivo", "VARCHAR(50)", "—", "No", "'000'"],
      ["descripcion", "TEXT", "—", "No", "—"],
      ["ubicacion_sala", "VARCHAR(150)", "—", "No", "'Sala General'"],
      ["publico_recomendado", "VARCHAR(150)", "—", "No", "'Público general'"],
      ["enfoque_lector", "VARCHAR(255)", "—", "No", "'Lectura integral'"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "Clasifica libros temática y físicamente en la biblioteca.",
  },
  {
    name: "salas",
    purpose: "Registra las ubicaciones y áreas físicas de lectura de la biblioteca.",
    cols: [
      ["id_sala", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["nombre", "VARCHAR(100)", "UNIQUE", "No", "—"],
      ["descripcion", "TEXT", "—", "Sí", "NULL"],
      ["capacidad", "INT", "—", "No", "30"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "Ubicaciones espaciales referenciadas por categorías y estanterías.",
  },
  {
    name: "libros",
    purpose: "Tabla central del catálogo bibliográfico con metadatos y control de stock físico.",
    cols: [
      ["id_libro", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["isbn", "VARCHAR(30)", "UNIQUE", "No", "—"],
      ["titulo", "VARCHAR(255)", "—", "No", "—"],
      ["sinopsis", "TEXT", "—", "Sí", "NULL"],
      ["categoria", "VARCHAR(150)", "—", "No", "'Literatura General'"],
      ["anio_publicacion", "INT", "—", "Sí", "NULL"],
      ["editorial", "VARCHAR(255)", "—", "Sí", "NULL"],
      ["idioma", "VARCHAR(100)", "—", "No", "'Español'"],
      ["paginas", "INT", "—", "Sí", "NULL"],
      ["ubicacion_estante", "VARCHAR(150)", "—", "Sí", "NULL"],
      ["temas_clave", "TEXT", "—", "Sí", "NULL"],
      ["copias_totales", "INT", "CHECK >= 1", "No", "1"],
      ["copias_disp", "INT", "CHECK >= 0 y <= copias_totales", "No", "1"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "Relacionada con autores (N:M vía libro_autor), prestamos (1:N) y pruebas_lectura (1:N).",
  },
  {
    name: "libro_autor",
    purpose: "Tabla asociativa intermedia que resuelve la relación N:M entre libros y autores.",
    cols: [
      ["id_libro", "INT", "PK compuesta, FK -> libros(id_libro)", "No", "—"],
      ["id_autor", "INT", "PK compuesta, FK -> autores(id_autor)", "No", "—"],
    ],
    relations: "FK id_libro ON DELETE CASCADE. FK id_autor ON DELETE RESTRICT (protege autores con libros vigentes).",
  },
  {
    name: "usuarios",
    purpose: "Usuarios del sistema con roles RBAC (ADMIN, DOCENTE, LECTOR) y control de estado.",
    cols: [
      ["id_usuario", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["numero_documento", "VARCHAR(50)", "UNIQUE", "No", "—"],
      ["nombre_completo", "VARCHAR(255)", "—", "No", "—"],
      ["email", "VARCHAR(255)", "UNIQUE", "No", "—"],
      ["password_hash", "VARCHAR(255)", "Hash BCRYPT", "No", "—"],
      ["rol", "ENUM('ADMIN','DOCENTE','LECTOR')", "—", "No", "'LECTOR'"],
      ["estado", "ENUM('ACTIVO','SANCIONADO','INACTIVO')", "—", "No", "'ACTIVO'"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "Relacionada con prestamos (1:N) y pruebas_lectura (1:N).",
  },
  {
    name: "prestamos",
    purpose: "Registro transaccional de circulación, plazos, devoluciones y cálculo de moras.",
    cols: [
      ["id_prestamo", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["id_libro", "INT", "FK -> libros(id_libro)", "No", "—"],
      ["id_usuario", "INT", "FK -> usuarios(id_usuario)", "No", "—"],
      ["fecha_prestamo", "DATE", "—", "No", "—"],
      ["fecha_limite", "DATE", "—", "No", "—"],
      ["fecha_entrega", "DATE", "—", "Sí", "NULL"],
      ["estado", "ENUM('ACTIVO','DEVUELTO','MORA')", "—", "No", "'ACTIVO'"],
      ["multa_calculada", "DECIMAL(10,2)", "—", "No", "0.00"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "FK id_libro ON DELETE RESTRICT. FK id_usuario ON DELETE RESTRICT.",
  },
  {
    name: "pruebas_lectura",
    purpose: "Evaluaciones de comprensión lectora generadas por docentes y asociadas a libros.",
    cols: [
      ["id_prueba", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["id_libro", "INT", "FK -> libros(id_libro)", "No", "—"],
      ["id_docente", "INT", "FK -> usuarios(id_usuario)", "No", "—"],
      ["contenido_json", "LONGTEXT", "—", "No", "—"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "FK id_libro ON DELETE CASCADE. FK id_docente ON DELETE RESTRICT.",
  },
  {
    name: "logs_sistema",
    purpose: "Bitácora de auditoría para trazabilidad de operaciones críticas en el sistema.",
    cols: [
      ["id_log", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["tipo_evento", "VARCHAR(100)", "—", "No", "—"],
      ["mensaje", "TEXT", "—", "No", "—"],
      ["id_usuario", "INT", "—", "Sí", "NULL"],
      ["ip_origen", "VARCHAR(45)", "—", "Sí", "NULL"],
      ["created_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "Referencia a usuarios.id_usuario.",
  },
  {
    name: "schema_migrations",
    purpose: "Control de versiones y registro de migraciones SQL aplicadas.",
    cols: [
      ["id_migration", "INT", "PK, AUTO_INCREMENT", "No", "—"],
      ["version", "VARCHAR(50)", "UNIQUE", "No", "—"],
      ["description", "VARCHAR(255)", "—", "No", "—"],
      ["applied_at", "TIMESTAMP", "—", "No", "CURRENT_TIMESTAMP"],
    ],
    relations: "Control interno de versión de base de datos.",
  },
];

// ─── Build Document ──────────────────────────────────────────────────
const doc = new Document({
  creator: "SGBI – Equipo de Desarrollo",
  title: "SGBI – Resumen Técnico Sprint 2: Base de Datos y Backend",
  sections: [{
    properties: {
      page: {
        margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(0.8), left: convertInchesToTwip(1), right: convertInchesToTwip(1) },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "SGBI – Sprint 2 · Base de Datos y Backend RESTful", size: 16, color: GREY, font: "Calibri", italics: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Sistema de Gestión Bibliotecaria Inteligente (SGBI) · 2026", size: 16, color: GREY, font: "Calibri" })],
        })],
      }),
    },
    children: [
      new Paragraph({ spacing: { before: 1800 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
        children: [new TextRun({ text: "SISTEMA DE GESTIÓN BIBLIOTECARIA INTELIGENTE (SGBI)", bold: true, size: 36, font: "Calibri", color: TEAL })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "DOCUMENTO RESUMEN DEL SPRINT 2: BASE DE DATOS Y BACKEND", bold: true, size: 28, font: "Calibri", color: GREEN })],
      }),
      new Paragraph({ spacing: { after: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "────────────────────────────────────────────────────────", size: 20, color: GREY })] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Motor Primario: MySQL 8.0+ (InnoDB) | Respaldo Resiliente: SQLite 3 WAL", size: 22, font: "Calibri", color: BLACK })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Autenticación: JSON Web Tokens (JWT RFC 7519) + RBAC | Lenguaje: PHP 8.2+", size: 22, font: "Calibri", color: BLACK })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Fecha: 24 de noviembre de 2026", size: 22, font: "Calibri", color: GREY })],
      }),
      new Paragraph({ children: [new PageBreak()] }),

      heading("1. Introducción al Sprint 2"),
      para("El Sprint 2 del proyecto SGBI tuvo como objetivo primordial la construcción de la base de datos relacional y el backend RESTful con autenticación y autorización por roles. Se implementó una arquitectura en PHP 8.2 con persistencia dual: MySQL InnoDB como motor de producción y SQLite 3 en modo WAL como respaldo automático para desarrollo local."),

      heading("2. Tablas de la Base de Datos Diseñadas e Implementadas"),
      para("A continuación se detallan las 10 tablas creadas en el Sprint 2, indicando su propósito, columnas, tipos de datos, restricciones y relaciones:"),

      ...tables.flatMap((t, idx) => [
        heading(`2.${idx + 1}. Tabla: ${t.name}`, HeadingLevel.HEADING_2),
        richBullet([{ text: "Propósito: ", bold: true }, { text: t.purpose }]),
        para(""),
        tableFromRows(
          ["Columna", "Tipo de Dato", "Restricciones", "Nulable", "Valor por Defecto"],
          [20, 22, 24, 10, 24],
          t.cols
        ),
        para(""),
        richBullet([{ text: "Relaciones: ", bold: true }, { text: t.relations }]),
        para(""),
      ]),

      new Paragraph({ children: [new PageBreak()] }),

      heading("3. Integridad Relacional, Índices y Restricciones"),
      para("El modelo relacional fue normalizado en Tercera Forma Normal (3NF). Se aplicaron restricciones CHECK a nivel de motor de datos:"),
      bullet("Restricción de Inventario: chk_stock_valido en libros (copias_disp >= 0 AND copias_disp <= copias_totales AND copias_totales >= 1)."),
      bullet("Restricción de Integridad en Préstamos: claves foráneas con ON DELETE RESTRICT hacia libros y usuarios."),
      bullet("Restricción en Libro-Autor: ON DELETE CASCADE en libro y ON DELETE RESTRICT en autor."),
      para(""),
      para("Se implementaron 20 índices B-Tree y FULLTEXT para optimizar las consultas frecuentes sobre isbn, email, numero_documento, titulo, categoria y préstamos por usuario."),

      heading("4. Vistas, Procedimientos, Triggers y Funciones"),
      para("Vistas: Pendiente de confirmar para sprints futuros. La lógica de agregación y joins complejos se resolvió en la capa de controladores PHP mediante sentencias preparadas PDO."),
      para("Procedimientos Almacenados y Triggers: Pendiente de confirmar. Para preservar la portabilidad estricta entre MySQL y SQLite sin bifurcación de dialectos SQL, el control transaccional de stock se gestionó de forma atómica en PHP con transacciones PDO (BEGIN TRANSACTION, COMMIT, ROLLBACK)."),

      heading("5. Scripts de Migración y Datos Semilla"),
      para("Las migraciones se estructuraron en database/migrations/ y son ejecutadas por backend-php/migrate.php:"),
      bullet("001_create_base_schema.sql: Creación de tablas, claves primarias y foráneas."),
      bullet("002_create_indexes_and_constraints.sql: Creación de índices B-Tree y FULLTEXT."),
      bullet("003_seed_initial_data.sql: Carga idempotente de salas, categorías, autores, libros y usuarios."),
      para(""),
      para("Datos semilla cargados: 10 libros, 10 autores, 11 categorías, 6 salas físicas, 4 usuarios (con roles ADMIN, DOCENTE y LECTOR) y 8 préstamos de prueba."),

      heading("6. Resumen de Pruebas y Resultados"),
      para("Se ejecutaron 51 pruebas unitarias y de integración y 12 pruebas HTTP end-to-end en vivo con 100% de éxito:"),
      bullet("Tarea 1 (Base de Datos): 10/10 pasadas. Motor detectado ('mysql'), tablas e integridad validadas."),
      bullet("Tarea 2 (Servidor Local): Resuelto ERR_CONNECTION_REFUSED mediante binding a 0.0.0.0:8000 en iniciar_servidor_php.bat."),
      bullet("Tarea 3 (Autenticación JWT y RBAC): 10/10 pasadas. Cifrado BCRYPT, firma HMAC-SHA256 y roles ADMIN/DOCENTE/LECTOR."),
      bullet("Tarea 4 (CRUD y Control de Stock): 13/13 pasadas. Operaciones CRUD y ajuste transaccional de inventario."),
      bullet("Tarea 5 (Documentación y Postman): 6/6 pasadas. Swagger UI interactivo y colección Postman generada."),
    ],
  }],
});

const outputPath = "docs/SGBI_Sprint2_Base_de_Datos.docx";
const buffer = await Packer.toBuffer(doc);
writeFileSync(outputPath, buffer);
console.log(`[OK] Documento generado exitosamente en: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
