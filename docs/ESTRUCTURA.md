# Road To Elite · Estructura de la app y del Sheet

> Estado a 30/10/2026 · servidor **v0.6** · web **0.5** · versión de caché `rte-e35808fbd3`.
> Documento de referencia: qué pieza hace qué, dónde se guarda cada dato y qué está implementado.

---

## 1. Mapa general

```
 Móvil / PC (navegador o app instalada)
 └─ Web  ·  https://pcomader.github.io/road-to-elite/       (GitHub Pages, repo público pComader/road-to-elite)
     │  login Google (Firebase Auth, proyecto «road-to-elite»)
     │  POST {action, idToken, …}
     ▼
 Servidor  ·  Google Apps Script (Web App)                  (ligado al Sheet «Road to Elite · Training Coverage»)
     │  verifica token + email → lee / escribe
     ├─ ESCRIBE solo en ─► Sheet «Road to Elite · Training Coverage»   (pestañas APP · …)
     ├─ LEE (solo lectura) ─► FABRIK PROGRAM                             (programación del box)
     ├─ LEE (solo lectura) ─► ProgramAPP (app de Gabi)                   (copia semanal de vídeos)
     ├─ Drive ─► Configuración / Backups                                 (copia semanal del Sheet)
     └─ (opcional) Firebase Cloud Messaging ─► avisos al móvil

 Claude (tarea programada en la nube, domingos 23:30 Madrid) ─► lee Sheets, añade fila en APP · SEMANAS, te manda el informe por correo + push
```

**Regla de oro:** el único archivo donde se escribe es *Road to Elite · Training Coverage*. FABRIK PROGRAM y la app de Gabi son de solo lectura; el servidor lo garantiza con `miLibro_()`, que solo abre para escribir el `SHEET_ID` propio.

---

## 2. Identificadores y ubicaciones

| Pieza | Dónde | ID / dirección |
|---|---|---|
| Web (producción) | GitHub Pages | https://pcomader.github.io/road-to-elite/ |
| Repositorio | GitHub (público) | `pComader/road-to-elite` |
| Servidor | Apps Script ligado al Sheet | `https://script.google.com/macros/s/AKfycbzAXPslG5m0E6ZkprL7Y79-lqnLfLtTLsgfas0TamMqDcWA0Ja12Nmk_BIlz_7c5kyC/exec` |
| Sheet de la app | Drive › 2.º cerebro › CrossFit › APP | `1q_DbqA4VWLb-1CUuT8ZDGt-yMfiy__YeoT9-4V2IEJ4` |
| FABRIK PROGRAM (solo lectura) | Drive | `1DRBQteuUHesG2gMODigDBTr5LK5PHMsqRIdHpCtT82g` |
| ProgramAPP · app de Gabi (solo lectura) | Drive | `1yL9AmLel4t5BzOT7fddqxMNVE-YqRm02oP1JeUpwqu8` |
| Carpeta APP | Drive | `1qYbRApjKCJDMojmYyhF76GoAUsMAOwGL` |
| Carpeta APP › Configuración | Drive | `1sJr9Tmq-oiSVwUrwnUTqrI4kqZvqJD7I` |
| Carpeta Configuración › Backups | Drive | `1X2gFr5Wd-HfI5JsMcfiKscCu5GPXO-aS` |
| Copias locales del servidor | PC | `E:\IA\APP Road_to_Elite\Configuración\Code_RoadToElite_v0.X.gs` |
| Firebase | Consola Firebase (otra cuenta Gmail) | proyecto `road-to-elite` · login solo con Google |
| Cuenta con acceso | — | `pabloserranolopez@gmail.com` (única) |

---

## 3. Repositorio (GitHub)

