// ═══════════════════════════════════════════════════════════════
//  EIGHT CREATORS LABs — Google Apps Script Backend
//  CELIDER Santiago · Sistema de Evaluación
// ═══════════════════════════════════════════════════════════════
//
//  INSTRUCCIONES DE DESPLIEGUE
//  ────────────────────────────
//  1. Abre script.google.com → crea nuevo proyecto.
//  2. Pega este código en el editor (Code.gs).
//  3. Cambia SS_ID al ID de tu Google Spreadsheet.
//  4. Cambia API_TOKEN por un token secreto tuyo.
//  5. Haz clic en "Implementar" → "Nueva implementación".
//     · Tipo: Aplicación web
//     · Ejecutar como: Yo (tu cuenta)
//     · Quién tiene acceso: Cualquier persona
//  6. Copia la URL de la implementación.
//  7. Pégala en /scripts/config.js en el campo API_URL.
//  8. Asegúrate de que API_TOKEN sea el mismo en ambos lados.
// ═══════════════════════════════════════════════════════════════

const SS_ID     = '1ZDj4OvA1lkdUKTU-hU24CY34CKekZKb_i0oGlcWNCdo'; // ← REEMPLAZAR
const API_TOKEN = 'sti2026';        // ← CAMBIAR A ALGO SECRETO

// ─────────────────────────────────────────────────────────────
//  CLAVES DE DISTRITO
//  ─────────────────────────────────────────────────────────────
//  Configura aquí los distritos y sus claves secretas.
//  Formato: 'CLAVE_SECRETA': 'Nombre exacto del distrito en el Sheet'
//
//  El "Nombre exacto" debe coincidir con lo que está escrito
//  en la columna C (Distrito) de las hojas CREATORS SCORE.
//
//  Luego en la hoja USUARIOS, columna E, pon la clave del
//  secretario que corresponde a ese distrito.
//
//  Ejemplo:
//    Si en CREATORS SCORE - PE1, columna C dice "Santiago 08-06",
//    entonces pon: 'CLAVE_08_06': 'Santiago 08-06'
// ─────────────────────────────────────────────────────────────
const DISTRICT_KEYS = {
  '_01': '08-01',
  '_02': '08-02',
  '_03': '08-03',
  '_04': '08-04',
  '_05': '08-05',
  '_06': '08-06',
  '_07': '08-07',
  '_08': '08-08',
  '_09': '08-09',
  '10': '08-10',
};

// Columnas de datos (0-based, desde el inicio de la fila)
// Estructura real del Sheet: A=usuario, B=rol, C=distrito, D=nombre, E=area
// F=pla, G=rev, H=edi, I=dis, J=flu, K=nar, L=eje, M=ext
const COL = { pla:5, rev:6, edi:7, dis:8, flu:9, nar:10, eje:11, ext:12 };
const COL_1B = { pla:6, rev:7, edi:8, dis:9, flu:10, nar:11, eje:12, ext:13 }; // 1-based para setRange

// Columna E de USUARIOS (índice 4) = clave de distrito (solo para secretarios)
// Ejemplo: 'CLAVE_08_06'
const COL_USUARIO_DISTRICT_KEY = 4; // 0-based

// Los datos reales empiezan en la fila 4 (filas 1-3 son encabezados)
const DATA_START_IDX = 3; // 0-based

// ─────────────────────────────────────────────────────────────
//  HANDLERS HTTP
// ─────────────────────────────────────────────────────────────

function doGet(e) {
  const params = e.parameter || {};
  return processRequest(params);
}

function doPost(e) {
  let params = {};
  try {
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
  } catch (_) {
    params = e.parameter || {};
  }
  return processRequest(params);
}

