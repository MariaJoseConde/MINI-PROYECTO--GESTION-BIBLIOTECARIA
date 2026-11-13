import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { db, logSystemEvent } from '../db.ts';
import { semanticSearchCache } from './cacheService.ts';
import { getLibrosByIds, searchLibrosLocal } from './catalogoService.ts';
import type {
  Libro,
  PreguntaEvaluacion,
  PruebaLectura,
  PruebaLecturaContenido,
  SearchResponse,
} from '../../types/sgbi.ts';

const GEMINI_TIMEOUT_MS = 8000;
const GEMINI_MODEL = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout de ${ms}ms excedido en ${label}`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function buscarSemantica(
  query: string,
  useIa: boolean,
  actorId: number | null,
  ipOrigen: string | null,
  simulateFailure: boolean = false,
): Promise<SearchResponse> {
  const start = Date.now();
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    const allBooks = searchLibrosLocal('');
    return {
      mode: 'local',
      latencyMs: Date.now() - start,
      query: cleanQuery,
      libros: allBooks,
    };
  }

  if (!useIa) {
    const localBooks = searchLibrosLocal(cleanQuery);
    return {
      mode: 'local',
      latencyMs: Date.now() - start,
      query: cleanQuery,
      libros: localBooks,
    };
  }

  try {
    if (simulateFailure) {
      throw new Error('Fallo simulado de conectividad con Gemini API');
    }

    const cachedIds = semanticSearchCache.get(cleanQuery);
    if (cachedIds) {
      const cachedLibros = getLibrosByIds(cachedIds);
      return {
        mode: 'ia',
        cached: true,
        latencyMs: Date.now() - start,
        query: cleanQuery,
        libros: cachedLibros,
      };
    }

    const ai = getAiClient();
    if (!ai) {
      throw new Error('GEMINI_API_KEY no configurada en el servidor');
    }

    const catalogRows = db
      .prepare(
        `SELECT l.id_libro, l.titulo, l.categoria, COALESCE(l.sinopsis, '') AS sinopsis,
                GROUP_CONCAT(a.nombre, ', ') AS autores
         FROM libros l
         LEFT JOIN libro_autor la ON la.id_libro = l.id_libro
         LEFT JOIN autores a ON a.id_autor = la.id_autor
         GROUP BY l.id_libro`,
      )
      .all() as Array<{
      id_libro: number;
      titulo: string;
      categoria: string;
      sinopsis: string;
      autores: string | null;
    }>;

    const minimizedCatalog = catalogRows.map((b) => ({
      id: b.id_libro,
      titulo: b.titulo,
      autores: b.autores || 'Desconocido',
      categoria: b.categoria,
      sinopsis: b.sinopsis.slice(0, 320),
    }));

    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Consulta del lector: "${cleanQuery}"\n\nCatálogo disponible (JSON):\n${JSON.stringify(minimizedCatalog)}`,
        config: {
          systemInstruction:
            'Eres un bibliotecario experto en clasificación temática y búsqueda semántica. Analiza la consulta en lenguaje natural del usuario y selecciona los IDs de los libros del catálogo que sean conceptualmente relevantes, ordenados del más relevante al menos relevante. Si ningún libro guarda relación semántica, devuelve un arreglo vacío.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ids_relevantes: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'Lista ordenada de id_libro relevantes para la consulta.',
              },
            },
            required: ['ids_relevantes'],
          },
        },
      }),
      GEMINI_TIMEOUT_MS,
      'Gemini Búsqueda Semántica',
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      ids_relevantes?: unknown;
    };

    if (!Array.isArray(parsed.ids_relevantes)) {
      throw new Error('Respuesta semántica sin arreglo ids_relevantes');
    }

    const ids = parsed.ids_relevantes.filter(
      (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
    );

    const libros = getLibrosByIds(ids);
    semanticSearchCache.set(cleanQuery, libros);
    const latencyMs = Date.now() - start;

    logSystemEvent(
      'IA_BUSQUEDA_SEMANTICA',
      `Consulta "${cleanQuery}" resuelta vía Gemini en ${latencyMs}ms (${libros.length} coincidencias).`,
      actorId,
      ipOrigen,
    );

    return {
      mode: 'ia',
      cached: false,
      latencyMs,
      query: cleanQuery,
      libros,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Error desconocido en servicio IA';
    const fallbackBooks = searchLibrosLocal(cleanQuery);
    const latencyMs = Date.now() - start;

    logSystemEvent(
      'IA_FALLBACK_FULLTEXT',
      `Fallback a FTS5 SQLite activado para "${cleanQuery}" (${latencyMs}ms). Motivo: ${reason}`,
      actorId,
      ipOrigen,
    );

    return {
      mode: 'fallback',
      fallbackReason: reason,
      latencyMs,
      query: cleanQuery,
      libros: fallbackBooks,
    };
  }
}

