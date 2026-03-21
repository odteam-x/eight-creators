// ═══════════════════════════════════════════════════════════════
//  EIGHT CREATORS LABs — Google Apps Script Backend
//  CELIDER Santiago · Sistema de Evaluación
// ═══════════════════════════════════════════════════════════════
//
//  HOJAS DEL SPREADSHEET:
//
//  USUARIOS (fila 1 = encabezado, datos desde fila 2):
//    A=usuario  B=contraseña  C=nombre  D=rol  E=distrito
//
//  CREATORS SCORE - PE1/PE2/PE3 (filas 1-3 encabezados, datos desde fila 4):
//    A=usuario  B=rol  C=distrito  D=nombre  E=area
//    F=pla  G=rev  H=edi  I=dis  J=flu  K=nar  L=eje  M=ext(bono)  O=estado
//
//  CREATORS FEEDBACK - PE1/PE2/PE3 (misma estructura):
//    A=usuario  B=rol  C=distrito  D=nombre  E=area
//    F=pla  G=rev  H=edi  I=dis  J=flu  K=nar  L=eje  M=ext
//
//  CREATORS DISTRITOS - PE1/PE2/PE3 (fila 1 = encabezado, datos desde fila 2):
//    A=distrito  B=CGO  C=CCT  D=COM  E=CEE  F=Total
//
//  CRITERIOS (sin encabezado):
//    A=key  B=label  C=abbr  D=color
//
//  TABLA DE PUNTUACIÓN Distritos (sin encabezado / fila 1 encabezado):
//    B=criterio  C=nivel4  D=nivel3  E=nivel2  F=nivel1
// ═══════════════════════════════════════════════════════════════

const SS_ID     = '1ZDj4OvA1lkdUKTU-hU24CY34CKekZKb_i0oGlcWNCdo';
const API_TOKEN = 'sti2026';

// ── Columnas de miembros en CREATORS SCORE / FEEDBACK (0-based) ──
const COL    = { pla:5, rev:6, edi:7, dis:8, flu:9, nar:10, eje:11, ext:12, estado:14 };
const COL_1B = { pla:6, rev:7, edi:8, dis:9, flu:10, nar:11, eje:12, ext:13 };

// ── Columnas de CREATORS DISTRITOS (0-based) ──
const DCOL    = { dist:0, cgo:1, cct:2, com:3, cee:4, total:5 };
const DCOL_1B = { cgo:2, cct:3, com:4, cee:5, total:6 };

// ── Filas ──────────────────────────────────────────────────────
const DATA_START_IDX = 3;   // fila 4 (0-based): inicio de datos en CREATORS SCORE

// ── Competencias de distrito ───────────────────────────────────
const DIST_COMPETENCIAS = [
  { key:'cgo', label:'Gestión y Organización "CGO"',    abbr:'CGO', color:'#38BDF8', max:7 },
  { key:'cct', label:'Creativa y Técnica "CCT"',        abbr:'CCT', color:'#2ECC71', max:7 },
  { key:'com', label:'Comunicativa "COM"',               abbr:'COM', color:'#C084FC', max:7 },
  { key:'cee', label:'Ejecución Estratégica "CEE"',     abbr:'CEE', color:'#F0C040', max:7 },
];

// ─────────────────────────────────────────────────────────────
//  HANDLERS HTTP
// ─────────────────────────────────────────────────────────────

function doGet(e) {
  return processRequest(e.parameter || {});
}

function doPost(e) {
  var params = {};
  try {
    if (e.postData && e.postData.contents) params = JSON.parse(e.postData.contents);
  } catch(_) { params = e.parameter || {}; }
  return processRequest(params);
}

