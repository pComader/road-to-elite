// ===================== v0.28 · CARGA Y VOLUMEN · CICLO DE EXTRAS · INTENSIVOS =====================
/*
 * Decisiones de Pablo (deathnote 13–14/11/2026):
 *  · mañana ≤60′, tarde ≤120′; como mucho 2 extras y ~30′ de extras por sesión (el volumen de extras era excesivo);
 *  · pendientes: valen de una semana a la siguiente; si no entran, se eliminan;
 *  · material hasta el 20/12/2026: anillas y cuerda juntas y por la mañana (otro gimnasio); sin trineo; sandbag/slamball → doble KB front rack; Z2 siempre de mañana;
 *  · la batería vuelve, pero muda: solo datos para analizar (residuo, descarga, contexto de la carrera);
 *  · descarga automática: cansancio medio ≥8 al cerrar la semana y sin un día de descanso real → extras a la mitad y en formato técnico;
 *  · hasta la operación se duplican HSPU y RMU (el resto se ajusta);
 *  · extras por ciclo, alineados con la semana del ciclo de Fabrik: 1–2 técnica con déficit · 3 intensidad e interferencia · 4 CrossFit puro;
 *  · intensivos de 3 semanas tras la operación: pino + sandbag desde que vuelve el pino; HSPU + flexiones libres desde que vuelven las HSPU (se duplican esos semanales);
 *  · en cuanto vuelven carrera, Z2 y P1–P4, la intensidad queda garantizada (no la toca ni la descarga ni el tope de extras).
 */
