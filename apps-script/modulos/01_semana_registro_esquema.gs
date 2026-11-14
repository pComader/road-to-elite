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
  try { out.reest = reestActiva_(lunes); } catch (e) { out.reest = []; }
  try { out.activacion = activacionSemana_(lunes); } catch (e) { out.activacion = {}; }   // v0.29
  try { var hoyF = hoyIso_(); out.feedbackAyer = hoyF >= lunes && hoyF <= sumarDias(lunes, 7) ? feedbackAyer_(hoyF) : []; } catch (e) { out.feedbackAyer = []; }
  try { out.op = opPayload_(lunes); if (out.op && out.op.activo && out.fabrik) out.fabrik = opFabrik_(out.fabrik, opSemana_(lunes)); } catch (e) { out.op = null; }   // v0.27 · modo operación (Fabrik solo se filtra al enseñarlo)
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
function domingoNoche() { return conSalud_('domingoNoche', domingoNoche_sin_); }
function domingoNoche_sin_() {
  var fases = [['cierre', cierreSemanal], ['carrera', function () { ajusteCarrera_(); }], ['aprendizaje', function () { aprendizajeSemanal(); }], ['backup', backupSemanal], ['archivo', archivarSiToca_]], estado = [];
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
  var o = permitidas_(r, CAMPOS_REGISTRO); if (o.RESULTADO || o.FEEDBACK) ['RESULTADO', 'FEEDBACK'].forEach(function (h) { asegurarColumna_(HOJAS.REGISTRO, h); });
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
  return listar_(HOJAS.VIDEOS).filter(function (r) { return r.EJERCICIO && r['VÍDEO'] && r.ESTADO !== 'ROTO'; }).map(function (r) {
    return { nombre: String(r.EJERCICIO).trim(), alias: String(r.ALIAS || '').split(';').map(function (a) { return a.trim(); }).filter(Boolean), url: String(r['VÍDEO']).trim(), estado: r.ESTADO || '' };
  });
}

// v0.21.1 · Road To Elite ya NO lee el DICCIONARIO de la app de Gabi: esa app copia sus ejercicios en la «Base de datos Vídeos»
// los martes a las 05:00, y Road To Elite lee de ahí (videosMartes, martes 06:00). Ver videosMartes() más abajo.

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
      ESTADO: ['BORRADOR', 'PROGRAMADO', 'PROPUESTA', 'PROPUESTA · NO HACER', 'NO HACER', 'CANCELADO', 'SUSTITUIDO'] },
    colores: [['ESTADO', 'PROPUESTA', '#ffedcc'], ['ESTADO', 'SUSTITUIDO|NO HACER|CANCELADO', '#5a5a5a', '#ffffff'], ['ESTADO', 'BORRADOR', '#fff7e0'],
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
    cab: ['ID', 'CREADO', 'FECHA ORIGINAL', 'ID_PLAN', 'BLOQUE', 'TIPO', 'MOTIVO', 'ESTADO', 'SEMANA DESTINO', 'NOTAS', 'CONTENIDO', 'MIN'],
    anchos: [70, 120, 95, 90, 220, 90, 280, 110, 110, 220, 300, 55], fechas: ['FECHA ORIGINAL'],
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

