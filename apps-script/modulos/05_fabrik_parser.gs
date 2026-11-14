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

