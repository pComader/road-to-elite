// ===================== v0.13 · MANUAL DE RENDIMIENTO HÍBRIDO v2.0 (doc del proyecto, rev. 5/11/2026) =====================
/**
 * Reglas del manual que la app aplica al «Cargar extras» (decisión de Pablo 6/11/2026: al pie de la letra):
 *  · Decisión de Pablo 6/11 · el P del plan va SIEMPRE; un metcon de Fabrik tipo P1–P4 solo cuenta como día duro (≥48 h)
 *    y hace más difícil encajar la 2.ª P. El requisito semanal se mantiene aunque haya test (excepciones: excepcionSemana_).
 *  · §15.1 · SPR1 va al inicio de la sesión del P de esa semana (una sola sesión física); SPR2 va dentro del P3.
 *  · §11.1 · el jueves Fabrik pide Z2 real: la Z2 corta va ese día y se registra una sola vez.
 *  · §10.3 + decisión de Pablo · la 2.ª P integrada (R04) solo entra si cabe por volumen, intensidad y fatiga.
 */
var MANUAL_V2_ = 'Manual de rendimiento híbrido v2.0';
function filasFabrikSemana_(lunes) {
  return listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return norm(r.ORIGEN) === 'FABRIK' && d >= lunes && d <= sumarDias(lunes, 6) && !/NO HACER|CANCELADO|SUSTITUIDO|OCULTO/.test(r.ESTADO); });
}
/** ¿Este bloque de Fabrik es un metcon de la familia P1 (every N′ con máquina + barra/WB) o P4 (alternancia de trabajo controlado y picos)? */
function esMetconP_(r) {
    var t = norm(r['TÍTULO'] + '\n' + r.CONTENIDO);
    var erg = /\bCALS?\b|CALORI|ROW|SKI|BIKE|ECHO|ASSAULT|\d+\s*M\s*(RUN|CARRERA)|\bRUN\b/.test(t);
    var barra = /WALL ?BALLS?|\bWB\b|CLEAN|SNATCH|THRUSTER|LUNGE|STOH|SHOULDER TO|JERK/.test(t);
    var every = /EVERY\s*\d+\s*\D{0,3}\s*[X×]\s*[3-6]\b|E\s?\d\s?M\s?O?M\s*[X×]\s*[3-6]\b/.test(t);
    var alterna = /EMOM/.test(t) && /IMPAR|\bPAR\b|\bODD\b|\bEVEN\b|ALTERN/.test(t) && /SNATCH|CLEAN|THRUSTER|STOH|SHOULDER TO|JERK|MUSCLE/.test(t);
    return (every && erg && barra) || alterna;
}
/** Bloque de Fabrik de la semana con Z2 real (conversacional, RPE <6). */
function fabrikZ2_(lunes) {
  return filasFabrikSemana_(lunes).filter(function (r) {
    var t = norm(r['TÍTULO'] + '\n' + r.CONTENIDO), rpe = parseInt(String(r.INTENSIDAD || '').replace(/\D/g, ''), 10) || 0;
    return /\bZ2\b|ZONA 2|CONVERSACIONAL/.test(t) && rpe < 6;
  })[0] || null;
}
function reglasManualV2_(out, lunes, titulo) {
  var nt = norm(titulo || '');
  var tipo = /\bTEST (2|10) ?KM/.test(nt) && !/SIN TEST/.test(nt) ? 'test' : /PUESTA A PUNTO|TAPER/.test(nt) ? 'taper' : /DESCARGA/.test(nt) ? 'descarga' : 'carga';
  var p = out.filter(function (x) { return /R01/.test(x['CÓDIGOS']); })[0];
  var spr = out.filter(function (x) { return x['CÓDIGOS'] === 'V01'; })[0];
  // 1 · Decisión de Pablo 6/11: el P del plan va SIEMPRE (obligatorio aunque Fabrik traiga un metcon de la familia P1–P4).
  //     El metcon tipo P de Fabrik cuenta como día duro: el P del plan se separa ≥48 h y la 2.ª P cuesta más de encajar.
  if (p) {
    var fP = filasFabrikSemana_(lunes).filter(esMetconP_);
    if (fP.length) p['POR QUÉ (cursiva)'] = [p['POR QUÉ (cursiva)'], 'Fabrik ya trae un metcon tipo P (' + fP.map(function (r) { return diaDe_(celdaIso_(r.FECHA)).toLowerCase() + ': ' + r['TÍTULO']; }).join('; ') + '): el P del plan va igualmente (obligatorio), separado ≥48 h de ese día, y la 2.ª P solo entra si aún cabe.'].filter(Boolean).join(' ');
  }
  // 2 · SPR1 al inicio de la sesión del P (una sola sesión física, §15.1)
  if (spr && p) {
    p.CONTENIDO = 'SPRINT · SPR1 al INICIO, en fresco (se descuenta del total):\n' + spr.CONTENIDO + '\n\n— Después, el protocolo —\n' + p.CONTENIDO;
    p['CÓDIGOS'] = codigosDe_(p['CÓDIGOS']).concat(['V01']).filter(function (c, i, a) { return a.indexOf(c) === i; }).join('|');
    p.MIN = (parseFloat(p.MIN) || 20) + 15;
    p['POR QUÉ (cursiva)'] = [p['POR QUÉ (cursiva)'], 'Lleva el sprint de carrera del mes al principio (manual §15.1): la velocidad va en fresco y cuenta como una sola sesión física.'].filter(Boolean).join(' ');
    out.splice(out.indexOf(spr), 1);
  }
  // 3 · Z2 corta = la Z2 que pide Fabrik (§11.1)
  var z = out.filter(function (x) { return x['CÓDIGOS'] === 'W02'; })[0], fz = z ? fabrikZ2_(lunes) : null;
  if (z && fz) {
    z._fabrikZ2 = { iso: celdaIso_(fz.FECHA), ref: fz['TÍTULO'] };
    z['POR QUÉ (cursiva)'] = [z['POR QUÉ (cursiva)'], 'Ese día Fabrik pide Z2 real («' + fz['TÍTULO'] + '»): esta Z2 corta ES esa Z2 y se registra una sola vez (manual §11.1).'].filter(Boolean).join(' ');
  }
  out.semanaTipo = tipo;
  return out;
}
/**
 * Semana sin requisito semanal (decisión de Pablo 6/11): SOLO si (a) él lo indica (APP · SEMANAS › SIN REQUISITO SEMANAL = Sí),
 * (b) hay una competición decidida el fin de semana, o (c) hay un test que él marca como MUY EXIGENTE (Open, clasificatorio online…)
 * en APP · EVENTOS. Los tests normales NO levantan el requisito. Devuelve el motivo o ''.
 */
function excepcionSemana_(lunes) {
  var conf = filaSemana_(lunes) || {}, si = function (v) { return /^(S[IÍ]|TRUE|1|X)$/i.test(String(v || '').trim()); };
  if (si(conf['SIN REQUISITO SEMANAL'])) return 'lo indicaste tú en la confirmación de la semana';
  var sab = sumarDias(lunes, 5), dom = sumarDias(lunes, 6), out = '';
  eventosEntre_(lunes, dom).forEach(function (e) {
    if (out || /Ignorado|Pendiente/i.test(e.ESTADO || '')) return;
    var i0 = celdaIso_(e.INICIO), f0 = celdaIso_(e.FIN) || i0;
    if (si(e['MUY EXIGENTE'])) out = 'test o competición muy exigente: ' + e.EVENTO + ' (' + isoAFecha(i0) + ')';
    else if (/Competici/i.test(e.TIPO || '') && i0 <= dom && f0 >= sab) out = 'competición el fin de semana: ' + e.EVENTO;
  });
  return out;
}
/**
 * Decisión de Pablo 6/11: cada mes lleva AL MENOS UN P DE CADA TIPO (P1, P2, P3, P4).
 * Lee la pestaña «carrera» (protocolo de cada semana) y devuelve los meses a los que les falta alguno: [{ mes, faltan: ['P1'] }].
 */
function auditarProtocolosMes_() {
  var sh = miLibro_().getSheetByName('carrera'); if (!sh) return [];
  var g = sh.getRange(1, 1, Math.min(sh.getLastRow(), 400), 1).getDisplayValues();
  var ini = (String(g[1] && g[1][0]).match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i) || []);
  var MES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12 };
  if (!ini[1]) return [];
  var base = lunesDe_(ini[3] + '-' + ('0' + MES[norm(ini[2])]).slice(-2) + '-' + ('0' + ini[1]).slice(-2));
  var porMes = {}, orden = [], sem = 0;
  g.forEach(function (r) {
    var t = String(r[0]).trim(), m = t.match(/^(\d{2})\s*·/);
    if (m) { sem = +m[1]; return; }
    if (!sem || !/^POTENCIA/i.test(t)) return;
    var p = (norm(t).match(/\bP([1-4])\b/) || [])[1]; if (!p) return;
    var per = periodoMes_(sumarDias(base, (sem - 1) * 7));
    if (!porMes[per.etiqueta]) { porMes[per.etiqueta] = {}; orden.push(per.etiqueta); }
    porMes[per.etiqueta]['P' + p] = 1;
  });
  return orden.map(function (k) { return { mes: k, faltan: ['P1', 'P2', 'P3', 'P4'].filter(function (x) { return !porMes[k][x]; }) }; }).filter(function (x) { return x.faltan.length; });
}
/** ¿Cabe la 2.ª P integrada (R04) en el mejor hueco? Devuelve el motivo si NO cabe (decisión de Pablo 6/11 + manual §10.3). */
function motivoSinR04_(h, ctx, tipo, lunes) {
  if (metconDuro_(lunes) >= 2) return 'Fabrik ya trae ≥2 metcons de RPE ≥8 esta semana';
  if (!h) return 'no hay hueco';
  var malo = (h.choques || []).filter(function (c) { return /dura|48 h|pierna pesada|RPE|evento|recuperaci/.test(c); });
  if (malo.length) return malo.join('; ');
  var i = ctx.dias.map(function (d) { return d.iso; }).indexOf(h.iso), ant = ctx.dias[i - 1], sig = ctx.dias[i + 1];
  if (ant && (ant.rpe >= 8 || ant.duro)) return 'el día anterior es duro' + (ant.fabrikP ? ' (metcon tipo P de Fabrik)' : '');
  if (sig && (sig.rpe >= 8 || sig.duro)) return 'el día siguiente es duro' + (sig.fabrikP ? ' (metcon tipo P de Fabrik)' : '');
  return '';
}
/** v0.13 · Una vez (flag manual_v2 en APP · CONFIG): lleva a Google Calendar los tests movidos a enero y alinea la ciencia del catálogo con el manual. */
function aplicarManualV2_() {
  asegurarColumna_(HOJAS.SEMANAS, 'SIN REQUISITO SEMANAL'); asegurarColumna_(HOJAS.EVENTOS, 'MUY EXIGENTE');
  if (leerConfig_().manual_v2) return 'ya aplicado (' + leerConfig_().manual_v2 + ') · columnas de excepción listas';
  var n = 0;
  listar_(HOJAS.EVENTOS).filter(function (r) { return /^Test/i.test(r.EVENTO) && r['ORIGEN CAL'] !== 'Google'; }).forEach(function (r) { eventoACal_(r.ID); n++; });
  var CIEN = {
    R01: 'Manual v2.0 §14: cuatro intenciones (P1 potencia con fatiga local, P2 sprints repetidos, P3 contraste, P4 modelado en metcon), no protocolos validados tal cual. La fosfocreatina no se recupera entera en 80–105″ y en sprints repetidos crece el aporte aeróbico; las adaptaciones de transportadores e iones son específicas de cada protocolo y no se asumen sin medirlas [R37][R39][R40][R41].',
    R04: 'Manual v2.0 §14.1/§14.4: picos por encima de VT2 con pausa (P1) o con trabajo controlado (P4). El lactato se oxida como combustible mientras sigues trabajando; la fatiga es multifactorial (H⁺, fosfato, iones) [R42][R43]. Solo si cabe por volumen, intensidad y fatiga del día antes y después.'
  };
  listar_(HOJAS.ESTIMULOS).forEach(function (r) { var t = CIEN[r['CÓDIGO']]; if (t && r['CIENCIA (técnica · fisiología · biología)'] !== t) { actualizarFila_(HOJAS.ESTIMULOS, r._fila, { 'CIENCIA (técnica · fisiología · biología)': t }); } });
  ponerConfig_('manual_v2', ahora_(), 'Manual de rendimiento híbrido v2.0 aplicado (tests a enero en Calendar, ciencia del catálogo)');
  return n + ' tests actualizados en Google Calendar · catálogo alineado';
}
/**
 * v0.26 · Tu feedback de cada carrera decide las de la semana siguiente (se calcula al cargar la semana, no solo el domingo).
 * Criterio: adaptarse a ti sin dejar de progresar → se sube UNA variable cada vez (ritmo o volumen, nunca las dos), solo con señales claras de margen;
 * con señales de exceso se repite o se baja un punto; sin feedback no se progresa a ciegas; tras 3 semanas subiendo, una de consolidación.
 */