function processRequest(params) {
  // Verificar token
  if (params.token !== API_TOKEN) {
    return jsonOut({ ok: false, error: 'No autorizado' });
  }

  const action = params.action || '';

  try {
    let result;
    switch (action) {
      case 'getData':
        result = getData();
        break;
      case 'updateScore':
        result = updateScore(params.pe, params.usuario, params.criterio, params.valor);
        break;
      case 'updateFeedback':
        result = updateFeedback(params.pe, params.usuario, params.criterio, params.texto);
        break;
      case 'updateBulkScores':
        result = updateBulkScores(JSON.parse(params.changes || '[]'));
        break;
      default:
        result = { ok: false, error: `Acción desconocida: ${action}` };
    }
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────
//  LECTURA — getData
// ─────────────────────────────────────────────────────────────

function getData() {
  const ss = SpreadsheetApp.openById(SS_ID);
  return {
    ok:           true,
    users:        getUsers(ss),
    districtKeys: DISTRICT_KEYS,   // mapa clave → nombre, para el frontend
    criterios:    getCriteriosFromSheet(ss),
    scores:     {
      PE1: getScores(ss, 'PE1'),
      PE2: getScores(ss, 'PE2'),
      PE3: getScores(ss, 'PE3'),
    },
    feedback:   {
      PE1: getFeedback(ss, 'PE1'),
      PE2: getFeedback(ss, 'PE2'),
      PE3: getFeedback(ss, 'PE3'),
    },
    rubrica:    getRubrica(ss),
    calendario: getCalendario(ss),
    ts:         Date.now(),
  };
}

function getUsers(ss) {
  const sheet = ss.getSheetByName('USUARIOS');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows
    .slice(1)
    .filter(r => r[0])
    .map(r => {
      const rol         = String(r[3] || 'miembro').toLowerCase().trim();
      const districtKey = String(r[4] || '').trim();
      const distrito    = districtKey ? (DISTRICT_KEYS[districtKey] || districtKey) : '';
      return {
        user:        String(r[0]).trim(),
        pass:        String(r[1]).trim(),
        name:        String(r[2] || '').trim(),
        rol,
        districtKey,
        distrito,
      };
    });
}

function getCriteriosFromSheet(ss) {
  const sheet = ss.getSheetByName('CRITERIOS');
  if (!sheet) return []; // Frontend usará los defaults
  const rows = sheet.getDataRange().getValues();
  return rows
    .filter(r => r[0])
    .map((r, i) => ({
      key:   String(r[0]).trim() || `c${i}`,
      label: String(r[1] || '').trim() || `Criterio ${i+1}`,
      abbr:  String(r[2] || '').trim() || String(r[0]).trim().toUpperCase().slice(0, 3),
      color: String(r[3] || '').trim() || '#888888',
    }));
}

function getScores(ss, pe) {
  const sheet = ss.getSheetByName(`CREATORS SCORE - ${pe}`);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows
    .slice(DATA_START_IDX)
    .filter(r => r[0])
    .map(r => ({
      usuario: String(r[0]).trim(),
      rol:     String(r[1] || '').trim(),
      distrito: String(r[2] || '').trim(),
      nombre:  String(r[3] || '').trim(),
      area:    String(r[4] || '').trim(),
      pla:     toNum(r[COL.pla]),
      rev:     toNum(r[COL.rev]),
      edi:     toNum(r[COL.edi]),
      dis:     toNum(r[COL.dis]),
      flu:     toNum(r[COL.flu]),
      nar:     toNum(r[COL.nar]),
      eje:     toNum(r[COL.eje]),
      ext:     toNum(r[COL.ext]),    }));
}

function getFeedback(ss, pe) {
  const sheet = ss.getSheetByName(`CREATORS FEEDBACK - ${pe}`);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows
    .slice(DATA_START_IDX)
    .filter(r => r[0])
    .map(r => ({
      usuario: String(r[0]).trim(),
      nombre:  String(r[3] || '').trim(),
      pla:     String(r[COL.pla] || '').trim(),
      rev:     String(r[COL.rev] || '').trim(),
      edi:     String(r[COL.edi] || '').trim(),
      dis:     String(r[COL.dis] || '').trim(),
      flu:     String(r[COL.flu] || '').trim(),
      nar:     String(r[COL.nar] || '').trim(),
      eje:     String(r[COL.eje] || '').trim(),
      ext:     String(r[COL.ext] || '').trim(),
    }));
}

function getRubrica(ss) {
  const sheet = ss.getSheetByName('TABLA DE PUNTUACIÓN')
               || ss.getSheetByName('TABLA DE PUNTUACION');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows
    .filter(r => r[1]) // columna B tiene el criterio
    .map(r => ({
      criterio: String(r[1]).trim(),
      nivel4:   String(r[2] || '').trim(),
      nivel3:   String(r[3] || '').trim(),
      nivel2:   String(r[4] || '').trim(),
      nivel1:   String(r[5] || '').trim(),
    }));
}

function getCalendario(ss) {
  const sheet = ss.getSheetByName('Calendario')
               || ss.getSheetByName('CALENDARIO');
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows
    .slice(1) // omitir encabezado
    .filter(r => r[0])
    .map(r => ({
      numero:     String(r[0]).trim(),
      titulo:     String(r[1] || '').trim(),
      color:      String(r[2] || 'rojo').trim().toLowerCase(),
      inicio:     formatDate(r[3]),
      finTrabajo: formatDate(r[4]),
      entrega:    formatDate(r[5]),
      jornada:    formatDate(r[6]),
      estado:     String(r[7] || 'Pendiente').trim(),
    }));
}

// ─────────────────────────────────────────────────────────────
//  ESCRITURA
// ─────────────────────────────────────────────────────────────

/**
 * Actualiza un único criterio de puntuación.
 * @param {string} pe     - 'PE1', 'PE2', o 'PE3'
 * @param {string} usuario - username (columna A)
 * @param {string} criterio - key del criterio (pla, rev, edi, etc.)
 * @param {*}     valor   - número 0-4
 */
function updateScore(pe, usuario, criterio, valor) {
  if (!pe || !usuario || !criterio) return { ok: false, error: 'Parámetros incompletos' };
  const colIdx = COL_1B[criterio];
  if (!colIdx) return { ok: false, error: `Criterio desconocido: ${criterio}` };

  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(`CREATORS SCORE - ${pe}`);
  if (!sheet) return { ok: false, error: `Hoja no encontrada: CREATORS SCORE - ${pe}` };

  // Validar rango según criterio
  const maxVal = criterio === 'ext' ? 2 : 4;
  const numVal = parseFloat(valor) || 0;
  if (numVal < 0 || numVal > maxVal) return { ok: false, error: `Valor ${numVal} fuera de rango (0-${maxVal})` };

  const rows = sheet.getDataRange().getValues();
  for (let i = DATA_START_IDX; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(usuario).trim()) {
      sheet.getRange(i + 1, colIdx).setValue(numVal);
      return { ok: true, pe, usuario, criterio, valor: numVal };
    }
  }
  return { ok: false, error: `Usuario no encontrado: ${usuario}` };
}

/**
 * Actualiza un texto de feedback para un criterio.
 */
function updateFeedback(pe, usuario, criterio, texto) {
  if (!pe || !usuario || !criterio) return { ok: false, error: 'Parámetros incompletos' };
  const colIdx = COL_1B[criterio];
  if (!colIdx) return { ok: false, error: `Criterio desconocido: ${criterio}` };

  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(`CREATORS FEEDBACK - ${pe}`);
  if (!sheet) return { ok: false, error: `Hoja no encontrada: CREATORS FEEDBACK - ${pe}` };

  const rows = sheet.getDataRange().getValues();
  for (let i = DATA_START_IDX; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(usuario).trim()) {
      sheet.getRange(i + 1, colIdx).setValue(String(texto || '').trim());
      return { ok: true, pe, usuario, criterio };
    }
  }
  return { ok: false, error: `Usuario no encontrado: ${usuario}` };
}

/**
 * Actualiza múltiples scores de una vez (batch).
 * @param {Array} changes - [{pe, usuario, criterio, valor}, ...]
 */
function updateBulkScores(changes) {
  if (!Array.isArray(changes)) return { ok: false, error: 'changes debe ser un array' };
  const results = changes.map(c => updateScore(c.pe, c.usuario, c.criterio, c.valor));
  const failed  = results.filter(r => !r.ok);
  return { ok: failed.length === 0, total: changes.length, failed };
}

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatDate(v) {
  if (!v) return '';
  if (v instanceof Date) {
    const d = v.getDate();
    const m = v.getMonth() + 1;
    const y = v.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return String(v).trim();
}
