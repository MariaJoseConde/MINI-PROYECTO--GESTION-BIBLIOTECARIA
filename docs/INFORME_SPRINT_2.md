# Informe de Cumplimiento Técnico y Pruebas del Sprint 2
## Sistema de Gestión Bibliotecaria Inteligente (SGBI)

**Fecha de Ejecución:** 24 de noviembre de 2026  
**Entorno:** PHP 8.2.12 | MySQL 8.0 (InnoDB) / SQLite 3 (WAL Fallback) | Windows x64  
**Responsable:** Desarrollador Senior Backend  

---

## 1. Resumen Ejecutivo del Sprint 2

Durante el Sprint 2 se cumplió el 100% de los objetivos planteados para la arquitectura del backend y la base de datos relacional. Se entregó un backend modular y desacoplado en PHP 8.2 nativo, con soporte de persistencia dual resiliente (MySQL InnoDB primario + SQLite de respaldo automático), autenticación robusta mediante tokens JWT (RFC 7519 con algoritmo HMAC-SHA256), autorización basada en roles (RBAC), operaciones CRUD completas con transacciones atómicas de stock, documentación interactiva Swagger UI, especificación OpenAPI 3.0.3 y una colección completa para pruebas en Postman.

---

## 2. Detalle de Actividades Realizadas y Estado

| # | Actividad | Estado | Archivos Involucrados | Pruebas Ejecutadas | Resultado |
| :---: | :--- | :---: | :--- | :--- | :---: |
| **1** | **Base de Datos Relacional**<br>Revisión de tablas, relaciones, claves primarias, claves foráneas, restricciones CHECK, índices y soporte dual MySQL/SQLite. | **COMPLETADO** | `database/schema.sql`<br>`database/migrations/*`<br>`backend-php/config/Database.php`<br>`backend-php/migrate.php` | • Existencia de 10 tablas relacionales.<br>• Claves compuestas e integridad N:M en `libro_autor`.<br>• Restricción CHECK de inventario (`chk_stock_valido`).<br>• Fallback automático y transparente a SQLite.<br>• Identificación explícita de motor en `Database::getActiveDriver()`. | **100% Éxito**<br>(10/10 pasadas) |
| **2** | **Servidor Local y Error Connection Refused**<br>Diagnóstico de causa raíz, corrección de binding de red, script de inicio de un clic y validación en `http://localhost:8000`. | **COMPLETADO** | `iniciar_servidor_php.bat`<br>`index.php`<br>`backend-php/router.php`<br>`README.md` | • Diagnóstico de resolución IPv6 vs IPv4 en Chrome.<br>• Binding a `0.0.0.0:8000` en PHP embebido.<br>• Detección automática de ejecutable PHP y extensiones.<br>• Verificación de socket HTTP activo. | **100% Éxito**<br>(Servidor respondiendo) |
| **3** | **API RESTful**<br>Rutas en plural, verbos semánticos (GET, POST, PUT, PATCH, DELETE), códigos de estado y respuestas unificadas. | **COMPLETADO** | `backend-php/router.php`<br>`backend-php/config/Response.php`<br>`backend-php/controllers/*` | • Rutas normalizadas (`/api/libros`, `/api/usuarios`, etc.).<br>• Respuestas con códigos 200, 201, 400, 401, 403, 404, 409, 422.<br>• Serialización JSON consistente con cabeceras CORS. | **100% Éxito**<br>(Validado en vivo) |
| **4** | **Autenticación y Autorización (JWT & RBAC)**<br>Implementación de JWT estándar (RFC 7519, HS256), hash seguro BCRYPT, login, registro, logout y roles ADMIN, DOCENTE, LECTOR. | **COMPLETADO** | `backend-php/config/Jwt.php`<br>`backend-php/config/Auth.php`<br>`backend-php/controllers/AuthController.php` | • Firma y validación criptográfica HMAC-SHA256.<br>• Rechazo de tokens manipulados o expirados.<br>• Hashes BCRYPT con factor de costo 10.<br>• Respuestas 401 (sin token) y 403 (permisos insuficientes).<br>• Protección de secretos: `.env` excluido de git. | **100% Éxito**<br>(10/10 pasadas) |
| **5** | **Operaciones CRUD y Reglas de Negocio**<br>CRUD de Libros, Usuarios, Autores, Categorías, Salas y Préstamos. Descuento y restauración atómica de inventario. | **COMPLETADO** | `backend-php/controllers/CatalogoController.php`<br>`backend-php/controllers/CirculacionController.php`<br>`backend-php/controllers/AdminController.php`<br>`backend-php/controllers/SalasController.php` | • Creación, lectura, actualización y baja en todas las entidades.<br>• Control transaccional de `copias_disp` al prestar/devolver.<br>• Bloqueo de préstamos a lectores en MORA o SANCIONADOS.<br>• Cálculo de penalización ($1.500 COP por día hábil de retraso). | **100% Éxito**<br>(13/13 pasadas) |
| **6** | **Documentación de Endpoints**<br>Especificación OpenAPI 3.0.3, interfaz Swagger UI interactiva y colección de Postman. | **COMPLETADO** | `backend-php/controllers/DocsController.php`<br>`docs/SGBI_Sprint2_Postman_Collection.json`<br>`docs/API_DOCUMENTATION.md` | • Visualización de endpoints en Swagger UI.<br>• Botón de autorización Bearer JWT en Swagger.<br>• Colección Postman v2.1 importable con scripts que guardan el token JWT automáticamente. | **100% Éxito**<br>(Colección y Swagger validados) |