function ajusteCarrera_(lunesRef) {
  var lunes = lunesRef ? lunesDe_(lunesRef) : lunesDe_(hoyIso_()), n = function (v) { return parseFloat(String(v || '').replace(',', '.')) || 0; };
  var todas = listar_(HOJAS.CARRERA), de = function (l) { return todas.filter(function (r) { var d = celdaIso_(r.FECHA); return d >= l && d <= sumarDias(l, 6); }); };
  var car = de(lunes), aj = {};
  var sinFb = function (r) { return !n(r.RPE) && !r.PIERNAS && !r.MARGEN && !r['PARCIALES CUMPLIDOS']; };
  var exceso = function (r) { return n(r.RPE) >= 9 || /pas[eé]/i.test(r.MARGEN || '') || r['PARCIALES CUMPLIDOS'] === 'No' || (/Ahogado/i.test(r['RESPIRACIÓN'] || '') && !/Z5|Z6|Test/i.test(r.TIPO)); };
  var margen = function (r) { return /^S[ií]/i.test(r.MARGEN || '') && n(r.RPE) && n(r.RPE) <= 7 && r['PARCIALES CUMPLIDOS'] !== 'No' && !/Cargadas/i.test(r.PIERNAS || ''); };
  var racha = function (re) { var k = 0; for (var w = 1; w <= 3; w++) { var a = de(sumarDias(lunes, -7 * w)).filter(function (r) { return re.test(r.TIPO); }); if (a.length && a.every(margen)) k++; else break; } return k; };
  // calidad (Z4 / Z5 / test)
  var cal = car.filter(function (r) { return /Z4|Z5|Test/i.test(r.TIPO); });
  if (cal.length) {
    if (cal.some(sinFb)) aj.calidad = 'falta tu feedback de la calidad anterior: repito la dosis (no progreso a ciegas). Apunta RPE, piernas, respiración y si podías más.';
    else if (cal.some(exceso)) aj.calidad = 'la última calidad fue demasiado (parciales sin cumplir, RPE ≥9 o «me pasé»): misma sesión con 1 repetición menos y el ritmo en el extremo lento del rango. Cumplir todas las repeticiones vale más que una rápida.';
    else if (cal.every(margen)) { var rc = racha(/Z4|Z5|Test/i);
      aj.calidad = rc >= 2 ? 'tres semanas con margen: esta toca CONSOLIDAR (misma dosis y ritmo) para asimilar antes de volver a subir.' :
        cal.some(function (r) { return /volumen/i.test(r.MARGEN || ''); }) ? 'cumpliste con margen de volumen: +1 repetición (o +1 km de trabajo) al MISMO ritmo. Solo sube una variable.' :
        'cumpliste con margen de ritmo: mismas repeticiones 2–3″/km más rápido (extremo rápido del rango). Solo sube una variable.'; }
    else aj.calidad = 'la calidad salió justa: se repite la dosis hasta que salga con margen (RPE ≤7 y parciales cumplidos).';
    if (cal.some(function (r) { return /Cargadas/i.test(r.PIERNAS || ''); })) aj.calidad += ' Llegaste con las piernas cargadas: la coloco a ≥24 h de pierna pesada y sin metcon duro la víspera.';
  }
  // Z2
  var z2 = car.filter(function (r) { return /^Z2/i.test(r.TIPO); }), fcObj = 149, z2fc = z2.filter(function (r) { return n(r['FC MEDIA']); });
  if (z2.length) {
    var partes = [], larga = z2.filter(function (r) { return /larga/i.test(r.TIPO) || segundos_(r.TIEMPO) >= 50 * 60; });
    var calor = z2.some(function (r) { return n(r['TEMPERATURA (°C)']) >= 24 || n(r['HUMEDAD (%)']) >= 70; });
    if (calor) partes.push('hizo calor o mucha humedad: la FC alta de la Z2 se explica por eso, no se toca el ritmo.');
    if (!calor && z2fc.length && z2fc.reduce(function (a, r) { return a + n(r['FC MEDIA']); }, 0) / z2fc.length > fcObj + 5) partes.push('la FC media salió alta: 10–15″/km más lento para quedarte en ~' + fcObj + ' ppm (en Z2 manda el pulso, no el ritmo).');
    if (z2.some(function (r) { return n(r.RPE) >= 5 || /pas[eé]/i.test(r.MARGEN || '') || /Cargadas/i.test(r.PIERNAS || ''); })) { partes.push('la Z2 costó más de la cuenta (RPE ≥5, piernas cargadas o «me pasé»): mismos minutos, más suave, y la separo de la pierna pesada.'); aj.z2min = 0; }
    else if (larga.length && larga.every(function (r) { return n(r.RPE) && n(r.RPE) <= 3 && /^S[ií]/i.test(r.MARGEN || ''); }) && !partes.length) {
      if (racha(/^Z2/i) >= 2) partes.push('tres semanas subiendo la larga: esta se mantiene para consolidar.');
      else { partes.push('la larga salió cómoda y con margen: +5′ esta semana (máx. 75′, nunca más de un 10 %).'); aj.z2min = 5; } }
    if (z2.every(sinFb) && !partes.length) partes.push('sin feedback de la Z2 anterior: mismos minutos.');
    if (partes.length) aj.z2 = partes.join(' ');
  }
  // potencia Z6–Z8
  var pot = car.filter(function (r) { return /Z6/.test(r.TIPO); });
  if (pot.length) {
    if (/ca[ií]da\s*(\d+)/i.test(pot[0].NOTAS || pot[0].SENSACIONES || '') && +RegExp.$1 > 10) aj.potencia = 'caída de potencia >10 % (corte del manual §14.2): no progreses; repite la dosis y vigila que no cambie la mecánica.';
    else if (pot.some(exceso) && pot.some(function (r) { return /Cargadas/i.test(r.PIERNAS || ''); })) aj.potencia = 'llegaste cargado y fue RPE ≥9: 1 serie menos, misma intensidad (la potencia se entrena fresco).';
    else if (pot.every(margen)) aj.potencia = 'salió con margen: +1 serie o +1 repetición por serie (no las dos), misma recuperación.';
  }
  var reg = listar_(HOJAS.REGISTRO).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); });
  var no = reg.filter(function (r) { return r.HECHO === 'No'; }).length;
  if (no >= 3) { aj.z2 = (aj.z2 ? aj.z2 + ' ' : '') + 'Hubo ' + no + ' bloques sin hacer: semana conservadora, sin subir minutos.'; aj.z2min = 0; }
  if (!lunesRef) PROPS.setProperty('CARRERA_AJUSTE', JSON.stringify(aj));
  return aj;
}