| Archivo | Qué es | ¿Se edita a mano? |
|---|---|---|
| `src/core.js` | Núcleo: login, carga, semana, día, bloques, registro, carrera, planificación, chequeo (tarjeta), sin conexión, cola, cabecera, timer (detección), arranque. | **Sí** (fuente) |
| `src/menu.js` | Menú, marcas, cobertura/metas, calendario de eventos, pendientes, descuentos, webs, vídeos, fase del ciclo, chequeo (formulario), añadir bloque, plantillas, avisos, gráficas. Carga diferida. | **Sí** (fuente) |
| `src/timer.js` | Editor y reloj del timer, pitidos, estado guardado, marcador LED, burbuja flotante, timer libre. Carga diferida. | **Sí** (fuente) |
| `src/styles.css` | Estilos (oscuro con naranja; tema claro/auto). | **Sí** (fuente) |
| `src/sw.js` | Service worker (copia para abrir sin red, avisos). | **Sí** (fuente) |
| `tools/build.js` | Compila `src/` → archivos publicados (minifica y pone versión por contenido). | Sí |
| `app.js`, `m-menu.js`, `m-timer.js`, `styles.css`, `sw.js` (raíz) | **Generados** por el build. Es lo que se publica. | **No** |
| `index.html` | Página. Política de seguridad (CSP). Carga Firebase + `config.js` + `app.js` (todo `defer`). | Rara vez |
| `config.js` | Config pública: Firebase, email permitido, URL del servidor, `vapidKey` (avisos), `diasSesion: 14`. | Rara vez |
| `manifest.webmanifest`, `icon*.png/svg` | App instalable; icono «E» sobre negro. | No |
| `apps-script/Code.gs` | Servidor completo. Se pega en el editor de Apps Script. | **Sí** |
| `docs/ESTRUCTURA.md` | Este documento. | Sí |

Compilar: `npm i terser` (una vez) y `node tools/build.js`. Tamaños publicados: núcleo 83 KB · menú 45 KB · timer 25 KB.

---

## 4. Sheet «Road to Elite · Training Coverage»

### 4.1 Pestañas de la app (`APP · …`)

Todas tienen la **fila 1 = cabecera**; el servidor busca las columnas **por nombre**, así que se pueden reordenar o añadir columnas sin romper nada. `prepararHojas()` (dentro de `configurar`) las crea o repara sin borrar datos: formato, desplegables, fechas y colores.

