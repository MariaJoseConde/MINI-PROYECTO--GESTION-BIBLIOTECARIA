# Technical Requirements Document (TRD)

## Sistema de Gestión Bibliotecaria Inteligente (SGBI)

## 1. Arquitectura de Software y Stack Tecnológico

### 1.1 Stack Tecnológico

* **Backend Runtime:** PHP 8.2+ (Nativo, sin frameworks pesados).
* **Acceso a Datos:** PHP Data Objects (PDO) con sentencias preparadas y modo de error `PDO::ERRMODE_EXCEPTION`.
* **Base de Datos:** MySQL 8.0+ (Motor `ENGINE=InnoDB` obligatorio, cotejamiento `utf8mb4_unicode_ci`).
* **Frontend:** HTML5 semántico + Tailwind CSS (vía CDN) + JavaScript nativo modular (ES6+, Fetch API asíncrona sin build steps).
* **Integración Externa:** Google Gemini API (`gemini-1.5-flash`) mediante cURL nativo en PHP.

### 1.2 Patrón de Arquitectura

El sistema implementa una **Arquitectura Híbrida Backend API REST + Frontend MPA Interactivo**, estructurado internamente bajo el patrón **MVC Clásico en PHP**:

* **Front Controller (`public/index.php` & `public/api.php`):** Puntos de entrada únicos para enrutamiento web y endpoints JSON.
* **Capa de Controladores (`src/Controllers/`):** Orquestan las peticiones HTTP, validan parámetros de entrada y retornan vistas PHP o respuestas JSON.
* **Capa de Modelos y Repositorios (`src/Models/`):** Clases de entidad y acceso a datos que encapsulan sentencias SQL parametrizadas vía PDO.
* **Capa de Servicios de Dominio (`src/Services/`):** Aislamiento de lógica transaccional de negocio (`CirculacionService`) y clientes de integración (`GeminiClient`).
* **Objetos de Transferencia de Datos (`src/DTOs/`):** Validación y tipado estricto de estructuras de datos (PHP 8 Typed Properties).

### 1.3 Estructura de Directorios

```plaintext
sgbi/
├── config/
│   ├── database.php        # Conexión PDO Singleton
│   └── app.php             # Configuración general del sistema
├── src/
│   ├── Controllers/
│   │   ├── LibroController.php
│   │   ├── PrestamoController.php
│   │   └── IaController.php
│   ├── Models/
│   │   ├── Libro.php
│   │   ├── Prestamo.php
│   │   └── Usuario.php
│   ├── Services/
│   │   ├── CirculacionService.php   # Lógica transaccional (8 días, bloqueo de stock)
│   │   └── GeminiClient.php         # Cliente HTTP cURL BFF con timeout de 8s
│   └── DTOs/
│       └── PruebaLecturaDTO.php     # Validador de esquema de pruebas
├── views/
│   ├── layout/
│   │   ├── header.php
│   │   ├── navbar.php
│   │   └── footer.php
│   ├── libros/
│   │   ├── index.php
│   │   └── detalle.php
│   └── prestamos/
│       ├── mostrador.php
│       └── comprobante.php
├── public/
│   ├── index.php           # Front Controller vistas
│   ├── api.php             # Enrutador API REST interna
│   └── js/
│       ├── catalogo.js     # Búsqueda semántica asíncrona
│       └── prestamos.js    # Lógica de mostrador y validación
├── database/
│   ├── migrations/         # Scripts SQL ordenados
│   │   ├── 001_create_autores_table.sql
│   │   ├── 002_create_libros_table.sql
│   │   ├── 003_create_libro_autor_table.sql
│   │   ├── 004_create_usuarios_table.sql
│   │   ├── 005_create_prestamos_table.sql
│   │   ├── 006_create_pruebas_lectura_table.sql
│   │   ├── 007_create_logs_sistema_table.sql
│   │   └── 008_seed_initial_data.sql
│   └── migrate.php         # Script CLI de ejecución de migraciones
├── storage/
│   └── logs/               # app_error.log, ia_service.log
├── .env                    # Credenciales protegidas fuera del DocumentRoot
├── .env.example
├── Dockerfile
└── docker-compose.yml
```

---

## 2. Modelo de Datos y Persistencia (ERD)

### 2.1 Especificación de Tablas (DDL)

