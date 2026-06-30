'use strict';

let areasQR = [];

async function carregarAreasQR() {
  try {
    const res = await fetch('/api/chamados/areas-qr');
    areasQR = await res.json();
    renderAreasQR();
  } catch {
    $('qr-areas-lista').innerHTML = '<div class="qr-erro">Erro ao carregar áreas.</div>';
  }
}

function slugificar(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

function renderAreasQR() {
  const container = $('qr-areas-lista');
  if (!areasQR.length) {
    container.innerHTML = '<div class="qr-vazio">Nenhuma área cadastrada ainda.</div>';
    return;
  }
  const base = window.location.origin;
  container.innerHTML = areasQR.map(a => `
    <div class="qr-card">
      <div class="qr-canvas-wrap" id="qr-cv-${a.id}"></div>
      <div class="qr-info">
        <div class="qr-nome">${a.nome}</div>
        <div class="qr-link">${base}/qr/${a.slug}</div>
      </div>
      <div class="qr-acoes">
        <button class="btn btn-ghost" data-baixar="${a.id}">Baixar PNG</button>
        <button class="btn btn-danger" data-excluir="${a.id}">Excluir</button>
      </div>
    </div>
  `).join('');

  areasQR.forEach(a => {
    const url = `${base}/qr/${a.slug}`;
    new QRCode(document.getElementById(`qr-cv-${a.id}`), {
      text: url,
      width: 140,
      height: 140,
      colorDark: '#0f1c3f',
      colorLight: '#ffffff'
    });
  });

  container.querySelectorAll('[data-baixar]').forEach(btn => {
    btn.addEventListener('click', () => baixarQR(btn.dataset.baixar));
  });
  container.querySelectorAll('[data-excluir]').forEach(btn => {
    btn.addEventListener('click', () => excluirAreaQR(btn.dataset.excluir));
  });
}

function baixarQR(areaId) {
  const wrap = document.getElementById(`qr-cv-${areaId}`);
  const img = wrap.querySelector('img');
  const canvas = wrap.querySelector('canvas');
  const area = areasQR.find(a => a.id === areaId);
  const link = document.createElement('a');
  link.download = `qrcode-${area.slug}.png`;
  link.href = img ? img.src : canvas.toDataURL('image/png');
  link.click();
}

async function adicionarAreaQR() {
  const input = $('qr-area-nome');
  const nome = input.value.trim();
  if (!nome) return;
  const slug = slugificar(nome);
  const id = 'area-' + Date.now();

  try {
    await fetch('/api/chamados/areas-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nome, slug })
    });
    input.value = '';
    await carregarAreasQR();
    showToast('Área cadastrada!');
  } catch {
    showToast('Erro ao cadastrar área.', 'err');
  }
}

async function excluirAreaQR(id) {
  if (!confirm('Excluir esta área e seu QR Code?')) return;
  try {
    await fetch(`/api/chamados/areas-qr/${id}`, { method: 'DELETE' });
    await carregarAreasQR();
    showToast('Área excluída.');
  } catch {
    showToast('Erro ao excluir área.', 'err');
  }
}

$('btn-add-area')?.addEventListener('click', adicionarAreaQR);
$('qr-area-nome')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') adicionarAreaQR();
});