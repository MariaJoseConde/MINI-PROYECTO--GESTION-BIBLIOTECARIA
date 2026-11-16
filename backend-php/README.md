# SGBI · Backend REST API en PHP 8.2

Arquitectura modular en PHP para el **Sistema de Gestión Bibliotecaria Inteligente (SGBI)**, diseñada para conectarse directamente con la interfaz moderna de la aplicación (Tailwind CSS v4 + React / SPA) y cumplir con los estándares de formación de desarrollo de software (SENA ADSO).

---

## 🚀 Arquitectura del Módulo PHP

```
backend-php/
├── config/
│   ├── Database.php      # Conexión PDO con soporte dual para SQLite (data/sgbi.db) y MySQL
│   ├── Response.php      # Respuestas estándar JSON, códigos HTTP y configuración de CORS
│   └── Auth.php          # Gestión de sesiones nativas PHP (sgbi_session) y validación de credenciales
├── controllers/
│   ├── AuthController.php        # Autenticación: login, logout, me
│   ├── CatalogoController.php    # Catálogo de libros, autores, categorías y exportación a CSV
│   ├── CirculacionController.php # Transacciones de préstamos, cálculo de días hábiles y devoluciones
│   ├── AdminController.php       # Gestión de usuarios, métricas de infraestructura, auditoría y respaldos
│   ├── IaController.php          # Búsqueda temática/semántica y generación de evaluaciones de lectura
│   └── HealthController.php      # Endpoint de verificación de salud del sistema
├── router.php            # Enrutador Front-Controller para servidor embebido y Apache/Nginx
├── index.php             # Punto de entrada para despliegues web tradicionales
└── README.md             # Esta documentación
```

---

## 🛠️ Cómo Iniciar el Servidor PHP

### Opción 1: Con el ejecutable de un solo clic
Haz doble clic sobre el archivo [iniciar_servidor_php.bat](file:///c:/Users/MAJO/OneDrive/Documents/JAVIER%20HUMBERTO%20PINTO/GESTION%20BIBLIOTECARIA/MINI-PROYECTO--GESTION-BIBLIOTECARIA/iniciar_servidor_php.bat) en la raíz del proyecto.

### Opción 2: Desde la consola con el CLI de PHP
```powershell
# En la raíz del proyecto
& "C:\xampp\php\php.exe" -S 0.0.0.0:8000 backend-php/router.php
```

El servidor quedará disponible en:
👉 **http://localhost:8000**

---

## 🔌 Colección de Endpoints API

| Método | Ruta | Descripción | Rol Mínimo |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Estado del servidor PHP, versión y base de datos | Público |
| `POST` | `/api/auth/login` | Inicio de sesión (email y contraseña) | Público |
| `GET` | `/api/auth/me` | Datos del usuario autenticado | Público |
| `POST` | `/api/auth/logout` | Cierre de sesión y destrucción de cookie | Autenticado |
| `GET` | `/api/libros` | Listado general con filtro opcional `?categoria=` | Público |
| `GET` | `/api/libros/:id` | Ficha técnica y pruebas de lectura | Público |
| `POST` | `/api/libros` | Registro de nuevo ejemplar | ADMIN |
| `PUT` | `/api/libros/:id` | Actualización de ejemplar | ADMIN |
| `DELETE` | `/api/libros/:id` | Eliminación de ejemplar (valida préstamos activos) | ADMIN |
| `GET` | `/api/libros/exportar/csv` | Descarga de catálogo completo en formato CSV UTF-8 | ADMIN |
| `GET` | `/api/categorias` | Categorías temáticas con conteo de libros | Público |
| `POST` | `/api/categorias` | Creación de nueva categoría | ADMIN |
| `GET` | `/api/autores` | Listado de autores registrados | Público |
| `POST` | `/api/autores` | Creación de nuevo autor | ADMIN |
| `GET` | `/api/prestamos` | Préstamos activos e historial | LECTOR / ADMIN |
| `GET` | `/api/prestamos/calcular-fecha` | Calcula fecha límite a 8 días hábiles | ADMIN |
| `POST` | `/api/prestamos` | Registro transaccional de préstamo | ADMIN |
| `POST` | `/api/prestamos/:id/devolver` | Registro de devolución y cálculo de penalización | ADMIN |
| `POST` | `/api/ia/buscar` | Búsqueda semántica e híbrida FTS5 | Público |
| `POST` | `/api/ia/generar-prueba` | Generación pedagógica de prueba con 4 preguntas | DOCENTE / ADMIN |
| `GET` | `/api/pruebas` | Listado de evaluaciones generadas | Público |
| `GET` | `/api/admin/usuarios` | Gestión y búsqueda de usuarios | ADMIN |
| `POST` | `/api/admin/usuarios` | Registro de nuevo usuario en el sistema | ADMIN |
| `PUT` | `/api/admin/usuarios/:id` | Modificación de roles y estado de usuario | ADMIN |
| `GET` | `/api/admin/auditoria` | Registros de trazabilidad del sistema (`logs_sistema`) | ADMIN |
| `POST` | `/api/admin/auditoria/test-fallback` | Simulación de prueba de resiliencia FTS5 | ADMIN |
| `GET` | `/api/admin/metricas` | Métricas de rendimiento, memoria y caché | ADMIN |
| `GET` | `/api/admin/respaldo` | Descarga binaria de respaldo SQLite (`.db`) | ADMIN |

---

## 🗄️ Conmutación entre SQLite y MySQL

Por defecto, la API se conecta a la base de datos SQLite preconfigurada en `data/sgbi.db`.

Si deseas conectar la API a un servidor **MySQL** (por ejemplo en XAMPP o Docker):
1. Abre tu archivo `.env` o define las siguientes variables de entorno:
```ini
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sgbi
DB_USERNAME=root
DB_PASSWORD=
```
2. La clase `Sgbi\Config\Database` cambiará automáticamente su controlador PDO a MySQL sin requerir cambios de código.
