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
    if (/EN PAUSA/.test(r.NOTAS || '')) return;   // v0.30 · pausados por ti: esperan a que los reanudes
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
// v0.31 · deathnote B3: el RMU técnico ya no se duplica (cuenta el de Fabrik)
var DUP_PREVIA_ = /\b(W15|W16|W17|W31|M49|W32|W33|M53|M55)\b/, INT_PINO_ = /\b(W32|W33|W25|W26|W27|W28|M56|M57)\b/, INT_HSPU_ = /\b(W15|W16|W17|W31|W32)\b/;
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
  if (v.cfg.activo && jue >= v.cfg.inicio && (!v.cfg.d0 || jue < sumarDias(v.cfg.d0, -3)) && DUP_PREVIA_.test(cods)) return { f: 2, por: 'hasta la operación se duplican HSPU, RMU, pino (HSW y estático) y press OH' };
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
  pausarNuevos_(nuevos, lunes, log);   // v0.30 · estímulos en pausa (quedan en pendientes)
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
    var fm = factorMeta_({ 'CÓDIGOS': o['CÓDIGOS'] }, lunes, 'Semana'); if (fm.f > 1) { pre.unshift('×2 esta semana: ' + fm.por + '. Microdosis de calidad, no más volumen por sesión.'); if (!o._mb) min = Math.min(min, 12); }
    var ab = pinoAB_(lunes, cods, nuevos); if (ab) { pre.unshift(ab.texto); if (!o._mb) { min = ab.min; o['TÍTULO'] = ab.titulo || o['TÍTULO']; } }   // v0.30 · semanas A/B de pino (v0.32: el microbloque conserva su título y sus minutos)
    o.MIN = min; o.CONTENIDO = pre.join('\n') + '\n\n' + (o.CONTENIDO || '');
  });
  if (carga.descarga && !postVuelta && log) log.push('Descarga automática: cansancio medio ' + carga.media + '/10 y dos semanas sin día de descanso → extras a la mitad y en formato técnico');
  try { var tAB = tipoSemanaPino_(lunes); if (tAB && log) log.push('Pino · semana ' + tAB.tipo + ' (' + tAB.metros + ' m de HSW + técnica ' + (tAB.tipo === 'A' ? 'normal' : 'doble') + ')'); } catch (eAB) {}
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


