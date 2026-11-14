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
/**
 * v0.22 · Intercambia sesiones enteras: «iso|AM», «iso|PM» o «iso|DIA» (día entero). AM↔PM también vale (mismo día u otro).
 * Todos los bloques de A pasan al día/turno de B y los de B al de A (orden dentro de la sesión se conserva).
 * Lo tuyo queda con candado (Rehacer extras no lo mueve); Fabrik conserva su referencia y la recarga respeta dónde lo pusiste.
 */
function intercambiarSesion_(a, b) {
  var pa = String(a || '').split('|'), pb = String(b || '').split('|');
  var ia = isoOk_(pa[0]), ib = isoOk_(pb[0]), ta = String(pa[1] || '').toUpperCase(), tb = String(pb[1] || '').toUpperCase();
  if (!ia || !ib || !/^(AM|PM|DIA)$/.test(ta) || !/^(AM|PM|DIA)$/.test(tb)) throw new Error('sesion_no_valida');
  if ((ta === 'DIA') !== (tb === 'DIA')) throw new Error('dia_con_turno');
  if (ia === ib && ta === tb) throw new Error('misma_sesion');
  if (lunesDe_(ia) !== lunesDe_(ib)) throw new Error('otra_semana');
  var lunes = lunesDe_(ia);
  try { if (!listar_(HOJAS.PLAN).some(function (r) { var d = celdaIso_(r.FECHA); return norm(r.ORIGEN) === 'FABRIK' && d >= lunes && d <= sumarDias(lunes, 6); })) { cargarFabrikSemana_(lunes); MEMO = null; } } catch (e) {}
  return bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN).filter(function (r) { return !/^(SUSTITUIDO|OCULTO)$/.test(r.ESTADO); });
    var tu = function (r) { return r.TURNO === 'AM' ? 'AM' : 'PM'; };
    var de = function (iso, t) { return plan.filter(function (r) { return celdaIso_(r.FECHA) === iso && (t === 'DIA' || tu(r) === t); }); };
    var A = de(ia, ta), B = de(ib, tb), n = 0;
    var mover = function (r, iso, t) {
      var o = { FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), ACTUALIZADO: ahora_() };
      if (t !== 'DIA') { o.TURNO = t; var ord = parseFloat(String(r.ORDEN).replace(',', '.')) || 50; if (tu(r) !== t) o.ORDEN = String(t === 'AM' ? (ord >= 50 ? ord - 40 : ord) : (ord < 50 ? ord + 40 : ord)); }
      if (norm(r.ORIGEN) !== 'FABRIK' && !/^manual/.test(r.GENERADO || '')) o.GENERADO = 'manual ' + ahora_() + ' (candado · intercambio de sesión)';
      actualizarFila_(HOJAS.PLAN, r._fila, o); n++;
    };
    A.forEach(function (r) { mover(r, ib, tb); });
    B.forEach(function (r) { mover(r, ia, ta); });
    return n;
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
  var todosSem = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin; });
  var propFus = [], oriFus = [];   // v0.26 · filas de fusiones en propuesta y de sus originales
  try { clave = claveSemana_(lunes, plan); } catch (e) {}
  var filas = [], estilos = [], claves = [], sesiones = [], tuyos = [], cancel = [];   // estilos: [fila, tipo]
  filas.push(['SEMANA EN BLOQUES · Fabrik + extras + carrera', '', '', '', '', '', '', '', '', '', '', '']);
  filas.push(['Lunes de la semana →', isoAFecha(lunes), '↻ Actualizar', false, '✓ PROGRAMAR TODA LA SEMANA →', false, '', '', '', '', '', '']);
  filas.push(['Cambia la fecha o marca la casilla para recargar. Edita BLOQUE, EJERCICIOS o MIN y se guarda en el plan (lo que ves en la app). Para mover un bloque elige «MOVER A»; para cambiar dos entre sí, «INTERCAMBIAR CON». En la fila de cada sesión (☀️ AM / 🌙 PM), «INTERCAMBIAR CON» cambia la sesión entera o el día entero por los de otro día. En ESTADO: CANCELADO = no se hace (no va a pendientes; vuelve con PROGRAMADO), A PENDIENTES = para la semana siguiente. En naranja, lo que no es Fabrik. 🎯 = clave para tus carencias. ✓ PROGRAMAR: en la fila de cada sesión, columna ESTADO → sesión o día entero; arriba, toda la semana. ⇄ CÓDIGOS (extras): cambia el estímulo por otro del catálogo (primero la misma familia). 🔗 FUSIONAR: en la última columna del bloque elige el otro (solo en uno de los dos); aparece la PROPUESTA en amarillo y en su ESTADO eliges ✓ APROBAR o ✗ RECHAZAR (al rechazar, los dos vuelven a su sitio y estado). Ya aprobada: ESTADO → ↶ DESHACER FUSIÓN.', '', '', '', '', '', '', '', '', '', '', '']);
  filas.push(['DÍA · TURNO', 'Nº', 'BLOQUE', 'EJERCICIOS (editable)', 'TIPO', 'MIN', 'CÓDIGOS', 'ESTADO', 'MOVER A', 'INTERCAMBIAR CON', 'POR QUÉ', 'ID']);
  estilos.push([4, 'cab']);
  var OPh = null; try { OPh = opSemana_(lunes); if (!OPh.enModo) OPh = null; } catch (eO) {}   // v0.27 · modo operación
  var opFila = function (r, iso) { if (!OPh || norm(r.ORIGEN) !== 'FABRIK') return ''; var f = OPh.dias[iso], n = opPost_(f.clave);
    if (f.clave === 'D0' || n === 1 || n === 2) return '⛔ OPERACIÓN · no aplica (' + f.nombre + '). ';
    var t = OP_NOTA_FAB_[f.clave] ? '🩺 ' + OP_NOTA_FAB_[f.clave] + ' ' : '';
    if (n >= 3) opFiltrarTexto_(r.CONTENIDO, OPh.cfg.aut).sust.slice(0, 4).forEach(function (x) { t += '⛔ ' + x.de.slice(0, 40) + ' → ' + x.a + '. '; });
    return t; };
  for (var k = 0; k < 7; k++) {
    var iso = sumarDias(lunes, k);
    ['AM', 'PM'].forEach(function (tu) {
      var bl = plan.filter(function (r) { return celdaIso_(r.FECHA) === iso && (r.TURNO === 'AM' ? 'AM' : 'PM') === tu; })
        .sort(function (a, b) { return (parseFloat(String(a.ORDEN).replace(',', '.')) || 0) - (parseFloat(String(b.ORDEN).replace(',', '.')) || 0); });
      filas.push([diaDe_(iso).toUpperCase() + ' ' + isoAFecha(iso).slice(0, 5) + ' · ' + (tu === 'AM' ? '☀️ AM' : '🌙 PM'), '', (OPh && tu === 'AM' && OPh.dias[iso].clave !== 'NORMAL' ? OPh.dias[iso].nombre + (OPh.dias[iso].dn != null ? ' · D' + (OPh.dias[iso].dn >= 0 ? '+' : '') + OPh.dias[iso].dn : '') : bl.length ? '' : '—'), '', '', '', '', '', '⇄ sesión →', '', '', 'SES|' + iso + '|' + tu]);
      estilos.push([filas.length, tu === 'AM' ? 'am' : 'pm']); sesiones.push(filas.length);
      bl.forEach(function (r) {
        var fab = norm(r.ORIGEN) === 'FABRIK';
        filas.push(['', (fab ? String(r.FABRIK_REF || '').split('·')[1] || '' : '+') + (clave[r.ID] ? ' 🎯' : ''), r['TÍTULO'] || r.BLOQUE || '', String(r.CONTENIDO || '').slice(0, 4000), (r.ORIGEN || '') + (clave[r.ID] ? ' · 🎯 CLAVE: ' + clave[r.ID] : '') + (/editado/.test(r.GENERADO || '') ? ' · ✎ editado' : ''),
          r.MIN || '', r['CÓDIGOS'] || '', r.ESTADO || '', '', '', (opFila(r, iso) + String(r['POR QUÉ (cursiva)'] || '')).slice(0, 400), r.ID]);
        if (clave[r.ID]) claves.push(filas.length);
        if (!fab) tuyos.push(filas.length);
        if (r.ESTADO === 'CANCELADO') cancel.push(filas.length);
        if (esFusionPropuesta_(r)) {
          filas[filas.length - 1][7] = '❓ PROPUESTA · aprobar o rechazar'; propFus.push(filas.length);
          estilos.push([filas.length, 'extra']);
          todosSem.filter(function (o) { return String(o.CAMBIO_ID || '').indexOf('FUSION:' + r.ID + ':') === 0; }).forEach(function (o) {
            filas.push(['', '↳', 'original: ' + etq(o).replace(/ · #\S+$/, ''), String(o.CONTENIDO || '').slice(0, 600), 'vuelve a su sitio (' + String(o.CAMBIO_ID).split(':')[2] + ') si rechazas', o.MIN || '', o['CÓDIGOS'] || '', '', '', '', '', 'ORI|' + o.ID]);
            oriFus.push(filas.length); });
          return;
        }
        estilos.push([filas.length, /CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R02|R03)\b/.test(r['CÓDIGOS'] || '') ? 'carrera' : /W03/.test(r['CÓDIGOS'] || '') ? 'ergo' : fab ? 'fabrik' : 'extra']);
      });
    });
  }
  sh.clear(); sh.setConditionalFormatRules([]);
  if (sh.getMaxColumns() < 13) sh.insertColumnsAfter(sh.getMaxColumns(), 13 - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), 13).clearDataValidations();
  if (sh.getMaxRows() < filas.length + 5) sh.insertRowsAfter(sh.getMaxRows(), filas.length + 5 - sh.getMaxRows());
  sh.getRange(1, 1, filas.length, 12).setValues(filas.map(function (r) { return r.map(celdaSegura_); }));
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(2, 2).setNumberFormat('dd/mm/yyyy').setBackground('#fff7e0');
  sh.getRange(2, 4).insertCheckboxes(); sh.getRange(2, 6).insertCheckboxes(); sh.getRange(2, 5).setFontWeight('bold').setHorizontalAlignment('right'); sh.getRange(3, 1).setFontColor('#666666').setWrap(false);
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
  tuyos.forEach(function (f) { fc[f - 1][2] = '#e8590c'; fw[f - 1][2] = 'bold'; fc[f - 1][1] = '#e8590c'; });   // v0.22 · todo lo que no es Fabrik: título en naranja
  claves.forEach(function (f) { fc[f - 1][2] = '#b8860b'; fw[f - 1][2] = 'bold'; });   // 🎯 título en dorado
  cancel.forEach(function (f) { bg[f - 1] = new Array(12).fill('#e5e5e5'); fc[f - 1] = new Array(12).fill('#8a8a8a'); });
  sh.getRange(1, 1, filas.length, 12).setBackgrounds(bg).setFontColors(fc).setFontWeights(fw);
  cancel.forEach(function (f) { sh.getRange(f, 3).setFontLine('line-through'); });
  // v0.26 · columna propia para fusionar (propuesta que apruebas o rechazas)
  sh.getRange(4, 13).setValue('🔗 FUSIONAR CON (propuesta)').setBackground('#e8590c').setFontColor('#ffffff').setFontWeight('bold'); sh.setColumnWidth(13, 260);
  propFus.forEach(function (f) { sh.getRange(f, 1, 1, 13).setBackground('#fef3c7'); sh.getRange(f, 8).setFontWeight('bold').setFontColor('#b45309'); });
  oriFus.forEach(function (f) { sh.getRange(f, 1, 1, 13).setBackground('#f5f5f4').setFontColor('#8a8a8a').setFontStyle('italic'); });
  var filasBloque = estilos.filter(function (e) { return /carrera|ergo|fabrik|extra/.test(e[1]); }).map(function (e) { return e[0]; });
  if (filasBloque.length) {
    var vMover = SpreadsheetApp.newDataValidation().requireValueInList(HUECOS_, true).setAllowInvalid(false).build();
    var vSwap = opcionesSwap.length ? SpreadsheetApp.newDataValidation().requireValueInList(opcionesSwap.slice(0, 450), true).setAllowInvalid(false).build() : null;
    var vEst = SpreadsheetApp.newDataValidation().requireValueInList(['PROGRAMADO', 'BORRADOR', 'CANCELADO', 'A PENDIENTES'], true).setAllowInvalid(true).build();
    var vSwap2 = vSwap;
    var fusionables = plan.filter(function (r) { return /^(BORRADOR|PROGRAMADO)$/.test(r.ESTADO) && !esFusionPropuesta_(r); }).map(etq);
    var vFus = fusionables.length > 1 ? SpreadsheetApp.newDataValidation().requireValueInList(fusionables.slice(0, 450), true).setAllowInvalid(false).setHelpText('Elige el otro bloque: te hago una propuesta de fusión para aprobar o rechazar.').build() : null;
    var vProp = SpreadsheetApp.newDataValidation().requireValueInList(['✓ APROBAR FUSIÓN', '✗ RECHAZAR FUSIÓN'], true).setAllowInvalid(true).build();
    var vEstF = SpreadsheetApp.newDataValidation().requireValueInList(['PROGRAMADO', 'BORRADOR', 'CANCELADO', 'A PENDIENTES', '↶ DESHACER FUSIÓN'], true).setAllowInvalid(true).build();
    var listaE = null; try { listaE = estimulosLista_(lunes); } catch (e) {}
    var porId = {}; plan.forEach(function (r) { porId[r.ID] = r; });
    filasBloque.forEach(function (f) {
      var r = porId[filas[f - 1][11]] || {};
      sh.getRange(f, 9).setDataValidation(vMover); if (vSwap2) sh.getRange(f, 10).setDataValidation(vSwap2);
      sh.getRange(f, 8).setDataValidation(esFusionPropuesta_(r) ? vProp : norm(r.ORIGEN) === 'FUSION' ? vEstF : vEst);
      if (vFus && /^(BORRADOR|PROGRAMADO)$/.test(r.ESTADO) && !esFusionPropuesta_(r)) sh.getRange(f, 13).setDataValidation(vFus).setBackground('#fff7ed');
      if (listaE && r.ID && norm(r.ORIGEN) !== 'FABRIK' && norm(r.ORIGEN) !== 'FUSION' && !/CARRERA/.test(norm(r.ORIGEN)) && /^(BORRADOR|PROGRAMADO)$/.test(r.ESTADO)) {   // v0.24 · cambiar el estímulo (misma familia primero)
        var ops = candidatosCambio_(r, listaE).filter(function (x) { return codigosDe_(r['CÓDIGOS']).indexOf(x.c) < 0; }).slice(0, 60).map(function (x) { return '⇄ ' + x.c + ' · ' + String(x.nombre).slice(0, 40) + (x.mismaFamilia ? ' ★' : '') + (x.falta > 0 ? ' · faltan ' + x.falta : ''); });
        if (ops.length) sh.getRange(f, 7).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ops, true).setAllowInvalid(true).build());
      }
    });
  }
  var vProg = SpreadsheetApp.newDataValidation().requireValueInList(['✓ PROGRAMAR SESIÓN', '✓ PROGRAMAR DÍA'], true).setAllowInvalid(true).build();
  sesiones.forEach(function (f) { sh.getRange(f, 8).setDataValidation(vProg).setBackground('#ffffff'); });
  // v0.22 · cambiar sesiones enteras: en la fila de cada sesión, «INTERCAMBIAR CON» → otra sesión o el día entero
  var opSes = []; DIAS_CORTO_.forEach(function (dc) { opSes.push('⇄ ' + dc + ' AM'); opSes.push('⇄ ' + dc + ' PM'); opSes.push('⇄ ' + dc + ' · día entero'); });
  var vSes = SpreadsheetApp.newDataValidation().requireValueInList(opSes, true).setAllowInvalid(false).build();
  sesiones.forEach(function (f) { sh.getRange(f, 10).setDataValidation(vSes).setBackground('#ffffff'); sh.getRange(f, 12).setFontColor('#bbbbbb'); });
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
  try { invalidarSemana_(); } catch (x) {}
  try {
    var sh = e.range.getSheet(); if (sh.getName() === COMP_VISTA_) { editarCompetisSheet_(e); return; }
    if (sh.getName() === HOJAS.ESTBLOQUES) { editarEstimulosSheet_(e); return; }
    if (sh.getName() !== HOJAS.SEMBLOQUES) return;
    var f = e.range.getRow(), c = e.range.getColumn(), v = e.range.getValue();
    var lunes = celdaIso_(sh.getRange(2, 2).getValue()) || hoyIso_();
    if (f === 2 && (c === 2 || c === 4)) { pintarHojaSemana_(lunes); return; }
    if (f === 2 && c === 6 && v === true) { var np = programarRango_(lunesDe_(lunes)); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast(np + ' bloques pasan a PROGRAMADO (toda la semana)', 'Road To Elite', 4); return; }
    if (f < 5) return;
    var id = String(sh.getRange(f, 12).getValue() || '').trim(); if (!id) return;
    if (/^SES\|/.test(id)) {   // v0.22 · sesión o día entero
      if (c === 8 && /PROGRAMAR/.test(String(v))) { var pz = id.split('|'), nz = programarRango_(lunesDe_(lunes), pz[1], /DÍA/.test(String(v)) ? '' : pz[2]); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast(nz + ' bloques pasan a PROGRAMADO', 'Road To Elite', 4); return; }
      if (c !== 10 || !v) return;
      var ps = id.split('|'), m2 = String(v).match(/⇄\s*(\S+)\s*(AM|PM|· día entero)/); if (!m2) return;
      var kd = DIAS_CORTO_.indexOf(m2[1]); if (kd < 0) return;
      var dia = /día entero/.test(m2[2]), isoB = sumarDias(lunesDe_(lunes), kd);
      SpreadsheetApp.getActive().toast('Intercambiando…', 'Road To Elite', 3);
      var nm = intercambiarSesion_(ps[1] + '|' + (dia ? 'DIA' : ps[2]), isoB + '|' + (dia ? 'DIA' : m2[2]));
      MEMO = null; pintarHojaSemana_(lunes);
      SpreadsheetApp.getActive().toast(nm + ' bloques movidos (' + (dia ? 'día entero' : 'sesión') + ')', 'Road To Elite', 4); return;
    }
    if (c === 7 && /^⇄\s*([A-Z][0-9]{2,3})/.test(String(v))) {   // v0.24 · cambiar estímulo
      var cn = String(v).match(/^⇄\s*([A-Z][0-9]{2,3})/)[1]; cambiarEstimulo_(id, cn); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Estímulo cambiado a ' + cn + ' (cuenta en semana y mes)', 'Road To Elite', 4); return;
    }
    if (/^ORI\|/.test(id)) { pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Ese bloque está dentro de una fusión propuesta: apruébala o recházala en la fila amarilla.', 'Road To Elite', 5); return; }
    if (c === 13 && v) {   // v0.26 · fusionar: propuesta que se aprueba o se rechaza
      var otroF = (String(v).match(/#(\S+)\s*$/) || [])[1]; if (!otroF || otroF === id) { pintarHojaSemana_(lunes); return; }
      SpreadsheetApp.getActive().toast('Preparando la propuesta de fusión…', 'Road To Elite', 3);
      try { var fp = fusionarBloques_([id, otroF], { propuesta: true }); MEMO = null; pintarHojaSemana_(lunes);
        SpreadsheetApp.getActive().toast('Propuesta: «' + fp.bloque['TÍTULO'] + '» (' + fp.bloque.MIN + '′, antes ' + fp.minAntes + '′). ' + (fp.avisos[0] || '') + ' En su ESTADO: ✓ APROBAR o ✗ RECHAZAR.', 'Road To Elite', 10); }
      catch (e3) { MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('No se puede fusionar: ' + e3.message, 'Road To Elite', 6); }
      return;
    }
    if (c === 8 && /APROBAR FUSI/.test(String(v))) { var ef = aprobarFusion_(id); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusión aprobada (' + ef + '). Los bloques sueltos quedan sustituidos.', 'Road To Elite', 5); return; }
    if (c === 8 && /RECHAZAR FUSI/.test(String(v))) { desfusionar_(id); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusión rechazada: los dos bloques vuelven a su sitio y a su estado.', 'Road To Elite', 5); return; }
    if (c === 10 && /^🔗/.test(String(v))) {   // v0.24 · fusionar desde el Sheet
      var otro = (String(v).match(/#(\S+)\s*$/) || [])[1]; if (!otro) return;
      SpreadsheetApp.getActive().toast('Fusionando…', 'Road To Elite', 3);
      try { var fz = fusionarBloques_([id, otro]); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusionado en «' + fz.bloque['TÍTULO'] + '» (' + fz.bloque.MIN + '′). ' + (fz.avisos[0] || '') + ' Para deshacer: ESTADO → ↶ DESHACER FUSIÓN.', 'Road To Elite', 8); }
      catch (e2) { MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('No se puede fusionar: ' + e2.message, 'Road To Elite', 6); }
      return;
    }
    if (c === 8 && /DESHACER FUSI/.test(String(v))) { desfusionar_(id); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusión deshecha', 'Road To Elite', 4); return; }
    if (c === 8) {   // v0.22 · estado desde el Sheet
      var ev = String(v || '').trim(), xr = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === id; })[0]; if (!xr) return;
      if (ev === 'CANCELADO') noHacer_({ id: id, fecha: celdaIso_(xr.FECHA), cancelar: true, motivo: 'Cancelado desde el Sheet' });
      else if (ev === 'PROGRAMADO' && xr.ESTADO === 'CANCELADO') reactivarBloque_(id);
      else if (ev === 'A PENDIENTES') quitarBloque_({ id: id, pendiente: true, motivo: 'Desde APP · SEMANA EN BLOQUES' });
      else if (ev === 'PROGRAMADO' && xr.ESTADO === 'BORRADOR') actualizarFila_(HOJAS.PLAN, xr._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() });
      MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Estado: ' + ev, 'Road To Elite', 3); return;
    }
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
function prepararHojas() { prepararEsquema_(miLibro_(), ESQUEMA); }
function prepararEsquema_(ss, ESQ) {
  olvidarCabeceras_();
  try { return prepararEsquemaSin_(ss, ESQ); } finally { olvidarCabeceras_(); }
}
function prepararEsquemaSin_(ss, ESQ) {
  Object.keys(ESQ).forEach(function (nombre, k) {
    var E = ESQ[nombre], sh = ss.getSheetByName(nombre);
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
    sh.setTabColor(E.color || '#ff7a1a');
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
  Logger.log('OK · Pestañas preparadas: ' + Object.keys(ESQ).join(', '));
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

/** v0.21 · «Calcular» de Programar semana: en UNA llamada guarda las mañanas (si cambian), relee Fabrik (si hace falta) y devuelve la propuesta sin escribir el plan. */
function previaExtras_(body) {
  var lunes = lunesDe_(body.lunes), cambio = false;
  if (body.dobles != null && String(body.dobles) !== String((filaSemana_(lunes) || {})['DOBLES (mañanas libres)'] || '')) { guardarDobles_(body); cambio = true; }
  if (body.refrescar) { try { cargarFabrikSemana_(lunes); cambio = true; } catch (e) { /* sin Fabrik nuevo se calcula con lo que hay */ } }
  MEMO = null;
  var pvx = generarExtras_(lunes, { simular: true, dias: body.dias, descanso: body.descanso, resto: body.resto, reabrir: body.reabrir });
  pvx.dobles = String((filaSemana_(lunes) || {})['DOBLES (mañanas libres)'] || '');
  return { ok: true, previa: pvx, semana: cambio ? semanaCompleta_(body.ver || lunes) : null };
}

/** Solo cambia las mañanas libres para doble (desde Cargar extras o Reestructurar). No toca descanso, notas, decisiones ni el estado. */
function guardarDobles_(b) {
  var lunes = lunesDe_(b.lunes), dob = String(b.dobles || '').slice(0, 200);
  return bloqueo_(function () {
    var x = filaSemana_(lunes);
    if (x) { actualizarFila_(HOJAS.SEMANAS, x._fila, { 'DOBLES (mañanas libres)': dob }); return lunes; }
    var sh = hojaMia_(HOJAS.SEMANAS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, { LUNES: isoAFecha(lunes), ESTADO: 'Pendiente de confirmar', 'DOBLES (mañanas libres)': dob })]);
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
    var est = b.cancelar ? 'CANCELADO' : 'NO HACER';   // v0.22 · CANCELADO = no se hace y no va a pendientes (se puede reactivar)
    if (x) {
      actualizarFila_(HOJAS.PLAN, x._fila, { ESTADO: est, ACTUALIZADO: ahora_() });
      if (b.cancelar) quitarRegistroDe_(id);   // v0.26 · cancelado = fuera del cómputo, también si lo habías marcado como hecho
      if (!b.cancelar) anadirPendiente_(x, motivo);
    } else {
      var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh), iso = celdaIso_(b.fecha);
      var o = { ID: id, FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: b.turno || 'PM', ORDEN: b.orden || 50, ORIGEN: 'FABRIK', FABRIK_REF: b.ref || '',
        'TÍTULO': b.titulo || '', ESTADO: est, ACTUALIZADO: ahora_() };
      sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
      if (!b.cancelar) anadirPendiente_(o, motivo);
    }
  });
}

function quitarRegistroDe_(idPlan) {
  var sh = hojaMia_(HOJAS.REGISTRO), n = 0;
  listar_(HOJAS.REGISTRO).filter(function (r) { return r.ID_PLAN === idPlan; }).map(function (r) { return r._fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); n++; });
  if (n) MEMO = null; return n;
}
/** v0.22 · Reactivar un bloque CANCELADO: vuelve a PROGRAMADO y cuenta otra vez para las metas. */
function reactivarBloque_(id) {
  return bloqueo_(function () {
    var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(id || ''); })[0];
    if (!x) throw new Error('no_encontrado');
    if (x.ESTADO !== 'CANCELADO') return x.ID;
    actualizarFila_(HOJAS.PLAN, x._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() });
    return x.ID;
  });
}

// ===================== v0.22 · FUSIONAR BLOQUES =====================
/*
 * Une 2–4 bloques (Fabrik, extras o ambos) en UNO ampliado sin cambiar el estímulo de cada parte:
 *  - cada ejercicio conserva sus series, repeticiones, cargas (%, RIR, RPE) y su descanso original;
 *  - fuerza / halterofilia / gimnásticos / accesorios → superserie en ventanas «EVERY W × N»: W = lo que dura una vuelta
 *    o, si es mayor, el trabajo + descanso original del bloque más exigente (así lo pesado sigue descansando lo que pide Gabi);
 *  - el orden alterna patrones (empuje / tirón / pierna / bisagra…) para no encadenar el mismo grupo muscular;
 *  - con un metcon: el metcon NO se toca. Si tiene pausas (ON/OFF, REST entre sets), los accesorios ligeros van en esas pausas;
 *    si no, la superserie va antes y el metcon después, en el mismo bloque;
 *  - la fase del ciclo manda en la prioridad: en fases de fuerza / intensificación lo pesado va primero con su descanso completo;
 *    en fases de volumen / acumulación se permite agrupar más; en descarga se avisa si la fusión sube la densidad.
 * Los originales pasan a SUSTITUIDO (REEMPLAZA del nuevo) y se recuperan con «Deshacer fusión». Cuentan todos los estímulos (CÓDIGOS unidos).
 */
function segTexto_(s) { var m = Math.floor(s / 60), r = Math.round(s % 60); return m && r ? m + '′' + (r < 10 ? '0' : '') + r + '″' : m ? m + '′' : r + '″'; }
function seg_(t) {   // «90"», «1'30"», «2′», «2'30»
  var m = String(t || '').replace(/[′’]/g, "'").replace(/[″”]/g, '"').match(/(\d+)\s*'\s*(\d+)?\s*"?|(\d+)\s*"/);
  if (!m) return 0; return m[3] ? +m[3] : +m[1] * 60 + (+m[2] || 0);
}
/** Patrones de fuerza y accesorios que la guía del motor (centrada en metcons) no tiene: solo para ordenar la fusión. */
var FUERZA_PAT_ = [[/BACK SQUAT|FRONT SQUAT|BOX SQUAT|PAUSE SQUAT|BULGARIAN|SPLIT SQUAT|PISTOL|LUNGE|ZANCADA|STEP ?UPS?|LEG PRESS|SENTADILLA/, 'SENT', ['PIERNA']],
  [/DEADLIFT|PESO MUERTO|\bRDL\b|ROMANIAN|GOOD ?MORNING|HIP THRUST|PULL THROUGH|SWING|NORDIC/, 'BISAGRA', ['PIERNA', 'CORE']],
  [/BENCH|PRESS BANCA|PUSH ?UPS?|FLEXION|\bDIPS?\b|FLOOR PRESS/, 'EMPUJE_H', ['HOMBRO']],
  [/STRICT PRESS|SHOULDER PRESS|MILITARY|PUSH PRESS|JERK|HSPU|HANDSTAND PUSH|Z ?PRESS/, 'EMPUJE_V', ['HOMBRO']],
  [/PULL ?UPS?|CHIN|CHEST TO BAR|\bC2B\b|\bROWS?\b|REMO|PULLDOWN|MUSCLE ?UPS?|LEGLESS|ROPE CLIMB|FACE PULL/, 'TIRON', ['AGARRE']],
  [/T2B|TOES|SIT ?UPS?|HOLLOW|PLANK|PLANCHA|L-?SIT|GHD|COPENHAGEN|PALLOF|AB WHEEL|DEAD BUG/, 'CORE', ['CORE']],
  [/CARRY|FARMER|YOKE/, 'ACARREO', ['AGARRE', 'CORE']], [/SNATCH|CLEAN/, 'OLY', ['SNC', 'PIERNA']]];
function movsFusion_(L, G) {
  var mv = detectarMovs_(L, G); if (mv.length) return mv;
  for (var i = 0; i < FUERZA_PAT_.length; i++) { var m = L.match(FUERZA_PAT_[i][0]); if (m) return [{ m: { k: m[0].replace(/\s+/g, '_'), patron: FUERZA_PAT_[i][1], carga: FUERZA_PAT_[i][2] } }]; }
  return [];
}
function analizarParaFusion_(r, G) {
  var raw = String(r.CONTENIDO || '').replace(/\r/g, ''), titulo = r['TÍTULO'] || r.BLOQUE || '';
  var secciones = raw.split(/\n(?=\s*[A-Z](?:\.\d)?\s*[·)]\s)|\n\s*\n/), prep = [], main = [];
  secciones.forEach(function (sx) { var cab = norm(sx.split('\n')[0]); if (RE_PREP_.test(cab)) prep.push(sx.trim()); else if (sx.trim()) main.push(sx.trim()); });
  var mt = main.join('\n'), T = norm(mt), tipo = tipoBloqueTxt_(titulo + ' ' + mt.slice(0, 160));
  var metcon = /METCON|AMRAP|FOR TIME|TIME ?CAP|CHIPPER|\bWOD\b/.test(norm(titulo + ' ' + T)) || norm(r.ORIGEN) === 'CARRERA';
  var every = T.match(/(?:EVERY|CADA|E)\s*([0-9]{1,2}(?:\s*'\s*[0-9]{1,2})?\s*(?:'|"|MIN)?|[0-9]{2,3}\s*")\s*(?:X|×)\s*([0-9]{1,2})/), emom = T.match(/EMOM\s*([0-9]{1,2})/);
  var sets = 0, win = 0;
  if (every) { win = seg_(every[1].replace(/MIN/, "'")) || (+every[1] <= 10 ? +every[1] * 60 : +every[1]); sets = +every[2]; }
  else if (emom) { win = 60; sets = +emom[1]; }
  var ms = T.match(/([0-9]{1,2})(?:\/[0-9])?\s*(?:SETS|SERIES|RONDAS|ROUNDS)/) || T.match(/(^|\n)\s*([0-9]{1,2})\s*[X×]\s*[0-9]/);
  if (!sets && ms) sets = +(ms[2] || ms[1]);
  if (!sets) sets = 3;
  var rest = 0; (T.match(/(?:REST|DESCANSO|RECUPERA\w*)\s*[0-9][0-9'"′″ ]*/g) || []).forEach(function (x) { rest += seg_(x.replace(/^\D+/, '')); });   // varios REST en una serie: se suman (descanso total por serie)
  var pesado = /([89][0-9]|1[0-9]{2})\s*%|RIR\s*[0-2]\b|RPE\s*(8|9|10)|[0-9]RM|PESAD|HEAVY/.test(T);
  if (!rest) rest = win ? 0 : tipo === 'haltero' || tipo === 'fuerza' ? (pesado ? 120 : 90) : tipo === 'gimnásticos' ? 90 : 60;
  var ejer = [];
  mt.split('\n').forEach(function (l) {
    var L = norm(l).trim(); if (!L) return;
    var ult = ejer[ejer.length - 1];
    if (ult && /^[(*]/.test(L) && !/^\*\s*(NO|POR)/.test(L)) { ult.txt += ' ' + l.trim(); return; }   // «(RIR 1/2)» en la línea siguiente
    var mvSet = /^SET\s*[0-9]/.test(L) ? movsFusion_(L, G) : [];
    if (mvSet.length) {   // «SET 1/3: 6 BACK SQUAT (75/80%)»: series alternas del mismo ejercicio
      if (ult && ult.k[0] === mvSet[0].m.k) { ult.txt += ' / ' + l.trim(); return; }
      ejer.push({ txt: l.trim(), seg: pesado ? 30 : 25, patron: mvSet[0].m.patron || '', carga: mvSet[0].m.carga || [], k: mvSet.map(function (z) { return z.m.k; }) }); return;
    }
    if (/^([A-Z](\.\d)?\s*[·)]|EVERY|EMOM|CADA|E[0-9]|[0-9]{1,2}(\/[0-9])?\s*(SETS|SERIES|RONDAS|ROUNDS)\s*:?$|REST|DESCANSO|REGISTRA|\*|SET\s*[0-9]|METCON|ACCESOR|STRENG|GYMNAST|WEIGH)/.test(L)) return;
    var mv = movsFusion_(L, G);
    if (!/^[0-9]/.test(L) && !mv.length) return;
    var x = L.replace(/^([0-9]+)\s*[X×]\s*/, function (a, n) { if (!every && !emom) sets = Math.max(sets, +n); return ''; });
    var reps = parseFloat((x.match(/^([0-9]+(?:[.,][0-9]+)?)/) || [])[1] || '0'), w;
    if (/^[0-9]+\s*("|″|SEG)/.test(x)) w = seg_(x); else if (/^[0-9.,]+\s*M\b/.test(x)) w = reps * 1.3; else if (/CAL/.test(x)) w = reps * 3; else w = reps * (pesado ? 4.5 : 3);
    ejer.push({ txt: l.trim().replace(/^([0-9]+)\s*[X×]\s*/i, ''), seg: Math.max(15, Math.min(75, w || 30)), patron: (mv[0] && mv[0].m.patron) || '', carga: (mv[0] && mv[0].m.carga) || [], k: mv.map(function (z) { return z.m.k; }) });
  });
  var notasCarga = (mt.match(/^\s*SET\s*[0-9/ ]+:.*$/gim) || []).map(function (z) { return z.trim(); }).filter(function (z) { return !movsFusion_(norm(z), G).length; });
  var ventanas = /ON\s*(X|\/)?\s*[0-9]+\s*'?\s*OFF|[0-9]+\s*'\s*OFF|REST\s*[0-9]/.test(T);
  return { r: r, titulo: titulo, tipo: tipo, metcon: metcon, sets: sets, win: win, rest: rest, pesado: pesado, ejer: ejer, prep: prep, main: mt, notasCarga: notasCarga, ventanasMetcon: metcon && ventanas, min: minFila_(r) };
}
function fusionarBloques_(ids, opts) {
  opts = opts || {};
  ids = (ids || []).map(String).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  if (ids.length < 2) throw new Error('elige_dos');
  if (ids.length > 4) throw new Error('maximo_cuatro');
  var plan = listar_(HOJAS.PLAN), filas = ids.map(function (id) { return plan.filter(function (r) { return r.ID === id; })[0]; });
  if (filas.some(function (r) { return !r; })) throw new Error('no_encontrado');
  if (filas.some(function (r) { return /^(SUSTITUIDO|OCULTO|CANCELADO|NO HACER)$/.test(r.ESTADO); })) throw new Error('bloque_no_activo');
  var lunes = lunesDe_(celdaIso_(filas[0].FECHA));
  if (filas.some(function (r) { return lunesDe_(celdaIso_(r.FECHA)) !== lunes; })) throw new Error('otra_semana');
  var G = guiaMotor_(), P = filas.map(function (r) { return analizarParaFusion_(r, G); });
  var fase = { nombre: 'Sin fase' }; try { fase = faseDe_(celdaIso_(filas[0].FECHA), estructura_(fabrik_())); } catch (e) {}
  var F = norm(fase.nombre), fFuerza = /FUERZA|INTENSIF|STRENG|MAXIM|POTENCIA|PEAK|REALIZ/.test(F), fVol = /ACUMUL|VOLUMEN|BASE|HIPERTROF|TRANSFORM|CAPACIDAD/.test(F), fDesc = /DESCARGA|DELOAD|TAPER/.test(F);
  var met = P.filter(function (p) { return p.metcon; }), resto = P.filter(function (p) { return !p.metcon; }), avisos = [], lineas = [];
  if (met.length > 1) throw new Error('dos_metcons');
  // prioridad: en fases de fuerza lo pesado (y la halterofilia) primero; en volumen, el que más series tiene
  var pri = function (p) { return (p.tipo === 'haltero' ? 40 : p.tipo === 'fuerza' ? 30 : p.tipo === 'gimnásticos' ? 20 : 10) + (p.pesado ? (fFuerza ? 25 : 10) : 0) + (fVol ? p.sets : 0); };
  resto.sort(function (a, b) { return pri(b) - pri(a); });
  var N = resto.reduce(function (m, p) { return Math.max(m, p.sets); }, 0), W = 0, total = 0, items = [];
  if (resto.length) {
    resto.forEach(function (p) { p.ejer.forEach(function (e) { items.push({ e: e, p: p }); }); });
    // alternar patrones: no dos seguidos del mismo patrón ni de la misma carga local (agarre, hombro, pierna)
    var orden = [], pend = items.slice();
    while (pend.length) {
      var ult = orden[orden.length - 1], k = 0;
      if (ult) { var j = pend.findIndex(function (x) { return x.e.patron !== ult.e.patron && !x.e.carga.some(function (c) { return ult.e.carga.indexOf(c) >= 0; }) && !interfEntre_(G, { k: ult.e.k[0], patron: ult.e.patron }, { k: x.e.k[0], patron: x.e.patron }).some(function (r) { return /EVITAR/i.test(r.tipo); }); }); if (j > 0) k = j; }
      orden.push(pend.splice(k, 1)[0]);
    }
    items = orden;
    var vuelta = items.reduce(function (a, x) { return a + x.e.seg; }, 0) + 15 * items.length;
    var exig = resto.reduce(function (m, p) { var w = p.ejer.reduce(function (a, e) { return a + e.seg; }, 0) + (p.win ? Math.max(0, p.win - p.ejer.reduce(function (a, e) { return a + e.seg; }, 0)) : p.rest); return Math.max(m, w); }, 0);
    W = Math.max(vuelta, exig, 60); W = Math.ceil(W / 15) * 15;
    if (fDesc && vuelta > exig) avisos.push('Fase de ' + fase.nombre + ': la fusión sube la densidad; si notas fatiga, quita la última serie.');
    if (W > 300) { avisos.push('La vuelta dura ' + segTexto_(W) + ': son muchos ejercicios para una sola ventana. Valora dejar uno fuera.'); }
    total = Math.round(W * N / 60);
    lineas.push('EVERY ' + segTexto_(W) + ' X ' + N + ' SETS (≈' + total + '′)');
    var L = 'ABCDEFGHIJ';
    items.forEach(function (x, i) { lineas.push(L.charAt(i) + ') ' + x.e.txt + (x.p.sets < N ? ' · series 1–' + x.p.sets : '')); });
    resto.forEach(function (p) { if (p.notasCarga.length) lineas.push('Cargas ' + p.titulo + ': ' + p.notasCarga.join(' · ')); });
    lineas.push('Trabajo ≈' + segTexto_(vuelta) + ' por vuelta · cada ejercicio vuelve a tocarle a los ' + segTexto_(W) + ' (descanso original respetado: ' + resto.map(function (p) { return p.titulo + ' ' + segTexto_(p.win || p.rest + p.ejer.reduce(function (a, e) { return a + e.seg; }, 0)); }).join(' · ') + ').');
    resto.forEach(function (p) { if (!p.ejer.length) avisos.push('«' + p.titulo + '»: no encontré ejercicios con repeticiones; revisa el resultado.'); });
  }
  var cuerpo;
  if (met.length) {
    var m = met[0];
    if (resto.length && m.ventanasMetcon && resto.every(function (p) { return !p.pesado && (p.tipo === 'accesorios' || p.tipo === 'gimnásticos' || p.tipo === 'otro'); })) {
      cuerpo = m.main + '\n\nEN CADA PAUSA (OFF / REST) DEL METCON:\n' + items.map(function (x) { return '+ ' + x.e.txt; }).join('\n') + '\n(Ritmo de recuperación activa: sin fallo, para que no cambie el estímulo del metcon)';
      total = Math.round(m.min + 2); avisos.push('Los accesorios van en las pausas del metcon: el metcon no cambia.');
    } else {
      cuerpo = (lineas.length ? 'A) FUERZA / ACCESORIOS EN SUPERSERIE\n' + lineas.join('\n') + '\n\nB) ' : '') + m.main;
      total = total + Math.round(m.min);
      if (lineas.length) avisos.push('Superserie antes y metcon después (el metcon no se toca).');
    }
  } else cuerpo = lineas.join('\n');
  var prep = P.filter(function (p) { return p.prep.length; }).map(function (p) { return p.titulo + ':\n' + p.prep.join('\n\n'); });
  var contenido = (prep.length ? 'CALENTAMIENTO (de los bloques originales)\n' + prep.join('\n\n') + '\n\n' : '') + cuerpo;
  var cods = []; filas.forEach(function (r) { String(r['CÓDIGOS'] || '').split('|').forEach(function (c) { c = c.trim(); if (c && cods.indexOf(c) < 0) cods.push(c); }); });
  var porque = 'Fusión de ' + P.map(function (p) { return '«' + p.titulo + '» (' + p.tipo + (p.pesado ? ', pesado' : '') + ', ' + p.sets + ' series)'; }).join(' + ') + '. Fase: ' + fase.nombre +
    (fFuerza ? ' → lo pesado primero y con su descanso completo.' : fVol ? ' → prioridad al volumen; se agrupa sin recortar series.' : fDesc ? ' → descarga: ojo a la densidad.' : '.') +
    ' Se mantienen series, repeticiones y cargas de cada parte; cuentan todos sus estímulos (' + cods.join(', ') + ').';
  var base = filas[0];   // va donde estaba el primero que marcaste
  var iso = celdaIso_(base.FECHA), int = filas.map(function (r) { return r.INTENSIDAD || ''; }).filter(Boolean).sort().pop() || '';
  var nuevo = { ID: 'FU' + nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: base.TURNO === 'AM' ? 'AM' : 'PM', ORDEN: base.ORDEN || 50, ORIGEN: 'FUSIÓN',
    BLOQUE: '🔗 ' + P.map(function (p) { return p.titulo; }).join(' + '), 'TÍTULO': '🔗 ' + P.map(function (p) { return p.titulo; }).join(' + '), CONTENIDO: contenido.slice(0, 4000),
    INTENSIDAD: int, MIN: String(total || Math.round(P.reduce(function (a, p) { return a + p.min; }, 0))), 'CÓDIGOS': cods.join('|'), 'POR QUÉ (cursiva)': porque.slice(0, 1500),
    INTERFERENCIAS: avisos.join(' '), ESTADO: filas.every(function (r) { return r.ESTADO === 'PROGRAMADO'; }) ? 'PROGRAMADO' : 'BORRADOR',
    GENERADO: 'manual ' + ahora_() + ' (candado · fusión)', REEMPLAZA: ids.join(','), ACTUALIZADO: ahora_() };
  var res = { bloque: nuevo, avisos: avisos, fase: fase.nombre, partes: P.map(function (p) { return { titulo: p.titulo, tipo: p.tipo, series: p.sets, pesado: p.pesado, ejercicios: p.ejer.length, min: p.min }; }), minAntes: Math.round(P.reduce(function (a, p) { return a + p.min; }, 0)) };
  if (opts.simular) return res;
  if (opts.propuesta) {   // v0.26 · desde el Sheet: queda como PROPUESTA hasta que la apruebes (rechazar = todo vuelve a su sitio y estado)
    nuevo.CAMBIO_ID = 'FUSPROP:' + nuevo.ESTADO; nuevo.ESTADO = 'BORRADOR'; nuevo.GENERADO = 'manual ' + ahora_() + ' (candado · fusión · PROPUESTA)';
  }
  bloqueo_(function () {
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, nuevo)]);
    filas.forEach(function (r) { actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'SUSTITUIDO', CAMBIO_ID: 'FUSION:' + nuevo.ID + ':' + r.ESTADO, ACTUALIZADO: ahora_() }); });
  });
  return res;
}
/** Deshace una fusión: borra el bloque fusionado y devuelve cada original a su estado anterior. */
function desfusionar_(id) {
  var plan = listar_(HOJAS.PLAN), f = plan.filter(function (r) { return r.ID === String(id || ''); })[0];
  if (!f || norm(f.ORIGEN) !== 'FUSION') throw new Error('no_es_fusion');
  bloqueo_(function () {
    plan.filter(function (r) { return String(r.CAMBIO_ID || '').indexOf('FUSION:' + f.ID + ':') === 0; }).forEach(function (r) {
      actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: String(r.CAMBIO_ID).split(':')[2] || 'PROGRAMADO', CAMBIO_ID: '', ACTUALIZADO: ahora_() });
    });
  });
  borrarFila_(HOJAS.PLAN, f._fila, { ID: f.ID });
}

/** v0.26 · Aprueba una fusión propuesta desde el Sheet: pasa al estado que le toca y deja de ser propuesta. */
function aprobarFusion_(id) {
  var f = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(id || ''); })[0];
  if (!f || norm(f.ORIGEN) !== 'FUSION') throw new Error('no_es_fusion');
  var est = (String(f.CAMBIO_ID || '').match(/^FUSPROP:(.+)$/) || [])[1] || f.ESTADO;
  actualizarFila_(HOJAS.PLAN, f._fila, { ESTADO: est, CAMBIO_ID: '', GENERADO: String(f.GENERADO || '').replace(' · PROPUESTA', ''), ACTUALIZADO: ahora_() });
  return est;
}
function esFusionPropuesta_(r) { return /^FUSPROP:/.test(String(r.CAMBIO_ID || '')); }

