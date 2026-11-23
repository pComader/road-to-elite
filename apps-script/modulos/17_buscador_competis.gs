
// ===================== v0.33 · BUSCADOR AUTOMÁTICO DE COMPETIS + «ME INSCRIBO» (Google Calendar y app de Gabi) =====================
/*
 * Petición de Pablo 23/11/2026. Amplía la pestaña COMPETIS de «Road to Elite · Motor» (misma fila por competi, mismo ID).
 * Fuentes (todas gratuitas; nada de servicios de pago):
 *   1. ProgramAPP › COMPETIS PROPUESTAS: lo que la app de Gabi busca cada lunes (web, WODBuster, Instagram, compete.zone,
 *      calendario de The Box in the Box…). Se reutilizan sus datos tal cual (copiarCompetis_, solo lectura).
 *   2. ProgramAPP › EVENTOS de TIPO Competición / HYROX / DEKA que no estén en las propuestas (p. ej. una que Gabi metió a mano).
 *   3. CONFIG › competis_fuentes: páginas públicas de calendarios (UrlFetchApp). Gemini (nivel gratuito) solo EXTRAE lo que hay en el
 *      texto descargado; no inventa competis (sin texto descargado no se añade nada).
 * Ficha de cada competi (enriquecerCompeti_): se descargan su WEB, su WODBUSTER y su FUENTE y Gemini extrae fecha, lugar, inscripción,
 *   categorías, precios, estándares y WODs de ediciones pasadas. Un enlace que propone Gemini solo se guarda si aparece en lo descargado.
 *   Fecha dudosa (sin fecha, «por confirmar», o de un año anterior) → FECHA «Por confirmar» + ÚLTIMA CONOCIDA (edición del año en curso o anterior).
 * ESTÍMULOS: códigos de APP · ESTÍMULOS que trabaja la competi. Se detectan con el DETECTAR (regex) del catálogo sobre WODs y estándares,
 *   más los que proponga Gemini SOLO si existen en el catálogo o en APP · METAS. La app los enseña por NOMBRE y bloque, nunca por código.
 * ESTADO: Propuesta → Siguiendo (★ Seguir: calendario como en v0.20) → Inscrito (Me inscribo) · Descartada.
 * «Me inscribo»: (a) Google Calendar: la competi (si hay fecha y aún no estaba) + «✅ Inscrito» el día de la inscripción;
 *   (b) app de Gabi: se replica lo que hace aprobar una solicitud de evento (SOLICITUDES › «Evento aprobado = se añade a sus EVENTOS»):
 *   el nombre del evento se añade a ATLETAS › EVENTOS de la fila de Pablo. Solo esa celda, solo la fila cuyo EMAIL es el de Pablo
 *   (se vuelve a leer justo antes de escribir). Si la competi aún no está en EVENTOS (Gabi no la ha aprobado), queda «Pendiente» y se
 *   reintenta cada lunes: RTE nunca crea eventos ni filas de otros atletas. La categoría/equipo la elige Pablo en la app de Gabi
 *   (su propio aviso «elige categoría» de competisSinCategoria).
 * Semanal: competisLunes (lunes 15:00) → copiar + descubrir + enriquecer (máx. competis_ia_max con Gemini) + reintentos.
 */
var COMP_BUSC_COLS_ = ['FECHA', 'ÚLTIMA CONOCIDA', 'LUGAR', 'INSCRIPCIÓN INICIO', 'INSCRIPCIÓN FIN', 'PRECIOS', 'ESTÁNDARES', 'WODS PASADOS', 'ESTÍMULOS', 'ACTUALIZADO', 'ESTADO',
  'CATEGORÍA ELEGIDA', 'GCAL INSCRITO', 'GABI INSCRIPCIÓN', 'BUSCADOR'];
(function () {
  var E = ESQ_BD_[HOJAS.COMPETIS];
  COMP_BUSC_COLS_.forEach(function (h) { if (E.cab.indexOf(h) < 0) { E.cab.push(h); E.anchos.push(/WODS|ESTÁNDARES|BUSCADOR/.test(h) ? 360 : /ESTÍMULOS|PRECIOS|LUGAR/.test(h) ? 200 : 120); } });
  E.listas.ESTADO = ['Propuesta', 'Siguiendo', 'Inscrito', 'Descartada'];
  E.colores.push(['ESTADO', '^Inscrito$', '#dcfce7', '#14532d'], ['ESTADO', '^Descartada$', '#f3f4f6', '#9ca3af']);
})();
var COMP_ESTADOS_ = ['Propuesta', 'Siguiendo', 'Inscrito', 'Descartada'];
var COMP_DUDA_RE_ = /POR CONFIRMAR|SIN CONFIRMAR|PENDIENTE DE CONFIRMAR|A CONFIRMAR|PROVISIONAL|APROXIMAD|ESTIMAD|ORIENTATIV|TENTATIV|\bTBC\b|\bTBD\b|\bTBA\b|POR DETERMINAR|POR ANUNCIAR|PROXIMAMENTE/;
var COMP_FUENTES_DEF_ = 'https://theboxinthebox.com/competiciones-y-eventos-v2/';   // el calendario que cita la propia app de Gabi en FUENTE
var COMP_TIPOS_GABI_ = /COMPETICI|HYROX|DEKA|THROWDOWN/;