| Pestaña | Qué guarda | Columnas | Quién escribe |
|---|---|---|---|
| **APP · CONFIG** | Parámetros: email, zona horaria, IDs, objetivos (2 km 7:45, 10 km 45:00, HYROX Pro 1:15), semanas de test (2 km 23–29/11, 10 km 30/11–6/12, repetición final de enero), calidad por mes, meta Z6–Z8. | CLAVE · VALOR · NOTA | A mano / Claude |
| **APP · PLAN** | Todo lo programado por bloques: EXTRA, carrera, Z6–Z8, técnica, movilidad y referencias a Fabrik (para moverlo, justificarlo o marcarlo «no hacer»). | ID · FECHA · DÍA · TURNO · ORDEN · ORIGEN · FABRIK_REF · BLOQUE · TÍTULO · CONTENIDO · INTENSIDAD · MIN · CÓDIGOS · POR QUÉ (cursiva) · CIENCIA (técnica · fisiología · biología) · INTERFERENCIAS · ESTADO · CAMBIO_ID · REEMPLAZA · ACTUALIZADO · CANTIDAD | Claude (plan), app (aprobar, no hacer, añadir bloque), a mano |
| **APP · REGISTRO** | Lo realizado por bloque. Clave: FECHA + ID_PLAN. | FECHA · ID_PLAN · BLOQUE · HECHO · RPE · MIN_REAL · DATOS (parciales/vatios) · CARGAS · SUEÑO · MOLESTIAS · NOTAS · REGISTRADO | App |
| **APP · CARRERA** | Datos del Garmin por sesión de carrera. Clave: FECHA + ID_PLAN. El ritmo se calcula si falta. | ID · FECHA · ID_PLAN · SESIÓN · TIPO · DISTANCIA (km) · TIEMPO · RITMO MEDIO (/km) · FC MEDIA · FC MÁX · FC ESTABLE (min) · PARCIALES POR KM · SERIES (tiempos) · PARCIALES CUMPLIDOS · CADENCIA · DESNIVEL (m) · TEMPERATURA (°C) · SUPERFICIE · RPE · SENSACIONES · NOTAS · REGISTRADO | App |
| **APP · ANÁLISIS CARRERA** | Informe que **se reescribe entero** con cada carrera guardada y en el cierre del domingo: conclusiones, tabla por semana, eficiencia Z2, últimas sesiones de calidad. | (bloques de texto + tablas) | Servidor (no editar) |
| **APP · CHEQUEO** | Chequeo de la mañana y semáforo del día. Clave: FECHA. | FECHA · SUEÑO (h) · CALIDAD SUEÑO (1-5) · VFC (ms) · FC REPOSO · ENERGÍA (1-5) · MOLESTIAS (0-5) · ZONA MOLESTIA · ESTRÉS (1-5) · NOTAS · LISTO (0-100) · SEMÁFORO · RECOMENDACIÓN · REGISTRADO | App (+ cálculo del servidor) |
| **APP · METAS** | Las 51 metas (15 semanales + 36 mensuales), editables. | ID · ÁMBITO · PRIORIDAD · ESTÍMULO · META · META POR MES · MÁXIMO · TIPO · UNIDAD · CÓDIGOS · ACTIVA · NOTAS · ORDEN | App / a mano |
| **APP · AJUSTES METAS** | Marcas manuales («hecho fuera del plan»); cuentan en el periodo de su fecha. | ID · FECHA · META_ID · ESTÍMULO · CANTIDAD · NOTA · CREADO | App |
| **APP · HISTÓRICO METAS** | Cierre de cada semana (y de cada mes en su último domingo). | PERIODO · ÁMBITO · DESDE · HASTA · COBERTURA PROGRAMADA · COBERTURA REALIZADA · METAS CUBIERTAS · TOTAL METAS · DETALLE · CERRADO | Servidor (domingo) |
| **APP · EVENTOS** | Calendario de eventos y cómo afectan al entreno. | ID · EVENTO · TIPO · INICIO · FIN · HORA · LUGAR · BLOQUEA · ANTES (días bajar volumen) · DESPUÉS (días recuperación) · CÓMO PROCEDER · ESTADO · NOTAS · CREADO | App / a mano |
| **APP · SEMANAS** | Confirmación de cada semana antes de programar. | LUNES · ESTADO · DOBLES (mañanas libres) · DESCANSO · EVENTOS DE LA SEMANA · DECISIONES · NOTAS · CONFIRMADA | App, Claude (domingo crea la fila), servidor |
| **APP · PENDIENTES** | Lo que no se hizo y se intentará recolocar (solo con tu aprobación). | ID · CREADO · FECHA ORIGINAL · ID_PLAN · BLOQUE · TIPO · MOTIVO · ESTADO · SEMANA DESTINO · NOTAS | Servidor / app |
| **APP · CAMBIOS** | Solicitudes de «Ha surgido algo» y su resolución. | ID · CREADO · DESDE · TURNO DESDE · EVENTO · AFECTA · NOTAS · ESTADO · RESPUESTA | App / Claude |
| **APP · PLANTILLAS** | Bloques reutilizables para «＋ Añadir bloque». | ID · NOMBRE · ORIGEN · TÍTULO · CONTENIDO · INTENSIDAD · MIN · CANTIDAD · CÓDIGOS · POR QUÉ (cursiva) · CIENCIA (…) · INTERFERENCIAS · CREADA | App / a mano |
| **APP · MARCAS** | RMs y marcas (10 RMs importados de la app de Gabi). | FECHA · MOVIMIENTO · TIPO · VALOR · UNIDAD · EVENTO · NOTAS · FUENTE | App |
| **APP · DESCUENTOS** | Códigos de descuento (p. ej. ZUMUB). | MARCA · DESCRIPCIÓN · CÓDIGO · ENLACE · INICIO · FIN · ESTADO · NOTAS | App |
| **APP · WEBS** | Webs de interés. | NOMBRE · URL · CATEGORÍA · NOTA · AÑADIDO | App |
| **APP · VÍDEOS** | Copia de la biblioteca de vídeos aprobados de la app de Gabi (71). | EJERCICIO · ALIAS · VÍDEO · APROBADO POR · FECHA · COPIADO DE APP GABI | Servidor (domingo) |

