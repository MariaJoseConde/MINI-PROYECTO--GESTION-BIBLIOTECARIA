@echo off
title biblioSmart - Asistente de Sincronizacion GitHub
color 0B
cls

:: Asegurar que Git y Git Credential Manager esten en el PATH
set "PATH=C:\Program Files\Git\ucrt64\bin;C:\Program Files\Git\cmd;C:\Program Files\Git\bin;%PATH%"

cd /d "%~dp0"

echo ======================================================================
echo          BIBLIOSMART - ASISTENTE DE SUBIDA A GITHUB
echo ======================================================================
echo Repositorio destino: https://github.com/MariaJoseConde/MINI-PROYECTO--GESTION-BIBLIOTECARIA.git
echo Rama activa: main
echo.
echo Commits pendientes listos para subir:
git log origin/main..main --oneline
echo.
echo Selecciona el metodo de autenticacion preferido:
echo.
echo   [1] Abrir Navegador para iniciar sesion en GitHub (OAuth Web)
echo   [2] Autenticar con Codigo de Dispositivo (Device Code)
echo   [3] Pegar un Token de Acceso Personal (PAT de GitHub)
echo   [4] Intentar subir directamente (git push origin main)
echo   [5] Salir
echo.
set /p OPTION="Ingresa el numero de opcion (1-5) y presiona Enter: "

if "%OPTION%"=="1" goto LOGIN_BROWSER
if "%OPTION%"=="2" goto LOGIN_DEVICE
if "%OPTION%"=="3" goto LOGIN_TOKEN
if "%OPTION%"=="4" goto PUSH_DIRECT
if "%OPTION%"=="5" goto END

echo.
echo [!] Opcion no valida.
pause
goto END

:LOGIN_BROWSER
cls
echo ======================================================================
echo    INICIANDO SESION EN GITHUB MEDIANTE NAVEGADOR WEB...
echo ======================================================================
echo Abriendo ventana de autorizacion...
"C:\Program Files\Git\ucrt64\bin\git-credential-manager.exe" github login --browser
echo.
echo Verificando y enviando commits a GitHub...
git push origin main
goto FINISH

:LOGIN_DEVICE
cls
echo ======================================================================
echo    AUTENTICACION POR CODIGO DE DISPOSITIVO GITHUB
echo ======================================================================
echo Se generara un codigo en pantalla. Abre https://github.com/login/device 
echo en tu navegador habitual, pega el codigo y haz clic en "Authorize".
echo.
"C:\Program Files\Git\ucrt64\bin\git-credential-manager.exe" github login --device
echo.
echo Enviando commits a GitHub...
git push origin main
goto FINISH

:LOGIN_TOKEN
cls
echo ======================================================================
echo    CONFIGURAR TOKEN PERSONAL DE GITHUB (PAT)
echo ======================================================================
echo Si tienes un Personal Access Token (clasico o fine-grained de github.com):
echo.
set /p GITHUB_TOKEN="Pega aqui tu token de GitHub y presiona Enter: "
if "%GITHUB_TOKEN%"=="" (
    echo [!] Token vacio. Operacion cancelada.
    pause
    goto END
)
git remote set-url origin https://%GITHUB_TOKEN%@github.com/MariaJoseConde/MINI-PROYECTO--GESTION-BIBLIOTECARIA.git
echo.
echo Subiendo con Token...
git push origin main
git remote set-url origin https://github.com/MariaJoseConde/MINI-PROYECTO--GESTION-BIBLIOTECARIA.git
goto FINISH

:PUSH_DIRECT
cls
echo ======================================================================
echo    ENVIANDO COMMITS A GITHUB DIRECTAMENTE
echo ======================================================================
echo Ejecutando git push origin main...
echo.
git push origin main
goto FINISH

:FINISH
echo.
if %ERRORLEVEL% EQU 0 (
    echo ======================================================================
    echo   [EXITO TOTAL] Todos tus cambios estan ahora en GitHub!
    echo   Ver repositorio: https://github.com/MariaJoseConde/MINI-PROYECTO--GESTION-BIBLIOTECARIA
    echo ======================================================================
) else (
    echo ======================================================================
    echo   [AVISO] Si hubo algun fallo, prueba con la Opcion [1] o [3].
    echo ======================================================================
)

:END
echo.
pause
