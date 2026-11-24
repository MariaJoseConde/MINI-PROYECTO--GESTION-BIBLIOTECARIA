@echo off
setlocal enabledelayedexpansion
title SGBI - Servidor Backend PHP 8.2 (http://localhost:8000)

echo ======================================================================
echo   SGBI - SISTEMA DE GESTION BIBLIOTECARIA INTELIGENTE
echo   Iniciando Servidor Backend API RESTful (PHP 8.2 + MySQL / SQLite)
echo ======================================================================
echo.

cd /d "%~dp0"

REM 1. Deteccion del ejecutable de PHP
set "PHP_BIN="
if exist "C:\xampp\php\php.exe" (
    set "PHP_BIN=C:\xampp\php\php.exe"
    set "PATH=C:\xampp\php;%PATH%"
) else (
    where php.exe >nul 2>&1
    if !errorlevel! equ 0 (
        set "PHP_BIN=php.exe"
    )
)

if "%PHP_BIN%"=="" (
    echo [ERROR] No se encontro el ejecutable de PHP.
    echo Asegurese de tener instalado XAMPP en C:\xampp o anadir PHP al PATH del sistema.
    echo.
    pause
    exit /b 1
)

echo [1/4] Ejecutable PHP detectado: %PHP_BIN%
"%PHP_BIN%" -v | findstr /R "PHP [0-9]"
echo.

REM 2. Comprobacion de extensiones requeridas
echo [2/4] Verificando extensiones necesarias (PDO, OpenSSL, JSON)...
"%PHP_BIN%" -r "
  \$mods = ['pdo', 'pdo_mysql', 'pdo_sqlite', 'openssl', 'json', 'session'];
  \$faltan = [];
  foreach (\$mods as \$m) {
    if (!extension_loaded(\$m)) \$faltan[] = \$m;
  }
  if (!empty(\$faltan)) {
    echo '[ADVERTENCIA] Faltan extensiones: ' . implode(', ', \$faltan) . PHP_EOL;
  } else {
    echo '[OK] Todas las extensiones requeridas estan habilitadas.' . PHP_EOL;
  }
"
echo.

REM 3. Ejecucion de migraciones de base de datos
echo [3/4] Ejecutando migraciones e integridad de base de datos...
"%PHP_BIN%" backend-php/migrate.php
if !errorlevel! neq 0 (
    echo [AVISO] Fallo la ejecucion de migrate.php. Continuando con SQLite local...
)
echo.

REM 4. Puesta en marcha del servidor local en 0.0.0.0:8000
echo [4/4] Iniciando Servidor Web PHP integrado...
echo ======================================================================
echo   SERVIDOR ACTIVO Y LISTO PARA PETICIONES:
echo.
echo   * API REST / Home:      http://localhost:8000
echo   * URL Alternativa:      http://127.0.0.1:8000
echo   * Swagger UI Docs:      http://localhost:8000/api/docs
echo   * OpenAPI Spec (JSON):  http://localhost:8000/api/openapi.json
echo   * Health Check:         http://localhost:8000/api/health
echo   * Prototipo Frontend:   http://localhost:3000
echo.
echo   Presione Ctrl + C en esta ventana para detener el servidor.
echo ======================================================================
echo.

REM El binding a 0.0.0.0:8000 atiende tanto localhost (IPv4/IPv6) como 127.0.0.1,
REM solucionando de raiz el error ERR_CONNECTION_REFUSED.
"%PHP_BIN%" -S 0.0.0.0:8000 index.php

if !errorlevel! neq 0 (
    echo.
    echo [ERROR] No se pudo iniciar el servidor en el puerto 8000.
    echo Es posible que otro proceso ya este utilizando el puerto 8000.
    echo Verifique procesos con: netstat -ano ^| findstr :8000
)

pause
