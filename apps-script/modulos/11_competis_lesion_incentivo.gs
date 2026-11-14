// ===================== v0.20 · COMPETIS (copia de «COMPETIS PROPUESTAS» de ProgramAPP) + SEGUIMIENTO EN CALENDAR =====================
/*
 * «Road to Elite · Motor» es la base de datos de Road To Elite para todo lo que no es el día a día (WODs, KNOWLEDGE, ciclo, competis…).
 * COMPETIS: copia (SOLO LECTURA del origen) de ProgramAPP › «COMPETIS PROPUESTAS», que la app de Gabi rellena cada lunes.
 *   Se copia los lunes a las 15:00 y con configurar; lo de Gabi se actualiza, lo de Road To Elite (seguimiento, fechas, respuestas) se conserva.
 * Seguimiento: al marcarla, van a Google Calendar la competi, la apertura de inscripción y el clasificatorio (si hay fecha).
 *   Llegada la fecha de inscripción / clasificatorio, la app pregunta si se hizo: «No» → se borra todo del calendario y sale del seguimiento.
 */
HOJAS.COMPETIS = 'COMPETIS';
ESQ_BD_[HOJAS.COMPETIS] = { cab: ['ID', 'ESTADO (Gabi)', 'NOMBRE', 'INICIO', 'FIN', 'CIUDAD', 'PROVINCIA', 'WEB', 'WODBUSTER', 'INSTAGRAM', 'APERTURA INSCRIPCIÓN', 'CLASIFICATORIO', 'CATEGORÍAS CLASIFICATORIO',
  'CATEGORÍAS', 'PRECIO', 'FUENTE', 'ENCONTRADA', 'NOTAS', 'SEGUIMIENTO', 'FECHA INSCRIPCIÓN', 'FECHA CLASIFICATORIO', 'INSCRIPCIÓN', 'CLASIFICATORIO (hecho)', 'GCAL', 'COPIADA', 'ÁMBITO', 'CON CLASIFICATORIO', 'NIVELES', 'FORMATO'],
  anchos: [80, 90, 240, 90, 90, 120, 100, 200, 200, 200, 110, 120, 160, 200, 140, 200, 90, 300, 90, 110, 110, 100, 110, 160, 130, 110, 110, 180, 140], negrita: 'NOMBRE', color: '#f59e0b',
  fechas: ['INICIO', 'FIN', 'FECHA INSCRIPCIÓN', 'FECHA CLASIFICATORIO'],
  listas: { SEGUIMIENTO: ['Sí', 'No'], 'INSCRIPCIÓN': ['Pendiente', 'Hecha', 'No'], 'CLASIFICATORIO (hecho)': ['Pendiente', 'Hecho', 'No'] },
  colores: [['SEGUIMIENTO', '^Sí$', '#fef3c7', '#78350f']] };
var CAMPOS_GABI_COMPETI_ = ['ESTADO', 'NOMBRE', 'INICIO', 'FIN', 'CIUDAD', 'PROVINCIA', 'WEB', 'WODBUSTER', 'INSTAGRAM', 'APERTURA INSCRIPCIÓN', 'CLASIFICATORIO', 'CATEGORÍAS CLASIFICATORIO', 'CATEGORÍAS', 'PRECIO', 'FUENTE', 'ENCONTRADA', 'NOTAS'];
/** Una celda de fecha (Date, número de serie o texto) → dd/mm/aaaa, o el texto tal cual si no es fecha. */
function fechaCelda_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, CONFIG.ZONA, 'dd/MM/yyyy');
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) { var n = +v; if (n > 30000 && n < 80000) return isoAFecha(sumarDias('1899-12-30', Math.floor(n))); }
  var s = String(v == null ? '' : v).trim(), iso = celdaIso_(s);
  return iso ? isoAFecha(iso) : s;
}
/** Primera fecha que aparezca en un texto («Sí, online del 3 al 9/1/2027»…). */
function fechaEnTexto_(t) {
  var m = String(t || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (!m) return '';
  var y = m[3].length === 2 ? '20' + m[3] : m[3]; return isoAFecha(y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2));
}
function copiarCompetis_() {
  var sh = programApp_().getSheetByName('COMPETIS PROPUESTAS');
  if (!sh || sh.getLastRow() < 4) return 0;
  var v = sh.getRange(3, 1, sh.getLastRow() - 2, sh.getLastColumn()).getValues(), cab = v[0].map(function (h) { return String(h).trim(); });
  var ix = function (h) { return cab.indexOf(h); }, ya = {}, nuevas = [], act = 0;
  listar_(HOJAS.COMPETIS).forEach(function (r) { ya[r.ID] = r; });
  v.slice(1).forEach(function (row) {
    var id = String(row[ix('ID')] || '').trim(); if (!id || !String(row[ix('NOMBRE')] || '').trim()) return;
    var o = {};
    CAMPOS_GABI_COMPETI_.forEach(function (h) { var k = ix(h); if (k < 0) return; var val = row[k]; o[h === 'ESTADO' ? 'ESTADO (Gabi)' : h] = /INICIO|FIN|APERTURA|ENCONTRADA/.test(h) ? fechaCelda_(val) : String(val == null ? '' : val).trim(); });
    Object.assign(o, clasificarCompeti_(o));   // v0.23 · ÁMBITO, CON CLASIFICATORIO, NIVELES, FORMATO
    o.COPIADA = ahora_();
    var r = ya[id];
    if (r) {
      var cambia = Object.keys(o).some(function (k) { return k !== 'COPIADA' && String(r[k] || '') !== String(o[k] || ''); });
      if (cambia) { actualizarFila_(HOJAS.COMPETIS, r._fila, o); act++; }
    } else {
      o.ID = id; o.SEGUIMIENTO = 'No';
      o['FECHA INSCRIPCIÓN'] = /^\d{2}\/\d{2}\/\d{4}$/.test(o['APERTURA INSCRIPCIÓN'] || '') ? o['APERTURA INSCRIPCIÓN'] : '';
      o['FECHA CLASIFICATORIO'] = fechaEnTexto_(o.CLASIFICATORIO);
      nuevas.push(o);
    }
  });
  filasEnHoja_(HOJAS.COMPETIS, nuevas);
  try { var shC = hojaMia_(HOJAS.COMPETIS); if (!shC.getFilter() && shC.getLastRow() > 1) shC.getRange(1, 1, shC.getLastRow(), shC.getLastColumn()).createFilter(); } catch (e) {}   // filtro nativo en el libro del motor
  try { MEMO = null; if (miLibro_().getSheetByName(COMP_VISTA_)) pintarCompetisSheet_(); } catch (e) {}
  ponerConfig_('competis_copia', ahora_() + ' · ' + nuevas.length + ' nuevas · ' + act + ' actualizadas', 'Última copia de COMPETIS PROPUESTAS (ProgramAPP, solo lectura) a Road to Elite · Motor');
  return nuevas.length;
}
// ===================== v0.23 · COMPETIS: clasificación y filtros (app + Sheet) =====================
/*
 * Cada competi copiada de ProgramAPP › «COMPETIS PROPUESTAS» (solo lectura) recibe 4 columnas calculadas en «Road to Elite · Motor» › COMPETIS:
 *   ÁMBITO             Andalucía | España | Internacional        (por PROVINCIA: provincias andaluzas / resto de provincias españolas / país)
 *   CON CLASIFICATORIO Sí | No | Sin dato                       (por CLASIFICATORIO: «Sí…», fecha o «online» → Sí; «No» → No; vacío → Sin dato)
 *   NIVELES            Elite, RX, Advance, Intermedio, Escalado, Rookie, Open, Máster, Teens  (por CATEGORÍAS + CATEGORÍAS CLASIFICATORIO)
 *   FORMATO            Individual, Parejas, Tríos, Equipos      (ídem)
 * Filtros (se combinan con Y; dentro de un mismo filtro de varias opciones, con O):
 *   fecha de la competi (desde/hasta, solapa con INICIO–FIN), fecha de inscripción (desde/hasta, FECHA INSCRIPCIÓN o APERTURA INSCRIPCIÓN),
 *   ámbito, clasificatorio, niveles, formato, texto libre, solo futuras, solo en seguimiento.
 */
var AND_PROV_ = ['ALMERIA', 'CADIZ', 'CORDOBA', 'GRANADA', 'HUELVA', 'JAEN', 'MALAGA', 'SEVILLA'];
var ESP_PROV_ = ['A CORUNA', 'CORUNA', 'LA CORUNA', 'ALAVA', 'ARABA', 'ALBACETE', 'ALICANTE', 'ALACANT', 'ASTURIAS', 'AVILA', 'BADAJOZ', 'BALEARES', 'ILLES BALEARS', 'ISLAS BALEARES', 'MALLORCA', 'IBIZA', 'MENORCA', 'BARCELONA', 'BIZKAIA', 'VIZCAYA', 'BURGOS', 'CACERES',
  'CANTABRIA', 'CASTELLON', 'CASTELLO', 'CEUTA', 'CIUDAD REAL', 'CUENCA', 'GIPUZKOA', 'GUIPUZCOA', 'GIRONA', 'GERONA', 'GUADALAJARA', 'HUESCA', 'LA RIOJA', 'RIOJA', 'LAS PALMAS', 'GRAN CANARIA', 'LANZAROTE', 'FUERTEVENTURA', 'LEON', 'LLEIDA', 'LERIDA', 'LUGO', 'MADRID', 'MELILLA', 'MURCIA',
  'NAVARRA', 'OURENSE', 'ORENSE', 'PALENCIA', 'PONTEVEDRA', 'SALAMANCA', 'SANTA CRUZ DE TENERIFE', 'TENERIFE', 'LA PALMA', 'SEGOVIA', 'SORIA', 'TARRAGONA', 'TERUEL', 'TOLEDO', 'VALENCIA', 'VALLADOLID', 'ZAMORA', 'ZARAGOZA', 'ESPANA'];
var NIVELES_RE_ = [['Elite', /\bELITE\b|\bELIT\b/], ['RX', /\bRX\b|\bREGULAR\b/], ['Advance', /\bADVANCED?\b|\bAVANZAD/], ['Intermedio', /\bINTER(MEDIO|MEDIATE)?\b/], ['Escalado', /\bESCALAD|\bSCALED?\b/],
  ['Rookie', /\bROOKIE\b|\bBEGINNER\b|\bPRINCIPIANTE|\bNOVATO|\bEXPERIENCE\b/], ['Open', /\bOPEN\b/], ['Máster', /\bMASTERS?\b|\bMASTER\b/], ['Teens', /\bTEENS?\b|\bUNDER\b|\bJUNIOR/]];
