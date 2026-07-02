'use strict';

const $ = id => document.getElementById(id);

let fotos = [];

const MAX_KB = 2048;

async function comprimirImagem(file) {
  return new Promise(resolve => {
    if (file.size / 1024 > MAX_KB * 1.5) {
      $('qr-foto-aviso').textContent = `"${file.name}" era grande e foi comprimida automaticamente.`;
      setTimeout(() => { if($('qr-foto-aviso')) $('qr-foto-aviso').textContent = ''; }, 4000);
    }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const maxDim = 1600;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let quality = 0.88;
        const tryCompress = () => {
          const data = canvas.toDataURL('image/jpeg', quality);
          const kb = Math.round(data.length * 3 / 4 / 1024);
          if (kb > MAX_KB && quality > 0.3) { quality -= 0.1; tryCompress(); }
          else resolve(data);
        };
        tryCompress();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

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

$('qr-add-camera').addEventListener('click', () => $('qr-foto-input-camera').click());
$('qr-add-galeria').addEventListener('click', () => $('qr-foto-input-galeria').click());

async function processarArquivos(arquivos) {
  for (const arq of arquivos) {
    const data = await comprimirImagem(arq);
    fotos.push(data);
  }
  renderFotos();
}

$('qr-foto-input-camera').addEventListener('change', e => {
  const arquivos = Array.from(e.target.files);
  if (arquivos.length) processarArquivos(arquivos);
  e.target.value = '';
});

$('qr-foto-input-galeria').addEventListener('change', e => {
  const arquivos = Array.from(e.target.files);
  if (arquivos.length) processarArquivos(arquivos);
  e.target.value = '';
});

async function enviarChamado() {
  const cat = $('qr-cat').value;
  const prio = $('qr-prio').value;
  const desc = $('qr-desc').value.trim();
  const nome = $('qr-nome').value.trim();
  const erro = $('qr-erro');
  erro.textContent = '';

  if (!cat || !desc || !nome) {
    erro.textContent = 'Preencha a categoria, a descrição e o seu e-mail.';
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
    $('link-meus-chamados').href = `/meus-chamados?email=${encodeURIComponent(nome)}`;
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
  $('qr-foto-aviso').textContent = '';
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