// ===================== v0.24 · CAMBIAR EL ESTÍMULO DE UN BORRADOR =====================
/** Lista de estímulos del catálogo con su familia (prioridad de la meta), carga, ámbito y lo que falta esta semana / este mes. */
function estimulosLista_(lunes) {
  var cat = catalogo_(), cache = cacheMetas_(), sem = avanceMetas_('Semana', periodoSemana_(lunes), cache), mes = avanceMetas_('Mes', periodoMes_(lunes), cache);
  var por = {}; sem.concat(mes).forEach(function (x) { codigosDe_(x.codigos).forEach(function (c) { (por[c] = por[c] || []).push(x); }); });
  return Object.keys(cat).filter(function (c) { return cat[c].CONTENIDO; }).map(function (c) {
    var r = cat[c], ms = por[c] || [], m = ms[0] || {};
    var falta = ms.reduce(function (a, x) { return Math.max(a, (x.meta || 0) - (x.programado || 0)); }, 0);
    return { c: c, nombre: r.NOMBRE, familia: m.prioridad || r.ORIGEN || '', carga: String(r.CARGA || ''), min: +r.MIN || 0, ambito: ms.map(function (x) { return x.programado != null && cache.metas.filter(function (q) { return q.ID === x.id; })[0] ? cache.metas.filter(function (q) { return q.ID === x.id; })[0]['ÁMBITO'] : ''; }).filter(Boolean).join('/'), falta: Math.round(falta * 10) / 10, intensidad: r.INTENSIDAD || '' };
  }).sort(function (a, b) { return a.c < b.c ? -1 : 1; });
}
/** Familia de un bloque: la de sus códigos (prioridad de la meta) o, si no, su carga. */
function familiaDe_(codigos, lista) { var cs = codigosDe_(codigos); var e = lista.filter(function (x) { return cs.indexOf(x.c) >= 0; })[0]; return e ? e.familia : ''; }
/** Ordena el catálogo para cambiar un bloque: misma familia, luego misma carga, luego lo que más falta. */
function candidatosCambio_(r, lista) {
  var fam = familiaDe_(r['CÓDIGOS'], lista), car = String(r.CARGA || '') || (lista.filter(function (x) { return codigosDe_(r['CÓDIGOS']).indexOf(x.c) >= 0; })[0] || {}).carga || '';
  var VAC = /^(P[0-9]+|CALIDAD|FATIGA|EN|DE|Y|ESPECIFICA|INTEGRACION|ACCESORIOS|COMPETICION)$/;
  var gr = function (f) { return norm(String(f)).split(/[^A-Z0-9]+/).filter(function (w) { return w.length > 2 && !VAC.test(w); }); };
  return lista.map(function (x) { var gf = gr(fam), p = (x.familia && x.familia === fam ? 100 : gr(x.familia).some(function (w) { return gf.indexOf(w) >= 0; }) ? 60 : 0) + (car && x.carga && norm(x.carga).split(/[ ,]+/).some(function (k) { return k && norm(car).indexOf(k) >= 0; }) ? 20 : 0) + Math.min(10, x.falta * 5);
    return Object.assign({ puntos: p, mismaFamilia: p >= 60 }, x); }).sort(function (a, b) { return b.puntos - a.puntos || (a.c < b.c ? -1 : 1); });
}
/** Dosis según el ámbito: semanal = completa; mensual = pequeña dosis ligera (≤12′, RPE ≤7, sin fatiga del SNC). */
function dosisPorAmbito_(o, ambito) {
  if (/CARRERA/.test(norm(o.ORIGEN)) || /^R0|^W0[1-4]|^V01/.test(o['CÓDIGOS'] || '')) return o;
  if (ambito === 'Mes') {
    o.MIN = String(Math.min(parseFloat(o.MIN) || 10, 12));
    if (!/DOSIS MENSUAL/.test(o.CONTENIDO || '')) o.CONTENIDO = 'DOSIS MENSUAL LIGERA · 2–3 series de calidad, RPE ≤7, sin fallo ni fatiga del sistema nervioso. Si lo de abajo pide más, quédate en la mitad.\n\n' + (o.CONTENIDO || '');
    if (!/Técnico|Calidad|Ligero|Suave/.test(o.INTENSIDAD || '')) o.INTENSIDAD = '🟢 Ligero';
  } else if (ambito === 'Semana') {
    if (!/ESTÍMULO SEMANAL/.test(o.CONTENIDO || '')) o.CONTENIDO = 'ESTÍMULO SEMANAL · dosis completa: todas las series, calidad máxima y descansos completos.\n\n' + (o.CONTENIDO || '');
  }
  return o;
}
function ambitoDeCodigo_(c) { var ms = cacheMetas_().metas.filter(function (m) { return m.ACTIVA !== 'No' && codigosDe_(m['CÓDIGOS']).indexOf(c) >= 0; }); return ms.some(function (m) { return m['ÁMBITO'] === 'Semana'; }) ? 'Semana' : ms.length ? 'Mes' : ''; }
/** Cambia un bloque extra (borrador o programado, no Fabrik) por otro estímulo del catálogo. Cuenta el nuevo código en semana y mes. */
function cambiarEstimulo_(id, codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  var cat = catalogo_(), e = cat[codigo]; if (!e || !e.CONTENIDO) throw new Error('estimulo_no_encontrado');
  var r = listar_(HOJAS.PLAN).filter(function (x) { return x.ID === String(id || ''); })[0];
  if (!r) throw new Error('no_encontrado');
  if (norm(r.ORIGEN) === 'FABRIK') throw new Error('fabrik_no_se_cambia');
  var o = { 'TÍTULO': e.NOMBRE, BLOQUE: e.NOMBRE, CONTENIDO: String(e.CONTENIDO) + (e['DATOS A REGISTRAR'] ? '\n\nRegistra: ' + e['DATOS A REGISTRAR'] : ''), MIN: String(e.MIN || r.MIN || 10), INTENSIDAD: e.INTENSIDAD || '', 'CÓDIGOS': codigo, ORIGEN: e.ORIGEN || r.ORIGEN,
    'POR QUÉ (cursiva)': (e['POR QUÉ (cursiva)'] || '') + ' · Elegido por ti en lugar de «' + (r['TÍTULO'] || r.BLOQUE) + '» (' + (r['CÓDIGOS'] || 'sin código') + ').', GENERADO: 'manual ' + ahora_() + ' (candado · estímulo elegido)', ACTUALIZADO: ahora_() };
  dosisPorAmbito_(o, ambitoDeCodigo_(codigo));
  actualizarFila_(HOJAS.PLAN, r._fila, o);
  return { id: r.ID, antes: r['CÓDIGOS'], ahora: codigo };
}
// ===================== v0.24 · PROGRAMAR DESDE EL SHEET (sesión, día o semana) =====================
function programarRango_(lunes, iso, turno) {
  var fin = sumarDias(lunes, 6), n = 0;
  bloqueo_(function () {
    listar_(HOJAS.PLAN).forEach(function (r) { var d = celdaIso_(r.FECHA);
      if (d < lunes || d > fin || r.ESTADO !== 'BORRADOR' || esFusionPropuesta_(r)) return;   // la fusión propuesta se aprueba o se rechaza antes
      if (iso && d !== iso) return; if (turno && (r.TURNO === 'AM' ? 'AM' : 'PM') !== turno) return;
      actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() }); n++; });
  });
  return n;
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