var FORMATOS_RE_ = [['Individual', /\bINDIVIDUAL|\bINDIVIDUALES/], ['Parejas', /\bPAREJA|\bBUDDY|\bDOUBLE\b|\bDUO\b|\bHF\b|\bHH\b|\bFF\b/], ['Tríos', /\bTRIO|\bEQUIPOS? DE 3|\bTEAM OF 3|\bHHF|\bHHH|\bFFF/], ['Equipos', /\bEQUIPO|\bTEAM/]];
function clasificarCompeti_(r) {
  var prov = norm(r.PROVINCIA || '').trim(), cat = norm((r['CATEGORÍAS'] || '') + ' ; ' + (r['CATEGORÍAS CLASIFICATORIO'] || '')), q = norm(r.CLASIFICATORIO || '').trim();
  var ambito = !prov ? 'Sin dato' : AND_PROV_.some(function (p) { return prov.indexOf(p) >= 0; }) ? 'Andalucía' : ESP_PROV_.some(function (p) { return prov === p || prov.indexOf(p) >= 0; }) ? 'España' : 'Internacional';
  var clasif = !q ? 'Sin dato' : /^NO\b/.test(q) ? 'No' : 'Sí';
  var niveles = NIVELES_RE_.filter(function (x) { return x[1].test(cat); }).map(function (x) { return x[0]; });
  var formatos = FORMATOS_RE_.filter(function (x) { return x[1].test(cat); }).map(function (x) { return x[0]; });
  return { 'ÁMBITO': ambito, 'CON CLASIFICATORIO': clasif, NIVELES: niveles.join(', '), FORMATO: formatos.join(', ') };
}
function fechaInscCompeti_(r) { return celdaIso_(r['FECHA INSCRIPCIÓN']) || celdaIso_(r['APERTURA INSCRIPCIÓN']) || ''; }
/** Mismo filtro en el servidor (Sheet) y en la app (menu.js · filtrarCompetis). f: { desde, hasta, insDesde, insHasta, ambito[], clasif[], niveles[], formatos[], texto, futuras, seguimiento } */
function filtrarCompetis_(lista, f) {
  f = f || {}; var hoy = hoyIso_();
  var en = function (v, l) { return !l || !l.length || String(v || '').split(/\s*,\s*/).some(function (x) { return l.indexOf(x) >= 0; }); };
  var tx = norm(f.texto || '').trim();
  return lista.filter(function (x) {
    var ini = celdaIso_(x.INICIO) || '', fin = celdaIso_(x.FIN) || ini, ins = fechaInscCompeti_(x);
    if (f.futuras && fin && fin < hoy) return false;
    if (f.seguimiento && x.SEGUIMIENTO !== 'Sí') return false;
    if (f.desde && (!fin || fin < f.desde)) return false;
    if (f.hasta && (!ini || ini > f.hasta)) return false;
    if (f.insDesde && (!ins || ins < f.insDesde)) return false;
    if (f.insHasta && (!ins || ins > f.insHasta)) return false;
    if (!en(x['ÁMBITO'], f.ambito) || !en(x['CON CLASIFICATORIO'], f.clasif) || !en(x.NIVELES, f.niveles) || !en(x.FORMATO, f.formatos)) return false;
    if (tx && norm([x.NOMBRE, x.CIUDAD, x.PROVINCIA, x['CATEGORÍAS'], x.NOTAS].join(' ')).indexOf(tx) < 0) return false;
    return true;
  });
}
// ---------- Sheet: pestaña «APP · COMPETIS» (Training Coverage) con panel de filtros ----------
var COMP_VISTA_ = 'APP · COMPETIS';
var COMP_FILTROS_ = ['COMPETI DESDE', 'COMPETI HASTA', 'INSCRIPCIÓN DESDE', 'INSCRIPCIÓN HASTA', 'ÁMBITO', 'CLASIFICATORIO', 'NIVEL', 'FORMATO', 'TEXTO', 'SOLO FUTURAS', 'SEGUIMIENTO', '↻ ACTUALIZAR'];
var COMP_COLS_ = ['NOMBRE', 'INICIO', 'FIN', 'CIUDAD', 'PROVINCIA', 'ÁMBITO', 'INSCRIPCIÓN', 'CON CLASIFICATORIO', 'CLASIFICATORIO', 'NIVELES', 'FORMATO', 'CATEGORÍAS', 'PRECIO', 'WEB', 'SEGUIMIENTO', 'ID'];
function filtroDesdeSheet_(sh) {
  var v = sh.getRange(4, 1, 1, COMP_FILTROS_.length).getValues()[0], lista = function (x) { return String(x || '').split(/\s*,\s*/).filter(function (y) { return y && !/^(TODAS?|TODOS)$/i.test(y); }); };
  return { desde: celdaIso_(v[0]) || '', hasta: celdaIso_(v[1]) || '', insDesde: celdaIso_(v[2]) || '', insHasta: celdaIso_(v[3]) || '', ambito: lista(v[4]), clasif: lista(v[5]), niveles: lista(v[6]), formatos: lista(v[7]), texto: String(v[8] || ''), futuras: v[9] === true, seguimiento: v[10] === true };
}
function pintarCompetisSheet_(f) {
  var ss = miLibro_(), sh = ss.getSheetByName(COMP_VISTA_), nueva = !sh;
  if (!sh) sh = ss.insertSheet(COMP_VISTA_);
  if (nueva || sh.getRange(3, 1).getValue() !== COMP_FILTROS_[0]) {
    sh.clear(); sh.getRange(1, 1).setValue('COMPETIS · copiadas de la app de Gabi (solo lectura) · filtra en la fila 4').setFontWeight('bold').setFontSize(13);
    sh.getRange(2, 1).setValue('Se combinan todos los filtros. En ÁMBITO, CLASIFICATORIO, NIVEL y FORMATO puedes poner varios separados por comas (ej. «Elite, RX»): vale cualquiera de ellos. Fechas en dd/mm/aaaa; vacío = sin límite. Marca ↻ ACTUALIZAR para copiar ahora de la app de Gabi.').setFontColor('#666666').setWrap(false);
    sh.getRange(3, 1, 1, COMP_FILTROS_.length).setValues([COMP_FILTROS_]).setFontWeight('bold').setBackground('#f59e0b').setFontColor('#ffffff');
    sh.getRange(4, 1, 1, COMP_FILTROS_.length).setValues([['', '', '', '', '', '', '', '', '', true, false, false]]).setBackground('#fff7e6');
    var dv = function (l) { return SpreadsheetApp.newDataValidation().requireValueInList(l, true).setAllowInvalid(true).build(); };
    sh.getRange(4, 1, 1, 4).setNumberFormat('dd/mm/yyyy').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
    sh.getRange(4, 5).setDataValidation(dv(['Todas', 'Andalucía', 'España', 'Internacional', 'Andalucía, España']));
    sh.getRange(4, 6).setDataValidation(dv(['Todas', 'Sí', 'No', 'Sin dato']));
    sh.getRange(4, 7).setDataValidation(dv(['Todos'].concat(NIVELES_RE_.map(function (x) { return x[0]; })).concat(['Elite, RX'])));
    sh.getRange(4, 8).setDataValidation(dv(['Todos'].concat(FORMATOS_RE_.map(function (x) { return x[0]; }))));
    sh.getRange(4, 10, 1, 3).insertCheckboxes();
    sh.setFrozenRows(6);
  }
  f = f || filtroDesdeSheet_(sh);
  var L = filtrarCompetis_(listaCompetis_(), f), cf = leerConfig_();
  var datos = L.map(function (x) { return COMP_COLS_.map(function (h) { return h === 'INSCRIPCIÓN' ? (fechaInscCompeti_(x) ? isoAFecha(fechaInscCompeti_(x)) : '') : String(x[h] == null ? '' : x[h]); }); });
  var ult = Math.max(sh.getLastRow(), 7); if (ult >= 6) sh.getRange(6, 1, ult - 5, Math.max(sh.getLastColumn(), COMP_COLS_.length)).clearContent().clearFormat();
  sh.getRange(5, 1).setValue(L.length + ' competis · última copia: ' + (cf.competis_copia || '—')).setFontColor('#666666');
  sh.getRange(6, 1, 1, COMP_COLS_.length).setValues([COMP_COLS_]).setFontWeight('bold').setBackground('#333333').setFontColor('#ffffff');
  if (datos.length) {
    sh.getRange(7, 1, datos.length, COMP_COLS_.length).setValues(datos).setWrap(true).setVerticalAlignment('top');
    var colA = COMP_COLS_.indexOf('ÁMBITO') + 1, bg = datos.map(function (d) { return [d[colA - 1] === 'Andalucía' ? '#e6f4ea' : d[colA - 1] === 'España' ? '#fff4e5' : '#eef2ff']; });
    sh.getRange(7, colA, datos.length, 1).setBackgrounds(bg);
    sh.getRange(7, 1, datos.length, 1).setFontWeight('bold');
  }
  [240, 90, 90, 130, 110, 100, 100, 90, 140, 170, 140, 240, 160, 200, 90, 80].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  return L.length;
}
function editarCompetisSheet_(e) {
  var sh = e.range.getSheet(), f = e.range.getRow(), c = e.range.getColumn();
  if (f !== 4) return;
  if (c === 12 && e.range.getValue() === true) {
    SpreadsheetApp.getActive().toast('Copiando de la app de Gabi…', 'Road To Elite', 5);
    var n = copiarCompetis_(); sh.getRange(4, 12).setValue(false);
    SpreadsheetApp.getActive().toast(n + ' nuevas · ' + (leerConfig_().competis_copia || ''), 'Road To Elite', 5);
  }
  MEMO = null; pintarCompetisSheet_();
}
function menuCompetis() { var n = copiarCompetis_(); MEMO = null; var k = pintarCompetisSheet_(); var sh = miLibro_().getSheetByName(COMP_VISTA_); if (sh) miLibro_().setActiveSheet(sh); SpreadsheetApp.getUi().alert('Competis copiadas de la app de Gabi: ' + n + ' nuevas.\n' + (leerConfig_().competis_copia || '') + '\n\nEn «' + COMP_VISTA_ + '» se ven ' + k + ' con los filtros actuales.'); }
function competisLunes() { return conSalud_('competisLunes', competisLunes_sin_); }
function competisLunes_sin_() { try { copiarCompetis_(); } catch (e) { Logger.log('Competis: ' + e); } }
function listaCompetis_() {
  var hoy = hoyIso_();
  return listar_(HOJAS.COMPETIS).filter(function (r) { return r.NOMBRE; }).map(function (r) {
    var o = {}; ESQ_BD_[HOJAS.COMPETIS].cab.forEach(function (h) { o[h] = r[h] == null ? '' : String(r[h]); }); o._iso = celdaIso_(r.INICIO) || '';
    if (!o['ÁMBITO']) Object.assign(o, clasificarCompeti_(o));
    o._fin = celdaIso_(r.FIN) || o._iso; o._ins = fechaInscCompeti_(r); o._pasada = !!o._iso && (celdaIso_(r.FIN) || o._iso) < hoy; return o;
  }).sort(function (a, b) { return (a._iso || '9999') < (b._iso || '9999') ? -1 : 1; });
}
/** Seguimiento de una competi en Google Calendar: competi + inscripción + clasificatorio (eventos de día completo, marcados [Road To Elite]). */
function seguirCompeti_(b) {
  var r = listar_(HOJAS.COMPETIS).filter(function (x) { return x.ID === String(b.id || ''); })[0];
  if (!r) throw new Error('competi_no_encontrada');
  borrarCalCompeti_(r);
  if (!b.seguir) { actualizarFila_(HOJAS.COMPETIS, r._fila, { SEGUIMIENTO: 'No', GCAL: '', 'INSCRIPCIÓN': '', 'CLASIFICATORIO (hecho)': '' }); return { ok: true }; }
  var fi = celdaIso_(b.inscripcion || r['FECHA INSCRIPCIÓN']), fc = celdaIso_(b.clasificatorio || r['FECHA CLASIFICATORIO']), ini = celdaIso_(r.INICIO), fin = celdaIso_(r.FIN) || ini;
  var cal = calendario_(), ids = [], lugar = [r.CIUDAD, r.PROVINCIA].filter(Boolean).join(', ');
  var desc = MARCA_CAL + ' competi ' + r.ID + '\n' + [r['CATEGORÍAS'], r.PRECIO, r.WEB || r.WODBUSTER || r.INSTAGRAM, r.NOTAS].filter(Boolean).join('\n');
  var dia = function (iso) { return new Date(iso + 'T12:00:00Z'); };
  if (ini) ids.push('C:' + cal.createAllDayEvent('🏆 ' + r.NOMBRE, dia(ini), dia(sumarDias(fin, 1)), { description: desc, location: lugar }).getId());
  if (fi) ids.push('I:' + cal.createAllDayEvent('📝 Inscripción · ' + r.NOMBRE, dia(fi), { description: desc + '\n\nAbre la inscripción: ' + (r.WODBUSTER || r.WEB || '') }).getId());
  if (fc) ids.push('Q:' + cal.createAllDayEvent('🎯 Clasificatorio · ' + r.NOMBRE, dia(fc), { description: desc + '\n\nClasificatorio: ' + (r.CLASIFICATORIO || '') + (r['CATEGORÍAS CLASIFICATORIO'] ? ' (' + r['CATEGORÍAS CLASIFICATORIO'] + ')' : '') }).getId());
  actualizarFila_(HOJAS.COMPETIS, r._fila, { SEGUIMIENTO: 'Sí', 'FECHA INSCRIPCIÓN': fi ? isoAFecha(fi) : '', 'FECHA CLASIFICATORIO': fc ? isoAFecha(fc) : '', 'INSCRIPCIÓN': fi ? 'Pendiente' : '', 'CLASIFICATORIO (hecho)': fc ? 'Pendiente' : '', GCAL: ids.join('|') });
  return { ok: true, eventos: ids.length };
}
function borrarCalCompeti_(r) {
  String(r.GCAL || '').split('|').filter(Boolean).forEach(function (x) { try { var ev = calendario_().getEventById(x.slice(2)); if (ev) ev.deleteEvent(); } catch (e) { Logger.log('Calendar competi: ' + e); } });
}
/** Respuesta a «¿te has inscrito? / ¿has hecho el clasificatorio?». No → fuera del calendario y del seguimiento. */
function responderCompeti_(b) {
  var r = listar_(HOJAS.COMPETIS).filter(function (x) { return x.ID === String(b.id || ''); })[0];
  if (!r) throw new Error('competi_no_encontrada');
  if (!b.hecho) { borrarCalCompeti_(r); actualizarFila_(HOJAS.COMPETIS, r._fila, { SEGUIMIENTO: 'No', GCAL: '', 'INSCRIPCIÓN': b.que === 'inscripcion' ? 'No' : r['INSCRIPCIÓN'], 'CLASIFICATORIO (hecho)': b.que === 'clasificatorio' ? 'No' : r['CLASIFICATORIO (hecho)'] }); return { ok: true, quitada: true }; }
  var o = {}; if (b.que === 'inscripcion') o['INSCRIPCIÓN'] = 'Hecha'; else o['CLASIFICATORIO (hecho)'] = 'Hecho';
  actualizarFila_(HOJAS.COMPETIS, r._fila, o);
  return { ok: true };
}
/** Preguntas pendientes: seguidas cuya fecha de inscripción o de clasificatorio ya ha llegado y aún no se ha contestado. */
function preguntasCompetis_() {
  var hoy = hoyIso_(), out = [];
  try {
    listar_(HOJAS.COMPETIS).filter(function (r) { return r.SEGUIMIENTO === 'Sí'; }).forEach(function (r) {
      var fi = celdaIso_(r['FECHA INSCRIPCIÓN']), fc = celdaIso_(r['FECHA CLASIFICATORIO']);
      if (fi && fi <= hoy && r['INSCRIPCIÓN'] === 'Pendiente') out.push({ id: r.ID, que: 'inscripcion', nombre: r.NOMBRE, fecha: r['FECHA INSCRIPCIÓN'], texto: '¿Te has inscrito en ' + r.NOMBRE + '?' });
      if (fc && fc <= hoy && r['CLASIFICATORIO (hecho)'] === 'Pendiente') out.push({ id: r.ID, que: 'clasificatorio', nombre: r.NOMBRE, fecha: r['FECHA CLASIFICATORIO'], texto: '¿Has hecho el clasificatorio de ' + r.NOMBRE + '?' });
    });
  } catch (e) {}
  return out;
}
/** Aviso por correo (una vez por pregunta) cuando llega la fecha. */
function avisarCompetis_() {
  preguntasCompetis_().forEach(function (q) {
    var k = 'COMPETI_AVISO_' + q.id + '_' + q.que; if (PROPS.getProperty(k)) return;
    try { MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, name: 'Road To Elite', subject: q.texto, htmlBody: '<p>' + esc_(q.texto) + ' (fecha: ' + esc_(q.fecha) + ')</p><p>Contéstalo en la app: si es «No», se quita del calendario y del seguimiento.</p><p><a href="' + CONFIG.URL_APP + '">Abrir Road To Elite</a></p>' }); PROPS.setProperty(k, hoyIso_()); } catch (e) { Logger.log('Aviso competi: ' + e); }
  });
}

