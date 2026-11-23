
// ===================== SYNC CON LA APP DE GABI (ProgramAPP) · bloques Fabrik, marcas y avisos de Gabi =====================
// Petición de Pablo 23/11/2026: amplía «RTE solo lee de la app de Gabi». Ahora RTE ESCRIBE en ProgramAPP, pero:
//  · SOLO filas de Pablo (EMAIL = CONFIG.EMAIL_PERMITIDO; se vuelve a leer la celda EMAIL justo antes de escribir),
//  · SOLO en FEEDBACK, RESULTADOS y MARCAS (gabiEscribibles_), sin tocar cabeceras, columnas ni filas de otros atletas,
//  · SOLO desde este código (el repo programapp no se toca).
// Interruptores en APP · CONFIG: sync_gabi_activo (Sí/No), avisos_gabi_activo (Sí/No). Última ejecución: sync_gabi_ultimo.
// Correspondencia (sin duplicados, idempotente): pestaña oculta «APP · SYNC GABI» con CLAVE → último VALOR sincronizado.
//   fb|<iso Gabi>|<n>  RPE (+ comentario) del bloque n de ese día  ↔  APP · REGISTRO (RPE, FEEDBACK o NOTAS) de la fila FABRIK
//   rs|<iso Gabi>|<n>  resultado del metcon (leaderboard)          ↔  APP · REGISTRO › DATOS (parciales/vatios)
//   mk|<MARCA>|<iso>|<valor>                                       ↔  APP · MARCAS
// Regla: si solo cambió un lado, se copia al otro; si cambiaron los dos, gana la última modificación
// (REGISTRADO en RTE contra ACTUALIZADO de FEEDBACK en Gabi). Un borrado no se propaga ni se «resucita».
HOJAS.SYNC_GABI = 'APP · SYNC GABI'; HOJAS.AVISOS_GABI = 'APP · AVISOS GABI';
ESQUEMA[HOJAS.SYNC_GABI] = { cab: ['CLAVE', 'VALOR', 'RTE', 'ACTUALIZADO'], anchos: [260, 320, 130, 120], color: '#5a5a5a' };
ESQUEMA[HOJAS.AVISOS_GABI] = { cab: ['ID', 'TIPO', 'TÍTULO', 'MENSAJE', 'DESDE', 'HASTA', 'ENLACE', 'PARA', 'AUTOR', 'DETECTADO', 'CORREO', 'LEÍDO'],
  anchos: [110, 70, 220, 380, 95, 95, 160, 120, 170, 120, 120, 120], negrita: 'TÍTULO' };
var GABI_EMAIL_DEF_ = 'gaabriel905@gmail.com';   // ATLETAS: NOMBRE «Gabi», ROL Coach (leído el 23/11/2026). Se puede cambiar en APP · CONFIG › gabi_email
var GABI_DIAS_L_ = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
function gabiEscribibles_() { return ['FEEDBACK', 'RESULTADOS', 'MARCAS']; }

// ---------- configuración ----------
function gabiSi_(v, def) { var s = norm(v == null || v === '' ? def : v).trim(); return /^(SI|S|TRUE|1|VERDADERO)$/.test(s); }
function gabiCfg_() {
  var c = leerConfig_();
  return { sync: gabiSi_(c.sync_gabi_activo, 'Sí'), avisos: gabiSi_(c.avisos_gabi_activo, 'Sí'), desde: celdaIso_(c.sync_gabi_desde) || lunesDe_(hoyIso_()),
    gabi: String(c.gabi_email || GABI_EMAIL_DEF_).toLowerCase().trim(), yo: String(c.email_permitido || CONFIG.EMAIL_PERMITIDO).toLowerCase().trim(),
    ultimo: c.sync_gabi_ultimo || '' };
}
/** Claves de APP · CONFIG (solo las que faltan) y pestañas. Lo llama configurar. */
function prepararSyncGabi_() {
  var c = leerConfig_(), n = 0;
  var pon = function (k, v, nota) { if (c[k] == null || c[k] === '') { ponerConfig_(k, v, nota); n++; } };
  pon('sync_gabi_activo', 'Sí', 'Sí/No · copia en los dos sentidos los registros de bloques Fabrik (RPE, comentario, resultado) y las marcas entre RTE y la app de Gabi');
  pon('avisos_gabi_activo', 'Sí', 'Sí/No · los avisos y notas que publica Gabi para ti salen en la app y te llegan por correo (una vez)');
  pon('sync_gabi_desde', isoAFecha(lunesDe_(hoyIso_())), 'Solo se sincroniza lo de esta fecha en adelante (dd/mm/aaaa)');
  pon('gabi_email', GABI_EMAIL_DEF_, 'Email del coach Gabi en ProgramAPP › ATLETAS: solo sus avisos y notas cuentan');
  gabiHoja_(HOJAS.SYNC_GABI); gabiHoja_(HOJAS.AVISOS_GABI);
  return n + ' claves nuevas · pestañas ' + HOJAS.SYNC_GABI + ' y ' + HOJAS.AVISOS_GABI;
}
function gabiHoja_(nombre) {
  var ss = miLibro_(), sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.getRange(1, 1, 1, ESQUEMA[nombre].cab.length).setValues([ESQUEMA[nombre].cab]); try { sh.hideSheet(); } catch (e) {} delete HOJAS_ABIERTAS_[nombre]; delete CAB_[nombre]; }
  return sh;
}

