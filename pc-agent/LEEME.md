# Agente del PC · Road To Elite

Una tarea programada de Windows (`RoadToElite\Agente`) que se lanza cada hora con tu sesión iniciada. No instala programas ni pide permisos de administrador: usa PowerShell de Windows y, si está abierto, Ollama.

## Qué hace

1. **Backup de los jueves:** el servidor lo hace los jueves a las 10:00 en Drive › Backups › «APP Road to Elite · jueves». El agente lo copia (zip + .md con la fecha en el nombre) a `E:\2DO CEREBRO\BackUPS\APP Road to Elite` y avisa al servidor.
2. **Aviso:** si a las 16:00 del jueves falta el backup en Drive o en el PC:
   - te llega un correo;
   - sale un aviso en la app;
   - aparece una ventana en el PC, como mucho cada 4 h.

   El aviso desaparece solo en cuanto el backup está hecho. Si el PC estaba apagado, la copia se hace en la primera hora que esté encendido.
3. **Ollama:** si está abierto, cada hora pasa 3 WODs de `MOTOR · ANÁLISIS (Base_de_datos_WOD)` a tu modelo local para añadir CONCEPTOS. Esos conceptos los usa el motor para relacionar estímulos.

## Instalar

1. En el Sheet: menú **Road To Elite › Agente del PC · ver token** y copia el token. No se lo pases a nadie, tampoco a Claude.
2. Doble clic en `instalar.bat`, pega el token y pulsa Intro. Hace una primera ejecución de prueba.

El token se guarda en `%APPDATA%\RoadToElite\config.json`, fuera de las carpetas que ve Claude.

## Ajustes

Están en `%APPDATA%\RoadToElite\config.json`:

- `destino`: carpeta de los backups.
- `max_wods`: WODs por hora para Ollama; 0 lo desactiva.
- `ollama_modelo`: vacío = el primero que tengas instalado.
- `aviso_cada_horas`: cada cuánto repite la ventana de aviso.

## Otros

- `ejecutar ahora.bat`: lo lanza ya, con la ventana visible.
- `desinstalar.bat`: quita la tarea programada y la configuración. Los backups ya copiados no se tocan.
- `agente.log`: registro, sin secretos.

## Otro PC

Si cambias de PC o lo pierdes, sigue `OTRO_PC.md`. El agente no depende de tu cuenta: solo necesita la URL del servidor y el token.
