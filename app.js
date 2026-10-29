/* Road To Elite · web v0.1
 * Una sola cuenta (la del Drive). Todo pasa por el Apps Script, que vuelve a comprobar token y email.
 * Pantallas: Semana (pizarra Fabrik + EXTRA + registro) · Cobertura · Marcas · Más (descuentos, webs, vídeos).
 */
(function () {
  'use strict';
  var C = window.APP_CONFIG;
  var $app = document.getElementById('app');
  var $tabs = document.getElementById('tabs');
  var $sheet = document.getElementById('sheet');
  var $scrim = document.getElementById('scrim');
  var DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  var DIAS_CORTO = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  var DIAS_BONITO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  var S = { user: null, tab: 'semana', semana: null, config: {}, videos: null, cobertura: null, marcas: null, descuentos: null, webs: null };

  // ===================== UTILIDADES =====================
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function sumarDias(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function aIso(txt) {
    var s = String(txt || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return '';
    var y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  function aTxt(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function corta(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function guardarLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  function leerLocal(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }

  // ===================== FIREBASE + SESIÓN =====================
  firebase.initializeApp(C.firebase);
  var auth = firebase.auth();
  auth.useDeviceLanguage();

  function pantallaLogin(msg) {
    $tabs.hidden = true;
    $app.innerHTML = '<div class="login"><div class="logo">E</div><div class="brand">Road To Elite</div>' +
      '<p class="hint">Fabrik + extras + carrera</p>' +
      '<button class="btn primary" id="g">Entrar con Google</button>' +
      (msg ? '<p class="err">' + esc(msg) + '</p>' : '') + '</div>';
    document.getElementById('g').onclick = function () {
      var p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ login_hint: C.emailPermitido, prompt: 'select_account' });
      auth.signInWithPopup(p).catch(function (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(p);
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') pantallaLogin('No se ha podido entrar (' + e.code + ').');
      });
    };
  }

  auth.onAuthStateChanged(function (u) {
    if (!u) { S.user = null; pantallaLogin(); return; }
    var email = String(u.email || '').toLowerCase();
    if (email !== C.emailPermitido) { auth.signOut(); pantallaLogin('Esta app es privada. La cuenta ' + email + ' no tiene acceso.'); return; }
    var ultima = leerLocal('rte_ultima');
    if (ultima && Date.now() - ultima > C.diasSesion * 864e5) { auth.signOut(); pantallaLogin('La sesión ha caducado por inactividad. Vuelve a entrar.'); return; }
    guardarLocal('rte_ultima', Date.now());
    S.user = u;
    arrancar();
  });

  function api(action, payload) {
    if (!S.user) return Promise.reject(new Error('sin_sesion'));
    return S.user.getIdToken().then(function (tok) {
      var body = Object.assign({ action: action, idToken: tok }, payload || {});
      return fetch(C.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) return j;
      if (j.error === 'sesion_caducada' || j.error === 'sin_sesion') { auth.signOut(); throw new Error('Sesión caducada'); }
      if (j.error === 'no_autorizado') { auth.signOut(); throw new Error('Cuenta no autorizada'); }
      throw new Error(j.detalle || j.error || 'Error');
    });
  }

  // ===================== ARRANQUE Y NAVEGACIÓN =====================
  function arrancar() {
    $tabs.hidden = false;
    cargando('Cargando tu semana…');
    var semGuardada = leerLocal('rte_videos');
    if (semGuardada) S.videos = semGuardada;
    api('inicio').then(function (j) {
      S.config = j.config || {}; S.semana = j.semana;
      pintar();
      if (!S.videos) cargarVideos();
    }).catch(function (e) { error(e); });
  }

  function cargarVideos() {
    api('videos').then(function (j) { S.videos = j.videos || []; guardarLocal('rte_videos', S.videos); if (S.tab === 'semana') pintar(); }).catch(function () {});
  }

  Array.prototype.forEach.call($tabs.querySelectorAll('button'), function (b) {
    b.onclick = function () {
      S.tab = b.dataset.tab;
      Array.prototype.forEach.call($tabs.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
      window.scrollTo(0, 0);
      pintar();
    };
  });

  function cargando(t) { $app.innerHTML = '<div class="splash"><div class="logo">E</div><div class="hint">' + esc(t) + '</div></div>'; }
  function error(e) {
    $app.innerHTML = cabecera('Error') + '<div class="card"><p class="err">' + esc(e && e.message || e) + '</p><button class="btn" id="re">Reintentar</button></div>';
    var b = document.getElementById('re'); if (b) b.onclick = arrancar;
  }
  function cabecera(titulo, extra) { return '<div class="top"><div class="logo">E</div><h1>' + esc(titulo) + '</h1>' + (extra || '') + '</div>'; }

  function pintar() {
    if (S.tab === 'semana') return pintarSemana();
    if (S.tab === 'cobertura') return pintarCobertura();
    if (S.tab === 'marcas') return pintarMarcas();
    if (S.tab === 'mas') return pintarMas();
  }

  // ===================== SEMANA =====================
  function irSemana(delta) {
    var lunes = sumarDias(S.semana.lunes, 7 * delta);
    cargando('Cargando semana del ' + corta(lunes) + '…');
    api('semana', { semana: lunes }).then(function (j) { S.semana = j.semana; pintar(); }).catch(error);
  }

  /** Reparte Fabrik y APP · PLAN por fecha. Si el plan coloca días de Fabrik (ORIGEN=FABRIK + FABRIK_DÍA), manda el plan. */
  function construirDias() {
    var sem = S.semana, fab = sem.fabrik, lunes = sem.lunes;
    var porNombre = {};
    if (fab) fab.dias.forEach(function (d) { porNombre[d.nombre] = d; });
    var colocados = sem.plan.filter(function (r) { return norm(r.ORIGEN) === 'FABRIK' && r['FABRIK_DÍA']; });
    var dias = [];
    for (var i = 0; i < 7; i++) {
      var iso = sumarDias(lunes, i);
      dias.push({ i: i, iso: iso, items: [] });
    }
    var porIso = {}; dias.forEach(function (d) { porIso[d.iso] = d; });

    if (colocados.length) {
      colocados.forEach(function (r) {
        var d = porIso[aIso(r.FECHA)], fd = porNombre[norm(r['FABRIK_DÍA']).trim()];
        if (d && fd) d.items.push({ tipo: 'fabrik', turno: r.TURNO || 'PM', orden: Number(r.ORDEN) || 50, dia: fd, nota: r['CONTENIDO'], estado: r.ESTADO });
      });
    } else if (fab) {
      fab.dias.forEach(function (fd) { var d = porIso[fd.iso]; if (d) d.items.push({ tipo: 'fabrik', turno: 'PM', orden: 50, dia: fd }); });
    }
    sem.plan.forEach(function (r) {
      if (norm(r.ORIGEN) === 'FABRIK' && r['FABRIK_DÍA']) return;
      var d = porIso[aIso(r.FECHA)];
      if (d) d.items.push({ tipo: 'extra', turno: r.TURNO || 'AM', orden: Number(r.ORDEN) || 0, fila: r });
    });
    dias.forEach(function (d) {
      d.items.sort(function (a, b) {
        var ta = norm(a.turno) === 'AM' ? 0 : 1, tb = norm(b.turno) === 'AM' ? 0 : 1;
        return ta - tb || a.orden - b.orden;
      });
    });
    return dias;
  }

  function registroDe(isoFecha, idPlan) {
    var f = aTxt(isoFecha);
    return S.semana.registro.filter(function (r) { return (r.FECHA === f || aIso(r.FECHA) === isoFecha) && r.ID_PLAN === idPlan; })[0] || null;
  }

  function pintarSemana() {
    var sem = S.semana;
    var fab = sem.fabrik;
    var ciclo = fab && fab.ciclo && fab.ciclo.actual >= 0 ? fab.ciclo.fases[fab.ciclo.actual] : null;
    var h = cabecera('Road To Elite', '<button class="btn small ghost" id="recarga" title="Recargar">↻</button>');
    h += '<div class="weeknav"><button class="btn small" id="prev">‹</button><div class="lbl">Semana ' + corta(sem.lunes) + ' – ' + corta(sumarDias(sem.lunes, 6)) + '</div><button class="btn small" id="next">›</button></div>';
    h += '<div class="row">' + (ciclo ? '<span class="chip fabrik">' + esc(ciclo.nombre) + ' · sem ' + fab.ciclo.semana + '/' + ciclo.semanas + '</span>' : '') +
      (fab ? '' : '<span class="chip">Sin semana de Fabrik</span>') +
      (sem.plan.some(function (r) { return norm(r.ESTADO) === 'BORRADOR'; }) ? '<span class="chip draft">Plan en borrador</span>' : '') + '</div>';

    var dias = construirDias();
    dias.forEach(function (d) {
      var hoy = d.iso === sem.hoy;
      h += '<details class="day' + (hoy ? ' today' : '') + '"' + (hoy || (!dias.some(function (x) { return x.iso === sem.hoy; }) && d.i === 0) ? ' open' : '') + '>';
      var nAm = d.items.filter(function (x) { return norm(x.turno) === 'AM'; }).length;
      h += '<summary><span class="dname">' + DIAS_BONITO[d.i] + '</span><span class="ddate">' + corta(d.iso) + '</span><span class="grow"></span>' +
        (nAm ? '<span class="chip extra">Doble</span>' : '') + (d.items.length ? '' : '<span class="chip">Descanso</span>') + '</summary><div class="dbody">';
      var turnoActual = null;
      d.items.forEach(function (it) {
        var t = norm(it.turno) === 'AM' ? 'AM' : 'PM';
        if (t !== turnoActual) { turnoActual = t; h += '<div class="turno">' + (t === 'AM' ? '☀️ Mañana' : '🌙 Tarde') + '</div>'; }
        h += it.tipo === 'fabrik' ? htmlFabrik(it, d.iso) : htmlExtra(it.fila, d.iso);
      });
      h += '</div></details>';
    });
    if (sem.erratasFabrik && sem.erratasFabrik.length)
      h += '<details class="card"><summary class="hint">Avisos de Fabrik (' + sem.erratasFabrik.length + ')</summary><ul class="hint">' + sem.erratasFabrik.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></details>';
    $app.innerHTML = h;
    document.getElementById('prev').onclick = function () { irSemana(-1); };
    document.getElementById('next').onclick = function () { irSemana(1); };
    document.getElementById('recarga').onclick = function () { irSemana(0); };
    Array.prototype.forEach.call($app.querySelectorAll('[data-reg]'), function (b) {
      b.onclick = function () { abrirRegistro(JSON.parse(b.dataset.reg)); };
    });
  }

  function intensidadClase(txt) {
    var n = norm(txt);
    if (/VERDE|TECNIC|🟢/.test(n) || txt.indexOf('🟢') >= 0) return 'z-tec';
    if (/AZUL|🔵/.test(n) || txt.indexOf('🔵') >= 0) return 'z-low';
    if (/NARANJA/.test(n) || txt.indexOf('🟠') >= 0) return 'z-mid';
    if (/ROJO/.test(n) || txt.indexOf('🔴') >= 0) return 'z-high';
    var m = n.match(/RPE\s*(\d+)/); if (m) { var r = Number(m[1]); return r >= 9 ? 'z-high' : r >= 7 ? 'z-mid' : 'z-low'; }
    return '';
  }

  function botonRegistro(iso, idPlan, bloque) {
    var r = registroDe(iso, idPlan);
    var est = r ? (r.HECHO === 'Sí' ? '<span class="state ok">✔ Hecho' : r.HECHO === 'Parcial' ? '<span class="state part">◐ Parcial' : '<span class="state no">✕ No hecho') + (r.RPE ? ' · RPE ' + esc(r.RPE) : '') + '</span>' : '<span class="state">Sin registrar</span>';
    var dato = esc(JSON.stringify({ iso: iso, idPlan: idPlan, bloque: bloque }));
    return '<div class="reg">' + est + '<span class="grow"></span><button class="btn small" data-reg="' + dato + '">' + (r ? 'Editar' : 'Registrar') + '</button></div>';
  }

  function htmlExtra(r, iso) {
    var cls = intensidadClase(r.INTENSIDAD || '');
    var h = '<div class="blk extra"><h3><span class="chip extra">EXTRA</span>' + esc(r['TÍTULO'] || r.BLOQUE || '') +
      (cls ? '<span class="chip z ' + cls + '">' + esc(r.INTENSIDAD) + '</span>' : (r.INTENSIDAD ? '<span class="chip">' + esc(r.INTENSIDAD) + '</span>' : '')) +
      (r.MIN ? '<span class="chip">⏱ ' + esc(r.MIN) + '′</span>' : '') +
      (r['CÓDIGOS'] ? '<span class="chip">' + esc(r['CÓDIGOS']) + '</span>' : '') +
      (norm(r.ESTADO) === 'BORRADOR' ? '<span class="chip draft">Borrador</span>' : '') + '</h3>';
    h += '<div class="board">' + conVideos(r.CONTENIDO || '') + '</div>';
    if (r['POR QUÉ (cursiva)']) h += '<div class="why">' + esc(r['POR QUÉ (cursiva)']) + '</div>';
    h += botonRegistro(iso, r.ID || ('X-' + r._fila), r['TÍTULO'] || r.BLOQUE || 'EXTRA');
    return h + '</div>';
  }

  function htmlFabrik(it, iso) {
    var d = it.dia, h = '';
    if (it.nota) h += '<div class="hint">⚠️ ' + esc(it.nota) + '</div>';
    if (d.foco && d.foco.length) h += '<div class="hint">' + d.foco.map(esc).join(' · ') + '</div>';
    d.bloques.forEach(function (b) {
      var cls = b.rpe ? intensidadClase('RPE ' + b.rpe) : '';
      h += '<div class="blk"><h3><span class="chip fabrik">FABRIK</span>' + (b.n ? b.n + ': ' : '') + esc(b.titulo) +
        (b.rpe ? '<span class="chip z ' + cls + '">RPE ' + esc(b.rpe) + '</span>' : '') + '</h3>';
      b.partes.forEach(function (p) {
        h += '<div class="part">' + (p.etiqueta ? '<div class="et">' + esc(p.etiqueta) + '</div>' : '') + '<div class="board">' + conVideos(p.texto) + '</div></div>';
      });
      if (b.wod) {
        var etq = { material: 'Material', intensidad: 'Intensidad', carga: 'Carga', notas: 'Notas', objetivo: 'Objetivo', formato: 'Formato', modalidad: 'Modalidad' };
        h += '<dl class="wod">' + Object.keys(b.wod).map(function (k) { return '<dt>' + esc(etq[k] || k) + '</dt><dd>' + esc(b.wod[k]) + '</dd>'; }).join('') + '</dl>';
      }
      if (b.nota) h += '<details class="coach"><summary>💬 Notas del coach</summary>' + esc(b.nota) + '</details>';
      (b.variantes || []).forEach(function (v) {
        h += '<details class="coach"><summary>Versión ' + esc(v.nombre) + ' (' + esc(v.tipo) + ')</summary>' +
          (v.titulo ? '<b>' + esc(v.titulo) + '</b>\n' : '') + v.partes.map(function (p) { return (p.etiqueta ? '<b>' + esc(p.etiqueta) + '</b>\n' : '') + esc(p.texto); }).join('\n\n') + '</details>';
      });
      h += botonRegistro(iso, 'F-' + d.nombre + '-' + b.n, b.titulo);
      h += '</div>';
    });
    (d.notasDia || []).forEach(function (n) { h += '<div class="coach">💬 ' + (n.titulo ? '<b>' + esc(n.titulo) + '</b> ' : '') + esc(n.texto) + '</div>'; });
    return h;
  }

  /** Añade ▶ a las líneas que nombran un ejercicio de tu biblioteca de vídeos. */
  function conVideos(texto) {
    var lista = S.videos || [];
    if (!lista.length) return esc(texto);
    var claves = [];
    lista.forEach(function (v) { [v.nombre].concat(v.alias || []).forEach(function (n) { var k = norm(n).trim(); if (k.length >= 4) claves.push({ k: k, url: v.url }); }); });
    claves.sort(function (a, b) { return b.k.length - a.k.length; });
    return String(texto).split('\n').map(function (l) {
      var nl = norm(l), hit = null;
      for (var i = 0; i < claves.length; i++) if (nl.indexOf(claves[i].k) >= 0) { hit = claves[i]; break; }
      return esc(l) + (hit && /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(hit.url) ? '<a class="vid" href="' + esc(hit.url) + '" target="_blank" rel="noopener noreferrer">▶</a>' : '');
    }).join('\n');
  }

  // ===================== REGISTRAR =====================
  function abrirSheet(html) { $sheet.innerHTML = html; $sheet.hidden = false; $scrim.hidden = false; $scrim.onclick = cerrarSheet; }
  function cerrarSheet() { $sheet.hidden = true; $scrim.hidden = true; $sheet.innerHTML = ''; }

  function abrirRegistro(ref) {
    var r = registroDe(ref.iso, ref.idPlan) || {};
    var hecho = r.HECHO || 'Sí', rpe = r.RPE || '';
    var h = '<h2>Registrar</h2><div class="hint">' + esc(ref.bloque) + ' · ' + aTxt(ref.iso) + '</div>' +
      '<div class="seg" id="hecho">' + ['Sí', 'Parcial', 'No'].map(function (x) { return '<button data-v="' + x + '" class="' + (x === hecho ? 'on' : '') + '">' + x + '</button>'; }).join('') + '</div>' +
      '<label class="f">RPE</label><div class="rpe" id="rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button data-v="' + n + '" class="' + (String(n) === String(rpe) ? 'on' : '') + '">' + n + '</button>'; }).join('') + '</div>' +
      '<div class="grid2"><label class="f">Minutos reales<input class="inp" id="min" inputmode="numeric" value="' + esc(r.MIN_REAL || '') + '"></label>' +
      '<label class="f">Sueño (h o 1–5)<input class="inp" id="sueno" value="' + esc(r['SUEÑO'] || '') + '"></label></div>' +
      '<label class="f">Parciales / vatios / tiempos<textarea class="inp" id="datos" placeholder="p. ej. 1:52 · 1:54 · 1:55 / 1050-980-940 W">' + esc(r['DATOS (parciales/vatios)'] || '') + '</textarea></label>' +
      '<label class="f">Cargas usadas<input class="inp" id="cargas" value="' + esc(r.CARGAS || '') + '"></label>' +
      '<label class="f">Molestias<input class="inp" id="molestias" value="' + esc(r.MOLESTIAS || '') + '"></label>' +
      '<label class="f">Notas<textarea class="inp" id="notas">' + esc(r.NOTAS || '') + '</textarea></label>' +
      '<div class="row"><button class="btn ghost" id="cancel">Cancelar</button><span class="grow"></span>' + (r.FECHA ? '<button class="btn ghost" id="borrar">Borrar</button>' : '') + '<button class="btn primary" id="ok">Guardar</button></div>';
    abrirSheet(h);
    ['hecho', 'rpe'].forEach(function (id) {
      Array.prototype.forEach.call(document.querySelectorAll('#' + id + ' button'), function (b) {
        b.onclick = function () {
          var ya = b.classList.contains('on');
          Array.prototype.forEach.call(document.querySelectorAll('#' + id + ' button'), function (x) { x.classList.remove('on'); });
          if (!(id === 'rpe' && ya)) b.classList.add('on');
        };
      });
    });
    var val = function (id) { return document.getElementById(id).value.trim(); };
    var sel = function (id) { var b = document.querySelector('#' + id + ' button.on'); return b ? b.dataset.v : ''; };
    document.getElementById('cancel').onclick = cerrarSheet;
    var bb = document.getElementById('borrar');
    if (bb) bb.onclick = function () {
      if (!confirm('¿Borrar este registro?')) return;
      api('registro_borrar', { registro: { FECHA: r.FECHA, ID_PLAN: r.ID_PLAN, BLOQUE: r.BLOQUE } }).then(function () { cerrarSheet(); toast('Registro borrado'); irSemana(0); }).catch(function (e) { toast(e.message); });
    };
    document.getElementById('ok').onclick = function () {
      var reg = { FECHA: aTxt(ref.iso), ID_PLAN: ref.idPlan, BLOQUE: ref.bloque, HECHO: sel('hecho'), RPE: sel('rpe'), MIN_REAL: val('min'),
        'DATOS (parciales/vatios)': val('datos'), CARGAS: val('cargas'), 'SUEÑO': val('sueno'), MOLESTIAS: val('molestias'), NOTAS: val('notas') };
      this.disabled = true;
      api('registrar', { registro: reg }).then(function () { cerrarSheet(); toast('Guardado'); irSemana(0); })
        .catch(function (e) { toast(e.message); document.getElementById('ok').disabled = false; });
    };
  }

  // ===================== COBERTURA =====================
  function pintarCobertura() {
    if (!S.cobertura) {
      cargando('Leyendo cobertura…');
      api('cobertura').then(function (j) { S.cobertura = j.cobertura; pintarCobertura(); }).catch(error);
      return;
    }
    var h = cabecera('Cobertura', '<button class="btn small ghost" id="recarga">↻</button>');
    [['Dashboard', 'dashboard', true], ['Semana', 'semana', false], ['Mes', 'mes', false], ['Carrera', 'carrera', false]].forEach(function (x) {
      h += '<details class="card"' + (x[2] ? ' open' : '') + '><summary><h2 style="display:inline">' + x[0] + '</h2></summary><div class="scrollx">' + tablaGrid(S.cobertura[x[1]] || []) + '</div></details>';
    });
    $app.innerHTML = h;
    document.getElementById('recarga').onclick = function () { S.cobertura = null; pintarCobertura(); };
  }

  function tablaGrid(g) {
    var filas = g.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
    if (!filas.length) return '<p class="hint">Vacío</p>';
    var ancho = 0;
    filas.forEach(function (r) { r.forEach(function (c, j) { if (String(c).trim() && j + 1 > ancho) ancho = j + 1; }); });
    return '<table class="tbl">' + filas.map(function (r) {
      return '<tr>' + r.slice(0, ancho).map(function (c) {
        var s = String(c).trim(), m = s.match(/^(\d{1,3}(?:[.,]\d+)?)\s*%$/);
        if (m) { var p = Math.min(100, parseFloat(m[1].replace(',', '.'))); return '<td class="n">' + esc(s) + '<div class="bar"><i class="' + (p >= 100 ? 'full' : '') + '" style="width:' + p + '%"></i></div></td>'; }
        return '<td' + (/^[\d.,:′'"\/ -]+$/.test(s) && s ? ' class="n"' : '') + '>' + esc(s) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</table>';
  }

  // ===================== MARCAS =====================
  function numero(v) { var s = String(v || '').replace(',', '.'); var m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/); if (m) return m[3] ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]); var n = parseFloat(s); return isNaN(n) ? null : n; }

  function sparkline(vals) {
    if (vals.length < 2) return '';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), w = 96, hgt = 28;
    var pts = vals.map(function (v, i) { return (i * (w - 4) / (vals.length - 1) + 2).toFixed(1) + ',' + (max === min ? hgt / 2 : (hgt - 3 - (v - min) * (hgt - 6) / (max - min))).toFixed(1); });
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + hgt + '" aria-hidden="true"><polyline fill="none" stroke="#ff7a1a" stroke-width="2" points="' + pts.join(' ') + '"/></svg>';
  }

  function pintarMarcas() {
    if (!S.marcas) {
      cargando('Leyendo marcas…');
      api('marcas').then(function (j) { S.marcas = j.marcas; pintarMarcas(); }).catch(error);
      return;
    }
    var grupos = {};
    S.marcas.forEach(function (m) { var k = (m.MOVIMIENTO || '').toUpperCase() + '|' + (m.TIPO || ''); (grupos[k] = grupos[k] || []).push(m); });
    var h = cabecera('Marcas', '<button class="btn small primary" id="nueva">＋ Marca</button>');
    h += '<div class="card"><div class="list">';
    Object.keys(grupos).sort().forEach(function (k) {
      var lista = grupos[k].slice().sort(function (a, b) { return aIso(a.FECHA) < aIso(b.FECHA) ? -1 : 1; });
      var ult = lista[lista.length - 1];
      var vals = lista.map(function (m) { return numero(m.VALOR); }).filter(function (x) { return x !== null; });
      h += '<details class="item" style="display:block"><summary class="row"><div class="grow"><div class="t">' + esc(ult.MOVIMIENTO) + ' <span class="chip">' + esc(ult.TIPO || '') + '</span></div>' +
        '<div class="s">' + esc(ult.FECHA) + (lista.length > 1 ? ' · ' + lista.length + ' registros' : '') + '</div></div>' + sparkline(vals) +
        '<div class="big">' + esc(ult.VALOR) + '<span class="hint"> ' + esc(ult.UNIDAD || '') + '</span></div></summary><div class="list" style="margin-top:6px">' +
        lista.slice().reverse().map(function (m) {
          return '<div class="row"><div class="grow s">' + esc(m.FECHA) + ' · ' + esc(m.VALOR) + ' ' + esc(m.UNIDAD || '') + (m.NOTAS ? ' · ' + esc(m.NOTAS) : '') + '</div>' +
            '<button class="btn small ghost" data-borrar="' + esc(JSON.stringify({ fila: m._fila, c: { FECHA: m.FECHA, MOVIMIENTO: m.MOVIMIENTO, VALOR: m.VALOR } })) + '">✕</button></div>';
        }).join('') + '</div></details>';
    });
    h += '</div></div>';
    $app.innerHTML = h;
    document.getElementById('nueva').onclick = nuevaMarca;
    Array.prototype.forEach.call($app.querySelectorAll('[data-borrar]'), function (b) {
      b.onclick = function (ev) {
        ev.preventDefault();
        var d = JSON.parse(b.dataset.borrar);
        if (!confirm('¿Borrar ' + d.c.MOVIMIENTO + ' ' + d.c.VALOR + ' (' + d.c.FECHA + ')?')) return;
        api('marca_borrar', { fila: d.fila, coincide: d.c }).then(function (j) { S.marcas = j.marcas; toast('Borrada'); pintarMarcas(); }).catch(function (e) { toast(e.message); });
      };
    });
  }

  function nuevaMarca() {
    var movs = {};
    (S.marcas || []).forEach(function (m) { movs[m.MOVIMIENTO] = 1; });
    var h = '<h2>Nueva marca</h2>' +
      '<label class="f">Movimiento<input class="inp" id="mov" list="movs" autocapitalize="characters"><datalist id="movs">' + Object.keys(movs).map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist></label>' +
      '<div class="grid2"><label class="f">Tipo<select class="inp" id="tipo">' + ['1RM', '3RM', '5RM', 'Reps', 'Tiempo', 'Distancia', 'Calorías', 'Benchmark'].map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Unidad<select class="inp" id="uni">' + ['kg', 'reps', 'min:seg', 'm', 'km', 'cal', 'W'].map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="grid2"><label class="f">Valor<input class="inp" id="val" placeholder="105 · 7:42 · 50"></label>' +
      '<label class="f">Fecha<input class="inp" id="fecha" type="date" value="' + esc(S.semana ? S.semana.hoy : '') + '"></label></div>' +
      '<label class="f">Evento (opcional)<input class="inp" id="ev"></label>' +
      '<label class="f">Notas<input class="inp" id="nt"></label>' +
      '<div class="row"><button class="btn ghost" id="cancel">Cancelar</button><span class="grow"></span><button class="btn primary" id="ok">Guardar</button></div>';
    abrirSheet(h);
    document.getElementById('cancel').onclick = cerrarSheet;
    document.getElementById('ok').onclick = function () {
      var v = function (id) { return document.getElementById(id).value.trim(); };
      var m = { MOVIMIENTO: v('mov'), TIPO: v('tipo'), UNIDAD: v('uni'), VALOR: v('val'), FECHA: aTxt(v('fecha')), EVENTO: v('ev'), NOTAS: v('nt') };
      if (!m.MOVIMIENTO || !m.VALOR) return toast('Falta movimiento o valor');
      api('marca', { marca: m }).then(function (j) { S.marcas = j.marcas; cerrarSheet(); toast('Marca guardada'); pintarMarcas(); }).catch(function (e) { toast(e.message); });
    };
  }

  // ===================== MÁS =====================
  function pintarMas() {
    var h = cabecera('Más');
    h += '<div class="card"><h2>Descuentos</h2><div id="desc" class="list"><p class="hint">Cargando…</p></div></div>';
    h += '<div class="card"><div class="row"><h2 class="grow">Webs</h2><button class="btn small" id="nuevaWeb">＋</button></div><div id="webs" class="list"><p class="hint">Cargando…</p></div></div>';
    h += '<div class="card"><h2>Vídeos</h2><input class="inp" id="buscar" placeholder="Buscar ejercicio…"><div id="vids" class="list" style="margin-top:8px"></div></div>';
    h += '<div class="card"><div class="row"><div class="grow"><div class="t">' + esc(S.user.email) + '</div><div class="s hint">Road To Elite · v0.1</div></div><button class="btn small" id="salir">Salir</button></div></div>';
    $app.innerHTML = h;
    document.getElementById('salir').onclick = function () { auth.signOut(); };
    document.getElementById('nuevaWeb').onclick = nuevaWeb;
    var buscar = document.getElementById('buscar');
    buscar.oninput = function () { pintarVideos(buscar.value); };
    pintarVideos('');
    (S.descuentos ? Promise.resolve({ descuentos: S.descuentos }) : api('descuentos')).then(function (j) { S.descuentos = j.descuentos; pintarDescuentos(); }).catch(function (e) { document.getElementById('desc').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
    (S.webs ? Promise.resolve({ webs: S.webs }) : api('webs')).then(function (j) { S.webs = j.webs; pintarWebs(); }).catch(function (e) { document.getElementById('webs').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
  }

  function urlSegura(u) { return /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''; }

  function pintarDescuentos() {
    var el = document.getElementById('desc'); if (!el) return;
    var lista = S.descuentos.filter(function (d) { return !/RETIRADO|CADUCADO/i.test(d.ESTADO || ''); });
    el.innerHTML = lista.length ? lista.map(function (d, i) {
      return '<div class="item"><div class="grow"><div class="t">' + esc(d.MARCA) + '</div><div class="s">' + esc(d['DESCRIPCIÓN'] || '') + (d.FIN ? ' · hasta ' + esc(d.FIN) : '') + '</div></div>' +
        (d['CÓDIGO'] ? '<button class="btn small" data-cod="' + i + '">' + esc(d['CÓDIGO']) + '</button>' : '') + '</div>';
    }).join('') : '<p class="hint">Sin descuentos.</p>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-cod]'), function (b) {
      b.onclick = function () {
        var d = lista[Number(b.dataset.cod)];
        (navigator.clipboard ? navigator.clipboard.writeText(d['CÓDIGO']) : Promise.resolve()).then(function () { toast('Código copiado'); });
        var u = urlSegura(d.ENLACE); if (u) window.open(u, '_blank', 'noopener');
      };
    });
  }

  function pintarWebs() {
    var el = document.getElementById('webs'); if (!el) return;
    el.innerHTML = S.webs.length ? S.webs.map(function (w) {
      var u = urlSegura(w.URL);
      return '<div class="item"><div class="grow"><div class="t">' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(w.NOMBRE || u) + '</a>' : esc(w.NOMBRE)) + '</div>' +
        '<div class="s">' + esc([w['CATEGORÍA'], w.NOTA].filter(Boolean).join(' · ')) + '</div></div>' +
        '<button class="btn small ghost" data-w="' + esc(JSON.stringify({ fila: w._fila, c: { NOMBRE: w.NOMBRE, URL: w.URL } })) + '">✕</button></div>';
    }).join('') : '<p class="hint">Añade tus páginas con ＋.</p>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-w]'), function (b) {
      b.onclick = function () {
        var d = JSON.parse(b.dataset.w);
        if (!confirm('¿Quitar ' + (d.c.NOMBRE || d.c.URL) + '?')) return;
        api('web_borrar', { fila: d.fila, coincide: d.c }).then(function (j) { S.webs = j.webs; pintarWebs(); }).catch(function (e) { toast(e.message); });
      };
    });
  }

  function nuevaWeb() {
    abrirSheet('<h2>Nueva web</h2><label class="f">Nombre<input class="inp" id="n"></label><label class="f">URL<input class="inp" id="u" type="url" placeholder="https://"></label>' +
      '<label class="f">Categoría<input class="inp" id="c" placeholder="Material, nutrición, competiciones…"></label><label class="f">Nota<input class="inp" id="t"></label>' +
      '<div class="row"><button class="btn ghost" id="cancel">Cancelar</button><span class="grow"></span><button class="btn primary" id="ok">Guardar</button></div>');
    document.getElementById('cancel').onclick = cerrarSheet;
    document.getElementById('ok').onclick = function () {
      var v = function (id) { return document.getElementById(id).value.trim(); };
      if (!urlSegura(v('u'))) return toast('La URL debe empezar por https://');
      api('web', { web: { NOMBRE: v('n'), URL: v('u'), 'CATEGORÍA': v('c'), NOTA: v('t') } }).then(function (j) { S.webs = j.webs; cerrarSheet(); pintarWebs(); toast('Guardada'); }).catch(function (e) { toast(e.message); });
    };
  }

  function pintarVideos(q) {
    var el = document.getElementById('vids'); if (!el) return;
    var lista = S.videos || [], nq = norm(q).trim();
    var r = lista.filter(function (v) { return !nq || norm(v.nombre).indexOf(nq) >= 0 || (v.alias || []).some(function (a) { return norm(a).indexOf(nq) >= 0; }); }).slice(0, 40);
    el.innerHTML = r.map(function (v) {
      var u = urlSegura(v.url);
      return '<div class="item"><div class="grow t">' + esc(v.nombre) + '</div>' + (u ? '<a class="btn small" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">▶</a>' : '') + '</div>';
    }).join('') || '<p class="hint">' + (lista.length ? 'Nada con ese nombre.' : 'Cargando biblioteca…') + '</p>';
  }

  // ===================== PWA =====================
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
