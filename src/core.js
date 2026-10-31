/* Road To Elite · web · misma estructura que la app de Gabi (Fabrik Program), solo para Pablo.
 * Fabrik (solo lectura) + EXTRA de APP · PLAN + registro de lo realizado + marcas + cobertura + eventos + propuestas + timer y calculadora.
 * Partes reutilizadas de pComader/programapp: utilidades, %→kg, vídeos, variantes, marcas, calculadora, instalar, timer y hojas. */
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
        if (rb && rb['TÍTULO'] && norm(rb['TÍTULO']).replace(/\W+/g, '') !== norm(b.titulo).replace(/\W+/g, '')) b.refCambio = rb['TÍTULO'];
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
      // Días «antes» (bajar volumen) y «después» (recuperación) de cada evento: solo se señalan, no cambian el plan ni las metas.
      dd.fases = [];
      (sem.eventos || []).forEach(function (e) {
        var i = aIso(e.INICIO), f = aIso(e.FIN) || i, an = +e['ANTES (días bajar volumen)'] || 0, de = +e['DESPUÉS (días recuperación)'] || 0;
        if (!i) return;
        if (an && dd.iso < i && dd.iso >= sumarDias(i, -an)) { var n = Math.round((Date.parse(i) - Date.parse(dd.iso)) / 864e5); dd.fases.push({ tipo: 'Bajar volumen', txt: n + (n > 1 ? ' días' : ' día') + ' para ' + e.EVENTO + '. Calidad sí, volumen y fatiga accesoria no.' }); }
        if (de && dd.iso > f && dd.iso <= sumarDias(f, de)) dd.fases.push({ tipo: 'Recuperación', txt: 'Tras ' + e.EVENTO + ': suave, movilidad y Z2 corta.' });
      });
    });
    var propuestas = {};
    (sem.plan || []).forEach(function (r) { if (/^PROPUESTA/.test(norm(r.ESTADO)) && r.CAMBIO_ID) (propuestas[r.CAMBIO_ID] = propuestas[r.CAMBIO_ID] || []).push(r); });
    return { semana: sem.lunes, hoy: sem.hoy, ciclo: fab ? fab.ciclo : cicloPara(S.ciclo || leer('rte-ciclo'), sem.lunes), dias: dias,
      erratas: sem.erratasFabrik || [], registro: sem.registro || [], plan: sem.plan || [], borrador: plan.some(function (r) { return norm(r.ESTADO) === 'BORRADOR'; }),
      misMarcas: S.misMarcas || [], hayFabrik: !!fab, eventos: sem.eventos || [], conf: sem.conf, confSiguiente: sem.confSiguiente,
      pendientes: sem.pendientes || [], cambios: sem.cambios || [], propuestas: propuestas, carrera: sem.carrera || [], metas: sem.metas || null, chequeos: sem.chequeos || [], push: !!sem.push, fabrikCambios: sem.fabrikCambios || [] };
  }
  /** Aplica la respuesta del servidor (acciones que devuelven la semana) sin perder el día abierto. */
  function aplicarSemana(sem) { if (!sem) return; var dia = S.dia; S.cobertura = null; S.data = construirDatos(sem); S.dia = dia; guardar('rte-cache', { config: S.config, semana: sem, marcas: S.marcasFilas || null }); guardarSemanaLocal(sem); }

  // ---------- sin conexión: copia de cada semana en el móvil y cola de lo que guardas ----------
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hoyLocal() { var t = new Date(); return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()); }
  function lunesIso(iso) { var dow = new Date(iso + 'T12:00:00Z').getUTCDay(); return sumarDias(iso, -((dow + 6) % 7)); }
  function guardarSemanaLocal(sem) {
    if (!sem || !sem.lunes) return;
    guardar('rte-sem-' + sem.lunes, { t: Date.now(), sem: sem });
    var idx = [sem.lunes].concat((leer('rte-semidx') || []).filter(function (l) { return l !== sem.lunes; }));
    idx.slice(6).forEach(function (l) { try { localStorage.removeItem('rte-sem-' + l); } catch (e) {} });
    guardar('rte-semidx', idx.slice(0, 6));
  }
  function semanaLocal(lunes) { var c = leer('rte-sem-' + lunes); return c && c.sem ? c : null; }
  function conHoyLocal(sem) { var h = hoyLocal(); if (!sem.hoy || h > sem.hoy) sem.hoy = h; return sem; }
  function horaCorta(t) { var d = new Date(t); return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  /** Pinta una semana guardada (sin conexión o mientras llega la versión nueva). */
  function pintarCopia(lunes, aviso) {
    var c = semanaLocal(lunes);
    if (!c) return false;
    var dia = S.data && S.data.semana === lunes ? S.dia : null;
    S.data = construirDatos(conHoyLocal(c.sem));
    S.dia = dia == null ? diaInicial() : dia;
    S.aviso = aviso ? aviso + ' · copia del ' + horaCorta(c.t) : '';
    render();
    return true;
  }
  function esFalloRed(e) { return !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network|internet/i.test(String(e && e.message || e)); }
  /** Guardar con red si hay; sin red, a la cola (se envía sola al volver la conexión). */
  function uid() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  /** Guarda en el navegador; si la memoria está llena, borra copias de semanas antiguas y lo reintenta. */
  function guardarSeguro(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) {}
    var actual = lunesIso(hoyLocal()), sig = sumarDias(actual, 7);
    (leer('rte-semidx') || []).forEach(function (l) { if (l !== actual && l !== sig) { try { localStorage.removeItem('rte-sem-' + l); } catch (x) {} } });
    try { localStorage.removeItem('rte-videos'); localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  /**
   * Guardar con red si hay; sin red, a la cola. Cada operación lleva un «op» único que se conserva en los reintentos:
   * el servidor no repite una operación que ya procesó (aunque el móvil no recibiera la respuesta).
   */
  function apiGuardar(cuerpo) {
    if (!cuerpo.op) cuerpo.op = uid();
    var limpio = JSON.parse(JSON.stringify(cuerpo));
    var aCola = function () {
      var c = leer('rte-cola') || []; delete limpio.idToken; c.push({ t: Date.now(), cuerpo: limpio });
      if (!guardarSeguro('rte-cola', c)) throw new Error('memoria_llena');
      pintarPendientes();
      return { ok: true, cola: true, registro: limpio.registro, chequeo: limpio.chequeo };
    };
    if (!navigator.onLine) return Promise.resolve().then(aCola);
    return api(cuerpo).catch(function (e) { if (esFalloRed(e)) return aCola(); throw e; });
  }
  var ERR_SESION = { sesion_caducada: 1, sin_sesion: 1, no_autorizado: 1 };
  /**
   * Envía la cola en orden. Sin red o con la sesión caducada se para y CONSERVA lo pendiente.
   * Si el servidor rechaza los datos, la operación pasa a «con error» (visible para corregirla o descartarla), nunca se borra en silencio.
   */
  function vaciarCola() {
    if (S._vaciando || !navigator.onLine || !auth.currentUser || !(leer('rte-cola') || []).length) return;
    S._vaciando = true;
    var n = 0, fallos = 0;
    var fin = function () {
      S._vaciando = false; pintarPendientes();
      if (n || fallos) { toast((n ? n + ' enviado' + (n > 1 ? 's' : '') : '') + (fallos ? (n ? ' · ' : '') + fallos + ' con error: revísalo en «pendientes de enviar»' : '')); if (n) cargar(S.data && S.data.semana); }
    };
    (function sig() {
      var c = leer('rte-cola') || [];
      if (!c.length) return fin();
      api(JSON.parse(JSON.stringify(c[0].cuerpo))).then(function (r) {
        if (!r.ok && ERR_SESION[r.error]) return fin();            // se queda en la cola: se envía al volver a entrar
        var c2 = leer('rte-cola') || [], x = c2.shift();
        if (r.ok) n++;
        else { fallos++; var er = leer('rte-cola-err') || []; er.push({ t: x.t, cuerpo: x.cuerpo, error: r.detalle || r.error }); guardarSeguro('rte-cola-err', er); }
        guardarSeguro('rte-cola', c2); sig();
      }).catch(function () { fin(); });                             // sigue sin red: se reintenta luego
    })();
  }
  function nPendientes() { return (leer('rte-cola') || []).length + (leer('rte-cola-err') || []).length; }
  function pintarPendientes() { var b = document.getElementById('cola-btn'), n = nPendientes(); if (b) { b.hidden = !n; b.querySelector('b').textContent = n; b.classList.toggle('err', !!(leer('rte-cola-err') || []).length); } }
  var NOMBRE_OP = { registrar: 'Registro', carrera: 'Carrera', chequeo: 'Chequeo', marca: 'Marca' };
  function abrirCola() {
    var c = leer('rte-cola') || [], er = leer('rte-cola-err') || [];
    var fila = function (x, i, conError) {
      var b = x.cuerpo, q = b.registro || b.carrera || b.chequeo || b.marca || {};
      return '<div class="pr-row cola-row"><span>' + horaCorta(x.t) + '</span><b>' + esc(NOMBRE_OP[b.action] || b.action) + ' · ' + esc(q.BLOQUE || q['SESIÓN'] || q.MOVIMIENTO || q.FECHA || '') + '</b>' +
        (conError ? '<span class="hint err">' + esc(x.error || '') + '</span><span class="grow"></span><button class="btn-ghost sm" type="button" data-cola-re="' + i + '">Reintentar</button><button class="btn-ghost sm" type="button" data-cola-del="' + i + '">Descartar</button>' : '') + '</div>';
    };
    abrirHoja('<div class="row"><h2>Pendientes de enviar</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      (c.length ? '<div class="part-lbl">En cola (' + c.length + ')</div><div class="hint">Se envían solos cuando hay conexión y sesión abierta.</div><div class="pr-list">' + c.map(function (x, i) { return fila(x, i, false); }).join('') + '</div>' +
        '<button class="btn btn-primary" type="button" id="cola-ya">Enviar ahora</button>' : '') +
      (er.length ? '<div class="part-lbl">Con error (' + er.length + ')</div><div class="hint">El servidor no los aceptó. Reintenta o descártalos; nada se borra solo.</div><div class="pr-list">' + er.map(function (x, i) { return fila(x, i, true); }).join('') + '</div>' : '') +
      (!c.length && !er.length ? '<div class="hint">Nada pendiente.</div>' : ''));
    var ya = document.getElementById('cola-ya'); if (ya) ya.onclick = function () { cerrarHoja(); vaciarCola(); };
    $scrim.querySelectorAll('[data-cola-re],[data-cola-del]').forEach(function (b) {
      b.onclick = function () {
        var l = leer('rte-cola-err') || [], i = +(b.dataset.colaRe || b.dataset.colaDel), x = l.splice(i, 1)[0];
        guardarSeguro('rte-cola-err', l);
        if (x && b.dataset.colaRe != null) { var c2 = leer('rte-cola') || []; c2.push({ t: x.t, cuerpo: x.cuerpo }); guardarSeguro('rte-cola', c2); vaciarCola(); }
        cerrarHoja(); pintarPendientes(); if (nPendientes()) abrirCola();
      };
    });
  }
  window.addEventListener('online', function () { vaciarCola(); if (S.email) cargar(S.data && S.data.semana); });
  function precargarSiguiente(lunes) {
    var sig = sumarDias(lunes, 7), c = semanaLocal(sig);
    if (c && Date.now() - c.t < 6 * 36e5) return;
    api({ action: 'semana', semana: sig }).then(function (r) { if (r.ok) guardarSemanaLocal(r.semana); }).catch(function () {});
  }
  /** Borra del navegador todo lo de la app (al cerrar sesión). Solo se queda el tema elegido. */
  function salir() { borrarLocal(); auth.signOut(); }
  function borrarLocal() {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('rte-') === 0 && k !== 'rte-tema') localStorage.removeItem(k); }); } catch (e) {}
  }

  function cargar(semana) {
    S.cargando = true;
    var primera = !S.config;
    return api({ action: primera ? 'inicio' : 'semana', semana: semana || null }).then(function (res) {
      S.cargando = false;
      if (!res.ok) {
        if (res.error === 'no_autorizado' || res.error === 'sesion_caducada' || res.error === 'sin_sesion') { salir(); return; }
        S.aviso = 'No se pudo cargar (' + (res.detalle || res.error) + ').';
        return render();
      }
      if (res.config) S.config = res.config;
      var antes = S.data && S.data.semana;
      S.data = construirDatos(res.semana); S.ultimaCarga = Date.now(); S.aviso = '';
      prepararVideos(S.videos);
      if (antes !== S.data.semana || !semana) S.dia = diaInicial();
      guardar('rte-cache', { config: S.config, semana: res.semana, marcas: S.marcasFilas || null });
      guardarSemanaLocal(res.semana);
      render();
      vaciarCola();
      if (!semana || semana === lunesIso(res.semana.hoy)) precargarSiguiente(res.semana.lunes);
      if (!S.marcasFilas) api({ action: 'marcas' }).then(function (r) { if (r.ok) { S.marcasFilas = r.marcas; prepararMarcas(r.marcas); render(); } });
      if (!S.videos || !S.videos.length) api({ action: 'videos' }).then(function (r) { if (r.ok) { S.videos = r.videos; guardar('rte-videos', r.videos); prepararVideos(S.videos); render(); } });
    }).catch(function (e) {
      S.cargando = false;
      if (esFalloRed(e) && pintarCopia(semana || lunesIso(hoyLocal()), 'Sin conexión')) return;
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
        document.getElementById('salir2').onclick = function () { salir(); };
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
    var lbl = fechaCorta(d.dias[0].iso) + ' – ' + fechaCorta(d.dias[6].iso);
    return '<header class="top"><div class="weeknav">' +
      '<button class="icon-btn" id="prev" type="button" aria-label="Semana anterior">‹</button>' +
      '<span class="lbl">' + esc(lbl) + '</span>' +
      '<button class="icon-btn" id="next" type="button" aria-label="Semana siguiente">›</button>' +
      ((d.semana !== lunesIso(d.hoy) || d.dias[S.dia].iso !== d.hoy) ? '<button class="hoy-btn" id="ir-hoy" type="button">Hoy</button>' : '') +
      '</div>' + '<button class="cola-btn" id="cola-btn" type="button" aria-label="Pendientes de enviar"' + (nPendientes() ? '' : ' hidden') + '>⟳ <b>' + nPendientes() + '</b></button>' + miniAnillo(d) + botonCalc() + '<button class="who" id="perfil" type="button" aria-label="Menú">P</button></header>';
  }

  /** Cobertura de la semana en la cabecera: programado (anillo) · toca para ver las metas. */
  function miniAnillo(d) {
    var m = d.metas && d.metas.semana;
    if (!m || !m.total) return '';
    var p = Math.round(m.pctProg * 100), r = 13, c = 2 * Math.PI * r;
    return '<button class="mini-ring" id="cob-mini" type="button" aria-label="Cobertura de la semana ' + p + '%">' +
      '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="' + r + '" class="ring-bg"/><circle cx="16" cy="16" r="' + r + '" class="ring-fg' + (p >= 100 ? ' full' : '') +
      '" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><b>' + p + '</b></button>';
  }
  function enlazarCabecera() {
    var d = S.data;
    var ir = function (l) { if (!pintarCopia(l, navigator.onLine ? 'Actualizando…' : 'Sin conexión')) { S.aviso = 'Cargando…'; render(); } if (navigator.onLine) cargar(l); };
    document.getElementById('prev').onclick = function () { ir(sumarDias(d.semana, -7)); };
    document.getElementById('next').onclick = function () { ir(sumarDias(d.semana, 7)); };
    document.getElementById('perfil').onclick = function () { abrirAjustes(); };
    var hoyB = document.getElementById('ir-hoy');
    if (hoyB) hoyB.onclick = function () { var l = lunesIso(d.hoy); if (l === d.semana) { S.dia = diaInicial(); render(); window.scrollTo({ top: 0 }); } else ir(l); };
    var cb = document.getElementById('cola-btn'); if (cb) { cb.onclick = abrirCola; pintarPendientes(); }
    var mr = document.getElementById('cob-mini');
    if (mr) mr.onclick = function () { S.vista = 'cobertura'; S.cobTab = 'semana'; render(); window.scrollTo({ top: 0 }); };
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

  // ---------- chequeo de la mañana (APP · CHEQUEO) ----------
  function chequeoDe(d, iso) { return (d.chequeos || []).filter(function (c) { return aIso(c.FECHA) === iso; })[0] || null; }
  function htmlChequeo(d, x) {
    var c = chequeoDe(d, x.iso);
    if (c) {
      var sem = c['SEMÁFORO'] || '', cls = { Verde: 'ok', 'Ámbar': 'warn', Rojo: 'no' }[sem] || '';
      return '<button class="chq ' + cls + '" type="button" data-chequeo="' + x.iso + '"><span class="chq-t"><b>' + (sem ? 'Semáforo ' + esc(sem.toLowerCase()) : 'Chequeo') + '</b>' +
        (c['LISTO (0-100)'] ? '<span class="chq-n">' + esc(c['LISTO (0-100)']) + '/100</span>' : '') + '</span><span class="chq-r">' + esc(c['RECOMENDACIÓN'] || '') + '</span></button>';
    }
    if (x.iso !== d.hoy) return '';
    return '<button class="chq pend" type="button" data-chequeo="' + x.iso + '"><span class="chq-t"><b>☀️ Chequeo de la mañana</b><span class="chq-n">30 s</span></span>' +
      '<span class="chq-r">Sueño, energía, molestias y VFC del Garmin. Decide si hoy van la Z6–Z8 y la calidad.</span></button>';
  }

  // ---------- cuenta atrás a los tests (APP · CONFIG) ----------
  /** Tests y competiciones próximos: salen de APP · EVENTOS (una sola fuente); si no están ahí, de APP · CONFIG. */
  function htmlCuentaAtras(d) {
    var c = S.config || {}, out = '', vistos = {};
    (d.eventos || []).filter(function (e) { return /^test\b/i.test(e.EVENTO || '') || /Competición|HYROX/.test(e.TIPO || ''); }).forEach(function (e) {
      var ini = aIso(e.INICIO), fin = aIso(e.FIN) || ini;
      if (!ini || fin < d.hoy) return;
      vistos[norm(e.EVENTO)] = 1;
      var n = Math.round((Date.parse(ini) - Date.parse(d.hoy)) / 864e5);
      if (n > 35) return;
      out += '<div class="countdown"><div class="cd-txt"><span class="lbl">' + esc(/^test/i.test(e.EVENTO) ? 'Test · semana del ' + fechaCorta(ini) : (e.TIPO || 'Evento') + ' · ' + fechaCorta(ini)) + '</span><b>' + esc(e.EVENTO) + '</b></div>' +
        '<span class="cd">' + (n > 1 ? 'faltan ' + n + ' días' : n === 1 ? 'mañana' : ini === d.hoy || fin !== ini ? 'esta semana' : 'hoy') + '</span></div>';
    });
    [['test_2km', 'Test 2 km'], ['test_10km', 'Test 10 km']].forEach(function (t) {
      if (vistos[norm(t[1])]) return;
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
    html += htmlChequeo(d, x);
    var fc = (d.fabrikCambios || []).filter(function (c) { return x.fabrik && norm(c.dia) === norm(x.fabrik); })[0];
    if (fc) html += '<div class="unpub warn">⚠ Fabrik ' + (fc.nuevo ? 'ha subido este día' : 'ha cambiado este día') + ' después de aprobar la semana' + (fc.aprobado ? ' (' + esc(fc.aprobado) + ')' : '') + '. Revisa si choca con tus extras; si hace falta, «Ha surgido algo».</div>';
    html += (x.fases || []).map(function (f) { return '<div class="variant-note fase"><span class="v-tag">' + esc(f.tipo) + '</span><span>' + esc(f.txt) + '</span></div>'; }).join('');
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
    }).join('') + (x.variantesExtra || []).map(bloqueExtra).join('') + '</div>' +
      (x.iso >= sumarDias(d.hoy, -1) ? '<button class="add-blk" type="button" data-nuevo-bloque="' + x.iso + '">＋ Añadir bloque <span>(entra en borrador)</span></button>' : '');
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
    if (b.refCambio) tagEst += '<div class="b-state warn">⚠ Este hueco de Fabrik era «' + esc(b.refCambio) + '» cuando se programó: el orden ha cambiado. Revisa el bloque antes de entrenar.</div>';
    var chq = chequeoDe(d, x.iso);
    if (chq && /Ámbar|Rojo/.test(chq['SEMÁFORO']) && (/Z6|CALIDAD|Z4|Z5/.test(norm(b.origen + ' ' + b.titulo + ' ' + (b.codigos || ''))) || /R01|R02|R03|W04/.test(b.codigos || '')))
      tagEst += '<div class="b-state ' + (chq['SEMÁFORO'] === 'Rojo' ? 'no' : 'warn') + '">Semáforo ' + esc(chq['SEMÁFORO'].toLowerCase()) + ' hoy: ' + esc(String(chq['RECOMENDACIÓN'] || '').split('. ')[0]) + '.</div>';
    var accExtra = b.extra && !/^PROPUESTA/.test(est) ? '<div class="b-acc">' + (est === 'BORRADOR' ? '<button type="button" class="btn-ghost sm" data-borrar-bloque="' + esc(b.id) + '">Quitar borrador</button>' : '') +
      '<button type="button" class="btn-ghost sm" data-plantilla="' + esc(b.id) + '">☆ Guardar como plantilla</button></div>' : '';
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
      accExtra + filaRegistro(d, x, b) +
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
    var dato = esc(JSON.stringify({ iso: x.iso, id: idPlanDe(x, b), bloque: (b.extra ? 'EXTRA · ' : b.n + ': ') + b.titulo, run: esCarrera(b), tipo: tipoCarrera(b.titulo + ' ' + (b.intensidad || '') + ' ' + (b.origen || '')) }));
    var cr = carreraDe(x.iso, idPlanDe(x, b));
    var off = /NO HACER|PROPUESTA/.test(norm(b.estado));
    var nh = esc(JSON.stringify({ id: idPlanDe(x, b), fecha: x.iso, titulo: b.titulo, turno: b.turno, orden: b.orden, ref: b.extra ? '' : (b.fabrikDia || x.nombre) + '·' + b.n }));
    if (cr) est += '<span class="vb-v run">🏃 ' + esc(cr['DISTANCIA (km)'] || '') + (cr['DISTANCIA (km)'] ? ' km' : '') + (cr['RITMO MEDIO (/km)'] ? ' · ' + esc(cr['RITMO MEDIO (/km)']) + '/km' : '') + (cr['FC MEDIA'] ? ' · ' + esc(cr['FC MEDIA']) + ' ppm' : '') + '</span>';
    var rapido = !r && !off && x.iso <= d.hoy ? '<button type="button" class="btn-ghost sm ok1" data-hecho="' + dato + '" aria-label="Marcar como hecho tal cual">✔ Hecho</button>' : '';
    if (rapido) est = '';
    if (r && !r.RPE && r.HECHO !== 'No' && x.iso <= d.hoy && x.iso >= sumarDias(d.hoy, -1)) {
      var chips = ''; for (var k = 1; k <= 10; k++) chips += '<button type="button" class="rpe-chip sm" style="--c:' + rpeColor(String(k)) + '" data-rpe-rap="' + k + '">' + k + '</button>';
      est += '<span class="rpe-rap" data-rpe-blq="' + dato + '"><span class="hint">RPE</span>' + chips + '</span>';
    }
    return '<div class="reg-row">' + est + '<span class="grow"></span>' + (off || r ? '' : '<button type="button" class="btn-ghost sm" data-nohacer="' + nh + '">No hacer</button>') + rapido +
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
      htmlCamposCarrera(carreraDe(ref.iso, ref.id) || {}, !!ref.run, ref.tipo) +
      '<details class="run-f"><summary>🏆 Nueva marca en este bloque</summary><div class="exp-body">' +
        '<datalist id="rg-movs">' + LEVANTAMIENTOS.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist>' +
        '<label for="rg-pm">Movimiento o test</label><input id="rg-pm" list="rg-movs" maxlength="60" placeholder="Ej. SNATCH, Test 2 km">' +
        '<div class="two"><div><label for="rg-pt">Tipo</label><select id="rg-pt">' + ['1RM', '3RM', '5RM', 'Tiempo', 'Reps', 'Distancia'].map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>' +
        '<div><label for="rg-pv">Valor</label><input id="rg-pv" maxlength="20" placeholder="kg · mm:ss · reps"></div></div>' +
        '<div class="hint">Se añade a tus marcas al guardar y los kilos de la pizarra se recalculan.</div></div></details>' +
      '<div class="two-btn">' + (r.FECHA ? '<button class="btn" type="button" id="rg-del">Borrar</button>' : '') +
      '<button class="btn btn-primary" type="submit" id="rg-ok">Guardar</button></div></form>');
    $scrim.querySelectorAll('[data-rh]').forEach(function (bt) { bt.onclick = function () { $scrim.querySelectorAll('[data-rh]').forEach(function (y) { y.setAttribute('aria-pressed', String(y === bt)); }); }; });
    enlazarCamposCarrera();
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
      var car = leerCamposCarrera(); car.FECHA = reg.FECHA; car.ID_PLAN = ref.id; car['SESIÓN'] = ref.bloque.replace(/^EXTRA · /, ''); car.RPE = reg.RPE;
      var pm = val('rg-pm').toUpperCase(), pv = val('rg-pv'), pt = val('rg-pt');
      var marca = pm && pv ? { FECHA: reg.FECHA, MOVIMIENTO: pm, TIPO: pt, VALOR: pv.replace(',', '.'), UNIDAD: /RM$/.test(pt) ? 'kg' : { Tiempo: 'min:seg', Reps: 'reps', Distancia: 'm' }[pt], EVENTO: ref.bloque, NOTAS: 'Desde el registro del bloque' } : null;
      apiGuardar({ action: 'registrar', registro: reg }).then(ok).then(function (res) {
        S.data.registro = S.data.registro.filter(function (y) { return !(y.FECHA === reg.FECHA && y.ID_PLAN === reg.ID_PLAN); }).concat([res.registro]);
        return hayDatosCarrera(car) ? guardarCarreraApi(car) : null;
      }).then(function () {
        if (!marca) return null;
        return apiGuardar({ action: 'marca', marca: marca }).then(ok).then(function (r) {
          if (r.marcas) { S.marcasFilas = r.marcas; prepararMarcas(r.marcas); }
          else { S.marcasFilas = (S.marcasFilas || []).concat([marca]); prepararMarcas(S.marcasFilas); }
          toast('🏆 Marca añadida: ' + pm + ' ' + pv);
        });
      }).then(function () { cerrarHoja(); render(); toast(!navigator.onLine ? 'Guardado sin conexión: se enviará al volver' : hayDatosCarrera(car) ? 'Guardado · carrera analizada' : 'Guardado'); }).catch(falloApi(b));
    };
  }


  // ---------- registro de carrera detallado (APP · CARRERA, datos del Garmin) ----------
  var TIPOS_CARRERA = ['Z2', 'Z2 larga', 'Z4 umbral', 'Z5 VO2max', 'Z6–Z8', 'Test 2 km', 'Test 10 km', 'Recuperación', 'HYROX', 'Otra'];
  function esCarrera(b) {
    var t = norm((b.titulo || '') + ' ' + (b.codigos || ''));
    return norm(b.origen) === 'CARRERA' || (b.extra && /\b(Z2|RODAJE|CARRERA|RUN|UMBRAL|FARTLEK|TEMPO|SERIES|TEST 2|TEST 10|PISTA)\b/.test(t));
  }
  function tipoCarrera(txt) {
    var t = norm(txt || '');
    if (/TEST 2/.test(t)) return 'Test 2 km'; if (/TEST 10/.test(t)) return 'Test 10 km';
    if (/Z6|Z7|Z8|RSA|SPRINT/.test(t)) return 'Z6–Z8'; if (/Z5|VO2/.test(t)) return 'Z5 VO2max'; if (/Z4|UMBRAL|TEMPO/.test(t)) return 'Z4 umbral';
    if (/LARGA|LONG/.test(t)) return 'Z2 larga'; if (/Z2|RODAJE/.test(t)) return 'Z2'; if (/HYROX/.test(t)) return 'HYROX'; if (/RECUP/.test(t)) return 'Recuperación';
    return '';
  }
  function carreraDe(iso, idPlan) {
    var f = aTxt(iso);
    return (S.data.carrera || []).filter(function (r) { return (r.FECHA === f || aIso(r.FECHA) === iso) && (idPlan ? r.ID_PLAN === idPlan : !r.ID_PLAN); })[0] || null;
  }
  function htmlCamposCarrera(c, abierto, tipoDef) {
    var sel = function (id, v, l) { return '<select id="' + id + '"><option value=""></option>' + l.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>'; };
    var cum = c['PARCIALES CUMPLIDOS'] || '';
    return '<details class="run-f"' + (abierto ? ' open' : '') + '><summary>🏃 Datos de carrera (Garmin)</summary><div class="exp-body">' +
      '<div class="two"><div><label for="ca-t">Tipo</label>' + sel('ca-t', c.TIPO || tipoDef || '', TIPOS_CARRERA) + '</div>' +
      '<div><label for="ca-km">Distancia (km)</label><input id="ca-km" inputmode="decimal" value="' + esc(c['DISTANCIA (km)'] || '') + '" placeholder="8,2"></div></div>' +
      '<div class="two"><div><label for="ca-ti">Tiempo</label><input id="ca-ti" value="' + esc(c.TIEMPO || '') + '" placeholder="45:30 o 1:02:10"></div>' +
      '<div><label for="ca-ri">Ritmo medio /km</label><input id="ca-ri" value="' + esc(c['RITMO MEDIO (/km)'] || '') + '" placeholder="se calcula solo"></div></div>' +
      '<div class="three"><div><label for="ca-fc">FC media</label><input id="ca-fc" inputmode="numeric" value="' + esc(c['FC MEDIA'] || '') + '"></div>' +
      '<div><label for="ca-fm">FC máx</label><input id="ca-fm" inputmode="numeric" value="' + esc(c['FC MÁX'] || '') + '"></div>' +
      '<div><label for="ca-fe">FC estable (min)</label><input id="ca-fe" inputmode="decimal" value="' + esc(c['FC ESTABLE (min)'] || '') + '" title="Minuto en que el pulso se estabiliza"></div></div>' +
      '<label for="ca-pk">Parciales por km</label><textarea id="ca-pk" rows="2" placeholder="5:32 · 5:30 · 5:28 · 5:29 …">' + esc(c['PARCIALES POR KM'] || '') + '</textarea>' +
      '<label for="ca-se">Series (tiempos y recuperaciones)</label><textarea id="ca-se" rows="2" placeholder="4×1 km: 4:28 · 4:26 · 4:27 · 4:25 (rec 2′)">' + esc(c['SERIES (tiempos)'] || '') + '</textarea>' +
      '<label>¿Parciales cumplidos?</label><div class="seg" role="group" id="ca-cu">' + ['Sí', 'Parcial', 'No'].map(function (h) {
        return '<button type="button" data-cu="' + h + '" aria-pressed="' + (h === cum) + '">' + h + '</button>'; }).join('') + '</div>' +
      '<div class="three"><div><label for="ca-cad">Cadencia</label><input id="ca-cad" inputmode="numeric" value="' + esc(c.CADENCIA || '') + '"></div>' +
      '<div><label for="ca-des">Desnivel (m)</label><input id="ca-des" inputmode="numeric" value="' + esc(c['DESNIVEL (m)'] || '') + '"></div>' +
      '<div><label for="ca-tem">Temp. (°C)</label><input id="ca-tem" inputmode="numeric" value="' + esc(c['TEMPERATURA (°C)'] || '') + '"></div></div>' +
      '<label for="ca-su">Superficie</label>' + sel('ca-su', c.SUPERFICIE || '', ['Asfalto', 'Pista', 'Tierra', 'Cinta', 'Mixta']) +
      '<label for="ca-sen">Sensaciones</label><input id="ca-sen" maxlength="300" value="' + esc(c.SENSACIONES || '') + '" placeholder="Piernas, respiración, pulso…">' +
      '</div></details>';
  }
  function enlazarCamposCarrera() {
    $scrim.querySelectorAll('[data-cu]').forEach(function (bt) { bt.onclick = function () {
      var ya = bt.getAttribute('aria-pressed') === 'true';
      $scrim.querySelectorAll('[data-cu]').forEach(function (y) { y.setAttribute('aria-pressed', 'false'); }); if (!ya) bt.setAttribute('aria-pressed', 'true'); }; });
  }
  function leerCamposCarrera() {
    var cu = $scrim.querySelector('[data-cu][aria-pressed="true"]');
    return { TIPO: val('ca-t'), 'DISTANCIA (km)': val('ca-km').replace('.', ','), TIEMPO: val('ca-ti'), 'RITMO MEDIO (/km)': val('ca-ri'), 'FC MEDIA': val('ca-fc'), 'FC MÁX': val('ca-fm'),
      'FC ESTABLE (min)': val('ca-fe'), 'PARCIALES POR KM': val('ca-pk'), 'SERIES (tiempos)': val('ca-se'), 'PARCIALES CUMPLIDOS': cu ? cu.dataset.cu : '', CADENCIA: val('ca-cad'),
      'DESNIVEL (m)': val('ca-des'), 'TEMPERATURA (°C)': val('ca-tem'), SUPERFICIE: val('ca-su'), SENSACIONES: val('ca-sen') };
  }
  function hayDatosCarrera(c) { return !!(c['DISTANCIA (km)'] || c.TIEMPO || c['FC MEDIA'] || c['SERIES (tiempos)'] || c['PARCIALES POR KM']); }
  function guardarCarreraApi(c) {
    return apiGuardar({ action: 'carrera', carrera: c }).then(ok).then(function (r) {
      S.analisis = r.analisis || null;
      S.data.carrera = (S.data.carrera || []).filter(function (y) { return !(y.FECHA === c.FECHA && (y.ID_PLAN || '') === (c.ID_PLAN || '')); }).concat([c]);
      return r;
    });
  }
  /** Carrera suelta (sin bloque del plan), desde Cobertura › Carrera. */
  function abrirCarrera(ref) {
    var c = ref.id ? (carreraDe(ref.iso, ref.id) || {}) : {};
    abrirHoja('<div class="row"><h2>Registrar carrera</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<form id="caf" class="avf"><div class="two"><div><label for="ca-f">Fecha</label><input id="ca-f" type="date" value="' + esc(ref.iso) + '"></div>' +
      '<div><label for="ca-n">Sesión</label><input id="ca-n" maxlength="120" value="' + esc(c['SESIÓN'] || ref.bloque || '') + '" placeholder="Z2 suave"></div></div>' +
      htmlCamposCarrera(c, true, '') + '<label>RPE</label><input id="ca-rpe" inputmode="numeric" value="' + esc(c.RPE || '') + '">' +
      '<button class="btn btn-primary" type="submit" id="ca-ok">Guardar</button></form>');
    enlazarCamposCarrera();
    document.getElementById('caf').onsubmit = function (ev) {
      ev.preventDefault();
      var o = leerCamposCarrera(); o.FECHA = aTxt(val('ca-f')); o['SESIÓN'] = val('ca-n'); o.ID_PLAN = ref.id || ''; o.RPE = val('ca-rpe');
      o.ID = c.ID || ref.idCarrera || (ref.idCarrera = 'c' + uid());          // mismo ID en cada reintento: no se duplica
      if (!hayDatosCarrera(o)) { toast('Pon al menos distancia, tiempo o FC'); return; }
      var b = document.getElementById('ca-ok'); b.disabled = true;
      guardarCarreraApi(o).then(function () { cerrarHoja(); render(); toast('Carrera guardada · análisis actualizado'); }).catch(falloApi(b));
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

  // ---------- apariencia, cabecera de vistas y errores (antes en el menú) ----------
  var TEMAS = { oscuro: 'Oscuro', claro: 'Claro', auto: 'Automático' };
  function aplicarTema(t) {
    var r = document.documentElement;
    if (t === 'claro') r.setAttribute('data-theme', 'light');
    else if (t === 'oscuro') r.setAttribute('data-theme', 'dark');
    else r.removeAttribute('data-theme');
  }
  aplicarTema(leer('rte-tema') || 'oscuro');
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.instalar = e; });
  function volverSemana() { S.vista = null; render(); window.scrollTo({ top: 0 }); }
  function cabeceraVista(titulo, atras) {
    return '<header class="top"><button class="btn-ghost" type="button" id="atras">‹ ' + esc(atras) + '</button>' +
      '<span class="view-title">' + esc(titulo) + '</span>' + botonCalc() + '</header>';
  }
  function urlSegura(u) { return /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''; }
  function mensajeError(m) {
    return { marca_incompleta: 'Falta el movimiento o el valor.', registro_incompleto: 'Falta la fecha o el bloque.', rpe_no_valido: 'El RPE va del 1 al 10.',
      la_fila_ha_cambiado: 'La hoja ha cambiado: recarga e inténtalo otra vez.', no_encontrado: 'Ya no existe.', no_autorizado: 'Cuenta no autorizada.',
      sesion_caducada: 'La sesión ha caducado: vuelve a entrar.', eventos_sin_decidir: 'Decide cómo proceder con cada evento antes de confirmar.',
      evento_incompleto: 'Pon nombre y fecha al evento.', falta_evento: 'Escribe qué ha surgido.', faltan_datos: 'Faltan datos del bloque.', memoria_llena: 'La memoria del navegador está llena: no se pudo guardar sin conexión.', modulo_no_disponible: 'Sin conexión: esta parte aún no se ha descargado.', solo_borrador: 'Solo se pueden quitar bloques en borrador.', token_no_valido: 'No se pudo registrar el dispositivo.', meta_incompleta: 'Pon el estímulo y el ámbito.', falta_fecha: 'Falta la fecha.' }[m] || ('No se pudo guardar' + (m ? ' (' + m + ')' : '') + '. Revisa la conexión.');
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

  // ---------- módulos con carga diferida: el menú y el timer se descargan después de pintar la semana ----------
  var MODS = { menu: 'm-menu.js', timer: 'm-timer.js' }, MOD_P = {};
  function cargarMod(m) {
    if (!MOD_P[m]) MOD_P[m] = new Promise(function (bien, mal) {
      var s = document.createElement('script');
      s.src = MODS[m] + '?v=' + encodeURIComponent(WEB_VERSION);
      s.onload = function () { bien(); };
      s.onerror = function () { delete MOD_P[m]; mal(new Error('modulo_no_disponible')); };
      document.head.appendChild(s);
    });
    return MOD_P[m];
  }
  /** Devuelve una función que carga el módulo la primera vez y luego llama a la de verdad (que sustituye a esta). */
  function perezoso(m, nombre) {
    return function () {
      var a = arguments;
      return cargarMod(m).then(function () { return window[nombre].apply(null, a); })
        .catch(function (e) { toast(mensajeError(e && e.message)); });
    };
  }
  var abrirAjustes = perezoso('menu', 'abrirAjustes'), renderAjustes = perezoso('menu', 'renderAjustes'), renderCobertura = perezoso('menu', 'renderCobertura'),
    renderCalendario = perezoso('menu', 'renderCalendario'), abrirFormEvento = perezoso('menu', 'abrirFormEvento'), pintarDescuentos = perezoso('menu', 'pintarDescuentos'),
    pintarWebs = perezoso('menu', 'pintarWebs'), abrirFase = perezoso('menu', 'abrirFase'), abrirTimerLibre = perezoso('timer', 'abrirTimerLibre'),
    abrirChequeo = perezoso('menu', 'abrirChequeo'), abrirNuevoBloque = perezoso('menu', 'abrirNuevoBloque'), guardarComoPlantilla = perezoso('menu', 'guardarComoPlantilla');
  // El botón ▶ de cada parte: si el timer aún no se ha descargado, se descarga y se abre su editor.
  document.addEventListener('click', function (e) {
    if (window.tmAbrirEditor) return;
    var b = e.target.closest && e.target.closest('[data-tm]');
    if (!b) return;
    e.stopPropagation(); e.preventDefault();
    var i = +b.dataset.tm;
    cargarMod('timer').then(function () { tmAbrirEditor(i); }).catch(function (er) { toast(mensajeError(er.message)); });
  }, true);
  function precargarModulos() {
    var ir = function () { cargarMod('menu').catch(function () {}); cargarMod('timer').catch(function () {}); };
    if (window.requestIdleCallback) requestIdleCallback(ir, { timeout: 3000 }); else setTimeout(ir, 1500);
  }
  if (leer('rte-tm-run')) cargarMod('timer').catch(function () {});   // había un timer en marcha: se recupera

  // ---------- eventos de la interfaz ----------
  document.addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('.day-btn'))) { S.dia = +b.dataset.dia; render(); window.scrollTo({ top: 0 }); return; }
    if ((b = t.closest('.vid'))) { e.preventDefault(); abrirVideo(+b.dataset.v); return; }
    if ((b = t.closest('[data-v]')) && b.classList.contains('vid-row')) { abrirVideo(+b.dataset.v); return; }
    if ((b = t.closest('[data-reg]'))) { abrirRegistro(JSON.parse(b.dataset.reg)); return; }
    if ((b = t.closest('[data-hecho]'))) {
      var rf = JSON.parse(b.dataset.hecho); b.disabled = true;
      var rg = { FECHA: aTxt(rf.iso), ID_PLAN: rf.id, BLOQUE: rf.bloque, HECHO: 'Sí' };
      apiGuardar({ action: 'registrar', registro: rg }).then(ok).then(function (res) {
        S.data.registro = S.data.registro.filter(function (y) { return !(y.FECHA === rg.FECHA && y.ID_PLAN === rg.ID_PLAN); }).concat([res.registro || rg]);
        render(); toast(res.cola ? 'Hecho ✔ · se enviará al volver la conexión' : 'Hecho ✔ · «Editar» para añadir RPE o datos');
      }).catch(falloApi(b));
      return;
    }
    if ((b = t.closest('[data-rpe-rap]'))) {
      var rq = JSON.parse(b.closest('[data-rpe-blq]').dataset.rpeBlq), prev = registroDe(rq.iso, rq.id) || {};
      var rg2 = Object.assign({}, prev, { FECHA: aTxt(rq.iso), ID_PLAN: rq.id, BLOQUE: prev.BLOQUE || rq.bloque, HECHO: prev.HECHO || 'Sí', RPE: b.dataset.rpeRap });
      delete rg2._fila; delete rg2.REGISTRADO;
      apiGuardar({ action: 'registrar', registro: rg2 }).then(ok).then(function (res) {
        S.data.registro = S.data.registro.filter(function (y) { return !(y.FECHA === rg2.FECHA && y.ID_PLAN === rg2.ID_PLAN); }).concat([res.registro || rg2]);
        render(); toast('RPE ' + rg2.RPE + ' guardado');
      }).catch(falloApi(null));
      return;
    }
    if ((b = t.closest('[data-chequeo]'))) { abrirChequeo(b.dataset.chequeo); return; }
    if ((b = t.closest('[data-nuevo-bloque]'))) { abrirNuevoBloque(b.dataset.nuevoBloque); return; }
    if ((b = t.closest('[data-plantilla]'))) { guardarComoPlantilla(b.dataset.plantilla); return; }
    if ((b = t.closest('[data-borrar-bloque]'))) {
      if (!confirmar(b, '¿Quitar? Toca otra vez')) return;
      b.disabled = true;
      api({ action: 'bloque_borrar', id: b.dataset.borrarBloque, ver: S.data.semana }).then(ok).then(function (r) { aplicarSemana(r.semana); render(); toast('Bloque quitado'); }).catch(falloApi(b));
      return;
    }
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
  var WEB_VERSION = 'web 0.6';
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
  // Arranque instantáneo: si había sesión, se pinta la copia de esta semana mientras Firebase confirma quién eres.
  (function () {
    var ult = leer('rte-ultima'), c = leer('rte-cache');
    if (!ult || Date.now() - ult > CFG.diasSesion * 864e5 || !c || !c.semana) return;
    var l = lunesIso(hoyLocal()), loc = semanaLocal(l);
    var sem = loc ? loc.sem : c.semana;
    S.user = { nombre: 'Pablo', email: CFG.emailPermitido, marcas: {} };
    if (c.marcas) { S.marcasFilas = c.marcas; prepararMarcas(c.marcas); }
    S.config = c.config; S.data = construirDatos(conHoyLocal(sem)); S.dia = diaInicial(); S.aviso = navigator.onLine ? 'Actualizando…' : 'Sin conexión' + (loc ? ' · copia del ' + horaCorta(loc.t) : '');
    S.videos = leer('rte-videos') || []; prepararVideos(S.videos);
    S.pintadoAntes = true;
    render();
  })();
  auth.onAuthStateChanged(function (u) {
    if (!u) { borrarLocal(); S.email = null; S.data = null; S.config = null; pantallaLogin(S.motivoSalida); S.motivoSalida = ''; return; }
    var email = String(u.email || '').toLowerCase();
    if (email !== CFG.emailPermitido) { S.motivoSalida = 'Esta app es privada. La cuenta ' + email + ' no tiene acceso.'; salir(); return; }
    var ultima = leer('rte-ultima');
    if (ultima && Date.now() - ultima > CFG.diasSesion * 864e5) { S.motivoSalida = 'La sesión ha caducado por inactividad. Vuelve a entrar.'; guardar('rte-ultima', Date.now()); salir(); return; }
    guardar('rte-ultima', Date.now());
    S.email = email;
    S.user = { nombre: 'Pablo', email: email, marcas: {} };
    S.videos = leer('rte-videos') || [];
    prepararVideos(S.videos);
    var c = leer('rte-cache');
    if (S.data && S.pintadoAntes) { if (c && c.marcas) { S.marcasFilas = c.marcas; prepararMarcas(c.marcas); } render(); S.config = null; }
    else if (c && c.semana) {
      S.config = c.config; S.data = construirDatos(c.semana); S.dia = diaInicial(); S.aviso = 'Actualizando…';
      if (c.marcas) { S.marcasFilas = c.marcas; prepararMarcas(c.marcas); }
      render();
      S.config = null;   // fuerza «inicio» para refrescar también la configuración
    } else render();
    cargar();
    precargarModulos();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
