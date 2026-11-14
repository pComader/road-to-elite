// ===================== v0.14 · REESTRUCTURAR: VIAJE · REORGANIZACIÓN · COMPETI =====================
/**
 * Especificación: doc del proyecto «claude/reestructurar-especificacion.md» (8/11/2026).
 * Flujo: reest_proponer (simula, guarda la propuesta) → Pablo revisa y mueve → reest_aplicar → (reest_deshacer).
 * El plan original no se borra: los bloques afectados pasan a SUSTITUIDO con REESTRUCTURA = id y ESTADO PREVIO;
 * los bloques nuevos llevan REESTRUCTURA = id. La app enseña «Original | Adaptada» por día.
 */
HOJAS.REEST = 'APP · REESTRUCTURA';
ESQUEMA['APP · REESTRUCTURA'] = {
  cab: ['ID', 'LUNES', 'MODO', 'ESTADO', 'RESUMEN', 'PARAMS', 'PROPUESTA', 'CREADA', 'APLICADA'],
  anchos: [80, 95, 110, 100, 420, 200, 200, 120, 120], fechas: ['LUNES'],
  listas: { MODO: ['Viaje', 'Reorganización', 'Competi'], ESTADO: ['Propuesta', 'Aplicada', 'Deshecha', 'Descartada'] }
};
ESQUEMA['APP · PLAN'].cab.push('REESTRUCTURA', 'ESTADO PREVIO'); ESQUEMA['APP · PLAN'].anchos.push(90, 100);
var HORA_TURNO_ = { AM: 9, PM: 18 };
var CAP_TURNO_ = { AM: 75, PM: 120 };
var EST_ACTIVO_ = /^(PROGRAMADO|BORRADOR)$/;

