// =====================================================================================================
// v0.29b · COMPETICIÓN (fichas, taper, plan del día) · RESUMEN DEL LUNES · SALUD DE TAREAS · ARCHIVO · CACHÉ · LOTES
// Se añade tal cual al final de Code.gs (usa sus funciones globales). ES5: var, function, sin flechas ni template literals.
// El router y los disparadores existentes se cambian según _v29b_patches.md.
// =====================================================================================================

// ---------- pestañas ----------
HOJAS.FICHAS = 'APP · FICHAS';
HOJAS.INFORMES = 'INFORMES';
ESQUEMA['APP · FICHAS'] = {
  cab: ['ID', 'FECHA', 'EVENTO', 'WOD', 'RESULTADO', 'PUESTO', 'VALORACIÓN', 'FALLO', 'QUÉ FALLÓ', 'ESTÍMULO QUE SALE', 'REFERENCIA', 'REGISTRADO'],
  anchos: [70, 95, 180, 300, 110, 70, 100, 100, 280, 280, 90, 120], fechas: ['FECHA'], negrita: 'WOD', congelarCol: 2,
  listas: { 'VALORACIÓN': ['Bien', 'Regular', 'Mal'], FALLO: ['Motor', 'Skill', 'Fuerza', 'Estrategia', 'Ninguno'], REFERENCIA: ['Sí', 'No'] },
  colores: [['VALORACIÓN', 'Mal', '#ffd6d6'], ['REFERENCIA', 'Sí', '#fff2e6']]
};
ESQ_BD_[HOJAS.INFORMES] = { cab: ['FECHA', 'MES', 'TEXTO', 'MODELO'], anchos: [95, 80, 700, 130], fechas: ['FECHA'], color: '#16a34a' };
// eventos: objetivo de la competición (A/B) y sus WODs
CAMPOS_EVENTO.push('OBJETIVO', 'WODS');
ESQUEMA['APP · EVENTOS'].cab.push('OBJETIVO', 'WODS'); ESQUEMA['APP · EVENTOS'].anchos.push(80, 320);
ESQUEMA['APP · EVENTOS'].listas.OBJETIVO = ['A', 'B'];

/** Ejecutar desde configurar (después de prepararHojas y prepararBd_). Devuelve un texto de estado. */
function prepararV29b_() {
  var r = [];
  try { prepararEsquema_(miLibro_(), { 'APP · FICHAS': ESQUEMA['APP · FICHAS'] }); r.push('FICHAS'); } catch (e) { r.push('FICHAS fallo: ' + e); }
  try { ['OBJETIVO', 'WODS'].forEach(function (c) { asegurarColumna_(HOJAS.EVENTOS, c); }); r.push('EVENTOS+OBJETIVO/WODS'); } catch (e) { r.push('EVENTOS fallo: ' + e); }
  try { prepararEsquema_(motorLibro_(), (function () { var o = {}; o[HOJAS.INFORMES] = ESQ_BD_[HOJAS.INFORMES]; return o; })()); r.push('INFORMES'); } catch (e) { r.push('INFORMES fallo: ' + e); }
  try { instalarDisparadorLunes_(); r.push('disparador lunes 7:00'); } catch (e) { r.push('disparador fallo: ' + e); }
  return r.join(' · ');
}

