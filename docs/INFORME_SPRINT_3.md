# Informe de Cumplimiento Técnico y Pruebas del Sprint 3
## biblioSmart — Sistema de Gestión Bibliotecaria Inteligente

**Fecha de Ejecución:** 27 de noviembre de 2026  
**Entorno de Desarrollo:** Antigravity IDE | Node.js 24 | PHP 8.2 | Vite 8.3 | React 18 | Windows x64  
**Documento Word Oficial:** [docs/biblioSmart_Sprint3_Desarrollo_Frontend.docx](file:///c:/Users/MAJO/OneDrive/Documents/JAVIER%20HUMBERTO%20PINTO/GESTION%20BIBLIOTECARIA/MINI-PROYECTO--GESTION-BIBLIOTECARIA/docs/biblioSmart_Sprint3_Desarrollo_Frontend.docx)  
**Repositorio GitHub:** [MariaJoseConde/MINI-PROYECTO--GESTION-BIBLIOTECARIA](https://github.com/MariaJoseConde/MINI-PROYECTO--GESTION-BIBLIOTECARIA)  

---

## 1. Resumen Ejecutivo del Sprint 3

Durante el **Sprint 3 (Semana 3: Desarrollo del Frontend)** se ha completado la totalidad de los objetivos planificados, logrando una **aplicación web SPA moderna, integrada y funcional de extremo a extremo**. La solución conecta las interfaces de usuario desarrolladas en React 18 y Tailwind CSS con la API RESTful en PHP 8.2, incorporando validaciones de entrada y de consistencia en dos capas, módulos completos de préstamos, renovaciones, cola de reservas de libros, gestión de salas, control de acceso por roles (RBAC con JWT), contraste visual adaptado a temas claro y oscuro (WCAG AA), y soporte optimizado para navegación en aplicativos móviles.

---

## 2. Clasificación de los Puntos del Plan del Sprint 3

Siguiendo las directrices del plan de trabajo, se evaluó cada uno de los puntos asignados:

| # | Punto del Plan | Estado Inicial | Estado Final | Evidencia Técnica |
| :-: | :--- | :-: | :-: | :--- |
| **1** | **Construir las interfaces de usuario** | Incompleto | **COMPLETO** | 9 vistas y modales implementados: Catálogo interactivo, Mostrador de circulación, Mis préstamos y reservas, Salas y pasillos, Categorías, Panel de Administración, Modal de Libro, Modal de Login y Barra de Navegación Móvil. |
| **2** | **Integrar el frontend con la API** | Incompleto | **COMPLETO** | Cliente HTTP centralizado (`apiClient.ts`) con tokens Bearer JWT, timeouts con `AbortController`, manejo visible de estados de carga, respuestas vacías y errores de red HTTP. |
| **3** | **Implementar validaciones** | Incompleto | **COMPLETO** | Validación en dos capas: Backend con `Validator.php` (respuestas estructuradas HTTP 422) y Frontend con validación en formularios antes del envío y feedback visual inmediato. |
| **4** | **Incorporar funcionalidades principales** | Incompleto | **COMPLETO** | Préstamos atómicos con descuento de stock, renovación de préstamos (máx 2 veces, +12 días), cola de reservas para libros agotados (`PENDIENTE` / `DISPONIBLE`), entrega de reservas en mostrador y cálculo dinámico de mora. |
| **5** | **Ejecutar pruebas de integración** | Inexistente | **COMPLETO** | Suite automatizada `test_integracion_sprint3.php` con 20/20 pruebas de integración exitosas, sumada a las 51/51 pruebas unitarias backend y 0 errores de compilación TypeScript. |

---

## 3. Detalle de Interfaces de Usuario Construidas (UI/UX)

* **Paleta Corporativa:**
  - **Azul Petróleo (`#183B4E`):** Cabeceras, tarjetas de administración, texto de alto contraste y estructura principal.
  - **Verde Esmeralda (`#287A65`):** Acciones principales, botones de confirmación, estados disponibles y acentos visuales.
  - **Beige Cálido (`#F3EBDD`) y Blanco:** Fondos acogedores de estilo Glassmorphism.
* **Depuración Visual del Header:** Se eliminó la barra superior duplicada que contenía accesos redundantes, unificando la navegación de escritorio en el Sidebar izquierdo y manteniendo migas de pan limpias.
* **Navegación Móvil Responsiva:** Barra inferior fija (`bottom-nav`) con iconos táctiles para Vista Principal, Salas, Préstamos y Cuenta, respetando el `safe-area-inset-bottom`.
* **Accesibilidad (WCAG 2.1/2.2 AA):** Contraste tipográfico verificado en modo Claro y modo Oscuro, skip links (`#main-content`) y soporte de navegación por teclado.

---

## 4. Arquitectura de Integración Frontend con la API

El archivo [src/lib/apiClient.ts](file:///c:/Users/MAJO/OneDrive/Documents/JAVIER%20HUMBERTO%20PINTO/GESTION%20BIBLIOTECARIA/MINI-PROYECTO--GESTION-BIBLIOTECARIA/src/lib/apiClient.ts) centraliza las peticiones HTTP:
1. **Seguridad JWT:** Extrae el token desde `localStorage` y lo adjunta en la cabecera `Authorization: Bearer <token>`.
2. **Resiliencia:** Configura un `AbortController` con timeout de 12 segundos, evitando bloqueos por peticiones colgadas.
3. **Mapeo de Errores Tipados:** Extrae los campos de error devueltos por el backend (`error`, `mensaje`, `campos`) y los lanza como `ApiRequestError` para que las vistas muestren notificaciones amigables.

---

## 5. Lógica de Validaciones Implementadas

* **Validación de Libros:** ISBN-10 o ISBN-13 válido mediante regex, año de publicación en rango (1000 - año actual + 1), copias disponibles $\le$ copias totales, y verificación de existencia de IDs de autor y categoría.
* **Validación de Usuarios:** Formato de correo electrónico válido, contraseña $\ge$ 6 caracteres y rol restringido (`ADMIN`, `BIBLIOTECARIO`, `LECTOR`).
* **Reglas de Negocio en Circulación:**
  - **Préstamo:** Bloqueo si el usuario tiene mora activa o si ya tiene el mismo ejemplar prestado.
  - **Renovación:** Máximo 2 renovaciones por préstamo. Bloqueo si el libro tiene una reserva pendiente de otro lector.
  - **Reserva:** Solo permitida si el libro tiene `copias_disp == 0`. Bloqueo de reservas duplicadas del mismo usuario para el mismo libro.

---

## 6. Resultados de las Pruebas Ejecutadas

```text
======================================================================
   biblioSmart - RESUMEN DE PRUEBAS AUTOMATIZADAS
======================================================================
[FRONTEND]
  ✓ TypeScript linter (tsc --noEmit):                     0 errores
  ✓ Empaquetado Vite de producción (vite build):          Exitoso (1.92s)

[BACKEND UNITARIO]
  ✓ Pruebas unitarias Sprint 2 (test_sprint2.php):        51/51 PASADAS (100%)

[INTEGRACIÓN HTTP E2E]
  ✓ Pruebas de integración Sprint 3 (test_integracion):   20/20 PASADAS (100%)
----------------------------------------------------------------------
TOTAL: 71 PRUEBAS PASADAS / 0 FALLIDAS
```

---

## 7. Entregables Generados

1. **Documento Word Oficial:** [docs/biblioSmart_Sprint3_Desarrollo_Frontend.docx](file:///c:/Users/MAJO/OneDrive/Documents/JAVIER%20HUMBERTO%20PINTO/GESTION%20BIBLIOTECARIA/MINI-PROYECTO--GESTION-BIBLIOTECARIA/docs/biblioSmart_Sprint3_Desarrollo_Frontend.docx) generado con formato corporativo, tablas de estados y resumen ejecutivo.
2. **Script Generador Word:** [scripts/generate_sprint3_docx.mjs](file:///c:/Users/MAJO/OneDrive/Documents/JAVIER%20HUMBERTO%20PINTO/GESTION%20BIBLIOTECARIA/MINI-PROYECTO--GESTION-BIBLIOTECARIA/scripts/generate_sprint3_docx.mjs).
3. **Asistente de Sincronización:** [subir_a_github.bat](file:///c:/Users/MAJO/OneDrive/Documents/JAVIER%20HUMBERTO%20PINTO/GESTION%20BIBLIOTECARIA/MINI-PROYECTO--GESTION-BIBLIOTECARIA/subir_a_github.bat) en la raíz del proyecto.
