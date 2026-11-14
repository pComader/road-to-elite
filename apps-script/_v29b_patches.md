# v0.29b · cambios que hay que hacer en Code.gs (el resto va en `_v29b.gs`, que se añade tal cual al final)

## 1 · Router: `accion_(a, body, user)` — añadir junto a `case 'lesion_zonas'`

```js
      case 'fichas': return json_({ ok: true, fichas: fichas_() });
      case 'ficha_guardar': var fg = guardarFicha_(body.ficha || {}); return json_({ ok: true, ficha: fg, fichas: fichas_() });
      case 'plan_competi': return json_({ ok: true, plan: planCompeti_(body.id) });
      case 'resumen_lunes': return json_({ ok: true, resumen: resumenLunesDatos_(body.lunes) });
      case 'salud': return json_({ ok: true, salud: saludEstado_() });
```

Y cambiar las dos acciones que devuelven la semana al abrir la app (usan la caché de 15 min; el resto de acciones siguen con `semanaCompleta_` para devolver datos frescos tras escribir):

```js
      case 'inicio':     return json_({ ok: true, email: user.email, config: leerConfig_(), semana: semanaCacheada_(body.semana) });
      case 'semana':     return json_({ ok: true, semana: semanaCacheada_(body.semana) });
```

## 2 · `doPost`: invalidar la caché tras cualquier acción que escriba

Sustituir `var res = accion_(a, body, user);` por:

```js
    var res; try { res = accion_(a, body, user); } finally { if (!esSoloLectura_(a)) invalidarSemana_(); }
```

`esSoloLectura_` (en `_v29b.gs`) usa `SOLO_LECTURA_`: inicio, semana, rendimiento, aprendizaje, op_estado, competis, fichas, salud, resumen_lunes, chequeos, estimulos_lista,
incentivo_datos, lesion_zonas, plan_competi, marcas, descuentos, webs, videos, cobertura, eventos, metas, carrera_lista, plantillas, extras_previa, posicion, motor_wods,
extras_curso, biblioteca, wods, push_prueba. Todo lo demás (incluidos `ficha_guardar`, `analisis`, `metcon_generar`, `enviar_resumen`, `pendiente`, `aviso_visto`, `config_set`…) invalida.
Si el otro módulo añade acciones de solo lectura (p. ej. `rendimiento`), basta con que estén en esa lista. Las acciones del agente del PC (`body.agente`) y `accionBd_` no tocan lo que lee la semana: no hace falta invalidar.

## 3 · `alEditarHoja(e)`: al principio de la función (antes del `try`)

```js
function alEditarHoja(e) {
  try { invalidarSemana_(); } catch (x) {}
  try {
    ...
```

## 4 · Disparadores con salud (`conSalud_`)

Para cada una: renombrar `function X() {` → `function X_sin_() {` y añadir justo debajo `function X() { return conSalud_('X', X_sin_); }`.
(`resumenLunes` ya se envuelve dentro de `_v29b.gs`.)

| función | cambio |
|---|---|
| `domingoNoche` | `function domingoNoche_sin_() {` + `function domingoNoche() { return conSalud_('domingoNoche', domingoNoche_sin_); }` |
| `motorDiario` | `function motorDiario_sin_() {` + `function motorDiario() { return conSalud_('motorDiario', motorDiario_sin_); }` |
| `competisLunes` | `function competisLunes_sin_() { try { copiarCompetis_(); } catch (e) { Logger.log('Competis: ' + e); } }` + `function competisLunes() { return conSalud_('competisLunes', competisLunes_sin_); }` |
| `videosMartes` | `function videosMartes_sin_() {` + `function videosMartes() { return conSalud_('videosMartes', videosMartes_sin_); }` |
| `backupJueves` | `function backupJueves_sin_() {` + `function backupJueves() { return conSalud_('backupJueves', backupJueves_sin_); }` (devuelve `{fecha,zip,md,kb}`: el envoltorio lo conserva; también vale para `case 'backup_ahora'` y `revisarBackup_`) |
| `cargarFabrikDomingo` | `function cargarFabrikDomingo_sin_() {` + `function cargarFabrikDomingo() { return conSalud_('cargarFabrikDomingo', cargarFabrikDomingo_sin_); }` |
| `revisarAvisos` | `function revisarAvisos_sin_() {` + `function revisarAvisos() { return conSalud_('revisarAvisos', revisarAvisos_sin_); }` |
| `sincronizarCalendario` | `function sincronizarCalendario_sin_() {` + `function sincronizarCalendario() { return conSalud_('sincronizarCalendario', sincronizarCalendario_sin_); }` |

Ojo: `configurar` y los disparadores se registran por el nombre del handler (`'revisarAvisos'`, etc.), que no cambia.

