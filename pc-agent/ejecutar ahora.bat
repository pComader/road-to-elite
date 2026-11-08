@echo off
chcp 65001 >nul
rem Ejecuta el agente ya, con la ventana a la vista (para probar o forzar la copia del backup)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rte_agente.ps1" -Visible
pause
