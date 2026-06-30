'use strict';

const $ = id => document.getElementById(id);

let chamados = [];
let verTodos = false;

function mostrarToast(msg) {
  const t = $('sd-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function fmtData(iso) {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function renderLista() {
  const busca = ($('sd-busca').value || '').toLowerCase();
  const lista = chamados.filter(c => {
    if (!verTodos && c.idExterno) return false;
    if (!busca) return true;
    const alvo = [c.id, c.titulo, c.local].join(' ').toLowerCase();
    return alvo.includes(busca);
  });

  const container = $('sd-lista');

  if (!lista.length) {
    container.innerHTML = '<div class="sd-vazio">Nenhum chamado pendente de cadastro de ID.</div>';
    return;
  }

  container.innerHTML = lista.map(c => `
    <div class="sd-card ${c.idExterno ? 'com-id' : ''}" data-id="${c.id}">
      <div class="sd-info">
        <div class="sd-id">${c.id}</div>
        <div class="sd-titulo">${c.titulo || '–'}</div>
        <div class="sd-meta">${c.local || '–'} · aberto em ${fmtData(c.dataAbertura)}</div>
      </div>
      <div class="sd-form">
        <input type="text" placeholder="ID externo" value="${c.idExterno || ''}" data-id="${c.id}">
        <button data-id="${c.id}">Salvar</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => salvarId(btn.dataset.id));
  });
}

async function salvarId(id) {
  const input = document.querySelector(`input[data-id="${id}"]`);
  const idExterno = input.value.trim();
  const chamado = chamados.find(c => c.id === id);
  if (!chamado) return;

  chamado.idExterno = idExterno;

  try {
    const res = await fetch(`/api/chamados/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chamado)
    });
    if (!res.ok) throw new Error('falha');
    mostrarToast('ID salvo com sucesso.');
    renderLista();
  } catch {
    mostrarToast('Erro ao salvar. Tente novamente.');
  }
}

async function carregar() {
  try {
    const dados = window.__DADOS__ || await fetch('/api/chamados').then(r => r.json());
    chamados = (dados.chamados || []).sort((a, b) =>
      new Date(b.dataAbertura) - new Date(a.dataAbertura)
    );
    renderLista();
  } catch {
    $('sd-lista').innerHTML = '<div class="sd-vazio">Erro ao carregar chamados.</div>';
  }
}

$('sd-busca').addEventListener('input', renderLista);
$('sd-ver-todos').addEventListener('change', e => {
  verTodos = e.target.checked;
  renderLista();
});

carregar();