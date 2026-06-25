'use strict';
const btn = document.getElementById('btn-entrar');
const err = document.getElementById('login-err');

btn.addEventListener('click', async () => {
  const email = document.getElementById('inp-email').value.trim();
  const senha = document.getElementById('inp-senha').value;
  err.textContent = '';
  if (!email || !senha) { err.textContent = 'preencha os dois campos'; return; }
  btn.disabled = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const d = await res.json();
    if (!res.ok || !d.token) { err.textContent = d.erro || 'credenciais inválidas'; return; }
    sessionStorage.setItem('ctrl-token', d.token);
    window.location.href = '../kpi/kpi.html';
  } catch {
    err.textContent = 'erro de conexão';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('inp-senha').addEventListener('keydown', e => {
  if (e.key === 'Enter') btn.click();
});