// ===================== 1 · COMPETICIÓN =====================
function canonLista_(v, lista) {
  var n = norm(v).trim(); if (!n) return '';
  for (var i = 0; i < lista.length; i++) if (norm(lista[i]) === n) return lista[i];
  return '';
}
/** Primer movimiento gimnástico (tirón o empuje gimnástico) que la guía detecta en el texto del WOD; '' si ninguno. */
function primerGimnastico_(txt) {
  try {
    var det = detectarMovs_(String(txt || ''), guiaMotor_());
    for (var i = 0; i < det.length; i++) { var m = det[i].m; if (m.patron === 'TIRON' || m.patron === 'EMPUJE_G' || m.k === 'T2B') return m.n; }
  } catch (e) { Logger.log('primerGimnastico_: ' + e); }
  return '';
}
function estimuloDeFallo_(fallo, wod) {
  var f = norm(fallo);
  if (f === 'MOTOR') return 'P4 modelado de metcon + calidad de carrera';
  if (f === 'SKILL') return (primerGimnastico_(wod) || 'skill del WOD') + ' en fatiga';
  if (f === 'FUERZA') return 'fuerza en fatiga del movimiento más pesado';
  if (f === 'ESTRATEGIA') return 'simulación del WOD con la estrategia escrita';
  return '';
}
function asegurarFichas_() {
  try { hojaMia_(HOJAS.FICHAS); } catch (e) { olvidarCabeceras_(); prepararEsquema_(miLibro_(), { 'APP · FICHAS': ESQUEMA['APP · FICHAS'] }); }
}
/** Guarda (o edita, si trae ID) la ficha de un WOD de competición. «Mal» pasa solo a referencia. */
function guardarFicha_(f) {
  f = f || {};
  var o = permitidas_(f, ['FECHA', 'EVENTO', 'WOD', 'RESULTADO', 'PUESTO', 'VALORACIÓN', 'FALLO', 'QUÉ FALLÓ', 'ESTÍMULO QUE SALE', 'REFERENCIA']);
  if (!String(o.WOD || '').trim() && !String(o.EVENTO || '').trim()) throw new Error('ficha_incompleta');
  asegurarFichas_();
  o.FECHA = isoAFecha(celdaIso_(o.FECHA) || hoyIso_());
  o['VALORACIÓN'] = canonLista_(o['VALORACIÓN'], ['Bien', 'Regular', 'Mal']);
  o.FALLO = canonLista_(o.FALLO, ['Motor', 'Skill', 'Fuerza', 'Estrategia', 'Ninguno']);
  o.REFERENCIA = o['VALORACIÓN'] === 'Mal' ? 'Sí' : (canonLista_(o.REFERENCIA, ['Sí', 'No']) || 'No');
  if (!String(o['ESTÍMULO QUE SALE'] || '').trim()) o['ESTÍMULO QUE SALE'] = estimuloDeFallo_(o.FALLO, o.WOD);
  var id = String(f.ID || ''), x = id ? listar_(HOJAS.FICHAS).filter(function (r) { return r.ID === id; })[0] : null;
  if (x) { bloqueo_(function () { actualizarFila_(HOJAS.FICHAS, x._fila, o); }); o.ID = id; }
  else { o.ID = nuevoId_(); o.REGISTRADO = ahora_(); anadirFila_(HOJAS.FICHAS, o); }
  MEMO = null;
  return o;
}
/** Fichas ordenadas por fecha, la más reciente primero. */
function fichas_() {
  var l; try { l = listar_(HOJAS.FICHAS); } catch (e) { return []; }
  return l.map(function (r) { r._iso = celdaIso_(r.FECHA) || ''; return r; })
    .sort(function (a, b) { return a._iso < b._iso ? 1 : a._iso > b._iso ? -1 : b._fila - a._fila; });
}

/** Competición/HYROX de objetivo A que empieza entre el lunes y el lunes+10 → { evento, id, inicio, wods, dias (desde el lunes hasta el inicio) }; si no, null. */
function tapersSemana_(lunes) {
  lunes = lunesDe_(lunes); var tope = sumarDias(lunes, 10), mejor = null;
  listar_(HOJAS.EVENTOS).forEach(function (r) {
    var t = norm(r.TIPO), ini = celdaIso_(r.INICIO);
    if (!(t.indexOf('COMPETICION') >= 0 || t.indexOf('HYROX') >= 0)) return;
    if (String(r.OBJETIVO || '').trim().toUpperCase() !== 'A' || norm(r.ESTADO) === 'IGNORADO') return;
    if (!ini || ini < lunes || ini > tope) return;
    if (!mejor || ini < mejor.inicio) mejor = { evento: r.EVENTO, id: r.ID, inicio: ini, wods: String(r.WODS || ''), dias: Math.round((Date.parse(ini) - Date.parse(lunes)) / 864e5) };
  });
  return mejor;
}
/** Bloque «test de WODs» 4–6 días antes de la competición (dentro de la semana, por la tarde). [] si no procede. */
function taperBloques_(lunes) {
  lunes = lunesDe_(lunes);
  var t = tapersSemana_(lunes); if (!t || !String(t.wods).trim()) return [];
  var fin = sumarDias(lunes, 6), iso = null;
  [5, 4, 6].forEach(function (k) { var d = sumarDias(t.inicio, -k); if (!iso && d >= lunes && d <= fin) iso = d; });
  if (!iso) return [];
  return [{ FECHA: isoAFecha(iso), TURNO: 'PM', 'TÍTULO': 'Test de WODs de la competi + estrategia',
    CONTENIDO: String(t.wods).trim() + '\n\nNo hace falta hacerlos enteros: adapta para sentir el estímulo y comprobar la estrategia (ritmos, particiones, transiciones). Intensidad de competición, volumen −50 %.',
    MIN: 40, 'CÓDIGOS': 'CT1', ORIGEN: 'EXTRA' }];
}

