/**
 * Generador de documento Word (.docx) – Resumen Sprint 3: Desarrollo del Frontend
 * biblioSmart – Sistema de Gestión Bibliotecaria Inteligente
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType,
  PageBreak, Footer, Header,
  convertInchesToTwip
} from "docx";
import { writeFileSync } from "node:fs";

// ─── Paleta Corporativa Oficial ───────────────────────────────────────
const TEAL       = "183B4E"; // Azul Petróleo (Primario corporativo)
const GREEN      = "287A65"; // Verde Esmeralda (Acentos de éxito y acción)
const BLACK      = "1A1A1A"; // Texto principal
const GREY       = "555555"; // Subtítulos y metadatos
const LIGHT_BG   = "F8F9FA"; // Fondos alternos de tabla
const BEIGE_BG   = "F3EBDD"; // Fondo corporativo suave

// ─── Estilos de Párrafo y Encabezados ─────────────────────────────────
function title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 44, color: TEAL, font: "Calibri" })],
  });
}

function subtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text, italics: true, size: 24, color: GREEN, font: "Calibri" })],
  });
}

function meta(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text, size: 20, color: GREY, font: "Calibri" })],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 400 : 260, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: level === HeadingLevel.HEADING_1 ? 30 : level === HeadingLevel.HEADING_2 ? 24 : 22,
        color: level === HeadingLevel.HEADING_1 ? TEAL : GREEN,
        font: "Calibri"
      })
    ],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text,
        size: 22,
        font: "Calibri",
        color: opts.color || BLACK,
        bold: !!opts.bold,
        italics: !!opts.italics
      })
    ],
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

// ─── Estilos de Tablas ────────────────────────────────────────────────
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function headerCell(text, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: TEAL },
    borders,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Calibri", size: 20 })],
      }),
    ],
  });
}

function cell(text, widthPct, opts = {}) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: opts.bg ? { type: ShadingType.SOLID, color: opts.bg } : undefined,
    borders,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            size: 20,
            font: opts.mono ? "Consolas" : "Calibri",
            color: opts.color || BLACK,
            bold: !!opts.bold,
          }),
        ],
      }),
    ],
  });
}

function statusCell(status, widthPct) {
  const isComplete = status.includes("COMPLETO");
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: isComplete ? "E8F5E9" : "FFF3E0" },
    borders,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: status,
            size: 20,
            font: "Calibri",
            bold: true,
            color: isComplete ? GREEN : "E65100",
          }),
        ],
      }),
    ],
  });
}

// ─── Document Definition ──────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22, color: BLACK },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1),
          right: convertInchesToTwip(1),
        },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "biblioSmart · Informe Técnico Sprint 3 (Frontend)", size: 18, color: GREY, italics: true }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "biblioSmart — Sistema de Gestión Bibliotecaria Inteligente | Antigravity IDE", size: 18, color: GREY }),
            ],
          }),
        ],
      }),
    },
    children: [
      // Portada
      title("biblioSmart"),
      subtitle("Informe de Cumplimiento Técnico — Sprint 3: Desarrollo del Frontend"),
      meta("Semana 3 | Entorno de Desarrollo: Antigravity IDE | Fecha: Noviembre 2026"),

      para("El presente informe documenta de forma exhaustiva el trabajo realizado en el Sprint 3 para el proyecto biblioSmart (Sistema de Gestión Bibliotecaria Inteligente). Se presenta la evaluación y clasificación de cada uno de los 5 puntos del plan de desarrollo, el desglose de los componentes construidos, la arquitectura de integración con la API RESTful en PHP 8.2, las validaciones implementadas, la suite de pruebas ejecutadas y las verificaciones de extremo a extremo."),

      // Sección 1: Clasificación de los Puntos del Plan
      heading("1. Clasificación del Estado del Plan (Sprint 3)"),
      para("A continuación se presenta el diagnóstico formal de cada uno de los cinco puntos centrales requeridos para la entrega de la Semana 3:"),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              headerCell("Punto del Plan", 30),
              headerCell("Estado Inicial", 20),
              headerCell("Estado Final", 20),
              headerCell("Evidencia / Cobertura", 30),
            ],
          }),
          new TableRow({
            children: [
              cell("1. Construir las interfaces de usuario", 30, { bold: true }),
              cell("Incompleto", 20, { color: "888888" }),
              statusCell("COMPLETO", 20),
              cell("9 vistas React (Catálogo, Mostrador, Préstamos/Reservas, Salas, Categorías, Admin, IA, Modales y Navegación Móvil).", 30),
            ],
          }),
          new TableRow({
            children: [
              cell("2. Integrar el frontend con la API", 30, { bold: true }),
              cell("Incompleto", 20, { color: "888888" }),
              statusCell("COMPLETO", 20),
              cell("Cliente HTTP unificado (apiClient.ts) conectado a endpoints PHP 8.2 con autenticación Bearer JWT y manejo de errores.", 30),
            ],
          }),
          new TableRow({
            children: [
              cell("3. Implementar validaciones", 30, { bold: true }),
              cell("Incompleto", 20, { color: "888888" }),
              statusCell("COMPLETO", 20),
              cell("Validación multicapa: esquemas en backend (Validator.php HTTP 422) y formularios en frontend con feedback visual.", 30),
            ],
          }),
          new TableRow({
            children: [
              cell("4. Incorporar funcionalidades principales", 30, { bold: true }),
              cell("Incompleto", 20, { color: "888888" }),
              statusCell("COMPLETO", 20),
              cell("Préstamos con cálculo de días hábiles, renovación (máx 2), cola de reservas, cálculo de mora, auditoría de eventos y salas.", 30),
            ],
          }),
          new TableRow({
            children: [
              cell("5. Ejecutar pruebas de integración", 30, { bold: true }),
              cell("Inexistente", 20, { color: "888888" }),
              statusCell("COMPLETO", 20),
              cell("20 pruebas de integración E2E automatizadas (100% pasadas) y 51 pruebas unitarias backend (100% pasadas).", 30),
            ],
          }),
        ],
      }),

      para(""),
      para("Todos los puntos del plan se encuentran clasificados como COMPLETOS, habiendo satisfecho los criterios funcionales, de diseño responsivo y de consistencia técnica del proyecto."),

      new Paragraph({ children: [new PageBreak()] }),

      // Sección 2: Detalle de Cambios e Interfaces de Usuario
      heading("2. Construcción de Interfaces y Experiencia de Usuario (UI/UX)"),
      para("El frontend fue desarrollado utilizando React 18, TypeScript y Tailwind CSS, siguiendo la arquitectura de componentes y la paleta de diseño corporativo aprobada:"),
      bullet("Azul Petróleo (#183B4E): Elemento primario institucional, cabeceras, barras de título y tarjetas de administración."),
      bullet("Verde Esmeralda (#287A65): Acentos visuales, botones de confirmación, llamadas a la acción y estados de disponibilidad."),
      bullet("Beige Cálido (#F3EBDD) y Blanco Puro: Fondos luminosos y superficies de cristal translúcido (Glassmorphism)."),
      para(""),
      para("Principales componentes y vistas finalizadas:"),
      richBullet([{ text: "Catálogo de Libros (CatalogoView.tsx): ", bold: true }, { text: "Exploración de ejemplares con filtros dinámicos por categorías temáticas, búsqueda textual conceptual y tarjetas informativas con indicación de stock en tiempo real." }]),
      richBullet([{ text: "Modal de Ficha Técnica (LibroDetalleModal.tsx): ", bold: true }, { text: "Presenta sinopsis, autor, clasificación CDU, disponibilidad de copias físicas y botón condicional de 'Solicitar Préstamo' o 'Reservar Ejemplar' si el libro está agotado." }]),
      richBullet([{ text: "Mostrador de Circulación (MostradorView.tsx): ", bold: true }, { text: "Panel operativo para el personal bibliotecario con doble sección: registro de salida con verificación automática de solvencia (bloqueo por mora), cálculo de 8 días hábiles, tabla de devoluciones y nueva sección para gestión y entrega de la cola de reservas." }]),
      richBullet([{ text: "Gestión del Lector (MisPrestamosView.tsx): ", bold: true }, { text: "Panel privado donde el usuario consulta sus préstamos vigentes, alerta de días restantes, botón para renovar plazo de devolución (+12 días) y listado de sus reservas activas con opción de cancelación." }]),
      richBullet([{ text: "Directorio de Salas (SalasView.tsx): ", bold: true }, { text: "Visualización del plano arquitectónico isométrico de la biblioteca, directorio de salas físicas conectadas al backend (/api/salas) y consulta de estanterías." }]),
      richBullet([{ text: "Panel de Administración (AdminView.tsx): ", bold: true }, { text: "Consola integral para el rol ADMIN con métricas generales del acervo, auditoría en tiempo real de eventos del sistema (logs_sistema) y diagnóstico del motor de persistencia." }]),
      richBullet([{ text: "Navegación Móvil Responsiva: ", bold: true }, { text: "Barra inferior fija (bottom-nav) con safe-area para celulares y tablets, optimizando la ergonomía táctil y ocultando elementos redundantes en pantallas reducidas." }]),

      // Sección 3: Integración Frontend con la API
      heading("3. Integración del Frontend con la API RESTful"),
      para("La comunicación entre cliente y servidor se resolvió mediante un cliente unificado en src/lib/apiClient.ts, el cual encapsula las directivas de red del proyecto:"),
      bullet("Autenticación Bearer: Inyección automática de cabecera 'Authorization: Bearer <token>' a partir de tokens JWT almacenados en LocalStorage, manteniendo compatibilidad con cookies de sesión de PHP."),
      bullet("Control de Tiempos de Espera (Timeout): AbortController configurado con un límite estricto de 12 segundos por petición para evitar bloqueos por latencia de red."),
      bullet("Mapeo de Errores Tipados: Captura de respuestas con códigos de estado HTTP 400, 401, 403, 404, 409, 422 y 500, traduciéndolos a instancias de ApiRequestError para que la interfaz presente notificaciones amigables y accesibles."),
      bullet("Endpoints Conectados: Integración exitosa con /api/libros, /api/autores, /api/categorias, /api/salas, /api/prestamos, /api/prestamos/{id}/renovar, /api/prestamos/{id}/devolver, /api/reservas, /api/reservas/{id}/cancelar, /api/reservas/{id}/completar, /api/auth/login, /api/auth/me y /api/admin/metrics."),

      new Paragraph({ children: [new PageBreak()] }),

      // Sección 4: Lógica de Validaciones
      heading("4. Lógica de Validaciones de Datos y Reglas de Negocio"),
      para("Se diseñó un esquema de validación en dos capas para garantizar la integridad referencial y de negocio en todo momento:"),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              headerCell("Entidad / Operación", 25),
              headerCell("Regla de Validación", 40),
              headerCell("Respuesta del Sistema", 35),
            ],
          }),
          new TableRow({
            children: [
              cell("Registro de Libros", 25, { bold: true }),
              cell("ISBN-10 o 13 válido, año entre 1000 y año actual+1, copias_disponibles <= copias_totales.", 40),
              cell("HTTP 422 con objeto 'campos' indicando los errores de formato.", 35),
            ],
          }),
          new TableRow({
            children: [
              cell("Gestión de Usuarios", 25, { bold: true }),
              cell("Email corporativo válido, contraseña >= 6 caracteres, rol permitido (ADMIN, DOCENTE, LECTOR).", 40),
              cell("HTTP 422 si falta algún campo; HTTP 409 si el correo ya existe.", 35),
            ],
          }),
          new TableRow({
            children: [
              cell("Solicitud de Préstamo", 25, { bold: true }),
              cell("Verificación de solvencia: el lector no debe registrar préstamos con mora activa ni préstamos duplicados del mismo ejemplar.", 40),
              cell("HTTP 409 si el usuario está inhabilitado o ya posee el ejemplar en préstamo.", 35),
            ],
          }),
          new TableRow({
            children: [
              cell("Renovación de Préstamo", 25, { bold: true }),
              cell("Máximo 2 renovaciones permitidas. Debe estar ACTIVO y NO registrar reservas de otros lectores en cola.", 40),
              cell("HTTP 409 si superó 2 renovaciones o si hay una reserva pendiente en cola.", 35),
            ],
          }),
          new TableRow({
            children: [
              cell("Reserva de Ejemplar", 25, { bold: true }),
              cell("Solo permitida si el libro tiene copias_disponibles == 0. No permite reservas duplicadas del mismo usuario.", 40),
              cell("HTTP 409 si el libro tiene copias disponibles o el usuario ya reservó.", 35),
            ],
          }),
        ],
      }),

      para(""),

      // Sección 5: Pruebas de Integración y Resultados
      heading("5. Suite de Pruebas de Integración y Resultados"),
      para("Para certificar la estabilidad de la plataforma, se construyó y ejecutó una suite automatizada de pruebas de integración de extremo a extremo (backend-php/test_integracion_sprint3.php), complementando la batería unitaria existente:"),

      richBullet([{ text: "Pruebas de Integración E2E (test_integracion_sprint3.php): ", bold: true }, { text: "20 de 20 pruebas aprobadas (100% de éxito). Valida autenticación con JWT, rechazo HTTP 422 en validaciones de entrada, control de inventario, ciclo completo de préstamo -> reserva -> renovación -> devolución -> entrega de reserva." }]),
      richBullet([{ text: "Pruebas Unitarias Backend (test_sprint2.php): ", bold: true }, { text: "51 de 51 pruebas aprobadas (100% de éxito). Valida modelo relacional, integridad referencial, BCRYPT, claims de JWT, RBAC por roles y operaciones CRUD atómicas." }]),
      richBullet([{ text: "Compilación y Linter Frontend: ", bold: true }, { text: "Ejecución exitosa de 'tsc --noEmit' y 'vite build' con 0 errores de tipado o sintaxis, generando el paquete optimizado en dist/ en 1.92 segundos." }]),

      para(""),

      // Sección 6: Puntos Pendientes y Recomendaciones
      heading("6. Puntos Pendientes y Recomendaciones para Despliegue"),
      para("Dentro del alcance estipulado para el Sprint 3 (Desarrollo del Frontend), no existen puntos pendientes que impidan el funcionamiento total de la aplicación."),
      para("Recomendaciones de endurecimiento para la puesta en producción en servidor público:"),
      bullet("Gestión de Secretos: Configurar la variable de entorno JWT_SECRET en el servidor web de producción (Apache/Nginx) con una clave criptográfica de 256 bits única y rotativa."),
      bullet("Compatibilidad de Autenticación: Restringir el soporte para tokens numéricos heredados en Auth.php exclusivamente a entornos de prueba locales mediante la directiva APP_ENV=test."),
      bullet("Sincronización Git: Se suministró el asistente interactivo subir_a_github.bat en la raíz para permitir el envío de cambios al repositorio remoto con un solo clic."),

      para(""),
      para("Conclusión: La aplicación web biblioSmart se encuentra plenamente integrada, con validaciones robustas, interfaz responsiva y accesible, y con todas sus funcionalidades principales verificadas de extremo a extremo."),
    ],
  }],
});

// Generar archivo físico .docx
const outputPath = "docs/biblioSmart_Sprint3_Desarrollo_Frontend.docx";
const buffer = await Packer.toBuffer(doc);
writeFileSync(outputPath, buffer);
console.log(`[OK] Documento Sprint 3 generado exitosamente en: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