// ---------- utilidades ----------
function minFila_(r) {
  var m = parseFloat(String(r.MIN || '').replace(',', '.'));
  if (m > 0) return m;
  var t = norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || ''));
  return /METCON|WOD/.test(t) ? 20 : norm(r.ORIGEN) === 'FABRIK' ? 18 : 12;
}
function esDura_(r) {
  if (/R01|R02|R03|R04|W04/.test(r['CÓDIGOS'] || '')) return true;
  var rpe = parseInt(String(r.INTENSIDAD || '').replace(/[^\d]/g, ''), 10) || 0;
  return /METCON|WOD/.test(norm(r['TÍTULO'] || '')) && rpe >= 8;
}
function esCarreraFila_(r) { return /CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R02|R03|V01)\b/.test(r['CÓDIGOS'] || ''); }
function esZ2Fila_(r) { return /\b(W01|W02)\b/.test(r['CÓDIGOS'] || ''); }
function tipoSeccion_(r) {
  var t = norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || '') + ' ' + String(r.CONTENIDO || '').slice(0, 200));
  if (esCarreraFila_(r)) return 'carrera';
  if (/METCON|WOD|AMRAP|FOR TIME|EMOM|R01|R04|Z6/.test(t) || /R01|R04/.test(r['CÓDIGOS'] || '')) return 'metcon';
  if (/SNATCH|CLEAN|JERK|SQUAT|DEADLIFT|STRENGTH|STRENGHT|WEIGHTLIFTING|PRESS|FUERZA/.test(t)) return 'fuerza';
  if (/SKILL|TECNIC|GIMNAST|HANDSTAND|PINO|RMU|MUSCLE|HSPU|DOUBLE UNDER|TRIPLE/.test(t)) return 'skills';
  if (/MOVILIDAD|MOBILITY|CALENTAMIENTO|WARM|ACTIVA/.test(t)) return 'calentamiento';
  return 'accesorio';
}
/** Prioridad de un bloque: Fabrik principal y P/Calidad primero; luego lo que más falta (metas). */
function prioridadFila_(r, w) {
  var p = codigosDe_(r['CÓDIGOS']).reduce(function (a, c) { return a + (w[c] || 0); }, 0);
  var sec = tipoSeccion_(r);
  if (norm(r.ORIGEN) === 'FABRIK') p += sec === 'fuerza' ? 3 : sec === 'metcon' ? 2.5 : 1.5;
  if (/R01|W04|R02|R03/.test(r['CÓDIGOS'] || '')) p += 3;
  if (esZ2Fila_(r)) p += 2;
  if (sec === 'accesorio') p -= 0.5;
  return p;
}
function horaDe_(iso, turno) { return new Date(iso + 'T' + (HORA_TURNO_[turno] < 10 ? '0' : '') + HORA_TURNO_[turno] + ':00:00').getTime(); }
/** v0.26 · Punto de corte al reorganizar: la sesión en curso (mañana hasta las 14 h, tarde después). Todo lo anterior se da por hecho. */
function corteAhora_() { var h = +Utilities.formatDate(new Date(), CONFIG.ZONA, 'H'); return { iso: hoyIso_(), turno: h < 14 ? 'AM' : 'PM' }; }
function antesDeCorte_(iso, turno, c) { return iso < c.iso || (iso === c.iso && turno === 'AM' && c.turno === 'PM'); }
/** Al aplicar una reorganización: lo anterior al corte sin registrar pasa a HECHO (cuenta en semana y mes). Se deshace con la reestructura. */
function darPorHecho_(lunes, rid, excepto) {
  var c = corteAhora_(), reg = {}, n = 0; excepto = excepto || {};
  listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN) reg[r.ID_PLAN] = 1; });
  var nuevas = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6) && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO) && !reg[r.ID] && !excepto[r.ID] && antesDeCorte_(d, r.TURNO === 'AM' ? 'AM' : 'PM', c); })
    .map(function (r) { n++; return { FECHA: r.FECHA, ID_PLAN: r.ID, BLOQUE: r['TÍTULO'] || r.BLOQUE || '', HECHO: 'Sí', NOTAS: 'Dado por hecho al reorganizar [' + rid + ']', REGISTRADO: ahora_() }; });
  if (nuevas.length) { filasEnHoja_(HOJAS.REGISTRO, nuevas); MEMO = null; }
  return n;
}
function quitarDadosPorHecho_(rid) {
  var sh = hojaMia_(HOJAS.REGISTRO);
  listar_(HOJAS.REGISTRO).filter(function (r) { return String(r.NOTAS || '').indexOf('[' + rid + ']') >= 0; }).map(function (r) { return r._fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
  MEMO = null;
}
function filasSemanaActivas_(lunes) {
  var fin = sumarDias(lunes, 6), hechos = {}, corte = corteAhora_();
  listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.HECHO === 'Sí') hechos[r.ID_PLAN] = 1; });
  return listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && EST_ACTIVO_.test(r.ESTADO); })
    .map(function (r) { r._iso = celdaIso_(r.FECHA); r._turno = r.TURNO === 'AM' ? 'AM' : 'PM'; r._pasado = antesDeCorte_(r._iso, r._turno, corte); r._hecho = !!hechos[r.ID] || r._pasado; r._min = minFila_(r); return r; });   // v0.26 · lo anterior al corte no se reorganiza
}
/** Mitad del volumen manteniendo la intensidad: series, rondas, minutos de EMOM/AMRAP y AxB. */
function mitadVolumen_(txt) {
  var cambio = false, h = function (n) { cambio = true; return Math.max(1, Math.round(n / 2)); };
  var out = String(txt || '').split('\n').map(function (l) {
    return l.replace(/(\d+)(\s*)(SETS?|RONDAS?|ROUNDS?|SERIES)\b/gi, function (m, n, s, u) { return h(+n) + s + u; })
      .replace(/(X\s*)(\d+)(\s*SETS?)/gi, function (m, a, n, b) { return a + h(+n) + b; })
      .replace(/\b(EMOM|AMRAP|E2MOM|E3MOM)\s*(\d+)\s*([′'])/gi, function (m, f, n, q) { return f + ' ' + h(+n) + q; })
      .replace(/^(\s*)(\d+)\s*[X×]\s*(\d+)/i, function (m, s, a, b) { return s + h(+a) + '×' + b; });
  }).join('\n');
  return { txt: (cambio ? '' : '⚖ HAZ LA MITAD DE SERIES O RONDAS, MISMA INTENSIDAD\n') + out, cambio: cambio };
}

// ---------- material y equivalencias (viaje y mega WOD) ----------
var MATERIALES_ = [
  ['box', 'Tengo un box (todo)'], ['hspu', 'Pared para HSPU'], ['pino', 'Espacio para pino / HSW'], ['rack_dominadas', 'Rack / barra de dominadas (C2B, pull-ups, T2B kipping)'], ['anillas', 'Anillas (RMU, toes to ring, fondos)'], ['bmu', 'Barra que permite BMU (altura suficiente)'],
  ['rack_estricto', 'Solo dominadas y T2B estrictos'], ['rack_completo', 'Rack completo (barra + anillas + BMU)'], ['chaleco', 'Chaleco de peso'], ['comba', 'Comba'],
  ['kb', 'Kettlebells'], ['barra', 'Barra olímpica y discos'], ['db', 'Mancuernas'], ['sandbag_hyrox', 'Sandbag HYROX'], ['sandbag', 'Sandbag'], ['cajon', 'Cajón'],
  ['slamball', 'Slamball / balón'], ['cuerda', 'Cuerda para trepar'], ['fondos', 'Algo para fondos'], ['ergos', 'Ergómetros (bike, remo, ski)'], ['trineo', 'Trineo'], ['yugo', 'Yugo']
];
/** Reglas: si la línea pide algo que no tienes, se sustituye manteniendo el estímulo. Cada una dice qué conserva. */
var EQUIV_ = [
  { re: /RING MUSCLE|RMU/, ok: ['anillas'], sub: function (m) { return m.bmu ? 'BAR MUSCLE UP (mismas reps)' : m.rack_dominadas ? 'CHEST TO BAR + 2 FONDOS por rep' : 'BURPEE + 3 PUSH-UPS EXPLOSIVAS por rep'; }, conserva: 'tirón + empuje en fatiga' },
  { re: /BAR MUSCLE|BMU/, ok: ['bmu'], sub: function (m) { return m.anillas ? 'RING MUSCLE UP (mismas reps)' : m.rack_dominadas ? 'CHEST TO BAR + 2 FONDOS por rep' : 'BURPEE + 3 PUSH-UPS EXPLOSIVAS por rep'; }, conserva: 'tirón + empuje en fatiga' },
  { re: /TOES TO RING/, ok: ['anillas'], sub: function (m) { return m.rack_dominadas ? 'TOES TO BAR' : 'V-UPS'; }, conserva: 'core en suspensión' },
  { re: /CHEST TO BAR|C2B|PULL.?UPS?|TOES TO BAR|T2B/, ok: ['rack_dominadas'], sub: function (m) { return m.rack_estricto ? 'VERSIÓN ESTRICTA (mitad de reps)' : 'V-UPS + REMO INVERTIDO EN MESA (mismas reps)'; }, conserva: 'tirón y core' },
  { re: /HSPU|HANDSTAND PUSH/, ok: ['hspu'], sub: function (m) { return 'PIKE PUSH-UPS EN DÉFICIT (pies elevados)' + (m.chaleco ? ' con chaleco' : ''); }, conserva: 'empuje vertical' },
  { re: /HANDSTAND WALK|HSW|HANDSTAND HOLD|PINO|WALL WALK/, ok: ['pino', 'hspu'], sub: function () { return 'BEAR CRAWL + PLANCHA ESCAPULAR'; }, conserva: 'hombro en carga y control' },
  { re: /THRUSTER|FRONT SQUAT|BACK SQUAT|OVERHEAD SQUAT|OHS|SNATCH|CLEAN|JERK|DEADLIFT|PUSH PRESS|STRICT PRESS|SHOULDER TO OVERHEAD|STOH|BARBELL|BENCH/, ok: ['barra'],
    sub: function (m, l) { var imp = m.db ? 'DB' : m.kb ? 'KB' : m.sandbag || m.sandbag_hyrox ? 'SANDBAG' : null;
      if (!imp) return 'JUMP SQUATS + BURPEES (mismas reps)' + (m.chaleco ? ' con chaleco' : '');
      return imp + ' ' + (/THRUSTER/.test(l) ? 'THRUSTERS' : /SNATCH/.test(l) ? 'SNATCH' : /CLEAN/.test(l) ? 'CLEAN' : /JERK|PRESS|STOH|SHOULDER/.test(l) ? 'PUSH PRESS' : /DEADLIFT/.test(l) ? 'DEADLIFT' : 'FRONT SQUAT') + ' (carga a RPE equivalente; los % no aplican)'; }, conserva: 'patrón y potencia, no la carga' },
  { re: /WALL ?BALL|WB\b/, ok: ['slamball'], sub: function (m) { return m.db || m.kb ? 'THRUSTERS LIGEROS CON ' + (m.db ? 'DB' : 'KB') : 'AIR SQUAT + PUSH-UP JUMP'; }, conserva: 'sentadilla + empuje' },
  { re: /DOUBLE UNDER|(^|[^A-Z])DUS?([^A-Z]|$)|SINGLE UNDER|CROSSOVER|HEAVY ROPE/, ok: ['comba'], sub: function () { return 'POGO JUMPS LATERALES (mismo nº de saltos)'; }, conserva: 'tobillo reactivo y ritmo' },
  { re: /BOX JUMP|BOX STEP|BJO|STEP.?UP/, ok: ['cajon'], sub: function () { return 'BROAD JUMPS / TUCK JUMPS (mismas reps)'; }, conserva: 'salto' },
  { re: /ROPE CLIMB|LEGLESS/, ok: ['cuerda'], sub: function (m) { return m.rack_completo || m.rack_dominadas ? 'DOMINADAS CON TOALLA (3 por subida)' : 'REMO INVERTIDO + HOLLOW'; }, conserva: 'agarre y tirón' },
  { re: /SANDBAG/, ok: ['sandbag', 'sandbag_hyrox'], sub: function (m) { return m.db || m.kb ? (m.db ? 'DB' : 'KB') + ' A UN HOMBRO' : 'BURPEES'; }, conserva: 'carga asimétrica' },
  { re: /SLAM ?BALL/, ok: ['slamball'], sub: function () { return 'BURPEES (mismas reps)'; }, conserva: 'triple extensión' },
  { re: /ROW|SKIERG|(^|[^A-Z])SKI([^A-Z]|$)|BIKE|ASSAULT|ECHO|BIKEERG|(^|[^A-Z])CAL([^A-Z]|$)/, ok: ['ergos'], sub: function (m) { return m._correr ? '200 M RUN por cada 15 cal' : 'BURPEES (1 por cada 2 cal) o JUMPING JACKS'; }, conserva: 'motor' },
  { re: /SLED|TRINEO|YOKE|YUGO/, ok: ['trineo', 'yugo'], sub: function () { return 'SPRINT EN CUESTA 15″ o BEAR CRAWL'; }, conserva: 'empuje de cadera' },
  { re: /(^|[^A-Z])DIPS?([^A-Z]|$)|FONDOS/, ok: ['fondos', 'anillas'], sub: function () { return 'PUSH-UPS DECLINADAS'; }, conserva: 'empuje' },
  { re: /GHD/, ok: ['box'], sub: function () { return 'V-UPS + SUPERMAN'; }, conserva: 'core' },
  { re: /(^|[^A-Z])RUN([^A-Z]|$)|CARRERA/, ok: ['_correr'], sub: function () { return 'BURPEE BROAD JUMPS (1 por cada 20 m)'; }, conserva: 'motor' }
];
function mapaMaterial_(lista, correr) { var m = {}; (lista || []).forEach(function (k) { m[k] = true; }); if (correr) m._correr = true; if (m.box) MATERIALES_.forEach(function (x) { m[x[0]] = true; });
  if (m.rack_completo) { m.rack_dominadas = true; m.anillas = true; m.bmu = true; } if (m.bmu) m.rack_dominadas = true; if (m.rack_dominadas) m.rack_estricto = true; if (m.gusano2 || m.gusano3 || m.gusano4) m.gusano = true; return m; }
/** Adapta el texto de un bloque al material. Devuelve el texto, cuántas líneas cambian y qué se pierde. */
function adaptarMaterial_(txt, mat) {
  var lineas = String(txt || '').split('\n'), n = 0, total = 0, notas = [];
  var out = lineas.map(function (l) {
    var L = norm(l); if (!L.trim() || /^[A-Z](\.\d)?\s*·/.test(L)) return l;
    total++;
    for (var i = 0; i < EQUIV_.length; i++) {
      var e = EQUIV_[i]; if (!e.re.test(L)) continue;
      if (e.ok.some(function (k) { return mat[k]; })) return l;
      n++; notas.push(e.conserva);
      var reps = (l.match(/^\s*([\d\/\.\-]+\s*(cal|m|M)?)/) || [])[1] || '';
      return (reps ? reps.trim() + ' ' : '') + e.sub(mat, L) + '   ‹en vez de: ' + l.trim() + '›';
    }
    return l;
  });
  return { txt: out.join('\n'), cambios: n, ratio: total ? n / total : 0, conserva: notas.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
}

/**
 * v0.14.1 · Regla de Pablo (8/11): en el viaje, lo que no se hace con normalidad se compensa subiendo MUCHO la intensidad
 * (no el volumen): menos descanso, más densidad, tempo y pausas en la fuerza con mancuerna, chaleco si lo hay y un final tipo P corto.
 */
function intensificarViaje_(txt, mat, seccion) {
  var r = ['', '⚡ INTENSIDAD AL ALZA (viaje: compensa la falta de material y de CrossFit puro)'];
  r.push('· Descansos −40–50 % y objetivo RPE 8–9 en todo el bloque.');
  if (seccion === 'fuerza') r.push('· Fuerza con implemento ligero: tempo 4″ en la bajada + pausa 2″ abajo, 1½ reps o unilateral; última serie hasta RIR 1.');
  if (seccion === 'metcon') r.push('· Metcon: misma duración con más densidad (sin pausas en los cambios) y la última ronda a tope.');
  if (seccion === 'skills') r.push('· Skills: series cortas de máxima calidad con menos descanso; añade una variante más difícil (déficit, pausa, estricto).');
  if (mat.chaleco) r.push('· Chaleco puesto en gimnásticos, saltos, burpees y carrera.');
  r.push('· Final (5–6′, si el bloque no era ya intenso): 6 × 20″ ALL-OUT ' + (mat._correr ? 'sprint en cuesta' : mat.comba ? 'double unders' : 'burpees') + ' / 40″ suave.');
  return txt + r.join('\n');
}

// ---------- huecos y colocación ----------
/** slots: [{iso, turno, ok, cap, mat, correr:{libre,tempo,series}, tipo:'casa'|'viaje'}] */
function colocar_(fila, slots, ocupado, durasPorIso, opts) {
  opts = opts || {};
  var extraX = norm(fila.ORIGEN) !== 'FABRIK' && !esIntocable_(codigosDe_(fila['CÓDIGOS']));
  var dura = esDura_(fila), cand = slots.filter(function (s) {
    if (!s.ok || (opts.desde && horaDe_(s.iso, s.turno) < opts.desde)) return false;
    if ((ocupado[s.iso + s.turno] || 0) + fila._min > s.cap) return false;
    if (extraX && (ocupado['#' + s.iso + s.turno] || 0) >= EXTRAS_MAX_.n && !opts.forzar) return false;   // v0.29 · Reorganizar no amontona extras
    if (s.turno === 'PM' && materialVeto_(codigosDe_(fila['CÓDIGOS']), s.iso, 'PM') && !opts.forzar) return false;
    if (esCarreraFila_(fila)) { if (s.tipo === 'viaje' && !(s.correr && (s.correr.libre || s.correr.tempo || s.correr.series))) return false;
      if (/W04|R02|R03|V01/.test(fila['CÓDIGOS'] || '') && s.tipo === 'viaje' && !(s.correr.series || (/R02/.test(fila['CÓDIGOS']) && s.correr.tempo))) return false; }
    if (s.tipo === 'viaje' && tipoSeccion_(fila) === 'fuerza' && !s.mat.barra && !s.mat.box) return false;
    if (dura) { var malo = Object.keys(durasPorIso).some(function (d) { return Math.abs((new Date(d) - new Date(s.iso)) / 864e5) < 2; }); if (malo && !opts.forzar) return false; }   // nunca dos duras el mismo día ni a <48 h
    return true;
  });
  var cz = codigosDe_(fila['CÓDIGOS']), apr = function (s) { return cz.length ? sesgoAprendido_(cz, { iso: s.iso }, s.turno).p * 0.5 : 0; };   // v0.26 · preferencias aprendidas de turno y día
  cand.sort(function (a, b) {
    var pa = apr(a) + (a.iso === fila._iso ? -3 : 0) + (a.tipo === 'casa' ? -1 : 0) + Math.abs(new Date(a.iso) - new Date(fila._iso)) / 864e5 * 0.3 + (a.turno === fila._turno ? -0.5 : 0);
    var pb = apr(b) + (b.iso === fila._iso ? -3 : 0) + (b.tipo === 'casa' ? -1 : 0) + Math.abs(new Date(b.iso) - new Date(fila._iso)) / 864e5 * 0.3 + (b.turno === fila._turno ? -0.5 : 0);
    return pa - pb;
  });
  var s = cand[0]; if (!s) return null;
  ocupado[s.iso + s.turno] = (ocupado[s.iso + s.turno] || 0) + fila._min;
  if (extraX) ocupado['#' + s.iso + s.turno] = (ocupado['#' + s.iso + s.turno] || 0) + 1;
  if (dura) durasPorIso[s.iso] = 1;
  return s;
}
function cargaBase_(filas) { var o = {}; filas.forEach(function (r) { o[r._iso + r._turno] = (o[r._iso + r._turno] || 0) + r._min; if (norm(r.ORIGEN) !== 'FABRIK' && !esIntocable_(codigosDe_(r['CÓDIGOS']))) o['#' + r._iso + r._turno] = (o['#' + r._iso + r._turno] || 0) + 1; }); return o; }

// ---------- 1 · VIAJE ----------
/**
 * p = { desde, hasta, dias: { iso: { AM: 'libre'|'imposible'|'desplazamiento', PM: … } }, material: [claves], excepciones: { 'iso|AM': [claves] },
 *       correr: { libre, tempo, series }, correrDias: { 'iso|AM': true }, rutas: [{ iso, turno, min }], domingoCompleto: true }
 */
function proponerViaje_(lunes, p) {
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && r._iso >= hoyIso_(); });
  var base = cargaBase_(filas), w = pesoCarencias_(lunes), slots = [], cambios = [], avisos = [];
  for (var k = 0; k < 7; k++) {
    var iso = sumarDias(lunes, k); if (iso < hoyIso_()) continue;
    ['AM', 'PM'].forEach(function (t) {
      var enViaje = iso >= p.desde && iso <= p.hasta, d = (p.dias || {})[iso] || {}, est = enViaje ? (d[t] || 'libre') : 'casa';
      var mat = mapaMaterial_(((p.excepciones || {})[iso + '|' + t]) || p.material, (p.correrDias || {})[iso + '|' + t]);
      var b = base[iso + t] || 0, cap = enViaje ? CAP_TURNO_[t] : (b ? Math.max(b * 1.4, b + 20) : CAP_TURNO_[t]);
      if (!enViaje && k === 6 && !b && p.domingoCompleto !== false) cap = 150;
      slots.push({ iso: iso, turno: t, ok: est === 'libre' || est === 'casa', cap: cap, mat: enViaje ? mat : mapaMaterial_(['box'], true), correr: enViaje ? ((p.correrDias || {})[iso + '|' + t] ? p.correr || {} : {}) : { libre: 1, tempo: 1, series: 1 }, tipo: enViaje ? 'viaje' : 'casa' });
    });
  }
  var ocupado = {}, duras = {};
  filas.forEach(function (r) { if (!(r._iso >= p.desde && r._iso <= p.hasta)) { ocupado[r._iso + r._turno] = (ocupado[r._iso + r._turno] || 0) + r._min; if (esDura_(r)) duras[r._iso] = 1; } });
  var afect = filas.filter(function (r) { return r._iso >= p.desde && r._iso <= p.hasta; }).sort(function (a, b) { return prioridadFila_(b, w) - prioridadFila_(a, w); });
  // domingo completo: el día de viaje con más Fabrik que no se puede hacer va entero al domingo
  var dom = sumarDias(lunes, 6), sDom = slots.filter(function (s) { return s.iso === dom && s.tipo === 'casa' && s.turno === 'PM'; })[0];
  if (sDom && p.domingoCompleto !== false && !(base[dom + 'PM'] || base[dom + 'AM'])) {
    var porDia = {}; afect.forEach(function (r) { if (norm(r.ORIGEN) === 'FABRIK') { var sl = slots.filter(function (s) { return s.iso === r._iso && s.turno === r._turno; })[0]; if (!sl || !sl.ok || !sl.mat.barra) (porDia[r._iso] = porDia[r._iso] || []).push(r); } });
    var mejor = Object.keys(porDia).sort(function (a, b) { return porDia[b].length - porDia[a].length; })[0];
    if (mejor) porDia[mejor].forEach(function (r) { cambios.push({ id: r.ID, accion: 'mover', iso: dom, turno: 'PM', motivo: 'Día completo de ' + diaDe_(mejor) + ' al domingo (no se puede hacer en el viaje)' }); ocupado[dom + 'PM'] = (ocupado[dom + 'PM'] || 0) + r._min; r._hecho = true; });
  }
  afect.forEach(function (r) {
    if (r._hecho) return;
    var sl = slots.filter(function (s) { return s.iso === r._iso && s.turno === r._turno; })[0];
    if (sl && sl.ok && sl.tipo === 'viaje') {
      var ad = esCarreraFila_(r) ? null : adaptarMaterial_(r.CONTENIDO, sl.mat);
      var vale = esCarreraFila_(r) ? (sl.correr.libre || sl.correr.tempo || sl.correr.series) && !(/W04|R03|V01/.test(r['CÓDIGOS']) && !sl.correr.series && !(/R02/.test(r['CÓDIGOS']) && sl.correr.tempo))
        : !(tipoSeccion_(r) === 'fuerza' && !sl.mat.barra) && ad.ratio <= 0.6;
      if (vale && (ocupado[sl.iso + sl.turno] || 0) + r._min <= sl.cap) {
        ocupado[sl.iso + sl.turno] = (ocupado[sl.iso + sl.turno] || 0) + r._min;
        if (ad && ad.cambios) cambios.push({ id: r.ID, accion: 'adaptar', iso: sl.iso, turno: sl.turno, contenido: intensificarViaje_(ad.txt, sl.mat, tipoSeccion_(r)), motivo: 'Adaptado a tu material con intensidad al alza (' + ad.cambios + ' cambios; conserva ' + ad.conserva.join(', ') + ')' });
        else if (esCarreraFila_(r) && /R02/.test(r['CÓDIGOS']) && !sl.correr.series) cambios.push({ id: r.ID, accion: 'adaptar', iso: sl.iso, turno: sl.turno, contenido: '12′ fáciles\n20′ continuos a ritmo umbral (tempo), los últimos 4′ algo más rápidos\n8′ suaves', motivo: 'Sin sitio para series: la calidad Z4 pasa a tempo continuo (misma zona, final más rápido)' });
        return;
      }
    }
    var s = colocar_(r, slots, ocupado, duras);
    if (s) cambios.push({ id: r.ID, accion: s.tipo === 'viaje' ? 'adaptar' : 'mover', iso: s.iso, turno: s.turno, contenido: s.tipo === 'viaje' && !esCarreraFila_(r) ? intensificarViaje_(adaptarMaterial_(r.CONTENIDO, s.mat).txt, s.mat, tipoSeccion_(r)) : null, motivo: s.tipo === 'casa' ? 'Se compensa en casa (' + diaDe_(s.iso) + ', tope +40 %)' : 'Movido dentro del viaje a un hueco con material' });
    else cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'No cabe sin pasar del +40 % ni juntar sesiones duras: a pendientes' });
  });
  (p.rutas || []).forEach(function (rt) { cambios.push({ accion: 'nuevo', iso: rt.iso, turno: rt.turno || 'AM', nuevo: { ORIGEN: 'VIAJE', 'TÍTULO': 'Ruta andando · Z1', CONTENIDO: 'Ruta a pie ' + (rt.min ? '≈' + rt.min + '′' : '') + ' a ritmo cómodo.\nCuenta como Z1 (no como Z2 de carrera). Al día siguiente, menos pierna.', MIN: rt.min || 90, INTENSIDAD: '🔵 Z1', 'CÓDIGOS': '' }, motivo: 'Ruta marcada en el viaje' }); });
  // vuelta progresiva: el primer día en casa sin la sesión más dura si se puede
  var vuelta = sumarDias(p.hasta, 1); if (vuelta <= sumarDias(lunes, 6)) avisos.push('Primer día de vuelta (' + diaDe_(vuelta) + '): si llegas cansado del viaje, baja un 10–20 % la sesión más pesada.');
  return { cambios: cambios, avisos: avisos, resumen: 'Viaje ' + isoAFecha(p.desde).slice(0, 5) + '–' + isoAFecha(p.hasta).slice(0, 5) + ': ' + cambios.filter(function (c) { return c.accion === 'adaptar'; }).length + ' adaptados, ' + cambios.filter(function (c) { return c.accion === 'mover'; }).length + ' a casa, ' + cambios.filter(function (c) { return c.accion === 'pendiente'; }).length + ' a pendientes' };
}