// ---------- 6 · Refuerzos, edición de bloques, notas, WODs, avisos y petición a Claude ----------
function guardarRefuerzo_(b) {
  var t = String(b.texto || '').trim().slice(0, 200); if (!t) throw new Error('falta_texto');
  var cat = catalogo_(), c = codigoDeTexto_(t, cat);
  anadirFila_(HOJAS.REFUERZOS, { ID: nuevoId_(), SEMANA: isoAFecha(lunesDe_(b.lunes)), TEXTO: t, 'CÓDIGO': c, ESTADO: 'Pendiente', NOTAS: String(b.notas || '').slice(0, 500), CREADO: ahora_() });
}
function refuerzosDe_(lunes) { return listar_(HOJAS.REFUERZOS).filter(function (r) { return celdaIso_(r.SEMANA) === lunes; }); }
var CAMPOS_EDITABLES = ['FECHA', 'TURNO', 'ORDEN', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CÓDIGOS', 'CANTIDAD', 'POR QUÉ (cursiva)'];
function editarBloque_(b) {
  var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(b.id || ''); })[0];
  if (!x) throw new Error('no_encontrado');
  var o = permitidas_(b.campos || {}, CAMPOS_EDITABLES);
  var fabX = norm(x.ORIGEN) === 'FABRIK';
  if (fabX) o = permitidas_(o, ['FECHA', 'TURNO', 'ORDEN', 'CÓDIGOS', 'POR QUÉ (cursiva)', 'TÍTULO', 'CONTENIDO', 'MIN']);   // v0.11: también su contenido, y queda con candado
  // ¿Solo cambia de sitio? (lo demás llega igual que estaba) → lo aprobado sigue aprobado: moverlo es decisión tuya
  Object.keys(o).forEach(function (k) { if (CAMPOS_POSICION_.indexOf(k) < 0 && String(o[k]) === String(x[k] == null ? '' : x[k])) delete o[k]; });
  var soloMover = soloPosicion_(o);
  if (o.FECHA) { var iso = celdaIso_(o.FECHA); if (!iso) throw new Error('fecha_no_valida'); o.FECHA = isoAFecha(iso); o['DÍA'] = diaDe_(iso); }
  if (o.TURNO) o.TURNO = o.TURNO === 'AM' ? 'AM' : 'PM';
  if (o['TÍTULO']) o.BLOQUE = o['TÍTULO'];
  if (x.ESTADO === 'SIN HUECO' && o.FECHA) o.ESTADO = 'BORRADOR';
  if (x.ESTADO === 'PROGRAMADO' && !soloMover) o.ESTADO = 'BORRADOR';   // cambiar el CONTENIDO de lo aprobado se vuelve a aprobar (sigue contando en las metas)
  if (o['CÓDIGOS'] && /W07/.test(o['CÓDIGOS']) && !o.CANTIDAD && !(parseFloat(x.CANTIDAD) > 0)) o.CANTIDAD = saltosTexto_((o['TÍTULO'] || x['TÍTULO'] || '') + '\n' + (o.CONTENIDO || x.CONTENIDO || '')) || '';
  if (!fabX) o.GENERADO = 'manual ' + ahora_() + ' (candado)';   // lo que tocas a mano no lo vuelve a mover «Rehacer extras»
  else if (o.CONTENIDO != null || o['TÍTULO'] != null || o.MIN != null) o.GENERADO = 'manual ' + ahora_() + ' (editado · candado: la recarga de Fabrik no lo pisa)';
  o.ACTUALIZADO = ahora_();
  bloqueo_(function () { actualizarFila_(HOJAS.PLAN, x._fila, o); });
  return x.ID;
}
/** Quitar un bloque desde la hoja de la semana: los borradores se borran; lo programado pasa a «NO HACER» (y a pendientes si quieres). */
function quitarBloque_(b) {
  var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(b.id || ''); })[0];
  if (!x) throw new Error('no_encontrado');
  if (/^(BORRADOR|SIN HUECO)$/.test(x.ESTADO) && norm(x.ORIGEN) !== 'FABRIK') {
    if (b.pendiente && !x.PENDIENTE_ID) anadirPendiente_(x, b.motivo || (x.ESTADO === 'SIN HUECO' ? 'Sin hueco en la semana' : 'Quitado desde la hoja de la semana'));
    if (x.REFUERZO_ID) { var rz = listar_(HOJAS.REFUERZOS).filter(function (r) { return r.ID === x.REFUERZO_ID; })[0]; if (rz) actualizarFila_(HOJAS.REFUERZOS, rz._fila, { ESTADO: b.pendiente ? 'Pendiente' : 'Descartado' }); }
    if (x.PENDIENTE_ID) { var p = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ID === x.PENDIENTE_ID; })[0]; if (p) actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Pendiente', 'SEMANA DESTINO': '' }); }
    return borrarFila_(HOJAS.PLAN, x._fila, { ID: x.ID });
  }
  bloqueo_(function () { actualizarFila_(HOJAS.PLAN, x._fila, { ESTADO: 'NO HACER', ACTUALIZADO: ahora_() }); if (b.pendiente) anadirPendiente_(x, b.motivo || 'Quitado desde la hoja de la semana'); });
}
function guardarNotaBloque_(n) {
  var o = permitidas_(n, ['FECHA', 'ID_PLAN', 'BLOQUE', 'MIS NOTAS', 'RECOMENDACIÓN']);
  if (!o.FECHA || !o.ID_PLAN) throw new Error('faltan_datos');
  o.FECHA = isoAFecha(celdaIso_(o.FECHA)); o.ACTUALIZADO = ahora_();
  return bloqueo_(function () {
    var x = listar_(HOJAS.NOTAS).filter(function (r) { return celdaIso_(r.FECHA) === celdaIso_(o.FECHA) && r.ID_PLAN === o.ID_PLAN; })[0];
    if (x) actualizarFila_(HOJAS.NOTAS, x._fila, o); else { var sh = hojaMia_(HOJAS.NOTAS), cab = cabeceras_(sh); sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]); }
    return o;
  });
}
function guardarWod_(w) {
  var o = permitidas_(w, ['NOMBRE', 'TIPO', 'FECHA ORIGEN', 'CONTENIDO', 'RESULTADO', 'NOTAS']);
  if (!o.NOMBRE || !o.CONTENIDO) throw new Error('faltan_datos');
  o.NOMBRE = o.NOMBRE.toUpperCase().slice(0, 80); o.TIPO = o.TIPO === 'Referencia' ? 'Referencia' : 'Guardado';
  return bloqueo_(function () {
    var x = w.ID ? listar_(HOJAS.WODS).filter(function (r) { return r.ID === String(w.ID); })[0] : null;
    if (x) { actualizarFila_(HOJAS.WODS, x._fila, o); return x.ID; }
    o.ID = nuevoId_(); o.CREADO = ahora_();
    var sh = hojaMia_(HOJAS.WODS), cab = cabeceras_(sh); sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
}
function borrarWod_(id) { var x = listar_(HOJAS.WODS).filter(function (r) { return r.ID === String(id); })[0]; if (!x) throw new Error('no_encontrado'); borrarFila_(HOJAS.WODS, x._fila, { ID: x.ID }); }
function avisoVisto_(id) {
  var v = String(leerConfig_().avisos_vistos || '').split(',').filter(Boolean);
  if (v.indexOf(String(id)) < 0) v.push(String(id).slice(0, 40));
  ponerConfig_('avisos_vistos', v.slice(-60).join(','), 'Avisos de tests/competiciones que ya has visto: solo salen en el calendario y en Menú › Avisos');
}
function pedirClaude_(b) {
  var lunes = lunesDe_(b.lunes);
  anadirFila_(HOJAS.CAMBIOS, { ID: nuevoId_(), CREADO: ahora_(), DESDE: isoAFecha(lunes), 'TURNO DESDE': 'AM', EVENTO: 'Programar extras · semana del ' + isoAFecha(lunes),
    AFECTA: 'Extras de la semana (no me convence la propuesta automática)', NOTAS: String(b.notas || '').slice(0, 1500), ESTADO: 'Solicitada' });
}

// ---------- 7 · Grabación: ideas de «Reels de datos» que encajan con cada bloque + stories ----------
var CLAVES_REEL = [
  [/PLIOMETR|SALTO|EXPLOSIV/, /BOX JUMP|BROAD JUMP|POGO|SQUAT JUMP|COUNTERMOVEMENT|JUMP/], [/REMO\b|REMOERG|ROWERG/, /ROW/], [/ARRANCADA|SNATCH/, /SNATCH/], [/CARGADA|\bCLEAN/, /CLEAN/],
  [/HALTEROFILIA|LEVANTAMIENTO/, /SNATCH|CLEAN|JERK/], [/MOLETEADO|BARRA/, /BACK SQUAT|FRONT SQUAT|DEADLIFT/], [/PULSACIONES|FATIGA/, /SNATCH|CLEAN/], [/70 ?%|POTENCIA/, /POWER (CLEAN|SNATCH)/],
  [/CARRERA|CORRER/, /\bRUN\b|CARRERA|Z2/], [/HSPU|PINO|INVERTID/, /HSPU|HANDSTAND|HSWALK/], [/ANILLAS|MUSCLE/, /MUSCLE UP|RMU|RING/], [/COMBA|DOBLES/, /DOUBLE UNDER|\bDU\b|CROSSOVER/]
];
function ideasReels_() {
  var c = CacheService.getScriptCache(), v = c.get('reels_v1'); if (v) return JSON.parse(v);
  var out = [];
  try {
    SpreadsheetApp.openById(CONFIG.REELS_ID).getSheets().forEach(function (sh) {
      if (!/Entrenamiento|Competici|Alimentaci/i.test(sh.getName())) return;
      var g = sh.getDataRange().getDisplayValues(), cab = (g[0] || []).map(function (h) { return norm(h).trim(); }), col = function (k) { return cab.findIndex(function (h) { return h.indexOf(k) === 0; }); };
      var cE = col('ESTADO'), cI = col('IDEA'), cA = col('TU APUNTE'), cB = col('BALANZA'), cF = col('FORMATO'), cH = col('HOOK'), cM = col('MATERIAL'), cL = col('LO QUE FALTA');
      g.slice(1).forEach(function (r) {
        if (!r[cI] || /PUBLICADO/.test(norm(r[cE])) || /EN CONTRA/.test(norm(r[cB]))) return;
        var txt = norm([r[cI], r[cA], r[cM], r[cL]].join(' '));
        var res = CLAVES_REEL.filter(function (k) { return k[0].test(txt); }).map(function (k) { return k[1].source; });
        if (!res.length) return;
        var ang = (String(r[cM] || '') + ' ' + String(r[cL] || '')).match(/c[aá]mara[^.;\n]*/i);
        out.push({ idea: r[cI], formato: r[cF] || '', hook: r[cH] || '', re: res.join('|'), metcon: /PULSACIONES|FATIGA|WOD/.test(txt), angulo: ang ? ang[0] : '' });
      });
    });
  } catch (e) { return []; }
  try { c.put('reels_v1', JSON.stringify(out), 3600); } catch (e) {}
  return out;
}
var ANGULO_TIPO = {
  haltero: 'Lateral 45° a la altura de la cadera, a 3–4 m, barra y discos enteros en plano; graba la serie más pesada.',
  fuerza: 'Lateral puro a la altura de la rodilla para ver profundidad y trayectoria; trípode fijo.',
  gimnasticos: 'Frontal o lateral completo desde 4–5 m, con la barra/anillas y el suelo en plano.',
  metcon: 'Plano general fijo desde una esquina, todas las estaciones en cuadro.',
  carrera: 'Lateral bajo en paralelo (5–10 s) o el reloj al acabar el intervalo.',
  otro: 'Plano medio lateral.'
};
function grabacionSemana_(sem) {
  var ideas = ideasReels_(), out = {};
  var mira = function (iso, id, titulo, txt, tipo, wod) {
    var t = norm(titulo + '\n' + txt), met = tipo === 'metcon', l = [];
    ideas.forEach(function (i) { if ((i.metcon && !met) || !new RegExp(i.re).test(t)) return; l.push({ idea: i.idea, formato: i.formato, hook: i.hook, angulo: i.angulo || ANGULO_TIPO[tipo] || ANGULO_TIPO.otro }); });
    var story = null;
    if (tipo === 'haltero' || met) {
      var mat = String((wod && wod.material) || '').replace(/\s*\/\s*/g, ', ');
      story = met ? { tipo: 'Story · metcon', angulo: ANGULO_TIPO.metcon, materiales: (mat ? 'Coloca ' + mat.toLowerCase() + ' en línea respecto a la cámara, en el orden del WOD, para que se vean las transiciones. ' : '') + '3 clips de 3 s: inicio, mitad y último minuto; o time-lapse del WOD entero.' }
        : { tipo: 'Story · haltero', angulo: ANGULO_TIPO.haltero, materiales: 'Barra centrada, discos de colores visibles y nada delante; graba en 60 fps para cámara lenta de la recepción.' };
    }
    if (l.length || story) out[iso + '|' + id] = { reels: l.slice(0, 2), story: story };
  };
  ((sem.fabrik && sem.fabrik.dias) || []).forEach(function (d) {
    d.bloques.forEach(function (b) { if (b.n) mira(d.iso, b.n, b.titulo, textoBloque_(b), tipoBloque_(b), b.wod); });
  });
  (sem.plan || []).forEach(function (r) { if (norm(r.ORIGEN) !== 'FABRIK') mira(celdaIso_(r.FECHA), r.ID, r['TÍTULO'], r.CONTENIDO, /CARRERA|Z6/.test(norm(r.ORIGEN)) ? 'carrera' : 'otro', null); });
  return out;
}

// ---------- 8 · Google Calendar (calendario principal) ----------
var MARCA_CAL = '[Road To Elite]';
function calendario_() { return CalendarApp.getDefaultCalendar(); }
function eventoACal_(id) {
  try {
    var x = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(id); })[0];
    if (!x || x['ORIGEN CAL'] === 'Google') return;
    var cal = calendario_(), i = celdaIso_(x.INICIO), f = celdaIso_(x.FIN) || i; if (!i) return;
    var desc = MARCA_CAL + ' ' + x.ID + '\nBloquea: ' + (x.BLOQUEA || '—') + '\n' + (x['CÓMO PROCEDER'] || '') + (x.NOTAS ? '\n' + x.NOTAS : '');
    var ev = x.GCAL_ID ? (function () { try { return cal.getEventById(x.GCAL_ID); } catch (e) { return null; } })() : null;
    var hora = String(x.HORA || '').match(/^(\d{1,2}):(\d{2})/);
    var d0 = new Date(i + 'T12:00:00Z'), d1 = new Date(sumarDias(f, 1) + 'T12:00:00Z');
    var ini = hora ? new Date(i + 'T' + ('0' + hora[1]).slice(-2) + ':' + hora[2] + ':00') : null;
    if (ev) { ev.setTitle(x.EVENTO); ev.setDescription(desc); if (hora) ev.setTime(ini, new Date(ini.getTime() + 3600e3)); else ev.setAllDayDates(d0, d1); }
    else {
      ev = hora ? cal.createEvent(x.EVENTO, ini, new Date(ini.getTime() + 3600e3), { description: desc, location: x.LUGAR || '' }) : cal.createAllDayEvent(x.EVENTO, d0, d1, { description: desc, location: x.LUGAR || '' });
      actualizarFila_(HOJAS.EVENTOS, x._fila, { GCAL_ID: ev.getId(), 'ORIGEN CAL': 'App' });
    }
  } catch (e) { Logger.log('Calendar: ' + e); }
}
function borrarDeCal_(x) { try { if (x.GCAL_ID && x['ORIGEN CAL'] !== 'Google') { var ev = calendario_().getEventById(x.GCAL_ID); if (ev) ev.deleteEvent(); } } catch (e) {} }
/** Cada hora: lo que pongas en tu Google Calendar con INSTAGRAM o CROSSFIT en el título entra en la app («Por decidir»). */
function sincronizarCalendario() { return conSalud_('sincronizarCalendario', sincronizarCalendario_sin_); }
function sincronizarCalendario_sin_() {
  var hoy = hoyIso_(), desde = new Date(sumarDias(hoy, -7) + 'T00:00:00Z'), hasta = new Date(sumarDias(hoy, 120) + 'T00:00:00Z');
  var evs = calendario_().getEvents(desde, hasta).filter(function (e) { return /INSTAGRAM|CROSSFIT/i.test(e.getTitle()) && String(e.getDescription() || '').indexOf(MARCA_CAL) < 0; });
  var filas = listar_(HOJAS.EVENTOS), porG = {}; filas.forEach(function (r) { if (r.GCAL_ID) porG[r.GCAL_ID] = r; });
  var vistos = {};
  evs.forEach(function (e) {
    var id = e.getId(); vistos[id] = 1;
    var ini = e.isAllDayEvent() ? e.getAllDayStartDate() : e.getStartTime(), fin = e.isAllDayEvent() ? new Date(e.getAllDayEndDate().getTime() - 864e5) : e.getEndTime();
    var o = { EVENTO: e.getTitle(), TIPO: /CROSSFIT/i.test(e.getTitle()) ? 'Competición' : 'Personal', INICIO: Utilities.formatDate(ini, CONFIG.ZONA, 'dd/MM/yyyy'), FIN: Utilities.formatDate(fin, CONFIG.ZONA, 'dd/MM/yyyy'),
      HORA: e.isAllDayEvent() ? '' : Utilities.formatDate(ini, CONFIG.ZONA, 'HH:mm'), LUGAR: e.getLocation() || '' };
    var x = porG[id];
    if (x) { var cambia = ['EVENTO', 'INICIO', 'FIN', 'HORA', 'LUGAR'].some(function (k) { return String(x[k]) !== String(o[k]); }); if (cambia) actualizarFila_(HOJAS.EVENTOS, x._fila, o); return; }
    // Solo entra con tu aprobación (aviso en la app y en el informe del domingo); hasta entonces no cuenta para nada
    anadirFila_(HOJAS.EVENTOS, Object.assign(o, { ID: nuevoId_(), BLOQUEA: '', ESTADO: 'Pendiente de aprobar', NOTAS: 'Desde Google Calendar', CREADO: ahora_(), GCAL_ID: id, 'ORIGEN CAL': 'Google' }));
    if (pushActivo_()) enviarPush_('Nuevo en tu Google Calendar', o.EVENTO + ' (' + o.INICIO + '): ¿lo añado a Road To Elite?');
  });
  MEMO = null;
  listar_(HOJAS.EVENTOS).filter(function (r) { return r['ORIGEN CAL'] === 'Google' && !vistos[r.GCAL_ID] && celdaIso_(r.INICIO) >= sumarDias(hoy, -7); })
    .sort(function (a, b) { return b._fila - a._fila; }).forEach(function (r) { borrarFila_(HOJAS.EVENTOS, r._fila, { ID: r.ID }); });
}
/** Una vez: sube a Google Calendar los eventos de la app que aún no estén. */
function subirEventosACal_() { listar_(HOJAS.EVENTOS).forEach(function (r) { if (!r.GCAL_ID && r['ORIGEN CAL'] !== 'Google' && celdaIso_(r.FIN || r.INICIO) >= hoyIso_()) eventoACal_(r.ID); }); }

// ---------- 9 · Menú del Sheet (carga manual) ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Road To Elite')
    .addItem('Cargar Fabrik · semana siguiente', 'menuCargarFabrikSiguiente').addItem('Cargar Fabrik · esta semana', 'menuCargarFabrikActual')
    .addItem('Cargar extras · semana siguiente', 'menuExtrasSiguiente').addSeparator()
    .addItem('Semana en bloques · actualizar', 'menuSemanaBloques').addItem('Enviar por correo los estímulos de la semana', 'menuEnviarResumen').addSeparator()
    .addItem('Motor · analizar WODs de Fabrik ahora', 'menuMotorAhora').addItem('Motor · explicar con Gemini (8)', 'menuGemini')
    .addItem('Competis · actualizar desde la app de Gabi', 'menuCompetis').addItem('Lesiones · completar con IA (Gemini)', 'menuLesionesIA').addItem('Estímulos en bloques (incentivar)', 'menuEstimulosBloques').addItem('Aprendizaje · analizar la semana y generar preguntas', 'menuAprendizaje').addItem('Backup completo ahora', 'menuBackupAhora').addItem('Vídeos · revisar enlaces ahora', 'menuRevisarVideos').addItem('Motor · KNOWLEDGE + aprender del ciclo ahora', 'menuAprenderCiclo').addItem('Agente del PC · ver token', 'menuTokenAgente').addItem('Agente del PC · cambiar token (PC perdido)', 'menuNuevoTokenAgente')
    .addItem('Base de datos WODs · token de lectura para otras apps', 'menuTokenBd').addToUi();
}
function menuCargarFabrikSiguiente() { SpreadsheetApp.getActive().toast(JSON.stringify(cargarFabrikSemana_(sumarDias(lunesDe_(hoyIso_()), 7)))); }
function menuCargarFabrikActual() { SpreadsheetApp.getActive().toast(JSON.stringify(cargarFabrikSemana_(lunesDe_(hoyIso_())))); }
function menuExtrasSiguiente() { SpreadsheetApp.getActive().toast(generarExtras_(sumarDias(lunesDe_(hoyIso_()), 7)).resumen); }

/** Lo nuevo que acompaña a la semana en cada respuesta. */
function extrasSemana_(lunes, base) {
  var out = { refuerzos: [], notasBloque: [], grabacion: {}, avisosVistos: String(leerConfig_().avisos_vistos || '').split(',').filter(Boolean),
    enduranceManana: enduranceManana_(),
    eventosPorAprobar: listar_(HOJAS.EVENTOS).filter(function (r) { return r.ESTADO === 'Pendiente de aprobar'; }),
    fabrikCargado: (base.plan || []).some(function (r) { return norm(r.ORIGEN) === 'FABRIK'; }), extras: leerConfig_()['extras_' + lunes] || '', competisPreguntas: preguntasCompetis_(), videosVer: String(leerConfig_().videos_version || ''), extrasParcial: (function () { try { return JSON.parse(leerConfig_()['extras_parcial_' + lunes] || 'null'); } catch (e) { return null; } })(),
    fabrikDias: (base.plan || []).filter(function (r) { return norm(r.ORIGEN) === 'FABRIK'; }).map(function (r) { return celdaIso_(r.FECHA); }).filter(function (x, i, l) { return x && l.indexOf(x) === i; }) };
  try { out.refuerzos = refuerzosDe_(lunes); out.refuerzosSig = refuerzosDe_(sumarDias(lunes, 7)); } catch (e) {}
  try { out.notasBloque = listar_(HOJAS.NOTAS).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); }); } catch (e) {}
  try { out.grabacion = grabacionSemana_(base); } catch (e) {}
  return out;
}

