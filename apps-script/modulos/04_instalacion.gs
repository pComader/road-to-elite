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

