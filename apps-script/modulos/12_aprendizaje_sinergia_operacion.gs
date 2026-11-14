// ===================== v0.26 · APRENDIZAJE SEMANAL (propuesta vs. lo que hiciste) =====================
/*
 * Libro «Road to Elite · Motor»:
 *  · APRENDIZAJE · SEMANAS   foto de la semana PROPUESTA (al cargar los extras) y de la FINAL (domingo noche).
 *  · APRENDIZAJE · ANÁLISIS  bloque a bloque: dónde lo propuse, dónde acabó, con qué estaba y con qué quedó, qué tenía el día antes / después.
 *  · APRENDIZAJE · DEATHNOTE preguntas para ti (se contestan en la hoja o en la app › Menú › Aprendizaje).
 *  · APRENDIZAJE · REGLAS    lo aprendido, con peso. Lo usa el código (puntuarHuecos_, colocar_) y cualquier IA (reglasAprendidasTexto_, acción «aprendizaje»).
 * Las reglas suman con cada semana que confirma el patrón y pesan más cuando tú contestas. Desactiva una regla con ACTIVA = No.
 */
HOJAS.APR_SEM = 'APRENDIZAJE · SEMANAS'; HOJAS.APR_ANA = 'APRENDIZAJE · ANÁLISIS'; HOJAS.APR_DN = 'APRENDIZAJE · DEATHNOTE'; HOJAS.APR_REG = 'APRENDIZAJE · REGLAS';
ESQ_BD_[HOJAS.APR_SEM] = { cab: ['LUNES', 'FOTO', 'ID', 'FECHA', 'DÍA', 'TURNO', 'POS', 'ORIGEN', 'TÍTULO', 'CÓDIGOS', 'MIN', 'INTENSIDAD', 'ESTADO', 'HECHO', 'CARGAS', 'SESIÓN CON', 'DÍA ANTES', 'DÍA DESPUÉS', 'REEMPLAZA', 'CAPTURADO'],
  anchos: [90, 90, 80, 90, 80, 55, 45, 90, 240, 110, 50, 110, 100, 60, 150, 320, 220, 220, 120, 120], negrita: 'TÍTULO', color: '#7c3aed', fechas: ['LUNES', 'FECHA'], listas: { FOTO: ['PROPUESTA', 'FINAL'] } };
ESQ_BD_[HOJAS.APR_ANA] = { cab: ['LUNES', 'ID', 'BLOQUE', 'ORIGEN', 'CÓDIGOS', 'CAMBIO', 'PROPUESTO', 'FINAL', 'CON QUÉ ESTABA (propuesta)', 'CON QUÉ QUEDÓ (final)', 'DÍA ANTES (propuesta → final)', 'DÍA DESPUÉS (propuesta → final)', 'LECTURA', 'ACTUALIZADO'],
  anchos: [90, 80, 240, 90, 110, 150, 110, 110, 300, 300, 280, 280, 380, 120], negrita: 'BLOQUE', color: '#7c3aed', fechas: ['LUNES'] };
var DN_OPC_ = { movido: ['Interferencia con otro bloque', 'Falta de tiempo ese día', 'Prefiero ese turno siempre', 'Prefiero ese día siempre', 'Fatiga o molestia', 'Solo esta vez (no aprender)'],
  quitado: ['Sin tiempo', 'Demasiada carga en esa sesión', 'No me gusta ahí', 'Fatiga o molestia', 'No me interesa ese estímulo ahora', 'Solo esta vez (no aprender)'],
  anadido: ['Sí, ahí normalmente', 'Sí, pero en cualquier hueco', 'Solo esta vez (no aprender)'],
  orden: ['Sí, siempre en ese orden', 'Solo esta vez (no aprender)'],
  carrera: ['Por la sesión del día anterior', 'Por la sesión del día siguiente', 'Por horario / tiempo', 'Prefiero ese día siempre', 'Prefiero ese turno siempre', 'Solo esta vez (no aprender)'],
  estimulo: ['Prefiero siempre el nuevo', 'No tenía el material', 'Solo esta vez (no aprender)'], ia: [] };
ESQ_BD_[HOJAS.APR_DN] = { cab: ['ID', 'LUNES', 'BLOQUE_ID', 'BLOQUE', 'TIPO', 'PREGUNTA', 'OPCIONES', 'RESPUESTA', 'COMENTARIO', 'ESTADO', 'CONTEXTO', 'CREADO', 'PROCESADO'],
  anchos: [80, 90, 80, 220, 90, 420, 320, 220, 320, 110, 120, 120, 120], negrita: 'PREGUNTA', color: '#111111', fechas: ['LUNES'],
  colores: [['ESTADO', 'PENDIENTE', '#fef3c7'], ['ESTADO', 'APLICADA', '#dcfce7']], listas: { ESTADO: ['PENDIENTE', 'APLICADA', 'DESCARTADA'] } };
ESQ_BD_[HOJAS.APR_REG] = { cab: ['CLAVE', 'TIPO', 'SUJETO', 'VALOR', 'PESO', 'EVIDENCIAS', 'TEXTO', 'ORIGEN', 'ACTIVA', 'ÚLTIMA SEMANA', 'ACTUALIZADO'],
  anchos: [220, 90, 150, 150, 60, 90, 460, 110, 70, 110, 120], negrita: 'TEXTO', color: '#7c3aed', listas: { ACTIVA: ['Sí', 'No'] } };

function dcIso_(iso) { return DIAS_CORTO_[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7]; }
/** Sujeto de una regla: el código del estímulo; sin código, el tipo de bloque de Fabrik. */
function sujetoApr_(r) { var c = codigosDe_(r['CÓDIGOS'])[0]; return c || ((norm(r.ORIGEN) === 'FABRIK' ? 'FAB·' : 'BLQ·') + tipoSeccion_(r)); }
function nombreSujeto_(s) { if (/^(FAB|BLQ)·/.test(s)) return (/^FAB/.test(s) ? 'Fabrik · ' : '') + s.split('·')[1]; var e = catalogo_()[s]; return e ? s + ' ' + (e.NOMBRE || '') : s; }