// ===================== v0.11 · BIBLIOTECA: Z6–Z8 LIGADOS A TUS CARENCIAS Y ALTERNATIVAS DE LA SESIÓN Q =====================
/**
 * APP · BIBLIOTECA (editable): cada fila es una sesión concreta.
 *  · Z6–Z8: variantes de los 4 protocolos de la guía (P1 híbrido · P2 RSA · P3 contraste aláctico · P4 modelado en metcon).
 *    El plan de carrera dice QUÉ protocolo toca cada semana; aquí se elige la VARIANTE que más ataca tus carencias
 *    (metas con más peso y menos cubiertas) y se ajusta la dosis al metcon de Fabrik de esa semana.
 *  · CALIDAD Z4 / Z5: alternativas a la sesión Q para adaptarla a la gente con la que corres.
 * CARENCIAS = códigos de metas que además cubre la sesión (cuentan en las metas). R01 = Z6–Z8; R02/R03 = calidad Z4/Z5.
 */
ESQUEMA['APP · BIBLIOTECA'] = {
  cab: ['ID', 'TIPO', 'PROTOCOLO', 'NOMBRE', 'CONTENIDO', 'ATACA (qué mejora)', 'CARENCIAS (códigos)', 'DÓNDE VA EN LA SESIÓN', 'CIENCIA (fisiología · biología)', 'SEMANA DURA (dosis)', 'GRUPO', 'ALTERNATIVA', 'EVITAR', 'REGISTRA', 'FUENTES', 'ACTIVO'],
  anchos: [60, 90, 80, 260, 320, 280, 120, 280, 360, 220, 60, 80, 220, 200, 220, 60], negrita: 'NOMBRE', congelarCol: 4,
  listas: { TIPO: ['Z6–Z8', 'CALIDAD Z4', 'CALIDAD Z5'], GRUPO: ['Sí', 'No'], ACTIVO: ['Sí', 'No'] },
  colores: [['ACTIVO', '^No$', '#5a5a5a', '#ffffff'], ['TIPO', 'Z6', '#fde8e8'], ['TIPO', 'Z4', '#fff2e0'], ['TIPO', 'Z5', '#ffe9d6']]
};
HOJAS.BIBLIOTECA = 'APP · BIBLIOTECA';
var FUENTE_GUIA_ = 'Manual de rendimiento híbrido v2.0 (§14)';
var BIBLIO_BASE_ = [
  // ---------------- P1 · Z6 HÍBRIDO (desoxigenación) ----------------
  ['P1A', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · bike + wall ball + jumping lunges',
    'EVERY 4′ × 4 RONDAS (5 en semanas avanzadas)\n40–50″ al 90–95 %:\n12/10 cal ASSAULT BIKE (pico de vatios)\n10 WALL BALL (9 kg)\n10 JUMPING LUNGES\nResto de los 4′: Z1 muy suave\n\nREGLA: si las calorías caen más de 2 de la 1.ª a la última ronda, corta.',
    'Seguir produciendo potencia cuando el cuádriceps ya está ácido: lo que te pasa en la 3.ª–4.ª ronda de un metcon con bici y wall balls.',
    'R01|W07', 'PM, como metcon del día o detrás de fuerza moderada de tren superior. ≥48 h de la calidad de carrera y ≥6 h de la Z2.',
    'La bici dispara la glucólisis y empieza a vaciar de O₂ el músculo; wall balls y saltos aprietan el cuádriceps (oclusión mecánica) bajo acidez y obligan a extraer más O₂ por latido. La pausa larga rellena la fosfocreatina. Adaptación: más transportadores de lactato MCT1/MCT4, más capacidad tampón y mejor extracción periférica.',
    '3 rondas en vez de 4 si Fabrik ya trae ≥2 metcons de RPE ≥8 esa semana.', 'No', 'P1B', 'Víspera de calidad de carrera o de pierna pesada; justo después de un metcon largo.', 'calorías por ronda, tiempo de cada ronda, RPE', FUENTE_GUIA_ + '; Buchheit & Laursen 2013'],
  ['P1B', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · bike + HSPU + DU',
    'EVERY 4′ × 4 RONDAS\n40–50″ al 90–95 %:\n12/10 cal ASSAULT BIKE\n6–8 KIPPING HSPU\n30 DOUBLE UNDERS\nResto de los 4′: Z1 muy suave\n\nREGLA: HSPU sin fallo; si una ronda tiene 2 fallos, la siguiente baja a 5.',
    'HSPU que se rompen con las pulsaciones a tope (tu prioridad P1) y comba en fatiga.',
    'R01|W31|W07', 'PM, como metcon del día. No el día de jerk ni de HSPU estricto pesado.',
    'La bici sube el lactato y la FC; los HSPU obligan al hombro a producir fuerza con el sistema cardiovascular al límite (fatiga central + periférica), igual que en competición. Con ~2′ de pausa se recarga la fosfocreatina: practicas la técnica bajo acidez sin degradarla.',
    '3 rondas y 5 HSPU si la semana de Fabrik va cargada de hombro.', 'No', 'P1A', 'Hombro marcado como cargado en el chequeo; día antes de jerk/press pesado.', 'HSPU por ronda, fallos, calorías', FUENTE_GUIA_],
  ['P1C', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · ski + trineo + burpee broad jump',
    'EVERY 4′ × 4 RONDAS\n40–50″ al 90–95 %:\n12/10 cal SKIERG\n15 m SLED PUSH (pesado, sin parar)\n6 BURPEE BROAD JUMPS\nResto de los 4′: Z1 muy suave',
    'Transiciones tipo HYROX y empuje de trineo con ácido; arranques explosivos cansado.',
    'R01|M38|W07', 'PM, en un día sin pierna pesada en Fabrik.',
    'El SkiErg recluta dorsal y core (tren superior) y el trineo es extensión de cadera casi sin fase excéntrica: mucha potencia con poco daño muscular, así que no lastra la carrera del día siguiente.',
    '3 rondas si la semana es dura.', 'No', 'P1A', 'Lumbar cargada.', 'calorías, tiempo del trineo, RPE', FUENTE_GUIA_],
  ['P1D', 'Z6–Z8', 'P1', 'P1 · Z6 híbrido · bike + C2B + heavy rope',
    'EVERY 4′ × 4 RONDAS\n40–50″ al 90–95 %:\n12/10 cal ASSAULT BIKE\n6–8 CHEST TO BAR\n20 HEAVY ROPE SINGLE UNDERS (o 10 heavy rope DU)\nResto de los 4′: Z1 muy suave',
    'C2B en fatiga (meta mensual) y comba pesada, con la bici como acelerador del lactato.',
    'R01|M01|M33', 'PM, como metcon. No el día de muscle ups o tirón pesado.',
    'La fatiga del agarre y del dorsal llega con acidez sistémica: entrenas la eficiencia del kipping cuando el cuerpo ya no tiene margen. La comba pesada añade trabajo de hombro y antebrazo con poco impacto.',
    '3 rondas si el agarre viene tocado.', 'No', 'P1B', 'Agarre/antebrazo marcado como cargado.', 'C2B por ronda, calorías', FUENTE_GUIA_],
  // ---------------- P2 · RSA Z7–Z8 ----------------
  ['P2A', 'Z6–Z8', 'P2', 'P2 · RSA · Assault/BikeErg 6×15″',
    '10′ de descanso tras la barra\n5′ AIR BIKE / BIKEERG fácil + 2 aceleraciones de 5″\n6 × 15″ ALL-OUT (8 × en semanas avanzadas)\n/ 1′45″ pasivo o Z1 muy suave\n5′ suaves\n\nREGISTRA: W pico y W medio de cada sprint. Índice de fatiga = caída de W del 1.º al último (objetivo <15 %).',
    'Repetir el pico: que tu 6.º esfuerzo se parezca al 1.º. Es tu limitante (la potencia cae tras las primeras rondas).',
    'R01', 'Al final de una sesión de haltero o cadena posterior, 10′ después de la barra. Puede ir el mismo día que una Z2 de mañana (≥6 h).',
    'El 1.er sprint sale de fosfocreatina + glucólisis; con descanso incompleto la mitocondria tiene que rellenar la fosfocreatina, así que los sprints repetidos son también un estímulo aeróbico potente. Más MCT1/MCT4, mejor bomba Na⁺/K⁺ y más tampón. En bici no hay fase excéntrica: no compromete la carrera.',
    '5 sprints si Fabrik ya trae ≥2 metcons de RPE ≥8.', 'No', 'P2B', 'Antes del haltero o después de un metcon largo.', 'W pico/medio por sprint, % de caída', FUENTE_GUIA_ + '; Bishop, Girard & Mendez-Villanueva 2011'],
  ['P2B', 'Z6–Z8', 'P2', 'P2 · RSA · SkiErg 6×12″',
    '5′ SKIERG fácil + 2 aceleraciones\n6 × 12″ ALL-OUT SKIERG / 1′30″ pasivo\n5′ suaves\n\nREGISTRA: vatios pico y medio por sprint.',
    'Lo mismo que el P2 en bici pero cargando tren superior y core: úsalo si el chequeo marca cuádriceps/gemelo cargados o hay carrera al día siguiente.',
    'R01', 'Al final de una sesión de pierna o de haltero, 10′ tras la barra.',
    'Misma lógica de sprints repetidos (fosfocreatina → resíntesis mitocondrial) con la pierna casi descargada. Transfiere a las calorías de ski de los metcons y al tirón de los gimnásticos.',
    '5 sprints si la semana es dura.', 'No', 'P2A', 'Dorsal/hombro cargados.', 'W pico/medio por sprint', 'Bishop, Girard & Mendez-Villanueva 2011'],
  ['P2C', 'Z6–Z8', 'P2', 'P2 · RSA · cuestas 6×10″',
    '10′ trote + 3 progresivos\n6–8 × 10–12″ CUESTA (6–8 %) a tope / bajar andando (~1′40″)\n8′ suaves',
    'Potencia de zancada y economía de carrera. Encaja si sales a correr con el grupo y hay una cuesta.',
    'R01', 'PM o tras la Z2 corta, nunca la víspera de la calidad. Lejos de pierna pesada.',
    'Sprint aláctico-láctico corto con alto reclutamiento de fibras rápidas; la cuesta reduce la fase de frenado (menos daño excéntrico que el sprint en llano) y mejora la rigidez del tendón y la economía de carrera.',
    '6 repeticiones máximo en semana dura.', 'Sí', 'P2A', 'Gemelo/Aquiles marcados como cargados.', 'tiempo o metros por repetición, RPE', 'Bishop, Girard & Mendez-Villanueva 2011'],
  ['P2D', 'Z6–Z8', 'P2', 'P2 · RSA · remo 6×15″',
    '5′ remo fácil\n6 × 15″ ALL-OUT ROWERG / 1′45″ pasivo\n5′ suaves\n\nREGISTRA: vatios pico y medio, ritmo /500 m.',
    'Sprints repetidos específicos de HYROX y de los «max cal row» de los metcons.',
    'R01', 'Al final de una sesión de haltero, 10′ tras la barra.',
    'Combina tren superior e inferior sin impacto; misma resíntesis de fosfocreatina entre sprints que la bici.',
    '5 sprints si la semana es dura.', 'No', 'P2A', 'Lumbar cargada.', 'W pico/medio', 'Bishop, Girard & Mendez-Villanueva 2011'],
  // ---------------- P3 · CONTRASTE Z8 ALÁCTICO ----------------
  ['P3A', 'Z6–Z8', 'P3', 'P3 · Contraste · power snatch/clean + sprint',
    'Tras el calentamiento de haltero de Fabrik\n4–5 RONDAS:\n2 POWER SNATCH o POWER CLEAN 40–50 % (máxima velocidad de barra)\n→ 60″\n10–12″ SKIERG o SLED SPRINT ligero al 100 %\n→ 2–3′ de descanso completo\n\nREGLA: si baja la velocidad, se corta. Sin ácido, sin jadeo: es neural.',
    'Velocidad de reclutamiento: que la barra «suba sola» con el mismo % (barbell cycling, T&G) y arranques más explosivos.',
    'R01', 'Al principio: justo después del calentamiento de haltero y ANTES de la fuerza o halterofilia de Fabrik. Vale en semanas de descarga y a ≥72 h de un test.',
    'Esfuerzos <10–12″ se alimentan de ATP y fosfocreatina sin acumular lactato. La potenciación (PAPE) del levantamiento rápido hace que el sprint salga más potente. Adaptación neural: más unidades motoras a la vez, mayor frecuencia de disparo, mejor coordinación. 2–3′ para tener la fosfocreatina llena en cada ronda.',
    'Es la variante que menos fatiga: se mantiene aunque la semana sea dura.', 'No', 'P3B', 'Nunca después de un metcon.', 'kg, velocidad percibida, metros/calorías del sprint', FUENTE_GUIA_],
  ['P3B', 'Z6–Z8', 'P3', 'P3 · Contraste francés + sprint (pierna)',
    '4 RONDAS:\n2 BACK SQUAT 85 %\n→ 20″\n3 BOX JUMPS (altos, bajando del cajón)\n→ 20″\n3 DB JUMP SQUATS (2×10 kg)\n→ 20″\n3 BAND-ASSISTED JUMPS (o saltos verticales rápidos)\n→ 60″\n8″ BIKE SPRINT al 100 %\n→ 3′ de descanso',
    'Potencia de pierna con los cuatro estímulos del contraste francés (meta mensual) y arranque explosivo.',
    'R01|M52|W07', 'Al principio de la sesión, tras calentar, en lugar del bloque de fuerza de pierna o antes del haltero. Nunca tras metcon.',
    'Fuerza pesada → pliometría sin carga → salto balístico con carga ligera → salto asistido: recorre toda la curva fuerza-velocidad y aprovecha la potenciación de cada estímulo sobre el siguiente. Todo aláctico (fosfocreatina) con descanso completo.',
    'Se mantiene 4 rondas; si la pierna viene muy cargada, 3.', 'No', 'P3A', 'Pierna marcada ≥7 de agujetas; día antes de calidad.', 'kg de la sentadilla, altura del cajón, sensaciones de velocidad', 'Contraste francés (Cometti); ' + FUENTE_GUIA_],
  ['P3C', 'Z6–Z8', 'P3', 'P3 · Aláctico tren superior · HSPU reactivo + ski',
    '5 RONDAS:\n3 KIPPING HSPU explosivos (máxima velocidad, reinicio controlado)\n→ 60″\n10″ SKIERG al 100 %\n→ 2′30″ de descanso',
    'HSPU kipping técnico/reactivo (meta semanal P1) con potencia de tren superior.',
    'R01|W15', 'Al principio de la sesión, con el hombro fresco. No el día de HSPU estricto pesado.',
    'Ciclo estiramiento-acortamiento del tren superior a máxima velocidad: adaptación neural del empuje sin fatiga glucolítica. El sprint de ski aprovecha la potenciación del tren superior.',
    'Se mantiene: no fatiga.', 'No', 'P3A', 'Hombro cargado.', 'HSPU limpios, vatios del ski', FUENTE_GUIA_],
  ['P3D', 'Z6–Z8', 'P3', 'P3 · Contraste · push jerk rápido + trineo',
    '5 RONDAS:\n2 PUSH JERK 50–60 % (máxima velocidad)\n→ 60″\n10″ SLED PUSH ligero al 100 %\n→ 2–3′ de descanso',
    'Drive del jerk más rápido y empuje explosivo de trineo.',
    'R01|M38', 'Al principio, antes de la halterofilia de Fabrik.',
    'Mismo contraste aláctico (PAPE) con el patrón de empuje vertical + extensión de cadera.',
    'Se mantiene.', 'No', 'P3A', 'Hombro o lumbar cargados.', 'kg, metros del trineo', FUENTE_GUIA_],
  // ---------------- P4 · MODELADO EN METCON VT2 → Z6 ----------------
  ['P4A', 'Z6–Z8', 'P4', 'P4 · Modelado · burpees VT2 + power snatch',
    'EMOM 12′ (16′ en semanas avanzadas)\nMIN IMPAR · UMBRAL (VT2): 13 BURPEES TO TARGET (o 16 kipping pull-ups / remo a ritmo VT2)\nMIN PAR · PICO (Z6): 11 POWER SNATCH 40–50 kg en <45″\n\nREGLA: el snatch del último minuto par en <45″; si no llega, la carga era alta: baja 5 kg.',
    'Limpiar el ácido del pico mientras sigues moviéndote: la caída de potencia tras las primeras rondas.',
    'R01', 'Ocupa el sitio del metcon del día (puede ser el propio metcon de Fabrik si encaja). Detrás de fuerza moderada de tren superior o técnica. No el mismo día que P1/P2 ni la víspera de la calidad.',
    'Lanzadera de lactato: en el minuto de snatch las fibras rápidas producen lactato; en el minuto a umbral las lentas y el corazón lo captan (MCT1) y lo oxidan. Fatigan el H⁺ y el fosfato, no el lactato: aclararlo rápido es rendir. Necesita base de Z2.',
    '12′ (no 16′) si la semana es dura.', 'No', 'P4B', 'Antes de halterofilia pesada.', 'reps por minuto, tiempo del último snatch', FUENTE_GUIA_],
  ['P4B', 'Z6–Z8', 'P4', 'P4 · Modelado · remo VT2 + HSPU + power clean',
    'EMOM 12′ (16′ en semanas avanzadas)\nMIN IMPAR · VT2: 12/10 cal ROW\nMIN PAR · Z6: 6 KIPPING HSPU + 4 POWER CLEAN 60 % en <40″',
    'HSPU en fatiga (meta semanal P1) dentro del formato real de un WOD.',
    'R01|W31', 'Como metcon del día. No el día de jerk o HSPU estricto pesado.',
    'Igual que el P4 base: alternar por encima y por debajo de umbral entrena el reciclaje del lactato; el hombro trabaja con acidez sistémica.',
    '12′ si la semana es dura.', 'No', 'P4A', 'Hombro cargado.', 'HSPU y cleans por minuto', FUENTE_GUIA_],
  ['P4C', 'Z6–Z8', 'P4', 'P4 · Modelado · DU VT2 + thrusters',
    'EMOM 12′ = 6 RONDAS de 2′\nMIN IMPAR · VT2: 40 DOUBLE UNDERS\nMIN PAR · Z6: 10 THRUSTERS 42,5 kg en <30″ + calorías de bike hasta el final del minuto',
    'Thrusters con barra ligera en volumen y DU en fatiga.',
    'R01|T02|W07', 'Como metcon del día, lejos de la sentadilla pesada.',
    'Los thrusters producen el pico glucolítico; la comba a ritmo VT2 obliga a aclarar sin parar, con gemelo y hombro implicados como en los chippers.',
    '12′ (no más) si la semana es dura.', 'No', 'P4A', 'Cuádriceps o gemelo cargados.', 'reps por minuto, fallos de comba', FUENTE_GUIA_],
  ['P4D', 'Z6–Z8', 'P4', 'P4 · Modelado · ski VT2 + bar muscle up',
    'EMOM 12′\nMIN IMPAR · VT2: 12/10 cal SKIERG\nMIN PAR · Z6: 3–5 BAR MUSCLE UP + 6 TOES TO BAR',
    'BMU en fatiga específica (meta mensual) en formato metcon.',
    'R01|M48', 'Como metcon, con el agarre fresco.',
    'El gimnástico de alta potencia aparece con lactato alto: entrenas la eficiencia del kipping y la tolerancia del agarre.',
    '12′ y 3 BMU si la semana es dura.', 'No', 'P4E', 'Agarre cargado.', 'BMU por minuto', FUENTE_GUIA_],
  ['P4E', 'Z6–Z8', 'P4', 'P4 · Modelado · ski VT2 + ring muscle up',
    'EMOM 12′\nMIN IMPAR · VT2: 12/10 cal SKIERG\nMIN PAR · Z6: 2–4 RING MUSCLE UP + 6 TOES TO BAR',
    'RMU en fatiga específica (meta mensual).',
    'R01|M49', 'Como metcon, con el agarre fresco.',
    'Igual que la versión con barra; la anilla añade control de la transición con el hombro ya fatigado.',
    '12′ y 2 RMU si la semana es dura.', 'No', 'P4D', 'Agarre u hombro cargados.', 'RMU por minuto', FUENTE_GUIA_],
  ['P4F', 'Z6–Z8', 'P4', 'P4 · Modelado · burpees VT2 + STOH T&G',
    'EMOM 12′\nMIN IMPAR · VT2: 13 BURPEES TO TARGET\nMIN PAR · Z6: 8 SHOULDER TO OVERHEAD T&G 50 kg en <40″',
    'Barbell cycling de STOH (meta mensual T&G STOH).',
    'R01|M07', 'Como metcon; no el día de jerk pesado.',
    'Pico glucolítico con barra + aclarado a umbral: lanzadera de lactato con el patrón de empuje.',
    '12′ si la semana es dura.', 'No', 'P4A', 'Hombro cargado.', 'reps por minuto', FUENTE_GUIA_],
  // ---------------- CALIDAD Z4 · UMBRAL (VT2) ----------------
  ['Q4A', 'CALIDAD Z4', 'Z4', 'Cruise intervals 3×8′ a ritmo T / 2′ trote',
    '12′ fáciles + 3×15″ progresivos\n3 × 8′ a ritmo umbral (T) / 2′ trote\n8–10′ suaves',
    'Sube el umbral de lactato (VT2): es lo que más mueve tu 10 km y lo que te deja sostener ritmo alto en los metcons largos.',
    'R02', 'AM, con PM de tren superior. ≥48 h del Z6–Z8.',
    'A ritmo T el lactato está estable pero alto: las pausas cortas permiten acumular más tiempo a umbral con la misma fatiga que un tempo continuo. Aumenta MCT1, capilarización y la capacidad de aclarar lactato.',
    '2×8′ si la semana es dura o hay WOD importante al día siguiente.', 'No', 'Q4B', 'Día después de pierna pesada.', 'parciales, ritmo medio de cada serie, FC media (banda)', 'Daniels\' Running Formula'],
  ['Q4B', 'CALIDAD Z4', 'Z4', 'Fartlek de umbral 8×(2′ fuerte / 1′ suave)',
    '12′ fáciles\n8 × (2′ fuerte a ritmo T / 1′ suave)\n8′ suaves',
    'Mismo estímulo de umbral. Ideal en grupo: cada uno corre a su ritmo T en los 2′ y os reagrupáis en el minuto suave.',
    'R02', 'AM o con el grupo; ≥48 h del Z6–Z8.',
    'Tiempo acumulado cerca de VT2 (≈16′) en bloques cortos: más fácil de sostener en grupo y sin pista. Misma adaptación de aclarado de lactato.',
    '6 repeticiones si la semana es dura.', 'Sí', 'Q4A', '—', 'ritmo de cada bloque, FC (banda)', 'Seiler 2010; Daniels\' Running Formula'],
  ['Q4C', 'CALIDAD Z4', 'Z4', 'Tempo continuo 20′ a ritmo T',
    '12′ fáciles\n20′ continuos a ritmo umbral\n8′ suaves',
    'Umbral + resistencia mental a ritmo sostenido. Mejor si corres solo.',
    'R02', 'AM, ≥48 h del Z6–Z8.',
    'Esfuerzo continuo en el máximo estado estable de lactato: entrena la economía a ritmo de 10K.',
    '15′ si la semana es dura.', 'No', 'Q4A', '—', 'ritmo medio, FC media y deriva', 'Daniels\' Running Formula'],
  ['Q4D', 'CALIDAD Z4', 'Z4', '4×2000 m a ritmo 10K / 2′',
    '15′ fáciles\n4 × 2000 m a ritmo de 10K / 2′ trote\n10′ suaves',
    'Ritmo específico de 10 km en pista.',
    'R02', 'AM, en pista.',
    'Trabajo justo por encima de umbral: eleva el ritmo sostenible en 10K.',
    '3 × 2000 m si la semana es dura.', 'No', 'Q4A', '—', 'tiempo de cada 2000', 'Daniels\' Running Formula'],
  ['Q4E', 'CALIDAD Z4', 'Z4', 'Cuestas largas 6×2′ a esfuerzo T',
    '12′ fáciles\n6 × 2′ en cuesta suave (4–6 %) a esfuerzo de umbral / bajar trotando\n8′ suaves',
    'Umbral + fuerza específica de carrera con menos impacto que el llano rápido. Buena si el grupo hace cuestas.',
    'R02', 'AM; lejos de pierna pesada.',
    'Mismo estímulo metabólico de umbral con más reclutamiento muscular por zancada y menos carga excéntrica.',
    '5 repeticiones si la semana es dura.', 'Sí', 'Q4A', 'Gemelo/Aquiles cargados.', 'tiempo de subida, FC', 'Barnes & Kilding 2015 (economía de carrera)'],
  // ---------------- CALIDAD Z5 · VO2max ----------------
  ['Q5A', 'CALIDAD Z5', 'Z5', '6×500 m / 4×800 m a vVO₂max',
    '15′ fáciles + progresivos\n6 × 500 m (o 4 × 800 m) a ritmo de 3 km / vVO₂max · 2′–2′30″ trote\n10′ suaves',
    'Sube el techo aeróbico (VO₂max): más margen para todo lo que va por debajo.',
    'R03', 'AM, ≥48 h del Z6–Z8 y nunca el mismo día que pierna pesada.',
    'Repeticiones de 2–3′ a vVO₂max llevan el consumo de O₂ a su máximo varias veces: gasto cardiaco y volumen sistólico, la limitación central del VO₂max.',
    '5 × 500 / 3 × 800 si la semana es dura.', 'No', 'Q5B', 'Pierna cargada.', 'tiempo de cada repetición, FC máx', 'Buchheit & Laursen 2013'],
  ['Q5B', 'CALIDAD Z5', 'Z5', 'Billat 30/30 · 2 bloques × 8–10',
    '15′ fáciles\n2 bloques × 8–10 (30″ a vVO₂max / 30″ trote) · 3′ entre bloques\n10′ suaves',
    'VO₂max con poca fatiga y fácil de hacer en grupo: todos salís y paráis a la vez.',
    'R03', 'AM o con el grupo; ≥48 h del Z6–Z8.',
    'El 30/30 a vVO₂max mantiene más tiempo cerca del VO₂max que un esfuerzo continuo de la misma intensidad media, con menos lactato acumulado.',
    '2 × 8 si la semana es dura.', 'Sí', 'Q5A', '—', 'ritmo de las fases rápidas, FC', 'Billat et al. 2000 (30/30)'],
  ['Q5C', 'CALIDAD Z5', 'Z5', '4×4′ noruego al 90–95 % FCmáx',
    '15′ fáciles\n4 × 4′ al 90–95 % de la FC máxima / 3′ trote activo\n10′ suaves',
    'VO₂max controlado por pulso con tu banda de pecho.',
    'R03', 'AM, ≥48 h del Z6–Z8.',
    'Protocolo con la mejor evidencia de mejora del VO₂max frente al trabajo moderado: 16′ en la zona alta del gasto cardiaco.',
    '3 × 4′ si la semana es dura.', 'No', 'Q5A', '—', 'FC media de cada 4′, ritmo', 'Helgerud et al. 2007'],
  ['Q5D', 'CALIDAD Z5', 'Z5', 'Fartlek 10×1′ fuerte / 1′ suave',
    '15′ fáciles\n10 × (1′ fuerte / 1′ suave)\n10′ suaves',
    'VO₂max en grupo y sin pista; cada uno a su ritmo fuerte.',
    'R03', 'AM o con el grupo.',
    'Intervalos cortos a intensidad cercana al VO₂max acumulando ~10′ arriba con recuperaciones activas.',
    '8 repeticiones si la semana es dura.', 'Sí', 'Q5B', '—', 'ritmo de los minutos fuertes', 'Buchheit & Laursen 2013']
];
function sembrarBiblioteca_() {
  var ya = {}; listar_(HOJAS.BIBLIOTECA).forEach(function (r) { ya[r.ID] = 1; });
  var cab = ESQUEMA['APP · BIBLIOTECA'].cab, filas = BIBLIO_BASE_.filter(function (e) { return !ya[e[0]]; });
  if (!filas.length) return 0;
  var sh = hojaMia_(HOJAS.BIBLIOTECA), c2 = cabeceras_(sh);
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, filas.length, c2.length).setValues(filas.map(function (f) { var o = {}; cab.forEach(function (h, i) { o[h] = f[i]; }); o.ACTIVO = 'Sí'; return filaDe_(c2, o); }));
  return filas.length;
}
function biblioteca_() {
  var filas = [];
  try { filas = listar_(HOJAS.BIBLIOTECA); } catch (e) {}
  if (!filas.length) filas = BIBLIO_BASE_.map(function (f) { var o = {}; ESQUEMA['APP · BIBLIOTECA'].cab.forEach(function (h, i) { o[h] = f[i]; }); o.ACTIVO = 'Sí'; return o; });
  return filas.filter(function (r) { return r.ID && r.ACTIVO !== 'No'; });
}