// ---------- 2 · REORGANIZACIÓN ----------
/** Bloque desde un estímulo escrito («hspu»): el código del catálogo que más falta y encaja. */
function bloqueDeEstimulo_(txt, w) {
  var cat = catalogo_(), q = norm(txt), cands = Object.keys(cat).filter(function (c) {
    var r = cat[c]; return r.CONTENIDO && (norm(r.NOMBRE).indexOf(q) >= 0 || q.indexOf(norm(c)) >= 0 || (reSeguro_(r['DETECTAR (regex)']) && reSeguro_(r['DETECTAR (regex)']).test(q)));
  }).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
  var c = cands[0]; if (!c) return null;
  var r = cat[c];
  return { ORIGEN: 'REORGANIZADO', 'TÍTULO': r.NOMBRE, CONTENIDO: r.CONTENIDO, MIN: r.MIN || 12, INTENSIDAD: r.INTENSIDAD, 'CÓDIGOS': c, 'POR QUÉ (cursiva)': r['POR QUÉ (cursiva)'] || '', 'CIENCIA (técnica · fisiología · biología)': r['CIENCIA (técnica · fisiología · biología)'] || '' };
}
/**
 * p = { huecos: [{ iso, turno, min }], noHechos: [ids], nuevos: [{ estimulo } | { titulo, contenido, min }], carrera: { id: 'aparte'|'no'|'metcon' },
 *       tipo: 'A'|'B', mega: { formato: 'solo'|'pareja'|'equipo3'|'equipo4', material: [], barraMax, dbMax, chica: { barra, db, sandbag }, chaleco: n, minutos } }
 */
function proponerReorg_(lunes, p) {
  var todas = filasSemanaActivas_(lunes), w = pesoCarencias_(lunes), cambios = [], avisos = [];
  var no = {}; (p.noHechos || []).forEach(function (id) { no[id] = 1; });
  var pend = todas.filter(function (r) { return no[r.ID]; });
  (p.nuevos || []).forEach(function (n) {
    var o = n.estimulo ? bloqueDeEstimulo_(n.estimulo, w) : { ORIGEN: 'REORGANIZADO', 'TÍTULO': n.titulo || 'Bloque nuevo', CONTENIDO: n.contenido || '', MIN: n.min || 15, 'CÓDIGOS': '' };
    if (o) { o.ID = '_n' + pend.length; o._nuevo = true; o._iso = hoyIso_(); o._turno = 'PM'; o._min = minFila_(o); pend.push(o); }
    else avisos.push('No encuentro un estímulo para «' + n.estimulo + '»: escríbelo de otra forma o diséñalo a mano.');
  });
  // lo ya trabajado esta semana resta prioridad (metas semanales ya cubiertas)
  var cubiertas = {}; avanceMetas_('Semana', periodoSemana_(lunes), cacheMetas_()).forEach(function (m) { if (m.pReal >= 1) codigosDe_(m.codigos).forEach(function (c) { cubiertas[c] = 1; }); });
  pend.forEach(function (r) { r._prio = prioridadFila_(r, w) * (codigosDe_(r['CÓDIGOS']).some(function (c) { return cubiertas[c]; }) ? 0.4 : 1); });
  pend.sort(function (a, b) { return b._prio - a._prio; });
  pend.forEach(function (r) { if (!r._nuevo) cambios.push({ id: r.ID, accion: 'sustituir', motivo: 'No hecho: se reorganiza' }); });
  // carrera
  var carreras = pend.filter(esCarreraFila_), resto = pend.filter(function (r) { return !esCarreraFila_(r); });
  var huecos = (p.huecos || []).map(function (h) { return { iso: h.iso, turno: h.turno, min: +h.min || CAP_TURNO_[h.turno], usado: 0, bloques: [] }; }).sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.turno < b.turno ? -1 : 1; });
  var metconExtra = [];
  carreras.forEach(function (r) {
    var dec = (p.carrera || {})[r.ID] || 'aparte';
    if (dec === 'aparte') {
      var h = huecos.filter(function (x) { return x.turno === 'AM' && x.min - x.usado >= r._min && huecos.some(function (y) { return y.iso === x.iso && y.turno === 'PM'; }); })[0] || huecos.filter(function (x) { return x.min - x.usado >= r._min; })[0];
      if (h) { h.usado += r._min; cambios.push({ id: r.ID, accion: 'mover', iso: h.iso, turno: h.turno, motivo: 'Carrera aparte' + (h.turno === 'AM' ? ' por la mañana (≥6 h de la fuerza de la tarde)' : '') }); return; }
      dec = esZ2Fila_(r) ? 'no' : 'metcon';
    }
    if (dec === 'metcon') { metconExtra.push(r); return; }
    if (esZ2Fila_(r)) cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'Z2 no hecha: la semana que viene +' + Math.round(r._min * 0.25) + '′ (+25 %) en la Z2' });
    else cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'Carrera no hecha: a pendientes' });
  });
  // v0.16.2 · destino elegido por bloque: auto (huecos) · pendiente (semana que viene) · hueco|iso|turno · integrar|idOtro · mega
  var dest = p.destino || {}, megaSel = [], integ = {};
  resto = resto.filter(function (r) {
    var k = String(dest[r.ID] || 'auto').split('|'), tit = r['TÍTULO'] || r.BLOQUE || '';
    if (k[0] === 'pendiente') { cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'Lo dejas para la semana que viene' }); return false; }
    if (k[0] === 'hueco' && k[1]) { cambios.push({ id: r.ID, accion: 'mover', iso: k[1], turno: k[2] === 'AM' ? 'AM' : 'PM', motivo: 'Donde elegiste (' + diaDe_(k[1]).toLowerCase() + ' ' + (k[2] === 'AM' ? 'AM' : 'PM') + ')' }); return false; }
    if (k[0] === 'integrar' && k[1]) {
      var t = todas.filter(function (x) { return x.ID === k[1] && !no[x.ID]; })[0];
      if (t) { (integ[t.ID] = integ[t.ID] || { t: t, bl: [] }).bl.push(r); return false; }
      avisos.push('No encuentro el bloque con el que integrar «' + tit + '»: lo meto en los huecos.'); return true;
    }
    if (k[0] === 'mega' && p.tipo !== 'B') { megaSel.push(r); return false; }
    return true;
  });
  Object.keys(integ).forEach(function (tid) {
    var I = integ[tid], t = I.t, extra = I.bl.reduce(function (a, r) { return a + r._min; }, 0), cap = CAP_TURNO_[t._turno] || 120, recorta = t._min + extra > cap;
    var cont = String(t.CONTENIDO || '') + I.bl.map(function (r) { return '\n\n+ INTEGRADO · ' + (r['TÍTULO'] || r.BLOQUE) + ' (no hecho el ' + diaDe_(r._iso).toLowerCase() + ')' + (recorta ? ' · al 50 % para no pasar de ' + cap + '′' : '') + '\n' + (recorta ? mitadVolumen_(r.CONTENIDO).txt : (r.CONTENIDO || '')); }).join('');
    cambios.push({ id: tid, accion: 'adaptar', iso: t._iso, turno: t._turno, contenido: cont, motivo: 'Integra ' + I.bl.map(function (r) { return '«' + (r['TÍTULO'] || r.BLOQUE) + '»'; }).join(', ') + (recorta ? ' al 50 % (la sesión pasaría de ' + cap + '′)' : '') });
  });
  if (megaSel.length) {
    var hm = huecos[0];
    if (!hm) avisos.push('Para meter bloques en el mega WOD marca al menos un hueco.');
    else { var mgS = megaWod_(megaSel, p.mega || { formato: 'solo', material: ['box'] }, w, cubiertas, Math.min(hm.min, (p.mega || {}).minutos || 45)); hm.usado += +mgS.MIN || 45;
      cambios.push({ accion: 'nuevo', iso: hm.iso, turno: hm.turno, nuevo: mgS, motivo: 'Mega WOD con lo que elegiste' }); }
  }
  if (p.tipo === 'B') {
    var h0 = huecos[0]; if (!h0) return { cambios: cambios, avisos: ['Marca al menos un hueco.'], resumen: 'Sin huecos' };
    var mega = megaWod_(resto.concat(metconExtra), p.mega || {}, w, cubiertas, Math.min(h0.min, (p.mega || {}).minutos || h0.min));
    cambios.push({ accion: 'nuevo', iso: h0.iso, turno: h0.turno, nuevo: mega, motivo: 'Mega WOD con lo pendiente' });
  } else {
    // Tipo A: por hueco, calentamiento → skills → fuerza → metcon
    var orden = ['calentamiento', 'skills', 'fuerza', 'metcon', 'accesorio'];
    resto.forEach(function (r) {
      var h = huecos.filter(function (x) { return x.min - x.usado - 10 >= r._min; })[0];
      if (!h) { if (!r._nuevo) cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'No cabe en el tiempo disponible (prioridad más baja)' }); else avisos.push('«' + r['TÍTULO'] + '» no cabe en el tiempo marcado.'); return; }
      h.usado += r._min; h.bloques.push(r);
    });
    huecos.forEach(function (h) {
      if (!h.bloques.length) return;
      var sec = {}; h.bloques.forEach(function (r) { var t = tipoSeccion_(r); (sec[t] = sec[t] || []).push(r); });
      var faltaCalent = Object.keys(w).filter(function (c) { return /W10|W33|W32|W15/.test(c) && w[c] > 0; });
      var cal = ['CALENTAMIENTO ACTIVO · 10–12′', '2 rondas: 200 m trote o 250 m remo · 10 PVC pass-through · 8 cat-cow · 10 air squat · 5 inchworm + push-up']
        .concat(faltaCalent.length ? ['+ ya atacando lo pendiente: ' + faltaCalent.map(function (c) { return (catalogo_()[c] || {}).NOMBRE || c; }).join(', ') + ' (sin fatiga)'] : []);
      (sec.calentamiento || []).forEach(function (r) { cal.push('+ ' + r['TÍTULO'] + ': ' + String(r.CONTENIDO || '').split('\n')[0]); });
      cambios.push({ accion: 'nuevo', iso: h.iso, turno: h.turno, nuevo: { ORIGEN: 'REORGANIZADO', 'TÍTULO': 'A · Calentamiento activo', CONTENIDO: cal.join('\n'), MIN: 12, 'CÓDIGOS': '' }, motivo: 'Sesión clásica' });
      ['skills', 'fuerza', 'metcon', 'accesorio'].forEach(function (t, i) {
        var bl = sec[t]; if (!bl || !bl.length) return;
        var cont = bl.map(function (r) { return '— ' + (r['TÍTULO'] || r.BLOQUE) + ' —\n' + (r.CONTENIDO || ''); }).join('\n\n');
        if (t === 'metcon' && metconExtra.length) cont += '\n\n+ CARRERA PENDIENTE DENTRO DEL METCON: añade 400 m RUN al inicio de cada ronda (o 20/16 cal de erg si no hay sitio para correr).\nCuenta como carrera en fatiga, no como Z2.';
        cambios.push({ accion: 'nuevo', iso: h.iso, turno: h.turno, nuevo: { ORIGEN: 'REORGANIZADO', 'TÍTULO': String.fromCharCode(66 + i) + ' · ' + { skills: 'Skills', fuerza: 'Fuerza', metcon: 'Metcon', accesorio: 'Accesorios' }[t] + ' · ' + bl.map(function (r) { return r['TÍTULO'] || r.BLOQUE; }).join(' + ').slice(0, 80),
          CONTENIDO: cont, MIN: bl.reduce(function (a, r) { return a + r._min; }, 0), INTENSIDAD: bl[0].INTENSIDAD || '', 'CÓDIGOS': bl.map(function (r) { return r['CÓDIGOS']; }).filter(Boolean).join('|'),
          'POR QUÉ (cursiva)': 'Recupera lo no hecho de la semana, ordenado por tus carencias: ' + bl.map(function (r) { return r['TÍTULO'] || r.BLOQUE; }).join(', ') + '.' }, motivo: 'Sesión clásica' });
      });
      if (metconExtra.length && !sec.metcon) cambios.push({ accion: 'nuevo', iso: h.iso, turno: h.turno, nuevo: { ORIGEN: 'REORGANIZADO', 'TÍTULO': 'Cierre · ergómetro Z2 15′', CONTENIDO: '15′ de ergómetro suave (Z2, conversación).\nRecupera parte del endurance pendiente.', MIN: 15, 'CÓDIGOS': 'W03', INTENSIDAD: '🔵 Z2' }, motivo: 'Carrera pendiente → ergómetro' });
    });
    // aviso semana siguiente: pierna el domingo y pierna el lunes
    var dom = sumarDias(lunes, 6), lunSig = sumarDias(lunes, 7);
    if (huecos.some(function (h) { return h.iso === dom && h.bloques.some(function (r) { return cargasFila_(r).indexOf('PIERNA') >= 0; }); }) && listar_(HOJAS.PLAN).some(function (r) { return celdaIso_(r.FECHA) === lunSig && cargasFila_(r).indexOf('PIERNA') >= 0; }))
      avisos.push('Ojo: el domingo cargas pierna y el lunes Fabrik también: baja un 20 % la pierna del domingo.');
  }
  return { cambios: cambios, avisos: avisos, resumen: 'Reorganización ' + (p.tipo === 'B' ? 'integrada (mega WOD)' : 'clásica') + ': ' + pend.length + ' bloques pendientes · ' + cambios.filter(function (c) { return c.accion === 'pendiente'; }).length + ' a pendientes' };
}