function pendientesAbiertos_() {
  var ab = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ESTADO === 'Pendiente' || r.ESTADO === 'Propuesto'; });
  if (!ab.length) return ab;
  var plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
  return ab.map(function (r) { var o = plan[r.ID_PLAN] || {}, mot = String(r.MOTIVO || ''); return Object.assign({}, r, { _CONTENIDO: r.CONTENIDO || o.CONTENIDO || '', _MIN: r.MIN || o.MIN || '', _INTENSIDAD: o.INTENSIDAD || '', _Z2: esZ2Fila_(o) && !/\[tal cual\]/.test(mot), _MAS25: /\[\+25 %\]/.test(mot) }); });
}
/** v0.16.3 · editar un pendiente: título, contenido, minutos y notas (lo que se recolocará la semana siguiente). */
function editarPendiente_(b) {
  var p = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ID === String(b.id || ''); })[0];
  if (!p) throw new Error('no_encontrado');
  var o = {}; if (b.bloque != null) o.BLOQUE = String(b.bloque).slice(0, 200); if (b.contenido != null) o.CONTENIDO = String(b.contenido).slice(0, 4000);
  if (b.min != null) o.MIN = String(parseFloat(b.min) || ''); if (b.notas != null) o.NOTAS = String(b.notas).slice(0, 1000);
  actualizarFila_(HOJAS.PENDIENTES, p._fila, o);
}
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