/** Peso de cada código según tus metas: prioridad alta y poco cubierta = más peso (lo que más te falta). */
function pesoCarencias_(lunes) {
  var c = cacheMetas_(), out = {};
  var add = function (lista) {
    lista.forEach(function (m) {
      var pr = PRIO_ORDEN(m.prioridad), w = (pr <= 1 ? 3 : pr === 2 ? 2.5 : pr === 3 ? 2 : pr <= 5 ? 1.5 : 1) * (1 - Math.min(1, m.pProg || 0));
      codigosDe_(m.codigos).forEach(function (k) { out[k] = Math.max(out[k] || 0, w); });
    });
  };
  add(avanceMetas_('Semana', periodoSemana_(lunes), c));
  add(avanceMetas_('Mes', periodoMes_(lunes), c));
  return out;
}
/** ¿Cuánto aprieta el metcon de Fabrik esta semana? (RPE ≥8 o notas de Gabi que piden intensidad). */
function metconDuro_(lunes) {
  var n = 0;
  listar_(HOJAS.PLAN).forEach(function (r) {
    var d = celdaIso_(r.FECHA); if (norm(r.ORIGEN) !== 'FABRIK' || d < lunes || d > sumarDias(lunes, 6) || /OCULTO|NO HACER|CANCELADO/.test(r.ESTADO)) return;
    if (!/METCON|WOD/.test(norm(r['TÍTULO'] + ' ' + r.BLOQUE))) return;
    var rpe = parseInt(String(r.INTENSIDAD || '').replace(/[^\d]/g, ''), 10) || 0, nota = norm(r['POR QUÉ (cursiva)'] || '');
    if (rpe >= 8 || /RPE 8|RPE 9|ALTA INTENSIDAD|AUMENTAMOS LA INTENSIDAD|MAXIMO ESFUERZO|ALL OUT/.test(nota)) n++;
  });
  return n;
}
/** Elige la variante Z6–Z8 de la biblioteca para el protocolo que pide el plan (P1–P4). */
function elegirZ68_(protocolo, lunes, excluir) {
  var lista = biblioteca_().filter(function (r) { return r.TIPO === 'Z6–Z8' && (!protocolo || r.PROTOCOLO === protocolo) && r.ID !== excluir; });
  if (!lista.length) return null;
  var w = pesoCarencias_(lunes);
  var punt = function (r) { return codigosDe_(r['CARENCIAS (códigos)']).reduce(function (a, c) { return a + (c === 'R01' ? 0 : (w[c] || 0)); }, 0); };
  lista.sort(function (a, b) { return punt(b) - punt(a) || (a.ID < b.ID ? -1 : 1); });
  var mejor = lista[0];
  return { fila: mejor, puntos: punt(mejor), ataca: codigosDe_(mejor['CARENCIAS (códigos)']).filter(function (c) { return c !== 'R01' && w[c] > 0; }) };
}
/** Bloque Z6–Z8 completo (contenido, por qué, ciencia, dónde va y alternativa) a partir de la biblioteca. */
function bloqueZ68_(s, lunes) {
  var nt = norm(s['TÍTULO'] + ' ' + s.CONTENIDO), p = (nt.match(/\bP([1-4])\b/) || [])[1];
  if (!p) p = /RSA|SPRINT/.test(nt) ? '2' : /CONTRASTE|ALACTIC/.test(nt) ? '3' : /MODELADO|METCON/.test(nt) ? '4' : /HIBRID|DESOXIGEN/.test(nt) ? '1' : '';
  var el = elegirZ68_(p ? 'P' + p : '', lunes); if (!el) return s;
  var r = el.fila, duro = metconDuro_(lunes) >= 2, alt = biblioteca_().filter(function (x) { return x.ID === r.ALTERNATIVA && x.ID !== r.ID; })[0];
  if (!alt) { var e2 = elegirZ68_(r.PROTOCOLO, lunes, r.ID); alt = e2 ? e2.fila : null; }
  var cods = codigosDe_(s['CÓDIGOS']).concat(codigosDe_(r['CARENCIAS (códigos)'])).filter(function (c, i, a) { return a.indexOf(c) === i; });
  var nombresMeta = el.ataca.length ? ' Además cubre ' + el.ataca.join(', ') + ', de lo que más te falta.' : '';
  return Object.assign({}, s, {
    'TÍTULO': 'POTENCIA · ' + r.NOMBRE,
    CONTENIDO: r.CONTENIDO + (duro && r['SEMANA DURA (dosis)'] ? '\n\n⚙ Semana dura de Fabrik (≥2 metcons de RPE ≥8): ' + r['SEMANA DURA (dosis)'] : '') + '\n\nDónde va: ' + r['DÓNDE VA EN LA SESIÓN'] + (r.REGISTRA ? '\n\nRegistra: ' + r.REGISTRA : ''),
    'CÓDIGOS': cods.join('|'), CANTIDAD: saltosTexto_(r.CONTENIDO) || '',
    'POR QUÉ (cursiva)': [r['ATACA (qué mejora)'] + nombresMeta, s['POR QUÉ (cursiva)']].filter(Boolean).join(' '),
    'CIENCIA (técnica · fisiología · biología)': r['CIENCIA (fisiología · biología)'],
    INTERFERENCIAS: r.EVITAR ? 'Evitar: ' + r.EVITAR : s.INTERFERENCIAS,
    ALTERNATIVAS: alt ? '↔ ' + alt.NOMBRE + '\n' + alt.CONTENIDO + '\n\nCuándo elegirla: ' + alt['ATACA (qué mejora)'] + '\nCiencia: ' + alt['CIENCIA (fisiología · biología)'] + '\nDónde va: ' + alt['DÓNDE VA EN LA SESIÓN'] : ''
  });
}
/** Alternativas de la sesión Q (calidad Z4 o Z5): la del plan es la recomendada; dos más para adaptarla a la gente con la que corres. */
function alternativasQ_(s) {
  var z5 = /R03/.test(s['CÓDIGOS']), tipo = z5 ? 'CALIDAD Z5' : 'CALIDAD Z4';
  var lista = biblioteca_().filter(function (r) { return r.TIPO === tipo; });
  if (!lista.length) return '';
  var nt = norm(s.CONTENIDO), parecida = function (r) { var n = norm(r.NOMBRE); return (/FARTLEK/.test(n) && /FARTLEK/.test(nt)) || (/CUESTA/.test(n) && /CUESTA/.test(nt)) || (/30\/30/.test(n) && /30\/30/.test(nt)); };
  var grupo = lista.filter(function (r) { return r.GRUPO === 'Sí' && !parecida(r); })[0];
  var otra = lista.filter(function (r) { return r !== grupo && !parecida(r) && r.GRUPO !== 'Sí'; })[0] || lista.filter(function (r) { return r !== grupo; })[0];
  // dosis de la recomendada: minutos totales a ritmo (p. ej. 2×6′ = 12′)
  var dosis = 0, m, re = /(\d+)\s*[×X]\s*(\d+)\s*[′']/g; while ((m = re.exec(s.CONTENIDO || ''))) dosis += +m[1] * +m[2];
  var txt = ['★ RECOMENDADA: la del plan. ' + (z5 ? 'Es la Z5 del mes según el manual v2.0 (§13.3, techo aeróbico).' : 'Sigue la progresión de umbral del manual v2.0 (§13.1: 3×6→3×7→3×8′, 18–25′ de trabajo).') +
    ' Su dosis está ajustada a tu semana' + (dosis ? ' (≈' + dosis + '′ de trabajo a ritmo)' : '') + ': si cambias, respeta esa dosis.'];
  [grupo, otra].filter(Boolean).forEach(function (r, i) {
    txt.push((i ? '↔ OTRA OPCIÓN' : '👥 EN GRUPO') + ': ' + r.NOMBRE + '\n' + r.CONTENIDO + (dosis ? '\n(ajústala a ≈' + dosis + '′ de trabajo a ritmo, como la recomendada)' : '') +
      '\nAtaca: ' + r['ATACA (qué mejora)'] + '\nCiencia: ' + r['CIENCIA (fisiología · biología)']);
  });
  return txt.join('\n\n');
}

// ===================== v0.11 · CHEQUEO POR SENSACIONES (sin Garmin) =====================
/**
 * Se rellena al abrir la sesión del día (≈15 s): cansancio 1–10, agujetas / cuerpo trabajado 1–10, zonas cargadas y sueño.
 * Se cruza con lo que toca hoy y con lo de las 48–72 h anteriores (etiquetas de carga de cada bloque): avisa de choques
 * y explica el probable origen. En los días de carrera se guarda junto a la sesión para explicar sus resultados.
 * Los únicos datos de Garmin (banda de pecho) se piden en los bloques de carrera.
 */
ESQUEMA['APP · CHEQUEO'] = {
  cab: ['FECHA', 'CANSANCIO (1-10)', 'AGUJETAS (1-10)', 'ZONAS CARGADAS', 'SUEÑO', 'NOTAS', 'LISTO (0-100)', 'SEMÁFORO', 'RECOMENDACIÓN', 'REGISTRADO'],
  anchos: [95, 90, 90, 260, 80, 240, 80, 80, 520, 120], fechas: ['FECHA'],
  listas: { 'SEMÁFORO': ['Verde', 'Ámbar', 'Rojo'], 'SUEÑO': ['Bien', 'Regular', 'Mal'] },
  colores: [['SEMÁFORO', 'Verde', '#e0f5e6'], ['SEMÁFORO', 'Ámbar', '#fff2cc'], ['SEMÁFORO', 'Rojo', '#fbe0e0']]
};
CAMPOS_CHEQUEO = ['FECHA', 'CANSANCIO (1-10)', 'AGUJETAS (1-10)', 'ZONAS CARGADAS', 'SUEÑO', 'NOTAS'];
var ZONAS_ = ['Hombros', 'Codos / antebrazo (agarre)', 'Dorsal / espalda alta', 'Lumbar', 'Core', 'Cadera / glúteo', 'Cuádriceps', 'Isquios', 'Gemelo / sóleo', 'Tobillo / Aquiles', 'Rodillas', 'Pies'];
var ZONA_CARGA_ = { 'Hombros': ['HOMBRO'], 'Codos / antebrazo (agarre)': ['AGARRE'], 'Dorsal / espalda alta': ['AGARRE'], 'Lumbar': ['PIERNA'], 'Core': ['CORE'],
  'Cadera / glúteo': ['PIERNA'], 'Cuádriceps': ['PIERNA'], 'Isquios': ['PIERNA'], 'Gemelo / sóleo': ['IMPACTO'], 'Tobillo / Aquiles': ['IMPACTO'], 'Rodillas': ['PIERNA', 'IMPACTO'], 'Pies': ['IMPACTO'] };
var CONSEJO_CARGA_ = {
  HOMBRO: 'baja un nivel (RIR +1 y −20 % de volumen); HSPU → strict press ligero o pike push-ups si molesta',
  PIERNA: 'sentadilla y saltos −20 % o RIR +1; en el metcon, escala la carga de pierna',
  AGARRE: 'tiza y tandas cortas desde la 1.ª ronda; kipping → estricto o ring rows si hay dolor',
  IMPACTO: 'corre en llano o en cinta y por sensaciones, o pasa la Z2 a bici/remo; saltos → step ups',
  CORE: 'sin volumen de GHD ni T2B; core de control (dead bug, pallof)'
};
function zonasDe_(v) { return String(v || '').split(/\s*[,;|]\s*/).map(function (z) { return z.trim(); }).filter(function (z) { return ZONAS_.indexOf(z) >= 0; }); }
function filasActivasDia_(iso) {
  return listar_(HOJAS.PLAN).filter(function (r) { return celdaIso_(r.FECHA) === iso && !/^(SUSTITUIDO|OCULTO|PROPUESTA|NO HACER|CANCELADO|SIN HUECO)$/.test(r.ESTADO); });
}
function cargasFila_(r) {
  var c = cargasDe_((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || ''), r.INTENSIDAD);
  if (/CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R02|R03)\b/.test(r['CÓDIGOS'] || '')) c.push('IMPACTO');
  return c.filter(function (x, i, a) { return a.indexOf(x) === i; });
}
/** Cruce del chequeo con lo de hoy y lo de los 3 días anteriores. */
function cruceChequeo_(iso, zonas) {
  var tags = {}; zonas.forEach(function (z) { (ZONA_CARGA_[z] || []).forEach(function (t) { (tags[t] = tags[t] || []).push(z); }); });
  var hoy = [], origen = [];
  filasActivasDia_(iso).forEach(function (r) {
    var choca = cargasFila_(r).filter(function (t) { return tags[t]; });
    if (choca.length) hoy.push({ titulo: r['TÍTULO'] || r.BLOQUE, choca: choca, carrera: /CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04)\b/.test(r['CÓDIGOS'] || '') });
  });
  var hechos = {}; listar_(HOJAS.REGISTRO).forEach(function (r) { hechos[celdaIso_(r.FECHA) + '|' + r.ID_PLAN] = r.HECHO; });
  [1, 2, 3].forEach(function (k) {
    var d = sumarDias(iso, -k);
    filasActivasDia_(d).forEach(function (r) {
      if (hechos[d + '|' + r.ID] === 'No') return;
      var c = cargasFila_(r).filter(function (t) { return tags[t]; });
      if (c.length) origen.push({ hace: k, titulo: r['TÍTULO'] || r.BLOQUE, cargas: c, rpe: r.INTENSIDAD || '' });
    });
  });
  return { hoy: hoy, origen: origen };
}
function puntuarChequeo_(o, previos, iso) {
  var n = function (v) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : null; };
  var ca = n(o['CANSANCIO (1-10)']), ag = n(o['AGUJETAS (1-10)']), zonas = zonasDe_(o['ZONAS CARGADAS']), su = String(o['SUEÑO'] || '');
  if (ca == null && ag == null) return { listo: null, semaforo: '', recomendacion: 'Marca al menos el cansancio y las agujetas.', detalle: '' };
  var listo = 100 - (ca != null ? (ca - 1) / 9 * 50 : 0) - (ag != null ? (ag - 1) / 9 * 30 : 0) - Math.min(12, zonas.length * 4) - (su === 'Mal' ? 15 : su === 'Regular' ? 6 : 0);
  listo = Math.max(0, Math.min(100, Math.round(listo)));
  var sem = listo >= 70 ? 'Verde' : listo >= 50 ? 'Ámbar' : 'Rojo';
  if (ca != null && ca >= 9) sem = 'Rojo';
  var rec = {
    Verde: 'Todo según plan. Z6–Z8 y calidad donde están programadas.',
    'Ámbar': 'Mantén la calidad principal y recorta 20–30 % el volumen accesorio. Z6–Z8: solo si el calentamiento sale fino; si no, «No hacer» y a pendientes.',
    Rojo: 'Hoy nada de Z6–Z8 ni calidad: Z2 muy suave, técnica ligera o movilidad. Usa «Ha surgido algo» y te propongo cómo recolocar la semana.'
  }[sem];
  var partes = [];
  var media = function (k) { var v = previos.map(function (p) { return n(p[k]); }).filter(function (x) { return x != null; }); return v.length >= 3 ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
  var mc = media('CANSANCIO (1-10)'); if (mc != null && ca != null && ca - mc >= 2) partes.push('cansancio ' + Math.round(ca - mc) + ' puntos por encima de tu media');
  if (zonas.length && iso) {
    var x = cruceChequeo_(iso, zonas);
    x.hoy.forEach(function (h) { rec += ' «' + h.titulo + '» carga ' + h.choca.join(' y ').toLowerCase() + ', que marcas cargado: ' + h.choca.map(function (t) { return CONSEJO_CARGA_[t]; }).join('; ') + '.'; });
    if (x.hoy.some(function (h) { return h.carrera; })) rec += ' En la carrera de hoy, fíjate en la FC: más pulso al mismo ritmo = fatiga, no forma.';
    if (x.origen.length) rec += ' Probable origen: ' + x.origen.slice(0, 3).map(function (q) { return (q.hace === 1 ? 'ayer' : 'hace ' + q.hace + ' días') + ' «' + q.titulo + '» (' + q.cargas.join(', ').toLowerCase() + ')'; }).join('; ') + '.';
  }
  return { listo: listo, semaforo: sem, recomendacion: rec, detalle: partes.join(' · ') };
}

