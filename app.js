/* Road To Elite · web · misma estructura que la app de Gabi (Fabrik Program), solo para Pablo.
 * Fabrik (solo lectura) + EXTRA de APP · PLAN + registro de lo realizado + marcas + cobertura + eventos + propuestas + timer y calculadora.
 * Partes reutilizadas de pComader/programapp: utilidades, %→kg, vídeos, variantes, marcas, calculadora, instalar, timer y hojas. */
(function () {
  'use strict';

  var CFG = window.APP_CONFIG;
  firebase.initializeApp(CFG.firebase);
  var auth = firebase.auth();
  auth.languageCode = 'es';

  var LEVANTAMIENTOS = ['SNATCH', 'POWER SNATCH', 'CLEAN', 'POWER CLEAN', 'SPLIT JERK', 'BACK SQUAT', 'FRONT SQUAT', 'DEADLIFT', 'BENCH PRESS'];
  var NOMBRE_DIA = { LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles', JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo' };
  var CORTO_DIA = { LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié', JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb', DOMINGO: 'Dom' };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var SIGLAS = ['RPE', 'RIR', 'WOD', 'WODS', 'BMU', 'RMU', 'HSPU', 'SHSPU', 'C2B', 'T2B', 'DB', 'DBS', 'KB', 'ERG', 'ERGS', 'OH', 'OHS', 'DL',
    'HS', 'HSWALK', 'Z2', 'Z3', 'AMRAP', 'EMOM', 'GHD', 'PVC', 'RX', 'RM', 'BMUS', 'RMUS', 'SCL', 'INT'];

  var $app = document.getElementById('app');
  var $scrim = document.getElementById('scrim');

  var S = { user: null, email: null, data: null, dia: 0, cargando: false, ultimaCarga: 0, aviso: '', config: null };

  // ---------- utilidades ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function leer(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function fechaCorta(iso) { var p = iso.split('-'); return Number(p[2]) + ' ' + MESES[Number(p[1]) - 1]; }
  function diaMes(iso) { return Number(iso.slice(8)); }

  function rpeNum(r) { if (!r) return null; if (/z\s*2/i.test(r)) return 4; var m = String(r).match(/\d+/g); return m ? Math.max.apply(null, m.map(Number)) : null; }
  function rpeColor(r) { var n = rpeNum(r); if (n == null) return 'var(--muted)'; return n >= 8 ? 'var(--rpe-high)' : n >= 7 ? 'var(--rpe-mid)' : 'var(--rpe-low)'; }

  /** Texto en mayúsculas con saltos de línea manuales → párrafos legibles en minúscula. */
  function prosa(texto) {
    return String(texto || '').split(/\n\s*\n/).map(function (par) {
      var t = par.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join(' ').replace(/\s+/g, ' ');
      if (!t) return '';
      var bajo = t.toLowerCase().replace(/(^|[.!?:]\s+)([a-záéíóúñ])/g, function (m, a, b) { return a + b.toUpperCase(); });
      bajo = bajo.replace(/\b[\wáéíóúñ]+\b/gi, function (w) {
        var u = w.toUpperCase();
        return SIGLAS.indexOf(u) >= 0 || /\d/.test(w) ? u : w;
      });
      return '<p>' + esc(bajo) + '</p>';
    }).join('');
  }

  // ---------- vídeos ----------
  var reVideos = null, listaVideos = [];
  function prepararVideos(videos) {
    listaVideos = videos || [];
    var pats = [];
    listaVideos.forEach(function (v, i) {
      [v.nombre].concat(v.alias || []).forEach(function (n) { if (n && n.trim().length >= 3) pats.push({ p: n.trim(), i: i }); });
    });
    pats.sort(function (a, b) { return b.p.length - a.p.length; });
    var clase = { A: '[AÁ]', E: '[EÉ]', I: '[IÍ]', O: '[OÓ]', U: '[UÚÜ]', N: '[NÑ]' };
    var mapa = {};
    var alt = pats.map(function (x) {
      mapa[norm(x.p)] = x.i;
      return norm(x.p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[AEIOUN]/g, function (c) { return clase[c]; }).replace(/\s+/g, '\\s+');
    });
    reVideos = alt.length ? { re: new RegExp('(' + alt.join('|') + ')', 'gi'), mapa: mapa } : null;
  }
  function conVideos(html) {
    if (!reVideos) return html;
    return html.replace(reVideos.re, function (m) {
      var i = reVideos.mapa[norm(m).replace(/\s+/g, ' ')];
      return i == null ? m : '<button class="vid" type="button" data-v="' + i + '">' + m + '</button>';
    });
  }
  function idVideo(url) { var m = String(url).match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : ''; }

  // ---------- porcentajes → kilos ----------
  var RE_LEV = [
    [/POWER\s+SNATCH|MUSCLE\s+SNATCH|MUSTLE\s+SNATCH/, 'POWER SNATCH'],
    [/POWER\s+CLEAN/, 'POWER CLEAN'],
    [/SPLIT\s+JERK/, 'SPLIT JERK'],
    [/BACK\s+SQUAT/, 'BACK SQUAT'],
    [/FRONT\s+SQUAT/, 'FRONT SQUAT'],
    [/DEADLIFT|\bDL\b/, 'DEADLIFT'],
    [/BENCH\s+PRESS|PRESS\s+BANCA/, 'BENCH PRESS'],
    [/(?<!DB |KB |DUAL DB )SNATCH/, 'SNATCH'],
    [/(?<!DB |KB |DUAL DB )CLEAN/, 'CLEAN']
  ];
  function levantamiento(texto) {
    var n = norm(texto);
    for (var i = 0; i < RE_LEV.length; i++) if (RE_LEV[i][0].test(n)) return RE_LEV[i][1];
    return null;
  }
  // ---------- porcentajes → kilos (v17) ----------
  //  · Cada movimiento usa SU marca: no hace falta tener todos los RM rellenos.
  //  · Vale cualquier marca en kilos que el atleta haya registrado (Push Press, Overhead Squat…).
  //  · «sobre tu / respecto a / considerando tu / basándote en / de tu / se cogen del» + movimiento
  //    = el % se calcula sobre ESE movimiento (en esa línea, o en toda la parte si esa frase va en una línea sin cifras).
  var ALIAS_MOV = [
    [/\bHPC\b|HANG\s+POWER\s+CLEAN/, 'POWER CLEAN'],
    [/\bHPS\b|HANG\s+POWER\s+SNATCH/, 'POWER SNATCH'],
    [/\bOHS\b/, 'OVERHEAD SQUAT'],
    [/\bBS\b/, 'BACK SQUAT'],
    [/\bFS\b/, 'FRONT SQUAT']
  ];
  // derivados olímpicos: el % es del olímpico (snatch deadlift, clean pull, snatch balance…)
  var RE_DERIVADO = /\b(POWER\s+SNATCH|POWER\s+CLEAN|SNATCH|CLEAN)\s+(?:HIGH\s+)?(?:DEADLIFT|DL|PULL|BALANCE|SHRUG|SEGMENT)/;
  var RE_BASE = /(?:SOBRE|RESPECTO\s+(?:A|AL|DE)|CONSIDERANDO|BASANDOTE\s+EN|BASANDOSE\s+EN|BASADO\s+EN|EN\s+BASE\s+A(?:L)?|DE\s+TU|SE\s+COGEN?\s+DE(?:L)?|SE\s+CALCULAN?\s+(?:SOBRE|DE(?:L)?))\s+(.+)/;

  /** Marcas del atleta en kilos: sus 1RM + la mejor marca en kilos de cada movimiento de «Mis marcas». */
  function marcasKilos() {
    var m = {}, rm = (S.user && S.user.marcas) || {};
    Object.keys(rm).forEach(function (k) { if (rm[k] > 0) m[norm(k).replace(/\s+/g, ' ').trim()] = Number(rm[k]); });
    ((S.data && S.data.misMarcas) || []).forEach(function (x) {
      if (x.tipo !== 'Kilos') return;
      var v = parseFloat(String(x.valor).replace(',', '.')), k = norm(x.marca).replace(/\s+/g, ' ').trim();
      if (v > 0 && !(m[k] >= v)) m[k] = v;
    });
    return m;
  }
  function reNombre(nom) { return new RegExp('(?:^|[^A-Z])' + nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+') + '(?![A-Z])'); }

  /** El movimiento que aparece en un texto (o null): marcas propias (la más larga primero), derivados, abreviaturas y los básicos. */
  function movimientoEn(texto, marcas) {
    marcas = marcas || marcasKilos();
    var n = norm(texto).replace(/\s+/g, ' ');
    var propias = Object.keys(marcas).filter(function (k) { return LEVANTAMIENTOS.indexOf(k) < 0; }).sort(function (a, b) { return b.length - a.length; });
    var d = n.match(RE_DERIVADO);
    if (d) return d[1].replace(/\s+/g, ' ');
    for (var i = 0; i < propias.length; i++) if (reNombre(propias[i]).test(n)) return propias[i];
    for (var j = 0; j < ALIAS_MOV.length; j++) if (ALIAS_MOV[j][0].test(n)) return ALIAS_MOV[j][1];
    return levantamiento(n);
  }
  /** Si el texto dice «sobre tu X» (o similar), el movimiento X; si no, null. */
  function baseExplicita(texto, marcas) {
    var m = norm(texto).replace(/\s+/g, ' ').match(RE_BASE);
    return m ? movimientoEn(m[1].replace(/^(?:TU|TUS|EL|LA|SU|LOS|DE)\s+/, ''), marcas) : null;
  }
  /** Base para toda una parte: una línea con «sobre tu X» sin cifras de % (p. ej. «*% SOBRE TU POWER CLEAN»). */
  function baseDeParte(texto, marcas) {
    var lin = String(texto || '').split('\n');
    for (var i = 0; i < lin.length; i++) {
      if (/\d\s*%/.test(lin[i])) continue;
      var b = baseExplicita(lin[i], marcas);
      if (b) return b;
    }
    return null;
  }
  /** Movimiento base de una línea. Prioridad: frase en la línea › frase en la parte › movimiento de la línea › de la parte › del bloque. */
  function baseLinea(lineaTxt, ctx, marcas) {
    var mov = baseExplicita(lineaTxt, marcas) || ctx.baseParte || movimientoEn(lineaTxt, marcas) || ctx.parte || ctx.bloque || null;
    if (ctx.desdePower && mov === 'SNATCH') mov = 'POWER SNATCH';
    return mov;
  }
  function conKilos(lineaHtml, lineaTxt, ctx) {
    if (!/\d\s*%/.test(lineaTxt)) return lineaHtml;
    var marcas = ctx.marcas || marcasKilos(), mov = baseLinea(lineaTxt, ctx, marcas), rm = mov && marcas[mov];
    if (!rm) return lineaHtml;
    return lineaHtml.replace(/(\d+(?:[.,]\d+)?(?:\s*%?\s*\/\s*\d+(?:[.,]\d+)?)*)\s*%/g, function (todo, nums) {
      var vals = nums.replace(/%/g, '').split('/').map(function (x) { return parseFloat(x.replace(',', '.')); });
      if (vals.some(function (x) { return !(x > 0 && x <= 150); })) return todo;
      var kg = vals.map(function (x) { return Math.round(rm * x / 100 * 2) / 2; });
      return todo + '<span class="kg" title="' + esc(cap(mov)) + ' ' + rm + ' kg">' + kg.join('/') + ' kg</span>';
    });
  }
  function pizarra(texto, ctx) {
    var marcas = marcasKilos(), c = {};
    Object.keys(ctx || {}).forEach(function (k) { c[k] = ctx[k]; });
    c.marcas = marcas;
    c.baseParte = baseDeParte(texto, marcas) || c.baseBloque || null;
    return String(texto || '').split('\n').map(function (l) {
      return conKilos(conVideos(esc(l)), l, c);
    }).join('\n');
  }

  // ---------- servidor ----------
  function api(cuerpo, reintento) {
    var u = auth.currentUser;
    if (!u) return Promise.reject(new Error('sin_sesion'));
    return u.getIdToken(!!reintento).then(function (tok) {
      cuerpo.idToken = tok;
      return fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
    }).then(function (r) {
      return r.text().then(function (t) {
        try { return JSON.parse(t); }
        catch (e) { throw new Error('respuesta no válida del servidor (HTTP ' + r.status + '): ' + t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)); }
      });
    }).then(function (res) {
      if (!res.ok && res.error === 'sesion_caducada' && !reintento) return api(cuerpo, true);
      return res;
    });
  }

  // =====================================================================
  //  ROAD TO ELITE · carga de datos: Fabrik (solo lectura) + APP · PLAN + APP · REGISTRO + marcas
  // =====================================================================
  var DIAS7 = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  function sumarDias(iso, n) { var dt = new Date(iso + 'T12:00:00Z'); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); }
  function aIso(txt) {
    var s = String(txt || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return '';
    var y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  function aTxt(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }

  /** Ciclo de Fabrik para un lunes cualquiera (aunque esa semana aún no esté subida). */
  function cicloPara(c, lunes) {
    if (!c || !c.fases) return null;
    var out = { fases: c.fases, actual: -1, semana: null };
    c.fases.forEach(function (f, i) {
      if (f.inicio && f.fin && lunes >= f.inicio && lunes <= f.fin) { out.actual = i; out.semana = Math.floor((Date.parse(lunes) - Date.parse(f.inicio)) / 864e5 / 7) + 1; }
    });
    return out;
  }

  /** Marcas de la hoja → formato de la app de Gabi ({marca, tipo, valor, fecha}) + 1RM por levantamiento. */
  var UNIDAD_TIPO = { kg: 'Kilos', 'min:seg': 'Tiempo', reps: 'Reps', cal: 'Calorías', m: 'Distancia', km: 'Distancia', w: 'Kilos' };
  var TIPO_UNIDAD = { Kilos: 'kg', Tiempo: 'min:seg', Reps: 'reps', 'Calorías': 'cal', Distancia: 'm' };
  function prepararMarcas(filas) {
    S.misMarcas = (filas || []).filter(function (r) { return r.MOVIMIENTO && r.VALOR; }).map(function (r) {
      var u = String(r.UNIDAD || 'kg').toLowerCase();
      return { marca: String(r.MOVIMIENTO).toUpperCase().trim(), tipo: UNIDAD_TIPO[u] || (r.TIPO === 'Tiempo' ? 'Tiempo' : 'Kilos'), valor: String(r.VALOR),
        fecha: aIso(r.FECHA) || '', notas: r.NOTAS || '', fuente: r.FUENTE || '', fila: r._fila, raw: { FECHA: r.FECHA, MOVIMIENTO: r.MOVIMIENTO, VALOR: r.VALOR } };
    }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    var rm = {};
    S.misMarcas.forEach(function (x) {
      if (x.tipo !== 'Kilos' || LEVANTAMIENTOS.indexOf(x.marca) < 0) return;
      var v = parseFloat(String(x.valor).replace(',', '.'));
      if (v > 0 && !(rm[x.marca] >= v)) rm[x.marca] = v;
    });
    S.user.marcas = rm;
    if (S.data) S.data.misMarcas = S.misMarcas;
  }

  /**
   * Une Fabrik, el plan y lo registrado en la estructura de días que pinta la app (lunes → domingo).
   * APP · PLAN manda: una fila ORIGEN=FABRIK con FABRIK_REF «LUNES» coloca ese día entero y «LUNES·2» solo el bloque 2
   * (fecha, turno y orden de la fila), y además aporta su «por qué», ciencia e interferencias. Sin fila, cada día de Fabrik va a su fecha.
   * Estados: SUSTITUIDO no se pinta · NO HACER se pinta tachado · PROPUESTA / PROPUESTA · NO HACER se ven como propuesta.
   */
  function refFabrik(r) { var m = norm(r.FABRIK_REF || r['FABRIK_DÍA'] || '').replace(/\s+/g, ' ').trim().match(/^([A-Z]+)(?:\s*[·.:\- ]\s*(\d+))?$/); return m ? { dia: m[1], n: m[2] ? Number(m[2]) : null } : null; }
  function infoPlan(b, r) {
    if (!r) return b;
    b.porque = r['POR QUÉ (cursiva)'] || b.porque || ''; b.ciencia = r['CIENCIA (técnica · fisiología · biología)'] || b.ciencia || '';
    b.interf = r.INTERFERENCIAS || b.interf || ''; b.estado = r.ESTADO || ''; b.cambio = r.CAMBIO_ID || ''; b.filaPlan = r._fila;
    if (r.ID) b.idPlan = r.ID;
    return b;
  }
  function construirDatos(sem) {
    var fab = sem.fabrik, porNombre = {}, plan = (sem.plan || []).filter(function (r) { return norm(r.ESTADO) !== 'SUSTITUIDO'; });
    if (fab) { fab.dias.forEach(function (fd) { porNombre[fd.nombre] = fd; }); S.ciclo = fab.ciclo; guardar('rte-ciclo', fab.ciclo); }
    var dias = DIAS7.map(function (nom, i) { return { nombre: nom, iso: sumarDias(sem.lunes, i), foco: [], bloques: [], rpe: null, notasDia: [] }; });
    var porIso = {}; dias.forEach(function (x) { porIso[x.iso] = x; });
    var refDia = {}, refBloque = {};
    plan.forEach(function (r) {
      if (norm(r.ORIGEN) !== 'FABRIK') return;
      var f = refFabrik(r); if (!f) return;
      if (f.n == null) refDia[f.dia] = r; else refBloque[f.dia + '·' + f.n] = r;
    });
    function datosDia(dia, fd, nota) {
      if (dia.fabrik && dia.fabrik !== fd.nombre) return;
      dia.fabrik = fd.nombre; dia.foco = fd.foco || []; dia.rpe = dia.rpe || fd.rpe; dia.notasDia = fd.notasDia || [];
      dia.variantesNombres = fd.variantesNombres; dia.variantesExtra = fd.variantesExtra;
      if (nota) dia.notaPlan = nota;
    }
    if (fab) fab.dias.forEach(function (fd) {
      var rd = refDia[fd.nombre], destino = rd ? porIso[aIso(rd.FECHA)] : porIso[fd.iso];
      fd.bloques.forEach(function (b, k) {
        var rb = refBloque[fd.nombre + '·' + b.n], d2 = rb ? porIso[aIso(rb.FECHA)] : destino;
        if (!d2) return;
        var r = rb || rd;
        b.turno = r && norm(r.TURNO) === 'AM' ? 'AM' : 'PM';
        b.orden = rb && rb.ORDEN !== '' ? Number(rb.ORDEN) : (rd && rd.ORDEN !== '' ? Number(rd.ORDEN) + k / 100 : 50 + k / 100);
        b.fabrikDia = fd.nombre;
        infoPlan(b, r);
        if (rd && !rb) { b.porque = b.porque || ''; }
        d2.bloques.push(b);
        datosDia(d2, fd, rd && !rb ? rd.CONTENIDO : '');
      });
    });
    plan.forEach(function (r, k) {
      if (norm(r.ORIGEN) === 'FABRIK') return;
      var dd = porIso[aIso(r.FECHA)];
      if (!dd) return;
      dd.bloques.push(infoPlan({ n: 'E' + (k + 1), titulo: r['TÍTULO'] || r.BLOQUE || 'EXTRA', partes: [{ etiqueta: '', tipo: 'main', texto: r.CONTENIDO || '' }],
        extra: true, origen: r.ORIGEN || 'EXTRA', turno: norm(r.TURNO) === 'AM' ? 'AM' : 'PM', orden: Number(r.ORDEN) || 0, intensidad: r.INTENSIDAD || '', min: r.MIN || '',
        codigos: r['CÓDIGOS'] || '', id: r.ID || ('X-' + r._fila) }, r));
    });
    dias.forEach(function (dd) {
      dd.bloques.sort(function (a, b) { return (a.turno === 'AM' ? 0 : 1) - (b.turno === 'AM' ? 0 : 1) || a.orden - b.orden; });
      var activos = dd.bloques.filter(function (b) { return !/^PROPUESTA$/.test(norm(b.estado)); });
      dd.doble = activos.some(function (b) { return b.turno === 'AM'; }) && activos.some(function (b) { return b.turno === 'PM'; });
      dd.eventos = (sem.eventos || []).filter(function (e) { var i = aIso(e.INICIO), f = aIso(e.FIN) || i; return i && dd.iso >= i && dd.iso <= f; });
    });
    var propuestas = {};
    (sem.plan || []).forEach(function (r) { if (/^PROPUESTA/.test(norm(r.ESTADO)) && r.CAMBIO_ID) (propuestas[r.CAMBIO_ID] = propuestas[r.CAMBIO_ID] || []).push(r); });
    return { semana: sem.lunes, hoy: sem.hoy, ciclo: fab ? fab.ciclo : cicloPara(S.ciclo || leer('rte-ciclo'), sem.lunes), dias: dias,
      erratas: sem.erratasFabrik || [], registro: sem.registro || [], plan: sem.plan || [], borrador: plan.some(function (r) { return norm(r.ESTADO) === 'BORRADOR'; }),
      misMarcas: S.misMarcas || [], hayFabrik: !!fab, eventos: sem.eventos || [], conf: sem.conf, confSiguiente: sem.confSiguiente,
      pendientes: sem.pendientes || [], cambios: sem.cambios || [], propuestas: propuestas };
  }
  /** Aplica la respuesta del servidor (acciones que devuelven la semana) sin perder el día abierto. */
  function aplicarSemana(sem) { if (!sem) return; var dia = S.dia; S.data = construirDatos(sem); S.dia = dia; guardar('rte-cache', { config: S.config, semana: sem, marcas: S.marcasFilas || null }); }

  function cargar(semana) {
    S.cargando = true;
    var primera = !S.config;
    return api({ action: primera ? 'inicio' : 'semana', semana: semana || null }).then(function (res) {
      S.cargando = false;
      if (!res.ok) {
        if (res.error === 'no_autorizado' || res.error === 'sesion_caducada' || res.error === 'sin_sesion') { auth.signOut(); return; }
        S.aviso = 'No se pudo cargar (' + (res.detalle || res.error) + ').';
        return render();
      }
      if (res.config) S.config = res.config;
      var antes = S.data && S.data.semana;
      S.data = construirDatos(res.semana); S.ultimaCarga = Date.now(); S.aviso = '';
      prepararVideos(S.videos);
      if (antes !== S.data.semana || !semana) S.dia = diaInicial();
      guardar('rte-cache', { config: S.config, semana: res.semana, marcas: S.marcasFilas || null });
      render();
      if (!S.marcasFilas) api({ action: 'marcas' }).then(function (r) { if (r.ok) { S.marcasFilas = r.marcas; prepararMarcas(r.marcas); render(); } });
      if (!S.videos || !S.videos.length) api({ action: 'videos' }).then(function (r) { if (r.ok) { S.videos = r.videos; guardar('rte-videos', r.videos); prepararVideos(S.videos); render(); } });
    }).catch(function (e) {
      S.cargando = false;
      var det = e && e.message ? e.message : String(e);
      if (!navigator.onLine) det = 'el dispositivo no tiene internet';
      else if (/Failed to fetch|NetworkError|Load failed/i.test(det)) det = 'el servidor no respondió o bloqueó la petición';
      S.aviso = (S.data ? 'No se pudo actualizar: ' : 'No se pudo cargar: ') + det;
      render();
    });
  }

  function diaInicial() {
    var d = S.data, i = d.dias.findIndex(function (x) { return x.iso === d.hoy; });
    if (i >= 0) return i;
    return d.hoy < (d.dias[0] && d.dias[0].iso) ? 0 : Math.max(0, d.dias.length - 1);
  }

  // ---------- acceso: solo Google y solo tu cuenta ----------
  function pantallaLogin(msg) {
    $app.innerHTML = '<section class="login"><div class="logo-e">E</div><div class="brand">Road To Elite</div>' +
      '<p>Fabrik + extras + carrera.</p>' +
      '<button class="btn btn-primary" id="gbtn" type="button">Entrar con Google</button>' +
      (msg ? '<div class="err" role="status">' + esc(msg) + '</div>' : '') + '</section>';
    document.getElementById('gbtn').onclick = function () {
      var p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account', login_hint: CFG.emailPermitido });
      auth.signInWithPopup(p).catch(function (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(p);
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') pantallaLogin('No se pudo entrar con Google (' + e.code + ').');
      });
    };
  }

  // ---------- vista principal ----------
  function render() {
    var d = S.data;
    var abiertos = [].map.call(document.querySelectorAll('#app details'), function (x) { return x.open; });
    var claveP = (S.vista || 'semana') + '|' + (d && d.semana) + '|' + S.dia;
    var mismoDia = S._pintado === claveP && !S._abrir;
    S._pintado = claveP;
    setTimeout(function () {
      if (!mismoDia) return;
      [].forEach.call(document.querySelectorAll('#app details'), function (x, i) { if (abiertos[i]) x.open = true; });
    }, 0);
    if (!d) {
      var fallo = S.aviso && !S.cargando;
      $app.innerHTML = '<div class="splash"><div class="logo-e">E</div><div class="' + (fallo ? 'err' : 'hint') + '">' + esc(S.aviso || 'Cargando la semana…') + '</div>' +
        (fallo ? '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn-ghost" id="reint" type="button">Reintentar</button><button class="btn-ghost" id="salir2" type="button">Cerrar sesión</button></div>' : '') + '</div>';
      if (fallo) {
        document.getElementById('reint').onclick = function () { S.aviso = ''; render(); cargar(); };
        document.getElementById('salir2').onclick = function () { auth.signOut(); };
      }
      return;
    }
    if (S.vista === 'ajustes') return renderAjustes();
    if (S.vista === 'cobertura') return renderCobertura();
    if (S.vista === 'calendario') return renderCalendario();
    if (S.vista === 'propuesta') return renderPropuesta();
    TM.reg = [];
    var aviso = avisosArriba(d);
    $app.innerHTML = cabecera(d) + bannerInstalar() + aviso + ciclo(d) + semana(d) + '<main class="day" id="day">' + dia(d, d.dias[S.dia]) + '</main>' +
      (S.aviso ? '<div class="stale">' + esc(S.aviso) + '</div>' : '');
    enlazarCabecera();
  }

  function cabecera(d) {
    var lbl = 'Semana ' + fechaCorta(d.dias[0].iso) + ' – ' + fechaCorta(d.dias[6].iso);
    return '<header class="top"><div class="weeknav">' +
      '<button class="icon-btn" id="prev" type="button" aria-label="Semana anterior">‹</button>' +
      '<span class="lbl">' + esc(lbl) + '</span>' +
      '<button class="icon-btn" id="next" type="button" aria-label="Semana siguiente">›</button>' +
      '</div>' + botonCalc() + '<button class="who" id="perfil" type="button" aria-label="Menú">P</button></header>';
  }

  function enlazarCabecera() {
    var d = S.data;
    document.getElementById('prev').onclick = function () { S.aviso = 'Cargando…'; render(); cargar(sumarDias(d.semana, -7)); };
    document.getElementById('next').onclick = function () { S.aviso = 'Cargando…'; render(); cargar(sumarDias(d.semana, 7)); };
    document.getElementById('perfil').onclick = function () { abrirAjustes(); };
  }

  function ciclo(d) {
    var c = d.ciclo;
    if (!c || !c.fases || !c.fases.length) return '';
    var fases = c.fases.map(function (f, i) {
      var celdas = '';
      for (var k = 1; k <= f.semanas; k++) {
        var cls = i < c.actual ? 'done' : i === c.actual ? (k < c.semana ? 'done' : k === c.semana ? 'now' : '') : '';
        celdas += '<i class="' + cls + '"></i>';
      }
      return '<button type="button" class="phase' + (i === c.actual ? ' cur' : '') + '" data-fase="' + i + '" aria-label="' + esc(f.nombre) + ': objetivos"><div class="bar">' + celdas + '</div><span>' + esc(f.nombre) + '</span></button>';
    }).join('');
    var fa = c.fases[c.actual];
    var linea = fa ? '<div class="cycle-line"><b>' + esc(cap(fa.nombre)) + '</b> · semana ' + c.semana + ' de ' + fa.semanas + '</div>' :
      '<div class="cycle-line">Fuera del ciclo de Fabrik cargado</div>';
    return '<section class="cycle" aria-label="Ciclo">' + '<div class="phases">' + fases + '</div>' + linea + '<div class="hint ph-hint">Toca una fase para ver sus objetivos.</div></section>';
  }
  function cap(s) { s = String(s || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }

  function semana(d) {
    return '<nav class="week" aria-label="Días">' + d.dias.map(function (x, i) {
      var vacio = !x.bloques.length;
      return '<button class="day-btn' + (vacio ? ' rest' : '') + '" type="button" data-dia="' + i + '" aria-pressed="' + (i === S.dia) + '" style="--c:' + rpeColor(x.rpe) + '">' +
        '<span class="d">' + CORTO_DIA[x.nombre] + '</span><span class="n">' + diaMes(x.iso) + '</span>' +
        (x.rpe ? '<span class="r">' + esc(x.rpe) + '</span>' : x.bloques.some(function (b) { return b.extra; }) && !x.fabrik ? '<span class="r ex">EX</span>' : '<span class="r" style="visibility:hidden">–</span>') +
        '<span class="dot' + (x.iso === d.hoy ? '' : ' off') + (x.doble ? ' doble' : '') + '"></span>' + ((x.eventos || []).length ? '<span class="evdot" title="Evento"></span>' : '') + '</button>';
    }).join('') + '</nav>';
  }

  // ---------- cuenta atrás a los tests (APP · CONFIG) ----------
  function htmlCuentaAtras(d) {
    var c = S.config || {}, out = '';
    [['test_2km', 'Test 2 km'], ['test_10km', 'Test 10 km']].forEach(function (t) {
      var ini = aIso(String(c[t[0]] || '').split(/[–-]\s*\d/)[0]);
      if (!ini || ini < d.hoy) return;
      var n = Math.round((Date.parse(ini) - Date.parse(d.hoy)) / 864e5);
      if (n > 35) return;
      out += '<div class="countdown"><div class="cd-txt"><span class="lbl">Test · semana del ' + fechaCorta(ini) + '</span><b>' + esc(t[1]) + '</b></div>' +
        '<span class="cd">' + (n > 1 ? 'faltan ' + n + ' días' : n === 1 ? 'mañana' : 'esta semana') + '</span></div>';
    });
    return out;
  }

  function dia(d, x) {
    var html = '<div class="day-title"><h1>' + NOMBRE_DIA[x.nombre] + ' ' + diaMes(x.iso) + '</h1>' +
      (x.rpe ? '<div class="rpe-pill" style="--c:' + rpeColor(x.rpe) + '"><b>' + esc(x.rpe) + '</b><span>' + (x.rpe === 'Z2' ? 'Recovery' : 'RPE del día') + '</span></div>' :
        x.doble ? '<div class="rpe-pill" style="--c:var(--accent)"><b>×2</b><span>Sesión doble</span></div>' : '') + '</div>';
    if (x.foco && x.foco.length) html += '<div class="focus">' + x.foco.map(function (f) { return '<span>' + esc(cap(f)) + '</span>'; }).join('') + '</div>';
    if (S.dia === diaInicial()) html += htmlCuentaAtras(d);
    html += (x.eventos || []).map(function (e) {
      return '<button class="notice" type="button" data-evento="' + esc(e.ID) + '"><span class="lbl">' + esc(e.TIPO || 'Evento') + (e.HORA ? ' · ' + esc(e.HORA) : '') + ' · ' + esc(e.BLOQUEA || '') + '</span><b>' + esc(e.EVENTO) + '</b>' +
        (e['CÓMO PROCEDER'] ? '<span class="txt">' + esc(e['CÓMO PROCEDER']) + '</span>' : '<span class="txt">Sin decidir cómo proceder</span>') + '</button>';
    }).join('');
    if (x.iso >= d.hoy && x.iso <= sumarDias(d.hoy, 7)) html += '<button class="surge" type="button" data-surge="' + x.iso + '">⚡ Ha surgido algo · reestructurar</button>';
    if (x.notaPlan) html += '<div class="variant-note"><span class="v-tag">Plan</span><span>' + esc(x.notaPlan) + '</span></div>';
    if (x.variantesNombres && x.variantesNombres.length) html += '<div class="variant-note">' + x.variantesNombres.map(function (n) {
      return '<span class="v-tag">' + esc(nombreVersion(n)) + '</span>'; }).join('') + '<span>Si compites, abre los desplegables naranjas de cada bloque: ahí está lo que cambia.</span></div>';
    if (!x.bloques.length) html += '<div class="empty">' + (x.iso === d.hoy ? 'Hoy' : 'Este día') + ' no hay nada programado. Descanso.</div>';
    var turno = null;
    html += '<div class="blocks">' + x.bloques.map(function (b) {
      var sep = '';
      if (x.doble && b.turno !== turno) { turno = b.turno; sep = '<div class="turno">' + (turno === 'AM' ? '☀️ Mañana' : '🌙 Tarde') + '</div>'; }
      return sep + bloque(b, x, d);
    }).join('') + (x.variantesExtra || []).map(bloqueExtra).join('') + '</div>';
    if (x.notasDia && x.notasDia.length) html += '<details class="daynotes"><summary class="coach-sum">Más notas del coach</summary><div class="exp-body prose">' +
      x.notasDia.map(function (n) { return (n.titulo ? '<div class="part-lbl coach-t">' + esc(n.titulo) + '</div>' : '') + prosa(n.texto); }).join('') + '</div></details>';
    return html;
  }

  function esMetcon(b) {
    return /METCON|\bWOD\b/.test(norm(b.titulo)) || b.partes.some(function (p) { return /^\s*METCON\s*:/.test(norm(p.texto)); });
  }

  function claseIntensidad(t) {
    t = String(t || ''); var n = norm(t);
    if (t.indexOf('🟢') >= 0 || /VERDE|TECNIC/.test(n)) return 'var(--z-tec)';
    if (t.indexOf('🔵') >= 0 || /AZUL/.test(n)) return 'var(--z-low)';
    if (t.indexOf('🟠') >= 0 || /NARANJA/.test(n)) return 'var(--rpe-mid)';
    if (t.indexOf('🔴') >= 0 || /ROJO/.test(n)) return 'var(--rpe-high)';
    return rpeColor(t);
  }

  function bloque(b, x, d) {
    var todo = b.partes.map(function (p) { return p.etiqueta + '\n' + p.texto; }).join('\n');
    var mk = marcasKilos();
    var ctxB = { bloque: movimientoEn(b.titulo, mk), desdePower: /DEL POWER SNATCH/.test(norm(todo)), baseBloque: baseDeParte(todo, mk) };
    function parte(p) {
      var ctx = { bloque: ctxB.bloque, desdePower: ctxB.desdePower, baseBloque: ctxB.baseBloque, parte: movimientoEn(p.texto, mk) || movimientoEn(p.etiqueta, mk) };
      var etq = p.tipo === 'adapt' ? '' : p.etiqueta;
      var tm = tmBoton(p, b, x);
      return '<div class="part' + (tm ? ' has-tm' : '') + '">' + tm + (etq ? '<div class="part-lbl">' + esc(etq) + '</div>' : '') +
        (p.texto ? '<div class="board' + (p.tipo !== 'main' ? ' small' : '') + '">' + pizarra(p.texto, ctx) + '</div>' : '') + '</div>';
    }
    var prep = b.partes.filter(function (p) { return p.tipo === 'prep'; });
    var main = b.partes.filter(function (p) { return p.tipo === 'main'; });
    var adapt = b.partes.filter(function (p) { return p.tipo === 'adapt'; });
    var notas = '';
    if (b.wod) {
      var campos = [['material', 'Material'], ['carga', 'Carga'], ['intensidad', 'Intensidad'], ['formato', 'Formato'], ['modalidad', 'Modalidad'], ['notas', 'Estrategia'], ['objetivo', 'Objetivo']];
      notas += '<dl class="meta">' + campos.filter(function (c) { return b.wod[c[0]]; }).map(function (c) {
        return '<dt class="coach-t">' + c[1] + '</dt><dd class="prose">' + prosa(b.wod[c[0]]) + '</dd>';
      }).join('') + '</dl>';
    }
    if (b.nota) notas += '<div class="prose">' + prosa(b.nota) + '</div>';

    var cab = b.extra ?
      '<div class="b-head"><span class="b-num ex">+</span><span class="b-title">' + esc(b.titulo) + '</span>' +
        (b.intensidad ? '<span class="b-rpe" style="--c:' + claseIntensidad(b.intensidad) + '">' + esc(b.intensidad.replace(/[🟢🔵🟠🔴]\s*/gu, '') || '●') + '</span>' : '') + '</div>' +
        '<div class="b-tags"><span class="tag ex">EXTRA</span>' + (b.min ? '<span class="tag">⏱ ' + esc(b.min) + '′</span>' : '') +
        (b.codigos ? '<span class="tag">' + esc(b.codigos) + '</span>' : '') + (norm(b.estado) === 'BORRADOR' ? '<span class="tag draft">Borrador</span>' : '') + '</div>' :
      '<div class="b-head"><span class="b-num">' + (b.n || '•') + '</span><span class="b-title">' + esc(b.titulo) + '</span>' +
        (b.rpe ? '<span class="b-rpe" style="--c:' + rpeColor(b.rpe) + '">RPE ' + esc(b.rpe) + '</span>' : '') + '</div>';

    var est = norm(b.estado), tagEst = est === 'NO HACER' ? '<div class="b-state no">No hacer · pasa a pendientes</div>' :
      est === 'PROPUESTA' ? '<div class="b-state prop">Propuesta de cambio · pendiente de tu aprobación</div>' :
      est === 'PROPUESTA · NO HACER' ? '<div class="b-state prop">Propuesta: no hacer este bloque</div>' : '';
    var sci = (b.porque || b.ciencia || b.interf) ? '<details class="sci"><summary>Por qué aquí · ciencia · interferencias</summary><div class="exp-body">' +
      (b.porque ? '<div class="part-lbl">Por qué va aquí</div><p class="why-t">' + esc(b.porque) + '</p>' : '') +
      (b.ciencia ? '<div class="part-lbl">Explicación técnica, fisiológica y biológica</div><div class="prose-n">' + esc(b.ciencia) + '</div>' : '') +
      (b.interf ? '<div class="part-lbl">Posibles interferencias</div><div class="prose-n">' + esc(b.interf) + '</div>' : '') + '</div></details>' : '';
    return '<article class="block' + (b.extra ? ' extra' : '') + (est === 'NO HACER' ? ' off' : '') + (/^PROPUESTA/.test(est) ? ' prop' : '') + '" id="b-' + esc(b.n) + '">' + cab + tagEst +
      (prep.length ? '<details><summary>Calentamiento y activación</summary><div class="exp-body">' + prep.map(parte).join('') + '</div></details>' : '') +
      main.map(parte).join('') + sci +
      (adapt.length ? '<details><summary>Adaptaciones</summary><div class="exp-body">' + adapt.map(parte).join('') + '</div></details>' : '') +
      (notas ? '<details><summary class="coach-sum">Notas del coach</summary><div class="exp-body">' + notas + '</div></details>' : '') +
      (b.variantes || []).map(function (v) { return htmlVariante(v, parte); }).join('') +
      filaRegistro(d, x, b) +
      '</article>';
  }

  // ---------- registro de lo realizado (APP · REGISTRO) ----------
  function idPlanDe(x, b) { return b.extra ? b.id : (b.idPlan || 'F-' + (b.fabrikDia || x.nombre) + '-' + b.n); }
  function registroDe(iso, idPlan) {
    var f = aTxt(iso);
    return (S.data.registro || []).filter(function (r) { return (r.FECHA === f || aIso(r.FECHA) === iso) && r.ID_PLAN === idPlan; })[0] || null;
  }
  function filaRegistro(d, x, b) {
    var r = registroDe(x.iso, idPlanDe(x, b));
    var est = r ? (r.HECHO === 'Sí' ? '<span class="reg-st ok">✔ Hecho</span>' : r.HECHO === 'Parcial' ? '<span class="reg-st part">◐ Parcial</span>' : '<span class="reg-st no">✕ No hecho</span>') +
      (r.RPE ? '<span class="vb-v" style="--c:' + rpeColor(String(r.RPE)) + '">RPE ' + esc(r.RPE) + '</span>' : '') : '<span class="hint">Sin registrar</span>';
    var dato = esc(JSON.stringify({ iso: x.iso, id: idPlanDe(x, b), bloque: (b.extra ? 'EXTRA · ' : b.n + ': ') + b.titulo }));
    var off = /NO HACER|PROPUESTA/.test(norm(b.estado));
    var nh = esc(JSON.stringify({ id: idPlanDe(x, b), fecha: x.iso, titulo: b.titulo, turno: b.turno, orden: b.orden, ref: b.extra ? '' : (b.fabrikDia || x.nombre) + '·' + b.n }));
    return '<div class="reg-row">' + est + '<span class="grow"></span>' + (off ? '' : '<button type="button" class="btn-ghost sm" data-nohacer="' + nh + '">No hacer</button>') +
      '<button type="button" class="btn-ghost sm" data-reg="' + dato + '">' + (r ? 'Editar' : 'Registrar') + '</button></div>';
  }
  function abrirRegistro(ref) {
    var r = registroDe(ref.iso, ref.id) || {};
    var hecho = r.HECHO || 'Sí', rpe = String(r.RPE || '');
    var chipsH = '<div class="seg" role="group" aria-label="¿Hecho?" id="rg-hecho">' + ['Sí', 'Parcial', 'No'].map(function (h) {
      return '<button type="button" data-rh="' + h + '" aria-pressed="' + (h === hecho) + '">' + h + '</button>'; }).join('') + '</div>';
    var chipsR = '<div class="chips" role="group" aria-label="RPE del 1 al 10" id="rg-rpe">';
    for (var i = 1; i <= 10; i++) chipsR += '<button type="button" class="rpe-chip' + (String(i) === rpe ? ' on' : '') + '" style="--c:' + rpeColor(String(i)) + '" data-rr="' + i + '">' + i + '</button>';
    chipsR += '</div>';
    abrirHoja('<div class="row"><h2>Registrar</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">' + esc(ref.bloque) + ' · ' + fechaCorta(ref.iso) + '</div>' +
      '<form id="regf" class="avf">' + chipsH + '<label>RPE · 1 muy fácil · 10 máximo</label>' + chipsR +
      '<div class="two"><div><label for="rg-min">Minutos reales</label><input id="rg-min" inputmode="numeric" value="' + esc(r.MIN_REAL || '') + '"></div>' +
      '<div><label for="rg-sue">Sueño (h o 1–5)</label><input id="rg-sue" value="' + esc(r['SUEÑO'] || '') + '"></div></div>' +
      '<label for="rg-dat">Parciales / vatios / tiempos / resultado</label><textarea id="rg-dat" rows="2" placeholder="Ej. 1:52 · 1:54 · 1:55 · 1050-980 W · 12:10">' + esc(r['DATOS (parciales/vatios)'] || '') + '</textarea>' +
      '<label for="rg-car">Cargas usadas</label><input id="rg-car" value="' + esc(r.CARGAS || '') + '">' +
      '<label for="rg-mol">Molestias</label><input id="rg-mol" value="' + esc(r.MOLESTIAS || '') + '">' +
      '<label for="rg-not">Notas</label><textarea id="rg-not" rows="2">' + esc(r.NOTAS || '') + '</textarea>' +
      '<div class="two-btn">' + (r.FECHA ? '<button class="btn" type="button" id="rg-del">Borrar</button>' : '') +
      '<button class="btn btn-primary" type="submit" id="rg-ok">Guardar</button></div></form>');
    $scrim.querySelectorAll('[data-rh]').forEach(function (bt) { bt.onclick = function () { $scrim.querySelectorAll('[data-rh]').forEach(function (y) { y.setAttribute('aria-pressed', String(y === bt)); }); }; });
    $scrim.querySelectorAll('[data-rr]').forEach(function (bt) { bt.onclick = function () { var ya = bt.classList.contains('on'); $scrim.querySelectorAll('[data-rr]').forEach(function (y) { y.classList.remove('on'); }); if (!ya) bt.classList.add('on'); }; });
    var del = document.getElementById('rg-del');
    if (del) del.onclick = function () {
      if (!confirmar(del, '¿Borrar? Toca otra vez')) return;
      del.disabled = true;
      api({ action: 'registro_borrar', registro: { FECHA: r.FECHA, ID_PLAN: r.ID_PLAN, BLOQUE: r.BLOQUE } }).then(ok).then(function () {
        S.data.registro = S.data.registro.filter(function (y) { return y !== r; }); cerrarHoja(); render(); toast('Registro borrado');
      }).catch(falloApi(del));
    };
    document.getElementById('regf').onsubmit = function (ev) {
      ev.preventDefault();
      var h = $scrim.querySelector('[data-rh][aria-pressed="true"]'), rr = $scrim.querySelector('[data-rr].on');
      var reg = { FECHA: aTxt(ref.iso), ID_PLAN: ref.id, BLOQUE: ref.bloque, HECHO: h ? h.dataset.rh : 'Sí', RPE: rr ? rr.dataset.rr : '', MIN_REAL: val('rg-min'),
        'DATOS (parciales/vatios)': val('rg-dat'), CARGAS: val('rg-car'), 'SUEÑO': val('rg-sue'), MOLESTIAS: val('rg-mol'), NOTAS: val('rg-not') };
      var b = document.getElementById('rg-ok'); b.disabled = true; b.textContent = 'Guardando…';
      api({ action: 'registrar', registro: reg }).then(ok).then(function (res) {
        S.data.registro = S.data.registro.filter(function (y) { return !(y.FECHA === reg.FECHA && y.ID_PLAN === reg.ID_PLAN); }).concat([res.registro]);
        cerrarHoja(); render(); toast('Guardado');
      }).catch(falloApi(b));
    };
  }

  // =====================================================================
  //  PLANIFICACIÓN: borrador, confirmar la semana, propuestas de cambio, ha surgido algo, no hacer
  // =====================================================================
  function avisosArriba(d) {
    var h = '';
    Object.keys(d.propuestas || {}).forEach(function (cid) {
      var c = (d.cambios || []).filter(function (x) { return x.ID === cid; })[0];
      h += '<button class="prop-banner" type="button" data-ver-prop="' + esc(cid) + '"><b>Propuesta de cambios lista</b><span>' + esc(c ? c.EVENTO : '') + ' · ' + d.propuestas[cid].length + ' cambios · toca para revisar y aprobar</span></button>';
    });
    (d.cambios || []).filter(function (c) { return c.ESTADO === 'Solicitada'; }).forEach(function (c) {
      h += '<div class="unpub">Reestructuración solicitada: ' + esc(c.EVENTO) + ' · pídeme «reestructura» en el chat</div>';
    });
    if (d.borrador) h += '<div class="draft-banner"><span>Plan de la semana en borrador</span><button class="btn btn-primary sm" type="button" data-aprobar-plan>Aprobar plan</button></div>';
    var sig = sumarDias(d.semana, 7), cs = d.confSiguiente;
    if (d.semana <= d.hoy && (!cs || /^Pendiente/.test(cs.ESTADO || ''))) h += '<button class="conf-banner" type="button" data-confirmar="' + sig + '"><b>Confirma la semana del ' + fechaCorta(sig) + '</b><span>Mañanas para doble, descansos y eventos. Sin esto no se programa.</span></button>';
    if (d.conf && /^Pendiente/.test(d.conf.ESTADO || '')) h += '<button class="conf-banner" type="button" data-confirmar="' + d.semana + '"><b>Esta semana está sin confirmar</b><span>Confírmala para poder programarla.</span></button>';
    var np = (d.pendientes || []).filter(function (p) { return p.ESTADO === 'Pendiente'; }).length;
    if (np) h += '<button class="pend-banner" type="button" data-ver-pend>' + np + ' pendiente' + (np > 1 ? 's' : '') + ' para reincorporar · se te propondrán al programar la semana</button>';
    return h;
  }

  var DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  function chipsDias(id, sel) {
    return '<div class="dchips" id="' + id + '">' + DIAS_CORTOS.map(function (x) { return '<button type="button" data-dch="' + x + '" aria-pressed="' + (sel.indexOf(x) >= 0) + '">' + x + '</button>'; }).join('') + '</div>';
  }
  function leerChips(id) { return [].map.call(document.querySelectorAll('#' + id + ' [aria-pressed="true"]'), function (b) { return b.dataset.dch; }).join(', '); }

  /** Confirmar una semana: mañanas libres para doble, descanso y decisión sobre cada evento. */
  function abrirConfirmar(lunes) {
    var fin = sumarDias(lunes, 6), d = S.data;
    var cs = lunes === d.semana ? d.conf : lunes === sumarDias(d.semana, 7) ? d.confSiguiente : null;
    api({ action: 'eventos' }).then(ok).then(function (r) {
      var evs = r.eventos.filter(function (e) { var i = aIso(e.INICIO), f = aIso(e.FIN) || i; return i && f >= lunes && i <= fin; });
      S._evsConf = evs;
      abrirHoja('<div class="row"><h2>Semana del ' + fechaCorta(lunes) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
        '<form id="conff" class="avf"><label>Mañanas libres para sesión doble</label>' + chipsDias('cf-dob', String(cs && cs['DOBLES (mañanas libres)'] || '')) +
        '<label>Días sin entrenar (descanso)</label>' + chipsDias('cf-des', String(cs && cs.DESCANSO || '')) +
        '<div class="part-lbl" style="margin-top:10px">Eventos de la semana</div>' +
        (evs.length ? evs.map(function (e, i) {
          return '<div class="evc"><div class="evc-top"><b>' + esc(e.EVENTO) + '</b><span class="hint">' + esc(e.INICIO) + (e.HORA ? ' ' + esc(e.HORA) : '') + '</span></div>' +
            '<div class="two"><div><label>Bloquea</label><select data-cf="' + i + '" data-k="BLOQUEA">' + ['Día completo', 'Mañana', 'Tarde', 'Parcial', 'No bloquea'].map(function (o) { return '<option' + (o === e.BLOQUEA ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>' +
            '<div><label>Días antes bajando volumen</label><select data-cf="' + i + '" data-k="ANTES (días bajar volumen)">' + ['0', '1', '2', '3'].map(function (o) { return '<option' + (o === String(e['ANTES (días bajar volumen)'] || '0') ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div></div>' +
            '<div class="two"><div><label>Días después de recuperación</label><select data-cf="' + i + '" data-k="DESPUÉS (días recuperación)">' + ['0', '1', '2', '3'].map(function (o) { return '<option' + (o === String(e['DESPUÉS (días recuperación)'] || '0') ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div><div></div></div>' +
            '<label>Cómo proceder</label><input data-cf="' + i + '" data-k="CÓMO PROCEDER" value="' + esc(e['CÓMO PROCEDER'] || '') + '" placeholder="Ej. Mover el WOD al sábado AM; ese día solo movilidad">' + '</div>';
        }).join('') : '<div class="hint">No hay eventos esa semana. Si hay alguno, añádelo en el calendario.</div>') +
        '<button class="btn" type="button" data-nuevo-evento="' + lunes + '">＋ Añadir evento</button>' +
        '<label for="cf-not">Notas para la planificación</label><textarea id="cf-not" rows="2">' + esc(cs && cs.NOTAS || '') + '</textarea>' +
        '<button class="btn btn-primary" type="submit" id="cf-ok">Confirmar semana</button>' +
        '<div class="hint">Al confirmar, cada evento queda «Decidido». Hasta que la semana esté confirmada no se programa.</div></form>');
      document.getElementById('conff').onsubmit = function (ev) {
        ev.preventDefault();
        var b = document.getElementById('cf-ok'); b.disabled = true; b.textContent = 'Guardando…';
        var cambios = evs.map(function (e, i) {
          var o = { ID: e.ID, EVENTO: e.EVENTO, INICIO: e.INICIO, FIN: e.FIN, ESTADO: 'Decidido' };
          $scrim.querySelectorAll('[data-cf="' + i + '"]').forEach(function (inp) { o[inp.dataset.k] = inp.value.trim(); });
          return o;
        });
        var dec = cambios.map(function (o) { return o.EVENTO + ': ' + (o['CÓMO PROCEDER'] || o.BLOQUEA); }).join(' | ');
        cambios.reduce(function (p, o) { return p.then(function () { return api({ action: 'evento', evento: o }).then(ok); }); }, Promise.resolve())
          .then(function () { return api({ action: 'semana_conf', lunes: lunes, ver: d.semana, dobles: leerChips('cf-dob'), descanso: leerChips('cf-des'), decisiones: dec, notas: val('cf-not'), confirmar: true }); })
          .then(ok).then(function (res) { aplicarSemana(res.semana); cerrarHoja(); render(); toast('Semana confirmada'); })
          .catch(falloApi(b));
      };
    }).catch(function (e) { toast(mensajeError(e.message)); });
  }

  /** «Ha surgido algo»: crea el evento y la solicitud de reestructuración desde ese momento. */
  function abrirSurge(iso) {
    var d = S.data, ahora = new Date(), turno = ahora.getHours() < 14 ? 'AM' : 'PM';
    abrirHoja('<div class="row"><h2>Ha surgido algo</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">Se reestructura desde el momento que indiques hasta el domingo. Fabrik no se mueve salvo que tú lo digas. Nada cambia hasta que apruebes la propuesta.</div>' +
      '<form id="surf" class="avf"><label for="su-e">¿Qué ha surgido?</label><input id="su-e" required maxlength="200" placeholder="Ej. Compromiso de trabajo">' +
      '<div class="two"><div><label for="su-f">Día del evento</label><input id="su-f" type="date" value="' + iso + '"></div><div><label for="su-h">Hora (opcional)</label><input id="su-h" type="time"></div></div>' +
      '<label>Qué bloquea</label><select id="su-b"><option>Tarde</option><option>Mañana</option><option>Día completo</option><option>Parcial</option></select>' +
      '<div class="two"><div><label for="su-d">Reestructurar desde</label><input id="su-d" type="date" value="' + (d.hoy > d.semana ? d.hoy : d.semana) + '"></div>' +
      '<div><label for="su-t">Turno</label><select id="su-t"><option' + (turno === 'AM' ? ' selected' : '') + '>AM</option><option' + (turno === 'PM' ? ' selected' : '') + '>PM</option></select></div></div>' +
      '<label for="su-a">¿Puedo mover algún bloque de Fabrik?</label><select id="su-a"><option>No, Fabrik no se mueve</option><option>Sí, si hace falta</option></select>' +
      '<label for="su-n">Notas (opcional)</label><textarea id="su-n" rows="2" placeholder="Ej. llego cansado el viernes; prefiero no hacer sesión doble"></textarea>' +
      '<button class="btn btn-primary" type="submit" id="su-ok">Enviar solicitud</button></form>');
    document.getElementById('surf').onsubmit = function (ev) {
      ev.preventDefault();
      var b = document.getElementById('su-ok'); b.disabled = true; b.textContent = 'Enviando…';
      api({ action: 'cambio', ver: d.semana, evento: val('su-e'), fechaEvento: val('su-f'), hora: val('su-h'), bloquea: val('su-b'), desde: val('su-d'), turno: val('su-t'),
        afecta: val('su-b') + ' del ' + val('su-f') + ' · Fabrik: ' + val('su-a'), notas: val('su-n') })
        .then(ok).then(function (res) { aplicarSemana(res.semana); cerrarHoja(); render(); toast('Solicitud guardada. Pídeme «reestructura» en el chat.'); })
        .catch(falloApi(b));
    };
  }

  /** Revisión de una propuesta de cambios: lo nuevo, lo que se quita y lo que pasa a pendientes. */
  function renderPropuesta() {
    var d = S.data, cid = S.propuesta, filas = (d.propuestas || {})[cid] || [], c = (d.cambios || []).filter(function (x) { return x.ID === cid; })[0];
    var porId = {}; (d.plan || []).forEach(function (r) { porId[r.ID] = r; });
    var html = cabeceraVista('Propuesta', 'Semana') + '<section class="me" style="display:block"><b>' + esc(c ? c.EVENTO : 'Cambios') + '</b><div class="hint">' + esc(c ? (c.AFECTA || '') + (c.RESPUESTA ? ' · ' + c.RESPUESTA : '') : '') + '</div></section>';
    html += filas.sort(function (a, b) { return aIso(a.FECHA) < aIso(b.FECHA) ? -1 : 1; }).map(function (r) {
      var quita = String(r.REEMPLAZA || '').split(/[,;\s]+/).filter(Boolean).map(function (id) { return porId[id]; }).filter(Boolean);
      var esNo = /NO HACER/.test(norm(r.ESTADO));
      return '<article class="block' + (esNo ? ' off' : ' prop') + '"><div class="b-head"><span class="b-num ex">' + (esNo ? '–' : '+') + '</span><span class="b-title">' + esc(r['TÍTULO'] || r.BLOQUE) + '</span></div>' +
        '<div class="b-tags"><span class="tag">' + esc(r['DÍA'] || '') + ' ' + esc(r.FECHA) + ' · ' + esc(r.TURNO) + '</span><span class="tag ex">' + esc(esNo ? 'No hacer → pendientes' : 'Nuevo / movido') + '</span></div>' +
        (r.CONTENIDO && !esNo ? '<div class="board small">' + esc(r.CONTENIDO) + '</div>' : '') +
        (quita.length ? '<div class="hint">Sustituye a: ' + quita.map(function (q) { return esc((q['TÍTULO'] || q.BLOQUE) + ' (' + q.FECHA + ' ' + q.TURNO + ')'); }).join(' · ') + '</div>' : '') +
        (r['POR QUÉ (cursiva)'] ? '<p class="why-t">' + esc(r['POR QUÉ (cursiva)']) + '</p>' : '') + '</article>';
    }).join('');
    html += '<div class="two-btn"><button class="btn" type="button" data-prop-res="0">Rechazar</button><button class="btn btn-primary" type="button" data-prop-res="1">Aprobar cambios</button></div>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = volverSemana;
  }

  function abrirNoHacer(o) {
    abrirHoja('<div class="row"><h2>No hacer</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">' + esc(o.titulo) + ' · ' + fechaCorta(o.fecha) + '. Pasa a <b>pendientes</b> y se te propondrá reincorporarlo al programar la semana siguiente.</div>' +
      '<form id="nhf" class="avf"><label for="nh-m">Motivo</label><input id="nh-m" maxlength="300" placeholder="Ej. fatiga lumbar, viaje, falta de tiempo">' +
      '<button class="btn btn-primary" type="submit" id="nh-ok">Marcar como no hacer</button></form>');
    document.getElementById('nhf').onsubmit = function (ev) {
      ev.preventDefault();
      var b = document.getElementById('nh-ok'); b.disabled = true;
      api(Object.assign({ action: 'no_hacer', ver: S.data.semana, motivo: val('nh-m') }, o)).then(ok)
        .then(function (res) { aplicarSemana(res.semana); cerrarHoja(); render(); toast('Marcado. Lo tienes en pendientes.'); }).catch(falloApi(b));
    };
  }

  // ---------- versiones especiales (p. ej. pestaña "26/10/2026 BADAJOZ") ----------
  function nombreVersion(n) { return String(n || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function htmlVariante(v, parte) {
    var tag = '<span class="v-tag">' + esc(nombreVersion(v.nombre)) + '</span>';
    if (v.tipo === 'quita') return '<div class="variant none">' + tag + '<span>No se hace este bloque</span></div>';
    var cuerpo = '';
    if (v.tipo === 'sustituye') {
      cuerpo = '<div class="v-title">' + esc(v.titulo) + '</div>' + v.partes.map(parte).join('');
    } else {
      if (v.titulo) cuerpo += '<div class="v-title">' + esc(v.titulo) + '</div>';
      cuerpo += v.partes.map(function (p) {
        return '<div class="v-part">' + (p.cambio === 'nueva' ? '<span class="v-mark">Nuevo</span>' : '') + parte(p) + '</div>';
      }).join('');
      if (v.quitadas && v.quitadas.length) cuerpo += '<p class="v-off">No se hace: ' + v.quitadas.map(esc).join(' · ') + '</p>';
    }
    var resumen = v.tipo === 'sustituye' ? 'En su lugar: ' + esc(v.titulo) : 'Cambios para ' + esc(nombreVersion(v.nombre));
    return '<details class="variant">' + '<summary>' + tag + '<span class="v-sum">' + resumen + '</span></summary><div class="exp-body">' + cuerpo + '</div></details>';
  }
  function bloqueExtra(e) {
    var b = e.bloque;
    function parte(p) {
      return '<div class="part">' + (p.etiqueta && p.tipo !== 'adapt' ? '<div class="part-lbl">' + esc(p.etiqueta) + '</div>' : '') +
        (p.texto ? '<div class="board small">' + pizarra(p.texto, { bloque: levantamiento(b.titulo) }) + '</div>' : '') + '</div>';
    }
    return '<details class="variant extra"><summary><span class="v-tag">' + esc(nombreVersion(e.nombre)) + '</span><span class="v-sum">Bloque extra: ' +
      esc(b.titulo) + '</span></summary><div class="exp-body">' + b.partes.map(parte).join('') + '</div></details>';
  }

  // ---------- aviso breve en pantalla ----------
  var tToast = null;
  function toast(t) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = t; el.classList.add('show');
    clearTimeout(tToast); tToast = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  // =====================================================================
  //  MENÚ · marcas, cobertura, descuentos, webs, vídeos, apariencia, instalar
  // =====================================================================
  var TEMAS = { oscuro: 'Oscuro', claro: 'Claro', auto: 'Automático' };
  function aplicarTema(t) {
    var r = document.documentElement;
    if (t === 'claro') r.setAttribute('data-theme', 'light');
    else if (t === 'oscuro') r.setAttribute('data-theme', 'dark');
    else r.removeAttribute('data-theme');
  }
  aplicarTema(leer('rte-tema') || 'oscuro');

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.instalar = e; });

  function abrirAjustes(abrir) { cerrarHoja(); S.vista = 'ajustes'; S._abrir = abrir || null; render(); window.scrollTo({ top: 0 }); }
  function volverSemana() { S.vista = null; render(); window.scrollTo({ top: 0 }); }

  function cabeceraVista(titulo, atras) {
    return '<header class="top"><button class="btn-ghost" type="button" id="atras">‹ ' + esc(atras) + '</button>' +
      '<span class="view-title">' + esc(titulo) + '</span>' + botonCalc() + '</header>';
  }
  function seccion(id, titulo, cuerpo, extra, ico) {
    return '<details class="set" id="' + id + '"><summary>' + (ico ? '<span class="set-ico">' + ico + '</span>' : '') + esc(titulo) +
      (extra ? ' <span class="badge">' + esc(extra) + '</span>' : '') + '</summary><div class="set-body">' + cuerpo + '</div></details>';
  }

  function renderAjustes() {
    var d = S.data || {}, tema = leer('rte-tema') || 'oscuro';
    var hechos = (d.registro || []).length;
    var html = cabeceraVista('Menú', 'Semana') +
      '<section class="me"><div class="who big">P</div><div><b>Pablo</b><div class="hint">' + esc(S.email || '') + '</div></div></section>';
    html += '<button class="set-link" type="button" id="ir-cobertura"><span class="set-ico">%</span>Cobertura y carrera<span class="go">›</span></button>';
    html += '<button class="set-link" type="button" id="ir-calendario"><span class="set-ico">▦</span>Calendario de eventos<span class="go">›</span></button>';
    var pend = (d.pendientes || []);
    html += seccion('s-pend', 'Pendientes', htmlPendientes(pend), pend.length ? String(pend.length) : '', '↺');
    html += seccion('s-marcas', 'Mis marcas', htmlMarcas(d), '', '◆');
    html += seccion('s-semana', 'Esta semana', htmlResumenSemana(d), hechos ? hechos + ' registrados' : '', '✓');
    html += seccion('s-desc', '% Descuentos', '<div id="desc-body"><div class="hint">Cargando…</div></div>', '', '%');
    html += seccion('s-webs', 'Mis webs', '<div id="webs-body"><div class="hint">Cargando…</div></div>', '', '↗');
    html += seccion('s-videos', 'Vídeos de ejercicios', '<input id="vid-q" class="inp" placeholder="Buscar ejercicio…" autocomplete="off"><div id="vid-body" class="pr-list"></div>', String((S.videos || []).length), '▶');
    html += seccion('s-tema', 'Apariencia', '<div class="seg" role="group" aria-label="Tema">' + Object.keys(TEMAS).map(function (k) {
      return '<button type="button" data-tema="' + k + '" aria-pressed="' + (tema === k) + '">' + TEMAS[k] + '</button>'; }).join('') + '</div>' +
      '<div class="hint">Automático sigue el modo claro u oscuro de tu móvil u ordenador.</div>', '', '◐');
    html += seccion('s-instalar', 'Instalar la app', htmlInstalar(), '', '↓');
    if ((d.erratas || []).length) html += seccion('s-err', 'Avisos de Fabrik', '<ul class="hint">' + d.erratas.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>', String(d.erratas.length), '!');
    html += '<button class="btn" type="button" id="logout">Cerrar sesión</button><div class="hint" style="text-align:center">Road To Elite · ' + esc(WEB_VERSION) + '</div>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = volverSemana;
    document.getElementById('logout').onclick = function () { S.vista = null; auth.signOut(); };
    document.getElementById('ir-cobertura').onclick = function () { S.vista = 'cobertura'; render(); window.scrollTo({ top: 0 }); };
    document.getElementById('ir-calendario').onclick = function () { abrirCalendario(); };
    document.getElementById('s-desc').addEventListener('toggle', function () { if (this.open) cargarDescuentos(); });
    document.getElementById('s-webs').addEventListener('toggle', function () { if (this.open) cargarWebs(); });
    var q = document.getElementById('vid-q'); q.oninput = function () { pintarVideos(q.value); }; pintarVideos('');
    enlazarMarcas();
    var ab = S._abrir; S._abrir = null;
    if (ab && document.getElementById(ab)) { document.getElementById(ab).open = true; if (ab === 's-desc') cargarDescuentos(); if (ab === 's-webs') cargarWebs(); }
  }

  /** Resumen rápido de lo registrado en la semana que se está viendo. */
  function htmlResumenSemana(d) {
    var reg = d.registro || [];
    if (!reg.length) return '<div class="hint">Aún no has registrado nada esta semana. Usa «Registrar» al final de cada bloque.</div>';
    var rpes = reg.map(function (r) { return Number(r.RPE); }).filter(function (n) { return n > 0; });
    var media = rpes.length ? (rpes.reduce(function (a, b) { return a + b; }, 0) / rpes.length).toFixed(1).replace('.', ',') : '—';
    return '<div class="pr-row"><span>Bloques registrados</span><b>' + reg.length + '</b></div>' +
      '<div class="pr-row"><span>RPE medio</span><b>' + media + '</b></div>' +
      reg.slice().sort(function (a, b) { return aIso(a.FECHA) < aIso(b.FECHA) ? -1 : 1; }).map(function (r) {
        return '<div class="pr-row"><span>' + fechaCorta(aIso(r.FECHA)) + '</span><b>' + esc(r.BLOQUE) + '</b><span class="hint">' + esc(r.HECHO) + (r.RPE ? ' · RPE ' + esc(r.RPE) : '') + '</span></div>';
      }).join('');
  }

  // ---------- Mis marcas (APP · MARCAS) ----------
  function sparkline(lista) {
    var vals = lista.slice().reverse().map(valorNum).filter(function (v) { return isFinite(v); });
    if (vals.length < 2) return '';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), w = 90, h = 26;
    var pts = vals.map(function (v, i) { return (i * (w - 4) / (vals.length - 1) + 2).toFixed(1) + ',' + (max === min ? h / 2 : (h - 3 - (v - min) * (h - 6) / (max - min))).toFixed(1); });
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="' + pts.join(' ') + '"/></svg>';
  }
  function htmlMarcas(d) {
    var m = (S.user && S.user.marcas) || {};
    var grupos = agruparMarcas(S.misMarcas || []);
    var nombres = Object.keys(grupos).sort();
    return '<div class="part-lbl">Repeticiones máximas (1RM, kg)</div><div class="hint">Con tus 1RM, los porcentajes de Fabrik se convierten en kilos. Al guardar un 1RM nuevo queda en tu historial.</div>' +
      '<form id="marcasf"><div class="marks">' + LEVANTAMIENTOS.map(function (l) {
        var id = 'rm-' + l.replace(/\s/g, '');
        return '<label for="' + id + '">' + cap(l) + '<input id="' + id + '" data-lev="' + l + '" type="number" inputmode="decimal" min="0" step="0.5" value="' + (m[l] || '') + '" placeholder="kg"></label>';
      }).join('') + '</div><button class="btn btn-primary" type="submit" id="gm">Guardar 1RM</button></form>' +
      '<div class="part-lbl" style="margin-top:8px">Historial</div>' +
      (nombres.length ? '<div class="pr-list">' + nombres.map(function (n) {
        var g = grupos[n];
        return '<details class="pr"><summary><b>' + esc(cap(n)) + '</b>' + sparkline(g.lista) + '<span class="pr-best">' + esc(fmtMarca(g.mejor)) + '</span></summary>' +
          '<div class="pr-hist">' + g.lista.map(function (x) {
            return '<div class="pr-row"><span>' + (x.fecha ? fechaCorta(x.fecha) : '—') + '</span><b>' + esc(fmtMarca(x)) + '</b>' + (x.notas ? '<span class="hint">' + esc(x.notas) + '</span>' : '') +
              '<button type="button" class="x" data-borrar-marca="' + esc(JSON.stringify({ fila: x.fila, c: x.raw })) + '" aria-label="Borrar">×</button></div>';
          }).join('') + '</div></details>';
      }).join('') + '</div>' : '<div class="hint">Cargando marcas…</div>') +
      '<form id="prf" class="prf"><datalist id="pr-nombres">' + nombresCatalogo(nombres).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<label for="pr-n">Nueva marca</label><input id="pr-n" list="pr-nombres" maxlength="60" placeholder="Ej. FRAN, 2 K RUN, HYROX, MAX HSPU" required>' +
      '<div class="three"><div><label for="pr-t">Tipo</label><select id="pr-t"><option>Kilos</option><option>Tiempo</option><option>Reps</option><option>Calorías</option><option>Distancia</option></select></div>' +
      '<div><label for="pr-v">Valor</label><input id="pr-v" required inputmode="decimal" placeholder="kg · ej. 102.5"></div>' +
      '<div><label for="pr-f">Fecha</label><input id="pr-f" type="date" value="' + (d.hoy || '') + '" max="' + (d.hoy || '') + '"></div></div>' +
      '<div id="pr-tw" hidden><label for="pr-tt-m">Tiempo</label>' + campoTiempo('pr-tt', '') + '</div>' +
      '<input id="pr-nt" maxlength="200" placeholder="Nota (opcional)">' +
      '<button class="btn" type="submit" id="pr-ok">Añadir marca</button></form>';
  }
  function guardarMarcaApi(m) {
    return api({ action: 'marca', marca: m }).then(ok).then(function (r) { S.marcasFilas = r.marcas; prepararMarcas(r.marcas); return r; });
  }
  function enlazarMarcas() {
    var f = document.getElementById('marcasf');
    if (f) f.onsubmit = function (ev) {
      ev.preventDefault();
      var actuales = (S.user && S.user.marcas) || {}, cambios = [];
      f.querySelectorAll('input[data-lev]').forEach(function (inp) {
        var n = parseFloat(String(inp.value).replace(',', '.'));
        if (n > 0 && n !== actuales[inp.dataset.lev]) cambios.push({ MOVIMIENTO: inp.dataset.lev, TIPO: '1RM', VALOR: String(n), UNIDAD: 'kg', FECHA: aTxt(S.data.hoy), NOTAS: 'Puesto en la app' });
      });
      if (!cambios.length) { toast('No hay cambios.'); return; }
      var btn = document.getElementById('gm'); btn.disabled = true; btn.textContent = 'Guardando…';
      cambios.reduce(function (p, m) { return p.then(function () { return guardarMarcaApi(m); }); }, Promise.resolve())
        .then(function () { toast('1RM guardados'); S._abrir = 's-marcas'; render(); })
        .catch(function (e) { btn.disabled = false; btn.textContent = 'Guardar 1RM'; toast(mensajeError(e.message)); });
    };
    var t = document.getElementById('pr-t'), v = document.getElementById('pr-v');
    if (t) t.onchange = function () {
      var esT = t.value === 'Tiempo';
      v.placeholder = esT ? '' : PH_MARCA[t.value]; v.required = !esT; v.parentNode.hidden = esT;
      document.getElementById('pr-tw').hidden = !esT;
    };
    enlazarTiempo('pr-tt');
    var pn = document.getElementById('pr-n');
    if (pn) pn.onchange = function () { var tp = CATALOGO[norm(pn.value).trim()]; if (tp && t) { t.value = tp; t.onchange(); } };
    var pf = document.getElementById('prf');
    if (pf) pf.onsubmit = function (ev) {
      ev.preventDefault();
      var valor = val('pr-v');
      if (t.value === 'Tiempo') { valor = leerTiempo('pr-tt'); if (!valor) { toast(valor === null ? 'Revisa el tiempo: los segundos van de 0 a 59.' : 'Pon el tiempo (minutos y segundos).'); return; } }
      var b = document.getElementById('pr-ok'); b.disabled = true; b.textContent = 'Guardando…';
      guardarMarcaApi({ MOVIMIENTO: val('pr-n').toUpperCase(), TIPO: t.value, VALOR: valor, UNIDAD: TIPO_UNIDAD[t.value], FECHA: aTxt(val('pr-f') || S.data.hoy), NOTAS: val('pr-nt') })
        .then(function () { toast('Marca añadida'); S._abrir = 's-marcas'; render(); })
        .catch(function (e) { b.disabled = false; b.textContent = 'Añadir marca'; toast(mensajeError(e.message)); });
    };
  }

  // ---------- Cobertura en tarjetas (Dashboard, Semana, Mes y carrera del Sheet) ----------
  function pctNum(t) { var m = String(t || '').match(/(\d+(?:[.,]\d+)?)\s*%/); return m ? Math.min(100, parseFloat(m[1].replace(',', '.'))) : null; }
  function anillo(pct, lbl, sub) {
    var p = pct == null ? 0 : pct, r = 30, c = 2 * Math.PI * r;
    return '<div class="ring"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="' + r + '" class="ring-bg"/><circle cx="36" cy="36" r="' + r + '" class="ring-fg' + (p >= 100 ? ' full' : '') +
      '" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><b>' + (pct == null ? '—' : Math.round(p) + '%') + '</b><span>' + esc(lbl) + '</span>' + (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>';
  }
  function progresoMeta(m) {
    var inc = parseFloat(String(m.incluido).replace(',', '.')) || 0, n = String(m.meta).match(/(\d+(?:[.,]\d+)?)/), meta = n ? parseFloat(n[1].replace(',', '.')) : 1;
    if (/^>/.test(String(m.meta).trim())) meta = meta + 0.0001;
    return Math.max(0, Math.min(100, meta ? inc / meta * 100 : 0));
  }
  function tarjetasMetas(lista) {
    if (!lista.length) return '<div class="hint">Sin metas.</div>';
    var grupos = {}, orden = [];
    lista.forEach(function (m) { var k = m.prioridad || 'Otras'; if (!grupos[k]) { grupos[k] = []; orden.push(k); } grupos[k].push(m); });
    return orden.map(function (k) {
      return '<div class="part-lbl">' + esc(k) + '</div>' + grupos[k].map(function (m) {
        var p = progresoMeta(m);
        return '<details class="meta-c"><summary><div class="meta-t"><b>' + esc(m.estimulo) + '</b><span class="meta-n' + (p >= 100 ? ' ok' : '') + '">' + esc(m.incluido || '0') + ' / ' + esc(m.meta) + '</span></div>' +
          '<div class="pbar"><i class="' + (p >= 100 ? 'full' : '') + '" style="width:' + p + '%"></i></div></summary>' +
          (m.nota ? '<div class="exp-body hint">' + esc(m.nota) + '</div>' : '') + '</details>';
      }).join('');
    }).join('');
  }
  function renderCobertura() {
    var html = cabeceraVista('Cobertura', 'Menú');
    var C = S.cobertura;
    if (!C) {
      $app.innerHTML = html + '<div class="hint">Leyendo tu Sheet…</div>';
      document.getElementById('atras').onclick = function () { abrirAjustes(); };
      api({ action: 'cobertura' }).then(ok).then(function (r) { S.cobertura = r.cobertura; if (S.vista === 'cobertura') render(); }).catch(function (e) { toast(mensajeError(e.message)); });
      return;
    }
    var tab = S.cobTab || 'semana';
    html += '<div class="rings">' + anillo(pctNum(C.semana.pct), 'Semana', C.semana.resumen) + anillo(pctNum(C.mes.pct), 'Mes', C.mes.resumen) + '</div>';
    html += '<div class="seg" role="group" aria-label="Vista">' + [['semana', 'Semana'], ['mes', 'Mes'], ['carrera', 'Carrera']].map(function (t) {
      return '<button type="button" data-cob="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'carrera') {
      var hoy = S.data.hoy, sems = C.carrera.semanas || [];
      html += (C.carrera.intro || []).slice(1, 3).map(function (t) { return '<div class="hint">' + esc(t) + '</div>'; }).join('');
      html += sems.map(function (w, i) {
        return '<details class="set"' + (i < 2 ? ' open' : '') + '><summary>' + esc(w.titulo.split('·').slice(0, 2).join('·')) + '</summary><div class="set-body">' +
          '<div class="hint">' + esc(w.titulo.split('·').slice(2).join('·')) + '</div>' +
          w.sesiones.map(function (x) {
            return '<div class="run-c"><div class="run-h"><b>' + esc(x.sesion) + '</b><span class="tag">' + esc(String(x.zona || '').split('·')[0]) + '</span></div>' +
              '<div class="run-t">' + esc(x.trabajo) + '</div>' + (x.ritmo ? '<div class="hint">🎯 ' + esc(x.ritmo) + '</div>' : '') +
              (x.datos ? '<div class="hint">📝 ' + esc(x.datos) + '</div>' : '') + '</div>';
          }).join('') + '</div></details>';
      }).join('');
    } else {
      var B = C[tab];
      html += '<div class="hint">' + (tab === 'semana' ? esc(B.desde) + ' – ' + esc(B.hasta) : 'Mes de ' + esc(B.periodo)) + '</div>';
      if ((B.porCubrir || []).length) html += '<section class="por-cubrir"><div class="part-lbl">Por cubrir</div>' + B.porCubrir.map(function (t) { return '<div class="pc-i">' + esc(t) + '</div>'; }).join('') + '</section>';
      html += tarjetasMetas(B.metas || []);
    }
    html += '<button class="btn" type="button" id="cob-re">Actualizar</button>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = function () { abrirAjustes(); };
    document.getElementById('cob-re').onclick = function () { S.cobertura = null; render(); };
    $app.querySelectorAll('[data-cob]').forEach(function (b) { b.onclick = function () { S.cobTab = b.dataset.cob; render(); }; });
  }

  // ---------- Calendario de eventos (APP · EVENTOS) ----------
  var MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function abrirCalendario() {
    S.vista = 'calendario'; S.calDia = null; render(); window.scrollTo({ top: 0 });
    api({ action: 'eventos' }).then(ok).then(function (r) { S.eventos = r.eventos; if (S.vista === 'calendario') render(); }).catch(function () {});
  }
  function tarjetaEv(e) {
    var i = aIso(e.INICIO), f = aIso(e.FIN) || i;
    return '<div class="evc"><div class="evc-top"><span class="ev-tipo">' + esc(e.TIPO || 'Evento') + '</span><b>' + esc(e.EVENTO) + '</b></div>' +
      '<div class="hint">' + fechaCorta(i) + (f !== i ? ' – ' + fechaCorta(f) : '') + (e.HORA ? ' · ' + esc(e.HORA) : '') + (e.LUGAR ? ' · ' + esc(e.LUGAR) : '') + ' · ' + esc(e.BLOQUEA || '') + '</div>' +
      (e['CÓMO PROCEDER'] ? '<p class="ev-desc">' + esc(e['CÓMO PROCEDER']) + '</p>' : '<p class="ev-desc err">Sin decidir cómo proceder</p>') +
      ((+e['ANTES (días bajar volumen)'] || +e['DESPUÉS (días recuperación)']) ? '<div class="hint">' + (+e['ANTES (días bajar volumen)'] ? e['ANTES (días bajar volumen)'] + ' día(s) antes bajando volumen · ' : '') +
        (+e['DESPUÉS (días recuperación)'] ? e['DESPUÉS (días recuperación)'] + ' día(s) de recuperación después' : '') + '</div>' : '') +
      '<div class="evc-acc"><button class="btn-ghost sm" type="button" data-evento="' + esc(e.ID) + '">Editar</button></div></div>';
  }
  function renderCalendario() {
    var d = S.data, hoy = d.hoy, mes = S.calMes || hoy.slice(0, 7), y = +mes.slice(0, 4), m = +mes.slice(5, 7);
    var evs = (S.eventos || d.eventos || []).map(function (e) { e._i = aIso(e.INICIO); e._f = aIso(e.FIN) || e._i; return e; }).filter(function (e) { return e._i; });
    var primero = new Date(Date.UTC(y, m - 1, 1)), dow = (primero.getUTCDay() + 6) % 7, ndias = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var celdas = '';
    for (var k = 0; k < dow; k++) celdas += '<span class="cal-d vacio"></span>';
    for (var dd = 1; dd <= ndias; dd++) {
      var iso = mes + '-' + (dd < 10 ? '0' : '') + dd, ese = evs.filter(function (e) { return iso >= e._i && iso <= e._f; });
      celdas += '<button type="button" class="cal-d' + (iso === hoy ? ' hoy' : '') + (iso === S.calDia ? ' sel' : '') + (ese.length ? ' mio' : '') + '" data-cal-dia="' + iso + '"><b>' + dd + '</b>' +
        (ese.length ? '<i>' + ese.slice(0, 3).map(function () { return '<em class="m"></em>'; }).join('') + '</i>' : '') + '</button>';
    }
    var lista = S.calDia ? evs.filter(function (e) { return S.calDia >= e._i && S.calDia <= e._f; }) : evs.filter(function (e) { return e._f >= mes + '-01' && e._i <= mes + '-31'; });
    var html = cabeceraVista('Calendario', 'Menú') +
      '<section class="cal"><div class="cal-nav"><button class="icon-btn" type="button" data-cal-mes="-1" aria-label="Mes anterior">‹</button><b>' + cap(MESES_L[m - 1]) + ' ' + y + '</b>' +
      '<button class="icon-btn" type="button" data-cal-mes="1" aria-label="Mes siguiente">›</button></div>' +
      '<div class="cal-sem">' + ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
      '<div class="cal-grid">' + celdas + '</div></section>' +
      '<button class="btn btn-primary" type="button" data-nuevo-evento="' + (S.calDia || hoy) + '">＋ Nuevo evento</button>' +
      '<div class="part-lbl">' + (S.calDia ? 'Eventos del ' + fechaCorta(S.calDia) + ' <button type="button" class="btn-ghost sm" data-cal-dia="">Ver el mes</button>' : 'Eventos de ' + MESES_L[m - 1]) + '</div>' +
      '<div class="ev-list">' + (lista.length ? lista.map(tarjetaEv).join('') : '<div class="hint">No hay eventos.</div>') + '</div>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = function () { abrirAjustes(); };
  }
  /** Formulario de evento (nuevo o editar). Lo usan el calendario, el día y la confirmación de semana. */
  function abrirFormEvento(e, isoDef) {
    e = e || {};
    var i = aIso(e.INICIO) || isoDef || S.data.hoy, f = aIso(e.FIN) || i, sel = function (v, l) { return l.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join(''); };
    abrirHoja('<div class="row"><h2>' + (e.ID ? 'Editar evento' : 'Nuevo evento') + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<form id="evf" class="avf"><label for="ev-n">Evento</label><input id="ev-n" required maxlength="120" value="' + esc(e.EVENTO || '') + '" placeholder="Ej. HYROX Madrid, boda, viaje de trabajo">' +
      '<div class="two"><div><label for="ev-t">Tipo</label><select id="ev-t">' + sel(e.TIPO || 'Otro', ['Competición', 'HYROX', 'Carrera', 'Viaje', 'Trabajo', 'Personal', 'Otro']) + '</select></div>' +
      '<div><label for="ev-h">Hora</label><input id="ev-h" type="time" value="' + esc(e.HORA || '') + '"></div></div>' +
      '<div class="two"><div><label for="ev-i">Inicio</label><input id="ev-i" type="date" required value="' + i + '"></div><div><label for="ev-f">Fin</label><input id="ev-f" type="date" value="' + f + '"></div></div>' +
      '<label for="ev-l">Lugar</label><input id="ev-l" maxlength="120" value="' + esc(e.LUGAR || '') + '">' +
      '<label for="ev-b">Qué bloquea del entreno</label><select id="ev-b">' + sel(e.BLOQUEA || 'Día completo', ['Día completo', 'Mañana', 'Tarde', 'Parcial', 'No bloquea']) + '</select>' +
      '<div class="two"><div><label for="ev-a">Días antes bajando volumen</label><select id="ev-a">' + sel(String(e['ANTES (días bajar volumen)'] || '0'), ['0', '1', '2', '3']) + '</select></div>' +
      '<div><label for="ev-p">Días de recuperación después</label><select id="ev-p">' + sel(String(e['DESPUÉS (días recuperación)'] || '0'), ['0', '1', '2', '3']) + '</select></div></div>' +
      '<label for="ev-c">Cómo proceder (si lo dejas vacío, te lo preguntaré antes de programar)</label><textarea id="ev-c" rows="2">' + esc(e['CÓMO PROCEDER'] || '') + '</textarea>' +
      '<label for="ev-o">Notas</label><input id="ev-o" maxlength="300" value="' + esc(e.NOTAS || '') + '">' +
      '<div class="two-btn">' + (e.ID ? '<button class="btn" type="button" id="ev-del">Borrar</button>' : '') + '<button class="btn btn-primary" type="submit" id="ev-ok">Guardar</button></div></form>');
    var del = document.getElementById('ev-del');
    if (del) del.onclick = function () {
      if (!confirmar(del, '¿Borrar? Toca otra vez')) return;
      api({ action: 'evento_borrar', id: e.ID }).then(ok).then(function (r) { S.eventos = r.eventos; cerrarHoja(); cargar(S.data.semana); toast('Evento borrado'); if (S.vista === 'calendario') render(); }).catch(falloApi(del));
    };
    document.getElementById('evf').onsubmit = function (ev) {
      ev.preventDefault();
      var b = document.getElementById('ev-ok'); b.disabled = true;
      var o = { ID: e.ID || '', EVENTO: val('ev-n'), TIPO: val('ev-t'), HORA: val('ev-h'), INICIO: aTxt(val('ev-i')), FIN: aTxt(val('ev-f') || val('ev-i')), LUGAR: val('ev-l'), BLOQUEA: val('ev-b'),
        'ANTES (días bajar volumen)': val('ev-a'), 'DESPUÉS (días recuperación)': val('ev-p'), 'CÓMO PROCEDER': val('ev-c'), NOTAS: val('ev-o'),
        ESTADO: val('ev-c') || val('ev-b') === 'No bloquea' ? 'Decidido' : 'Por decidir' };
      api({ action: 'evento', evento: o }).then(ok).then(function (r) { S.eventos = r.eventos; cerrarHoja(); toast('Evento guardado'); cargar(S.data.semana); if (S.vista === 'calendario') render(); }).catch(falloApi(b));
    };
  }

  // ---------- Pendientes (APP · PENDIENTES) ----------
  function htmlPendientes(lista) {
    if (!lista.length) return '<div class="hint">No hay nada pendiente.</div>';
    return '<div class="hint">Se te propondrán al programar la semana siguiente; nada entra sin tu aprobación.</div><div class="pr-list">' + lista.map(function (p) {
      return '<div class="pend-i"><div class="pend-t"><b>' + esc(p.BLOQUE) + '</b><span class="tag">' + esc(p.TIPO) + '</span><span class="tag' + (p.ESTADO === 'Propuesto' ? ' ex' : '') + '">' + esc(p.ESTADO) + '</span></div>' +
        '<div class="hint">' + esc(p['FECHA ORIGINAL']) + (p.MOTIVO ? ' · ' + esc(p.MOTIVO) : '') + '</div>' +
        '<div class="evc-acc"><button class="btn-ghost sm" type="button" data-pend="' + esc(p.ID) + '" data-est="Descartado">Descartar</button></div></div>';
    }).join('') + '</div>';
  }

  // ---------- Descuentos (APP · DESCUENTOS) ----------
  function urlSegura(u) { return /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''; }
  function cargarDescuentos() {
    api({ action: 'descuentos' }).then(ok).then(function (r) { S.desc = r.descuentos; pintarDescuentos(); })
      .catch(function () { var el = document.getElementById('desc-body'); if (el) el.innerHTML = '<div class="err">No se pudieron cargar.</div>'; });
  }
  function pintarDescuentos() {
    var el = document.getElementById('desc-body'); if (!el || !S.desc) return;
    var activos = S.desc.filter(function (x) { return !/RETIRADO|CADUCADO/i.test(x.ESTADO || '') && !(x.FIN && aIso(x.FIN) && aIso(x.FIN) < S.data.hoy); });
    el.innerHTML = (activos.length ? activos.map(function (x) {
      return '<div class="desc"><div class="desc-top"><b>' + esc(x.MARCA) + '</b>' + (x['CÓDIGO'] ? '<span class="desc-code">' + esc(x['CÓDIGO']) + '</span>' : '') + '</div>' +
        (x['DESCRIPCIÓN'] ? '<p>' + esc(x['DESCRIPCIÓN']) + '</p>' : '') + '<div class="hint">' + (x.FIN ? 'Hasta el ' + esc(x.FIN) : 'Sin fecha de fin') + (x.NOTAS ? ' · ' + esc(x.NOTAS) : '') + '</div>' +
        '<div class="two-btn"><button class="btn btn-primary" type="button" data-desc-usar="' + x._fila + '">' + (x['CÓDIGO'] ? 'Copiar código y abrir web' : 'Abrir web') + '</button>' +
        '<button class="btn" type="button" data-desc-del="' + esc(JSON.stringify({ fila: x._fila, c: { MARCA: x.MARCA, 'CÓDIGO': x['CÓDIGO'] } })) + '">Quitar</button></div></div>';
    }).join('') : '<div class="hint">Todavía no hay descuentos.</div>') +
      '<details class="hist"><summary>＋ Añadir descuento</summary><div class="exp-body"><form id="descf" class="avf">' +
      '<label for="ds-m">Marca o tienda</label><input id="ds-m" maxlength="60" required>' +
      '<label for="ds-d">Qué incluye</label><input id="ds-d" maxlength="200" placeholder="Ej. 10 % en toda la web">' +
      '<div class="two"><div><label for="ds-c">Código</label><input id="ds-c" maxlength="40"></div><div><label for="ds-f">Hasta (vacío = indefinido)</label><input id="ds-f" type="date"></div></div>' +
      '<label for="ds-u">Enlace de la web</label><input id="ds-u" type="url" required placeholder="https://…">' +
      '<button class="btn btn-primary" type="submit" id="ds-ok">Guardar descuento</button></form></div></details>';
    document.getElementById('descf').onsubmit = function (ev) {
      ev.preventDefault();
      if (!urlSegura(val('ds-u'))) { toast('El enlace debe empezar por https://'); return; }
      var b = document.getElementById('ds-ok'); b.disabled = true;
      api({ action: 'descuento', descuento: { MARCA: val('ds-m'), 'DESCRIPCIÓN': val('ds-d'), 'CÓDIGO': val('ds-c'), ENLACE: val('ds-u'), FIN: val('ds-f') ? aTxt(val('ds-f')) : '', ESTADO: 'Activo' } })
        .then(ok).then(function (r) { S.desc = r.descuentos; pintarDescuentos(); toast('Descuento guardado'); }).catch(falloApi(b));
    };
  }

  // ---------- Mis webs (APP · WEBS) ----------
  function cargarWebs() {
    api({ action: 'webs' }).then(ok).then(function (r) { S.webs = r.webs; pintarWebs(); })
      .catch(function () { var el = document.getElementById('webs-body'); if (el) el.innerHTML = '<div class="err">No se pudieron cargar.</div>'; });
  }
  function pintarWebs() {
    var el = document.getElementById('webs-body'); if (!el || !S.webs) return;
    el.innerHTML = (S.webs.length ? '<div class="pr-list">' + S.webs.map(function (w) {
      var u = urlSegura(w.URL);
      return '<div class="pr-row"><b>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(w.NOMBRE || u) + '</a>' : esc(w.NOMBRE)) + '</b>' +
        '<span class="hint">' + esc([w['CATEGORÍA'], w.NOTA].filter(Boolean).join(' · ')) + '</span>' +
        '<button type="button" class="x" data-web-del="' + esc(JSON.stringify({ fila: w._fila, c: { NOMBRE: w.NOMBRE, URL: w.URL } })) + '" aria-label="Quitar">×</button></div>';
    }).join('') + '</div>' : '<div class="hint">Aún no tienes webs guardadas.</div>') +
      '<details class="hist"><summary>＋ Añadir web</summary><div class="exp-body"><form id="webf" class="avf">' +
      '<label for="wb-n">Nombre</label><input id="wb-n" maxlength="80" required>' +
      '<label for="wb-u">Enlace</label><input id="wb-u" type="url" required placeholder="https://…">' +
      '<div class="two"><div><label for="wb-c">Categoría</label><input id="wb-c" maxlength="40" placeholder="Material, competiciones…"></div><div><label for="wb-t">Nota</label><input id="wb-t" maxlength="200"></div></div>' +
      '<button class="btn btn-primary" type="submit" id="wb-ok">Guardar web</button></form></div></details>';
    document.getElementById('webf').onsubmit = function (ev) {
      ev.preventDefault();
      if (!urlSegura(val('wb-u'))) { toast('El enlace debe empezar por https://'); return; }
      var b = document.getElementById('wb-ok'); b.disabled = true;
      api({ action: 'web', web: { NOMBRE: val('wb-n'), URL: val('wb-u'), 'CATEGORÍA': val('wb-c'), NOTA: val('wb-t') } })
        .then(ok).then(function (r) { S.webs = r.webs; pintarWebs(); toast('Web guardada'); }).catch(falloApi(b));
    };
  }

  // ---------- Vídeos (APP · VÍDEOS) ----------
  function pintarVideos(q) {
    var el = document.getElementById('vid-body'); if (!el) return;
    var nq = norm(q).trim();
    var r = listaVideos.map(function (v, i) { return { v: v, i: i }; }).filter(function (o) {
      return !nq || norm(o.v.nombre).indexOf(nq) >= 0 || (o.v.alias || []).some(function (a) { return norm(a).indexOf(nq) >= 0; });
    }).slice(0, 50);
    el.innerHTML = r.map(function (o) { return '<button type="button" class="pr-row vid-row" data-v="' + o.i + '"><b>' + esc(o.v.nombre) + '</b><span class="go">▶</span></button>'; }).join('') ||
      '<div class="hint">' + (listaVideos.length ? 'Nada con ese nombre.' : 'Cargando biblioteca…') + '</div>';
  }

  // ---------- Fase del ciclo: objetivos ----------
  function abrirFase(i) {
    var c = S.data && S.data.ciclo, f = c && c.fases[i]; if (!f) return;
    abrirHoja('<div class="row"><h2>' + esc(cap(f.nombre)) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">' + (f.inicio ? fechaCorta(f.inicio) + ' – ' + fechaCorta(f.fin) + ' · ' : '') + f.semanas + ' semanas' +
      (i === c.actual ? ' · <b>fase actual (semana ' + c.semana + ')</b>' : i < c.actual ? ' · terminada' : ' · próxima') + '</div>' +
      (f.objetivos ? '<div class="part-lbl" style="margin-top:12px">Objetivos</div><div class="goals">' + esc(f.objetivos) + '</div>' : '<div class="hint">Sin objetivos escritos para esta fase.</div>'));
  }

  function mensajeError(m) {
    return { marca_incompleta: 'Falta el movimiento o el valor.', registro_incompleto: 'Falta la fecha o el bloque.', rpe_no_valido: 'El RPE va del 1 al 10.',
      la_fila_ha_cambiado: 'La hoja ha cambiado: recarga e inténtalo otra vez.', no_encontrado: 'Ya no existe.', no_autorizado: 'Cuenta no autorizada.',
      sesion_caducada: 'La sesión ha caducado: vuelve a entrar.', eventos_sin_decidir: 'Decide cómo proceder con cada evento antes de confirmar.',
      evento_incompleto: 'Pon nombre y fecha al evento.', falta_evento: 'Escribe qué ha surgido.', faltan_datos: 'Faltan datos del bloque.' }[m] || ('No se pudo guardar' + (m ? ' (' + m + ')' : '') + '. Revisa la conexión.');
  }
  // ---------- marcas: agrupar y formatos (de la app de Gabi) ----------
  function agruparMarcas(lista) {
    var g = {};
    lista.forEach(function (x) {
      var k = x.marca.toUpperCase();
      var e = g[k] = g[k] || { lista: [], mejor: null };
      e.lista.push(x);
      if (!e.mejor || mejorQue(x, e.mejor)) e.mejor = x;
    });
    return g;
  }
  function valorNum(x) { if (x.tipo === 'Tiempo') { var p = String(x.valor).split(':').map(Number), sg = 0; p.forEach(function (n) { sg = sg * 60 + (n || 0); }); return p.length === 1 ? sg * 60 : sg; } return parseFloat(String(x.valor).replace(',', '.')); }
  function mejorQue(a, b) { return a.tipo === 'Tiempo' ? valorNum(a) < valorNum(b) : valorNum(a) > valorNum(b); }
  function fmtMarca(x) { if (!x) return ''; var u = { Kilos: ' kg', Calorías: ' cal', Reps: ' reps', Tiempo: '', Distancia: ' m' }[x.tipo] || ''; return x.valor + u; }
  var PH_MARCA = { Kilos: 'kg · ej. 102.5', Tiempo: 'mm:ss · ej. 3:45 (o 1:05:30)', Reps: 'reps · ej. 50', 'Calorías': 'cal · ej. 120', Distancia: 'metros · ej. 400' };
  var CATALOGO = { FRAN: 'Tiempo', GRACE: 'Tiempo', ISABEL: 'Tiempo', DIANE: 'Tiempo', HELEN: 'Tiempo', KAREN: 'Tiempo', MURPH: 'Tiempo', CINDY: 'Reps',
    '400 M RUN': 'Tiempo', '1 K RUN': 'Tiempo', '5 K RUN': 'Tiempo', '10 K RUN': 'Tiempo', '500 M ROW': 'Tiempo', '2 K ROW': 'Tiempo', '1 K SKI': 'Tiempo',
    '50 CAL BIKE': 'Tiempo', HYROX: 'Tiempo', 'HYROX DOBLES': 'Tiempo', 'MAX PULL UPS': 'Reps', 'MAX STRICT PULL UPS': 'Reps', 'MAX T2B': 'Reps', 'MAX HSPU': 'Reps',
    'MAX DU': 'Reps', 'MAX RING MUSCLE UP': 'Reps', 'MAX BAR MUSCLE UP': 'Reps', 'HS WALK': 'Distancia', 'CLEAN & JERK': 'Kilos', 'OVERHEAD SQUAT': 'Kilos',
    'STRICT PRESS': 'Kilos', 'PUSH PRESS': 'Kilos', THRUSTER: 'Kilos' };
  function nombresCatalogo(propios) {
    var l = Object.keys(CATALOGO).concat(propios.map(function (n) { return n.toUpperCase(); }));
    return l.filter(function (x, i) { return l.indexOf(x) === i; });
  }

  // ---------- tiempos: huecos h · min · s (y texto libre con : , ; ' " . o espacios) ----------
  /** "12:45", "12,45", "12'45\"", "1.05.30", "1245" → {h,m,s}. null si no se entiende o los segundos pasan de 59. */
  function partesTiempo(txt) {
    var t = String(txt == null ? '' : txt).trim();
    if (!t) return null;
    var p = t.split(/[^0-9]+/).filter(function (x) { return x !== ''; }).map(Number);
    if (!p.length) return null;
    if (p.length === 1) {
      var d = String(p[0]);
      if (d.length <= 2) p = [p[0], 0];                                   // "12" → 12 min
      else if (d.length <= 4) p = [Number(d.slice(0, -2)), Number(d.slice(-2))];   // "1245" → 12:45
      else p = [Number(d.slice(0, -4)), Number(d.slice(-4, -2)), Number(d.slice(-2))]; // "10530" → 1:05:30
    }
    if (p.length > 3) return null;
    var h = p.length === 3 ? p[0] : 0, m = p[p.length - 2], s = p[p.length - 1];
    if (s > 59 || (p.length === 3 && m > 59)) return null;
    h += Math.floor(m / 60); m = m % 60;
    if (!h && !m && !s) return null;
    return { h: h, m: m, s: s };
  }
  function textoTiempo(o) {
    if (!o) return '';
    var dd = function (n) { return (n < 10 ? '0' : '') + n; };
    return o.h ? o.h + ':' + dd(o.m) + ':' + dd(o.s) : o.m + ':' + dd(o.s);
  }
  function campoTiempo(id, valor) {
    var o = partesTiempo(valor) || {};
    var caja = function (k, lbl, ph, max, v) {
      return '<label class="tz"><input id="' + id + '-' + k + '" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-max="' + max + '" placeholder="' + ph + '" value="' + (v != null && (v || k !== 'h') ? v : '') + '" aria-label="' + lbl + '"><span>' + lbl + '</span></label>';
    };
    return '<div class="tiempo" id="' + id + '" role="group" aria-label="Tiempo">' +
      caja('h', 'horas', '0', 2, o.h) + '<b aria-hidden="true">:</b>' + caja('m', 'min', '12', 3, o.m != null ? o.m : null) + '<b aria-hidden="true">:</b>' +
      caja('s', 'seg', '45', 2, o.s != null ? (o.s < 10 ? '0' + o.s : o.s) : null) + '</div>';
  }
  /** Lee los huecos. '' si están vacíos; null si hay un error (y lo marca en rojo). */
  function leerTiempo(id) {
    var g = function (k) { var e = document.getElementById(id + '-' + k); return e ? e.value.replace(/\D/g, '') : ''; };
    var h = g('h'), m = g('m'), s = g('s');
    var w = document.getElementById(id);
    if (!h && !m && !s) return '';
    var o = partesTiempo(h ? h + ':' + (m || 0) + ':' + (s || 0) : (m || 0) + ':' + (s || 0));
    if (w) w.classList.toggle('mal', !o);
    return o ? textoTiempo(o) : null;
  }
  /**
   * Comportamiento de los huecos:
   *  · "12:45" (o 12,45 · 12'45 · 12;45 · 12.45) escrito o pegado en cualquier hueco → se reparte solo.
   *  · Un número + separador ("12,") → se queda el número y salta al hueco siguiente.
   *  · Solo cifras; al llenar 2 cifras en horas o minutos, salta al siguiente.
   */
  function enlazarTiempo(id) {
    var w = document.getElementById(id);
    if (!w) return;
    var cajas = ['h', 'm', 's'].map(function (k) { return document.getElementById(id + '-' + k); });
    var MAX = [2, 3, 2];
    cajas.forEach(function (c, i) {
      c.oninput = function () {
        var v = c.value;
        w.classList.remove('mal');
        if (/[^0-9]/.test(v)) {
          var nums = v.split(/[^0-9]+/).filter(function (x) { return x !== ''; });
          if (nums.length >= 2) {
            var o = partesTiempo(v);
            if (o) { cajas[0].value = o.h ? o.h : ''; cajas[1].value = o.m; cajas[2].value = (o.s < 10 ? '0' : '') + o.s; cajas[2].focus(); return; }
          }
          c.value = (nums[0] || '').slice(0, MAX[i]);
          if (nums.length === 1 && cajas[i + 1]) { cajas[i + 1].focus(); try { cajas[i + 1].select(); } catch (e) {} }
          return;
        }
        if (v.length > MAX[i]) c.value = v = v.slice(0, MAX[i]);
        if (i < 2 && v.length >= 2) { cajas[i + 1].focus(); try { cajas[i + 1].select(); } catch (e) {} }
      };
      c.onfocus = function () { try { c.select(); } catch (e) {} };
      c.onkeydown = function (e) { if (e.key === 'Backspace' && !c.value && i > 0) cajas[i - 1].focus(); };
    });
  }


  function copiar(texto, msg) {
    var hecho = function () { toast(msg || 'Copiado'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(hecho).catch(function () { copiarViejo(texto); hecho(); });
    else { copiarViejo(texto); hecho(); }
  }
  function copiarViejo(t) {
    var a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(a);
  }

  function abrirVideoUrl(nombre, url) {
    var id = idVideo(url);
    abrirHoja('<div class="row"><h2>' + esc(nombre) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      (id ? '<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0&modestbranding=1" title="' + esc(nombre) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' : '') +
      '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">Abrir en YouTube</a>');
  }
  // =====================================================================
  //  EXTRA v4.1 · calculadora lb/kg · instalar en cualquier sistema · acceso «Solo eventos» · perfil
  // =====================================================================

  // ---------- calculadora lb ⇄ kg (ventana flotante, no tapa ni cambia la pantalla) ----------
  var LB = 0.45359237;
  var ICO_CALC = '<span class="calc-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13.5V9.5M9.5 3.5h5M18 7l1.5-1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>kg</span>';
  function botonCalc() { return '<button class="icon-btn calc-btn" type="button" data-calc aria-label="Herramientas: calculadora lb/kg y timer libre">' + ICO_CALC + '</button>'; }
  /** Botón de herramientas: elegir calculadora o timer libre. */
  function abrirHerramientas() {
    if (document.getElementById('calc')) { toggleCalc(); return; }
    abrirHoja('<div class="row"><h2>Herramientas</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div><div class="herr">' +
      '<button type="button" class="herr-op" data-herr="calc"><span class="herr-ico">lb<i>⇄</i>kg</span><b>Calculadora</b><span>Libras ⇄ kilos</span></button>' +
      '<button type="button" class="herr-op" data-herr="timer"><span class="herr-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 13.5V9.5M9.5 3.5h5M18 7l1.5-1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><b>Timer libre</b><span>For time, AMRAP, EMOM, Tabata…</span></button></div>');
  }
  function redondear(x) { return Math.round(x * 10) / 10; }
  function fmtNum(x) { return isFinite(x) ? String(redondear(x)).replace('.', ',') : ''; }
  function leerNum(v) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? NaN : n; }
  function toggleCalc(forzar) {
    var el = document.getElementById('calc');
    if (el && forzar !== true) { el.remove(); guardar('rte-calc', false); return; }
    if (el) return;
    el = document.createElement('div');
    el.id = 'calc'; el.className = 'calc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Calculadora libras y kilos');
    var ult = leer('rte-calc-v') || '';
    el.innerHTML = '<div class="calc-top"><b>Libras ⇄ kilos</b><button class="icon-btn" type="button" data-calc-cerrar aria-label="Cerrar">×</button></div>' +
      '<div class="calc-row"><label><input id="calc-lb" inputmode="decimal" autocomplete="off" placeholder="135"><span>lb</span></label><b aria-hidden="true">=</b>' +
      '<label><input id="calc-kg" inputmode="decimal" autocomplete="off" placeholder="61,2"><span>kg</span></label></div>' +
      '<div class="calc-chips" id="calc-chips">' + [45, 35, 95, 135, 185, 225].map(function (n) { return '<button type="button" data-lb="' + n + '">' + n + ' lb</button>'; }).join('') + '</div>' +
      '<div class="hint">Barra olímpica: 45 lb ≈ 20,4 kg · 35 lb ≈ 15,9 kg</div>';
    document.body.appendChild(el);
    var lb = document.getElementById('calc-lb'), kg = document.getElementById('calc-kg');
    lb.oninput = function () { var n = leerNum(lb.value); kg.value = isNaN(n) ? '' : fmtNum(n * LB); guardar('rte-calc-v', lb.value); };
    kg.oninput = function () { var n = leerNum(kg.value); lb.value = isNaN(n) ? '' : fmtNum(n / LB); guardar('rte-calc-v', lb.value); };
    if (ult) { lb.value = ult; lb.oninput(); }
    guardar('rte-calc', true);
  }

  // ---------- instalar la app: Windows/Mac/Android con botón; iPhone/iPad con pasos guiados ----------
  function esStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function entorno() {
    var ua = navigator.userAgent || '', ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
    var nav = /CriOS/.test(ua) ? 'chrome' : /FxiOS|Firefox/.test(ua) ? 'firefox' : /EdgiOS|Edg\//.test(ua) ? 'edge' : /SamsungBrowser/.test(ua) ? 'samsung' :
      /Chrome|Chromium/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'otro';
    var so = ios ? 'ios' : /Android/i.test(ua) ? 'android' : /Mac/i.test(ua) ? 'mac' : 'windows';
    return { so: so, nav: nav };
  }
  var ICO_IOS_SHARE = '<svg class="ico-inline" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  function pasosInstalar() {
    var e = entorno();
    if (e.so === 'ios') return '<ol class="steps">' +
      '<li>Pulsa <b>Compartir</b> ' + ICO_IOS_SHARE + (e.nav === 'safari' ? ' (abajo en el centro en iPhone; arriba en iPad).' : ' (en Chrome está arriba a la derecha, junto a la dirección).') + '</li>' +
      '<li>Desliza hacia abajo y toca <b>Añadir a pantalla de inicio</b>. Si no aparece: <b>Editar acciones</b> y actívala.</li>' +
      '<li>Pulsa <b>Añadir</b>. El icono de la E aparece con tus apps y se abre a pantalla completa.</li></ol>' +
      '<div class="hint">Apple no deja que una web se instale sola con un botón: hay que hacerlo desde Compartir. Funciona en Safari y, desde iOS 16.4, también en Chrome y Edge.</div>';
    if (e.so === 'android') return '<ol class="steps">' +
      (e.nav === 'samsung' ? '<li>Menú <b>≡</b> (abajo) → <b>Añadir página a</b> → <b>Pantalla de inicio</b>.</li>' :
        e.nav === 'firefox' ? '<li>Menú <b>⋮</b> → <b>Instalar</b> (o <b>Añadir a pantalla de inicio</b>).</li>' :
        '<li>Menú <b>⋮</b> (arriba a la derecha) → <b>Instalar aplicación</b> (o <b>Añadir a pantalla de inicio</b>).</li>') +
      '<li>Pulsa <b>Instalar</b>. Aparece el icono de la E con tus apps.</li></ol>';
    if (e.so === 'mac' && e.nav === 'safari') return '<ol class="steps"><li>Menú <b>Archivo → Añadir al Dock</b> (Safari 17 o posterior).</li><li>Pulsa <b>Añadir</b>. Se abre como una app más desde el Dock o Launchpad.</li></ol>';
    if (e.nav === 'firefox') return '<p>Firefox de ordenador no instala webs como app. Abre esta misma dirección en <b>Chrome</b> o <b>Edge</b> y pulsa <b>Instalar</b>.</p>';
    return '<ol class="steps"><li>En la barra de direcciones, pulsa el icono <b>Instalar</b> (una pantalla con una flecha). Si no aparece: menú <b>⋮</b> → <b>Enviar, guardar y compartir</b> → <b>Instalar página como aplicación</b> (Edge: <b>Aplicaciones → Instalar este sitio como una aplicación</b>).</li>' +
      '<li>Pulsa <b>Instalar</b>. Se crea un icono en el escritorio y en el menú Inicio (Windows) o en Aplicaciones (Mac).</li></ol>';
  }
  function instalar() {
    if (S.instalar) {
      S.instalar.prompt();
      S.instalar.userChoice.then(function (r) { S.instalar = null; if (r && r.outcome === 'accepted') toast('Instalando Road To Elite…'); render(); });
      return;
    }
    abrirHoja('<div class="row"><h2>Instalar la app</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' + pasosInstalar());
  }
  function htmlInstalar() {
    if (esStandalone()) return '<div class="hint">Ya la tienes instalada: la estás usando como app. ✓</div>';
    return '<button class="btn btn-primary" type="button" data-instalar>Instalar la app en este ' + (/ios|android/.test(entorno().so) ? 'móvil' : 'ordenador') + '</button>' +
      (S.instalar ? '' : pasosInstalar());
  }
  function bannerInstalar() {
    if (esStandalone() || leer('rte-inst-cerrado')) return '';
    var e = entorno();
    if (!S.instalar && e.so !== 'ios' && e.so !== 'android') return '';
    return '<div class="inst-banner"><div><b>Instala Road To Elite</b><span class="hint">Ábrela desde un icono, a pantalla completa.</span></div>' +
      '<button class="btn btn-primary" type="button" data-instalar>Instalar</button><button class="icon-btn" type="button" data-inst-cerrar aria-label="No mostrar más">×</button></div>';
  }
  window.addEventListener('appinstalled', function () { S.instalar = null; guardar('rte-inst-cerrado', true); toast('App instalada'); if (S.data) render(); });


  // =====================================================================
  //  TIMER · detección por parte (sin dependencias: se prueba en Node con fabrik/partes.json)
  //  Grupos: intervalo {cada, rondas, cap?} · cuenta {dur, etiqueta} · onoff {on, off, rondas}
  //          descanso {dur} · series {series, descanso, pasos:[{t:'tiempo'|'tap'|'pausa', s?, txt?}]} · crono {}
  //  Solo hay timer donde Gabi escribe un tiempo de estructura. Isometrías y tempos se ignoran.
  // =====================================================================
  var TM_TIEMPO = /(\d+)[ \t]*'[ \t]*(?:(\d{1,2})[ \t]*(?:"|''|”|″)?)?|(\d+)[ \t]*(?:"|''|”|″)/;
  /** Primer tiempo del texto, en segundos. Rangos «2/3'» → 2'; «90"/2'» → 90". */
  function tmSeg(s) {
    s = String(s || '');
    var r = s.match(/(\d+)[ \t]*\/[ \t]*\d+[ \t]*'/);
    if (r && s.indexOf(r[0]) <= s.search(TM_TIEMPO)) return Number(r[1]) * 60;
    var m = s.match(TM_TIEMPO);
    if (!m) return null;
    if (m[3]) return Number(m[3]);
    return Number(m[1]) * 60 + Number(m[2] || 0);
  }
  function tmFmt(s) {
    if (s == null) return '—';
    s = Math.round(s); var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function tmNum(s) { var m = String(s || '').match(/(\d+)/); return m ? Number(m[1]) : null; }

  /** Cuántas series hay escritas debajo de un EVERY sin «X N»: «2 SETS 75%», «SET 1/2/3/4:», «80/83/85/88/90/90%». */
  function tmSeriesDebajo(lineas, desde) {
    var suma = 0, maxSet = 0, porc = 0;
    for (var i = desde; i < lineas.length; i++) {
      var l = lineas[i];
      if (/^(EVERY|EMOM|E\d+MOM|AMRAP|TIME ?CAP|REST\b|THEN|INTO|[A-Z](\.\d)?\))/.test(l)) break;
      var a = l.match(/^(\d+)\s*SETS?\s+\d/); if (a) suma += Number(a[1]);
      var b = l.match(/^SETS?\s+([\d\/]+)\s*:/); if (b) b[1].split('/').forEach(function (x) { maxSet = Math.max(maxSet, Number(x) || 0); });
      var c = l.match(/^(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?){2,})\s*%/); if (c && !porc) porc = c[1].split('/').length;
    }
    return suma || maxSet || porc || null;
  }

  /** Ejercicio que toca en cada ronda: «1': …», «ODD: … / EVEN: …», «ALTERNANDO A Y B» + «A) …». */
  function tmEstaciones(lineas, desde) {
    var min = [], oe = [], abc = [], alt = false;
    for (var i = desde; i < lineas.length; i++) {
      var l = lineas[i];
      if (/^(EVERY|EMOM|E\d+MOM|AMRAP|TIME ?CAP|REST\b)/.test(l) && i > desde) break;
      var m;
      if ((m = l.match(/^(\d+)\s*'\s*:\s*(.+)/))) min[Number(m[1]) - 1] = m[2];
      else if ((m = l.match(/^(ODD|EVEN|IMPAR|PAR)\s*:\s*(.+)/))) oe[/ODD|IMPAR/.test(m[1]) ? 0 : 1] = m[1] + ': ' + m[2];
      else if (/ALTERNANDO/.test(l)) alt = true;
      else if (alt && (m = l.match(/^([A-F])\)\s*(.+)/))) abc.push(m[1] + ') ' + m[2]);
    }
    if (min.length && min.every(Boolean)) return min;
    if (oe[0] && oe[1]) return oe;
    if (abc.length > 1) return abc;
    return null;
  }

  function detectarTimer(texto, etiqueta) {
    var cab = String(etiqueta || '').toUpperCase().replace(/^[A-Z](\.\d)?\s*·\s*/, '').trim();
    var lineas = ((cab && /\d\s*('|")|SETS?|NO TIME/.test(cab) ? cab + '\n' : '') + String(texto || '').toUpperCase()).split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); });
    var g = [], total = null, notas = [], hayCuenta = false, forTime = false, restNeeded = false, repetir = 1, saltar = false;
    var setsCtx = null; // { series, pasos:[], tap:[] } mientras se leen ejercicios bajo «N SETS»
    var capRonda = null;
    lineas.forEach(function (l) { var m = l.match(/TIME ?CAP PER ROUND\s*(.+)/); if (m) capRonda = tmSeg(m[1]); });
    function cerrarTap() { if (setsCtx && setsCtx.tap.length) { setsCtx.pasos.push({ t: 'tap', txt: setsCtx.tap.join(' · ') }); setsCtx.tap = []; } }
    function cerrarSets(descanso) {
      if (!setsCtx) return;
      cerrarTap();
      if (descanso != null && !hayCuenta && setsCtx.pasos.length) g.push({ k: 'series', series: setsCtx.series, descanso: descanso, pasos: setsCtx.pasos });
      setsCtx = null;
    }
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i], m;
      if (!l) { if (setsCtx && !setsCtx.pasos.length && !setsCtx.tap.length) setsCtx = null; if (saltar && !lineas[i + 1]) saltar = false; continue; }
      if (/^ADAPTACI/.test(l)) break;                                   // lo que sigue es otra versión
      if (/^ISOM[EÉ]TRIC/.test(l) || /^DIN[AÁ]MICA$/.test(l)) { setsCtx = null; saltar = true; continue; }
      if (saltar) { if (/^[A-Z](\.\d)?\)/.test(l)) saltar = false; else continue; }
      if (/^[*(]/.test(l) || /^RIR|^RPE|^\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)*\s*%/.test(l)) continue;
      var tot = l.match(/\((\d+\s*'(?:\s*\d+\s*")?)\)/);
      if (tot && /METCON|VENTANA|TIME ?CAP\/AMRAP|AMRAP\/TIME/.test(l)) total = tmSeg(tot[1]);
      if (/FOR TIME|NO TIME ?CAP/.test(l)) forTime = true;
      var rp = l.match(/^(?:[A-Z ]*METCON\s*:?\s*)?(\d+)\s*SETS?\s*\((\d+\s*'(?:\s*\d+\s*")?)\)/);
      if (rp) { repetir = Number(rp[1]); total = tmSeg(rp[2]); continue; }
      if (/REST NEEDED/.test(l)) { restNeeded = true; setsCtx = null; continue; }
      // ON / OFF
      if ((m = l.match(/((?:\d+\s*(?:'|")\s*\+?\s*)+)\s*ON\s*X?\s*(\d+\s*(?:'|")(?:\s*\d+\s*")?)\s*OFF(?:\s*X?\s*(\d+)\s*(?:SETS?|ROUNDS?))?/))) {
        var on = 0; m[1].replace(/(\d+)\s*('|")/g, function (_, n, u) { on += Number(n) * (u === "'" ? 60 : 1); return _; });
        var rondas = m[3] ? Number(m[3]) : (setsCtx ? setsCtx.series : tmNum((lineas[i + 1] || '').match(/^\d+\s*SETS?/) ? lineas[i + 1] : ''));
        if (!rondas) { var mins = 0; for (var q = i + 1; q < lineas.length && !/^ADAPTACI/.test(lineas[q]); q++) if (/^\d+\s*'\s*:/.test(lineas[q])) mins++; rondas = mins || null; }
        g.push({ k: 'onoff', on: on, off: tmSeg(m[2]), rondas: rondas || null, etiqueta: /AMRAP/.test(l) ? 'AMRAP' : 'ON/OFF' });
        hayCuenta = true; setsCtx = null; continue;
      }
      // EMOM / E2MOM
      if ((m = l.match(/\bE(\d*)MOM\s*(\d+\s*'(?:\s*\d+\s*")?)/))) {
        var cada = (Number(m[1]) || 1) * 60, dur = tmSeg(m[2]);
        var ge = { k: 'intervalo', cada: cada, rondas: Math.max(1, Math.round(dur / cada)), etiqueta: m[1] ? 'E' + m[1] + 'MOM' : 'EMOM' };
        var es = tmEstaciones(lineas, i + 1); if (es) ge.estaciones = es;
        g.push(ge);
        hayCuenta = true; setsCtx = null; continue;
      }
      // EVERY T (X N)
      if ((m = l.match(/\bEVERY\s+(.+)/)) && tmSeg(m[1]) != null) {
        var cadaE = tmSeg(m[1]), n = null, dePie = false;
        var x = m[1].match(/X\s*(\d+)(?:\s*\/\s*\d+)?\s*(?:SETS?|ROUNDS?|RONDAS?)?/);
        if (x) n = Number(x[1]);
        else {
          var sig = (lineas[i + 1] || '').match(/^(\d+)\s*(?:SETS?|ROUNDS?)\b\s*$/);
          if (sig) { n = Number(sig[1]); dePie = true; }
          else n = tmSeriesDebajo(lineas, i + 1);
        }
        var gr = { k: 'intervalo', cada: cadaE, rondas: n, etiqueta: 'EVERY ' + tmFmt(cadaE) };
        if (dePie) gr.dePie = true;
        if (capRonda) gr.cap = capRonda;
        var esE = tmEstaciones(lineas, i + 1); if (esE) gr.estaciones = esE;
        g.push(gr); hayCuenta = true; setsCtx = null; continue;
      }
      // AMRAP T / TIME CAP T (sin «PER ROUND»)
      if ((m = l.match(/\b(AMRAP|TIME ?CAP)\s*:?\s*(\d+\s*(?:'|")(?:\s*\d+\s*")?)/)) && !/PER ROUND/.test(l)) {
        g.push({ k: 'cuenta', dur: tmSeg(m[2]), etiqueta: m[1] === 'AMRAP' ? 'AMRAP' : 'TIME CAP' });
        hayCuenta = true; setsCtx = null; continue;
      }
      // N SETS (abre contexto de series; «4X5 …» también)
      if ((m = l.match(/^(\d+)(?:\/\d+)?\s*(?:SETS?|ROUNDS?)\b/)) || (m = l.match(/^(\d+)\s*X\s*\d+(?:\+\d+)?\s+[A-Z]/))) {
        if (setsCtx && !hayCuenta) { cerrarTap(); cerrarSets(setsCtx.pasos.some(function (x) { return x.t === 'pausa'; }) ? 0 : null); }
        if (!hayCuenta) { setsCtx = { series: Number(m[1]), pasos: [], tap: [] }; if (!/SETS?|ROUNDS?/.test(l.slice(0, 12))) setsCtx.tap.push(l); }
        continue;
      }
      // REST
      if ((m = l.match(/^REST\s+(.+)/))) {
        var t = tmSeg(m[1]);
        if (t == null) continue;
        if (/PER (SET|ROUND|SERIE|RONDA)/.test(l)) { cerrarSets(t); continue; }
        if (setsCtx) {
          // descanso dentro de la serie; si es el último REST del bloque de series, es el descanso entre series
          var masAbajo = false;
          for (var j = i + 1; j < lineas.length && lineas[j]; j++) if (/^REST\b/.test(lineas[j])) masAbajo = true;
          var hayEjDespues = !!(lineas[i + 1] && !/^(REST|THEN|INTO)/.test(lineas[i + 1]));
          if (!masAbajo && !hayEjDespues) {
            if (setsCtx.series === 1) { cerrarSets(0); if (!hayCuenta) g.push({ k: 'descanso', dur: t }); }
            else cerrarSets(t);
            continue;
          }
          cerrarTap(); setsCtx.pasos.push({ t: 'pausa', s: t }); continue;
        }
        if (g.length) g.push({ k: 'descanso', dur: t });
        continue;
      }
      if (/^(THEN|INTO)\b/.test(l)) continue;
      // línea de ejercicio dentro de series
      if (setsCtx) {
        var est = l.match(/^((?:\d+\s*(?:'|")\s*\+?\s*)+)\s*(?!ON\b)([A-Z].*)/);
        var ult = setsCtx.pasos[setsCtx.pasos.length - 1];
        if (est) {
          var sEst = 0; est[1].replace(/(\d+)\s*('|")/g, function (_, n, u) { sEst += Number(n) * (u === "'" ? 60 : 1); return _; });
          cerrarTap(); setsCtx.pasos.push({ t: 'tiempo', s: sEst, txt: est[2] });
        } else if (!/^\d/.test(l) && !setsCtx.tap.length && ult && ult.t === 'tiempo') ult.txt += ' ' + l;
        else setsCtx.tap.push(l);
      }
    }
    if (setsCtx && !hayCuenta) { cerrarTap(); cerrarSets(setsCtx.pasos.some(function (x) { return x.t === 'pausa'; }) ? 0 : null); }
    // «METCON: AMRAP 14'» que contiene «TIME CAP 2' → AMRAP 10' → TIME CAP 2'»: el primero es el total
    if (g.length > 2 && g[0].k === 'cuenta' && tmTotal(g.slice(1)) === g[0].dur) { total = g[0].dur; g = g.slice(1); }
    if (repetir > 1 && g.length) notas.push('Se repite ' + repetir + ' veces');
    // descansos sueltos al final no sirven
    while (g.length && g[g.length - 1].k === 'descanso') g.pop();
    while (g.length && g[0].k === 'descanso') g.shift();
    if (!g.length && forTime && !restNeeded) g.push({ k: 'crono', etiqueta: 'FOR TIME' });
    // comprobación con el total que escribe Gabi, p. ej. «VENTANAS (14')» o «(16'30")»
    var conf = 'alta';
    if (g.some(function (x) { return (x.k === 'intervalo' || x.k === 'onoff') && !x.rondas; })) conf = 'revisar';
    if (total) {
      var s = tmTotal(g) * repetir;
      if (s !== total) {
        var alt = g.map(function (x) { return x.dePie ? Object.assign({}, x, { rondas: 1 }) : x; });
        if (tmTotal(alt) * repetir === total) { g = alt; notas.push('Ajustado al total ' + tmFmt(total)); }
        else { conf = 'revisar'; notas.push('No cuadra con el total ' + tmFmt(total) + ' (sale ' + tmFmt(s) + ')'); }
      } else notas.push('Cuadra con el total ' + tmFmt(total));
    }
    g.forEach(function (x) { delete x.dePie; });
    return g.length ? { grupos: g, repetir: repetir, total: tmTotal(g) * repetir, confianza: conf, notas: notas } : null;
  }

  /** Duración fija en segundos (los pasos «hecho» de las series no cuentan). */
  function tmTotal(g) {
    return g.reduce(function (a, x) {
      if (x.k === 'intervalo') return a + (x.cada || 0) * (x.rondas || 0);
      if (x.k === 'cuenta' || x.k === 'descanso') return a + (x.dur || 0);
      if (x.k === 'onoff') return a + ((x.on || 0) + (x.off || 0)) * (x.rondas || 0);
      if (x.k === 'series') return a + (x.series || 0) * x.pasos.reduce(function (b, p) { return b + (p.s || 0); }, 0) + Math.max(0, (x.series || 0) - 1) * (x.descanso || 0);
      return a;
    }, 0);
  }

  function tmResumen(x) {
    if (x.k === 'intervalo') return (x.etiqueta || 'EVERY') + ' · ' + (x.rondas || '?') + ' × ' + tmFmt(x.cada) + (x.cap ? ' (cap ' + tmFmt(x.cap) + ')' : '');
    if (x.k === 'cuenta') return x.etiqueta + ' ' + tmFmt(x.dur);
    if (x.k === 'onoff') return (x.rondas || '?') + ' × (' + tmFmt(x.on) + ' on + ' + tmFmt(x.off) + ' off)';
    if (x.k === 'descanso') return 'Descanso ' + tmFmt(x.dur);
    if (x.k === 'series') return x.series + ' series · descanso ' + tmFmt(x.descanso) + (x.pasos.some(function (p) { return p.t !== 'tap'; }) ? ' · ' + x.pasos.filter(function (p) { return p.t !== 'tap'; }).map(function (p) { return (p.t === 'pausa' ? 'pausa ' : '') + tmFmt(p.s); }).join(' + ') : '');
    if (x.k === 'crono') return 'Cronómetro (' + (x.etiqueta || 'FOR TIME') + ')';
    return '';
  }

  // =====================================================================
  //  TIMER · botón por parte → «Tu timer» (editar y confirmar) → reloj a pantalla completa
  // =====================================================================
  var TM = { reg: [], run: null };
  var PIP = {};   // burbuja flotante (imagen en imagen)
  function tmHash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function tmClave(r) { return r.libre ? 'rte-tm-libre-' + r.tipo : 'rte-tm-' + r.iso + '|' + r.n + '|' + tmHash(r.texto); }
  function tmCorto(det) {
    var g = det.grupos, s = g.length === 1 ? tmResumen(g[0]) : g.length + ' tramos · ' + tmFmt(det.total);
    return (det.repetir > 1 ? det.repetir + '× ' : '') + s;
  }
  /** Botón ▶ Timer para una parte (o '' si Gabi no indicó tiempo). */
  function tmBoton(p, b, x) {
    var det = detectarTimer(p.texto, p.etiqueta);
    if (!det || !x) return '';
    var ver = ''; (b.variantes || []).forEach(function (v) { if ((v.partes || []).indexOf(p) >= 0) ver = v.nombre; });
    var r = { det: det, texto: p.texto, etq: p.etiqueta, iso: x.iso, n: b.n, titulo: b.titulo, version: ver, metcon: esMetcon(b) };
    var guardado = leer(tmClave(r)); if (guardado && guardado.grupos) r.propio = guardado;
    var i = TM.reg.push(r) - 1;
    var sum = tmCorto(r.propio || det);
    return '<button class="tm-btn' + (r.propio ? ' propio' : '') + '" type="button" data-tm="' + i + '" aria-label="Timer · ' + esc(sum) + '" title="Timer · ' + esc(sum) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5v11l9-5.5z" fill="currentColor"/></svg></button>';
  }

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

  // ---------- hojas ----------
  function abrirHoja(html) {
    $scrim.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    $scrim.hidden = false;
    var f = $scrim.querySelector('input,button,select'); if (f) f.focus();
  }
  function cerrarHoja() { $scrim.hidden = true; $scrim.innerHTML = ''; if (S.recargarAlCerrar) { S.recargarAlCerrar = false; setTimeout(recargarApp, 50); } }
  $scrim.addEventListener('click', function (e) { if (e.target === $scrim || e.target.closest('[data-close]')) cerrarHoja(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$scrim.hidden) cerrarHoja(); });

  function abrirVideo(i) {
    var v = listaVideos[i]; if (!v) return;
    var id = idVideo(v.url);
    abrirHoja('<div class="row"><h2>' + esc(v.nombre) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      (id ? '<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0&modestbranding=1" title="' + esc(v.nombre) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' : '') +
      '<a class="btn" href="' + esc(v.url) + '" target="_blank" rel="noopener">Abrir en YouTube</a>');
  }

  /** Pide confirmación con un segundo toque (cambia el texto del botón). */
  function confirmar(b, texto) {
    if (b.dataset.confirmar === '1') return true;
    b.dataset.confirmar = '1'; b.dataset.txt = b.textContent; b.textContent = texto || '¿Seguro?';
    setTimeout(function () { if (b.isConnected && b.dataset.confirmar === '1') { b.dataset.confirmar = ''; b.textContent = b.dataset.txt; } }, 4000);
    return false;
  }
  function falloApi(b) { return function (er) { if (b) b.disabled = false; toast(mensajeError(er.message)); }; }
  function ok(r) { if (!r.ok) throw new Error(r.detalle || r.error); return r; }

  // ---------- eventos de la interfaz ----------
  document.addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('.day-btn'))) { S.dia = +b.dataset.dia; render(); window.scrollTo({ top: 0 }); return; }
    if ((b = t.closest('.vid'))) { e.preventDefault(); abrirVideo(+b.dataset.v); return; }
    if ((b = t.closest('[data-v]')) && b.classList.contains('vid-row')) { abrirVideo(+b.dataset.v); return; }
    if ((b = t.closest('[data-reg]'))) { abrirRegistro(JSON.parse(b.dataset.reg)); return; }
    if ((b = t.closest('[data-nohacer]'))) { abrirNoHacer(JSON.parse(b.dataset.nohacer)); return; }
    if ((b = t.closest('[data-dch]'))) { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); return; }
    if ((b = t.closest('[data-surge]'))) { abrirSurge(b.dataset.surge); return; }
    if ((b = t.closest('[data-confirmar]'))) { abrirConfirmar(b.dataset.confirmar); return; }
    if ((b = t.closest('[data-nuevo-evento]'))) { abrirFormEvento(null, b.dataset.nuevoEvento); return; }
    if ((b = t.closest('[data-evento]'))) {
      var evx = (S.eventos || []).concat(S.data.eventos || []).filter(function (z) { return z.ID === b.dataset.evento; })[0];
      if (evx) abrirFormEvento(evx); return;
    }
    if ((b = t.closest('[data-cal-mes]'))) {
      var base = S.calMes || S.data.hoy.slice(0, 7), yy = +base.slice(0, 4), mm = +base.slice(5, 7) + Number(b.dataset.calMes);
      if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; }
      S.calMes = yy + '-' + (mm < 10 ? '0' : '') + mm; S.calDia = null; render(); return;
    }
    if ((b = t.closest('[data-cal-dia]'))) { S.calDia = b.dataset.calDia || null; render(); return; }
    if ((b = t.closest('[data-ver-prop]'))) { S.propuesta = b.dataset.verProp; S.vista = 'propuesta'; render(); window.scrollTo({ top: 0 }); return; }
    if ((b = t.closest('[data-prop-res]'))) {
      var apr = b.dataset.propRes === '1';
      if (!confirmar(b, apr ? '¿Aprobar? Toca otra vez' : '¿Rechazar? Toca otra vez')) return;
      b.disabled = true;
      api({ action: 'cambio_resolver', cambio: S.propuesta, aprobar: apr, ver: S.data.semana }).then(ok).then(function (r) {
        aplicarSemana(r.semana); S.vista = null; render(); toast(apr ? 'Cambios aprobados' : 'Propuesta rechazada: todo sigue como estaba');
      }).catch(falloApi(b));
      return;
    }
    if ((b = t.closest('[data-aprobar-plan]'))) {
      if (!confirmar(b, '¿Aprobar? Toca otra vez')) return;
      b.disabled = true;
      api({ action: 'plan_aprobar', lunes: S.data.semana }).then(ok).then(function (r) { aplicarSemana(r.semana); render(); toast(r.aprobados + ' bloques programados'); }).catch(falloApi(b));
      return;
    }
    if (t.closest('[data-ver-pend]')) { abrirAjustes('s-pend'); return; }
    if ((b = t.closest('[data-pend]'))) {
      if (!confirmar(b, '¿Seguro?')) return;
      b.disabled = true;
      api({ action: 'pendiente', id: b.dataset.pend, estado: b.dataset.est }).then(ok).then(function (r) { S.data.pendientes = r.pendientes; S._abrir = 's-pend'; render(); toast('Actualizado'); }).catch(falloApi(b));
      return;
    }
    if ((b = t.closest('[data-fase]'))) { abrirFase(+b.dataset.fase); return; }
    if ((b = t.closest('[data-tema]'))) { guardar('rte-tema', b.dataset.tema); aplicarTema(b.dataset.tema); S._abrir = 's-tema'; render(); return; }
    if (t.closest('[data-calc]')) { abrirHerramientas(); return; }
    if ((b = t.closest('[data-herr]'))) { if (b.dataset.herr === 'calc') { cerrarHoja(); toggleCalc(true); } else abrirTimerLibre(); return; }
    if (t.closest('[data-calc-cerrar]')) { toggleCalc(); return; }
    if ((b = t.closest('[data-lb]'))) { var lb = document.getElementById('calc-lb'); lb.value = b.dataset.lb; lb.oninput(); return; }
    if (t.closest('[data-instalar]')) { instalar(); return; }
    if (t.closest('[data-inst-cerrar]')) { guardar('rte-inst-cerrado', true); var bn = t.closest('.inst-banner'); if (bn) bn.remove(); return; }
    if ((b = t.closest('[data-video-url]'))) { abrirVideoUrl(b.dataset.videoNombre, b.dataset.videoUrl); return; }
    if ((b = t.closest('[data-desc-usar]'))) {
      var x = (S.desc || []).filter(function (z) { return String(z._fila) === b.dataset.descUsar; })[0];
      if (!x) return;
      if (x['CÓDIGO']) copiar(x['CÓDIGO'], 'Código ' + x['CÓDIGO'] + ' copiado: pégalo al pagar');
      var u = urlSegura(x.ENLACE); if (u) window.open(u, '_blank', 'noopener');
      return;
    }
    if ((b = t.closest('[data-desc-del]'))) {
      if (!confirmar(b, '¿Quitar?')) return;
      var dd = JSON.parse(b.dataset.descDel); b.disabled = true;
      api({ action: 'descuento_borrar', fila: dd.fila, coincide: dd.c }).then(ok).then(function (r) { S.desc = r.descuentos; pintarDescuentos(); toast('Quitado'); }).catch(falloApi(b));
      return;
    }
    if ((b = t.closest('[data-web-del]'))) {
      if (!confirmar(b, '¿Borrar?')) return;
      var dw = JSON.parse(b.dataset.webDel); b.disabled = true;
      api({ action: 'web_borrar', fila: dw.fila, coincide: dw.c }).then(ok).then(function (r) { S.webs = r.webs; pintarWebs(); toast('Quitada'); }).catch(falloApi(b));
      return;
    }
    if ((b = t.closest('[data-borrar-marca]'))) {
      if (!confirmar(b, '¿Borrar?')) return;
      var dm = JSON.parse(b.dataset.borrarMarca); b.disabled = true;
      api({ action: 'marca_borrar', fila: dm.fila, coincide: dm.c }).then(ok).then(function (r) {
        S.marcasFilas = r.marcas; prepararMarcas(r.marcas); S._abrir = 's-marcas'; render(); toast('Marca borrada');
      }).catch(falloApi(b));
    }
  });

  // ---------- siempre la última versión ----------
  var WEB_VERSION = 'web 0.3';
  var ultimaActividad = Date.now(), habiaControlador = !!(navigator.serviceWorker && navigator.serviceWorker.controller), recargando = false;
  function recargarApp() {
    if (recargando) return;
    if (!$scrim.hidden || (TM.run && !TM.run.fin)) { S.recargarAlCerrar = true; return; }
    recargando = true; location.reload();
  }
  function alVolver() {
    var parado = Date.now() - ultimaActividad > 5 * 60 * 1000;
    ultimaActividad = Date.now();
    guardar('rte-ultima', Date.now());
    if (!parado) return;
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration)
      navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update().catch(function () {}); });
    if (S.email && !S.cargando) cargar(S.data && S.data.semana);
  }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, alVolver, { passive: true, capture: true }); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') alVolver(); });
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', function () { if (habiaControlador) recargarApp(); habiaControlador = true; });

  // ---------- arranque ----------
  auth.onAuthStateChanged(function (u) {
    if (!u) { S.email = null; S.data = null; S.config = null; pantallaLogin(S.motivoSalida); S.motivoSalida = ''; return; }
    var email = String(u.email || '').toLowerCase();
    if (email !== CFG.emailPermitido) { S.motivoSalida = 'Esta app es privada. La cuenta ' + email + ' no tiene acceso.'; auth.signOut(); return; }
    var ultima = leer('rte-ultima');
    if (ultima && Date.now() - ultima > CFG.diasSesion * 864e5) { S.motivoSalida = 'La sesión ha caducado por inactividad. Vuelve a entrar.'; guardar('rte-ultima', Date.now()); auth.signOut(); return; }
    guardar('rte-ultima', Date.now());
    S.email = email;
    S.user = { nombre: 'Pablo', email: email, marcas: {} };
    S.videos = leer('rte-videos') || [];
    prepararVideos(S.videos);
    var c = leer('rte-cache');
    if (c && c.semana) {
      S.config = c.config; S.data = construirDatos(c.semana); S.dia = diaInicial(); S.aviso = 'Actualizando…';
      if (c.marcas) { S.marcasFilas = c.marcas; prepararMarcas(c.marcas); }
      render();
      S.config = null;   // fuerza «inicio» para refrescar también la configuración
    } else render();
    cargar();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