// Copia de MOTOR_GUIA.md (docs/MOTOR_GUIA.md del repositorio): se usa si la de Drive no se puede leer y para crearla la primera vez.
var MOTOR_GUIA_BASE_ = "# MOTOR_GUIA · Road To Elite\n\n> **09/11/2026 · cambios de archivos:** el libro «Road to Elite · Motor WODs» se llama ahora **«Road to Elite · Motor»** (mismo ID, `1qsbxCXhTF-K-9reEBTwjqMJ4TnKUx0QadfhbJ0t8PPU`; hace más funciones que los WODs). La **Base de datos Vídeos** está ahora en 2DO CEREBRO › CROSSFIT › APP (mismo ID); la app de Gabi trabaja con su DICCIONARIO y copia allí los martes lo que falte.\n\nGuía que sigue el motor que genera los entrenamientos (metcons a medida, mega WOD, extras con «Estímulos que quiero»).\n\n- **Las tablas `## TABLA · …` las lee el servidor de verdad.** Si cambias una fila, cambia lo que genera el motor, sin tocar código.\n  - Mantén las columnas y el formato `| a | b |`.\n  - Los alias van separados por comas, en mayúsculas o minúsculas (da igual) y sin tildes obligatorias.\n  - Una fila que empieza por `#` se ignora.\n- **El texto de «Claves» lo leemos Claude y Gemini** para diseñar, revisar y explicar.\n- La copia de trabajo vive en Google Drive (`MOTOR_GUIA.md`, junto a los backups). El servidor la relee cada 6 h o al ejecutar `configurar`.\n- Fuentes:\n  - `Rendimiento_Hibrido_GuiaDefinitiva_md.md` (manual v2.0);\n  - las notas de coach de Fabrik: MODALIDAD, OBJETIVO, LIMITANTES;\n  - las claves de CrossFit acordadas en el proyecto «Road To Elite».\n\n## TABLA · FORMATOS\n\n| CLAVE | NOMBRE | MIN | MAX | VENTANA | SISTEMA | ZONA | RPE | REPS x | CUÁNDO | ESTRATEGIA |\n|---|---|---|---|---|---|---|---|---|---|---|\n| SPRINT | For time corto | 3 | 8 | cap | glucolítico | Z6–Z7 | 9 | 0.8 | Sprint de competición, 2–3 movimientos, cargas medias | Salida fuerte; tandas grandes desde el principio; transiciones de menos de 3″ |\n| AMRAP_C | AMRAP corto | 6 | 10 | continuo | glucolítico | Z5–Z6 | 8–9 | 1 | Potencia con fatiga, pocas transiciones | 85–90 % desde la ronda 1 y tandas fijas |\n| AMRAP | AMRAP medio | 11 | 20 | continuo | mixto (umbral) | Z4–Z5 | 7–8 | 1.2 | Ritmo sostenido con interferencia | Ronda 1 al 80 %; mira el tiempo por ronda y no lo dejes caer más de un 10 % |\n| AMRAP_L | AMRAP largo | 21 | 40 | continuo | aeróbico | Z3 | 6–7 | 1.4 | Capacidad aeróbica, movimientos de baja demanda técnica | Sin picos; misma carrera o erg por ronda (como pide Fabrik) |\n| FOR_TIME | For time con cap | 8 | 20 | cap | mixto | Z4–Z6 | 8 | 1.2 | Gestión de WOD, chipper corto o rondas | No te vayas en el primer tercio; acelera en el último |\n| CHIPPER | Chipper | 15 | 30 | cap | mixto-aeróbico | Z3–Z5 | 7–8 | 1.5 | Muchos apartados; administrar para llegar con energía al final | Cada apartado al 75–80 %; el último es el que suma |\n| ESCALERA | 21-15-9 / ascendente | 6 | 15 | cap | glucolítico | Z5–Z6 | 8–9 | 1 | Movimientos de la misma familia con interferencia directa | Rompe antes del fallo: 21 = 12+9, 15 = 8+7, 9 = seguidas |\n| EMOM | EMOM | 10 | 30 | 60″ | mixto | Z4–Z5 | 7–8 | 0.5 | Densidad y calidad técnica en fatiga; alterna minutos | Trabajo de 35–45″ y descanso de 15–25″; si pasas de 50″, baja reps |\n| EVERY | Every 3–4′ (P1) | 12 | 30 | 3–4′ (60–90″ ON) | potencia con fatiga | Z6–Z8 | 9 | 0.7 | Potencia con fatiga: series al 90 % con recuperación casi completa | Cada serie al 90 %; si la caída pasa del 10 %, para |\n| INTERVALOS | Trabajo:descanso | 12 | 30 | 2:1 · 1:1 · 1:2 | umbral / VO₂ | Z5–Z7 | 8–9 | 0.7 | Ergos + gimnásticos; P4 umbral/pico | Mismo ritmo en todas las series; la última igual que la primera |\n| VENTANAS | Heavy en ventanas | 10 | 20 | E2–3′ | fuerza en fatiga | — | 8–9 | 0.4 | Halterofilia o fuerza pesada tras erg o gimnásticos | Ventana 1 ligera, ventana 2 exigente (estilo Fabrik); calidad antes que velocidad |\n| SINCRO | Pareja o equipo | 15 | 60 | variable | mixto | Z4–Z6 | 8 | 1.6 | Mega WOD o equipo | Reparto por fuerzas; el más fuerte en el movimiento limitante |\n\n## TABLA · MOVIMIENTOS\n\n`PATRÓN`:\n- OLY = olímpico\n- OH = empuje vertical / por encima de la cabeza\n- SENT = sentadilla\n- BISAGRA\n- TIRON = tirón gimnástico\n- EMPUJE_G = empuje gimnástico\n- SALTO\n- MONO = erg o carrera\n- CORE\n- ACARREO\n- CUERPO = peso corporal\n\n`CARGA` (etiquetas del motor): PIERNA · HOMBRO · AGARRE · CORE · IMPACTO · SNC · GLUC · AERO.\n\n`1RM DE`: la marca de APP · MARCAS de la que sale el peso, con su factor, por ejemplo «FRONT SQUAT 0.8». Si no tienes esa marca, se usa KG ♂ RX.\n\n| CLAVE | NOMBRE | ALIAS | MATERIAL | ALTERNATIVA | PATRÓN | CARGA | UNIDAD | REPS | KG ♂ RX | KG ♀ RX | 1RM DE | CÓDIGO |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n| THRUSTER | THRUSTERS | thruster, thrusters | barra | db | OH | PIERNA, HOMBRO, GLUC | reps | 12 | 43 | 29 | FRONT SQUAT 0.75 | T02 |\n| STOH | SHOULDER TO OVERHEAD | stoh, s2oh, shoulder to overhead, push press, push jerk, jerk | barra | db | OH | HOMBRO | reps | 12 | 61 | 43 | PUSH JERK 1 | M07 |\n| SNATCH | POWER SNATCH | snatch, power snatch, arrancada | barra | db | OLY | SNC, HOMBRO, PIERNA | reps | 8 | 43 | 29 | SNATCH 1 | |\n| SQ_SNATCH | SQUAT SNATCH | squat snatch | barra | db | OLY | SNC, HOMBRO, PIERNA | reps | 6 | 43 | 29 | SNATCH 1 | |\n| HANG_SN | HANG POWER SNATCH | hang snatch, hang power snatch | barra | db | OLY | SNC, HOMBRO | reps | 8 | 43 | 29 | SNATCH 1 | C04 |\n| OHS | OVERHEAD SQUAT | ohs, overhead squat | barra | db | OH | HOMBRO, PIERNA, CORE | reps | 10 | 43 | 29 | SNATCH 1 | |\n| DB_SNATCH | DB SNATCH (alternos) | db snatch, dumbbell snatch | db | kb | OLY | HOMBRO, GLUC | reps | 16 | 22.5 | 15 | | |\n| DB_C2OH | DB HANG CLEAN TO OVERHEAD | c2oh, clean to overhead, db hang clean to overhead | db | kb | OH | HOMBRO, PIERNA | reps | 12 | 22.5 | 15 | | |\n| OH_LUNGE | DB OVERHEAD WALKING LUNGE | oh lunge, overhead lunge, lunge oh | db | sandbag | OH | HOMBRO, PIERNA, CORE | m | 15 | 22.5 | 15 | | |\n| CLEAN | POWER CLEAN | clean, power clean, cargada | barra | db | OLY | SNC, PIERNA, AGARRE | reps | 10 | 61 | 43 | CLEAN 1 | |\n| SQ_CLEAN | SQUAT CLEAN | squat clean | barra | db | OLY | SNC, PIERNA | reps | 8 | 61 | 43 | CLEAN 1 | |\n| HANG_CL | HANG POWER CLEAN | hang clean, hang power clean | barra | db | OLY | SNC, AGARRE | reps | 10 | 61 | 43 | CLEAN 1 | C04 |\n| FRONT_SQ | FRONT SQUAT | front squat | barra | db | SENT | PIERNA, CORE | reps | 12 | 61 | 43 | FRONT SQUAT 1 | C02 |\n| DEADLIFT | DEADLIFT | deadlift, peso muerto | barra | kb | BISAGRA | PIERNA, AGARRE, CORE | reps | 10 | 102 | 70 | DEADLIFT 1 | |\n| WALLBALL | WALL BALLS | wall ball, wallball, wall balls | slamball | | OH | PIERNA, HOMBRO, GLUC | reps | 20 | 9 | 6 | | |\n| DU | DOUBLE UNDERS | du, dus, double under, double unders, comba | comba | | SALTO | IMPACTO, GLUC | reps | 50 | | | | C01 |\n| BURPEE | BURPEES | burpee, burpees | | | CUERPO | GLUC, IMPACTO | reps | 12 | | | | C03 |\n| BOB | BURPEES OVER THE BAR | burpee over the bar, bar facing burpee, bfb | barra | | CUERPO | GLUC, IMPACTO | reps | 12 | | | | C03 |\n| LAT_BURPEE | LATERAL BURPEES OVER DB | lateral burpee, burpee over db | db | | CUERPO | GLUC, IMPACTO | reps | 12 | | | | C03 |\n| BJO | BOX JUMP OVERS | box jump, box jump over, bjo, cajon | cajon | | SALTO | PIERNA, IMPACTO | reps | 12 | | | | W07 |\n| C2B | CHEST TO BAR | c2b, chest to bar | rack_dominadas | | TIRON | AGARRE, HOMBRO | reps | 12 | | | | M01 |\n| PULLUP | PULL-UPS | pull up, pull-up, dominadas | rack_dominadas | | TIRON | AGARRE | reps | 15 | | | | |\n| T2B | TOES TO BAR | t2b, toes to bar | rack_dominadas | | CORE | AGARRE, CORE | reps | 15 | | | | |\n| BMU | BAR MUSCLE UPS | bmu, bar muscle up | bmu | | TIRON | AGARRE, HOMBRO, SNC | reps | 6 | | | | M48 |\n| RMU | RING MUSCLE UPS | rmu, ring muscle up | anillas | | TIRON | AGARRE, HOMBRO, SNC | reps | 5 | | | | M49 |\n| HSPU | HSPU | hspu, handstand push up, pino flexion | hspu | | EMPUJE_G | HOMBRO | reps | 10 | | | | W31 |\n| HSWALK | HANDSTAND WALK | hs walk, handstand walk, pino andando | hspu | | EMPUJE_G | HOMBRO, CORE | m | 15 | | | | |\n| WALLWALK | WALL WALKS | wall walk | hspu | | EMPUJE_G | HOMBRO, CORE | reps | 5 | | | | |\n| ROPE | ROPE CLIMBS | rope, rope climb, cuerda | cuerda | | TIRON | AGARRE | reps | 3 | | | | M36 |\n| GHD | GHD SIT-UPS | ghd | box | | CORE | CORE | reps | 15 | | | | |\n| KBS | KB SWINGS | kb swing, kettlebell swing, swing | kb | db | BISAGRA | AGARRE, GLUC | reps | 20 | 24 | 16 | | |\n| DEVIL | DEVIL PRESS | devil press | db | | OLY | HOMBRO, GLUC | reps | 10 | 22.5 | 15 | | |\n| SANDBAG | SANDBAG CLEANS | sandbag, sandbag clean | sandbag | | OLY | PIERNA, CORE | reps | 10 | 70 | 45 | | M57 |\n| SB_LUNGE | SANDBAG LUNGES | sandbag lunge, lunges hyrox | sandbag_hyrox | db | SENT | PIERNA | m | 20 | 20 | 10 | | |\n| LUNGE | DB WALKING LUNGES | lunge, lunges, zancadas | db | | SENT | PIERNA | reps | 16 | 22.5 | 15 | | |\n| SLED | SLED PUSH 15 m | sled, trineo | trineo | | ACARREO | PIERNA, GLUC | reps | 2 | | | | M38 |\n| FARMER | FARMER CARRY | farmer, farmers carry | db | kb | ACARREO | AGARRE, CORE | m | 40 | 32 | 24 | | |\n| GUSANO | WORM CLEANS + CARRY 20 m | gusano, worm | gusano | | ACARREO | PIERNA, CORE | reps | 6 | | | | |\n| LODGE | SANDBAG OVER LODGE | lodge, over the wall | lodge_lanzar | | OLY | PIERNA, HOMBRO | reps | 8 | | | | M57 |\n| LODGE_JUMP | JUMP OVER LODGE | jump over lodge, jump over | lodge_saltar | | SALTO | PIERNA, IMPACTO | reps | 10 | | | | W07 |\n| ROW | ROW | row, remo, rower | ergos | | MONO | AERO, GLUC | cal | 15 | | | | |\n| SKI | SKIERG | ski, skierg | ergos | | MONO | AERO, HOMBRO | cal | 15 | | | | |\n| ASSAULT | ASSAULT BIKE | assault, air bike, airbike, echo, assault bike | ergos | | MONO | AERO, GLUC, PIERNA | cal | 15 | | | | |\n| BIKE | BIKE ERG | bike erg, bikeerg | ergos | | MONO | AERO, PIERNA | cal | 20 | | | | |\n| RUN | RUN | run, carrera, correr, running | _correr | | MONO | AERO, IMPACTO | m | 400 | | | | |\n| AIR_SQ | AIR SQUATS | air squat, air squats, sentadilla libre | | | SENT | PIERNA | reps | 25 | | | | M54 |\n| PUSHUP | PUSH-UPS | push up, push-ups, pushups, flexiones | | | EMPUJE_G | HOMBRO | reps | 15 | | | | |\n| PIKE_PU | PIKE PUSH-UPS (pies elevados) | pike push up, pike push-ups | | | EMPUJE_G | HOMBRO | reps | 10 | | | | M53 |\n| PISTOL | PISTOLS (alternas) | pistol, pistols, pistol squat | | | SENT | PIERNA, CORE | reps | 10 | | | | M19 |\n| BW_LUNGE | WALKING LUNGES (sin carga) | zancadas sin carga, walking lunges sin carga | | | SENT | PIERNA | reps | 24 | | | | |\n| JUMP_LUNGE | JUMPING LUNGES | jumping lunge, jumping lunges, zancadas con salto | | | SALTO | PIERNA, IMPACTO | reps | 20 | | | | W07 |\n| BROAD_JUMP | BROAD JUMPS | broad jump, broad jumps, salto horizontal | | | SALTO | PIERNA, IMPACTO | reps | 8 | | | | W07 |\n| TUCK_JUMP | TUCK JUMPS | tuck jump, tuck jumps | | | SALTO | PIERNA, IMPACTO | reps | 10 | | | | W07 |\n| BURPEE_BJ | BURPEE BROAD JUMPS | burpee broad jump, burpee broad jumps | | | CUERPO | GLUC, IMPACTO, PIERNA | reps | 10 | | | | C03 |\n| SITUP | SIT-UPS (AbMat) | sit up, sit-ups, situps, abmat | | | CORE | CORE | reps | 20 | | | | |\n| VUP | V-UPS | v-up, v-ups, vups | | | CORE | CORE | reps | 15 | | | | M08 |\n| HOLLOW | HOLLOW ROCKS | hollow rock, hollow rocks | | | CORE | CORE | reps | 20 | | | | M08 |\n| COPEN | COPENHAGEN PLANK (por lado, segundos = reps) | copenhagen, copenhague | | | CORE | CORE, PIERNA | reps | 20 | | | | M46 |\n| DIPS | DIPS | dip, dips, fondos | fondos | anillas | EMPUJE_G | HOMBRO | reps | 12 | | | | M53 |\n| BACK_SQ | BACK SQUAT | back squat | barra | db | SENT | PIERNA, CORE | reps | 8 | 100 | 70 | BACK SQUAT 1 | |\n| STRICT_PR | STRICT PRESS | strict press, shoulder press, press militar | barra | db | OH | HOMBRO | reps | 8 | 60 | 40 | STRICT PRESS 1 | M53 |\n| PUSH_PR | PUSH PRESS | push press | barra | db | OH | HOMBRO, PIERNA | reps | 10 | 60 | 40 | PUSH PRESS 1 | M55 |\n| BENCH | BENCH PRESS | bench press, press banca | barra | db | EMPUJE_G | HOMBRO | reps | 8 | 90 | 50 | BENCH PRESS 1 | |\n| BULGARIAN | BULGARIAN SPLIT SQUAT (por pierna) | bulgarian, bulgarian split squat, sentadilla bulgara, split squat | db | kb | SENT | PIERNA | reps | 10 | 22.5 | 15 | | M45 |\n| HIP_THRUST | HIP THRUST | hip thrust | barra | db | BISAGRA | PIERNA, GLUC | reps | 10 | 100 | 70 | | M28 |\n| SG_DL | SNATCH GRIP DEADLIFT | snatch grip deadlift, sg dl | barra | | BISAGRA | PIERNA, AGARRE | reps | 6 | 100 | 70 | DEADLIFT 0.7 | M47 |\n| WEIGHTED_PU | WEIGHTED PULL-UPS (chaleco o DB) | weighted pull up, dominada lastrada | rack_dominadas | | TIRON | AGARRE | reps | 5 | | | | |\n\n## TABLA · PATRONES\n\nPalabras sueltas del campo «Estímulos que quiero» que no nombran un movimiento sino una familia. El motor añade el movimiento de esa familia que más falta (según APP · METAS) y que tu material permite.\n\n| PALABRA | PATRÓN | CARGA |\n|---|---|---|\n| oh, overhead, por encima | OH | HOMBRO |\n| empuje, push | OH | HOMBRO |\n| tiron, pull, gimnasticos | TIRON | AGARRE |\n| agarre, grip | TIRON | AGARRE |\n| pierna, legs | SENT | PIERNA |\n| bisagra, cadena posterior | BISAGRA | PIERNA |\n| halterofilia, oly, olimpico | OLY | SNC |\n| saltos, salto, plio | SALTO | IMPACTO |\n| core, abdomen | CORE | CORE |\n| acarreo, carry | ACARREO | AGARRE |\n| erg, ergos, monoestructural | MONO | AERO |\n\n## TABLA · INTERFERENCIAS\n\n- `A` y `B`: CLAVE de movimiento o PATRÓN; `*` = cualquiera.\n- `TIPO`:\n  - `buscada`: el motor los pone seguidos en ese orden porque es la interferencia de competición que se quiere entrenar;\n  - `complementaria`: alternarlos da densidad sin que uno limite al otro;\n  - `evitar`: no los pone seguidos salvo que lo pidas.\n- `ORDEN`: `A>B` (A antes que B) o `A<>B` (da igual).\n\n| A | B | TIPO | ORDEN | EFECTO BUSCADO | CIENCIA |\n|---|---|---|---|---|---|\n| RUN | THRUSTER | buscada | A>B | Correr y llegar a la barra con cuádriceps pre-fatigado y la respiración alta, como en competición e HYROX | Tras la carrera el lactato y la ventilación están altos: el thruster exige estabilizar el tronco con alta demanda respiratoria. Entrena el aclarado de H⁺ en el músculo que sigue trabajando y la eficiencia del bracing con hiperventilación. |\n| ASSAULT | OH | buscada | A>B | Estabilidad de hombro y core por encima de la cabeza con la frecuencia cardiaca muy alta | La air bike recluta piernas y brazos a la vez y dispara la FC y el CO₂. Bloquear por encima de la cabeza así obliga al control motor (manguito, serrato, core) a funcionar con fatiga sistémica: es lo que limita en competición. |\n| ASSAULT | SQ_SNATCH | buscada | A>B | Squat snatch bajo interferencia directa de la air bike (objetivo literal de Fabrik) | La precisión del segundo tirón y la recepción profunda se degradan con fatiga cardiorrespiratoria. Practicarlo con cargas medias consolida el patrón (aprendizaje motor en fatiga) sin el riesgo de hacerlo pesado. |\n| ASSAULT | BMU | buscada | A>B | BMU con fatiga cardiorrespiratoria (Fabrik) | El kipping depende del timing; con FC alta se pierde coordinación. Entrenarlo así mejora la economía del gesto cuando importa. |\n| DU | THRUSTER | buscada | A<>B | Limitante respiratorio alto (Fabrik: «thruster + DU») | Los DU mantienen la FC alta con bajo coste muscular. El thruster suma carga de pierna y hombro, y entre los dos fuerzan la tolerancia ventilatoria. |\n| RUN | T2B | buscada | A>B | Sostener eficiencia de T2B tras la carrera; usar la carrera para bajar pulsaciones (Fabrik) | Pacing estratégico: regular la intensidad de la carrera para llegar al gimnástico limitante con FC más baja. Aprende a usar lo monoestructural como recuperación activa. |\n| ROW | WALLBALL | buscada | A>B | Erg sostenido y después un movimiento de baja demanda coordinativa (Fabrik) | Tras el remo el gasto cardiaco sigue alto. El wall ball, poco técnico, permite seguir en umbral sin que la técnica limite: estímulo aeróbico-glucolítico sostenido. |\n| BURPEE | BJO | buscada | A<>B | Gestión de WOD: llegar con energía al apartado final (burpee box jump over, Fabrik) | Combina impacto y extensión de cadera con alta demanda metabólica. Administrar los apartados previos entrena la distribución de esfuerzo (pacing). |\n| MONO | VENTANAS | buscada | A>B | Fuerza o heavy en fatiga: levantar pesado después del erg | Tras un esfuerzo glucolítico la fosfocreatina está parcialmente vaciada. Levantar pesado así entrena la expresión de fuerza con fatiga metabólica (PAPE limitado; el estímulo es la tolerancia). |\n| SKI | C2B | buscada | A>B | Limitante de hombro y dorsal: tirón doble (Fabrik: C2B + ski) | Los dos tiran con dorsal y tríceps largo: la fatiga local se acumula y obliga a romper series. Útil si la meta es resistencia de tirón. |\n| OH | TIRON | complementaria | A<>B | Densidad: empuje vertical y tirón alternos (Fran, 24.3) | Agonistas y antagonistas alternos: mientras uno trabaja el otro se recupera. Más trabajo total por minuto con menos fallo local. |\n| T2B | OH | complementaria | A<>B | Core flexor y empuje vertical alternos | Patrones distintos: permiten densidad sin solapar fatiga local. |\n| LUNGE | RUN | buscada | A>B | Transición de pierna estilo HYROX | Las zancadas fatigan cuádriceps y glúteo excéntricamente, y la carrera posterior exige economía con el músculo fatigado (específico de HYROX). |\n| SLED | RUN | buscada | A>B | Sled y después carrera (HYROX) | El trineo es concéntrico pesado con alta demanda glucolítica. Correr después entrena el «compromised running». |\n| SANDBAG | RUN | buscada | A<>B | Carga incómoda y carrera | La carga asimétrica pide core y respiración contra presión intraabdominal; la carrera exige recuperarse en movimiento. |\n| C2B | T2B | evitar | A<>B | Doble agarre seguido | Los flexores del antebrazo se fatigan y caen las dos series. Solo si quieres resistencia de agarre (escribe «agarre»). |\n| PULLUP | T2B | evitar | A<>B | Doble agarre seguido | Igual que arriba. |\n| DEADLIFT | ROW | evitar | A<>B | Cadena posterior y lumbar doble en volumen | El erector espinal acumula fatiga y la técnica del peso muerto se resiente. Sepáralos con otro movimiento. |\n| WALLBALL | THRUSTER | evitar | A<>B | Mismo patrón seguido (sentadilla + empuje) | Mono-fatiga: limita el volumen total sin un estímulo nuevo. Solo si buscas «pierna/hombro» al límite. |\n| HSPU | STOH | evitar | A<>B | Doble empuje vertical | El tríceps y el deltoides anterior fallan pronto; si se busca, que sea con reps bajas. |\n| OLY | BURPEE | buscada | A<>B | Halterofilia con pulsaciones altas | Mantener la técnica de la barra con FC alta: interferencia típica de los WODs de competición en la fase de realización. |\n\n## TABLA · PESOS\n\nRango de carga en % del 1RM según el formato. El motor usa la marca del ejercicio (o la de `1RM DE`) y redondea a 2,5 kg.\n\n| FORMATO | % MIN | % MAX | NOTA |\n|---|---|---|---|\n| SPRINT | 60 | 75 | Cargas medias que permitan tandas grandes |\n| AMRAP_C | 55 | 70 | |\n| AMRAP | 45 | 60 | |\n| AMRAP_L | 35 | 50 | Barra ligera: no es el objetivo (Fabrik: «no buscamos una barra exigente») |\n| FOR_TIME | 50 | 65 | |\n| CHIPPER | 40 | 55 | |\n| ESCALERA | 55 | 70 | |\n| EMOM | 55 | 70 | |\n| EVERY | 60 | 75 | P1: cargas que permitan el 90 % de intensidad |\n| INTERVALOS | 45 | 60 | |\n| VENTANAS | 75 | 88 | Ventana 1 al mínimo y ventana 2 al máximo |\n| SINCRO | 45 | 60 | Equipo: −10–15 % frente a individual |\n\n## TABLA · REGLAS\n\n| CLAVE | VALOR | EXPLICACIÓN |\n|---|---|---|\n| max_movs | 4 | Movimientos por parte (con el erg incluido) |\n| transicion_min | 2 | Minutos de transición entre partes del mega WOD |\n| erg_cada_ronda | 1 | Con «intercalar X», X va entre todas las rondas |\n| min_metcon | 12 | Minutos por defecto de un metcon a medida si no los pones |\n| max_metcon | 40 | Tope de minutos de un metcon a medida |\n| sesiones_duras_48h | 1 | Las sesiones duras (P1–P4, metcon RPE ≥8) se separan 48 h |\n| tope_compensacion | 40 | % máximo de volumen extra al compensar |\n| reps_equipo | 0.75 | Factor de reps por atleta en pareja o equipo |\n\n## Claves de CrossFit (Road To Elite)\n\n- **Interferencia con intención:** Fabrik programa la interferencia como objetivo, por ejemplo:\n  - «squat snatch bajo interferencia directa de air bike»;\n  - «BMU bajo fatiga cardiorrespiratoria»;\n  - «T2B bajo fatiga tras la carrera».\n\n  El motor debe reproducir ese tipo de pares, no evitarlos, cuando el objetivo es competir.\n- **Fichas de Fabrik:** cada metcon trae\n  - WOD MATERIAL, INTENSIDAD (RPE) y CARGA;\n  - MODALIDAD y MODALIDAD WOD;\n  - OBJETIVO;\n  - LIMITANTE muscular, técnico, respiratorio y estratégico.\n\n  Son la etiqueta de cada WOD en `MOTOR · ANÁLISIS («Road to Elite · Motor»)` y lo que el motor imita.\n- **«Respeta %»:**\n  - la carga media es media;\n  - en metcon largo, la barra no debe ser lo que determine el WOD;\n  - en ventanas, la 1 ligera y la 2 exigente.\n- **Pacing:** empezar exigente pero repetible; registrar si la caída viene del aire, el agarre, el hombro o las transiciones (manual §6.4).\n- **Realización (semanas 9–12):**\n  - interferencia máxima;\n  - gimnásticos y barra con pulsaciones altas;\n  - erg mezclado con barra y gimnásticos;\n  - heavys aislados y en metcon;\n  - accesorios en mantenimiento.\n- **Z6–Z8 (P1–P4):**\n  - pocos minutos y de máxima calidad;\n  - P1: every 3–4′ al 90 % con descanso casi completo;\n  - P4: umbral en impares y pico en pares;\n  - si un metcon de Fabrik ya es de esa familia (4 bloques estables), cuenta como el estímulo de la semana.\n- **Segundo P integrado (R04):**\n  - thrusters, DU, STOH, front squat, burpees, hang snatch/clean y C2B/BMU en fatiga, con erg o carrera;\n  - nunca a menos de 48 h de otra sesión dura.\n- **Viaje:** lo que no siga la programación sube la intensidad:\n  - densidad;\n  - tempo;\n  - chaleco;\n  - final tipo P con sprints de 20″.\n- **Carencias:** salen de APP · METAS (peso = prioridad × lo que falta). El motor prioriza los movimientos de las metas menos cubiertas que tu material permite.\n\n## Claves del manual de rendimiento híbrido (resumen para el motor)\n\n- **Concurrente:**\n  - separa la fuerza pesada y la carrera de calidad ≥6 h, o mejor en días distintos;\n  - la Z2 no interfiere si es suave de verdad.\n- **48 h entre sesiones duras.** Tope semanal de minutos por turno: AM 75′, PM 120′.\n- **Taper:** −41–60 % de volumen sin bajar intensidad ni frecuencia.\n- **Competición física:**\n  - fuera P1–P4 y extras;\n  - 72–48 h antes, volumen medio-bajo con intensidad alta;\n  - 48–24 h antes, repaso;\n  - 24 h antes, descanso.\n- **Combustible:** 6–8 g/kg de hidratos el día previo a una carga alta; 1–2 g/kg 2–3 h antes de competir.\n";