// ===================== v0.11 · COMBUSTIBLE E HIDRATACIÓN DÍA A DÍA =====================
/**
 * Pautas con respaldo (ACSM/AND/DC 2016 · ISSN nutrient timing 2017 y proteína 2017 · ISSN cafeína 2021 · ACSM hidratación 2007),
 * calculadas con tu peso (APP · CONFIG › peso_kg) y con la carga real del día (minutos, metcon, Z6–Z8, calidad, doble sesión)
 * y la del día siguiente (para recuperar a tiempo).
 */
function cargaDia_(filas) {
  var min = 0, am = 0, pm = 0, rpe = 0, z68 = false, cal = false, larga = false, test = false, metcons = 0;
  filas.forEach(function (r) {
    var t = norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || '')), cods = r['CÓDIGOS'] || '', fab = norm(r.ORIGEN) === 'FABRIK';
    var m = parseFloat(String(r.MIN || '').replace(',', '.')) || (fab ? (/METCON|WOD/.test(t) ? 20 : 18) : 12);
    min += m; if (r.TURNO === 'AM') am += m; else pm += m;
    var rp = parseInt(String(r.INTENSIDAD || '').replace(/[^\d]/g, ''), 10) || 0; if (/METCON|WOD/.test(t)) { metcons++; rpe = Math.max(rpe, rp || 7); }
    if (/R01|R04/.test(cods)) z68 = true; if (/W04|R02|R03/.test(cods)) cal = true; if (/W01/.test(cods)) larga = true; if (/TEST/.test(t)) test = true;
  });
  var doble = am >= 20 && pm >= 20;
  var tipo = !filas.length ? 'descanso' : doble ? 'doble' : (rpe >= 8 || z68 || cal || test || min > 100 || metcons >= 2) ? 'duro' : min <= 50 && !metcons ? 'suave' : 'normal';
  return { tipo: tipo, min: Math.round(min), am: am, pm: pm, rpe: rpe, z68: z68, calidad: cal, larga: larga, test: test, doble: doble };
}
function combustibleDia_(iso, peso) {
  peso = peso || 90;
  var c = cargaDia_(filasActivasDia_(iso)), m = cargaDia_(filasActivasDia_(sumarDias(iso, 1)));
  var g = function (a, b) { return Math.round(a * peso / 10) * 10 + (b ? '–' + Math.round(b * peso / 10) * 10 : '') + ' g'; };
  var CHO = { descanso: [3, 4], suave: [4, 5], normal: [5, 6], duro: [6, 8], doble: [7, 8] }[c.tipo];
  var NOMBRE = { descanso: 'Descanso', suave: 'Día suave', normal: 'Día normal', duro: 'Día duro', doble: 'Doble sesión' }[c.tipo];
  var items = [];
  items.push({ m: 'Todo el día', t: 'Hidratos ' + g(CHO[0], CHO[1]) + ' (' + CHO[0] + '–' + CHO[1] + ' g/kg) · proteína ' + g(1.8, 2.0) + ' en 4–5 tomas de 35–40 g · agua ≈' + (Math.round(peso * 0.035 * 10) / 10) + ' L + lo que sudes. Orina clara = bien.' });
  if (c.tipo !== 'descanso') {
    var turnoPrin = c.pm >= c.am ? 'PM' : 'AM';
    if (turnoPrin === 'AM' || c.doble) items.push({ m: 'Pre AM (60–90′ antes)', t: 'Ligero y rápido: avena 60–80 g con plátano y miel, o tostadas con mermelada + café. ' + g(0.5, 1) + ' de hidratos, poca grasa y fibra. ' + Math.round(peso * 5) + '–' + Math.round(peso * 7) + ' ml de agua con una pizca de sal al levantarte.' + (c.larga ? ' Para la Z2 larga no vayas en ayunas si por la tarde hay pesas.' : '') });
    if (turnoPrin === 'PM' || c.doble) items.push({ m: 'Comida (2–3 h antes)', t: 'Hidratos ' + g(c.tipo === 'duro' || c.doble ? 1.5 : 1, c.tipo === 'duro' || c.doble ? 2 : 1.5) + ' + 30–40 g de proteína, poca grasa y fibra: p. ej. ' + (c.tipo === 'duro' || c.doble ? '150 g de arroz (en crudo)' : '110 g de arroz o pasta (en crudo)') + ' + 150 g de pollo o salmón + fruta. Agua: ' + Math.round(peso * 5) + '–' + Math.round(peso * 7) + ' ml en las 2–4 h previas.' });
    if (turnoPrin === 'PM' || c.doble) items.push({ m: 'Snack (30–60′ antes)', t: '20–40 g de hidratos rápidos: plátano + 1 tortita de arroz con miel, o un bizcocho/muffin casero. Si la orina está oscura, 250 ml más con una pizca de sal.' +
      ((c.calidad || c.test || c.z68) ? ' Cafeína opcional: ' + Math.round(peso * 3) + ' mg (3 mg/kg ≈ 2–3 espressos) 45–60′ antes, solo si faltan ≥6 h para dormir; si entrenas a las 19–21 h, como mucho la mitad o nada.' : '') });
    var largo = c.min >= 75 || c.doble || (c.rpe >= 8 && c.min >= 60) || (c.z68 && c.rpe >= 7);
    items.push({ m: 'Durante', t: 'Agua: 150–250 ml cada 15–20′ (≈0,5–0,8 L/h).' + (largo ? ' Sesión larga o muy intensa: bebida con 30–60 g/h de hidratos (500 ml de agua + 30 g de azúcar o maltodextrina + 1 g de sal ≈ 400 mg de sodio). Si sudas mucho o hace calor, 300–600 mg de sodio por hora.' : ' Con <75′ no hace falta nada más que agua.') });
    items.push({ m: 'Post (0–2 h)', t: 'Proteína 30–40 g (≈0,4 g/kg: batido, 200 g de yogur proteico o 3 huevos + 2 claras) + hidratos ' + g(c.tipo === 'duro' || c.doble ? 1 : 0.6, c.tipo === 'duro' || c.doble ? 1.2 : 0.8) +
      ' (arroz, patata, fruta, avena). Rehidrata 1,25–1,5 L por cada kg perdido (pésate antes y después alguna vez para saber cuánto sudas), con sal en la comida.' +
      (c.doble ? ' Entre sesiones (<8 h): 1–1,2 g/kg/h de hidratos las 3–4 primeras horas (' + g(1, 1.2) + ' por hora) en tomas pequeñas.' : '') });
    items.push({ m: 'Cena / antes de dormir', t: 'Plato completo con proteína (salmón, pollo, huevos) y verdura' + (m.tipo === 'duro' || m.tipo === 'doble' || m.calidad || m.larga ? ' y una ración generosa de hidratos (≈' + g(1.5) + '): mañana toca ' + (m.calidad ? 'calidad de carrera' : m.larga ? 'Z2 larga' : 'un día duro') : '') + '. 30–40 g de proteína lenta antes de dormir (yogur griego, queso batido) si el día fue duro.' });
  } else {
    items.push({ m: 'Comidas', t: 'Proteína en cada comida (35–40 g), fruta y verdura, hidratos moderados: ' + g(3, 4) + '. Buen día para tus desayunos de avena, huevos y aguacate.' });
    if (m.tipo === 'duro' || m.tipo === 'doble' || m.calidad || m.larga) items.push({ m: 'Cena', t: 'Mañana toca ' + (m.calidad ? 'calidad de carrera' : m.larga ? 'Z2 larga' : 'un día duro') + ': cena con ' + g(1.5) + ' de hidratos (arroz, patata, pasta) para llegar con el glucógeno lleno.' });
  }
  var rec = [];
  if (c.tipo === 'duro' || c.doble) rec.push('Recuperar para mañana: prioriza la comida post en la primera hora y duerme 8 h; el glucógeno tarda ~24 h en reponerse con 7–10 g/kg.');
  if (m.calidad || m.larga) rec.push('Mañana ' + (m.calidad ? 'hay calidad' : 'hay Z2 larga') + ': hoy no recortes hidratos en la cena y llega hidratado.');
  if (m.doble) rec.push('Mañana es doble sesión: deja preparado el snack de entre sesiones.');
  rec.push('Creatina 3–5 g al día (cualquier hora) si la tomas: es la ayuda con más evidencia para la potencia repetida.');
  return { tipo: c.tipo, titulo: NOMBRE + (c.tipo !== 'descanso' ? ' · ≈' + c.min + '′' + (c.rpe ? ' · RPE ' + c.rpe : '') + (c.z68 ? ' · Z6–Z8' : '') + (c.calidad ? ' · calidad' : '') : ''), items: items, recuperacion: rec.join(' '),
    fuentes: 'ACSM/AND/DC 2016 · ISSN 2017 (timing y proteína) · ISSN 2021 (cafeína) · ACSM 2007 (hidratación)' };
}
function pesoKg_() { var p = parseFloat(String(leerConfig_().peso_kg || '').replace(',', '.')); return p > 40 && p < 200 ? p : 90; }

