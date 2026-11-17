@echo off
title SGBI - Backend API PHP 8.2
echo ========================================================
echo   Iniciando Backend API SGBI en PHP 8.2
echo   Puerto: http://localhost:8000
echo   Base de datos: MySQL (sgbi en 127.0.0.1:3306)
echo ========================================================
set "PATH=C:\xampp\php;%PATH%"
cd /d "%~dp0"
"C:\xampp\php\php.exe" backend-php/migrate.php
"C:\xampp\php\php.exe" -S 0.0.0.0:8000 backend-php/router.php
pause

