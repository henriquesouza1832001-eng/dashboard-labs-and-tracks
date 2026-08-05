const $ = id => document.getElementById(id);
const CATS = {
  INF: { label: 'Infraestrutura', color: '#58a6ff' },
  ELE: { label: 'Elétrica',       color: '#d29922' },
  HID: { label: 'Hidráulica',     color: '#3fb950' },
  LMP: { label: 'Limpeza',        color: '#bc8cff' },
  AR:  { label: 'Ar Cond.',       color: '#39c5cf' },
};
let allChamados = [];
let areasQR = [];
let _slaCache = {};

function slaParaPrio(prio) {
  const pad = { 'Crítica':1,'Alta':3,'Média':5,'Baixa':7 };
  return _slaCache[prio] || pad[prio] || 7;
}
function diasAberto(c) {
  const inicio = new Date(c.dataAbertura);
  const fim = c.dataConclusao ? new Date(c.dataConclusao) : new Date();
  return Math.max(0, (fim - inicio) / 86400000);
}
function fmtDateShort(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function statusClass(s) {
  return { 'Aberto':'s-aberto','Em Andamento':'s-andamento','Concluído':'s-concluido','Cancelado':'s-cancelado','Fechado':'s-fechado' }[s] || '';
}
function prioClass(p) {
  return { 'Baixa':'p-baixa','Média':'p-media','Alta':'p-alta','Crítica':'p-critica' }[p] || '';
}
function gerarId(cat) {
  const ano = new Date().getFullYear();
  const ts = Date.now().toString().slice(-6);
  return `${cat}-${ano}-${ts}`;
}
function showToast(msg, type='ok') {
  alert(msg);
}
function renderFotosGrid(gridId, arr, addBtnId) {
  const grid = $(gridId);
  const addBtn = $(addBtnId);
  grid.innerHTML = '';
  arr.forEach((b64, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'foto-thumb';
    thumb.innerHTML = `<img src="${b64}" style="width:64px;height:64px;object-fit:cover;border-radius:6px">`;
    grid.appendChild(thumb);
  });
  grid.appendChild(addBtn);
}
function lerImagens(input, arr, gridId, addBtnId) {
  Array.from(input.files).forEach(f => {
    const reader = new FileReader();
    reader.onload = e => { arr.push(e.target.result); renderFotosGrid(gridId, arr, addBtnId); };
    reader.readAsDataURL(f);
  });
  input.value = '';
}
function abrirModalVer(id) {
  alert('Abra o sistema principal para ver detalhes do chamado ' + id);
}

async function carregarDados() {
  try {
    const [dc, da, ds] = await Promise.all([
      fetch('/api/chamados').then(r => r.json()),
      fetch('/api/chamados/areas-qr').then(r => r.json()),
      fetch('/api/chamados/sla').then(r => r.json()),
    ]);
    allChamados = dc.chamados || [];
    areasQR = Array.isArray(da) ? da : [];
    _slaCache = ds || {};
  } catch(e) {
    console.error('Erro ao carregar dados:', e);
  }
  initMeusChamados();
}

const emailInicial = (window.__DADOS__ || {}).email_usuario || '';
if (emailInicial) {
  document.addEventListener('DOMContentLoaded', () => {
    const inp = $('mc-nome');
    if (inp) inp.value = emailInicial;
  });
}

carregarDados();
const MC_STORAGE_KEY = 'mc-solicitante';
let mcSolicitante = localStorage.getItem(MC_STORAGE_KEY) || '';
let mcSubAba = 'historico';

// ─── Inicialização ────────────────────────────────────
function initMeusChamados() {
  const inputNome = $('mc-nome');
  if (inputNome) {
    inputNome.value = mcSolicitante;
    inputNome.addEventListener('input', () => {
      mcSolicitante = inputNome.value.trim();
      localStorage.setItem(MC_STORAGE_KEY, mcSolicitante);
      if (mcSubAba === 'historico') renderMeusHistorico();
    });
  }
  ['historico', 'qr', 'area'].forEach(aba => {
    const btn = $('mc-tab-' + aba);
    if (btn) btn.addEventListener('click', () => setMcTab(aba));
  });
  const btnAbrirArea = $('mc-area-abrir');
  if (btnAbrirArea) btnAbrirArea.addEventListener('click', mcAbrirChamadoPorArea);
  const selectArea = $('mc-area-select');
  if (selectArea) selectArea.addEventListener('change', mcOnAreaChange);
  const addFoto = $('mc-add-foto');
  const fileInput = $('mc-file-input');
  if (addFoto && fileInput) {
    addFoto.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      lerImagens(e.target, mcNovasFotos, 'mc-fotos-grid', 'mc-add-foto', false);
    });
  }

  setMcTab('historico');
}