/**
 * Validador estricto PruebaLecturaDTO (TRD 3.3 & PRD 3.4):
 * - libro_id: entero positivo
 * - evaluacion: 3 a 5 preguntas
 * - Cada pregunta: pregunta string no vacío, opciones exactamente A,B,C,D no vacíos,
 *   respuesta_correcta en ['A','B','C','D'], justificacion string no vacío.
 */
export function validatePruebaLecturaDTO(
  raw: unknown,
  expectedLibroId: number,
  expectedTitulo: string,
): PruebaLecturaContenido {
  if (!raw || typeof raw !== 'object') {
    throw new Error('DTO inválido: el payload de evaluación no es un objeto JSON.');
  }

  const obj = raw as Record<string, unknown>;
  const evalArr = obj.evaluacion;

  if (!Array.isArray(evalArr)) {
    throw new Error('DTO inválido: falta el arreglo "evaluacion".');
  }

  if (evalArr.length < 3 || evalArr.length > 5) {
    throw new Error(
      `DTO inválido: se requieren entre 3 y 5 preguntas (recibidas: ${evalArr.length}).`,
    );
  }

  const validKeys = ['A', 'B', 'C', 'D'] as const;
  const preguntasValidadas: PreguntaEvaluacion[] = evalArr.map((item, idx) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`DTO inválido: la pregunta #${idx + 1} no es un objeto.`);
    }
    const q = item as Record<string, unknown>;

    if (typeof q.pregunta !== 'string' || q.pregunta.trim().length < 5) {
      throw new Error(`DTO inválido: enunciado vacío o demasiado corto en pregunta #${idx + 1}.`);
    }

    if (!q.opciones || typeof q.opciones !== 'object' || Array.isArray(q.opciones)) {
      throw new Error(`DTO inválido: faltan opciones A-D en pregunta #${idx + 1}.`);
    }

    const opts = q.opciones as Record<string, unknown>;
    const optKeys = Object.keys(opts);
    for (const key of validKeys) {
      if (typeof opts[key] !== 'string' || (opts[key] as string).trim().length === 0) {
        throw new Error(`DTO inválido: falta o está vacía la opción ${key} en pregunta #${idx + 1}.`);
      }
    }
    if (optKeys.length !== 4) {
      throw new Error(`DTO inválido: deben existir exactamente 4 opciones (A-D) en pregunta #${idx + 1}.`);
    }

    if (
      typeof q.respuesta_correcta !== 'string' ||
      !validKeys.includes(q.respuesta_correcta as 'A' | 'B' | 'C' | 'D')
    ) {
      throw new Error(
        `DTO inválido: respuesta_correcta inválida en pregunta #${idx + 1}.`,
      );
    }

    if (typeof q.justificacion !== 'string' || q.justificacion.trim().length < 5) {
      throw new Error(`DTO inválido: falta justificación pedagógica en pregunta #${idx + 1}.`);
    }

    return {
      pregunta: q.pregunta.trim(),
      opciones: {
        A: (opts.A as string).trim(),
        B: (opts.B as string).trim(),
        C: (opts.C as string).trim(),
        D: (opts.D as string).trim(),
      },
      respuesta_correcta: q.respuesta_correcta as 'A' | 'B' | 'C' | 'D',
      justificacion: q.justificacion.trim(),
    };
  });

  return {
    libro_id: expectedLibroId,
    titulo_libro: expectedTitulo,
    evaluacion: preguntasValidadas,
  };
}