// ===================== v0.24 · MODO LESIÓN =====================
/*
 * Base de adaptaciones en «Road to Elite · Motor» › LESIONES · ADAPTACIONES (como la Base de datos Vídeos: tú apruebas o rechazas).
 * Una fila = zona + causa + movimiento(s) que molestan → por qué sustituirlo(s), con qué interfiere / evitar, recuperación de 48 h
 * y dos columnas que rellena la IA (Gemini, gratis): base científica + cómo evitarlo/corregirlo, y recuperación/prevención + 2 ejercicios de calentamiento.
 * Reestructurar › Lesión: 0–24 h sin carga en la zona (se sustituye o se aleja); 24–48 h carga muy ligera; después, lo que más carga la zona
 * lo más lejos posible. Fabrik incluido. Lo que no cabe: pendientes o eliminar (tú decides). Descanso solo si lo autorizas.
 */
HOJAS.LESIONES = 'LESIONES · ADAPTACIONES';
ESQ_BD_[HOJAS.LESIONES] = { cab: ['ID', 'ZONA', 'CAUSA', 'MOVIMIENTO (molesta)', 'SUSTITUIR POR', 'INTERFIERE / EVITAR', 'RECUPERACIÓN 48 H', 'IA · BASE CIENTÍFICA Y CÓMO EVITARLO', 'IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO', 'ESTADO', 'APROBADO POR', 'NOTAS', 'ACTUALIZADO'],
  anchos: [80, 110, 120, 200, 240, 240, 260, 380, 380, 110, 110, 220, 130], negrita: 'MOVIMIENTO (molesta)', color: '#dc2626',
  colores: [['ESTADO', 'APROBADA', '#dcfce7'], ['ESTADO', 'RECHAZADA', '#f3f4f6', '#9ca3af']],
  listas: { ESTADO: ['PROPUESTA', 'APROBADA', 'RECHAZADA'], ZONA: ['HOMBRO', 'CODO / MUÑECA', 'LUMBAR', 'RODILLA', 'CADERA / ISQUIOS', 'TOBILLO / AQUILES', 'CUELLO / TRAPECIO'] } };
