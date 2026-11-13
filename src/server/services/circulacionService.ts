import { db, logSystemEvent } from '../db.ts';
import type { Prestamo, Usuario } from '../../types/sgbi.ts';

export class CirculacionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Suma exactamente N días hábiles (por defecto 8) omitiendo sábados y domingos.
 */
export function calcularFechaLimite(inicio: Date = new Date(), diasHabiles: number = 8): string {
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  let contados = 0;
  while (contados < diasHabiles) {
    cursor.setDate(cursor.getDate() + 1);
    const dayOfWeek = cursor.getDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      contados++;
    }
  }
  return formatIsoDate(cursor);
}

export function getPrestamoConDetalles(idPrestamo: number): Prestamo | null {
  const row = db
    .prepare(
      `SELECT
        p.*,
        l.titulo AS libro_titulo,
        l.isbn AS libro_isbn,
        u.nombre_completo AS usuario_nombre,
        u.numero_documento AS usuario_documento,
        u.estado AS usuario_estado
      FROM prestamos p
      JOIN libros l ON l.id_libro = p.id_libro
      JOIN usuarios u ON u.id_usuario = p.id_usuario
      WHERE p.id_prestamo = ?`,
    )
    .get(idPrestamo) as Prestamo | undefined;
  return row ?? null;
}

export function registrarPrestamo(
  libroId: number,
  usuarioId: number,
  actorId: number | null,
  ipOrigen: string | null,
): Prestamo {
  const tx = db.transaction(() => {
    const usuario = db
      .prepare('SELECT id_usuario, nombre_completo, numero_documento, estado FROM usuarios WHERE id_usuario = ?')
      .get(usuarioId) as Pick<Usuario, 'id_usuario' | 'nombre_completo' | 'numero_documento' | 'estado'> | undefined;

    if (!usuario) {
      throw new CirculacionError('El lector especificado no existe en el sistema.', 404, 'USUARIO_NO_ENCONTRADO');
    }

    if (usuario.estado === 'SANCIONADO') {
      throw new CirculacionError(
        `El lector ${usuario.nombre_completo} se encuentra en estado SANCIONADO y no puede retirar ejemplares.`,
        409,
        'USUARIO_SANCIONADO',
      );
    }

    const moraActiva = db
      .prepare(
        `SELECT COUNT(*) AS total FROM prestamos WHERE id_usuario = ? AND estado = 'MORA'`,
      )
      .get(usuarioId) as { total: number };

    if (moraActiva.total > 0) {
      throw new CirculacionError(
        'El lector tiene préstamos vencidos en mora pendientes de devolución.',
        409,
        'USUARIO_EN_MORA',
      );
    }

    const libro = db
      .prepare('SELECT id_libro, titulo, copias_disp FROM libros WHERE id_libro = ?')
      .get(libroId) as { id_libro: number; titulo: string; copias_disp: number } | undefined;

    if (!libro) {
      throw new CirculacionError('El libro solicitado no existe en el catálogo.', 404, 'LIBRO_NO_ENCONTRADO');
    }

    // Actualización atómica condicional con bloqueo inmediato de escritura en SQLite WAL
    const updateStock = db
      .prepare(
        `UPDATE libros
         SET copias_disp = copias_disp - 1
         WHERE id_libro = ? AND copias_disp > 0`,
      )
      .run(libroId);

    if (updateStock.changes === 0) {
      throw new CirculacionError(
        'Ejemplar no disponible. No quedan copias disponibles en sala.',
        409,
        'SIN_STOCK',
      );
    }

    const hoy = new Date();
    const fechaPrestamo = formatIsoDate(hoy);
    const fechaLimite = calcularFechaLimite(hoy, 8);

    const insertRes = db
      .prepare(
        `INSERT INTO prestamos (id_libro, id_usuario, fecha_prestamo, fecha_limite, estado)
         VALUES (?, ?, ?, ?, 'ACTIVO')`,
      )
      .run(libroId, usuarioId, fechaPrestamo, fechaLimite);

    const newLoanId = Number(insertRes.lastInsertRowid);

    logSystemEvent(
      'PRESTAMO_REGISTRADO',
      `Folio #${newLoanId}: "${libro.titulo}" prestado a ${usuario.nombre_completo} (Doc: ${usuario.numero_documento}). Límite: ${fechaLimite}.`,
      actorId,
      ipOrigen,
    );

    const created = getPrestamoConDetalles(newLoanId);
    if (!created) {
      throw new CirculacionError('Error al recuperar el comprobante del préstamo.', 500, 'ERROR_INTERNO');
    }
    return created;
  });

  // .immediate() adquiere un bloqueo RESERVED desde el inicio para evitar condiciones de carrera
  return tx.immediate();
}