`revisarAvisos_sin_`: llamar a `revisarSalud_` al principio, ANTES del `if (!pushActivo_()) return;`:

```js
function revisarAvisos_sin_() {
  var bkAlerta = ''; try { revisarBackup_(); bkAlerta = leerConfig_().backup_alerta || ''; } catch (e) { Logger.log('Backup: ' + e); }
  try { revisarSalud_(); } catch (e) { Logger.log('Salud: ' + e); }
  if (!pushActivo_()) return;
```

## 5 · Archivo mensual: `domingoNoche_sin_` (primer domingo de cada mes)

Añadir una fase al final de la lista (cada fase ya va en su propio try/catch; `archivarSiToca_` no hace nada si no es el primer domingo y `archivarAntiguo_` exige un backup de ≤ 8 días):

```js
  var fases = [['cierre', cierreSemanal], ['carrera', function () { ajusteCarrera_(); }], ['aprendizaje', function () { aprendizajeSemanal(); }], ['backup', backupSemanal], ['archivo', archivarSiToca_]], estado = [];
```

## 6 · Escrituras por lotes (`actualizarEnLote_`)

`aprobarPlanSemana_`: dentro de `bloqueo_`, en vez de un `actualizarFila_` por fila, acumular y escribir una vez.

```js
  bloqueo_(function () {
    var lote = [];
    listar_(HOJAS.PLAN).forEach(function (r) {
      var d = celdaIso_(r.FECHA);
      if (d >= lunes && d <= fin && r.ESTADO === 'BORRADOR') {
        lote.push({ fila: r._fila, obj: { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() } }); n++;
        if (r.PENDIENTE_ID) { ...igual que ahora (pendientes: pocas filas)... }
      }
    });
    actualizarEnLote_(HOJAS.PLAN, lote);
    var s = filaSemana_(lunes), hu = {};
    ...resto sin cambios
```

`programarRango_`:

```js
  bloqueo_(function () {
    var lote = [];
    listar_(HOJAS.PLAN).forEach(function (r) { var d = celdaIso_(r.FECHA);
      if (d < lunes || d > fin || r.ESTADO !== 'BORRADOR' || esFusionPropuesta_(r)) return;
      if (iso && d !== iso) return; if (turno && (r.TURNO === 'AM' ? 'AM' : 'PM') !== turno) return;
      lote.push({ fila: r._fila, obj: { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() } }); n++; });
    actualizarEnLote_(HOJAS.PLAN, lote);
  });
```

(`actualizarEnLote_` hace 1 lectura + 2 `setValues` —ESTADO y ACTUALIZADO— en vez de 2 `setValue` por fila. Cualquier otro bucle de `actualizarFila_` sobre el PLAN se puede cambiar igual.)
Después de un lote no hace falta `MEMO = null` extra si ya se hacía; si no, añadirlo tras `actualizarEnLote_`.

## 7 · `configurar` / `configurarSin_`

Después de la línea de APRENDIZAJE (cuando `prepararHojas()` y `prepararBd_()` ya han corrido y existe `motor_bd_id`):

```js
  try { logc_('OK · v0.29b: ' + prepararV29b_()); } catch (e) { logc_('AVISO · v0.29b: ' + e); }
```

`prepararV29b_` hace: crea `APP · FICHAS`; asegura las columnas `OBJETIVO` y `WODS` en `APP · EVENTOS` (`asegurarColumna_`; además `prepararHojas` las añade solas porque `_v29b.gs` las pone en `ESQUEMA`);
crea `INFORMES` en el libro Motor (también la crea `prepararBd_` al estar en `ESQ_BD_`); instala el disparador del lunes 7:00 (`instalarDisparadorLunes_`: borra el anterior con el mismo handler).
`ARCHIVO · PLAN` y `ARCHIVO · REGISTRO` se crean solas, con la cabecera del origen, la primera vez que `archivarAntiguo_` mueve filas.

## 8 · Taper en la generación de extras (opcional, lo decide el otro proceso)

`taperBloques_(lunes)` devuelve `[]` o un bloque `{FECHA, TURNO:'PM', TÍTULO, CONTENIDO, MIN:40, CÓDIGOS:'CT1', ORIGEN:'EXTRA'}` listo para añadir a la lista `nuevos` de `generarExtras_` (antes de `ajustarNuevos_`).
`CT1` no está en el catálogo de estímulos: si `ajustarNuevos_`/`esIntocable_` lo tratan como desconocido, sembrar un estímulo `CT1` (ORIGEN EXTRA, PM) en `APP · ESTÍMULOS` o añadir `CT1` a `esIntocable_` para que no se recorte.