// zona → cargas de la guía del motor que la cargan, y causas posibles (la app pregunta la causa)
var ZONAS_LESION_ = {
  'HOMBRO': { cargas: ['HOMBRO'], causas: ['Gimnásticos', 'Pino', 'Press'] },
  'CODO / MUÑECA': { cargas: ['AGARRE'], causas: ['Agarre', 'Front rack', 'Empuje'] },
  'LUMBAR': { cargas: ['CORE', 'SNC'], causas: ['Bisagra', 'Core', 'Impacto'] },
  'RODILLA': { cargas: ['PIERNA', 'IMPACTO'], causas: ['Impacto', 'Fuerza'] },
  'CADERA / ISQUIOS': { cargas: ['PIERNA'], causas: ['Sprint', 'Bisagra'] },
  'TOBILLO / AQUILES': { cargas: ['IMPACTO'], causas: ['Impacto'] },
  'CUELLO / TRAPECIO': { cargas: ['HOMBRO'], causas: ['Press', 'Gimnásticos'] }
};
// semilla (PROPUESTA: la apruebas o la cambias en la hoja). Movimientos y sustitutos separados por «;»
var LESIONES_BASE_ = [
  ['HOMBRO', 'Gimnásticos', 'T2B; TOES TO BAR', 'Sit-ups en el suelo; GHD sit-ups (rango corto); V-ups', 'Kipping pull-ups; C2B; Bar muscle-ups; Ring muscle-ups', 'Rotación externa con banda 3×15; colgado pasivo 3×15″ solo si no duele; movilidad torácica 5′'],
  ['HOMBRO', 'Gimnásticos', 'CHEST TO BAR; C2B; PULL-UPS; PULL UP; KIPPING', 'Ring rows (rango sin dolor); remo con DB a una mano', 'Muscle-ups; T2B con kip; rope climb', 'Face pull con banda 3×15; Y-T-W en el suelo 2×8'],
  ['HOMBRO', 'Gimnásticos', 'BAR MUSCLE UP; BMU; RING MUSCLE UP; RMU; RING DIP; DIPS', 'Ring rows + V-ups; remo invertido', 'C2B; dips; HSPU', 'Rotación externa con banda; aperturas con banda ligeras'],
  ['HOMBRO', 'Pino', 'HSPU; HANDSTAND PUSH; HANDSTAND WALK; HSW; PINO', 'Push-ups a rango sin dolor; bear crawl; plank shoulder taps', 'Strict press; push press; jerk; wall walk', 'Isométricos de hombro sin dolor 5×20″; movilidad escapular (wall slides)'],
  ['HOMBRO', 'Press', 'SHOULDER TO OVERHEAD; STOH; PUSH PRESS; PUSH JERK; SPLIT JERK; JERK; STRICT PRESS', 'Front squat (mismo estímulo de pierna, sin carga OH); landmine press ligero si no duele', 'Snatch; OHS; HSPU; wall ball', 'Rotación externa con banda 3×15; face pull; movilidad torácica'],
  ['HOMBRO', 'Press', 'THRUSTER; WALL BALL', 'Front squat (thruster) / goblet squat (wall ball) al mismo ritmo', 'STOH; snatch; HSPU', 'Rotación externa con banda; estiramiento de pectoral menor'],
  ['HOMBRO', 'Press', 'SNATCH; OVERHEAD SQUAT; OHS; OH LUNGE', 'Clean (si el rack no duele); deadlift ligero; zancada con barra en back rack', 'Jerk; HSPU', 'Movilidad de hombro sin carga; dislocaciones con pica suaves'],
  ['CODO / MUÑECA', 'Agarre', 'PULL-UPS; CHEST TO BAR; T2B; MUSCLE UP; ROPE CLIMB; FARMER', 'Ring rows con agarre neutro; sit-ups; trineo', 'Peso muerto pesado; KB swing pesado', 'Extensores/flexores de muñeca con banda 2×15; movilidad de muñeca'],
  ['CODO / MUÑECA', 'Front rack', 'FRONT SQUAT; THRUSTER; CLEAN; FRONT RACK', 'Back squat; goblet squat con agarre de copa', 'Push press; jerk', 'Movilidad de muñeca y tríceps; estiramiento de dorsal'],
  ['CODO / MUÑECA', 'Empuje', 'PUSH-UPS; PUSH UP; HSPU; DIPS; BURPEE', 'Push-ups en puños o paralelas; floor press DB agarre neutro; sprawl sin apoyo largo', 'Handstand; wall walk', 'Extensores de muñeca con banda; prensión suave'],
  ['LUMBAR', 'Bisagra', 'DEADLIFT; PESO MUERTO; RDL; KB SWING; SWING; GOOD MORNING', 'Hip thrust; glute bridge; bike', 'Snatch; clean; back squat pesado', 'Cat-camel 2×10; dead bug 3×8; caminar 10–15′'],
  ['LUMBAR', 'Bisagra', 'POWER CLEAN; SQUAT CLEAN; SNATCH; HANG', 'Box jumps sin carga; bike sprints; DB hang clean muy ligero si no duele', 'Deadlift; KB swing', 'Bird dog 3×8; McGill curl-up 3×6'],
  ['LUMBAR', 'Core', 'GHD; T2B; TOES TO BAR; V-UPS; SIT-UPS', 'Dead bug; plancha corta 20″; hollow hold suave', 'Kipping; GHD', 'Respiración diafragmática; bird dog'],
  ['LUMBAR', 'Impacto', 'RUN; CARRERA; BOX JUMP; DOUBLE UNDER', 'Bike; ski; remo suave', 'Saltos', 'Caminar 15′; movilidad de cadera'],
  ['RODILLA', 'Impacto', 'BOX JUMP; BROAD JUMP; TUCK JUMP; JUMPING LUNGE; DOUBLE UNDER; RUN; CARRERA', 'Step-ups a rango sin dolor; bike; remo', 'Pistols; zancadas; sentadilla profunda', 'Isométrico de cuádriceps (wall sit corto) 5×30″; bike suave 10′'],
  ['RODILLA', 'Fuerza', 'LUNGE; ZANCADA; PISTOL; BULGARIAN; SPLIT SQUAT; BACK SQUAT; FRONT SQUAT; SQUAT', 'Hip thrust; RDL ligero; box squat a rango sin dolor', 'Saltos; wall ball profundo', 'Isométrico de cuádriceps; Spanish squat con banda 3×30″'],
  ['CADERA / ISQUIOS', 'Sprint', 'SPRINT; RUN; CARRERA; SHUTTLE', 'Bike sprints; trineo empujando', 'RDL; deadlift; KB swing', 'Puente de glúteo isométrico 3×30″; Nordic solo excéntrico suave a partir de 72 h'],
  ['CADERA / ISQUIOS', 'Bisagra', 'RDL; DEADLIFT; GOOD MORNING; KB SWING', 'Hip thrust a rango corto; leg curl con banda ligera', 'Sprints; zancadas largas', 'Puente isométrico; movilidad de cadera 90/90'],
  ['TOBILLO / AQUILES', 'Impacto', 'DOUBLE UNDER; RUN; CARRERA; BOX JUMP; BURPEE; JUMP', 'Bike / ski / remo por calorías; step-ups', 'Saltos; sprints; comba', 'Isométrico de gemelo (elevación de talones sostenida) 5×30″; movilidad de tobillo'],
  ['CUELLO / TRAPECIO', 'Press', 'SHOULDER TO OVERHEAD; PUSH PRESS; JERK; SNATCH; FARMER; SHRUG', 'Front squat; bike', 'HSPU; carries pesados', 'Retracción cervical (chin tucks) 3×10; estiramiento de trapecio superior suave'],
  ['CUELLO / TRAPECIO', 'Gimnásticos', 'HSPU; HANDSTAND; PULL-UPS; MUSCLE UP', 'Ring rows; plank', 'Pino; HSW', 'Chin tucks; movilidad torácica']
];
function prepararLesiones_() {
  var sh = hojaMia_(HOJAS.LESIONES); if (!sh) return 0;
  var ya = {}; listar_(HOJAS.LESIONES).forEach(function (r) { ya[norm(r.ZONA + '|' + r.CAUSA + '|' + r['MOVIMIENTO (molesta)'])] = 1; });
  var nuevas = LESIONES_BASE_.filter(function (x) { return !ya[norm(x[0] + '|' + x[1] + '|' + x[2])]; }).map(function (x) {
    return { ID: 'LS' + nuevoId_(), ZONA: x[0], CAUSA: x[1], 'MOVIMIENTO (molesta)': x[2], 'SUSTITUIR POR': x[3], 'INTERFIERE / EVITAR': x[4], 'RECUPERACIÓN 48 H': x[5], ESTADO: 'PROPUESTA', ACTUALIZADO: ahora_() }; });
  filasEnHoja_(HOJAS.LESIONES, nuevas);
  try {   // listas desplegables: sustituir / evitar admiten varios (separados por «;») — se ofrecen los movimientos de la guía
    var G = guiaMotor_(), nombres = G.movs.map(function (m) { return m.n.split(' (')[0]; }).slice(0, 450), cab = cabeceras_(sh), n = Math.max(1, sh.getLastRow() - 1);
    var dv = SpreadsheetApp.newDataValidation().requireValueInList(nombres, true).setAllowInvalid(true).setHelpText('Varios separados por «;»').build();
    ['SUSTITUIR POR', 'INTERFIERE / EVITAR'].forEach(function (h) { var k = cab.indexOf(h) + 1; if (k > 0) sh.getRange(2, k, n, 1).setDataValidation(dv); });
  } catch (e) {}
  return nuevas.length;
}
/** Gemini (gratis) rellena las dos columnas de IA de las filas que no las tengan. */
function lesionesIA_(max) {
  var hechas = 0;
  listar_(HOJAS.LESIONES).filter(function (r) { return r.ESTADO !== 'RECHAZADA' && (!String(r['IA · BASE CIENTÍFICA Y CÓMO EVITARLO'] || '').trim() || !String(r['IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO'] || '').trim()); }).slice(0, max || 4).forEach(function (r) {
    var prompt = 'Eres fisioterapeuta deportivo y preparador de CrossFit de élite. Atleta RX de 90 kg con molestia en ' + r.ZONA + ' asociada a ' + r.CAUSA + ' (movimientos: ' + r['MOVIMIENTO (molesta)'] + '). ' +
      'Responde en español, sin markdown, con EXACTAMENTE dos partes separadas por una línea que diga solo ###. ' +
      'PARTE 1 (4–6 frases): base científica más probable de la molestia (estructuras implicadas, mecanismo de sobrecarga, por qué esos movimientos la provocan) y cómo evitarla y corregirla (técnica, volumen, movilidad, fuerza). ' +
      'PARTE 2: los 3–4 ejercicios de recuperación y prevención más efectivos con dosis, y al final «CALENTAMIENTO:» con 2 ejercicios para añadir a partir de ahora a los calentamientos. ' +
      'Si hay dolor agudo, inflamación o pérdida de fuerza, indica acudir a un profesional. No diagnostiques.';
    var g = geminiLlamar_(prompt, 900, 0.3); if (!g.ok) return;
    var pz = String(g.texto || '').split(/\n?\s*###\s*\n?/);
    actualizarFila_(HOJAS.LESIONES, r._fila, { 'IA · BASE CIENTÍFICA Y CÓMO EVITARLO': (pz[0] || '').trim().slice(0, 3000), 'IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO': (pz[1] || '').trim().slice(0, 3000), ACTUALIZADO: ahora_() });
    hechas++;
  });
  return hechas;
}
function menuLesionesIA() { var n = lesionesIA_(8); SpreadsheetApp.getUi().alert('Lesiones · IA: ' + n + ' filas completadas con Gemini.'); }
function reglasLesion_(zona, causa) {
  var Z = norm(zona), C = norm(causa || '');
  return listar_(HOJAS.LESIONES).filter(function (r) { return norm(r.ZONA) === Z && (!C || norm(r.CAUSA) === C) && r.ESTADO !== 'RECHAZADA'; })
    .map(function (r) { return { r: r, aprobada: r.ESTADO === 'APROBADA', pats: String(r['MOVIMIENTO (molesta)'] || '').split(/\s*;\s*/).map(norm).filter(Boolean), sust: String(r['SUSTITUIR POR'] || '').split(/\s*;\s*/).filter(Boolean), rec: r['RECUPERACIÓN 48 H'] || '', ia: r['IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO'] || '' }; });
}
/** Sustituye en el texto las líneas con movimientos que molestan (por la 1.ª opción de «SUSTITUIR POR»). Devuelve { texto, cambios[], sinRegla } */
function sustituirLesion_(texto, reglas) {
  var cambios = [], lineas = String(texto || '').split('\n').map(function (l) {
    var L = norm(l); if (!L.trim()) return l;
    for (var i = 0; i < reglas.length; i++) { var g = reglas[i];
      for (var j = 0; j < g.pats.length; j++) { var p = g.pats[j]; if (p.length < 2 || !new RegExp('(^|[^A-Z])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Z]|$)').test(L)) continue;
        var s = g.sust[0] || 'movilidad suave'; cambios.push({ de: p, a: s, aprobada: g.aprobada });
        return '⇄ ' + l.trim() + '  →  ' + s.toUpperCase() + (g.aprobada ? '' : ' (sin aprobar)'); } }
    return l;
  });
  return { texto: lineas.join('\n'), cambios: cambios };
}
/** p: { zona, causa, iso, turno, usarDescanso } */
function proponerLesion_(lunes, p) {
  var Z = ZONAS_LESION_[p.zona]; if (!Z) throw new Error('zona_no_valida');
  var reglas = reglasLesion_(p.zona, p.causa), avisos = [], cambios = [], w = pesoCarencias_(lunes);
  if (!reglas.length) avisos.push('No hay adaptaciones para ' + p.zona + (p.causa ? ' · ' + p.causa : '') + ' en LESIONES · ADAPTACIONES: solo se alejan los bloques que cargan la zona.');
  if (reglas.length && !reglas.some(function (g) { return g.aprobada; })) avisos.push('Las adaptaciones de ' + p.zona + ' aún están como PROPUESTA: apruébalas en «Road to Elite · Motor › ' + HOJAS.LESIONES + '». Mientras, se usan marcadas como «sin aprobar».');
  var t0 = horaDe_(isoOk_(p.iso) || hoyIso_(), p.turno === 'PM' ? 'PM' : 'AM'), t24 = t0 + 24 * 36e5, t48 = t0 + 48 * 36e5;
  var conf = filaSemana_(lunes) || {}, desc = norm(conf.DESCANSO || '');
  var esDesc = function (iso) { return desc && desc.indexOf(norm(DIAS_CORTO_[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7])) >= 0; };
  var carga = function (r) { var cg = cargasFila_(r); return Z.cargas.filter(function (c) { return cg.indexOf(c) >= 0; }).length; };
  var tocaRegla = function (r) { var t = norm((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || '')); return reglas.some(function (g) { return g.pats.some(function (pp) { return pp.length > 1 && t.indexOf(pp) >= 0; }); }); };
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && horaDe_(r._iso, r._turno) >= t0; });
  var aMover = [];
  filas.forEach(function (r) {
    var h = horaDe_(r._iso, r._turno), afecta = carga(r) > 0 || tocaRegla(r); if (!afecta) return;
    var su = sustituirLesion_(r.CONTENIDO, reglas), fase = h < t24 ? '0–24 h' : h < t48 ? '24–48 h' : '';
    if (fase) {
      if (su.cambios.length && (fase === '24–48 h' || !esDura_(r) || carga(r) <= 1)) {
        cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: (fase === '0–24 h' ? 'LESIÓN ' + p.zona + ' · 0–24 h: nada de carga en la zona. Sustituciones:\n' : 'LESIÓN ' + p.zona + ' · 24–48 h: carga MUY ligera (≤50 %, RPE ≤5, sin dolor).\n') + su.texto,
          motivo: fase + ': ' + su.cambios.map(function (c) { return c.de.toLowerCase() + ' → ' + c.a.toLowerCase() + (c.aprobada ? '' : ' (sin aprobar)'); }).join(' · ') });
      } else if (fase === '24–48 h' && !esDura_(r)) {
        cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: 'LESIÓN ' + p.zona + ' · 24–48 h: hazlo MUY ligero (≤50 % de la carga, RPE ≤5) y para si duele.\n' + r.CONTENIDO, motivo: '24–48 h: solo carga muy ligera' });
      } else aMover.push(Object.assign(r, { _motivo: fase + ' tras la molestia: carga ' + p.zona.toLowerCase() + (su.cambios.length ? ' y no basta con sustituir' : ' y no hay sustitución') }));
    } else if (esDura_(r) && carga(r) > 0) aMover.push(Object.assign(r, { _motivo: 'Es de lo que más carga ' + p.zona.toLowerCase() + ': lo más lejos posible', _lejos: true }));
  });
  // recolocar: Fabrik primero; huecos ≥48 h, del más lejano al más cercano; descanso solo si lo autorizas
  var mueven = {}; aMover.forEach(function (r) { mueven[r.ID] = 1; });
  var quedan = filas.filter(function (r) { return !mueven[r.ID]; }), ocupado = cargaBase_(quedan), slots = [];
  for (var k = 6; k >= 0; k--) { var iso = sumarDias(lunes, k); ['PM', 'AM'].forEach(function (t) { var h = horaDe_(iso, t); if (h >= t48 && (p.usarDescanso || !esDesc(iso))) slots.push({ iso: iso, turno: t, cap: CAP_TURNO_[t] }); }); }
  aMover.sort(function (a, b) { return (norm(b.ORIGEN) === 'FABRIK') - (norm(a.ORIGEN) === 'FABRIK') || prioridadFila_(b, w) - prioridadFila_(a, w); }).forEach(function (r) {
    var duroDia = function (iso) { return quedan.concat(aMover.filter(function (x) { return x._dest && x._dest.iso === iso; })).some(function (x) { return (x._dest ? x._dest.iso : x._iso) === iso && esDura_(x) && carga(x) > 0; }); };
    var s = slots.filter(function (s) { return (ocupado[s.iso + s.turno] || 0) + r._min <= s.cap && !(esDura_(r) && duroDia(s.iso)) && !(s.iso === r._iso && s.turno === r._turno && !r._lejos); })[0];
    if (r._lejos && s && horaDe_(s.iso, s.turno) <= horaDe_(r._iso, r._turno)) s = null;   // ya está lo más lejos posible
    if (s) { ocupado[s.iso + s.turno] = (ocupado[s.iso + s.turno] || 0) + r._min; r._dest = s; cambios.push({ id: r.ID, accion: 'mover', iso: s.iso, turno: s.turno, motivo: r._motivo + ' → ' + diaDe_(s.iso).toLowerCase() + ' ' + s.turno + (esDesc(s.iso) ? ' (día de descanso, lo autorizaste)' : '') }); }
    else if (!r._lejos) cambios.push({ id: r.ID, accion: 'pendiente', noCabe: true, carreraErg: esCarreraFila_(r) || /W03/.test(r['CÓDIGOS'] || ''), motivo: r._motivo + '. No cabe' + (p.usarDescanso ? '' : ' sin usar el descanso') + ': pendientes para la semana que viene o eliminarlo (tú decides).' });
  });
  // recuperación en las primeras 48 h
  var rec = reglas.map(function (g) { return g.rec; }).filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 3);
  var cal = reglas.map(function (g) { return (String(g.ia).match(/CALENTAMIENTO:([\s\S]*)$/i) || [])[1]; }).filter(Boolean)[0];
  [0, 1].forEach(function (d) { var iso = isoDeHora_(t0 + d * 24 * 36e5); if (iso > sumarDias(lunes, 6) || iso < lunes) return;
    cambios.push({ accion: 'nuevo', iso: iso, turno: p.turno === 'PM' || d ? 'PM' : 'AM', nuevo: { ORIGEN: 'LESIÓN', 'TÍTULO': 'Recuperación · ' + p.zona.toLowerCase() + ' (' + (d ? '24–48 h' : '0–24 h') + ')', CONTENIDO: (rec.length ? rec.join('\n') : 'Movilidad suave de la zona sin dolor 10′ + isométricos sin dolor.') + '\n\nSi el dolor sube, es agudo o hay pérdida de fuerza: consulta a un fisio.', MIN: 15, INTENSIDAD: '🟢 Suave', 'CÓDIGOS': '' }, motivo: 'Recuperación de la zona en las primeras 48 h' }); });
  if (cal) avisos.push('A partir de ahora, añade a tus calentamientos: ' + cal.trim().slice(0, 300));
  return { cambios: cambios, avisos: avisos, resumen: 'Lesión · ' + p.zona + (p.causa ? ' (' + p.causa + ')' : '') + ' desde ' + diaDe_(isoDeHora_(t0)) + ' ' + (p.turno === 'PM' ? 'PM' : 'AM') + ' · ' + cambios.filter(function (c) { return c.accion === 'adaptar'; }).length + ' adaptados · ' + cambios.filter(function (c) { return c.accion === 'mover'; }).length + ' movidos · ' + cambios.filter(function (c) { return c.noCabe; }).length + ' sin hueco' };
}
function isoDeHora_(t) { return Utilities.formatDate(new Date(t), CONFIG.ZONA, 'yyyy-MM-dd'); }

