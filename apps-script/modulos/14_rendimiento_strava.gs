// ===================== v29a · RENDIMIENTO · GABI · MURPH · RITMOS · STRAVA =====================
/*
 * Se añade tal cual al final de Code.gs. ES5 (var, function). Todo lo de aquí usa funciones globales de Code.gs.
 *  · APP · RENDIMIENTO: indicadores de progreso (test 2 km, eficiencia Z2, remo 6′, 1RM, RMU, HSPU, metcon de referencia).
 *  · Importa de la app de Gabi (SOLO LECTURA): marcas y resultados del atleta.
 *  · Murph con chaleco en 3 lunes (−6, −4, −2 semanas), «Carrera comprometida» (RC1) y metcon de referencia (RF1).
 *  · Ritmos por zona desde el test de 2 km (propuesta → el atleta confirma).
 *  · Strava (gratis): el secreto vive solo en PROPS 'STRAVA_SECRET', el token en PROPS 'STRAVA_TOKEN'.
 */
HOJAS.RENDIMIENTO = 'APP · RENDIMIENTO';
ESQUEMA['APP · RENDIMIENTO'] = {
  cab: ['FECHA', 'INDICADOR', 'VALOR', 'UNIDAD', 'FUENTE', 'NOTAS', 'REGISTRADO'],
  anchos: [95, 100, 110, 90, 170, 340, 120], fechas: ['FECHA']
};
if (typeof VISIBLES_ !== 'undefined' && VISIBLES_.indexOf(HOJAS.RENDIMIENTO) < 0) VISIBLES_.push(HOJAS.RENDIMIENTO);

var INDICADORES_ = [
  { clave: '2km', nombre: 'Test 2 km', unidad: 'min:seg', mejorEs: 'menor', tipo: 'tiempo', codigos: ['W04', 'R02', 'R03'] },
  { clave: 'z2', nombre: 'Eficiencia Z2', unidad: 'm/min por ppm', mejorEs: 'mayor', tipo: 'num', codigos: ['W01', 'W02'] },
  { clave: 'remo6', nombre: 'EMOM RowErg 6′', unidad: 'kcal', mejorEs: 'mayor', tipo: 'num', codigos: ['R01', 'W03'] },
  { clave: 'snatch', nombre: 'Snatch 1RM', unidad: 'kg', mejorEs: 'mayor', tipo: 'num', codigos: ['W20', 'M05', 'M10', 'M50'] },
  { clave: 'cj', nombre: 'Clean & jerk 1RM', unidad: 'kg', mejorEs: 'mayor', tipo: 'num', codigos: ['W23', 'W24', 'W34', 'M17', 'M07', 'M51'] },
  { clave: 'rmu', nombre: 'RMU máx. unbroken', unidad: 'reps', mejorEs: 'mayor', tipo: 'num', codigos: ['W13', 'M30', 'M49'] },
  { clave: 'hspu', nombre: 'HSPU máx. unbroken', unidad: 'reps', mejorEs: 'mayor', tipo: 'num', codigos: ['W15', 'W16', 'W17', 'W31', 'OP1'] },
  { clave: 'metcon', nombre: 'Metcon de referencia', unidad: '', mejorEs: 'menor', tipo: 'texto', codigos: ['R01', 'R04'] }   // tendencia solo si el valor es un tiempo
];

// ---------- utilidades ----------
function v29Ind_(clave) {
  clave = String(clave || '').toLowerCase().trim();
  var r = INDICADORES_.filter(function (i) { return i.clave === clave; })[0];
  if (!r && clave === 'ref') r = { clave: 'ref', nombre: 'Referencia', unidad: '', mejorEs: '', tipo: 'texto', codigos: [] };
  return r || null;
}
function v29Num_(t) {
  var m = String(t == null ? '' : t).replace(/ /g, ' ').match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}