**Valores de las listas**

- PLAN · TURNO: AM, PM · ORIGEN: FABRIK, EXTRA, CARRERA, Z6–Z8, TÉCNICA, MOVILIDAD.
- PLAN · ESTADO: BORRADOR → PROGRAMADO; PROPUESTA / PROPUESTA · NO HACER (cambios pendientes de aprobar); NO HACER; SUSTITUIDO.
- PLAN · FABRIK_REF: `LUNES` (día entero de Fabrik) o `LUNES·2` (solo el bloque 2), para recolocar o anotar Fabrik sin tocar el archivo de Fabrik.
- EVENTOS · BLOQUEA: Día completo, Mañana, Tarde, Parcial, No bloquea · ESTADO: Por decidir / Decidido.
- SEMANAS · ESTADO: Pendiente de confirmar → Confirmada → Programada.
- PENDIENTES · ESTADO: Pendiente, Propuesto, Reprogramado, Descartado.
- CAMBIOS · ESTADO: Solicitada, Propuesta lista, Aprobada, Rechazada.
- METAS · TIPO: COUNT (sesiones), MIN (minutos totales), MIN_GT (una sesión de más de X min), SALTOS (suma de CANTIDAD).
- CARRERA · TIPO: Z2, Z2 larga, Z4 umbral, Z5 VO2max, Z6–Z8, Test 2 km, Test 10 km, Recuperación, HYROX, Otra.
- CHEQUEO · SEMÁFORO: Verde, Ámbar, Rojo.

**Al editar a mano** APP · PLAN, EVENTOS, METAS, AJUSTES METAS, CARRERA o PLANTILLAS, `onEdit` pone el ID si falta y, en PLAN, rellena DÍA a partir de FECHA.

### 4.2 Pestañas anteriores (sistema Road to 2027, se conservan)

| Pestaña | Uso actual |
|---|---|
| **Dashboard** | Cobertura con fórmulas del sistema anterior (selector de lunes/mes). La app ya no la usa para las metas. |
| **Semana** / **Mes** | Definición original de metas (cabecera en la fila 4; columnas I–U: Mínimo, Tipo, Patrón, Obligatorio, Activo, Máximo, … Código). Se migraron a APP · METAS en v0.5. |
| **carrera** | Plan de carrera por semanas (cabecera en la fila 7). La app lo muestra en Cobertura › Carrera › «Plan de carrera». *Pendiente: mover los tests a 23–29/11 (2 km) y 30/11–6/12 (10 km).* |
| **Guía e histórico** | Reglas del sistema (prioridades, códigos, «FABRIK intocable») y registro histórico manual. |

### 4.3 Códigos de estímulo

Unen los bloques del plan con las metas: W01–W33 (semanales), M01–M57 (mensuales), R01 (Z6–Z8), R02 (calidad Z4), R03 (calidad Z5), T01–T03 (thrusters pesado / ligero / DB ≥30 kg). Una meta puede aceptar varios: `W15|W16`.

---

## 5. Cómo se calculan las cosas