// ---------- configuración y columnas ----------
function prepararBuscadorCompetis_() {
  var c = leerConfig_(), n = 0;
  var pon = function (k, v, nota) { if (c[k] == null || c[k] === '') { ponerConfig_(k, v, nota); n++; } };
  pon('competis_buscador_activo', 'Sí', 'Sí/No · buscador automático de competis (lunes 15:00, con competisLunes): copia de la app de Gabi + calendarios públicos + ficha con Gemini gratis');
  pon('competis_fuentes', COMP_FUENTES_DEF_, 'Páginas públicas de calendarios de competis (separadas por espacios o comas). Gemini solo extrae lo que hay en el texto descargado');
  pon('competis_ia_max', '6', 'Fichas de competi que se completan con Gemini (gratis) en cada pasada semanal; las demás esperan a la siguiente');
  try { asegurarColsCompetis_(); } catch (e) { Logger.log('Columnas COMPETIS: ' + e); }
  return n + ' claves nuevas';
}
/** Añade al final de COMPETIS las columnas nuevas que falten (sin tocar las que hay). */
function asegurarColsCompetis_() {
  var sh = hojaMia_(HOJAS.COMPETIS), ult = sh.getLastColumn(), tiene = ult ? sh.getRange(1, 1, 1, ult).getDisplayValues()[0].map(function (h) { return String(h).trim(); }) : [];
  var faltan = ESQ_BD_[HOJAS.COMPETIS].cab.filter(function (h) { return tiene.indexOf(h) < 0; });
  if (!faltan.length) return 0;
  if (!ult) { sh.getRange(1, 1, 1, faltan.length).setValues([faltan]); }
  else { if (sh.getMaxColumns() < ult + faltan.length) sh.insertColumnsAfter(sh.getMaxColumns(), ult + faltan.length - sh.getMaxColumns()); sh.getRange(1, ult + 1, 1, faltan.length).setValues([faltan]).setBackground('#121212').setFontColor('#ffffff').setFontWeight('bold'); }
  delete CAB_[HOJAS.COMPETIS]; MEMO = null;
  return faltan.length;
}
function compCfg_() {
  var c = leerConfig_();
  return { activo: gabiSi_(c.competis_buscador_activo, 'Sí'), fuentes: String(c.competis_fuentes == null || c.competis_fuentes === '' ? COMP_FUENTES_DEF_ : c.competis_fuentes).split(/[\s,;]+/).filter(function (u) { return /^https?:\/\//i.test(u); }),
    iaMax: Math.max(0, Math.min(20, parseInt(c.competis_ia_max, 10) || 6)), yo: String(c.email_permitido || CONFIG.EMAIL_PERMITIDO).toLowerCase().trim() };
}

// ---------- utilidades ----------
/** Clave para no duplicar: nombre sin años, ediciones ni signos («Heart Fit Challenge 2027 Sevilla» = «HEARTFITCHALLENGESEVILLA»). */
function claveCompeti_(nombre) { return norm(nombre).replace(/\b(19|20)\d{2}\b|\b\d{1,2}(ST|ND|RD|TH|ª|º)?\s*EDICION\b|\bEDICION\b|\b'?\d{2}\b/g, ' ').replace(/[^A-Z0-9]+/g, ''); }
function anioIso_(iso) { return iso ? +String(iso).slice(0, 4) : 0; }
function rangoFechas_(ini, fin) { return !ini ? '' : isoAFecha(ini) + (fin && fin !== ini ? ' – ' + isoAFecha(fin) : ''); }
function urlOk_(u) { u = String(u || '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
/**
 * FECHA y ÚLTIMA CONOCIDA. Dudosa = sin fecha, texto que lo dice («por confirmar», «provisional», TBC…), Gemini dice que no está confirmada,
 * o la fecha es de un año anterior (es la de la última edición). Dudosa → «Por confirmar» + la de la edición del año en curso o anterior.
 */
function fechaCompeti_(o, ia) {
  ia = ia || {};
  var hoy = hoyIso_(), y = anioIso_(hoy);
  var ini = celdaIso_(ia.fecha_inicio) || celdaIso_(o.INICIO) || '', fin = celdaIso_(ia.fecha_fin) || celdaIso_(o.FIN) || ini;
  if (fin < ini) fin = ini;
  var txt = norm([o.NOTAS, o.INICIO, o.FIN, ia.notas_fecha].join(' '));
  var dudosa = !ini || ia.fecha_confirmada === false || COMP_DUDA_RE_.test(txt) || anioIso_(ini) < y;
  var ult = String(ia.ultima_edicion || '').trim(), uIni = celdaIso_(ult.split(/\s*[–-]\s*(?=\d)/)[0]);
  if (uIni && (anioIso_(uIni) < y - 1 || anioIso_(uIni) > y)) uIni = '';   // solo la del año en curso o el anterior
  if (!dudosa) return { FECHA: rangoFechas_(ini, fin), 'ÚLTIMA CONOCIDA': uIni && uIni < ini ? ult : '' };
  var conocida = uIni ? ult : !ini ? '' : ini >= hoy ? rangoFechas_(ini, fin) + ' (provisional)' : anioIso_(ini) >= y - 1 ? rangoFechas_(ini, fin) : '';
  return { FECHA: 'Por confirmar', 'ÚLTIMA CONOCIDA': conocida };
}
/** Códigos del catálogo de APP · METAS (columna CÓDIGOS) para aceptar los que proponga la IA. */
function codigosMetas_() { var m = {}; try { listar_(HOJAS.METAS).forEach(function (r) { codigosDe_(r['CÓDIGOS']).forEach(function (c) { m[c] = r['ESTÍMULO'] || r.META || c; }); }); } catch (e) {} return m; }
/** Estímulos de RTE que trabaja la competi: DETECTAR del catálogo sobre WODs (en fatiga) y estándares (fuera de metcon) + los de la IA que existan. */
function estimulosCompeti_(wods, estandares, iaCods, cat, metas) {
  cat = cat || catalogo_(); metas = metas || {};
  var out = [], mete = function (c) { c = String(c || '').trim().toUpperCase(); if (c && (cat[c] || metas[c]) && out.indexOf(c) < 0) out.push(c); };
  if (String(wods || '').trim()) codigosTexto_(wods, cat, true).forEach(mete);
  if (String(estandares || '').trim()) codigosTexto_(estandares, cat, false).forEach(mete);
  (iaCods || []).forEach(mete);
  return out.slice(0, 14);
}
function nombreEstimulo_(c, cat, metas) { var r = cat[c]; return r ? { c: c, nombre: r.NOMBRE || c, bloque: bloqueEstimulo_(c, r) } : { c: c, nombre: metas[c] || c, bloque: bloqueEstimulo_(c, null) }; }
/** Texto legible de una web pública (sin scripts ni estilos). Instagram no se descarga (pide sesión). */
function textoWeb_(url) {
  url = urlOk_(url); if (!url || /instagram\.com|facebook\.com/i.test(url)) return null;
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (RoadToElite)' } });
    if (r.getResponseCode() !== 200) return null;
    var html = String(r.getContentText() || ''), txt = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&euro;/g, '€').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    return { url: url, html: html, txt: txt.slice(0, 9000) };
  } catch (e) { Logger.log('Competi web ' + url + ': ' + e); return null; }
}
function jsonDeTexto_(t) { var s = String(t || ''), a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } }
function listaTexto_(v) { return Array.isArray(v) ? v.map(function (x) { return typeof x === 'string' ? x : JSON.stringify(x); }).join('\n') : String(v == null ? '' : v); }

// ---------- ficha de una competi ----------
function enriquecerCompeti_(r, opc) {
  opc = opc || {};
  var cat = opc.cat || catalogo_(), metas = opc.metas || codigosMetas_(), webs = [], vistos = {};
  if (opc.ia !== false && PROPS.getProperty('GEMINI_KEY')) [r.WEB, r.WODBUSTER, r.FUENTE].forEach(function (u) { u = urlOk_(u); if (!u || vistos[u] || webs.length >= 3) return; vistos[u] = 1; var w = textoWeb_(u); if (w && w.txt) webs.push(w); });
  var ia = {}, iaOk = false;
  if (opc.ia !== false && webs.length && PROPS.getProperty('GEMINI_KEY')) {
    var lista = Object.keys(cat).map(function (c) { return c + ' = ' + String(cat[c].NOMBRE || '').slice(0, 60); }).join('\n');
    var prompt = 'Eres el analista de competiciones de CrossFit de un atleta RX/Elite. Con SOLO el texto de estas páginas oficiales de la competición «' + r.NOMBRE + '» (no inventes nada; si un dato no aparece, déjalo vacío ""), ' +
      'devuelve SOLO un JSON con estas claves:\n{"fecha_inicio":"dd/mm/aaaa","fecha_fin":"dd/mm/aaaa","fecha_confirmada":true,"notas_fecha":"","ultima_edicion":"dd/mm/aaaa – dd/mm/aaaa (de la edición del año en curso o anterior, si el texto la da)",' +
      '"lugar":"ciudad, provincia o país (y recinto si viene)","inscripcion_inicio":"dd/mm/aaaa","inscripcion_fin":"dd/mm/aaaa","categorias":"","precios":"","estandares":"estándares/requisitos de cada categoría (pesos, gimnásticos exigidos)",' +
      '"wods_pasados":"WODs de ediciones pasadas o publicados, uno por línea","web":"url oficial","wodbuster":"url de wodbuster","estimulos":["códigos de la lista que esos WODs y estándares trabajan"]}\n' +
      'fecha_confirmada=false si la fecha es provisional, aproximada, de una edición anterior o no aparece. Hoy es ' + hoyTxt_() + '.\nLista de estímulos (CÓDIGO = nombre):\n' + lista + '\n\n' +
      webs.map(function (w) { return '=== ' + w.url + '\n' + w.txt.slice(0, Math.floor(14000 / webs.length)); }).join('\n\n');
    var g = geminiLlamar_(prompt, 1500, 0.1);
    if (g.ok) { ia = jsonDeTexto_(g.texto) || {}; iaOk = !!Object.keys(ia).length; }
  }
  var crudo = webs.map(function (w) { return w.html + '\n' + w.txt; }).join('\n');
  var enLoBajado = function (u) { u = urlOk_(u); return u && crudo.indexOf(u.replace(/\/$/, '')) >= 0 ? u : ''; };   // un enlace de la IA solo si existe en lo descargado
  var wods = listaTexto_(ia.wods_pasados).trim() || r['WODS PASADOS'] || '', est = listaTexto_(ia.estandares).trim() || r['ESTÁNDARES'] || '';
  var o = fechaCompeti_(r, ia);
  o.LUGAR = String(ia.lugar || '').trim() || r.LUGAR || [r.CIUDAD, r.PROVINCIA].filter(Boolean).join(', ');
  o['INSCRIPCIÓN INICIO'] = fechaCelda_(ia.inscripcion_inicio) || r['INSCRIPCIÓN INICIO'] || r['FECHA INSCRIPCIÓN'] || (celdaIso_(r['APERTURA INSCRIPCIÓN']) ? r['APERTURA INSCRIPCIÓN'] : '');
  o['INSCRIPCIÓN FIN'] = fechaCelda_(ia.inscripcion_fin) || r['INSCRIPCIÓN FIN'] || '';
  o.PRECIOS = String(ia.precios || '').trim() || r.PRECIOS || r.PRECIO || '';
  o['ESTÁNDARES'] = est.slice(0, 3000); o['WODS PASADOS'] = wods.slice(0, 4000);
  o['ESTÍMULOS'] = estimulosCompeti_(wods, est + '\n' + (r['CATEGORÍAS'] || ''), Array.isArray(ia.estimulos) ? ia.estimulos : [], cat, metas).join(', ');
  if (!r['CATEGORÍAS'] && ia.categorias) o['CATEGORÍAS'] = String(ia.categorias).slice(0, 500);
  if (!urlOk_(r.WEB) && enLoBajado(ia.web)) o.WEB = enLoBajado(ia.web);
  if (!urlOk_(r.WODBUSTER) && /wodbuster/i.test(ia.wodbuster || '') && enLoBajado(ia.wodbuster)) o.WODBUSTER = enLoBajado(ia.wodbuster);
  if (!r.FUENTE && webs.length) o.FUENTE = webs[0].url;
  o.BUSCADOR = (iaOk ? 'Gemini · ' : 'sin IA · ') + (webs.length ? webs.map(function (w) { return w.url; }).join(' · ') : 'sin webs legibles');
  o.ACTUALIZADO = ahora_();
  if (!r.ESTADO) o.ESTADO = 'Propuesta';
  return o;
}

// ---------- descubrir competis nuevas ----------
/** Mapa clave+año → fila, para no duplicar entre la app de Gabi, EVENTOS y los calendarios públicos. */
function indiceCompetis_(filas) {
  var m = {}; filas.forEach(function (r) { var k = claveCompeti_(r.NOMBRE); if (!k) return; var y = anioIso_(celdaIso_(r.INICIO)); m[k + '|' + y] = r; if (!m[k + '|*']) m[k + '|*'] = r; }); return m;
}
function yaEsta_(idx, nombre, iniIso) { var k = claveCompeti_(nombre); if (!k) return true; var y = anioIso_(iniIso); return !!(idx[k + '|' + y] || (!y && idx[k + '|*']) || (y && idx[k + '|0'])); }
function competisDeEventosGabi_(libro, idx) {
  var T = gabiTabla_(libro, 'EVENTOS', 'EVENTO'), out = [];
  if (!T) return out;
  T.filas.forEach(function (f) {
    var nom = T.g(f, 'EVENTO'); if (!nom || !COMP_TIPOS_GABI_.test(norm(T.g(f, 'TIPO')))) return;
    var ini = celdaIso_(T.g(f, 'INICIO')); if (yaEsta_(idx, nom, ini)) return;
    var en = urlOk_(T.g(f, 'ENLACE')), wb = urlOk_(T.g(f, 'WODBUSTER')) || (/wodbuster/i.test(en) ? en : ''), lugar = T.g(f, 'LUGAR').split(/\s*,\s*/);
    var o = { ID: 'EV-' + (T.g(f, 'ID') || hashTxt_(nom).slice(0, 8)), 'ESTADO (Gabi)': 'En EVENTOS', NOMBRE: nom, INICIO: ini ? isoAFecha(ini) : '', FIN: celdaIso_(T.g(f, 'FIN')) ? isoAFecha(celdaIso_(T.g(f, 'FIN'))) : '',
      CIUDAD: lugar[0] || '', PROVINCIA: lugar.slice(1).join(', '), WEB: /wodbuster/i.test(en) ? '' : en, WODBUSTER: wb, INSTAGRAM: urlOk_(T.g(f, 'INSTAGRAM')), 'CATEGORÍAS': T.g(f, 'CATEGORÍAS'),
      PRECIO: [T.g(f, 'PRECIO ENTRADA DÍA'), T.g(f, 'PRECIO ENTRADA FINDE')].filter(Boolean).join(' · '), FUENTE: 'App de Gabi · EVENTOS', ENCONTRADA: hoyTxt_(), NOTAS: T.g(f, 'DESCRIPCIÓN').slice(0, 300), SEGUIMIENTO: 'No', COPIADA: ahora_(), ESTADO: 'Propuesta' };
    Object.assign(o, clasificarCompeti_(o));
    out.push(o); idx[claveCompeti_(nom) + '|' + anioIso_(ini)] = o;
  });
  return out;
}
/** Calendarios públicos: Gemini lista las competis que aparecen en el texto descargado (solo España y Portugal, futuras o por confirmar). */
function competisDeCalendarios_(urls, idx, max) {
  var out = [];
  if (!PROPS.getProperty('GEMINI_KEY')) return out;
  urls.forEach(function (u) {
    if (out.length >= max) return;
    var w = textoWeb_(u); if (!w || w.txt.length < 200) return;
    var g = geminiLlamar_('Del texto de esta página de calendario, extrae SOLO las competiciones de CrossFit / fitness funcional / HYROX que aparecen en él, en España o Portugal, de hoy (' + hoyTxt_() + ') en adelante o con fecha por confirmar. ' +
      'No inventes ninguna ni completes datos que no estén. Devuelve SOLO un JSON {"competis":[{"nombre":"","inicio":"dd/mm/aaaa","fin":"dd/mm/aaaa","ciudad":"","provincia":"","web":"","fecha_confirmada":true}]}.\n\n=== ' + w.url + '\n' + w.txt, 2000, 0.1);
    var j = g.ok ? jsonDeTexto_(g.texto) : null;
    ((j && j.competis) || []).forEach(function (c) {
      var nom = String(c.nombre || '').trim(); if (!nom || out.length >= max) return;
      if (norm(w.txt).indexOf(norm(nom).slice(0, 12)) < 0) return;   // el nombre tiene que estar en el texto descargado
      var ini = celdaIso_(c.inicio) || '', fin = celdaIso_(c.fin) || ini;
      if (ini && fin < hoyIso_()) return;
      if (yaEsta_(idx, nom, ini)) return;
      var web = urlOk_(c.web) && w.html.indexOf(String(c.web).replace(/\/$/, '')) >= 0 ? urlOk_(c.web) : '';
      var o = { ID: 'B-' + hashTxt_(claveCompeti_(nom) + '|' + anioIso_(ini)).slice(0, 8), 'ESTADO (Gabi)': '', NOMBRE: nom.slice(0, 120), INICIO: ini ? isoAFecha(ini) : '', FIN: fin ? isoAFecha(fin) : '',
        CIUDAD: String(c.ciudad || '').slice(0, 60), PROVINCIA: String(c.provincia || '').slice(0, 60), WEB: /wodbuster/i.test(web) ? '' : web, WODBUSTER: /wodbuster/i.test(web) ? web : '',
        FUENTE: w.url, ENCONTRADA: hoyTxt_(), NOTAS: c.fecha_confirmada === false ? 'Fecha por confirmar según ' + w.url : '', SEGUIMIENTO: 'No', COPIADA: ahora_(), ESTADO: 'Propuesta' };
      Object.assign(o, clasificarCompeti_(o));
      out.push(o); idx[claveCompeti_(nom) + '|' + anioIso_(ini)] = o;
    });
  });
  return out;
}

// ---------- pasada semanal ----------
function buscarCompetis_(opc) {
  opc = opc || {};
  var cf = compCfg_(), res = { gabi: 0, eventos: 0, calendarios: 0, fichas: 0, inscripciones: 0, errores: [] };
  try { prepararBuscadorCompetis_(); } catch (e) { res.errores.push('config: ' + e); }
  if (!cf.activo && !opc.forzar) return res;
  try { res.gabi = copiarCompetis_(); } catch (e) { res.errores.push('copia Gabi: ' + (e && e.message || e)); }
  MEMO = null;
  var filas = listar_(HOJAS.COMPETIS), idx = indiceCompetis_(filas), nuevas = [];
  try { var ev = competisDeEventosGabi_(programApp_(), idx); res.eventos = ev.length; nuevas = nuevas.concat(ev); } catch (e) { res.errores.push('EVENTOS Gabi: ' + (e && e.message || e)); }
  try { var ca = competisDeCalendarios_(cf.fuentes, idx, 15); res.calendarios = ca.length; nuevas = nuevas.concat(ca); } catch (e) { res.errores.push('calendarios: ' + (e && e.message || e)); }
  if (nuevas.length) filasEnHoja_(HOJAS.COMPETIS, nuevas);
  MEMO = null;
  // fichas: primero las seguidas/inscritas, luego futuras sin ficha o con ficha de hace más de 30 días
  var cat = catalogo_(), metas = codigosMetas_(), hoy = hoyIso_(), hace30 = sumarDias(hoy, -30);
  var conKey = !!PROPS.getProperty('GEMINI_KEY');
  var cand = listar_(HOJAS.COMPETIS).filter(function (r) {
    if (opc.ids) return opc.ids.indexOf(r.ID) >= 0;
    if (!r.NOMBRE || r.ESTADO === 'Descartada' || (/^Descartada/i.test(r['ESTADO (Gabi)'] || '') && r.ESTADO !== 'Siguiendo' && r.ESTADO !== 'Inscrito')) return false;
    var fin = celdaIso_(r.FIN) || celdaIso_(r.INICIO); if (fin && fin < hoy && anioIso_(fin) >= anioIso_(hoy)) return false;   // ya pasó este año
    var act = celdaIso_(String(r.ACTUALIZADO || '').slice(0, 10));
    return !act || act < hace30 || (conKey && !/^Gemini/.test(r.BUSCADOR || ''));
  }).sort(function (a, b) { var p = function (x) { return x.ESTADO === 'Inscrito' ? 0 : x.ESTADO === 'Siguiendo' ? 1 : 2; }; return p(a) - p(b) || ((celdaIso_(a.INICIO) || '9') < (celdaIso_(b.INICIO) || '9') ? -1 : 1); });
  // con Gemini: hasta competis_ia_max fichas; sin Gemini (o pasado el tope): ficha básica (fecha, estímulos) de las que no tienen ninguna, máx. 40 por pasada
  var conIa = 0, sinIa = 0, tope = opc.iaMax == null ? cf.iaMax : opc.iaMax;
  cand.forEach(function (r) {
    var ia = conKey && conIa < tope;
    if (!ia && (r.ACTUALIZADO || sinIa >= 40) && !opc.ids) return;
    try { var o = enriquecerCompeti_(r, { cat: cat, metas: metas, ia: ia }); if (/^Gemini/.test(o.BUSCADOR)) conIa++; else { sinIa++; if (ia) conIa++; } actualizarFila_(HOJAS.COMPETIS, r._fila, o); res.fichas++; } catch (e) { res.errores.push(r.NOMBRE + ': ' + (e && e.message || e)); }
  });
  // reintento de inscripciones que esperaban a que Gabi aprobara la competi en EVENTOS
  MEMO = null;
  listar_(HOJAS.COMPETIS).filter(function (r) { return r.ESTADO === 'Inscrito' && /^Pendiente/.test(r['GABI INSCRIPCIÓN'] || ''); }).forEach(function (r) {
    try { var g = inscribirEnGabi_(r, cf.yo); actualizarFila_(HOJAS.COMPETIS, r._fila, { 'GABI INSCRIPCIÓN': g.estado }); if (/^Hecha/.test(g.estado)) res.inscripciones++; } catch (e) { res.errores.push('inscripción ' + r.NOMBRE + ': ' + (e && e.message || e)); }
  });
  var txt = ahora_() + ' · Gabi +' + res.gabi + ' · EVENTOS +' + res.eventos + ' · calendarios +' + res.calendarios + ' · fichas ' + res.fichas + ' (Gemini ' + conIa + ') · inscripciones en Gabi ' + res.inscripciones + (res.errores.length ? ' · ERRORES: ' + res.errores.slice(0, 4).join(' | ') : '');
  try { ponerConfig_('competis_buscador_ultimo', txt, 'Última pasada del buscador de competis (lo lee Claude)'); } catch (e) {}
  try { MEMO = null; if (miLibro_().getSheetByName(COMP_VISTA_)) pintarCompetisSheet_(); } catch (e) {}
  return res;
}

// ---------- estados y «Me inscribo» ----------
function competiPorId_(id) { MEMO = null; var r = listar_(HOJAS.COMPETIS).filter(function (x) { return x.ID === String(id || ''); })[0]; if (!r) throw new Error('competi_no_encontrada'); return r; }
/** Descartar (quita lo suyo del calendario y del seguimiento) o volver a Propuesta. Siguiendo va por seguirCompeti_. */
function estadoCompeti_(b) {
  var est = String(b.estado || ''); if (COMP_ESTADOS_.indexOf(est) < 0 || est === 'Inscrito') throw new Error('estado_no_valido');
  asegurarColsCompetis_();
  if (est === 'Siguiendo') return seguirCompeti_({ id: b.id, seguir: true, inscripcion: b.inscripcion, clasificatorio: b.clasificatorio });
  var r = competiPorId_(b.id), o = { ESTADO: est };
  if (est === 'Descartada') {
    borrarCalCompeti_(r); borrarCalInscrito_(r);
    Object.assign(o, { SEGUIMIENTO: 'No', GCAL: '', 'GCAL INSCRITO': '', 'INSCRIPCIÓN': r['INSCRIPCIÓN'] === 'Hecha' ? 'Hecha' : '' });
    if (/^Hecha/.test(r['GABI INSCRIPCIÓN'] || '')) { try { o['GABI INSCRIPCIÓN'] = desinscribirEnGabi_(r, compCfg_().yo); } catch (e) { o['GABI INSCRIPCIÓN'] = 'Error al quitar: ' + (e && e.message || e); } }
    else if (/^Pendiente/.test(r['GABI INSCRIPCIÓN'] || '')) o['GABI INSCRIPCIÓN'] = '';
  }
  actualizarFila_(HOJAS.COMPETIS, r._fila, o);
  return { ok: true };
}
function borrarCalInscrito_(r) {
  String(r['GCAL INSCRITO'] || '').split('|').filter(Boolean).forEach(function (x) { try { var ev = calendario_().getEventById(x.slice(2)); if (ev) ev.deleteEvent(); } catch (e) { Logger.log('Calendar inscrito: ' + e); } });
}
function eventoCalVivo_(lista, pref) {
  var x = String(lista || '').split('|').filter(function (s) { return s.indexOf(pref + ':') === 0; })[0];
  if (!x) return ''; try { return calendario_().getEventById(x.slice(2)) ? x : ''; } catch (e) { return ''; }
}
/** «Me inscribo»: calendario (competi + inscripción, sin duplicar) y app de Gabi (solo la fila de Pablo). Idempotente. */
function inscribirCompeti_(b) {
  asegurarColsCompetis_();
  var r = competiPorId_(b.id), cf = compCfg_(), cal = calendario_();
  var ficha = r.FECHA ? r : Object.assign({}, r, fechaCompeti_(r, {})), fp = String(ficha.FECHA || '').split(/\s*–\s*/);
  var ini = ficha.FECHA === 'Por confirmar' ? '' : celdaIso_(fp[0]) || celdaIso_(r.INICIO) || '', fin = (ini && (celdaIso_(fp[1]) || celdaIso_(r.FIN))) || ini, lugar = r.LUGAR || [r.CIUDAD, r.PROVINCIA].filter(Boolean).join(', ');
  var dia = function (iso) { return new Date(iso + 'T12:00:00Z'); }, cat = String(b.categoria || r['CATEGORÍA ELEGIDA'] || '').trim().slice(0, 80);
  var desc = MARCA_CAL + ' competi ' + r.ID + ' · inscrito\n' + [cat ? 'Categoría: ' + cat : '', r.PRECIOS || r.PRECIO, r.WEB, r.WODBUSTER, ficha.FECHA === 'Por confirmar' ? 'Fecha por confirmar · última conocida: ' + (ficha['ÚLTIMA CONOCIDA'] || '—') : ''].filter(Boolean).join('\n');
  var ids = [], c = eventoCalVivo_(r['GCAL INSCRITO'], 'C') || eventoCalVivo_(r.GCAL, 'C'), n = eventoCalVivo_(r['GCAL INSCRITO'], 'N');
  if (!c && ini) c = 'C:' + cal.createAllDayEvent('🏆 ' + r.NOMBRE, dia(ini), dia(sumarDias(fin, 1)), { description: desc, location: lugar }).getId();
  if (c) ids.push(c);
  var fIns = celdaIso_(b.fecha) || hoyIso_();
  if (!n) n = 'N:' + cal.createAllDayEvent('✅ Inscrito · ' + r.NOMBRE, dia(fIns), { description: desc }).getId();
  ids.push(n);
  // si seguirCompeti_ ya había creado la competi, ese evento pasa a ser el de la inscripción (no se borra al quitar el seguimiento)
  var gcal = String(r.GCAL || '').split('|').filter(function (x) { return x && x !== c; }).join('|');
  var g = { estado: 'Pendiente · sin comprobar' };
  try { g = inscribirEnGabi_(r, cf.yo); } catch (e) { g = { estado: 'Pendiente · ' + (e && e.message || e) }; }
  actualizarFila_(HOJAS.COMPETIS, r._fila, { ESTADO: 'Inscrito', SEGUIMIENTO: 'Sí', 'INSCRIPCIÓN': 'Hecha', 'FECHA INSCRIPCIÓN': isoAFecha(fIns), 'CATEGORÍA ELEGIDA': cat, 'GCAL INSCRITO': ids.join('|'), GCAL: gcal, 'GABI INSCRIPCIÓN': g.estado });
  return { ok: true, gabi: g.estado, eventos: ids.length };
}
/** Evento de la app de Gabi que corresponde a la competi (por nombre exacto, por nombre sin años y fecha, o por enlace). */
function eventoGabiDe_(T, r) {
  var nom = norm(r.NOMBRE).trim(), k = claveCompeti_(r.NOMBRE), ini = celdaIso_(r.INICIO), urls = [r.WEB, r.WODBUSTER].map(urlOk_).filter(Boolean);
  var c = T.filas.filter(function (f) { return T.g(f, 'EVENTO'); }), hit = null;
  hit = c.filter(function (f) { return norm(T.g(f, 'EVENTO')).trim() === nom; })[0] ||
    c.filter(function (f) { return claveCompeti_(T.g(f, 'EVENTO')) === k && (!ini || celdaIso_(T.g(f, 'INICIO')) === ini); })[0] ||
    c.filter(function (f) { var e = urlOk_(T.g(f, 'ENLACE')), w = urlOk_(T.g(f, 'WODBUSTER')); return urls.some(function (u) { return u === e || u === w; }); })[0] || null;
  return hit ? T.g(hit, 'EVENTO') : '';
}
/** Fila de Pablo en ATLETAS (exactamente una). */
function filaAtletaYo_(A, yo) {
  var m = A.filas.filter(function (f) { return A.g(f, 'EMAIL').toLowerCase() === yo; });
  if (m.length !== 1) throw new Error(m.length ? 'gabi_atleta_duplicado' : 'gabi_sin_fila_de_pablo');
  return m[0];
}
/** Única escritura del buscador en ProgramAPP: ATLETAS › EVENTOS de la fila de Pablo (EMAIL releído justo antes de escribir). */
var COMP_GABI_ESCRIBIBLES_ = { ATLETAS: ['EVENTOS'] };
function gabiEscribirCompeti_(T, f, col, valor, yo) {
  if (!COMP_GABI_ESCRIBIBLES_[T.nombre] || COMP_GABI_ESCRIBIBLES_[T.nombre].indexOf(col) < 0) throw new Error('gabi_columna_no_permitida');
  var cE = T.cab.EMAIL, cC = T.cab[col]; if (cE === undefined || cC === undefined) throw new Error('gabi_sin_columna');
  var actual = String(T.sh.getRange(f.fila, cE + 1).getDisplayValues()[0][0] || '').toLowerCase().trim();
  if (actual !== yo || yo !== String(CONFIG.EMAIL_PERMITIDO).toLowerCase()) throw new Error('gabi_fila_ajena');
  T.sh.getRange(f.fila, cC + 1).setValue(celdaSegura_(valor)); f.v[cC] = String(valor);
}
function listaEventosAtleta_(s) { return String(s || '').split(/\s*[,;\n]\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }
function inscribirEnGabi_(r, yo) {
  var libro = programApp_();
  if (libro.getId && libro.getId() !== CONFIG.PROGRAMAPP_ID) throw new Error('gabi_libro_inesperado');
  var EV = gabiTabla_(libro, 'EVENTOS', 'EVENTO'); if (!EV) return { estado: 'Pendiente · sin pestaña EVENTOS' };
  var nombre = eventoGabiDe_(EV, r);
  if (!nombre) return { estado: 'Pendiente · aún no está en EVENTOS de la app de Gabi (apruébala en COMPETIS PROPUESTAS); se reintenta cada lunes' };
  var A = gabiTabla_(libro, 'ATLETAS', 'EMAIL'); if (!A) throw new Error('gabi_sin_atletas');
  var f = filaAtletaYo_(A, yo), l = listaEventosAtleta_(A.g(f, 'EVENTOS'));
  if (l.some(function (x) { return norm(x).trim() === norm(nombre).trim(); })) return { estado: 'Hecha · ' + nombre + ' (ya estaba en tus EVENTOS)', evento: nombre };
  gabiEscribirCompeti_(A, f, 'EVENTOS', l.concat([nombre]).join(', '), yo);
  return { estado: 'Hecha · ' + nombre + ' añadido a tus EVENTOS (' + hoyTxt_() + ')', evento: nombre };
}
function desinscribirEnGabi_(r, yo) {
  var libro = programApp_();
  if (libro.getId && libro.getId() !== CONFIG.PROGRAMAPP_ID) throw new Error('gabi_libro_inesperado');
  var nombre = (String(r['GABI INSCRIPCIÓN'] || '').match(/^Hecha · (.+?) (añadido|\(ya estaba)/) || [])[1]; if (!nombre) return '';
  var A = gabiTabla_(libro, 'ATLETAS', 'EMAIL'), f = filaAtletaYo_(A, yo), l = listaEventosAtleta_(A.g(f, 'EVENTOS'));
  var resto = l.filter(function (x) { return norm(x).trim() !== norm(nombre).trim(); });
  if (resto.length !== l.length) gabiEscribirCompeti_(A, f, 'EVENTOS', resto.join(', '), yo);
  return 'Quitada de tus EVENTOS (' + hoyTxt_() + ')';
}
/** «Preparar bloques»: los estímulos elegidos pasan a APP · REFUERZOS de la semana indicada (o la siguiente) sin duplicar. */
function bloquesCompeti_(b) {
  var r = competiPorId_(b.id), cat = catalogo_(), lunes = lunesDe_(celdaIso_(b.lunes) || sumarDias(hoyIso_(), 7)), n = 0;
  var cods = (b.codigos || []).map(function (c) { return String(c).trim().toUpperCase(); }).filter(function (c) { return cat[c]; });
  var ya = refuerzosDe_(lunes).map(function (x) { return x['CÓDIGO'] + '|' + x.TEXTO; });
  cods.forEach(function (c) {
    var t = ('Competi ' + r.NOMBRE + ' · ' + (cat[c].NOMBRE || c)).slice(0, 200); if (ya.indexOf(c + '|' + t) >= 0) return;
    anadirFila_(HOJAS.REFUERZOS, { ID: nuevoId_(), SEMANA: isoAFecha(lunes), TEXTO: t, 'CÓDIGO': c, ESTADO: 'Pendiente', NOTAS: 'Bloque específico para ' + r.NOMBRE + (r.FECHA ? ' (' + r.FECHA + ')' : ''), CREADO: ahora_() }); n++;
  });
  return { ok: true, n: n, lunes: lunes };
}
/** Lo que añade el buscador a cada competi de la lista de la app: estímulos por nombre (nunca por código). */
function decorarCompetis_(lista) {
  var cat = {}, metas = {}; try { cat = catalogo_(); metas = codigosMetas_(); } catch (e) {}
  lista.forEach(function (o) {
    o._est = codigosDe_(o['ESTÍMULOS']).map(function (c) { return nombreEstimulo_(c, cat, metas); });
    if (!o.ESTADO) o.ESTADO = o.SEGUIMIENTO === 'Sí' ? 'Siguiendo' : 'Propuesta';
    if (o.FECHA === 'Por confirmar') { o._porConfirmar = true; o._pasada = false; }
  });
  return lista;
}