/** Foto de la semana. tipo: PROPUESTA (lo que te propongo) | FINAL (lo que acabó siendo). soloDias: al regenerar unos días, solo se rehacen esos. */
function fotoSemana_(lunes, tipo, soloDias) {
  lunes = lunesDe_(lunes); var fin = sumarDias(lunes, 6), hechos = {};
  listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN) hechos[r.ID_PLAN] = r.HECHO; });
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && !/^(SUSTITUIDO|OCULTO|PROPUESTA)$/.test(r.ESTADO) && (tipo === 'FINAL' || /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO)); })
    .map(function (r) { r._iso = celdaIso_(r.FECHA); r._turno = r.TURNO === 'AM' ? 'AM' : 'PM'; r._ord = parseFloat(String(r.ORDEN).replace(',', '.')) || 0; r._vivo = /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO); return r; });
  var vivos = plan.filter(function (r) { return r._vivo; });
  var cargasDia = function (iso) { var o = [], duro = false; vivos.filter(function (r) { return r._iso === iso; }).forEach(function (r) { cargasFila_(r).forEach(function (c) { if (o.indexOf(c) < 0) o.push(c); }); if (esDura_(r)) duro = true; }); return (duro ? ['DURA'] : []).concat(o).join(', '); };
  var filas = plan.map(function (r) {
    var ses = vivos.filter(function (x) { return x._iso === r._iso && x._turno === r._turno; }).sort(function (a, b) { return a._ord - b._ord; });
    return { LUNES: isoAFecha(lunes), FOTO: tipo, ID: r.ID, FECHA: isoAFecha(r._iso), 'DÍA': dcIso_(r._iso), TURNO: r._turno, POS: r._vivo ? ses.indexOf(r) + 1 : '', ORIGEN: r.ORIGEN || '', 'TÍTULO': String(r['TÍTULO'] || r.BLOQUE || '').slice(0, 120),
      'CÓDIGOS': r['CÓDIGOS'] || '', MIN: r.MIN || '', INTENSIDAD: r.INTENSIDAD || '', ESTADO: r.ESTADO, HECHO: hechos[r.ID] || '', CARGAS: cargasFila_(r).join(', '),
      'SESIÓN CON': ses.filter(function (x) { return x !== r; }).map(function (x) { return sujetoApr_(x) + '~' + String(x['TÍTULO'] || x.BLOQUE || '').slice(0, 30); }).join(' | '),
      'DÍA ANTES': cargasDia(sumarDias(r._iso, -1)), 'DÍA DESPUÉS': cargasDia(sumarDias(r._iso, 1)), REEMPLAZA: r.REEMPLAZA || '', CAPTURADO: ahora_(), _iso: r._iso };
  });
  var sh = hojaMia_(HOJAS.APR_SEM); if (!sh) return 0;
  var prev = listar_(HOJAS.APR_SEM).filter(function (r) { return celdaIso_(r.LUNES) === lunes && r.FOTO === tipo; }), dias = soloDias && soloDias.length ? soloDias : null;
  var borrar = prev.filter(function (r) { return !dias || dias.indexOf(celdaIso_(r.FECHA)) >= 0; }), quedan = {};
  prev.forEach(function (r) { if (borrar.indexOf(r) < 0) quedan[r.ID] = 1; });
  borrar.map(function (r) { return r._fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
  MEMO = null;
  var nuevas = filas.filter(function (r) { return (!dias || dias.indexOf(r._iso) >= 0) && !quedan[r.ID]; });   // un bloque que ya moviste conserva su sitio propuesto
  filasEnHoja_(HOJAS.APR_SEM, nuevas); MEMO = null;
  return nuevas.length;
}

// ---------- reglas ----------
function reglasAprendidas_() {
  if (reglasAprendidas_.c) return reglasAprendidas_.c;
  var o = []; try { o = listar_(HOJAS.APR_REG).filter(function (r) { return r.ACTIVA !== 'No'; }).map(function (r) { return { tipo: r.TIPO, suj: r.SUJETO, val: r.VALOR, peso: parseFloat(String(r.PESO).replace(',', '.')) || 0, n: +r.EVIDENCIAS || 0, texto: r.TEXTO, origen: r.ORIGEN }; }); } catch (e) {}
  return (reglasAprendidas_.c = o);
}
var UMBRAL_REGLA_ = 1.5;   // por debajo es una observación suelta: todavía no mueve nada
function textoRegla_(tipo, suj, val, peso) {
  var S = nombreSujeto_(suj), pos = peso >= 0;
  if (tipo === 'TURNO') return S + ': ' + (pos ? 'lo sueles poner' : 'evitas ponerlo') + ' por la ' + (val === 'AM' ? 'mañana' : 'tarde') + '.';
  if (tipo === 'DÍA') return S + ': ' + (pos ? 'lo sueles poner' : 'evitas ponerlo') + ' el ' + val + '.';
  if (tipo === 'JUNTO') return S + ': ' + (pos ? 'lo juntas en la misma sesión con ' : 'no lo juntas con ') + nombreSujeto_(val) + '.';
  if (tipo === 'SEPARAR') return S + ': lo separas de ' + nombreSujeto_(val) + ' (no en la misma sesión).';
  if (tipo === 'TRAS') return S + ': no lo quieres el día después de ' + String(val).toLowerCase() + '.';
  if (tipo === 'ANTES') return S + ': no lo quieres el día antes de ' + String(val).toLowerCase() + '.';
  if (tipo === 'ORDEN') return S + ': dentro de la sesión va ' + (val === 'INICIO' ? 'al principio' : val === 'FINAL' ? 'al final' : 'antes de ' + nombreSujeto_(val)) + '.';
  if (tipo === 'QUITA') return S + ': lo quitas a menudo' + (val ? ' (' + val + ')' : '') + '.';
  return S + ': ' + val;
}
/** deltas: [[tipo, sujeto, valor, Δpeso]] */
function sumarReglas_(deltas, lunes, origen) {
  if (!deltas || !deltas.length) return 0;
  var sh = hojaMia_(HOJAS.APR_REG); if (!sh) return 0;
  var ex = {}; listar_(HOJAS.APR_REG).forEach(function (r) { ex[r.CLAVE] = r; });
  var acc = {}; deltas.forEach(function (d) { if (!d || !d[1] || d[2] === '' || d[2] == null) return; var k = d[0] + '|' + d[1] + '|' + d[2]; acc[k] = acc[k] || { t: d[0], s: d[1], v: d[2], p: 0 }; acc[k].p += +d[3] || 0; });
  var nuevas = [];
  Object.keys(acc).forEach(function (k) { var a = acc[k], r = ex[k];
    if (r) { var p = Math.max(-8, Math.min(8, (parseFloat(String(r.PESO).replace(',', '.')) || 0) + a.p)); p = Math.round(p * 100) / 100;
      actualizarFila_(HOJAS.APR_REG, r._fila, { PESO: String(p).replace('.', ','), EVIDENCIAS: String((+r.EVIDENCIAS || 0) + 1), TEXTO: textoRegla_(a.t, a.s, a.v, p), ORIGEN: origen === 'respuesta' ? 'respuesta' : (r.ORIGEN || 'auto'), 'ÚLTIMA SEMANA': lunes ? isoAFecha(lunes) : r['ÚLTIMA SEMANA'], ACTUALIZADO: ahora_() }); }
    else if (a.p) nuevas.push({ CLAVE: k, TIPO: a.t, SUJETO: a.s, VALOR: a.v, PESO: String(Math.round(a.p * 100) / 100).replace('.', ','), EVIDENCIAS: '1', TEXTO: textoRegla_(a.t, a.s, a.v, a.p), ORIGEN: origen || 'auto', ACTIVA: 'Sí', 'ÚLTIMA SEMANA': lunes ? isoAFecha(lunes) : '', ACTUALIZADO: ahora_() });
  });
  filasEnHoja_(HOJAS.APR_REG, nuevas); MEMO = null; reglasAprendidas_.c = null;
  return Object.keys(acc).length;
}
/** Sesgo de lo aprendido para colocar un bloque (negativo = mejor hueco). d: { iso, codigosSesion[], cargasAntes[], cargasDespues[] } */
function sesgoAprendido_(codigos, d, turno) {
  var R = reglasAprendidas_(), p = 0, pro = [], contra = []; if (!R.length || !codigos || !codigos.length) return { p: 0, pro: pro, contra: contra };
  var dia = dcIso_(d.iso), lim = function (x) { return Math.max(-4, Math.min(4, x)); };
  R.forEach(function (r) {
    if (codigos.indexOf(r.suj) < 0 || Math.abs(r.peso) < UMBRAL_REGLA_) return;
    var k = 0;
    if (r.tipo === 'TURNO' && r.val === turno) k = -lim(r.peso) * 0.8;
    else if (r.tipo === 'DÍA' && r.val === dia) k = -lim(r.peso) * 0.6;
    else if (r.tipo === 'JUNTO' && (d.codigosSesion || []).indexOf(r.val) >= 0) k = -lim(r.peso) * 0.7;
    else if (r.tipo === 'SEPARAR' && (d.codigosSesion || []).indexOf(r.val) >= 0) k = Math.abs(lim(r.peso)) * 1.0;
    else if (r.tipo === 'TRAS' && (d.cargasAntes || []).indexOf(r.val) >= 0) k = Math.abs(lim(r.peso)) * 0.9;
    else if (r.tipo === 'ANTES' && (d.cargasDespues || []).indexOf(r.val) >= 0) k = Math.abs(lim(r.peso)) * 0.9;
    if (!k) return; p += k; (k < 0 ? pro : contra).push('🧠 ' + r.texto);
  });
  return { p: Math.round(p * 10) / 10, pro: pro, contra: contra };
}
/** Para cualquier IA (Gemini, Claude): lo aprendido en texto, lo más firme primero. */
function reglasAprendidasTexto_(max) {
  var R = reglasAprendidas_().filter(function (r) { return Math.abs(r.peso) >= UMBRAL_REGLA_ || r.tipo === 'NOTA'; }).sort(function (a, b) { return Math.abs(b.peso) - Math.abs(a.peso); }).slice(0, max || 40);
  if (!R.length) return '';
  return 'PREFERENCIAS APRENDIDAS DE PABLO AL COLOCAR BLOQUES (peso = firmeza; respétalas salvo que rompan una regla de seguridad o de 48 h):\n' + R.map(function (r) { return '- [' + r.peso + '] ' + r.texto + (r.origen === 'respuesta' ? ' (lo confirmó él)' : ''); }).join('\n');
}

// ---------- comparar propuesta y final ----------
function analizarSemana_(lunes) {
  lunes = lunesDe_(lunes);
  var fotos = listar_(HOJAS.APR_SEM).filter(function (r) { return celdaIso_(r.LUNES) === lunes; });
  var P = {}, F = {}; fotos.forEach(function (r) { (r.FOTO === 'FINAL' ? F : P)[r.ID] = r; });
  if (!Object.keys(P).length) return { error: 'sin_propuesta', preguntas: 0, analisis: 0 };
  if (!Object.keys(F).length) return { error: 'sin_final', preguntas: 0, analisis: 0 };
  var vivo = function (r) { return r && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO); };
  var suj = function (r) { return sujetoApr_(r); }, con = function (r) { return String(r['SESIÓN CON'] || '').split(' | ').filter(Boolean).map(function (x) { return x.split('~')[0]; }); };
  var conTxt = function (r) { return String(r['SESIÓN CON'] || '').split(' | ').filter(Boolean).map(function (x) { return x.split('~')[1] || x; }).join(' · ') || '—'; };
  var lista = function (t) { return String(t || '').split(/\s*,\s*/).filter(Boolean); }, sitio = function (r) { return r['DÍA'] + ' ' + r.TURNO + ' · ' + (r.POS || '–') + 'º'; };
  var esCarr = function (r) { return /CARRERA|Z6/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R01|R02|R03|V01)\b/.test(r['CÓDIGOS'] || ''); };
  var fusion = {}; Object.keys(F).forEach(function (id) { String(F[id].REEMPLAZA || '').split(',').filter(Boolean).forEach(function (o) { fusion[o] = F[id]; }); });
  var ana = [], preg = [], deltas = [], nPreg = 0, MAXQ = 14;
  var q = function (r, tipo, texto, ctx, autos) { if (nPreg >= MAXQ) return; nPreg++; ctx = ctx || {}; ctx.a = autos || [];
    preg.push({ ID: 'DN' + nuevoId_(), LUNES: isoAFecha(lunes), BLOQUE_ID: r.ID, BLOQUE: r['TÍTULO'], TIPO: tipo, PREGUNTA: texto, OPCIONES: (DN_OPC_[tipo] || []).join(' | '), RESPUESTA: '', COMENTARIO: '', ESTADO: 'PENDIENTE', CONTEXTO: JSON.stringify(ctx).slice(0, 4000), CREADO: ahora_() }); };
  var push = function (r, cambio, p, f, lectura) { ana.push({ LUNES: isoAFecha(lunes), ID: r.ID, BLOQUE: r['TÍTULO'], ORIGEN: r.ORIGEN, 'CÓDIGOS': r['CÓDIGOS'], CAMBIO: cambio, PROPUESTO: p ? sitio(p) : '—', FINAL: f && vivo(f) ? sitio(f) : (f ? f.ESTADO : '—'),
    'CON QUÉ ESTABA (propuesta)': p ? conTxt(p) : '—', 'CON QUÉ QUEDÓ (final)': f && vivo(f) ? conTxt(f) : '—', 'DÍA ANTES (propuesta → final)': (p ? p['DÍA ANTES'] || 'nada' : '—') + ' → ' + (f && vivo(f) ? f['DÍA ANTES'] || 'nada' : '—'),
    'DÍA DESPUÉS (propuesta → final)': (p ? p['DÍA DESPUÉS'] || 'nada' : '—') + ' → ' + (f && vivo(f) ? f['DÍA DESPUÉS'] || 'nada' : '—'), LECTURA: lectura || '', ACTUALIZADO: ahora_() }); };
  Object.keys(P).forEach(function (id) {
    var p = P[id], f = F[id], s = suj(p);
    if (fusion[id]) { push(p, 'Fusionado', p, fusion[id], 'Lo uniste en «' + fusion[id]['TÍTULO'] + '».');
      var otros = String(fusion[id].REEMPLAZA).split(',').filter(function (o) { return o !== id && P[o]; }).map(function (o) { return suj(P[o]); });
      otros.forEach(function (o) { deltas.push(['JUNTO', s, o, 1]); }); return; }
    if (!f || !vivo(f)) {
      var est = f ? f.ESTADO : 'BORRADO', au = [['QUITA', s, p.TURNO, 1]];
      push(p, est === 'CANCELADO' ? 'Cancelado' : /NO HACER/.test(est) ? 'A pendientes' : 'Quitado', p, f, 'Estaba el ' + sitio(p) + ' con: ' + conTxt(p) + '.');
      if (norm(p.ORIGEN) !== 'FABRIK') { deltas = deltas.concat(au); q(p, 'quitado', 'Quitaste «' + p['TÍTULO'] + '» (' + p['DÍA'] + ' ' + p.TURNO + ', junto a: ' + conTxt(p) + '). ¿Por qué?', { s: s, tp: p.TURNO, dp: p['DÍA'], vp: con(p) }, au); }
      return;
    }
    var mDia = p['DÍA'] !== f['DÍA'], mTur = p.TURNO !== f.TURNO, vp = con(p), vf = con(f), nuevosV = vf.filter(function (x) { return vp.indexOf(x) < 0; }), fueraV = vp.filter(function (x) { return vf.indexOf(x) < 0; });
    var antP = lista(p['DÍA ANTES']), antF = lista(f['DÍA ANTES']), desP = lista(p['DÍA DESPUÉS']), desF = lista(f['DÍA DESPUÉS']);
    var estimulo = String(p['CÓDIGOS'] || '') !== String(f['CÓDIGOS'] || '');
    if (estimulo) { push(p, 'Estímulo cambiado', p, f, (p['CÓDIGOS'] || '—') + ' → ' + (f['CÓDIGOS'] || '—'));
      q(f, 'estimulo', 'Cambiaste el estímulo de «' + p['TÍTULO'] + '» (' + (p['CÓDIGOS'] || '—') + ') por «' + f['TÍTULO'] + '» (' + (f['CÓDIGOS'] || '—') + '). ¿Por qué?', { s: s, sf: suj(f) }, []); }
    if (mDia || mTur) {
      var au2 = [];
      if (mTur) { au2.push(['TURNO', s, f.TURNO, 1]); au2.push(['TURNO', s, p.TURNO, -0.5]); }
      if (mDia) { au2.push(['DÍA', s, f['DÍA'], 0.75]); au2.push(['DÍA', s, p['DÍA'], -0.4]); }
      nuevosV.forEach(function (x) { au2.push(['JUNTO', s, x, 0.75]); }); fueraV.forEach(function (x) { au2.push(['SEPARAR', s, x, 0.5]); });
      antP.filter(function (c) { return antF.indexOf(c) < 0 && (esCarr(p) ? /^(DURA|PIERNA|SNC|IMPACTO)$/ : /^(DURA|PIERNA|SNC|HOMBRO|AGARRE|IMPACTO)$/).test(c) && (c === 'DURA' || lista(p.CARGAS).indexOf(c) >= 0 || esCarr(p)); }).forEach(function (c) { au2.push(['TRAS', s, c, 0.6]); });
      desP.filter(function (c) { return desF.indexOf(c) < 0 && /^(DURA|PIERNA|SNC)$/.test(c); }).forEach(function (c) { au2.push(['ANTES', s, c, 0.4]); });
      deltas = deltas.concat(au2);
      var lec = 'De ' + sitio(p) + ' a ' + sitio(f) + '.' + (nuevosV.length ? ' Ahora comparte sesión con ' + nuevosV.map(nombreSujeto_).join(', ') + '.' : '') + (fueraV.length ? ' Ya no está con ' + fueraV.map(nombreSujeto_).join(', ') + '.' : '') +
        (antP.join() !== antF.join() ? ' Día anterior: ' + (antP.join(', ') || 'nada') + ' → ' + (antF.join(', ') || 'nada') + '.' : '') + (desP.join() !== desF.join() ? ' Día siguiente: ' + (desP.join(', ') || 'nada') + ' → ' + (desF.join(', ') || 'nada') + '.' : '');
      push(p, mDia && mTur ? 'Movido de día y turno' : mDia ? 'Movido de día' : 'Movido de turno', p, f, lec);
      var ctx = { s: s, tp: p.TURNO, tf: f.TURNO, dp: p['DÍA'], df: f['DÍA'], vp: vp, vf: vf, ap: antP, af: antF, sp: desP, sf2: desF };
      if (esCarr(p)) q(f, 'carrera', 'La carrera «' + p['TÍTULO'] + '» la propuse el ' + p['DÍA'] + ' ' + p.TURNO + ' (día antes: ' + (antP.join(', ') || 'nada duro') + '; día después: ' + (desP.join(', ') || 'nada duro') + ') y acabó el ' + f['DÍA'] + ' ' + f.TURNO + ' (día antes: ' + (antF.join(', ') || 'nada duro') + '; después: ' + (desF.join(', ') || 'nada duro') + '). ¿Por qué ahí?', ctx, au2);
      else q(f, 'movido', 'Moviste «' + p['TÍTULO'] + '» de ' + p['DÍA'] + ' ' + p.TURNO + ' (con: ' + conTxt(p) + ') a ' + f['DÍA'] + ' ' + f.TURNO + ' (con: ' + conTxt(f) + '). ¿Por qué?', ctx, au2);
      return;
    }
    if (String(p.POS) !== String(f.POS) && vp.join() === vf.join() && vp.length) {
      var au3 = [['ORDEN', s, +f.POS === 1 ? 'INICIO' : +f.POS === vf.length + 1 ? 'FINAL' : 'MEDIO', 0.75]];
      if (au3[0][2] !== 'MEDIO') deltas = deltas.concat(au3); else au3 = [];
      push(p, 'Reordenado', p, f, 'Mismo día y turno, pasa de ' + p.POS + 'º a ' + f.POS + 'º.');
      q(f, 'orden', 'Dentro del ' + f['DÍA'] + ' ' + f.TURNO + ' pusiste «' + p['TÍTULO'] + '» en el puesto ' + f.POS + ' (yo lo puse en el ' + p.POS + '). ¿Siempre en ese orden?', { s: s, pos: au3.length ? au3[0][2] : '' }, au3);
      return;
    }
    if (!estimulo) { push(p, 'Igual', p, f, f.HECHO === 'Sí' ? 'Lo dejaste donde lo propuse y lo hiciste.' : 'Lo dejaste donde lo propuse.');
      if (norm(p.ORIGEN) !== 'FABRIK') { deltas.push(['TURNO', s, f.TURNO, 0.25]); deltas.push(['DÍA', s, f['DÍA'], 0.15]); } }   // confirmación suave
  });
  Object.keys(F).forEach(function (id) {
    var f = F[id]; if (P[id] || !vivo(f)) return;
    if (norm(f.ORIGEN) === 'FUSION' || f.REEMPLAZA) { push(f, 'Bloque fusionado (nuevo)', null, f, 'Une: ' + f.REEMPLAZA); return; }
    var s = suj(f), au = [['TURNO', s, f.TURNO, 0.5], ['DÍA', s, f['DÍA'], 0.4]].concat(con(f).map(function (x) { return ['JUNTO', s, x, 0.5]; }));
    deltas = deltas.concat(au);
    push(f, 'Añadido por ti', null, f, 'No estaba en mi propuesta. Quedó el ' + sitio(f) + ' con: ' + conTxt(f) + '.');
    q(f, 'anadido', 'Añadiste «' + f['TÍTULO'] + '» el ' + f['DÍA'] + ' ' + f.TURNO + ' (con: ' + conTxt(f) + '). ¿Lo quieres ahí normalmente?', { s: s, tf: f.TURNO, df: f['DÍA'], vf: con(f) }, au);
  });
  // escribir (se rehace la semana entera si se repite el análisis; las preguntas ya contestadas se conservan)
  var borra = function (hoja, test) { var sh = hojaMia_(hoja); listar_(hoja).filter(test).map(function (r) { return r._fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); }); MEMO = null; };
  var yaHecho = String(leerConfig_()['aprendizaje_' + lunes] || '');
  borra(HOJAS.APR_ANA, function (r) { return celdaIso_(r.LUNES) === lunes; });
  filasEnHoja_(HOJAS.APR_ANA, ana); MEMO = null;
  if (!yaHecho) {   // reglas y preguntas: una sola vez por semana (no se duplican evidencias)
    sumarReglas_(deltas, lunes, 'auto');
    filasEnHoja_(HOJAS.APR_DN, preg); MEMO = null;
    ponerConfig_('aprendizaje_' + lunes, ahora_() + ' · ' + ana.length + ' bloques · ' + preg.length + ' preguntas', 'Análisis semanal de aprendizaje (propuesta vs final)');
  }
  return { analisis: ana.length, cambios: ana.filter(function (a) { return a.CAMBIO !== 'Igual'; }).length, preguntas: yaHecho ? 0 : preg.length, reglas: yaHecho ? 0 : deltas.length };
}