export function registrarDevolucion(
  prestamoId: number,
  actorId: number | null,
  ipOrigen: string | null,
): { prestamo: Prestamo; enMora: boolean; usuarioSancionado: boolean } {
  const tx = db.transaction(() => {
    const prestamo = db
      .prepare('SELECT * FROM prestamos WHERE id_prestamo = ?')
      .get(prestamoId) as Prestamo | undefined;

    if (!prestamo) {
      throw new CirculacionError('El préstamo especificado no existe.', 404, 'PRESTAMO_NO_ENCONTRADO');
    }

    if (prestamo.estado === 'DEVUELTO') {
      throw new CirculacionError('Este préstamo ya fue devuelto anteriormente.', 409, 'YA_DEVUELTO');
    }

    const fechaEntrega = formatIsoDate(new Date());
    const enMora = fechaEntrega > prestamo.fecha_limite || prestamo.estado === 'MORA';
    const nuevoEstadoPrestamo = enMora ? 'MORA' : 'DEVUELTO';

    // Si estaba en MORA y se entrega tarde, la entrega cierra la circulación física pero conserva el registro histórico de mora/devolución:
    // Según PRD 3.2.4 & 3.2.5: "cambiar el estado del préstamo a DEVUELTO e incrementar en 1 el valor de copias_disp. Si la fecha real de devolución es posterior a fecha_limite, el préstamo pasa a estado MORA y el usuario pasa automáticamente a estado SANCIONADO."
    // Nota: marcamos fecha_entrega para saber que ya reingresó físicamente, y estado = 'MORA' o 'DEVUELTO' según fecha_limite.
    db.prepare(
      `UPDATE prestamos
       SET fecha_entrega = ?, estado = ?
       WHERE id_prestamo = ?`,
    ).run(fechaEntrega, nuevoEstadoPrestamo, prestamoId);

    const stockUpdate = db
      .prepare(
        `UPDATE libros
         SET copias_disp = MIN(copias_totales, copias_disp + 1)
         WHERE id_libro = ?`,
      )
      .run(prestamo.id_libro);

    if (stockUpdate.changes === 0) {
      throw new CirculacionError('No se pudo reintegrar el stock del libro.', 500, 'ERROR_STOCK');
    }

    let usuarioSancionado = false;
    if (enMora) {
      db.prepare(`UPDATE usuarios SET estado = 'SANCIONADO' WHERE id_usuario = ?`).run(
        prestamo.id_usuario,
      );
      usuarioSancionado = true;
    }

    const updated = getPrestamoConDetalles(prestamoId)!;

    logSystemEvent(
      enMora ? 'DEVOLUCION_CON_MORA' : 'DEVOLUCION_REGISTRADA',
      `Folio #${prestamoId} devuelto el ${fechaEntrega} (límite ${prestamo.fecha_limite}). Estado: ${nuevoEstadoPrestamo}.${enMora ? ' Usuario marcado como SANCIONADO.' : ''}`,
      actorId,
      ipOrigen,
    );

    return {
      prestamo: updated,
      enMora,
      usuarioSancionado,
    };
  });

  return tx.immediate();
}
