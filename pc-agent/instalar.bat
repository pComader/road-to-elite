@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ROAD TO ELITE - agente del PC
echo  ------------------------------
echo  Que instala: SOLO una tarea programada de Windows (RoadToElite\Agente) que cada hora, con tu sesion iniciada:
echo    1. copia el backup de los jueves de Google Drive a E:\2DO CEREBRO\BackUPS\APP Road to Elite
echo    2. te muestra una ventana si el backup esta sin hacer
echo    3. si Ollama esta abierto, le pasa 3 WODs para anadir conceptos a la base de datos
echo  No instala programas ni necesita permisos de administrador. Usa PowerShell de Windows.
echo  El token se guarda en %%APPDATA%%\RoadToElite\config.json (fuera de las carpetas que ve Claude).
echo.
if exist "%APPDATA%\RoadToElite\config.json" goto tarea
echo  Abre el Sheet - menu Road To Elite - "Agente del PC - ver token" y copia el token.
set /p RTE_TOKEN=  Pega aqui el token y pulsa Intro: 
if "%RTE_TOKEN%"=="" goto sintoken
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=Join-Path $env:APPDATA 'RoadToElite'; New-Item -ItemType Directory -Force -Path $d | Out-Null; $c=[ordered]@{url='https://script.google.com/macros/s/AKfycbzAXPslG5m0E6ZkprL7Y79-lqnLfLtTLsgfas0TamMqDcWA0Ja12Nmk_BIlz_7c5kyC/exec';token=$env:RTE_TOKEN.Trim();destino='E:\2DO CEREBRO\BackUPS\APP Road to Elite';ollama_url='http://localhost:11434';ollama_modelo='';max_wods=3;aviso_cada_horas=4}; [IO.File]::WriteAllText((Join-Path $d 'config.json'), ($c | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))"
set RTE_TOKEN=
:tarea
schtasks /Create /TN "RoadToElite\Agente" /TR "wscript.exe \"%~dp0lanzar.vbs\"" /SC HOURLY /MO 1 /ST 00:07 /F /IT
if errorlevel 1 goto error
echo.
echo  Primera ejecucion de prueba (puede tardar un minuto)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rte_agente.ps1" -Visible
echo.
echo  Listo. Para quitarlo: desinstalar.bat. Registro: agente.log (en esta carpeta).
pause
exit /b 0
:sintoken
echo  Sin token no se puede continuar.
pause
exit /b 1
:error
echo  No se pudo crear la tarea programada.
pause
exit /b 1
