@echo off
title SGBI - Gestion Bibliotecaria
echo ========================================================
echo   Iniciando Servidor SGBI (Gestion Bibliotecaria)
echo   Diseno: monday.com White Workshop
echo ========================================================
set "PATH=C:\Users\MAJO\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64;%PATH%"
cd /d "%~dp0"
call npm.cmd run dev
pause

