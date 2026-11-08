# Llevar el agente (Ollama + backups) a otro PC

**Lo importante:** el agente no depende de tu cuenta de Google ni de Claude. Habla con el servidor de Road To Elite usando su URL y un token, así que funciona igual en cualquier PC con Windows.

- Claude y Gemini están en la nube. Siguen igual en cualquier PC: solo dependen de tu cuenta y de la clave `GEMINI_KEY`, guardada en el servidor.
- Lo único local es Ollama, el agente y la carpeta de destino de los backups.

## Pasos en el PC nuevo

1. **Ollama:** instálalo desde ollama.com y descarga un modelo, por ejemplo `ollama pull llama3.2:3b` o el que uses ahora (`ollama list` en el PC viejo te lo dice).
2. **Archivos del agente:** copia la carpeta `Agente PC`. Si el PC viejo no está disponible, tienes tres fuentes:
   - el último backup de los jueves: `Road_to_Elite_backup_<fecha>.zip` › `codigo_road-to-elite_main.zip` › `pc-agent/`;
   - el repositorio de GitHub `pComader/road-to-elite`, carpeta `pc-agent`;
   - Drive › Backups › «APP Road to Elite · jueves».
3. **Token:** en el Sheet, menú Road To Elite:
   - **«Agente del PC · ver token»**, si el PC viejo sigue siendo tuyo;
   - **«Agente del PC · cambiar token (PC perdido)»**, si lo perdiste o lo vendiste. El token viejo deja de funcionar al momento.
4. **Instalar:** doble clic en `instalar.bat` y pega el token. Crea la tarea programada y hace una prueba.
5. **Si el PC nuevo no tiene disco E:**, abre `%APPDATA%\RoadToElite\config.json` y cambia `destino`, por ejemplo a `D:\\2DO CEREBRO\\BackUPS\\APP Road to Elite`. En JSON las barras van dobles.
6. **En el PC viejo, si lo conservas:** ejecuta `desinstalar.bat`.

   Dos agentes a la vez no rompen nada, pero los dos copiarían el backup y gastarían Ollama.

## Lo que se traslada solo y lo que no

| Cosa | Dónde vive | En otro PC |
|---|---|---|
| Base de datos de WODs, guía, plan, metas | Google Drive / Sheets | Igual |
| Claude (conectores, proyecto, memoria) | Nube, tu cuenta | Igual |
| Gemini (`GEMINI_KEY`) | Propiedades del script del servidor | Igual, no hay que tocarlo |
| Token del agente | Propiedades del script + `%APPDATA%\RoadToElite\config.json` | Repetir el paso 3 |
| Modelo de Ollama | El PC | Repetir el paso 1 |
| Backups ya copiados en E: | El PC | Copiar la carpeta a mano (están también en Drive, los 10 últimos) |

## Si cambia el servidor

- Si se crea una **implementación nueva** en Apps Script en vez de una **versión nueva**, la URL cambia. Habría que cambiar `url` en `config.json`; lo normal es actualizar siempre la implementación existente.
- Si un día prefieres otro modelo de Ollama, pon su nombre en `ollama_modelo`. Para apagar Ollama sin desinstalar nada, pon `max_wods` a 0.

## Comprobar que funciona

- Ejecuta `ejecutar ahora.bat`: verás «Backup al día» u «Backup … copiado» y, si Ollama está abierto, «Ollama (modelo) · WOD».
- En el Sheet de Road To Elite, en APP · CONFIG › `backup_pc`, aparece la fecha del último backup copiado y la carpeta.
