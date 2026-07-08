'use strict';
(function () {
  const token = localStorage.getItem('ctrl-token');
  if (!token) { window.location.href = '/login'; return; }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem('ctrl-token');
      window.location.href = '/login';
      return;
    }
    const nomecompleto = payload.nome || payload.email;
    const partes = nomecompleto.trim().split(/\s+/);
    const iniciais = partes.length >= 2
      ? (partes[0][0] + partes[partes.length - 1][0])
      : nomecompleto.slice(0, 2);
    window.__authUser = {
      nome: nomecompleto,
      email: payload.email,
      role: payload.role || 'visualizador',
      avatar: iniciais.toUpperCase()
    };
  } catch {
    localStorage.removeItem('ctrl-token');
    window.location.href = '/login';
  }
})();