### Metas (cobertura)
- **Programado** = filas de APP · PLAN en estado **PROGRAMADO** cuyos CÓDIGOS coinciden con la meta, dentro del periodo, más los ajustes manuales.
- **Hecho** = de esas filas, las que tienen registro HECHO «Sí» (cuenta 1) o «Parcial» (cuenta 0,5), más los ajustes manuales.
- **Borrador** = filas en BORRADOR. Se muestran aparte y no cuentan.
- COUNT cuenta una exposición por fecha + turno.
- **Semana:** de lunes a domingo, y se reinicia el domingo.
- **Mes:** del día siguiente al último domingo del mes anterior hasta el último domingo de este mes. Una semana que cruza dos meses cuenta entera para el mes nuevo.
- **META POR MES** (por ejemplo `11:3, 12:2, 1:1, *:3`) cambia la meta según el mes; se usa en R02 y R03.
- **Porcentajes:** en la semana, metas cubiertas / total; en el mes, la media del avance de cada meta.

### Semáforo del chequeo (0–100)
- **Lo que pondera:** sueño (5 h → 0, 8 h → 1) 20 · calidad del sueño 10 · energía 20 · molestias 20 · estrés 10 · VFC 20 · FC en reposo 10.
- **VFC y FC en reposo** se comparan con tu media de los 7 chequeos anteriores; hacen falta al menos 3.
- **Resultado:** 72 o más = Verde; de 52 a 71 = Ámbar; menos de 52 = Rojo. Unas molestias de 4 o 5 dan siempre Rojo.
- En ámbar o rojo, los bloques de Z6–Z8 y de calidad de ese día muestran el aviso con la recomendación.

### Análisis de carrera
- **Eficiencia Z2** = velocidad (m/min) ÷ FC media. La tendencia compara las 3 últimas Z2 con las 3 anteriores.
- **Calidad:** parciales cumplidos en las últimas 4 sesiones de Z4, Z5 o test.
- **Por semana:** km, minutos totales, minutos de Z2 (aviso si son menos de 90′), número de sesiones de calidad y de Z6–Z8, ritmo y FC media en Z2.
- **FC estable:** media de los últimos 5 registros.

---

## 6. Servidor (Apps Script `Code.gs`)

**Seguridad en cada petición** (`verificarUsuario_`):
1. Filtro previo gratuito: el token debe decir ser del proyecto `road-to-elite`, estar vigente y ser de tu email. Si no, se rechaza sin consultar a Google y el rechazo se recuerda 10 minutos.
2. Verificación real con Google (`accounts:lookup`, con cabecera Referer porque la clave está restringida a la web) y comprobación de que el email está verificado.
3. El email verificado se guarda en caché 10 minutos.

**Rendimiento:** mientras se monta una respuesta, cada pestaña se lee una sola vez (`conMemo_`); lo de Fabrik se guarda 5 minutos (`fabrikSemana_`).

**Acciones** (`doPost`, campo `action`):

| Grupo | Acciones |
|---|---|
| Semana | `inicio`, `semana` (Fabrik + plan + registro + carrera + chequeos + eventos + confirmación + pendientes + cambios + metas) |
| Registro | `registrar`, `registro_borrar` |
| Plan | `semana_conf` (confirmar semana; se bloquea si hay eventos sin decidir), `plan_aprobar`, `cambio`, `cambio_resolver`, `no_hacer`, `pendiente`, `bloque`, `bloque_borrar` (solo borradores) |
| Eventos | `eventos`, `evento`, `evento_borrar` |
| Metas | `metas`, `meta`, `meta_borrar`, `meta_ajuste`, `cobertura` |
| Carrera | `carrera`, `carrera_lista`, `analisis` |
| Chequeo | `chequeo`, `chequeos` |
| Plantillas | `plantillas`, `plantilla` |
| Otros | `marcas`, `marca`, `marca_borrar`, `descuentos`, `descuento`, `descuento_borrar`, `webs`, `web`, `web_borrar`, `videos` |
| Avisos | `push_token`, `push_prueba` |

**Tareas automáticas** (las crea `configurar`):

