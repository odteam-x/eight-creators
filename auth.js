/**
 * EIGHT CREATORS LABs — Autenticación y sesión
 */
const Auth = (() => {
  const SK = 'ec_session';
  const DK = 'ec_data';

  return {
    setSession(user)   { sessionStorage.setItem(SK, JSON.stringify(user)); },
    getSession()       { try { const s = sessionStorage.getItem(SK); return s ? JSON.parse(s) : null; } catch { return null; } },
    isLoggedIn()       { return Boolean(this.getSession()); },
    setCachedData(d)   { try { sessionStorage.setItem(DK, JSON.stringify(d)); } catch {} },
    getCachedData()    { try { const s = sessionStorage.getItem(DK); return s ? JSON.parse(s) : null; } catch { return null; } },
    logout()           { sessionStorage.removeItem(SK); sessionStorage.removeItem(DK); },

    requireRole(role) {
      const user = this.getSession();
      if (!user)             { window.location.replace('index.html'); return null; }
      if (user.rol !== role) { window.location.replace(user.rol === 'admin' ? 'admin.html' : 'user.html'); return null; }
      return user;
    },
  };
})();
