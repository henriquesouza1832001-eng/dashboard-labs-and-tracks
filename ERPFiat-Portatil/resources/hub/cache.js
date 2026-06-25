'use strict';

const CHAVES = {
  chamados: 'ctrl_chamados',
  obras:    'ctrl_obras',
  codin:    'ctrl_codin',
  conforto: 'ctrl_conforto',
  kpi:      'ctrl_kpi',
  config:   'ctrl_config',
};

const STALE_MS = 5 * 60 * 1000;

function ler(modulo) {
  try {
    const raw = sessionStorage.getItem(CHAVES[modulo]);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, stale: Date.now() - ts > STALE_MS };
  } catch { return null; }
}

function salvar(modulo, data) {
  try {
    sessionStorage.setItem(CHAVES[modulo], JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

async function carregar(modulo, fetchFn, renderFn) {
  const cached = ler(modulo);
  if (cached) {
    renderFn(cached.data);
    if (!cached.stale) return;
  }
  try {
    const fresco = await fetchFn();
    salvar(modulo, fresco);
    renderFn(fresco);
  } catch (e) {
    if (!cached) throw e;
  }
}