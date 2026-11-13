# PLAN: Hoja de Ruta de Desarrollo (Roadmap)

## Sistema de Gestión Bibliotecaria Inteligente (SGBI)

## 1. Estrategia de Entrega y Priorización por Fases

El desarrollo se organiza en tres fases sucesivas bajo el principio de **"Arquitectura Primero"**, asegurando la estabilidad del núcleo transaccional ACID antes de incorporar integraciones de Inteligencia Artificial.

```plaintext
┌────────────────────────────────┐     ┌────────────────────────────────┐     ┌────────────────────────────────┐
│          FASE 1 (MVP)          │ ──> │    FASE 2 (ENRIQUECIMIENTO)    │ ──> │     FASE 3 (REFINAMIENTO)      │
│  Núcleo Operativo & Circulación│     │      Integración de IA         │     │     Operaciones & Testing      │
└────────────────────────────────┘     └────────────────────────────────┘     └────────────────────────────────┘
```

---

## 2. Desglose Secuencial de Hitos y Tareas Atómicas

### Capa Cero: Configuración Base de Infraestructura
* **TASK-00.1:** Inicializar repositorio Git y estructurar directorios base (`config/`, `src/`, `views/`, `public/`, `storage/`).
* **TASK-00.2:** Crear `docker-compose.yml` y `Dockerfile` (PHP 8.2 + Apache + MySQL 8.0).
* **TASK-00.3:** Implementar clase `Database.php` (conexión Singleton PDO con transacciones y manejo de excepciones).
* **TASK-00.4:** Crear maquetación base responsiva con Tailwind CSS CDN (`header.php`, `navbar.php`, `footer.php`).

---

### Hito 1: Fase 1 — MVP Operativo Transaccional
*Enfoque vertical: Cada funcionalidad se construye completa desde la migración hasta la vista UI.*

* **Módulo 1: Catálogo e Inventario**
  * **TASK-01.1:** Escribir y ejecutar migraciones `001_create_autores_table.sql`, `002_create_libros_table.sql` y `003_create_libro_autor_table.sql`.
  * **TASK-01.2:** Implementar modelo `Libro.php` con métodos PDO para inserción, edición y comprobación de ISBN duplicado.
  * **TASK-01.3:** Crear `LibroController.php` con validaciones de formulario para `copias_totales` y `copias_disp`.
  * **TASK-01.4:** Desarrollar vista de catálogo (`views/libros/index.php`) con tarjetas de libros y badges de stock en tiempo real.

* **Módulo 2: Autenticación y RBAC**
  * **TASK-01.5:** Escribir y ejecutar migración `004_create_usuarios_table.sql`.
  * **TASK-01.6:** Implementar `Usuario.php` con métodos de verificación con `password_verify()` y control de estado (`ACTIVO` / `SANCIONADO`).
  * **TASK-01.7:** Crear controlador de sesión y vistas de login/logout.

* **Módulo 3: Circulación y Mostrador**
  * **TASK-01.8:** Escribir y ejecutar migración `005_create_prestamos_table.sql`.
  * **TASK-01.9:** Implementar `CirculacionService::calcularFechaLimite(DateTime $inicio, int $dias = 8): DateTime` omitiendo fines de semana.
  * **TASK-01.10:** Implementar método transaccional atómico `CirculacionService::registrarPrestamo(int $libroId, int $usuarioId)` con `SELECT ... FOR UPDATE` y decremento de stock.
  * **TASK-01.11:** Implementar método transaccional `CirculacionService::registrarDevolucion(int $prestamoId)` con reintegro de stock e inspección de morosidad (`MORA` / `SANCIONADO`).
  * **TASK-01.12:** Construir vista de mostrador (`views/prestamos/mostrador.php`) con autocompletado reactivo vía `fetch()`.

---

### Hito 2: Fase 2 — Enriquecimiento e Inteligencia Artificial
* **Módulo 1: Cliente BFF y Resiliencia**
  * **TASK-02.1:** Configurar parseo de `.env` en `config/app.php` fuera del DocumentRoot.
  * **TASK-02.2:** Desarrollar `GeminiClient.php` con cURL nativo, headers `x-goog-api-key`, `response_mime_type: application/json` y timeout estricto de 8 segundos.
  * **TASK-02.3:** Crear endpoint interno proxy `POST /api/ia/buscar` en `public/api.php`.

