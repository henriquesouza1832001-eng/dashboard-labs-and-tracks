'use strict';

const $ = id => document.getElementById(id);

function fmtData(iso) {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function statusInfo(s) {
  const map = {
    'Aberto': { cls: 'mc-aberto', label: 'Aberto' },
    'Em Andamento': { cls: 'mc-andamento', label: 'Em Andamento' },
    'Concluído': { cls: 'mc-concluido', label: 'Concluído' },
    'Cancelado': { cls: 'mc-andamento', label: 'Cancelado' }
  };
  return map[s] || { cls: 'mc-aberto', label: s || '–' };
}

async function buscarChamados() {
  const email = $('mc-email').value.trim().toLowerCase();
  const resultado = $('mc-resultado');

  if (!email) {
    resultado.innerHTML = '<div class="mc-erro">Digite um e-mail para buscar.</div>';
    return;
  }

  resultado.innerHTML = '<div class="mc-vazio">Buscando...</div>';

  try {
    const res = await fetch(`/api/chamados/por-email/${encodeURIComponent(email)}`);
    const dados = await res.json();
    const lista = dados.chamados || [];

    if (!lista.length) {
      resultado.innerHTML = '<div class="mc-vazio">Nenhum chamado encontrado para esse e-mail.</div>';
      return;
    }

    const ordenada = lista.slice().sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));

    resultado.innerHTML = ordenada.map(c => {
      const st = statusInfo(c.status);
      return `
        <div class="mc-card">
          <div class="mc-id">${c.id}</div>
          <div class="mc-titulo">${c.titulo || '–'}</div>
          <div class="mc-meta">${c.local || '–'} · aberto em ${fmtData(c.dataAbertura)}</div>
          <span class="mc-status ${st.cls}">${st.label}</span>
          ${c.descricao ? `<div class="mc-desc">${c.descricao}</div>` : ''}
        </div>
      `;
    }).join('');
  } catch {
    resultado.innerHTML = '<div class="mc-erro">Erro ao buscar chamados. Tente novamente.</div>';
  }
}

$('mc-buscar').addEventListener('click', buscarChamados);
$('mc-email').addEventListener('keydown', e => {
  if (e.key === 'Enter') buscarChamados();
});

(function init() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email');
  if (email) {
    $('mc-email').value = email;
    buscarChamados();
  }
})();