| Cuándo (Madrid) | Función | Qué hace |
|---|---|---|
| Cada hora | `revisarAvisos` | Avisos al móvil (solo si `FCM_CUENTA` existe): plan en borrador, propuesta lista, confirmar semana (domingo desde las 20:00), chequeo sin hacer (8:00–11:00). Cada aviso se manda una sola vez. |
| Domingo ~22:45 | `cierreSemanal` | Guarda la semana (y el mes si es su último domingo) en HISTÓRICO METAS y rehace el análisis de carrera. Si se ejecuta pasada la medianoche, cierra el domingo; nunca duplica. |
| Domingo ~23:00 | `copiarVideosGabi` | Copia (solo lectura) los vídeos aprobados de la app de Gabi a APP · VÍDEOS. |
| Domingo ~23:30 | `backupSemanal` | Copia del Sheet en Drive › Backups con la fecha en el nombre. |

**Propiedades del script** (Apps Script › Configuración del proyecto):
- `ULTIMO_BACKUP`.
- `PUSH_TOKENS`: dispositivos con avisos, hasta 5.
- `AVISOS_HECHOS`: avisos ya enviados.
- `FCM_CUENTA`: JSON de la cuenta de servicio de Firebase. *Pendiente de añadir; es secreto y nunca va al repositorio.*

**Instalar una versión nueva:** pegar el código → ejecutar `configurar` → Implementar › Gestionar implementaciones › **Nueva versión** (la URL no cambia).

---

## 7. La web (lo que ves y dónde se guarda)

### Pantallas
- **Cabecera:**
  - ‹ semana › y botón **Hoy**.
  - **Anillo de cobertura** semanal: al tocarlo vas a las metas.
  - Herramientas: calculadora lb/kg y timer libre.
  - Menú (P).
- **Avisos arriba:** propuesta de cambios lista, plan en borrador («Aprobar plan»), confirmar la semana siguiente, semana sin confirmar y pendientes.
- **Ciclo de Fabrik:** fases con su progreso (al tocar una fase ves sus objetivos) y la semana de lunes a domingo (RPE del día, doble sesión, punto de evento).
- **Día:**
  - Cuenta atrás a los tests (≤35 días).
  - Tarjeta de **chequeo / semáforo** y eventos del día.
  - «⚡ Ha surgido algo».
  - Bloques por turno (☀️ AM / 🌙 PM).
  - «＋ Añadir bloque».
- **Bloque:**
  - Pizarra con los kilos calculados desde tus RM, ▶ timer por parte y vídeos.
  - Variantes de competición.
  - Desplegable *por qué aquí · ciencia · interferencias*.
  - Estado (borrador, propuesta, no hacer, aviso del semáforo).
  - Botones: **✔ Hecho** (un toque), Registrar/Editar, No hacer, ☆ Guardar como plantilla, Quitar borrador.
- **Registro:** hecho/parcial/no, RPE, minutos, sueño, parciales, cargas, molestias y notas. Incluye la sección **🏃 Datos de carrera (Garmin)**, abierta por defecto en los bloques de carrera.
- **Menú:**
  - Cobertura y carrera.
  - Calendario de eventos.
  - Pendientes.
  - Mis marcas.
  - Esta semana.
  - Descuentos.
  - Mis webs.
  - Vídeos.
  - **Avisos al móvil**.
  - Apariencia.
  - Instalar.
  - Avisos de Fabrik (erratas).
- **Cobertura:**
  - Anillos de semana y mes.
  - Pestañas Semana / Mes con «Por cubrir», tarjetas de cada meta (barra de programado y de hecho), editar, «marcar hecho a mano» y «＋ Nueva meta».
  - Pestaña Carrera: «Registrar carrera», **gráficas** (eficiencia Z2 y km por semana), conclusiones, tabla semanal, sesiones de calidad y plan de la pestaña *carrera*.
- **Calendario:**
  - Mes con puntos en los días con eventos.
  - Crear, editar y borrar eventos (bloquea, días antes y después, cómo proceder).
  - **Google Calendar** por evento y descarga de todos en **.ics**.

