'use strict';

// ── Registro do Service Worker ────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] SW registrado:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              _notificarAtualizacao();
            }
          });
        });
      })
      .catch(err => console.warn('[PWA] SW falhou:', err));
  });
}

// ── Banner de atualização disponível ─────────────────────────────────────────
function _notificarAtualizacao() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    background:#161b22;border:1px solid #21262d;border-radius:8px;
    padding:12px 20px;display:flex;align-items:center;gap:12px;
    font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:#e6edf3;
    z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,.4)
  `;
  banner.innerHTML = `
    <span>Nova versão disponível</span>
    <button onclick="location.reload()" style="
      background:#58a6ff;border:none;border-radius:6px;color:#0d1117;
      cursor:pointer;font-size:12px;font-weight:600;padding:5px 12px
    ">Atualizar</button>
    <button onclick="this.parentElement.remove()" style="
      background:none;border:none;color:#8b949e;cursor:pointer;font-size:16px;line-height:1
    ">×</button>
  `;
  document.body.appendChild(banner);
}

// ── Permissão de notificações push ───────────────────────────────────────────
window.PWA = {
  async pedirPermissaoNotificacao() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  },
  notificar(titulo, corpo, url = '/') {
    if (Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(titulo, {
        body:  corpo,
        icon:  '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data:  { url }
      });
    });
  }
};
let _installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) {
    btn.style.display = 'inline-flex';
    btn.addEventListener('click', () => {
      _installPrompt.prompt();
      _installPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') btn.style.display = 'none';
        _installPrompt = null;
      });
    });
  }
});