// ---------- respuestas del deathnote → reglas ----------
function procesarDeathnote_() {
  var filas = []; try { filas = listar_(HOJAS.APR_DN).filter(function (r) { return r.ESTADO === 'PENDIENTE' && (String(r.RESPUESTA || '').trim() || String(r.COMENTARIO || '').trim()); }); } catch (e) { return 0; }
  filas.forEach(function (r) {
    var c = {}; try { c = JSON.parse(r.CONTEXTO || '{}'); } catch (e) {}
    var R = norm(r.RESPUESTA || ''), d = [], autos = c.a || [], s = c.s, lunes = celdaIso_(r.LUNES);
    var revertir = function () { autos.forEach(function (a) { d.push([a[0], a[1], a[2], -a[3]]); }); };
    if (/SOLO ESTA VEZ|NO APRENDER|CASUALIDAD|FALTA DE TIEMPO|SIN TIEMPO|HORARIO|FATIGA|MOLESTIA|MATERIAL/.test(R)) revertir();   // no era una preferencia: lo observado no cuenta
    else if (/TURNO SIEMPRE/.test(R) && c.tf) { d.push(['TURNO', s, c.tf, 3]); if (c.tp && c.tp !== c.tf) d.push(['TURNO', s, c.tp, -2]); }
    else if (/DIA SIEMPRE/.test(R) && c.df) { d.push(['DÍA', s, c.df, 3]); }
    else if (/INTERFERENCIA/.test(R)) { (c.vp || []).filter(function (x) { return (c.vf || []).indexOf(x) < 0; }).forEach(function (x) { d.push(['SEPARAR', s, x, 2]); });
      (c.ap || []).filter(function (x) { return (c.af || []).indexOf(x) < 0; }).forEach(function (x) { d.push(['TRAS', s, x, 2]); }); (c.sp || []).filter(function (x) { return (c.sf2 || []).indexOf(x) < 0; }).forEach(function (x) { d.push(['ANTES', s, x, 1.5]); }); }
    else if (/DIA ANTERIOR/.test(R)) (c.ap || []).filter(function (x) { return (c.af || []).indexOf(x) < 0; }).forEach(function (x) { d.push(['TRAS', s, x, 3]); });
    else if (/DIA SIGUIENTE/.test(R)) (c.sp || []).filter(function (x) { return (c.sf2 || []).indexOf(x) < 0; }).forEach(function (x) { d.push(['ANTES', s, x, 3]); });
    else if (/DEMASIADA CARGA/.test(R)) (c.vp || []).forEach(function (x) { d.push(['SEPARAR', s, x, 1.5]); });
    else if (/NO ME GUSTA AHI/.test(R)) { if (c.tp) d.push(['TURNO', s, c.tp, -2]); if (c.dp) d.push(['DÍA', s, c.dp, -1.5]); }
    else if (/NO ME INTERESA/.test(R)) d.push(['QUITA', s, 'no interesa ahora', 3]);
    else if (/AHI NORMALMENTE/.test(R)) { if (c.tf) d.push(['TURNO', s, c.tf, 2.5]); if (c.df) d.push(['DÍA', s, c.df, 2]); (c.vf || []).forEach(function (x) { d.push(['JUNTO', s, x, 1.5]); }); }
    else if (/CUALQUIER HUECO/.test(R)) revertir();
    else if (/SIEMPRE EN ESE ORDEN/.test(R) && c.pos) d.push(['ORDEN', s, c.pos, 3]);
    else if (/SIEMPRE EL NUEVO/.test(R) && c.sf) d.push(['NOTA', s, 'prefiere ' + nombreSujeto_(c.sf) + ' en su lugar', 3]);
    var com = String(r.COMENTARIO || '').trim();
    if (com) d.push(['NOTA', s || 'GENERAL', com.slice(0, 300), 2]);
    if (!d.length && String(r.RESPUESTA || '').trim()) d.push(['NOTA', s || 'GENERAL', String(r.RESPUESTA).trim().slice(0, 300), 2]);   // respuesta libre
    sumarReglas_(d, lunes, 'respuesta');
    actualizarFila_(HOJAS.APR_DN, r._fila, { ESTADO: 'APLICADA', PROCESADO: ahora_() });
  });
  if (filas.length) { MEMO = null; reglasAprendidas_.c = null; }
  return filas.length;
}
/** Gemini (gratis) lee el análisis de la semana y añade su lectura y hasta 4 preguntas más. Si falla, no pasa nada. */
function aprendizajeIA_(lunes) {
  if (!PROPS.getProperty('GEMINI_KEY')) return 0;
  var ana = listar_(HOJAS.APR_ANA).filter(function (r) { return celdaIso_(r.LUNES) === lunes && r.CAMBIO !== 'Igual'; }); if (!ana.length) return 0;
  var g = geminiLlamar_('Eres preparador físico de un atleta de CrossFit RX que corre (híbrido). Yo le propongo cada semana dónde colocar sus bloques y él los cambia. Estos son los cambios de esta semana (PROPUESTO → FINAL, con qué compartía sesión y qué había el día antes y después):\n' +
    ana.map(function (a) { return '- ' + a.BLOQUE + ' [' + a['CÓDIGOS'] + '] · ' + a.CAMBIO + ' · ' + a.PROPUESTO + ' → ' + a.FINAL + ' · ' + a.LECTURA; }).join('\n').slice(0, 6000) + '\n\n' + reglasAprendidasTexto_(25) +
    '\n\nResponde en español, sin markdown. Primero 3–5 frases con los patrones que ves (qué intenta evitar o conseguir con sus cambios, sobre todo con la carrera). Después, hasta 4 preguntas concretas que le harías para afinar la programación, cada una en una línea que empiece por «? ». No inventes datos.', 900, 0.3);
  if (!g.ok || !g.texto) return 0;
  var lineas = String(g.texto).split('\n'), qs = lineas.filter(function (l) { return /^\s*\?\s+/.test(l); }).slice(0, 4), lectura = lineas.filter(function (l) { return !/^\s*\?\s+/.test(l); }).join(' ').trim();
  filasEnHoja_(HOJAS.APR_ANA, [{ LUNES: isoAFecha(lunes), ID: 'IA', BLOQUE: 'LECTURA DE LA SEMANA (Gemini)', CAMBIO: 'IA', LECTURA: lectura.slice(0, 3000), ACTUALIZADO: ahora_() }]);
  filasEnHoja_(HOJAS.APR_DN, qs.map(function (l) { return { ID: 'DN' + nuevoId_(), LUNES: isoAFecha(lunes), BLOQUE: 'Pregunta de la IA', TIPO: 'ia', PREGUNTA: l.replace(/^\s*\?\s+/, '').slice(0, 500), OPCIONES: '', ESTADO: 'PENDIENTE', CONTEXTO: '{}', CREADO: ahora_() }; }));
  MEMO = null; return qs.length;
}
/** Domingo noche: foto FINAL, comparación, reglas y deathnote. También a mano desde el menú. */
function aprendizajeSemanal(lunesRef) {
  var hoy = hoyIso_(); if (!lunesRef && new Date(hoy + 'T12:00:00Z').getUTCDay() === 1) hoy = sumarDias(hoy, -1);
  var lunes = lunesDe_(typeof lunesRef === 'string' && lunesRef ? lunesRef : hoy);
  procesarDeathnote_();
  fotoSemana_(lunes, 'FINAL');
  var r = analizarSemana_(lunes);
  try { aprenderDeResultados_(lunes); } catch (eR) { Logger.log('Aprender de resultados: ' + eR); }   // v0.29
  if (r.error) return 'sin análisis (' + r.error + ')';
  var nia = 0; if (r.preguntas || r.reglas) { try { nia = aprendizajeIA_(lunes); } catch (e) {} }
  try { if (r.preguntas + nia > 0 && pushActivo_()) enviarPush_('Deathnote de la semana', (r.preguntas + nia) + ' preguntas sobre tus cambios (' + r.cambios + ' bloques). Contéstalas en Menú › Aprendizaje: cada respuesta afina la programación.'); } catch (e) {}
  return r.analisis + ' bloques · ' + r.cambios + ' cambios · ' + (r.preguntas + nia) + ' preguntas';
}
function menuAprendizaje() { var t = aprendizajeSemanal(leerConfig_().semana_bloques || ''); SpreadsheetApp.getUi().alert('Aprendizaje: ' + t + '\n\nResponde en «Road to Elite · Motor» › ' + HOJAS.APR_DN + ' o en la app › Menú › Aprendizaje.'); }
function datosAprendizaje_() {
  procesarDeathnote_();
  var dn = listar_(HOJAS.APR_DN);
  return { preguntas: dn.filter(function (r) { return r.ESTADO === 'PENDIENTE'; }).map(function (r) { return { id: r.ID, lunes: celdaIso_(r.LUNES), bloque: r.BLOQUE, tipo: r.TIPO, pregunta: r.PREGUNTA, opciones: String(r.OPCIONES || '').split(' | ').filter(Boolean) }; }),
    contestadas: dn.filter(function (r) { return r.ESTADO === 'APLICADA'; }).length,
    reglas: listar_(HOJAS.APR_REG).map(function (r) { var pe = parseFloat(String(r.PESO).replace(',', '.')) || 0; return { clave: r.CLAVE, texto: r.TEXTO, peso: pe, n: +r.EVIDENCIAS || 0, origen: r.ORIGEN, activa: r.ACTIVA !== 'No', firme: r.ACTIVA !== 'No' && (Math.abs(pe) >= UMBRAL_REGLA_ || r.TIPO === 'NOTA') }; }).sort(function (a, b) { return Math.abs(b.peso) - Math.abs(a.peso); }).slice(0, 80),
    texto: reglasAprendidasTexto_(40) };
}
function responderDeathnote_(respuestas) {
  var dn = listar_(HOJAS.APR_DN), n = 0;
  (respuestas || []).forEach(function (a) { var r = dn.filter(function (x) { return x.ID === String(a.id); })[0]; if (!r || r.ESTADO !== 'PENDIENTE') return;
    if (a.descartar) { actualizarFila_(HOJAS.APR_DN, r._fila, { ESTADO: 'DESCARTADA', PROCESADO: ahora_() }); n++; return; }
    if (!String(a.respuesta || '').trim() && !String(a.comentario || '').trim()) return;
    actualizarFila_(HOJAS.APR_DN, r._fila, { RESPUESTA: String(a.respuesta || '').slice(0, 300), COMENTARIO: String(a.comentario || '').slice(0, 600) }); n++; });
  MEMO = null; procesarDeathnote_();
  return n;
}

