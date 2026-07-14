'use strict';
const btn = document.getElementById('btn-entrar');
const err = document.getElementById('login-err');

btn.addEventListener('click', async () => {
  const email = document.getElementById('inp-email').value.trim();
  const senha = document.getElementById('inp-senha').value;
  err.textContent = '';
  if (!email || !senha) { err.textContent = 'preencha os dois campos'; return; }

  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const avisoTimeout = setTimeout(() => {
    err.textContent = 'Aguarde, o servidor está acordando... pode levar até 1 minuto na primeira vez.';
  }, 5000);

  try {
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 90000);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(fetchTimeout);
    clearTimeout(avisoTimeout);

    const d = await res.json();
    if (!res.ok || !d.token) {
      err.textContent = d.erro || 'credenciais inválidas';
      return;
    }
    localStorage.setItem('ctrl-token', d.token);
    const maxAge = 12 * 3600;
    document.cookie = `ctrl-token=${d.token}; path=/; max-age=${maxAge}; SameSite=None; Secure`;

    err.textContent = '';
    window.location.href = '/kpi';
  } catch (e) {
    clearTimeout(avisoTimeout);
    if (e.name === 'AbortError') {
      err.textContent = 'Tempo limite atingido. Tente novamente.';
    } else {
      err.textContent = 'erro de conexão';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

document.getElementById('inp-senha').addEventListener('keydown', e => {
  if (e.key === 'Enter') btn.click();
});