/**
 * EIGHT CREATORS LABs — Capa de API
 * ─────────────────────────────────
 * Toda comunicación con el backend pasa por aquí.
 * Ninguna URL ni referencia al origen se expone en la UI.
 */
const API = (() => {
  async function call(action, params = {}) {
    const url = new URL(PORTAL_CONFIG.API_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('token',  PORTAL_CONFIG.TOKEN);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    }
    try {
      const r    = await fetch(url.toString(), { cache: 'no-store' });
      const text = await r.text();
      return JSON.parse(text);
    } catch (e) {
      console.error('[API]', e);
      return { ok: false, error: 'Error de conexión.' };
    }
  }

  return {
    getData:         ()                           => call('getData'),
    updateScore:     (pe, usuario, criterio, val) => call('updateScore',    { pe, usuario, criterio, valor: val }),
    updateFeedback:  (pe, usuario, criterio, txt) => call('updateFeedback', { pe, usuario, criterio, texto: txt }),
    updateBulkScores:(changes)                    => call('updateBulkScores', { changes: JSON.stringify(changes) }),
  };
})();