// ===================== v0.27 · SINERGIA entre estímulos y con Fabrik + orden de prioridades =====================
/*
 * Además de evitar choques, cada hueco se puntúa por lo que APORTA (menor = mejor):
 *  · técnica y skills → frescos (tras día suave) o como preparación del mismo patrón que trae Fabrik ese día;
 *  · fatiga específica → detrás del trabajo principal del mismo patrón (la fatiga es el estímulo), nunca la víspera de técnica o de un pesado;
 *  · potencia / pliometría / contraste → el día de pierna pesada, ANTES (potenciación), nunca el día después;
 *  · accesorios de fuerza → agrupados con el día que ya carga esa zona (días duros, duros; días suaves, suaves);
 *  · ergo Z2 → flush el día de pierna pesada o el siguiente;
 *  · parejas que se integran en la misma sesión (cuentan las dos sin otra sesión);
 *  · se protege el día pesado de Fabrik (RM): nada que fatigue esa zona la víspera.
 */
var FAM_ = {
  tecnica: /^(W13|W15|W16|W17|W20|W23|W24|W25|W26|W27|W28|W32|W33|W10|M10|M11|M30|M31|M35|M36|M50|M51|M32)$/,
  fatiga: /^(W31|W34|M01|M02|M48|M49|M17|M54|M55|M37|C01|C02|C03|C04|T02)$/,
  potencia: /^(W07|W08|M52|V01)$/,
  accesorio: /^(M45|M61|M28|M47|M46|M19|M20|M13|M14|M44|M58|M53|M56|M59|M08|M60|M62|T01|T03|M38|M57)$/,
  flush: /^(W03)$/
};
var PAREJAS_ = [['W33', 'M56'], ['W32', 'M56'], ['W17', 'M53'], ['W15', 'M53'], ['W16', 'M53'], ['W07', 'M52'], ['T01', 'M33'], ['T02', 'M33'], ['T02', 'M32'], ['T02', 'C01'], ['T03', 'C01'], ['M45', 'M61'], ['M08', 'M60'], ['M46', 'M08'], ['W13', 'M30'], ['W20', 'M50'], ['W23', 'M51'], ['W24', 'M51'], ['M47', 'M28'], ['M36', 'M59']];
var ZONA_FAM_ = ['PIERNA', 'HOMBRO', 'AGARRE', 'CORE'];
function familiaSin_(cods) { var f = ''; Object.keys(FAM_).some(function (k) { if (cods.some(function (c) { return FAM_[k].test(c); })) { f = k; return true; } return false; }); return f; }
function sinergia_(cand, d, t, i, ctx, hoy, ant, sig) {
  var fam = familiaSin_(cand.codigos), p = 0, pro = [], contra = [], carga = cand.carga || [];
  var zona = carga.filter(function (c) { return ZONA_FAM_.indexOf(c) >= 0; }), mismaHoy = zona.filter(function (c) { return hoy.indexOf(c) >= 0; }), mismaSig = zona.filter(function (c) { return sig.indexOf(c) >= 0; }), mismaAnt = zona.filter(function (c) { return ant.indexOf(c) >= 0; });
  var dAnt = ctx.dias[i - 1], dSig = ctx.dias[i + 1], pesadoSig = sig.indexOf('SNC') >= 0, pesadoHoy = hoy.indexOf('SNC') >= 0;
  var sesion = t === 'AM' ? (d.codigosAM || []) : d.codigos.filter(function (c) { return (d.codigosAM || []).indexOf(c) < 0; });
  if (fam === 'tecnica') {
    if (dAnt && !dAnt.duro && !mismaAnt.length) { p -= 1.2; pro.push('⚡ llegas fresco de esa zona: la técnica se fija mejor'); }
    if (mismaHoy.length && d.fabrik && d.rpe < 9) { p -= 1.8; pro.push('⚡ mismo patrón que Fabrik ese día: sirve de preparación y concentra el trabajo técnico'); }
    if (sesion.some(function (c) { return FAM_.fatiga.test(c); })) { p += 2; contra.push('en esa sesión ya hay un estímulo de fatiga: la técnica va antes o en otra sesión'); }
    if (dAnt && dAnt.duro && mismaAnt.length) { p += 1.5; contra.push('la zona viene cargada de ayer: peor calidad técnica'); }
  } else if (fam === 'fatiga') {
    if (t === 'PM' && d.fabrik && (mismaHoy.length || d.rpe >= 7)) { p -= 2.2; pro.push('⚡ va detrás del trabajo principal del mismo patrón: la fatiga previa es el estímulo'); }
    if (pesadoSig && mismaSig.length) { p += 2.5; contra.push('mañana Fabrik va pesado en esa zona: protege la marca'); }
    if (dSig && dSig.codigos.some(function (c) { return FAM_.tecnica.test(c); }) && mismaSig.length) { p += 1.2; contra.push('mañana hay técnica de esa zona'); }
  } else if (fam === 'potencia') {
    if (pesadoHoy && hoy.indexOf('PIERNA') >= 0) { p -= 2; pro.push('⚡ el día de pierna pesada, ANTES de la barra: potenciación y un solo día de estrés nervioso'); }
    if (dAnt && !dAnt.duro && ant.indexOf('PIERNA') < 0) { p -= 0.8; pro.push('⚡ piernas frescas: saltos y velocidad de calidad'); }
    if (ant.indexOf('PIERNA') >= 0 && ant.indexOf('SNC') >= 0) { p += 2.5; contra.push('ayer pierna pesada: la potencia no sale'); }
  } else if (fam === 'accesorio') {
    if (mismaHoy.length && d.rpe < 9) { p -= 2.6; pro.push('⚡ agrupado con el día que ya carga ' + mismaHoy[0].toLowerCase() + ': días duros duros, días suaves suaves'); }
    else if (!mismaHoy.length && (mismaAnt.length || mismaSig.length) && !d.duro) { p += 1.2; contra.push('cargaría ' + (zona[0] || 'la zona').toLowerCase() + ' en su día de recuperación'); }
    if (pesadoSig && mismaSig.length) { p += 2; contra.push('mañana Fabrik va pesado en esa zona: protege la marca'); }
  } else if (fam === 'flush') {
    if ((pesadoHoy && hoy.indexOf('PIERNA') >= 0 && t === 'AM') || (ant.indexOf('PIERNA') >= 0 && ant.indexOf('SNC') >= 0)) { p -= 1.5; pro.push('⚡ flush de pierna pesada: Z2 sin impacto que acelera la recuperación'); }
  }
  PAREJAS_.forEach(function (pr) {
    var a = cand.codigos.indexOf(pr[0]) >= 0 ? pr[1] : cand.codigos.indexOf(pr[1]) >= 0 ? pr[0] : '';
    if (a && sesion.indexOf(a) >= 0) { p -= 3.2; pro.push('⚡ se integra con ' + a + ' en la misma sesión: se potencian y no hace falta otra'); }   // compensa «ya hay un extra en esa sesión»
  });
  return { p: Math.round(p * 10) / 10, pro: pro, contra: contra };
}
/** Orden al elegir qué entra cuando no cabe todo: rendimiento → skills y carencias → marcas. (Pablo, 13/11/2026) */
function pesoObjetivo_(m) {
  var t = norm(String(m.PRIORIDAD || m.prioridad || '') + ' ' + String(m['ESTÍMULO'] || m.estimulo || ''));
  if (/ENDURANCE|POTENCIA|FATIGA|COMPETICION|BARBELL CYCLING|RESISTENCIA|HYROX|Z6|THRUSTER/.test(t)) return 0.45;   // rendimiento
  if (/HSPU|RMU|BMU|PINO|GIMNAST|COMBA|CUERDA|UNILATERAL|ESTABILIDAD|HALTERO|C2B|PISTOL/.test(t)) return 0.3;      // skills y carencias
  return 0.15;                                                                                                       // base de fuerza / accesorios
}

// ===================== v0.27 · MODO OPERACIÓN CAPILAR =====================
/*
 * Especificación: doc del proyecto claude/MODO_OPERACION_CAPILAR.md (base clínica: claude/implante-capilar-rendimiento.md).
 * Modo temporal: PREVIA (reserva) → DESCARGA (D−3..D−1) → D0 → 7 fases post → FIN (D48).
 *  · Una fase post solo empieza con la autorización de la clínica marcada; si falta, se prolonga la anterior y se desplazan las siguientes.
 *  · Una alarma (sangrado, fiebre, dolor creciente, golpe) congela la fase.
 *  · El filtro de movimientos se aplica a lo que se ENSEÑA de Fabrik (app y Sheet). FABRIK PROGRAM no se toca nunca (DIRECTOR.md).
 *  · La intensidad (calidad en erg, P1–P4, metcons) vuelve en cuanto la clínica autoriza «ejercicio_intenso», no antes.
 */
HOJAS.OPERACION = 'APP · OPERACIÓN';
ESQUEMA[HOJAS.OPERACION] = { cab: ['ID', 'FECHA', 'DN', 'FASE', 'TIPO', 'AUTORIZACIONES', 'SANGRADO', 'DOLOR CRECIENTE', 'ENROJECIMIENTO', 'HINCHAZÓN', 'FIEBRE ≥38', 'GOLPE EN LA ZONA', 'NOTA SÍNTOMAS', 'ACTIVIDAD', 'MIN', 'RPE', 'FATIGA (1-10)', 'AGUJETAS (1-10)', 'ZONAS CARGADAS', 'RESPUESTA DÍA SIGUIENTE', 'DECISIÓN', 'REFERENCIA', 'VALOR', 'NOTAS', 'REGISTRADO'],
  anchos: [80, 95, 50, 170, 110, 220, 80, 90, 100, 90, 80, 100, 220, 220, 50, 50, 70, 70, 160, 120, 110, 200, 220, 260, 130], fechas: ['FECHA'], negrita: 'FASE',
  listas: { TIPO: ['DIARIO', 'REFERENCIA', 'COMPROBACIÓN'], SANGRADO: ['No', 'Sí'], 'DOLOR CRECIENTE': ['No', 'Sí'], ENROJECIMIENTO: ['No', 'Sí'], 'HINCHAZÓN': ['No', 'Sí'], 'FIEBRE ≥38': ['No', 'Sí'], 'GOLPE EN LA ZONA': ['No', 'Sí'],
    'RESPUESTA DÍA SIGUIENTE': ['Bien', 'Regular', 'Mal'], 'DECISIÓN': ['Mantener', 'Avanzar', 'Reducir', 'Consultar'] } };
VISIBLES_.push(HOJAS.OPERACION);
var OP_AUT_ = [['ejercicio_ligero', 'Ejercicio ligero', 'Abre movilidad + fuerza aislada (típico D7–D14)'], ['ejercicio_moderado', 'Ejercicio moderado', 'Abre Fabrik reducido + Z2 en ergo (D14–D21)'],
  ['ejercicio_intenso', 'Ejercicio intenso', 'Cargas altas, Valsalva, metcons, P1–P4 (D21–D28)'], ['impacto_carrera', 'Impacto · carrera', 'Carrera (Z2 primero), saltos, comba (D14–D28)'],
  ['inversiones', 'Inversiones', 'Pino, HSW (≈D28–D35 o más)'], ['apoyo_cabeza', 'Apoyo de cabeza', 'HSPU (≈D35–D42 o más)'], ['gorra_sol', 'Gorra y sol', 'Gorra holgada y entrenar al sol'], ['sauna_piscina', 'Sauna y piscina', 'Sauna, vapor, piscina']];
var OP_FASES_ = [   // clave, nombre, primer día (Dn), autorización que la abre
  ['POST1', '⬛ Reposo', 1, ''], ['POST2', '🟩 Movilidad + aislados', 7, 'ejercicio_ligero'], ['POST3', '🟩 Fabrik reducido + Z2 ergo', 13, 'ejercicio_moderado'], ['POST4', '🟧 Fabrik completo', 20, 'ejercicio_intenso'],
  ['POST5', '🟧 Fabrik + extras', 28, ''], ['POST6', '🟧 Vuelve el pino', 35, 'inversiones'], ['POST7', '🟧 Vuelven las HSPU', 42, 'apoyo_cabeza'], ['FIN', '✅ Programación normal', 48, '']];