// ===================== v0.24 · INCENTIVAR ESTÍMULOS (reducibles) + APP · ESTÍMULOS EN BLOQUES =====================
/*
 * Marca estímulos semanales como «Reducible» (APP · METAS › REDUCIBLE). Al «incentivar» uno o varios estímulos una semana:
 *  - los reducibles que atacan el mismo patrón / músculos bajan un 50–75 % (meta de esa semana y bloques ya puestos);
 *  - los incentivados suben lo liberado × 1,25 (en minutos de trabajo → exposiciones extra);
 *  - los mensuales quedan con al menos un 17 % acumulado (dosis ligera);
 *  - si falta sitio: pregunta por el día de descanso; si no, por las mañanas; si no, prioriza lo incentivado y lo menos vital va a pendientes.
 * Todo pasa por Reestructurar (propuesta → tú apruebas o cambias bloques → deshacer).
 */
ESQUEMA['APP · METAS'].cab.push('REDUCIBLE'); if (ESQUEMA['APP · METAS'].anchos) ESQUEMA['APP · METAS'].anchos.push(90);
ESQUEMA['APP · METAS'].listas.REDUCIBLE = ['Sí', 'No'];
HOJAS.ESTBLOQUES = 'APP · ESTÍMULOS EN BLOQUES';
var MIN_MES_ = 0.17;
function incentivosConfig_() { try { return JSON.parse(String(leerConfig_().incentivos || '{}')) || {}; } catch (e) { return {}; } }
/** Δ de meta por semana (lunes → { metaId: Δ }) de los incentivos aplicados. */
function deltasIncentivo_(lunes) {
  var cfg = incentivosConfig_(), o = {};
  Object.keys(cfg).forEach(function (rid) { var x = cfg[rid]; if (x && x.lunes === lunes) Object.keys(x.deltas || {}).forEach(function (k) { o[k] = (o[k] || 0) + x.deltas[k]; }); });
  return o;
}
function guardarIncentivo_(rid, lunes, deltas) { var cfg = incentivosConfig_(); if (deltas) cfg[rid] = { lunes: lunes, deltas: deltas }; else delete cfg[rid];
  Object.keys(cfg).forEach(function (k) { if (cfg[k].lunes < sumarDias(hoyIso_(), -70)) delete cfg[k]; });
  ponerConfig_('incentivos', JSON.stringify(cfg), 'Incentivos aplicados por semana (Reestructurar › Incentivar)'); }
