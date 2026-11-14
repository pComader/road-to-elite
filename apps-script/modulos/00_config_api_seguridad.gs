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