* **Módulo 2: Búsqueda Semántica Inteligente**
  * **TASK-02.4:** Implementar índice `FULLTEXT` en MySQL sobre `(titulo, sinopsis)`.
  * **TASK-02.5:** Programar lógica de dos niveles en backend: análisis conceptual con Gemini y fallback transparente a `MATCH(...) AGAINST(...)`.
  * **TASK-02.6:** Integrar módulo JavaScript `catalogo.js` con buscador reactivo, skeletons de carga y banners no intrusivos de fallback.

* **Módulo 3: Generación de Pruebas de Lectura**
  * **TASK-02.7:** Escribir migración `006_create_pruebas_lectura_table.sql`.
  * **TASK-02.8:** Implementar `PruebaLecturaDTO.php` para validar estrictamente la presencia de 3 a 5 preguntas, 4 opciones (A-D) y justificación.
  * **TASK-02.9:** Implementar `IaController::generarPrueba()` conectando Gemini, validando el DTO y persistiendo en base de datos.
  * **TASK-02.10:** Diseñar modal interactivo en frontend con indicador de carga y renderizado de preguntas y clave para el docente.

---

### Hito 3: Fase 3 — Refinamiento, Operaciones y Cierre
* **Módulo 1: Salidas Pedagógicas y Comprobantes**
  * **TASK-03.1:** Crear plantilla CSS imprimible (`@media print`) para comprobante de préstamo en formato ticket.
  * **TASK-03.2:** Crear vista imprimible de evaluación pedagógica para estudiantes (sin respuestas) y hoja de claves para el docente.

* **Módulo 2: Telemetría y Observabilidad**
  * **TASK-03.3:** Escribir migración `007_create_logs_sistema_table.sql`.
  * **TASK-03.4:** Crear servicio de logging dual (tabla relacional `logs_sistema` y archivos en `storage/logs/`).
  * **TASK-03.5:** Desarrollar endpoint de diagnóstico `public/health.php`.

* **Módulo 3: Suite de Pruebas y Validación**
  * **TASK-03.6:** Configurar PHPUnit y escribir tests unitarios de `CirculacionService` y `PruebaLecturaDTO`.
  * **TASK-03.7:** Escribir tests de integración con base de datos de pruebas para validar transacciones e integridad referencial (`ON DELETE RESTRICT`).
  * **TASK-03.8:** Ejecutar pruebas de estrés para verificar ausencia de condiciones de carrera con $copias\_disp = 1$.

---

## 3. Puertas de Calidad con Validación Humana (Validation Gates)

| Puerta de Calidad | Momento de Activación | Criterio de Aprobación Obligatorio |
| :--- | :--- | :--- |
| **Gate 1: Esquema Relacional y Restricciones** | Fin de Capa Cero y Tareas 01.1 / 01.5 / 01.8. | Revisión de DDL: verificación de `ENGINE=InnoDB`, claves foráneas con `ON DELETE RESTRICT` en préstamos, índices `FULLTEXT` y restricciones `CHECK`. |
| **Gate 2: Transaccionalidad y Concurrencia** | Fin del Módulo 3 del MVP. | Prueba de estrés concurrente: 2 peticiones simultáneas sobre libro con `copias_disp = 1`. Aprobado solo si una tiene éxito, la otra retorna 409 y el stock no es negativo. |
| **Gate 3: Resiliencia del Fallback de IA** | Fin del Módulo 2 de la Fase 2. | Prueba simulando desconexión de red o timeout (> 8s) hacia Gemini. Aprobado si conmuta a `MATCH(...) AGAINST(...)` en MySQL sin pantalla en blanco y emite log. |
| **Gate 4: Estrictez del Esquema JSON** | Fin del Módulo 3 de la Fase 2. | Inyección de payloads defectuosos (2 preguntas, 5 opciones, llaves faltantes). Aprobado si el DTO rechaza la inserción en base de datos. |

---

## 4. Estrategia de Despliegue (Vibe Deploying)

1. **Entorno Local:** Orquestado con `docker compose up -d` para desarrollo inmediato y reproducible sin discrepancias de entorno.
2. **Entorno de Staging (Evaluación Externa):** Repositorio conectado mediante webhook a un PaaS (Render / Railway) con runtime PHP 8.2 y base de datos MySQL 8.0 gestionada, proporcionando una URL pública HTTPS para revisión y pruebas de usuarios.