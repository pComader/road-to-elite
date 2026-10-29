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
    html += '<button class="set-link" type="button" id="ir-cobertura"><span class="set-ico">%</span>Cobertura y carrera<span class="go">›</span></button>';
    html += '<button class="set-link" type="button" id="ir-calendario"><span class="set-ico">▦</span>Calendario de eventos<span class="go">›</span></button>';
    var pend = (d.pendientes || []);
    html += seccion('s-pend', 'Pendientes', htmlPendientes(pend), pend.length ? String(pend.length) : '', '↺');
    html += seccion('s-marcas', 'Mis marcas', htmlMarcas(d), '', '◆');
    html += seccion('s-semana', 'Esta semana', htmlResumenSemana(d), hechos ? hechos + ' registrados' : '', '✓');
    html += seccion('s-desc', '% Descuentos', '<div id="desc-body"><div class="hint">Cargando…</div></div>', '', '%');
    html += seccion('s-webs', 'Mis webs', '<div id="webs-body"><div class="hint">Cargando…</div></div>', '', '↗');
    html += seccion('s-videos', 'Vídeos de ejercicios', '<input id="vid-q" class="inp" placeholder="Buscar ejercicio…" autocomplete="off"><div id="vid-body" class="pr-list"></div>', String((S.videos || []).length), '▶');
    html += seccion('s-push', 'Avisos al móvil', htmlAvisos(d), '', '🔔');
    html += seccion('s-tema', 'Apariencia', '<div class="seg" role="group" aria-label="Tema">' + Object.keys(TEMAS).map(function (k) {
      return '<button type="button" data-tema="' + k + '" aria-pressed="' + (tema === k) + '">' + TEMAS[k] + '</button>'; }).join('') + '</div>' +
      '<div class="hint">Automático sigue el modo claro u oscuro de tu móvil u ordenador.</div>', '', '◐');
    html += seccion('s-instalar', 'Instalar la app', htmlInstalar(), '', '↓');
    if ((d.erratas || []).length) html += seccion('s-err', 'Avisos de Fabrik', '<ul class="hint">' + d.erratas.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>', String(d.erratas.length), '!');
    html += '<button class="btn" type="button" id="logout">Cerrar sesión</button><div class="hint" style="text-align:center">Road To Elite · ' + esc(WEB_VERSION) + '</div>';
    $app.innerHTML = html;
    document.getElementById('atras').onclick = volverSemana;
    document.getElementById('logout').onclick = function () { S.vista = null; salir(); };
    document.getElementById('ir-cobertura').onclick = function () { S.vista = 'cobertura'; render(); window.scrollTo({ top: 0 }); };
    document.getElementById('ir-calendario').onclick = function () { abrirCalendario(); };
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
          '<div class="exp-body">' + (m.notas ? '<div class="hint">' + esc(m.notas) + '</div>' : '') +
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
    return h + '<div class="hint">Actualizado ' + esc(A.actualizado || '') + ' · también en la pestaña APP · ANÁLISIS CARRERA del Sheet.</div>';
  }
  function renderCobertura() {
    var html = cabeceraVista('Cobertura', 'Menú');
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
      html += '<div class="hint">' + (tab === 'semana' ? 'Semana' : cap(B.etiqueta)) + ': ' + fechaCorta(B.desde) + ' – ' + fechaCorta(B.hasta) +
        (tab === 'semana' ? ' · se reinicia el domingo' : ' · se cierra el último domingo del mes') + '</div>';
      html += '<div class="hint leyenda"><i class="lg prog"></i> programado <i class="lg real"></i> hecho</div>';
      if (falta.length) html += '<section class="por-cubrir"><div class="part-lbl">Por cubrir</div>' + falta.map(function (m) {
        return '<div class="pc-i">' + esc(m.estimulo) + ' [' + num1(m.programado) + '/' + num1(m.meta) + unidadMeta(m) + ']</div>'; }).join('') + '</section>';
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
    if (fila) o = { ID: fila.ID, 'ÁMBITO': fila['ÁMBITO'], PRIORIDAD: fila.PRIORIDAD, 'ESTÍMULO': fila['ESTÍMULO'], META: fila.META, MPM: fila['META POR MES'], MAXIMO: fila['MÁXIMO'], TIPO: fila.TIPO, CODIGOS: fila['CÓDIGOS'], ACTIVA: fila.ACTIVA, NOTAS: fila.NOTAS, ORDEN: fila.ORDEN };
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
      '<label for="mt-n">Notas / criterio</label><textarea id="mt-n" rows="2">' + esc(o.NOTAS || '') + '</textarea>' +
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
        'CÓDIGOS': val('mt-c').toUpperCase(), 'META POR MES': val('mt-mm'), NOTAS: val('mt-n'), ORDEN: val('mt-o'), ACTIVA: val('mt-on') };
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
  function htmlPendientes(lista) {
    if (!lista.length) return '<div class="hint">No hay nada pendiente.</div>';
    return '<div class="hint">Se te propondrán al programar la semana siguiente; nada entra sin tu aprobación.</div><div class="pr-list">' + lista.map(function (p) {
      return '<div class="pend-i"><div class="pend-t"><b>' + esc(p.BLOQUE) + '</b><span class="tag">' + esc(p.TIPO) + '</span><span class="tag' + (p.ESTADO === 'Propuesto' ? ' ex' : '') + '">' + esc(p.ESTADO) + '</span></div>' +
        '<div class="hint">' + esc(p['FECHA ORIGINAL']) + (p.MOTIVO ? ' · ' + esc(p.MOTIVO) : '') + '</div>' +
        '<div class="evc-acc"><button class="btn-ghost sm" type="button" data-pend="' + esc(p.ID) + '" data-est="Descartado">Descartar</button></div></div>';
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
  function leerEscala(id) { var b = document.querySelector('#' + id + ' .on'); return b ? b.dataset.v : ''; }
  function abrirChequeo(iso) {
    var c = (S.data.chequeos || []).filter(function (x) { return aIso(x.FECHA) === iso; })[0] || {};
    abrirHoja('<div class="row"><h2>Chequeo · ' + fechaCorta(iso) + '</h2><button class="btn-ghost" data-close type="button">Cerrar</button></div>' +
      '<form id="chf" class="avf"><div class="two"><div><label for="ch-s">Horas de sueño</label><input id="ch-s" inputmode="decimal" value="' + esc(c['SUEÑO (h)'] || '') + '" placeholder="7,5"></div>' +
      '<div><label for="ch-v">VFC (ms) · Garmin</label><input id="ch-v" inputmode="numeric" value="' + esc(c['VFC (ms)'] || '') + '" placeholder="62"></div></div>' +
      '<div class="two"><div><label for="ch-fc">FC en reposo</label><input id="ch-fc" inputmode="numeric" value="' + esc(c['FC REPOSO'] || '') + '" placeholder="48"></div><div></div></div>' +
      '<label>Calidad del sueño · 1 fatal · 5 perfecto</label>' + chipsEscala('ch-cs', 1, 5, c['CALIDAD SUEÑO (1-5)']) +
      '<label>Energía · 1 vacío · 5 a tope</label>' + chipsEscala('ch-en', 1, 5, c['ENERGÍA (1-5)']) +
      '<label>Molestias · 0 nada · 5 dolor que limita</label>' + chipsEscala('ch-mo', 0, 5, c['MOLESTIAS (0-5)']) +
      '<label for="ch-z">Zona de la molestia</label><input id="ch-z" maxlength="80" value="' + esc(c['ZONA MOLESTIA'] || '') + '" placeholder="Ej. cuello, rodilla izquierda">' +
      '<label>Estrés · 1 tranquilo · 5 muy alto</label>' + chipsEscala('ch-es', 1, 5, c['ESTRÉS (1-5)']) +
      '<label for="ch-n">Notas</label><input id="ch-n" maxlength="300" value="' + esc(c.NOTAS || '') + '">' +
      '<div class="hint">La VFC y la FC en reposo se comparan con tu media de los últimos 7 chequeos: lo que cuenta es cuánto te desvías de ti mismo.</div>' +
      '<button class="btn btn-primary" type="submit" id="ch-ok">Guardar y ver el semáforo</button></form>');
    $scrim.querySelectorAll('.esc').forEach(function (g) {
      g.querySelectorAll('.esc-chip').forEach(function (b) { b.onclick = function () { var ya = b.classList.contains('on'); g.querySelectorAll('.esc-chip').forEach(function (y) { y.classList.remove('on'); }); if (!ya) b.classList.add('on'); }; });
    });
    document.getElementById('chf').onsubmit = function (ev) {
      ev.preventDefault();
      var o = { FECHA: aTxt(iso), 'SUEÑO (h)': val('ch-s').replace(',', '.'), 'VFC (ms)': val('ch-v'), 'FC REPOSO': val('ch-fc'), 'CALIDAD SUEÑO (1-5)': leerEscala('ch-cs'),
        'ENERGÍA (1-5)': leerEscala('ch-en'), 'MOLESTIAS (0-5)': leerEscala('ch-mo'), 'ZONA MOLESTIA': val('ch-z'), 'ESTRÉS (1-5)': leerEscala('ch-es'), NOTAS: val('ch-n') };
      var b = document.getElementById('ch-ok'); b.disabled = true;
      apiGuardar({ action: 'chequeo', chequeo: o }).then(ok).then(function (r) {
        var nuevo = r.chequeo || Object.assign({ 'RECOMENDACIÓN': 'Guardado sin conexión: el semáforo se calcula al volver la red.' }, o);
        S.data.chequeos = (S.data.chequeos || []).filter(function (x) { return aIso(x.FECHA) !== iso; }).concat([nuevo]);
        cerrarHoja(); render(); toast(nuevo['SEMÁFORO'] ? 'Semáforo ' + nuevo['SEMÁFORO'].toLowerCase() : 'Guardado');
      }).catch(falloApi(b));
    };
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
        '<label for="nb-ti">Título</label><input id="nb-ti" required maxlength="120">' +
        '<label for="nb-co">Contenido (como en la pizarra)</label><textarea id="nb-co" rows="4"></textarea>' +
        '<div class="three"><div><label for="nb-mi">Min</label><input id="nb-mi" inputmode="numeric"></div><div><label for="nb-ca">Cantidad</label><input id="nb-ca" inputmode="numeric" placeholder="saltos…"></div>' +
        '<div><label for="nb-cd">Códigos</label><input id="nb-cd" maxlength="60" placeholder="W10"></div></div>' +
        '<label for="nb-in">Intensidad</label><input id="nb-in" maxlength="40" placeholder="RPE 6–7">' +
        '<label for="nb-pq">Por qué va aquí</label><textarea id="nb-pq" rows="2"></textarea>' +
        '<div class="hint">Entra en BORRADOR: cuenta en la cobertura como borrador hasta que apruebes el plan.</div>' +
        '<button class="btn btn-primary" type="submit" id="nb-ok">Añadir</button></form>');
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