export async function generarYGuardarPrueba(
  libro: Libro,
  docenteId: number,
  ipOrigen: string | null,
): Promise<PruebaLectura> {
  if (!libro.sinopsis || libro.sinopsis.trim().length < 20) {
    throw new Error(
      'Este libro no tiene una sinopsis descriptiva registrada para generar una prueba.',
    );
  }

  const ai = getAiClient();
  if (!ai) {
    throw new Error(
      'No hay una clave GEMINI_API_KEY configurada en el entorno del servidor para generar la prueba.',
    );
  }

  const autoresTexto = libro.autores.map((a) => a.nombre).join(', ') || 'Autor no especificado';
  const start = Date.now();

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Genera una evaluación de comprensión lectora de exactamente 4 preguntas de selección múltiple (A, B, C, D) basadas exclusivamente en la siguiente obra:\n\nTítulo: ${libro.titulo}\nAutores: ${autoresTexto}\nCategoría: ${libro.categoria}\nSinopsis: ${libro.sinopsis}`,
      config: {
        systemInstruction:
          'Eres un docente especialista en pedagogía y comprensión lectora. Redacta en español claro preguntas analíticas con 4 opciones plausibles (A, B, C, D), una sola respuesta correcta y una justificación pedagógica breve y precisa.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            libro_id: { type: Type.INTEGER },
            evaluacion: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pregunta: { type: Type.STRING },
                  opciones: {
                    type: Type.OBJECT,
                    properties: {
                      A: { type: Type.STRING },
                      B: { type: Type.STRING },
                      C: { type: Type.STRING },
                      D: { type: Type.STRING },
                    },
                    required: ['A', 'B', 'C', 'D'],
                  },
                  respuesta_correcta: { type: Type.STRING },
                  justificacion: { type: Type.STRING },
                },
                required: ['pregunta', 'opciones', 'respuesta_correcta', 'justificacion'],
              },
            },
          },
          required: ['libro_id', 'evaluacion'],
        },
      },
    }),
    15000,
    'Gemini Generación de Prueba',
  );

  const rawJson = JSON.parse((response.text ?? '{}').trim()) as unknown;
  const validatedDto = validatePruebaLecturaDTO(rawJson, libro.id_libro, libro.titulo);

  const insertRes = db
    .prepare(
      `INSERT INTO pruebas_lectura (id_libro, id_docente, contenido_json) VALUES (?, ?, ?)`,
    )
    .run(libro.id_libro, docenteId, JSON.stringify(validatedDto));

  const idPrueba = Number(insertRes.lastInsertRowid);
  const latencyMs = Date.now() - start;

  logSystemEvent(
    'IA_PRUEBA_GENERADA',
    `Prueba #${idPrueba} generada para "${libro.titulo}" (${validatedDto.evaluacion.length} preguntas) en ${latencyMs}ms.`,
    docenteId,
    ipOrigen,
  );

  const row = db
    .prepare(
      `SELECT p.*, u.nombre_completo AS docente_nombre, l.titulo AS libro_titulo
       FROM pruebas_lectura p
       JOIN usuarios u ON u.id_usuario = p.id_docente
       JOIN libros l ON l.id_libro = p.id_libro
       WHERE p.id_prueba = ?`,
    )
    .get(idPrueba) as {
    id_prueba: number;
    id_libro: number;
    id_docente: number;
    docente_nombre: string;
    libro_titulo: string;
    contenido_json: string;
    created_at: string;
  };

  return {
    id_prueba: row.id_prueba,
    id_libro: row.id_libro,
    id_docente: row.id_docente,
    docente_nombre: row.docente_nombre,
    libro_titulo: row.libro_titulo,
    contenido: JSON.parse(row.contenido_json) as PruebaLecturaContenido,
    created_at: row.created_at,
  };
}

export async function checkGeminiConnectivity(): Promise<{ ok: boolean; detail: string }> {
  const ai = getAiClient();
  if (!ai) {
    return { ok: false, detail: 'GEMINI_API_KEY no configurada' };
  }
  return { ok: true, detail: `Cliente ${GEMINI_MODEL} inicializado` };
}