```sql
-- 1. Tabla de Autores
CREATE TABLE autores (
    id_autor INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    nacionalidad VARCHAR(80) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Libros
CREATE TABLE libros (
    id_libro INT AUTO_INCREMENT PRIMARY KEY,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    titulo VARCHAR(255) NOT NULL,
    sinopsis TEXT NULL,
    copias_totales INT NOT NULL DEFAULT 1,
    copias_disp INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FULLTEXT INDEX ft_busqueda (titulo, sinopsis),
    CONSTRAINT chk_stock_valido CHECK (copias_disp >= 0 AND copias_disp <= copias_totales)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla Intermedia Libro - Autor
CREATE TABLE libro_autor (
    id_libro INT NOT NULL,
    id_autor INT NOT NULL,
    PRIMARY KEY (id_libro, id_autor),
    CONSTRAINT fk_la_libro FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE CASCADE,
    CONSTRAINT fk_la_autor FOREIGN KEY (id_autor) REFERENCES autores(id_autor) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de Usuarios
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    numero_documento VARCHAR(20) NOT NULL UNIQUE,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN', 'DOCENTE', 'LECTOR') NOT NULL DEFAULT 'LECTOR',
    estado ENUM('ACTIVO', 'SANCIONADO') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de Préstamos
CREATE TABLE prestamos (
    id_prestamo INT AUTO_INCREMENT PRIMARY KEY,
    id_libro INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha_prestamo DATE NOT NULL,
    fecha_limite DATE NOT NULL,
    fecha_entrega DATE NULL,
    estado ENUM('ACTIVO', 'DEVUELTO', 'MORA') NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prestamo_libro FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE RESTRICT,
    CONSTRAINT fk_prestamo_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla de Pruebas de Lectura
CREATE TABLE pruebas_lectura (
    id_prueba INT AUTO_INCREMENT PRIMARY KEY,
    id_libro INT NOT NULL,
    id_docente INT NOT NULL,
    contenido_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prueba_libro FOREIGN KEY (id_libro) REFERENCES libros(id_libro) ON DELETE CASCADE,
    CONSTRAINT fk_prueba_docente FOREIGN KEY (id_docente) REFERENCES usuarios(id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabla de Auditoría y Telemetría
CREATE TABLE logs_sistema (
    id_log BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo_evento VARCHAR(50) NOT NULL,
    mensaje TEXT NOT NULL,
    id_usuario INT NULL,
    ip_origen VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. Integración de Servicios Externos y Patrón BFF

### 3.1 Google Gemini API Client (`GeminiClient.php`)

* **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
* **Transporte:** cURL nativo con timeout estricto de 8 segundos (`CURLOPT_TIMEOUT => 8`, `CURLOPT_CONNECTTIMEOUT => 4`).
* **Protección BFF:** El navegador jamás conoce la clave. Toda petición se realiza vía proxy backend `/api/ia/buscar` y `/api/ia/generar-prueba`.

### 3.2 Búsqueda Semántica con Fallback a SQL FULLTEXT

```php
// Pseudocódigo del flujo de dos niveles
public function buscarSemantica(string $query): array {
    try {
        $resultadoIA = $this->geminiClient->analizarSemantica($query, $this->obtenerSinopsisMinimizadas());
        return $this->obtenerLibrosPorIds($resultadoIA['ids_relevantes']);
    } catch (Exception $e) {
        $this->logger->warn("Fallback activado: " . $e->getMessage());
        return $this->buscarPorFulltextMySQL($query);
    }
}
```

### 3.3 Validación Estricta del JSON de Pruebas (`PruebaLecturaDTO.php`)

El payload debe satisfacer obligatoriamente:
1. `libro_id`: Entero positivo.
2. `evaluacion`: Array con un mínimo de 3 y máximo de 5 elementos.
3. Cada pregunta debe contener:
   * `pregunta`: String no vacío.
   * `opciones`: Array asociativo con llaves exactas `['A', 'B', 'C', 'D']`.
   * `respuesta_correcta`: Carácter dentro de `['A', 'B', 'C', 'D']`.
   * `justificacion`: String no vacío explicativo.

---

## 4. Estrategia de Pruebas y Robustez

* **Pruebas Unitarias (PHPUnit):**
  * Validación del cálculo de 8 días hábiles en `CirculacionService` excluyendo fines de semana.
  * Comprobación del validador de esquemas en `PruebaLecturaDTO`.
* **Pruebas de Integración Transaccional:**
  * Forzado de fallas durante el registro de préstamos para certificar el `ROLLBACK` en InnoDB.
  * Validación de la restricción `ON DELETE RESTRICT` al intentar eliminar un libro prestado.
* **Pruebas de Resiliencia de Red:**
  * Mock cURL simulando timeout (> 8s) y respuestas HTTP 429/500 para corroborar que el fallback conmute a MySQL `MATCH(...) AGAINST(...)`.
* **Pruebas de Concurrencia:**
  * Simulación de 2 solicitudes simultáneas con `copias_disp = 1` utilizando `SELECT ... FOR UPDATE` para evitar stock negativo.

---

## 5. Entorno de Despliegue y Operaciones

### 5.1 Docker Compose (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "8080:80"
    volumes:
      - .:/var/www/html
    environment:
      - APP_ENV=development
      - DB_HOST=db
      - DB_NAME=sgbi_db
      - DB_USER=sgbi_user
      - DB_PASS=sgbi_secret
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - db

  db:
    image: mysql:8.0
    command: --default-authentication-plugin=mysql_native_password
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root_secret_pass
      MYSQL_DATABASE: sgbi_db
      MYSQL_USER: sgbi_user
      MYSQL_PASSWORD: sgbi_secret
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

### 5.2 Observabilidad

* **`storage/logs/app_error.log`:** Excepciones PDO no controladas y errores de servidor (HTTP 500).
* **`storage/logs/ia_service.log`:** Latencias en milisegundos de las llamadas a Gemini y avisos de conmutación a fallback.
* **`public/health.php`:** Endpoint que verifica conectividad a MySQL y resolución hacia la API de Gemini, retornando HTTP 200/503.