function pnum_(p) { var m = String(p || '').match(/P\s*([0-9])/i); return m ? +m[1] : 9; }
/** Palabras de patrón / músculo de una meta: cargas del catálogo + palabras de su prioridad y estímulo. */
function patronMeta_(m, cat) {
  var VAC = /^(P[0-9]+|CALIDAD|FATIGA|EN|DE|DEL|LA|EL|Y|CON|ESPECIFICA|INTEGRACION|ACCESORIOS|COMPETICION|SESION|SESIONES|TOTAL|SEMANA|MES|DOSIS|TRABAJO|BLOQUE|ESTIMULO)$/;
  var w = {}; codigosDe_(m.codigos || m['CÓDIGOS']).forEach(function (c) { String((cat[c] || {}).CARGA || '').split(/[ ,;/]+/).forEach(function (k) { k = norm(k); if (k.length > 2) w['C:' + k] = 1; }); });
  norm(String(m.prioridad || m.PRIORIDAD || '') + ' ' + String(m.estimulo || m['ESTÍMULO'] || '')).split(/[^A-Z0-9]+/).forEach(function (k) { if (k.length > 2 && !VAC.test(k)) w['P:' + k] = 1; });
  return Object.keys(w);
}
function solapan_(a, b) { return a.some(function (k) { return b.indexOf(k) >= 0; }); }
function metasIncentivo_(lunes) {
  var cache = cacheMetas_(), cat = catalogo_(), red = {};
  cache.metas.forEach(function (m) { red[m.ID] = m.REDUCIBLE === 'Sí'; });
  var sem = avanceMetas_('Semana', periodoSemana_(lunes), cache), mes = avanceMetas_('Mes', periodoMes_(lunes), cache);
  return sem.map(function (x) { return Object.assign(x, { ambito: 'Semana', reducible: !!red[x.id] }); }).concat(mes.map(function (x) { return Object.assign(x, { ambito: 'Mes', reducible: false }); }))
    .map(function (x) { x.patron = patronMeta_(x, cat); return x; });
}
function bloqueDeCodigo_(codigos, cat) { var cs = codigosDe_(codigos).filter(function (c) { return cat[c] && cat[c].CONTENIDO; }); return cs.length ? { c: cs[0], r: cat[cs[0]] } : null; }
/** p: { ids: [meta IDs a incentivar], reducir: 0.5|0.75, usarDescanso, mananas: [iso] } */
function proponerIncentivo_(lunes, p) {
  var ids = [].concat(p.ids || []).map(String), f = Math.min(0.75, Math.max(0.5, +p.reducir || 0.5));
  if (!ids.length) throw new Error('elige_estimulo');
  Object.keys(p.reducibles || {}).forEach(function (k) { try { marcarReducible_(k, !!p.reducibles[k]); } catch (e) {} });   // lo marcado en la app se guarda al calcular
  var cat = catalogo_(), metas = metasIncentivo_(lunes), w = pesoCarencias_(lunes), avisos = [], cambios = [], deltas = {};
  var inc = metas.filter(function (m) { return ids.indexOf(m.id) >= 0; }); if (!inc.length) throw new Error('elige_estimulo');
  var hoy = hoyIso_(), filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && r._iso >= hoy; });
  var deMeta = function (m) { var cs = codigosDe_(m.codigos); return filas.filter(function (r) { return codigosDe_(r['CÓDIGOS']).some(function (c) { return cs.indexOf(c) >= 0; }); }); };
  // 1) reducibles del mismo patrón / músculos
  var patInc = []; inc.forEach(function (m) { patInc = patInc.concat(m.patron); });
  var reds = metas.filter(function (m) { return m.ambito === 'Semana' && m.reducible && ids.indexOf(m.id) < 0 && solapan_(m.patron, patInc); });
  var liberados = 0, tocados = {};
  reds.forEach(function (m) {
    deltas[m.id] = -Math.round(m.meta * f * 10) / 10;
    deMeta(m).forEach(function (r) {
      if (tocados[r.ID] || norm(r.ORIGEN) === 'FABRIK') return; tocados[r.ID] = 1;
      var mi = Math.max(5, Math.round(r._min * (1 - f))); liberados += r._min - mi;
      cambios.push({ id: r.ID, accion: 'adaptar', min: mi, iso: r._iso, turno: r._turno, contenido: 'REDUCIDO −' + Math.round(f * 100) + ' % (semana de incentivo: ' + inc.map(function (x) { return x.estimulo; }).join(', ') + '). Haz ' + (f >= 0.75 ? 'una cuarta parte' : 'la mitad') + ' de las series, misma calidad.\n\n' + (r.CONTENIDO || ''),
        motivo: 'Reducible · «' + m.estimulo + '» ataca el mismo patrón: −' + Math.round(f * 100) + ' % (' + r._min + '′ → ' + mi + '′)' });
    });
    if (!deMeta(m).length) liberados += Math.round(((bloqueDeCodigo_(m.codigos, cat) || {}).r || {}).MIN * f || 10 * f);
  });
  if (!reds.length) avisos.push('Ningún estímulo REDUCIBLE ataca el mismo patrón que ' + inc.map(function (x) { return '«' + x.estimulo + '»'; }).join(', ') + ': solo se añade el incentivo (márcalos en APP · METAS › REDUCIBLE o en la hoja ' + HOJAS.ESTBLOQUES + ').');
  // 2) incentivados: + lo liberado × 1,25 (mínimo una exposición extra cada uno)
  var extra = Math.max(liberados * 1.25, 10 * inc.length), porInc = extra / inc.length, nuevos = [];
  inc.forEach(function (m) {
    var b = bloqueDeCodigo_(m.codigos, cat); if (!b) { avisos.push('«' + m.estimulo + '» no tiene bloque en el catálogo: sube su meta pero no puedo crear el bloque.'); return; }
    var mb = Math.max(8, Math.round((+b.r.MIN || 12) * 1.25)), n = Math.max(1, Math.round(porInc / mb));
    deltas[m.id] = (deltas[m.id] || 0) + (m.tipo === 'MIN' ? Math.round(porInc) : n);
    for (var i = 0; i < n; i++) nuevos.push({ prio: 0, meta: m, b: b, min: mb, titulo: b.r.NOMBRE + ' · 🔥 incentivo' + (n > 1 ? ' ' + (i + 1) + '/' + n : ''),
      contenido: 'INCENTIVO ×1,25 · dosis completa y un poco más: +25 % de volumen sobre lo habitual, calidad máxima.\n\n' + b.r.CONTENIDO, ambito: m.ambito });
  });
  // 3) mensuales: al menos un 17 % acumulado
  metas.filter(function (m) { return m.ambito === 'Mes' && ids.indexOf(m.id) < 0 && m.meta > 0 && m.programado < m.meta * MIN_MES_; }).forEach(function (m) {
    var b = bloqueDeCodigo_(m.codigos, cat); if (!b) return;
    var o = dosisPorAmbito_({ ORIGEN: 'EXTRA', MIN: b.r.MIN || 10, CONTENIDO: b.r.CONTENIDO, INTENSIDAD: b.r.INTENSIDAD || '', 'CÓDIGOS': b.c }, 'Mes');
    nuevos.push({ prio: 1 + pnum_(m.prioridad) / 10, meta: m, b: b, min: +o.MIN, titulo: b.r.NOMBRE + ' · mínimo mensual', contenido: o.CONTENIDO, ambito: 'Mes', intensidad: o.INTENSIDAD });
  });
  // 4) colocar: huecos libres; descanso solo si lo apruebas; mañanas solo si son dobles o las marcas
  var conf = filaSemana_(lunes) || {}, des = norm(conf.DESCANSO || ''), dob = norm(conf['DOBLES (mañanas libres)'] || ''), man = [].concat(p.mananas || []);
  var dc = function (iso) { return norm(DIAS_CORTO_[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7]); };
  var quitados = {}; cambios.forEach(function (c) { if (c.min != null) quitados[c.id] = c.min; });
  var ocupado = {}; filas.forEach(function (r) { var k = r._iso + r._turno; ocupado[k] = (ocupado[k] || 0) + (quitados[r.ID] != null ? quitados[r.ID] : r._min); });
  var slots = [], slotsDesc = [], slotsAM = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); if (iso < hoy) continue;
    var esD = des && des.indexOf(dc(iso)) >= 0;
    ['PM', 'AM'].forEach(function (t) { var s = { iso: iso, turno: t, cap: CAP_TURNO_[t] };
      if (t === 'AM' && dob.indexOf(dc(iso)) < 0 && man.indexOf(iso) < 0) { if (!esD) slotsAM.push(s); return; }
      if (esD && !p.usarDescanso) { slotsDesc.push(s); return; }
      slots.push(s); }); }
  var nNuevos = {};   // como mucho 1 bloque nuevo de cada tipo por sesión (no sobrecargar); se elige la sesión más libre
  var cabe = function (lista, nb, usado) { return lista.filter(function (s) { var key = s.iso + s.turno; return (ocupado[key] || 0) + (usado[key] || 0) + nb.min <= s.cap && !(nb.ya || []).some(function (x) { return x === s.iso; }) && !((nNuevos[key] || {})[nb.prio === 0 ? 'i' : 'm']); })
    .sort(function (a, b) { return ((ocupado[a.iso + a.turno] || 0) + (usado[a.iso + a.turno] || 0)) / a.cap - ((ocupado[b.iso + b.turno] || 0) + (usado[b.iso + b.turno] || 0)) / b.cap; })[0]; };
  var marcar = function (s, nb) { var key = s.iso + s.turno; usado[key] = (usado[key] || 0) + nb.min; (nNuevos[key] = nNuevos[key] || {})[nb.prio === 0 ? 'i' : 'm'] = 1; };
  var usado = {};
  nuevos.sort(function (a, b) { return a.prio - b.prio; });
  var pon = [], noCaben = [];
  nuevos.forEach(function (nb) { var mismos = pon.filter(function (x) { return x.meta.id === nb.meta.id; }).map(function (x) { return x.s.iso; }); nb.ya = mismos;
    var s = cabe(slots, nb, usado); if (s) { marcar(s, nb); pon.push({ nb: nb, s: s, meta: nb.meta }); } else noCaben.push(nb); });
  var pregunta = null;
  if (noCaben.length) {
    var minF = noCaben.reduce(function (a, x) { return a + x.min; }, 0);
    if (!p.usarDescanso && p.descanso !== 'no' && slotsDesc.length) pregunta = { tipo: 'descanso', min: minF, dias: slotsDesc.map(function (s) { return s.iso; }).filter(function (x, i, a) { return a.indexOf(x) === i; }), texto: 'Faltan ' + minF + '′ para meterlo todo. ¿Usas el día de descanso?' };
    else if (!man.length && p.mananas !== 'no' && slotsAM.length) pregunta = { tipo: 'mananas', min: minF, dias: slotsAM.map(function (s) { return s.iso; }), texto: 'Faltan ' + minF + '′. ¿Te cabe alguna mañana? Marca cuáles.' };
  }
  // 5) si sigue sin caber: lo incentivado manda; lo menos vital (extras no Fabrik de menor prioridad) va a pendientes
  if (!pregunta && noCaben.length) {
    noCaben.filter(function (nb) { return nb.prio === 0; }).forEach(function (nb) {
      var vict = filas.filter(function (r) { return norm(r.ORIGEN) !== 'FABRIK' && !tocados[r.ID] && !/CARRERA/.test(norm(r.ORIGEN)) && !codigosDe_(r['CÓDIGOS']).some(function (c) { return codigosDe_(nb.meta.codigos).indexOf(c) >= 0; }) && slots.some(function (s) { return s.iso === r._iso && s.turno === r._turno; }); })
        .sort(function (a, b) { return prioridadFila_(a, w) - prioridadFila_(b, w); })[0];
      if (!vict) return;
      ocupado[vict._iso + vict._turno] -= vict._min;
      var s = cabe(slots, nb, usado);
      if (!s) { ocupado[vict._iso + vict._turno] += vict._min; return; }   // no sirve de nada quitarlo
      tocados[vict.ID] = 1; cambios.push({ id: vict.ID, accion: 'pendiente', motivo: 'Menos vital: deja sitio a lo incentivado (pendiente para la semana que viene)' });
      marcar(s, nb); pon.push({ nb: nb, s: s, meta: nb.meta }); nb.puesto = true;
    });
    noCaben = noCaben.filter(function (nb) { return !nb.puesto; });
  }
  pon.forEach(function (x) { var nb = x.nb;
    cambios.push({ accion: 'nuevo', iso: x.s.iso, turno: x.s.turno, nuevo: { ORIGEN: 'EXTRA', 'TÍTULO': nb.titulo, CONTENIDO: nb.contenido, MIN: nb.min, INTENSIDAD: nb.intensidad || nb.b.r.INTENSIDAD || '', 'CÓDIGOS': nb.b.c, ORDEN: 75,
      'POR QUÉ (cursiva)': (nb.prio === 0 ? 'Incentivo de la semana: «' + nb.meta.estimulo + '» (+25 % de lo liberado por los reducibles).' : 'Mínimo mensual: «' + nb.meta.estimulo + '» al menos al 17 % acumulado.') },
      motivo: nb.prio === 0 ? '🔥 Incentivo · ' + nb.meta.estimulo : 'Mensual ≥17 % · ' + nb.meta.estimulo }); });
  noCaben.forEach(function (nb) { cambios.push({ accion: 'nuevo-pendiente', titulo: nb.titulo, motivo: (nb.prio === 0 ? 'Incentivo' : 'Mínimo mensual') + ' sin hueco: a pendientes de la semana que viene' }); });
  return { cambios: cambios, avisos: avisos, pregunta: pregunta, incentivo: { lunes: lunes, deltas: deltas },
    resumen: '🔥 Incentivar ' + inc.map(function (x) { return x.estimulo; }).join(' + ') + ' · reducibles −' + Math.round(f * 100) + ' % (' + reds.length + ') · ' + pon.filter(function (x) { return x.nb.prio === 0; }).length + ' bloques de incentivo · ' + pon.filter(function (x) { return x.nb.prio > 0; }).length + ' mensuales ≥17 % · ' + noCaben.length + ' a pendientes' };
}
function numSemana_(iso) { var d = new Date(iso + 'T12:00:00Z'), j = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - j + 3); var a = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - a) / 864e5 - 3 + ((a.getUTCDay() + 6) % 7)) / 7); }
function marcarReducible_(id, si) { var m = listar_(HOJAS.METAS).filter(function (x) { return x.ID === id; })[0]; if (!m) throw new Error('no_encontrado'); asegurarColumna_(HOJAS.METAS, 'REDUCIBLE'); actualizarFila_(HOJAS.METAS, m._fila, { REDUCIBLE: si ? 'Sí' : 'No' }); MEMO = null; return true; }
function datosIncentivo_(lunes) {
  return metasIncentivo_(lunes).map(function (m) { return { id: m.id, ambito: m.ambito, prioridad: m.prioridad, estimulo: m.estimulo, codigos: m.codigos, meta: m.meta, programado: m.programado, realizado: m.realizado, reducible: m.reducible, tipo: m.tipo,
    dias: (m.dias || []).map(function (d) { return diaDe_(d.iso).slice(0, 3) + ' ' + d.turno; }) }; });
}
// ---------- hoja APP · ESTÍMULOS EN BLOQUES ----------
function pintarHojaEstimulos_(lunes) {
  lunes = lunesDe_(isoOk_(lunes) || hoyIso_());
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID), sh = ss.getSheetByName(HOJAS.ESTBLOQUES) || ss.insertSheet(HOJAS.ESTBLOQUES);
  var cfg = leerConfig_(), sel = String(cfg.incentivar_sel || '').split(',').filter(Boolean), metas = metasIncentivo_(lunes), D = 12;
  var filas = [['ESTÍMULOS EN BLOQUES · semanales y mensuales', '', '', '', '', '', '', '', '', '', '', ''],
    ['Lunes →', isoAFecha(lunes), 'Semana nº ' + numSemana_(lunes), '↻', false, '🔥 PROPONER INCENTIVO →', false, 'Reducir', String(cfg.incentivo_reducir || '50 %'), 'Usar descanso', String(cfg.incentivo_descanso || 'Preguntar'), ''],
    ['Marca REDUCIBLE (se guarda en APP · METAS) y los que quieras INCENTIVAR; pulsa «PROPONER». Mañanas libres extra (ej. Mar, Jue) en L3 →', '', '', '', '', '', '', '', '', '', 'Mañanas:', String(cfg.incentivo_mananas || '')],
    ['ÁMBITO', 'PRIORIDAD', 'ESTÍMULO', 'CÓDIGOS', 'META', 'PROGRAMADO', 'HECHO', '%', 'BLOQUES (día · turno)', 'REDUCIBLE', 'INCENTIVAR', 'ID']];
  metas.forEach(function (m) { var d = deltasIncentivo_(lunes)[m.id];
    filas.push([m.ambito, m.prioridad || '', m.estimulo + (d ? (d > 0 ? '  🔥 +' : '  ↓ ') + d : ''), m.codigos || '', m.meta, Math.round(m.programado * 10) / 10, Math.round(m.realizado * 10) / 10, m.meta > 0 ? Math.round(Math.min(1, m.programado / m.meta) * 100) + ' %' : '—',
      (m.dias || []).map(function (x) { return diaDe_(x.iso).slice(0, 3) + ' ' + x.turno + ' · ' + String(x.titulo).slice(0, 28); }).join('\n'), m.ambito === 'Semana' ? m.reducible : '', sel.indexOf(m.id) >= 0, m.id]); });
  var prop = String(cfg.incentivo_propuesta || ''), P = null;
  if (prop) { var xr = listar_(HOJAS.REEST).filter(function (r) { return r.ID === prop && r.ESTADO === 'Propuesta'; })[0]; if (xr) try { P = JSON.parse(xr.PROPUESTA || '{}'); } catch (e) {} }
  var ini = filas.length + 2;
  if (P) {
    filas.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    filas.push(['PROPUESTA ' + prop, P.resumen || '', '', '', '', '✓ APLICAR →', false, '✗ DESCARTAR →', false, '', '', '']);
    if (P.pregunta) filas.push(['❓', P.pregunta.texto + (P.pregunta.tipo === 'descanso' ? '  → pon «Sí» en «Usar descanso» (K2) o «No» y vuelve a proponer.' : '  → escribe las mañanas en L3 (ej. Mar, Jue) o «No» y vuelve a proponer.'), '', '', '', '', '', '', '', '', '', '']);
    (P.avisos || []).forEach(function (a) { filas.push(['⚠', a, '', '', '', '', '', '', '', '', '', '']); });
    (P.cambios || []).forEach(function (c) { filas.push([({ adaptar: 'Reducido', nuevo: 'Nuevo', pendiente: 'A pendientes', 'nuevo-pendiente': 'A pendientes' })[c.accion] || c.accion, c.titulo || '', c.desdeIso ? diaDe_(c.desdeIso).slice(0, 3) + ' ' + (c.desdeTurno || '') : '', c.iso ? diaDe_(c.iso).slice(0, 3) + ' ' + (c.turno || '') : '', c.min || (c.nuevo && c.nuevo.MIN) || '', c.motivo || '', '', '', '', '', '', '']); });
  }
  sh.clear(); sh.setConditionalFormatRules([]);
  if (sh.getMaxColumns() < D) sh.insertColumnsAfter(sh.getMaxColumns(), D - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), D).clearDataValidations();
  if (sh.getMaxRows() < filas.length + 5) sh.insertRowsAfter(sh.getMaxRows(), filas.length + 5 - sh.getMaxRows());
  sh.getRange(1, 1, filas.length, D).setValues(filas.map(function (r) { return r.map(celdaSegura_); }));
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(2, 2).setNumberFormat('dd/mm/yyyy').setBackground('#fff7e0');
  sh.getRange(2, 5).insertCheckboxes(); sh.getRange(2, 7).insertCheckboxes(); sh.getRange(2, 6).setFontWeight('bold').setFontColor('#e8590c');
  sh.getRange(2, 9).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['50 %', '75 %'], true).build()).setBackground('#fff7e0');
  sh.getRange(2, 11).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Preguntar', 'Sí', 'No'], true).build()).setBackground('#fff7e0');
  sh.getRange(3, 12).setBackground('#fff7e0'); sh.getRange(3, 1).setFontColor('#666666').setWrap(false);
  sh.getRange(4, 1, 1, D).setBackground('#121212').setFontColor('#ffffff').setFontWeight('bold');
  sh.setFrozenRows(4);
  [80, 150, 240, 90, 60, 90, 70, 60, 260, 90, 90, 70].forEach(function (wd, j) { sh.setColumnWidth(j + 1, wd); });
  if (metas.length) {
    var bg = metas.map(function (m) { return new Array(D).fill(m.ambito === 'Semana' ? '#eef4ff' : '#f3eefe'); });
    sh.getRange(5, 1, metas.length, D).setBackgrounds(bg).setVerticalAlignment('top').setWrap(true);
    metas.forEach(function (m, i) { if (m.ambito === 'Semana') sh.getRange(5 + i, 10).insertCheckboxes(); });
    sh.getRange(5, 11, metas.length, 1).insertCheckboxes();
    sh.getRange(5, 12, metas.length, 1).setFontColor('#bbbbbb');
  }
  if (P) { var fp = 5 + metas.length + 1; sh.getRange(fp, 1, 1, D).setBackground('#ffedd5').setFontWeight('bold'); sh.getRange(fp, 7).insertCheckboxes(); sh.getRange(fp, 9).insertCheckboxes(); }
  sh.setTabColor('#e8590c');
  ponerConfig_('estimulos_bloques', "'" + lunes, 'Semana que muestra ' + HOJAS.ESTBLOQUES);
  return filas.length;
}
function menuEstimulosBloques() { pintarHojaEstimulos_(leerConfig_().estimulos_bloques || lunesDe_(hoyIso_())); SpreadsheetApp.getActive().getSheetByName(HOJAS.ESTBLOQUES).activate(); }
function editarEstimulosSheet_(e) {
  var sh = e.range.getSheet(), f = e.range.getRow(), c = e.range.getColumn(), v = e.range.getValue();
  var lunes = lunesDe_(celdaIso_(sh.getRange(2, 2).getValue()) || hoyIso_()), toast = function (m) { SpreadsheetApp.getActive().toast(m, 'Road To Elite', 5); };
  if (f === 2 && (c === 2 || c === 5)) { pintarHojaEstimulos_(lunes); return; }
  if (f === 2 && c === 9) { ponerConfig_('incentivo_reducir', String(v)); return; }
  if (f === 2 && c === 11) { ponerConfig_('incentivo_descanso', String(v)); return; }
  if (f === 3 && c === 12) { ponerConfig_('incentivo_mananas', String(v || '')); return; }
  var id = String(sh.getRange(f, 12).getValue() || '').trim();
  if (f >= 5 && id && c === 10) { marcarReducible_(id, v === true); toast((v === true ? 'Reducible' : 'No reducible') + ' (guardado en APP · METAS)'); return; }
  if (f >= 5 && id && c === 11) { var sel = String(leerConfig_().incentivar_sel || '').split(',').filter(Boolean).filter(function (x) { return x !== id; }); if (v === true) sel.push(id); ponerConfig_('incentivar_sel', sel.join(',')); return; }
  if (f === 2 && c === 7 && v === true) {
    var cfg = leerConfig_(), ids = String(cfg.incentivar_sel || '').split(',').filter(Boolean);
    if (!ids.length) { toast('Marca al menos un estímulo en INCENTIVAR'); pintarHojaEstimulos_(lunes); return; }
    var dsc = String(cfg.incentivo_descanso || 'Preguntar'), mtx = String(cfg.incentivo_mananas || '').trim();
    var mananas = /^no$/i.test(mtx) ? 'no' : [0, 1, 2, 3, 4, 5, 6].map(function (k) { return sumarDias(lunes, k); }).filter(function (iso) { return mtx && norm(mtx).indexOf(norm(DIAS_CORTO_[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7])) >= 0; });
    toast('Calculando el incentivo…');
    var P = reestProponer_('Incentivar', lunes, { ids: ids, reducir: /75/.test(cfg.incentivo_reducir) ? 0.75 : 0.5, usarDescanso: dsc === 'Sí', descanso: dsc === 'No' ? 'no' : '', mananas: mananas });
    ponerConfig_('incentivo_propuesta', P.id); MEMO = null; pintarHojaEstimulos_(lunes); toast(P.pregunta ? P.pregunta.texto : 'Propuesta lista: revísala abajo y marca «APLICAR» (o cámbiala desde la app › Reestructurar).'); return;
  }
  var prop = String(leerConfig_().incentivo_propuesta || '');
  if (f > 5 && c === 7 && v === true && prop) { reestAplicar_(prop, []); ponerConfig_('incentivo_propuesta', ''); ponerConfig_('incentivar_sel', ''); refrescarResumen_(); MEMO = null; pintarHojaEstimulos_(lunes); refrescarHojaSemana_(lunes); toast('Incentivo aplicado (deshacer: app › Reestructurar › Aplicadas)'); return; }
  if (f > 5 && c === 9 && v === true && prop) { var xr = listar_(HOJAS.REEST).filter(function (r) { return r.ID === prop; })[0]; if (xr) actualizarFila_(HOJAS.REEST, xr._fila, { ESTADO: 'Descartada' }); ponerConfig_('incentivo_propuesta', ''); pintarHojaEstimulos_(lunes); toast('Propuesta descartada'); }
}