CAP_TURNO_.AM = 60;
var EXTRAS_MAX_ = { n: 2, min: 30 };   // por sesión, sin contar carrera ni P1–P4
function esIntocable_(cods) { return cods.some(function (c) { return /^(W01|W02|W03|W04|R01|R02|R03|R04|V01|OP1|OP2|OP3|CT1|MU1)$/.test(c); }); }
// ---------- material ----------
var MATERIAL_ = { anillasCuerda: /^(W13|M30|M49|M02|M36|M37)$/, z2: /^(W01|W02)$/ };
function materialLimitado_(iso) { var h = celdaIso_(leerConfig_().material_limite_hasta) || '2026-12-20'; return iso <= h; }
function materialVeto_(cods, iso, turno) {
  if (!materialLimitado_(iso)) return '';
  if (turno === 'PM' && cods.some(function (c) { return MATERIAL_.anillasCuerda.test(c); })) return 'anillas y cuerda están en otro gimnasio: van por la mañana o antes de clase';
  if (turno === 'PM' && cods.some(function (c) { return MATERIAL_.z2.test(c); }) && !cods.some(function (c) { return /^(W04|V01|R0[1-4])$/.test(c); })) return 'la Z2 de carrera va siempre de mañana';
  return '';
}
function materialTexto_(o, iso) {
  if (!materialLimitado_(iso)) return o; var c = String(o['CÓDIGOS'] || '');
  if (/\bM38\b/.test(c)) o.CONTENIDO = 'SIN TRINEO (hasta el 20/12) · sustituto con el mismo estímulo de empuje y tracción de pierna:\n5 × (20 m zancada pesada con doble KB en front rack + 15″ bike a resistencia máxima) / 2′\n\n(Original: ' + String(o.CONTENIDO || '').split('\n')[0].slice(0, 120) + ')';
  if (/\bM57\b/.test(c)) o.CONTENIDO = 'SIN SANDBAG / SLAMBALL (hasta el 20/12) · hazlo con DOBLE KETTLEBELL EN FRONT RACK (carries, zancadas o sentadilla según el bloque).\n\n' + (o.CONTENIDO || '');
  return o;
}
// ---------- pendientes: una semana y fuera ----------
function caducarPendientes_() {
  var lunes = lunesDe_(hoyIso_()), n = 0;
  listar_(HOJAS.PENDIENTES).forEach(function (r) {
    if (r.ESTADO !== 'Pendiente' && r.ESTADO !== 'Propuesto') return;
    var d = celdaIso_(r['FECHA ORIGINAL']) || celdaIso_(String(r.CREADO || '').slice(0, 10)); if (!d) return;
    if (lunesDe_(d) < sumarDias(lunes, -7)) { actualizarFila_(HOJAS.PENDIENTES, r._fila, { ESTADO: 'Descartado', NOTAS: ((r.NOTAS || '') + ' · Caducado: no entró en la semana siguiente').trim() }); n++; }   // era de hace 2 semanas o más: no entró en la siguiente
  });
  if (n) MEMO = null; return n;
}
// ---------- batería muda + descarga automática ----------
/** Media de cansancio de la semana anterior y si hubo un día de descanso real (nada, o solo Z2). */
function estadoCarga_(lunes) {
  var ant = sumarDias(lunes, -7), ch = listar_(HOJAS.CHEQUEO).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= ant && d < lunes; });
  var cans = ch.map(function (r) { return parseFloat(r['CANSANCIO (1-10)']) || 0; }).filter(Boolean), ult = cans.slice(-3);
  var media = ult.length ? ult.reduce(function (a, b) { return a + b; }, 0) / ult.length : 0;
  var reg = {}; listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN && r.HECHO === 'Sí') reg[r.ID_PLAN] = 1; });
  var porDia = {}; listar_(HOJAS.PLAN).forEach(function (r) { var d = celdaIso_(r.FECHA); if (d < sumarDias(ant, -7) || d >= lunes || !/^(PROGRAMADO)$/.test(r.ESTADO)) return;
    (porDia[d] = porDia[d] || []).push(/^(W01|W02|W03)$/.test(String(r['CÓDIGOS'] || '').trim()) ? 'z2' : 'x'); });
  var descanso = false; for (var k = 0; k < 14; k++) { var iso = sumarDias(lunes, -1 - k), l = porDia[iso] || []; if (!l.length || l.every(function (x) { return x === 'z2'; })) { descanso = true; break; } }
  return { media: Math.round(media * 10) / 10, n: cans.length, sinDescanso: !descanso, descarga: ult.length >= 2 && media >= 8 && !descanso };
}
// ---------- factores de meta: duplicar HSPU/RMU hasta la operación e intensivos de vuelta ----------
var DUP_PREVIA_ = /\b(W15|W16|W17|W31|W13|M30|M49)\b/, INT_PINO_ = /\b(W32|W33|W25|W26|W27|W28|M56|M57)\b/, INT_HSPU_ = /\b(W15|W16|W17|W31|W32)\b/;
function ventanasIntensivo_() {
  if (ventanasIntensivo_.c !== undefined) return ventanasIntensivo_.c;
  var o = null; try { var cfg = opCfg_(); if (cfg.existe && cfg.d0) { var fs = opFases_(cfg), p6 = fs.filter(function (f) { return f.clave === 'POST6'; })[0], p7 = fs.filter(function (f) { return f.clave === 'POST7'; })[0];
    o = { cfg: cfg, pino: p6 && !p6.pendiente ? [p6.desde, sumarDias(p6.desde, 20)] : null, hspu: p7 && !p7.pendiente ? [p7.desde, sumarDias(p7.desde, 20)] : null }; } else if (cfg.existe) o = { cfg: cfg }; } catch (e) {}
  return (ventanasIntensivo_.c = o);
}
/** ×2 para la meta m en la semana/mes que empieza en `desde` (y motivo). */
function factorMeta_(m, desde, ambito) {
  var v = ventanasIntensivo_(); if (!v) return { f: 1 };
  var cods = String(m['CÓDIGOS'] || m.codigos || ''), jue = ambito === 'Mes' ? sumarDias(desde, 14) : sumarDias(desde, 3), dentro = function (w) { return w && jue >= w[0] && jue <= w[1]; };
  if (v.cfg.activo && jue >= v.cfg.inicio && (!v.cfg.d0 || jue < sumarDias(v.cfg.d0, -3)) && DUP_PREVIA_.test(cods)) return { f: 2, por: 'hasta la operación se duplican HSPU y RMU' };
  if (ambito !== 'Mes' && dentro(v.pino) && INT_PINO_.test(cods)) return { f: 2, por: 'intensivo de pino y sandbag (3 semanas desde que vuelve el pino)' };
  if (ambito !== 'Mes' && dentro(v.hspu) && INT_HSPU_.test(cods)) return { f: 2, por: 'intensivo de HSPU y flexiones libres (3 semanas desde que vuelven las HSPU)' };
  return { f: 1 };
}
// ---------- ciclo de extras alineado con Fabrik ----------
/** Semana del ciclo de Fabrik → carácter de los extras. */
function cicloExtras_(lunes) {
  if (cicloExtras_.c && cicloExtras_.c.lunes === lunes) return cicloExtras_.c;
  var sem = 0, nombre = ''; try { var f = faseDe_(sumarDias(lunes, 2), estructura_(fabrik_())); sem = +f.semana || 0; nombre = f.nombre || ''; } catch (e) {}
  if (!sem) sem = (Math.round((Date.parse(lunes) - Date.parse('2026-11-02')) / 6048e5) % 4 + 4) % 4 + 1;   // sin dato de Fabrik: contador propio de 4 semanas
  var k = ((sem - 1) % 4) + 1;
  var o = k <= 2 ? { k: k, modo: 'TÉCNICA', texto: 'CICLO S' + k + '/4 · TÉCNICA CON DÉFICIT: rango completo, tempo controlado y descanso entero. Sin fatiga inducida.' } :
    k === 3 ? { k: 3, modo: 'INTENSIDAD', texto: 'CICLO S3/4 · INTENSIDAD E INTERFERENCIA: misma técnica, más carga o densidad, y metido tras otro trabajo para que haya interferencia real.' } :
    { k: 4, modo: 'CROSSFIT', texto: 'CICLO S4/4 · CROSSFIT PURO: dosis mínima o integrada en el metcon; lo que manda es rendir en lo de Fabrik.' };
  o.lunes = lunes; o.fabrik = nombre; return (cicloExtras_.c = o);
}
/** Empuje de prioridad según el carácter de la semana (se suma a la urgencia). */
function sesgoCiclo_(cods, ciclo) {
  var fam = familiaSin_(cods);
  if (ciclo.modo === 'TÉCNICA') return fam === 'tecnica' ? 0.4 : fam === 'fatiga' ? -0.3 : 0;
  if (ciclo.modo === 'INTENSIDAD') return fam === 'fatiga' || fam === 'potencia' ? 0.4 : 0;
  return fam === 'fatiga' ? 0.2 : fam === 'accesorio' ? -0.3 : 0;
}
/** Al cerrar la lista de bloques nuevos: material, ciclo, tope de minutos y descarga. Carrera, P1–P4 y lo del modo operación no se tocan. */
function ajustarNuevos_(nuevos, lunes, log) {
  var ciclo = cicloExtras_(lunes), carga = { descarga: false }; try { carga = estadoCarga_(lunes); } catch (e) {}
  var op = null; try { op = opSemana_(lunes); } catch (e) {}
  var postVuelta = op && op.enModo && op.post >= 3, lesSem = lesionSemana_(lunes);   // en la vuelta manda la intensidad: no se descarga
  nuevos.forEach(function (o) {
    var cods = codigosDe_(o['CÓDIGOS']), iso = celdaIso_(o.FECHA); if (norm(o.ORIGEN) === 'OPERACION') return;
    materialTexto_(o, iso);
    if (esCarreraFila_(o)) { try { var rt = ritmosTexto_(); if (rt && !/Ritmos vigentes/.test(o.CONTENIDO || '')) o.CONTENIDO = (o.CONTENIDO || '') + '\n\n' + rt; } catch (eRt) {} }   // v0.29 · ritmos confirmados
    if (esIntocable_(cods)) return;
    var pre = [ciclo.texto], min = parseFloat(o.MIN) || 10;
    try { var prg = progresionDe_(cods, ciclo); if (prg) pre.push(prg); } catch (ePr) {}   // v0.29
    if (lesSem && cargasZona_(lesSem.zona).some(function (c) { return cargasFila_(o).indexOf(c) >= 0; })) { min = Math.max(5, Math.round(min / 2)); pre.unshift('LESIÓN ' + lesSem.zona + ' · NIVEL 2 esta semana: la mitad de volumen e intensidad, sin dolor.'); }
    if (ciclo.k === 4 && !/Mínimo|DOSIS MENSUAL/.test(o.CONTENIDO || '')) { min = Math.max(5, Math.round(min * 0.6)); }
    if (carga.descarga && !postVuelta) { min = Math.max(5, Math.round(min * 0.5)); pre.unshift('DESCARGA AUTOMÁTICA (cansancio medio ' + carga.media + '/10 y sin día de descanso): la mitad de series, formato técnico, sin fallo.'); o.INTENSIDAD = '🟢 Técnico'; }
    var fm = factorMeta_({ 'CÓDIGOS': o['CÓDIGOS'] }, lunes, 'Semana'); if (fm.f > 1) { pre.unshift('×2 esta semana: ' + fm.por + '. Microdosis de calidad, no más volumen por sesión.'); min = Math.min(min, 12); }
    o.MIN = min; o.CONTENIDO = pre.join('\n') + '\n\n' + (o.CONTENIDO || '');
  });
  if (carga.descarga && !postVuelta && log) log.push('Descarga automática: cansancio medio ' + carga.media + '/10 y dos semanas sin día de descanso → extras a la mitad y en formato técnico');
  if (log) log.push('Ciclo de extras: ' + ciclo.modo.toLowerCase() + ' (semana ' + ciclo.k + '/4' + (ciclo.fabrik ? ' · Fabrik: ' + ciclo.fabrik : '') + ')');
  return nuevos;
}