/** Movimientos de Fabrik bloqueados hasta la autorización (spec §5). Orden: lo más específico primero. */
var OP_FILTRO_ = [
  ['apoyo_cabeza', /HSPU|HANDSTAND PUSH|HEADSTAND|TR[IÍ]PODE/, 'strict press / push press / DB press sentado', 'HSPU y apoyo de cabeza'],
  ['inversiones', /HANDSTAND|\bHSW\b|\bPINO\b|WALL WALK|PIRUETA|INVERSI[OÓ]N/, 'press OH + hold OH con DB / bear crawl', 'Pino, HSW e inversiones'],
  ['ejercicio_intenso', /BURPEE|\bGHD\b|\bT2B\b|TOES TO BAR|KIPPING|MUSCLE.?UP|\bBMU\b|\bRMU\b|ROPE CLIMB|\bC2B\b|CHEST TO BAR/, 'remo o bike / strict pull-ups o dips / hollow suave', 'Burpees, GHD, T2B, kipping, muscle-ups, cuerda'],
  ['ejercicio_intenso', /BACK SQUAT|BENCH PRESS|PRESS (DE )?BANCA/, 'front squat / press DB inclinado sin apoyar la nuca', 'Back squat barra alta y bench (zona donante)'],
  ['ejercicio_intenso', /SNATCH|\bJERK\b|THRUSTER|WALL ?BALL/, 'hang clean pull / push press controlado / goblet squat', 'Snatch, jerk, thruster, wall ball (cerca de la cara)'],
  ['impacto_carrera', /BOX JUMP|DOUBLE UNDER|\bDU\b|\bDUS\b|JUMP|\bRUN\b|CARRERA|SPRINT|SHUTTLE|\bCOMBA\b|\d+\s?M RUN/, 'bike / remo (mismo tiempo o calorías)', 'Saltos, comba y carrera'],
  ['ejercicio_intenso', /(DEADLIFT|PESO MUERTO|SQUAT).*(HEAVY|PESAD|\dRM|[89]\d\s?%|100\s?%)|(HEAVY|PESAD|\dRM|[89]\d\s?%).*(DEADLIFT|PESO MUERTO|SQUAT)/, 'misma variante al ≤70 %, RIR 3, respiración continua', 'Sentadilla o peso muerto pesado con Valsalva'],
  ['ejercicio_moderado', /PLANK|PLANCHA|WALL SIT|L-?SIT|HOLLOW HOLD/, 'movilidad', 'Isométricos intensos']
];
var OP_COD_ = { apoyo_cabeza: /^(W15|W16|W17|W31|OP1)$/, inversiones: /^(W25|W26|W27|W28|W32|W33|M56|OP1)$/, impacto_carrera: /^(W01|W02|W04|R02|R03|V01|W07|W08|M52|M32|M33|M35|C01)$/ };
function opBool_(v) { return /^(TRUE|S[IÍ]|1|VERDADERO)$/i.test(String(v || '').trim()); }
function opCfg_() {
  var c = leerConfig_(), aut = {};
  OP_AUT_.forEach(function (a) { var v = String(c['op_aut_' + a[0]] || ''); aut[a[0]] = { si: /^S[IÍ]/i.test(v), fecha: (v.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '' }; });
  return { activo: opBool_(c.op_modo_activo), inicio: celdaIso_(c.op_inicio) || '2026-11-16', d0: celdaIso_(c.op_fecha) || '', prevista: celdaIso_(c.op_fecha_prevista) || '2026-12-22', confirmada: opBool_(c.op_fecha_confirmada),
    tecnica: c.op_tecnica || 'FUE Gold', residual: c.op_regla_residual_P === undefined || c.op_regla_residual_P === '' ? true : opBool_(c.op_regla_residual_P), aut: aut,
    alarma: celdaIso_(c.op_alarma_desde) || '', congelados: parseInt(c.op_dias_congelados, 10) || 0, congeladoRef: celdaIso_(c.op_congelado_ref) || '', prolongar: parseInt(c.op_prolongar, 10) || 0,
    residualHasta: celdaIso_(c.op_residual_hasta) || '2027-03-20', taper: String(c.op_taper || '2027-02-15,2027-03-15').split(/\s*,\s*/), comp: String(c.op_comp || '2027-02-22,2027-03-01').split(/\s*,\s*/), existe: c.op_modo_activo !== undefined };
}
function opDif_(a, b) { return Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5); }
/** Calendario de fases con los desplazamientos por autorizaciones pendientes o tardías y por alarmas. */
function opFases_(cfg, hoy) {
  cfg = cfg || opCfg_(); hoy = hoy || hoyIso_();
  var d0 = cfg.d0 || cfg.prevista, out = [], shift = 0, pendiente = '', vivo = cfg.alarma ? Math.max(0, opDif_(hoy, cfg.alarma) + 1) : 0, usadoC = false, usadoV = false;
  out.push({ clave: 'PREVIA', nombre: '🟦 Previa · reserva', desde: cfg.inicio, hasta: sumarDias(d0, -4) });
  out.push({ clave: 'DESCARGA', nombre: '🟦 Llegar fresco', desde: sumarDias(d0, -3), hasta: sumarDias(d0, -1) });
  out.push({ clave: 'D0', nombre: '⬛ Operación', desde: d0, hasta: d0 });
  OP_FASES_.forEach(function (f, k) {
    var nominal = sumarDias(d0, f[2]), ini = sumarDias(nominal, shift), a = f[3] ? cfg.aut[f[3]] : null, pend = false;
    // una alarma congela la fase en curso: solo se desplazan las que aún no habían empezado cuando saltó
    if (k && cfg.congelados && !usadoC && (!cfg.congeladoRef || ini > cfg.congeladoRef)) { shift += cfg.congelados; ini = sumarDias(ini, cfg.congelados); usadoC = true; }
    if (k && vivo && !usadoV && ini > cfg.alarma) { shift += vivo; ini = sumarDias(ini, vivo); usadoV = true; }
    if (f[0] === 'FIN') ini = sumarDias(ini, cfg.prolongar);
    if (a && cfg.d0) {
      if (a.si && a.fecha && a.fecha > ini) { shift += opDif_(a.fecha, ini); ini = a.fecha; }                 // autorizada tarde: empieza ese día
      else if (!a.si && hoy >= ini) { var nuevo = sumarDias(hoy, 1); shift += opDif_(nuevo, ini); ini = nuevo; pend = true; if (!pendiente) pendiente = f[1]; }   // sin autorización: no empieza
    }
    if (out.length) out[out.length - 1].hasta = sumarDias(ini, -1);
    out.push({ clave: f[0], nombre: f[1], desde: ini, hasta: f[0] === 'FIN' ? '9999-12-31' : '', aut: f[3], pendiente: pend, nominal: nominal });
  });
  out.pendiente = pendiente; out.d0 = d0; out.previsto = !cfg.d0 || !cfg.confirmada;
  return out;
}
/** Fase de un día. Antes de la activación o con el modo apagado: NORMAL. */
function opFaseDe_(iso, cfg, fases) {
  cfg = cfg || opCfg_();
  if (!cfg.activo || iso < cfg.inicio) return { clave: 'NORMAL', nombre: '', dn: null };
  if (!cfg.d0) return { clave: 'PREVIA', nombre: '🟦 Previa · reserva', dn: null };   // sin fecha: todo es fase previa (las post solo se enseñan como previstas)
  fases = fases || opFases_(cfg);
  var f = fases.filter(function (x) { return iso >= x.desde && iso <= (x.hasta || '9999-12-31'); })[0] || fases[0];
  if (f.clave === 'FIN') return { clave: 'NORMAL', nombre: '', dn: opDif_(iso, cfg.d0), fin: true };
  return { clave: f.clave, nombre: f.nombre, dn: opDif_(iso, cfg.d0), pendiente: f.pendiente };
}
function opPost_(clave) { return /^POST/.test(clave) ? +clave.slice(4) : 0; }
/** Todo lo que el generador y la app necesitan de una semana. */
function opSemana_(lunes) {
  var cfg = opCfg_(), fases = cfg.activo && cfg.d0 ? opFases_(cfg) : null, dias = {}, claves = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); dias[iso] = opFaseDe_(iso, cfg, fases); claves.push(dias[iso].clave); }
  var fs = dias[sumarDias(lunes, 3)].clave;   // la semana se dosifica por la fase de su jueves
  var intenso = cfg.aut.ejercicio_intenso.si, enModo = claves.some(function (c) { return c !== 'NORMAL'; });
  var residual = cfg.residual && !enModo && cfg.existe && lunes >= cfg.inicio && lunes <= cfg.residualHasta && cfg.taper.indexOf(lunes) < 0 && cfg.comp.indexOf(lunes) < 0 && !!cfg.d0 && lunes > cfg.d0;
  return { cfg: cfg, fases: fases, dias: dias, fase: fs, enModo: enModo, post: opPost_(fs), intenso: intenso,
    dosP: fs === 'PREVIA' || opPost_(fs) >= 5 || (opPost_(fs) === 4 && intenso) || residual, residual: residual, taper: cfg.residual && cfg.taper.indexOf(lunes) >= 0 && !!cfg.d0 };
}
/** ¿Se puede poner este extra ese día? (lo usa puntuarHuecos_) */
function opPermite_(op, codigos, iso) {
  if (!op || !op.enModo) return true;
  var f = op.dias[iso]; if (!f || f.clave === 'NORMAL' || f.clave === 'PREVIA') return true;
  var algun = function (re) { return codigos.some(function (c) { return re.test(c); }); }, a = op.cfg.aut, n = opPost_(f.clave);
  if (f.clave === 'DESCARGA') return f.dn <= -2 && codigos.length > 0 && codigos.every(function (c) { return /^(W02|W03|W10)$/.test(c); });
  if (f.clave === 'D0' || n === 1 || n === 2) return false;
  if (!a.impacto_carrera.si && algun(OP_COD_.impacto_carrera)) return false;
  if (!a.apoyo_cabeza.si && algun(OP_COD_.apoyo_cabeza)) return false;
  if (!a.inversiones.si && algun(OP_COD_.inversiones)) return false;
  if (n === 3) return algun(/^(W03|OP2|W10)$/) || (a.impacto_carrera.si && algun(/^W02$/)) || (op.intenso && algun(/^OP3$/));
  if (n === 4) return algun(/^(W01|W02|W03|W04|R02|R03|OP2|OP3|W10|R01|R04)$/);   // v0.28 · intensidad garantizada en cuanto hay autorización
  if (n === 5 && (algun(OP_COD_.inversiones) || algun(OP_COD_.apoyo_cabeza))) return false;   // el pino vuelve en POST-6 y las HSPU en POST-7
  if (n === 6 && algun(OP_COD_.apoyo_cabeza)) return false;
  return true;
}
/** Estímulos propios del modo en el catálogo y sus metas semanales (se activan y desactivan según la fase de la semana). */
var OP_EST_ = [
  ['OP1', 'Empuje vertical · press OH + HSPU + HSW', 'EMPUJE VERTICAL', 'EXTRA', 'PM', 18, '🟢 Calidad', 'A) Every 2′ × 5: 3–5 strict press o push press (RIR 2)\nB) EMOM 8′: impar 3–5 HSPU (estrictas, déficit o kipping técnico) · par 6–10 m HSW\nSin fallo: paras con 1–2 repeticiones de margen.',
    'Modo operación · fase previa: las inversiones y el apoyo de cabeza son lo último que autoriza la clínica (~5–7 semanas). Cuanto más alta llegue la base de empuje vertical, menos se pierde y antes vuelve.',
    'Técnica: costillas abajo, glúteo activo, línea en el pino. Fisiología: fuerza y coordinación del empuje vertical con dosis por calidad (sin fallo no hay coste de recuperación). Biología: la fuerza aguanta mejor un parón que el motor si la base es alta (Bosquet 2013).',
    'No la víspera de un día de jerk o de HSPU de Fabrik.', 'HOMBRO', 'HOMBRO', 'Kg del press, reps de HSPU y metros de HSW'],
  ['OP2', 'Press OH · vuelta', 'PRESS OH VUELTA', 'EXTRA', 'PM', 12, '🟢 Calidad', 'Strict press o press DB sentado SIN apoyar la nuca · 3 × 6–8 · RIR 3 · respiración continua (sin Valsalva) · 2′',
    'Modo operación: el press OH es el puente hacia el pino y las HSPU, que siguen bloqueados. Mantiene el empuje vertical con la cabeza por encima del corazón.',
    'Técnica: sentado o de pie sin hiperextender; no apoyar la nuca. Fisiología: tensión mecánica submáxima que conserva fuerza con dosis mínima (Spiering 2021). Biología: sin picos de presión arterial.',
    'No junto a otro bloque de hombro el mismo día en las dos primeras semanas.', 'HOMBRO', '', 'Kg, reps y RIR'],
  ['OP3', 'Calidad corta en erg · umbral', 'CALIDAD ERG', 'EXTRA', 'AM|PM', 30, '🟠 Calidad', '10′ suaves + 2 × 6′ a umbral (RPE 7, hablas con frases cortas) en remo o bike / 3′ suave + 5′ suaves\nSin impacto: la primera intensidad del motor tras la operación.',
    'Modo operación: la intensidad es lo que conserva y recupera la capacidad aeróbica (Hickson 1985; Spiering 2021). Vuelve en erg, en dosis corta, en cuanto la clínica autoriza el ejercicio intenso.',
    'Técnica: cadencia estable. Fisiología: estímulo de umbral que frena la caída del VO₂máx y de las enzimas mitocondriales (semivida ~12 días). Biología: sin impacto ni cabeza abajo.',
    '≥48 h de otro bloque intenso.', 'GLUC', '', 'Vatios o ritmo /500 m de cada 6′, FC y RPE']
];
function opPrepararCatalogo_() {
  var cat = {}, n = 0; listar_(HOJAS.ESTIMULOS).forEach(function (r) { cat[String(r['CÓDIGO']).trim().toUpperCase()] = 1; });
  var cab = ESQUEMA['APP · ESTÍMULOS'].cab, nuevas = OP_EST_.filter(function (e) { return !cat[e[0]]; }).map(function (e) { var o = {}; cab.forEach(function (h, i) { if (e[i] !== undefined) o[h] = e[i]; }); o.ACTIVO = 'Sí'; n++; return o; });
  filasEnHoja_(HOJAS.ESTIMULOS, nuevas);
  var metas = {}; listar_(HOJAS.METAS).forEach(function (m) { metas[m.ID] = 1; });
  var nm = [['opemp001', 'P1 · HSPU', 'EMPUJE VERTICAL · PRESS OH + HSPU + HSW (modo operación)', 'OP1', 'Modo operación · fase previa: +1 estímulo semanal de empuje vertical sobre lo que ya marca el plan. Se activa y se apaga solo según la fase.'],
    ['oppre002', 'P1 · HSPU', 'PRESS OH · VUELTA (modo operación)', 'OP2', 'Modo operación · fases post: 1/semana con Fabrik reducido y 2/semana desde Fabrik completo. Se activa y se apaga solo según la fase.']]
    .filter(function (x) { return !metas[x[0]]; }).map(function (x) { return { ID: x[0], 'ÁMBITO': 'Semana', PRIORIDAD: x[1], 'ESTÍMULO': x[2], META: '1', TIPO: 'COUNT', UNIDAD: 'sesiones/sem', 'CÓDIGOS': x[3], ACTIVA: 'No', NOTAS: x[4] }; });
  filasEnHoja_(HOJAS.METAS, nm); MEMO = null;
  return n + nm.length;
}
/** Activa las metas del modo que tocan en esa semana (solo escribe si algo cambia). */
function opSincronizarMetas_(op) {
  var quiero = { opemp001: op.fase === 'PREVIA' ? 1 : 0, oppre002: op.post === 3 ? 1 : op.post >= 4 ? 2 : 0 }, cambios = 0;
  listar_(HOJAS.METAS).forEach(function (m) {
    if (quiero[m.ID] === undefined) return; var q = quiero[m.ID], o = {};
    if ((m.ACTIVA !== 'No') !== (q > 0)) o.ACTIVA = q > 0 ? 'Sí' : 'No';
    if (q > 0 && String(m.META) !== String(q)) o.META = String(q);
    if (Object.keys(o).length) { actualizarFila_(HOJAS.METAS, m._fila, o); cambios++; }
  });
  if (cambios) MEMO = null;
  return cambios;
}
/** La carrera de la semana según la fase (lo llama el generador después de carreraSemana_). */
function opCarrera_(CARR, op, cat) {
  if (!op || !op.enModo) { if (op && op.taper) CARR.forEach(function (s) { if (/R01/.test(s['CÓDIGOS'])) s['POR QUÉ (cursiva)'] = 'Semana de taper: solo P3 corto (3 rondas), nada de P1/P4. ' + (s['POR QUÉ (cursiva)'] || ''); }); return CARR; }
  var n = op.post, a = op.cfg.aut, tipo = CARR.semanaTipo, ergo = function (min, titulo, pq) { var e = cat.W03 || {};
    return { ORIGEN: 'CARRERA', 'TÍTULO': titulo, CONTENIDO: min + '′ en Z2 en remo o bike (RPE 2–3, conversación, respiración continua). Sin sudar en exceso ni calor las primeras semanas.\n\nRegistra: ' + (e['DATOS A REGISTRAR'] || 'minutos, FC y RPE'),
      INTENSIDAD: '🔵 Z2', MIN: min, 'CÓDIGOS': 'W03', 'POR QUÉ (cursiva)': pq, 'CIENCIA (técnica · fisiología · biología)': e['CIENCIA (técnica · fisiología · biología)'] || '', INTERFERENCIAS: e.INTERFERENCIAS || '' }; };
  var out = CARR;
  if (op.fase === 'D0' || n === 1 || n === 2) out = [];
  else if (n === 3) {
    out = [ergo(20, 'Ergo Z2 · vuelta 1/2', 'Modo operación · Fabrik reducido: el motor vuelve primero sin impacto. 20–40′ semanales en 2–3 sesiones.'), ergo(20, 'Ergo Z2 · vuelta 2/2', 'Modo operación: segunda sesión de Z2 en ergo (total 40′).')];
    if (a.impacto_carrera.si) out = out.concat(CARR.filter(function (s) { return /^W02$/.test(s['CÓDIGOS']); }).map(function (s) { s.MIN = Math.min(30, parseFloat(s.MIN) || 30); s['POR QUÉ (cursiva)'] = 'Impacto autorizado por la clínica: primera Z2 de carrera, corta y suave. ' + (s['POR QUÉ (cursiva)'] || ''); return s; }));
    if (op.intenso) out.push(opDeCat_('OP3', cat));
  } else if (n === 4) {
    out = [];
    CARR.forEach(function (s) { var c = s['CÓDIGOS'] || '';
      if (/W0[12]/.test(c) && !/W04/.test(c)) { if (a.impacto_carrera.si) out.push(s); else out.push(ergo(Math.min(40, parseFloat(s.MIN) || 30), 'Ergo Z2 (en lugar de «' + s['TÍTULO'] + '»)', 'Modo operación: el impacto de carrera aún no está autorizado; mismo estímulo aeróbico en ergo.')); }
      else if (/W04/.test(c)) { if (a.impacto_carrera.si) { s['POR QUÉ (cursiva)'] = 'Vuelta: la intensidad es lo que recupera el motor (Hickson 1985). Primera calidad de carrera, versión corta. ' + (s['POR QUÉ (cursiva)'] || ''); s.CONTENIDO = 'VUELTA · haz la MITAD de las repeticiones al ritmo previsto; si sale con margen, la semana que viene completa.\n\n' + (s.CONTENIDO || ''); out.push(s); } else out.push(opDeCat_('OP3', cat)); }
      else if (/R01/.test(c)) { s['TÍTULO'] = 'POTENCIA · P3 contraste (vuelta)'; s.CONTENIDO = 'P3 CONTRASTE · 3 rondas\n2 power clean al 40–50 % rápidos → 60″ → 8″ SkiErg o bike al 100 %\n3′ entre rondas. Calidad: si la velocidad cae, se acaba.'; s.MIN = 15;
        s['POR QUÉ (cursiva)'] = 'Modo operación · Fabrik completo: P3 va el primero porque es el protocolo de menor coste; despierta las unidades motoras rápidas y la velocidad de barra sin fatiga glucolítica.'; out.push(s); }
      else if (/W03/.test(c)) out.push(s);
    });
  } else if (n >= 5) {
    out = CARR.map(function (s) { var c = s['CÓDIGOS'] || '';
      if (!a.impacto_carrera.si && /W0[124]|R0[23]|V01/.test(c) && !/R01/.test(c)) return /W04/.test(c) ? opDeCat_('OP3', cat) : ergo(Math.min(45, parseFloat(s.MIN) || 30), 'Ergo Z2 (en lugar de «' + s['TÍTULO'] + '»)', 'Modo operación: el impacto de carrera aún no está autorizado.');
      if (/R01/.test(c)) s['POR QUÉ (cursiva)'] = 'Modo operación · vuelta de la potencia: orden recomendado P3 → P2 → P4/P1 (de menor a mayor coste). ' + (s['POR QUÉ (cursiva)'] || '');
      return s; });
  } else if (op.fase === 'PREVIA') {
    CARR.forEach(function (s) { if (/R01/.test(s['CÓDIGOS'])) s['POR QUÉ (cursiva)'] = 'Modo operación · previa: 2 P1–P4 por semana para llegar con la máxima reserva de intensidad. ' + (s['POR QUÉ (cursiva)'] || ''); });
  }
  out.semanaTipo = tipo;
  return out;
}
function opDeCat_(c, cat) { var e = cat[c] || {}, b = OP_EST_.filter(function (x) { return x[0] === c; })[0] || [];
  return { ORIGEN: 'EXTRA', 'TÍTULO': e.NOMBRE || b[1] || c, CONTENIDO: e.CONTENIDO || b[7] || '', INTENSIDAD: e.INTENSIDAD || b[6] || '', MIN: e.MIN || b[5] || 15, 'CÓDIGOS': c, 'POR QUÉ (cursiva)': e['POR QUÉ (cursiva)'] || b[8] || '',
    'CIENCIA (técnica · fisiología · biología)': e['CIENCIA (técnica · fisiología · biología)'] || b[9] || '', INTERFERENCIAS: e.INTERFERENCIAS || b[10] || '' }; }