// ===================== v0.11 · BLOQUES CLAVE PARA TUS CARENCIAS =====================
/** Bloques de la semana que cubren las metas de más prioridad (P1–P3, tipo COUNT) aún sin hacer: se marcan con 🎯. */
function claveSemana_(lunes, plan) {
  var c = cacheMetas_(), metas = avanceMetas_('Semana', periodoSemana_(lunes), c).concat(avanceMetas_('Mes', periodoMes_(lunes), c))
    .filter(function (m) { return m.tipo === 'COUNT' && PRIO_ORDEN(m.prioridad) <= 3 && m.pReal < 1; });
  var cand = [];
  (plan || []).forEach(function (r) {
    if (/^(SUSTITUIDO|OCULTO|PROPUESTA|NO HACER|CANCELADO|SIN HUECO)$/.test(r.ESTADO)) return;
    var rc = codigosDe_(r['CÓDIGOS']), mejor = null;
    metas.forEach(function (m) {
      if (!codigosDe_(m.codigos).some(function (k) { return rc.indexOf(k) >= 0; })) return;
      var pr = PRIO_ORDEN(m.prioridad), p = (pr <= 1 ? 3 : pr === 2 ? 2.5 : 2) + (1 - m.pReal) * 0.5;
      if (!mejor || p > mejor.p) mejor = { p: p, m: m };
    });
    if (mejor) cand.push({ id: r.ID, p: mejor.p, txt: mejor.m.estimulo + ' (' + String(mejor.m.prioridad || '').split('·')[0].trim() + ' · ' + Math.round(mejor.m.realizado * 10) / 10 + '/' + mejor.m.meta + ' hecho)' });
  });
  var out = {};
  cand.sort(function (a, b) { return b.p - a.p; }).slice(0, 6).forEach(function (x) { out[x.id] = x.txt; });
  return out;
}