function processRequest(params) {
  if (params.token !== API_TOKEN) return jsonOut({ ok:false, error:'No autorizado' });
  var action = params.action || '';
  try {
    var result;
    switch (action) {
      case 'getData':                 result = getData();                                                                  break;
      case 'login':                   result = doLogin(params.usuario, params.pass);                                      break;
      case 'getSecretarioData':       result = getSecretarioData(params.usuario);                                         break;
      case 'getDistrictRanking':      result = getDistrictRanking(params.pe);                                             break;
      case 'getRubricaDistritos':     result = getRubricaDistritosAction();                                               break;
      case 'updateScore':             result = updateScore(params.pe, params.usuario, params.criterio, params.valor);     break;
      case 'updateFeedback':          result = updateFeedback(params.pe, params.usuario, params.criterio, params.texto);  break;
      case 'updateBulkScores':        result = updateBulkScores(JSON.parse(params.changes || '[]'));                      break;
      case 'updateDistrictScore':     result = updateDistrictScore(params.pe, params.distrito, params.competencia, params.valor); break;
      case 'updateBulkDistrictScores':result = updateBulkDistrictScores(JSON.parse(params.changes || '[]'));              break;
      case 'saveCalendario':          result = saveCalendario(JSON.parse(params.eventos || '[]'));                        break;
      default: result = { ok:false, error:'Accion desconocida: ' + action };
    }
    return jsonOut(result);
  } catch(err) {
    return jsonOut({ ok:false, error:err.message });
  }
}

function jsonOut(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────
//  doLogin
// ─────────────────────────────────────────────────────────────

function doLogin(usuario, pass) {
  if (!usuario || !pass) return { ok:false, error:'Credenciales requeridas' };
  var ss    = SpreadsheetApp.openById(SS_ID);
  var users = getUsers(ss);
  var u = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].user === String(usuario).trim() && String(users[i].pass) === String(pass).trim()) { u = users[i]; break; }
  }
  if (!u) return { ok:false, error:'Usuario o contraseña incorrectos' };
  return { ok:true, user:u.user, name:u.name, rol:u.rol, distrito:u.distrito||'', districtKey:u.distrito||'' };
}

// ─────────────────────────────────────────────────────────────
//  getData — todos los datos (admin)
// ─────────────────────────────────────────────────────────────

function getData() {
  var ss = SpreadsheetApp.openById(SS_ID);
  return {
    ok:               true,
    users:            getUsers(ss),
    districtKeys:     {},
    criterios:        getCriteriosFromSheet(ss),
    distCompetencias: DIST_COMPETENCIAS,
    scores:           { PE1:getScores(ss,'PE1'),          PE2:getScores(ss,'PE2'),          PE3:getScores(ss,'PE3')          },
    feedback:         { PE1:getFeedback(ss,'PE1'),         PE2:getFeedback(ss,'PE2'),         PE3:getFeedback(ss,'PE3')         },
    districtScores:   { PE1:getDistrictScores(ss,'PE1'),   PE2:getDistrictScores(ss,'PE2'),   PE3:getDistrictScores(ss,'PE3')   },
    rubrica:          getRubrica(ss),
    rubricaDistritos: getRubricaDistritos(ss),
    calendario:       getCalendario(ss),
    ts:               Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────
//  getSecretarioData — solo datos del distrito (secretario/miembro)
// ─────────────────────────────────────────────────────────────

function getSecretarioData(usuario) {
  if (!usuario) return { ok:false, error:'Usuario requerido' };
  var ss    = SpreadsheetApp.openById(SS_ID);
  var users = getUsers(ss);
  var u = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].user === String(usuario).trim()) { u = users[i]; break; }
  }
  if (!u)                                          return { ok:false, error:'Usuario no encontrado' };
  if (u.rol !== 'secretario' && u.rol !== 'miembro') return { ok:false, error:'Acceso no autorizado' };

  var myDistrito = '';
  if (u.rol === 'secretario' && u.distrito) {
    myDistrito = u.distrito.trim();
  }
  if (!myDistrito) {
    myDistrito = findUserDistrito(ss, String(usuario).trim());
  }
  if (!myDistrito) return { ok:false, error:'Sin distrito asignado. Agrega el distrito en col E de USUARIOS o verifica col C en CREATORS SCORE.' };

  function soloDistrito(arr) {
    return arr.filter(function(r) {
      if (String(r.usuario||'').trim().toLowerCase() === String(usuario).trim().toLowerCase()) return true;
      return String(r.distrito||'').trim().toLowerCase() === myDistrito.toLowerCase();
    });
  }
  var scPE1 = soloDistrito(getScores(ss,'PE1'));
  var scPE2 = soloDistrito(getScores(ss,'PE2'));
  var scPE3 = soloDistrito(getScores(ss,'PE3'));
  var dUsers = {};
  scPE1.concat(scPE2).concat(scPE3).forEach(function(r){ dUsers[r.usuario]=true; });
  function soloFb(arr){ return arr.filter(function(r){ return dUsers[r.usuario]; }); }

  return {
    ok:               true,
    myDistrito:       myDistrito,
    criterios:        getCriteriosFromSheet(ss),
    distCompetencias: DIST_COMPETENCIAS,
    scores:           { PE1:scPE1, PE2:scPE2, PE3:scPE3 },
    feedback:         { PE1:soloFb(getFeedback(ss,'PE1')), PE2:soloFb(getFeedback(ss,'PE2')), PE3:soloFb(getFeedback(ss,'PE3')) },
    districtScores:   { PE1:getDistrictScores(ss,'PE1'),   PE2:getDistrictScores(ss,'PE2'),   PE3:getDistrictScores(ss,'PE3')   },
    rubrica:          getRubrica(ss),
    rubricaDistritos: u.rol === 'secretario' ? getRubricaDistritos(ss) : [],
    calendario:       getCalendario(ss),
    ts:               Date.now(),
  };
}