// ===================== v0.30 · SEMANAS A/B DE PINO + ESTÍMULOS EN PAUSA =====================
// A = acumulación 200 m de HSW + técnica (pino estático, free HSPU, pirueta, rampa). B = 100 m y el doble de tiempo de esas skills.
// Se alternan cada semana desde «pino_ab_ancla» (lunes de una semana A). Las metas semanales (W32 HSW, W33 pino estático) garantizan los estímulos;
// esto solo reparte la dosis entre los bloques de la semana. En la operación, el filtro del modo quita las inversiones solo.
function tipoSemanaPino_(lunes) {
  var cfg = leerConfig_(), ancla = celdaIso_(String(cfg.pino_ab_ancla || '').replace(/^'/, '')); if (!ancla) return null;
  var n = Math.round((Date.parse(lunes) - Date.parse(ancla)) / 6048e5); if (n < 0) return null;
  var A = n % 2 === 0;
  return { tipo: A ? 'A' : 'B', metros: A ? (+cfg.pino_metros_A || 200) : (+cfg.pino_metros_B || 100), tecnica: A ? 1 : 2 };
}
function pinoAB_(lunes, cods, nuevos) {
  var t = tipoSemanaPino_(lunes); if (!t) return null;
  var hsw = cods.indexOf('W32') >= 0, est = cods.indexOf('W33') >= 0; if (!hsw && !est) return null;
  if (hsw) {
    var n = nuevos.filter(function (x) { return codigosDe_(x['CÓDIGOS']).indexOf('W32') >= 0; }).length || 1;
    var m = Math.max(10, Math.round(t.metros / n / 5) * 5), tec = 6 * t.tecnica, tramos = Math.ceil(m / 10);
    return { min: Math.round(m / 10 * 1.5 + tec + 3), titulo: 'HSW · semana ' + t.tipo + ' · ' + m + ' m + técnica ' + tec + '′',
      texto: 'PINO · SEMANA ' + t.tipo + ' (' + (t.tipo === 'A' ? 'ACUMULACIÓN ' + t.metros + ' m/semana' : 'TÉCNICA DOBLE · ' + t.metros + ' m/semana') + ')\n' +
        '1) HSW: ' + m + ' m en ' + tramos + ' tramos de 10 m' + (m % 10 ? ' (el último de 5 m)' : '') + '. Objetivo: cada tramo en ≤1′ (cuenta desde que subes). Descanso: el mismo tiempo que tardaste.' +
        (t.tipo === 'A' ? ' Una vez por semana (el bloque más tardío): 40 m seguidos tras 1′ de trabajo de hombro o agarre para meter fatiga real.' : '') + '\n' +
        '2) Técnica ' + tec + '′ (rota cada sesión): pirueta 3+3 · rampa subiendo y bajando · free HSPU negativas o parciales · hold libre. Calidad, sin fallo.\n' +
        'Registra: metros sin caer, tiempo por tramo, caídas y qué skill tocaste. Si Fabrik ya trae HSW esa semana, sus metros cuentan.' };
  }
  var s = 5 * t.tecnica;
  return { min: Math.round(s * 1.2 + 3), titulo: 'Pino estático · semana ' + t.tipo + ' · ' + s + ' × 30″',
    texto: 'PINO ESTÁTICO · SEMANA ' + t.tipo + ': ' + s + ' × 30″ libre (o pecho a pared si cae antes de 15″) / 45″. Línea hueca, empuje activo y correcciones con los dedos.' +
      (t.tipo === 'B' ? ' Semana B: el doble de tiempo de skill; termina con 2 × free HSPU negativa lenta.' : '') };
}
/** Estímulos en pausa (APP · CONFIG › pausa_estimulos = códigos separados por comas). No se programan y sus pendientes no caducan. */
function pausaCodigos_() {
  var v = String(leerConfig_().pausa_estimulos || '').toUpperCase().match(/[A-Z]{1,3}\d{2}/g) || []; return v;
}
function pausarNuevos_(nuevos, lunes, log) {
  var P = pausaCodigos_(); if (!P.length) return;
  var quitados = [];
  for (var i = nuevos.length - 1; i >= 0; i--) {
    var o = nuevos[i], cods = codigosDe_(o['CÓDIGOS']); if (!cods.some(function (c) { return P.indexOf(c) >= 0; })) continue;
    var resto = cods.filter(function (c) { return P.indexOf(c) < 0; });
    if ((P.indexOf(cods[0]) >= 0 && !o._mb) || !resto.length) { quitados.push(o['TÍTULO'] || cods[0]); nuevos.splice(i, 1); continue; }
    o['CÓDIGOS'] = resto.join('|');
    o.CONTENIDO = 'EN PAUSA (' + cods.filter(function (c) { return P.indexOf(c) >= 0; }).join(', ') + '): sáltate esa parte del bloque.\n\n' + (o.CONTENIDO || '');
  }
  if (quitados.length && log) log.push('En pausa (quedan en pendientes): ' + quitados.join(', '));
}
function pausaInfo_() {
  var P = pausaCodigos_(); if (!P.length) return [];
  var cat = {}; try { listar_(HOJAS.ESTIMULOS).forEach(function (e) { cat[e['CÓDIGO']] = e.NOMBRE; }); } catch (e) {}
  return P.map(function (c) { return { codigo: c, nombre: cat[c] || c }; });
}
/** Reanudar: sale de la pausa y sus pendientes vuelven a la cola normal (se proponen la semana siguiente). */
function reanudarEstimulo_(codigo) {
  codigo = String(codigo || '').toUpperCase(); var P = pausaCodigos_().filter(function (c) { return c !== codigo; });
  ponerConfig_('pausa_estimulos', P.join(', '), 'Estímulos en pausa: no se programan y sus pendientes esperan (reanúdalos desde la app)');
  var plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
  listar_(HOJAS.PENDIENTES).forEach(function (p) {
    if (p.ESTADO !== 'Pendiente' || !/EN PAUSA/.test(p.NOTAS || '')) return;
    var cs = codigosDe_((plan[p.ID_PLAN] || {})['CÓDIGOS']); if (cs.indexOf(codigo) < 0 || cs.some(function (c) { return P.indexOf(c) >= 0; })) return;
    actualizarFila_(HOJAS.PENDIENTES, p._fila, { NOTAS: String(p.NOTAS).replace(/\s*·?\s*EN PAUSA[^·]*/, '').trim() + ' · Reanudado ' + isoAFecha(hoyIso_()), 'FECHA ORIGINAL': isoAFecha(hoyIso_()) });
  });
  MEMO = null;
}

// ===================== v0.30 · MOLESTIA AL PROGRAMAR LA SEMANA =====================
// Se pregunta en la app al «Programar extras» (o se marca en APP · SEMANAS › MOLESTIA (zona) / MOLESTIA (día)).
// Efecto: ese día y las 24 h siguientes no entra ningún extra que cargue la zona. Fabrik no se toca.
function guardarMolestia_(lunes, m) {
  lunes = lunesDe_(lunes); m = m || {};
  var zona = ZONAS_LESION_[m.zona] ? m.zona : '', iso = celdaIso_(m.iso) || '';
  ['MOLESTIA (zona)', 'MOLESTIA (día)'].forEach(function (h) { asegurarColumna_(HOJAS.SEMANAS, h); });
  var x = filaSemana_(lunes), o = { 'MOLESTIA (zona)': zona, 'MOLESTIA (día)': zona && iso ? isoAFecha(iso) : '' };
  if (x) actualizarFila_(HOJAS.SEMANAS, x._fila, o);
  else filasEnHoja_(HOJAS.SEMANAS, [Object.assign({ LUNES: isoAFecha(lunes), ESTADO: 'Pendiente de confirmar' }, o)]);
  MEMO = null;
}
function molestiaSemana_(lunes, desdeApp) {
  var m = desdeApp && desdeApp.zona ? desdeApp : null;
  if (!m) { var x = filaSemana_(lunes) || {}; if (x['MOLESTIA (zona)']) m = { zona: x['MOLESTIA (zona)'], iso: celdaIso_(x['MOLESTIA (día)']) || lunes }; }
  if (!m || !ZONAS_LESION_[m.zona]) return null;
  var iso = celdaIso_(m.iso) || lunes;
  return { zona: m.zona, cargas: ZONAS_LESION_[m.zona].cargas, dias: [iso, sumarDias(iso, 1)] };
}
function molestiaVeta_(mo, cand, iso) {
  if (!mo || mo.dias.indexOf(iso) < 0) return false;
  return (cand.carga || []).some(function (c) { return mo.cargas.indexOf(c) >= 0; });
}

// ===================== v0.30 · BLOQUES COMBINADOS (regla de Pablo 16/11) =====================
// Los estímulos cortos o técnicos de una misma familia se juntan en un bloque dedicado de 2 a 4 estímulos,
// con menos volumen de cada uno, para que el mes se complete al 100 % sin llenar cada sesión de extras sueltos.
var FAMILIAS_ = {
  'Estabilidad OH': ['M44', 'M58', 'M13', 'M14', 'M50', 'M51', 'M56', 'M67'],   // v0.31.2 · + FS y OH con gomas (carga inestable)
  'Core': ['M08', 'M60', 'M62', 'M46'],
  'Empuje vertical': ['W17', 'W15', 'W16', 'W32', 'W33', 'OP1', 'M53', 'M56'],   // v0.31 · deathnote A1
  'Unilateral': ['M45', 'M61', 'M19', 'M20', 'M28', 'M65'],   // v0.31 · A5 pierna accesoria (+ hip thrust y Nordic)
  'Cadena posterior': ['M47', 'M28'],
  'Comba': ['M33', 'M35', 'M32'],
  'Haltero técnico': ['M10', 'M11']
};
function familiaDe_(o) {
  var cs = codigosDe_(o['CÓDIGOS']);
  for (var k in FAMILIAS_) if (cs.some(function (c) { return FAMILIAS_[k].indexOf(c) >= 0; })) return k;
  return null;
}
function agruparCola_(cola, log, ultima) {
  var grupos = {};
  cola.forEach(function (x) {
    var o = x.o; if (!o || norm(o.ORIGEN) === 'CARRERA' || o._prio === 'pendiente' || esIntocable_(codigosDe_(o['CÓDIGOS']))) return;
    if ((parseFloat(o.MIN) || 10) > 15) return;
    var f = familiaDe_(o); if (f) (grupos[f] = grupos[f] || []).push(x);
  });
  var quitar = [];
  Object.keys(grupos).forEach(function (f) {
    var L = grupos[f];
    while (L.length >= 2) {
      var base = L.shift(), g = [base], cods = codigosDe_(base.o['CÓDIGOS']);
      for (var i = 0; i < L.length && g.length < 4; i++) {
        var cs = codigosDe_(L[i].o['CÓDIGOS']); if (cs.some(function (c) { return cods.indexOf(c) >= 0; })) continue;   // nunca dos veces el mismo estímulo: cada uno cuenta una vez
        g.push(L[i]); cods = cods.concat(cs); L.splice(i, 1); i--;
      }
      if (g.length < 2) continue;
      var letras = 'ABCD', mins = g.reduce(function (a, x) { return a + (parseFloat(x.o.MIN) || 10); }, 0);
      base.o.CONTENIDO = 'BLOQUE COMBINADO · ' + f.toUpperCase() + ' · ' + g.length + ' estímulos, menos volumen de cada uno (sin fallo).\n\n' +
        g.map(function (x, k) { return letras[k] + ') ' + (x.o['TÍTULO'] || '') + '\n' + String(x.o.CONTENIDO || '').replace(/\n\nRegistra:[\s\S]*$/, ''); }).join('\n\n') + '\n\nRegistra: kg, reps y qué parte costó más';
      base.o['TÍTULO'] = 'Bloque ' + f.toLowerCase() + ' · ' + g.map(function (x) { return x.o['TÍTULO']; }).join(' + ');
      base.o['CÓDIGOS'] = cods.join('|');
      base.o.MIN = Math.min(25, Math.round(mins * 0.75));
      base.o['POR QUÉ (cursiva)'] = [base.o['POR QUÉ (cursiva)'], 'Bloque combinado (regla 16/11): ' + g.length + ' estímulos cortos de ' + f.toLowerCase() + ' en una sola sesión dedicada.'].filter(Boolean).join(' ');
      g.slice(1).forEach(function (x) { quitar.push(x); });
      if (log) log.push('Bloque combinado · ' + f + ': ' + g.length + ' estímulos');
    }
  });
  for (var j = cola.length - 1; j >= 0; j--) if (quitar.indexOf(cola[j]) >= 0) cola.splice(j, 1);
  if (ultima) microbloquesMes_(cola, log);
}
// v0.30.4 · regla de Pablo (16/11): en la última semana del mes, lo que falte del mes va en microbloques de 2 a 5 estímulos:
// volumen bajo e intensidad media-alta; los técnicos van juntos y a calidad (sin fatiga).
function microbloquesMes_(cola, log) {
  var tec = [], fue = [];
  cola.forEach(function (x) {
    var o = x.o; if (!o || o._prio !== 'mes' || norm(o.ORIGEN) === 'CARRERA' || /^BLOQUE COMBINADO/.test(o.CONTENIDO || '')) return;
    var cs = codigosDe_(o['CÓDIGOS']); if (esIntocable_(cs) || cs.some(function (c) { return /^(R0|W0|V01|RC1|RF1)/.test(c); }) || (parseFloat(o.MIN) || 10) > 20) return;
    (norm(o.ORIGEN) === 'TÉCNICA' ? tec : fue).push(x);
  });
  var quitar = [], letras = 'ABCDE';
  [[tec, true], [fue, false]].forEach(function (par) {
    var L = par[0];
    while (L.length >= 2) {
      var n = L.length <= 5 ? L.length : (L.length % 5 === 1 ? 4 : 5), g = L.splice(0, n), base = g[0], cods = [];
      g.forEach(function (x) { codigosDe_(x.o['CÓDIGOS']).forEach(function (c) { if (cods.indexOf(c) < 0) cods.push(c); }); });
      var mins = g.reduce(function (a, x) { return a + (parseFloat(x.o.MIN) || 10); }, 0);
      base.o.CONTENIDO = (par[1] ? 'MICROBLOQUE TÉCNICO · ' + g.length + ' estímulos del mes, calidad y descansos completos (sin fatiga).' : 'MICROBLOQUE DEL MES · ' + g.length + ' estímulos, volumen bajo e intensidad media-alta (RPE 7–8, sin fallo).') + '\n\n' +
        g.map(function (x, k) { return letras[k] + ') ' + (x.o['TÍTULO'] || '') + '\n' + String(x.o.CONTENIDO || '').replace(/\n\nRegistra:[\s\S]*$/, '') + (par[1] ? '' : '\n→ 2 series en vez de las de la ficha, carga alta.'); }).join('\n\n') + '\n\nRegistra: kg, reps y qué parte costó más';
      base.o['TÍTULO'] = 'Microbloque ' + (par[1] ? 'técnico' : 'del mes') + ' · ' + g.map(function (x) { return x.o['TÍTULO']; }).join(' + ');
      base.o['CÓDIGOS'] = cods.join('|'); base.o.MIN = Math.min(30, Math.max(12, Math.round(mins * 0.6)));
      base.o['POR QUÉ (cursiva)'] = 'Última semana del mes (regla 16/11): lo que falta del mes en un solo microbloque para tocarlo todo sin llenar la semana de extras sueltos.';
      g.slice(1).forEach(function (x) { quitar.push(x); });
      if (log) log.push('Microbloque del mes: ' + g.length + ' estímulos');
    }
  });
  for (var j = cola.length - 1; j >= 0; j--) if (quitar.indexOf(cola[j]) >= 0) cola.splice(j, 1);
}

// ===================== v0.31 · DEATHNOTE 3 (decisiones de Pablo 17/11) =====================
var COMBA_P_ = ['M33', 'C01', 'M32', 'M35'], INTERF_P_ = ['T01', 'T02', 'T03', 'C02', 'C03', 'C04', 'M57', 'M05', 'M07', 'M64'];
/** A6 · la comba entra dentro de los P (heavy rope, DU en fatiga, crossovers, triples). A7 · hasta 3 movimientos de interferencia dentro de un P (metcon por ventanas = P4). */
function absorberEnP_(cola, log) {
  var esP = function (x) { return codigosDe_(x.o['CÓDIGOS']).some(function (c) { return /^R0[14]$/.test(c); }); };
  var Ps = cola.filter(esP); if (!Ps.length) return;
  var quitar = [], usa = function (lista) { return function (x) { return !esP(x) && quitar.indexOf(x) < 0 && x.o._prio !== 'pendiente' && codigosDe_(x.o['CÓDIGOS']).every(function (c) { return lista.indexOf(c) >= 0; }); }; };
  var meter = function (p, x, que) {
    p.o['CÓDIGOS'] = codigosDe_(p.o['CÓDIGOS']).concat(codigosDe_(x.o['CÓDIGOS']).filter(function (c) { return codigosDe_(p.o['CÓDIGOS']).indexOf(c) < 0; })).join('|');
    p.o.CONTENIDO = String(p.o.CONTENIDO || '') + '\n\n+ ' + que + ' dentro del P: ' + (x.o['TÍTULO'] || '') + ' (dosis corta en cada ronda o ventana, sin romper el ritmo).';
    quitar.push(x);
  };
  Ps.forEach(function (p, k) {
    var c = cola.filter(usa(COMBA_P_))[0]; if (c) { meter(p, c, 'Comba'); if (log) log.push('Comba dentro del P'); }
  });
  var p4 = Ps.filter(function (p) { return /P4|INTEGRADO|R04/.test(norm((p.o['TÍTULO'] || '') + ' ' + p.o['CÓDIGOS'])); })[0] || Ps[Ps.length - 1];
  cola.filter(usa(INTERF_P_)).slice(0, 3).forEach(function (x) { meter(p4, x, 'Interferencia'); });
  if (quitar.length && log) log.push('Metcon de interferencia en el P: ' + quitar.length + ' estímulos');
  for (var j = cola.length - 1; j >= 0; j--) if (quitar.indexOf(cola[j]) >= 0) cola.splice(j, 1);
}
/** A2 · el haltero extra del jueves en orden fijo: técnica → split → sobrecarga → tirón. */
var ORDEN_HALTERO_ = ['W20', 'M10', 'M11', 'W23', 'W24', 'W34', 'M17', 'M51', 'M50', 'M63', 'M47'];
function ordenarHalteroJueves_(lunes, nuevos) {
  var jue = sumarDias(lunes, 3), pos = function (r) { var cs = codigosDe_(r['CÓDIGOS']), m = 99; cs.forEach(function (c) { var i = ORDEN_HALTERO_.indexOf(c); if (i >= 0 && i < m) m = i; }); return m; };
  var L = nuevos.filter(function (r) { return celdaIso_(r.FECHA) === jue && r.TURNO !== 'AM' && pos(r) < 99; }); if (L.length < 2) return;
  // v0.31.2 · ordenNum_: ORDEN con coma decimal (es_ES)
  var ords = L.map(function (r) { return ordenNum_(r.ORDEN) || 0; }).sort(function (a, b) { return a - b; });
  L.sort(function (a, b) { return pos(a) - pos(b); }).forEach(function (r, i) { r.ORDEN = ords[i]; });
}
// ===================== v0.31.5 · WARM-UP DIARIO (regla de Pablo 19/11/2026) =====================
// REGLA (para cualquier IA): Pablo hace él su calentamiento general. Lo de Gabi (movilidad/activación) va plegado como información,
// nunca como bloque principal. El ÚNICO bloque de warm-up del día es este, extra a Fabrik, antes de la primera sesión del día:
//   · TODOS los días 3 ejercicios: 1 cintilla + movilidad cadera-tobillo · 1 cuello-trapecio · 1 manguito rotador.
//   · LUNES y MIÉRCOLES además 3 de fortalecimiento (isométricos, peso o gomas): 1 cadera-tobillo-cintilla · 1 cuello-trapecio · 1 manguito.
//   · Los ejercicios rotan dentro de los pools de abajo (por día para la movilidad, por semana para el fortalecimiento).
//   · Código W41 (warm-up diario, meta 7/sem) y W42 (fortalecimiento preventivo, meta 2/sem). No cuenta como extra (máx. 2–3 bloques por sesión).
var WU_CADERA_ = [
  '90/90 de cadera con transiciones · 6+6 lentas', 'World\'s greatest stretch (zancada + rotación torácica) · 5+5', 'Couch stretch (flexor de cadera y recto femoral) · 45″ por lado',
  'Cossack squat lento · 5+5', 'Rodilla a la pared (dorsiflexión de tobillo) · 10+10', 'Sentadilla profunda con balanceo de tobillos · 60″',
  'Rodillo en TFL y glúteo medio (no directamente sobre la cintilla) · 45″ por lado', 'Zancada lateral con balanceo de aductor · 6+6'];
var WU_CUELLO_ = [
  'Chin tucks (retracción cervical) tumbado · 10 × 3″', 'CARs cervicales muy lentos, solo en rango cómodo · 3 por sentido', 'Open book tumbado de lado (cabeza apoyada) · 6+6',
  'Wall slides de serrato (antebrazos en la pared) · 8', 'Retracción + depresión escapular («shrug inverso») · 10 × 3″',
  'Estiramiento suave de trapecio superior y elevador de la escápula · 30″ por lado (solo sin dolor)', 'Extensión torácica sobre rodillo · 8 respiraciones'];
var WU_MANGUITO_ = [
  'Rotación externa con banda, codo pegado al cuerpo · 15+15', 'Rotación interna con banda, codo pegado al cuerpo · 15+15', 'CARs de hombro lentos · 3+3',
  'Band pull-apart · 15', 'Face pull con banda ligera · 12', 'Sleeper stretch suave · 30″ por lado', 'Pass-through con banda · 10'];
var WU_F_CADERA_ = [
  'Abducción de cadera tumbado de lado, pausa 2″ arriba · 2 × 12+12', 'Monster walks con banda en los tobillos · 2 × 10 m + 10 m', 'Puente de glúteo a una pierna isométrico · 2 × 30″+30″',
  'Tibialis raise contra la pared · 2 × 15', 'Isometría de sóleo en la pared (rodilla flexionada) · 2 × 30″+30″', 'Spanish squat isométrico con banda · 3 × 30″',
  'Plancha lateral con abducción de pierna · 2 × 8+8'];
var WU_F_CUELLO_ = [
  'Isometría de flexores profundos (chin tuck tumbado, cabeza a 2 cm del suelo) · 5 × 10″', 'Isometrías de cuello en 4 direcciones contra la mano · 4 × 5″ por dirección, 30–50 % del esfuerzo',
  'Y-raise boca abajo con discos ligeros (trapecio inferior) · 2 × 10', 'T-raise boca abajo (trapecio medio) · 2 × 10', 'Encogimiento con pausa 2″ arriba, mancuernas ligeras · 2 × 12 (solo sin dolor)'];
var WU_F_MANGUITO_ = [
  'Rotación externa tumbado de lado con mancuerna de 2–4 kg · 2 × 12+12', 'Isometría de rotación externa a 90° con banda · 3 × 20″+20″', 'Cuban press ligero · 2 × 10',
  'Y-T-W boca abajo con discos de 1–2 kg · 2 × 6 de cada', 'Rotación externa a 90° con banda, excéntrica de 3″ · 2 × 10+10'];
function contenidoWarmup_(iso) {
  var d = Math.round(new Date(iso + 'T12:00:00Z').getTime() / 864e5), dow = (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7, sem = Math.floor((d - 4) / 7);   // dow 0 = lunes
  var pick = function (L, n) { return L[((n % L.length) + L.length) % L.length]; };
  // v0.32 · 3–4′ y 3 ejercicios cada día (distintos cada día); lunes y miércoles, los 3 en versión isométrica / fortalecimiento (W41|W42)
  var fuerte = dow === 0 || dow === 2, k = sem * 2 + (dow === 2 ? 1 : 0);
  var t = 'Antes de la primera sesión del día, 3–4′ (tu calentamiento general lo haces tú):\n' + (fuerte
    ? 'ISOMÉTRICO (lunes y miércoles):\n1) Cadera-tobillo-cintilla · ' + pick(WU_F_CADERA_, k) + '\n2) Cuello y trapecio · ' + pick(WU_F_CUELLO_, k) + '\n3) Manguito rotador · ' + pick(WU_F_MANGUITO_, k) +
      '\n\nSi el cuello está irritado: en el 2) solo isometría suave o se quita.'
    : '1) Cintilla y cadera-tobillo · ' + pick(WU_CADERA_, d + 3 * sem) + '\n2) Cuello y trapecio · ' + pick(WU_CUELLO_, d + 3 * sem) + '\n3) Manguito rotador · ' + pick(WU_MANGUITO_, d + 3 * sem));
  return { texto: t + '\n\nRegistra: qué zona notaste más cargada (0–10)', fuerte: fuerte, dow: dow };
}
/** Un warm-up diario (W41, + W42 lunes y miércoles) por cada día de la semana que tenga sesión. No duplica si ya existe. */
function warmupLunes_(lunes, nuevos, sello, permitidos, log) {   // el nombre se mantiene por compatibilidad: ahora cubre los 7 días
  if (permitidos && !permitidos[lunes]) return;
  var act = function (r) { return !/NO HACER|CANCELADO|SUSTITUIDO|SIN HUECO/.test(norm(r.ESTADO)); };
  var todo = listar_(HOJAS.PLAN).concat(nuevos), DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  for (var i = 0; i < 7; i++) {
    var iso = sumarDias(lunes, i), ses = todo.filter(function (r) { return celdaIso_(r.FECHA) === iso && act(r); });
    if (!ses.length || ses.some(function (r) { return codigosDe_(r['CÓDIGOS']).indexOf('W41') >= 0; })) continue;
    var am = ses.filter(function (r) { return r.TURNO === 'AM'; }), tu = am.length ? 'AM' : 'PM', del = ses.filter(function (r) { return (r.TURNO === 'AM' ? 'AM' : 'PM') === tu; });
    var orden = Math.min.apply(null, del.map(function (r) { return ordenNum_(r.ORDEN) || 50; })) - 1;
    var c = contenidoWarmup_(iso);
    nuevos.push({ ID: nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': DIAS[i], TURNO: tu, ORDEN: orden, ORIGEN: 'MOVILIDAD',
      BLOQUE: 'Warm-up diario · cintilla, cuello y manguito' + (c.fuerte ? ' · isométrico' : ''), 'TÍTULO': 'Warm-up diario · cintilla, cuello y manguito' + (c.fuerte ? ' · isométrico' : ''),
      CONTENIDO: c.texto, INTENSIDAD: '🟢 Movilidad', MIN: 4, 'CÓDIGOS': c.fuerte ? 'W41|W42' : 'W41',
      'POR QUÉ (cursiva)': 'Regla de Pablo (19/11, ajustada 23/11): cintilla, cuello-trapecio y manguito le han molestado más de una vez. Cada día 3 ejercicios (uno de cada zona) en 3–4′, distintos cada día; lunes y miércoles, en versión isométrica de fortalecimiento.',
      ESTADO: 'BORRADOR', GENERADO: sello, ACTUALIZADO: ahora_() });
    if (log) log.push('Warm-up diario ' + iso);
  }
}
/** v0.31.2 · todas las semanas: el domingo por la noche deja escrito el warm-up del lunes siguiente (PROGRAMADO) si no está. */
function asegurarWarmupLunes_(lunes) {
  var n = []; warmupLunes_(lunes, n, 'Warm-up automático ' + ahora_(), null, null);
  n.forEach(function (o) { o.ESTADO = 'PROGRAMADO'; anadirFila_(HOJAS.PLAN, o); });
  if (n.length) { MEMO = null; try { invalidarSemana_(); } catch (e) {} }
  return n.length;
}

// ===================== v0.32 · GENERADOR POR MICROBLOQUES (decisión de Pablo 20–23/11/2026) =====================
/*
 * «Cargar extras» programa la semana con 8 MICROBLOQUES fijos + rotación de 4 semanas (S1–S4). La tabla está en MICROBLOQUES_ (datos, no lógica).
 *  · S = semana del mes por su jueves (una semana que cruza meses cuenta para el mes con ≥4 días). Mes de 5 semanas: bloques un 20 % más cortos;
 *    la S5 recoge lo que falte del mes y, si no falta nada, repite la S4 en versión técnica corta.
 *  · Fabrik cuenta primero: si un bloque de Fabrik (o un extra tuyo) del mismo día ya trae un código, ese componente se quita (el bloque encoge, nunca se apila).
 *    Un microbloque sin componentes no se crea.
 *  · Carrera y ergo solo de mañana y solo los días con mañana (hasta APP · CONFIG › regla_am_hasta_…: mar, mié y vie; sáb solo Z2 ≤35′).
 *  · Jueves: sesión propia, técnica sin fatiga; el metcon de Fabrik del jueves queda OCULTO y va P1–P4 + un metcon corto de poca fatiga.
 *  · Cuerda y RMU justo antes de la clase. Días sin mañana: nada antes de la clase (solo el warm-up diario).
 *  · Una grabación de WOD de competición (APP · EVENTOS) sustituye al P1–P4 del jueves (la 2.ª, al integrado R04 del sábado).
 *  · Estímulos IA (IA1/IA2): solo se colocan si hay fila vigente en «MOTOR · ESTÍMULOS IA» (libro Motor). Si no, nada.
 *  · Al final se comprueban las metas con avanceMetas_ (lo mismo que ve la app): lo que falte de la semana (y del mes, repartido) se añade al microbloque afín.
 */
ESQUEMA['APP · PLAN'].listas.ESTADO.push('OCULTO');
// rot: una entrada por S1–S4 (lista de códigos u objeto { p: variante del P, c: códigos, pos }). 'A|B' = uno u otro (alterna por semana).
// 'RF1*' = RF1 en las 2 primeras semanas de la fase de volumen de Fabrik; si no, M05 + C02.
// pos: AM · antes (antes de la clase) · justoAntes (lo último antes de la clase) · metcon (hueco del metcon de la clase) · inicio / propia / cierre (sesión propia, tras la clase si la hay)
var MICROBLOQUES_ = [
  { mb: 'MB1', nombre: 'Motor', origen: 'CARRERA', partes: [
    { dia: 1, turno: 'AM', pos: 'AM', etiqueta: 'calidad', fijo: ['W04'], rot: [['R02'], ['R02'], ['R02'], ['R03']], min: 45 },
    { dia: 2, turno: 'AM', pos: 'AM', etiqueta: 'larga Z2 60–75′ + gemelo', fijo: ['W01', 'W02', 'M66'], min: 75, desde21: { dia: 6 } },
    { dia: 4, turno: 'AM', pos: 'AM', etiqueta: 'Z2 corta + ergo 20′', fijo: ['W02', 'W03'], rot: [['W40'], ['V01'], ['W40'], []], min: 55 },
    { dia: 5, turno: 'AM', pos: 'AM', etiqueta: 'Z2 ≤35′', fijo: ['W02'], min: 35, maxMin: 35 },
    { dia: 0, turno: 'AM', pos: 'AM', etiqueta: 'ergo Z2', fijo: ['W03'], min: 25, soloDesde21: true }] },
  { mb: 'MB2', nombre: 'Empuje vertical y pino', origen: 'TÉCNICA', partes: [
    { dia: 1, turno: 'PM', pos: 'antes', etiqueta: 'estricto', fijo: ['W10', 'W33', 'W32', 'W17', 'W15', 'OP1'], rot: [['M53'], ['M55'], ['M53'], ['M55']], max: 20 },
    { dia: 6, turno: 'PM', pos: 'propia', etiqueta: 'dinámico + estabilidad OH', fijo: ['W10', 'W33', 'W32', 'W17', 'W15'], rot: [['M56', 'M44', 'M67'], ['M58', 'M44'], ['M56', 'M67', 'M58'], []], max: 25, notaS4: 'S4: solo técnica.' }] },
  { mb: 'MB3', nombre: 'Anillas y cuerda', origen: 'TÉCNICA', partes: [
    { dia: 1, turno: 'PM', pos: 'justoAntes', fijo: ['W13'], rot: [['M36'], ['M31', 'M59'], ['M36', 'M62'], ['M31', 'M59']], max: 15 },
    { dia: 2, turno: 'PM', pos: 'justoAntes', fijo: ['W13', 'M49'], max: 15 }] },
  { mb: 'MB4', nombre: 'EMOM fatiga + core', origen: 'EXTRA', intensidad: '🟠 Fatiga', partes: [
    { dia: 2, turno: 'PM', pos: 'antes', fijo: ['W31'], rot: [['T03', 'C01', 'M08'], ['C02', 'C03', 'M60'], ['M48', 'C04', 'M08'], ['M54', 'M60']], max: 18 }] },
  { mb: 'MB5', nombre: 'Haltero y potencia', origen: 'TÉCNICA', intensidad: '🟢 Técnico', partes: [
    { dia: 3, turno: 'PM', pos: 'propia', fijo: ['W07', 'W20', 'M63', 'W23', 'M17', 'W34'], rot: [['M52', 'M10', 'M47', 'M11'], ['M35', 'M32', 'M50', 'M07'], ['M52', 'M47', 'M51'], ['M35', 'M05']], max: 40,
      extra: 'Junto al split: sots press 2×5 (PVC o barra vacía) + estabilidad escapular (wall slides 2×8, Y-raise 2×10).' }] },
  { mb: 'MB6', nombre: 'P1–P4', origen: 'Z6–Z8', intensidad: '🔴 Z6–Z8', partes: [
    { dia: 3, turno: 'PM', pos: 'cierre', fijo: ['R01'], rot: [{ p: 'P2 · RSA en bici', c: [] }, { p: 'P1 · bici', c: ['T02', 'C01'] }, { p: 'P4', c: ['C03|C04'] }, { p: 'P3 · power clean + sprint', c: ['V01'], pos: 'inicio' }], max: 25 }] },
  { mb: 'MB7', nombre: 'Pierna accesoria', origen: 'EXTRA', intensidad: '🟢 Calidad', partes: [
    { dia: 4, turno: 'PM', pos: 'antes', fijo: ['M65', 'M19'], rot: [['M61', 'M68', 'M46'], ['M45', 'M13', 'M28'], ['M61', 'M68', 'M46'], ['M45', 'M13', 'M28']], max: 20 }] },
  { mb: 'MB8', nombre: 'Competición e interferencia', origen: 'EXTRA', intensidad: '🟠 Interferencia RPE 7', partes: [
    { dia: 5, turno: 'PM', pos: 'metcon', etiqueta: 'integrado', fijo: ['R04', 'R01', 'W31'], rot: [['M48', 'T01'], ['RF1*'], ['M49', 'C02', 'M54'], []], max: 25, notaS4: 'S4: integrado libre (elige 2 movimientos de competición).' },
    { dia: 6, turno: 'PM', pos: 'propia', etiqueta: 'interferencia RPE 7', fijo: [], rot: [['M38', 'M33', 'M64', 'M57'], ['M05', 'M01', 'M32'], ['M38', 'M33', 'M64', 'M57'], ['M57', 'M07', 'M01']], max: 25 }] }
];
var MB_CARRERA_ = /^(W0[1-4]|R0[23]|V01|W40)$/, MB_FATIGA_ALTA_ = /^(W31|M49|M48|M01|M02|M37|M54|M55)$/, MB_NO_RELLENO_ = /^(IA\d|RF1|RC1|MU1|CT1|OP\d|R04|W41|W42)$/;
var MB_AFIN_ = { 'Estabilidad OH': 'MB2', 'Empuje vertical': 'MB2', Core: 'MB4', Unilateral: 'MB7', 'Cadena posterior': 'MB7', Comba: 'MB8', 'Haltero técnico': 'MB5' };
var MB_POOL_JUEVES_ = ['M31', 'M62', 'M08', 'M46', 'M44', 'M58', 'M13', 'M56', 'M35', 'M32', 'M19', 'M28', 'M45', 'M33', 'W10'];
// Dosis tipo para los códigos que no traen CONTENIDO en el catálogo sembrado: [nombre, min, contenido, intensidad, origen, registra]
var MB_FALLBACK_ = {
  W04: ['Calidad de carrera', 45, '15′ suaves + 3×15″ progresivos · bloque de calidad del plan de carrera (tempo umbral VT2 o Z5 en fartlek/series) · 10′ suaves.', '🟠 Calidad', 'CARRERA', 'Parciales, RPE, FC media'],
  R02: ['Z4 · tempo umbral (VT2)', 0, 'Z4: 3×8′ a ritmo T (umbral, frases cortas) / 2′ trote. Progresión 3×8′ → 2×12′ → 20′ continuos.', '🟠 Calidad', 'CARRERA', 'Ritmo de cada bloque, FC y RPE'],
  R03: ['Z5 · VO₂max', 0, 'Z5: 5×3′ fuerte / 2′ trote (o 30/30 × 12 en grupo). Mantén el ritmo en la última repetición.', '🟠 Calidad', 'CARRERA', 'Ritmo de cada serie, FC máx y RPE'],
  W40: ['Carrera comprometida', 0, '3 rondas: 800 m a ritmo de HYROX + 20 wall balls + 15 burpee broad jumps (transiciones rápidas, sin pararte a mirar el reloj).', '🟠 Calidad', 'CARRERA', 'Tiempo de cada tramo y de cada transición; FEEDBACK: qué ejercicios y qué transiciones hay que trabajar'],
  R01: ['Potencia Z6–Z8 (P1–P4)', 20, 'Protocolo P de la semana (ver variante arriba): esfuerzos máximos cortos con recuperación completa entre repeticiones. Si la potencia cae >15 %, se corta.', '🔴 Z6–Z8', 'Z6–Z8', 'W pico y media por esfuerzo, caída 1.º→último'],
  W31: ['HSPU en fatiga', 8, 'EMOM 8′: impar 12/10 cal bike · par 5 kipping HSPU (tandas pequeñas desde la 1.ª ronda).', '🟠 Fatiga', 'EXTRA', 'Reps por ronda y fallos'],
  M01: ['C2B en fatiga', 8, '3 rondas: 10 cal row + 8 C2B (tandas fijas) · 1′ entre rondas.', '🟠 Fatiga', 'EXTRA', 'Reps por ronda'],
  M59: ['Agarre · dead hang y farmer', 8, '3×(30″ dead hang + 30 m farmer carry pesado) / 60″.', '🟢 Calidad', 'EXTRA', 'Segundos, kg y metros'],
  M60: ['Core en fatiga · GHD / hollow rock', 8, '3×(12 GHD sit-ups controlados + 20 hollow rocks) dentro del EMOM.', '🟠 Fatiga', 'EXTRA', 'Reps y variante'],
  M63: ['Tirón pesado · clean/snatch pull', 10, '4×3 clean pull o snatch pull al 95–100 % del levantamiento · 2′ · barra cerca y extensión completa.', '🟠 Fuerza', 'TÉCNICA', 'Kg y reps'],
  M64: ['Wall balls en interferencia', 8, '3×(20 wall balls 9/6 kg + 10 cal bike) / 1′ · RPE 7.', '🟠 Interferencia', 'EXTRA', 'Reps sin romper y tiempo por ronda'],
  M65: ['Nordic curl (isquios)', 8, '3×4–6 Nordic excéntrico de 4″ (con banda si hace falta) · 2′.', '🟢 Calidad', 'EXTRA', 'Reps y asistencia'],
  M66: ['Gemelo y sóleo · fuerza', 6, 'Tras la carrera: 3×12 elevación de talones a una pierna (pausa 2″ arriba) + 2×30″ isometría de sóleo en la pared.', '🟢 Calidad', 'EXTRA', 'Reps por pierna y carga'],
  M67: ['Front squat y OH con gomas', 8, '4×5 front squat con discos colgando de gomas (carga inestable) + 3×20″ hold OH con gomas.', '🟢 Estabilidad', 'TÉCNICA', 'Carga y segundos'],
  W34: ['Split jerk pesado', 10, 'EMOM 6′: 1 split jerk al 85–88 % · pausa 2″ en recepción. Si la recepción se mueve, baja 5 %.', '🟠 Técnico pesado', 'TÉCNICA', '% del 1RM de jerk y calidad de la recepción'],
  M68: ['Split isométrico · recepción del jerk', 6, '3×20–30″ por lado en posición de recepción del jerk (barra en front rack o OH ligera) · 60″.', '🟢 Estabilidad', 'TÉCNICA', 'Segundos por lado y carga']
};
// Notas de contenido (Pablo 23/11)
var MB_NOTAS_ = {
  M55: 'Press OH ligero en fatiga = repeticiones muy altas con interferencia: elige 100 DU + 30 STOH, 20 burpees + 40 STOH o 30 WB + 30 STOH.',
  T02: 'Thruster ligero con interferencia de otro estímulo del bloque (cuenta 1 por cada estímulo).',
  C01: 'DU en fatiga con interferencia de otro estímulo del bloque (cuenta 1 por cada estímulo).',
  M54: 'Sentadilla de muchas repeticiones: sobre todo front squat.',
  W40: 'Mínimo 2 al mes. Al acabar, FEEDBACK obligatorio: qué ejercicios y qué transiciones hay que trabajar.',
  W04: 'Calidad: tempo umbral VT2 o Z5 (fartlek/series).',
  W01: 'Z2 de carrera: 90′ mínimo a la semana; +15–30 % cuando cuadre.',
  R03: 'Z5: 1/mes imprescindible (2 si Fabrik no garantiza 1).',
  M61: 'Solo FRONT RACK y pesada (back rack y DB ya no cuentan).'
};
/** Fechas de corte y activación (APP · CONFIG, con valor por defecto). */
function mbCfg_() {
  var cf = {}; try { cf = leerConfig_(); } catch (e) {}
  var am = '', iso = function (v) { return celdaIso_(String(v == null ? '' : v).replace(/^'/, '')); };
  Object.keys(cf).forEach(function (k) { var m = k.match(/^regla_am_hasta_(\d{4}-\d{2}-\d{2})$/); if (m) am = iso(cf[k]) || m[1]; });
  return { activo: !/^(NO|FALSE|0|OFF)$/i.test(String(cf.generador_microbloques || '').trim()), desde: iso(cf.microbloques_desde) || '2026-11-23',
    corteAM: am || iso(cf.material_limite_hasta) || '2026-12-20', finX2: iso(cf.fin_x2_y_2P) || '2027-02-28' };
}
/** ¿Esta semana se programa por microbloques? (en las fases de la operación, salvo la previa, manda el modo operación con el generador clásico) */
function usaMicrobloques_(lunes, op, exc) {
  var c = mbCfg_(); if (!c.activo || lunes < c.desde || exc) return false;
  return !(op && op.enModo && op.fase !== 'PREVIA');
}
/** S del mes (por el jueves) y nº de semanas de ese mes. */
function mbSemanaMes_(lunes) {
  var jue = sumarDias(lunes, 3), d = +jue.slice(8, 10), y = +jue.slice(0, 4), m = +jue.slice(5, 7), dim = new Date(Date.UTC(y, m, 0)).getUTCDate(), f = ((d - 1) % 7) + 1;
  return { s: Math.floor((d - 1) / 7) + 1, n: Math.floor((dim - f) / 7) + 1, mes: m, anio: y };
}
function mbDow_(iso) { return (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7; }
/** Mañana disponible por regla: 'si', 'z2' (sábado, solo Z2 ≤35′) o '' (sin mañana). */
function mbManana_(iso, cfg) {
  var dow = mbDow_(iso);
  if (iso > cfg.corteAM) return 'si';
  return dow === 1 || dow === 2 || dow === 4 ? 'si' : dow === 5 ? 'z2' : '';
}
function mbEsMetcon_(r) { var t = norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || '')); return /METCON|\bWOD\b|ACONDICIONAMIENTO|CONDITIONING/.test(t) || /^\s*METCON\s*:/.test(norm(String(r.CONTENIDO || '').slice(0, 40))); }
/** Un componente (dosis tipo del catálogo CAT, o la de reserva si el catálogo no trae contenido). */
function mbComp_(c, cat) {
  if (/^IA\d$/.test(c)) return null;
  var e = cat[c] || {}, f = MB_FALLBACK_[c] || [], cont = String(e.CONTENIDO || '').trim();
  if (!cont || /^Ver plan de carrera|^Protocolo de la semana/i.test(cont)) cont = f[2] || cont;
  if (!cont) return null;
  return { cods: [c], nombre: e.NOMBRE || f[0] || c, contenido: (MB_NOTAS_[c] ? MB_NOTAS_[c] + '\n' : '') + cont, min: parseFloat(String(e.MIN || '').replace(',', '.')) || f[1] || 8,
    intensidad: e.INTENSIDAD || f[3] || '', registra: e['DATOS A REGISTRAR'] || f[5] || '', porque: e['POR QUÉ (cursiva)'] || '', ciencia: e['CIENCIA (técnica · fisiología · biología)'] || '', interf: e.INTERFERENCIAS || '' };
}
/** Lo que ya hay en APP · PLAN cada día (Fabrik y extras tuyos), sin los borradores automáticos que se regeneran. */
function mbDiasPlan_(lunes, esAuto) {
  var out = {}, ord = function (a, b) { return ordenNum_(a.ORDEN) - ordenNum_(b.ORDEN); };
  for (var i = 0; i < 7; i++) out[sumarDias(lunes, i)] = { filas: [], fab: [] };
  listar_(HOJAS.PLAN).forEach(function (r) {
    var x = out[celdaIso_(r.FECHA)]; if (!x || /NO HACER|CANCELADO|SUSTITUIDO|OCULTO|SIN HUECO|^PROPUESTA/.test(r.ESTADO) || (esAuto && esAuto(r))) return;
    x.filas.push(r); if (norm(r.ORIGEN) === 'FABRIK') x.fab.push(r);
  });
  Object.keys(out).forEach(function (d) { out[d].fab.sort(ord); });
  return out;
}
/** Códigos de la rotación de una parte para la semana k (0–3). */
function mbRot_(P, k, lunes) {
  var r = P.rot ? P.rot[k] : null; if (!r) return { c: [], p: '', pos: '' };
  var lista = Array.isArray(r) ? r : (r.c || []), par = Math.round(Date.parse(lunes) / 6048e5) % 2, out = [];
  lista.forEach(function (x) {
    if (x === 'RF1*') { var vol = false; try { var f = faseDe_(sumarDias(lunes, 2), estructura_(fabrik_())); vol = /VOLUMEN/.test(norm(f.nombre)) && +f.semana >= 1 && +f.semana <= 2; } catch (e) {}
      out = out.concat(vol ? ['RF1'] : ['M05', 'C02']); return; }
    if (/\|/.test(x)) { var o = x.split('|'); out.push(o[par % o.length]); return; }
    out.push(x);
  });
  return { c: out, p: Array.isArray(r) ? '' : (r.p || ''), pos: Array.isArray(r) ? '' : (r.pos || '') };
}
/** Construye y coloca los microbloques de la semana. E = entorno de generarExtras_ (lunes, cat, CARR, OP, ctx, colocar, candDe, nuevos, log, sim, permitidos, esAuto). */
function mbConstruirSemana_(E) {
  var cfg = mbCfg_(), lunes = E.lunes, cat = E.cat, SM = mbSemanaMes_(lunes), k = Math.min(SM.s, 4) - 1, log = E.log;
  var pl = mbDiasPlan_(lunes, E.esAuto), jue = sumarDias(lunes, 3);
  E.mb = { built: [], pl: pl, cfg: cfg, SM: SM, ocultos: [], contador: {} };
  // 1 · jueves: el metcon de Fabrik queda OCULTO (no hay metcon de Gabi; va P1–P4 + metcon corto de poca fatiga)
  if (!E.permitidos || E.permitidos[jue]) pl[jue].fab.filter(mbEsMetcon_).forEach(function (r) { E.mb.ocultos.push(r); pl[jue].fab.splice(pl[jue].fab.indexOf(r), 1); pl[jue].filas.splice(pl[jue].filas.indexOf(r), 1); });
  if (E.mb.ocultos.length) {
    if (!E.sim) E.mb.ocultos.forEach(function (r) { actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'OCULTO', ACTUALIZADO: ahora_() }); });
    MEMO = null; log.push('Jueves: metcon de Fabrik oculto (' + E.mb.ocultos.map(function (r) { return r['TÍTULO']; }).join(', ') + ')');
  }
  // 2 · S5 y meses de 5 semanas: más cortos; la S5 recoge lo que falta o repite la S4 técnica corta
  var tecnicaCorta = false, factorMes = SM.n >= 5 ? 0.8 : 1;
  if (SM.s >= 5) { tecnicaCorta = !mbFaltasMes_(E, lunes).length; if (!tecnicaCorta) k = -1; else k = 3; }
  log.push('Microbloques · S' + SM.s + '/' + SM.n + (SM.s >= 5 ? (tecnicaCorta ? ' (repite S4 en versión técnica corta)' : ' (recoge lo que falta del mes)') : ''));
  // 3 · grabaciones de WOD de competición esta semana y mañanas bloqueadas por eventos
  var evs = eventosEntre_(lunes, sumarDias(lunes, 6)), amBloq = {};
  var grab = evs.filter(function (e) { return /COMPETICI/.test(norm(e.TIPO)) && /GRABAR|WOD LEAGUE|WPD/.test(norm(e.EVENTO)); });
  evs.forEach(function (e) { if (!/Mañana|Día completo/.test(e.BLOQUEA || '')) return; for (var i = 0; i < 7; i++) { var d = sumarDias(lunes, i); if (d >= celdaIso_(e.INICIO) && d <= (celdaIso_(e.FIN) || celdaIso_(e.INICIO))) amBloq[d] = 1; } });
  var carr = (E.CARR || []).slice();
  MICROBLOQUES_.forEach(function (MB) {
    MB.partes.forEach(function (P) {
      var iso0 = sumarDias(lunes, P.dia), tras = iso0 > cfg.corteAM;
      if (P.soloDesde21 && !tras) return;
      var dia = tras && P.desde21 ? P.desde21.dia : P.dia, iso = sumarDias(lunes, dia), turno = P.turno;
      var gr = MB.mb === 'MB6' ? grab[0] : (MB.mb === 'MB8' && P.dia === 5 ? grab[1] : null);
      if (gr) { var gi = celdaIso_(gr.INICIO); if (gi >= lunes && gi <= sumarDias(lunes, 6)) { iso = gi; dia = mbDow_(gi); } }
      var dctx = E.ctx.dias[dia], cd = diaDe_(iso).slice(0, 3).toLowerCase();
      if (E.permitidos && !E.permitidos[iso]) return;
      if (dctx.descanso) { log.push(MB.mb + ' ' + cd + ': día de descanso'); return; }
      if (turno === 'AM' && (!mbManana_(iso, cfg) || amBloq[iso])) { log.push(MB.mb + ' ' + cd + ': sin mañana'); return; }
      if (turno === 'PM' && dctx.bloqPM) return;
      var R = k >= 0 ? mbRot_(P, k, lunes) : { c: [], p: '', pos: '' }, pos = gr ? 'metcon' : (R.pos || P.pos);
      var cods = gr ? codigosDe_(MB.mb === 'MB6' ? 'R01' : 'R04|R01') : (P.fijo || []).concat(R.c).filter(function (c, i, a) { return a.indexOf(c) === i; });
      if (iso <= cfg.corteAM) cods = cods.filter(function (c) { return c !== 'M38'; });   // sin trineo ni empuje de disco hasta el corte: se omite, no se sustituye
      cods = cods.filter(function (c) { return c !== 'OP1' || cat.OP1; });
      if (E.OP) cods = cods.filter(function (c) { try { return opPermite_(E.OP, [c], iso); } catch (e) { return true; } });
      if (turno === 'AM' && mbManana_(iso, cfg) === 'z2') cods = cods.filter(function (c) { return c === 'W02'; });
      var ya = mbCodsDia_(E, iso), quitados = cods.filter(function (c) { return ya.indexOf(c) >= 0; });
      cods = cods.filter(function (c) { return ya.indexOf(c) < 0; });
      // componentes: la carrera y el P salen del plan de carrera si los trae (mandan sobre la rotación)
      var comps = [], cubre = {};
      if ((MB.mb === 'MB1' || MB.mb === 'MB6') && !gr && cods.indexOf((P.fijo || [])[0]) >= 0) {
        var s = carr.filter(function (x) { return codigosDe_(x['CÓDIGOS']).indexOf((P.fijo || [])[0]) >= 0; })[0];
        if (s) {
          carr.splice(carr.indexOf(s), 1); var sc = codigosDe_(s['CÓDIGOS']).filter(function (c) { return ya.indexOf(c) < 0; });
          comps.push({ cods: sc, nombre: s['TÍTULO'], contenido: String(s.CONTENIDO || ''), min: parseFloat(s.MIN) || P.min || 30, intensidad: s.INTENSIDAD || '', registra: '', porque: s['POR QUÉ (cursiva)'] || '',
            ciencia: s['CIENCIA (técnica · fisiología · biología)'] || '', interf: s.INTERFERENCIAS || '', carrera: true });
          sc.forEach(function (c) { cubre[c] = 1; });
          if (P.etiqueta === 'calidad') cods = cods.filter(function (c) { return !/^R0[23]$/.test(c); });   // el plan de carrera decide si es Z4 o Z5
        }
      }
      if (gr) { if (cods.length) comps.push({ cods: cods.slice(), nombre: 'Grabación · ' + gr.EVENTO, contenido: 'Esta semana el ' + (MB.mb === 'MB6' ? 'P1–P4' : 'integrado (R04)') + ' es la grabación del WOD de competición «' + gr.EVENTO + '» (' + isoAFecha(celdaIso_(gr.INICIO)) + ').\nCalentamiento específico 15′, estrategia escrita antes de empezar y grábalo entero.' + (gr['CÓMO PROCEDER'] ? '\n' + gr['CÓMO PROCEDER'] : ''), min: 30, intensidad: '🔴 Competición', registra: 'Resultado, parciales y cómo te sentiste' }); }
      else cods.forEach(function (c) { if (cubre[c]) return; var x = mbComp_(c, cat); if (x) comps.push(x); });
      if (!comps.length) { if (quitados.length) log.push(MB.mb + ' ' + cd + ': Fabrik ya lo cubre todo (' + quitados.join(', ') + ')'); return; }
      var o = mbBloque_(MB, P, comps, { iso: iso, k: k, R: R, quitados: quitados, cat: cat, factor: factorMes * (tecnicaCorta ? 0.6 : 1), tecnicaCorta: tecnicaCorta, cfg: cfg, gr: gr });
      mbColocar_(E, o, MB, iso, turno, pos);
    });
  });
  // carrera del plan que no encaja en ningún microbloque: a la mañana de carrera que la admita (mejor el viernes)
  carr.forEach(function (s) {
    var sc = codigosDe_(s['CÓDIGOS']); if (sc.some(function (c) { return /^R0[14]$/.test(c); })) return;
    var b = E.mb.built.filter(function (x) { return x.mb === 'MB1' && !codigosDe_(x.o['CÓDIGOS']).some(function (c) { return sc.indexOf(c) >= 0 && c !== 'W02'; }); }).sort(function (a, b2) { return (b2.dia === 4 ? 1 : 0) - (a.dia === 4 ? 1 : 0); })[0];
    if (b) mbAnadirComp_(b, { cods: sc, nombre: s['TÍTULO'], contenido: s.CONTENIDO || '', min: parseFloat(s.MIN) || 20 }, 'del plan de carrera', true);
  });
  try { mbMetconJueves_(E); } catch (eJ) { Logger.log('Metcon corto del jueves: ' + eJ); }
  try { mbEstimulosIA_(E); } catch (eIA) { Logger.log('Estímulos IA: ' + eIA); }
  return E.mb;
}
/** Códigos que ya hay ese día (Fabrik visible + extras tuyos + microbloques ya colocados). */
function mbCodsDia_(E, iso) {
  var out = [];
  (E.mb.pl[iso] || { filas: [] }).filas.forEach(function (r) { out = out.concat(codigosDe_(r['CÓDIGOS'])); });
  E.mb.built.forEach(function (b) { if (b.iso === iso) out = out.concat(codigosDe_(b.o['CÓDIGOS'])); });
  return out;
}
/** Un microbloque = un solo bloque con sus componentes agrupados (dosis tipo del catálogo). */
function mbBloque_(MB, P, comps, x) {
  var letras = 'ABCDEFGHIJ', run = MB.mb === 'MB1', cods = [];
  comps.forEach(function (c) { c.cods.forEach(function (k) { if (cods.indexOf(k) < 0) cods.push(k); }); });
  var raw = comps.reduce(function (a, c) { return a + (c.min || 8); }, 0), n = comps.length, min;
  if (run) { var carrMin = comps.filter(function (c) { return c.carrera; }).reduce(function (a, c) { return a + c.min; }, 0); min = Math.min(P.maxMin || 999, Math.max(P.min || 0, carrMin + comps.filter(function (c) { return !c.carrera && !MB_CARRERA_.test(c.cods[0]); }).reduce(function (a, c) { return a + c.min; }, 0))); }
  else { min = Math.round(raw * (n >= 3 ? 0.7 : n === 2 ? 0.85 : 1)); if (P.max) min = Math.min(min, P.max); min = Math.max(6, Math.round(min * (x.factor || 1))); }
  var esP = cods.some(function (c) { return /^R0[14]$/.test(c); }), integ = cods.indexOf('R04') >= 0;
  var cab = MB.mb + ' · ' + MB.nombre.toUpperCase() + (MB.mb === 'MB+' ? '' : x.k >= 0 ? ' · S' + (x.k + 1) + ' (rotación de 4 semanas)' : ' · S5 (lo que falta del mes)') + (x.R.p && !x.gr ? '\nVariante: ' + x.R.p : '') +
    (P.notaS4 && x.k === 3 ? '\n' + P.notaS4 : '') + (x.tecnicaCorta ? '\nVERSIÓN TÉCNICA CORTA (5.ª semana del mes): calidad, la mitad de series, sin fatiga.' : '') +
    (!run ? '\n' + min + '′' + (raw > min ? ' · dosis reducida: 2 series de cada, sin fallo' : '') : '') +
    (integ && !x.gr ? '\nFORMATO INTEGRADO (R04, cuenta como 2.º P de la semana' + (x.iso <= x.cfg.finX2 ? ', obligatorio hasta el ' + isoAFecha(x.cfg.finX2) : '') + '): EVERY 4′ × 4 rondas · 60–75″ al 90–95 % con 15/12 cal bike + los movimientos de abajo en dosis corta · resto del intervalo en Z1. Misma velocidad en la 1.ª y la 4.ª ronda.' : '') +
    (esP && !integ && !x.gr && comps.length > 1 ? '\nLos movimientos B) en adelante van DENTRO del P como interferencia (dosis corta en cada ronda).' : '') +
    (x.quitados.length ? '\nQuitado porque Fabrik (o un bloque tuyo) ya lo trae hoy: ' + x.quitados.map(function (c) { return (x.cat[c] || {}).NOMBRE || (MB_FALLBACK_[c] || [])[0] || c; }).join(', ') : '');
  var cuerpo = comps.map(function (c, i) { return letras[i] + ') ' + c.nombre + '\n' + String(c.contenido || '').replace(/\n\nRegistra:[\s\S]*$/, ''); }).join('\n\n');
  var reg = comps.map(function (c) { return c.registra; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 3).join(' · ');
  var o = { ORIGEN: esP ? 'Z6–Z8' : MB.origen, 'TÍTULO': MB.mb + ' · ' + MB.nombre + (P.etiqueta ? ' · ' + P.etiqueta : '') + (x.R.p && !x.gr ? ' · ' + x.R.p : '') + (x.gr ? ' · grabación' : ''),
    CONTENIDO: cab + '\n\n' + cuerpo + (P.extra && x.k !== 3 ? '\n\n+ ' + P.extra : '') + '\n\nRegistra: ' + (reg || 'series, reps, kg y RPE'),
    INTENSIDAD: x.gr ? '🔴 Competición' : esP ? '🔴 Z6–Z8' : MB.intensidad || (comps[0].intensidad || ''), MIN: min, 'CÓDIGOS': cods.join('|'),
    'POR QUÉ (cursiva)': 'Microbloque ' + MB.mb + ' (' + MB.nombre.toLowerCase() + '): fijo cada semana + rotación S1–S4 para cubrir el 100 % de las metas semanales y, en el mes, las mensuales. ' + (comps[0].porque || ''),
    'CIENCIA (técnica · fisiología · biología)': comps.map(function (c) { return c.ciencia; }).filter(Boolean).slice(0, 2).join(' '), INTERFERENCIAS: comps.map(function (c) { return c.interf; }).filter(Boolean)[0] || '',
    CANTIDAD: saltosTexto_(cuerpo) || '', _mb: MB.mb, _prio: 'microbloque' };
  if (cods.indexOf('W07') >= 0 && !o.CANTIDAD) o.CANTIDAD = 35;
  return o;
}
/** Coloca el bloque (reutiliza colocar de generarExtras_ para que el contexto de la semana lo cuente) y fija su ORDEN por la regla del microbloque. */
function mbColocar_(E, o, MB, iso, turno, pos) {
  E.colocar(o, E.candDe(o), { iso: iso, dia: diaDe_(iso), turno: turno, motivos: [mbMotivo_(pos, iso, E.mb.cfg)], choques: [] });
  o.ORDEN = mbOrden_(E, o, iso, turno, pos);
  var b = { o: o, mb: MB.mb, iso: iso, dia: mbDow_(iso), turno: turno, pos: pos };
  E.mb.built.push(b); return b;
}
function mbMotivo_(pos, iso, cfg) {
  return pos === 'AM' ? 'carrera y ergo solo de mañana (regla hasta el ' + isoAFecha(cfg.corteAM) + ': mar, mié y vie; sáb solo Z2 ≤35′)' :
    pos === 'justoAntes' ? 'cuerda y RMU justo antes de la clase' : pos === 'antes' ? 'antes de la clase (la clase siempre lo último)' :
    pos === 'metcon' ? 'en el hueco del metcon de la clase' : 'sesión propia' + (mbManana_(iso, cfg) ? '' : ', tras la clase (día sin mañana: nada antes de la clase)');
}
function mbOrden_(E, o, iso, turno, pos) {
  var C = E.mb.contador, key = iso + '|' + turno + '|' + pos, n = C[key] = (C[key] || 0) + 1;
  if (turno === 'AM') return 10 + n;
  var fab = (E.mb.pl[iso] || { fab: [] }).fab.filter(function (r) { return r.TURNO !== 'AM'; });
  if (!fab.length) return (pos === 'inicio' ? 79 : pos === 'cierre' ? 90 : pos === 'metconCorto' ? 89 : 80) + n / 10;
  var f0 = ordenNum_(fab[0].ORDEN) || 50, fmax = ordenNum_(fab[fab.length - 1].ORDEN) || f0, anillas = codigosDe_(o['CÓDIGOS']).some(function (c) { return MATERIAL_.anillasCuerda.test(c); });
  if (pos === 'metcon' && anillas) pos = 'justoAntes';   // RMU y cuerda: siempre antes de la clase
  if (!mbManana_(iso, E.mb.cfg) && /^(antes|justoAntes)$/.test(pos)) pos = 'propia';   // días sin mañana: nada antes de la clase
  if (pos === 'metcon') {
    var met = fab.filter(mbEsMetcon_)[0]; if (!met) pos = 'antes';
    else { var om = ordenNum_(met.ORDEN), prev = fab.filter(function (r) { return ordenNum_(r.ORDEN) < om; }).map(function (r) { return ordenNum_(r.ORDEN); }), op = prev.length ? Math.max.apply(null, prev) : om - 1;
      return Math.round((op + (om - op) * Math.min(0.9, 0.3 + 0.1 * n)) * 100) / 100; }
  }
  if (pos === 'antes') return Math.round((f0 - 0.9 + 0.1 * n) * 100) / 100;
  if (pos === 'justoAntes') return Math.round((f0 - 0.3 + 0.05 * n) * 100) / 100;
  return Math.round((fmax + (pos === 'inicio' ? 0.5 : pos === 'cierre' ? 5 : pos === 'metconCorto' ? 4 : 1 + 0.5 * n)) * 100) / 100;
}
/** Añade un componente a un bloque ya colocado (relleno de metas o carrera sobrante). */
function mbAnadirComp_(b, comp, por, completo) {
  var o = b.o, cs = codigosDe_(o['CÓDIGOS']);
  comp.cods.forEach(function (c) { if (cs.indexOf(c) < 0) cs.push(c); });
  var n = (String(o.CONTENIDO || '').match(/^[A-J]\) /gm) || []).length, letra = 'ABCDEFGHIJ'.charAt(Math.min(9, n));
  var txt = letra + ') ' + comp.nombre + ' (' + por + ')\n' + String(comp.contenido || '').replace(/\n\nRegistra:[\s\S]*$/, '') + (completo ? '' : '\n→ dosis corta: 2 series, sin fallo.');
  o['CÓDIGOS'] = cs.join('|');
  o.CONTENIDO = /\n\nRegistra:/.test(o.CONTENIDO || '') ? String(o.CONTENIDO).replace(/\n\nRegistra:/, '\n\n' + txt + '\n\nRegistra:') : String(o.CONTENIDO || '') + '\n\n' + txt;
  o.MIN = (parseFloat(o.MIN) || 10) + (completo ? (comp.min || 10) : Math.max(3, Math.round((comp.min || 8) * 0.5)));
  var sal = saltosTexto_(comp.contenido || ''); if (sal) o.CANTIDAD = (parseFloat(o.CANTIDAD) || 0) + sal;
}
/** ¿Este bloque admite este código? (reglas de día, turno, material y fatiga) */
function mbAcepta_(E, b, c) {
  if (b.ia || codigosDe_(b.o['CÓDIGOS']).indexOf(c) >= 0 || mbCodsDia_(E, b.iso).indexOf(c) >= 0) return false;
  if (MB_CARRERA_.test(c) !== (b.mb === 'MB1')) return false;   // carrera y ergo solo en MB1 (mañana) y MB1 solo admite carrera
  if (MATERIAL_.anillasCuerda.test(c) && b.mb !== 'MB3') return false;
  if (b.dia === 3 && (MB_FATIGA_ALTA_.test(c) || (familiaSin_([c]) === 'fatiga' && b.mb !== 'MB6'))) return false;
  if (/^R0[14]$/.test(c) && b.mb !== 'MB6' && b.mb !== 'MB8') return false;
  if (b.mb === 'MB6' && !/^(R01|C0\d|T0\d|M33|M32|M35|V01|M57|M05|M07|M64)$/.test(c)) return false;
  if (c === 'M38' && b.iso <= E.mb.cfg.corteAM) return false;
  if (E.OP) { try { if (!opPermite_(E.OP, [c], b.iso)) return false; } catch (e) {} }
  return true;
}
function mbAfin_(c) {
  var out = [];
  MICROBLOQUES_.forEach(function (MB) { MB.partes.forEach(function (P) { var t = (P.fijo || []).concat([].concat.apply([], (P.rot || []).map(function (r) { return Array.isArray(r) ? r : r.c || []; }))).join('|').split('|'); if (t.indexOf(c) >= 0 && out.indexOf(MB.mb) < 0) out.push(MB.mb); }); });
  for (var f in FAMILIAS_) if (FAMILIAS_[f].indexOf(c) >= 0 && MB_AFIN_[f] && out.indexOf(MB_AFIN_[f]) < 0) out.push(MB_AFIN_[f]);
  var fs = familiaSin_([c]); (fs === 'fatiga' ? ['MB4', 'MB8'] : fs === 'tecnica' ? ['MB2', 'MB5'] : fs === 'accesorio' ? ['MB7'] : ['MB8', 'MB7']).forEach(function (m) { if (out.indexOf(m) < 0) out.push(m); });
  return out;
}
/** Bloque destino para un código que falta; si ninguno lo admite, crea «MB+ · Refuerzo de metas» en una sesión propia o antes de la clase. */
function mbDestino_(E, c) {
  var af = mbAfin_(c), L = E.mb.built.filter(function (b) { return mbAcepta_(E, b, c); });
  L.sort(function (a, b) { var ia = af.indexOf(a.mb), ib = af.indexOf(b.mb); ia = ia < 0 ? 99 : ia; ib = ib < 0 ? 99 : ib;
    return ia - ib || codigosDe_(a.o['CÓDIGOS']).length - codigosDe_(b.o['CÓDIGOS']).length; });
  if (L[0]) return L[0];
  if (MB_CARRERA_.test(c) || MATERIAL_.anillasCuerda.test(c)) return null;
  var comp = mbComp_(c, E.cat); if (!comp) return null;
  var opciones = [6, 4, 1, 2].map(function (i) { return sumarDias(E.lunes, i); }).filter(function (iso) { var d = E.ctx.dias[mbDow_(iso)];
    return (!E.permitidos || E.permitidos[iso]) && !d.descanso && !d.bloqPM && mbCodsDia_(E, iso).indexOf(c) < 0 && !E.mb.built.some(function (b) { return b.mb === 'MB+' && b.iso === iso; }); });
  if (!opciones.length) return null;
  var MB = { mb: 'MB+', nombre: 'Refuerzo de metas', origen: 'EXTRA' }, iso = opciones[0];
  var o = mbBloque_(MB, { etiqueta: '', max: 20 }, [comp], { iso: iso, k: Math.min(E.mb.SM.s, 4) - 1, R: { p: '' }, quitados: [], cat: E.cat, factor: 1, cfg: E.mb.cfg });
  o['POR QUÉ (cursiva)'] = 'Ningún microbloque de la semana admitía este estímulo (Fabrik ya lo trae esos días o la regla del día lo impide): va en su propio bloque para no dejar la meta sin cubrir.';
  var b = mbColocar_(E, o, MB, iso, 'PM', mbDow_(iso) === 6 ? 'propia' : 'antes');
  b.recienCreado = true; return b;
}
function mbCache_(E) {
  var c = cacheMetas_(), oc = E.mb ? E.mb.ocultos.map(function (r) { return r.ID; }) : [];
  c.plan = c.plan.filter(function (r) { return !(E.esAuto && E.esAuto(r)) && oc.indexOf(r.ID) < 0; }).concat((E.nuevos || []).filter(function (o) { return o.ESTADO !== 'SIN HUECO'; }));
  return c;
}
/** Metas mensuales que no se alcanzarán con lo programado + la rotación que queda del mes. */
function mbFaltasMes_(E, lunes) {
  var per = periodoMes_(lunes), cache = mbCache_(E), SM = mbSemanaMes_(lunes);
  var futuro = function (c) { var n = 0; for (var s = SM.s + 1; s <= Math.min(SM.n, 4); s++) MICROBLOQUES_.forEach(function (MB) { MB.partes.forEach(function (P) { if (P.soloDesde21) return; if ((P.fijo || []).indexOf(c) >= 0) n++; var r = P.rot && P.rot[s - 1]; if (r && (Array.isArray(r) ? r : r.c || []).join('|').split('|').indexOf(c) >= 0) n++; }); }); return n; };
  return avanceMetas_('Mes', per, cache).filter(function (m) { return String(m.tipo) === 'COUNT' && m.meta > 0 && !/^R0/.test(m.codigos || ''); }).map(function (m) {
    var cs = codigosDe_(m.codigos); return { m: m, falta: m.meta - m.programado - Math.max.apply(null, cs.map(futuro).concat([0])) };
  }).filter(function (x) { return x.falta > 0; });
}
/** Comprueba las metas (avanceMetas_, lo mismo que la app) y añade lo que falte de la semana y la parte del mes que toca esta semana. */
function mbRellenar_(E) {
  if (!E.mb) return;
  var lunes = E.lunes, cat = E.cat, imposible = {}, anad = [];
  var elegir = function (m) { var cs = codigosDe_(m.codigos).filter(function (c) { return !MB_NO_RELLENO_.test(c) && !imposible[m.id + c] && !(c === 'M38' && lunes <= E.mb.cfg.corteAM) && mbComp_(c, cat); });
    if (cs.length > 1 && /ROTA/i.test(m.notas || '')) cs = cs.slice(Math.round(Date.parse(lunes) / 6048e5) % cs.length).concat(cs); return cs[0]; };
  var poner = function (m, c, por) {
    var b = mbDestino_(E, c); if (!b) { imposible[m.id + c] = 1; return false; }
    if (!b.recienCreado) mbAnadirComp_(b, mbComp_(c, cat), por, false); b.recienCreado = false;
    anad.push(c + '→' + b.mb + ' ' + diaDe_(b.iso).slice(0, 3).toLowerCase()); return true;
  };
  for (var v = 0; v < 60; v++) {
    var sem = avanceMetas_('Semana', periodoSemana_(lunes), mbCache_(E)), hizo = false;
    for (var i = 0; i < sem.length && !hizo; i++) {
      var m = sem[i]; if (m.cubierta || imposible[m.id]) continue;
      var tipo = String(m.tipo || 'COUNT'), falta = m.meta - m.programado;
      if (tipo === 'MIN' || tipo === 'MIN_GT') {
        var cs = codigosDe_(m.codigos), b = E.mb.built.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).some(function (c) { return cs.indexOf(c) >= 0; }) && x.dia !== 5; })[0];
        if (!b) { imposible[m.id] = 1; continue; }
        b.o.MIN = (parseFloat(b.o.MIN) || 0) + Math.ceil(falta); b.o.CONTENIDO += '\n\n+ ' + Math.ceil(falta) + '′ más para cubrir la meta semanal «' + m.estimulo + '».'; hizo = true; continue;
      }
      if (tipo === 'SALTOS') {
        var bw = E.mb.built.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).indexOf('W07') >= 0; })[0] || E.mb.built.filter(function (x) { return x.mb === 'MB5'; })[0];
        if (!bw) { imposible[m.id] = 1; continue; }
        var f = Math.ceil(falta), pogo = Math.ceil(f / 10);
        bw.o.CONTENIDO += '\n\n+ PLIOMETRÍA: ' + pogo + '×10 pogo jumps (contacto corto) antes de la barra · cubren los ' + f + ' saltos que faltan esta semana.';
        bw.o.CANTIDAD = (parseFloat(bw.o.CANTIDAD) || 0) + pogo * 10; if (codigosDe_(bw.o['CÓDIGOS']).indexOf('W07') < 0) bw.o['CÓDIGOS'] += '|W07'; hizo = true; continue;
      }
      var c = elegir(m); if (!c) { imposible[m.id] = 1; continue; }
      poner(m, c, 'meta semanal «' + m.estimulo + '»'); hizo = true;   // si no cabía, queda marcado y se sigue
    }
    if (!hizo) break;
  }
  // mes: lo que no se alcanzará con la rotación que queda, repartido entre las semanas que quedan (la última recoge todo)
  var per = periodoMes_(lunes), wl = weeksLeft_(lunes, per), ultima = sumarDias(lunes, 6) >= per.hasta || E.mb.SM.s >= E.mb.SM.n;
  mbFaltasMes_(E, lunes).forEach(function (x) {
    var n = ultima ? x.falta : Math.ceil(x.falta / Math.max(1, wl));
    for (var j = 0; j < n; j++) { var c = elegir(x.m); if (!c || !poner(x.m, c, 'meta mensual «' + x.m.estimulo + '»')) break; }
  });
  if (anad.length) E.log.push('Relleno de metas: ' + anad.join(', '));
}
/** Jueves: metcon corto de poca fatiga con movimientos no tocados en 3 semanas (candidatos del libro Motor › MOTOR · JUEVES, columnas I:N). */
function mbMetconJueves_(E) {
  var jue = sumarDias(E.lunes, 3), d = E.ctx.dias[3]; if ((E.permitidos && !E.permitidos[jue]) || d.descanso || d.bloqPM) return;
  var cand = [];
  try { var sh = motorLibro_().getSheetByName('MOTOR · JUEVES'); if (sh && sh.getLastRow() > 1) sh.getRange(2, 9, sh.getLastRow() - 1, 6).getDisplayValues().forEach(function (r) { r.forEach(function (v) { (String(v).toUpperCase().match(/\b[A-Z]{1,2}\d{2}\b/g) || []).forEach(function (c) { if (cand.indexOf(c) < 0) cand.push(c); }); }); }); } catch (e) {}
  MB_POOL_JUEVES_.forEach(function (c) { if (cand.indexOf(c) < 0) cand.push(c); });
  var desde = sumarDias(E.lunes, -21), ultima = {};   // última exposición de cada código en las 3 semanas previas
  listar_(HOJAS.PLAN).forEach(function (r) { var f = celdaIso_(r.FECHA); if (f >= desde && f < E.lunes && !/NO HACER|CANCELADO|SUSTITUIDO/.test(r.ESTADO)) codigosDe_(r['CÓDIGOS']).forEach(function (c) { if (!ultima[c] || f > ultima[c]) ultima[c] = f; }); });
  // sin tocar en 3 semanas primero; si no hay bastantes, los que hace más tiempo que no salen
  cand = cand.map(function (c, i) { return { c: c, i: i, u: ultima[c] || '' }; }).sort(function (a, b) { return (a.u < b.u ? -1 : a.u > b.u ? 1 : a.i - b.i); }).map(function (x) { return x.c; });
  var ya = mbCodsDia_(E, jue), elegidos = cand.filter(function (c) { return ya.indexOf(c) < 0 && !MB_FATIGA_ALTA_.test(c) && !MB_CARRERA_.test(c) && !MATERIAL_.anillasCuerda.test(c) && !/^(R0|IA|W4|OP)/.test(c) && familiaSin_([c]) !== 'fatiga' && mbComp_(c, E.cat); }).slice(0, 3);
  if (elegidos.length < 2) return;
  var MB = { mb: 'MB6', nombre: 'P1–P4', origen: 'EXTRA', intensidad: '🟢 Fatiga ligera' };
  var o = mbBloque_(MB, { etiqueta: 'metcon corto de poca fatiga', max: 12 }, elegidos.map(function (c) { return mbComp_(c, E.cat); }), { iso: jue, k: Math.min(E.mb.SM.s, 4) - 1, R: { p: '' }, quitados: [], cat: E.cat, factor: 1, cfg: E.mb.cfg });
  o.CONTENIDO = o.CONTENIDO.replace(/\n\nA\) /, '\n\nFORMATO: AMRAP 10′ a RPE 6 (respiración por la nariz); una vuelta = una dosis corta de cada movimiento.\n\nA) ');
  o['POR QUÉ (cursiva)'] = 'Jueves sin metcon de Gabi: metcon pequeño de poca fatiga con movimientos que no has tocado en 3 semanas (atacan carencias sin quitar calidad al haltero ni al P).';
  mbColocar_(E, o, MB, jue, 'PM', 'metconCorto');
}
/**
 * Estímulos IA (IA1/IA2): los define Claude en el libro Motor › «MOTOR · ESTÍMULOS IA». El generador solo los coloca.
 * Cabeceras: CÓDIGO, NOMBRE, CARENCIA, OBJETIVO, CONTENIDO S1…S4, DÓNDE (día · turno · microbloque · semanas), MIN, CIENCIA, FUENTES, VIGENTE DESDE, VIGENTE HASTA, EVIDENCIA, CÓMO SE MIDE.
 * DÓNDE: «JUE · PM · MB5 Haltero (al inicio, tras la potencia) · S1 y S3» · «MAR · PM · antes de la clase, tras MB2 (…) · S2 y S4». Contenido «—» = esa semana no va.
 */
