/**
 * EIGHT CREATORS LABs — Capa de API
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
    // Auth
    login:                   (u, p)                              => call('login',                   { usuario:u, pass:p }),
    // Datos
    getData:                 ()                                   => call('getData'),
    getSecretarioData:       (usuario)                            => call('getSecretarioData',       { usuario }),
    getDistrictRanking:      (pe)                                 => call('getDistrictRanking',       { pe }),
    // Scores de miembros
    updateScore:             (pe, usuario, criterio, val)         => call('updateScore',             { pe, usuario, criterio, valor:val }),
    updateFeedback:          (pe, usuario, criterio, txt)         => call('updateFeedback',           { pe, usuario, criterio, texto:txt }),
    updateBulkScores:        (changes)                            => call('updateBulkScores',         { changes:JSON.stringify(changes) }),
    // Scores de distritos (sin feedback)
    updateDistrictScore:     (pe, distrito, competencia, val)     => call('updateDistrictScore',     { pe, distrito, competencia, valor:val }),
    updateBulkDistrictScores:(changes)                            => call('updateBulkDistrictScores', { changes:JSON.stringify(changes) }),
    // Calendario
    saveCalendario:          (eventos)                             => call('saveCalendario',          { eventos:JSON.stringify(eventos) }),
    // Rúbrica de distritos
    getRubricaDistritos:     ()                                    => call('getRubricaDistritos'),
    // Configuración — escritura
    saveCriterios:           (criterios)                           => call('saveCriterios',        { criterios:JSON.stringify(criterios) }),
    saveRubrica:             (rubrica)                             => call('saveRubrica',           { rubrica:JSON.stringify(rubrica) }),
    saveRubricaDistritos:    (rubrica)                             => call('saveRubricaDistritos',  { rubrica:JSON.stringify(rubrica) }),
    saveUsuarios:            (usuarios)                            => call('saveUsuarios',           { usuarios:JSON.stringify(usuarios) }),
  };
})();