### Guardado en el dispositivo (`localStorage`, prefijo `rte-`)
| Clave | Contenido |
|---|---|
| `rte-cache` | Última respuesta de la semana + configuración + marcas (para el arranque instantáneo). |
| `rte-sem-AAAA-MM-DD` · `rte-semidx` | Copia de cada semana (hasta 6) para verlas **sin conexión**. La semana siguiente se descarga sola, como mucho cada 6 h. |
| `rte-cola` | Cola de lo guardado sin red (registros, carrera, chequeo). Se envía sola al volver la conexión. |
| `rte-ultima` | Última actividad (la sesión caduca a los 14 días sin uso). |
| `rte-videos`, `rte-ciclo` | Vídeos y ciclo de Fabrik. |
| `rte-tm-*`, `rte-tm-run`, `rte-tm-mudo` | Timers personalizados, el timer en marcha (sobrevive a recargas) y el silencio. |
| `rte-calc*`, `rte-tema`, `rte-inst-cerrado`, `rte-push-ok` | Calculadora, tema, aviso de instalar, avisos activados. |

Al **cerrar sesión** se borra todo menos el tema elegido.

### Service worker (`sw.js`)
- Copia de la app y de Firebase: la app abre al instante y también sin red; las actualizaciones se bajan por detrás.
- La versión cambia sola con cada build, y entonces la app se recarga sola.
- Recibe los avisos al móvil y al tocarlos abre la app.
- **Nunca** guarda datos de entrenamiento ni respuestas del servidor.

---

## 8. Seguridad (resumen)
- **Login:** solo con Google y solo para `pabloserranolopez@gmail.com` (se comprueba en el servidor). Probado que otra cuenta no entra.
- **Clave de Firebase:** restringida a la web de la app.
- **Navegador:** CSP estricta (scripts solo propios y de Google), todo el texto se escapa antes de pintarse y los enlaces solo admiten http/https.
- **Escritura:** solo en tu Sheet. Fabrik y la app de Gabi, solo lectura.
- **Repositorio:** público y sin secretos.
- **Pendiente por tu parte:**
  - Quitar la app «Claude» de GitHub del repositorio `programapp`.
  - Activar la verificación en dos pasos en las dos cuentas de Google y en GitHub.

---

## 9. Implementado por versión

| Versión | Qué añadió |
|---|---|
| v0.1–0.2 | Login seguro de una cuenta, servidor con verificación de token, lectura de Fabrik (parser de la app de Gabi), registro, marcas, descuentos, webs, vídeos, backup semanal. |
| v0.3 / web 0.2 | Diseño de la app de Gabi en oscuro con naranja, domingo, timer, calculadora, menú. |
| v0.4 / web 0.3 | APP · PLAN editable por bloques con *por qué* en cursiva; ciencia e interferencias; eventos con antes/después; confirmación de semana; propuestas de cambio, «Ha surgido algo», «no hacer» y pendientes; cobertura adaptada al móvil. |
| v0.5 / web 0.4 | 51 metas calculadas desde el plan y editables, reinicio semanal y mensual (último domingo), histórico, registro de carrera del Garmin, análisis de carrera. |
| v0.6 / web 0.5 | Código partido y minificado (carga diferida); caché del servidor; **modo sin conexión** con cola; Hoy; ✔ Hecho de un toque; anillo de cobertura; chequeo matinal con semáforo; añadir bloques y plantillas; avisos al móvil (falta `FCM_CUENTA`); calendario (Google, .ics); gráficas de carrera; filtro de seguridad y borrado al salir; correo del domingo con el balance de la semana. |

## 10. Pendiente
- **Avisos al móvil:** pegar `FCM_CUENTA` en las Propiedades del script y activarlos en cada dispositivo.
- **Pestaña *carrera*:** mover las fechas de los tests.
- **Comparación semanal** app de Gabi vs Road To Elite en el informe del domingo.
- **Strava:** importación aparcada por ahora.
- **Primera semana real (2–8 nov):** se programa cuando la confirmes.
