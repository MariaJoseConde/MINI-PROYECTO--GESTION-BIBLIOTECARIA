# User Flow: Flujo de Navegación e Interacción

## Sistema de Gestión Bibliotecaria Inteligente (SGBI)

## 1. Punto de Partida y Matriz de Acceso

* **Punto de Entrada Primario:** La raíz (`/`) carga la **Landing Page con Catálogo Público Abierto**, permitiendo explorar libros y probar el buscador semántico sin registro previo.
* **Acceso a Módulos Privados:** Botón visible en el Navbar *"Iniciar Sesión"* (`/login.php`).

```plaintext
[Visitante Anónimo] ───────────> [Catálogo Público] ───> [Buscador / Sinopsis]
                                        │
                                 (Iniciar Sesión)
                                        │
                                        ▼
                                 [Formulario Login]
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
      [Rol LECTOR]                [Rol DOCENTE]                [Rol ADMIN]
           │                            │                            │
   - Ver disponibilidad        - Ver catálogo completo      - Control total inventario
   - Historial de préstamos    - "Generar Prueba (IA)"      - Mostrador de Circulación
   - Estado de cuenta          - Exportar evaluaciones      - Auditoría y Usuarios
```

---

## 2. Diagramas de Flujos Críticos (Happy Paths)

### 2.1 Flujo Operacional A: Circulación en Mostrador (Rol ADMIN)

```plaintext
[Inicio: Mostrador de Préstamos (/prestamos/mostrador.php)]
                         │
                         ▼
           [Ingreso de Cédula de Usuario]
                         │
                         ▼
        ¿Usuario ACTIVO y sin préstamos en mora?
                 ├── NO ──> [Borde Rojo + Botón Bloqueado + Alerta de Morosidad]
                 └── SÍ
                         │
                         ▼
         [Búsqueda / Escaneo de ISBN del Libro]
                         │
                         ▼
               ¿Tiene copias_disp >= 1?
                 ├── NO ──> [Badge Gris "Agotado en sala" + Botón Deshabilitado]
                 └── SÍ
                         │
                         ▼
       [Cálculo Automático: Fecha Límite (+8 Días Hábiles)]
                         │
                         ▼
           [Clic en "Confirmar Préstamo"]
                         │
                         ▼
       [Transacción MySQL: INSERT prestamo + UPDATE copias_disp = copias_disp - 1]
                         │
                         ▼
    [Toast Verde + Modal con Folio y Botón "Imprimir Ticket"]
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
[Imprimir Comprobante]        [Registrar Nuevo Préstamo]
```

### 2.2 Flujo Operacional B: Búsqueda Semántica y Generación de Pruebas (Lector / Docente)

```plaintext
[Inicio: Barra de Búsqueda del Catálogo]
                         │
                         ▼
  [Usuario ingresa consulta temática en lenguaje natural]
  (Ej: "novelas sobre distopías tecnológicas y control social")
                         │
                         ▼
             [Clic en "Búsqueda Inteligente"]
                         │
                         ▼
      [Petición Asíncrona Fetch a /api/ia/buscar]
      (Grid muestra Skeletons animados con Shimmer)
                         │
                         ▼
             ¿Gemini responde en <= 8 seg?
                 ├── NO / Error ──> [Conmutación a FULLTEXT MySQL + Toast Informativo]
                 └── SÍ
                         │
                         ▼
    [Renderizado de Tarjetas de Libros por Afinidad Semántica]
                         │
                         ▼
       [Docente hace clic en "Ver Ficha del Libro"]
                         │
                         ▼
           ¿Libro contiene sinopsis registrada?
                 ├── NO ──> [Botón IA Deshabilitado + Tooltip de advertencia]
                 └── SÍ
                         │
                         ▼
       [Docente hace clic en "Generar Prueba (IA)"]
                         │
                         ▼
       [Modal Activo con Spinner y Barra de Progreso]
                         │
                         ▼
    [Validación backend vía PruebaLecturaDTO (3 a 5 preguntas)]
                         │
                         ▼
           [Persistencia JSON en pruebas_lectura]
                         │
                         ▼
     [Despliegue del Cuestionario Estructurado en Pantalla]
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
[Descargar Evaluación PDF (Alumno)] [Ver Clave Argumentada (Docente)]
```

---

## 3. Matriz de Estados de Interfaz (UI States)

