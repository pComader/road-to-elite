// ===================== v0.15 · MOTOR GUIADO POR MOTOR_GUIA.md · MOTOR · ANÁLISIS · GEMINI · AGENTE DEL PC · BACKUP DE LOS JUEVES =====================
/*
 * - MOTOR_GUIA.md (Drive, CONFIG › motor_guia_id): sus tablas «## TABLA · …» mandan sobre los movimientos, formatos, pesos e interferencias
 *   del motor. Si no se puede leer, se usa la copia de este código (MOTOR_GUIA_BASE_).
 * - MOTOR · ANÁLISIS (oculta): cada metcon de Fabrik y de competición descompuesto (formato, ventanas, estructura, pesos, interferencias)
 *   + CIENCIA (Claude / Gemini) + CONCEPTOS (Ollama, desde el PC). El motor copia las estructuras que más se parecen a lo que pides.
 * - «Estímulos que quiero»: metconGuiado_ (bloque nuevo, extras) y megaWod_ (Reestructurar B).
 * - Backup de los jueves (Drive) + copia en el PC por el agente; si a las 16:00 no está: correo, aviso en la app y ventana en el PC.
 */
HOJAS.MOTOR = 'MOTOR · ANÁLISIS';
var ESQ_BD_ = {};
ESQ_BD_[HOJAS.MOTOR] = {
  cab: ['ID', 'FUENTE', 'FECHA', 'NOMBRE', 'TEXTO', 'FORMATO', 'MIN', 'VENTANAS', 'ESTRUCTURA', 'MOVIMIENTOS', 'PATRONES', 'PESOS', 'INTERFERENCIAS',
    'OBJETIVO / ESTÍMULO', 'LIMITANTES', 'RPE', 'CIENCIA', 'CONCEPTOS (Ollama)', 'ANALIZADO POR', 'HASH', 'ACTUALIZADO', 'PROCEDENCIA', 'PERMISO', 'VERSIÓN GUÍA', 'IDIOMA'],
  anchos: [90, 95, 90, 220, 320, 90, 50, 160, 200, 200, 130, 140, 260, 240, 220, 50, 380, 260, 120, 90, 120, 150, 95, 80, 55],
  fechas: ['FECHA'], negrita: 'NOMBRE', color: '#8b5cf6', listas: { FUENTE: ['Fabrik', 'Competición', 'Guardado', 'Manual'], PERMISO: ['personal', 'compartible'] },
  colores: [['PERMISO', '^compartible$', '#dcfce7', '#14532d']]
};