function formatoWod_(txt) {
  var n = norm(txt);
  if (/AMRAP/.test(n)) return 'AMRAP';
  if (/EMOM|E\d+MOM|\bEVERY\b/.test(n)) return 'EMOM';
  if (/FOR TIME|\bFT\b|CHIPPER|TIME ?CAP|\bCAP\b/.test(n)) return 'FOR TIME';
  return 'GENERAL';
}
function estrategiaFormato_(fmt, txt) {
  var e = fmt === 'AMRAP' ? 'Ritmo sostenible al ~85 % las primeras rondas; tandas fijas y sin parar de más en las transiciones; lo que sobre, al final.' :
    fmt === 'FOR TIME' ? 'Salida controlada (no te vayas en el primer tercio) y aprieta el último tercio; rompe las series antes del fallo.' :
    fmt === 'EMOM' ? 'Termina cada minuto con 10–15″ de margen; si pasas de 50″ de trabajo, baja reps antes de que se caiga la técnica.' :
    'Calcula antes de empezar dónde vas a parar y dónde vas a apretar; ritmo repetible de principio a fin.';
  if (/\d+\s*(KG|LB)|\b\d{2,3}\s*\/\s*\d{2,3}\b|@\s*\d+|%/.test(norm(txt))) e += ' Con carga: decide las particiones antes (p. ej. 12 = 6+6, 9 = 5+4) y no las cambies a mitad.';
  return e;
}
/** Plan del día de una competición (texto plano): calentamiento, estrategia por WOD, comida e hidratación; + estrategia de Gemini si responde. */
function planCompeti_(idEvento) {
  var ev = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(idEvento); })[0];
  if (!ev) throw new Error('no_encontrado');
  var wods = String(ev.WODS || '').split(/\r?\n[ \t]*\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  var peso = parseFloat(String(leerConfig_().peso_kg || '').replace(',', '.')) || 90, hMin = Math.round(peso), hMax = Math.round(peso * 1.5);
  var G = null; try { G = guiaMotor_(); } catch (e) {}
  var L = ['PLAN DEL DÍA · ' + ev.EVENTO + (ev.INICIO ? ' · ' + ev.INICIO : '')];
  if (!wods.length) L.push('', 'No hay WODs escritos en el evento (campo WODS): añádelos, separados por una línea en blanco, para tener estrategia por WOD.');
  wods.forEach(function (w, i) {
    var fmt = formatoWod_(w), movs = [];
    try { if (G) detectarMovs_(w, G).forEach(function (x) { if (movs.indexOf(x.m.n) < 0) movs.push(x.m.n); }); } catch (e) {}
    L.push('', 'WOD ' + (i + 1) + ' · ' + fmt, w, '',
      'Calentamiento general 8′: 3′ remo o bici suave, movilidad de cadera y hombro, 2 rondas de 5 sentadillas, 5 dominadas escapulares y 5 flexiones, 2 progresivos de 20″.',
      'Calentamiento específico: ' + (movs.length ? '2–3 series progresivas de ' + movs.slice(0, 5).join(', ') + ' (primero ligero, luego a ritmo de WOD).' : 'series cortas de los movimientos del WOD, de ligero a ritmo de competición.'),
      'Estrategia: ' + estrategiaFormato_(fmt, w));
  });
  L.push('', 'COMIDA E HIDRATACIÓN',
    '3 h antes: 1–1,5 g/kg de hidratos (≈ ' + hMin + '–' + hMax + ' g para ' + peso + ' kg) + 20–30 g de proteína; grasa y fibra bajas.',
    wods.length > 1 ? 'Entre WODs: 30–60 g de hidratos por hora y 500 ml de agua con sales.' : 'Si hay espera: 30–60 g de hidratos por hora y 500 ml de agua con sales.');
  var texto = L.join('\n');
  try {
    if (wods.length) {
      var g = geminiLlamar_('Eres entrenador de CrossFit de competición. Atleta RX de ' + peso + ' kg. Evento: ' + ev.EVENTO + '. Para cada WOD da una estrategia concreta en español: ritmo, particiones, transiciones, ' +
        'dónde apretar y qué evitar. Texto plano, sin markdown, sin símbolos de lista, máximo 10 líneas por WOD.\n\nWODs:\n' + wods.join('\n\n---\n\n'), 900, 0.4);
      if (g && g.ok && String(g.texto || '').trim()) texto += '\n\nEstrategia (IA)\n' + String(g.texto).replace(/[*#`]/g, '').trim();
    }
  } catch (e) { Logger.log('planCompeti_ IA: ' + e); }
  return texto;
}

// ===================== 2 · RESUMEN DEL LUNES 7:00 =====================
var PREGUNTAS_SEMANALES_ = ['¿Qué bloque te sobró o te dejó peor la semana pasada?', '¿Qué estímulo notaste que mejoraba?', '¿Algún día llegaste reventado? ¿Por qué crees?',
  '¿Algo de la app te hizo perder tiempo?', '¿Qué cambiarías de la semana que empieza?'];
/** Crea las 5 preguntas semanales del lunes (sin duplicar). Devuelve cuántas ha creado. */
function preguntasSemanales_(lunes) {
  lunes = lunesDe_(lunes);
  var ya = {}; listar_(HOJAS.APR_DN).forEach(function (r) { if (r.TIPO === 'semanal' && celdaIso_(r.LUNES) === lunes) ya[r.PREGUNTA] = 1; });
  var nuevas = PREGUNTAS_SEMANALES_.filter(function (p) { return !ya[p]; }).map(function (p) {
    return { ID: 'DN' + nuevoId_(), LUNES: isoAFecha(lunes), BLOQUE_ID: '', BLOQUE: 'Semana pasada', TIPO: 'semanal', PREGUNTA: p, OPCIONES: '', RESPUESTA: '', COMENTARIO: '', ESTADO: 'PENDIENTE', CONTEXTO: '{}', CREADO: ahora_() };
  });
  filasEnHoja_(HOJAS.APR_DN, nuevas); MEMO = null;
  return nuevas.length;
}
function ultimoInforme_() {
  try {
    var l = listar_(HOJAS.INFORMES).filter(function (r) { return String(r.TEXTO || '').trim(); }); if (!l.length) return null;
    l.sort(function (a, b) { var x = celdaIso_(a.FECHA) || '', y = celdaIso_(b.FECHA) || ''; return x < y ? -1 : x > y ? 1 : a._fila - b._fila; });
    var u = l[l.length - 1]; return { fecha: celdaIso_(u.FECHA) || '', texto: u.TEXTO };
  } catch (e) { return null; }
}
/** Datos del resumen. lunes = lunes de la semana que EMPIEZA; se analiza la anterior. No escribe nada. */
function resumenLunesDatos_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  var ant = sumarDias(lunes, -7), antFin = sumarDias(ant, 6), o = { lunes: lunes };
  // cumplimiento
  var hecho = {}; listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN && r.HECHO === 'Sí') hecho[r.ID_PLAN] = 1; });
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= ant && d <= antFin && r.ESTADO === 'PROGRAMADO'; });
  var hs = plan.filter(function (r) { return hecho[r.ID]; }).length;
  o.cumplimiento = { pct: plan.length ? Math.round(hs * 100 / plan.length) : 0, hechos: hs, total: plan.length };
  // metas de la semana anterior: las 5 más bajas
  o.metas = [];
  try {
    o.metas = avanceMetas_('Semana', periodoSemana_(ant), cacheMetas_()).filter(function (m) { return m.meta > 0; })
      .map(function (m) { return { estimulo: m.estimulo, pct: Math.round(m.pReal * 100) }; })
      .sort(function (a, b) { return a.pct - b.pct; }).slice(0, 5);
  } catch (e) { Logger.log('resumenLunes metas: ' + e); }
  // rendimiento (otro módulo): indicadores con valor nuevo la semana pasada (si no traen fecha se incluyen todos)
  o.rendimiento = [];
  if (typeof rendimiento_ === 'function') {
    try {
      var R = rendimiento_(), lista = Object.prototype.toString.call(R) === '[object Array]' ? R : (R && (R.indicadores || R.lista)) || [];
      lista.forEach(function (i) {
        if (i.ultimo && i.ultimo.fecha) { if (i.ultimo.fecha < ant || i.ultimo.fecha > antFin) return; i = { nombre: i.nombre, txt: i.ultimo.txt, tendencia: i.tendencia === 'mejora' ? 'sube' : i.tendencia === 'empeora' ? 'baja' : i.tendencia, fecha: i.ultimo.fecha }; }
        var f = celdaIso_(i.fecha || i.FECHA || ''); if (f && (f < ant || f > antFin)) return;
        o.rendimiento.push({ nombre: i.nombre || i.n || '', txt: i.txt || i.texto || String(i.valor == null ? '' : i.valor), tendencia: i.tendencia || '' });
      });
    } catch (e) { Logger.log('resumenLunes rendimiento: ' + e); }
  }
  // carga
  try { o.carga = estadoCarga_(lunes); } catch (e) { o.carga = { media: 0, n: 0, sinDescanso: false, descarga: false }; }
  // decisiones (máx. 3)
  var dec = [];
  try { var tp = tapersSemana_(lunes); if (tp) dec.push('Taper para ' + tp.evento + ' (' + isoAFecha(tp.inicio).slice(0, 5) + '): sin P1–P4 ni extras pesados, intensidad alta y volumen bajo.'); } catch (e) {}
  if (o.carga.descarga) dec.push('Semana de descarga automática: extras a la mitad y técnicos.');
  try {
    var men = avanceMetas_('Mes', periodoMes_(lunes), cacheMetas_()).filter(function (m) { return m.meta > 0 && !m.cubierta; }).sort(function (a, b) { return a.pProg - b.pProg; });
    if (men.length) dec.push('Prioridad mensual: ' + men[0].estimulo + ' (' + Math.round(men[0].pProg * 100) + ' %)');
  } catch (e) {}
  try { var np = pendientesAbiertos_().length; if (np) dec.push(np + ' pendientes de la semana pasada: entran esta semana o caducan.'); } catch (e) {}
  o.decisiones = dec.length ? dec.slice(0, 3) : ['Semana normal: sigue el plan.'];
  // preguntas, informe, reglas
  o.preguntas = listar_(HOJAS.APR_DN).filter(function (r) { return r.TIPO === 'semanal' && celdaIso_(r.LUNES) === lunes; }).length;
  o.informe = ultimoInforme_();
  o.reglas = [];
  if (+lunes.slice(8, 10) <= 7) {
    try { o.reglas = reglasAprendidas_().filter(function (r) { return Math.abs(r.peso) >= UMBRAL_REGLA_; }).sort(function (a, b) { return Math.abs(b.peso) - Math.abs(a.peso); }).slice(0, 12).map(function (r) { return r.texto; }); } catch (e) {}
  }
  return o;
}
function resumenLunesHtml_(d) {
  var th = 'style="text-align:left;padding:6px 8px;background:#222;color:#fff;font-size:12px"', td = 'style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px"';
  var h = '<div style="font-family:Arial,sans-serif;max-width:760px;color:#111"><h2 style="margin:0 0 4px">Road To Elite · tu semana ' + esc_(isoAFecha(d.lunes).slice(0, 5)) + '</h2>' +
    '<p style="margin:0 0 14px;color:#555">' + esc_(ahora_()) + '</p>' +
    '<table style="border-collapse:collapse;margin-bottom:14px"><tr><td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + d.cumplimiento.pct + ' %</b><br>cumplimiento semana pasada (' + d.cumplimiento.hechos + '/' + d.cumplimiento.total + ' bloques)</td><td width="10"></td>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + esc_(d.carga.media || 0) + '/10</b><br>cansancio medio' + (d.carga.descarga ? ' · DESCARGA' : '') + '</td></tr></table>' +
    '<h3>Decisiones para esta semana</h3><ul>' + d.decisiones.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>';
  if (d.metas.length) h += '<h3>Estímulos más flojos de la semana pasada</h3><table style="border-collapse:collapse;width:100%"><tr><th ' + th + '>Estímulo</th><th ' + th + '>Hecho</th></tr>' +
    d.metas.map(function (m) { return '<tr><td ' + td + '>' + esc_(m.estimulo) + '</td><td ' + td + '>' + m.pct + ' %</td></tr>'; }).join('') + '</table>';
  if (d.rendimiento.length) h += '<h3>Rendimiento</h3><ul>' + d.rendimiento.map(function (r) { return '<li><b>' + esc_(r.nombre) + '</b> · ' + esc_(r.txt) + (r.tendencia ? ' (' + esc_(r.tendencia) + ')' : '') + '</li>'; }).join('') + '</ul>';
  if (d.preguntas) h += '<h3>Preguntas de la semana</h3><p>' + d.preguntas + ' preguntas nuevas en la app › Menú › Aprendizaje. Contéstalas: afinan la programación.</p>';
  if (d.informe) h += '<h3>Informe mensual · ' + esc_(isoAFecha(d.informe.fecha)) + '</h3><p style="font-size:13px">' + esc_(d.informe.texto).replace(/\n/g, '<br>') + '</p>';
  if (d.reglas.length) h += '<h3>Lo que he aprendido de ti</h3><ul>' + d.reglas.map(function (r) { return '<li>' + esc_(r) + '</li>'; }).join('') + '</ul>';
  return h + '<p style="color:#888;font-size:12px">Road To Elite · resumen automático del lunes.</p></div>';
}
/** Disparador (lunes 7:00). Con forzar === true se repite aunque ya se haya enviado esta semana. */
function resumenLunes(forzar) { return conSalud_('resumenLunes', function () { return resumenLunesSin_(forzar === true); }); }
function resumenLunesSin_(forzar) {
  var lunes = lunesDe_(hoyIso_()), cf = leerConfig_();
  if (cf['resumen_lunes_' + lunes] && !forzar) return { ya: true, lunes: lunes };
  var nPreg = 0; try { nPreg = preguntasSemanales_(lunes); } catch (e) { Logger.log('Preguntas semanales: ' + e); }
  var informe = null;
  if (+lunes.slice(8, 10) <= 7) { try { informe = informeMensual_(); } catch (e) { Logger.log('Informe mensual: ' + e); } }
  var d = resumenLunesDatos_(lunes);
  MailApp.sendEmail({ to: cf.email_permitido || CONFIG.EMAIL_PERMITIDO, subject: 'Road To Elite · tu semana', htmlBody: resumenLunesHtml_(d), name: 'Road To Elite' });
  try { enviarPush_('Road To Elite · tu semana', 'Cumplimiento ' + d.cumplimiento.pct + ' % · ' + d.decisiones[0]); } catch (e) { Logger.log('Push lunes: ' + e); }
  ponerConfig_('resumen_lunes_' + lunes, ahora_() + ' · ' + nPreg + ' preguntas' + (informe ? ' · informe mensual' : ''), 'Resumen del lunes 7:00 enviado');
  return d;
}
function instalarDisparadorLunes_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'resumenLunes') borrarDisp_(t); });
  return reintentar_(function () { return ScriptApp.newTrigger('resumenLunes').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).nearMinute(0).inTimezone(CONFIG.ZONA).create(); }, 'disparador resumenLunes');
}
/** Informe mensual con Gemini (gratis): qué mejoró, qué se estancó y 3 ajustes. Lo guarda en Motor › INFORMES. */
function informeMensual_() {
  var hoy = hoyIso_(), partes = [];
  if (typeof rendimiento_ === 'function') { try { partes.push('RENDIMIENTO (indicadores):\n' + JSON.stringify(rendimiento_()).slice(0, 3500)); } catch (e) {} }
  if (typeof residuo_ === 'function') { try { partes.push('RESIDUO (lo que no se cubre):\n' + JSON.stringify(residuo_()).slice(0, 2500)); } catch (e) {} }
  var cargas = [], l0 = lunesDe_(hoy);
  for (var k = 0; k < 4; k++) { var li = sumarDias(l0, -7 * k); try { var c = estadoCarga_(li); cargas.push('semana ' + isoAFecha(li).slice(0, 5) + ': cansancio medio ' + c.media + '/10' + (c.descarga ? ', descarga' : '') + (c.sinDescanso ? ', sin día de descanso' : '')); } catch (e) {} }
  partes.push('CARGA (últimas 4 semanas):\n' + cargas.join('\n'));
  var reglas = ''; try { reglas = reglasAprendidasTexto_(20); } catch (e) {}
  if (reglas) partes.push(reglas);
  var datos = partes.join('\n\n'), texto = '', modelo = 'sin IA', g = null;
  try {
    g = geminiLlamar_('Eres entrenador de CrossFit y HYROX de élite y analizas el último mes de un atleta RX de 90 kg. Con los datos de abajo, responde en español, texto plano sin markdown ni símbolos de lista, ' +
      'en menos de 250 palabras: 1) qué mejoró, 2) qué se estancó, 3) tres ajustes concretos para el mes que empieza. No inventes datos que no estén abajo.\n\n' + datos, 1200, 0.4);
  } catch (e) { g = { ok: false, error: String(e && e.message || e) }; }
  if (g && g.ok && String(g.texto || '').trim()) { texto = String(g.texto).replace(/[*#`]/g, '').trim(); modelo = g.modelo || 'Gemini'; }
  else texto = 'Informe sin IA (Gemini no ha respondido' + (g && g.error ? ': ' + String(g.error).slice(0, 120) : '') + '). Datos en bruto del mes:\n\n' + datos;
  anadirFila_(HOJAS.INFORMES, { FECHA: isoAFecha(hoy), MES: hoy.slice(0, 7), TEXTO: texto.slice(0, 40000), MODELO: modelo });
  MEMO = null;
  return { fecha: hoy, texto: texto };
}

// ===================== 3 · SALUD DE LAS TAREAS AUTOMÁTICAS =====================
var SALUD_PERIODOS_ = { revisarAvisos: 1, sincronizarCalendario: 1, motorDiario: 24, resumenLunes: 168, domingoNoche: 168, cargarFabrikDomingo: 168, competisLunes: 168, videosMartes: 168, backupJueves: 168 };   // horas
function saludLeer_() { var o = {}; try { o = JSON.parse(String(leerConfig_().salud || '{}')) || {}; } catch (e) { o = {}; } return o; }
function saludRegistrar_(nombre, ok, msg) {
  bloqueo_(function () {
    var s = saludLeer_(); s[nombre] = { t: ahora_(), ok: !!ok, msg: String(msg || '').slice(0, 200) };
    ponerConfig_('salud', JSON.stringify(s), 'Salud de las tareas automáticas (última ejecución de cada una; la app y el aviso diario lo leen)');
  });
}
/** Ejecuta fn y anota en config «salud» cómo salió; relanza el error si falla. Después invalida la caché de la semana. */
function conSalud_(nombre, fn) {
  var res, err = null;
  try { res = fn(); } catch (e) { err = e; }
  try { saludRegistrar_(nombre, !err, err ? (err && err.message || err) : ''); } catch (e2) { Logger.log('salud: ' + e2); }
  try { invalidarSemana_(); } catch (e3) { Logger.log('invalidar: ' + e3); }
  if (err) throw err;
  return res;
}
function horasDeTxt_(t) {   // «dd/MM/yyyy HH:mm» → horas (misma zona en ambos lados)
  var m = String(t || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/); if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) / 36e5;
}
function saludEstado_() {
  var S = saludLeer_(), ahoraH = horasDeTxt_(ahora_());
  var tareas = Object.keys(SALUD_PERIODOS_).map(function (n) {
    var x = S[n], h = x ? horasDeTxt_(x.t) : null;
    if (!x) return { nombre: n, ultima: '', ok: null, msg: 'aún sin registro', atrasada: false };   // sin dato no se da por atrasada (acaba de instalarse)
    return { nombre: n, ultima: x.t, ok: x.ok !== false, msg: x.msg || '', atrasada: h != null && ahoraH != null && (ahoraH - h) > 1.5 * SALUD_PERIODOS_[n] };
  });
  var bk = { ok: false, fecha: '', kb: 0 };
  try {
    var p = String(leerConfig_().backup_jueves || '').split(' · ');
    bk.fecha = p[0] || '';
    if (p[1]) { var tam = DriveApp.getFileById(p[1]).getSize(); bk.kb = Math.round(tam / 1024); bk.ok = tam > 0; }
  } catch (e) { bk.ok = false; bk.msg = String(e && e.message || e).slice(0, 100); }
  return { tareas: tareas, backup: bk };
}
/** Un aviso al día como mucho si hay tareas atrasadas o con fallo (o un backup que no existe / pesa 0). */
function revisarSalud_() {
  var e = saludEstado_(), mal = e.tareas.filter(function (t) { return t.atrasada || t.ok === false; }).map(function (t) { return t.nombre + (t.atrasada ? ' (atrasada)' : ' (falló)'); });
  if (e.backup.fecha && !e.backup.ok) mal.push('backup (no se encuentra o pesa 0)');
  var hoy = hoyIso_(); if (!mal.length || leerConfig_().salud_aviso === hoy) return mal.length;
  try { enviarPush_('Road To Elite · tareas automáticas', 'Revisa: ' + mal.join(', ')); } catch (x) { Logger.log('Aviso salud: ' + x); }
  ponerConfig_('salud_aviso', hoy, 'Último día en que se avisó de tareas automáticas con problemas');
  return mal.length;
}

// ===================== 4 · TÉCNICO =====================
// ---- a · archivo ----
function destinoArchivo_(nombre, cab) {
  var ss = motorLibro_(), sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold'); return { sh: sh, cab: cab.slice() }; }
  var tiene = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  var extra = cab.filter(function (h) { return tiene.indexOf(h) < 0; });
  if (!tiene.length || extra.length) { tiene = tiene.concat(extra); sh.getRange(1, 1, 1, tiene.length).setValues([tiene]).setFontWeight('bold'); }
  return { sh: sh, cab: tiene };
}
function moverAArchivo_(hoja, destino, corte) {
  return bloqueo_(function () {
    var sh = hojaMia_(hoja), all = sh.getDataRange().getValues();
    if (all.length < 2) return 0;
    var cab = all[0].map(function (h) { return String(h).trim(); }), iF = cab.indexOf('FECHA'); if (iF < 0) return 0;
    var mover = [], quedan = [];
    all.slice(1).forEach(function (r) { var iso = celdaIso_(r[iF]); (iso && iso < corte ? mover : quedan).push(r); });
    if (!mover.length) return 0;
    var d = destinoArchivo_(destino, cab), antes = d.sh.getLastRow();
    var m = mover.map(function (r) { return d.cab.map(function (h) { var j = cab.indexOf(h); var v = j >= 0 ? r[j] : ''; return typeof v === 'string' ? celdaSegura_(v) : v; }); });
    d.sh.getRange(antes + 1, 1, m.length, d.cab.length).setValues(m);
    if (d.sh.getLastRow() < antes + m.length) throw new Error('archivo: no se han escrito todas las filas en ' + destino);   // no se borra nada del origen
    var nF = all.length - 1, nC = cab.length;
    sh.getRange(2, 1, nF, nC).clearContent();
    if (quedan.length) sh.getRange(2, 1, quedan.length, nC).setValues(quedan.map(function (r) { return r.slice(0, nC).map(function (v) { return typeof v === 'string' ? celdaSegura_(v) : v; }); }));
    MEMO = null;
    return mover.length;
  });
}
/** Mueve a Motor › ARCHIVO · PLAN / ARCHIVO · REGISTRO lo anterior al ciclo actual de Fabrik (y a 6 semanas como mínimo). Solo con backup de ≤ 8 días. */
function archivarAntiguo_() {
  var hoy = hoyIso_(), bk = String(leerConfig_().backup_jueves || '').split(' · ')[0];
  if (!isoOk_(bk) || (Date.parse(hoy) - Date.parse(bk)) / 864e5 > 8) return { plan: 0, registro: 0, motivo: 'sin backup reciente' };
  var limite = sumarDias(lunesDe_(hoy), -42), corte = limite;
  try {
    var ini = estructura_(fabrik_()).ciclo.fases.map(function (f) { return f.inicio; }).filter(Boolean).sort()[0];
    if (ini && ini < corte) corte = ini;
  } catch (e) { Logger.log('archivarAntiguo_: ciclo de Fabrik no legible, corte a 6 semanas: ' + e); }
  var p = moverAArchivo_(HOJAS.PLAN, 'ARCHIVO · PLAN', corte), r = moverAArchivo_(HOJAS.REGISTRO, 'ARCHIVO · REGISTRO', corte);
  return { plan: p, registro: r, corte: corte };
}
/** Para domingoNoche: solo el primer domingo de cada mes. */
function archivarSiToca_() {
  var hoy = hoyIso_();
  if (new Date(hoy + 'T12:00:00Z').getUTCDay() !== 0 || +hoy.slice(8, 10) > 7) return null;
  var r = archivarAntiguo_(); Logger.log('Archivo: ' + JSON.stringify(r)); return r;
}

// ---- b · caché de la semana ----
function invalidarSemana_() { PROPS.setProperty('rev_datos', String((parseInt(PROPS.getProperty('rev_datos') || '0', 10) || 0) + 1)); }
function semanaCacheada_(semana) {
  if (semana && !isoOk_(semana)) return semanaCompleta_(semana);
  var lunes = lunesDe_(semana || hoyIso_()), c = CacheService.getScriptCache(), rev = PROPS.getProperty('rev_datos') || '0', base = 'sem|' + lunes + '|' + hoyIso_() + '|' + rev;
  try {
    var n = parseInt(c.get(base + '|n'), 10);
    if (n > 0) {
      var claves = []; for (var i = 0; i < n; i++) claves.push(base + '|' + i);
      var got = c.getAll(claves), txt = '', ok = true;
      for (var j = 0; j < n; j++) { if (got[claves[j]] == null) { ok = false; break; } txt += got[claves[j]]; }
      if (ok) return JSON.parse(txt);
    }
  } catch (e) { Logger.log('semanaCacheada_ lectura: ' + e); }
  var res = semanaCompleta_(semana), json = JSON.stringify(res);
  [90000, 30000].some(function (tam) {
    try {
      var put = {}, k = 0; for (var p = 0; p < json.length; p += tam) put[base + '|' + (k++)] = json.slice(p, p + tam);
      put[base + '|n'] = String(k); c.putAll(put, 900); return true;
    } catch (e) { return false; }
  });
  return res;
}
var SOLO_LECTURA_ = ['inicio', 'semana', 'rendimiento', 'aprendizaje', 'op_estado', 'competis', 'fichas', 'salud', 'resumen_lunes', 'chequeos', 'estimulos_lista', 'incentivo_datos', 'lesion_zonas', 'plan_competi',
  'marcas', 'descuentos', 'webs', 'videos', 'cobertura', 'eventos', 'metas', 'carrera_lista', 'plantillas', 'extras_previa', 'posicion', 'motor_wods', 'extras_curso', 'biblioteca', 'wods', 'push_prueba'];
function esSoloLectura_(accion) { return SOLO_LECTURA_.indexOf(String(accion)) >= 0; }

// ---- c · escrituras por lotes ----
/** cambios = [{ fila, obj }]. Lee la hoja una vez y escribe un setValues por columna tocada (de su primera a su última fila tocada). Devuelve las filas cambiadas. */
function actualizarEnLote_(hoja, cambios) {
  if (!cambios || !cambios.length) return 0;
  var sh = hojaMia_(hoja), vals = sh.getDataRange().getValues();
  if (!vals.length) return 0;
  var cab = vals[0].map(function (h) { return String(h).trim(); }), col = {}, filas = {};
  cambios.forEach(function (c) {
    var f = Number(c.fila); if (!(f >= 2) || f > vals.length) return;
    Object.keys(c.obj || {}).forEach(function (h) {
      var j = cab.indexOf(h); if (j < 0) return;
      vals[f - 1][j] = celdaSegura_(c.obj[h]);
      var x = col[j] = col[j] || { min: f, max: f }; if (f < x.min) x.min = f; if (f > x.max) x.max = f;
      filas[f] = 1;
    });
  });
  Object.keys(col).forEach(function (js) {
    var j = +js, x = col[js], out = [];
    for (var f = x.min; f <= x.max; f++) { var v = vals[f - 1][j]; out.push([typeof v === 'string' ? celdaSegura_(v) : v]); }
    sh.getRange(x.min, j + 1, out.length, 1).setValues(out);
  });
  return Object.keys(filas).length;
}