| Pantalla / Componente | Estado de Carga (*Loading*) | Estado Vacío (*Empty State*) | Tratamiento de Error |
| :--- | :--- | :--- | :--- |
| **Buscador de Catálogo** | Skeletons pulsantes (`animate-pulse`) simulando portadas y textos. | Ilustración de libro abierto + *"No se encontraron obras afines. Intenta con términos generales"*. | Toast informativo: *"Servicio IA no disponible. Mostrando resultados de catálogo local"*. |
| **Mostrador de Préstamos** | Indicador circular giratorio junto al campo de documento al validar vía fetch. | Mensaje neutro: *"Ingrese el documento del lector para iniciar la operación"*. | Borde rojo en campo de entrada + mensaje descriptivo de campo requerido. |
| **Modal de Prueba IA** | Botón deshabilitado con spinner verde y texto *"Analizando obra y estructurando preguntas..."*. | N/A (modal condicionado a la existencia del libro). | Alerta roja en modal: *"No fue posible generar la prueba. Verifique la sinopsis e intente de nuevo"*. |
| **Tabla de Devoluciones** | Shimmer en la fila mientras se confirma el reingreso del ejemplar. | Icono de verificación + *"No hay préstamos activos pendientes de entrega"*. | Toast rojo flotante: *"Error al registrar la devolución. Operación abortada"*. |

---

## 4. Gestión de Bifurcaciones y Escenarios Alternativos (Edge Cases)

```plaintext
                              [ESCENARIOS ALTERNATIVOS]
                                          │
    ┌───────────────────────┬─────────────┴─────────────┬────────────────────────┐
    ▼                       ▼                           ▼                        ▼
[Usuario Sancionado]    [Stock Agotado]             [Timeout de IA]          [Sin Sinopsis]
    │                       │                           │                        │
    ▼                       ▼                           ▼                        ▼
- Bloqueo de préstamo   - Deshabilita selector      - Conmutación a SQL      - Deshabilita botón
- Borde rojo carmesí    - Badge "Agotado en sala"     FULLTEXT en MySQL        con candado
- Banner: "Usuario      - HTTP 409 si ocurre        - Toast informativo      - Tooltip explicativo
  con mora activa"        concurrencia                sin romper vista         para el docente
```

1. **Lector en Mora o Sancionado:**
   * La interfaz detecta el estado en mostrador y bloquea el botón *"Confirmar Préstamo"*.
   * Despliega un enlace directo: *"Ver préstamos en mora de este usuario"* para facilitar la devolución en el mismo flujo.
2. **Condición de Carrera en Mostrador ($copias\_disp = 1$):**
   * Si dos bibliotecarios envían la petición de forma casi simultánea, la segunda solicitud recibe una respuesta HTTP 409 (*Conflict*).
   * La interfaz muestra un toast de advertencia: *"El último ejemplar acaba de ser prestado por otro mostrador. Stock agotado"*.
3. **Falla o Latencia Excesiva de Gemini API:**
   * Al cumplirse 8 segundos de espera, la conexión se interrumpe y el sistema ejecuta automáticamente la consulta `FULLTEXT` en MySQL.
   * La pantalla nunca muestra páginas en blanco ni errores 500.

---

## 5. Puntos de Salida y Feedback de Cierre (Success & Loopback)

* **Préstamo Completado:**
  * Modal de éxito con resumen del préstamo (folio, libro, fecha de salida y fecha límite).
  * Acciones disponibles:
    1. *"Imprimir Comprobante"* (lanza diálogo nativo `window.print()` con diseño de ticket).
    2. *"Registrar Otro Préstamo"* (limpia los campos y enfoca el input de lector para agilidad operativa).
* **Devolución Completada:**
  * Toast de éxito: *"Devolución registrada. Ejemplar reintegrado al inventario (+1 disponible)"*.
  * La fila correspondiente en la tabla cambia en tiempo real a estado `DEVUELTO` con badge neutro sin recargar la página.
* **Prueba de Lectura Generada:**
  * Transición fluida del estado de carga al cuestionario final.
  * Acciones disponibles:
    1. *"Descargar / Imprimir Evaluación (PDF)"* (versión pedagógica para el estudiante).
    2. *"Ver Clave de Corrección"* (acordeón interactivo con respuestas correctas y justificaciones).
    3. *"Cerrar y Volver al Catálogo"*.