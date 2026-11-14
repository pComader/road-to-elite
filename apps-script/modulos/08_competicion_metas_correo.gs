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