// ---------- mega WOD (tipo B) ----------
var MOV_MEGA_ = [
  { re: /THRUSTER/, n: 'THRUSTERS', mat: 'barra', alt: 'db', reps: 12, carga: 'barra', c: 'T02' }, { re: /DOUBLE UNDER|(^|[^A-Z])DUS?([^A-Z]|$)/, n: 'DOUBLE UNDERS', mat: 'comba', reps: 50, c: 'C01' },
  { re: /STOH|SHOULDER TO OVERHEAD|JERK|PUSH PRESS/, n: 'SHOULDER TO OVERHEAD', mat: 'barra', alt: 'db', reps: 12, carga: 'barra', c: 'M07' }, { re: /FRONT SQUAT/, n: 'FRONT SQUATS', mat: 'barra', alt: 'db', reps: 12, carga: 'barra', c: 'C02' },
  { re: /BURPEE/, n: 'BURPEES OVER THE BAR', mat: '', reps: 12, c: 'C03' }, { re: /HANG|SNATCH|CLEAN/, n: 'HANG POWER CLEANS', mat: 'barra', alt: 'db', reps: 10, carga: 'barra', c: 'C04' },
  { re: /CHEST TO BAR|C2B/, n: 'CHEST TO BAR', mat: 'rack_dominadas', reps: 12, c: 'M01' }, { re: /BAR MUSCLE|BMU/, n: 'BAR MUSCLE UPS', mat: 'bmu', reps: 6, c: 'M48' },
  { re: /RING MUSCLE|RMU/, n: 'RING MUSCLE UPS', mat: 'anillas', reps: 5, c: 'M49' }, { re: /HSPU/, n: 'HSPU', mat: 'hspu', reps: 10, c: 'W31' },
  { re: /TOES TO BAR|T2B/, n: 'TOES TO BAR', mat: 'rack_dominadas', reps: 15, c: '' }, { re: /WALL ?BALL/, n: 'WALL BALLS', mat: 'slamball', reps: 20, c: '' },
  { re: /BOX/, n: 'BOX JUMP OVERS', mat: 'cajon', reps: 12, c: 'W07' }, { re: /SANDBAG/, n: 'SANDBAG CLEANS', mat: 'sandbag', reps: 10, carga: 'sandbag', c: 'M57' },
  { re: /SLAM/, n: 'SLAMBALLS', mat: 'slamball', reps: 15, c: 'M57' }, { re: /ROPE/, n: 'ROPE CLIMBS', mat: 'cuerda', reps: 3, c: 'M36' },
  { re: /SLED|TRINEO/, n: 'SLED PUSH 15 m', mat: 'trineo', reps: 2, c: 'M38' }, { re: /YOKE|YUGO/, n: 'YOKE CARRY 15 m', mat: 'yugo', reps: 2, c: '' },
  { re: /LUNGE/, n: 'DB WALKING LUNGES', mat: 'db', reps: 16, carga: 'db', c: '' },
  { re: /GUSANO|WORM/, n: 'WORM (GUSANO) CLEANS + CARRY 20 m', mat: 'gusano', reps: 6, c: '', equipo: true }, { re: /LODGE|OVER THE WALL/, n: 'SANDBAG OVER LODGE', mat: 'lodge_lanzar', reps: 8, c: 'M57', equipo: true },
  { re: /JUMP OVER/, n: 'JUMP OVER LODGE', mat: 'lodge_saltar', reps: 10, c: 'W07', equipo: true }, { re: /DEADLIFT/, n: 'DEADLIFTS', mat: 'barra', reps: 10, carga: 'barra', c: '' }
];
var ERG_MEGA_ = [['ergos', 'cal ASSAULT BIKE'], ['ergos', 'cal ROW'], ['ergos', 'cal SKI'], ['_correr', 'm RUN']];
var FORMATOS_EQUIPO_ = {
  solo: ['', '', '', ''],
  pareja: ['SINCRO (los dos a la vez)', 'ACUMULADO (repartid como queráis)', 'RELEVO: uno trabaja, otro descansa', 'LOS DOS (cada uno sus reps)'],
  equipo3: ['SINCRO DE 3', '2 TRABAJAN · 1 DESCANSA (rotad)', 'ACUMULADO DE EQUIPO', 'TODO EL EQUIPO'],
  equipo4: ['SINCRO 2 + 2', '3 TRABAJAN · 1 DESCANSA (rotad)', 'ACUMULADO DE EQUIPO', 'TODO EL EQUIPO']
};
function megaWod_(pend, o, w, cubiertas, minutos) {
  var mat = mapaMaterial_(o.material || [], (o.material || []).indexOf('_correr') >= 0 || (o.material || []).indexOf('correr') >= 0);
  var n = { solo: 1, pareja: 2, equipo3: 3, equipo4: 4 }[o.formato || 'solo'] || 1, fm = FORMATOS_EQUIPO_[o.formato || 'solo'] || FORMATOS_EQUIPO_.solo;
  var txt = pend.map(function (r) { return norm((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || '')); }).join('\n');
  var tiene = function (m) { return !m.mat || mat[m.mat] || (m.alt && mat[m.alt]); };
  var MOVS = movsMega_();   // v0.15: de MOTOR_GUIA.md
  // movimientos: primero lo que pides en «Estímulos que quiero», luego lo que sale en lo pendiente y lo de más carencia aún no cubierto esta semana
  var D = o.deseo ? parseDeseo_(o.deseo, guiaMotor_()) : null;
  var movs = D ? MOVS.filter(function (m) { return tiene(m) && D.movs.some(function (g) { return g.k === m.k; }); }) : [];
  if (D) D.patrones.forEach(function (p) { if (p === 'MONO' || movs.some(function (m) { return m.patron === p; })) return; var c = MOVS.filter(function (m) { return m.patron === p && tiene(m) && movs.indexOf(m) < 0; }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); })[0]; if (c) movs.push(c); });
  MOVS.filter(function (m) { return m.re.test(txt) && tiene(m) && movs.indexOf(m) < 0; }).forEach(function (m) { movs.push(m); });
  MOVS.filter(function (m) { return movs.indexOf(m) < 0 && tiene(m) && m.c && !cubiertas[m.c]; }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); }).forEach(function (m) { if (movs.length < 8) movs.push(m); });
  if (n > 1) MOVS.filter(function (m) { return m.equipo && mat[m.mat] && movs.indexOf(m) < 0; }).forEach(function (m) { movs.splice(1, 0, m); });   // material de equipo marcado: entra
  if (movs.length < 4) MOVS.filter(function (m) { return movs.indexOf(m) < 0 && tiene(m); }).slice(0, 4 - movs.length).forEach(function (m) { movs.push(m); });
  var ergs = ERG_MEGA_.filter(function (e) { return mat[e[0]]; }); if (!ergs.length) ergs = [['', 'BURPEES (en vez de erg)']];
  if (D && D.ergs.length) { var pe = D.ergs.map(ergMegaDe_).filter(function (e) { return e && mat[e[0]]; }); if (pe.length) ergs = pe.concat(ergs.filter(function (e) { return !pe.some(function (x) { return x[1] === e[1]; }); })); }
  var bar = +o.barraMax || 60, db = +o.dbMax || 22.5, ch = o.chica || null;
  var carga = function (m) {
    if (m.carga === 'barra' && mat.barra) return ' (' + Math.min(bar, /CLEAN|DEADLIFT/.test(m.n) ? 70 : 50) + ' kg' + (ch && ch.barra ? ' / ♀ ' + ch.barra + ' kg' : '') + ')';
    if ((m.carga === 'barra' && !mat.barra && mat.db) || m.carga === 'db') return ' (DB ' + Math.min(db, 22.5) + ' kg' + (ch && ch.db ? ' / ♀ ' + ch.db + ' kg' : '') + ')';
    if (m.carga === 'sandbag') return ' (sandbag' + (ch && ch.sandbag ? ' / ♀ ' + ch.sandbag + ' kg' : '') + ')';
    return '';
  };
  var nombre = function (m) { return (m.carga === 'barra' && !mat.barra && mat.db ? 'DB ' : '') + m.n + carga(m); };
  var r = function (m, f) { return Math.round(m.reps * f * (n > 1 ? n * 0.75 : 1)); };
  var T = Math.max(30, Math.min(75, +minutos || 45)), partes = [], usado = 0, k = 0;
  var fuerza = pend.filter(function (x) { return tipoSeccion_(x) === 'fuerza'; });
  if (fuerza.length && mat.barra) { var mF = Math.round(T * 0.18); partes.push('BUY-IN PESADO · EMOM ' + mF + '′\n' + (n > 1 ? 'Alternando: ' : '') + '1–2 ' + norm(fuerza[0]['TÍTULO'] || 'LEVANTAMIENTO').replace(/^\d+:\s*/, '') + ' al 80–88 % (lo pendiente de fuerza, sin diluirlo)'); usado += mF + 2; }
  var bloquesMin = [];
  var restante = T - usado - (o.cashout ? 15 : 0);
  var nb = restante >= 50 ? 4 : restante >= 35 ? 3 : 2, dur = Math.floor(restante / nb) - 2;
  for (var b = 0; b < nb; b++) {
    var a = movs[(k++) % movs.length], c = movs[(k++) % movs.length], e = ergs[b % ergs.length], fmt = fm[b % fm.length];
    var conf = n > 1 ? '\nMaterial: ' + (n === 2 ? (b % 2 ? '1 barra + 2 DB' : '2 barras') : n === 3 ? (b % 2 ? '2 barras + 1 erg' : '1 barra + 2 DB + 1 erg') : (b % 2 ? '2 barras + 2 DB' : '2 ergs + 2 barras')) : '';
    var ergTxt = /RUN/.test(e[1]) ? (200 * n) + ' m RUN' : /BURPEES/.test(e[1]) ? (10 * n) + ' BURPEES' : (15 * n) + '/' + (12 * n) + ' ' + e[1];
    var tipos = [
      'PARTE ' + (b + 1) + ' · AMRAP ' + dur + '′' + (fmt ? ' · ' + fmt : '') + conf + '\n' + ergTxt + '\n' + r(a, 1) + ' ' + nombre(a) + '\n' + r(c, 1) + ' ' + nombre(c),
      'PARTE ' + (b + 1) + ' · EVERY 4′ × ' + Math.max(2, Math.floor(dur / 4)) + (fmt ? ' · ' + fmt : '') + ' (P1: 60–75″ al 90 %)' + conf + '\n' + ergTxt + '\n' + r(a, 0.7) + ' ' + nombre(a) + '\n' + r(c, 0.7) + ' ' + nombre(c),
      'PARTE ' + (b + 1) + ' · FOR TIME · cap ' + dur + '′' + (fmt ? ' · ' + fmt : '') + conf + '\n21-15-9\n' + nombre(a) + '\n' + nombre(c) + '\n+ ' + ergTxt + ' entre rondas',
      'PARTE ' + (b + 1) + ' · EMOM ' + dur + '′' + (fmt ? ' · ' + fmt : '') + ' (P4: impar umbral / par pico)' + conf + '\nMIN IMPAR: ' + ergTxt.replace(/^\d+/, function (x) { return Math.round(+x * 0.8); }) + '\nMIN PAR: ' + r(a, 0.6) + ' ' + nombre(a) + ' + ' + r(c, 0.5) + ' ' + nombre(c)
    ];
    partes.push(tipos[b % 4]); bloquesMin.push(dur);
  }
  if (o.cashout) partes.push('CASH-OUT · 15′ ergómetro Z2 suave (recupera parte del endurance pendiente; cuenta como ergo Z2)');
  var chal = +o.chaleco > 0 ? '\nChaleco: ' + o.chaleco + (o.chaleco > 1 ? ' atletas' : ' atleta') + ' en burpees, saltos, gimnásticos y carrera (no con barra por encima de la cabeza).' : '';
  var cods = movs.map(function (m) { return m.c; }).filter(Boolean).concat(pend.map(function (x) { return x['CÓDIGOS']; }).filter(Boolean)).join('|').split('|').filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  return {
    ORIGEN: 'REORGANIZADO', 'TÍTULO': 'MEGA WOD · ' + T + '′ · ' + ({ solo: 'individual', pareja: 'en pareja', equipo3: 'equipo de 3', equipo4: 'equipo de 4' }[o.formato || 'solo']),
    CONTENIDO: partes.join('\n\n— 2′ de transición —\n\n') + chal + '\n\nMARCADOR: total de reps de los AMRAP + tiempo de los FOR TIME.\nRITMO: el primer bloque al 80 %, sube en los siguientes; las partes P1/P4 sí al 90 %.',
    MIN: T, INTENSIDAD: '🔴 Mega WOD', 'CÓDIGOS': cods.join('|'),
    'POR QUÉ (cursiva)': (o.deseo ? 'Pediste «' + String(o.deseo).trim() + '»: va primero. ' : '') + 'Integra lo pendiente de la semana (' + pend.map(function (x) { return x['TÍTULO'] || x.BLOQUE; }).slice(0, 6).join(', ') + ') y lo que más te falta y aún no has hecho esta semana, en formato de competición. Lo ya cubierto en la semana no se repite.',
    'CIENCIA (técnica · fisiología · biología)': 'Alterna partes por encima de umbral (P1/P4: H⁺ y aclarado de lactato) con partes sostenidas: adaptaciones centrales (gasto cardiaco) y periféricas (tampón, capilares). La fuerza pendiente va al principio y en fresco para no diluir su estímulo neural (manual §16).'
  };
}