// ===================== v0.11 · EXTRAS DE LA SEMANA EN CURSO (qué se ha añadido, dónde, y cuánto suma al mes) =====================
function extrasCurso_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  var c = cacheMetas_(), pm = periodoMes_(lunes), ps = periodoSemana_(lunes), fin = sumarDias(lunes, 6);
  var esExtra = function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && norm(r.ORIGEN) !== 'FABRIK' && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO); };
  var esExtraMes = function (r) { var d = celdaIso_(r.FECHA); return d >= pm.desde && d <= pm.hasta && norm(r.ORIGEN) !== 'FABRIK' && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO); };
  var sin = function (fn) { return Object.assign({}, c, { plan: c.plan.filter(function (r) { return !fn(r); }) }); };
  var mes = function (cc) { return resumenPer_(avanceMetas_('Mes', pm, cc), pm, 'Mes'); }, sem = function (cc) { return resumenPer_(avanceMetas_('Semana', ps, cc), ps, 'Semana'); };
  var full = mes(c), fullS = sem(c), sinSem = mes(sin(esExtra)), sinSemS = sem(sin(esExtra)), sinMes = mes(sin(esExtraMes));
  var metasTodas = full.metas.concat(fullS.metas), clave = claveSemana_(lunes, c.plan.filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin; }));
  var bloques = c.plan.filter(esExtra).sort(function (a, b) { return celdaIso_(a.FECHA) < celdaIso_(b.FECHA) ? -1 : celdaIso_(a.FECHA) > celdaIso_(b.FECHA) ? 1 : (a.TURNO === 'AM' ? -1 : 1); }).map(function (r) {
    var rc = codigosDe_(r['CÓDIGOS']), sinB = mes(sin(function (x) { return x === r; })), sinBS = sem(sin(function (x) { return x === r; }));
    return { id: r.ID, fecha: celdaIso_(r.FECHA), dia: diaDe_(celdaIso_(r.FECHA)), turno: r.TURNO === 'AM' ? 'AM' : 'PM', titulo: r['TÍTULO'] || r.BLOQUE, estado: r.ESTADO, origen: r.ORIGEN, min: r.MIN,
      metas: metasTodas.filter(function (m) { return codigosDe_(m.codigos).some(function (k) { return rc.indexOf(k) >= 0; }); }).map(function (m) { return m.estimulo; }).filter(function (x, i, a) { return a.indexOf(x) === i; }),
      aporteMes: Math.round((full.pctProg - sinB.pctProg) * 1000) / 10, aporteSemana: Math.round((fullS.pctProg - sinBS.pctProg) * 1000) / 10, clave: clave[r.ID] || '' };
  });
  return { lunes: lunes, mes: pm.etiqueta, bloques: bloques, borradores: bloques.filter(function (b) { return b.estado === 'BORRADOR'; }).length,
    aporteSemanaMes: Math.round((full.pctProg - sinSem.pctProg) * 1000) / 10, aporteExtrasMes: Math.round((full.pctProg - sinMes.pctProg) * 1000) / 10,
    acumuladoMes: Math.round(full.pctProg * 1000) / 10, realizadoMes: Math.round(full.pctReal * 1000) / 10,
    semanaCon: Math.round(fullS.pctProg * 1000) / 10, semanaSin: Math.round(sinSemS.pctProg * 1000) / 10 };
}

// ===================== v0.11 · APP · RESUMEN (el Sheet enseña exactamente lo mismo que la app) =====================
HOJAS.RESUMEN = 'APP · RESUMEN';
function pintarResumen_(an) {
  return conMemo_(function () {
    var ss = miLibro_(), sh = ss.getSheetByName(HOJAS.RESUMEN) || ss.insertSheet(HOJAS.RESUMEN, 0);
    var hoy = hoyIso_(), M = metasDe_(hoy), X = extrasCurso_(lunesDe_(hoy)), A = an || calcAnalisisCarrera_();
    var W = 11, filas = [], tipos = {}, pct = function (v) { return Math.round(v * 1000) / 10 + ' %'; };
    var fila = function (r, t) { r = r.slice(0, W); while (r.length < W) r.push(''); filas.push(r); if (t) tipos[filas.length] = t; };
    fila(['ROAD TO ELITE · RESUMEN', '', '', '', '', '', '', '', '', 'Actualizado', ahora_()], 'titulo');
    fila(['Mismos números que la app: semana = metas cubiertas / metas · mes = media del avance de cada meta. Programado incluye borradores.']);
    fila(['']);
    fila(['SEMANA ' + isoAFecha(M.semana.desde).slice(0, 5) + '–' + isoAFecha(M.semana.hasta).slice(0, 5), 'Programado', pct(M.semana.pctProg), 'Hecho', pct(M.semana.pctReal), M.semana.cubiertas + '/' + M.semana.total + ' metas cubiertas', '',
      'MES · ' + M.mes.etiqueta, 'Programado', pct(M.mes.pctProg), 'Hecho ' + pct(M.mes.pctReal)], 'kpi');
    fila(['']);
    var fs = M.semana.metas.filter(function (m) { return !m.cubierta; }), fm = M.mes.metas.filter(function (m) { return !m.cubierta; });
    fila(['POR CUBRIR · SEMANA', '', '', '', '', '', '', 'POR CUBRIR · MES'], 'seccion');
    for (var i = 0; i < Math.max(fs.length, fm.length, 1); i++) {
      var a = fs[i], b = fm[i];
      fila([a ? a.estimulo + ' [' + Math.round(a.programado * 10) / 10 + '/' + a.meta + ']' : (i ? '' : '— todo cubierto'), '', '', '', '', '', '', b ? b.estimulo + ' [' + Math.round(b.programado * 10) / 10 + '/' + b.meta + ']' : (i ? '' : '— todo cubierto')]);
    }
    fila(['']);
    fila(['EXTRAS · SEMANA EN CURSO (' + isoAFecha(X.lunes) + ')', '', '', '', '', '', '', '', 'Suma al mes esta semana', X.aporteSemanaMes + ' pp', 'Acumulado mes ' + X.acumuladoMes + ' %'], 'seccion');
    fila(['Día', 'Turno', 'Bloque', '', 'Estado', 'Metas que cubre', '', 'Aporte a la semana', 'Aporte al mes', '🎯 Clave', 'Extras del mes: ' + X.aporteExtrasMes + ' pp'], 'cab');
    if (!X.bloques.length) fila(['— Aún no hay extras esta semana (Cargar extras en la app o en el menú del Sheet).']);
    X.bloques.forEach(function (b) { fila([b.dia + ' ' + isoAFecha(b.fecha).slice(0, 5), b.turno, b.titulo, '', b.estado, b.metas.join(' · '), '', b.aporteSemana + ' pp', b.aporteMes + ' pp', b.clave ? '🎯 ' + b.clave : '']); });
    fila(['']);
    fila(['METAS', '', '', '', '', '', '', '', '', '', ''], 'seccion');
    fila(['Ámbito', 'Prioridad', 'Estímulo', '', 'Meta', 'Programado', 'Hecho', 'Borrador', '% programado', '% hecho', 'Estado'], 'cab');
    [['Semana', M.semana], ['Mes', M.mes]].forEach(function (z) {
      z[1].metas.forEach(function (m) { fila([z[0], m.prioridad, m.estimulo, '', m.meta, Math.round(m.programado * 10) / 10, Math.round(m.realizado * 10) / 10, m.borrador || '', pct(m.pProg), pct(m.pReal), m.cubierta ? '✓' : 'falta']); });
    });
    fila(['']);
    fila(['CARRERA · CONCLUSIONES', '', '', '', '', '', '', '', '', '', ''], 'seccion');
    (A.conclusiones || []).forEach(function (t) { fila(['· ' + t]); });
    fila(['Carreras con contexto (tus sensaciones del día y lo de las 48 h anteriores)'], 'sub');
    fila(['Fecha', 'Sesión', 'Tipo', 'km', 'Ritmo', 'FC media', 'Eficiencia', 'Cansancio', 'Agujetas', 'Zonas cargadas', '48 h antes'], 'cab');
    (A.contexto || []).forEach(function (x) { fila([isoAFecha(x.fecha), x.sesion, x.tipo, x.km, x.ritmo, x.fc || '', x.efic || '', x.cansancio, x.agujetas, x.zonas, x.antes]); });
    fila(['Por semana'], 'sub');
    fila(['Semana', 'km', 'min totales', 'min Z2', 'sesiones', 'calidad', 'Z6–Z8', 'ritmo Z2', 'FC Z2', 'eficiencia Z2'], 'cab');
    (A.semanas || []).forEach(function (s) { fila([isoAFecha(s.lunes), s.km, s.min, s.minZ2, s.sesiones, s.calidad, s.z68, s.ritmoZ2, s.fcZ2, s.eficZ2]); });
    fila(['']);
    if (false) {
    fila(['SENSACIONES · últimos 10 chequeos', '', '', '', '', '', '', '', '', '', ''], 'seccion');
    fila(['Fecha', 'Cansancio', 'Agujetas', 'Zonas cargadas', '', 'Sueño', 'Listo', 'Semáforo', 'Recomendación'], 'cab');
    listar_(HOJAS.CHEQUEO).sort(function (a, b) { return celdaIso_(a.FECHA) < celdaIso_(b.FECHA) ? 1 : -1; }).slice(0, 10).forEach(function (r) {
      fila([r.FECHA, r['CANSANCIO (1-10)'], r['AGUJETAS (1-10)'], r['ZONAS CARGADAS'], '', r['SUEÑO'], r['LISTO (0-100)'], r['SEMÁFORO'], String(r['RECOMENDACIÓN'] || '').slice(0, 400)]);
    });
    }
    sh.clear(); sh.setConditionalFormatRules([]);
    if (sh.getMaxRows() < filas.length + 5) sh.insertRowsAfter(sh.getMaxRows(), filas.length + 5 - sh.getMaxRows());
    if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
    sh.getRange(1, 1, filas.length, W).setValues(filas.map(function (r) { return r.map(celdaSegura_); }));
    var col = { titulo: ['#121212', '#ffffff', 'bold'], kpi: ['#fff7e0', '#000000', 'bold'], seccion: ['#ff7a1a', '#ffffff', 'bold'], cab: ['#2b2b2b', '#ffffff', 'bold'], sub: ['#f4f5f7', '#000000', 'bold'] };
    var bg = [], fc = [], fw = [];
    for (var f = 1; f <= filas.length; f++) { var k = col[tipos[f]] || ['#ffffff', '#000000', 'normal']; bg.push(new Array(W).fill(k[0])); fc.push(new Array(W).fill(k[1])); fw.push(new Array(W).fill(k[2])); }
    sh.getRange(1, 1, filas.length, W).setBackgrounds(bg).setFontColors(fc).setFontWeights(fw).setVerticalAlignment('top');
    sh.getRange(1, 1).setFontSize(14);
    [150, 90, 260, 20, 90, 260, 80, 160, 110, 260, 140].forEach(function (w, j) { sh.setColumnWidth(j + 1, w); });
    sh.setFrozenRows(4); sh.setTabColor('#ff7a1a');
    return filas.length;
  });
}
function refrescarResumen_() { MEMO = null; try { pintarResumen_(); } catch (e) { Logger.log('Resumen: ' + e); } }

// ===================== v0.11 · UNIFICAR PESTAÑAS =====================
var LEGADO_ = ['Dashboard', 'Semana', 'Mes', 'Guía e histórico', 'APP · ANÁLISIS CARRERA'];
var VISIBLES_ = ['APP · RESUMEN', 'APP · SEMANA EN BLOQUES', 'APP · ESTÍMULOS EN BLOQUES', 'APP · METAS', 'APP · COMPETIS'];   // v0.29 · Sheet limpio: el resto se oculta (sigue funcionando y se ve con «Mostrar hojas»)
/** Una sola vez: copia completa del Sheet en Backups y fuera las pestañas antiguas (Dashboard, Semana, Mes, Guía e histórico, Análisis carrera). */
function unificar_() {
  var cf = leerConfig_();
  if (cf.unificado_v011) return 'ya hecho (' + cf.unificado_v011 + ')';
  var ss = miLibro_(), hay = LEGADO_.filter(function (n) { return ss.getSheetByName(n); });
  var copia = DriveApp.getFileById(CONFIG.SHEET_ID).makeCopy('Road to Elite · copia antes de unificar ' + hoyIso_(), DriveApp.getFolderById(CONFIG.BACKUPS_ID));
  hay.forEach(function (n) { var sh = ss.getSheetByName(n); if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  var chq = ss.getSheetByName(HOJAS.CHEQUEO); if (chq && chq.getLastRow() <= 1) chq.clear();   // vacía: se rehace con las columnas nuevas
  ponerConfig_('unificado_v011', ahora_() + ' · copia: ' + copia.getUrl(), 'Unificación de pestañas v0.11 (copia completa antes de borrar)');
  return 'copia ' + copia.getUrl() + ' · borradas: ' + (hay.join(', ') || 'ninguna');
}
/** Orden: lo que miras primero; las pestañas internas de la app se ocultan (siguen funcionando igual). */
function ordenarHojas_() {
  var ss = miLibro_(), n = 0;
  VISIBLES_.forEach(function (nombre, i) { var sh = ss.getSheetByName(nombre); if (!sh) return; sh.showSheet(); ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); n++; });
  ss.getSheets().forEach(function (sh) { if (VISIBLES_.indexOf(sh.getName()) < 0 && ss.getSheets().filter(function (x) { return !x.isSheetHidden(); }).length > 1) sh.hideSheet(); });
  var r = ss.getSheetByName(HOJAS.RESUMEN); if (r) ss.setActiveSheet(r);
  return n;
}
/** «DATOS A REGISTRAR» sin pulsómetro fuera de la carrera: el feedback es por sensaciones (chequeo). */
function limpiarDatosRegistrar_() {
  var n = 0;
  listar_(HOJAS.ESTIMULOS).forEach(function (r) {
    if (/CARRERA/.test(norm(r.ORIGEN))) return;
    var v = String(r['DATOS A REGISTRAR'] || ''), nv = v.replace(/,?\s*(FC (media|máx|estable)[^,·;]*|pulso[^,·;]*|VFC[^,·;]*)/gi, '').replace(/^\s*,\s*/, '').trim();
    if (nv !== v) { actualizarFila_(HOJAS.ESTIMULOS, r._fila, { 'DATOS A REGISTRAR': nv }); n++; }
  });
  return n;
}

ESQUEMA['APP · PLAN'].cab.push('ALTERNATIVAS'); ESQUEMA['APP · PLAN'].anchos.push(320);

