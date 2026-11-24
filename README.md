# SGBI · Sistema de Gestión Bibliotecaria Inteligente (Sprint 2)

Sistema integral de gestión de bibliotecas desarrollado con arquitectura desacoplada: **Backend RESTful de alto rendimiento en PHP 8.2**, persistencia relacional empresarial en **MySQL 8 (InnoDB)** con respaldo automático y transparente en **SQLite 3**, autenticación mediante **JSON Web Tokens (JWT según RFC 7519)**, control de acceso basado en roles (**RBAC**), documentación interactiva **Swagger UI / OpenAPI 3.0.3** y frontend moderno en **React + Tailwind CSS**.

---

## 🚀 Enlaces de Acceso Local y Documentación

Una vez iniciados los servidores, los servicios están disponibles en las siguientes direcciones:

| Servicio / Módulo | URL de Acceso | Descripción |
| :--- | :--- | :--- |
| **🎨 Prototipo Web (Frontend)** | [http://localhost:3000](http://localhost:3000) | Interfaz gráfica de usuario en React con tema oscuro/claro y glassmorphism. |
| **⚙️ Backend API RESTful** | [http://localhost:8000](http://localhost:8000) | Punto de entrada del servidor backend PHP 8.2 (`index.php`). |
| **📖 Documentación Swagger UI** | [http://localhost:8000/api/docs](http://localhost:8000/api/docs) | Explorador interactivo con soporte de autorización Bearer JWT. |
| **📄 Especificación OpenAPI 3.0** | [http://localhost:8000/api/openapi.json](http://localhost:8000/api/openapi.json) | Esquema estándar en JSON para integración e importación. |
| **🩺 Health Check & Estado BD** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | Diagnóstico en tiempo real: versión de PHP y motor activo (`mysql` o `sqlite`). |
| **📮 Colección Postman v2.1** | `docs/SGBI_Sprint2_Postman_Collection.json` | Colección lista para importar en Postman con tokens autogestionados. |

---

## 🔑 Credenciales de Acceso Demo

| Rol | Correo Electrónico | Contraseña por Defecto | Permisos / Alcance |
| :--- | :--- | :--- | :--- |
| **ADMIN (Bibliotecario)** | `admin@sgbi.edu` | `sgbi2026` | Control total: gestión de libros, autores, usuarios, préstamos y métricas. |
| **DOCENTE** | `docente@sgbi.edu` | `sgbi2026` | Consulta de catálogo y generación de pruebas de comprensión lectora. |
| **LECTOR (Estudiante)** | `lector@sgbi.edu` | `sgbi2026` | Consulta de catálogo, solicitud y seguimiento de sus préstamos personales. |

---

## 🛠️ Requisitos del Sistema e Instalación

### Requisitos Previos
1. **PHP 8.2 o superior** con las siguientes extensiones habilitadas en `php.ini`:
   - `pdo`, `pdo_mysql`, `pdo_sqlite`, `openssl`, `json`, `session`, `mbstring`, `filter`.
   - *(En XAMPP estas extensiones vienen activas de forma predeterminada).*
2. **MySQL 8.0+ / MariaDB** (opcional, incluido en XAMPP en el puerto 3306). Si MySQL está detenido, el sistema activa automáticamente el respaldo SQLite sin detener la operación.
3. **Node.js LTS v20+ / v24+** (requerido únicamente para la interfaz gráfica React).

### Configuración de Variables de Entorno
Copia el archivo `.env.example` a `.env`:
```powershell
cp .env.example .env
```
Contenido recomendado de `.env`:
```ini
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sgbi
DB_USERNAME=root
DB_PASSWORD=
DB_PATH="./data/sgbi.db"
JWT_SECRET="sgbi_jwt_secret_key_sprint2_2026_super_secure"
JWT_EXPIRATION=86400
```

---

## ⚡ Instrucciones de Inicio Rápido

### 1. Iniciar el Backend PHP (Puerto 8000)
#### Opción A (Un solo clic en Windows):
Haz doble clic en el archivo:
👉 **`iniciar_servidor_php.bat`**

Este script se encarga automáticamente de:
- Detectar la instalación de PHP (en `C:\xampp\php` o `%PATH%`).
- Comprobar las extensiones necesarias (`pdo_mysql`, `pdo_sqlite`, `openssl`).
- Ejecutar las migraciones pendientes sin borrar registros existentes.
- Iniciar el servidor escuchando en `0.0.0.0:8000` (resolviendo de raíz el error `ERR_CONNECTION_REFUSED`).

#### Opción B (Desde la terminal PowerShell):
```powershell
# 1. Ejecutar migraciones
& "C:\xampp\php\php.exe" backend-php/migrate.php

# 2. Iniciar servidor web PHP
& "C:\xampp\php\php.exe" -S 0.0.0.0:8000 index.php
```

### 2. Iniciar el Frontend React (Puerto 3000)
```powershell
# En otra terminal:
npm run dev
# o hacer doble clic en iniciar_servidor.bat
```

---

## 🧪 Ejecución de Pruebas Automatizadas

El proyecto incluye dos suites completas de verificación:

### 1. Pruebas Unitarias y de Integración (51 verificaciones):
Verifica el esquema de base de datos relacional, firma y validación JWT, RBAC, operaciones CRUD y serialización OpenAPI:
```powershell
& "C:\xampp\php\php.exe" backend-php/test_sprint2.php
```
*Resultado esperado: `51 pasadas, 0 fallidas (100% éxito)`.*

### 2. Pruebas HTTP End-to-End en Vivo (12 escenarios):
Ejecuta peticiones HTTP reales contra el servidor local activo:
```powershell
& "C:\xampp\php\php.exe" backend-php/test_http_endpoints.php 8000
```
*Resultado esperado: `TODAS LAS 12 PRUEBAS HTTP EN VIVO SE COMPLETARON CON ÉXITO`.*

---

## 🛡️ Solución al Error `ERR_CONNECTION_REFUSED`

Si al intentar ingresar a `http://localhost:8000` en Google Chrome aparece `ERR_CONNECTION_REFUSED`, la causa principal es:
1. **El proceso de PHP no se encontraba en ejecución:** El servidor integrado de PHP solo responde mientras su proceso de consola permanezca abierto.
2. **Resolución de Host IPv4 vs IPv6:** En Windows, Chrome resuelve `localhost` a `::1` (IPv6). Si el servidor PHP se vincula exclusivamente a `127.0.0.1`, las conexiones IPv6 son rechazadas.
3. **Solución Implementada:** Se corrigió `iniciar_servidor_php.bat` para vincular a `0.0.0.0:8000`, atendiendo tanto peticiones IPv4 (`127.0.0.1`), IPv6 (`::1`) como nombres de dominio locales (`localhost`).

---

## 📁 Estructura del Backend

```
backend-php/
├── config/
│   ├── Database.php      # Conexión dual MySQL (InnoDB) con fallback resiliente a SQLite
│   ├── Jwt.php           # Implementación RFC 7519 HMAC-SHA256 (HS256)
│   ├── Auth.php          # Middleware de autenticación Bearer JWT y control de sesiones
│   └── Response.php      # Serializador de respuestas JSON unificadas, CORS y cabeceras
├── controllers/
│   ├── AuthController.php        # Registro, login con JWT, logout e identidad me
│   ├── CatalogoController.php    # CRUD completo de libros, autores, categorías
│   ├── CirculacionController.php # Préstamos, control de inventario y devoluciones con mora
│   ├── AdminController.php       # CRUD de usuarios, métricas de base de datos y auditoría
│   ├── SalasController.php       # CRUD de áreas físicas y salas de lectura
│   ├── HealthController.php      # Health check y estado del motor de base de datos
│   └── DocsController.php        # OpenAPI 3.0.3 y servidor Swagger UI interactivo
├── migrate.php           # Script idempotente de migración y control de esquema
├── test_sprint2.php      # Suite de pruebas automatizadas (51 pruebas)
└── test_http_endpoints.php # Suite de pruebas HTTP en vivo (12 flujos)
```
