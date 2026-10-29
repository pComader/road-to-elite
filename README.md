# Road To Elite

App personal de entrenamiento de Pablo: Fabrik (solo lectura) + extras, carrera y Z6–Z8, con cobertura de metas, registro, chequeo matinal y análisis de carrera. Datos en su Google Sheet; servidor en Google Apps Script; web en GitHub Pages.

## Estructura
- `src/core.js` · núcleo (semana, día, registro, planificación, sin conexión). Se carga al abrir.
- `src/menu.js` · menú, cobertura, calendario, chequeo, plantillas, avisos. Se descarga después de pintar.
- `src/timer.js` · editor y reloj del timer, burbuja flotante. Se descarga después de pintar (o al tocar ▶).
- `src/styles.css`, `src/sw.js` · estilos y service worker (fuentes).
- `apps-script/Code.gs` · servidor. Se pega en el editor de Apps Script.

## Compilar
```
npm i terser          # una vez
node tools/build.js   # src/ → app.js, m-menu.js, m-timer.js, styles.css, sw.js (minificados y versionados)
```
No hay secretos en este repositorio. La clave de avisos (cuenta de servicio) vive solo en las Propiedades del script.