// ---------- 3 · COMPETI ----------
/**
 * p = { tipo: 'online'|'fisica', iso, turno, dias: [iso…], wod: 'texto' }
 * Online: 24 h antes descanso (Z2 suave como mucho) · 24–48 h −50 % protegiendo lo implicado · no se suprimen P ni extras: se recolocan.
 * Física: se suprimen P1–P4 y extras · 72–48 h volumen medio-bajo intensidad alta · 48–24 h repaso con volumen mínimo · 24 h descanso.
 * Después: 24 h mínimas; lo quitado se compensa el resto de la semana (día siguiente a la grabación como mucho +40 %).
 */
function proponerCompeti_(lunes, p) {
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho; }), w = pesoCarencias_(lunes), cambios = [], avisos = [];
  var dias = p.tipo === 'fisica' ? (p.dias || []).slice().sort() : [p.iso];
  var t0 = horaDe_(dias[0], p.tipo === 'fisica' ? 'AM' : (p.turno || 'AM')), t1 = horaDe_(dias[dias.length - 1], p.tipo === 'fisica' ? 'PM' : (p.turno || 'AM')) + 3 * 36e5;
  var implic = p.wod ? cargasDe_(norm(p.wod), '') : [];
  var base = cargaBase_(filas), slots = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); ['AM', 'PM'].forEach(function (t) { var b = base[iso + t] || 0; slots.push({ iso: iso, turno: t, ok: true, cap: b ? b * 1.4 : CAP_TURNO_[t], mat: mapaMaterial_(['box'], true), correr: { libre: 1, tempo: 1, series: 1 }, tipo: 'casa' }); }); }
  var ocupado = {}, duras = {}, aRecolocar = [];
  filas.forEach(function (r) { var h = horaDe_(r._iso, r._turno), dt = (t0 - h) / 36e5; if (dt > 48 || h > t1 + 24 * 36e5) { ocupado[r._iso + r._turno] = (ocupado[r._iso + r._turno] || 0) + r._min; if (esDura_(r)) duras[r._iso] = 1; } });
  filas.forEach(function (r) {
    var h = horaDe_(r._iso, r._turno), dt = (t0 - h) / 36e5, despues = (h - t1) / 36e5, extra = norm(r.ORIGEN) !== 'FABRIK', z2 = esZ2Fila_(r) || /W03/.test(r['CÓDIGOS'] || '');
    if (p.tipo === 'fisica' && extra && !z2) { cambios.push({ id: r.ID, accion: 'suprimir', motivo: 'Semana de competición física: fuera P1–P4 y extras (manual §17.3)' }); return; }
    if (h >= t0 && h <= t1) { if (p.tipo === 'fisica') cambios.push({ id: r.ID, accion: 'suprimir', motivo: 'Día de competición' }); else aRecolocar.push(r); return; }
    if (dt > 0 && dt <= 24) {
      if (z2 && r._min <= 40) { cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: 'Z2 MUY SUAVE 20–30′ (o descanso) + 15′ de estiramientos y movilidad.\nNada de intensidad.', motivo: '24 h antes: descanso, como mucho Z2 suave' }); return; }
      if (p.tipo === 'fisica') { cambios.push({ id: r.ID, accion: 'suprimir', motivo: '24 h antes de competir: descanso' }); return; }
      aRecolocar.push(r); return;
    }
    if (dt > 24 && dt <= 48) {
      if (p.tipo === 'fisica') { cambios.push({ id: r.ID, accion: 'suprimir', motivo: '48–24 h antes: solo repaso de movimientos (se sustituye)' }); return; }
      if (esDura_(r)) { aRecolocar.push(r); return; }
      var proteger = !implic.length || cargasFila_(r).some(function (c) { return implic.indexOf(c) >= 0; });
      if (proteger && !z2) { var mv = mitadVolumen_(r.CONTENIDO); cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: mv.txt, motivo: '48–24 h antes: −50 % de volumen' + (implic.length ? ' (protege ' + implic.join(', ').toLowerCase() + ')' : '') });
        aRecolocar.push(Object.assign({}, r, { _comp: true, _min: Math.round(r._min / 2) })); }
      return;
    }
    if (dt > 48 && dt <= 72 && p.tipo === 'fisica' && !z2) { var mv2 = mitadVolumen_(r.CONTENIDO); cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: mv2.txt + '\n\nINTENSIDAD ALTA: mantén las cargas y los ritmos.', motivo: '72–48 h antes: volumen medio-bajo, intensidad alta' }); return; }
    if (despues > 0 && despues <= 24 && !z2) { aRecolocar.push(r); return; }
  });
  // recolocar después (y +24 h); el día después de grabar como mucho +40 %
  var desde = t1 + 24 * 36e5;
  aRecolocar.sort(function (a, b) { return prioridadFila_(b, w) - prioridadFila_(a, w); }).forEach(function (r) {
    var s = colocar_(r, slots, ocupado, duras, { desde: desde });
    if (r._comp) {
      if (s) cambios.push({ accion: 'nuevo', iso: s.iso, turno: s.turno, nuevo: Object.assign({}, r, { ORIGEN: 'COMPENSACIÓN', 'TÍTULO': 'Compensación · 50 % de «' + (r['TÍTULO'] || r.BLOQUE) + '»', CONTENIDO: mitadVolumen_(r.CONTENIDO).txt, MIN: r._min, ID: '' }), motivo: 'Volumen recortado antes de competir, devuelto después' });
      else cambios.push({ accion: 'nuevo-pendiente', titulo: 'Compensación · 50 % de «' + (r['TÍTULO'] || r.BLOQUE) + '»', motivo: 'No cabe esta semana sin afectar a la competición' });
      return;
    }
    if (s) cambios.push({ id: r.ID, accion: 'mover', iso: s.iso, turno: s.turno, motivo: 'Fuera de la ventana de competición; se compensa después' });
    else cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'No cabe esta semana sin afectar a la competición' });
  });
  // repaso (física) y plan del día de competición
  if (p.tipo === 'fisica') {
    var dRep = sumarDias(dias[0], -2), dInt = sumarDias(dias[0], -1);
    if (dRep >= lunes) cambios.push({ accion: 'nuevo', iso: dRep, turno: 'PM', nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Repaso de competición · volumen mínimo', CONTENIDO: repasoCompeti_(p.wod), MIN: 30, INTENSIDAD: '🟠 Repaso', 'CÓDIGOS': '' }, motivo: '48–24 h antes: repaso de movimientos' });
    if (dInt >= lunes) cambios.push({ accion: 'nuevo', iso: dInt, turno: 'AM', nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Descanso pre-competición', CONTENIDO: 'Descanso. 15–20′ de movilidad y estiramientos suaves.\nHidratos altos en las comidas (6–8 g/kg), hidratación y a dormir pronto.', MIN: 20, 'CÓDIGOS': '' }, motivo: '24 h antes: descanso' });
  }
  dias.forEach(function (d) { cambios.push({ accion: 'nuevo', iso: d, turno: p.tipo === 'fisica' ? 'AM' : (p.turno || 'AM'), nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': (p.tipo === 'fisica' ? 'COMPETICIÓN' : 'GRABACIÓN ONLINE') + ' · plan del día', CONTENIDO: planDiaCompeti_(p.wod, implic), MIN: 60, INTENSIDAD: '🏆 Competición', 'CÓDIGOS': '' }, motivo: 'Calentamiento, ritmo y combustible' }); });
  var post = sumarDias(dias[dias.length - 1], 1);
  if (post <= sumarDias(lunes, 6)) cambios.push({ accion: 'nuevo', iso: post, turno: 'AM', nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Recuperación post-competición', CONTENIDO: '20–30′ de Z1/Z2 muy suave (bike o paseo) + 15′ de movilidad.\n48 h sin excéntrico pesado.', MIN: 40, INTENSIDAD: '🔵 Z1', 'CÓDIGOS': '' }, motivo: '24 h después: mínimo' });
  if (p.tipo === 'online' && !p.wod) avisos.push('Sin el WOD: se recorta todo lo de 48–24 h por igual. Si lo pegas, solo protejo lo que implica.');
  return { cambios: cambios, avisos: avisos, implicados: implic, mejorHueco: p.tipo === 'online' ? mejorHuecoGrabar_(lunes, filas) : null,
    resumen: (p.tipo === 'fisica' ? 'Competición física ' : 'Grabación online ') + dias.map(function (d) { return diaDe_(d) + ' ' + isoAFecha(d).slice(0, 5); }).join(', ') + (implic.length ? ' · implica ' + implic.join(', ').toLowerCase() : '') };
}
/**
 * v0.22 · Reestructurar › TRABAJO METCON. La semana NO se toca: solo se añaden 1–3 metcons en la mañana (o tarde) del día que elijas.
 *  1 → el más completo posible · 2 → fuerza + crossfit · 3 → fuerza + crossfit + core.
 * Cada metcon ataca estímulos pendientes del MES (y de la semana) con el material que tienes; un estímulo solo cuenta si el metcon
 * le da volumen e intensidad de verdad (≥8′ de trabajo y el movimiento como pieza principal, no de relleno).
 * p: { iso, turno, n, min:[..], formato:[..], material:[..], nada, chaleco, correr }
 */
function proponerMetconTrabajo_(lunes, p) {
  var G = guiaMotor_(), w = pesoCarencias_(lunes), avisos = [], cambios = [];
  var iso = isoOk_(p.iso) || hoyIso_(), turno = p.turno === 'PM' ? 'PM' : 'AM', n = Math.max(1, Math.min(3, +p.n || 1));
  var lista = p.nada ? ['_nada'] : (p.material || []).concat(p.chaleco ? ['chaleco'] : []);
  if (!lista.length) lista = ['_nada'];
  var mat = mapaMaterial_(lista, false); if (p.correr) mat._correr = true;
  var tiene = function (m) { return !m.mat || mat[m.mat] || (m.alt && mat[m.alt]); };
  var disp = G.movs.filter(tiene);
  var roles = n === 1 ? ['completo'] : n === 2 ? ['fuerza', 'crossfit'] : ['fuerza', 'crossfit', 'core'];
  var ROL = {
    completo: { pats: ['OLY', 'OH', 'SENT', 'BISAGRA', 'TIRON', 'EMPUJE_G', 'CUERPO', 'SALTO', 'CORE', 'ACARREO'], k: 4, fmt: 'AMRAP', nombre: 'Completo' },
    fuerza: { pats: ['SENT', 'BISAGRA', 'OLY', 'OH', 'EMPUJE_G', 'TIRON'], k: 2, fmt: null, nombre: 'Fuerza', cargado: true },
    crossfit: { pats: ['OLY', 'OH', 'TIRON', 'EMPUJE_G', 'CUERPO', 'SALTO', 'SENT', 'BISAGRA', 'ACARREO'], k: 3, fmt: 'AMRAP', nombre: 'CrossFit' },
    core: { pats: ['CORE', 'ACARREO'], k: 3, fmt: 'EMOM', nombre: 'Core' }
  };
  var usados = {}, dia = filasSemanaActivas_(lunes).filter(function (r) { return r._iso === iso && r._turno === turno; });
  var minDia = dia.reduce(function (a, r) { return a + (r._min || 0); }, 0);
  roles.forEach(function (rol, i) {
    var R = ROL[rol], min = +(p.min || [])[i] || +(p.min || [])[0] || (rol === 'core' ? 10 : rol === 'fuerza' ? 15 : 16), fmt = String((p.formato || [])[i] || (p.formato || [])[0] || 'auto');
    var cand = disp.filter(function (m) { return R.pats.indexOf(m.patron) >= 0 && !usados[m.k] && (!R.cargado || m.mat && m.mat !== 'comba' || /PISTOL|PIKE|HSPU|WEIGHTED|DIPS/.test(m.k)); })
      .sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0) || (b.c ? 1 : 0) - (a.c ? 1 : 0); });
    var elegidos = [], pats = {}, solapa = function (m) { return elegidos.some(function (e) { return e.carga.filter(function (c) { return m.carga.indexOf(c) >= 0 && c !== 'GLUC'; }).length >= 2 || (e.carga.indexOf('PIERNA') >= 0 && m.carga.indexOf('PIERNA') >= 0 && (rol === 'completo' || rol === 'crossfit')); }); };
    if (rol === 'completo' || rol === 'crossfit') { var gym = cand.filter(function (m) { return m.patron === 'TIRON' || m.patron === 'EMPUJE_G'; })[0]; if (gym) { elegidos.push(gym); pats[gym.patron] = 1; } }
    cand.forEach(function (m) { if (elegidos.length < R.k && !pats[m.patron] && !solapa(m)) { elegidos.push(m); pats[m.patron] = 1; } });
    cand.forEach(function (m) { if (elegidos.length < R.k && elegidos.indexOf(m) < 0 && !solapa(m)) elegidos.push(m); });
    cand.forEach(function (m) { if (elegidos.length < R.k && elegidos.indexOf(m) < 0) elegidos.push(m); });
    if (!elegidos.length) { avisos.push(R.nombre + ': no hay movimientos con ese material.'); return; }
    elegidos.forEach(function (m) { usados[m.k] = 1; });
    if (fmt === 'auto') fmt = rol === 'fuerza' ? (elegidos.some(function (m) { return m.mat === 'barra' || m.mat === 'db' || m.mat === 'kb'; }) ? 'VENTANAS' : 'EMOM') : rol === 'core' ? 'EMOM' : min >= 25 ? 'CHIPPER' : min <= 10 ? 'AMRAP' : (R.fmt || 'AMRAP');
    var deseo = (rol === 'fuerza' ? 'pesado ' : '') + elegidos.map(function (m) { return m.n.split(' (')[0]; }).join(', ') + ' · ' + fmt.replace('_', ' ') + ' ' + min + "'" +
      ((rol === 'crossfit' || rol === 'completo') && p.correr ? ' · intercalar carrera' : '');
    var r = metconGuiado_(deseo, { lunes: lunes, material: lista.concat(p.correr ? ['_correr'] : []), min: min, formato: fmt });
    var b = r.bloque, T = parseInt(String(b.MIN), 10) - 10 || min;
    // estímulos que cuentan: solo los movimientos elegidos como pieza principal y con trabajo suficiente
    var cuentan = elegidos.filter(function (m) { return m.c && T >= 8; }).map(function (m) { return m.c; }).filter(function (c, k, a) { return a.indexOf(c) === k; });
    var pend = cuentan.filter(function (c) { return (w[c] || 0) > 0; });
    var cont = b.CONTENIDO;
    if (p.chaleco || mat.chaleco) { var bw = elegidos.filter(function (m) { return !m.mat || /PISTOL|PIKE|WEIGHTED/.test(m.k); }); if (bw.length) cont += '\nCHALECO: ' + bw.map(function (m) { return m.n.toLowerCase(); }).join(', ') + ' con chaleco (si la técnica aguanta).'; }
    if (p.nada) cont += '\nSIN MATERIAL: todo con el peso corporal' + (p.chaleco ? ' (+ chaleco)' : '') + '.';
    cambios.push({ accion: 'nuevo', iso: iso, turno: turno, nuevo: Object.assign({}, b, { ORIGEN: 'METCON EXTRA', 'TÍTULO': 'METCON ' + (i + 1) + '/' + roles.length + ' · ' + R.nombre + ' · ' + b['TÍTULO'].replace(/^METCON A MEDIDA · /, ''),
      CONTENIDO: cont, 'CÓDIGOS': cuentan.join('|'), ORDEN: (turno === 'AM' ? 5 : 80) + i,
      'POR QUÉ (cursiva)': R.nombre + (pend.length ? ': ataca estímulos pendientes del mes/semana (' + pend.join(', ') + ') con volumen suficiente para contar. ' : ': nada pendiente con este material; trabajo general de calidad. ') + (b['POR QUÉ (cursiva)'] || '') }),
      motivo: 'Trabajo metcon ' + (i + 1) + '/' + roles.length + ' (' + R.nombre.toLowerCase() + ')' });
    (r.avisos || []).forEach(function (a) { if (avisos.indexOf(a) < 0) avisos.push(R.nombre + ': ' + a); });
  });
  var total = cambios.reduce(function (a, c) { return a + (+c.nuevo.MIN || 0); }, 0);
  if (minDia + total > (turno === 'AM' ? 75 : 120)) avisos.push('Esa ' + (turno === 'AM' ? 'mañana' : 'tarde') + ' sumaría ' + (minDia + total) + '′ con lo que ya tienes: valora quitar un metcon o acortarlos.');
  if (dia.some(function (r) { return esDura_(r); })) avisos.push('Ya hay una sesión dura ese turno: los metcons se suman encima.');
  return { cambios: cambios, avisos: avisos, resumen: 'Trabajo metcon · ' + diaDe_(iso) + ' ' + turno + ' · ' + cambios.length + ' metcon' + (cambios.length > 1 ? 's' : '') + ' (' + total + '′)' + (p.nada ? ' · sin material' : '') };
}
/**
 * v0.22 · Competi como evento especial (online de 1 día / clasificatorio, o física de 1+ días). Una competi es RPE 10: hay que llegar fresco.
 *  - Valora los grupos musculares que implica el WOD (si lo pegas).
 *  - Las 24 h previas: solo movilidad, estiramientos y, como mucho, Z2 en ergómetro ≤20′ o carrera suave ≤35′.
 *  - Desde ahora (con o sin esta mañana, si es hoy) hasta 24 h antes se reorganiza para cubrir lo que queda de la semana: primero Fabrik,
 *    después los extras por carencias. Nada que cargue los grupos del WOD en las 48 h previas, nunca dos sesiones duras a <48 h.
 *  - Lo del día de la competi: si quieres, justo después del evento entran 3 opciones (pendientes de Fabrik, extras o 3 combinaciones de 2).
 *  - Si la competi es por la mañana: tarde libre para entrenar o no; domingo sí o no. Lo que no cabe se decide bloque a bloque.
 * p: { tipo: 'online'|'fisica', iso | dias[], turno, wod, post: 'no'|'pendientes'|'extras'|'ambos', tarde, domingo, hoyManana }
 */
function proponerCompeti2_(lunes, p) {
  var w = pesoCarencias_(lunes), avisos = [], cambios = [], G = null; try { G = guiaMotor_(); } catch (e) {}
  var fisica = p.tipo === 'fisica', dias = (fisica ? (p.dias || []) : [p.iso]).filter(Boolean).map(String).sort();
  if (!dias.length) throw new Error('falta_dia_competi');
  var tu = fisica ? 'AM' : (p.turno === 'PM' ? 'PM' : 'AM'), d0 = dias[0], dN = dias[dias.length - 1];
  var t0 = horaDe_(d0, tu), t1 = fisica ? horaDe_(dN, 'PM') : t0, lim24 = t0 - 24 * 36e5, lim48 = t0 - 48 * 36e5;
  var hoy = hoyIso_(), inicio = lunes > hoy ? horaDe_(lunes, 'AM') : horaDe_(hoy, p.hoyManana ? 'AM' : 'PM');
  var domingo = sumarDias(lunes, 6), wod = String(p.wod || '');
  // valoración del WOD: grupos musculares y movimientos
  var implic = wod ? cargasDe_(norm(wod), '10') : [], movsW = [];
  if (wod && G) movsW = detectarMovs_(norm(wod), G).map(function (x) { return x.m; });
  movsW.forEach(function (m) { m.carga.forEach(function (c) { if (c !== 'GLUC' && c !== 'AERO' && implic.indexOf(c) < 0) implic.push(c); }); });
  var GRUPO = { PIERNA: 'pierna (cuádriceps, glúteo, isquios)', HOMBRO: 'hombro y tríceps', AGARRE: 'agarre y dorsal', CORE: 'core', SNC: 'sistema nervioso (cargas altas / olímpicos)', IMPACTO: 'impacto (tobillo, tendón de Aquiles)', GLUC: 'glucolítico', AERO: 'aeróbico' };
  var valoracion = implic.length ? implic.map(function (c) { var mv = movsW.filter(function (m) { return m.carga.indexOf(c) >= 0; }).map(function (m) { return m.n.toLowerCase(); }); return (GRUPO[c] || c.toLowerCase()) + (mv.length ? ' (' + mv.join(', ') + ')' : ''); }) : [];
  var solapa = function (r) { var cg = cargasFila_(r); return implic.some(function (c) { return cg.indexOf(c) >= 0 && c !== 'GLUC' && c !== 'AERO'; }); };
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && horaDe_(r._iso, r._turno) >= inicio && norm(r.ORIGEN) !== 'COMPETI'; });
  if (listar_(HOJAS.REEST).some(function (x) { return x.MODO === 'Competi' && x.ESTADO === 'Aplicada' && celdaIso_(x.LUNES) === lunes; })) avisos.push('Ya hay una competi aplicada esta semana: si es la misma, deshazla antes en Reestructurar.');
  var esEvento = function (iso, t) { var h = horaDe_(iso, t); return fisica ? dias.indexOf(iso) >= 0 : iso === d0 && t === tu; };
  var bloqueado = function (iso, t) {   // turnos sin entrenar
    var h = horaDe_(iso, t);
    if (h < inicio || esEvento(iso, t)) return true;
    if (h >= lim24 && h < t0) return true;                                  // 24 h previas: solo lo suave (se trata aparte)
    if (!fisica && iso === d0 && t !== tu && h > t0 && !p.tarde) return true;   // tarde del día de la competi
    if (iso === domingo && !p.domingo && iso > dN) return true;
    return false;
  };
  var apto24 = function (r) { var t = norm((r['TÍTULO'] || '') + ' ' + String(r.CONTENIDO || '').slice(0, 200)), cod = r['CÓDIGOS'] || '';
    if (/MOVILIDAD|MOBILITY|ESTIRAM|STRETCH|RANGO/.test(t) && !esDura_(r)) return 'movilidad';
    if (/W03/.test(cod) || (/ERG|BIKE|ROW|SKI/.test(t) && esZ2Fila_(r))) return 'erg';
    if (esZ2Fila_(r)) return 'carrera';
    return ''; };
  var aRecolocar = [], ya24 = false;
  filas.forEach(function (r) {
    var h = horaDe_(r._iso, r._turno);
    if (esEvento(r._iso, r._turno)) { aRecolocar.push(Object.assign(r, { _motivo: 'Coincide con la competición' })); return; }
    if (h >= lim24 && h < t0) {
      var a = apto24(r);
      if (a === 'movilidad') { ya24 = true; return; }
      if (a === 'erg' || a === 'carrera') { ya24 = true; cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: a === 'erg' ? 'Z2 EN ERGÓMETRO 20′ como máximo · RPE 2–3, conversacional.\n+ 10–15′ de movilidad y estiramientos.\nNada de intensidad: mañana compites (RPE 10).' : 'CARRERA SUAVE DE RECUPERACIÓN 30–35′ como máximo · RPE 2–3.\n+ 10′ de movilidad.\nSin cambios de ritmo: mañana compites (RPE 10).', motivo: '24 h antes de competir: solo suave' }); return; }
      aRecolocar.push(Object.assign(r, { _motivo: '24 h antes de competir: fuera todo lo que cargue músculo o SNC' })); return;
    }
    if (bloqueado(r._iso, r._turno)) { aRecolocar.push(Object.assign(r, { _motivo: r._iso === domingo ? 'Domingo sin entrenar' : !fisica && r._iso === d0 ? 'Tarde de la competición sin entrenar' : 'Fuera de los turnos disponibles' })); return; }
    if (h >= lim48 && h < lim24 && solapa(r)) aRecolocar.push(Object.assign(r, { _motivo: '48–24 h antes: carga ' + implic.filter(function (c) { return cargasFila_(r).indexOf(c) >= 0; }).join(', ').toLowerCase() + ', lo mismo que el WOD' }));
  });
  var mueven = {}; aRecolocar.forEach(function (r) { mueven[r.ID] = 1; });
  var quedan = filas.filter(function (r) { return !mueven[r.ID]; }), ocupado = cargaBase_(quedan), duras = {};
  quedan.forEach(function (r) { if (esDura_(r)) duras[r._iso] = 1; });
  dias.forEach(function (d) { duras[d] = 1; });   // la competi es la sesión más dura: nada duro a <48 h
  var slots = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); ['AM', 'PM'].forEach(function (t) { if (!bloqueado(iso, t)) slots.push({ iso: iso, turno: t, ok: true, cap: CAP_TURNO_[t], mat: mapaMaterial_(['box'], true), correr: { libre: 1, tempo: 1, series: 1 }, tipo: 'casa' }); }); }
  var colocarC = function (r) {   // como colocar_, pero sin cargar los grupos del WOD en las 48 h previas
    var off = slots.filter(function (s) { var h = horaDe_(s.iso, s.turno); return s.ok && h >= lim48 && h < t0 && solapa(r); });
    off.forEach(function (s) { s.ok = false; }); var s = colocar_(r, slots, ocupado, duras, {}); off.forEach(function (x) { x.ok = true; }); return s;
  };
  // post-competición: 3 opciones de bloques ligeros que no repitan lo que ha machacado el WOD
  var opcionesPost = [];
  if (p.post && p.post !== 'no') {
    var ligero = function (r) { return !esDura_(r) && !solapa(r) && !esCarreraFila_(r); };
    var fab = aRecolocar.filter(function (r) { return norm(r.ORIGEN) === 'FABRIK' && ligero(r); }).map(function (r) { return { id: r.ID, titulo: r['TÍTULO'] || r.BLOQUE, min: r._min, cargas: cargasFila_(r), prio: prioridadFila_(r, w) }; });
    pendientesAbiertos_().filter(function (q) { return q.ESTADO === 'Pendiente'; }).forEach(function (q) { var pseudo = { 'TÍTULO': q.BLOQUE, CONTENIDO: q._CONTENIDO, ORIGEN: q.TIPO, MIN: q._MIN, 'CÓDIGOS': '', INTENSIDAD: q._INTENSIDAD };
      if (ligero(pseudo)) fab.push({ pend: q.ID, titulo: 'Pendiente · ' + q.BLOQUE, contenido: q._CONTENIDO, min: +q._MIN || 15, cargas: cargasFila_(pseudo), prio: 1 }); });
    var cat = catalogo_(), ext = aRecolocar.filter(function (r) { return norm(r.ORIGEN) !== 'FABRIK' && ligero(r); }).map(function (r) { return { id: r.ID, titulo: r['TÍTULO'] || r.BLOQUE, min: r._min, cargas: cargasFila_(r), prio: prioridadFila_(r, w) }; });
    Object.keys(cat).filter(function (c) { var r = cat[c]; return r.CONTENIDO && !/CARRERA/.test(norm(r.ORIGEN)) && (w[c] || 0) > 0; }).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); }).forEach(function (c) {
      var r = cat[c], pseudo = { 'TÍTULO': r.NOMBRE, CONTENIDO: r.CONTENIDO, 'CÓDIGOS': c, ORIGEN: 'EXTRA', MIN: r.MIN, INTENSIDAD: r.INTENSIDAD };
      if (ligero(pseudo) && !ext.some(function (e) { return e.codigo === c; })) ext.push({ codigo: c, titulo: r.NOMBRE, contenido: r.CONTENIDO, min: +r.MIN || 12, cargas: cargasFila_(pseudo), prio: w[c] });
    });
    fab.sort(function (a, b) { return b.prio - a.prio; }); ext.sort(function (a, b) { return b.prio - a.prio; });
    var sueltas = function (l) { return l.slice(0, 3).map(function (x) { return { titulo: x.titulo, items: [x] }; }); };
    if (p.post === 'pendientes') opcionesPost = sueltas(fab);
    else if (p.post === 'extras') opcionesPost = sueltas(ext);
    else {
      var pares = []; fab.slice(0, 5).forEach(function (f) { ext.slice(0, 5).forEach(function (e) { if (f.cargas.some(function (c) { return e.cargas.indexOf(c) >= 0 && c !== 'GLUC'; })) return; pares.push({ titulo: f.titulo + ' + ' + e.titulo, items: [f, e], prio: f.prio + e.prio }); }); });
      opcionesPost = pares.sort(function (a, b) { return b.prio - a.prio; }).slice(0, 3);
    }
    opcionesPost.forEach(function (o, i) { o.k = i; o.min = o.items.reduce(function (a, x) { return a + (x.min || 0); }, 0); });
    if (!opcionesPost.length) avisos.push('No encontré bloques ligeros que no repitan lo que carga el WOD para después de la competi.');
  }
  // recolocar: Fabrik primero, después extras por carencias; si Fabrik no cabe, desplaza un extra de menor prioridad
  var cola = aRecolocar.slice().sort(function (a, b) { return (norm(b.ORIGEN) === 'FABRIK') - (norm(a.ORIGEN) === 'FABRIK') || prioridadFila_(b, w) - prioridadFila_(a, w); });
  var colocado = {};
  for (var i = 0; i < cola.length; i++) {
    var r = cola[i], s = colocarC(r);
    if (!s && norm(r.ORIGEN) === 'FABRIK') {
      var victima = quedan.concat(cola.filter(function (x) { return colocado[x.ID]; })).filter(function (x) { return norm(x.ORIGEN) !== 'FABRIK' && !mueven[x.ID + '_v'] && horaDe_(x._iso, x._turno) < lim24 && x._min >= r._min * 0.6 && prioridadFila_(x, w) < prioridadFila_(r, w); })
        .sort(function (a, b) { return prioridadFila_(a, w) - prioridadFila_(b, w); })[0];
      if (victima) {
        var vs = colocado[victima.ID] || { iso: victima._iso, turno: victima._turno };
        ocupado[vs.iso + vs.turno] = Math.max(0, (ocupado[vs.iso + vs.turno] || 0) - victima._min); mueven[victima.ID + '_v'] = 1;
        cambios = cambios.filter(function (c) { return c.id !== victima.ID; });
        delete colocado[victima.ID]; cola.push(Object.assign(victima, { _motivo: 'Deja su hueco a Fabrik (prioridad)' }));
        s = colocarC(r);
      }
    }
    if (s) { colocado[r.ID] = s; cambios.push({ id: r.ID, accion: 'mover', iso: s.iso, turno: s.turno, motivo: r._motivo + ' → ' + diaDe_(s.iso).toLowerCase() + ' ' + s.turno + (norm(r.ORIGEN) === 'FABRIK' ? ' (Fabrik primero)' : '') }); }
    else cambios.push({ id: r.ID, accion: 'pendiente', noCabe: true, carreraErg: esCarreraFila_(r) || /W03/.test(r['CÓDIGOS'] || ''), motivo: r._motivo + '. No cabe sin cargar la competición: decide (no hacer, pendientes, +25 % si es carrera/erg, o el hueco que quieras).' });
  }
  // 24 h antes: si no hay nada suave, se propone
  if (!ya24) { var dPrev = sumarDias(d0, -1); if (dPrev >= lunes && horaDe_(dPrev, tu) >= inicio) cambios.push({ accion: 'nuevo', iso: dPrev, turno: tu, nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Víspera de competi · movilidad + Z2 suave (opcional)', CONTENIDO: '15–20′ de movilidad y estiramientos (cadera, hombro, tobillo).\nOpcional: Z2 en ergómetro 20′ como máximo (RPE 2–3) o carrera suave ≤35′.\nNada que cargue músculo ni sistema nervioso.', MIN: 20, INTENSIDAD: '🟢 Suave', 'CÓDIGOS': '' }, motivo: '24 h antes: llegar fresco' }); }
  // el evento
  dias.forEach(function (d) { cambios.push({ accion: 'nuevo', iso: d, turno: tu, nuevo: { ORIGEN: 'COMPETI', ORDEN: tu === 'AM' ? 1 : 41, 'TÍTULO': (fisica ? 'COMPETICIÓN' : 'COMPETI ONLINE / CLASIFICATORIO') + ' · RPE 10',
    CONTENIDO: (valoracion.length ? 'GRUPOS IMPLICADOS: ' + valoracion.join(' · ') + '\n\n' : '') + planDiaCompeti_(wod, implic), MIN: 60, INTENSIDAD: '🔴 RPE 10', 'CÓDIGOS': '' }, motivo: 'Día de competición: RPE 10' }); });
  var resumen = (fisica ? 'Competición física ' : 'Competi online ') + dias.map(function (d) { return diaDe_(d) + ' ' + isoAFecha(d).slice(0, 5); }).join(', ') + (fisica ? '' : ' ' + tu) +
    ' · ' + cambios.filter(function (c) { return c.accion === 'mover'; }).length + ' recolocados · ' + cambios.filter(function (c) { return c.noCabe; }).length + ' sin hueco';
  if (!wod) avisos.push('Sin el WOD no sé qué grupos protege: se aplica solo la regla de 24 h y la de 48 h entre sesiones duras. Si lo pegas, protejo lo que implica.');
  return { cambios: cambios, avisos: avisos, implicados: implic, valoracion: valoracion, opcionesPost: opcionesPost, postIso: d0, postTurno: tu, resumen: resumen };
}
function repasoCompeti_(wod) {
  var movs = MOV_MEGA_.filter(function (m) { return wod && m.re.test(norm(wod)); }).slice(0, 4);
  if (!movs.length) return 'Calentamiento completo + 2 rondas suaves de los movimientos de la competición (3–5 reps cada uno).\nIntensidad igual o algo superior a la de la competición, volumen mínimo. Nada hasta el fallo.';
  return 'Calentamiento 12′ + 2 RONDAS (descanso 2′):\n' + movs.map(function (m) { return Math.max(2, Math.round(m.reps / 4)) + ' ' + m.n; }).join('\n') + '\n\nIntensidad igual o algo superior a la de la competición (cargas de competición), volumen muy bajo. Sin fatiga.';
}
function planDiaCompeti_(wod, implic) {
  var w = norm(wod || ''), fmt = /AMRAP/.test(w) ? 'AMRAP: arranca al 85 % y mantén un ritmo que puedas repetir; tandas fijas desde la 1.ª ronda.' : /FOR TIME|TIME CAP|CAP/.test(w) ? 'FOR TIME: no te vayas en el primer tercio; acelera en el último.' : /EMOM|EVERY/.test(w) ? 'Intervalos: mismo ritmo en todas las ventanas; el descanso es para respirar, no para mirar el reloj.' : 'Pacing: primer tercio al 85 %, último tercio a tope.';
  var cal = { HOMBRO: 'hombro (bandas, wall slides, 2×5 del movimiento con carga creciente)', PIERNA: 'pierna (sentadilla, saltos progresivos)', AGARRE: 'agarre (cuelgue activo, 2 tandas cortas)', SNC: 'sistema nervioso (2–3 singles rápidos al 70–80 %)', GLUC: 'motor (2′ de erg con 3 aceleraciones de 10″)', IMPACTO: 'tobillo (pogos, comba)' };
  return 'CALENTAMIENTO ESPECÍFICO 20–25′: general 8′ + ' + (implic.length ? implic.map(function (c) { return cal[c]; }).filter(Boolean).join(' · ') : 'movimientos del WOD en progresión') + ' + 1 ronda corta del WOD al 70 %.\n\n' +
    'RITMO: ' + fmt + '\n\nCOMBUSTIBLE: comida 2–3 h antes con 1–2 g/kg de hidratos y poca grasa; 30′ antes 20–30 g de hidratos rápidos. Agua con una pizca de sal. Cafeína solo si ya la has probado en entrenos.' + (wod ? '\n\nWOD:\n' + wod : '');
}
function mejorHuecoGrabar_(lunes, filas) {
  var punt = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); if (iso < hoyIso_()) continue; ['AM', 'PM'].forEach(function (t) {
    var h = horaDe_(iso, t), carga = filas.filter(function (r) { var dh = (h - horaDe_(r._iso, r._turno)) / 36e5; return dh > 0 && dh <= 48; }).reduce(function (a, r) { return a + r._min * (esDura_(r) ? 2 : 1); }, 0);
    punt.push({ iso: iso, turno: t, carga: carga }); }); }
  return punt.sort(function (a, b) { return a.carga - b.carga; }).slice(0, 2);
}

