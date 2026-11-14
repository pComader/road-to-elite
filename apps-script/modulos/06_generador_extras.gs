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