// ---------- 1 · La guía ----------
function guiaTexto_() {
  var c = CacheService.getScriptCache(), v = c.get('guia_md_v15');
  if (v) return v;
  var id = leerConfig_().motor_guia_id, t = '';
  if (id) { try { t = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'); } catch (e) { Logger.log('MOTOR_GUIA no legible: ' + e); } }
  if (!/##\s*TABLA/i.test(t)) t = MOTOR_GUIA_BASE_;
  try { c.put('guia_md_v15', t, 21600); } catch (e) { /* >100 KB: sin caché */ }
  return t;
}
function tablasGuia_(md) {
  var T = {}, actual = null;
  String(md || '').replace(/\r/g, '').split('\n').forEach(function (l) {
    var h = l.match(/^##\s*TABLA\s*·\s*(.+?)\s*$/i);
    if (h) { actual = norm(h[1]).trim(); T[actual] = { cab: null, filas: [] }; return; }
    if (/^#/.test(l)) { actual = null; return; }
    if (!actual || !/^\s*\|/.test(l)) return;
    var celdas = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (x) { return x.trim(); });
    if (celdas.every(function (x) { return /^:?-{2,}:?$/.test(x); })) return;
    var t = T[actual];
    if (!t.cab) { t.cab = celdas.map(function (x) { return norm(x).trim(); }); return; }
    if (/^#/.test(celdas[0])) return;
    var o = {}; t.cab.forEach(function (k, i) { o[k] = celdas[i] || ''; }); t.filas.push(o);
  });
  return T;
}
var GUIA_MEMO_ = null;
function guiaMotor_() {
  if (GUIA_MEMO_) return GUIA_MEMO_;
  var T = tablasGuia_(guiaTexto_());
  if (!T.MOVIMIENTOS || !T.MOVIMIENTOS.filas.length) T = tablasGuia_(MOTOR_GUIA_BASE_);
  else {   // v0.22 · movimientos nuevos de la guía base (peso corporal, fuerza) que aún no están en tu copia de Drive
    var Tb = tablasGuia_(MOTOR_GUIA_BASE_), ya = {}; T.MOVIMIENTOS.filas.forEach(function (r) { ya[norm(r.CLAVE).trim()] = 1; });
    ((Tb.MOVIMIENTOS || {}).filas || []).forEach(function (r) { if (r.CLAVE && !ya[norm(r.CLAVE).trim()]) T.MOVIMIENTOS.filas.push(r); });
  }
  var f = function (k) { return (T[k] || { filas: [] }).filas; };
  var lista = function (s) { return String(s || '').split(',').map(function (x) { return norm(x).replace(/\s+/g, ' ').trim(); }).filter(Boolean); };
  var numero = function (s) { var n = parseFloat(String(s || '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  var G = { movs: [], formatos: {}, patrones: [], interf: [], pesos: {}, reglas: {} };
  f('MOVIMIENTOS').forEach(function (r) {
    if (!r.CLAVE) return;
    var k = norm(r.CLAVE).trim();
    G.movs.push({ k: k, n: r.NOMBRE || k, alias: lista(r.ALIAS).concat([k.replace(/_/g, ' ')]).filter(function (a, i, x) { return x.indexOf(a) === i; }).sort(function (a, b) { return b.length - a.length; }),
      mat: String(r.MATERIAL || '').trim().toLowerCase(), alt: String(r.ALTERNATIVA || '').trim().toLowerCase(), patron: norm(r.PATRON).trim(), carga: lista(r.CARGA),
      unidad: String(r.UNIDAD || 'reps').trim().toLowerCase(), reps: numero(r.REPS) || 10, kg: numero(r['KG ♂ RX']), kgF: numero(r['KG ♀ RX']), rm: String(r['1RM DE'] || '').trim(), c: String(r.CODIGO || '').trim().toUpperCase() });
  });
  f('FORMATOS').forEach(function (r) {
    if (!r.CLAVE) return;
    G.formatos[norm(r.CLAVE).trim()] = { k: norm(r.CLAVE).trim(), nombre: r.NOMBRE, min: numero(r.MIN) || 5, max: numero(r.MAX) || 40, ventana: r.VENTANA, sistema: r.SISTEMA, zona: r.ZONA, rpe: r.RPE,
      repsx: numero(r['REPS X']) || 1, cuando: r.CUANDO, estrategia: r.ESTRATEGIA };
  });
  f('PATRONES').forEach(function (r) { if (r.PALABRA) G.patrones.push({ palabras: lista(r.PALABRA), patron: norm(r.PATRON).trim(), carga: norm(r.CARGA).trim() }); });
  f('INTERFERENCIAS').forEach(function (r) {
    if (!r.A || !r.B) return;
    G.interf.push({ a: norm(r.A).trim(), b: norm(r.B).trim(), tipo: String(r.TIPO || '').trim().toLowerCase(), orden: String(r.ORDEN || 'A<>B').replace(/\s/g, '').toUpperCase(), efecto: r['EFECTO BUSCADO'] || '', ciencia: r.CIENCIA || '' });
  });
  f('PESOS').forEach(function (r) { if (r.FORMATO) G.pesos[norm(r.FORMATO).trim()] = { min: numero(r['% MIN']) || 45, max: numero(r['% MAX']) || 65, nota: r.NOTA || '' }; });
  f('REGLAS').forEach(function (r) { if (r.CLAVE) G.reglas[String(r.CLAVE).trim().toLowerCase()] = numero(r.VALOR) || r.VALOR; });
  if (!G.movs.length) throw new Error('MOTOR_GUIA sin tabla de movimientos');
  GUIA_MEMO_ = G;
  return G;
}
function movPorClave_(G, k) { return G.movs.filter(function (m) { return m.k === k; })[0] || null; }
/** Posición del alias en el texto normalizado, con límites de palabra (admite plural en S/ES). -1 si no está. */
function aliasEn_(t, a) {
  var i = t.indexOf(a);
  while (i >= 0) {
    var antes = i ? t.charAt(i - 1) : ' ', resto = t.slice(i + a.length), desp = resto.replace(/^(ES|S)(?=[^A-Z]|$)/, '').charAt(0) || ' ';
    if (!/[A-Z0-9]/.test(antes) && !/[A-Z]/.test(desp)) return i;
    i = t.indexOf(a, i + 1);
  }
  return -1;
}
/** Movimientos de la guía que aparecen en el texto, en orden de aparición (el alias más largo gana: «squat snatch» no cuenta también como «snatch»). */
function detectarMovs_(t, G) {
  t = norm(t);
  var hits = [];
  G.movs.forEach(function (m) {
    m.alias.forEach(function (a) {
      var i = t.indexOf(a);
      while (i >= 0) {
        var antes = i ? t.charAt(i - 1) : ' ', resto = t.slice(i + a.length), plural = (resto.match(/^(ES|S)(?=[^A-Z]|$)/) || [''])[0], desp = resto.slice(plural.length).charAt(0) || ' ';
        if (!/[A-Z0-9]/.test(antes) && !/[A-Z]/.test(desp)) hits.push({ m: m, i: i, len: a.length + plural.length });
        i = t.indexOf(a, i + 1);
      }
    });
  });
  hits.sort(function (x, y) { return y.len - x.len || x.i - y.i; });
  var tomados = [], out = [];
  hits.forEach(function (h) {
    if (tomados.some(function (x) { return h.i < x.i + x.len && x.i < h.i + h.len; })) return;
    tomados.push(h);
    if (!out.some(function (o) { return o.m === h.m; })) out.push(h);
  });
  return out.sort(function (x, y) { return x.i - y.i; });
}
function encaja_(lado, m, fk) { return lado === '*' || lado === m.k || lado === m.patron || (fk && lado === fk); }
/** Interferencias de la guía entre dos movimientos (x antes que y). */
function interfEntre_(G, x, y) {
  return G.interf.filter(function (r) {
    if (encaja_(r.a, x) && encaja_(r.b, y)) return true;
    return r.orden !== 'A>B' && encaja_(r.a, y) && encaja_(r.b, x);
  });
}

// ---------- 2 · Análisis de un WOD ----------
function hashTxt_(txt) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, norm(txt).replace(/\s+/g, ' ').trim());
  return d.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 16);
}
function formatoDeTexto_(t, nMovs) {
  var min = function (re) { var m = t.match(re); return m ? +m[1] : 0; };
  var cap = min(/(?:TIME ?CAP|CAP|TC)[^0-9]{0,4}([0-9]{1,2})/), amrap = min(/AMRAP[^0-9]{0,6}([0-9]{1,2})/), emom = min(/EMOM[^0-9]{0,6}([0-9]{1,2})/);
  var every = t.match(/(?:EVERY|CADA|E)\s*([0-9]{1,2}(?:[:,.][0-9]{2})?)\s*(?:'|′|’|MIN|:00)?\s*(?:X|×)\s*([0-9]{1,2})/);
  var pesado = /HEAVY|PESAD|[0-9]RM|[89][0-9] ?%/.test(t);
  if (/SINCRO|SYNCHRO|IN PAIRS|EN PAREJA|EQUIPO|TEAM OF/.test(t)) return { k: 'SINCRO', min: amrap || cap || emom || 0 };
  if (/[0-9]{1,3}[\"″]? ?ON\b|ON ?\/ ?OFF|[0-9]+ ?: ?[0-9]+ ?(TRABAJO|WORK)|TRABAJO ?\/ ?DESCANSO/.test(t)) return { k: 'INTERVALOS', min: cap || amrap || emom || 0 };
  if (every) { var n = parseFloat(String(every[1]).replace(/[:,]/, '.')), s = +every[2]; return { k: pesado ? 'VENTANAS' : n >= 2.5 ? 'EVERY' : 'EMOM', min: Math.round(n * s) }; }
  if (emom) return { k: 'EMOM', min: emom };
  if (amrap) return { k: amrap <= 10 ? 'AMRAP_C' : amrap <= 20 ? 'AMRAP' : 'AMRAP_L', min: amrap };
  if (/(^|[^0-9])[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}/.test(t)) return { k: 'ESCALERA', min: cap };
  if (/FOR TIME|TIME ?CAP|CAP|POR TIEMPO|CHIPPER/.test(t)) return { k: (nMovs >= 6 || /CHIPPER/.test(t)) ? 'CHIPPER' : cap && cap <= 8 ? 'SPRINT' : 'FOR_TIME', min: cap };
  return { k: '', min: 0 };
}
/** Descompone un WOD. meta (opcional): campos de la ficha de Fabrik { objetivo, modalidad, rpe, limitantes, carga }. */
function analizarWod_(txt, meta) {
  var G = guiaMotor_(), t = norm(txt), meta = meta || {};
  var det = detectarMovs_(t, G), movs = det.map(function (x) { return x.m; });
  var fo = formatoDeTexto_(t, movs.length);
  var vent = [];
  (t.match(/(?:EVERY|CADA)\s*[0-9:,.′'’"″]+\s*(?:MIN)?\s*(?:X|×)\s*[0-9]+(?:\s*(?:SETS|RONDAS|ROUNDS))?/g) || []).forEach(function (x) { vent.push(x.trim()); });
  (t.match(/[0-9]{1,3}\s*["″]?\s*ON\s*\/?\s*[0-9]{1,3}\s*["″]?\s*OFF/g) || []).forEach(function (x) { vent.push(x.trim()); });
  (t.match(/(?:REST|DESCANS[OA]|RECUPERA)\S*\s*[0-9]{1,2}\s*(?:'|′|’|MIN|["″]|SEG)/g) || []).forEach(function (x) { vent.push(x.trim()); });
  var esq = (t.match(/(^|[^0-9])([0-9]{1,3}(?:-[0-9]{1,3}){2,})/) || [])[2] || '', rondas = (t.match(/([0-9]{1,2})\s*(?:RONDAS|ROUNDS|RFT|SETS)/) || [])[1] || '';
  var asc = /\+ ?[0-9]+ ?(REPS? )?(EACH|CADA|POR) (ROUND|RONDA)|ASCENDING|ASCENDENTE/.test(t);
  var estructura = [esq ? esq : '', rondas ? rondas + ' rondas' : '', asc ? 'ascendente' : ''].filter(Boolean).join(' · ');
  estructura = (estructura ? estructura + ' · ' : '') + movs.map(function (m) { return m.k; }).join(' → ');
  var pesos = [];
  (t.match(/[0-9]{1,3}(?:[.,][0-9])?\s*(?:\/\s*[0-9]{1,3}(?:[.,][0-9])?)?\s*(?:KG|LB|LBS|#)/g) || []).concat(t.match(/[0-9]{2,3}(?:\s*\/\s*[0-9]{2,3})?\s*%/g) || [])
    .forEach(function (x) { x = x.replace(/\s+/g, ''); if (pesos.indexOf(x) < 0 && pesos.length < 8) pesos.push(x); });
  if (meta.carga) pesos.push('carga ' + String(meta.carga).replace(/\s+/g, ' ').trim().toLowerCase());
  var inter = [];
  for (var i = 0; i + 1 < movs.length; i++) {
    interfEntre_(G, movs[i], movs[i + 1]).forEach(function (r) { var s = movs[i].k + '→' + movs[i + 1].k + ' (' + r.tipo + ': ' + r.efecto + ')'; if (inter.indexOf(s) < 0) inter.push(s); });
    var fam = { AGARRE: null, HOMBRO: ['OH', 'EMPUJE_G'], PIERNA: ['SENT', 'BISAGRA'] };
    ['AGARRE', 'HOMBRO', 'PIERNA'].forEach(function (c) { var pf = fam[c], mismo = !pf || (pf.indexOf(movs[i].patron) >= 0 && pf.indexOf(movs[i + 1].patron) >= 0); if (mismo && movs[i].carga.indexOf(c) >= 0 && movs[i + 1].carga.indexOf(c) >= 0) { var s2 = movs[i].k + '→' + movs[i + 1].k + ' (doble ' + c.toLowerCase() + ')'; if (inter.indexOf(s2) < 0 && !inter.some(function (z) { return z.indexOf(movs[i].k + '→' + movs[i + 1].k) === 0; })) inter.push(s2); } });
  }
  if (movs.length > 2) interfEntre_(G, movs[movs.length - 1], movs[0]).forEach(function (r) { var s = movs[movs.length - 1].k + '→' + movs[0].k + ' (cambio de ronda · ' + r.tipo + ')'; if (inter.indexOf(s) < 0) inter.push(s); });
  if (fo.k === 'VENTANAS' && movs.some(function (m) { return m.patron === 'MONO'; })) inter.push('ERG→HEAVY (fuerza en fatiga)');
  var obj = meta.objetivo || ((txt.match(/OBJETIVO\s*:\s*([^\n]+(?:\n(?!\s*[A-ZÁÉÍÓÚ ]{4,}:)[^\n]+)*)/i) || [])[1] || '');
  var lim = meta.limitantes || ((txt.match(/LIMITANTE[\s\S]{0,400}/i) || [''])[0]);
  var rpe = meta.rpe || ((t.match(/RPE\s*([0-9]{1,2}(?:[\/-][0-9]{1,2})?)/) || [])[1] || '');
  return {
    FORMATO: fo.k, MIN: fo.min || '', VENTANAS: vent.filter(function (v, i2) { return vent.indexOf(v) === i2; }).slice(0, 4).join(' · '), ESTRUCTURA: estructura.slice(0, 400),
    MOVIMIENTOS: movs.map(function (m) { return m.k; }).join(', '), PATRONES: movs.map(function (m) { return m.patron; }).filter(function (p, i2, a) { return p && a.indexOf(p) === i2; }).join(', '),
    PESOS: pesos.join(' · ').slice(0, 300), INTERFERENCIAS: inter.slice(0, 8).join('\n'),
    'OBJETIVO / ESTÍMULO': [meta.modalidad ? 'Modalidad: ' + meta.modalidad : '', obj ? 'Objetivo: ' + recortar(obj) : ''].filter(Boolean).join('\n').slice(0, 1200),
    LIMITANTES: recortar(String(lim || '')).replace(/\n+/g, ' · ').slice(0, 600), RPE: rpe
  };
}

// ---------- 3 · Alimentar la base de datos ----------
function filasEnHoja_(nombre, filas) {
  if (!filas.length) return 0;
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  var m = filas.map(function (o) { return cab.map(function (c) { var v = o[c]; return v == null ? '' : celdaSegura_(v); }); });
  sh.getRange(sh.getLastRow() + 1, 1, m.length, cab.length).setValues(m);
  return m.length;
}
/** Metcons de Fabrik (últimas n semanas, hasta la siguiente) y WODs guardados en APP · WODS. Solo lee Fabrik. */
function alimentarMotor_(nSemanas) {
  var ya = {}, nuevas = [];
  listar_(HOJAS.MOTOR).forEach(function (r) { if (r.HASH) ya[r.HASH] = 1; });
  var est = null, tope = sumarDias(lunesDe_(hoyIso_()), 7);
  try { est = estructura_(fabrik_()); } catch (e) { Logger.log('Motor · Fabrik no legible: ' + e); }
  (est ? est.semanas : []).filter(function (s) { return s.iso && s.iso <= tope; }).slice(-(nSemanas || 2)).forEach(function (s) {
    var F; try { F = semanaBase_(s, est); } catch (e) { Logger.log('Motor · semana ' + s.nombre + ': ' + e); return; }
    (F.dias || []).forEach(function (d) {
      (d.bloques || []).forEach(function (b) {
        if (!b.n || !esMetconB_(b)) return;
        var txt = textoBloque_(b), h = hashTxt_(txt);
        if (ya[h]) return; ya[h] = 1;
        var w = b.wod || {};
        var a = analizarWod_(txt, { objetivo: w.objetivo, modalidad: [w.modalidad, w.formato].filter(Boolean).join(' · '), rpe: b.rpe || d.rpe, limitantes: w.limitantes, carga: w.carga });
        nuevas.push(Object.assign(a, { ID: 'MW-' + h.slice(0, 8), FUENTE: 'Fabrik', FECHA: d.iso ? isoAFecha(d.iso) : '', NOMBRE: (s.nombre + ' · ' + d.nombre + ' · ' + (b.titulo || 'METCON')).slice(0, 160),
          TEXTO: String(txt).slice(0, 4000), HASH: h, 'ANALIZADO POR': 'Motor', ACTUALIZADO: ahora_() }, metaBd_('Fabrik (programación de Gabi)', 'personal')));
      });
    });
  });
  listar_(HOJAS.WODS).forEach(function (r) {
    if (!r.CONTENIDO) return;
    var h = hashTxt_(r.CONTENIDO); if (ya[h]) return; ya[h] = 1;
    nuevas.push(Object.assign(analizarWod_(r.CONTENIDO, {}), { ID: 'MW-' + h.slice(0, 8), FUENTE: 'Guardado', FECHA: r['FECHA ORIGEN'] || '', NOMBRE: String(r.NOMBRE || 'WOD').slice(0, 160),
      TEXTO: String(r.CONTENIDO).slice(0, 4000), HASH: h, 'ANALIZADO POR': 'Motor', ACTUALIZADO: ahora_() }, metaBd_('Guardado en la app', 'personal')));
  });
  var yaFecha = {}; listar_(HOJAS.MOTOR).concat(nuevas).forEach(function (r) { if (r.FECHA) yaFecha[r.FECHA + '|' + r.MOVIMIENTOS] = 1; });
  try { leerVuelcoGabi_(ya, yaFecha).forEach(function (o) { nuevas.push(o); }); } catch (e) { Logger.log('Motor · lo volcado por la app de Gabi: ' + e); }
  return filasEnHoja_(HOJAS.MOTOR, nuevas);
}
/** Filas que pegas a mano (o que añade Claude) solo con NOMBRE y TEXTO: se analizan solas. */
function reanalizarMotor_() {
  var n = 0;
  listar_(HOJAS.MOTOR).forEach(function (r) {
    if (!r.TEXTO || r.FORMATO || r.MOVIMIENTOS) return;
    var a = analizarWod_(r.TEXTO, {});
    a.HASH = hashTxt_(r.TEXTO); if (!r.ID) a.ID = 'MW-' + a.HASH.slice(0, 8); if (!r.FUENTE) a.FUENTE = 'Manual';
    a['ANALIZADO POR'] = autores_(r['ANALIZADO POR'], 'Motor'); a.ACTUALIZADO = ahora_();
    if (!r.PERMISO) Object.assign(a, metaBd_(r.PROCEDENCIA || 'Pegado a mano', 'personal'));
    actualizarFila_(HOJAS.MOTOR, r._fila, a); n++;
  });
  return n;
}
function autores_(prev, quien) { var l = String(prev || '').split(/\s*·\s*/).filter(Boolean); if (l.indexOf(quien) < 0) l.push(quien); return l.join(' · '); }

// WODs de competición de referencia (escritos por Claude con su explicación; comprueba pesos y reps con la fuente oficial).
var MOTOR_SEMILLAS_ = [
  ['Open 24.1', 'FOR TIME · cap 15′\n21 DB SNATCHES (brazo 1)\n21 LATERAL BURPEES OVER DB\n21 DB SNATCHES (brazo 2)\n21 LATERAL BURPEES OVER DB\n15-15-15-15\n9-9-9-9\nDB 22,5 / 15 kg',
    'Escalera descendente de dos movimientos de muy baja técnica y alto gasto: el limitante es respiratorio y de transición, no muscular. El DB snatch unilateral reparte la fatiga del agarre entre brazos y el burpee lateral mantiene la FC cerca del máximo, así que es un esfuerzo glucolítico-aeróbico de 10–15′ en Z5. Gana quien no para: pocas pausas, transiciones de menos de 2″ y un ritmo de burpee constante. Las adaptaciones son tolerancia a H⁺ y eficiencia del gesto repetido.'],
  ['Open 24.2', 'AMRAP 20′\n300 m ROW\n10 DEADLIFTS 84 / 56,5 kg\n50 DOUBLE UNDERS',
    'AMRAP largo: el remo y los DU sostienen el estímulo aeróbico (Z3–Z4) y el peso muerto moderado (≈45–55 % 1RM) introduce fatiga de cadena posterior y agarre que se acumula ronda tras ronda. Remo → peso muerto es un par de cadena posterior: si el remo se tira con espalda, el peso muerto se resiente. La clave es un ritmo de remo repetible (mismo split por ronda) y los DU sin fallos, porque cada fallo cuesta FC y segundos.'],
  ['Open 24.3', 'FOR TIME · cap 15′\n5 RONDAS: 10 THRUSTERS 43 / 29 kg + 10 CHEST TO BAR\nDESCANSO 1′\n5 RONDAS: 7 THRUSTERS 61 / 43 kg + 7 BAR MUSCLE UPS',
    'Dos parejas empuje-tirón (thruster + C2B y thruster pesado + BMU): complementarias, porque mientras trabajan las piernas y el hombro empujando, el dorsal se recupera, y al revés. El minuto de descanso divide el WOD en un sprint ligero y una segunda parte donde la barra pesada y el BMU con fatiga cardiorrespiratoria son el limitante técnico. Entrena gimnásticos de alta habilidad con pulsaciones altas, la interferencia típica de la fase de realización.'],
  ['Open 25.1', 'AMRAP 15′\n3 LATERAL BURPEES OVER DB\n3 DB HANG CLEAN TO OVERHEAD\n30 ft (≈9 m) DB OVERHEAD WALKING LUNGE\n+3 reps de burpee y C2OH cada ronda\nDB 22,5 / 15 kg',
    'Escalera ascendente: las primeras rondas son ritmo y las últimas, gestión de fatiga de hombro. Burpee → C2OH → lunge OH encadena tres exigencias de estabilidad por encima de la cabeza (deltoides, serrato, core) con la FC alta del burpee. Es un AMRAP medio en umbral (Z4–Z5) cuyo limitante local es el hombro: hay que bloquear bien en el lunge y no soltar la mancuerna salvo planificado.'],
  ['Open 25.2 (= 22.3)', 'FOR TIME · cap 12′\n21 PULL-UPS · 42 DOUBLE UNDERS · 21 THRUSTERS 43 / 29 kg\n18 CHEST TO BAR · 36 DOUBLE UNDERS · 18 THRUSTERS 52 / 34 kg\n15 BAR MUSCLE UPS · 30 DOUBLE UNDERS · 15 THRUSTERS 61 / 38,5 kg',
    'Escalera descendente de volumen y ascendente de dificultad: cada tramo sube la exigencia del tirón (pull-up → C2B → BMU) y el peso del thruster. Los DU entre los dos sostienen la FC y hacen de bisagra respiratoria: es el par DU + thruster que Fabrik marca como limitante respiratorio alto. Gana quien llega con agarre y hombro al BMU: tandas planificadas en los pull-ups y nada al fallo antes del tercer tramo.'],
  ['Open 25.3', 'FOR TIME · cap 20′\n5 WALL WALKS · 50 cal ROW\n5 WALL WALKS · 25 DEADLIFTS 102 / 70 kg\n5 WALL WALKS · 25 CLEANS 61 / 38,5 kg\n5 WALL WALKS · 25 SNATCHES 43 / 29 kg\n5 WALL WALKS · 50 cal ROW',
    'Chipper de barra con cargas que bajan y técnica que sube (peso muerto → clean → snatch), separado por wall walks: el hombro y el core trabajan en isometría entre tramos de cadena posterior. Remo y peso muerto seguidos solo están unidos por los wall walks: la lumbar acumula fatiga, así que el remo debe ir con piernas. Es mixto aeróbico-glucolítico (Z4) con limitante muscular de espalda y agarre; pacing de chipper: todos los apartados al 75–80 % y el remo final para vaciar.'],
  ['Fran (benchmark)', 'FOR TIME\n21-15-9\nTHRUSTERS 43 kg\nPULL-UPS',
    'Sprint glucolítico (2–5′, Z6–Z7) con el par empuje-tirón más clásico. El thruster consume pierna y hombro, y la dominada, agarre y dorsal: son complementarios, pero con FC máxima. La caída de rendimiento viene de la acidosis (H⁺) y del agarre. Se entrena con tandas grandes desde el principio y transiciones mínimas; mide la potencia glucolítica.'],
  ['HYROX (estaciones)', 'FOR TIME\n8 × (1 km RUN + ESTACIÓN)\nSKIERG 1000 m · SLED PUSH 50 m · SLED PULL 50 m · BURPEE BROAD JUMPS 80 m · ROW 1000 m · FARMERS CARRY 200 m · SANDBAG LUNGES 100 m · WALL BALLS 100',
    'Esfuerzo aeróbico largo (60–90′, Z3–Z4) donde la interferencia buscada es correr comprometido: cada estación fatiga un patrón (empuje de pierna, agarre, cuádriceps excéntrico) y el kilómetro siguiente exige economía de carrera con ese músculo cansado. Sled → run y lunge → run son los pares más duros. Mejora con umbral alto, fuerza-resistencia de pierna y ritmo de carrera estable.']
];
function sembrarMotorWods_() {
  var ya = {}; listar_(HOJAS.MOTOR).forEach(function (r) { if (r.HASH) ya[r.HASH] = 1; });
  var nuevas = MOTOR_SEMILLAS_.filter(function (s) { return !ya[hashTxt_(s[1])]; }).map(function (s) {
    var h = hashTxt_(s[1]);
    return Object.assign(analizarWod_(s[1], {}), { ID: 'MW-' + h.slice(0, 8), FUENTE: 'Competición', NOMBRE: s[0], TEXTO: s[1], CIENCIA: s[2], HASH: h, 'ANALIZADO POR': 'Motor · Claude', ACTUALIZADO: ahora_() }, metaBd_('Competición pública / benchmark', 'compartible'));
  });
  return filasEnHoja_(HOJAS.MOTOR, nuevas);
}

// ---------- v0.21.2 · Gemini: una sola llamada para todo, con cambio automático de modelo ----------
/*
 * Modelos GRATUITOS (nivel free de la API de Gemini) en orden de preferencia. Si el de CONFIG › gemini_modelo deja de existir
 * (HTTP 404 o «no disponible»), se prueba el siguiente y el que funcione queda guardado en CONFIG. Nunca se elige uno de pago.
 */
var GEMINI_GRATIS_ = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
var GEMINI_DEF_ = GEMINI_GRATIS_[0];
function geminiModelo_() { var m = String(leerConfig_().gemini_modelo || '').trim(); return !m || /^gemini-2\./.test(m) ? GEMINI_DEF_ : m; }
/** Devuelve { ok, texto, modelo, code, error }. maxTok = tokens de salida. */
function geminiLlamar_(prompt, maxTok, temp) {
  var key = PROPS.getProperty('GEMINI_KEY');
  if (!key) return { ok: false, error: 'sin clave (Propiedades del script › GEMINI_KEY)' };
  var actual = geminiModelo_(), lista = [actual].concat(GEMINI_GRATIS_.filter(function (m) { return m !== actual; })), ult = null;
  for (var i = 0; i < lista.length; i++) {
    var modelo = lista[i], gen = { temperature: temp == null ? 0.4 : temp, maxOutputTokens: (maxTok || 1500) * (/^gemini-2\.5/.test(modelo) ? 1 : 3) };
    if (/^gemini-2\.5-flash/.test(modelo)) gen.thinkingConfig = { thinkingBudget: 0 };
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen }) });
    var code = res.getResponseCode(), body = res.getContentText();
    if (code === 200) {
      var j = JSON.parse(body), txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ''; }).join('').trim();
      if (modelo !== String(leerConfig_().gemini_modelo || '').trim()) ponerConfig_('gemini_modelo', modelo, 'Modelo de Gemini (nivel gratuito). Si deja de existir, el servidor pasa solo al siguiente gratuito: ' + GEMINI_GRATIS_.join(' → '));
      return { ok: true, texto: txt, modelo: modelo, code: 200 };
    }
    ult = { ok: false, code: code, modelo: modelo, error: 'HTTP ' + code + ' · ' + body.slice(0, 300) };
    // solo se cambia de modelo si este ya no existe / no está disponible; con 429 (cuota) o 5xx se para y se reintenta otro día
    if (!(code === 404 || (code === 400 && /not (found|supported|available)|no longer|deprecat|unsupported model/i.test(body)) || (code === 403 && /not available|access/i.test(body)))) break;
  }
  ponerConfig_('gemini_ultimo_error', hoyTxt_() + ' · ' + ult.modelo + ' · ' + ult.error, 'Último error de Gemini (lo lee Claude)');
  return ult;
}

// ---------- 4 · Gemini: explicación científica de los WODs sin CIENCIA ----------
function geminiExplicar_(max) {
  if (!PROPS.getProperty('GEMINI_KEY')) return 'sin clave (Propiedades del script › GEMINI_KEY)';
  var n = 0;
  var claves = guiaTexto_().split(/^## Claves/m).slice(1).join('## Claves').slice(0, 6000);
  var filas = listar_(HOJAS.MOTOR).filter(function (r) { return r.TEXTO && !String(r.CIENCIA || '').trim(); }).slice(0, max || 6);
  for (var i = 0; i < filas.length; i++) {
    var r = filas[i];
    var prompt = 'Eres fisiólogo del ejercicio y entrenador de CrossFit y HYROX de élite. Analiza este WOD para la base de datos de un atleta RX (90 kg). ' +
      'Responde en español, en 5–7 frases, sin títulos, listas ni markdown. Incluye: sistema energético y zona dominantes; por qué el orden y los pares de movimientos ' +
      'generan esa interferencia (fatiga local frente a sistémica, H⁺, fosfocreatina, CO₂ y control motor); qué adaptaciones provoca; la estrategia de ritmo; y el limitante principal. ' +
      'No inventes datos que no estén en el WOD.\n\nCLAVES DEL ATLETA Y DEL PROGRAMA:\n' + claves + '\n\nWOD (' + (r.FUENTE || '') + ' · ' + (r.NOMBRE || '') + '):\n' + r.TEXTO +
      '\n\nANÁLISIS DEL MOTOR: formato ' + (r.FORMATO || '¿?') + (r.MIN ? ' · ' + r.MIN + '′' : '') + ' · movimientos ' + (r.MOVIMIENTOS || '') + ' · interferencias ' + String(r.INTERFERENCIAS || '').replace(/\n/g, '; ') +
      (r['OBJETIVO / ESTÍMULO'] ? ' · ' + r['OBJETIVO / ESTÍMULO'].replace(/\n/g, '; ') : '') + (r.LIMITANTES ? ' · ' + r.LIMITANTES : '');
    var g = geminiLlamar_(prompt, 1200, 0.4);
    if (!g.ok) break;
    var txt = g.texto;
    if (txt) { actualizarFila_(HOJAS.MOTOR, r._fila, { CIENCIA: txt.slice(0, 3000), 'ANALIZADO POR': autores_(r['ANALIZADO POR'], 'Gemini'), ACTUALIZADO: ahora_() }); n++; }
  }
  return n;
}
/** Cada madrugada: metcons nuevos de Fabrik, filas pegadas a mano y explicación de Gemini. */
function motorDiario() { return conSalud_('motorDiario', motorDiario_sin_); }
function motorDiario_sin_() {
  var est = [];
  try { v29aDiario_(); } catch (e) { est.push('v29a FALLO ' + e); }
  try { est.push('nuevos ' + alimentarMotor_(2)); } catch (e) { est.push('alimentar FALLO ' + e); }
  try { est.push('reanalizados ' + reanalizarMotor_()); } catch (e) { est.push('reanalizar FALLO ' + e); }
  try { est.push('Gemini ' + geminiExplicar_(8)); } catch (e) { est.push('Gemini FALLO ' + String(e).slice(0, 120)); }
  try { est.push('JSON ' + exportarBdJson_().wods + ' WODs'); } catch (e) { est.push('JSON FALLO ' + String(e).slice(0, 120)); }
  try { avisarCompetis_(); } catch (e) { est.push('competis FALLO ' + String(e).slice(0, 80)); }
  try { est.push('pendientes caducados ' + caducarPendientes_()); } catch (e) { est.push('pendientes FALLO ' + String(e).slice(0, 80)); }
  try { est.push('operación ' + opDiario_()); } catch (e) { est.push('operación FALLO ' + String(e).slice(0, 80)); }
  try { est.push('lesiones IA ' + lesionesIA_(3)); } catch (e) { est.push('lesiones FALLO ' + String(e).slice(0, 80)); }
  try { var kk = indexarKnowledge_(false); est.push('KNOWLEDGE ' + kk.archivos + ' .md' + (kk.igual ? ' (sin cambios)' : ' · ' + kk.secciones + ' secciones')); } catch (e) { est.push('KNOWLEDGE FALLO ' + String(e).slice(0, 120)); }
  try { var ac = aprenderCiclo_(2); est.push('ciclo ' + ac.dias + ' días'); } catch (e) { est.push('ciclo FALLO ' + String(e).slice(0, 120)); }
  try { var lu = lunesDe_(hoyIso_()); est.push('lectura ' + lecturaSemana_(lu)); var ls = lecturaSemana_(sumarDias(lu, 7)); if (ls !== 'sin semana') est.push('lectura sig. ' + ls); } catch (e) { est.push('lectura FALLO ' + String(e).slice(0, 120)); }
  ponerConfig_('ultimo_motor', hoyTxt_() + ' · ' + est.join(' · '), 'Resultado de la tarea diaria del motor (MOTOR · ANÁLISIS)');
}

// ---------- 5 · «Estímulos que quiero» y metcon a medida ----------
function parseDeseo_(txt, G) {
  var t = norm(txt), D = { texto: String(txt || ''), movs: [], ergs: [], patrones: [], intercalar: null, formato: '', min: 0, intensidad: '', equipo: '' };
  detectarMovs_(t, G).forEach(function (x) { (x.m.patron === 'MONO' ? D.ergs : D.movs).push(x.m); });
  var mi = t.match(/INTERCAL[A-Z]*\s+(?:DE\s+|CON\s+|LA\s+|EL\s+)?([A-Z ]{3,40})/) || t.match(/ENTRE (?:RONDAS|SERIES|MOVIMIENTOS)\s*(?:DE\s+|CON\s+)?([A-Z ]{3,40})/);
  if (mi) {
    var e = detectarMovs_(mi[1], G).filter(function (x) { return x.m.patron === 'MONO'; })[0];
    D.intercalar = e ? e.m : /CORR|CARRER|RUN/.test(mi[1]) ? movPorClave_(G, 'RUN') : D.ergs[0] || null;
    if (D.intercalar && D.ergs.indexOf(D.intercalar) < 0) D.ergs.unshift(D.intercalar);
  }
  G.patrones.forEach(function (p) { if (p.palabras.some(function (w) { return aliasEn_(t, w) >= 0; }) && D.patrones.indexOf(p.patron) < 0) D.patrones.push(p.patron); });
  var F = [['VENTANAS', /HEAVY EN VENTANAS|VENTANAS/], ['EVERY', /EVERY|CADA [0-9]/], ['INTERVALOS', /INTERVALO|ON ?\/ ?OFF/], ['EMOM', /EMOM/], ['CHIPPER', /CHIPPER/], ['ESCALERA', /ESCALERA|[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}/],
    ['SPRINT', /SPRINT/], ['FOR_TIME', /FOR TIME|POR TIEMPO/], ['AMRAP', /AMRAP/]];
  for (var i = 0; i < F.length; i++) if (F[i][1].test(t)) { D.formato = F[i][0]; break; }
  var mm = t.match(/([0-9]{1,2})\s*(?:'|′|’|MIN)/) || t.match(/(?:AMRAP|EMOM|CAP|TIME CAP|DE)\s*([0-9]{1,2})(?![0-9])/); if (mm) D.min = +mm[1];
  D.intensidad = /PESAD|HEAVY/.test(t) ? 'pesado' : /POTENCIA|P1|P4|Z6|Z7|Z8/.test(t) ? 'potencia' : /SPRINT|CORTO|RAPIDO/.test(t) ? 'corto' : /LARGO|SOSTENID|AEROBIC|Z3/.test(t) ? 'largo' : '';
  D.equipo = /EQUIPO|TEAM/.test(t) ? 'equipo' : /PAREJA|PAIRS|SINCRO/.test(t) ? 'pareja' : '';
  if (D.formato === 'AMRAP' && D.min) D.formato = D.min <= 10 ? 'AMRAP_C' : D.min <= 20 ? 'AMRAP' : 'AMRAP_L';
  return D;
}
/** Marca más alta (kg) de APP · MARCAS cuyo movimiento contiene «nombre». */
function rmDe_(nombre) {
  var q = norm(nombre).trim(); if (!q) return 0;
  var memo = rmDe_.memo; if (!memo) { try { memo = listar_(HOJAS.MARCAS); } catch (e) { memo = []; } rmDe_.memo = memo; }
  return memo.reduce(function (mx, r) {
    var v = parseFloat(String(r.VALOR || '').replace(',', '.'));
    if (!v || norm(r.MOVIMIENTO).indexOf(q) < 0 || /LB/.test(norm(r.UNIDAD)) || /TIEMPO|REPS|SEG|MIN|CAL/.test(norm(r.UNIDAD) + ' ' + norm(r.TIPO))) return mx;
    return Math.max(mx, v);
  }, 0);
}
function redondea25_(x) { return Math.round(x / 2.5) * 2.5; }
function cargaTxt_(m, pc, dbMat) {
  if (!m.kg && !m.rm) return '';
  var p = m.rm.match(/^(.*?)\s+([0-9]+(?:[.,][0-9]+)?)$/), base = p ? rmDe_(p[1]) : 0, fac = p ? parseFloat(p[2].replace(',', '.')) : 1;
  if (base && (m.mat === 'barra' || !dbMat)) {
    var a = redondea25_(base * fac * pc.min / 100), b = redondea25_(base * fac * pc.max / 100);
    var k = function (x) { return String(x).replace('.', ','); };
    return ' (' + (a === b ? k(a) : k(a) + '–' + k(b)) + ' kg · ' + pc.min + '–' + pc.max + ' % de tu ' + p[1].toLowerCase() + ')';
  }
  if (dbMat) return ' (DB ' + String(Math.min(m.kg || 22.5, 22.5)).replace('.', ',') + ' kg)';
  return m.kg ? ' (RX ' + String(m.kg).replace('.', ',') + ' kg' + (m.rm && pc ? ' · o el ' + pc.min + '–' + pc.max + ' % de tu 1RM' : '') + ')' : '';
}
function repsTxt_(m, f) {
  var v = m.reps * f;
  if (m.unidad === 'cal') return Math.max(5, Math.round(v)) + ' cal ' + m.n;
  if (m.unidad === 'm') { var mt = v >= 100 ? Math.max(100, Math.round(v / 100) * 100) : Math.max(5, Math.round(v / 5) * 5); return mt + ' m ' + m.n; }
  return Math.max(1, Math.round(v)) + ' ' + m.n;
}
/** El WOD de MOTOR · ANÁLISIS que más se parece a lo pedido (≥3 puntos). */
function refMotor_(lista, D, fk) {
  var filas; try { filas = listar_(HOJAS.MOTOR); } catch (e) { return null; }
  var ks = lista.map(function (m) { return m.k; }), ps = lista.map(function (m) { return m.patron; });
  var tok = norm(D.texto).split(/[^A-Z0-9]+/).filter(function (x) { return x.length >= 4; });
  var mejor = null, pm = 0;
  filas.forEach(function (r) {
    var rm = String(r.MOVIMIENTOS || '').split(/\s*,\s*/).filter(Boolean), rp = String(r.PATRONES || '').split(/\s*,\s*/);
    var p = rm.filter(function (k) { return ks.indexOf(k) >= 0; }).length * 2 + rp.filter(function (x) { return x && ps.indexOf(x) >= 0; }).length * 0.5;
    if (fk && r.FORMATO === fk) p += 2;
    var bolsa = norm((r['OBJETIVO / ESTÍMULO'] || '') + ' ' + (r['CONCEPTOS (Ollama)'] || '') + ' ' + (r.LIMITANTES || ''));
    p += Math.min(2, tok.filter(function (x) { return bolsa.indexOf(x) >= 0; }).length * 0.5);
    if (r.CIENCIA) p += 0.3;
    if (p > pm) { pm = p; mejor = r; }
  });
  return mejor && pm >= 3 ? { nombre: mejor.NOMBRE, fuente: mejor.FUENTE, formato: mejor.FORMATO, estructura: mejor.ESTRUCTURA || '', ciencia: mejor.CIENCIA || '', puntos: pm } : null;
}
/** Ordena los movimientos para provocar las interferencias buscadas y no juntar las que se evitan. */
function ordenarInterf_(items, G, primero, quiereAgarre) {
  var resto = items.slice(), seq = [], pares = [];
  var tipo = function (x, y) {
    var rs = G.interf.filter(function (r) { return encaja_(r.a, x) && encaja_(r.b, y) || (r.orden !== 'A>B' && encaja_(r.a, y) && encaja_(r.b, x)); });
    var b = rs.filter(function (r) { return r.tipo === 'buscada'; })[0] || rs.filter(function (r) { return r.tipo === 'complementaria'; })[0] || rs.filter(function (r) { return r.tipo === 'evitar'; })[0];
    return b || null;
  };
  var puntos = function (x, y) { var r = tipo(x, y); if (!r) return 0; return r.tipo === 'buscada' ? 3 : r.tipo === 'complementaria' ? 1 : (quiereAgarre && /agarre/i.test(r.efecto) ? 2 : -4); };
  var ini = null;
  if (primero) resto.forEach(function (y) { if (!ini || puntos(primero, y) > puntos(primero, ini)) ini = y; });
  if (!ini) ini = resto.filter(function (x) { return resto.some(function (y) { return y !== x && puntos(x, y) >= 3; }); })[0] || resto[0];
  while (resto.length) {
    var x = seq.length ? seq[seq.length - 1] : null, sig = ini;
    if (x) { sig = null; resto.forEach(function (y) { if (!sig || puntos(x, y) > puntos(x, sig)) sig = y; }); }
    if (x) { var r = tipo(x, sig); if (r) pares.push({ a: x, b: sig, r: r }); }
    seq.push(sig); resto.splice(resto.indexOf(sig), 1);
  }
  if (primero && seq.length) { var r0 = tipo(primero, seq[0]); if (r0) pares.unshift({ a: primero, b: seq[0], r: r0 }); }
  return { seq: seq, pares: pares };
}
/**
 * Metcon a medida desde «Estímulos que quiero» (ej. «stoh, snatch, oh» o «intercalar carrera, calorías de assault»).
 * o = { min, material: [...] (vacío = box), lunes, formato } → { bloque, formato, referencia, avisos }
 */
function metconGuiado_(deseo, o) {
  o = o || {};
  var G = guiaMotor_(), D = parseDeseo_(deseo || '', G), avisos = [], R = G.reglas;
  var mat = mapaMaterial_(o.material && o.material.length ? o.material : ['box'], true);
  var tiene = function (m) { return !m.mat || mat[m.mat] || (m.alt && mat[m.alt]); };
  var w = {}; try { w = pesoCarencias_(o.lunes || lunesDe_(hoyIso_())); } catch (e) {}
  var movs = D.movs.filter(tiene), sinMat = D.movs.filter(function (m) { return !tiene(m); });
  if (sinMat.length) avisos.push('Sin material para ' + sinMat.map(function (m) { return m.n.toLowerCase(); }).join(', ') + ': no entra.');
  D.patrones.forEach(function (p) {
    if (movs.some(function (m) { return m.patron === p; }) || p === 'MONO') return;
    var c = G.movs.filter(function (m) { return m.patron === p && tiene(m) && movs.indexOf(m) < 0; }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); })[0];
    if (c) movs.push(c);
  });
  var ergs = D.ergs.filter(tiene);
  if (D.patrones.indexOf('MONO') >= 0 && !ergs.length) { var e0 = G.movs.filter(function (m) { return m.patron === 'MONO' && tiene(m); })[0]; if (e0) ergs.push(e0); }
  if (!movs.length) {
    movs = G.movs.filter(function (m) { return m.patron !== 'MONO' && m.c && tiene(m); }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); }).slice(0, ergs.length ? 2 : 3);
    avisos.push((ergs.length ? 'Solo has pedido erg/carrera: ' : 'No he reconocido estímulos en «' + (deseo || '') + '»: ') + 'añado lo que más te falta (' + movs.map(function (m) { return m.n.toLowerCase(); }).join(', ') + ').');
  }
  if (movs.length + ergs.length <= 2) avisos.push('Solo ' + (movs.length + ergs.length) + ' movimientos: añade un erg o «intercalar carrera» si quieres más interferencia.');
  var maxM = +R.max_movs || 4; if (movs.length + ergs.length > maxM + 1) { avisos.push('Demasiados movimientos para un metcon: me quedo con ' + maxM + ' + erg.'); movs = movs.slice(0, maxM); }
  var Tpedido = D.min || +o.min || +R.min_metcon || 12;
  var fk = D.formato || o.formato || '';
  var ref = refMotor_(movs.concat(ergs), D, fk);
  if (!fk && ref && G.formatos[ref.formato]) fk = ref.formato;
  if (!fk) fk = D.intensidad === 'pesado' ? 'VENTANAS' : D.intensidad === 'potencia' ? 'EVERY' : D.intensidad === 'corto' || Tpedido <= 8 ? 'SPRINT' : Tpedido <= 10 ? 'AMRAP_C' : Tpedido <= 20 ? (movs.length >= 5 ? 'CHIPPER' : 'AMRAP') : 'AMRAP_L';
  var F = G.formatos[fk] || G.formatos.AMRAP || { k: 'AMRAP', nombre: 'AMRAP', min: 10, max: 20, repsx: 1, estrategia: '', sistema: '', zona: '', rpe: '8' };
  var T = Math.max(F.min, Math.min(F.max, Math.min(+R.max_metcon || 40, Tpedido)));
  if (T !== Tpedido) avisos.push('El formato ' + F.nombre + ' va de ' + F.min + ' a ' + F.max + '′: lo dejo en ' + T + '′.');
  var pc = G.pesos[fk] || { min: 50, max: 65 };
  var quiereAgarre = D.patrones.indexOf('TIRON') >= 0 && /AGARRE|GRIP/.test(norm(deseo));
  var otrosErg = ergs.filter(function (e) { return e !== D.intercalar; });
  var ord = ordenarInterf_(otrosErg.concat(movs), G, D.intercalar, quiereAgarre), seq = ord.seq;
  var fEq = D.equipo ? (+R.reps_equipo || 0.75) * (D.equipo === 'pareja' ? 2 : 3) : 1, fx = (+F.repsx || 1) * fEq;
  var dbMat = !mat.barra && mat.db;
  var L = function (m, f) { return repsTxt_(m, fx * (f || 1)) + (m.patron === 'MONO' ? '' : cargaTxt_(m, pc, dbMat && m.mat === 'barra')); };
  var inter = D.intercalar ? repsTxt_(D.intercalar, fEq * (D.intercalar.unidad === 'm' ? 0.5 : 0.8)) : '';
  var lineas = [], cab = '';
  var esq = (String(ref && ref.estructura || '').match(/[0-9]{1,3}(?:-[0-9]{1,3}){2,}/) || [])[0] || '21-15-9';
  switch (F.k) {
    case 'EMOM':
      var est = seq.length ? seq : ergs; var vueltas = Math.max(1, Math.floor(T / est.length));
      cab = 'EMOM ' + (vueltas * est.length) + '′ (' + vueltas + ' vueltas)';
      est.forEach(function (m, i) { lineas.push('MIN ' + (i + 1) + ': ' + L(m, 0.5)); });
      if (inter) lineas.push('+ ' + inter + ' al empezar cada minuto impar');
      break;
    case 'EVERY':
      var S = Math.max(3, Math.floor(T / 4)); cab = 'EVERY 4′ × ' + S + ' (60–90″ ON al 90 %, el resto descanso)';
      if (inter) lineas.push(inter);
      seq.slice(0, 3).forEach(function (m) { lineas.push(L(m, 0.7)); });
      break;
    case 'INTERVALOS':
      var Si = Math.max(4, Math.floor(T / 3)); cab = Si + ' × (2′ ON / 1′ OFF)';
      if (inter) lineas.push(inter);
      seq.forEach(function (m) { lineas.push(L(m, 0.5)); });
      lineas.push('Mismas reps en cada serie: la última igual que la primera');
      break;
    case 'VENTANAS':
      var heavy = movs.filter(function (m) { return /OLY|SENT|BISAGRA|OH/.test(m.patron) && (m.mat === 'barra'); })[0] || movs[0];
      var Sv = Math.max(4, Math.floor(T / 2.5)); cab = 'EVERY 2′30″ × ' + Sv + ' · heavy en ventanas';
      var erg = D.intercalar || otrosErg[0]; if (erg) lineas.push(repsTxt_(erg, 0.8));
      if (heavy) lineas.push('2 ' + heavy.n + cargaTxt_(heavy, pc, false) + ' · ventanas impares a la carga baja y pares a la alta');
      seq.filter(function (m) { return m !== heavy && m !== erg; }).slice(0, 1).forEach(function (m) { lineas.push(L(m, 0.4)); });
      break;
    case 'ESCALERA':
      cab = esq + ' · FOR TIME · cap ' + T + '′';
      seq.forEach(function (m) { lineas.push(m.patron === 'MONO' ? repsTxt_(m, 0.8) : m.n + cargaTxt_(m, pc, dbMat && m.mat === 'barra')); });
      if (inter) lineas.push('Tras cada tanda: ' + inter);
      break;
    case 'CHIPPER':
      cab = 'FOR TIME · cap ' + T + '′ · chipper';
      seq.forEach(function (m, i) { lineas.push(L(m, 1.5)); if (inter && i < seq.length - 1) lineas.push('  ' + inter); });
      break;
    case 'SPRINT': case 'FOR_TIME':
      var rondas = F.k === 'SPRINT' ? 2 : Math.max(3, Math.min(6, Math.round(T / 4)));
      cab = rondas + ' RONDAS FOR TIME · cap ' + T + '′';
      if (inter) lineas.push(inter);
      seq.forEach(function (m) { lineas.push(L(m, F.k === 'SPRINT' ? 1 : 0.8)); });
      break;
    default:
      cab = 'AMRAP ' + T + '′' + (D.equipo ? ' · ' + (D.equipo === 'pareja' ? 'en pareja (reparte como queráis)' : 'en equipo') : '');
      if (inter) lineas.push(inter);
      seq.forEach(function (m) { lineas.push(L(m, 1)); });
  }
  var buscadas = ord.pares.filter(function (p) { return p.r.tipo === 'buscada'; }), evitadas = ord.pares.filter(function (p) { return p.r.tipo === 'evitar'; });
  var interTxt = ord.pares.map(function (p) { return p.a.n + ' → ' + p.b.n + ' · ' + p.r.tipo + ': ' + p.r.efecto; });
  var contenido = cab + '\n' + lineas.join('\n') +
    (F.estrategia ? '\n\nESTRATEGIA: ' + F.estrategia : '') +
    (buscadas.length ? '\nINTERFERENCIA QUE BUSCAMOS: ' + buscadas.map(function (p) { return p.a.n.toLowerCase() + ' → ' + p.b.n.toLowerCase(); }).join(' · ') : '') +
    (evitadas.length ? '\nOJO: ' + evitadas.map(function (p) { return p.a.n.toLowerCase() + ' + ' + p.b.n.toLowerCase(); }).join(', ') + ' van seguidos (doble ' + (evitadas[0].r.efecto || 'carga').toLowerCase() + '): rompe antes del fallo' : '');
  var cods = movs.map(function (m) { return m.c; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
  var ciencia = [F.sistema ? F.nombre + ': sistema ' + F.sistema + (F.zona ? ' (' + F.zona + ')' : '') + '.' : '']
    .concat(ord.pares.filter(function (p) { return p.r.ciencia; }).slice(0, 3).map(function (p) { return p.a.n + ' → ' + p.b.n + ': ' + p.r.ciencia; }))
    .concat(ref && ref.ciencia ? ['Del WOD de referencia «' + ref.nombre + '»: ' + String(ref.ciencia).slice(0, 400)] : []).filter(Boolean).join('\n');
  var porque = 'Pediste: «' + String(deseo || '').trim() + '». ' + (ref ? 'Estructura inspirada en «' + ref.nombre + '» (' + ref.fuente + ', MOTOR · ANÁLISIS («Road to Elite · Motor»)). ' : '') +
    (F.cuando ? F.nombre + ': ' + F.cuando.charAt(0).toLowerCase() + F.cuando.slice(1) + '. ' : '') +
    (movs.some(function (m) { return D.movs.indexOf(m) < 0; }) ? 'Añadido por tus carencias: ' + movs.filter(function (m) { return D.movs.indexOf(m) < 0; }).map(function (m) { return m.n.toLowerCase(); }).join(', ') + '.' : '');
  return {
    bloque: { ORIGEN: 'EXTRA', 'TÍTULO': ('METCON A MEDIDA · ' + F.nombre + ' ' + T + '′ · ' + seq.concat(D.intercalar ? [D.intercalar] : []).map(function (m) { return m.n.split(' (')[0]; }).slice(0, 4).join(' + ')).slice(0, 120),
      CONTENIDO: contenido, MIN: T + 10, INTENSIDAD: 'RPE ' + (F.rpe || '8') + (F.zona ? ' · ' + F.zona : ''), 'CÓDIGOS': cods.join('|'),
      'POR QUÉ (cursiva)': porque.trim(), 'CIENCIA (técnica · fisiología · biología)': ciencia, INTERFERENCIAS: interTxt.join('\n') },
    formato: F.k, referencia: ref ? ref.nombre : '', avisos: avisos, entendido: { movimientos: D.movs.map(function (m) { return m.n; }), ergs: D.ergs.map(function (m) { return m.n; }), intercalar: D.intercalar ? D.intercalar.n : '', patrones: D.patrones, formato: D.formato, min: D.min }
  };
}
/** Extras: el metcon a medida entra en el mejor hueco de la semana, en borrador (rehacer los extras lo regenera). */
function extraADeseo_(lunes, deseo) {
  var r = metconGuiado_(deseo, { lunes: lunes, min: 15 }), b = r.bloque;
  var pos = posicionOptima_({ lunes: lunes, campos: b }), h = (pos.mejores || [])[0];
  if (!h) return { ok: false, avisos: r.avisos.concat(['No hay hueco esta semana para el metcon a medida']) };
  var o = Object.assign({}, b, { ID: nuevoId_(), FECHA: isoAFecha(h.iso), 'DÍA': diaDe_(h.iso), TURNO: h.turno, ORDEN: h.turno === 'AM' ? 6 : 85, BLOQUE: b['TÍTULO'], ESTADO: 'BORRADOR',
    GENERADO: 'auto · a medida · ' + String(deseo).slice(0, 60), ACTUALIZADO: ahora_() });
  o['POR QUÉ (cursiva)'] += ' Va el ' + diaDe_(h.iso).toLowerCase() + ' ' + h.turno + ': ' + (h.motivos || []).slice(0, 2).join('; ') + '.';
  anadirFila_(HOJAS.PLAN, o);
  return { ok: true, id: o.ID, dia: diaDe_(h.iso), turno: h.turno, titulo: b['TÍTULO'], avisos: r.avisos };
}
/** Movimientos del mega WOD desde la guía (si falla, los de siempre). */
function movsMega_() {
  try {
    var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    return guiaMotor_().movs.filter(function (m) { return m.patron !== 'MONO'; }).map(function (m) {
      return { re: new RegExp('(^|[^A-Z])(' + m.alias.map(esc).join('|') + ')(ES|S)?([^A-Z]|$)'), n: m.n, mat: m.mat, alt: m.alt, reps: m.unidad === 'm' ? Math.round(m.reps) : m.reps,
        carga: m.mat === 'barra' ? 'barra' : m.mat === 'db' ? 'db' : /sandbag/.test(m.mat) ? 'sandbag' : '', c: m.c, equipo: /gusano|lodge/.test(m.mat), k: m.k, patron: m.patron };
    });
  } catch (e) { Logger.log('movsMega_: ' + e); return MOV_MEGA_; }
}
function ergMegaDe_(m) {
  return { ROW: ['ergos', 'cal ROW'], SKI: ['ergos', 'cal SKI'], ASSAULT: ['ergos', 'cal ASSAULT BIKE'], BIKE: ['ergos', 'cal BIKE ERG'], RUN: ['_correr', 'm RUN'] }[m.k] || null;
}

// ---------- 6 · Backup de los jueves y avisos ----------
var BACKUP_HORA_ = 10, BACKUP_MARGEN_H_ = 6;
function carpetaJueves_() {
  var raiz = DriveApp.getFolderById(CONFIG.BACKUPS_ID), it = raiz.getFoldersByName('APP Road to Elite · jueves');
  return it.hasNext() ? it.next() : raiz.createFolder('APP Road to Elite · jueves');
}
function estructuraMd_(fecha) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID), cf = leerConfig_(), L = [];
  L.push('# Road To Elite · estructura y funcionamiento · ' + fecha, '', 'Servidor ' + CONFIG.VERSION + ' · generado automáticamente por el backup de los jueves.', '');
  L.push('## Cómo funciona', '',
    '- **Web** (GitHub Pages, repo `pComader/road-to-elite`): PWA que habla con el servidor de Apps Script (`doPost` → `accion_`). Solo entra ' + CONFIG.EMAIL_PERMITIDO + ' (token de Firebase verificado).',
    '- **Servidor** (Apps Script): lee FABRIK PROGRAM (solo lectura), escribe en este Sheet (Training Coverage) y en Google Calendar (solo lo aprobado).',
    '- **Semana:** domingo 22:15 cierre + ajuste de carrera + vídeos + copia del Sheet → 23:15 carga Fabrik → confirmar semana → «Cargar extras» (metas, carrera, refuerzos, pendientes, metcon a medida) → aprobar (correo de estímulos).',
    '- **Motor:** las tablas de MOTOR_GUIA.md (movimientos, formatos, pesos, interferencias) + MOTOR · ANÁLISIS («Road to Elite · Motor») (metcons de Fabrik y competición analizados; ciencia de Claude/Gemini; conceptos de Ollama).',
    '- **Reestructurar:** viaje (intensidad al alza), reorganización (clásica o mega WOD) y competi (online/física).',
    '- **Backups:** domingo copia del Sheet (Drive) · jueves ' + BACKUP_HORA_ + ':00 backup completo (xlsx + este .md + guía + código) en Drive › Backups › «APP Road to Elite · jueves»; el agente del PC lo copia a E:\\2DO CEREBRO\\BackUPS\\APP Road to Elite. Si a las ' + (BACKUP_HORA_ + BACKUP_MARGEN_H_) + ':00 falta algo: correo, aviso en la app y ventana en el PC.', '');
  L.push('## Pestañas', '', '| Pestaña | Visible | Filas | Columnas |', '|---|---|---|---|');
  ss.getSheets().forEach(function (h) {
    var cab = h.getLastColumn() ? h.getRange(1, 1, 1, Math.min(h.getLastColumn(), 40)).getDisplayValues()[0].filter(String) : [];
    L.push('| ' + h.getName() + ' | ' + (h.isSheetHidden() ? 'no' : 'sí') + ' | ' + Math.max(0, h.getLastRow() - 1) + ' | ' + cab.join(', ').replace(/\|/g, '/').slice(0, 600) + ' |');
  });
  L.push('', '## APP · CONFIG', '', '| Clave | Valor |', '|---|---|');
  Object.keys(cf).sort().forEach(function (k) { if (k === 'ultimo_configurar') return; L.push('| ' + k + ' | ' + String(cf[k]).replace(/\n/g, ' ').replace(/\|/g, '/').slice(0, 200) + ' |'); });
  L.push('', '## Disparadores', '');
  ScriptApp.getProjectTriggers().forEach(function (t) { L.push('- ' + t.getHandlerFunction() + ' · ' + t.getEventType()); });
  L.push('', '## Propiedades del script (solo nombres; los valores nunca salen del servidor)', '', PROPS.getKeys().sort().map(function (k) { return '`' + k + '`'; }).join(' · '));
  L.push('', '## Identificadores', '', '- Sheet: `' + CONFIG.SHEET_ID + '`', '- Carpeta de backups: `' + CONFIG.BACKUPS_ID + '`', '- Motor (propio): `' + (cf.motor_bd_id || '—') + '`', '- Base_de_datos_WOD (app de Gabi, solo lectura): `' + (cf.bd_wods_id || CONFIG.BD_WOD_ID) + '`', '- MOTOR_GUIA.md: `' + (cf.motor_guia_id || '—') + '`', '- Web: ' + CONFIG.URL_APP);
  L.push('', '## Cómo restaurar', '',
    '1. Sheet: abre el .xlsx del zip en Google Drive («Abrir con Hojas de cálculo») o usa la copia del domingo; cambia `SHEET_ID` en CONFIG del código si es un archivo nuevo.',
    '2. Servidor: pega `apps-script/Code.gs` del zip del código en el editor de Apps Script, ejecuta `configurar` y crea una versión nueva de la implementación.',
    '3. Web: el zip del código es el repositorio completo; súbelo a GitHub Pages.',
    '4. Secretos (FCM_CUENTA, GEMINI_KEY, AGENTE_TOKEN): no están en el backup a propósito; vuelve a crearlos en Propiedades del script.');
  return L.join('\n');
}
function backupJueves() { return conSalud_('backupJueves', backupJueves_sin_); }
function backupJueves_sin_() {
  var f = carpetaJueves_(), fecha = hoyIso_(), blobs = [], notas = [];
  var xl = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (xl.getResponseCode() !== 200) throw new Error('exportar el Sheet: HTTP ' + xl.getResponseCode());
  blobs.push(xl.getBlob().setName('Road_to_Elite_Training_Coverage_' + fecha + '.xlsx'));
  var md = estructuraMd_(fecha);
  blobs.push(Utilities.newBlob(md, 'text/markdown', 'Road_to_Elite_ESTRUCTURA_' + fecha + '.md'));
  blobs.push(Utilities.newBlob(guiaTexto_(), 'text/markdown', 'MOTOR_GUIA.md'));
  try {
    var bx = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + motorLibro_().getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (bx.getResponseCode() === 200) blobs.push(bx.getBlob().setName('Road_to_Elite_Motor_WODs_' + fecha + '.xlsx')); else notas.push('BD HTTP ' + bx.getResponseCode());
    blobs.push(Utilities.newBlob(JSON.stringify(datosBdJson_(), null, 1), 'application/json', 'motor_wods_' + fecha + '.json'));
    var bv = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + videosLibro_().getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (bv.getResponseCode() === 200) blobs.push(bv.getBlob().setName('Base_de_datos_Videos_' + fecha + '.xlsx'));
  } catch (e) { notas.push('BD: ' + e); }
  try {
    var gh = UrlFetchApp.fetch('https://codeload.github.com/pComader/road-to-elite/zip/refs/heads/main', { muteHttpExceptions: true });
    if (gh.getResponseCode() === 200) blobs.push(gh.getBlob().setName('codigo_road-to-elite_main.zip')); else notas.push('código HTTP ' + gh.getResponseCode());
  } catch (e) { notas.push('código: ' + e); }
  var zip = f.createFile(Utilities.zip(blobs, 'Road_to_Elite_backup_' + fecha + '.zip'));
  var fmd = f.createFile(Utilities.newBlob(md, 'text/markdown', 'Road_to_Elite_ESTRUCTURA_' + fecha + '.md'));
  // se guardan los 10 últimos (los suyos; nada más de la carpeta)
  var viejos = [];
  [/^Road_to_Elite_backup_\d{4}-\d{2}-\d{2}\.zip$/, /^Road_to_Elite_ESTRUCTURA_\d{4}-\d{2}-\d{2}\.md$/].forEach(function (re) {
    var l = [], it = f.getFiles(); while (it.hasNext()) { var x = it.next(); if (re.test(x.getName())) l.push(x); }
    l.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; }).slice(10).forEach(function (x) { viejos.push(x); });
  });
  viejos.forEach(function (x) { x.setTrashed(true); });
  ponerConfig_('backup_jueves', fecha + ' · ' + zip.getId() + ' · ' + fmd.getId() + (notas.length ? ' · ' + notas.join(' · ') : ''), 'Último backup completo de los jueves en Drive (zip · md). El agente del PC lo copia a E:\\2DO CEREBRO\\BackUPS');
  try { revisarBackup_(); } catch (e) { Logger.log('revisarBackup_: ' + e); }
  return { fecha: fecha, zip: zip.getId(), md: fmd.getId(), kb: Math.round(zip.getSize() / 1024) };
}
/** El jueves que ya debería estar hecho (hoy si es jueves ≥16:00, o el anterior) y cómo están Drive y el PC. */
function estadoBackup_() {
  var cf = leerConfig_(), hoy = hoyIso_(), jue = sumarDias(lunesDe_(hoy), 3), hora = +Utilities.formatDate(new Date(), CONFIG.ZONA, 'H');
  var req = hoy > jue || (hoy === jue && hora >= BACKUP_HORA_ + BACKUP_MARGEN_H_) ? jue : sumarDias(jue, -7);
  var dr = String(cf.backup_jueves || '').slice(0, 10), pc = String(cf.backup_pc || '').slice(0, 10), desde = String(cf.backup_desde || '').slice(0, 10);
  var partes = String(cf.backup_jueves || '').split(' · ');
  return { requerido: req, drive: dr, pc: pc, driveOk: dr >= req, pcOk: pc >= req, exento: !!desde && req < desde,
    zipId: partes[1] || '', mdId: partes[2] || '', alerta: cf.backup_alerta || '' };
}
function revisarBackup_() {
  var e = estadoBackup_(), cf = leerConfig_(), hoy = hoyIso_();
  if (e.exento) { if (cf.backup_alerta) ponerConfig_('backup_alerta', ''); return e; }
  if (!e.driveOk && PROPS.getProperty('BACKUP_REINTENTO') !== hoy) {
    PROPS.setProperty('BACKUP_REINTENTO', hoy);
    try { backupJueves(); return estadoBackup_(); } catch (x) { e.error = String(x && x.message || x).slice(0, 160); }
  }
  var falta = [];
  if (!e.driveOk) falta.push('Google Drive' + (e.error ? ' (' + e.error + ')' : ''));
  if (!e.pcOk) falta.push('tu PC (E:\\2DO CEREBRO\\BackUPS: el PC estaba apagado o el agente no ha podido copiarlo)');
  if (!falta.length) { if (cf.backup_alerta) ponerConfig_('backup_alerta', ''); return e; }
  var txt = 'Backup del jueves ' + isoAFecha(e.requerido) + ' sin hacer en ' + falta.join(' y ') + '.';
  if (cf.backup_alerta !== txt) ponerConfig_('backup_alerta', txt, 'Aviso de backup pendiente (la app y el PC lo muestran; se borra solo al hacerse)');
  var marca = e.requerido + '|' + falta.length + '|' + (!e.driveOk) + (!e.pcOk);
  if (PROPS.getProperty('BACKUP_MAIL') !== marca) {
    try {
      MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, subject: 'Road To Elite · backup del jueves sin hacer', name: 'Road To Elite',
        htmlBody: '<p>' + esc_(txt) + '</p><ul>' + (!e.driveOk ? '<li>Drive: abre el Sheet › menú Road To Elite › «Backup completo ahora».</li>' : '') +
          (!e.pcOk ? '<li>PC: enciéndelo con sesión iniciada; el agente lo copia en la hora siguiente (o ejecuta «Agente PC\\ejecutar ahora.bat»).</li>' : '') +
          '</ul><p>El aviso desaparece de la app y del PC en cuanto se hace.</p>' });
      PROPS.setProperty('BACKUP_MAIL', marca);
    } catch (x) { Logger.log('Correo backup: ' + x); }
  }
  return e;
}

// ---------- 7 · Agente del PC (Ollama + copia del backup + ventana de aviso) ----------
var ACC_AGENTE_ = ['agente_estado', 'agente_wods', 'agente_conceptos', 'agente_backup', 'agente_backup_ok'];
function accionAgente_(body) {
  var tok = PROPS.getProperty('AGENTE_TOKEN'), cache = CacheService.getScriptCache(), fallos = +(cache.get('agente_fallos') || 0);
  if (fallos > 30) return { ok: false, error: 'bloqueado' };
  if (!tok || String(body.agente || '').length < 20 || String(body.agente) !== tok) { cache.put('agente_fallos', String(fallos + 1), 3600); return { ok: false, error: 'no_autorizado' }; }
  if (ACC_AGENTE_.indexOf(body.action) < 0) return { ok: false, error: 'accion_no_permitida' };
  switch (body.action) {
    case 'agente_estado':
      var e = revisarBackup_(), cf = leerConfig_();
      return { ok: true, version: CONFIG.VERSION, backup: { requerido: e.requerido, drive: e.drive, pc: e.pc, driveOk: e.driveOk, pcOk: e.pcOk, exento: e.exento }, alerta: cf.backup_alerta || '' };
    case 'agente_wods':
      return { ok: true, wods: listar_(HOJAS.MOTOR).filter(function (r) { return r.TEXTO && !String(r['CONCEPTOS (Ollama)'] || '').trim(); }).slice(0, Math.min(+body.max || 3, 10))
        .map(function (r) { return { id: r.ID, nombre: r.NOMBRE, fuente: r.FUENTE, texto: r.TEXTO, formato: r.FORMATO, movimientos: r.MOVIMIENTOS, interferencias: r.INTERFERENCIAS, objetivo: r['OBJETIVO / ESTÍMULO'], ciencia: r.CIENCIA }; }), vocab: vocabKnowledge_(40) };
    case 'agente_conceptos':
      var x = listar_(HOJAS.MOTOR).filter(function (r) { return r.ID === String(body.id || ''); })[0];
      if (!x) return { ok: false, error: 'no_encontrado' };
      actualizarFila_(HOJAS.MOTOR, x._fila, { 'CONCEPTOS (Ollama)': String(body.conceptos || '').replace(/[=+@]/g, ' ').slice(0, 1500), 'ANALIZADO POR': autores_(x['ANALIZADO POR'], 'Ollama'), ACTUALIZADO: ahora_() });
      return { ok: true };
    case 'agente_backup':
      var st = estadoBackup_();
      if (!st.zipId) return { ok: false, error: 'sin_backup' };
      var z = DriveApp.getFileById(st.zipId), b64 = Utilities.base64Encode(z.getBlob().getBytes()), T = 900000, n = Math.ceil(b64.length / T);
      var out = { ok: true, fecha: st.drive, nombre: z.getName(), partes: n, kb: Math.round(z.getSize() / 1024) };
      if (body.parte == null) { out.md = st.mdId ? DriveApp.getFileById(st.mdId).getBlob().getDataAsString('UTF-8') : ''; out.mdNombre = st.mdId ? DriveApp.getFileById(st.mdId).getName() : ''; }
      else { var i = Math.max(0, Math.min(n - 1, +body.parte || 0)); out.parte = i; out.datos = b64.slice(i * T, (i + 1) * T); }
      return out;
    case 'agente_backup_ok':
      var f = String(body.fecha || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return { ok: false, error: 'fecha' };
      ponerConfig_('backup_pc', f + ' · copiado ' + ahora_() + ' · ' + String(body.ruta || '').slice(0, 160), 'Último backup de los jueves copiado al PC por el agente');
      var e2 = revisarBackup_();
      return { ok: true, alerta: leerConfig_().backup_alerta || '', pcOk: e2.pcOk };
  }
}
function prepararMotor_() {
  var cf = leerConfig_();
  if (!PROPS.getProperty('AGENTE_TOKEN')) PROPS.setProperty('AGENTE_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12));
  if (!cf.motor_guia_id) {
    var g = DriveApp.getFolderById(CONFIG.BACKUPS_ID).createFile(Utilities.newBlob(MOTOR_GUIA_BASE_, 'text/markdown', 'MOTOR_GUIA.md'));
    ponerConfig_('motor_guia_id', g.getId(), 'ID en Drive de MOTOR_GUIA.md (la guía que sigue el motor; edítala y se relee en 6 h o con configurar)');
  }
  CacheService.getScriptCache().remove('guia_md_v15'); GUIA_MEMO_ = null;
  if (!cf.gemini_modelo || /^gemini-2\./.test(String(cf.gemini_modelo))) ponerConfig_('gemini_modelo', GEMINI_DEF_, 'Modelo de Gemini para la CIENCIA de MOTOR · ANÁLISIS (clave en Propiedades › GEMINI_KEY; nivel gratuito)');
  if (!cf.backup_desde) ponerConfig_('backup_desde', hoyIso_(), 'Desde cuándo se exige el backup de los jueves');
  var r = ['guía ' + guiaMotor_().movs.length + ' movimientos · ' + Object.keys(guiaMotor_().formatos).length + ' formatos · ' + guiaMotor_().interf.length + ' interferencias'];
  r.push('semillas ' + sembrarMotorWods_());
  try { r.push('Fabrik ' + alimentarMotor_(16)); } catch (e) { r.push('Fabrik FALLO ' + e); }
  try { var kn = indexarKnowledge_(true); r.push('KNOWLEDGE ' + kn.archivos + ' .md / ' + kn.secciones + ' secciones'); } catch (e) { r.push('KNOWLEDGE FALLO ' + e); }
  try { var ap = aprenderCiclo_(16); r.push('ciclo ' + ap.dias + ' días · ' + ap.perfiles + ' perfiles'); } catch (e) { r.push('ciclo FALLO ' + e); }
  try { r.push('reanalizados ' + reanalizarMotor_()); } catch (e) { r.push('reanalizar FALLO ' + e); }
  if (!String(leerConfig_().backup_jueves || '')) { try { var bj = backupJueves(); r.push('primer backup ' + bj.kb + ' KB'); } catch (e) { r.push('backup FALLO ' + e); } }
  r.push(PROPS.getProperty('GEMINI_KEY') ? 'Gemini con clave' : 'Gemini sin clave (falta GEMINI_KEY)');
  return r.join(' · ');
}
function menuMotorAhora() { SpreadsheetApp.getActive().toast('Nuevos ' + alimentarMotor_(4) + ' · reanalizados ' + reanalizarMotor_(), 'Motor'); }
function menuGemini() { SpreadsheetApp.getActive().toast('Explicados por Gemini: ' + geminiExplicar_(8), 'Motor'); }
function menuBackupAhora() { var r = backupJueves(); SpreadsheetApp.getActive().toast('Backup ' + r.fecha + ' · ' + r.kb + ' KB en Drive › Backups › APP Road to Elite · jueves', 'Backup'); }
function menuTokenAgente() {
  var t = PROPS.getProperty('AGENTE_TOKEN') || '(ejecuta configurar)';
  SpreadsheetApp.getUi().alert('Token del agente del PC', 'Cópialo y pégalo cuando te lo pida «instalar.bat».\nNo lo compartas con nadie (tampoco con Claude):\n\n' + t, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ===================== v0.16 · BASE DE DATOS DE WODs COMPARTIDA (Base_de_datos_WOD) =====================
/*
 * v0.17: el análisis del motor vive en un libro PROPIO («Road to Elite · Motor»). Base_de_datos_WOD (app de Gabi) solo se LEE.
 * Esa hoja la rellena también la app de Gabi (pestañas «Ciclo …», una por competición, «Resultados archivados», INICIO):
 * Road To Elite NUNCA escribe, renombra ni borra esas pestañas: solo LEE «Ciclo …» (historial de Fabrik) y las de competición.
 * Cada fila lleva PROCEDENCIA y PERMISO: «personal» (programación de Fabrik, tus WODs) o «compartible» (competiciones públicas, benchmarks).
 * Otras apps: motor_wods.json (carpeta de backups de Road To Elite) o API de solo lectura con su token (solo filas «compartible»).
 */
var BD_ = null;
function bdWodsId_() { var id = ''; try { id = leerConfig_().bd_wods_id; } catch (e) {} return String(id || CONFIG.BD_WOD_ID).trim(); }
function bdWods_() { if (!BD_) BD_ = SpreadsheetApp.openById(bdWodsId_()); return BD_; }   // SOLO LECTURA: la hoja de la app de Gabi
/** v0.17 · El análisis del motor vive en un libro PROPIO de Road To Elite («Road to Elite · Motor», CONFIG › motor_bd_id). Nada se escribe en Base_de_datos_WOD. */
var MOTOR_LIBRO_ = null;
function motorLibro_() {
  if (MOTOR_LIBRO_) return MOTOR_LIBRO_;
  var id = ''; try { id = leerConfig_().motor_bd_id; } catch (e) {}
  if (!id) throw new Error('Falta el libro del motor: ejecuta configurar');
  MOTOR_LIBRO_ = SpreadsheetApp.openById(String(id).trim());
  return MOTOR_LIBRO_;
}
var VERSION_GUIA_ = '';
function versionGuia_() { if (!VERSION_GUIA_) VERSION_GUIA_ = 'g-' + hashTxt_(guiaTexto_()).slice(0, 6); return VERSION_GUIA_; }
function metaBd_(procedencia, permiso) { return { PROCEDENCIA: procedencia, PERMISO: permiso, 'VERSIÓN GUÍA': versionGuia_(), IDIOMA: 'es' }; }
function esPestanaGabi_(n) { return n === 'INICIO' || /^Ciclo /.test(n) || n === 'Resultados archivados'; }
/**
 * Lo que vuelca la app de Gabi en Base_de_datos_WOD (SOLO LECTURA; cabecera en la fila 3):
 *  · «Ciclo dd/mm/aaaa»: todos los metcons de Fabrik con fase, semana, atletas, composición y material → historial completo.
 *  · Una pestaña por competición: cada WOD en cada nivel → se toma RX (o el primero si no hay RX), «compartible».
 * Los metcons que ya están (mismo texto, o misma fecha y mismos movimientos que la lectura directa de Fabrik) no se repiten.
 */
function leerVuelcoGabi_(ya, yaFecha) {
  var out = [];
  bdWods_().getSheets().forEach(function (sh) {
    var n = sh.getName(); if (n === 'INICIO' || n === 'Resultados archivados' || /^MOTOR ·/.test(n) || sh.getLastRow() < 4) return;
    var v = sh.getRange(3, 1, sh.getLastRow() - 2, Math.max(1, sh.getLastColumn())).getDisplayValues(), cab = v[0].map(function (h) { return String(h).trim(); });
    var c = function (h) { return cab.indexOf(h); }, g = function (r, h) { return c(h) >= 0 ? String(r[c(h)] || '').trim() : ''; };
    if (c('METCON') < 0) return;
    var ciclo = /^Ciclo /.test(n), filas = v.slice(1).filter(function (r) { return g(r, 'METCON'); });
    if (!ciclo) {
      if (c('NIVEL') < 0) return;
      var porWod = {}; filas.forEach(function (r) { var k = g(r, 'WOD') + '|' + g(r, 'NOMBRE'); if (!porWod[k] || /^RX$/i.test(g(r, 'NIVEL'))) porWod[k] = r; });
      filas = Object.keys(porWod).map(function (k) { return porWod[k]; });
    }
    filas.forEach(function (r) {
      var txt = g(r, 'METCON'), h = hashTxt_(txt); if (ya[h]) return;
      var a = analizarWod_(txt, {}), kf = g(r, 'FECHA') + '|' + a.MOVIMIENTOS;
      if (ciclo && yaFecha[kf]) return;
      ya[h] = 1; yaFecha[kf] = 1;
      var etiquetas = ['ATLETAS', 'COMPOSICIÓN', 'MATERIAL'].map(function (k) { return g(r, k) ? k.charAt(0) + k.slice(1).toLowerCase() + ': ' + g(r, k) : ''; }).filter(Boolean).join(' · ');
      out.push(Object.assign(a, { ID: 'MW-' + h.slice(0, 8), FUENTE: ciclo ? 'Fabrik' : 'Competición', FECHA: g(r, 'FECHA'),
        NOMBRE: (ciclo ? n + ' · ' + g(r, 'FASE') + ' · ' + g(r, 'SEMANA') + ' · ' + g(r, 'DÍA') + ' · ' + (g(r, 'TÍTULO') || 'METCON') : n + ' · WOD ' + g(r, 'WOD') + ' · ' + g(r, 'NOMBRE') + ' (' + g(r, 'NIVEL') + ')').replace(/( · )+/g, ' · ').slice(0, 160),
        'OBJETIVO / ESTÍMULO': [a['OBJETIVO / ESTÍMULO'], etiquetas].filter(Boolean).join('\n'), TEXTO: String(txt).slice(0, 4000), HASH: h, 'ANALIZADO POR': 'Motor', ACTUALIZADO: ahora_() },
        metaBd_(ciclo ? 'Fabrik vía app de Gabi (' + n + ')' : 'Competición pública vía app de Gabi (' + n + ')', ciclo ? 'personal' : 'compartible')));
    });
  });
  return out;
}
function prepararBd_() {
  var r = [], cf = leerConfig_();
  if (!cf.bd_wods_id) ponerConfig_('bd_wods_id', CONFIG.BD_WOD_ID, 'Base_de_datos_WOD de la app de Gabi: Road To Elite SOLO la lee (ciclos y competiciones)');
  else ponerConfig_('bd_wods_id', cf.bd_wods_id, 'Base_de_datos_WOD de la app de Gabi: Road To Elite SOLO la lee (ciclos y competiciones)');
  // 1 · libro propio del motor
  if (!cf.motor_bd_id) {
    var nuevo = SpreadsheetApp.create('Road to Elite · Motor'), f = DriveApp.getFileById(nuevo.getId());
    try { var padre = DriveApp.getFileById(CONFIG.SHEET_ID).getParents(); if (padre.hasNext()) f.moveTo(padre.next()); } catch (e) { Logger.log('Mover libro del motor: ' + e); }
    ponerConfig_('motor_bd_id', nuevo.getId(), 'Libro propio del motor de Road To Elite (MOTOR · ANÁLISIS). Independiente de la app de Gabi');
    MOTOR_LIBRO_ = nuevo; r.push('creado «Road to Elite · Motor»');
  }
  var ss = motorLibro_();
  prepararEsquema_(ss, ESQ_BD_);
  var mo = ss.getSheetByName(HOJAS.MOTOR); if (mo && mo.isSheetHidden()) mo.showSheet();
  var h1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1'); if (h1 && ss.getSheets().length > 1) ss.deleteSheet(h1);
  // 2 · traer lo que la v0.16 dejó en la hoja de Gabi (pestaña oculta MOTOR · ANÁLISIS) y quitar esa pestaña, que es de Road To Elite
  var migrar = function (libro, nombre, etiqueta) {
    var vieja = libro.getSheetByName(nombre); if (!vieja) return;
    var n = vieja.getLastRow() - 1;
    if (n > 0) {
      var cabV = cabeceras_(vieja), datos = vieja.getRange(2, 1, n, cabV.length).getValues(), ya = {};
      listar_(HOJAS.MOTOR).forEach(function (x) { if (x.HASH) ya[x.HASH] = 1; });
      var filas = datos.map(function (row) { var o = {}; cabV.forEach(function (h, k) { o[h] = row[k]; }); return o; }).filter(function (o) { return o.HASH && !ya[o.HASH]; });
      var movidas = filasEnHoja_(HOJAS.MOTOR, filas);
      var tienen = {}; listar_(HOJAS.MOTOR).forEach(function (x) { if (x.HASH) tienen[x.HASH] = 1; });
      var todas = datos.every(function (row) { var hh = row[cabV.indexOf('HASH')]; return !hh || tienen[hh]; });
      if (todas) { libro.deleteSheet(vieja); r.push(etiqueta + ': ' + movidas + ' filas traídas y pestaña quitada'); }
      else r.push('AVISO: ' + etiqueta + ' no se ha copiado entera; la pestaña se conserva');
    } else { libro.deleteSheet(vieja); r.push(etiqueta + ': vacía, quitada'); }
  };
  try { migrar(bdWods_(), HOJAS.MOTOR, 'Base_de_datos_WOD › MOTOR · ANÁLISIS'); } catch (e) { r.push('AVISO migración desde la hoja de Gabi: ' + e); }
  try { migrar(miLibro_(), 'APP · MOTOR WODS', 'APP · MOTOR WODS'); } catch (e) { r.push('AVISO migración APP · MOTOR WODS: ' + e); }
  // 3 · permiso por defecto
  listar_(HOJAS.MOTOR).filter(function (x) { return !x.PERMISO; }).forEach(function (x) {
    actualizarFila_(HOJAS.MOTOR, x._fila, metaBd_(x.FUENTE === 'Competición' ? 'Competición pública / benchmark' : 'Fabrik (programación de Gabi)', x.FUENTE === 'Competición' ? 'compartible' : 'personal'));
  });
  if (!PROPS.getProperty('BD_LECTURA_TOKEN')) PROPS.setProperty('BD_LECTURA_TOKEN', Utilities.getUuid().replace(/-/g, ''));
  r.push(ss.getName() + ' · ' + listar_(HOJAS.MOTOR).length + ' WODs');
  return r.join(' · ');
}
function datosBdJson_() {
  var cab = ESQ_BD_[HOJAS.MOTOR].cab.filter(function (h) { return h !== 'HASH'; });
  return { esquema: 'road-to-elite/motor-wods', version: 1, generado: new Date().toISOString(), servidor: CONFIG.VERSION, guia: versionGuia_(), columnas: cab,
    wods: listar_(HOJAS.MOTOR).map(function (r) { var o = {}; cab.forEach(function (h) { if (r[h] !== '' && r[h] != null) o[h] = r[h]; }); return o; }) };
}
/** motor_wods.json en la carpeta de backups de Road To Elite (se sobrescribe). Para cualquier otra app que tenga tu Drive. */
function exportarBdJson_() {
  var d = datosBdJson_(), txt = JSON.stringify(d, null, 1), carpeta = DriveApp.getFolderById(CONFIG.BACKUPS_ID), it = carpeta.getFilesByName('motor_wods.json');
  if (it.hasNext()) it.next().setContent(txt); else carpeta.createFile('motor_wods.json', txt, 'application/json');
  return { wods: d.wods.length };
}
/** API de solo lectura para otras apps: { bd: token, action: 'bd_wods' | 'bd_guia', desde?: 'dd/mm/aaaa…' }. Solo filas «compartible». */
function accionBd_(body) {
  var tok = PROPS.getProperty('BD_LECTURA_TOKEN'), cache = CacheService.getScriptCache(), fallos = +(cache.get('bd_fallos') || 0);
  if (fallos > 30) return { ok: false, error: 'bloqueado' };
  if (!tok || String(body.bd) !== tok) { cache.put('bd_fallos', String(fallos + 1), 3600); return { ok: false, error: 'no_autorizado' }; }
  if (body.action === 'bd_guia') return { ok: true, guia: guiaTexto_(), version: versionGuia_() };
  if (body.action !== 'bd_wods') return { ok: false, error: 'accion_no_permitida' };
  var d = datosBdJson_();
  d.wods = d.wods.filter(function (w) { return w.PERMISO === 'compartible'; });
  return Object.assign({ ok: true }, d);
}
function menuTokenBd() {
  var t = PROPS.getProperty('BD_LECTURA_TOKEN') || '(ejecuta configurar)';
  SpreadsheetApp.getUi().alert('Token de lectura · base de datos de WODs', 'Para otras apps (solo lectura, solo filas «compartible»):\nPOST a la URL del servidor con { "bd": "<token>", "action": "bd_wods" }\n\n' + t, SpreadsheetApp.getUi().ButtonSet.OK);
}
function menuNuevoTokenAgente() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Cambiar el token del agente', 'El agente de cualquier PC con el token antiguo deja de funcionar hasta que vuelvas a ejecutar instalar.bat con el nuevo. ¿Seguro?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PROPS.setProperty('AGENTE_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12));
  menuTokenAgente();
}

// ===================== v0.18 · BASE DE DATOS DE VÍDEOS COMPARTIDA (Drive › 2DO CEREBRO) =====================
/*
 * «Base de datos Vídeos» (CONFIG.VIDEOS_BD_ID): un solo sitio con los vídeos de técnica que leen las apps de Pablo.
 *   VÍDEOS: EJERCICIO · ALIAS (;) · VÍDEO (url) · ESTADO (OK / ROTO / REVISAR / SIN COMPROBAR) · ÚLTIMA REVISIÓN · DETALLE · FUENTE · APROBADO POR · ALTA · ACTUALIZADO
 *   REVISIONES: registro de cada revisión de enlaces.
 * La app de Gabi añade aquí los martes a las 05:00 lo que falte de su DICCIONARIO. Road To Elite la prepara, la lee los martes a las 06:00
 * (videosMartes: comprueba lo nuevo y, cada CONFIG › videos_revision_dias = 7 o 14 días, todos los enlaces). Los ROTO no se muestran en la app y te llega un correo.
 */
HOJAS.VIDEOS = 'VÍDEOS'; HOJAS.VID_REV = 'REVISIONES';
var ESQ_VID_ = {};
ESQ_VID_[HOJAS.VIDEOS] = { cab: ['EJERCICIO', 'ALIAS', 'VÍDEO', 'ESTADO', 'ÚLTIMA REVISIÓN', 'DETALLE', 'FUENTE', 'APROBADO POR', 'ALTA', 'ACTUALIZADO'],
  anchos: [220, 220, 320, 110, 120, 260, 180, 120, 90, 130], negrita: 'EJERCICIO', color: '#0ea5e9',
  listas: { ESTADO: ['OK', 'ROTO', 'REVISAR', 'SIN COMPROBAR'] }, colores: [['ESTADO', '^ROTO$', '#fde2e2', '#7f1d1d'], ['ESTADO', '^REVISAR$', '#fef3c7', '#78350f'], ['ESTADO', '^OK$', '#dcfce7', '#14532d']] };
ESQ_VID_[HOJAS.VID_REV] = { cab: ['FECHA', 'REVISADOS', 'OK', 'ROTOS', 'REVISAR', 'DETALLE'], anchos: [130, 80, 60, 60, 70, 600], color: '#0ea5e9' };
var VID_LIBRO_ = null;
function videosLibro_() {
  if (VID_LIBRO_) return VID_LIBRO_;
  var id = ''; try { id = leerConfig_().videos_bd_id; } catch (e) {}
  VID_LIBRO_ = SpreadsheetApp.openById(String(id || CONFIG.VIDEOS_BD_ID).trim());
  return VID_LIBRO_;
}
var LEEME_VID_ = [['🎬 Base de datos de vídeos · compartida por las apps de Pablo'], [''],
  ['• VÍDEOS: un ejercicio por fila. ALIAS separados por «;». La app busca el vídeo por el nombre del ejercicio o por sus alias.'],
  ['• ESTADO lo pone la revisión automática de enlaces (cada semana o cada dos): OK · ROTO (el vídeo ya no existe; no se muestra) · REVISAR (privado, sin acceso o error puntual) · SIN COMPROBAR.'],
  ['• Para arreglar uno ROTO: cambia la URL y pon ESTADO = SIN COMPROBAR; la próxima revisión lo valida.'],
  ['• La app de Gabi añade aquí los martes a las 05:00 los ejercicios de su DICCIONARIO que falten. Road To Elite lee de aquí los martes a las 06:00 y revisa los enlaces. Otras apps pueden leer y añadir filas.'],
  ['• No cambies el nombre de las pestañas ni de las columnas.']];
function prepararVideos_() {
  var cf = leerConfig_(), r = [];
  if (!cf.videos_bd_id) ponerConfig_('videos_bd_id', CONFIG.VIDEOS_BD_ID, 'Base de datos Vídeos (Drive › 2DO CEREBRO): la leen las apps de Pablo; Road To Elite la sincroniza y revisa los enlaces');
  if (!cf.videos_revision_dias) ponerConfig_('videos_revision_dias', '7', 'Cada cuántos días se revisan los enlaces de los vídeos (7 o 14)');
  var ss = videosLibro_();
  prepararEsquema_(ss, ESQ_VID_);
  var le = ss.getSheetByName('LÉEME') || ss.insertSheet('LÉEME', 0);
  le.clear(); le.getRange(1, 1, LEEME_VID_.length, 1).setValues(LEEME_VID_); le.getRange(1, 1).setFontWeight('bold').setFontSize(14); le.setColumnWidth(1, 1000);
  ['Hoja 1', 'Sheet1'].forEach(function (n) { var h = ss.getSheetByName(n); if (h && ss.getSheets().length > 1) ss.deleteSheet(h); });
  // migración: la antigua «APP · VÍDEOS» del Sheet de Road To Elite
  var vieja = miLibro_().getSheetByName('APP · VÍDEOS');
  if (vieja && vieja.getLastRow() > 1) {
    var cabV = cabeceras_(vieja), datos = vieja.getRange(2, 1, vieja.getLastRow() - 1, cabV.length).getDisplayValues(), ya = {};
    listar_(HOJAS.VIDEOS).forEach(function (x) { ya[norm(x.EJERCICIO)] = 1; });
    var col = function (row, h) { var k = cabV.indexOf(h); return k >= 0 ? row[k] : ''; };
    var filas = datos.filter(function (row) { return col(row, 'EJERCICIO') && col(row, 'VÍDEO') && !ya[norm(col(row, 'EJERCICIO'))]; }).map(function (row) {
      ya[norm(col(row, 'EJERCICIO'))] = 1;
      return { EJERCICIO: col(row, 'EJERCICIO'), ALIAS: col(row, 'ALIAS'), 'VÍDEO': col(row, 'VÍDEO'), ESTADO: 'SIN COMPROBAR', FUENTE: col(row, 'COPIADO DE APP GABI') ? 'App de Gabi (DICCIONARIO)' : 'Road To Elite',
        'APROBADO POR': col(row, 'APROBADO POR'), ALTA: col(row, 'FECHA'), ACTUALIZADO: ahora_() };
    });
    var n = filasEnHoja_(HOJAS.VIDEOS, filas), tienen = {}; listar_(HOJAS.VIDEOS).forEach(function (x) { tienen[norm(x.EJERCICIO)] = 1; });
    if (datos.every(function (row) { return !col(row, 'EJERCICIO') || tienen[norm(col(row, 'EJERCICIO'))]; })) { miLibro_().deleteSheet(vieja); r.push(n + ' vídeos traídos de APP · VÍDEOS y pestaña quitada'); }
    else r.push('AVISO: APP · VÍDEOS no se copió entera; se conserva');
  } else if (vieja) { miLibro_().deleteSheet(vieja); }
  if (!leerConfig_().videos_version) ponerConfig_('videos_version', ahora_() + ' · instalación', 'Última lectura de la Base de datos Vídeos (martes 06:00)');
  r.push(listar_(HOJAS.VIDEOS).length + ' vídeos');
  return r.join(' · ');
}
/** Comprueba los enlaces. YouTube y Vimeo por oEmbed (404 = borrado → ROTO; 401/403 = privado o sin permiso → REVISAR); el resto por GET. */
function revisarVideos_(soloNuevos) {
  var filas = listar_(HOJAS.VIDEOS).filter(function (r) { return r['VÍDEO'] && (!soloNuevos || !r.ESTADO || r.ESTADO === 'SIN COMPROBAR'); }), res = { revisados: 0, ok: 0, rotos: [], revisar: [] }, hoy = hoyTxt_();
  var urlCheck = function (u) {
    if (/youtu\.?be/i.test(u)) return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u);
    if (/vimeo\.com/i.test(u)) return 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(u);
    return u;
  };
  for (var i = 0; i < filas.length; i += 25) {
    var lote = filas.slice(i, i + 25), resp;
    try { resp = UrlFetchApp.fetchAll(lote.map(function (r) { return { url: urlCheck(String(r['VÍDEO']).trim()), muteHttpExceptions: true, followRedirects: true }; })); }
    catch (e) { resp = lote.map(function () { return null; }); }
    lote.forEach(function (r, k) {
      var x = resp[k], code = x ? x.getResponseCode() : 0, est, det;
      if (code >= 200 && code < 400) { est = 'OK'; det = ''; res.ok++; }
      else if (code === 404 || code === 410 || code === 400) { est = 'ROTO'; det = 'HTTP ' + code + ': el vídeo ya no existe o la URL no es válida'; res.rotos.push(r.EJERCICIO); }
      else { est = 'REVISAR'; det = code ? 'HTTP ' + code + (code === 401 || code === 403 ? ': privado o sin permiso para insertarlo' : ': error del servidor, se reintenta en la próxima revisión') : 'sin respuesta'; res.revisar.push(r.EJERCICIO); }
      res.revisados++;
      if (r.ESTADO !== est || r.DETALLE !== det || !r['ÚLTIMA REVISIÓN']) actualizarFila_(HOJAS.VIDEOS, r._fila, { ESTADO: est, DETALLE: det, 'ÚLTIMA REVISIÓN': hoy });
    });
  }
  anadirFila_(HOJAS.VID_REV, { FECHA: ahora_(), REVISADOS: res.revisados, OK: res.ok, ROTOS: res.rotos.length, REVISAR: res.revisar.length,
    DETALLE: (res.rotos.length ? 'Rotos: ' + res.rotos.join(', ') : '') + (res.revisar.length ? (res.rotos.length ? ' · ' : '') + 'Revisar: ' + res.revisar.join(', ') : '') });
  ponerConfig_('videos_ultima_revision', hoyIso_() + ' · ' + res.revisados + ' revisados · ' + res.rotos.length + ' rotos · ' + res.revisar.length + ' a revisar', 'Última revisión de enlaces de la Base de datos Vídeos');
  if (res.rotos.length || res.revisar.length) {
    try { MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, name: 'Road To Elite', subject: 'Vídeos: ' + res.rotos.length + ' rotos y ' + res.revisar.length + ' a revisar',
      htmlBody: '<p>Revisión de la <b>Base de datos Vídeos</b> (Drive › 2DO CEREBRO).</p>' + (res.rotos.length ? '<p><b>Rotos</b> (no se muestran en las apps): ' + esc_(res.rotos.join(', ')) + '</p>' : '') +
        (res.revisar.length ? '<p><b>A revisar</b> (privados o error puntual): ' + esc_(res.revisar.join(', ')) + '</p>' : '') +
        '<p>Para arreglarlos: cambia la URL en la hoja y pon ESTADO = SIN COMPROBAR.</p><p><a href="https://docs.google.com/spreadsheets/d/' + videosLibro_().getId() + '/edit">Abrir la base de datos</a></p>' }); } catch (e) { Logger.log('Correo vídeos: ' + e); }
  }
  return res;
}
/**
 * v0.21.1 · Martes 06:00 (después de la copia de la app de Gabi de las 05:00): Road To Elite lee la Base de datos Vídeos.
 *  - comprueba los enlaces nuevos (SIN COMPROBAR) y, si tocan (7 o 14 días), todos;
 *  - sube CONFIG › videos_version: la app ve el cambio y vuelve a pedir la lista (si no, usa la que tiene guardada).
 */
function videosMartes() { return conSalud_('videosMartes', videosMartes_sin_); }
function videosMartes_sin_() {
  VID_LIBRO_ = null; MEMO = null;
  var cf = leerConfig_(), cada = parseInt(cf.videos_revision_dias, 10) || 7, ult = String(cf.videos_ultima_revision || '').slice(0, 10);
  var toca = !ult || sumarDias(ult, cada) <= hoyIso_(), nuevos = listar_(HOJAS.VIDEOS).filter(function (r) { return r['VÍDEO'] && (!r.ESTADO || r.ESTADO === 'SIN COMPROBAR'); }).length;
  var res = toca ? revisarVideos_() : nuevos ? revisarVideos_(true) : null;
  var total = leerVideos_().length;
  ponerConfig_('videos_version', ahora_() + ' · ' + total + ' vídeos · ' + nuevos + ' nuevos' + (res ? ' · ' + res.rotos.length + ' rotos' : ''), 'Última lectura de la Base de datos Vídeos (martes 06:00, tras la copia de la app de Gabi de las 05:00). La app recarga los vídeos cuando cambia');
  return { total: total, nuevos: nuevos, revision: toca ? 'completa' : nuevos ? 'solo nuevos' : 'no tocaba' };
}
/** Compatibilidad: el disparador diario antiguo ya no revisa nada (lo hace videosMartes). */
function revisarVideosSiToca() { return 'sustituido por videosMartes (martes 06:00)'; }
function menuRevisarVideos() { var r = revisarVideos_(); SpreadsheetApp.getActive().toast(r.revisados + ' revisados · ' + r.rotos.length + ' rotos · ' + r.revisar.length + ' a revisar', 'Vídeos'); }

// ===================== v0.19 · KNOWLEDGE + APRENDIZAJE DEL CICLO =====================
/*
 * KNOWLEDGE (Drive › 2DO CEREBRO › CROSSFIT › KNOWLEDGE): se recorren todas sus carpetas y se indexan los .md
 *   → «KNOWLEDGE · ÍNDICE» (un archivo por fila) y «KNOWLEDGE · SECCIONES» (cada apartado ## / ###, con palabras clave).
 *   El motor busca ahí (buscarKnowledge_) lo que aplica a cada caso y se lo pasa a Gemini y a Ollama, que citan la fuente.
 * Aprendizaje del ciclo: cada semana de Fabrik deja su huella día a día en «MOTOR · CICLO» (fase, semana de la fase, bloques,
 *   tipos, minutos, RPE, cargas, estímulos, estructura). «MOTOR · PERFIL FASE» resume, por fase y día, lo que suele hacer Gabi.
 *   El generador usa ese perfil para los días que Gabi aún no ha subido (previsión de carga e interferencias).
 *   «MOTOR · LECTURAS»: cada semana, un resumen del motor + la lectura de Gemini apoyada en KNOWLEDGE.
 */
ESQ_BD_['KNOWLEDGE · ÍNDICE'] = { cab: ['ARCHIVO', 'RUTA', 'CATEGORÍA', 'TEMA', 'TÍTULO', 'SECCIONES', 'CARACTERES', 'ACTUALIZADO', 'ID'], anchos: [260, 260, 130, 180, 320, 80, 90, 130, 120], negrita: 'ARCHIVO', color: '#16a34a' };
ESQ_BD_['KNOWLEDGE · SECCIONES'] = { cab: ['ARCHIVO', 'SECCIÓN', 'CATEGORÍA', 'PALABRAS', 'TEXTO', 'ID ARCHIVO'], anchos: [220, 320, 120, 320, 500, 110], negrita: 'SECCIÓN', color: '#16a34a' };
ESQ_BD_['MOTOR · CICLO'] = { cab: ['CLAVE', 'LUNES', 'FASE', 'SEMANA FASE', 'DÍA', 'FECHA', 'BLOQUES', 'MIN', 'RPE', 'DURO', 'TIPOS', 'CARGAS', 'ESTÍMULOS', 'ESTRUCTURA', 'ACTUALIZADO'],
  anchos: [150, 90, 130, 90, 90, 90, 70, 60, 50, 60, 260, 220, 220, 420, 130], color: '#8b5cf6' };
ESQ_BD_['MOTOR · PERFIL FASE'] = { cab: ['FASE', 'DÍA', 'SEMANAS', 'MIN MEDIO', 'RPE MEDIO', '% DURO', 'CARGAS FRECUENTES', 'TIPOS FRECUENTES', 'ESTÍMULOS FRECUENTES', 'ACTUALIZADO'],
  anchos: [130, 90, 70, 80, 80, 70, 240, 240, 240, 130], color: '#8b5cf6' };
ESQ_BD_['MOTOR · LECTURAS'] = { cab: ['LUNES', 'FASE', 'SEMANA FASE', 'RESUMEN (motor)', 'LECTURA (Gemini)', 'FUENTES KNOWLEDGE', 'FIRMA', 'ACTUALIZADO'],
  anchos: [90, 130, 90, 420, 520, 320, 90, 130], color: '#8b5cf6' };

// ---------- KNOWLEDGE ----------
var VACIAS_ = 'PARA,COMO,ESTE,ESTA,ESTOS,ESTAS,CUANDO,DONDE,PORQUE,SOBRE,ENTRE,DESDE,HASTA,TIENE,TIENEN,PUEDE,PUEDEN,MUCHO,MENOS,TODOS,TODAS,CADA,OTRO,OTRA,OTROS,SINO,SOLO,TAMBIEN,AUNQUE,MIENTRAS,ANTES,DESPUES,SIEMPRE,NUNCA,SEGUN,HACER,HACIA,DURANTE,ESTAR,MISMO,MISMA,TANTO,PORQUE,ELLOS,NUESTRO,NUESTRA'.split(',');
function palabrasClave_(txt, n) {
  var f = {}; norm(txt).split(/[^A-Z0-9Ñ]+/).forEach(function (w) { if (w.length >= 5 && VACIAS_.indexOf(w) < 0 && !/^[0-9]+$/.test(w)) f[w] = (f[w] || 0) + 1; });
  return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }).slice(0, n || 25).join(' ').toLowerCase();
}
function trocearMd_(txt) {
  var out = [], act = { titulo: '(inicio)', l: [] };
  String(txt || '').replace(/\r/g, '').split('\n').forEach(function (l) {
    var h = l.match(/^#{1,3}\s+(.+?)\s*$/);
    if (h) { if (act.l.join('').trim()) out.push(act); act = { titulo: h[1].replace(/[*_`]/g, ''), l: [l] }; } else act.l.push(l);
  });
  if (act.l.join('').trim()) out.push(act);
  var res = [];
  out.forEach(function (s) { var t = s.l.join('\n').trim(); for (var i = 0; i < t.length; i += 40000) res.push({ titulo: s.titulo + (i ? ' (cont.)' : ''), texto: t.slice(i, i + 40000) }); });
  return res;
}
function recorrerMd_(folder, ruta, out) {
  var it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/\.md$/i.test(f.getName()) || f.getMimeType() === 'text/markdown') out.push({ f: f, ruta: ruta }); }
  var sub = folder.getFolders();
  while (sub.hasNext()) { var s = sub.next(); recorrerMd_(s, ruta.concat([s.getName()]), out); }
}
function reescribirHoja_(nombre, filas) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, cab.length).setValues(filas.map(function (o) { return cab.map(function (h) { return o[h] == null ? '' : celdaSegura_(o[h]); }); }));
  MEMO = null;
}
/** Indexa KNOWLEDGE (solo si algo cambió). forzar = true lo rehace siempre. */
function indexarKnowledge_(forzar) {
  var lista = []; recorrerMd_(DriveApp.getFolderById(CONFIG.KNOWLEDGE_ID), [], lista);
  var firma = lista.map(function (x) { return x.f.getId() + ':' + x.f.getLastUpdated().getTime(); }).sort().join('|');
  firma = hashTxt_(firma);
  if (!forzar && PROPS.getProperty('KNOW_FIRMA') === firma) return { archivos: lista.length, secciones: null, igual: true };
  var idx = [], secs = [];
  lista.forEach(function (x) {
    var txt = x.f.getBlob().getDataAsString('UTF-8'), partes = trocearMd_(txt);
    idx.push({ ARCHIVO: x.f.getName(), RUTA: x.ruta.join(' › '), 'CATEGORÍA': x.ruta[0] || '', TEMA: x.ruta.slice(1).join(' › '), 'TÍTULO': (txt.match(/^#\s+(.+)$/m) || [])[1] || x.f.getName(),
      SECCIONES: partes.length, CARACTERES: txt.length, ACTUALIZADO: Utilities.formatDate(x.f.getLastUpdated(), CONFIG.ZONA, 'dd/MM/yyyy HH:mm'), ID: x.f.getId() });
    partes.forEach(function (s) { secs.push({ ARCHIVO: x.f.getName(), 'SECCIÓN': s.titulo, 'CATEGORÍA': x.ruta[0] || '', PALABRAS: palabrasClave_(s.texto), TEXTO: s.texto, 'ID ARCHIVO': x.f.getId() }); });
  });
  reescribirHoja_('KNOWLEDGE · ÍNDICE', idx); reescribirHoja_('KNOWLEDGE · SECCIONES', secs);
  PROPS.setProperty('KNOW_FIRMA', firma);
  return { archivos: idx.length, secciones: secs.length };
}
/** Las n secciones de KNOWLEDGE que más tienen que ver con la consulta: [{ archivo, seccion, texto }]. */
function buscarKnowledge_(consulta, n, maxChars) {
  var secs; try { secs = listar_('KNOWLEDGE · SECCIONES'); } catch (e) { return []; }
  var q = norm(consulta).split(/[^A-Z0-9Ñ]+/).filter(function (w) { return w.length >= 4 && VACIAS_.indexOf(w) < 0; }).filter(function (w, i, a) { return a.indexOf(w) === i; });
  if (!q.length) return [];
  var puntua = function (s) {
    var tit = norm(s['SECCIÓN']), pal = norm(s.PALABRAS), tx = norm(String(s.TEXTO).slice(0, 20000));
    return q.reduce(function (a, w) { return a + (tit.indexOf(w) >= 0 ? 4 : 0) + (pal.indexOf(w) >= 0 ? 3 : 0) + Math.min(3, tx.split(w).length - 1); }, 0);
  };
  return secs.map(function (s) { return { s: s, p: puntua(s) }; }).filter(function (x) { return x.p > 0; }).sort(function (a, b) { return b.p - a.p; }).slice(0, n || 4)
    .map(function (x) { return { archivo: x.s.ARCHIVO, seccion: x.s['SECCIÓN'], texto: String(x.s.TEXTO).slice(0, maxChars || 3000) }; });
}
function vocabKnowledge_(n) {
  try { return listar_('KNOWLEDGE · SECCIONES').map(function (s) { return s['SECCIÓN']; }).filter(function (t) { return t && !/inicio|índice|indice|fuentes|bibliograf/i.test(t); }).slice(0, n || 40); } catch (e) { return []; }
}

// ---------- Huella del ciclo ----------
function faseDe_(iso, est) {
  var fs = (est && est.ciclo && est.ciclo.fases) || [];
  for (var i = 0; i < fs.length; i++) {
    var f = fs[i]; if (f.inicio && f.fin && iso >= f.inicio && iso <= f.fin) {
      var sem = Math.floor((new Date(iso + 'T12:00:00') - new Date(f.inicio + 'T12:00:00')) / 86400000 / 7) + 1;
      return { nombre: String(f.nombre || '').trim(), semana: sem, de: f.semanas, objetivos: f.objetivos || '' };
    }
  }
  return { nombre: 'Sin fase', semana: '', de: '', objetivos: '' };
}
var TIPOS_BLOQUE_ = [['metcon', /METCON|WOD\b|AMRAP|FOR TIME|EMOM/], ['haltero', /WEIGH?LIFTING|SNATCH|CLEAN|JERK|HALTER/], ['gimnásticos', /GIMNAS|GYMNAS|SKILL|HSPU|MUSCLE|HSWALK|HANDSTAND|PULL UP|RING/],
  ['fuerza', /STRENGH?T|SQUAT|DEADLIFT|PRESS|BENCH|FUERZA|STRONGMAN/], ['accesorios', /ACCESOR|ACCESSOR/], ['endurance', /MONOESTRUCT|ZONA 2|ENDURANCE|AEROBIC|CARRERA|RUN\b/], ['movilidad', /MOVILIDAD|MOBILITY|RANGO/]];
function tipoBloqueTxt_(t) { t = norm(t); for (var i = 0; i < TIPOS_BLOQUE_.length; i++) if (TIPOS_BLOQUE_[i][1].test(t)) return TIPOS_BLOQUE_[i][0]; return 'otro'; }
function huellaSemana_(s, est, cat) {
  var F = semanaBase_(s, est), fase = faseDe_(s.iso, est), out = [];
  (F.dias || []).forEach(function (d) {
    var bl = (d.bloques || []).filter(function (b) { return b.n; });
    if (!bl.length || !d.iso) return;
    var tipos = [], cargas = {}, cods = {}, min = 0, rpe = parseInt(String(d.rpe || '').replace(/[^\d]/g, ''), 10) || 0;
    bl.forEach(function (b) {
      var txt = textoBloque_(b), pseudo = { 'TÍTULO': b.titulo || '', CONTENIDO: txt, ORIGEN: 'FABRIK', INTENSIDAD: b.rpe || '' };
      var tp = tipoBloqueTxt_((b.titulo || '') + ' ' + txt.slice(0, 120)); tipos.push(tp);
      min += minFila_(pseudo); cargasFila_(pseudo).forEach(function (k) { cargas[k] = (cargas[k] || 0) + 1; });
      try { codigosTexto_(txt, cat, tp === 'metcon').forEach(function (k) { cods[k] = 1; }); } catch (e) {}
      var r = parseInt(String(b.rpe || '').replace(/[^\d]/g, ''), 10) || 0; if (r > rpe) rpe = r;
    });
    out.push({ CLAVE: s.iso + '|' + diaDe_(d.iso), LUNES: isoAFecha(s.iso), FASE: fase.nombre, 'SEMANA FASE': fase.semana + (fase.de ? ' de ' + fase.de : ''), 'DÍA': diaDe_(d.iso), FECHA: isoAFecha(d.iso),
      BLOQUES: bl.length, MIN: Math.round(min), RPE: rpe || '', DURO: (rpe >= 8 || tipos.indexOf('metcon') >= 0 && rpe >= 8) ? 'Sí' : 'No', TIPOS: tipos.join(', '),
      CARGAS: Object.keys(cargas).sort(function (a, b) { return cargas[b] - cargas[a]; }).join(', '), 'ESTÍMULOS': Object.keys(cods).join(', '), ESTRUCTURA: tipos.join(' → '), ACTUALIZADO: ahora_() });
  });
  return { fase: fase, dias: out };
}
/** Huella de las últimas n semanas de Fabrik (incluida la que esté subiendo Gabi) y perfil por fase. */
function aprenderCiclo_(nSemanas) {
  var est = estructura_(fabrik_()), cat = catalogo_(), tope = sumarDias(lunesDe_(hoyIso_()), 7), filas = {}, n = 0;
  listar_('MOTOR · CICLO').forEach(function (r) { filas[r.CLAVE] = r; });
  est.semanas.filter(function (s) { return s.iso && s.iso <= tope; }).slice(-(nSemanas || 2)).forEach(function (s) {
    try { huellaSemana_(s, est, cat).dias.forEach(function (o) { filas[o.CLAVE] = o; n++; }); } catch (e) { Logger.log('Huella ' + s.nombre + ': ' + e); }
  });
  var lista = Object.keys(filas).sort().map(function (k) { return filas[k]; });
  reescribirHoja_('MOTOR · CICLO', lista);
  // perfil por fase y día
  var g = {};
  lista.forEach(function (r) {
    var k = r.FASE + '|' + r['DÍA'], x = g[k] = g[k] || { fase: r.FASE, dia: r['DÍA'], sem: {}, min: 0, rpe: 0, nr: 0, duro: 0, n: 0, cargas: {}, tipos: {}, cods: {} };
    x.n++; x.sem[r.LUNES] = 1; x.min += +r.MIN || 0; if (+r.RPE) { x.rpe += +r.RPE; x.nr++; } if (r.DURO === 'Sí') x.duro++;
    [['cargas', r.CARGAS], ['tipos', r.TIPOS], ['cods', r['ESTÍMULOS']]].forEach(function (p) { String(p[1] || '').split(/\s*,\s*/).filter(Boolean).forEach(function (v) { x[p[0]][v] = (x[p[0]][v] || 0) + 1; }); });
  });
  var top = function (o, n2) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, n2 || 4).map(function (k) { return k + ' (' + o[k] + ')'; }).join(', '); };
  var ORD = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var perfil = Object.keys(g).map(function (k) { var x = g[k]; return { FASE: x.fase, 'DÍA': x.dia, SEMANAS: Object.keys(x.sem).length, 'MIN MEDIO': Math.round(x.min / x.n), 'RPE MEDIO': x.nr ? Math.round(x.rpe / x.nr * 10) / 10 : '',
    '% DURO': Math.round(x.duro / x.n * 100), 'CARGAS FRECUENTES': top(x.cargas), 'TIPOS FRECUENTES': top(x.tipos), 'ESTÍMULOS FRECUENTES': top(x.cods, 6), ACTUALIZADO: ahora_() }; })
    .sort(function (a, b) { return a.FASE < b.FASE ? -1 : a.FASE > b.FASE ? 1 : ORD.indexOf(a['DÍA']) - ORD.indexOf(b['DÍA']); });
  reescribirHoja_('MOTOR · PERFIL FASE', perfil);
  return { dias: n, perfiles: perfil.length };
}
/** Perfil esperado de cada día de esa semana según la fase (para los días que Gabi aún no ha subido). */
function perfilSemana_(lunes) {
  var est; try { est = estructura_(fabrik_()); } catch (e) { return {}; }
  var fase = faseDe_(lunes, est).nombre, out = {};
  try { listar_('MOTOR · PERFIL FASE').forEach(function (r) { if (r.FASE === fase && +r.SEMANAS >= 1) out[r['DÍA']] = { pctDuro: +r['% DURO'] || 0, cargas: String(r['CARGAS FRECUENTES'] || '').split(/\s*,\s*/).map(function (x) { return x.replace(/\s*\(\d+\)$/, ''); }).filter(Boolean).slice(0, 3), semanas: +r.SEMANAS, fase: fase }; }); } catch (e) {}
  return out;
}
/** Lectura semanal: resumen del motor + Gemini apoyado en KNOWLEDGE (cita archivo › sección). Solo si la semana cambió. */
function lecturaSemana_(lunes) {
  var est = estructura_(fabrik_()), s = est.semanas.filter(function (x) { return x.iso === lunes; })[0];
  if (!s) return 'sin semana';
  var h = huellaSemana_(s, est, catalogo_()), firma = hashTxt_(JSON.stringify(h.dias.map(function (d) { return [d['DÍA'], d.TIPOS, d.MIN, d.RPE]; }))).slice(0, 10);
  var prev = listar_('MOTOR · LECTURAS').filter(function (r) { return celdaIso_(r.LUNES) === lunes; })[0];
  if (prev && prev.FIRMA === firma && prev['LECTURA (Gemini)']) return 'igual';
  var resumen = 'Fase ' + h.fase.nombre + ' (semana ' + h.fase.semana + (h.fase.de ? ' de ' + h.fase.de : '') + '). ' + h.dias.length + ' días subidos. ' +
    h.dias.map(function (d) { return d['DÍA'].slice(0, 3) + ': ' + d.ESTRUCTURA + ' · ' + d.MIN + '′' + (d.RPE ? ' · RPE ' + d.RPE : '') + (d.DURO === 'Sí' ? ' · DURO' : '') + (d.CARGAS ? ' · ' + d.CARGAS.toLowerCase() : ''); }).join(' | ');
  var fuentes = buscarKnowledge_(h.fase.nombre + ' ' + h.fase.objetivos + ' ' + h.dias.map(function (d) { return d.TIPOS; }).join(' ') + ' ajuste por fase extras interferencia', 4, 2500);
  var lectura = '', key = PROPS.getProperty('GEMINI_KEY');
  if (key) {
    var perfil = listar_('MOTOR · PERFIL FASE').filter(function (r) { return r.FASE === h.fase.nombre; }).map(function (r) { return r['DÍA'] + ': ' + r['MIN MEDIO'] + '′, RPE ' + r['RPE MEDIO'] + ', ' + r['% DURO'] + ' % duro, ' + r['TIPOS FRECUENTES']; }).join('\n');
    var prompt = 'Eres el preparador de un atleta híbrido RX (CrossFit + carrera/HYROX). Lee la semana de su programación base (Fabrik, coach Gabi) y escribe en español, en 6–9 frases y sin markdown: ' +
      '1) en qué punto del ciclo está y qué busca el coach; 2) cómo se reparten los estímulos y la carga por días; 3) qué extras encajan (tipo, día y dónde dentro de la sesión, siempre antes del metcon salvo carrera/Z6–Z8) y cuáles evitar por interferencia; ' +
      '4) qué esperar de los días que aún no ha subido el coach. Apóyate SOLO en el conocimiento citado y cita entre corchetes [archivo › sección] lo que uses.\n\n' +
      'OBJETIVOS DE LA FASE: ' + h.fase.objetivos + '\n\nSEMANA: ' + resumen + '\n\nPERFIL HISTÓRICO DE ESTA FASE:\n' + perfil + '\n\nCONOCIMIENTO (KNOWLEDGE):\n' +
      fuentes.map(function (f) { return '[' + f.archivo + ' › ' + f.seccion + ']\n' + f.texto; }).join('\n\n');
    var g = geminiLlamar_(prompt, 1500, 0.4); if (g.ok) lectura = g.texto;
  }
  var o = { LUNES: isoAFecha(lunes), FASE: h.fase.nombre, 'SEMANA FASE': h.fase.semana + (h.fase.de ? ' de ' + h.fase.de : ''), 'RESUMEN (motor)': resumen, 'LECTURA (Gemini)': lectura.slice(0, 6000),
    'FUENTES KNOWLEDGE': fuentes.map(function (f) { return f.archivo + ' › ' + f.seccion; }).join('\n'), FIRMA: firma, ACTUALIZADO: ahora_() };
  if (prev) actualizarFila_('MOTOR · LECTURAS', prev._fila, o); else anadirFila_('MOTOR · LECTURAS', o);
  return lectura ? 'con Gemini' : 'solo motor';
}
function menuAprenderCiclo() {
  var k = indexarKnowledge_(true), a = aprenderCiclo_(16), l = ''; try { l = lecturaSemana_(lunesDe_(hoyIso_())); } catch (e) { l = String(e); }
  SpreadsheetApp.getActive().toast('KNOWLEDGE: ' + k.archivos + ' .md · ' + k.secciones + ' secciones · ciclo: ' + a.dias + ' días · lectura: ' + l, 'Motor', 8);
}

