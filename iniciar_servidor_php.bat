@echo off
title SGBI - Backend API PHP 8.2 (http://localhost:8000)
echo ========================================================
echo   Iniciando Backend API SGBI en PHP 8.2
echo   URL Local: http://localhost:8000 (o http://127.0.0.1:8000)
echo   Punto de Entrada: index.php
echo   Base de datos: MySQL (sgbi en 127.0.0.1:3306) con respaldo SQLite
echo ========================================================
set "PATH=C:\xampp\php;%PATH%"
cd /d "%~dp0"
"C:\xampp\php\php.exe" backend-php/migrate.php
echo.
echo Servidor PHP listo para navegacion segura en:
echo   --^> http://localhost:8000
echo   --^> http://127.0.0.1:8000
echo.
"C:\xampp\php\php.exe" -S 127.0.0.1:8000 index.php
pause