/** Bloques propios del modo (reposo, paseos, aislados, descarga). Se regeneran como cualquier borrador automático. */
function opBloques_(lunes, op, sello, permitidos) {
  if (!op || !op.enModo) return [];
  var ya = {}; listar_(HOJAS.PLAN).forEach(function (r) { if (norm(r.ORIGEN) === 'OPERACION' && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO)) ya[celdaIso_(r.FECHA)] = 1; });
  var out = [], B = function (iso, titulo, cont, min, pq, int) { out.push({ ID: nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: 'AM', ORDEN: 5, ORIGEN: 'OPERACIÓN', 'TÍTULO': titulo, BLOQUE: titulo, CONTENIDO: cont, MIN: min, INTENSIDAD: int || '🟢 Suave', 'CÓDIGOS': '',
    'POR QUÉ (cursiva)': pq, ESTADO: 'BORRADOR', GENERADO: sello, ACTUALIZADO: ahora_() }); };
  Object.keys(op.dias).forEach(function (iso) {
    var f = op.dias[iso], n = opPost_(f.clave); if ((permitidos && !permitidos[iso]) || ya[iso]) return;
    if (f.clave === 'DESCARGA' && f.dn <= -2) B(iso, 'D' + f.dn + ' · Descarga: movilidad + técnica ligera', 'Movilidad general 10–15′ + técnica con PVC o barra vacía 10′.\nNada de máximos, metcons agotadores ni daño muscular nuevo. Si hay Z2, muy suave.', 20, 'Llegar descansado, no reventado: ningún estudio respalda sobrecargarse antes de una cirugía.');
    else if (f.clave === 'DESCARGA') B(iso, 'D−1 · Descanso o paseo', 'Paseo tranquilo 20–30′ o descanso total. Dormir bien y comer normal.\n\nRecordatorios:\n· lista de suplementos y medicación entregada a la clínica\n· preguntas por escrito (qué día autorizan cada cosa)\n· comidas de la primera semana preparadas\n· ropa con cremallera o botones', 20, 'Víspera de la operación: cero fatiga.');
    else if (f.clave === 'D0') B(iso, 'D0 · Operación', 'Sin entrenamiento.\nSigue las instrucciones de la clínica sobre ayuno, cafeína y medicación.', 0, 'Día de la cirugía.');
    else if (n === 1) B(iso, 'D' + f.dn + ' · Reposo: paseo ' + Math.min(30, 5 * f.dn) + '′', 'Paseo corto de ' + Math.min(30, 5 * f.dn) + '′ (según tolerancia) + movilidad de tobillos, rodillas y hombros SIN bajar la cabeza.\nSueño 7–9 h · proteína 1,6–2,2 g/kg (145–200 g) · mantenimiento calórico.\nNo tocar, no frotar, no arrancar costras.', Math.min(30, 5 * f.dn), 'Los injertos son vulnerables los primeros días (anclaje desde D6–D9, Bernstein 2006). Cero entrenamiento; caminar frena la pérdida sin riesgo.');
    else if (n === 2) { var fuerza = f.dn % 2 === 1;
      B(iso, 'D' + f.dn + ' · ' + (fuerza ? 'Movilidad + fuerza aislada' : 'Paseo + movilidad'), (fuerza ? 'Movilidad general y de halterofilia con PVC 10′ (sin cabeza abajo)\n\nFUERZA AISLADA · 1–2 series de 8–12 · RIR ≥4 · sin Valsalva · cabeza por encima del corazón, sin apoyar la nuca\n· Curl de bíceps (goma o DB)\n· Extensión de tríceps (goma)\n· Elevaciones laterales\n· Remo con pecho apoyado\n· Extensión de cuádriceps / curl femoral\n· Elevación de talones\n· Sentadilla a cajón sin carga\n\n' : '') +
        'Paseo 30–45′ a ritmo cómodo, en fresco.' + (fuerza ? '' : '\nBici suave 15–25′ RPE 2–3 solo si la clínica la ha autorizado.') + '\nNo: sudar mucho, calor, isométricos intensos, nada que roce o presione la cabeza.', fuerza ? 40 : 35,
        'Tensión muscular mínima y movimiento: frenan la pérdida sin elevar la presión ni el calor (dosis mínima, Spiering 2021). Se sube una variable cada vez.'); }
  });
  return out;
}
/** Filtro de movimientos sobre un texto de Fabrik. Devuelve el texto marcado y la lista de sustituciones. */
function opFiltrarTexto_(texto, aut) {
  var sust = [], lineas = String(texto || '').split('\n').map(function (l) {
    var L = norm(l); if (!L.trim()) return l;
    for (var k = 0; k < OP_FILTRO_.length; k++) { var f = OP_FILTRO_[k]; if (aut[f[0]] && aut[f[0]].si) continue;
      if (f[1].test(L)) { sust.push({ de: l.trim(), a: f[2], hasta: f[0] }); return '⛔ ' + l.trim() + '\n   → ' + f[2].toUpperCase() + '  (bloqueado hasta «' + f[0].replace(/_/g, ' ') + '»)'; } }
    return l;
  });
  return { texto: lineas.join('\n'), sust: sust };
}
var OP_NOTA_FAB_ = { DESCARGA: 'Descarga antes de la operación: sin máximos, sin metcons agotadores y sin daño muscular nuevo. Técnica ligera y movilidad.',
  POST3: 'FABRIK REDUCIDO · ~50–60 % del volumen · cargas ≤70 % y RIR ≥3 · metcon a RPE ≤6 sin densidad · técnica de halterofilia al 50–65 %.', POST4: 'Fabrik completo, salvo lo marcado con ⛔.' };
