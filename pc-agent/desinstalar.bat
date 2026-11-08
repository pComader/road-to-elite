@echo off
chcp 65001 >nul
echo  Quita la tarea programada RoadToElite\Agente y la configuracion (token) de %APPDATA%\RoadToElite.
echo  Los backups ya copiados en E:\2DO CEREBRO\BackUPS NO se tocan.
pause
schtasks /Delete /TN "RoadToElite\Agente" /F
if exist "%APPDATA%\RoadToElite" rmdir /s /q "%APPDATA%\RoadToElite"
echo  Hecho.
pause