function mbEstimulosIA_(E) {
  var sh = null; try { sh = motorLibro_().getSheetByName('MOTOR · ESTÍMULOS IA'); } catch (e) { return; }
  if (!sh || sh.getLastRow() < 2) return;
  var g = sh.getRange(1, 1, sh.getLastRow(), Math.max(16, sh.getLastColumn())).getDisplayValues(), cab = g[0].map(function (h) { return norm(String(h).trim()); });
  var col = function (r, n) { n = norm(n); var i = cab.indexOf(n); if (i < 0) cab.forEach(function (h, j) { if (i < 0 && h.indexOf(n) === 0) i = j; }); return i >= 0 ? String(r[i] || '').trim() : ''; };
  var s = Math.min(E.mb.SM.s, 4), lunes = E.lunes, fin = sumarDias(lunes, 6), cfg = E.mb.cfg, DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
  g.slice(1).forEach(function (r) {
    var c = norm(col(r, 'CÓDIGO')); if (!/^IA\d$/.test(c)) return;
    var d0 = celdaIso_(col(r, 'VIGENTE DESDE')), d1 = celdaIso_(col(r, 'VIGENTE HASTA'));
    if ((d0 && d0 > fin) || (d1 && d1 < lunes)) return;
    var cont = col(r, 'CONTENIDO S' + s); if (!cont || /^[—–\-\s]*$/.test(cont)) return;
    var donde = norm(col(r, 'DÓNDE')), partes = donde.split(/\s*·\s*/), sems = (donde.match(/\bS\s?([1-4])\b/g) || []).map(function (x) { return +x.replace(/\D/g, ''); });
    if (sems.length && sems.indexOf(s) < 0) return;
    var di = -1; partes.forEach(function (p) { DIAS.forEach(function (x, i) { if (di < 0 && new RegExp('^' + x).test(p.trim())) di = i; }); });
    var mbm = (donde.match(/MB\s?(\d)/) || [])[1], bMB = mbm ? E.mb.built.filter(function (b) { return b.mb === 'MB' + mbm && (di < 0 || b.dia === di); })[0] : null;
    if (di < 0) di = bMB ? bMB.dia : 6;
    var iso = sumarDias(lunes, di); if ((E.permitidos && !E.permitidos[iso]) || E.ctx.dias[di].descanso) return;
    var turno = partes.some(function (p) { return /^AM\b/.test(p.trim()); }) && mbManana_(iso, cfg) ? 'AM' : 'PM', n = c.slice(2);
    var tras = /\bTRAS\s+MB/.test(donde), antesClase = /ANTES DE LA CLASE/.test(donde), alInicio = /AL INICIO/.test(donde) && !tras;
    var pos = turno === 'AM' ? 'AM' : bMB ? bMB.pos : antesClase ? 'antes' : 'propia';
    var o = { ORIGEN: 'EXTRA', 'TÍTULO': (bMB ? bMB.mb + ' · ' : '') + 'ESTÍMULO IA ' + n + ' · ' + (col(r, 'NOMBRE') || c),
      CONTENIDO: cont + (col(r, 'OBJETIVO') ? '\n\nObjetivo: ' + col(r, 'OBJETIVO') : '') + '\n\nRegistra: ' + (col(r, 'CÓMO SE MIDE') || 'series, reps, kg, RPE y cómo salió'),
      INTENSIDAD: '🟢 Calidad', MIN: parseFloat(String(col(r, 'MIN')).replace(',', '.')) || 10, 'CÓDIGOS': c,
      'POR QUÉ (cursiva)': 'Estímulo IA ' + n + (col(r, 'CARENCIA') ? ' · carencia: ' + col(r, 'CARENCIA') : '') + '. Lo define Claude en el libro Motor (MOTOR · ESTÍMULOS IA); el generador solo lo coloca (' + col(r, 'DÓNDE') + ').',
      'CIENCIA (técnica · fisiología · biología)': col(r, 'CIENCIA') + (col(r, 'FUENTES') ? ' Fuentes: ' + col(r, 'FUENTES') : ''), _prio: 'microbloque' };
    var b = mbColocar_(E, o, { mb: bMB ? bMB.mb : 'IA' }, iso, turno, pos);
    b.ia = true; if (bMB) o.ORDEN = Math.round((ordenNum_(bMB.o.ORDEN) + (alInicio ? -0.05 : 0.05)) * 100) / 100;
    E.log.push('Estímulo IA ' + n + ' → ' + diaDe_(iso).slice(0, 3).toLowerCase() + ' ' + turno + (bMB ? ' (' + bMB.mb + ')' : ''));
  });
}
/** v0.32 · migración única: M61 pasa a zancada frontal pesada (solo front rack) 2/mes; RC1 ya no se programa (META 0); M68 al catálogo; metas IA1, IA2 y M68. */
function migrarMicrobloques_() {
  var cf = leerConfig_(); if (cf.mig_v032) return 0;
  var n = 0;
  try { n += sembrarEstimulos_(); } catch (e) {}
  var b61 = EST_BASE.filter(function (e) { return e[0] === 'M61'; })[0];
  listar_(HOJAS.ESTIMULOS).forEach(function (r) {
    if (String(r['CÓDIGO']).trim().toUpperCase() !== 'M61' || !/BACK RACK/i.test(r.NOMBRE || '')) return;
    actualizarFila_(HOJAS.ESTIMULOS, r._fila, { NOMBRE: b61[1], 'DETECTAR (regex)': b61[2], CONTENIDO: b61[7], 'DATOS A REGISTRAR': b61[13] }); n++;
  });
  listar_(HOJAS.METAS).forEach(function (m) {
    var cs = String(m['CÓDIGOS'] || '').trim().toUpperCase();
    if (cs === 'M61' && m['ÁMBITO'] === 'Mes' && !/FRONTAL/.test(norm(m['ESTÍMULO']))) { actualizarFila_(HOJAS.METAS, m._fila, { 'ESTÍMULO': 'ZANCADA FRONTAL PESADA · FRONT RACK', META: '2', NOTAS: 'Dos exposiciones al mes de zancada pesada con barra en FRONT RACK (back rack y DB ya no cuentan). Va en el microbloque MB7 (S1 y S3).' }); n++; }
    if (cs === 'RC1' && String(m.META) !== '0') { actualizarFila_(HOJAS.METAS, m._fila, { META: '0', NOTAS: 'Ya no se programa (decisión de Pablo 23/11/2026): la carrera comprometida W40 la sustituye.' }); n++; }
  });
  try { n += sembrarMetasV32_(); } catch (e) {}
  [['microbloques_desde', '2026-11-23', 'Desde qué lunes «Cargar extras» programa por microbloques (antes: generador clásico)'], ['fin_x2_y_2P', '2027-02-28', '×2 del modo operación y 2.º P1–P4 obligatorio hasta esta fecha']]
    .forEach(function (x) { if (!cf[x[0]]) ponerConfig_(x[0], "'" + x[1], x[2]); });
  ponerConfig_('mig_v032', ahora_() + ' · ' + n + ' cambios', 'v0.32 · migración de microbloques (M61, RC1, M68, IA1, IA2)');
  MEMO = null; return n;
}