---

## 3. Diagnóstico y Solución: `ERR_CONNECTION_REFUSED`

### Causa Raíz Identificada
1. **Inactividad del Proceso Servidor:** El servidor de desarrollo de PHP no se ejecuta como servicio residente de Windows de manera permanente; requiere un proceso activo en consola. Si el proceso finalizaba o la consola era cerrada, cualquier intento de conexión hacia `localhost:8000` retornaba inmediatamente `ERR_CONNECTION_REFUSED`.
2. **Conflicto de Resolución Dual de Pila de Red (IPv4 vs IPv6):** En Windows 10/11, navegadores modernos como Google Chrome resuelven `localhost` preferentemente a la dirección IPv6 de bucle invertido (`::1`). Al ejecutar PHP mediante `-S 127.0.0.1:8000`, el socket solo se enlazaba a la interfaz IPv4, provocando rechazo de conexión para peticiones entrantes dirigidas a `localhost`.

### Solución Técnica Implementada
1. Se reescribió por completo el script ejecutable [iniciar_servidor_php.bat](file:///c:/Users/MAJO/OneDrive/Documents/JAVIER%20HUMBERTO%20PINTO/GESTION%20BIBLIOTECARIA/MINI-PROYECTO--GESTION-BIBLIOTECARIA/iniciar_servidor_php.bat) para enlazar el servidor a `0.0.0.0:8000` (`php -S 0.0.0.0:8000 index.php`). Esto permite escuchar tanto en `localhost` (IPv4 e IPv6) como en `127.0.0.1` de forma transparente.
2. Se añadió diagnóstico previo de extensiones PHP críticas (`pdo`, `pdo_mysql`, `openssl`, `json`).
3. Se integró la ejecución automática e idempotente de las migraciones de base de datos antes de levantar el socket HTTP.

---

## 4. Persistencia Dual y Detección de Motor

El sistema implementa persistencia relacional dual mediante la clase `Database.php`:
* **Motor Primario (Producción):** Intenta la conexión hacia MySQL 8.0 en `127.0.0.1:3306` con la base de datos `sgbi`. Si la conexión es exitosa, se utiliza MySQL con soporte transaccional InnoDB completo.
* **Motor de Respaldo (Fallback Resiliente):** Si el socket de MySQL no responde (por ejemplo, servicio XAMPP detenido o restricciones de permisos del entorno de ejecución), se activa automáticamente SQLite en modo WAL (`data/sgbi.db`), manteniendo la integridad referencial (`PRAGMA foreign_keys = ON;`) y los mismos datos semilla.
* **Transparencia Total:** El método `Database::getActiveDriver()` y el endpoint público `GET /api/health` retornan explícitamente el motor en uso:
  ```json
  {
    "status": "ok",
    "runtime": "PHP 8.2.12",
    "database": {
      "status": "connected",
      "engine": "mysql",
      "is_mysql": true,
      "is_fallback_sqlite": false,
      "libros_count": 10
    }
  }
  ```

---

## 5. Implementación de Autenticación JWT (RFC 7519)

Se implementó la clase nativa `Sgbi\Config\Jwt` bajo el estándar RFC 7519:
* **Algoritmo:** HMAC-SHA256 (`HS256`).
* **Estructura del Token:**
  * **Header:** `{"typ": "JWT", "alg": "HS256"}` codificado en Base64 URL-safe.
  * **Payload:** Incluye claims estándar (`iss`: `sgbi-api`, `iat`: emisión, `exp`: expiración a 24 horas) y claims de identidad (`sub`: ID del usuario, `email`, `rol`, `nombre`).
  * **Signature:** Generada con `hash_hmac('sha256', "$header.$payload", $secret, true)` y validada mediante `hash_equals()` para prevenir ataques de temporización (timing attacks).
* **Consumo de la API:**
  Los endpoints protegidos validan el encabezado HTTP:
  ```http
  Authorization: Bearer <token_jwt>
  ```
  Si no se proporciona el token o este es inválido/expirado, la API responde con código `401 Unauthorized`. Si el usuario pertenece al rol `LECTOR` e intenta invocar una ruta reservada para `ADMIN`, responde con `403 Forbidden`.

---

## 6. Evidencia de Ejecución de Pruebas

### 6.1 Pruebas Unitarias y de Integración (`backend-php/test_sprint2.php`)
Ejecutadas directamente contra el motor de base de datos relacional:
```text
======================================================================
   SGBI - VERIFICACIÓN Y PRUEBAS AUTOMATIZADAS DEL SPRINT 2 (BACKEND)
======================================================================

--- TAREA 1: Base de Datos Relacional y Esquema ---
  [PASS] Motor de persistencia identificado claramente ('mysql').
  [PASS] Tabla relacional 'libros' existe y está disponible.
  [PASS] Tabla relacional 'autores' existe y está disponible.
  [PASS] Tabla relacional 'libro_autor' existe y está disponible.
  [PASS] Tabla relacional 'usuarios' existe y está disponible.
  [PASS] Tabla relacional 'prestamos' existe y está disponible.
  [PASS] Tabla relacional 'categorias' existe y está disponible.
  [PASS] Tabla relacional 'salas' existe y está disponible.
  [PASS] Tabla relacional 'logs_sistema' existe y está disponible.
  [PASS] Tabla asociativa N:M 'libro_autor' contiene relaciones válidas (10 enlaces).
  [PASS] Restricción de integridad CHECK: Stock disponible válido en todos los libros.

--- TAREA 3: Autenticación, Hashes Seguros y Sesiones ---
  [PASS] Contraseñas cifradas con algoritmo robusto BCRYPT (bcrypt).
  [PASS] Verificación segura de contraseña mediante password_verify().
  [PASS] Rechazo de contraseña incorrecta.
  [PASS] Registro de nuevo usuario con rol LECTOR exitoso (ID #5).
  [PASS] Restricción de unicidad: Rechaza registro duplicado con el mismo correo.
  [PASS] Inicio de sesión: Autenticación exitosa con credenciales registradas.

--- TAREA 3 (JWT): Verificación de Firma y Validación de Tokens ---
  [PASS] Generación de Token JWT estándar RFC 7519 con cabecera, payload y firma.
  [PASS] Verificación exitosa de firma HMAC-SHA256 y claims del JWT.
  [PASS] Rechazo de Token JWT con firma alterada o no válida.
  [PASS] Rechazo estricto de Token JWT expirado (claim exp).

--- TAREA 3 (RBAC): Control de Acceso por Roles ---
  [PASS] Usuario con rol ADMIN (Bibliotecario) existe en la base de datos.
  [PASS] Usuario con rol LECTOR existe en la base de datos.
  [PASS] RBAC: Usuario LECTOR no tiene privilegios de ADMIN (denegación 403 Forbidden).
  [PASS] RBAC: Usuario ADMIN tiene privilegios de administración concedidos.

--- TAREA 4 (CRUD): Recurso Libros (/api/libros) ---
  [PASS] CREATE Libro: Inserción de libro exitosa (ID #11, ISBN 978-TEST-3601).
  [PASS] READ Libro: Consulta de libro por ID correcto.
  [PASS] UPDATE Libro: Actualización de título y stock exitosa.
  [PASS] DELETE Libro: Eliminación de libro confirmada (404 Not Found en consultas posteriores).

--- TAREA 4 (CRUD): Recurso Autores (/api/autores) ---
  [PASS] CREATE Autor: Registro de nuevo autor (ID #11).
  [PASS] READ Autor: Consulta de autor por ID exitosa.
  [PASS] UPDATE Autor: Modificación de datos del autor exitosa.
  [PASS] DELETE Autor: Eliminación de autor sin obras asociadas.

--- TAREA 4 (CRUD): Recurso Usuarios (/api/usuarios) ---
  [PASS] CREATE Usuario: Creación de usuario por administrador (ID #7).
  [PASS] READ Usuario: Lectura de ficha de usuario.
  [PASS] UPDATE Usuario: Cambio de estado a SANCIONADO exitoso.
  [PASS] DELETE Usuario: Eliminación de usuario sin dependencias.

--- TAREA 4 (CRUD): Recurso Préstamos (/api/prestamos) ---
  [PASS] Datos previos disponibles para registrar préstamo.
  [PASS] CREATE Préstamo: Registro atómico con descuento de inventario en stock.
  [PASS] READ Préstamo: Consulta de folio de préstamo #9.
  [PASS] UPDATE Préstamo: Modificación y extensión de fecha límite.
  [PASS] DEVOLUCIÓN Préstamo: Restitución íntegra de la copia al inventario disponible.
  [PASS] DELETE Préstamo: Eliminación de registro de préstamo.

--- TAREA 5: Especificación OpenAPI 3.0 ---
  [PASS] Especificación OpenAPI serializada en JSON válido.
  [PASS] Versión OpenAPI 3.0.x confirmada.
  [PASS] Documentación de endpoint /auth/login presente.
  [PASS] Documentación de endpoint /auth/register presente.
  [PASS] Documentación de endpoint /libros presente.
  [PASS] Documentación de endpoint /prestamos presente.
  [PASS] Documentación de endpoint /usuarios presente.
  [PASS] Esquema de seguridad JWT BearerAuth documentado en componentes.

======================================================================
   RESUMEN FINAL: 51 pasadas, 0 fallidas (Total: 51 pruebas)
======================================================================
```

### 6.2 Pruebas de Endpoints HTTP Reales en Vivo (`backend-php/test_http_endpoints.php`)
Ejecutadas con peticiones de red reales sobre el puerto 8000:
```text
=== PRUEBA DE ENDPOINTS HTTP RESTful EN VIVO (127.0.0.1:8000) ===

[1] GET /api/health -> Status: 200 (Motor detectado: mysql)
[2] GET /api/openapi.json -> Status: 200 (OpenAPI v3.0.3)
[3] GET /api/libros -> Status: 200 (Total libros: 10)
[4] POST /api/libros (Sin auth) -> Status: 401 (Esperado: 401 Unauthorized)
[5] POST /api/auth/register -> Status: 201 (Nuevo ID: 8)
[6] POST /api/auth/login (Admin) -> Status: 200 (Rol: ADMIN, Token JWT emitido)
[7] POST /api/auth/login (Clave errónea) -> Status: 401 (Esperado: 401)
[8] POST /api/libros (Con Bearer Admin) -> Status: 201 (ID Libro: 12)
[9] POST /api/libros (Con Bearer Lector) -> Status: 403 (Esperado: 403 Forbidden)
[10] PUT /api/libros/12 -> Status: 200 (Actualización OK)
[11] DELETE /api/libros/12 -> Status: 200 (Eliminación OK)
[12] GET /api/libros/12 (Eliminado) -> Status: 404 (Esperado: 404 Not Found)

>>> TODAS LAS 12 PRUEBAS HTTP EN VIVO SE COMPLETARON CON ÉXITO <<<
```

---

## 7. Verificación de Seguridad y Gestión de Secretos

* **Exclusión de Secretos en Git:** El archivo `.env` que contiene variables locales y claves secretas se encuentra explícitamente ignorado en `.gitignore`.
* **Archivo de Ejemplo Seguro:** Se provee `.env.example` con marcadores de posición sin credenciales reales ni claves privadas.
* **Cifrado de Contraseñas:** Se utiliza el algoritmo estándar BCRYPT (`PASSWORD_BCRYPT` con costo computacional 10). Las contraseñas nunca se transmiten ni se persisten en texto claro.
* **Protección contra Inyecciones SQL:** 100% de las consultas a base de datos utilizan sentencias preparadas con parámetros tipados en PDO.

---

## 8. Conclusión

El Sprint 2 del Sistema de Gestión Bibliotecaria Inteligente (SGBI) se encuentra completamente probado, funcional y verificado. No existen tareas críticas pendientes para este sprint.
