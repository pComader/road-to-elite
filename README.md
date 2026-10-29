# Road To Elite

App personal de entrenamiento de Pablo: programación de **Fabrik** (solo lectura) + **extras** semanales/mensuales + **carrera**, con registro de lo realizado, marcas y cobertura.

- Web: GitHub Pages (`index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.webmanifest`, iconos).
- Servidor: `apps-script/Code.gs`, pegado en *Road to Elite · Training Coverage → Extensiones → Apps Script* y publicado como aplicación web.
- Datos: pestañas `APP · …` de *Road to Elite · Training Coverage*.

## Seguridad
- Login con Google (Firebase) y **una sola cuenta permitida**, comprobada otra vez en el servidor (token + email verificado).
- El servidor **solo escribe** en Training Coverage. FABRIK PROGRAM y la app de Gabi (`programapp`) se abren **solo para leer**.
- Nada de este repositorio es secreto: la configuración de Firebase es pública por diseño.