function v29Seguro_(hoja) { try { return listar_(hoja); } catch (e) { return []; } }
function v29Linea_(t, n) { return String(t || '').split('\n')[0].trim().slice(0, n || 80); }
function v29Media_(a) { return a.reduce(function (s, x) { return s + x; }, 0) / (a.length || 1); }
function v29Redondea_(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }
/** Valor de una clave de APP · CONFIG que guarda una fecha (con o sin «'» delante) → 'yyyy-mm-dd' o ''. */
function v29CfgIso_(clave) { var v = String(leerConfig_()[clave] || '').replace(/^'/, '').trim(); return v ? (celdaIso_(v) || '') : ''; }
function v29CfgJson_(clave) {
  try { var v = String(leerConfig_()[clave] || '').replace(/^'/, '').trim(); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
/** Número comparable de un valor según el tipo del indicador (null si no se puede comparar). */
function valorIndicador_(ind, txt) {
  var s = String(txt == null ? '' : txt).trim().replace(/^'/, '');
  if (!s) return null;
  if (ind.tipo === 'tiempo') { if (!/\d/.test(s)) return null; var sg = segundos_(s); return sg > 0 ? sg : null; }
  if (ind.tipo === 'num') return v29Num_(s);
  if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(s)) { var sg2 = segundos_(s); return sg2 > 0 ? sg2 : null; }   // texto libre: solo si es un tiempo
  return null;
}
function v29Txt_(ind, v, crudo) {
  if (v == null) return String(crudo == null ? '' : crudo).trim();
  if (ind.tipo === 'tiempo' || (ind.tipo === 'texto' && /^\d{1,3}:\d{2}/.test(String(crudo).trim()))) return mmss_(v);
  return String(v29Redondea_(v, 3)).replace('.', ',');
}
function v29Mejor_(ind, vals) {
  return vals.reduce(function (m, x) { return m == null ? x : (ind.mejorEs === 'menor' ? Math.min(m, x) : Math.max(m, x)); }, null);
}
function v29Supera_(ind, a, b) { return ind.mejorEs === 'menor' ? a < b : a > b; }   // ¿a es mejor que b?

// ---------- fuentes automáticas ----------
/** Tests de 2 km de APP · CARRERA: [{fecha, seg}] por fecha. */
function tests2kCarrera_() {
  var out = [];
  v29Seguro_(HOJAS.CARRERA).forEach(function (r) {
    var t = norm(r.TIPO), km = v29Num_(r['DISTANCIA (km)']), seg = segundos_(r.TIEMPO), f = celdaIso_(r.FECHA);
    if (!f || !(seg > 0)) return;
    var es = (t.indexOf('TEST') >= 0 && km != null && km >= 1.9 && km <= 2.1) || /(^|[^0-9])2 ?KM/.test(t);
    if (es) out.push({ fecha: f, seg: seg });
  });
  return out.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
}
/** Eficiencia aeróbica semanal: media de (m/min)/FC de las carreras Z2 de la semana. [{fecha:lunes, v}] */
function eficienciaZ2Semanal_() {
  var por = {};
  v29Seguro_(HOJAS.CARRERA).forEach(function (r) {
    if (norm(r.TIPO).trim().indexOf('Z2') !== 0) return;
    var km = v29Num_(r['DISTANCIA (km)']), seg = segundos_(r.TIEMPO), fc = v29Num_(r['FC MEDIA']), f = celdaIso_(r.FECHA);
    if (!f || !(km > 0 && seg > 0 && fc > 0)) return;
    var l = lunesDe_(f); (por[l] = por[l] || []).push((km * 1000 / (seg / 60)) / fc);
  });
  return Object.keys(por).sort().map(function (l) { return { fecha: l, v: v29Redondea_(v29Media_(por[l]), 3) }; });
}
/** Serie de un indicador: [{fecha, v (número comparable o null), txt}] ordenada por fecha. */
function serieIndicador_(clave) {
  var ind = v29Ind_(clave); if (!ind) return [];
  clave = ind.clave;
  var out = [];
  v29Seguro_(HOJAS.RENDIMIENTO).forEach(function (r) {
    if (String(r.INDICADOR || '').trim().toLowerCase() !== clave) return;
    var f = celdaIso_(r.FECHA); if (!f) return;
    var v = valorIndicador_(ind, r.VALOR);
    out.push({ fecha: f, v: v, txt: v29Txt_(ind, v, r.VALOR) });
  });
  var N = function (v) { return String(v29Redondea_(v, 3)).replace('.', ','); };
  if (clave === 'snatch' || clave === 'cj') {
    v29Seguro_(HOJAS.MARCAS).forEach(function (m) {
      var mov = norm(m.MOVIMIENTO).trim(), tipo = norm(m.TIPO).replace(/\s/g, '');
      var esMov = clave === 'snatch' ? mov === 'SNATCH' : (mov === 'CLEAN & JERK' || mov === 'CLEAN AND JERK' || mov === 'C&J');
      if (!esMov || tipo.indexOf('1RM') < 0) return;
      var f = celdaIso_(m.FECHA), v = v29Num_(m.VALOR); if (!f || v == null) return;
      out.push({ fecha: f, v: v, txt: N(v) });
    });
  } else if (clave === '2km') {
    tests2kCarrera_().forEach(function (t) { out.push({ fecha: t.fecha, v: t.seg, txt: mmss_(t.seg) }); });
  } else if (clave === 'z2') {
    eficienciaZ2Semanal_().forEach(function (w) { out.push({ fecha: w.fecha, v: w.v, txt: N(w.v) }); });
  } else if (clave === 'remo6') {
    v29Seguro_(HOJAS.OPERACION).forEach(function (o) {
      if (!/ROWERG|\bREMO\b/.test(norm(o.REFERENCIA))) return;
      var f = celdaIso_(o.FECHA), v = v29Num_(o.VALOR); if (!f || v == null) return;
      out.push({ fecha: f, v: v, txt: N(v) });
    });
  }
  var vistos = {};
  out = out.filter(function (s) { var k = s.fecha + '|' + s.v + '|' + s.txt; if (vistos[k]) return false; vistos[k] = 1; return true; });
  return out.map(function (s, i) { s._i = i; return s; })
    .sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a._i - b._i; })
    .map(function (s) { return { fecha: s.fecha, v: s.v, txt: s.txt }; });
}

// ---------- exposiciones, alertas y panel ----------
/** {clave: n}: sesiones hechas (REGISTRO «Sí») en las últimas 8 semanas con algún código del indicador. */
function exposiciones8_() {
  var desde = sumarDias(hoyIso_(), -56), plan = {}, vistos = {}, cuenta = {};
  v29Seguro_(HOJAS.PLAN).forEach(function (p) { if (p.ID) plan[p.ID] = p; });
  v29Seguro_(HOJAS.REGISTRO).forEach(function (r) {
    if (norm(r.HECHO).trim() !== 'SI') return;
    var p = plan[r.ID_PLAN]; if (!p) return;
    var f = celdaIso_(r.FECHA) || celdaIso_(p.FECHA); if (!f || f < desde) return;
    var k = r.ID_PLAN + '|' + f; if (vistos[k]) return; vistos[k] = 1;
    var cods = codigosDe_(p['CÓDIGOS']);
    INDICADORES_.forEach(function (ind) {
      if (ind.codigos.some(function (c) { return cods.indexOf(c) >= 0; })) cuenta[ind.clave] = (cuenta[ind.clave] || 0) + 1;
    });
  });
  return cuenta;
}
function alertaIndicador_(ind, serie, exp) {
  var msgs = [];
  if (exp >= 6) {
    var corte = sumarDias(hoyIso_(), -56), rec = [], ant = [];
    serie.forEach(function (s) { if (s.v == null) return; (s.fecha >= corte ? rec : ant).push(s.v); });
    if (ant.length) {
      var mAnt = v29Mejor_(ind, ant), mRec = rec.length ? v29Mejor_(ind, rec) : null;
      if (mRec == null || !v29Supera_(ind, mRec, mAnt)) msgs.push('Ocho semanas sin mejora con ' + exp + ' exposiciones: propongo cambiar la dosis o el ejercicio.');
    }
  }
  if (ind.clave === 'z2') {
    var p = serie.filter(function (s) { return s.v != null; }).slice(-3);
    if (p.length === 3 && p[2].v < p[1].v && p[1].v < p[0].v) msgs.push('La eficiencia aeróbica baja dos semanas seguidas: revisa carga y sueño.');
  }
  return msgs.join(' ');
}
function rendimiento_() {
  var exp = {}, out = { indicadores: [], metconsRef: [], murph: null, residuo: [], ritmos: null, strava: null };
  try { exp = exposiciones8_(); } catch (e) { Logger.log('Rendimiento · exposiciones: ' + e); }
  INDICADORES_.forEach(function (ind) {
    var serie = [], mejor = null, ultimo = null, anterior = null, tend = '', alerta = '';
    try {
      serie = serieIndicador_(ind.clave);
      ultimo = serie.length ? serie[serie.length - 1] : null;
      anterior = serie.length > 1 ? serie[serie.length - 2] : null;
      var con = serie.filter(function (s) { return s.v != null; });
      if (con.length) { var mv = v29Mejor_(ind, con.map(function (s) { return s.v; })); mejor = con.filter(function (s) { return s.v === mv; })[0]; }
      if (ultimo && anterior && ultimo.v != null && anterior.v != null)
        tend = ultimo.v === anterior.v ? 'igual' : (v29Supera_(ind, ultimo.v, anterior.v) ? 'mejora' : 'empeora');
      alerta = alertaIndicador_(ind, serie, exp[ind.clave] || 0);
    } catch (e) { Logger.log('Rendimiento · ' + ind.clave + ': ' + e); }
    out.indicadores.push({ clave: ind.clave, nombre: ind.nombre, unidad: ind.unidad, mejorEs: ind.mejorEs, ultimo: ultimo, anterior: anterior, mejor: mejor,
      tendencia: tend, serie: serie.slice(-40), exp8: exp[ind.clave] || 0, alerta: alerta });
  });
  try { out.metconsRef = metconsReferencia_(); } catch (e) { Logger.log('Rendimiento · metcons: ' + e); }
  try { out.murph = murphInfo_(); } catch (e) { Logger.log('Rendimiento · murph: ' + e); }
  try { out.residuo = residuo_(); } catch (e) { Logger.log('Rendimiento · residuo: ' + e); }
  try { out.ritmos = { vigentes: v29CfgJson_('ritmos_zonas'), propuesta: v29CfgJson_('ritmos_propuesta'), texto: ritmosTexto_() }; } catch (e) { Logger.log('Rendimiento · ritmos: ' + e); }
  try { out.strava = stravaEstado_(); } catch (e) { Logger.log('Rendimiento · strava: ' + e); }
  try { out.garmin = garminEstado_(); } catch (e) { Logger.log('Rendimiento · garmin: ' + e); }
  return out;
}
/** Guarda un valor a mano en APP · RENDIMIENTO. b = {clave, valor, fecha, notas}. */
function guardarRendimiento_(b) {
  var ind = v29Ind_(b && b.clave); if (!ind) throw new Error('indicador_no_valido');
  var valor = String(b.valor == null ? '' : b.valor).trim().slice(0, 500); if (!valor) throw new Error('falta_valor');
  if (ind.tipo !== 'texto' && valorIndicador_(ind, valor) == null) throw new Error('valor_no_valido');
  var iso = (b.fecha && celdaIso_(b.fecha)) || hoyIso_();
  anadirFila_(HOJAS.RENDIMIENTO, { FECHA: isoAFecha(iso), INDICADOR: ind.clave, VALOR: valor, UNIDAD: ind.unidad, FUENTE: 'App Road To Elite', NOTAS: String(b.notas || '').slice(0, 400), REGISTRADO: ahora_() });
  MEMO = null;
  return ind.clave;
}

// ---------- importar de la app de Gabi (SOLO LECTURA) ----------
/** Lee una pestaña de la app de Gabi: cabecera = primera fila (de las 8 primeras) con «ATLETA». → {cab:{NOMBRE:col}, filas:[[...]]} o null. */
function v29TablaGabi_(libro, nombre) {
  var sh = libro.getSheetByName(nombre);
  if (!sh) libro.getSheets().forEach(function (s) { if (!sh && norm(s.getName()).trim() === norm(nombre)) sh = s; });
  if (!sh || !sh.getLastRow()) return null;
  var v = sh.getDataRange().getDisplayValues(), h = -1, i;
  for (i = 0; i < Math.min(v.length, 8) && h < 0; i++) if (v[i].some(function (c) { return norm(c).trim() === 'ATLETA'; })) h = i;
  if (h < 0) return null;
  var cab = {}; v[h].forEach(function (c, j) { var k = norm(c).trim(); if (k && cab[k] === undefined) cab[k] = j; });
  var filas = v.slice(h + 1).filter(function (r) {
    var p = ''; r.some(function (c) { if (String(c).trim()) { p = String(c).trim(); return true; } return false; });
    return p && p.charAt(0) !== '▸';
  });
  return { cab: cab, filas: filas };
}
function v29EsMia_(T, r, email) {
  var g = function (k) { return T.cab[k] === undefined ? '' : String(r[T.cab[k]] || '').trim(); };
  return (email && g('EMAIL').toLowerCase() === email) || norm(g('ATLETA')).indexOf('PABLO SERRANO') >= 0;
}
function importarGabi_() {
  var res = { marcas: 0, resultados: 0 }, email = '';
  try { email = String(leerConfig_().email_permitido || CONFIG.EMAIL_PERMITIDO || '').toLowerCase().trim(); } catch (e) { email = String(CONFIG.EMAIL_PERMITIDO || '').toLowerCase(); }
  var libro = null;
  try { libro = programApp_(); } catch (e) { Logger.log('Gabi · no se abre la app: ' + e); return res; }
  try {
    var T = v29TablaGabi_(libro, 'MARCAS');
    if (T && T.cab.MARCA !== undefined && T.cab.VALOR !== undefined) {
      var ya = {}, nuevas = [];
      v29Seguro_(HOJAS.MARCAS).forEach(function (m) { ya[norm(m.MOVIMIENTO).trim() + '|' + String(m.VALOR).trim() + '|' + celdaIso_(m.FECHA)] = 1; });
      T.filas.forEach(function (r) {
        if (!v29EsMia_(T, r, email)) return;
        var g = function (k) { return T.cab[k] === undefined ? '' : String(r[T.cab[k]] || '').trim(); };
        var mov = g('MARCA').toUpperCase(), val = g('VALOR'); if (!mov || !val) return;
        var iso = celdaIso_(g('FECHA')) || '', k = norm(mov).trim() + '|' + val + '|' + iso;
        if (ya[k]) return; ya[k] = 1;
        nuevas.push({ FECHA: iso ? isoAFecha(iso) : g('FECHA'), MOVIMIENTO: mov, TIPO: g('TIPO'), VALOR: val, UNIDAD: '', EVENTO: g('EVENTO'), NOTAS: g('NOTAS'), FUENTE: 'App Gabi' });
      });
      res.marcas = filasEnHoja_(HOJAS.MARCAS, nuevas);
    }
  } catch (e) { Logger.log('Gabi · marcas: ' + e); }
  try {
    var R = v29TablaGabi_(libro, 'RESULTADOS');
    if (R && R.cab.RESULTADO !== undefined && R.cab.FECHA !== undefined) {
      var ya2 = {}, nuevas2 = [];
      v29Seguro_(HOJAS.RENDIMIENTO).forEach(function (x) { if (String(x.INDICADOR).trim().toLowerCase() === 'wod') ya2[celdaIso_(x.FECHA) + '|' + norm(x.NOTAS).trim()] = 1; });
      R.filas.forEach(function (r) {
        if (!v29EsMia_(R, r, email)) return;
        var g = function (k) { return R.cab[k] === undefined ? '' : String(r[R.cab[k]] || '').trim(); };
        var res1 = g('RESULTADO'), iso = celdaIso_(g('FECHA')), wod = (g('WOD') || g('METCON')).slice(0, 400);
        if (!res1 || !iso) return;
        var k = iso + '|' + norm(wod).trim(); if (ya2[k]) return; ya2[k] = 1;
        nuevas2.push({ FECHA: isoAFecha(iso), INDICADOR: 'wod', VALOR: res1, UNIDAD: g('TIPO'), FUENTE: 'App Gabi · RESULTADOS', NOTAS: wod, REGISTRADO: ahora_() });
      });
      res.resultados = filasEnHoja_(HOJAS.RENDIMIENTO, nuevas2);
    }
  } catch (e) { Logger.log('Gabi · resultados: ' + e); }
  MEMO = null;
  return res;
}

// ---------- metcons de referencia (hasta 3) ----------
var METCONS_CLASICOS_ = [
  ['Fran', '21-15-9 · Thrusters (43/30 kg) + pull-ups. Por tiempo.'],
  ['Grace', '30 clean & jerk (61/43 kg). Por tiempo.'],
  ['Isabel', '30 snatch (61/43 kg). Por tiempo.'],
  ['Diane', '21-15-9 · Peso muerto (102/70 kg) + HSPU. Por tiempo.'],
  ['Helen', '3 rondas: 400 m carrera + 21 KB swing (24/16 kg) + 12 pull-ups. Por tiempo.'],
  ['Cindy', 'AMRAP 20′: 5 pull-ups + 10 push-ups + 15 air squats.'],
  ['DT', '5 rondas: 12 peso muerto + 9 hang power clean + 6 push jerk (70/47,5 kg). Por tiempo.'],
  ['Murph con chaleco', '1 milla carrera + 100 pull-ups + 200 push-ups + 300 air squats + 1 milla carrera, con chaleco (9/6 kg). Por tiempo; partición libre (p. ej. 5-10-15).']
];
function metconsReferencia_() {
  var out = [], vistos = {};
  var add = function (titulo, texto, motivo, fuente) {
    titulo = String(titulo || '').trim(); var k = norm(titulo); if (!titulo || vistos[k] || out.length >= 3) return;
    vistos[k] = 1; out.push({ titulo: titulo.slice(0, 80), texto: String(texto || '').trim(), motivo: motivo, fuente: fuente });
  };
  var filas = v29Seguro_(HOJAS.RENDIMIENTO);
  // (a) guardados como referencia: más reciente primero
  filas.filter(function (r) { return /^(metcon|ref)$/.test(String(r.INDICADOR || '').trim().toLowerCase()); })
    .sort(function (a, b) { var x = celdaIso_(a.FECHA), y = celdaIso_(b.FECHA); return x < y ? 1 : x > y ? -1 : b._fila - a._fila; })
    .forEach(function (r) {
      var t = v29Linea_(r.NOTAS) || v29Linea_(r.VALOR, 60);
      if (/^\d{1,3}:\d{2}/.test(t)) t = 'Metcon de referencia · ' + t;   // un tiempo suelto no es un título
      add(t, r.VALOR, 'Lo marcaste como referencia', 'Rendimiento');
    });
  v29Seguro_('APP · FICHAS').forEach(function (f) {
    if (norm(f.REFERENCIA).trim() !== 'SI') return;
    var w = f.WOD || f.CONTENIDO || f.TEXTO || ''; add(f['TÍTULO'] || f.NOMBRE || ((f.EVENTO ? f.EVENTO + ' · ' : '') + (v29Linea_(w, 50) || 'WOD de competición')), w, f['QUÉ FALLÓ'] ? 'Ficha de competición: ' + String(f['QUÉ FALLÓ']).slice(0, 120) : 'Lo marcaste como referencia', 'Fichas');
  });
  // (b) peor resultado del último ciclo de 6 semanas (sin ranking: el más lento en tiempo / el que menos reps en AMRAP)
  if (out.length < 3) {
    var desde = sumarDias(hoyIso_(), -42), tiempos = [], amraps = [];
    filas.forEach(function (r) {
      if (String(r.INDICADOR || '').trim().toLowerCase() !== 'wod') return;
      var f = celdaIso_(r.FECHA); if (!f || f < desde) return;
      var u = norm(r.UNIDAD), val = String(r.VALOR || '').trim();
      var esT = /TIEMPO|TIME/.test(u) || (/^\d{1,3}:\d{2}/.test(val) && !/AMRAP|REPS|RONDAS/.test(u));
      var o = { r: r, fecha: f };
      if (esT) { o.k = segundos_(val); if (o.k > 0) tiempos.push(o); }
      else { o.k = v29Num_(val); if (o.k != null) amraps.push(o); }
    });
    tiempos.sort(function (a, b) { return b.k - a.k; }); amraps.sort(function (a, b) { return a.k - b.k; });
    var cola = [], i;
    for (i = 0; i < Math.max(tiempos.length, amraps.length); i++) { if (tiempos[i]) cola.push(tiempos[i]); if (amraps[i]) cola.push(amraps[i]); }
    cola.forEach(function (o) {
      add(v29Linea_(o.r.NOTAS, 60), String(o.r.NOTAS || '') + '\nTu resultado: ' + o.r.VALOR + ' (' + isoAFecha(o.fecha).slice(0, 5) + ')', 'Tu peor resultado del ciclo', 'App Gabi');
    });
  }
  // (c) benchmarks clásicos, rotando cada semana
  if (out.length < 3) {
    var sem = Math.floor(new Date(hoyIso_() + 'T12:00:00Z').getTime() / 86400000 / 7), n = METCONS_CLASICOS_.length, j;
    for (j = 0; j < n && out.length < 3; j++) { var c = METCONS_CLASICOS_[(sem + j) % n]; add(c[0], c[1], 'Benchmark clásico', 'Clásico'); }
  }
  return out;
}
/** Crea un BORRADOR de metcon de referencia (RF1) en APP · PLAN y devuelve la semana. b = {titulo, texto, iso, turno}. */
function programarReferencia_(b) {
  var iso = isoOk_(b && b.iso) || celdaIso_(b && b.iso); if (!iso) throw new Error('fecha_no_valida');
  var turno = String(b.turno || 'PM').toUpperCase() === 'AM' ? 'AM' : 'PM', id = nuevoId_(), titulo = String(b.titulo || 'Metcon de referencia').slice(0, 120);
  anadirFila_(HOJAS.PLAN, { ID: id, FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: turno, ORDEN: turno === 'AM' ? 6 : 85, ORIGEN: 'EXTRA', BLOQUE: titulo, 'TÍTULO': titulo,
    CONTENIDO: String(b.texto || '').slice(0, 4000), MIN: 25, 'CÓDIGOS': 'RF1', 'POR QUÉ (cursiva)': 'Metcon de referencia: se repite cada cierto tiempo para medir tu progreso en las mismas condiciones.',
    ESTADO: 'BORRADOR', GENERADO: 'manual ' + ahora_() + ' (candado)', ACTUALIZADO: ahora_() });
  MEMO = null;
  var semana = null; try { semana = semanaCompleta_(lunesDe_(iso)); } catch (e) { Logger.log('Referencia · semana no legible: ' + e); }   // la fila ya está creada: no se reintenta
  return { ok: true, id: id, semana: semana };
}

// ---------- Murph con chaleco ----------
var MURPH_PLAN_ = [
  { sem: -6, rondas: 10, carrera: '800 m', titulo: 'Murph con chaleco · ½ (5-10-15)', min: 40, pq: 'Primer ensayo: la mitad del volumen con el chaleco puesto; el objetivo es aprender el reparto, no el tiempo.' },
  { sem: -4, rondas: 15, carrera: '1,2 km', titulo: 'Murph con chaleco · ¾ (5-10-15)', min: 50, pq: 'Segundo ensayo: sube a ¾ y la carrera a 1,2 km. Mismo chaleco y mismo reparto: la fatiga acumulada de pull-ups y squats es lo que se entrena.' },
  { sem: -2, rondas: 20, carrera: '1 milla (1,6 km)', titulo: 'Murph con chaleco · completo (5-10-15)', min: 65, pq: 'Ensayo general a dos semanas: Murph completo particionado, con chaleco, a RPE 7–8 para llegar con reserva y con el ritmo ya probado.' }
];
function murphSesiones_(fecha) {
  var f = celdaIso_(String(fecha || '').replace(/^'/, '')); if (!f) return [];
  var l = lunesDe_(f), hoy = hoyIso_();
  return MURPH_PLAN_.map(function (p, i) {
    var iso = sumarDias(l, p.sem * 7), pu = p.rondas * 5, pp = p.rondas * 10, sq = p.rondas * 15;
    var cont = (i === 0 ? '½' : i === 1 ? '¾' : 'COMPLETO') + ' MURPH CON CHALECO · RPE 7–8\n' + p.carrera + ' carrera\n' + p.rondas + ' rondas × (5 pull-ups + 10 push-ups + 15 squats) = ' + pu + ' / ' + pp + ' / ' + sq + '\n' + p.carrera + ' carrera\n\n' +
      'Todo con el chaleco puesto, de principio a fin (el mismo del Murph). Reparto 5-10-15: nunca a fallo, respira entre rondas.\n' +
      (i === 2 ? 'Es el ensayo general: mismo orden, mismo ritmo de carrera y misma nutrición que el día D. Anota el tiempo cada 5 rondas.' : 'Anota el tiempo total, el de cada carrera y el de cada 5 rondas. Si la técnica del pull-up se rompe, baja a 4-8-12.');
    return { fecha: iso, semana: p.sem, titulo: p.titulo, contenido: cont, min: p.min, pq: p.pq, pasada: iso < hoy };
  });
}
function murphInfo_() {
  var f = v29CfgIso_('murph_fecha'); if (!f) return null;
  return { fecha: f, dias: Math.round((new Date(f + 'T12:00:00Z').getTime() - new Date(hoyIso_() + 'T12:00:00Z').getTime()) / 86400000), sesiones: murphSesiones_(f) };
}
/** Guarda (o borra, si va vacía) la fecha del Murph. */
function murphFecha_(fecha) {
  var f = String(fecha || '').trim() ? celdaIso_(String(fecha).trim()) : '';
  if (String(fecha || '').trim() && !f) throw new Error('fecha_no_valida');
  ponerConfig_('murph_fecha', f ? "'" + f : '', 'Fecha del Murph (los lunes −6, −4 y −2 semanas llevan ensayo con chaleco)');
  MEMO = null;
  return { ok: true, murph: murphInfo_() };
}
/** Bloques de ensayo de Murph que tocan en la semana de ese lunes (para que el generador los añada). */
function murphBloquesSemana_(lunes) {
  var l = lunesDe_(lunes), f = v29CfgIso_('murph_fecha'); if (!f) return [];
  var s = murphSesiones_(f).filter(function (x) { return x.fecha === l; })[0]; if (!s) return [];
  return [{ FECHA: isoAFecha(l), 'DÍA': 'Lunes', TURNO: 'AM', ORIGEN: 'EXTRA', 'TÍTULO': s.titulo, CONTENIDO: s.contenido, MIN: s.min, 'CÓDIGOS': 'MU1', INTENSIDAD: '🟠 Calidad', 'POR QUÉ (cursiva)': s.pq }];
}

// ---------- siembra: carrera comprometida (RC1), metcon de referencia (RF1), Murph (MU1) ----------
var V29_EST_ = [
  { 'CÓDIGO': 'RC1', NOMBRE: 'Test de carrera comprometida', ORIGEN: 'EXTRA', TURNO: 'PM', MIN: 35, INTENSIDAD: '🟠 Calidad',
    CONTENIDO: '3 rondas: 60–90″ de estación (ronda 1: 15 wall balls · ronda 2: 12 cal remo · ronda 3: 20 m zancada con KB) + 400 m con reloj.\n3′ de pausa entre rondas.\nRegistra el parcial de los primeros 200 m y el de los 400 m de cada ronda.',
    'POR QUÉ (cursiva)': 'Correr con las piernas y la respiración ya comprometidas es lo que pasa en un HYROX o en un metcon con carrera: aquí se mide cuánto ritmo conservas.',
    'CIENCIA (técnica · fisiología · biología)': 'Técnica: zancada corta y cadencia alta desde el primer paso. Fisiología: tolerancia al lactato y economía de carrera con fatiga previa. Biología: la caída del segundo 200 m frente al primero mide el coste de la estación.',
    INTERFERENCIAS: '≥48 h de otra sesión de pierna pesada o de Z6–Z8.', CARGA: 'IMPACTO GLUC PIERNA', 'DATOS A REGISTRAR': 'Parcial 200 m y 400 m de cada ronda, estación, FC y RPE' },
  { 'CÓDIGO': 'RF1', NOMBRE: 'Metcon de referencia', ORIGEN: 'EXTRA', TURNO: 'PM', MIN: 25, INTENSIDAD: '🟠 Calidad',
    CONTENIDO: 'El contenido real lo pone el generador (un metcon de referencia que se repite para comparar).',
    'POR QUÉ (cursiva)': 'Repetir el mismo metcon cada cierto tiempo es la forma más limpia de medir si el motor mejora.',
    'CIENCIA (técnica · fisiología · biología)': 'Técnica: mismas cargas y mismos movimientos. Fisiología: respuesta glucolítica comparable entre fechas. Biología: tiempo y reps solo valen si el descanso y la hora son parecidos.',
    INTERFERENCIAS: '≥48 h de otra sesión intensa.', CARGA: 'GLUC', 'DATOS A REGISTRAR': 'Tiempo o reps, cargas y RPE' },
  { 'CÓDIGO': 'MU1', NOMBRE: 'Murph con chaleco · ensayo', ORIGEN: 'EXTRA', TURNO: 'AM', MIN: 50, INTENSIDAD: '🟠 Calidad',
    CONTENIDO: 'Lo pone el calendario del Murph (½ → ¾ → completo, partición 5-10-15, con chaleco).',
    'POR QUÉ (cursiva)': 'Ensayo progresivo del Murph con chaleco en las semanas −6, −4 y −2.',
    'CIENCIA (técnica · fisiología · biología)': 'Técnica: reparto 5-10-15 sin ir a fallo. Fisiología: resistencia muscular de tirón, empuje y pierna con carrera. Biología: el chaleco sube el coste de cada repetición.',
    INTERFERENCIAS: 'Sin pierna pesada ni Z6–Z8 las 48 h previas.', CARGA: 'PIERNA AGARRE IMPACTO GLUC', 'DATOS A REGISTRAR': 'Tiempo total, tiempos de carrera y de cada 5 rondas' }
];
var V29_METAS_ = [
  { ID: 'v29rc001', 'ÁMBITO': 'Mes', PRIORIDAD: 'P3 · Carrera comprometida', 'ESTÍMULO': 'TEST DE CARRERA COMPROMETIDA', META: '1', TIPO: 'COUNT', UNIDAD: 'tests/mes', 'CÓDIGOS': 'RC1', ACTIVA: 'Sí',
    NOTAS: 'v29a · 3 × (estación 60–90″ + 400 m) con parciales de 200 y 400 m.' },
  { ID: 'v29rf001', 'ÁMBITO': 'Mes', PRIORIDAD: 'P3 · Metcon de referencia', 'ESTÍMULO': 'METCON DE REFERENCIA', META: '1', TIPO: 'COUNT', UNIDAD: 'sesiones/mes', 'CÓDIGOS': 'RF1', ACTIVA: 'Sí',
    NOTAS: 'v29a · el generador pone el metcon (de APP · RENDIMIENTO o benchmark clásico).' }
];
/** Siembra RC1, RF1 y MU1 + sus metas sin duplicar (patrón de opPrepararCatalogo_). Devuelve un texto de log. */
function prepararV29a_() {
  var cat = {}; listar_(HOJAS.ESTIMULOS).forEach(function (r) { cat[String(r['CÓDIGO']).trim().toUpperCase()] = 1; });
  var nuevas = V29_EST_.filter(function (e) { return !cat[e['CÓDIGO']]; }).map(function (e) { var o = Object.assign({}, e); o.ACTIVO = 'Sí'; return o; });
  filasEnHoja_(HOJAS.ESTIMULOS, nuevas);
  var metas = {}; listar_(HOJAS.METAS).forEach(function (m) { metas[m.ID] = 1; });
  var nm = V29_METAS_.filter(function (m) { return !metas[m.ID]; });
  filasEnHoja_(HOJAS.METAS, nm); MEMO = null;
  return nuevas.length + ' estímulos y ' + nm.length + ' metas nuevas (RC1, RF1, MU1) · hoja de rendimiento: ' + (function () { try { hojaMia_(HOJAS.RENDIMIENTO); return 'lista'; } catch (e) { return 'se crea al preparar las hojas'; } })();
}

// ---------- residuo: qué estímulos dejan más cansancio al día siguiente ----------
function residuo_() {
  var desde = sumarDias(hoyIso_(), -56), plan = {}, cans = {}, todos = [], cat = {}, porCod = {}, vistos = {};
  try { cat = catalogo_(); } catch (e) {}
  v29Seguro_(HOJAS.PLAN).forEach(function (p) { if (p.ID) plan[p.ID] = p; });
  v29Seguro_(HOJAS.CHEQUEO).forEach(function (c) {
    var f = celdaIso_(c.FECHA), v = v29Num_(c['CANSANCIO (1-10)']); if (!f || v == null || f < desde) return;
    cans[f] = v; todos.push(v);
  });
  if (!todos.length) return [];
  var global = v29Media_(todos);
  v29Seguro_(HOJAS.REGISTRO).forEach(function (r) {
    if (norm(r.HECHO).trim() !== 'SI') return;
    var p = plan[r.ID_PLAN]; if (!p) return;
    var f = celdaIso_(r.FECHA) || celdaIso_(p.FECHA); if (!f || f < desde) return;
    var sig = cans[sumarDias(f, 1)]; if (sig === undefined) return;
    codigosDe_(p['CÓDIGOS']).forEach(function (c) {
      var k = c + '|' + f; if (vistos[k]) return; vistos[k] = 1;
      (porCod[c] = porCod[c] || []).push(sig);
    });
  });
  return Object.keys(porCod).filter(function (c) { return porCod[c].length >= 2; }).map(function (c) {
    var e = cat[c] || {};
    return { codigo: c, nombre: e.NOMBRE || c, delta: v29Redondea_(v29Media_(porCod[c]) - global, 2), n: porCod[c].length };
  }).filter(function (x) { return x.delta > 0; }).sort(function (a, b) { return b.delta - a.delta; }).slice(0, 6);
}

// ---------- ritmos por zona desde el test de 2 km ----------
function ritmosDesde2k_(seg) {
  var p2 = seg / 2;
  return { z5: mmss_(p2 + 3), z4: mmss_(p2 * 1.10), z2: [mmss_(p2 * 1.40), mmss_(p2 * 1.50)] };
}
/** Si hay un test de 2 km más nuevo que los ritmos vigentes, guarda la PROPUESTA (no la aplica). Devuelve la propuesta o null. */
function revisarRitmos_() {
  var tests = tests2kCarrera_(); if (!tests.length) return null;
  var t = tests[tests.length - 1], vig = v29CfgJson_('ritmos_zonas'), pro = v29CfgJson_('ritmos_propuesta');
  if (vig && vig.de && vig.de >= t.fecha) return null;
  if (pro && pro.de === t.fecha) return pro;
  var r = ritmosDesde2k_(t.seg), prop = { de: t.fecha, t2k: mmss_(t.seg), z2: r.z2, z4: r.z4, z5: r.z5 };
  ponerConfig_('ritmos_propuesta', JSON.stringify(prop), 'Ritmos propuestos tras el test de 2 km: confírmalos en la app');
  MEMO = null;
  try { enviarPush_('Ritmos nuevos propuestos', 'Tras tu test de 2 km (' + prop.t2k + ') propongo Z2 ' + prop.z2[0] + '–' + prop.z2[1] + ' · Z4 ' + prop.z4 + ' · Z5 ' + prop.z5 + ' /km. Confírmalos en Rendimiento.'); } catch (e) { /* sin avisos */ }
  return prop;
}
function ritmosConfirmar_() {
  var pro = v29CfgJson_('ritmos_propuesta'); if (!pro || !pro.de) return { ok: false, error: 'sin_propuesta' };
  ponerConfig_('ritmos_zonas', JSON.stringify(pro), 'Ritmos vigentes por zona (de ' + pro.de + ')');
  ponerConfig_('ritmos_propuesta', '', 'Ritmos propuestos tras el test de 2 km: confírmalos en la app');
  MEMO = null;
  return { ok: true, ritmos: pro, texto: ritmosTexto_() };
}
function ritmosTexto_() {
  var v = v29CfgJson_('ritmos_zonas'); if (!v || !v.z2 || !v.z4 || !v.z5) return '';
  return 'Ritmos vigentes · Z2 ' + v.z2[0] + '–' + v.z2[1] + '/km · Z4 ' + v.z4 + '/km · Z5 ' + v.z5 + '/km';
}

// ---------- Strava ----------
function stravaUrl_() {
  var id = String(leerConfig_().strava_client_id || '').replace(/^'/, '').trim(); if (!id) return '';
  var st = Utilities.getUuid().replace(/-/g, '') + Math.random().toString(36).slice(2);
  CacheService.getScriptCache().put('strava_estado_' + st, '1', 600);
  return 'https://www.strava.com/oauth/authorize?client_id=' + encodeURIComponent(id) + '&response_type=code&redirect_uri=' + encodeURIComponent(ScriptApp.getService().getUrl()) +
    '&scope=activity:read_all&approval_prompt=auto&state=' + encodeURIComponent(st);
}
function v29Html_(titulo, texto) {
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;padding:2em;max-width:30em;margin:auto"><h2>' + titulo + '</h2><p>' + texto + '</p></body>');
}
/** doGet(e) la llama cuando llegan e.parameter.code y e.parameter.state. */
function stravaCallback_(e) {
  try {
    var p = (e && e.parameter) || {}, cache = CacheService.getScriptCache(), k = 'strava_estado_' + String(p.state || '');
    if (!p.state || !cache.get(k)) return v29Html_('Enlace caducado', 'El enlace de conexión con Strava ha caducado o no es válido. Vuelve a la app y pulsa «Conectar Strava».');
    try { cache.remove(k); } catch (e2) { /* el estado caduca solo a los 10 min */ }
    if (p.error || !p.code) return v29Html_('Strava no conectado', 'No has autorizado el acceso a Strava. Puedes cerrar esta pestaña y volver a intentarlo desde la app.');
    var id = String(leerConfig_().strava_client_id || '').replace(/^'/, '').trim(), secreto = PROPS.getProperty('STRAVA_SECRET');
    if (!id || !secreto) return v29Html_('Falta configurar Strava', 'Falta el Client ID (APP · CONFIG › strava_client_id) o el secreto (propiedad STRAVA_SECRET del script).');
    var r = UrlFetchApp.fetch('https://www.strava.com/oauth/token', { method: 'post', muteHttpExceptions: true,
      payload: { client_id: id, client_secret: secreto, code: p.code, grant_type: 'authorization_code' } });
    var d = JSON.parse(r.getContentText() || '{}');
    if (r.getResponseCode() !== 200 || !d.access_token) return v29Html_('No se pudo conectar', 'Strava no ha aceptado la conexión. Revisa el Client ID y el secreto.');
    PROPS.setProperty('STRAVA_TOKEN', JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }));
    return v29Html_('Strava conectado', 'Strava conectado, ya puedes cerrar esta pestaña.');
  } catch (err) { return v29Html_('Error', 'No se pudo completar la conexión con Strava.'); }
}
/** Token válido (refresca si caduca en menos de 2 min). '' si no hay conexión. */
function stravaToken_() {
  var raw = PROPS.getProperty('STRAVA_TOKEN'); if (!raw) return '';
  var t; try { t = JSON.parse(raw); } catch (e) { return ''; }
  if (!t || !t.access_token) return '';
  if (t.expires_at && t.expires_at - 120 > Math.floor(Date.now() / 1000)) return t.access_token;
  var id = String(leerConfig_().strava_client_id || '').replace(/^'/, '').trim(), secreto = PROPS.getProperty('STRAVA_SECRET');
  if (!id || !secreto || !t.refresh_token) return '';
  var r = UrlFetchApp.fetch('https://www.strava.com/oauth/token', { method: 'post', muteHttpExceptions: true,
    payload: { client_id: id, client_secret: secreto, grant_type: 'refresh_token', refresh_token: t.refresh_token } });
  var d = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200 || !d.access_token) return '';
  PROPS.setProperty('STRAVA_TOKEN', JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token || t.refresh_token, expires_at: d.expires_at }));
  return d.access_token;
}
function v29TipoCarrera_(p) {
  var cods = codigosDe_(p && p['CÓDIGOS']), txt = norm((p && p['TÍTULO']) + ' ' + (p && p.CONTENIDO));
  if (/TEST/.test(txt) && /(^|[^0-9])2 ?KM/.test(txt)) return 'Test 2 km';
  if (cods.indexOf('R03') >= 0) return 'Z5 VO2max';
  if (cods.indexOf('W04') >= 0 || cods.indexOf('R02') >= 0) return 'Z4 umbral';
  if (cods.indexOf('W01') >= 0) return 'Z2 larga';
  return 'Z2';
}
function v29EsPlanCarrera_(p) {
  var e = norm(p.ESTADO); if (/CANCEL|SUSTITU|NO HACER/.test(e)) return false;
  if (norm(p.ORIGEN).trim() === 'CARRERA') return true;
  return codigosDe_(p['CÓDIGOS']).some(function (c) { return /^(W01|W02|W04|R02|R03|V01)$/.test(c); });
}
function stravaSync_() {
  try {
    var tok = stravaToken_(); if (!tok) return { ok: false, motivo: 'sin_conectar' };
    var cfg = leerConfig_(), ahora = Math.floor(Date.now() / 1000), desde = parseInt(String(cfg.strava_ultima || '').replace(/^'/, ''), 10) || (ahora - 3 * 86400);
    var acts = [], pg;
    for (pg = 1; pg <= 4; pg++) {
      var r = UrlFetchApp.fetch('https://www.strava.com/api/v3/athlete/activities?after=' + desde + '&per_page=50&page=' + pg, { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
      if (r.getResponseCode() === 401) return { ok: false, motivo: 'token' };
      if (r.getResponseCode() !== 200) return { ok: false, motivo: 'strava_' + r.getResponseCode() };
      var lote = JSON.parse(r.getContentText() || '[]'); acts = acts.concat(lote);
      if (lote.length < 50) break;
    }
    var plan = v29Seguro_(HOJAS.PLAN), carr = v29Seguro_(HOJAS.CARRERA), nuevas = 0, actualizadas = 0, maxEpoch = desde;
    acts.forEach(function (a) {
      var inicio = a.start_date ? Math.floor(new Date(a.start_date).getTime() / 1000) : 0; if (inicio > maxEpoch) maxEpoch = inicio;
      var tipoS = String(a.sport_type || a.type || ''); if (tipoS !== 'Run' && tipoS !== 'TrailRun' && String(a.type || '') !== 'Run') return;
      var iso = Utilities.formatDate(new Date(a.start_date), CONFIG.ZONA, 'yyyy-MM-dd'), nota = 'Strava · ' + String(a.name || '').slice(0, 120);
      var km = (a.distance || 0) / 1000, seg = a.moving_time || 0; if (!(seg > 0)) return;
      var cands = plan.filter(function (p) { return celdaIso_(p.FECHA) === iso && v29EsPlanCarrera_(p); });
      var existe = function (idp) { return carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && String(c.ID_PLAN || '') === String(idp || ''); })[0]; };
      var p = cands.filter(function (x) { return !existe(x.ID); })[0] || cands.filter(function (x) { var e = existe(x.ID); return e && String(e.NOTAS || '').indexOf(nota) >= 0; })[0] || cands[0] || null;
      var idPlan = p ? p.ID : '', ex = existe(idPlan);
      if (!idPlan) {   // sin plan: la misma actividad (misma nota) o, si no, la única carrera manual de ese día con distancia parecida (±5 %); si no, fila nueva
        var delDia = carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && !String(c.ID_PLAN || '').trim(); });
        ex = delDia.filter(function (c) { return String(c.NOTAS || '').indexOf(nota) >= 0; })[0] || null;
        if (!ex) {
          var manuales = delDia.filter(function (c) { var kc = v29Num_(c['DISTANCIA (km)']); return !/^Strava/.test(String(c.NOTAS || '')) && kc > 0 && km > 0 && Math.abs(kc - km) / km <= 0.05; });
          if (manuales.length === 1) ex = manuales[0];
        }
      }
      var n = { FECHA: isoAFecha(iso), ID_PLAN: idPlan, TIPO: p ? v29TipoCarrera_(p) : 'Z2', 'DISTANCIA (km)': km.toFixed(2).replace('.', ','),
        TIEMPO: seg >= 3600 ? Math.floor(seg / 3600) + ':' + ('0' + Math.floor((seg % 3600) / 60)).slice(-2) + ':' + ('0' + (seg % 60)).slice(-2) : mmss_(seg),
        NOTAS: nota };
      if (km > 0) n['RITMO MEDIO (/km)'] = mmss_(seg / km);
      if (a.average_heartrate) n['FC MEDIA'] = Math.round(a.average_heartrate);
      if (a.max_heartrate) n['FC MÁX'] = Math.round(a.max_heartrate);
      if (a.total_elevation_gain != null) n['DESNIVEL (m)'] = Math.round(a.total_elevation_gain);
      if (a.average_cadence) n.CADENCIA = Math.round(a.average_cadence * 2);
      if (a.average_temp != null) n['TEMPERATURA (°C)'] = a.average_temp;
      if (ex) {
        var vacios = {}, hay = false;
        Object.keys(n).forEach(function (h) { if (!String(ex[h] == null ? '' : ex[h]).trim() && String(n[h]) !== '') { vacios[h] = n[h]; hay = true; } });
        if (hay) { actualizarFila_(HOJAS.CARRERA, ex._fila, vacios); actualizadas++; Object.keys(vacios).forEach(function (h) { ex[h] = vacios[h]; }); }
      } else {
        n.ID = nuevoId_(); n.REGISTRADO = ahora_();
        anadirFila_(HOJAS.CARRERA, n); nuevas++;
        carr.push({ FECHA: n.FECHA, ID_PLAN: idPlan, NOTAS: nota, _fila: 0 });
      }
    });
    if (acts.length) ponerConfig_('strava_ultima', String(maxEpoch + 1), 'Strava · última actividad sincronizada (epoch)');
    MEMO = null;
    if (nuevas + actualizadas) { try { analizarCarrera_(); } catch (e) { /* no frena la sincronización */ } }
    return { ok: true, nuevas: nuevas, actualizadas: actualizadas, vistas: acts.length };
  } catch (err) { return { ok: false, motivo: 'error', detalle: String(err && err.message || err) }; }
}
function stravaEstado_() {
  var cfg = leerConfig_(), cfgd = !!String(cfg.strava_client_id || '').replace(/^'/, '').trim(), con = !!PROPS.getProperty('STRAVA_TOKEN'), url = '', ult = '';
  if (cfgd && !con) { try { url = stravaUrl_(); } catch (e) { url = ''; } }
  var ep = parseInt(String(cfg.strava_ultima || '').replace(/^'/, ''), 10);
  if (ep > 0) ult = Utilities.formatDate(new Date(ep * 1000), CONFIG.ZONA, 'dd/MM/yyyy HH:mm');
  return { configurado: cfgd, conectado: con, url: url, ultima: ult };
}

// ---------- disparadores ----------
/** Una vez al día (colgar de motorDiario o similar). */
function v29aDiario_() {
  var r = {};
  try { r.gabi = importarGabi_(); } catch (e) { Logger.log('v29a · Gabi: ' + e); }
  try { r.ritmos = revisarRitmos_(); } catch (e) { Logger.log('v29a · ritmos: ' + e); }
  try { r.garmin = garminDiario_(); } catch (e) { Logger.log('Garmin: ' + e); }   // v0.30
  return r;
}
/** Cada hora (colgar de revisarAvisos): sincroniza Strava solo si está conectado. */
function v29aCadaHora_() {
  try { if (PROPS.getProperty('STRAVA_TOKEN')) return stravaSync_(); } catch (e) { Logger.log('v29a · Strava: ' + e); }
  return null;
}


// ===================== v0.30 · GARMIN (API personal gratuita) · 1 vez al día, solo días de carrera o ergómetro =====================
// Clave: Apps Script › Propiedades del script › GARMIN_KEY (nunca en el código ni en el Sheet). Doc: developer.garmin.com/gc-developer-program/personal/
var GARMIN_API_ = 'https://personal.connectapi.garmin.com';
var GARMIN_ERG_ = /ROW|REMO|SKI|BIKE|ASSAULT|AIR ?BIKE|ECHO|ERG|BICI|AIRBIKE/;
function garminToken_() {
  var key = PROPS.getProperty('GARMIN_KEY'); if (!key) return '';
  var c = CacheService.getScriptCache(), t = c.get('garmin_token'); if (t) return t;
  var r = UrlFetchApp.fetch(GARMIN_API_ + '/personalapitoken-service/personal-api/personal-api-key/token', { method: 'post', headers: { Authorization: 'ApiKey ' + key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('garmin_token_' + r.getResponseCode());
  var txt = r.getContentText() || '', d = {}; try { d = JSON.parse(txt); } catch (e) { d = { access_token: txt.trim() }; }
  t = d.access_token || d.accessToken || d.token || ''; if (!t) throw new Error('garmin_token_vacio');
  var vida = Math.max(300, Math.min(21600, (+d.expires_in || +d.expiresIn || 3600) - 120));
  c.put('garmin_token', t, vida);
  return t;
}
function garminGet_(ruta) {
  var tok = garminToken_(); if (!tok) throw new Error('garmin_sin_clave');
  var r = UrlFetchApp.fetch(GARMIN_API_ + ruta, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' }, muteHttpExceptions: true });
  if (r.getResponseCode() === 401) { CacheService.getScriptCache().remove('garmin_token'); throw new Error('garmin_401'); }
  if (r.getResponseCode() !== 200) throw new Error('garmin_' + r.getResponseCode());
  return JSON.parse(r.getContentText() || 'null');
}
/** Qué toca ese día según el plan: carrera, ergómetro o nada (nada → no se llama a Garmin). */
function garminQueToca_(iso) {
  var plan = v29Seguro_(HOJAS.PLAN).filter(function (p) { return celdaIso_(p.FECHA) === iso && !/CANCEL|SUSTITU|NO HACER|PROPUESTA|SIN HUECO/.test(norm(p.ESTADO)); });
  var esErg = function (p) { var t = norm((p['TÍTULO'] || '') + ' ' + (p.BLOQUE || '') + ' ' + (p.CONTENIDO || '')); return GARMIN_ERG_.test(t) || codigosDe_(p['CÓDIGOS']).some(function (c) { return c === 'W03' || c === 'R01'; }); };
  var carrera = plan.filter(function (p) { return v29EsPlanCarrera_(p) && !(esErg(p) && !/RUN|CARRERA|CORRER|TROTE/.test(norm((p['TÍTULO'] || '') + ' ' + (p.CONTENIDO || '')))); });
  var erg = plan.filter(function (p) { return esErg(p) && carrera.indexOf(p) < 0; });
  var manual = v29Seguro_(HOJAS.CARRERA).some(function (c) { return celdaIso_(c.FECHA) === iso; });
  return { carrera: carrera, erg: erg, toca: !!(carrera.length || erg.length || manual) };
}
function garminTiempo_(seg) { seg = Math.round(seg || 0); return seg >= 3600 ? Math.floor(seg / 3600) + ':' + ('0' + Math.floor((seg % 3600) / 60)).slice(-2) + ':' + ('0' + (seg % 60)).slice(-2) : mmss_(seg); }
/** Un día: carreras → APP · CARRERA (completa lo que tengas a mano, sin duplicar); ergómetro → datos del bloque en APP · REGISTRO. */
function garminDia_(iso) {
  var q = garminQueToca_(iso), res = { iso: iso, carrera: 0, erg: 0, vistas: 0, saltado: !q.toca };
  if (!q.toca) return res;
  var acts = garminGet_('/activitylist-service/activities/search/activities?startDate=' + iso + '&endDate=' + iso + '&limit=20&sortOrder=asc') || [];
  res.vistas = acts.length;
  var carr = v29Seguro_(HOJAS.CARRERA), regs = v29Seguro_(HOJAS.REGISTRO), usadosC = {}, usadosE = {};
  acts.forEach(function (a) {
    var tipo = String((a.activityType && a.activityType.typeKey) || '').toLowerCase(), nota = 'Garmin · ' + String(a.activityName || tipo).slice(0, 100) + ' #' + a.activityId;
    var km = (+a.distance || 0) / 1000, seg = +a.movingDuration || +a.duration || 0; if (!(seg > 0)) return;
    if (/run/.test(tipo)) {
      var p = q.carrera.filter(function (x) { return !usadosC[x.ID]; })[0] || null; if (p) usadosC[p.ID] = 1;
      var ex = carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && String(c.NOTAS || '').indexOf('#' + a.activityId) >= 0; })[0] ||
        (p && carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && c.ID_PLAN === p.ID; })[0]) ||
        carr.filter(function (c) { var kc = v29Num_(c['DISTANCIA (km)']); return celdaIso_(c.FECHA) === iso && !String(c.ID_PLAN || '').trim() && !/Garmin|Strava/.test(String(c.NOTAS || '')) && (!kc || (km > 0 && Math.abs(kc - km) / km <= 0.05)); })[0] || null;
      var n = { FECHA: isoAFecha(iso), ID_PLAN: p ? p.ID : (ex ? ex.ID_PLAN || '' : ''), TIPO: p ? v29TipoCarrera_(p) : 'Z2', 'DISTANCIA (km)': km.toFixed(2).replace('.', ','), TIEMPO: garminTiempo_(seg), NOTAS: nota };
      if (km > 0) n['RITMO MEDIO (/km)'] = mmss_(seg / km);
      if (a.averageHR) n['FC MEDIA'] = Math.round(a.averageHR);
      if (a.maxHR) n['FC MÁX'] = Math.round(a.maxHR);
      if (a.elevationGain != null) n['DESNIVEL (m)'] = Math.round(a.elevationGain);
      if (a.averageRunningCadenceInStepsPerMinute) n.CADENCIA = Math.round(a.averageRunningCadenceInStepsPerMinute);
      if (a.maxTemperature != null && a.minTemperature != null) n['TEMPERATURA (°C)'] = Math.round((a.maxTemperature + a.minTemperature) / 2);
      if (ex) {
        var vac = {}, hay = false;
        Object.keys(n).forEach(function (h) { if (!String(ex[h] == null ? '' : ex[h]).trim() && String(n[h]) !== '') { vac[h] = n[h]; hay = true; } });
        if (String(ex.NOTAS || '').indexOf('#' + a.activityId) < 0) { vac.NOTAS = (ex.NOTAS ? ex.NOTAS + ' · ' : '') + nota; hay = true; }
        if (hay) { actualizarFila_(HOJAS.CARRERA, ex._fila, vac); res.carrera++; }
      } else { n.ID = nuevoId_(); n.REGISTRADO = ahora_(); anadirFila_(HOJAS.CARRERA, n); res.carrera++; carr.push(Object.assign({ _fila: 0 }, n)); }
      return;
    }
    if (/row|cycl|bik|ski|cardio|elliptical|stair/.test(tipo)) {
      var b = q.erg.filter(function (x) { return !usadosE[x.ID]; })[0]; if (!b) return; usadosE[b.ID] = 1;
      var dat = 'Garmin · ' + (a.activityName || tipo) + ' · ' + (km > 0 ? Math.round(km * 1000) + ' m · ' : '') + garminTiempo_(seg) +
        (a.averageHR ? ' · FC ' + Math.round(a.averageHR) + (a.maxHR ? '/' + Math.round(a.maxHR) : '') : '') + (a.avgPower ? ' · ' + Math.round(a.avgPower) + ' W' : '') + (a.calories ? ' · ' + Math.round(a.calories) + ' kcal' : '') + ' #' + a.activityId;
      var r = regs.filter(function (x) { return x.ID_PLAN === b.ID && celdaIso_(x.FECHA) === iso; })[0];
      if (r) { if (String(r['DATOS (parciales/vatios)'] || '').indexOf('#' + a.activityId) < 0) { actualizarFila_(HOJAS.REGISTRO, r._fila, { 'DATOS (parciales/vatios)': (r['DATOS (parciales/vatios)'] ? r['DATOS (parciales/vatios)'] + ' · ' : '') + dat, MIN_REAL: r.MIN_REAL || String(Math.round(seg / 60)) }); res.erg++; } }
      else { guardarRegistro_({ FECHA: isoAFecha(iso), ID_PLAN: b.ID, BLOQUE: b['TÍTULO'] || b.BLOQUE || '', HECHO: 'Sí', MIN_REAL: String(Math.round(seg / 60)), 'DATOS (parciales/vatios)': dat, NOTAS: 'Desde Garmin' }); res.erg++; }
    }
  });
  MEMO = null;
  return res;
}
/** Diario (04:00): los días pendientes desde la última vez hasta ayer (máx. 7), solo si ese día había carrera o ergómetro. */
function garminDiario_(forzarIso) {
  if (!PROPS.getProperty('GARMIN_KEY')) return { ok: false, motivo: 'sin_clave' };
  var cfg = leerConfig_(), ayer = sumarDias(hoyIso_(), -1), ult = celdaIso_(String(cfg.garmin_ultimo || '').replace(/^'/, '')) || sumarDias(ayer, -2);
  var dias = []; if (forzarIso) dias = [celdaIso_(forzarIso)]; else for (var d = sumarDias(ult, 1); d <= ayer && dias.length < 7; d = sumarDias(d, 1)) dias.push(d);
  var out = { ok: true, dias: [], carrera: 0, erg: 0 };
  try {
    dias.forEach(function (d) { var r = garminDia_(d); out.dias.push(r); out.carrera += r.carrera; out.erg += r.erg; if (!forzarIso) ponerConfig_('garmin_ultimo', "'" + d, 'Garmin · último día revisado (solo días de carrera o ergómetro)'); });
    ponerConfig_('garmin_estado', ahora_() + ' · OK · ' + out.carrera + ' carreras · ' + out.erg + ' ergómetro', 'Garmin · resultado de la última sincronización');
    if (out.carrera) { try { analizarCarrera_(); } catch (e) {} }
  } catch (err) {
    out = { ok: false, motivo: String(err && err.message || err) };
    ponerConfig_('garmin_estado', ahora_() + ' · FALLO · ' + out.motivo, 'Garmin · resultado de la última sincronización');
  }
  return out;
}
function garminEstado_() {
  var cfg = leerConfig_();
  return { configurado: !!PROPS.getProperty('GARMIN_KEY'), ultimo: String(cfg.garmin_ultimo || '').replace(/^'/, ''), estado: String(cfg.garmin_estado || '') };
}
