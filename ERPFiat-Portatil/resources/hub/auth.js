'use strict';
(function () {
  const token = sessionStorage.getItem('ctrl-token');
  if (!token) { window.location.href = '/login'; return; }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      sessionStorage.removeItem('ctrl-token');
      window.location.href = '/login';
      return;
    }
    window.__authUser = {
      nome: payload.nome || payload.email,
      email: payload.email,
      role: payload.role || 'visualizador',
      avatar: (payload.nome || payload.email).slice(0, 2).toUpperCase()
    };
  } catch {
    sessionStorage.removeItem('ctrl-token');
    window.location.href = '/login';
  }
})();