/**
 * Road To Elite — servidor (Apps Script) · versión 0.4
 * ------------------------------------------------------------
 * Se pega en: Road to Elite · Training Coverage → Extensiones → Apps Script.
 *
 * Seguridad (por capas):
 *  · Solo responde a UNA cuenta (CONFIG.EMAIL_PERMITIDO). Cada petición trae el token de Firebase y se
 *    comprueba aquí, en el servidor, con Google (no basta con que la web lo diga).
 *  · ESCRIBE solo en este archivo (CONFIG.SHEET_ID) y, los domingos, una copia de seguridad en tu carpeta Backups.
 *    Cualquier intento de escribir en otro libro lanza error.
 *  · FABRIK PROGRAM y la app de Gabi (ProgramAPP) se abren SOLO para leer. Ninguna función escribe en ellos.
 *
 * Lectura de Fabrik: reutiliza el lector de la app de Gabi (mismas funciones puras, copiadas, sin modificar).
 *   Pestaña 1 = ciclo. Después, parejas: semana + NOTAS. Manda la POSICIÓN, no el nombre.
 */

// ===================== CONFIGURACIÓN =====================
var CONFIG = {
  NOMBRE_APP: 'Road To Elite',
  VERSION: '0.30.1',
  URL_APP: 'https://pcomader.github.io/road-to-elite/',   // la clave de Firebase solo acepta peticiones desde aquí
  EMAIL_PERMITIDO: 'pabloserranolopez@gmail.com',
  FIREBASE_API_KEY: 'AIzaSyArN_Bk25gA6TnHYxOg5vv-tHVohHIhnZM',
  FIREBASE_PROYECTO: 'road-to-elite',
  SHEET_ID: '1q_DbqA4VWLb-1CUuT8ZDGt-yMfiy__YeoT9-4V2IEJ4',      // Road to Elite · Training Coverage (único sitio donde se escribe)
  FABRIK_ID: '1DRBQteuUHesG2gMODigDBTr5LK5PHMsqRIdHpCtT82g',     // FABRIK PROGRAM · SOLO LECTURA
  PROGRAMAPP_ID: '1yL9AmLel4t5BzOT7fddqxMNVE-YqRm02oP1JeUpwqu8', // App de Gabi · SOLO LECTURA (copia semanal de vídeos)
  BACKUPS_ID: '1X2gFr5Wd-HfI5JsMcfiKscCu5GPXO-aS',
  CARPETA_2DO_CEREBRO: '1FWPEKf0AsbXBjemd8IMFqaURVFCH-U-n',
  KNOWLEDGE_ID: '1a0FcIEymHY1DQmRvlUEUnX-V8rXTeZX3',   // v0.19 · Drive › 2DO CEREBRO › CROSSFIT › KNOWLEDGE (.md por categorías): base de conocimiento
  BD_WOD_ID: '1FfIO-LR5_DutRo6SUHWyAhM5qWItMemWpnV6iQRs-RY',
  VIDEOS_BD_ID: '1UhfMpqreVbhn7EDK6bFzTm5lMn4aIkDw7gkmhHK2NnU',   // v0.18 · Drive › 2DO CEREBRO › «Base de datos Vídeos» (compartida por las apps de Pablo)   // Base_de_datos_WOD de la app de Gabi: Road To Elite SOLO LA LEE (v0.17)             // Drive: APP / Configuración / Backups
  ZONA: 'Europe/Madrid',
  CACHE_SEG: 300
};

var DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
var PROPS = PropertiesService.getScriptProperties();

// Pestañas de la app (fila 1 = cabecera). Las columnas se buscan por nombre.
var HOJAS = {
  CONFIG: 'APP · CONFIG', PLAN: 'APP · PLAN', REGISTRO: 'APP · REGISTRO', MARCAS: 'APP · MARCAS',
  DESCUENTOS: 'APP · DESCUENTOS', WEBS: 'APP · WEBS', VIDEOS: 'APP · VÍDEOS',
  EVENTOS: 'APP · EVENTOS', SEMANAS: 'APP · SEMANAS', PENDIENTES: 'APP · PENDIENTES', CAMBIOS: 'APP · CAMBIOS'
};

// ===================== API WEB =====================
function doGet(e) {
  if (e && e.parameter && e.parameter.state && (e.parameter.code || e.parameter.error)) return stravaCallback_(e);   // v0.29 · vuelta de Strava
  return json_({ ok: true, servicio: CONFIG.NOMBRE_APP, version: CONFIG.VERSION, hora: new Date().toISOString() });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.agente) return json_(accionAgente_(body));
    if (body.bd) return json_(accionBd_(body));         // v0.16: lectura de la base de datos de WODs por otras apps (token de lectura)   // v0.15: agente del PC (token propio, solo sus 5 acciones)
    var user = verificarUsuario_(body.idToken);
    if (!user.ok) return json_(user);
    var a = body.action, t0 = Date.now();
    // Operaciones que pueden llegar desde la cola sin conexión: si ya se procesaron (mismo «op»), no se repiten.
    var op = /^[\w-]{8,60}$/.test(String(body.op || '')) ? 'op_' + body.op : '', cacheOp = CacheService.getScriptCache();
    if (op && cacheOp.get(op)) return json_({ ok: true, repetida: true });
    var res; try { res = accion_(a, body, user); } finally { if (!esSoloLectura_(a)) try { invalidarSemana_(); } catch (eI) {} }
    if (op && res && res.ok) cacheOp.put(op, '1', 21600);
    var ms = Date.now() - t0;
    if (ms > 4000) Logger.log('LENTO · ' + a + ' · ' + ms + ' ms');
    res._ms = ms;
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: 'interno', detalle: String(err && err.message || err) });
  }
}

/** Cada acción devuelve un objeto; doPost lo envía como JSON. */
function accion_(a, body, user) {
  var json_ = function (o) { return o; };   // dentro de las acciones, «json_» solo devuelve el objeto
  {
    switch (a) {
      case 'inicio':     return json_({ ok: true, email: user.email, config: leerConfig_(), semana: semanaCacheada_(body.semana) });
      case 'semana':     return json_({ ok: true, semana: semanaCacheada_(body.semana) });
      case 'registrar':  return json_({ ok: true, registro: guardarRegistro_(body.registro || {}) });
      case 'registro_borrar': borrarRegistro_(body.registro || {}); return json_({ ok: true });
      case 'marcas':     return json_({ ok: true, marcas: listar_(HOJAS.MARCAS) });
      case 'marca':      anadirFila_(HOJAS.MARCAS, limpiarMarca_(body.marca || {})); return json_({ ok: true, marcas: listar_(HOJAS.MARCAS) });
      case 'marca_borrar': borrarFila_(HOJAS.MARCAS, body.fila, body.coincide || {}); return json_({ ok: true, marcas: listar_(HOJAS.MARCAS) });
      case 'descuentos': return json_({ ok: true, descuentos: listar_(HOJAS.DESCUENTOS) });
      case 'descuento':  anadirFila_(HOJAS.DESCUENTOS, permitidas_(body.descuento || {}, ['MARCA', 'DESCRIPCIÓN', 'CÓDIGO', 'ENLACE', 'INICIO', 'FIN', 'ESTADO', 'NOTAS'])); return json_({ ok: true, descuentos: listar_(HOJAS.DESCUENTOS) });
      case 'descuento_borrar': borrarFila_(HOJAS.DESCUENTOS, body.fila, body.coincide || {}); return json_({ ok: true, descuentos: listar_(HOJAS.DESCUENTOS) });
      case 'webs':       return json_({ ok: true, webs: listar_(HOJAS.WEBS) });
      case 'web':        var w = permitidas_(body.web || {}, ['NOMBRE', 'URL', 'CATEGORÍA', 'NOTA']); w['AÑADIDO'] = ahora_(); anadirFila_(HOJAS.WEBS, w); return json_({ ok: true, webs: listar_(HOJAS.WEBS) });
      case 'web_borrar': borrarFila_(HOJAS.WEBS, body.fila, body.coincide || {}); return json_({ ok: true, webs: listar_(HOJAS.WEBS) });
      case 'videos':     return json_({ ok: true, videos: leerVideos_() });
      case 'cobertura':  return json_({ ok: true, cobertura: cobertura_() });
      // --- v0.4: eventos, confirmación de semana, propuestas, pendientes ---
      case 'eventos':    return json_({ ok: true, eventos: listar_(HOJAS.EVENTOS) });
      case 'evento':     var idEv = guardarEvento_(body.evento || {}); return json_({ ok: true, id: idEv, eventos: listar_(HOJAS.EVENTOS) });
      case 'evento_borrar': borrarEvento_(body.id); return json_({ ok: true, eventos: listar_(HOJAS.EVENTOS) });
      case 'semana_dobles': guardarDobles_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver || body.lunes) });
      case 'semana_conf': guardarSemanaConf_(body); var cfab = null; if (body.cargar) { try { cfab = cargarFabrikSemana_(body.lunes); } catch (e) { cfab = { ok: false, motivo: String(e && e.message || e) }; } } return json_({ ok: true, carga: cfab, semana: semanaCompleta_(body.ver || body.lunes) });
      case 'plan_aprobar': var nAp = aprobarPlanSemana_(body.lunes); refrescarResumen_(); if (leerConfig_().resumen_auto !== 'No') { try { enviarResumenSemana_(body.lunes); } catch (e) { Logger.log('Correo: ' + e); } } return json_({ ok: true, aprobados: nAp, semana: semanaCompleta_(body.lunes) });
      case 'cambio':     var idC = solicitarCambio_(body); return json_({ ok: true, id: idC, semana: semanaCompleta_(body.ver) });
      case 'cambio_resolver': resolverCambio_(body.cambio, !!body.aprobar); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'no_hacer':   noHacer_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'cancelar':   noHacer_(Object.assign({}, body, { cancelar: true })); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'reactivar':  reactivarBloque_(body.id); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'fusion_previa': return json_({ ok: true, fusion: fusionarBloques_(body.ids, { simular: true }) });
      case 'fusionar':   var fr = fusionarBloques_(body.ids); refrescarHojaSemana_(lunesDe_(celdaIso_(fr.bloque.FECHA))); return json_({ ok: true, fusion: fr, semana: semanaCompleta_(body.ver) });
      case 'desfusionar': desfusionar_(body.id); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'estimulos_lista': var lis = estimulosLista_(lunesDe_(body.lunes || hoyIso_())), rb = body.id ? listar_(HOJAS.PLAN).filter(function (x) { return x.ID === String(body.id); })[0] : null; return json_({ ok: true, lista: rb ? candidatosCambio_(rb, lis) : lis });
      case 'cambiar_estimulo': var ce = cambiarEstimulo_(body.id, body.codigo); refrescarHojaSemana_(lunesDe_(body.ver || hoyIso_())); return json_({ ok: true, cambio: ce, semana: semanaCompleta_(body.ver) });
      case 'intercambiar_sesion': var nis = intercambiarSesion_(body.a, body.b); refrescarHojaSemana_(lunesDe_(String(body.a).split('|')[0])); return json_({ ok: true, movidos: nis, semana: semanaCompleta_(body.ver) });
      // --- v0.5: metas editables, registro de carrera y análisis ---
      case 'metas':      return json_({ ok: true, metas: metasDe_(body.fecha), lista: listar_(HOJAS.METAS) });
      case 'meta':       var idM = guardarMeta_(body.meta || {}); return json_({ ok: true, id: idM, metas: metasDe_(body.fecha), lista: listar_(HOJAS.METAS) });
      case 'meta_borrar': borrarMeta_(body.id); return json_({ ok: true, metas: metasDe_(body.fecha), lista: listar_(HOJAS.METAS) });
      case 'meta_ajuste': ajusteMeta_(body); return json_({ ok: true, metas: metasDe_(body.fecha) });
      case 'carrera':    var idCa = guardarCarrera_(body.carrera || {}); return json_({ ok: true, id: idCa, analisis: analizarCarrera_() });
      case 'carrera_lista': return json_({ ok: true, carrera: listar_(HOJAS.CARRERA).slice(-60) });
      case 'analisis':   return json_({ ok: true, analisis: analizarCarrera_() });
      // --- v0.6: chequeo matinal, bloques y plantillas desde la app, avisos al móvil ---
      case 'chequeo':    return json_({ ok: true, chequeo: guardarChequeo_(body.chequeo || {}) });
      case 'chequeos':   return json_({ ok: true, chequeos: listar_(HOJAS.CHEQUEO).slice(-30) });
      case 'bloque':     var idB = crearBloque_(body.bloque || {}); return json_({ ok: true, id: idB, semana: semanaCompleta_(body.ver) });
      case 'bloque_borrar': borrarBloque_(body.id); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'plantillas': return json_({ ok: true, plantillas: listar_(HOJAS.PLANTILLAS) });
      case 'plantilla':  guardarPlantilla_(body.plantilla || {}); return json_({ ok: true, plantillas: listar_(HOJAS.PLANTILLAS) });
      case 'push_token': guardarTokenPush_(body.token); return json_({ ok: true });
      case 'push_prueba': return json_({ ok: true, enviados: enviarPush_('Road To Elite', 'Los avisos funcionan en este dispositivo.') });
      case 'pendiente_editar': editarPendiente_(body); return json_({ ok: true, pendientes: pendientesAbiertos_() });
      case 'pendiente':  var pd = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ID === String(body.id); })[0];
                         if (!pd) throw new Error('no_encontrado');
                         if (['Pendiente', 'Propuesto', 'Reprogramado', 'Descartado'].indexOf(body.estado) < 0) throw new Error('estado_no_valido');
                         actualizarFila_(HOJAS.PENDIENTES, pd._fila, { ESTADO: body.estado }); return json_({ ok: true, pendientes: pendientesAbiertos_() });
      // --- v0.9: Fabrik en el plan, extras automáticos, hoja de la semana, refuerzos, notas, WODs, avisos ---
      case 'cargar_fabrik': var rf = cargarFabrikSemana_(body.lunes); return json_({ ok: true, carga: rf, semana: semanaCompleta_(body.ver || body.lunes) });
      case 'extras_previa': return json_(previaExtras_(body));
      case 'config_set': if (['endurance_manana'].indexOf(body.clave) < 0) throw new Error('clave_no_permitida');
                         ponerConfig_(body.clave, body.valor ? 'Sí' : 'No', 'Endurance de mañana: la Z2 (carrera/erg) solo por la mañana; el domingo de comodín (Sí/No, también desde aquí)');
                         return json_({ ok: true, config: leerConfig_() });
      case 'generar_extras': if (body.dobles != null) guardarDobles_(body); var rg = generarExtras_(body.lunes, { dias: body.dias, descanso: body.descanso, resto: body.resto, reabrir: body.reabrir }); if (body.deseo) { try { rg.medida = extraADeseo_(body.lunes, String(body.deseo).slice(0, 300)); if (rg.medida.ok) rg.resumen = (rg.resumen || '') + ' · + metcon a medida (' + rg.medida.dia.toLowerCase() + ' ' + rg.medida.turno + ')'; } catch (e) { rg.medida = { ok: false, avisos: [String(e && e.message || e)] }; } } if (body.aprobar) { try { rg.aprobados = aprobarPlanSemana_(body.lunes); } catch (e) { rg.aprobarError = String(e && e.message || e); } } refrescarResumen_(); MEMO = null; return json_({ ok: true, extras: rg, semana: semanaCompleta_(body.ver || body.lunes) });
      case 'posicion':   return json_({ ok: true, posicion: conMemo_(function () { return posicionOptima_(body); }) });
      case 'bloque_editar': editarBloque_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'intercambiar': intercambiarBloques_(body.a, body.b); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'hoja_semana': return json_({ ok: true, filas: pintarHojaSemana_(body.lunes) });
      case 'enviar_resumen': return json_({ ok: true, enviado: enviarResumenSemana_(body.lunes) });
      case 'incentivo_datos': return json_({ ok: true, lunes: lunesDe_(body.lunes || hoyIso_()), semana: numSemana_(lunesDe_(body.lunes || hoyIso_())), metas: datosIncentivo_(lunesDe_(body.lunes || hoyIso_())) });
      case 'meta_reducible': marcarReducible_(body.id, !!body.si); return json_({ ok: true });
      case 'op_estado': return json_({ ok: true, op: opPayload_(lunesDe_(body.lunes || hoyIso_())), registro: listar_(HOJAS.OPERACION).slice(-30).reverse() });
      case 'op_config': var og = opGuardar_(body); return json_({ ok: true, movidos: og.movidos, op: opPayload_(lunesDe_(body.lunes || hoyIso_())), semana: semanaCompleta_(body.lunes || hoyIso_()) });
      case 'op_registro': var orr = opRegistrar_(body); return json_({ ok: true, alarma: orr.alarma, op: opPayload_(lunesDe_(hoyIso_())), registro: listar_(HOJAS.OPERACION).slice(-30).reverse() });
      case 'op_wpd': var ow = opWpd_(body); return json_(Object.assign({ ok: true, semana: semanaCompleta_(body.fecha) }, ow));
      case 'aprendizaje': return json_(Object.assign({ ok: true }, datosAprendizaje_()));
      case 'deathnote_responder': var nr = responderDeathnote_(body.respuestas); return json_(Object.assign({ ok: true, guardadas: nr }, datosAprendizaje_()));
      case 'aprendizaje_analizar': return json_(Object.assign({ ok: true, resultado: aprendizajeSemanal(body.lunes || '') }, datosAprendizaje_()));
      case 'rendimiento': return json_(Object.assign({ ok: true }, rendimiento_()));
      case 'rendimiento_guardar': guardarRendimiento_(body); return json_(Object.assign({ ok: true }, rendimiento_()));
      case 'referencia_programar': return json_(programarReferencia_(body));
      case 'murph_fecha': return json_(murphFecha_(body.fecha));
      case 'ritmos_confirmar': return json_(ritmosConfirmar_());
      case 'strava_sync': return json_(stravaSync_());
      case 'pausa_quitar': reanudarEstimulo_(body.codigo); return json_({ ok: true, semana: semanaCompleta_(body.semana) });
      case 'garmin_sync': return json_(garminDiario_(body.iso || ''));
      case 'fichas': return json_({ ok: true, fichas: fichas_() });
      case 'ficha_guardar': var fg = guardarFicha_(body.ficha || {}); return json_({ ok: true, ficha: fg, fichas: fichas_() });
      case 'plan_competi': return json_({ ok: true, plan: planCompeti_(body.id) });
      case 'resumen_lunes': return json_({ ok: true, resumen: resumenLunesDatos_(body.lunes) });
      case 'salud': return json_({ ok: true, salud: saludEstado_() });
      case 'feedback_extra': return json_({ ok: true, registro: feedbackExtra_(body) });
      case 'registrar_dia': var nRd = registrarDia_(body.iso); return json_({ ok: true, n: nRd, semana: semanaCompleta_(body.iso) });
      case 'regla_activa': reglaActiva_(body.clave, !!body.activa); return json_(Object.assign({ ok: true }, datosAprendizaje_()));
      case 'lesion_zonas': return json_({ ok: true, zonas: ZONAS_LESION_ });
      case 'competis': return json_({ ok: true, competis: listaCompetis_(), copia: leerConfig_().competis_copia || '' });
      case 'competi_seguir': seguirCompeti_(body); return json_({ ok: true, competis: listaCompetis_(), preguntas: preguntasCompetis_() });
      case 'competi_responder': var rcp = responderCompeti_(body); return json_({ ok: true, quitada: !!rcp.quitada, competis: listaCompetis_(), preguntas: preguntasCompetis_() });
      case 'competis_copiar': copiarCompetis_(); return json_({ ok: true, competis: listaCompetis_(), copia: leerConfig_().competis_copia || '' });
      case 'metcon_generar': return json_({ ok: true, metcon: metconGuiado_(body.deseo, { min: body.min, material: body.material, lunes: body.lunes, formato: body.formato }) });
      case 'motor_wods': return json_({ ok: true, wods: listar_(HOJAS.MOTOR).slice(-80).map(function (r) { return { id: r.ID, fuente: r.FUENTE, nombre: r.NOMBRE, formato: r.FORMATO, min: r.MIN, movimientos: r.MOVIMIENTOS, interferencias: r.INTERFERENCIAS, ciencia: r.CIENCIA, conceptos: r['CONCEPTOS (Ollama)'], por: r['ANALIZADO POR'] }; }) });
      case 'backup_ahora': var bk = backupJueves(); return json_({ ok: true, backup: bk, config: leerConfig_() });
      case 'reest_proponer': return json_({ ok: true, propuesta: conMemo_(function () { return reestProponer_(body.modo, body.lunes, body.params || {}); }) });
      case 'reest_aplicar': var ra = reestAplicar_(body.id, body.ajustes); refrescarResumen_(); return json_({ ok: true, aplicado: ra, semana: semanaCompleta_(body.lunes) });
      case 'reest_deshacer': reestDeshacer_(body.id); refrescarResumen_(); return json_({ ok: true, semana: semanaCompleta_(body.lunes) });
      case 'reest_material': var rm = reestMaterial_(body.lunes, body.iso, body.turno, body.material || []); return json_({ ok: true, bloque: rm, semana: semanaCompleta_(body.lunes) });
      case 'extras_curso': return json_({ ok: true, extras: conMemo_(function () { return extrasCurso_(body.lunes); }) });
      case 'biblioteca': return json_({ ok: true, biblioteca: biblioteca_() });
      case 'bloque_quitar': quitarBloque_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'refuerzo':   guardarRefuerzo_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'refuerzo_borrar': var rz = listar_(HOJAS.REFUERZOS).filter(function (r) { return r.ID === String(body.id); })[0]; if (!rz) throw new Error('no_encontrado');
                         borrarFila_(HOJAS.REFUERZOS, rz._fila, { ID: rz.ID }); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'nota_bloque': return json_({ ok: true, nota: guardarNotaBloque_(body.nota || {}) });
      case 'wods':       return json_({ ok: true, wods: listar_(HOJAS.WODS) });
      case 'wod':        var idW = guardarWod_(body.wod || {}); return json_({ ok: true, id: idW, wods: listar_(HOJAS.WODS) });
      case 'wod_borrar': borrarWod_(body.id); return json_({ ok: true, wods: listar_(HOJAS.WODS) });
      case 'aviso_visto': avisoVisto_(body.id); return json_({ ok: true, config: leerConfig_() });
      case 'evento_aprobar': var ea = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(body.id); })[0]; if (!ea) throw new Error('no_encontrado');
                         actualizarFila_(HOJAS.EVENTOS, ea._fila, { ESTADO: body.aprobar ? 'Por decidir' : 'Ignorado' }); return json_({ ok: true, semana: semanaCompleta_(body.ver) });
      case 'pedir_claude': pedirClaude_(body); return json_({ ok: true, semana: semanaCompleta_(body.ver || body.lunes) });
    }
    return json_({ ok: false, error: 'accion_desconocida' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ===================== SEGURIDAD =====================
/** Comprueba el token de Firebase con Google y que el email sea el único permitido y esté verificado. */
function verificarUsuario_(idToken) {
  if (!idToken) return { ok: false, error: 'sin_sesion' };
  var cache = CacheService.getScriptCache();
  var clave = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(idToken).slice(0, 4096))).slice(0, 40);
  if (cache.get('no' + clave)) return { ok: false, error: 'sesion_caducada' };
  var email = cache.get(clave);
  if (!email) {
    // Filtro previo SIN coste: si el token ni siquiera dice ser tuyo, de este proyecto y vigente, se rechaza sin consultar a Google.
    // (No sustituye a la comprobación de Google de abajo, que es la que verifica la firma.)
    var pre = cargaJwt_(idToken);
    if (!pre || pre.aud !== CONFIG.FIREBASE_PROYECTO || !(pre.exp * 1000 > Date.now()) || String(pre.email || '').toLowerCase() !== CONFIG.EMAIL_PERMITIDO) {
      cache.put('no' + clave, '1', 600);
      return { ok: false, error: pre && pre.email && String(pre.email).toLowerCase() !== CONFIG.EMAIL_PERMITIDO ? 'no_autorizado' : 'sesion_caducada' };
    }
    var res = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CONFIG.FIREBASE_API_KEY,
      { method: 'post', contentType: 'application/json', headers: { Referer: CONFIG.URL_APP }, payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'sesion_caducada' };
    var u = (JSON.parse(res.getContentText()).users || [])[0];
    if (!u || !u.email || u.emailVerified !== true) return { ok: false, error: 'sesion_caducada' };
    email = String(u.email).toLowerCase();
    cache.put(clave, email, Math.max(30, Math.min(600, Math.floor(pre.exp - Date.now() / 1000) - 30)));   // nunca más que la vida del token
  }
  if (email !== CONFIG.EMAIL_PERMITIDO) return { ok: false, error: 'no_autorizado' };
  return { ok: true, email: email };
}

/** Único libro en el que se puede escribir. Si alguien cambia el ID por error, se para aquí. */
/** Lee (sin verificar) la parte central de un token JWT. Solo sirve de filtro previo. */
function cargaJwt_(t) {
  var p = String(t || '').split('.');
  if (p.length !== 3 || p[1].length > 3000) return null;
  try {
    var s = p[1].replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    return JSON.parse(Utilities.newBlob(Utilities.base64Decode(s)).getDataAsString());
  } catch (e) { return null; }
}

var MI_LIBRO_ = null, HOJAS_ABIERTAS_ = {}, CAB_ = {};   // v0.27 · por ejecución: el libro, cada pestaña y su cabecera se abren una sola vez
function miLibro_() {
  if (MI_LIBRO_) return MI_LIBRO_;
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  if (ss.getId() !== CONFIG.SHEET_ID) throw new Error('escritura_bloqueada');
  return (MI_LIBRO_ = ss);
}

/** Libros de solo lectura (Fabrik y app de Gabi). Nunca se usan para escribir. */
function fabrik_() { return SpreadsheetApp.openById(CONFIG.FABRIK_ID); }
function programApp_() { return SpreadsheetApp.openById(CONFIG.PROGRAMAPP_ID); }

function hojaMia_(nombre) {
  if (HOJAS_ABIERTAS_[nombre]) return HOJAS_ABIERTAS_[nombre];
  var sh = (ESQ_BD_[nombre] ? motorLibro_() : ESQ_VID_[nombre] ? videosLibro_() : miLibro_()).getSheetByName(nombre);
  if (!sh) throw new Error('Falta la pestaña ' + nombre);
  sh._rte = nombre;
  return (HOJAS_ABIERTAS_[nombre] = sh);
}
function olvidarCabeceras_() { CAB_ = {}; HOJAS_ABIERTAS_ = {}; }

function bloqueo_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ===================== TABLAS (solo en este libro) =====================
function cabeceras_(sh) {
  var k = sh._rte; if (k && CAB_[k]) return CAB_[k];
  var c = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
  if (k) CAB_[k] = c;
  return c;
}

/**
 * Lecturas agrupadas: mientras se monta una respuesta (semana, cobertura, metas) cada pestaña se lee UNA sola vez.
 * Fuera de eso se lee siempre fresca (las escrituras nunca usan una copia vieja).
 */
var MEMO = null;
function conMemo_(fn) {
  if (MEMO) return fn();
  MEMO = {};
  try { return fn(); } finally { MEMO = null; }
}
/** Filas de una pestaña de la app como objetos { CABECERA: texto, _fila }. */
function listar_(nombre) {
  if (MEMO && MEMO[nombre]) return MEMO[nombre];
  var filas = listarHoja_(nombre);
  if (MEMO) MEMO[nombre] = filas;
  return filas;
}
function listarHoja_(nombre) {
  var sh = hojaMia_(nombre), todo = sh.getDataRange().getDisplayValues();   // v0.27 · una sola llamada (antes: 4)
  var cab = (todo[0] || []).map(function (h) { return String(h).trim(); }); while (cab.length && !cab[cab.length - 1]) cab.pop();
  if (sh._rte) CAB_[sh._rte] = cab;
  if (todo.length < 2) return [];
  return todo.slice(1).map(function (r, i) {
    var o = { _fila: i + 2 };
    cab.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  }).filter(function (o) { return cab.some(function (h) { return String(o[h]).trim(); }); });
}

/**
 * Valor seguro para escribir en el Sheet (configuración es_ES):
 *  · «46:10» o «5:41» (tiempos y ritmos) se guardan como TEXTO: si no, el Sheet los convierte en horas (46:10:00).
 *  · Un texto que empieza por «=» o por «+» seguido de letras se guarda como texto (si no, fórmula o #ERROR!).
 *  · Números, fechas dd/mm/aaaa y negativos (-1) no se tocan.
 */
function celdaSegura_(v) {
  if (typeof v !== 'string' || !v) return v;
  if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(v)) return "'" + v;
  if (/^=/.test(v)) return "'" + v;
  if (/^\+/.test(v) && !/^\+\d+([.,]\d+)?$/.test(v)) return "'" + v;
  return v;
}
function filaDe_(cab, o) { return cab.map(function (h) { return o[h] == null ? '' : celdaSegura_(o[h]); }); }

function anadirFila_(nombre, o) {
  return bloqueo_(function () {
    var sh = hojaMia_(nombre), cab = cabeceras_(sh);
    var fila = Math.max(1, sh.getLastRow()) + 1;
    sh.getRange(fila, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return fila;
  });
}

/** Borra una fila solo si sigue teniendo lo que la app cree que tiene (evita borrar la fila equivocada). */
function borrarFila_(nombre, fila, coincide) {
  fila = Number(fila);
  if (!(fila >= 2)) throw new Error('fila_no_valida');
  bloqueo_(function () {
    var sh = hojaMia_(nombre), cab = cabeceras_(sh);
    var r = sh.getRange(fila, 1, 1, cab.length).getDisplayValues()[0];
    var ok = Object.keys(coincide).length > 0 && Object.keys(coincide).every(function (h) {
      var j = cab.indexOf(h); return j >= 0 && String(r[j]).trim() === String(coincide[h]).trim();
    });
    if (!ok) throw new Error('la_fila_ha_cambiado');
    sh.deleteRow(fila);
  });
}

function permitidas_(o, campos) {
  var out = {};
  campos.forEach(function (c) { if (o[c] != null) out[c] = String(o[c]).slice(0, 2000); });
  return out;
}

function limpiarMarca_(m) {
  var o = permitidas_(m, ['FECHA', 'MOVIMIENTO', 'TIPO', 'VALOR', 'UNIDAD', 'EVENTO', 'NOTAS']);
  if (!o.MOVIMIENTO || !o.VALOR) throw new Error('marca_incompleta');
  o.MOVIMIENTO = o.MOVIMIENTO.toUpperCase();
  o.FECHA = o.FECHA || hoyTxt_();
  o.FUENTE = 'App Road To Elite';
  return o;
}

function hoyIso_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd'); }
function hoyTxt_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'dd/MM/yyyy'); }
function ahora_() { return Utilities.formatDate(new Date(), CONFIG.ZONA, 'dd/MM/yyyy HH:mm'); }
function isoOk_(x) { return /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? String(x) : ''; }
function celdaIso_(c) {
  if (c instanceof Date) return Utilities.formatDate(c, CONFIG.ZONA, 'yyyy-MM-dd');
  var s = String(c || '').trim();
  return isoOk_(s) || fechaIso(s);
}
function lunesDe_(iso) {
  iso = isoOk_(iso) || hoyIso_();
  var dow = new Date(iso + 'T12:00:00Z').getUTCDay();
  return sumarDias(iso, -((dow + 6) % 7));
}

// ===================== CONFIG =====================
function leerConfig_() {
  var out = {};
  listar_(HOJAS.CONFIG).forEach(function (r) { if (r.CLAVE) out[r.CLAVE] = r.VALOR; });
  return out;
}

// ===================== SEMANA: FABRIK + PLAN + REGISTRO =====================
/**
 * semana = lunes 'yyyy-MM-dd' (opcional). Por defecto, la semana actual.
 * Devuelve: lo de Fabrik de esa semana (si existe), las filas de APP · PLAN y lo registrado en APP · REGISTRO.
 */
function semanaCompleta_(semana) { return conMemo_(function () { return semanaCompletaSin_(semana); }); }
/** Lo de Fabrik para una semana, guardado 5 min: Fabrik solo se abre cuando la copia caduca (es lo más lento). */
function fabrikSemana_(lunes) {
  var cache = CacheService.getScriptCache(), clave = 'fab2_' + lunes, v = cache.get(clave);
  if (v) return JSON.parse(v);
  var est = estructura_(fabrik_());
  var fab = est.semanas.filter(function (s) { return s.iso === lunes; })[0] || null;
  var out = { lista: est.semanas.map(function (s) { return { iso: s.iso, nombre: s.nombre }; }), erratas: est.erratas, fabrik: fab ? semanaBase_(fab, est) : null };
  try { cache.put(clave, JSON.stringify(out), CONFIG.CACHE_SEG); } catch (e) { /* demasiado grande: se recalcula */ }
  return out;
}
function semanaCompletaSin_(semana) {
  var lunes = lunesDe_(semana);
  var domingo = sumarDias(lunes, 6);
  var F = fabrikSemana_(lunes);
  var enSemana = function (r) { var d = celdaIso_(r.FECHA); return d && d >= lunes && d <= domingo; };
  var base = {
    lunes: lunes, hoy: hoyIso_(), semanasFabrik: F.lista, erratasFabrik: F.erratas,
    fabrik: F.fabrik,
    plan: listar_(HOJAS.PLAN).filter(enSemana).sort(function (x, y) { return (Number(x.ORDEN) || 0) - (Number(y.ORDEN) || 0); }),
    registro: listar_(HOJAS.REGISTRO).filter(enSemana),
    carrera: listar_(HOJAS.CARRERA).filter(enSemana),
    chequeos: listar_(HOJAS.CHEQUEO).filter(function (r) { var d = celdaIso_(r.FECHA); return d && d >= sumarDias(lunes, -1) && d <= domingo; }),
    push: pushActivo_(),
    eventos: eventosEntre_(sumarDias(lunes, -35), sumarDias(lunes, 120)),
    conf: filaSemana_(lunes), confSiguiente: filaSemana_(sumarDias(lunes, 7)),
    pendientes: pendientesAbiertos_(), cambios: cambiosAbiertos_(),
    metas: metasDe_(lunes),
    fabrikCambios: cambiosFabrik_(filaSemana_(lunes), F.fabrik)
  };
  var out = Object.assign(base, extrasSemana_(lunes, base));
  try { out.clave = claveSemana_(lunes, base.plan); } catch (e) { out.clave = {}; }
  try { out.reest = reestActiva_(lunes); } catch (e) { out.reest = []; }
  try { out.activacion = activacionSemana_(lunes); } catch (e) { out.activacion = {}; }   // v0.29
  try { out.pausa = pausaInfo_(); } catch (e) { out.pausa = []; }   // v0.30
  try { var hoyF = hoyIso_(); out.feedbackAyer = hoyF >= lunes && hoyF <= sumarDias(lunes, 7) ? feedbackAyer_(hoyF) : []; } catch (e) { out.feedbackAyer = []; }
  try { out.op = opPayload_(lunes); if (out.op && out.op.activo && out.fabrik) out.fabrik = opFabrik_(out.fabrik, opSemana_(lunes)); } catch (e) { out.op = null; }   // v0.27 · modo operación (Fabrik solo se filtra al enseñarlo)
  try { var pk = pesoKg_(); out.combustible = {}; for (var k = 0; k < 7; k++) { var dk = sumarDias(lunes, k); out.combustible[dk] = combustibleDia_(dk, pk); } } catch (e) { out.combustible = {}; }
  return out;
}

// ===================== v0.8 · DETECTOR DE CAMBIOS EN FABRIK (solo lectura) =====================
/** Huella corta del contenido de cada día de Fabrik (títulos + texto de cada parte). */
function huellasFabrik_(fab) {
  var out = {};
  ((fab && fab.dias) || []).forEach(function (d) {
    var txt = JSON.stringify((d.bloques || []).map(function (b) { return [b.titulo, (b.partes || []).map(function (p) { return p.texto; })]; }));
    out[d.nombre] = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, txt)).slice(0, 12);
  });
  return out;
}
/** Días cuyo contenido de Fabrik ha cambiado desde que se aprobó la semana (o que se subieron después). */
function cambiosFabrik_(conf, fab) {
  if (!conf || !conf['HUELLA FABRIK'] || !fab) return [];
  var antes = {}; try { antes = JSON.parse(conf['HUELLA FABRIK']); } catch (e) { return []; }
  var ahora = huellasFabrik_(fab);
  return Object.keys(ahora).filter(function (d) { return antes[d] !== ahora[d]; }).map(function (d) { return { dia: d, nuevo: !antes[d], aprobado: conf['FABRIK LEÍDO'] || '' }; });
}

// ===================== v0.8 · LOS TESTS COMO EVENTOS (una sola fuente de fechas) =====================
function migrarTestsAEventos_() {
  var cfg = leerConfig_(), evs = listar_(HOJAS.EVENTOS), n = 0;
  [['test_2km', 'Test 2 km'], ['test_10km', 'Test 10 km']].forEach(function (t) {
    var txt = String(cfg[t[0]] || ''), f = txt.match(/(\d{1,2}\/\d{1,2}\/\d{4})\D+(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (!f || evs.some(function (e) { return norm(e.EVENTO) === norm(t[1]); })) return;
    guardarEvento_({ EVENTO: t[1], TIPO: 'Carrera', INICIO: f[1], FIN: f[2], BLOQUEA: 'No bloquea', 'ANTES (días bajar volumen)': '1', 'DESPUÉS (días recuperación)': '1',
      'CÓMO PROCEDER': 'Semana del test: el día exacto se fija al programar la semana (descansado, sin Z6–Z8 ni pierna pesada el día antes).', ESTADO: 'Decidido', NOTAS: 'TEST · migrado de APP · CONFIG' });
    n++;
  });
  return n;
}

// ===================== v0.7 · DOMINGO EN CADENA: cierre → vídeos → backup =====================
/** Un solo disparador hace las tres fases en orden y deja el resultado en APP · CONFIG (clave «ultimo_domingo»). */
function domingoNoche() { return conSalud_('domingoNoche', domingoNoche_sin_); }
function domingoNoche_sin_() {
  var fases = [['cierre', cierreSemanal], ['carrera', function () { ajusteCarrera_(); }], ['aprendizaje', function () { aprendizajeSemanal(); }], ['backup', backupSemanal], ['archivo', archivarSiToca_]], estado = [];
  fases.forEach(function (f) {
    try { f[1](); estado.push(f[0] + ' OK ' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'HH:mm')); }
    catch (e) { estado.push(f[0] + ' FALLO (' + String(e && e.message || e).slice(0, 120) + ')'); }
  });
  ponerConfig_('ultimo_domingo', hoyTxt_() + ' · ' + estado.join(' · '), 'Resultado de las tareas del domingo (lo lee el informe de las 23:30)');
  Logger.log('OK · Domingo: ' + estado.join(' · '));
}
function ponerConfig_(clave, valor, nota) {
  var x = listar_(HOJAS.CONFIG).filter(function (r) { return r.CLAVE === clave; })[0];
  if (x) actualizarFila_(HOJAS.CONFIG, x._fila, { VALOR: valor });
  else anadirFila_(HOJAS.CONFIG, { CLAVE: clave, VALOR: valor, NOTA: nota || '' });
}

/** La semana de Fabrik ya construida, con caché de 5 min (Fabrik solo se lee). */
function semanaBase_(elegida, est) {
  var cache = CacheService.getScriptCache();
  var claveCache = 'rte_' + elegida.id + '_' + elegida.iso + '_' + (elegida.variantes || []).map(function (v) { return v.hoja.getSheetId(); }).join('-');
  var base = cache.get(claveCache);
  if (base) return JSON.parse(base);
  base = construirSemana(
    elegida.hoja.getDataRange().getDisplayValues(),
    elegida.notas ? elegida.notas.getDataRange().getDisplayValues() : [],
    est.ciclo, elegida.nombre, elegida.iso);
  (elegida.variantes || []).forEach(function (v) { aplicarVariante(base, v.nombre, v.hoja.getDataRange().getDisplayValues()); });
  try { cache.put(claveCache, JSON.stringify(base), CONFIG.CACHE_SEG); } catch (e) { /* demasiado grande */ }
  return base;
}

// ===================== REGISTRO (realizado) =====================
var CAMPOS_REGISTRO = ['FECHA', 'ID_PLAN', 'BLOQUE', 'HECHO', 'RPE', 'MIN_REAL', 'DATOS (parciales/vatios)', 'CARGAS', 'SUEÑO', 'MOLESTIAS', 'NOTAS'];

/** Crea o actualiza (misma FECHA + ID_PLAN + BLOQUE) lo que has hecho. */
function guardarRegistro_(r) {
  var o = permitidas_(r, CAMPOS_REGISTRO); if (o.RESULTADO || o.FEEDBACK) ['RESULTADO', 'FEEDBACK'].forEach(function (h) { asegurarColumna_(HOJAS.REGISTRO, h); });
  if (!o.FECHA || !(o.ID_PLAN || o.BLOQUE)) throw new Error('registro_incompleto');
  if (o.HECHO && ['Sí', 'Parcial', 'No'].indexOf(o.HECHO) < 0) throw new Error('hecho_no_valido');
  if (o.RPE && !(Number(o.RPE) >= 1 && Number(o.RPE) <= 10)) throw new Error('rpe_no_valido');
  o.REGISTRADO = ahora_();
  return bloqueo_(function () {
    var sh = hojaMia_(HOJAS.REGISTRO), cab = cabeceras_(sh);
    // Mismo día + mismo bloque del plan (ID_PLAN). Sin ID_PLAN, se empareja por el nombre del bloque.
    var existe = listar_(HOJAS.REGISTRO).filter(function (x) {
      return x.FECHA === o.FECHA && (o.ID_PLAN ? x.ID_PLAN === o.ID_PLAN : (!x.ID_PLAN && x.BLOQUE === (o.BLOQUE || '')));
    })[0];
    var fila = existe ? existe._fila : Math.max(1, sh.getLastRow()) + 1;
    sh.getRange(fila, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    o._fila = fila;
    // «No hecho» = pendiente: no cuenta como estímulo hecho y se propone la semana siguiente (una sola vez)
    if (o.HECHO === 'No' && o.ID_PLAN && !listar_(HOJAS.PENDIENTES).some(function (p) { return p.ID_PLAN === o.ID_PLAN && celdaIso_(p['FECHA ORIGINAL']) === celdaIso_(o.FECHA); })) {
      var pl = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === o.ID_PLAN; })[0] || { ID: o.ID_PLAN, FECHA: o.FECHA, 'TÍTULO': o.BLOQUE };
      anadirPendiente_(Object.assign({}, pl, { FECHA: o.FECHA }), 'Marcado como no hecho' + (o.NOTAS ? ': ' + o.NOTAS : ''));
    }
    return o;
  });
}

function borrarRegistro_(r) {
  var x = listar_(HOJAS.REGISTRO).filter(function (y) {
    return y.FECHA === String(r.FECHA || '') && (r.ID_PLAN ? y.ID_PLAN === String(r.ID_PLAN) : y.BLOQUE === String(r.BLOQUE || ''));
  })[0];
  if (!x) throw new Error('no_encontrado');
  borrarFila_(HOJAS.REGISTRO, x._fila, x.ID_PLAN ? { FECHA: x.FECHA, ID_PLAN: x.ID_PLAN } : { FECHA: x.FECHA, BLOQUE: x.BLOQUE });
}

// ===================== VÍDEOS =====================
function leerVideos_() {
  return listar_(HOJAS.VIDEOS).filter(function (r) { return r.EJERCICIO && r['VÍDEO'] && r.ESTADO !== 'ROTO'; }).map(function (r) {
    return { nombre: String(r.EJERCICIO).trim(), alias: String(r.ALIAS || '').split(';').map(function (a) { return a.trim(); }).filter(Boolean), url: String(r['VÍDEO']).trim(), estado: r.ESTADO || '' };
  });
}

// v0.21.1 · Road To Elite ya NO lee el DICCIONARIO de la app de Gabi: esa app copia sus ejercicios en la «Base de datos Vídeos»
// los martes a las 05:00, y Road To Elite lee de ahí (videosMartes, martes 06:00). Ver videosMartes() más abajo.

// ===================== COPIA DE SEGURIDAD EN DRIVE =====================
/**
 * Copia completa de Training Coverage (todas las pestañas, fórmulas incluidas) en APP / Configuración / Backups,
 * con la fecha en el nombre. Se ejecuta sola los domingos a las 23:30 (ver configurar()). También se puede lanzar a mano.
 */
function backupSemanal() {
  var carpeta = DriveApp.getFolderById(CONFIG.BACKUPS_ID);
  var nombre = 'Road to Elite · Training Coverage · backup ' + Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd HHmm');
  var copia = DriveApp.getFileById(CONFIG.SHEET_ID).makeCopy(nombre, carpeta);
  PROPS.setProperty('ULTIMO_BACKUP', ahora_() + ' · ' + copia.getId());
  Logger.log('OK · Backup: ' + nombre);
  return copia.getId();
}

// ===================== ESTRUCTURA DE LAS PESTAÑAS (la crea y la repara prepararHojas) =====================
/**
 * Cabeceras, anchos, desplegables, fechas y colores de cada pestaña de la app.
 * prepararHojas() es idempotente: crea lo que falte y añade columnas nuevas al final sin tocar los datos.
 */
var ESQUEMA = {
  'APP · PLAN': {
    cab: ['ID', 'FECHA', 'DÍA', 'TURNO', 'ORDEN', 'ORIGEN', 'FABRIK_REF', 'BLOQUE', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CÓDIGOS',
      'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS', 'ESTADO', 'CAMBIO_ID', 'REEMPLAZA', 'ACTUALIZADO'],
    anchos: [70, 95, 80, 60, 55, 85, 95, 110, 170, 280, 95, 55, 90, 260, 340, 260, 140, 80, 90, 120],
    fechas: ['FECHA'], cursiva: 'POR QUÉ (cursiva)', negrita: 'TÍTULO', congelarCol: 3,
    listas: { TURNO: ['AM', 'PM'], ORIGEN: ['FABRIK', 'EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'],
      ESTADO: ['BORRADOR', 'PROGRAMADO', 'PROPUESTA', 'PROPUESTA · NO HACER', 'NO HACER', 'CANCELADO', 'SUSTITUIDO'] },
    colores: [['ESTADO', 'PROPUESTA', '#ffedcc'], ['ESTADO', 'SUSTITUIDO|NO HACER|CANCELADO', '#5a5a5a', '#ffffff'], ['ESTADO', 'BORRADOR', '#fff7e0'],
      ['ORIGEN', 'FABRIK', '#eef0f4'], ['ORIGEN', 'EXTRA|CARRERA|Z6|TÉCNICA|MOVILIDAD', '#fff2e6']]
  },
  'APP · EVENTOS': {
    cab: ['ID', 'EVENTO', 'TIPO', 'INICIO', 'FIN', 'HORA', 'LUGAR', 'BLOQUEA', 'ANTES (días bajar volumen)', 'DESPUÉS (días recuperación)', 'CÓMO PROCEDER', 'ESTADO', 'NOTAS', 'CREADO'],
    anchos: [70, 200, 110, 95, 95, 60, 120, 110, 110, 110, 260, 100, 220, 120], fechas: ['INICIO', 'FIN'],
    listas: { TIPO: ['Competición', 'HYROX', 'Carrera', 'Viaje', 'Trabajo', 'Personal', 'Otro'], BLOQUEA: ['Día completo', 'Mañana', 'Tarde', 'Parcial', 'No bloquea'],
      'ANTES (días bajar volumen)': ['0', '1', '2', '3'], 'DESPUÉS (días recuperación)': ['0', '1', '2', '3'], ESTADO: ['Por decidir', 'Decidido', 'Pendiente de aprobar', 'Ignorado'] },
    colores: [['ESTADO', 'Por decidir', '#ffe6d9']]
  },
  'APP · SEMANAS': {
    cab: ['LUNES', 'ESTADO', 'DOBLES (mañanas libres)', 'DESCANSO', 'EVENTOS DE LA SEMANA', 'DECISIONES', 'NOTAS', 'CONFIRMADA', 'HUELLA FABRIK', 'FABRIK LEÍDO'],
    anchos: [95, 160, 200, 140, 280, 320, 240, 130, 200, 120], fechas: ['LUNES'],
    listas: { ESTADO: ['Pendiente de confirmar', 'Confirmada', 'Programada'] },
    colores: [['ESTADO', 'Pendiente', '#ffe6d9'], ['ESTADO', 'Confirmada|Programada', '#e0f5e6']]
  },
  'APP · PENDIENTES': {
    cab: ['ID', 'CREADO', 'FECHA ORIGINAL', 'ID_PLAN', 'BLOQUE', 'TIPO', 'MOTIVO', 'ESTADO', 'SEMANA DESTINO', 'NOTAS', 'CONTENIDO', 'MIN'],
    anchos: [70, 120, 95, 90, 220, 90, 280, 110, 110, 220, 300, 55], fechas: ['FECHA ORIGINAL'],
    listas: { TIPO: ['FABRIK', 'EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'], ESTADO: ['Pendiente', 'Propuesto', 'Reprogramado', 'Descartado'] },
    colores: [['ESTADO', '^Pendiente', '#ffedcc']]
  },
  'APP · CAMBIOS': {
    cab: ['ID', 'CREADO', 'DESDE', 'TURNO DESDE', 'EVENTO', 'AFECTA', 'NOTAS', 'ESTADO', 'RESPUESTA'],
    anchos: [70, 120, 95, 80, 220, 160, 240, 130, 300], fechas: ['DESDE'],
    listas: { 'TURNO DESDE': ['AM', 'PM'], ESTADO: ['Solicitada', 'Propuesta lista', 'Aprobada', 'Rechazada'] },
    colores: [['ESTADO', 'Solicitada|Propuesta', '#ffedcc']]
  }
};

// ===================== METAS SEMANALES Y MENSUALES (v0.5) =====================
/**
 * Las metas viven en APP · METAS y se editan desde la app o el Sheet.
 * Su avance se calcula con los bloques de APP · PLAN que llevan alguno de sus CÓDIGOS:
 *   · programado = filas en estado PROGRAMADO (se marca al aprobar el plan de la semana)
 *   · realizado  = esas filas con registro «Sí» en APP · REGISTRO (o «Parcial», que cuenta media)
 *   · más los ajustes manuales de APP · AJUSTES METAS (con fecha, así que también se reinician).
 * Semana: lunes–domingo (se reinicia el domingo por la noche).
 * Mes: del día siguiente al último domingo del mes anterior hasta el último domingo de este mes
 *      (una semana que cruza dos meses cuenta entera para el mes nuevo).
 */
ESQUEMA['APP · METAS'] = {
  cab: ['ID', 'ÁMBITO', 'PRIORIDAD', 'ESTÍMULO', 'META', 'META POR MES', 'MÁXIMO', 'TIPO', 'UNIDAD', 'CÓDIGOS', 'ACTIVA', 'NOTAS', 'ORDEN'],
  anchos: [70, 80, 160, 260, 60, 130, 70, 80, 130, 120, 70, 360, 60],
  listas: { 'ÁMBITO': ['Semana', 'Mes'], TIPO: ['COUNT', 'MIN', 'MIN_GT', 'SALTOS'], ACTIVA: ['Sí', 'No'] },
  colores: [['ACTIVA', '^No$', '#5a5a5a', '#ffffff'], ['ÁMBITO', 'Semana', '#eef4ff'], ['ÁMBITO', 'Mes', '#f3eefe']]
};
ESQUEMA['APP · AJUSTES METAS'] = {
  cab: ['ID', 'FECHA', 'META_ID', 'ESTÍMULO', 'CANTIDAD', 'NOTA', 'CREADO'], anchos: [70, 95, 80, 260, 80, 300, 120], fechas: ['FECHA']
};
ESQUEMA['APP · HISTÓRICO METAS'] = {
  cab: ['PERIODO', 'ÁMBITO', 'DESDE', 'HASTA', 'COBERTURA PROGRAMADA', 'COBERTURA REALIZADA', 'METAS CUBIERTAS', 'TOTAL METAS', 'DETALLE', 'CERRADO'],
  anchos: [120, 80, 95, 95, 110, 110, 90, 80, 520, 120], fechas: ['DESDE', 'HASTA']
};
ESQUEMA['APP · CARRERA'] = {
  cab: ['ID', 'FECHA', 'ID_PLAN', 'SESIÓN', 'TIPO', 'DISTANCIA (km)', 'TIEMPO', 'RITMO MEDIO (/km)', 'FC MEDIA', 'FC MÁX', 'FC ESTABLE (min)', 'PARCIALES POR KM',
    'SERIES (tiempos)', 'PARCIALES CUMPLIDOS', 'CADENCIA', 'DESNIVEL (m)', 'TEMPERATURA (°C)', 'SUPERFICIE', 'RPE', 'SENSACIONES', 'NOTAS', 'REGISTRADO', 'PIERNAS', 'RESPIRACIÓN', 'MARGEN'],
  anchos: [70, 95, 90, 160, 110, 80, 80, 90, 70, 70, 80, 220, 220, 100, 70, 70, 80, 100, 50, 220, 220, 120, 90, 100, 130], fechas: ['FECHA'],
  listas: { TIPO: ['Z2', 'Z2 larga', 'Z4 umbral', 'Z5 VO2max', 'Z6–Z8', 'Test 2 km', 'Test 10 km', 'Recuperación', 'HYROX', 'Otra'], 'PARCIALES CUMPLIDOS': ['Sí', 'Parcial', 'No'],
    SUPERFICIE: ['Asfalto', 'Pista', 'Tierra', 'Cinta', 'Mixta'] }
};
ESQUEMA['APP · PLAN'].cab.push('CANTIDAD');
ESQUEMA['APP · PLAN'].anchos.push(70);
HOJAS.METAS = 'APP · METAS'; HOJAS.AJUSTES = 'APP · AJUSTES METAS'; HOJAS.HISTMETAS = 'APP · HISTÓRICO METAS'; HOJAS.CARRERA = 'APP · CARRERA';

/** Pasa las metas de las pestañas Semana y Mes a APP · METAS (solo si está vacía). */
function migrarMetas_() {
  if (listar_(HOJAS.METAS).length) return 0;
  var ss = miLibro_(), filas = [], orden = 0;
  var metaMes = { R02: '11:3, 12:2, 1:1, *:3', R03: '11:1, 12:2, 1:2, *:1' };
  [['Semana', 'Semana'], ['Mes', 'Mes']].forEach(function (x) {
    var sh = ss.getSheetByName(x[0]); if (!sh) return;
    var g = sh.getRange(1, 1, Math.min(sh.getLastRow(), 120), 21).getDisplayValues();
    var i0 = -1; g.forEach(function (r, i) { if (i0 < 0 && /^PRIORIDAD/i.test(String(r[0]).trim())) i0 = i; });
    if (i0 < 0) return;
    g.slice(i0 + 1).forEach(function (r) {
      if (!String(r[1]).trim() || !String(r[10]).trim()) return;
      var cod = String(r[10]).trim();
      filas.push({ ID: nuevoId_(), 'ÁMBITO': x[1], PRIORIDAD: r[0], 'ESTÍMULO': r[1], META: String(r[8] || '').replace(',', '.'), 'META POR MES': metaMes[cod] || '',
        'MÁXIMO': String(r[13] || '').replace(',', '.'), TIPO: r[9] || 'COUNT', UNIDAD: r[2], 'CÓDIGOS': cod, ACTIVA: /^(TRUE|VERDADERO|S[IÍ])$/i.test(String(r[12]).trim()) ? 'Sí' : 'No',
        NOTAS: r[5], ORDEN: ++orden });
    });
  });
  var sh2 = hojaMia_(HOJAS.METAS), cab = cabeceras_(sh2);
  if (filas.length) sh2.getRange(2, 1, filas.length, cab.length).setValues(filas.map(function (o) { return filaDe_(cab, o); }));
  return filas.length;
}

function ultimoDomingo_(y, m) {          // m: 1–12
  var d = new Date(Date.UTC(y, m, 0, 12));           // último día del mes
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());       // retrocede hasta domingo
  return d.toISOString().slice(0, 10);
}
function periodoSemana_(iso) { var l = lunesDe_(iso); return { desde: l, hasta: sumarDias(l, 6), etiqueta: 'Semana ' + isoAFecha(l) }; }
function periodoMes_(iso) {
  iso = isoOk_(iso) || hoyIso_();
  var y = +iso.slice(0, 4), m = +iso.slice(5, 7), fin = ultimoDomingo_(y, m);
  if (iso > fin) { m++; if (m > 12) { m = 1; y++; } fin = ultimoDomingo_(y, m); }
  var py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return { desde: sumarDias(ultimoDomingo_(py, pm), 1), hasta: fin, mes: m, etiqueta: MES[m - 1] + ' ' + y };
}
function metaDe_(meta, mes) {
  var t = String(meta['META POR MES'] || '').trim();
  if (t) {
    var map = {}; t.split(/[,;]+/).forEach(function (p) { var kv = p.split(':'); if (kv.length === 2) map[kv[0].trim()] = parseFloat(kv[1]); });
    if (map[String(mes)] != null) return map[String(mes)];
    if (map['*'] != null) return map['*'];
  }
  return parseFloat(String(meta.META).replace(',', '.')) || 0;
}
function codigosDe_(txt) { return String(txt || '').toUpperCase().split(/[|,;\s]+/).filter(Boolean); }

/** Avance de cada meta en un periodo. */
function avanceMetas_(ambito, per, cache) {
  var plan = cache.plan, reg = cache.reg, ajustes = cache.ajustes;
  var enPer = function (iso) { return iso && iso >= per.desde && iso <= per.hasta; };
  var hecho = {}, minReal = {};
  reg.forEach(function (r) {
    var k = celdaIso_(r.FECHA) + '|' + r.ID_PLAN;
    hecho[k] = r.HECHO === 'Sí' ? 1 : r.HECHO === 'Parcial' ? 0.5 : 0;
    var mr = parseFloat(String(r.MIN_REAL || '').replace(',', '.'));
    if (hecho[k] && mr > 0) minReal[k] = mr;                     // minutos reales apuntados: mandan sobre el «0,5»
  });
  var claveR = function (r) { return celdaIso_(r.FECHA) + '|' + r.ID; };
  var metas = cache.metas.filter(function (m) { return m['ÁMBITO'] === ambito && m.ACTIVA !== 'No'; });
  return metas.map(function (m) {
    var cods = codigosDe_(m['CÓDIGOS']), meta = Math.max(0, metaDe_(m, per.mes) * factorMeta_(m, per.desde, ambito).f + (ambito === 'Semana' && cache.incent ? (cache.incent[per.desde] || {})[m.ID] || 0 : 0)), tipo = String(m.TIPO || 'COUNT').toUpperCase();
    var filas = plan.filter(function (r) {
      var iso = celdaIso_(r.FECHA); if (!enPer(iso)) return false;
      var rc = codigosDe_(r['CÓDIGOS']); return rc.some(function (c) { return cods.indexOf(c) >= 0; });
    });
    var calc = function (lista, peso, real) {
      var mins = function (r) { var mr = real && minReal[claveR(r)]; return mr != null ? mr : (parseFloat(String(r.MIN).replace(',', '.')) || 0) * peso(r); };
      if (tipo === 'MIN') return lista.reduce(function (a, r) { return a + (peso(r) ? mins(r) : 0); }, 0);
      if (tipo === 'MIN_GT') return lista.reduce(function (a, r) { return Math.max(a, peso(r) ? (real && minReal[claveR(r)] != null ? minReal[claveR(r)] : (parseFloat(String(r.MIN).replace(',', '.')) || 0)) : 0); }, 0);
      if (tipo === 'SALTOS') return lista.reduce(function (a, r) { return a + saltosDe_(r) * peso(r); }, 0);
      var vistos = {}, n = 0;                           // COUNT: una exposición por fecha + turno
      lista.forEach(function (r) { var k = celdaIso_(r.FECHA) + '|' + r.TURNO, p = peso(r); if (p && !(vistos[k] >= p)) { n += p - (vistos[k] || 0); vistos[k] = p; } });
      return n;
    };
    // Lo que está en el plan cuenta como programado aunque falte aprobarlo (BORRADOR); «borrador» se sigue mostrando aparte
    var prog = filas.filter(function (r) { return r.ESTADO === 'PROGRAMADO' || r.ESTADO === 'BORRADOR'; });
    var borr = filas.filter(function (r) { return r.ESTADO === 'BORRADOR'; });
    var ajuste = ajustes.filter(function (a) { return a.META_ID === m.ID && enPer(celdaIso_(a.FECHA)); })
      .reduce(function (a, x) { return a + (parseFloat(String(x.CANTIDAD).replace(',', '.')) || 1); }, 0);
    var vProg = calc(prog, function () { return 1; }) + ajuste;
    var vReal = calc(prog, function (r) { return hecho[claveR(r)] || 0; }, true) + ajuste;
    var vBorr = calc(borr, function () { return 1; });
    var ratio = function (v) { return meta > 0 ? Math.min(1, v / meta) : 1; };
    return { id: m.ID, prioridad: m.PRIORIDAD, estimulo: m['ESTÍMULO'], meta: meta, maximo: m['MÁXIMO'], tipo: tipo, unidad: m.UNIDAD, codigos: m['CÓDIGOS'],
      notas: m.NOTAS, integrar: m['INTEGRAR CON'] || '', mejorar: m['CÓMO MEJORARLO'] || '',
      dias: prog.map(function (r) { return { iso: celdaIso_(r.FECHA), turno: r.TURNO === 'AM' ? 'AM' : 'PM', titulo: r['TÍTULO'] || r.BLOQUE || '', origen: norm(r.ORIGEN) === 'FABRIK' ? 'FABRIK' : r.ORIGEN, estado: r.ESTADO }; }).sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.turno < b.turno ? -1 : 1; }),
      orden: Number(m.ORDEN) || 0, programado: vProg, realizado: vReal, borrador: vBorr, ajuste: ajuste,
      pProg: ratio(vProg), pReal: ratio(vReal), cubierta: meta <= 0 || vProg >= meta, _fila: m._fila };
  }).sort(function (a, b) { return a.orden - b.orden; });
}
function cacheMetas_() {
  var inc = {}; try { var ic = JSON.parse(String(leerConfig_().incentivos || '{}')) || {}; Object.keys(ic).forEach(function (k) { var x = ic[k]; inc[x.lunes] = inc[x.lunes] || {}; Object.keys(x.deltas || {}).forEach(function (m) { inc[x.lunes][m] = (inc[x.lunes][m] || 0) + x.deltas[m]; }); }); } catch (e) {}
  return { metas: listar_(HOJAS.METAS), plan: listar_(HOJAS.PLAN), reg: listar_(HOJAS.REGISTRO), ajustes: listar_(HOJAS.AJUSTES), incent: inc };
}
function resumenPer_(lista, per, ambito) {
  var n = lista.length, cub = lista.filter(function (x) { return x.cubierta; }).length;
  var media = function (k) { return n ? lista.reduce(function (a, x) { return a + x[k]; }, 0) / n : 0; };
  return { ambito: ambito, desde: per.desde, hasta: per.hasta, etiqueta: per.etiqueta, total: n, cubiertas: cub,
    pctProg: ambito === 'Semana' ? (n ? cub / n : 0) : media('pProg'), pctReal: media('pReal'), metas: lista };
}
/** Semana y mes que contienen la fecha indicada. */
function metasDe_(iso) { return conMemo_(function () { return metasDeSin_(iso); }); }
function metasDeSin_(iso) {
  iso = isoOk_(iso) || hoyIso_();
  var c = cacheMetas_(), ps = periodoSemana_(iso), pm = periodoMes_(iso);
  return { semana: resumenPer_(avanceMetas_('Semana', ps, c), ps, 'Semana'), mes: resumenPer_(avanceMetas_('Mes', pm, c), pm, 'Mes') };
}

var CAMPOS_META = ['ÁMBITO', 'PRIORIDAD', 'ESTÍMULO', 'META', 'META POR MES', 'MÁXIMO', 'TIPO', 'UNIDAD', 'CÓDIGOS', 'ACTIVA', 'NOTAS', 'ORDEN'];
function guardarMeta_(m) {
  var o = permitidas_(m, CAMPOS_META);
  if (!o['ESTÍMULO'] || !o['ÁMBITO']) throw new Error('meta_incompleta');
  if (['Semana', 'Mes'].indexOf(o['ÁMBITO']) < 0) throw new Error('ambito_no_valido');
  return bloqueo_(function () {
    var x = m.ID ? listar_(HOJAS.METAS).filter(function (r) { return r.ID === String(m.ID); })[0] : null;
    if (x) { actualizarFila_(HOJAS.METAS, x._fila, o); return x.ID; }
    o.ID = nuevoId_(); if (!o.ACTIVA) o.ACTIVA = 'Sí'; if (!o.TIPO) o.TIPO = 'COUNT';
    if (!o.ORDEN) o.ORDEN = listar_(HOJAS.METAS).length + 1;
    var sh = hojaMia_(HOJAS.METAS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
}
function borrarMeta_(id) {
  var x = listar_(HOJAS.METAS).filter(function (r) { return r.ID === String(id); })[0];
  if (!x) throw new Error('no_encontrado');
  borrarFila_(HOJAS.METAS, x._fila, { ID: x.ID });
}
function ajusteMeta_(b) {
  var m = listar_(HOJAS.METAS).filter(function (r) { return r.ID === String(b.metaId); })[0];
  if (!m) throw new Error('no_encontrado');
  anadirFila_(HOJAS.AJUSTES, { ID: nuevoId_(), FECHA: isoAFecha(celdaIso_(b.fecha) || hoyIso_()), META_ID: m.ID, 'ESTÍMULO': m['ESTÍMULO'],
    CANTIDAD: String(b.cantidad || 1), NOTA: String(b.nota || '').slice(0, 300), CREADO: ahora_() });
}

/** Domingo por la noche: guarda la semana (y el mes si es su último domingo) en APP · HISTÓRICO METAS. */
function cierreSemanal() {
  var hoy = hoyIso_();
  if (new Date(hoy + 'T12:00:00Z').getUTCDay() === 1) hoy = sumarDias(hoy, -1);   // si el trigger se va pasada la medianoche, cierra el domingo
  var r = metasDe_(hoy), out = [];
  var fila = function (x) {
    return { PERIODO: x.ambito === 'Semana' ? 'Semana ' + isoAFecha(x.desde) : x.etiqueta, 'ÁMBITO': x.ambito, DESDE: isoAFecha(x.desde), HASTA: isoAFecha(x.hasta),
      'COBERTURA PROGRAMADA': Math.round(x.pctProg * 1000) / 10 + '%', 'COBERTURA REALIZADA': Math.round(x.pctReal * 1000) / 10 + '%', 'METAS CUBIERTAS': x.cubiertas, 'TOTAL METAS': x.total,
      DETALLE: x.metas.map(function (m) { return m.estimulo + ': ' + m.realizado + '/' + m.programado + ' de ' + m.meta; }).join(' | '), CERRADO: ahora_() };
  };
  if (r.semana.hasta === hoy) { out.push(fila(r.semana)); try { escribirBalance_(r.semana.desde, 'Cierre'); } catch (e) { Logger.log('Balance: ' + e); } }
  if (r.mes.hasta === hoy) out.push(fila(r.mes));
  var hist = listar_(HOJAS.HISTMETAS);
  out.forEach(function (o) {                                   // si ya se cerró ese periodo, se actualiza en vez de duplicarlo
    var x = hist.filter(function (h) { return h.PERIODO === o.PERIODO && h['ÁMBITO'] === o['ÁMBITO']; })[0];
    if (x) actualizarFila_(HOJAS.HISTMETAS, x._fila, o); else anadirFila_(HOJAS.HISTMETAS, o);
  });
  try { analizarCarrera_(); } catch (e) { /* el análisis no debe frenar el cierre */ }
  Logger.log('OK · Cierre: ' + out.length + ' periodo(s) guardado(s)');
  return out.length;
}

// ===================== CARRERA: registro detallado y análisis =====================
var CAMPOS_CARRERA = ['FECHA', 'ID_PLAN', 'SESIÓN', 'TIPO', 'DISTANCIA (km)', 'TIEMPO', 'RITMO MEDIO (/km)', 'FC MEDIA', 'FC MÁX', 'FC ESTABLE (min)', 'PARCIALES POR KM',
  'SERIES (tiempos)', 'PARCIALES CUMPLIDOS', 'CADENCIA', 'DESNIVEL (m)', 'TEMPERATURA (°C)', 'SUPERFICIE', 'RPE', 'SENSACIONES', 'NOTAS', 'PIERNAS', 'RESPIRACIÓN', 'MARGEN'];
function segundos_(t) {
  var p = String(t || '').trim().replace(/^'/, '').split(':').map(function (x) { return parseFloat(x.replace(',', '.')); });
  if (!p.length || p.some(isNaN)) return 0;
  // «46:10:00» = un «46:10» que el Sheet convirtió en horas (versiones anteriores): son minutos y segundos.
  if (p.length === 3 && p[2] === 0 && p[0] >= 10) return p[0] * 60 + p[1];
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60;
}
function mmss_(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
function guardarCarrera_(c) {
  var o = permitidas_(c, CAMPOS_CARRERA);
  if (!o.FECHA) throw new Error('falta_fecha');
  var km = parseFloat(String(o['DISTANCIA (km)'] || '').replace(',', '.')), seg = segundos_(o.TIEMPO);
  if (!o['RITMO MEDIO (/km)'] && km > 0 && seg > 0) o['RITMO MEDIO (/km)'] = mmss_(seg / km);
  o.REGISTRADO = ahora_();
  if (o['HUMEDAD (%)']) asegurarColumna_(HOJAS.CARRERA, 'HUMEDAD (%)');
  if (o.PIERNAS || o['RESPIRACIÓN'] || o.MARGEN) ['PIERNAS', 'RESPIRACIÓN', 'MARGEN'].forEach(function (h) { asegurarColumna_(HOJAS.CARRERA, h); });   // v0.26 · feedback de la sesión
  var idCliente = /^[\w-]{6,40}$/.test(String(c.ID || '')) ? String(c.ID) : '';   // creado en el móvil: reenvíos sin duplicar
  var id = bloqueo_(function () {
    var todas = listar_(HOJAS.CARRERA);
    var x = (idCliente && todas.filter(function (r) { return r.ID === idCliente; })[0]) ||
      todas.filter(function (r) { return r.FECHA === o.FECHA && o.ID_PLAN && r.ID_PLAN === o.ID_PLAN; })[0];
    if (x) { actualizarFila_(HOJAS.CARRERA, x._fila, o); return x.ID; }
    o.ID = idCliente || nuevoId_();
    var sh = hojaMia_(HOJAS.CARRERA), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
  try { analizarCarrera_(); } catch (e) { /* no frena el guardado */ }
  return id;
}

/** Calcula el análisis de carrera y lo pinta en APP · RESUMEN (también lo devuelve a la app). */
function analizarCarrera_() { var res = calcAnalisisCarrera_(); MEMO = null; try { pintarResumen_(res); } catch (e) { Logger.log('Resumen: ' + e); } return res; }
function calcAnalisisCarrera_() {
  var filas = listar_(HOJAS.CARRERA).map(function (r) {
    var km = parseFloat(String(r['DISTANCIA (km)']).replace(',', '.')) || 0, seg = segundos_(r.TIEMPO), fc = parseFloat(r['FC MEDIA']) || 0;
    var ritmo = segundos_(r['RITMO MEDIO (/km)']) || (km ? seg / km : 0), vel = ritmo ? 1000 / ritmo * 60 : 0;   // m/min
    return { fecha: celdaIso_(r.FECHA), lunes: lunesDe_(celdaIso_(r.FECHA)), tipo: r.TIPO || 'Otra', sesion: r['SESIÓN'], km: km, seg: seg, ritmo: ritmo, fc: fc,
      fcmax: parseFloat(r['FC MÁX']) || 0, estable: parseFloat(String(r['FC ESTABLE (min)']).replace(',', '.')) || 0, efic: fc && vel ? vel / fc : 0,
      cumple: r['PARCIALES CUMPLIDOS'], rpe: parseFloat(r.RPE) || 0, series: r['SERIES (tiempos)'], notas: r.SENSACIONES || r.NOTAS, idPlan: r.ID_PLAN };
  }).filter(function (x) { return x.fecha; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var esZ2 = function (x) { return /^Z2/i.test(x.tipo); };
  // semanas
  var sem = {};
  filas.forEach(function (x) {
    var s = sem[x.lunes] = sem[x.lunes] || { lunes: x.lunes, km: 0, min: 0, minZ2: 0, sesiones: 0, calidad: 0, z68: 0, ritZ2: [], fcZ2: [], efZ2: [] };
    s.km += x.km; s.min += x.seg / 60; s.sesiones++;
    if (esZ2(x)) { s.minZ2 += x.seg / 60; if (x.ritmo) s.ritZ2.push(x.ritmo); if (x.fc) s.fcZ2.push(x.fc); if (x.efic) s.efZ2.push(x.efic); }
    if (/Z4|Z5|Test/i.test(x.tipo)) s.calidad++;
    if (/Z6/i.test(x.tipo)) s.z68++;
  });
  var med = function (a) { return a.length ? a.reduce(function (p, c) { return p + c; }, 0) / a.length : 0; };
  var semanas = Object.keys(sem).sort().map(function (k) {
    var s = sem[k]; return { lunes: k, km: Math.round(s.km * 10) / 10, min: Math.round(s.min), minZ2: Math.round(s.minZ2), sesiones: s.sesiones, calidad: s.calidad, z68: s.z68,
      ritmoZ2: med(s.ritZ2) ? mmss_(med(s.ritZ2)) : '', fcZ2: Math.round(med(s.fcZ2)) || '', eficZ2: Math.round(med(s.efZ2) * 1000) / 1000 || '' };
  });
  // tendencias
  var z2 = filas.filter(function (x) { return esZ2(x) && x.efic; });
  var ult = z2.slice(-3), prev = z2.slice(-6, -3);
  var tendencia = ult.length && prev.length ? (med(ult.map(function (x) { return x.efic; })) / med(prev.map(function (x) { return x.efic; })) - 1) : null;
  var cal = filas.filter(function (x) { return /Z4|Z5|Test/i.test(x.tipo); }).slice(-4);
  var cumplidas = cal.filter(function (x) { return x.cumple === 'Sí'; }).length;
  var conclusiones = [];
  if (tendencia != null) conclusiones.push('Eficiencia en Z2 (metros por minuto por latido): ' + (tendencia >= 0 ? '+' : '') + Math.round(tendencia * 1000) / 10 + '% en las 3 últimas Z2 frente a las 3 anteriores' + (tendencia > 0.01 ? ' → la base mejora.' : tendencia < -0.02 ? ' → revisar fatiga, calor o ritmo demasiado alto.' : ' → estable.'));
  else conclusiones.push('Faltan Z2 con FC media para medir la eficiencia (se necesitan 6).');
  if (cal.length) conclusiones.push('Calidad: parciales cumplidos en ' + cumplidas + ' de las últimas ' + cal.length + ' sesiones' + (cumplidas === cal.length ? ' → se puede progresar una variable.' : ' → mantener la dosis.'));
  var u = semanas[semanas.length - 1];
  if (u) conclusiones.push('Última semana registrada (' + isoAFecha(u.lunes) + '): ' + u.km + ' km · Z2 ' + u.minZ2 + '′ · calidad ' + u.calidad + ' · Z6–Z8 ' + u.z68 + (u.minZ2 < 90 ? ' → por debajo de los 90′ de Z2.' : '.'));
  var estables = z2.filter(function (x) { return x.estable; }).slice(-5);
  if (estables.length) conclusiones.push('FC estable en Z2 a los ' + Math.round(med(estables.map(function (x) { return x.estable; }))) + ' min de media (últimas ' + estables.length + ').');
  var res = { semanas: semanas.slice(-12), z2: z2.slice(-8).map(function (x) { return { fecha: x.fecha, km: x.km, ritmo: mmss_(x.ritmo), fc: x.fc, efic: Math.round(x.efic * 1000) / 1000, estable: x.estable }; }),
    calidad: cal.map(function (x) { return { fecha: x.fecha, sesion: x.sesion, tipo: x.tipo, series: x.series, cumple: x.cumple, rpe: x.rpe }; }), conclusiones: conclusiones, actualizado: ahora_() };
  // v0.11 · cada carrera con tus sensaciones de ese día y lo que hiciste las 48 h anteriores
  var chq = {}; listar_(HOJAS.CHEQUEO).forEach(function (r) { chq[celdaIso_(r.FECHA)] = r; });
  res.contexto = filas.slice(-10).reverse().map(function (x) {
    var c = chq[x.fecha] || {}, antes = [];
    [1, 2].forEach(function (k) { filasActivasDia_(sumarDias(x.fecha, -k)).forEach(function (r) { var cg = cargasFila_(r).filter(function (t) { return t !== 'CORE'; }); if (cg.length) antes.push((k === 1 ? 'ayer ' : '-2d ') + String(r['TÍTULO'] || r.BLOQUE).slice(0, 28) + ' (' + cg.join(',').toLowerCase() + ')'); }); });
    return { fecha: x.fecha, sesion: x.sesion, tipo: x.tipo, km: x.km, ritmo: x.ritmo ? mmss_(x.ritmo) : '', fc: x.fc, efic: x.efic ? Math.round(x.efic * 1000) / 1000 : '',
      cansancio: c['CANSANCIO (1-10)'] || '', agujetas: c['AGUJETAS (1-10)'] || '', zonas: c['ZONAS CARGADAS'] || '', antes: antes.slice(0, 4).join(' · ') };
  });
  var cargadas = res.contexto.filter(function (x) { return x.efic && (+x.cansancio >= 7 || +x.agujetas >= 7); }), frescas = res.contexto.filter(function (x) { return x.efic && x.cansancio && +x.cansancio <= 4 && +x.agujetas <= 4; });
  if (cargadas.length && frescas.length) { var d = med(cargadas.map(function (x) { return x.efic; })) / med(frescas.map(function (x) { return x.efic; })) - 1;
    conclusiones.push('Llegando cargado (cansancio o agujetas ≥7) tu eficiencia es ' + Math.round(d * 1000) / 10 + '% frente a cuando llegas fresco (≤4).'); }
  return res;
}
// ===================== v0.6: CHEQUEO MATINAL, PLANTILLAS, BLOQUES DESDE LA APP Y AVISOS AL MÓVIL =====================
ESQUEMA['APP · CHEQUEO'] = {
  cab: ['FECHA', 'SUEÑO (h)', 'CALIDAD SUEÑO (1-5)', 'VFC (ms)', 'FC REPOSO', 'ENERGÍA (1-5)', 'MOLESTIAS (0-5)', 'ZONA MOLESTIA', 'ESTRÉS (1-5)', 'NOTAS', 'LISTO (0-100)', 'SEMÁFORO', 'RECOMENDACIÓN', 'REGISTRADO'],
  anchos: [95, 70, 90, 70, 70, 80, 90, 140, 80, 240, 80, 80, 420, 120], fechas: ['FECHA'],
  listas: { 'SEMÁFORO': ['Verde', 'Ámbar', 'Rojo'] },
  colores: [['SEMÁFORO', 'Verde', '#e0f5e6'], ['SEMÁFORO', 'Ámbar', '#fff2cc'], ['SEMÁFORO', 'Rojo', '#fbe0e0']]
};
ESQUEMA['APP · PLANTILLAS'] = {
  cab: ['ID', 'NOMBRE', 'ORIGEN', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CANTIDAD', 'CÓDIGOS', 'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS', 'CREADA'],
  anchos: [70, 180, 90, 170, 300, 95, 55, 70, 90, 260, 320, 240, 120], cursiva: 'POR QUÉ (cursiva)', negrita: 'NOMBRE',
  listas: { ORIGEN: ['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'] }
};
HOJAS.CHEQUEO = 'APP · CHEQUEO'; HOJAS.PLANTILLAS = 'APP · PLANTILLAS';

var CAMPOS_CHEQUEO = ['FECHA', 'SUEÑO (h)', 'CALIDAD SUEÑO (1-5)', 'VFC (ms)', 'FC REPOSO', 'ENERGÍA (1-5)', 'MOLESTIAS (0-5)', 'ZONA MOLESTIA', 'ESTRÉS (1-5)', 'NOTAS'];
function guardarChequeo_(c) {
  var o = permitidas_(c, CAMPOS_CHEQUEO); if (c && c['PESO (kg)']) { asegurarColumna_(HOJAS.CHEQUEO, 'PESO (kg)'); o['PESO (kg)'] = String(c['PESO (kg)']).slice(0, 8); }
  var iso = celdaIso_(o.FECHA) || hoyIso_(); o.FECHA = isoAFecha(iso);
  return bloqueo_(function () {
    var todos = listar_(HOJAS.CHEQUEO);
    var previos = todos.filter(function (r) { var d = celdaIso_(r.FECHA); return d && d < iso; }).sort(function (a, b) { return celdaIso_(a.FECHA) < celdaIso_(b.FECHA) ? 1 : -1; }).slice(0, 7);
    var p = puntuarChequeo_(o, previos, iso);
    o['LISTO (0-100)'] = p.listo == null ? '' : p.listo; o['SEMÁFORO'] = p.semaforo; o['RECOMENDACIÓN'] = p.recomendacion + (p.detalle ? ' (' + p.detalle + ')' : ''); o.REGISTRADO = ahora_();
    var x = todos.filter(function (r) { return celdaIso_(r.FECHA) === iso; })[0];
    if (x) actualizarFila_(HOJAS.CHEQUEO, x._fila, o);
    else { var sh = hojaMia_(HOJAS.CHEQUEO), cab = cabeceras_(sh); sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]); }
    return o;
  });
}

// ---------- plantillas y bloques creados desde la app (entran en BORRADOR: tú los apruebas) ----------
var CAMPOS_BLOQUE = ['ORIGEN', 'TÍTULO', 'CONTENIDO', 'INTENSIDAD', 'MIN', 'CANTIDAD', 'CÓDIGOS', 'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS'];
function crearBloque_(b) {
  var o = permitidas_(b, CAMPOS_BLOQUE.concat(['TURNO', 'ORDEN']));
  var iso = celdaIso_(b.fecha);
  if (!iso || !o['TÍTULO']) throw new Error('faltan_datos');
  if (['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'].indexOf(o.ORIGEN) < 0) o.ORIGEN = 'EXTRA';   // nunca FABRIK desde aquí
  o.ID = nuevoId_(); o.FECHA = isoAFecha(iso); o['DÍA'] = diaDe_(iso); o.TURNO = o.TURNO === 'AM' ? 'AM' : 'PM';
  o.ORDEN = o.ORDEN || (o.TURNO === 'AM' ? 5 : 80); o.BLOQUE = o['TÍTULO']; o.ESTADO = 'BORRADOR'; o.ACTUALIZADO = ahora_();
  anadirFila_(HOJAS.PLAN, o);
  return o.ID;
}
/** Borra un bloque que tú creaste y que aún está en BORRADOR (lo programado no se borra desde la app). */
function borrarBloque_(id) {
  var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(id); })[0];
  if (!x) throw new Error('no_encontrado');
  if (x.ESTADO !== 'BORRADOR' || x.ORIGEN === 'FABRIK') throw new Error('solo_borrador');
  borrarFila_(HOJAS.PLAN, x._fila, { ID: x.ID });
}
function guardarPlantilla_(p) {
  var o = permitidas_(p, ['NOMBRE'].concat(CAMPOS_BLOQUE));
  if (!o.NOMBRE || !o['TÍTULO']) throw new Error('faltan_datos');
  if (['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'].indexOf(o.ORIGEN) < 0) o.ORIGEN = 'EXTRA';
  o.ID = nuevoId_(); o.CREADA = ahora_();
  anadirFila_(HOJAS.PLANTILLAS, o);
  return o.ID;
}

// ---------- avisos al móvil (Firebase Cloud Messaging) ----------
/**
 * Se activa solo si en Propiedades del script existe FCM_CUENTA (el JSON de una cuenta de servicio de Firebase).
 * Esa clave NUNCA va al repositorio: vive solo en las propiedades de tu Apps Script.
 */
function pushActivo_() { return !!PROPS.getProperty('FCM_CUENTA'); }
function tokensPush_() { try { return JSON.parse(PROPS.getProperty('PUSH_TOKENS') || '[]'); } catch (e) { return []; } }
function guardarTokenPush_(t) {
  t = String(t || '').trim();
  if (!/^[\w\-:]{20,400}$/.test(t)) throw new Error('token_no_valido');
  var l = tokensPush_().filter(function (x) { return x !== t; }); l.unshift(t);
  PROPS.setProperty('PUSH_TOKENS', JSON.stringify(l.slice(0, 5)));          // como mucho 5 dispositivos
}
function tokenFcm_() {
  var cache = CacheService.getScriptCache(), t = cache.get('fcm_oauth');
  if (t) return t;
  var sa = JSON.parse(PROPS.getProperty('FCM_CUENTA'));
  var b64 = function (o) { return Utilities.base64EncodeWebSafe(typeof o === 'string' ? o : JSON.stringify(o)).replace(/=+$/, ''); };
  var ahora = Math.floor(Date.now() / 1000);
  var cuerpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 });
  var firma = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(cuerpo, sa.private_key)).replace(/=+$/, '');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cuerpo + '.' + firma }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('fcm_auth ' + res.getResponseCode());
  t = JSON.parse(res.getContentText()).access_token;
  cache.put('fcm_oauth', t, 3000);
  return t;
}
/** Manda un aviso a tus dispositivos. Devuelve cuántos lo recibieron. */
function enviarPush_(titulo, texto, enlace) {
  if (!pushActivo_()) return 0;
  var sa = JSON.parse(PROPS.getProperty('FCM_CUENTA')), tok = tokenFcm_(), ok = 0, vivos = [];
  tokensPush_().forEach(function (t) {
    var r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true,
      payload: JSON.stringify({ message: { token: t, data: { titulo: String(titulo).slice(0, 80), texto: String(texto).slice(0, 200), enlace: enlace || CONFIG.URL_APP },
        webpush: { headers: { Urgency: 'high', TTL: '43200' } } } }) });
    var c = r.getResponseCode();
    if (c === 200) { ok++; vivos.push(t); } else if (c !== 404 && c !== 400) vivos.push(t);   // 404/400 = token caducado: se olvida
  });
  PROPS.setProperty('PUSH_TOKENS', JSON.stringify(vivos));
  return ok;
}
/** Cada hora: avisa (una sola vez por cosa) de lo que necesita tu decisión. */
function revisarAvisos() { return conSalud_('revisarAvisos', revisarAvisos_sin_); }
function revisarAvisos_sin_() {
  var bkAlerta = ''; try { revisarBackup_(); bkAlerta = leerConfig_().backup_alerta || ''; } catch (e) { Logger.log('Backup: ' + e); }
  try { revisarSalud_(); } catch (e) { Logger.log('Salud: ' + e); }
  try { v29aCadaHora_(); } catch (e) { Logger.log('v29a hora: ' + e); }
  if (!pushActivo_()) return;
  var hecho = {}; try { hecho = JSON.parse(PROPS.getProperty('AVISOS_HECHOS') || '{}'); } catch (e) {}
  var avisar = function (clave, titulo, texto) { if (hecho[clave]) return; if (enviarPush_(titulo, texto)) hecho[clave] = hoyIso_(); };
  var hoy = hoyIso_(), hora = +Utilities.formatDate(new Date(), CONFIG.ZONA, 'H'), lunesSig = sumarDias(lunesDe_(hoy), 7);
  conMemo_(function () {
    var plan = listar_(HOJAS.PLAN);
    [lunesDe_(hoy), lunesSig].forEach(function (l) {
      var n = plan.filter(function (r) { var d = celdaIso_(r.FECHA); return r.ESTADO === 'BORRADOR' && d >= l && d <= sumarDias(l, 6); }).length;
      if (n) avisar('borrador_' + l + '_' + n, 'Plan listo para aprobar', n + ' bloques en borrador para la semana del ' + isoAFecha(l) + '.');
    });
    cambiosAbiertos_().filter(function (c) { return c.ESTADO === 'Propuesta lista'; }).forEach(function (c) {
      avisar('cambio_' + c.ID, 'Propuesta de cambios lista', c.EVENTO + ': revísala y apruébala o recházala.');
    });
    var s = filaSemana_(lunesSig);
    if (new Date(hoy + 'T12:00:00Z').getUTCDay() === 0 && hora >= 20 && !(s && /Confirmada|Programada/.test(s.ESTADO)))
      avisar('confirmar_' + lunesSig, 'Confirma la semana', 'Mañanas para dobles, descanso y eventos de la semana del ' + isoAFecha(lunesSig) + '.');
    [lunesDe_(hoy), lunesSig].forEach(function (l) {
      var cf = cambiosFabrik_(filaSemana_(l), fabrikSemana_(l).fabrik).filter(function (c) { return sumarDias(l, DIAS.indexOf(norm(c.dia))) >= hoy; });
      if (cf.length) avisar('fabrik_' + l + '_' + cf.map(function (c) { return c.dia; }).join('-'), 'Fabrik ha cambiado',
        'Cambios en ' + cf.map(function (c) { return c.dia.toLowerCase(); }).join(', ') + ' desde que aprobaste la semana. Revisa interferencias con tus extras.');
    });
    if (bkAlerta) avisar('backup_' + hoy, 'Backup sin hacer', bkAlerta);
    // v0.26 · sin chequeo diario; lo que sí importa: el feedback de cada carrera (ajusta las de la semana siguiente)
    if (hora >= 20) { var corrHoy = filasActivasDia_(hoy).filter(function (r) { return esCarreraFila_(r) && /^(PROGRAMADO)$/.test(r.ESTADO); });
      var conFb = {}; listar_(HOJAS.CARRERA).forEach(function (r) { if (celdaIso_(r.FECHA) === hoy) conFb[r.ID_PLAN || '_'] = 1; });
      if (corrHoy.some(function (r) { return !conFb[r.ID]; })) avisar('fbcarrera_' + hoy, 'Tu feedback de la carrera', '20 segundos: RPE, piernas, respiración y si podías más. Con eso ajusto las de la semana que viene.'); }
  });
  Object.keys(hecho).forEach(function (k) { if (hecho[k] < sumarDias(hoy, -21)) delete hecho[k]; });
  PROPS.setProperty('AVISOS_HECHOS', JSON.stringify(hecho));
}

// ===================== v0.10 · MOVER E INTERCAMBIAR BLOQUES · PESTAÑA «APP · SEMANA EN BLOQUES» =====================
HOJAS.SEMBLOQUES = 'APP · SEMANA EN BLOQUES';
var DIAS_CORTO_ = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
var HUECOS_ = (function () { var l = []; DIAS_CORTO_.forEach(function (d) { l.push(d + ' AM'); l.push(d + ' PM'); }); return l; })();
var CAMPOS_POSICION_ = ['FECHA', 'TURNO', 'ORDEN'];
/** Solo cambia la posición (día, turno u orden)? Entonces lo aprobado sigue aprobado: mover es decisión tuya. */
function soloPosicion_(o) { return Object.keys(o).every(function (k) { return CAMPOS_POSICION_.indexOf(k) >= 0 || k === 'DÍA'; }); }

/** Intercambia día, turno y orden de dos bloques de la misma semana (p. ej. la Z2 larga del miércoles con la corta del martes). */
function intercambiarBloques_(idA, idB) {
  return bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN);
    var a = plan.filter(function (r) { return r.ID === String(idA || ''); })[0], b = plan.filter(function (r) { return r.ID === String(idB || ''); })[0];
    if (!a || !b || a.ID === b.ID) throw new Error('no_encontrado');
    if (lunesDe_(celdaIso_(a.FECHA)) !== lunesDe_(celdaIso_(b.FECHA))) throw new Error('otra_semana');
    var pos = function (r) { var iso = celdaIso_(r.FECHA); return { FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: r.TURNO === 'AM' ? 'AM' : 'PM', ORDEN: r.ORDEN }; };
    var pa = pos(a), pb = pos(b), sello = function (r) { return norm(r.ORIGEN) === 'FABRIK' ? {} : { GENERADO: 'manual ' + ahora_() + ' (candado · intercambio)' }; };
    actualizarFila_(HOJAS.PLAN, a._fila, Object.assign({}, pb, sello(a), { ACTUALIZADO: ahora_() }));
    actualizarFila_(HOJAS.PLAN, b._fila, Object.assign({}, pa, sello(b), { ACTUALIZADO: ahora_() }));
    return lunesDe_(celdaIso_(a.FECHA));
  });
}
/**
 * v0.22 · Intercambia sesiones enteras: «iso|AM», «iso|PM» o «iso|DIA» (día entero). AM↔PM también vale (mismo día u otro).
 * Todos los bloques de A pasan al día/turno de B y los de B al de A (orden dentro de la sesión se conserva).
 * Lo tuyo queda con candado (Rehacer extras no lo mueve); Fabrik conserva su referencia y la recarga respeta dónde lo pusiste.
 */
function intercambiarSesion_(a, b) {
  var pa = String(a || '').split('|'), pb = String(b || '').split('|');
  var ia = isoOk_(pa[0]), ib = isoOk_(pb[0]), ta = String(pa[1] || '').toUpperCase(), tb = String(pb[1] || '').toUpperCase();
  if (!ia || !ib || !/^(AM|PM|DIA)$/.test(ta) || !/^(AM|PM|DIA)$/.test(tb)) throw new Error('sesion_no_valida');
  if ((ta === 'DIA') !== (tb === 'DIA')) throw new Error('dia_con_turno');
  if (ia === ib && ta === tb) throw new Error('misma_sesion');
  if (lunesDe_(ia) !== lunesDe_(ib)) throw new Error('otra_semana');
  var lunes = lunesDe_(ia);
  try { if (!listar_(HOJAS.PLAN).some(function (r) { var d = celdaIso_(r.FECHA); return norm(r.ORIGEN) === 'FABRIK' && d >= lunes && d <= sumarDias(lunes, 6); })) { cargarFabrikSemana_(lunes); MEMO = null; } } catch (e) {}
  return bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN).filter(function (r) { return !/^(SUSTITUIDO|OCULTO)$/.test(r.ESTADO); });
    var tu = function (r) { return r.TURNO === 'AM' ? 'AM' : 'PM'; };
    var de = function (iso, t) { return plan.filter(function (r) { return celdaIso_(r.FECHA) === iso && (t === 'DIA' || tu(r) === t); }); };
    var A = de(ia, ta), B = de(ib, tb), n = 0;
    var mover = function (r, iso, t) {
      var o = { FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), ACTUALIZADO: ahora_() };
      if (t !== 'DIA') { o.TURNO = t; var ord = parseFloat(String(r.ORDEN).replace(',', '.')) || 50; if (tu(r) !== t) o.ORDEN = String(t === 'AM' ? (ord >= 50 ? ord - 40 : ord) : (ord < 50 ? ord + 40 : ord)); }
      if (norm(r.ORIGEN) !== 'FABRIK' && !/^manual/.test(r.GENERADO || '')) o.GENERADO = 'manual ' + ahora_() + ' (candado · intercambio de sesión)';
      actualizarFila_(HOJAS.PLAN, r._fila, o); n++;
    };
    A.forEach(function (r) { mover(r, ib, tb); });
    B.forEach(function (r) { mover(r, ia, ta); });
    return n;
  });
}
/** Mueve un bloque a «Mié PM» (desde la pestaña). Va al final de esa sesión. */
function moverBloqueA_(id, hueco, lunes) {
  var k = HUECOS_.indexOf(String(hueco || '').trim()); if (k < 0) throw new Error('hueco_no_valido');
  var iso = sumarDias(lunes, Math.floor(k / 2)), turno = k % 2 ? 'PM' : 'AM';
  var otros = listar_(HOJAS.PLAN).filter(function (r) { return celdaIso_(r.FECHA) === iso && r.TURNO === turno && r.ID !== id; });
  var orden = otros.reduce(function (m, r) { return Math.max(m, parseFloat(String(r.ORDEN).replace(',', '.')) || 0); }, turno === 'AM' ? 9 : 49) + 1;
  editarBloque_({ id: id, campos: { FECHA: isoAFecha(iso), TURNO: turno, ORDEN: String(orden) } });
}

/** Pinta la semana día a día (AM / PM) con todos los bloques: Fabrik + extras + carrera. */
function pintarHojaSemana_(lunes) {
  lunes = lunesDe_(lunes);
  var ss = miLibro_(), sh = ss.getSheetByName(HOJAS.SEMBLOQUES) || ss.insertSheet(HOJAS.SEMBLOQUES);
  var fin = sumarDias(lunes, 6);
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && !/^(SUSTITUIDO|OCULTO|PROPUESTA)$/.test(r.ESTADO); });
  var etq = function (r) { var d = celdaIso_(r.FECHA), k = (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7; return DIAS_CORTO_[k] + ' ' + (r.TURNO === 'AM' ? 'AM' : 'PM') + ' · ' + String(r['TÍTULO'] || r.BLOQUE || '').slice(0, 40) + ' · #' + r.ID; };
  var opcionesSwap = plan.map(etq), clave = {};
  var todosSem = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin; });
  var propFus = [], oriFus = [];   // v0.26 · filas de fusiones en propuesta y de sus originales
  try { clave = claveSemana_(lunes, plan); } catch (e) {}
  var filas = [], estilos = [], claves = [], sesiones = [], tuyos = [], cancel = [];   // estilos: [fila, tipo]
  filas.push(['SEMANA EN BLOQUES · Fabrik + extras + carrera', '', '', '', '', '', '', '', '', '', '', '']);
  filas.push(['Lunes de la semana →', isoAFecha(lunes), '↻ Actualizar', false, '✓ PROGRAMAR TODA LA SEMANA →', false, '', '', '', '', '', '']);
  filas.push(['Cambia la fecha o marca la casilla para recargar. Edita BLOQUE, EJERCICIOS o MIN y se guarda en el plan (lo que ves en la app). Para mover un bloque elige «MOVER A»; para cambiar dos entre sí, «INTERCAMBIAR CON». En la fila de cada sesión (☀️ AM / 🌙 PM), «INTERCAMBIAR CON» cambia la sesión entera o el día entero por los de otro día. En ESTADO: CANCELADO = no se hace (no va a pendientes; vuelve con PROGRAMADO), A PENDIENTES = para la semana siguiente. En naranja, lo que no es Fabrik. 🎯 = clave para tus carencias. ✓ PROGRAMAR: en la fila de cada sesión, columna ESTADO → sesión o día entero; arriba, toda la semana. ⇄ CÓDIGOS (extras): cambia el estímulo por otro del catálogo (primero la misma familia). 🔗 FUSIONAR: en la última columna del bloque elige el otro (solo en uno de los dos); aparece la PROPUESTA en amarillo y en su ESTADO eliges ✓ APROBAR o ✗ RECHAZAR (al rechazar, los dos vuelven a su sitio y estado). Ya aprobada: ESTADO → ↶ DESHACER FUSIÓN.', '', '', '', '', '', '', '', '', '', '', '']);
  filas.push(['DÍA · TURNO', 'Nº', 'BLOQUE', 'EJERCICIOS (editable)', 'TIPO', 'MIN', 'CÓDIGOS', 'ESTADO', 'MOVER A', 'INTERCAMBIAR CON', 'POR QUÉ', 'ID']);
  estilos.push([4, 'cab']);
  var OPh = null; try { OPh = opSemana_(lunes); if (!OPh.enModo) OPh = null; } catch (eO) {}   // v0.27 · modo operación
  var opFila = function (r, iso) { if (!OPh || norm(r.ORIGEN) !== 'FABRIK') return ''; var f = OPh.dias[iso], n = opPost_(f.clave);
    if (f.clave === 'D0' || n === 1 || n === 2) return '⛔ OPERACIÓN · no aplica (' + f.nombre + '). ';
    var t = OP_NOTA_FAB_[f.clave] ? '🩺 ' + OP_NOTA_FAB_[f.clave] + ' ' : '';
    if (n >= 3) opFiltrarTexto_(r.CONTENIDO, OPh.cfg.aut).sust.slice(0, 4).forEach(function (x) { t += '⛔ ' + x.de.slice(0, 40) + ' → ' + x.a + '. '; });
    return t; };
  for (var k = 0; k < 7; k++) {
    var iso = sumarDias(lunes, k);
    ['AM', 'PM'].forEach(function (tu) {
      var bl = plan.filter(function (r) { return celdaIso_(r.FECHA) === iso && (r.TURNO === 'AM' ? 'AM' : 'PM') === tu; })
        .sort(function (a, b) { return (parseFloat(String(a.ORDEN).replace(',', '.')) || 0) - (parseFloat(String(b.ORDEN).replace(',', '.')) || 0); });
      filas.push([diaDe_(iso).toUpperCase() + ' ' + isoAFecha(iso).slice(0, 5) + ' · ' + (tu === 'AM' ? '☀️ AM' : '🌙 PM'), '', (OPh && tu === 'AM' && OPh.dias[iso].clave !== 'NORMAL' ? OPh.dias[iso].nombre + (OPh.dias[iso].dn != null ? ' · D' + (OPh.dias[iso].dn >= 0 ? '+' : '') + OPh.dias[iso].dn : '') : bl.length ? '' : '—'), '', '', '', '', '', '⇄ sesión →', '', '', 'SES|' + iso + '|' + tu]);
      estilos.push([filas.length, tu === 'AM' ? 'am' : 'pm']); sesiones.push(filas.length);
      bl.forEach(function (r) {
        var fab = norm(r.ORIGEN) === 'FABRIK';
        filas.push(['', (fab ? String(r.FABRIK_REF || '').split('·')[1] || '' : '+') + (clave[r.ID] ? ' 🎯' : ''), r['TÍTULO'] || r.BLOQUE || '', String(r.CONTENIDO || '').slice(0, 4000), (r.ORIGEN || '') + (clave[r.ID] ? ' · 🎯 CLAVE: ' + clave[r.ID] : '') + (/editado/.test(r.GENERADO || '') ? ' · ✎ editado' : ''),
          r.MIN || '', r['CÓDIGOS'] || '', r.ESTADO || '', '', '', (opFila(r, iso) + String(r['POR QUÉ (cursiva)'] || '')).slice(0, 400), r.ID]);
        if (clave[r.ID]) claves.push(filas.length);
        if (!fab) tuyos.push(filas.length);
        if (r.ESTADO === 'CANCELADO') cancel.push(filas.length);
        if (esFusionPropuesta_(r)) {
          filas[filas.length - 1][7] = '❓ PROPUESTA · aprobar o rechazar'; propFus.push(filas.length);
          estilos.push([filas.length, 'extra']);
          todosSem.filter(function (o) { return String(o.CAMBIO_ID || '').indexOf('FUSION:' + r.ID + ':') === 0; }).forEach(function (o) {
            filas.push(['', '↳', 'original: ' + etq(o).replace(/ · #\S+$/, ''), String(o.CONTENIDO || '').slice(0, 600), 'vuelve a su sitio (' + String(o.CAMBIO_ID).split(':')[2] + ') si rechazas', o.MIN || '', o['CÓDIGOS'] || '', '', '', '', '', 'ORI|' + o.ID]);
            oriFus.push(filas.length); });
          return;
        }
        estilos.push([filas.length, /CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R02|R03)\b/.test(r['CÓDIGOS'] || '') ? 'carrera' : /W03/.test(r['CÓDIGOS'] || '') ? 'ergo' : fab ? 'fabrik' : 'extra']);
      });
    });
  }
  sh.clear(); sh.setConditionalFormatRules([]);
  if (sh.getMaxColumns() < 13) sh.insertColumnsAfter(sh.getMaxColumns(), 13 - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), 13).clearDataValidations();
  if (sh.getMaxRows() < filas.length + 5) sh.insertRowsAfter(sh.getMaxRows(), filas.length + 5 - sh.getMaxRows());
  sh.getRange(1, 1, filas.length, 12).setValues(filas.map(function (r) { return r.map(celdaSegura_); }));
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(2, 2).setNumberFormat('dd/mm/yyyy').setBackground('#fff7e0');
  sh.getRange(2, 4).insertCheckboxes(); sh.getRange(2, 6).insertCheckboxes(); sh.getRange(2, 5).setFontWeight('bold').setHorizontalAlignment('right'); sh.getRange(3, 1).setFontColor('#666666').setWrap(false);
  sh.getRange(2, 5).setFontStyle('italic').setFontColor('#666666');
  sh.setFrozenRows(4);
  [130, 44, 240, 380, 150, 50, 120, 100, 110, 260, 300, 80].forEach(function (w, j) { sh.setColumnWidth(j + 1, w); });
  // Formato en bloque (una llamada por propiedad): mucho más rápido que fila a fila
  var colores = { cab: ['#121212', '#ffffff'], am: ['#fff2cc', '#000000'], pm: ['#e8eaf6', '#000000'], carrera: ['#dbeafe', '#000000'], ergo: ['#e0f2fe', '#000000'], fabrik: ['#f4f5f7', '#000000'], extra: ['#fff7ed', '#000000'] };
  var tipoFila = {}; estilos.forEach(function (e) { tipoFila[e[0]] = e[1]; });
  var bg = [], fc = [], fw = [];
  for (var f = 1; f <= filas.length; f++) {
    var t = tipoFila[f], c = t ? colores[t] : ['#ffffff', '#000000'], negrita = t === 'cab' || t === 'am' || t === 'pm';
    bg.push(new Array(12).fill(c[0])); fc.push(new Array(12).fill(c[1])); fw.push(new Array(12).fill(negrita ? 'bold' : 'normal'));
  }
  tuyos.forEach(function (f) { fc[f - 1][2] = '#e8590c'; fw[f - 1][2] = 'bold'; fc[f - 1][1] = '#e8590c'; });   // v0.22 · todo lo que no es Fabrik: título en naranja
  claves.forEach(function (f) { fc[f - 1][2] = '#b8860b'; fw[f - 1][2] = 'bold'; });   // 🎯 título en dorado
  cancel.forEach(function (f) { bg[f - 1] = new Array(12).fill('#e5e5e5'); fc[f - 1] = new Array(12).fill('#8a8a8a'); });
  sh.getRange(1, 1, filas.length, 12).setBackgrounds(bg).setFontColors(fc).setFontWeights(fw);
  cancel.forEach(function (f) { sh.getRange(f, 3).setFontLine('line-through'); });
  // v0.26 · columna propia para fusionar (propuesta que apruebas o rechazas)
  sh.getRange(4, 13).setValue('🔗 FUSIONAR CON (propuesta)').setBackground('#e8590c').setFontColor('#ffffff').setFontWeight('bold'); sh.setColumnWidth(13, 260);
  propFus.forEach(function (f) { sh.getRange(f, 1, 1, 13).setBackground('#fef3c7'); sh.getRange(f, 8).setFontWeight('bold').setFontColor('#b45309'); });
  oriFus.forEach(function (f) { sh.getRange(f, 1, 1, 13).setBackground('#f5f5f4').setFontColor('#8a8a8a').setFontStyle('italic'); });
  var filasBloque = estilos.filter(function (e) { return /carrera|ergo|fabrik|extra/.test(e[1]); }).map(function (e) { return e[0]; });
  if (filasBloque.length) {
    var vMover = SpreadsheetApp.newDataValidation().requireValueInList(HUECOS_, true).setAllowInvalid(false).build();
    var vSwap = opcionesSwap.length ? SpreadsheetApp.newDataValidation().requireValueInList(opcionesSwap.slice(0, 450), true).setAllowInvalid(false).build() : null;
    var vEst = SpreadsheetApp.newDataValidation().requireValueInList(['PROGRAMADO', 'BORRADOR', 'CANCELADO', 'A PENDIENTES'], true).setAllowInvalid(true).build();
    var vSwap2 = vSwap;
    var fusionables = plan.filter(function (r) { return /^(BORRADOR|PROGRAMADO)$/.test(r.ESTADO) && !esFusionPropuesta_(r); }).map(etq);
    var vFus = fusionables.length > 1 ? SpreadsheetApp.newDataValidation().requireValueInList(fusionables.slice(0, 450), true).setAllowInvalid(false).setHelpText('Elige el otro bloque: te hago una propuesta de fusión para aprobar o rechazar.').build() : null;
    var vProp = SpreadsheetApp.newDataValidation().requireValueInList(['✓ APROBAR FUSIÓN', '✗ RECHAZAR FUSIÓN'], true).setAllowInvalid(true).build();
    var vEstF = SpreadsheetApp.newDataValidation().requireValueInList(['PROGRAMADO', 'BORRADOR', 'CANCELADO', 'A PENDIENTES', '↶ DESHACER FUSIÓN'], true).setAllowInvalid(true).build();
    var listaE = null; try { listaE = estimulosLista_(lunes); } catch (e) {}
    var porId = {}; plan.forEach(function (r) { porId[r.ID] = r; });
    filasBloque.forEach(function (f) {
      var r = porId[filas[f - 1][11]] || {};
      sh.getRange(f, 9).setDataValidation(vMover); if (vSwap2) sh.getRange(f, 10).setDataValidation(vSwap2);
      sh.getRange(f, 8).setDataValidation(esFusionPropuesta_(r) ? vProp : norm(r.ORIGEN) === 'FUSION' ? vEstF : vEst);
      if (vFus && /^(BORRADOR|PROGRAMADO)$/.test(r.ESTADO) && !esFusionPropuesta_(r)) sh.getRange(f, 13).setDataValidation(vFus).setBackground('#fff7ed');
      if (listaE && r.ID && norm(r.ORIGEN) !== 'FABRIK' && norm(r.ORIGEN) !== 'FUSION' && !/CARRERA/.test(norm(r.ORIGEN)) && /^(BORRADOR|PROGRAMADO)$/.test(r.ESTADO)) {   // v0.24 · cambiar el estímulo (misma familia primero)
        var ops = candidatosCambio_(r, listaE).filter(function (x) { return codigosDe_(r['CÓDIGOS']).indexOf(x.c) < 0; }).slice(0, 60).map(function (x) { return '⇄ ' + x.c + ' · ' + String(x.nombre).slice(0, 40) + (x.mismaFamilia ? ' ★' : '') + (x.falta > 0 ? ' · faltan ' + x.falta : ''); });
        if (ops.length) sh.getRange(f, 7).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ops, true).setAllowInvalid(true).build());
      }
    });
  }
  var vProg = SpreadsheetApp.newDataValidation().requireValueInList(['✓ PROGRAMAR SESIÓN', '✓ PROGRAMAR DÍA'], true).setAllowInvalid(true).build();
  sesiones.forEach(function (f) { sh.getRange(f, 8).setDataValidation(vProg).setBackground('#ffffff'); });
  // v0.22 · cambiar sesiones enteras: en la fila de cada sesión, «INTERCAMBIAR CON» → otra sesión o el día entero
  var opSes = []; DIAS_CORTO_.forEach(function (dc) { opSes.push('⇄ ' + dc + ' AM'); opSes.push('⇄ ' + dc + ' PM'); opSes.push('⇄ ' + dc + ' · día entero'); });
  var vSes = SpreadsheetApp.newDataValidation().requireValueInList(opSes, true).setAllowInvalid(false).build();
  sesiones.forEach(function (f) { sh.getRange(f, 10).setDataValidation(vSes).setBackground('#ffffff'); sh.getRange(f, 12).setFontColor('#bbbbbb'); });
  sh.getRange(5, 1, Math.max(1, filas.length - 4), 12).setVerticalAlignment('top').setWrap(true);
  sh.getRange(5, 11, Math.max(1, filas.length - 4), 1).setFontStyle('italic');
  sh.getRange(5, 4, Math.max(1, filas.length - 4), 1).setFontFamily('Roboto Mono').setFontSize(9);
  sh.setTabColor('#2f81f7');
  ponerConfig_('semana_bloques', "'" + lunes, 'Semana que muestra APP · SEMANA EN BLOQUES');
  return filas.length;
}
/** Repinta la pestaña si está mostrando esa semana (después de mover, aprobar o generar). */
function refrescarHojaSemana_(lunes) {
  try {
    var cur = isoOk_(String(leerConfig_().semana_bloques || '').trim());
    if (!cur) return;
    if (!lunes || cur === lunesDe_(lunes)) pintarHojaSemana_(cur);
  } catch (e) { Logger.log('Hoja semana: ' + e); }
}
/** Al abrir el Sheet (disparador instalable): la pestaña siempre al día, también con lo que hayas movido desde la app. */
function alAbrirHoja() {
  var cur = isoOk_(String(leerConfig_().semana_bloques || '').trim()), hoyL = lunesDe_(hoyIso_());
  pintarHojaSemana_(!cur || cur < hoyL ? hoyL : cur);
  refrescarResumen_();
}
/** Disparador instalable al editar el Sheet: cambios en la pestaña de la semana. */
function alEditarHoja(e) {
  try { invalidarSemana_(); } catch (x) {}
  try {
    var sh = e.range.getSheet(); if (sh.getName() === COMP_VISTA_) { editarCompetisSheet_(e); return; }
    if (sh.getName() === HOJAS.ESTBLOQUES) { editarEstimulosSheet_(e); return; }
    if (sh.getName() !== HOJAS.SEMBLOQUES) return;
    var f = e.range.getRow(), c = e.range.getColumn(), v = e.range.getValue();
    var lunes = celdaIso_(sh.getRange(2, 2).getValue()) || hoyIso_();
    if (f === 2 && (c === 2 || c === 4)) { pintarHojaSemana_(lunes); return; }
    if (f === 2 && c === 6 && v === true) { var np = programarRango_(lunesDe_(lunes)); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast(np + ' bloques pasan a PROGRAMADO (toda la semana)', 'Road To Elite', 4); return; }
    if (f < 5) return;
    var id = String(sh.getRange(f, 12).getValue() || '').trim(); if (!id) return;
    if (/^SES\|/.test(id)) {   // v0.22 · sesión o día entero
      if (c === 8 && /PROGRAMAR/.test(String(v))) { var pz = id.split('|'), nz = programarRango_(lunesDe_(lunes), pz[1], /DÍA/.test(String(v)) ? '' : pz[2]); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast(nz + ' bloques pasan a PROGRAMADO', 'Road To Elite', 4); return; }
      if (c !== 10 || !v) return;
      var ps = id.split('|'), m2 = String(v).match(/⇄\s*(\S+)\s*(AM|PM|· día entero)/); if (!m2) return;
      var kd = DIAS_CORTO_.indexOf(m2[1]); if (kd < 0) return;
      var dia = /día entero/.test(m2[2]), isoB = sumarDias(lunesDe_(lunes), kd);
      SpreadsheetApp.getActive().toast('Intercambiando…', 'Road To Elite', 3);
      var nm = intercambiarSesion_(ps[1] + '|' + (dia ? 'DIA' : ps[2]), isoB + '|' + (dia ? 'DIA' : m2[2]));
      MEMO = null; pintarHojaSemana_(lunes);
      SpreadsheetApp.getActive().toast(nm + ' bloques movidos (' + (dia ? 'día entero' : 'sesión') + ')', 'Road To Elite', 4); return;
    }
    if (c === 7 && /^⇄\s*([A-Z][0-9]{2,3})/.test(String(v))) {   // v0.24 · cambiar estímulo
      var cn = String(v).match(/^⇄\s*([A-Z][0-9]{2,3})/)[1]; cambiarEstimulo_(id, cn); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Estímulo cambiado a ' + cn + ' (cuenta en semana y mes)', 'Road To Elite', 4); return;
    }
    if (/^ORI\|/.test(id)) { pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Ese bloque está dentro de una fusión propuesta: apruébala o recházala en la fila amarilla.', 'Road To Elite', 5); return; }
    if (c === 13 && v) {   // v0.26 · fusionar: propuesta que se aprueba o se rechaza
      var otroF = (String(v).match(/#(\S+)\s*$/) || [])[1]; if (!otroF || otroF === id) { pintarHojaSemana_(lunes); return; }
      SpreadsheetApp.getActive().toast('Preparando la propuesta de fusión…', 'Road To Elite', 3);
      try { var fp = fusionarBloques_([id, otroF], { propuesta: true }); MEMO = null; pintarHojaSemana_(lunes);
        SpreadsheetApp.getActive().toast('Propuesta: «' + fp.bloque['TÍTULO'] + '» (' + fp.bloque.MIN + '′, antes ' + fp.minAntes + '′). ' + (fp.avisos[0] || '') + ' En su ESTADO: ✓ APROBAR o ✗ RECHAZAR.', 'Road To Elite', 10); }
      catch (e3) { MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('No se puede fusionar: ' + e3.message, 'Road To Elite', 6); }
      return;
    }
    if (c === 8 && /APROBAR FUSI/.test(String(v))) { var ef = aprobarFusion_(id); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusión aprobada (' + ef + '). Los bloques sueltos quedan sustituidos.', 'Road To Elite', 5); return; }
    if (c === 8 && /RECHAZAR FUSI/.test(String(v))) { desfusionar_(id); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusión rechazada: los dos bloques vuelven a su sitio y a su estado.', 'Road To Elite', 5); return; }
    if (c === 10 && /^🔗/.test(String(v))) {   // v0.24 · fusionar desde el Sheet
      var otro = (String(v).match(/#(\S+)\s*$/) || [])[1]; if (!otro) return;
      SpreadsheetApp.getActive().toast('Fusionando…', 'Road To Elite', 3);
      try { var fz = fusionarBloques_([id, otro]); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusionado en «' + fz.bloque['TÍTULO'] + '» (' + fz.bloque.MIN + '′). ' + (fz.avisos[0] || '') + ' Para deshacer: ESTADO → ↶ DESHACER FUSIÓN.', 'Road To Elite', 8); }
      catch (e2) { MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('No se puede fusionar: ' + e2.message, 'Road To Elite', 6); }
      return;
    }
    if (c === 8 && /DESHACER FUSI/.test(String(v))) { desfusionar_(id); MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Fusión deshecha', 'Road To Elite', 4); return; }
    if (c === 8) {   // v0.22 · estado desde el Sheet
      var ev = String(v || '').trim(), xr = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === id; })[0]; if (!xr) return;
      if (ev === 'CANCELADO') noHacer_({ id: id, fecha: celdaIso_(xr.FECHA), cancelar: true, motivo: 'Cancelado desde el Sheet' });
      else if (ev === 'PROGRAMADO' && xr.ESTADO === 'CANCELADO') reactivarBloque_(id);
      else if (ev === 'A PENDIENTES') quitarBloque_({ id: id, pendiente: true, motivo: 'Desde APP · SEMANA EN BLOQUES' });
      else if (ev === 'PROGRAMADO' && xr.ESTADO === 'BORRADOR') actualizarFila_(HOJAS.PLAN, xr._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() });
      MEMO = null; pintarHojaSemana_(lunes); SpreadsheetApp.getActive().toast('Estado: ' + ev, 'Road To Elite', 3); return;
    }
    if (c === 3 || c === 4 || c === 6) {   // v0.11: editar título, ejercicios o minutos desde el Sheet
      var campo = c === 3 ? 'TÍTULO' : c === 4 ? 'CONTENIDO' : 'MIN', cs = {}; cs[campo] = String(v == null ? '' : v);
      if (c === 3 && !cs[campo].trim()) { pintarHojaSemana_(lunes); return; }
      SpreadsheetApp.getActive().toast('Guardando en el plan…', 'Road To Elite', 3);
      editarBloque_({ id: id, campos: cs }); MEMO = null; pintarHojaSemana_(lunesDe_(lunes));
      SpreadsheetApp.getActive().toast('Guardado: es lo que verás en la app (con candado ✎).', 'Road To Elite', 4); return;
    }
    if ((c !== 9 && c !== 10) || !v) return;
    SpreadsheetApp.getActive().toast('Moviendo…', 'Road To Elite', 3);
    if (c === 9) moverBloqueA_(id, v, lunesDe_(lunes));
    else { var m = String(v).match(/#([\w-]+)\s*$/); if (m) intercambiarBloques_(id, m[1]); }
    MEMO = null;
    pintarHojaSemana_(lunes);
    SpreadsheetApp.getActive().toast(c === 9 ? 'Movido a ' + v : 'Intercambiados', 'Road To Elite', 4);
  } catch (err) { try { SpreadsheetApp.getActive().toast('No se pudo: ' + (err && err.message || err), 'Road To Elite', 6); } catch (x) {} }
}
function menuSemanaBloques() { pintarHojaSemana_(leerConfig_().semana_bloques || lunesDe_(hoyIso_())); SpreadsheetApp.getActive().getSheetByName(HOJAS.SEMBLOQUES).activate(); }

function colLetra_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/** Crea o completa las pestañas de la app con su formato. No borra datos. */
function prepararHojas() { prepararEsquema_(miLibro_(), ESQUEMA); }
function prepararEsquema_(ss, ESQ) {
  olvidarCabeceras_();
  try { return prepararEsquemaSin_(ss, ESQ); } finally { olvidarCabeceras_(); }
}
function prepararEsquemaSin_(ss, ESQ) {
  Object.keys(ESQ).forEach(function (nombre, k) {
    var E = ESQ[nombre], sh = ss.getSheetByName(nombre);
    if (!sh) sh = ss.insertSheet(nombre);
    var tiene = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function (h) { return String(h).trim(); }) : [];
    var cab;
    if (sh.getLastRow() <= 1) cab = E.cab.slice();                        // vacía: cabecera exacta
    else { cab = tiene.slice(); E.cab.forEach(function (h) { if (cab.indexOf(h) < 0) cab.push(h); }); }   // con datos: añade al final
    if (sh.getMaxColumns() < cab.length) sh.insertColumnsAfter(sh.getMaxColumns(), cab.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setBackground('#121212').setFontColor('#ffffff').setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    sh.setFrozenRows(1);
    if (E.congelarCol) sh.setFrozenColumns(E.congelarCol);
    sh.setTabColor(E.color || '#ff7a1a');
    var filas = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, 1, filas, cab.length).setVerticalAlignment('top').setWrap(true);
    cab.forEach(function (h, j) { var w = E.anchos[E.cab.indexOf(h)]; if (w) sh.setColumnWidth(j + 1, w); });
    var col = function (h) { return cab.indexOf(h) + 1; };
    (E.fechas || []).forEach(function (h) {
      if (col(h) > 0) sh.getRange(2, col(h), filas, 1).setNumberFormat('dd/mm/yyyy')
        .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
    });
    Object.keys(E.listas || {}).forEach(function (h) {
      if (col(h) > 0) sh.getRange(2, col(h), filas, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(E.listas[h], true).setAllowInvalid(true).build());
    });
    if (E.cursiva && col(E.cursiva) > 0) sh.getRange(2, col(E.cursiva), filas, 1).setFontStyle('italic');
    if (E.negrita && col(E.negrita) > 0) sh.getRange(2, col(E.negrita), filas, 1).setFontWeight('bold');
    var reglas = (E.colores || []).filter(function (c) { return col(c[0]) > 0; }).map(function (c) {
      var b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=REGEXMATCH($' + colLetra_(col(c[0])) + '2,"' + c[1] + '")')
        .setBackground(c[2]).setRanges([sh.getRange(2, 1, filas, cab.length)]);
      if (c[3]) b.setFontColor(c[3]);
      return b.build();
    });
    sh.setConditionalFormatRules(reglas);
  });
  Logger.log('OK · Pestañas preparadas: ' + Object.keys(ESQ).join(', '));
}

/** Al editar a mano APP · PLAN: rellena DÍA a partir de FECHA y pone un ID si falta. (Trigger simple: no necesita instalarse.) */
function onEdit(e) {
  try {
    var sh = e.range.getSheet(), nombre = sh.getName();
    if ([HOJAS.PLAN, HOJAS.EVENTOS, HOJAS.METAS, HOJAS.AJUSTES, HOJAS.CARRERA, HOJAS.PLANTILLAS].indexOf(nombre) < 0) return;
    var cab = cabeceras_(sh), f0 = e.range.getRow(), n = e.range.getNumRows();
    if (f0 < 2) return;
    var cId = cab.indexOf('ID') + 1;
    for (var f = f0; f < f0 + n; f++) {
      if (cId > 0 && !String(sh.getRange(f, cId).getValue()).trim() && sh.getRange(f, 2).getValue() !== '') sh.getRange(f, cId).setValue(nuevoId_());
      if (nombre === HOJAS.PLAN) {
        var cF = cab.indexOf('FECHA') + 1, cD = cab.indexOf('DÍA') + 1;
        if (cF > 0 && cD > 0) {
          var v = sh.getRange(f, cF).getValue();
          sh.getRange(f, cD).setValue(v instanceof Date ? NOMBRES_DIA[(v.getDay() + 6) % 7] : '');
        }
      }
    }
  } catch (err) { /* nunca bloquear la edición */ }
}
var NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
function nuevoId_() { return Utilities.getUuid().slice(0, 8); }
function diaDe_(iso) { return iso ? NOMBRES_DIA[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7] : ''; }

/** Actualiza columnas concretas de una fila (solo en este libro). */
function actualizarFila_(nombre, fila, o) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  Object.keys(o).forEach(function (h) { var j = cab.indexOf(h); if (j >= 0) sh.getRange(fila, j + 1).setValue(celdaSegura_(o[h])); });
}

// ===================== EVENTOS =====================
var CAMPOS_EVENTO = ['EVENTO', 'TIPO', 'INICIO', 'FIN', 'HORA', 'LUGAR', 'BLOQUEA', 'ANTES (días bajar volumen)', 'DESPUÉS (días recuperación)', 'CÓMO PROCEDER', 'ESTADO', 'NOTAS'];
function guardarEvento_(ev) {
  var o = permitidas_(ev, CAMPOS_EVENTO);
  if (!o.EVENTO || !o.INICIO) throw new Error('evento_incompleto');
  if (!o.FIN) o.FIN = o.INICIO;
  if (!o.ESTADO) o.ESTADO = (o['CÓMO PROCEDER'] || o.BLOQUEA === 'No bloquea') ? 'Decidido' : 'Por decidir';
  var idOut = bloqueo_(function () {
    var id = String(ev.ID || '');
    var x = id ? listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === id; })[0] : null;
    if (x) { actualizarFila_(HOJAS.EVENTOS, x._fila, o); return id; }
    o.ID = nuevoId_(); o.CREADO = ahora_();
    var sh = hojaMia_(HOJAS.EVENTOS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return o.ID;
  });
  if (ev.sinCalendario !== true) eventoACal_(idOut);
  return idOut;
}
function borrarEvento_(id) {
  var x = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(id); })[0];
  if (!x) throw new Error('no_encontrado');
  borrarDeCal_(x);
  borrarFila_(HOJAS.EVENTOS, x._fila, { ID: x.ID });
}
function eventosEntre_(desde, hasta) {
  return listar_(HOJAS.EVENTOS).filter(function (r) {
    if (r.ESTADO === 'Pendiente de aprobar' || r.ESTADO === 'Ignorado') return false;   // los de Google Calendar no cuentan hasta que los apruebes
    var i = celdaIso_(r.INICIO), f = celdaIso_(r.FIN) || i;
    return i && f >= desde && i <= hasta;
  });
}

// ===================== SEMANAS (confirmación antes de programar) =====================
function filaSemana_(lunes) {
  return listar_(HOJAS.SEMANAS).filter(function (r) { return celdaIso_(r.LUNES) === lunes; })[0] || null;
}
/** Guarda disponibilidad y decisiones de la semana. Con confirmar=true queda «Confirmada» (ya se puede programar). */
function guardarSemanaConf_(b) {
  var lunes = lunesDe_(b.lunes);
  var evs = eventosEntre_(lunes, sumarDias(lunes, 6));
  var o = { LUNES: isoAFecha(lunes), 'DOBLES (mañanas libres)': String(b.dobles || '').slice(0, 200), DESCANSO: String(b.descanso || '').slice(0, 200),
    'EVENTOS DE LA SEMANA': evs.map(function (e) { return e.EVENTO + ' (' + e.INICIO + (e.HORA ? ' ' + e.HORA : '') + ' · ' + (e.BLOQUEA || '—') + ')'; }).join(' | '),
    DECISIONES: String(b.decisiones || '').slice(0, 2000), NOTAS: String(b.notas || '').slice(0, 2000) };
  if (b.confirmar) {
    var sinDecidir = evs.filter(function (e) { return e.ESTADO !== 'Decidido' && e.BLOQUEA !== 'No bloquea'; });
    if (sinDecidir.length) throw new Error('eventos_sin_decidir');
    o.ESTADO = 'Confirmada'; o.CONFIRMADA = ahora_();
  }
  return bloqueo_(function () {
    var x = filaSemana_(lunes);
    if (x) { actualizarFila_(HOJAS.SEMANAS, x._fila, o); return lunes; }
    if (!o.ESTADO) o.ESTADO = 'Pendiente de confirmar';
    var sh = hojaMia_(HOJAS.SEMANAS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
    return lunes;
  });
}

/** v0.21 · «Calcular» de Programar semana: en UNA llamada guarda las mañanas (si cambian), relee Fabrik (si hace falta) y devuelve la propuesta sin escribir el plan. */
function previaExtras_(body) {
  var lunes = lunesDe_(body.lunes), cambio = false;
  if (body.dobles != null && String(body.dobles) !== String((filaSemana_(lunes) || {})['DOBLES (mañanas libres)'] || '')) { guardarDobles_(body); cambio = true; }
  if (body.refrescar) { try { cargarFabrikSemana_(lunes); cambio = true; } catch (e) { /* sin Fabrik nuevo se calcula con lo que hay */ } }
  MEMO = null;
  var pvx = generarExtras_(lunes, { simular: true, dias: body.dias, descanso: body.descanso, resto: body.resto, reabrir: body.reabrir });
  pvx.dobles = String((filaSemana_(lunes) || {})['DOBLES (mañanas libres)'] || '');
  return { ok: true, previa: pvx, semana: cambio ? semanaCompleta_(body.ver || lunes) : null };
}

/** Solo cambia las mañanas libres para doble (desde Cargar extras o Reestructurar). No toca descanso, notas, decisiones ni el estado. */
function guardarDobles_(b) {
  var lunes = lunesDe_(b.lunes), dob = String(b.dobles || '').slice(0, 200);
  return bloqueo_(function () {
    var x = filaSemana_(lunes);
    if (x) { actualizarFila_(HOJAS.SEMANAS, x._fila, { 'DOBLES (mañanas libres)': dob }); return lunes; }
    var sh = hojaMia_(HOJAS.SEMANAS), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, { LUNES: isoAFecha(lunes), ESTADO: 'Pendiente de confirmar', 'DOBLES (mañanas libres)': dob })]);
    return lunes;
  });
}

// ===================== PLAN: aprobar semana, cambios propuestos y «no hacer» =====================
/** Pasa a PROGRAMADO todo lo que está en BORRADOR en la semana indicada. */
function aprobarPlanSemana_(lunes) {
  lunes = lunesDe_(lunes);
  var fin = sumarDias(lunes, 6), n = 0;
  bloqueo_(function () {
    listar_(HOJAS.PLAN).forEach(function (r) {
      var d = celdaIso_(r.FECHA);
      if (d >= lunes && d <= fin && r.ESTADO === 'BORRADOR') {
        actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() }); n++;
        if (r.PENDIENTE_ID) { var p = listar_(HOJAS.PENDIENTES).filter(function (x) { return x.ID === r.PENDIENTE_ID; })[0]; if (p) actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Reprogramado' }); }
      }
    });
    var s = filaSemana_(lunes), hu = {};
    try { hu = { 'HUELLA FABRIK': JSON.stringify(huellasFabrik_(fabrikSemana_(lunes).fabrik)), 'FABRIK LEÍDO': ahora_() }; } catch (e) { /* si Fabrik no se puede leer, se aprueba igual */ }
    if (s) actualizarFila_(HOJAS.SEMANAS, s._fila, Object.assign(s.ESTADO === 'Confirmada' ? { ESTADO: 'Programada' } : {}, hu));
    else anadirFila_(HOJAS.SEMANAS, Object.assign({ LUNES: isoAFecha(lunes), ESTADO: 'Programada' }, hu));
  });
  return n;
}

function anadirPendiente_(r, motivo) {
  var sh = hojaMia_(HOJAS.PENDIENTES), cab = cabeceras_(sh);
  var tipo = r.ORIGEN || (String(r.ID || '').indexOf('F-') === 0 ? 'FABRIK' : 'EXTRA');
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, {
    ID: nuevoId_(), CREADO: ahora_(), 'FECHA ORIGINAL': r.FECHA || '', ID_PLAN: r.ID || '', BLOQUE: r['TÍTULO'] || r.BLOQUE || '', TIPO: tipo,
    MOTIVO: String(motivo || '').slice(0, 1000), ESTADO: 'Pendiente' })]);
}

/** Aprueba o rechaza una propuesta de cambios (filas del PLAN con ese CAMBIO_ID). */
function resolverCambio_(cambioId, aprobar) {
  cambioId = String(cambioId || '');
  if (!cambioId) throw new Error('falta_cambio');
  return bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN), propias = plan.filter(function (r) { return r.CAMBIO_ID === cambioId; });
    if (!propias.length) throw new Error('no_encontrado');
    var aBorrar = [];
    propias.forEach(function (r) {
      if (r.ESTADO === 'PROPUESTA') {
        if (aprobar) {
          actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() });
          String(r.REEMPLAZA || '').split(/[,;\s]+/).filter(Boolean).forEach(function (id) {
            var v = plan.filter(function (y) { return y.ID === id; })[0];
            if (v) actualizarFila_(HOJAS.PLAN, v._fila, { ESTADO: 'SUSTITUIDO', ACTUALIZADO: ahora_() });
          });
        } else aBorrar.push(r._fila);
      } else if (r.ESTADO === 'PROPUESTA · NO HACER') {
        if (aprobar) { actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'NO HACER', ACTUALIZADO: ahora_() }); anadirPendiente_(r, 'Reestructuración ' + cambioId); }
        else actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', CAMBIO_ID: '', ACTUALIZADO: ahora_() });
      }
    });
    var sh = hojaMia_(HOJAS.PLAN);
    aBorrar.sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
    var c = listar_(HOJAS.CAMBIOS).filter(function (r) { return r.ID === cambioId; })[0];
    if (c) actualizarFila_(HOJAS.CAMBIOS, c._fila, { ESTADO: aprobar ? 'Aprobada' : 'Rechazada' });
    return propias.length;
  });
}

/** Marca un bloque como «no hacer» y lo manda a PENDIENTES. Los de Fabrik (ID F-…) se anotan en el PLAN sin tocar Fabrik. */
function noHacer_(b) {
  var id = String(b.id || ''), motivo = String(b.motivo || '').slice(0, 1000);
  if (!id || !b.fecha) throw new Error('faltan_datos');
  return bloqueo_(function () {
    var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === id; })[0];
    var est = b.cancelar ? 'CANCELADO' : 'NO HACER';   // v0.22 · CANCELADO = no se hace y no va a pendientes (se puede reactivar)
    if (x) {
      actualizarFila_(HOJAS.PLAN, x._fila, { ESTADO: est, ACTUALIZADO: ahora_() });
      if (b.cancelar) quitarRegistroDe_(id);   // v0.26 · cancelado = fuera del cómputo, también si lo habías marcado como hecho
      if (!b.cancelar) anadirPendiente_(x, motivo);
    } else {
      var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh), iso = celdaIso_(b.fecha);
      var o = { ID: id, FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: b.turno || 'PM', ORDEN: b.orden || 50, ORIGEN: 'FABRIK', FABRIK_REF: b.ref || '',
        'TÍTULO': b.titulo || '', ESTADO: est, ACTUALIZADO: ahora_() };
      sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, o)]);
      if (!b.cancelar) anadirPendiente_(o, motivo);
    }
  });
}

function quitarRegistroDe_(idPlan) {
  var sh = hojaMia_(HOJAS.REGISTRO), n = 0;
  listar_(HOJAS.REGISTRO).filter(function (r) { return r.ID_PLAN === idPlan; }).map(function (r) { return r._fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); n++; });
  if (n) MEMO = null; return n;
}
/** v0.22 · Reactivar un bloque CANCELADO: vuelve a PROGRAMADO y cuenta otra vez para las metas. */
function reactivarBloque_(id) {
  return bloqueo_(function () {
    var x = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(id || ''); })[0];
    if (!x) throw new Error('no_encontrado');
    if (x.ESTADO !== 'CANCELADO') return x.ID;
    actualizarFila_(HOJAS.PLAN, x._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() });
    return x.ID;
  });
}

// ===================== v0.22 · FUSIONAR BLOQUES =====================
/*
 * Une 2–4 bloques (Fabrik, extras o ambos) en UNO ampliado sin cambiar el estímulo de cada parte:
 *  - cada ejercicio conserva sus series, repeticiones, cargas (%, RIR, RPE) y su descanso original;
 *  - fuerza / halterofilia / gimnásticos / accesorios → superserie en ventanas «EVERY W × N»: W = lo que dura una vuelta
 *    o, si es mayor, el trabajo + descanso original del bloque más exigente (así lo pesado sigue descansando lo que pide Gabi);
 *  - el orden alterna patrones (empuje / tirón / pierna / bisagra…) para no encadenar el mismo grupo muscular;
 *  - con un metcon: el metcon NO se toca. Si tiene pausas (ON/OFF, REST entre sets), los accesorios ligeros van en esas pausas;
 *    si no, la superserie va antes y el metcon después, en el mismo bloque;
 *  - la fase del ciclo manda en la prioridad: en fases de fuerza / intensificación lo pesado va primero con su descanso completo;
 *    en fases de volumen / acumulación se permite agrupar más; en descarga se avisa si la fusión sube la densidad.
 * Los originales pasan a SUSTITUIDO (REEMPLAZA del nuevo) y se recuperan con «Deshacer fusión». Cuentan todos los estímulos (CÓDIGOS unidos).
 */
function segTexto_(s) { var m = Math.floor(s / 60), r = Math.round(s % 60); return m && r ? m + '′' + (r < 10 ? '0' : '') + r + '″' : m ? m + '′' : r + '″'; }
function seg_(t) {   // «90"», «1'30"», «2′», «2'30»
  var m = String(t || '').replace(/[′’]/g, "'").replace(/[″”]/g, '"').match(/(\d+)\s*'\s*(\d+)?\s*"?|(\d+)\s*"/);
  if (!m) return 0; return m[3] ? +m[3] : +m[1] * 60 + (+m[2] || 0);
}
/** Patrones de fuerza y accesorios que la guía del motor (centrada en metcons) no tiene: solo para ordenar la fusión. */
var FUERZA_PAT_ = [[/BACK SQUAT|FRONT SQUAT|BOX SQUAT|PAUSE SQUAT|BULGARIAN|SPLIT SQUAT|PISTOL|LUNGE|ZANCADA|STEP ?UPS?|LEG PRESS|SENTADILLA/, 'SENT', ['PIERNA']],
  [/DEADLIFT|PESO MUERTO|\bRDL\b|ROMANIAN|GOOD ?MORNING|HIP THRUST|PULL THROUGH|SWING|NORDIC/, 'BISAGRA', ['PIERNA', 'CORE']],
  [/BENCH|PRESS BANCA|PUSH ?UPS?|FLEXION|\bDIPS?\b|FLOOR PRESS/, 'EMPUJE_H', ['HOMBRO']],
  [/STRICT PRESS|SHOULDER PRESS|MILITARY|PUSH PRESS|JERK|HSPU|HANDSTAND PUSH|Z ?PRESS/, 'EMPUJE_V', ['HOMBRO']],
  [/PULL ?UPS?|CHIN|CHEST TO BAR|\bC2B\b|\bROWS?\b|REMO|PULLDOWN|MUSCLE ?UPS?|LEGLESS|ROPE CLIMB|FACE PULL/, 'TIRON', ['AGARRE']],
  [/T2B|TOES|SIT ?UPS?|HOLLOW|PLANK|PLANCHA|L-?SIT|GHD|COPENHAGEN|PALLOF|AB WHEEL|DEAD BUG/, 'CORE', ['CORE']],
  [/CARRY|FARMER|YOKE/, 'ACARREO', ['AGARRE', 'CORE']], [/SNATCH|CLEAN/, 'OLY', ['SNC', 'PIERNA']]];
function movsFusion_(L, G) {
  var mv = detectarMovs_(L, G); if (mv.length) return mv;
  for (var i = 0; i < FUERZA_PAT_.length; i++) { var m = L.match(FUERZA_PAT_[i][0]); if (m) return [{ m: { k: m[0].replace(/\s+/g, '_'), patron: FUERZA_PAT_[i][1], carga: FUERZA_PAT_[i][2] } }]; }
  return [];
}
function analizarParaFusion_(r, G) {
  var raw = String(r.CONTENIDO || '').replace(/\r/g, ''), titulo = r['TÍTULO'] || r.BLOQUE || '';
  var secciones = raw.split(/\n(?=\s*[A-Z](?:\.\d)?\s*[·)]\s)|\n\s*\n/), prep = [], main = [];
  secciones.forEach(function (sx) { var cab = norm(sx.split('\n')[0]); if (RE_PREP_.test(cab)) prep.push(sx.trim()); else if (sx.trim()) main.push(sx.trim()); });
  var mt = main.join('\n'), T = norm(mt), tipo = tipoBloqueTxt_(titulo + ' ' + mt.slice(0, 160));
  var metcon = /METCON|AMRAP|FOR TIME|TIME ?CAP|CHIPPER|\bWOD\b/.test(norm(titulo + ' ' + T)) || norm(r.ORIGEN) === 'CARRERA';
  var every = T.match(/(?:EVERY|CADA|E)\s*([0-9]{1,2}(?:\s*'\s*[0-9]{1,2})?\s*(?:'|"|MIN)?|[0-9]{2,3}\s*")\s*(?:X|×)\s*([0-9]{1,2})/), emom = T.match(/EMOM\s*([0-9]{1,2})/);
  var sets = 0, win = 0;
  if (every) { win = seg_(every[1].replace(/MIN/, "'")) || (+every[1] <= 10 ? +every[1] * 60 : +every[1]); sets = +every[2]; }
  else if (emom) { win = 60; sets = +emom[1]; }
  var ms = T.match(/([0-9]{1,2})(?:\/[0-9])?\s*(?:SETS|SERIES|RONDAS|ROUNDS)/) || T.match(/(^|\n)\s*([0-9]{1,2})\s*[X×]\s*[0-9]/);
  if (!sets && ms) sets = +(ms[2] || ms[1]);
  if (!sets) sets = 3;
  var rest = 0; (T.match(/(?:REST|DESCANSO|RECUPERA\w*)\s*[0-9][0-9'"′″ ]*/g) || []).forEach(function (x) { rest += seg_(x.replace(/^\D+/, '')); });   // varios REST en una serie: se suman (descanso total por serie)
  var pesado = /([89][0-9]|1[0-9]{2})\s*%|RIR\s*[0-2]\b|RPE\s*(8|9|10)|[0-9]RM|PESAD|HEAVY/.test(T);
  if (!rest) rest = win ? 0 : tipo === 'haltero' || tipo === 'fuerza' ? (pesado ? 120 : 90) : tipo === 'gimnásticos' ? 90 : 60;
  var ejer = [];
  mt.split('\n').forEach(function (l) {
    var L = norm(l).trim(); if (!L) return;
    var ult = ejer[ejer.length - 1];
    if (ult && /^[(*]/.test(L) && !/^\*\s*(NO|POR)/.test(L)) { ult.txt += ' ' + l.trim(); return; }   // «(RIR 1/2)» en la línea siguiente
    var mvSet = /^SET\s*[0-9]/.test(L) ? movsFusion_(L, G) : [];
    if (mvSet.length) {   // «SET 1/3: 6 BACK SQUAT (75/80%)»: series alternas del mismo ejercicio
      if (ult && ult.k[0] === mvSet[0].m.k) { ult.txt += ' / ' + l.trim(); return; }
      ejer.push({ txt: l.trim(), seg: pesado ? 30 : 25, patron: mvSet[0].m.patron || '', carga: mvSet[0].m.carga || [], k: mvSet.map(function (z) { return z.m.k; }) }); return;
    }
    if (/^([A-Z](\.\d)?\s*[·)]|EVERY|EMOM|CADA|E[0-9]|[0-9]{1,2}(\/[0-9])?\s*(SETS|SERIES|RONDAS|ROUNDS)\s*:?$|REST|DESCANSO|REGISTRA|\*|SET\s*[0-9]|METCON|ACCESOR|STRENG|GYMNAST|WEIGH)/.test(L)) return;
    var mv = movsFusion_(L, G);
    if (!/^[0-9]/.test(L) && !mv.length) return;
    var x = L.replace(/^([0-9]+)\s*[X×]\s*/, function (a, n) { if (!every && !emom) sets = Math.max(sets, +n); return ''; });
    var reps = parseFloat((x.match(/^([0-9]+(?:[.,][0-9]+)?)/) || [])[1] || '0'), w;
    if (/^[0-9]+\s*("|″|SEG)/.test(x)) w = seg_(x); else if (/^[0-9.,]+\s*M\b/.test(x)) w = reps * 1.3; else if (/CAL/.test(x)) w = reps * 3; else w = reps * (pesado ? 4.5 : 3);
    ejer.push({ txt: l.trim().replace(/^([0-9]+)\s*[X×]\s*/i, ''), seg: Math.max(15, Math.min(75, w || 30)), patron: (mv[0] && mv[0].m.patron) || '', carga: (mv[0] && mv[0].m.carga) || [], k: mv.map(function (z) { return z.m.k; }) });
  });
  var notasCarga = (mt.match(/^\s*SET\s*[0-9/ ]+:.*$/gim) || []).map(function (z) { return z.trim(); }).filter(function (z) { return !movsFusion_(norm(z), G).length; });
  var ventanas = /ON\s*(X|\/)?\s*[0-9]+\s*'?\s*OFF|[0-9]+\s*'\s*OFF|REST\s*[0-9]/.test(T);
  return { r: r, titulo: titulo, tipo: tipo, metcon: metcon, sets: sets, win: win, rest: rest, pesado: pesado, ejer: ejer, prep: prep, main: mt, notasCarga: notasCarga, ventanasMetcon: metcon && ventanas, min: minFila_(r) };
}
function fusionarBloques_(ids, opts) {
  opts = opts || {};
  ids = (ids || []).map(String).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  if (ids.length < 2) throw new Error('elige_dos');
  if (ids.length > 4) throw new Error('maximo_cuatro');
  var plan = listar_(HOJAS.PLAN), filas = ids.map(function (id) { return plan.filter(function (r) { return r.ID === id; })[0]; });
  if (filas.some(function (r) { return !r; })) throw new Error('no_encontrado');
  if (filas.some(function (r) { return /^(SUSTITUIDO|OCULTO|CANCELADO|NO HACER)$/.test(r.ESTADO); })) throw new Error('bloque_no_activo');
  var lunes = lunesDe_(celdaIso_(filas[0].FECHA));
  if (filas.some(function (r) { return lunesDe_(celdaIso_(r.FECHA)) !== lunes; })) throw new Error('otra_semana');
  var G = guiaMotor_(), P = filas.map(function (r) { return analizarParaFusion_(r, G); });
  var fase = { nombre: 'Sin fase' }; try { fase = faseDe_(celdaIso_(filas[0].FECHA), estructura_(fabrik_())); } catch (e) {}
  var F = norm(fase.nombre), fFuerza = /FUERZA|INTENSIF|STRENG|MAXIM|POTENCIA|PEAK|REALIZ/.test(F), fVol = /ACUMUL|VOLUMEN|BASE|HIPERTROF|TRANSFORM|CAPACIDAD/.test(F), fDesc = /DESCARGA|DELOAD|TAPER/.test(F);
  var met = P.filter(function (p) { return p.metcon; }), resto = P.filter(function (p) { return !p.metcon; }), avisos = [], lineas = [];
  if (met.length > 1) throw new Error('dos_metcons');
  // prioridad: en fases de fuerza lo pesado (y la halterofilia) primero; en volumen, el que más series tiene
  var pri = function (p) { return (p.tipo === 'haltero' ? 40 : p.tipo === 'fuerza' ? 30 : p.tipo === 'gimnásticos' ? 20 : 10) + (p.pesado ? (fFuerza ? 25 : 10) : 0) + (fVol ? p.sets : 0); };
  resto.sort(function (a, b) { return pri(b) - pri(a); });
  var N = resto.reduce(function (m, p) { return Math.max(m, p.sets); }, 0), W = 0, total = 0, items = [];
  if (resto.length) {
    resto.forEach(function (p) { p.ejer.forEach(function (e) { items.push({ e: e, p: p }); }); });
    // alternar patrones: no dos seguidos del mismo patrón ni de la misma carga local (agarre, hombro, pierna)
    var orden = [], pend = items.slice();
    while (pend.length) {
      var ult = orden[orden.length - 1], k = 0;
      if (ult) { var j = pend.findIndex(function (x) { return x.e.patron !== ult.e.patron && !x.e.carga.some(function (c) { return ult.e.carga.indexOf(c) >= 0; }) && !interfEntre_(G, { k: ult.e.k[0], patron: ult.e.patron }, { k: x.e.k[0], patron: x.e.patron }).some(function (r) { return /EVITAR/i.test(r.tipo); }); }); if (j > 0) k = j; }
      orden.push(pend.splice(k, 1)[0]);
    }
    items = orden;
    var vuelta = items.reduce(function (a, x) { return a + x.e.seg; }, 0) + 15 * items.length;
    var exig = resto.reduce(function (m, p) { var w = p.ejer.reduce(function (a, e) { return a + e.seg; }, 0) + (p.win ? Math.max(0, p.win - p.ejer.reduce(function (a, e) { return a + e.seg; }, 0)) : p.rest); return Math.max(m, w); }, 0);
    W = Math.max(vuelta, exig, 60); W = Math.ceil(W / 15) * 15;
    if (fDesc && vuelta > exig) avisos.push('Fase de ' + fase.nombre + ': la fusión sube la densidad; si notas fatiga, quita la última serie.');
    if (W > 300) { avisos.push('La vuelta dura ' + segTexto_(W) + ': son muchos ejercicios para una sola ventana. Valora dejar uno fuera.'); }
    total = Math.round(W * N / 60);
    lineas.push('EVERY ' + segTexto_(W) + ' X ' + N + ' SETS (≈' + total + '′)');
    var L = 'ABCDEFGHIJ';
    items.forEach(function (x, i) { lineas.push(L.charAt(i) + ') ' + x.e.txt + (x.p.sets < N ? ' · series 1–' + x.p.sets : '')); });
    resto.forEach(function (p) { if (p.notasCarga.length) lineas.push('Cargas ' + p.titulo + ': ' + p.notasCarga.join(' · ')); });
    lineas.push('Trabajo ≈' + segTexto_(vuelta) + ' por vuelta · cada ejercicio vuelve a tocarle a los ' + segTexto_(W) + ' (descanso original respetado: ' + resto.map(function (p) { return p.titulo + ' ' + segTexto_(p.win || p.rest + p.ejer.reduce(function (a, e) { return a + e.seg; }, 0)); }).join(' · ') + ').');
    resto.forEach(function (p) { if (!p.ejer.length) avisos.push('«' + p.titulo + '»: no encontré ejercicios con repeticiones; revisa el resultado.'); });
  }
  var cuerpo;
  if (met.length) {
    var m = met[0];
    if (resto.length && m.ventanasMetcon && resto.every(function (p) { return !p.pesado && (p.tipo === 'accesorios' || p.tipo === 'gimnásticos' || p.tipo === 'otro'); })) {
      cuerpo = m.main + '\n\nEN CADA PAUSA (OFF / REST) DEL METCON:\n' + items.map(function (x) { return '+ ' + x.e.txt; }).join('\n') + '\n(Ritmo de recuperación activa: sin fallo, para que no cambie el estímulo del metcon)';
      total = Math.round(m.min + 2); avisos.push('Los accesorios van en las pausas del metcon: el metcon no cambia.');
    } else {
      cuerpo = (lineas.length ? 'A) FUERZA / ACCESORIOS EN SUPERSERIE\n' + lineas.join('\n') + '\n\nB) ' : '') + m.main;
      total = total + Math.round(m.min);
      if (lineas.length) avisos.push('Superserie antes y metcon después (el metcon no se toca).');
    }
  } else cuerpo = lineas.join('\n');
  var prep = P.filter(function (p) { return p.prep.length; }).map(function (p) { return p.titulo + ':\n' + p.prep.join('\n\n'); });
  var contenido = (prep.length ? 'CALENTAMIENTO (de los bloques originales)\n' + prep.join('\n\n') + '\n\n' : '') + cuerpo;
  var cods = []; filas.forEach(function (r) { String(r['CÓDIGOS'] || '').split('|').forEach(function (c) { c = c.trim(); if (c && cods.indexOf(c) < 0) cods.push(c); }); });
  var porque = 'Fusión de ' + P.map(function (p) { return '«' + p.titulo + '» (' + p.tipo + (p.pesado ? ', pesado' : '') + ', ' + p.sets + ' series)'; }).join(' + ') + '. Fase: ' + fase.nombre +
    (fFuerza ? ' → lo pesado primero y con su descanso completo.' : fVol ? ' → prioridad al volumen; se agrupa sin recortar series.' : fDesc ? ' → descarga: ojo a la densidad.' : '.') +
    ' Se mantienen series, repeticiones y cargas de cada parte; cuentan todos sus estímulos (' + cods.join(', ') + ').';
  var base = filas[0];   // va donde estaba el primero que marcaste
  var iso = celdaIso_(base.FECHA), int = filas.map(function (r) { return r.INTENSIDAD || ''; }).filter(Boolean).sort().pop() || '';
  var nuevo = { ID: 'FU' + nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: base.TURNO === 'AM' ? 'AM' : 'PM', ORDEN: base.ORDEN || 50, ORIGEN: 'FUSIÓN',
    BLOQUE: '🔗 ' + P.map(function (p) { return p.titulo; }).join(' + '), 'TÍTULO': '🔗 ' + P.map(function (p) { return p.titulo; }).join(' + '), CONTENIDO: contenido.slice(0, 4000),
    INTENSIDAD: int, MIN: String(total || Math.round(P.reduce(function (a, p) { return a + p.min; }, 0))), 'CÓDIGOS': cods.join('|'), 'POR QUÉ (cursiva)': porque.slice(0, 1500),
    INTERFERENCIAS: avisos.join(' '), ESTADO: filas.every(function (r) { return r.ESTADO === 'PROGRAMADO'; }) ? 'PROGRAMADO' : 'BORRADOR',
    GENERADO: 'manual ' + ahora_() + ' (candado · fusión)', REEMPLAZA: ids.join(','), ACTUALIZADO: ahora_() };
  var res = { bloque: nuevo, avisos: avisos, fase: fase.nombre, partes: P.map(function (p) { return { titulo: p.titulo, tipo: p.tipo, series: p.sets, pesado: p.pesado, ejercicios: p.ejer.length, min: p.min }; }), minAntes: Math.round(P.reduce(function (a, p) { return a + p.min; }, 0)) };
  if (opts.simular) return res;
  if (opts.propuesta) {   // v0.26 · desde el Sheet: queda como PROPUESTA hasta que la apruebes (rechazar = todo vuelve a su sitio y estado)
    nuevo.CAMBIO_ID = 'FUSPROP:' + nuevo.ESTADO; nuevo.ESTADO = 'BORRADOR'; nuevo.GENERADO = 'manual ' + ahora_() + ' (candado · fusión · PROPUESTA)';
  }
  bloqueo_(function () {
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, nuevo)]);
    filas.forEach(function (r) { actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'SUSTITUIDO', CAMBIO_ID: 'FUSION:' + nuevo.ID + ':' + r.ESTADO, ACTUALIZADO: ahora_() }); });
  });
  return res;
}
/** Deshace una fusión: borra el bloque fusionado y devuelve cada original a su estado anterior. */
function desfusionar_(id) {
  var plan = listar_(HOJAS.PLAN), f = plan.filter(function (r) { return r.ID === String(id || ''); })[0];
  if (!f || norm(f.ORIGEN) !== 'FUSION') throw new Error('no_es_fusion');
  bloqueo_(function () {
    plan.filter(function (r) { return String(r.CAMBIO_ID || '').indexOf('FUSION:' + f.ID + ':') === 0; }).forEach(function (r) {
      actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: String(r.CAMBIO_ID).split(':')[2] || 'PROGRAMADO', CAMBIO_ID: '', ACTUALIZADO: ahora_() });
    });
  });
  borrarFila_(HOJAS.PLAN, f._fila, { ID: f.ID });
}

/** v0.26 · Aprueba una fusión propuesta desde el Sheet: pasa al estado que le toca y deja de ser propuesta. */
function aprobarFusion_(id) {
  var f = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === String(id || ''); })[0];
  if (!f || norm(f.ORIGEN) !== 'FUSION') throw new Error('no_es_fusion');
  var est = (String(f.CAMBIO_ID || '').match(/^FUSPROP:(.+)$/) || [])[1] || f.ESTADO;
  actualizarFila_(HOJAS.PLAN, f._fila, { ESTADO: est, CAMBIO_ID: '', GENERADO: String(f.GENERADO || '').replace(' · PROPUESTA', ''), ACTUALIZADO: ahora_() });
  return est;
}
function esFusionPropuesta_(r) { return /^FUSPROP:/.test(String(r.CAMBIO_ID || '')); }

// ===================== v0.24 · CAMBIAR EL ESTÍMULO DE UN BORRADOR =====================
/** Lista de estímulos del catálogo con su familia (prioridad de la meta), carga, ámbito y lo que falta esta semana / este mes. */
function estimulosLista_(lunes) {
  var cat = catalogo_(), cache = cacheMetas_(), sem = avanceMetas_('Semana', periodoSemana_(lunes), cache), mes = avanceMetas_('Mes', periodoMes_(lunes), cache);
  var por = {}; sem.concat(mes).forEach(function (x) { codigosDe_(x.codigos).forEach(function (c) { (por[c] = por[c] || []).push(x); }); });
  return Object.keys(cat).filter(function (c) { return cat[c].CONTENIDO; }).map(function (c) {
    var r = cat[c], ms = por[c] || [], m = ms[0] || {};
    var falta = ms.reduce(function (a, x) { return Math.max(a, (x.meta || 0) - (x.programado || 0)); }, 0);
    return { c: c, nombre: r.NOMBRE, familia: m.prioridad || r.ORIGEN || '', carga: String(r.CARGA || ''), min: +r.MIN || 0, ambito: ms.map(function (x) { return x.programado != null && cache.metas.filter(function (q) { return q.ID === x.id; })[0] ? cache.metas.filter(function (q) { return q.ID === x.id; })[0]['ÁMBITO'] : ''; }).filter(Boolean).join('/'), falta: Math.round(falta * 10) / 10, intensidad: r.INTENSIDAD || '' };
  }).sort(function (a, b) { return a.c < b.c ? -1 : 1; });
}
/** Familia de un bloque: la de sus códigos (prioridad de la meta) o, si no, su carga. */
function familiaDe_(codigos, lista) { var cs = codigosDe_(codigos); var e = lista.filter(function (x) { return cs.indexOf(x.c) >= 0; })[0]; return e ? e.familia : ''; }
/** Ordena el catálogo para cambiar un bloque: misma familia, luego misma carga, luego lo que más falta. */
function candidatosCambio_(r, lista) {
  var fam = familiaDe_(r['CÓDIGOS'], lista), car = String(r.CARGA || '') || (lista.filter(function (x) { return codigosDe_(r['CÓDIGOS']).indexOf(x.c) >= 0; })[0] || {}).carga || '';
  var VAC = /^(P[0-9]+|CALIDAD|FATIGA|EN|DE|Y|ESPECIFICA|INTEGRACION|ACCESORIOS|COMPETICION)$/;
  var gr = function (f) { return norm(String(f)).split(/[^A-Z0-9]+/).filter(function (w) { return w.length > 2 && !VAC.test(w); }); };
  return lista.map(function (x) { var gf = gr(fam), p = (x.familia && x.familia === fam ? 100 : gr(x.familia).some(function (w) { return gf.indexOf(w) >= 0; }) ? 60 : 0) + (car && x.carga && norm(x.carga).split(/[ ,]+/).some(function (k) { return k && norm(car).indexOf(k) >= 0; }) ? 20 : 0) + Math.min(10, x.falta * 5);
    return Object.assign({ puntos: p, mismaFamilia: p >= 60 }, x); }).sort(function (a, b) { return b.puntos - a.puntos || (a.c < b.c ? -1 : 1); });
}
/** Dosis según el ámbito: semanal = completa; mensual = pequeña dosis ligera (≤12′, RPE ≤7, sin fatiga del SNC). */
function dosisPorAmbito_(o, ambito) {
  if (/CARRERA/.test(norm(o.ORIGEN)) || /^R0|^W0[1-4]|^V01/.test(o['CÓDIGOS'] || '')) return o;
  if (ambito === 'Mes') {
    o.MIN = String(Math.min(parseFloat(o.MIN) || 10, 12));
    if (!/DOSIS MENSUAL/.test(o.CONTENIDO || '')) o.CONTENIDO = 'DOSIS MENSUAL LIGERA · 2–3 series de calidad, RPE ≤7, sin fallo ni fatiga del sistema nervioso. Si lo de abajo pide más, quédate en la mitad.\n\n' + (o.CONTENIDO || '');
    if (!/Técnico|Calidad|Ligero|Suave/.test(o.INTENSIDAD || '')) o.INTENSIDAD = '🟢 Ligero';
  } else if (ambito === 'Semana') {
    if (!/ESTÍMULO SEMANAL/.test(o.CONTENIDO || '')) o.CONTENIDO = 'ESTÍMULO SEMANAL · dosis completa: todas las series, calidad máxima y descansos completos.\n\n' + (o.CONTENIDO || '');
  }
  return o;
}
function ambitoDeCodigo_(c) { var ms = cacheMetas_().metas.filter(function (m) { return m.ACTIVA !== 'No' && codigosDe_(m['CÓDIGOS']).indexOf(c) >= 0; }); return ms.some(function (m) { return m['ÁMBITO'] === 'Semana'; }) ? 'Semana' : ms.length ? 'Mes' : ''; }
/** Cambia un bloque extra (borrador o programado, no Fabrik) por otro estímulo del catálogo. Cuenta el nuevo código en semana y mes. */
function cambiarEstimulo_(id, codigo) {
  codigo = String(codigo || '').trim().toUpperCase();
  var cat = catalogo_(), e = cat[codigo]; if (!e || !e.CONTENIDO) throw new Error('estimulo_no_encontrado');
  var r = listar_(HOJAS.PLAN).filter(function (x) { return x.ID === String(id || ''); })[0];
  if (!r) throw new Error('no_encontrado');
  if (norm(r.ORIGEN) === 'FABRIK') throw new Error('fabrik_no_se_cambia');
  var o = { 'TÍTULO': e.NOMBRE, BLOQUE: e.NOMBRE, CONTENIDO: String(e.CONTENIDO) + (e['DATOS A REGISTRAR'] ? '\n\nRegistra: ' + e['DATOS A REGISTRAR'] : ''), MIN: String(e.MIN || r.MIN || 10), INTENSIDAD: e.INTENSIDAD || '', 'CÓDIGOS': codigo, ORIGEN: e.ORIGEN || r.ORIGEN,
    'POR QUÉ (cursiva)': (e['POR QUÉ (cursiva)'] || '') + ' · Elegido por ti en lugar de «' + (r['TÍTULO'] || r.BLOQUE) + '» (' + (r['CÓDIGOS'] || 'sin código') + ').', GENERADO: 'manual ' + ahora_() + ' (candado · estímulo elegido)', ACTUALIZADO: ahora_() };
  dosisPorAmbito_(o, ambitoDeCodigo_(codigo));
  actualizarFila_(HOJAS.PLAN, r._fila, o);
  return { id: r.ID, antes: r['CÓDIGOS'], ahora: codigo };
}
// ===================== v0.24 · PROGRAMAR DESDE EL SHEET (sesión, día o semana) =====================
function programarRango_(lunes, iso, turno) {
  var fin = sumarDias(lunes, 6), n = 0;
  bloqueo_(function () {
    listar_(HOJAS.PLAN).forEach(function (r) { var d = celdaIso_(r.FECHA);
      if (d < lunes || d > fin || r.ESTADO !== 'BORRADOR' || esFusionPropuesta_(r)) return;   // la fusión propuesta se aprueba o se rechaza antes
      if (iso && d !== iso) return; if (turno && (r.TURNO === 'AM' ? 'AM' : 'PM') !== turno) return;
      actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'PROGRAMADO', ACTUALIZADO: ahora_() }); n++; });
  });
  return n;
}
// ===================== CAMBIOS (ha surgido algo) =====================
function solicitarCambio_(b) {
  var desde = celdaIso_(b.desde) || hoyIso_();
  if (!b.evento) throw new Error('falta_evento');
  var evId = '';
  if (b.fechaEvento) evId = guardarEvento_({ EVENTO: b.evento, TIPO: b.tipo || 'Otro', INICIO: isoAFecha(celdaIso_(b.fechaEvento)), FIN: isoAFecha(celdaIso_(b.fechaEvento)),
    HORA: b.hora || '', BLOQUEA: b.bloquea || 'Parcial', 'CÓMO PROCEDER': 'Reestructurar la semana', ESTADO: 'Decidido', NOTAS: b.notas || '' });
  var o = { ID: nuevoId_(), CREADO: ahora_(), DESDE: isoAFecha(desde), 'TURNO DESDE': b.turno || 'PM', EVENTO: String(b.evento).slice(0, 200),
    AFECTA: String(b.afecta || '').slice(0, 200), NOTAS: String(b.notas || '').slice(0, 1000) + (evId ? ' · evento ' + evId : ''), ESTADO: 'Solicitada' };
  anadirFila_(HOJAS.CAMBIOS, o);
  return o.ID;
}

function pendientesAbiertos_() {
  var ab = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ESTADO === 'Pendiente' || r.ESTADO === 'Propuesto'; });
  if (!ab.length) return ab;
  var plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
  return ab.map(function (r) { var o = plan[r.ID_PLAN] || {}, mot = String(r.MOTIVO || ''); return Object.assign({}, r, { _CONTENIDO: r.CONTENIDO || o.CONTENIDO || '', _MIN: r.MIN || o.MIN || '', _INTENSIDAD: o.INTENSIDAD || '', _Z2: esZ2Fila_(o) && !/\[tal cual\]/.test(mot), _MAS25: /\[\+25 %\]/.test(mot) }); });
}
/** v0.16.3 · editar un pendiente: título, contenido, minutos y notas (lo que se recolocará la semana siguiente). */
function editarPendiente_(b) {
  var p = listar_(HOJAS.PENDIENTES).filter(function (r) { return r.ID === String(b.id || ''); })[0];
  if (!p) throw new Error('no_encontrado');
  var o = {}; if (b.bloque != null) o.BLOQUE = String(b.bloque).slice(0, 200); if (b.contenido != null) o.CONTENIDO = String(b.contenido).slice(0, 4000);
  if (b.min != null) o.MIN = String(parseFloat(b.min) || ''); if (b.notas != null) o.NOTAS = String(b.notas).slice(0, 1000);
  actualizarFila_(HOJAS.PENDIENTES, p._fila, o);
}
function cambiosAbiertos_() { return listar_(HOJAS.CAMBIOS).filter(function (r) { return r.ESTADO === 'Solicitada' || r.ESTADO === 'Propuesta lista'; }); }

// ===================== COBERTURA EN TARJETAS (lectura de Dashboard, Semana, Mes y carrera) =====================
function cobertura_() { return conMemo_(coberturaSin_); }
function coberturaSin_() {
  var sh = miLibro_().getSheetByName('carrera'), car = sh ? sh.getRange(1, 1, Math.min(Math.max(sh.getLastRow(), 1), 160), 7).getDisplayValues() : [];
  var iCab = -1; car.forEach(function (r, i) { if (iCab < 0 && /^Sesi[oó]n$/i.test(String(r[0]).trim())) iCab = i; });
  var carrera = [], actual = null;
  if (iCab >= 0) car.slice(iCab + 1).forEach(function (r) {
    var t = String(r[0]).trim();
    if (!t) return;
    var soloTitulo = r.slice(1).every(function (c) { return !String(c).trim(); });
    if (soloTitulo) { actual = { titulo: t, sesiones: [] }; carrera.push(actual); }
    else if (actual) actual.sesiones.push({ sesion: t, trabajo: r[1], ritmo: r[2], zona: r[3], datos: r[4], sensaciones: r[5], revision: r[6] });
  });
  return { metas: metasDe_(hoyIso_()), carrera: { intro: car.slice(0, iCab >= 0 ? iCab : 6).map(function (r) { return String(r[0]).trim(); }).filter(Boolean), semanas: carrera } };
}

// ===================== INSTALACIÓN =====================
/** Ejecutar desde el editor tras cada actualización: crea la copia semanal de vídeos (domingo 23:00) y el backup (domingo 23:30, Madrid) y comprueba accesos. */
/** v0.12.1 · El registro de «configurar» se guarda en APP · CONFIG › ultimo_configurar: Claude lo lee del Sheet y no hace falta pegarlo. */
/** v0.15.1 · Google a veces falla puntualmente al crear o borrar disparadores («error en el servidor»): se reintenta y, si sigue, se anota y se continúa. */
function reintentar_(f, que) {
  for (var i = 0; i < 4; i++) { try { return f(); } catch (e) { if (i === 3) { try { logc_('AVISO · ' + (que || 'operación') + ' no se pudo tras 4 intentos: ' + e); } catch (x) {} return null; } Utilities.sleep(1500 * (i + 1)); } }
}
function borrarDisp_(t) { return reintentar_(function () { ScriptApp.deleteTrigger(t); return true; }, 'borrar disparador ' + t.getHandlerFunction()); }
var LOGC_ = [];
function logc_(s) { Logger.log(s); LOGC_.push(String(s)); }
function configurar() {
  LOGC_ = ['configurar ' + CONFIG.VERSION + ' · ' + new Date().toISOString()];
  try { configurarSin_(); logc_('FIN · todo OK'); }
  catch (e) { logc_('ERROR · ' + (e && e.message || e) + (e && e.stack ? ' · ' + String(e.stack).split('\n').slice(0, 3).join(' | ') : '')); throw e; }
  finally { try { ponerConfig_('ultimo_configurar', LOGC_.join('\n').slice(0, 45000), 'Registro de la última ejecución de configurar (lo lee Claude)'); } catch (e2) { Logger.log('No se pudo guardar el registro: ' + e2); } }
}
function configurarSin_() {
  // Domingo: una sola tarea en cadena (cierre → vídeos → backup) en vez de tres con horarios cercanos.
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['copiarVideosGabi', 'backupSemanal', 'cierreSemanal', 'domingoNoche'].indexOf(t.getHandlerFunction()) >= 0) borrarDisp_(t); });
  reintentar_(function () { return ScriptApp.newTrigger('domingoNoche').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).nearMinute(15).inTimezone(CONFIG.ZONA).create(); }, 'disparador');   // termina antes del informe de las 23:30
  logc_('OK · Carpeta de backups: ' + DriveApp.getFolderById(CONFIG.BACKUPS_ID).getName());
  // Pestaña «APP · SEMANA EN BLOQUES»: mover/intercambiar desde el Sheet y repintarla al abrirlo
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['alEditarHoja', 'alAbrirHoja'].indexOf(t.getHandlerFunction()) >= 0) borrarDisp_(t); });
  reintentar_(function () { return ScriptApp.newTrigger('alEditarHoja').forSpreadsheet(CONFIG.SHEET_ID).onEdit().create(); }, 'disparador');
  reintentar_(function () { return ScriptApp.newTrigger('alAbrirHoja').forSpreadsheet(CONFIG.SHEET_ID).onOpen().create(); }, 'disparador');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'revisarAvisos') borrarDisp_(t); });
  reintentar_(function () { return ScriptApp.newTrigger('revisarAvisos').timeBased().everyHours(1).create(); }, 'disparador');
  // v0.9: Fabrik → plan el domingo a las 23:15 y Google Calendar cada hora
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['cargarFabrikDomingo', 'sincronizarCalendario'].indexOf(t.getHandlerFunction()) >= 0) borrarDisp_(t); });
  reintentar_(function () { return ScriptApp.newTrigger('cargarFabrikDomingo').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).nearMinute(15).inTimezone(CONFIG.ZONA).create(); }, 'disparador');
  reintentar_(function () { return ScriptApp.newTrigger('sincronizarCalendario').timeBased().everyHours(1).create(); }, 'disparador');
  // v0.15: motor diario (Fabrik → MOTOR · ANÁLISIS, Gemini) y backup completo de los jueves
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['motorDiario', 'backupJueves'].indexOf(t.getHandlerFunction()) >= 0) borrarDisp_(t); });
  reintentar_(function () { return ScriptApp.newTrigger('motorDiario').timeBased().everyDays(1).atHour(4).inTimezone(CONFIG.ZONA).create(); }, 'disparador');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'revisarVideosSiToca') borrarDisp_(t); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'competisLunes') borrarDisp_(t); });
  reintentar_(function () { return ScriptApp.newTrigger('competisLunes').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(15).inTimezone(CONFIG.ZONA).create(); }, 'disparador');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['videosMartes', 'copiarVideosGabi'].indexOf(t.getHandlerFunction()) >= 0) borrarDisp_(t); });
  reintentar_(function () { return ScriptApp.newTrigger('videosMartes').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(6).nearMinute(0).inTimezone(CONFIG.ZONA).create(); }, 'disparador');
  reintentar_(function () { return ScriptApp.newTrigger('backupJueves').timeBased().onWeekDay(ScriptApp.WeekDay.THURSDAY).atHour(BACKUP_HORA_).nearMinute(5).inTimezone(CONFIG.ZONA).create(); }, 'disparador');
  try { logc_('OK · Unificación: ' + unificar_()); } catch (e) { logc_('AVISO · Unificación (no se ha borrado nada): ' + e); }
  prepararHojas();
  try { logc_('OK · Base de datos de WODs: ' + prepararBd_()); } catch (e) { logc_('AVISO · Base de datos de WODs: ' + e); }
  try { logc_('OK · Competis copiadas de ProgramAPP: ' + copiarCompetis_() + ' nuevas'); } catch (e) { logc_('AVISO · Competis: ' + e); }
  try { MEMO = null; logc_('OK · APP · COMPETIS (filtros en el Sheet): ' + pintarCompetisSheet_() + ' competis'); } catch (e) { logc_('AVISO · APP · COMPETIS: ' + e); }
  try { MEMO = null; logc_('OK · APP · ESTÍMULOS EN BLOQUES: ' + pintarHojaEstimulos_(lunesDe_(hoyIso_())) + ' filas (marca REDUCIBLE / INCENTIVAR)'); } catch (e) { logc_('AVISO · Estímulos en bloques: ' + e); }
  try { MEMO = null; logc_('OK · MODO OPERACIÓN: ' + opPrepararConfig_() + ' claves nuevas en APP · CONFIG · ' + opPrepararCatalogo_() + ' estímulos/metas del modo · fase de hoy: ' + opDiario_()); } catch (e) { logc_('AVISO · Modo operación: ' + e); }
  try { logc_('OK · APRENDIZAJE: pestañas listas en Road to Elite · Motor (' + [HOJAS.APR_SEM, HOJAS.APR_ANA, HOJAS.APR_DN, HOJAS.APR_REG].filter(function (h) { return !!hojaMia_(h); }).length + ' de 4)'); } catch (e) { logc_('AVISO · Aprendizaje: ' + e); }
  try { MEMO = null; logc_('OK · v0.29 rendimiento: ' + prepararV29a_()); } catch (e) { logc_('AVISO · v0.29a: ' + e); }
  try { MEMO = null; logc_('OK · v0.29 competición: ' + prepararV29b_()); } catch (e) { logc_('AVISO · v0.29b: ' + e); }
  try { logc_('OK · LESIONES · ADAPTACIONES: ' + prepararLesiones_() + ' propuestas nuevas (apruébalas en Road to Elite · Motor)'); } catch (e) { logc_('AVISO · Lesiones: ' + e); }
  try { logc_('OK · Motor: ' + prepararMotor_()); } catch (e) { logc_('AVISO · Motor: ' + e); }
  logc_('OK · Estímulos sembrados: ' + sembrarEstimulos_() + ' (0 = ya estaban)');
  logc_('OK · Biblioteca Z6–Z8 y sesiones Q: ' + sembrarBiblioteca_() + ' sesiones nuevas (0 = ya estaban)');
  logc_('OK · Metas nuevas de competición (Z6–Z8 integrado, DU, front squat, burpees, hang snatch/clean): ' + sembrarMetasV12_());
  logc_('OK · «Integrar con» y «Cómo mejorarlo» rellenados en ' + sembrarGuiaMetas_() + ' metas (solo celdas vacías)');
  if (!leerConfig_().resumen_auto) ponerConfig_('resumen_auto', 'Sí', 'Correo con los estímulos de la semana al aprobarla (Sí/No)');
  logc_('OK · «Datos a registrar» sin pulsómetro fuera de la carrera: ' + limpiarDatosRegistrar_() + ' estímulos');
  if (!leerConfig_().peso_kg) ponerConfig_('peso_kg', '90', 'Tu peso para las pautas de combustible e hidratación (kg)');
  try { subirEventosACal_(); sincronizarCalendario(); logc_('OK · Google Calendar: ' + calendario_().getName()); } catch (e) { logc_('AVISO · Calendar: ' + e); }
  try { logc_('OK · Reels de datos: ' + ideasReels_().length + ' ideas con bloque asociable'); } catch (e) { logc_('AVISO · Reels: ' + e); }
  logc_('OK · Metas migradas desde Semana/Mes: ' + migrarMetas_() + ' (0 = ya estaban)');
  logc_('OK · Tests pasados a APP · EVENTOS: ' + migrarTestsAEventos_() + ' (0 = ya estaban)');
  try { logc_('OK · Manual v2.0: ' + aplicarManualV2_()); } catch (e) { logc_('AVISO · Manual v2.0: ' + e); }
  try { var aud = auditarProtocolosMes_(); logc_(aud.length ? 'AVISO · Meses sin algún P: ' + aud.map(function (x) { return x.mes + ' (falta ' + x.faltan.join(', ') + ')'; }).join(' · ') : 'OK · Plan de carrera: todos los meses tienen P1, P2, P3 y P4'); } catch (e) { logc_('AVISO · Auditoría de P: ' + e); }
  ['objetivo_2km', 'objetivo_10km'].forEach(function (k) {     // «45:00» se había convertido en 45 horas: se guarda como texto
    var x = listar_(HOJAS.CONFIG).filter(function (r) { return r.CLAVE === k; })[0];
    if (x && /^\d+:\d{2}:00$/.test(x.VALOR)) actualizarFila_(HOJAS.CONFIG, x._fila, { VALOR: x.VALOR.replace(/:00$/, '') });
  });
  analizarCarrera_();
  var est = estructura_(fabrik_());
  logc_('OK · Fabrik: ' + est.semanas.length + ' semanas leídas · erratas: ' + est.erratas.length);
  try { pintarHojaSemana_(lunesDe_(hoyIso_())); logc_('OK · Pestaña «APP · SEMANA EN BLOQUES» pintada'); } catch (e) { logc_('AVISO · Semana en bloques: ' + e); }
  try { pintarResumen_(); logc_('OK · Pestaña «APP · RESUMEN» pintada (mismos % que la app)'); } catch (e) { logc_('AVISO · Resumen: ' + e); }
  logc_('OK · Pestañas visibles: ' + ordenarHojas_() + ' · las internas de la app quedan ocultas');
  logc_('OK · Pestañas de la app: ' + Object.keys(HOJAS).map(function (k) { var sh = miLibro_().getSheetByName(HOJAS[k]); return sh ? sh.getName() : HOJAS[k] + ' (se crea al usarla)'; }).join(', '));
  try { logc_('OK · Base de datos Vídeos: ' + prepararVideos_()); } catch (e) { logc_('AVISO · Base de datos Vídeos: ' + e); }
}

// ===================== FABRIK: ESTRUCTURA POR POSICIÓN (copiado de la app de Gabi, solo lectura) =====================
function estructura_(ss) {
  var hojas = ss.getSheets();
  var erratas = [];
  var hojaCiclo = hojas[0];
  var celdasCiclo = hojaCiclo ? hojaCiclo.getDataRange().getDisplayValues() : [];
  var ciclo = parsearCiclo(celdasCiclo, '0000-00-00');
  var inicio = ciclo && ciclo.fases.length ? ciclo.fases[0].inicio : null;

  // fechas del ciclo coherentes
  if (ciclo) ciclo.fases.forEach(function (f, i) {
    var lin = String((celdasCiclo[0] || [])[i + 1] || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var fechas = lin.map(fechaIsoLarga).filter(Boolean);
    var finEsperado = f.inicio ? sumarDias(f.inicio, f.semanas * 7 - 1) : null;
    if (fechas[1] && finEsperado && fechas[1] !== finEsperado)
      erratas.push('Pestaña "' + hojaCiclo.getName() + '": la fase ' + f.nombre + ' termina el ' + isoAFecha(fechas[1]) +
        ', pero con ' + f.semanas + ' semanas debería terminar el ' + isoAFecha(finEsperado) + '.');
    var sig = ciclo.fases[i + 1];
    if (sig && sig.inicio && f.fin && sig.inicio !== sumarDias(f.fin, 1))
      erratas.push('Pestaña "' + hojaCiclo.getName() + '": la fase ' + sig.nombre + ' empieza el ' + isoAFecha(sig.inicio) +
        ' y la anterior termina el ' + isoAFecha(f.fin) + '.');
  });

  var semanas = [], i = 1, k = 0;
  while (i < hojas.length) {
    var h = hojas[i], nombre = h.getName().trim();
    // Variante de una semana: "26/10/2026 BADAJOZ" (misma fecha que una semana ya leída + un nombre).
    // No cuenta como semana nueva: se muestra como desplegable dentro de cada día/bloque de esa semana.
    var mV = nombre.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)$/);
    if (mV) {
      var base = semanas.filter(function (s) { return fechaIso(s.nombre) === fechaIso(mV[1]); })[0];
      if (base) {
        (base.variantes = base.variantes || []).push({ nombre: mV[2].trim(), hoja: h });
        i++;
        // si la variante trae sus propias NOTAS, también se saltan
        if (hojas[i] && /^NOTAS\b/i.test(hojas[i].getName().trim()) && norm(hojas[i].getName()).indexOf(norm(mV[2])) >= 0) i++;
        continue;
      }
      erratas.push('La pestaña "' + nombre + '" parece una versión especial, pero no hay ninguna semana "' + mV[1] + '" delante.');
      i++; continue;
    }
    if (/^NOTAS\b/i.test(nombre)) {
      erratas.push('La pestaña "' + nombre + '" (posición ' + (i + 1) + ') no tiene delante su semana de programación.');
      i++; continue;
    }
    var notas = hojas[i + 1] && /^NOTAS\b/i.test(hojas[i + 1].getName().trim()) ? hojas[i + 1] : null;
    var lunes = inicio ? sumarDias(inicio, 7 * k) : fechaIso(nombre);
    var sem = { k: k, id: String(h.getSheetId()), nombre: nombre, hoja: h, notas: notas, iso: lunes };
    semanas.push(sem);

    var fechaNombre = fechaIso(nombre);
    if (lunes && fechaNombre !== lunes)
      erratas.push('La pestaña "' + nombre + '" es la semana ' + (k + 1) + ' del ciclo (lunes ' + isoAFecha(lunes) +
        '). Su nombre debería ser ' + isoAFecha(lunes) + '.');
    if (!notas) erratas.push('Falta la pestaña de NOTAS justo después de "' + nombre + '".');
    else if (norm(notas.getName()).replace(/\s+/g, ' ').trim() !== 'NOTAS ' + norm(nombre))
      erratas.push('La pestaña de notas "' + notas.getName() + '" no coincide con su semana "' + nombre + '" (debería llamarse "NOTAS ' + nombre + '").');

    var cab = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getDisplayValues()[0].map(function (x) { return norm(x).trim(); });
    var faltan = DIAS.slice(0, 6).filter(function (d) { return cab.indexOf(d) < 0; });
    if (faltan.length) erratas.push('En "' + nombre + '" no encuentro la columna de: ' + faltan.join(', ') + '.');

    i += notas ? 2 : 1; k++;
  }
  if (!inicio) erratas.push('No encuentro la fecha de inicio del ciclo en la primera pestaña ("' + (hojaCiclo ? hojaCiclo.getName() : '?') + '").');
  return { ciclo: celdasCiclo, semanas: semanas, erratas: erratas };
}

function isoAFecha(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '?'; }

// ===================== PARSER DE FABRIK (funciones puras, copiadas de la app de Gabi) =====================
function fechaIso(txt) {
  var m = String(txt).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  var y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

function sumarDias(iso, n) {
  var d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function norm(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function construirSemana(celdasSem, celdasNotas, celdasCiclo, nombre, isoLunes) {
  var cab = (celdasSem[0] || []).map(norm);
  var notasCab = (celdasNotas[0] || []);
  var notasCuerpo = (celdasNotas[1] || []);
  var dias = [];

  cab.forEach(function (h, col) {
    var idx = DIAS.indexOf(h.trim());
    if (idx < 0) return;
    var texto = (celdasSem[1] || [])[col] || '';
    if (!texto.trim()) return;
    // columna de notas del mismo día
    var nCol = -1;
    notasCab.forEach(function (t, c) { if (norm(t).split('\n')[0].trim() === DIAS[idx]) nCol = c; });
    var dia = {
      nombre: DIAS[idx],
      iso: sumarDias(isoLunes, idx),
      foco: nCol >= 0 ? extraerFoco(notasCab[nCol]) : [],
      bloques: parsearBloques(texto)
    };
    asignarNotas(dia, nCol >= 0 ? notasCuerpo[nCol] : '');
    dia.rpe = rpeDia(dia, texto);
    dias.push(dia);
  });

  return estimarRpes_({ semana: nombre, lunes: isoLunes, ciclo: parsearCiclo(celdasCiclo, isoLunes), dias: dias, videosSemana: parsearVideosFila(celdasSem[2] || []) });
}

/**
 * Compara una versión especial (p. ej. "26/10/2026 BADAJOZ") con la semana normal, día a día y bloque a bloque,
 * y deja SOLO lo que cambia:
 *   bloque.variantes = [{ nombre, tipo: 'cambia'|'sustituye'|'quita', titulo?, partes: [...], quitadas: [...] }]
 *   dia.variantesExtra = [{ nombre, bloque }]   (bloques de la versión que no encajan con ninguno normal)
 */
function esRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function aplicarVariante(semana, nombre, celdas) {
  var cab = (celdas[0] || []).map(norm);
  var limpio = function (s) { return norm(s).replace(/\s+/g, ' ').trim(); };
  var tituloSin = function (t) { return limpio(t).replace(new RegExp('\\b' + esRe(limpio(nombre)) + '\\b', 'g'), '').replace(/\s+/g, ' ').trim(); };
  var textoBloque = function (b) { return limpio(b.titulo) + '|' + b.partes.map(function (p) { return limpio(p.etiqueta) + '#' + limpio(p.texto); }).join('|'); };
  var letra = function (et) { return limpio(String(et).split(' · ')[0]); };

  semana.dias.forEach(function (dia) {
    var col = cab.map(function (h) { return h.trim(); }).indexOf(dia.nombre);
    if (col < 0) return;
    var vb = parsearBloques((celdas[1] || [])[col] || '');
    if (!vb.length) return;
    vb.forEach(function (b) {
      b.titulo = b.titulo.replace(new RegExp('\\s*\\b' + esRe(nombre) + '\\b', 'i'), '').trim() || b.titulo;
      // título partido en dos líneas ("2: STRONGMAN/GIMNASTICS" + "METCON")
      var p0 = b.partes[0];
      if (p0 && !p0.etiqueta) {
        var ls = p0.texto.split('\n');
        if (ls.length > 2 && ls[0].trim() && !ls[1].trim() && ls[0].trim().length <= 24 && !/\d/.test(ls[0])) {
          b.titulo += ' ' + ls[0].trim();
          p0.texto = recortar(ls.slice(1).join('\n'));
        }
      }
    });

    var normales = dia.bloques, par = {}, usadoN = {};
    // 1) mismo título
    vb.forEach(function (v, j) {
      normales.forEach(function (b, i) {
        if (par[j] === undefined && !usadoN[i] && tituloSin(b.titulo) === tituloSin(v.titulo)) { par[j] = i; usadoN[i] = 1; }
      });
    });
    // 2) título parecido (p. ej. POWER CLEAN ↔ SQUAT CLEAN)
    vb.forEach(function (v, j) {
      if (par[j] !== undefined) return;
      var mejor = -1, pm = 0;
      normales.forEach(function (b, i) { if (!usadoN[i]) { var p = puntuar(v.titulo, b); if (p > pm) { pm = p; mejor = i; } } });
      if (mejor >= 0) { par[j] = mejor; usadoN[mejor] = 1; }
    });
    // 3) mismo número de bloque (un bloque que sustituye a otro)
    vb.forEach(function (v, j) {
      if (par[j] !== undefined) return;
      normales.forEach(function (b, i) { if (par[j] === undefined && !usadoN[i] && b.n === v.n) { par[j] = i; usadoN[i] = 1; v.sustituye = true; } });
    });

    var hay = false;
    vb.forEach(function (v, j) {
      var i = par[j];
      if (i === undefined) { (dia.variantesExtra = dia.variantesExtra || []).push({ nombre: nombre, bloque: v }); hay = true; return; }
      var b = normales[i];
      if (textoBloque(b) === textoBloque(v)) return; // idéntico
      hay = true;
      if (v.sustituye) {
        (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'sustituye', titulo: v.titulo, partes: v.partes, quitadas: [] });
        return;
      }
      // partes: se emparejan por su letra (A, B, B.2, C…) y orden de aparición
      var claves = function (lista) {
        var vistos = {};
        return lista.map(function (p) { var k = letra(p.etiqueta) || '_'; vistos[k] = (vistos[k] || 0) + 1; return k + '#' + vistos[k]; });
      };
      var kn = claves(b.partes), kv = claves(v.partes);
      var partes = [];
      v.partes.forEach(function (p, x) {
        var y = kn.indexOf(kv[x]);
        if (y < 0) partes.push({ etiqueta: p.etiqueta, tipo: p.tipo, texto: p.texto, cambio: 'nueva' });
        else if (limpio(b.partes[y].texto) !== limpio(p.texto) || limpio(b.partes[y].etiqueta) !== limpio(p.etiqueta))
          partes.push({ etiqueta: p.etiqueta, tipo: p.tipo, texto: p.texto, cambio: 'cambia' });
      });
      var quitadas = b.partes.filter(function (p, y) { return kv.indexOf(kn[y]) < 0 && p.tipo !== 'adapt'; }).map(function (p) { return p.etiqueta || 'Parte sin título'; });
      if (b.partes.length && quitadas.length === b.partes.filter(function (p) { return p.tipo !== 'adapt'; }).length && partes.length === v.partes.length) {
        // no comparten ninguna parte: es otro bloque distinto en su lugar
        (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'sustituye', titulo: v.titulo, partes: v.partes, quitadas: [] });
        return;
      }
      (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'cambia',
        titulo: tituloSin(b.titulo) !== tituloSin(v.titulo) ? v.titulo : '', partes: partes, quitadas: quitadas });
    });
    // bloques normales que la versión no hace
    normales.forEach(function (b, i) {
      if (usadoN[i]) return;
      hay = true;
      (b.variantes = b.variantes || []).push({ nombre: nombre, tipo: 'quita', partes: [], quitadas: [] });
    });
    if (hay) (dia.variantesNombres = dia.variantesNombres || []).push(nombre);
  });
  (semana.variantes = semana.variantes || []).push(nombre);
  return semana;
}

function parsearBloques(texto) {
  var lineas = String(texto).replace(/\r/g, '').split('\n');
  var bloques = [], b = null, p = null, previaVacia = true;
  function nuevaParte(etiqueta, tipo) {
    p = { etiqueta: etiqueta, tipo: tipo, lineas: [] };
    b.partes.push(p);
  }
  lineas.forEach(function (raw) {
    var l = raw.replace(/\s+$/, '');
    // «1: POWER CLEAN», «1. POWER SNATCH», «1, …», «1) …» o «1 POWER CLEAN» (sin signo solo si sigue la numeración y va tras una línea vacía)
    var mB = l.match(/^\s*(\d{1,2})\s*[:.,;)\-–]\s*([A-ZÁÉÍÓÚÑa-z].*)$/);
    if (!mB && previaVacia) {
      var m0 = l.match(/^\s*(\d{1,2})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 +&\/\-]{2,})$/);
      var sig = bloques.filter(function (x) { return x.n > 0; }).length + 1;
      if (m0 && Number(m0[1]) === sig && !/^(SETS?|SERIES|RONDAS?|ROUNDS?|REPS?|X|M|MIN|CAL|KG|SEG)\b/.test(norm(m0[2]))) mB = m0;
    }
    previaVacia = !l.trim();
    if (mB) {
      b = { n: Number(mB[1]), titulo: mB[2].trim(), partes: [] };
      bloques.push(b); p = null; return;
    }
    if (!b) { b = { n: 0, titulo: '', partes: [] }; bloques.push(b); }
    // "A) MEJORA RANGO…" es un apartado; "A) 20+20M CARRY" es un ejercicio de una serie alterna
    var mP = l.match(/^\s*([A-Z](?:\.\d)?)\)\s*([A-ZÁÉÍÓÚÑa-z].*)$/);
    if (mP) {
      var et = mP[1] + ' · ' + mP[2].trim();
      var t = RE_PREP_.test(norm(mP[2])) ? 'prep' : 'main';
      nuevaParte(et, t); return;
    }
    if (/^\s*ADAPTACIONES\s*$/.test(norm(l))) { nuevaParte('Adaptaciones', 'adapt'); return; }
    if (!p) nuevaParte('', 'main');
    p.lineas.push(l);
  });
  bloques.forEach(function (bl) {
    bl.partes = bl.partes.map(function (pt) {
      return { etiqueta: pt.etiqueta, tipo: pt.tipo, texto: recortar(pt.lineas.join('\n')) };
    }).filter(function (pt) { return pt.texto || pt.etiqueta; });
  });
  return bloques.filter(function (bl) { return bl.titulo || bl.partes.length; });
}

function recortar(s) {
  return s.replace(/^\s*\n+/, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

function extraerFoco(celda) {
  var lineas = String(celda || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  lineas = lineas.slice(1); // nombre del día
  if (lineas.length && /OBJETIVO/.test(norm(lineas[0]))) lineas = lineas.slice(1);
  var inicio = /^(TRABAJO|METCON|DOBLE|ACCES|RESISTENCIA|RECOVERY|FRONT SQUAT|BACK SQUAT|SKILLS|ENDURANCE)/;
  var items = [];
  lineas.forEach(function (l) {
    if (!items.length || inicio.test(norm(l))) items.push(l);
    else items[items.length - 1] += ' ' + l;
  });
  return items;
}

var SINONIMOS = { BANCA: 'BENCH', PUSH: 'PRESS', ACCESORIOS: 'ACCES', ACCESSORIOS: 'ACCES', ACCESORIES: 'ACCES',
  ACCESSORIES: 'ACCES', MUSTLE: 'MUSCLE', CONTRASTE: 'CONTRAST', GIMNASTICS: 'GYMNASTICS', GIMNASTICOS: 'GYMNASTICS', GIMNASIA: 'GYMNASTICS',
  ACTIVACION: 'ACTIVATION', MOVILIDAD: 'MOBILITY', CALENTAMIENTO: 'WARM', HALTEROFILIA: 'WEIGHTLIFTING', ARRANCADA: 'SNATCH', CARGADA: 'CLEAN',
  SENTADILLA: 'SQUAT', ENVION: 'JERK', DOMINADAS: 'PULL', RESISTENCIA: 'ENDURANCE', HABILIDADES: 'SKILLS', TECNICA: 'SKILLS' };
/** Fabrik en inglés o en español da igual: el texto se lee en los dos idiomas (original + traducción a los nombres en inglés). */
var ES_EN = [[/ARRANCADA DE POTENCIA|ARRANCADA POWER/g, 'POWER SNATCH'], [/CARGADA DE POTENCIA|CARGADA POWER/g, 'POWER CLEAN'], [/ARRANCADA/g, 'SNATCH'], [/CARGADA Y (ENVION|JERK)/g, 'CLEAN AND JERK'],
  [/CARGADA/g, 'CLEAN'], [/ENVION (PARTIDO|EN TIJERA)|JERK PARTIDO/g, 'SPLIT JERK'], [/ENVION/g, 'JERK'], [/SENTADILLA TRASERA/g, 'BACK SQUAT'], [/SENTADILLA (FRONTAL|DELANTERA)/g, 'FRONT SQUAT'],
  [/SENTADILLA (POR )?ENCIMA DE LA CABEZA|SENTADILLA OVERHEAD/g, 'OVERHEAD SQUAT'], [/SENTADILLA BULGARA/g, 'BULGARIAN SPLIT SQUAT'], [/SENTADILLAS?/g, 'SQUAT'], [/PESO MUERTO/g, 'DEADLIFT'],
  [/PRESS (DE )?BANCA/g, 'BENCH PRESS'], [/PRESS MILITAR|PRESS ESTRICTO/g, 'STRICT PRESS'], [/DOMINADAS? (AL PECHO|PECHO A BARRA)/g, 'CHEST TO BAR'], [/DOMINADAS?/g, 'PULL UP'], [/FONDOS?/g, 'DIP'],
  [/ZANCADAS?/g, 'LUNGE'], [/SALTOS? AL CAJON/g, 'BOX JUMP'], [/SALTOS? DE COMBA DOBLES|DOBLES DE COMBA|\bDOBLES\b/g, 'DOUBLE UNDER'], [/TRIPLES/g, 'TRIPLE UNDER'], [/PINO/g, 'HANDSTAND'],
  [/FLEXIONES (EN|DE) PINO/g, 'HSPU'], [/SUBIDAS? A LA CUERDA|CUERDA/g, 'ROPE CLIMB'], [/MUSCLE UP EN ANILLAS|MUSCLE UPS? ANILLAS/g, 'RING MUSCLE UP'], [/MUSCLE UP EN BARRA/g, 'BAR MUSCLE UP'],
  [/PIES A (LA )?BARRA/g, 'T2B'], [/REMO\b/g, 'ROW'], [/BICI(CLETA)? DE AIRE|ASSAULT/g, 'AIR BIKE'], [/CARRERA|CORRER/g, 'RUN'], [/LANZAMIENTOS? A PARED|BALON MEDICINAL/g, 'WALL BALL'],
  [/PLANCHA LATERAL/g, 'SIDE PLANK'], [/PLANCHA/g, 'PLANK'], [/TRINEO/g, 'SLED'], [/CALENTAMIENTO/g, 'WARM UP'], [/ACTIVACION/g, 'ACTIVATION'], [/MOVILIDAD/g, 'MOBILITY'],
  [/HALTEROFILIA/g, 'WEIGHTLIFTING'], [/GIMNASTICOS?|GIMNASIA/g, 'GYMNASTICS'], [/ACCESORIOS?/g, 'ACCESSORIES'], [/MANCUERNAS?/g, 'DB'], [/KETTLEBELLS?|PESAS RUSAS?/g, 'KB'],
  [/SACO( DE ARENA)?/g, 'SANDBAG'], [/EMPUJE DE CADERA/g, 'HIP THRUST'], [/CADA (\d+)/g, 'EVERY $1'], [/SERIES/g, 'SETS'], [/RONDAS/g, 'ROUNDS'], [/DESCANSO/g, 'REST']];
function bilingue_(t) { var n = norm(t), e = n; ES_EN.forEach(function (x) { e = e.replace(x[0], x[1]); }); return e === n ? n : n + '\n' + e; }
var VACIAS = { DE: 1, LA: 1, EL: 1, Y: 1, CON: 1, TRABAJO: 1, A: 1, B: 1, C: 1, WEIGHLIFTING: 1, STRENGHT: 1, STRENGTH: 1, FUERZA: 1, PARA: 1, LOS: 1, LAS: 1, EN: 1 };

function tokens(s) {
  return norm(s).split(/[^A-Z0-9]+/).filter(function (t) { return t.length >= 2 && !VACIAS[t]; })
    .map(function (t) { return SINONIMOS[t] || t; });
}

function parecido(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  var n = Math.min(a.length, b.length, 6);
  return a.slice(0, n) === b.slice(0, n);
}

function puntuar(titulo, bloque) {
  var tb = tokens(bloque.titulo + ' ' + bloque.partes.map(function (p) { return p.etiqueta; }).join(' '));
  return tokens(titulo).filter(function (t) { return tb.some(function (x) { return parecido(t, x); }); }).length;
}

var CAMPOS_METCON = [['WOD MATERIAL', 'material'], ['INTENSIDAD', 'intensidad'], ['CARGA', 'carga'], ['NOTAS', 'notas'],
  ['OBJETIVO', 'objetivo'], ['MODALIDAD WOD', 'formato'], ['MODALIDAD', 'modalidad'], ['LIMITANTE', 'limitantes']];

function asignarNotas(dia, celda) {
  var lineas = String(celda || '').replace(/\r/g, '').split('\n');
  var secciones = [], actual = null, previaVacia = true;
  lineas.forEach(function (raw) {
    var l = raw.trim();
    if (!l) { previaVacia = true; if (actual) actual.lineas.push(''); return; }
    var esTitulo = previaVacia && l.length <= 32 && l.indexOf(':') < 0 && l.split(/\s+/).length <= 4 &&
      (/^(METCON|ACCES|SKILLS)/.test(norm(l)) || dia.bloques.some(function (b) { return puntuar(l, b) > 0; }));
    previaVacia = false;
    if (esTitulo) { actual = { titulo: l, lineas: [] }; secciones.push(actual); return; }
    if (!actual) { actual = { titulo: '', lineas: [] }; secciones.push(actual); }
    actual.lineas.push(l);
  });

  var usados = {};
  dia.notasDia = [];
  secciones.forEach(function (s) {
    var mejor = null, pMejor = 0;
    if (s.titulo) dia.bloques.forEach(function (b, i) {
      var p = puntuar(s.titulo, b) - (usados[i] ? 0.5 : 0) - b.titulo.length / 1000;
      if (p > pMejor) { pMejor = p; mejor = i; }
    });
    var texto = recortar(s.lineas.join('\n'));
    if (mejor === null || pMejor <= 0) { if (texto) dia.notasDia.push({ titulo: s.titulo, texto: texto }); return; }
    usados[mejor] = true;
    var b = dia.bloques[mejor];
    var campos = /METCON/.test(norm(s.titulo)) ? parsearCampos(texto) : null;
    if (campos && Object.keys(campos.wod).length) {
      b.wod = campos.wod;
      if (campos.resto) b.nota = (b.nota ? b.nota + '\n\n' : '') + campos.resto;
      var r = (b.wod.intensidad || '').match(/RPE\s*([\d/,.]+)/i);
      if (r) b.rpe = r[1];
    } else {
      b.nota = (b.nota ? b.nota + '\n\n' : '') + texto;
    }
  });
}

function parsearCampos(texto) {
  var wod = {}, campo = null, resto = [];
  texto.split('\n').forEach(function (l) {
    var n = norm(l), hallado = null;
    for (var i = 0; i < CAMPOS_METCON.length; i++) {
      var c = CAMPOS_METCON[i][0];
      if (n.indexOf(c) === 0 && /^\s*:/.test(n.slice(c.length))) { hallado = CAMPOS_METCON[i]; break; }
    }
    if (hallado) {
      campo = hallado[1];
      wod[campo] = l.slice(l.indexOf(':') + 1).trim();
    } else if (campo) {
      wod[campo] = (wod[campo] ? wod[campo] + '\n' : '') + l;
    } else resto.push(l);
  });
  Object.keys(wod).forEach(function (k) { wod[k] = recortar(wod[k]); });
  return { wod: wod, resto: recortar(resto.join('\n')) };
}

function rpeDia(dia, texto) {
  if (/ZONA\s*2|\bZ2\b|RECOVERY/.test(norm(dia.foco ? dia.foco.join(' ') : '')) && !dia.bloques.some(esMetconB_)) return 'Z2';
  var met = dia.bloques.filter(esMetconB_);
  for (var i = 0; i < met.length; i++) {
    if (met[i].rpe) return met[i].rpe;
    var m = norm(met[i].partes.map(function (p) { return p.texto; }).join('\n') + '\n' + (met[i].nota || '')).match(/RPE\s*(\d+(?:\/\d+)?)/);
    if (m) return m[1];
  }
  if (/ZONA\s*2|\bZ2\b/.test(norm(texto))) return 'Z2';
  return null;   // se estima después comparando los días de la semana (estimarRpes_)
}
function esMetconB_(b) { return /METCON|\bWOD\b|ACONDICIONAMIENTO|CONDITIONING/.test(norm(b.titulo)) || b.partes.some(function (p) { return /^\s*METCON\s*:/.test(norm(p.texto)); }); }
/** Minutos aproximados de un metcon a partir de su formato (TIME CAP 15′, AMRAP 7′, EVERY 4′ X 4, EMOM 10′, 3′ ON X 1′ OFF…). */
function minutosMetcon_(txt) {
  var t = norm(txt).replace(/[´’′]/g, "'"), tot = 0, m;
  var re = /(?:TIME\s*CAP|AMRAP|EMOM|E\dMOM)\s*(\d+)\s*'/g;
  while ((m = re.exec(t))) tot += +m[1];
  var ev = /EVERY\s*(\d+)\s*'\s*(\d+)?\s*"?\s*X\s*(\d+)/g;
  while ((m = ev.exec(t))) tot += (+m[1] + (+m[2] || 0) / 60) * +m[3];
  var on = t.match(/(\d+)\s*SETS[\s\S]{0,20}?(\d+)\s*'\s*ON\s*X\s*(\d+)\s*'\s*OFF/) || t.match(/AMRAP\s*(\d+)\s*SETS[\s\S]{0,20}?(\d+)\s*'\s*ON\s*X\s*(\d+)/);
  if (on) tot += +on[1] * (+on[2] + +on[3]);
  if (!tot) { var s = t.match(/(\d+)\s*SETS/); tot = s ? Math.min(25, +s[1] * 3) : 12; }
  return Math.min(40, tot);
}
/**
 * RPE del día = el del metcon. Si Gabi no lo pone, se estima comparando los días de la semana:
 * carga declarada en las notas (BAJA → EXIGENTE/MÁXIMA), duración del metcon, nº de bloques y si hay un segundo metcon/erg.
 * Se marca con «≈» para que se vea que es una estimación.
 */
function estimarRpes_(sem) {
  var NIV = [[/MAXIMA|MUY ALTA/, 3], [/EXIGENTE|ALTA/, 2.5], [/MODERADA/, 2], [/MEDIA/, 1.5], [/BAJA|LIGERA|SUAVE/, 1]];
  (sem.dias || []).forEach(function (d) {
    if (d.rpe) return;
    var met = d.bloques.filter(esMetconB_);
    if (!met.length) return;
    var carga = 1.5;
    met.forEach(function (b) { var c = norm((b.wod && (b.wod.carga || b.wod.intensidad)) || ''); for (var i = 0; i < NIV.length; i++) if (NIV[i][0].test(c)) { carga = Math.max(carga, NIV[i][1]); break; } });
    var dur = minutosMetcon_(met[0].partes.map(function (p) { return p.texto; }).join('\n'));
    var r = 5 + (carga - 1) * 1.2 + Math.min(2, dur / 12) + (met.length > 1 ? 0.5 : 0) + (d.bloques.length >= 4 ? 0.2 : 0);
    d.rpe = '≈' + Math.max(5, Math.min(9, Math.round(r)));
    d.rpeEstimado = true;
  });
  return sem;
}

function parsearCiclo(celdas, isoLunes) {
  if (!celdas.length) return null;
  var fases = [];
  (celdas[0] || []).forEach(function (t, c) {
    if (c === 0 || !String(t).trim()) return;
    var lin = String(t).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var f = lin.map(fechaIsoLarga).filter(Boolean);
    var semanas = parseInt((lin.join(' ').match(/(\d+)\s*SEMANAS/i) || [])[1], 10) || 4;
    var inicio = f[0] || null;
    var fin = f[1] && inicio && f[1] > inicio ? f[1] : (inicio ? sumarDias(inicio, semanas * 7 - 1) : null);
    fases.push({ nombre: lin[0], semanas: semanas, inicio: inicio, fin: fin, objetivos: recortar(String((celdas[1] || [])[c] || '')) });
  });
  var actual = -1, semana = null;
  fases.forEach(function (f, i) {
    if (f.inicio && f.fin && isoLunes >= f.inicio && isoLunes <= f.fin) {
      actual = i;
      semana = Math.floor((Date.parse(isoLunes) - Date.parse(f.inicio)) / 864e5 / 7) + 1;
    }
  });
  return { fases: fases, actual: actual, semana: semana };
}

function fechaIsoLarga(l) {
  return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(l) ? fechaIso(l) : null;
}

function parsearVideosFila(fila) {
  var out = [];
  fila.forEach(function (celda) {
    var lin = String(celda || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    for (var i = 0; i < lin.length - 1; i++) {
      if (!/^https?:\/\//.test(lin[i]) && /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(lin[i + 1])) {
        out.push({ nombre: lin[i], url: lin[i + 1] }); i++;
      }
    }
  });
  return out;
}

// =====================================================================================================
//  v0.9 · CARGA DE FABRIK EN EL PLAN · EXTRAS AUTOMÁTICOS · REFUERZOS · POSICIÓN ÓPTIMA · GRABACIÓN ·
//         GOOGLE CALENDAR · NOTAS POR BLOQUE · WODS DE REFERENCIA · AVISOS VISTOS
// =====================================================================================================
HOJAS.ESTIMULOS = 'APP · ESTÍMULOS'; HOJAS.REFUERZOS = 'APP · REFUERZOS'; HOJAS.NOTAS = 'APP · NOTAS BLOQUE'; HOJAS.WODS = 'APP · WODS';
CONFIG.REELS_ID = '1M5t34kRDWRoGakKYlRV_MxK_0Q4u8KGhXISUGh-sB00';   // «Reels de datos — @pabloserlop» · SOLO LECTURA
ESQUEMA['APP · PLAN'].cab.push('GENERADO', 'PENDIENTE_ID', 'REFUERZO_ID'); ESQUEMA['APP · PLAN'].anchos.push(120, 80, 80);
ESQUEMA['APP · PLAN'].listas.ESTADO.push('SIN HUECO');
ESQUEMA['APP · SEMANAS'].cab.push('BALANCE ESTÍMULOS'); ESQUEMA['APP · SEMANAS'].anchos.push(520);
/** Añade una columna al final si falta (para no tener que volver a ejecutar «configurar» tras cada versión). */
function asegurarColumna_(nombre, col) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  if (cab.indexOf(col) >= 0) return;
  if (sh.getMaxColumns() <= cab.length) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
  sh.getRange(1, cab.length + 1).setValue(col).setBackground('#121212').setFontColor('#ffffff').setFontWeight('bold');
  delete CAB_[nombre];
}
ESQUEMA['APP · EVENTOS'].cab.push('GCAL_ID', 'ORIGEN CAL'); ESQUEMA['APP · EVENTOS'].anchos.push(160, 90);
ESQUEMA['APP · ESTÍMULOS'] = {
  cab: ['CÓDIGO', 'NOMBRE', 'DETECTAR (regex)', 'ORIGEN', 'TURNO', 'MIN', 'INTENSIDAD', 'CONTENIDO', 'POR QUÉ (cursiva)', 'CIENCIA (técnica · fisiología · biología)', 'INTERFERENCIAS', 'CARGA', 'EVITAR', 'DATOS A REGISTRAR', 'ACTIVO'],
  anchos: [70, 200, 220, 90, 60, 50, 90, 320, 260, 340, 260, 140, 140, 220, 60], cursiva: 'POR QUÉ (cursiva)', negrita: 'NOMBRE', congelarCol: 2,
  listas: { ORIGEN: ['EXTRA', 'CARRERA', 'Z6–Z8', 'TÉCNICA', 'MOVILIDAD'], TURNO: ['AM', 'PM', 'AM|PM'], ACTIVO: ['Sí', 'No'] }
};
ESQUEMA['APP · REFUERZOS'] = {
  cab: ['ID', 'SEMANA', 'TEXTO', 'CÓDIGO', 'ESTADO', 'NOTAS', 'CREADO'], anchos: [70, 95, 260, 80, 110, 260, 120], fechas: ['SEMANA'],
  listas: { ESTADO: ['Pendiente', 'Programado', 'Hecho', 'Descartado'] }, colores: [['ESTADO', 'Pendiente', '#ffedcc']]
};
ESQUEMA['APP · NOTAS BLOQUE'] = {
  cab: ['FECHA', 'ID_PLAN', 'BLOQUE', 'MIS NOTAS', 'RECOMENDACIÓN', 'ACTUALIZADO'], anchos: [95, 110, 200, 360, 420, 120], fechas: ['FECHA']
};
ESQUEMA['APP · WODS'] = {
  cab: ['ID', 'NOMBRE', 'TIPO', 'FECHA ORIGEN', 'CONTENIDO', 'RESULTADO', 'NOTAS', 'CREADO'], anchos: [70, 200, 100, 95, 420, 110, 260, 120], fechas: ['FECHA ORIGEN'], negrita: 'NOMBRE',
  listas: { TIPO: ['Guardado', 'Referencia'], RESULTADO: ['Tiempo', 'Rondas + reps', 'Reps', 'Kilos', 'Calorías', 'Metros'] }
};

// ---------- 1 · Catálogo de estímulos (editable en APP · ESTÍMULOS; se siembra con estos valores) ----------
// Etiquetas de CARGA / EVITAR: PIERNA · HOMBRO (empuje/OH) · AGARRE (tirón/agarre) · CORE · IMPACTO (carrera/saltos) · SNC (neural alto) · GLUC (glucolítico) · AERO
var EST_BASE = [
  ['M61', 'Zancada con barra · front rack / back rack', 'FRONT RACK (WALKING |REVERSE )?LUNGE|BACK RACK (WALKING |REVERSE )?LUNGE|BARBELL (WALKING |REVERSE )?LUNGE|ZANCADA CON BARRA', 'EXTRA', 'PM', 8, '🟢 Calidad', '3×6+6 zancada atrás con barra (front rack o back rack) · RPE 7 · 90″. Si coincide con la búlgara, va en el mismo bloque.', 'Pierna unilateral con carga axial: transfiere a las OH lunges, al trineo y a la carrera.', 'Técnica: tronco vertical, rodilla trasera casi al suelo. Fisiología: glúteo y cuádriceps con estabilidad de tronco bajo carga axial; baja demanda nerviosa con RPE 7.', 'No el día antes de la calidad de carrera ni de pierna pesada.', 'PIERNA', 'PIERNA', 'Kg, rack (front/back) y reps por pierna'],
  ['M62', 'T2B estricto / Dragon flag', 'STRICT (T2B|TOES)|T2B ESTRICTO|TOES TO BAR ESTRICTO|DRAGON FLAG', 'EXTRA', 'PM', 8, '🟢 Calidad', '4×3–5 T2B estrictos (sin kip, bajada 2″) o dragon flag excéntrico 4–5″ · 90″', 'Fuerza estricta de core anterior y flexores de cadera: base para T2B y GHD en fatiga.', 'Técnica: hollow activo y escápulas deprimidas. Fisiología: fuerza excéntrica del recto abdominal con poco coste metabólico.', 'No antes de gimnásticos con kip en el metcon.', 'CORE', '', 'Variante, reps y segundos de bajada'],
  ['W17', 'HSPU estricto / facing', 'STRICT HSPU|FACING|DEFICIT STRICT|DÉFICIT STRICT', 'TÉCNICA', 'PM', 12, '🟢 Técnico', '4×3–5 strict HSPU (déficit si sale fácil) · RIR 2 · 2′ entre series', 'Fuerza estricta de empuje vertical: la base que luego aguanta el kipping en fatiga.', 'Técnica: línea cabeza-manos en trípode, codos a 45°. Fisiología: reclutamiento de unidades motoras de alto umbral en deltoides/tríceps con poco volumen. Biología: adaptación neural antes que hipertrófica.', 'Evitar el día de jerk/press pesado o con muchos HSPU en el metcon. No antes de anillas.', 'HOMBRO', 'HOMBRO', 'Reps por serie, déficit (cm) y RIR'],
  ['W15', 'HSPU kipping técnico', 'KIPPING HSPU', 'TÉCNICA', 'PM', 10, '🟢 Técnico', 'EMOM 8′: 3–5 kipping HSPU con reinicio controlado', 'Técnica de kipping fresca para que salga eficiente en el WOD.', 'Técnica: patada sincronizada con la extensión de codos. Fisiología: ciclo estiramiento-acortamiento del tren superior; poco coste metabólico si se corta antes de la fatiga.', 'No el mismo día que HSPU estricto pesado ni antes de jerk.', 'HOMBRO', 'HOMBRO', 'Reps por minuto y fallos'],
  ['W31', 'HSPU en fatiga', 'HSPU', 'TÉCNICA', 'PM', 0, '', '', '', '', '', 'HOMBRO GLUC', '', ''],
  ['W01', 'Z2 carrera · larga', 'Z2 LARGA', 'CARRERA', 'AM', 60, '🔵 Z2', '60′ continuos en Z2 (RPE 2–3, conversación). No acabar en tempo.', 'Base aeróbica: el rodaje largo es el estímulo más eficaz para mitocondrias y capilares.', 'Fisiología: volumen sostenido por debajo de VT1 aumenta densidad mitocondrial y capilarización con muy poca fatiga del SNC. Biología: señal AMPK/PGC-1α prolongada.', 'Aislada, idealmente 24 h sin pesas. Nunca el día después de pierna pesada ni antes de calidad.', 'IMPACTO AERO PIERNA', 'PIERNA SNC GLUC', 'km, tiempo, FC media, FC estable (min), sensaciones'],
  ['W02', 'Z2 carrera · corta', 'Z2 CORTA|ZONA 2', 'CARRERA', 'AM', 35, '🔵 Z2', '35′ continuos en Z2 (RPE 2–3)', 'Completa los 90′ semanales de Z2 sin fatiga.', 'Fisiología: estímulo aeróbico de baja intensidad, poca interferencia con la fuerza (vía mTOR intacta si hay >6 h).', 'AM, mejor antes del día de volumen de Fabrik; ≥6 h antes de pierna pesada.', 'IMPACTO AERO', 'SNC', 'km, tiempo, FC media'],
  ['W03', 'Ergómetro Z2', 'Z2 (BIKE|ROW|SKI)|ERG · AER', 'CARRERA', 'AM|PM', 25, '🔵 Z2', '20–30′ BikeErg/remo/ski en Z2', 'Volumen aeróbico sin impacto: suma Z2 cuidando tendones.', 'Fisiología: mismo estímulo central que la carrera (gasto cardiaco, mitocondria) con carga excéntrica casi nula.', 'Ideal como flush el día de pierna pesada o tras la sesión.', 'AERO', '', 'Aparato, minutos, ritmo/500 m o W'],
  ['W04', 'Calidad carrera (Z4/Z5)', 'CALIDAD', 'CARRERA', 'AM', 40, '🟠 Calidad', 'Ver plan de carrera de la semana', 'La sesión que mueve el umbral/VO₂max.', 'Fisiología: tiempo cerca de VT2/VO₂max eleva el umbral de lactato y el VO₂max. Biología: estrés que exige ≥48 h hasta la siguiente sesión dura.', '≥48 h de Z6–Z8. PM ese día: tren superior. Nunca tras pierna pesada.', 'IMPACTO SNC GLUC PIERNA', 'PIERNA SNC GLUC', 'Parciales, RPE, FC media y si cumpliste los ritmos'],
  ['R04', 'Z6–Z8 integrado (competición)', 'Z6.?Z8 INTEGRADO', 'Z6–Z8', 'PM', 25, '🔴 Z6–Z8', '2.ª sesión Z6–Z8 de la semana (P1/P4) con 2 movimientos de competición + calorías: la genera «Cargar extras» según lo que más falte.', 'Potencia en fatiga con enfoque de competición.', 'Fisiología: H⁺ y aclarado de lactato (MCT1/MCT4); adaptaciones centrales y periféricas.', '≥48 h de la calidad y del otro Z6–Z8; al día siguiente, suave.', 'GLUC SNC', 'GLUC', 'rondas o reps por minuto, calorías, tiempo de cada ronda, RPE'],
  ['C01', 'Double unders en fatiga', 'DOUBLE UNDER|(^|[^A-Z])DUS?([^A-Z]|$)', 'EXTRA', 'PM', 8, '🟠 Fatiga', '3 rondas: 12/10 cal bike + 40 DU sin fallo · 1′ entre rondas', 'DU limpios con pulsaciones altas, como en competición.', 'Técnica: muñeca relajada, salto bajo. Fisiología: coordinación bajo fatiga cardiorrespiratoria.', 'Suma impacto de gemelo/Aquiles.', 'IMPACTO GLUC', 'IMPACTO', 'DU por tanda, fallos'],
  ['C02', 'Front squat en metcon / fatiga', 'FRONT SQUAT', 'EXTRA', 'PM', 10, '🟠 Fatiga', 'EMOM 8′: 6 front squat (60/40) + 8/6 cal row', 'Front squat estable con pulsaciones altas (thrusters, cleans en metcon).', 'Técnica: codos altos y torso vertical. Fisiología: resistencia de cuádriceps y core en acidez.', 'No antes de pierna pesada ni de calidad de carrera.', 'PIERNA GLUC', 'PIERNA', 'kg, reps, RPE'],
  ['C03', 'Burpees a ritmo de competición', 'BURPEE', 'EXTRA', 'PM', 8, '🟠 Fatiga', 'EMOM 8′: 8 burpees over the bar + 6 cal ski', 'Ritmo de burpee sostenible en competición.', 'Fisiología: coste metabólico alto con movimiento de todo el cuerpo; economía de gesto.', '—', 'GLUC', '', 'reps por minuto'],
  ['C04', 'Snatch / clean desde colgado en fatiga', 'HANG (POWER |SQUAT )?(SNATCH|CLEAN)|HIGH HANG', 'EXTRA', 'PM', 10, '🟠 Fatiga', 'EMOM 8′: impar 5 hang power snatch (50/35) · par 12/10 cal bike', 'Barra eficiente desde colgado con fatiga (formato habitual de competición).', 'Técnica: barra cerca y recepción rápida. Fisiología: potencia repetida con aclarado entre minutos.', 'No antes de haltero pesado.', 'AGARRE GLUC SNC', 'AGARRE', 'kg, reps, velocidad'],
  ['V01', 'Sprints de velocidad', '[0-9]{2,3} ?M SPRINT|SPRINT [0-9]{2,3} ?M|FLYING [0-9]|ACELERACI|ACCELERATION|MAX VELOCITY|VELOCIDAD MAX', 'CARRERA', 'AM|PM', 20, '🔴 Velocidad', '10′ trote suave + movilidad dinámica\nTécnica: 2×20 m A-skip · 2×20 m B-skip · 2×20 m skipping rápido\n3 progresivos de 60 m (70–80–90 %)\n\n6 × 30 m SPRINT al 95–100 % (4 salidas de pie + 2 lanzadas con 20 m de carrerilla)\n/ 2′30″–3′ andando (recuperación completa)\n\n5′ trote suave\n\nREGLA: si la velocidad cae o notas el isquio, se corta. Nunca hasta el agotamiento.', 'Velocidad máxima y aceleración: sube tu techo de velocidad, así los ritmos de 2 km y 10 km y los sprints de HYROX o de un WOD te cuestan un % menor de tu máximo.', 'Técnica: apoyo bajo la cadera, rodilla alta y brazos activos. Fisiología: esfuerzos de 4–8″ alimentados por ATP-fosfocreatina; con 2–4′ de pausa la fosfocreatina se recupera casi entera y cada repetición sale a velocidad máxima (no es RSA). Biología: adaptación neural, más rigidez del tendón y mejor economía de carrera, con muy poca fatiga metabólica.', 'Siempre fresco y bien calentado: al inicio de la sesión o tras la Z2 corta. Nunca después de un metcon, de pierna pesada ni la víspera de la calidad de carrera. Riesgo principal: isquios.', 'IMPACTO PIERNA SNC', 'GLUC PIERNA', 'distancias, tiempos (o velocidad percibida 1–10), superficie, molestias'],
  ['R01', 'Potencia Z6–Z8', 'ALL[- ]OUT|(?<![0-9] ?M )SPRINT(?! [0-9]{2,3} ?M)|Z6|Z7|Z8', 'Z6–Z8', 'PM', 20, '🔴 Z6–Z8', 'Protocolo de la semana (plan de carrera)', 'Potencia y tolerancia a esfuerzos máximos cortos.', 'Fisiología: sistema fosfágeno y glucólisis rápida, reclutamiento máximo. Biología: alto coste neural; necesita recuperación completa entre reps.', '≥48 h de la calidad de carrera. Tras fuerza de cadena posterior/haltero o PM a ≥6 h de la Z2.', 'SNC GLUC', 'SNC GLUC', 'W pico y media por sprint, caída 1º→último'],
  ['W13', 'RMU técnica / fuerza estricta', 'RING MUSCLE|RMU', 'TÉCNICA', 'AM', 12, '🟢 Técnico', 'EMOM 8′: 1–2 strict RMU o transición en banda + 2 dips en anillas', 'Calidad en anillas antes de la fatiga.', 'Técnica: falso agarre y transición rápida. Fisiología: fuerza relativa de dorsal/pecho/tríceps a baja dosis.', 'Anillas por la mañana si es EXTRA y ≥6 h de otros tirones.', 'AGARRE HOMBRO', 'AGARRE', 'Reps, variante y calidad'],
  ['W32', 'HSW · pirueta / free HSPU', 'HSWALK|HANDSTAND WALK|PIROUET|PIRUETA|FREESTANDING', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '8–10′: 4–6 intentos de HSW 10 m + 3 piruetas por lado', 'Equilibrio invertido: volumen corto y frecuente.', 'Técnica: control de muñeca y línea. Biología: aprendizaje motor por práctica distribuida (más sesiones cortas > una larga).', 'Fresco; antes del metcon o en día de skills.', 'HOMBRO', '', 'Metros sin caer, intentos'],
  ['W33', 'Pino estático', 'HANDSTAND HOLD|PINO|WALL FACING HOLD', 'TÉCNICA', 'PM', 8, '🟢 Técnico', '5×20–30″ pino libre o asistido / 60″', 'Línea corporal y control escapular.', 'Fisiología: isometría de baja intensidad, propiocepción de muñeca y escápula.', 'Puede ir dentro de otro bloque de HSW.', 'HOMBRO', '', 'Segundos por intento, variante'],
  ['W20', 'Snatch balance >85 %', 'SNATCH BALANCE', 'TÉCNICA', 'PM', 12, '🟠 Técnico pesado', '5×2 snatch balance al 87–90 % del 1RM de snatch · 2′', 'Recepción rápida y estable con carga real.', 'Técnica: velocidad de caída bajo la barra. Fisiología: estabilidad OH con alta carga. Por debajo del 85 % no cuenta para la meta.', 'No el día de jerk pesado; nunca tras HSPU en fatiga.', 'HOMBRO PIERNA SNC', 'HOMBRO', '% exacto del 1RM de snatch, series y reps'],
  ['W23', 'Split jerk técnico', 'SPLIT JERK', 'TÉCNICA', 'PM', 12, '🟢 Técnico', 'EMOM 8′: 1 split jerk al 70–75 % + 2″ en recepción', 'Un objetivo de entrada o bloqueo con descanso.', 'Técnica: drive vertical y pie trasero activo. Biología: patrón motor estable a carga submáxima.', 'No el día de HSPU pesado.', 'HOMBRO SNC', 'HOMBRO', 'Kg y objetivo técnico'],
  ['W10', 'Movilidad / control escapular', 'ESCAPULAR|SCAPULAR|T-OPENER|WALL SLIDE|CUBAN|PASS-THROUGH|SHOULDER', 'MOVILIDAD', 'PM', 8, '🟢 Movilidad', '2 vueltas: 10 wall slides + 10 scap pull-ups + 8 Cuban press ligero', 'Hombro sano para HSPU, anillas y OH.', 'Fisiología: activación de trapecio inferior y serrato; mejora el ritmo escapulohumeral.', 'Sin interferencias: mejor dentro del calentamiento.', '', '', 'Una vez por sesión'],
  ['W07', 'Pliometría + contraste', 'BOX JUMP|POGO|BROAD JUMP|SQUAT JUMP|COUNTERMOVEMENT|DEPTH JUMP|JUMP SHRUG', 'TÉCNICA', 'PM', 12, '🟠 Potencia', '4×5 box jump + 3×5 broad jump con aterrizaje 2″ (≈50 saltos)', 'Potencia y absorción: 100–200 saltos de calidad por semana.', 'Fisiología: ciclo estiramiento-acortamiento y rigidez tendinosa. Biología: adaptación del tendón con dosis bajas y descansos completos.', 'Antes de pierna pesada o haltero, nunca después. Cuenta el impacto de la carrera.', 'IMPACTO SNC PIERNA', 'IMPACTO', 'Nº de saltos (CANTIDAD)'],
  ['M17', 'Jerk drive pesado en fatiga', 'JERK DRIVE|DIP DRIVE', 'EXTRA', 'PM', 10, '🟠 Fatiga específica', '3×(8 cal row + 3 jerk drive al 90 %)', 'Potencia de piernas al empujar con pulsaciones altas.', 'Fisiología: producción de fuerza con acidosis moderada.', 'Lejos de HSPU estricto.', 'HOMBRO PIERNA GLUC', 'HOMBRO', 'Kg y tiempos'],
  ['M01', 'C2B en fatiga', 'CHEST TO BAR|C2B', 'EXTRA', 'PM', 0, '', '', '', '', '', 'AGARRE GLUC', '', ''],
  ['M49', 'RMU en fatiga', 'RING MUSCLE|RMU', 'EXTRA', 'PM', 10, '🟠 Fatiga específica', 'EMOM 8′: impar 10 cal bike · par 2–3 RMU', 'RMU con pulsaciones altas.', 'Fisiología: mantener la técnica de anillas con acidosis.', 'No con otro trabajo de tirón pesado.', 'AGARRE HOMBRO GLUC', 'AGARRE', 'Reps por ronda'],
  ['M48', 'BMU en fatiga', 'BAR MUSCLE|BMU', 'EXTRA', 'PM', 10, '🟠 Fatiga específica', 'EMOM 8′: impar 12 wall ball · par 3–4 BMU', 'BMU en fatiga sin romper la técnica.', 'Fisiología: tirón explosivo con acidosis.', 'No con RMU en fatiga el mismo día.', 'AGARRE HOMBRO GLUC', 'AGARRE', 'Reps por ronda'],
  ['M05', 'T&G snatch', 'TOUCH AND GO|T&G|TOUCH N GO', 'EXTRA', 'PM', 10, '🟠 Cycling', '5×5 power snatch T&G al 55–60 % · 90″', 'Ciclar la barra con eficiencia.', 'Técnica: rebote controlado y barra cerca.', 'No tras snatch pesado.', 'HOMBRO AGARRE', '', 'Kg y tandas'],
  ['M07', 'T&G STOH', 'STOH|SHOULDER TO OVERHEAD|PUSH JERK', 'EXTRA', 'PM', 10, '🟠 Cycling', '5×6 STOH T&G al 60 % · 90″', 'Ciclar el OH sin perder el drive.', 'Técnica: dip-drive reactivo.', 'No el día de HSPU pesado.', 'HOMBRO', 'HOMBRO', 'Kg y tandas'],
  ['M31', 'Pullovers', 'PULLOVER|PULL OVER', 'TÉCNICA', 'PM', 8, '🟢 Técnico', '4×3–5 pullovers enlazados · 90″', 'Fluidez en barra.', 'Técnica: hollow-arch y cadera a la barra.', 'Lejos del agarre fatigado.', 'AGARRE CORE', '', 'Reps enlazadas'],
  ['T01', 'Thruster barra pesada', 'THRUSTER', 'EXTRA', 'PM', 10, '🟠 Fuerza-resistencia', '5×3 thruster al 75–80 % del front squat · 2′', 'Perfil pesado de thruster.', 'Fisiología: fuerza de pierna + empuje con poco volumen.', 'No el día de pierna pesada.', 'PIERNA HOMBRO', 'PIERNA', 'Kg, reps y tanda mayor'],
  ['T02', 'Thruster ligero / volumen', 'THRUSTER', 'EXTRA', 'PM', 10, '🟠 Volumen', '3×15 thruster 40/30 + 30 DU · 2′', 'Volumen específico de thruster.', 'Fisiología: resistencia local de cuádriceps y hombro.', 'Separado de otras pierna-pesada.', 'PIERNA HOMBRO GLUC', 'PIERNA', 'Kg, reps y tanda mayor'],
  ['T03', 'Thruster DB ≥30 kg', 'DB THRUSTER|DUAL DB THRUSTER', 'EXTRA', 'PM', 10, '🟠 Fuerza-resistencia', '4×8 dual DB thruster 2×30 kg · 2′', 'Thruster con mancuernas pesadas.', 'Fisiología: estabilidad unilateral bajo carga.', 'No el día de pierna pesada.', 'PIERNA HOMBRO', 'PIERNA', 'Kg y reps'],
  ['M44', 'OHS doble mancuerna', 'DUAL DB OVERHEAD SQUAT|DOUBLE DB OHS|2 DB OHS', 'TÉCNICA', 'PM', 8, '🟢 Estabilidad', '4×6 OHS con 2 DB · 90″', 'Estabilidad OH con dos mancuernas.', 'Fisiología: control escapular bilateral independiente.', 'No tras HSPU en fatiga.', 'HOMBRO PIERNA', 'HOMBRO', 'Kg por DB'],
  ['M58', 'OH una mancuerna', 'SINGLE[- ]ARM (DB )?OVERHEAD|SINGLE ARM OH|WAITER', 'TÉCNICA', 'PM', 8, '🟢 Estabilidad', '3×(6+6 single-arm DB OHS + 20 m waiter walk por brazo)', 'Antirrotación y escápula con una DB.', 'Fisiología: core antirrotación y estabilidad glenohumeral.', 'No tras HSPU en fatiga.', 'HOMBRO CORE', 'HOMBRO', 'Kg y reps por lado'],
  ['M13', 'OH lunges', 'OVERHEAD LUNGE|OH LUNGE|OH WALKING LUNGE', 'EXTRA', 'PM', 8, '🟢 Calidad', '3×10 m OH walking lunge (barra o DB)', 'Pierna unilateral con estabilidad OH.', 'Fisiología: control lumbopélvico y escapular simultáneo.', 'No el día de pierna pesada.', 'PIERNA HOMBRO', 'PIERNA', 'Material, kg y metros'],
  ['M45', 'Sentadilla búlgara', 'BULGAR|SPLIT SQUAT', 'EXTRA', 'PM', 10, '🟢 Calidad', '3×8+8 búlgara con DB · 90″', 'Fuerza unilateral y simetría.', 'Fisiología: glúteo medio y cuádriceps con baja carga axial.', 'No el día antes de calidad de carrera.', 'PIERNA', 'PIERNA', 'Kg y reps por pierna'],
  ['M46', 'Plancha Copenhague', 'COPENHAG', 'EXTRA', 'PM', 6, '🟢 Calidad', '3×20–30″ por lado', 'Aductores fuertes protegen ingle y rodilla en carrera.', 'Fisiología: isometría de aductores; reduce el riesgo de lesión inguinal.', 'Sin interferencias relevantes.', 'CORE', '', 'Segundos por lado y palanca'],
  ['M19', 'Pistols · técnica y accesorios', 'PISTOL', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '4×4+4 pistols a cajón bajo + 2×20″ isometría abajo por pierna', 'Fuerza y control unilateral en rango completo.', 'Técnica: tobillo y cadera en rango. Fisiología: fuerza excéntrica del cuádriceps.', 'No antes de calidad de carrera.', 'PIERNA', 'PIERNA', 'Variante y reps por pierna'],
  ['M47', 'Peso muerto agarre snatch', 'SNATCH GRIP DEADLIFT|SNATCH DEADLIFT|SG DL', 'EXTRA', 'PM', 10, '🟠 Fuerza', '4×4 snatch-grip DL al 80–85 % del snatch DL · 2′', 'Primer tirón fuerte con agarre real.', 'Fisiología: cadena posterior y dorsal con agarre ancho.', 'No antes de la Z2 larga ni de calidad.', 'PIERNA AGARRE', 'PIERNA', 'Kg y reps'],
  ['M28', 'Hip thrust', 'HIP THRUST', 'EXTRA', 'PM', 8, '🟢 Calidad', '3×8 hip thrust RPE 7–8', 'Extensión de cadera para correr y tirar.', 'Fisiología: glúteo mayor en acortamiento con poca carga axial.', 'Sin interferencias relevantes.', 'PIERNA', '', 'Kg y reps'],
  ['M08', 'Core específico', 'PALLOF|DEAD BUG|BIRD DOG|HOLLOW|AB WHEEL|SIDE PLANK|L-SIT|ROLLOUT', 'EXTRA', 'PM', 8, '🟢 Calidad', '3×(8 dead bug lento + 20″ hollow)', 'Control del tronco para transmitir fuerza.', 'Fisiología: antiextensión/antirrotación; mejora la rigidez del tronco.', 'Sin interferencias relevantes.', 'CORE', '', 'Variante y segundos'],
  ['M36', 'Rope climb', 'ROPE CLIMB|LEGLESS|WALL CLIMB', 'EXTRA', 'AM', 10, '🟢 Técnico', 'EMOM 8′: 1 rope climb (técnica de pies)', 'Técnica de cuerda fresca.', 'Fisiología: agarre y tirón con poco coste si la técnica es buena.', 'Por la mañana y ≥6 h de otros tirones.', 'AGARRE', 'AGARRE', 'Subidas y técnica'],
  ['M38', 'Trineo', 'SLED|TRINEO', 'EXTRA', 'PM', 12, '🟠 HYROX', '6×15 m push + 6×15 m pull · 90″', 'Técnica y economía de trineo (HYROX).', 'Fisiología: fuerza concéntrica de pierna sin excéntrica: muy poca agujeta.', 'Encaja tras la carrera o el día de pierna ligera.', 'PIERNA', '', 'Kg y tiempo por tramo'],
  ['M33', 'Heavy rope jumps', 'HEAVY ROPE', 'EXTRA', 'PM', 6, '🟢 Calidad', '5×30″ heavy rope / 30″', 'Hombro y gemelo con comba pesada.', 'Fisiología: resistencia de antebrazo y hombro con impacto bajo.', 'Mejor dentro de un bloque de thrusters o Z6–Z8.', 'IMPACTO HOMBRO', '', 'Dosis y contexto'],
  ['M35', 'Triple unders', 'TRIPLE UNDER', 'TÉCNICA', 'PM', 6, '🟢 Técnico', '6–8 intentos de 3–5 triple unders · descanso completo', 'Técnica de triples sin fatiga.', 'Técnica: muñeca y altura del salto.', 'Sin fatiga previa de gemelo.', 'IMPACTO', '', 'Intentos y reps'],
  ['M32', 'Doble crossover', 'CROSSOVER|CROSS OVER', 'TÉCNICA', 'PM', 6, '🟢 Técnico', '6×20″ intentos de double crossover', 'Coordinación de comba avanzada.', 'Técnica: cruce amplio y salto alto.', 'Sin fatiga previa de gemelo.', 'IMPACTO', '', 'Reps y contexto'],
  ['M10', 'Chaos snatch', 'CHAOS SNATCH|BANDED SNATCH', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '5×2 snatch con discos colgando de goma (carga manejable)', 'Estabilidad reactiva en recepción de snatch.', 'Fisiología: control propioceptivo con inestabilidad.', 'No tras snatch pesado.', 'HOMBRO', '', 'Variante y carga'],
  ['M11', 'Chaos split jerk', 'CHAOS (SPLIT )?JERK', 'TÉCNICA', 'PM', 10, '🟢 Técnico', '5×2 split jerk con discos colgando · 2″ en recepción', 'Estabilidad reactiva en split.', 'Fisiología: control propioceptivo del hombro y la pelvis.', 'No el día de HSPU pesado.', 'HOMBRO', '', 'Variante y carga'],
  ['M50', 'Hold OH pesado · snatch', 'OVERHEAD HOLD|OH HOLD|SOTS|ISOMETRIC OVERHEAD', 'TÉCNICA', 'PM', 8, '🟠 Estabilidad', '4×10″ hold en recepción de snatch al 100–110 % del snatch (desde rack con seguros)', 'Confianza y estabilidad con carga supramáxima.', 'Fisiología: estímulo isométrico supramáximo del complejo escapular.', 'No tras HSPU ni jerk pesado.', 'HOMBRO SNC', 'HOMBRO', 'Kg, segundos y posición'],
  ['M51', 'Hold OH pesado · split', 'SPLIT HOLD|JERK RECOVERY|JERK HOLD', 'TÉCNICA', 'PM', 8, '🟠 Estabilidad', '4×10″ hold en split al 100–110 % del jerk desde rack', 'Estabilidad en recepción de split.', 'Fisiología: isometría supramáxima.', 'No tras HSPU ni jerk pesado.', 'HOMBRO SNC', 'HOMBRO', 'Kg, segundos y piernas'],
  ['M52', 'Contraste francés', 'CONTRASTE|FRENCH CONTRAST', 'EXTRA', 'PM', 15, '🟠 Potencia', '3×(2 back squat 85 % + 3 box jump + 3 KB jump squat ligero + 3 saltos asistidos) · 3′', 'Potencia: fuerza pesada seguida de saltos.', 'Fisiología: potenciación post-activación (PAP) y transferencia de fuerza a velocidad.', 'Fresco; no antes de calidad de carrera.', 'PIERNA SNC IMPACTO', 'PIERNA SNC', 'Los cuatro componentes, dosis y descansos'],
  ['M53', 'Accesorios de press · apoyo HSPU', 'Z PRESS|DB PRESS|STRICT PRESS|SEATED PRESS|DIP', 'EXTRA', 'PM', 10, '🟢 Calidad', '3×8 Z-press DB + 3×10 dips en anillas · RIR 2', 'Empuje accesorio para la carencia de HSPU.', 'Fisiología: hipertrofia moderada de deltoides y tríceps.', 'No el día antes de HSPU pesado.', 'HOMBRO', 'HOMBRO', 'Kg y reps'],
  ['M54', 'Sentadilla muchas repes / fatiga', 'AIR SQUAT|SENTADILLA', 'EXTRA', 'PM', 8, '🟠 Fatiga', '3×30 air squats rápidos / 1′ (o 3×20 goblet ligero)', 'Resistencia local de pierna.', 'Fisiología: tolerancia a la acidosis local.', 'No antes de la Z2 larga ni de calidad.', 'PIERNA GLUC', 'PIERNA', 'Variante, kg, reps y descansos'],
  ['M55', 'Press OH ligero / fatiga', 'PUSH PRESS|STRICT PRESS', 'EXTRA', 'PM', 8, '🟠 Fatiga', '3×15 push press 30/20 / 1′', 'Resistencia local del hombro.', 'Fisiología: tolerancia a la fatiga del deltoides.', 'No antes de HSPU estricto.', 'HOMBRO GLUC', 'HOMBRO', 'Kg, reps y descansos'],
  ['M56', 'Accesorios de pino', 'PLATE|LATERAL|SHOULDER TAP', 'TÉCNICA', 'PM', 8, '🟢 Técnico', '4×(3 subidas/bajadas a discos + 2 m laterales)', 'Ataca la carencia del pino.', 'Técnica: transferencia de peso entre manos.', 'Fresco.', 'HOMBRO', '', 'Variante, altura y reps'],
  ['M57', 'Sandbag / slamball', 'SANDBAG|SLAM ?BALL', 'EXTRA', 'PM', 8, '🟠 Integración', '4×(5 sandbag clean + 20 m bearhug carry)', 'Carga externa incómoda (competición).', 'Fisiología: fuerza de cadena posterior y core en posiciones no ideales.', 'No el día de pierna pesada.', 'PIERNA CORE AGARRE', '', 'Variante, kg y reps/metros']
];
function sembrarEstimulos_() {
  var ya = {}; listar_(HOJAS.ESTIMULOS).forEach(function (r) { ya[r['CÓDIGO']] = 1; });
  var cab = ESQUEMA['APP · ESTÍMULOS'].cab, filas = EST_BASE.filter(function (e) { return !ya[e[0]]; }).map(function (e) { return e.concat(['Sí']); });
  if (!filas.length) return 0;
  var sh = hojaMia_(HOJAS.ESTIMULOS), c2 = cabeceras_(sh);
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, filas.length, c2.length).setValues(filas.map(function (f) { var o = {}; cab.forEach(function (h, i) { o[h] = f[i]; }); return filaDe_(c2, o); }));
  return filas.length;
}
function catalogo_() {
  var out = {};
  var filas = listar_(HOJAS.ESTIMULOS);
  if (!filas.length) EST_BASE.forEach(function (e) { var o = {}; ESQUEMA['APP · ESTÍMULOS'].cab.forEach(function (h, i) { o[h] = e[i]; }); o.ACTIVO = 'Sí'; filas.push(o); });
  filas.forEach(function (r) { if (r['CÓDIGO'] && r.ACTIVO !== 'No') out[String(r['CÓDIGO']).trim().toUpperCase()] = r; });
  return out;
}
function reSeguro_(t) { try { return t ? new RegExp(norm(t)) : null; } catch (e) { return null; } }
function etiquetas_(t) { return norm(t).split(/[\s,|;]+/).filter(Boolean); }

// ---------- 2 · Lectura de cada bloque: qué estímulos cubre y qué fatiga genera ----------
var CARGA_RE = {
  PIERNA: /BACK SQUAT|FRONT SQUAT|DEADLIFT|SQUAT CLEAN|THRUSTER|LUNGE|BOX JUMP|WALL BALL|CLEAN|SNATCH|PISTOL|BULGAR|SANDBAG/,
  HOMBRO: /HSPU|JERK|PRESS|SNATCH|OVERHEAD|OHS|HSWALK|HANDSTAND|DIP|WALL BALL|DEVIL PRESS/,
  AGARRE: /PULL UP|PULL-UP|T2B|TOES TO|C2B|CHEST TO BAR|MUSCLE UP|ROPE|DEADLIFT|ROW\b|KB SWING|FARMER|HANG/,
  IMPACTO: /\bRUN\b|CARRERA|JUMP|DOUBLE UNDER|\bDU\b|BURPEE|SHUTTLE/,
  CORE: /T2B|TOES TO|GHD|L-SIT|HOLLOW|PLANK|PALLOF|AB WHEEL/
};
function cargasDe_(txt, rpe) {
  var t = bilingue_(txt), out = [];
  Object.keys(CARGA_RE).forEach(function (k) { if (CARGA_RE[k].test(t)) out.push(k); });
  var pcts = (t.match(/(\d{2,3})\s*%/g) || []).map(function (x) { return parseInt(x, 10); });
  if (pcts.some(function (p) { return p >= 85 && p <= 110; }) || /\(RIR 1|RIR 0|HEAVY/.test(t)) out.push('SNC');
  if (/METCON|AMRAP|FOR TIME|TIME CAP|EMOM|EVERY/.test(t) && (parseInt(String(rpe || '').replace(/\D/g, ''), 10) || 7) >= 7) out.push('GLUC');
  return out;
}
/** Códigos que cubre un texto (bloque de Fabrik o refuerzo), según DETECTAR del catálogo. En metcon solo cuentan los «en fatiga». */
var SOLO_METCON = { W31: 1, M01: 1, M49: 1, M48: 1 }, NUNCA_METCON = { W17: 1, W15: 1, W13: 1, W20: 1, W23: 1, W33: 1 };
function codigosTexto_(txt, cat, enMetcon) {
  var t = bilingue_(txt), out = [];
  Object.keys(cat).forEach(function (c) {
    if (/^(W0[1-4]|R0\d)$/.test(c)) return;                                 // carrera: solo la programada como carrera
    if (enMetcon && NUNCA_METCON[c]) return;
    if (!enMetcon && SOLO_METCON[c]) return;
    var re = reSeguro_(cat[c]['DETECTAR (regex)']);
    if (re && re.test(t)) out.push(c);
  });
  if (out.indexOf('W20') >= 0 && !(t.match(/(\d{2,3})\s*%/g) || []).some(function (x) { return parseInt(x, 10) > 85; })) out.splice(out.indexOf('W20'), 1);   // >85 % o no cuenta
  if (out.indexOf('T01') >= 0 && out.indexOf('T02') >= 0) out.splice(out.indexOf(enMetcon ? 'T01' : 'T02'), 1);
  // W34 · split jerk en fatiga o pesado (decisión de Pablo 6/11): en metcon siempre cuenta; fuera, solo a ≥85 % o heavy (no los push/power jerk ni el jerk drive)
  if (out.indexOf('W34') >= 0) {
    var jPush = /\b(PUSH|POWER)\s+JERK|JERK\s+DRIVE|DIP\s+DRIVE/.test(t) && !/SPLIT|C\s?&\s?J|CLEAN\s*(&|AND|Y)\s*(SPLIT\s*)?JERK/.test(t);
    var jPesado = (t.match(/(\d{2,3})\s*%/g) || []).some(function (x) { var n = parseInt(x, 10); return n >= 85 && n <= 105; }) || /HEAVY|PESAD|\bRM\b|1RM|2RM/.test(t);
    if (jPush || !(enMetcon || jPesado)) out.splice(out.indexOf('W34'), 1);
  }
  return out;
}
/** Apartados de preparación (calentamiento, movilidad, activación, progresión de cargas): sus saltos no cuentan para la meta. */
var RE_PREP_ = /RANGO|MOVILIDAD|MOBILITY|ACTIVACI|ACTIVATION|WARM|CALENTAMIENTO|LOADING PROGRESSION|PROGRESION DE CARGAS|APROXIMACI/;
/**
 * Saltos de pliometría de un texto. Reglas:
 *  · líneas con JUMP / POGO / BOUND / HOP (no jumping jacks): «3X10», «4×5 … + 3×5 …» (suma todas), «18/15/12/9» (por set) o «10 box jumps».
 *  · comba doble (DOUBLE UNDER / DU): cuentan a 4 por salto (regla de Pablo: 4 DU = 1 salto).
 *  · si el texto dice «(≈50 saltos)» y no hay nada más, se toma ese número.
 *  · un número suelto dentro de «N SETS / RONDAS» se multiplica por N (las series AxB y las secuencias 18/15/12/9 ya son el total).
 *  · no cuentan los apartados de calentamiento / activación / movilidad ni las adaptaciones (solo los del trabajo principal y el metcon).
 */
function saltosTexto_(txt) {
  var n = 0, du = 0, t = norm(txt).replace(/×/g, 'X').split('\n').map(function (l) { return bilingue_(l).split('\n').pop(); }).join('\n');
  var reps = function (l) {
    var tot = 0, m, re = /(\d+)\s*X\s*(\d+)/g;
    while ((m = re.exec(l))) tot += +m[1] * +m[2];
    if (tot) return tot;
    var sq = l.match(/^\s*((?:\d+\s*\/\s*){2,}\d+)/); if (sq) return sq[1].split('/').reduce(function (a, x) { return a + (+x || 0); }, 0);   // 18/15/12/9 por set
    var r = l.match(/^\s*\+?\s*(\d+)\s/); return r ? +r[1] * (sets || 1) : 0;   // «24 DOUBLE UNDER» dentro de «4 SETS» = 96
  };
  var salta = false, sets = 0;   // dentro de un apartado de calentamiento / activación / adaptaciones: no cuenta (regla de Pablo, 03/11)
  t.split('\n').forEach(function (l, i) {
    var cab = /^\s*[A-Z](?:\.\d)?\s*(?:·|\))\s*\S/.test(l) || /^\s*ADAPTACIONES\s*:?\s*$/.test(l) || (/^[^\d]{3,40}:\s*$/.test(l.trim()));
    if (i === 0 || cab) {   // la 1.ª línea es el título del bloque: si es un calentamiento, todo el bloque lo es
      var esPrep = RE_PREP_.test(l) || /^\s*ADAPTACIONES/.test(l);
      if (cab || esPrep) { salta = esPrep; sets = 0; if (cab) return; }
    }
    if (salta) return;
    var ms = l.match(/(\d+)\s*(?:SETS?|RONDAS?|ROUNDS?)\b/);
    if (ms && !/JUMP|POGO|BOUND|HOP|DOUBLE UNDER|\bDUS?\b/.test(l)) { sets = +ms[1]; return; }
    if (/DOUBLE UNDER|\bDUS?\b/.test(l) && !/TRIPLE/.test(l)) { du += reps(l); return; }
    if (!/JUMP|POGO|BOUND|HOP/.test(l) || /JUMPING JACK|ROPE/.test(l)) return;
    n += reps(l);
  });
  if (!n && !du) { var ex = t.match(/(\d+)\s*SALTOS/); if (ex) n = +ex[1]; }
  return Math.round(n + du / 4);
}
/** Saltos de una fila del plan: CANTIDAD si la pusiste; si no, los que se leen en su contenido. */
function saltosDe_(r) {
  var c = parseFloat(String(r.CANTIDAD == null ? '' : r.CANTIDAD).replace(',', '.'));
  return c > 0 ? c : saltosTexto_((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || ''));
}
function textoBloque_(b) { return b.titulo + '\n' + (b.partes || []).map(function (p) { return p.etiqueta + '\n' + p.texto; }).join('\n'); }
function tipoBloque_(b) {
  var t = bilingue_(b.titulo + ' ' + (b.partes || []).map(function (p) { return p.etiqueta; }).join(' '));
  if (esMetconB_(b)) return 'metcon';
  if (/SNATCH|CLEAN|JERK|WEIGHTLIFTING|HALTERO/.test(t)) return 'haltero';
  if (/SQUAT|DEADLIFT|STRENG|STRONGMAN|BENCH|FUERZA/.test(t)) return 'fuerza';
  if (/GIMN|GYMNAST|HSPU|MUSCLE|LEGLESS|SKILL/.test(t)) return 'gimnasticos';
  if (/ACCES/.test(t)) return 'accesorios';
  return 'otro';
}
var CIENCIA_TIPO = {
  haltero: ['Técnica: velocidad del segundo tirón, barra cerca y recepción estable; los % mandan sobre la sensación. Fisiología: potencia (fuerza × velocidad) con reclutamiento de unidades motoras rápidas; con descansos amplios se trabaja el sistema fosfágeno. Biología: adaptación sobre todo neural (coordinación intermuscular, frecuencia de disparo), poca hipertrofia.', 'Antes de cualquier trabajo que fatigue hombro, agarre o pierna. La pliometría previa potencia (PAP); un metcon previo la estropea.'],
  fuerza: ['Técnica: trayectoria y bracing en cada repetición. Fisiología: fuerza máxima/submáxima; series cortas con intención de velocidad mejoran la tasa de desarrollo de fuerza. Biología: reclutamiento de alto umbral y, con más volumen, señal mTOR para hipertrofia.', 'Separar ≥6 h de la carrera de calidad y no hacerla el día antes de la Z2 larga; la carrera de baja intensidad >6 h antes apenas interfiere.'],
  gimnasticos: ['Técnica: control de la línea corporal y del ritmo. Fisiología: fuerza relativa (fuerza / peso corporal) de dorsal, deltoides y tríceps. Biología: la práctica frecuente con poca fatiga consolida el patrón motor.', 'El agarre y el hombro llegan tocados tras tirones o empujes pesados: mejor fresco o separado ≥6 h.'],
  metcon: ['Fisiología: esfuerzo mixto entre VT2 y VO₂max con componente glucolítico; la clave es el ritmo sostenible y las transiciones. Biología: estrés metabólico (lactato, H⁺) que mejora la capacidad tampón y la tolerancia a la fatiga; necesita 24–48 h para repetir algo igual de duro.', 'No meter calidad de carrera ni Z6–Z8 en las 24 h siguientes a un metcon de RPE ≥8. Los saltos y la carrera del WOD suman al impacto semanal.'],
  accesorios: ['Fisiología: volumen moderado lejos del fallo para fortalecer los eslabones débiles. Biología: adaptación de tejido (tendón, músculo) con baja fatiga del sistema nervioso.', 'Pocas interferencias si se respeta el RIR; no apurar al fallo antes de días técnicos.'],
  otro: ['', '']
};

// ---------- 3 · Cargar Fabrik en APP · PLAN (domingo 23:15, desde el menú del Sheet o desde la app) ----------
function idFabrik_(lunes, dia, n) { return 'F' + lunes.replace(/-/g, '').slice(2) + '-' + dia.slice(0, 3) + n; }
function cargarFabrikSemana_(lunes) {
  lunes = lunesDe_(lunes);
  var F = fabrikSemana_(lunes);
  if (!F.fabrik) return { ok: false, cargados: 0, motivo: 'Fabrik aún no ha subido la semana del ' + isoAFecha(lunes) };
  var cat = catalogo_(), n = 0, act = 0;
  bloqueo_(function () {
    var plan = listar_(HOJAS.PLAN), porRef = {};
    plan.forEach(function (r) { var d = celdaIso_(r.FECHA); if (norm(r.ORIGEN) === 'FABRIK' && d >= lunes && d <= sumarDias(lunes, 6)) porRef[norm(r.FABRIK_REF).replace(/\s+/g, '')] = r; });
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh), nuevas = [];
    F.fabrik.dias.forEach(function (d) {
      d.bloques.forEach(function (b, k) {
        if (!b.n) return;
        var ref = d.nombre + '·' + b.n, txt = textoBloque_(b), met = esMetconB_(b), tipo = tipoBloque_(b);
        var cods = codigosTexto_(txt, cat, met), sal = saltosTexto_(b.titulo + '\n' + b.partes.filter(function (p) { return p.tipo === 'main'; }).map(function (p) { return p.etiqueta + '\n' + p.texto; }).join('\n'));
        if (sal && cods.indexOf('W07') < 0) cods.push('W07');
        var cien = CIENCIA_TIPO[tipo] || CIENCIA_TIPO.otro;
        var o = { 'TÍTULO': b.titulo, CONTENIDO: recortar(b.partes.filter(function (p) { return p.tipo !== 'adapt'; }).map(function (p) { return (p.etiqueta ? p.etiqueta + '\n' : '') + p.texto; }).join('\n\n')).slice(0, 4000),
          'CÓDIGOS': cods.join('|'), CANTIDAD: sal || '', INTENSIDAD: met ? (d.rpe ? 'RPE ' + d.rpe : '') : '' };
        var x = porRef[norm(ref)];
        if (x && /editado/.test(x.GENERADO || '')) return;   // lo editaste tú: tu versión manda
        if (x) {   // ya cargado: se respeta dónde lo pusiste; solo se refresca el contenido si Gabi lo ha cambiado
          if (x.CONTENIDO !== o.CONTENIDO || x['TÍTULO'] !== o['TÍTULO']) { actualizarFila_(HOJAS.PLAN, x._fila, Object.assign(o, { ACTUALIZADO: ahora_() })); act++; }
          else if (String(x.CANTIDAD == null ? '' : x.CANTIDAD) !== String(o.CANTIDAD)) { actualizarFila_(HOJAS.PLAN, x._fila, { CANTIDAD: o.CANTIDAD, 'CÓDIGOS': o['CÓDIGOS'], ACTUALIZADO: ahora_() }); act++; }   // recuento de saltos (v0.10.1)
          return;
        }
        nuevas.push(Object.assign(o, { ID: idFabrik_(lunes, d.nombre, b.n), FECHA: isoAFecha(d.iso), 'DÍA': diaDe_(d.iso), TURNO: 'PM', ORDEN: 50 + k, ORIGEN: 'FABRIK', FABRIK_REF: ref,
          BLOQUE: b.n + ': ' + b.titulo, 'POR QUÉ (cursiva)': recortar(String(b.nota || (b.wod && b.wod.objetivo) || '').split('\n\n')[0]).slice(0, 600),
          'CIENCIA (técnica · fisiología · biología)': cien[0], INTERFERENCIAS: cien[1], ESTADO: 'PROGRAMADO', GENERADO: 'fabrik ' + ahora_(), ACTUALIZADO: ahora_() }));
        n++;
      });
    });
    if (nuevas.length) sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, nuevas.length, cab.length).setValues(nuevas.map(function (o) { return filaDe_(cab, o); }));
  });
  if (n || act) interferenciasFabrik_(lunes);
  ponerConfig_('fabrik_cargado_' + lunes, ahora_() + ' · ' + n + ' bloques nuevos · ' + act + ' actualizados', 'Carga de Fabrik en APP · PLAN');
  return { ok: true, cargados: n, actualizados: act };
}
/** Tarea del domingo 23:15: carga la semana que empieza mañana. */
function cargarFabrikDomingo() { return conSalud_('cargarFabrikDomingo', cargarFabrikDomingo_sin_); }
function cargarFabrikDomingo_sin_() {
  var r = cargarFabrikSemana_(sumarDias(lunesDe_(hoyIso_()), 7));
  Logger.log('Fabrik → PLAN: ' + JSON.stringify(r));
  if (r.ok && pushActivo_()) enviarPush_('Fabrik cargado', r.cargados + ' bloques en tu plan. Ya puedes «Cargar extras».');
}
/** Interferencias de cada bloque de Fabrik con el día anterior y el siguiente (se reescriben al cargar o generar). */
function interferenciasFabrik_(lunes) {
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= sumarDias(lunes, -1) && d <= sumarDias(lunes, 7) && !/NO HACER|CANCELADO|SUSTITUIDO/.test(r.ESTADO); });
  var cargasDia = {};
  plan.forEach(function (r) { var d = celdaIso_(r.FECHA); cargasDia[d] = (cargasDia[d] || []).concat(cargasDe_(r['TÍTULO'] + '\n' + r.CONTENIDO, r.INTENSIDAD)).concat(/R0[123]|W04/.test(r['CÓDIGOS']) ? ['CALIDAD'] : []); });
  plan.forEach(function (r) {
    if (norm(r.ORIGEN) !== 'FABRIK' || celdaIso_(r.FECHA) < lunes || celdaIso_(r.FECHA) > sumarDias(lunes, 6)) return;
    var d = celdaIso_(r.FECHA), mi = cargasDe_(r['TÍTULO'] + '\n' + r.CONTENIDO, r.INTENSIDAD), extra = [];
    var ant = cargasDia[sumarDias(d, -1)] || [], sig = cargasDia[sumarDias(d, 1)] || [];
    if (mi.indexOf('PIERNA') >= 0 && sig.indexOf('CALIDAD') >= 0) extra.push('Mañana hay calidad de carrera: sin fallo en pierna, deja 1–2 RIR.');
    if (mi.indexOf('HOMBRO') >= 0 && ant.indexOf('HOMBRO') >= 0) extra.push('Ayer ya hubo empuje/OH: calienta bien el hombro y respeta los %.');
    if (mi.indexOf('AGARRE') >= 0 && ant.indexOf('AGARRE') >= 0) extra.push('Agarre cargado del día anterior: tiza y tandas cortas.');
    if (ant.indexOf('CALIDAD') >= 0 && mi.indexOf('PIERNA') >= 0) extra.push('Ayer fue la calidad de carrera: la pierna puede llegar con menos chispa.');
    var base = (CIENCIA_TIPO[tipoBloque_({ titulo: r['TÍTULO'], partes: [{ etiqueta: '', texto: r.CONTENIDO }] })] || CIENCIA_TIPO.otro)[1];
    var txt = [base].concat(extra).filter(Boolean).join(' ');
    if (txt !== r.INTERFERENCIAS) actualizarFila_(HOJAS.PLAN, r._fila, { INTERFERENCIAS: txt });
  });
}

// ---------- 4 · Motor de colocación: «posición óptima» de un bloque ----------
/** Contexto de la semana: cargas por día y turno, minutos, sesiones duras, dobles y descansos. */
function contextoSemana_(lunes, excluirId, excluirFn) {
  var conf = filaSemana_(lunes) || {}, dob = String(conf['DOBLES (mañanas libres)'] || ''), des = String(conf.DESCANSO || '');
  var CORTO = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
  var dias = [];
  for (var i = 0; i < 7; i++) {
    var iso = sumarDias(lunes, i);
    dias.push({ i: i, iso: iso, am: norm(dob).indexOf(CORTO[i]) >= 0, descanso: norm(des).indexOf(CORTO[i]) >= 0, cargas: { AM: [], PM: [] }, min: { AM: 0, PM: 0 }, nExtra: { AM: 0, PM: 0 }, duro: false, codigos: [], fabrik: false, antes: false, despues: false, rpe: 0 });
  }
  var porIso = {}; dias.forEach(function (d) { porIso[d.iso] = d; });
  var F = fabrikSemana_(lunes).fabrik;
  (F ? F.dias : []).forEach(function (fd) { var d = porIso[fd.iso]; if (d) { d.rpe = parseInt(String(fd.rpe || '').replace(/\D/g, ''), 10) || 0; d.fabrikRpe = fd.rpe; } });
  listar_(HOJAS.PLAN).forEach(function (r) {
    var d = porIso[celdaIso_(r.FECHA)]; if (!d || r.ID === excluirId || /NO HACER|CANCELADO|SUSTITUIDO|SIN HUECO|^PROPUESTA$/.test(r.ESTADO) || (excluirFn && excluirFn(r))) return;
    if (norm(r.ORIGEN) !== 'FABRIK') d.fijos = (d.fijos || []).concat(codigosDe_(r['CÓDIGOS']));
    var t = norm(r.TURNO) === 'AM' ? 'AM' : 'PM', min = parseFloat(String(r.MIN).replace(',', '.')) || (norm(r.ORIGEN) === 'FABRIK' ? 20 : 10);
    if (norm(r.ORIGEN) === 'FABRIK') d.fabrik = true;
    d.cargas[t] = d.cargas[t].concat(cargasDe_(r['TÍTULO'] + '\n' + r.CONTENIDO, r.INTENSIDAD || d.fabrikRpe));
    d.min[t] += min; d.codigos = d.codigos.concat(codigosDe_(r['CÓDIGOS'])); if (norm(r.ORIGEN) !== 'FABRIK') d.nExtra[t]++;
    if (norm(r.ORIGEN) !== 'FABRIK' && !esIntocable_(codigosDe_(r['CÓDIGOS']))) { d.nExtraX = d.nExtraX || { AM: 0, PM: 0 }; d.minExtraX = d.minExtraX || { AM: 0, PM: 0 }; d.nExtraX[t]++; d.minExtraX[t] += min; }
    if (t === 'AM') { var cAM = codigosDe_(r['CÓDIGOS']); d.codigosAM = (d.codigosAM || []).concat(cAM); if (cAM.some(function (c) { return /^(W01|W02|W04)$/.test(c); })) d.minCarreraAM = (d.minCarreraAM || 0) + min;
      else if (!cAM.some(function (c) { return /^W0[123]$/.test(c); })) d.nExtraAMcal = (d.nExtraAMcal || 0) + 1; }
    if (/R01|R02|R03|R04|W04/.test(r['CÓDIGOS'])) d.duro = true;
    if (norm(r.ORIGEN) === 'FABRIK' && esMetconP_(r)) { d.duro = true; d.fabrikP = (d.fabrikP || []).concat([r['TÍTULO']]); }
  });
  eventosEntre_(sumarDias(lunes, -3), sumarDias(lunes, 10)).forEach(function (e) {
    var i0 = celdaIso_(e.INICIO), f0 = celdaIso_(e.FIN) || i0, an = +e['ANTES (días bajar volumen)'] || 0, de = +e['DESPUÉS (días recuperación)'] || 0;
    dias.forEach(function (d) {
      if (d.iso >= i0 && d.iso <= f0) { if (/Día completo/.test(e.BLOQUEA)) d.descanso = true; if (/Mañana/.test(e.BLOQUEA)) d.am = false; if (/Tarde/.test(e.BLOQUEA)) d.bloqPM = true; if (/^Test/i.test(e.EVENTO)) d.semanaTest = true; }
      if (an && d.iso < i0 && d.iso >= sumarDias(i0, -an)) d.antes = true;
      if (de && d.iso > f0 && d.iso <= sumarDias(f0, de)) d.despues = true;
    });
  });
  return { lunes: lunes, dias: dias, conf: conf, modoAM: enduranceManana_() };
}
/** Puntúa colocar un bloque (cand = {codigos, carga[], evitar[], min, turno, duro}) en cada hueco. Menor = mejor. */
function puntuarHuecos_(cand, ctx, todo) {
  var out = [], libre = cand.codigos.some(function (c) { return LIBRES_TURNO.test(c); });
  var enduAM = ctx.modoAM && cand.codigos.some(function (c) { return /^W0[123]$/.test(c); }) && !cand.codigos.some(function (c) { return /^(R01|W04)$/.test(c); });
  ctx.dias.forEach(function (d, i) {
    if (ctx.permitidos && !ctx.permitidos[d.iso]) return;   // v0.18 · solo los días elegidos
    if (ctx.op && !todo && !opPermite_(ctx.op, cand.codigos, d.iso)) return;   // v0.27 · modo operación: ese día no admite ese estímulo
    ['AM', 'PM'].forEach(function (t) {
      var motivos = [], p = 0, malos = [];
      // todo = true: se puntúa también lo no disponible (para enseñarte qué pasa donde TÚ lo pones)
      if (d.descanso) { if (!todo) return; p += 8; malos.push('es tu día de descanso'); }
      if (t === 'AM' && !d.am) { if (!todo) return; p += 6; malos.push('esa mañana no la tienes libre'); }
      if (t === 'PM' && d.bloqPM) { if (!todo) return; p += 8; malos.push('la tarde está bloqueada por un evento'); }
      if (enduAM && t === 'PM') { if (!todo) return; p += 6; malos.push('«Endurance de mañana» activo: la Z2 debería ir por la mañana'); }
      if (!libre && cand.turno && cand.turno !== 'AM|PM' && cand.turno.indexOf(t) < 0) { p += 3; malos.push('prefiere ' + cand.turno); }
      if (ctx.modoAM && t === 'AM') {
        var amC = d.codigosAM || [], z2 = function (l) { return l.some(function (c) { return /^W0[123]$/.test(c); }) && !l.some(function (c) { return /^(R01|W04)$/.test(c); }); };
        if (z2(cand.codigos) && z2(amC)) { if (!todo) return; p += 8; malos.push('ya hay una sesión de Z2 esa mañana (solo una por mañana)'); }
        var carreraAM = amC.concat(cand.codigos).some(function (c) { return /^(W01|W02|W04)$/.test(c); }) && !amC.concat(cand.codigos).every(function (c) { return c === 'W03'; });
        var base = d.minCarreraAM || (cand.codigos.some(function (c) { return /^(W01|W02|W04)$/.test(c); }) ? cand.min : 0);
        var topeAM = carreraAM ? Math.max(45, base + 15) : 45, totAM = d.min.AM + (cand.min || 10);
        if (totAM > topeAM) { if (!todo) return; p += 6; malos.push('la sesión de la mañana pasaría de ' + topeAM + '′'); }
        if (!z2(cand.codigos) && d.nExtraAMcal >= 1) { if (!todo) return; p += 5; malos.push('esa mañana ya lleva su extra de calidad'); }
      }
      var hoy = d.cargas.AM.concat(d.cargas.PM), ant = i ? ctx.dias[i - 1].cargas.AM.concat(ctx.dias[i - 1].cargas.PM) : [], sig = i < 6 ? ctx.dias[i + 1].cargas.AM.concat(ctx.dias[i + 1].cargas.PM) : [];
      (cand.evitar || []).forEach(function (e) {
        if (hoy.indexOf(e) >= 0) { p += 4; malos.push('ese día Fabrik ya carga ' + e.toLowerCase()); }
        else if (cand.duro && ant.indexOf(e) >= 0) { p += 2; malos.push('el día anterior carga ' + e.toLowerCase()); }
      });
      if (familiaSin_(cand.codigos) !== 'accesorio') (cand.carga || []).forEach(function (c) { if (hoy.indexOf(c) >= 0 && ['PIERNA', 'HOMBRO', 'AGARRE'].indexOf(c) >= 0) { p += 1.5; malos.push('suma ' + c.toLowerCase() + ' al mismo día'); } });
      if (cand.duro) {
        for (var k = -2; k <= 2; k++) { var o = ctx.dias[i + k]; if (o && o.duro) { p += k ? 10 : 14; malos.push(k ? 'otra sesión dura a ' + Math.abs(k) + ' día' + (Math.abs(k) > 1 ? 's' : '') + ' (necesita ≥48 h)' : 'ya hay otra sesión dura ese día'); } }
        if (sig.indexOf('PIERNA') >= 0 && cand.codigos.indexOf('W04') >= 0) { p += 1; }
        if (ant.indexOf('PIERNA') >= 0 && ant.indexOf('SNC') >= 0) { p += 4; malos.push('viene de pierna pesada'); }
        if (d.rpe >= 8 && t === 'PM') { p += 3; malos.push('el metcon de ese día es RPE ' + d.rpe); }
        if (d.antes || d.despues) { p += 6; malos.push(d.antes ? 'días previos a un evento: bajar volumen' : 'recuperación tras un evento'); }
      }
      if (!cand.duro && d.duro && (cand.codigos.indexOf('W01') >= 0 || (cand.carga || []).indexOf('SNC') >= 0)) { p += 5; malos.push('ese día ya hay una sesión dura'); }
      p += (d.nExtra[t] || 0) * 1.5;                                                   // repartir: cada extra ya puesto en esa sesión resta atractivo
      if (cand.codigos.indexOf('W01') >= 0) {   // larga: aislada
        if (d.fabrik) { p += 4; malos.push('mejor un día sin pesas'); } else motivos.push('día sin Fabrik: la larga queda aislada');
        if (ant.indexOf('PIERNA') >= 0) { p += 2; malos.push('pierna el día anterior'); }
      }
      if ((d.antes || d.despues) && !cand.duro) p += 1.5;
      var vetoMat = materialVeto_(cand.codigos, d.iso, t); if (vetoMat) { if (!todo) return; p += 9; malos.push(vetoMat); }   // v0.28
      if (!esIntocable_(cand.codigos)) {   // v0.28 · tope de extras por sesión (carrera, P1–P4 y modo operación van aparte)
        if ((d.nExtraX || {})[t] >= EXTRAS_MAX_.n) { if (!todo) return; p += 7; malos.push('esa sesión ya lleva ' + EXTRAS_MAX_.n + ' extras'); }
        if (((d.minExtraX || {})[t] || 0) + (cand.min || 10) > EXTRAS_MAX_.min + 5) { p += 4; malos.push('pasaría de ' + EXTRAS_MAX_.min + '′ de extras en esa sesión'); }
      }
      if (materialLimitado_(d.iso) && t === 'AM' && cand.codigos.some(function (c) { return MATERIAL_.anillasCuerda.test(c); }) && (d.codigosAM || []).some(function (c) { return MATERIAL_.anillasCuerda.test(c); })) { p -= 3.5; motivos.push('⚡ anillas y cuerda juntas en el mismo viaje al otro gimnasio'); }
      var tot = d.min[t] + (cand.min || 10), cap = t === 'AM' ? 60 : 120;
      if (tot > cap) { p += Math.ceil((tot - cap) / 10) * 2; malos.push('pasa de ' + cap + '′ en esa sesión'); }
      if (cand.codigos.some(function (c) { return d.codigos.indexOf(c) >= 0; })) { p += 3; malos.push('ese estímulo ya está ese día'); }
      var vecino = [ctx.dias[i - 1], ctx.dias[i + 1]].some(function (o) { return o && cand.codigos.some(function (c) { return o.codigos.indexOf(c) >= 0; }); });
      if (vecino) { p += 1; malos.push('el mismo estímulo en un día contiguo'); }
      var apz = sesgoAprendido_(cand.codigos, { iso: d.iso, codigosSesion: t === 'AM' ? (d.codigosAM || []) : d.codigos.filter(function (c) { return (d.codigosAM || []).indexOf(c) < 0; }), cargasAntes: ant.concat(i && ctx.dias[i - 1].duro ? ['DURA'] : []), cargasDespues: sig.concat(i < 6 && ctx.dias[i + 1].duro ? ['DURA'] : []) }, t);   // v0.26 · lo aprendido de tus cambios
      if (apz.p) { p += apz.p; apz.contra.forEach(function (m) { malos.push(m); }); }
      var sng = sinergia_(cand, d, t, i, ctx, hoy, ant, sig);   // v0.27 · lo que aporta ese hueco
      p += sng.p; sng.contra.forEach(function (m) { malos.push(m); });
      if (!malos.length) motivos.push('sin choques con Fabrik ni con los días de alrededor');
      sng.pro.forEach(function (m) { motivos.push(m); });
      apz.pro.forEach(function (m) { motivos.push(m); });
      if (t === 'AM' && cand.turno && cand.turno.indexOf('AM') >= 0) motivos.push('por la mañana, separado ≥6 h de la sesión de Fabrik');
      if (cand.duro && !malos.length) motivos.push('respeta ≥48 h con las otras sesiones duras');
      malos = malos.filter(function (m, j) { return malos.indexOf(m) === j; });
      out.push({ iso: d.iso, dia: diaDe_(d.iso), turno: t, puntos: Math.round(p * 10) / 10, motivos: motivos, choques: malos });
    });
  });
  return out.sort(function (a, b) { return a.puntos - b.puntos || (a.iso < b.iso ? -1 : 1); });
}
function candidatoDe_(r, cat) {
  var cods = codigosDe_(r['CÓDIGOS']), e = cods.map(function (c) { return cat[c]; }).filter(Boolean)[0] || {};
  var txt = r['TÍTULO'] + '\n' + (r.CONTENIDO || '');
  return { codigos: cods, carga: etiquetas_(e.CARGA || '').concat(cargasDe_(txt, r.INTENSIDAD)), evitar: etiquetas_(e.EVITAR || ''), min: parseFloat(String(r.MIN || e.MIN || '10').replace(',', '.')) || 10,
    turno: norm(r.ORIGEN) === 'FABRIK' ? 'AM|PM' : (e.TURNO || 'AM|PM'), duro: cods.some(function (c) { return /^(R01|R02|R03|R04|W04)$/.test(c); }) };
}
/** Para la app: mejores huecos de un bloque (al moverlo o editarlo). */
function posicionOptima_(b) {
  var lunes = lunesDe_(b.lunes || b.fecha), cat = catalogo_();
  var r = b.id ? listar_(HOJAS.PLAN).filter(function (x) { return x.ID === String(b.id); })[0] : null;
  r = Object.assign({}, r || {}, b.campos || {});
  if (!r['TÍTULO'] && !r['CÓDIGOS']) throw new Error('faltan_datos');
  var ctx = contextoSemana_(lunes, b.id), cand = candidatoDe_(r, cat), lista = puntuarHuecos_(cand, ctx);
  var todos = puntuarHuecos_(cand, ctx, true);
  var actual = r.FECHA && r.ESTADO !== 'SIN HUECO' ? todos.filter(function (h) { return h.iso === celdaIso_(r.FECHA) && h.turno === (norm(r.TURNO) === 'AM' ? 'AM' : 'PM'); })[0] : null;
  // v0.21 · todos los huecos de la semana: la app cambia de día o turno sin volver a preguntar al servidor
  return { mejores: lista.slice(0, 3), actual: actual || null, todos: todos.map(function (h) { return { iso: h.iso, turno: h.turno, dia: h.dia, choques: h.choques, motivos: h.motivos }; }), libre: cand.codigos.some(function (c) { return LIBRES_TURNO.test(c); }), modoAM: ctx.modoAM };
}

// ---------- 5 · Generar los extras de la semana («Cargar extras») ----------
var PRIO_ORDEN = function (p) { var m = String(p || '').match(/P(\d)/); return m ? +m[1] : 7; };
function weeksLeft_(lunes, per) { return Math.max(1, Math.round((Date.parse(per.hasta) - Date.parse(lunes)) / 864e5 / 7 + 0.5)); }
/**
 * «Cargar extras». Con opts.simular = true no escribe nada: devuelve el resumen para el aviso previo.
 * Prioridad: carrera (tests mandan) → refuerzos de la semana → pendientes → metas semanales → mensuales (17–27 % del total del mes).
 * «Endurance de mañana» (APP · CONFIG › endurance_manana = Sí): Z2 carrera/erg SOLO en mañanas libres; el domingo es el comodín;
 * si no cabe, queda «SIN HUECO» para que tú elijas día/turno o lo pases a pendientes. Endurance ≤35′ → se le añade 10–15′ de calidad.
 * Los bloques que mueves o editas a mano quedan con candado (GENERADO = «manual …»): rehacer no los toca.
 */
function enduranceManana_() { return /^(S[IÍ]|TRUE|1|ON)$/i.test(String(leerConfig_().endurance_manana || '').trim()); }
var LIBRES_TURNO = /^(R01|W04|W13|M49|M36|M37)$/;   // Z6–Z8, calidad en series, RMU y cuerda: AM o PM, donde tú quieras
function generarExtras_(lunes, opts) {
  opts = opts || {};
  var sim = !!opts.simular;
  lunes = lunesDe_(lunes);
  var conf = filaSemana_(lunes);
  if (!conf || !/Confirmada|Programada/.test(conf.ESTADO)) throw new Error('semana_sin_confirmar');
  if (!sim && !listar_(HOJAS.PLAN).some(function (r) { var d = celdaIso_(r.FECHA); return norm(r.ORIGEN) === 'FABRIK' && d >= lunes && d <= sumarDias(lunes, 6); })) cargarFabrikSemana_(lunes);
  var cat = catalogo_(), fin = sumarDias(lunes, 6), sello = 'auto ' + ahora_(), modoAM = enduranceManana_();
  // v0.18 · alcance: toda la semana, solo unos días, o «resto de semana» (los días que aún no se programaron; lo ya hecho se mantiene)
  var parcialPrev = {}; try { parcialPrev = JSON.parse(leerConfig_()['extras_parcial_' + lunes] || '{}'); } catch (e) { parcialPrev = {}; }
  var semanaIsos = [0, 1, 2, 3, 4, 5, 6].map(function (k) { return sumarDias(lunes, k); });
  var diasSel = null;
  if (opts.resto) diasSel = semanaIsos.filter(function (x) { return (parcialPrev.dias || []).indexOf(x) < 0; });
  else if (opts.dias && opts.dias.length) diasSel = semanaIsos.filter(function (x) { return opts.dias.indexOf(x) >= 0; });
  var permitidos = diasSel ? diasSel.reduce(function (a, x) { a[x] = 1; return a; }, {}) : null;
  var modoDesc = String(opts.descanso || 'nada');
  // v0.20.2 · reabrir: con el plan ya aprobado, lo automático aprobado desde hoy que no esté hecho ni con candado también se recoloca (vuelve a borrador)
  var hoyR = hoyIso_(), hechosR = {};
  if (opts.reabrir) listar_(HOJAS.REGISTRO).forEach(function (x) { if (x.ID_PLAN && x.HECHO === 'Sí') hechosR[x.ID_PLAN] = 1; });
  var esAuto = function (r) { var d = celdaIso_(r.FECHA); if (!(d >= lunes && d <= fin && (!permitidos || permitidos[d]) && /^auto/.test(r.GENERADO || ''))) return false;
    if (/^(BORRADOR|SIN HUECO)$/.test(r.ESTADO)) return true;
    return !!opts.reabrir && r.ESTADO === 'PROGRAMADO' && d >= hoyR && !hechosR[r.ID]; };
  // 6.1 · fuera los borradores automáticos anteriores (se regeneran); lo bloqueado con candado, lo tuyo y lo aprobado no se toca
  var refsLiberar = {}, pendLiberar = {};
  if (!sim) bloqueo_(function () {
    var sh = hojaMia_(HOJAS.PLAN), filas = [];
    listar_(HOJAS.PLAN).forEach(function (r) { if (esAuto(r)) { filas.push(r._fila); if (r.REFUERZO_ID) refsLiberar[r.REFUERZO_ID] = 1; if (r.PENDIENTE_ID) pendLiberar[r.PENDIENTE_ID] = 1; } });
    filas.sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
    MEMO = null;
    listar_(HOJAS.REFUERZOS).forEach(function (r) { if (refsLiberar[r.ID] && r.ESTADO === 'Programado') actualizarFila_(HOJAS.REFUERZOS, r._fila, { ESTADO: 'Pendiente' }); });
    listar_(HOJAS.PENDIENTES).forEach(function (r) { if (pendLiberar[r.ID] && (r.ESTADO === 'Propuesto' || (opts.reabrir && r.ESTADO === 'Reprogramado'))) actualizarFila_(HOJAS.PENDIENTES, r._fila, { ESTADO: 'Pendiente', 'SEMANA DESTINO': '' }); });
  });
  MEMO = null;
  var OP = null; try { OP = opSemana_(lunes); if (OP.cfg.existe) opSincronizarMetas_(OP); } catch (eOp) { Logger.log('Modo operación: ' + eOp); OP = null; }   // v0.27
  var ctx = contextoSemana_(lunes, null, sim ? esAuto : null), nuevos = [], sinHueco = [], log = [], anadidos = {};
  ctx.permitidos = permitidos; ctx.op = OP;
  if (OP && OP.enModo) log.push('Modo operación · ' + OP.fase + (OP.dosP ? ' · 2 P1–P4' : ''));
  // v0.19 · días que Gabi aún no ha subido: previsión por el perfil de la fase (lo aprendido de semanas anteriores)
  try {
    var pf = perfilSemana_(lunes), previstos = [];
    ctx.dias.forEach(function (d) {
      var P = pf[diaDe_(d.iso)]; if (d.fabrik || !P) return;
      if (P.pctDuro >= 60) { d.duro = true; previstos.push(diaDe_(d.iso).slice(0, 3).toLowerCase() + ' suele ser duro (' + P.pctDuro + ' %)'); }
      if (P.cargas.length) d.cargas.PM = d.cargas.PM.concat(P.cargas);
    });
    if (previstos.length) log.push('Previsión de ' + (Object.keys(pf).map(function (k) { return pf[k].fase; })[0] || 'la fase') + ': ' + previstos.join(', '));
  } catch (e) { Logger.log('Previsión por fase: ' + e); }
  var descansoZ2 = [];
  ctx.dias.forEach(function (d) {
    if (!d.descanso || (permitidos && !permitidos[d.iso])) return;
    if (modoDesc === 'extras' || modoDesc === 'ambos') { d.descanso = false; d.descansoAbierto = true; }
    if (modoDesc === 'z2' || modoDesc === 'ambos') descansoZ2.push(d);
  });
  if (diasSel) log.push((opts.resto ? 'Resto de semana: ' : 'Solo ') + diasSel.map(function (x) { return diaDe_(x).slice(0, 3).toLowerCase(); }).join(', '));
  var domingo = ctx.dias[6];
  var esEndurance = function (cand) { return cand.codigos.some(function (c) { return /^W0[123]$/.test(c); }) && !cand.codigos.some(function (c) { return /^(R01|W04)$/.test(c); }); };
  var colocar = function (o, cand, h) {
    var d = ctx.dias.filter(function (x) { return x.iso === h.iso; })[0];
    o.ID = nuevoId_(); o.FECHA = isoAFecha(h.iso); o['DÍA'] = h.dia; o.TURNO = h.turno; o.ORDEN = h.turno === 'AM' ? 10 + d.min.AM / 10 : 80 + d.min.PM / 10;
    var ante = ordenAntesMetcon_(o, cand, h, nuevos);   // v0.18 · extras antes del metcon, donde menos interfieren
    if (ante) { o.ORDEN = ante.orden; h.motivos = [ante.motivo].concat(h.motivos || []); }
    o.ESTADO = 'BORRADOR'; o.GENERADO = sello; o.ACTUALIZADO = ahora_(); o.BLOQUE = o['TÍTULO'];
    o['POR QUÉ (cursiva)'] = [o['POR QUÉ (cursiva)'], 'Va el ' + h.dia.toLowerCase() + ' ' + h.turno + ': ' + (h.motivos.join('; ') || 'mejor hueco disponible') + (h.choques.length ? ' (a vigilar: ' + h.choques.join('; ') + ')' : '') + '.'].filter(Boolean).join(' ');
    if (!esIntocable_(cand.codigos)) { d.nExtraX = d.nExtraX || { AM: 0, PM: 0 }; d.minExtraX = d.minExtraX || { AM: 0, PM: 0 }; d.nExtraX[h.turno]++; d.minExtraX[h.turno] += cand.min || 10; }
    d.min[h.turno] += cand.min || 10; d.nExtra[h.turno]++; d.cargas[h.turno] = d.cargas[h.turno].concat(cand.carga || []); d.codigos = d.codigos.concat(cand.codigos); if (cand.duro) d.duro = true;
    if (h.turno === 'AM') { d.codigosAM = (d.codigosAM || []).concat(cand.codigos);
      if (cand.codigos.some(function (c) { return /^(W01|W02|W04)$/.test(c); })) d.minCarreraAM = (d.minCarreraAM || 0) + (cand.min || 0);
      else if (!esEndurance(cand)) d.nExtraAMcal = (d.nExtraAMcal || 0) + 1; }
    cand.codigos.forEach(function (c) { anadidos[c] = (anadidos[c] || 0) + 1; });
    nuevos.push(o); return h;
  };
  var anadir = function (o, cand) {
    var endu = modoAM && esEndurance(cand);
    if (endu) cand.turno = 'AM';
    var lista = puntuarHuecos_(cand, ctx).filter(function (h) { return !endu || h.turno === 'AM'; });
    // Domingo comodín (solo endurance suave, solo si esa mañana está vacía)
    if (endu && !lista.length && domingo.descanso && !domingo.min.AM && !domingo.cargas.PM.length) {
      domingo.descanso = false; domingo.am = true;
      lista = puntuarHuecos_(cand, ctx).filter(function (h) { return h.iso === domingo.iso && h.turno === 'AM'; });
      domingo.descanso = true; domingo.am = false;
      if (lista[0]) lista[0].motivos.unshift('domingo como comodín: no quedaba ninguna mañana libre');
    }
    var h = lista[0];
    if (o._condicional) {   // v0.13 · 2.ª P integrada: solo si cabe (decisión de Pablo 6/11, manual v2.0)
      var mot = motivoSinR04_(h, ctx, tipoSem, lunes);
      if (mot) { sinR04 = mot; log.push('2.ª P integrada no programada: ' + mot); return false; }
    }
    if (!h) {
      sinHueco.push(o['TÍTULO']);
      if (endu) { o.ID = nuevoId_(); o.FECHA = isoAFecha(lunes); o['DÍA'] = ''; o.TURNO = 'AM'; o.ORDEN = 0; o.ESTADO = 'SIN HUECO'; o.GENERADO = sello; o.ACTUALIZADO = ahora_(); o.BLOQUE = o['TÍTULO'];
        o['POR QUÉ (cursiva)'] = 'No cabe en ninguna mañana libre (Endurance de mañana activo) y el domingo ya tiene actividad: elige tú día y turno o pásalo a pendientes.'; nuevos.push(o); }
      else log.push('Sin hueco para ' + o['TÍTULO']);
      return false;
    }
    colocar(o, cand, h);
    if (modoAM && endu && (cand.min || 0) <= 35) huecoCalidad.push({ iso: h.iso, titulo: o['TÍTULO'] });
    return true;
  };
  var deCatalogo = function (c, extra) {
    var e = cat[c] || {};
    return Object.assign({ ORIGEN: e.ORIGEN || 'EXTRA', 'TÍTULO': e.NOMBRE || c, CONTENIDO: (e.CONTENIDO || '') + (e['DATOS A REGISTRAR'] ? '\n\nRegistra: ' + e['DATOS A REGISTRAR'] : ''), INTENSIDAD: e.INTENSIDAD || '',
      MIN: e.MIN || 10, 'CÓDIGOS': c, 'POR QUÉ (cursiva)': e['POR QUÉ (cursiva)'] || '', 'CIENCIA (técnica · fisiología · biología)': e['CIENCIA (técnica · fisiología · biología)'] || '', INTERFERENCIAS: e.INTERFERENCIAS || '',
      CANTIDAD: saltosTexto_(e.CONTENIDO || '') || '' }, extra || {});
  };
  var candDe = function (o) { return candidatoDe_(o, cat); };
  var huecoCalidad = [];
  // 6.2 · carrera de la semana (pestaña «carrera») adaptada con el histórico; los tests sustituyen la calidad
  var ordenC = function (s) { var c = s['CÓDIGOS']; return /W04/.test(c) ? 0 : /R01/.test(c) ? 1 : /W01/.test(c) ? 2 : /W02/.test(c) ? 3 : 4; };
  var yaCarrera = function (c) { return ctx.dias.some(function (d) { return d.codigos.indexOf(c) >= 0 && d.fijos && d.fijos.indexOf(c) >= 0; }); };
  var CARR = carreraSemana_(lunes), tipoSem = CARR.semanaTipo || 'carga', sinR04 = '', EXC = excepcionSemana_(lunes);
  if (OP) try { CARR = opCarrera_(CARR, OP, cat); } catch (eOp2) { Logger.log('Modo operación · carrera: ' + eOp2); }
  try { var mesP = periodoMes_(lunes).etiqueta, faltaP = auditarProtocolosMes_().filter(function (x) { return x.mes === mesP; })[0];
    if (faltaP) log.push('⚠ ' + mesP + ': el plan de carrera no tiene ' + faltaP.faltan.join(', ') + ' (regla: al menos un P de cada tipo al mes)'); } catch (e) {}
  if (EXC) {   // semana sin requisito semanal: solo Z2 corta y ergo, suaves y opcionales; nada intenso ni metas
    CARR = CARR.filter(function (s) { return /^(W02|W03)$/.test(s['CÓDIGOS']); }).map(function (s) {
      return Object.assign(s, { 'TÍTULO': s['TÍTULO'] + ' · opcional', 'POR QUÉ (cursiva)': 'Semana sin requisito semanal (' + EXC + '): solo movimiento suave y opcional para llegar fresco. ' + (s['POR QUÉ (cursiva)'] || '') });
    });
    CARR.semanaTipo = tipoSem; log.push('Semana sin requisito semanal: ' + EXC);
  }
  // v0.16.3 · Z2 no hecha (pendiente, por cualquier vía) → la semana siguiente +25 % de sus minutos en la Z2 más larga del plan
  var z2Usados = {}, z2Pend = EXC ? [] : pendientesAbiertos_().filter(function (p) { return p._Z2 && p.ESTADO === 'Pendiente' && celdaIso_(p['FECHA ORIGINAL']) < lunes; });
  var z2Dest = CARR.filter(function (s) { return /\b(W01|W02)\b/.test(s['CÓDIGOS'] || ''); }).sort(function (a, b) { return (parseFloat(b.MIN) || 0) - (parseFloat(a.MIN) || 0); })[0];
  if (z2Pend.length && z2Dest) {
    var z2Extra = z2Pend.reduce(function (a, p) { return a + Math.max(5, Math.round((parseFloat(p._MIN) || 40) * 0.25)); }, 0);
    z2Dest.MIN = (parseFloat(z2Dest.MIN) || 0) + z2Extra;
    z2Dest.CONTENIDO = (z2Dest.CONTENIDO || '') + '\n\n+ ' + z2Extra + '′ más en Z2 (+25 % de la Z2 no hecha: ' + z2Pend.map(function (p) { return p['FECHA ORIGINAL']; }).join(', ') + '). Misma zona, conversacional.';
    z2Dest['POR QUÉ (cursiva)'] = (z2Dest['POR QUÉ (cursiva)'] || '') + ' Lleva +' + z2Extra + '′ por la Z2 que quedó pendiente (regla: +25 % la semana siguiente).';
    z2Pend.forEach(function (p) { z2Usados[p.ID] = 1; if (!sim) actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Propuesto', 'SEMANA DESTINO': isoAFecha(lunes), NOTAS: '+25 % sumado a la Z2 «' + z2Dest['TÍTULO'] + '»' }); });
    log.push('Z2 pendiente: +' + z2Extra + '′ en «' + z2Dest['TÍTULO'] + '»');
  }
  var yaSem = {};   // v0.18 · al completar solo unos días, lo que ya está programado en el resto de la semana cuenta
  if (permitidos) listar_(HOJAS.PLAN).forEach(function (r) { var dd = celdaIso_(r.FECHA); if (dd >= lunes && dd <= fin && !permitidos[dd] && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO) && norm(r.ORIGEN) === 'CARRERA') codigosDe_(r['CÓDIGOS']).forEach(function (k) { yaSem[k] = (yaSem[k] || 0) + 1; }); });
  descansoZ2.forEach(function (d) {
    var o = deCatalogo('W03', { 'TÍTULO': 'Z2 · recuperación (día de descanso)', MIN: 30, CONTENIDO: '25–30′ en Z2 muy suave: bici, remo, ski o trote ligero · RPE 2 · respiración por la nariz. Nada de series ni de cambios de ritmo.',
      'POR QUÉ (cursiva)': 'Lo pediste para tu día de descanso: flujo sanguíneo y recuperación activa sin sumar fatiga.' });
    var cand = candDe(o), h = { iso: d.iso, dia: diaDe_(d.iso), turno: d.am ? 'AM' : 'PM', motivos: ['día de descanso con Z2 de recuperación (elegido por ti)'], choques: [] };
    colocar(o, cand, h); o._prio = 'carrera';
  });
  CARR.sort(function (a, b) { return ordenC(a) - ordenC(b); }).forEach(function (s) {
    if (codigosDe_(s['CÓDIGOS']).every(yaCarrera)) return;                          // ya lo tienes con candado
    var kS = codigosDe_(s['CÓDIGOS'])[0]; if (kS && yaSem[kS] > 0) { yaSem[kS]--; return; }   // ya programado en los otros días de la semana
    var c = candDe(s); if (s.TURNO_FORZADO) c.turno = s.TURNO_FORZADO;
    // v0.13 · manual v2.0: la Z2 corta va el día de la Z2 de Fabrik
    if (s._fabrikZ2) {
      var hz = puntuarHuecos_(c, ctx, true).filter(function (h) { return h.iso === s._fabrikZ2.iso; })
        .sort(function (a, b) { var la = /no la tienes libre/.test(a.choques.join()) ? 1 : 0, lb = /no la tienes libre/.test(b.choques.join()) ? 1 : 0; return la - lb || (a.turno === 'AM' ? -1 : 1); })[0];
      if (hz) { hz.motivos = ['es la Z2 que pide Fabrik ese día (se registra una vez)'].concat(hz.motivos || []); hz.choques = (hz.choques || []).filter(function (m) { return !/Endurance de mañana|no la tienes libre/.test(m); }); colocar(s, c, hz); return; }
    }
    anadir(s, c);
  });
  // 6.3 · cola de prioridad del resto: refuerzos → pendientes → semanales → mensuales
  var cola = [];
  var refs = listar_(HOJAS.REFUERZOS).filter(function (r) { return celdaIso_(r.SEMANA) === lunes && r.ESTADO === 'Pendiente'; });
  refs.forEach(function (r) {
    var c = r['CÓDIGO'] || codigoDeTexto_(r.TEXTO, cat);
    var o = c ? deCatalogo(c, { 'POR QUÉ (cursiva)': 'Refuerzo que pediste: «' + r.TEXTO + '». ' + ((cat[c] || {})['POR QUÉ (cursiva)'] || '') })
      : { ORIGEN: 'EXTRA', 'TÍTULO': 'Refuerzo · ' + r.TEXTO, CONTENIDO: r.TEXTO + (r.NOTAS ? '\n' + r.NOTAS : '') + '\n\n10–15′ de calidad, sin fallo. Ajusta la dosis en la app.', MIN: 12, 'CÓDIGOS': '', 'POR QUÉ (cursiva)': 'Refuerzo que pediste para esta semana.' };
    o.REFUERZO_ID = r.ID; o._prio = 'refuerzo';
    cola.push({ o: o, al: function () { if (!sim) actualizarFila_(HOJAS.REFUERZOS, r._fila, { ESTADO: 'Programado', 'CÓDIGO': c || '' }); } });
  });
  var pausaP = pausaCodigos_();
  pendientesAbiertos_().filter(function (p) { return !EXC && p.ESTADO === 'Pendiente' && celdaIso_(p['FECHA ORIGINAL']) < lunes && !z2Usados[p.ID] && !/EN PAUSA/.test(p.NOTAS || '') && !(pausaP.length && codigosDe_((listar_(HOJAS.PLAN).filter(function (r) { return r.ID === p.ID_PLAN; })[0] || {})['CÓDIGOS']).some(function (c) { return pausaP.indexOf(c) >= 0; })); }).forEach(function (p) {
    var orig = listar_(HOJAS.PLAN).filter(function (r) { return r.ID === p.ID_PLAN; })[0] || {};
    var z2m = p._Z2 ? Math.max(10, Math.round((parseFloat(p._MIN) || 40) * 0.25)) : 0;
    if (!z2m && p._MAS25) { p._MIN = Math.round((parseFloat(p._MIN || orig.MIN) || 30) * 1.25); p._CONTENIDO = '+25 % DE VOLUMEN (lo pediste al dejarlo pendiente): ' + p._MIN + '′ en total, misma intensidad.\n\n' + (p._CONTENIDO || orig.CONTENIDO || ''); }
    var o = { ORIGEN: orig.ORIGEN && norm(orig.ORIGEN) !== 'FABRIK' ? orig.ORIGEN : 'EXTRA', 'TÍTULO': (z2m ? 'Z2 extra +25 % · ' : 'Pendiente · ') + (p.BLOQUE || orig['TÍTULO'] || ''),
      CONTENIDO: z2m ? z2m + '′ de Z2 suave (conversación, misma zona): el 25 % de la Z2 no hecha del ' + p['FECHA ORIGINAL'] + '.' : (p._CONTENIDO || orig.CONTENIDO || ''), MIN: z2m || p._MIN || orig.MIN || 15,
      'CÓDIGOS': orig['CÓDIGOS'] || '', INTENSIDAD: orig.INTENSIDAD || '', 'POR QUÉ (cursiva)': 'Recolocado desde el ' + p['FECHA ORIGINAL'] + (p.MOTIVO ? ' (' + p.MOTIVO + ')' : '') + '. Solo cuenta cuando lo hagas.', PENDIENTE_ID: p.ID, _prio: 'pendiente' };
    cola.push({ o: o, al: function () { if (!sim) actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Propuesto', 'SEMANA DESTINO': isoAFecha(lunes) }); } });
  });
  var cub = function (c) { return ctx.dias.reduce(function (a, d) { return a + d.codigos.filter(function (x) { return x === c; }).length; }, 0); };
  var enCola = function (c) { return cola.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).indexOf(c) >= 0; }).length; };
  var metas = EXC ? [] : listar_(HOJAS.METAS).filter(function (m) { return m.ACTIVA !== 'No'; });
  metas.filter(function (m) { return m['ÁMBITO'] === 'Semana' && String(m.TIPO || 'COUNT') === 'COUNT'; }).sort(function (a, b) { return PRIO_ORDEN(a.PRIORIDAD) - PRIO_ORDEN(b.PRIORIDAD); }).forEach(function (m) {
    var cods = codigosDe_(m['CÓDIGOS']), falta = (parseFloat(m.META) || 0) * factorMeta_(m, lunes, 'Semana').f - cods.reduce(function (a, c) { return a + cub(c) + enCola(c); }, 0);
    var c = cods.filter(function (x) { return cat[x] && cat[x].CONTENIDO; })[0];
    for (var k = 0; k < falta && c; k++) {
      var o = deCatalogo(c);
      if (c === 'R04') { var pr01 = nuevos.concat(listar_(HOJAS.PLAN)).filter(function (r) { var d = celdaIso_(r.FECHA); return /R01/.test(r['CÓDIGOS']) && d >= lunes && d <= sumarDias(lunes, 6); })[0];
        o = bloqueIntegrado_(o, lunes, pr01 ? ((norm(pr01['TÍTULO']).match(/\bP([1-4])\b/) || [])[0] || '') : ''); }
      if (c === 'R04') o._condicional = !(OP && OP.dosP);   // v0.27 · modo operación (previa, vuelta y regla residual): la 2.ª P es obligatoria, bien colocada
      dosisPorAmbito_(o, 'Semana'); o._prio = 'semana'; cola.push({ o: o });
    }
  });
  var per = periodoMes_(lunes), mensuales = metas.filter(function (m) { return m['ÁMBITO'] === 'Mes' && String(m.TIPO || 'COUNT') === 'COUNT' && !/^R0/.test(m['CÓDIGOS']); });
  var total = mensuales.reduce(function (a, m) { return a + metaDe_(m, per.mes); }, 0);
  var hechoMes = avanceMetas_('Mes', per, cacheMetas_());
  var objetivo = Math.round(total * 0.22), minimo = Math.ceil(total * 0.17), maximo = Math.floor(total * 0.27), tope = Math.max(minimo, Math.min(objetivo, maximo));
  var mensDe = function (c) { return mensuales.filter(function (m) { return codigosDe_(m['CÓDIGOS']).indexOf(c) >= 0; })[0]; };
  var enSemana = mensuales.reduce(function (a, m) { return a + Math.min(metaDe_(m, per.mes), codigosDe_(m['CÓDIGOS']).reduce(function (s, c) { return s + cub(c); }, 0)); }, 0);
  var colaMes = mensuales.map(function (m) {
    var av = hechoMes.filter(function (x) { return x.id === m.ID; })[0] || { programado: 0 }, meta = metaDe_(m, per.mes) * factorMeta_(m, per.desde, 'Mes').f;
    var resta = Math.max(0, meta - av.programado - codigosDe_(m['CÓDIGOS']).reduce(function (s, c) { return s + enCola(c); }, 0));
    return { m: m, resta: resta, urg: resta / weeksLeft_(lunes, per) - PRIO_ORDEN(m.PRIORIDAD) * 0.05 + pesoObjetivo_(m) + sesgoCiclo_(codigosDe_(m['CÓDIGOS']), cicloExtras_(lunes)) };   // v0.27 · rendimiento → skills y carencias → resto
  }).filter(function (x) { return x.resta > 0; }).sort(function (a, b) { return b.urg - a.urg; });
  var mesEnCola = cola.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).some(mensDe); }).length;
  for (var i = 0, vueltas = 0; i < colaMes.length && enSemana + mesEnCola < tope && vueltas < 200; i++, vueltas++) {
    var c = codigosDe_(colaMes[i].m['CÓDIGOS']).filter(function (x) { return cat[x] && cat[x].CONTENIDO; })[0];
    if (!c) continue;
    var o = dosisPorAmbito_(deCatalogo(c), 'Mes'); o._prio = 'mes'; cola.push({ o: o }); mesEnCola++;
    colaMes[i].resta--; if (colaMes[i].resta > 0 && colaMes[i].urg > 1) i--;
  }
  // 6.3b · SALTOS de la semana (meta tipo SALTOS, W07): nunca se quedan sin cubrir.
  //   Regla de Pablo: o una sesión de pliometría aparte, o comba doble metida en un estímulo del mes a 4 DU por cada salto que falte.
  metas.filter(function (m) { return m['ÁMBITO'] === 'Semana' && String(m.TIPO || '').toUpperCase() === 'SALTOS'; }).forEach(function (m) {
    var meta = parseFloat(String(m.META).replace(',', '.')) || 0, cods = codigosDe_(m['CÓDIGOS']);
    if (!meta) return;
    var tiene = function (r) { return codigosDe_(r['CÓDIGOS']).some(function (c) { return cods.indexOf(c) >= 0; }); };
    var enPlan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO) && !(sim && esAuto(r)) && tiene(r); });
    var hay = enPlan.concat(nuevos).filter(tiene).reduce(function (a, r) { return a + saltosDe_(r); }, 0) + cola.filter(function (x) { return tiene(x.o); }).reduce(function (a, x) { return a + saltosDe_(x.o); }, 0);
    var falta = Math.ceil(meta - hay);
    if (falta <= 0) return;
    var anfitrion = falta <= 50 ? cola.filter(function (x) { return x.o._prio === 'mes' && norm(x.o.ORIGEN) !== 'CARRERA'; })[0] : null;
    if (anfitrion) {
      var du = falta * 4, o = anfitrion.o, base = saltosDe_(o) || 0;
      o.CONTENIDO = (o.CONTENIDO || '') + '\n\n+ ' + du + ' DOUBLE UNDERS repartidos en series sin fallo (cubren los ' + falta + ' saltos que faltan esta semana: 4 DU = 1 salto).';
      o.CANTIDAD = base + falta;
      o['CÓDIGOS'] = codigosDe_(o['CÓDIGOS']).concat(cods.filter(function (c) { return codigosDe_(o['CÓDIGOS']).indexOf(c) < 0; })).join('|');
      o.MIN = (parseFloat(o.MIN) || 10) + Math.ceil(du / 60) + 2;
      o['POR QUÉ (cursiva)'] = [o['POR QUÉ (cursiva)'], 'Lleva ' + du + ' DU para cubrir los ' + falta + ' saltos de pliometría que faltaban (regla 4×).'].filter(Boolean).join(' ');
      log.push('Saltos: +' + du + ' DU dentro de «' + o['TÍTULO'] + '» (cubren ' + falta + ')');
    } else {
      // Hasta 50: box jump + broad jump de 5 en 5. Lo que pase de 50, en pogos de 10 (más baratos para el tendón y el SNC).
      var pogo = falta > 50 ? Math.ceil((falta - 50) / 10) : 0, series = Math.max(2, Math.ceil(Math.min(falta, 50) / 5)), cajon = Math.ceil(series / 2), largo = series - cajon, total = pogo * 10 + series * 5;
      var o2 = deCatalogo(cods[0] || 'W07', {
        'TÍTULO': 'Pliometría · ' + total + ' saltos', CANTIDAD: total, MIN: Math.max(10, Math.round(total / 5)),
        CONTENIDO: (pogo ? pogo + '×10 pogo jumps (rebote rápido, rodilla casi bloqueada) + ' : '') + cajon + '×5 box jump (bajando del cajón, aterrizaje en 2″) + ' + largo + '×5 broad jump con pausa de 2″ al caer · 60–90″ entre series. ' + total + ' saltos de calidad: si la técnica cae, para.',
        'POR QUÉ (cursiva)': 'Faltaban ' + falta + ' saltos para la meta semanal de ' + meta + '. Antes de pierna pesada o haltero, nunca después.' });
      o2._prio = 'semana'; cola.unshift({ o: o2 });
      log.push('Saltos: sesión de pliometría de ' + total + ' (faltaban ' + falta + ')');
    }
  });
  // v0.24 · la zancada con barra (M61) va en el mismo bloque que la búlgara (M45) si coinciden: un estímulo más sin otra sesión
  (function () { var b = cola.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).indexOf('M45') >= 0; })[0], z = cola.filter(function (x) { return codigosDe_(x.o['CÓDIGOS']).indexOf('M61') >= 0; })[0];
    if (b && z && b !== z) { b.o['TÍTULO'] = 'Búlgara + zancada con barra'; b.o.CONTENIDO += '\n\n+ ZANCADA CON BARRA (front o back rack): 2×6+6 · RPE 7'; b.o['CÓDIGOS'] = codigosDe_(b.o['CÓDIGOS']).concat(['M61']).join('|'); b.o.MIN = String((parseFloat(b.o.MIN) || 10) + 5); cola.splice(cola.indexOf(z), 1); } })();
  if (OP && OP.enModo && OP.fase !== 'PREVIA' && OP.post < 5) cola = cola.filter(function (x) { return /^OP/.test(x.o['CÓDIGOS'] || '') || (x.o._prio === 'semana' && /W03|W10/.test(x.o['CÓDIGOS'] || '')); });   // v0.27 · reposo y vuelta: solo lo del modo
  // 6.4 · endurance corta (≤35′) por la mañana: se le suma 10–15′ de calidad, lo que más falte (orden de la cola)
  huecoCalidad.forEach(function (hq) {
    for (var k = 0; k < cola.length; k++) {
      var x = cola[k], cand = candDe(x.o);
      var dq = ctx.dias.filter(function (y) { return y.iso === hq.iso; })[0];
      var esRun = dq && dq.minCarreraAM, libreMin = esRun ? 15 : Math.min(15, 45 - (dq ? dq.min.AM : 0));
      if (!dq || dq.nExtraAMcal >= 1 || libreMin < 6 || (cand.min || 10) > Math.max(libreMin, 10) || cand.duro || esEndurance(cand)) continue;
      var h = puntuarHuecos_(cand, ctx).filter(function (y) { return y.iso === hq.iso && y.turno === 'AM'; })[0];
      if (!h) {   // la mañana es del endurance: se fuerza el hueco aunque la mañana no esté marcada como libre (ej. domingo comodín)
        var d = ctx.dias.filter(function (y) { return y.iso === hq.iso; })[0];
        h = { iso: hq.iso, dia: diaDe_(hq.iso), turno: 'AM', motivos: [], choques: [] };
        if (!d) continue;
      }
      h.motivos = ['tras «' + hq.titulo + '» (≤35′): se aprovecha la mañana con 10–15′ de calidad'].concat(h.motivos || []);
      x.o.MIN = Math.min(libreMin, +x.o.MIN || 12);
      colocar(x.o, cand, h); if (x.al) x.al(); cola.splice(k, 1); break;
    }
  });
  // 6.5 · el resto de la cola, por prioridad
  cola.forEach(function (x) { if (anadir(x.o, candDe(x.o)) && x.al) x.al(); });
  try { ajustarNuevos_(nuevos, lunes, log); } catch (eAj) { Logger.log('ajustarNuevos: ' + eAj); }   // v0.28
  try {   // v0.29 · ensayo de Murph con chaleco y test de WODs del taper
    var yaV29 = {}; listar_(HOJAS.PLAN).forEach(function (r) { var d = celdaIso_(r.FECHA); if (d >= lunes && d <= sumarDias(lunes, 6) && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO) && /(^|\|)(MU1|CT1)(\||$)/.test(r['CÓDIGOS'] || '')) yaV29[codigosDe_(r['CÓDIGOS'])[0]] = 1; });
    murphBloquesSemana_(lunes).concat(taperBloques_(lunes)).forEach(function (b) {
      var c = codigosDe_(b['CÓDIGOS'])[0]; if (yaV29[c]) return; var iso = celdaIso_(b.FECHA);
      nuevos.push(Object.assign({ ID: nuevoId_(), 'DÍA': diaDe_(iso), ORDEN: 8, BLOQUE: b['TÍTULO'], INTENSIDAD: '🔴 Intenso', ESTADO: 'BORRADOR', GENERADO: sello, ACTUALIZADO: ahora_() }, b, { 'DÍA': diaDe_(iso) }));
      log.push(c === 'MU1' ? 'Ensayo de Murph con chaleco' : 'Taper: test de WODs + estrategia');
    });
  } catch (eV29) { Logger.log('Murph/taper: ' + eV29); }
  if (OP) try { nuevos = nuevos.concat(opBloques_(lunes, OP, sello, permitidos)); } catch (eOp3) { Logger.log('Modo operación · bloques: ' + eOp3); }
  // 6.6 · escribir (o devolver la simulación)
  var mensualesSemana = enSemana + nuevos.filter(function (o) { return o.ESTADO !== 'SIN HUECO' && codigosDe_(o['CÓDIGOS']).some(mensDe); }).length;
  var pct = total ? Math.round(mensualesSemana / total * 100) : 0;
  var colocados = nuevos.filter(function (o) { return o.ESTADO !== 'SIN HUECO'; });
  var resumen = colocados.length + ' bloques en borrador · mensuales ' + mensualesSemana + '/' + total + ' (' + pct + ' %, objetivo 17–27 %)' +
    (sinHueco.length ? ' · sin hueco: ' + sinHueco.join(', ') : '') + (log.length ? ' · ' + log.join(' · ') : '');
  var previa = { modoAM: modoAM, mananas: ctx.dias.filter(function (d) { return d.am && !d.descanso; }).map(function (d) { return diaDe_(d.iso); }),
    endurance: colocados.filter(function (o) { return esEndurance(candDe(o)); }).map(function (o) { return o['TÍTULO'] + ' → ' + o['DÍA'] + ' ' + o.TURNO; }),
    refuerzos: refs.map(function (r) { return r.TEXTO; }), pendientes: cola.length >= 0 ? nuevos.filter(function (o) { return o.PENDIENTE_ID; }).map(function (o) { return o['TÍTULO']; }) : [],
    sinHueco: sinHueco, sinR04: sinR04, excepcion: EXC, bloques: colocados.map(function (o) { return { titulo: o['TÍTULO'], dia: o['DÍA'], turno: o.TURNO, min: o.MIN, codigos: o['CÓDIGOS'], prio: o._prio || 'carrera' }; }), pctMes: pct, resumen: resumen };
  previa.yaCuenta = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && norm(r.ORIGEN) !== 'FABRIK' && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO) && !esAuto(r); })
    .map(function (r) { return { titulo: r['TÍTULO'], dia: diaDe_(celdaIso_(r.FECHA)), turno: r.TURNO, estado: r.ESTADO }; });
  previa.dias = diasSel || semanaIsos;
  if (sim) return previa;
  nuevos.forEach(function (o) { delete o._prio; delete o._fabrikZ2; delete o._condicional; });
  if (sinR04) ponerConfig_('r04_' + lunes, sinR04, '2.ª P integrada: motivo por el que no se programó esa semana');
  if (EXC) ponerConfig_('excepcion_' + lunes, EXC, 'Semana sin requisito semanal: motivo');
  asegurarColumna_(HOJAS.PLAN, 'REFUERZO_ID'); asegurarColumna_(HOJAS.SEMANAS, 'BALANCE ESTÍMULOS'); asegurarColumna_(HOJAS.PLAN, 'ALTERNATIVAS');
  if (nuevos.length) bloqueo_(function () {
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh);
    sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, nuevos.length, cab.length).setValues(nuevos.map(function (o) { return filaDe_(cab, o); }));
  });
  MEMO = null;
  interferenciasFabrik_(lunes);
  ponerConfig_('extras_' + lunes, ahora_() + ' · ' + resumen, 'Último «Cargar extras» de esa semana');
  if (diasSel && !opts.resto) { var uni = (parcialPrev.dias || []).concat(diasSel).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    ponerConfig_('extras_parcial_' + lunes, uni.length >= 7 ? '' : JSON.stringify({ dias: uni, descanso: modoDesc }), 'Extras programados solo para unos días: queda «Programar resto de semana»'); }
  else ponerConfig_('extras_parcial_' + lunes, '', 'Extras programados solo para unos días: queda «Programar resto de semana»');
  try { escribirBalance_(lunes, 'Plan'); } catch (e) { Logger.log('Balance: ' + e); }
  try { MEMO = null; procesarDeathnote_(); fotoSemana_(lunes, 'PROPUESTA', diasSel || null); } catch (e) { Logger.log('Aprendizaje · foto: ' + e); }   // v0.26
  return { creados: colocados.length, sinHueco: sinHueco, pctMes: pct, resumen: resumen };
}
/**
 * v0.18 · Posición de un extra dentro de una sesión con Fabrik: SIEMPRE antes del metcon, en el hueco que menos interferencia genera
 * con el bloque de antes y el de después (cargas compartidas). Nunca antes del primer bloque (el calentamiento y la haltero van frescos).
 * Carrera, ergos y Z6–Z8 no se mueven: van al final o en sesión aparte (manual: los sprints, 10′ después de la barra).
 */
function ordenAntesMetcon_(o, cand, h, nuevos) {
  if (/CARRERA|Z6/.test(norm(o.ORIGEN)) || (cand.codigos || []).some(function (k) { return /^(W0[1-4]|R0[1-4])$/.test(k); })) return null;
  var act = function (r) { return !/NO HACER|CANCELADO|SUSTITUIDO|SIN HUECO/.test(norm(r.ESTADO)); };
  var filas = listar_(HOJAS.PLAN).concat(nuevos).filter(function (r) { return celdaIso_(r.FECHA) === h.iso && r.TURNO === h.turno && act(r) && r.ID !== o.ID; })
    .sort(function (a, b) { return (parseFloat(a.ORDEN) || 0) - (parseFloat(b.ORDEN) || 0); });
  var im = -1; filas.forEach(function (r, k) { if (im < 0 && /METCON/.test(norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || '') + ' ' + String(r.CONTENIDO || '').slice(0, 20)))) im = k; });
  if (im < 0) return null;   // sin metcon: se queda al final
  if (im === 0) return { orden: (parseFloat(filas[0].ORDEN) || 50) - 1, motivo: 'antes del metcon (es el primer bloque de la sesión)' };
  var mia = cand.carga || [], comp = function (r) { var cr = cargasFila_(r); return mia.filter(function (x) { return cr.indexOf(x) >= 0; }); };
  var mejor = null;
  for (var j = 1; j <= im; j++) {
    var a = filas[j - 1], b = filas[j], ca = comp(a), cb = comp(b), pts = ca.length + cb.length * 1.2;
    if (!mejor || pts < mejor.pts || (pts === mejor.pts && j > mejor.j)) mejor = { j: j, pts: pts, a: a, b: b, ca: ca, cb: cb };
  }
  var oa = parseFloat(mejor.a.ORDEN) || 0, ob = parseFloat(mejor.b.ORDEN) || oa + 1;
  var orden = Math.round((oa + (ob - oa) / 2) * 100) / 100;
  var tit = function (r) { return '«' + (r['TÍTULO'] || r.BLOQUE || '') + '»'; };
  var comparte = mejor.ca.concat(mejor.cb).filter(function (x, i, l) { return l.indexOf(x) === i; });
  return { orden: orden, motivo: 'entre ' + tit(mejor.a) + ' y ' + tit(mejor.b) + ', antes del metcon: ' + (comparte.length ? 'es donde menos se solapa (comparte ' + comparte.join(', ').toLowerCase() + ')' : 'no comparte carga con los bloques de al lado') };
}
/** Balance de estímulos de la semana en APP · SEMANAS (al cargar extras y al cerrar la semana). */
function escribirBalance_(lunes, momento) {
  MEMO = null;
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); });
  var reg = listar_(HOJAS.REGISTRO).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6); });
  var hecho = {}; reg.forEach(function (r) { hecho[r.ID_PLAN] = r.HECHO; });
  var cods = function (l) { var o = {}; l.forEach(function (r) { codigosDe_(r['CÓDIGOS']).forEach(function (c) { o[c] = (o[c] || 0) + 1; }); }); return Object.keys(o).sort().map(function (c) { return c + (o[c] > 1 ? '×' + o[c] : ''); }).join(' '); };
  var vivos = plan.filter(function (r) { return /PROGRAMADO|BORRADOR/.test(r.ESTADO); });
  var fab = vivos.filter(function (r) { return norm(r.ORIGEN) === 'FABRIK'; }), ext = vivos.filter(function (r) { return norm(r.ORIGEN) !== 'FABRIK'; });
  var sin = plan.filter(function (r) { return r.ESTADO === 'SIN HUECO'; }), nh = plan.filter(function (r) { return r.ESTADO === 'NO HACER'; });
  var m = metasDe_(lunes), sem = m.semana, mes = m.mes;
  var txt = momento + ' ' + ahora_() + ' · Fabrik: ' + (cods(fab) || '—') + ' · Extras: ' + (cods(ext) || '—') +
    (sin.length ? ' · Sin hueco: ' + sin.map(function (r) { return r['TÍTULO']; }).join(', ') : '') +
    (nh.length ? ' · No hacer → pendientes: ' + nh.map(function (r) { return r['TÍTULO']; }).join(', ') : '') +
    ' · Semana: ' + sem.cubiertas + '/' + sem.total + ' metas' + (sem.metas.filter(function (x) { return !x.cubierta; }).length ? ' (faltan: ' + sem.metas.filter(function (x) { return !x.cubierta; }).map(function (x) { return x.estimulo; }).join(', ') + ')' : '') +
    ' · Mes ' + mes.etiqueta + ': ' + Math.round(mes.pctProg * 100) + ' % programado, ' + Math.round(mes.pctReal * 100) + ' % hecho' +
    (momento === 'Cierre' ? ' · Hechos ' + reg.filter(function (r) { return r.HECHO === 'Sí'; }).length + '/' + vivos.filter(function (r) { return r.ESTADO === 'PROGRAMADO'; }).length + ' bloques' : '');
  asegurarColumna_(HOJAS.SEMANAS, 'BALANCE ESTÍMULOS');
  var x = filaSemana_(lunes);
  if (x) actualizarFila_(HOJAS.SEMANAS, x._fila, { 'BALANCE ESTÍMULOS': txt.slice(0, 4500) });
  return txt;
}
function codigoDeTexto_(txt, cat) {
  var t = norm(txt);
  var ALIAS = [[/PISTOL/, 'M19'], [/\bOH\b|OVERHEAD|ESTABILIDAD OH/, 'M58'], [/BULGAR/, 'M45'], [/COPENHAG/, 'M46'], [/HIP THRUST|GLUTEO/, 'M28'], [/CORE/, 'M08'], [/CUERDA|ROPE/, 'M36'],
    [/TRINEO|SLED/, 'M38'], [/PINO|HANDSTAND/, 'W33'], [/HSW|PIRUETA/, 'W32'], [/HSPU ESTRICT|STRICT HSPU/, 'W17'], [/HSPU/, 'W15'], [/RMU|MUSCLE UP ANILLAS/, 'W13'], [/SNATCH BALANCE/, 'W20'],
    [/SPLIT JERK/, 'W23'], [/SALTO|PLIOM/, 'W07'], [/TRIPLE/, 'M35'], [/CROSSOVER/, 'M32'], [/PULLOVER/, 'M31'], [/SANDBAG|SLAM/, 'M57'], [/MOVILIDAD|ESCAP/, 'W10']];
  for (var i = 0; i < ALIAS.length; i++) if (ALIAS[i][0].test(t) && cat[ALIAS[i][1]]) return ALIAS[i][1];
  var cods = Object.keys(cat);
  for (var j = 0; j < cods.length; j++) { var re = reSeguro_(cat[cods[j]]['DETECTAR (regex)']); if (re && re.test(t)) return cods[j]; }
  return '';
}
/** Sesiones de carrera de la semana desde la pestaña «carrera» + ajustes del histórico (calculados el domingo a las 22 h). */
function carreraSemana_(lunes) {
  var sh = miLibro_().getSheetByName('carrera'); if (!sh) return [];
  var g = sh.getRange(1, 1, Math.min(sh.getLastRow(), 400), 7).getDisplayValues();
  var ini = (String(g[1] && g[1][0]).match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i) || []);
  var MES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12 };
  if (!ini[1]) return [];
  var base = ini[3] + '-' + ('0' + MES[norm(ini[2])]).slice(-2) + '-' + ('0' + ini[1]).slice(-2), nSem = Math.round((Date.parse(lunes) - Date.parse(lunesDe_(base))) / 864e5 / 7) + 1;
  var dentro = false, out = [], titulo = '';
  g.forEach(function (r) {
    var t = String(r[0]).trim(), m = t.match(/^(\d{2})\s*·/);
    if (m) { dentro = +m[1] === nSem; if (dentro) titulo = t; return; }
    if (!dentro || !t || r.slice(1).every(function (c) { return !String(c).trim(); })) return;
    // v0.13 (manual v2.0 §15): «SPRINT · aceleraciones» = V01; un P3 con SPR2 dentro cuenta R01 y V01 en una sola sesión
    var nt = norm(t), cod = /Z2.*LARGA/.test(nt) ? 'W01|W02' : /Z2/.test(nt) ? 'W02' : /CALIDAD.*Z5|VO2/.test(nt) ? 'W04|R03' : /CALIDAD/.test(nt) ? 'W04|R02' : /ERG/.test(nt) ? 'W03' : /^SPRINT|ACELERACI/.test(nt) ? 'V01' : /POTENCIA|Z6|Z8|RSA/.test(nt) ? 'R01' + (/SPR\d|SPRINT/.test(nt) ? '|V01' : '') : '';
    if (!cod || /OPCIONAL/.test(nt)) return;
    var min = (String(r[1]).match(/≈\s*(\d+)\s*[′']/) || [])[1] || (/W04/.test(cod) ? 45 : (String(r[1]).match(/(\d+)\s*[′']/) || [])[1]);
    if (/W04/.test(cod)) min = Math.max(+min || 0, 45);   // v0.13: en la calidad, «≈N′» es el TRABAJO; la sesión completa ronda 45′
    out.push({ ORIGEN: /R01/.test(cod) ? 'Z6–Z8' : 'CARRERA', 'TÍTULO': t, CONTENIDO: r[1] + (r[2] ? '\n\nReferencia: ' + r[2] : '') + (r[3] ? '\nZona: ' + r[3] : '') + '\n\nRegistra: ' + ((catalogo_()[cod.split('|')[0]] || {})['DATOS A REGISTRAR'] || 'tiempo, RPE y sensaciones'),
      INTENSIDAD: /R01/.test(cod) ? '🔴 Z6–Z8' : /W04/.test(cod) ? '🟠 Calidad' : /V01/.test(cod) ? '🔴 Velocidad' : '🔵 Z2', MIN: min || (/W01/.test(cod) ? 60 : /R01/.test(cod) ? 20 : /V01/.test(cod) ? 20 : 35), 'CÓDIGOS': cod,
      'POR QUÉ (cursiva)': 'Plan de carrera · ' + titulo.split('·').slice(1).join('·').trim(), 'CIENCIA (técnica · fisiología · biología)': (catalogo_()[cod.split('|')[0]] || {})['CIENCIA (técnica · fisiología · biología)'] || '',
      INTERFERENCIAS: (catalogo_()[cod.split('|')[0]] || {}).INTERFERENCIAS || '', TURNO_FORZADO: /R01/.test(cod) ? 'PM' : '' });
  });
  // v0.11 · Q con alternativas (la del plan es la recomendada) y Z6–Z8 elegido de la biblioteca según tus carencias
  out = out.map(function (s) {
    if (/R01/.test(s['CÓDIGOS'])) { try { var b68 = bloqueZ68_(s, lunes); if (/V01/.test(s['CÓDIGOS'])) { b68.CONTENIDO = s.CONTENIDO; b68['TÍTULO'] = 'POTENCIA · ' + s['TÍTULO'].replace(/^POTENCIA\s*·\s*/i, ''); b68['CÓDIGOS'] = codigosDe_(b68['CÓDIGOS']).concat(['V01']).filter(function (c, i, a) { return a.indexOf(c) === i; }).join('|'); } return b68; } catch (e) { return s; } }
    if (/W04/.test(s['CÓDIGOS'])) { try { s.ALTERNATIVAS = alternativasQ_(s); } catch (e) {} }
    return s;
  });
  out = reglasManualV2_(out, lunes, titulo);
  // Ajustes del histórico (domingo 22:00)
  var aj = {}; try { aj = ajusteCarrera_(sumarDias(lunes, -7)); } catch (e) { try { aj = JSON.parse(PROPS.getProperty('CARRERA_AJUSTE') || '{}'); } catch (e2) {} }   // v0.26 · con el feedback de la semana anterior, en directo
  out.forEach(function (s) {
    if (aj.z2min && /W01/.test(s['CÓDIGOS'])) s.MIN = Math.min(75, Math.round((parseFloat(s.MIN) || 60) * 1.1), (parseFloat(s.MIN) || 60) + aj.z2min);
    var k = /R01/.test(s['CÓDIGOS']) ? 'potencia' : /W04/.test(s['CÓDIGOS']) ? 'calidad' : /W0[12]/.test(s['CÓDIGOS']) ? 'z2' : '';
    if (k && aj[k]) s.CONTENIDO = '⚙ Ajuste por tu feedback de la semana anterior: ' + aj[k] + '\n\n' + s.CONTENIDO;
  });
  // Semana de test: el test sustituye la calidad
  eventosEntre_(lunes, sumarDias(lunes, 6)).filter(function (e) { return /^Test/i.test(e.EVENTO); }).forEach(function (e) {
    var q = out.filter(function (s) { return /W04/.test(s['CÓDIGOS']); })[0];
    var t = { ORIGEN: 'CARRERA', 'TÍTULO': e.EVENTO, CONTENIDO: '15′ calentamiento + 3×15″ progresivos · ' + e.EVENTO + ' a tope · 10′ suaves.\n\n' + (e['CÓMO PROCEDER'] || '') + '\n\nRegistra: tiempo total, parciales por km, FC media y máx, RPE.',
      INTENSIDAD: '🔴 Test', MIN: /10/.test(e.EVENTO) ? 75 : 40, 'CÓDIGOS': q ? q['CÓDIGOS'] : 'W04', 'POR QUÉ (cursiva)': 'Test de la semana: sustituye la calidad. Descansado, sin Z6–Z8 ni pierna pesada el día antes.', INTERFERENCIAS: 'Nada duro el día antes; el día después, suave.' };
    if (q) out.splice(out.indexOf(q), 1, t); else out.push(t);
    // v0.13 · decisión de Pablo 6/11: aunque haya test se mantiene el requisito semanal (la larga no desaparece)
  });
  return out;
}
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

// ===================== v0.12 · 2.ª SESIÓN Z6–Z8 INTEGRADA (COMPETICIÓN) =====================
/**
 * Cada semana, además del protocolo Z6–Z8 del plan de carrera (R01), una 2.ª sesión P1/P4 «de competición» (R04):
 * 2 movimientos de los que más te faltan (thrusters, DU, STOH, front squat, burpees, snatch/clean desde colgado, C2B o BMU en fatiga)
 * + calorías de ergómetro o carrera. Potencia en fatiga, H⁺ y aclarado de lactato, adaptaciones centrales y periféricas.
 * Sus códigos cuentan en las metas de esos movimientos. Se coloca como sesión dura (≥48 h de las otras duras) y vigilando el día siguiente.
 */
var MOVS_COMP_ = [
  { c: 'T02', n: 'thrusters', g: 'PIERNA', p1: '8 THRUSTERS (42,5/30)', p4: '8 THRUSTERS (42,5/30)' },
  { c: 'C01', n: 'double unders', g: 'IMPACTO', p1: '30 DOUBLE UNDERS', p4: '30 DOUBLE UNDERS' },
  { c: 'M07', n: 'STOH T&G', g: 'HOMBRO', p1: '8 SHOULDER TO OVERHEAD T&G (60/40)', p4: '7 SHOULDER TO OVERHEAD T&G (60/40)' },
  { c: 'C02', n: 'front squats', g: 'PIERNA', p1: '8 FRONT SQUAT (60/40)', p4: '7 FRONT SQUAT (60/40)' },
  { c: 'C03', n: 'burpees', g: 'GLUC', p1: '10 BURPEES OVER THE BAR', p4: '8 BURPEES OVER THE BAR' },
  { c: 'C04', n: 'snatch/clean desde colgado', g: 'AGARRE', p1: '6 HANG POWER SNATCH (50/35)', p4: '5 HANG POWER SNATCH (50/35)', p1b: '5 HANG SQUAT CLEAN (70/50)', p4b: '4 HANG SQUAT CLEAN (70/50)' },
  { c: 'M01', n: 'C2B', g: 'AGARRE', p1: '10 CHEST TO BAR', p4: '8 CHEST TO BAR' },
  { c: 'M48', n: 'bar muscle ups', g: 'AGARRE', p1: '5 BAR MUSCLE UPS', p4: '4 BAR MUSCLE UPS' }
];
var ERGS_COMP_ = ['15/12 cal ASSAULT BIKE', '15/12 cal ROWERG', '15/12 cal SKIERG', '200 m RUN'];
function bloqueIntegrado_(base, lunes, protoR01) {
  var w = pesoCarencias_(lunes), sem = Math.floor((isoAFecha(lunes) ? new Date(lunes + 'T12:00:00').getTime() : Date.now()) / 6048e5);
  var proto = protoR01 === 'P1' ? 'P4' : 'P1';
  var orden = MOVS_COMP_.map(function (m, i) { return { m: m, p: (w[m.c] || 0) + ((i + sem) % MOVS_COMP_.length) * 0.001 }; }).sort(function (a, b) { return b.p - a.p; });
  var elegidos = [], grupos = {};
  orden.forEach(function (x) {
    if (elegidos.length >= 2) return;
    if ((x.m.g === 'PIERNA' || x.m.g === 'AGARRE') && grupos[x.m.g]) return;   // nunca dos de pierna ni dos de agarre juntos
    elegidos.push(x.m); grupos[x.m.g] = 1;
  });
  var erg = ERGS_COMP_[sem % ERGS_COMP_.length];
  if (/RUN/.test(erg) && elegidos.some(function (m) { return m.g === 'PIERNA'; })) erg = ERGS_COMP_[0];   // carrera + pierna pesada: bici
  var dosis = function (m) { var b = (sem % 2) && m.p1b; return proto === 'P1' ? (b ? m.p1b : m.p1) : (b ? m.p4b : m.p4); };
  var cont = proto === 'P1'
    ? 'EVERY 4′ × 4 RONDAS (5 en semanas avanzadas)\n60–75″ al 90–95 %:\n' + erg + '\n' + elegidos.map(dosis).join('\n') + '\nResto de los 4′: Z1 muy suave (caminar, respirar)\n\nREGLA: misma velocidad en la 1.ª y la 4.ª ronda; si una ronda tarda >15″ más que la primera, corta.'
    : 'EMOM 12′ = 6 RONDAS de 2′ (16′ en semanas avanzadas)\nMIN IMPAR · UMBRAL (VT2): ' + erg + '\nMIN PAR · PICO (Z6), en <40″:\n' + elegidos.map(dosis).join('\n') + '\n\nREGLA: el minuto par del final en <40″; si no llegas, baja carga o reps.';
  var nombres = elegidos.map(function (m) { return m.n; });
  var faltan = elegidos.filter(function (m) { return w[m.c] > 0; }).map(function (m) { return m.n; });
  var cods = ['R04'].concat(elegidos.map(function (m) { return m.c; }));
  return Object.assign({}, base, {
    ORIGEN: 'Z6–Z8', 'TÍTULO': 'Z6–Z8 INTEGRADO · ' + proto + ' · ' + nombres.join(' + ') + ' + ' + erg.replace(/^[\d\/ ]+(cal|m) /, '').toLowerCase(),
    CONTENIDO: cont + '\n\nDónde va: como metcon del día o detrás de fuerza moderada, con 10′ de calentamiento específico. ≥48 h del otro Z6–Z8 y de la calidad de carrera.\nRecuperación: al día siguiente nada de pierna pesada ni calidad de carrera; Z2 suave o técnica.',
    INTENSIDAD: '🔴 Z6–Z8', MIN: 25, 'CÓDIGOS': cods.join('|'), CANTIDAD: saltosTexto_(cont) || '',
    'POR QUÉ (cursiva)': '2.ª sesión Z6–Z8 de la semana con enfoque de competición (' + (proto === 'P1' ? 'P1 híbrido: picos repetidos con pausa' : 'P4 modelado: pico + aclarado a umbral') + '). Integra ' + nombres.join(' y ') +
      (faltan.length ? ', lo que más te falta este mes (' + faltan.join(', ') + ')' : '') + ', con calorías de ergómetro para generar potencia en fatiga.',
    'CIENCIA (técnica · fisiología · biología)': 'Manual v2.0 §14.1/§14.4: picos por encima de VT2 seguidos de pausa (P1) o de trabajo controlado (P4). El lactato se transporta y se oxida como combustible mientras sigues trabajando; la fatiga se relaciona más con H⁺, fosfato inorgánico y manejo iónico que con el lactato [R42][R43]. ' +
      'Las adaptaciones de transportadores (MCT1/MCT4) son específicas de cada protocolo y no se asumen sin medirlas [R40]. Alto coste: 24–48 h para repetir algo igual. Solo entra si cabe por volumen, intensidad y fatiga del día antes y después (decisión de Pablo 6/11).',
    INTERFERENCIAS: '≥48 h del otro Z6–Z8 y de la calidad de carrera. La víspera, nada que fatigue ' + elegidos.map(function (m) { return m.g.toLowerCase(); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' ni ') + '. Al día siguiente: suave.'
  });
}

// ===================== v0.12 · METAS NUEVAS (competición) Y GUÍA «INTEGRAR CON / CÓMO MEJORARLO» =====================
ESQUEMA['APP · METAS'].cab.push('INTEGRAR CON', 'CÓMO MEJORARLO');
if (ESQUEMA['APP · METAS'].anchos) ESQUEMA['APP · METAS'].anchos.push(300, 360);
CAMPOS_META.push('INTEGRAR CON', 'CÓMO MEJORARLO');
var METAS_V12_ = [
  ['Mes', 'Pierna unilateral · calidad', 'ZANCADA CON BARRA · FRONT RACK O BACK RACK', 1, 'M61', 'Una exposición al mes con barra en front rack o back rack, ambas piernas. Se programa junto a la búlgara cuando coinciden (suma un estímulo más sin otra sesión). No cuentan OH lunges ni zancadas sin carga.', 31.5],
  ['Mes', 'Core · calidad', 'T2B ESTRICTO / DRAGON FLAG', 1, 'M62', 'Una exposición al mes de fuerza estricta de core anterior: T2B sin kip o dragon flag (completo o excéntrico). Dosis breve, sin fallo.', 36.5],
  ['Semana', 'P2 · Endurance', 'Z6–Z8 · 2.ª SESIÓN INTEGRADA (COMPETICIÓN)', 1, 'R04', 'Una 2.ª sesión P1/P4 por semana con 2 movimientos de competición + calorías de ergómetro o carrera. La genera «Cargar extras» con lo que más falta (thrusters, DU, STOH, front squat, burpees, hang snatch/clean, C2B, BMU). Sesión dura: ≥48 h de la calidad y del Z6–Z8 del plan; al día siguiente, suave.', 8.5],
  ['Mes', 'P2 · Endurance', 'Z6–Z8 · INTEGRADO (COMPETICIÓN)', 4, 'R04', 'Las 4 sesiones integradas del mes (una por semana). Cuenta aparte de los 4 protocolos del plan de carrera (R01).', 16.5],
  ['Mes', 'P3 · Competición', 'DOUBLE UNDERS · EN FATIGA', 2, 'C01', 'Dos exposiciones de DU con pulsaciones altas (metcon o Z6–Z8 integrado). FABRIK cuenta primero.', 51.1],
  ['Mes', 'P3 · Competición', 'FRONT SQUAT · EN METCON / FATIGA', 2, 'C02', 'Dos exposiciones de front squat dentro de un metcon o Z6–Z8 (no cuenta la fuerza pesada aislada).', 51.2],
  ['Mes', 'P3 · Competición', 'BURPEES · RITMO DE COMPETICIÓN', 2, 'C03', 'Dos exposiciones de burpees (over the bar, to target, box) a ritmo de competición.', 51.3],
  ['Mes', 'P3 · Competición', 'SNATCH / CLEAN DESDE COLGADO · EN FATIGA', 2, 'C04', 'Dos exposiciones de hang snatch o hang clean (power o squat) en metcon o Z6–Z8; alterna snatch y clean.', 51.4]
];
function sembrarMetasV12_() {
  var ya = {}; listar_(HOJAS.METAS).forEach(function (m) { ya[m['ÁMBITO'] + '|' + m['CÓDIGOS']] = 1; });
  var n = 0;
  METAS_V12_.forEach(function (x) {
    if (ya[x[0] + '|' + x[4]]) return;
    guardarMeta_({ 'ÁMBITO': x[0], PRIORIDAD: x[1], 'ESTÍMULO': x[2], META: String(x[3]), 'MÁXIMO': '', TIPO: 'COUNT', UNIDAD: x[3] + (x[3] > 1 ? ' sesiones/' : ' sesión/') + (x[0] === 'Mes' ? 'mes' : 'sem'), 'CÓDIGOS': x[4], ACTIVA: 'Sí', NOTAS: x[5], ORDEN: String(x[6]) });
    n++;
  });
  return n;
}
/** Texto inicial (editable) de «INTEGRAR CON» y «CÓMO MEJORARLO» por código. Solo rellena celdas vacías. */
var GUIA_METAS_ = {
  M61: ['Con la sentadilla búlgara, en el mismo bloque de pierna unilateral.', 'Alterna front y back rack cada mes; sube carga cuando las 6 por pierna salgan a RPE 6.'],
  M62: ['Final de sesión de gimnásticos o core, en fresco.', 'Progresa de excéntrico a completo; bajada de 4–5″ sin despegar la zona lumbar.'],
  W17: ['Bloque de fuerza de tren superior o skills; antes de accesorios de press (M53).', 'Déficit progresivo (+2 cm/sem si sale a RIR 2), tempo 3″ en la bajada y pausa abajo; trípode estable y codos a 45°.'],
  W15: ['Calentamiento del metcon con HSPU o P3 de tren superior (HSPU reactivo + ski).', 'Series cortas con reinicio: patada sincronizada con la extensión de codos; graba un set por semana y compara.'],
  W31: ['Z6–Z8 integrado (P1 bike + HSPU + DU) o metcon de Fabrik con HSPU.', 'Tandas pequeñas desde la 1.ª ronda (5-4-3) antes de llegar al fallo; respira arriba, no abajo.'],
  W01: ['Sola, en día sin pesas o AM con PM suave.', 'Sube 5′ cada semana de carga; últimos 10–15′ a umbral en semanas avanzadas (durability).'],
  W02: ['AM antes del día de volumen de Fabrik; con 10–15′ de técnica/skills después.', 'Ritmo por conversación; si la FC sube al mismo ritmo, baja ritmo: es fatiga.'],
  W03: ['Flush tras pierna pesada o vuelta a la calma de un metcon.', 'Usa el erg que salga en competición (bike/ski/row) alternando semanas.'],
  W04: ['Su semana: AM con PM de tren superior.', 'Elige la recomendada; con el grupo usa la alternativa de fartlek manteniendo la dosis.'],
  R01: ['Final de sesión de haltero/cadena posterior (P2), inicio (P3) o como metcon (P1/P4).', 'Registra W pico/medio y % de caída; progresa solo si la caída baja de 15 %.'],
  R04: ['2 movimientos de competición + calorías de ergómetro o 200 m de carrera.', 'Elige los movimientos que más te faltan y mantén la misma velocidad de la 1.ª a la última ronda; sube a 5 rondas o 16′ cuando lo consigas.'],
  W13: ['Bloque de gimnásticos AM fresco.', 'Transición con banda baja y fuerza estricta (ring dips, false grip pull-ups).'],
  W32: ['Calentamiento o skills; con pino estático (W33).', 'Metros sin caer y piruetas limpias por lado; registra el mejor intento.'],
  W33: ['Junto a HSW o como activación de hombro.', 'Línea cuerpo (costillas dentro), 3–5 × 20–40″; reduce apoyo en pared.'],
  W20: ['Antes del haltero de Fabrik o como parte del P3.', 'Por encima del 85 %; pausa 2″ en recepción; si baja la velocidad de caída, para.'],
  W23: ['Bloque de haltero técnico.', 'Un objetivo por día (pie trasero, bloqueo, drive vertical); vídeo lateral.'],
  W10: ['Calentamientos de haltero y gimnásticos.', 'Prioriza la zona que marques más cargada en el chequeo.'],
  W07: ['Contraste francés (P3B), pogos antes del haltero o DU en metcon.', 'Calidad: contacto corto y aterrizaje estable; cuenta solo el trabajo principal y el metcon.'],
  R02: ['AM; PM tren superior.', 'Progresa minutos a ritmo T (3×8′ → 2×12′ → 20′ continuos).'],
  R03: ['AM; ≥48 h del Z6–Z8.', '30/30 en grupo o 4×4′ con banda; mantén el ritmo en la última repetición.'],
  M17: ['Metcon con jerks o Z6–Z8 de barra.', 'Dip vertical y drive con talones; series cortas pesadas con pulsaciones altas.'],
  M01: ['Z6–Z8 integrado (bike + C2B) o metcon de Fabrik.', 'Kip corto y cadera alta; tandas fijas (5-5) desde el principio.'],
  M49: ['Z6–Z8 integrado P4 (ski + RMU).', 'Transición rápida y false grip; singles con buen ritmo antes que tandas que fallen.'],
  M48: ['Z6–Z8 integrado (bike + BMU) o con T2B.', 'Cadera a la barra y codos rápidos; singles sostenibles en fatiga.'],
  M05: ['Z6–Z8 integrado o metcon con barra.', 'Bajadas controladas sin soltar; tandas de 3–5 a ritmo.'],
  M07: ['Z6–Z8 integrado (STOH + erg) o P4F.', 'Ciclo rápido: dip-drive y barra cerca; respira arriba.'],
  M31: ['Skills con T2B o gimnásticos de calidad.', 'Barra cerca de la cadera, hollow → arch controlado.'],
  T01: ['Metcon pesado o EMOM de fuerza.', 'Tandas de 3–5 con buena recepción; front rack firme.'],
  T02: ['Z6–Z8 integrado con DU o erg (P4C).', 'Ritmo constante sin pausas en rack; respira en el lockout.'],
  T03: ['Metcon con DB o chipper.', 'Mancuernas en hombros, empuje de cadera; tandas de 5.'],
  M44: ['Accesorios de estabilidad OH.', 'Pausa abajo 2″; carga moderada.'],
  M58: ['Accesorios unilaterales.', 'Antirrotación: costillas dentro y escápula activa.'],
  M13: ['Metcon o accesorios de pierna unilateral.', 'Paso corto, tronco vertical, barra encima de la nuca.'],
  M45: ['Bloque de pierna unilateral AM o accesorios.', '3×6–8 por pierna, RIR 2; sube carga cuando salga fácil.'],
  M46: ['Core/aductores al final de la sesión.', 'Palanca corta → larga; 20–30″ por lado.'],
  M19: ['Accesorios de pierna o calentamiento.', 'Rango con talón apoyado; progresa a pistol con carga.'],
  M47: ['Después del haltero.', 'Posición de snatch y barra pegada; tempo 3″ en la bajada.'],
  M28: ['Accesorios de cadena posterior.', 'Pausa 2″ arriba, RPE 8.'],
  M08: ['Final de sesión.', 'Antiextensión y antirrotación según la zona cargada.'],
  M36: ['Gimnásticos AM o metcon con cuerda.', 'Técnica de pies (J-hook) y legless por tramos.'],
  M38: ['P1C (ski + trineo + burpee broad jump) o HYROX.', 'Postura baja y pasos cortos; tiempo por tramo.'],
  M33: ['Z6–Z8 integrado P1D o con thrusters.', 'Ritmo constante sin parar; muñecas.'],
  M35: ['Skills de comba frescos.', 'Intentos técnicos con descanso; sin fatiga.'],
  M10: ['Haltero técnico.', 'Carga moderada, recepción estable.'],
  M11: ['Haltero técnico.', 'Inestabilidad controlada en split.'],
  M50: ['Final del haltero.', 'Sostén pesado estable; segundos por set.'],
  M51: ['Final del haltero.', 'Split estable; registra kg y segundos.'],
  M52: ['Inicio de la sesión de pierna (P3B).', 'Velocidad máxima en cada salto; descansos completos.'],
  M53: ['Después de HSPU estricto.', 'Elige el accesorio de tu fallo (bloqueo o arranque).'],
  M54: ['Metcon o EMOM de pierna.', 'Muchas repeticiones con carga baja, sin parar.'],
  M55: ['Metcon o EMOM de hombro.', 'Carga ligera y ritmo constante.'],
  M56: ['Skills de pino.', 'Discos/laterales controlados.'],
  M57: ['Metcon o accesorios.', 'Técnica de carga al hombro.'],
  M32: ['Z6–Z8 integrado o skills de comba.', 'Crossovers controlados, ritmo bajo.'],
  V01: ['Al inicio de la sesión o tras la Z2 corta.', 'Velocidad máxima con recuperación completa; registra tiempos de 30 m.'],
  C01: ['Z6–Z8 integrado (con thrusters, HSPU o erg).', 'Tandas largas sin fallo con FC alta; muñeca relajada y salto bajo.'],
  C02: ['Z6–Z8 integrado o metcon con barra.', 'Codos altos y torso vertical en fatiga; ritmo constante.'],
  C03: ['Z6–Z8 integrado con ergómetro o barra.', 'Ritmo sostenible (cadencia fija), pecho al suelo y salto mínimo.'],
  C04: ['Z6–Z8 integrado P1/P4 o metcon de Fabrik.', 'Alterna hang snatch y hang clean; barra cerca y recepción rápida aunque estés cansado.']
};
function sembrarGuiaMetas_() {
  var n = 0;
  listar_(HOJAS.METAS).forEach(function (m) {
    var g = GUIA_METAS_[codigosDe_(m['CÓDIGOS'])[0]]; if (!g) return;
    var o = {};
    if (!String(m['INTEGRAR CON'] || '').trim()) o['INTEGRAR CON'] = g[0];
    if (!String(m['CÓMO MEJORARLO'] || '').trim()) o['CÓMO MEJORARLO'] = g[1];
    if (Object.keys(o).length) { actualizarFila_(HOJAS.METAS, m._fila, o); n++; }
  });
  return n;
}

// ===================== v0.12 · CORREO CON LOS ESTÍMULOS DE LA SEMANA Y EL MES =====================
function estimulosSemana_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  var c = cacheMetas_(), ps = periodoSemana_(lunes), pm = periodoMes_(lunes);
  var sem = resumenPer_(avanceMetas_('Semana', ps, c), ps, 'Semana'), mes = resumenPer_(avanceMetas_('Mes', pm, c), pm, 'Mes');
  var quedan = mes.metas.reduce(function (a, m) { return a + (m.tipo === 'COUNT' ? Math.max(0, Math.ceil(m.meta - m.programado)) : 0); }, 0);
  return { lunes: lunes, semana: sem, mes: mes, quedanMes: quedan };
}
function resumenSemanaHtml_(lunes) {
  var E = estimulosSemana_(lunes), S = E.semana, M = E.mes, fin = sumarDias(E.lunes, 6);
  var pct = function (v) { return Math.round(v * 100) + ' %'; }, n1 = function (v) { return Math.round(v * 10) / 10; };
  var enSemana = function (m) { return (m.dias || []).filter(function (d) { return d.iso >= E.lunes && d.iso <= fin; }); };
  var dias = function (l) { return l.length ? l.map(function (d) { return '<b>' + diaDe_(d.iso).slice(0, 3) + ' ' + d.turno + '</b> · ' + esc_(d.titulo) + (d.origen === 'FABRIK' ? ' <span style="color:#888">(Fabrik)</span>' : '') + (d.estado === 'BORRADOR' ? ' <i style="color:#c80">borrador</i>' : ''); }).join('<br>') : '<span style="color:#c33">sin programar</span>'; };
  var th = 'style="text-align:left;padding:6px 8px;background:#222;color:#fff;font-size:12px"', td = 'style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top;font-size:13px"';
  var h = '<div style="font-family:Arial,sans-serif;max-width:760px;color:#111">' +
    '<h2 style="margin:0 0 4px">Semana ' + isoAFecha(E.lunes).slice(0, 5) + '–' + isoAFecha(fin).slice(0, 5) + ' · programada</h2>' +
    '<p style="margin:0 0 14px;color:#555">Road To Elite · ' + ahora_() + '</p>' + (function () { try { return opCorreoHtml_(E.lunes); } catch (e) { return ''; } })() +
    '<table style="border-collapse:collapse;margin-bottom:16px"><tr>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + S.cubiertas + '/' + S.total + '</b><br>metas semanales (' + pct(S.pctProg) + ')</td><td width="10"></td>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + pct(M.pctProg) + '</b><br>' + esc_(M.etiqueta) + ' programado · hecho ' + pct(M.pctReal) + '</td><td width="10"></td>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + E.quedanMes + '</b><br>sesiones del mes por programar</td></tr></table>' +
    '<h3>Estímulos semanales</h3><table style="border-collapse:collapse;width:100%"><tr><th ' + th + '>Estímulo</th><th ' + th + '>Prog./meta</th><th ' + th + '>Día en que se ha incorporado</th></tr>' +
    S.metas.map(function (m) { return '<tr><td ' + td + '>' + (m.cubierta ? '✅ ' : '⚠️ ') + esc_(m.estimulo) + '</td><td ' + td + '>' + n1(m.programado) + ' / ' + n1(m.meta) + (m.tipo === 'MIN' || m.tipo === 'MIN_GT' ? '′' : '') + '</td><td ' + td + '>' + dias(enSemana(m)) + '</td></tr>'; }).join('') + '</table>' +
    '<h3>Estímulos mensuales · ' + esc_(M.etiqueta) + '</h3><table style="border-collapse:collapse;width:100%"><tr><th ' + th + '>Estímulo</th><th ' + th + '>Prog./meta</th><th ' + th + '>Quedan</th><th ' + th + '>Esta semana</th></tr>' +
    M.metas.map(function (m) { var q = Math.max(0, Math.ceil(m.meta - m.programado)); return '<tr><td ' + td + '>' + (m.cubierta ? '✅ ' : '') + esc_(m.estimulo) + '</td><td ' + td + '>' + n1(m.programado) + ' / ' + n1(m.meta) + ' (' + pct(m.pProg) + ')</td><td ' + td + '>' + (q ? '<b>' + q + '</b>' : '—') + '</td><td ' + td + '>' + (enSemana(m).length ? dias(enSemana(m)) : '—') + '</td></tr>'; }).join('') + '</table>';
  var alt = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= E.lunes && d <= fin && r.ALTERNATIVAS && /PROGRAMADO|BORRADOR/.test(r.ESTADO); });
  if (alt.length) h += '<h3>Alternativas (sesión Q y Z6–Z8)</h3>' + alt.map(function (r) { return '<p style="font-size:13px"><b>' + diaDe_(celdaIso_(r.FECHA)) + ' · ' + esc_(r['TÍTULO']) + '</b><br>' + esc_(r.ALTERNATIVAS).replace(/\n/g, '<br>') + '</p>'; }).join('');
  return h + '<p style="color:#888;font-size:12px">Lo mismo, editable, en la app (Menú › Cobertura) y en las pestañas APP · RESUMEN y APP · METAS.</p></div>';
}
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function enviarResumenSemana_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, subject: 'Road To Elite · estímulos semana ' + isoAFecha(lunes).slice(0, 5) + ' y mes', htmlBody: resumenSemanaHtml_(lunes), name: 'Road To Elite' });
  ponerConfig_('resumen_enviado_' + lunes, ahora_(), 'Correo con los estímulos de la semana');
  return true;
}
function menuEnviarResumen() { var l = lunesDe_(hoyIso_()); enviarResumenSemana_(l); SpreadsheetApp.getActive().toast('Enviado a ' + CONFIG.EMAIL_PERMITIDO, 'Road To Elite', 4); }

// ===================== v0.14 · REESTRUCTURAR: VIAJE · REORGANIZACIÓN · COMPETI =====================
/**
 * Especificación: doc del proyecto «claude/reestructurar-especificacion.md» (8/11/2026).
 * Flujo: reest_proponer (simula, guarda la propuesta) → Pablo revisa y mueve → reest_aplicar → (reest_deshacer).
 * El plan original no se borra: los bloques afectados pasan a SUSTITUIDO con REESTRUCTURA = id y ESTADO PREVIO;
 * los bloques nuevos llevan REESTRUCTURA = id. La app enseña «Original | Adaptada» por día.
 */
HOJAS.REEST = 'APP · REESTRUCTURA';
ESQUEMA['APP · REESTRUCTURA'] = {
  cab: ['ID', 'LUNES', 'MODO', 'ESTADO', 'RESUMEN', 'PARAMS', 'PROPUESTA', 'CREADA', 'APLICADA'],
  anchos: [80, 95, 110, 100, 420, 200, 200, 120, 120], fechas: ['LUNES'],
  listas: { MODO: ['Viaje', 'Reorganización', 'Competi'], ESTADO: ['Propuesta', 'Aplicada', 'Deshecha', 'Descartada'] }
};
ESQUEMA['APP · PLAN'].cab.push('REESTRUCTURA', 'ESTADO PREVIO'); ESQUEMA['APP · PLAN'].anchos.push(90, 100);
var HORA_TURNO_ = { AM: 9, PM: 18 };
var CAP_TURNO_ = { AM: 75, PM: 120 };
var EST_ACTIVO_ = /^(PROGRAMADO|BORRADOR)$/;

// ---------- utilidades ----------
function minFila_(r) {
  var m = parseFloat(String(r.MIN || '').replace(',', '.'));
  if (m > 0) return m;
  var t = norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || ''));
  return /METCON|WOD/.test(t) ? 20 : norm(r.ORIGEN) === 'FABRIK' ? 18 : 12;
}
function esDura_(r) {
  if (/R01|R02|R03|R04|W04/.test(r['CÓDIGOS'] || '')) return true;
  var rpe = parseInt(String(r.INTENSIDAD || '').replace(/[^\d]/g, ''), 10) || 0;
  return /METCON|WOD/.test(norm(r['TÍTULO'] || '')) && rpe >= 8;
}
function esCarreraFila_(r) { return /CARRERA/.test(norm(r.ORIGEN)) || /\b(W01|W02|W04|R02|R03|V01)\b/.test(r['CÓDIGOS'] || ''); }
function esZ2Fila_(r) { return /\b(W01|W02)\b/.test(r['CÓDIGOS'] || ''); }
function tipoSeccion_(r) {
  var t = norm((r['TÍTULO'] || '') + ' ' + (r.BLOQUE || '') + ' ' + String(r.CONTENIDO || '').slice(0, 200));
  if (esCarreraFila_(r)) return 'carrera';
  if (/METCON|WOD|AMRAP|FOR TIME|EMOM|R01|R04|Z6/.test(t) || /R01|R04/.test(r['CÓDIGOS'] || '')) return 'metcon';
  if (/SNATCH|CLEAN|JERK|SQUAT|DEADLIFT|STRENGTH|STRENGHT|WEIGHTLIFTING|PRESS|FUERZA/.test(t)) return 'fuerza';
  if (/SKILL|TECNIC|GIMNAST|HANDSTAND|PINO|RMU|MUSCLE|HSPU|DOUBLE UNDER|TRIPLE/.test(t)) return 'skills';
  if (/MOVILIDAD|MOBILITY|CALENTAMIENTO|WARM|ACTIVA/.test(t)) return 'calentamiento';
  return 'accesorio';
}
/** Prioridad de un bloque: Fabrik principal y P/Calidad primero; luego lo que más falta (metas). */
function prioridadFila_(r, w) {
  var p = codigosDe_(r['CÓDIGOS']).reduce(function (a, c) { return a + (w[c] || 0); }, 0);
  var sec = tipoSeccion_(r);
  if (norm(r.ORIGEN) === 'FABRIK') p += sec === 'fuerza' ? 3 : sec === 'metcon' ? 2.5 : 1.5;
  if (/R01|W04|R02|R03/.test(r['CÓDIGOS'] || '')) p += 3;
  if (esZ2Fila_(r)) p += 2;
  if (sec === 'accesorio') p -= 0.5;
  return p;
}
function horaDe_(iso, turno) { return new Date(iso + 'T' + (HORA_TURNO_[turno] < 10 ? '0' : '') + HORA_TURNO_[turno] + ':00:00').getTime(); }
/** v0.26 · Punto de corte al reorganizar: la sesión en curso (mañana hasta las 14 h, tarde después). Todo lo anterior se da por hecho. */
function corteAhora_() { var h = +Utilities.formatDate(new Date(), CONFIG.ZONA, 'H'); return { iso: hoyIso_(), turno: h < 14 ? 'AM' : 'PM' }; }
function antesDeCorte_(iso, turno, c) { return iso < c.iso || (iso === c.iso && turno === 'AM' && c.turno === 'PM'); }
/** Al aplicar una reorganización: lo anterior al corte sin registrar pasa a HECHO (cuenta en semana y mes). Se deshace con la reestructura. */
function darPorHecho_(lunes, rid, excepto) {
  var c = corteAhora_(), reg = {}, n = 0; excepto = excepto || {};
  listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN) reg[r.ID_PLAN] = 1; });
  var nuevas = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= sumarDias(lunes, 6) && /^(PROGRAMADO|BORRADOR)$/.test(r.ESTADO) && !reg[r.ID] && !excepto[r.ID] && antesDeCorte_(d, r.TURNO === 'AM' ? 'AM' : 'PM', c); })
    .map(function (r) { n++; return { FECHA: r.FECHA, ID_PLAN: r.ID, BLOQUE: r['TÍTULO'] || r.BLOQUE || '', HECHO: 'Sí', NOTAS: 'Dado por hecho al reorganizar [' + rid + ']', REGISTRADO: ahora_() }; });
  if (nuevas.length) { filasEnHoja_(HOJAS.REGISTRO, nuevas); MEMO = null; }
  return n;
}
function quitarDadosPorHecho_(rid) {
  var sh = hojaMia_(HOJAS.REGISTRO);
  listar_(HOJAS.REGISTRO).filter(function (r) { return String(r.NOTAS || '').indexOf('[' + rid + ']') >= 0; }).map(function (r) { return r._fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
  MEMO = null;
}
function filasSemanaActivas_(lunes) {
  var fin = sumarDias(lunes, 6), hechos = {}, corte = corteAhora_();
  listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.HECHO === 'Sí') hechos[r.ID_PLAN] = 1; });
  return listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= lunes && d <= fin && EST_ACTIVO_.test(r.ESTADO); })
    .map(function (r) { r._iso = celdaIso_(r.FECHA); r._turno = r.TURNO === 'AM' ? 'AM' : 'PM'; r._pasado = antesDeCorte_(r._iso, r._turno, corte); r._hecho = !!hechos[r.ID] || r._pasado; r._min = minFila_(r); return r; });   // v0.26 · lo anterior al corte no se reorganiza
}
/** Mitad del volumen manteniendo la intensidad: series, rondas, minutos de EMOM/AMRAP y AxB. */
function mitadVolumen_(txt) {
  var cambio = false, h = function (n) { cambio = true; return Math.max(1, Math.round(n / 2)); };
  var out = String(txt || '').split('\n').map(function (l) {
    return l.replace(/(\d+)(\s*)(SETS?|RONDAS?|ROUNDS?|SERIES)\b/gi, function (m, n, s, u) { return h(+n) + s + u; })
      .replace(/(X\s*)(\d+)(\s*SETS?)/gi, function (m, a, n, b) { return a + h(+n) + b; })
      .replace(/\b(EMOM|AMRAP|E2MOM|E3MOM)\s*(\d+)\s*([′'])/gi, function (m, f, n, q) { return f + ' ' + h(+n) + q; })
      .replace(/^(\s*)(\d+)\s*[X×]\s*(\d+)/i, function (m, s, a, b) { return s + h(+a) + '×' + b; });
  }).join('\n');
  return { txt: (cambio ? '' : '⚖ HAZ LA MITAD DE SERIES O RONDAS, MISMA INTENSIDAD\n') + out, cambio: cambio };
}

// ---------- material y equivalencias (viaje y mega WOD) ----------
var MATERIALES_ = [
  ['box', 'Tengo un box (todo)'], ['hspu', 'Pared para HSPU'], ['pino', 'Espacio para pino / HSW'], ['rack_dominadas', 'Rack / barra de dominadas (C2B, pull-ups, T2B kipping)'], ['anillas', 'Anillas (RMU, toes to ring, fondos)'], ['bmu', 'Barra que permite BMU (altura suficiente)'],
  ['rack_estricto', 'Solo dominadas y T2B estrictos'], ['rack_completo', 'Rack completo (barra + anillas + BMU)'], ['chaleco', 'Chaleco de peso'], ['comba', 'Comba'],
  ['kb', 'Kettlebells'], ['barra', 'Barra olímpica y discos'], ['db', 'Mancuernas'], ['sandbag_hyrox', 'Sandbag HYROX'], ['sandbag', 'Sandbag'], ['cajon', 'Cajón'],
  ['slamball', 'Slamball / balón'], ['cuerda', 'Cuerda para trepar'], ['fondos', 'Algo para fondos'], ['ergos', 'Ergómetros (bike, remo, ski)'], ['trineo', 'Trineo'], ['yugo', 'Yugo']
];
/** Reglas: si la línea pide algo que no tienes, se sustituye manteniendo el estímulo. Cada una dice qué conserva. */
var EQUIV_ = [
  { re: /RING MUSCLE|RMU/, ok: ['anillas'], sub: function (m) { return m.bmu ? 'BAR MUSCLE UP (mismas reps)' : m.rack_dominadas ? 'CHEST TO BAR + 2 FONDOS por rep' : 'BURPEE + 3 PUSH-UPS EXPLOSIVAS por rep'; }, conserva: 'tirón + empuje en fatiga' },
  { re: /BAR MUSCLE|BMU/, ok: ['bmu'], sub: function (m) { return m.anillas ? 'RING MUSCLE UP (mismas reps)' : m.rack_dominadas ? 'CHEST TO BAR + 2 FONDOS por rep' : 'BURPEE + 3 PUSH-UPS EXPLOSIVAS por rep'; }, conserva: 'tirón + empuje en fatiga' },
  { re: /TOES TO RING/, ok: ['anillas'], sub: function (m) { return m.rack_dominadas ? 'TOES TO BAR' : 'V-UPS'; }, conserva: 'core en suspensión' },
  { re: /CHEST TO BAR|C2B|PULL.?UPS?|TOES TO BAR|T2B/, ok: ['rack_dominadas'], sub: function (m) { return m.rack_estricto ? 'VERSIÓN ESTRICTA (mitad de reps)' : 'V-UPS + REMO INVERTIDO EN MESA (mismas reps)'; }, conserva: 'tirón y core' },
  { re: /HSPU|HANDSTAND PUSH/, ok: ['hspu'], sub: function (m) { return 'PIKE PUSH-UPS EN DÉFICIT (pies elevados)' + (m.chaleco ? ' con chaleco' : ''); }, conserva: 'empuje vertical' },
  { re: /HANDSTAND WALK|HSW|HANDSTAND HOLD|PINO|WALL WALK/, ok: ['pino', 'hspu'], sub: function () { return 'BEAR CRAWL + PLANCHA ESCAPULAR'; }, conserva: 'hombro en carga y control' },
  { re: /THRUSTER|FRONT SQUAT|BACK SQUAT|OVERHEAD SQUAT|OHS|SNATCH|CLEAN|JERK|DEADLIFT|PUSH PRESS|STRICT PRESS|SHOULDER TO OVERHEAD|STOH|BARBELL|BENCH/, ok: ['barra'],
    sub: function (m, l) { var imp = m.db ? 'DB' : m.kb ? 'KB' : m.sandbag || m.sandbag_hyrox ? 'SANDBAG' : null;
      if (!imp) return 'JUMP SQUATS + BURPEES (mismas reps)' + (m.chaleco ? ' con chaleco' : '');
      return imp + ' ' + (/THRUSTER/.test(l) ? 'THRUSTERS' : /SNATCH/.test(l) ? 'SNATCH' : /CLEAN/.test(l) ? 'CLEAN' : /JERK|PRESS|STOH|SHOULDER/.test(l) ? 'PUSH PRESS' : /DEADLIFT/.test(l) ? 'DEADLIFT' : 'FRONT SQUAT') + ' (carga a RPE equivalente; los % no aplican)'; }, conserva: 'patrón y potencia, no la carga' },
  { re: /WALL ?BALL|WB\b/, ok: ['slamball'], sub: function (m) { return m.db || m.kb ? 'THRUSTERS LIGEROS CON ' + (m.db ? 'DB' : 'KB') : 'AIR SQUAT + PUSH-UP JUMP'; }, conserva: 'sentadilla + empuje' },
  { re: /DOUBLE UNDER|(^|[^A-Z])DUS?([^A-Z]|$)|SINGLE UNDER|CROSSOVER|HEAVY ROPE/, ok: ['comba'], sub: function () { return 'POGO JUMPS LATERALES (mismo nº de saltos)'; }, conserva: 'tobillo reactivo y ritmo' },
  { re: /BOX JUMP|BOX STEP|BJO|STEP.?UP/, ok: ['cajon'], sub: function () { return 'BROAD JUMPS / TUCK JUMPS (mismas reps)'; }, conserva: 'salto' },
  { re: /ROPE CLIMB|LEGLESS/, ok: ['cuerda'], sub: function (m) { return m.rack_completo || m.rack_dominadas ? 'DOMINADAS CON TOALLA (3 por subida)' : 'REMO INVERTIDO + HOLLOW'; }, conserva: 'agarre y tirón' },
  { re: /SANDBAG/, ok: ['sandbag', 'sandbag_hyrox'], sub: function (m) { return m.db || m.kb ? (m.db ? 'DB' : 'KB') + ' A UN HOMBRO' : 'BURPEES'; }, conserva: 'carga asimétrica' },
  { re: /SLAM ?BALL/, ok: ['slamball'], sub: function () { return 'BURPEES (mismas reps)'; }, conserva: 'triple extensión' },
  { re: /ROW|SKIERG|(^|[^A-Z])SKI([^A-Z]|$)|BIKE|ASSAULT|ECHO|BIKEERG|(^|[^A-Z])CAL([^A-Z]|$)/, ok: ['ergos'], sub: function (m) { return m._correr ? '200 M RUN por cada 15 cal' : 'BURPEES (1 por cada 2 cal) o JUMPING JACKS'; }, conserva: 'motor' },
  { re: /SLED|TRINEO|YOKE|YUGO/, ok: ['trineo', 'yugo'], sub: function () { return 'SPRINT EN CUESTA 15″ o BEAR CRAWL'; }, conserva: 'empuje de cadera' },
  { re: /(^|[^A-Z])DIPS?([^A-Z]|$)|FONDOS/, ok: ['fondos', 'anillas'], sub: function () { return 'PUSH-UPS DECLINADAS'; }, conserva: 'empuje' },
  { re: /GHD/, ok: ['box'], sub: function () { return 'V-UPS + SUPERMAN'; }, conserva: 'core' },
  { re: /(^|[^A-Z])RUN([^A-Z]|$)|CARRERA/, ok: ['_correr'], sub: function () { return 'BURPEE BROAD JUMPS (1 por cada 20 m)'; }, conserva: 'motor' }
];
function mapaMaterial_(lista, correr) { var m = {}; (lista || []).forEach(function (k) { m[k] = true; }); if (correr) m._correr = true; if (m.box) MATERIALES_.forEach(function (x) { m[x[0]] = true; });
  if (m.rack_completo) { m.rack_dominadas = true; m.anillas = true; m.bmu = true; } if (m.bmu) m.rack_dominadas = true; if (m.rack_dominadas) m.rack_estricto = true; if (m.gusano2 || m.gusano3 || m.gusano4) m.gusano = true; return m; }
/** Adapta el texto de un bloque al material. Devuelve el texto, cuántas líneas cambian y qué se pierde. */
function adaptarMaterial_(txt, mat) {
  var lineas = String(txt || '').split('\n'), n = 0, total = 0, notas = [];
  var out = lineas.map(function (l) {
    var L = norm(l); if (!L.trim() || /^[A-Z](\.\d)?\s*·/.test(L)) return l;
    total++;
    for (var i = 0; i < EQUIV_.length; i++) {
      var e = EQUIV_[i]; if (!e.re.test(L)) continue;
      if (e.ok.some(function (k) { return mat[k]; })) return l;
      n++; notas.push(e.conserva);
      var reps = (l.match(/^\s*([\d\/\.\-]+\s*(cal|m|M)?)/) || [])[1] || '';
      return (reps ? reps.trim() + ' ' : '') + e.sub(mat, L) + '   ‹en vez de: ' + l.trim() + '›';
    }
    return l;
  });
  return { txt: out.join('\n'), cambios: n, ratio: total ? n / total : 0, conserva: notas.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
}

/**
 * v0.14.1 · Regla de Pablo (8/11): en el viaje, lo que no se hace con normalidad se compensa subiendo MUCHO la intensidad
 * (no el volumen): menos descanso, más densidad, tempo y pausas en la fuerza con mancuerna, chaleco si lo hay y un final tipo P corto.
 */
function intensificarViaje_(txt, mat, seccion) {
  var r = ['', '⚡ INTENSIDAD AL ALZA (viaje: compensa la falta de material y de CrossFit puro)'];
  r.push('· Descansos −40–50 % y objetivo RPE 8–9 en todo el bloque.');
  if (seccion === 'fuerza') r.push('· Fuerza con implemento ligero: tempo 4″ en la bajada + pausa 2″ abajo, 1½ reps o unilateral; última serie hasta RIR 1.');
  if (seccion === 'metcon') r.push('· Metcon: misma duración con más densidad (sin pausas en los cambios) y la última ronda a tope.');
  if (seccion === 'skills') r.push('· Skills: series cortas de máxima calidad con menos descanso; añade una variante más difícil (déficit, pausa, estricto).');
  if (mat.chaleco) r.push('· Chaleco puesto en gimnásticos, saltos, burpees y carrera.');
  r.push('· Final (5–6′, si el bloque no era ya intenso): 6 × 20″ ALL-OUT ' + (mat._correr ? 'sprint en cuesta' : mat.comba ? 'double unders' : 'burpees') + ' / 40″ suave.');
  return txt + r.join('\n');
}

// ---------- huecos y colocación ----------
/** slots: [{iso, turno, ok, cap, mat, correr:{libre,tempo,series}, tipo:'casa'|'viaje'}] */
function colocar_(fila, slots, ocupado, durasPorIso, opts) {
  opts = opts || {};
  var extraX = norm(fila.ORIGEN) !== 'FABRIK' && !esIntocable_(codigosDe_(fila['CÓDIGOS']));
  var dura = esDura_(fila), cand = slots.filter(function (s) {
    if (!s.ok || (opts.desde && horaDe_(s.iso, s.turno) < opts.desde)) return false;
    if ((ocupado[s.iso + s.turno] || 0) + fila._min > s.cap) return false;
    if (extraX && (ocupado['#' + s.iso + s.turno] || 0) >= EXTRAS_MAX_.n && !opts.forzar) return false;   // v0.29 · Reorganizar no amontona extras
    if (s.turno === 'PM' && materialVeto_(codigosDe_(fila['CÓDIGOS']), s.iso, 'PM') && !opts.forzar) return false;
    if (esCarreraFila_(fila)) { if (s.tipo === 'viaje' && !(s.correr && (s.correr.libre || s.correr.tempo || s.correr.series))) return false;
      if (/W04|R02|R03|V01/.test(fila['CÓDIGOS'] || '') && s.tipo === 'viaje' && !(s.correr.series || (/R02/.test(fila['CÓDIGOS']) && s.correr.tempo))) return false; }
    if (s.tipo === 'viaje' && tipoSeccion_(fila) === 'fuerza' && !s.mat.barra && !s.mat.box) return false;
    if (dura) { var malo = Object.keys(durasPorIso).some(function (d) { return Math.abs((new Date(d) - new Date(s.iso)) / 864e5) < 2; }); if (malo && !opts.forzar) return false; }   // nunca dos duras el mismo día ni a <48 h
    return true;
  });
  var cz = codigosDe_(fila['CÓDIGOS']), apr = function (s) { return cz.length ? sesgoAprendido_(cz, { iso: s.iso }, s.turno).p * 0.5 : 0; };   // v0.26 · preferencias aprendidas de turno y día
  cand.sort(function (a, b) {
    var pa = apr(a) + (a.iso === fila._iso ? -3 : 0) + (a.tipo === 'casa' ? -1 : 0) + Math.abs(new Date(a.iso) - new Date(fila._iso)) / 864e5 * 0.3 + (a.turno === fila._turno ? -0.5 : 0);
    var pb = apr(b) + (b.iso === fila._iso ? -3 : 0) + (b.tipo === 'casa' ? -1 : 0) + Math.abs(new Date(b.iso) - new Date(fila._iso)) / 864e5 * 0.3 + (b.turno === fila._turno ? -0.5 : 0);
    return pa - pb;
  });
  var s = cand[0]; if (!s) return null;
  ocupado[s.iso + s.turno] = (ocupado[s.iso + s.turno] || 0) + fila._min;
  if (extraX) ocupado['#' + s.iso + s.turno] = (ocupado['#' + s.iso + s.turno] || 0) + 1;
  if (dura) durasPorIso[s.iso] = 1;
  return s;
}
function cargaBase_(filas) { var o = {}; filas.forEach(function (r) { o[r._iso + r._turno] = (o[r._iso + r._turno] || 0) + r._min; if (norm(r.ORIGEN) !== 'FABRIK' && !esIntocable_(codigosDe_(r['CÓDIGOS']))) o['#' + r._iso + r._turno] = (o['#' + r._iso + r._turno] || 0) + 1; }); return o; }

// ---------- 1 · VIAJE ----------
/**
 * p = { desde, hasta, dias: { iso: { AM: 'libre'|'imposible'|'desplazamiento', PM: … } }, material: [claves], excepciones: { 'iso|AM': [claves] },
 *       correr: { libre, tempo, series }, correrDias: { 'iso|AM': true }, rutas: [{ iso, turno, min }], domingoCompleto: true }
 */
function proponerViaje_(lunes, p) {
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && r._iso >= hoyIso_(); });
  var base = cargaBase_(filas), w = pesoCarencias_(lunes), slots = [], cambios = [], avisos = [];
  for (var k = 0; k < 7; k++) {
    var iso = sumarDias(lunes, k); if (iso < hoyIso_()) continue;
    ['AM', 'PM'].forEach(function (t) {
      var enViaje = iso >= p.desde && iso <= p.hasta, d = (p.dias || {})[iso] || {}, est = enViaje ? (d[t] || 'libre') : 'casa';
      var mat = mapaMaterial_(((p.excepciones || {})[iso + '|' + t]) || p.material, (p.correrDias || {})[iso + '|' + t]);
      var b = base[iso + t] || 0, cap = enViaje ? CAP_TURNO_[t] : (b ? Math.max(b * 1.4, b + 20) : CAP_TURNO_[t]);
      if (!enViaje && k === 6 && !b && p.domingoCompleto !== false) cap = 150;
      slots.push({ iso: iso, turno: t, ok: est === 'libre' || est === 'casa', cap: cap, mat: enViaje ? mat : mapaMaterial_(['box'], true), correr: enViaje ? ((p.correrDias || {})[iso + '|' + t] ? p.correr || {} : {}) : { libre: 1, tempo: 1, series: 1 }, tipo: enViaje ? 'viaje' : 'casa' });
    });
  }
  var ocupado = {}, duras = {};
  filas.forEach(function (r) { if (!(r._iso >= p.desde && r._iso <= p.hasta)) { ocupado[r._iso + r._turno] = (ocupado[r._iso + r._turno] || 0) + r._min; if (esDura_(r)) duras[r._iso] = 1; } });
  var afect = filas.filter(function (r) { return r._iso >= p.desde && r._iso <= p.hasta; }).sort(function (a, b) { return prioridadFila_(b, w) - prioridadFila_(a, w); });
  // domingo completo: el día de viaje con más Fabrik que no se puede hacer va entero al domingo
  var dom = sumarDias(lunes, 6), sDom = slots.filter(function (s) { return s.iso === dom && s.tipo === 'casa' && s.turno === 'PM'; })[0];
  if (sDom && p.domingoCompleto !== false && !(base[dom + 'PM'] || base[dom + 'AM'])) {
    var porDia = {}; afect.forEach(function (r) { if (norm(r.ORIGEN) === 'FABRIK') { var sl = slots.filter(function (s) { return s.iso === r._iso && s.turno === r._turno; })[0]; if (!sl || !sl.ok || !sl.mat.barra) (porDia[r._iso] = porDia[r._iso] || []).push(r); } });
    var mejor = Object.keys(porDia).sort(function (a, b) { return porDia[b].length - porDia[a].length; })[0];
    if (mejor) porDia[mejor].forEach(function (r) { cambios.push({ id: r.ID, accion: 'mover', iso: dom, turno: 'PM', motivo: 'Día completo de ' + diaDe_(mejor) + ' al domingo (no se puede hacer en el viaje)' }); ocupado[dom + 'PM'] = (ocupado[dom + 'PM'] || 0) + r._min; r._hecho = true; });
  }
  afect.forEach(function (r) {
    if (r._hecho) return;
    var sl = slots.filter(function (s) { return s.iso === r._iso && s.turno === r._turno; })[0];
    if (sl && sl.ok && sl.tipo === 'viaje') {
      var ad = esCarreraFila_(r) ? null : adaptarMaterial_(r.CONTENIDO, sl.mat);
      var vale = esCarreraFila_(r) ? (sl.correr.libre || sl.correr.tempo || sl.correr.series) && !(/W04|R03|V01/.test(r['CÓDIGOS']) && !sl.correr.series && !(/R02/.test(r['CÓDIGOS']) && sl.correr.tempo))
        : !(tipoSeccion_(r) === 'fuerza' && !sl.mat.barra) && ad.ratio <= 0.6;
      if (vale && (ocupado[sl.iso + sl.turno] || 0) + r._min <= sl.cap) {
        ocupado[sl.iso + sl.turno] = (ocupado[sl.iso + sl.turno] || 0) + r._min;
        if (ad && ad.cambios) cambios.push({ id: r.ID, accion: 'adaptar', iso: sl.iso, turno: sl.turno, contenido: intensificarViaje_(ad.txt, sl.mat, tipoSeccion_(r)), motivo: 'Adaptado a tu material con intensidad al alza (' + ad.cambios + ' cambios; conserva ' + ad.conserva.join(', ') + ')' });
        else if (esCarreraFila_(r) && /R02/.test(r['CÓDIGOS']) && !sl.correr.series) cambios.push({ id: r.ID, accion: 'adaptar', iso: sl.iso, turno: sl.turno, contenido: '12′ fáciles\n20′ continuos a ritmo umbral (tempo), los últimos 4′ algo más rápidos\n8′ suaves', motivo: 'Sin sitio para series: la calidad Z4 pasa a tempo continuo (misma zona, final más rápido)' });
        return;
      }
    }
    var s = colocar_(r, slots, ocupado, duras);
    if (s) cambios.push({ id: r.ID, accion: s.tipo === 'viaje' ? 'adaptar' : 'mover', iso: s.iso, turno: s.turno, contenido: s.tipo === 'viaje' && !esCarreraFila_(r) ? intensificarViaje_(adaptarMaterial_(r.CONTENIDO, s.mat).txt, s.mat, tipoSeccion_(r)) : null, motivo: s.tipo === 'casa' ? 'Se compensa en casa (' + diaDe_(s.iso) + ', tope +40 %)' : 'Movido dentro del viaje a un hueco con material' });
    else cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'No cabe sin pasar del +40 % ni juntar sesiones duras: a pendientes' });
  });
  (p.rutas || []).forEach(function (rt) { cambios.push({ accion: 'nuevo', iso: rt.iso, turno: rt.turno || 'AM', nuevo: { ORIGEN: 'VIAJE', 'TÍTULO': 'Ruta andando · Z1', CONTENIDO: 'Ruta a pie ' + (rt.min ? '≈' + rt.min + '′' : '') + ' a ritmo cómodo.\nCuenta como Z1 (no como Z2 de carrera). Al día siguiente, menos pierna.', MIN: rt.min || 90, INTENSIDAD: '🔵 Z1', 'CÓDIGOS': '' }, motivo: 'Ruta marcada en el viaje' }); });
  // vuelta progresiva: el primer día en casa sin la sesión más dura si se puede
  var vuelta = sumarDias(p.hasta, 1); if (vuelta <= sumarDias(lunes, 6)) avisos.push('Primer día de vuelta (' + diaDe_(vuelta) + '): si llegas cansado del viaje, baja un 10–20 % la sesión más pesada.');
  return { cambios: cambios, avisos: avisos, resumen: 'Viaje ' + isoAFecha(p.desde).slice(0, 5) + '–' + isoAFecha(p.hasta).slice(0, 5) + ': ' + cambios.filter(function (c) { return c.accion === 'adaptar'; }).length + ' adaptados, ' + cambios.filter(function (c) { return c.accion === 'mover'; }).length + ' a casa, ' + cambios.filter(function (c) { return c.accion === 'pendiente'; }).length + ' a pendientes' };
}

// ---------- 2 · REORGANIZACIÓN ----------
/** Bloque desde un estímulo escrito («hspu»): el código del catálogo que más falta y encaja. */
function bloqueDeEstimulo_(txt, w) {
  var cat = catalogo_(), q = norm(txt), cands = Object.keys(cat).filter(function (c) {
    var r = cat[c]; return r.CONTENIDO && (norm(r.NOMBRE).indexOf(q) >= 0 || q.indexOf(norm(c)) >= 0 || (reSeguro_(r['DETECTAR (regex)']) && reSeguro_(r['DETECTAR (regex)']).test(q)));
  }).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
  var c = cands[0]; if (!c) return null;
  var r = cat[c];
  return { ORIGEN: 'REORGANIZADO', 'TÍTULO': r.NOMBRE, CONTENIDO: r.CONTENIDO, MIN: r.MIN || 12, INTENSIDAD: r.INTENSIDAD, 'CÓDIGOS': c, 'POR QUÉ (cursiva)': r['POR QUÉ (cursiva)'] || '', 'CIENCIA (técnica · fisiología · biología)': r['CIENCIA (técnica · fisiología · biología)'] || '' };
}
/**
 * p = { huecos: [{ iso, turno, min }], noHechos: [ids], nuevos: [{ estimulo } | { titulo, contenido, min }], carrera: { id: 'aparte'|'no'|'metcon' },
 *       tipo: 'A'|'B', mega: { formato: 'solo'|'pareja'|'equipo3'|'equipo4', material: [], barraMax, dbMax, chica: { barra, db, sandbag }, chaleco: n, minutos } }
 */
function proponerReorg_(lunes, p) {
  var todas = filasSemanaActivas_(lunes), w = pesoCarencias_(lunes), cambios = [], avisos = [];
  var no = {}; (p.noHechos || []).forEach(function (id) { no[id] = 1; });
  var pend = todas.filter(function (r) { return no[r.ID]; });
  (p.nuevos || []).forEach(function (n) {
    var o = n.estimulo ? bloqueDeEstimulo_(n.estimulo, w) : { ORIGEN: 'REORGANIZADO', 'TÍTULO': n.titulo || 'Bloque nuevo', CONTENIDO: n.contenido || '', MIN: n.min || 15, 'CÓDIGOS': '' };
    if (o) { o.ID = '_n' + pend.length; o._nuevo = true; o._iso = hoyIso_(); o._turno = 'PM'; o._min = minFila_(o); pend.push(o); }
    else avisos.push('No encuentro un estímulo para «' + n.estimulo + '»: escríbelo de otra forma o diséñalo a mano.');
  });
  // lo ya trabajado esta semana resta prioridad (metas semanales ya cubiertas)
  var cubiertas = {}; avanceMetas_('Semana', periodoSemana_(lunes), cacheMetas_()).forEach(function (m) { if (m.pReal >= 1) codigosDe_(m.codigos).forEach(function (c) { cubiertas[c] = 1; }); });
  pend.forEach(function (r) { r._prio = prioridadFila_(r, w) * (codigosDe_(r['CÓDIGOS']).some(function (c) { return cubiertas[c]; }) ? 0.4 : 1); });
  pend.sort(function (a, b) { return b._prio - a._prio; });
  pend.forEach(function (r) { if (!r._nuevo) cambios.push({ id: r.ID, accion: 'sustituir', motivo: 'No hecho: se reorganiza' }); });
  // carrera
  var carreras = pend.filter(esCarreraFila_), resto = pend.filter(function (r) { return !esCarreraFila_(r); });
  var huecos = (p.huecos || []).map(function (h) { return { iso: h.iso, turno: h.turno, min: +h.min || CAP_TURNO_[h.turno], usado: 0, bloques: [] }; }).sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.turno < b.turno ? -1 : 1; });
  var metconExtra = [];
  carreras.forEach(function (r) {
    var dec = (p.carrera || {})[r.ID] || 'aparte';
    if (dec === 'aparte') {
      var h = huecos.filter(function (x) { return x.turno === 'AM' && x.min - x.usado >= r._min && huecos.some(function (y) { return y.iso === x.iso && y.turno === 'PM'; }); })[0] || huecos.filter(function (x) { return x.min - x.usado >= r._min; })[0];
      if (h) { h.usado += r._min; cambios.push({ id: r.ID, accion: 'mover', iso: h.iso, turno: h.turno, motivo: 'Carrera aparte' + (h.turno === 'AM' ? ' por la mañana (≥6 h de la fuerza de la tarde)' : '') }); return; }
      dec = esZ2Fila_(r) ? 'no' : 'metcon';
    }
    if (dec === 'metcon') { metconExtra.push(r); return; }
    if (esZ2Fila_(r)) cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'Z2 no hecha: la semana que viene +' + Math.round(r._min * 0.25) + '′ (+25 %) en la Z2' });
    else cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'Carrera no hecha: a pendientes' });
  });
  // v0.16.2 · destino elegido por bloque: auto (huecos) · pendiente (semana que viene) · hueco|iso|turno · integrar|idOtro · mega
  var dest = p.destino || {}, megaSel = [], integ = {};
  resto = resto.filter(function (r) {
    var k = String(dest[r.ID] || 'auto').split('|'), tit = r['TÍTULO'] || r.BLOQUE || '';
    if (k[0] === 'pendiente') { cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'Lo dejas para la semana que viene' }); return false; }
    if (k[0] === 'hueco' && k[1]) { cambios.push({ id: r.ID, accion: 'mover', iso: k[1], turno: k[2] === 'AM' ? 'AM' : 'PM', motivo: 'Donde elegiste (' + diaDe_(k[1]).toLowerCase() + ' ' + (k[2] === 'AM' ? 'AM' : 'PM') + ')' }); return false; }
    if (k[0] === 'integrar' && k[1]) {
      var t = todas.filter(function (x) { return x.ID === k[1] && !no[x.ID]; })[0];
      if (t) { (integ[t.ID] = integ[t.ID] || { t: t, bl: [] }).bl.push(r); return false; }
      avisos.push('No encuentro el bloque con el que integrar «' + tit + '»: lo meto en los huecos.'); return true;
    }
    if (k[0] === 'mega' && p.tipo !== 'B') { megaSel.push(r); return false; }
    return true;
  });
  Object.keys(integ).forEach(function (tid) {
    var I = integ[tid], t = I.t, extra = I.bl.reduce(function (a, r) { return a + r._min; }, 0), cap = CAP_TURNO_[t._turno] || 120, recorta = t._min + extra > cap;
    var cont = String(t.CONTENIDO || '') + I.bl.map(function (r) { return '\n\n+ INTEGRADO · ' + (r['TÍTULO'] || r.BLOQUE) + ' (no hecho el ' + diaDe_(r._iso).toLowerCase() + ')' + (recorta ? ' · al 50 % para no pasar de ' + cap + '′' : '') + '\n' + (recorta ? mitadVolumen_(r.CONTENIDO).txt : (r.CONTENIDO || '')); }).join('');
    cambios.push({ id: tid, accion: 'adaptar', iso: t._iso, turno: t._turno, contenido: cont, motivo: 'Integra ' + I.bl.map(function (r) { return '«' + (r['TÍTULO'] || r.BLOQUE) + '»'; }).join(', ') + (recorta ? ' al 50 % (la sesión pasaría de ' + cap + '′)' : '') });
  });
  if (megaSel.length) {
    var hm = huecos[0];
    if (!hm) avisos.push('Para meter bloques en el mega WOD marca al menos un hueco.');
    else { var mgS = megaWod_(megaSel, p.mega || { formato: 'solo', material: ['box'] }, w, cubiertas, Math.min(hm.min, (p.mega || {}).minutos || 45)); hm.usado += +mgS.MIN || 45;
      cambios.push({ accion: 'nuevo', iso: hm.iso, turno: hm.turno, nuevo: mgS, motivo: 'Mega WOD con lo que elegiste' }); }
  }
  if (p.tipo === 'B') {
    var h0 = huecos[0]; if (!h0) return { cambios: cambios, avisos: ['Marca al menos un hueco.'], resumen: 'Sin huecos' };
    var mega = megaWod_(resto.concat(metconExtra), p.mega || {}, w, cubiertas, Math.min(h0.min, (p.mega || {}).minutos || h0.min));
    cambios.push({ accion: 'nuevo', iso: h0.iso, turno: h0.turno, nuevo: mega, motivo: 'Mega WOD con lo pendiente' });
  } else {
    // Tipo A: por hueco, calentamiento → skills → fuerza → metcon
    var orden = ['calentamiento', 'skills', 'fuerza', 'metcon', 'accesorio'];
    resto.forEach(function (r) {
      var h = huecos.filter(function (x) { return x.min - x.usado - 10 >= r._min; })[0];
      if (!h) { if (!r._nuevo) cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'No cabe en el tiempo disponible (prioridad más baja)' }); else avisos.push('«' + r['TÍTULO'] + '» no cabe en el tiempo marcado.'); return; }
      h.usado += r._min; h.bloques.push(r);
    });
    huecos.forEach(function (h) {
      if (!h.bloques.length) return;
      var sec = {}; h.bloques.forEach(function (r) { var t = tipoSeccion_(r); (sec[t] = sec[t] || []).push(r); });
      var faltaCalent = Object.keys(w).filter(function (c) { return /W10|W33|W32|W15/.test(c) && w[c] > 0; });
      var cal = ['CALENTAMIENTO ACTIVO · 10–12′', '2 rondas: 200 m trote o 250 m remo · 10 PVC pass-through · 8 cat-cow · 10 air squat · 5 inchworm + push-up']
        .concat(faltaCalent.length ? ['+ ya atacando lo pendiente: ' + faltaCalent.map(function (c) { return (catalogo_()[c] || {}).NOMBRE || c; }).join(', ') + ' (sin fatiga)'] : []);
      (sec.calentamiento || []).forEach(function (r) { cal.push('+ ' + r['TÍTULO'] + ': ' + String(r.CONTENIDO || '').split('\n')[0]); });
      cambios.push({ accion: 'nuevo', iso: h.iso, turno: h.turno, nuevo: { ORIGEN: 'REORGANIZADO', 'TÍTULO': 'A · Calentamiento activo', CONTENIDO: cal.join('\n'), MIN: 12, 'CÓDIGOS': '' }, motivo: 'Sesión clásica' });
      ['skills', 'fuerza', 'metcon', 'accesorio'].forEach(function (t, i) {
        var bl = sec[t]; if (!bl || !bl.length) return;
        var cont = bl.map(function (r) { return '— ' + (r['TÍTULO'] || r.BLOQUE) + ' —\n' + (r.CONTENIDO || ''); }).join('\n\n');
        if (t === 'metcon' && metconExtra.length) cont += '\n\n+ CARRERA PENDIENTE DENTRO DEL METCON: añade 400 m RUN al inicio de cada ronda (o 20/16 cal de erg si no hay sitio para correr).\nCuenta como carrera en fatiga, no como Z2.';
        cambios.push({ accion: 'nuevo', iso: h.iso, turno: h.turno, nuevo: { ORIGEN: 'REORGANIZADO', 'TÍTULO': String.fromCharCode(66 + i) + ' · ' + { skills: 'Skills', fuerza: 'Fuerza', metcon: 'Metcon', accesorio: 'Accesorios' }[t] + ' · ' + bl.map(function (r) { return r['TÍTULO'] || r.BLOQUE; }).join(' + ').slice(0, 80),
          CONTENIDO: cont, MIN: bl.reduce(function (a, r) { return a + r._min; }, 0), INTENSIDAD: bl[0].INTENSIDAD || '', 'CÓDIGOS': bl.map(function (r) { return r['CÓDIGOS']; }).filter(Boolean).join('|'),
          'POR QUÉ (cursiva)': 'Recupera lo no hecho de la semana, ordenado por tus carencias: ' + bl.map(function (r) { return r['TÍTULO'] || r.BLOQUE; }).join(', ') + '.' }, motivo: 'Sesión clásica' });
      });
      if (metconExtra.length && !sec.metcon) cambios.push({ accion: 'nuevo', iso: h.iso, turno: h.turno, nuevo: { ORIGEN: 'REORGANIZADO', 'TÍTULO': 'Cierre · ergómetro Z2 15′', CONTENIDO: '15′ de ergómetro suave (Z2, conversación).\nRecupera parte del endurance pendiente.', MIN: 15, 'CÓDIGOS': 'W03', INTENSIDAD: '🔵 Z2' }, motivo: 'Carrera pendiente → ergómetro' });
    });
    // aviso semana siguiente: pierna el domingo y pierna el lunes
    var dom = sumarDias(lunes, 6), lunSig = sumarDias(lunes, 7);
    if (huecos.some(function (h) { return h.iso === dom && h.bloques.some(function (r) { return cargasFila_(r).indexOf('PIERNA') >= 0; }); }) && listar_(HOJAS.PLAN).some(function (r) { return celdaIso_(r.FECHA) === lunSig && cargasFila_(r).indexOf('PIERNA') >= 0; }))
      avisos.push('Ojo: el domingo cargas pierna y el lunes Fabrik también: baja un 20 % la pierna del domingo.');
  }
  return { cambios: cambios, avisos: avisos, resumen: 'Reorganización ' + (p.tipo === 'B' ? 'integrada (mega WOD)' : 'clásica') + ': ' + pend.length + ' bloques pendientes · ' + cambios.filter(function (c) { return c.accion === 'pendiente'; }).length + ' a pendientes' };
}

// ---------- mega WOD (tipo B) ----------
var MOV_MEGA_ = [
  { re: /THRUSTER/, n: 'THRUSTERS', mat: 'barra', alt: 'db', reps: 12, carga: 'barra', c: 'T02' }, { re: /DOUBLE UNDER|(^|[^A-Z])DUS?([^A-Z]|$)/, n: 'DOUBLE UNDERS', mat: 'comba', reps: 50, c: 'C01' },
  { re: /STOH|SHOULDER TO OVERHEAD|JERK|PUSH PRESS/, n: 'SHOULDER TO OVERHEAD', mat: 'barra', alt: 'db', reps: 12, carga: 'barra', c: 'M07' }, { re: /FRONT SQUAT/, n: 'FRONT SQUATS', mat: 'barra', alt: 'db', reps: 12, carga: 'barra', c: 'C02' },
  { re: /BURPEE/, n: 'BURPEES OVER THE BAR', mat: '', reps: 12, c: 'C03' }, { re: /HANG|SNATCH|CLEAN/, n: 'HANG POWER CLEANS', mat: 'barra', alt: 'db', reps: 10, carga: 'barra', c: 'C04' },
  { re: /CHEST TO BAR|C2B/, n: 'CHEST TO BAR', mat: 'rack_dominadas', reps: 12, c: 'M01' }, { re: /BAR MUSCLE|BMU/, n: 'BAR MUSCLE UPS', mat: 'bmu', reps: 6, c: 'M48' },
  { re: /RING MUSCLE|RMU/, n: 'RING MUSCLE UPS', mat: 'anillas', reps: 5, c: 'M49' }, { re: /HSPU/, n: 'HSPU', mat: 'hspu', reps: 10, c: 'W31' },
  { re: /TOES TO BAR|T2B/, n: 'TOES TO BAR', mat: 'rack_dominadas', reps: 15, c: '' }, { re: /WALL ?BALL/, n: 'WALL BALLS', mat: 'slamball', reps: 20, c: '' },
  { re: /BOX/, n: 'BOX JUMP OVERS', mat: 'cajon', reps: 12, c: 'W07' }, { re: /SANDBAG/, n: 'SANDBAG CLEANS', mat: 'sandbag', reps: 10, carga: 'sandbag', c: 'M57' },
  { re: /SLAM/, n: 'SLAMBALLS', mat: 'slamball', reps: 15, c: 'M57' }, { re: /ROPE/, n: 'ROPE CLIMBS', mat: 'cuerda', reps: 3, c: 'M36' },
  { re: /SLED|TRINEO/, n: 'SLED PUSH 15 m', mat: 'trineo', reps: 2, c: 'M38' }, { re: /YOKE|YUGO/, n: 'YOKE CARRY 15 m', mat: 'yugo', reps: 2, c: '' },
  { re: /LUNGE/, n: 'DB WALKING LUNGES', mat: 'db', reps: 16, carga: 'db', c: '' },
  { re: /GUSANO|WORM/, n: 'WORM (GUSANO) CLEANS + CARRY 20 m', mat: 'gusano', reps: 6, c: '', equipo: true }, { re: /LODGE|OVER THE WALL/, n: 'SANDBAG OVER LODGE', mat: 'lodge_lanzar', reps: 8, c: 'M57', equipo: true },
  { re: /JUMP OVER/, n: 'JUMP OVER LODGE', mat: 'lodge_saltar', reps: 10, c: 'W07', equipo: true }, { re: /DEADLIFT/, n: 'DEADLIFTS', mat: 'barra', reps: 10, carga: 'barra', c: '' }
];
var ERG_MEGA_ = [['ergos', 'cal ASSAULT BIKE'], ['ergos', 'cal ROW'], ['ergos', 'cal SKI'], ['_correr', 'm RUN']];
var FORMATOS_EQUIPO_ = {
  solo: ['', '', '', ''],
  pareja: ['SINCRO (los dos a la vez)', 'ACUMULADO (repartid como queráis)', 'RELEVO: uno trabaja, otro descansa', 'LOS DOS (cada uno sus reps)'],
  equipo3: ['SINCRO DE 3', '2 TRABAJAN · 1 DESCANSA (rotad)', 'ACUMULADO DE EQUIPO', 'TODO EL EQUIPO'],
  equipo4: ['SINCRO 2 + 2', '3 TRABAJAN · 1 DESCANSA (rotad)', 'ACUMULADO DE EQUIPO', 'TODO EL EQUIPO']
};
function megaWod_(pend, o, w, cubiertas, minutos) {
  var mat = mapaMaterial_(o.material || [], (o.material || []).indexOf('_correr') >= 0 || (o.material || []).indexOf('correr') >= 0);
  var n = { solo: 1, pareja: 2, equipo3: 3, equipo4: 4 }[o.formato || 'solo'] || 1, fm = FORMATOS_EQUIPO_[o.formato || 'solo'] || FORMATOS_EQUIPO_.solo;
  var txt = pend.map(function (r) { return norm((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || '')); }).join('\n');
  var tiene = function (m) { return !m.mat || mat[m.mat] || (m.alt && mat[m.alt]); };
  var MOVS = movsMega_();   // v0.15: de MOTOR_GUIA.md
  // movimientos: primero lo que pides en «Estímulos que quiero», luego lo que sale en lo pendiente y lo de más carencia aún no cubierto esta semana
  var D = o.deseo ? parseDeseo_(o.deseo, guiaMotor_()) : null;
  var movs = D ? MOVS.filter(function (m) { return tiene(m) && D.movs.some(function (g) { return g.k === m.k; }); }) : [];
  if (D) D.patrones.forEach(function (p) { if (p === 'MONO' || movs.some(function (m) { return m.patron === p; })) return; var c = MOVS.filter(function (m) { return m.patron === p && tiene(m) && movs.indexOf(m) < 0; }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); })[0]; if (c) movs.push(c); });
  MOVS.filter(function (m) { return m.re.test(txt) && tiene(m) && movs.indexOf(m) < 0; }).forEach(function (m) { movs.push(m); });
  MOVS.filter(function (m) { return movs.indexOf(m) < 0 && tiene(m) && m.c && !cubiertas[m.c]; }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); }).forEach(function (m) { if (movs.length < 8) movs.push(m); });
  if (n > 1) MOVS.filter(function (m) { return m.equipo && mat[m.mat] && movs.indexOf(m) < 0; }).forEach(function (m) { movs.splice(1, 0, m); });   // material de equipo marcado: entra
  if (movs.length < 4) MOVS.filter(function (m) { return movs.indexOf(m) < 0 && tiene(m); }).slice(0, 4 - movs.length).forEach(function (m) { movs.push(m); });
  var ergs = ERG_MEGA_.filter(function (e) { return mat[e[0]]; }); if (!ergs.length) ergs = [['', 'BURPEES (en vez de erg)']];
  if (D && D.ergs.length) { var pe = D.ergs.map(ergMegaDe_).filter(function (e) { return e && mat[e[0]]; }); if (pe.length) ergs = pe.concat(ergs.filter(function (e) { return !pe.some(function (x) { return x[1] === e[1]; }); })); }
  var bar = +o.barraMax || 60, db = +o.dbMax || 22.5, ch = o.chica || null;
  var carga = function (m) {
    if (m.carga === 'barra' && mat.barra) return ' (' + Math.min(bar, /CLEAN|DEADLIFT/.test(m.n) ? 70 : 50) + ' kg' + (ch && ch.barra ? ' / ♀ ' + ch.barra + ' kg' : '') + ')';
    if ((m.carga === 'barra' && !mat.barra && mat.db) || m.carga === 'db') return ' (DB ' + Math.min(db, 22.5) + ' kg' + (ch && ch.db ? ' / ♀ ' + ch.db + ' kg' : '') + ')';
    if (m.carga === 'sandbag') return ' (sandbag' + (ch && ch.sandbag ? ' / ♀ ' + ch.sandbag + ' kg' : '') + ')';
    return '';
  };
  var nombre = function (m) { return (m.carga === 'barra' && !mat.barra && mat.db ? 'DB ' : '') + m.n + carga(m); };
  var r = function (m, f) { return Math.round(m.reps * f * (n > 1 ? n * 0.75 : 1)); };
  var T = Math.max(30, Math.min(75, +minutos || 45)), partes = [], usado = 0, k = 0;
  var fuerza = pend.filter(function (x) { return tipoSeccion_(x) === 'fuerza'; });
  if (fuerza.length && mat.barra) { var mF = Math.round(T * 0.18); partes.push('BUY-IN PESADO · EMOM ' + mF + '′\n' + (n > 1 ? 'Alternando: ' : '') + '1–2 ' + norm(fuerza[0]['TÍTULO'] || 'LEVANTAMIENTO').replace(/^\d+:\s*/, '') + ' al 80–88 % (lo pendiente de fuerza, sin diluirlo)'); usado += mF + 2; }
  var bloquesMin = [];
  var restante = T - usado - (o.cashout ? 15 : 0);
  var nb = restante >= 50 ? 4 : restante >= 35 ? 3 : 2, dur = Math.floor(restante / nb) - 2;
  for (var b = 0; b < nb; b++) {
    var a = movs[(k++) % movs.length], c = movs[(k++) % movs.length], e = ergs[b % ergs.length], fmt = fm[b % fm.length];
    var conf = n > 1 ? '\nMaterial: ' + (n === 2 ? (b % 2 ? '1 barra + 2 DB' : '2 barras') : n === 3 ? (b % 2 ? '2 barras + 1 erg' : '1 barra + 2 DB + 1 erg') : (b % 2 ? '2 barras + 2 DB' : '2 ergs + 2 barras')) : '';
    var ergTxt = /RUN/.test(e[1]) ? (200 * n) + ' m RUN' : /BURPEES/.test(e[1]) ? (10 * n) + ' BURPEES' : (15 * n) + '/' + (12 * n) + ' ' + e[1];
    var tipos = [
      'PARTE ' + (b + 1) + ' · AMRAP ' + dur + '′' + (fmt ? ' · ' + fmt : '') + conf + '\n' + ergTxt + '\n' + r(a, 1) + ' ' + nombre(a) + '\n' + r(c, 1) + ' ' + nombre(c),
      'PARTE ' + (b + 1) + ' · EVERY 4′ × ' + Math.max(2, Math.floor(dur / 4)) + (fmt ? ' · ' + fmt : '') + ' (P1: 60–75″ al 90 %)' + conf + '\n' + ergTxt + '\n' + r(a, 0.7) + ' ' + nombre(a) + '\n' + r(c, 0.7) + ' ' + nombre(c),
      'PARTE ' + (b + 1) + ' · FOR TIME · cap ' + dur + '′' + (fmt ? ' · ' + fmt : '') + conf + '\n21-15-9\n' + nombre(a) + '\n' + nombre(c) + '\n+ ' + ergTxt + ' entre rondas',
      'PARTE ' + (b + 1) + ' · EMOM ' + dur + '′' + (fmt ? ' · ' + fmt : '') + ' (P4: impar umbral / par pico)' + conf + '\nMIN IMPAR: ' + ergTxt.replace(/^\d+/, function (x) { return Math.round(+x * 0.8); }) + '\nMIN PAR: ' + r(a, 0.6) + ' ' + nombre(a) + ' + ' + r(c, 0.5) + ' ' + nombre(c)
    ];
    partes.push(tipos[b % 4]); bloquesMin.push(dur);
  }
  if (o.cashout) partes.push('CASH-OUT · 15′ ergómetro Z2 suave (recupera parte del endurance pendiente; cuenta como ergo Z2)');
  var chal = +o.chaleco > 0 ? '\nChaleco: ' + o.chaleco + (o.chaleco > 1 ? ' atletas' : ' atleta') + ' en burpees, saltos, gimnásticos y carrera (no con barra por encima de la cabeza).' : '';
  var cods = movs.map(function (m) { return m.c; }).filter(Boolean).concat(pend.map(function (x) { return x['CÓDIGOS']; }).filter(Boolean)).join('|').split('|').filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  return {
    ORIGEN: 'REORGANIZADO', 'TÍTULO': 'MEGA WOD · ' + T + '′ · ' + ({ solo: 'individual', pareja: 'en pareja', equipo3: 'equipo de 3', equipo4: 'equipo de 4' }[o.formato || 'solo']),
    CONTENIDO: partes.join('\n\n— 2′ de transición —\n\n') + chal + '\n\nMARCADOR: total de reps de los AMRAP + tiempo de los FOR TIME.\nRITMO: el primer bloque al 80 %, sube en los siguientes; las partes P1/P4 sí al 90 %.',
    MIN: T, INTENSIDAD: '🔴 Mega WOD', 'CÓDIGOS': cods.join('|'),
    'POR QUÉ (cursiva)': (o.deseo ? 'Pediste «' + String(o.deseo).trim() + '»: va primero. ' : '') + 'Integra lo pendiente de la semana (' + pend.map(function (x) { return x['TÍTULO'] || x.BLOQUE; }).slice(0, 6).join(', ') + ') y lo que más te falta y aún no has hecho esta semana, en formato de competición. Lo ya cubierto en la semana no se repite.',
    'CIENCIA (técnica · fisiología · biología)': 'Alterna partes por encima de umbral (P1/P4: H⁺ y aclarado de lactato) con partes sostenidas: adaptaciones centrales (gasto cardiaco) y periféricas (tampón, capilares). La fuerza pendiente va al principio y en fresco para no diluir su estímulo neural (manual §16).'
  };
}

// ---------- 3 · COMPETI ----------
/**
 * p = { tipo: 'online'|'fisica', iso, turno, dias: [iso…], wod: 'texto' }
 * Online: 24 h antes descanso (Z2 suave como mucho) · 24–48 h −50 % protegiendo lo implicado · no se suprimen P ni extras: se recolocan.
 * Física: se suprimen P1–P4 y extras · 72–48 h volumen medio-bajo intensidad alta · 48–24 h repaso con volumen mínimo · 24 h descanso.
 * Después: 24 h mínimas; lo quitado se compensa el resto de la semana (día siguiente a la grabación como mucho +40 %).
 */
function proponerCompeti_(lunes, p) {
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho; }), w = pesoCarencias_(lunes), cambios = [], avisos = [];
  var dias = p.tipo === 'fisica' ? (p.dias || []).slice().sort() : [p.iso];
  var t0 = horaDe_(dias[0], p.tipo === 'fisica' ? 'AM' : (p.turno || 'AM')), t1 = horaDe_(dias[dias.length - 1], p.tipo === 'fisica' ? 'PM' : (p.turno || 'AM')) + 3 * 36e5;
  var implic = p.wod ? cargasDe_(norm(p.wod), '') : [];
  var base = cargaBase_(filas), slots = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); ['AM', 'PM'].forEach(function (t) { var b = base[iso + t] || 0; slots.push({ iso: iso, turno: t, ok: true, cap: b ? b * 1.4 : CAP_TURNO_[t], mat: mapaMaterial_(['box'], true), correr: { libre: 1, tempo: 1, series: 1 }, tipo: 'casa' }); }); }
  var ocupado = {}, duras = {}, aRecolocar = [];
  filas.forEach(function (r) { var h = horaDe_(r._iso, r._turno), dt = (t0 - h) / 36e5; if (dt > 48 || h > t1 + 24 * 36e5) { ocupado[r._iso + r._turno] = (ocupado[r._iso + r._turno] || 0) + r._min; if (esDura_(r)) duras[r._iso] = 1; } });
  filas.forEach(function (r) {
    var h = horaDe_(r._iso, r._turno), dt = (t0 - h) / 36e5, despues = (h - t1) / 36e5, extra = norm(r.ORIGEN) !== 'FABRIK', z2 = esZ2Fila_(r) || /W03/.test(r['CÓDIGOS'] || '');
    if (p.tipo === 'fisica' && extra && !z2) { cambios.push({ id: r.ID, accion: 'suprimir', motivo: 'Semana de competición física: fuera P1–P4 y extras (manual §17.3)' }); return; }
    if (h >= t0 && h <= t1) { if (p.tipo === 'fisica') cambios.push({ id: r.ID, accion: 'suprimir', motivo: 'Día de competición' }); else aRecolocar.push(r); return; }
    if (dt > 0 && dt <= 24) {
      if (z2 && r._min <= 40) { cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: 'Z2 MUY SUAVE 20–30′ (o descanso) + 15′ de estiramientos y movilidad.\nNada de intensidad.', motivo: '24 h antes: descanso, como mucho Z2 suave' }); return; }
      if (p.tipo === 'fisica') { cambios.push({ id: r.ID, accion: 'suprimir', motivo: '24 h antes de competir: descanso' }); return; }
      aRecolocar.push(r); return;
    }
    if (dt > 24 && dt <= 48) {
      if (p.tipo === 'fisica') { cambios.push({ id: r.ID, accion: 'suprimir', motivo: '48–24 h antes: solo repaso de movimientos (se sustituye)' }); return; }
      if (esDura_(r)) { aRecolocar.push(r); return; }
      var proteger = !implic.length || cargasFila_(r).some(function (c) { return implic.indexOf(c) >= 0; });
      if (proteger && !z2) { var mv = mitadVolumen_(r.CONTENIDO); cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: mv.txt, motivo: '48–24 h antes: −50 % de volumen' + (implic.length ? ' (protege ' + implic.join(', ').toLowerCase() + ')' : '') });
        aRecolocar.push(Object.assign({}, r, { _comp: true, _min: Math.round(r._min / 2) })); }
      return;
    }
    if (dt > 48 && dt <= 72 && p.tipo === 'fisica' && !z2) { var mv2 = mitadVolumen_(r.CONTENIDO); cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: mv2.txt + '\n\nINTENSIDAD ALTA: mantén las cargas y los ritmos.', motivo: '72–48 h antes: volumen medio-bajo, intensidad alta' }); return; }
    if (despues > 0 && despues <= 24 && !z2) { aRecolocar.push(r); return; }
  });
  // recolocar después (y +24 h); el día después de grabar como mucho +40 %
  var desde = t1 + 24 * 36e5;
  aRecolocar.sort(function (a, b) { return prioridadFila_(b, w) - prioridadFila_(a, w); }).forEach(function (r) {
    var s = colocar_(r, slots, ocupado, duras, { desde: desde });
    if (r._comp) {
      if (s) cambios.push({ accion: 'nuevo', iso: s.iso, turno: s.turno, nuevo: Object.assign({}, r, { ORIGEN: 'COMPENSACIÓN', 'TÍTULO': 'Compensación · 50 % de «' + (r['TÍTULO'] || r.BLOQUE) + '»', CONTENIDO: mitadVolumen_(r.CONTENIDO).txt, MIN: r._min, ID: '' }), motivo: 'Volumen recortado antes de competir, devuelto después' });
      else cambios.push({ accion: 'nuevo-pendiente', titulo: 'Compensación · 50 % de «' + (r['TÍTULO'] || r.BLOQUE) + '»', motivo: 'No cabe esta semana sin afectar a la competición' });
      return;
    }
    if (s) cambios.push({ id: r.ID, accion: 'mover', iso: s.iso, turno: s.turno, motivo: 'Fuera de la ventana de competición; se compensa después' });
    else cambios.push({ id: r.ID, accion: 'pendiente', motivo: 'No cabe esta semana sin afectar a la competición' });
  });
  // repaso (física) y plan del día de competición
  if (p.tipo === 'fisica') {
    var dRep = sumarDias(dias[0], -2), dInt = sumarDias(dias[0], -1);
    if (dRep >= lunes) cambios.push({ accion: 'nuevo', iso: dRep, turno: 'PM', nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Repaso de competición · volumen mínimo', CONTENIDO: repasoCompeti_(p.wod), MIN: 30, INTENSIDAD: '🟠 Repaso', 'CÓDIGOS': '' }, motivo: '48–24 h antes: repaso de movimientos' });
    if (dInt >= lunes) cambios.push({ accion: 'nuevo', iso: dInt, turno: 'AM', nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Descanso pre-competición', CONTENIDO: 'Descanso. 15–20′ de movilidad y estiramientos suaves.\nHidratos altos en las comidas (6–8 g/kg), hidratación y a dormir pronto.', MIN: 20, 'CÓDIGOS': '' }, motivo: '24 h antes: descanso' });
  }
  dias.forEach(function (d) { cambios.push({ accion: 'nuevo', iso: d, turno: p.tipo === 'fisica' ? 'AM' : (p.turno || 'AM'), nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': (p.tipo === 'fisica' ? 'COMPETICIÓN' : 'GRABACIÓN ONLINE') + ' · plan del día', CONTENIDO: planDiaCompeti_(p.wod, implic), MIN: 60, INTENSIDAD: '🏆 Competición', 'CÓDIGOS': '' }, motivo: 'Calentamiento, ritmo y combustible' }); });
  var post = sumarDias(dias[dias.length - 1], 1);
  if (post <= sumarDias(lunes, 6)) cambios.push({ accion: 'nuevo', iso: post, turno: 'AM', nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Recuperación post-competición', CONTENIDO: '20–30′ de Z1/Z2 muy suave (bike o paseo) + 15′ de movilidad.\n48 h sin excéntrico pesado.', MIN: 40, INTENSIDAD: '🔵 Z1', 'CÓDIGOS': '' }, motivo: '24 h después: mínimo' });
  if (p.tipo === 'online' && !p.wod) avisos.push('Sin el WOD: se recorta todo lo de 48–24 h por igual. Si lo pegas, solo protejo lo que implica.');
  return { cambios: cambios, avisos: avisos, implicados: implic, mejorHueco: p.tipo === 'online' ? mejorHuecoGrabar_(lunes, filas) : null,
    resumen: (p.tipo === 'fisica' ? 'Competición física ' : 'Grabación online ') + dias.map(function (d) { return diaDe_(d) + ' ' + isoAFecha(d).slice(0, 5); }).join(', ') + (implic.length ? ' · implica ' + implic.join(', ').toLowerCase() : '') };
}
/**
 * v0.22 · Reestructurar › TRABAJO METCON. La semana NO se toca: solo se añaden 1–3 metcons en la mañana (o tarde) del día que elijas.
 *  1 → el más completo posible · 2 → fuerza + crossfit · 3 → fuerza + crossfit + core.
 * Cada metcon ataca estímulos pendientes del MES (y de la semana) con el material que tienes; un estímulo solo cuenta si el metcon
 * le da volumen e intensidad de verdad (≥8′ de trabajo y el movimiento como pieza principal, no de relleno).
 * p: { iso, turno, n, min:[..], formato:[..], material:[..], nada, chaleco, correr }
 */
function proponerMetconTrabajo_(lunes, p) {
  var G = guiaMotor_(), w = pesoCarencias_(lunes), avisos = [], cambios = [];
  var iso = isoOk_(p.iso) || hoyIso_(), turno = p.turno === 'PM' ? 'PM' : 'AM', n = Math.max(1, Math.min(3, +p.n || 1));
  var lista = p.nada ? ['_nada'] : (p.material || []).concat(p.chaleco ? ['chaleco'] : []);
  if (!lista.length) lista = ['_nada'];
  var mat = mapaMaterial_(lista, false); if (p.correr) mat._correr = true;
  var tiene = function (m) { return !m.mat || mat[m.mat] || (m.alt && mat[m.alt]); };
  var disp = G.movs.filter(tiene);
  var roles = n === 1 ? ['completo'] : n === 2 ? ['fuerza', 'crossfit'] : ['fuerza', 'crossfit', 'core'];
  var ROL = {
    completo: { pats: ['OLY', 'OH', 'SENT', 'BISAGRA', 'TIRON', 'EMPUJE_G', 'CUERPO', 'SALTO', 'CORE', 'ACARREO'], k: 4, fmt: 'AMRAP', nombre: 'Completo' },
    fuerza: { pats: ['SENT', 'BISAGRA', 'OLY', 'OH', 'EMPUJE_G', 'TIRON'], k: 2, fmt: null, nombre: 'Fuerza', cargado: true },
    crossfit: { pats: ['OLY', 'OH', 'TIRON', 'EMPUJE_G', 'CUERPO', 'SALTO', 'SENT', 'BISAGRA', 'ACARREO'], k: 3, fmt: 'AMRAP', nombre: 'CrossFit' },
    core: { pats: ['CORE', 'ACARREO'], k: 3, fmt: 'EMOM', nombre: 'Core' }
  };
  var usados = {}, dia = filasSemanaActivas_(lunes).filter(function (r) { return r._iso === iso && r._turno === turno; });
  var minDia = dia.reduce(function (a, r) { return a + (r._min || 0); }, 0);
  roles.forEach(function (rol, i) {
    var R = ROL[rol], min = +(p.min || [])[i] || +(p.min || [])[0] || (rol === 'core' ? 10 : rol === 'fuerza' ? 15 : 16), fmt = String((p.formato || [])[i] || (p.formato || [])[0] || 'auto');
    var cand = disp.filter(function (m) { return R.pats.indexOf(m.patron) >= 0 && !usados[m.k] && (!R.cargado || m.mat && m.mat !== 'comba' || /PISTOL|PIKE|HSPU|WEIGHTED|DIPS/.test(m.k)); })
      .sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0) || (b.c ? 1 : 0) - (a.c ? 1 : 0); });
    var elegidos = [], pats = {}, solapa = function (m) { return elegidos.some(function (e) { return e.carga.filter(function (c) { return m.carga.indexOf(c) >= 0 && c !== 'GLUC'; }).length >= 2 || (e.carga.indexOf('PIERNA') >= 0 && m.carga.indexOf('PIERNA') >= 0 && (rol === 'completo' || rol === 'crossfit')); }); };
    if (rol === 'completo' || rol === 'crossfit') { var gym = cand.filter(function (m) { return m.patron === 'TIRON' || m.patron === 'EMPUJE_G'; })[0]; if (gym) { elegidos.push(gym); pats[gym.patron] = 1; } }
    cand.forEach(function (m) { if (elegidos.length < R.k && !pats[m.patron] && !solapa(m)) { elegidos.push(m); pats[m.patron] = 1; } });
    cand.forEach(function (m) { if (elegidos.length < R.k && elegidos.indexOf(m) < 0 && !solapa(m)) elegidos.push(m); });
    cand.forEach(function (m) { if (elegidos.length < R.k && elegidos.indexOf(m) < 0) elegidos.push(m); });
    if (!elegidos.length) { avisos.push(R.nombre + ': no hay movimientos con ese material.'); return; }
    elegidos.forEach(function (m) { usados[m.k] = 1; });
    if (fmt === 'auto') fmt = rol === 'fuerza' ? (elegidos.some(function (m) { return m.mat === 'barra' || m.mat === 'db' || m.mat === 'kb'; }) ? 'VENTANAS' : 'EMOM') : rol === 'core' ? 'EMOM' : min >= 25 ? 'CHIPPER' : min <= 10 ? 'AMRAP' : (R.fmt || 'AMRAP');
    var deseo = (rol === 'fuerza' ? 'pesado ' : '') + elegidos.map(function (m) { return m.n.split(' (')[0]; }).join(', ') + ' · ' + fmt.replace('_', ' ') + ' ' + min + "'" +
      ((rol === 'crossfit' || rol === 'completo') && p.correr ? ' · intercalar carrera' : '');
    var r = metconGuiado_(deseo, { lunes: lunes, material: lista.concat(p.correr ? ['_correr'] : []), min: min, formato: fmt });
    var b = r.bloque, T = parseInt(String(b.MIN), 10) - 10 || min;
    // estímulos que cuentan: solo los movimientos elegidos como pieza principal y con trabajo suficiente
    var cuentan = elegidos.filter(function (m) { return m.c && T >= 8; }).map(function (m) { return m.c; }).filter(function (c, k, a) { return a.indexOf(c) === k; });
    var pend = cuentan.filter(function (c) { return (w[c] || 0) > 0; });
    var cont = b.CONTENIDO;
    if (p.chaleco || mat.chaleco) { var bw = elegidos.filter(function (m) { return !m.mat || /PISTOL|PIKE|WEIGHTED/.test(m.k); }); if (bw.length) cont += '\nCHALECO: ' + bw.map(function (m) { return m.n.toLowerCase(); }).join(', ') + ' con chaleco (si la técnica aguanta).'; }
    if (p.nada) cont += '\nSIN MATERIAL: todo con el peso corporal' + (p.chaleco ? ' (+ chaleco)' : '') + '.';
    cambios.push({ accion: 'nuevo', iso: iso, turno: turno, nuevo: Object.assign({}, b, { ORIGEN: 'METCON EXTRA', 'TÍTULO': 'METCON ' + (i + 1) + '/' + roles.length + ' · ' + R.nombre + ' · ' + b['TÍTULO'].replace(/^METCON A MEDIDA · /, ''),
      CONTENIDO: cont, 'CÓDIGOS': cuentan.join('|'), ORDEN: (turno === 'AM' ? 5 : 80) + i,
      'POR QUÉ (cursiva)': R.nombre + (pend.length ? ': ataca estímulos pendientes del mes/semana (' + pend.join(', ') + ') con volumen suficiente para contar. ' : ': nada pendiente con este material; trabajo general de calidad. ') + (b['POR QUÉ (cursiva)'] || '') }),
      motivo: 'Trabajo metcon ' + (i + 1) + '/' + roles.length + ' (' + R.nombre.toLowerCase() + ')' });
    (r.avisos || []).forEach(function (a) { if (avisos.indexOf(a) < 0) avisos.push(R.nombre + ': ' + a); });
  });
  var total = cambios.reduce(function (a, c) { return a + (+c.nuevo.MIN || 0); }, 0);
  if (minDia + total > (turno === 'AM' ? 75 : 120)) avisos.push('Esa ' + (turno === 'AM' ? 'mañana' : 'tarde') + ' sumaría ' + (minDia + total) + '′ con lo que ya tienes: valora quitar un metcon o acortarlos.');
  if (dia.some(function (r) { return esDura_(r); })) avisos.push('Ya hay una sesión dura ese turno: los metcons se suman encima.');
  return { cambios: cambios, avisos: avisos, resumen: 'Trabajo metcon · ' + diaDe_(iso) + ' ' + turno + ' · ' + cambios.length + ' metcon' + (cambios.length > 1 ? 's' : '') + ' (' + total + '′)' + (p.nada ? ' · sin material' : '') };
}
/**
 * v0.22 · Competi como evento especial (online de 1 día / clasificatorio, o física de 1+ días). Una competi es RPE 10: hay que llegar fresco.
 *  - Valora los grupos musculares que implica el WOD (si lo pegas).
 *  - Las 24 h previas: solo movilidad, estiramientos y, como mucho, Z2 en ergómetro ≤20′ o carrera suave ≤35′.
 *  - Desde ahora (con o sin esta mañana, si es hoy) hasta 24 h antes se reorganiza para cubrir lo que queda de la semana: primero Fabrik,
 *    después los extras por carencias. Nada que cargue los grupos del WOD en las 48 h previas, nunca dos sesiones duras a <48 h.
 *  - Lo del día de la competi: si quieres, justo después del evento entran 3 opciones (pendientes de Fabrik, extras o 3 combinaciones de 2).
 *  - Si la competi es por la mañana: tarde libre para entrenar o no; domingo sí o no. Lo que no cabe se decide bloque a bloque.
 * p: { tipo: 'online'|'fisica', iso | dias[], turno, wod, post: 'no'|'pendientes'|'extras'|'ambos', tarde, domingo, hoyManana }
 */
function proponerCompeti2_(lunes, p) {
  var w = pesoCarencias_(lunes), avisos = [], cambios = [], G = null; try { G = guiaMotor_(); } catch (e) {}
  var fisica = p.tipo === 'fisica', dias = (fisica ? (p.dias || []) : [p.iso]).filter(Boolean).map(String).sort();
  if (!dias.length) throw new Error('falta_dia_competi');
  var tu = fisica ? 'AM' : (p.turno === 'PM' ? 'PM' : 'AM'), d0 = dias[0], dN = dias[dias.length - 1];
  var t0 = horaDe_(d0, tu), t1 = fisica ? horaDe_(dN, 'PM') : t0, lim24 = t0 - 24 * 36e5, lim48 = t0 - 48 * 36e5;
  var hoy = hoyIso_(), inicio = lunes > hoy ? horaDe_(lunes, 'AM') : horaDe_(hoy, p.hoyManana ? 'AM' : 'PM');
  var domingo = sumarDias(lunes, 6), wod = String(p.wod || '');
  // valoración del WOD: grupos musculares y movimientos
  var implic = wod ? cargasDe_(norm(wod), '10') : [], movsW = [];
  if (wod && G) movsW = detectarMovs_(norm(wod), G).map(function (x) { return x.m; });
  movsW.forEach(function (m) { m.carga.forEach(function (c) { if (c !== 'GLUC' && c !== 'AERO' && implic.indexOf(c) < 0) implic.push(c); }); });
  var GRUPO = { PIERNA: 'pierna (cuádriceps, glúteo, isquios)', HOMBRO: 'hombro y tríceps', AGARRE: 'agarre y dorsal', CORE: 'core', SNC: 'sistema nervioso (cargas altas / olímpicos)', IMPACTO: 'impacto (tobillo, tendón de Aquiles)', GLUC: 'glucolítico', AERO: 'aeróbico' };
  var valoracion = implic.length ? implic.map(function (c) { var mv = movsW.filter(function (m) { return m.carga.indexOf(c) >= 0; }).map(function (m) { return m.n.toLowerCase(); }); return (GRUPO[c] || c.toLowerCase()) + (mv.length ? ' (' + mv.join(', ') + ')' : ''); }) : [];
  var solapa = function (r) { var cg = cargasFila_(r); return implic.some(function (c) { return cg.indexOf(c) >= 0 && c !== 'GLUC' && c !== 'AERO'; }); };
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && horaDe_(r._iso, r._turno) >= inicio && norm(r.ORIGEN) !== 'COMPETI'; });
  if (listar_(HOJAS.REEST).some(function (x) { return x.MODO === 'Competi' && x.ESTADO === 'Aplicada' && celdaIso_(x.LUNES) === lunes; })) avisos.push('Ya hay una competi aplicada esta semana: si es la misma, deshazla antes en Reestructurar.');
  var esEvento = function (iso, t) { var h = horaDe_(iso, t); return fisica ? dias.indexOf(iso) >= 0 : iso === d0 && t === tu; };
  var bloqueado = function (iso, t) {   // turnos sin entrenar
    var h = horaDe_(iso, t);
    if (h < inicio || esEvento(iso, t)) return true;
    if (h >= lim24 && h < t0) return true;                                  // 24 h previas: solo lo suave (se trata aparte)
    if (!fisica && iso === d0 && t !== tu && h > t0 && !p.tarde) return true;   // tarde del día de la competi
    if (iso === domingo && !p.domingo && iso > dN) return true;
    return false;
  };
  var apto24 = function (r) { var t = norm((r['TÍTULO'] || '') + ' ' + String(r.CONTENIDO || '').slice(0, 200)), cod = r['CÓDIGOS'] || '';
    if (/MOVILIDAD|MOBILITY|ESTIRAM|STRETCH|RANGO/.test(t) && !esDura_(r)) return 'movilidad';
    if (/W03/.test(cod) || (/ERG|BIKE|ROW|SKI/.test(t) && esZ2Fila_(r))) return 'erg';
    if (esZ2Fila_(r)) return 'carrera';
    return ''; };
  var aRecolocar = [], ya24 = false;
  filas.forEach(function (r) {
    var h = horaDe_(r._iso, r._turno);
    if (esEvento(r._iso, r._turno)) { aRecolocar.push(Object.assign(r, { _motivo: 'Coincide con la competición' })); return; }
    if (h >= lim24 && h < t0) {
      var a = apto24(r);
      if (a === 'movilidad') { ya24 = true; return; }
      if (a === 'erg' || a === 'carrera') { ya24 = true; cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: a === 'erg' ? 'Z2 EN ERGÓMETRO 20′ como máximo · RPE 2–3, conversacional.\n+ 10–15′ de movilidad y estiramientos.\nNada de intensidad: mañana compites (RPE 10).' : 'CARRERA SUAVE DE RECUPERACIÓN 30–35′ como máximo · RPE 2–3.\n+ 10′ de movilidad.\nSin cambios de ritmo: mañana compites (RPE 10).', motivo: '24 h antes de competir: solo suave' }); return; }
      aRecolocar.push(Object.assign(r, { _motivo: '24 h antes de competir: fuera todo lo que cargue músculo o SNC' })); return;
    }
    if (bloqueado(r._iso, r._turno)) { aRecolocar.push(Object.assign(r, { _motivo: r._iso === domingo ? 'Domingo sin entrenar' : !fisica && r._iso === d0 ? 'Tarde de la competición sin entrenar' : 'Fuera de los turnos disponibles' })); return; }
    if (h >= lim48 && h < lim24 && solapa(r)) aRecolocar.push(Object.assign(r, { _motivo: '48–24 h antes: carga ' + implic.filter(function (c) { return cargasFila_(r).indexOf(c) >= 0; }).join(', ').toLowerCase() + ', lo mismo que el WOD' }));
  });
  var mueven = {}; aRecolocar.forEach(function (r) { mueven[r.ID] = 1; });
  var quedan = filas.filter(function (r) { return !mueven[r.ID]; }), ocupado = cargaBase_(quedan), duras = {};
  quedan.forEach(function (r) { if (esDura_(r)) duras[r._iso] = 1; });
  dias.forEach(function (d) { duras[d] = 1; });   // la competi es la sesión más dura: nada duro a <48 h
  var slots = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); ['AM', 'PM'].forEach(function (t) { if (!bloqueado(iso, t)) slots.push({ iso: iso, turno: t, ok: true, cap: CAP_TURNO_[t], mat: mapaMaterial_(['box'], true), correr: { libre: 1, tempo: 1, series: 1 }, tipo: 'casa' }); }); }
  var colocarC = function (r) {   // como colocar_, pero sin cargar los grupos del WOD en las 48 h previas
    var off = slots.filter(function (s) { var h = horaDe_(s.iso, s.turno); return s.ok && h >= lim48 && h < t0 && solapa(r); });
    off.forEach(function (s) { s.ok = false; }); var s = colocar_(r, slots, ocupado, duras, {}); off.forEach(function (x) { x.ok = true; }); return s;
  };
  // post-competición: 3 opciones de bloques ligeros que no repitan lo que ha machacado el WOD
  var opcionesPost = [];
  if (p.post && p.post !== 'no') {
    var ligero = function (r) { return !esDura_(r) && !solapa(r) && !esCarreraFila_(r); };
    var fab = aRecolocar.filter(function (r) { return norm(r.ORIGEN) === 'FABRIK' && ligero(r); }).map(function (r) { return { id: r.ID, titulo: r['TÍTULO'] || r.BLOQUE, min: r._min, cargas: cargasFila_(r), prio: prioridadFila_(r, w) }; });
    pendientesAbiertos_().filter(function (q) { return q.ESTADO === 'Pendiente'; }).forEach(function (q) { var pseudo = { 'TÍTULO': q.BLOQUE, CONTENIDO: q._CONTENIDO, ORIGEN: q.TIPO, MIN: q._MIN, 'CÓDIGOS': '', INTENSIDAD: q._INTENSIDAD };
      if (ligero(pseudo)) fab.push({ pend: q.ID, titulo: 'Pendiente · ' + q.BLOQUE, contenido: q._CONTENIDO, min: +q._MIN || 15, cargas: cargasFila_(pseudo), prio: 1 }); });
    var cat = catalogo_(), ext = aRecolocar.filter(function (r) { return norm(r.ORIGEN) !== 'FABRIK' && ligero(r); }).map(function (r) { return { id: r.ID, titulo: r['TÍTULO'] || r.BLOQUE, min: r._min, cargas: cargasFila_(r), prio: prioridadFila_(r, w) }; });
    Object.keys(cat).filter(function (c) { var r = cat[c]; return r.CONTENIDO && !/CARRERA/.test(norm(r.ORIGEN)) && (w[c] || 0) > 0; }).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); }).forEach(function (c) {
      var r = cat[c], pseudo = { 'TÍTULO': r.NOMBRE, CONTENIDO: r.CONTENIDO, 'CÓDIGOS': c, ORIGEN: 'EXTRA', MIN: r.MIN, INTENSIDAD: r.INTENSIDAD };
      if (ligero(pseudo) && !ext.some(function (e) { return e.codigo === c; })) ext.push({ codigo: c, titulo: r.NOMBRE, contenido: r.CONTENIDO, min: +r.MIN || 12, cargas: cargasFila_(pseudo), prio: w[c] });
    });
    fab.sort(function (a, b) { return b.prio - a.prio; }); ext.sort(function (a, b) { return b.prio - a.prio; });
    var sueltas = function (l) { return l.slice(0, 3).map(function (x) { return { titulo: x.titulo, items: [x] }; }); };
    if (p.post === 'pendientes') opcionesPost = sueltas(fab);
    else if (p.post === 'extras') opcionesPost = sueltas(ext);
    else {
      var pares = []; fab.slice(0, 5).forEach(function (f) { ext.slice(0, 5).forEach(function (e) { if (f.cargas.some(function (c) { return e.cargas.indexOf(c) >= 0 && c !== 'GLUC'; })) return; pares.push({ titulo: f.titulo + ' + ' + e.titulo, items: [f, e], prio: f.prio + e.prio }); }); });
      opcionesPost = pares.sort(function (a, b) { return b.prio - a.prio; }).slice(0, 3);
    }
    opcionesPost.forEach(function (o, i) { o.k = i; o.min = o.items.reduce(function (a, x) { return a + (x.min || 0); }, 0); });
    if (!opcionesPost.length) avisos.push('No encontré bloques ligeros que no repitan lo que carga el WOD para después de la competi.');
  }
  // recolocar: Fabrik primero, después extras por carencias; si Fabrik no cabe, desplaza un extra de menor prioridad
  var cola = aRecolocar.slice().sort(function (a, b) { return (norm(b.ORIGEN) === 'FABRIK') - (norm(a.ORIGEN) === 'FABRIK') || prioridadFila_(b, w) - prioridadFila_(a, w); });
  var colocado = {};
  for (var i = 0; i < cola.length; i++) {
    var r = cola[i], s = colocarC(r);
    if (!s && norm(r.ORIGEN) === 'FABRIK') {
      var victima = quedan.concat(cola.filter(function (x) { return colocado[x.ID]; })).filter(function (x) { return norm(x.ORIGEN) !== 'FABRIK' && !mueven[x.ID + '_v'] && horaDe_(x._iso, x._turno) < lim24 && x._min >= r._min * 0.6 && prioridadFila_(x, w) < prioridadFila_(r, w); })
        .sort(function (a, b) { return prioridadFila_(a, w) - prioridadFila_(b, w); })[0];
      if (victima) {
        var vs = colocado[victima.ID] || { iso: victima._iso, turno: victima._turno };
        ocupado[vs.iso + vs.turno] = Math.max(0, (ocupado[vs.iso + vs.turno] || 0) - victima._min); mueven[victima.ID + '_v'] = 1;
        cambios = cambios.filter(function (c) { return c.id !== victima.ID; });
        delete colocado[victima.ID]; cola.push(Object.assign(victima, { _motivo: 'Deja su hueco a Fabrik (prioridad)' }));
        s = colocarC(r);
      }
    }
    if (s) { colocado[r.ID] = s; cambios.push({ id: r.ID, accion: 'mover', iso: s.iso, turno: s.turno, motivo: r._motivo + ' → ' + diaDe_(s.iso).toLowerCase() + ' ' + s.turno + (norm(r.ORIGEN) === 'FABRIK' ? ' (Fabrik primero)' : '') }); }
    else cambios.push({ id: r.ID, accion: 'pendiente', noCabe: true, carreraErg: esCarreraFila_(r) || /W03/.test(r['CÓDIGOS'] || ''), motivo: r._motivo + '. No cabe sin cargar la competición: decide (no hacer, pendientes, +25 % si es carrera/erg, o el hueco que quieras).' });
  }
  // 24 h antes: si no hay nada suave, se propone
  if (!ya24) { var dPrev = sumarDias(d0, -1); if (dPrev >= lunes && horaDe_(dPrev, tu) >= inicio) cambios.push({ accion: 'nuevo', iso: dPrev, turno: tu, nuevo: { ORIGEN: 'COMPETI', 'TÍTULO': 'Víspera de competi · movilidad + Z2 suave (opcional)', CONTENIDO: '15–20′ de movilidad y estiramientos (cadera, hombro, tobillo).\nOpcional: Z2 en ergómetro 20′ como máximo (RPE 2–3) o carrera suave ≤35′.\nNada que cargue músculo ni sistema nervioso.', MIN: 20, INTENSIDAD: '🟢 Suave', 'CÓDIGOS': '' }, motivo: '24 h antes: llegar fresco' }); }
  // el evento
  dias.forEach(function (d) { cambios.push({ accion: 'nuevo', iso: d, turno: tu, nuevo: { ORIGEN: 'COMPETI', ORDEN: tu === 'AM' ? 1 : 41, 'TÍTULO': (fisica ? 'COMPETICIÓN' : 'COMPETI ONLINE / CLASIFICATORIO') + ' · RPE 10',
    CONTENIDO: (valoracion.length ? 'GRUPOS IMPLICADOS: ' + valoracion.join(' · ') + '\n\n' : '') + planDiaCompeti_(wod, implic), MIN: 60, INTENSIDAD: '🔴 RPE 10', 'CÓDIGOS': '' }, motivo: 'Día de competición: RPE 10' }); });
  var resumen = (fisica ? 'Competición física ' : 'Competi online ') + dias.map(function (d) { return diaDe_(d) + ' ' + isoAFecha(d).slice(0, 5); }).join(', ') + (fisica ? '' : ' ' + tu) +
    ' · ' + cambios.filter(function (c) { return c.accion === 'mover'; }).length + ' recolocados · ' + cambios.filter(function (c) { return c.noCabe; }).length + ' sin hueco';
  if (!wod) avisos.push('Sin el WOD no sé qué grupos protege: se aplica solo la regla de 24 h y la de 48 h entre sesiones duras. Si lo pegas, protejo lo que implica.');
  return { cambios: cambios, avisos: avisos, implicados: implic, valoracion: valoracion, opcionesPost: opcionesPost, postIso: d0, postTurno: tu, resumen: resumen };
}
function repasoCompeti_(wod) {
  var movs = MOV_MEGA_.filter(function (m) { return wod && m.re.test(norm(wod)); }).slice(0, 4);
  if (!movs.length) return 'Calentamiento completo + 2 rondas suaves de los movimientos de la competición (3–5 reps cada uno).\nIntensidad igual o algo superior a la de la competición, volumen mínimo. Nada hasta el fallo.';
  return 'Calentamiento 12′ + 2 RONDAS (descanso 2′):\n' + movs.map(function (m) { return Math.max(2, Math.round(m.reps / 4)) + ' ' + m.n; }).join('\n') + '\n\nIntensidad igual o algo superior a la de la competición (cargas de competición), volumen muy bajo. Sin fatiga.';
}
function planDiaCompeti_(wod, implic) {
  var w = norm(wod || ''), fmt = /AMRAP/.test(w) ? 'AMRAP: arranca al 85 % y mantén un ritmo que puedas repetir; tandas fijas desde la 1.ª ronda.' : /FOR TIME|TIME CAP|CAP/.test(w) ? 'FOR TIME: no te vayas en el primer tercio; acelera en el último.' : /EMOM|EVERY/.test(w) ? 'Intervalos: mismo ritmo en todas las ventanas; el descanso es para respirar, no para mirar el reloj.' : 'Pacing: primer tercio al 85 %, último tercio a tope.';
  var cal = { HOMBRO: 'hombro (bandas, wall slides, 2×5 del movimiento con carga creciente)', PIERNA: 'pierna (sentadilla, saltos progresivos)', AGARRE: 'agarre (cuelgue activo, 2 tandas cortas)', SNC: 'sistema nervioso (2–3 singles rápidos al 70–80 %)', GLUC: 'motor (2′ de erg con 3 aceleraciones de 10″)', IMPACTO: 'tobillo (pogos, comba)' };
  return 'CALENTAMIENTO ESPECÍFICO 20–25′: general 8′ + ' + (implic.length ? implic.map(function (c) { return cal[c]; }).filter(Boolean).join(' · ') : 'movimientos del WOD en progresión') + ' + 1 ronda corta del WOD al 70 %.\n\n' +
    'RITMO: ' + fmt + '\n\nCOMBUSTIBLE: comida 2–3 h antes con 1–2 g/kg de hidratos y poca grasa; 30′ antes 20–30 g de hidratos rápidos. Agua con una pizca de sal. Cafeína solo si ya la has probado en entrenos.' + (wod ? '\n\nWOD:\n' + wod : '');
}
function mejorHuecoGrabar_(lunes, filas) {
  var punt = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); if (iso < hoyIso_()) continue; ['AM', 'PM'].forEach(function (t) {
    var h = horaDe_(iso, t), carga = filas.filter(function (r) { var dh = (h - horaDe_(r._iso, r._turno)) / 36e5; return dh > 0 && dh <= 48; }).reduce(function (a, r) { return a + r._min * (esDura_(r) ? 2 : 1); }, 0);
    punt.push({ iso: iso, turno: t, carga: carga }); }); }
  return punt.sort(function (a, b) { return a.carga - b.carga; }).slice(0, 2);
}

// ---------- proponer · aplicar · deshacer ----------
function reestProponer_(modo, lunes, params) {
  lunes = lunesDe_((params && params.lunes) || lunes || hoyIso_());
  var P = modo === 'Viaje' ? proponerViaje_(lunes, params) : modo === 'Competi' ? (params.v === 2 ? proponerCompeti2_(lunes, params) : proponerCompeti_(lunes, params)) : modo === 'Trabajo metcon' ? proponerMetconTrabajo_(lunes, params) : modo === 'Lesión' ? proponerLesionNivel_(lunes, params) : modo === 'Incentivar' ? proponerIncentivo_(lunesDe_(params.lunes || lunes), params) : proponerReorg_(lunes, params);
  var id = 'R' + nuevoId_().slice(0, 6), plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
  P.cambios.forEach(function (c, i) { c.k = i; var r = plan[c.id]; if (r) { c.titulo = r['TÍTULO'] || r.BLOQUE; c.desdeIso = celdaIso_(r.FECHA); c.desdeTurno = r.TURNO === 'AM' ? 'AM' : 'PM'; c.origen = r.ORIGEN; } else if (c.nuevo) c.titulo = c.nuevo['TÍTULO']; });
  var json = JSON.stringify(P);
  anadirFila_(HOJAS.REEST, { ID: id, LUNES: isoAFecha(lunes), MODO: modo, ESTADO: 'Propuesta', RESUMEN: P.resumen, PARAMS: JSON.stringify(params).slice(0, 45000), PROPUESTA: json.length < 49000 ? json : '', CREADA: ahora_() });
  if (json.length >= 49000) CacheService.getScriptCache().put('reest_' + id, json.slice(0, 95000), 21600);
  P.id = id; P.lunes = lunes; P.modo = modo;
  return P;
}
function reestAplicar_(id, ajustes) {
  return bloqueo_(function () {
    var x = listar_(HOJAS.REEST).filter(function (r) { return r.ID === id; })[0]; if (!x) throw new Error('no_encontrado');
    if (x.ESTADO !== 'Propuesta') throw new Error('ya_' + String(x.ESTADO).toLowerCase());
    var P = JSON.parse(x.PROPUESTA || CacheService.getScriptCache().get('reest_' + id) || '{}');
    // v0.22 · competi: opción elegida para después del evento
    (ajustes || []).filter(function (a) { return a.post != null; }).forEach(function (a) {
      var op = (P.opcionesPost || [])[+a.post]; if (!op) return;
      op.items.forEach(function (it, j) {
        var ord = (P.postTurno === 'AM' ? 2 : 42) + j;
        if (it.id) { var c0 = P.cambios.filter(function (c) { return c.id === it.id; })[0];
          if (c0) { c0.accion = 'mover'; c0.iso = P.postIso; c0.turno = P.postTurno; c0.motivo = 'Después de la competi (lo elegiste)'; c0.orden = ord; }
          else P.cambios.push({ id: it.id, accion: 'mover', iso: P.postIso, turno: P.postTurno, motivo: 'Después de la competi (lo elegiste)', orden: ord }); }
        else P.cambios.push({ accion: 'nuevo', iso: P.postIso, turno: P.postTurno, pendId: it.pend || '', nuevo: { ORIGEN: it.pend ? 'PENDIENTE' : 'EXTRA', 'TÍTULO': it.titulo + ' · post-competi', CONTENIDO: it.contenido || '', MIN: it.min || 12, 'CÓDIGOS': it.codigo || '', ORDEN: ord }, motivo: 'Después de la competi (lo elegiste)' });
      });
    });
    (ajustes || []).forEach(function (a) { var c = P.cambios[a.k]; if (!c || a.post != null) return;
      if (a.destino === 'cancelar') { c.accion = c.nuevo ? 'quitar' : 'cancelar'; return; }
      if (a.destino === 'pendiente25' || a.destino === 'pendiente_tal') { c.accion = 'pendiente'; c.motivo = (c.motivo || '') + (a.destino === 'pendiente25' ? ' [+25 %]' : ' [tal cual]'); return; }
      if (a.destino === 'pendiente') c.accion = c.nuevo ? 'quitar' : 'pendiente'; else if (a.destino === 'quitar') c.accion = c.nuevo ? 'quitar' : 'suprimir'; else if (a.iso) { c.iso = a.iso; c.turno = a.turno || 'PM'; if (c.accion === 'pendiente' || c.accion === 'suprimir') c.accion = 'mover'; } });
    asegurarColumna_(HOJAS.PLAN, 'REESTRUCTURA'); asegurarColumna_(HOJAS.PLAN, 'ESTADO PREVIO');
    var plan = {}; listar_(HOJAS.PLAN).forEach(function (r) { plan[r.ID] = r; });
    var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh), nuevas = [], sello = 'reestructura ' + id + ' · ' + ahora_();
    var tocados = {}, tocar = function (r) { if (tocados[r.ID]) return; tocados[r.ID] = 1; actualizarFila_(HOJAS.PLAN, r._fila, { 'ESTADO PREVIO': r.ESTADO, ESTADO: 'SUSTITUIDO', REESTRUCTURA: id, ACTUALIZADO: ahora_() }); };
    var fila = function (o, iso, turno) { return Object.assign({}, o, { ID: nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: turno, ORDEN: o.ORDEN || 60, ESTADO: 'PROGRAMADO', GENERADO: sello, REESTRUCTURA: id, ACTUALIZADO: ahora_() }); };
    P.cambios.forEach(function (c) {
      var r = c.id ? plan[c.id] : null;
      if (c.accion === 'quitar') return;
      if (c.accion === 'nuevo' && c.pendId) { var pq = listar_(HOJAS.PENDIENTES).filter(function (q) { return q.ID === c.pendId; })[0]; if (pq) actualizarFila_(HOJAS.PENDIENTES, pq._fila, { ESTADO: 'Reprogramado', 'SEMANA DESTINO': isoAFecha(lunesDe_(c.iso)) }); }
      if (c.accion === 'nuevo') { var o = Object.assign({}, c.nuevo); delete o._iso; delete o._turno; delete o._min; delete o._comp; delete o._fila; if (!o.ORIGEN) o.ORIGEN = 'REORGANIZADO';
        o['POR QUÉ (cursiva)'] = [o['POR QUÉ (cursiva)'], c.motivo].filter(Boolean).join(' · '); nuevas.push(fila(o, c.iso, c.turno)); return; }
      if (c.accion === 'nuevo-pendiente') { anadirPendiente_({ 'TÍTULO': c.titulo, ORIGEN: 'COMPENSACIÓN' }, c.motivo + ' (' + id + ')'); return; }
      if (!r) return;
      tocar(r);
      if (c.accion === 'pendiente') { anadirPendiente_(r, c.motivo + ' (' + id + ')'); return; }
      if (c.accion === 'cancelar') { actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: 'CANCELADO' }); return; }   // v0.22 · no se hace (deshacer lo devuelve)
      if (c.accion === 'suprimir' || c.accion === 'sustituir') return;
      var o2 = {}; cab.forEach(function (h) { o2[h] = r[h]; });
      if (norm(r.ORIGEN) === 'FABRIK') { o2.ORIGEN = 'FABRIK ADAPTADO'; o2.FABRIK_REF = ''; }
      if (c.contenido) o2.CONTENIDO = c.contenido;
      if (c.min != null) o2.MIN = String(c.min);
      o2['POR QUÉ (cursiva)'] = c.motivo + (r['POR QUÉ (cursiva)'] ? ' · ' + r['POR QUÉ (cursiva)'] : '');
      o2['ESTADO PREVIO'] = '';
      if (c.orden != null) o2.ORDEN = c.orden;
      nuevas.push(fila(o2, c.iso || celdaIso_(r.FECHA), c.turno || r.TURNO));
    });
    if (nuevas.length) sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, nuevas.length, cab.length).setValues(nuevas.map(function (o) { return filaDe_(cab, o); }));
    actualizarFila_(HOJAS.REEST, x._fila, { ESTADO: 'Aplicada', APLICADA: ahora_() });
    if (x.MODO === 'Competi') { try { var pp = JSON.parse(x.PARAMS || '{}'), d0 = pp.tipo === 'fisica' ? (pp.dias || [])[0] : pp.iso, d1 = pp.tipo === 'fisica' ? (pp.dias || []).slice(-1)[0] : pp.iso;
      asegurarColumna_(HOJAS.EVENTOS, 'MUY EXIGENTE'); var idEv = guardarEvento_({ EVENTO: (pp.tipo === 'fisica' ? 'Competición' : 'Grabación online') + ' (Reestructurar)', TIPO: 'Competición', INICIO: isoAFecha(d0), FIN: isoAFecha(d1), BLOQUEA: pp.tipo === 'fisica' ? 'Día completo' : (pp.turno === 'PM' ? 'Tarde' : 'Mañana'), 'CÓMO PROCEDER': 'Reestructurado ' + id, ESTADO: 'Decidido', sinCalendario: true });
      var ev = listar_(HOJAS.EVENTOS).filter(function (e) { return e.ID === idEv; })[0]; if (ev) actualizarFila_(HOJAS.EVENTOS, ev._fila, { 'MUY EXIGENTE': 'Sí' }); } catch (e) { Logger.log('Evento competi: ' + e); } }
    if (P.incentivo && P.incentivo.deltas) guardarIncentivo_(id, P.incentivo.lunes, P.incentivo.deltas);
    if (x.MODO === 'Lesión') { var prL = {}; try { prL = JSON.parse(x.PARAMS || '{}'); } catch (eL) {} lesionAplicada_(P, prL); }   // v0.29
    if (/Viaje|Reorganiz|Competi|Lesi/.test(x.MODO)) try { var noH = {}, pr0 = {}; try { pr0 = JSON.parse(x.PARAMS || '{}'); } catch (eP) {} (pr0.noHechos || []).forEach(function (k) { noH[k] = 1; }); darPorHecho_(lunesDe_(celdaIso_(x.LUNES) || hoyIso_()), id, noH); } catch (eH) { Logger.log('darPorHecho: ' + eH); }
    MEMO = null;
    return { id: id, nuevas: nuevas.length };
  });
}
function reestDeshacer_(id) {
  return bloqueo_(function () {
    var x = listar_(HOJAS.REEST).filter(function (r) { return r.ID === id; })[0]; if (!x) throw new Error('no_encontrado');
    var sh = hojaMia_(HOJAS.PLAN), borrar = [];
    listar_(HOJAS.PLAN).forEach(function (r) {
      if (r.REESTRUCTURA !== id) return;
      if (/^(SUSTITUIDO|CANCELADO)$/.test(r.ESTADO) && r['ESTADO PREVIO']) actualizarFila_(HOJAS.PLAN, r._fila, { ESTADO: r['ESTADO PREVIO'], 'ESTADO PREVIO': '', REESTRUCTURA: '', ACTUALIZADO: ahora_() });
      else borrar.push(r._fila);
    });
    borrar.sort(function (a, b) { return b - a; }).forEach(function (f) { sh.deleteRow(f); });
    listar_(HOJAS.PENDIENTES).forEach(function (p) { if (String(p.MOTIVO || '').indexOf('(' + id + ')') >= 0 && p.ESTADO === 'Pendiente') actualizarFila_(HOJAS.PENDIENTES, p._fila, { ESTADO: 'Descartado' }); });
    actualizarFila_(HOJAS.REEST, x._fila, { ESTADO: 'Deshecha' });
    if (x.MODO === 'Incentivar') guardarIncentivo_(id, null, null);
    try { quitarDadosPorHecho_(id); } catch (eQ) {}
    MEMO = null;
    return true;
  });
}
/** Sobre la marcha: ese día aparece material nuevo → bloque nuevo automático (editable) que ataca lo que más falta con ese material. */
function reestMaterial_(lunes, iso, turno, material) {
  var w = pesoCarencias_(lunesDe_(lunes || iso)), mat = mapaMaterial_(material, false), cat = catalogo_();
  var cands = Object.keys(cat).filter(function (c) { var r = cat[c]; if (!r.CONTENIDO || /CARRERA/.test(norm(r.ORIGEN))) return false; var a = adaptarMaterial_(r.CONTENIDO, mat); return a.cambios === 0; })
    .sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
  if (!cands.length) throw new Error('sin_bloque_para_material');
  var r = cat[cands[0]], o = { ORIGEN: 'VIAJE', 'TÍTULO': r.NOMBRE + ' (material nuevo)', CONTENIDO: r.CONTENIDO, MIN: r.MIN || 12, INTENSIDAD: r.INTENSIDAD, 'CÓDIGOS': cands[0],
    'POR QUÉ (cursiva)': 'Con el material que acabas de marcar, lo que más te falta: ' + r.NOMBRE + '. ' + (r['POR QUÉ (cursiva)'] || ''), 'CIENCIA (técnica · fisiología · biología)': r['CIENCIA (técnica · fisiología · biología)'] || '' };
  var sh = hojaMia_(HOJAS.PLAN), cab = cabeceras_(sh);
  var fila = Object.assign(o, { ID: nuevoId_(), FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: turno, ORDEN: 70, ESTADO: 'BORRADOR', GENERADO: 'manual ' + ahora_() + ' (material nuevo · candado)', ACTUALIZADO: ahora_() });
  sh.getRange(Math.max(1, sh.getLastRow()) + 1, 1, 1, cab.length).setValues([filaDe_(cab, fila)]);
  MEMO = null;
  return fila;
}
function reestActiva_(lunes) {
  var l = lunesDe_(lunes);
  return listar_(HOJAS.REEST).filter(function (r) { return celdaIso_(r.LUNES) === l && r.ESTADO === 'Aplicada'; }).map(function (r) { return { id: r.ID, modo: r.MODO, resumen: r.RESUMEN }; });
}

// ===================== v0.15 · MOTOR GUIADO POR MOTOR_GUIA.md · MOTOR · ANÁLISIS · GEMINI · AGENTE DEL PC · BACKUP DE LOS JUEVES =====================
/*
 * - MOTOR_GUIA.md (Drive, CONFIG › motor_guia_id): sus tablas «## TABLA · …» mandan sobre los movimientos, formatos, pesos e interferencias
 *   del motor. Si no se puede leer, se usa la copia de este código (MOTOR_GUIA_BASE_).
 * - MOTOR · ANÁLISIS (oculta): cada metcon de Fabrik y de competición descompuesto (formato, ventanas, estructura, pesos, interferencias)
 *   + CIENCIA (Claude / Gemini) + CONCEPTOS (Ollama, desde el PC). El motor copia las estructuras que más se parecen a lo que pides.
 * - «Estímulos que quiero»: metconGuiado_ (bloque nuevo, extras) y megaWod_ (Reestructurar B).
 * - Backup de los jueves (Drive) + copia en el PC por el agente; si a las 16:00 no está: correo, aviso en la app y ventana en el PC.
 */
HOJAS.MOTOR = 'MOTOR · ANÁLISIS';
var ESQ_BD_ = {};
ESQ_BD_[HOJAS.MOTOR] = {
  cab: ['ID', 'FUENTE', 'FECHA', 'NOMBRE', 'TEXTO', 'FORMATO', 'MIN', 'VENTANAS', 'ESTRUCTURA', 'MOVIMIENTOS', 'PATRONES', 'PESOS', 'INTERFERENCIAS',
    'OBJETIVO / ESTÍMULO', 'LIMITANTES', 'RPE', 'CIENCIA', 'CONCEPTOS (Ollama)', 'ANALIZADO POR', 'HASH', 'ACTUALIZADO', 'PROCEDENCIA', 'PERMISO', 'VERSIÓN GUÍA', 'IDIOMA'],
  anchos: [90, 95, 90, 220, 320, 90, 50, 160, 200, 200, 130, 140, 260, 240, 220, 50, 380, 260, 120, 90, 120, 150, 95, 80, 55],
  fechas: ['FECHA'], negrita: 'NOMBRE', color: '#8b5cf6', listas: { FUENTE: ['Fabrik', 'Competición', 'Guardado', 'Manual'], PERMISO: ['personal', 'compartible'] },
  colores: [['PERMISO', '^compartible$', '#dcfce7', '#14532d']]
};

// ---------- 1 · La guía ----------
function guiaTexto_() {
  var c = CacheService.getScriptCache(), v = c.get('guia_md_v15');
  if (v) return v;
  var id = leerConfig_().motor_guia_id, t = '';
  if (id) { try { t = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'); } catch (e) { Logger.log('MOTOR_GUIA no legible: ' + e); } }
  if (!/##\s*TABLA/i.test(t)) t = MOTOR_GUIA_BASE_;
  try { c.put('guia_md_v15', t, 21600); } catch (e) { /* >100 KB: sin caché */ }
  return t;
}
function tablasGuia_(md) {
  var T = {}, actual = null;
  String(md || '').replace(/\r/g, '').split('\n').forEach(function (l) {
    var h = l.match(/^##\s*TABLA\s*·\s*(.+?)\s*$/i);
    if (h) { actual = norm(h[1]).trim(); T[actual] = { cab: null, filas: [] }; return; }
    if (/^#/.test(l)) { actual = null; return; }
    if (!actual || !/^\s*\|/.test(l)) return;
    var celdas = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (x) { return x.trim(); });
    if (celdas.every(function (x) { return /^:?-{2,}:?$/.test(x); })) return;
    var t = T[actual];
    if (!t.cab) { t.cab = celdas.map(function (x) { return norm(x).trim(); }); return; }
    if (/^#/.test(celdas[0])) return;
    var o = {}; t.cab.forEach(function (k, i) { o[k] = celdas[i] || ''; }); t.filas.push(o);
  });
  return T;
}
var GUIA_MEMO_ = null;
function guiaMotor_() {
  if (GUIA_MEMO_) return GUIA_MEMO_;
  var T = tablasGuia_(guiaTexto_());
  if (!T.MOVIMIENTOS || !T.MOVIMIENTOS.filas.length) T = tablasGuia_(MOTOR_GUIA_BASE_);
  else {   // v0.22 · movimientos nuevos de la guía base (peso corporal, fuerza) que aún no están en tu copia de Drive
    var Tb = tablasGuia_(MOTOR_GUIA_BASE_), ya = {}; T.MOVIMIENTOS.filas.forEach(function (r) { ya[norm(r.CLAVE).trim()] = 1; });
    ((Tb.MOVIMIENTOS || {}).filas || []).forEach(function (r) { if (r.CLAVE && !ya[norm(r.CLAVE).trim()]) T.MOVIMIENTOS.filas.push(r); });
  }
  var f = function (k) { return (T[k] || { filas: [] }).filas; };
  var lista = function (s) { return String(s || '').split(',').map(function (x) { return norm(x).replace(/\s+/g, ' ').trim(); }).filter(Boolean); };
  var numero = function (s) { var n = parseFloat(String(s || '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  var G = { movs: [], formatos: {}, patrones: [], interf: [], pesos: {}, reglas: {} };
  f('MOVIMIENTOS').forEach(function (r) {
    if (!r.CLAVE) return;
    var k = norm(r.CLAVE).trim();
    G.movs.push({ k: k, n: r.NOMBRE || k, alias: lista(r.ALIAS).concat([k.replace(/_/g, ' ')]).filter(function (a, i, x) { return x.indexOf(a) === i; }).sort(function (a, b) { return b.length - a.length; }),
      mat: String(r.MATERIAL || '').trim().toLowerCase(), alt: String(r.ALTERNATIVA || '').trim().toLowerCase(), patron: norm(r.PATRON).trim(), carga: lista(r.CARGA),
      unidad: String(r.UNIDAD || 'reps').trim().toLowerCase(), reps: numero(r.REPS) || 10, kg: numero(r['KG ♂ RX']), kgF: numero(r['KG ♀ RX']), rm: String(r['1RM DE'] || '').trim(), c: String(r.CODIGO || '').trim().toUpperCase() });
  });
  f('FORMATOS').forEach(function (r) {
    if (!r.CLAVE) return;
    G.formatos[norm(r.CLAVE).trim()] = { k: norm(r.CLAVE).trim(), nombre: r.NOMBRE, min: numero(r.MIN) || 5, max: numero(r.MAX) || 40, ventana: r.VENTANA, sistema: r.SISTEMA, zona: r.ZONA, rpe: r.RPE,
      repsx: numero(r['REPS X']) || 1, cuando: r.CUANDO, estrategia: r.ESTRATEGIA };
  });
  f('PATRONES').forEach(function (r) { if (r.PALABRA) G.patrones.push({ palabras: lista(r.PALABRA), patron: norm(r.PATRON).trim(), carga: norm(r.CARGA).trim() }); });
  f('INTERFERENCIAS').forEach(function (r) {
    if (!r.A || !r.B) return;
    G.interf.push({ a: norm(r.A).trim(), b: norm(r.B).trim(), tipo: String(r.TIPO || '').trim().toLowerCase(), orden: String(r.ORDEN || 'A<>B').replace(/\s/g, '').toUpperCase(), efecto: r['EFECTO BUSCADO'] || '', ciencia: r.CIENCIA || '' });
  });
  f('PESOS').forEach(function (r) { if (r.FORMATO) G.pesos[norm(r.FORMATO).trim()] = { min: numero(r['% MIN']) || 45, max: numero(r['% MAX']) || 65, nota: r.NOTA || '' }; });
  f('REGLAS').forEach(function (r) { if (r.CLAVE) G.reglas[String(r.CLAVE).trim().toLowerCase()] = numero(r.VALOR) || r.VALOR; });
  if (!G.movs.length) throw new Error('MOTOR_GUIA sin tabla de movimientos');
  GUIA_MEMO_ = G;
  return G;
}
function movPorClave_(G, k) { return G.movs.filter(function (m) { return m.k === k; })[0] || null; }
/** Posición del alias en el texto normalizado, con límites de palabra (admite plural en S/ES). -1 si no está. */
function aliasEn_(t, a) {
  var i = t.indexOf(a);
  while (i >= 0) {
    var antes = i ? t.charAt(i - 1) : ' ', resto = t.slice(i + a.length), desp = resto.replace(/^(ES|S)(?=[^A-Z]|$)/, '').charAt(0) || ' ';
    if (!/[A-Z0-9]/.test(antes) && !/[A-Z]/.test(desp)) return i;
    i = t.indexOf(a, i + 1);
  }
  return -1;
}
/** Movimientos de la guía que aparecen en el texto, en orden de aparición (el alias más largo gana: «squat snatch» no cuenta también como «snatch»). */
function detectarMovs_(t, G) {
  t = norm(t);
  var hits = [];
  G.movs.forEach(function (m) {
    m.alias.forEach(function (a) {
      var i = t.indexOf(a);
      while (i >= 0) {
        var antes = i ? t.charAt(i - 1) : ' ', resto = t.slice(i + a.length), plural = (resto.match(/^(ES|S)(?=[^A-Z]|$)/) || [''])[0], desp = resto.slice(plural.length).charAt(0) || ' ';
        if (!/[A-Z0-9]/.test(antes) && !/[A-Z]/.test(desp)) hits.push({ m: m, i: i, len: a.length + plural.length });
        i = t.indexOf(a, i + 1);
      }
    });
  });
  hits.sort(function (x, y) { return y.len - x.len || x.i - y.i; });
  var tomados = [], out = [];
  hits.forEach(function (h) {
    if (tomados.some(function (x) { return h.i < x.i + x.len && x.i < h.i + h.len; })) return;
    tomados.push(h);
    if (!out.some(function (o) { return o.m === h.m; })) out.push(h);
  });
  return out.sort(function (x, y) { return x.i - y.i; });
}
function encaja_(lado, m, fk) { return lado === '*' || lado === m.k || lado === m.patron || (fk && lado === fk); }
/** Interferencias de la guía entre dos movimientos (x antes que y). */
function interfEntre_(G, x, y) {
  return G.interf.filter(function (r) {
    if (encaja_(r.a, x) && encaja_(r.b, y)) return true;
    return r.orden !== 'A>B' && encaja_(r.a, y) && encaja_(r.b, x);
  });
}

// ---------- 2 · Análisis de un WOD ----------
function hashTxt_(txt) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, norm(txt).replace(/\s+/g, ' ').trim());
  return d.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 16);
}
function formatoDeTexto_(t, nMovs) {
  var min = function (re) { var m = t.match(re); return m ? +m[1] : 0; };
  var cap = min(/(?:TIME ?CAP|CAP|TC)[^0-9]{0,4}([0-9]{1,2})/), amrap = min(/AMRAP[^0-9]{0,6}([0-9]{1,2})/), emom = min(/EMOM[^0-9]{0,6}([0-9]{1,2})/);
  var every = t.match(/(?:EVERY|CADA|E)\s*([0-9]{1,2}(?:[:,.][0-9]{2})?)\s*(?:'|′|’|MIN|:00)?\s*(?:X|×)\s*([0-9]{1,2})/);
  var pesado = /HEAVY|PESAD|[0-9]RM|[89][0-9] ?%/.test(t);
  if (/SINCRO|SYNCHRO|IN PAIRS|EN PAREJA|EQUIPO|TEAM OF/.test(t)) return { k: 'SINCRO', min: amrap || cap || emom || 0 };
  if (/[0-9]{1,3}[\"″]? ?ON\b|ON ?\/ ?OFF|[0-9]+ ?: ?[0-9]+ ?(TRABAJO|WORK)|TRABAJO ?\/ ?DESCANSO/.test(t)) return { k: 'INTERVALOS', min: cap || amrap || emom || 0 };
  if (every) { var n = parseFloat(String(every[1]).replace(/[:,]/, '.')), s = +every[2]; return { k: pesado ? 'VENTANAS' : n >= 2.5 ? 'EVERY' : 'EMOM', min: Math.round(n * s) }; }
  if (emom) return { k: 'EMOM', min: emom };
  if (amrap) return { k: amrap <= 10 ? 'AMRAP_C' : amrap <= 20 ? 'AMRAP' : 'AMRAP_L', min: amrap };
  if (/(^|[^0-9])[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}/.test(t)) return { k: 'ESCALERA', min: cap };
  if (/FOR TIME|TIME ?CAP|CAP|POR TIEMPO|CHIPPER/.test(t)) return { k: (nMovs >= 6 || /CHIPPER/.test(t)) ? 'CHIPPER' : cap && cap <= 8 ? 'SPRINT' : 'FOR_TIME', min: cap };
  return { k: '', min: 0 };
}
/** Descompone un WOD. meta (opcional): campos de la ficha de Fabrik { objetivo, modalidad, rpe, limitantes, carga }. */
function analizarWod_(txt, meta) {
  var G = guiaMotor_(), t = norm(txt), meta = meta || {};
  var det = detectarMovs_(t, G), movs = det.map(function (x) { return x.m; });
  var fo = formatoDeTexto_(t, movs.length);
  var vent = [];
  (t.match(/(?:EVERY|CADA)\s*[0-9:,.′'’"″]+\s*(?:MIN)?\s*(?:X|×)\s*[0-9]+(?:\s*(?:SETS|RONDAS|ROUNDS))?/g) || []).forEach(function (x) { vent.push(x.trim()); });
  (t.match(/[0-9]{1,3}\s*["″]?\s*ON\s*\/?\s*[0-9]{1,3}\s*["″]?\s*OFF/g) || []).forEach(function (x) { vent.push(x.trim()); });
  (t.match(/(?:REST|DESCANS[OA]|RECUPERA)\S*\s*[0-9]{1,2}\s*(?:'|′|’|MIN|["″]|SEG)/g) || []).forEach(function (x) { vent.push(x.trim()); });
  var esq = (t.match(/(^|[^0-9])([0-9]{1,3}(?:-[0-9]{1,3}){2,})/) || [])[2] || '', rondas = (t.match(/([0-9]{1,2})\s*(?:RONDAS|ROUNDS|RFT|SETS)/) || [])[1] || '';
  var asc = /\+ ?[0-9]+ ?(REPS? )?(EACH|CADA|POR) (ROUND|RONDA)|ASCENDING|ASCENDENTE/.test(t);
  var estructura = [esq ? esq : '', rondas ? rondas + ' rondas' : '', asc ? 'ascendente' : ''].filter(Boolean).join(' · ');
  estructura = (estructura ? estructura + ' · ' : '') + movs.map(function (m) { return m.k; }).join(' → ');
  var pesos = [];
  (t.match(/[0-9]{1,3}(?:[.,][0-9])?\s*(?:\/\s*[0-9]{1,3}(?:[.,][0-9])?)?\s*(?:KG|LB|LBS|#)/g) || []).concat(t.match(/[0-9]{2,3}(?:\s*\/\s*[0-9]{2,3})?\s*%/g) || [])
    .forEach(function (x) { x = x.replace(/\s+/g, ''); if (pesos.indexOf(x) < 0 && pesos.length < 8) pesos.push(x); });
  if (meta.carga) pesos.push('carga ' + String(meta.carga).replace(/\s+/g, ' ').trim().toLowerCase());
  var inter = [];
  for (var i = 0; i + 1 < movs.length; i++) {
    interfEntre_(G, movs[i], movs[i + 1]).forEach(function (r) { var s = movs[i].k + '→' + movs[i + 1].k + ' (' + r.tipo + ': ' + r.efecto + ')'; if (inter.indexOf(s) < 0) inter.push(s); });
    var fam = { AGARRE: null, HOMBRO: ['OH', 'EMPUJE_G'], PIERNA: ['SENT', 'BISAGRA'] };
    ['AGARRE', 'HOMBRO', 'PIERNA'].forEach(function (c) { var pf = fam[c], mismo = !pf || (pf.indexOf(movs[i].patron) >= 0 && pf.indexOf(movs[i + 1].patron) >= 0); if (mismo && movs[i].carga.indexOf(c) >= 0 && movs[i + 1].carga.indexOf(c) >= 0) { var s2 = movs[i].k + '→' + movs[i + 1].k + ' (doble ' + c.toLowerCase() + ')'; if (inter.indexOf(s2) < 0 && !inter.some(function (z) { return z.indexOf(movs[i].k + '→' + movs[i + 1].k) === 0; })) inter.push(s2); } });
  }
  if (movs.length > 2) interfEntre_(G, movs[movs.length - 1], movs[0]).forEach(function (r) { var s = movs[movs.length - 1].k + '→' + movs[0].k + ' (cambio de ronda · ' + r.tipo + ')'; if (inter.indexOf(s) < 0) inter.push(s); });
  if (fo.k === 'VENTANAS' && movs.some(function (m) { return m.patron === 'MONO'; })) inter.push('ERG→HEAVY (fuerza en fatiga)');
  var obj = meta.objetivo || ((txt.match(/OBJETIVO\s*:\s*([^\n]+(?:\n(?!\s*[A-ZÁÉÍÓÚ ]{4,}:)[^\n]+)*)/i) || [])[1] || '');
  var lim = meta.limitantes || ((txt.match(/LIMITANTE[\s\S]{0,400}/i) || [''])[0]);
  var rpe = meta.rpe || ((t.match(/RPE\s*([0-9]{1,2}(?:[\/-][0-9]{1,2})?)/) || [])[1] || '');
  return {
    FORMATO: fo.k, MIN: fo.min || '', VENTANAS: vent.filter(function (v, i2) { return vent.indexOf(v) === i2; }).slice(0, 4).join(' · '), ESTRUCTURA: estructura.slice(0, 400),
    MOVIMIENTOS: movs.map(function (m) { return m.k; }).join(', '), PATRONES: movs.map(function (m) { return m.patron; }).filter(function (p, i2, a) { return p && a.indexOf(p) === i2; }).join(', '),
    PESOS: pesos.join(' · ').slice(0, 300), INTERFERENCIAS: inter.slice(0, 8).join('\n'),
    'OBJETIVO / ESTÍMULO': [meta.modalidad ? 'Modalidad: ' + meta.modalidad : '', obj ? 'Objetivo: ' + recortar(obj) : ''].filter(Boolean).join('\n').slice(0, 1200),
    LIMITANTES: recortar(String(lim || '')).replace(/\n+/g, ' · ').slice(0, 600), RPE: rpe
  };
}

// ---------- 3 · Alimentar la base de datos ----------
function filasEnHoja_(nombre, filas) {
  if (!filas.length) return 0;
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  var m = filas.map(function (o) { return cab.map(function (c) { var v = o[c]; return v == null ? '' : celdaSegura_(v); }); });
  sh.getRange(sh.getLastRow() + 1, 1, m.length, cab.length).setValues(m);
  return m.length;
}
/** Metcons de Fabrik (últimas n semanas, hasta la siguiente) y WODs guardados en APP · WODS. Solo lee Fabrik. */
function alimentarMotor_(nSemanas) {
  var ya = {}, nuevas = [];
  listar_(HOJAS.MOTOR).forEach(function (r) { if (r.HASH) ya[r.HASH] = 1; });
  var est = null, tope = sumarDias(lunesDe_(hoyIso_()), 7);
  try { est = estructura_(fabrik_()); } catch (e) { Logger.log('Motor · Fabrik no legible: ' + e); }
  (est ? est.semanas : []).filter(function (s) { return s.iso && s.iso <= tope; }).slice(-(nSemanas || 2)).forEach(function (s) {
    var F; try { F = semanaBase_(s, est); } catch (e) { Logger.log('Motor · semana ' + s.nombre + ': ' + e); return; }
    (F.dias || []).forEach(function (d) {
      (d.bloques || []).forEach(function (b) {
        if (!b.n || !esMetconB_(b)) return;
        var txt = textoBloque_(b), h = hashTxt_(txt);
        if (ya[h]) return; ya[h] = 1;
        var w = b.wod || {};
        var a = analizarWod_(txt, { objetivo: w.objetivo, modalidad: [w.modalidad, w.formato].filter(Boolean).join(' · '), rpe: b.rpe || d.rpe, limitantes: w.limitantes, carga: w.carga });
        nuevas.push(Object.assign(a, { ID: 'MW-' + h.slice(0, 8), FUENTE: 'Fabrik', FECHA: d.iso ? isoAFecha(d.iso) : '', NOMBRE: (s.nombre + ' · ' + d.nombre + ' · ' + (b.titulo || 'METCON')).slice(0, 160),
          TEXTO: String(txt).slice(0, 4000), HASH: h, 'ANALIZADO POR': 'Motor', ACTUALIZADO: ahora_() }, metaBd_('Fabrik (programación de Gabi)', 'personal')));
      });
    });
  });
  listar_(HOJAS.WODS).forEach(function (r) {
    if (!r.CONTENIDO) return;
    var h = hashTxt_(r.CONTENIDO); if (ya[h]) return; ya[h] = 1;
    nuevas.push(Object.assign(analizarWod_(r.CONTENIDO, {}), { ID: 'MW-' + h.slice(0, 8), FUENTE: 'Guardado', FECHA: r['FECHA ORIGEN'] || '', NOMBRE: String(r.NOMBRE || 'WOD').slice(0, 160),
      TEXTO: String(r.CONTENIDO).slice(0, 4000), HASH: h, 'ANALIZADO POR': 'Motor', ACTUALIZADO: ahora_() }, metaBd_('Guardado en la app', 'personal')));
  });
  var yaFecha = {}; listar_(HOJAS.MOTOR).concat(nuevas).forEach(function (r) { if (r.FECHA) yaFecha[r.FECHA + '|' + r.MOVIMIENTOS] = 1; });
  try { leerVuelcoGabi_(ya, yaFecha).forEach(function (o) { nuevas.push(o); }); } catch (e) { Logger.log('Motor · lo volcado por la app de Gabi: ' + e); }
  return filasEnHoja_(HOJAS.MOTOR, nuevas);
}
/** Filas que pegas a mano (o que añade Claude) solo con NOMBRE y TEXTO: se analizan solas. */
function reanalizarMotor_() {
  var n = 0;
  listar_(HOJAS.MOTOR).forEach(function (r) {
    if (!r.TEXTO || r.FORMATO || r.MOVIMIENTOS) return;
    var a = analizarWod_(r.TEXTO, {});
    a.HASH = hashTxt_(r.TEXTO); if (!r.ID) a.ID = 'MW-' + a.HASH.slice(0, 8); if (!r.FUENTE) a.FUENTE = 'Manual';
    a['ANALIZADO POR'] = autores_(r['ANALIZADO POR'], 'Motor'); a.ACTUALIZADO = ahora_();
    if (!r.PERMISO) Object.assign(a, metaBd_(r.PROCEDENCIA || 'Pegado a mano', 'personal'));
    actualizarFila_(HOJAS.MOTOR, r._fila, a); n++;
  });
  return n;
}
function autores_(prev, quien) { var l = String(prev || '').split(/\s*·\s*/).filter(Boolean); if (l.indexOf(quien) < 0) l.push(quien); return l.join(' · '); }

// WODs de competición de referencia (escritos por Claude con su explicación; comprueba pesos y reps con la fuente oficial).
var MOTOR_SEMILLAS_ = [
  ['Open 24.1', 'FOR TIME · cap 15′\n21 DB SNATCHES (brazo 1)\n21 LATERAL BURPEES OVER DB\n21 DB SNATCHES (brazo 2)\n21 LATERAL BURPEES OVER DB\n15-15-15-15\n9-9-9-9\nDB 22,5 / 15 kg',
    'Escalera descendente de dos movimientos de muy baja técnica y alto gasto: el limitante es respiratorio y de transición, no muscular. El DB snatch unilateral reparte la fatiga del agarre entre brazos y el burpee lateral mantiene la FC cerca del máximo, así que es un esfuerzo glucolítico-aeróbico de 10–15′ en Z5. Gana quien no para: pocas pausas, transiciones de menos de 2″ y un ritmo de burpee constante. Las adaptaciones son tolerancia a H⁺ y eficiencia del gesto repetido.'],
  ['Open 24.2', 'AMRAP 20′\n300 m ROW\n10 DEADLIFTS 84 / 56,5 kg\n50 DOUBLE UNDERS',
    'AMRAP largo: el remo y los DU sostienen el estímulo aeróbico (Z3–Z4) y el peso muerto moderado (≈45–55 % 1RM) introduce fatiga de cadena posterior y agarre que se acumula ronda tras ronda. Remo → peso muerto es un par de cadena posterior: si el remo se tira con espalda, el peso muerto se resiente. La clave es un ritmo de remo repetible (mismo split por ronda) y los DU sin fallos, porque cada fallo cuesta FC y segundos.'],
  ['Open 24.3', 'FOR TIME · cap 15′\n5 RONDAS: 10 THRUSTERS 43 / 29 kg + 10 CHEST TO BAR\nDESCANSO 1′\n5 RONDAS: 7 THRUSTERS 61 / 43 kg + 7 BAR MUSCLE UPS',
    'Dos parejas empuje-tirón (thruster + C2B y thruster pesado + BMU): complementarias, porque mientras trabajan las piernas y el hombro empujando, el dorsal se recupera, y al revés. El minuto de descanso divide el WOD en un sprint ligero y una segunda parte donde la barra pesada y el BMU con fatiga cardiorrespiratoria son el limitante técnico. Entrena gimnásticos de alta habilidad con pulsaciones altas, la interferencia típica de la fase de realización.'],
  ['Open 25.1', 'AMRAP 15′\n3 LATERAL BURPEES OVER DB\n3 DB HANG CLEAN TO OVERHEAD\n30 ft (≈9 m) DB OVERHEAD WALKING LUNGE\n+3 reps de burpee y C2OH cada ronda\nDB 22,5 / 15 kg',
    'Escalera ascendente: las primeras rondas son ritmo y las últimas, gestión de fatiga de hombro. Burpee → C2OH → lunge OH encadena tres exigencias de estabilidad por encima de la cabeza (deltoides, serrato, core) con la FC alta del burpee. Es un AMRAP medio en umbral (Z4–Z5) cuyo limitante local es el hombro: hay que bloquear bien en el lunge y no soltar la mancuerna salvo planificado.'],
  ['Open 25.2 (= 22.3)', 'FOR TIME · cap 12′\n21 PULL-UPS · 42 DOUBLE UNDERS · 21 THRUSTERS 43 / 29 kg\n18 CHEST TO BAR · 36 DOUBLE UNDERS · 18 THRUSTERS 52 / 34 kg\n15 BAR MUSCLE UPS · 30 DOUBLE UNDERS · 15 THRUSTERS 61 / 38,5 kg',
    'Escalera descendente de volumen y ascendente de dificultad: cada tramo sube la exigencia del tirón (pull-up → C2B → BMU) y el peso del thruster. Los DU entre los dos sostienen la FC y hacen de bisagra respiratoria: es el par DU + thruster que Fabrik marca como limitante respiratorio alto. Gana quien llega con agarre y hombro al BMU: tandas planificadas en los pull-ups y nada al fallo antes del tercer tramo.'],
  ['Open 25.3', 'FOR TIME · cap 20′\n5 WALL WALKS · 50 cal ROW\n5 WALL WALKS · 25 DEADLIFTS 102 / 70 kg\n5 WALL WALKS · 25 CLEANS 61 / 38,5 kg\n5 WALL WALKS · 25 SNATCHES 43 / 29 kg\n5 WALL WALKS · 50 cal ROW',
    'Chipper de barra con cargas que bajan y técnica que sube (peso muerto → clean → snatch), separado por wall walks: el hombro y el core trabajan en isometría entre tramos de cadena posterior. Remo y peso muerto seguidos solo están unidos por los wall walks: la lumbar acumula fatiga, así que el remo debe ir con piernas. Es mixto aeróbico-glucolítico (Z4) con limitante muscular de espalda y agarre; pacing de chipper: todos los apartados al 75–80 % y el remo final para vaciar.'],
  ['Fran (benchmark)', 'FOR TIME\n21-15-9\nTHRUSTERS 43 kg\nPULL-UPS',
    'Sprint glucolítico (2–5′, Z6–Z7) con el par empuje-tirón más clásico. El thruster consume pierna y hombro, y la dominada, agarre y dorsal: son complementarios, pero con FC máxima. La caída de rendimiento viene de la acidosis (H⁺) y del agarre. Se entrena con tandas grandes desde el principio y transiciones mínimas; mide la potencia glucolítica.'],
  ['HYROX (estaciones)', 'FOR TIME\n8 × (1 km RUN + ESTACIÓN)\nSKIERG 1000 m · SLED PUSH 50 m · SLED PULL 50 m · BURPEE BROAD JUMPS 80 m · ROW 1000 m · FARMERS CARRY 200 m · SANDBAG LUNGES 100 m · WALL BALLS 100',
    'Esfuerzo aeróbico largo (60–90′, Z3–Z4) donde la interferencia buscada es correr comprometido: cada estación fatiga un patrón (empuje de pierna, agarre, cuádriceps excéntrico) y el kilómetro siguiente exige economía de carrera con ese músculo cansado. Sled → run y lunge → run son los pares más duros. Mejora con umbral alto, fuerza-resistencia de pierna y ritmo de carrera estable.']
];
function sembrarMotorWods_() {
  var ya = {}; listar_(HOJAS.MOTOR).forEach(function (r) { if (r.HASH) ya[r.HASH] = 1; });
  var nuevas = MOTOR_SEMILLAS_.filter(function (s) { return !ya[hashTxt_(s[1])]; }).map(function (s) {
    var h = hashTxt_(s[1]);
    return Object.assign(analizarWod_(s[1], {}), { ID: 'MW-' + h.slice(0, 8), FUENTE: 'Competición', NOMBRE: s[0], TEXTO: s[1], CIENCIA: s[2], HASH: h, 'ANALIZADO POR': 'Motor · Claude', ACTUALIZADO: ahora_() }, metaBd_('Competición pública / benchmark', 'compartible'));
  });
  return filasEnHoja_(HOJAS.MOTOR, nuevas);
}

// ---------- v0.21.2 · Gemini: una sola llamada para todo, con cambio automático de modelo ----------
/*
 * Modelos GRATUITOS (nivel free de la API de Gemini) en orden de preferencia. Si el de CONFIG › gemini_modelo deja de existir
 * (HTTP 404 o «no disponible»), se prueba el siguiente y el que funcione queda guardado en CONFIG. Nunca se elige uno de pago.
 */
var GEMINI_GRATIS_ = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
var GEMINI_DEF_ = GEMINI_GRATIS_[0];
function geminiModelo_() { var m = String(leerConfig_().gemini_modelo || '').trim(); return !m || /^gemini-2\./.test(m) ? GEMINI_DEF_ : m; }
/** Devuelve { ok, texto, modelo, code, error }. maxTok = tokens de salida. */
function geminiLlamar_(prompt, maxTok, temp) {
  var key = PROPS.getProperty('GEMINI_KEY');
  if (!key) return { ok: false, error: 'sin clave (Propiedades del script › GEMINI_KEY)' };
  var actual = geminiModelo_(), lista = [actual].concat(GEMINI_GRATIS_.filter(function (m) { return m !== actual; })), ult = null;
  for (var i = 0; i < lista.length; i++) {
    var modelo = lista[i], gen = { temperature: temp == null ? 0.4 : temp, maxOutputTokens: (maxTok || 1500) * (/^gemini-2\.5/.test(modelo) ? 1 : 3) };
    if (/^gemini-2\.5-flash/.test(modelo)) gen.thinkingConfig = { thinkingBudget: 0 };
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
      payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen }) });
    var code = res.getResponseCode(), body = res.getContentText();
    if (code === 200) {
      var j = JSON.parse(body), txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter(function (p) { return !p.thought; }).map(function (p) { return p.text || ''; }).join('').trim();
      if (modelo !== String(leerConfig_().gemini_modelo || '').trim()) ponerConfig_('gemini_modelo', modelo, 'Modelo de Gemini (nivel gratuito). Si deja de existir, el servidor pasa solo al siguiente gratuito: ' + GEMINI_GRATIS_.join(' → '));
      return { ok: true, texto: txt, modelo: modelo, code: 200 };
    }
    ult = { ok: false, code: code, modelo: modelo, error: 'HTTP ' + code + ' · ' + body.slice(0, 300) };
    // solo se cambia de modelo si este ya no existe / no está disponible; con 429 (cuota) o 5xx se para y se reintenta otro día
    if (!(code === 404 || (code === 400 && /not (found|supported|available)|no longer|deprecat|unsupported model/i.test(body)) || (code === 403 && /not available|access/i.test(body)))) break;
  }
  ponerConfig_('gemini_ultimo_error', hoyTxt_() + ' · ' + ult.modelo + ' · ' + ult.error, 'Último error de Gemini (lo lee Claude)');
  return ult;
}

// ---------- 4 · Gemini: explicación científica de los WODs sin CIENCIA ----------
function geminiExplicar_(max) {
  if (!PROPS.getProperty('GEMINI_KEY')) return 'sin clave (Propiedades del script › GEMINI_KEY)';
  var n = 0;
  var claves = guiaTexto_().split(/^## Claves/m).slice(1).join('## Claves').slice(0, 6000);
  var filas = listar_(HOJAS.MOTOR).filter(function (r) { return r.TEXTO && !String(r.CIENCIA || '').trim(); }).slice(0, max || 6);
  for (var i = 0; i < filas.length; i++) {
    var r = filas[i];
    var prompt = 'Eres fisiólogo del ejercicio y entrenador de CrossFit y HYROX de élite. Analiza este WOD para la base de datos de un atleta RX (90 kg). ' +
      'Responde en español, en 5–7 frases, sin títulos, listas ni markdown. Incluye: sistema energético y zona dominantes; por qué el orden y los pares de movimientos ' +
      'generan esa interferencia (fatiga local frente a sistémica, H⁺, fosfocreatina, CO₂ y control motor); qué adaptaciones provoca; la estrategia de ritmo; y el limitante principal. ' +
      'No inventes datos que no estén en el WOD.\n\nCLAVES DEL ATLETA Y DEL PROGRAMA:\n' + claves + '\n\nWOD (' + (r.FUENTE || '') + ' · ' + (r.NOMBRE || '') + '):\n' + r.TEXTO +
      '\n\nANÁLISIS DEL MOTOR: formato ' + (r.FORMATO || '¿?') + (r.MIN ? ' · ' + r.MIN + '′' : '') + ' · movimientos ' + (r.MOVIMIENTOS || '') + ' · interferencias ' + String(r.INTERFERENCIAS || '').replace(/\n/g, '; ') +
      (r['OBJETIVO / ESTÍMULO'] ? ' · ' + r['OBJETIVO / ESTÍMULO'].replace(/\n/g, '; ') : '') + (r.LIMITANTES ? ' · ' + r.LIMITANTES : '');
    var g = geminiLlamar_(prompt, 1200, 0.4);
    if (!g.ok) break;
    var txt = g.texto;
    if (txt) { actualizarFila_(HOJAS.MOTOR, r._fila, { CIENCIA: txt.slice(0, 3000), 'ANALIZADO POR': autores_(r['ANALIZADO POR'], 'Gemini'), ACTUALIZADO: ahora_() }); n++; }
  }
  return n;
}
/** Cada madrugada: metcons nuevos de Fabrik, filas pegadas a mano y explicación de Gemini. */
function motorDiario() { return conSalud_('motorDiario', motorDiario_sin_); }
function motorDiario_sin_() {
  var est = [];
  try { v29aDiario_(); } catch (e) { est.push('v29a FALLO ' + e); }
  try { est.push('nuevos ' + alimentarMotor_(2)); } catch (e) { est.push('alimentar FALLO ' + e); }
  try { est.push('reanalizados ' + reanalizarMotor_()); } catch (e) { est.push('reanalizar FALLO ' + e); }
  try { est.push('Gemini ' + geminiExplicar_(8)); } catch (e) { est.push('Gemini FALLO ' + String(e).slice(0, 120)); }
  try { est.push('JSON ' + exportarBdJson_().wods + ' WODs'); } catch (e) { est.push('JSON FALLO ' + String(e).slice(0, 120)); }
  try { avisarCompetis_(); } catch (e) { est.push('competis FALLO ' + String(e).slice(0, 80)); }
  try { est.push('pendientes caducados ' + caducarPendientes_()); } catch (e) { est.push('pendientes FALLO ' + String(e).slice(0, 80)); }
  try { est.push('operación ' + opDiario_()); } catch (e) { est.push('operación FALLO ' + String(e).slice(0, 80)); }
  try { est.push('lesiones IA ' + lesionesIA_(3)); } catch (e) { est.push('lesiones FALLO ' + String(e).slice(0, 80)); }
  try { var kk = indexarKnowledge_(false); est.push('KNOWLEDGE ' + kk.archivos + ' .md' + (kk.igual ? ' (sin cambios)' : ' · ' + kk.secciones + ' secciones')); } catch (e) { est.push('KNOWLEDGE FALLO ' + String(e).slice(0, 120)); }
  try { var ac = aprenderCiclo_(2); est.push('ciclo ' + ac.dias + ' días'); } catch (e) { est.push('ciclo FALLO ' + String(e).slice(0, 120)); }
  try { var lu = lunesDe_(hoyIso_()); est.push('lectura ' + lecturaSemana_(lu)); var ls = lecturaSemana_(sumarDias(lu, 7)); if (ls !== 'sin semana') est.push('lectura sig. ' + ls); } catch (e) { est.push('lectura FALLO ' + String(e).slice(0, 120)); }
  ponerConfig_('ultimo_motor', hoyTxt_() + ' · ' + est.join(' · '), 'Resultado de la tarea diaria del motor (MOTOR · ANÁLISIS)');
}

// ---------- 5 · «Estímulos que quiero» y metcon a medida ----------
function parseDeseo_(txt, G) {
  var t = norm(txt), D = { texto: String(txt || ''), movs: [], ergs: [], patrones: [], intercalar: null, formato: '', min: 0, intensidad: '', equipo: '' };
  detectarMovs_(t, G).forEach(function (x) { (x.m.patron === 'MONO' ? D.ergs : D.movs).push(x.m); });
  var mi = t.match(/INTERCAL[A-Z]*\s+(?:DE\s+|CON\s+|LA\s+|EL\s+)?([A-Z ]{3,40})/) || t.match(/ENTRE (?:RONDAS|SERIES|MOVIMIENTOS)\s*(?:DE\s+|CON\s+)?([A-Z ]{3,40})/);
  if (mi) {
    var e = detectarMovs_(mi[1], G).filter(function (x) { return x.m.patron === 'MONO'; })[0];
    D.intercalar = e ? e.m : /CORR|CARRER|RUN/.test(mi[1]) ? movPorClave_(G, 'RUN') : D.ergs[0] || null;
    if (D.intercalar && D.ergs.indexOf(D.intercalar) < 0) D.ergs.unshift(D.intercalar);
  }
  G.patrones.forEach(function (p) { if (p.palabras.some(function (w) { return aliasEn_(t, w) >= 0; }) && D.patrones.indexOf(p.patron) < 0) D.patrones.push(p.patron); });
  var F = [['VENTANAS', /HEAVY EN VENTANAS|VENTANAS/], ['EVERY', /EVERY|CADA [0-9]/], ['INTERVALOS', /INTERVALO|ON ?\/ ?OFF/], ['EMOM', /EMOM/], ['CHIPPER', /CHIPPER/], ['ESCALERA', /ESCALERA|[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}/],
    ['SPRINT', /SPRINT/], ['FOR_TIME', /FOR TIME|POR TIEMPO/], ['AMRAP', /AMRAP/]];
  for (var i = 0; i < F.length; i++) if (F[i][1].test(t)) { D.formato = F[i][0]; break; }
  var mm = t.match(/([0-9]{1,2})\s*(?:'|′|’|MIN)/) || t.match(/(?:AMRAP|EMOM|CAP|TIME CAP|DE)\s*([0-9]{1,2})(?![0-9])/); if (mm) D.min = +mm[1];
  D.intensidad = /PESAD|HEAVY/.test(t) ? 'pesado' : /POTENCIA|P1|P4|Z6|Z7|Z8/.test(t) ? 'potencia' : /SPRINT|CORTO|RAPIDO/.test(t) ? 'corto' : /LARGO|SOSTENID|AEROBIC|Z3/.test(t) ? 'largo' : '';
  D.equipo = /EQUIPO|TEAM/.test(t) ? 'equipo' : /PAREJA|PAIRS|SINCRO/.test(t) ? 'pareja' : '';
  if (D.formato === 'AMRAP' && D.min) D.formato = D.min <= 10 ? 'AMRAP_C' : D.min <= 20 ? 'AMRAP' : 'AMRAP_L';
  return D;
}
/** Marca más alta (kg) de APP · MARCAS cuyo movimiento contiene «nombre». */
function rmDe_(nombre) {
  var q = norm(nombre).trim(); if (!q) return 0;
  var memo = rmDe_.memo; if (!memo) { try { memo = listar_(HOJAS.MARCAS); } catch (e) { memo = []; } rmDe_.memo = memo; }
  return memo.reduce(function (mx, r) {
    var v = parseFloat(String(r.VALOR || '').replace(',', '.'));
    if (!v || norm(r.MOVIMIENTO).indexOf(q) < 0 || /LB/.test(norm(r.UNIDAD)) || /TIEMPO|REPS|SEG|MIN|CAL/.test(norm(r.UNIDAD) + ' ' + norm(r.TIPO))) return mx;
    return Math.max(mx, v);
  }, 0);
}
function redondea25_(x) { return Math.round(x / 2.5) * 2.5; }
function cargaTxt_(m, pc, dbMat) {
  if (!m.kg && !m.rm) return '';
  var p = m.rm.match(/^(.*?)\s+([0-9]+(?:[.,][0-9]+)?)$/), base = p ? rmDe_(p[1]) : 0, fac = p ? parseFloat(p[2].replace(',', '.')) : 1;
  if (base && (m.mat === 'barra' || !dbMat)) {
    var a = redondea25_(base * fac * pc.min / 100), b = redondea25_(base * fac * pc.max / 100);
    var k = function (x) { return String(x).replace('.', ','); };
    return ' (' + (a === b ? k(a) : k(a) + '–' + k(b)) + ' kg · ' + pc.min + '–' + pc.max + ' % de tu ' + p[1].toLowerCase() + ')';
  }
  if (dbMat) return ' (DB ' + String(Math.min(m.kg || 22.5, 22.5)).replace('.', ',') + ' kg)';
  return m.kg ? ' (RX ' + String(m.kg).replace('.', ',') + ' kg' + (m.rm && pc ? ' · o el ' + pc.min + '–' + pc.max + ' % de tu 1RM' : '') + ')' : '';
}
function repsTxt_(m, f) {
  var v = m.reps * f;
  if (m.unidad === 'cal') return Math.max(5, Math.round(v)) + ' cal ' + m.n;
  if (m.unidad === 'm') { var mt = v >= 100 ? Math.max(100, Math.round(v / 100) * 100) : Math.max(5, Math.round(v / 5) * 5); return mt + ' m ' + m.n; }
  return Math.max(1, Math.round(v)) + ' ' + m.n;
}
/** El WOD de MOTOR · ANÁLISIS que más se parece a lo pedido (≥3 puntos). */
function refMotor_(lista, D, fk) {
  var filas; try { filas = listar_(HOJAS.MOTOR); } catch (e) { return null; }
  var ks = lista.map(function (m) { return m.k; }), ps = lista.map(function (m) { return m.patron; });
  var tok = norm(D.texto).split(/[^A-Z0-9]+/).filter(function (x) { return x.length >= 4; });
  var mejor = null, pm = 0;
  filas.forEach(function (r) {
    var rm = String(r.MOVIMIENTOS || '').split(/\s*,\s*/).filter(Boolean), rp = String(r.PATRONES || '').split(/\s*,\s*/);
    var p = rm.filter(function (k) { return ks.indexOf(k) >= 0; }).length * 2 + rp.filter(function (x) { return x && ps.indexOf(x) >= 0; }).length * 0.5;
    if (fk && r.FORMATO === fk) p += 2;
    var bolsa = norm((r['OBJETIVO / ESTÍMULO'] || '') + ' ' + (r['CONCEPTOS (Ollama)'] || '') + ' ' + (r.LIMITANTES || ''));
    p += Math.min(2, tok.filter(function (x) { return bolsa.indexOf(x) >= 0; }).length * 0.5);
    if (r.CIENCIA) p += 0.3;
    if (p > pm) { pm = p; mejor = r; }
  });
  return mejor && pm >= 3 ? { nombre: mejor.NOMBRE, fuente: mejor.FUENTE, formato: mejor.FORMATO, estructura: mejor.ESTRUCTURA || '', ciencia: mejor.CIENCIA || '', puntos: pm } : null;
}
/** Ordena los movimientos para provocar las interferencias buscadas y no juntar las que se evitan. */
function ordenarInterf_(items, G, primero, quiereAgarre) {
  var resto = items.slice(), seq = [], pares = [];
  var tipo = function (x, y) {
    var rs = G.interf.filter(function (r) { return encaja_(r.a, x) && encaja_(r.b, y) || (r.orden !== 'A>B' && encaja_(r.a, y) && encaja_(r.b, x)); });
    var b = rs.filter(function (r) { return r.tipo === 'buscada'; })[0] || rs.filter(function (r) { return r.tipo === 'complementaria'; })[0] || rs.filter(function (r) { return r.tipo === 'evitar'; })[0];
    return b || null;
  };
  var puntos = function (x, y) { var r = tipo(x, y); if (!r) return 0; return r.tipo === 'buscada' ? 3 : r.tipo === 'complementaria' ? 1 : (quiereAgarre && /agarre/i.test(r.efecto) ? 2 : -4); };
  var ini = null;
  if (primero) resto.forEach(function (y) { if (!ini || puntos(primero, y) > puntos(primero, ini)) ini = y; });
  if (!ini) ini = resto.filter(function (x) { return resto.some(function (y) { return y !== x && puntos(x, y) >= 3; }); })[0] || resto[0];
  while (resto.length) {
    var x = seq.length ? seq[seq.length - 1] : null, sig = ini;
    if (x) { sig = null; resto.forEach(function (y) { if (!sig || puntos(x, y) > puntos(x, sig)) sig = y; }); }
    if (x) { var r = tipo(x, sig); if (r) pares.push({ a: x, b: sig, r: r }); }
    seq.push(sig); resto.splice(resto.indexOf(sig), 1);
  }
  if (primero && seq.length) { var r0 = tipo(primero, seq[0]); if (r0) pares.unshift({ a: primero, b: seq[0], r: r0 }); }
  return { seq: seq, pares: pares };
}
/**
 * Metcon a medida desde «Estímulos que quiero» (ej. «stoh, snatch, oh» o «intercalar carrera, calorías de assault»).
 * o = { min, material: [...] (vacío = box), lunes, formato } → { bloque, formato, referencia, avisos }
 */
function metconGuiado_(deseo, o) {
  o = o || {};
  var G = guiaMotor_(), D = parseDeseo_(deseo || '', G), avisos = [], R = G.reglas;
  var mat = mapaMaterial_(o.material && o.material.length ? o.material : ['box'], true);
  var tiene = function (m) { return !m.mat || mat[m.mat] || (m.alt && mat[m.alt]); };
  var w = {}; try { w = pesoCarencias_(o.lunes || lunesDe_(hoyIso_())); } catch (e) {}
  var movs = D.movs.filter(tiene), sinMat = D.movs.filter(function (m) { return !tiene(m); });
  if (sinMat.length) avisos.push('Sin material para ' + sinMat.map(function (m) { return m.n.toLowerCase(); }).join(', ') + ': no entra.');
  D.patrones.forEach(function (p) {
    if (movs.some(function (m) { return m.patron === p; }) || p === 'MONO') return;
    var c = G.movs.filter(function (m) { return m.patron === p && tiene(m) && movs.indexOf(m) < 0; }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); })[0];
    if (c) movs.push(c);
  });
  var ergs = D.ergs.filter(tiene);
  if (D.patrones.indexOf('MONO') >= 0 && !ergs.length) { var e0 = G.movs.filter(function (m) { return m.patron === 'MONO' && tiene(m); })[0]; if (e0) ergs.push(e0); }
  if (!movs.length) {
    movs = G.movs.filter(function (m) { return m.patron !== 'MONO' && m.c && tiene(m); }).sort(function (a, b) { return (w[b.c] || 0) - (w[a.c] || 0); }).slice(0, ergs.length ? 2 : 3);
    avisos.push((ergs.length ? 'Solo has pedido erg/carrera: ' : 'No he reconocido estímulos en «' + (deseo || '') + '»: ') + 'añado lo que más te falta (' + movs.map(function (m) { return m.n.toLowerCase(); }).join(', ') + ').');
  }
  if (movs.length + ergs.length <= 2) avisos.push('Solo ' + (movs.length + ergs.length) + ' movimientos: añade un erg o «intercalar carrera» si quieres más interferencia.');
  var maxM = +R.max_movs || 4; if (movs.length + ergs.length > maxM + 1) { avisos.push('Demasiados movimientos para un metcon: me quedo con ' + maxM + ' + erg.'); movs = movs.slice(0, maxM); }
  var Tpedido = D.min || +o.min || +R.min_metcon || 12;
  var fk = D.formato || o.formato || '';
  var ref = refMotor_(movs.concat(ergs), D, fk);
  if (!fk && ref && G.formatos[ref.formato]) fk = ref.formato;
  if (!fk) fk = D.intensidad === 'pesado' ? 'VENTANAS' : D.intensidad === 'potencia' ? 'EVERY' : D.intensidad === 'corto' || Tpedido <= 8 ? 'SPRINT' : Tpedido <= 10 ? 'AMRAP_C' : Tpedido <= 20 ? (movs.length >= 5 ? 'CHIPPER' : 'AMRAP') : 'AMRAP_L';
  var F = G.formatos[fk] || G.formatos.AMRAP || { k: 'AMRAP', nombre: 'AMRAP', min: 10, max: 20, repsx: 1, estrategia: '', sistema: '', zona: '', rpe: '8' };
  var T = Math.max(F.min, Math.min(F.max, Math.min(+R.max_metcon || 40, Tpedido)));
  if (T !== Tpedido) avisos.push('El formato ' + F.nombre + ' va de ' + F.min + ' a ' + F.max + '′: lo dejo en ' + T + '′.');
  var pc = G.pesos[fk] || { min: 50, max: 65 };
  var quiereAgarre = D.patrones.indexOf('TIRON') >= 0 && /AGARRE|GRIP/.test(norm(deseo));
  var otrosErg = ergs.filter(function (e) { return e !== D.intercalar; });
  var ord = ordenarInterf_(otrosErg.concat(movs), G, D.intercalar, quiereAgarre), seq = ord.seq;
  var fEq = D.equipo ? (+R.reps_equipo || 0.75) * (D.equipo === 'pareja' ? 2 : 3) : 1, fx = (+F.repsx || 1) * fEq;
  var dbMat = !mat.barra && mat.db;
  var L = function (m, f) { return repsTxt_(m, fx * (f || 1)) + (m.patron === 'MONO' ? '' : cargaTxt_(m, pc, dbMat && m.mat === 'barra')); };
  var inter = D.intercalar ? repsTxt_(D.intercalar, fEq * (D.intercalar.unidad === 'm' ? 0.5 : 0.8)) : '';
  var lineas = [], cab = '';
  var esq = (String(ref && ref.estructura || '').match(/[0-9]{1,3}(?:-[0-9]{1,3}){2,}/) || [])[0] || '21-15-9';
  switch (F.k) {
    case 'EMOM':
      var est = seq.length ? seq : ergs; var vueltas = Math.max(1, Math.floor(T / est.length));
      cab = 'EMOM ' + (vueltas * est.length) + '′ (' + vueltas + ' vueltas)';
      est.forEach(function (m, i) { lineas.push('MIN ' + (i + 1) + ': ' + L(m, 0.5)); });
      if (inter) lineas.push('+ ' + inter + ' al empezar cada minuto impar');
      break;
    case 'EVERY':
      var S = Math.max(3, Math.floor(T / 4)); cab = 'EVERY 4′ × ' + S + ' (60–90″ ON al 90 %, el resto descanso)';
      if (inter) lineas.push(inter);
      seq.slice(0, 3).forEach(function (m) { lineas.push(L(m, 0.7)); });
      break;
    case 'INTERVALOS':
      var Si = Math.max(4, Math.floor(T / 3)); cab = Si + ' × (2′ ON / 1′ OFF)';
      if (inter) lineas.push(inter);
      seq.forEach(function (m) { lineas.push(L(m, 0.5)); });
      lineas.push('Mismas reps en cada serie: la última igual que la primera');
      break;
    case 'VENTANAS':
      var heavy = movs.filter(function (m) { return /OLY|SENT|BISAGRA|OH/.test(m.patron) && (m.mat === 'barra'); })[0] || movs[0];
      var Sv = Math.max(4, Math.floor(T / 2.5)); cab = 'EVERY 2′30″ × ' + Sv + ' · heavy en ventanas';
      var erg = D.intercalar || otrosErg[0]; if (erg) lineas.push(repsTxt_(erg, 0.8));
      if (heavy) lineas.push('2 ' + heavy.n + cargaTxt_(heavy, pc, false) + ' · ventanas impares a la carga baja y pares a la alta');
      seq.filter(function (m) { return m !== heavy && m !== erg; }).slice(0, 1).forEach(function (m) { lineas.push(L(m, 0.4)); });
      break;
    case 'ESCALERA':
      cab = esq + ' · FOR TIME · cap ' + T + '′';
      seq.forEach(function (m) { lineas.push(m.patron === 'MONO' ? repsTxt_(m, 0.8) : m.n + cargaTxt_(m, pc, dbMat && m.mat === 'barra')); });
      if (inter) lineas.push('Tras cada tanda: ' + inter);
      break;
    case 'CHIPPER':
      cab = 'FOR TIME · cap ' + T + '′ · chipper';
      seq.forEach(function (m, i) { lineas.push(L(m, 1.5)); if (inter && i < seq.length - 1) lineas.push('  ' + inter); });
      break;
    case 'SPRINT': case 'FOR_TIME':
      var rondas = F.k === 'SPRINT' ? 2 : Math.max(3, Math.min(6, Math.round(T / 4)));
      cab = rondas + ' RONDAS FOR TIME · cap ' + T + '′';
      if (inter) lineas.push(inter);
      seq.forEach(function (m) { lineas.push(L(m, F.k === 'SPRINT' ? 1 : 0.8)); });
      break;
    default:
      cab = 'AMRAP ' + T + '′' + (D.equipo ? ' · ' + (D.equipo === 'pareja' ? 'en pareja (reparte como queráis)' : 'en equipo') : '');
      if (inter) lineas.push(inter);
      seq.forEach(function (m) { lineas.push(L(m, 1)); });
  }
  var buscadas = ord.pares.filter(function (p) { return p.r.tipo === 'buscada'; }), evitadas = ord.pares.filter(function (p) { return p.r.tipo === 'evitar'; });
  var interTxt = ord.pares.map(function (p) { return p.a.n + ' → ' + p.b.n + ' · ' + p.r.tipo + ': ' + p.r.efecto; });
  var contenido = cab + '\n' + lineas.join('\n') +
    (F.estrategia ? '\n\nESTRATEGIA: ' + F.estrategia : '') +
    (buscadas.length ? '\nINTERFERENCIA QUE BUSCAMOS: ' + buscadas.map(function (p) { return p.a.n.toLowerCase() + ' → ' + p.b.n.toLowerCase(); }).join(' · ') : '') +
    (evitadas.length ? '\nOJO: ' + evitadas.map(function (p) { return p.a.n.toLowerCase() + ' + ' + p.b.n.toLowerCase(); }).join(', ') + ' van seguidos (doble ' + (evitadas[0].r.efecto || 'carga').toLowerCase() + '): rompe antes del fallo' : '');
  var cods = movs.map(function (m) { return m.c; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
  var ciencia = [F.sistema ? F.nombre + ': sistema ' + F.sistema + (F.zona ? ' (' + F.zona + ')' : '') + '.' : '']
    .concat(ord.pares.filter(function (p) { return p.r.ciencia; }).slice(0, 3).map(function (p) { return p.a.n + ' → ' + p.b.n + ': ' + p.r.ciencia; }))
    .concat(ref && ref.ciencia ? ['Del WOD de referencia «' + ref.nombre + '»: ' + String(ref.ciencia).slice(0, 400)] : []).filter(Boolean).join('\n');
  var porque = 'Pediste: «' + String(deseo || '').trim() + '». ' + (ref ? 'Estructura inspirada en «' + ref.nombre + '» (' + ref.fuente + ', MOTOR · ANÁLISIS («Road to Elite · Motor»)). ' : '') +
    (F.cuando ? F.nombre + ': ' + F.cuando.charAt(0).toLowerCase() + F.cuando.slice(1) + '. ' : '') +
    (movs.some(function (m) { return D.movs.indexOf(m) < 0; }) ? 'Añadido por tus carencias: ' + movs.filter(function (m) { return D.movs.indexOf(m) < 0; }).map(function (m) { return m.n.toLowerCase(); }).join(', ') + '.' : '');
  return {
    bloque: { ORIGEN: 'EXTRA', 'TÍTULO': ('METCON A MEDIDA · ' + F.nombre + ' ' + T + '′ · ' + seq.concat(D.intercalar ? [D.intercalar] : []).map(function (m) { return m.n.split(' (')[0]; }).slice(0, 4).join(' + ')).slice(0, 120),
      CONTENIDO: contenido, MIN: T + 10, INTENSIDAD: 'RPE ' + (F.rpe || '8') + (F.zona ? ' · ' + F.zona : ''), 'CÓDIGOS': cods.join('|'),
      'POR QUÉ (cursiva)': porque.trim(), 'CIENCIA (técnica · fisiología · biología)': ciencia, INTERFERENCIAS: interTxt.join('\n') },
    formato: F.k, referencia: ref ? ref.nombre : '', avisos: avisos, entendido: { movimientos: D.movs.map(function (m) { return m.n; }), ergs: D.ergs.map(function (m) { return m.n; }), intercalar: D.intercalar ? D.intercalar.n : '', patrones: D.patrones, formato: D.formato, min: D.min }
  };
}
/** Extras: el metcon a medida entra en el mejor hueco de la semana, en borrador (rehacer los extras lo regenera). */
function extraADeseo_(lunes, deseo) {
  var r = metconGuiado_(deseo, { lunes: lunes, min: 15 }), b = r.bloque;
  var pos = posicionOptima_({ lunes: lunes, campos: b }), h = (pos.mejores || [])[0];
  if (!h) return { ok: false, avisos: r.avisos.concat(['No hay hueco esta semana para el metcon a medida']) };
  var o = Object.assign({}, b, { ID: nuevoId_(), FECHA: isoAFecha(h.iso), 'DÍA': diaDe_(h.iso), TURNO: h.turno, ORDEN: h.turno === 'AM' ? 6 : 85, BLOQUE: b['TÍTULO'], ESTADO: 'BORRADOR',
    GENERADO: 'auto · a medida · ' + String(deseo).slice(0, 60), ACTUALIZADO: ahora_() });
  o['POR QUÉ (cursiva)'] += ' Va el ' + diaDe_(h.iso).toLowerCase() + ' ' + h.turno + ': ' + (h.motivos || []).slice(0, 2).join('; ') + '.';
  anadirFila_(HOJAS.PLAN, o);
  return { ok: true, id: o.ID, dia: diaDe_(h.iso), turno: h.turno, titulo: b['TÍTULO'], avisos: r.avisos };
}
/** Movimientos del mega WOD desde la guía (si falla, los de siempre). */
function movsMega_() {
  try {
    var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    return guiaMotor_().movs.filter(function (m) { return m.patron !== 'MONO'; }).map(function (m) {
      return { re: new RegExp('(^|[^A-Z])(' + m.alias.map(esc).join('|') + ')(ES|S)?([^A-Z]|$)'), n: m.n, mat: m.mat, alt: m.alt, reps: m.unidad === 'm' ? Math.round(m.reps) : m.reps,
        carga: m.mat === 'barra' ? 'barra' : m.mat === 'db' ? 'db' : /sandbag/.test(m.mat) ? 'sandbag' : '', c: m.c, equipo: /gusano|lodge/.test(m.mat), k: m.k, patron: m.patron };
    });
  } catch (e) { Logger.log('movsMega_: ' + e); return MOV_MEGA_; }
}
function ergMegaDe_(m) {
  return { ROW: ['ergos', 'cal ROW'], SKI: ['ergos', 'cal SKI'], ASSAULT: ['ergos', 'cal ASSAULT BIKE'], BIKE: ['ergos', 'cal BIKE ERG'], RUN: ['_correr', 'm RUN'] }[m.k] || null;
}

// ---------- 6 · Backup de los jueves y avisos ----------
var BACKUP_HORA_ = 10, BACKUP_MARGEN_H_ = 6;
function carpetaJueves_() {
  var raiz = DriveApp.getFolderById(CONFIG.BACKUPS_ID), it = raiz.getFoldersByName('APP Road to Elite · jueves');
  return it.hasNext() ? it.next() : raiz.createFolder('APP Road to Elite · jueves');
}
function estructuraMd_(fecha) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID), cf = leerConfig_(), L = [];
  L.push('# Road To Elite · estructura y funcionamiento · ' + fecha, '', 'Servidor ' + CONFIG.VERSION + ' · generado automáticamente por el backup de los jueves.', '');
  L.push('## Cómo funciona', '',
    '- **Web** (GitHub Pages, repo `pComader/road-to-elite`): PWA que habla con el servidor de Apps Script (`doPost` → `accion_`). Solo entra ' + CONFIG.EMAIL_PERMITIDO + ' (token de Firebase verificado).',
    '- **Servidor** (Apps Script): lee FABRIK PROGRAM (solo lectura), escribe en este Sheet (Training Coverage) y en Google Calendar (solo lo aprobado).',
    '- **Semana:** domingo 22:15 cierre + ajuste de carrera + vídeos + copia del Sheet → 23:15 carga Fabrik → confirmar semana → «Cargar extras» (metas, carrera, refuerzos, pendientes, metcon a medida) → aprobar (correo de estímulos).',
    '- **Motor:** las tablas de MOTOR_GUIA.md (movimientos, formatos, pesos, interferencias) + MOTOR · ANÁLISIS («Road to Elite · Motor») (metcons de Fabrik y competición analizados; ciencia de Claude/Gemini; conceptos de Ollama).',
    '- **Reestructurar:** viaje (intensidad al alza), reorganización (clásica o mega WOD) y competi (online/física).',
    '- **Backups:** domingo copia del Sheet (Drive) · jueves ' + BACKUP_HORA_ + ':00 backup completo (xlsx + este .md + guía + código) en Drive › Backups › «APP Road to Elite · jueves»; el agente del PC lo copia a E:\\2DO CEREBRO\\BackUPS\\APP Road to Elite. Si a las ' + (BACKUP_HORA_ + BACKUP_MARGEN_H_) + ':00 falta algo: correo, aviso en la app y ventana en el PC.', '');
  L.push('## Pestañas', '', '| Pestaña | Visible | Filas | Columnas |', '|---|---|---|---|');
  ss.getSheets().forEach(function (h) {
    var cab = h.getLastColumn() ? h.getRange(1, 1, 1, Math.min(h.getLastColumn(), 40)).getDisplayValues()[0].filter(String) : [];
    L.push('| ' + h.getName() + ' | ' + (h.isSheetHidden() ? 'no' : 'sí') + ' | ' + Math.max(0, h.getLastRow() - 1) + ' | ' + cab.join(', ').replace(/\|/g, '/').slice(0, 600) + ' |');
  });
  L.push('', '## APP · CONFIG', '', '| Clave | Valor |', '|---|---|');
  Object.keys(cf).sort().forEach(function (k) { if (k === 'ultimo_configurar') return; L.push('| ' + k + ' | ' + String(cf[k]).replace(/\n/g, ' ').replace(/\|/g, '/').slice(0, 200) + ' |'); });
  L.push('', '## Disparadores', '');
  ScriptApp.getProjectTriggers().forEach(function (t) { L.push('- ' + t.getHandlerFunction() + ' · ' + t.getEventType()); });
  L.push('', '## Propiedades del script (solo nombres; los valores nunca salen del servidor)', '', PROPS.getKeys().sort().map(function (k) { return '`' + k + '`'; }).join(' · '));
  L.push('', '## Identificadores', '', '- Sheet: `' + CONFIG.SHEET_ID + '`', '- Carpeta de backups: `' + CONFIG.BACKUPS_ID + '`', '- Motor (propio): `' + (cf.motor_bd_id || '—') + '`', '- Base_de_datos_WOD (app de Gabi, solo lectura): `' + (cf.bd_wods_id || CONFIG.BD_WOD_ID) + '`', '- MOTOR_GUIA.md: `' + (cf.motor_guia_id || '—') + '`', '- Web: ' + CONFIG.URL_APP);
  L.push('', '## Cómo restaurar', '',
    '1. Sheet: abre el .xlsx del zip en Google Drive («Abrir con Hojas de cálculo») o usa la copia del domingo; cambia `SHEET_ID` en CONFIG del código si es un archivo nuevo.',
    '2. Servidor: pega `apps-script/Code.gs` del zip del código en el editor de Apps Script, ejecuta `configurar` y crea una versión nueva de la implementación.',
    '3. Web: el zip del código es el repositorio completo; súbelo a GitHub Pages.',
    '4. Secretos (FCM_CUENTA, GEMINI_KEY, AGENTE_TOKEN): no están en el backup a propósito; vuelve a crearlos en Propiedades del script.');
  return L.join('\n');
}
function backupJueves() { return conSalud_('backupJueves', backupJueves_sin_); }
function backupJueves_sin_() {
  var f = carpetaJueves_(), fecha = hoyIso_(), blobs = [], notas = [];
  var xl = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (xl.getResponseCode() !== 200) throw new Error('exportar el Sheet: HTTP ' + xl.getResponseCode());
  blobs.push(xl.getBlob().setName('Road_to_Elite_Training_Coverage_' + fecha + '.xlsx'));
  var md = estructuraMd_(fecha);
  blobs.push(Utilities.newBlob(md, 'text/markdown', 'Road_to_Elite_ESTRUCTURA_' + fecha + '.md'));
  blobs.push(Utilities.newBlob(guiaTexto_(), 'text/markdown', 'MOTOR_GUIA.md'));
  try {
    var bx = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + motorLibro_().getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (bx.getResponseCode() === 200) blobs.push(bx.getBlob().setName('Road_to_Elite_Motor_WODs_' + fecha + '.xlsx')); else notas.push('BD HTTP ' + bx.getResponseCode());
    blobs.push(Utilities.newBlob(JSON.stringify(datosBdJson_(), null, 1), 'application/json', 'motor_wods_' + fecha + '.json'));
    var bv = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + videosLibro_().getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (bv.getResponseCode() === 200) blobs.push(bv.getBlob().setName('Base_de_datos_Videos_' + fecha + '.xlsx'));
  } catch (e) { notas.push('BD: ' + e); }
  try {
    var gh = UrlFetchApp.fetch('https://codeload.github.com/pComader/road-to-elite/zip/refs/heads/main', { muteHttpExceptions: true });
    if (gh.getResponseCode() === 200) blobs.push(gh.getBlob().setName('codigo_road-to-elite_main.zip')); else notas.push('código HTTP ' + gh.getResponseCode());
  } catch (e) { notas.push('código: ' + e); }
  var zip = f.createFile(Utilities.zip(blobs, 'Road_to_Elite_backup_' + fecha + '.zip'));
  var fmd = f.createFile(Utilities.newBlob(md, 'text/markdown', 'Road_to_Elite_ESTRUCTURA_' + fecha + '.md'));
  // se guardan los 10 últimos (los suyos; nada más de la carpeta)
  var viejos = [];
  [/^Road_to_Elite_backup_\d{4}-\d{2}-\d{2}\.zip$/, /^Road_to_Elite_ESTRUCTURA_\d{4}-\d{2}-\d{2}\.md$/].forEach(function (re) {
    var l = [], it = f.getFiles(); while (it.hasNext()) { var x = it.next(); if (re.test(x.getName())) l.push(x); }
    l.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; }).slice(10).forEach(function (x) { viejos.push(x); });
  });
  viejos.forEach(function (x) { x.setTrashed(true); });
  ponerConfig_('backup_jueves', fecha + ' · ' + zip.getId() + ' · ' + fmd.getId() + (notas.length ? ' · ' + notas.join(' · ') : ''), 'Último backup completo de los jueves en Drive (zip · md). El agente del PC lo copia a E:\\2DO CEREBRO\\BackUPS');
  try { revisarBackup_(); } catch (e) { Logger.log('revisarBackup_: ' + e); }
  return { fecha: fecha, zip: zip.getId(), md: fmd.getId(), kb: Math.round(zip.getSize() / 1024) };
}
/** El jueves que ya debería estar hecho (hoy si es jueves ≥16:00, o el anterior) y cómo están Drive y el PC. */
function estadoBackup_() {
  var cf = leerConfig_(), hoy = hoyIso_(), jue = sumarDias(lunesDe_(hoy), 3), hora = +Utilities.formatDate(new Date(), CONFIG.ZONA, 'H');
  var req = hoy > jue || (hoy === jue && hora >= BACKUP_HORA_ + BACKUP_MARGEN_H_) ? jue : sumarDias(jue, -7);
  var dr = String(cf.backup_jueves || '').slice(0, 10), pc = String(cf.backup_pc || '').slice(0, 10), desde = String(cf.backup_desde || '').slice(0, 10);
  var partes = String(cf.backup_jueves || '').split(' · ');
  return { requerido: req, drive: dr, pc: pc, driveOk: dr >= req, pcOk: pc >= req, exento: !!desde && req < desde,
    zipId: partes[1] || '', mdId: partes[2] || '', alerta: cf.backup_alerta || '' };
}
function revisarBackup_() {
  var e = estadoBackup_(), cf = leerConfig_(), hoy = hoyIso_();
  if (e.exento) { if (cf.backup_alerta) ponerConfig_('backup_alerta', ''); return e; }
  if (!e.driveOk && PROPS.getProperty('BACKUP_REINTENTO') !== hoy) {
    PROPS.setProperty('BACKUP_REINTENTO', hoy);
    try { backupJueves(); return estadoBackup_(); } catch (x) { e.error = String(x && x.message || x).slice(0, 160); }
  }
  var falta = [];
  if (!e.driveOk) falta.push('Google Drive' + (e.error ? ' (' + e.error + ')' : ''));
  if (!e.pcOk) falta.push('tu PC (E:\\2DO CEREBRO\\BackUPS: el PC estaba apagado o el agente no ha podido copiarlo)');
  if (!falta.length) { if (cf.backup_alerta) ponerConfig_('backup_alerta', ''); return e; }
  var txt = 'Backup del jueves ' + isoAFecha(e.requerido) + ' sin hacer en ' + falta.join(' y ') + '.';
  if (cf.backup_alerta !== txt) ponerConfig_('backup_alerta', txt, 'Aviso de backup pendiente (la app y el PC lo muestran; se borra solo al hacerse)');
  var marca = e.requerido + '|' + falta.length + '|' + (!e.driveOk) + (!e.pcOk);
  if (PROPS.getProperty('BACKUP_MAIL') !== marca) {
    try {
      MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, subject: 'Road To Elite · backup del jueves sin hacer', name: 'Road To Elite',
        htmlBody: '<p>' + esc_(txt) + '</p><ul>' + (!e.driveOk ? '<li>Drive: abre el Sheet › menú Road To Elite › «Backup completo ahora».</li>' : '') +
          (!e.pcOk ? '<li>PC: enciéndelo con sesión iniciada; el agente lo copia en la hora siguiente (o ejecuta «Agente PC\\ejecutar ahora.bat»).</li>' : '') +
          '</ul><p>El aviso desaparece de la app y del PC en cuanto se hace.</p>' });
      PROPS.setProperty('BACKUP_MAIL', marca);
    } catch (x) { Logger.log('Correo backup: ' + x); }
  }
  return e;
}

// ---------- 7 · Agente del PC (Ollama + copia del backup + ventana de aviso) ----------
var ACC_AGENTE_ = ['agente_estado', 'agente_wods', 'agente_conceptos', 'agente_backup', 'agente_backup_ok'];
function accionAgente_(body) {
  var tok = PROPS.getProperty('AGENTE_TOKEN'), cache = CacheService.getScriptCache(), fallos = +(cache.get('agente_fallos') || 0);
  if (fallos > 30) return { ok: false, error: 'bloqueado' };
  if (!tok || String(body.agente || '').length < 20 || String(body.agente) !== tok) { cache.put('agente_fallos', String(fallos + 1), 3600); return { ok: false, error: 'no_autorizado' }; }
  if (ACC_AGENTE_.indexOf(body.action) < 0) return { ok: false, error: 'accion_no_permitida' };
  switch (body.action) {
    case 'agente_estado':
      var e = revisarBackup_(), cf = leerConfig_();
      return { ok: true, version: CONFIG.VERSION, backup: { requerido: e.requerido, drive: e.drive, pc: e.pc, driveOk: e.driveOk, pcOk: e.pcOk, exento: e.exento }, alerta: cf.backup_alerta || '' };
    case 'agente_wods':
      return { ok: true, wods: listar_(HOJAS.MOTOR).filter(function (r) { return r.TEXTO && !String(r['CONCEPTOS (Ollama)'] || '').trim(); }).slice(0, Math.min(+body.max || 3, 10))
        .map(function (r) { return { id: r.ID, nombre: r.NOMBRE, fuente: r.FUENTE, texto: r.TEXTO, formato: r.FORMATO, movimientos: r.MOVIMIENTOS, interferencias: r.INTERFERENCIAS, objetivo: r['OBJETIVO / ESTÍMULO'], ciencia: r.CIENCIA }; }), vocab: vocabKnowledge_(40) };
    case 'agente_conceptos':
      var x = listar_(HOJAS.MOTOR).filter(function (r) { return r.ID === String(body.id || ''); })[0];
      if (!x) return { ok: false, error: 'no_encontrado' };
      actualizarFila_(HOJAS.MOTOR, x._fila, { 'CONCEPTOS (Ollama)': String(body.conceptos || '').replace(/[=+@]/g, ' ').slice(0, 1500), 'ANALIZADO POR': autores_(x['ANALIZADO POR'], 'Ollama'), ACTUALIZADO: ahora_() });
      return { ok: true };
    case 'agente_backup':
      var st = estadoBackup_();
      if (!st.zipId) return { ok: false, error: 'sin_backup' };
      var z = DriveApp.getFileById(st.zipId), b64 = Utilities.base64Encode(z.getBlob().getBytes()), T = 900000, n = Math.ceil(b64.length / T);
      var out = { ok: true, fecha: st.drive, nombre: z.getName(), partes: n, kb: Math.round(z.getSize() / 1024) };
      if (body.parte == null) { out.md = st.mdId ? DriveApp.getFileById(st.mdId).getBlob().getDataAsString('UTF-8') : ''; out.mdNombre = st.mdId ? DriveApp.getFileById(st.mdId).getName() : ''; }
      else { var i = Math.max(0, Math.min(n - 1, +body.parte || 0)); out.parte = i; out.datos = b64.slice(i * T, (i + 1) * T); }
      return out;
    case 'agente_backup_ok':
      var f = String(body.fecha || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return { ok: false, error: 'fecha' };
      ponerConfig_('backup_pc', f + ' · copiado ' + ahora_() + ' · ' + String(body.ruta || '').slice(0, 160), 'Último backup de los jueves copiado al PC por el agente');
      var e2 = revisarBackup_();
      return { ok: true, alerta: leerConfig_().backup_alerta || '', pcOk: e2.pcOk };
  }
}
function prepararMotor_() {
  var cf = leerConfig_();
  if (!PROPS.getProperty('AGENTE_TOKEN')) PROPS.setProperty('AGENTE_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12));
  if (!cf.motor_guia_id) {
    var g = DriveApp.getFolderById(CONFIG.BACKUPS_ID).createFile(Utilities.newBlob(MOTOR_GUIA_BASE_, 'text/markdown', 'MOTOR_GUIA.md'));
    ponerConfig_('motor_guia_id', g.getId(), 'ID en Drive de MOTOR_GUIA.md (la guía que sigue el motor; edítala y se relee en 6 h o con configurar)');
  }
  CacheService.getScriptCache().remove('guia_md_v15'); GUIA_MEMO_ = null;
  if (!cf.gemini_modelo || /^gemini-2\./.test(String(cf.gemini_modelo))) ponerConfig_('gemini_modelo', GEMINI_DEF_, 'Modelo de Gemini para la CIENCIA de MOTOR · ANÁLISIS (clave en Propiedades › GEMINI_KEY; nivel gratuito)');
  if (!cf.backup_desde) ponerConfig_('backup_desde', hoyIso_(), 'Desde cuándo se exige el backup de los jueves');
  var r = ['guía ' + guiaMotor_().movs.length + ' movimientos · ' + Object.keys(guiaMotor_().formatos).length + ' formatos · ' + guiaMotor_().interf.length + ' interferencias'];
  r.push('semillas ' + sembrarMotorWods_());
  try { r.push('Fabrik ' + alimentarMotor_(16)); } catch (e) { r.push('Fabrik FALLO ' + e); }
  try { var kn = indexarKnowledge_(true); r.push('KNOWLEDGE ' + kn.archivos + ' .md / ' + kn.secciones + ' secciones'); } catch (e) { r.push('KNOWLEDGE FALLO ' + e); }
  try { var ap = aprenderCiclo_(16); r.push('ciclo ' + ap.dias + ' días · ' + ap.perfiles + ' perfiles'); } catch (e) { r.push('ciclo FALLO ' + e); }
  try { r.push('reanalizados ' + reanalizarMotor_()); } catch (e) { r.push('reanalizar FALLO ' + e); }
  if (!String(leerConfig_().backup_jueves || '')) { try { var bj = backupJueves(); r.push('primer backup ' + bj.kb + ' KB'); } catch (e) { r.push('backup FALLO ' + e); } }
  r.push(PROPS.getProperty('GEMINI_KEY') ? 'Gemini con clave' : 'Gemini sin clave (falta GEMINI_KEY)');
  return r.join(' · ');
}
function menuMotorAhora() { SpreadsheetApp.getActive().toast('Nuevos ' + alimentarMotor_(4) + ' · reanalizados ' + reanalizarMotor_(), 'Motor'); }
function menuGemini() { SpreadsheetApp.getActive().toast('Explicados por Gemini: ' + geminiExplicar_(8), 'Motor'); }
function menuBackupAhora() { var r = backupJueves(); SpreadsheetApp.getActive().toast('Backup ' + r.fecha + ' · ' + r.kb + ' KB en Drive › Backups › APP Road to Elite · jueves', 'Backup'); }
function menuTokenAgente() {
  var t = PROPS.getProperty('AGENTE_TOKEN') || '(ejecuta configurar)';
  SpreadsheetApp.getUi().alert('Token del agente del PC', 'Cópialo y pégalo cuando te lo pida «instalar.bat».\nNo lo compartas con nadie (tampoco con Claude):\n\n' + t, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ===================== v0.16 · BASE DE DATOS DE WODs COMPARTIDA (Base_de_datos_WOD) =====================
/*
 * v0.17: el análisis del motor vive en un libro PROPIO («Road to Elite · Motor»). Base_de_datos_WOD (app de Gabi) solo se LEE.
 * Esa hoja la rellena también la app de Gabi (pestañas «Ciclo …», una por competición, «Resultados archivados», INICIO):
 * Road To Elite NUNCA escribe, renombra ni borra esas pestañas: solo LEE «Ciclo …» (historial de Fabrik) y las de competición.
 * Cada fila lleva PROCEDENCIA y PERMISO: «personal» (programación de Fabrik, tus WODs) o «compartible» (competiciones públicas, benchmarks).
 * Otras apps: motor_wods.json (carpeta de backups de Road To Elite) o API de solo lectura con su token (solo filas «compartible»).
 */
var BD_ = null;
function bdWodsId_() { var id = ''; try { id = leerConfig_().bd_wods_id; } catch (e) {} return String(id || CONFIG.BD_WOD_ID).trim(); }
function bdWods_() { if (!BD_) BD_ = SpreadsheetApp.openById(bdWodsId_()); return BD_; }   // SOLO LECTURA: la hoja de la app de Gabi
/** v0.17 · El análisis del motor vive en un libro PROPIO de Road To Elite («Road to Elite · Motor», CONFIG › motor_bd_id). Nada se escribe en Base_de_datos_WOD. */
var MOTOR_LIBRO_ = null;
function motorLibro_() {
  if (MOTOR_LIBRO_) return MOTOR_LIBRO_;
  var id = ''; try { id = leerConfig_().motor_bd_id; } catch (e) {}
  if (!id) throw new Error('Falta el libro del motor: ejecuta configurar');
  MOTOR_LIBRO_ = SpreadsheetApp.openById(String(id).trim());
  return MOTOR_LIBRO_;
}
var VERSION_GUIA_ = '';
function versionGuia_() { if (!VERSION_GUIA_) VERSION_GUIA_ = 'g-' + hashTxt_(guiaTexto_()).slice(0, 6); return VERSION_GUIA_; }
function metaBd_(procedencia, permiso) { return { PROCEDENCIA: procedencia, PERMISO: permiso, 'VERSIÓN GUÍA': versionGuia_(), IDIOMA: 'es' }; }
function esPestanaGabi_(n) { return n === 'INICIO' || /^Ciclo /.test(n) || n === 'Resultados archivados'; }
/**
 * Lo que vuelca la app de Gabi en Base_de_datos_WOD (SOLO LECTURA; cabecera en la fila 3):
 *  · «Ciclo dd/mm/aaaa»: todos los metcons de Fabrik con fase, semana, atletas, composición y material → historial completo.
 *  · Una pestaña por competición: cada WOD en cada nivel → se toma RX (o el primero si no hay RX), «compartible».
 * Los metcons que ya están (mismo texto, o misma fecha y mismos movimientos que la lectura directa de Fabrik) no se repiten.
 */
function leerVuelcoGabi_(ya, yaFecha) {
  var out = [];
  bdWods_().getSheets().forEach(function (sh) {
    var n = sh.getName(); if (n === 'INICIO' || n === 'Resultados archivados' || /^MOTOR ·/.test(n) || sh.getLastRow() < 4) return;
    var v = sh.getRange(3, 1, sh.getLastRow() - 2, Math.max(1, sh.getLastColumn())).getDisplayValues(), cab = v[0].map(function (h) { return String(h).trim(); });
    var c = function (h) { return cab.indexOf(h); }, g = function (r, h) { return c(h) >= 0 ? String(r[c(h)] || '').trim() : ''; };
    if (c('METCON') < 0) return;
    var ciclo = /^Ciclo /.test(n), filas = v.slice(1).filter(function (r) { return g(r, 'METCON'); });
    if (!ciclo) {
      if (c('NIVEL') < 0) return;
      var porWod = {}; filas.forEach(function (r) { var k = g(r, 'WOD') + '|' + g(r, 'NOMBRE'); if (!porWod[k] || /^RX$/i.test(g(r, 'NIVEL'))) porWod[k] = r; });
      filas = Object.keys(porWod).map(function (k) { return porWod[k]; });
    }
    filas.forEach(function (r) {
      var txt = g(r, 'METCON'), h = hashTxt_(txt); if (ya[h]) return;
      var a = analizarWod_(txt, {}), kf = g(r, 'FECHA') + '|' + a.MOVIMIENTOS;
      if (ciclo && yaFecha[kf]) return;
      ya[h] = 1; yaFecha[kf] = 1;
      var etiquetas = ['ATLETAS', 'COMPOSICIÓN', 'MATERIAL'].map(function (k) { return g(r, k) ? k.charAt(0) + k.slice(1).toLowerCase() + ': ' + g(r, k) : ''; }).filter(Boolean).join(' · ');
      out.push(Object.assign(a, { ID: 'MW-' + h.slice(0, 8), FUENTE: ciclo ? 'Fabrik' : 'Competición', FECHA: g(r, 'FECHA'),
        NOMBRE: (ciclo ? n + ' · ' + g(r, 'FASE') + ' · ' + g(r, 'SEMANA') + ' · ' + g(r, 'DÍA') + ' · ' + (g(r, 'TÍTULO') || 'METCON') : n + ' · WOD ' + g(r, 'WOD') + ' · ' + g(r, 'NOMBRE') + ' (' + g(r, 'NIVEL') + ')').replace(/( · )+/g, ' · ').slice(0, 160),
        'OBJETIVO / ESTÍMULO': [a['OBJETIVO / ESTÍMULO'], etiquetas].filter(Boolean).join('\n'), TEXTO: String(txt).slice(0, 4000), HASH: h, 'ANALIZADO POR': 'Motor', ACTUALIZADO: ahora_() },
        metaBd_(ciclo ? 'Fabrik vía app de Gabi (' + n + ')' : 'Competición pública vía app de Gabi (' + n + ')', ciclo ? 'personal' : 'compartible')));
    });
  });
  return out;
}
function prepararBd_() {
  var r = [], cf = leerConfig_();
  if (!cf.bd_wods_id) ponerConfig_('bd_wods_id', CONFIG.BD_WOD_ID, 'Base_de_datos_WOD de la app de Gabi: Road To Elite SOLO la lee (ciclos y competiciones)');
  else ponerConfig_('bd_wods_id', cf.bd_wods_id, 'Base_de_datos_WOD de la app de Gabi: Road To Elite SOLO la lee (ciclos y competiciones)');
  // 1 · libro propio del motor
  if (!cf.motor_bd_id) {
    var nuevo = SpreadsheetApp.create('Road to Elite · Motor'), f = DriveApp.getFileById(nuevo.getId());
    try { var padre = DriveApp.getFileById(CONFIG.SHEET_ID).getParents(); if (padre.hasNext()) f.moveTo(padre.next()); } catch (e) { Logger.log('Mover libro del motor: ' + e); }
    ponerConfig_('motor_bd_id', nuevo.getId(), 'Libro propio del motor de Road To Elite (MOTOR · ANÁLISIS). Independiente de la app de Gabi');
    MOTOR_LIBRO_ = nuevo; r.push('creado «Road to Elite · Motor»');
  }
  var ss = motorLibro_();
  prepararEsquema_(ss, ESQ_BD_);
  var mo = ss.getSheetByName(HOJAS.MOTOR); if (mo && mo.isSheetHidden()) mo.showSheet();
  var h1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1'); if (h1 && ss.getSheets().length > 1) ss.deleteSheet(h1);
  // 2 · traer lo que la v0.16 dejó en la hoja de Gabi (pestaña oculta MOTOR · ANÁLISIS) y quitar esa pestaña, que es de Road To Elite
  var migrar = function (libro, nombre, etiqueta) {
    var vieja = libro.getSheetByName(nombre); if (!vieja) return;
    var n = vieja.getLastRow() - 1;
    if (n > 0) {
      var cabV = cabeceras_(vieja), datos = vieja.getRange(2, 1, n, cabV.length).getValues(), ya = {};
      listar_(HOJAS.MOTOR).forEach(function (x) { if (x.HASH) ya[x.HASH] = 1; });
      var filas = datos.map(function (row) { var o = {}; cabV.forEach(function (h, k) { o[h] = row[k]; }); return o; }).filter(function (o) { return o.HASH && !ya[o.HASH]; });
      var movidas = filasEnHoja_(HOJAS.MOTOR, filas);
      var tienen = {}; listar_(HOJAS.MOTOR).forEach(function (x) { if (x.HASH) tienen[x.HASH] = 1; });
      var todas = datos.every(function (row) { var hh = row[cabV.indexOf('HASH')]; return !hh || tienen[hh]; });
      if (todas) { libro.deleteSheet(vieja); r.push(etiqueta + ': ' + movidas + ' filas traídas y pestaña quitada'); }
      else r.push('AVISO: ' + etiqueta + ' no se ha copiado entera; la pestaña se conserva');
    } else { libro.deleteSheet(vieja); r.push(etiqueta + ': vacía, quitada'); }
  };
  try { migrar(bdWods_(), HOJAS.MOTOR, 'Base_de_datos_WOD › MOTOR · ANÁLISIS'); } catch (e) { r.push('AVISO migración desde la hoja de Gabi: ' + e); }
  try { migrar(miLibro_(), 'APP · MOTOR WODS', 'APP · MOTOR WODS'); } catch (e) { r.push('AVISO migración APP · MOTOR WODS: ' + e); }
  // 3 · permiso por defecto
  listar_(HOJAS.MOTOR).filter(function (x) { return !x.PERMISO; }).forEach(function (x) {
    actualizarFila_(HOJAS.MOTOR, x._fila, metaBd_(x.FUENTE === 'Competición' ? 'Competición pública / benchmark' : 'Fabrik (programación de Gabi)', x.FUENTE === 'Competición' ? 'compartible' : 'personal'));
  });
  if (!PROPS.getProperty('BD_LECTURA_TOKEN')) PROPS.setProperty('BD_LECTURA_TOKEN', Utilities.getUuid().replace(/-/g, ''));
  r.push(ss.getName() + ' · ' + listar_(HOJAS.MOTOR).length + ' WODs');
  return r.join(' · ');
}
function datosBdJson_() {
  var cab = ESQ_BD_[HOJAS.MOTOR].cab.filter(function (h) { return h !== 'HASH'; });
  return { esquema: 'road-to-elite/motor-wods', version: 1, generado: new Date().toISOString(), servidor: CONFIG.VERSION, guia: versionGuia_(), columnas: cab,
    wods: listar_(HOJAS.MOTOR).map(function (r) { var o = {}; cab.forEach(function (h) { if (r[h] !== '' && r[h] != null) o[h] = r[h]; }); return o; }) };
}
/** motor_wods.json en la carpeta de backups de Road To Elite (se sobrescribe). Para cualquier otra app que tenga tu Drive. */
function exportarBdJson_() {
  var d = datosBdJson_(), txt = JSON.stringify(d, null, 1), carpeta = DriveApp.getFolderById(CONFIG.BACKUPS_ID), it = carpeta.getFilesByName('motor_wods.json');
  if (it.hasNext()) it.next().setContent(txt); else carpeta.createFile('motor_wods.json', txt, 'application/json');
  return { wods: d.wods.length };
}
/** API de solo lectura para otras apps: { bd: token, action: 'bd_wods' | 'bd_guia', desde?: 'dd/mm/aaaa…' }. Solo filas «compartible». */
function accionBd_(body) {
  var tok = PROPS.getProperty('BD_LECTURA_TOKEN'), cache = CacheService.getScriptCache(), fallos = +(cache.get('bd_fallos') || 0);
  if (fallos > 30) return { ok: false, error: 'bloqueado' };
  if (!tok || String(body.bd) !== tok) { cache.put('bd_fallos', String(fallos + 1), 3600); return { ok: false, error: 'no_autorizado' }; }
  if (body.action === 'bd_guia') return { ok: true, guia: guiaTexto_(), version: versionGuia_() };
  if (body.action !== 'bd_wods') return { ok: false, error: 'accion_no_permitida' };
  var d = datosBdJson_();
  d.wods = d.wods.filter(function (w) { return w.PERMISO === 'compartible'; });
  return Object.assign({ ok: true }, d);
}
function menuTokenBd() {
  var t = PROPS.getProperty('BD_LECTURA_TOKEN') || '(ejecuta configurar)';
  SpreadsheetApp.getUi().alert('Token de lectura · base de datos de WODs', 'Para otras apps (solo lectura, solo filas «compartible»):\nPOST a la URL del servidor con { "bd": "<token>", "action": "bd_wods" }\n\n' + t, SpreadsheetApp.getUi().ButtonSet.OK);
}
function menuNuevoTokenAgente() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Cambiar el token del agente', 'El agente de cualquier PC con el token antiguo deja de funcionar hasta que vuelvas a ejecutar instalar.bat con el nuevo. ¿Seguro?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PROPS.setProperty('AGENTE_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12));
  menuTokenAgente();
}

// ===================== v0.18 · BASE DE DATOS DE VÍDEOS COMPARTIDA (Drive › 2DO CEREBRO) =====================
/*
 * «Base de datos Vídeos» (CONFIG.VIDEOS_BD_ID): un solo sitio con los vídeos de técnica que leen las apps de Pablo.
 *   VÍDEOS: EJERCICIO · ALIAS (;) · VÍDEO (url) · ESTADO (OK / ROTO / REVISAR / SIN COMPROBAR) · ÚLTIMA REVISIÓN · DETALLE · FUENTE · APROBADO POR · ALTA · ACTUALIZADO
 *   REVISIONES: registro de cada revisión de enlaces.
 * La app de Gabi añade aquí los martes a las 05:00 lo que falte de su DICCIONARIO. Road To Elite la prepara, la lee los martes a las 06:00
 * (videosMartes: comprueba lo nuevo y, cada CONFIG › videos_revision_dias = 7 o 14 días, todos los enlaces). Los ROTO no se muestran en la app y te llega un correo.
 */
HOJAS.VIDEOS = 'VÍDEOS'; HOJAS.VID_REV = 'REVISIONES';
var ESQ_VID_ = {};
ESQ_VID_[HOJAS.VIDEOS] = { cab: ['EJERCICIO', 'ALIAS', 'VÍDEO', 'ESTADO', 'ÚLTIMA REVISIÓN', 'DETALLE', 'FUENTE', 'APROBADO POR', 'ALTA', 'ACTUALIZADO'],
  anchos: [220, 220, 320, 110, 120, 260, 180, 120, 90, 130], negrita: 'EJERCICIO', color: '#0ea5e9',
  listas: { ESTADO: ['OK', 'ROTO', 'REVISAR', 'SIN COMPROBAR'] }, colores: [['ESTADO', '^ROTO$', '#fde2e2', '#7f1d1d'], ['ESTADO', '^REVISAR$', '#fef3c7', '#78350f'], ['ESTADO', '^OK$', '#dcfce7', '#14532d']] };
ESQ_VID_[HOJAS.VID_REV] = { cab: ['FECHA', 'REVISADOS', 'OK', 'ROTOS', 'REVISAR', 'DETALLE'], anchos: [130, 80, 60, 60, 70, 600], color: '#0ea5e9' };
var VID_LIBRO_ = null;
function videosLibro_() {
  if (VID_LIBRO_) return VID_LIBRO_;
  var id = ''; try { id = leerConfig_().videos_bd_id; } catch (e) {}
  VID_LIBRO_ = SpreadsheetApp.openById(String(id || CONFIG.VIDEOS_BD_ID).trim());
  return VID_LIBRO_;
}
var LEEME_VID_ = [['🎬 Base de datos de vídeos · compartida por las apps de Pablo'], [''],
  ['• VÍDEOS: un ejercicio por fila. ALIAS separados por «;». La app busca el vídeo por el nombre del ejercicio o por sus alias.'],
  ['• ESTADO lo pone la revisión automática de enlaces (cada semana o cada dos): OK · ROTO (el vídeo ya no existe; no se muestra) · REVISAR (privado, sin acceso o error puntual) · SIN COMPROBAR.'],
  ['• Para arreglar uno ROTO: cambia la URL y pon ESTADO = SIN COMPROBAR; la próxima revisión lo valida.'],
  ['• La app de Gabi añade aquí los martes a las 05:00 los ejercicios de su DICCIONARIO que falten. Road To Elite lee de aquí los martes a las 06:00 y revisa los enlaces. Otras apps pueden leer y añadir filas.'],
  ['• No cambies el nombre de las pestañas ni de las columnas.']];
function prepararVideos_() {
  var cf = leerConfig_(), r = [];
  if (!cf.videos_bd_id) ponerConfig_('videos_bd_id', CONFIG.VIDEOS_BD_ID, 'Base de datos Vídeos (Drive › 2DO CEREBRO): la leen las apps de Pablo; Road To Elite la sincroniza y revisa los enlaces');
  if (!cf.videos_revision_dias) ponerConfig_('videos_revision_dias', '7', 'Cada cuántos días se revisan los enlaces de los vídeos (7 o 14)');
  var ss = videosLibro_();
  prepararEsquema_(ss, ESQ_VID_);
  var le = ss.getSheetByName('LÉEME') || ss.insertSheet('LÉEME', 0);
  le.clear(); le.getRange(1, 1, LEEME_VID_.length, 1).setValues(LEEME_VID_); le.getRange(1, 1).setFontWeight('bold').setFontSize(14); le.setColumnWidth(1, 1000);
  ['Hoja 1', 'Sheet1'].forEach(function (n) { var h = ss.getSheetByName(n); if (h && ss.getSheets().length > 1) ss.deleteSheet(h); });
  // migración: la antigua «APP · VÍDEOS» del Sheet de Road To Elite
  var vieja = miLibro_().getSheetByName('APP · VÍDEOS');
  if (vieja && vieja.getLastRow() > 1) {
    var cabV = cabeceras_(vieja), datos = vieja.getRange(2, 1, vieja.getLastRow() - 1, cabV.length).getDisplayValues(), ya = {};
    listar_(HOJAS.VIDEOS).forEach(function (x) { ya[norm(x.EJERCICIO)] = 1; });
    var col = function (row, h) { var k = cabV.indexOf(h); return k >= 0 ? row[k] : ''; };
    var filas = datos.filter(function (row) { return col(row, 'EJERCICIO') && col(row, 'VÍDEO') && !ya[norm(col(row, 'EJERCICIO'))]; }).map(function (row) {
      ya[norm(col(row, 'EJERCICIO'))] = 1;
      return { EJERCICIO: col(row, 'EJERCICIO'), ALIAS: col(row, 'ALIAS'), 'VÍDEO': col(row, 'VÍDEO'), ESTADO: 'SIN COMPROBAR', FUENTE: col(row, 'COPIADO DE APP GABI') ? 'App de Gabi (DICCIONARIO)' : 'Road To Elite',
        'APROBADO POR': col(row, 'APROBADO POR'), ALTA: col(row, 'FECHA'), ACTUALIZADO: ahora_() };
    });
    var n = filasEnHoja_(HOJAS.VIDEOS, filas), tienen = {}; listar_(HOJAS.VIDEOS).forEach(function (x) { tienen[norm(x.EJERCICIO)] = 1; });
    if (datos.every(function (row) { return !col(row, 'EJERCICIO') || tienen[norm(col(row, 'EJERCICIO'))]; })) { miLibro_().deleteSheet(vieja); r.push(n + ' vídeos traídos de APP · VÍDEOS y pestaña quitada'); }
    else r.push('AVISO: APP · VÍDEOS no se copió entera; se conserva');
  } else if (vieja) { miLibro_().deleteSheet(vieja); }
  if (!leerConfig_().videos_version) ponerConfig_('videos_version', ahora_() + ' · instalación', 'Última lectura de la Base de datos Vídeos (martes 06:00)');
  r.push(listar_(HOJAS.VIDEOS).length + ' vídeos');
  return r.join(' · ');
}
/** Comprueba los enlaces. YouTube y Vimeo por oEmbed (404 = borrado → ROTO; 401/403 = privado o sin permiso → REVISAR); el resto por GET. */
function revisarVideos_(soloNuevos) {
  var filas = listar_(HOJAS.VIDEOS).filter(function (r) { return r['VÍDEO'] && (!soloNuevos || !r.ESTADO || r.ESTADO === 'SIN COMPROBAR'); }), res = { revisados: 0, ok: 0, rotos: [], revisar: [] }, hoy = hoyTxt_();
  var urlCheck = function (u) {
    if (/youtu\.?be/i.test(u)) return 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u);
    if (/vimeo\.com/i.test(u)) return 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(u);
    return u;
  };
  for (var i = 0; i < filas.length; i += 25) {
    var lote = filas.slice(i, i + 25), resp;
    try { resp = UrlFetchApp.fetchAll(lote.map(function (r) { return { url: urlCheck(String(r['VÍDEO']).trim()), muteHttpExceptions: true, followRedirects: true }; })); }
    catch (e) { resp = lote.map(function () { return null; }); }
    lote.forEach(function (r, k) {
      var x = resp[k], code = x ? x.getResponseCode() : 0, est, det;
      if (code >= 200 && code < 400) { est = 'OK'; det = ''; res.ok++; }
      else if (code === 404 || code === 410 || code === 400) { est = 'ROTO'; det = 'HTTP ' + code + ': el vídeo ya no existe o la URL no es válida'; res.rotos.push(r.EJERCICIO); }
      else { est = 'REVISAR'; det = code ? 'HTTP ' + code + (code === 401 || code === 403 ? ': privado o sin permiso para insertarlo' : ': error del servidor, se reintenta en la próxima revisión') : 'sin respuesta'; res.revisar.push(r.EJERCICIO); }
      res.revisados++;
      if (r.ESTADO !== est || r.DETALLE !== det || !r['ÚLTIMA REVISIÓN']) actualizarFila_(HOJAS.VIDEOS, r._fila, { ESTADO: est, DETALLE: det, 'ÚLTIMA REVISIÓN': hoy });
    });
  }
  anadirFila_(HOJAS.VID_REV, { FECHA: ahora_(), REVISADOS: res.revisados, OK: res.ok, ROTOS: res.rotos.length, REVISAR: res.revisar.length,
    DETALLE: (res.rotos.length ? 'Rotos: ' + res.rotos.join(', ') : '') + (res.revisar.length ? (res.rotos.length ? ' · ' : '') + 'Revisar: ' + res.revisar.join(', ') : '') });
  ponerConfig_('videos_ultima_revision', hoyIso_() + ' · ' + res.revisados + ' revisados · ' + res.rotos.length + ' rotos · ' + res.revisar.length + ' a revisar', 'Última revisión de enlaces de la Base de datos Vídeos');
  if (res.rotos.length || res.revisar.length) {
    try { MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, name: 'Road To Elite', subject: 'Vídeos: ' + res.rotos.length + ' rotos y ' + res.revisar.length + ' a revisar',
      htmlBody: '<p>Revisión de la <b>Base de datos Vídeos</b> (Drive › 2DO CEREBRO).</p>' + (res.rotos.length ? '<p><b>Rotos</b> (no se muestran en las apps): ' + esc_(res.rotos.join(', ')) + '</p>' : '') +
        (res.revisar.length ? '<p><b>A revisar</b> (privados o error puntual): ' + esc_(res.revisar.join(', ')) + '</p>' : '') +
        '<p>Para arreglarlos: cambia la URL en la hoja y pon ESTADO = SIN COMPROBAR.</p><p><a href="https://docs.google.com/spreadsheets/d/' + videosLibro_().getId() + '/edit">Abrir la base de datos</a></p>' }); } catch (e) { Logger.log('Correo vídeos: ' + e); }
  }
  return res;
}
/**
 * v0.21.1 · Martes 06:00 (después de la copia de la app de Gabi de las 05:00): Road To Elite lee la Base de datos Vídeos.
 *  - comprueba los enlaces nuevos (SIN COMPROBAR) y, si tocan (7 o 14 días), todos;
 *  - sube CONFIG › videos_version: la app ve el cambio y vuelve a pedir la lista (si no, usa la que tiene guardada).
 */
function videosMartes() { return conSalud_('videosMartes', videosMartes_sin_); }
function videosMartes_sin_() {
  VID_LIBRO_ = null; MEMO = null;
  var cf = leerConfig_(), cada = parseInt(cf.videos_revision_dias, 10) || 7, ult = String(cf.videos_ultima_revision || '').slice(0, 10);
  var toca = !ult || sumarDias(ult, cada) <= hoyIso_(), nuevos = listar_(HOJAS.VIDEOS).filter(function (r) { return r['VÍDEO'] && (!r.ESTADO || r.ESTADO === 'SIN COMPROBAR'); }).length;
  var res = toca ? revisarVideos_() : nuevos ? revisarVideos_(true) : null;
  var total = leerVideos_().length;
  ponerConfig_('videos_version', ahora_() + ' · ' + total + ' vídeos · ' + nuevos + ' nuevos' + (res ? ' · ' + res.rotos.length + ' rotos' : ''), 'Última lectura de la Base de datos Vídeos (martes 06:00, tras la copia de la app de Gabi de las 05:00). La app recarga los vídeos cuando cambia');
  return { total: total, nuevos: nuevos, revision: toca ? 'completa' : nuevos ? 'solo nuevos' : 'no tocaba' };
}
/** Compatibilidad: el disparador diario antiguo ya no revisa nada (lo hace videosMartes). */
function revisarVideosSiToca() { return 'sustituido por videosMartes (martes 06:00)'; }
function menuRevisarVideos() { var r = revisarVideos_(); SpreadsheetApp.getActive().toast(r.revisados + ' revisados · ' + r.rotos.length + ' rotos · ' + r.revisar.length + ' a revisar', 'Vídeos'); }

// ===================== v0.19 · KNOWLEDGE + APRENDIZAJE DEL CICLO =====================
/*
 * KNOWLEDGE (Drive › 2DO CEREBRO › CROSSFIT › KNOWLEDGE): se recorren todas sus carpetas y se indexan los .md
 *   → «KNOWLEDGE · ÍNDICE» (un archivo por fila) y «KNOWLEDGE · SECCIONES» (cada apartado ## / ###, con palabras clave).
 *   El motor busca ahí (buscarKnowledge_) lo que aplica a cada caso y se lo pasa a Gemini y a Ollama, que citan la fuente.
 * Aprendizaje del ciclo: cada semana de Fabrik deja su huella día a día en «MOTOR · CICLO» (fase, semana de la fase, bloques,
 *   tipos, minutos, RPE, cargas, estímulos, estructura). «MOTOR · PERFIL FASE» resume, por fase y día, lo que suele hacer Gabi.
 *   El generador usa ese perfil para los días que Gabi aún no ha subido (previsión de carga e interferencias).
 *   «MOTOR · LECTURAS»: cada semana, un resumen del motor + la lectura de Gemini apoyada en KNOWLEDGE.
 */
ESQ_BD_['KNOWLEDGE · ÍNDICE'] = { cab: ['ARCHIVO', 'RUTA', 'CATEGORÍA', 'TEMA', 'TÍTULO', 'SECCIONES', 'CARACTERES', 'ACTUALIZADO', 'ID'], anchos: [260, 260, 130, 180, 320, 80, 90, 130, 120], negrita: 'ARCHIVO', color: '#16a34a' };
ESQ_BD_['KNOWLEDGE · SECCIONES'] = { cab: ['ARCHIVO', 'SECCIÓN', 'CATEGORÍA', 'PALABRAS', 'TEXTO', 'ID ARCHIVO'], anchos: [220, 320, 120, 320, 500, 110], negrita: 'SECCIÓN', color: '#16a34a' };
ESQ_BD_['MOTOR · CICLO'] = { cab: ['CLAVE', 'LUNES', 'FASE', 'SEMANA FASE', 'DÍA', 'FECHA', 'BLOQUES', 'MIN', 'RPE', 'DURO', 'TIPOS', 'CARGAS', 'ESTÍMULOS', 'ESTRUCTURA', 'ACTUALIZADO'],
  anchos: [150, 90, 130, 90, 90, 90, 70, 60, 50, 60, 260, 220, 220, 420, 130], color: '#8b5cf6' };
ESQ_BD_['MOTOR · PERFIL FASE'] = { cab: ['FASE', 'DÍA', 'SEMANAS', 'MIN MEDIO', 'RPE MEDIO', '% DURO', 'CARGAS FRECUENTES', 'TIPOS FRECUENTES', 'ESTÍMULOS FRECUENTES', 'ACTUALIZADO'],
  anchos: [130, 90, 70, 80, 80, 70, 240, 240, 240, 130], color: '#8b5cf6' };
ESQ_BD_['MOTOR · LECTURAS'] = { cab: ['LUNES', 'FASE', 'SEMANA FASE', 'RESUMEN (motor)', 'LECTURA (Gemini)', 'FUENTES KNOWLEDGE', 'FIRMA', 'ACTUALIZADO'],
  anchos: [90, 130, 90, 420, 520, 320, 90, 130], color: '#8b5cf6' };

// ---------- KNOWLEDGE ----------
var VACIAS_ = 'PARA,COMO,ESTE,ESTA,ESTOS,ESTAS,CUANDO,DONDE,PORQUE,SOBRE,ENTRE,DESDE,HASTA,TIENE,TIENEN,PUEDE,PUEDEN,MUCHO,MENOS,TODOS,TODAS,CADA,OTRO,OTRA,OTROS,SINO,SOLO,TAMBIEN,AUNQUE,MIENTRAS,ANTES,DESPUES,SIEMPRE,NUNCA,SEGUN,HACER,HACIA,DURANTE,ESTAR,MISMO,MISMA,TANTO,PORQUE,ELLOS,NUESTRO,NUESTRA'.split(',');
function palabrasClave_(txt, n) {
  var f = {}; norm(txt).split(/[^A-Z0-9Ñ]+/).forEach(function (w) { if (w.length >= 5 && VACIAS_.indexOf(w) < 0 && !/^[0-9]+$/.test(w)) f[w] = (f[w] || 0) + 1; });
  return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }).slice(0, n || 25).join(' ').toLowerCase();
}
function trocearMd_(txt) {
  var out = [], act = { titulo: '(inicio)', l: [] };
  String(txt || '').replace(/\r/g, '').split('\n').forEach(function (l) {
    var h = l.match(/^#{1,3}\s+(.+?)\s*$/);
    if (h) { if (act.l.join('').trim()) out.push(act); act = { titulo: h[1].replace(/[*_`]/g, ''), l: [l] }; } else act.l.push(l);
  });
  if (act.l.join('').trim()) out.push(act);
  var res = [];
  out.forEach(function (s) { var t = s.l.join('\n').trim(); for (var i = 0; i < t.length; i += 40000) res.push({ titulo: s.titulo + (i ? ' (cont.)' : ''), texto: t.slice(i, i + 40000) }); });
  return res;
}
function recorrerMd_(folder, ruta, out) {
  var it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/\.md$/i.test(f.getName()) || f.getMimeType() === 'text/markdown') out.push({ f: f, ruta: ruta }); }
  var sub = folder.getFolders();
  while (sub.hasNext()) { var s = sub.next(); recorrerMd_(s, ruta.concat([s.getName()]), out); }
}
function reescribirHoja_(nombre, filas) {
  var sh = hojaMia_(nombre), cab = cabeceras_(sh);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, cab.length).setValues(filas.map(function (o) { return cab.map(function (h) { return o[h] == null ? '' : celdaSegura_(o[h]); }); }));
  MEMO = null;
}
/** Indexa KNOWLEDGE (solo si algo cambió). forzar = true lo rehace siempre. */
function indexarKnowledge_(forzar) {
  var lista = []; recorrerMd_(DriveApp.getFolderById(CONFIG.KNOWLEDGE_ID), [], lista);
  var firma = lista.map(function (x) { return x.f.getId() + ':' + x.f.getLastUpdated().getTime(); }).sort().join('|');
  firma = hashTxt_(firma);
  if (!forzar && PROPS.getProperty('KNOW_FIRMA') === firma) return { archivos: lista.length, secciones: null, igual: true };
  var idx = [], secs = [];
  lista.forEach(function (x) {
    var txt = x.f.getBlob().getDataAsString('UTF-8'), partes = trocearMd_(txt);
    idx.push({ ARCHIVO: x.f.getName(), RUTA: x.ruta.join(' › '), 'CATEGORÍA': x.ruta[0] || '', TEMA: x.ruta.slice(1).join(' › '), 'TÍTULO': (txt.match(/^#\s+(.+)$/m) || [])[1] || x.f.getName(),
      SECCIONES: partes.length, CARACTERES: txt.length, ACTUALIZADO: Utilities.formatDate(x.f.getLastUpdated(), CONFIG.ZONA, 'dd/MM/yyyy HH:mm'), ID: x.f.getId() });
    partes.forEach(function (s) { secs.push({ ARCHIVO: x.f.getName(), 'SECCIÓN': s.titulo, 'CATEGORÍA': x.ruta[0] || '', PALABRAS: palabrasClave_(s.texto), TEXTO: s.texto, 'ID ARCHIVO': x.f.getId() }); });
  });
  reescribirHoja_('KNOWLEDGE · ÍNDICE', idx); reescribirHoja_('KNOWLEDGE · SECCIONES', secs);
  PROPS.setProperty('KNOW_FIRMA', firma);
  return { archivos: idx.length, secciones: secs.length };
}
/** Las n secciones de KNOWLEDGE que más tienen que ver con la consulta: [{ archivo, seccion, texto }]. */
function buscarKnowledge_(consulta, n, maxChars) {
  var secs; try { secs = listar_('KNOWLEDGE · SECCIONES'); } catch (e) { return []; }
  var q = norm(consulta).split(/[^A-Z0-9Ñ]+/).filter(function (w) { return w.length >= 4 && VACIAS_.indexOf(w) < 0; }).filter(function (w, i, a) { return a.indexOf(w) === i; });
  if (!q.length) return [];
  var puntua = function (s) {
    var tit = norm(s['SECCIÓN']), pal = norm(s.PALABRAS), tx = norm(String(s.TEXTO).slice(0, 20000));
    return q.reduce(function (a, w) { return a + (tit.indexOf(w) >= 0 ? 4 : 0) + (pal.indexOf(w) >= 0 ? 3 : 0) + Math.min(3, tx.split(w).length - 1); }, 0);
  };
  return secs.map(function (s) { return { s: s, p: puntua(s) }; }).filter(function (x) { return x.p > 0; }).sort(function (a, b) { return b.p - a.p; }).slice(0, n || 4)
    .map(function (x) { return { archivo: x.s.ARCHIVO, seccion: x.s['SECCIÓN'], texto: String(x.s.TEXTO).slice(0, maxChars || 3000) }; });
}
function vocabKnowledge_(n) {
  try { return listar_('KNOWLEDGE · SECCIONES').map(function (s) { return s['SECCIÓN']; }).filter(function (t) { return t && !/inicio|índice|indice|fuentes|bibliograf/i.test(t); }).slice(0, n || 40); } catch (e) { return []; }
}

// ---------- Huella del ciclo ----------
function faseDe_(iso, est) {
  var fs = (est && est.ciclo && est.ciclo.fases) || [];
  for (var i = 0; i < fs.length; i++) {
    var f = fs[i]; if (f.inicio && f.fin && iso >= f.inicio && iso <= f.fin) {
      var sem = Math.floor((new Date(iso + 'T12:00:00') - new Date(f.inicio + 'T12:00:00')) / 86400000 / 7) + 1;
      return { nombre: String(f.nombre || '').trim(), semana: sem, de: f.semanas, objetivos: f.objetivos || '' };
    }
  }
  return { nombre: 'Sin fase', semana: '', de: '', objetivos: '' };
}
var TIPOS_BLOQUE_ = [['metcon', /METCON|WOD\b|AMRAP|FOR TIME|EMOM/], ['haltero', /WEIGH?LIFTING|SNATCH|CLEAN|JERK|HALTER/], ['gimnásticos', /GIMNAS|GYMNAS|SKILL|HSPU|MUSCLE|HSWALK|HANDSTAND|PULL UP|RING/],
  ['fuerza', /STRENGH?T|SQUAT|DEADLIFT|PRESS|BENCH|FUERZA|STRONGMAN/], ['accesorios', /ACCESOR|ACCESSOR/], ['endurance', /MONOESTRUCT|ZONA 2|ENDURANCE|AEROBIC|CARRERA|RUN\b/], ['movilidad', /MOVILIDAD|MOBILITY|RANGO/]];
function tipoBloqueTxt_(t) { t = norm(t); for (var i = 0; i < TIPOS_BLOQUE_.length; i++) if (TIPOS_BLOQUE_[i][1].test(t)) return TIPOS_BLOQUE_[i][0]; return 'otro'; }
function huellaSemana_(s, est, cat) {
  var F = semanaBase_(s, est), fase = faseDe_(s.iso, est), out = [];
  (F.dias || []).forEach(function (d) {
    var bl = (d.bloques || []).filter(function (b) { return b.n; });
    if (!bl.length || !d.iso) return;
    var tipos = [], cargas = {}, cods = {}, min = 0, rpe = parseInt(String(d.rpe || '').replace(/[^\d]/g, ''), 10) || 0;
    bl.forEach(function (b) {
      var txt = textoBloque_(b), pseudo = { 'TÍTULO': b.titulo || '', CONTENIDO: txt, ORIGEN: 'FABRIK', INTENSIDAD: b.rpe || '' };
      var tp = tipoBloqueTxt_((b.titulo || '') + ' ' + txt.slice(0, 120)); tipos.push(tp);
      min += minFila_(pseudo); cargasFila_(pseudo).forEach(function (k) { cargas[k] = (cargas[k] || 0) + 1; });
      try { codigosTexto_(txt, cat, tp === 'metcon').forEach(function (k) { cods[k] = 1; }); } catch (e) {}
      var r = parseInt(String(b.rpe || '').replace(/[^\d]/g, ''), 10) || 0; if (r > rpe) rpe = r;
    });
    out.push({ CLAVE: s.iso + '|' + diaDe_(d.iso), LUNES: isoAFecha(s.iso), FASE: fase.nombre, 'SEMANA FASE': fase.semana + (fase.de ? ' de ' + fase.de : ''), 'DÍA': diaDe_(d.iso), FECHA: isoAFecha(d.iso),
      BLOQUES: bl.length, MIN: Math.round(min), RPE: rpe || '', DURO: (rpe >= 8 || tipos.indexOf('metcon') >= 0 && rpe >= 8) ? 'Sí' : 'No', TIPOS: tipos.join(', '),
      CARGAS: Object.keys(cargas).sort(function (a, b) { return cargas[b] - cargas[a]; }).join(', '), 'ESTÍMULOS': Object.keys(cods).join(', '), ESTRUCTURA: tipos.join(' → '), ACTUALIZADO: ahora_() });
  });
  return { fase: fase, dias: out };
}
/** Huella de las últimas n semanas de Fabrik (incluida la que esté subiendo Gabi) y perfil por fase. */
function aprenderCiclo_(nSemanas) {
  var est = estructura_(fabrik_()), cat = catalogo_(), tope = sumarDias(lunesDe_(hoyIso_()), 7), filas = {}, n = 0;
  listar_('MOTOR · CICLO').forEach(function (r) { filas[r.CLAVE] = r; });
  est.semanas.filter(function (s) { return s.iso && s.iso <= tope; }).slice(-(nSemanas || 2)).forEach(function (s) {
    try { huellaSemana_(s, est, cat).dias.forEach(function (o) { filas[o.CLAVE] = o; n++; }); } catch (e) { Logger.log('Huella ' + s.nombre + ': ' + e); }
  });
  var lista = Object.keys(filas).sort().map(function (k) { return filas[k]; });
  reescribirHoja_('MOTOR · CICLO', lista);
  // perfil por fase y día
  var g = {};
  lista.forEach(function (r) {
    var k = r.FASE + '|' + r['DÍA'], x = g[k] = g[k] || { fase: r.FASE, dia: r['DÍA'], sem: {}, min: 0, rpe: 0, nr: 0, duro: 0, n: 0, cargas: {}, tipos: {}, cods: {} };
    x.n++; x.sem[r.LUNES] = 1; x.min += +r.MIN || 0; if (+r.RPE) { x.rpe += +r.RPE; x.nr++; } if (r.DURO === 'Sí') x.duro++;
    [['cargas', r.CARGAS], ['tipos', r.TIPOS], ['cods', r['ESTÍMULOS']]].forEach(function (p) { String(p[1] || '').split(/\s*,\s*/).filter(Boolean).forEach(function (v) { x[p[0]][v] = (x[p[0]][v] || 0) + 1; }); });
  });
  var top = function (o, n2) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, n2 || 4).map(function (k) { return k + ' (' + o[k] + ')'; }).join(', '); };
  var ORD = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var perfil = Object.keys(g).map(function (k) { var x = g[k]; return { FASE: x.fase, 'DÍA': x.dia, SEMANAS: Object.keys(x.sem).length, 'MIN MEDIO': Math.round(x.min / x.n), 'RPE MEDIO': x.nr ? Math.round(x.rpe / x.nr * 10) / 10 : '',
    '% DURO': Math.round(x.duro / x.n * 100), 'CARGAS FRECUENTES': top(x.cargas), 'TIPOS FRECUENTES': top(x.tipos), 'ESTÍMULOS FRECUENTES': top(x.cods, 6), ACTUALIZADO: ahora_() }; })
    .sort(function (a, b) { return a.FASE < b.FASE ? -1 : a.FASE > b.FASE ? 1 : ORD.indexOf(a['DÍA']) - ORD.indexOf(b['DÍA']); });
  reescribirHoja_('MOTOR · PERFIL FASE', perfil);
  return { dias: n, perfiles: perfil.length };
}
/** Perfil esperado de cada día de esa semana según la fase (para los días que Gabi aún no ha subido). */
function perfilSemana_(lunes) {
  var est; try { est = estructura_(fabrik_()); } catch (e) { return {}; }
  var fase = faseDe_(lunes, est).nombre, out = {};
  try { listar_('MOTOR · PERFIL FASE').forEach(function (r) { if (r.FASE === fase && +r.SEMANAS >= 1) out[r['DÍA']] = { pctDuro: +r['% DURO'] || 0, cargas: String(r['CARGAS FRECUENTES'] || '').split(/\s*,\s*/).map(function (x) { return x.replace(/\s*\(\d+\)$/, ''); }).filter(Boolean).slice(0, 3), semanas: +r.SEMANAS, fase: fase }; }); } catch (e) {}
  return out;
}
/** Lectura semanal: resumen del motor + Gemini apoyado en KNOWLEDGE (cita archivo › sección). Solo si la semana cambió. */
function lecturaSemana_(lunes) {
  var est = estructura_(fabrik_()), s = est.semanas.filter(function (x) { return x.iso === lunes; })[0];
  if (!s) return 'sin semana';
  var h = huellaSemana_(s, est, catalogo_()), firma = hashTxt_(JSON.stringify(h.dias.map(function (d) { return [d['DÍA'], d.TIPOS, d.MIN, d.RPE]; }))).slice(0, 10);
  var prev = listar_('MOTOR · LECTURAS').filter(function (r) { return celdaIso_(r.LUNES) === lunes; })[0];
  if (prev && prev.FIRMA === firma && prev['LECTURA (Gemini)']) return 'igual';
  var resumen = 'Fase ' + h.fase.nombre + ' (semana ' + h.fase.semana + (h.fase.de ? ' de ' + h.fase.de : '') + '). ' + h.dias.length + ' días subidos. ' +
    h.dias.map(function (d) { return d['DÍA'].slice(0, 3) + ': ' + d.ESTRUCTURA + ' · ' + d.MIN + '′' + (d.RPE ? ' · RPE ' + d.RPE : '') + (d.DURO === 'Sí' ? ' · DURO' : '') + (d.CARGAS ? ' · ' + d.CARGAS.toLowerCase() : ''); }).join(' | ');
  var fuentes = buscarKnowledge_(h.fase.nombre + ' ' + h.fase.objetivos + ' ' + h.dias.map(function (d) { return d.TIPOS; }).join(' ') + ' ajuste por fase extras interferencia', 4, 2500);
  var lectura = '', key = PROPS.getProperty('GEMINI_KEY');
  if (key) {
    var perfil = listar_('MOTOR · PERFIL FASE').filter(function (r) { return r.FASE === h.fase.nombre; }).map(function (r) { return r['DÍA'] + ': ' + r['MIN MEDIO'] + '′, RPE ' + r['RPE MEDIO'] + ', ' + r['% DURO'] + ' % duro, ' + r['TIPOS FRECUENTES']; }).join('\n');
    var prompt = 'Eres el preparador de un atleta híbrido RX (CrossFit + carrera/HYROX). Lee la semana de su programación base (Fabrik, coach Gabi) y escribe en español, en 6–9 frases y sin markdown: ' +
      '1) en qué punto del ciclo está y qué busca el coach; 2) cómo se reparten los estímulos y la carga por días; 3) qué extras encajan (tipo, día y dónde dentro de la sesión, siempre antes del metcon salvo carrera/Z6–Z8) y cuáles evitar por interferencia; ' +
      '4) qué esperar de los días que aún no ha subido el coach. Apóyate SOLO en el conocimiento citado y cita entre corchetes [archivo › sección] lo que uses.\n\n' +
      'OBJETIVOS DE LA FASE: ' + h.fase.objetivos + '\n\nSEMANA: ' + resumen + '\n\nPERFIL HISTÓRICO DE ESTA FASE:\n' + perfil + '\n\nCONOCIMIENTO (KNOWLEDGE):\n' +
      fuentes.map(function (f) { return '[' + f.archivo + ' › ' + f.seccion + ']\n' + f.texto; }).join('\n\n');
    var g = geminiLlamar_(prompt, 1500, 0.4); if (g.ok) lectura = g.texto;
  }
  var o = { LUNES: isoAFecha(lunes), FASE: h.fase.nombre, 'SEMANA FASE': h.fase.semana + (h.fase.de ? ' de ' + h.fase.de : ''), 'RESUMEN (motor)': resumen, 'LECTURA (Gemini)': lectura.slice(0, 6000),
    'FUENTES KNOWLEDGE': fuentes.map(function (f) { return f.archivo + ' › ' + f.seccion; }).join('\n'), FIRMA: firma, ACTUALIZADO: ahora_() };
  if (prev) actualizarFila_('MOTOR · LECTURAS', prev._fila, o); else anadirFila_('MOTOR · LECTURAS', o);
  return lectura ? 'con Gemini' : 'solo motor';
}
function menuAprenderCiclo() {
  var k = indexarKnowledge_(true), a = aprenderCiclo_(16), l = ''; try { l = lecturaSemana_(lunesDe_(hoyIso_())); } catch (e) { l = String(e); }
  SpreadsheetApp.getActive().toast('KNOWLEDGE: ' + k.archivos + ' .md · ' + k.secciones + ' secciones · ciclo: ' + a.dias + ' días · lectura: ' + l, 'Motor', 8);
}

// ===================== v0.20 · COMPETIS (copia de «COMPETIS PROPUESTAS» de ProgramAPP) + SEGUIMIENTO EN CALENDAR =====================
/*
 * «Road to Elite · Motor» es la base de datos de Road To Elite para todo lo que no es el día a día (WODs, KNOWLEDGE, ciclo, competis…).
 * COMPETIS: copia (SOLO LECTURA del origen) de ProgramAPP › «COMPETIS PROPUESTAS», que la app de Gabi rellena cada lunes.
 *   Se copia los lunes a las 15:00 y con configurar; lo de Gabi se actualiza, lo de Road To Elite (seguimiento, fechas, respuestas) se conserva.
 * Seguimiento: al marcarla, van a Google Calendar la competi, la apertura de inscripción y el clasificatorio (si hay fecha).
 *   Llegada la fecha de inscripción / clasificatorio, la app pregunta si se hizo: «No» → se borra todo del calendario y sale del seguimiento.
 */
HOJAS.COMPETIS = 'COMPETIS';
ESQ_BD_[HOJAS.COMPETIS] = { cab: ['ID', 'ESTADO (Gabi)', 'NOMBRE', 'INICIO', 'FIN', 'CIUDAD', 'PROVINCIA', 'WEB', 'WODBUSTER', 'INSTAGRAM', 'APERTURA INSCRIPCIÓN', 'CLASIFICATORIO', 'CATEGORÍAS CLASIFICATORIO',
  'CATEGORÍAS', 'PRECIO', 'FUENTE', 'ENCONTRADA', 'NOTAS', 'SEGUIMIENTO', 'FECHA INSCRIPCIÓN', 'FECHA CLASIFICATORIO', 'INSCRIPCIÓN', 'CLASIFICATORIO (hecho)', 'GCAL', 'COPIADA', 'ÁMBITO', 'CON CLASIFICATORIO', 'NIVELES', 'FORMATO'],
  anchos: [80, 90, 240, 90, 90, 120, 100, 200, 200, 200, 110, 120, 160, 200, 140, 200, 90, 300, 90, 110, 110, 100, 110, 160, 130, 110, 110, 180, 140], negrita: 'NOMBRE', color: '#f59e0b',
  fechas: ['INICIO', 'FIN', 'FECHA INSCRIPCIÓN', 'FECHA CLASIFICATORIO'],
  listas: { SEGUIMIENTO: ['Sí', 'No'], 'INSCRIPCIÓN': ['Pendiente', 'Hecha', 'No'], 'CLASIFICATORIO (hecho)': ['Pendiente', 'Hecho', 'No'] },
  colores: [['SEGUIMIENTO', '^Sí$', '#fef3c7', '#78350f']] };
var CAMPOS_GABI_COMPETI_ = ['ESTADO', 'NOMBRE', 'INICIO', 'FIN', 'CIUDAD', 'PROVINCIA', 'WEB', 'WODBUSTER', 'INSTAGRAM', 'APERTURA INSCRIPCIÓN', 'CLASIFICATORIO', 'CATEGORÍAS CLASIFICATORIO', 'CATEGORÍAS', 'PRECIO', 'FUENTE', 'ENCONTRADA', 'NOTAS'];
/** Una celda de fecha (Date, número de serie o texto) → dd/mm/aaaa, o el texto tal cual si no es fecha. */
function fechaCelda_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, CONFIG.ZONA, 'dd/MM/yyyy');
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) { var n = +v; if (n > 30000 && n < 80000) return isoAFecha(sumarDias('1899-12-30', Math.floor(n))); }
  var s = String(v == null ? '' : v).trim(), iso = celdaIso_(s);
  return iso ? isoAFecha(iso) : s;
}
/** Primera fecha que aparezca en un texto («Sí, online del 3 al 9/1/2027»…). */
function fechaEnTexto_(t) {
  var m = String(t || '').match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (!m) return '';
  var y = m[3].length === 2 ? '20' + m[3] : m[3]; return isoAFecha(y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2));
}
function copiarCompetis_() {
  var sh = programApp_().getSheetByName('COMPETIS PROPUESTAS');
  if (!sh || sh.getLastRow() < 4) return 0;
  var v = sh.getRange(3, 1, sh.getLastRow() - 2, sh.getLastColumn()).getValues(), cab = v[0].map(function (h) { return String(h).trim(); });
  var ix = function (h) { return cab.indexOf(h); }, ya = {}, nuevas = [], act = 0;
  listar_(HOJAS.COMPETIS).forEach(function (r) { ya[r.ID] = r; });
  v.slice(1).forEach(function (row) {
    var id = String(row[ix('ID')] || '').trim(); if (!id || !String(row[ix('NOMBRE')] || '').trim()) return;
    var o = {};
    CAMPOS_GABI_COMPETI_.forEach(function (h) { var k = ix(h); if (k < 0) return; var val = row[k]; o[h === 'ESTADO' ? 'ESTADO (Gabi)' : h] = /INICIO|FIN|APERTURA|ENCONTRADA/.test(h) ? fechaCelda_(val) : String(val == null ? '' : val).trim(); });
    Object.assign(o, clasificarCompeti_(o));   // v0.23 · ÁMBITO, CON CLASIFICATORIO, NIVELES, FORMATO
    o.COPIADA = ahora_();
    var r = ya[id];
    if (r) {
      var cambia = Object.keys(o).some(function (k) { return k !== 'COPIADA' && String(r[k] || '') !== String(o[k] || ''); });
      if (cambia) { actualizarFila_(HOJAS.COMPETIS, r._fila, o); act++; }
    } else {
      o.ID = id; o.SEGUIMIENTO = 'No';
      o['FECHA INSCRIPCIÓN'] = /^\d{2}\/\d{2}\/\d{4}$/.test(o['APERTURA INSCRIPCIÓN'] || '') ? o['APERTURA INSCRIPCIÓN'] : '';
      o['FECHA CLASIFICATORIO'] = fechaEnTexto_(o.CLASIFICATORIO);
      nuevas.push(o);
    }
  });
  filasEnHoja_(HOJAS.COMPETIS, nuevas);
  try { var shC = hojaMia_(HOJAS.COMPETIS); if (!shC.getFilter() && shC.getLastRow() > 1) shC.getRange(1, 1, shC.getLastRow(), shC.getLastColumn()).createFilter(); } catch (e) {}   // filtro nativo en el libro del motor
  try { MEMO = null; if (miLibro_().getSheetByName(COMP_VISTA_)) pintarCompetisSheet_(); } catch (e) {}
  ponerConfig_('competis_copia', ahora_() + ' · ' + nuevas.length + ' nuevas · ' + act + ' actualizadas', 'Última copia de COMPETIS PROPUESTAS (ProgramAPP, solo lectura) a Road to Elite · Motor');
  return nuevas.length;
}
// ===================== v0.23 · COMPETIS: clasificación y filtros (app + Sheet) =====================
/*
 * Cada competi copiada de ProgramAPP › «COMPETIS PROPUESTAS» (solo lectura) recibe 4 columnas calculadas en «Road to Elite · Motor» › COMPETIS:
 *   ÁMBITO             Andalucía | España | Internacional        (por PROVINCIA: provincias andaluzas / resto de provincias españolas / país)
 *   CON CLASIFICATORIO Sí | No | Sin dato                       (por CLASIFICATORIO: «Sí…», fecha o «online» → Sí; «No» → No; vacío → Sin dato)
 *   NIVELES            Elite, RX, Advance, Intermedio, Escalado, Rookie, Open, Máster, Teens  (por CATEGORÍAS + CATEGORÍAS CLASIFICATORIO)
 *   FORMATO            Individual, Parejas, Tríos, Equipos      (ídem)
 * Filtros (se combinan con Y; dentro de un mismo filtro de varias opciones, con O):
 *   fecha de la competi (desde/hasta, solapa con INICIO–FIN), fecha de inscripción (desde/hasta, FECHA INSCRIPCIÓN o APERTURA INSCRIPCIÓN),
 *   ámbito, clasificatorio, niveles, formato, texto libre, solo futuras, solo en seguimiento.
 */
var AND_PROV_ = ['ALMERIA', 'CADIZ', 'CORDOBA', 'GRANADA', 'HUELVA', 'JAEN', 'MALAGA', 'SEVILLA'];
var ESP_PROV_ = ['A CORUNA', 'CORUNA', 'LA CORUNA', 'ALAVA', 'ARABA', 'ALBACETE', 'ALICANTE', 'ALACANT', 'ASTURIAS', 'AVILA', 'BADAJOZ', 'BALEARES', 'ILLES BALEARS', 'ISLAS BALEARES', 'MALLORCA', 'IBIZA', 'MENORCA', 'BARCELONA', 'BIZKAIA', 'VIZCAYA', 'BURGOS', 'CACERES',
  'CANTABRIA', 'CASTELLON', 'CASTELLO', 'CEUTA', 'CIUDAD REAL', 'CUENCA', 'GIPUZKOA', 'GUIPUZCOA', 'GIRONA', 'GERONA', 'GUADALAJARA', 'HUESCA', 'LA RIOJA', 'RIOJA', 'LAS PALMAS', 'GRAN CANARIA', 'LANZAROTE', 'FUERTEVENTURA', 'LEON', 'LLEIDA', 'LERIDA', 'LUGO', 'MADRID', 'MELILLA', 'MURCIA',
  'NAVARRA', 'OURENSE', 'ORENSE', 'PALENCIA', 'PONTEVEDRA', 'SALAMANCA', 'SANTA CRUZ DE TENERIFE', 'TENERIFE', 'LA PALMA', 'SEGOVIA', 'SORIA', 'TARRAGONA', 'TERUEL', 'TOLEDO', 'VALENCIA', 'VALLADOLID', 'ZAMORA', 'ZARAGOZA', 'ESPANA'];
var NIVELES_RE_ = [['Elite', /\bELITE\b|\bELIT\b/], ['RX', /\bRX\b|\bREGULAR\b/], ['Advance', /\bADVANCED?\b|\bAVANZAD/], ['Intermedio', /\bINTER(MEDIO|MEDIATE)?\b/], ['Escalado', /\bESCALAD|\bSCALED?\b/],
  ['Rookie', /\bROOKIE\b|\bBEGINNER\b|\bPRINCIPIANTE|\bNOVATO|\bEXPERIENCE\b/], ['Open', /\bOPEN\b/], ['Máster', /\bMASTERS?\b|\bMASTER\b/], ['Teens', /\bTEENS?\b|\bUNDER\b|\bJUNIOR/]];
var FORMATOS_RE_ = [['Individual', /\bINDIVIDUAL|\bINDIVIDUALES/], ['Parejas', /\bPAREJA|\bBUDDY|\bDOUBLE\b|\bDUO\b|\bHF\b|\bHH\b|\bFF\b/], ['Tríos', /\bTRIO|\bEQUIPOS? DE 3|\bTEAM OF 3|\bHHF|\bHHH|\bFFF/], ['Equipos', /\bEQUIPO|\bTEAM/]];
function clasificarCompeti_(r) {
  var prov = norm(r.PROVINCIA || '').trim(), cat = norm((r['CATEGORÍAS'] || '') + ' ; ' + (r['CATEGORÍAS CLASIFICATORIO'] || '')), q = norm(r.CLASIFICATORIO || '').trim();
  var ambito = !prov ? 'Sin dato' : AND_PROV_.some(function (p) { return prov.indexOf(p) >= 0; }) ? 'Andalucía' : ESP_PROV_.some(function (p) { return prov === p || prov.indexOf(p) >= 0; }) ? 'España' : 'Internacional';
  var clasif = !q ? 'Sin dato' : /^NO\b/.test(q) ? 'No' : 'Sí';
  var niveles = NIVELES_RE_.filter(function (x) { return x[1].test(cat); }).map(function (x) { return x[0]; });
  var formatos = FORMATOS_RE_.filter(function (x) { return x[1].test(cat); }).map(function (x) { return x[0]; });
  return { 'ÁMBITO': ambito, 'CON CLASIFICATORIO': clasif, NIVELES: niveles.join(', '), FORMATO: formatos.join(', ') };
}
function fechaInscCompeti_(r) { return celdaIso_(r['FECHA INSCRIPCIÓN']) || celdaIso_(r['APERTURA INSCRIPCIÓN']) || ''; }
/** Mismo filtro en el servidor (Sheet) y en la app (menu.js · filtrarCompetis). f: { desde, hasta, insDesde, insHasta, ambito[], clasif[], niveles[], formatos[], texto, futuras, seguimiento } */
function filtrarCompetis_(lista, f) {
  f = f || {}; var hoy = hoyIso_();
  var en = function (v, l) { return !l || !l.length || String(v || '').split(/\s*,\s*/).some(function (x) { return l.indexOf(x) >= 0; }); };
  var tx = norm(f.texto || '').trim();
  return lista.filter(function (x) {
    var ini = celdaIso_(x.INICIO) || '', fin = celdaIso_(x.FIN) || ini, ins = fechaInscCompeti_(x);
    if (f.futuras && fin && fin < hoy) return false;
    if (f.seguimiento && x.SEGUIMIENTO !== 'Sí') return false;
    if (f.desde && (!fin || fin < f.desde)) return false;
    if (f.hasta && (!ini || ini > f.hasta)) return false;
    if (f.insDesde && (!ins || ins < f.insDesde)) return false;
    if (f.insHasta && (!ins || ins > f.insHasta)) return false;
    if (!en(x['ÁMBITO'], f.ambito) || !en(x['CON CLASIFICATORIO'], f.clasif) || !en(x.NIVELES, f.niveles) || !en(x.FORMATO, f.formatos)) return false;
    if (tx && norm([x.NOMBRE, x.CIUDAD, x.PROVINCIA, x['CATEGORÍAS'], x.NOTAS].join(' ')).indexOf(tx) < 0) return false;
    return true;
  });
}
// ---------- Sheet: pestaña «APP · COMPETIS» (Training Coverage) con panel de filtros ----------
var COMP_VISTA_ = 'APP · COMPETIS';
var COMP_FILTROS_ = ['COMPETI DESDE', 'COMPETI HASTA', 'INSCRIPCIÓN DESDE', 'INSCRIPCIÓN HASTA', 'ÁMBITO', 'CLASIFICATORIO', 'NIVEL', 'FORMATO', 'TEXTO', 'SOLO FUTURAS', 'SEGUIMIENTO', '↻ ACTUALIZAR'];
var COMP_COLS_ = ['NOMBRE', 'INICIO', 'FIN', 'CIUDAD', 'PROVINCIA', 'ÁMBITO', 'INSCRIPCIÓN', 'CON CLASIFICATORIO', 'CLASIFICATORIO', 'NIVELES', 'FORMATO', 'CATEGORÍAS', 'PRECIO', 'WEB', 'SEGUIMIENTO', 'ID'];
function filtroDesdeSheet_(sh) {
  var v = sh.getRange(4, 1, 1, COMP_FILTROS_.length).getValues()[0], lista = function (x) { return String(x || '').split(/\s*,\s*/).filter(function (y) { return y && !/^(TODAS?|TODOS)$/i.test(y); }); };
  return { desde: celdaIso_(v[0]) || '', hasta: celdaIso_(v[1]) || '', insDesde: celdaIso_(v[2]) || '', insHasta: celdaIso_(v[3]) || '', ambito: lista(v[4]), clasif: lista(v[5]), niveles: lista(v[6]), formatos: lista(v[7]), texto: String(v[8] || ''), futuras: v[9] === true, seguimiento: v[10] === true };
}
function pintarCompetisSheet_(f) {
  var ss = miLibro_(), sh = ss.getSheetByName(COMP_VISTA_), nueva = !sh;
  if (!sh) sh = ss.insertSheet(COMP_VISTA_);
  if (nueva || sh.getRange(3, 1).getValue() !== COMP_FILTROS_[0]) {
    sh.clear(); sh.getRange(1, 1).setValue('COMPETIS · copiadas de la app de Gabi (solo lectura) · filtra en la fila 4').setFontWeight('bold').setFontSize(13);
    sh.getRange(2, 1).setValue('Se combinan todos los filtros. En ÁMBITO, CLASIFICATORIO, NIVEL y FORMATO puedes poner varios separados por comas (ej. «Elite, RX»): vale cualquiera de ellos. Fechas en dd/mm/aaaa; vacío = sin límite. Marca ↻ ACTUALIZAR para copiar ahora de la app de Gabi.').setFontColor('#666666').setWrap(false);
    sh.getRange(3, 1, 1, COMP_FILTROS_.length).setValues([COMP_FILTROS_]).setFontWeight('bold').setBackground('#f59e0b').setFontColor('#ffffff');
    sh.getRange(4, 1, 1, COMP_FILTROS_.length).setValues([['', '', '', '', '', '', '', '', '', true, false, false]]).setBackground('#fff7e6');
    var dv = function (l) { return SpreadsheetApp.newDataValidation().requireValueInList(l, true).setAllowInvalid(true).build(); };
    sh.getRange(4, 1, 1, 4).setNumberFormat('dd/mm/yyyy').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
    sh.getRange(4, 5).setDataValidation(dv(['Todas', 'Andalucía', 'España', 'Internacional', 'Andalucía, España']));
    sh.getRange(4, 6).setDataValidation(dv(['Todas', 'Sí', 'No', 'Sin dato']));
    sh.getRange(4, 7).setDataValidation(dv(['Todos'].concat(NIVELES_RE_.map(function (x) { return x[0]; })).concat(['Elite, RX'])));
    sh.getRange(4, 8).setDataValidation(dv(['Todos'].concat(FORMATOS_RE_.map(function (x) { return x[0]; }))));
    sh.getRange(4, 10, 1, 3).insertCheckboxes();
    sh.setFrozenRows(6);
  }
  f = f || filtroDesdeSheet_(sh);
  var L = filtrarCompetis_(listaCompetis_(), f), cf = leerConfig_();
  var datos = L.map(function (x) { return COMP_COLS_.map(function (h) { return h === 'INSCRIPCIÓN' ? (fechaInscCompeti_(x) ? isoAFecha(fechaInscCompeti_(x)) : '') : String(x[h] == null ? '' : x[h]); }); });
  var ult = Math.max(sh.getLastRow(), 7); if (ult >= 6) sh.getRange(6, 1, ult - 5, Math.max(sh.getLastColumn(), COMP_COLS_.length)).clearContent().clearFormat();
  sh.getRange(5, 1).setValue(L.length + ' competis · última copia: ' + (cf.competis_copia || '—')).setFontColor('#666666');
  sh.getRange(6, 1, 1, COMP_COLS_.length).setValues([COMP_COLS_]).setFontWeight('bold').setBackground('#333333').setFontColor('#ffffff');
  if (datos.length) {
    sh.getRange(7, 1, datos.length, COMP_COLS_.length).setValues(datos).setWrap(true).setVerticalAlignment('top');
    var colA = COMP_COLS_.indexOf('ÁMBITO') + 1, bg = datos.map(function (d) { return [d[colA - 1] === 'Andalucía' ? '#e6f4ea' : d[colA - 1] === 'España' ? '#fff4e5' : '#eef2ff']; });
    sh.getRange(7, colA, datos.length, 1).setBackgrounds(bg);
    sh.getRange(7, 1, datos.length, 1).setFontWeight('bold');
  }
  [240, 90, 90, 130, 110, 100, 100, 90, 140, 170, 140, 240, 160, 200, 90, 80].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  return L.length;
}
function editarCompetisSheet_(e) {
  var sh = e.range.getSheet(), f = e.range.getRow(), c = e.range.getColumn();
  if (f !== 4) return;
  if (c === 12 && e.range.getValue() === true) {
    SpreadsheetApp.getActive().toast('Copiando de la app de Gabi…', 'Road To Elite', 5);
    var n = copiarCompetis_(); sh.getRange(4, 12).setValue(false);
    SpreadsheetApp.getActive().toast(n + ' nuevas · ' + (leerConfig_().competis_copia || ''), 'Road To Elite', 5);
  }
  MEMO = null; pintarCompetisSheet_();
}
function menuCompetis() { var n = copiarCompetis_(); MEMO = null; var k = pintarCompetisSheet_(); var sh = miLibro_().getSheetByName(COMP_VISTA_); if (sh) miLibro_().setActiveSheet(sh); SpreadsheetApp.getUi().alert('Competis copiadas de la app de Gabi: ' + n + ' nuevas.\n' + (leerConfig_().competis_copia || '') + '\n\nEn «' + COMP_VISTA_ + '» se ven ' + k + ' con los filtros actuales.'); }
function competisLunes() { return conSalud_('competisLunes', competisLunes_sin_); }
function competisLunes_sin_() { try { copiarCompetis_(); } catch (e) { Logger.log('Competis: ' + e); } }
function listaCompetis_() {
  var hoy = hoyIso_();
  return listar_(HOJAS.COMPETIS).filter(function (r) { return r.NOMBRE; }).map(function (r) {
    var o = {}; ESQ_BD_[HOJAS.COMPETIS].cab.forEach(function (h) { o[h] = r[h] == null ? '' : String(r[h]); }); o._iso = celdaIso_(r.INICIO) || '';
    if (!o['ÁMBITO']) Object.assign(o, clasificarCompeti_(o));
    o._fin = celdaIso_(r.FIN) || o._iso; o._ins = fechaInscCompeti_(r); o._pasada = !!o._iso && (celdaIso_(r.FIN) || o._iso) < hoy; return o;
  }).sort(function (a, b) { return (a._iso || '9999') < (b._iso || '9999') ? -1 : 1; });
}
/** Seguimiento de una competi en Google Calendar: competi + inscripción + clasificatorio (eventos de día completo, marcados [Road To Elite]). */
function seguirCompeti_(b) {
  var r = listar_(HOJAS.COMPETIS).filter(function (x) { return x.ID === String(b.id || ''); })[0];
  if (!r) throw new Error('competi_no_encontrada');
  borrarCalCompeti_(r);
  if (!b.seguir) { actualizarFila_(HOJAS.COMPETIS, r._fila, { SEGUIMIENTO: 'No', GCAL: '', 'INSCRIPCIÓN': '', 'CLASIFICATORIO (hecho)': '' }); return { ok: true }; }
  var fi = celdaIso_(b.inscripcion || r['FECHA INSCRIPCIÓN']), fc = celdaIso_(b.clasificatorio || r['FECHA CLASIFICATORIO']), ini = celdaIso_(r.INICIO), fin = celdaIso_(r.FIN) || ini;
  var cal = calendario_(), ids = [], lugar = [r.CIUDAD, r.PROVINCIA].filter(Boolean).join(', ');
  var desc = MARCA_CAL + ' competi ' + r.ID + '\n' + [r['CATEGORÍAS'], r.PRECIO, r.WEB || r.WODBUSTER || r.INSTAGRAM, r.NOTAS].filter(Boolean).join('\n');
  var dia = function (iso) { return new Date(iso + 'T12:00:00Z'); };
  if (ini) ids.push('C:' + cal.createAllDayEvent('🏆 ' + r.NOMBRE, dia(ini), dia(sumarDias(fin, 1)), { description: desc, location: lugar }).getId());
  if (fi) ids.push('I:' + cal.createAllDayEvent('📝 Inscripción · ' + r.NOMBRE, dia(fi), { description: desc + '\n\nAbre la inscripción: ' + (r.WODBUSTER || r.WEB || '') }).getId());
  if (fc) ids.push('Q:' + cal.createAllDayEvent('🎯 Clasificatorio · ' + r.NOMBRE, dia(fc), { description: desc + '\n\nClasificatorio: ' + (r.CLASIFICATORIO || '') + (r['CATEGORÍAS CLASIFICATORIO'] ? ' (' + r['CATEGORÍAS CLASIFICATORIO'] + ')' : '') }).getId());
  actualizarFila_(HOJAS.COMPETIS, r._fila, { SEGUIMIENTO: 'Sí', 'FECHA INSCRIPCIÓN': fi ? isoAFecha(fi) : '', 'FECHA CLASIFICATORIO': fc ? isoAFecha(fc) : '', 'INSCRIPCIÓN': fi ? 'Pendiente' : '', 'CLASIFICATORIO (hecho)': fc ? 'Pendiente' : '', GCAL: ids.join('|') });
  return { ok: true, eventos: ids.length };
}
function borrarCalCompeti_(r) {
  String(r.GCAL || '').split('|').filter(Boolean).forEach(function (x) { try { var ev = calendario_().getEventById(x.slice(2)); if (ev) ev.deleteEvent(); } catch (e) { Logger.log('Calendar competi: ' + e); } });
}
/** Respuesta a «¿te has inscrito? / ¿has hecho el clasificatorio?». No → fuera del calendario y del seguimiento. */
function responderCompeti_(b) {
  var r = listar_(HOJAS.COMPETIS).filter(function (x) { return x.ID === String(b.id || ''); })[0];
  if (!r) throw new Error('competi_no_encontrada');
  if (!b.hecho) { borrarCalCompeti_(r); actualizarFila_(HOJAS.COMPETIS, r._fila, { SEGUIMIENTO: 'No', GCAL: '', 'INSCRIPCIÓN': b.que === 'inscripcion' ? 'No' : r['INSCRIPCIÓN'], 'CLASIFICATORIO (hecho)': b.que === 'clasificatorio' ? 'No' : r['CLASIFICATORIO (hecho)'] }); return { ok: true, quitada: true }; }
  var o = {}; if (b.que === 'inscripcion') o['INSCRIPCIÓN'] = 'Hecha'; else o['CLASIFICATORIO (hecho)'] = 'Hecho';
  actualizarFila_(HOJAS.COMPETIS, r._fila, o);
  return { ok: true };
}
/** Preguntas pendientes: seguidas cuya fecha de inscripción o de clasificatorio ya ha llegado y aún no se ha contestado. */
function preguntasCompetis_() {
  var hoy = hoyIso_(), out = [];
  try {
    listar_(HOJAS.COMPETIS).filter(function (r) { return r.SEGUIMIENTO === 'Sí'; }).forEach(function (r) {
      var fi = celdaIso_(r['FECHA INSCRIPCIÓN']), fc = celdaIso_(r['FECHA CLASIFICATORIO']);
      if (fi && fi <= hoy && r['INSCRIPCIÓN'] === 'Pendiente') out.push({ id: r.ID, que: 'inscripcion', nombre: r.NOMBRE, fecha: r['FECHA INSCRIPCIÓN'], texto: '¿Te has inscrito en ' + r.NOMBRE + '?' });
      if (fc && fc <= hoy && r['CLASIFICATORIO (hecho)'] === 'Pendiente') out.push({ id: r.ID, que: 'clasificatorio', nombre: r.NOMBRE, fecha: r['FECHA CLASIFICATORIO'], texto: '¿Has hecho el clasificatorio de ' + r.NOMBRE + '?' });
    });
  } catch (e) {}
  return out;
}
/** Aviso por correo (una vez por pregunta) cuando llega la fecha. */
function avisarCompetis_() {
  preguntasCompetis_().forEach(function (q) {
    var k = 'COMPETI_AVISO_' + q.id + '_' + q.que; if (PROPS.getProperty(k)) return;
    try { MailApp.sendEmail({ to: CONFIG.EMAIL_PERMITIDO, name: 'Road To Elite', subject: q.texto, htmlBody: '<p>' + esc_(q.texto) + ' (fecha: ' + esc_(q.fecha) + ')</p><p>Contéstalo en la app: si es «No», se quita del calendario y del seguimiento.</p><p><a href="' + CONFIG.URL_APP + '">Abrir Road To Elite</a></p>' }); PROPS.setProperty(k, hoyIso_()); } catch (e) { Logger.log('Aviso competi: ' + e); }
  });
}

// Copia de MOTOR_GUIA.md (docs/MOTOR_GUIA.md del repositorio): se usa si la de Drive no se puede leer y para crearla la primera vez.
var MOTOR_GUIA_BASE_ = "# MOTOR_GUIA · Road To Elite\n\n> **09/11/2026 · cambios de archivos:** el libro «Road to Elite · Motor WODs» se llama ahora **«Road to Elite · Motor»** (mismo ID, `1qsbxCXhTF-K-9reEBTwjqMJ4TnKUx0QadfhbJ0t8PPU`; hace más funciones que los WODs). La **Base de datos Vídeos** está ahora en 2DO CEREBRO › CROSSFIT › APP (mismo ID); la app de Gabi trabaja con su DICCIONARIO y copia allí los martes lo que falte.\n\nGuía que sigue el motor que genera los entrenamientos (metcons a medida, mega WOD, extras con «Estímulos que quiero»).\n\n- **Las tablas `## TABLA · …` las lee el servidor de verdad.** Si cambias una fila, cambia lo que genera el motor, sin tocar código.\n  - Mantén las columnas y el formato `| a | b |`.\n  - Los alias van separados por comas, en mayúsculas o minúsculas (da igual) y sin tildes obligatorias.\n  - Una fila que empieza por `#` se ignora.\n- **El texto de «Claves» lo leemos Claude y Gemini** para diseñar, revisar y explicar.\n- La copia de trabajo vive en Google Drive (`MOTOR_GUIA.md`, junto a los backups). El servidor la relee cada 6 h o al ejecutar `configurar`.\n- Fuentes:\n  - `Rendimiento_Hibrido_GuiaDefinitiva_md.md` (manual v2.0);\n  - las notas de coach de Fabrik: MODALIDAD, OBJETIVO, LIMITANTES;\n  - las claves de CrossFit acordadas en el proyecto «Road To Elite».\n\n## TABLA · FORMATOS\n\n| CLAVE | NOMBRE | MIN | MAX | VENTANA | SISTEMA | ZONA | RPE | REPS x | CUÁNDO | ESTRATEGIA |\n|---|---|---|---|---|---|---|---|---|---|---|\n| SPRINT | For time corto | 3 | 8 | cap | glucolítico | Z6–Z7 | 9 | 0.8 | Sprint de competición, 2–3 movimientos, cargas medias | Salida fuerte; tandas grandes desde el principio; transiciones de menos de 3″ |\n| AMRAP_C | AMRAP corto | 6 | 10 | continuo | glucolítico | Z5–Z6 | 8–9 | 1 | Potencia con fatiga, pocas transiciones | 85–90 % desde la ronda 1 y tandas fijas |\n| AMRAP | AMRAP medio | 11 | 20 | continuo | mixto (umbral) | Z4–Z5 | 7–8 | 1.2 | Ritmo sostenido con interferencia | Ronda 1 al 80 %; mira el tiempo por ronda y no lo dejes caer más de un 10 % |\n| AMRAP_L | AMRAP largo | 21 | 40 | continuo | aeróbico | Z3 | 6–7 | 1.4 | Capacidad aeróbica, movimientos de baja demanda técnica | Sin picos; misma carrera o erg por ronda (como pide Fabrik) |\n| FOR_TIME | For time con cap | 8 | 20 | cap | mixto | Z4–Z6 | 8 | 1.2 | Gestión de WOD, chipper corto o rondas | No te vayas en el primer tercio; acelera en el último |\n| CHIPPER | Chipper | 15 | 30 | cap | mixto-aeróbico | Z3–Z5 | 7–8 | 1.5 | Muchos apartados; administrar para llegar con energía al final | Cada apartado al 75–80 %; el último es el que suma |\n| ESCALERA | 21-15-9 / ascendente | 6 | 15 | cap | glucolítico | Z5–Z6 | 8–9 | 1 | Movimientos de la misma familia con interferencia directa | Rompe antes del fallo: 21 = 12+9, 15 = 8+7, 9 = seguidas |\n| EMOM | EMOM | 10 | 30 | 60″ | mixto | Z4–Z5 | 7–8 | 0.5 | Densidad y calidad técnica en fatiga; alterna minutos | Trabajo de 35–45″ y descanso de 15–25″; si pasas de 50″, baja reps |\n| EVERY | Every 3–4′ (P1) | 12 | 30 | 3–4′ (60–90″ ON) | potencia con fatiga | Z6–Z8 | 9 | 0.7 | Potencia con fatiga: series al 90 % con recuperación casi completa | Cada serie al 90 %; si la caída pasa del 10 %, para |\n| INTERVALOS | Trabajo:descanso | 12 | 30 | 2:1 · 1:1 · 1:2 | umbral / VO₂ | Z5–Z7 | 8–9 | 0.7 | Ergos + gimnásticos; P4 umbral/pico | Mismo ritmo en todas las series; la última igual que la primera |\n| VENTANAS | Heavy en ventanas | 10 | 20 | E2–3′ | fuerza en fatiga | — | 8–9 | 0.4 | Halterofilia o fuerza pesada tras erg o gimnásticos | Ventana 1 ligera, ventana 2 exigente (estilo Fabrik); calidad antes que velocidad |\n| SINCRO | Pareja o equipo | 15 | 60 | variable | mixto | Z4–Z6 | 8 | 1.6 | Mega WOD o equipo | Reparto por fuerzas; el más fuerte en el movimiento limitante |\n\n## TABLA · MOVIMIENTOS\n\n`PATRÓN`:\n- OLY = olímpico\n- OH = empuje vertical / por encima de la cabeza\n- SENT = sentadilla\n- BISAGRA\n- TIRON = tirón gimnástico\n- EMPUJE_G = empuje gimnástico\n- SALTO\n- MONO = erg o carrera\n- CORE\n- ACARREO\n- CUERPO = peso corporal\n\n`CARGA` (etiquetas del motor): PIERNA · HOMBRO · AGARRE · CORE · IMPACTO · SNC · GLUC · AERO.\n\n`1RM DE`: la marca de APP · MARCAS de la que sale el peso, con su factor, por ejemplo «FRONT SQUAT 0.8». Si no tienes esa marca, se usa KG ♂ RX.\n\n| CLAVE | NOMBRE | ALIAS | MATERIAL | ALTERNATIVA | PATRÓN | CARGA | UNIDAD | REPS | KG ♂ RX | KG ♀ RX | 1RM DE | CÓDIGO |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n| THRUSTER | THRUSTERS | thruster, thrusters | barra | db | OH | PIERNA, HOMBRO, GLUC | reps | 12 | 43 | 29 | FRONT SQUAT 0.75 | T02 |\n| STOH | SHOULDER TO OVERHEAD | stoh, s2oh, shoulder to overhead, push press, push jerk, jerk | barra | db | OH | HOMBRO | reps | 12 | 61 | 43 | PUSH JERK 1 | M07 |\n| SNATCH | POWER SNATCH | snatch, power snatch, arrancada | barra | db | OLY | SNC, HOMBRO, PIERNA | reps | 8 | 43 | 29 | SNATCH 1 | |\n| SQ_SNATCH | SQUAT SNATCH | squat snatch | barra | db | OLY | SNC, HOMBRO, PIERNA | reps | 6 | 43 | 29 | SNATCH 1 | |\n| HANG_SN | HANG POWER SNATCH | hang snatch, hang power snatch | barra | db | OLY | SNC, HOMBRO | reps | 8 | 43 | 29 | SNATCH 1 | C04 |\n| OHS | OVERHEAD SQUAT | ohs, overhead squat | barra | db | OH | HOMBRO, PIERNA, CORE | reps | 10 | 43 | 29 | SNATCH 1 | |\n| DB_SNATCH | DB SNATCH (alternos) | db snatch, dumbbell snatch | db | kb | OLY | HOMBRO, GLUC | reps | 16 | 22.5 | 15 | | |\n| DB_C2OH | DB HANG CLEAN TO OVERHEAD | c2oh, clean to overhead, db hang clean to overhead | db | kb | OH | HOMBRO, PIERNA | reps | 12 | 22.5 | 15 | | |\n| OH_LUNGE | DB OVERHEAD WALKING LUNGE | oh lunge, overhead lunge, lunge oh | db | sandbag | OH | HOMBRO, PIERNA, CORE | m | 15 | 22.5 | 15 | | |\n| CLEAN | POWER CLEAN | clean, power clean, cargada | barra | db | OLY | SNC, PIERNA, AGARRE | reps | 10 | 61 | 43 | CLEAN 1 | |\n| SQ_CLEAN | SQUAT CLEAN | squat clean | barra | db | OLY | SNC, PIERNA | reps | 8 | 61 | 43 | CLEAN 1 | |\n| HANG_CL | HANG POWER CLEAN | hang clean, hang power clean | barra | db | OLY | SNC, AGARRE | reps | 10 | 61 | 43 | CLEAN 1 | C04 |\n| FRONT_SQ | FRONT SQUAT | front squat | barra | db | SENT | PIERNA, CORE | reps | 12 | 61 | 43 | FRONT SQUAT 1 | C02 |\n| DEADLIFT | DEADLIFT | deadlift, peso muerto | barra | kb | BISAGRA | PIERNA, AGARRE, CORE | reps | 10 | 102 | 70 | DEADLIFT 1 | |\n| WALLBALL | WALL BALLS | wall ball, wallball, wall balls | slamball | | OH | PIERNA, HOMBRO, GLUC | reps | 20 | 9 | 6 | | |\n| DU | DOUBLE UNDERS | du, dus, double under, double unders, comba | comba | | SALTO | IMPACTO, GLUC | reps | 50 | | | | C01 |\n| BURPEE | BURPEES | burpee, burpees | | | CUERPO | GLUC, IMPACTO | reps | 12 | | | | C03 |\n| BOB | BURPEES OVER THE BAR | burpee over the bar, bar facing burpee, bfb | barra | | CUERPO | GLUC, IMPACTO | reps | 12 | | | | C03 |\n| LAT_BURPEE | LATERAL BURPEES OVER DB | lateral burpee, burpee over db | db | | CUERPO | GLUC, IMPACTO | reps | 12 | | | | C03 |\n| BJO | BOX JUMP OVERS | box jump, box jump over, bjo, cajon | cajon | | SALTO | PIERNA, IMPACTO | reps | 12 | | | | W07 |\n| C2B | CHEST TO BAR | c2b, chest to bar | rack_dominadas | | TIRON | AGARRE, HOMBRO | reps | 12 | | | | M01 |\n| PULLUP | PULL-UPS | pull up, pull-up, dominadas | rack_dominadas | | TIRON | AGARRE | reps | 15 | | | | |\n| T2B | TOES TO BAR | t2b, toes to bar | rack_dominadas | | CORE | AGARRE, CORE | reps | 15 | | | | |\n| BMU | BAR MUSCLE UPS | bmu, bar muscle up | bmu | | TIRON | AGARRE, HOMBRO, SNC | reps | 6 | | | | M48 |\n| RMU | RING MUSCLE UPS | rmu, ring muscle up | anillas | | TIRON | AGARRE, HOMBRO, SNC | reps | 5 | | | | M49 |\n| HSPU | HSPU | hspu, handstand push up, pino flexion | hspu | | EMPUJE_G | HOMBRO | reps | 10 | | | | W31 |\n| HSWALK | HANDSTAND WALK | hs walk, handstand walk, pino andando | hspu | | EMPUJE_G | HOMBRO, CORE | m | 15 | | | | |\n| WALLWALK | WALL WALKS | wall walk | hspu | | EMPUJE_G | HOMBRO, CORE | reps | 5 | | | | |\n| ROPE | ROPE CLIMBS | rope, rope climb, cuerda | cuerda | | TIRON | AGARRE | reps | 3 | | | | M36 |\n| GHD | GHD SIT-UPS | ghd | box | | CORE | CORE | reps | 15 | | | | |\n| KBS | KB SWINGS | kb swing, kettlebell swing, swing | kb | db | BISAGRA | AGARRE, GLUC | reps | 20 | 24 | 16 | | |\n| DEVIL | DEVIL PRESS | devil press | db | | OLY | HOMBRO, GLUC | reps | 10 | 22.5 | 15 | | |\n| SANDBAG | SANDBAG CLEANS | sandbag, sandbag clean | sandbag | | OLY | PIERNA, CORE | reps | 10 | 70 | 45 | | M57 |\n| SB_LUNGE | SANDBAG LUNGES | sandbag lunge, lunges hyrox | sandbag_hyrox | db | SENT | PIERNA | m | 20 | 20 | 10 | | |\n| LUNGE | DB WALKING LUNGES | lunge, lunges, zancadas | db | | SENT | PIERNA | reps | 16 | 22.5 | 15 | | |\n| SLED | SLED PUSH 15 m | sled, trineo | trineo | | ACARREO | PIERNA, GLUC | reps | 2 | | | | M38 |\n| FARMER | FARMER CARRY | farmer, farmers carry | db | kb | ACARREO | AGARRE, CORE | m | 40 | 32 | 24 | | |\n| GUSANO | WORM CLEANS + CARRY 20 m | gusano, worm | gusano | | ACARREO | PIERNA, CORE | reps | 6 | | | | |\n| LODGE | SANDBAG OVER LODGE | lodge, over the wall | lodge_lanzar | | OLY | PIERNA, HOMBRO | reps | 8 | | | | M57 |\n| LODGE_JUMP | JUMP OVER LODGE | jump over lodge, jump over | lodge_saltar | | SALTO | PIERNA, IMPACTO | reps | 10 | | | | W07 |\n| ROW | ROW | row, remo, rower | ergos | | MONO | AERO, GLUC | cal | 15 | | | | |\n| SKI | SKIERG | ski, skierg | ergos | | MONO | AERO, HOMBRO | cal | 15 | | | | |\n| ASSAULT | ASSAULT BIKE | assault, air bike, airbike, echo, assault bike | ergos | | MONO | AERO, GLUC, PIERNA | cal | 15 | | | | |\n| BIKE | BIKE ERG | bike erg, bikeerg | ergos | | MONO | AERO, PIERNA | cal | 20 | | | | |\n| RUN | RUN | run, carrera, correr, running | _correr | | MONO | AERO, IMPACTO | m | 400 | | | | |\n| AIR_SQ | AIR SQUATS | air squat, air squats, sentadilla libre | | | SENT | PIERNA | reps | 25 | | | | M54 |\n| PUSHUP | PUSH-UPS | push up, push-ups, pushups, flexiones | | | EMPUJE_G | HOMBRO | reps | 15 | | | | |\n| PIKE_PU | PIKE PUSH-UPS (pies elevados) | pike push up, pike push-ups | | | EMPUJE_G | HOMBRO | reps | 10 | | | | M53 |\n| PISTOL | PISTOLS (alternas) | pistol, pistols, pistol squat | | | SENT | PIERNA, CORE | reps | 10 | | | | M19 |\n| BW_LUNGE | WALKING LUNGES (sin carga) | zancadas sin carga, walking lunges sin carga | | | SENT | PIERNA | reps | 24 | | | | |\n| JUMP_LUNGE | JUMPING LUNGES | jumping lunge, jumping lunges, zancadas con salto | | | SALTO | PIERNA, IMPACTO | reps | 20 | | | | W07 |\n| BROAD_JUMP | BROAD JUMPS | broad jump, broad jumps, salto horizontal | | | SALTO | PIERNA, IMPACTO | reps | 8 | | | | W07 |\n| TUCK_JUMP | TUCK JUMPS | tuck jump, tuck jumps | | | SALTO | PIERNA, IMPACTO | reps | 10 | | | | W07 |\n| BURPEE_BJ | BURPEE BROAD JUMPS | burpee broad jump, burpee broad jumps | | | CUERPO | GLUC, IMPACTO, PIERNA | reps | 10 | | | | C03 |\n| SITUP | SIT-UPS (AbMat) | sit up, sit-ups, situps, abmat | | | CORE | CORE | reps | 20 | | | | |\n| VUP | V-UPS | v-up, v-ups, vups | | | CORE | CORE | reps | 15 | | | | M08 |\n| HOLLOW | HOLLOW ROCKS | hollow rock, hollow rocks | | | CORE | CORE | reps | 20 | | | | M08 |\n| COPEN | COPENHAGEN PLANK (por lado, segundos = reps) | copenhagen, copenhague | | | CORE | CORE, PIERNA | reps | 20 | | | | M46 |\n| DIPS | DIPS | dip, dips, fondos | fondos | anillas | EMPUJE_G | HOMBRO | reps | 12 | | | | M53 |\n| BACK_SQ | BACK SQUAT | back squat | barra | db | SENT | PIERNA, CORE | reps | 8 | 100 | 70 | BACK SQUAT 1 | |\n| STRICT_PR | STRICT PRESS | strict press, shoulder press, press militar | barra | db | OH | HOMBRO | reps | 8 | 60 | 40 | STRICT PRESS 1 | M53 |\n| PUSH_PR | PUSH PRESS | push press | barra | db | OH | HOMBRO, PIERNA | reps | 10 | 60 | 40 | PUSH PRESS 1 | M55 |\n| BENCH | BENCH PRESS | bench press, press banca | barra | db | EMPUJE_G | HOMBRO | reps | 8 | 90 | 50 | BENCH PRESS 1 | |\n| BULGARIAN | BULGARIAN SPLIT SQUAT (por pierna) | bulgarian, bulgarian split squat, sentadilla bulgara, split squat | db | kb | SENT | PIERNA | reps | 10 | 22.5 | 15 | | M45 |\n| HIP_THRUST | HIP THRUST | hip thrust | barra | db | BISAGRA | PIERNA, GLUC | reps | 10 | 100 | 70 | | M28 |\n| SG_DL | SNATCH GRIP DEADLIFT | snatch grip deadlift, sg dl | barra | | BISAGRA | PIERNA, AGARRE | reps | 6 | 100 | 70 | DEADLIFT 0.7 | M47 |\n| WEIGHTED_PU | WEIGHTED PULL-UPS (chaleco o DB) | weighted pull up, dominada lastrada | rack_dominadas | | TIRON | AGARRE | reps | 5 | | | | |\n\n## TABLA · PATRONES\n\nPalabras sueltas del campo «Estímulos que quiero» que no nombran un movimiento sino una familia. El motor añade el movimiento de esa familia que más falta (según APP · METAS) y que tu material permite.\n\n| PALABRA | PATRÓN | CARGA |\n|---|---|---|\n| oh, overhead, por encima | OH | HOMBRO |\n| empuje, push | OH | HOMBRO |\n| tiron, pull, gimnasticos | TIRON | AGARRE |\n| agarre, grip | TIRON | AGARRE |\n| pierna, legs | SENT | PIERNA |\n| bisagra, cadena posterior | BISAGRA | PIERNA |\n| halterofilia, oly, olimpico | OLY | SNC |\n| saltos, salto, plio | SALTO | IMPACTO |\n| core, abdomen | CORE | CORE |\n| acarreo, carry | ACARREO | AGARRE |\n| erg, ergos, monoestructural | MONO | AERO |\n\n## TABLA · INTERFERENCIAS\n\n- `A` y `B`: CLAVE de movimiento o PATRÓN; `*` = cualquiera.\n- `TIPO`:\n  - `buscada`: el motor los pone seguidos en ese orden porque es la interferencia de competición que se quiere entrenar;\n  - `complementaria`: alternarlos da densidad sin que uno limite al otro;\n  - `evitar`: no los pone seguidos salvo que lo pidas.\n- `ORDEN`: `A>B` (A antes que B) o `A<>B` (da igual).\n\n| A | B | TIPO | ORDEN | EFECTO BUSCADO | CIENCIA |\n|---|---|---|---|---|---|\n| RUN | THRUSTER | buscada | A>B | Correr y llegar a la barra con cuádriceps pre-fatigado y la respiración alta, como en competición e HYROX | Tras la carrera el lactato y la ventilación están altos: el thruster exige estabilizar el tronco con alta demanda respiratoria. Entrena el aclarado de H⁺ en el músculo que sigue trabajando y la eficiencia del bracing con hiperventilación. |\n| ASSAULT | OH | buscada | A>B | Estabilidad de hombro y core por encima de la cabeza con la frecuencia cardiaca muy alta | La air bike recluta piernas y brazos a la vez y dispara la FC y el CO₂. Bloquear por encima de la cabeza así obliga al control motor (manguito, serrato, core) a funcionar con fatiga sistémica: es lo que limita en competición. |\n| ASSAULT | SQ_SNATCH | buscada | A>B | Squat snatch bajo interferencia directa de la air bike (objetivo literal de Fabrik) | La precisión del segundo tirón y la recepción profunda se degradan con fatiga cardiorrespiratoria. Practicarlo con cargas medias consolida el patrón (aprendizaje motor en fatiga) sin el riesgo de hacerlo pesado. |\n| ASSAULT | BMU | buscada | A>B | BMU con fatiga cardiorrespiratoria (Fabrik) | El kipping depende del timing; con FC alta se pierde coordinación. Entrenarlo así mejora la economía del gesto cuando importa. |\n| DU | THRUSTER | buscada | A<>B | Limitante respiratorio alto (Fabrik: «thruster + DU») | Los DU mantienen la FC alta con bajo coste muscular. El thruster suma carga de pierna y hombro, y entre los dos fuerzan la tolerancia ventilatoria. |\n| RUN | T2B | buscada | A>B | Sostener eficiencia de T2B tras la carrera; usar la carrera para bajar pulsaciones (Fabrik) | Pacing estratégico: regular la intensidad de la carrera para llegar al gimnástico limitante con FC más baja. Aprende a usar lo monoestructural como recuperación activa. |\n| ROW | WALLBALL | buscada | A>B | Erg sostenido y después un movimiento de baja demanda coordinativa (Fabrik) | Tras el remo el gasto cardiaco sigue alto. El wall ball, poco técnico, permite seguir en umbral sin que la técnica limite: estímulo aeróbico-glucolítico sostenido. |\n| BURPEE | BJO | buscada | A<>B | Gestión de WOD: llegar con energía al apartado final (burpee box jump over, Fabrik) | Combina impacto y extensión de cadera con alta demanda metabólica. Administrar los apartados previos entrena la distribución de esfuerzo (pacing). |\n| MONO | VENTANAS | buscada | A>B | Fuerza o heavy en fatiga: levantar pesado después del erg | Tras un esfuerzo glucolítico la fosfocreatina está parcialmente vaciada. Levantar pesado así entrena la expresión de fuerza con fatiga metabólica (PAPE limitado; el estímulo es la tolerancia). |\n| SKI | C2B | buscada | A>B | Limitante de hombro y dorsal: tirón doble (Fabrik: C2B + ski) | Los dos tiran con dorsal y tríceps largo: la fatiga local se acumula y obliga a romper series. Útil si la meta es resistencia de tirón. |\n| OH | TIRON | complementaria | A<>B | Densidad: empuje vertical y tirón alternos (Fran, 24.3) | Agonistas y antagonistas alternos: mientras uno trabaja el otro se recupera. Más trabajo total por minuto con menos fallo local. |\n| T2B | OH | complementaria | A<>B | Core flexor y empuje vertical alternos | Patrones distintos: permiten densidad sin solapar fatiga local. |\n| LUNGE | RUN | buscada | A>B | Transición de pierna estilo HYROX | Las zancadas fatigan cuádriceps y glúteo excéntricamente, y la carrera posterior exige economía con el músculo fatigado (específico de HYROX). |\n| SLED | RUN | buscada | A>B | Sled y después carrera (HYROX) | El trineo es concéntrico pesado con alta demanda glucolítica. Correr después entrena el «compromised running». |\n| SANDBAG | RUN | buscada | A<>B | Carga incómoda y carrera | La carga asimétrica pide core y respiración contra presión intraabdominal; la carrera exige recuperarse en movimiento. |\n| C2B | T2B | evitar | A<>B | Doble agarre seguido | Los flexores del antebrazo se fatigan y caen las dos series. Solo si quieres resistencia de agarre (escribe «agarre»). |\n| PULLUP | T2B | evitar | A<>B | Doble agarre seguido | Igual que arriba. |\n| DEADLIFT | ROW | evitar | A<>B | Cadena posterior y lumbar doble en volumen | El erector espinal acumula fatiga y la técnica del peso muerto se resiente. Sepáralos con otro movimiento. |\n| WALLBALL | THRUSTER | evitar | A<>B | Mismo patrón seguido (sentadilla + empuje) | Mono-fatiga: limita el volumen total sin un estímulo nuevo. Solo si buscas «pierna/hombro» al límite. |\n| HSPU | STOH | evitar | A<>B | Doble empuje vertical | El tríceps y el deltoides anterior fallan pronto; si se busca, que sea con reps bajas. |\n| OLY | BURPEE | buscada | A<>B | Halterofilia con pulsaciones altas | Mantener la técnica de la barra con FC alta: interferencia típica de los WODs de competición en la fase de realización. |\n\n## TABLA · PESOS\n\nRango de carga en % del 1RM según el formato. El motor usa la marca del ejercicio (o la de `1RM DE`) y redondea a 2,5 kg.\n\n| FORMATO | % MIN | % MAX | NOTA |\n|---|---|---|---|\n| SPRINT | 60 | 75 | Cargas medias que permitan tandas grandes |\n| AMRAP_C | 55 | 70 | |\n| AMRAP | 45 | 60 | |\n| AMRAP_L | 35 | 50 | Barra ligera: no es el objetivo (Fabrik: «no buscamos una barra exigente») |\n| FOR_TIME | 50 | 65 | |\n| CHIPPER | 40 | 55 | |\n| ESCALERA | 55 | 70 | |\n| EMOM | 55 | 70 | |\n| EVERY | 60 | 75 | P1: cargas que permitan el 90 % de intensidad |\n| INTERVALOS | 45 | 60 | |\n| VENTANAS | 75 | 88 | Ventana 1 al mínimo y ventana 2 al máximo |\n| SINCRO | 45 | 60 | Equipo: −10–15 % frente a individual |\n\n## TABLA · REGLAS\n\n| CLAVE | VALOR | EXPLICACIÓN |\n|---|---|---|\n| max_movs | 4 | Movimientos por parte (con el erg incluido) |\n| transicion_min | 2 | Minutos de transición entre partes del mega WOD |\n| erg_cada_ronda | 1 | Con «intercalar X», X va entre todas las rondas |\n| min_metcon | 12 | Minutos por defecto de un metcon a medida si no los pones |\n| max_metcon | 40 | Tope de minutos de un metcon a medida |\n| sesiones_duras_48h | 1 | Las sesiones duras (P1–P4, metcon RPE ≥8) se separan 48 h |\n| tope_compensacion | 40 | % máximo de volumen extra al compensar |\n| reps_equipo | 0.75 | Factor de reps por atleta en pareja o equipo |\n\n## Claves de CrossFit (Road To Elite)\n\n- **Interferencia con intención:** Fabrik programa la interferencia como objetivo, por ejemplo:\n  - «squat snatch bajo interferencia directa de air bike»;\n  - «BMU bajo fatiga cardiorrespiratoria»;\n  - «T2B bajo fatiga tras la carrera».\n\n  El motor debe reproducir ese tipo de pares, no evitarlos, cuando el objetivo es competir.\n- **Fichas de Fabrik:** cada metcon trae\n  - WOD MATERIAL, INTENSIDAD (RPE) y CARGA;\n  - MODALIDAD y MODALIDAD WOD;\n  - OBJETIVO;\n  - LIMITANTE muscular, técnico, respiratorio y estratégico.\n\n  Son la etiqueta de cada WOD en `MOTOR · ANÁLISIS («Road to Elite · Motor»)` y lo que el motor imita.\n- **«Respeta %»:**\n  - la carga media es media;\n  - en metcon largo, la barra no debe ser lo que determine el WOD;\n  - en ventanas, la 1 ligera y la 2 exigente.\n- **Pacing:** empezar exigente pero repetible; registrar si la caída viene del aire, el agarre, el hombro o las transiciones (manual §6.4).\n- **Realización (semanas 9–12):**\n  - interferencia máxima;\n  - gimnásticos y barra con pulsaciones altas;\n  - erg mezclado con barra y gimnásticos;\n  - heavys aislados y en metcon;\n  - accesorios en mantenimiento.\n- **Z6–Z8 (P1–P4):**\n  - pocos minutos y de máxima calidad;\n  - P1: every 3–4′ al 90 % con descanso casi completo;\n  - P4: umbral en impares y pico en pares;\n  - si un metcon de Fabrik ya es de esa familia (4 bloques estables), cuenta como el estímulo de la semana.\n- **Segundo P integrado (R04):**\n  - thrusters, DU, STOH, front squat, burpees, hang snatch/clean y C2B/BMU en fatiga, con erg o carrera;\n  - nunca a menos de 48 h de otra sesión dura.\n- **Viaje:** lo que no siga la programación sube la intensidad:\n  - densidad;\n  - tempo;\n  - chaleco;\n  - final tipo P con sprints de 20″.\n- **Carencias:** salen de APP · METAS (peso = prioridad × lo que falta). El motor prioriza los movimientos de las metas menos cubiertas que tu material permite.\n\n## Claves del manual de rendimiento híbrido (resumen para el motor)\n\n- **Concurrente:**\n  - separa la fuerza pesada y la carrera de calidad ≥6 h, o mejor en días distintos;\n  - la Z2 no interfiere si es suave de verdad.\n- **48 h entre sesiones duras.** Tope semanal de minutos por turno: AM 75′, PM 120′.\n- **Taper:** −41–60 % de volumen sin bajar intensidad ni frecuencia.\n- **Competición física:**\n  - fuera P1–P4 y extras;\n  - 72–48 h antes, volumen medio-bajo con intensidad alta;\n  - 48–24 h antes, repaso;\n  - 24 h antes, descanso.\n- **Combustible:** 6–8 g/kg de hidratos el día previo a una carga alta; 1–2 g/kg 2–3 h antes de competir.\n";

// ===================== v0.24 · MODO LESIÓN =====================
/*
 * Base de adaptaciones en «Road to Elite · Motor» › LESIONES · ADAPTACIONES (como la Base de datos Vídeos: tú apruebas o rechazas).
 * Una fila = zona + causa + movimiento(s) que molestan → por qué sustituirlo(s), con qué interfiere / evitar, recuperación de 48 h
 * y dos columnas que rellena la IA (Gemini, gratis): base científica + cómo evitarlo/corregirlo, y recuperación/prevención + 2 ejercicios de calentamiento.
 * Reestructurar › Lesión: 0–24 h sin carga en la zona (se sustituye o se aleja); 24–48 h carga muy ligera; después, lo que más carga la zona
 * lo más lejos posible. Fabrik incluido. Lo que no cabe: pendientes o eliminar (tú decides). Descanso solo si lo autorizas.
 */
HOJAS.LESIONES = 'LESIONES · ADAPTACIONES';
ESQ_BD_[HOJAS.LESIONES] = { cab: ['ID', 'ZONA', 'CAUSA', 'MOVIMIENTO (molesta)', 'SUSTITUIR POR', 'INTERFIERE / EVITAR', 'RECUPERACIÓN 48 H', 'IA · BASE CIENTÍFICA Y CÓMO EVITARLO', 'IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO', 'ESTADO', 'APROBADO POR', 'NOTAS', 'ACTUALIZADO'],
  anchos: [80, 110, 120, 200, 240, 240, 260, 380, 380, 110, 110, 220, 130], negrita: 'MOVIMIENTO (molesta)', color: '#dc2626',
  colores: [['ESTADO', 'APROBADA', '#dcfce7'], ['ESTADO', 'RECHAZADA', '#f3f4f6', '#9ca3af']],
  listas: { ESTADO: ['PROPUESTA', 'APROBADA', 'RECHAZADA'], ZONA: ['HOMBRO', 'CODO / MUÑECA', 'LUMBAR', 'RODILLA', 'CADERA / ISQUIOS', 'TOBILLO / AQUILES', 'CUELLO / TRAPECIO'] } };
// zona → cargas de la guía del motor que la cargan, y causas posibles (la app pregunta la causa)
var ZONAS_LESION_ = {
  'HOMBRO': { cargas: ['HOMBRO'], causas: ['Gimnásticos', 'Pino', 'Press'] },
  'CODO / MUÑECA': { cargas: ['AGARRE'], causas: ['Agarre', 'Front rack', 'Empuje'] },
  'LUMBAR': { cargas: ['CORE', 'SNC'], causas: ['Bisagra', 'Core', 'Impacto'] },
  'RODILLA': { cargas: ['PIERNA', 'IMPACTO'], causas: ['Impacto', 'Fuerza'] },
  'CADERA / ISQUIOS': { cargas: ['PIERNA'], causas: ['Sprint', 'Bisagra'] },
  'TOBILLO / AQUILES': { cargas: ['IMPACTO'], causas: ['Impacto'] },
  'CUELLO / TRAPECIO': { cargas: ['HOMBRO'], causas: ['Press', 'Gimnásticos'] }
};
// semilla (PROPUESTA: la apruebas o la cambias en la hoja). Movimientos y sustitutos separados por «;»
var LESIONES_BASE_ = [
  ['HOMBRO', 'Gimnásticos', 'T2B; TOES TO BAR', 'Sit-ups en el suelo; GHD sit-ups (rango corto); V-ups', 'Kipping pull-ups; C2B; Bar muscle-ups; Ring muscle-ups', 'Rotación externa con banda 3×15; colgado pasivo 3×15″ solo si no duele; movilidad torácica 5′'],
  ['HOMBRO', 'Gimnásticos', 'CHEST TO BAR; C2B; PULL-UPS; PULL UP; KIPPING', 'Ring rows (rango sin dolor); remo con DB a una mano', 'Muscle-ups; T2B con kip; rope climb', 'Face pull con banda 3×15; Y-T-W en el suelo 2×8'],
  ['HOMBRO', 'Gimnásticos', 'BAR MUSCLE UP; BMU; RING MUSCLE UP; RMU; RING DIP; DIPS', 'Ring rows + V-ups; remo invertido', 'C2B; dips; HSPU', 'Rotación externa con banda; aperturas con banda ligeras'],
  ['HOMBRO', 'Pino', 'HSPU; HANDSTAND PUSH; HANDSTAND WALK; HSW; PINO', 'Push-ups a rango sin dolor; bear crawl; plank shoulder taps', 'Strict press; push press; jerk; wall walk', 'Isométricos de hombro sin dolor 5×20″; movilidad escapular (wall slides)'],
  ['HOMBRO', 'Press', 'SHOULDER TO OVERHEAD; STOH; PUSH PRESS; PUSH JERK; SPLIT JERK; JERK; STRICT PRESS', 'Front squat (mismo estímulo de pierna, sin carga OH); landmine press ligero si no duele', 'Snatch; OHS; HSPU; wall ball', 'Rotación externa con banda 3×15; face pull; movilidad torácica'],
  ['HOMBRO', 'Press', 'THRUSTER; WALL BALL', 'Front squat (thruster) / goblet squat (wall ball) al mismo ritmo', 'STOH; snatch; HSPU', 'Rotación externa con banda; estiramiento de pectoral menor'],
  ['HOMBRO', 'Press', 'SNATCH; OVERHEAD SQUAT; OHS; OH LUNGE', 'Clean (si el rack no duele); deadlift ligero; zancada con barra en back rack', 'Jerk; HSPU', 'Movilidad de hombro sin carga; dislocaciones con pica suaves'],
  ['CODO / MUÑECA', 'Agarre', 'PULL-UPS; CHEST TO BAR; T2B; MUSCLE UP; ROPE CLIMB; FARMER', 'Ring rows con agarre neutro; sit-ups; trineo', 'Peso muerto pesado; KB swing pesado', 'Extensores/flexores de muñeca con banda 2×15; movilidad de muñeca'],
  ['CODO / MUÑECA', 'Front rack', 'FRONT SQUAT; THRUSTER; CLEAN; FRONT RACK', 'Back squat; goblet squat con agarre de copa', 'Push press; jerk', 'Movilidad de muñeca y tríceps; estiramiento de dorsal'],
  ['CODO / MUÑECA', 'Empuje', 'PUSH-UPS; PUSH UP; HSPU; DIPS; BURPEE', 'Push-ups en puños o paralelas; floor press DB agarre neutro; sprawl sin apoyo largo', 'Handstand; wall walk', 'Extensores de muñeca con banda; prensión suave'],
  ['LUMBAR', 'Bisagra', 'DEADLIFT; PESO MUERTO; RDL; KB SWING; SWING; GOOD MORNING', 'Hip thrust; glute bridge; bike', 'Snatch; clean; back squat pesado', 'Cat-camel 2×10; dead bug 3×8; caminar 10–15′'],
  ['LUMBAR', 'Bisagra', 'POWER CLEAN; SQUAT CLEAN; SNATCH; HANG', 'Box jumps sin carga; bike sprints; DB hang clean muy ligero si no duele', 'Deadlift; KB swing', 'Bird dog 3×8; McGill curl-up 3×6'],
  ['LUMBAR', 'Core', 'GHD; T2B; TOES TO BAR; V-UPS; SIT-UPS', 'Dead bug; plancha corta 20″; hollow hold suave', 'Kipping; GHD', 'Respiración diafragmática; bird dog'],
  ['LUMBAR', 'Impacto', 'RUN; CARRERA; BOX JUMP; DOUBLE UNDER', 'Bike; ski; remo suave', 'Saltos', 'Caminar 15′; movilidad de cadera'],
  ['RODILLA', 'Impacto', 'BOX JUMP; BROAD JUMP; TUCK JUMP; JUMPING LUNGE; DOUBLE UNDER; RUN; CARRERA', 'Step-ups a rango sin dolor; bike; remo', 'Pistols; zancadas; sentadilla profunda', 'Isométrico de cuádriceps (wall sit corto) 5×30″; bike suave 10′'],
  ['RODILLA', 'Fuerza', 'LUNGE; ZANCADA; PISTOL; BULGARIAN; SPLIT SQUAT; BACK SQUAT; FRONT SQUAT; SQUAT', 'Hip thrust; RDL ligero; box squat a rango sin dolor', 'Saltos; wall ball profundo', 'Isométrico de cuádriceps; Spanish squat con banda 3×30″'],
  ['CADERA / ISQUIOS', 'Sprint', 'SPRINT; RUN; CARRERA; SHUTTLE', 'Bike sprints; trineo empujando', 'RDL; deadlift; KB swing', 'Puente de glúteo isométrico 3×30″; Nordic solo excéntrico suave a partir de 72 h'],
  ['CADERA / ISQUIOS', 'Bisagra', 'RDL; DEADLIFT; GOOD MORNING; KB SWING', 'Hip thrust a rango corto; leg curl con banda ligera', 'Sprints; zancadas largas', 'Puente isométrico; movilidad de cadera 90/90'],
  ['TOBILLO / AQUILES', 'Impacto', 'DOUBLE UNDER; RUN; CARRERA; BOX JUMP; BURPEE; JUMP', 'Bike / ski / remo por calorías; step-ups', 'Saltos; sprints; comba', 'Isométrico de gemelo (elevación de talones sostenida) 5×30″; movilidad de tobillo'],
  ['CUELLO / TRAPECIO', 'Press', 'SHOULDER TO OVERHEAD; PUSH PRESS; JERK; SNATCH; FARMER; SHRUG', 'Front squat; bike', 'HSPU; carries pesados', 'Retracción cervical (chin tucks) 3×10; estiramiento de trapecio superior suave'],
  ['CUELLO / TRAPECIO', 'Gimnásticos', 'HSPU; HANDSTAND; PULL-UPS; MUSCLE UP', 'Ring rows; plank', 'Pino; HSW', 'Chin tucks; movilidad torácica']
];
function prepararLesiones_() {
  var sh = hojaMia_(HOJAS.LESIONES); if (!sh) return 0;
  var ya = {}; listar_(HOJAS.LESIONES).forEach(function (r) { ya[norm(r.ZONA + '|' + r.CAUSA + '|' + r['MOVIMIENTO (molesta)'])] = 1; });
  var nuevas = LESIONES_BASE_.filter(function (x) { return !ya[norm(x[0] + '|' + x[1] + '|' + x[2])]; }).map(function (x) {
    return { ID: 'LS' + nuevoId_(), ZONA: x[0], CAUSA: x[1], 'MOVIMIENTO (molesta)': x[2], 'SUSTITUIR POR': x[3], 'INTERFIERE / EVITAR': x[4], 'RECUPERACIÓN 48 H': x[5], ESTADO: 'PROPUESTA', ACTUALIZADO: ahora_() }; });
  filasEnHoja_(HOJAS.LESIONES, nuevas);
  try {   // listas desplegables: sustituir / evitar admiten varios (separados por «;») — se ofrecen los movimientos de la guía
    var G = guiaMotor_(), nombres = G.movs.map(function (m) { return m.n.split(' (')[0]; }).slice(0, 450), cab = cabeceras_(sh), n = Math.max(1, sh.getLastRow() - 1);
    var dv = SpreadsheetApp.newDataValidation().requireValueInList(nombres, true).setAllowInvalid(true).setHelpText('Varios separados por «;»').build();
    ['SUSTITUIR POR', 'INTERFIERE / EVITAR'].forEach(function (h) { var k = cab.indexOf(h) + 1; if (k > 0) sh.getRange(2, k, n, 1).setDataValidation(dv); });
  } catch (e) {}
  return nuevas.length;
}
/** Gemini (gratis) rellena las dos columnas de IA de las filas que no las tengan. */
function lesionesIA_(max) {
  var hechas = 0;
  listar_(HOJAS.LESIONES).filter(function (r) { return r.ESTADO !== 'RECHAZADA' && (!String(r['IA · BASE CIENTÍFICA Y CÓMO EVITARLO'] || '').trim() || !String(r['IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO'] || '').trim()); }).slice(0, max || 4).forEach(function (r) {
    var prompt = 'Eres fisioterapeuta deportivo y preparador de CrossFit de élite. Atleta RX de 90 kg con molestia en ' + r.ZONA + ' asociada a ' + r.CAUSA + ' (movimientos: ' + r['MOVIMIENTO (molesta)'] + '). ' +
      'Responde en español, sin markdown, con EXACTAMENTE dos partes separadas por una línea que diga solo ###. ' +
      'PARTE 1 (4–6 frases): base científica más probable de la molestia (estructuras implicadas, mecanismo de sobrecarga, por qué esos movimientos la provocan) y cómo evitarla y corregirla (técnica, volumen, movilidad, fuerza). ' +
      'PARTE 2: los 3–4 ejercicios de recuperación y prevención más efectivos con dosis, y al final «CALENTAMIENTO:» con 2 ejercicios para añadir a partir de ahora a los calentamientos. ' +
      'Si hay dolor agudo, inflamación o pérdida de fuerza, indica acudir a un profesional. No diagnostiques.';
    var g = geminiLlamar_(prompt, 900, 0.3); if (!g.ok) return;
    var pz = String(g.texto || '').split(/\n?\s*###\s*\n?/);
    actualizarFila_(HOJAS.LESIONES, r._fila, { 'IA · BASE CIENTÍFICA Y CÓMO EVITARLO': (pz[0] || '').trim().slice(0, 3000), 'IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO': (pz[1] || '').trim().slice(0, 3000), ACTUALIZADO: ahora_() });
    hechas++;
  });
  return hechas;
}
function menuLesionesIA() { var n = lesionesIA_(8); SpreadsheetApp.getUi().alert('Lesiones · IA: ' + n + ' filas completadas con Gemini.'); }
function reglasLesion_(zona, causa) {
  var Z = norm(zona), C = norm(causa || '');
  return listar_(HOJAS.LESIONES).filter(function (r) { return norm(r.ZONA) === Z && (!C || norm(r.CAUSA) === C) && r.ESTADO !== 'RECHAZADA'; })
    .map(function (r) { return { r: r, aprobada: r.ESTADO === 'APROBADA', pats: String(r['MOVIMIENTO (molesta)'] || '').split(/\s*;\s*/).map(norm).filter(Boolean), sust: String(r['SUSTITUIR POR'] || '').split(/\s*;\s*/).filter(Boolean), rec: r['RECUPERACIÓN 48 H'] || '', ia: r['IA · RECUPERACIÓN, PREVENCIÓN Y CALENTAMIENTO'] || '' }; });
}
/** Sustituye en el texto las líneas con movimientos que molestan (por la 1.ª opción de «SUSTITUIR POR»). Devuelve { texto, cambios[], sinRegla } */
function sustituirLesion_(texto, reglas) {
  var cambios = [], lineas = String(texto || '').split('\n').map(function (l) {
    var L = norm(l); if (!L.trim()) return l;
    for (var i = 0; i < reglas.length; i++) { var g = reglas[i];
      for (var j = 0; j < g.pats.length; j++) { var p = g.pats[j]; if (p.length < 2 || !new RegExp('(^|[^A-Z])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Z]|$)').test(L)) continue;
        var s = g.sust[0] || 'movilidad suave'; cambios.push({ de: p, a: s, aprobada: g.aprobada });
        return '⇄ ' + l.trim() + '  →  ' + s.toUpperCase() + (g.aprobada ? '' : ' (sin aprobar)'); } }
    return l;
  });
  return { texto: lineas.join('\n'), cambios: cambios };
}
/** p: { zona, causa, iso, turno, usarDescanso } */
function proponerLesion_(lunes, p) {
  var Z = ZONAS_LESION_[p.zona]; if (!Z) throw new Error('zona_no_valida');
  var reglas = reglasLesion_(p.zona, p.causa), avisos = [], cambios = [], w = pesoCarencias_(lunes);
  if (!reglas.length) avisos.push('No hay adaptaciones para ' + p.zona + (p.causa ? ' · ' + p.causa : '') + ' en LESIONES · ADAPTACIONES: solo se alejan los bloques que cargan la zona.');
  if (reglas.length && !reglas.some(function (g) { return g.aprobada; })) avisos.push('Las adaptaciones de ' + p.zona + ' aún están como PROPUESTA: apruébalas en «Road to Elite · Motor › ' + HOJAS.LESIONES + '». Mientras, se usan marcadas como «sin aprobar».');
  var t0 = horaDe_(isoOk_(p.iso) || hoyIso_(), p.turno === 'PM' ? 'PM' : 'AM'), t24 = t0 + 24 * 36e5, t48 = t0 + 48 * 36e5;
  var conf = filaSemana_(lunes) || {}, desc = norm(conf.DESCANSO || '');
  var esDesc = function (iso) { return desc && desc.indexOf(norm(DIAS_CORTO_[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7])) >= 0; };
  var carga = function (r) { var cg = cargasFila_(r); return Z.cargas.filter(function (c) { return cg.indexOf(c) >= 0; }).length; };
  var tocaRegla = function (r) { var t = norm((r['TÍTULO'] || '') + '\n' + (r.CONTENIDO || '')); return reglas.some(function (g) { return g.pats.some(function (pp) { return pp.length > 1 && t.indexOf(pp) >= 0; }); }); };
  var filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && horaDe_(r._iso, r._turno) >= t0; });
  var aMover = [];
  filas.forEach(function (r) {
    var h = horaDe_(r._iso, r._turno), afecta = carga(r) > 0 || tocaRegla(r); if (!afecta) return;
    var su = sustituirLesion_(r.CONTENIDO, reglas), fase = h < t24 ? '0–24 h' : h < t48 ? '24–48 h' : '';
    if (fase) {
      if (su.cambios.length && (fase === '24–48 h' || !esDura_(r) || carga(r) <= 1)) {
        cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: (fase === '0–24 h' ? 'LESIÓN ' + p.zona + ' · 0–24 h: nada de carga en la zona. Sustituciones:\n' : 'LESIÓN ' + p.zona + ' · 24–48 h: carga MUY ligera (≤50 %, RPE ≤5, sin dolor).\n') + su.texto,
          motivo: fase + ': ' + su.cambios.map(function (c) { return c.de.toLowerCase() + ' → ' + c.a.toLowerCase() + (c.aprobada ? '' : ' (sin aprobar)'); }).join(' · ') });
      } else if (fase === '24–48 h' && !esDura_(r)) {
        cambios.push({ id: r.ID, accion: 'adaptar', iso: r._iso, turno: r._turno, contenido: 'LESIÓN ' + p.zona + ' · 24–48 h: hazlo MUY ligero (≤50 % de la carga, RPE ≤5) y para si duele.\n' + r.CONTENIDO, motivo: '24–48 h: solo carga muy ligera' });
      } else aMover.push(Object.assign(r, { _motivo: fase + ' tras la molestia: carga ' + p.zona.toLowerCase() + (su.cambios.length ? ' y no basta con sustituir' : ' y no hay sustitución') }));
    } else if (esDura_(r) && carga(r) > 0) aMover.push(Object.assign(r, { _motivo: 'Es de lo que más carga ' + p.zona.toLowerCase() + ': lo más lejos posible', _lejos: true }));
  });
  // recolocar: Fabrik primero; huecos ≥48 h, del más lejano al más cercano; descanso solo si lo autorizas
  var mueven = {}; aMover.forEach(function (r) { mueven[r.ID] = 1; });
  var quedan = filas.filter(function (r) { return !mueven[r.ID]; }), ocupado = cargaBase_(quedan), slots = [];
  for (var k = 6; k >= 0; k--) { var iso = sumarDias(lunes, k); ['PM', 'AM'].forEach(function (t) { var h = horaDe_(iso, t); if (h >= t48 && (p.usarDescanso || !esDesc(iso))) slots.push({ iso: iso, turno: t, cap: CAP_TURNO_[t] }); }); }
  aMover.sort(function (a, b) { return (norm(b.ORIGEN) === 'FABRIK') - (norm(a.ORIGEN) === 'FABRIK') || prioridadFila_(b, w) - prioridadFila_(a, w); }).forEach(function (r) {
    var duroDia = function (iso) { return quedan.concat(aMover.filter(function (x) { return x._dest && x._dest.iso === iso; })).some(function (x) { return (x._dest ? x._dest.iso : x._iso) === iso && esDura_(x) && carga(x) > 0; }); };
    var s = slots.filter(function (s) { return (ocupado[s.iso + s.turno] || 0) + r._min <= s.cap && !(esDura_(r) && duroDia(s.iso)) && !(s.iso === r._iso && s.turno === r._turno && !r._lejos); })[0];
    if (r._lejos && s && horaDe_(s.iso, s.turno) <= horaDe_(r._iso, r._turno)) s = null;   // ya está lo más lejos posible
    if (s) { ocupado[s.iso + s.turno] = (ocupado[s.iso + s.turno] || 0) + r._min; r._dest = s; cambios.push({ id: r.ID, accion: 'mover', iso: s.iso, turno: s.turno, motivo: r._motivo + ' → ' + diaDe_(s.iso).toLowerCase() + ' ' + s.turno + (esDesc(s.iso) ? ' (día de descanso, lo autorizaste)' : '') }); }
    else if (!r._lejos) cambios.push({ id: r.ID, accion: 'pendiente', noCabe: true, carreraErg: esCarreraFila_(r) || /W03/.test(r['CÓDIGOS'] || ''), motivo: r._motivo + '. No cabe' + (p.usarDescanso ? '' : ' sin usar el descanso') + ': pendientes para la semana que viene o eliminarlo (tú decides).' });
  });
  // recuperación en las primeras 48 h
  var rec = reglas.map(function (g) { return g.rec; }).filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 3);
  var cal = reglas.map(function (g) { return (String(g.ia).match(/CALENTAMIENTO:([\s\S]*)$/i) || [])[1]; }).filter(Boolean)[0];
  [0, 1].forEach(function (d) { var iso = isoDeHora_(t0 + d * 24 * 36e5); if (iso > sumarDias(lunes, 6) || iso < lunes) return;
    cambios.push({ accion: 'nuevo', iso: iso, turno: p.turno === 'PM' || d ? 'PM' : 'AM', nuevo: { ORIGEN: 'LESIÓN', 'TÍTULO': 'Recuperación · ' + p.zona.toLowerCase() + ' (' + (d ? '24–48 h' : '0–24 h') + ')', CONTENIDO: (rec.length ? rec.join('\n') : 'Movilidad suave de la zona sin dolor 10′ + isométricos sin dolor.') + '\n\nSi el dolor sube, es agudo o hay pérdida de fuerza: consulta a un fisio.', MIN: 15, INTENSIDAD: '🟢 Suave', 'CÓDIGOS': '' }, motivo: 'Recuperación de la zona en las primeras 48 h' }); });
  if (cal) avisos.push('A partir de ahora, añade a tus calentamientos: ' + cal.trim().slice(0, 300));
  return { cambios: cambios, avisos: avisos, resumen: 'Lesión · ' + p.zona + (p.causa ? ' (' + p.causa + ')' : '') + ' desde ' + diaDe_(isoDeHora_(t0)) + ' ' + (p.turno === 'PM' ? 'PM' : 'AM') + ' · ' + cambios.filter(function (c) { return c.accion === 'adaptar'; }).length + ' adaptados · ' + cambios.filter(function (c) { return c.accion === 'mover'; }).length + ' movidos · ' + cambios.filter(function (c) { return c.noCabe; }).length + ' sin hueco' };
}
function isoDeHora_(t) { return Utilities.formatDate(new Date(t), CONFIG.ZONA, 'yyyy-MM-dd'); }

// ===================== v0.24 · INCENTIVAR ESTÍMULOS (reducibles) + APP · ESTÍMULOS EN BLOQUES =====================
/*
 * Marca estímulos semanales como «Reducible» (APP · METAS › REDUCIBLE). Al «incentivar» uno o varios estímulos una semana:
 *  - los reducibles que atacan el mismo patrón / músculos bajan un 50–75 % (meta de esa semana y bloques ya puestos);
 *  - los incentivados suben lo liberado × 1,25 (en minutos de trabajo → exposiciones extra);
 *  - los mensuales quedan con al menos un 17 % acumulado (dosis ligera);
 *  - si falta sitio: pregunta por el día de descanso; si no, por las mañanas; si no, prioriza lo incentivado y lo menos vital va a pendientes.
 * Todo pasa por Reestructurar (propuesta → tú apruebas o cambias bloques → deshacer).
 */
ESQUEMA['APP · METAS'].cab.push('REDUCIBLE'); if (ESQUEMA['APP · METAS'].anchos) ESQUEMA['APP · METAS'].anchos.push(90);
ESQUEMA['APP · METAS'].listas.REDUCIBLE = ['Sí', 'No'];
HOJAS.ESTBLOQUES = 'APP · ESTÍMULOS EN BLOQUES';
var MIN_MES_ = 0.17;
function incentivosConfig_() { try { return JSON.parse(String(leerConfig_().incentivos || '{}')) || {}; } catch (e) { return {}; } }
/** Δ de meta por semana (lunes → { metaId: Δ }) de los incentivos aplicados. */
function deltasIncentivo_(lunes) {
  var cfg = incentivosConfig_(), o = {};
  Object.keys(cfg).forEach(function (rid) { var x = cfg[rid]; if (x && x.lunes === lunes) Object.keys(x.deltas || {}).forEach(function (k) { o[k] = (o[k] || 0) + x.deltas[k]; }); });
  return o;
}
function guardarIncentivo_(rid, lunes, deltas) { var cfg = incentivosConfig_(); if (deltas) cfg[rid] = { lunes: lunes, deltas: deltas }; else delete cfg[rid];
  Object.keys(cfg).forEach(function (k) { if (cfg[k].lunes < sumarDias(hoyIso_(), -70)) delete cfg[k]; });
  ponerConfig_('incentivos', JSON.stringify(cfg), 'Incentivos aplicados por semana (Reestructurar › Incentivar)'); }
function pnum_(p) { var m = String(p || '').match(/P\s*([0-9])/i); return m ? +m[1] : 9; }
/** Palabras de patrón / músculo de una meta: cargas del catálogo + palabras de su prioridad y estímulo. */
function patronMeta_(m, cat) {
  var VAC = /^(P[0-9]+|CALIDAD|FATIGA|EN|DE|DEL|LA|EL|Y|CON|ESPECIFICA|INTEGRACION|ACCESORIOS|COMPETICION|SESION|SESIONES|TOTAL|SEMANA|MES|DOSIS|TRABAJO|BLOQUE|ESTIMULO)$/;
  var w = {}; codigosDe_(m.codigos || m['CÓDIGOS']).forEach(function (c) { String((cat[c] || {}).CARGA || '').split(/[ ,;/]+/).forEach(function (k) { k = norm(k); if (k.length > 2) w['C:' + k] = 1; }); });
  norm(String(m.prioridad || m.PRIORIDAD || '') + ' ' + String(m.estimulo || m['ESTÍMULO'] || '')).split(/[^A-Z0-9]+/).forEach(function (k) { if (k.length > 2 && !VAC.test(k)) w['P:' + k] = 1; });
  return Object.keys(w);
}
function solapan_(a, b) { return a.some(function (k) { return b.indexOf(k) >= 0; }); }
function metasIncentivo_(lunes) {
  var cache = cacheMetas_(), cat = catalogo_(), red = {};
  cache.metas.forEach(function (m) { red[m.ID] = m.REDUCIBLE === 'Sí'; });
  var sem = avanceMetas_('Semana', periodoSemana_(lunes), cache), mes = avanceMetas_('Mes', periodoMes_(lunes), cache);
  return sem.map(function (x) { return Object.assign(x, { ambito: 'Semana', reducible: !!red[x.id] }); }).concat(mes.map(function (x) { return Object.assign(x, { ambito: 'Mes', reducible: false }); }))
    .map(function (x) { x.patron = patronMeta_(x, cat); return x; });
}
function bloqueDeCodigo_(codigos, cat) { var cs = codigosDe_(codigos).filter(function (c) { return cat[c] && cat[c].CONTENIDO; }); return cs.length ? { c: cs[0], r: cat[cs[0]] } : null; }
/** p: { ids: [meta IDs a incentivar], reducir: 0.5|0.75, usarDescanso, mananas: [iso] } */
function proponerIncentivo_(lunes, p) {
  var ids = [].concat(p.ids || []).map(String), f = Math.min(0.75, Math.max(0.5, +p.reducir || 0.5));
  if (!ids.length) throw new Error('elige_estimulo');
  Object.keys(p.reducibles || {}).forEach(function (k) { try { marcarReducible_(k, !!p.reducibles[k]); } catch (e) {} });   // lo marcado en la app se guarda al calcular
  var cat = catalogo_(), metas = metasIncentivo_(lunes), w = pesoCarencias_(lunes), avisos = [], cambios = [], deltas = {};
  var inc = metas.filter(function (m) { return ids.indexOf(m.id) >= 0; }); if (!inc.length) throw new Error('elige_estimulo');
  var hoy = hoyIso_(), filas = filasSemanaActivas_(lunes).filter(function (r) { return !r._hecho && r._iso >= hoy; });
  var deMeta = function (m) { var cs = codigosDe_(m.codigos); return filas.filter(function (r) { return codigosDe_(r['CÓDIGOS']).some(function (c) { return cs.indexOf(c) >= 0; }); }); };
  // 1) reducibles del mismo patrón / músculos
  var patInc = []; inc.forEach(function (m) { patInc = patInc.concat(m.patron); });
  var reds = metas.filter(function (m) { return m.ambito === 'Semana' && m.reducible && ids.indexOf(m.id) < 0 && solapan_(m.patron, patInc); });
  var liberados = 0, tocados = {};
  reds.forEach(function (m) {
    deltas[m.id] = -Math.round(m.meta * f * 10) / 10;
    deMeta(m).forEach(function (r) {
      if (tocados[r.ID] || norm(r.ORIGEN) === 'FABRIK') return; tocados[r.ID] = 1;
      var mi = Math.max(5, Math.round(r._min * (1 - f))); liberados += r._min - mi;
      cambios.push({ id: r.ID, accion: 'adaptar', min: mi, iso: r._iso, turno: r._turno, contenido: 'REDUCIDO −' + Math.round(f * 100) + ' % (semana de incentivo: ' + inc.map(function (x) { return x.estimulo; }).join(', ') + '). Haz ' + (f >= 0.75 ? 'una cuarta parte' : 'la mitad') + ' de las series, misma calidad.\n\n' + (r.CONTENIDO || ''),
        motivo: 'Reducible · «' + m.estimulo + '» ataca el mismo patrón: −' + Math.round(f * 100) + ' % (' + r._min + '′ → ' + mi + '′)' });
    });
    if (!deMeta(m).length) liberados += Math.round(((bloqueDeCodigo_(m.codigos, cat) || {}).r || {}).MIN * f || 10 * f);
  });
  if (!reds.length) avisos.push('Ningún estímulo REDUCIBLE ataca el mismo patrón que ' + inc.map(function (x) { return '«' + x.estimulo + '»'; }).join(', ') + ': solo se añade el incentivo (márcalos en APP · METAS › REDUCIBLE o en la hoja ' + HOJAS.ESTBLOQUES + ').');
  // 2) incentivados: + lo liberado × 1,25 (mínimo una exposición extra cada uno)
  var extra = Math.max(liberados * 1.25, 10 * inc.length), porInc = extra / inc.length, nuevos = [];
  inc.forEach(function (m) {
    var b = bloqueDeCodigo_(m.codigos, cat); if (!b) { avisos.push('«' + m.estimulo + '» no tiene bloque en el catálogo: sube su meta pero no puedo crear el bloque.'); return; }
    var mb = Math.max(8, Math.round((+b.r.MIN || 12) * 1.25)), n = Math.max(1, Math.round(porInc / mb));
    deltas[m.id] = (deltas[m.id] || 0) + (m.tipo === 'MIN' ? Math.round(porInc) : n);
    for (var i = 0; i < n; i++) nuevos.push({ prio: 0, meta: m, b: b, min: mb, titulo: b.r.NOMBRE + ' · 🔥 incentivo' + (n > 1 ? ' ' + (i + 1) + '/' + n : ''),
      contenido: 'INCENTIVO ×1,25 · dosis completa y un poco más: +25 % de volumen sobre lo habitual, calidad máxima.\n\n' + b.r.CONTENIDO, ambito: m.ambito });
  });
  // 3) mensuales: al menos un 17 % acumulado
  metas.filter(function (m) { return m.ambito === 'Mes' && ids.indexOf(m.id) < 0 && m.meta > 0 && m.programado < m.meta * MIN_MES_; }).forEach(function (m) {
    var b = bloqueDeCodigo_(m.codigos, cat); if (!b) return;
    var o = dosisPorAmbito_({ ORIGEN: 'EXTRA', MIN: b.r.MIN || 10, CONTENIDO: b.r.CONTENIDO, INTENSIDAD: b.r.INTENSIDAD || '', 'CÓDIGOS': b.c }, 'Mes');
    nuevos.push({ prio: 1 + pnum_(m.prioridad) / 10, meta: m, b: b, min: +o.MIN, titulo: b.r.NOMBRE + ' · mínimo mensual', contenido: o.CONTENIDO, ambito: 'Mes', intensidad: o.INTENSIDAD });
  });
  // 4) colocar: huecos libres; descanso solo si lo apruebas; mañanas solo si son dobles o las marcas
  var conf = filaSemana_(lunes) || {}, des = norm(conf.DESCANSO || ''), dob = norm(conf['DOBLES (mañanas libres)'] || ''), man = [].concat(p.mananas || []);
  var dc = function (iso) { return norm(DIAS_CORTO_[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7]); };
  var quitados = {}; cambios.forEach(function (c) { if (c.min != null) quitados[c.id] = c.min; });
  var ocupado = {}; filas.forEach(function (r) { var k = r._iso + r._turno; ocupado[k] = (ocupado[k] || 0) + (quitados[r.ID] != null ? quitados[r.ID] : r._min); });
  var slots = [], slotsDesc = [], slotsAM = [];
  for (var k = 0; k < 7; k++) { var iso = sumarDias(lunes, k); if (iso < hoy) continue;
    var esD = des && des.indexOf(dc(iso)) >= 0;
    ['PM', 'AM'].forEach(function (t) { var s = { iso: iso, turno: t, cap: CAP_TURNO_[t] };
      if (t === 'AM' && dob.indexOf(dc(iso)) < 0 && man.indexOf(iso) < 0) { if (!esD) slotsAM.push(s); return; }
      if (esD && !p.usarDescanso) { slotsDesc.push(s); return; }
      slots.push(s); }); }
  var nNuevos = {};   // como mucho 1 bloque nuevo de cada tipo por sesión (no sobrecargar); se elige la sesión más libre
  var cabe = function (lista, nb, usado) { return lista.filter(function (s) { var key = s.iso + s.turno; return (ocupado[key] || 0) + (usado[key] || 0) + nb.min <= s.cap && !(nb.ya || []).some(function (x) { return x === s.iso; }) && !((nNuevos[key] || {})[nb.prio === 0 ? 'i' : 'm']); })
    .sort(function (a, b) { return ((ocupado[a.iso + a.turno] || 0) + (usado[a.iso + a.turno] || 0)) / a.cap - ((ocupado[b.iso + b.turno] || 0) + (usado[b.iso + b.turno] || 0)) / b.cap; })[0]; };
  var marcar = function (s, nb) { var key = s.iso + s.turno; usado[key] = (usado[key] || 0) + nb.min; (nNuevos[key] = nNuevos[key] || {})[nb.prio === 0 ? 'i' : 'm'] = 1; };
  var usado = {};
  nuevos.sort(function (a, b) { return a.prio - b.prio; });
  var pon = [], noCaben = [];
  nuevos.forEach(function (nb) { var mismos = pon.filter(function (x) { return x.meta.id === nb.meta.id; }).map(function (x) { return x.s.iso; }); nb.ya = mismos;
    var s = cabe(slots, nb, usado); if (s) { marcar(s, nb); pon.push({ nb: nb, s: s, meta: nb.meta }); } else noCaben.push(nb); });
  var pregunta = null;
  if (noCaben.length) {
    var minF = noCaben.reduce(function (a, x) { return a + x.min; }, 0);
    if (!p.usarDescanso && p.descanso !== 'no' && slotsDesc.length) pregunta = { tipo: 'descanso', min: minF, dias: slotsDesc.map(function (s) { return s.iso; }).filter(function (x, i, a) { return a.indexOf(x) === i; }), texto: 'Faltan ' + minF + '′ para meterlo todo. ¿Usas el día de descanso?' };
    else if (!man.length && p.mananas !== 'no' && slotsAM.length) pregunta = { tipo: 'mananas', min: minF, dias: slotsAM.map(function (s) { return s.iso; }), texto: 'Faltan ' + minF + '′. ¿Te cabe alguna mañana? Marca cuáles.' };
  }
  // 5) si sigue sin caber: lo incentivado manda; lo menos vital (extras no Fabrik de menor prioridad) va a pendientes
  if (!pregunta && noCaben.length) {
    noCaben.filter(function (nb) { return nb.prio === 0; }).forEach(function (nb) {
      var vict = filas.filter(function (r) { return norm(r.ORIGEN) !== 'FABRIK' && !tocados[r.ID] && !/CARRERA/.test(norm(r.ORIGEN)) && !codigosDe_(r['CÓDIGOS']).some(function (c) { return codigosDe_(nb.meta.codigos).indexOf(c) >= 0; }) && slots.some(function (s) { return s.iso === r._iso && s.turno === r._turno; }); })
        .sort(function (a, b) { return prioridadFila_(a, w) - prioridadFila_(b, w); })[0];
      if (!vict) return;
      ocupado[vict._iso + vict._turno] -= vict._min;
      var s = cabe(slots, nb, usado);
      if (!s) { ocupado[vict._iso + vict._turno] += vict._min; return; }   // no sirve de nada quitarlo
      tocados[vict.ID] = 1; cambios.push({ id: vict.ID, accion: 'pendiente', motivo: 'Menos vital: deja sitio a lo incentivado (pendiente para la semana que viene)' });
      marcar(s, nb); pon.push({ nb: nb, s: s, meta: nb.meta }); nb.puesto = true;
    });
    noCaben = noCaben.filter(function (nb) { return !nb.puesto; });
  }
  pon.forEach(function (x) { var nb = x.nb;
    cambios.push({ accion: 'nuevo', iso: x.s.iso, turno: x.s.turno, nuevo: { ORIGEN: 'EXTRA', 'TÍTULO': nb.titulo, CONTENIDO: nb.contenido, MIN: nb.min, INTENSIDAD: nb.intensidad || nb.b.r.INTENSIDAD || '', 'CÓDIGOS': nb.b.c, ORDEN: 75,
      'POR QUÉ (cursiva)': (nb.prio === 0 ? 'Incentivo de la semana: «' + nb.meta.estimulo + '» (+25 % de lo liberado por los reducibles).' : 'Mínimo mensual: «' + nb.meta.estimulo + '» al menos al 17 % acumulado.') },
      motivo: nb.prio === 0 ? '🔥 Incentivo · ' + nb.meta.estimulo : 'Mensual ≥17 % · ' + nb.meta.estimulo }); });
  noCaben.forEach(function (nb) { cambios.push({ accion: 'nuevo-pendiente', titulo: nb.titulo, motivo: (nb.prio === 0 ? 'Incentivo' : 'Mínimo mensual') + ' sin hueco: a pendientes de la semana que viene' }); });
  return { cambios: cambios, avisos: avisos, pregunta: pregunta, incentivo: { lunes: lunes, deltas: deltas },
    resumen: '🔥 Incentivar ' + inc.map(function (x) { return x.estimulo; }).join(' + ') + ' · reducibles −' + Math.round(f * 100) + ' % (' + reds.length + ') · ' + pon.filter(function (x) { return x.nb.prio === 0; }).length + ' bloques de incentivo · ' + pon.filter(function (x) { return x.nb.prio > 0; }).length + ' mensuales ≥17 % · ' + noCaben.length + ' a pendientes' };
}
function numSemana_(iso) { var d = new Date(iso + 'T12:00:00Z'), j = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - j + 3); var a = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - a) / 864e5 - 3 + ((a.getUTCDay() + 6) % 7)) / 7); }
function marcarReducible_(id, si) { var m = listar_(HOJAS.METAS).filter(function (x) { return x.ID === id; })[0]; if (!m) throw new Error('no_encontrado'); asegurarColumna_(HOJAS.METAS, 'REDUCIBLE'); actualizarFila_(HOJAS.METAS, m._fila, { REDUCIBLE: si ? 'Sí' : 'No' }); MEMO = null; return true; }
function datosIncentivo_(lunes) {
  return metasIncentivo_(lunes).map(function (m) { return { id: m.id, ambito: m.ambito, prioridad: m.prioridad, estimulo: m.estimulo, codigos: m.codigos, meta: m.meta, programado: m.programado, realizado: m.realizado, reducible: m.reducible, tipo: m.tipo,
    dias: (m.dias || []).map(function (d) { return diaDe_(d.iso).slice(0, 3) + ' ' + d.turno; }) }; });
}
// ---------- hoja APP · ESTÍMULOS EN BLOQUES ----------
function pintarHojaEstimulos_(lunes) {
  lunes = lunesDe_(isoOk_(lunes) || hoyIso_());
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID), sh = ss.getSheetByName(HOJAS.ESTBLOQUES) || ss.insertSheet(HOJAS.ESTBLOQUES);
  var cfg = leerConfig_(), sel = String(cfg.incentivar_sel || '').split(',').filter(Boolean), metas = metasIncentivo_(lunes), D = 12;
  var filas = [['ESTÍMULOS EN BLOQUES · semanales y mensuales', '', '', '', '', '', '', '', '', '', '', ''],
    ['Lunes →', isoAFecha(lunes), 'Semana nº ' + numSemana_(lunes), '↻', false, '🔥 PROPONER INCENTIVO →', false, 'Reducir', String(cfg.incentivo_reducir || '50 %'), 'Usar descanso', String(cfg.incentivo_descanso || 'Preguntar'), ''],
    ['Marca REDUCIBLE (se guarda en APP · METAS) y los que quieras INCENTIVAR; pulsa «PROPONER». Mañanas libres extra (ej. Mar, Jue) en L3 →', '', '', '', '', '', '', '', '', '', 'Mañanas:', String(cfg.incentivo_mananas || '')],
    ['ÁMBITO', 'PRIORIDAD', 'ESTÍMULO', 'CÓDIGOS', 'META', 'PROGRAMADO', 'HECHO', '%', 'BLOQUES (día · turno)', 'REDUCIBLE', 'INCENTIVAR', 'ID']];
  metas.forEach(function (m) { var d = deltasIncentivo_(lunes)[m.id];
    filas.push([m.ambito, m.prioridad || '', m.estimulo + (d ? (d > 0 ? '  🔥 +' : '  ↓ ') + d : ''), m.codigos || '', m.meta, Math.round(m.programado * 10) / 10, Math.round(m.realizado * 10) / 10, m.meta > 0 ? Math.round(Math.min(1, m.programado / m.meta) * 100) + ' %' : '—',
      (m.dias || []).map(function (x) { return diaDe_(x.iso).slice(0, 3) + ' ' + x.turno + ' · ' + String(x.titulo).slice(0, 28); }).join('\n'), m.ambito === 'Semana' ? m.reducible : '', sel.indexOf(m.id) >= 0, m.id]); });
  var prop = String(cfg.incentivo_propuesta || ''), P = null;
  if (prop) { var xr = listar_(HOJAS.REEST).filter(function (r) { return r.ID === prop && r.ESTADO === 'Propuesta'; })[0]; if (xr) try { P = JSON.parse(xr.PROPUESTA || '{}'); } catch (e) {} }
  var ini = filas.length + 2;
  if (P) {
    filas.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    filas.push(['PROPUESTA ' + prop, P.resumen || '', '', '', '', '✓ APLICAR →', false, '✗ DESCARTAR →', false, '', '', '']);
    if (P.pregunta) filas.push(['❓', P.pregunta.texto + (P.pregunta.tipo === 'descanso' ? '  → pon «Sí» en «Usar descanso» (K2) o «No» y vuelve a proponer.' : '  → escribe las mañanas en L3 (ej. Mar, Jue) o «No» y vuelve a proponer.'), '', '', '', '', '', '', '', '', '', '']);
    (P.avisos || []).forEach(function (a) { filas.push(['⚠', a, '', '', '', '', '', '', '', '', '', '']); });
    (P.cambios || []).forEach(function (c) { filas.push([({ adaptar: 'Reducido', nuevo: 'Nuevo', pendiente: 'A pendientes', 'nuevo-pendiente': 'A pendientes' })[c.accion] || c.accion, c.titulo || '', c.desdeIso ? diaDe_(c.desdeIso).slice(0, 3) + ' ' + (c.desdeTurno || '') : '', c.iso ? diaDe_(c.iso).slice(0, 3) + ' ' + (c.turno || '') : '', c.min || (c.nuevo && c.nuevo.MIN) || '', c.motivo || '', '', '', '', '', '', '']); });
  }
  sh.clear(); sh.setConditionalFormatRules([]);
  if (sh.getMaxColumns() < D) sh.insertColumnsAfter(sh.getMaxColumns(), D - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), D).clearDataValidations();
  if (sh.getMaxRows() < filas.length + 5) sh.insertRowsAfter(sh.getMaxRows(), filas.length + 5 - sh.getMaxRows());
  sh.getRange(1, 1, filas.length, D).setValues(filas.map(function (r) { return r.map(celdaSegura_); }));
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  sh.getRange(2, 2).setNumberFormat('dd/mm/yyyy').setBackground('#fff7e0');
  sh.getRange(2, 5).insertCheckboxes(); sh.getRange(2, 7).insertCheckboxes(); sh.getRange(2, 6).setFontWeight('bold').setFontColor('#e8590c');
  sh.getRange(2, 9).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['50 %', '75 %'], true).build()).setBackground('#fff7e0');
  sh.getRange(2, 11).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Preguntar', 'Sí', 'No'], true).build()).setBackground('#fff7e0');
  sh.getRange(3, 12).setBackground('#fff7e0'); sh.getRange(3, 1).setFontColor('#666666').setWrap(false);
  sh.getRange(4, 1, 1, D).setBackground('#121212').setFontColor('#ffffff').setFontWeight('bold');
  sh.setFrozenRows(4);
  [80, 150, 240, 90, 60, 90, 70, 60, 260, 90, 90, 70].forEach(function (wd, j) { sh.setColumnWidth(j + 1, wd); });
  if (metas.length) {
    var bg = metas.map(function (m) { return new Array(D).fill(m.ambito === 'Semana' ? '#eef4ff' : '#f3eefe'); });
    sh.getRange(5, 1, metas.length, D).setBackgrounds(bg).setVerticalAlignment('top').setWrap(true);
    metas.forEach(function (m, i) { if (m.ambito === 'Semana') sh.getRange(5 + i, 10).insertCheckboxes(); });
    sh.getRange(5, 11, metas.length, 1).insertCheckboxes();
    sh.getRange(5, 12, metas.length, 1).setFontColor('#bbbbbb');
  }
  if (P) { var fp = 5 + metas.length + 1; sh.getRange(fp, 1, 1, D).setBackground('#ffedd5').setFontWeight('bold'); sh.getRange(fp, 7).insertCheckboxes(); sh.getRange(fp, 9).insertCheckboxes(); }
  sh.setTabColor('#e8590c');
  ponerConfig_('estimulos_bloques', "'" + lunes, 'Semana que muestra ' + HOJAS.ESTBLOQUES);
  return filas.length;
}
function menuEstimulosBloques() { pintarHojaEstimulos_(leerConfig_().estimulos_bloques || lunesDe_(hoyIso_())); SpreadsheetApp.getActive().getSheetByName(HOJAS.ESTBLOQUES).activate(); }
function editarEstimulosSheet_(e) {
  var sh = e.range.getSheet(), f = e.range.getRow(), c = e.range.getColumn(), v = e.range.getValue();
  var lunes = lunesDe_(celdaIso_(sh.getRange(2, 2).getValue()) || hoyIso_()), toast = function (m) { SpreadsheetApp.getActive().toast(m, 'Road To Elite', 5); };
  if (f === 2 && (c === 2 || c === 5)) { pintarHojaEstimulos_(lunes); return; }
  if (f === 2 && c === 9) { ponerConfig_('incentivo_reducir', String(v)); return; }
  if (f === 2 && c === 11) { ponerConfig_('incentivo_descanso', String(v)); return; }
  if (f === 3 && c === 12) { ponerConfig_('incentivo_mananas', String(v || '')); return; }
  var id = String(sh.getRange(f, 12).getValue() || '').trim();
  if (f >= 5 && id && c === 10) { marcarReducible_(id, v === true); toast((v === true ? 'Reducible' : 'No reducible') + ' (guardado en APP · METAS)'); return; }
  if (f >= 5 && id && c === 11) { var sel = String(leerConfig_().incentivar_sel || '').split(',').filter(Boolean).filter(function (x) { return x !== id; }); if (v === true) sel.push(id); ponerConfig_('incentivar_sel', sel.join(',')); return; }
  if (f === 2 && c === 7 && v === true) {
    var cfg = leerConfig_(), ids = String(cfg.incentivar_sel || '').split(',').filter(Boolean);
    if (!ids.length) { toast('Marca al menos un estímulo en INCENTIVAR'); pintarHojaEstimulos_(lunes); return; }
    var dsc = String(cfg.incentivo_descanso || 'Preguntar'), mtx = String(cfg.incentivo_mananas || '').trim();
    var mananas = /^no$/i.test(mtx) ? 'no' : [0, 1, 2, 3, 4, 5, 6].map(function (k) { return sumarDias(lunes, k); }).filter(function (iso) { return mtx && norm(mtx).indexOf(norm(DIAS_CORTO_[(new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7])) >= 0; });
    toast('Calculando el incentivo…');
    var P = reestProponer_('Incentivar', lunes, { ids: ids, reducir: /75/.test(cfg.incentivo_reducir) ? 0.75 : 0.5, usarDescanso: dsc === 'Sí', descanso: dsc === 'No' ? 'no' : '', mananas: mananas });
    ponerConfig_('incentivo_propuesta', P.id); MEMO = null; pintarHojaEstimulos_(lunes); toast(P.pregunta ? P.pregunta.texto : 'Propuesta lista: revísala abajo y marca «APLICAR» (o cámbiala desde la app › Reestructurar).'); return;
  }
  var prop = String(leerConfig_().incentivo_propuesta || '');
  if (f > 5 && c === 7 && v === true && prop) { reestAplicar_(prop, []); ponerConfig_('incentivo_propuesta', ''); ponerConfig_('incentivar_sel', ''); refrescarResumen_(); MEMO = null; pintarHojaEstimulos_(lunes); refrescarHojaSemana_(lunes); toast('Incentivo aplicado (deshacer: app › Reestructurar › Aplicadas)'); return; }
  if (f > 5 && c === 9 && v === true && prop) { var xr = listar_(HOJAS.REEST).filter(function (r) { return r.ID === prop; })[0]; if (xr) actualizarFila_(HOJAS.REEST, xr._fila, { ESTADO: 'Descartada' }); ponerConfig_('incentivo_propuesta', ''); pintarHojaEstimulos_(lunes); toast('Propuesta descartada'); }
}

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
var DUP_PREVIA_ = /\b(W15|W16|W17|W31|W13|M30|M49|W32|W33|M53|M55)\b/, INT_PINO_ = /\b(W32|W33|W25|W26|W27|W28|M56|M57)\b/, INT_HSPU_ = /\b(W15|W16|W17|W31|W32)\b/;
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
    var fm = factorMeta_({ 'CÓDIGOS': o['CÓDIGOS'] }, lunes, 'Semana'); if (fm.f > 1) { pre.unshift('×2 esta semana: ' + fm.por + '. Microdosis de calidad, no más volumen por sesión.'); min = Math.min(min, 12); }
    var ab = pinoAB_(lunes, cods, nuevos); if (ab) { pre.unshift(ab.texto); min = ab.min; o['TÍTULO'] = ab.titulo || o['TÍTULO']; }   // v0.30 · semanas A/B de pino
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
    if (P.indexOf(cods[0]) >= 0 || !resto.length) { quitados.push(o['TÍTULO'] || cods[0]); nuevos.splice(i, 1); continue; }
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
// ===================== v29a · RENDIMIENTO · GABI · MURPH · RITMOS · STRAVA =====================
/*
 * Se añade tal cual al final de Code.gs. ES5 (var, function). Todo lo de aquí usa funciones globales de Code.gs.
 *  · APP · RENDIMIENTO: indicadores de progreso (test 2 km, eficiencia Z2, remo 6′, 1RM, RMU, HSPU, metcon de referencia).
 *  · Importa de la app de Gabi (SOLO LECTURA): marcas y resultados del atleta.
 *  · Murph con chaleco en 3 lunes (−6, −4, −2 semanas), «Carrera comprometida» (RC1) y metcon de referencia (RF1).
 *  · Ritmos por zona desde el test de 2 km (propuesta → el atleta confirma).
 *  · Strava (gratis): el secreto vive solo en PROPS 'STRAVA_SECRET', el token en PROPS 'STRAVA_TOKEN'.
 */
HOJAS.RENDIMIENTO = 'APP · RENDIMIENTO';
ESQUEMA['APP · RENDIMIENTO'] = {
  cab: ['FECHA', 'INDICADOR', 'VALOR', 'UNIDAD', 'FUENTE', 'NOTAS', 'REGISTRADO'],
  anchos: [95, 100, 110, 90, 170, 340, 120], fechas: ['FECHA']
};
if (typeof VISIBLES_ !== 'undefined' && VISIBLES_.indexOf(HOJAS.RENDIMIENTO) < 0) VISIBLES_.push(HOJAS.RENDIMIENTO);

var INDICADORES_ = [
  { clave: '2km', nombre: 'Test 2 km', unidad: 'min:seg', mejorEs: 'menor', tipo: 'tiempo', codigos: ['W04', 'R02', 'R03'] },
  { clave: 'z2', nombre: 'Eficiencia Z2', unidad: 'm/min por ppm', mejorEs: 'mayor', tipo: 'num', codigos: ['W01', 'W02'] },
  { clave: 'remo6', nombre: 'EMOM RowErg 6′', unidad: 'kcal', mejorEs: 'mayor', tipo: 'num', codigos: ['R01', 'W03'] },
  { clave: 'snatch', nombre: 'Snatch 1RM', unidad: 'kg', mejorEs: 'mayor', tipo: 'num', codigos: ['W20', 'M05', 'M10', 'M50'] },
  { clave: 'cj', nombre: 'Clean & jerk 1RM', unidad: 'kg', mejorEs: 'mayor', tipo: 'num', codigos: ['W23', 'W24', 'W34', 'M17', 'M07', 'M51'] },
  { clave: 'rmu', nombre: 'RMU máx. unbroken', unidad: 'reps', mejorEs: 'mayor', tipo: 'num', codigos: ['W13', 'M30', 'M49'] },
  { clave: 'hspu', nombre: 'HSPU máx. unbroken', unidad: 'reps', mejorEs: 'mayor', tipo: 'num', codigos: ['W15', 'W16', 'W17', 'W31', 'OP1'] },
  { clave: 'hsw', nombre: 'HSW · 10 m en fatiga', unidad: 'min:seg', mejorEs: 'menor', tipo: 'tiempo', codigos: ['W32', 'W33'] },
  { clave: 'metcon', nombre: 'Metcon de referencia', unidad: '', mejorEs: 'menor', tipo: 'texto', codigos: ['R01', 'R04'] }   // tendencia solo si el valor es un tiempo
];

// ---------- utilidades ----------
function v29Ind_(clave) {
  clave = String(clave || '').toLowerCase().trim();
  var r = INDICADORES_.filter(function (i) { return i.clave === clave; })[0];
  if (!r && clave === 'ref') r = { clave: 'ref', nombre: 'Referencia', unidad: '', mejorEs: '', tipo: 'texto', codigos: [] };
  return r || null;
}
function v29Num_(t) {
  var m = String(t == null ? '' : t).replace(/ /g, ' ').match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}
function v29Seguro_(hoja) { try { return listar_(hoja); } catch (e) { return []; } }
function v29Linea_(t, n) { return String(t || '').split('\n')[0].trim().slice(0, n || 80); }
function v29Media_(a) { return a.reduce(function (s, x) { return s + x; }, 0) / (a.length || 1); }
function v29Redondea_(x, d) { var f = Math.pow(10, d); return Math.round(x * f) / f; }
/** Valor de una clave de APP · CONFIG que guarda una fecha (con o sin «'» delante) → 'yyyy-mm-dd' o ''. */
function v29CfgIso_(clave) { var v = String(leerConfig_()[clave] || '').replace(/^'/, '').trim(); return v ? (celdaIso_(v) || '') : ''; }
function v29CfgJson_(clave) {
  try { var v = String(leerConfig_()[clave] || '').replace(/^'/, '').trim(); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
/** Número comparable de un valor según el tipo del indicador (null si no se puede comparar). */
function valorIndicador_(ind, txt) {
  var s = String(txt == null ? '' : txt).trim().replace(/^'/, '');
  if (!s) return null;
  if (ind.tipo === 'tiempo') { if (!/\d/.test(s)) return null; var sg = segundos_(s); return sg > 0 ? sg : null; }
  if (ind.tipo === 'num') return v29Num_(s);
  if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(s)) { var sg2 = segundos_(s); return sg2 > 0 ? sg2 : null; }   // texto libre: solo si es un tiempo
  return null;
}
function v29Txt_(ind, v, crudo) {
  if (v == null) return String(crudo == null ? '' : crudo).trim();
  if (ind.tipo === 'tiempo' || (ind.tipo === 'texto' && /^\d{1,3}:\d{2}/.test(String(crudo).trim()))) return mmss_(v);
  return String(v29Redondea_(v, 3)).replace('.', ',');
}
function v29Mejor_(ind, vals) {
  return vals.reduce(function (m, x) { return m == null ? x : (ind.mejorEs === 'menor' ? Math.min(m, x) : Math.max(m, x)); }, null);
}
function v29Supera_(ind, a, b) { return ind.mejorEs === 'menor' ? a < b : a > b; }   // ¿a es mejor que b?

// ---------- fuentes automáticas ----------
/** Tests de 2 km de APP · CARRERA: [{fecha, seg}] por fecha. */
function tests2kCarrera_() {
  var out = [];
  v29Seguro_(HOJAS.CARRERA).forEach(function (r) {
    var t = norm(r.TIPO), km = v29Num_(r['DISTANCIA (km)']), seg = segundos_(r.TIEMPO), f = celdaIso_(r.FECHA);
    if (!f || !(seg > 0)) return;
    var es = (t.indexOf('TEST') >= 0 && km != null && km >= 1.9 && km <= 2.1) || /(^|[^0-9])2 ?KM/.test(t);
    if (es) out.push({ fecha: f, seg: seg });
  });
  return out.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
}
/** Eficiencia aeróbica semanal: media de (m/min)/FC de las carreras Z2 de la semana. [{fecha:lunes, v}] */
function eficienciaZ2Semanal_() {
  var por = {};
  v29Seguro_(HOJAS.CARRERA).forEach(function (r) {
    if (norm(r.TIPO).trim().indexOf('Z2') !== 0) return;
    var km = v29Num_(r['DISTANCIA (km)']), seg = segundos_(r.TIEMPO), fc = v29Num_(r['FC MEDIA']), f = celdaIso_(r.FECHA);
    if (!f || !(km > 0 && seg > 0 && fc > 0)) return;
    var l = lunesDe_(f); (por[l] = por[l] || []).push((km * 1000 / (seg / 60)) / fc);
  });
  return Object.keys(por).sort().map(function (l) { return { fecha: l, v: v29Redondea_(v29Media_(por[l]), 3) }; });
}
/** Serie de un indicador: [{fecha, v (número comparable o null), txt}] ordenada por fecha. */
function serieIndicador_(clave) {
  var ind = v29Ind_(clave); if (!ind) return [];
  clave = ind.clave;
  var out = [];
  v29Seguro_(HOJAS.RENDIMIENTO).forEach(function (r) {
    if (String(r.INDICADOR || '').trim().toLowerCase() !== clave) return;
    var f = celdaIso_(r.FECHA); if (!f) return;
    var v = valorIndicador_(ind, r.VALOR);
    out.push({ fecha: f, v: v, txt: v29Txt_(ind, v, r.VALOR) });
  });
  var N = function (v) { return String(v29Redondea_(v, 3)).replace('.', ','); };
  if (clave === 'snatch' || clave === 'cj') {
    v29Seguro_(HOJAS.MARCAS).forEach(function (m) {
      var mov = norm(m.MOVIMIENTO).trim(), tipo = norm(m.TIPO).replace(/\s/g, '');
      var esMov = clave === 'snatch' ? mov === 'SNATCH' : (mov === 'CLEAN & JERK' || mov === 'CLEAN AND JERK' || mov === 'C&J');
      if (!esMov || tipo.indexOf('1RM') < 0) return;
      var f = celdaIso_(m.FECHA), v = v29Num_(m.VALOR); if (!f || v == null) return;
      out.push({ fecha: f, v: v, txt: N(v) });
    });
  } else if (clave === '2km') {
    tests2kCarrera_().forEach(function (t) { out.push({ fecha: t.fecha, v: t.seg, txt: mmss_(t.seg) }); });
  } else if (clave === 'z2') {
    eficienciaZ2Semanal_().forEach(function (w) { out.push({ fecha: w.fecha, v: w.v, txt: N(w.v) }); });
  } else if (clave === 'remo6') {
    v29Seguro_(HOJAS.OPERACION).forEach(function (o) {
      if (!/ROWERG|\bREMO\b/.test(norm(o.REFERENCIA))) return;
      var f = celdaIso_(o.FECHA), v = v29Num_(o.VALOR); if (!f || v == null) return;
      out.push({ fecha: f, v: v, txt: N(v) });
    });
  }
  var vistos = {};
  out = out.filter(function (s) { var k = s.fecha + '|' + s.v + '|' + s.txt; if (vistos[k]) return false; vistos[k] = 1; return true; });
  return out.map(function (s, i) { s._i = i; return s; })
    .sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a._i - b._i; })
    .map(function (s) { return { fecha: s.fecha, v: s.v, txt: s.txt }; });
}

// ---------- exposiciones, alertas y panel ----------
/** {clave: n}: sesiones hechas (REGISTRO «Sí») en las últimas 8 semanas con algún código del indicador. */
function exposiciones8_() {
  var desde = sumarDias(hoyIso_(), -56), plan = {}, vistos = {}, cuenta = {};
  v29Seguro_(HOJAS.PLAN).forEach(function (p) { if (p.ID) plan[p.ID] = p; });
  v29Seguro_(HOJAS.REGISTRO).forEach(function (r) {
    if (norm(r.HECHO).trim() !== 'SI') return;
    var p = plan[r.ID_PLAN]; if (!p) return;
    var f = celdaIso_(r.FECHA) || celdaIso_(p.FECHA); if (!f || f < desde) return;
    var k = r.ID_PLAN + '|' + f; if (vistos[k]) return; vistos[k] = 1;
    var cods = codigosDe_(p['CÓDIGOS']);
    INDICADORES_.forEach(function (ind) {
      if (ind.codigos.some(function (c) { return cods.indexOf(c) >= 0; })) cuenta[ind.clave] = (cuenta[ind.clave] || 0) + 1;
    });
  });
  return cuenta;
}
function alertaIndicador_(ind, serie, exp) {
  var msgs = [];
  if (exp >= 6) {
    var corte = sumarDias(hoyIso_(), -56), rec = [], ant = [];
    serie.forEach(function (s) { if (s.v == null) return; (s.fecha >= corte ? rec : ant).push(s.v); });
    if (ant.length) {
      var mAnt = v29Mejor_(ind, ant), mRec = rec.length ? v29Mejor_(ind, rec) : null;
      if (mRec == null || !v29Supera_(ind, mRec, mAnt)) msgs.push('Ocho semanas sin mejora con ' + exp + ' exposiciones: propongo cambiar la dosis o el ejercicio.');
    }
  }
  if (ind.clave === 'z2') {
    var p = serie.filter(function (s) { return s.v != null; }).slice(-3);
    if (p.length === 3 && p[2].v < p[1].v && p[1].v < p[0].v) msgs.push('La eficiencia aeróbica baja dos semanas seguidas: revisa carga y sueño.');
  }
  return msgs.join(' ');
}
function rendimiento_() {
  var exp = {}, out = { indicadores: [], metconsRef: [], murph: null, residuo: [], ritmos: null, strava: null };
  try { exp = exposiciones8_(); } catch (e) { Logger.log('Rendimiento · exposiciones: ' + e); }
  INDICADORES_.forEach(function (ind) {
    var serie = [], mejor = null, ultimo = null, anterior = null, tend = '', alerta = '';
    try {
      serie = serieIndicador_(ind.clave);
      ultimo = serie.length ? serie[serie.length - 1] : null;
      anterior = serie.length > 1 ? serie[serie.length - 2] : null;
      var con = serie.filter(function (s) { return s.v != null; });
      if (con.length) { var mv = v29Mejor_(ind, con.map(function (s) { return s.v; })); mejor = con.filter(function (s) { return s.v === mv; })[0]; }
      if (ultimo && anterior && ultimo.v != null && anterior.v != null)
        tend = ultimo.v === anterior.v ? 'igual' : (v29Supera_(ind, ultimo.v, anterior.v) ? 'mejora' : 'empeora');
      alerta = alertaIndicador_(ind, serie, exp[ind.clave] || 0);
    } catch (e) { Logger.log('Rendimiento · ' + ind.clave + ': ' + e); }
    out.indicadores.push({ clave: ind.clave, nombre: ind.nombre, unidad: ind.unidad, mejorEs: ind.mejorEs, ultimo: ultimo, anterior: anterior, mejor: mejor,
      tendencia: tend, serie: serie.slice(-40), exp8: exp[ind.clave] || 0, alerta: alerta });
  });
  try { out.metconsRef = metconsReferencia_(); } catch (e) { Logger.log('Rendimiento · metcons: ' + e); }
  try { out.murph = murphInfo_(); } catch (e) { Logger.log('Rendimiento · murph: ' + e); }
  try { out.residuo = residuo_(); } catch (e) { Logger.log('Rendimiento · residuo: ' + e); }
  try { out.ritmos = { vigentes: v29CfgJson_('ritmos_zonas'), propuesta: v29CfgJson_('ritmos_propuesta'), texto: ritmosTexto_() }; } catch (e) { Logger.log('Rendimiento · ritmos: ' + e); }
  try { out.strava = stravaEstado_(); } catch (e) { Logger.log('Rendimiento · strava: ' + e); }
  try { out.garmin = garminEstado_(); } catch (e) { Logger.log('Rendimiento · garmin: ' + e); }
  return out;
}
/** Guarda un valor a mano en APP · RENDIMIENTO. b = {clave, valor, fecha, notas}. */
function guardarRendimiento_(b) {
  var ind = v29Ind_(b && b.clave); if (!ind) throw new Error('indicador_no_valido');
  var valor = String(b.valor == null ? '' : b.valor).trim().slice(0, 500); if (!valor) throw new Error('falta_valor');
  if (ind.tipo !== 'texto' && valorIndicador_(ind, valor) == null) throw new Error('valor_no_valido');
  var iso = (b.fecha && celdaIso_(b.fecha)) || hoyIso_();
  anadirFila_(HOJAS.RENDIMIENTO, { FECHA: isoAFecha(iso), INDICADOR: ind.clave, VALOR: valor, UNIDAD: ind.unidad, FUENTE: 'App Road To Elite', NOTAS: String(b.notas || '').slice(0, 400), REGISTRADO: ahora_() });
  MEMO = null;
  return ind.clave;
}

// ---------- importar de la app de Gabi (SOLO LECTURA) ----------
/** Lee una pestaña de la app de Gabi: cabecera = primera fila (de las 8 primeras) con «ATLETA». → {cab:{NOMBRE:col}, filas:[[...]]} o null. */
function v29TablaGabi_(libro, nombre) {
  var sh = libro.getSheetByName(nombre);
  if (!sh) libro.getSheets().forEach(function (s) { if (!sh && norm(s.getName()).trim() === norm(nombre)) sh = s; });
  if (!sh || !sh.getLastRow()) return null;
  var v = sh.getDataRange().getDisplayValues(), h = -1, i;
  for (i = 0; i < Math.min(v.length, 8) && h < 0; i++) if (v[i].some(function (c) { return norm(c).trim() === 'ATLETA'; })) h = i;
  if (h < 0) return null;
  var cab = {}; v[h].forEach(function (c, j) { var k = norm(c).trim(); if (k && cab[k] === undefined) cab[k] = j; });
  var filas = v.slice(h + 1).filter(function (r) {
    var p = ''; r.some(function (c) { if (String(c).trim()) { p = String(c).trim(); return true; } return false; });
    return p && p.charAt(0) !== '▸';
  });
  return { cab: cab, filas: filas };
}
function v29EsMia_(T, r, email) {
  var g = function (k) { return T.cab[k] === undefined ? '' : String(r[T.cab[k]] || '').trim(); };
  return (email && g('EMAIL').toLowerCase() === email) || norm(g('ATLETA')).indexOf('PABLO SERRANO') >= 0;
}
function importarGabi_() {
  var res = { marcas: 0, resultados: 0 }, email = '';
  try { email = String(leerConfig_().email_permitido || CONFIG.EMAIL_PERMITIDO || '').toLowerCase().trim(); } catch (e) { email = String(CONFIG.EMAIL_PERMITIDO || '').toLowerCase(); }
  var libro = null;
  try { libro = programApp_(); } catch (e) { Logger.log('Gabi · no se abre la app: ' + e); return res; }
  try {
    var T = v29TablaGabi_(libro, 'MARCAS');
    if (T && T.cab.MARCA !== undefined && T.cab.VALOR !== undefined) {
      var ya = {}, nuevas = [];
      v29Seguro_(HOJAS.MARCAS).forEach(function (m) { ya[norm(m.MOVIMIENTO).trim() + '|' + String(m.VALOR).trim() + '|' + celdaIso_(m.FECHA)] = 1; });
      T.filas.forEach(function (r) {
        if (!v29EsMia_(T, r, email)) return;
        var g = function (k) { return T.cab[k] === undefined ? '' : String(r[T.cab[k]] || '').trim(); };
        var mov = g('MARCA').toUpperCase(), val = g('VALOR'); if (!mov || !val) return;
        var iso = celdaIso_(g('FECHA')) || '', k = norm(mov).trim() + '|' + val + '|' + iso;
        if (ya[k]) return; ya[k] = 1;
        nuevas.push({ FECHA: iso ? isoAFecha(iso) : g('FECHA'), MOVIMIENTO: mov, TIPO: g('TIPO'), VALOR: val, UNIDAD: '', EVENTO: g('EVENTO'), NOTAS: g('NOTAS'), FUENTE: 'App Gabi' });
      });
      res.marcas = filasEnHoja_(HOJAS.MARCAS, nuevas);
    }
  } catch (e) { Logger.log('Gabi · marcas: ' + e); }
  try {
    var R = v29TablaGabi_(libro, 'RESULTADOS');
    if (R && R.cab.RESULTADO !== undefined && R.cab.FECHA !== undefined) {
      var ya2 = {}, nuevas2 = [];
      v29Seguro_(HOJAS.RENDIMIENTO).forEach(function (x) { if (String(x.INDICADOR).trim().toLowerCase() === 'wod') ya2[celdaIso_(x.FECHA) + '|' + norm(x.NOTAS).trim()] = 1; });
      R.filas.forEach(function (r) {
        if (!v29EsMia_(R, r, email)) return;
        var g = function (k) { return R.cab[k] === undefined ? '' : String(r[R.cab[k]] || '').trim(); };
        var res1 = g('RESULTADO'), iso = celdaIso_(g('FECHA')), wod = (g('WOD') || g('METCON')).slice(0, 400);
        if (!res1 || !iso) return;
        var k = iso + '|' + norm(wod).trim(); if (ya2[k]) return; ya2[k] = 1;
        nuevas2.push({ FECHA: isoAFecha(iso), INDICADOR: 'wod', VALOR: res1, UNIDAD: g('TIPO'), FUENTE: 'App Gabi · RESULTADOS', NOTAS: wod, REGISTRADO: ahora_() });
      });
      res.resultados = filasEnHoja_(HOJAS.RENDIMIENTO, nuevas2);
    }
  } catch (e) { Logger.log('Gabi · resultados: ' + e); }
  MEMO = null;
  return res;
}

// ---------- metcons de referencia (hasta 3) ----------
var METCONS_CLASICOS_ = [
  ['Fran', '21-15-9 · Thrusters (43/30 kg) + pull-ups. Por tiempo.'],
  ['Grace', '30 clean & jerk (61/43 kg). Por tiempo.'],
  ['Isabel', '30 snatch (61/43 kg). Por tiempo.'],
  ['Diane', '21-15-9 · Peso muerto (102/70 kg) + HSPU. Por tiempo.'],
  ['Helen', '3 rondas: 400 m carrera + 21 KB swing (24/16 kg) + 12 pull-ups. Por tiempo.'],
  ['Cindy', 'AMRAP 20′: 5 pull-ups + 10 push-ups + 15 air squats.'],
  ['DT', '5 rondas: 12 peso muerto + 9 hang power clean + 6 push jerk (70/47,5 kg). Por tiempo.'],
  ['Murph con chaleco', '1 milla carrera + 100 pull-ups + 200 push-ups + 300 air squats + 1 milla carrera, con chaleco (9/6 kg). Por tiempo; partición libre (p. ej. 5-10-15).']
];
function metconsReferencia_() {
  var out = [], vistos = {};
  var add = function (titulo, texto, motivo, fuente) {
    titulo = String(titulo || '').trim(); var k = norm(titulo); if (!titulo || vistos[k] || out.length >= 3) return;
    vistos[k] = 1; out.push({ titulo: titulo.slice(0, 80), texto: String(texto || '').trim(), motivo: motivo, fuente: fuente });
  };
  var filas = v29Seguro_(HOJAS.RENDIMIENTO);
  // (a) guardados como referencia: más reciente primero
  filas.filter(function (r) { return /^(metcon|ref)$/.test(String(r.INDICADOR || '').trim().toLowerCase()); })
    .sort(function (a, b) { var x = celdaIso_(a.FECHA), y = celdaIso_(b.FECHA); return x < y ? 1 : x > y ? -1 : b._fila - a._fila; })
    .forEach(function (r) {
      var t = v29Linea_(r.NOTAS) || v29Linea_(r.VALOR, 60);
      if (/^\d{1,3}:\d{2}/.test(t)) t = 'Metcon de referencia · ' + t;   // un tiempo suelto no es un título
      add(t, r.VALOR, 'Lo marcaste como referencia', 'Rendimiento');
    });
  v29Seguro_('APP · FICHAS').forEach(function (f) {
    if (norm(f.REFERENCIA).trim() !== 'SI') return;
    var w = f.WOD || f.CONTENIDO || f.TEXTO || ''; add(f['TÍTULO'] || f.NOMBRE || ((f.EVENTO ? f.EVENTO + ' · ' : '') + (v29Linea_(w, 50) || 'WOD de competición')), w, f['QUÉ FALLÓ'] ? 'Ficha de competición: ' + String(f['QUÉ FALLÓ']).slice(0, 120) : 'Lo marcaste como referencia', 'Fichas');
  });
  // (b) peor resultado del último ciclo de 6 semanas (sin ranking: el más lento en tiempo / el que menos reps en AMRAP)
  if (out.length < 3) {
    var desde = sumarDias(hoyIso_(), -42), tiempos = [], amraps = [];
    filas.forEach(function (r) {
      if (String(r.INDICADOR || '').trim().toLowerCase() !== 'wod') return;
      var f = celdaIso_(r.FECHA); if (!f || f < desde) return;
      var u = norm(r.UNIDAD), val = String(r.VALOR || '').trim();
      var esT = /TIEMPO|TIME/.test(u) || (/^\d{1,3}:\d{2}/.test(val) && !/AMRAP|REPS|RONDAS/.test(u));
      var o = { r: r, fecha: f };
      if (esT) { o.k = segundos_(val); if (o.k > 0) tiempos.push(o); }
      else { o.k = v29Num_(val); if (o.k != null) amraps.push(o); }
    });
    tiempos.sort(function (a, b) { return b.k - a.k; }); amraps.sort(function (a, b) { return a.k - b.k; });
    var cola = [], i;
    for (i = 0; i < Math.max(tiempos.length, amraps.length); i++) { if (tiempos[i]) cola.push(tiempos[i]); if (amraps[i]) cola.push(amraps[i]); }
    cola.forEach(function (o) {
      add(v29Linea_(o.r.NOTAS, 60), String(o.r.NOTAS || '') + '\nTu resultado: ' + o.r.VALOR + ' (' + isoAFecha(o.fecha).slice(0, 5) + ')', 'Tu peor resultado del ciclo', 'App Gabi');
    });
  }
  // (c) benchmarks clásicos, rotando cada semana
  if (out.length < 3) {
    var sem = Math.floor(new Date(hoyIso_() + 'T12:00:00Z').getTime() / 86400000 / 7), n = METCONS_CLASICOS_.length, j;
    for (j = 0; j < n && out.length < 3; j++) { var c = METCONS_CLASICOS_[(sem + j) % n]; add(c[0], c[1], 'Benchmark clásico', 'Clásico'); }
  }
  return out;
}
/** Crea un BORRADOR de metcon de referencia (RF1) en APP · PLAN y devuelve la semana. b = {titulo, texto, iso, turno}. */
function programarReferencia_(b) {
  var iso = isoOk_(b && b.iso) || celdaIso_(b && b.iso); if (!iso) throw new Error('fecha_no_valida');
  var turno = String(b.turno || 'PM').toUpperCase() === 'AM' ? 'AM' : 'PM', id = nuevoId_(), titulo = String(b.titulo || 'Metcon de referencia').slice(0, 120);
  anadirFila_(HOJAS.PLAN, { ID: id, FECHA: isoAFecha(iso), 'DÍA': diaDe_(iso), TURNO: turno, ORDEN: turno === 'AM' ? 6 : 85, ORIGEN: 'EXTRA', BLOQUE: titulo, 'TÍTULO': titulo,
    CONTENIDO: String(b.texto || '').slice(0, 4000), MIN: 25, 'CÓDIGOS': 'RF1', 'POR QUÉ (cursiva)': 'Metcon de referencia: se repite cada cierto tiempo para medir tu progreso en las mismas condiciones.',
    ESTADO: 'BORRADOR', GENERADO: 'manual ' + ahora_() + ' (candado)', ACTUALIZADO: ahora_() });
  MEMO = null;
  var semana = null; try { semana = semanaCompleta_(lunesDe_(iso)); } catch (e) { Logger.log('Referencia · semana no legible: ' + e); }   // la fila ya está creada: no se reintenta
  return { ok: true, id: id, semana: semana };
}

// ---------- Murph con chaleco ----------
var MURPH_PLAN_ = [
  { sem: -6, rondas: 10, carrera: '800 m', titulo: 'Murph con chaleco · ½ (5-10-15)', min: 40, pq: 'Primer ensayo: la mitad del volumen con el chaleco puesto; el objetivo es aprender el reparto, no el tiempo.' },
  { sem: -4, rondas: 15, carrera: '1,2 km', titulo: 'Murph con chaleco · ¾ (5-10-15)', min: 50, pq: 'Segundo ensayo: sube a ¾ y la carrera a 1,2 km. Mismo chaleco y mismo reparto: la fatiga acumulada de pull-ups y squats es lo que se entrena.' },
  { sem: -2, rondas: 20, carrera: '1 milla (1,6 km)', titulo: 'Murph con chaleco · completo (5-10-15)', min: 65, pq: 'Ensayo general a dos semanas: Murph completo particionado, con chaleco, a RPE 7–8 para llegar con reserva y con el ritmo ya probado.' }
];
function murphSesiones_(fecha) {
  var f = celdaIso_(String(fecha || '').replace(/^'/, '')); if (!f) return [];
  var l = lunesDe_(f), hoy = hoyIso_();
  return MURPH_PLAN_.map(function (p, i) {
    var iso = sumarDias(l, p.sem * 7), pu = p.rondas * 5, pp = p.rondas * 10, sq = p.rondas * 15;
    var cont = (i === 0 ? '½' : i === 1 ? '¾' : 'COMPLETO') + ' MURPH CON CHALECO · RPE 7–8\n' + p.carrera + ' carrera\n' + p.rondas + ' rondas × (5 pull-ups + 10 push-ups + 15 squats) = ' + pu + ' / ' + pp + ' / ' + sq + '\n' + p.carrera + ' carrera\n\n' +
      'Todo con el chaleco puesto, de principio a fin (el mismo del Murph). Reparto 5-10-15: nunca a fallo, respira entre rondas.\n' +
      (i === 2 ? 'Es el ensayo general: mismo orden, mismo ritmo de carrera y misma nutrición que el día D. Anota el tiempo cada 5 rondas.' : 'Anota el tiempo total, el de cada carrera y el de cada 5 rondas. Si la técnica del pull-up se rompe, baja a 4-8-12.');
    return { fecha: iso, semana: p.sem, titulo: p.titulo, contenido: cont, min: p.min, pq: p.pq, pasada: iso < hoy };
  });
}
function murphInfo_() {
  var f = v29CfgIso_('murph_fecha'); if (!f) return null;
  return { fecha: f, dias: Math.round((new Date(f + 'T12:00:00Z').getTime() - new Date(hoyIso_() + 'T12:00:00Z').getTime()) / 86400000), sesiones: murphSesiones_(f) };
}
/** Guarda (o borra, si va vacía) la fecha del Murph. */
function murphFecha_(fecha) {
  var f = String(fecha || '').trim() ? celdaIso_(String(fecha).trim()) : '';
  if (String(fecha || '').trim() && !f) throw new Error('fecha_no_valida');
  ponerConfig_('murph_fecha', f ? "'" + f : '', 'Fecha del Murph (los lunes −6, −4 y −2 semanas llevan ensayo con chaleco)');
  MEMO = null;
  return { ok: true, murph: murphInfo_() };
}
/** Bloques de ensayo de Murph que tocan en la semana de ese lunes (para que el generador los añada). */
function murphBloquesSemana_(lunes) {
  var l = lunesDe_(lunes), f = v29CfgIso_('murph_fecha'); if (!f) return [];
  var s = murphSesiones_(f).filter(function (x) { return x.fecha === l; })[0]; if (!s) return [];
  return [{ FECHA: isoAFecha(l), 'DÍA': 'Lunes', TURNO: 'AM', ORIGEN: 'EXTRA', 'TÍTULO': s.titulo, CONTENIDO: s.contenido, MIN: s.min, 'CÓDIGOS': 'MU1', INTENSIDAD: '🟠 Calidad', 'POR QUÉ (cursiva)': s.pq }];
}

// ---------- siembra: carrera comprometida (RC1), metcon de referencia (RF1), Murph (MU1) ----------
var V29_EST_ = [
  { 'CÓDIGO': 'RC1', NOMBRE: 'Test de carrera comprometida', ORIGEN: 'EXTRA', TURNO: 'PM', MIN: 35, INTENSIDAD: '🟠 Calidad',
    CONTENIDO: '3 rondas: 60–90″ de estación (ronda 1: 15 wall balls · ronda 2: 12 cal remo · ronda 3: 20 m zancada con KB) + 400 m con reloj.\n3′ de pausa entre rondas.\nRegistra el parcial de los primeros 200 m y el de los 400 m de cada ronda.',
    'POR QUÉ (cursiva)': 'Correr con las piernas y la respiración ya comprometidas es lo que pasa en un HYROX o en un metcon con carrera: aquí se mide cuánto ritmo conservas.',
    'CIENCIA (técnica · fisiología · biología)': 'Técnica: zancada corta y cadencia alta desde el primer paso. Fisiología: tolerancia al lactato y economía de carrera con fatiga previa. Biología: la caída del segundo 200 m frente al primero mide el coste de la estación.',
    INTERFERENCIAS: '≥48 h de otra sesión de pierna pesada o de Z6–Z8.', CARGA: 'IMPACTO GLUC PIERNA', 'DATOS A REGISTRAR': 'Parcial 200 m y 400 m de cada ronda, estación, FC y RPE' },
  { 'CÓDIGO': 'RF1', NOMBRE: 'Metcon de referencia', ORIGEN: 'EXTRA', TURNO: 'PM', MIN: 25, INTENSIDAD: '🟠 Calidad',
    CONTENIDO: 'El contenido real lo pone el generador (un metcon de referencia que se repite para comparar).',
    'POR QUÉ (cursiva)': 'Repetir el mismo metcon cada cierto tiempo es la forma más limpia de medir si el motor mejora.',
    'CIENCIA (técnica · fisiología · biología)': 'Técnica: mismas cargas y mismos movimientos. Fisiología: respuesta glucolítica comparable entre fechas. Biología: tiempo y reps solo valen si el descanso y la hora son parecidos.',
    INTERFERENCIAS: '≥48 h de otra sesión intensa.', CARGA: 'GLUC', 'DATOS A REGISTRAR': 'Tiempo o reps, cargas y RPE' },
  { 'CÓDIGO': 'MU1', NOMBRE: 'Murph con chaleco · ensayo', ORIGEN: 'EXTRA', TURNO: 'AM', MIN: 50, INTENSIDAD: '🟠 Calidad',
    CONTENIDO: 'Lo pone el calendario del Murph (½ → ¾ → completo, partición 5-10-15, con chaleco).',
    'POR QUÉ (cursiva)': 'Ensayo progresivo del Murph con chaleco en las semanas −6, −4 y −2.',
    'CIENCIA (técnica · fisiología · biología)': 'Técnica: reparto 5-10-15 sin ir a fallo. Fisiología: resistencia muscular de tirón, empuje y pierna con carrera. Biología: el chaleco sube el coste de cada repetición.',
    INTERFERENCIAS: 'Sin pierna pesada ni Z6–Z8 las 48 h previas.', CARGA: 'PIERNA AGARRE IMPACTO GLUC', 'DATOS A REGISTRAR': 'Tiempo total, tiempos de carrera y de cada 5 rondas' }
];
var V29_METAS_ = [
  { ID: 'v29rc001', 'ÁMBITO': 'Mes', PRIORIDAD: 'P3 · Carrera comprometida', 'ESTÍMULO': 'TEST DE CARRERA COMPROMETIDA', META: '1', TIPO: 'COUNT', UNIDAD: 'tests/mes', 'CÓDIGOS': 'RC1', ACTIVA: 'Sí',
    NOTAS: 'v29a · 3 × (estación 60–90″ + 400 m) con parciales de 200 y 400 m.' },
  { ID: 'v29rf001', 'ÁMBITO': 'Mes', PRIORIDAD: 'P3 · Metcon de referencia', 'ESTÍMULO': 'METCON DE REFERENCIA', META: '1', TIPO: 'COUNT', UNIDAD: 'sesiones/mes', 'CÓDIGOS': 'RF1', ACTIVA: 'Sí',
    NOTAS: 'v29a · el generador pone el metcon (de APP · RENDIMIENTO o benchmark clásico).' }
];
/** Siembra RC1, RF1 y MU1 + sus metas sin duplicar (patrón de opPrepararCatalogo_). Devuelve un texto de log. */
function prepararV29a_() {
  var cat = {}; listar_(HOJAS.ESTIMULOS).forEach(function (r) { cat[String(r['CÓDIGO']).trim().toUpperCase()] = 1; });
  var nuevas = V29_EST_.filter(function (e) { return !cat[e['CÓDIGO']]; }).map(function (e) { var o = Object.assign({}, e); o.ACTIVO = 'Sí'; return o; });
  filasEnHoja_(HOJAS.ESTIMULOS, nuevas);
  var metas = {}; listar_(HOJAS.METAS).forEach(function (m) { metas[m.ID] = 1; });
  var nm = V29_METAS_.filter(function (m) { return !metas[m.ID]; });
  filasEnHoja_(HOJAS.METAS, nm); MEMO = null;
  return nuevas.length + ' estímulos y ' + nm.length + ' metas nuevas (RC1, RF1, MU1) · hoja de rendimiento: ' + (function () { try { hojaMia_(HOJAS.RENDIMIENTO); return 'lista'; } catch (e) { return 'se crea al preparar las hojas'; } })();
}

// ---------- residuo: qué estímulos dejan más cansancio al día siguiente ----------
function residuo_() {
  var desde = sumarDias(hoyIso_(), -56), plan = {}, cans = {}, todos = [], cat = {}, porCod = {}, vistos = {};
  try { cat = catalogo_(); } catch (e) {}
  v29Seguro_(HOJAS.PLAN).forEach(function (p) { if (p.ID) plan[p.ID] = p; });
  v29Seguro_(HOJAS.CHEQUEO).forEach(function (c) {
    var f = celdaIso_(c.FECHA), v = v29Num_(c['CANSANCIO (1-10)']); if (!f || v == null || f < desde) return;
    cans[f] = v; todos.push(v);
  });
  if (!todos.length) return [];
  var global = v29Media_(todos);
  v29Seguro_(HOJAS.REGISTRO).forEach(function (r) {
    if (norm(r.HECHO).trim() !== 'SI') return;
    var p = plan[r.ID_PLAN]; if (!p) return;
    var f = celdaIso_(r.FECHA) || celdaIso_(p.FECHA); if (!f || f < desde) return;
    var sig = cans[sumarDias(f, 1)]; if (sig === undefined) return;
    codigosDe_(p['CÓDIGOS']).forEach(function (c) {
      var k = c + '|' + f; if (vistos[k]) return; vistos[k] = 1;
      (porCod[c] = porCod[c] || []).push(sig);
    });
  });
  return Object.keys(porCod).filter(function (c) { return porCod[c].length >= 2; }).map(function (c) {
    var e = cat[c] || {};
    return { codigo: c, nombre: e.NOMBRE || c, delta: v29Redondea_(v29Media_(porCod[c]) - global, 2), n: porCod[c].length };
  }).filter(function (x) { return x.delta > 0; }).sort(function (a, b) { return b.delta - a.delta; }).slice(0, 6);
}

// ---------- ritmos por zona desde el test de 2 km ----------
function ritmosDesde2k_(seg) {
  var p2 = seg / 2;
  return { z5: mmss_(p2 + 3), z4: mmss_(p2 * 1.10), z2: [mmss_(p2 * 1.40), mmss_(p2 * 1.50)] };
}
/** Si hay un test de 2 km más nuevo que los ritmos vigentes, guarda la PROPUESTA (no la aplica). Devuelve la propuesta o null. */
function revisarRitmos_() {
  var tests = tests2kCarrera_(); if (!tests.length) return null;
  var t = tests[tests.length - 1], vig = v29CfgJson_('ritmos_zonas'), pro = v29CfgJson_('ritmos_propuesta');
  if (vig && vig.de && vig.de >= t.fecha) return null;
  if (pro && pro.de === t.fecha) return pro;
  var r = ritmosDesde2k_(t.seg), prop = { de: t.fecha, t2k: mmss_(t.seg), z2: r.z2, z4: r.z4, z5: r.z5 };
  ponerConfig_('ritmos_propuesta', JSON.stringify(prop), 'Ritmos propuestos tras el test de 2 km: confírmalos en la app');
  MEMO = null;
  try { enviarPush_('Ritmos nuevos propuestos', 'Tras tu test de 2 km (' + prop.t2k + ') propongo Z2 ' + prop.z2[0] + '–' + prop.z2[1] + ' · Z4 ' + prop.z4 + ' · Z5 ' + prop.z5 + ' /km. Confírmalos en Rendimiento.'); } catch (e) { /* sin avisos */ }
  return prop;
}
function ritmosConfirmar_() {
  var pro = v29CfgJson_('ritmos_propuesta'); if (!pro || !pro.de) return { ok: false, error: 'sin_propuesta' };
  ponerConfig_('ritmos_zonas', JSON.stringify(pro), 'Ritmos vigentes por zona (de ' + pro.de + ')');
  ponerConfig_('ritmos_propuesta', '', 'Ritmos propuestos tras el test de 2 km: confírmalos en la app');
  MEMO = null;
  return { ok: true, ritmos: pro, texto: ritmosTexto_() };
}
function ritmosTexto_() {
  var v = v29CfgJson_('ritmos_zonas'); if (!v || !v.z2 || !v.z4 || !v.z5) return '';
  return 'Ritmos vigentes · Z2 ' + v.z2[0] + '–' + v.z2[1] + '/km · Z4 ' + v.z4 + '/km · Z5 ' + v.z5 + '/km';
}

// ---------- Strava ----------
function stravaUrl_() {
  var id = String(leerConfig_().strava_client_id || '').replace(/^'/, '').trim(); if (!id) return '';
  var st = Utilities.getUuid().replace(/-/g, '') + Math.random().toString(36).slice(2);
  CacheService.getScriptCache().put('strava_estado_' + st, '1', 600);
  return 'https://www.strava.com/oauth/authorize?client_id=' + encodeURIComponent(id) + '&response_type=code&redirect_uri=' + encodeURIComponent(ScriptApp.getService().getUrl()) +
    '&scope=activity:read_all&approval_prompt=auto&state=' + encodeURIComponent(st);
}
function v29Html_(titulo, texto) {
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;padding:2em;max-width:30em;margin:auto"><h2>' + titulo + '</h2><p>' + texto + '</p></body>');
}
/** doGet(e) la llama cuando llegan e.parameter.code y e.parameter.state. */
function stravaCallback_(e) {
  try {
    var p = (e && e.parameter) || {}, cache = CacheService.getScriptCache(), k = 'strava_estado_' + String(p.state || '');
    if (!p.state || !cache.get(k)) return v29Html_('Enlace caducado', 'El enlace de conexión con Strava ha caducado o no es válido. Vuelve a la app y pulsa «Conectar Strava».');
    try { cache.remove(k); } catch (e2) { /* el estado caduca solo a los 10 min */ }
    if (p.error || !p.code) return v29Html_('Strava no conectado', 'No has autorizado el acceso a Strava. Puedes cerrar esta pestaña y volver a intentarlo desde la app.');
    var id = String(leerConfig_().strava_client_id || '').replace(/^'/, '').trim(), secreto = PROPS.getProperty('STRAVA_SECRET');
    if (!id || !secreto) return v29Html_('Falta configurar Strava', 'Falta el Client ID (APP · CONFIG › strava_client_id) o el secreto (propiedad STRAVA_SECRET del script).');
    var r = UrlFetchApp.fetch('https://www.strava.com/oauth/token', { method: 'post', muteHttpExceptions: true,
      payload: { client_id: id, client_secret: secreto, code: p.code, grant_type: 'authorization_code' } });
    var d = JSON.parse(r.getContentText() || '{}');
    if (r.getResponseCode() !== 200 || !d.access_token) return v29Html_('No se pudo conectar', 'Strava no ha aceptado la conexión. Revisa el Client ID y el secreto.');
    PROPS.setProperty('STRAVA_TOKEN', JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }));
    return v29Html_('Strava conectado', 'Strava conectado, ya puedes cerrar esta pestaña.');
  } catch (err) { return v29Html_('Error', 'No se pudo completar la conexión con Strava.'); }
}
/** Token válido (refresca si caduca en menos de 2 min). '' si no hay conexión. */
function stravaToken_() {
  var raw = PROPS.getProperty('STRAVA_TOKEN'); if (!raw) return '';
  var t; try { t = JSON.parse(raw); } catch (e) { return ''; }
  if (!t || !t.access_token) return '';
  if (t.expires_at && t.expires_at - 120 > Math.floor(Date.now() / 1000)) return t.access_token;
  var id = String(leerConfig_().strava_client_id || '').replace(/^'/, '').trim(), secreto = PROPS.getProperty('STRAVA_SECRET');
  if (!id || !secreto || !t.refresh_token) return '';
  var r = UrlFetchApp.fetch('https://www.strava.com/oauth/token', { method: 'post', muteHttpExceptions: true,
    payload: { client_id: id, client_secret: secreto, grant_type: 'refresh_token', refresh_token: t.refresh_token } });
  var d = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200 || !d.access_token) return '';
  PROPS.setProperty('STRAVA_TOKEN', JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token || t.refresh_token, expires_at: d.expires_at }));
  return d.access_token;
}
function v29TipoCarrera_(p) {
  var cods = codigosDe_(p && p['CÓDIGOS']), txt = norm((p && p['TÍTULO']) + ' ' + (p && p.CONTENIDO));
  if (/TEST/.test(txt) && /(^|[^0-9])2 ?KM/.test(txt)) return 'Test 2 km';
  if (cods.indexOf('R03') >= 0) return 'Z5 VO2max';
  if (cods.indexOf('W04') >= 0 || cods.indexOf('R02') >= 0) return 'Z4 umbral';
  if (cods.indexOf('W01') >= 0) return 'Z2 larga';
  return 'Z2';
}
function v29EsPlanCarrera_(p) {
  var e = norm(p.ESTADO); if (/CANCEL|SUSTITU|NO HACER/.test(e)) return false;
  if (norm(p.ORIGEN).trim() === 'CARRERA') return true;
  return codigosDe_(p['CÓDIGOS']).some(function (c) { return /^(W01|W02|W04|R02|R03|V01)$/.test(c); });
}
function stravaSync_() {
  try {
    var tok = stravaToken_(); if (!tok) return { ok: false, motivo: 'sin_conectar' };
    var cfg = leerConfig_(), ahora = Math.floor(Date.now() / 1000), desde = parseInt(String(cfg.strava_ultima || '').replace(/^'/, ''), 10) || (ahora - 3 * 86400);
    var acts = [], pg;
    for (pg = 1; pg <= 4; pg++) {
      var r = UrlFetchApp.fetch('https://www.strava.com/api/v3/athlete/activities?after=' + desde + '&per_page=50&page=' + pg, { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
      if (r.getResponseCode() === 401) return { ok: false, motivo: 'token' };
      if (r.getResponseCode() !== 200) return { ok: false, motivo: 'strava_' + r.getResponseCode() };
      var lote = JSON.parse(r.getContentText() || '[]'); acts = acts.concat(lote);
      if (lote.length < 50) break;
    }
    var plan = v29Seguro_(HOJAS.PLAN), carr = v29Seguro_(HOJAS.CARRERA), nuevas = 0, actualizadas = 0, maxEpoch = desde;
    acts.forEach(function (a) {
      var inicio = a.start_date ? Math.floor(new Date(a.start_date).getTime() / 1000) : 0; if (inicio > maxEpoch) maxEpoch = inicio;
      var tipoS = String(a.sport_type || a.type || ''); if (tipoS !== 'Run' && tipoS !== 'TrailRun' && String(a.type || '') !== 'Run') return;
      var iso = Utilities.formatDate(new Date(a.start_date), CONFIG.ZONA, 'yyyy-MM-dd'), nota = 'Strava · ' + String(a.name || '').slice(0, 120);
      var km = (a.distance || 0) / 1000, seg = a.moving_time || 0; if (!(seg > 0)) return;
      var cands = plan.filter(function (p) { return celdaIso_(p.FECHA) === iso && v29EsPlanCarrera_(p); });
      var existe = function (idp) { return carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && String(c.ID_PLAN || '') === String(idp || ''); })[0]; };
      var p = cands.filter(function (x) { return !existe(x.ID); })[0] || cands.filter(function (x) { var e = existe(x.ID); return e && String(e.NOTAS || '').indexOf(nota) >= 0; })[0] || cands[0] || null;
      var idPlan = p ? p.ID : '', ex = existe(idPlan);
      if (!idPlan) {   // sin plan: la misma actividad (misma nota) o, si no, la única carrera manual de ese día con distancia parecida (±5 %); si no, fila nueva
        var delDia = carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && !String(c.ID_PLAN || '').trim(); });
        ex = delDia.filter(function (c) { return String(c.NOTAS || '').indexOf(nota) >= 0; })[0] || null;
        if (!ex) {
          var manuales = delDia.filter(function (c) { var kc = v29Num_(c['DISTANCIA (km)']); return !/^Strava/.test(String(c.NOTAS || '')) && kc > 0 && km > 0 && Math.abs(kc - km) / km <= 0.05; });
          if (manuales.length === 1) ex = manuales[0];
        }
      }
      var n = { FECHA: isoAFecha(iso), ID_PLAN: idPlan, TIPO: p ? v29TipoCarrera_(p) : 'Z2', 'DISTANCIA (km)': km.toFixed(2).replace('.', ','),
        TIEMPO: seg >= 3600 ? Math.floor(seg / 3600) + ':' + ('0' + Math.floor((seg % 3600) / 60)).slice(-2) + ':' + ('0' + (seg % 60)).slice(-2) : mmss_(seg),
        NOTAS: nota };
      if (km > 0) n['RITMO MEDIO (/km)'] = mmss_(seg / km);
      if (a.average_heartrate) n['FC MEDIA'] = Math.round(a.average_heartrate);
      if (a.max_heartrate) n['FC MÁX'] = Math.round(a.max_heartrate);
      if (a.total_elevation_gain != null) n['DESNIVEL (m)'] = Math.round(a.total_elevation_gain);
      if (a.average_cadence) n.CADENCIA = Math.round(a.average_cadence * 2);
      if (a.average_temp != null) n['TEMPERATURA (°C)'] = a.average_temp;
      if (ex) {
        var vacios = {}, hay = false;
        Object.keys(n).forEach(function (h) { if (!String(ex[h] == null ? '' : ex[h]).trim() && String(n[h]) !== '') { vacios[h] = n[h]; hay = true; } });
        if (hay) { actualizarFila_(HOJAS.CARRERA, ex._fila, vacios); actualizadas++; Object.keys(vacios).forEach(function (h) { ex[h] = vacios[h]; }); }
      } else {
        n.ID = nuevoId_(); n.REGISTRADO = ahora_();
        anadirFila_(HOJAS.CARRERA, n); nuevas++;
        carr.push({ FECHA: n.FECHA, ID_PLAN: idPlan, NOTAS: nota, _fila: 0 });
      }
    });
    if (acts.length) ponerConfig_('strava_ultima', String(maxEpoch + 1), 'Strava · última actividad sincronizada (epoch)');
    MEMO = null;
    if (nuevas + actualizadas) { try { analizarCarrera_(); } catch (e) { /* no frena la sincronización */ } }
    return { ok: true, nuevas: nuevas, actualizadas: actualizadas, vistas: acts.length };
  } catch (err) { return { ok: false, motivo: 'error', detalle: String(err && err.message || err) }; }
}
function stravaEstado_() {
  var cfg = leerConfig_(), cfgd = !!String(cfg.strava_client_id || '').replace(/^'/, '').trim(), con = !!PROPS.getProperty('STRAVA_TOKEN'), url = '', ult = '';
  if (cfgd && !con) { try { url = stravaUrl_(); } catch (e) { url = ''; } }
  var ep = parseInt(String(cfg.strava_ultima || '').replace(/^'/, ''), 10);
  if (ep > 0) ult = Utilities.formatDate(new Date(ep * 1000), CONFIG.ZONA, 'dd/MM/yyyy HH:mm');
  return { configurado: cfgd, conectado: con, url: url, ultima: ult };
}

// ---------- disparadores ----------
/** Una vez al día (colgar de motorDiario o similar). */
function v29aDiario_() {
  var r = {};
  try { r.gabi = importarGabi_(); } catch (e) { Logger.log('v29a · Gabi: ' + e); }
  try { r.ritmos = revisarRitmos_(); } catch (e) { Logger.log('v29a · ritmos: ' + e); }
  try { r.garmin = garminDiario_(); } catch (e) { Logger.log('Garmin: ' + e); }   // v0.30
  return r;
}
/** Cada hora (colgar de revisarAvisos): sincroniza Strava solo si está conectado. */
function v29aCadaHora_() {
  try { if (PROPS.getProperty('STRAVA_TOKEN')) return stravaSync_(); } catch (e) { Logger.log('v29a · Strava: ' + e); }
  return null;
}


// ===================== v0.30 · GARMIN (API personal gratuita) · 1 vez al día, solo días de carrera o ergómetro =====================
// Clave: Apps Script › Propiedades del script › GARMIN_KEY (nunca en el código ni en el Sheet). Doc: developer.garmin.com/gc-developer-program/personal/
var GARMIN_API_ = 'https://personal.connectapi.garmin.com';
var GARMIN_ERG_ = /ROW|REMO|SKI|BIKE|ASSAULT|AIR ?BIKE|ECHO|ERG|BICI|AIRBIKE/;
function garminToken_() {
  var key = PROPS.getProperty('GARMIN_KEY'); if (!key) return '';
  var c = CacheService.getScriptCache(), t = c.get('garmin_token'); if (t) return t;
  var r = UrlFetchApp.fetch(GARMIN_API_ + '/personalapitoken-service/personal-api/personal-api-key/token', { method: 'post', headers: { Authorization: 'ApiKey ' + key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('garmin_token_' + r.getResponseCode());
  var txt = r.getContentText() || '', d = {}; try { d = JSON.parse(txt); } catch (e) { d = { access_token: txt.trim() }; }
  t = d.access_token || d.accessToken || d.token || ''; if (!t) throw new Error('garmin_token_vacio');
  var vida = Math.max(300, Math.min(21600, (+d.expires_in || +d.expiresIn || 3600) - 120));
  c.put('garmin_token', t, vida);
  return t;
}
function garminGet_(ruta) {
  var tok = garminToken_(); if (!tok) throw new Error('garmin_sin_clave');
  var r = UrlFetchApp.fetch(GARMIN_API_ + ruta, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' }, muteHttpExceptions: true });
  if (r.getResponseCode() === 401) { CacheService.getScriptCache().remove('garmin_token'); throw new Error('garmin_401'); }
  if (r.getResponseCode() !== 200) throw new Error('garmin_' + r.getResponseCode());
  return JSON.parse(r.getContentText() || 'null');
}
/** Qué toca ese día según el plan: carrera, ergómetro o nada (nada → no se llama a Garmin). */
function garminQueToca_(iso) {
  var plan = v29Seguro_(HOJAS.PLAN).filter(function (p) { return celdaIso_(p.FECHA) === iso && !/CANCEL|SUSTITU|NO HACER|PROPUESTA|SIN HUECO/.test(norm(p.ESTADO)); });
  var esErg = function (p) { var t = norm((p['TÍTULO'] || '') + ' ' + (p.BLOQUE || '') + ' ' + (p.CONTENIDO || '')); return GARMIN_ERG_.test(t) || codigosDe_(p['CÓDIGOS']).some(function (c) { return c === 'W03' || c === 'R01'; }); };
  var carrera = plan.filter(function (p) { return v29EsPlanCarrera_(p) && !(esErg(p) && !/RUN|CARRERA|CORRER|TROTE/.test(norm((p['TÍTULO'] || '') + ' ' + (p.CONTENIDO || '')))); });
  var erg = plan.filter(function (p) { return esErg(p) && carrera.indexOf(p) < 0; });
  var manual = v29Seguro_(HOJAS.CARRERA).some(function (c) { return celdaIso_(c.FECHA) === iso; });
  return { carrera: carrera, erg: erg, toca: !!(carrera.length || erg.length || manual) };
}
function garminTiempo_(seg) { seg = Math.round(seg || 0); return seg >= 3600 ? Math.floor(seg / 3600) + ':' + ('0' + Math.floor((seg % 3600) / 60)).slice(-2) + ':' + ('0' + (seg % 60)).slice(-2) : mmss_(seg); }
/** Un día: carreras → APP · CARRERA (completa lo que tengas a mano, sin duplicar); ergómetro → datos del bloque en APP · REGISTRO. */
function garminDia_(iso) {
  var q = garminQueToca_(iso), res = { iso: iso, carrera: 0, erg: 0, vistas: 0, saltado: !q.toca };
  if (!q.toca) return res;
  var acts = garminGet_('/activitylist-service/activities/search/activities?startDate=' + iso + '&endDate=' + iso + '&limit=20&sortOrder=asc') || [];
  res.vistas = acts.length;
  var carr = v29Seguro_(HOJAS.CARRERA), regs = v29Seguro_(HOJAS.REGISTRO), usadosC = {}, usadosE = {};
  acts.forEach(function (a) {
    var tipo = String((a.activityType && a.activityType.typeKey) || '').toLowerCase(), nota = 'Garmin · ' + String(a.activityName || tipo).slice(0, 100) + ' #' + a.activityId;
    var km = (+a.distance || 0) / 1000, seg = +a.movingDuration || +a.duration || 0; if (!(seg > 0)) return;
    if (/run/.test(tipo)) {
      var p = q.carrera.filter(function (x) { return !usadosC[x.ID]; })[0] || null; if (p) usadosC[p.ID] = 1;
      var ex = carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && String(c.NOTAS || '').indexOf('#' + a.activityId) >= 0; })[0] ||
        (p && carr.filter(function (c) { return celdaIso_(c.FECHA) === iso && c.ID_PLAN === p.ID; })[0]) ||
        carr.filter(function (c) { var kc = v29Num_(c['DISTANCIA (km)']); return celdaIso_(c.FECHA) === iso && !String(c.ID_PLAN || '').trim() && !/Garmin|Strava/.test(String(c.NOTAS || '')) && (!kc || (km > 0 && Math.abs(kc - km) / km <= 0.05)); })[0] || null;
      var n = { FECHA: isoAFecha(iso), ID_PLAN: p ? p.ID : (ex ? ex.ID_PLAN || '' : ''), TIPO: p ? v29TipoCarrera_(p) : 'Z2', 'DISTANCIA (km)': km.toFixed(2).replace('.', ','), TIEMPO: garminTiempo_(seg), NOTAS: nota };
      if (km > 0) n['RITMO MEDIO (/km)'] = mmss_(seg / km);
      if (a.averageHR) n['FC MEDIA'] = Math.round(a.averageHR);
      if (a.maxHR) n['FC MÁX'] = Math.round(a.maxHR);
      if (a.elevationGain != null) n['DESNIVEL (m)'] = Math.round(a.elevationGain);
      if (a.averageRunningCadenceInStepsPerMinute) n.CADENCIA = Math.round(a.averageRunningCadenceInStepsPerMinute);
      if (a.maxTemperature != null && a.minTemperature != null) n['TEMPERATURA (°C)'] = Math.round((a.maxTemperature + a.minTemperature) / 2);
      if (ex) {
        var vac = {}, hay = false;
        Object.keys(n).forEach(function (h) { if (!String(ex[h] == null ? '' : ex[h]).trim() && String(n[h]) !== '') { vac[h] = n[h]; hay = true; } });
        if (String(ex.NOTAS || '').indexOf('#' + a.activityId) < 0) { vac.NOTAS = (ex.NOTAS ? ex.NOTAS + ' · ' : '') + nota; hay = true; }
        if (hay) { actualizarFila_(HOJAS.CARRERA, ex._fila, vac); res.carrera++; }
      } else { n.ID = nuevoId_(); n.REGISTRADO = ahora_(); anadirFila_(HOJAS.CARRERA, n); res.carrera++; carr.push(Object.assign({ _fila: 0 }, n)); }
      return;
    }
    if (/row|cycl|bik|ski|cardio|elliptical|stair/.test(tipo)) {
      var b = q.erg.filter(function (x) { return !usadosE[x.ID]; })[0]; if (!b) return; usadosE[b.ID] = 1;
      var dat = 'Garmin · ' + (a.activityName || tipo) + ' · ' + (km > 0 ? Math.round(km * 1000) + ' m · ' : '') + garminTiempo_(seg) +
        (a.averageHR ? ' · FC ' + Math.round(a.averageHR) + (a.maxHR ? '/' + Math.round(a.maxHR) : '') : '') + (a.avgPower ? ' · ' + Math.round(a.avgPower) + ' W' : '') + (a.calories ? ' · ' + Math.round(a.calories) + ' kcal' : '') + ' #' + a.activityId;
      var r = regs.filter(function (x) { return x.ID_PLAN === b.ID && celdaIso_(x.FECHA) === iso; })[0];
      if (r) { if (String(r['DATOS (parciales/vatios)'] || '').indexOf('#' + a.activityId) < 0) { actualizarFila_(HOJAS.REGISTRO, r._fila, { 'DATOS (parciales/vatios)': (r['DATOS (parciales/vatios)'] ? r['DATOS (parciales/vatios)'] + ' · ' : '') + dat, MIN_REAL: r.MIN_REAL || String(Math.round(seg / 60)) }); res.erg++; } }
      else { guardarRegistro_({ FECHA: isoAFecha(iso), ID_PLAN: b.ID, BLOQUE: b['TÍTULO'] || b.BLOQUE || '', HECHO: 'Sí', MIN_REAL: String(Math.round(seg / 60)), 'DATOS (parciales/vatios)': dat, NOTAS: 'Desde Garmin' }); res.erg++; }
    }
  });
  MEMO = null;
  return res;
}
/** Diario (04:00): los días pendientes desde la última vez hasta ayer (máx. 7), solo si ese día había carrera o ergómetro. */
function garminDiario_(forzarIso) {
  if (!PROPS.getProperty('GARMIN_KEY')) return { ok: false, motivo: 'sin_clave' };
  var cfg = leerConfig_(), ayer = sumarDias(hoyIso_(), -1), ult = celdaIso_(String(cfg.garmin_ultimo || '').replace(/^'/, '')) || sumarDias(ayer, -2);
  var dias = []; if (forzarIso) dias = [celdaIso_(forzarIso)]; else for (var d = sumarDias(ult, 1); d <= ayer && dias.length < 7; d = sumarDias(d, 1)) dias.push(d);
  var out = { ok: true, dias: [], carrera: 0, erg: 0 };
  try {
    dias.forEach(function (d) { var r = garminDia_(d); out.dias.push(r); out.carrera += r.carrera; out.erg += r.erg; if (!forzarIso) ponerConfig_('garmin_ultimo', "'" + d, 'Garmin · último día revisado (solo días de carrera o ergómetro)'); });
    ponerConfig_('garmin_estado', ahora_() + ' · OK · ' + out.carrera + ' carreras · ' + out.erg + ' ergómetro', 'Garmin · resultado de la última sincronización');
    if (out.carrera) { try { analizarCarrera_(); } catch (e) {} }
  } catch (err) {
    out = { ok: false, motivo: String(err && err.message || err) };
    ponerConfig_('garmin_estado', ahora_() + ' · FALLO · ' + out.motivo, 'Garmin · resultado de la última sincronización');
  }
  return out;
}
function garminEstado_() {
  var cfg = leerConfig_();
  return { configurado: !!PROPS.getProperty('GARMIN_KEY'), ultimo: String(cfg.garmin_ultimo || '').replace(/^'/, ''), estado: String(cfg.garmin_estado || '') };
}
// =====================================================================================================
// v0.29b · COMPETICIÓN (fichas, taper, plan del día) · RESUMEN DEL LUNES · SALUD DE TAREAS · ARCHIVO · CACHÉ · LOTES
// Se añade tal cual al final de Code.gs (usa sus funciones globales). ES5: var, function, sin flechas ni template literals.
// El router y los disparadores existentes se cambian según _v29b_patches.md.
// =====================================================================================================

// ---------- pestañas ----------
HOJAS.FICHAS = 'APP · FICHAS';
HOJAS.INFORMES = 'INFORMES';
ESQUEMA['APP · FICHAS'] = {
  cab: ['ID', 'FECHA', 'EVENTO', 'WOD', 'RESULTADO', 'PUESTO', 'VALORACIÓN', 'FALLO', 'QUÉ FALLÓ', 'ESTÍMULO QUE SALE', 'REFERENCIA', 'REGISTRADO'],
  anchos: [70, 95, 180, 300, 110, 70, 100, 100, 280, 280, 90, 120], fechas: ['FECHA'], negrita: 'WOD', congelarCol: 2,
  listas: { 'VALORACIÓN': ['Bien', 'Regular', 'Mal'], FALLO: ['Motor', 'Skill', 'Fuerza', 'Estrategia', 'Ninguno'], REFERENCIA: ['Sí', 'No'] },
  colores: [['VALORACIÓN', 'Mal', '#ffd6d6'], ['REFERENCIA', 'Sí', '#fff2e6']]
};
ESQ_BD_[HOJAS.INFORMES] = { cab: ['FECHA', 'MES', 'TEXTO', 'MODELO'], anchos: [95, 80, 700, 130], fechas: ['FECHA'], color: '#16a34a' };
// eventos: objetivo de la competición (A/B) y sus WODs
CAMPOS_EVENTO.push('OBJETIVO', 'WODS');
ESQUEMA['APP · EVENTOS'].cab.push('OBJETIVO', 'WODS'); ESQUEMA['APP · EVENTOS'].anchos.push(80, 320);
ESQUEMA['APP · EVENTOS'].listas.OBJETIVO = ['A', 'B'];

/** Ejecutar desde configurar (después de prepararHojas y prepararBd_). Devuelve un texto de estado. */
function prepararV29b_() {
  var r = [];
  try { prepararEsquema_(miLibro_(), { 'APP · FICHAS': ESQUEMA['APP · FICHAS'] }); r.push('FICHAS'); } catch (e) { r.push('FICHAS fallo: ' + e); }
  try { ['OBJETIVO', 'WODS'].forEach(function (c) { asegurarColumna_(HOJAS.EVENTOS, c); }); r.push('EVENTOS+OBJETIVO/WODS'); } catch (e) { r.push('EVENTOS fallo: ' + e); }
  try { prepararEsquema_(motorLibro_(), (function () { var o = {}; o[HOJAS.INFORMES] = ESQ_BD_[HOJAS.INFORMES]; return o; })()); r.push('INFORMES'); } catch (e) { r.push('INFORMES fallo: ' + e); }
  try { instalarDisparadorLunes_(); r.push('disparador lunes 7:00'); } catch (e) { r.push('disparador fallo: ' + e); }
  return r.join(' · ');
}

// ===================== 1 · COMPETICIÓN =====================
function canonLista_(v, lista) {
  var n = norm(v).trim(); if (!n) return '';
  for (var i = 0; i < lista.length; i++) if (norm(lista[i]) === n) return lista[i];
  return '';
}
/** Primer movimiento gimnástico (tirón o empuje gimnástico) que la guía detecta en el texto del WOD; '' si ninguno. */
function primerGimnastico_(txt) {
  try {
    var det = detectarMovs_(String(txt || ''), guiaMotor_());
    for (var i = 0; i < det.length; i++) { var m = det[i].m; if (m.patron === 'TIRON' || m.patron === 'EMPUJE_G' || m.k === 'T2B') return m.n; }
  } catch (e) { Logger.log('primerGimnastico_: ' + e); }
  return '';
}
function estimuloDeFallo_(fallo, wod) {
  var f = norm(fallo);
  if (f === 'MOTOR') return 'P4 modelado de metcon + calidad de carrera';
  if (f === 'SKILL') return (primerGimnastico_(wod) || 'skill del WOD') + ' en fatiga';
  if (f === 'FUERZA') return 'fuerza en fatiga del movimiento más pesado';
  if (f === 'ESTRATEGIA') return 'simulación del WOD con la estrategia escrita';
  return '';
}
function asegurarFichas_() {
  try { hojaMia_(HOJAS.FICHAS); } catch (e) { olvidarCabeceras_(); prepararEsquema_(miLibro_(), { 'APP · FICHAS': ESQUEMA['APP · FICHAS'] }); }
}
/** Guarda (o edita, si trae ID) la ficha de un WOD de competición. «Mal» pasa solo a referencia. */
function guardarFicha_(f) {
  f = f || {};
  var o = permitidas_(f, ['FECHA', 'EVENTO', 'WOD', 'RESULTADO', 'PUESTO', 'VALORACIÓN', 'FALLO', 'QUÉ FALLÓ', 'ESTÍMULO QUE SALE', 'REFERENCIA']);
  if (!String(o.WOD || '').trim() && !String(o.EVENTO || '').trim()) throw new Error('ficha_incompleta');
  asegurarFichas_();
  o.FECHA = isoAFecha(celdaIso_(o.FECHA) || hoyIso_());
  o['VALORACIÓN'] = canonLista_(o['VALORACIÓN'], ['Bien', 'Regular', 'Mal']);
  o.FALLO = canonLista_(o.FALLO, ['Motor', 'Skill', 'Fuerza', 'Estrategia', 'Ninguno']);
  o.REFERENCIA = o['VALORACIÓN'] === 'Mal' ? 'Sí' : (canonLista_(o.REFERENCIA, ['Sí', 'No']) || 'No');
  if (!String(o['ESTÍMULO QUE SALE'] || '').trim()) o['ESTÍMULO QUE SALE'] = estimuloDeFallo_(o.FALLO, o.WOD);
  var id = String(f.ID || ''), x = id ? listar_(HOJAS.FICHAS).filter(function (r) { return r.ID === id; })[0] : null;
  if (x) { bloqueo_(function () { actualizarFila_(HOJAS.FICHAS, x._fila, o); }); o.ID = id; }
  else { o.ID = nuevoId_(); o.REGISTRADO = ahora_(); anadirFila_(HOJAS.FICHAS, o); }
  MEMO = null;
  return o;
}
/** Fichas ordenadas por fecha, la más reciente primero. */
function fichas_() {
  var l; try { l = listar_(HOJAS.FICHAS); } catch (e) { return []; }
  return l.map(function (r) { r._iso = celdaIso_(r.FECHA) || ''; return r; })
    .sort(function (a, b) { return a._iso < b._iso ? 1 : a._iso > b._iso ? -1 : b._fila - a._fila; });
}

/** Competición/HYROX de objetivo A que empieza entre el lunes y el lunes+10 → { evento, id, inicio, wods, dias (desde el lunes hasta el inicio) }; si no, null. */
function tapersSemana_(lunes) {
  lunes = lunesDe_(lunes); var tope = sumarDias(lunes, 10), mejor = null;
  listar_(HOJAS.EVENTOS).forEach(function (r) {
    var t = norm(r.TIPO), ini = celdaIso_(r.INICIO);
    if (!(t.indexOf('COMPETICION') >= 0 || t.indexOf('HYROX') >= 0)) return;
    if (String(r.OBJETIVO || '').trim().toUpperCase() !== 'A' || norm(r.ESTADO) === 'IGNORADO') return;
    if (!ini || ini < lunes || ini > tope) return;
    if (!mejor || ini < mejor.inicio) mejor = { evento: r.EVENTO, id: r.ID, inicio: ini, wods: String(r.WODS || ''), dias: Math.round((Date.parse(ini) - Date.parse(lunes)) / 864e5) };
  });
  return mejor;
}
/** Bloque «test de WODs» 4–6 días antes de la competición (dentro de la semana, por la tarde). [] si no procede. */
function taperBloques_(lunes) {
  lunes = lunesDe_(lunes);
  var t = tapersSemana_(lunes); if (!t || !String(t.wods).trim()) return [];
  var fin = sumarDias(lunes, 6), iso = null;
  [5, 4, 6].forEach(function (k) { var d = sumarDias(t.inicio, -k); if (!iso && d >= lunes && d <= fin) iso = d; });
  if (!iso) return [];
  return [{ FECHA: isoAFecha(iso), TURNO: 'PM', 'TÍTULO': 'Test de WODs de la competi + estrategia',
    CONTENIDO: String(t.wods).trim() + '\n\nNo hace falta hacerlos enteros: adapta para sentir el estímulo y comprobar la estrategia (ritmos, particiones, transiciones). Intensidad de competición, volumen −50 %.',
    MIN: 40, 'CÓDIGOS': 'CT1', ORIGEN: 'EXTRA' }];
}

function formatoWod_(txt) {
  var n = norm(txt);
  if (/AMRAP/.test(n)) return 'AMRAP';
  if (/EMOM|E\d+MOM|\bEVERY\b/.test(n)) return 'EMOM';
  if (/FOR TIME|\bFT\b|CHIPPER|TIME ?CAP|\bCAP\b/.test(n)) return 'FOR TIME';
  return 'GENERAL';
}
function estrategiaFormato_(fmt, txt) {
  var e = fmt === 'AMRAP' ? 'Ritmo sostenible al ~85 % las primeras rondas; tandas fijas y sin parar de más en las transiciones; lo que sobre, al final.' :
    fmt === 'FOR TIME' ? 'Salida controlada (no te vayas en el primer tercio) y aprieta el último tercio; rompe las series antes del fallo.' :
    fmt === 'EMOM' ? 'Termina cada minuto con 10–15″ de margen; si pasas de 50″ de trabajo, baja reps antes de que se caiga la técnica.' :
    'Calcula antes de empezar dónde vas a parar y dónde vas a apretar; ritmo repetible de principio a fin.';
  if (/\d+\s*(KG|LB)|\b\d{2,3}\s*\/\s*\d{2,3}\b|@\s*\d+|%/.test(norm(txt))) e += ' Con carga: decide las particiones antes (p. ej. 12 = 6+6, 9 = 5+4) y no las cambies a mitad.';
  return e;
}
/** Plan del día de una competición (texto plano): calentamiento, estrategia por WOD, comida e hidratación; + estrategia de Gemini si responde. */
function planCompeti_(idEvento) {
  var ev = listar_(HOJAS.EVENTOS).filter(function (r) { return r.ID === String(idEvento); })[0];
  if (!ev) throw new Error('no_encontrado');
  var wods = String(ev.WODS || '').split(/\r?\n[ \t]*\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  var peso = parseFloat(String(leerConfig_().peso_kg || '').replace(',', '.')) || 90, hMin = Math.round(peso), hMax = Math.round(peso * 1.5);
  var G = null; try { G = guiaMotor_(); } catch (e) {}
  var L = ['PLAN DEL DÍA · ' + ev.EVENTO + (ev.INICIO ? ' · ' + ev.INICIO : '')];
  if (!wods.length) L.push('', 'No hay WODs escritos en el evento (campo WODS): añádelos, separados por una línea en blanco, para tener estrategia por WOD.');
  wods.forEach(function (w, i) {
    var fmt = formatoWod_(w), movs = [];
    try { if (G) detectarMovs_(w, G).forEach(function (x) { if (movs.indexOf(x.m.n) < 0) movs.push(x.m.n); }); } catch (e) {}
    L.push('', 'WOD ' + (i + 1) + ' · ' + fmt, w, '',
      'Calentamiento general 8′: 3′ remo o bici suave, movilidad de cadera y hombro, 2 rondas de 5 sentadillas, 5 dominadas escapulares y 5 flexiones, 2 progresivos de 20″.',
      'Calentamiento específico: ' + (movs.length ? '2–3 series progresivas de ' + movs.slice(0, 5).join(', ') + ' (primero ligero, luego a ritmo de WOD).' : 'series cortas de los movimientos del WOD, de ligero a ritmo de competición.'),
      'Estrategia: ' + estrategiaFormato_(fmt, w));
  });
  L.push('', 'COMIDA E HIDRATACIÓN',
    '3 h antes: 1–1,5 g/kg de hidratos (≈ ' + hMin + '–' + hMax + ' g para ' + peso + ' kg) + 20–30 g de proteína; grasa y fibra bajas.',
    wods.length > 1 ? 'Entre WODs: 30–60 g de hidratos por hora y 500 ml de agua con sales.' : 'Si hay espera: 30–60 g de hidratos por hora y 500 ml de agua con sales.');
  var texto = L.join('\n');
  try {
    if (wods.length) {
      var g = geminiLlamar_('Eres entrenador de CrossFit de competición. Atleta RX de ' + peso + ' kg. Evento: ' + ev.EVENTO + '. Para cada WOD da una estrategia concreta en español: ritmo, particiones, transiciones, ' +
        'dónde apretar y qué evitar. Texto plano, sin markdown, sin símbolos de lista, máximo 10 líneas por WOD.\n\nWODs:\n' + wods.join('\n\n---\n\n'), 900, 0.4);
      if (g && g.ok && String(g.texto || '').trim()) texto += '\n\nEstrategia (IA)\n' + String(g.texto).replace(/[*#`]/g, '').trim();
    }
  } catch (e) { Logger.log('planCompeti_ IA: ' + e); }
  return texto;
}

// ===================== 2 · RESUMEN DEL LUNES 7:00 =====================
var PREGUNTAS_SEMANALES_ = ['¿Qué bloque te sobró o te dejó peor la semana pasada?', '¿Qué estímulo notaste que mejoraba?', '¿Algún día llegaste reventado? ¿Por qué crees?',
  '¿Algo de la app te hizo perder tiempo?', '¿Qué cambiarías de la semana que empieza?'];
/** Crea las 5 preguntas semanales del lunes (sin duplicar). Devuelve cuántas ha creado. */
function preguntasSemanales_(lunes) {
  lunes = lunesDe_(lunes);
  var ya = {}; listar_(HOJAS.APR_DN).forEach(function (r) { if (r.TIPO === 'semanal' && celdaIso_(r.LUNES) === lunes) ya[r.PREGUNTA] = 1; });
  var nuevas = PREGUNTAS_SEMANALES_.filter(function (p) { return !ya[p]; }).map(function (p) {
    return { ID: 'DN' + nuevoId_(), LUNES: isoAFecha(lunes), BLOQUE_ID: '', BLOQUE: 'Semana pasada', TIPO: 'semanal', PREGUNTA: p, OPCIONES: '', RESPUESTA: '', COMENTARIO: '', ESTADO: 'PENDIENTE', CONTEXTO: '{}', CREADO: ahora_() };
  });
  filasEnHoja_(HOJAS.APR_DN, nuevas); MEMO = null;
  return nuevas.length;
}
function ultimoInforme_() {
  try {
    var l = listar_(HOJAS.INFORMES).filter(function (r) { return String(r.TEXTO || '').trim(); }); if (!l.length) return null;
    l.sort(function (a, b) { var x = celdaIso_(a.FECHA) || '', y = celdaIso_(b.FECHA) || ''; return x < y ? -1 : x > y ? 1 : a._fila - b._fila; });
    var u = l[l.length - 1]; return { fecha: celdaIso_(u.FECHA) || '', texto: u.TEXTO };
  } catch (e) { return null; }
}
/** Datos del resumen. lunes = lunes de la semana que EMPIEZA; se analiza la anterior. No escribe nada. */
function resumenLunesDatos_(lunes) {
  lunes = lunesDe_(lunes || hoyIso_());
  var ant = sumarDias(lunes, -7), antFin = sumarDias(ant, 6), o = { lunes: lunes };
  // cumplimiento
  var hecho = {}; listar_(HOJAS.REGISTRO).forEach(function (r) { if (r.ID_PLAN && r.HECHO === 'Sí') hecho[r.ID_PLAN] = 1; });
  var plan = listar_(HOJAS.PLAN).filter(function (r) { var d = celdaIso_(r.FECHA); return d >= ant && d <= antFin && r.ESTADO === 'PROGRAMADO'; });
  var hs = plan.filter(function (r) { return hecho[r.ID]; }).length;
  o.cumplimiento = { pct: plan.length ? Math.round(hs * 100 / plan.length) : 0, hechos: hs, total: plan.length };
  // metas de la semana anterior: las 5 más bajas
  o.metas = [];
  try {
    o.metas = avanceMetas_('Semana', periodoSemana_(ant), cacheMetas_()).filter(function (m) { return m.meta > 0; })
      .map(function (m) { return { estimulo: m.estimulo, pct: Math.round(m.pReal * 100) }; })
      .sort(function (a, b) { return a.pct - b.pct; }).slice(0, 5);
  } catch (e) { Logger.log('resumenLunes metas: ' + e); }
  // rendimiento (otro módulo): indicadores con valor nuevo la semana pasada (si no traen fecha se incluyen todos)
  o.rendimiento = [];
  if (typeof rendimiento_ === 'function') {
    try {
      var R = rendimiento_(), lista = Object.prototype.toString.call(R) === '[object Array]' ? R : (R && (R.indicadores || R.lista)) || [];
      lista.forEach(function (i) {
        if (i.ultimo && i.ultimo.fecha) { if (i.ultimo.fecha < ant || i.ultimo.fecha > antFin) return; i = { nombre: i.nombre, txt: i.ultimo.txt, tendencia: i.tendencia === 'mejora' ? 'sube' : i.tendencia === 'empeora' ? 'baja' : i.tendencia, fecha: i.ultimo.fecha }; }
        var f = celdaIso_(i.fecha || i.FECHA || ''); if (f && (f < ant || f > antFin)) return;
        o.rendimiento.push({ nombre: i.nombre || i.n || '', txt: i.txt || i.texto || String(i.valor == null ? '' : i.valor), tendencia: i.tendencia || '' });
      });
    } catch (e) { Logger.log('resumenLunes rendimiento: ' + e); }
  }
  // carga
  try { o.carga = estadoCarga_(lunes); } catch (e) { o.carga = { media: 0, n: 0, sinDescanso: false, descarga: false }; }
  // decisiones (máx. 3)
  var dec = [];
  try { var tp = tapersSemana_(lunes); if (tp) dec.push('Taper para ' + tp.evento + ' (' + isoAFecha(tp.inicio).slice(0, 5) + '): sin P1–P4 ni extras pesados, intensidad alta y volumen bajo.'); } catch (e) {}
  if (o.carga.descarga) dec.push('Semana de descarga automática: extras a la mitad y técnicos.');
  try {
    var men = avanceMetas_('Mes', periodoMes_(lunes), cacheMetas_()).filter(function (m) { return m.meta > 0 && !m.cubierta; }).sort(function (a, b) { return a.pProg - b.pProg; });
    if (men.length) dec.push('Prioridad mensual: ' + men[0].estimulo + ' (' + Math.round(men[0].pProg * 100) + ' %)');
  } catch (e) {}
  try { var np = pendientesAbiertos_().length; if (np) dec.push(np + ' pendientes de la semana pasada: entran esta semana o caducan.'); } catch (e) {}
  o.decisiones = dec.length ? dec.slice(0, 3) : ['Semana normal: sigue el plan.'];
  // preguntas, informe, reglas
  o.preguntas = listar_(HOJAS.APR_DN).filter(function (r) { return r.TIPO === 'semanal' && celdaIso_(r.LUNES) === lunes; }).length;
  o.informe = ultimoInforme_();
  o.reglas = [];
  if (+lunes.slice(8, 10) <= 7) {
    try { o.reglas = reglasAprendidas_().filter(function (r) { return Math.abs(r.peso) >= UMBRAL_REGLA_; }).sort(function (a, b) { return Math.abs(b.peso) - Math.abs(a.peso); }).slice(0, 12).map(function (r) { return r.texto; }); } catch (e) {}
  }
  return o;
}
function resumenLunesHtml_(d) {
  var th = 'style="text-align:left;padding:6px 8px;background:#222;color:#fff;font-size:12px"', td = 'style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px"';
  var h = '<div style="font-family:Arial,sans-serif;max-width:760px;color:#111"><h2 style="margin:0 0 4px">Road To Elite · tu semana ' + esc_(isoAFecha(d.lunes).slice(0, 5)) + '</h2>' +
    '<p style="margin:0 0 14px;color:#555">' + esc_(ahora_()) + '</p>' +
    '<table style="border-collapse:collapse;margin-bottom:14px"><tr><td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + d.cumplimiento.pct + ' %</b><br>cumplimiento semana pasada (' + d.cumplimiento.hechos + '/' + d.cumplimiento.total + ' bloques)</td><td width="10"></td>' +
    '<td style="padding:10px 14px;background:#fff3e6;border-radius:8px"><b style="font-size:20px">' + esc_(d.carga.media || 0) + '/10</b><br>cansancio medio' + (d.carga.descarga ? ' · DESCARGA' : '') + '</td></tr></table>' +
    '<h3>Decisiones para esta semana</h3><ul>' + d.decisiones.map(function (x) { return '<li>' + esc_(x) + '</li>'; }).join('') + '</ul>';
  if (d.metas.length) h += '<h3>Estímulos más flojos de la semana pasada</h3><table style="border-collapse:collapse;width:100%"><tr><th ' + th + '>Estímulo</th><th ' + th + '>Hecho</th></tr>' +
    d.metas.map(function (m) { return '<tr><td ' + td + '>' + esc_(m.estimulo) + '</td><td ' + td + '>' + m.pct + ' %</td></tr>'; }).join('') + '</table>';
  if (d.rendimiento.length) h += '<h3>Rendimiento</h3><ul>' + d.rendimiento.map(function (r) { return '<li><b>' + esc_(r.nombre) + '</b> · ' + esc_(r.txt) + (r.tendencia ? ' (' + esc_(r.tendencia) + ')' : '') + '</li>'; }).join('') + '</ul>';
  if (d.preguntas) h += '<h3>Preguntas de la semana</h3><p>' + d.preguntas + ' preguntas nuevas en la app › Menú › Aprendizaje. Contéstalas: afinan la programación.</p>';
  if (d.informe) h += '<h3>Informe mensual · ' + esc_(isoAFecha(d.informe.fecha)) + '</h3><p style="font-size:13px">' + esc_(d.informe.texto).replace(/\n/g, '<br>') + '</p>';
  if (d.reglas.length) h += '<h3>Lo que he aprendido de ti</h3><ul>' + d.reglas.map(function (r) { return '<li>' + esc_(r) + '</li>'; }).join('') + '</ul>';
  return h + '<p style="color:#888;font-size:12px">Road To Elite · resumen automático del lunes.</p></div>';
}
/** Disparador (lunes 7:00). Con forzar === true se repite aunque ya se haya enviado esta semana. */
function resumenLunes(forzar) { return conSalud_('resumenLunes', function () { return resumenLunesSin_(forzar === true); }); }
function resumenLunesSin_(forzar) {
  var lunes = lunesDe_(hoyIso_()), cf = leerConfig_();
  if (cf['resumen_lunes_' + lunes] && !forzar) return { ya: true, lunes: lunes };
  var nPreg = 0; try { nPreg = preguntasSemanales_(lunes); } catch (e) { Logger.log('Preguntas semanales: ' + e); }
  var informe = null;
  if (+lunes.slice(8, 10) <= 7) { try { informe = informeMensual_(); } catch (e) { Logger.log('Informe mensual: ' + e); } }
  var d = resumenLunesDatos_(lunes);
  MailApp.sendEmail({ to: cf.email_permitido || CONFIG.EMAIL_PERMITIDO, subject: 'Road To Elite · tu semana', htmlBody: resumenLunesHtml_(d), name: 'Road To Elite' });
  try { enviarPush_('Road To Elite · tu semana', 'Cumplimiento ' + d.cumplimiento.pct + ' % · ' + d.decisiones[0]); } catch (e) { Logger.log('Push lunes: ' + e); }
  ponerConfig_('resumen_lunes_' + lunes, ahora_() + ' · ' + nPreg + ' preguntas' + (informe ? ' · informe mensual' : ''), 'Resumen del lunes 7:00 enviado');
  return d;
}
function instalarDisparadorLunes_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'resumenLunes') borrarDisp_(t); });
  return reintentar_(function () { return ScriptApp.newTrigger('resumenLunes').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).nearMinute(0).inTimezone(CONFIG.ZONA).create(); }, 'disparador resumenLunes');
}
/** Informe mensual con Gemini (gratis): qué mejoró, qué se estancó y 3 ajustes. Lo guarda en Motor › INFORMES. */
function informeMensual_() {
  var hoy = hoyIso_(), partes = [];
  if (typeof rendimiento_ === 'function') { try { partes.push('RENDIMIENTO (indicadores):\n' + JSON.stringify(rendimiento_()).slice(0, 3500)); } catch (e) {} }
  if (typeof residuo_ === 'function') { try { partes.push('RESIDUO (lo que no se cubre):\n' + JSON.stringify(residuo_()).slice(0, 2500)); } catch (e) {} }
  var cargas = [], l0 = lunesDe_(hoy);
  for (var k = 0; k < 4; k++) { var li = sumarDias(l0, -7 * k); try { var c = estadoCarga_(li); cargas.push('semana ' + isoAFecha(li).slice(0, 5) + ': cansancio medio ' + c.media + '/10' + (c.descarga ? ', descarga' : '') + (c.sinDescanso ? ', sin día de descanso' : '')); } catch (e) {} }
  partes.push('CARGA (últimas 4 semanas):\n' + cargas.join('\n'));
  var reglas = ''; try { reglas = reglasAprendidasTexto_(20); } catch (e) {}
  if (reglas) partes.push(reglas);
  var datos = partes.join('\n\n'), texto = '', modelo = 'sin IA', g = null;
  try {
    g = geminiLlamar_('Eres entrenador de CrossFit y HYROX de élite y analizas el último mes de un atleta RX de 90 kg. Con los datos de abajo, responde en español, texto plano sin markdown ni símbolos de lista, ' +
      'en menos de 250 palabras: 1) qué mejoró, 2) qué se estancó, 3) tres ajustes concretos para el mes que empieza. No inventes datos que no estén abajo.\n\n' + datos, 1200, 0.4);
  } catch (e) { g = { ok: false, error: String(e && e.message || e) }; }
  if (g && g.ok && String(g.texto || '').trim()) { texto = String(g.texto).replace(/[*#`]/g, '').trim(); modelo = g.modelo || 'Gemini'; }
  else texto = 'Informe sin IA (Gemini no ha respondido' + (g && g.error ? ': ' + String(g.error).slice(0, 120) : '') + '). Datos en bruto del mes:\n\n' + datos;
  anadirFila_(HOJAS.INFORMES, { FECHA: isoAFecha(hoy), MES: hoy.slice(0, 7), TEXTO: texto.slice(0, 40000), MODELO: modelo });
  MEMO = null;
  return { fecha: hoy, texto: texto };
}

// ===================== 3 · SALUD DE LAS TAREAS AUTOMÁTICAS =====================
var SALUD_PERIODOS_ = { revisarAvisos: 1, sincronizarCalendario: 1, motorDiario: 24, resumenLunes: 168, domingoNoche: 168, cargarFabrikDomingo: 168, competisLunes: 168, videosMartes: 168, backupJueves: 168 };   // horas
function saludLeer_() { var o = {}; try { o = JSON.parse(String(leerConfig_().salud || '{}')) || {}; } catch (e) { o = {}; } return o; }
function saludRegistrar_(nombre, ok, msg) {
  bloqueo_(function () {
    var s = saludLeer_(); s[nombre] = { t: ahora_(), ok: !!ok, msg: String(msg || '').slice(0, 200) };
    ponerConfig_('salud', JSON.stringify(s), 'Salud de las tareas automáticas (última ejecución de cada una; la app y el aviso diario lo leen)');
  });
}
/** Ejecuta fn y anota en config «salud» cómo salió; relanza el error si falla. Después invalida la caché de la semana. */
function conSalud_(nombre, fn) {
  var res, err = null;
  try { res = fn(); } catch (e) { err = e; }
  try { saludRegistrar_(nombre, !err, err ? (err && err.message || err) : ''); } catch (e2) { Logger.log('salud: ' + e2); }
  try { invalidarSemana_(); } catch (e3) { Logger.log('invalidar: ' + e3); }
  if (err) throw err;
  return res;
}
function horasDeTxt_(t) {   // «dd/MM/yyyy HH:mm» → horas (misma zona en ambos lados)
  var m = String(t || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/); if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) / 36e5;
}
function saludEstado_() {
  var S = saludLeer_(), ahoraH = horasDeTxt_(ahora_());
  var tareas = Object.keys(SALUD_PERIODOS_).map(function (n) {
    var x = S[n], h = x ? horasDeTxt_(x.t) : null;
    if (!x) return { nombre: n, ultima: '', ok: null, msg: 'aún sin registro', atrasada: false };   // sin dato no se da por atrasada (acaba de instalarse)
    return { nombre: n, ultima: x.t, ok: x.ok !== false, msg: x.msg || '', atrasada: h != null && ahoraH != null && (ahoraH - h) > 1.5 * SALUD_PERIODOS_[n] };
  });
  var bk = { ok: false, fecha: '', kb: 0 };
  try {
    var p = String(leerConfig_().backup_jueves || '').split(' · ');
    bk.fecha = p[0] || '';
    if (p[1]) { var tam = DriveApp.getFileById(p[1]).getSize(); bk.kb = Math.round(tam / 1024); bk.ok = tam > 0; }
  } catch (e) { bk.ok = false; bk.msg = String(e && e.message || e).slice(0, 100); }
  return { tareas: tareas, backup: bk };
}
/** Un aviso al día como mucho si hay tareas atrasadas o con fallo (o un backup que no existe / pesa 0). */
function revisarSalud_() {
  var e = saludEstado_(), mal = e.tareas.filter(function (t) { return t.atrasada || t.ok === false; }).map(function (t) { return t.nombre + (t.atrasada ? ' (atrasada)' : ' (falló)'); });
  if (e.backup.fecha && !e.backup.ok) mal.push('backup (no se encuentra o pesa 0)');
  var hoy = hoyIso_(); if (!mal.length || leerConfig_().salud_aviso === hoy) return mal.length;
  try { enviarPush_('Road To Elite · tareas automáticas', 'Revisa: ' + mal.join(', ')); } catch (x) { Logger.log('Aviso salud: ' + x); }
  ponerConfig_('salud_aviso', hoy, 'Último día en que se avisó de tareas automáticas con problemas');
  return mal.length;
}

// ===================== 4 · TÉCNICO =====================
// ---- a · archivo ----
function destinoArchivo_(nombre, cab) {
  var ss = motorLibro_(), sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold'); return { sh: sh, cab: cab.slice() }; }
  var tiene = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
  var extra = cab.filter(function (h) { return tiene.indexOf(h) < 0; });
  if (!tiene.length || extra.length) { tiene = tiene.concat(extra); sh.getRange(1, 1, 1, tiene.length).setValues([tiene]).setFontWeight('bold'); }
  return { sh: sh, cab: tiene };
}
function moverAArchivo_(hoja, destino, corte) {
  return bloqueo_(function () {
    var sh = hojaMia_(hoja), all = sh.getDataRange().getValues();
    if (all.length < 2) return 0;
    var cab = all[0].map(function (h) { return String(h).trim(); }), iF = cab.indexOf('FECHA'); if (iF < 0) return 0;
    var mover = [], quedan = [];
    all.slice(1).forEach(function (r) { var iso = celdaIso_(r[iF]); (iso && iso < corte ? mover : quedan).push(r); });
    if (!mover.length) return 0;
    var d = destinoArchivo_(destino, cab), antes = d.sh.getLastRow();
    var m = mover.map(function (r) { return d.cab.map(function (h) { var j = cab.indexOf(h); var v = j >= 0 ? r[j] : ''; return typeof v === 'string' ? celdaSegura_(v) : v; }); });
    d.sh.getRange(antes + 1, 1, m.length, d.cab.length).setValues(m);
    if (d.sh.getLastRow() < antes + m.length) throw new Error('archivo: no se han escrito todas las filas en ' + destino);   // no se borra nada del origen
    var nF = all.length - 1, nC = cab.length;
    sh.getRange(2, 1, nF, nC).clearContent();
    if (quedan.length) sh.getRange(2, 1, quedan.length, nC).setValues(quedan.map(function (r) { return r.slice(0, nC).map(function (v) { return typeof v === 'string' ? celdaSegura_(v) : v; }); }));
    MEMO = null;
    return mover.length;
  });
}
/** Mueve a Motor › ARCHIVO · PLAN / ARCHIVO · REGISTRO lo anterior al ciclo actual de Fabrik (y a 6 semanas como mínimo). Solo con backup de ≤ 8 días. */
function archivarAntiguo_() {
  var hoy = hoyIso_(), bk = String(leerConfig_().backup_jueves || '').split(' · ')[0];
  if (!isoOk_(bk) || (Date.parse(hoy) - Date.parse(bk)) / 864e5 > 8) return { plan: 0, registro: 0, motivo: 'sin backup reciente' };
  var limite = sumarDias(lunesDe_(hoy), -42), corte = limite;
  try {
    var ini = estructura_(fabrik_()).ciclo.fases.map(function (f) { return f.inicio; }).filter(Boolean).sort()[0];
    if (ini && ini < corte) corte = ini;
  } catch (e) { Logger.log('archivarAntiguo_: ciclo de Fabrik no legible, corte a 6 semanas: ' + e); }
  var p = moverAArchivo_(HOJAS.PLAN, 'ARCHIVO · PLAN', corte), r = moverAArchivo_(HOJAS.REGISTRO, 'ARCHIVO · REGISTRO', corte);
  return { plan: p, registro: r, corte: corte };
}
/** Para domingoNoche: solo el primer domingo de cada mes. */
function archivarSiToca_() {
  var hoy = hoyIso_();
  if (new Date(hoy + 'T12:00:00Z').getUTCDay() !== 0 || +hoy.slice(8, 10) > 7) return null;
  var r = archivarAntiguo_(); Logger.log('Archivo: ' + JSON.stringify(r)); return r;
}

// ---- b · caché de la semana ----
function invalidarSemana_() { PROPS.setProperty('rev_datos', String((parseInt(PROPS.getProperty('rev_datos') || '0', 10) || 0) + 1)); }
function semanaCacheada_(semana) {
  if (semana && !isoOk_(semana)) return semanaCompleta_(semana);
  var lunes = lunesDe_(semana || hoyIso_()), c = CacheService.getScriptCache(), rev = PROPS.getProperty('rev_datos') || '0', base = 'sem|' + lunes + '|' + hoyIso_() + '|' + rev;
  try {
    var n = parseInt(c.get(base + '|n'), 10);
    if (n > 0) {
      var claves = []; for (var i = 0; i < n; i++) claves.push(base + '|' + i);
      var got = c.getAll(claves), txt = '', ok = true;
      for (var j = 0; j < n; j++) { if (got[claves[j]] == null) { ok = false; break; } txt += got[claves[j]]; }
      if (ok) return JSON.parse(txt);
    }
  } catch (e) { Logger.log('semanaCacheada_ lectura: ' + e); }
  var res = semanaCompleta_(semana), json = JSON.stringify(res);
  [90000, 30000].some(function (tam) {
    try {
      var put = {}, k = 0; for (var p = 0; p < json.length; p += tam) put[base + '|' + (k++)] = json.slice(p, p + tam);
      put[base + '|n'] = String(k); c.putAll(put, 900); return true;
    } catch (e) { return false; }
  });
  return res;
}
var SOLO_LECTURA_ = ['inicio', 'semana', 'rendimiento', 'aprendizaje', 'op_estado', 'competis', 'fichas', 'salud', 'resumen_lunes', 'chequeos', 'estimulos_lista', 'incentivo_datos', 'lesion_zonas', 'plan_competi',
  'marcas', 'descuentos', 'webs', 'videos', 'cobertura', 'eventos', 'metas', 'carrera_lista', 'plantillas', 'extras_previa', 'posicion', 'motor_wods', 'extras_curso', 'biblioteca', 'wods', 'push_prueba'];
function esSoloLectura_(accion) { return SOLO_LECTURA_.indexOf(String(accion)) >= 0; }

// ---- c · escrituras por lotes ----
/** cambios = [{ fila, obj }]. Lee la hoja una vez y escribe un setValues por columna tocada (de su primera a su última fila tocada). Devuelve las filas cambiadas. */
function actualizarEnLote_(hoja, cambios) {
  if (!cambios || !cambios.length) return 0;
  var sh = hojaMia_(hoja), vals = sh.getDataRange().getValues();
  if (!vals.length) return 0;
  var cab = vals[0].map(function (h) { return String(h).trim(); }), col = {}, filas = {};
  cambios.forEach(function (c) {
    var f = Number(c.fila); if (!(f >= 2) || f > vals.length) return;
    Object.keys(c.obj || {}).forEach(function (h) {
      var j = cab.indexOf(h); if (j < 0) return;
      vals[f - 1][j] = celdaSegura_(c.obj[h]);
      var x = col[j] = col[j] || { min: f, max: f }; if (f < x.min) x.min = f; if (f > x.max) x.max = f;
      filas[f] = 1;
    });
  });
  Object.keys(col).forEach(function (js) {
    var j = +js, x = col[js], out = [];
    for (var f = x.min; f <= x.max; f++) { var v = vals[f - 1][j]; out.push([typeof v === 'string' ? celdaSegura_(v) : v]); }
    sh.getRange(x.min, j + 1, out.length, 1).setValues(out);
  });
  return Object.keys(filas).length;
}