function findUserDistrito(ss, usuario) {
  var pes = ['PE1','PE2','PE3'];
  for (var i = 0; i < pes.length; i++) {
    var sc = getScores(ss, pes[i]);
    for (var j = 0; j < sc.length; j++) {
      if (sc[j].usuario === usuario && sc[j].distrito) return sc[j].distrito.trim();
    }
  }
  return '';
}

// ─────────────────────────────────────────────────────────────
//  getDistrictRanking
// ─────────────────────────────────────────────────────────────

function getDistrictRanking(pe) {
  var periodos = ['PE1','PE2','PE3'];
  var targets  = periodos.indexOf(pe) !== -1 ? [pe] : periodos;
  var ss       = SpreadsheetApp.openById(SS_ID);
  var result   = {};
  targets.forEach(function(p) {
    var ds = getDistrictScores(ss, p);
    result[p] = ds.map(function(d) {
      return {
        dist:         d.distrito,
        total:        d.total,
        criterioAvgs: { cgo:d.cgo, cct:d.cct, com:d.com, cee:d.cee },
      };
    });
  });
  return { ok:true, ranking:result, ts:Date.now() };
}

// ─────────────────────────────────────────────────────────────
//  getRubricaDistritosAction
// ─────────────────────────────────────────────────────────────

function getRubricaDistritosAction() {
  var ss = SpreadsheetApp.openById(SS_ID);
  var rubrica = getRubricaDistritos(ss);
  return { ok:true, rubrica:rubrica };
}

// ─────────────────────────────────────────────────────────────
//  LECTURA
// ─────────────────────────────────────────────────────────────

function getUsers(ss) {
  var sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.slice(1).filter(function(r){ return r[0]; }).map(function(r) {
    var rol      = String(r[3]||'miembro').toLowerCase().trim();
    var distrito = String(r[4]||'').trim();
    return { user:String(r[0]).trim(), pass:String(r[1]).trim(), name:String(r[2]||'').trim(), rol:rol, distrito:distrito, districtKey:distrito };
  });
}

// Lee CREATORS SCORE — incluye col O (estado) como campo "estado"
function getScores(ss, pe) {
  var sheet = ss.getSheetByName('CREATORS SCORE - ' + pe);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.slice(DATA_START_IDX).filter(function(r){ return r[0]; }).map(function(r) {
    return {
      usuario:  String(r[0]).trim(),
      rol:      String(r[1]||'').trim(),
      distrito: String(r[2]||'').trim(),
      nombre:   String(r[3]||'').trim(),
      area:     String(r[4]||'').trim(),
      pla:      toNum(r[COL.pla]),
      rev:      toNum(r[COL.rev]),
      edi:      toNum(r[COL.edi]),
      dis:      toNum(r[COL.dis]),
      flu:      toNum(r[COL.flu]),
      nar:      toNum(r[COL.nar]),
      eje:      toNum(r[COL.eje]),
      ext:      toNum(r[COL.ext]),
      // Col O (índice 14) = Estado: "Activo" o "Inactivo"
      estado:   String(r[COL.estado] || 'Activo').trim() || 'Activo',
    };
  });
}

function getFeedback(ss, pe) {
  var sheet = ss.getSheetByName('CREATORS FEEDBACK - ' + pe);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.slice(DATA_START_IDX).filter(function(r){ return r[0]; }).map(function(r) {
    return {
      usuario:String(r[0]).trim(), nombre:String(r[3]||'').trim(),
      pla:String(r[COL.pla]||'').trim(), rev:String(r[COL.rev]||'').trim(),
      edi:String(r[COL.edi]||'').trim(), dis:String(r[COL.dis]||'').trim(),
      flu:String(r[COL.flu]||'').trim(), nar:String(r[COL.nar]||'').trim(),
      eje:String(r[COL.eje]||'').trim(), ext:String(r[COL.ext]||'').trim(),
    };
  });
}

