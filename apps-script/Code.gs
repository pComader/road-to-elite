/**
 * Road To Elite — servidor (Apps Script) · versión 0.4
 * ------------------------------------------------------------
 * Se pega en: Road to Elite · Training Coverage → Extensiones → Apps Script.
 *
 * Seguridad (por capas):
 *  · Solo responde a UNA cuenta (CONFIG.EMAIL_PERMITIDO). Cada petición trae el token de Firebase y se
 *    comprueba aquí, en el servidor, con Google (no basta con que la web lo diga).
 *  · ESCRIBE solo en este archivo (CONFIG.SHEET_ID) y, los domingos, una copia de seguridad en tu carpeta Backups.
 *    Cualquier intento de escribir en otro libro lanza error.
 *  · FABRIK PROGRAM y la app de Gabi (ProgramAPP) se abren SOLO para leer. Ninguna función escribe en ellos.
 *
 * Lectura de Fabrik: reutiliza el lector de la app de Gabi (mismas funciones puras, copiadas, sin modificar).
 *   Pestaña 1 = ciclo. Después, parejas: semana + NOTAS. Manda la POSICIÓN, no el nombre.
 */

// ===================== CONFIGURACIÓN =====================
var CONFIG = {
  NOMBRE_APP: 'Road To Elite',
  VERSION: '0.12',
  URL_APP: 'https://pcomader.github.io/road-to-elite/',   // la clave de Firebase solo acepta peticiones desde aquí
  EMAIL_PERMITIDO: 'pabloserranolopez@gmail.com',
  FIREBASE_API_KEY: 'AIzaSyArN_Bk25gA6TnHYxOg5vv-tHVohHIhnZM',
  FIREBASE_PROYECTO: 'road-to-elite',
  SHEET_ID: '1q_DbqA4VWLb-1CUuT8ZDGt-yMfiy__YeoT9-4V2IEJ4',      // Road to Elite · Training Coverage (único sitio donde se escribe)
  FABRIK_ID: '1DRBQteuUHesG2gMODigDBTr5LK5PHMsqRIdHpCtT82g',     // FABRIK PROGRAM · SOLO LECTURA
  PROGRAMAPP_ID: '1yL9AmLel4t5BzOT7fddqxMNVE-YqRm02oP1JeUpwqu8', // App de Gabi · SOLO LECTURA (copia semanal de vídeos)
  BACKUPS_ID: '1X2gFr5Wd-HfI5JsMcfiKscCu5GPXO-aS',             // Drive: APP / Configuración / Backups
  ZONA: 'Europe/Madrid',
  CACHE_SEG: 300
};

var DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
var PROPS = PropertiesService.getScriptProperties();

// Pestañas de la app (fila 1 = cabecera). Las columnas se buscan por nombre.
var HOJAS = {
  CONFIG: 'APP · CONFIG', PLAN: 'APP · PLAN', REGISTRO: 'APP · REGISTRO', MARCAS: 'APP · MARCAS',
  DESCUENTOS: 'APP · DESCUENTOS', WEBS: 'APP · WEBS', VIDEOS: 'APP · VÍDEOS',
  EVENTOS: 'APP · EVENTOS', SEMANAS: 'APP · SEMANAS', PENDIENTES: 'APP · PENDIENTES', CAMBIOS: 'APP · CAMBIOS'
};

// ===================== API WEB =====================
function doGet() {
  return json_({ ok: true, servicio: CONFIG.NOMBRE_APP, version: CONFIG.VERSION, hora: new Date().toISOString() });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var user = verificarUsuario_(body.idToken);
    if (!user.ok) return json_(user);
    var a = body.action, t0 = Date.now();
    // Operaciones que pueden llegar desde la cola sin conexión: si ya se procesaron (mismo «op»), no se repiten.
    var op = /^[\w-]{8,60}$/.test(String(body.op || '')) ? 'op_' + body.op : '', cacheOp = CacheService.getScriptCache();
    if (op && cacheOp.get(op)) return json_({ ok: true, repetida: true });
    var res = accion_(a, body, user);
    if (op && res && res.ok) cacheOp.put(op, '1', 21600);
    var ms = Date.now() - t0;
    if (ms > 4000) Logger.log('LENTO · ' + a + ' · ' + ms + ' ms');
    res._ms = ms;
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: 'interno', detalle: String(err && err.message || err) });
  }
}

/** Cada acción devuelve un objeto; doPost lo envía como JSON. */
function accion_(a, body, user) {
  var json_ = function (o) { return o; };   // dentro de las acciones, «json_» solo devuelve el objeto
  {
    switch (a) {
      case 'inicio':     return json_({ ok: true, email: user.email, config: leerConfig_(), semana: semanaCompleta_(body.semana) });
      case 'semana':     return json_({ ok: true, semana: semanaCompleta_(body.semana) });
      case 'registrar':  return json_({ ok: true, registro: guardarRegistro_(body.registro || {}) });
      case 'registro_borrar': borrarRegistro_(body.registro || {}); return json_({ ok: true });
      case 'marcas':     return json_({ ok: true, marcas: listar_(HOJAS.MARCAS) });
      case 'marca':      anadirFila_(HOJAS.MARCAS, limpiarMarca_(body.marca || {})); return json_({ ok: true, marcas: listar_(HOJAS.MARCAS) });
      case 'marca_borrar': borrarFila_(HOJAS.MARCAS, body.fila, body.coincide || {}); return json_({ ok: true, marcas: listar_(HOJAS.MARCAS) });
      case 'descuentos': return json_({ ok: true, descuentos: listar_(HOJAS.DESCUENTOS) });
      case 'descuento':  anadirFila_(HOJAS.DESCUENTOS, permitidas_(body.descuento || {}, ['MARCA', 'DESCRIPCIÓN', 'CÓDIGO', 'ENLACE', 'INICIO', 'FIN', 'ESTADO', 'NOTAS'])); return json_({ ok: true, descuentos: listar_(HOJAS.DESCUENTOS) });
      case 'descuento_borrar': borrarFila_(HOJAS.DESCUENTOS, body.fila, body.coincide || {}); return json_({ ok: true, descuentos: listar_(HOJAS.DESCUENTOS) });
      case 'webs':       return json_({ ok: true, webs: listar_(HOJAS.WEBS) });
      case 'web':        var w = permitidas_(body.web || {}, ['NOMBRE', 'URL', 'CATEGORÍA', 'NOTA']); w['AÑADIDO'] = ahora_(); anadirFila_(HOJAS.WEBS, w); return json_({ ok: true, webs: listar_(HOJAS.WEBS) });
      case 'web_borrar': borrarFila_(HOJAS.WEBS, body.fila, body.coincide || {}); return json_({ ok: true, webs: listar_(HOJAS.WEBS) });
      case 'videos':     return json_({ ok: true, videos: leerVideos_() });
      case 'cobertura':  return json_({ ok: true, cobertura: cobertura_() });
      // --- v0.4: eventos, confirmación de semana, propuestas, pendientes ---
      case 'eventos':    return json_({ ok: true, eventos: listar_(HOJAS.EVENTOS) });
      case 'evento':     var idEv = guardarEvento_(body.evento || {}); return json_({ ok: true, id: idEv, eventos: listar_(HOJAS.EVENTOS) });
      case 'evento_borrar': borrarEvento_(body.id); return json_({ ok: true, eventos: listar_(HOJAS.EVENTOS) });
      case 'semana_conf': guardarSemanaConf_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver || body.lunes) });
      case 'plan_aprobar': var nAp = aprobarPlanSemana_(body.lunes); refrescarResumen_(); if (leerConfig_().resumen_auto !== 'No') { try { enviarResumenSemana_(body.lunes); } catch (e) { Logger.log('Correo: ' + e); } } return json_({ ok: true, aprobados: nAp, semana: semanaCompleta_(body.lunes) });
      case 'cambio':     var idC = solicitarCambio_(body); return json_({ ok: true, id: idC, semana: semanaCompleta_(body.ver) });
      case 'cambio_resolver': resolverCambio_(body.cambio, !!body.aprobar); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'no_hacer':   noHacer_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      // --- v0.5: metas editables, registro de carrera y análisis ---
      case 'metas':      return json_({ ok: true, metas: metasDe_(body.fecha), lista: listar_(HOJAS.METAS) });
      case 'meta':       var idM = guardarMeta_(body.meta || {}); return json_({ ok: true, id: idM, metas: metasDe_(body.fecha), lista: listar_(HOJAS.METAS) });
      case 'meta_borrar': borrarMeta_(body.id); return json_({ ok: true, metas: metasDe_(body.fecha), lista: listar_(HOJAS.METAS) });
      case 'meta_ajuste': ajusteMeta_(body); return json_({ ok: true, metas: metasDe_(body.fecha) });
      case 'carrera':    var idCa = guardarCarrera_(body.carrera || {}); return json_({ ok: true, id: idCa, analisis: analizarCarrera_() });
      case 'carrera_lista': return json_({ ok: true, carrera: listar_(HOJAS.CARRERA).slice(-60) });
      case 'analisis':   return json_({ ok: true, analisis: analizarCarrera_() });
      // --- v0.6: chequeo matinal, bloques y plantillas desde la app, avisos al móvil ---
      case 'chequeo':    return json_({ ok: true, chequeo: guardarChequeo_(body.chequeo || {}) });
      case 'chequeos':   return json_({ ok: true, chequeos: listar_(HOJAS.CHEQUEO).slice(-30) });
      case 'bloque':     var idB = crearBloque_(body.bloque || {}); return json_({ ok: true, id: idB, semana: semanaCompleta_(body.ver) });
      case 'bloque_borrar': borrarBloque_(body.id); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'plantillas': return json_({ ok: true, plantillas: listar_(HOJAS.PLANTILLAS) });
      case 'plantilla':  guardarPlantilla_(body.plantilla || {}); return json_({ ok: true, plantillas: listar_(HOJAS.PLANTILLAS) });
      case 'push_token': guardarTokenPush_(body.token); return json_({ ok: true });
      case 'push_prueba': return json_({ ok: true, enviados: enviarPush_('Road To Elite', 'Los avisos funcionan en este dispositivo.') });
      case 'pendiente':  var pd = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ID === String(body.id); })[0];
                         if (!pd) throw new Error('no_encontrado');
                         if (['Pendiente', 'Propuesto', 'Reprogramado', 'Descartado'].indexOf(body.estado) < 0) throw new Error('estado_no_valido');
                         actualizarFila_(HOJAS.PENDIENTES, pd._fila, { ESTADO: body.estado }); return json_({ ok: true, pendientes: pendientesAbiertos_() });
      // --- v0.9: Fabrik en el plan, extras automáticos, hoja de la semana, refuerzos, notas, WODs, avisos ---
      case 'cargar_fabrik': var rf = cargarFabrikSemana_(body.lunes); return json_({ ok: true, carga: rf, semana: semanaCompleta_(body.ver || body.lunes) });
      case 'extras_previa': return json_({ ok: true, previa: generarExtras_(body.lunes, { simular: true }) });
      case 'config_set': if (['endurance_manana'].indexOf(body.clave) < 0) throw new Error('clave_no_permitida');
                         ponerConfig_(body.clave, body.valor ? 'Sí' : 'No', 'Endurance de mañana: la Z2 (carrera/erg) solo por la mañana; el domingo de comodín (Sí/No, también desde aquí)');
                         return json_({ ok: true, config: leerConfig_() });
      case 'generar_extras': var rg = generarExtras_(body.lunes); refrescarResumen_(); return json_({ ok: true, extras: rg, semana: semanaCompleta_(body.ver || body.lunes) });
      case 'posicion':   return json_({ ok: true, posicion: conMemo_(function () { return posicionOptima_(body); }) });
      case 'bloque_editar': editarBloque_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'intercambiar': intercambiarBloques_(body.a, body.b); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'hoja_semana': return json_({ ok: true, filas: pintarHojaSemana_(body.lunes) });
      case 'enviar_resumen': return json_({ ok: true, enviado: enviarResumenSemana_(body.lunes) });
      case 'extras_curso': return json_({ ok: true, extras: conMemo_(function () { return extrasCurso_(body.lunes); }) });
      case 'biblioteca': return json_({ ok: true, biblioteca: biblioteca_() });
      case 'bloque_quitar': quitarBloque_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'refuerzo':   guardarRefuerzo_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'refuerzo_borrar': var rz = listar_(HOJAS.REFUERZOS).filter(function (r) { return r.ID === String(body.id); })[0]; if (!rz) throw new Error('no_encontrado');
                         borrarFila_(HOJAS.REFUERZOS, rz._fila, { ID: rz.ID }); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'nota_bloque': return json_({ ok: true, nota: guardarNotaBloque_(body.nota || {}) });
      case 'wods':       return json_({ ok: true, wods: listar_(HOJAS.WODS) });
      case 'wod':        var idW = guardarWod_(body.wod || {}); return json_({ ok: true, id: idW, wods: listar_(HOJAS.WODS) });
      case 'wod_borrar': borrarWod_(body.id); return json_({ ok: true, wods: listar_(HOJAS.WODS) });
      case 'aviso_visto': avisoVisto_(body.id); return json_({ ok: true, config: leerConfig_() });
      case 'evento_aprobar': var ea = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(body.id); })[0]; if (!ea) throw new Error('no_encontrado');
                         actualizarFila_(HOJAS.EVENTOS, ea._fila, { ESTADO: body.aprobar ? 'Por decidir' : 'Ignorado' }); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'pedir_claude': pedirClaude_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver || body.lunes) });
    }
    return json_({ ok: false, error: 'accion_desconocida' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ===================== SEGURIDAD =====================
/** Comprueba el token de Firebase con Google y que el email sea el único permitido y esté verificado. */
function verificarUsuario_(idToken) {
  if (!idToken) return { ok: false, error: 'sin_sesion' };
  var cache = CacheService.getScriptCache();
  var clave = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(idToken).slice(0, 4096))).slice(0, 40);
  if (cache.get('no' + clave)) return { ok: false, error: 'sesion_caducada' };
  var email = cache.get(clave);
  if (!email) {
    // Filtro previo SIN coste: si el token ni siquiera dice ser tuyo, de este proyecto y vigente, se rechaza sin consultar a Google.
    // (No sustituye a la comprobación de Google de abajo, que es la que verifica la firma.)
    var pre = cargaJwt_(idToken);
    if (!pre || pre.aud !== CONFIG.FIREBASE_PROYECTO || !(pre.exp * 1000 > Date.now()) || String(pre.email || '').toLowerCase() !== CONFIG.EMAIL_PERMITIDO) {
      cache.put('no' + clave, '1', 600);
      return { ok: false, error: pre && pre.email && String(pre.email).toLowerCase() !== CONFIG.EMAIL_PERMITIDO ? 'no_autorizado' : 'sesion_caducada' };
    }
    var res = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CONFIG.FIREBASE_API_KEY,
      { method: 'post', contentType: 'application/json', headers: { Referer: CONFIG.URL_APP }, payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'sesion_caducada' };
    var u = (JSON.parse(res.getContentText()).users || [])[0];
    if (!u || !u.email || u.emailVerified !== true) return { ok: false, error: 'sesion_caducada' };
    email = String(u.email).toLowerCase();
    cache.put(clave, email, Math.max(30, Math.min(600, Math.floor(pre.exp - Date.now() / 1000) - 30)));   // nunca más que la vida del token
  }
  if (email !== CONFIG.EMAIL_PERMITIDO) return { ok: false, error: 'no_autorizado' };
  return { ok: true, email: email };
}

/** Único libro en el que se puede escribir. Si alguien cambia el ID por error, se para aquí. */
/** Lee (sin verificar) la parte central de un token JWT. Solo sirve de filtro previo. */
function cargaJwt_(t) {
  var p = String(t || '').split('.');
  if (p.length !== 3 || p[1].length > 3000) return null;
  try {
    var s = p[1].replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    return JSON.parse(Utilities.newBlob(Utilities.base64Decode(s)).getDataAsString());
  } catch (e) { return null; }
}

function miLibro_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  if (ss.getId() !== CONFIG.SHEET_ID) throw new Error('escritura_bloqueada');
  return ss;
}

/** Libros de solo lectura (Fabrik y app de Gabi). Nunca se usan para escribir. */
function fabrik_() { return SpreadsheetApp.openById(CONFIG.FABRIK_ID); }
function programApp_() { return SpreadsheetApp.openById(CONFIG.PROGRAMAPP_ID); }

function hojaMia_(nombre) {
  var sh = miLibro_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la pestaña ' + nombre);
  return sh;
}

function bloqueo_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ===================== TABLAS (solo en este libro) =====================
function cabeceras_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
}

/**
 * Lecturas agrupadas: mientras se monta una respuesta (semana, cobertura, metas) cada pestaña se lee UNA sola vez.
 * Fuera de eso se lee siempre fresca (las escrituras nunca usan una copia vieja).
 */
var MEMO = null;
function conMemo_(fn) {
  if (MEMO) return fn();
  MEMO = {};
  try { return fn(); } finally { MEMO = null; }
}
/** Filas de una pestaña de la app como objetos { CABECERA: texto, _fila }. */
function listar_(nombre) {
  if (MEMO && MEMO[nombre]) return MEMO[nombre];
  var filas = listarHoja_(nombre);
  if (MEMO) MEMO[nombre] = filas;
  return filas;
}
function listarHoja_(nombre) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, cab.length).getDisplayValues().map(function (r, i) {
    var o = { _fila: i + 2 };
    cab.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  }).filter(function (o) { return cab.some(function (h) { return String(o[h]).trim(); }); });
}

/**
 * Valor seguro para escribir en el Sheet (configuración es_ES):
 *  · «46:10» o «5:41» (tiempos y ritmos) se guardan como TEXTO: si no, el Sheet los convierte en horas (46:10:00).
 *  · Un texto que empieza por «=» o por «+» seguido de letras se guarda como texto (si no, fórmula o #ERROR!).
 *  · Números, fechas dd/mm/aaaa y negativos (-1) no se tocan.
 */
function celdaSegura_(v) {
  if (typeof v !== 'string' || !v) return v;
  if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(v)) return "'" + v;
  if (/^=/.test(v)) return "'" + v;
  if (/^\+/.test(v) && !/^\+\d+([.,]\d+)?$/.test(v)) return "'" + v;
  return v;
}
function filaDe_(cab, o) { return cab.map(function (h) { return o[h] == null ? '' : celdaSegura_(o[h]); }); }

function anadirFila_(nombre, o) {
  return bloqueo_(function () {
    var sh = hojaMia_(nombre), cab = cabeceras_(sh);
    var fila = Math.max(1, sh.getLastRow()) + 1;
    sh.getRange(fila, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return fila;
  });
}

/** Borra una fila solo si sigue teniendo lo que la app cree que tiene (evita borrar la fila equivocada). */
function borrarFila_(nombre, fila, coincide) {
  fila = Number(fila);
  if (!(fila >= 2)) throw new Error('fila_no_valida');
  bloqueo_(function () {
    var sh = hojaMia_(nombre), cab = cabeceras_(sh);
    var r = sh.getRange(fila, 1, 1, cab.length).getDisplayValues()[0];
    var ok = Object.keys(coincide).length > 0 && Object.keys(coincide).every(function (h) {
      var j = cab.indexOf(h); return j >= 0 && String(r[j]).trim() === String(coincide[h]).trim();
    });
    if (!ok) throw new Error('la_fila_ha_cambiado');
    sh.deleteRow(fila);
  });
}

function permitidas_(o, campos) {
  var out = {};
  campos.forEach(function (c) { if (o[c] != null) out[c] = String(o[c]).slice(0, 2000); });
  return out;
}

function limpiarMarca_(m) {
  var o = permitidas_(m, ['FECHA', 'MOVIMIENTO', 'TIPO', 'VALOR', 'UNIDAD', 'EVENTO', 'NOTAS']);
  if (!o.MOVIMIENTO || !o.VALOR) throw new Error('marca_incompleta');
  o.MOVIMIENTO = o.MOVIMIENTO.toUpperCase();
  o.FECHA = o.FECHA || hoyTxt_();
  o.FUENTE = 'App Road To Elite';
  return o;
}

function hoyIso_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd'); }
function hoyTxt_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'dd/MM/yyyy'); }
function ahora_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'dd/MM/yyyy HH:mm'); }
function isoOk_(x) { return /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? String(x) : ''; }
function celdaIso_(c) {
  if (c instanceof Date) return Utilities.formatDate(c, CONFIG.ZONA, 'yyyy-MM-dd');
  var s = String(c || '').trim();
  return isoOk_(s) || fechaIso(s);
}
function lunesDe_(iso) {
  iso = isoOk_(iso) || hoyIso_();
  var dow = new Date(iso + 'T12:00:00Z').getUTCDay();
  return sumarDias(iso, -((dow + 6) % 7));
}

// ===================== CONFIG =====================
function leerConfig_() {
  var out = {};
  listar_(HOJAS.CONFIG).forEach(function (r) { if (r.CLAVE) out[r.CLAVE] = r.VALOR; });
  return out;
}

// ===================== SEMANA: FABRIK + PLAN + REGISTRO =====================
/**
 * semana = lunes 'yyyy-MM-dd' (opcional). Por defecto, la semana actual.
 * Devuelve: lo de Fabrik de esa semana (si existe), las filas de APP · PLAN y lo registrado en APP · REGISTRO.
 */
function semanaCompleta_(semana) { return conMemo_(function () { return semanaCompletaSin_(semana); }); }
/** Lo de Fabrik para una semana, guardado 5 min: Fabrik solo se abre cuando la copia caduca (es lo más lento). */
function fabrikSemana_(lunes) {
  var cache = CacheService.getScriptCache(), clave = 'fab2_' + lunes, v = cache.get(clave);
  if (v) return JSON.parse(v);
  var est = estructura_(fabrik_());
  var fab = est.semanas.filter(function (s) { return s.iso === lunes; })[0] || null;
  var out = { lista: est.semanas.map(function (s) { return { iso: s.iso, nombre: s.nombre }; }), erratas: est.erratas, fabrik: fab ? semanaBase_(fab, est) : null };
  try { cache.put(clave, JSON.stringify(out), CONFIG.CACHE_SEG); } catch (e) { /* demasiado grande: se recalcula */ }
  return out;
}
function semanaCompletaSin_(semana) {
  var lunes = lunesDe_(semana);
  var domingo = sumarDias(lunes, 6);
  var F = fabrikSemana_(lunes);
  var enSemana = function (r) { var d = celdaIso_(r.FECHA); return d && d >= lunes && d <= domingo; };
  var base = {
    lunes: lunes, hoy: hoyIso_(), semanasFabrik: F.lista, erratasFabrik: F.erratas,
    fabrik: F.fabrik,
    plan: listar_(HOJAS.PLAN).filter(enSemana).sort(function (x, y) { return (Number(x.ORDEN) || 0) - (Number(y.ORDEN) || 0); }),
    registro: listar_(HOJAS.REGISTRO).filter(enSemana),
    carrera: listar_(HOJAS.CARRERA).filter(enSemana),
    chequeos: listar_(HOJAS.CHEQUEO).filter(function (r) { var d = celdaIso_(r.FECHA); return d && d >= sumarDias(lunes, -1) && d <= domingo; }),
    push: pushActivo_(),
    eventos: eventosEntre_(sumarDias(lunes, -35), sumarDias(lunes, 120)),
    conf: filaSemana_(lunes), confSiguiente: filaSemana_(sumarDias(lunes, 7)),
    pendientes: pendientesAbiertos_(), cambios: cambiosAbiertos_(),
    metas: metasDe_(lunes),
    fabrikCambios: cambiosFabrik_(filaSemana_(lunes), F.fabrik)
  };
  var out = Object.assign(base, extrasSemana_(lunes, base));
  try { out.clave = claveSemana_(lunes, base.plan); } catch (e) { out.clave = {}; }
  try { var pk = pesoKg_(); out.combustible = {}; for (var k = 0; k < 7; k++) { var dk = sumarDias(lunes, k); out.combustible[dk] = combustibleDia_(dk, pk); } } catch (e) { out.combustible = {}; }
  return out;
}

// ===================== v0.8 · DETECTOR DE CAMBIOS EN FABRIK (solo lectura) =====================
/** Huella corta del contenido de cada día de Fabrik (títulos + texto de cada parte). */
function huellasFabrik_(fab) {
  var out = {};
  ((fab && fab.dias) || []).forEach(function (d) {
    var txt = JSON.stringify((d.bloques || []).map(function (b) { return [b.titulo, (b.partes || []).map(function (p) { return p.texto; })]; }));
    out[d.nombre] = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, txt)).slice(0, 12);
  });
  return out;
}
/** Días cuyo contenido de Fabrik ha cambiado desde que se aprobó la semana (o que se subieron después). */
function cambiosFabrik_(conf, fab) {
  if (!conf || !conf['HUELLA FABRIK'] || !fab) return [];
  var antes = {}; try { antes = JSON.parse(conf['HUELLA FABRIK']); } catch (e) { return []; }
  var ahora = huellasFabrik_(fab);
  return Object.keys(ahora).filter(function (d) { return antes[d] !== ahora[d]; }).map(function (d) { return { dia: d, nuevo: !antes[d], aprobado: conf['FABRIK LEÍDO'] || '' }; });
}

// ===================== v0.8 · LOS TESTS COMO EVENTOS (una sola fuente de fechas) =====================
function migrarTestsAEventos_() {
  var cfg = leerConfig_(), evs = listar_(HOJAS.EVENTOS), n = 0;
  [['test_2km', 'Test 2 km'], ['test_10km', 'Test 10 km']].forEach(function (t) {
    var txt = String(cfg[t[0]] || ''), f = txt.match(/(\d{1,2}\/\d{1,2}\/\d{4})\D+(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (!f || evs.some(function (e) { return norm(e.EVENTO) === norm(t[1]); })) return;
    guardarEvento_({ EVENTO: t[1], TIPO: 'Carrera', INICIO: f[1], FIN: f[2], BLOQUEA: 'No bloquea', 'ANTES (días bajar volumen)': '1', 'DESPUÉS (días recuperación)': '1',
      'CÓMO PROCEDER': 'Semana del test: el día exacto se fija al programar la semana (descansado, sin Z6–Z8 ni pierna pesada el día antes).', ESTADO: 'Decidido', NOTAS: 'TEST · migrado de APP · CONFIG' });
    n++;
  });
  return n;
}

// ===================== v0.7 · DOMINGO EN CADENA: cierre → vídeos → backup =====================
/** Un solo disparador hace las tres fases en orden y deja el resultado en APP · CONFIG (clave «ultimo_domingo»). */
function domingoNoche() {
  var fases = [['cierre', cierreSemanal], ['carrera', ajusteCarrera_], ['vídeos', copiarVideosGabi], ['backup', backupSemanal]], estado = [];
  fases.forEach(function (f) {
    try { f[1](); estado.push(f[0] + ' OK ' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'HH:mm')); }
    catch (e) { estado.push(f[0] + ' FALLO (' + String(e && e.message || e).slice(0, 120) + ')'); }
  });
  ponerConfig_('ultimo_domingo', hoyTxt_() + ' · ' + estado.join(' · '), 'Resultado de las tareas del domingo (lo lee el informe de las 23:30)');
  Logger.log('OK · Domingo: ' + estado.join(' · '));
}
function ponerConfig_(clave, valor, nota) {
  var x = listar_(HOJAS.CONFIG).filter(function (r) { return r.CLAVE === clave; })[0];
  if (x) actualizarFila_(HOJAS.CONFIG, x._fila, { VALOR: valor });
  else anadirFila_(HOJAS.CONFIG, { CLAVE: clave, VALOR: valor, NOTA: nota || '' });
}

/** La semana de Fabrik ya construida, con caché de 5 min (Fabrik solo se lee). */
function semanaBase_(elegida, est) {
  var cache = CacheService.getScriptCache();
  var claveCache = 'rte_' + elegida.id + '_' + elegida.iso + '_' + (elegida.variantes || []).map(function (v) { return v.hoja.getSheetId(); }).join('-');
  var base = cache.get(claveCache);
  if (base) return JSON.parse(base);
  base = construirSemana(
    elegida.hoja.getDataRange().getDisplayValues(),
    elegida.notas ? elegida.notas.getDataRange().getDisplayValues() : [],
    est.ciclo, elegida.nombre, elegida.iso);
  (elegida.variantes || []).forEach(function (v) { aplicarVariante(base, v.nombre, v.hoja.getDataRange().getDisplayValues()); });
  try { cache.put(claveCache, JSON.stringify(base), CONFIG.CACHE_SEG); } catch (e) { /* demasiado grande */ }
  return base;
}

// ===================== REGISTRO (realizado) =====================
var CAMPOS_REGISTRO = ['FECHA', 'ID_PLAN', 'BLOQUE', 'HECHO', 'RPE', 'MIN_REAL', 'DATOS (parciales/vatios)', 'CARGAS', 'SUEÑO', 'MOLESTIAS', 'NOTAS'];

/** Crea o actualiza (misma FECHA + ID_PLAN + BLOQUE) lo que has hecho. */
function guardarRegistro_(r) {
  var o = permitidas_(r, CAMPOS_REGISTRO);
  if (!o.FECHA || !(o.ID_PLAN || o.BLOQUE)) throw new Error('registro_incompleto');
  if (o.HECHO && ['Sí', 'Parcial', 'No'].indexOf(o.HECHO) < 0) throw new Error('hecho_no_valido');
  if (o.RPE && !(Number(o.RPE) >= 1 && Number(o.RPE) <= 10)) throw new Error('rpe_no_valido');
  o.REGISTRADO = ahora_();
  return bloqueo_(function () {
    var sh = hojaMia_(HOJAS.REGISTRO), cab = cabeceras_(sh);
    // Mismo día + mismo bloque del plan (ID_PLAN). Sin ID_PLAN, se empareja por el nombre del bloque.
    var existe = listar_(HOJAS.REGISTRO).filter(function (x) {
      return x.FECHA === o.FECHA && (o.ID_PLAN ? x.ID_PLAN === o.ID_PLAN : (!x.ID_PLAN && x.BLOQUE === (o.BLOQUE || '')));
    })[0];
    var fila = existe ? existe._fila : Math.max(1, sh.getLastRow()) + 1;
    sh.getRange(fila, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    o._fila = fila;
    // «No hecho» = pendiente: no cuenta como estímulo hecho y se propone la semana siguiente (una sola vez)
    if (o.HECHO === 'No' && o.ID_PLAN && !listar_(HOJAS.PENDIENTES).some(function (p) { return p.ID_PLAN === o.ID_PLAN && celdaIso_(p['FECHA ORIGINAL']) === celdaIso_(o.FECHA); })) {
      var pl = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === o.ID_PLAN; })[0] || { ID: o.ID_PLAN, FECHA: o.FECHA, 'TÍTULO': o.BLOQUE };
      anadirPendiente_(Object.assign({}, pl, { FECHA: o.FECHA }), 'Marcado como no hecho' + (o.NOTAS ? ': ' + o.NOTAS : ''));
    }
    return o;
  });
}

function borrarRegistro_(r) {
  var x = listar_(HOJAS.REGISTRO).filter(function (y) {
    return y.FECHA === String(r.FECHA || '') && (r.ID_PLAN ? y.ID_PLAN === String(r.ID_PLAN) : y.BLOQUE === String(r.BLOQUE || ''));
  })[0];
  if (!x) throw new Error('no_encontrado');
  borrarFila_(HOJAS.REGISTRO, x._fila, x.ID_PLAN ? { FECHA: x.FECHA, ID_PLAN: x.ID_PLAN } : { FECHA: x.FECHA, BLOQUE: x.BLOQUE });
}

// ===================== VÍDEOS =====================
function leerVideos_() {
  return listar_(HOJAS.VIDEOS).filter(function (r) { return r.EJERCICIO && r['VÍDEO']; }).map(function (r) {
    return { nombre: r.EJERCICIO.trim(), alias: String(r.ALIAS || '').split(';').map(function (a) { return a.trim(); }).filter(Boolean), url: r['VÍDEO'].trim() };
  });
}

/**
 * Copia de seguridad semanal de la biblioteca de vídeos de la app de Gabi → APP · VÍDEOS.
 * LEE el DICCIONARIO de ProgramAPP (no lo modifica) y AÑADE aquí solo los ejercicios que aún no estén.
 * Se ejecuta sola los domingos a las 23:00 (ver configurar()).
 */
function copiarVideosGabi() {
  var dic = programApp_().getSheetByName('DICCIONARIO');
  if (!dic) return 0;
  var origen = dic.getDataRange().getDisplayValues().slice(1).filter(function (r) { return r[0] && r[2]; });
  var ya = {};
  leerVideos_().forEach(function (v) { ya[norm(v.nombre)] = 1; });
  var hoy = hoyTxt_();
  var nuevas = origen.filter(function (r) { return !ya[norm(r[0])]; })
    .map(function (r) { return { EJERCICIO: r[0], ALIAS: r[1], 'VÍDEO': r[2], 'APROBADO POR': r[3], FECHA: r[4], 'COPIADO DE APP GABI': hoy }; });
  nuevas.forEach(function (o) { anadirFila_(HOJAS.VIDEOS, o); });
  PROPS.setProperty('ULTIMA_COPIA_VIDEOS', ahora_() + ' · ' + nuevas.length + ' nuevos');
  return nuevas.length;
}

// ===================== COPIA DE SEGURIDAD EN DRIVE =====================
/**
 * Copia completa de Training Coverage (todas las pestañas, fórmulas incluidas) en APP / Configuración / Backups,
 * con la fecha en el nombre. Se ejecuta sola los domingos a las 23:30 (ver configurar()). También se puede lanzar a mano.
 */
function backupSemanal() {
  var carpeta = DriveApp.getFolderById(CONFIG.BACKUPS_ID);
  var nombre = 'Road to Elite · Training Coverage · backup ' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd HHmm');
  var copia = DriveApp.getFileById(CONFIG.SHEET_ID).makeCopy(nombre, carpeta);
  PROPS.setProperty('ULTIMO_BACKUP', ahora_() + ' · ' + copia.getId());
  Logger.log('OK · Backup: ' + nombre);
  return copia.getId();
}

// ===================== ESTRUCTURA DE LAS PESTAÑAS (la crea y la repara prepararHojas) =====================
/**
 * Cabeceras, anchos, desplegables, fechas y colores de cada pestaña de la app.
 * prepararHojas() es idempotente: crea lo que falte y añade columnas nuevas al final sin tocar los datos.
 */
var ESQUEMA = {
  'APP · PLAN': {
    cab: ['ID', 'FECHA', 'DÍA', 'TURNO', 'ORDEN', 'ORIGEN', 'FABRIK_REF', 'BLOQUE', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CÓDIGOS',
      'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS', 'ESTADO', 'CAMBIO_ID', 'REEMPLAZA', 'ACTUALIZADO'],
    anchos: [70, 95, 80, 60, 55, 85, 95, 110, 170, 280, 95, 55, 90, 260, 340, 260, 140, 80, 90, 120],
    fechas: ['FECHA'], cursiva: 'POR QUÉ (cursiva)', negrita: 'TÍTULO', congelarCol: 3,
    listas: { TURNO: ['AM', 'PM'], ORIGEN: ['FABRIK', 'EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'],
      ESTADO: ['BORRADOR', 'PROGRAMADO', 'PROPUESTA', 'PROPUESTA · NO HACER', 'NO HACER', 'SUSTITUIDO'] },
    colores: [['ESTADO', 'PROPUESTA', '#ffedcc'], ['ESTADO', 'SUSTITUIDO|NO HACER', '#5a5a5a', '#ffffff'], ['ESTADO', 'BORRADOR', '#fff7e0'],
      ['ORIGEN', 'FABRIK', '#eef0f4'], ['ORIGEN', 'EXTRA|CARRERA|Z6|TÉCNICA|MOVILIDAD', '#fff2e6']]
  },
  'APP · EVENTOS': {
    cab: ['ID', 'EVENTO', 'TIPO', 'INICIO', 'FIN', 'HORA', 'LUGAR', 'BLOQUEA', 'ANTES (días bajar volumen)', 'DESPUÉS (días recuperación)', 'CÓMO PROCEDER', 'ESTADO', 'NOTAS', 'CREADO'],
    anchos: [70, 200, 110, 95, 95, 60, 120, 110, 110, 110, 260, 100, 220, 120], fechas: ['INICIO', 'FIN'],
    listas: { TIPO: ['Competición', 'HYROX', 'Carrera', 'Viaje', 'Trabajo', 'Personal', 'Otro'], BLOQUEA: ['Día completo', 'Mañana', 'Tarde', 'Parcial', 'No bloquea'],
      'ANTES (días bajar volumen)': ['0', '1', '2', '3'], 'DESPUÉS (días recuperación)': ['0', '1', '2', '3'], ESTADO: ['Por decidir', 'Decidido', 'Pendiente de aprobar', 'Ignorado'] },
    colores: [['ESTADO', 'Por decidir', '#ffe6d9']]
  },
  'APP · SEMANAS': {
    cab: ['LUNES', 'ESTADO', 'DOBLES (mañanas libres)', 'DESCANSO', 'EVENTOS DE LA SEMANA', 'DECISIONES', 'NOTAS', 'CONFIRMADA', 'HUELLA FABRIK', 'FABRIK LEÍDO'],
    anchos: [95, 160, 200, 140, 280, 320, 240, 130, 200, 120], fechas: ['LUNES'],
    listas: { ESTADO: ['Pendiente de confirmar', 'Confirmada', 'Programada'] },
    colores: [['ESTADO', 'Pendiente', '#ffe6d9'], ['ESTADO', 'Confirmada|Programada', '#e0f5e6']]
  },
  'APP · PENDIENTES': {
    cab: ['ID', 'CREADO', 'FECHA ORIGINAL', 'ID_PLAN', 'BLOQUE', 'TIPO', 'MOTIVO', 'ESTADO', 'SEMANA DESTINO', 'NOTAS'],
    anchos: [70, 120, 95, 90, 220, 90, 280, 110, 110, 220], fechas: ['FECHA ORIGINAL'],
    listas: { TIPO: ['FABRIK', 'EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'], ESTADO: ['Pendiente', 'Propuesto', 'Reprogramado', 'Descartado'] },
    colores: [['ESTADO', '^Pendiente', '#ffedcc']]
  },
  'APP · CAMBIOS': {
    cab: ['ID', 'CREADO', 'DESDE', 'TURNO DESDE', 'EVENTO', 'AFECTA', 'NOTAS', 'ESTADO', 'RESPUESTA'],
    anchos: [70, 120, 95, 80, 220, 160, 240, 130, 300], fechas: ['DESDE'],
    listas: { 'TURNO DESDE': ['AM', 'PM'], ESTADO: ['Solicitada', 'Propuesta lista', 'Aprobada', 'Rechazada'] },
    colores: [['ESTADO', 'Solicitada|Propuesta', '#ffedcc']]
  }
};

// ===================== METAS SEMANALES Y MENSUALES (v0.5) =====================
/**
 * Las metas viven en APP · METAS y se editan desde la app o el Sheet.
 * Su avance se calcula con los bloques de APP · PLAN que llevan alguno de sus CÓDIGOS:
 *   · programado = filas en estado PROGRAMADO (se marca al aprobar el plan de la semana)
 *   · realizado  = esas filas con registro «Sí» en APP · REGISTRO (o «Parcial», que cuenta media)
 *   · más los ajustes manuales de APP · AJUSTES METAS (con fecha, así que también se reinician).
 * Semana: lunes–domingo (se reinicia el domingo por la noche).
 * Mes: del día siguiente al último domingo del mes anterior hasta el último domingo de este mes
 *      (una semana que cruza dos meses cuenta entera para el mes nuevo).
 */
ESQUEMA['APP · METAS'] = {
  cab: ['ID', 'ÁMBITO', 'PRIORIDAD', 'ESTÍMULO', 'META', 'META POR MES', 'MÁXIMO', 'TIPO', 'UNIDAD', 'CÓDIGOS', 'ACTIVA', 'NOTAS', 'ORDEN'],
  anchos: [70, 80, 160, 260, 60, 130, 70, 80, 130, 120, 70, 360, 60],
  listas: { 'ÁMBITO': ['Semana', 'Mes'], TIPO: ['COUNT', 'MIN', 'MIN_GT', 'SALTOS'], ACTIVA: ['Sí', 'No'] },
  colores: [['ACTIVA', '^No$', '#5a5a5a', '#ffffff'], ['ÁMBITO', 'Semana', '#eef4ff'], ['ÁMBITO', 'Mes', '#f3eefe']]
};
ESQUEMA['APP · AJUSTES METAS'] = {
  cab: ['ID', 'FECHA', 'META_ID', 'ESTÍMULO', 'CANTIDAD', 'NOTA', 'CREADO'], anchos: [70, 95, 80, 260, 80, 300, 120], fechas: ['FECHA']
};
ESQUEMA['APP · HISTÓRICO METAS'] = {
  cab: ['PERIODO', 'ÁMBITO', 'DESDE', 'HASTA', 'COBERTURA PROGRAMADA', 'COBERTURA REALIZADA', 'METAS CUBIERTAS', 'TOTAL METAS', 'DETALLE', 'CERRADO'],
  anchos: [120, 80, 95, 95, 110, 110, 90, 80, 520, 120], fechas: ['DESDE', 'HASTA']
};
ESQUEMA['APP · CARRERA'] = {
  cab: ['ID', 'FECHA', 'ID_PLAN', 'SESIÓN', 'TIPO', 'DISTANCIA (km)', 'TIEMPO', 'RITMO MEDIO (/km)', 'FC MEDIA', 'FC MÁX', 'FC ESTABLE (min)', 'PARCIALES POR KM',
    'SERIES (tiempos)', 'PARCIALES CUMPLIDOS', 'CADENCIA', 'DESNIVEL (m)', 'TEMPERATURA (°C)', 'SUPERFICIE', 'RPE', 'SENSACIONES', 'NOTAS', 'REGISTRADO'],
  anchos: [70, 95, 90, 160, 110, 80, 80, 90, 70, 70, 80, 220, 220, 100, 70, 70, 80, 100, 50, 220, 220, 120], fechas: ['FECHA'],
  listas: { TIPO: ['Z2', 'Z2 larga', 'Z4 umbral', 'Z5 VO2max', 'Z6–Z8', 'Test 2 km', 'Test 10 km', 'Recuperación', 'HYROX', 'Otra'], 'PARCIALES CUMPLIDOS': ['Sí', 'Parcial', 'No'],
    SUPERFICIE: ['Asfalto', 'Pista', 'Tierra', 'Cinta', 'Mixta'] }
};
ESQUEMA['APP · PLAN'].cab.push('CANTIDAD');
ESQUEMA['APP · PLAN'].anchos.push(70);
HOJAS.METAS = 'APP · METAS'; HOJAS.AJUSTES = 'APP · AJUSTES METAS'; HOJAS.HISTMETAS = 'APP · HISTÓRICO METAS'; HOJAS.CARRERA = 'APP · CARRERA';

/** Pasa las metas de las pestañas Semana y Mes a APP · METAS (solo si está vacía). */
function migrarMetas_() {
  if (listar_(HOJAS.METAS).length) return 0;
  var ss = miLibro_(), filas = [], orden = 0;
  var metaMes = { R02: '11:3, 12:2, 1:1, *:3', R03: '11:1, 12:2, 1:2, *:1' };
  [['Semana', 'Semana'], ['Mes', 'Mes']].forEach(function (x) {
    var sh = ss.getSheetByName(x[0]); if (!sh) return;
    var g = sh.getRange(1, 1, Math.min(sh.getLastRow(), 120), 21).getDisplayValues();
    var i0 = -1; g.forEach(function (r, i) { if (i0 < 0 && /^PRIORIDAD/i.test(String(r[0]).trim())) i0 = i; });
    if (i0 < 0) return;
    g.slice(i0 + 1).forEach(function (r) {
      if (!String(r[1]).trim() || !String(r[10]).trim()) return;
      var cod = String(r[10]).trim();
      filas.push({ ID: nuevoId_(), 'ÁMBITO': x[1], PRIORIDAD: r[0], 'ESTÍMULO': r[1], META: String(r[8] || '').replace(',', '.'), 'META POR MES': metaMes[cod] || '',
        'MÁXIMO': String(r[13] || '').replace(',', '.'), TIPO: r[9] || 'COUNT', UNIDAD: r[2], 'CÓDIGOS': cod, ACTIVA: /^(TRUE|VERDADERO|S[IÍ])$/i.test(String(r[12]).trim()) ? 'Sí' : 'No',
        NOTAS: r[5], ORDEN: ++orden });
    });
  });
  var sh2 = hojaMia_(HOJAS.METAS), cab = cabeceras_(sh2);
  if (filas.length) sh2.getRange(2, 1, filas.length, cab.length).setValues(filas.map(function (o) { return filaDe_(cab, o); }));
  return filas.length;
}

function ultimoDomingo_(y, m) {          // m: 1–12
  var d = new Date(Date.UTC(y, m, 0, 12));           // último día del mes
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());       // retrocede hasta domingo
  return d.toISOString().slice(0, 10);
}
function periodoSemana_(iso) { var l = lunesDe_(iso); return { desde: l, hasta: sumarDias(l, 6), etiqueta: 'Semana ' + isoAFecha(l) }; }
function periodoMes_(iso) {
  iso = isoOk_(iso) || hoyIso_();
  var y = +iso.slice(0, 4), m = +iso.slice(5, 7), fin = ultimoDomingo_(y, m);
  if (iso > fin) { m++; if (m > 12) { m = 1; y++; } fin = ultimoDomingo_(y, m); }
  var py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return { desde: sumarDias(ultimoDomingo_(py, pm), 1), hasta: fin, mes: m, etiqueta: MES[m - 1] + ' ' + y };
}
function metaDe_(meta, mes) {
  var t = String(meta['META POR MES'] || '').trim();
  if (t) {
    var map = {}; t.split(/[,;]+/).forEach(function (p) { var kv = p.split(':'); if (kv.length === 2) map[kv[0].trim()] = parseFloat(kv[1]); });
    if (map[String(mes)] != null) return map[String(mes)];
    if (map['*'] != null) return map['*'];
  }
  return parseFloat(String(meta.META).replace(',', '.')) || 0;
}
function codigosDe_(txt) { return String(txt || '').toUpperCase().split(/[|,;\s]+/).filter(Boolean); }

/** Avance de cada meta en un periodo. */
function avanceMetas_(ambito, per, cache) {
  var plan = cache.plan, reg = cache.reg, ajustes = cache.ajustes;
  var enPer = function (iso) { return iso && iso >= per.desde && iso <= per.hasta; };
  var hecho = {}, minReal = {};
  reg.forEach(function (r) {
    var k = celdaIso_(r.FECHA) + '|' + r.ID_PLAN;
    hecho[k] = r.HECHO === 'Sí' ? 1 : r.HECHO === 'Parcial' ? 0.5 : 0;
    var mr = parseFloat(String(r.MIN_REAL || '').replace(',', '.'));
    if (hecho[k] && mr > 0) minReal[k] = mr;                     // minutos reales apuntados: mandan sobre el «0,5»
  });
  var claveR = function (r) { return celdaIso_(r.FECHA) + '|' + r.ID; };
  var metas = cache.metas.filter(function (m) { return m['ÁMBITO'] === ambito && m.ACTIVA !== 'No'; });
  return metas.map(function (m) {
    var cods = codigosDe_(m['CÓDIGOS']), meta = metaDe_(m, per.mes), tipo = String(m.TIPO || 'COUNT').toUpperCase();
    var filas = plan.filter(function (r) {
      var iso = celdaIso_(r.FECHA); if (!enPer(iso)) return false;
      var rc = codigosDe_(r['CÓDIGOS']); return rc.some(function (c) { return cods.indexOf(c) >= 0; });
    });
    var calc = function (lista, peso, real) {
      var mins = function (r) { var mr = real && minReal[claveR(r)]; return mr != null ? mr : (parseFloat(String(r.MIN).replace(',', '.')) || 0) * peso(r); };
      if (tipo === 'MIN') return lista.reduce(function (a, r) { return a + (peso(r) ? mins(r) : 0); }, 0);
      if (tipo === 'MIN_GT') return lista.reduce(function (a, r) { return Math.max(a, peso(r) ? (real && minReal[claveR(r)] != null ? minReal[claveR(r)] : (parseFloat(String(r.MIN).replace(',', '.')) || 0)) : 0); }, 0);
      if (tipo === 'SALTOS') return lista.reduce(function (a, r) { return a + saltosDe_(r) * peso(r); }, 0);
      var vistos = {}, n = 0;                           // COUNT: una exposición por fecha + turno
      lista.forEach(function (r) { var k = celdaIso_(r.FECHA) + '|' + r.TURNO, p = peso(r); if (p && !(vistos[k] >= p)) { n += p - (vistos[k] || 0); vistos[k] = p; } });
      return n;
    };
    // Lo que está en el plan cuenta como programado aunque falte aprobarlo (BORRADOR); «borrador» se sigue mostrando aparte
    var prog = filas.filter(function (r) { return r.ESTADO === 'PROGRAMADO' || r.ESTADO === 'BORRADOR'; });
    var borr = filas.filter(function (r) { return r.ESTADO === 'BORRADOR'; });
    var ajuste = ajustes.filter(function (a) { return a.META_ID === m.ID && enPer(celdaIso_(a.FECHA)); })
      .reduce(function (a, x) { return a + (parseFloat(String(x.CANTIDAD).replace(',', '.')) || 1); }, 0);
    var vProg = calc(prog, function () { return 1; }) + ajuste;
    var vReal = calc(prog, function (r) { return hecho[claveR(r)] || 0; }, true) + ajuste;
    var vBorr = calc(borr, function () { return 1; });
    var ratio = function (v) { return meta > 0 ? Math.min(1, v / meta) : 1; };
    return { id: m.ID, prioridad: m.PRIORIDAD, estimulo: m['ESTÍMULO'], meta: meta, maximo: m['MÁXIMO'], tipo: tipo, unidad: m.UNIDAD, codigos: m['CÓDIGOS'],
      notas: m.NOTAS, integrar: m['INTEGRAR CON'] || '', mejorar: m['CÓMO MEJORARLO'] || '',
      dias: prog.map(function (r) { return { iso: celdaIso_(r.FECHA), turno: r.TURNO === 'AM' ? 'AM' : 'PM', titulo: r['TÍTULO'] || r.BLOQUE || '', origen: norm(r.ORIGEN) === 'FABRIK' ? 'FABRIK' : r.ORIGEN, estado: r.ESTADO }; }).sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.turno < b.turno ? -1 : 1; }),
      orden: Number(m.ORDEN) || 0, programado: vProg, realizado: vReal, borrador: vBorr, ajuste: ajuste,
      pProg: ratio(vProg), pReal: ratio(vReal), cubierta: meta <= 0 || vProg >= meta, _fila: m._fila };
  }).sort(function (a, b) { return a.orden - b.orden; });
}
function cacheMetas_() {
  return { metas: listar_(HOJAS.METAS), plan: listar_(HOJAS.PLAN), reg: listar_(HOJAS.REGISTRO), ajustes: listar_(HOJAS.AJUSTES) };
}
function resumenPer_(lista, per, ambito) {
  var n = lista.length, cub = lista.filter(function (x) { return x.cubierta; }).length;
  var media = function (k) { return n ? lista.reduce(function (a, x) { return a + x[k]; }, 0) / n : 0; };
  return { ambito: ambito, desde: per.desde, hasta: per.hasta, etiqueta: per.etiqueta, total: n, cubiertas: cub,
    pctProg: ambito === 'Semana' ? (n ? cub / n : 0) : media('pProg'), pctReal: media('pReal'), metas: lista };
}
/** Semana y mes que contienen la fecha indicada. */
function metasDe_(iso) { return conMemo_(function () { return metasDeSin_(iso); }); }
function metasDeSin_(iso) {
  iso = isoOk_(iso) || hoyIso_();
  var c = cacheMetas_(), ps = periodoSemana_(iso), pm = periodoMes_(iso);
  return { semana: resumenPer_(avanceMetas_('Semana', ps, c), ps, 'Semana'), mes: resumenPer_(avanceMetas_('Mes', pm, c), pm, 'Mes') };
}

var CAMPOS_META = ['ÁMBITO', 'PRIORIDAD', 'ESTÍMULO', 'META', 'META POR MES', 'MÁXIMO', 'TIPO', 'UNIDAD', 'CÓDIGOS', 'ACTIVA', 'NOTAS', 'ORDEN'];
function guardarMeta_(m) {
  var o = permitidas_(m, CAMPOS_META);
  if (!o['ESTÍMULO'] || !o['ÁMBITO']) throw new Error('meta_incompleta');
  if (['Semana', 'Mes'].indexOf(o['ÁMBITO']) < 0) throw new Error('ambito_no_valido');
  return bloqueo_(function () {
    var x = m.ID ? listar_(HOJAS.METAS).filter(function (r) { return r.ID === String(m.ID); })[0] : null;
    if (x) { actualizarFila_(HOJAS.METAS, x._fila, o); return x.ID; }
    o.ID = nuevoId_(); if (!o.ACTIVA) o.ACTIVA = 'Sí'; if (!o.TIPO) o.TIPO = 'COUNT';
    if (!o.ORDEN) o.ORDEN = listar_(HOJAS.METAS).length + 1;
    var sh = hojaMia_(HOJAS.METAS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
}
function borrarMeta_(id) {
  var x = listar_(HOJAS.METAS).filter(function (r) { return r.ID === String(id); })[0];
  if (!x) throw new Error('no_encontrado');
  borrarFila_(HOJAS.METAS, x._fila, { ID: x.ID });
}
function ajusteMeta_(b) {
  var m = listar_(HOJAS.METAS).filter(function (r) { return r.ID === String(b.metaId); })[0];
  if (!m) throw new Error('no_encontrado');
  anadirFila_(HOJAS.AJUSTES, { ID: nuevoId_(), FECHA: isoAFecha(celdaIso_(b.fecha) || hoyIso_()), META_ID: m.ID, 'ESTÍMULO': m['ESTÍMULO'],
    CANTIDAD: String(b.cantidad || 1), NOTA: String(b.nota || '').slice(0, 300), CREADO: ahora_() });
}

/** Domingo por la noche: guarda la semana (y el mes si es su último domingo) en APP · HISTÓRICO METAS. */
function cierreSemanal() {
  var hoy = hoyIso_();
  if (new Date(hoy + 'T12:00:00Z').getUTCDay() === 1) hoy = sumarDias(hoy, -1);   // si el trigger se va pasada la medianoche, cierra el domingo
  var r = metasDe_(hoy), out = [];
  var fila = function (x) {
    return { PERIODO: x.ambito === 'Semana' ? 'Semana ' + isoAFecha(x.desde) : x.etiqueta, 'ÁMBITO': x.ambito, DESDE: isoAFecha(x.desde), HASTA: isoAFecha(x.hasta),
      'COBERTURA PROGRAMADA': Math.round(x.pctProg * 1000) / 10 + '%', 'COBERTURA REALIZADA': Math.round(x.pctReal * 1000) / 10 + '%', 'METAS CUBIERTAS': x.cubiertas, 'TOTAL METAS': x.total,
      DETALLE: x.metas.map(function (m) { return m.estimulo + ': ' + m.realizado + '/' + m.programado + ' de ' + m.meta; }).join(' | '), CERRADO: ahora_() };
  };
  if (r.semana.hasta === hoy) { out.push(fila(r.semana)); try { escribirBalance_(r.semana.desde, 'Cierre'); } catch (e) { Logger.log('Balance: ' + e); } }
  if (r.mes.hasta === hoy) out.push(fila(r.mes));
  var hist = listar_(HOJAS.HISTMETAS);
  out.forEach(function (o) {                                   // si ya se cerró ese periodo, se actualiza en vez de duplicarlo
    var x = hist.filter(function (h) { return h.PERIODO === o.PERIODO && h['ÁMBITO'] === o['ÁMBITO']; })[0];
    if (x) actualizarFila_(HOJAS.HISTMETAS, x._fila, o); else anadirFila_(HOJAS.HISTMETAS, o);
  });
  try { analizarCarrera_(); } catch (e) { /* el análisis no debe frenar el cierre */ }
  Logger.log('OK · Cierre: ' + out.length + ' periodo(s) guardado(s)');
  return out.length;
}

// ===================== CARRERA: registro detallado y análisis =====================
var CAMPOS_CARRERA = ['FECHA', 'ID_PLAN', 'SESIÓN', 'TIPO', 'DISTANCIA (km)', 'TIEMPO', 'RITMO MEDIO (/km)', 'FC MEDIA', 'FC MÁX', 'FC ESTABLE (min)', 'PARCIALES POR KM',
  'SERIES (tiempos)', 'PARCIALES CUMPLIDOS', 'CADENCIA', 'DESNIVEL (m)', 'TEMPERATURA (°C)', 'SUPERFICIE', 'RPE', 'SENSACIONES', 'NOTAS'];
function segundos_(t) {
  var p = String(t || '').trim().replace(/^'/, '').split(':').map(function (x) { return parseFloat(x.replace(',', '.')); });
  if (!p.length || p.some(isNaN)) return 0;
  // «46:10:00» = un «46:10» que el Sheet convirtió en horas (versiones anteriores): son minutos y segundos.
  if (p.length === 3 && p[2] === 0 && p[0] >= 10) return p[0] * 60 + p[1];
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
}
function mmss_(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
function guardarCarrera_(c) {
  var o = permitidas_(c, CAMPOS_CARRERA);
  if (!o.FECHA) throw new Error('falta_fecha');
  var km = parseFloat(String(o['DISTANCIA (km)'] || '').replace(',', '.')), seg = segundos_(o.TIEMPO);
  if (!o['RITMO MEDIO (/km)'] && km > 0 && seg > 0) o['RITMO MEDIO (/km)'] = mmss_(seg / km);
  o.REGISTRADO = ahora_();
  var idCliente = /^[\w-]{6,40}$/.test(String(c.ID || '')) ? String(c.ID) : '';   // creado en el móvil: reenvíos sin duplicar
  var id = bloqueo_(function () {
    var todas = listar_(HOJAS.CARRERA);
    var x = (idCliente && todas.filter(function (r) { return r.ID === idCliente; })[0]) ||
      todas.filter(function (r) { return r.FECHA === o.FECHA && o.ID_PLAN && r.ID_PLAN === o.ID_PLAN; })[0];
    if (x) { actualizarFila_(HOJAS.CARRERA, x._fila, o); return x.ID; }
    o.ID = idCliente || nuevoId_();
    var sh = hojaMia_(HOJAS.CARRERA), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
  try { analizarCarrera_(); } catch (e) { /* no frena el guardado */ }
  return id;
}

/** Calcula el análisis de carrera y lo pinta en APP · RESUMEN (también lo devuelve a la app). */
function analizarCarrera_() { var res = calcAnalisisCarrera_(); MEMO = null; try { pintarResumen_(res); } catch (e) { Logger.log('Resumen: ' + e); } return res; }
function calcAnalisisCarrera_() {
  var filas = listar_(HOJAS.CARRERA).map(function (r) {
    var km = parseFloat(String(r['DISTANCIA (km)']).replace(',', '.')) || 0, seg = segundos_(r.TIEMPO), fc = parseFloat(r['FC MEDIA']) || 0;
    var ritmo = segundos_(r['RITMO MEDIO (/km)']) || (km ? seg / km : 0), vel = ritmo ? 1000 / ritmo * 60 : 0;   // m/min
    return { fecha: celdaIso_(r.FECHA), lunes: lunesDe_(celdaIso_(r.FECHA)), tipo: r.TIPO || 'Otra', sesion: r['SESIÓN'], km: km, seg: seg, ritmo: ritmo, fc: fc,
      fcmax: parseFloat(r['FC MÁX']) || 0, estable: parseFloat(String(r['FC ESTABLE (min)']).replace(',', '.')) || 0, efic: fc && vel ? vel / fc : 0,
      cumple: r['PARCIALES CUMPLIDOS'], rpe: parseFloat(r.RPE) || 0, series: r['SERIES (tiempos)'], notas: r.SENSACIONES || r.NOTAS, idPlan: r.ID_PLAN };
  }).filter(function (x) { return x.fecha; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var esZ2 = function (x) { return /^Z2/i.test(x.tipo); };
  // semanas
  var sem = {};
  filas.forEach(function (x) {
    var s = sem[x.lunes] = sem[x.lunes] || { lunes: x.lunes, km: 0, min: 0, minZ2: 0, sesiones: 0, calidad: 0, z68: 0, ritZ2: [], fcZ2: [], efZ2: [] };
    s.km += x.km; s.min += x.seg / 60; s.sesiones++;
    if (esZ2(x)) { s.minZ2 += x.seg / 60; if (x.ritmo) s.ritZ2.push(x.ritmo); if (x.fc) s.fcZ2.push(x.fc); if (x.efic) s.efZ2.push(x.efic); }
    if (/Z4|Z5|Test/i.test(x.tipo)) s.calidad++;
    if (/Z6/i.test(x.tipo)) s.z68++;
  });
  var med = function (a) { return a.length ? a.reduce(function (p, c) { return p + c; }, 0) / a.length : 0; };
  var semanas = Object.keys(sem).sort().map(function (k) {
    var s = sem[k]; return { lunes: k, km: Math.round(s.km * 10) / 10, min: Math.round(s.min), minZ2: Math.round(s.minZ2), sesiones: s.sesiones, calidad: s.calidad, z68: s.z68,
      ritmoZ2: med(s.ritZ2) ? mmss_(med(s.ritZ2)) : '', fcZ2: Math.round(med(s.fcZ2)) || '', eficZ2: Math.round(med(s.efZ2) * 1000) / 1000 || '' };
  });
  // tendencias
  var z2 = filas.filter(function (x) { return esZ2(x) && x.efic; });
  var ult = z2.slice(-3), prev = z2.slice(-6, -3);
  var tendencia = ult.length && prev.length ? (med(ult.map(function (x) { return x.efic; })) / med(prev.map(function (x) { return x.efic; })) - 1) : null;
  var cal = filas.filter(function (x) { return /Z4|Z5|Test/i.test(x.tipo); }).slice(-4);
  var cumplidas = cal.filter(function (x) { return x.cumple === 'Sí'; }).length;
  var conclusiones = [];
  if (tendencia != null) conclusiones.push('Eficiencia en Z2 (metros por minuto por latido): ' + (tendencia >= 0 ? '+' : '') + Math.round(tendencia * 1000) / 10 + '% en las 3 últimas Z2 frente a las 3 anteriores' + (tendencia > 0.01 ? ' → la base mejora.' : tendencia < -0.02 ? ' → revisar fatiga, calor o ritmo demasiado alto.' : ' → estable.'));
  else conclusiones.push('Faltan Z2 con FC media para medir la eficiencia (se necesitan 6).');
  if (cal.length) conclusiones.push('Calidad: parciales cumplidos en ' + cumplidas + ' de las últimas ' + cal.length + ' sesiones' + (cumplidas === cal.length ? ' → se puede progresar una variable.' : ' → mantener la dosis.'));
  var u = semanas[semanas.length - 1];
  if (u) conclusiones.push('Última semana registrada (' + isoAFecha(u.lunes) + '): ' + u.km + ' km · Z2 ' + u.minZ2 + '′ · calidad ' + u.calidad + ' · Z6–Z8 ' + u.z68 + (u.minZ2 < 90 ? ' → por debajo de los 90′ de Z2.' : '.'));
  var estables = z2.filter(function (x) { return x.estable; }).slice(-5);
  if (estables.length) conclusiones.push('FC estable en Z2 a los ' + Math.round(med(estables.map(function (x) { return x.estable; }))) + ' min de media (últimas ' + estables.length + ').');
  var res = { semanas: semanas.slice(-12), z2: z2.slice(-8).map(function (x) { return { fecha: x.fecha, km: x.km, ritmo: mmss_(x.ritmo), fc: x.fc, efic: Math.round(x.efic * 1000) / 1000, estable: x.estable }; }),
    calidad: cal.map(function (x) { return { fecha: x.fecha, sesion: x.sesion, tipo: x.tipo, series: x.series, cumple: x.cumple, rpe: x.rpe }; }), conclusiones: conclusiones, actualizado: ahora_() };
  // v0.11 · cada carrera con tus sensaciones de ese día y lo que hiciste las 48 h anteriores
  var chq = {}; listar_(HOJAS.CHEQUEO).forEach(function (r) { chq[celdaIso_(r.FECHA)] = r; });
  res.contexto = filas.slice(-10).reverse().map(function (x) {
    var c = chq[x.fecha] || {}, antes = [];
    [1, 2].forEach(function (k) { filasActivasDia_(sumarDias(x.fecha, -k)).forEach(function (r) { var cg = cargasFila_(r).filter(function (t) { return t !== 'CORE'; }); if (cg.length) antes.push((k === 1 ? 'ayer ' : '-2d ') + String(r['TÍTULO'] || r.BLOQUE).slice(0, 28) + ' (' + cg.join(',').toLowerCase() + ')'); }); });
    return { fecha: x.fecha, sesion: x.sesion, tipo: x.tipo, km: x.km, ritmo: x.ritmo ? mmss_(x.ritmo) : '', fc: x.fc, efic: x.efic ? Math.round(x.efic * 1000) / 1000 : '',
      cansancio: c['CANSANCIO (1-10)'] || '', agujetas: c['AGUJETAS (1-10)'] || '', zonas: c['ZONAS CARGADAS'] || '', antes: antes.slice(0, 4).join(' · ') };
  });
  var cargadas = res.contexto.filter(function (x) { return x.efic && (+x.cansancio >= 7 || +x.agujetas >= 7); }), frescas = res.contexto.filter(function (x) { return x.efic && x.cansancio && +x.cansancio <= 4 && +x.agujetas <= 4; });
  if (cargadas.length && frescas.length) { var d = med(cargadas.map(function (x) { return x.efic; })) / med(frescas.map(function (x) { return x.efic; })) - 1;
    conclusiones.push('Llegando cargado (cansancio o agujetas ≥7) tu eficiencia es ' + Math.round(d * 1000) / 10 + '% frente a cuando llegas fresco (≤4).'); }
  return res;
}
// ===================== v0.6: CHEQUEO MATINAL, PLANTILLAS, BLOQUES DESDE LA APP Y AVISOS AL MÓVIL =====================
ESQUEMA['APP · CHEQUEO'] = {
  cab: ['FECHA', 'SUEÑO (h)', 'CALIDAD SUEÑO (1-5)', 'VFC (ms)', 'FC REPOSO', 'ENERGÍA (1-5)', 'MOLESTIAS (0-5)', 'ZONA MOLESTIA', 'ESTRÉS (1-5)', 'NOTAS', 'LISTO (0-100)', 'SEMÁFORO', 'RECOMENDACIÓN', 'REGISTRADO'],
  anchos: [95, 70, 90, 70, 70, 80, 90, 140, 80, 240, 80, 80, 420, 120], fechas: ['FECHA'],
  listas: { 'SEMÁFORO': ['Verde', 'Ámbar', 'Rojo'] },
  colores: [['SEMÁFORO', 'Verde', '#e0f5e6'], ['SEMÁFORO', 'Ámbar', '#fff2cc'], ['SEMÁFORO', 'Rojo', '#fbe0e0']]
};
ESQUEMA['APP · PLANTILLAS'] = {
  cab: ['ID', 'NOMBRE', 'ORIGEN', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CANTIDAD', 'CÓDIGOS', 'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS', 'CREADA'],
  anchos: [70, 180, 90, 170, 300, 95, 55, 70, 90, 260, 320, 240, 120], cursiva: 'POR QUÉ (cursiva)', negrita: 'NOMBRE',
  listas: { ORIGEN: ['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'] }
};
HOJAS.CHEQUEO = 'APP · CHEQUEO'; HOJAS.PLANTILLAS = 'APP · PLANTILLAS';

var CAMPOS_CHEQUEO = ['FECHA', 'SUEÑO (h)', 'CALIDAD SUEÑO (1-5)', 'VFC (ms)', 'FC REPOSO', 'ENERGÍA (1-5)', 'MOLESTIAS (0-5)', 'ZONA MOLESTIA', 'ESTRÉS (1-5)', 'NOTAS'];
function guardarChequeo_(c) {
  var o = permitidas_(c, CAMPOS_CHEQUEO);
  var iso = celdaIso_(o.FECHA) || hoyIso_(); o.FECHA = isoAFecha(iso);
  return bloqueo_(function () {
    var todos = listar_(HOJAS.CHEQUEO);
    var previos = todos.filter(function (r) { var d = celdaIso_(r.FECHA); return d && d < iso; }).sort(function (a, b) { return celdaIso_(a.FECHA) < celdaIso_(b.FECHA) ? 1 : -1; }).slice(0, 7);
    var p = puntuarChequeo_(o, previos, iso);
    o['LISTO (0-100)'] = p.listo == null ? '' : p.listo; o['SEMÁFORO'] = p.semaforo; o['RECOMENDACIÓN'] = p.recomendacion + (p.detalle ? ' (' + p.detalle + ')' : ''); o.REGISTRADO = ahora_();
    var x = todos.filter(function (r) { return celdaIso_(r.FECHA) === iso; })[0];
    if (x) actualizarFila_(HOJAS.CHEQUEO, x._fila, o);
    else { var sh = hojaMia_(HOJAS.CHEQUEO), cab = cabeceras_(sh); sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]); }
    return o;
  });
}

// ---------- plantillas y bloques creados desde la app (entran en BORRADOR: tú los apruebas) ----------
var CAMPOS_BLOQUE = ['ORIGEN', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CANTIDAD', 'CÓDIGOS', 'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS'];
function crearBloque_(b) {
  var o = permitidas_(b, CAMPOS_BLOQUE.concat(['TURNO', 'ORDEN']));
  var iso = celdaIso_(b.fecha);
  if (!iso || !o['TÍTULO']) throw new Error('faltan_datos');
  if (['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'].indexOf(o.ORIGEN) < 0) o.ORIGEN = 'EXTRA';   // nunca FABRIK desde aquí
  o.ID = nuevoId_(); o.FECHA = isoAFecha(iso); o['DÍA'] = diaDe_(iso); o.TURNO = o.TURNO === 'AM' ? 'AM' : 'PM';
  o.ORDEN = o.ORDEN || (o.TURNO === 'AM' ? 5 : 80); o.BLOQUE = o['TÍTULO']; o.ESTADO = 'BORRADOR'; o.ACTUALIZADO = ahora_();
  anadirFila_(HOJAS.PLAN, o);
  return o.ID;
}
/** Borra un bloque que tú creaste y que aún está en BORRADOR (lo programado no se borra desde la app). */
function borrarBloque_(id) {
  var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(id); })[0];
  if (!x) throw new Error('no_encontrado');
  if (x.ESTADO !== 'BORRADOR' || x.ORIGEN === 'FABRIK') throw new Error('solo_borrador');
  borrarFila_(HOJAS.PLAN, x._fila, { ID: x.ID });
}
function guardarPlantilla_(p) {
  var o = permitidas_(p, ['NOMBRE'].concat(CAMPOS_BLOQUE));
  if (!o.NOMBRE || !o['TÍTULO']) throw new Error('faltan_datos');
  if (['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'].indexOf(o.ORIGEN) < 0) o.ORIGEN = 'EXTRA';
  o.ID = nuevoId_(); o.CREADA = ahora_();
  anadirFila_(HOJAS.PLANTILLAS, o);
  return o.ID;
}

// ---------- avisos al móvil (Firebase Cloud Messaging) ----------
/**
 * Se activa solo si en Propiedades del script existe FCM_CUENTA (el JSON de una cuenta de servicio de Firebase).
 * Esa clave NUNCA va al repositorio: vive solo en las propiedades de tu Apps Script.
 */
function pushActivo_() { return !!PROPS.getProperty('FCM_CUENTA'); }
function tokensPush_() { try { return JSON.parse(PROPS.getProperty('PUSH_TOKENS') || '[]'); } catch (e) { return []; } }
function guardarTokenPush_(t) {
  t = String(t || '').trim();
  if (!/^[\w\-:]{20,400}$/.test(t)) throw new Error('token_no_valido');
  var l = tokensPush_().filter(function (x) { return x !== t; }); l.unshift(t);
  PROPS.setProperty('PUSH_TOKENS', JSON.stringify(l.slice(0, 5)));          // como mucho 5 dispositivos
}
function tokenFcm_() {
  var cache = CacheService.getScriptCache(), t = cache.get('fcm_oauth');
  if (t) return t;
  var sa = JSON.parse(PROPS.getProperty('FCM_CUENTA'));
  var b64 = function (o) { return Utilities.base64EncodeWebSafe(typeof o === 'string' ? o : JSON.stringify(o)).replace(/=+$/, ''); };
  var ahora = Math.floor(Date.now() / 1000);
  var cuerpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 });
  var firma = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(cuerpo, sa.private_key)).replace(/=+$/, '');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cuerpo + '.' + firma }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('fcm_auth ' + res.getResponseCode());
  t = JSON.parse(res.getContentText()).access_token;
  cache.put('fcm_oauth', t, 3000);
  return t;
}
/** Manda un aviso a tus dispositivos. Devuelve cuántos lo recibieron. */
function enviarPush_(titulo, texto, enlace) {
  if (!pushActivo_()) return 0;
  var sa = JSON.parse(PROPS.getProperty('FCM_CUENTA')), tok = tokenFcm_(), ok = 0, vivos = [];
  tokensPush_().forEach(function (t) {
    var r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true,
      payload: JSON.stringify({ message: { token: t, data: { titulo: String(titulo).slice(0, 80), texto: String(texto).slice(0, 200), enlace: enlace || CONFIG.URL_APP },
        webpush: { headers: { Urgency: 'high', TTL: '43200' } } } }) });
    var c = r.getResponseCode();
    if (c === 200) { ok++; vivos.push(t); } else if (c !== 404 && c !== 400) vivos.push(t);   // 404/400 = token caducado: se olvida
  });
  PROPS.setProperty('PUSH_TOKENS', JSON.stringify(vivos));
  return ok;
}
/** Cada hora: avisa (una sola vez por cosa) de lo que necesita tu decisión. */
function revisarAvisos() {
  if (!pushActivo_()) return;
  var hecho = {}; try { hecho = JSON.parse(PROPS.getProperty('AVISOS_HECHOS') || '{}'); } catch (e) {}
  var avisar = function (clave, titulo, texto) { if (hecho[clave]) return; if (enviarPush_(titulo, texto)) hecho[clave] = hoyIso_(); };
  var hoy = hoyIso_(), hora = +Utilities.formatDate(new Date(), CONFIG.ZONA, 'H'), lunesSig = sumarDias(lunesDe_(hoy), 7);
  conMemo_(function () {
    var plan = listar_(HOJAS.PLAN);
    [lunesDe_(hoy), lunesSig].forEach(function (l) {
      var n = plan.filter(function (r) { var d = celdaIso_(r.FECHA); return r.ESTADO === 'BORRADOR' && d >= l && d <= sumarDias(l, 6); }).length;
      if (n) avisar('borrador_' + l + '_' + n, 'Plan listo para aprobar', n + ' bloques en borrador para la semana del ' + isoAFecha(l) + '.');
    });
    cambiosAbiertos_().filter(function (c) { return c.ESTADO === 'Propuesta lista'; }).forEach(function (c) {
      avisar('cambio_' + c.ID, 'Propuesta de cambios lista', c.EVENTO + ': revísala y apruébala o recházala.');
    });
    var s = filaSemana_(lunesSig);
    if (new Date(hoy + 'T12:00:00Z').getUTCDay() === 0 && hora >= 20 && !(s && /Confirmada|Programada/.test(s.ESTADO)))
      avisar('confirmar_' + lunesSig, 'Confirma la semana', 'Mañanas para dobles, descanso y eventos de la semana del ' + isoAFecha(lunesSig) + '.');
    [lunesDe_(hoy), lunesSig].forEach(function (l) {
      var cf = cambiosFabrik_(filaSemana_(l), fabrikSemana_(l).fabrik).filter(function (c) { return sumarDias(l, DIAS.indexOf(norm(c.dia))) >= hoy; });
      if (cf.length) avisar('fabrik_' + l + '_' + cf.map(function (c) { return c.dia; }).join('-'), 'Fabrik ha cambiado',
        'Cambios en ' + cf.map(function (c) { return c.dia.toLowerCase(); }).join(', ') + ' desde que aprobaste la semana. Revisa interferencias con tus extras.');
    });
    var chequeoHoy = listar_(HOJAS.CHEQUEO).some(function (r) { return celdaIso_(r.FECHA) === hoy; });
    if (hora >= 16 && hora < 20 && !chequeoHoy && filasActivasDia_(hoy).length) avisar('chequeo_' + hoy, '¿Cómo llegas hoy?', '15 segundos: cansancio, agujetas y zonas cargadas antes de entrenar.');
  });
  Object.keys(hecho).forEach(function (k) { if (hecho[k] < sumarDias(hoy, -21)) delete hecho[k]; });
  PROPS.setProperty('AVISOS_HECHOS', JSON.stringify(hecho));
}

// ===================== v0.10 · MOVER E INTERCAMBIAR BLOQUES · PESTAÑA «APP · SEMANA EN BLOQUES» =====================
HOJAS.SEMBLOQUES = 'APP · SEMANA EN BLOQUES';
var DIAS_CORTO_ = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
var HUECOS_ = (function () { var l = []; DIAS_CORTO_.forEach(function (d) { l.push(d + ' AM'); l.push(d + ' PM'); }); return l; })();
var CAMPOS_POSICION_ = ['FECHA', 'TURNO', 'ORDEN'];
/** Solo cambia la posición (día, turno u orden)? Entonces lo aprobado sigue aprobado: mover es decisión tuya. */
function soloPosicion_(o) { return Object.keys(o).every(function (k) { return CAMPOS_POSICION_.indexOf(k) >= 0 || k === 'DÍA'; }); }

/** Intercambia día, turno y orden de dos bloques de la misma semana (p. ej. la Z2 larga del miércoles con la corta del martes). */
function intercambiarBloques_(idA, idB) {
  return bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN);
    var a = plan.filter(function (r) { return r.ID === String(idA || ''); })[0], b = plan.filter(function (r) { return r.ID === String(idB || ''); })[0];
    if (!a || !b || a.ID === b.ID) throw new Error('no_encontrado');
    if (lunesDe_(celdaIso_(a.FECHA)) !== lunesDe_(celdaIso_(b.FECHA))) throw new Error('otra_semana');
    var pos = function (r) { var iso = celdaIso_(r.FECHA); return { FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: r.TURNO === 'AM' ? 'AM' : 'PM', ORDEN: r.ORDEN }; };
    var pa = pos(a), pb = pos(b), sello = function (r) { return norm(r.ORIGEN) === 'FABRIK' ? {} : { GENERADO: 'manual ' + ahora_() + ' (candado · intercambio)' }; };
    actualizarFila_(HOJAS.PLAN, a._fila, Object.assign({}, pb, sello(a), { ACTUALIZADO: ahora_() }));
    actualizarFila_(HOJAS.PLAN, b._fila, Object.assign({}, pa, sello(b), { ACTUALIZADO: ahora_() }));
    return lunesDe_(celdaIso_(a.FECHA));
  });
}
/** Mueve un bloque a «Mié PM» (desde la pestaña). Va al final de esa sesión. */
function moverBloqueA_(id, hueco, lunes) {
  var k = HUECOS_.indexOf(String(hueco || '').trim()); if (k < 0) throw new Error('hueco_no_valido');
  var iso = sumarDias(lunes, Math.floor(k / 2)), turno = k % 2 ? 'PM' : 'AM';
  var otros = listar_(HOJAS.PLAN).filter(function (r) { return celdaIso_(r.FECHA) === iso && r.TURNO === turno && r.ID !== id; });
  var orden = otros.reduce(function (m, r) { return Math.max(m, parseFloat(String(r.ORDEN).replace(',', '.')) || 0); }, turno === 'AM' ? 9 : 49) + 1;
  editarBloque_({ id: id, campos: { FECHA: isoAFecha(iso), TURNO: turno, ORDEN: String(orden) } });
}

/** Pinta la semana día a día (AM / PM) con todos los bloques: Fabrik + extras + carrera. */
function pintarHojaSemana_(lunes) {
  lunes = lunesDe_(lunes);
  var ss = miLibro_(), sh = ss.getSheetByName(HOJAS.SEMBLOQUES) || ss.insertSheet(HOJAS.SEMBLOQUES);
  var fin = sumarDias(lunes, 6);
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && !/^(SUSTITUIDO|OCULTO|PROPUESTA)$/.test(r.ESTADO); });
  var etq = function (r) { var d = celdaIso_(r.FECHA), k = (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7; return DIAS_CORTO_[k] + ' ' + (r.TURNO === 'AM' ? 'AM' : 'PM') + ' · ' + String(r['TÍTULO'] || r.BLOQUE || '').slice(0, 40) + ' · #' + r.ID; };
  var opcionesSwap = plan.map(etq), clave = {};
  try { clave = claveSemana_(lunes, plan); } catch (e) {}
  var filas = [], estilos = [], claves = [];   // estilos: [fila, tipo]
  filas.push(['SEMANA EN BLOQUES · Fabrik + extras + carrera', '', '', '', '', '', '', '', '', '', '', '']);
  filas.push(['Lunes de la semana →', isoAFecha(lunes), '↻ Actualizar', false, 'Cambia la fecha o marca la casilla para recargar. Edita BLOQUE, EJERCICIOS o MIN y se guarda en el plan (lo que ves en la app). Para mover un bloque elige «MOVER A»; para cambiar dos entre sí, «INTERCAMBIAR CON». 🎯 = clave para tus carencias.', '', '', '', '', '', '', '']);
  filas.push(['', '', '', '', '', '', '', '', '', '', '', '']);
  filas.push(['DÍA · TURNO', 'Nº', 'BLOQUE', 'EJERCICIOS (editable)', 'TIPO', 'MIN', 'CÓDIGOS', 'ESTADO', 'MOVER A', 'INTERCAMBIAR CON', 'POR QUÉ', 'ID']);
  estilos.push([4, 'cab']);
  for (var k = 0; k < 7; k++) {
    var iso = sumarDias(lunes, k);
    ['AM', 'PM'].forEach(function (tu) {
      var bl = plan.filter(function (r) { return celdaIso_(r.FECHA) === iso && (r.TURNO === 'AM' ? 'AM' : 'PM') === tu; })
        .sort(function (a, b) { return (parseFloat(String(a.ORDEN).replace(',', '.')) || 0) - (parseFloat(String(b.ORDEN).replace(',', '.')) || 0); });
      filas.push([diaDe_(iso).toUpperCase() + ' ' + isoAFecha(iso).slice(0, 5) + ' · ' + (tu === 'AM' ? '☀️ AM' : '🌙 PM'), '', bl.length ? '' : '—', '', '', '', '', '', '', '', '', '']);
      estilos.push([filas.length, tu === 'AM' ? 'am' : 'pm']);
      bl.forEach(function (r) {
        var fab = norm(r.ORIGEN) === 'FABRIK';
        filas.push(['', (fab ? String(r.FABRIK_REF || '').split('·')[1] || '' : '+') + (clave[r.ID] ? ' 🎯' : ''), r['TÍTULO'] || r.BLOQUE || '', String(r.CONTENIDO || '').slice(0, 4000), (r.ORIGEN || '') + (clave[r.ID] ? ' · 🎯 CLAVE: ' + clave[r.ID] : '') + (/editado/.test(r.GENERADO || '') ? ' · ✎ editado' : ''),
          r.MIN || '', r['CÓDIGOS'] || '', r.ESTADO || '', '', '', String(r['POR QUÉ (cursiva)'] || '').slice(0, 300), r.ID]);
        if (clave[r.ID]) claves.push(filas.length);
        estilos.push([filas.length, /CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R02|R03)\b/.test(r['CÓDIGOS'] || '') ? 'carrera' : /W03/.test(r['CÓDIGOS'] || '') ? 'ergo' : fab ? 'fabrik' : 'extra']);
      });
    });
  }
  sh.clear(); sh.setConditionalFormatRules([]);
  if (sh.getMaxColumns() < 12) sh.insertColumnsAfter(sh.getMaxColumns(), 12 - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), 12).clearDataValidations();
  if (sh.getMaxRows() < filas.length + 5) sh.insertRowsAfter(sh.getMaxRows(), filas.length + 5 - sh.getMaxRows());
  sh.getRange(1, 1, filas.length, 12).setValues(filas.map(function (r) { return r.map(celdaSegura_); }));
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(2, 2).setNumberFormat('dd/mm/yyyy').setBackground('#fff7e0');
  sh.getRange(2, 4).insertCheckboxes();
  sh.getRange(2, 5).setFontStyle('italic').setFontColor('#666666');
  sh.setFrozenRows(4);
  [130, 44, 240, 380, 150, 50, 120, 100, 110, 260, 300, 80].forEach(function (w, j) { sh.setColumnWidth(j + 1, w); });
  // Formato en bloque (una llamada por propiedad): mucho más rápido que fila a fila
  var colores = { cab: ['#121212', '#ffffff'], am: ['#fff2cc', '#000000'], pm: ['#e8eaf6', '#000000'], carrera: ['#dbeafe', '#000000'], ergo: ['#e0f2fe', '#000000'], fabrik: ['#f4f5f7', '#000000'], extra: ['#fff7ed', '#000000'] };
  var tipoFila = {}; estilos.forEach(function (e) { tipoFila[e[0]] = e[1]; });
  var bg = [], fc = [], fw = [];
  for (var f = 1; f <= filas.length; f++) {
    var t = tipoFila[f], c = t ? colores[t] : ['#ffffff', '#000000'], negrita = t === 'cab' || t === 'am' || t === 'pm';
    bg.push(new Array(12).fill(c[0])); fc.push(new Array(12).fill(c[1])); fw.push(new Array(12).fill(negrita ? 'bold' : 'normal'));
  }
  claves.forEach(function (f) { fc[f - 1][2] = '#b8860b'; fw[f - 1][2] = 'bold'; });   // 🎯 título en dorado
  sh.getRange(1, 1, filas.length, 12).setBackgrounds(bg).setFontColors(fc).setFontWeights(fw);
  var filasBloque = estilos.filter(function (e) { return /carrera|ergo|fabrik|extra/.test(e[1]); }).map(function (e) { return e[0]; });
  if (filasBloque.length) {
    var vMover = SpreadsheetApp.newDataValidation().requireValueInList(HUECOS_, true).setAllowInvalid(false).build();
    var vSwap = opcionesSwap.length ? SpreadsheetApp.newDataValidation().requireValueInList(opcionesSwap.slice(0, 450), true).setAllowInvalid(false).build() : null;
    filasBloque.forEach(function (f) { sh.getRange(f, 9).setDataValidation(vMover); if (vSwap) sh.getRange(f, 10).setDataValidation(vSwap); });
  }
  sh.getRange(5, 1, Math.max(1, filas.length - 4), 12).setVerticalAlignment('top').setWrap(true);
  sh.getRange(5, 11, Math.max(1, filas.length - 4), 1).setFontStyle('italic');
  sh.getRange(5, 4, Math.max(1, filas.length - 4), 1).setFontFamily('Roboto Mono').setFontSize(9);
  sh.setTabColor('#2f81f7');
  ponerConfig_('semana_bloques', "'" + lunes, 'Semana que muestra APP · SEMANA EN BLOQUES');
  return filas.length;
}
/** Repinta la pestaña si está mostrando esa semana (después de mover, aprobar o generar). */
function refrescarHojaSemana_(lunes) {
  try {
    var cur = isoOk_(String(leerConfig_().semana_bloques || '').trim());
    if (!cur) return;
    if (!lunes || cur === lunesDe_(lunes)) pintarHojaSemana_(cur);
  } catch (e) { Logger.log('Hoja semana: ' + e); }
}
/** Al abrir el Sheet (disparador instalable): la pestaña siempre al día, también con lo que hayas movido desde la app. */
function alAbrirHoja() {
  var cur = isoOk_(String(leerConfig_().semana_bloques || '').trim()), hoyL = lunesDe_(hoyIso_());
  pintarHojaSemana_(!cur || cur < hoyL ? hoyL : cur);
  refrescarResumen_();
}
/** Disparador instalable al editar el Sheet: cambios en la pestaña de la semana. */
function alEditarHoja(e) {
  try {
    var sh = e.range.getSheet(); if (sh.getName() !== HOJAS.SEMBLOQUES) return;
    var f = e.range.getRow(), c = e.range.getColumn(), v = e.range.getValue();
    var lunes = celdaIso_(sh.getRange(2, 2).getValue()) || hoyIso_();
    if (f === 2 && (c === 2 || c === 4)) { pintarHojaSemana_(lunes); return; }
    if (f < 5) return;
    var id = String(sh.getRange(f, 12).getValue() || '').trim(); if (!id) return;
    if (c === 3 || c === 4 || c === 6) {   // v0.11: editar título, ejercicios o minutos desde el Sheet
      var campo = c === 3 ? 'TÍTULO' : c === 4 ? 'CONTENIDO' : 'MIN', cs = {}; cs[campo] = String(v == null ? '' : v);
      if (c === 3 && !cs[campo].trim()) { pintarHojaSemana_(lunes); return; }
      SpreadsheetApp.getActive().toast('Guardando en el plan…', 'Road To Elite', 3);
      editarBloque_({ id: id, campos: cs }); MEMO = null; pintarHojaSemana_(lunesDe_(lunes));
      SpreadsheetApp.getActive().toast('Guardado: es lo que verás en la app (con candado ✎).', 'Road To Elite', 4); return;
    }
    if ((c !== 9 && c !== 10) || !v) return;
    SpreadsheetApp.getActive().toast('Moviendo…', 'Road To Elite', 3);
    if (c === 9) moverBloqueA_(id, v, lunesDe_(lunes));
    else { var m = String(v).match(/#([\w-]+)\s*$/); if (m) intercambiarBloques_(id, m[1]); }
    MEMO = null;
    pintarHojaSemana_(lunes);
    SpreadsheetApp.getActive().toast(c === 9 ? 'Movido a ' + v : 'Intercambiados', 'Road To Elite', 4);
  } catch (err) { try { SpreadsheetApp.getActive().toast('No se pudo: ' + (err && err.message || err), 'Road To Elite', 6); } catch (x) {} }
}
function menuSemanaBloques() { pintarHojaSemana_(leerConfig_().semana_bloques || lunesDe_(hoyIso_())); SpreadsheetApp.getActive().getSheetByName(HOJAS.SEMBLOQUES).activate(); }

function colLetra_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/** Crea o completa las pestañas de la app con su formato. No borra datos. */
function prepararHojas() {
  var ss = miLibro_();
  Object.keys(ESQUEMA).forEach(function (nombre, k) {
    var E = ESQUEMA[nombre], sh = ss.getSheetByName(nombre);
    if (!sh) sh = ss.insertSheet(nombre);
    var tiene = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function (h) { return String(h).trim(); }) : [];
    var cab;
    if (sh.getLastRow() <= 1) cab = E.cab.slice();                        // vacía: cabecera exacta
    else { cab = tiene.slice(); E.cab.forEach(function (h) { if (cab.indexOf(h) < 0) cab.push(h); }); }   // con datos: añade al final
    if (sh.getMaxColumns() < cab.length) sh.insertColumnsAfter(sh.getMaxColumns(), cab.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setBackground('#121212').setFontColor('#ffffff').setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    sh.setFrozenRows(1);
    if (E.congelarCol) sh.setFrozenColumns(E.congelarCol);
    sh.setTabColor('#ff7a1a');
    var filas = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, 1, filas, cab.length).setVerticalAlignment('top').setWrap(true);
    cab.forEach(function (h, j) { var w = E.anchos[E.cab.indexOf(h)]; if (w) sh.setColumnWidth(j + 1, w); });
    var col = function (h) { return cab.indexOf(h) + 1; };
    (E.fechas || []).forEach(function (h) {
      if (col(h) > 0) sh.getRange(2, col(h), filas, 1).setNumberFormat('dd/mm/yyyy')
        .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
    });
    Object.keys(E.listas || {}).forEach(function (h) {
      if (col(h) > 0) sh.getRange(2, col(h), filas, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(E.listas[h], true).setAllowInvalid(true).build());
    });
    if (E.cursiva && col(E.cursiva) > 0) sh.getRange(2, col(E.cursiva), filas, 1).setFontStyle('italic');
    if (E.negrita && col(E.negrita) > 0) sh.getRange(2, col(E.negrita), filas, 1).setFontWeight('bold');
    var reglas = (E.colores || []).filter(function (c) { return col(c[0]) > 0; }).map(function (c) {
      var b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=REGEXMATCH($' + colLetra_(col(c[0])) + '2,"' + c[1] + '")')
        .setBackground(c[2]).setRanges([sh.getRange(2, 1, filas, cab.length)]);
      if (c[3]) b.setFontColor(c[3]);
      return b.build();
    });
    sh.setConditionalFormatRules(reglas);
  });
  Logger.log('OK · Pestañas preparadas: ' + Object.keys(ESQUEMA).join(', '));
}

/** Al editar a mano APP · PLAN: rellena DÍA a partir de FECHA y pone un ID si falta. (Trigger simple: no necesita instalarse.) */
function onEdit(e) {
  try {
    var sh = e.range.getSheet(), nombre = sh.getName();
    if ([HOJAS.PLAN, HOJAS.EVENTOS, HOJAS.METAS, HOJAS.AJUSTES, HOJAS.CARRERA, HOJAS.PLANTILLAS].indexOf(nombre) < 0) return;
    var cab = cabeceras_(sh), f0 = e.range.getRow(), n = e.range.getNumRows();
    if (f0 < 2) return;
    var cId = cab.indexOf('ID') + 1;
    for (var f = f0; f < f0 + n; f++) {
      if (cId > 0 && !String(sh.getRange(f, cId).getValue()).trim() && sh.getRange(f, 2).getValue() !== '') sh.getRange(f, cId).setValue(nuevoId_());
      if (nombre === HOJAS.PLAN) {
        var cF = cab.indexOf('FECHA') + 1, cD = cab.indexOf('DÍA') + 1;
        if (cF > 0 && cD > 0) {
          var v = sh.getRange(f, cF).getValue();
          sh.getRange(f, cD).setValue(v instanceof Date ? NOMBRES_DIA[(v.getDay() + 6) % 7] : '');
        }
      }
    }
  } catch (err) { /* nunca bloquear la edición */ }
}
var NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function nuevoId_() { return Utilities.getUuid().slice(0, 8); }
function diaDe_(iso) { return iso ? NOMBRES_DIA[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7] : ''; }

/** Actualiza columnas concretas de una fila (solo en este libro). */
function actualizarFila_(nombre, fila, o) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  Object.keys(o).forEach(function (h) { var j = cab.indexOf(h); if (j >= 0) sh.getRange(fila, j + 1).setValue(celdaSegura_(o[h])); });
}

// ===================== EVENTOS =====================
var CAMPOS_EVENTO = ['EVENTO', 'TIPO', 'INICIO', 'FIN', 'HORA', 'LUGAR', 'BLOQUEA', 'ANTES (días bajar volumen)', 'DESPUÉS (días recuperación)', 'CÓMO PROCEDER', 'ESTADO', 'NOTAS'];
function guardarEvento_(ev) {
  var o = permitidas_(ev, CAMPOS_EVENTO);
  if (!o.EVENTO || !o.INICIO) throw new Error('evento_incompleto');
  if (!o.FIN) o.FIN = o.INICIO;
  if (!o.ESTADO) o.ESTADO = (o['CÓMO PROCEDER'] || o.BLOQUEA === 'No bloquea') ? 'Decidido' : 'Por decidir';
  var idOut = bloqueo_(function () {
    var id = String(ev.ID || '');
    var x = id ? listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === id; })[0] : null;
    if (x) { actualizarFila_(HOJAS.EVENTOS, x._fila, o); return id; }
    o.ID = nuevoId_(); o.CREADO = ahora_();
    var sh = hojaMia_(HOJAS.EVENTOS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
  if (ev.sinCalendario !== true) eventoACal_(idOut);
  return idOut;
}
function borrarEvento_(id) {
  var x = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(id); })[0];
  if (!x) throw new Error('no_encontrado');
  borrarDeCal_(x);
  borrarFila_(HOJAS.EVENTOS, x._fila, { ID: x.ID });
}
function eventosEntre_(desde, hasta) {
  return listar_(HOJAS.EVENTOS).filter(function (r) {
    if (r.ESTADO === 'Pendiente de aprobar' || r.ESTADO === 'Ignorado') return false;   // los de Google Calendar no cuentan hasta que los apruebes
    var i = celdaIso_(r.INICIO), f = celdaIso_(r.FIN) || i;
    return i && f >= desde && i <= hasta;
  });
}

// ===================== SEMANAS (confirmación antes de programar) =====================
function filaSemana_(lunes) {
  return listar_(HOJAS.SEMANAS).filter(function (r) { return celdaIso_(r.LUNES) === lunes; })[0] || null;
}
/** Guarda disponibilidad y decisiones de la semana. Con confirmar=true queda «Confirmada» (ya se puede programar). */
function guardarSemanaConf_(b) {
  var lunes = lunesDe_(b.lunes);
  var evs = eventosEntre_(lunes, sumarDias(lunes, 6));
  var o = { LUNES: isoAFecha(lunes), 'DOBLES (mañanas libres)': String(b.dobles || '').slice(0, 200), DESCANSO: String(b.descanso || '').slice(0, 200),
    'EVENTOS DE LA SEMANA': evs.map(function (e) { return e.EVENTO + ' (' + e.INICIO + (e.HORA ? ' ' + e.HORA : '') + ' · ' + (e.BLOQUEA || '—') + ')'; }).join(' | '),
    DECISIONES: String(b.decisiones || '').slice(0, 2000), NOTAS: String(b.notas || '').slice(0, 2000) };
  if (b.confirmar) {
    var sinDecidir = evs.filter(function (e) { return e.ESTADO !== 'Decidido' && e.BLOQUEA !== 'No bloquea'; });
    if (sinDecidir.length) throw new Error('eventos_sin_decidir');
    o.ESTADO = 'Confirmada'; o.CONFIRMADA = ahora_();
  }
  return bloqueo_(function () {
    var x = filaSemana_(lunes);
    if (x) { actualizarFila_(HOJAS.SEMANAS, x._fila, o); return lunes; }
    if (!o.ESTADO) o.ESTADO = 'Pendiente de confirmar';
    var sh = hojaMia_(HOJAS.SEMANAS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return lunes;
  });
}

// ===================== PLAN: aprobar semana, cambios propuestos y «no hacer» =====================
/** Pasa a PROGRAMADO todo lo que está en BORRADOR en la semana indicada. */
function aprobarPlanSemana_(lunes) {
  lunes = lunesDe_(lunes);
  var fin = sumarDias(lunes, 6), n = 0;
  bloqueo_(function () {
    listar_(HOJAS.PLAN).forEach(function (r) {
      var d = celdaIso_(r.FECHA);
      if (d >= lunes && d <= fin && r.ESTADO === 'BORRADOR') {
        actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() }); n++;
        if (r.PENDIENTE_ID) { var p = listar_(HOJAS.PENDIENTES).filter(function (x) { return x.ID === r.PENDIENTE_ID; })[0]; if (p) actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Reprogramado' }); }
      }
    });
    var s = filaSemana_(lunes), hu = {};
    try { hu = { 'HUELLA FABRIK': JSON.stringify(huellasFabrik_(fabrikSemana_(lunes).fabrik)), 'FABRIK LEÍDO': ahora_() }; } catch (e) { /* si Fabrik no se puede leer, se aprueba igual */ }
    if (s) actualizarFila_(HOJAS.SEMANAS, s._fila, Object.assign(s.ESTADO === 'Confirmada' ? { ESTADO: 'Programada' } : {}, hu));
    else anadirFila_(HOJAS.SEMANAS, Object.assign({ LUNES: isoAFecha(lunes), ESTADO: 'Programada' }, hu));
  });
  return n;
}

function anadirPendiente_(r, motivo) {
  var sh = hojaMia_(HOJAS.PENDIENTES), cab = cabeceras_(sh);
  var tipo = r.ORIGEN || (String(r.ID || '').indexOf('F-') === 0 ? 'FABRIK' : 'EXTRA');
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, {
    ID: nuevoId_(), CREADO: ahora_(), 'FECHA ORIGINAL': r.FECHA || '', ID_PLAN: r.ID || '', BLOQUE: r['TÍTULO'] || r.BLOQUE || '', TIPO: tipo,
    MOTIVO: String(motivo || '').slice(0, 1000), ESTADO: 'Pendiente' })]);
}

/** Aprueba o rechaza una propuesta de cambios (filas del PLAN con ese CAMBIO_ID). */
function resolverCambio_(cambioId, aprobar) {
  cambioId = String(cambioId || '');
  if (!cambioId) throw new Error('falta_cambio');
  return bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN), propias = plan.filter(function (r) { return r.CAMBIO_ID === cambioId; });
    if (!propias.length) throw new Error('no_encontrado');
    var aBorrar = [];
    propias.forEach(function (r) {
      if (r.ESTADO === 'PROPUESTA') {
        if (aprobar) {
          actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() });
          String(r.REEMPLAZA || '').split(/[,;\s]+/).filter(Boolean).forEach(function (id) {
            var v = plan.filter(function (y) { return y.ID === id; })[0];
            if (v) actualizarFila_(HOJAS.PLAN, v._fila, { ESTADO: 'SUSTITUIDO', ACTUALIZADO: ahora_() });
          });
        } else aBorrar.push(r._fila);
      } else if (r.ESTADO === 'PROPUESTA · NO HACER') {
        if (aprobar) { actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'NO HACER', ACTUALIZADO: ahora_() }); anadirPendiente_(r, 'Reestructuración ' + cambioId); }
        else actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', CAMBIO_ID: '', ACTUALIZADO: ahora_() });
      }
    });
    var sh = hojaMia_(HOJAS.PLAN);
    aBorrar.sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
    var c = listar_(HOJAS.CAMBIOS).filter(function (r) { return r.ID === cambioId; })[0];
    if (c) actualizarFila_(HOJAS.CAMBIOS, c._fila, { ESTADO: aprobar ? 'Aprobada' : 'Rechazada' });
    return propias.length;
  });
}

/** Marca un bloque como «no hacer» y lo manda a PENDIENTES. Los de Fabrik (ID F-…) se anotan en el PLAN sin tocar Fabrik. */
function noHacer_(b) {
  var id = String(b.id || ''), motivo = String(b.motivo || '').slice(0, 1000);
  if (!id || !b.fecha) throw new Error('faltan_datos');
  return bloqueo_(function () {
    var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === id; })[0];
    if (x) {
      actualizarFila_(HOJAS.PLAN, x._fila, { ESTADO: 'NO HACER', ACTUALIZADO: ahora_() });
      anadirPendiente_(x, motivo);
    } else {
      var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh), iso = celdaIso_(b.fecha);
      var o = { ID: id, FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: b.turno || 'PM', ORDEN: b.orden || 50, ORIGEN: 'FABRIK', FABRIK_REF: b.ref || '',
        'TÍTULO': b.titulo || '', ESTADO: 'NO HACER', ACTUALIZADO: ahora_() };
      sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
      anadirPendiente_(o, motivo);
    }
  });
}

// ===================== CAMBIOS (ha surgido algo) =====================
function solicitarCambio_(b) {
  var desde = celdaIso_(b.desde) || hoyIso_();
  if (!b.evento) throw new Error('falta_evento');
  var evId = '';
  if (b.fechaEvento) evId = guardarEvento_({ EVENTO: b.evento, TIPO: b.tipo || 'Otro', INICIO: isoAFecha(celdaIso_(b.fechaEvento)), FIN: isoAFecha(celdaIso_(b.fechaEvento)),
    HORA: b.hora || '', BLOQUEA: b.bloquea || 'Parcial', 'CÓMO PROCEDER': 'Reestructurar la semana', ESTADO: 'Decidido', NOTAS: b.notas || '' });
  var o = { ID: nuevoId_(), CREADO: ahora_(), DESDE: isoAFecha(desde), 'TURNO DESDE': b.turno || 'PM', EVENTO: String(b.evento).slice(0, 200),
    AFECTA: String(b.afecta || '').slice(0, 200), NOTAS: String(b.notas || '').slice(0, 1000) + (evId ? ' · evento ' + evId : ''), ESTADO: 'Solicitada' };
  anadirFila_(HOJAS.CAMBIOS, o);
  return o.ID;
}

function pendientesAbiertos_() { return listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ESTADO === 'Pendiente' || r.ESTADO === 'Propuesto'; }); }
function cambiosAbiertos_() { return listar_(HOJAS.CAMBIOS).filter(function (r) { return r.ESTADO === 'Solicitada' || r.ESTADO === 'Propuesta lista'; }); }

// ===================== COBERTURA EN TARJETAS (lectura de Dashboard, Semana, Mes y carrera) =====================
function cobertura_() { return conMemo_(coberturaSin_); }
function coberturaSin_() {
  var sh = miLibro_().getSheetByName('carrera'), car = sh ? sh.getRange(1, 1, Math.min(Math.max(sh.getLastRow(), 1), 160), 7).getDisplayValues() : [];
  var iCab = -1; car.forEach(function (r, i) { if (iCab < 0 && /^Sesi[oó]n$/i.test(String(r[0]).trim())) iCab = i; });
  var carrera = [], actual = null;
  if (iCab >= 0) car.slice(iCab + 1).forEach(function (r) {
    var t = String(r[0]).trim();
    if (!t) return;
    var soloTitulo = r.slice(1).every(function (c) { return !String(c).trim(); });
    if (soloTitulo) { actual = { titulo: t, sesiones: [] }; carrera.push(actual); }
    else if (actual) actual.sesiones.push({ sesion: t, trabajo: r[1], ritmo: r[2], zona: r[3], datos: r[4], sensaciones: r[5], revision: r[6] });
  });
  return { metas: metasDe_(hoyIso_()), carrera: { intro: car.slice(0, iCab >= 0 ? iCab : 6).map(function (r) { return String(r[0]).trim(); }).filter(Boolean), semanas: carrera } };
}

// ===================== INSTALACIÓN =====================
/** Ejecutar desde el editor tras cada actualización: crea la copia semanal de vídeos (domingo 23:00) y el backup (domingo 23:30, Madrid) y comprueba accesos. */
function configurar() {
  // Domingo: una sola tarea en cadena (cierre → vídeos → backup) en vez de tres con horarios cercanos.
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['copiarVideosGabi', 'backupSemanal', 'cierreSemanal', 'domingoNoche'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('domingoNoche').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).nearMinute(15).inTimezone(CONFIG.ZONA).create();   // termina antes del informe de las 23:30
  Logger.log('OK · Carpeta de backups: ' + DriveApp.getFolderById(CONFIG.BACKUPS_ID).getName());
  // Pestaña «APP · SEMANA EN BLOQUES»: mover/intercambiar desde el Sheet y repintarla al abrirlo
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['alEditarHoja', 'alAbrirHoja'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('alEditarHoja').forSpreadsheet(CONFIG.SHEET_ID).onEdit().create();
  ScriptApp.newTrigger('alAbrirHoja').forSpreadsheet(CONFIG.SHEET_ID).onOpen().create();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'revisarAvisos') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('revisarAvisos').timeBased().everyHours(1).create();
  // v0.9: Fabrik → plan el domingo a las 23:15 y Google Calendar cada hora
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['cargarFabrikDomingo', 'sincronizarCalendario'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cargarFabrikDomingo').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).nearMinute(15).inTimezone(CONFIG.ZONA).create();
  ScriptApp.newTrigger('sincronizarCalendario').timeBased().everyHours(1).create();
  try { Logger.log('OK · Unificación: ' + unificar_()); } catch (e) { Logger.log('AVISO · Unificación (no se ha borrado nada): ' + e); }
  prepararHojas();
  Logger.log('OK · Estímulos sembrados: ' + sembrarEstimulos_() + ' (0 = ya estaban)');
  Logger.log('OK · Biblioteca Z6–Z8 y sesiones Q: ' + sembrarBiblioteca_() + ' sesiones nuevas (0 = ya estaban)');
  Logger.log('OK · Metas nuevas de competición (Z6–Z8 integrado, DU, front squat, burpees, hang snatch/clean): ' + sembrarMetasV12_());
  Logger.log('OK · «Integrar con» y «Cómo mejorarlo» rellenados en ' + sembrarGuiaMetas_() + ' metas (solo celdas vacías)');
  if (!leerConfig_().resumen_auto) ponerConfig_('resumen_auto', 'Sí', 'Correo con los estímulos de la semana al aprobarla (Sí/No)');
  Logger.log('OK · «Datos a registrar» sin pulsómetro fuera de la carrera: ' + limpiarDatosRegistrar_() + ' estímulos');
  if (!leerConfig_().peso_kg) ponerConfig_('peso_kg', '90', 'Tu peso para las pautas de combustible e hidratación (kg)');
  try { subirEventosACal_(); sincronizarCalendario(); Logger.log('OK · Google Calendar: ' + calendario_().getName()); } catch (e) { Logger.log('AVISO · Calendar: ' + e); }
  try { Logger.log('OK · Reels de datos: ' + ideasReels_().length + ' ideas con bloque asociable'); } catch (e) { Logger.log('AVISO · Reels: ' + e); }
  Logger.log('OK · Metas migradas desde Semana/Mes: ' + migrarMetas_() + ' (0 = ya estaban)');
  Logger.log('OK · Tests pasados a APP · EVENTOS: ' + migrarTestsAEventos_() + ' (0 = ya estaban)');
  ['objetivo_2km', 'objetivo_10km'].forEach(function (k) {     // «45:00» se había convertido en 45 horas: se guarda como texto
    var x = listar_(HOJAS.CONFIG).filter(function (r) { return r.CLAVE === k; })[0];
    if (x && /^\d+:\d{2}:00$/.test(x.VALOR)) actualizarFila_(HOJAS.CONFIG, x._fila, { VALOR: x.VALOR.replace(/:00$/, '') });
  });
  analizarCarrera_();
  var est = estructura_(fabrik_());
  Logger.log('OK · Fabrik: ' + est.semanas.length + ' semanas leídas · erratas: ' + est.erratas.length);
  try { pintarHojaSemana_(lunesDe_(hoyIso_())); Logger.log('OK · Pestaña «APP · SEMANA EN BLOQUES» pintada'); } catch (e) { Logger.log('AVISO · Semana en bloques: ' + e); }
  try { pintarResumen_(); Logger.log('OK · Pestaña «APP · RESUMEN» pintada (mismos % que la app)'); } catch (e) { Logger.log('AVISO · Resumen: ' + e); }
  Logger.log('OK · Pestañas visibles: ' + ordenarHojas_() + ' · las internas de la app quedan ocultas');
  Logger.log('OK · Pestañas de la app: ' + Object.keys(HOJAS).map(function (k) { var sh = miLibro_().getSheetByName(HOJAS[k]); return sh ? sh.getName() : HOJAS[k] + ' (se crea al usarla)'; }).join(', '));
  Logger.log('OK · Vídeos en tu copia: ' + leerVideos_().length);
}

// ===================== FABRIK: ESTRUCTURA POR POSICIÓN (copiado de la app de Gabi, solo lectura) =====================
function estructura_(ss) {
  var hojas = ss.getSheets();
  var erratas = [];
  var hojaCiclo = hojas[0];
  var celdasCiclo = hojaCiclo ? hojaCiclo.getDataRange().getDisplayValues() : [];
  var ciclo = parsearCiclo(celdasCiclo, '0000-00-00');
  var inicio = ciclo && ciclo.fases.length ? ciclo.fases[0].inicio : null;

  // fechas del ciclo coherentes
  if (ciclo) ciclo.fases.forEach(function (f, i) {
    var lin = String((celdasCiclo[0] || [])[i + 1] || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var fechas = lin.map(fechaIsoLarga).filter(Boolean);
    var finEsperado = f.inicio ? sumarDias(f.inicio, f.semanas * 7 - 1) : null;
    if (fechas[1] && finEsperado && fechas[1] !== finEsperado)
      erratas.push('Pestaña "' + hojaCiclo.getName() + '": la fase ' + f.nombre + ' termina el ' + isoAFecha(fechas[1]) +
        ', pero con ' + f.semanas + ' semanas debería terminar el ' + isoAFecha(finEsperado) + '.');
    var sig = ciclo.fases[i + 1];
    if (sig && sig.inicio && f.fin && sig.inicio !== sumarDias(f.fin, 1))
      erratas.push('Pestaña "' + hojaCiclo.getName() + '": la fase ' + sig.nombre + ' empieza el ' + isoAFecha(sig.inicio) +
        ' y la anterior termina el ' + isoAFecha(f.fin) + '.');
  });

  var semanas = [], i = 1, k = 0;
  while (i < hojas.length) {
    var h = hojas[i], nombre = h.getName().trim();
    // Variante de una semana: "26/10/2026 BADAJOZ" (misma fecha que una semana ya leída + un nombre).
    // No cuenta como semana nueva: se muestra como desplegable dentro de cada día/bloque de esa semana.
    var mV = nombre.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)$/);
    if (mV) {
      var base = semanas.filter(function (s) { return fechaIso(s.nombre) === fechaIso(mV[1]); })[0];
      if (base) {
        (base.variantes = base.variantes || []).push({ nombre: mV[2].trim(), hoja: h });
        i++;
        // si la variante trae sus propias NOTAS, también se saltan
        if (hojas[i] && /^NOTAS\b/i.test(hojas[i].getName().trim()) && norm(hojas[i].getName()).indexOf(norm(mV[2])) >= 0) i++;
        continue;
      }
      erratas.push('La pestaña "' + nombre + '" parece una versión especial, pero no hay ninguna semana "' + mV[1] + '" delante.');
      i++; continue;
    }
    if (/^NOTAS\b/i.test(nombre)) {
      erratas.push('La pestaña "' + nombre + '" (posición ' + (i + 1) + ') no tiene delante su semana de programación.');
      i++; continue;
    }
    var notas = hojas[i + 1] && /^NOTAS\b/i.test(hojas[i + 1].getName().trim()) ? hojas[i + 1] : null;
    var lunes = inicio ? sumarDias(inicio, 7 * k) : fechaIso(nombre);
    var sem = { k: k, id: String(h.getSheetId()), nombre: nombre, hoja: h, notas: notas, iso: lunes };
    semanas.push(sem);

    var fechaNombre = fechaIso(nombre);
    if (lunes && fechaNombre !== lunes)
      erratas.push('La pestaña "' + nombre + '" es la semana ' + (k + 1) + ' del ciclo (lunes ' + isoAFecha(lunes) +
        '). Su nombre debería ser ' + isoAFecha(lunes) + '.');
    if (!notas) erratas.push('Falta la pestaña de NOTAS justo después de "' + nombre + '".');
    else if (norm(notas.getName()).replace(/\s+/g, ' ').trim() !== 'NOTAS ' + norm(nombre))
      erratas.push('La pestaña de notas "' + notas.getName() + '" no coincide con su semana "' + nombre + '" (debería llamarse "NOTAS ' + nombre + '").');

    var cab = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getDisplayValues()[0].map(function (x) { return norm(x).trim(); });
    var faltan = DIAS.slice(0, 6).filter(function (d) { return cab.indexOf(d) < 0; });
    if (faltan.length) erratas.push('En "' + nombre + '" no encuentro la columna de: ' + faltan.join(', ') + '.');

    i += notas ? 2 : 1; k++;
  }
  if (!inicio) erratas.push('No encuentro la fecha de inicio del ciclo en la primera pestaña ("' + (hojaCiclo ? hojaCiclo.getName() : '?') + '").');
  return { ciclo: celdasCiclo, semanas: semanas, erratas: erratas };
}

function isoAFecha(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '?'; }

// ===================== PARSER DE FABRIK (funciones puras, copiadas de la app de Gabi) =====================
function fechaIso(txt) {
  var m = String(txt).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  var y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

function sumarDias(iso, n) {
  var d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function norm(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function construirSemana(celdasSem, celdasNotas, celdasCiclo, nombre, isoLunes) {
  var cab = (celdasSem[0] || []).map(norm);
  var notasCab = (celdasNotas[0] || []);
  var notasCuerpo = (celdasNotas[1] || []);
  var dias = [];

  cab.forEach(function (h, col) {
    var idx = DIAS.indexOf(h.trim());
    if (idx < 0) return;
    var texto = (celdasSem[1] || [])[col] || '';
    if (!texto.trim()) return;
    // columna de notas del mismo día
    var nCol = -1;
    notasCab.forEach(function (t, c) { if (norm(t).split('\n')[0].trim() === DIAS[idx]) nCol = c; });
    var dia = {
      nombre: DIAS[idx],
      iso: sumarDias(isoLunes, idx),
      foco: nCol >= 0 ? extraerFoco(notasCab[nCol]) : [],
      bloques: parsearBloques(texto)
    };
    asignarNotas(dia, nCol >= 0 ? notasCuerpo[nCol] : '');
    dia.rpe = rpeDia(dia, texto);
    dias.push(dia);
  });

  return estimarRpes_({ semana: nombre, lunes: isoLunes, ciclo: parsearCiclo(celdasCiclo, isoLunes), dias: dias, videosSemana: parsearVideosFila(celdasSem[2] || []) });
}

/**
 * Compara una versión especial (p. ej. "26/10/2026 BADAJOZ") con la semana normal, día a día y bloque a bloque,
 * y deja SOLO lo que cambia:
 *   bloque.variantes = [{ nombre, tipo: 'cambia'|'sustituye'|'quita', titulo?, partes: [...], quitadas: [...] }]
 *   dia.variantesExtra = [{ nombre, bloque }]   (bloques de la versión que no encajan con ninguno normal)
 */
function esRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function aplicarVariante(semana, nombre, celdas) {
  var cab = (celdas[0] || []).map(norm);
  var limpio = function (s) { return norm(s).replace(/\s+/g, ' ').trim(); };
  var tituloSin = function (t) { return limpio(t).replace(new RegExp('\\b' + esRe(limpio(nombre)) + '\\b', 'g'), '').replace(/\s+/g, ' ').trim(); };
  var textoBloque = function (b) { return limpio(b.titulo) + '|' + b.partes.map(function (p) { return limpio(p.etiqueta) + '#' + limpio(p.texto); }).join('|'); };
  var letra = function (et) { return limpio(String(et).split(' · ')[0]); };

  semana.dias.forEach(function (dia) {
    var col = cab.map(function (h) { return h.trim(); }).indexOf(dia.nombre);
    if (col < 0) return;
    var vb = parsearBloques((celdas[1] || [])[col] || '');
    if (!vb.length) return;
    vb.forEach(function (b) {
      b.titulo = b.titulo.replace(new RegExp('\\s*\\b' + esRe(nombre) + '\\b', 'i'), '').trim() || b.titulo;
      // título partido en dos líneas ("2: STRONGMAN/GIMNASTICS" + "METCON")
      var p0 = b.partes[0];
      if (p0 && !p0.etiqueta) {
        var ls = p0.texto.split('\n');
        if (ls.length > 2 && ls[0].trim() && !ls[1].trim() && ls[0].trim().length <= 24 && !/\d/.test(ls[0])) {
          b.titulo += ' ' + ls[0].trim();
          p0.texto = recortar(ls.slice(1).join('\n'));
        }
      }
    });

    var normales = dia.bloques, par = {}, usadoN = {};
    // 1) mismo título
    vb.forEach(function (v, j) {
      normales.forEach(function (b, i) {
        if (par[j] === undefined && !usadoN[i] && tituloSin(b.titulo) === tituloSin(v.titulo)) { par[j] = i; usadoN[i] = 1; }
      });
    });
    // 2) título parecido (p. ej. POWER CLEAN ↔ SQUAT CLEAN)
    vb.forEach(function (v, j) {
      if (par[j] !== undefined) return;
      var mejor = -1, pm = 0;
      normales.forEach(function (b, i) { if (!usadoN[i]) { var p = puntuar(v.titulo, b); if (p > pm) { pm = p; mejor = i; } } });
      if (mejor >= 0) { par[j] = mejor; usadoN[mejor] = 1; }
    });
    // 3) mismo número de bloque (un bloque que sustituye a otro)
    vb.forEach(function (v, j) {
      if (par[j] !== undefined) return;
      normales.forEach(function (b, i) { if (par[j] === undefined && !usadoN[i] && b.n === v.n) { par[j] = i; usadoN[i] = 1; v.sustituye = true; } });
    });

    var hay = false;
    vb.forEach(function (v, j) {
      var i = par[j];
      if (i === undefined) { (dia.variantesExtra = dia.variantesExtra || []).push({ nombre: nombre, bloque: v }); hay = true; return; }
      var b = normales[i];
      if (textoBloque(b) === textoBloque(v)) return; // idéntico
      hay = true;
      if (v.sustituye) {
        (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'sustituye', titulo: v.titulo, partes: v.partes, quitadas: [] });
        return;
      }
      // partes: se emparejan por su letra (A, B, B.2, C…) y orden de aparición
      var claves = function (lista) {
        var vistos = {};
        return lista.map(function (p) { var k = letra(p.etiqueta) || '_'; vistos[k] = (vistos[k] || 0) + 1; return k + '#' + vistos[k]; });
      };
      var kn = claves(b.partes), kv = claves(v.partes);
      var partes = [];
      v.partes.forEach(function (p, x) {
        var y = kn.indexOf(kv[x]);
        if (y < 0) partes.push({ etiqueta: p.etiqueta, tipo: p.tipo, texto: p.texto, cambio: 'nueva' });
        else if (limpio(b.partes[y].texto) !== limpio(p.texto) || limpio(b.partes[y].etiqueta) !== limpio(p.etiqueta))
          partes.push({ etiqueta: p.etiqueta, tipo: p.tipo, texto: p.texto, cambio: 'cambia' });
      });
      var quitadas = b.partes.filter(function (p, y) { return kv.indexOf(kn[y]) < 0 && p.tipo !== 'adapt'; }).map(function (p) { return p.etiqueta || 'Parte sin título'; });
      if (b.partes.length && quitadas.length === b.partes.filter(function (p) { return p.tipo !== 'adapt'; }).length && partes.length === v.partes.length) {
        // no comparten ninguna parte: es otro bloque distinto en su lugar
        (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'sustituye', titulo: v.titulo, partes: v.partes, quitadas: [] });
        return;
      }
      (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'cambia',
        titulo: tituloSin(b.titulo) !== tituloSin(v.titulo) ? v.titulo : '', partes: partes, quitadas: quitadas });
    });
    // bloques normales que la versión no hace
    normales.forEach(function (b, i) {
      if (usadoN[i]) return;
      hay = true;
      (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'quita', partes: [], quitadas: [] });
    });
    if (hay) (dia.variantesNombres = dia.variantesNombres || []).push(nombre);
  });
  (semana.variantes = semana.variantes || []).push(nombre);
  return semana;
}

function parsearBloques(texto) {
  var lineas = String(texto).replace(/\r/g, '').split('\n');
  var bloques = [], b = null, p = null, previaVacia = true;
  function nuevaParte(etiqueta, tipo) {
    p = { etiqueta: etiqueta, tipo: tipo, lineas: [] };
    b.partes.push(p);
  }
  lineas.forEach(function (raw) {
    var l = raw.replace(/\s+$/, '');
    // «1: POWER CLEAN», «1. POWER SNATCH», «1, …», «1) …» o «1 POWER CLEAN» (sin signo solo si sigue la numeración y va tras una línea vacía)
    var mB = l.match(/^\s*(\d{1,2})\s*[:.,;)\-–]\s*([A-ZÁÉÍÓÚÑa-z].*)$/);
    if (!mB && previaVacia) {
      var m0 = l.match(/^\s*(\d{1,2})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 +&\/\-]{2,})$/);
      var sig = bloques.filter(function (x) { return x.n > 0; }).length + 1;
      if (m0 && Number(m0[1]) === sig && !/^(SETS?|SERIES|RONDAS?|ROUNDS?|REPS?|X|M|MIN|CAL|KG|SEG)\b/.test(norm(m0[2]))) mB = m0;
    }
    previaVacia = !l.trim();
    if (mB) {
      b = { n: Number(mB[1]), titulo: mB[2].trim(), partes: [] };
      bloques.push(b); p = null; return;
    }
    if (!b) { b = { n: 0, titulo: '', partes: [] }; bloques.push(b); }
    // "A) MEJORA RANGO…" es un apartado; "A) 20+20M CARRY" es un ejercicio de una serie alterna
    var mP = l.match(/^\s*([A-Z](?:\.\d)?)\)\s*([A-ZÁÉÍÓÚÑa-z].*)$/);
    if (mP) {
      var et = mP[1] + ' · ' + mP[2].trim();
      var t = RE_PREP_.test(norm(mP[2])) ? 'prep' : 'main';
      nuevaParte(et, t); return;
    }
    if (/^\s*ADAPTACIONES\s*$/.test(norm(l))) { nuevaParte('Adaptaciones', 'adapt'); return; }
    if (!p) nuevaParte('', 'main');
    p.lineas.push(l);
  });
  bloques.forEach(function (bl) {
    bl.partes = bl.partes.map(function (pt) {
      return { etiqueta: pt.etiqueta, tipo: pt.tipo, texto: recortar(pt.lineas.join('\n')) };
    }).filter(function (pt) { return pt.texto || pt.etiqueta; });
  });
  return bloques.filter(function (bl) { return bl.titulo || bl.partes.length; });
}

function recortar(s) {
  return s.replace(/^\s*\n+/, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

function extraerFoco(celda) {
  var lineas = String(celda || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  lineas = lineas.slice(1); // nombre del día
  if (lineas.length && /OBJETIVO/.test(norm(lineas[0]))) lineas = lineas.slice(1);
  var inicio = /^(TRABAJO|METCON|DOBLE|ACCES|RESISTENCIA|RECOVERY|FRONT SQUAT|BACK SQUAT|SKILLS|ENDURANCE)/;
  var items = [];
  lineas.forEach(function (l) {
    if (!items.length || inicio.test(norm(l))) items.push(l);
    else items[items.length - 1] += ' ' + l;
  });
  return items;
}

var SINONIMOS = { BANCA: 'BENCH', PUSH: 'PRESS', ACCESORIOS: 'ACCES', ACCESSORIOS: 'ACCES', ACCESORIES: 'ACCES',
  ACCESSORIES: 'ACCES', MUSTLE: 'MUSCLE', CONTRASTE: 'CONTRAST', GIMNASTICS: 'GYMNASTICS', GIMNASTICOS: 'GYMNASTICS', GIMNASIA: 'GYMNASTICS',
  ACTIVACION: 'ACTIVATION', MOVILIDAD: 'MOBILITY', CALENTAMIENTO: 'WARM', HALTEROFILIA: 'WEIGHTLIFTING', ARRANCADA: 'SNATCH', CARGADA: 'CLEAN',
  SENTADILLA: 'SQUAT', ENVION: 'JERK', DOMINADAS: 'PULL', RESISTENCIA: 'ENDURANCE', HABILIDADES: 'SKILLS', TECNICA: 'SKILLS' };
/** Fabrik en inglés o en español da igual: el texto se lee en los dos idiomas (original + traducción a los nombres en inglés). */
var ES_EN = [[/ARRANCADA DE POTENCIA|ARRANCADA POWER/g, 'POWER SNATCH'], [/CARGADA DE POTENCIA|CARGADA POWER/g, 'POWER CLEAN'], [/ARRANCADA/g, 'SNATCH'], [/CARGADA Y (ENVION|JERK)/g, 'CLEAN AND JERK'],
  [/CARGADA/g, 'CLEAN'], [/ENVION (PARTIDO|EN TIJERA)|JERK PARTIDO/g, 'SPLIT JERK'], [/ENVION/g, 'JERK'], [/SENTADILLA TRASERA/g, 'BACK SQUAT'], [/SENTADILLA (FRONTAL|DELANTERA)/g, 'FRONT SQUAT'],
  [/SENTADILLA (POR )?ENCIMA DE LA CABEZA|SENTADILLA OVERHEAD/g, 'OVERHEAD SQUAT'], [/SENTADILLA BULGARA/g, 'BULGARIAN SPLIT SQUAT'], [/SENTADILLAS?/g, 'SQUAT'], [/PESO MUERTO/g, 'DEADLIFT'],
  [/PRESS (DE )?BANCA/g, 'BENCH PRESS'], [/PRESS MILITAR|PRESS ESTRICTO/g, 'STRICT PRESS'], [/DOMINADAS? (AL PECHO|PECHO A BARRA)/g, 'CHEST TO BAR'], [/DOMINADAS?/g, 'PULL UP'], [/FONDOS?/g, 'DIP'],
  [/ZANCADAS?/g, 'LUNGE'], [/SALTOS? AL CAJON/g, 'BOX JUMP'], [/SALTOS? DE COMBA DOBLES|DOBLES DE COMBA|\bDOBLES\b/g, 'DOUBLE UNDER'], [/TRIPLES/g, 'TRIPLE UNDER'], [/PINO/g, 'HANDSTAND'],
  [/FLEXIONES (EN|DE) PINO/g, 'HSPU'], [/SUBIDAS? A LA CUERDA|CUERDA/g, 'ROPE CLIMB'], [/MUSCLE UP EN ANILLAS|MUSCLE UPS? ANILLAS/g, 'RING MUSCLE UP'], [/MUSCLE UP EN BARRA/g, 'BAR MUSCLE UP'],
  [/PIES A (LA )?BARRA/g, 'T2B'], [/REMO\b/g, 'ROW'], [/BICI(CLETA)? DE AIRE|ASSAULT/g, 'AIR BIKE'], [/CARRERA|CORRER/g, 'RUN'], [/LANZAMIENTOS? A PARED|BALON MEDICINAL/g, 'WALL BALL'],
  [/PLANCHA LATERAL/g, 'SIDE PLANK'], [/PLANCHA/g, 'PLANK'], [/TRINEO/g, 'SLED'], [/CALENTAMIENTO/g, 'WARM UP'], [/ACTIVACION/g, 'ACTIVATION'], [/MOVILIDAD/g, 'MOBILITY'],
  [/HALTEROFILIA/g, 'WEIGHTLIFTING'], [/GIMNASTICOS?|GIMNASIA/g, 'GYMNASTICS'], [/ACCESORIOS?/g, 'ACCESSORIES'], [/MANCUERNAS?/g, 'DB'], [/KETTLEBELLS?|PESAS RUSAS?/g, 'KB'],
  [/SACO( DE ARENA)?/g, 'SANDBAG'], [/EMPUJE DE CADERA/g, 'HIP THRUST'], [/CADA (\d+)/g, 'EVERY $1'], [/SERIES/g, 'SETS'], [/RONDAS/g, 'ROUNDS'], [/DESCANSO/g, 'REST']];
function bilingue_(t) { var n = norm(t), e = n; ES_EN.forEach(function (x) { e = e.replace(x[0], x[1]); }); return e === n ? n : n + '\n' + e; }
var VACIAS = { DE: 1, LA: 1, EL: 1, Y: 1, CON: 1, TRABAJO: 1, A: 1, B: 1, C: 1, WEIGHLIFTING: 1, STRENGHT: 1, STRENGTH: 1, FUERZA: 1, PARA: 1, LOS: 1, LAS: 1, EN: 1 };

function tokens(s) {
  return norm(s).split(/[^A-Z0-9]+/).filter(function (t) { return t.length >= 2 && !VACIAS[t]; })
    .map(function (t) { return SINONIMOS[t] || t; });
}

function parecido(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  var n = Math.min(a.length, b.length, 6);
  return a.slice(0, n) === b.slice(0, n);
}

function puntuar(titulo, bloque) {
  var tb = tokens(bloque.titulo + ' ' + bloque.partes.map(function (p) { return p.etiqueta; }).join(' '));
  return tokens(titulo).filter(function (t) { return tb.some(function (x) { return parecido(t, x); }); }).length;
}

var CAMPOS_METCON = [['WOD MATERIAL', 'material'], ['INTENSIDAD', 'intensidad'], ['CARGA', 'carga'], ['NOTAS', 'notas'],
  ['OBJETIVO', 'objetivo'], ['MODALIDAD WOD', 'formato'], ['MODALIDAD', 'modalidad']];

function asignarNotas(dia, celda) {
  var lineas = String(celda || '').replace(/\r/g, '').split('\n');
  var secciones = [], actual = null, previaVacia = true;
  lineas.forEach(function (raw) {
    var l = raw.trim();
    if (!l) { previaVacia = true; if (actual) actual.lineas.push(''); return; }
    var esTitulo = previaVacia && l.length <= 32 && l.indexOf(':') < 0 && l.split(/\s+/).length <= 4 &&
      (/^(METCON|ACCES|SKILLS)/.test(norm(l)) || dia.bloques.some(function (b) { return puntuar(l, b) > 0; }));
    previaVacia = false;
    if (esTitulo) { actual = { titulo: l, lineas: [] }; secciones.push(actual); return; }
    if (!actual) { actual = { titulo: '', lineas: [] }; secciones.push(actual); }
    actual.lineas.push(l);
  });

  var usados = {};
  dia.notasDia = [];
  secciones.forEach(function (s) {
    var mejor = null, pMejor = 0;
    if (s.titulo) dia.bloques.forEach(function (b, i) {
      var p = puntuar(s.titulo, b) - (usados[i] ? 0.5 : 0) - b.titulo.length / 1000;
      if (p > pMejor) { pMejor = p; mejor = i; }
    });
    var texto = recortar(s.lineas.join('\n'));
    if (mejor === null || pMejor <= 0) { if (texto) dia.notasDia.push({ titulo: s.titulo, texto: texto }); return; }
    usados[mejor] = true;
    var b = dia.bloques[mejor];
    var campos = /METCON/.test(norm(s.titulo)) ? parsearCampos(texto) : null;
    if (campos && Object.keys(campos.wod).length) {
      b.wod = campos.wod;
      if (campos.resto) b.nota = (b.nota ? b.nota + '\n\n' : '') + campos.resto;
      var r = (b.wod.intensidad || '').match(/RPE\s*([\d/,.]+)/i);
      if (r) b.rpe = r[1];
    } else {
      b.nota = (b.nota ? b.nota + '\n\n' : '') + texto;
    }
  });
}

function parsearCampos(texto) {
  var wod = {}, campo = null, resto = [];
  texto.split('\n').forEach(function (l) {
    var n = norm(l), hallado = null;
    for (var i = 0; i < CAMPOS_METCON.length; i++) {
      var c = CAMPOS_METCON[i][0];
      if (n.indexOf(c) === 0 && /^\s*:/.test(n.slice(c.length))) { hallado = CAMPOS_METCON[i]; break; }
    }
    if (hallado) {
      campo = hallado[1];
      wod[campo] = l.slice(l.indexOf(':') + 1).trim();
    } else if (campo) {
      wod[campo] = (wod[campo] ? wod[campo] + '\n' : '') + l;
    } else resto.push(l);
  });
  Object.keys(wod).forEach(function (k) { wod[k] = recortar(wod[k]); });
  return { wod: wod, resto: recortar(resto.join('\n')) };
}

function rpeDia(dia, texto) {
  if (/ZONA\s*2|\bZ2\b|RECOVERY/.test(norm(dia.foco ? dia.foco.join(' ') : '')) && !dia.bloques.some(esMetconB_)) return 'Z2';
  var met = dia.bloques.filter(esMetconB_);
  for (var i = 0; i < met.length; i++) {
    if (met[i].rpe) return met[i].rpe;
    var m = norm(met[i].partes.map(function (p) { return p.texto; }).join('\n') + '\n' + (met[i].nota || '')).match(/RPE\s*(\d+(?:\/\d+)?)/);
    if (m) return m[1];
  }
  if (/ZONA\s*2|\bZ2\b/.test(norm(texto))) return 'Z2';
  return null;   // se estima después comparando los días de la semana (estimarRpes_)
}
function esMetconB_(b) { return /METCON|\bWOD\b|ACONDICIONAMIENTO|CONDITIONING/.test(norm(b.titulo)) || b.partes.some(function (p) { return /^\s*METCON\s*:/.test(norm(p.texto)); }); }
/** Minutos aproximados de un metcon a partir de su formato (TIME CAP 15′, AMRAP 7′, EVERY 4′ X 4, EMOM 10′, 3′ ON X 1′ OFF…). */
function minutosMetcon_(txt) {
  var t = norm(txt).replace(/[´’′]/g, "'"), tot = 0, m;
  var re = /(?:TIME\s*CAP|AMRAP|EMOM|E\dMOM)\s*(\d+)\s*'/g;
  while ((m = re.exec(t))) tot += +m[1];
  var ev = /EVERY\s*(\d+)\s*'\s*(\d+)?\s*"?\s*X\s*(\d+)/g;
  while ((m = ev.exec(t))) tot += (+m[1] + (+m[2] || 0) / 60) * +m[3];
  var on = t.match(/(\d+)\s*SETS[\s\S]{0,20}?(\d+)\s*'\s*ON\s*X\s*(\d+)\s*'\s*OFF/) || t.match(/AMRAP\s*(\d+)\s*SETS[\s\S]{0,20}?(\d+)\s*'\s*ON\s*X\s*(\d+)/);
  if (on) tot += +on[1] * (+on[2] + +on[3]);
  if (!tot) { var s = t.match(/(\d+)\s*SETS/); tot = s ? Math.min(25, +s[1] * 3) : 12; }
  return Math.min(40, tot);
}
/**
 * RPE del día = el del metcon. Si Gabi no lo pone, se estima comparando los días de la semana:
 * carga declarada en las notas (BAJA → EXIGENTE/MÁXIMA), duración del metcon, nº de bloques y si hay un segundo metcon/erg.
 * Se marca con «≈» para que se vea que es una estimación.
 */
function estimarRpes_(sem) {
  var NIV = [[/MAXIMA|MUY ALTA/, 3], [/EXIGENTE|ALTA/, 2.5], [/MODERADA/, 2], [/MEDIA/, 1.5], [/BAJA|LIGERA|SUAVE/, 1]];
  (sem.dias || []).forEach(function (d) {
    if (d.rpe) return;
    var met = d.bloques.filter(esMetconB_);
    if (!met.length) return;
    var carga = 1.5;
    met.forEach(function (b) { var c = norm((b.wod && (b.wod.carga || b.wod.intensidad)) || ''); for (var i = 0; i < NIV.length; i++) if (NIV[i][0].test(c)) { carga = Math.max(carga, NIV[i][1]); break; } });
    var dur = minutosMetcon_(met[0].partes.map(function (p) { return p.texto; }).join('\n'));
    var r = 5 + (carga - 1) * 1.2 + Math.min(2, dur / 12) + (met.length > 1 ? 0.5 : 0) + (d.bloques.length >= 4 ? 0.2 : 0);
    d.rpe = '≈' + Math.max(5, Math.min(9, Math.round(r)));
    d.rpeEstimado = true;
  });
  return sem;
}

function parsearCiclo(celdas, isoLunes) {
  if (!celdas.length) return null;
  var fases = [];
  (celdas[0] || []).forEach(function (t, c) {
    if (c === 0 || !String(t).trim()) return;
    var lin = String(t).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var f = lin.map(fechaIsoLarga).filter(Boolean);
    var semanas = parseInt((lin.join(' ').match(/(\d+)\s*SEMANAS/i) || [])[1], 10) || 4;
    var inicio = f[0] || null;
    var fin = f[1] && inicio && f[1] > inicio ? f[1] : (inicio ? sumarDias(inicio, semanas * 7 - 1) : null);
    fases.push({ nombre: lin[0], semanas: semanas, inicio: inicio, fin: fin, objetivos: recortar(String((celdas[1] || [])[c] || '')) });
  });
  var actual = -1, semana = null;
  fases.forEach(function (f, i) {
    if (f.inicio && f.fin && isoLunes >= f.inicio && isoLunes <= f.fin) {
      actual = i;
      semana = Math.floor((Date.parse(isoLunes) - Date.parse(f.inicio)) / 864e5 / 7) + 1;
    }
  });
  return { fases: fases, actual: actual, semana: semana };
}

function fechaIsoLarga(l) {
  return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(l) ? fechaIso(l) : null;
}

function parsearVideosFila(fila) {
  var out = [];
  fila.forEach(function (celda) {
    var lin = String(celda || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    for (var i = 0; i < lin.length - 1; i++) {
      if (!/^https?:\/\//.test(lin[i]) && /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(lin[i + 1])) {
        out.push({ nombre: lin[i], url: lin[i + 1] }); i++;
      }
    }
  });
  return out;
}

// =====================================================================================================
//  v0.9 · CARGA DE FABRIK EN EL PLAN · EXTRAS AUTOMÁTICOS · REFUERZOS · POSICIÓN ÓPTIMA · GRABACIÓN ·
//         GOOGLE CALENDAR · NOTAS POR BLOQUE · WODS DE REFERENCIA · AVISOS VISTOS
// =====================================================================================================
HOJAS.ESTIMULOS = 'APP · ESTÍMULOS'; HOJAS.REFUERZOS = 'APP · REFUERZOS'; HOJAS.NOTAS = 'APP · NOTAS BLOQUE'; HOJAS.WODS = 'APP · WODS';
CONFIG.REELS_ID = '1M5t34kRDWRoGakKYlRV_MxK_0Q4u8KGhXISUGh-sB00';   // «Reels de datos — @pabloserlop» · SOLO LECTURA
ESQUEMA['APP · PLAN'].cab.push('GENERADO', 'PENDIENTE_ID', 'REFUERZO_ID'); ESQUEMA['APP · PLAN'].anchos.push(120, 80, 80);
ESQUEMA['APP · PLAN'].listas.ESTADO.push('SIN HUECO');
ESQUEMA['APP · SEMANAS'].cab.push('BALANCE ESTÍMULOS'); ESQUEMA['APP · SEMANAS'].anchos.push(520);
/** Añade una columna al final si falta (para no tener que volver a ejecutar «configurar» tras cada versión). */
function asegurarColumna_(nombre, col) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  if (cab.indexOf(col) >= 0) return;
  if (sh.getMaxColumns() <= cab.length) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
  sh.getRange(1, cab.length + 1).setValue(col).setBackground('#121212').setFontColor('#ffffff').setFontWeight('bold');
}
ESQUEMA['APP · EVENTOS'].cab.push('GCAL_ID', 'ORIGEN CAL'); ESQUEMA['APP · EVENTOS'].anchos.push(160, 90);
ESQUEMA['APP · ESTÍMULOS'] = {
  cab: ['CÓDIGO', 'NOMBRE', 'DETECTAR (regex)', 'ORIGEN', 'TURNO', 'MIN', 'INTENSIDAD', 'CONTENIDO', 'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS', 'CARGA', 'EVITAR', 'DATOS A REGISTRAR', 'ACTIVO'],
  anchos: [70, 200, 220, 90, 60, 50, 90, 320, 260, 340, 260, 140, 140, 220, 60], cursiva: 'POR QUÉ (cursiva)', negrita: 'NOMBRE', congelarCol: 2,
  listas: { ORIGEN: ['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'], TURNO: ['AM', 'PM', 'AM|PM'], ACTIVO: ['Sí', 'No'] }
};
ESQUEMA['APP · REFUERZOS'] = {
  cab: ['ID', 'SEMANA', 'TEXTO', 'CÓDIGO', 'ESTADO', 'NOTAS', 'CREADO'], anchos: [70, 95, 260, 80, 110, 260, 120], fechas: ['SEMANA'],
  listas: { ESTADO: ['Pendiente', 'Programado', 'Hecho', 'Descartado'] }, colores: [['ESTADO', 'Pendiente', '#ffedcc']]
};
ESQUEMA['APP · NOTAS BLOQUE'] = {
  cab: ['FECHA', 'ID_PLAN', 'BLOQUE', 'MIS NOTAS', 'RECOMENDACIÓN', 'ACTUALIZADO'], anchos: [95, 110, 200, 360, 420, 120], fechas: ['FECHA']
};
ESQUEMA['APP · WODS'] = {
  cab: ['ID', 'NOMBRE', 'TIPO', 'FECHA ORIGEN', 'CONTENIDO', 'RESULTADO', 'NOTAS', 'CREADO'], anchos: [70, 200, 100, 95, 420, 110, 260, 120], fechas: ['FECHA ORIGEN'], negrita: 'NOMBRE',
  listas: { TIPO: ['Guardado', 'Referencia'], RESULTADO: ['Tiempo', 'Rondas + reps', 'Reps', 'Kilos', 'Calorías', 'Metros'] }
};

// ---------- 1 · Catálogo de estímulos (editable en APP · ESTÍMULOS; se siembra con estos valores) ----------
// Etiquetas de CARGA / EVITAR: PIERNA · HOMBRO (empuje/OH) · AGARRE (tirón/agarre) · CORE · IMPACTO (carrera/saltos) · SNC (neural alto) · GLUC (glucolítico) · AERO
var EST_BASE = [
  ['W17', 'HSPU estricto / facing', 'STRICT HSPU|FACING|DEFICIT STRICT|DÉFICIT STRICT', 'TÉCNICA', 'PM', 12, '🟢 Técnico', '4×3–5 strict HSPU (déficit si sale fácil) · RIR 2 · 2′ entre series', 'Fuerza estricta de empuje vertical: la base que luego aguanta el kipping en fatiga.', 'Técnica: línea cabeza-manos en trípode, codos a 45°. Fisiología: reclutamiento de unidades motoras de alto umbral en deltoides/tríceps con poco volumen. Biología: adaptación neural antes que hipertrófica.', 'Evitar el día de jerk/press pesado o con muchos HSPU en el metcon. No antes de anillas.', 'HOMBRO', 'HOMBRO', 'Reps por serie, déficit (cm) y RIR'],
  ['W15', 'HSPU kipping técnico', 'KIPPING HSPU', 'TÉCNICA', 'PM', 10, '🟢 Técnico', 'EMOM 8′: 3–5 kipping HSPU con reinicio controlado', 'Técnica de kipping fresca para que salga eficiente en el WOD.', 'Técnica: patada sincronizada con la extensión de codos. Fisiología: ciclo estiramiento-acortamiento del tren superior; poco coste metabólico si se corta antes de la fatiga.', 'No el mismo día que HSPU estricto pesado ni antes de jerk.', 'HOMBRO', 'HOMBRO', 'Reps por minuto y fallos'],
  ['W31', 'HSPU en fatiga', 'HSPU', 'TÉCNICA', 'PM', 0, '', '', '', '', '', 'HOMBRO GLUC', '', ''],
  ['W01', 'Z2 carrera · larga', 'Z2 LARGA', 'CARRERA', 'AM', 60, '🔵 Z2', '60′ continuos en Z2 (RPE 2–3, conversación). No acabar en tempo.', 'Base aeróbica: el rodaje largo es el estímulo más eficaz para mitocondrias y capilares.', 'Fisiología: volumen sostenido por debajo de VT1 aumenta densidad mitocondrial y capilarización con muy poca fatiga del SNC. Biología: señal AMPK/PGC-1α prolongada.', 'Aislada, idealmente 24 h sin pesas. Nunca el día después de pierna pesada ni antes de calidad.', 'IMPACTO AERO PIERNA', 'PIERNA SNC GLUC', 'km, tiempo, FC media, FC estable (min), sensaciones'],
  ['W02', 'Z2 carrera · corta', 'Z2 CORTA|ZONA 2', 'CARRERA', 'AM', 35, '🔵 Z2', '35′ continuos en Z2 (RPE 2–3)', 'Completa los 90′ semanales de Z2 sin fatiga.', 'Fisiología: estímulo aeróbico de baja intensidad, poca interferencia con la fuerza (vía mTOR intacta si hay >6 h).', 'AM, mejor antes del día de volumen de Fabrik; ≥6 h antes de pierna pesada.', 'IMPACTO AERO', 'SNC', 'km, tiempo, FC media'],
  ['W03', 'Ergómetro Z2', 'Z2 (BIKE|ROW|SKI)|ERG · AER', 'CARRERA', 'AM|PM', 25, '🔵 Z2', '20–30′ BikeErg/remo/ski en Z2', 'Volumen aeróbico sin impacto: suma Z2 cuidando tendones.', 'Fisiología: mismo estímulo central que la carrera (gasto cardiaco, mitocondria) con carga excéntrica casi nula.', 'Ideal como flush el día de pierna pesada o tras la sesión.', 'AERO', '', 'Aparato, minutos, ritmo/500 m o W'],
  ['W04', 'Calidad carrera (Z4/Z5)', 'CALIDAD', 'CARRERA', 'AM', 40, '🟠 Calidad', 'Ver plan de carrera de la semana', 'La sesión que mueve el umbral/VO₂max.', 'Fisiología: tiempo cerca de VT2/VO₂max eleva el umbral de lactato y el VO₂max. Biología: estrés que exige ≥48 h hasta la siguiente sesión dura.', '≥48 h de Z6–Z8. PM ese día: tren superior. Nunca tras pierna pesada.', 'IMPACTO SNC GLUC PIERNA', 'PIERNA SNC GLUC', 'Parciales, RPE, FC media y si cumpliste los ritmos'],
  ['R04', 'Z6–Z8 integrado (competición)', 'Z6.?Z8 INTEGRADO', 'Z6–Z8', 'PM', 25, '🔴 Z6–Z8', '2.ª sesión Z6–Z8 de la semana (P1/P4) con 2 movimientos de competición + calorías: la genera «Cargar extras» según lo que más falte.', 'Potencia en fatiga con enfoque de competición.', 'Fisiología: H⁺ y aclarado de lactato (MCT1/MCT4); adaptaciones centrales y periféricas.', '≥48 h de la calidad y del otro Z6–Z8; al día siguiente, suave.', 'GLUC SNC', 'GLUC', 'rondas o reps por minuto, calorías, tiempo de cada ronda, RPE'],
  ['C01', 'Double unders en fatiga', 'DOUBLE UNDER|(^|[^A-Z])DUS?([^A-Z]|$)', 'EXTRA', 'PM', 8, '🟠 Fatiga', '3 rondas: 12/10 cal bike + 40 DU sin fallo · 1′ entre rondas', 'DU limpios con pulsaciones altas, como en competición.', 'Técnica: muñeca relajada, salto bajo. Fisiología: coordinación bajo fatiga cardiorrespiratoria.', 'Suma impacto de gemelo/Aquiles.', 'IMPACTO GLUC', 'IMPACTO', 'DU por tanda, fallos'],
  ['C02', 'Front squat en metcon / fatiga', 'FRONT SQUAT', 'EXTRA', 'PM', 10, '🟠 Fatiga', 'EMOM 8′: 6 front squat (60/40) + 8/6 cal row', 'Front squat estable con pulsaciones altas (thrusters, cleans en metcon).', 'Técnica: codos altos y torso vertical. Fisiología: resistencia de cuádriceps y core en acidez.', 'No antes de pierna pesada ni de calidad de carrera.', 'PIERNA GLUC', 'PIERNA', 'kg, reps, RPE'],
  ['C03', 'Burpees a ritmo de competición', 'BURPEE', 'EXTRA', 'PM', 8, '🟠 Fatiga', 'EMOM 8′: 8 burpees over the bar + 6 cal ski', 'Ritmo de burpee sostenible en competición.', 'Fisiología: coste metabólico alto con movimiento de todo el cuerpo; economía de gesto.', '—', 'GLUC', '', 'reps por minuto'],
  ['C04', 'Snatch / clean desde colgado en fatiga', 'HANG (POWER |SQUAT )?(SNATCH|CLEAN)|HIGH HANG', 'EXTRA', 'PM', 10, '🟠 Fatiga', 'EMOM 8′: impar 5 hang power snatch (50/35) · par 12/10 cal bike', 'Barra eficiente desde colgado con fatiga (formato habitual de competición).', 'Técnica: barra cerca y recepción rápida. Fisiología: potencia repetida con aclarado entre minutos.', 'No antes de haltero pesado.', 'AGARRE GLUC SNC', 'AGARRE', 'kg, reps, velocidad'],
  ['V01', 'Sprints de velocidad', '[0-9]{2,3} ?M SPRINT|SPRINT [0-9]{2,3} ?M|FLYING [0-9]|ACELERACI|ACCELERATION|MAX VELOCITY|VELOCIDAD MAX', 'CARRERA', 'AM|PM', 20, '🔴 Velocidad', '10′ trote suave + movilidad dinámica\nTécnica: 2×20 m A-skip · 2×20 m B-skip · 2×20 m skipping rápido\n3 progresivos de 60 m (70–80–90 %)\n\n6 × 30 m SPRINT al 95–100 % (4 salidas de pie + 2 lanzadas con 20 m de carrerilla)\n/ 2′30″–3′ andando (recuperación completa)\n\n5′ trote suave\n\nREGLA: si la velocidad cae o notas el isquio, se corta. Nunca hasta el agotamiento.', 'Velocidad máxima y aceleración: sube tu techo de velocidad, así los ritmos de 2 km y 10 km y los sprints de HYROX o de un WOD te cuestan un % menor de tu máximo.', 'Técnica: apoyo bajo la cadera, rodilla alta y brazos activos. Fisiología: esfuerzos de 4–8″ alimentados por ATP-fosfocreatina; con 2–4′ de pausa la fosfocreatina se recupera casi entera y cada repetición sale a velocidad máxima (no es RSA). Biología: adaptación neural, más rigidez del tendón y mejor economía de carrera, con muy poca fatiga metabólica.', 'Siempre fresco y bien calentado: al inicio de la sesión o tras la Z2 corta. Nunca después de un metcon, de pierna pesada ni la víspera de la calidad de carrera. Riesgo principal: isquios.', 'IMPACTO PIERNA SNC', 'GLUC PIERNA', 'distancias, tiempos (o velocidad percibida 1–10), superficie, molestias'],
  ['R01', 'Potencia Z6–Z8', 'ALL[- ]OUT|(?<![0-9] ?M )SPRINT(?! [0-9]{2,3} ?M)|Z6|Z7|Z8', 'Z6–Z8', 'PM', 20, '🔴 Z6–Z8', 'Protocolo de la semana (plan de carrera)', 'Potencia y tolerancia a esfuerzos máximos cortos.', 'Fisiología: sistema fosfágeno y glucólisis rápida, reclutamiento máximo. Biología: alto coste neural; necesita recuperación completa entre reps.', '≥48 h de la calidad de carrera. Tras fuerza de cadena posterior/haltero o PM a ≥6 h de la Z2.', 'SNC GLUC', 'SNC GLUC', 'W pico y media por sprint, caída 1º→último'],
  ['W13', 'RMU técnica / fuerza estricta', 'RING MUSCLE|RMU', 'TÉCNICA', 'AM', 12, '🟢 Técnico', 'EMOM 8′: 1–2 strict RMU o transición en banda + 2 dips en anillas', 'Calidad en anillas antes de la fatiga.', 'Técnica: falso agarre y transición rápida. Fisiología: fuerza relativa de dorsal/pecho/tríceps a baja dosis.', 'Anillas por la mañana si es EXTRA y ≥6 h de otros tirones.', 'AGARRE HOMBRO', 'AGARRE', 'Reps, variante y calidad'],
  ['W32', 'HSW · pirueta / free HSPU', 'HSWALK|HANDSTAND WALK|PIROUET|PIRUETA|FREESTANDING', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '8–10′: 4–6 intentos de HSW 10 m + 3 piruetas por lado', 'Equilibrio invertido: volumen corto y frecuente.', 'Técnica: control de muñeca y línea. Biología: aprendizaje motor por práctica distribuida (más sesiones cortas > una larga).', 'Fresco; antes del metcon o en día de skills.', 'HOMBRO', '', 'Metros sin caer, intentos'],
  ['W33', 'Pino estático', 'HANDSTAND HOLD|PINO|WALL FACING HOLD', 'TÉCNICA', 'PM', 8, '🟢 Técnico', '5×20–30″ pino libre o asistido / 60″', 'Línea corporal y control escapular.', 'Fisiología: isometría de baja intensidad, propiocepción de muñeca y escápula.', 'Puede ir dentro de otro bloque de HSW.', 'HOMBRO', '', 'Segundos por intento, variante'],
  ['W20', 'Snatch balance >85 %', 'SNATCH BALANCE', 'TÉCNICA', 'PM', 12, '🟠 Técnico pesado', '5×2 snatch balance al 87–90 % del 1RM de snatch · 2′', 'Recepción rápida y estable con carga real.', 'Técnica: velocidad de caída bajo la barra. Fisiología: estabilidad OH con alta carga. Por debajo del 85 % no cuenta para la meta.', 'No el día de jerk pesado; nunca tras HSPU en fatiga.', 'HOMBRO PIERNA SNC', 'HOMBRO', '% exacto del 1RM de snatch, series y reps'],
  ['W23', 'Split jerk técnico', 'SPLIT JERK', 'TÉCNICA', 'PM', 12, '🟢 Técnico', 'EMOM 8′: 1 split jerk al 70–75 % + 2″ en recepción', 'Un objetivo de entrada o bloqueo con descanso.', 'Técnica: drive vertical y pie trasero activo. Biología: patrón motor estable a carga submáxima.', 'No el día de HSPU pesado.', 'HOMBRO SNC', 'HOMBRO', 'Kg y objetivo técnico'],
  ['W10', 'Movilidad / control escapular', 'ESCAPULAR|SCAPULAR|T-OPENER|WALL SLIDE|CUBAN|PASS-THROUGH|SHOULDER', 'MOVILIDAD', 'PM', 8, '🟢 Movilidad', '2 vueltas: 10 wall slides + 10 scap pull-ups + 8 Cuban press ligero', 'Hombro sano para HSPU, anillas y OH.', 'Fisiología: activación de trapecio inferior y serrato; mejora el ritmo escapulohumeral.', 'Sin interferencias: mejor dentro del calentamiento.', '', '', 'Una vez por sesión'],
  ['W07', 'Pliometría + contraste', 'BOX JUMP|POGO|BROAD JUMP|SQUAT JUMP|COUNTERMOVEMENT|DEPTH JUMP|JUMP SHRUG', 'TÉCNICA', 'PM', 12, '🟠 Potencia', '4×5 box jump + 3×5 broad jump con aterrizaje 2″ (≈50 saltos)', 'Potencia y absorción: 100–200 saltos de calidad por semana.', 'Fisiología: ciclo estiramiento-acortamiento y rigidez tendinosa. Biología: adaptación del tendón con dosis bajas y descansos completos.', 'Antes de pierna pesada o haltero, nunca después. Cuenta el impacto de la carrera.', 'IMPACTO SNC PIERNA', 'IMPACTO', 'Nº de saltos (CANTIDAD)'],
  ['M17', 'Jerk drive pesado en fatiga', 'JERK DRIVE|DIP DRIVE', 'EXTRA', 'PM', 10, '🟠 Fatiga específica', '3×(8 cal row + 3 jerk drive al 90 %)', 'Potencia de piernas al empujar con pulsaciones altas.', 'Fisiología: producción de fuerza con acidosis moderada.', 'Lejos de HSPU estricto.', 'HOMBRO PIERNA GLUC', 'HOMBRO', 'Kg y tiempos'],
  ['M01', 'C2B en fatiga', 'CHEST TO BAR|C2B', 'EXTRA', 'PM', 0, '', '', '', '', '', 'AGARRE GLUC', '', ''],
  ['M49', 'RMU en fatiga', 'RING MUSCLE|RMU', 'EXTRA', 'PM', 10, '🟠 Fatiga específica', 'EMOM 8′: impar 10 cal bike · par 2–3 RMU', 'RMU con pulsaciones altas.', 'Fisiología: mantener la técnica de anillas con acidosis.', 'No con otro trabajo de tirón pesado.', 'AGARRE HOMBRO GLUC', 'AGARRE', 'Reps por ronda'],
  ['M48', 'BMU en fatiga', 'BAR MUSCLE|BMU', 'EXTRA', 'PM', 10, '🟠 Fatiga específica', 'EMOM 8′: impar 12 wall ball · par 3–4 BMU', 'BMU en fatiga sin romper la técnica.', 'Fisiología: tirón explosivo con acidosis.', 'No con RMU en fatiga el mismo día.', 'AGARRE HOMBRO GLUC', 'AGARRE', 'Reps por ronda'],
  ['M05', 'T&G snatch', 'TOUCH AND GO|T&G|TOUCH N GO', 'EXTRA', 'PM', 10, '🟠 Cycling', '5×5 power snatch T&G al 55–60 % · 90″', 'Ciclar la barra con eficiencia.', 'Técnica: rebote controlado y barra cerca.', 'No tras snatch pesado.', 'HOMBRO AGARRE', '', 'Kg y tandas'],
  ['M07', 'T&G STOH', 'STOH|SHOULDER TO OVERHEAD|PUSH JERK', 'EXTRA', 'PM', 10, '🟠 Cycling', '5×6 STOH T&G al 60 % · 90″', 'Ciclar el OH sin perder el drive.', 'Técnica: dip-drive reactivo.', 'No el día de HSPU pesado.', 'HOMBRO', 'HOMBRO', 'Kg y tandas'],
  ['M31', 'Pullovers', 'PULLOVER|PULL OVER', 'TÉCNICA', 'PM', 8, '🟢 Técnico', '4×3–5 pullovers enlazados · 90″', 'Fluidez en barra.', 'Técnica: hollow-arch y cadera a la barra.', 'Lejos del agarre fatigado.', 'AGARRE CORE', '', 'Reps enlazadas'],
  ['T01', 'Thruster barra pesada', 'THRUSTER', 'EXTRA', 'PM', 10, '🟠 Fuerza-resistencia', '5×3 thruster al 75–80 % del front squat · 2′', 'Perfil pesado de thruster.', 'Fisiología: fuerza de pierna + empuje con poco volumen.', 'No el día de pierna pesada.', 'PIERNA HOMBRO', 'PIERNA', 'Kg, reps y tanda mayor'],
  ['T02', 'Thruster ligero / volumen', 'THRUSTER', 'EXTRA', 'PM', 10, '🟠 Volumen', '3×15 thruster 40/30 + 30 DU · 2′', 'Volumen específico de thruster.', 'Fisiología: resistencia local de cuádriceps y hombro.', 'Separado de otras pierna-pesada.', 'PIERNA HOMBRO GLUC', 'PIERNA', 'Kg, reps y tanda mayor'],
  ['T03', 'Thruster DB ≥30 kg', 'DB THRUSTER|DUAL DB THRUSTER', 'EXTRA', 'PM', 10, '🟠 Fuerza-resistencia', '4×8 dual DB thruster 2×30 kg · 2′', 'Thruster con mancuernas pesadas.', 'Fisiología: estabilidad unilateral bajo carga.', 'No el día de pierna pesada.', 'PIERNA HOMBRO', 'PIERNA', 'Kg y reps'],
  ['M44', 'OHS doble mancuerna', 'DUAL DB OVERHEAD SQUAT|DOUBLE DB OHS|2 DB OHS', 'TÉCNICA', 'PM', 8, '🟢 Estabilidad', '4×6 OHS con 2 DB · 90″', 'Estabilidad OH con dos mancuernas.', 'Fisiología: control escapular bilateral independiente.', 'No tras HSPU en fatiga.', 'HOMBRO PIERNA', 'HOMBRO', 'Kg por DB'],
  ['M58', 'OH una mancuerna', 'SINGLE[- ]ARM (DB )?OVERHEAD|SINGLE ARM OH|WAITER', 'TÉCNICA', 'PM', 8, '🟢 Estabilidad', '3×(6+6 single-arm DB OHS + 20 m waiter walk por brazo)', 'Antirrotación y escápula con una DB.', 'Fisiología: core antirrotación y estabilidad glenohumeral.', 'No tras HSPU en fatiga.', 'HOMBRO CORE', 'HOMBRO', 'Kg y reps por lado'],
  ['M13', 'OH lunges', 'OVERHEAD LUNGE|OH LUNGE|OH WALKING LUNGE', 'EXTRA', 'PM', 8, '🟢 Calidad', '3×10 m OH walking lunge (barra o DB)', 'Pierna unilateral con estabilidad OH.', 'Fisiología: control lumbopélvico y escapular simultáneo.', 'No el día de pierna pesada.', 'PIERNA HOMBRO', 'PIERNA', 'Material, kg y metros'],
  ['M45', 'Sentadilla búlgara', 'BULGAR|SPLIT SQUAT', 'EXTRA', 'PM', 10, '🟢 Calidad', '3×8+8 búlgara con DB · 90″', 'Fuerza unilateral y simetría.', 'Fisiología: glúteo medio y cuádriceps con baja carga axial.', 'No el día antes de calidad de carrera.', 'PIERNA', 'PIERNA', 'Kg y reps por pierna'],
  ['M46', 'Plancha Copenhague', 'COPENHAG', 'EXTRA', 'PM', 6, '🟢 Calidad', '3×20–30″ por lado', 'Aductores fuertes protegen ingle y rodilla en carrera.', 'Fisiología: isometría de aductores; reduce el riesgo de lesión inguinal.', 'Sin interferencias relevantes.', 'CORE', '', 'Segundos por lado y palanca'],
  ['M19', 'Pistols · técnica y accesorios', 'PISTOL', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '4×4+4 pistols a cajón bajo + 2×20″ isometría abajo por pierna', 'Fuerza y control unilateral en rango completo.', 'Técnica: tobillo y cadera en rango. Fisiología: fuerza excéntrica del cuádriceps.', 'No antes de calidad de carrera.', 'PIERNA', 'PIERNA', 'Variante y reps por pierna'],
  ['M47', 'Peso muerto agarre snatch', 'SNATCH GRIP DEADLIFT|SNATCH DEADLIFT|SG DL', 'EXTRA', 'PM', 10, '🟠 Fuerza', '4×4 snatch-grip DL al 80–85 % del snatch DL · 2′', 'Primer tirón fuerte con agarre real.', 'Fisiología: cadena posterior y dorsal con agarre ancho.', 'No antes de la Z2 larga ni de calidad.', 'PIERNA AGARRE', 'PIERNA', 'Kg y reps'],
  ['M28', 'Hip thrust', 'HIP THRUST', 'EXTRA', 'PM', 8, '🟢 Calidad', '3×8 hip thrust RPE 7–8', 'Extensión de cadera para correr y tirar.', 'Fisiología: glúteo mayor en acortamiento con poca carga axial.', 'Sin interferencias relevantes.', 'PIERNA', '', 'Kg y reps'],
  ['M08', 'Core específico', 'PALLOF|DEAD BUG|BIRD DOG|HOLLOW|AB WHEEL|SIDE PLANK|L-SIT|ROLLOUT', 'EXTRA', 'PM', 8, '🟢 Calidad', '3×(8 dead bug lento + 20″ hollow)', 'Control del tronco para transmitir fuerza.', 'Fisiología: antiextensión/antirrotación; mejora la rigidez del tronco.', 'Sin interferencias relevantes.', 'CORE', '', 'Variante y segundos'],
  ['M36', 'Rope climb', 'ROPE CLIMB|LEGLESS|WALL CLIMB', 'EXTRA', 'AM', 10, '🟢 Técnico', 'EMOM 8′: 1 rope climb (técnica de pies)', 'Técnica de cuerda fresca.', 'Fisiología: agarre y tirón con poco coste si la técnica es buena.', 'Por la mañana y ≥6 h de otros tirones.', 'AGARRE', 'AGARRE', 'Subidas y técnica'],
  ['M38', 'Trineo', 'SLED|TRINEO', 'EXTRA', 'PM', 12, '🟠 HYROX', '6×15 m push + 6×15 m pull · 90″', 'Técnica y economía de trineo (HYROX).', 'Fisiología: fuerza concéntrica de pierna sin excéntrica: muy poca agujeta.', 'Encaja tras la carrera o el día de pierna ligera.', 'PIERNA', '', 'Kg y tiempo por tramo'],
  ['M33', 'Heavy rope jumps', 'HEAVY ROPE', 'EXTRA', 'PM', 6, '🟢 Calidad', '5×30″ heavy rope / 30″', 'Hombro y gemelo con comba pesada.', 'Fisiología: resistencia de antebrazo y hombro con impacto bajo.', 'Mejor dentro de un bloque de thrusters o Z6–Z8.', 'IMPACTO HOMBRO', '', 'Dosis y contexto'],
  ['M35', 'Triple unders', 'TRIPLE UNDER', 'TÉCNICA', 'PM', 6, '🟢 Técnico', '6–8 intentos de 3–5 triple unders · descanso completo', 'Técnica de triples sin fatiga.', 'Técnica: muñeca y altura del salto.', 'Sin fatiga previa de gemelo.', 'IMPACTO', '', 'Intentos y reps'],
  ['M32', 'Doble crossover', 'CROSSOVER|CROSS OVER', 'TÉCNICA', 'PM', 6, '🟢 Técnico', '6×20″ intentos de double crossover', 'Coordinación de comba avanzada.', 'Técnica: cruce amplio y salto alto.', 'Sin fatiga previa de gemelo.', 'IMPACTO', '', 'Reps y contexto'],
  ['M10', 'Chaos snatch', 'CHAOS SNATCH|BANDED SNATCH', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '5×2 snatch con discos colgando de goma (carga manejable)', 'Estabilidad reactiva en recepción de snatch.', 'Fisiología: control propioceptivo con inestabilidad.', 'No tras snatch pesado.', 'HOMBRO', '', 'Variante y carga'],
  ['M11', 'Chaos split jerk', 'CHAOS (SPLIT )?JERK', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '5×2 split jerk con discos colgando · 2″ en recepción', 'Estabilidad reactiva en split.', 'Fisiología: control propioceptivo del hombro y la pelvis.', 'No el día de HSPU pesado.', 'HOMBRO', '', 'Variante y carga'],
  ['M50', 'Hold OH pesado · snatch', 'OVERHEAD HOLD|OH HOLD|SOTS|ISOMETRIC OVERHEAD', 'TÉCNICA', 'PM', 8, '🟠 Estabilidad', '4×10″ hold en recepción de snatch al 100–110 % del snatch (desde rack con seguros)', 'Confianza y estabilidad con carga supramáxima.', 'Fisiología: estímulo isométrico supramáximo del complejo escapular.', 'No tras HSPU ni jerk pesado.', 'HOMBRO SNC', 'HOMBRO', 'Kg, segundos y posición'],
  ['M51', 'Hold OH pesado · split', 'SPLIT HOLD|JERK RECOVERY|JERK HOLD', 'TÉCNICA', 'PM', 8, '🟠 Estabilidad', '4×10″ hold en split al 100–110 % del jerk desde rack', 'Estabilidad en recepción de split.', 'Fisiología: isometría supramáxima.', 'No tras HSPU ni jerk pesado.', 'HOMBRO SNC', 'HOMBRO', 'Kg, segundos y piernas'],
  ['M52', 'Contraste francés', 'CONTRASTE|FRENCH CONTRAST', 'EXTRA', 'PM', 15, '🟠 Potencia', '3×(2 back squat 85 % + 3 box jump + 3 KB jump squat ligero + 3 saltos asistidos) · 3′', 'Potencia: fuerza pesada seguida de saltos.', 'Fisiología: potenciación post-activación (PAP) y transferencia de fuerza a velocidad.', 'Fresco; no antes de calidad de carrera.', 'PIERNA SNC IMPACTO', 'PIERNA SNC', 'Los cuatro componentes, dosis y descansos'],
  ['M53', 'Accesorios de press · apoyo HSPU', 'Z PRESS|DB PRESS|STRICT PRESS|SEATED PRESS|DIP', 'EXTRA', 'PM', 10, '🟢 Calidad', '3×8 Z-press DB + 3×10 dips en anillas · RIR 2', 'Empuje accesorio para la carencia de HSPU.', 'Fisiología: hipertrofia moderada de deltoides y tríceps.', 'No el día antes de HSPU pesado.', 'HOMBRO', 'HOMBRO', 'Kg y reps'],
  ['M54', 'Sentadilla muchas repes / fatiga', 'AIR SQUAT|SENTADILLA', 'EXTRA', 'PM', 8, '🟠 Fatiga', '3×30 air squats rápidos / 1′ (o 3×20 goblet ligero)', 'Resistencia local de pierna.', 'Fisiología: tolerancia a la acidosis local.', 'No antes de la Z2 larga ni de calidad.', 'PIERNA GLUC', 'PIERNA', 'Variante, kg, reps y descansos'],
  ['M55', 'Press OH ligero / fatiga', 'PUSH PRESS|STRICT PRESS', 'EXTRA', 'PM', 8, '🟠 Fatiga', '3×15 push press 30/20 / 1′', 'Resistencia local del hombro.', 'Fisiología: tolerancia a la fatiga del deltoides.', 'No antes de HSPU estricto.', 'HOMBRO GLUC', 'HOMBRO', 'Kg, reps y descansos'],
  ['M56', 'Accesorios de pino', 'PLATE|LATERAL|SHOULDER TAP', 'TÉCNICA', 'PM', 8, '🟢 Técnico', '4×(3 subidas/bajadas a discos + 2 m laterales)', 'Ataca la carencia del pino.', 'Técnica: transferencia de peso entre manos.', 'Fresco.', 'HOMBRO', '', 'Variante, altura y reps'],
  ['M57', 'Sandbag / slamball', 'SANDBAG|SLAM ?BALL', 'EXTRA', 'PM', 8, '🟠 Integración', '4×(5 sandbag clean + 20 m bearhug carry)', 'Carga externa incómoda (competición).', 'Fisiología: fuerza de cadena posterior y core en posiciones no ideales.', 'No el día de pierna pesada.', 'PIERNA CORE AGARRE', '', 'Variante, kg y reps/metros']
];
function sembrarEstimulos_() {
  var ya = {}; listar_(HOJAS.ESTIMULOS).forEach(function (r) { ya[r['CÓDIGO']] = 1; });
  var cab = ESQUEMA['APP · ESTÍMULOS'].cab, filas = EST_BASE.filter(function (e) { return !ya[e[0]]; }).map(function (e) { return e.concat(['Sí']); });
  if (!filas.length) return 0;
  var sh = hojaMia_(HOJAS.ESTIMULOS), c2 = cabeceras_(sh);
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, filas.length, c2.length).setValues(filas.map(function (f) { var o = {}; cab.forEach(function (h, i) { o[h] = f[i]; }); return filaDe_(c2, o); }));
  return filas.length;
}
function catalogo_() {
  var out = {};
  var filas = listar_(HOJAS.ESTIMULOS);
  if (!filas.length) EST_BASE.forEach(function (e) { var o = {}; ESQUEMA['APP · ESTÍMULOS'].cab.forEach(function (h, i) { o[h] = e[i]; }); o.ACTIVO = 'Sí'; filas.push(o); });
  filas.forEach(function (r) { if (r['CÓDIGO'] && r.ACTIVO !== 'No') out[String(r['CÓDIGO']).trim().toUpperCase()] = r; });
  return out;
}
function reSeguro_(t) { try { return t ? new RegExp(norm(t)) : null; } catch (e) { return null; } }
function etiquetas_(t) { return norm(t).split(/[\s,|;]+/).filter(Boolean); }

// ---------- 2 · Lectura de cada bloque: qué estímulos cubre y qué fatiga genera ----------
var CARGA_RE = {
  PIERNA: /BACK SQUAT|FRONT SQUAT|DEADLIFT|SQUAT CLEAN|THRUSTER|LUNGE|BOX JUMP|WALL BALL|CLEAN|SNATCH|PISTOL|BULGAR|SANDBAG/,
  HOMBRO: /HSPU|JERK|PRESS|SNATCH|OVERHEAD|OHS|HSWALK|HANDSTAND|DIP|WALL BALL|DEVIL PRESS/,
  AGARRE: /PULL UP|PULL-UP|T2B|TOES TO|C2B|CHEST TO BAR|MUSCLE UP|ROPE|DEADLIFT|ROW\b|KB SWING|FARMER|HANG/,
  IMPACTO: /\bRUN\b|CARRERA|JUMP|DOUBLE UNDER|\bDU\b|BURPEE|SHUTTLE/,
  CORE: /T2B|TOES TO|GHD|L-SIT|HOLLOW|PLANK|PALLOF|AB WHEEL/
};
function cargasDe_(txt, rpe) {
  var t = bilingue_(txt), out = [];
  Object.keys(CARGA_RE).forEach(function (k) { if (CARGA_RE[k].test(t)) out.push(k); });
  var pcts = (t.match(/(\d{2,3})\s*%/g) || []).map(function (x) { return parseInt(x, 10); });
  if (pcts.some(function (p) { return p >= 85 && p <= 110; }) || /\(RIR 1|RIR 0|HEAVY/.test(t)) out.push('SNC');
  if (/METCON|AMRAP|FOR TIME|TIME CAP|EMOM|EVERY/.test(t) && (parseInt(String(rpe || '').replace(/\D/g, ''), 10) || 7) >= 7) out.push('GLUC');
  return out;
}
/** Códigos que cubre un texto (bloque de Fabrik o refuerzo), según DETECTAR del catálogo. En metcon solo cuentan los «en fatiga». */
var SOLO_METCON = { W31: 1, M01: 1, M49: 1, M48: 1 }, NUNCA_METCON = { W17: 1, W15: 1, W13: 1, W20: 1, W23: 1, W33: 1 };
function codigosTexto_(txt, cat, enMetcon) {
  var t = bilingue_(txt), out = [];
  Object.keys(cat).forEach(function (c) {
    if (/^(W0[1-4]|R0\d)$/.test(c)) return;                                 // carrera: solo la programada como carrera
    if (enMetcon && NUNCA_METCON[c]) return;
    if (!enMetcon && SOLO_METCON[c]) return;
    var re = reSeguro_(cat[c]['DETECTAR (regex)']);
    if (re && re.test(t)) out.push(c);
  });
  if (out.indexOf('W20') >= 0 && !(t.match(/(\d{2,3})\s*%/g) || []).some(function (x) { return parseInt(x, 10) > 85; })) out.splice(out.indexOf('W20'), 1);   // >85 % o no cuenta
  if (out.indexOf('T01') >= 0 && out.indexOf('T02') >= 0) out.splice(out.indexOf(enMetcon ? 'T01' : 'T02'), 1);
  return out;
}
/** Apartados de preparación (calentamiento, movilidad, activación, progresión de cargas): sus saltos no cuentan para la meta. */
var RE_PREP_ = /RANGO|MOVILIDAD|MOBILITY|ACTIVACI|ACTIVATION|WARM|CALENTAMIENTO|LOADING PROGRESSION|PROGRESION DE CARGAS|APROXIMACI/;
/**
 * Saltos de pliometría de un texto. Reglas:
 *  · líneas con JUMP / POGO / BOUND / HOP (no jumping jacks): «3X10», «4×5 … + 3×5 …» (suma todas), «18/15/12/9» (por set) o «10 box jumps».
 *  · comba doble (DOUBLE UNDER / DU): cuentan a 4 por salto (regla de Pablo: 4 DU = 1 salto).
 *  · si el texto dice «(≈50 saltos)» y no hay nada más, se toma ese número.
 *  · un número suelto dentro de «N SETS / RONDAS» se multiplica por N (las series AxB y las secuencias 18/15/12/9 ya son el total).
 *  · no cuentan los apartados de calentamiento / activación / movilidad ni las adaptaciones (solo los del trabajo principal y el metcon).
 */
function saltosTexto_(txt) {
  var n = 0, du = 0, t = norm(txt).replace(/×/g, 'X').split('\n').map(function (l) { return bilingue_(l).split('\n').pop(); }).join('\n');
  var reps = function (l) {
    var tot = 0, m, re = /(\d+)\s*X\s*(\d+)/g;
    while ((m = re.exec(l))) tot += +m[1] * +m[2];
    if (tot) return tot;
    var sq = l.match(/^\s*((?:\d+\s*\/\s*){2,}\d+)/); if (sq) return sq[1].split('/').reduce(function (a, x) { return a + (+x || 0); }, 0);   // 18/15/12/9 por set
    var r = l.match(/^\s*\+?\s*(\d+)\s/); return r ? +r[1] * (sets || 1) : 0;   // «24 DOUBLE UNDER» dentro de «4 SETS» = 96
  };
  var salta = false, sets = 0;   // dentro de un apartado de calentamiento / activación / adaptaciones: no cuenta (regla de Pablo, 03/11)
  t.split('\n').forEach(function (l, i) {
    var cab = /^\s*[A-Z](?:\.\d)?\s*(?:·|\))\s*\S/.test(l) || /^\s*ADAPTACIONES\s*:?\s*$/.test(l) || (/^[^\d]{3,40}:\s*$/.test(l.trim()));
    if (i === 0 || cab) {   // la 1.ª línea es el título del bloque: si es un calentamiento, todo el bloque lo es
      var esPrep = RE_PREP_.test(l) || /^\s*ADAPTACIONES/.test(l);
      if (cab || esPrep) { salta = esPrep; sets = 0; if (cab) return; }
    }
    if (salta) return;
    var ms = l.match(/(\d+)\s*(?:SETS?|RONDAS?|ROUNDS?)\b/);
    if (ms && !/JUMP|POGO|BOUND|HOP|DOUBLE UNDER|\bDUS?\b/.test(l)) { sets = +ms[1]; return; }
    if (/DOUBLE UNDER|\bDUS?\b/.test(l) && !/TRIPLE/.test(l)) { du += reps(l); return; }
    if (!/JUMP|POGO|BOUND|HOP/.test(l) || /JUMPING JACK|ROPE/.test(l)) return;
    n += reps(l);
  });
  if (!n && !du) { var ex = t.match(/(\d+)\s*SALTOS/); if (ex) n = +ex[1]; }
  return Math.round(n + du / 4);
}
/** Saltos de una fila del plan: CANTIDAD si la pusiste; si no, los que se leen en su contenido. */
function saltosDe_(r) {
  var c = parseFloat(String(r.CANTIDAD == null ? '' : r.CANTIDAD).replace(',', '.'));
  return c > 0 ? c : saltosTexto_((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || ''));
}
function textoBloque_(b) { return b.titulo + '\n' + (b.partes || []).map(function (p) { return p.etiqueta + '\n' + p.texto; }).join('\n'); }
function tipoBloque_(b) {
  var t = bilingue_(b.titulo + ' ' + (b.partes || []).map(function (p) { return p.etiqueta; }).join(' '));
  if (esMetconB_(b)) return 'metcon';
  if (/SNATCH|CLEAN|JERK|WEIGHTLIFTING|HALTERO/.test(t)) return 'haltero';
  if (/SQUAT|DEADLIFT|STRENG|STRONGMAN|BENCH|FUERZA/.test(t)) return 'fuerza';
  if (/GIMN|GYMNAST|HSPU|MUSCLE|LEGLESS|SKILL/.test(t)) return 'gimnasticos';
  if (/ACCES/.test(t)) return 'accesorios';
  return 'otro';
}
var CIENCIA_TIPO = {
  haltero: ['Técnica: velocidad del segundo tirón, barra cerca y recepción estable; los % mandan sobre la sensación. Fisiología: potencia (fuerza × velocidad) con reclutamiento de unidades motoras rápidas; con descansos amplios se trabaja el sistema fosfágeno. Biología: adaptación sobre todo neural (coordinación intermuscular, frecuencia de disparo), poca hipertrofia.', 'Antes de cualquier trabajo que fatigue hombro, agarre o pierna. La pliometría previa potencia (PAP); un metcon previo la estropea.'],
  fuerza: ['Técnica: trayectoria y bracing en cada repetición. Fisiología: fuerza máxima/submáxima; series cortas con intención de velocidad mejoran la tasa de desarrollo de fuerza. Biología: reclutamiento de alto umbral y, con más volumen, señal mTOR para hipertrofia.', 'Separar ≥6 h de la carrera de calidad y no hacerla el día antes de la Z2 larga; la carrera de baja intensidad >6 h antes apenas interfiere.'],
  gimnasticos: ['Técnica: control de la línea corporal y del ritmo. Fisiología: fuerza relativa (fuerza / peso corporal) de dorsal, deltoides y tríceps. Biología: la práctica frecuente con poca fatiga consolida el patrón motor.', 'El agarre y el hombro llegan tocados tras tirones o empujes pesados: mejor fresco o separado ≥6 h.'],
  metcon: ['Fisiología: esfuerzo mixto entre VT2 y VO₂max con componente glucolítico; la clave es el ritmo sostenible y las transiciones. Biología: estrés metabólico (lactato, H⁺) que mejora la capacidad tampón y la tolerancia a la fatiga; necesita 24–48 h para repetir algo igual de duro.', 'No meter calidad de carrera ni Z6–Z8 en las 24 h siguientes a un metcon de RPE ≥8. Los saltos y la carrera del WOD suman al impacto semanal.'],
  accesorios: ['Fisiología: volumen moderado lejos del fallo para fortalecer los eslabones débiles. Biología: adaptación de tejido (tendón, músculo) con baja fatiga del sistema nervioso.', 'Pocas interferencias si se respeta el RIR; no apurar al fallo antes de días técnicos.'],
  otro: ['', '']
};

// ---------- 3 · Cargar Fabrik en APP · PLAN (domingo 23:15, desde el menú del Sheet o desde la app) ----------
function idFabrik_(lunes, dia, n) { return 'F' + lunes.replace(/-/g, '').slice(2) + '-' + dia.slice(0, 3) + n; }
function cargarFabrikSemana_(lunes) {
  lunes = lunesDe_(lunes);
  var F = fabrikSemana_(lunes);
  if (!F.fabrik) return { ok: false, cargados: 0, motivo: 'Fabrik aún no ha subido la semana del ' + isoAFecha(lunes) };
  var cat = catalogo_(), n = 0, act = 0;
  bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN), porRef = {};
    plan.forEach(function (r) { var d = celdaIso_(r.FECHA); if (norm(r.ORIGEN) === 'FABRIK' && d >= lunes && d <= sumarDias(lunes, 6)) porRef[norm(r.FABRIK_REF).replace(/\s+/g, '')] = r; });
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh), nuevas = [];
    F.fabrik.dias.forEach(function (d) {
      d.bloques.forEach(function (b, k) {
        if (!b.n) return;
        var ref = d.nombre + '·' + b.n, txt = textoBloque_(b), met = esMetconB_(b), tipo = tipoBloque_(b);
        var cods = codigosTexto_(txt, cat, met), sal = saltosTexto_(b.titulo + '\n' + b.partes.filter(function (p) { return p.tipo === 'main'; }).map(function (p) { return p.etiqueta + '\n' + p.texto; }).join('\n'));
        if (sal && cods.indexOf('W07') < 0) cods.push('W07');
        var cien = CIENCIA_TIPO[tipo] || CIENCIA_TIPO.otro;
        var o = { 'TÍTULO': b.titulo, CONTENIDO: recortar(b.partes.filter(function (p) { return p.tipo !== 'adapt'; }).map(function (p) { return (p.etiqueta ? p.etiqueta + '\n' : '') + p.texto; }).join('\n\n')).slice(0, 4000),
          'CÓDIGOS': cods.join('|'), CANTIDAD: sal || '', INTENSIDAD: met ? (d.rpe ? 'RPE ' + d.rpe : '') : '' };
        var x = porRef[norm(ref)];
        if (x && /editado/.test(x.GENERADO || '')) return;   // lo editaste tú: tu versión manda
        if (x) {   // ya cargado: se respeta dónde lo pusiste; solo se refresca el contenido si Gabi lo ha cambiado
          if (x.CONTENIDO !== o.CONTENIDO || x['TÍTULO'] !== o['TÍTULO']) { actualizarFila_(HOJAS.PLAN, x._fila, Object.assign(o, { ACTUALIZADO: ahora_() })); act++; }
          else if (String(x.CANTIDAD == null ? '' : x.CANTIDAD) !== String(o.CANTIDAD)) { actualizarFila_(HOJAS.PLAN, x._fila, { CANTIDAD: o.CANTIDAD, 'CÓDIGOS': o['CÓDIGOS'], ACTUALIZADO: ahora_() }); act++; }   // recuento de saltos (v0.10.1)
          return;
        }
        nuevas.push(Object.assign(o, { ID: idFabrik_(lunes, d.nombre, b.n), FECHA: isoAFecha(d.iso), 'DÍA': diaDe_(d.iso), TURNO: 'PM', ORDEN: 50 + k, ORIGEN: 'FABRIK', FABRIK_REF: ref,
          BLOQUE: b.n + ': ' + b.titulo, 'POR QUÉ (cursiva)': recortar(String(b.nota || (b.wod && b.wod.objetivo) || '').split('\n\n')[0]).slice(0, 600),
          'CIENCIA (técnica · fisiología · biología)': cien[0], INTERFERENCIAS: cien[1], ESTADO: 'PROGRAMADO', GENERADO: 'fabrik ' + ahora_(), ACTUALIZADO: ahora_() }));
        n++;
      });
    });
    if (nuevas.length) sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, nuevas.length, cab.length).setValues(nuevas.map(function (o) { return filaDe_(cab, o); }));
  });
  if (n || act) interferenciasFabrik_(lunes);
  ponerConfig_('fabrik_cargado_' + lunes, ahora_() + ' · ' + n + ' bloques nuevos · ' + act + ' actualizados', 'Carga de Fabrik en APP · PLAN');
  return { ok: true, cargados: n, actualizados: act };
}
/** Tarea del domingo 23:15: carga la semana que empieza mañana. */
function cargarFabrikDomingo() {
  var r = cargarFabrikSemana_(sumarDias(lunesDe_(hoyIso_()), 7));
  Logger.log('Fabrik → PLAN: ' + JSON.stringify(r));
  if (r.ok && pushActivo_()) enviarPush_('Fabrik cargado', r.cargados + ' bloques en tu plan. Ya puedes «Cargar extras».');
}
/** Interferencias de cada bloque de Fabrik con el día anterior y el siguiente (se reescriben al cargar o generar). */
function interferenciasFabrik_(lunes) {
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= sumarDias(lunes, -1) && d <= sumarDias(lunes, 7) && !/NO HACER|SUSTITUIDO/.test(r.ESTADO); });
  var cargasDia = {};
  plan.forEach(function (r) { var d = celdaIso_(r.FECHA); cargasDia[d] = (cargasDia[d] || []).concat(cargasDe_(r['TÍTULO'] + '\n' + r.CONTENIDO, r.INTENSIDAD)).concat(/R0[123]|W04/.test(r['CÓDIGOS']) ? ['CALIDAD'] : []); });
  plan.forEach(function (r) {
    if (norm(r.ORIGEN) !== 'FABRIK' || celdaIso_(r.FECHA) < lunes || celdaIso_(r.FECHA) > sumarDias(lunes, 6)) return;
    var d = celdaIso_(r.FECHA), mi = cargasDe_(r['TÍTULO'] + '\n' + r.CONTENIDO, r.INTENSIDAD), extra = [];
    var ant = cargasDia[sumarDias(d, -1)] || [], sig = cargasDia[sumarDias(d, 1)] || [];
    if (mi.indexOf('PIERNA') >= 0 && sig.indexOf('CALIDAD') >= 0) extra.push('Mañana hay calidad de carrera: sin fallo en pierna, deja 1–2 RIR.');
    if (mi.indexOf('HOMBRO') >= 0 && ant.indexOf('HOMBRO') >= 0) extra.push('Ayer ya hubo empuje/OH: calienta bien el hombro y respeta los %.');
    if (mi.indexOf('AGARRE') >= 0 && ant.indexOf('AGARRE') >= 0) extra.push('Agarre cargado del día anterior: tiza y tandas cortas.');
    if (ant.indexOf('CALIDAD') >= 0 && mi.indexOf('PIERNA') >= 0) extra.push('Ayer fue la calidad de carrera: la pierna puede llegar con menos chispa.');
    var base = (CIENCIA_TIPO[tipoBloque_({ titulo: r['TÍTULO'], partes: [{ etiqueta: '', texto: r.CONTENIDO }] })] || CIENCIA_TIPO.otro)[1];
    var txt = [base].concat(extra).filter(Boolean).join(' ');
    if (txt !== r.INTERFERENCIAS) actualizarFila_(HOJAS.PLAN, r._fila, { INTERFERENCIAS: txt });
  });
}

// ---------- 4 · Motor de colocación: «posición óptima» de un bloque ----------
/** Contexto de la semana: cargas por día y turno, minutos, sesiones duras, dobles y descansos. */
function contextoSemana_(lunes, excluirId, excluirFn) {
  var conf = filaSemana_(lunes) || {}, dob = String(conf['DOBLES (mañanas libres)'] || ''), des = String(conf.DESCANSO || '');
  var CORTO = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
  var dias = [];
  for (var i = 0; i < 7; i++) {
    var iso = sumarDias(lunes, i);
    dias.push({ i: i, iso: iso, am: norm(dob).indexOf(CORTO[i]) >= 0, descanso: norm(des).indexOf(CORTO[i]) >= 0, cargas: { AM: [], PM: [] }, min: { AM: 0, PM: 0 }, nExtra: { AM: 0, PM: 0 }, duro: false, codigos: [], fabrik: false, antes: false, despues: false, rpe: 0 });
  }
  var porIso = {}; dias.forEach(function (d) { porIso[d.iso] = d; });
  var F = fabrikSemana_(lunes).fabrik;
  (F ? F.dias : []).forEach(function (fd) { var d = porIso[fd.iso]; if (d) { d.rpe = parseInt(String(fd.rpe || '').replace(/\D/g, ''), 10) || 0; d.fabrikRpe = fd.rpe; } });
  listar_(HOJAS.PLAN).forEach(function (r) {
    var d = porIso[celdaIso_(r.FECHA)]; if (!d || r.ID === excluirId || /NO HACER|SUSTITUIDO|SIN HUECO|^PROPUESTA$/.test(r.ESTADO) || (excluirFn && excluirFn(r))) return;
    if (norm(r.ORIGEN) !== 'FABRIK') d.fijos = (d.fijos || []).concat(codigosDe_(r['CÓDIGOS']));
    var t = norm(r.TURNO) === 'AM' ? 'AM' : 'PM', min = parseFloat(String(r.MIN).replace(',', '.')) || (norm(r.ORIGEN) === 'FABRIK' ? 20 : 10);
    if (norm(r.ORIGEN) === 'FABRIK') d.fabrik = true;
    d.cargas[t] = d.cargas[t].concat(cargasDe_(r['TÍTULO'] + '\n' + r.CONTENIDO, r.INTENSIDAD || d.fabrikRpe));
    d.min[t] += min; d.codigos = d.codigos.concat(codigosDe_(r['CÓDIGOS'])); if (norm(r.ORIGEN) !== 'FABRIK') d.nExtra[t]++;
    if (t === 'AM') { var cAM = codigosDe_(r['CÓDIGOS']); d.codigosAM = (d.codigosAM || []).concat(cAM); if (cAM.some(function (c) { return /^(W01|W02|W04)$/.test(c); })) d.minCarreraAM = (d.minCarreraAM || 0) + min;
      else if (!cAM.some(function (c) { return /^W0[123]$/.test(c); })) d.nExtraAMcal = (d.nExtraAMcal || 0) + 1; }
    if (/R01|R02|R03|R04|W04/.test(r['CÓDIGOS'])) d.duro = true;
  });
  eventosEntre_(sumarDias(lunes, -3), sumarDias(lunes, 10)).forEach(function (e) {
    var i0 = celdaIso_(e.INICIO), f0 = celdaIso_(e.FIN) || i0, an = +e['ANTES (días bajar volumen)'] || 0, de = +e['DESPUÉS (días recuperación)'] || 0;
    dias.forEach(function (d) {
      if (d.iso >= i0 && d.iso <= f0) { if (/Día completo/.test(e.BLOQUEA)) d.descanso = true; if (/Mañana/.test(e.BLOQUEA)) d.am = false; if (/Tarde/.test(e.BLOQUEA)) d.bloqPM = true; if (/^Test/i.test(e.EVENTO)) d.semanaTest = true; }
      if (an && d.iso < i0 && d.iso >= sumarDias(i0, -an)) d.antes = true;
      if (de && d.iso > f0 && d.iso <= sumarDias(f0, de)) d.despues = true;
    });
  });
  return { lunes: lunes, dias: dias, conf: conf, modoAM: enduranceManana_() };
}
/** Puntúa colocar un bloque (cand = {codigos, carga[], evitar[], min, turno, duro}) en cada hueco. Menor = mejor. */
function puntuarHuecos_(cand, ctx, todo) {
  var out = [], libre = cand.codigos.some(function (c) { return LIBRES_TURNO.test(c); });
  var enduAM = ctx.modoAM && cand.codigos.some(function (c) { return /^W0[123]$/.test(c); }) && !cand.codigos.some(function (c) { return /^(R01|W04)$/.test(c); });
  ctx.dias.forEach(function (d, i) {
    ['AM', 'PM'].forEach(function (t) {
      var motivos = [], p = 0, malos = [];
      // todo = true: se puntúa también lo no disponible (para enseñarte qué pasa donde TÚ lo pones)
      if (d.descanso) { if (!todo) return; p += 8; malos.push('es tu día de descanso'); }
      if (t === 'AM' && !d.am) { if (!todo) return; p += 6; malos.push('esa mañana no la tienes libre'); }
      if (t === 'PM' && d.bloqPM) { if (!todo) return; p += 8; malos.push('la tarde está bloqueada por un evento'); }
      if (enduAM && t === 'PM') { if (!todo) return; p += 6; malos.push('«Endurance de mañana» activo: la Z2 debería ir por la mañana'); }
      if (!libre && cand.turno && cand.turno !== 'AM|PM' && cand.turno.indexOf(t) < 0) { p += 3; malos.push('prefiere ' + cand.turno); }
      if (ctx.modoAM && t === 'AM') {
        var amC = d.codigosAM || [], z2 = function (l) { return l.some(function (c) { return /^W0[123]$/.test(c); }) && !l.some(function (c) { return /^(R01|W04)$/.test(c); }); };
        if (z2(cand.codigos) && z2(amC)) { if (!todo) return; p += 8; malos.push('ya hay una sesión de Z2 esa mañana (solo una por mañana)'); }
        var carreraAM = amC.concat(cand.codigos).some(function (c) { return /^(W01|W02|W04)$/.test(c); }) && !amC.concat(cand.codigos).every(function (c) { return c === 'W03'; });
        var base = d.minCarreraAM || (cand.codigos.some(function (c) { return /^(W01|W02|W04)$/.test(c); }) ? cand.min : 0);
        var topeAM = carreraAM ? Math.max(45, base + 15) : 45, totAM = d.min.AM + (cand.min || 10);
        if (totAM > topeAM) { if (!todo) return; p += 6; malos.push('la sesión de la mañana pasaría de ' + topeAM + '′'); }
        if (!z2(cand.codigos) && d.nExtraAMcal >= 1) { if (!todo) return; p += 5; malos.push('esa mañana ya lleva su extra de calidad'); }
      }
      var hoy = d.cargas.AM.concat(d.cargas.PM), ant = i ? ctx.dias[i - 1].cargas.AM.concat(ctx.dias[i - 1].cargas.PM) : [], sig = i < 6 ? ctx.dias[i + 1].cargas.AM.concat(ctx.dias[i + 1].cargas.PM) : [];
      (cand.evitar || []).forEach(function (e) {
        if (hoy.indexOf(e) >= 0) { p += 4; malos.push('ese día Fabrik ya carga ' + e.toLowerCase()); }
        else if (cand.duro && ant.indexOf(e) >= 0) { p += 2; malos.push('el día anterior carga ' + e.toLowerCase()); }
      });
      (cand.carga || []).forEach(function (c) { if (hoy.indexOf(c) >= 0 && ['PIERNA', 'HOMBRO', 'AGARRE'].indexOf(c) >= 0) { p += 1.5; malos.push('suma ' + c.toLowerCase() + ' al mismo día'); } });
      if (cand.duro) {
        for (var k = -2; k <= 2; k++) { var o = ctx.dias[i + k]; if (o && o.duro) { p += k ? 10 : 14; malos.push(k ? 'otra sesión dura a ' + Math.abs(k) + ' día' + (Math.abs(k) > 1 ? 's' : '') + ' (necesita ≥48 h)' : 'ya hay otra sesión dura ese día'); } }
        if (sig.indexOf('PIERNA') >= 0 && cand.codigos.indexOf('W04') >= 0) { p += 1; }
        if (ant.indexOf('PIERNA') >= 0 && ant.indexOf('SNC') >= 0) { p += 4; malos.push('viene de pierna pesada'); }
        if (d.rpe >= 8 && t === 'PM') { p += 3; malos.push('el metcon de ese día es RPE ' + d.rpe); }
        if (d.antes || d.despues) { p += 6; malos.push(d.antes ? 'días previos a un evento: bajar volumen' : 'recuperación tras un evento'); }
      }
      if (!cand.duro && d.duro && (cand.codigos.indexOf('W01') >= 0 || (cand.carga || []).indexOf('SNC') >= 0)) { p += 5; malos.push('ese día ya hay una sesión dura'); }
      p += (d.nExtra[t] || 0) * 1.5;                                                   // repartir: cada extra ya puesto en esa sesión resta atractivo
      if (cand.codigos.indexOf('W01') >= 0) {   // larga: aislada
        if (d.fabrik) { p += 4; malos.push('mejor un día sin pesas'); } else motivos.push('día sin Fabrik: la larga queda aislada');
        if (ant.indexOf('PIERNA') >= 0) { p += 2; malos.push('pierna el día anterior'); }
      }
      if ((d.antes || d.despues) && !cand.duro) p += 1.5;
      var tot = d.min[t] + (cand.min || 10), cap = t === 'AM' ? 75 : 120;
      if (tot > cap) { p += Math.ceil((tot - cap) / 10) * 2; malos.push('pasa de ' + cap + '′ en esa sesión'); }
      if (cand.codigos.some(function (c) { return d.codigos.indexOf(c) >= 0; })) { p += 3; malos.push('ese estímulo ya está ese día'); }
      var vecino = [ctx.dias[i - 1], ctx.dias[i + 1]].some(function (o) { return o && cand.codigos.some(function (c) { return o.codigos.indexOf(c) >= 0; }); });
      if (vecino) { p += 1; malos.push('el mismo estímulo en un día contiguo'); }
      if (!malos.length) motivos.push('sin choques con Fabrik ni con los días de alrededor');
      if (t === 'AM' && cand.turno && cand.turno.indexOf('AM') >= 0) motivos.push('por la mañana, separado ≥6 h de la sesión de Fabrik');
      if (cand.duro && !malos.length) motivos.push('respeta ≥48 h con las otras sesiones duras');
      malos = malos.filter(function (m, j) { return malos.indexOf(m) === j; });
      out.push({ iso: d.iso, dia: diaDe_(d.iso), turno: t, puntos: Math.round(p * 10) / 10, motivos: motivos, choques: malos });
    });
  });
  return out.sort(function (a, b) { return a.puntos - b.puntos || (a.iso < b.iso ? -1 : 1); });
}
function candidatoDe_(r, cat) {
  var cods = codigosDe_(r['CÓDIGOS']), e = cods.map(function (c) { return cat[c]; }).filter(Boolean)[0] || {};
  var txt = r['TÍTULO'] + '\n' + (r.CONTENIDO || '');
  return { codigos: cods, carga: etiquetas_(e.CARGA || '').concat(cargasDe_(txt, r.INTENSIDAD)), evitar: etiquetas_(e.EVITAR || ''), min: parseFloat(String(r.MIN || e.MIN || '10').replace(',', '.')) || 10,
    turno: norm(r.ORIGEN) === 'FABRIK' ? 'AM|PM' : (e.TURNO || 'AM|PM'), duro: cods.some(function (c) { return /^(R01|R02|R03|R04|W04)$/.test(c); }) };
}
/** Para la app: mejores huecos de un bloque (al moverlo o editarlo). */
function posicionOptima_(b) {
  var lunes = lunesDe_(b.lunes || b.fecha), cat = catalogo_();
  var r = b.id ? listar_(HOJAS.PLAN).filter(function (x) { return x.ID === String(b.id); })[0] : null;
  r = Object.assign({}, r || {}, b.campos || {});
  if (!r['TÍTULO'] && !r['CÓDIGOS']) throw new Error('faltan_datos');
  var ctx = contextoSemana_(lunes, b.id), cand = candidatoDe_(r, cat), lista = puntuarHuecos_(cand, ctx);
  var actual = r.FECHA && r.ESTADO !== 'SIN HUECO' ? puntuarHuecos_(cand, ctx, true).filter(function (h) { return h.iso === celdaIso_(r.FECHA) && h.turno === (norm(r.TURNO) === 'AM' ? 'AM' : 'PM'); })[0] : null;
  return { mejores: lista.slice(0, 3), actual: actual || null, libre: cand.codigos.some(function (c) { return LIBRES_TURNO.test(c); }), modoAM: ctx.modoAM };
}

// ---------- 5 · Generar los extras de la semana («Cargar extras») ----------
var PRIO_ORDEN = function (p) { var m = String(p || '').match(/P(\d)/); return m ? +m[1] : 7; };
function weeksLeft_(lunes, per) { return Math.max(1, Math.round((Date.parse(per.hasta) - Date.parse(lunes)) / 864e5 / 7 + 0.5)); }
/**
 * «Cargar extras». Con opts.simular = true no escribe nada: devuelve el resumen para el aviso previo.
 * Prioridad: carrera (tests mandan) → refuerzos de la semana → pendientes → metas semanales → mensuales (17–27 % del total del mes).
 * «Endurance de mañana» (APP · CONFIG › endurance_manana = Sí): Z2 carrera/erg SOLO en mañanas libres; el domingo es el comodín;
 * si no cabe, queda «SIN HUECO» para que tú elijas día/turno o lo pases a pendientes. Endurance ≤35′ → se le añade 10–15′ de calidad.
 * Los bloques que mueves o editas a mano quedan con candado (GENERADO = «manual …»): rehacer no los toca.
 */
function enduranceManana_() { return /^(S[IÍ]|TRUE|1|ON)$/i.test(String(leerConfig_().endurance_manana || '').trim()); }
var LIBRES_TURNO = /^(R01|W04|W13|M49|M36|M37)$/;   // Z6–Z8, calidad en series, RMU y cuerda: AM o PM, donde tú quieras
function generarExtras_(lunes, opts) {
  opts = opts || {};
  var sim = !!opts.simular;
  lunes = lunesDe_(lunes);
  var conf = filaSemana_(lunes);
  if (!conf || !/Confirmada|Programada/.test(conf.ESTADO)) throw new Error('semana_sin_confirmar');
  if (!sim && !listar_(HOJAS.PLAN).some(function (r) { var d = celdaIso_(r.FECHA); return norm(r.ORIGEN) === 'FABRIK' && d >= lunes && d <= sumarDias(lunes, 6); })) cargarFabrikSemana_(lunes);
  var cat = catalogo_(), fin = sumarDias(lunes, 6), sello = 'auto ' + ahora_(), modoAM = enduranceManana_();
  var esAuto = function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && /^(BORRADOR|SIN HUECO)$/.test(r.ESTADO) && /^auto/.test(r.GENERADO || ''); };
  // 6.1 · fuera los borradores automáticos anteriores (se regeneran); lo bloqueado con candado, lo tuyo y lo aprobado no se toca
  var refsLiberar = {}, pendLiberar = {};
  if (!sim) bloqueo_(function () {
    var sh = hojaMia_(HOJAS.PLAN), filas = [];
    listar_(HOJAS.PLAN).forEach(function (r) { if (esAuto(r)) { filas.push(r._fila); if (r.REFUERZO_ID) refsLiberar[r.REFUERZO_ID] = 1; if (r.PENDIENTE_ID) pendLiberar[r.PENDIENTE_ID] = 1; } });
    filas.sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
    MEMO = null;
    listar_(HOJAS.REFUERZOS).forEach(function (r) { if (refsLiberar[r.ID] && r.ESTADO === 'Programado') actualizarFila_(HOJAS.REFUERZOS, r._fila, { ESTADO: 'Pendiente' }); });
    listar_(HOJAS.PENDIENTES).forEach(function (r) { if (pendLiberar[r.ID] && r.ESTADO === 'Propuesto') actualizarFila_(HOJAS.PENDIENTES, r._fila, { ESTADO: 'Pendiente', 'SEMANA DESTINO': '' }); });
  });
  MEMO = null;
  var ctx = contextoSemana_(lunes, null, sim ? esAuto : null), nuevos = [], sinHueco = [], log = [], anadidos = {};
  var domingo = ctx.dias[6];
  var esEndurance = function (cand) { return cand.codigos.some(function (c) { return /^W0[123]$/.test(c); }) && !cand.codigos.some(function (c) { return /^(R01|W04)$/.test(c); }); };
  var colocar = function (o, cand, h) {
    var d = ctx.dias.filter(function (x) { return x.iso === h.iso; })[0];
    o.ID = nuevoId_(); o.FECHA = isoAFecha(h.iso); o['DÍA'] = h.dia; o.TURNO = h.turno; o.ORDEN = h.turno === 'AM' ? 10 + d.min.AM / 10 : 80 + d.min.PM / 10;
    o.ESTADO = 'BORRADOR'; o.GENERADO = sello; o.ACTUALIZADO = ahora_(); o.BLOQUE = o['TÍTULO'];
    o['POR QUÉ (cursiva)'] = [o['POR QUÉ (cursiva)'], 'Va el ' + h.dia.toLowerCase() + ' ' + h.turno + ': ' + (h.motivos.join('; ') || 'mejor hueco disponible') + (h.choques.length ? ' (a vigilar: ' + h.choques.join('; ') + ')' : '') + '.'].filter(Boolean).join(' ');
    d.min[h.turno] += cand.min || 10; d.nExtra[h.turno]++; d.cargas[h.turno] = d.cargas[h.turno].concat(cand.carga || []); d.codigos = d.codigos.concat(cand.codigos); if (cand.duro) d.duro = true;
    if (h.turno === 'AM') { d.codigosAM = (d.codigosAM || []).concat(cand.codigos);
      if (cand.codigos.some(function (c) { return /^(W01|W02|W04)$/.test(c); })) d.minCarreraAM = (d.minCarreraAM || 0) + (cand.min || 0);
      else if (!esEndurance(cand)) d.nExtraAMcal = (d.nExtraAMcal || 0) + 1; }
    cand.codigos.forEach(function (c) { anadidos[c] = (anadidos[c] || 0) + 1; });
    nuevos.push(o); return h;
  };
  var anadir = function (o, cand) {
    var endu = modoAM && esEndurance(cand);
    if (endu) cand.turno = 'AM';
    var lista = puntuarHuecos_(cand, ctx).filter(function (h) { return !endu || h.turno === 'AM'; });
    // Domingo comodín (solo endurance suave, solo si esa mañana está vacía)
    if (endu && !lista.length && domingo.descanso && !domingo.min.AM && !domingo.cargas.PM.length) {
      domingo.descanso = false; domingo.am = true;
      lista = puntuarHuecos_(cand, ctx).filter(function (h) { return h.iso === domingo.iso && h.turno === 'AM'; });
      domingo.descanso = true; domingo.am = false;
      if (lista[0]) lista[0].motivos.unshift('domingo como comodín: no quedaba ninguna mañana libre');
    }
    var h = lista[0];
    if (!h) {
      sinHueco.push(o['TÍTULO']);
      if (endu) { o.ID = nuevoId_(); o.FECHA = isoAFecha(lunes); o['DÍA'] = ''; o.TURNO = 'AM'; o.ORDEN = 0; o.ESTADO = 'SIN HUECO'; o.GENERADO = sello; o.ACTUALIZADO = ahora_(); o.BLOQUE = o['TÍTULO'];
        o['POR QUÉ (cursiva)'] = 'No cabe en ninguna mañana libre (Endurance de mañana activo) y el domingo ya tiene actividad: elige tú día y turno o pásalo a pendientes.'; nuevos.push(o); }
      else log.push('Sin hueco para ' + o['TÍTULO']);
      return false;
    }
    colocar(o, cand, h);
    if (modoAM && endu && (cand.min || 0) <= 35) huecoCalidad.push({ iso: h.iso, titulo: o['TÍTULO'] });
    return true;
  };
  var deCatalogo = function (c, extra) {
    var e = cat[c] || {};
    return Object.assign({ ORIGEN: e.ORIGEN || 'EXTRA', 'TÍTULO': e.NOMBRE || c, CONTENIDO: (e.CONTENIDO || '') + (e['DATOS A REGISTRAR'] ? '\n\nRegistra: ' + e['DATOS A REGISTRAR'] : ''), INTENSIDAD: e.INTENSIDAD || '',
      MIN: e.MIN || 10, 'CÓDIGOS': c, 'POR QUÉ (cursiva)': e['POR QUÉ (cursiva)'] || '', 'CIENCIA (técnica · fisiología · biología)': e['CIENCIA (técnica · fisiología · biología)'] || '', INTERFERENCIAS: e.INTERFERENCIAS || '',
      CANTIDAD: saltosTexto_(e.CONTENIDO || '') || '' }, extra || {});
  };
  var candDe = function (o) { return candidatoDe_(o, cat); };
  var huecoCalidad = [];
  // 6.2 · carrera de la semana (pestaña «carrera») adaptada con el histórico; los tests sustituyen la calidad
  var ordenC = function (s) { var c = s['CÓDIGOS']; return /W04/.test(c) ? 0 : /R01/.test(c) ? 1 : /W01/.test(c) ? 2 : /W02/.test(c) ? 3 : 4; };
  var yaCarrera = function (c) { return ctx.dias.some(function (d) { return d.codigos.indexOf(c) >= 0 && d.fijos && d.fijos.indexOf(c) >= 0; }); };
  carreraSemana_(lunes).sort(function (a, b) { return ordenC(a) - ordenC(b); }).forEach(function (s) {
    if (codigosDe_(s['CÓDIGOS']).every(yaCarrera)) return;                          // ya lo tienes con candado
    var c = candDe(s); if (s.TURNO_FORZADO) c.turno = s.TURNO_FORZADO; anadir(s, c);
  });
  // 6.3 · cola de prioridad del resto: refuerzos → pendientes → semanales → mensuales
  var cola = [];
  var refs = listar_(HOJAS.REFUERZOS).filter(function (r) { return celdaIso_(r.SEMANA) === lunes && r.ESTADO === 'Pendiente'; });
  refs.forEach(function (r) {
    var c = r['CÓDIGO'] || codigoDeTexto_(r.TEXTO, cat);
    var o = c ? deCatalogo(c, { 'POR QUÉ (cursiva)': 'Refuerzo que pediste: «' + r.TEXTO + '». ' + ((cat[c] || {})['POR QUÉ (cursiva)'] || '') })
      : { ORIGEN: 'EXTRA', 'TÍTULO': 'Refuerzo · ' + r.TEXTO, CONTENIDO: r.TEXTO + (r.NOTAS ? '\n' + r.NOTAS : '') + '\n\n10–15′ de calidad, sin fallo. Ajusta la dosis en la app.', MIN: 12, 'CÓDIGOS': '', 'POR QUÉ (cursiva)': 'Refuerzo que pediste para esta semana.' };
    o.REFUERZO_ID = r.ID; o._prio = 'refuerzo';
    cola.push({ o: o, al: function () { if (!sim) actualizarFila_(HOJAS.REFUERZOS, r._fila, { ESTADO: 'Programado', 'CÓDIGO': c || '' }); } });
  });
  pendientesAbiertos_().filter(function (p) { return p.ESTADO === 'Pendiente' && celdaIso_(p['FECHA ORIGINAL']) < lunes; }).forEach(function (p) {
    var orig = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === p.ID_PLAN; })[0] || {};
    var o = { ORIGEN: orig.ORIGEN && norm(orig.ORIGEN) !== 'FABRIK' ? orig.ORIGEN : 'EXTRA', 'TÍTULO': 'Pendiente · ' + (p.BLOQUE || orig['TÍTULO'] || ''), CONTENIDO: orig.CONTENIDO || '', MIN: orig.MIN || 15,
      'CÓDIGOS': orig['CÓDIGOS'] || '', INTENSIDAD: orig.INTENSIDAD || '', 'POR QUÉ (cursiva)': 'Recolocado desde el ' + p['FECHA ORIGINAL'] + (p.MOTIVO ? ' (' + p.MOTIVO + ')' : '') + '. Solo cuenta cuando lo hagas.', PENDIENTE_ID: p.ID, _prio: 'pendiente' };
    cola.push({ o: o, al: function () { if (!sim) actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Propuesto', 'SEMANA DESTINO': isoAFecha(lunes) }); } });
  });
  var cub = function (c) { return ctx.dias.reduce(function (a, d) { return a + d.codigos.filter(function (x) { return x === c; }).length; }, 0); };
  var enCola = function (c) { return cola.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).indexOf(c) >= 0; }).length; };
  var metas = listar_(HOJAS.METAS).filter(function (m) { return m.ACTIVA !== 'No'; });
  metas.filter(function (m) { return m['ÁMBITO'] === 'Semana' && String(m.TIPO || 'COUNT') === 'COUNT'; }).sort(function (a, b) { return PRIO_ORDEN(a.PRIORIDAD) - PRIO_ORDEN(b.PRIORIDAD); }).forEach(function (m) {
    var cods = codigosDe_(m['CÓDIGOS']), falta = (parseFloat(m.META) || 0) - cods.reduce(function (a, c) { return a + cub(c) + enCola(c); }, 0);
    var c = cods.filter(function (x) { return cat[x] && cat[x].CONTENIDO; })[0];
    for (var k = 0; k < falta && c; k++) {
      var o = deCatalogo(c);
      if (c === 'R04') { var pr01 = nuevos.concat(listar_(HOJAS.PLAN)).filter(function (r) { var d = celdaIso_(r.FECHA); return /R01/.test(r['CÓDIGOS']) && d >= lunes && d <= sumarDias(lunes, 6); })[0];
        o = bloqueIntegrado_(o, lunes, pr01 ? ((norm(pr01['TÍTULO']).match(/\bP([1-4])\b/) || [])[0] || '') : ''); }
      o._prio = 'semana'; cola.push({ o: o });
    }
  });
  var per = periodoMes_(lunes), mensuales = metas.filter(function (m) { return m['ÁMBITO'] === 'Mes' && String(m.TIPO || 'COUNT') === 'COUNT' && !/^R0/.test(m['CÓDIGOS']); });
  var total = mensuales.reduce(function (a, m) { return a + metaDe_(m, per.mes); }, 0);
  var hechoMes = avanceMetas_('Mes', per, cacheMetas_());
  var objetivo = Math.round(total * 0.22), minimo = Math.ceil(total * 0.17), maximo = Math.floor(total * 0.27), tope = Math.max(minimo, Math.min(objetivo, maximo));
  var mensDe = function (c) { return mensuales.filter(function (m) { return codigosDe_(m['CÓDIGOS']).indexOf(c) >= 0; })[0]; };
  var enSemana = mensuales.reduce(function (a, m) { return a + Math.min(metaDe_(m, per.mes), codigosDe_(m['CÓDIGOS']).reduce(function (s, c) { return s + cub(c); }, 0)); }, 0);
  var colaMes = mensuales.map(function (m) {
    var av = hechoMes.filter(function (x) { return x.id === m.ID; })[0] || { programado: 0 }, meta = metaDe_(m, per.mes);
    var resta = Math.max(0, meta - av.programado - codigosDe_(m['CÓDIGOS']).reduce(function (s, c) { return s + enCola(c); }, 0));
    return { m: m, resta: resta, urg: resta / weeksLeft_(lunes, per) - PRIO_ORDEN(m.PRIORIDAD) * 0.05 };
  }).filter(function (x) { return x.resta > 0; }).sort(function (a, b) { return b.urg - a.urg; });
  var mesEnCola = cola.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).some(mensDe); }).length;
  for (var i = 0, vueltas = 0; i < colaMes.length && enSemana + mesEnCola < tope && vueltas < 200; i++, vueltas++) {
    var c = codigosDe_(colaMes[i].m['CÓDIGOS']).filter(function (x) { return cat[x] && cat[x].CONTENIDO; })[0];
    if (!c) continue;
    var o = deCatalogo(c); o._prio = 'mes'; cola.push({ o: o }); mesEnCola++;
    colaMes[i].resta--; if (colaMes[i].resta > 0 && colaMes[i].urg > 1) i--;
  }
  // 6.3b · SALTOS de la semana (meta tipo SALTOS, W07): nunca se quedan sin cubrir.
  //   Regla de Pablo: o una sesión de pliometría aparte, o comba doble metida en un estímulo del mes a 4 DU por cada salto que falte.
  metas.filter(function (m) { return m['ÁMBITO'] === 'Semana' && String(m.TIPO || '').toUpperCase() === 'SALTOS'; }).forEach(function (m) {
    var meta = parseFloat(String(m.META).replace(',', '.')) || 0, cods = codigosDe_(m['CÓDIGOS']);
    if (!meta) return;
    var tiene = function (r) { return codigosDe_(r['CÓDIGOS']).some(function (c) { return cods.indexOf(c) >= 0; }); };
    var enPlan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO) && !(sim && esAuto(r)) && tiene(r); });
    var hay = enPlan.concat(nuevos).filter(tiene).reduce(function (a, r) { return a + saltosDe_(r); }, 0) + cola.filter(function (x) { return tiene(x.o); }).reduce(function (a, x) { return a + saltosDe_(x.o); }, 0);
    var falta = Math.ceil(meta - hay);
    if (falta <= 0) return;
    var anfitrion = falta <= 50 ? cola.filter(function (x) { return x.o._prio === 'mes' && norm(x.o.ORIGEN) !== 'CARRERA'; })[0] : null;
    if (anfitrion) {
      var du = falta * 4, o = anfitrion.o, base = saltosDe_(o) || 0;
      o.CONTENIDO = (o.CONTENIDO || '') + '\n\n+ ' + du + ' DOUBLE UNDERS repartidos en series sin fallo (cubren los ' + falta + ' saltos que faltan esta semana: 4 DU = 1 salto).';
      o.CANTIDAD = base + falta;
      o['CÓDIGOS'] = codigosDe_(o['CÓDIGOS']).concat(cods.filter(function (c) { return codigosDe_(o['CÓDIGOS']).indexOf(c) < 0; })).join('|');
      o.MIN = (parseFloat(o.MIN) || 10) + Math.ceil(du / 60) + 2;
      o['POR QUÉ (cursiva)'] = [o['POR QUÉ (cursiva)'], 'Lleva ' + du + ' DU para cubrir los ' + falta + ' saltos de pliometría que faltaban (regla 4×).'].filter(Boolean).join(' ');
      log.push('Saltos: +' + du + ' DU dentro de «' + o['TÍTULO'] + '» (cubren ' + falta + ')');
    } else {
      // Hasta 50: box jump + broad jump de 5 en 5. Lo que pase de 50, en pogos de 10 (más baratos para el tendón y el SNC).
      var pogo = falta > 50 ? Math.ceil((falta - 50) / 10) : 0, series = Math.max(2, Math.ceil(Math.min(falta, 50) / 5)), cajon = Math.ceil(series / 2), largo = series - cajon, total = pogo * 10 + series * 5;
      var o2 = deCatalogo(cods[0] || 'W07', {
        'TÍTULO': 'Pliometría · ' + total + ' saltos', CANTIDAD: total, MIN: Math.max(10, Math.round(total / 5)),
        CONTENIDO: (pogo ? pogo + '×10 pogo jumps (rebote rápido, rodilla casi bloqueada) + ' : '') + cajon + '×5 box jump (bajando del cajón, aterrizaje en 2″) + ' + largo + '×5 broad jump con pausa de 2″ al caer · 60–90″ entre series. ' + total + ' saltos de calidad: si la técnica cae, para.',
        'POR QUÉ (cursiva)': 'Faltaban ' + falta + ' saltos para la meta semanal de ' + meta + '. Antes de pierna pesada o haltero, nunca después.' });
      o2._prio = 'semana'; cola.unshift({ o: o2 });
      log.push('Saltos: sesión de pliometría de ' + total + ' (faltaban ' + falta + ')');
    }
  });
  // 6.4 · endurance corta (≤35′) por la mañana: se le suma 10–15′ de calidad, lo que más falte (orden de la cola)
  huecoCalidad.forEach(function (hq) {
    for (var k = 0; k < cola.length; k++) {
      var x = cola[k], cand = candDe(x.o);
      var dq = ctx.dias.filter(function (y) { return y.iso === hq.iso; })[0];
      var esRun = dq && dq.minCarreraAM, libreMin = esRun ? 15 : Math.min(15, 45 - (dq ? dq.min.AM : 0));
      if (!dq || dq.nExtraAMcal >= 1 || libreMin < 6 || (cand.min || 10) > Math.max(libreMin, 10) || cand.duro || esEndurance(cand)) continue;
      var h = puntuarHuecos_(cand, ctx).filter(function (y) { return y.iso === hq.iso && y.turno === 'AM'; })[0];
      if (!h) {   // la mañana es del endurance: se fuerza el hueco aunque la mañana no esté marcada como libre (ej. domingo comodín)
        var d = ctx.dias.filter(function (y) { return y.iso === hq.iso; })[0];
        h = { iso: hq.iso, dia: diaDe_(hq.iso), turno: 'AM', motivos: [], choques: [] };
        if (!d) continue;
      }
      h.motivos = ['tras «' + hq.titulo + '» (≤35′): se aprovecha la mañana con 10–15′ de calidad'].concat(h.motivos || []);
      x.o.MIN = Math.min(libreMin, +x.o.MIN || 12);
      colocar(x.o, cand, h); if (x.al) x.al(); cola.splice(k, 1); break;
    }
  });
  // 6.5 · el resto de la cola, por prioridad
  cola.forEach(function (x) { if (anadir(x.o, candDe(x.o)) && x.al) x.al(); });
  // 6.6 · escribir (o devolver la simulación)
  var mensualesSemana = enSemana + nuevos.filter(function (o) { return o.ESTADO !== 'SIN HUECO' && codigosDe_(o['CÓDIGOS']).some(mensDe); }).length;
  var pct = total ? Math.round(mensualesSemana / total * 100) : 0;
  var colocados = nuevos.filter(function (o) { return o.ESTADO !== 'SIN HUECO'; });
  var resumen = colocados.length + ' bloques en borrador · mensuales ' + mensualesSemana + '/' + total + ' (' + pct + ' %, objetivo 17–27 %)' +
    (sinHueco.length ? ' · sin hueco: ' + sinHueco.join(', ') : '') + (log.length ? ' · ' + log.join(' · ') : '');
  var previa = { modoAM: modoAM, mananas: ctx.dias.filter(function (d) { return d.am && !d.descanso; }).map(function (d) { return diaDe_(d.iso); }),
    endurance: colocados.filter(function (o) { return esEndurance(candDe(o)); }).map(function (o) { return o['TÍTULO'] + ' → ' + o['DÍA'] + ' ' + o.TURNO; }),
    refuerzos: refs.map(function (r) { return r.TEXTO; }), pendientes: cola.length >= 0 ? nuevos.filter(function (o) { return o.PENDIENTE_ID; }).map(function (o) { return o['TÍTULO']; }) : [],
    sinHueco: sinHueco, bloques: colocados.map(function (o) { return { titulo: o['TÍTULO'], dia: o['DÍA'], turno: o.TURNO, min: o.MIN, codigos: o['CÓDIGOS'], prio: o._prio || 'carrera' }; }), pctMes: pct, resumen: resumen };
  if (sim) return previa;
  nuevos.forEach(function (o) { delete o._prio; });
  asegurarColumna_(HOJAS.PLAN, 'REFUERZO_ID'); asegurarColumna_(HOJAS.SEMANAS, 'BALANCE ESTÍMULOS'); asegurarColumna_(HOJAS.PLAN, 'ALTERNATIVAS');
  if (nuevos.length) bloqueo_(function () {
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, nuevos.length, cab.length).setValues(nuevos.map(function (o) { return filaDe_(cab, o); }));
  });
  MEMO = null;
  interferenciasFabrik_(lunes);
  ponerConfig_('extras_' + lunes, ahora_() + ' · ' + resumen, 'Último «Cargar extras» de esa semana');
  try { escribirBalance_(lunes, 'Plan'); } catch (e) { Logger.log('Balance: ' + e); }
  return { creados: colocados.length, sinHueco: sinHueco, pctMes: pct, resumen: resumen };
}
/** Balance de estímulos de la semana en APP · SEMANAS (al cargar extras y al cerrar la semana). */
function escribirBalance_(lunes, momento) {
  MEMO = null;
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); });
  var reg = listar_(HOJAS.REGISTRO).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); });
  var hecho = {}; reg.forEach(function (r) { hecho[r.ID_PLAN] = r.HECHO; });
  var cods = function (l) { var o = {}; l.forEach(function (r) { codigosDe_(r['CÓDIGOS']).forEach(function (c) { o[c] = (o[c] || 0) + 1; }); }); return Object.keys(o).sort().map(function (c) { return c + (o[c] > 1 ? '×' + o[c] : ''); }).join(' '); };
  var vivos = plan.filter(function (r) { return /PROGRAMADO|BORRADOR/.test(r.ESTADO); });
  var fab = vivos.filter(function (r) { return norm(r.ORIGEN) === 'FABRIK'; }), ext = vivos.filter(function (r) { return norm(r.ORIGEN) !== 'FABRIK'; });
  var sin = plan.filter(function (r) { return r.ESTADO === 'SIN HUECO'; }), nh = plan.filter(function (r) { return r.ESTADO === 'NO HACER'; });
  var m = metasDe_(lunes), sem = m.semana, mes = m.mes;
  var txt = momento + ' ' + ahora_() + ' · Fabrik: ' + (cods(fab) || '—') + ' · Extras: ' + (cods(ext) || '—') +
    (sin.length ? ' · Sin hueco: ' + sin.map(function (r) { return r['TÍTULO']; }).join(', ') : '') +
    (nh.length ? ' · No hacer → pendientes: ' + nh.map(function (r) { return r['TÍTULO']; }).join(', ') : '') +
    ' · Semana: ' + sem.cubiertas + '/' + sem.total + ' metas' + (sem.metas.filter(function (x) { return !x.cubierta; }).length ? ' (faltan: ' + sem.metas.filter(function (x) { return !x.cubierta; }).map(function (x) { return x.estimulo; }).join(', ') + ')' : '') +
    ' · Mes ' + mes.etiqueta + ': ' + Math.round(mes.pctProg * 100) + ' % programado, ' + Math.round(mes.pctReal * 100) + ' % hecho' +
    (momento === 'Cierre' ? ' · Hechos ' + reg.filter(function (r) { return r.HECHO === 'Sí'; }).length + '/' + vivos.filter(function (r) { return r.ESTADO === 'PROGRAMADO'; }).length + ' bloques' : '');
  asegurarColumna_(HOJAS.SEMANAS, 'BALANCE ESTÍMULOS');
  var x = filaSemana_(lunes);
  if (x) actualizarFila_(HOJAS.SEMANAS, x._fila, { 'BALANCE ESTÍMULOS': txt.slice(0, 4500) });
  return txt;
}
function codigoDeTexto_(txt, cat) {
  var t = norm(txt);
  var ALIAS = [[/PISTOL/, 'M19'], [/\bOH\b|OVERHEAD|ESTABILIDAD OH/, 'M58'], [/BULGAR/, 'M45'], [/COPENHAG/, 'M46'], [/HIP THRUST|GLUTEO/, 'M28'], [/CORE/, 'M08'], [/CUERDA|ROPE/, 'M36'],
    [/TRINEO|SLED/, 'M38'], [/PINO|HANDSTAND/, 'W33'], [/HSW|PIRUETA/, 'W32'], [/HSPU ESTRICT|STRICT HSPU/, 'W17'], [/HSPU/, 'W15'], [/RMU|MUSCLE UP ANILLAS/, 'W13'], [/SNATCH BALANCE/, 'W20'],
    [/SPLIT JERK/, 'W23'], [/SALTO|PLIOM/, 'W07'], [/TRIPLE/, 'M35'], [/CROSSOVER/, 'M32'], [/PULLOVER/, 'M31'], [/SANDBAG|SLAM/, 'M57'], [/MOVILIDAD|ESCAP/, 'W10']];
  for (var i = 0; i < ALIAS.length; i++) if (ALIAS[i][0].test(t) && cat[ALIAS[i][1]]) return ALIAS[i][1];
  var cods = Object.keys(cat);
  for (var j = 0; j < cods.length; j++) { var re = reSeguro_(cat[cods[j]]['DETECTAR (regex)']); if (re && re.test(t)) return cods[j]; }
  return '';
}
/** Sesiones de carrera de la semana desde la pestaña «carrera» + ajustes del histórico (calculados el domingo a las 22 h). */
function carreraSemana_(lunes) {
  var sh = miLibro_().getSheetByName('carrera'); if (!sh) return [];
  var g = sh.getRange(1, 1, Math.min(sh.getLastRow(), 400), 7).getDisplayValues();
  var ini = (String(g[1] && g[1][0]).match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i) || []);
  var MES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12 };
  if (!ini[1]) return [];
  var base = ini[3] + '-' + ('0' + MES[norm(ini[2])]).slice(-2) + '-' + ('0' + ini[1]).slice(-2), nSem = Math.round((Date.parse(lunes) - Date.parse(lunesDe_(base))) / 864e5 / 7) + 1;
  var dentro = false, out = [], titulo = '';
  g.forEach(function (r) {
    var t = String(r[0]).trim(), m = t.match(/^(\d{2})\s*·/);
    if (m) { dentro = +m[1] === nSem; if (dentro) titulo = t; return; }
    if (!dentro || !t || r.slice(1).every(function (c) { return !String(c).trim(); })) return;
    var nt = norm(t), cod = /Z2.*LARGA/.test(nt) ? 'W01|W02' : /Z2/.test(nt) ? 'W02' : /CALIDAD.*Z5|VO2/.test(nt) ? 'W04|R03' : /CALIDAD/.test(nt) ? 'W04|R02' : /ERG/.test(nt) ? 'W03' : /POTENCIA|Z6|Z8|RSA/.test(nt) ? 'R01' : '';
    if (!cod || /OPCIONAL/.test(nt)) return;
    var min = (String(r[1]).match(/≈\s*(\d+)\s*[′']/) || [])[1] || (/W04/.test(cod) ? 45 : (String(r[1]).match(/(\d+)\s*[′']/) || [])[1]);
    out.push({ ORIGEN: /R01/.test(cod) ? 'Z6–Z8' : 'CARRERA', 'TÍTULO': t, CONTENIDO: r[1] + (r[2] ? '\n\nReferencia: ' + r[2] : '') + (r[3] ? '\nZona: ' + r[3] : '') + '\n\nRegistra: ' + ((catalogo_()[cod.split('|')[0]] || {})['DATOS A REGISTRAR'] || 'tiempo, RPE y sensaciones'),
      INTENSIDAD: /R01/.test(cod) ? '🔴 Z6–Z8' : /W04/.test(cod) ? '🟠 Calidad' : '🔵 Z2', MIN: min || (/W01/.test(cod) ? 60 : /R01/.test(cod) ? 20 : 35), 'CÓDIGOS': cod,
      'POR QUÉ (cursiva)': 'Plan de carrera · ' + titulo.split('·').slice(1).join('·').trim(), 'CIENCIA (técnica · fisiología · biología)': (catalogo_()[cod.split('|')[0]] || {})['CIENCIA (técnica · fisiología · biología)'] || '',
      INTERFERENCIAS: (catalogo_()[cod.split('|')[0]] || {}).INTERFERENCIAS || '', TURNO_FORZADO: /R01/.test(cod) ? 'PM' : '' });
  });
  // v0.11 · Q con alternativas (la del plan es la recomendada) y Z6–Z8 elegido de la biblioteca según tus carencias
  out = out.map(function (s) {
    if (/R01/.test(s['CÓDIGOS'])) { try { return bloqueZ68_(s, lunes); } catch (e) { return s; } }
    if (/W04/.test(s['CÓDIGOS'])) { try { s.ALTERNATIVAS = alternativasQ_(s); } catch (e) {} }
    return s;
  });
  // Ajustes del histórico (domingo 22:00)
  var aj = {}; try { aj = JSON.parse(PROPS.getProperty('CARRERA_AJUSTE') || '{}'); } catch (e) {}
  out.forEach(function (s) {
    var k = /R01/.test(s['CÓDIGOS']) ? 'potencia' : /W04/.test(s['CÓDIGOS']) ? 'calidad' : /W0[12]/.test(s['CÓDIGOS']) ? 'z2' : '';
    if (k && aj[k]) s.CONTENIDO = '⚙ Ajuste por tu semana anterior: ' + aj[k] + '\n\n' + s.CONTENIDO;
  });
  // Semana de test: el test sustituye la calidad
  eventosEntre_(lunes, sumarDias(lunes, 6)).filter(function (e) { return /^Test/i.test(e.EVENTO); }).forEach(function (e) {
    var q = out.filter(function (s) { return /W04/.test(s['CÓDIGOS']); })[0];
    var t = { ORIGEN: 'CARRERA', 'TÍTULO': e.EVENTO, CONTENIDO: '15′ calentamiento + 3×15″ progresivos · ' + e.EVENTO + ' a tope · 10′ suaves.\n\n' + (e['CÓMO PROCEDER'] || '') + '\n\nRegistra: tiempo total, parciales por km, FC media y máx, RPE.',
      INTENSIDAD: '🔴 Test', MIN: /10/.test(e.EVENTO) ? 75 : 40, 'CÓDIGOS': q ? q['CÓDIGOS'] : 'W04', 'POR QUÉ (cursiva)': 'Test de la semana: sustituye la calidad. Descansado, sin Z6–Z8 ni pierna pesada el día antes.', INTERFERENCIAS: 'Nada duro el día antes; el día después, suave.' };
    if (q) out.splice(out.indexOf(q), 1, t); else out.push(t);
    if (/10/.test(e.EVENTO)) out = out.filter(function (s) { return !/W01/.test(s['CÓDIGOS']); });
  });
  return out;
}
/** Domingo 22:00 (dentro de domingoNoche): con lo registrado esta semana, cómo ajustar la carrera de la siguiente. */
function ajusteCarrera_() {
  var lunes = lunesDe_(hoyIso_()), car = listar_(HOJAS.CARRERA).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); });
  var aj = {}, n = function (v) { return parseFloat(String(v || '').replace(',', '.')) || 0; };
  var cal = car.filter(function (r) { return /Z4|Z5|Test/i.test(r.TIPO); });
  if (cal.some(function (r) { return r['PARCIALES CUMPLIDOS'] === 'No' || n(r.RPE) >= 9; })) aj.calidad = 'la semana pasada no cumpliste parciales o fue RPE ≥9: repite el volumen anterior y no bajes el ritmo.';
  else if (cal.length && cal.every(function (r) { return r['PARCIALES CUMPLIDOS'] === 'Sí' && n(r.RPE) && n(r.RPE) <= 7; })) aj.calidad = 'cumpliste con RPE ≤7: puedes ir al extremo rápido del rango.';
  var z2 = car.filter(function (r) { return /^Z2/i.test(r.TIPO) && n(r['FC MEDIA']); }), fcObj = 149;
  if (z2.length && z2.reduce(function (a, r) { return a + n(r['FC MEDIA']); }, 0) / z2.length > fcObj + 5) aj.z2 = 'la FC media en Z2 salió alta: ve 10–15″/km más lento para quedarte en ~' + fcObj + ' ppm.';
  var pot = car.filter(function (r) { return /Z6/.test(r.TIPO); });
  if (pot.length && /ca[ií]da\s*(\d+)/i.test(pot[0].NOTAS || '') && +RegExp.$1 > 15) aj.potencia = 'caída de potencia >15 %: mantén el nº de sprints y alarga el descanso 15″.';
  var reg = listar_(HOJAS.REGISTRO).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); });
  var no = reg.filter(function (r) { return r.HECHO === 'No'; }).length;
  if (no >= 3) aj.z2 = (aj.z2 ? aj.z2 + ' ' : '') + 'Hubo ' + no + ' bloques sin hacer: semana conservadora, sin subir minutos.';
  PROPS.setProperty('CARRERA_AJUSTE', JSON.stringify(aj));
  return aj;
}

// ---------- 6 · Refuerzos, edición de bloques, notas, WODs, avisos y petición a Claude ----------
function guardarRefuerzo_(b) {
  var t = String(b.texto || '').trim().slice(0, 200); if (!t) throw new Error('falta_texto');
  var cat = catalogo_(), c = codigoDeTexto_(t, cat);
  anadirFila_(HOJAS.REFUERZOS, { ID: nuevoId_(), SEMANA: isoAFecha(lunesDe_(b.lunes)), TEXTO: t, 'CÓDIGO': c, ESTADO: 'Pendiente', NOTAS: String(b.notas || '').slice(0, 500), CREADO: ahora_() });
}
function refuerzosDe_(lunes) { return listar_(HOJAS.REFUERZOS).filter(function (r) { return celdaIso_(r.SEMANA) === lunes; }); }
var CAMPOS_EDITABLES = ['FECHA', 'TURNO', 'ORDEN', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CÓDIGOS', 'CANTIDAD', 'POR QUÉ (cursiva)'];
function editarBloque_(b) {
  var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(b.id || ''); })[0];
  if (!x) throw new Error('no_encontrado');
  var o = permitidas_(b.campos || {}, CAMPOS_EDITABLES);
  var fabX = norm(x.ORIGEN) === 'FABRIK';
  if (fabX) o = permitidas_(o, ['FECHA', 'TURNO', 'ORDEN', 'CÓDIGOS', 'POR QUÉ (cursiva)', 'TÍTULO', 'CONTENIDO', 'MIN']);   // v0.11: también su contenido, y queda con candado
  // ¿Solo cambia de sitio? (lo demás llega igual que estaba) → lo aprobado sigue aprobado: moverlo es decisión tuya
  Object.keys(o).forEach(function (k) { if (CAMPOS_POSICION_.indexOf(k) < 0 && String(o[k]) === String(x[k] == null ? '' : x[k])) delete o[k]; });
  var soloMover = soloPosicion_(o);
  if (o.FECHA) { var iso = celdaIso_(o.FECHA); if (!iso) throw new Error('fecha_no_valida'); o.FECHA = isoAFecha(iso); o['DÍA'] = diaDe_(iso); }
  if (o.TURNO) o.TURNO = o.TURNO === 'AM' ? 'AM' : 'PM';
  if (o['TÍTULO']) o.BLOQUE = o['TÍTULO'];
  if (x.ESTADO === 'SIN HUECO' && o.FECHA) o.ESTADO = 'BORRADOR';
  if (x.ESTADO === 'PROGRAMADO' && !soloMover) o.ESTADO = 'BORRADOR';   // cambiar el CONTENIDO de lo aprobado se vuelve a aprobar (sigue contando en las metas)
  if (o['CÓDIGOS'] && /W07/.test(o['CÓDIGOS']) && !o.CANTIDAD && !(parseFloat(x.CANTIDAD) > 0)) o.CANTIDAD = saltosTexto_((o['TÍTULO'] || x['TÍTULO'] || '') + '\n' + (o.CONTENIDO || x.CONTENIDO || '')) || '';
  if (!fabX) o.GENERADO = 'manual ' + ahora_() + ' (candado)';   // lo que tocas a mano no lo vuelve a mover «Rehacer extras»
  else if (o.CONTENIDO != null || o['TÍTULO'] != null || o.MIN != null) o.GENERADO = 'manual ' + ahora_() + ' (editado · candado: la recarga de Fabrik no lo pisa)';
  o.ACTUALIZADO = ahora_();
  bloqueo_(function () { actualizarFila_(HOJAS.PLAN, x._fila, o); });
  return x.ID;
}
/** Quitar un bloque desde la hoja de la semana: los borradores se borran; lo programado pasa a «NO HACER» (y a pendientes si quieres). */
function quitarBloque_(b) {
  var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(b.id || ''); })[0];
  if (!x) throw new Error('no_encontrado');
  if (/^(BORRADOR|SIN HUECO)$/.test(x.ESTADO) && norm(x.ORIGEN) !== 'FABRIK') {
    if (b.pendiente && !x.PENDIENTE_ID) anadirPendiente_(x, b.motivo || (x.ESTADO === 'SIN HUECO' ? 'Sin hueco en la semana' : 'Quitado desde la hoja de la semana'));
    if (x.REFUERZO_ID) { var rz = listar_(HOJAS.REFUERZOS).filter(function (r) { return r.ID === x.REFUERZO_ID; })[0]; if (rz) actualizarFila_(HOJAS.REFUERZOS, rz._fila, { ESTADO: b.pendiente ? 'Pendiente' : 'Descartado' }); }
    if (x.PENDIENTE_ID) { var p = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ID === x.PENDIENTE_ID; })[0]; if (p) actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Pendiente', 'SEMANA DESTINO': '' }); }
    return borrarFila_(HOJAS.PLAN, x._fila, { ID: x.ID });
  }
  bloqueo_(function () { actualizarFila_(HOJAS.PLAN, x._fila, { ESTADO: 'NO HACER', ACTUALIZADO: ahora_() }); if (b.pendiente) anadirPendiente_(x, b.motivo || 'Quitado desde la hoja de la semana'); });
}
function guardarNotaBloque_(n) {
  var o = permitidas_(n, ['FECHA', 'ID_PLAN', 'BLOQUE', 'MIS NOTAS', 'RECOMENDACIÓN']);
  if (!o.FECHA || !o.ID_PLAN) throw new Error('faltan_datos');
  o.FECHA = isoAFecha(celdaIso_(o.FECHA)); o.ACTUALIZADO = ahora_();
  return bloqueo_(function () {
    var x = listar_(HOJAS.NOTAS).filter(function (r) { return celdaIso_(r.FECHA) === celdaIso_(o.FECHA) && r.ID_PLAN === o.ID_PLAN; })[0];
    if (x) actualizarFila_(HOJAS.NOTAS, x._fila, o); else { var sh = hojaMia_(HOJAS.NOTAS), cab = cabeceras_(sh); sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]); }
    return o;
  });
}
function guardarWod_(w) {
  var o = permitidas_(w, ['NOMBRE', 'TIPO', 'FECHA ORIGEN', 'CONTENIDO', 'RESULTADO', 'NOTAS']);
  if (!o.NOMBRE || !o.CONTENIDO) throw new Error('faltan_datos');
  o.NOMBRE = o.NOMBRE.toUpperCase().slice(0, 80); o.TIPO = o.TIPO === 'Referencia' ? 'Referencia' : 'Guardado';
  return bloqueo_(function () {
    var x = w.ID ? listar_(HOJAS.WODS).filter(function (r) { return r.ID === String(w.ID); })[0] : null;
    if (x) { actualizarFila_(HOJAS.WODS, x._fila, o); return x.ID; }
    o.ID = nuevoId_(); o.CREADO = ahora_();
    var sh = hojaMia_(HOJAS.WODS), cab = cabeceras_(sh); sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
}
function borrarWod_(id) { var x = listar_(HOJAS.WODS).filter(function (r) { return r.ID === String(id); })[0]; if (!x) throw new Error('no_encontrado'); borrarFila_(HOJAS.WODS, x._fila, { ID: x.ID }); }
function avisoVisto_(id) {
  var v = String(leerConfig_().avisos_vistos || '').split(',').filter(Boolean);
  if (v.indexOf(String(id)) < 0) v.push(String(id).slice(0, 40));
  ponerConfig_('avisos_vistos', v.slice(-60).join(','), 'Avisos de tests/competiciones que ya has visto: solo salen en el calendario y en Menú › Avisos');
}
function pedirClaude_(b) {
  var lunes = lunesDe_(b.lunes);
  anadirFila_(HOJAS.CAMBIOS, { ID: nuevoId_(), CREADO: ahora_(), DESDE: isoAFecha(lunes), 'TURNO DESDE': 'AM', EVENTO: 'Programar extras · semana del ' + isoAFecha(lunes),
    AFECTA: 'Extras de la semana (no me convence la propuesta automática)', NOTAS: String(b.notas || '').slice(0, 1500), ESTADO: 'Solicitada' });
}

// ---------- 7 · Grabación: ideas de «Reels de datos» que encajan con cada bloque + stories ----------
var CLAVES_REEL = [
  [/PLIOMETR|SALTO|EXPLOSIV/, /BOX JUMP|BROAD JUMP|POGO|SQUAT JUMP|COUNTERMOVEMENT|JUMP/], [/REMO\b|REMOERG|ROWERG/, /ROW/], [/ARRANCADA|SNATCH/, /SNATCH/], [/CARGADA|\bCLEAN/, /CLEAN/],
  [/HALTEROFILIA|LEVANTAMIENTO/, /SNATCH|CLEAN|JERK/], [/MOLETEADO|BARRA/, /BACK SQUAT|FRONT SQUAT|DEADLIFT/], [/PULSACIONES|FATIGA/, /SNATCH|CLEAN/], [/70 ?%|POTENCIA/, /POWER (CLEAN|SNATCH)/],
  [/CARRERA|CORRER/, /\bRUN\b|CARRERA|Z2/], [/HSPU|PINO|INVERTID/, /HSPU|HANDSTAND|HSWALK/], [/ANILLAS|MUSCLE/, /MUSCLE UP|RMU|RING/], [/COMBA|DOBLES/, /DOUBLE UNDER|\bDU\b|CROSSOVER/]
];
function ideasReels_() {
  var c = CacheService.getScriptCache(), v = c.get('reels_v1'); if (v) return JSON.parse(v);
  var out = [];
  try {
    SpreadsheetApp.openById(CONFIG.REELS_ID).getSheets().forEach(function (sh) {
      if (!/Entrenamiento|Competici|Alimentaci/i.test(sh.getName())) return;
      var g = sh.getDataRange().getDisplayValues(), cab = (g[0] || []).map(function (h) { return norm(h).trim(); }), col = function (k) { return cab.findIndex(function (h) { return h.indexOf(k) === 0; }); };
      var cE = col('ESTADO'), cI = col('IDEA'), cA = col('TU APUNTE'), cB = col('BALANZA'), cF = col('FORMATO'), cH = col('HOOK'), cM = col('MATERIAL'), cL = col('LO QUE FALTA');
      g.slice(1).forEach(function (r) {
        if (!r[cI] || /PUBLICADO/.test(norm(r[cE])) || /EN CONTRA/.test(norm(r[cB]))) return;
        var txt = norm([r[cI], r[cA], r[cM], r[cL]].join(' '));
        var res = CLAVES_REEL.filter(function (k) { return k[0].test(txt); }).map(function (k) { return k[1].source; });
        if (!res.length) return;
        var ang = (String(r[cM] || '') + ' ' + String(r[cL] || '')).match(/c[aá]mara[^.;\n]*/i);
        out.push({ idea: r[cI], formato: r[cF] || '', hook: r[cH] || '', re: res.join('|'), metcon: /PULSACIONES|FATIGA|WOD/.test(txt), angulo: ang ? ang[0] : '' });
      });
    });
  } catch (e) { return []; }
  try { c.put('reels_v1', JSON.stringify(out), 3600); } catch (e) {}
  return out;
}
var ANGULO_TIPO = {
  haltero: 'Lateral 45° a la altura de la cadera, a 3–4 m, barra y discos enteros en plano; graba la serie más pesada.',
  fuerza: 'Lateral puro a la altura de la rodilla para ver profundidad y trayectoria; trípode fijo.',
  gimnasticos: 'Frontal o lateral completo desde 4–5 m, con la barra/anillas y el suelo en plano.',
  metcon: 'Plano general fijo desde una esquina, todas las estaciones en cuadro.',
  carrera: 'Lateral bajo en paralelo (5–10 s) o el reloj al acabar el intervalo.',
  otro: 'Plano medio lateral.'
};
function grabacionSemana_(sem) {
  var ideas = ideasReels_(), out = {};
  var mira = function (iso, id, titulo, txt, tipo, wod) {
    var t = norm(titulo + '\n' + txt), met = tipo === 'metcon', l = [];
    ideas.forEach(function (i) { if ((i.metcon && !met) || !new RegExp(i.re).test(t)) return; l.push({ idea: i.idea, formato: i.formato, hook: i.hook, angulo: i.angulo || ANGULO_TIPO[tipo] || ANGULO_TIPO.otro }); });
    var story = null;
    if (tipo === 'haltero' || met) {
      var mat = String((wod && wod.material) || '').replace(/\s*\/\s*/g, ', ');
      story = met ? { tipo: 'Story · metcon', angulo: ANGULO_TIPO.metcon, materiales: (mat ? 'Coloca ' + mat.toLowerCase() + ' en línea respecto a la cámara, en el orden del WOD, para que se vean las transiciones. ' : '') + '3 clips de 3 s: inicio, mitad y último minuto; o time-lapse del WOD entero.' }
        : { tipo: 'Story · haltero', angulo: ANGULO_TIPO.haltero, materiales: 'Barra centrada, discos de colores visibles y nada delante; graba en 60 fps para cámara lenta de la recepción.' };
    }
    if (l.length || story) out[iso + '|' + id] = { reels: l.slice(0, 2), story: story };
  };
  ((sem.fabrik && sem.fabrik.dias) || []).forEach(function (d) {
    d.bloques.forEach(function (b) { if (b.n) mira(d.iso, b.n, b.titulo, textoBloque_(b), tipoBloque_(b), b.wod); });
  });
  (sem.plan || []).forEach(function (r) { if (norm(r.ORIGEN) !== 'FABRIK') mira(celdaIso_(r.FECHA), r.ID, r['TÍTULO'], r.CONTENIDO, /CARRERA|Z6/.test(norm(r.ORIGEN)) ? 'carrera' : 'otro', null); });
  return out;
}

// ---------- 8 · Google Calendar (calendario principal) ----------
var MARCA_CAL = '[Road To Elite]';
function calendario_() { return CalendarApp.getDefaultCalendar(); }
function eventoACal_(id) {
  try {
    var x = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(id); })[0];
    if (!x || x['ORIGEN CAL'] === 'Google') return;
    var cal = calendario_(), i = celdaIso_(x.INICIO), f = celdaIso_(x.FIN) || i; if (!i) return;
    var desc = MARCA_CAL + ' ' + x.ID + '\nBloquea: ' + (x.BLOQUEA || '—') + '\n' + (x['CÓMO PROCEDER'] || '') + (x.NOTAS ? '\n' + x.NOTAS : '');
    var ev = x.GCAL_ID ? (function () { try { return cal.getEventById(x.GCAL_ID); } catch (e) { return null; } })() : null;
    var hora = String(x.HORA || '').match(/^(\d{1,2}):(\d{2})/);
    var d0 = new Date(i + 'T12:00:00Z'), d1 = new Date(sumarDias(f, 1) + 'T12:00:00Z');
    var ini = hora ? new Date(i + 'T' + ('0' + hora[1]).slice(-2) + ':' + hora[2] + ':00') : null;
    if (ev) { ev.setTitle(x.EVENTO); ev.setDescription(desc); if (hora) ev.setTime(ini, new Date(ini.getTime() + 3600e3)); else ev.setAllDayDates(d0, d1); }
    else {
      ev = hora ? cal.createEvent(x.EVENTO, ini, new Date(ini.getTime() + 3600e3), { description: desc, location: x.LUGAR || '' }) : cal.createAllDayEvent(x.EVENTO, d0, d1, { description: desc, location: x.LUGAR || '' });
      actualizarFila_(HOJAS.EVENTOS, x._fila, { GCAL_ID: ev.getId(), 'ORIGEN CAL': 'App' });
    }
  } catch (e) { Logger.log('Calendar: ' + e); }
}
function borrarDeCal_(x) { try { if (x.GCAL_ID && x['ORIGEN CAL'] !== 'Google') { var ev = calendario_().getEventById(x.GCAL_ID); if (ev) ev.deleteEvent(); } } catch (e) {} }
/** Cada hora: lo que pongas en tu Google Calendar con INSTAGRAM o CROSSFIT en el título entra en la app («Por decidir»). */
function sincronizarCalendario() {
  var hoy = hoyIso_(), desde = new Date(sumarDias(hoy, -7) + 'T00:00:00Z'), hasta = new Date(sumarDias(hoy, 120) + 'T00:00:00Z');
  var evs = calendario_().getEvents(desde, hasta).filter(function (e) { return /INSTAGRAM|CROSSFIT/i.test(e.getTitle()) && String(e.getDescription() || '').indexOf(MARCA_CAL) < 0; });
  var filas = listar_(HOJAS.EVENTOS), porG = {}; filas.forEach(function (r) { if (r.GCAL_ID) porG[r.GCAL_ID] = r; });
  var vistos = {};
  evs.forEach(function (e) {
    var id = e.getId(); vistos[id] = 1;
    var ini = e.isAllDayEvent() ? e.getAllDayStartDate() : e.getStartTime(), fin = e.isAllDayEvent() ? new Date(e.getAllDayEndDate().getTime() - 864e5) : e.getEndTime();
    var o = { EVENTO: e.getTitle(), TIPO: /CROSSFIT/i.test(e.getTitle()) ? 'Competición' : 'Personal', INICIO: Utilities.formatDate(ini, CONFIG.ZONA, 'dd/MM/yyyy'), FIN: Utilities.formatDate(fin, CONFIG.ZONA, 'dd/MM/yyyy'),
      HORA: e.isAllDayEvent() ? '' : Utilities.formatDate(ini, CONFIG.ZONA, 'HH:mm'), LUGAR: e.getLocation() || '' };
    var x = porG[id];
    if (x) { var cambia = ['EVENTO', 'INICIO', 'FIN', 'HORA', 'LUGAR'].some(function (k) { return String(x[k]) !== String(o[k]); }); if (cambia) actualizarFila_(HOJAS.EVENTOS, x._fila, o); return; }
    // Solo entra con tu aprobación (aviso en la app y en el informe del domingo); hasta entonces no cuenta para nada
    anadirFila_(HOJAS.EVENTOS, Object.assign(o, { ID: nuevoId_(), BLOQUEA: '', ESTADO: 'Pendiente de aprobar', NOTAS: 'Desde Google Calendar', CREADO: ahora_(), GCAL_ID: id, 'ORIGEN CAL': 'Google' }));
    if (pushActivo_()) enviarPush_('Nuevo en tu Google Calendar', o.EVENTO + ' (' + o.INICIO + '): ¿lo añado a Road To Elite?');
  });
  MEMO = null;
  listar_(HOJAS.EVENTOS).filter(function (r) { return r['ORIGEN CAL'] === 'Google' && !vistos[r.GCAL_ID] && celdaIso_(r.INICIO) >= sumarDias(hoy, -7); })
    .sort(function (a, b) { return b._fila - a._fila; }).forEach(function (r) { borrarFila_(HOJAS.EVENTOS, r._fila, { ID: r.ID }); });
}
/** Una vez: sube a Google Calendar los eventos de la app que aún no estén. */
function subirEventosACal_() { listar_(HOJAS.EVENTOS).forEach(function (r) { if (!r.GCAL_ID && r['ORIGEN CAL'] !== 'Google' && celdaIso_(r.FIN || r.INICIO) >= hoyIso_()) eventoACal_(r.ID); }); }

// ---------- 9 · Menú del Sheet (carga manual) ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Road To Elite')
    .addItem('Cargar Fabrik · semana siguiente', 'menuCargarFabrikSiguiente').addItem('Cargar Fabrik · esta semana', 'menuCargarFabrikActual')
    .addItem('Cargar extras · semana siguiente', 'menuExtrasSiguiente').addSeparator()
    .addItem('Semana en bloques · actualizar', 'menuSemanaBloques').addItem('Enviar por correo los estímulos de la semana', 'menuEnviarResumen').addToUi();
}
function menuCargarFabrikSiguiente() { SpreadsheetApp.getActive().toast(JSON.stringify(cargarFabrikSemana_(sumarDias(lunesDe_(hoyIso_()), 7)))); }
function menuCargarFabrikActual() { SpreadsheetApp.getActive().toast(JSON.stringify(cargarFabrikSemana_(lunesDe_(hoyIso_())))); }
function menuExtrasSiguiente() { SpreadsheetApp.getActive().toast(generarExtras_(sumarDias(lunesDe_(hoyIso_()), 7)).resumen); }

/** Lo nuevo que acompaña a la semana en cada respuesta. */
function extrasSemana_(lunes, base) {
  var out = { refuerzos: [], notasBloque: [], grabacion: {}, avisosVistos: String(leerConfig_().avisos_vistos || '').split(',').filter(Boolean),
    enduranceManana: enduranceManana_(),
    eventosPorAprobar: listar_(HOJAS.EVENTOS).filter(function (r) { return r.ESTADO === 'Pendiente de aprobar'; }),
    fabrikCargado: (base.plan || []).some(function (r) { return norm(r.ORIGEN) === 'FABRIK'; }), extras: leerConfig_()['extras_' + lunes] || '' };
  try { out.refuerzos = refuerzosDe_(lunes); out.refuerzosSig = refuerzosDe_(sumarDias(lunes, 7)); } catch (e) {}
  try { out.notasBloque = listar_(HOJAS.NOTAS).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); }); } catch (e) {}
  try { out.grabacion = grabacionSemana_(base); } catch (e) {}
  return out;
}

// ===================== v0.11 · BIBLIOTECA: Z6–Z8 LIGADOS A TUS CARENCIAS Y ALTERNATIVAS DE LA SESIÓN Q =====================
/**
 * APP · BIBLIOTECA (editable): cada fila es una sesión concreta.
 *  · Z6–Z8: variantes de los 4 protocolos de la guía (P1 híbrido · P2 RSA · P3 contraste aláctico · P4 modelado en metcon).
 *    El plan de carrera dice QUÉ protocolo toca cada semana; aquí se elige la VARIANTE que más ataca tus carencias
 *    (metas con más peso y menos cubiertas) y se ajusta la dosis al metcon de Fabrik de esa semana.
 *  · CALIDAD Z4 / Z5: alternativas a la sesión Q para adaptarla a la gente con la que corres.
 * CARENCIAS = códigos de metas que además cubre la sesión (cuentan en las metas). R01 = Z6–Z8; R02/R03 = calidad Z4/Z5.
 */
ESQUEMA['APP · BIBLIOTECA'] = {
  cab: ['ID', 'TIPO', 'PROTOCOLO', 'NOMBRE', 'CONTENIDO', 'ATACA (qué mejora)', 'CARENCIAS (códigos)', 'DÓNDE VA EN LA SESIÓN', 'CIENCIA (fisiología · biología)', 'SEMANA DURA (dosis)', 'GRUPO', 'ALTERNATIVA', 'EVITAR', 'REGISTRA', 'FUENTES', 'ACTIVO'],
  anchos: [60, 90, 80, 260, 320, 280, 120, 280, 360, 220, 60, 80, 220, 200, 220, 60], negrita: 'NOMBRE', congelarCol: 4,
  listas: { TIPO: ['Z6–Z8', 'CALIDAD Z4', 'CALIDAD Z5'], GRUPO: ['Sí', 'No'], ACTIVO: ['Sí', 'No'] },
  colores: [['ACTIVO', '^No$', '#5a5a5a', '#ffffff'], ['TIPO', 'Z6', '#fde8e8'], ['TIPO', 'Z4', '#fff2e0'], ['TIPO', 'Z5', '#ffe9d6']]
};
HOJAS.BIBLIOTECA = 'APP · BIBLIOTECA';
var FUENTE_GUIA_ = 'Guía Road to 2027 (anexo Z6–Z8)';
var BIBLIO_BASE_ = [
  // ---------------- P1 · Z6 HÍBRIDO (desoxigenación) ----------------
  ['P1A', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · bike + wall ball + jumping lunges',
    'EVERY 4′ × 4 RONDAS (5 en semanas avanzadas)\n40–50″ al 90–95 %:\n12/10 cal ASSAULT BIKE (pico de vatios)\n10 WALL BALL (9 kg)\n10 JUMPING LUNGES\nResto de los 4′: Z1 muy suave\n\nREGLA: si las calorías caen más de 2 de la 1.ª a la última ronda, corta.',
    'Seguir produciendo potencia cuando el cuádriceps ya está ácido: lo que te pasa en la 3.ª–4.ª ronda de un metcon con bici y wall balls.',
    'R01|W07', 'PM, como metcon del día o detrás de fuerza moderada de tren superior. ≥48 h de la calidad de carrera y ≥6 h de la Z2.',
    'La bici dispara la glucólisis y empieza a vaciar de O₂ el músculo; wall balls y saltos aprietan el cuádriceps (oclusión mecánica) bajo acidez y obligan a extraer más O₂ por latido. La pausa larga rellena la fosfocreatina. Adaptación: más transportadores de lactato MCT1/MCT4, más capacidad tampón y mejor extracción periférica.',
    '3 rondas en vez de 4 si Fabrik ya trae ≥2 metcons de RPE ≥8 esa semana.', 'No', 'P1B', 'Víspera de calidad de carrera o de pierna pesada; justo después de un metcon largo.', 'calorías por ronda, tiempo de cada ronda, RPE', FUENTE_GUIA_ + '; Buchheit & Laursen 2013'],
  ['P1B', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · bike + HSPU + DU',
    'EVERY 4′ × 4 RONDAS\n40–50″ al 90–95 %:\n12/10 cal ASSAULT BIKE\n6–8 KIPPING HSPU\n30 DOUBLE UNDERS\nResto de los 4′: Z1 muy suave\n\nREGLA: HSPU sin fallo; si una ronda tiene 2 fallos, la siguiente baja a 5.',
    'HSPU que se rompen con las pulsaciones a tope (tu prioridad P1) y comba en fatiga.',
    'R01|W31|W07', 'PM, como metcon del día. No el día de jerk ni de HSPU estricto pesado.',
    'La bici sube el lactato y la FC; los HSPU obligan al hombro a producir fuerza con el sistema cardiovascular al límite (fatiga central + periférica), igual que en competición. Con ~2′ de pausa se recarga la fosfocreatina: practicas la técnica bajo acidez sin degradarla.',
    '3 rondas y 5 HSPU si la semana de Fabrik va cargada de hombro.', 'No', 'P1A', 'Hombro marcado como cargado en el chequeo; día antes de jerk/press pesado.', 'HSPU por ronda, fallos, calorías', FUENTE_GUIA_],
  ['P1C', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · ski + trineo + burpee broad jump',
    'EVERY 4′ × 4 RONDAS\n40–50″ al 90–95 %:\n12/10 cal SKIERG\n15 m SLED PUSH (pesado, sin parar)\n6 BURPEE BROAD JUMPS\nResto de los 4′: Z1 muy suave',
    'Transiciones tipo HYROX y empuje de trineo con ácido; arranques explosivos cansado.',
    'R01|M38|W07', 'PM, en un día sin pierna pesada en Fabrik.',
    'El SkiErg recluta dorsal y core (tren superior) y el trineo es extensión de cadera casi sin fase excéntrica: mucha potencia con poco daño muscular, así que no lastra la carrera del día siguiente.',
    '3 rondas si la semana es dura.', 'No', 'P1A', 'Lumbar cargada.', 'calorías, tiempo del trineo, RPE', FUENTE_GUIA_],
  ['P1D', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · bike + C2B + heavy rope',
    'EVERY 4′ × 4 RONDAS\n40–50″ al 90–95 %:\n12/10 cal ASSAULT BIKE\n6–8 CHEST TO BAR\n20 HEAVY ROPE SINGLE UNDERS (o 10 heavy rope DU)\nResto de los 4′: Z1 muy suave',
    'C2B en fatiga (meta mensual) y comba pesada, con la bici como acelerador del lactato.',
    'R01|M01|M33', 'PM, como metcon. No el día de muscle ups o tirón pesado.',
    'La fatiga del agarre y del dorsal llega con acidez sistémica: entrenas la eficiencia del kipping cuando el cuerpo ya no tiene margen. La comba pesada añade trabajo de hombro y antebrazo con poco impacto.',
    '3 rondas si el agarre viene tocado.', 'No', 'P1B', 'Agarre/antebrazo marcado como cargado.', 'C2B por ronda, calorías', FUENTE_GUIA_],
  // ---------------- P2 · RSA Z7–Z8 ----------------
  ['P2A', 'Z6–Z8', 'P2', 'P2 · RSA · Assault/BikeErg 6×15″',
    '10′ de descanso tras la barra\n5′ AIR BIKE / BIKEERG fácil + 2 aceleraciones de 5″\n6 × 15″ ALL-OUT (8 × en semanas avanzadas)\n/ 1′45″ pasivo o Z1 muy suave\n5′ suaves\n\nREGISTRA: W pico y W medio de cada sprint. Índice de fatiga = caída de W del 1.º al último (objetivo <15 %).',
    'Repetir el pico: que tu 6.º esfuerzo se parezca al 1.º. Es tu limitante (la potencia cae tras las primeras rondas).',
    'R01', 'Al final de una sesión de haltero o cadena posterior, 10′ después de la barra. Puede ir el mismo día que una Z2 de mañana (≥6 h).',
    'El 1.er sprint sale de fosfocreatina + glucólisis; con descanso incompleto la mitocondria tiene que rellenar la fosfocreatina, así que los sprints repetidos son también un estímulo aeróbico potente. Más MCT1/MCT4, mejor bomba Na⁺/K⁺ y más tampón. En bici no hay fase excéntrica: no compromete la carrera.',
    '5 sprints si Fabrik ya trae ≥2 metcons de RPE ≥8.', 'No', 'P2B', 'Antes del haltero o después de un metcon largo.', 'W pico/medio por sprint, % de caída', FUENTE_GUIA_ + '; Bishop, Girard & Mendez-Villanueva 2011'],
  ['P2B', 'Z6–Z8', 'P2', 'P2 · RSA · SkiErg 6×12″',
    '5′ SKIERG fácil + 2 aceleraciones\n6 × 12″ ALL-OUT SKIERG / 1′30″ pasivo\n5′ suaves\n\nREGISTRA: vatios pico y medio por sprint.',
    'Lo mismo que el P2 en bici pero cargando tren superior y core: úsalo si el chequeo marca cuádriceps/gemelo cargados o hay carrera al día siguiente.',
    'R01', 'Al final de una sesión de pierna o de haltero, 10′ tras la barra.',
    'Misma lógica de sprints repetidos (fosfocreatina → resíntesis mitocondrial) con la pierna casi descargada. Transfiere a las calorías de ski de los metcons y al tirón de los gimnásticos.',
    '5 sprints si la semana es dura.', 'No', 'P2A', 'Dorsal/hombro cargados.', 'W pico/medio por sprint', 'Bishop, Girard & Mendez-Villanueva 2011'],
  ['P2C', 'Z6–Z8', 'P2', 'P2 · RSA · cuestas 6×10″',
    '10′ trote + 3 progresivos\n6–8 × 10–12″ CUESTA (6–8 %) a tope / bajar andando (~1′40″)\n8′ suaves',
    'Potencia de zancada y economía de carrera. Encaja si sales a correr con el grupo y hay una cuesta.',
    'R01', 'PM o tras la Z2 corta, nunca la víspera de la calidad. Lejos de pierna pesada.',
    'Sprint aláctico-láctico corto con alto reclutamiento de fibras rápidas; la cuesta reduce la fase de frenado (menos daño excéntrico que el sprint en llano) y mejora la rigidez del tendón y la economía de carrera.',
    '6 repeticiones máximo en semana dura.', 'Sí', 'P2A', 'Gemelo/Aquiles marcados como cargados.', 'tiempo o metros por repetición, RPE', 'Bishop, Girard & Mendez-Villanueva 2011'],
  ['P2D', 'Z6–Z8', 'P2', 'P2 · RSA · remo 6×15″',
    '5′ remo fácil\n6 × 15″ ALL-OUT ROWERG / 1′45″ pasivo\n5′ suaves\n\nREGISTRA: vatios pico y medio, ritmo /500 m.',
    'Sprints repetidos específicos de HYROX y de los «max cal row» de los metcons.',
    'R01', 'Al final de una sesión de haltero, 10′ tras la barra.',
    'Combina tren superior e inferior sin impacto; misma resíntesis de fosfocreatina entre sprints que la bici.',
    '5 sprints si la semana es dura.', 'No', 'P2A', 'Lumbar cargada.', 'W pico/medio', 'Bishop, Girard & Mendez-Villanueva 2011'],
  // ---------------- P3 · CONTRASTE Z8 ALÁCTICO ----------------
  ['P3A', 'Z6–Z8', 'P3', 'P3 · Contraste · power snatch/clean + sprint',
    'Tras el calentamiento de haltero de Fabrik\n4–5 RONDAS:\n2 POWER SNATCH o POWER CLEAN 40–50 % (máxima velocidad de barra)\n→ 60″\n10–12″ SKIERG o SLED SPRINT ligero al 100 %\n→ 2–3′ de descanso completo\n\nREGLA: si baja la velocidad, se corta. Sin ácido, sin jadeo: es neural.',
    'Velocidad de reclutamiento: que la barra «suba sola» con el mismo % (barbell cycling, T&G) y arranques más explosivos.',
    'R01', 'Al principio: justo después del calentamiento de haltero y ANTES de la fuerza o halterofilia de Fabrik. Vale en semanas de descarga y a ≥72 h de un test.',
    'Esfuerzos <10–12″ se alimentan de ATP y fosfocreatina sin acumular lactato. La potenciación (PAPE) del levantamiento rápido hace que el sprint salga más potente. Adaptación neural: más unidades motoras a la vez, mayor frecuencia de disparo, mejor coordinación. 2–3′ para tener la fosfocreatina llena en cada ronda.',
    'Es la variante que menos fatiga: se mantiene aunque la semana sea dura.', 'No', 'P3B', 'Nunca después de un metcon.', 'kg, velocidad percibida, metros/calorías del sprint', FUENTE_GUIA_],
  ['P3B', 'Z6–Z8', 'P3', 'P3 · Contraste francés + sprint (pierna)',
    '4 RONDAS:\n2 BACK SQUAT 85 %\n→ 20″\n3 BOX JUMPS (altos, bajando del cajón)\n→ 20″\n3 DB JUMP SQUATS (2×10 kg)\n→ 20″\n3 BAND-ASSISTED JUMPS (o saltos verticales rápidos)\n→ 60″\n8″ BIKE SPRINT al 100 %\n→ 3′ de descanso',
    'Potencia de pierna con los cuatro estímulos del contraste francés (meta mensual) y arranque explosivo.',
    'R01|M52|W07', 'Al principio de la sesión, tras calentar, en lugar del bloque de fuerza de pierna o antes del haltero. Nunca tras metcon.',
    'Fuerza pesada → pliometría sin carga → salto balístico con carga ligera → salto asistido: recorre toda la curva fuerza-velocidad y aprovecha la potenciación de cada estímulo sobre el siguiente. Todo aláctico (fosfocreatina) con descanso completo.',
    'Se mantiene 4 rondas; si la pierna viene muy cargada, 3.', 'No', 'P3A', 'Pierna marcada ≥7 de agujetas; día antes de calidad.', 'kg de la sentadilla, altura del cajón, sensaciones de velocidad', 'Contraste francés (Cometti); ' + FUENTE_GUIA_],
  ['P3C', 'Z6–Z8', 'P3', 'P3 · Aláctico tren superior · HSPU reactivo + ski',
    '5 RONDAS:\n3 KIPPING HSPU explosivos (máxima velocidad, reinicio controlado)\n→ 60″\n10″ SKIERG al 100 %\n→ 2′30″ de descanso',
    'HSPU kipping técnico/reactivo (meta semanal P1) con potencia de tren superior.',
    'R01|W15', 'Al principio de la sesión, con el hombro fresco. No el día de HSPU estricto pesado.',
    'Ciclo estiramiento-acortamiento del tren superior a máxima velocidad: adaptación neural del empuje sin fatiga glucolítica. El sprint de ski aprovecha la potenciación del tren superior.',
    'Se mantiene: no fatiga.', 'No', 'P3A', 'Hombro cargado.', 'HSPU limpios, vatios del ski', FUENTE_GUIA_],
  ['P3D', 'Z6–Z8', 'P3', 'P3 · Contraste · push jerk rápido + trineo',
    '5 RONDAS:\n2 PUSH JERK 50–60 % (máxima velocidad)\n→ 60″\n10″ SLED PUSH ligero al 100 %\n→ 2–3′ de descanso',
    'Drive del jerk más rápido y empuje explosivo de trineo.',
    'R01|M38', 'Al principio, antes de la halterofilia de Fabrik.',
    'Mismo contraste aláctico (PAPE) con el patrón de empuje vertical + extensión de cadera.',
    'Se mantiene.', 'No', 'P3A', 'Hombro o lumbar cargados.', 'kg, metros del trineo', FUENTE_GUIA_],
  // ---------------- P4 · MODELADO EN METCON VT2 → Z6 ----------------
  ['P4A', 'Z6–Z8', 'P4', 'P4 · Modelado · burpees VT2 + power snatch',
    'EMOM 12′ (16′ en semanas avanzadas)\nMIN IMPAR · UMBRAL (VT2): 13 BURPEES TO TARGET (o 16 kipping pull-ups / remo a ritmo VT2)\nMIN PAR · PICO (Z6): 11 POWER SNATCH 40–50 kg en <45″\n\nREGLA: el snatch del último minuto par en <45″; si no llega, la carga era alta: baja 5 kg.',
    'Limpiar el ácido del pico mientras sigues moviéndote: la caída de potencia tras las primeras rondas.',
    'R01', 'Ocupa el sitio del metcon del día (puede ser el propio metcon de Fabrik si encaja). Detrás de fuerza moderada de tren superior o técnica. No el mismo día que P1/P2 ni la víspera de la calidad.',
    'Lanzadera de lactato: en el minuto de snatch las fibras rápidas producen lactato; en el minuto a umbral las lentas y el corazón lo captan (MCT1) y lo oxidan. Fatigan el H⁺ y el fosfato, no el lactato: aclararlo rápido es rendir. Necesita base de Z2.',
    '12′ (no 16′) si la semana es dura.', 'No', 'P4B', 'Antes de halterofilia pesada.', 'reps por minuto, tiempo del último snatch', FUENTE_GUIA_],
  ['P4B', 'Z6–Z8', 'P4', 'P4 · Modelado · remo VT2 + HSPU + power clean',
    'EMOM 12′ (16′ en semanas avanzadas)\nMIN IMPAR · VT2: 12/10 cal ROW\nMIN PAR · Z6: 6 KIPPING HSPU + 4 POWER CLEAN 60 % en <40″',
    'HSPU en fatiga (meta semanal P1) dentro del formato real de un WOD.',
    'R01|W31', 'Como metcon del día. No el día de jerk o HSPU estricto pesado.',
    'Igual que el P4 base: alternar por encima y por debajo de umbral entrena el reciclaje del lactato; el hombro trabaja con acidez sistémica.',
    '12′ si la semana es dura.', 'No', 'P4A', 'Hombro cargado.', 'HSPU y cleans por minuto', FUENTE_GUIA_],
  ['P4C', 'Z6–Z8', 'P4', 'P4 · Modelado · DU VT2 + thrusters',
    'EMOM 12′ = 6 RONDAS de 2′\nMIN IMPAR · VT2: 40 DOUBLE UNDERS\nMIN PAR · Z6: 10 THRUSTERS 42,5 kg en <30″ + calorías de bike hasta el final del minuto',
    'Thrusters con barra ligera en volumen y DU en fatiga.',
    'R01|T02|W07', 'Como metcon del día, lejos de la sentadilla pesada.',
    'Los thrusters producen el pico glucolítico; la comba a ritmo VT2 obliga a aclarar sin parar, con gemelo y hombro implicados como en los chippers.',
    '12′ (no más) si la semana es dura.', 'No', 'P4A', 'Cuádriceps o gemelo cargados.', 'reps por minuto, fallos de comba', FUENTE_GUIA_],
  ['P4D', 'Z6–Z8', 'P4', 'P4 · Modelado · ski VT2 + bar muscle up',
    'EMOM 12′\nMIN IMPAR · VT2: 12/10 cal SKIERG\nMIN PAR · Z6: 3–5 BAR MUSCLE UP + 6 TOES TO BAR',
    'BMU en fatiga específica (meta mensual) en formato metcon.',
    'R01|M48', 'Como metcon, con el agarre fresco.',
    'El gimnástico de alta potencia aparece con lactato alto: entrenas la eficiencia del kipping y la tolerancia del agarre.',
    '12′ y 3 BMU si la semana es dura.', 'No', 'P4E', 'Agarre cargado.', 'BMU por minuto', FUENTE_GUIA_],
  ['P4E', 'Z6–Z8', 'P4', 'P4 · Modelado · ski VT2 + ring muscle up',
    'EMOM 12′\nMIN IMPAR · VT2: 12/10 cal SKIERG\nMIN PAR · Z6: 2–4 RING MUSCLE UP + 6 TOES TO BAR',
    'RMU en fatiga específica (meta mensual).',
    'R01|M49', 'Como metcon, con el agarre fresco.',
    'Igual que la versión con barra; la anilla añade control de la transición con el hombro ya fatigado.',
    '12′ y 2 RMU si la semana es dura.', 'No', 'P4D', 'Agarre u hombro cargados.', 'RMU por minuto', FUENTE_GUIA_],
  ['P4F', 'Z6–Z8', 'P4', 'P4 · Modelado · burpees VT2 + STOH T&G',
    'EMOM 12′\nMIN IMPAR · VT2: 13 BURPEES TO TARGET\nMIN PAR · Z6: 8 SHOULDER TO OVERHEAD T&G 50 kg en <40″',
    'Barbell cycling de STOH (meta mensual T&G STOH).',
    'R01|M07', 'Como metcon; no el día de jerk pesado.',
    'Pico glucolítico con barra + aclarado a umbral: lanzadera de lactato con el patrón de empuje.',
    '12′ si la semana es dura.', 'No', 'P4A', 'Hombro cargado.', 'reps por minuto', FUENTE_GUIA_],
  // ---------------- CALIDAD Z4 · UMBRAL (VT2) ----------------
  ['Q4A', 'CALIDAD Z4', 'Z4', 'Cruise intervals 3×8′ a ritmo T / 2′ trote',
    '12′ fáciles + 3×15″ progresivos\n3 × 8′ a ritmo umbral (T) / 2′ trote\n8–10′ suaves',
    'Sube el umbral de lactato (VT2): es lo que más mueve tu 10 km y lo que te deja sostener ritmo alto en los metcons largos.',
    'R02', 'AM, con PM de tren superior. ≥48 h del Z6–Z8.',
    'A ritmo T el lactato está estable pero alto: las pausas cortas permiten acumular más tiempo a umbral con la misma fatiga que un tempo continuo. Aumenta MCT1, capilarización y la capacidad de aclarar lactato.',
    '2×8′ si la semana es dura o hay WOD importante al día siguiente.', 'No', 'Q4B', 'Día después de pierna pesada.', 'parciales, ritmo medio de cada serie, FC media (banda)', 'Daniels\' Running Formula'],
  ['Q4B', 'CALIDAD Z4', 'Z4', 'Fartlek de umbral 8×(2′ fuerte / 1′ suave)',
    '12′ fáciles\n8 × (2′ fuerte a ritmo T / 1′ suave)\n8′ suaves',
    'Mismo estímulo de umbral. Ideal en grupo: cada uno corre a su ritmo T en los 2′ y os reagrupáis en el minuto suave.',
    'R02', 'AM o con el grupo; ≥48 h del Z6–Z8.',
    'Tiempo acumulado cerca de VT2 (≈16′) en bloques cortos: más fácil de sostener en grupo y sin pista. Misma adaptación de aclarado de lactato.',
    '6 repeticiones si la semana es dura.', 'Sí', 'Q4A', '—', 'ritmo de cada bloque, FC (banda)', 'Seiler 2010; Daniels\' Running Formula'],
  ['Q4C', 'CALIDAD Z4', 'Z4', 'Tempo continuo 20′ a ritmo T',
    '12′ fáciles\n20′ continuos a ritmo umbral\n8′ suaves',
    'Umbral + resistencia mental a ritmo sostenido. Mejor si corres solo.',
    'R02', 'AM, ≥48 h del Z6–Z8.',
    'Esfuerzo continuo en el máximo estado estable de lactato: entrena la economía a ritmo de 10K.',
    '15′ si la semana es dura.', 'No', 'Q4A', '—', 'ritmo medio, FC media y deriva', 'Daniels\' Running Formula'],
  ['Q4D', 'CALIDAD Z4', 'Z4', '4×2000 m a ritmo 10K / 2′',
    '15′ fáciles\n4 × 2000 m a ritmo de 10K / 2′ trote\n10′ suaves',
    'Ritmo específico de 10 km en pista.',
    'R02', 'AM, en pista.',
    'Trabajo justo por encima de umbral: eleva el ritmo sostenible en 10K.',
    '3 × 2000 m si la semana es dura.', 'No', 'Q4A', '—', 'tiempo de cada 2000', 'Daniels\' Running Formula'],
  ['Q4E', 'CALIDAD Z4', 'Z4', 'Cuestas largas 6×2′ a esfuerzo T',
    '12′ fáciles\n6 × 2′ en cuesta suave (4–6 %) a esfuerzo de umbral / bajar trotando\n8′ suaves',
    'Umbral + fuerza específica de carrera con menos impacto que el llano rápido. Buena si el grupo hace cuestas.',
    'R02', 'AM; lejos de pierna pesada.',
    'Mismo estímulo metabólico de umbral con más reclutamiento muscular por zancada y menos carga excéntrica.',
    '5 repeticiones si la semana es dura.', 'Sí', 'Q4A', 'Gemelo/Aquiles cargados.', 'tiempo de subida, FC', 'Barnes & Kilding 2015 (economía de carrera)'],
  // ---------------- CALIDAD Z5 · VO2max ----------------
  ['Q5A', 'CALIDAD Z5', 'Z5', '6×500 m / 4×800 m a vVO₂max',
    '15′ fáciles + progresivos\n6 × 500 m (o 4 × 800 m) a ritmo de 3 km / vVO₂max · 2′–2′30″ trote\n10′ suaves',
    'Sube el techo aeróbico (VO₂max): más margen para todo lo que va por debajo.',
    'R03', 'AM, ≥48 h del Z6–Z8 y nunca el mismo día que pierna pesada.',
    'Repeticiones de 2–3′ a vVO₂max llevan el consumo de O₂ a su máximo varias veces: gasto cardiaco y volumen sistólico, la limitación central del VO₂max.',
    '5 × 500 / 3 × 800 si la semana es dura.', 'No', 'Q5B', 'Pierna cargada.', 'tiempo de cada repetición, FC máx', 'Buchheit & Laursen 2013'],
  ['Q5B', 'CALIDAD Z5', 'Z5', 'Billat 30/30 · 2 bloques × 8–10',
    '15′ fáciles\n2 bloques × 8–10 (30″ a vVO₂max / 30″ trote) · 3′ entre bloques\n10′ suaves',
    'VO₂max con poca fatiga y fácil de hacer en grupo: todos salís y paráis a la vez.',
    'R03', 'AM o con el grupo; ≥48 h del Z6–Z8.',
    'El 30/30 a vVO₂max mantiene más tiempo cerca del VO₂max que un esfuerzo continuo de la misma intensidad media, con menos lactato acumulado.',
    '2 × 8 si la semana es dura.', 'Sí', 'Q5A', '—', 'ritmo de las fases rápidas, FC', 'Billat et al. 2000 (30/30)'],
  ['Q5C', 'CALIDAD Z5', 'Z5', '4×4′ noruego al 90–95 % FCmáx',
    '15′ fáciles\n4 × 4′ al 90–95 % de la FC máxima / 3′ trote activo\n10′ suaves',
    'VO₂max controlado por pulso con tu banda de pecho.',
    'R03', 'AM, ≥48 h del Z6–Z8.',
    'Protocolo con la mejor evidencia de mejora del VO₂max frente al trabajo moderado: 16′ en la zona alta del gasto cardiaco.',
    '3 × 4′ si la semana es dura.', 'No', 'Q5A', '—', 'FC media de cada 4′, ritmo', 'Helgerud et al. 2007'],
  ['Q5D', 'CALIDAD Z5', 'Z5', 'Fartlek 10×1′ fuerte / 1′ suave',
    '15′ fáciles\n10 × (1′ fuerte / 1′ suave)\n10′ suaves',
    'VO₂max en grupo y sin pista; cada uno a su ritmo fuerte.',
    'R03', 'AM o con el grupo.',
    'Intervalos cortos a intensidad cercana al VO₂max acumulando ~10′ arriba con recuperaciones activas.',
    '8 repeticiones si la semana es dura.', 'Sí', 'Q5B', '—', 'ritmo de los minutos fuertes', 'Buchheit & Laursen 2013']
];
function sembrarBiblioteca_() {
  var ya = {}; listar_(HOJAS.BIBLIOTECA).forEach(function (r) { ya[r.ID] = 1; });
  var cab = ESQUEMA['APP · BIBLIOTECA'].cab, filas = BIBLIO_BASE_.filter(function (e) { return !ya[e[0]]; });
  if (!filas.length) return 0;
  var sh = hojaMia_(HOJAS.BIBLIOTECA), c2 = cabeceras_(sh);
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, filas.length, c2.length).setValues(filas.map(function (f) { var o = {}; cab.forEach(function (h, i) { o[h] = f[i]; }); o.ACTIVO = 'Sí'; return filaDe_(c2, o); }));
  return filas.length;
}
function biblioteca_() {
  var filas = [];
  try { filas = listar_(HOJAS.BIBLIOTECA); } catch (e) {}
  if (!filas.length) filas = BIBLIO_BASE_.map(function (f) { var o = {}; ESQUEMA['APP · BIBLIOTECA'].cab.forEach(function (h, i) { o[h] = f[i]; }); o.ACTIVO = 'Sí'; return o; });
  return filas.filter(function (r) { return r.ID && r.ACTIVO !== 'No'; });
}

/** Peso de cada código según tus metas: prioridad alta y poco cubierta = más peso (lo que más te falta). */
function pesoCarencias_(lunes) {
  var c = cacheMetas_(), out = {};
  var add = function (lista) {
    lista.forEach(function (m) {
      var pr = PRIO_ORDEN(m.prioridad), w = (pr <= 1 ? 3 : pr === 2 ? 2.5 : pr === 3 ? 2 : pr <= 5 ? 1.5 : 1) * (1 - Math.min(1, m.pProg || 0));
      codigosDe_(m.codigos).forEach(function (k) { out[k] = Math.max(out[k] || 0, w); });
    });
  };
  add(avanceMetas_('Semana', periodoSemana_(lunes), c));
  add(avanceMetas_('Mes', periodoMes_(lunes), c));
  return out;
}
/** ¿Cuánto aprieta el metcon de Fabrik esta semana? (RPE ≥8 o notas de Gabi que piden intensidad). */
function metconDuro_(lunes) {
  var n = 0;
  listar_(HOJAS.PLAN).forEach(function (r) {
    var d = celdaIso_(r.FECHA); if (norm(r.ORIGEN) !== 'FABRIK' || d < lunes || d > sumarDias(lunes, 6) || /OCULTO|NO HACER/.test(r.ESTADO)) return;
    if (!/METCON|WOD/.test(norm(r['TÍTULO'] + ' ' + r.BLOQUE))) return;
    var rpe = parseInt(String(r.INTENSIDAD || '').replace(/[^\d]/g, ''), 10) || 0, nota = norm(r['POR QUÉ (cursiva)'] || '');
    if (rpe >= 8 || /RPE 8|RPE 9|ALTA INTENSIDAD|AUMENTAMOS LA INTENSIDAD|MAXIMO ESFUERZO|ALL OUT/.test(nota)) n++;
  });
  return n;
}
/** Elige la variante Z6–Z8 de la biblioteca para el protocolo que pide el plan (P1–P4). */
function elegirZ68_(protocolo, lunes, excluir) {
  var lista = biblioteca_().filter(function (r) { return r.TIPO === 'Z6–Z8' && (!protocolo || r.PROTOCOLO === protocolo) && r.ID !== excluir; });
  if (!lista.length) return null;
  var w = pesoCarencias_(lunes);
  var punt = function (r) { return codigosDe_(r['CARENCIAS (códigos)']).reduce(function (a, c) { return a + (c === 'R01' ? 0 : (w[c] || 0)); }, 0); };
  lista.sort(function (a, b) { return punt(b) - punt(a) || (a.ID < b.ID ? -1 : 1); });
  var mejor = lista[0];
  return { fila: mejor, puntos: punt(mejor), ataca: codigosDe_(mejor['CARENCIAS (códigos)']).filter(function (c) { return c !== 'R01' && w[c] > 0; }) };
}
/** Bloque Z6–Z8 completo (contenido, por qué, ciencia, dónde va y alternativa) a partir de la biblioteca. */
function bloqueZ68_(s, lunes) {
  var nt = norm(s['TÍTULO'] + ' ' + s.CONTENIDO), p = (nt.match(/\bP([1-4])\b/) || [])[1];
  if (!p) p = /RSA|SPRINT/.test(nt) ? '2' : /CONTRASTE|ALACTIC/.test(nt) ? '3' : /MODELADO|METCON/.test(nt) ? '4' : /HIBRID|DESOXIGEN/.test(nt) ? '1' : '';
  var el = elegirZ68_(p ? 'P' + p : '', lunes); if (!el) return s;
  var r = el.fila, duro = metconDuro_(lunes) >= 2, alt = biblioteca_().filter(function (x) { return x.ID === r.ALTERNATIVA && x.ID !== r.ID; })[0];
  if (!alt) { var e2 = elegirZ68_(r.PROTOCOLO, lunes, r.ID); alt = e2 ? e2.fila : null; }
  var cods = codigosDe_(s['CÓDIGOS']).concat(codigosDe_(r['CARENCIAS (códigos)'])).filter(function (c, i, a) { return a.indexOf(c) === i; });
  var nombresMeta = el.ataca.length ? ' Además cubre ' + el.ataca.join(', ') + ', de lo que más te falta.' : '';
  return Object.assign({}, s, {
    'TÍTULO': 'POTENCIA · ' + r.NOMBRE,
    CONTENIDO: r.CONTENIDO + (duro && r['SEMANA DURA (dosis)'] ? '\n\n⚙ Semana dura de Fabrik (≥2 metcons de RPE ≥8): ' + r['SEMANA DURA (dosis)'] : '') + '\n\nDónde va: ' + r['DÓNDE VA EN LA SESIÓN'] + (r.REGISTRA ? '\n\nRegistra: ' + r.REGISTRA : ''),
    'CÓDIGOS': cods.join('|'), CANTIDAD: saltosTexto_(r.CONTENIDO) || '',
    'POR QUÉ (cursiva)': [r['ATACA (qué mejora)'] + nombresMeta, s['POR QUÉ (cursiva)']].filter(Boolean).join(' '),
    'CIENCIA (técnica · fisiología · biología)': r['CIENCIA (fisiología · biología)'],
    INTERFERENCIAS: r.EVITAR ? 'Evitar: ' + r.EVITAR : s.INTERFERENCIAS,
    ALTERNATIVAS: alt ? '↔ ' + alt.NOMBRE + '\n' + alt.CONTENIDO + '\n\nCuándo elegirla: ' + alt['ATACA (qué mejora)'] + '\nCiencia: ' + alt['CIENCIA (fisiología · biología)'] + '\nDónde va: ' + alt['DÓNDE VA EN LA SESIÓN'] : ''
  });
}
/** Alternativas de la sesión Q (calidad Z4 o Z5): la del plan es la recomendada; dos más para adaptarla a la gente con la que corres. */
function alternativasQ_(s) {
  var z5 = /R03/.test(s['CÓDIGOS']), tipo = z5 ? 'CALIDAD Z5' : 'CALIDAD Z4';
  var lista = biblioteca_().filter(function (r) { return r.TIPO === tipo; });
  if (!lista.length) return '';
  var nt = norm(s.CONTENIDO), parecida = function (r) { var n = norm(r.NOMBRE); return (/FARTLEK/.test(n) && /FARTLEK/.test(nt)) || (/CUESTA/.test(n) && /CUESTA/.test(nt)) || (/30\/30/.test(n) && /30\/30/.test(nt)); };
  var grupo = lista.filter(function (r) { return r.GRUPO === 'Sí' && !parecida(r); })[0];
  var otra = lista.filter(function (r) { return r !== grupo && !parecida(r) && r.GRUPO !== 'Sí'; })[0] || lista.filter(function (r) { return r !== grupo; })[0];
  // dosis de la recomendada: minutos totales a ritmo (p. ej. 2×6′ = 12′)
  var dosis = 0, m, re = /(\d+)\s*[×X]\s*(\d+)\s*[′']/g; while ((m = re.exec(s.CONTENIDO || ''))) dosis += +m[1] * +m[2];
  var txt = ['★ RECOMENDADA: la del plan. ' + (z5 ? 'Es la Z5 del mes según la guía (techo aeróbico).' : 'Sigue la progresión de umbral de la guía (noviembre: base y VT2, lo que más mueve el 10 km).') +
    ' Su dosis está ajustada a tu semana' + (dosis ? ' (≈' + dosis + '′ de trabajo a ritmo)' : '') + ': si cambias, respeta esa dosis.'];
  [grupo, otra].filter(Boolean).forEach(function (r, i) {
    txt.push((i ? '↔ OTRA OPCIÓN' : '👥 EN GRUPO') + ': ' + r.NOMBRE + '\n' + r.CONTENIDO + (dosis ? '\n(ajústala a ≈' + dosis + '′ de trabajo a ritmo, como la recomendada)' : '') +
      '\nAtaca: ' + r['ATACA (qué mejora)'] + '\nCiencia: ' + r['CIENCIA (fisiología · biología)']);
  });
  return txt.join('\n\n');
}

// ===================== v0.11 · CHEQUEO POR SENSACIONES (sin Garmin) =====================
/**
 * Se rellena al abrir la sesión del día (≈15 s): cansancio 1–10, agujetas / cuerpo trabajado 1–10, zonas cargadas y sueño.
 * Se cruza con lo que toca hoy y con lo de las 48–72 h anteriores (etiquetas de carga de cada bloque): avisa de choques
 * y explica el probable origen. En los días de carrera se guarda junto a la sesión para explicar sus resultados.
 * Los únicos datos de Garmin (banda de pecho) se piden en los bloques de carrera.
 */
ESQUEMA['APP · CHEQUEO'] = {
  cab: ['FECHA', 'CANSANCIO (1-10)', 'AGUJETAS (1-10)', 'ZONAS CARGADAS', 'SUEÑO', 'NOTAS', 'LISTO (0-100)', 'SEMÁFORO', 'RECOMENDACIÓN', 'REGISTRADO'],
  anchos: [95, 90, 90, 260, 80, 240, 80, 80, 520, 120], fechas: ['FECHA'],
  listas: { 'SEMÁFORO': ['Verde', 'Ámbar', 'Rojo'], 'SUEÑO': ['Bien', 'Regular', 'Mal'] },
  colores: [['SEMÁFORO', 'Verde', '#e0f5e6'], ['SEMÁFORO', 'Ámbar', '#fff2cc'], ['SEMÁFORO', 'Rojo', '#fbe0e0']]
};
CAMPOS_CHEQUEO = ['FECHA', 'CANSANCIO (1-10)', 'AGUJETAS (1-10)', 'ZONAS CARGADAS', 'SUEÑO', 'NOTAS'];
var ZONAS_ = ['Hombros', 'Codos / antebrazo (agarre)', 'Dorsal / espalda alta', 'Lumbar', 'Core', 'Cadera / glúteo', 'Cuádriceps', 'Isquios', 'Gemelo / sóleo', 'Tobillo / Aquiles', 'Rodillas', 'Pies'];
var ZONA_CARGA_ = { 'Hombros': ['HOMBRO'], 'Codos / antebrazo (agarre)': ['AGARRE'], 'Dorsal / espalda alta': ['AGARRE'], 'Lumbar': ['PIERNA'], 'Core': ['CORE'],
  'Cadera / glúteo': ['PIERNA'], 'Cuádriceps': ['PIERNA'], 'Isquios': ['PIERNA'], 'Gemelo / sóleo': ['IMPACTO'], 'Tobillo / Aquiles': ['IMPACTO'], 'Rodillas': ['PIERNA', 'IMPACTO'], 'Pies': ['IMPACTO'] };
var CONSEJO_CARGA_ = {
  HOMBRO: 'baja un nivel (RIR +1 y −20 % de volumen); HSPU → strict press ligero o pike push-ups si molesta',
  PIERNA: 'sentadilla y saltos −20 % o RIR +1; en el metcon, escala la carga de pierna',
  AGARRE: 'tiza y tandas cortas desde la 1.ª ronda; kipping → estricto o ring rows si hay dolor',
  IMPACTO: 'corre en llano o en cinta y por sensaciones, o pasa la Z2 a bici/remo; saltos → step ups',
  CORE: 'sin volumen de GHD ni T2B; core de control (dead bug, pallof)'
};
function zonasDe_(v) { return String(v || '').split(/\s*[,;|]\s*/).map(function (z) { return z.trim(); }).filter(function (z) { return ZONAS_.indexOf(z) >= 0; }); }
function filasActivasDia_(iso) {
  return listar_(HOJAS.PLAN).filter(function (r) { return celdaIso_(r.FECHA) === iso && !/^(SUSTITUIDO|OCULTO|PROPUESTA|NO HACER|SIN HUECO)$/.test(r.ESTADO); });
}
function cargasFila_(r) {
  var c = cargasDe_((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || ''), r.INTENSIDAD);
  if (/CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R02|R03)\b/.test(r['CÓDIGOS'] || '')) c.push('IMPACTO');
  return c.filter(function (x, i, a) { return a.indexOf(x) === i; });
}
/** Cruce del chequeo con lo de hoy y lo de los 3 días anteriores. */
function cruceChequeo_(iso, zonas) {
  var tags = {}; zonas.forEach(function (z) { (ZONA_CARGA_[z] || []).forEach(function (t) { (tags[t] = tags[t] || []).push(z); }); });
  var hoy = [], origen = [];
  filasActivasDia_(iso).forEach(function (r) {
    var choca = cargasFila_(r).filter(function (t) { return tags[t]; });
    if (choca.length) hoy.push({ titulo: r['TÍTULO'] || r.BLOQUE, choca: choca, carrera: /CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04)\b/.test(r['CÓDIGOS'] || '') });
  });
  var hechos = {}; listar_(HOJAS.REGISTRO).forEach(function (r) { hechos[celdaIso_(r.FECHA) + '|' + r.ID_PLAN] = r.HECHO; });
  [1, 2, 3].forEach(function (k) {
    var d = sumarDias(iso, -k);
    filasActivasDia_(d).forEach(function (r) {
      if (hechos[d + '|' + r.ID] === 'No') return;
      var c = cargasFila_(r).filter(function (t) { return tags[t]; });
      if (c.length) origen.push({ hace: k, titulo: r['TÍTULO'] || r.BLOQUE, cargas: c, rpe: r.INTENSIDAD || '' });
    });
  });
  return { hoy: hoy, origen: origen };
}
function puntuarChequeo_(o, previos, iso) {
  var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : null; };
  var ca = n(o['CANSANCIO (1-10)']), ag = n(o['AGUJETAS (1-10)']), zonas = zonasDe_(o['ZONAS CARGADAS']), su = String(o['SUEÑO'] || '');
  if (ca == null && ag == null) return { listo: null, semaforo: '', recomendacion: 'Marca al menos el cansancio y las agujetas.', detalle: '' };
  var listo = 100 - (ca != null ? (ca - 1) / 9 * 50 : 0) - (ag != null ? (ag - 1) / 9 * 30 : 0) - Math.min(12, zonas.length * 4) - (su === 'Mal' ? 15 : su === 'Regular' ? 6 : 0);
  listo = Math.max(0, Math.min(100, Math.round(listo)));
  var sem = listo >= 70 ? 'Verde' : listo >= 50 ? 'Ámbar' : 'Rojo';
  if (ca != null && ca >= 9) sem = 'Rojo';
  var rec = {
    Verde: 'Todo según plan. Z6–Z8 y calidad donde están programadas.',
    'Ámbar': 'Mantén la calidad principal y recorta 20–30 % el volumen accesorio. Z6–Z8: solo si el calentamiento sale fino; si no, «No hacer» y a pendientes.',
    Rojo: 'Hoy nada de Z6–Z8 ni calidad: Z2 muy suave, técnica ligera o movilidad. Usa «Ha surgido algo» y te propongo cómo recolocar la semana.'
  }[sem];
  var partes = [];
  var media = function (k) { var v = previos.map(function (p) { return n(p[k]); }).filter(function (x) { return x != null; }); return v.length >= 3 ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
  var mc = media('CANSANCIO (1-10)'); if (mc != null && ca != null && ca - mc >= 2) partes.push('cansancio ' + Math.round(ca - mc) + ' puntos por encima de tu media');
  if (zonas.length && iso) {
    var x = cruceChequeo_(iso, zonas);
    x.hoy.forEach(function (h) { rec += ' «' + h.titulo + '» carga ' + h.choca.join(' y ').toLowerCase() + ', que marcas cargado: ' + h.choca.map(function (t) { return CONSEJO_CARGA_[t]; }).join('; ') + '.'; });
    if (x.hoy.some(function (h) { return h.carrera; })) rec += ' En la carrera de hoy, fíjate en la FC: más pulso al mismo ritmo = fatiga, no forma.';
    if (x.origen.length) rec += ' Probable origen: ' + x.origen.slice(0, 3).map(function (q) { return (q.hace === 1 ? 'ayer' : 'hace ' + q.hace + ' días') + ' «' + q.titulo + '» (' + q.cargas.join(', ').toLowerCase() + ')'; }).join('; ') + '.';
  }
  return { listo: listo, semaforo: sem, recomendacion: rec, detalle: partes.join(' · ') };
}

// ===================== v0.11 · COMBUSTIBLE E HIDRATACIÓN DÍA A DÍA =====================
/**
 * Pautas con respaldo (ACSM/AND/DC 2016 · ISSN nutrient timing 2017 y proteína 2017 · ISSN cafeína 2021 · ACSM hidratación 2007),
 * calculadas con tu peso (APP · CONFIG › peso_kg) y con la carga real del día (minutos, metcon, Z6–Z8, calidad, doble sesión)
 * y la del día siguiente (para recuperar a tiempo).
 */
function cargaDia_(filas) {
  var min = 0, am = 0, pm = 0, rpe = 0, z68 = false, cal = false, larga = false, test = false, metcons = 0;
  filas.forEach(function (r) {
    var t = norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || '')), cods = r['CÓDIGOS'] || '', fab = norm(r.ORIGEN) === 'FABRIK';
    var m = parseFloat(String(r.MIN || '').replace(',', '.')) || (fab ? (/METCON|WOD/.test(t) ? 20 : 18) : 12);
    min += m; if (r.TURNO === 'AM') am += m; else pm += m;
    var rp = parseInt(String(r.INTENSIDAD || '').replace(/[^\d]/g, ''), 10) || 0; if (/METCON|WOD/.test(t)) { metcons++; rpe = Math.max(rpe, rp || 7); }
    if (/R01|R04/.test(cods)) z68 = true; if (/W04|R02|R03/.test(cods)) cal = true; if (/W01/.test(cods)) larga = true; if (/TEST/.test(t)) test = true;
  });
  var doble = am >= 20 && pm >= 20;
  var tipo = !filas.length ? 'descanso' : doble ? 'doble' : (rpe >= 8 || z68 || cal || test || min > 100 || metcons >= 2) ? 'duro' : min <= 50 && !metcons ? 'suave' : 'normal';
  return { tipo: tipo, min: Math.round(min), am: am, pm: pm, rpe: rpe, z68: z68, calidad: cal, larga: larga, test: test, doble: doble };
}
function combustibleDia_(iso, peso) {
  peso = peso || 90;
  var c = cargaDia_(filasActivasDia_(iso)), m = cargaDia_(filasActivasDia_(sumarDias(iso, 1)));
  var g = function (a, b) { return Math.round(a * peso / 10) * 10 + (b ? '–' + Math.round(b * peso / 10) * 10 : '') + ' g'; };
  var CHO = { descanso: [3, 4], suave: [4, 5], normal: [5, 6], duro: [6, 8], doble: [7, 8] }[c.tipo];
  var NOMBRE = { descanso: 'Descanso', suave: 'Día suave', normal: 'Día normal', duro: 'Día duro', doble: 'Doble sesión' }[c.tipo];
  var items = [];
  items.push({ m: 'Todo el día', t: 'Hidratos ' + g(CHO[0], CHO[1]) + ' (' + CHO[0] + '–' + CHO[1] + ' g/kg) · proteína ' + g(1.8, 2.0) + ' en 4–5 tomas de 35–40 g · agua ≈' + (Math.round(peso * 0.035 * 10) / 10) + ' L + lo que sudes. Orina clara = bien.' });
  if (c.tipo !== 'descanso') {
    var turnoPrin = c.pm >= c.am ? 'PM' : 'AM';
    if (turnoPrin === 'AM' || c.doble) items.push({ m: 'Pre AM (60–90′ antes)', t: 'Ligero y rápido: avena 60–80 g con plátano y miel, o tostadas con mermelada + café. ' + g(0.5, 1) + ' de hidratos, poca grasa y fibra. ' + Math.round(peso * 5) + '–' + Math.round(peso * 7) + ' ml de agua con una pizca de sal al levantarte.' + (c.larga ? ' Para la Z2 larga no vayas en ayunas si por la tarde hay pesas.' : '') });
    if (turnoPrin === 'PM' || c.doble) items.push({ m: 'Comida (2–3 h antes)', t: 'Hidratos ' + g(c.tipo === 'duro' || c.doble ? 1.5 : 1, c.tipo === 'duro' || c.doble ? 2 : 1.5) + ' + 30–40 g de proteína, poca grasa y fibra: p. ej. ' + (c.tipo === 'duro' || c.doble ? '150 g de arroz (en crudo)' : '110 g de arroz o pasta (en crudo)') + ' + 150 g de pollo o salmón + fruta. Agua: ' + Math.round(peso * 5) + '–' + Math.round(peso * 7) + ' ml en las 2–4 h previas.' });
    if (turnoPrin === 'PM' || c.doble) items.push({ m: 'Snack (30–60′ antes)', t: '20–40 g de hidratos rápidos: plátano + 1 tortita de arroz con miel, o un bizcocho/muffin casero. Si la orina está oscura, 250 ml más con una pizca de sal.' +
      ((c.calidad || c.test || c.z68) ? ' Cafeína opcional: ' + Math.round(peso * 3) + ' mg (3 mg/kg ≈ 2–3 espressos) 45–60′ antes, solo si faltan ≥6 h para dormir; si entrenas a las 19–21 h, como mucho la mitad o nada.' : '') });
    var largo = c.min >= 75 || c.doble || (c.rpe >= 8 && c.min >= 60) || (c.z68 && c.rpe >= 7);
    items.push({ m: 'Durante', t: 'Agua: 150–250 ml cada 15–20′ (≈0,5–0,8 L/h).' + (largo ? ' Sesión larga o muy intensa: bebida con 30–60 g/h de hidratos (500 ml de agua + 30 g de azúcar o maltodextrina + 1 g de sal ≈ 400 mg de sodio). Si sudas mucho o hace calor, 300–600 mg de sodio por hora.' : ' Con <75′ no hace falta nada más que agua.') });
    items.push({ m: 'Post (0–2 h)', t: 'Proteína 30–40 g (≈0,4 g/kg: batido, 200 g de yogur proteico o 3 huevos + 2 claras) + hidratos ' + g(c.tipo === 'duro' || c.doble ? 1 : 0.6, c.tipo === 'duro' || c.doble ? 1.2 : 0.8) +
      ' (arroz, patata, fruta, avena). Rehidrata 1,25–1,5 L por cada kg perdido (pésate antes y después alguna vez para saber cuánto sudas), con sal en la comida.' +
      (c.doble ? ' Entre sesiones (<8 h): 1–1,2 g/kg/h de hidratos las 3–4 primeras horas (' + g(1, 1.2) + ' por hora) en tomas pequeñas.' : '') });
    items.push({ m: 'Cena / antes de dormir', t: 'Plato completo con proteína (salmón, pollo, huevos) y verdura' + (m.tipo === 'duro' || m.tipo === 'doble' || m.calidad || m.larga ? ' y una ración generosa de hidratos (≈' + g(1.5) + '): mañana toca ' + (m.calidad ? 'calidad de carrera' : m.larga ? 'Z2 larga' : 'un día duro') : '') + '. 30–40 g de proteína lenta antes de dormir (yogur griego, queso batido) si el día fue duro.' });
  } else {
    items.push({ m: 'Comidas', t: 'Proteína en cada comida (35–40 g), fruta y verdura, hidratos moderados: ' + g(3, 4) + '. Buen día para tus desayunos de avena, huevos y aguacate.' });
    if (m.tipo === 'duro' || m.tipo === 'doble' || m.calidad || m.larga) items.push({ m: 'Cena', t: 'Mañana toca ' + (m.calidad ? 'calidad de carrera' : m.larga ? 'Z2 larga' : 'un día duro') + ': cena con ' + g(1.5) + ' de hidratos (arroz, patata, pasta) para llegar con el glucógeno lleno.' });
  }
  var rec = [];
  if (c.tipo === 'duro' || c.doble) rec.push('Recuperar para mañana: prioriza la comida post en la primera hora y duerme 8 h; el glucógeno tarda ~24 h en reponerse con 7–10 g/kg.');
  if (m.calidad || m.larga) rec.push('Mañana ' + (m.calidad ? 'hay calidad' : 'hay Z2 larga') + ': hoy no recortes hidratos en la cena y llega hidratado.');
  if (m.doble) rec.push('Mañana es doble sesión: deja preparado el snack de entre sesiones.');
  rec.push('Creatina 3–5 g al día (cualquier hora) si la tomas: es la ayuda con más evidencia para la potencia repetida.');
  return { tipo: c.tipo, titulo: NOMBRE + (c.tipo !== 'descanso' ? ' · ≈' + c.min + '′' + (c.rpe ? ' · RPE ' + c.rpe : '') + (c.z68 ? ' · Z6–Z8' : '') + (c.calidad ? ' · calidad' : '') : ''), items: items, recuperacion: rec.join(' '),
    fuentes: 'ACSM/AND/DC 2016 · ISSN 2017 (timing y proteína) · ISSN 2021 (cafeína) · ACSM 2007 (hidratación)' };
}
function pesoKg_() { var p = parseFloat(String(leerConfig_().peso_kg || '').replace(',', '.')); return p > 40 && p < 200 ? p : 90; }

// ===================== v0.11 · BLOQUES CLAVE PARA TUS CARENCIAS =====================
/** Bloques de la semana que cubren las metas de más prioridad (P1–P3, tipo COUNT) aún sin hacer: se marcan con 🎯. */
function claveSemana_(lunes, plan) {
  var c = cacheMetas_(), metas = avanceMetas_('Semana', periodoSemana_(lunes), c).concat(avanceMetas_('Mes', periodoMes_(lunes), c))
    .filter(function (m) { return m.tipo === 'COUNT' && PRIO_ORDEN(m.prioridad) <= 3 && m.pReal < 1; });
  var cand = [];
  (plan || []).forEach(function (r) {
    if (/^(SUSTITUIDO|OCULTO|PROPUESTA|NO HACER|SIN HUECO)$/.test(r.ESTADO)) return;
    var rc = codigosDe_(r['CÓDIGOS']), mejor = null;
    metas.forEach(function (m) {
      if (!codigosDe_(m.codigos).some(function (k) { return rc.indexOf(k) >= 0; })) return;
      var pr = PRIO_ORDEN(m.prioridad), p = (pr <= 1 ? 3 : pr === 2 ? 2.5 : 2) + (1 - m.pReal) * 0.5;
      if (!mejor || p > mejor.p) mejor = { p: p, m: m };
    });
    if (mejor) cand.push({ id: r.ID, p: mejor.p, txt: mejor.m.estimulo + ' (' + String(mejor.m.prioridad || '').split('·')[0].trim() + ' · ' + Math.round(mejor.m.realizado * 10) / 10 + '/' + mejor.m.meta + ' hecho)' });
  });
  var out = {};
  cand.sort(function (a, b) { return b.p - a.p; }).slice(0, 6).forEach(function (x) { out[x.id] = x.txt; });
  return out;
}

// ===================== v0.11 · EXTRAS DE LA SEMANA EN CURSO (qué se ha añadido, dónde, y cuánto suma al mes) =====================
function extrasCurso_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  var c = cacheMetas_(), pm = periodoMes_(lunes), ps = periodoSemana_(lunes), fin = sumarDias(lunes, 6);
  var esExtra = function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && norm(r.ORIGEN) !== 'FABRIK' && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO); };
  var esExtraMes = function (r) { var d = celdaIso_(r.FECHA); return d >= pm.desde && d <= pm.hasta && norm(r.ORIGEN) !== 'FABRIK' && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO); };
  var sin = function (fn) { return Object.assign({}, c, { plan: c.plan.filter(function (r) { return !fn(r); }) }); };
  var mes = function (cc) { return resumenPer_(avanceMetas_('Mes', pm, cc), pm, 'Mes'); }, sem = function (cc) { return resumenPer_(avanceMetas_('Semana', ps, cc), ps, 'Semana'); };
  var full = mes(c), fullS = sem(c), sinSem = mes(sin(esExtra)), sinSemS = sem(sin(esExtra)), sinMes = mes(sin(esExtraMes));
  var metasTodas = full.metas.concat(fullS.metas), clave = claveSemana_(lunes, c.plan.filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin; }));
  var bloques = c.plan.filter(esExtra).sort(function (a, b) { return celdaIso_(a.FECHA) < celdaIso_(b.FECHA) ? -1 : celdaIso_(a.FECHA) > celdaIso_(b.FECHA) ? 1 : (a.TURNO === 'AM' ? -1 : 1); }).map(function (r) {
    var rc = codigosDe_(r['CÓDIGOS']), sinB = mes(sin(function (x) { return x === r; })), sinBS = sem(sin(function (x) { return x === r; }));
    return { id: r.ID, fecha: celdaIso_(r.FECHA), dia: diaDe_(celdaIso_(r.FECHA)), turno: r.TURNO === 'AM' ? 'AM' : 'PM', titulo: r['TÍTULO'] || r.BLOQUE, estado: r.ESTADO, origen: r.ORIGEN, min: r.MIN,
      metas: metasTodas.filter(function (m) { return codigosDe_(m.codigos).some(function (k) { return rc.indexOf(k) >= 0; }); }).map(function (m) { return m.estimulo; }).filter(function (x, i, a) { return a.indexOf(x) === i; }),
      aporteMes: Math.round((full.pctProg - sinB.pctProg) * 1000) / 10, aporteSemana: Math.round((fullS.pctProg - sinBS.pctProg) * 1000) / 10, clave: clave[r.ID] || '' };
  });
  return { lunes: lunes, mes: pm.etiqueta, bloques: bloques, borradores: bloques.filter(function (b) { return b.estado === 'BORRADOR'; }).length,
    aporteSemanaMes: Math.round((full.pctProg - sinSem.pctProg) * 1000) / 10, aporteExtrasMes: Math.round((full.pctProg - sinMes.pctProg) * 1000) / 10,
    acumuladoMes: Math.round(full.pctProg * 1000) / 10, realizadoMes: Math.round(full.pctReal * 1000) / 10,
    semanaCon: Math.round(fullS.pctProg * 1000) / 10, semanaSin: Math.round(sinSemS.pctProg * 1000) / 10 };
}

// ===================== v0.11 · APP · RESUMEN (el Sheet enseña exactamente lo mismo que la app) =====================
HOJAS.RESUMEN = 'APP · RESUMEN';
function pintarResumen_(an) {
  return conMemo_(function () {
    var ss = miLibro_(), sh = ss.getSheetByName(HOJAS.RESUMEN) || ss.insertSheet(HOJAS.RESUMEN, 0);
    var hoy = hoyIso_(), M = metasDe_(hoy), X = extrasCurso_(lunesDe_(hoy)), A = an || calcAnalisisCarrera_();
    var W = 11, filas = [], tipos = {}, pct = function (v) { return Math.round(v * 1000) / 10 + ' %'; };
    var fila = function (r, t) { r = r.slice(0, W); while (r.length < W) r.push(''); filas.push(r); if (t) tipos[filas.length] = t; };
    fila(['ROAD TO ELITE · RESUMEN', '', '', '', '', '', '', '', '', 'Actualizado', ahora_()], 'titulo');
    fila(['Mismos números que la app: semana = metas cubiertas / metas · mes = media del avance de cada meta. Programado incluye borradores.']);
    fila(['']);
    fila(['SEMANA ' + isoAFecha(M.semana.desde).slice(0, 5) + '–' + isoAFecha(M.semana.hasta).slice(0, 5), 'Programado', pct(M.semana.pctProg), 'Hecho', pct(M.semana.pctReal), M.semana.cubiertas + '/' + M.semana.total + ' metas cubiertas', '',
      'MES · ' + M.mes.etiqueta, 'Programado', pct(M.mes.pctProg), 'Hecho ' + pct(M.mes.pctReal)], 'kpi');
    fila(['']);
    var fs = M.semana.metas.filter(function (m) { return !m.cubierta; }), fm = M.mes.metas.filter(function (m) { return !m.cubierta; });
    fila(['POR CUBRIR · SEMANA', '', '', '', '', '', '', 'POR CUBRIR · MES'], 'seccion');
    for (var i = 0; i < Math.max(fs.length, fm.length, 1); i++) {
      var a = fs[i], b = fm[i];
      fila([a ? a.estimulo + ' [' + Math.round(a.programado * 10) / 10 + '/' + a.meta + ']' : (i ? '' : '— todo cubierto'), '', '', '', '', '', '', b ? b.estimulo + ' [' + Math.round(b.programado * 10) / 10 + '/' + b.meta + ']' : (i ? '' : '— todo cubierto')]);
    }
    fila(['']);
    fila(['EXTRAS · SEMANA EN CURSO (' + isoAFecha(X.lunes) + ')', '', '', '', '', '', '', '', 'Suma al mes esta semana', X.aporteSemanaMes + ' pp', 'Acumulado mes ' + X.acumuladoMes + ' %'], 'seccion');
    fila(['Día', 'Turno', 'Bloque', '', 'Estado', 'Metas que cubre', '', 'Aporte a la semana', 'Aporte al mes', '🎯 Clave', 'Extras del mes: ' + X.aporteExtrasMes + ' pp'], 'cab');
    if (!X.bloques.length) fila(['— Aún no hay extras esta semana (Cargar extras en la app o en el menú del Sheet).']);
    X.bloques.forEach(function (b) { fila([b.dia + ' ' + isoAFecha(b.fecha).slice(0, 5), b.turno, b.titulo, '', b.estado, b.metas.join(' · '), '', b.aporteSemana + ' pp', b.aporteMes + ' pp', b.clave ? '🎯 ' + b.clave : '']); });
    fila(['']);
    fila(['METAS', '', '', '', '', '', '', '', '', '', ''], 'seccion');
    fila(['Ámbito', 'Prioridad', 'Estímulo', '', 'Meta', 'Programado', 'Hecho', 'Borrador', '% programado', '% hecho', 'Estado'], 'cab');
    [['Semana', M.semana], ['Mes', M.mes]].forEach(function (z) {
      z[1].metas.forEach(function (m) { fila([z[0], m.prioridad, m.estimulo, '', m.meta, Math.round(m.programado * 10) / 10, Math.round(m.realizado * 10) / 10, m.borrador || '', pct(m.pProg), pct(m.pReal), m.cubierta ? '✓' : 'falta']); });
    });
    fila(['']);
    fila(['CARRERA · CONCLUSIONES', '', '', '', '', '', '', '', '', '', ''], 'seccion');
    (A.conclusiones || []).forEach(function (t) { fila(['· ' + t]); });
    fila(['Carreras con contexto (tus sensaciones del día y lo de las 48 h anteriores)'], 'sub');
    fila(['Fecha', 'Sesión', 'Tipo', 'km', 'Ritmo', 'FC media', 'Eficiencia', 'Cansancio', 'Agujetas', 'Zonas cargadas', '48 h antes'], 'cab');
    (A.contexto || []).forEach(function (x) { fila([isoAFecha(x.fecha), x.sesion, x.tipo, x.km, x.ritmo, x.fc || '', x.efic || '', x.cansancio, x.agujetas, x.zonas, x.antes]); });
    fila(['Por semana'], 'sub');
    fila(['Semana', 'km', 'min totales', 'min Z2', 'sesiones', 'calidad', 'Z6–Z8', 'ritmo Z2', 'FC Z2', 'eficiencia Z2'], 'cab');
    (A.semanas || []).forEach(function (s) { fila([isoAFecha(s.lunes), s.km, s.min, s.minZ2, s.sesiones, s.calidad, s.z68, s.ritmoZ2, s.fcZ2, s.eficZ2]); });
    fila(['']);
    fila(['SENSACIONES · últimos 10 chequeos', '', '', '', '', '', '', '', '', '', ''], 'seccion');
    fila(['Fecha', 'Cansancio', 'Agujetas', 'Zonas cargadas', '', 'Sueño', 'Listo', 'Semáforo', 'Recomendación'], 'cab');
    listar_(HOJAS.CHEQUEO).sort(function (a, b) { return celdaIso_(a.FECHA) < celdaIso_(b.FECHA) ? 1 : -1; }).slice(0, 10).forEach(function (r) {
      fila([r.FECHA, r['CANSANCIO (1-10)'], r['AGUJETAS (1-10)'], r['ZONAS CARGADAS'], '', r['SUEÑO'], r['LISTO (0-100)'], r['SEMÁFORO'], String(r['RECOMENDACIÓN'] || '').slice(0, 400)]);
    });
    sh.clear(); sh.setConditionalFormatRules([]);
    if (sh.getMaxRows() < filas.length + 5) sh.insertRowsAfter(sh.getMaxRows(), filas.length + 5 - sh.getMaxRows());
    if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
    sh.getRange(1, 1, filas.length, W).setValues(filas.map(function (r) { return r.map(celdaSegura_); }));
    var col = { titulo: ['#121212', '#ffffff', 'bold'], kpi: ['#fff7e0', '#000000', 'bold'], seccion: ['#ff7a1a', '#ffffff', 'bold'], cab: ['#2b2b2b', '#ffffff', 'bold'], sub: ['#f4f5f7', '#000000', 'bold'] };
    var bg = [], fc = [], fw = [];
    for (var f = 1; f <= filas.length; f++) { var k = col[tipos[f]] || ['#ffffff', '#000000', 'normal']; bg.push(new Array(W).fill(k[0])); fc.push(new Array(W).fill(k[1])); fw.push(new Array(W).fill(k[2])); }
    sh.getRange(1, 1, filas.length, W).setBackgrounds(bg).setFontColors(fc).setFontWeights(fw).setVerticalAlignment('top');
    sh.getRange(1, 1).setFontSize(14);
    [150, 90, 260, 20, 90, 260, 80, 160, 110, 260, 140].forEach(function (w, j) { sh.setColumnWidth(j + 1, w); });
    sh.setFrozenRows(4); sh.setTabColor('#ff7a1a');
    return filas.length;
  });
}
function refrescarResumen_() { MEMO = null; try { pintarResumen_(); } catch (e) { Logger.log('Resumen: ' + e); } }

// ===================== v0.11 · UNIFICAR PESTAÑAS =====================
var LEGADO_ = ['Dashboard', 'Semana', 'Mes', 'Guía e histórico', 'APP · ANÁLISIS CARRERA'];
var VISIBLES_ = ['APP · RESUMEN', 'APP · SEMANA EN BLOQUES', 'APP · PLAN', 'APP · METAS', 'APP · ESTÍMULOS', 'APP · BIBLIOTECA', 'APP · REGISTRO', 'APP · CHEQUEO', 'APP · CARRERA', 'carrera', 'APP · EVENTOS', 'APP · MARCAS'];
/** Una sola vez: copia completa del Sheet en Backups y fuera las pestañas antiguas (Dashboard, Semana, Mes, Guía e histórico, Análisis carrera). */
function unificar_() {
  var cf = leerConfig_();
  if (cf.unificado_v011) return 'ya hecho (' + cf.unificado_v011 + ')';
  var ss = miLibro_(), hay = LEGADO_.filter(function (n) { return ss.getSheetByName(n); });
  var copia = DriveApp.getFileById(CONFIG.SHEET_ID).makeCopy('Road to Elite · copia antes de unificar ' + hoyIso_(), DriveApp.getFolderById(CONFIG.BACKUPS_ID));
  hay.forEach(function (n) { var sh = ss.getSheetByName(n); if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  var chq = ss.getSheetByName(HOJAS.CHEQUEO); if (chq && chq.getLastRow() <= 1) chq.clear();   // vacía: se rehace con las columnas nuevas
  ponerConfig_('unificado_v011', ahora_() + ' · copia: ' + copia.getUrl(), 'Unificación de pestañas v0.11 (copia completa antes de borrar)');
  return 'copia ' + copia.getUrl() + ' · borradas: ' + (hay.join(', ') || 'ninguna');
}
/** Orden: lo que miras primero; las pestañas internas de la app se ocultan (siguen funcionando igual). */
function ordenarHojas_() {
  var ss = miLibro_(), n = 0;
  VISIBLES_.forEach(function (nombre, i) { var sh = ss.getSheetByName(nombre); if (!sh) return; sh.showSheet(); ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); n++; });
  ss.getSheets().forEach(function (sh) { if (VISIBLES_.indexOf(sh.getName()) < 0 && ss.getSheets().filter(function (x) { return !x.isSheetHidden(); }).length > 1) sh.hideSheet(); });
  var r = ss.getSheetByName(HOJAS.RESUMEN); if (r) ss.setActiveSheet(r);
  return n;
}
/** «DATOS A REGISTRAR» sin pulsómetro fuera de la carrera: el feedback es por sensaciones (chequeo). */
function limpiarDatosRegistrar_() {
  var n = 0;
  listar_(HOJAS.ESTIMULOS).forEach(function (r) {
    if (/CARRERA/.test(norm(r.ORIGEN))) return;
    var v = String(r['DATOS A REGISTRAR'] || ''), nv = v.replace(/,?\s*(FC (media|máx|estable)[^,·;]*|pulso[^,·;]*|VFC[^,·;]*)/gi, '').replace(/^\s*,\s*/, '').trim();
    if (nv !== v) { actualizarFila_(HOJAS.ESTIMULOS, r._fila, { 'DATOS A REGISTRAR': nv }); n++; }
  });
  return n;
}

ESQUEMA['APP · PLAN'].cab.push('ALTERNATIVAS'); ESQUEMA['APP · PLAN'].anchos.push(320);

// ===================== v0.12 · 2.ª SESIÓN Z6–Z8 INTEGRADA (COMPETICIÓN) =====================
/**
 * Cada semana, además del protocolo Z6–Z8 del plan de carrera (R01), una 2.ª sesión P1/P4 «de competición» (R04):
 * 2 movimientos de los que más te faltan (thrusters, DU, STOH, front squat, burpees, snatch/clean desde colgado, C2B o BMU en fatiga)
 * + calorías de ergómetro o carrera. Potencia en fatiga, H⁺ y aclarado de lactato, adaptaciones centrales y periféricas.
 * Sus códigos cuentan en las metas de esos movimientos. Se coloca como sesión dura (≥48 h de las otras duras) y vigilando el día siguiente.
 */
var MOVS_COMP_ = [
  { c: 'T02', n: 'thrusters', g: 'PIERNA', p1: '8 THRUSTERS (42,5/30)', p4: '8 THRUSTERS (42,5/30)' },
  { c: 'C01', n: 'double unders', g: 'IMPACTO', p1: '30 DOUBLE UNDERS', p4: '30 DOUBLE UNDERS' },
  { c: 'M07', n: 'STOH T&G', g: 'HOMBRO', p1: '8 SHOULDER TO OVERHEAD T&G (60/40)', p4: '7 SHOULDER TO OVERHEAD T&G (60/40)' },
  { c: 'C02', n: 'front squats', g: 'PIERNA', p1: '8 FRONT SQUAT (60/40)', p4: '7 FRONT SQUAT (60/40)' },
  { c: 'C03', n: 'burpees', g: 'GLUC', p1: '10 BURPEES OVER THE BAR', p4: '8 BURPEES OVER THE BAR' },
  { c: 'C04', n: 'snatch/clean desde colgado', g: 'AGARRE', p1: '6 HANG POWER SNATCH (50/35)', p4: '5 HANG POWER SNATCH (50/35)', p1b: '5 HANG SQUAT CLEAN (70/50)', p4b: '4 HANG SQUAT CLEAN (70/50)' },
  { c: 'M01', n: 'C2B', g: 'AGARRE', p1: '10 CHEST TO BAR', p4: '8 CHEST TO BAR' },
  { c: 'M48', n: 'bar muscle ups', g: 'AGARRE', p1: '5 BAR MUSCLE UPS', p4: '4 BAR MUSCLE UPS' }
];
var ERGS_COMP_ = ['15/12 cal ASSAULT BIKE', '15/12 cal ROWERG', '15/12 cal SKIERG', '200 m RUN'];
function bloqueIntegrado_(base, lunes, protoR01) {
  var w = pesoCarencias_(lunes), sem = Math.floor((isoAFecha(lunes) ? new Date(lunes + 'T12:00:00').getTime() : Date.now()) / 6048e5);
  var proto = protoR01 === 'P1' ? 'P4' : 'P1';
  var orden = MOVS_COMP_.map(function (m, i) { return { m: m, p: (w[m.c] || 0) + ((i + sem) % MOVS_COMP_.length) * 0.001 }; }).sort(function (a, b) { return b.p - a.p; });
  var elegidos = [], grupos = {};
  orden.forEach(function (x) {
    if (elegidos.length >= 2) return;
    if ((x.m.g === 'PIERNA' || x.m.g === 'AGARRE') && grupos[x.m.g]) return;   // nunca dos de pierna ni dos de agarre juntos
    elegidos.push(x.m); grupos[x.m.g] = 1;
  });
  var erg = ERGS_COMP_[sem % ERGS_COMP_.length];
  if (/RUN/.test(erg) && elegidos.some(function (m) { return m.g === 'PIERNA'; })) erg = ERGS_COMP_[0];   // carrera + pierna pesada: bici
  var dosis = function (m) { var b = (sem % 2) && m.p1b; return proto === 'P1' ? (b ? m.p1b : m.p1) : (b ? m.p4b : m.p4); };
  var cont = proto === 'P1'
    ? 'EVERY 4′ × 4 RONDAS (5 en semanas avanzadas)\n60–75″ al 90–95 %:\n' + erg + '\n' + elegidos.map(dosis).join('\n') + '\nResto de los 4′: Z1 muy suave (caminar, respirar)\n\nREGLA: misma velocidad en la 1.ª y la 4.ª ronda; si una ronda tarda >15″ más que la primera, corta.'
    : 'EMOM 12′ = 6 RONDAS de 2′ (16′ en semanas avanzadas)\nMIN IMPAR · UMBRAL (VT2): ' + erg + '\nMIN PAR · PICO (Z6), en <40″:\n' + elegidos.map(dosis).join('\n') + '\n\nREGLA: el minuto par del final en <40″; si no llegas, baja carga o reps.';
  var nombres = elegidos.map(function (m) { return m.n; });
  var faltan = elegidos.filter(function (m) { return w[m.c] > 0; }).map(function (m) { return m.n; });
  var cods = ['R04'].concat(elegidos.map(function (m) { return m.c; }));
  return Object.assign({}, base, {
    ORIGEN: 'Z6–Z8', 'TÍTULO': 'Z6–Z8 INTEGRADO · ' + proto + ' · ' + nombres.join(' + ') + ' + ' + erg.replace(/^[\d\/ ]+(cal|m) /, '').toLowerCase(),
    CONTENIDO: cont + '\n\nDónde va: como metcon del día o detrás de fuerza moderada, con 10′ de calentamiento específico. ≥48 h del otro Z6–Z8 y de la calidad de carrera.\nRecuperación: al día siguiente nada de pierna pesada ni calidad de carrera; Z2 suave o técnica.',
    INTENSIDAD: '🔴 Z6–Z8', MIN: 25, 'CÓDIGOS': cods.join('|'), CANTIDAD: saltosTexto_(cont) || '',
    'POR QUÉ (cursiva)': '2.ª sesión Z6–Z8 de la semana con enfoque de competición (' + (proto === 'P1' ? 'P1 híbrido: picos repetidos con pausa' : 'P4 modelado: pico + aclarado a umbral') + '). Integra ' + nombres.join(' y ') +
      (faltan.length ? ', lo que más te falta este mes (' + faltan.join(', ') + ')' : '') + ', con calorías de ergómetro para generar potencia en fatiga.',
    'CIENCIA (técnica · fisiología · biología)': 'Fisiología: los picos por encima de VT2 acumulan H⁺ y fosfato; en las pausas (P1) o en el minuto a umbral (P4) entrenas a aclararlos: el lactato pasa por MCT4 fuera de la fibra rápida y por MCT1 a las fibras lentas y al corazón, que lo oxidan. ' +
      'Adaptaciones centrales: más gasto cardiaco y volumen sistólico. Periféricas: capilarización, capacidad tampón y enzimas glucolíticas en los músculos del gesto de competición. Biología: alto coste; 24–48 h para repetir algo igual.',
    INTERFERENCIAS: '≥48 h del otro Z6–Z8 y de la calidad de carrera. La víspera, nada que fatigue ' + elegidos.map(function (m) { return m.g.toLowerCase(); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' ni ') + '. Al día siguiente: suave.'
  });
}

// ===================== v0.12 · METAS NUEVAS (competición) Y GUÍA «INTEGRAR CON / CÓMO MEJORARLO» =====================
ESQUEMA['APP · METAS'].cab.push('INTEGRAR CON', 'CÓMO MEJORARLO');
if (ESQUEMA['APP · METAS'].anchos) ESQUEMA['APP · METAS'].anchos.push(300, 360);
CAMPOS_META.push('INTEGRAR CON', 'CÓMO MEJORARLO');
var METAS_V12_ = [
  ['Semana', 'P2 · Endurance', 'Z6–Z8 · 2.ª SESIÓN INTEGRADA (COMPETICIÓN)', 1, 'R04', 'Una 2.ª sesión P1/P4 por semana con 2 movimientos de competición + calorías de ergómetro o carrera. La genera «Cargar extras» con lo que más falta (thrusters, DU, STOH, front squat, burpees, hang snatch/clean, C2B, BMU). Sesión dura: ≥48 h de la calidad y del Z6–Z8 del plan; al día siguiente, suave.', 8.5],
  ['Mes', 'P2 · Endurance', 'Z6–Z8 · INTEGRADO (COMPETICIÓN)', 4, 'R04', 'Las 4 sesiones integradas del mes (una por semana). Cuenta aparte de los 4 protocolos del plan de carrera (R01).', 16.5],
  ['Mes', 'P3 · Competición', 'DOUBLE UNDERS · EN FATIGA', 2, 'C01', 'Dos exposiciones de DU con pulsaciones altas (metcon o Z6–Z8 integrado). FABRIK cuenta primero.', 51.1],
  ['Mes', 'P3 · Competición', 'FRONT SQUAT · EN METCON / FATIGA', 2, 'C02', 'Dos exposiciones de front squat dentro de un metcon o Z6–Z8 (no cuenta la fuerza pesada aislada).', 51.2],
  ['Mes', 'P3 · Competición', 'BURPEES · RITMO DE COMPETICIÓN', 2, 'C03', 'Dos exposiciones de burpees (over the bar, to target, box) a ritmo de competición.', 51.3],
  ['Mes', 'P3 · Competición', 'SNATCH / CLEAN DESDE COLGADO · EN FATIGA', 2, 'C04', 'Dos exposiciones de hang snatch o hang clean (power o squat) en metcon o Z6–Z8; alterna snatch y clean.', 51.4]
];
function sembrarMetasV12_() {
  var ya = {}; listar_(HOJAS.METAS).forEach(function (m) { ya[m['ÁMBITO'] + '|' + m['CÓDIGOS']] = 1; });
  var n = 0;
  METAS_V12_.forEach(function (x) {
    if (ya[x[0] + '|' + x[4]]) return;
    guardarMeta_({ 'ÁMBITO': x[0], PRIORIDAD: x[1], 'ESTÍMULO': x[2], META: String(x[3]), 'MÁXIMO': '', TIPO: 'COUNT', UNIDAD: x[3] + (x[3] > 1 ? ' sesiones/' : ' sesión/') + (x[0] === 'Mes' ? 'mes' : 'sem'), 'CÓDIGOS': x[4], ACTIVA: 'Sí', NOTAS: x[5], ORDEN: String(x[6]) });
    n++;
  });
  return n;
}
/** Texto inicial (editable) de «INTEGRAR CON» y «CÓMO MEJORARLO» por código. Solo rellena celdas vacías. */
var GUIA_METAS_ = {
  W17: ['Bloque de fuerza de tren superior o skills; antes de accesorios de press (M53).', 'Déficit progresivo (+2 cm/sem si sale a RIR 2), tempo 3″ en la bajada y pausa abajo; trípode estable y codos a 45°.'],
  W15: ['Calentamiento del metcon con HSPU o P3 de tren superior (HSPU reactivo + ski).', 'Series cortas con reinicio: patada sincronizada con la extensión de codos; graba un set por semana y compara.'],
  W31: ['Z6–Z8 integrado (P1 bike + HSPU + DU) o metcon de Fabrik con HSPU.', 'Tandas pequeñas desde la 1.ª ronda (5-4-3) antes de llegar al fallo; respira arriba, no abajo.'],
  W01: ['Sola, en día sin pesas o AM con PM suave.', 'Sube 5′ cada semana de carga; últimos 10–15′ a umbral en semanas avanzadas (durability).'],
  W02: ['AM antes del día de volumen de Fabrik; con 10–15′ de técnica/skills después.', 'Ritmo por conversación; si la FC sube al mismo ritmo, baja ritmo: es fatiga.'],
  W03: ['Flush tras pierna pesada o vuelta a la calma de un metcon.', 'Usa el erg que salga en competición (bike/ski/row) alternando semanas.'],
  W04: ['Su semana: AM con PM de tren superior.', 'Elige la recomendada; con el grupo usa la alternativa de fartlek manteniendo la dosis.'],
  R01: ['Final de sesión de haltero/cadena posterior (P2), inicio (P3) o como metcon (P1/P4).', 'Registra W pico/medio y % de caída; progresa solo si la caída baja de 15 %.'],
  R04: ['2 movimientos de competición + calorías de ergómetro o 200 m de carrera.', 'Elige los movimientos que más te faltan y mantén la misma velocidad de la 1.ª a la última ronda; sube a 5 rondas o 16′ cuando lo consigas.'],
  W13: ['Bloque de gimnásticos AM fresco.', 'Transición con banda baja y fuerza estricta (ring dips, false grip pull-ups).'],
  W32: ['Calentamiento o skills; con pino estático (W33).', 'Metros sin caer y piruetas limpias por lado; registra el mejor intento.'],
  W33: ['Junto a HSW o como activación de hombro.', 'Línea cuerpo (costillas dentro), 3–5 × 20–40″; reduce apoyo en pared.'],
  W20: ['Antes del haltero de Fabrik o como parte del P3.', 'Por encima del 85 %; pausa 2″ en recepción; si baja la velocidad de caída, para.'],
  W23: ['Bloque de haltero técnico.', 'Un objetivo por día (pie trasero, bloqueo, drive vertical); vídeo lateral.'],
  W10: ['Calentamientos de haltero y gimnásticos.', 'Prioriza la zona que marques más cargada en el chequeo.'],
  W07: ['Contraste francés (P3B), pogos antes del haltero o DU en metcon.', 'Calidad: contacto corto y aterrizaje estable; cuenta solo el trabajo principal y el metcon.'],
  R02: ['AM; PM tren superior.', 'Progresa minutos a ritmo T (3×8′ → 2×12′ → 20′ continuos).'],
  R03: ['AM; ≥48 h del Z6–Z8.', '30/30 en grupo o 4×4′ con banda; mantén el ritmo en la última repetición.'],
  M17: ['Metcon con jerks o Z6–Z8 de barra.', 'Dip vertical y drive con talones; series cortas pesadas con pulsaciones altas.'],
  M01: ['Z6–Z8 integrado (bike + C2B) o metcon de Fabrik.', 'Kip corto y cadera alta; tandas fijas (5-5) desde el principio.'],
  M49: ['Z6–Z8 integrado P4 (ski + RMU).', 'Transición rápida y false grip; singles con buen ritmo antes que tandas que fallen.'],
  M48: ['Z6–Z8 integrado (bike + BMU) o con T2B.', 'Cadera a la barra y codos rápidos; singles sostenibles en fatiga.'],
  M05: ['Z6–Z8 integrado o metcon con barra.', 'Bajadas controladas sin soltar; tandas de 3–5 a ritmo.'],
  M07: ['Z6–Z8 integrado (STOH + erg) o P4F.', 'Ciclo rápido: dip-drive y barra cerca; respira arriba.'],
  M31: ['Skills con T2B o gimnásticos de calidad.', 'Barra cerca de la cadera, hollow → arch controlado.'],
  T01: ['Metcon pesado o EMOM de fuerza.', 'Tandas de 3–5 con buena recepción; front rack firme.'],
  T02: ['Z6–Z8 integrado con DU o erg (P4C).', 'Ritmo constante sin pausas en rack; respira en el lockout.'],
  T03: ['Metcon con DB o chipper.', 'Mancuernas en hombros, empuje de cadera; tandas de 5.'],
  M44: ['Accesorios de estabilidad OH.', 'Pausa abajo 2″; carga moderada.'],
  M58: ['Accesorios unilaterales.', 'Antirrotación: costillas dentro y escápula activa.'],
  M13: ['Metcon o accesorios de pierna unilateral.', 'Paso corto, tronco vertical, barra encima de la nuca.'],
  M45: ['Bloque de pierna unilateral AM o accesorios.', '3×6–8 por pierna, RIR 2; sube carga cuando salga fácil.'],
  M46: ['Core/aductores al final de la sesión.', 'Palanca corta → larga; 20–30″ por lado.'],
  M19: ['Accesorios de pierna o calentamiento.', 'Rango con talón apoyado; progresa a pistol con carga.'],
  M47: ['Después del haltero.', 'Posición de snatch y barra pegada; tempo 3″ en la bajada.'],
  M28: ['Accesorios de cadena posterior.', 'Pausa 2″ arriba, RPE 8.'],
  M08: ['Final de sesión.', 'Antiextensión y antirrotación según la zona cargada.'],
  M36: ['Gimnásticos AM o metcon con cuerda.', 'Técnica de pies (J-hook) y legless por tramos.'],
  M38: ['P1C (ski + trineo + burpee broad jump) o HYROX.', 'Postura baja y pasos cortos; tiempo por tramo.'],
  M33: ['Z6–Z8 integrado P1D o con thrusters.', 'Ritmo constante sin parar; muñecas.'],
  M35: ['Skills de comba frescos.', 'Intentos técnicos con descanso; sin fatiga.'],
  M10: ['Haltero técnico.', 'Carga moderada, recepción estable.'],
  M11: ['Haltero técnico.', 'Inestabilidad controlada en split.'],
  M50: ['Final del haltero.', 'Sostén pesado estable; segundos por set.'],
  M51: ['Final del haltero.', 'Split estable; registra kg y segundos.'],
  M52: ['Inicio de la sesión de pierna (P3B).', 'Velocidad máxima en cada salto; descansos completos.'],
  M53: ['Después de HSPU estricto.', 'Elige el accesorio de tu fallo (bloqueo o arranque).'],
  M54: ['Metcon o EMOM de pierna.', 'Muchas repeticiones con carga baja, sin parar.'],
  M55: ['Metcon o EMOM de hombro.', 'Carga ligera y ritmo constante.'],
  M56: ['Skills de pino.', 'Discos/laterales controlados.'],
  M57: ['Metcon o accesorios.', 'Técnica de carga al hombro.'],
  M32: ['Z6–Z8 integrado o skills de comba.', 'Crossovers controlados, ritmo bajo.'],
  V01: ['Al inicio de la sesión o tras la Z2 corta.', 'Velocidad máxima con recuperación completa; registra tiempos de 30 m.'],
  C01: ['Z6–Z8 integrado (con thrusters, HSPU o erg).', 'Tandas largas sin fallo con FC alta; muñeca relajada y salto bajo.'],
  C02: ['Z6–Z8 integrado o metcon con barra.', 'Codos altos y torso vertical en fatiga; ritmo constante.'],
  C03: ['Z6–Z8 integrado con ergómetro o barra.', 'Ritmo sostenible (cadencia fija), pecho al suelo y salto mínimo.'],
  C04: ['Z6–Z8 integrado P1/P4 o metcon de Fabrik.', 'Alterna hang snatch y hang clean; barra cerca y recepción rápida aunque estés cansado.']
};
function sembrarGuiaMetas_() {
  var n = 0;
  listar_(HOJAS.METAS).forEach(function (m) {
    var g = GUIA_METAS_[codigosDe_(m['CÓDIGOS'])[0]]; if (!g) return;
    var o = {};
    if (!String(m['INTEGRAR CON'] || '').trim()) o['INTEGRAR CON'] = g[0];
    if (!String(m['CÓMO MEJORARLO'] || '').trim()) o['CÓMO MEJORARLO'] = g[1];
    if (Object.keys(o).length) { actualizarFila_(HOJAS.METAS, m._fila, o); n++; }
  });
  return n;
}

// ===================== v0.12 · CORREO CON LOS ESTÍMULOS DE LA SEMANA Y EL MES =====================
function estimulosSemana_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  var c = cacheMetas_(), ps = periodoSemana_(lunes), pm = periodoMes_(lunes);
  var sem = resumenPer_(avanceMetas_('Semana', ps, c), ps, 'Semana'), mes = resumenPer_(avanceMetas_('Mes', pm, c), pm, 'Mes');
  var quedan = mes.metas.reduce(function (a, m) { return a + (m.tipo === 'COUNT' ? Math.max(0, Math.ceil(m.meta - m.programado)) : 0); }, 0);
  return { lunes: lunes, semana: sem, mes: mes, quedanMes: quedan };
}
function resumenSemanaHtml_(lunes) {
  var E = estimulosSemana_(lunes), S = E.semana, M = E.mes, fin = sumarDias(E.lunes, 6);
  var pct = function (v) { return Math.round(v * 100) + ' %'; }, n1 = function (v) { return Math.round(v * 10) / 10; };
  var enSemana = function (m) { return (m.dias || []).filter(function (d) { return d.iso >= E.lunes && d.iso <= fin; }); };
  var dias = function (l) { return l.length ? l.map(function (d) { return '<b>' + diaDe_(d.iso).slice(0, 3) + ' ' + d.turno + '</b> · ' + esc_(d.titulo) + (d.origen === 'FABRIK' ? ' <span style="color:#888">(Fabrik)</span>' : '') + (d.estado === 'BORRADOR' ? ' <i style="color:#c80">borrador</i>' : ''); }).join('<br>') : '<span style="color:#c33">sin programar</span>'; };
  var th = 'style="text-align:left;padding:6px 8px;background:#222;color:#fff;font-size:12px"', td = 'style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;font-size:13px"';
  var h = '<div style="font-family:Arial,sans-serif;max-width:760px;color:#111">' +
    '<h2 style="margin:0 0 4px">Semana ' + isoAFecha(E.lunes).slice(0, 5) + '–' + isoAFecha(fin).slice(0, 5) + ' · programada</h2>' +
    '<p style="margin:0 0 14px;color:#555">Road To Elite · ' + ahora_() + '</p>' +
    '<table style="border-collapse:collapse;margin-bottom:16px"><tr>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + S.cubiertas + '/' + S.total + '</b><br>metas semanales (' + pct(S.pctProg) + ')</td><td width="10"></td>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + pct(M.pctProg) + '</b><br>' + esc_(M.etiqueta) + ' programado · hecho ' + pct(M.pctReal) + '</td><td width="10"></td>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + E.quedanMes + '</b><br>sesiones del mes por programar</td></tr></table>' +
    '<h3>Estímulos semanales</h3><table style="border-collapse:collapse;width:100%"><tr><th ' + th + '>Estímulo</th><th ' + th + '>Prog./meta</th><th ' + th + '>Día en que se ha incorporado</th></tr>' +
    S.metas.map(function (m) { return '<tr><td ' + td + '>' + (m.cubierta ? '✅ ' : '⚠️ ') + esc_(m.estimulo) + '</td><td ' + td + '>' + n1(m.programado) + ' / ' + n1(m.meta) + (m.tipo === 'MIN' || m.tipo === 'MIN_GT' ? '′' : '') + '</td><td ' + td + '>' + dias(enSemana(m)) + '</td></tr>'; }).join('') + '</table>' +
    '<h3>Estímulos mensuales · ' + esc_(M.etiqueta) + '</h3><table style="border-collapse:collapse;width:100%"><tr><th ' + th + '>Estímulo</th><th ' + th + '>Prog./meta</th><th ' + th + '>Quedan</th><th ' + th + '>Esta semana</th></tr>' +
    M.metas.map(function (m) { var q = Math.max(0, Math.ceil(m.meta - m.programado)); return '<tr><td ' + td + '>' + (m.cubierta ? '✅ ' : '') + esc_(m.estimulo) + '</td><td ' + td + '>' + n1(m.programado) + ' / ' + n1(m.meta) + ' (' + pct(m.pProg) + ')</td><td ' + td + '>' + (q ? '<b>' + q + '</b>' : '—') + '</td><td ' + td + '>' + (enSemana(m).length ? dias(enSemana(m)) : '—') + '</td></tr>'; }).join('') + '</table>';
  var alt = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= E.lunes && d <= fin && r.ALTERNATIVAS && /PROGRAMADO|BORRADOR/.test(r.ESTADO); });
  if (alt.length) h += '<h3>Alternativas (sesión Q y Z6–Z8)</h3>' + alt.map(function (r) { return '<p style="font-size:13px"><b>' + diaDe_(celdaIso_(r.FECHA)) + ' · ' + esc_(r['TÍTULO']) + '</b><br>' + esc_(r.ALTERNATIVAS).replace(/\n/g, '<br>') + '</p>'; }).join('');
  return h + '<p style="color:#888;font-size:12px">Lo mismo, editable, en la app (Menú › Cobertura) y en las pestañas APP · RESUMEN y APP · METAS.</p></div>';
}
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function enviarResumenSemana_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, subject: 'Road To Elite · estímulos semana ' + isoAFecha(lunes).slice(0, 5) + ' y mes', htmlBody: resumenSemanaHtml_(lunes), name: 'Road To Elite' });
  ponerConfig_('resumen_enviado_' + lunes, ahora_(), 'Correo con los estímulos de la semana');
  return true;
}
function menuEnviarResumen() { var l = lunesDe_(hoyIso_()); enviarResumenSemana_(l); SpreadsheetApp.getActive().toast('Enviado a ' + CONFIG.EMAIL_PERMITIDO, 'Road To Elite', 4); }
