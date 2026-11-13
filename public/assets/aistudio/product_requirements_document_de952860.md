# Product Requirements Document (PRD)

## Sistema de Gestión Bibliotecaria Inteligente (SGBI)

---

## 1. El Problema y los Objetivos de Éxito (El "Porqué" de negocio)

### 1.1 Declaración del Problema Exacto
El manejo de los procesos centrales en bibliotecas comunitarias o escolares mediante cuadernos físicos y hojas de cálculo no transaccionales provoca cuatro fallas críticas en la operación:
1. **Desbalance de inventario:** Inconsistencia recurrente entre las existencias físicas en anaqueles y los registros del catálogo debido a la falta de operaciones atómicas en cada salida o entrega.
2. **Falta de trazabilidad en la circulación:** Imposibilidad de controlar de forma automatizada las fechas de vencimiento de préstamos, dificultando la detección de morosidad y la aplicación oportuna de suspensiones.
3. **Pérdida de rotación del catálogo:** Los motores de búsqueda convencionales exigen coincidencia léxica exacta por título o autor; si el lector desconoce los términos técnicos o comete errores tipográficos, no encuentra el material disponible.
4. **Sobrecarga en la evaluación pedagógica:** Docentes y bibliotecarios invierten tiempo manual excesivo redactando evaluaciones de comprensión lectora sobre las obras del acervo.

### 1.2 Propuesta de Valor
Proveer una plataforma web transaccional centralizada que garantice el control en tiempo real del inventario físico y la circulación de préstamos en MySQL bajo garantías ACID, enriquecida con capacidades de Inteligencia Artificial para democratizar la localización de obras mediante búsqueda semántica en lenguaje natural y optimizar la labor docente con la generación automatizada de pruebas de lectura estructuradas a partir de las sinopsis registradas.

### 1.3 Métricas de Éxito y Metas (KPIs)
* **Tasa de discrepancia de stock:** Reducción a 0% de pérdidas de inventario físico no registradas gracias al control de transacciones ACID en InnoDB.
* **Índice de recuperación a tiempo:** Disminución del 80% en los índices de morosidad mediante el cálculo automático de plazos de entrega y bloqueo preventivo de usuarios con préstamos vencidos.
* **Tiempo de atención en mostrador:** Reducción del tiempo de registro de préstamos y devoluciones a menos de 30 segundos por operación.
* **Tasa de éxito en la búsqueda:** 100% de consultas temáticas o conceptuales atendidas (con resultados devueltos por IA o degradación limpia mediante respaldo SQL tradicional).
* **Tiempo de formulación evaluativa:** Generación de cuestionarios de comprensión lectora en menos de 10 segundos, reduciendo al mínimo el tiempo manual de diseño pedagógico.

---

## 2. Los Usuarios, Roles y Permisos (El "Quién")

### 2.1 Usuarios Finales Beneficiarios
* **Personal Bibliotecario y Administrativo:** Encargados de la recepción, auditoría, control de estantería y entrega física de volúmenes.
* **Lectores y Estudiantes:** Usuarios que buscan títulos por afinidad conceptual, consultan el stock disponible en sala y monitorean sus fechas límite de préstamo.
* **Docentes e Instructores:** Profesores que aprovechan el acervo bibliográfico para diseñar evaluaciones de comprensión lectora estructuradas.

### 2.2 Matriz de Roles y Permisos (RBAC)

| Módulo / Acción | Visitante Anónimo | Rol LECTOR | Perfil DOCENTE | Rol ADMIN (Bibliotecario) |
| :--- | :--- | :--- | :--- | :--- |
| **Consultar Catálogo Público** | Permitido | Permitido | Permitido | Permitido |
| **Búsqueda Semántica con IA** | Permitido | Permitido | Permitido | Permitido |
| **Gestión (CRUD) Libros y Autores** | Denegado | Denegado | Denegado | Permitido |
| **Ajuste Directo de Stock (`copias_disp`)** | Denegado | Denegado | Denegado | Permitido |
| **Registro de Préstamos y Devoluciones** | Denegado | Denegado | Denegado | Permitido |
| **Consulta de Historial Personal** | Denegado | Propio | Propio | Global |
| **Generar Cuestionarios con IA** | Denegado | Denegado | Permitido | Permitido |
| **Descarga de Formatos Imprimibles** | Denegado | Denegado | Permitido | Permitido |
| **Gestión de Estados de Usuario** | Denegado | Denegado | Denegado | Permitido |

---

## 3. Las Funcionalidades y Criterios de Aceptación (El "Qué" funcional)

### 3.1 Módulo de Gestión de Catálogo e Inventario
* **Funcionalidad:** Alta y edición de libros y autores con discriminación entre `copias_totales` y `copias_disp`.
* **Criterios de Aceptación:**
  1. Debe impedir el guardado de libros con un código ISBN duplicado en la base de datos (`UNIQUE`).
  2. Debe permitir asociar un libro a uno o varios autores mediante la tabla asociativa `libro_autor`.
  3. `copias_disp` no puede ser superior a `copias_totales` ni aceptar valores negativos ($copias\_disp < 0$) en ningún escenario.

