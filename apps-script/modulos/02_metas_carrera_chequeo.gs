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
    'SERIES (tiempos)', 'PARCIALES CUMPLIDOS', 'CADENCIA', 'DESNIVEL (m)', 'TEMPERATURA (°C)', 'SUPERFICIE', 'RPE', 'SENSACIONES', 'NOTAS', 'REGISTRADO', 'PIERNAS', 'RESPIRACIÓN', 'MARGEN'],
  anchos: [70, 95, 90, 160, 110, 80, 80, 90, 70, 70, 80, 220, 220, 100, 70, 70, 80, 100, 50, 220, 220, 120, 90, 100, 130], fechas: ['FECHA'],
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
    var cods = codigosDe_(m['CÓDIGOS']), meta = Math.max(0, metaDe_(m, per.mes) * factorMeta_(m, per.desde, ambito).f + (ambito === 'Semana' && cache.incent ? (cache.incent[per.desde] || {})[m.ID] || 0 : 0)), tipo = String(m.TIPO || 'COUNT').toUpperCase();
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
  var inc = {}; try { var ic = JSON.parse(String(leerConfig_().incentivos || '{}')) || {}; Object.keys(ic).forEach(function (k) { var x = ic[k]; inc[x.lunes] = inc[x.lunes] || {}; Object.keys(x.deltas || {}).forEach(function (m) { inc[x.lunes][m] = (inc[x.lunes][m] || 0) + x.deltas[m]; }); }); } catch (e) {}
  return { metas: listar_(HOJAS.METAS), plan: listar_(HOJAS.PLAN), reg: listar_(HOJAS.REGISTRO), ajustes: listar_(HOJAS.AJUSTES), incent: inc };
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
  'SERIES (tiempos)', 'PARCIALES CUMPLIDOS', 'CADENCIA', 'DESNIVEL (m)', 'TEMPERATURA (°C)', 'SUPERFICIE', 'RPE', 'SENSACIONES', 'NOTAS', 'PIERNAS', 'RESPIRACIÓN', 'MARGEN'];
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
  if (o['HUMEDAD (%)']) asegurarColumna_(HOJAS.CARRERA, 'HUMEDAD (%)');
  if (o.PIERNAS || o['RESPIRACIÓN'] || o.MARGEN) ['PIERNAS', 'RESPIRACIÓN', 'MARGEN'].forEach(function (h) { asegurarColumna_(HOJAS.CARRERA, h); });   // v0.26 · feedback de la sesión
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
  var o = permitidas_(c, CAMPOS_CHEQUEO); if (c && c['PESO (kg)']) { asegurarColumna_(HOJAS.CHEQUEO, 'PESO (kg)'); o['PESO (kg)'] = String(c['PESO (kg)']).slice(0, 8); }
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
function revisarAvisos() { return conSalud_('revisarAvisos', revisarAvisos_sin_); }
function revisarAvisos_sin_() {
  var bkAlerta = ''; try { revisarBackup_(); bkAlerta = leerConfig_().backup_alerta || ''; } catch (e) { Logger.log('Backup: ' + e); }
  try { revisarSalud_(); } catch (e) { Logger.log('Salud: ' + e); }
  try { v29aCadaHora_(); } catch (e) { Logger.log('v29a hora: ' + e); }
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
    if (bkAlerta) avisar('backup_' + hoy, 'Backup sin hacer', bkAlerta);
    // v0.26 · sin chequeo diario; lo que sí importa: el feedback de cada carrera (ajusta las de la semana siguiente)
    if (hora >= 20) { var corrHoy = filasActivasDia_(hoy).filter(function (r) { return esCarreraFila_(r) && /^(PROGRAMADO)$/.test(r.ESTADO); });
      var conFb = {}; listar_(HOJAS.CARRERA).forEach(function (r) { if (celdaIso_(r.FECHA) === hoy) conFb[r.ID_PLAN || '_'] = 1; });
      if (corrHoy.some(function (r) { return !conFb[r.ID]; })) avisar('fbcarrera_' + hoy, 'Tu feedback de la carrera', '20 segundos: RPE, piernas, respiración y si podías más. Con eso ajusto las de la semana que viene.'); }
  });
  Object.keys(hecho).forEach(function (k) { if (hecho[k] < sumarDias(hoy, -21)) delete hecho[k]; });
  PROPS.setProperty('AVISOS_HECHOS', JSON.stringify(hecho));
}