// ---------- proponer · aplicar · deshacer ----------
function reestProponer_(modo, lunes, params) {
  lunes = lunesDe_((params && params.lunes) || lunes || hoyIso_());
  var P = modo === 'Viaje' ? proponerViaje_(lunes, params) : modo === 'Competi' ? (params.v === 2 ? proponerCompeti2_(lunes, params) : proponerCompeti_(lunes, params)) : modo === 'Trabajo metcon' ? proponerMetconTrabajo_(lunes, params) : modo === 'Lesión' ? proponerLesionNivel_(lunes, params) : modo === 'Incentivar' ? proponerIncentivo_(lunesDe_(params.lunes || lunes), params) : proponerReorg_(lunes, params);
  var id = 'R' + nuevoId_().slice(0, 6), plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
  P.cambios.forEach(function (c, i) { c.k = i; var r = plan[c.id]; if (r) { c.titulo = r['TÍTULO'] || r.BLOQUE; c.desdeIso = celdaIso_(r.FECHA); c.desdeTurno = r.TURNO === 'AM' ? 'AM' : 'PM'; c.origen = r.ORIGEN; } else if (c.nuevo) c.titulo = c.nuevo['TÍTULO']; });
  var json = JSON.stringify(P);
  anadirFila_(HOJAS.REEST, { ID: id, LUNES: isoAFecha(lunes), MODO: modo, ESTADO: 'Propuesta', RESUMEN: P.resumen, PARAMS: JSON.stringify(params).slice(0, 45000), PROPUESTA: json.length < 49000 ? json : '', CREADA: ahora_() });
  if (json.length >= 49000) CacheService.getScriptCache().put('reest_' + id, json.slice(0, 95000), 21600);
  P.id = id; P.lunes = lunes; P.modo = modo;
  return P;
}
function reestAplicar_(id, ajustes) {
  return bloqueo_(function () {
    var x = listar_(HOJAS.REEST).filter(function (r) { return r.ID === id; })[0]; if (!x) throw new Error('no_encontrado');
    if (x.ESTADO !== 'Propuesta') throw new Error('ya_' + String(x.ESTADO).toLowerCase());
    var P = JSON.parse(x.PROPUESTA || CacheService.getScriptCache().get('reest_' + id) || '{}');
    // v0.22 · competi: opción elegida para después del evento
    (ajustes || []).filter(function (a) { return a.post != null; }).forEach(function (a) {
      var op = (P.opcionesPost || [])[+a.post]; if (!op) return;
      op.items.forEach(function (it, j) {
        var ord = (P.postTurno === 'AM' ? 2 : 42) + j;
        if (it.id) { var c0 = P.cambios.filter(function (c) { return c.id === it.id; })[0];
          if (c0) { c0.accion = 'mover'; c0.iso = P.postIso; c0.turno = P.postTurno; c0.motivo = 'Después de la competi (lo elegiste)'; c0.orden = ord; }
          else P.cambios.push({ id: it.id, accion: 'mover', iso: P.postIso, turno: P.postTurno, motivo: 'Después de la competi (lo elegiste)', orden: ord }); }
        else P.cambios.push({ accion: 'nuevo', iso: P.postIso, turno: P.postTurno, pendId: it.pend || '', nuevo: { ORIGEN: it.pend ? 'PENDIENTE' : 'EXTRA', 'TÍTULO': it.titulo + ' · post-competi', CONTENIDO: it.contenido || '', MIN: it.min || 12, 'CÓDIGOS': it.codigo || '', ORDEN: ord }, motivo: 'Después de la competi (lo elegiste)' });
      });
    });
    (ajustes || []).forEach(function (a) { var c = P.cambios[a.k]; if (!c || a.post != null) return;
      if (a.destino === 'cancelar') { c.accion = c.nuevo ? 'quitar' : 'cancelar'; return; }
      if (a.destino === 'pendiente25' || a.destino === 'pendiente_tal') { c.accion = 'pendiente'; c.motivo = (c.motivo || '') + (a.destino === 'pendiente25' ? ' [+25 %]' : ' [tal cual]'); return; }
      if (a.destino === 'pendiente') c.accion = c.nuevo ? 'quitar' : 'pendiente'; else if (a.destino === 'quitar') c.accion = c.nuevo ? 'quitar' : 'suprimir'; else if (a.iso) { c.iso = a.iso; c.turno = a.turno || 'PM'; if (c.accion === 'pendiente' || c.accion === 'suprimir') c.accion = 'mover'; } });
    asegurarColumna_(HOJAS.PLAN, 'REESTRUCTURA'); asegurarColumna_(HOJAS.PLAN, 'ESTADO PREVIO');
    var plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh), nuevas = [], sello = 'reestructura ' + id + ' · ' + ahora_();
    var tocados = {}, tocar = function (r) { if (tocados[r.ID]) return; tocados[r.ID] = 1; actualizarFila_(HOJAS.PLAN, r._fila, { 'ESTADO PREVIO': r.ESTADO, ESTADO: 'SUSTITUIDO', REESTRUCTURA: id, ACTUALIZADO: ahora_() }); };
    var fila = function (o, iso, turno) { return Object.assign({}, o, { ID: nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: turno, ORDEN: o.ORDEN || 60, ESTADO: 'PROGRAMADO', GENERADO: sello, REESTRUCTURA: id, ACTUALIZADO: ahora_() }); };
    P.cambios.forEach(function (c) {
      var r = c.id ? plan[c.id] : null;
      if (c.accion === 'quitar') return;
      if (c.accion === 'nuevo' && c.pendId) { var pq = listar_(HOJAS.PENDIENTES).filter(function (q) { return q.ID === c.pendId; })[0]; if (pq) actualizarFila_(HOJAS.PENDIENTES, pq._fila, { ESTADO: 'Reprogramado', 'SEMANA DESTINO': isoAFecha(lunesDe_(c.iso)) }); }
      if (c.accion === 'nuevo') { var o = Object.assign({}, c.nuevo); delete o._iso; delete o._turno; delete o._min; delete o._comp; delete o._fila; if (!o.ORIGEN) o.ORIGEN = 'REORGANIZADO';
        o['POR QUÉ (cursiva)'] = [o['POR QUÉ (cursiva)'], c.motivo].filter(Boolean).join(' · '); nuevas.push(fila(o, c.iso, c.turno)); return; }
      if (c.accion === 'nuevo-pendiente') { anadirPendiente_({ 'TÍTULO': c.titulo, ORIGEN: 'COMPENSACIÓN' }, c.motivo + ' (' + id + ')'); return; }
      if (!r) return;
      tocar(r);
      if (c.accion === 'pendiente') { anadirPendiente_(r, c.motivo + ' (' + id + ')'); return; }
      if (c.accion === 'cancelar') { actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'CANCELADO' }); return; }   // v0.22 · no se hace (deshacer lo devuelve)
      if (c.accion === 'suprimir' || c.accion === 'sustituir') return;
      var o2 = {}; cab.forEach(function (h) { o2[h] = r[h]; });
      if (norm(r.ORIGEN) === 'FABRIK') { o2.ORIGEN = 'FABRIK ADAPTADO'; o2.FABRIK_REF = ''; }
      if (c.contenido) o2.CONTENIDO = c.contenido;
      if (c.min != null) o2.MIN = String(c.min);
      o2['POR QUÉ (cursiva)'] = c.motivo + (r['POR QUÉ (cursiva)'] ? ' · ' + r['POR QUÉ (cursiva)'] : '');
      o2['ESTADO PREVIO'] = '';
      if (c.orden != null) o2.ORDEN = c.orden;
      nuevas.push(fila(o2, c.iso || celdaIso_(r.FECHA), c.turno || r.TURNO));
    });
    if (nuevas.length) sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, nuevas.length, cab.length).setValues(nuevas.map(function (o) { return filaDe_(cab, o); }));
    actualizarFila_(HOJAS.REEST, x._fila, { ESTADO: 'Aplicada', APLICADA: ahora_() });
    if (x.MODO === 'Competi') { try { var pp = JSON.parse(x.PARAMS || '{}'), d0 = pp.tipo === 'fisica' ? (pp.dias || [])[0] : pp.iso, d1 = pp.tipo === 'fisica' ? (pp.dias || []).slice(-1)[0] : pp.iso;
      asegurarColumna_(HOJAS.EVENTOS, 'MUY EXIGENTE'); var idEv = guardarEvento_({ EVENTO: (pp.tipo === 'fisica' ? 'Competición' : 'Grabación online') + ' (Reestructurar)', TIPO: 'Competición', INICIO: isoAFecha(d0), FIN: isoAFecha(d1), BLOQUEA: pp.tipo === 'fisica' ? 'Día completo' : (pp.turno === 'PM' ? 'Tarde' : 'Mañana'), 'CÓMO PROCEDER': 'Reestructurado ' + id, ESTADO: 'Decidido', sinCalendario: true });
      var ev = listar_(HOJAS.EVENTOS).filter(function (e) { return e.ID === idEv; })[0]; if (ev) actualizarFila_(HOJAS.EVENTOS, ev._fila, { 'MUY EXIGENTE': 'Sí' }); } catch (e) { Logger.log('Evento competi: ' + e); } }
    if (P.incentivo && P.incentivo.deltas) guardarIncentivo_(id, P.incentivo.lunes, P.incentivo.deltas);
    if (x.MODO === 'Lesión') { var prL = {}; try { prL = JSON.parse(x.PARAMS || '{}'); } catch (eL) {} lesionAplicada_(P, prL); }   // v0.29
    if (/Viaje|Reorganiz|Competi|Lesi/.test(x.MODO)) try { var noH = {}, pr0 = {}; try { pr0 = JSON.parse(x.PARAMS || '{}'); } catch (eP) {} (pr0.noHechos || []).forEach(function (k) { noH[k] = 1; }); darPorHecho_(lunesDe_(celdaIso_(x.LUNES) || hoyIso_()), id, noH); } catch (eH) { Logger.log('darPorHecho: ' + eH); }
    MEMO = null;
    return { id: id, nuevas: nuevas.length };
  });
}
function reestDeshacer_(id) {
  return bloqueo_(function () {
    var x = listar_(HOJAS.REEST).filter(function (r) { return r.ID === id; })[0]; if (!x) throw new Error('no_encontrado');
    var sh = hojaMia_(HOJAS.PLAN), borrar = [];
    listar_(HOJAS.PLAN).forEach(function (r) {
      if (r.REESTRUCTURA !== id) return;
      if (/^(SUSTITUIDO|CANCELADO)$/.test(r.ESTADO) && r['ESTADO PREVIO']) actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: r['ESTADO PREVIO'], 'ESTADO PREVIO': '', REESTRUCTURA: '', ACTUALIZADO: ahora_() });
      else borrar.push(r._fila);
    });
    borrar.sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
    listar_(HOJAS.PENDIENTES).forEach(function (p) { if (String(p.MOTIVO || '').indexOf('(' + id + ')') >= 0 && p.ESTADO === 'Pendiente') actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Descartado' }); });
    actualizarFila_(HOJAS.REEST, x._fila, { ESTADO: 'Deshecha' });
    if (x.MODO === 'Incentivar') guardarIncentivo_(id, null, null);
    try { quitarDadosPorHecho_(id); } catch (eQ) {}
    MEMO = null;
    return true;
  });
}
/** Sobre la marcha: ese día aparece material nuevo → bloque nuevo automático (editable) que ataca lo que más falta con ese material. */
function reestMaterial_(lunes, iso, turno, material) {
  var w = pesoCarencias_(lunesDe_(lunes || iso)), mat = mapaMaterial_(material, false), cat = catalogo_();
  var cands = Object.keys(cat).filter(function (c) { var r = cat[c]; if (!r.CONTENIDO || /CARRERA/.test(norm(r.ORIGEN))) return false; var a = adaptarMaterial_(r.CONTENIDO, mat); return a.cambios === 0; })
    .sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
  if (!cands.length) throw new Error('sin_bloque_para_material');
  var r = cat[cands[0]], o = { ORIGEN: 'VIAJE', 'TÍTULO': r.NOMBRE + ' (material nuevo)', CONTENIDO: r.CONTENIDO, MIN: r.MIN || 12, INTENSIDAD: r.INTENSIDAD, 'CÓDIGOS': cands[0],
    'POR QUÉ (cursiva)': 'Con el material que acabas de marcar, lo que más te falta: ' + r.NOMBRE + '. ' + (r['POR QUÉ (cursiva)'] || ''), 'CIENCIA (técnica · fisiología · biología)': r['CIENCIA (técnica · fisiología · biología)'] || '' };
  var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh);
  var fila = Object.assign(o, { ID: nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: turno, ORDEN: 70, ESTADO: 'BORRADOR', GENERADO: 'manual ' + ahora_() + ' (material nuevo · candado)', ACTUALIZADO: ahora_() });
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, fila)]);
  MEMO = null;
  return fila;
}
function reestActiva_(lunes) {
  var l = lunesDe_(lunes);
  return listar_(HOJAS.REEST).filter(function (r) { return celdaIso_(r.LUNES) === l && r.ESTADO === 'Aplicada'; }).map(function (r) { return { id: r.ID, modo: r.MODO, resumen: r.RESUMEN }; });
}