function getDistrictScores(ss, pe) {
  var sheet = ss.getSheetByName('CREATORS DISTRITOS - ' + pe);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[DCOL.dist]) continue;
    result.push({
      distrito: String(r[DCOL.dist]).trim(),
      cgo:      toNum(r[DCOL.cgo]),
      cct:      toNum(r[DCOL.cct]),
      com:      toNum(r[DCOL.com]),
      cee:      toNum(r[DCOL.cee]),
      total:    toNum(r[DCOL.total]),
    });
  }
  return result.sort(function(a,b){ return b.total - a.total; });
}

function getCriteriosFromSheet(ss) {
  var sheet = ss.getSheetByName('CRITERIOS');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.filter(function(r){ return r[0]; }).map(function(r,i) {
    return { key:String(r[0]).trim()||('c'+i), label:String(r[1]||'').trim()||('Criterio '+(i+1)), abbr:String(r[2]||'').trim()||String(r[0]).trim().toUpperCase().slice(0,3), color:String(r[3]||'').trim()||'#888888' };
  });
}

function getRubrica(ss) {
  var sheet = ss.getSheetByName('TABLA DE PUNTUACIÓN') || ss.getSheetByName('TABLA DE PUNTUACION');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.filter(function(r){ return r[1]; }).map(function(r) {
    return { criterio:String(r[1]).trim(), nivel4:String(r[2]||'').trim(), nivel3:String(r[3]||'').trim(), nivel2:String(r[4]||'').trim(), nivel1:String(r[5]||'').trim() };
  });
}

// Lee la rúbrica de distritos desde "TABLA DE PUNTUACIÓN Distritos"
// Misma estructura que la rúbrica de creators: B=criterio C=nivel4 D=nivel3 E=nivel2 F=nivel1
function getRubricaDistritos(ss) {
  var sheet = ss.getSheetByName('TABLA DE PUNTUACIÓN Distritos')
             || ss.getSheetByName('TABLA DE PUNTUACION Distritos')
             || ss.getSheetByName('TABLA DE PUNTUACIÓN DISTRITOS')
             || ss.getSheetByName('RUBRICA DISTRITOS');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.filter(function(r){ return r[1]; }).map(function(r) {
    return {
      criterio: String(r[1]).trim(),
      nivel4:   String(r[2]||'').trim(),
      nivel3:   String(r[3]||'').trim(),
      nivel2:   String(r[4]||'').trim(),
      nivel1:   String(r[5]||'').trim(),
    };
  });
}

function getCalendario(ss) {
  var sheet = ss.getSheetByName('Calendario') || ss.getSheetByName('CALENDARIO');
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  return rows.slice(1).filter(function(r){ return r[0]; }).map(function(r) {
    return { numero:String(r[0]).trim(), titulo:String(r[1]||'').trim(), color:String(r[2]||'rojo').trim().toLowerCase(), inicio:formatDate(r[3]), finTrabajo:formatDate(r[4]), entrega:formatDate(r[5]), jornada:formatDate(r[6]), estado:String(r[7]||'Pendiente').trim() };
  });
}

// ─────────────────────────────────────────────────────────────
//  ESCRITURA — Scores y Feedback de miembros
// ─────────────────────────────────────────────────────────────

function updateScore(pe, usuario, criterio, valor) {
  if (!pe||!usuario||!criterio) return { ok:false, error:'Parametros incompletos' };
  var colIdx = COL_1B[criterio];
  if (!colIdx) return { ok:false, error:'Criterio desconocido: '+criterio };
  var ss    = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('CREATORS SCORE - '+pe);
  if (!sheet) return { ok:false, error:'Hoja no encontrada: CREATORS SCORE - '+pe };
  var maxVal = criterio==='ext'?2:4;
  var numVal = parseFloat(valor)||0;
  if (numVal<0||numVal>maxVal) return { ok:false, error:'Valor '+numVal+' fuera de rango (0-'+maxVal+')' };
  var rows = sheet.getDataRange().getValues();
  for (var i = DATA_START_IDX; i < rows.length; i++) {
    if (String(rows[i][0]).trim()===String(usuario).trim()) {
      sheet.getRange(i+1, colIdx).setValue(numVal);
      return { ok:true, pe:pe, usuario:usuario, criterio:criterio, valor:numVal };
    }
  }
  return { ok:false, error:'Usuario no encontrado: '+usuario };
}

