'use strict';
  // ---------- editor ----------
  function tmCopia(o) { return JSON.parse(JSON.stringify(o)); }
  function tmCampoDur(id, s) {
    s = Math.max(0, Math.round(s || 0));
    return '<span class="tm-dur"><input data-d="' + id + '-m" inputmode="numeric" value="' + Math.floor(s / 60) + '" aria-label="minutos"><b>:</b>' +
      '<input data-d="' + id + '-s" inputmode="numeric" value="' + (s % 60 < 10 ? '0' : '') + (s % 60) + '" aria-label="segundos"></span>';
  }
  function tmCampoNum(id, n, lbl) { return '<label class="tm-n">' + lbl + '<input data-n="' + id + '" inputmode="numeric" value="' + (n == null ? '' : n) + '" placeholder="?"></label>'; }
  function tmFilaHtml(g, i) {
    var h = '<div class="tm-row" data-row="' + i + '"><div class="tm-row-h"><b>' + esc(
      g.k === 'intervalo' ? g.etiqueta || 'EVERY' : g.k === 'cuenta' ? g.etiqueta : g.k === 'onoff' ? 'ON / OFF' : g.k === 'descanso' ? 'Descanso' : g.k === 'series' ? 'Series' : 'Cronómetro') +
      '</b><button class="icon-btn sm" type="button" data-tm-quitar="' + i + '" aria-label="Quitar">×</button></div><div class="tm-row-b">';
    if (g.k === 'intervalo') h += tmCampoNum(i + '-rondas', g.rondas, 'Rondas') + '<span class="tm-x">×</span><span class="tm-l">cada</span>' + tmCampoDur(i + '-cada', g.cada) +
      (g.cap ? '<span class="tm-l">cap</span>' + tmCampoDur(i + '-cap', g.cap) : '');
    if (g.k === 'cuenta' || g.k === 'descanso') h += tmCampoDur(i + '-dur', g.dur);
    if (g.k === 'onoff') h += tmCampoNum(i + '-rondas', g.rondas, 'Rondas') + '<span class="tm-l">on</span>' + tmCampoDur(i + '-on', g.on) + '<span class="tm-l">off</span>' + tmCampoDur(i + '-off', g.off);
    if (g.k === 'series') {
      h += tmCampoNum(i + '-series', g.series, 'Series') + '<span class="tm-l">descanso</span>' + tmCampoDur(i + '-descanso', g.descanso);
      h += '<div class="tm-pasos">' + g.pasos.map(function (p, j) {
        return '<div>' + (p.t === 'tap' ? '<span class="hint">Pulsas «Hecho»:</span> ' + esc(p.txt) :
          (p.t === 'pausa' ? '<span class="tm-l">pausa</span>' : '<span class="tm-l">' + esc(p.txt || 'trabajo') + '</span>') + tmCampoDur(i + '-p' + j, p.s)) + '</div>';
      }).join('') + '</div>';
    }
    if (g.k === 'crono') h += '<span class="tm-l">time cap</span>' + tmCampoDur(i + '-cap', g.cap || 0) + '<span class="hint">Cuenta hacia arriba. 0:00 = sin time cap.</span>';
    if (g.estaciones) h += '<div class="tm-est">' + g.estaciones.map(function (e, j) { return '<span>' + (j + 1) + ': ' + esc(e) + '</span>'; }).join('') + '</div>';
    return h + '</div></div>';
  }
  function tmLeerEditor(r) {
    var q = function (sel) { var e = $scrim.querySelector(sel); return e ? e.value : ''; };
    var dur = function (id) { return (parseInt(q('[data-d="' + id + '-m"]'), 10) || 0) * 60 + (parseInt(q('[data-d="' + id + '-s"]'), 10) || 0); };
    var num = function (id) { var v = parseInt(q('[data-n="' + id + '"]'), 10); return v > 0 ? v : null; };
    r.edit.grupos.forEach(function (g, i) {
      if (g.k === 'intervalo') { g.rondas = num(i + '-rondas'); g.cada = dur(i + '-cada'); if (g.cap) g.cap = dur(i + '-cap'); }
      if (g.k === 'cuenta' || g.k === 'descanso') g.dur = dur(i + '-dur');
      if (g.k === 'onoff') { g.rondas = num(i + '-rondas'); g.on = dur(i + '-on'); g.off = dur(i + '-off'); }
      if (g.k === 'crono') g.cap = dur(i + '-cap');
      if (g.k === 'series') { g.series = num(i + '-series') || 1; g.descanso = dur(i + '-descanso'); g.pasos.forEach(function (p, j) { if (p.t !== 'tap') p.s = dur(i + '-p' + j); }); }
    });
    var rp = parseInt(q('#tm-rep'), 10); if (r.libre || r.edit.repetir > 1 || rp > 1) r.edit.repetir = rp > 0 ? rp : 1;
  }
  function tmAbrirEditor(i) {
    var r = TM.reg[i]; if (!r) return;
    r.edit = tmCopia(r.propio || r.det);
    tmPintarEditor(r, i);
  }
  function tmPintarEditor(r, i) {
    var e = r.edit, falta = e.grupos.some(function (g) { return (g.k === 'intervalo' || g.k === 'onoff') && !g.rondas; });
    abrirHoja('<div class="row"><h2>' + (r.libre ? esc(r.titulo) : 'Tu timer') + '</h2>' + (r.libre ? '<button class="btn-ghost" data-tm-tipos type="button">‹ Tipos</button>' : '<button class="btn-ghost" data-close type="button">Cerrar</button>') + '</div>' +
      (r.libre ? '<div class="hint">Ajusta los tiempos a tu ejercicio. Se recuerda para la próxima vez.</div>' :
      '<div class="hint">' + esc(r.n + ' · ' + r.titulo) + (r.etq ? ' · ' + esc(r.etq) : '') + (r.version ? ' · versión ' + esc(nombreVersion(r.version)) : '') + '</div>' +
      '<details class="tm-orig"><summary>Lo que pone el plan</summary><div class="board small">' + esc(r.texto) + '</div></details>') +
      (r.libre || e.repetir > 1 ? '<label class="tm-n">Repetir todo<input id="tm-rep" inputmode="numeric" value="' + (e.repetir || 1) + '"> veces</label>' : '') +
      '<div id="tm-rows">' + e.grupos.map(tmFilaHtml).join('') + '</div>' +
      '<div class="tm-add"><button class="btn-ghost sm" type="button" data-tm-add="intervalo">＋ Intervalo</button><button class="btn-ghost sm" type="button" data-tm-add="cuenta">＋ Cuenta atrás</button>' +
      '<button class="btn-ghost sm" type="button" data-tm-add="descanso">＋ Descanso</button>' +
      (r.libre ? '<button class="btn-ghost sm" type="button" data-tm-add="onoff">＋ ON/OFF</button><button class="btn-ghost sm" type="button" data-tm-add="crono">＋ Cronómetro</button>' : '') + '</div>' +
      '<div class="tm-total" id="tm-total">' + tmTextoTotal(e) + '</div>' +
      (!e.grupos.length ? '<div class="hint">Añade tramos con los botones de arriba.</div>' : '') +
      (falta ? '<div class="err">Pon cuántas rondas son' + (r.libre ? '.' : ' (el plan no lo indica).') + '</div>' : (r.det.confianza !== 'alta' ? '<div class="err">Revisa los tiempos: ' + esc(r.det.notas.join(' · ')) + '</div>' : '')) +
      '<div class="two-btn"><button class="btn" type="button" data-tm-reset="' + i + '">' + (r.libre ? 'Valores por defecto' : 'Lo del plan') + '</button><button class="btn btn-primary" type="button" data-tm-go="' + i + '">Confirmar y empezar</button></div>');
    $scrim.querySelector('.sheet').oninput = function () { tmLeerEditor(r); document.getElementById('tm-total').textContent = tmTextoTotal(r.edit); };
  }
  function tmTextoTotal(e) {
    var t = tmTotal(e.grupos) * (e.repetir || 1), taps = e.grupos.some(function (g) { return g.k === 'series' || g.k === 'crono'; });
    return 'Total ' + (taps ? 'aprox. ' : '') + tmFmt(t) + (taps ? ' + lo que tardes en tus series' : '');
  }

  // ---------- pasos ----------
  function tmPasos(e) {
    var out = [], rep = e.repetir || 1;
    for (var k = 0; k < rep; k++) e.grupos.forEach(function (g, gi) {
      var pre = rep > 1 ? 'Set ' + (k + 1) + '/' + rep + ' · ' : '';
      if (g.k === 'intervalo') for (var r = 1; r <= (g.rondas || 0); r++)
        out.push({ k: 'work', dur: g.cada, tit: pre + (g.etiqueta || 'EVERY'), sub: 'Ronda ' + r + '/' + g.rondas, est: g.estaciones ? g.estaciones[(r - 1) % g.estaciones.length] : '', cap: g.cap });
      if (g.k === 'cuenta') out.push({ k: 'work', dur: g.dur, tit: pre + g.etiqueta, sub: tmFmt(g.dur) });
      if (g.k === 'descanso') out.push({ k: 'rest', dur: g.dur, tit: pre + 'Descanso', sub: '' });
      if (g.k === 'onoff') for (var o = 1; o <= (g.rondas || 0); o++) {
        out.push({ k: 'work', dur: g.on, tit: pre + (g.etiqueta === 'AMRAP' ? 'AMRAP' : 'ON'), sub: 'Ronda ' + o + '/' + g.rondas });
        out.push({ k: 'rest', dur: g.off, tit: pre + 'OFF', sub: 'Ronda ' + o + '/' + g.rondas });
      }
      if (g.k === 'series') for (var s = 1; s <= g.series; s++) {
        g.pasos.forEach(function (p) {
          if (p.t === 'tap') out.push({ k: 'tap', tit: pre + 'Serie ' + s + '/' + g.series, sub: p.txt });
          else out.push({ k: p.t === 'pausa' ? 'rest' : 'work', dur: p.s, tit: pre + (p.t === 'pausa' ? 'Pausa' : 'Serie ' + s + '/' + g.series), sub: p.t === 'pausa' ? '' : p.txt });
        });
        if (s < g.series && g.descanso) out.push({ k: 'rest', dur: g.descanso, tit: pre + 'Descanso', sub: 'Siguiente: serie ' + (s + 1) + '/' + g.series });
      }
      if (g.k === 'crono') out.push({ k: 'up', tit: pre + (g.etiqueta || 'FOR TIME'), sub: g.cap ? 'Time cap ' + tmFmt(g.cap) : 'Pulsa «Terminé» al acabar', cap: g.cap || 0 });
    });
    return out.filter(function (p) { return p.k === 'tap' || p.k === 'up' || p.dur > 0; });
  }

  // ---------- reloj ----------
  function tmBeep(f, ms) {
    var R = TM.run; if (!R || !R.ac || leer('rte-tm-mudo')) return;
    tmAudio();
    try {
      var o = R.ac.createOscillator(), g = R.ac.createGain(), t = R.ac.currentTime;
      o.frequency.value = f; o.type = 'square'; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.setValueAtTime(0.5, t + Math.max(0.02, ms / 1000 - 0.06));
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); o.connect(g); g.connect(R.ac.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
    } catch (e) {}
  }
  function tmVibrar(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function tmWake(on) {
    var R = TM.run;
    try {
      if (on && navigator.wakeLock && R && !R.wl) navigator.wakeLock.request('screen').then(function (w) { R.wl = w; }).catch(function () {});
      if (!on && R && R.wl) { R.wl.release(); R.wl = null; }
    } catch (e) {}
  }
  // Al volver del segundo plano: recalcula con la hora real (salta los tramos que hayan pasado) y repinta.
  document.addEventListener('visibilitychange', function () {
    var R = TM.run; if (!R || R.fin) return;
    if (document.visibilityState === 'visible') { R.wl = null; tmWake(true); tmAudio(); tmTick(); tmPintar(); }
    else { tmGuardarRun(); tmPipAuto(); }
  });
  window.addEventListener('pagehide', function () { tmGuardarRun(); });
  function tmAudio() { var R = TM.run; try { if (R && R.ac && R.ac.state === 'suspended') R.ac.resume(); } catch (e) {} }

  function tmEmpezar(i) {
    var r = TM.reg[i]; if (!r) return;
    tmLeerEditor(r);
    if (r.edit.grupos.some(function (g) { return (g.k === 'intervalo' || g.k === 'onoff') && !g.rondas; })) { toast('Pon cuántas rondas son.'); return; }
    guardar(tmClave(r), r.edit); r.propio = r.edit;
    var pasos = tmPasos(r.edit);
    if (!pasos.length) { toast('No hay ningún tramo con tiempo.'); return; }
    cerrarHoja();
    tmSesionAudio();
    var ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.resume) ac.resume(); } catch (e) {}
    pasos.unshift({ k: 'rest', dur: 10, tit: 'Prepárate', sub: r.titulo, prep: true });
    var rr = { texto: r.texto, etq: r.etq, iso: r.iso, n: r.libre ? '' : r.n, titulo: r.titulo, version: r.version, metcon: r.metcon };
    TM.run = { r: rr, pasos: pasos, i: 0, ini: Date.now(), pausa: 0, enPausa: null, ac: ac, ultSeg: null, total0: Date.now(), fin: false, capAvisado: false };
    tmMontarReloj(); tmGuardarRun(); tmPipIniciar();
  }
  function tmMontarReloj() {
    var el = document.getElementById('reloj');
    if (!el) { el = document.createElement('div'); el.id = 'reloj'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Timer'); document.body.appendChild(el); }
    el.className = 'reloj'; document.body.classList.add('con-reloj');
    tmWake(true); tmTick(); tmPintar(); clearInterval(TM.run.int); TM.run.int = setInterval(tmTick, 200);
  }

  // ---------- estado guardado: el timer sobrevive al segundo plano y a una recarga de la app ----------
  // Todo se calcula con la hora real (Date.now): aunque el móvil congele la app, al volver se sabe
  // exactamente en qué tramo y segundo va.
  var TM_KEY = 'rte-tm-run';
  function tmGuardarRun() {
    var R = TM.run; if (!R || R.fin) return;
    guardar(TM_KEY, { r: R.r, pasos: R.pasos, i: R.i, ini: R.ini, pausa: R.pausa, enPausa: R.enPausa, total0: R.total0 });
  }
  function tmBorrarRun() { try { localStorage.removeItem(TM_KEY); } catch (e) {} }
  function tmRestaurar() {
    if (TM.run) return;
    var s = leer(TM_KEY);
    if (!s || !s.pasos || !s.pasos.length || Date.now() - s.total0 > 4 * 3600 * 1000) { tmBorrarRun(); return; }
    tmSesionAudio();
    var ac = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    TM.run = { r: s.r, pasos: s.pasos, i: s.i, ini: s.ini, pausa: s.pausa || 0, enPausa: s.enPausa || null, ac: ac, ultSeg: null, total0: s.total0, fin: false, capAvisado: true };
    tmMontarReloj(); tmPipIniciar();
  }
  setTimeout(tmRestaurar, 0);

  function tmTranscurrido() { var R = TM.run; return ((R.enPausa || Date.now()) - R.ini - R.pausa) / 1000; }
  function tmTick() {
    var R = TM.run; if (!R || R.fin) return;
    if (R.enPausa) { tmPipDibujar(); return; }
    var saltos = 0, p, t;
    for (;;) {
      p = R.pasos[R.i]; t = tmTranscurrido();
      if (!(p.k === 'work' || p.k === 'rest') || t < p.dur) break;
      // el tramo terminó (en directo o mientras la app estaba en segundo plano): pasa al siguiente
      // con el reloj exacto en que acabó, sin perder ni ganar segundos
      if (R.i + 1 >= R.pasos.length) { R.i = R.pasos.length; return tmFinal(); }
      R.ini = R.ini + R.pausa + p.dur * 1000; R.pausa = 0; R.i++; R.ultSeg = null; R.capAvisado = false; saltos++;
      if (saltos > 1000) break;
    }
    if (saltos) { tmAvisoTramo(); tmPintar(); tmGuardarRun(); tmPipDibujar(); return; }
    if (p.k === 'up' && p.cap) {
      var sc = Math.ceil(p.cap - t);
      if (sc !== R.ultSeg) { R.ultSeg = sc; if (sc <= 3 && sc >= 1) tmBeep(880, 120); }
      if (t >= p.cap) { R.capFin = true; R.i = R.pasos.length; return tmFinal(p.cap); }
    }
    if (p.k === 'work' || p.k === 'rest') {
      var seg = Math.ceil(p.dur - t);
      if (seg !== R.ultSeg) {
        R.ultSeg = seg;
        if (seg <= 3 && seg >= 1) tmBeep(880, 120);
        if (p.cap && !R.capAvisado && t >= p.cap) { R.capAvisado = true; tmBeep(660, 400); tmVibrar([150, 80, 150]); }
      }
    }
    tmPintar(true); tmPipDibujar();
  }
  /** Pitidos: 3-2-1 cortos antes de cada cambio · cambio de ronda = pitido medio · inicio = pitido largo. */
  function tmAvisoTramo() {
    var R = TM.run, p = R.pasos[R.i], ant = R.pasos[R.i - 1];
    if (ant && ant.prep) { tmBeep(1040, 1100); tmVibrar(700); return; }   // ¡empieza!
    tmBeep(p.k === 'rest' ? 620 : 1040, 500); tmVibrar(p.k === 'rest' ? 200 : [250, 100, 250]);
  }
  /** iPhone: sin esto, el interruptor de silencio apaga los pitidos. */
  function tmSesionAudio() { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} }
  function tmIcoSon(on) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>' + (on ? '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' : '<path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') + '</svg>'; }
  /** Saltar o «Hecho»: el siguiente tramo empieza ahora. */
  function tmSiguiente() {
    var R = TM.run;
    R.i++; R.ini = Date.now(); R.pausa = 0; R.ultSeg = null; R.capAvisado = false;
    if (R.i >= R.pasos.length) return tmFinal();
    tmAvisoTramo(); tmPintar(); tmGuardarRun(); tmPipDibujar();
  }
  /** Pausa / seguir (desde el botón, desde la burbuja o desde los controles del sistema). */
  function tmPausa(on) {
    var R = TM.run; if (!R || R.fin) return;
    if (on === undefined) on = !R.enPausa;
    if (on && !R.enPausa) R.enPausa = Date.now();
    else if (!on && R.enPausa) { R.pausa += Date.now() - R.enPausa; R.enPausa = null; tmWake(true); }
    else return;
    tmPintar(); tmGuardarRun(); tmPipDibujar(); tmPipSync();
  }
  function tmFinal(cronoSeg) {
    var R = TM.run; R.fin = true; clearInterval(R.int); tmWake(false); tmBorrarRun();
    tmPipDibujar('FIN'); setTimeout(tmPipCerrar, 5000);
    tmBeep(1040, 1600); tmVibrar([600, 150, 600]);   // final: pitido largo
    var el = document.getElementById('reloj'); if (!el) return;
    var total = (Date.now() - R.total0) / 1000 - 10;
    el.className = 'reloj fin';
    var segF = cronoSeg != null ? cronoSeg : Math.max(0, total);
    el.innerHTML = '<div class="rl-top"><span>' + esc((R.r.n ? R.r.n + ' · ' : '') + R.r.titulo) + '</span></div>' +
      '<div class="rl-caja">' + tmPanel(segF, null, 'rojo') + '</div>' +
      '<div class="rl-info"><div class="rl-tit rojo">' + (R.capFin ? 'Time cap' : cronoSeg != null ? 'Tu tiempo' : '¡Terminado!') + '</div></div><div class="rl-btns">' +
      (R.r.metcon ? '<button class="btn btn-primary" type="button" data-rl="resultado"' + (cronoSeg != null ? ' data-t="' + Math.round(cronoSeg) + '"' : '') + '>Apuntar resultado</button>' : '') +
      '<button class="btn" type="button" data-rl="salir">Cerrar</button></div>';
  }
  // ---------- dígitos LED de 7 segmentos (marcador de box) ----------
  var LED_SEG = {
    a: '12,3 48,3 53,8 48,13 12,13 7,8', g: '12,45 48,45 53,50 48,55 12,55 7,50', d: '12,87 48,87 53,92 48,97 12,97 7,92',
    f: '8,12 13,17 13,41 8,46 3,41 3,17', e: '8,54 13,59 13,83 8,88 3,83 3,59',
    b: '52,12 57,17 57,41 52,46 47,41 47,17', c: '52,54 57,59 57,83 52,88 47,83 47,59' };
  var LED_DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
  /** SVG con dígitos LED (encendidos + segmentos apagados de fondo, como un marcador real). */
  function tmLed(txt, cls) {
    var x = 0, h = '';
    String(txt).split('').forEach(function (ch) {
      if (ch === ':') { h += '<circle class="on" cx="' + (x + 12) + '" cy="32" r="5.5"/><circle class="on" cx="' + (x + 12) + '" cy="70" r="5.5"/>'; x += 24; return; }
      var on = LED_DIG[ch] || '';
      Object.keys(LED_SEG).forEach(function (k) { h += '<polygon class="' + (on.indexOf(k) >= 0 ? 'on' : 'off') + '" points="' + LED_SEG[k] + '" transform="translate(' + x + ' 0)"/>'; });
      x += 68;
    });
    return '<svg class="led ' + (cls || '') + '" viewBox="-6 -2 ' + (x + 6) + ' 104" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g transform="skewX(-6) translate(10 0)">' + h + '</g></svg>';
  }
  /** Reloj en formato marcador: MM:SS (o H:MM:SS). */
  function tmLedTxt(s) {
    s = Math.max(0, Math.round(s)); var hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60, p = function (n) { return (n < 10 ? '0' : '') + n; };
    return hh ? hh + ':' + p(m) + ':' + p(r) : p(Math.floor(s / 60)) + ':' + p(r);
  }
  /** Reloj MM:SS en una línea (vertical y horizontal). */
  function tmReloj(seg, color) {
    return tmLed(tmLedTxt(seg), color);
  }
  function tmRonda(p) {
    var m = /(?:Ronda|Serie) (\d+)\/(\d+)/.exec((p.sub || '') + ' ' + (p.tit || ''));
    return m ? { n: +m[1], de: +m[2] } : null;
  }
  function tmPanel(seg, p, color) {
    var rd = p ? tmRonda(p) : null;
    return '<div class="rl-led ' + color + '">' +
      (p ? '<div class="rl-rd">' + tmLed(rd ? (rd.n < 10 ? '0' : '') + rd.n : '  ', 'verde') + '<span>' + (rd ? 'de ' + rd.de : '&nbsp;') + '</span></div>' : '') +
      '<div class="rl-t" role="timer" aria-live="off" aria-label="' + tmFmt(seg) + '">' + tmReloj(seg, color) + '</div></div>';
  }
  function tmPintar(soloTiempo) {
    var R = TM.run, el = document.getElementById('reloj'); if (!R || !el) return;
    var p = R.pasos[R.i], t = tmTranscurrido(), sig = R.pasos[R.i + 1];
    var seg = p.k === 'up' || p.k === 'tap' ? Math.floor(t) : Math.max(0, Math.ceil(p.dur - t));
    var color = p.k === 'rest' && !p.prep ? 'verde' : 'rojo';
    var prog = p.dur ? Math.min(1, t / p.dur) : 0;
    if (soloTiempo && el.querySelector('.rl-t')) {
      if (R.ultPint !== seg) { R.ultPint = seg; el.querySelector('.rl-t').innerHTML = tmReloj(seg, color); }
      var b = el.querySelector('.rl-bar i'); if (b) b.style.width = (prog * 100) + '%';
      return;
    }
    R.ultPint = seg;
    el.className = 'reloj ' + (p.prep ? 'prep' : p.k) + (R.enPausa ? ' pausado' : '');
    var son = !leer('rte-tm-mudo');
    el.innerHTML = '<div class="rl-top"><span class="rl-nom">' + esc((R.r.n ? R.r.n + ' · ' : '') + R.r.titulo) + '</span><span class="rl-der"><span>Tramo ' + R.i + '/' + (R.pasos.length - 1) + '</span>' +
      '<button class="rl-son" type="button" data-tm-son aria-pressed="' + son + '" aria-label="' + (son ? 'Silenciar pitidos' : 'Activar pitidos') + '">' + tmIcoSon(son) + '</button>' +
      (tmPipSoportado() ? '<button class="rl-pip' + (PIP.abierta ? ' on' : '') + '" type="button" data-rl="burbuja" aria-label="' + (PIP.abierta ? 'Cerrar la burbuja flotante' : 'Abrir el timer en una burbuja flotante') + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="12" y="11.5" width="7.5" height="5.5" rx="1.2" fill="currentColor"/></svg>' +
        '<span>' + (PIP.abierta ? 'Cerrar' : 'Burbuja') + '</span></button>' : '') + '</span></div>' +
      '<div class="rl-caja">' + tmPanel(seg, p, color) + (p.dur ? '<div class="rl-bar ' + color + '"><i style="width:' + (prog * 100) + '%"></i></div>' : '') + '</div>' +
      '<div class="rl-info"><div class="rl-tit ' + color + '">' + esc(p.tit) + '</div>' +
      (p.sub && !/^(Ronda|Serie) \d+\/\d+$/.test(p.sub) ? '<div class="rl-sub">' + esc(p.sub) + '</div>' : '') +
      (p.est ? '<div class="rl-est">' + esc(p.est) + '</div>' : '') +
      (p.cap ? '<div class="rl-sub">Time cap a los ' + tmFmt(p.cap) + '</div>' : '') +
      '<div class="rl-sig">' + (sig ? 'Después: ' + esc(sig.tit) + (sig.dur ? ' · ' + tmFmt(sig.dur) : '') : 'Último tramo') + '</div></div>' +
      '<div class="rl-btns">' +
      (p.k === 'tap' ? '<button class="btn btn-primary rl-big" type="button" data-rl="hecho">Hecho ✓</button>' : '') +
      (p.k === 'up' ? '<button class="btn btn-primary rl-big" type="button" data-rl="termine">Terminé</button>' : '') +
      '<div class="rl-row"><button class="btn" type="button" data-rl="pausa">' + (R.enPausa ? 'Seguir' : 'Pausa') + '</button>' +
      '<button class="btn" type="button" data-rl="saltar">Saltar</button>' +
      '<button class="btn" type="button" data-rl="salir">Salir</button></div></div>';
  }
  function tmCerrar() {
    var R = TM.run; if (R) { clearInterval(R.int); tmWake(false); try { if (R.ac) R.ac.close(); } catch (e) {} }
    TM.run = null; tmBorrarRun(); tmPipCerrar(); var el = document.getElementById('reloj'); if (el) el.remove(); document.body.classList.remove('con-reloj');
    if (S.recargarAlCerrar) { S.recargarAlCerrar = false; setTimeout(recargarApp, 50); }
  }

  document.addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('[data-tm]'))) { tmAbrirEditor(+b.dataset.tm); return; }
    if ((b = t.closest('[data-tm-quitar]'))) { var r1 = TM.reg[+($scrim.querySelector('[data-tm-go]') || {}).dataset.tmGo]; if (!r1) return; tmLeerEditor(r1); r1.edit.grupos.splice(+b.dataset.tmQuitar, 1); tmPintarEditor(r1, TM.reg.indexOf(r1)); return; }
    if ((b = t.closest('[data-tm-add]'))) {
      var r2 = TM.reg[+$scrim.querySelector('[data-tm-go]').dataset.tmGo]; tmLeerEditor(r2);
      var k = b.dataset.tmAdd;
      r2.edit.grupos.push(k === 'intervalo' ? { k: 'intervalo', cada: 60, rondas: 5, etiqueta: 'EVERY' } : k === 'cuenta' ? { k: 'cuenta', dur: 600, etiqueta: 'CUENTA ATRÁS' } :
        k === 'onoff' ? { k: 'onoff', rondas: 8, on: 20, off: 10, etiqueta: 'ON/OFF' } : k === 'crono' ? { k: 'crono', etiqueta: 'FOR TIME', cap: 0 } : { k: 'descanso', dur: 60 });
      tmPintarEditor(r2, TM.reg.indexOf(r2)); return;
    }
    if ((b = t.closest('[data-tm-reset]'))) { var r3 = TM.reg[+b.dataset.tmReset]; r3.edit = tmCopia(r3.det); try { localStorage.removeItem(tmClave(r3)); } catch (x) {} r3.propio = null; tmPintarEditor(r3, +b.dataset.tmReset); return; }
    if ((b = t.closest('[data-tm-go]'))) { tmEmpezar(+b.dataset.tmGo); return; }
    if ((b = t.closest('[data-tm-tipos]'))) { abrirTimerLibre(); return; }
    if ((b = t.closest('[data-tm-libre]'))) { tmLibre(b.dataset.tmLibre); return; }
    if ((b = t.closest('[data-tm-son]'))) { var mu = !leer('rte-tm-mudo'); guardar('rte-tm-mudo', mu); b.setAttribute('aria-pressed', String(!mu)); b.innerHTML = tmIcoSon(!mu); b.setAttribute('aria-label', mu ? 'Activar pitidos' : 'Silenciar pitidos'); toast(mu ? 'Pitidos silenciados' : 'Pitidos activados'); return; }
    if ((b = t.closest('[data-rl]'))) {
      var R = TM.run, a = b.dataset.rl; if (!R) return;
      if (a === 'salir') { tmCerrar(); return; }
      tmAudio();
      if (a === 'pausa') { tmPausa(); return; }
      if (a === 'burbuja') { tmPipAbrir(); return; }
      if (a === 'saltar' || a === 'hecho') { tmSiguiente(); return; }
      if (a === 'termine') { var seg = tmTranscurrido(); R.i = R.pasos.length; tmFinal(seg); return; }
      if (a === 'resultado') {
        var rr = R.r, tt = b.dataset.t ? textoTiempo({ h: Math.floor(+b.dataset.t / 3600), m: Math.floor(+b.dataset.t % 3600 / 60), s: +b.dataset.t % 60 }) : null;
        tmCerrar(); if (!S.data) { toast('Abre la app y apunta el resultado desde el bloque.'); return; }
        var bq = S.data.dias.filter(function (y) { return y.iso === rr.iso; })[0], blq = bq && bq.bloques.filter(function (z) { return String(z.n) === String(rr.n); })[0];
        if (blq) { abrirRegistro({ iso: rr.iso, id: idPlanDe(bq, blq), bloque: (blq.extra ? 'EXTRA · ' : blq.n + ': ') + blq.titulo }); if (tt) setTimeout(function () { var dt = document.getElementById('rg-dat'); if (dt && !dt.value) dt.value = tt; }, 30); }
        return;
      }
    }
  });

  // =====================================================================
  //  BURBUJA FLOTANTE · el marcador en una ventanita «imagen en imagen» encima de cualquier app.
  //  Se dibuja en un canvas que se emite como vídeo; el botón ▶/❚❚ de la ventanita pausa el timer.
  // =====================================================================
  function tmPipSoportado() {
    try {
      var v = HTMLVideoElement.prototype, c = HTMLCanvasElement.prototype;
      return !!c.captureStream && !!(('requestPictureInPicture' in v && document.pictureInPictureEnabled !== false) || 'webkitSetPresentationMode' in v);
    } catch (e) { return false; }
  }
  function tmPipIniciar() {
    if (!tmPipSoportado() || PIP.v) return;
    try {
      var c = document.createElement('canvas'); c.width = 640; c.height = 360;
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      v.setAttribute('autopictureinpicture', ''); try { v.autoPictureInPicture = true; } catch (e) {}
      v.className = 'tm-pip-v'; v.setAttribute('aria-hidden', 'true');
      PIP = { c: c, ctx: c.getContext('2d'), v: v, abierta: false, ignorar: false };
      tmPipDibujar();
      v.srcObject = c.captureStream(10);
      document.body.appendChild(v);
      v.play().catch(function () {});
      v.addEventListener('pause', function () { if (!PIP.ignorar && PIP.abierta) tmPausa(true); });
      v.addEventListener('play', function () { if (!PIP.ignorar && PIP.abierta) tmPausa(false); });
      v.addEventListener('enterpictureinpicture', function () { PIP.abierta = true; tmPintar(); });
      v.addEventListener('leavepictureinpicture', function () { PIP.abierta = false; if (TM.run) tmPintar(); });
      v.addEventListener('webkitpresentationmodechanged', function () { PIP.abierta = v.webkitPresentationMode === 'picture-in-picture'; if (TM.run) tmPintar(); });
      if (navigator.mediaSession) {
        try { navigator.mediaSession.metadata = new MediaMetadata({ title: 'Timer · ' + (TM.run.r.titulo || ''), artist: 'Road To Elite' }); } catch (e) {}
        [['play', function () { tmPausa(false); }], ['pause', function () { tmPausa(true); }],
         ['enterpictureinpicture', function () { tmPipAbrir(); }]].forEach(function (h) { try { navigator.mediaSession.setActionHandler(h[0], h[1]); } catch (e) {} });
      }
    } catch (e) { PIP = {}; }
  }
  /** Abrir / cerrar la burbuja con el botón (necesita el toque del usuario). */
  function tmPipAbrir() {
    var v = PIP.v; if (!v) { tmPipIniciar(); v = PIP.v; } if (!v) { toast('Tu navegador no permite la burbuja.'); return; }
    try {
      if (PIP.abierta) {
        if (document.pictureInPictureElement && document.exitPictureInPicture) document.exitPictureInPicture().catch(function () {});
        else if (v.webkitSetPresentationMode) v.webkitSetPresentationMode('inline');
        return;
      }
      var abrir = function () {
        if (v.requestPictureInPicture) return v.requestPictureInPicture();
        v.webkitSetPresentationMode('picture-in-picture');
      };
      var pr = v.play(); tmPipSync();
      Promise.resolve(pr).catch(function () {}).then(abrir).catch(function () { toast('No se pudo abrir la burbuja.'); });
    } catch (e) { toast('No se pudo abrir la burbuja.'); }
  }
  /** Al pasar a segundo plano: intenta abrir la burbuja sola (Android/Chrome y iPhone lo permiten según versión). */
  function tmPipAuto() {
    var v = PIP.v; if (!v || PIP.abierta || !TM.run || TM.run.fin) return;
    try { if (v.requestPictureInPicture) v.requestPictureInPicture().catch(function () {}); } catch (e) {}
  }
  /** El vídeo de la burbuja sigue al timer: en pausa muestra ▶, corriendo muestra ❚❚. */
  function tmPipSync() {
    var v = PIP.v, R = TM.run; if (!v || !R) return;
    PIP.ignorar = true;
    if (R.enPausa) setTimeout(function () { try { v.pause(); } catch (e) {} setTimeout(function () { PIP.ignorar = false; }, 50); }, 150);
    else Promise.resolve(v.play()).catch(function () {}).then(function () { setTimeout(function () { PIP.ignorar = false; }, 50); });
  }
  function tmPipCerrar() {
    var v = PIP.v; if (!v) return;
    try { if (document.pictureInPictureElement === v) document.exitPictureInPicture().catch(function () {}); else if (v.webkitPresentationMode === 'picture-in-picture') v.webkitSetPresentationMode('inline'); } catch (e) {}
    try { v.pause(); v.srcObject = null; v.remove(); } catch (e) {}
    PIP = {};
  }
  /** Dígitos LED en el canvas (los mismos segmentos que el marcador grande). */
  function tmPipLed(ctx, txt, cx, y, h, color) {
    var sc = h / 104, w = 0;
    String(txt).split('').forEach(function (ch) { w += ch === ':' ? 24 : 68; });
    ctx.save(); ctx.translate(cx - (w * sc) / 2, y); ctx.transform(1, 0, -0.105, 1, 0, 0); ctx.scale(sc, sc);
    var x = 0;
    String(txt).split('').forEach(function (ch) {
      if (ch === ':') {
        ctx.fillStyle = color; ctx.shadowBlur = 0;
        [32, 70].forEach(function (cy) { ctx.beginPath(); ctx.arc(x + 12, cy, 5.5, 0, 7); ctx.fill(); });
        x += 24; return;
      }
      var on = LED_DIG[ch] || '';
      Object.keys(LED_SEG).forEach(function (k) {
        var pts = LED_SEG[k].split(' ').map(function (p) { return p.split(',').map(Number); });
        ctx.beginPath(); pts.forEach(function (p, j) { if (j) ctx.lineTo(x + p[0], p[1]); else ctx.moveTo(x + p[0], p[1]); }); ctx.closePath();
        var lit = on.indexOf(k) >= 0;
        ctx.fillStyle = lit ? color : 'rgba(255,255,255,.06)'; ctx.shadowBlur = 0; ctx.fill();
      });
      x += 68;
    });
    ctx.restore();
  }
  function tmPipDibujar(fin) {
    var ctx = PIP.ctx, R = TM.run; if (!ctx || !R) return;
    var W = 640, H = 360, p = R.pasos[Math.min(R.i, R.pasos.length - 1)];
    var t = tmTranscurrido(), seg = fin ? 0 : (p.k === 'up' || p.k === 'tap' ? Math.floor(t) : Math.max(0, Math.ceil(p.dur - t)));
    var color = !fin && p.k === 'rest' && !p.prep ? '#20f05a' : '#ff2b1c', rd = tmRonda(p);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.shadowBlur = 0; ctx.font = '700 30px system-ui, sans-serif'; ctx.textBaseline = 'top';
    ctx.fillStyle = color; ctx.textAlign = 'left';
    ctx.fillText(String(fin ? 'TERMINADO' : R.enPausa ? 'EN PAUSA' : p.tit).toUpperCase().slice(0, 26), 24, 22);
    if (rd && !fin) { ctx.fillStyle = '#20f05a'; ctx.textAlign = 'right'; ctx.fillText('R ' + rd.n + '/' + rd.de, W - 24, 22); }
    tmPipLed(ctx, tmLedTxt(seg), W / 2, 92, 190, color);
    if (p.dur && !fin) {
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(24, 318, W - 48, 10);
      ctx.fillStyle = color; ctx.fillRect(24, 318, (W - 48) * Math.min(1, t / p.dur), 10);
    }
    if (R.enPausa && !fin) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 70, W, 240); }
  }

  // =====================================================================
  //  TIMER LIBRE · desde el botón de herramientas, para cualquier ejercicio
  // =====================================================================
  var TM_TIPOS = [
    { id: 'fortime', nom: 'FOR TIME', txt: 'Cronómetro hacia arriba, con time cap opcional', g: [{ k: 'crono', etiqueta: 'FOR TIME', cap: 0 }] },
    { id: 'amrap', nom: 'AMRAP', txt: 'Cuenta atrás: tantas rondas como puedas', g: [{ k: 'cuenta', etiqueta: 'AMRAP', dur: 600 }] },
    { id: 'emom', nom: 'EMOM', txt: 'Cada minuto (o cada X), N rondas', g: [{ k: 'intervalo', etiqueta: 'EMOM', rondas: 10, cada: 60 }] },
    { id: 'tabata', nom: 'TABATA', txt: '8 rondas · 20 s trabajo / 10 s descanso', g: [{ k: 'onoff', etiqueta: 'TABATA', rondas: 8, on: 20, off: 10 }] },
    { id: 'onoff', nom: 'INTERVALOS', txt: 'Trabajo / descanso a tu medida', g: [{ k: 'onoff', etiqueta: 'ON/OFF', rondas: 5, on: 40, off: 20 }] },
    { id: 'cuenta', nom: 'CUENTA ATRÁS', txt: 'Un tiempo y listo (descansos, planchas…)', g: [{ k: 'cuenta', etiqueta: 'CUENTA ATRÁS', dur: 120 }] },
    { id: 'libre', nom: 'PERSONALIZADO', txt: 'Encadena los tramos que quieras', g: [] }
  ];
  function abrirTimerLibre() {
    abrirHoja('<div class="row"><h2>Timer libre</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">Elige el formato. Después ajustas los tiempos.</div><div class="tl-tipos">' +
      TM_TIPOS.map(function (x) { return '<button type="button" class="tl-tipo" data-tm-libre="' + x.id + '"><b>' + esc(x.nom) + '</b><span>' + esc(x.txt) + '</span></button>'; }).join('') + '</div>');
  }
  function tmLibre(id) {
    var x = TM_TIPOS.filter(function (y) { return y.id === id; })[0]; if (!x) return;
    var det = { grupos: tmCopia(x.g), repetir: 1, total: tmTotal(x.g), confianza: 'alta', notas: [] };
    var r = { libre: true, tipo: id, det: det, texto: '', etq: '', iso: (S.data && S.data.hoy) || '', n: '', titulo: 'Timer libre · ' + x.nom, version: '', metcon: false };
    var g = leer(tmClave(r)); if (g && g.grupos) r.propio = g;
    var i = TM.reg.push(r) - 1;
    r.edit = tmCopia(r.propio || det);
    tmPintarEditor(r, i);
  }