/** Copia de la semana de Fabrik con el modo aplicado (solo para enseñar; Fabrik no se toca). */
function opFabrik_(fab, op) {
  if (!fab || !op || !op.enModo) return fab;
  var copia = JSON.parse(JSON.stringify(fab));
  (copia.dias || []).forEach(function (fd) {
    var f = op.dias[fd.iso]; if (!f || f.clave === 'NORMAL' || f.clave === 'PREVIA') return; var n = opPost_(f.clave);
    (fd.bloques || []).forEach(function (b) {
      if (f.clave === 'D0' || n === 1 || n === 2) { b.opOculto = f.clave === 'D0' ? 'No aplica · día de la operación' : n === 1 ? 'No aplica · reposo post-operatorio' : 'No aplica · solo movilidad y fuerza aislada'; return; }
      if (OP_NOTA_FAB_[f.clave]) b.opNota = OP_NOTA_FAB_[f.clave];
      if (n >= 3) { var k = 0; (b.partes || []).forEach(function (p) { var r = opFiltrarTexto_(p.texto, op.cfg.aut); if (r.sust.length) { p.texto = r.texto; k += r.sust.length; } });
        if (k) b.opNota = (b.opNota ? b.opNota + ' ' : '') + k + ' movimiento' + (k > 1 ? 's' : '') + ' bloqueado' + (k > 1 ? 's' : '') + ' por la operación: va el sustituto (→).'; }
    });
  });
  return copia;
}
function opTareas_(lunes, op) {
  var t = [], cfg = op.cfg; if (!cfg.activo) return t;
  if (lunes === '2026-11-30') t.push({ ref: 'Rampa de fuerza + RowErg EMOM 6′', texto: 'Referencia de partida: rampa a un single pesado (squat o clean) + RowErg EMOM 6′ (40″ cómodo + 20″ fuerte). Guarda kg, velocidad, kcal y metros (previa: 117 kcal / 1642 m).' });
  if (lunes === '2026-12-07') { t.push({ ref: 'Z2 de 35′', texto: 'Referencia de partida: Z2 de 35′. Guarda ritmo, FC media por mitades, RPE y temperatura.' }); t.push({ ref: 'Peso corporal y fotos', texto: 'Referencia de partida: peso corporal y fotos estandarizadas.' }); }
  Object.keys(op.dias).forEach(function (iso) { var f = op.dias[iso];
    if (f.dn === 28) t.push({ ref: 'Vuelta · Z2 de 35′', texto: 'Comprobación D28–D34: Z2 de 35′. Señal de vuelta: mismo ritmo con ≤5 ppm más que la referencia.' });
    if (f.dn === 35) t.push({ ref: 'Vuelta · RowErg EMOM 6′', texto: 'Comprobación D35–D41: RowErg EMOM 6′. Señal de vuelta: ≥95 % de la referencia.' });
    if (f.dn === 42) t.push({ ref: 'Vuelta · single pesado', texto: 'Comprobación D42–D47: single pesado. Señal de vuelta: sale con buena velocidad.' }); });
  return t;
}
/** Lo que la app enseña del modo (cabecera, fases, autorizaciones, bloqueos, tareas). */
function opPayload_(lunes) {
  var cfg = opCfg_(); if (!cfg.existe) return null;
  var hoy = hoyIso_(), fases = opFases_(cfg, hoy), op = opSemana_(lunes), fh = opFaseDe_(hoy, cfg, cfg.d0 ? fases : null);
  var bloqueado = []; if (cfg.activo && cfg.d0 && fh.dn > 0) OP_FILTRO_.forEach(function (f) { if (!cfg.aut[f[0]].si && bloqueado.indexOf(f[3]) < 0) bloqueado.push(f[3]); });
  var finPreg = cfg.activo && cfg.d0 && fh.dn >= 45 && fh.clave !== 'NORMAL';
  return { activo: cfg.activo, empezado: hoy >= cfg.inicio, inicio: cfg.inicio, fecha: cfg.d0, prevista: cfg.prevista, confirmada: cfg.confirmada, tecnica: cfg.tecnica, residual: cfg.residual,
    fase: fh.clave, nombre: fh.nombre, dn: fh.dn, faltan: cfg.d0 || cfg.prevista ? opDif_(cfg.d0 || cfg.prevista, hoy) : null,
    fases: fases.map(function (f) { return { clave: f.clave, nombre: f.nombre, desde: f.desde, hasta: f.hasta === '9999-12-31' ? '' : f.hasta, aut: f.aut || '', pendiente: !!f.pendiente }; }), previsto: fases.previsto,
    pendiente: cfg.d0 && fases.pendiente ? 'Fase «' + fases.pendiente + '» pendiente de autorización de la clínica: se prolonga la actual y las siguientes se desplazan.' : '',
    aut: OP_AUT_.map(function (a) { return { clave: a[0], nombre: a[1], nota: a[2], si: cfg.aut[a[0]].si, fecha: cfg.aut[a[0]].fecha }; }),
    alarma: cfg.alarma, bloqueado: bloqueado, dias: op.dias, semana: { fase: op.fase, dosP: op.dosP, residual: op.residual, taper: op.taper }, tareas: opTareas_(lunes, op), finPregunta: finPreg,
    aviso: 'Las fechas son ventanas. Si la clínica autoriza más tarde, el plan se desplaza: se recorta carga, nunca la seguridad del injerto.' };
}
/** Guarda la configuración del modo de una vez. b: { activo, fecha, confirmada, residual, aut: {clave: bool}, prolongar, desactivar } */
function opGuardar_(b) {
  var cfg = opCfg_(), hoy = hoyIso_(), cambioFecha = false;
  if (b.activo !== undefined) ponerConfig_('op_modo_activo', b.activo ? 'TRUE' : 'FALSE', 'Modo operación capilar activo');
  if (b.fecha !== undefined) { var f = b.fecha ? (celdaIso_(b.fecha) || '') : ''; if (b.fecha && !f) throw new Error('fecha_no_valida'); if (f !== cfg.d0) { ponerConfig_('op_fecha', f ? "'" + f : '', 'Fecha de la operación (D0). Vacía = prevista ' + isoAFecha(cfg.prevista)); cambioFecha = !!f; } }
  if (b.confirmada !== undefined) ponerConfig_('op_fecha_confirmada', b.confirmada ? 'TRUE' : 'FALSE', 'La clínica ha confirmado la fecha');
  if (b.residual !== undefined) ponerConfig_('op_regla_residual_P', b.residual ? 'TRUE' : 'FALSE', '2 P1–P4/semana tras D47 hasta el HYROX (salvo taper y competición)');
  Object.keys(b.aut || {}).forEach(function (k) { if (!cfg.aut[k]) return; var si = !!b.aut[k]; if (si === cfg.aut[k].si) return;
    ponerConfig_('op_aut_' + k, si ? 'SÍ · ' + hoy : 'NO', 'Autorización de la clínica: ' + k.replace(/_/g, ' ')); });
  if (b.prolongar) ponerConfig_('op_prolongar', String(cfg.prolongar + (+b.prolongar || 7)), 'Días que se prolonga el modo tras D47');
  if (b.quitarAlarma && cfg.alarma) { ponerConfig_('op_dias_congelados', String(cfg.congelados + Math.max(0, opDif_(hoy, cfg.alarma))), 'Días que la fase estuvo congelada por una alarma'); ponerConfig_('op_congelado_ref', "'" + cfg.alarma, 'Inicio de la última congelación'); ponerConfig_('op_alarma_desde', '', 'Alarma activa desde'); }
  MEMO = null; ventanasIntensivo_.c = undefined;
  var movidos = cambioFecha ? opMoverTests_() : [];
  try { opSincronizarMetas_(opSemana_(lunesDe_(hoy))); } catch (e) {}
  return { movidos: movidos };
}
/** Al fijar la fecha: el test de 2 km pasa a D−6/D−5 y el de 10 km a abril (después del HYROX). Los tests son eventos: una sola fuente de fechas. */
function opMoverTests_() {
  var cfg = opCfg_(); if (!cfg.d0) return [];
  var out = [], abr = lunesDe_((+cfg.residualHasta.slice(0, 4)) + '-04-07');
  var mover = function (re, nombre, ini, fin, nota) {
    var e = listar_(HOJAS.EVENTOS).filter(function (x) { return re.test(norm(x.EVENTO)); })[0];
    if (e) actualizarFila_(HOJAS.EVENTOS, e._fila, { INICIO: isoAFecha(ini), FIN: isoAFecha(fin), NOTAS: nota });
    else guardarEvento_({ EVENTO: nombre, TIPO: 'Carrera', INICIO: isoAFecha(ini), FIN: isoAFecha(fin), BLOQUEA: 'No bloquea', 'ANTES (días bajar volumen)': '2', 'DESPUÉS (días recuperación)': '1', 'CÓMO PROCEDER': 'El test sustituye la calidad de esa semana. ≥48 h fáciles antes.', ESTADO: 'Decidido', NOTAS: nota });
    MEMO = null; out.push(nombre + ' → ' + isoAFecha(ini).slice(0, 5) + '–' + isoAFecha(fin));
  };
  mover(/TEST 2 ?KM/, 'Test 2 km', sumarDias(cfg.d0, -6), sumarDias(cfg.d0, -5), 'TEST · movido por el modo operación (antes del implante; ≥48 h fáciles antes)');
  mover(/TEST 10 ?KM/, 'Test 10 km', abr, sumarDias(abr, 6), 'TEST · movido a abril por el modo operación (después del HYROX)');
  ponerConfig_('op_tests_movidos', out.join(' · '), 'Tests recolocados al fijar la fecha de la operación');
  return out;
}
/** Registro diario, referencias y comprobaciones. Las alarmas congelan la fase. */
function opRegistrar_(b) {
  var cfg = opCfg_(), iso = celdaIso_(b.fecha) || hoyIso_(), f = opFaseDe_(iso, cfg), si = function (v) { return v === true || /^s[ií]$/i.test(String(v || '')) ? 'Sí' : 'No'; };
  var tipo = /^REF/i.test(b.tipo || '') ? 'REFERENCIA' : /^COMP/i.test(b.tipo || '') ? 'COMPROBACIÓN' : 'DIARIO';
  var o = { ID: 'OP' + nuevoId_(), FECHA: isoAFecha(iso), DN: f.dn == null ? '' : String(f.dn), FASE: f.nombre || f.clave, TIPO: tipo, AUTORIZACIONES: OP_AUT_.filter(function (a) { return cfg.aut[a[0]].si; }).map(function (a) { return a[1]; }).join(', ') || 'ninguna',
    'NOTA SÍNTOMAS': String(b.notaSintomas || '').slice(0, 500), ACTIVIDAD: String(b.actividad || '').slice(0, 300), MIN: b.min || '', RPE: b.rpe || '', 'FATIGA (1-10)': b.fatiga || '', 'AGUJETAS (1-10)': b.agujetas || '', 'ZONAS CARGADAS': String(b.zonas || '').slice(0, 200),
    'RESPUESTA DÍA SIGUIENTE': b.respuesta || '', 'DECISIÓN': b.decision || '', REFERENCIA: String(b.referencia || '').slice(0, 200), VALOR: String(b.valor || '').slice(0, 500), NOTAS: String(b.notas || '').slice(0, 500), REGISTRADO: ahora_() };
  var alarma = false;
  if (tipo === 'DIARIO') { [['SANGRADO', 'sangrado'], ['DOLOR CRECIENTE', 'dolor'], ['ENROJECIMIENTO', 'enrojecimiento'], ['HINCHAZÓN', 'hinchazon'], ['FIEBRE ≥38', 'fiebre'], ['GOLPE EN LA ZONA', 'golpe']].forEach(function (k) { o[k[0]] = si(b[k[1]]); });
    alarma = o.SANGRADO === 'Sí' || o['FIEBRE ≥38'] === 'Sí' || o['DOLOR CRECIENTE'] === 'Sí' || o['GOLPE EN LA ZONA'] === 'Sí'; if (alarma) o['DECISIÓN'] = 'Consultar'; }
  filasEnHoja_(HOJAS.OPERACION, [o]); MEMO = null;
  if (alarma && !cfg.alarma) { ponerConfig_('op_alarma_desde', "'" + iso, 'Alarma activa desde (congela la fase)'); try { enviarPush_('Detén la actividad y contacta con la clínica', 'Has marcado un síntoma de alarma. La fase queda congelada hasta que lo desmarques.'); } catch (e) {} }
  else if (!alarma && tipo === 'DIARIO' && cfg.alarma && b.quitarAlarma) opGuardar_({ quitarAlarma: true });
  MEMO = null;
  return { alarma: alarma || (!!cfg.alarma && !b.quitarAlarma) };
}
/** WOD de la WPD League: se clasifica contra P1–P4 y sustituye al P equivalente de la semana. */
function opClasificarWpd_(texto) {
  var T = norm(texto), min = +((T.match(/(?:AMRAP|EMOM|CAP|TIME CAP|TC)\D{0,6}(\d{1,2})/) || [])[1] || 0);
  var erg = /BIKE|ROW|SKI|ECHO|ASSAULT|\bCAL\b|CALOR/.test(T), pierna = /WALL ?BALL|THRUSTER|LUNGE|ZANCADA|SQUAT/.test(T), barra = /SNATCH|CLEAN|JERK|DEADLIFT|\bSTOH\b|SHOULDER TO OVERHEAD/.test(T), gim = /MUSCLE.?UP|HSPU|T2B|TOES|C2B|CHEST TO BAR|PULL.?UP|HANDSTAND|BURPEE/.test(T);
  var descanso = /REST|DESCANS|EVERY \d|E\dMOM|\bX\s*\d+\s*(MIN|′)|ON\s*\/|:\d\d\s*OFF/.test(T), cortoMax = /SPRINT|ALL ?OUT|MAX(IMO)? (EFFORT|ESFUERZO)|\b(10|15|20|30)\s*(″|"|S\b|SEG)/.test(T);
  if (cortoMax && descanso && !gim) return { p: 'P2', porque: 'esfuerzos máximos muy cortos repetidos con descanso (RSA).' };
  if (barra && cortoMax && !pierna && min <= 8 && !/AMRAP|FOR TIME/.test(T)) return { p: 'P3', porque: 'contraste de potencia y velocidad, corto y sin fatiga glucolítica.' };
  if (descanso && erg && pierna) return { p: 'P1', porque: 'intervalos de potencia con fatiga local de pierna (erg + ' + (/WALL ?BALL/.test(T) ? 'wall ball' : /THRUSTER/.test(T) ? 'thrusters' : 'pierna') + ').' };
  if ((barra || gim) && (!min || (min >= 6 && min <= 20)) && /AMRAP|FOR TIME|EMOM|ROUNDS|RONDAS|RFT|\d+-\d+-\d+/.test(T)) return { p: 'P4', porque: 'trabajo continuo de ' + (min ? min + '′' : '8–20′') + ' con picos de ' + (barra ? 'barra' : 'gimnásticos') + ': el formato del modelado de metcon (VT2 → Z6).' };
  return { p: '', porque: min > 20 ? 'es un trabajo aeróbico largo (' + min + '′) sin picos: cuenta como intensidad de metcon, no como P.' : 'no encaja en ningún protocolo P1–P4: cuenta como intensidad de metcon, no como P.' };
}
function opWpd_(b) {
  var texto = String(b.texto || '').trim(), iso = celdaIso_(b.fecha); if (!texto || !iso) throw new Error('faltan_datos');
  var lunes = lunesDe_(iso), cl = opClasificarWpd_(texto), avisos = [], sustituido = null;
  var sem = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6) && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO); });
  var hechos = {}; listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN && r.HECHO === 'Sí') hechos[r.ID_PLAN] = 1; });
  var cod = '';
  if (cl.p) {
    var ps = sem.filter(function (r) { return /\b(R01|R04)\b/.test(r['CÓDIGOS'] || '') && !/^(FABRIK|WPD)$/.test(norm(r.ORIGEN)) && !hechos[r.ID]; });
    sustituido = ps.filter(function (r) { return new RegExp('\\b' + cl.p + '\\b').test(norm(r['TÍTULO'])); })[0] || ps.filter(function (r) { return /R04/.test(r['CÓDIGOS']); })[0] || ps[0] || null;
    cod = sustituido ? (codigosDe_(sustituido['CÓDIGOS']).filter(function (c) { return /^R0[14]$/.test(c); })[0] || 'R01') : (sem.some(function (r) { return /\bR01\b/.test(r['CÓDIGOS'] || ''); }) ? 'R04' : 'R01');
  }
  var id = nuevoId_(), titulo = 'WPD League · ' + (cl.p ? 'sustituye ' + cl.p : 'intensidad de metcon (sin P)');
  bloqueo_(function () {
    filasEnHoja_(HOJAS.PLAN, [{ ID: id, FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: b.turno === 'PM' ? 'PM' : 'AM', ORDEN: 20, ORIGEN: 'WPD', 'TÍTULO': titulo, BLOQUE: titulo, CONTENIDO: texto, MIN: b.min || 25, INTENSIDAD: '🔴 Z6–Z8', 'CÓDIGOS': cod,
      'POR QUÉ (cursiva)': (cl.p ? 'Sustituye ' + cl.p + ' porque ' + cl.porque + ' No se añade el EXTRA equivalente.' : 'No sustituye ningún P porque ' + cl.porque + ' Se mantienen los P de la semana.') + ' Grábalo por la mañana del día con menos fatiga; el día antes, baja volumen.',
      ESTADO: 'PROGRAMADO', GENERADO: 'manual ' + ahora_() + ' (candado · WPD)', ACTUALIZADO: ahora_() }]);
    if (sustituido) { asegurarColumna_(HOJAS.PLAN, 'CAMBIO_ID'); actualizarFila_(HOJAS.PLAN, sustituido._fila, { ESTADO: 'SUSTITUIDO', CAMBIO_ID: 'WPD:' + id + ':' + sustituido.ESTADO, ACTUALIZADO: ahora_() }); }
  });
  MEMO = null;
  sem.forEach(function (r) { if (sustituido && r.ID === sustituido.ID) return; var d = celdaIso_(r.FECHA), dif = Math.abs(opDif_(d, iso));
    if (dif <= 1 && /\b(R01|R02|R03|R04|W04)\b/.test(r['CÓDIGOS'] || '')) avisos.push('«' + r['TÍTULO'] + '» está a ' + (dif ? '1 día' : 'el mismo día') + ': hace falta ≥48 h. Muévelo.'); });
  return { id: id, p: cl.p, porque: cl.porque, sustituido: sustituido ? sustituido['TÍTULO'] : '', avisos: avisos };
}
/** Cada día (motorDiario): metas del modo al día, fin automático en D48 y aviso de fase pendiente. */
function opDiario_() {
  var cfg = opCfg_(); if (!cfg.existe || !cfg.activo) return 'apagado';
  var hoy = hoyIso_(), f = opFaseDe_(hoy, cfg);
  if (f.fin) { ponerConfig_('op_modo_activo', 'FALSE', 'Modo operación capilar activo'); MEMO = null; try { opSincronizarMetas_(opSemana_(lunesDe_(hoy))); } catch (e) {}
    try { enviarPush_('Modo operación terminado', 'D48: vuelven las reglas normales de estímulos.' + (cfg.residual ? ' Se mantienen 2 P1–P4 por semana hasta el HYROX.' : '')); } catch (e) {} return 'FIN · modo desactivado'; }
  try { opSincronizarMetas_(opSemana_(lunesDe_(hoy))); } catch (e) {}
  if (cfg.d0) { var fs = opFases_(cfg, hoy); if (fs.pendiente && String(leerConfig_().op_aviso_pend || '') !== hoy) { try { enviarPush_('Fase pendiente de la clínica', 'Fase «' + fs.pendiente + '» pendiente de autorización: márcala en Menú › Modo operación cuando te la den.'); } catch (e) {} ponerConfig_('op_aviso_pend', "'" + hoy, 'Último aviso de fase pendiente'); } }
  return (f.nombre || f.clave) + (f.dn != null ? ' · D' + (f.dn >= 0 ? '+' : '') + f.dn : '');
}
function opCorreoHtml_(lunes) {
  var p = opPayload_(lunes); if (!p) return '';
  var op = opSemana_(lunes), nom = (op.fases || []).filter(function (f) { return f.clave === op.fase; })[0], dnL = op.dias[lunes].dn;
  if (!op.enModo && !op.residual && !op.taper) return '';
  return '<div style="padding:12px 14px;background:#eef2ff;border-left:4px solid #4f46e5;border-radius:6px;margin:0 0 14px"><b>Modo operación · ' + esc_(op.enModo ? (nom ? nom.nombre : op.fase === 'PREVIA' ? '🟦 Previa · reserva' : op.fase) : op.taper ? 'taper (solo P3 corto)' : 'regla residual: 2 P1–P4 esta semana') + '</b>' +
    (dnL != null ? ' · el lunes es D' + (dnL >= 0 ? '+' : '') + dnL : p.faltan != null ? ' · faltan ' + p.faltan + ' días para la fecha ' + (p.fecha ? '' : 'prevista ') + '(' + isoAFecha(p.fecha || p.prevista) + ')' : '') +
    '<br><span style="font-size:13px">Autorizaciones: ' + esc_(p.aut.filter(function (a) { return a.si; }).map(function (a) { return a.nombre; }).join(', ') || 'ninguna todavía') +
    (p.bloqueado.length ? '<br>Bloqueado: ' + esc_(p.bloqueado.join(' · ')) : '') + (p.pendiente ? '<br>⚠ ' + esc_(p.pendiente) : '') + (p.alarma ? '<br>⛔ Alarma activa desde el ' + isoAFecha(p.alarma) + ': fase congelada.' : '') +
    (op.fase === 'PREVIA' ? '<br>Esta semana: Z2 ×2 (≥90′), ergo 20–40′, 1 calidad, <b>2 P1–P4</b> (≥48 h) y <b>+1 de empuje vertical</b> (press OH + HSPU + HSW). Sin semana de choque ni dieta.' : '') +
    opTareas_(lunes, op).map(function (t) { return '<br>📌 ' + esc_(t.texto); }).join('') + '</span></div>';
}
/** Valores iniciales (configurar): no pisa lo que ya exista. */
function opPrepararConfig_() {
  var c = leerConfig_(), n = 0, def = function (k, v, nota) { if (c[k] === undefined) { ponerConfig_(k, v, nota); n++; } };
  def('op_modo_activo', 'TRUE', 'Modo operación capilar activo (se apaga solo en D48)');
  def('op_inicio', "'2026-11-16", 'Primer lunes del modo (fase previa)');
  def('op_fecha', '', 'Fecha de la operación (D0). Vacía = prevista 22/12/2026. Ponla en la app › Menú › Modo operación');
  def('op_fecha_prevista', "'2026-12-22", 'Fecha prevista mientras op_fecha esté vacía');
  def('op_fecha_confirmada', 'FALSE', 'La clínica ha confirmado la fecha');
  def('op_tecnica', 'FUE Gold', 'Técnica (informativo)');
  def('op_regla_residual_P', 'TRUE', '2 P1–P4/semana tras D47 hasta el HYROX (20/3), salvo taper y competición');
  OP_AUT_.forEach(function (a) { def('op_aut_' + a[0], 'NO', 'Autorización de la clínica: ' + a[1] + ' · ' + a[2]); });
  MEMO = null;
  return n;
}

