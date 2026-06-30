'use strict';

const $ = id => document.getElementById(id);

let fotos = [];

function slugParaNome(slug) {
  return slug.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function pegarArea() {
  const partes = window.location.pathname.split('/').filter(Boolean);
  return partes[1] || '';
}

function gerarIdChamado(cat) {
  const ano = new Date().getFullYear();
  const ts = Date.now().toString().slice(-6);
  return `${cat}-${ano}-${ts}`;
}

function renderFotos() {
  const grid = $('qr-fotos-grid');
  grid.innerHTML = fotos.map((f, i) => `
    <div class="qr-thumb">
      <img src="${f}" alt="foto ${i + 1}">
      <button data-i="${i}" type="button">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
  grid.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      fotos.splice(parseInt(btn.dataset.i), 1);
      renderFotos();
    });
  });
}

$('qr-add-foto').addEventListener('click', () => $('qr-foto-input').click());

$('qr-foto-input').addEventListener('change', e => {
  const arquivos = Array.from(e.target.files);
  let carregados = 0;
  arquivos.forEach(arq => {
    const leitor = new FileReader();
    leitor.onload = ev => {
      fotos.push(ev.target.result);
      carregados++;
      if (carregados === arquivos.length) renderFotos();
    };
    leitor.readAsDataURL(arq);
  });
  e.target.value = '';
});

async function enviarChamado() {
  const cat = $('qr-cat').value;
  const prio = $('qr-prio').value;
  const desc = $('qr-desc').value.trim();
  const nome = $('qr-nome').value.trim();
  const erro = $('qr-erro');
  erro.textContent = '';

  if (!cat || !desc) {
    erro.textContent = 'Preencha a categoria e a descrição do problema.';
    return;
  }

  const slug = pegarArea();
  const local = slugParaNome(slug);
  const id = gerarIdChamado(cat);
  const btn = $('qr-enviar');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const chamado = {
    id,
    titulo: `Chamado via QR — ${local}`,
    categoria: cat,
    tipo: '',
    prioridade: prio,
    local,
    setor: '',
    solicitante: nome,
    dataDesejada: '',
    descricao: desc,
    status: 'Aberto',
    responsavel: '',
    idExterno: '',
    dataAbertura: new Date().toISOString(),
    dataConclusao: null,
    fotos: [...fotos],
    historico: [{
      data: new Date().toISOString(),
      acao: 'Chamado aberto via QR Code',
      obs: desc,
      cor: '#58a6ff'
    }]
  };

  try {
    const res = await fetch('/api/chamados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chamado)
    });
    if (!res.ok) throw new Error('falha ao enviar');

    $('form-area').style.display = 'none';
    $('sucesso-area').style.display = 'block';
    $('sucesso-id').textContent = id;
  } catch (e) {
    erro.textContent = 'Não foi possível enviar o chamado. Tente novamente.';
    btn.disabled = false;
    btn.textContent = 'Enviar Chamado';
  }
}

$('qr-enviar').addEventListener('click', enviarChamado);

$('btn-novo-chamado').addEventListener('click', () => {
  $('qr-cat').value = '';
  $('qr-prio').value = 'Média';
  $('qr-desc').value = '';
  $('qr-nome').value = '';
  fotos = [];
  renderFotos();
  $('qr-erro').textContent = '';
  const btn = $('qr-enviar');
  btn.disabled = false;
  btn.textContent = 'Enviar Chamado';
  $('sucesso-area').style.display = 'none';
  $('form-area').style.display = 'block';
});

(function init() {
  const slug = pegarArea();
  $('area-nome').textContent = slug ? slugParaNome(slug) : 'Área não identificada';
})();