// ===================== v0.29 · PROGRESIÓN, FEEDBACK DEL DÍA SIGUIENTE, ACTIVACIÓN, LESIÓN EN 3 NIVELES =====================
CAMPOS_REGISTRO.push('RESULTADO', 'FEEDBACK');
CAMPOS_CARRERA.push('HUMEDAD (%)');
var RESULTADOS_ = ['Completado', 'A medias', 'No salió'];
/** Lo último que hiciste de ese estímulo (registro + plan) y qué toca hoy: una sola variable cada vez. */
function progresionDe_(cods, ciclo) {
  if (!cods.length) return '';
  var plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { if (norm(r.ORIGEN) !== 'FABRIK') plan[r.ID] = r; });
  var reg = listar_(HOJAS.REGISTRO).filter(function (r) { var p = plan[r.ID_PLAN]; return p && r.HECHO && r.HECHO !== 'No' && codigosDe_(p['CÓDIGOS']).some(function (c) { return cods.indexOf(c) >= 0; }); })
    .sort(function (a, b) { return celdaIso_(a.FECHA) < celdaIso_(b.FECHA) ? 1 : -1; });
  var u = reg[0]; if (!u) return 'PROGRESIÓN · primera vez en este ciclo: dosis de referencia y apunta series, reps, kg y RPE para que la próxima suba.';
  var rpe = +u.RPE || 0, res = u.RESULTADO || (u.HECHO === 'Parcial' ? 'A medias' : ''), datos = [u.CARGAS, u['DATOS (parciales/vatios)'], u.MIN_REAL ? u.MIN_REAL + '′' : ''].filter(Boolean).join(' · ');
  var ult = 'Última vez (' + isoAFecha(celdaIso_(u.FECHA)).slice(0, 5) + '): ' + (datos || 'sin datos de carga') + (rpe ? ' · RPE ' + rpe : '') + (res ? ' · ' + res : '') + (u.FEEDBACK ? ' · «' + String(u.FEEDBACK).slice(0, 80) + '»' : '');
  var hoy = res === 'No salió' || rpe >= 9 ? 'repite la dosis anterior al 90 % y cuida la calidad (no salió o fue al límite).' :
    res === 'A medias' || rpe === 8 ? 'repite la misma dosis hasta que salga entera con RPE ≤7.' :
    ciclo && ciclo.modo === 'TÉCNICA' ? 'sube el control, no la carga: +1 rep por serie con tempo o más rango.' :
    ciclo && ciclo.modo === 'INTENSIDAD' ? 'sube la intensidad: +2,5–5 kg o menos descanso, mismas reps.' : 'sube UNA variable: +1 rep por serie, +2,5 kg o +1 serie.';
  return 'PROGRESIÓN · ' + ult + '\nHoy: ' + hoy;
}
/** Extras de ayer sin resultado: se preguntan al día siguiente (sobre todo las carencias). */
function feedbackAyer_(hoy) {
  var ayer = sumarDias(hoy, -1), conRes = {};
  listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN && r.RESULTADO) conRes[r.ID_PLAN] = 1; });
  return listar_(HOJAS.PLAN).filter(function (r) { return celdaIso_(r.FECHA) === ayer && r.ESTADO === 'PROGRAMADO' && norm(r.ORIGEN) !== 'FABRIK' && !esCarreraFila_(r) && !conRes[r.ID] && codigosDe_(r['CÓDIGOS']).length; })
    .slice(0, 5).map(function (r) { return { id: r.ID, fecha: ayer, titulo: r['TÍTULO'] || r.BLOQUE, codigos: r['CÓDIGOS'] || '' }; });
}
function feedbackExtra_(b) {
  var res = RESULTADOS_.indexOf(b.resultado) >= 0 ? b.resultado : ''; if (!res && !b.feedback) throw new Error('faltan_datos');
  var iso = celdaIso_(b.fecha) || sumarDias(hoyIso_(), -1), p = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(b.id || ''); })[0] || {};
  ['RESULTADO', 'FEEDBACK'].forEach(function (h) { asegurarColumna_(HOJAS.REGISTRO, h); });
  var ya = listar_(HOJAS.REGISTRO).filter(function (r) { return r.ID_PLAN === String(b.id) && celdaIso_(r.FECHA) === iso; })[0];
  var o = { FECHA: isoAFecha(iso), ID_PLAN: String(b.id || ''), BLOQUE: p['TÍTULO'] || p.BLOQUE || '', HECHO: res === 'A medias' ? 'Parcial' : 'Sí', RESULTADO: res, FEEDBACK: String(b.feedback || '').slice(0, 600) };
  if (b.rpe) o.RPE = String(b.rpe);
  if (ya) { if (ya.HECHO === 'No') delete o.HECHO; Object.keys(o).forEach(function (k) { if (o[k] === '' && k !== 'RESULTADO') delete o[k]; }); actualizarFila_(HOJAS.REGISTRO, ya._fila, o); MEMO = null; return Object.assign({}, ya, o); }
  return guardarRegistro_(o);
}
/** «Todo hecho como estaba»: todos los bloques del día sin registro pasan a hechos de una vez. */
function registrarDia_(iso) {
  iso = celdaIso_(iso) || hoyIso_(); if (iso > hoyIso_()) throw new Error('fecha_futura');
  var reg = {}; listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN && celdaIso_(r.FECHA) === iso) reg[r.ID_PLAN] = 1; });
  var nuevas = listar_(HOJAS.PLAN).filter(function (r) { return celdaIso_(r.FECHA) === iso && r.ESTADO === 'PROGRAMADO' && !reg[r.ID]; })
    .map(function (r) { return { FECHA: isoAFecha(iso), ID_PLAN: r.ID, BLOQUE: r['TÍTULO'] || r.BLOQUE || '', HECHO: 'Sí', NOTAS: 'Todo hecho (un toque)', REGISTRADO: ahora_() }; });
  if (nuevas.length) { bloqueo_(function () { filasEnHoja_(HOJAS.REGISTRO, nuevas); }); MEMO = null; }
  return nuevas.length;
}
/** Aprender del resultado (no solo de dónde mueves los bloques): lo que sale mal tras cierta carga crea reglas solas. */
function aprenderDeResultados_(lunes) {
  var k = 'apr_res_' + lunes; if (leerConfig_()[k]) return 0;
  var fin = sumarDias(lunes, 6), plan = {}, fotos = {};
  listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
  try { listar_(HOJAS.APR_SEM).forEach(function (r) { if (celdaIso_(r.LUNES) === lunes && r.FOTO === 'FINAL') fotos[r.ID] = r; }); } catch (e) {}
  var d = [];
  listar_(HOJAS.REGISTRO).forEach(function (r) {
    var f = celdaIso_(r.FECHA), p = plan[r.ID_PLAN]; if (!p || f < lunes || f > fin || !r.RESULTADO) return;
    var s = sujetoApr_(p), ft = fotos[r.ID_PLAN] || {}, ant = String(ft['DÍA ANTES'] || '').split(/\s*,\s*/).filter(Boolean), con = String(ft['SESIÓN CON'] || '').split(' | ').filter(Boolean).map(function (x) { return x.split('~')[0]; });
    if (r.RESULTADO === 'Completado' && (+r.RPE || 0) <= 7) { d.push(['TURNO', s, p.TURNO === 'AM' ? 'AM' : 'PM', 0.3]); return; }
    var w = r.RESULTADO === 'No salió' ? 0.8 : 0.5;
    ant.filter(function (c) { return /^(DURA|PIERNA|SNC|HOMBRO|AGARRE|IMPACTO)$/.test(c); }).forEach(function (c) { d.push(['TRAS', s, c, w]); });
    con.slice(0, 2).forEach(function (c) { d.push(['SEPARAR', s, c, w * 0.6]); });
    if (r.FEEDBACK) d.push(['NOTA', s, String(r.FEEDBACK).slice(0, 300), 1.5]);
  });
  sumarReglas_(d, lunes, 'resultado');
  ponerConfig_(k, ahora_() + ' · ' + d.length + ' señales', 'Aprendizaje por resultados (feedback de los extras)');
  return d.length;
}
/** Activación por sesión (6–8′): reconoce lo que trae Fabrik y la orienta a la sesión. */
function activacionSemana_(lunes) {
  var out = {}, fin = sumarDias(lunes, 6), apr = '';
  try { apr = listar_(HOJAS.LESIONES).filter(function (r) { return r.ESTADO === 'APROBADA'; }).map(function (r) { return (String(r['IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO'] || '').match(/CALENTAMIENTO:\s*([^\n]{5,160})/i) || [])[1]; }).filter(Boolean)[0] || ''; } catch (e) {}
  var ses = {};
  listar_(HOJAS.PLAN).forEach(function (r) { var d = celdaIso_(r.FECHA); if (d < lunes || d > fin || !/^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO)) return; var k = d + '|' + (r.TURNO === 'AM' ? 'AM' : 'PM'); (ses[k] = ses[k] || []).push(r); });
  Object.keys(ses).forEach(function (k) {
    var rs = ses[k], cg = [], txt = norm(rs.map(function (r) { return (r['TÍTULO'] || '') + ' ' + (r.CONTENIDO || ''); }).join(' ')), solo = rs.every(function (r) { return esCarreraFila_(r); });
    rs.forEach(function (r) { cargasFila_(r).forEach(function (c) { if (cg.indexOf(c) < 0) cg.push(c); }); });
    var L = [];
    if (solo) { L.push('Tobillo-rodilla-cadera 3′: balanceos de pierna 10/lado, rodilla sobre pie 10/lado, skipping 2 × 15 m'); out[k] = L; return; }
    L.push('Escapular y torácica 2′: band pull-apart 2 × 15 · wall slides 2 × 8 · rotación torácica en cuadrupedia 6/lado');
    if (cg.indexOf('HOMBRO') >= 0 || /SNATCH|JERK|OVERHEAD|OHS|HSPU|HANDSTAND|PINO|PRESS|THRUSTER|WALL BALL/.test(txt)) {
      L.push('Posición OH 2′: sots press 2 × 5 (PVC o barra vacía) · Lu raises 2 × 8 · hold OH con PVC 2 × 20″');
      L.push('Pino 1′: 2 × 20″ hollow contra pared + 10 shoulder taps');
    }
    if (cg.indexOf('PIERNA') >= 0 || cg.indexOf('IMPACTO') >= 0 || /SQUAT|LUNGE|JUMP|RUN|SALTO|ZANCADA/.test(txt)) L.push('Tobillo-rodilla-cadera 2′: rodilla sobre pie 10/lado · 90/90 5/lado · cossack 5/lado');
    if (cg.indexOf('SNC') >= 0 || /DEADLIFT|PESO MUERTO|CLEAN|RDL|SWING/.test(txt)) L.push('Bisagra 1′: good morning con PVC 2 × 8 · puente de glúteo 2 × 10');
    L.push('Prevención 1′: chin tucks 10 · rotación externa con banda (hombro derecho) 12');
    if (apr) L.push('De tu hoja de lesiones: ' + apr);
    if (rs.some(function (r) { return norm(r.ORIGEN) === 'FABRIK' && /WARM|CALENTAMIENTO|ACTIVACION/.test(norm(r['TÍTULO'] || '')); })) L.unshift('Fabrik ya trae calentamiento: haz esto antes, en 6′, y entra a su calentamiento con todo activado.');
    out[k] = L;
  });
  return out;
}
// ---------- lesión en 3 niveles ----------
HOJAS.LES_HIST = 'LESIONES · HISTORIAL';
ESQ_BD_[HOJAS.LES_HIST] = { cab: ['FECHA', 'ZONA', 'CAUSA', 'NIVEL', 'NOTAS', 'REGISTRADO'], anchos: [95, 120, 120, 60, 300, 130], fechas: ['FECHA'], color: '#dc2626', negrita: 'ZONA' };
var NIVELES_LESION_ = { '1': 'Nivel 1 · leve: se entrena con normalidad (queda registrado)', '2': 'Nivel 2 · moderado: extras de la zona al 50 % y lo más tarde posible', '3': 'Nivel 3 · fuerte: esta semana nada de la zona; la siguiente, nivel 2' };
/** Nivel 2 la semana que viene: lo lee el generador. */
function lesionSemana_(lunes) { try { var v = JSON.parse(String(leerConfig_()['lesion_sem_' + lunes] || '')); return v && v.zona ? v : null; } catch (e) { return null; } }
function cargasZona_(zona) { return (ZONAS_LESION_[zona] || {}).cargas || []; }
function proponerLesionNivel_(lunes, p) {
  var nivel = String(p.nivel || '3'), Z = ZONAS_LESION_[p.zona]; if (!Z) throw new Error('zona_no_valida');
  var iso = isoOk_(p.iso) || hoyIso_(), dow = (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
  if (nivel === '1') return { cambios: [], avisos: ['Se entrena con normalidad. Queda en el historial de molestias; si se repite en la misma zona, sube de nivel.'], lesion: { nivel: 1 }, resumen: 'Lesión · ' + p.zona + ' · ' + NIVELES_LESION_['1'] };
  if (nivel === '3') {
    var P3 = proponerLesion_(lunes, p);
    P3.lesion = { nivel: 3, siguiente: sumarDias(lunes, 7) }; P3.resumen = NIVELES_LESION_['3'] + ' · ' + P3.resumen;
    P3.avisos.push('La semana que viene los extras de ' + p.zona.toLowerCase() + ' irán al 50 % y lo más tarde posible.');
    return P3;
  }
  if (dow >= 4) return { cambios: [], avisos: ['Es viernes o más tarde: esta semana no se toca y el nivel 2 se aplica la semana que viene (extras de la zona al 50 % y al final de la semana).'], lesion: { nivel: 2, siguiente: sumarDias(lunes, 7) }, resumen: 'Lesión · ' + p.zona + ' · ' + NIVELES_LESION_['2'] + ' (desde la semana que viene)' };
  var t0 = horaDe_(iso, p.turno === 'PM' ? 'PM' : 'AM'), cambios = [], tocar = function (r) { var cg = cargasFila_(r); return Z.cargas.some(function (c) { return cg.indexOf(c) >= 0; }); };
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && horaDe_(r._iso, r._turno) >= t0; });
  var ext = filas.filter(function (r) { return norm(r.ORIGEN) !== 'FABRIK' && !esIntocable_(codigosDe_(r['CÓDIGOS'])) && tocar(r); });
  var libres = []; for (var k = 6; k >= dow; k--) { var d = sumarDias(lunes, k); ['PM', 'AM'].forEach(function (t) { libres.push({ iso: d, turno: t }); }); }
  var ocup = cargaBase_(filas);
  ext.forEach(function (r) {
    var mi = Math.max(5, Math.round(r._min / 2)), dest = libres.filter(function (s) { return horaDe_(s.iso, s.turno) > horaDe_(r._iso, r._turno) && (ocup[s.iso + s.turno] || 0) + mi <= CAP_TURNO_[s.turno] && !materialVeto_(codigosDe_(r['CÓDIGOS']), s.iso, s.turno); })[0];
    cambios.push({ id: r.ID, accion: 'adaptar', min: mi, iso: r._iso, turno: r._turno, contenido: 'LESIÓN ' + p.zona + ' · NIVEL 2: la mitad de volumen e intensidad, sin dolor.\n\n' + (r.CONTENIDO || ''), motivo: 'Nivel 2: ' + p.zona.toLowerCase() + ' al 50 %' });
    if (dest) { ocup[dest.iso + dest.turno] = (ocup[dest.iso + dest.turno] || 0) + mi; cambios.push({ id: r.ID, accion: 'mover', iso: dest.iso, turno: dest.turno, motivo: 'Nivel 2: lo más tarde posible de la semana → ' + diaDe_(dest.iso).toLowerCase() + ' ' + dest.turno }); }
  });
  return { cambios: cambios, avisos: ext.length ? [] : ['Esta semana no quedan extras que carguen ' + p.zona.toLowerCase() + '. Fabrik no se toca en el nivel 2.'], lesion: { nivel: 2 }, resumen: 'Lesión · ' + p.zona + ' · ' + NIVELES_LESION_['2'] + ' · ' + ext.length + ' extras' };
}
function lesionAplicada_(P, params) {
  var l = P.lesion || {}; params = params || {};
  try { filasEnHoja_(HOJAS.LES_HIST, [{ FECHA: isoAFecha(isoOk_(params.iso) || hoyIso_()), ZONA: params.zona || '', CAUSA: params.causa || '', NIVEL: String(l.nivel || params.nivel || ''), NOTAS: P.resumen || '', REGISTRADO: ahora_() }]); } catch (e) { Logger.log('Historial lesión: ' + e); }
  if (l.siguiente) ponerConfig_('lesion_sem_' + l.siguiente, JSON.stringify({ zona: params.zona, causa: params.causa || '', nivel: 2 }), 'Lesión: nivel 2 en la semana del ' + isoAFecha(l.siguiente));
  MEMO = null;
}
// ---------- reglas: activar / desactivar ----------
function reglaActiva_(clave, activa) {
  var r = listar_(HOJAS.APR_REG).filter(function (x) { return x.CLAVE === String(clave || ''); })[0]; if (!r) throw new Error('no_encontrado');
  actualizarFila_(HOJAS.APR_REG, r._fila, { ACTIVA: activa ? 'Sí' : 'No', ACTUALIZADO: ahora_() }); MEMO = null; reglasAprendidas_.c = null; return true;
}