// ─── Troca de sub-aba ────────────────────────────────
function setMcTab(aba) {
  mcSubAba = aba;
  ['historico', 'qr', 'area'].forEach(t => {
    const btn = $('mc-tab-' + t);
    const view = $('mc-view-' + t);
    if (btn)  btn.classList.toggle('active', t === aba);
    if (view) view.style.display = t === aba ? '' : 'none';
  });
  if (aba === 'historico') renderMeusHistorico();
  if (aba === 'qr')        renderMcQR();
  if (aba === 'area')      renderMcAreaForm();
}

// ─── SUB-ABA 1 : Histórico ───────────────────────────
function renderMeusHistorico() {
  const container = $('mc-historico-lista');
  if (!container) return;

  const nome = ($('mc-nome')?.value || mcSolicitante).trim().toLowerCase();

  if (!nome) {
    container.innerHTML = `
      <div class="mc-empty">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        <p>Digite seu nome acima para ver seus chamados.</p>
      </div>`;
    return;
  }

  const meus = allChamados.filter(c =>
    (c.solicitante || '').toLowerCase().includes(nome)
  );

  if (!meus.length) {
    container.innerHTML = `
      <div class="mc-empty">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Nenhum chamado encontrado para "<strong>${nome}</strong>".</p>
      </div>`;
    return;
  }
  const ordemStatus = { 'Aberto': 0, 'Em Andamento': 1, 'Cancelado': 2, 'Concluído': 3, 'Fechado': 4 };
  const sorted = [...meus].sort((a, b) => {
    const d = (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9);
    return d !== 0 ? d : new Date(b.dataAbertura) - new Date(a.dataAbertura);
  });

  container.innerHTML = sorted.map(c => {
    const cat = CATS[c.categoria] || { label: c.categoria };
    const dias = Math.floor(diasAberto(c));
    const slaMax = slaParaPrio(c.prioridade);
    const pctSLA = Math.round(dias / slaMax * 100);
    let slaTxt = '—', slaCls = 'sla-ok';
    if (!['Concluído', 'Cancelado', 'Fechado'].includes(c.status)) {
      slaTxt = `${dias}d`;
      slaCls = pctSLA >= 100 ? 'sla-out' : pctSLA >= 70 ? 'sla-warn' : 'sla-ok';
      if (pctSLA >= 100) slaTxt += ' ⚠';
    }
    const ultimaObs = c.historico?.length
      ? c.historico[c.historico.length - 1].obs || c.historico[c.historico.length - 1].acao
      : '–';

    return `
      <div class="mc-card" data-id="${c.id}">
        <div class="mc-card-header">
          <span class="id-badge">${c.id}</span>
          <span class="status-badge ${statusClass(c.status)}"><span class="dot"></span>${c.status}</span>
          <span class="prio-badge ${prioClass(c.prioridade)}" style="margin-left:auto">${c.prioridade}</span>
        </div>
        <div class="mc-card-titulo">${c.titulo || '–'}</div>
        <div class="mc-card-meta">
          <span><span class="cat-dot c-${c.categoria}"></span>${cat.label}</span>
          <span>📍 ${c.local || '–'}</span>
          <span>📅 ${fmtDateShort(c.dataAbertura)}</span>
          <span class="${slaCls}">⏱ SLA: ${slaTxt}</span>
        </div>
        ${c.responsavel ? `<div class="mc-card-resp">👤 Responsável: <strong>${c.responsavel}</strong></div>` : ''}
        <div class="mc-card-obs">${ultimaObs}</div>
        <button class="mc-card-btn" data-id="${c.id}">Ver detalhes</button>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-id]').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', () => abrirModalVer(id));
  });
}

// ─── SUB-ABA 2 : QR Code ─────────────────────────────
function renderMcQR() {
  const container = $('mc-qr-lista');
  if (!container) return;

  if (!areasQR || !areasQR.length) {
    container.innerHTML = `
      <div class="mc-empty">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        <p>Nenhuma área cadastrada. Peça ao administrador para cadastrar áreas no módulo QR Codes.</p>
      </div>`;
    return;
  }

  const base = window.location.origin;
  container.innerHTML = `
    <p class="mc-instrucao">
      Aponte a câmera do celular para o QR Code da área onde está o problema — o formulário abrirá automaticamente com o local já preenchido.
    </p>
    <div class="mc-qr-grid">
      ${areasQR.map(a => `
        <div class="mc-qr-item">
          <div class="mc-qr-canvas" id="mc-qr-cv-${a.id}"></div>
          <div class="mc-qr-nome">${a.nome}</div>
          <a class="mc-qr-link" href="${base}/qr/${a.slug}" target="_blank">Abrir formulário</a>
        </div>
      `).join('')}
    </div>`;

  areasQR.forEach(a => {
    const el = document.getElementById(`mc-qr-cv-${a.id}`);
    if (!el || el.children.length) return;
    new QRCode(el, {
      text: `${base}/qr/${a.slug}`,
      width: 120,
      height: 120,
      colorDark: '#0f1c3f',
      colorLight: '#ffffff'
    });
  });
}

// ─── SUB-ABA 3 : Abrir chamado por área ──────────────
let mcNovasFotos = [];

function renderMcAreaForm() {
  const select = $('mc-area-select');
  if (!select) return;
  select.innerHTML = '<option value="">Selecionar área…</option>';
  if (areasQR && areasQR.length) {
    areasQR.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.nome;
      select.appendChild(opt);
    });
  }
  mcNovasFotos = [];
  ['mc-form-titulo', 'mc-form-desc', 'mc-form-local-info'].forEach(id => {
    const el = $(id);
    if (el) el.value !== undefined ? el.value = '' : el.textContent = '';
  });
  const cat = $('mc-form-cat');
  if (cat) cat.value = '';
  const prio = $('mc-form-prio');
  if (prio) prio.value = 'Média';
  renderFotosGrid('mc-fotos-grid', mcNovasFotos, 'mc-add-foto', false);
}

function mcOnAreaChange() {
  const select = $('mc-area-select');
  const infoEl = $('mc-form-local-info');
  const area = areasQR?.find(a => a.id === select.value);
  if (infoEl) infoEl.textContent = area ? `📍 ${area.nome}` : '';
}

async function mcAbrirChamadoPorArea() {
  const areaId = $('mc-area-select')?.value;
  const area = areasQR?.find(a => a.id === areaId);
  const titulo = $('mc-form-titulo')?.value.trim();
  const cat = $('mc-form-cat')?.value;
  const prio = $('mc-form-prio')?.value || 'Média';
  const desc = $('mc-form-desc')?.value.trim();
  const solicitante = $('mc-nome')?.value.trim() || mcSolicitante;

  if (!area) { showToast('Selecione uma área.', 'err'); return; }
  if (!titulo) { showToast('Informe o título do chamado.', 'err'); return; }
  if (!cat) { showToast('Selecione a categoria.', 'err'); return; }
  if (!desc) { showToast('Descreva o problema.', 'err'); return; }

  const id = gerarId(cat);
  const novo = {
    id,
    titulo,
    categoria: cat,
    tipo: '',
    prioridade: prio,
    local: area.nome,
    setor: '',
    solicitante,
    dataDesejada: '',
    descricao: desc,
    status: 'Aberto',
    responsavel: '',
    idExterno: '',
    dataAbertura: new Date().toISOString(),
    dataConclusao: null,
    fotos: [...mcNovasFotos],
    historico: [{
      data: new Date().toISOString(),
      acao: 'Chamado aberto via área cadastrada',
      obs: desc,
      cor: '#58a6ff'
    }]
  };

  await API.chamados.criar(novo);
  API.invalidar('/chamados');
  const dados = await API.chamados.listar();
  allChamados = dados.chamados || [];
  atualizarContadores();
  aplicarFiltros();

  showToast(`Chamado ${id} registrado com sucesso!`);
  renderMcAreaForm();
  setMcTab('historico');
}