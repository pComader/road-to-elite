/**
 * Road To Elite — servidor (Apps Script) · versión 0.3
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
  VERSION: '0.3',
  URL_APP: 'https://pcomader.github.io/road-to-elite/',   // la clave de Firebase solo acepta peticiones desde aquí
  EMAIL_PERMITIDO: 'pabloserranolopez@gmail.com',
  FIREBASE_API_KEY: 'AIzaSyArN_Bk25gA6TnHYxOg5vv-tHVohHIhnZM',
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
  DESCUENTOS: 'APP · DESCUENTOS', WEBS: 'APP · WEBS', VIDEOS: 'APP · VÍDEOS'
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
    var a = body.action;
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
    }
    return json_({ ok: false, error: 'accion_desconocida' });
  } catch (err) {
    return json_({ ok: false, error: 'interno', detalle: String(err && err.message || err) });
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
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var email = cache.get(clave);
  if (!email) {
    var res = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CONFIG.FIREBASE_API_KEY,
      { method: 'post', contentType: 'application/json', headers: { Referer: CONFIG.URL_APP }, payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'sesion_caducada' };
    var u = (JSON.parse(res.getContentText()).users || [])[0];
    if (!u || !u.email || u.emailVerified !== true) return { ok: false, error: 'sesion_caducada' };
    email = String(u.email).toLowerCase();
    cache.put(clave, email, 600);
  }
  if (email !== CONFIG.EMAIL_PERMITIDO) return { ok: false, error: 'no_autorizado' };
  return { ok: true, email: email };
}

/** Único libro en el que se puede escribir. Si alguien cambia el ID por error, se para aquí. */
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

/** Filas de una pestaña de la app como objetos { CABECERA: texto, _fila }. */
function listar_(nombre) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, cab.length).getDisplayValues().map(function (r, i) {
    var o = { _fila: i + 2 };
    cab.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  }).filter(function (o) { return cab.some(function (h) { return String(o[h]).trim(); }); });
}

function filaDe_(cab, o) { return cab.map(function (h) { return o[h] == null ? '' : o[h]; }); }

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
function semanaCompleta_(semana) {
  var lunes = lunesDe_(semana);
  var domingo = sumarDias(lunes, 6);
  var est = estructura_(fabrik_());
  var fab = est.semanas.filter(function (s) { return s.iso === lunes; })[0] || null;
  var lista = est.semanas.map(function (s) { return { iso: s.iso, nombre: s.nombre }; });
  var enSemana = function (r) { var d = celdaIso_(r.FECHA); return d && d >= lunes && d <= domingo; };
  return {
    lunes: lunes, hoy: hoyIso_(), semanasFabrik: lista, erratasFabrik: est.erratas,
    fabrik: fab ? semanaBase_(fab, est) : null,
    plan: listar_(HOJAS.PLAN).filter(enSemana).sort(function (x, y) { return (Number(x.ORDEN) || 0) - (Number(y.ORDEN) || 0); }),
    registro: listar_(HOJAS.REGISTRO).filter(enSemana)
  };
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

// ===================== COBERTURA (solo lectura de las pestañas existentes) =====================
/** Devuelve lo que se ve en Dashboard, Semana, Mes y carrera, para pintarlo en la app. */
function cobertura_() {
  var ss = miLibro_();
  var leer = function (nombre, rango) { var sh = ss.getSheetByName(nombre); return sh ? sh.getRange(rango).getDisplayValues() : []; };
  return {
    dashboard: leer('Dashboard', 'A1:L45'),
    semana: leer('Semana', 'A1:H45'),
    mes: leer('Mes', 'A1:H60'),
    carrera: leer('carrera', 'A1:G60')
  };
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

// ===================== INSTALACIÓN =====================
/** Ejecutar desde el editor tras cada actualización: crea la copia semanal de vídeos (domingo 23:00) y el backup (domingo 23:30, Madrid) y comprueba accesos. */
function configurar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'copiarVideosGabi') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('copiarVideosGabi').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).inTimezone(CONFIG.ZONA).create();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'backupSemanal') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).nearMinute(30).inTimezone(CONFIG.ZONA).create();
  Logger.log('OK · Carpeta de backups: ' + DriveApp.getFolderById(CONFIG.BACKUPS_ID).getName());
  var est = estructura_(fabrik_());
  Logger.log('OK · Fabrik: ' + est.semanas.length + ' semanas leídas · erratas: ' + est.erratas.length);
  Logger.log('OK · Pestañas de la app: ' + Object.keys(HOJAS).map(function (k) { return hojaMia_(HOJAS[k]).getName(); }).join(', '));
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

  return { semana: nombre, lunes: isoLunes, ciclo: parsearCiclo(celdasCiclo, isoLunes), dias: dias, videosSemana: parsearVideosFila(celdasSem[2] || []) };
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
  var bloques = [], b = null, p = null;
  function nuevaParte(etiqueta, tipo) {
    p = { etiqueta: etiqueta, tipo: tipo, lineas: [] };
    b.partes.push(p);
  }
  lineas.forEach(function (raw) {
    var l = raw.replace(/\s+$/, '');
    var mB = l.match(/^\s*(\d+)\s*:\s*(.+)$/);
    if (mB) {
      b = { n: Number(mB[1]), titulo: mB[2].trim(), partes: [] };
      bloques.push(b); p = null; return;
    }
    if (!b) { b = { n: 0, titulo: '', partes: [] }; bloques.push(b); }
    // "A) MEJORA RANGO…" es un apartado; "A) 20+20M CARRY" es un ejercicio de una serie alterna
    var mP = l.match(/^\s*([A-Z](?:\.\d)?)\)\s*([A-ZÁÉÍÓÚÑa-z].*)$/);
    if (mP) {
      var et = mP[1] + ' · ' + mP[2].trim();
      var t = /RANGO|MOVILIDAD|ACTIVACI/.test(norm(mP[2])) ? 'prep' : 'main';
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
  ACCESSORIES: 'ACCES', MUSTLE: 'MUSCLE', CONTRASTE: 'CONTRAST', GIMNASTICS: 'GYMNASTICS' };
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
  var max = 0, etiqueta = null;
  dia.bloques.forEach(function (b) {
    if (!b.rpe) return;
    var n = Math.max.apply(null, (b.rpe.match(/\d+/g) || [0]).map(Number));
    if (n >= max) { max = n; etiqueta = b.rpe; }
  });
  if (etiqueta) return etiqueta;
  if (/ZONA\s*2|\bZ2\b/.test(norm(texto))) return 'Z2';
  var m = norm(texto).match(/RPE\s*(\d+(?:\/\d+)?)/);
  return m ? m[1] : null;
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

