'use strict';
  // =====================================================================
  //  MENÚ · marcas, cobertura, descuentos, webs, vídeos, apariencia, instalar
  // =====================================================================
  
  
  

  

  function abrirAjustes(abrir) { cerrarHoja(); S.vista = 'ajustes'; S._abrir = abrir || null; render(); window.scrollTo({ top: 0 }); }
  

  
  function seccion(id, titulo, cuerpo, extra, ico) {
    return '<details class="set" id="' + id + '"><summary>' + (ico ? '<span class="set-ico">' + ico + '</span>' : '') + esc(titulo) +
      (extra ? ' <span class="badge">' + esc(extra) + '</span>' : '') + '</summary><div class="set-body">' + cuerpo + '</div></details>';
  }

  function renderAjustes() {
    var d = S.data || {}, tema = leer('rte-tema') || 'oscuro';
    var hechos = (d.registro || []).length;
    var html = cabeceraVista('Menú', 'Semana') +
      '<section class="me"><div class="who big">P</div><div><b>Pablo</b><div class="hint">' + esc(S.email || '') + '</div></div></section>';
    html += '<button class="set-link reest-link" type="button" id="ir-reest"><span class="set-ico">🔀</span>Reestructurar · viaje, reorganizar, competi<span class="go">›</span></button>';
    html += '<button class="set-link" type="button" id="ir-competis"><span class="set-ico">🏆</span>Competis · España y Europa · seguimiento<span class="go">›</span></button>';
    html += '<button class="set-link" type="button" id="ir-cobertura"><span class="set-ico">%</span>Estímulos semana y mes · carrera<span class="go">›</span></button>';
    html += '<button class="set-link" type="button" id="ir-hoja"><span class="set-ico">☰</span>Hoja de la semana · bloques<span class="go">›</span></button>';
    html += '<button class="set-link" type="button" id="ir-extras"><span class="set-ico">⊕</span>Extras semana en curso<span class="go">›</span></button>';
    html += '<button class="set-link" type="button" id="ir-calendario"><span class="set-ico">▦</span>Calendario de eventos<span class="go">›</span></button>';
    var pend = (d.pendientes || []);
    html += seccion('s-pend', 'Pendientes', htmlPendientes(pend), pend.length ? String(pend.length) : '', '↺');
    html += seccion('s-avisos', 'Avisos de tests y competiciones', htmlAvisosEventos(d), '', '⏱');
    html += seccion('s-marcas', 'Mis marcas', htmlMarcas(d), '', '◆');
    html += seccion('s-wods', 'WODs de referencia y guardados', '<div id="wods-body"><div class="hint">Cargando…</div></div>', '', '★');
    html += seccion('s-semana', 'Esta semana', htmlResumenSemana(d), hechos ? hechos + ' registrados' : '', '✓');
    html += seccion('s-desc', '% Descuentos', '<div id="desc-body"><div class="hint">Cargando…</div></div>', '', '%');
    html += seccion('s-webs', 'Mis webs', '<div id="webs-body"><div class="hint">Cargando…</div></div>', '', '↗');
    html += seccion('s-videos', 'Vídeos de ejercicios', '<input id="vid-q" class="inp" placeholder="Buscar ejercicio…" autocomplete="off"><div id="vid-body" class="pr-list"></div>', String((S.videos || []).length), '▶');
    html += seccion('s-push', 'Avisos al móvil', htmlAvisos(d), '', '🔔');
    html += seccion('s-tema', 'Apariencia', '<div class="seg" role="group" aria-label="Tema">' + Object.keys(TEMAS).map(function (k) {
      return '<button type="button" data-tema="' + k + '" aria-pressed="' + (tema === k) + '">' + TEMAS[k] + '</button>'; }).join('') + '</div>' +
      '<div class="hint">Automático sigue el modo claro u oscuro de tu móvil u ordenador.</div>', '', '◐');
    var lb = leer('rte-unidad') === 'lb';
    html += seccion('s-unid', 'Unidades de carga', '<div class="seg" role="group" aria-label="Unidades"><button type="button" data-unidad="kg" aria-pressed="' + !lb + '">kg</button><button type="button" data-unidad="lb" aria-pressed="' + lb + '">lb</button></div>' +
      '<div class="hint">Para entrenar en un box que va en libras: los % y los discos por lado del timer salen en lb (barra 45 lb). Tus RM siguen guardados en kg.</div>', lb ? 'lb' : 'kg', '⚖');
    html += seccion('s-instalar', 'Instalar la app', htmlInstalar(), '', '↓');
    if ((d.erratas || []).length) html += seccion('s-err', 'Avisos de Fabrik', '<ul class="hint">' + d.erratas.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>', String(d.erratas.length), '!');
    html += '<button class="btn" type="button" id="logout">Cerrar sesión</button><div class="hint" style="text-align:center">Road To Elite · ' + esc(WEB_VERSION) + '</div>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = volverSemana;
    document.getElementById('logout').onclick = function () { S.vista = null; salir(); };
    document.getElementById('ir-cobertura').onclick = function () { S.vista = 'cobertura'; render(); window.scrollTo({ top: 0 }); };
    document.getElementById('ir-calendario').onclick = function () { abrirCalendario(); };
    $app.querySelectorAll('[data-unidad]').forEach(function (b) { b.onclick = function () { guardar('rte-unidad', b.dataset.unidad); S._abrir = 's-unid'; render(); toast('Cargas en ' + b.dataset.unidad); }; });
    document.getElementById('ir-reest').onclick = function () { S.vista = 'reest'; S.reest = {}; render(); window.scrollTo({ top: 0 }); };
    document.getElementById('ir-competis').onclick = function () { S.vista = 'competis'; S.competis = null; render(); window.scrollTo({ top: 0 }); };
    document.getElementById('ir-hoja').onclick = function () { S.vista = 'hoja'; render(); window.scrollTo({ top: 0 }); };
    document.getElementById('ir-extras').onclick = function () { S.vista = 'extras'; S.extrasCurso = null; render(); window.scrollTo({ top: 0 }); };
    document.getElementById('s-wods').addEventListener('toggle', function () { if (this.open) cargarWods(); });
    if (S._abrir === 's-wods') cargarWods();
    document.getElementById('s-desc').addEventListener('toggle', function () { if (this.open) cargarDescuentos(); });
    document.getElementById('s-webs').addEventListener('toggle', function () { if (this.open) cargarWebs(); });
    var q = document.getElementById('vid-q'); q.oninput = function () { pintarVideos(q.value); }; pintarVideos('');
    enlazarMarcas();
    var pb = document.getElementById('push-on');
    if (pb) pb.onclick = function () {
      pb.disabled = true;
      activarAvisos().then(function (r) { pb.disabled = false; toast(r && r.enviados ? 'Aviso de prueba enviado' : 'Activado'); S._abrir = 's-push'; render(); })
        .catch(function (e) { pb.disabled = false; toast(e && e.message ? e.message : 'No se pudo activar'); });
    };
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

  // ---------- Cobertura: metas semana/mes (APP · METAS, calculadas desde el plan) y carrera ----------
  function pctNum(t) { var m = String(t || '').match(/(\d+(?:[.,]\d+)?)\s*%/); return m ? Math.min(100, parseFloat(m[1].replace(',', '.'))) : null; }
  function anillo(pct, lbl, sub) {
    var p = pct == null ? 0 : pct, r = 30, c = 2 * Math.PI * r;
    return '<div class="ring"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="' + r + '" class="ring-bg"/><circle cx="36" cy="36" r="' + r + '" class="ring-fg' + (p >= 100 ? ' full' : '') +
      '" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><b>' + (pct == null ? '—' : Math.round(p) + '%') + '</b><span>' + esc(lbl) + '</span>' + (sub ? '<em>' + esc(sub) + '</em>' : '') + '</div>';
  }
  function num1(n) { n = Math.round((Number(n) || 0) * 10) / 10; return String(n).replace('.', ','); }
  function unidadMeta(m) { return m.tipo === 'MIN' || m.tipo === 'MIN_GT' ? '′' : m.tipo === 'SALTOS' ? ' saltos' : ''; }
  /** Días de la semana/mes en que está programado cada estímulo (chips). */
  function diasMeta(m) {
    var d = m.dias || []; if (!d.length) return '<div class="mg"><b>📅 Programado</b><span class="falta">sin programar</span></div>';
    return '<div class="mg"><b>📅 Programado</b><span class="dchips">' + d.map(function (x) {
      return '<span class="dchip' + (x.estado === 'BORRADOR' ? ' borr' : '') + (x.origen === 'FABRIK' ? ' fab' : '') + '">' + esc(diaSem(x.iso)) + ' ' + x.turno + ' · ' + esc(String(x.titulo).slice(0, 34)) + '</span>'; }).join('') + '</span></div>';
  }
  function diaSem(iso) { var n = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(iso + 'T12:00:00').getDay()]; return n + ' ' + Number(iso.slice(8, 10)); }
  function tarjetasMetas(lista) {
    if (!lista.length) return '<div class="hint">Sin metas. Crea la primera con «＋ Nueva meta».</div>';
    var grupos = {}, orden = [];
    lista.forEach(function (m) { var k = m.prioridad || 'Otras'; if (!grupos[k]) { grupos[k] = []; orden.push(k); } grupos[k].push(m); });
    return orden.map(function (k) {
      return '<div class="part-lbl">' + esc(k) + '</div>' + grupos[k].map(function (m) {
        var u = unidadMeta(m), pp = Math.round(m.pProg * 100), pr = Math.round(m.pReal * 100);
        return '<details class="meta-c"><summary><div class="meta-t"><b>' + esc(m.estimulo) + '</b><span class="meta-n' + (m.cubierta ? ' ok' : '') + '">' +
          num1(m.programado) + ' / ' + num1(m.meta) + u + '</span></div>' +
          '<div class="pbar dbl" title="Programado ' + pp + '% · hecho ' + pr + '%"><i class="prog' + (pp >= 100 ? ' full' : '') + '" style="width:' + pp + '%"></i><i class="real" style="width:' + pr + '%"></i></div>' +
          '<div class="meta-sub">' + (m.cubierta ? '✔ Programada' : 'Falta programar ' + num1(Math.max(0, m.meta - m.programado)) + u) + ' · hecho ' + num1(m.realizado) + u +
            (m.borrador ? ' · ' + num1(m.borrador) + ' en borrador' : '') + '</div></summary>' +
          '<div class="exp-body">' + diasMeta(m) +
          (m.integrar ? '<div class="mg"><b>🔗 Integrar con</b><span>' + esc(m.integrar) + '</span></div>' : '') +
          (m.mejorar ? '<div class="mg"><b>📈 Cómo mejorarlo</b><span>' + esc(m.mejorar) + '</span></div>' : '') +
          (m.notas ? '<div class="mg"><b>📝 Notas</b><span>' + esc(m.notas) + '</span></div>' : '') +
          '<div class="hint">Códigos ' + esc(m.codigos || '—') + ' · tipo ' + esc(m.tipo) + (m.maximo ? ' · máx. ' + esc(m.maximo) : '') + (m.ajuste ? ' · ajustes manuales ' + num1(m.ajuste) : '') + '</div>' +
          '<div class="evc-acc"><button class="btn-ghost sm" type="button" data-meta-aj="' + esc(m.id) + '">＋ Marcar hecho a mano</button><button class="btn-ghost sm" type="button" data-meta-ed="' + esc(m.id) + '">Editar</button></div></div></details>';
      }).join('');
    }).join('');
  }
  function cargarCobertura() {
    return api({ action: 'cobertura' }).then(ok).then(function (r) { S.cobertura = r.cobertura; if (S.vista === 'cobertura') render(); }).catch(function (e) { toast(mensajeError(e.message)); });
  }
  function htmlAnalisis(A) {
    if (!A) return '<div class="hint">Calculando el análisis…</div>';
    var h = '<section class="ana"><div class="part-lbl">Conclusiones</div>' + (A.conclusiones || []).map(function (c) { return '<p class="ana-c">' + esc(c) + '</p>'; }).join('') + '</section>';
    if ((A.semanas || []).length) h += '<div class="part-lbl">Por semana</div><div class="tbl-w"><table class="tbl"><thead><tr><th>Semana</th><th>km</th><th>Z2′</th><th>Cal.</th><th>Z6–8</th><th>Ritmo Z2</th><th>FC Z2</th></tr></thead><tbody>' +
      A.semanas.slice().reverse().map(function (s) { return '<tr><td>' + fechaCorta(s.lunes) + '</td><td>' + num1(s.km) + '</td><td>' + s.minZ2 + '</td><td>' + s.calidad + '</td><td>' + s.z68 + '</td><td>' + esc(s.ritmoZ2) + '</td><td>' + esc(s.fcZ2) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if ((A.calidad || []).length) h += '<div class="part-lbl">Últimas sesiones de calidad</div>' + A.calidad.slice().reverse().map(function (x) {
      return '<div class="run-c"><div class="run-h"><b>' + esc(x.sesion || x.tipo) + '</b><span class="tag">' + esc(x.tipo) + '</span></div><div class="hint">' + fechaCorta(x.fecha) +
        (x.series ? ' · ' + esc(x.series) : '') + ' · parciales: ' + esc(x.cumple || '—') + (x.rpe ? ' · RPE ' + esc(x.rpe) : '') + '</div></div>'; }).join('');
    return h + '<div class="hint">Actualizado ' + esc(A.actualizado || '') + ' · también en la pestaña APP · RESUMEN del Sheet, con tus sensaciones de cada día.</div>';
  }
  function renderCobertura() {
    var html = cabeceraVista('Estímulos', 'Menú');
    var C = S.cobertura;
    if (C && !C.metas) { $app.innerHTML = html + '<div class="hint">El servidor aún no tiene la versión con metas: instala la última versión del Apps Script.</div>'; document.getElementById('atras').onclick = function () { abrirAjustes(); }; return; }
    if (!C) {
      $app.innerHTML = html + '<div class="hint">Leyendo tu Sheet…</div>';
      document.getElementById('atras').onclick = function () { abrirAjustes(); };
      cargarCobertura();
      return;
    }
    var tab = S.cobTab || 'semana', M = C.metas;
    html += '<div class="rings">' + anillo(M.semana.pctProg * 100, 'Semana', M.semana.cubiertas + '/' + M.semana.total + ' metas · hecho ' + Math.round(M.semana.pctReal * 100) + '%') +
      anillo(M.mes.pctProg * 100, cap(M.mes.etiqueta), 'hecho ' + Math.round(M.mes.pctReal * 100) + '%') + '</div>';
    html += '<div class="seg" role="group" aria-label="Vista">' + [['semana', 'Semana'], ['mes', 'Mes'], ['carrera', 'Carrera']].map(function (t) {
      return '<button type="button" data-cob="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'carrera') {
      html += '<button class="btn btn-primary" type="button" id="car-nueva">＋ Registrar carrera (datos del Garmin)</button>';
      html += graficasCarrera(S.analisis) + htmlAnalisis(S.analisis);
      var sems = (C.carrera && C.carrera.semanas) || [];
      if (sems.length) html += '<div class="part-lbl">Plan de carrera (pestaña carrera)</div>' + sems.map(function (w) {
        return '<details class="set"><summary>' + esc(w.titulo.split('·').slice(0, 2).join('·')) + '</summary><div class="set-body">' +
          '<div class="hint">' + esc(w.titulo.split('·').slice(2).join('·')) + '</div>' +
          w.sesiones.map(function (x) {
            return '<div class="run-c"><div class="run-h"><b>' + esc(x.sesion) + '</b><span class="tag">' + esc(String(x.zona || '').split('·')[0]) + '</span></div>' +
              '<div class="run-t">' + esc(x.trabajo) + '</div>' + (x.ritmo ? '<div class="hint">🎯 ' + esc(x.ritmo) + '</div>' : '') + '</div>';
          }).join('') + '</div></details>';
      }).join('');
    } else {
      var B = M[tab], falta = B.metas.filter(function (m) { return !m.cubierta; });
      var quedan = B.metas.reduce(function (a, m) { return a + (m.tipo === 'COUNT' ? Math.max(0, Math.ceil(m.meta - m.programado)) : 0); }, 0);
      html += '<div class="xk">' + (tab === 'semana' ? '<div><b>' + B.cubiertas + '/' + B.total + '</b><span>metas semanales programadas</span></div>' : '<div><b>' + Math.round(B.pctProg * 100) + ' %</b><span>programado del mes · hecho ' + Math.round(B.pctReal * 100) + ' %</span></div>') +
        '<div><b>' + quedan + '</b><span>sesiones por programar ' + (tab === 'semana' ? 'esta semana' : 'en el mes') + '</span></div></div>' +
        '<button class="btn-ghost sm" type="button" id="cob-mail">✉ Enviarme el resumen por correo</button>';
      html += '<div class="hint">' + (tab === 'semana' ? 'Semana' : cap(B.etiqueta)) + ': ' + fechaCorta(B.desde) + ' – ' + fechaCorta(B.hasta) +
        (tab === 'semana' ? ' · se reinicia el domingo' : ' · se cierra el último domingo del mes') + '</div>';
      html += '<div class="hint leyenda"><i class="lg prog"></i> programado <i class="lg real"></i> hecho</div>';
      if (falta.length) html += '<section class="por-cubrir"><div class="part-lbl">Por cubrir</div>' + falta.map(function (m) {
        var resto = Math.max(0, Math.ceil(m.meta - m.programado));
        return '<div class="pc-i">' + esc(m.estimulo) + ' [' + num1(m.programado) + '/' + num1(m.meta) + unidadMeta(m) + ']' +
          (m.tipo === 'SALTOS' && resto ? '<small class="hint"> · faltan ' + resto + ': sesión de pliometría o ' + resto * 4 + ' DU dentro de otro bloque</small>' : '') + '</div>'; }).join('') + '</section>';
      html += tarjetasMetas(B.metas || []);
      html += '<button class="btn" type="button" id="meta-nueva">＋ Nueva meta ' + (tab === 'semana' ? 'semanal' : 'mensual') + '</button>';
    }
    html += '<button class="btn" type="button" id="cob-re">Actualizar</button>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = function () { abrirAjustes(); };
    document.getElementById('cob-re').onclick = function () { S.cobertura = null; S.analisis = null; render(); };
    $app.querySelectorAll('[data-cob]').forEach(function (b) { b.onclick = function () { S.cobTab = b.dataset.cob; render(); }; });
    var todas = M.semana.metas.concat(M.mes.metas), porId = function (id) { return todas.filter(function (m) { return m.id === id; })[0]; };
    $app.querySelectorAll('[data-meta-ed]').forEach(function (b) { b.onclick = function () { abrirFormMeta(porId(b.dataset.metaEd)); }; });
    $app.querySelectorAll('[data-meta-aj]').forEach(function (b) { b.onclick = function () { abrirAjusteMeta(porId(b.dataset.metaAj)); }; });
    var ml = document.getElementById('cob-mail');
    if (ml) ml.onclick = function () { ml.disabled = true; api({ action: 'enviar_resumen', lunes: S.data.semana }).then(ok).then(function () { toast('Enviado a tu correo'); ml.disabled = false; }).catch(falloApi(ml)); };
    var nm = document.getElementById('meta-nueva'); if (nm) nm.onclick = function () { abrirFormMeta(null, tab === 'semana' ? 'Semana' : 'Mes'); };
    var nc = document.getElementById('car-nueva'); if (nc) nc.onclick = function () { abrirCarrera({ iso: S.data.hoy, id: '', bloque: '' }); };
    if (tab === 'carrera' && !S.analisis && !S._pidiendoAn) {
      S._pidiendoAn = true;
      api({ action: 'analisis' }).then(ok).then(function (r) { S.analisis = r.analisis; S._pidiendoAn = false; if (S.vista === 'cobertura') render(); }).catch(function (e) { S._pidiendoAn = false; toast(mensajeError(e.message)); });
    }
  }
  /** Crear o editar una meta (APP · METAS). */
  function abrirFormMeta(m, ambito) {
    if (m && !S.metasLista) {
      api({ action: 'metas' }).then(ok).then(function (r) { S.metasLista = r.lista; abrirFormMeta(m, ambito); }).catch(function (e) { toast(mensajeError(e.message)); });
      return;
    }
    var fila = m && (S.metasLista || []).filter(function (r) { return r.ID === m.id; })[0], o = {};
    if (fila) o = { ID: fila.ID, 'ÁMBITO': fila['ÁMBITO'], PRIORIDAD: fila.PRIORIDAD, 'ESTÍMULO': fila['ESTÍMULO'], META: fila.META, MPM: fila['META POR MES'], MAXIMO: fila['MÁXIMO'], TIPO: fila.TIPO, CODIGOS: fila['CÓDIGOS'], ACTIVA: fila.ACTIVA, NOTAS: fila.NOTAS, ORDEN: fila.ORDEN, INT: fila['INTEGRAR CON'], MEJ: fila['CÓMO MEJORARLO'] };
    if (!o['ÁMBITO']) o['ÁMBITO'] = ambito || 'Semana';
    var sel = function (v, l) { return l.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join(''); };
    abrirHoja('<div class="row"><h2>' + (o.ID ? 'Editar meta' : 'Nueva meta') + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<form id="mtf" class="avf"><label for="mt-e">Estímulo</label><input id="mt-e" required maxlength="160" value="' + esc(o['ESTÍMULO'] || '') + '" placeholder="Ej. HSPU estricto">' +
      '<div class="two"><div><label for="mt-a">Ámbito</label><select id="mt-a">' + sel(o['ÁMBITO'], ['Semana', 'Mes']) + '</select></div>' +
      '<div><label for="mt-p">Prioridad / bloque</label><input id="mt-p" maxlength="60" value="' + esc(o.PRIORIDAD || '') + '" placeholder="P1 · Gimnásticos"></div></div>' +
      '<div class="two"><div><label for="mt-t">Cómo se cuenta</label><select id="mt-t">' + ['COUNT', 'MIN', 'MIN_GT', 'SALTOS'].map(function (x) {
        return '<option value="' + x + '"' + (x === (o.TIPO || 'COUNT') ? ' selected' : '') + '>' + { COUNT: 'Sesiones', MIN: 'Minutos totales', MIN_GT: 'Sesión de más de X min', SALTOS: 'Cantidad (saltos, reps…)' }[x] + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="mt-m">Meta</label><input id="mt-m" inputmode="decimal" required value="' + esc(o.META || '') + '"></div></div>' +
      '<div class="two"><div><label for="mt-x">Máximo (opcional)</label><input id="mt-x" inputmode="decimal" value="' + esc(o.MAXIMO || '') + '"></div>' +
      '<div><label for="mt-c">Códigos del plan</label><input id="mt-c" maxlength="80" value="' + esc(o.CODIGOS || '') + '" placeholder="W17 o W15|W16"></div></div>' +
      '<label for="mt-mm">Meta distinta por mes (opcional)</label><input id="mt-mm" maxlength="80" value="' + esc(o.MPM || '') + '" placeholder="11:3, 12:2, 1:1, *:3">' +
      '<label for="mt-n">Notas / criterio</label><textarea id="mt-n" rows="3">' + esc(o.NOTAS || '') + '</textarea>' +
      '<label for="mt-int">🔗 Con qué movimientos integrarlo</label><textarea id="mt-int" rows="2" placeholder="Ej. Z6–Z8 integrado con DU o bike">' + esc(o.INT || '') + '</textarea>' +
      '<label for="mt-mej">📈 Cómo mejorarlo (objetivos y debilidades)</label><textarea id="mt-mej" rows="3">' + esc(o.MEJ || '') + '</textarea>' +
      '<div class="two"><div><label for="mt-o">Orden</label><input id="mt-o" inputmode="numeric" value="' + esc(o.ORDEN || '') + '"></div>' +
      '<div><label for="mt-on">Activa</label><select id="mt-on">' + sel(o.ACTIVA || 'Sí', ['Sí', 'No']) + '</select></div></div>' +
      '<div class="hint">El avance se calcula solo con los bloques del plan que llevan estos códigos (programado) y con lo que registres como hecho.</div>' +
      '<div class="two-btn">' + (o.ID ? '<button class="btn" type="button" id="mt-del">Borrar</button>' : '') + '<button class="btn btn-primary" type="submit" id="mt-ok">Guardar</button></div></form>');
    var fin = function (r) { S.cobertura.metas = r.metas; if (r.lista) S.metasLista = r.lista; cerrarHoja(); render(); };
    var del = document.getElementById('mt-del');
    if (del) del.onclick = function () {
      if (!confirmar(del, '¿Borrar? Toca otra vez')) return;
      del.disabled = true;
      api({ action: 'meta_borrar', id: o.ID }).then(ok).then(function (r) { fin(r); toast('Meta borrada'); }).catch(falloApi(del));
    };
    document.getElementById('mtf').onsubmit = function (ev) {
      ev.preventDefault();
      var b = document.getElementById('mt-ok'); b.disabled = true;
      var meta = { ID: o.ID || '', 'ÁMBITO': val('mt-a'), PRIORIDAD: val('mt-p'), 'ESTÍMULO': val('mt-e'), META: val('mt-m').replace(',', '.'), 'MÁXIMO': val('mt-x').replace(',', '.'), TIPO: val('mt-t'),
        'CÓDIGOS': val('mt-c').toUpperCase(), 'META POR MES': val('mt-mm'), NOTAS: val('mt-n'), ORDEN: val('mt-o'), ACTIVA: val('mt-on'), 'INTEGRAR CON': val('mt-int'), 'CÓMO MEJORARLO': val('mt-mej') };
      api({ action: 'meta', meta: meta }).then(ok).then(function (r) { fin(r); toast('Meta guardada'); }).catch(falloApi(b));
    };
  }
  /** Marca a mano algo hecho fuera del plan (APP · AJUSTES METAS). */
  function abrirAjusteMeta(m) {
    if (!m) return;
    abrirHoja('<div class="row"><h2>Marcar hecho</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div><div class="hint">' + esc(m.estimulo) + '</div>' +
      '<form id="ajf" class="avf"><div class="two"><div><label for="aj-f">Fecha</label><input id="aj-f" type="date" value="' + S.data.hoy + '"></div>' +
      '<div><label for="aj-c">Cantidad' + (unidadMeta(m) ? ' (' + unidadMeta(m).trim() + ')' : '') + '</label><input id="aj-c" inputmode="decimal" value="1"></div></div>' +
      '<label for="aj-n">Nota</label><input id="aj-n" maxlength="300" placeholder="Ej. lo hice en el open gym">' +
      '<div class="hint">Cuenta como programado y hecho en el periodo de esa fecha. Para restar, pon una cantidad negativa.</div>' +
      '<button class="btn btn-primary" type="submit" id="aj-ok">Guardar</button></form>');
    document.getElementById('ajf').onsubmit = function (ev) {
      ev.preventDefault();
      var b = document.getElementById('aj-ok'); b.disabled = true;
      api({ action: 'meta_ajuste', metaId: m.id, fecha: val('aj-f'), cantidad: val('aj-c').replace(',', '.'), nota: val('aj-n') }).then(ok)
        .then(function (r) { S.cobertura.metas = r.metas; cerrarHoja(); render(); toast('Anotado'); }).catch(falloApi(b));
    };
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
      '<div class="evc-acc"><a class="btn-ghost sm" href="' + esc(urlGoogleCal(e)) + '" target="_blank" rel="noopener">📅 Google Calendar</a><button class="btn-ghost sm" type="button" data-evento="' + esc(e.ID) + '">Editar</button></div></div>';
  }
  function renderCalendario() {
    var d = S.data, hoy = d.hoy, mes = S.calMes || hoy.slice(0, 7), y = +mes.slice(0, 4), m = +mes.slice(5, 7);
    var evs = (S.eventos || d.eventos || []).filter(function (e) { return e.ESTADO !== 'Ignorado' && e.ESTADO !== 'Pendiente de aprobar'; }).map(function (e) { e._i = aIso(e.INICIO); e._f = aIso(e.FIN) || e._i; return e; }).filter(function (e) { return e._i; });
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
      '<div class="ev-list">' + (lista.length ? lista.map(tarjetaEv).join('') : '<div class="hint">No hay eventos.</div>') + '</div>' +
      (evs.length ? '<button class="btn" type="button" id="ics">Descargar todos los eventos (.ics · iPhone, Outlook)</button>' : '');
    $app.innerHTML = html;
    var ic = document.getElementById('ics'); if (ic) ic.onclick = function () { descargarIcs(evs); };
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
  function abrirEditarPendiente(id) {
    var p = (S.data.pendientes || []).filter(function (x) { return x.ID === id; })[0]; if (!p) return;
    abrirHoja('<div class="row"><h2>Editar pendiente</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div><form id="pef" class="avf">' +
      '<label for="pe-t">Título</label><input id="pe-t" maxlength="200" value="' + esc(p.BLOQUE || '') + '">' +
      '<label for="pe-c">Contenido (lo que se recolocará)</label><textarea id="pe-c" rows="8">' + esc(p._CONTENIDO || '') + '</textarea>' +
      '<div class="two"><div><label for="pe-m">Minutos</label><input id="pe-m" inputmode="numeric" value="' + esc(p._MIN || '') + '"></div><div><label for="pe-n">Notas</label><input id="pe-n" maxlength="300" value="' + esc(p.NOTAS || '') + '"></div></div>' +
      '<div class="hint">Del ' + esc(p['FECHA ORIGINAL'] || '') + '. Al cargar los extras de la semana siguiente se propone con estos datos.</div>' +
      '<button class="btn btn-primary" type="submit" id="pe-ok">Guardar</button></form>');
    document.getElementById('pef').onsubmit = function (ev) {
      ev.preventDefault(); var b = document.getElementById('pe-ok'); b.disabled = true;
      api({ action: 'pendiente_editar', id: id, bloque: val('pe-t'), contenido: val('pe-c'), min: val('pe-m'), notas: val('pe-n') }).then(ok)
        .then(function (r) { S.data.pendientes = r.pendientes; cerrarHoja(); S._abrir = 's-pend'; render(); toast('Pendiente actualizado'); }).catch(falloApi(b));
    };
  }
  function htmlPendientes(lista) {
    if (!lista.length) return '<div class="hint">No hay nada pendiente.</div>';
    return '<div class="hint">Se te propondrán al programar la semana siguiente; nada entra sin tu aprobación.</div><div class="pr-list">' + lista.map(function (p) {
      return '<div class="pend-i"><div class="pend-t"><b>' + esc(p.BLOQUE) + '</b><span class="tag">' + esc(p.TIPO) + '</span><span class="tag' + (p.ESTADO === 'Propuesto' ? ' ex' : '') + '">' + esc(p.ESTADO) + '</span></div>' +
        '<div class="hint">' + esc(p['FECHA ORIGINAL']) + (p.MOTIVO ? ' · ' + esc(p.MOTIVO) : '') + '</div>' +
        ((p._CONTENIDO || p.NOTAS) ? '<details class="ro-ver"><summary>Ver bloque</summary><div class="exp-body">' + (p._MIN ? '<div class="hint">' + esc(p._MIN) + '′' + (p._INTENSIDAD ? ' · ' + esc(p._INTENSIDAD) : '') + '</div>' : '') +
          '<div class="prose-n pre">' + esc(p._CONTENIDO || '') + '</div>' + (p.NOTAS ? '<div class="hint">' + esc(p.NOTAS) + '</div>' : '') + '</div></details>' : '') +
        (p._Z2 ? '<div class="hint">Z2: la semana siguiente se suma el 25 % de sus minutos a tu Z2 más larga.</div>' : '') +
        '<div class="evc-acc"><button class="btn sm" type="button" data-pend-ed="' + esc(p.ID) + '">Editar</button><button class="btn-ghost sm" type="button" data-pend="' + esc(p.ID) + '" data-est="Descartado">Descartar</button></div></div>';
    }).join('') + '</div>';
  }

  // ---------- Descuentos (APP · DESCUENTOS) ----------
  
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

  // ---------- v0.6 · chequeo de la mañana ----------
  function chipsEscala(id, desde, hasta, val, etiquetas) {
    var h = '<div class="chips esc" role="group" id="' + id + '">';
    for (var i = desde; i <= hasta; i++) h += '<button type="button" class="esc-chip' + (String(i) === String(val) ? ' on' : '') + '" data-v="' + i + '" title="' + esc((etiquetas || {})[i] || '') + '">' + i + '</button>';
    return h + '</div>';
  }
  /** Último chequeo anterior: se muestra como REFERENCIA en gris, nunca se rellena solo (no se inventan mediciones). */
  function chequeoAnterior(iso) {
    return (S.data.chequeos || []).filter(function (x) { return aIso(x.FECHA) < iso; }).sort(function (a, b) { return aIso(a.FECHA) < aIso(b.FECHA) ? 1 : -1; })[0] || null;
  }
  function refAnt(p, k, suf) { return p && p[k] ? (p._dia + ': ' + p[k] + (suf || '')) : ''; }
  function leerEscala(id) { var b = document.querySelector('#' + id + ' .on'); return b ? b.dataset.v : ''; }
  var ZONAS = ['Hombros', 'Codos / antebrazo (agarre)', 'Dorsal / espalda alta', 'Lumbar', 'Core', 'Cadera / glúteo', 'Cuádriceps', 'Isquios', 'Gemelo / sóleo', 'Tobillo / Aquiles', 'Rodillas', 'Pies'];
  /** v0.11 · Chequeo por sensaciones (sin Garmin): al abrir la sesión del día. */
  function abrirChequeo(iso) {
    var c = (S.data.chequeos || []).filter(function (x) { return aIso(x.FECHA) === iso; })[0] || {};
    var pa = chequeoAnterior(iso); if (pa) pa._dia = aIso(pa.FECHA) === sumarDias(iso, -1) ? 'ayer' : fechaCorta(aIso(pa.FECHA));
    var lblRef = function (k) { var t = refAnt(pa, k); return t ? ' <span class="ref-ant">' + esc(t) + '</span>' : ''; };
    var zonas = String(c['ZONAS CARGADAS'] || '').split(/\s*,\s*/);
    var hoy = (S.data.dias || []).filter(function (y) { return y.iso === iso; })[0];
    var corre = hoy && hoy.bloques.some(function (b) { return norm(b.origen) === 'CARRERA' || /\b(W01|W02|W04)\b/.test(b.codigos || ''); });
    abrirHoja('<div class="row"><h2>¿Cómo llegas hoy? · ' + fechaCorta(iso) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<form id="chf" class="avf">' +
      '<label>Cansancio general · 1 fresco · 10 reventado' + lblRef('CANSANCIO (1-10)') + '</label>' + chipsEscala('ch-ca', 1, 10, c['CANSANCIO (1-10)']) +
      '<label>Agujetas / cuerpo trabajado de sesiones previas · 1 nada · 10 mucho' + lblRef('AGUJETAS (1-10)') + '</label>' + chipsEscala('ch-ag', 1, 10, c['AGUJETAS (1-10)']) +
      '<label>Zonas más cargadas' + lblRef('ZONAS CARGADAS') + '</label><div class="zonas" id="ch-z">' + ZONAS.map(function (z) {
        return '<button type="button" class="zona' + (zonas.indexOf(z) >= 0 ? ' on' : '') + '" data-z="' + esc(z) + '" aria-pressed="' + (zonas.indexOf(z) >= 0) + '">' + esc(z) + '</button>'; }).join('') + '</div>' +
      '<label>Sueño' + lblRef('SUEÑO') + '</label><div class="seg" role="group" id="ch-su">' + ['Bien', 'Regular', 'Mal'].map(function (v) { return '<button type="button" data-su="' + v + '" aria-pressed="' + (c['SUEÑO'] === v) + '">' + v + '</button>'; }).join('') + '</div>' +
      '<label for="ch-n">Notas</label><input id="ch-n" maxlength="300" value="' + esc(c.NOTAS || '') + '" placeholder="Opcional">' +
      '<div class="hint">Lo cruzo con lo que toca hoy y con lo de los 3 días anteriores: si una zona cargada choca con un bloque, te digo cómo ajustarlo y de dónde viene.' + (corre ? ' Hoy corres: tus sensaciones quedan junto a los datos de la carrera para explicar el resultado.' : '') + '</div>' +
      '<button class="btn btn-primary" type="submit" id="ch-ok">Guardar y ver cómo ajusto el día</button></form>');
    $scrim.querySelectorAll('.esc').forEach(function (g) {
      g.querySelectorAll('.esc-chip').forEach(function (b) { b.onclick = function () { var ya = b.classList.contains('on'); g.querySelectorAll('.esc-chip').forEach(function (y) { y.classList.remove('on'); }); if (!ya) b.classList.add('on'); }; });
    });
    $scrim.querySelectorAll('[data-z]').forEach(function (b) { b.onclick = function () { var on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }; });
    $scrim.querySelectorAll('[data-su]').forEach(function (b) { b.onclick = function () { var on = b.getAttribute('aria-pressed') !== 'true'; $scrim.querySelectorAll('[data-su]').forEach(function (y) { y.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', on); }; });
    document.getElementById('chf').onsubmit = function (ev) {
      ev.preventDefault();
      var su = $scrim.querySelector('[data-su][aria-pressed="true"]');
      var o = { FECHA: aTxt(iso), 'CANSANCIO (1-10)': leerEscala('ch-ca'), 'AGUJETAS (1-10)': leerEscala('ch-ag'),
        'ZONAS CARGADAS': [].map.call($scrim.querySelectorAll('[data-z].on'), function (b) { return b.dataset.z; }).join(', '), 'SUEÑO': su ? su.dataset.su : '', NOTAS: val('ch-n') };
      if (!o['CANSANCIO (1-10)'] && !o['AGUJETAS (1-10)']) { toast('Marca al menos el cansancio o las agujetas'); return; }
      var b = document.getElementById('ch-ok'); b.disabled = true;
      apiGuardar({ action: 'chequeo', chequeo: o }).then(ok).then(function (r) {
        var nuevo = r.chequeo || Object.assign({ 'RECOMENDACIÓN': 'Guardado sin conexión: el ajuste se calcula al volver la red.' }, o);
        S.data.chequeos = (S.data.chequeos || []).filter(function (x) { return aIso(x.FECHA) !== iso; }).concat([nuevo]);
        cerrarHoja(); render(); toast(nuevo['SEMÁFORO'] ? 'Semáforo ' + nuevo['SEMÁFORO'].toLowerCase() : 'Guardado');
      }).catch(falloApi(b));
    };
  }


  // ---------- v0.9.1 · Compartir el día como imagen (solo ejercicios) ----------
  /** Líneas que no son ejercicios (notas, referencias, «registra», por qué…): fuera de la imagen. */
  var NO_EJERCICIO = /^\s*(Registra|Dónde va|Referencia|Zona\b|⚙|REGLA|TÚ\b|Por qué|Cuándo|Ciencia|Atac|Plan de carrera|Va el|\(ajústala|★|↔|👥)/i;
  function bloquesCompartibles(x) {
    return x.bloques.filter(function (b) { return !/NO HACER|CANCELADO|OCULTO|PROPUESTA|SUSTITUIDO|SIN HUECO/.test(norm(b.estado || '')); });
  }
  function ejerciciosDe(b, conPrep) {
    return (b.partes || []).filter(function (p) { return p.tipo !== 'adapt' && (conPrep || p.tipo !== 'prep'); }).map(function (p) {
      var lin = String(p.texto || '').split('\n').filter(function (l) { return !NO_EJERCICIO.test(l); });
      while (lin.length && !lin[lin.length - 1].trim()) lin.pop();
      return { etiqueta: p.etiqueta || '', lineas: lin };
    }).filter(function (p) { return p.lineas.some(function (l) { return l.trim(); }); });
  }
  function seleccionCompartir(x, modo, marcados) {
    return bloquesCompartibles(x).filter(function (b, k) {
      return modo === 'AM' ? b.turno === 'AM' : modo === 'PM' ? b.turno === 'PM' : modo === 'sel' ? marcados[k] : true;
    });
  }
  /** Dibuja la pizarra en un canvas 1080 px de ancho (alto según el contenido). */
  function pintarPizarra(x, bloques, conPrep) {
    var W = 1080, P = 64, cv = document.createElement('canvas'), g = cv.getContext('2d');
    var cs = getComputedStyle(document.body), fBody = cs.getPropertyValue('--f-body') || 'system-ui, sans-serif', fDisp = cs.getPropertyValue('--f-display') || fBody;
    var C = { bg: '#0f1115', card: '#181b22', acc: '#ff7a1a', txt: '#f2f3f5', mut: '#9aa1ab', run: '#2f81f7' };
    var partir = function (txt, font, ancho) {
      g.font = font; var out = [];
      String(txt).split('\n').forEach(function (par) {
        if (!par.trim()) { out.push(''); return; }
        var pal = par.split(/\s+/), lin = '';
        pal.forEach(function (w) { var t = lin ? lin + ' ' + w : w; if (g.measureText(t).width > ancho && lin) { out.push(lin); lin = w; } else lin = t; });
        out.push(lin);
      });
      return out;
    };
    var F = { h1: '800 72px ' + fDisp, sub: '600 28px ' + fBody, turno: '800 30px ' + fDisp, tit: '800 40px ' + fDisp, lbl: '700 24px ' + fBody, txt: '500 31px ' + fBody, pie: '600 24px ' + fBody };
    var anchoTxt = W - 2 * P - 64, ops = [], y = P;
    var add = function (o) { ops.push(o); };
    var turnos = bloques.some(function (b) { return b.turno === 'AM'; }) && bloques.some(function (b) { return b.turno === 'PM'; });
    add({ t: 'txt', s: (NOMBRE_DIA[x.nombre] + ' ' + diaMes(x.iso)).toUpperCase(), f: F.h1, c: C.txt, y: y + 64 }); y += 92;
    add({ t: 'txt', s: 'ROAD TO ELITE' + (x.rpe ? ' · RPE ' + x.rpe : ''), f: F.sub, c: C.acc, y: y + 28 }); y += 64;
    var turno = null;
    bloques.forEach(function (b) {
      if (turnos && b.turno !== turno) { turno = b.turno; y += 8; add({ t: 'txt', s: turno === 'AM' ? 'MAÑANA' : 'TARDE', f: F.turno, c: C.mut, y: y + 30 }); y += 52; }
      var titulo = partir((b.extra ? '+ ' : (b.n ? b.n + '  ' : '')) + b.titulo, F.tit, anchoTxt), partes = ejerciciosDe(b, conPrep);
      var alto = 36 + titulo.length * 50 + 12;
      var cuerpo = partes.map(function (p) { var l = partir(p.lineas.join('\n'), F.txt, anchoTxt); alto += (p.etiqueta ? 44 : 0) + l.length * 42 + 18; return { e: p.etiqueta, l: l }; });
      var y0 = y;
      add({ t: 'card', y: y0, h: alto, c: b.extra ? (/CARRERA/.test(norm(b.origen || '')) ? C.run : C.acc) : '#3a3f4a' });
      y += 36;
      titulo.forEach(function (l) { add({ t: 'txt', s: l, f: F.tit, c: b.extra ? C.acc : C.txt, y: y + 38, x: P + 36 }); y += 50; });
      y += 12;
      cuerpo.forEach(function (p) {
        if (p.e) { add({ t: 'txt', s: p.e.toUpperCase(), f: F.lbl, c: C.mut, y: y + 30, x: P + 36 }); y += 44; }
        p.l.forEach(function (l) { add({ t: 'txt', s: l, f: F.txt, c: C.txt, y: y + 32, x: P + 36 }); y += 42; });
        y += 18;
      });
      y = y0 + alto + 24;
    });
    add({ t: 'txt', s: 'Road To Elite', f: F.pie, c: C.mut, y: y + 30 }); y += 30 + P;
    cv.width = W; cv.height = Math.max(y, 600);
    g.fillStyle = C.bg; g.fillRect(0, 0, W, cv.height);
    g.fillStyle = C.acc; g.fillRect(0, 0, W, 10);
    ops.forEach(function (o) {
      if (o.t === 'card') {
        var r = 22, x0 = P, w = W - 2 * P;
        g.fillStyle = C.card; g.beginPath(); g.moveTo(x0 + r, o.y); g.arcTo(x0 + w, o.y, x0 + w, o.y + o.h, r); g.arcTo(x0 + w, o.y + o.h, x0, o.y + o.h, r); g.arcTo(x0, o.y + o.h, x0, o.y, r); g.arcTo(x0, o.y, x0 + w, o.y, r); g.closePath(); g.fill();
        g.fillStyle = o.c; g.fillRect(x0, o.y + 14, 8, o.h - 28);
      } else { g.font = o.f; g.fillStyle = o.c; g.textBaseline = 'alphabetic'; g.fillText(o.s, o.x || P, o.y); }
    });
    return cv;
  }
  /** Versión en texto (para WhatsApp, Telegram o correo sin imagen). */
  function textoPizarra(x, bloques, conPrep) {
    var out = [(NOMBRE_DIA[x.nombre] + ' ' + diaMes(x.iso)).toUpperCase()], turno = null;
    var turnos = bloques.some(function (b) { return b.turno === 'AM'; }) && bloques.some(function (b) { return b.turno === 'PM'; });
    bloques.forEach(function (b) {
      if (turnos && b.turno !== turno) { turno = b.turno; out.push('', turno === 'AM' ? '— MAÑANA —' : '— TARDE —'); }
      out.push('', '*' + (b.extra ? '+ ' : (b.n ? b.n + '. ' : '')) + b.titulo + '*');
      ejerciciosDe(b, conPrep).forEach(function (p) { if (p.etiqueta) out.push('_' + p.etiqueta + '_'); out.push(p.lineas.join('\n')); });
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  function abrirCompartir(i) {
    var x = S.data.dias[i]; if (!x) return;
    var lista = bloquesCompartibles(x);
    if (!lista.length) { toast('Este día no tiene bloques que compartir'); return; }
    var hayAM = lista.some(function (b) { return b.turno === 'AM'; }), hayPM = lista.some(function (b) { return b.turno === 'PM'; });
    var st = { modo: 'todo', marcados: lista.map(function () { return true; }), prep: true, blob: null, url: null };
    var nombre = 'road-to-elite-' + norm(NOMBRE_DIA[x.nombre]).toLowerCase() + '-' + x.iso + '.png';
    abrirHoja('<div class="row"><h2>Compartir · ' + esc(NOMBRE_DIA[x.nombre]) + ' ' + diaMes(x.iso) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="seg" role="group" aria-label="Qué compartir" id="sh-modo">' + [['todo', 'Todo'], ['AM', 'Mañana'], ['PM', 'Tarde'], ['sel', 'Elegir']].filter(function (m) { return m[0] === 'todo' || m[0] === 'sel' || (hayAM && hayPM && (m[0] === 'AM' || m[0] === 'PM')); })
        .map(function (m) { return '<button type="button" data-sm="' + m[0] + '" aria-pressed="' + (m[0] === 'todo') + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<div id="sh-sel" class="sh-sel" hidden>' + lista.map(function (b, k) { return '<label class="sh-b"><input type="checkbox" data-sb="' + k + '" checked><span>' + (b.turno === 'AM' ? '☀️ ' : '') + esc((b.extra ? '+ ' : (b.n ? b.n + ' · ' : '')) + b.titulo) + '</span></label>'; }).join('') + '</div>' +
      '<label class="sh-b"><input type="checkbox" id="sh-prep" checked><span>Incluir calentamiento y activación</span></label>' +
      '<div class="sh-prev"><img id="sh-img" alt="Vista previa de la pizarra del día"></div>' +
      '<button class="btn btn-primary" type="button" id="sh-share">Compartir imagen · WhatsApp, Telegram, correo…</button>' +
      '<div class="sh-row"><a class="btn" id="sh-save" download="' + nombre + '">Guardar imagen</a></div>' +
      '<div class="sh-row three"><a class="btn sm" id="sh-wa" target="_blank" rel="noopener">WhatsApp</a><a class="btn sm" id="sh-tg" target="_blank" rel="noopener">Telegram</a><a class="btn sm" id="sh-ml">Correo</a></div>' +
      '<div class="hint">«Compartir imagen» abre el menú del móvil con la captura. WhatsApp, Telegram y Correo mandan el texto de los ejercicios (para la imagen, guárdala y adjúntala). Solo salen los ejercicios: sin notas del coach, porqués ni referencias.</div>');
    var pintar = function () {
      var bl = seleccionCompartir(x, st.modo, st.marcados);
      var ok = bl.length > 0;
      ['sh-share', 'sh-save', 'sh-wa', 'sh-tg', 'sh-ml'].forEach(function (id) { document.getElementById(id).classList.toggle('dis', !ok); });
      if (!ok) { document.getElementById('sh-img').removeAttribute('src'); st.blob = null; return; }
      var cv = pintarPizarra(x, bl, st.prep), txt = textoPizarra(x, bl, st.prep);
      var img = document.getElementById('sh-img'); img.src = cv.toDataURL('image/png');
      document.getElementById('sh-save').href = img.src;
      document.getElementById('sh-wa').href = 'https://wa.me/?text=' + encodeURIComponent(txt);
      document.getElementById('sh-tg').href = 'https://t.me/share/url?url=' + encodeURIComponent(' ') + '&text=' + encodeURIComponent(txt);
      document.getElementById('sh-ml').href = 'mailto:?subject=' + encodeURIComponent('Entreno · ' + NOMBRE_DIA[x.nombre] + ' ' + diaMes(x.iso)) + '&body=' + encodeURIComponent(txt.replace(/[*_]/g, ''));
      st.blob = null; cv.toBlob(function (b) { st.blob = b; }, 'image/png');
    };
    $scrim.querySelectorAll('[data-sm]').forEach(function (b) {
      b.onclick = function () { st.modo = b.dataset.sm; $scrim.querySelectorAll('[data-sm]').forEach(function (y) { y.setAttribute('aria-pressed', y === b); }); document.getElementById('sh-sel').hidden = st.modo !== 'sel'; pintar(); };
    });
    $scrim.querySelectorAll('[data-sb]').forEach(function (c) { c.onchange = function () { st.marcados[+c.dataset.sb] = c.checked; pintar(); }; });
    document.getElementById('sh-prep').onchange = function () { st.prep = this.checked; pintar(); };
    document.getElementById('sh-share').onclick = function () {
      if (!st.blob) { toast('Preparando la imagen…'); return; }
      var f = new File([st.blob], nombre, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: 'Entreno · ' + NOMBRE_DIA[x.nombre] + ' ' + diaMes(x.iso) }).catch(function (e) { if (e && e.name !== 'AbortError') toast('No se pudo compartir: guárdala y adjúntala'); });
      } else { document.getElementById('sh-save').click(); toast('Este navegador no comparte imágenes: la he guardado para que la adjuntes'); }
    };
    pintar();
  }


  // ---------- v0.14 · REESTRUCTURAR (viaje · reorganización · competi) ----------
  var MAT_VIAJE = [['box', 'Tengo un box'], ['hspu', 'Pared HSPU'], ['pino', 'Pino / HSW'], ['rack_dominadas', 'Rack (C2B, pull-ups, T2B)'], ['anillas', 'Anillas'], ['bmu', 'Barra para BMU'], ['rack_estricto', 'Solo estrictos'],
    ['chaleco', 'Chaleco'], ['comba', 'Comba'], ['kb', 'Kettlebells'], ['barra', 'Barra y discos'], ['db', 'Mancuernas'], ['sandbag_hyrox', 'Sandbag HYROX'], ['sandbag', 'Sandbag'], ['cajon', 'Cajón'],
    ['slamball', 'Slamball'], ['cuerda', 'Cuerda'], ['fondos', 'Fondos']];
  var MAT_MEGA = [['barra', 'Barras'], ['db', 'Mancuernas'], ['kb', 'Kettlebells'], ['comba', 'Comba'], ['sandbag', 'Sandbag'], ['sandbag_hyrox', 'Sandbag HYROX'], ['rack_dominadas', 'Rack (C2B, pull-ups, T2B)'], ['anillas', 'Anillas'], ['bmu', 'Barra para BMU'],
    ['slamball', 'Slamball'], ['gusano2', 'Gusano de 2'], ['gusano3', 'Gusano de 3'], ['gusano4', 'Gusano de 4'], ['ergos', 'Assault / ski / remo'], ['yugo', 'Yugo'], ['trineo', 'Trineo'], ['cuerda', 'Cuerda'],
    ['lodge_lanzar', 'Lodge para lanzar sandbag'], ['lodge_saltar', 'Lodge para saltar'], ['cajon', 'Cajón'], ['hspu', 'Pared HSPU'], ['_correr', 'Se puede correr']];
  function chipsMat(id, lista, sel) { sel = sel || []; return '<div class="zonas" id="' + id + '">' + lista.map(function (m) { var on = sel.indexOf(m[0]) >= 0; return '<button type="button" class="zona' + (on ? ' on' : '') + '" data-mk="' + m[0] + '" aria-pressed="' + on + '">' + esc(m[1]) + '</button>'; }).join('') + '</div>'; }
  function leerChips(id) { var el = document.getElementById(id); return el ? [].map.call(el.querySelectorAll('.zona.on'), function (b) { return b.dataset.mk; }) : []; }
  function enlazarChips(raiz) { (raiz || document).querySelectorAll('.zona[data-mk]').forEach(function (b) { b.onclick = function () { var on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }; }); }
  function diasRestantes() { var d = S.data; return d.dias.filter(function (x) { return x.iso >= d.hoy; }); }
  function etqDia(iso) { var x = S.data.dias.filter(function (y) { return y.iso === iso; })[0]; return (x ? NOMBRE_DIA[x.nombre].slice(0, 3) : '') + ' ' + diaMes(iso); }
  function segHtml(id, ops, val) { return '<div class="seg" role="group" id="' + id + '">' + ops.map(function (o) { return '<button type="button" data-sv="' + o[0] + '" aria-pressed="' + (o[0] === val) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
  function enlazarSeg(id, fn) { var g = document.getElementById(id); if (!g) return; g.querySelectorAll('[data-sv]').forEach(function (b) { b.onclick = function () { g.querySelectorAll('[data-sv]').forEach(function (y) { y.setAttribute('aria-pressed', y === b); }); if (fn) fn(b.dataset.sv); }; }); }
  function valSeg(id) { var b = document.querySelector('#' + id + ' [aria-pressed="true"]'); return b ? b.dataset.sv : ''; }

  function verBloqueDet(id) {
    var x = bloqueParaVer(id); if (!x || !(x.cont || x.porque)) return '';
    return '<details class="ro-ver"><summary>Ver bloque</summary><div class="exp-body">' + (x.meta ? '<div class="hint">' + esc(x.meta) + '</div>' : '') +
      '<div class="prose-n pre">' + esc(x.cont || '') + '</div>' + (x.porque ? '<div class="hint"><i>' + esc(x.porque) + '</i></div>' : '') + '</div></details>';
  }
  function renderReest() {
    var d = S.data, R = S.reest = S.reest || {};
    var html = cabeceraVista('Reestructurar', 'Menú');
    if (R.propuesta) return renderPropuestaReest(html);
    if (!R.modo) {
      html += '<div class="hint">Adapta la semana a lo que te ha surgido. Primero ves la propuesta junto al plan original; nada se aplica sin tu OK y se puede deshacer.</div>' +
        [['Viaje', '✈️', 'Días fuera, qué material tienes y si puedes correr. Lo que no se pueda hacer se compensa en casa (máx. +40 %) o en el domingo.'],
         ['Reorganización', '🧩', 'Te quedan cosas sin hacer: marcas huecos y bloques pendientes y te monto una sesión clásica o un mega WOD.'],
         ['Competi', '🏆', 'Online / clasificatorio o física (RPE 10): valora el WOD, 24 h suaves, reorganiza antes (Fabrik primero), opciones después del evento y decides lo que no cabe.'],
         ['Trabajo metcon', '⚡', 'La semana no se toca: añade 1–3 metcons una mañana (fuerza, crossfit, core) con tu material, atacando lo que te falta del mes.']].map(function (m) {
          return '<button class="reest-card" type="button" data-rm="' + m[0] + '"><span class="rc-ico">' + m[1] + '</span><span><b>' + m[0] + '</b><span class="hint">' + m[2] + '</span></span></button>'; }).join('');
      html += '<div class="avf">' + bloqueDobles('re-dob', d.conf && d.conf['DOBLES (mañanas libres)']) + '</div>';
      if ((d.reest || []).length) html += '<h3 class="sec-t">Aplicadas esta semana</h3>' + d.reest.map(function (r) { return '<div class="xb reest"><div class="xb-h"><span class="tag">' + esc(r.modo) + '</span><b class="xb-t">' + esc(r.resumen) + '</b></div><button class="btn-ghost sm" type="button" data-rdes="' + esc(r.id) + '">Deshacer</button></div>'; }).join('');
      $app.innerHTML = html;
      document.getElementById('atras').onclick = function () { S.reest = null; abrirAjustes(); };
      cablearDobles('re-dob', d.semana);
      $app.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { R.modo = b.dataset.rm; render(); window.scrollTo({ top: 0 }); }; });
      $app.querySelectorAll('[data-rdes]').forEach(function (b) { b.onclick = function () { if (!confirmar(b, '¿Deshacer? Pulsa otra vez')) return; b.disabled = true;
        api({ action: 'reest_deshacer', id: b.dataset.rdes, lunes: d.semana }).then(ok).then(function (r) { aplicarSemana(r.semana); toast('Deshecha'); render(); }).catch(falloApi(b)); }; });
      return;
    }
    var dr = diasRestantes();
    if (R.modo === 'Viaje') {
      var perf = leer('rte-perfiles-mat') || {};
      html += '<form id="rf" class="avf"><h3 class="sec-t">✈️ Viaje</h3>' +
        '<div class="two"><div><label for="rv-d">Desde</label><select id="rv-d">' + dr.map(function (x) { return '<option value="' + x.iso + '">' + etqDia(x.iso) + '</option>'; }).join('') + '</select></div>' +
        '<div><label for="rv-h">Hasta</label><select id="rv-h">' + dr.map(function (x, i) { return '<option value="' + x.iso + '"' + (i === Math.min(2, dr.length - 1) ? ' selected' : '') + '>' + etqDia(x.iso) + '</option>'; }).join('') + '</select></div></div>' +
        '<label>Cada mañana y tarde del viaje</label><div class="hint">Libre = puedes entrenar · Desplazamiento = vas de viaje · Imposible = no se entrena. 🏃 = puedes correr ese turno · 🥾 = minutos de ruta andando.</div>' +
        '<div id="rv-dias">' + dr.map(function (x) { return '<div class="rv-dia" data-iso="' + x.iso + '"><b>' + etqDia(x.iso) + '</b>' + ['AM', 'PM'].map(function (t) {
          return '<div class="rv-t"><span class="tag">' + t + '</span><select data-est="' + t + '"><option value="libre">Libre</option><option value="desplazamiento">Desplazamiento</option><option value="imposible">Imposible</option></select>' +
            '<label class="sh-b"><input type="checkbox" data-run="' + t + '"><span>🏃</span></label><input class="rv-min" inputmode="numeric" placeholder="🥾 min" data-ruta="' + t + '">' +
            '<details class="rv-exc"><summary>Material distinto</summary>' + chipsMat('rx-' + x.iso + '-' + t, MAT_VIAJE) + '</details></div>'; }).join('') + '</div>'; }).join('') + '</div>' +
        '<label>Material del viaje</label>' + (Object.keys(perf).length ? '<select id="rv-perf"><option value="">Cargar perfil guardado…</option>' + Object.keys(perf).map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('') + '</select>' : '') +
        chipsMat('rv-mat', MAT_VIAJE) + '<div class="two"><div><label for="rv-db">Mancuernas hasta (kg)</label><input id="rv-db" inputmode="decimal"></div><div><label for="rv-pn">Guardar como perfil</label><input id="rv-pn" placeholder="Ej. Gym hotel"></div></div>' +
        '<label>Si puedes correr, ¿qué?</label>' + chipsMat('rv-cor', [['libre', 'Libre / continua'], ['tempo', 'Tempo'], ['series', 'Series']], ['libre']) +
        '<label class="sh-b"><input type="checkbox" id="rv-dom" checked><span>Si el domingo estoy en casa, meter ahí un día completo</span></label>' +
        '<button class="btn btn-primary" type="submit">Ver propuesta</button><button class="btn" type="button" id="rf-v">Cambiar de modo</button></form>';
    } else if (R.modo === 'Reorganización') {
      var bls = []; d.dias.forEach(function (x) { x.bloques.forEach(function (b) { if (!/NO HACER|CANCELADO|OCULTO|PROPUESTA/.test(norm(b.estado || '')) && (b.idPlan || b.id)) bls.push({ x: x, b: b }); }); });
      var hecho = function (b) { return (d.registro || []).some(function (r) { return r.ID_PLAN === (b.idPlan || b.id) && r.HECHO === 'Sí'; }); };
      var corre = function (b) { return norm(b.origen || '') === 'CARRERA' || /\b(W01|W02|W04|V01)\b/.test(b.codigos || ''); };
      var dobR = String(d.conf && d.conf['DOBLES (mañanas libres)'] || '');
      html += '<form id="rf" class="avf"><h3 class="sec-t">🧩 Reorganización</h3>' +
        bloqueDobles('ro-dob', dobR) +
        '<label>Huecos que te quedan (y minutos)</label><div id="ro-h">' + dr.map(function (x) { return '<div class="rv-dia"><b>' + etqDia(x.iso) + '</b>' + ['AM', 'PM'].map(function (t) {
          return '<label class="sh-b"><input type="checkbox" data-hk="' + x.iso + '|' + t + '"' + (t === 'AM' && dobR.indexOf(diaCortoIso(x.iso)) >= 0 ? ' checked' : '') + '><span>' + t + '</span></label><input class="rv-min" inputmode="numeric" placeholder="min" data-hm="' + x.iso + '|' + t + '" value="' + (t === 'AM' ? 60 : 90) + '">'; }).join('') + '</div>'; }).join('') + '</div>' +
        '<label>Marca lo que NO has hecho (lo no marcado se da por hecho)</label><div class="ro-bl">' + bls.map(function (o) { var id = o.b.idPlan || o.b.id, h = hecho(o.b);
          var otros = bls.filter(function (q) { return (q.b.idPlan || q.b.id) !== id && !hecho(q.b); });
          return '<div class="ro-b"><label class="sh-b"><input type="checkbox" data-nh="' + esc(id) + '"' + (h ? ' disabled' : '') + '><span data-ver-blq="' + esc(id) + '">' + etqDia(o.x.iso) + ' ' + (o.b.turno || '') + ' · ' + esc(o.b.titulo) + (h ? ' <i>(hecho)</i>' : '') + '</span></label>' + verBloqueDet(id) +
            (corre(o.b) ? '<select data-car="' + esc(id) + '" hidden><option value="aparte">Si no la hice: aparte (≥6 h de la fuerza)</option><option value="metcon">Dentro del metcon (carrera o erg)</option><option value="no">Dejarla (Z2: +25 % la semana que viene)</option></select>' :
              '<div class="ro-dest" data-dest-box="' + esc(id) + '" hidden><span class="hint">¿Qué hago con él?</span><select data-dest="' + esc(id) + '">' +
              '<option value="auto">Intentar meterlo en los huecos que marque</option><option value="pendiente">Dejarlo pendiente para la semana que viene</option>' +
              '<option value="hueco">En un día y turno concreto…</option><option value="integrar">Integrarlo con otro bloque…</option><option value="mega">Dentro del mega WOD</option></select>' +
              '<select data-dest-h="' + esc(id) + '" hidden>' + dr.map(function (x) { return ['AM', 'PM'].map(function (t) { return '<option value="' + x.iso + '|' + t + '">' + etqDia(x.iso) + ' ' + t + '</option>'; }).join(''); }).join('') + '</select>' +
              '<select data-dest-i="' + esc(id) + '" hidden>' + otros.map(function (q) { return '<option value="' + esc(q.b.idPlan || q.b.id) + '">' + etqDia(q.x.iso) + ' ' + (q.b.turno || '') + ' · ' + esc(q.b.titulo) + '</option>'; }).join('') + '</select></div>') + '</div>'; }).join('') + '</div>' +
        '<div class="hint">Mantén pulsado un bloque para ver todo su contenido.</div>' +
        '<label for="ro-e">Añadir: escribe solo el estímulo (ej. «hspu») o diseña un bloque</label><div class="two"><input id="ro-e" placeholder="Estímulo"><button class="btn sm" type="button" id="ro-add">Añadir</button></div><div id="ro-n" class="dchips">' + (R.nuevos || []).map(function (n, i) { return '<span class="dchip">' + esc(n.estimulo || n.titulo) + '</span>'; }).join('') + '</div>' +
        '<details class="set"><summary>Diseñar un bloque a mano</summary><div class="set-body"><input id="ro-mt" placeholder="Título"><textarea id="ro-mc" rows="4" placeholder="Ejercicios"></textarea><input id="ro-mm" inputmode="numeric" placeholder="Minutos"><button class="btn sm" type="button" id="ro-madd">Añadir bloque</button></div></details>' +
        '<label>Tipo de sesión</label>' + segHtml('ro-tipo', [['A', 'A · Clásica'], ['B', 'B · Integrada (mega WOD)']], R.tipo || 'A') +
        '<div class="hint" id="ro-th">A: calentamiento activo (ya atacando pendientes) → skills → fuerza → metcon. B: un mega WOD de 30–75′ con todo lo pendiente.</div>' +
        '<div id="ro-b"' + (R.tipo === 'B' ? '' : ' hidden') + '><label>Formato</label>' + segHtml('ro-f', [['solo', 'Solo'], ['pareja', 'Pareja'], ['equipo3', 'Equipo 3'], ['equipo4', 'Equipo 4']], 'solo') +
        '<div class="two"><div><label for="ro-min">Minutos</label><input id="ro-min" inputmode="numeric" value="45"></div><div><label for="ro-ch">Atletas con chaleco</label><input id="ro-ch" inputmode="numeric" value="0"></div></div>' +
        '<label for="ro-de">⚙ Estímulos que quiero</label><input id="ro-de" maxlength="300" placeholder="ej. stoh, snatch, oh · intercalar carrera, calorías de assault">' +
        '<label>Material disponible</label>' + chipsMat('ro-mat', MAT_MEGA, ['barra', 'db', 'comba', 'ergos', 'rack_dominadas', 'cajon']) +
        '<div class="two"><div><label for="ro-bx">Barra máx. (kg)</label><input id="ro-bx" inputmode="decimal" value="60"></div><div><label for="ro-dx">Mancuerna máx. (kg)</label><input id="ro-dx" inputmode="decimal" value="22.5"></div></div>' +
        '<label class="sh-b"><input type="checkbox" id="ro-chica"><span>Hay chica en la pareja / equipo</span></label><div class="three" id="ro-chw" hidden><input id="ro-cb" inputmode="decimal" placeholder="Barra ♀ kg"><input id="ro-cd" inputmode="decimal" placeholder="DB ♀ kg"><input id="ro-cs" inputmode="decimal" placeholder="Sandbag ♀ kg"></div>' +
        '<label class="sh-b"><input type="checkbox" id="ro-cash" checked><span>Cerrar con 15′ de erg Z2 si queda endurance pendiente</span></label></div>' +
        '<button class="btn btn-primary" type="submit">Ver propuesta</button><button class="btn" type="button" id="rf-v">Cambiar de modo</button></form>';
    } else if (R.modo === 'Trabajo metcon') {
      var tmM = leer('rte-mat-metcon') || { mat: ['box'], nada: false, chaleco: false, correr: true }, hoyI = d.hoy || hoyLocal();
      var FMT = [['auto', 'Auto (según el foco)'], ['AMRAP', 'AMRAP'], ['EMOM', 'EMOM'], ['FOR_TIME', 'For time'], ['INTERVALOS', 'Intervalos ON/OFF'], ['EVERY', 'Every (potencia)'], ['VENTANAS', 'Heavy en ventanas'], ['CHIPPER', 'Chipper'], ['ESCALERA', 'Escalera 21-15-9']];
      var ROLES = { 1: ['Completo'], 2: ['Fuerza', 'CrossFit'], 3: ['Fuerza', 'CrossFit', 'Core'] }, nTm = R.tmN || 1;
      html += '<form id="rf" class="avf"><h3 class="sec-t">⚡ Trabajo metcon</h3><div class="hint">Mantiene exactamente la semana y lo ya programado. Solo añade metcons; los estímulos que cuentan son los que trabajan con volumen e intensidad de verdad.</div>' +
        '<div class="two"><div><label for="tm-d">Día</label><select id="tm-d">' + d.dias.map(function (x) { return '<option value="' + x.iso + '"' + (x.iso === hoyI ? ' selected' : '') + '>' + etqDia(x.iso) + '</option>'; }).join('') + '</select></div>' +
        '<div><label>Turno</label>' + segHtml('tm-tu', [['AM', 'Mañana'], ['PM', 'Tarde']], 'AM') + '</div></div>' +
        '<label>¿Cuántos metcons?</label>' + segHtml('tm-n', [['1', '1 · completo'], ['2', '2 · fuerza + crossfit'], ['3', '3 · + core']], String(nTm)) +
        '<div id="tm-filas">' + [0, 1, 2].map(function (i) { return '<div class="two tm-f" data-tmf="' + i + '"' + (i >= nTm ? ' hidden' : '') + '><div><label>Metcon ' + (i + 1) + ' · <span data-tmr="' + i + '">' + (ROLES[nTm][i] || '') + '</span> · min</label><select data-tmmin="' + i + '">' +
          [8, 10, 12, 15, 20, 25, 30].map(function (m) { return '<option' + (m === (i === 2 ? 10 : 15) ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
          '<div><label>Tipo</label><select data-tmfmt="' + i + '">' + FMT.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join('') + '</select></div></div>'; }).join('') + '</div>' +
        '<label class="sh-b"><input type="checkbox" id="tm-nada"' + (tmM.nada ? ' checked' : '') + '><span><b>No tengo material</b> · todo con peso corporal</span></label>' +
        '<div id="tm-matw"' + (tmM.nada ? ' hidden' : '') + '><label>Material que tienes</label>' + chipsMat('tm-mat', MAT_VIAJE.concat([['ergos', 'Assault / ski / remo'], ['trineo', 'Trineo'], ['yugo', 'Yugo'], ['gusano2', 'Gusano']]).filter(function (m) { return m[0] !== 'chaleco'; }), tmM.mat) + '</div>' +
        '<label class="sh-b"><input type="checkbox" id="tm-ch"' + (tmM.chaleco ? ' checked' : '') + '><span>Chaleco de peso</span></label>' +
        '<label class="sh-b"><input type="checkbox" id="tm-run"' + (tmM.correr ? ' checked' : '') + '><span>Se puede correr</span></label>' +
        '<button class="btn btn-primary" type="submit">Ver propuesta</button><button class="btn" type="button" id="rf-v">Cambiar de modo</button></form>';
    } else {
      var hoyC = d.hoy || hoyLocal(), enSemana = hoyC >= d.semana && hoyC <= sumarDias(d.semana, 6);
      html += '<form id="rf" class="avf"><h3 class="sec-t">🏆 Competi</h3><div class="hint">Una competi es RPE 10: hay que llegar fresco. 24 h antes solo movilidad, estiramientos y como mucho Z2 suave; antes se reorganiza la semana para no perder estímulos (Fabrik primero).</div>' +
        segHtml('rc-t', [['online', 'Online / clasificatorio (1 día)'], ['fisica', 'Física']], R.ctipo || 'online') +
        '<div id="rc-on"' + (R.ctipo === 'fisica' ? ' hidden' : '') + '><div class="two"><div><label for="rc-d">Día</label><select id="rc-d">' + d.dias.map(function (x) { return '<option value="' + x.iso + '">' + etqDia(x.iso) + '</option>'; }).join('') + '</select></div>' +
        '<div><label>Turno</label>' + segHtml('rc-tu', [['AM', 'Mañana'], ['PM', 'Tarde']], 'AM') + '</div></div>' +
        '<label class="sh-b" id="rc-tw"><input type="checkbox" id="rc-tarde"><span>Si es por la mañana: <b>entrenar por la tarde</b> (se reprograma esa tarde y los días siguientes)</span></label></div>' +
        '<div id="rc-fi"' + (R.ctipo === 'fisica' ? '' : ' hidden') + '><label>Días de competición</label>' + chipsMat('rc-dias', d.dias.map(function (x) { return [x.iso, etqDia(x.iso)]; })) + '</div>' +
        '<label for="rc-w">WOD(s) si los sabes</label><textarea id="rc-w" rows="5" placeholder="Pega el WOD o los WODs: valoro qué grupos musculares implica y los protejo en las 48 h previas"></textarea>' +
        '<label>Después del evento (en la misma sesión)</label>' + segHtml('rc-post', [['no', 'Nada'], ['pendientes', 'Pendientes de Fabrik'], ['extras', 'Extras'], ['ambos', 'Ambos (2 bloques)']], 'no') +
        '<div class="hint">Te doy 3 opciones ligeras que no repiten lo que carga el WOD (con «Ambos», 3 combinaciones de extra + bloque de Fabrik). Eliges una en la propuesta.</div>' +
        '<label class="sh-b"><input type="checkbox" id="rc-dom" checked><span>Entrenar el <b>domingo</b> (para recolocar lo que falte)</span></label>' +
        (enSemana ? '<label class="sh-b"><input type="checkbox" id="rc-hoy"><span>Reprogramar también <b>esta mañana</b> (' + esc(etqDia(hoyC)) + ')</span></label>' : '') +
        '<button class="btn btn-primary" type="submit">Ver propuesta</button><button class="btn" type="button" id="rf-v">Cambiar de modo</button></form>';
    }
    $app.innerHTML = html;
    enlazarChips($app);
    document.getElementById('atras').onclick = function () { S.reest = null; abrirAjustes(); };
    document.getElementById('rf-v').onclick = function () { S.reest = {}; render(); };
    var enviar = function (params) {
      var b = $app.querySelector('#rf [type=submit]'); b.disabled = true; b.textContent = 'Calculando…';
      api({ action: 'reest_proponer', modo: R.modo, lunes: d.semana, params: params }).then(ok).then(function (r) { R.params = params; R.propuesta = r.propuesta; R.ajustes = {}; render(); window.scrollTo({ top: 0 }); })
        .catch(function (e) { b.disabled = false; b.textContent = 'Ver propuesta'; toast(mensajeError(e.message)); });
    };
    if (R.modo === 'Viaje') {
      var sync = function () { var de = val('rv-d'), ha = val('rv-h'); $app.querySelectorAll('.rv-dia').forEach(function (r) { r.classList.toggle('dis', r.dataset.iso < de || r.dataset.iso > ha); }); };
      document.getElementById('rv-d').onchange = sync; document.getElementById('rv-h').onchange = sync; sync();
      var ps = document.getElementById('rv-perf'); if (ps) ps.onchange = function () { var p = (leer('rte-perfiles-mat') || {})[ps.value]; if (!p) return; $app.querySelectorAll('#rv-mat .zona').forEach(function (b) { var on = p.indexOf(b.dataset.mk) >= 0; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); };
      document.getElementById('rf').onsubmit = function (ev) {
        ev.preventDefault();
        var de = val('rv-d'), ha = val('rv-h'); if (ha < de) { toast('«Hasta» va antes de «Desde»'); return; }
        var p = { desde: de, hasta: ha, dias: {}, material: leerChips('rv-mat'), excepciones: {}, correr: {}, correrDias: {}, rutas: [], domingoCompleto: document.getElementById('rv-dom').checked, dbKg: val('rv-db') };
        leerChips('rv-cor').forEach(function (k) { p.correr[k] = true; });
        $app.querySelectorAll('.rv-dia').forEach(function (r) { var iso = r.dataset.iso; if (iso < de || iso > ha) return; p.dias[iso] = {};
          ['AM', 'PM'].forEach(function (t) { p.dias[iso][t] = r.querySelector('[data-est="' + t + '"]').value; if (r.querySelector('[data-run="' + t + '"]').checked) p.correrDias[iso + '|' + t] = true;
            var m = +r.querySelector('[data-ruta="' + t + '"]').value; if (m) p.rutas.push({ iso: iso, turno: t, min: m });
            var ex = leerChips('rx-' + iso + '-' + t); if (ex.length) p.excepciones[iso + '|' + t] = ex; }); });
        var pn = val('rv-pn'); if (pn) { var pf = leer('rte-perfiles-mat') || {}; pf[pn] = p.material; guardar('rte-perfiles-mat', pf); }
        enviar(p);
      };
    } else if (R.modo === 'Reorganización') {
      R.nuevos = R.nuevos || [];
      enlazarSeg('ro-tipo', function (v) { R.tipo = v; document.getElementById('ro-b').hidden = v !== 'B'; });
      enlazarSeg('ro-f');
      document.getElementById('ro-chica').onchange = function () { document.getElementById('ro-chw').hidden = !this.checked; };
      cablearDobles('ro-dob', d.semana, function (v) { $app.querySelectorAll('[data-hk$="|AM"]').forEach(function (c) { c.checked = v.indexOf(diaCortoIso(c.dataset.hk.split('|')[0])) >= 0; }); });
      document.getElementById('ro-add').onclick = function () { var e = val('ro-e'); if (!e) return; R.nuevos.push({ estimulo: e }); document.getElementById('ro-n').insertAdjacentHTML('beforeend', '<span class="dchip">' + esc(e) + '</span>'); document.getElementById('ro-e').value = ''; };
      document.getElementById('ro-madd').onclick = function () { var t = val('ro-mt'), c = val('ro-mc'); if (!t && !c) return; R.nuevos.push({ titulo: t || 'Bloque nuevo', contenido: c, min: +val('ro-mm') || 15 }); document.getElementById('ro-n').insertAdjacentHTML('beforeend', '<span class="dchip">' + esc(t || 'Bloque nuevo') + '</span>'); ['ro-mt', 'ro-mc', 'ro-mm'].forEach(function (i) { document.getElementById(i).value = ''; }); };
      $app.querySelectorAll('[data-nh]').forEach(function (cb) { cb.onchange = function () { var id = cb.dataset.nh, bx = $app.querySelector('[data-dest-box="' + CSS.escape(id) + '"]'), cs = $app.querySelector('[data-car="' + CSS.escape(id) + '"]');
        if (bx) bx.hidden = !cb.checked; if (cs) cs.hidden = !cb.checked; }; });
      $app.querySelectorAll('[data-dest]').forEach(function (s) { s.onchange = function () { var id = s.dataset.dest;
        $app.querySelector('[data-dest-h="' + CSS.escape(id) + '"]').hidden = s.value !== 'hueco'; $app.querySelector('[data-dest-i="' + CSS.escape(id) + '"]').hidden = s.value !== 'integrar'; }; });
      document.getElementById('rf').onsubmit = function (ev) {
        ev.preventDefault();
        var destino = {}; $app.querySelectorAll('[data-dest]').forEach(function (s) { var id = s.dataset.dest, cb = $app.querySelector('[data-nh="' + CSS.escape(id) + '"]'); if (!cb || !cb.checked) return;
          destino[id] = s.value === 'hueco' ? 'hueco|' + $app.querySelector('[data-dest-h="' + CSS.escape(id) + '"]').value : s.value === 'integrar' ? 'integrar|' + $app.querySelector('[data-dest-i="' + CSS.escape(id) + '"]').value : s.value; });
        var huecos = [].filter.call($app.querySelectorAll('[data-hk]'), function (c) { return c.checked; }).map(function (c) { var k = c.dataset.hk.split('|'); return { iso: k[0], turno: k[1], min: +($app.querySelector('[data-hm="' + c.dataset.hk + '"]').value) || 60 }; });
        var nh = [].filter.call($app.querySelectorAll('[data-nh]'), function (c) { return c.checked; }).map(function (c) { return c.dataset.nh; });
        var necesitaHueco = (R.tipo === 'B') || (R.nuevos || []).length || nh.some(function (id) { var v = destino[id]; return !v || v === 'auto' || v === 'mega' || /^aparte|^metcon/.test(((($app.querySelector('[data-car="' + CSS.escape(id) + '"]') || {}).value) || '')); });
        if (!huecos.length && necesitaHueco) { toast('Marca al menos un hueco (o elige otro destino para cada bloque)'); return; }
        var p = { huecos: huecos, noHechos: [].filter.call($app.querySelectorAll('[data-nh]'), function (c) { return c.checked; }).map(function (c) { return c.dataset.nh; }), nuevos: R.nuevos, carrera: {}, tipo: R.tipo || 'A' };
        $app.querySelectorAll('[data-car]').forEach(function (s) { p.carrera[s.dataset.car] = s.value; });
        if (!p.noHechos.length && !p.nuevos.length) { toast('Marca algún bloque no hecho o añade uno'); return; }
        p.destino = destino;
        if (p.tipo === 'B' || Object.keys(destino).some(function (k) { return destino[k] === 'mega'; })) p.mega = { formato: valSeg('ro-f') || 'solo', minutos: +val('ro-min') || 45, chaleco: +val('ro-ch') || 0, material: leerChips('ro-mat'), barraMax: +String(val('ro-bx')).replace(',', '.') || 60, dbMax: +String(val('ro-dx')).replace(',', '.') || 22.5,
          chica: document.getElementById('ro-chica').checked ? { barra: val('ro-cb'), db: val('ro-cd'), sandbag: val('ro-cs') } : null, cashout: document.getElementById('ro-cash').checked, deseo: val('ro-de') };
        enviar(p);
      };
    } else if (R.modo === 'Trabajo metcon') {
      var ROLES2 = { 1: ['Completo'], 2: ['Fuerza', 'CrossFit'], 3: ['Fuerza', 'CrossFit', 'Core'] };
      enlazarSeg('tm-tu');
      enlazarSeg('tm-n', function (v) { R.tmN = +v; $app.querySelectorAll('[data-tmf]').forEach(function (f) { f.hidden = +f.dataset.tmf >= +v; }); $app.querySelectorAll('[data-tmr]').forEach(function (r) { r.textContent = ROLES2[+v][+r.dataset.tmr] || ''; }); });
      document.getElementById('tm-nada').onchange = function () { document.getElementById('tm-matw').hidden = this.checked; };
      document.getElementById('rf').onsubmit = function (ev) {
        ev.preventDefault();
        var n = +(valSeg('tm-n') || 1), p = { iso: val('tm-d'), turno: valSeg('tm-tu') || 'AM', n: n, min: [], formato: [], nada: document.getElementById('tm-nada').checked, material: leerChips('tm-mat'), chaleco: document.getElementById('tm-ch').checked, correr: document.getElementById('tm-run').checked };
        for (var i = 0; i < n; i++) { p.min.push(+$app.querySelector('[data-tmmin="' + i + '"]').value); p.formato.push($app.querySelector('[data-tmfmt="' + i + '"]').value); }
        if (!p.nada && !p.material.length) { toast('Marca tu material o «No tengo material»'); return; }
        guardar('rte-mat-metcon', { mat: p.material, nada: p.nada, chaleco: p.chaleco, correr: p.correr });
        enviar(p);
      };
    } else {
      enlazarSeg('rc-t', function (v) { R.ctipo = v; document.getElementById('rc-on').hidden = v === 'fisica'; document.getElementById('rc-fi').hidden = v !== 'fisica'; });
      enlazarSeg('rc-tu', function (v) { document.getElementById('rc-tw').hidden = v !== 'AM'; }); enlazarSeg('rc-post');
      document.getElementById('rf').onsubmit = function (ev) {
        ev.preventDefault();
        var t = valSeg('rc-t') || 'online', hoyB = document.getElementById('rc-hoy'), p = { v: 2, tipo: t, wod: val('rc-w'), post: valSeg('rc-post') || 'no', tarde: document.getElementById('rc-tarde').checked, domingo: document.getElementById('rc-dom').checked, hoyManana: !!(hoyB && hoyB.checked) };
        if (t === 'online') { p.iso = val('rc-d'); p.turno = valSeg('rc-tu') || 'AM'; } else { p.dias = leerChips('rc-dias'); if (!p.dias.length) { toast('Marca los días de competición'); return; } }
        enviar(p);
      };
    }
  }
  var ACC_REEST = { cancelar: 'No hacer', adaptar: 'Adaptado', mover: 'Movido', nuevo: 'Nuevo', pendiente: 'A pendientes', suprimir: 'Se quita', sustituir: 'Se reorganiza', 'nuevo-pendiente': 'A pendientes' };
  function renderPropuestaReest(html) {
    var R = S.reest, P = R.propuesta, d = S.data;
    var opts = '<option value="">Como propone</option>' + d.dias.filter(function (x) { return x.iso >= d.hoy; }).map(function (x) { return ['AM', 'PM'].map(function (t) { return '<option value="' + x.iso + '|' + t + '">' + etqDia(x.iso) + ' ' + t + '</option>'; }).join(''); }).join('') + '<option value="pendiente">A pendientes</option><option value="quitar">Quitar</option>';
    html += '<section class="me" style="display:block"><b>' + esc(P.resumen) + '</b>' + (P.avisos || []).map(function (a) { return '<div class="hint">⚠ ' + esc(a) + '</div>'; }).join('') +
      (P.mejorHueco ? '<div class="hint">🎯 Mejor hueco para grabar (menos fatiga en las 48 h previas): ' + P.mejorHueco.map(function (h) { return etqDia(h.iso) + ' ' + h.turno; }).join(' · ') + ' (el 2.º, para un segundo intento).</div>' : '') +
      (P.valoracion && P.valoracion.length ? '<div class="part-lbl">Grupos implicados · RPE 10, llegar fresco</div>' + P.valoracion.map(function (v) { return '<div class="hint">• ' + esc(v) + '</div>'; }).join('') :
        P.implicados && P.implicados.length ? '<div class="hint">El WOD implica: ' + esc(P.implicados.join(', ').toLowerCase()) + '. Es lo que protejo.</div>' : '') + '</section>';
    if (P.opcionesPost && P.opcionesPost.length) html += '<section class="me" style="display:block"><b>Después de la competi · elige una</b>' +
      '<label class="sh-b"><input type="radio" name="rp-post" value=""' + (R.post == null ? ' checked' : '') + '><span>Nada</span></label>' +
      P.opcionesPost.map(function (o) { return '<label class="sh-b"><input type="radio" name="rp-post" value="' + o.k + '"' + (R.post === o.k ? ' checked' : '') + '><span><b>' + esc(o.titulo) + '</b> · ' + esc(o.min) + '′</span></label>'; }).join('') +
      '<div class="hint">Van justo después del evento, en la misma sesión. Elegidas para no repetir lo que ha cargado el WOD.</div></section>';
    html += P.cambios.filter(function (c) { return c.accion !== 'sustituir'; }).map(function (c) {
      var desde = c.desdeIso ? etqDia(c.desdeIso) + ' ' + (c.desdeTurno || '') : '', a = c.iso ? etqDia(c.iso) + ' ' + (c.turno || '') : '';
      var cont = c.contenido || (c.nuevo && c.nuevo.CONTENIDO) || '';
      return '<div class="xb rp-' + c.accion + '"><div class="xb-h"><span class="tag">' + (ACC_REEST[c.accion] || c.accion) + '</span><b class="xb-t"' + (c.id ? ' data-ver-blq="' + esc(c.id) + '"' : '') + '>' + esc(c.titulo || '') + '</b></div>' +
        '<div class="xb-p">' + (desde ? '<span>' + esc(desde) + '</span>' : '') + (a ? '<span>→ <b>' + esc(a) + '</b></span>' : '') + '</div><div class="hint">' + esc(c.motivo || '') + '</div>' +
        (cont ? '<details class="alt"><summary>Ver contenido</summary><div class="exp-body"><div class="prose-n pre">' + esc(cont) + '</div></div></details>' : (c.id ? verBloqueDet(c.id) : '')) +
        (c.noCabe ? '<div class="pos-act warn"><b>No cabe</b><span>Decide: no hacer, a pendientes' + (c.carreraErg ? ' (tal cual o +25 %)' : '') + ' o el hueco que quieras.</span></div>' : '') +
        (c.accion !== 'nuevo-pendiente' ? '<select class="rp-sel" data-k="' + c.k + '">' + opts + (c.nuevo ? '' : '<option value="cancelar">✕ No hacer (cancelar)</option>') +
          (c.carreraErg ? '<option value="pendiente_tal">Pendiente tal cual (semana que viene)</option><option value="pendiente25">Pendiente con +25 % de volumen</option>' : '') + '</select>' : '') + '</div>';
    }).join('');
    html += '<button class="btn btn-primary" type="button" id="rp-ok">Aplicar la semana adaptada</button><button class="btn" type="button" id="rp-back">Cambiar respuestas</button><button class="btn-ghost" type="button" id="rp-no">Descartar</button>' +
      '<div class="hint">Después, en cada día cambiado puedes ver «Adaptada» u «Original (Fabrik + extras)». Se puede deshacer desde Reestructurar.</div>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = function () { S.reest = null; abrirAjustes(); };
    $app.querySelectorAll('[name="rp-post"]').forEach(function (r) { r.onchange = function () { R.post = r.value === '' ? null : +r.value; }; });
    $app.querySelectorAll('.rp-sel').forEach(function (s) { s.onchange = function () { var v = s.value, k = +s.dataset.k; if (!v) delete R.ajustes[k]; else if (/^(pendiente|quitar|cancelar|pendiente25|pendiente_tal)$/.test(v)) R.ajustes[k] = { k: k, destino: v }; else { var x = v.split('|'); R.ajustes[k] = { k: k, iso: x[0], turno: x[1] }; } }; });
    document.getElementById('rp-back').onclick = function () { R.propuesta = null; render(); };
    document.getElementById('rp-no').onclick = function () { S.reest = {}; render(); };
    document.getElementById('rp-ok').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Aplicando…';
      api({ action: 'reest_aplicar', id: P.id, lunes: d.semana, ajustes: Object.keys(R.ajustes).map(function (k) { return R.ajustes[k]; }).concat(R.post != null ? [{ post: R.post }] : []) }).then(ok).then(function (r) {
        aplicarSemana(r.semana); S.reest = null; S.vista = 'semana'; render(); toast('Semana adaptada · ' + r.aplicado.nuevas + ' bloques');
      }).catch(falloApi(b));
    };
  }
  function abrirMaterialNuevo(iso) {
    abrirHoja('<div class="row"><h2>Material nuevo · ' + etqDia(iso) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">Marca lo que tienes ahora. Te creo un bloque nuevo (en borrador, editable) con lo que más te falta y se puede hacer con ese material. Para ampliar un bloque que ya tienes, ábrelo y usa «↔ Mover / editar».</div>' +
      segHtml('mn-t', [['AM', 'Mañana'], ['PM', 'Tarde']], 'PM') + chipsMat('mn-m', MAT_VIAJE) + '<button class="btn btn-primary" type="button" id="mn-ok">Crear bloque</button>');
    enlazarChips($scrim); enlazarSeg('mn-t');
    document.getElementById('mn-ok').onclick = function () {
      var b = this, m = leerChips('mn-m'); if (!m.length) { toast('Marca algún material'); return; } b.disabled = true;
      api({ action: 'reest_material', lunes: S.data.semana, iso: iso, turno: valSeg('mn-t') || 'PM', material: m }).then(ok).then(function (r) { aplicarSemana(r.semana); cerrarHoja(); render(); toast('Bloque creado: ' + r.bloque['TÍTULO']); })
        .catch(falloApi(b));
    };
  }


  // ---------- v0.11 · Extras de la semana en curso ----------
  function renderExtras() {
    var d = S.data, X = S.extrasCurso && S.extrasCurso.lunes === d.semana ? S.extrasCurso : null;
    var html = cabeceraVista('Extras semana en curso', 'Menú');
    if (!X) {
      $app.innerHTML = html + '<div class="hint">Calculando qué suma cada extra…</div>';
      document.getElementById('atras').onclick = function () { abrirAjustes(); };
      api({ action: 'extras_curso', lunes: d.semana }).then(ok).then(function (r) { S.extrasCurso = r.extras; if (S.vista === 'extras') render(); }).catch(function (e) { toast(mensajeError(e.message)); });
      return;
    }
    html += '<section class="me" style="display:block"><b>Semana del ' + fechaCorta(X.lunes) + ' · ' + esc(cap(X.mes)) + '</b>' +
      '<div class="xk"><div><b>+' + num1(X.aporteSemanaMes) + ' pp</b><span>suman al mes los extras de esta semana</span></div>' +
      '<div><b>' + num1(X.acumuladoMes) + ' %</b><span>acumulado del mes (programado) · hecho ' + num1(X.realizadoMes) + ' %</span></div>' +
      '<div><b>+' + num1(X.aporteExtrasMes) + ' pp</b><span>aportan todos los extras del mes</span></div>' +
      '<div><b>' + num1(X.semanaSin) + ' → ' + num1(X.semanaCon) + ' %</b><span>metas de la semana sin y con extras</span></div></div>' +
      (X.borradores ? '<div class="hint">⚠ ' + X.borradores + ' en borrador: ya cuentan como programados, pero apruébalos en la hoja de la semana.</div>' : '') + '</section>';
    if (!X.bloques.length) html += '<div class="empty">Aún no hay extras esta semana. Cárgalos desde la hoja de la semana.</div>';
    var porDia = {};
    X.bloques.forEach(function (b) { (porDia[b.fecha] = porDia[b.fecha] || []).push(b); });
    Object.keys(porDia).sort().forEach(function (iso) {
      html += '<section class="h-dia"><div class="h-cab"><b>' + esc(porDia[iso][0].dia) + ' ' + diaMes(iso) + '</b></div>' + porDia[iso].map(function (b) {
        return '<div class="xb' + (b.clave ? ' clave' : '') + '"><div class="xb-h"><span class="tag">' + b.turno + '</span><b class="xb-t">' + esc(b.titulo) + '</b>' +
          (b.estado === 'BORRADOR' ? '<span class="tag draft">Borrador</span>' : '<span class="tag ok">Aprobado</span>') + '</div>' +
          (b.metas.length ? '<div class="xb-m">' + b.metas.map(function (m) { return '<span class="chip-m">' + esc(m) + '</span>'; }).join('') + '</div>' : '<div class="hint">No cubre ninguna meta activa</div>') +
          '<div class="xb-p"><span>Mes <b>+' + num1(b.aporteMes) + ' pp</b></span><span>Semana <b>+' + num1(b.aporteSemana) + ' pp</b></span>' + (b.clave ? '<span class="xb-c">🎯 ' + esc(b.clave) + '</span>' : '') + '</div></div>';
      }).join('') + '</section>';
    });
    html += '<div class="hint">pp = puntos porcentuales que sube la cobertura gracias a ese extra. También en la pestaña APP · RESUMEN del Sheet.</div><button class="btn" type="button" id="xc-re">Actualizar</button>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = function () { abrirAjustes(); };
    document.getElementById('xc-re').onclick = function () { S.extrasCurso = null; render(); };
  }

  // ---------- v0.6 · añadir bloque (borrador) y plantillas ----------
  function filaPlan(id) { return (S.data.plan || []).filter(function (r) { return r.ID === id; })[0] || null; }
  function abrirNuevoBloque(iso) {
    var pintar = function (pls) {
      var sel = function (id, v, l) { return '<select id="' + id + '">' + l.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select>'; };
      abrirHoja('<div class="row"><h2>Añadir bloque · ' + fechaCorta(iso) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
        '<form id="nbf" class="avf">' + (pls && pls.length ? '<label for="nb-pl">Desde plantilla</label><select id="nb-pl"><option value="">— En blanco —</option>' +
          pls.map(function (p, i) { return '<option value="' + i + '">' + esc(p.NOMBRE) + '</option>'; }).join('') + '</select>' : '<div class="hint">Aún no tienes plantillas: guarda cualquier bloque EXTRA con «☆ Guardar como plantilla».</div>') +
        '<div class="two"><div><label for="nb-tu">Turno</label>' + sel('nb-tu', 'PM', ['AM', 'PM']) + '</div><div><label for="nb-or">Tipo</label>' + sel('nb-or', 'EXTRA', ['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD']) + '</div></div>' +
        '<div class="motor-box"><label for="nb-de">⚙ Estímulos que quiero (el motor diseña el metcon)</label><textarea id="nb-de" rows="2" maxlength="300" placeholder="ej. stoh, snatch, oh · o · intercalar carrera, calorías de assault · amrap 16"></textarea>' +
        '<div class="two"><input id="nb-dm" inputmode="numeric" placeholder="Minutos (opcional)"><button class="btn sm" type="button" id="nb-gen">Generar con el motor</button></div><div id="nb-dr" class="hint"></div></div>' +
        '<label for="nb-ti">Título</label><input id="nb-ti" required maxlength="120">' +
        '<label for="nb-co">Contenido (como en la pizarra)</label><textarea id="nb-co" rows="4"></textarea>' +
        '<div class="three"><div><label for="nb-mi">Min</label><input id="nb-mi" inputmode="numeric"></div><div><label for="nb-ca">Cantidad</label><input id="nb-ca" inputmode="numeric" placeholder="saltos…"></div>' +
        '<div><label for="nb-cd">Códigos</label><input id="nb-cd" maxlength="60" placeholder="W10"></div></div>' +
        '<label for="nb-in">Intensidad</label><input id="nb-in" maxlength="40" placeholder="RPE 6–7">' +
        '<label for="nb-pq">Por qué va aquí</label><textarea id="nb-pq" rows="2"></textarea>' +
        '<div class="hint">Entra en BORRADOR: cuenta en la cobertura como borrador hasta que apruebes el plan.</div>' +
        '<button class="btn btn-primary" type="submit" id="nb-ok">Añadir</button></form>');
      document.getElementById('nb-gen').onclick = function () {
        var de = val('nb-de'), g = this; if (!de) { toast('Escribe los estímulos que quieres'); return; }
        g.disabled = true; g.textContent = 'Diseñando…';
        api({ action: 'metcon_generar', deseo: de, min: +val('nb-dm') || 0, lunes: S.data.semana }).then(ok).then(function (r) {
          g.disabled = false; g.textContent = 'Generar otra vez';
          var b = r.metcon.bloque, put = function (id, v) { var el = document.getElementById(id); if (el && v != null) el.value = v; };
          put('nb-ti', b['TÍTULO']); put('nb-co', b.CONTENIDO); put('nb-mi', b.MIN); put('nb-cd', b['CÓDIGOS']); put('nb-in', b.INTENSIDAD); put('nb-pq', b['POR QUÉ (cursiva)']); put('nb-or', 'EXTRA');
          S._plElegida = { 'CIENCIA (técnica · fisiología · biología)': b['CIENCIA (técnica · fisiología · biología)'], INTERFERENCIAS: b.INTERFERENCIAS };
          var en = r.metcon.entendido, lst = [].concat(en.movimientos, en.ergs).filter(Boolean);
          document.getElementById('nb-dr').innerHTML = 'Entendido: ' + esc(lst.join(', ') || '—') + (en.intercalar ? ' · intercalar ' + esc(en.intercalar) : '') + (r.metcon.referencia ? ' · estructura de <b>' + esc(r.metcon.referencia) + '</b>' : '') +
            (r.metcon.avisos.length ? '<br>' + r.metcon.avisos.map(esc).join('<br>') : '') + '<br>Revísalo y edítalo abajo antes de añadirlo.';
        }).catch(falloApi(g));
      };
      var pl = document.getElementById('nb-pl');
      if (pl) pl.onchange = function () {
        var p = pls[+pl.value]; if (!p) return;
        var put = function (id, v) { var el = document.getElementById(id); if (el && v != null) el.value = v; };
        put('nb-or', p.ORIGEN || 'EXTRA'); put('nb-ti', p['TÍTULO']); put('nb-co', p.CONTENIDO); put('nb-mi', p.MIN); put('nb-ca', p.CANTIDAD); put('nb-cd', p['CÓDIGOS']); put('nb-in', p.INTENSIDAD); put('nb-pq', p['POR QUÉ (cursiva)']);
        S._plElegida = p;
      };
      document.getElementById('nbf').onsubmit = function (ev) {
        ev.preventDefault();
        var p = S._plElegida || {}, b = document.getElementById('nb-ok'); b.disabled = true;
        var bl = { fecha: iso, TURNO: val('nb-tu'), ORIGEN: val('nb-or'), 'TÍTULO': val('nb-ti'), CONTENIDO: val('nb-co'), MIN: val('nb-mi'), CANTIDAD: val('nb-ca'), 'CÓDIGOS': val('nb-cd').toUpperCase(),
          INTENSIDAD: val('nb-in'), 'POR QUÉ (cursiva)': val('nb-pq'), 'CIENCIA (técnica · fisiología · biología)': p['CIENCIA (técnica · fisiología · biología)'] || '', INTERFERENCIAS: p.INTERFERENCIAS || '' };
        S._plElegida = null;
        api({ action: 'bloque', bloque: bl, ver: S.data.semana }).then(ok).then(function (r) { aplicarSemana(r.semana); cerrarHoja(); render(); toast('Añadido en borrador'); }).catch(falloApi(b));
      };
    };
    if (S.plantillas) return pintar(S.plantillas);
    api({ action: 'plantillas' }).then(ok).then(function (r) { S.plantillas = r.plantillas; pintar(S.plantillas); }).catch(function () { pintar([]); });
  }
  function guardarComoPlantilla(id) {
    var r = filaPlan(id);
    if (!r) { toast('Este bloque no está en APP · PLAN'); return; }
    abrirHoja('<div class="row"><h2>Guardar como plantilla</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<form id="plf" class="avf"><label for="pl-n">Nombre de la plantilla</label><input id="pl-n" required maxlength="80" value="' + esc(r['TÍTULO'] || '') + '">' +
      '<div class="hint">Se guarda en APP · PLANTILLAS con su contenido, códigos y explicación.</div><button class="btn btn-primary" type="submit" id="pl-ok">Guardar</button></form>');
    document.getElementById('plf').onsubmit = function (ev) {
      ev.preventDefault();
      var b = document.getElementById('pl-ok'); b.disabled = true;
      var o = { NOMBRE: val('pl-n') }; ['ORIGEN', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CANTIDAD', 'CÓDIGOS', 'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS'].forEach(function (k) { if (r[k]) o[k] = r[k]; });
      api({ action: 'plantilla', plantilla: o }).then(ok).then(function (x) { S.plantillas = x.plantillas; cerrarHoja(); toast('Plantilla guardada'); }).catch(falloApi(b));
    };
  }

  // ---------- v0.6 · avisos al móvil (Firebase Cloud Messaging) ----------
  function htmlAvisos(d) {
    var listo = d.push && CFG.vapidKey && 'Notification' in window && 'serviceWorker' in navigator && window.PushManager;
    if (!d.push || !CFG.vapidKey) return '<div class="hint">Pendiente de activar en el servidor (2 pasos, sin coste). Cuando esté, aquí podrás activarlos en cada dispositivo.</div>';
    if (!listo) return '<div class="hint">Este navegador no admite avisos. En iPhone, instala primero la app en la pantalla de inicio.</div>';
    var on = Notification.permission === 'granted' && leer('rte-push-ok');
    return '<div class="hint">Te aviso de: plan listo para aprobar, propuesta de cambios, confirmar la semana (domingo) y el chequeo de la mañana si no lo has hecho.</div>' +
      '<button class="btn' + (on ? '' : ' btn-primary') + '" type="button" id="push-on">' + (on ? 'Mandar un aviso de prueba' : 'Activar avisos en este dispositivo') + '</button>';
  }
  function cargarScript(src) { return new Promise(function (bien, mal) { var s = document.createElement('script'); s.src = src; s.onload = bien; s.onerror = mal; document.head.appendChild(s); }); }
  function activarAvisos() {
    var v = (firebase.SDK_VERSION || '10.12.2');
    return (firebase.messaging ? Promise.resolve() : cargarScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-messaging-compat.js'))
      .then(function () { return Notification.requestPermission(); })
      .then(function (p) { if (p !== 'granted') throw new Error('Permiso de avisos denegado en este navegador.'); return navigator.serviceWorker.ready; })
      .then(function (reg) { return firebase.messaging().getToken({ vapidKey: CFG.vapidKey, serviceWorkerRegistration: reg }); })
      .then(function (t) { if (!t) throw new Error('No se pudo activar.'); return api({ action: 'push_token', token: t }).then(ok).then(function () { guardar('rte-push-ok', true); }); })
      .then(function () { return api({ action: 'push_prueba' }); });
  }

  // ---------- v0.6 · eventos al calendario (Google Calendar o .ics para iPhone/Outlook) ----------
  function fechaCal(iso, mas) { return sumarDias(iso, mas || 0).replace(/-/g, ''); }
  function urlGoogleCal(e) {
    var i = aIso(e.INICIO), f = aIso(e.FIN) || i;
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.EVENTO) + '&dates=' + fechaCal(i) + '/' + fechaCal(f, 1) +
      '&details=' + encodeURIComponent((e['CÓMO PROCEDER'] || '') + (e.HORA ? ' · ' + e.HORA : '') + ' · Road To Elite') + (e.LUGAR ? '&location=' + encodeURIComponent(e.LUGAR) : '');
  }
  function descargarIcs(evs) {
    var lim = function (t) { return String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    var l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Road To Elite//ES', 'CALSCALE:GREGORIAN'];
    evs.forEach(function (e) {
      var i = aIso(e.INICIO), f = aIso(e.FIN) || i; if (!i) return;
      l.push('BEGIN:VEVENT', 'UID:' + (e.ID || i) + '@road-to-elite', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART;VALUE=DATE:' + fechaCal(i), 'DTEND;VALUE=DATE:' + fechaCal(f, 1),
        'SUMMARY:' + lim(e.EVENTO), 'DESCRIPTION:' + lim((e['CÓMO PROCEDER'] || '') + (e.HORA ? ' · ' + e.HORA : '')), e.LUGAR ? 'LOCATION:' + lim(e.LUGAR) : '', 'END:VEVENT');
    });
    l.push('END:VCALENDAR');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([l.filter(Boolean).join('\r\n')], { type: 'text/calendar' })); a.download = 'road-to-elite-eventos.ics';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- v0.6 · gráficas de carrera ----------
  function graficaLinea(pts, opc) {
    pts = pts.filter(function (p) { return isFinite(p.y) && p.y > 0; });
    if (pts.length < 2) return '<div class="hint">' + esc(opc.vacio || 'Faltan datos para la gráfica.') + '</div>';
    var w = 340, h = 130, ml = 34, mr = 8, mt = 10, mb = 22, ys = pts.map(function (p) { return p.y; });
    var mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys); if (mn === mx) { mn -= 1; mx += 1; } var pad = (mx - mn) * 0.15; mn -= pad; mx += pad;
    var X = function (i) { return ml + i * (w - ml - mr) / (pts.length - 1); }, Y = function (v) { return mt + (mx - v) * (h - mt - mb) / (mx - mn); };
    var lin = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
    var fmt = opc.fmt || function (v) { return String(Math.round(v * 100) / 100).replace('.', ','); };
    return '<figure class="gfx"><figcaption>' + esc(opc.titulo) + '</figcaption><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(opc.titulo) + '">' +
      [mx - pad, mn + pad].map(function (v) { return '<line x1="' + ml + '" x2="' + (w - mr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gfx-grid"/><text x="' + (ml - 4) + '" y="' + (Y(v) + 3).toFixed(1) + '" class="gfx-y">' + esc(fmt(v)) + '</text>'; }).join('') +
      '<path d="' + lin + '" class="gfx-l"/>' + pts.map(function (p, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3" class="gfx-p"><title>' + esc(p.x + ': ' + fmt(p.y)) + '</title></circle>'; }).join('') +
      '<text x="' + ml + '" y="' + (h - 6) + '" class="gfx-x">' + esc(pts[0].x) + '</text><text x="' + (w - mr) + '" y="' + (h - 6) + '" class="gfx-x" text-anchor="end">' + esc(pts[pts.length - 1].x) + '</text></svg>' +
      (opc.nota ? '<div class="hint">' + esc(opc.nota) + '</div>' : '') + '</figure>';
  }
  function graficasCarrera(A) {
    if (!A) return '';
    var z2 = (A.z2 || []).map(function (x) { return { x: fechaCorta(x.fecha), y: Number(x.efic) }; });
    var km = (A.semanas || []).map(function (s) { return { x: fechaCorta(s.lunes), y: Number(s.km) }; });
    return graficaLinea(z2, { titulo: 'Eficiencia en Z2 · metros/min por latido (sube = mejor base)', vacio: 'La gráfica de eficiencia aparece con 2 rodajes Z2 con FC media.', fmt: function (v) { return String(Math.round(v * 1000) / 1000).replace('.', ','); } }) +
      graficaLinea(km, { titulo: 'Kilómetros por semana', vacio: 'La gráfica de volumen aparece con 2 semanas registradas.', fmt: function (v) { return String(Math.round(v)); } });
  }

  // =====================================================================
  //  v0.7 · HOJA DE LA SEMANA (bloques editables + posición óptima), REFUERZOS, WODS, AVISOS, RENDIMIENTO
  // =====================================================================
  var EST_CORTO = { BORRADOR: 'borrador', PROGRAMADO: '', 'NO HACER': 'no hacer', CANCELADO: 'cancelado', PROPUESTA: 'propuesta', 'PROPUESTA · NO HACER': 'propuesta' };
  function filaPlanDe(b) { return (S.data.plan || []).filter(function (r) { return r.ID === (b.extra ? b.id : b.idPlan); })[0] || null; }
  function renderHoja() {
    var d = S.data, sig = sumarDias(d.semana, 7), conf = d.conf && /Confirmada|Programada/.test(d.conf.ESTADO || '');
    var html = cabeceraVista('Hoja de la semana', 'Semana') +
      '<section class="me" style="display:block"><b>Semana del ' + fechaCorta(d.semana) + '</b><div class="hint">' + esc(d.conf ? d.conf.ESTADO + (d.conf['DOBLES (mañanas libres)'] ? ' · dobles: ' + d.conf['DOBLES (mañanas libres)'] : '') + (d.conf.DESCANSO ? ' · descanso: ' + d.conf.DESCANSO : '') : 'Sin confirmar') + '</div>' +
      (d.extrasTxt ? '<div class="hint">Extras: ' + esc(d.extrasTxt) + '</div>' : '') + '</section>';
    html += '<div class="hoja-acc">' + (!d.fabrikCargado && conf ? '<button class="btn sm" type="button" data-cargar-fabrik="' + d.semana + '">Cargar Fabrik</button>' : '') +
      (d.extrasParcial && conf ? '<button class="btn btn-primary sm" type="button" data-resto-semana>Programar resto de semana</button>' : '') +
      (conf ? '<button class="btn ' + (d.extrasTxt ? '' : 'btn-primary ') + 'sm" type="button" data-cargar-extras="' + d.semana + '">' + (d.extrasTxt ? '📅 Programar · resto o día a día' : '📅 Programar extras') + '</button>' : '<button class="btn btn-primary sm" type="button" data-confirmar="' + d.semana + '">Cargar y confirmar semana</button>') +
      (d.borrador ? '<button class="btn btn-primary sm" type="button" data-aprobar-plan>Aprobar plan</button>' : '') +
      (conf ? '<button class="btn sm" type="button" data-mananas>☀ Mañanas</button>' : '') +
      '<button class="btn sm' + (S.fusionSel ? ' btn-primary' : '') + '" type="button" id="h-fus">🔗 ' + (S.fusionSel ? 'Fusionando… toca los bloques' : 'Fusionar bloques') + '</button>' +
      '<button class="btn-ghost sm" type="button" id="h-xc">Extras semana en curso</button><button class="btn-ghost sm" type="button" id="h-claude">¿No te convence? Pedir a Claude</button></div>' +
      '<label class="toggle"><input type="checkbox" id="h-endu"' + (d.enduranceManana ? ' checked' : '') + '><span><b>Endurance de mañana</b><small>Z2 de carrera y erg solo en tus mañanas libres (el domingo, de comodín). Z6–Z8, calidad en series, RMU y cuerda: donde tú quieras.</small></span></label>';
    html += d.dias.map(function (x, i) {
      var t = function (tu) {
        var bl = x.bloques.filter(function (b) { return b.turno === tu; });
        if (!bl.length) return '';
        return '<div class="h-turno"><span class="h-t">' + (tu === 'AM' ? '☀️ AM' : '🌙 PM') + '</span>' + bl.map(function (b) {
          var est = norm(b.estado), gk = b.extra ? x.iso + '|' + b.id : sumarDias(d.semana, DIAS7.indexOf(b.fabrikDia || x.nombre)) + '|' + b.n, gr = (d.grabacion || {})[gk];
          var edit = b.extra || b.idPlan ? ' data-h-ed="' + i + '|' + esc(b.extra ? b.id : b.idPlan) + '"' : '';
          var idSel = b.extra ? b.id : b.idPlan;
          return '<button type="button" class="h-b' + (b.extra ? ' ex' : '') + (S.fusionSel && S.fusionSel.indexOf(idSel) >= 0 ? ' sel' : '') + (b.clave ? ' clave' : '') + (est === 'NO HACER' || est === 'CANCELADO' ? ' off' : '') + (est === 'BORRADOR' ? ' draft' : '') + '"' + edit + '>' +
            '<span class="h-n">' + (b.extra ? '+' : esc(b.n)) + '</span><span class="h-ti">' + (b.clave ? '🎯 ' : '') + esc(b.titulo) + '</span>' + (/^manual/.test((filaPlanDe(b) || {}).GENERADO || '') ? '<span title="Con candado: «Rehacer extras» no lo mueve">🔒</span>' : '') + (gr && gr.reels && gr.reels.length ? '<span>📷</span>' : '') +
            (b.min ? '<span class="tag">' + esc(b.min) + '′</span>' : '') + (b.codigos ? '<span class="tag">' + esc(String(b.codigos).split('|')[0]) + '</span>' : '') + (EST_CORTO[est] ? '<span class="tag draft">' + EST_CORTO[est] + '</span>' : '') + '</button>';
        }).join('') + '</div>';
      };
      return '<section class="h-dia' + (x.iso === d.hoy ? ' hoy' : '') + '"><div class="h-cab"><b>' + NOMBRE_DIA[x.nombre] + ' ' + diaMes(x.iso) + '</b>' + (x.rpe ? '<span class="b-rpe" style="--c:' + rpeColor(x.rpe) + '">RPE ' + esc(x.rpe) + '</span>' : '') +
        (x.bloques.length ? '<button type="button" class="btn-ghost sm" data-intercambio="' + x.iso + '" title="Cambiar la mañana, la tarde o el día entero">⇄</button>' : '') + '<button type="button" class="btn-ghost sm" data-nuevo-bloque="' + x.iso + '">＋</button></div>' + (x.bloques.length ? t('AM') + t('PM') : '<div class="hint">Descanso</div>') + '</section>';
    }).join('');
    if (S.fusionSel) html += '<div class="fus-bar" id="h-fbar"><span>' + S.fusionSel.length + ' marcados' + (S.fusionSel.length < 2 ? ' · elige al menos 2' : '') + '</span><button class="btn-ghost sm" type="button" id="fb-x">Cancelar</button><button class="btn btn-primary sm" type="button" id="fb-ok"' + (S.fusionSel.length < 2 ? ' disabled' : '') + '>🔗 Fusionar</button></div>';
        html += htmlRefuerzos(d, d.semana, d.refuerzos, 'Esta semana') + htmlRefuerzos(d, sig, d.refuerzosSig, 'Semana que viene (' + fechaCorta(sig) + ')');
    $app.innerHTML = html;
    document.getElementById('atras').onclick = volverSemana;
    document.getElementById('h-claude').onclick = function () { abrirPedirClaude(d.semana); };
    document.getElementById('h-xc').onclick = function () { S.vista = 'extras'; S.extrasCurso = null; render(); window.scrollTo({ top: 0 }); };
    var he = document.getElementById('h-endu');
    he.onchange = function () {
      he.disabled = true;
      api({ action: 'config_set', clave: 'endurance_manana', valor: he.checked }).then(ok).then(function (r) { S.config = r.config; d.enduranceManana = he.checked; he.disabled = false;
        toast(he.checked ? 'Endurance de mañana activado: se aplica al cargar o rehacer los extras' : 'Endurance de mañana desactivado'); }).catch(function (e) { he.checked = !he.checked; he.disabled = false; toast(mensajeError(e.message)); });
    };
    $app.querySelectorAll('[data-h-ed]').forEach(function (b) { b.onclick = function () {
      var p = b.dataset.hEd.split('|'), x = d.dias[+p[0]];
      if (S.fusionSel) { var k = S.fusionSel.indexOf(p[1]); if (k >= 0) S.fusionSel.splice(k, 1); else if (S.fusionSel.length < 4) S.fusionSel.push(p[1]); else toast('Máximo 4 bloques'); renderHoja(); return; }
      abrirEditarBloque(x.bloques.filter(function (y) { return (y.extra ? y.id : y.idPlan) === p[1]; })[0], x); }; });
    document.getElementById('h-fus').onclick = function () { S.fusionSel = S.fusionSel ? null : []; renderHoja(); if (S.fusionSel) toast('Toca 2–4 bloques (Fabrik o extras) y pulsa «Fusionar»'); };
    var fb = document.getElementById('h-fbar');
    if (fb) { document.getElementById('fb-x').onclick = function () { S.fusionSel = null; renderHoja(); }; document.getElementById('fb-ok').onclick = function () { abrirFusion(S.fusionSel.slice()); }; }
    $app.querySelectorAll('[data-ref-add]').forEach(function (f) {
      f.onsubmit = function (ev) {
        ev.preventDefault(); var inp = f.querySelector('input'), b = f.querySelector('button'); if (!inp.value.trim()) return; b.disabled = true;
        api({ action: 'refuerzo', lunes: f.dataset.refAdd, texto: inp.value.trim(), ver: d.semana }).then(ok).then(function (r) { aplicarSemana(r.semana); render(); toast('Refuerzo anotado: se prioriza al cargar los extras'); }).catch(falloApi(b));
      };
    });
    $app.querySelectorAll('[data-ref-del]').forEach(function (b) {
      b.onclick = function () { if (!confirmar(b, '¿Quitar?')) return; b.disabled = true; api({ action: 'refuerzo_borrar', id: b.dataset.refDel, ver: d.semana }).then(ok).then(function (r) { aplicarSemana(r.semana); render(); }).catch(falloApi(b)); };
    });
  }
  /** v0.22 · Fusionar: previa (una llamada) → «Modificar selección» o «Confirmar fusión». */
  function abrirFusion(ids) {
    var tit = '<div class="row"><h2>🔗 Fusionar ' + ids.length + ' bloques</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>';
    abrirHoja(tit + '<div class="hint">Calculando el bloque ampliado…</div>');
    api({ action: 'fusion_previa', ids: ids }).then(ok).then(function (r) {
      var F = r.fusion, B = F.bloque;
      abrirHoja(tit + '<div class="pv-res"><b>' + esc(B['TÍTULO']) + '</b><br>' + esc(F.minAntes) + '′ por separado → <b>' + esc(B.MIN) + '′</b> fusionado · fase ' + esc(F.fase) + '</div>' +
        '<div class="part-lbl">Partes y estímulo de cada una</div>' + F.partes.map(function (p) { return '<div class="fus-p"><span>' + esc(p.titulo) + '</span><span class="hint">' + esc(p.tipo + (p.pesado ? ' · pesado' : '') + ' · ' + p.series + ' series') + '</span></div>'; }).join('') +
        '<div class="part-lbl">Bloque resultante</div><div class="board small">' + esc(B.CONTENIDO) + '</div>' +
        '<div class="hint">Estímulos que cuentan: <b>' + esc(B['CÓDIGOS'] || '—') + '</b> · va en ' + esc(B['DÍA'] + ' ' + B.TURNO) + ' · ' + (B.ESTADO === 'BORRADOR' ? 'queda en borrador' : 'queda programado') + '</div>' +
        (F.avisos.length ? '<div class="pos-act warn"><b>Ojo</b><span>' + esc(F.avisos.join(' ')) + '</span></div>' : '') +
        '<p class="why-t">' + esc(B['POR QUÉ (cursiva)']) + '</p>' +
        '<div class="two-btn"><button class="btn" type="button" id="fu-mod">✎ Modificar selección</button><button class="btn btn-primary" type="button" id="fu-ok">Confirmar fusión</button></div>');
      document.getElementById('fu-mod').onclick = function () { cerrarHoja(); };
      document.getElementById('fu-ok').onclick = function () {
        var b = this; b.disabled = true; b.textContent = 'Fusionando…';
        api({ action: 'fusionar', ids: ids, ver: S.data.semana }).then(ok).then(function (r2) { S.fusionSel = null; aplicarSemana(r2.semana); cerrarHoja(); render(); toast('Fusionado. Se deshace desde el bloque.'); }).catch(falloApi(b));
      };
    }).catch(function (e) { abrirHoja(tit + '<div class="pos-act warn"><b>No se puede fusionar</b><span>' + esc(mensajeError(e.message)) + '</span></div>'); });
  }
  function htmlRefuerzos(d, lunes, lista, titulo) {
    return '<section class="h-ref"><div class="part-lbl">A reforzar · ' + esc(titulo) + '</div><div class="hint">Ejercicios, bloques o consignas («pistols», «refuerzo OH»…). Se priorizan al cargar los extras y suman a sus estímulos mensuales.</div>' +
      (lista || []).map(function (r) { return '<div class="pr-row"><b>' + esc(r.TEXTO) + '</b><span class="hint">' + esc((r['CÓDIGO'] ? r['CÓDIGO'] + ' · ' : '') + r.ESTADO) + '</span><button type="button" class="x" data-ref-del="' + esc(r.ID) + '" aria-label="Quitar">×</button></div>'; }).join('') +
      '<form class="ref-f" data-ref-add="' + lunes + '"><input class="inp" maxlength="200" placeholder="Ej. pistols · refuerzo OH · core antirrotación"><button class="btn sm" type="submit">Añadir</button></form></section>';
  }
  /** Editar un bloque: día, turno, orden y (si es tuyo) contenido. Al cambiar día o turno se calcula la posición óptima. */
  function abrirEditarBloque(b, x) {
    if (!b) return;
    var r = filaPlanDe(b) || {}, fab = !b.extra, idb = b.extra ? b.id : b.idPlan;
    var sel = function (id, v, l) { return '<select id="' + id + '">' + l.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; };
    abrirHoja('<div class="row"><h2>' + esc(b.titulo) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">' + (fab ? 'Bloque de Fabrik: muévelo de día o turno, o edita sus ejercicios. Si lo editas queda con ✎ candado: la recarga de Fabrik no lo pisa.' : norm(b.estado) === 'SIN HUECO' ? 'No cabía en ninguna mañana libre. Elige día y turno (te digo qué choca) o pásalo a pendientes.' : 'Bloque ' + esc(b.origen || 'EXTRA') + ' · ' + esc(b.estado || '') + ' · al guardar queda con 🔒 candado: «Rehacer extras» no lo moverá.') + '</div>' +
      '<form id="ebf" class="avf"><div class="three"><div><label for="eb-f">Día</label><input id="eb-f" type="date" value="' + x.iso + '" min="' + S.data.semana + '" max="' + sumarDias(S.data.semana, 6) + '"></div>' +
      '<div><label for="eb-t">Turno</label>' + sel('eb-t', b.turno, ['AM', 'PM']) + '</div><div></div></div>' +
      '<label for="eb-pos-s">Posición dentro de la sesión</label><select id="eb-pos-s"></select><input type="hidden" id="eb-o" value="' + esc(r.ORDEN || b.orden || '') + '">' +
      '<div id="eb-pos" class="pos"><div class="hint">Calculando la posición óptima…</div></div>' +
      (fab ? (r.ID ? '<details class="set"><summary>✎ Editar ejercicios de este bloque</summary><div class="set-body"><label for="eb-ti">Título</label><input id="eb-ti" maxlength="120" value="' + esc(r['TÍTULO'] || b.titulo) + '">' +
        '<label for="eb-co">Ejercicios</label><textarea id="eb-co" rows="10">' + esc(r.CONTENIDO || '') + '</textarea><div class="hint">Las líneas «A · …», «B · …» son los apartados (calentamiento, fuerza…).</div></div></details>' : '') :
        '<label for="eb-ti">Título</label><input id="eb-ti" maxlength="120" value="' + esc(r['TÍTULO'] || b.titulo) + '">' +
        '<label for="eb-co">Contenido</label><textarea id="eb-co" rows="5">' + esc(r.CONTENIDO || '') + '</textarea>' +
        '<div class="three"><div><label for="eb-mi">Min</label><input id="eb-mi" inputmode="numeric" value="' + esc(r.MIN || '') + '"></div><div><label for="eb-in">Intensidad</label><input id="eb-in" value="' + esc(r.INTENSIDAD || '') + '"></div>' +
        '<div><label for="eb-cd">Códigos</label><input id="eb-cd" value="' + esc(r['CÓDIGOS'] || '') + '"></div></div>') +
      htmlIntercambio(b, x, idb) +
      '<button class="btn btn-primary" type="submit" id="eb-ok">Guardar cambios</button>' + (/^PROGRAMADO$/.test(norm(b.estado)) || (!b.extra && !b.estado) ? '<div class="hint">Mover de día, turno u orden mantiene el bloque aprobado. Si cambias su contenido, vuelve a borrador para que lo apruebes.</div>' : '') +
      '<div class="two-btn">' + (fab || norm(b.estado) === 'SIN HUECO' ? '' : '<button class="btn" type="button" id="eb-q">' + (norm(b.estado) === 'BORRADOR' ? 'Quitar borrador' : 'No hacer') + '</button>') +
      '<button class="btn" type="button" id="eb-pd">' + (norm(b.estado) === 'SIN HUECO' ? 'Dejar en pendientes' : 'No hacer · a pendientes') + '</button></div></form>');
    var cacheP = null, claveP = '';
    var pedir = function () {
      var el = document.getElementById('eb-pos'); if (!el) return;
      var campos = { FECHA: aTxt(val('eb-f')), TURNO: val('eb-t') };
      if (!fab) { campos['CÓDIGOS'] = val('eb-cd'); campos['TÍTULO'] = val('eb-ti'); campos.CONTENIDO = val('eb-co'); campos.MIN = val('eb-mi'); }
      var clave = fab ? '' : [campos['CÓDIGOS'], campos['TÍTULO'], campos.MIN].join('|');
      // v0.21 · una sola consulta: al cambiar de día o turno se usa la lista de huecos ya calculada
      var pinta = function (P0) {
        var iso = val('eb-f'), tu = val('eb-t'), a = (P0.todos || []).filter(function (h) { return h.iso === iso && h.turno === tu; })[0] || (P0.todos ? null : P0.actual);
        var P = Object.assign({}, P0, { actual: a }), m = P.mejores[0], esOpt = a && m && a.iso === m.iso && a.turno === m.turno;
 el.innerHTML = (P.libre ? '<div class="hint">Este bloque (Z6–Z8, calidad en series, RMU o cuerda) puede ir por la mañana o por la tarde: elige tú.</div>' : '') +
          (a ? '<div class="pos-act ' + (esOpt ? 'ok' : a.choques.length ? 'warn' : '') + '"><b>' + (esOpt ? '✔ Es la posición óptima' : 'Donde lo has puesto') + '</b>' +
          (a.choques.length ? '<span>⚠ ' + esc(a.choques.join(' · ')) + '</span>' : '<span>' + esc(a.motivos.join(' · ')) + '</span>') + '</div>' : '<div class="pos-act warn"><b>Ese hueco no está disponible</b><span>Descanso, mañana no libre o bloqueado por un evento.</span></div>') +
          (esOpt ? '' : '<div class="part-lbl">Mejores huecos (interferencias, fatiga acumulada y volumen)</div>' + P.mejores.map(function (h) {
            return '<button type="button" class="pos-op" data-usar="' + h.iso + '|' + h.turno + '"><b>' + esc(h.dia) + ' ' + diaMes(h.iso) + ' · ' + h.turno + '</b><span>' + esc(h.choques.length ? '⚠ ' + h.choques.join(' · ') : h.motivos.join(' · ')) + '</span><span class="go">Usar</span></button>';
          }).join(''));
        el.querySelectorAll('[data-usar]').forEach(function (u) { u.onclick = function () { var p = u.dataset.usar.split('|'); document.getElementById('eb-f').value = p[0]; document.getElementById('eb-t').value = p[1]; opciones(); pedir(); }; });
      };
      if (cacheP && clave === claveP) { pinta(cacheP); return; }
      el.innerHTML = '<div class="hint">Calculando la posición óptima…</div>';
      api({ action: 'posicion', id: idb, lunes: S.data.semana, campos: campos }).then(ok).then(function (res) { cacheP = res.posicion; claveP = clave; pinta(cacheP); })
        .catch(function (e) { el.innerHTML = '<div class="hint">' + esc(mensajeError(e.message)) + '</div>'; });
    };
    /** «Orden» = en qué lugar de la sesión de ese día y turno va el bloque (antes o después de cada bloque). */
    var opciones = function () {
      var iso = val('eb-f'), tu = val('eb-t'), dd = S.data.dias.filter(function (y) { return y.iso === iso; })[0];
      var otros = (dd ? dd.bloques : []).filter(function (y) { return y.turno === tu && y !== b && (y.extra ? y.id : y.idPlan) !== idb; }).sort(function (p1, p2) { return p1.orden - p2.orden; });
      var ops = [{ t: 'Al principio', o: otros.length ? otros[0].orden - 1 : 10 }];
      otros.forEach(function (y, k) { var sig = otros[k + 1]; ops.push({ t: 'Después de ' + (y.extra ? '+ ' : y.n + ' · ') + y.titulo, o: sig ? (y.orden + sig.orden) / 2 : y.orden + 1 }); });
      var actual = Number(String(val('eb-o')).replace(',', '.')), elegido = 0;
      ops.forEach(function (op, k) { if (k && actual > otros[k - 1].orden) elegido = k; });
      if (iso !== x.iso || tu !== b.turno) elegido = ops.length - 1;   // al cambiar de día o turno, va al final de esa sesión
      var se = document.getElementById('eb-pos-s');
      se.innerHTML = ops.map(function (op, k) { return '<option value="' + op.o + '"' + (k === elegido ? ' selected' : '') + '>' + esc(op.t) + '</option>'; }).join('');
      se.onchange = function () { document.getElementById('eb-o').value = se.value; };
      if (iso !== x.iso || tu !== b.turno) document.getElementById('eb-o').value = se.value;
    };
    opciones();
    document.getElementById('eb-f').onchange = function () { opciones(); pedir(); }; document.getElementById('eb-t').onchange = function () { opciones(); pedir(); };
    pedir();
    var fin = function (r2, msg) { aplicarSemana(r2.semana); cerrarHoja(); render(); toast(msg); };
    $scrim.querySelectorAll('[data-swap]').forEach(function (bt) {
      bt.onclick = function () {
        if (!confirmar(bt, '¿Intercambiar? Toca otra vez')) return;
        bt.disabled = true;
        api({ action: 'intercambiar', a: idb, b: bt.dataset.swap, ver: S.data.semana }).then(ok).then(function (r2) { fin(r2, 'Intercambiados: cada uno ocupa el día y turno del otro'); }).catch(falloApi(bt));
      };
    });
    document.getElementById('ebf').onsubmit = function (ev) {
      ev.preventDefault(); var bt = document.getElementById('eb-ok'); bt.disabled = true;
      var c = { FECHA: aTxt(val('eb-f')), TURNO: val('eb-t'), ORDEN: val('eb-o') };
      if (!fab) { c['TÍTULO'] = val('eb-ti'); c.CONTENIDO = val('eb-co'); c.MIN = val('eb-mi'); c.INTENSIDAD = val('eb-in'); c['CÓDIGOS'] = val('eb-cd').toUpperCase(); }
      else if (document.getElementById('eb-co') && (val('eb-co') !== String(r.CONTENIDO || '').trim() || val('eb-ti') !== String(r['TÍTULO'] || b.titulo).trim())) { c['TÍTULO'] = val('eb-ti'); c.CONTENIDO = val('eb-co'); }
      api({ action: 'bloque_editar', id: idb, campos: c, ver: S.data.semana }).then(ok).then(function (r2) { fin(r2, 'Bloque actualizado'); }).catch(falloApi(bt));
    };
    var q = document.getElementById('eb-q');
    if (q) q.onclick = function () { if (!confirmar(q, '¿Seguro? Toca otra vez')) return; q.disabled = true; api({ action: 'bloque_quitar', id: idb, ver: S.data.semana }).then(ok).then(function (r2) { fin(r2, 'Hecho'); }).catch(falloApi(q)); };
    if (norm(b.estado) === 'SIN HUECO') document.getElementById('eb-pd').onclick = function () {
      var bt = this; bt.disabled = true; api({ action: 'bloque_quitar', id: idb, pendiente: true, ver: S.data.semana }).then(ok).then(function (r2) { fin(r2, 'En pendientes: se te propondrá la semana que viene'); }).catch(falloApi(bt));
    }; else document.getElementById('eb-pd').onclick = function () { cerrarHoja(); abrirNoHacer({ id: idb, fecha: x.iso, titulo: b.titulo, turno: b.turno, orden: b.orden, ref: b.extra ? '' : (b.fabrikDia || x.nombre) + '·' + b.n }); };
  }
  /** Carrera y ergómetros: se pueden intercambiar entre sí a lo largo de la semana (día, turno y orden). */
  function esCarreraOErgo(b) {
    var t = norm((b.titulo || '') + ' ' + (b.codigos || '')), c = String(b.codigos || '');
    return norm(b.origen) === 'CARRERA' || /\b(W01|W02|W03|W04|R02|R03)\b/.test(c) || /\b(Z2|ERG|ERGO|REMO|ROW|BIKE|SKI|RODAJE|SERIES)\b/.test(t) && b.extra;
  }
  function htmlIntercambio(b, x, idb) {
    if (!b.extra || !esCarreraOErgo(b)) return '';
    var otros = [];
    S.data.dias.forEach(function (y) { y.bloques.forEach(function (z) {
      if (z === b || !z.extra || z.id === idb || !esCarreraOErgo(z) || /NO HACER|CANCELADO|OCULTO|SUSTITUIDO|SIN HUECO|PROPUESTA/.test(norm(z.estado || ''))) return;
      otros.push('<button type="button" class="pos-op" data-swap="' + esc(z.id) + '"><b>⇄ ' + esc(NOMBRE_DIA[y.nombre] + ' ' + diaMes(y.iso) + ' · ' + z.turno) + '</b><span>' + esc(z.titulo) + (z.min ? ' · ' + esc(z.min) + '′' : '') + '</span><span class="go">Cambiar</span></button>');
    }); });
    if (!otros.length) return '';
    return '<div class="part-lbl">Intercambiar con otra sesión de carrera o ergómetro</div><div class="hint">Cada uno pasa al día, turno y orden del otro. Sigue aprobado.</div><div class="mover-sel">' + otros.join('') + '</div>';
  }
  function abrirPedirClaude(lunes) {
    abrirHoja('<div class="row"><h2>Pedir a Claude</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="hint">Queda una solicitud en APP · CAMBIOS. Claude la revisa y te deja una propuesta para aprobar; hasta entonces sigue la automática.</div>' +
      '<form id="pcf" class="avf"><label for="pc-n">¿Qué no te convence?</label><textarea id="pc-n" rows="4" placeholder="Ej. el martes va demasiado cargado de hombro; quiero la Z2 larga el domingo"></textarea>' +
      '<button class="btn btn-primary" type="submit" id="pc-ok">Enviar</button></form>');
    document.getElementById('pcf').onsubmit = function (ev) {
      ev.preventDefault(); var b = document.getElementById('pc-ok'); b.disabled = true;
      api({ action: 'pedir_claude', lunes: lunes, notas: val('pc-n'), ver: S.data.semana }).then(ok).then(function (r) { aplicarSemana(r.semana); cerrarHoja(); render(); toast('Solicitud enviada a Claude'); }).catch(falloApi(b));
    };
  }
  // ---------- rendimiento y mejora: guardar / restaurar ----------
  function guardarRendimiento(btn, restaurar) {
    var ref = JSON.parse(btn.dataset.rendGuardar || btn.dataset.rendRestaurar), box = btn.closest('.rend');
    var notas = box.querySelector('[data-rend-notas]').value.trim(), recEl = box.querySelector('[data-rend-rec]');
    var auto = null;
    S.data.dias.forEach(function (x) { if (x.iso === ref.iso) x.bloques.forEach(function (b) { if (idPlanDe(x, b) === ref.id) auto = recomendar(b, x); }); });
    var rec = restaurar ? '' : (recEl.value.trim() === String(auto || '').trim() ? '' : recEl.value.trim());
    btn.disabled = true;
    api({ action: 'nota_bloque', nota: { FECHA: aTxt(ref.iso), ID_PLAN: ref.id, BLOQUE: ref.bloque, 'MIS NOTAS': notas, 'RECOMENDACIÓN': rec } }).then(ok).then(function (r) {
      S.data.notasBloque = (S.data.notasBloque || []).filter(function (n) { return !(aIso(n.FECHA) === ref.iso && n.ID_PLAN === ref.id); }).concat([r.nota]);
      render(); toast(restaurar ? 'Recomendación restaurada' : 'Guardado');
    }).catch(falloApi(btn));
  }
  // ---------- avisos de tests y competiciones (también los vistos) ----------
  function htmlAvisosEventos(d) {
    var l = (d.eventos || []).filter(function (e) { return (/^test\b/i.test(e.EVENTO || '') || /Competición|HYROX/.test(e.TIPO || '')) && (aIso(e.FIN) || aIso(e.INICIO)) >= d.hoy; })
      .sort(function (a, b) { return aIso(a.INICIO) < aIso(b.INICIO) ? -1 : 1; });
    if (!l.length) return '<div class="hint">No hay tests ni competiciones próximos.</div>';
    return '<div class="pr-list">' + l.map(function (e) {
      var n = Math.round((Date.parse(aIso(e.INICIO)) - Date.parse(d.hoy)) / 864e5), visto = (d.avisosVistos || []).indexOf(e.ID) >= 0;
      return '<button type="button" class="pr-row" data-evento="' + esc(e.ID) + '"><b>' + esc(e.EVENTO) + '</b><span class="hint">' + fechaCorta(aIso(e.INICIO)) + ' · ' + (n > 0 ? 'faltan ' + n + ' días' : 'esta semana') + (visto ? ' · visto' : '') + '</span></button>';
    }).join('') + '</div><div class="hint">Al marcar un aviso como visto (✓) deja de salir arriba del día y queda aquí y en el calendario.</div>';
  }
  // ---------- WODs guardados y de referencia (resultados en APP · MARCAS) ----------
  function cargarWods() { api({ action: 'wods' }).then(ok).then(function (r) { S.wods = r.wods; pintarWods(); }).catch(function () { var el = document.getElementById('wods-body'); if (el) el.innerHTML = '<div class="err">No se pudieron cargar.</div>'; }); }
  function resultadosWod(w) { return (S.misMarcas || []).filter(function (m) { return m.raw && S.marcasFilas && (S.marcasFilas.filter(function (f) { return f._fila === m.fila; })[0] || {}).EVENTO === 'WOD:' + w.ID; }); }
  function pintarWods() {
    var el = document.getElementById('wods-body'); if (!el) return;
    var ref = (S.wods || []).filter(function (w) { return w.TIPO === 'Referencia'; }), gua = (S.wods || []).filter(function (w) { return w.TIPO !== 'Referencia'; });
    var fila = function (w) { var rs = resultadosWod(w); return '<button type="button" class="pr-row" data-wod="' + esc(w.ID) + '"><b>' + esc(w.NOMBRE) + '</b><span class="hint">' + (rs.length ? rs.length + ' resultado' + (rs.length > 1 ? 's' : '') + ' · último ' + esc(fmtMarca(rs[0])) : (w['FECHA ORIGEN'] ? 'del ' + esc(w['FECHA ORIGEN']) : '')) + '</span></button>'; };
    el.innerHTML = '<div class="part-lbl">De referencia</div>' + (ref.length ? '<div class="pr-list">' + ref.map(fila).join('') + '</div>' : '<div class="hint">Ninguno aún. Guarda un metcon con «☆ Guardar WOD» o añádelo a mano.</div>') +
      '<div class="part-lbl">Guardados para hacer</div>' + (gua.length ? '<div class="pr-list">' + gua.map(fila).join('') + '</div>' : '<div class="hint">Ninguno.</div>') +
      '<button class="btn" type="button" id="wod-nuevo">＋ Metcon a mano</button>';
    el.querySelectorAll('[data-wod]').forEach(function (b) { b.onclick = function () { abrirWod((S.wods || []).filter(function (w) { return w.ID === b.dataset.wod; })[0]); }; });
    document.getElementById('wod-nuevo').onclick = function () { abrirFormWod({ TIPO: 'Referencia' }); };
  }
  /** Ventana flotante del WOD: el metcon, sus resultados y añadir uno nuevo. */
  function abrirWod(w) {
    if (!w) return;
    var rs = resultadosWod(w), tipoR = w.RESULTADO || 'Tiempo', tipoM = { 'Rondas + reps': 'Reps', Metros: 'Distancia' }[tipoR] || tipoR;
    abrirHoja('<div class="row"><h2>' + esc(w.NOMBRE) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<div class="tag">' + esc(w.TIPO) + (w['FECHA ORIGEN'] ? ' · ' + esc(w['FECHA ORIGEN']) : '') + '</div><div class="board">' + pizarra(w.CONTENIDO || '', {}) + '</div>' + (w.NOTAS ? '<p class="hint">' + esc(w.NOTAS) + '</p>' : '') +
      '<div class="part-lbl">Progresión</div>' + (rs.length ? '<div class="pr-hist">' + sparkline(rs) + rs.map(function (x) { return '<div class="pr-row"><span>' + (x.fecha ? fechaCorta(x.fecha) : '—') + '</span><b>' + esc(fmtMarca(x)) + '</b>' + (x.notas ? '<span class="hint">' + esc(x.notas) + '</span>' : '') + '</div>'; }).join('') + '</div>' : '<div class="hint">Sin resultados aún.</div>') +
      '<form id="wrf" class="avf"><div class="two"><div><label for="wr-v">Resultado (' + esc(tipoR) + ')</label>' + (tipoM === 'Tiempo' ? campoTiempo('wr-t', '') : '<input id="wr-v" required inputmode="decimal" placeholder="' + (tipoR === 'Rondas + reps' ? 'Ej. 7.12 (7 rondas + 12)' : '') + '">') + '</div>' +
      '<div><label for="wr-f">Fecha</label><input id="wr-f" type="date" value="' + S.data.hoy + '" max="' + S.data.hoy + '"></div></div><input id="wr-n" maxlength="200" placeholder="Notas: RX/escalado, cargas, cómo partiste…">' +
      '<button class="btn btn-primary" type="submit" id="wr-ok">Añadir resultado</button></form>' +
      '<div class="two-btn">' + (w.TIPO !== 'Referencia' ? '<button class="btn" type="button" id="w-ref">Pasar a referencia</button>' : '') + '<button class="btn" type="button" id="w-ed">Editar</button></div>');
    if (tipoM === 'Tiempo') enlazarTiempo('wr-t');
    document.getElementById('wrf').onsubmit = function (ev) {
      ev.preventDefault(); var b = document.getElementById('wr-ok'); var v = tipoM === 'Tiempo' ? leerTiempo('wr-t') : val('wr-v'); if (!v) return; b.disabled = true;
      api({ action: 'marca', marca: { FECHA: aTxt(val('wr-f')), MOVIMIENTO: 'WOD · ' + w.NOMBRE, TIPO: tipoM, VALOR: v, UNIDAD: TIPO_UNIDAD[tipoM] || '', EVENTO: 'WOD:' + w.ID, NOTAS: val('wr-n') } })
        .then(ok).then(function (r) { S.marcasFilas = r.marcas; prepararMarcas(r.marcas); abrirWod(w); pintarWods(); toast('Resultado guardado'); }).catch(falloApi(b));
    };
    var rf = document.getElementById('w-ref'); if (rf) rf.onclick = function () { rf.disabled = true; api({ action: 'wod', wod: Object.assign({}, w, { TIPO: 'Referencia' }) }).then(ok).then(function (r) { S.wods = r.wods; cerrarHoja(); pintarWods(); toast('Ahora es WOD de referencia'); }).catch(falloApi(rf)); };
    document.getElementById('w-ed').onclick = function () { abrirFormWod(w); };
  }
  function abrirFormWod(w) {
    var sel = function (id, v, l) { return '<select id="' + id + '">' + l.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; };
    abrirHoja('<div class="row"><h2>' + (w.ID ? 'Editar WOD' : 'Nuevo metcon') + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<form id="wf" class="avf"><label for="w-n">Nombre</label><input id="w-n" required maxlength="80" value="' + esc(w.NOMBRE || '') + '" placeholder="Ej. FRAN, BADAJOZ 1, TEST 20′">' +
      '<div class="two"><div><label for="w-t">Tipo</label>' + sel('w-t', w.TIPO || 'Referencia', ['Referencia', 'Guardado']) + '</div><div><label for="w-r">Resultado en</label>' + sel('w-r', w.RESULTADO || 'Tiempo', ['Tiempo', 'Rondas + reps', 'Reps', 'Kilos', 'Calorías', 'Metros']) + '</div></div>' +
      '<label for="w-c">Metcon</label><textarea id="w-c" rows="7" required>' + esc(w.CONTENIDO || '') + '</textarea><label for="w-no">Notas</label><input id="w-no" maxlength="300" value="' + esc(w.NOTAS || '') + '">' +
      '<button class="btn btn-primary" type="submit" id="w-ok">Guardar</button>' + (w.ID ? '<button class="btn" type="button" id="w-del">Borrar</button>' : '') + '</form>');
    document.getElementById('wf').onsubmit = function (ev) {
      ev.preventDefault(); var b = document.getElementById('w-ok'); b.disabled = true;
      api({ action: 'wod', wod: { ID: w.ID || '', NOMBRE: val('w-n'), TIPO: val('w-t'), RESULTADO: val('w-r'), CONTENIDO: val('w-c'), NOTAS: val('w-no'), 'FECHA ORIGEN': w['FECHA ORIGEN'] || '' } })
        .then(ok).then(function (r) { S.wods = r.wods; cerrarHoja(); pintarWods(); toast('WOD guardado'); }).catch(falloApi(b));
    };
    var del = document.getElementById('w-del');
    if (del) del.onclick = function () { if (!confirmar(del, '¿Borrar? Toca otra vez')) return; del.disabled = true; api({ action: 'wod_borrar', id: w.ID }).then(ok).then(function (r) { S.wods = r.wods; cerrarHoja(); pintarWods(); toast('Borrado'); }).catch(falloApi(del)); };
  }
  /** Desde un bloque de metcon: guardarlo para hacerlo en el futuro o como WOD de referencia. */
  function abrirGuardarWod(ref) {
    var x = S.data.dias.filter(function (y) { return y.iso === ref.iso; })[0], b = x && x.bloques.filter(function (y) { return String(y.n) === String(ref.n); })[0];
    if (!b) return;
    var txt = b.partes.filter(function (p) { return p.tipo !== 'prep'; }).map(function (p) { return (p.etiqueta ? p.etiqueta + '\n' : '') + p.texto; }).join('\n\n');
    var T = norm(txt), res = /AMRAP/.test(T) ? 'Rondas + reps' : /EVERY|EMOM/.test(T) ? 'Reps' : 'Tiempo';
    abrirFormWod({ NOMBRE: 'FABRIK ' + NOMBRE_DIA[x.nombre].toUpperCase() + ' ' + aTxt(x.iso).slice(0, 5), TIPO: 'Referencia', RESULTADO: res, CONTENIDO: txt, 'FECHA ORIGEN': aTxt(x.iso), NOTAS: b.wod && b.wod.objetivo ? 'Objetivo: ' + b.wod.objetivo : '' });
  }

  // ---------- aviso previo a «Cargar extras» ----------
  /**
   * v0.21 · Programar semana en UNA ventana y en dos pasos:
   *  1) Opciones (todo local, sin llamadas): qué días (resto de semana / días concretos / toda la semana), mañanas para doble, descanso, estímulos que quiero.
   *  2) «Calcular» → una sola llamada (guarda mañanas + relee Fabrik si hace falta + propuesta) → resultado con «Modificar» o «Confirmar».
   * Lo ya programado en otros días no se toca y cuenta para cubrir los estímulos de la semana.
   */
  function abrirPreviaExtras(lunes, btn, op) {
    op = Object.assign({}, op || {});
    var d0 = S.data, esta = lunes === d0.semana, conf = (esta ? d0.conf : d0.confSiguiente) || {};
    var isos = [0, 1, 2, 3, 4, 5, 6].map(function (k) { return sumarDias(lunes, k); });
    var par = esta ? d0.extrasParcial : null;
    var programados = par ? (par.dias || []) : (esta && d0.extrasTxt ? isos.slice() : []);
    var fabDias = esta ? (d0.fabrikDias || []) : [];
    var fabCargados = esta ? (d0.plan || []).filter(function (r) { return norm(r.ORIGEN) === 'FABRIK'; }).map(function (r) { return aIso(r.FECHA); }) : [];
    var des = String(conf.DESCANSO || ''), hoy = d0.hoy || hoyLocal();
    if (op.resto) op.modo = 'resto';
    if (!op.modo) op.modo = par ? 'resto' : 'semana';
    if (op.modo === 'resto' && !par) op.modo = 'semana';
    if (!op.dias) { var libres = isos.filter(function (x) { return programados.indexOf(x) < 0 && x >= hoy; }); op.dias = libres.filter(function (x) { return fabDias.indexOf(x) >= 0; }).slice(0, 1); if (!op.dias.length) op.dias = libres.slice(0, 1); }
    if (op.dobles == null) op.dobles = String(conf['DOBLES (mañanas libres)'] || '');
    if (!op.descanso) op.descanso = par && par.descanso || 'nada';
    if (op.aprobar == null) op.aprobar = true;
    if (op.deseo == null) op.deseo = '';
    var corto = diaCortoIso;
    var titulo = '<div class="row"><h2>Programar · semana del ' + fechaCorta(lunes) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>';
    var diasDe = function () { return op.modo === 'resto' ? isos.filter(function (x) { return programados.indexOf(x) < 0; }) : op.modo === 'dias' ? op.dias.slice().sort() : isos; };
    var etiq = function (l) { return l.map(corto).join(', ') || '—'; };

    function leer() {
      var e;
      if ((e = document.getElementById('pg-dob'))) op.dobles = leerDias('pg-dob');
      if ((e = document.getElementById('pg-des'))) op.descanso = e.value;
      if ((e = document.getElementById('pg-de'))) op.deseo = e.value.trim();
    }
    function pintar() {
      var est = function (x) { return programados.indexOf(x) >= 0 ? '✓' : fabDias.indexOf(x) >= 0 ? '·F' : ''; };
      abrirHoja(titulo +
        (op.reabrir ? '<div class="hint">Plan ya aprobado: lo automático de hoy en adelante que no hayas hecho se recoloca; lo hecho, lo pasado y lo que tenga 🔒 candado no se toca.</div>' : '') +
        '<div class="pv-alc"><label>¿Qué programo?</label><div class="seg" id="pg-modo">' +
        (par ? '<button type="button" data-pgm="resto" aria-pressed="' + (op.modo === 'resto') + '">Resto de semana</button>' : '') +
        '<button type="button" data-pgm="dias" aria-pressed="' + (op.modo === 'dias') + '">Día a día</button>' +
        '<button type="button" data-pgm="semana" aria-pressed="' + (op.modo === 'semana') + '">' + (programados.length ? 'Toda (rehacer)' : 'Toda la semana') + '</button></div>' +
        (op.modo === 'dias' ? '<div class="dchips" id="pg-dias">' + isos.map(function (x) { return '<button type="button" data-pgd="' + x + '" aria-pressed="' + (op.dias.indexOf(x) >= 0) + '">' + corto(x) + (est(x) ? ' ' + est(x) : '') + '</button>'; }).join('') + '</div>' : '') +
        '<div class="hint">' + (op.modo === 'resto' ? 'Se programan <b>' + esc(etiq(diasDe())) + '</b>. ' : op.modo === 'dias' ? 'Elige uno o varios días. ' : '') +
        (programados.length && op.modo !== 'semana' ? 'Lo ya programado (' + esc(etiq(programados)) + ') no se toca y cuenta para los estímulos de la semana.' : op.modo === 'semana' && programados.length ? 'Rehace los borradores de toda la semana; lo aprobado y lo que tenga 🔒 no se toca.' : '') +
        (op.modo === 'dias' ? ' ✓ = ya programado · ·F = Gabi ya lo ha subido.' : '') + '</div></div>' +
        '<label>Mañanas libres para sesión doble</label>' + chipsDias('pg-dob', op.dobles) +
        (des ? '<label for="pg-des">En tus días de descanso (' + esc(des) + ')</label><select id="pg-des">' + [['nada', 'Nada: descanso total'], ['extras', 'Extras'], ['z2', 'Z2 de recuperación'], ['ambos', 'Extras + Z2 de recuperación']].map(function (o) { return '<option value="' + o[0] + '"' + (op.descanso === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' : '') +
        '<label for="pg-de">⚙ Estímulos que quiero (opcional)</label><textarea id="pg-de" rows="2" maxlength="300" placeholder="ej. intercalar carrera, calorías de assault, thrusters · metcon a medida en el mejor hueco">' + esc(op.deseo) + '</textarea>' +
        '<button class="btn btn-primary" type="button" id="pg-calc">Calcular</button>');
      $scrim.querySelectorAll('[data-pgm]').forEach(function (b) { b.onclick = function () { leer(); op.modo = b.dataset.pgm; pintar(); }; });
      $scrim.querySelectorAll('[data-pgd]').forEach(function (b) { b.onclick = function () { var k = op.dias.indexOf(b.dataset.pgd); if (k >= 0) op.dias.splice(k, 1); else op.dias.push(b.dataset.pgd); b.setAttribute('aria-pressed', String(k < 0)); }; });
      document.getElementById('pg-calc').onclick = calcular;
    }
    function params() {
      var dias = diasDe();
      var refrescar = op.modo === 'resto' || dias.some(function (x) { return fabDias.indexOf(x) >= 0 && fabCargados.indexOf(x) < 0; }) || (esta && d0.hayFabrik && !d0.fabrikCargado);
      return { lunes: lunes, ver: S.data.semana, dias: op.modo === 'semana' ? null : dias, resto: op.modo === 'resto', descanso: op.descanso || 'nada', reabrir: !!op.reabrir,
        dobles: op.dobles !== String(conf['DOBLES (mañanas libres)'] || '') ? op.dobles : null, refrescar: refrescar };
    }
    function calcular() {
      leer();
      if (op.modo === 'dias' && !op.dias.length) { toast('Elige al menos un día'); return; }
      var pr = params();
      abrirHoja(titulo + '<div class="hint">Calculando ' + esc(etiq(diasDe())) + (pr.refrescar ? ' (releyendo Fabrik)' : '') + '…</div>');
      api(Object.assign({ action: 'extras_previa' }, pr)).then(ok).then(function (r) {
        if (r.semana) { aplicarSemana(r.semana); conf = (lunes === S.data.semana ? S.data.conf : S.data.confSiguiente) || conf; render(); }
        resultado(r.previa);
      }).catch(function (er) {
        if (/semana_sin_confirmar/.test(er.message)) { abrirHoja(titulo + '<div class="pos-act warn"><b>La semana no está confirmada</b><span>Confirma mañanas, descansos y eventos y vuelve aquí.</span></div><button class="btn btn-primary" type="button" data-confirmar="' + lunes + '">Cargar y confirmar semana</button>'); return; }
        abrirHoja(titulo + '<div class="pos-act warn"><b>No se pudo calcular</b><span>' + esc(mensajeError(er.message)) + '</span></div><button class="btn" type="button" id="pg-vol">✎ Volver a las opciones</button>');
        document.getElementById('pg-vol').onclick = pintar;
      });
    }
    function resultado(P) {
      var PR = { carrera: 'Carrera', refuerzo: 'Refuerzo', pendiente: 'Pendiente', semana: 'Meta semanal', mes: 'Meta mensual' };
      var li = function (l) { return l.length ? '<ul class="pv">' + l.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<div class="hint">—</div>'; };
      var porDia = {}; P.bloques.forEach(function (x) { (porDia[x.dia] = porDia[x.dia] || []).push(x); });
      var ya = P.yaCuenta || [];
      abrirHoja(titulo +
        '<div class="pv-res"><b>' + esc(op.modo === 'semana' ? 'Toda la semana' : etiq(diasDe())) + '</b> · ' + P.bloques.length + ' bloques nuevos · ' + P.pctMes + ' % del mes (17–27 %)' +
        (ya.length ? ' · ya cuentan ' + ya.length + ' bloques programados' : '') + '</div>' +
        '<div class="pv-kpi"><span>Dobles: <b>' + esc(P.dobles || 'ninguna') + '</b></span><span>Mañanas que usa: <b>' + esc(P.mananas.join(', ') || 'ninguna') + '</b></span><span>Endurance de mañana: <b>' + (P.modoAM ? 'sí' : 'no') + '</b></span>' +
        (op.descanso !== 'nada' && des ? '<span>Descanso: <b>' + esc(op.descanso) + '</b></span>' : '') + '</div>' +
        (P.sinHueco.length ? '<div class="pos-act warn"><b>No caben</b><span>' + esc(P.sinHueco.join(', ')) + '</span><span>Quedarán avisados para que elijas día y turno o los pases a pendientes. Prueba a añadir mañanas.</span></div>' : '') +
        '<div class="part-lbl">Qué entra y dónde</div>' + (Object.keys(porDia).length ? Object.keys(porDia).map(function (k) { return '<div class="pv-dia"><b>' + esc(k) + '</b>' + porDia[k].map(function (x) { return '<div class="pr-row"><span>' + esc(x.turno + ' · ' + x.titulo) + '</span><span class="hint">' + esc((x.min ? x.min + '′ · ' : '') + (PR[x.prio] || x.prio)) + '</span></div>'; }).join('') + '</div>'; }).join('') : '<div class="hint">Nada nuevo: lo de la semana ya está cubierto.</div>') +
        (op.deseo ? '<div class="hint">+ metcon a medida con «' + esc(op.deseo) + '» en el mejor hueco al confirmar.</div>' : '') +
        '<details><summary>Endurance, refuerzos y pendientes</summary><div class="exp-body"><div class="part-lbl">Endurance</div>' + li(P.endurance) + '<div class="part-lbl">Refuerzos pedidos</div>' + li(P.refuerzos) + '<div class="part-lbl">Pendientes que entran</div>' + li(P.pendientes) + '</div></details>' +
        (ya.length ? '<details><summary>Ya programado que cuenta (no se toca)</summary><div class="exp-body">' + ya.map(function (x) { return '<div class="pr-row"><span>' + esc(x.dia + ' ' + x.turno + ' · ' + x.titulo) + '</span><span class="hint">' + (x.estado === 'BORRADOR' ? 'borrador' : 'aprobado') + '</span></div>'; }).join('') + '</div></details>' : '') +
        '<label class="sh-b"><input type="checkbox" id="pg-apr"' + (op.aprobar ? ' checked' : '') + '><span>Aprobar al confirmar (si no, queda en borrador para revisarlo)</span></label>' +
        '<div class="two-btn"><button class="btn" type="button" id="pg-mod">✎ Modificar</button><button class="btn btn-primary" type="button" id="pg-ok">Confirmar</button></div>');
      document.getElementById('pg-mod').onclick = function () { op.aprobar = document.getElementById('pg-apr').checked; pintar(); };
      document.getElementById('pg-ok').onclick = function () {
        var b = this; op.aprobar = document.getElementById('pg-apr').checked; b.disabled = true; b.textContent = 'Programando…';
        var pr = params(); pr.refrescar = false;
        api(Object.assign({ action: 'generar_extras', deseo: op.deseo, aprobar: op.aprobar }, pr)).then(ok).then(function (r2) {
          aplicarSemana(r2.semana); cerrarHoja(); render();
          var md = r2.extras.medida; toast(r2.extras.resumen + (op.aprobar ? ' · aprobado' : ' · en borrador') + (md && !md.ok ? ' · metcon a medida: ' + (md.avisos || []).join(' ') : ''));
        }).catch(falloApi(b));
      };
    }
    if (btn) btn.disabled = false;
    pintar();
  }


  // ---------- v0.20 · Competis (copia de COMPETIS PROPUESTAS) con seguimiento en Google Calendar ----------
  function renderCompetis() {
    var html = cabeceraVista('Competis', 'Menú');
    if (!S.competis) {
      $app.innerHTML = html + '<div class="hint">Cargando competis…</div>';
      document.getElementById('atras').onclick = function () { abrirAjustes(); };
      api({ action: 'competis' }).then(ok).then(function (r) { S.competis = r.competis; S._compCopia = r.copia; if (S.vista === 'competis') render(); }).catch(function (e) { toast(mensajeError(e.message)); });
      return;
    }
    // v0.23 · filtros combinables (mismo criterio que la pestaña APP · COMPETIS del Sheet): fechas, ámbito, clasificatorio, niveles, formato, texto
    var F = S._cf || (S._cf = leer('rte-comp-filtros') || {});
    ['ambito', 'clasif', 'niveles', 'formatos'].forEach(function (k) { if (!Array.isArray(F[k])) F[k] = []; });
    var filtro = S._compFiltro || 'proximas', hoyC = (S.data && S.data.hoy) || hoyLocal();
    var en = function (v, l) { return !l.length || String(v || '').split(/\s*,\s*/).some(function (x) { return l.indexOf(x) >= 0; }); };
    var tx = norm(F.texto || '').trim();
    var L = S.competis.filter(function (x) {
      if (filtro === 'seguimiento' ? x.SEGUIMIENTO !== 'Sí' : filtro === 'proximas' && x._pasada) return false;
      if (F.desde && (!x._fin || x._fin < F.desde)) return false;
      if (F.hasta && (!x._iso || x._iso > F.hasta)) return false;
      if (F.insDesde && (!x._ins || x._ins < F.insDesde)) return false;
      if (F.insHasta && (!x._ins || x._ins > F.insHasta)) return false;
      if (!en(x['ÁMBITO'], F.ambito) || !en(x['CON CLASIFICATORIO'], F.clasif) || !en(x.NIVELES, F.niveles) || !en(x.FORMATO, F.formatos)) return false;
      if (tx && norm([x.NOMBRE, x.CIUDAD, x.PROVINCIA, x['CATEGORÍAS'], x.NOTAS].join(' ')).indexOf(tx) < 0) return false;
      return true;
    });
    var nAct = ['desde', 'hasta', 'insDesde', 'insHasta', 'texto'].filter(function (k) { return F[k]; }).length + ['ambito', 'clasif', 'niveles', 'formatos'].filter(function (k) { return F[k].length; }).length;
    var chips = function (k, ops) { return '<div class="dchips">' + ops.map(function (o) { return '<button type="button" data-cfk="' + k + '" data-cfv="' + esc(o) + '" aria-pressed="' + (F[k].indexOf(o) >= 0) + '">' + esc(o) + '</button>'; }).join('') + '</div>'; };
    var panel = '<details class="cf"' + (S._cfOpen ? ' open' : '') + '><summary>🔎 Filtros' + (nAct ? ' · <b>' + nAct + ' activos</b>' : '') + ' · ' + L.length + ' de ' + S.competis.length + '</summary><div class="exp-body">' +
      '<div class="two"><div><label for="cf-d">Competi desde</label><input type="date" id="cf-d" value="' + esc(F.desde || '') + '"></div><div><label for="cf-h">hasta</label><input type="date" id="cf-h" value="' + esc(F.hasta || '') + '"></div></div>' +
      '<div class="two"><div><label for="cf-id">Inscripción desde</label><input type="date" id="cf-id" value="' + esc(F.insDesde || '') + '"></div><div><label for="cf-ih">hasta</label><input type="date" id="cf-ih" value="' + esc(F.insHasta || '') + '"></div></div>' +
      '<label>Dónde</label>' + chips('ambito', ['Andalucía', 'España', 'Internacional']) +
      '<label>Clasificatorio</label>' + chips('clasif', ['Sí', 'No', 'Sin dato']) +
      '<label>Niveles (cualquiera de los marcados)</label>' + chips('niveles', ['Elite', 'RX', 'Advance', 'Intermedio', 'Escalado', 'Rookie', 'Open', 'Máster', 'Teens']) +
      '<label>Formato</label>' + chips('formatos', ['Individual', 'Parejas', 'Tríos', 'Equipos']) +
      '<label for="cf-t">Texto</label><input id="cf-t" placeholder="nombre, ciudad, categoría…" value="' + esc(F.texto || '') + '">' +
      '<div class="hint">Se combinan todos (Y). Dentro de cada grupo de botones vale cualquiera (O). Con fecha de inscripción, solo salen las que tienen fecha.</div>' +
      '<button class="btn-ghost sm" type="button" id="cf-x">Limpiar filtros</button></div></details>';
    var lnk = function (u, t) { u = urlSegura(u); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + t + '</a>' : ''; };
    html += '<section class="me" style="display:block"><div class="seg" id="cp-f">' + [['proximas', 'Próximas'], ['seguimiento', 'En seguimiento'], ['todas', 'Todas']].map(function (o) { return '<button type="button" data-cpf="' + o[0] + '" aria-pressed="' + (filtro === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="hint">Las busca cada lunes la app de Gabi (España y Europa); aquí se copian para Road To Elite (lunes 15:00). ' + esc(S._compCopia || '') + '</div><button class="btn-ghost sm" type="button" id="cp-copiar">↻ Actualizar desde la app de Gabi</button>' + panel + '</section>';
    html += L.length ? L.map(function (x) {
      var seg = x.SEGUIMIENTO === 'Sí';
      return '<div class="comp' + (seg ? ' on' : '') + (x._pasada ? ' pasada' : '') + '"><div class="comp-h"><b>' + esc(x.NOMBRE) + '</b>' + (seg ? '<span class="tag">En seguimiento</span>' : '') + '</div>' +
        '<div class="comp-tags">' + [x['ÁMBITO'], x['CON CLASIFICATORIO'] === 'Sí' ? '🎯 Clasificatorio' : '', x.NIVELES, x.FORMATO].filter(Boolean).map(function (t) { return '<span class="ctag' + (t === 'Andalucía' ? ' and' : '') + '">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="hint">📅 ' + esc(x.INICIO) + (x.FIN && x.FIN !== x.INICIO ? ' – ' + esc(x.FIN) : '') + ' · 📍 ' + esc([x.CIUDAD, x.PROVINCIA].filter(Boolean).join(', ')) + '</div>' +
        (x['CATEGORÍAS'] ? '<div class="hint">Categorías: ' + esc(x['CATEGORÍAS']) + '</div>' : '') + (x.PRECIO ? '<div class="hint">Precio: ' + esc(x.PRECIO) + '</div>' : '') +
        (x['APERTURA INSCRIPCIÓN'] || x['FECHA INSCRIPCIÓN'] ? '<div class="hint">📝 Inscripción: ' + esc(x['FECHA INSCRIPCIÓN'] || x['APERTURA INSCRIPCIÓN']) + (x['INSCRIPCIÓN'] ? ' · ' + esc(x['INSCRIPCIÓN']) : '') + '</div>' : '') +
        (x.CLASIFICATORIO ? '<div class="hint">🎯 Clasificatorio: ' + esc(x.CLASIFICATORIO) + (x['FECHA CLASIFICATORIO'] ? ' · ' + esc(x['FECHA CLASIFICATORIO']) : '') + (x['CLASIFICATORIO (hecho)'] ? ' · ' + esc(x['CLASIFICATORIO (hecho)']) : '') + '</div>' : '') +
        (x.NOTAS ? '<div class="hint"><i>' + esc(x.NOTAS) + '</i></div>' : '') +
        '<div class="comp-l">' + [lnk(x.WEB, 'Web'), lnk(x.WODBUSTER, 'WODBuster'), lnk(x.INSTAGRAM, 'Instagram')].filter(Boolean).join(' · ') + '</div>' +
        '<button class="btn ' + (seg ? '' : 'btn-primary ') + 'sm" type="button" data-cseg="' + esc(x.ID) + '">' + (seg ? 'Quitar seguimiento' : '★ Seguir (al calendario)') + '</button></div>';
    }).join('') : '<div class="empty">No hay competis en esta vista.</div>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = function () { abrirAjustes(); };
    $app.querySelectorAll('[data-cpf]').forEach(function (b) { b.onclick = function () { S._compFiltro = b.dataset.cpf; render(); }; });
    var guardaF = function () { guardar('rte-comp-filtros', F); S._cfOpen = true; render(); };
    $app.querySelector('details.cf').addEventListener('toggle', function () { S._cfOpen = this.open; });
    $app.querySelectorAll('[data-cfk]').forEach(function (b) { b.onclick = function () { var l = F[b.dataset.cfk], k = l.indexOf(b.dataset.cfv); if (k >= 0) l.splice(k, 1); else l.push(b.dataset.cfv); guardaF(); }; });
    [['cf-d', 'desde'], ['cf-h', 'hasta'], ['cf-id', 'insDesde'], ['cf-ih', 'insHasta']].forEach(function (p) { document.getElementById(p[0]).onchange = function () { F[p[1]] = this.value || ''; guardaF(); }; });
    document.getElementById('cf-t').onchange = function () { F.texto = this.value.trim(); guardaF(); };
    document.getElementById('cf-x').onclick = function () { S._cf = { ambito: [], clasif: [], niveles: [], formatos: [] }; F = S._cf; guardaF(); };
    document.getElementById('cp-copiar').onclick = function () { var b = this; b.disabled = true; api({ action: 'competis_copiar' }).then(ok).then(function (r) { S.competis = r.competis; S._compCopia = r.copia; render(); toast('Competis actualizadas desde la app de Gabi'); }).catch(falloApi(b)); };
    $app.querySelectorAll('[data-cseg]').forEach(function (b) { b.onclick = function () {
      var x = S.competis.filter(function (c) { return c.ID === b.dataset.cseg; })[0];
      if (x.SEGUIMIENTO === 'Sí') { b.disabled = true; api({ action: 'competi_seguir', id: x.ID, seguir: false }).then(ok).then(function (r) { S.competis = r.competis; S.data.competisPreguntas = r.preguntas; render(); toast('Quitada del seguimiento y del calendario'); }).catch(falloApi(b)); return; }
      var aIn = function (v) { var i = aIso(v); return i || ''; };
      abrirHoja('<div class="row"><h2>Seguir · ' + esc(x.NOMBRE) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
        '<form id="cpf" class="avf"><div class="hint">Van a tu Google Calendar: la competi (' + esc(x.INICIO) + '), la apertura de inscripción y el clasificatorio. Cuando llegue cada fecha te preguntaré si lo hiciste; si dices que no, se quita todo.</div>' +
        '<label for="cp-ins">Apertura de inscripción</label><input type="date" id="cp-ins" value="' + esc(aIn(x['FECHA INSCRIPCIÓN'] || x['APERTURA INSCRIPCIÓN'])) + '">' +
        '<label for="cp-cla">Clasificatorio' + (x.CLASIFICATORIO ? ' (' + esc(x.CLASIFICATORIO) + ')' : '') + '</label><input type="date" id="cp-cla" value="' + esc(aIn(x['FECHA CLASIFICATORIO'])) + '">' +
        '<div class="hint">Déjalo vacío si no hay o no se sabe aún.</div><button class="btn btn-primary" type="submit" id="cp-ok">Seguir y añadir al calendario</button></form>');
      document.getElementById('cpf').onsubmit = function (ev) { ev.preventDefault(); var bb = document.getElementById('cp-ok'); bb.disabled = true; bb.textContent = 'Añadiendo…';
        api({ action: 'competi_seguir', id: x.ID, seguir: true, inscripcion: val('cp-ins'), clasificatorio: val('cp-cla') }).then(ok).then(function (r) { S.competis = r.competis; S.data.competisPreguntas = r.preguntas; cerrarHoja(); render(); toast('En seguimiento · añadida a tu calendario'); }).catch(falloApi(bb)); };
    }; });
  }
