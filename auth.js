/**
 * EIGHT CREATORS LABs — Autenticación y sesión
 */
const Auth = (() => {
  const SK = 'ec_session';
  const DK = 'ec_data';

  // Destino por rol
  function destByRol(rol) {
    if (rol === 'admin')      return 'admin.html';
    if (rol === 'secretario') return 'secretario.html';
    if (rol === 'miembro')    return 'secretario.html'; // misma interfaz
    return 'index.html';
  }

  return {
    setSession(user)   { sessionStorage.setItem(SK, JSON.stringify(user)); },
    getSession()       { try { const s = sessionStorage.getItem(SK); return s ? JSON.parse(s) : null; } catch { return null; } },
    isLoggedIn()       { return Boolean(this.getSession()); },
    setCachedData(d)   { try { sessionStorage.setItem(DK, JSON.stringify(d)); } catch {} },
    getCachedData()    { try { const s = sessionStorage.getItem(DK); return s ? JSON.parse(s) : null; } catch { return null; } },
    logout()           { sessionStorage.removeItem(SK); sessionStorage.removeItem(DK); },

    // Requiere un rol específico
    requireRole(role) {
      const user = this.getSession();
      if (!user) { window.location.replace('index.html'); return null; }
      if (user.rol !== role) { window.location.replace(destByRol(user.rol)); return null; }
      return user;
    },

    // Requiere cualquiera de los roles indicados
    requireAnyRole(roles) {
      const user = this.getSession();
      if (!user) { window.location.replace('index.html'); return null; }
      if (!roles.includes(user.rol)) { window.location.replace(destByRol(user.rol)); return null; }
      return user;
    },
  };
})();
