'use strict';

const $ = id => document.getElementById(id);

function pegarCodin() {
  const partes = window.location.pathname.split('/').filter(Boolean);
  return partes[1] || '';
}

function gerarIdSolicitacao() {
  return 'sol-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function carregarNomePonto() {
  const codin = pegarCodin();
  try {
    const res = await fetch('/api/codin');
    const dados = await res.json();
    const ponto = (dados.pontos || []).find(p => p.codin === codin || p.id === codin);
    $('ponto-nome').textContent = ponto ? `${ponto.nome} — CODIN ${ponto.codin}` : `Ponto CODIN ${codin}`;
  } catch {
    $('ponto-nome').textContent = `Ponto CODIN ${codin}`;
  }
}

async function enviarSolicitacao() {
  const nome = $('rq-nome').value.trim();
  const email = $('rq-email').value.trim();
  const cargo = $('rq-cargo').value.trim();
  const setor = $('rq-setor').value.trim();
  const motivo = $('rq-motivo').value.trim();
  const erro = $('rq-erro');
  erro.textContent = '';

  if (!nome || !email || !motivo) {
    erro.textContent = 'Preencha nome, e-mail e o motivo da solicitação.';
    return;
  }

  const codin = pegarCodin();
  const btn = $('rq-enviar');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const solicitacao = {
    id: gerarIdSolicitacao(),
    codin,
    nome,
    email,
    cargo,
    setor,
    motivo,
    status: 'Pendente',
    data: new Date().toISOString()
  };

  try {
    const res = await fetch('/api/codin/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solicitacao)
    });
    if (!res.ok) throw new Error('falha ao enviar');

    $('form-area').style.display = 'none';
    $('sucesso-area').style.display = 'block';
  } catch {
    erro.textContent = 'Não foi possível enviar a solicitação. Tente novamente.';
    btn.disabled = false;
    btn.textContent = 'Enviar Solicitação';
  }
}

$('rq-enviar').addEventListener('click', enviarSolicitacao);

$('btn-nova').addEventListener('click', () => {
  $('rq-nome').value = '';
  $('rq-email').value = '';
  $('rq-cargo').value = '';
  $('rq-setor').value = '';
  $('rq-motivo').value = '';
  $('rq-erro').textContent = '';
  const btn = $('rq-enviar');
  btn.disabled = false;
  btn.textContent = 'Enviar Solicitação';
  $('sucesso-area').style.display = 'none';
  $('form-area').style.display = 'block';
});

carregarNomePonto();