// ---------- lectura de ProgramAPP ----------
/** Tabla de una pestaña de la app de Gabi. Cabecera = primera fila (de las 8 primeras) con la celda «clave». */
function gabiTabla_(libro, nombre, clave) {
  var sh = libro.getSheetByName(nombre);
  if (!sh || !sh.getLastRow()) return null;
  var v = sh.getDataRange().getDisplayValues(), h = -1;
  for (var i = 0; i < Math.min(v.length, 8) && h < 0; i++) if (v[i].some(function (c) { return norm(c).trim() === clave; })) h = i;
  if (h < 0) return null;
  var cab = {}; v[h].forEach(function (c, j) { var k = norm(c).trim(); if (k && cab[k] === undefined) cab[k] = j; });
  var filas = []; for (var r = h + 1; r < v.length; r++) filas.push({ fila: r + 1, v: v[r] });
  return { sh: sh, nombre: nombre, cab: cab, filas: filas, ancho: v[h].length,
    g: function (f, k) { return cab[k] === undefined ? '' : String(f.v[cab[k]] == null ? '' : f.v[cab[k]]).trim(); } };
}
function gabiEsMia_(T, f, yo) { return T.g(f, 'EMAIL').toLowerCase() === yo; }
/** Escribe columnas de UNA fila de Pablo. Antes vuelve a leer la celda EMAIL de esa fila: si no es la suya, no escribe. */
function gabiEscribir_(T, f, cambios, yo) {
  if (gabiEscribibles_().indexOf(T.nombre) < 0) throw new Error('gabi_pestana_no_permitida');
  var cE = T.cab.EMAIL; if (cE === undefined) throw new Error('gabi_sin_email');
  var actual = String(T.sh.getRange(f.fila, cE + 1).getDisplayValues()[0][0] || '').toLowerCase().trim();
  if (actual !== yo) throw new Error('gabi_fila_ajena');
  Object.keys(cambios).forEach(function (k) {
    if (T.cab[k] === undefined || k === 'EMAIL') return;
    T.sh.getRange(f.fila, T.cab[k] + 1).setValue(celdaSegura_(cambios[k]));
    f.v[T.cab[k]] = String(cambios[k]);
  });
}
/** Fila nueva de Pablo (al final, o en la fila «fila» ya insertada). */
function gabiNuevaFila_(T, o, yo, fila) {
  if (gabiEscribibles_().indexOf(T.nombre) < 0) throw new Error('gabi_pestana_no_permitida');
  o.EMAIL = yo;
  var fila2 = fila || T.sh.getLastRow() + 1, ar = [];
  for (var j = 0; j < T.ancho; j++) ar.push('');
  Object.keys(o).forEach(function (k) { if (T.cab[k] !== undefined) ar[T.cab[k]] = celdaSegura_(o[k] == null ? '' : String(o[k])); });
  T.sh.getRange(fila2, 1, 1, ar.length).setValues([ar]);
  var f = { fila: fila2, v: ar.map(function (x) { return String(x).replace(/^'/, ''); }) };
  if (!fila) T.filas.push(f);
  return f;
}
function gabiPerfil_(libro, cf) {
  var A = gabiTabla_(libro, 'ATLETAS', 'EMAIL'), P = { nombre: 'Pablo', sexo: '', grupos: [], eventos: [], gabiOk: false, gabiNombre: 'Gabi' };
  if (!A) return P;
  var lista = function (s) { return String(s || '').split(/[,;\n]/).map(function (x) { return norm(x).trim(); }).filter(Boolean); };
  A.filas.forEach(function (f) {
    var e = A.g(f, 'EMAIL').toLowerCase();
    if (e === cf.yo) { P.nombre = A.g(f, 'NOMBRE') || P.nombre; P.sexo = A.g(f, 'SEXO'); P.grupos = lista(A.g(f, 'GRUPO')); P.eventos = lista(A.g(f, 'EVENTOS')); }
    if (e === cf.gabi) { P.gabiNombre = A.g(f, 'NOMBRE') || 'Gabi'; P.gabiOk = /COACH|ADMIN/.test(norm(A.g(f, 'ROL'))) || lista(A.g(f, 'GRUPO')).indexOf('COACH') >= 0; }
  });
  return P;
}

// ---------- utilidades ----------
function gabiSello_(t) {
  var m = String(t || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return '';
  var y = m[3].length === 2 ? '20' + m[3] : m[3];
  return y + ('0' + m[2]).slice(-2) + ('0' + m[1]).slice(-2) + ('0' + (m[4] || 0)).slice(-2) + (m[5] || '00');
}
function gabiValor_(v) { var s = String(v == null ? '' : v).trim().replace(',', '.'); return /^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, '') : s; }
function gabiComentario_(r) { var c = String(r.FEEDBACK || r.NOTAS || '').trim(); return /^Todo hecho \(un toque\)$/.test(c) ? '' : c; }
/** Bloque de Gabi de una fila FABRIK de APP · PLAN: { iso (día en la app de Gabi), n, lunes, dia }. */
function gabiRef_(r) {
  var m = String(r.FABRIK_REF || '').match(/^\s*([A-Za-zÁÉÍÓÚáéíóú]+)\s*·\s*(\d+)\s*$/), mi = String(r.ID || '').match(/^F(\d{2})(\d{2})(\d{2})-/);
  if (!m || !mi) return null;
  var lunes = '20' + mi[1] + '-' + mi[2] + '-' + mi[3], k = DIAS.indexOf(norm(m[1]).trim());
  return k < 0 ? null : { iso: sumarDias(lunes, k), n: String(+m[2]), lunes: lunes, dia: DIAS[k] };
}
// Resultado de metcon en el formato de RESULTADOS de Gabi: «12:10» · «CAP + 126 reps» · «7 rondas + 9 reps» · «26 reps»
var GABI_RES_RE_ = /^(CAP \+ \d+ reps|\d+ rondas(?: \+ \d+ reps)?|\d+ reps|\d{1,3}:\d{2}(?::\d{2})?)(?:\s*·\s*([^:]+?)(?::\s*(.*))?)?$/i;
function gabiResDe_(datos) {
  var m = String(datos || '').trim().match(GABI_RES_RE_); if (!m) return null;
  var res = m[1].replace(/^cap/i, 'CAP').replace(/RONDAS/i, 'rondas').replace(/REPS/i, 'reps');
  return { res: res, nivel: (m[2] || 'RX').trim(), adapt: (m[3] || '').trim() };
}
function gabiResTxt_(o) { return o ? o.res + '|' + norm(o.nivel || 'RX').trim() + '|' + (o.adapt || '') : ''; }
function gabiResDatos_(o) { return o.res + (o.nivel && norm(o.nivel).trim() !== 'RX' ? ' · ' + o.nivel + (o.adapt ? ': ' + o.adapt : '') : ''); }
function gabiResTipoPuntos_(res) {
  var m;
  if ((m = res.match(/^CAP \+ (\d+) reps$/))) return { tipo: 'Tiempo', puntos: +m[1] };
  if ((m = res.match(/^(\d+) rondas(?: \+ (\d+) reps)?$/))) return { tipo: 'AMRAP', puntos: (+m[1]) * 1000 + (+(m[2] || 0)) };
  if ((m = res.match(/^(\d+) reps$/))) return { tipo: 'Máximo', puntos: +m[1] };
  var p = res.split(':').map(Number), s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  return { tipo: 'Tiempo', puntos: 1000000 - s };
}
function gabiEsMetcon_(r) { return /METCON|\bWOD\b|AMRAP|FOR TIME|TIME CAP|EMOM|INTERVAL/.test(norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || '') + ' ' + String(r.CONTENIDO || '').slice(0, 300))); }
function gabiWodTxt_(r) { var t = String(r.CONTENIDO || r['TÍTULO'] || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean).join(' · '); return t.length > 160 ? t.slice(0, 159) + '…' : t; }
/** Columna BLOQUES de FEEDBACK a partir de DATOS: «L 1:6 2:7  |  M 3:7». */
function gabiBloquesTxt_(datos) {
  return Object.keys((datos && datos.d) || {}).sort().filter(function (iso) { return datos.d[iso].b && Object.keys(datos.d[iso].b).length; }).map(function (iso) {
    var b = datos.d[iso].b, k = (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;
    return GABI_DIAS_L_[k] + ' ' + Object.keys(b).sort(function (x, y) { return x - y; }).map(function (n) { return n + ':' + b[n].v; }).join(' ');
  }).join('  |  ');
}
/** Decide qué hacer con un dato: 'push' (RTE → Gabi), 'pull' (Gabi → RTE), 'igual' o 'nada'. */
function gabiDecidir_(base, r, g, rTs, gTs) {
  if (r === g) return r ? 'igual' : 'nada';
  if (base != null) {
    if (g === base) return r ? 'push' : 'nada';   // solo cambió RTE (un borrado no se propaga)
    if (r === base) return g ? 'pull' : 'nada';   // solo cambió Gabi
  }
  if (!r) return 'pull';
  if (!g) return 'push';
  return String(rTs || '') > String(gTs || '') ? 'push' : 'pull';   // cambiaron los dos: la última modificación gana (a igualdad, Gabi)
}
function gabiEstado_() {
  gabiHoja_(HOJAS.SYNC_GABI);
  var m = {}; listar_(HOJAS.SYNC_GABI).forEach(function (r) { if (r.CLAVE) m[r.CLAVE] = r; });
  return m;
}
function gabiGuardarEstado_(E, clave, valor, ref, nuevas) {
  var x = E[clave];
  if (x && x._fila) { if (x.VALOR !== valor) { actualizarFila_(HOJAS.SYNC_GABI, x._fila, { VALOR: valor, RTE: ref || x.RTE || '', ACTUALIZADO: ahora_() }); x.VALOR = valor; } return; }
  if (x && x._nueva) { x.VALOR = valor; x.RTE = ref || ''; return; }
  E[clave] = { CLAVE: clave, VALOR: valor, RTE: ref || '', ACTUALIZADO: ahora_(), _nueva: true }; nuevas.push(E[clave]);
}

// ---------- sincronización ----------
/** Cada hora (revisarAvisos), al abrir la app (avisos_gabi, como mucho cada 10 min) y tras registrar (solo ese bloque). */
function syncGabi() { return syncGabi_({}); }
function syncGabi_(opc) {
  opc = opc || {};
  try { prepararSyncGabi_(); } catch (e) { Logger.log('Sync Gabi · config: ' + e); }
  var cf = gabiCfg_(), out = { bloques: { subidos: 0, bajados: 0 }, resultados: { subidos: 0, bajados: 0 }, marcas: { subidas: 0, bajadas: 0 }, avisos: { nuevos: 0, correos: 0 }, errores: [] };
  if (!cf.sync && !cf.avisos) return out;
  var libro = programApp_();
  if (libro.getId && libro.getId() !== CONFIG.PROGRAMAPP_ID) throw new Error('gabi_libro_inesperado');
  var P = gabiPerfil_(libro, cf);
  bloqueo_(function () {
    MEMO = null;
    var E = gabiEstado_(), nuevas = [];
    if (cf.sync) {
      if (!opc.marca) try { gabiSyncBloques_(libro, cf, P, E, nuevas, out, opc.ids || null); } catch (e) { out.errores.push('bloques: ' + (e && e.message || e)); }
      if (!opc.ids) try { gabiSyncMarcas_(libro, cf, P, E, nuevas, out, opc.marca || null); } catch (e) { out.errores.push('marcas: ' + (e && e.message || e)); }
    }
    if (nuevas.length) filasEnHoja_(HOJAS.SYNC_GABI, nuevas.map(function (x) { return { CLAVE: x.CLAVE, VALOR: x.VALOR, RTE: x.RTE, ACTUALIZADO: x.ACTUALIZADO }; }));
    if (cf.avisos && !opc.ids && !opc.marca) try { gabiAvisos_(libro, cf, P, out); } catch (e) { out.errores.push('avisos: ' + (e && e.message || e)); }
    MEMO = null;
  });
  if (!opc.ids && !opc.marca) {
    var txt = ahora_() + ' · bloques ↑' + out.bloques.subidos + ' ↓' + out.bloques.bajados + ' · resultados ↑' + out.resultados.subidos + ' ↓' + out.resultados.bajados +
      ' · marcas ↑' + out.marcas.subidas + ' ↓' + out.marcas.bajadas + ' · avisos de Gabi ' + out.avisos.nuevos + ' (correos ' + out.avisos.correos + ')' + (out.errores.length ? ' · ERRORES: ' + out.errores.join(' | ') : '');
    try { ponerConfig_('sync_gabi_ultimo', txt, 'Última sincronización con la app de Gabi'); } catch (e) { Logger.log('sync_gabi_ultimo: ' + e); }
    try { CacheService.getScriptCache().put('gabi_sync_reciente', '1', 600); } catch (e) {}
  }
  return out;
}
/** RPE/comentario (FEEDBACK) y resultado (RESULTADOS) de los bloques FABRIK, en los dos sentidos. ids = solo esos ID_PLAN. */
function gabiSyncBloques_(libro, cf, P, E, nuevas, out, ids) {
  var plan = listar_(HOJAS.PLAN), porId = {};
  plan.forEach(function (r) { if (norm(r.ORIGEN) !== 'FABRIK' || r.ESTADO === 'SUSTITUIDO' || !/^F\d{6}-/.test(r.ID || '')) return; var x = porId[r.ID]; if (!x || masReciente_(r, x) < 0) porId[r.ID] = r; });
  var items = {};   // iso|n → { iso, n, lunes, dia, plan, reg }
  var item = function (ref) { var k = ref.iso + '|' + ref.n; return items[k] || (items[k] = { iso: ref.iso, n: ref.n, lunes: ref.lunes, dia: ref.dia, plan: null, reg: null }); };
  Object.keys(porId).forEach(function (id) { var ref = gabiRef_(porId[id]); if (ref && ref.iso >= cf.desde) item(ref).plan = porId[id]; });
  listar_(HOJAS.REGISTRO).forEach(function (r) {
    var p = porId[r.ID_PLAN]; if (!p) return; var ref = gabiRef_(p); if (!ref || ref.iso < cf.desde) return;
    var it = item(ref); if (!it.reg || gabiSello_(r.REGISTRADO) >= gabiSello_(it.reg.REGISTRADO)) it.reg = r;
  });
  // Gabi: FEEDBACK (una fila por atleta y semana, DATOS = JSON) y RESULTADOS (una fila por resultado, CLAVE email|iso|bloque|versión)
  var FB = gabiTabla_(libro, 'FEEDBACK', 'EMAIL'), RS = gabiTabla_(libro, 'RESULTADOS', 'EMAIL'), semanas = {}, res = {};
  if (FB) FB.filas.forEach(function (f) {
    if (!gabiEsMia_(FB, f, cf.yo)) return; var l = celdaIso_(FB.g(f, 'SEMANA')); if (!l || sumarDias(l, 6) < cf.desde) return;
    var d = {}; try { d = JSON.parse(FB.g(f, 'DATOS') || '{}') || {}; } catch (e) { return; }   // DATOS ilegible: no se toca esa fila
    semanas[l] = { f: f, d: d, ts: gabiSello_(FB.g(f, 'ACTUALIZADO')), sucia: false };
    Object.keys(d.d || {}).forEach(function (iso) { if (iso < cf.desde) return; Object.keys((d.d[iso] || {}).b || {}).forEach(function (n) { var it = item({ iso: iso, n: String(+n), lunes: l, dia: DIAS[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7] }); it.gfb = d.d[iso].b[n]; it.gts = semanas[l].ts; }); });
  });
  if (RS) RS.filas.forEach(function (f) {
    if (!gabiEsMia_(RS, f, cf.yo) || RS.g(f, 'VERSION')) return;   // solo la versión principal (sin VERSIÓN)
    var iso = celdaIso_(RS.g(f, 'FECHA')), n = String(+RS.g(f, 'BLOQUE')); if (!iso || iso < cf.desde || !(+n)) return;
    var it = item({ iso: iso, n: n, lunes: lunesDe_(iso), dia: DIAS[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7] }); it.grs = f;
  });
  var regNuevos = [];
  Object.keys(items).sort().forEach(function (k) {
    var it = items[k], idPlan = it.plan ? it.plan.ID : idFabrik_(it.lunes, it.dia, it.n);
    if (ids && ids.indexOf(idPlan) < 0) return;
    var reg = it.reg, rTs = reg ? gabiSello_(reg.REGISTRADO) : '';
    // --- RPE + comentario del bloque ---
    var rFb = reg && String(reg.RPE || '').trim() ? String(+reg.RPE) + '|' + gabiComentario_(reg) : '';
    var gFb = it.gfb && it.gfb.v != null && it.gfb.v !== '' ? String(+it.gfb.v) + '|' + String(it.gfb.c || '').trim() : '';
    var kFb = 'fb|' + it.iso + '|' + it.n, base = E[kFb] ? E[kFb].VALOR : null, acc = gabiDecidir_(base, rFb, gFb, rTs, it.gts);
    if (acc === 'push' && FB) {
      var s = semanas[it.lunes] || (semanas[it.lunes] = { f: null, d: {}, ts: '', sucia: false });
      s.d.d = s.d.d || {}; s.d.d[it.iso] = s.d.d[it.iso] || {}; s.d.d[it.iso].b = s.d.d[it.iso].b || {};
      var e0 = s.d.d[it.iso].b[it.n] || {}, cm = gabiComentario_(reg), o = { v: +reg.RPE, t: e0.t || (it.plan ? it.plan['TÍTULO'] : '') || '' };
      if (cm) o.c = cm.slice(0, 600);
      s.d.d[it.iso].b[it.n] = o; s.sucia = true; out.bloques.subidos++;
      gabiGuardarEstado_(E, kFb, rFb, idPlan, nuevas);
    } else if (acc === 'pull') {
      var c = String(it.gfb.c || '').trim(), cambios = { RPE: String(+it.gfb.v) };
      if (reg) { if (c) cambios[String(reg.FEEDBACK || '').trim() ? 'FEEDBACK' : 'NOTAS'] = c; if (!reg.HECHO) cambios.HECHO = 'Sí'; cambios.REGISTRADO = ahora_(); actualizarFila_(HOJAS.REGISTRO, reg._fila, cambios); Object.assign(reg, cambios); }
      else { reg = it.reg = { FECHA: isoAFecha(it.plan ? celdaIso_(it.plan.FECHA) || it.iso : it.iso), ID_PLAN: idPlan, BLOQUE: it.plan ? it.plan.BLOQUE || it.plan['TÍTULO'] : it.n + ': ' + (it.gfb.t || ''), HECHO: 'Sí', RPE: String(+it.gfb.v), NOTAS: c, REGISTRADO: ahora_() }; regNuevos.push(reg); }
      out.bloques.bajados++;
      gabiGuardarEstado_(E, kFb, gFb, idPlan, nuevas);
    } else if (acc === 'igual') gabiGuardarEstado_(E, kFb, rFb, idPlan, nuevas);
    // --- resultado del metcon (leaderboard) ---
    var rRo = reg ? gabiResDe_(reg['DATOS (parciales/vatios)']) : null, rRs = gabiResTxt_(rRo);
    var gRo = it.grs ? { res: RS.g(it.grs, 'RESULTADO'), nivel: RS.g(it.grs, 'NIVEL') || 'RX', adapt: RS.g(it.grs, 'ADAPTACION') } : null, gRs = gRo && gRo.res ? gabiResTxt_(gRo) : '';
    var kRs = 'rs|' + it.iso + '|' + it.n, baseR = E[kRs] ? E[kRs].VALOR : null, accR = gabiDecidir_(baseR, rRs, gRs, rTs, it.gts || '');
    if (accR === 'push' && RS && it.plan && gabiEsMetcon_(it.plan)) {
      var tp = gabiResTipoPuntos_(rRo.res), cmb = { RESULTADO: rRo.res, NIVEL: rRo.nivel || 'RX', ADAPTACION: rRo.adapt || '', TIPO: tp.tipo, PUNTOS: String(tp.puntos) };
      if (it.grs) gabiEscribir_(RS, it.grs, cmb, cf.yo);
      else it.grs = gabiNuevaFila_(RS, Object.assign({ FECHA: isoAFecha(it.iso), ATLETA: P.nombre, SEXO: P.sexo, BLOQUE: it.n, METCON: it.plan['TÍTULO'] || 'METCON', WOD: gabiWodTxt_(it.plan), VERSION: '', CLAVE: cf.yo + '|' + it.iso + '|' + it.n + '|' }, cmb), cf.yo);
      out.resultados.subidos++; gabiGuardarEstado_(E, kRs, rRs, idPlan, nuevas);
    } else if (accR === 'pull') {
      var datos = reg ? String(reg['DATOS (parciales/vatios)'] || '').trim() : '';
      if (reg && reg._fila) {
        if (!datos || rRo) actualizarFila_(HOJAS.REGISTRO, reg._fila, { 'DATOS (parciales/vatios)': gabiResDatos_(gRo) });
        else actualizarFila_(HOJAS.REGISTRO, reg._fila, { NOTAS: (String(reg.NOTAS || '').trim() ? reg.NOTAS + ' · ' : '') + 'Resultado en la app de Gabi: ' + gabiResDatos_(gRo) });   // tus parciales no se pisan
      } else if (reg) reg['DATOS (parciales/vatios)'] = gabiResDatos_(gRo);   // fila nueva de este mismo paso
      else { reg = it.reg = { FECHA: isoAFecha(it.plan ? celdaIso_(it.plan.FECHA) || it.iso : it.iso), ID_PLAN: idPlan, BLOQUE: it.plan ? it.plan.BLOQUE || it.plan['TÍTULO'] : it.n + ': ' + RS.g(it.grs, 'METCON'), HECHO: 'Sí', 'DATOS (parciales/vatios)': gabiResDatos_(gRo), REGISTRADO: ahora_() }; regNuevos.push(reg); }
      out.resultados.bajados++; gabiGuardarEstado_(E, kRs, gRs, idPlan, nuevas);
    } else if (accR === 'igual') gabiGuardarEstado_(E, kRs, rRs, idPlan, nuevas);
  });
  if (regNuevos.length) filasEnHoja_(HOJAS.REGISTRO, regNuevos);
  // FEEDBACK: se reescriben solo DATOS, BLOQUES y ACTUALIZADO de las semanas de Pablo que han cambiado (o una fila nueva suya)
  Object.keys(semanas).forEach(function (l) {
    var s = semanas[l]; if (!s.sucia) return;
    var cmb = { DATOS: JSON.stringify(s.d), BLOQUES: gabiBloquesTxt_(s.d), ACTUALIZADO: ahora_() };
    if (s.f) gabiEscribir_(FB, s.f, cmb, cf.yo);
    else s.f = gabiNuevaFila_(FB, Object.assign({ SEMANA: isoAFecha(l), ATLETA: P.nombre }, cmb), cf.yo);
  });
}
/** Marcas: lo que falta en un lado se añade en el otro (clave MARCA|fecha|valor). Las copias que vinieron de Gabi no se devuelven. */
var GABI_TIPO_A_RTE_ = { KILOS: ['1RM', 'kg'], TIEMPO: ['Tiempo', 'min:seg'], REPS: ['Reps', 'reps'] };
function gabiTipoRteAGabi_(m) { var t = norm(m.TIPO).trim(); if (t === '1RM' || (!t && norm(m.UNIDAD).trim() === 'KG')) return 'Kilos'; if (t === 'TIEMPO') return 'Tiempo'; if (t === 'REPS') return 'Reps'; return ''; }
function gabiSyncMarcas_(libro, cf, P, E, nuevas, out, soloMarca) {
  var MK = gabiTabla_(libro, 'MARCAS', 'EMAIL'); if (!MK) return;
  var clave = function (mov, iso, val) { return 'mk|' + norm(mov).replace(/\s+/g, ' ').trim() + '|' + iso + '|' + gabiValor_(val); };
  var enGabi = {}, enRte = {}, rteFilas = listar_(HOJAS.MARCAS);
  MK.filas.forEach(function (f) { if (!gabiEsMia_(MK, f, cf.yo)) return; var iso = celdaIso_(MK.g(f, 'FECHA')); if (iso && MK.g(f, 'MARCA') && MK.g(f, 'VALOR')) enGabi[clave(MK.g(f, 'MARCA'), iso, MK.g(f, 'VALOR'))] = f; });
  rteFilas.forEach(function (m) { var iso = celdaIso_(m.FECHA); if (iso && m.MOVIMIENTO && m.VALOR) enRte[clave(m.MOVIMIENTO, iso, m.VALOR)] = m; });
  var bajar = [];
  Object.keys(enRte).forEach(function (k) {
    var m = enRte[k], iso = celdaIso_(m.FECHA);
    if (enGabi[k]) { if (iso >= cf.desde) gabiGuardarEstado_(E, k, 'ambos', 'marca', nuevas); return; }
    if (E[k] || iso < cf.desde || /^App Gabi/i.test(String(m.FUENTE || ''))) return;
    if (soloMarca && k !== clave(soloMarca.MOVIMIENTO, celdaIso_(soloMarca.FECHA), soloMarca.VALOR)) return;
    var tipo = gabiTipoRteAGabi_(m); if (!tipo) return;   // 3RM, distancia…: la app de Gabi no tiene ese tipo
    var o = { ATLETA: P.nombre, MARCA: String(m.MOVIMIENTO).toUpperCase().trim(), TIPO: tipo, VALOR: String(m.VALOR).replace('.', ','), FECHA: isoAFecha(iso), EVENTO: '', NOTAS: 'Road To Elite' + (m.NOTAS ? ' · ' + String(m.NOTAS).slice(0, 120) : '') };
    gabiInsertarMarca_(MK, o, cf.yo, P.nombre);
    MK = gabiTabla_(libro, 'MARCAS', 'EMAIL');   // las filas se han movido: se vuelve a leer
    out.marcas.subidas++; gabiGuardarEstado_(E, k, 'ambos', 'RTE ' + iso, nuevas);
  });
  if (soloMarca) return;
  Object.keys(enGabi).forEach(function (k) {
    if (enRte[k] || E[k]) return;
    var f = enGabi[k], iso = celdaIso_(MK.g(f, 'FECHA')); if (iso < cf.desde) return;
    var t = GABI_TIPO_A_RTE_[norm(MK.g(f, 'TIPO')).trim()] || [MK.g(f, 'TIPO'), ''];
    bajar.push({ FECHA: isoAFecha(iso), MOVIMIENTO: MK.g(f, 'MARCA').toUpperCase(), TIPO: t[0], VALOR: gabiValor_(MK.g(f, 'VALOR')), UNIDAD: t[1], EVENTO: MK.g(f, 'EVENTO'), NOTAS: MK.g(f, 'NOTAS'), FUENTE: 'App Gabi (sync ' + hoyTxt_() + ')' });
    out.marcas.bajadas++; gabiGuardarEstado_(E, k, 'ambos', 'Gabi ' + iso, nuevas);
  });
  if (bajar.length) filasEnHoja_(HOJAS.MARCAS, bajar);
}
/** Inserta la marca dentro del grupo «▸ Pablo» (tras su última fila). Sin grupo: debajo de «＋ AÑADE…» o al final. */
function gabiInsertarMarca_(MK, o, yo, nombre) {
  var col0 = function (f) { return String(f.v[0] == null ? '' : f.v[0]).trim(); }, ini = -1, ult = -1, mas = -1;
  MK.filas.forEach(function (f, i) {
    var a = col0(f);
    if (/^▸/.test(a)) { if (ini >= 0 && ult < 0) ult = i - 1; if (norm(a.replace(/^▸\s*/, '')).trim() === norm(nombre).trim()) ini = i; return; }
    if (/^＋/.test(a)) { if (mas < 0) mas = i; if (ini >= 0 && ult < 0) ult = i - 1; }
  });
  var llena = function (f) { return f.v.some(function (c) { return String(c).trim(); }); };
  if (ini >= 0 && ult < 0) { ult = ini; for (var j = ini + 1; j < MK.filas.length && llena(MK.filas[j]); j++) ult = j; }
  while (ini >= 0 && ult > ini && !llena(MK.filas[ult])) ult--;
  var tras = ini >= 0 ? MK.filas[ult].fila : mas >= 0 ? MK.filas[mas].fila : 0;
  if (!tras) return gabiNuevaFila_(MK, o, yo);
  MK.sh.insertRowAfter(tras);
  return gabiNuevaFila_(MK, o, yo, tras + 1);
}

// ---------- avisos y notas de Gabi → RTE (banner + correo, una vez) ----------
function gabiLlegaAMi_(para, evento, atletas, P, yo) {
  var p = norm(para).trim(), lista = String(atletas || '').split(/[,;\n]/).map(function (x) { return norm(x).trim(); }).filter(Boolean);
  var yoEnLista = lista.indexOf(norm(P.nombre).trim()) >= 0 || lista.indexOf(norm(yo)) >= 0;
  if (!p) return lista.length ? yoEnLista : true;
  if (p === 'TODOS') return true;
  if (p === 'ATLETAS') return yoEnLista;
  if (p === 'PARTICIPANTES') return !!evento && P.eventos.indexOf(norm(evento).trim()) >= 0;
  return P.grupos.indexOf(p) >= 0 || yoEnLista;   // un grupo (también a medida); o PARA con nombres
}
function gabiAvisos_(libro, cf, P, out) {
  if (!P.gabiOk) { out.errores.push('gabi_email ' + cf.gabi + ' no es Coach/Admin en ATLETAS: no se lee ningún aviso'); return; }
  gabiHoja_(HOJAS.AVISOS_GABI);
  var ya = {}; listar_(HOJAS.AVISOS_GABI).forEach(function (r) { if (r.ID) ya[r.ID] = r; });
  var hoy = hoyIso_(), nuevos = [], activo = function (v) { return /^(TRUE|VERDADERO|SI|1)$/.test(norm(v).trim()); };
  var huella = function (s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s)).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 10); };
  var mirar = function (T, tipo) {
    if (!T) return;
    T.filas.forEach(function (f) {
      if (T.g(f, 'EMAIL CREADOR').toLowerCase() !== cf.gabi) return;   // solo Gabi: ni Pablo ni el resto del grupo Coach ni lo escrito a mano sin autor
      if (!activo(T.g(f, tipo === 'Aviso' ? 'ACTIVO' : 'ACTIVA'))) return;
      if (!gabiLlegaAMi_(T.g(f, 'PARA'), T.g(f, 'EVENTO'), T.g(f, 'ATLETAS'), P, cf.yo)) return;
      var desde = celdaIso_(T.g(f, tipo === 'Aviso' ? 'DESDE' : 'FECHA')) || '', hasta = celdaIso_(T.g(f, 'HASTA')) || desde;
      if (desde && desde > hoy) return;                        // aún no toca: sale el día que empieza
      if (hasta && hasta < sumarDias(hoy, -3)) return;         // ya pasado
      var texto = tipo === 'Aviso' ? T.g(f, 'MENSAJE') : T.g(f, 'NOTA'), titulo = tipo === 'Aviso' ? T.g(f, 'TITULO') : 'Nota' + (T.g(f, 'ALCANCE') ? ' · ' + T.g(f, 'ALCANCE') : '') + (T.g(f, 'BLOQUE') ? ' ' + T.g(f, 'BLOQUE') : '');
      var id = (tipo === 'Aviso' ? 'A·' : 'N·') + (T.g(f, 'ID') || huella(titulo + '|' + texto + '|' + desde));
      if (ya[id]) return;
      ya[id] = { ID: id, TIPO: tipo, 'TÍTULO': titulo.slice(0, 200), MENSAJE: texto.slice(0, 1500), DESDE: desde ? isoAFecha(desde) : '', HASTA: hasta ? isoAFecha(hasta) : '',
        ENLACE: T.g(f, tipo === 'Aviso' ? 'ENLACE' : 'VIDEO'), PARA: T.g(f, 'PARA') || 'Todos', AUTOR: P.gabiNombre + ' · ' + cf.gabi, DETECTADO: ahora_(), CORREO: '', 'LEÍDO': '' };
      nuevos.push(ya[id]);
    });
  };
  mirar(gabiTabla_(libro, 'AVISOS', 'TITULO'), 'Aviso');
  mirar(gabiTabla_(libro, 'NOTAS', 'NOTA'), 'Nota');
  nuevos.forEach(function (a) {
    try {
      MailApp.sendEmail({ to: cf.yo, name: 'Road To Elite', subject: 'Road To Elite · ' + (a.TIPO === 'Aviso' ? 'aviso' : 'nota') + ' de Gabi: ' + a['TÍTULO'],
        htmlBody: '<p><b>' + esc_(a['TÍTULO']) + '</b></p><p>' + esc_(a.MENSAJE).replace(/\n/g, '<br>') + '</p>' + (a.ENLACE ? '<p><a href="' + esc_(a.ENLACE) + '">' + esc_(a.ENLACE) + '</a></p>' : '') +
          '<p style="color:#888">Publicado por ' + esc_(a.AUTOR) + ' en Fabrik Program' + (a.DESDE ? ' · ' + esc_(a.DESDE) + (a.HASTA && a.HASTA !== a.DESDE ? '–' + esc_(a.HASTA) : '') : '') + '.</p><p><a href="' + CONFIG.URL_APP + '">Abrir Road To Elite</a></p>' });
      a.CORREO = ahora_(); out.avisos.correos++;
    } catch (e) { out.errores.push('correo ' + a.ID + ': ' + (e && e.message || e)); }
    try { if (pushActivo_()) enviarPush_('Gabi: ' + a['TÍTULO'], String(a.MENSAJE).slice(0, 140)); } catch (e) {}
  });
  if (nuevos.length) filasEnHoja_(HOJAS.AVISOS_GABI, nuevos);
  out.avisos.nuevos = nuevos.length;
  // un aviso sin correo (falló MailApp) se reintenta en la siguiente pasada: una sola vez por aviso
  listar_(HOJAS.AVISOS_GABI).forEach(function (r) {
    if (r.CORREO || nuevos.some(function (n) { return n.ID === r.ID; })) return;
    try { MailApp.sendEmail({ to: cf.yo, name: 'Road To Elite', subject: 'Road To Elite · ' + (r.TIPO === 'Aviso' ? 'aviso' : 'nota') + ' de Gabi: ' + r['TÍTULO'], htmlBody: '<p><b>' + esc_(r['TÍTULO']) + '</b></p><p>' + esc_(r.MENSAJE).replace(/\n/g, '<br>') + '</p>' });
      actualizarFila_(HOJAS.AVISOS_GABI, r._fila, { CORREO: ahora_() }); out.avisos.correos++; } catch (e) {}
  });
}