function updateFeedback(pe, usuario, criterio, texto) {
  if (!pe||!usuario||!criterio) return { ok:false, error:'Parametros incompletos' };
  var colIdx = COL_1B[criterio];
  if (!colIdx) return { ok:false, error:'Criterio desconocido: '+criterio };
  var ss    = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('CREATORS FEEDBACK - '+pe);
  if (!sheet) return { ok:false, error:'Hoja no encontrada: CREATORS FEEDBACK - '+pe };
  var rows = sheet.getDataRange().getValues();
  for (var i = DATA_START_IDX; i < rows.length; i++) {
    if (String(rows[i][0]).trim()===String(usuario).trim()) {
      sheet.getRange(i+1, colIdx).setValue(String(texto||'').trim());
      return { ok:true };
    }
  }
  return { ok:false, error:'Usuario no encontrado: '+usuario };
}

function updateBulkScores(changes) {
  if (!Array.isArray(changes)) return { ok:false, error:'changes debe ser un array' };
  var results = changes.map(function(c){ return updateScore(c.pe,c.usuario,c.criterio,c.valor); });
  var failed  = results.filter(function(r){ return !r.ok; });
  return { ok:failed.length===0, total:changes.length, failed:failed };
}

// ─────────────────────────────────────────────────────────────
//  ESCRITURA — Scores de distritos
// ─────────────────────────────────────────────────────────────

function updateDistrictScore(pe, distrito, competencia, valor) {
  if (!pe||!distrito||!competencia) return { ok:false, error:'Parametros incompletos' };
  var colIdx = DCOL_1B[competencia];
  if (!colIdx) return { ok:false, error:'Competencia desconocida: '+competencia };
  var ss    = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('CREATORS DISTRITOS - '+pe);
  if (!sheet) return { ok:false, error:'Hoja no encontrada: CREATORS DISTRITOS - '+pe };
  var maxVal = 7;
  var numVal = parseFloat(valor)||0;
  if (numVal<0||numVal>maxVal) return { ok:false, error:'Valor '+numVal+' fuera de rango (0-7)' };
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][DCOL.dist]).trim().toLowerCase()===String(distrito).trim().toLowerCase()) {
      sheet.getRange(i+1, colIdx).setValue(numVal);
      return { ok:true, pe:pe, distrito:distrito, competencia:competencia, valor:numVal };
    }
  }
  return { ok:false, error:'Distrito no encontrado: '+distrito };
}

function updateBulkDistrictScores(changes) {
  if (!Array.isArray(changes)) return { ok:false, error:'changes debe ser un array' };
  var results = changes.map(function(c){ return updateDistrictScore(c.pe,c.distrito,c.competencia,c.valor); });
  var failed  = results.filter(function(r){ return !r.ok; });
  return { ok:failed.length===0, total:changes.length, failed:failed };
}

// ─────────────────────────────────────────────────────────────
//  ESCRITURA — Calendario
// ─────────────────────────────────────────────────────────────

function saveCalendario(eventos) {
  if (!Array.isArray(eventos)) return { ok:false, error:'eventos debe ser un array' };
  var ss    = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName('Calendario') || ss.getSheetByName('CALENDARIO');
  if (!sheet) return { ok:false, error:'Hoja Calendario no encontrada' };
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
  }
  if (!eventos.length) return { ok:true, saved:0 };
  var rows = eventos.map(function(e, i) {
    return [
      e.numero   || (i + 1),
      e.titulo   || '',
      e.color    || 'rojo',
      e.inicio   || '',
      e.finTrabajo || '',
      e.entrega  || '',
      e.jornada  || '',
      e.estado   || 'Pendiente',
    ];
  });
  sheet.getRange(2, 1, rows.length, 8).setValues(rows);
  return { ok:true, saved:rows.length };
}

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────

function toNum(v) {
  if (v===null||v===undefined||v==='') return 0;
  var n = parseFloat(v);
  return isNaN(n)?0:n;
}

function formatDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.getDate()+'/'+(v.getMonth()+1)+'/'+v.getFullYear();
  return String(v).trim();
}