### 3.2 Módulo de Circulación (Préstamos y Devoluciones)
* **Funcionalidad:** Salida y reingreso físico de material con validación de estados y fechas.
* **Criterios de Aceptación:**
  1. Al solicitar un préstamo, el sistema debe verificar de forma obligatoria que el lector posea estado `ACTIVO` y que el libro tenga $copias\_disp > 0$.
  2. La creación del préstamo y el descuento de 1 unidad en `copias_disp` deben ejecutarse dentro de la misma transacción MySQL (`ENGINE=InnoDB`); si alguna falla, debe aplicarse `ROLLBACK`.
  3. El sistema debe asignar automáticamente la fecha límite sumando exactamente 8 días hábiles a la fecha del préstamo (omitiendo fines de semana).
  4. Al recibir la devolución, el sistema debe registrar `fecha_entrega`, cambiar el estado del préstamo a `DEVUELTO` e incrementar en 1 el valor de `copias_disp`.
  5. Si la fecha real de devolución es posterior a `fecha_limite`, el préstamo pasa a estado `MORA` y el usuario pasa automáticamente a estado `SANCIONADO`.

### 3.3 Módulo de Búsqueda Semántica Inteligente (IA)
* **Funcionalidad:** Localización de obras en lenguaje natural a partir del significado de las sinopsis.
* **Criterios de Aceptación:**
  1. La interfaz debe incluir un campo de búsqueda conceptual y un selector explícito de "Búsqueda IA".
  2. Las peticiones al endpoint proxy de IA deben tener un tiempo de espera máximo (*timeout*) de 8 segundos.
  3. Si la API externa no responde o devuelve un error, el sistema debe realizar una degradación controlada (*fallback*), ejecutando una consulta SQL convencional (`MATCH(...) AGAINST(... IN NATURAL LANGUAGE MODE)` o `LIKE %termino%`) e informando de forma no invasiva al usuario.

### 3.4 Módulo de Generación de Pruebas de Lectura (IA)
* **Funcionalidad:** Creación de cuestionarios de opción múltiple a partir de la sinopsis del libro.
* **Criterios de Aceptación:**
  1. El botón "Generar Prueba" solo debe habilitarse en libros que contengan una sinopsis descriptiva registrada.
  2. La IA debe estructurar el resultado en formato JSON estricto con: 3 a 5 preguntas, exactamente 4 opciones por pregunta (A, B, C, D), la opción correcta identificada y su justificación argumentada.
  3. La prueba generada debe persistirse en la tabla `pruebas_lectura` asociada a la clave foránea `id_libro`.

---

## 4. Límites, Restricciones y Exclusiones (El "No")

### 4.1 Restricciones Técnicas Obligatorias
* **Stack Tecnológico:** Backend exclusivo en PHP 8.x nativo y base de datos relacional MySQL 8.x. Prohibido el uso de frameworks pesados que impidan el despliegue directo en entornos LAMP/XAMPP.
* **Persistencia Transaccional:** Todas las tablas transaccionales deben utilizar obligatoriamente el motor de almacenamiento `ENGINE=InnoDB`. Queda prohibido el uso de MyISAM.
* **Seguridad contra Inyección SQL:** Todas las consultas a la base de datos deben ejecutarse mediante la extensión PDO utilizando sentencias preparadas (*prepared statements*) con paso de parámetros tipados. Prohibida la concatenación manual de variables en sentencias SQL.
* **Sanitización de Salidas:** Todo contenido renderizado en HTML debe pasar por `htmlspecialchars()` para mitigar vulnerabilidades XSS.
* **Aislamiento de Secretos:** La API Key de IA reside en el servidor (`.env` fuera de `public/`) y se consume únicamente a través del backend bajo el patrón BFF.

### 4.2 Exclusiones Explícitas del Sistema (Fuera de Alcance)
* **Pagos y Pasarelas:** Prohibido implementar lógica o librerías para cobro en línea de multas con tarjetas o pasarelas financieras.
* **Visores de Contenido Digital:** Prohibido implementar lectores de documentos en línea o descarga de libros completos en PDF/EPUB.
* **Hardware Especializado:** No se deben escribir controladores para antenas de radiofrecuencia (RFID) ni arcos de seguridad.
* **Canales de Mensajería:** Prohibido integrar librerías para envío de notificaciones automáticas vía SMS o la API de WhatsApp.

---

## 5. Expectativas de Pruebas y Comportamientos Críticos

### 5.1 Flujos Críticos a Validar
* **Préstamo en Concurrencia (Condición de Carrera):**
  * *Escenario:* Dos bibliotecarios intentan prestar el último ejemplar disponible ($copias\_disp = 1$) en el mismo instante.
  * *Comportamiento esperado:* La primera transacción confirmada descuenta el stock a 0; la segunda transacción debe abortar retornando HTTP 409 con el error descriptivo *"Ejemplar no disponible"*, impidiendo que `copias_disp` caiga a -1.
* **Integridad Referencial en Eliminaciones:**
  * *Escenario:* Un administrador intenta eliminar un libro que posee un préstamo en estado `ACTIVO` o `MORA`.
  * *Comportamiento esperado:* La base de datos debe rechazar la operación mediante la restricción `ON DELETE RESTRICT` de la clave foránea en la tabla `prestamos`.
* **Resiliencia de la API de IA (Fallback):**
  * *Escenario:* Se corta la conexión a Internet o la API de IA agota el tiempo de espera (más de 8 segundos).
  * *Comportamiento esperado:* El sistema no debe mostrar pantallas en blanco ni errores fatales de PHP (500); debe capturar la excepción y desplegar los resultados de búsqueda de la base de datos local usando concordancia SQL `FULLTEXT`.
* **Validación de Integridad del JSON de Pruebas:**
  * *Escenario:* La IA devuelve un texto mal estructurado que no cumple el formato JSON esperado o posee un número incorrecto de preguntas.
  * *Comportamiento esperado:* La validación en backend vía `PruebaLecturaDTO` detecta el fallo sintáctico o de estructura antes de intentar persistir en `pruebas_lectura`, notificando al usuario que la prueba no pudo ser procesada sin corromper la base de datos.