// ---------- API y disparadores ----------
/** Tras guardar un registro en RTE: si es un bloque FABRIK, se sube en el momento (solo ese bloque). */
function gabiTrasRegistro_(o) {
  if (!o || !/^F\d{6}-/.test(String(o.ID_PLAN || '')) || !gabiCfg_().sync) return null;
  return syncGabi_({ ids: [String(o.ID_PLAN)] });
}
function gabiTrasMarca_(m) { if (!m || !gabiCfg_().sync) return null; return syncGabi_({ marca: m }); }
/** Cada hora, desde revisarAvisos. */
function syncGabiHora_() { var cf = gabiCfg_(); if (!cf.sync && !cf.avisos) return null; return syncGabi_({}); }
/** Al abrir la app: avisos de Gabi (y una sincronización si la última fue hace más de 10 min). */
function avisosGabiApi_() {
  var cf = gabiCfg_(), r = null;
  if ((cf.sync || cf.avisos) && !CacheService.getScriptCache().get('gabi_sync_reciente')) try { r = syncGabi_({}); } catch (e) { Logger.log('Sync Gabi al abrir: ' + e); }
  var l = [];
  try { gabiHoja_(HOJAS.AVISOS_GABI); MEMO = null; l = listar_(HOJAS.AVISOS_GABI); } catch (e) {}
  return { activo: cf.avisos, sync: cf.sync, ultimo: (leerConfig_().sync_gabi_ultimo || ''), avisos: l.slice(-40).reverse().map(function (a) {
    return { id: a.ID, tipo: a.TIPO, titulo: a['TÍTULO'], mensaje: a.MENSAJE, desde: a.DESDE, hasta: a.HASTA, enlace: a.ENLACE, leido: !!a['LEÍDO'] }; }) };
}
function avisoGabiLeido_(id, todos) {
  gabiHoja_(HOJAS.AVISOS_GABI); MEMO = null;
  listar_(HOJAS.AVISOS_GABI).forEach(function (a) { if (!a['LEÍDO'] && (todos || a.ID === String(id || ''))) actualizarFila_(HOJAS.AVISOS_GABI, a._fila, { 'LEÍDO': ahora_() }); });
  MEMO = null;
}
