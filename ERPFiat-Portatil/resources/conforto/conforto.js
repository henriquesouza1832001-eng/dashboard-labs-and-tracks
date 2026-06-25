'use strict';

window.onerror = (msg, src, line, col, err) => {
  const bar = document.getElementById('debug-bar');
  if (bar) { bar.style.display = 'block'; bar.textContent = `[ERRO] ${msg} (${src}:${line}:${col})`; }
  return false;
};
const $ = id => document.getElementById(id);
function fmt(v) { return v || '—'; }
function fmtR(v) { return v != null && v !== '' ? 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; }
function fmtD(d) { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; }
function hoje() { return new Date().toISOString().slice(0, 10); }


const NEU_NAME_KEY = 'neu-name-conforto';
let confortoHandle = null, saveTimeout = null;

// ── ESTADO ──
let state = {
  ordens: [],
  ucs: [],
  preventivas: [],
  manutencoes: [],
  pecas: [],
  requisicoes: [],
  areas: [],
  fornecedores: [],
  tecnicos: [],
  config: {
    checklistPreventiva: [
      'Verificar pressão do gás',
      'Limpar filtro de ar',
      'Verificar dreno',
      'Checar corrente elétrica',
      'Verificar ruídos anormais',
      'Limpar condensadora',
      'Verificar termostato',
      'Testar funcionamento geral'
    ],
    cicloFiltroDias: 90,
    alertaPreventivaDias: 7,
    alertaLimpezaDias: 2,
    alertaManutencaoDias: 3,
    frequencias: {
      escritorio: 'Diário',
      banheiro: 'Diário',
      refeitorio: 'Diário',
      areaTecnica: 'Semanal',
      corredor: 'Semanal',
      almoxarifado: 'Quinzenal'
    }
  },
  editIdx: {
    os: -1, uc: -1, preventiva: -1, manutencao: -1,
    peca: -1, requisicao: -1, area: -1, fornecedor: -1, tecnico: -1
  },
  abaTipoOS: 'civil',
  agendaCivilData: hoje(),
  agendaTecData: hoje(),
  rotinas: [],
  editIdx_rotina: -1
};

// ── SAVE STATUS ──
function setSaveStatus(s, txt) {
  const el = $('save-status');
  if (!el) return;
  el.className = 'save-status ' + s;
  const t = $('save-txt');
  if (t) t.textContent = txt;
}

// ── MODAL ──
function abrirModal(id) { const el = $(id); if (el) el.classList.add('open'); }
function fecharModal(id) { const el = $(id); if (el) el.classList.remove('open'); }

// ── PERSISTÊNCIA ──
function toJSON() {
  return {
    versao: '1.0', modulo: 'conforto',
    ordens: state.ordens, ucs: state.ucs,
    preventivas: state.preventivas, manutencoes: state.manutencoes,
    pecas: state.pecas, requisicoes: state.requisicoes,
    areas: state.areas, fornecedores: state.fornecedores,
    tecnicos: state.tecnicos, config: state.config,
    rotinas: state.rotinas
  };
}

function carregarDeJSON(txt) {
  try {
    const d = JSON.parse(txt);
    if (!d || d.modulo !== 'conforto') return false;
    state.ordens = Array.isArray(d.ordens) ? d.ordens : [];
    state.ucs = Array.isArray(d.ucs) ? d.ucs : [];
    state.preventivas = Array.isArray(d.preventivas) ? d.preventivas : [];
    state.manutencoes = Array.isArray(d.manutencoes) ? d.manutencoes : [];
    state.pecas = Array.isArray(d.pecas) ? d.pecas : [];
    state.requisicoes = Array.isArray(d.requisicoes) ? d.requisicoes : [];
    state.areas = Array.isArray(d.areas) ? d.areas : [];
    state.fornecedores = Array.isArray(d.fornecedores) ? d.fornecedores : [];
    state.tecnicos = Array.isArray(d.tecnicos) ? d.tecnicos : [];
    state.rotinas  = Array.isArray(d.rotinas)  ? d.rotinas  : [];
    if (d.config) {
      state.config = Object.assign({}, state.config, d.config);
      if (!Array.isArray(state.config.checklistPreventiva)) state.config.checklistPreventiva = [];
      state.config.cicloFiltroDias = state.config.cicloFiltroDias || 90;
      state.config.alertaPreventivaDias = state.config.alertaPreventivaDias || 7;
      state.config.alertaLimpezaDias = state.config.alertaLimpezaDias || 2;
      state.config.alertaManutencaoDias = state.config.alertaManutencaoDias || 3;
      if (!state.config.frequencias) state.config.frequencias = {};
    }
    return true;
  } catch (e) { return false; }
}

async function salvarDados(){
  await API.conforto.salvar(toJSON());
  setSaveStatus('saved','salvo');
}

function agendarSalvamento() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(salvarDados, 400);
}

// ── IDs AUTOMÁTICOS ──
function gerarId(prefix, arr, campo) {
  let n = arr.length + 1;
  while (arr.find(x => x[campo] === `${prefix}-${String(n).padStart(3, '0')}`)) n++;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

// ── BADGES ──
function badgeStatusOS(s) {
  const map = { 'Programada': 'badge-blue', 'Em Execução': 'badge-orange', 'Concluída': 'badge-green', 'Cancelada': 'badge-red' };
  return `<span class="badge ${map[s] || 'badge-muted'}">${s}</span>`;
}

function badgeStatusUC(ucId) {
  const hoje_d = hoje();
  const prevs = state.preventivas.filter(p => p.ucId === ucId && p.status !== 'Realizada');
  const atrasadas = prevs.filter(p => p.dataPrevista && p.dataPrevista < hoje_d);
  if (atrasadas.length > 0) return '<span class="badge badge-red">ATRASADA</span>';
  const alertaDias = state.config.alertaPreventivaDias || 7;
  const limite = new Date(); limite.setDate(limite.getDate() + alertaDias);
  const limiteStr = limite.toISOString().slice(0, 10);
  const proximas = prevs.filter(p => p.dataPrevista && p.dataPrevista <= limiteStr);
  if (proximas.length > 0) return '<span class="badge badge-yellow">ATENÇÃO</span>';
  return '<span class="badge badge-green">OK</span>';
}

function badgeStatusPrev(s) {
  const map = { 'Programada': 'badge-blue', 'Realizada': 'badge-green', 'Atrasada': 'badge-red' };
  return `<span class="badge ${map[s] || 'badge-muted'}">${s}</span>`;
}

function badgeStatusMan(s) {
  const map = { 'Aberta': 'badge-red', 'Em Andamento': 'badge-orange', 'Concluída': 'badge-green', 'Aguardando Peça': 'badge-yellow' };
  return `<span class="badge ${map[s] || 'badge-muted'}">${s}</span>`;
}

function badgeEstoque(atual, minimo) {
  if (atual <= 0) return '<span class="badge badge-red">ZERADO</span>';
  if (atual < minimo) return '<span class="badge badge-yellow">BAIXO</span>';
  return '<span class="badge badge-green">OK</span>';
}

// ── SVGS ──
const SVG_EDIT = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const SVG_TRASH = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

// ── POPULAR SELECTS ──
function popularSelects() {
  // os-area
  const osArea = $('os-area');
  if (osArea) {
    const val = osArea.value;
    osArea.innerHTML = '<option value="">— Selecione —</option>' +
      state.areas.map(a => `<option value="${a.id}" ${val === a.id ? 'selected' : ''}>${a.nome}</option>`).join('');
  }
  // os-resp
  const osResp = $('os-resp');
  if (osResp) {
    const val = osResp.value;
    osResp.innerHTML = '<option value="">— Selecione —</option>' +
      state.tecnicos.map(t => `<option value="${t.id}" ${val === t.id ? 'selected' : ''}>${t.nome}</option>`).join('');
  }
  // prev-uc
  const prevUc = $('prev-uc');
  if (prevUc) {
    const val = prevUc.value;
    prevUc.innerHTML = '<option value="">— Selecione —</option>' +
      state.ucs.map(u => `<option value="${u.id}" ${val === u.id ? 'selected' : ''}>${u.codigo} — ${u.nome}</option>`).join('');
  }
  // prev-tec
  const prevTec = $('prev-tec');
  if (prevTec) {
    const val = prevTec.value;
    prevTec.innerHTML = '<option value="">— Selecione —</option>' +
      state.tecnicos.map(t => `<option value="${t.id}" ${val === t.id ? 'selected' : ''}>${t.nome}</option>`).join('');
  }
  // man-uc
  const manUc = $('man-uc');
  if (manUc) {
    const val = manUc.value;
    manUc.innerHTML = '<option value="">— Selecione —</option>' +
      state.ucs.map(u => `<option value="${u.id}" ${val === u.id ? 'selected' : ''}>${u.codigo} — ${u.nome}</option>`).join('');
  }
  // man-tec
  const manTec = $('man-tec');
  if (manTec) {
    const val = manTec.value;
    manTec.innerHTML = '<option value="">— Selecione —</option>' +
      state.tecnicos.map(t => `<option value="${t.id}" ${val === t.id ? 'selected' : ''}>${t.nome}</option>`).join('');
  }
  // req-peca
  const reqPeca = $('req-peca');
  if (reqPeca) {
    const val = reqPeca.value;
    reqPeca.innerHTML = '<option value="">— Selecione —</option>' +
      state.pecas.map(p => `<option value="${p.id}" ${val === p.id ? 'selected' : ''}>${p.codigo} — ${p.descricao}</option>`).join('');
  }
  // req-sol
  const reqSol = $('req-sol');
  if (reqSol) {
    const val = reqSol.value;
    reqSol.innerHTML = '<option value="">— Selecione —</option>' +
      state.tecnicos.map(t => `<option value="${t.id}" ${val === t.id ? 'selected' : ''}>${t.nome}</option>`).join('');
  }
  // area-resp (modal-area)
  const areaResp = $('area-resp');
  if (areaResp) {
    const val = areaResp.value;
    areaResp.innerHTML = '<option value="">— Selecione —</option>' +
      state.tecnicos.map(t => `<option value="${t.id}" ${val === t.id ? 'selected' : ''}>${t.nome}</option>`).join('');
  }
  // uc-resp (modal-uc)
  const ucResp = $('uc-resp');
  if (ucResp) {
    const val = ucResp.value;
    ucResp.innerHTML = '<option value="">— Selecione —</option>' +
      state.tecnicos.map(t => `<option value="${t.id}" ${val === t.id ? 'selected' : ''}>${t.nome}</option>`).join('');
  }

  // filtro-area dos panes
  ['civil-filtro-area', 'tec-filtro-area'].forEach(id => {
    const el = $(id);
    if (!el) return;
    const val = el.value;
    el.innerHTML = '<option value="">Todas as Áreas</option>' +
      state.areas.map(a => `<option value="${a.id}" ${val === a.id ? 'selected' : ''}>${a.nome}</option>`).join('');
  });
}

// ── RENDER HELPERS ──
function nomeTec(id) { const t = state.tecnicos.find(x => x.id === id); return t ? t.nome : id || '—'; }
function nomeArea(id) { const a = state.areas.find(x => x.id === id); return a ? a.nome : id || '—'; }
function nomeUC(id) { const u = state.ucs.find(x => x.id === id); return u ? `${u.codigo} — ${u.nome}` : id || '—'; }
function nomePeca(id) { const p = state.pecas.find(x => x.id === id); return p ? `${p.codigo} — ${p.descricao}` : id || '—'; }

function proximaPreventiva(ucId) {
  const hoje_d = hoje();
  const prevs = state.preventivas
    .filter(p => p.ucId === ucId && p.status !== 'Realizada' && p.dataPrevista >= hoje_d)
    .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista));
  return prevs.length ? fmtD(prevs[0].dataPrevista) : '—';
}

// ── RENDER DASHBOARD ──
function renderDashboard() {
  const hoje_d = hoje();
  const mes = hoje_d.slice(0, 7);

  const osCivil = state.ordens.filter(o => o.tipo === 'civil' && (o.status === 'Programada' || o.status === 'Em Execução'));
  const osTec = state.ordens.filter(o => o.tipo === 'tecnica' && (o.status === 'Programada' || o.status === 'Em Execução'));

  const alertaDias = state.config.alertaPreventivaDias || 7;
  const limite = new Date(); limite.setDate(limite.getDate() + alertaDias);
  const limiteStr = limite.toISOString().slice(0, 10);

  const prevProximas = state.preventivas.filter(p => p.status !== 'Realizada' && p.dataPrevista && p.dataPrevista <= limiteStr && p.dataPrevista >= hoje_d);
  const prevAtrasadas = state.preventivas.filter(p => p.status !== 'Realizada' && p.dataPrevista && p.dataPrevista < hoje_d);
  const manAbertas = state.manutencoes.filter(m => m.status !== 'Concluída');
  const pecasBaixas = state.pecas.filter(p => p.estqAtual < p.estqMinimo);
  const totalOS = state.ordens.filter(o => o.dataPrevista && o.dataPrevista.startsWith(mes));
  const osConc = totalOS.filter(o => o.status === 'Concluída');
  const pctConc = totalOS.length ? Math.round(osConc.length / totalOS.length * 100) : 0;

  const kpis = [
    { label: 'OS Civil Abertas', val: osCivil.length, cls: 'orange', sub: 'programadas + em execução' },
    { label: 'OS Técnica Abertas', val: osTec.length, cls: 'orange', sub: 'programadas + em execução' },
    { label: 'Preventivas (7 dias)', val: prevProximas.length, cls: 'yellow', sub: 'próximas no período' },
    { label: 'Prev. Atrasadas', val: prevAtrasadas.length, cls: 'red', sub: 'vencidas sem realização' },
    { label: 'Manutenções Abertas', val: manAbertas.length, cls: 'orange', sub: 'corretivas em aberto' },
    { label: 'Peças Abaixo Mín.', val: pecasBaixas.length, cls: 'red', sub: 'requer reposição' },
    { label: 'Total de UCs', val: state.ucs.length, cls: 'blue', sub: 'unidades cadastradas' },
    { label: '% OS Concluídas', val: pctConc + '%', cls: 'green', sub: 'no mês corrente' }
  ];

  const grid = $('kpi-grid-dash');
  if (grid) {
    grid.innerHTML = kpis.map(k => `
      <div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val ${k.cls}">${k.val}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`).join('');
  }

  // tabela civil resumo
  const dashCivil = $('dash-civil-tbody');
  if (dashCivil) {
    const rows = state.ordens.filter(o => o.tipo === 'civil').slice(0, 8);
    dashCivil.innerHTML = rows.length
      ? rows.map(o => `<tr>
          <td>${fmt(nomeArea(o.areaId))}</td>
          <td><span class="freq-tag">Civil</span></td>
          <td>${nomeArea(o.areaId) ? (state.areas.find(a => a.id === o.areaId)?.freqCivil || '—') : '—'}</td>
          <td>${fmtD(o.dataPrevista)}</td>
          <td>${fmtD(o.dataRealizada)}</td>
          <td>${badgeStatusOS(o.status)}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">Nenhuma OS civil registrada</td></tr>';
  }

  // tabela tecnica resumo
  const dashTec = $('dash-tec-tbody');
  if (dashTec) {
    const rows = state.ordens.filter(o => o.tipo === 'tecnica').slice(0, 8);
    dashTec.innerHTML = rows.length
      ? rows.map(o => `<tr>
          <td>${fmt(nomeArea(o.areaId))}</td>
          <td><span class="freq-tag">Técnica</span></td>
          <td>${state.areas.find(a => a.id === o.areaId)?.freqTecnica || '—'}</td>
          <td>${fmtD(o.dataPrevista)}</td>
          <td>${fmtD(o.dataRealizada)}</td>
          <td>${badgeStatusOS(o.status)}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">Nenhuma OS técnica registrada</td></tr>';
  }

  // tabela AC resumo
  const dashAC = $('dash-ac-tbody');
  if (dashAC) {
    const rows = state.ucs.slice(0, 8);
    dashAC.innerHTML = rows.length
      ? rows.map(u => `<tr>
          <td><span class="badge badge-blue">${u.codigo}</span></td>
          <td>${fmt(u.local)}</td>
          <td>${fmt(u.modelo)}</td>
          <td>${proximaPreventiva(u.id)}</td>
          <td>${state.manutencoes.filter(m => m.ucId === u.id && m.status !== 'Concluída').length}</td>
          <td>${badgeStatusUC(u.id)}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">Nenhuma UC cadastrada</td></tr>';
  }
}

// ── RENDER ORDENS ──
function renderOrdens(tipo) {
  const prefix = tipo === 'civil' ? 'civil' : 'tec';
  const tbodyId = tipo === 'civil' ? 'civil-os-tbody' : 'tec-os-tbody';
  const tbody = $(tbodyId);
  if (!tbody) return;

  const search = ($(prefix + '-search')?.value || '').toLowerCase();
  const filtroStatus = $(prefix + '-filtro-status')?.value || '';
  const filtroArea = $(prefix + '-filtro-area')?.value || '';

  let rows = state.ordens.filter(o => o.tipo === tipo);
  if (filtroStatus) rows = rows.filter(o => o.status === filtroStatus);
  if (filtroArea) rows = rows.filter(o => o.areaId === filtroArea);
  if (search) rows = rows.filter(o =>
    (o.id || '').toLowerCase().includes(search) ||
    nomeArea(o.areaId).toLowerCase().includes(search) ||
    nomeTec(o.responsavelId).toLowerCase().includes(search) ||
    (o.obs || '').toLowerCase().includes(search)
  );

  const allIdx = (o) => state.ordens.indexOf(o);

  tbody.innerHTML = rows.length
    ? rows.map(o => {
        const idx = allIdx(o);
        return `<tr>
          <td><span class="badge badge-muted">${o.id}</span></td>
          <td>${nomeArea(o.areaId)}</td>
          <td>${nomeTec(o.responsavelId)}</td>
          <td>${fmtD(o.dataPrevista)}</td>
          <td>${fmtD(o.dataRealizada)}</td>
          <td>${badgeStatusOS(o.status)}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fmt(o.obs)}</td>
          <td><div class="row-actions">
            <button class="action-btn" onclick="editarOS(${idx})" title="Editar">${SVG_EDIT}</button>
            <button class="action-btn danger" onclick="excluirOS(${idx})" title="Excluir">${SVG_TRASH}</button>
          </div></td>
        </tr>`;
      }).join('')
    : '<tr class="empty-row"><td colspan="8">Nenhuma OS encontrada</td></tr>';
}

// ── RENDER AC ──
function renderAC() {
  renderUCGrid();
  renderPreventivas();
  renderManutencoes();
}

function renderUCGrid() {
  const grid = $('uc-grid');
  if (!grid) return;
  const catAtiva = document.querySelector('.uc-filtro-cat.active')?.dataset.cat || '';
  const lista = catAtiva ? state.ucs.filter(u => (u.categoria || 'Ar-Condicionado') === catAtiva) : state.ucs;
  grid.innerHTML = lista.length
    ? lista.map(u => {
        const idxReal = state.ucs.indexOf(u);
        return `<div class="uc-card">
        <div class="uc-card-header">
          <div>
            <div class="uc-cod">${u.codigo}</div>
            <div class="uc-nome">${u.nome}</div>
            <div class="uc-meta">${fmt(u.local)} · ${fmt(u.tipo)}</div>
          </div>
          ${badgeStatusUC(u.id)}
        </div>
        <div class="uc-meta" style="margin-top:8px">Modelo: ${fmt(u.modelo)}</div>
        <div class="uc-meta">Próx. Preventiva: ${proximaPreventiva(u.id)}</div>
        <div class="uc-meta">Responsável: ${nomeTec(u.responsavelId)}</div>
        <div class="uc-meta" style="margin-top:4px">Categoria: <span class="freq-tag">${u.categoria || 'Ar-Condicionado'}</span></div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button class="btn btn-secondary btn-sm" onclick="editarUC(${idxReal})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="excluirUC(${idxReal})">Excluir</button>
        </div>
      </div>`}).join('')
    : '<div style="color:var(--text-muted);font-family:var(--mono);font-size:12px;padding:32px">Nenhuma UC cadastrada</div>';
}

function renderPreventivas() {
  const tbody = $('prev-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.preventivas.length
    ? state.preventivas.map((p, idx) => `<tr>
        <td><span class="badge badge-muted">${p.id}</span></td>
        <td>${nomeUC(p.ucId)}</td>
        <td>${nomeTec(p.tecnicoId)}</td>
        <td>${fmtD(p.dataPrevista)}</td>
        <td>${fmtD(p.dataRealizada)}</td>
        <td>${p.checklist ? p.checklist.filter(c => c.concluido).length + '/' + p.checklist.length : '—'}</td>
        <td>${badgeStatusPrev(p.status)}</td>
        <td><div class="row-actions">
          <button class="action-btn" onclick="editarPreventiva(${idx})">${SVG_EDIT}</button>
          <button class="action-btn danger" onclick="excluirPreventiva(${idx})">${SVG_TRASH}</button>
        </div></td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="8">Nenhuma preventiva registrada</td></tr>';
}

function renderManutencoes() {
  const tbody = $('man-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.manutencoes.length
    ? state.manutencoes.map((m, idx) => `<tr>
        <td><span class="badge badge-muted">${m.id}</span></td>
        <td>${nomeUC(m.ucId)}</td>
        <td>${fmt(m.falha)}</td>
        <td>${nomeTec(m.tecnicoId)}</td>
        <td>${fmtD(m.dataAbertura)}</td>
        <td>${fmtD(m.dataFechamento)}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fmt(m.pecasUtilizadas)}</td>
        <td>${badgeStatusMan(m.status)}</td>
        <td><div class="row-actions">
          <button class="action-btn" onclick="editarManutencao(${idx})">${SVG_EDIT}</button>
          <button class="action-btn danger" onclick="excluirManutencao(${idx})">${SVG_TRASH}</button>
        </div></td>
      </tr>`).join('')
    : '<tr class="empty-row"><td colspan="9">Nenhuma manutenção registrada</td></tr>';
}

// ── RENDER CRONOGRAMA ──
function renderCronograma() {
  const mesInput = $('crono-mes');
  const mesSel = mesInput?.value || hoje().slice(0, 7);
  const [ano, mes] = mesSel.split('-').map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();

  function buildCrono(containerId, tipoLabel, ordens) {
    const el = $(containerId);
    if (!el) return;
    if (!ordens.length) {
      el.innerHTML = '<div class="chart-empty">Nenhuma OS para exibir no período</div>';
      return;
    }

    const areas = [...new Set(ordens.map(o => o.areaId))];
    const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);

    const header = `<div class="crono-header">
      <div class="crono-cell-label">${tipoLabel}</div>
      ${dias.map(d => `<div class="crono-cell-day">${d}</div>`).join('')}
    </div>`;

    const rows = areas.map(aId => {
      const nomeA = nomeArea(aId);
      const cells = dias.map(d => {
        const dayStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const os = ordens.find(o => o.areaId === aId && o.dataPrevista === dayStr);
        if (os) {
          const cls = os.tipo === 'civil' ? 'civil' : os.tipo === 'tecnica' ? 'tecnica' : 'ac';
          return `<div class="crono-bar ${cls}" style="width:26px" title="${os.id} — ${os.status}"></div>`;
        }
        return `<div style="width:28px;height:18px"></div>`;
      }).join('');
      return `<div class="crono-row">
        <div class="crono-row-label" title="${nomeA}">${nomeA}</div>
        ${cells}
      </div>`;
    }).join('');

    el.innerHTML = `<div class="crono-grid">${header}${rows}</div>`;
  }

  const ordensCivil = state.ordens.filter(o => o.tipo === 'civil' && o.dataPrevista?.startsWith(mesSel));
  const ordensTec = state.ordens.filter(o => o.tipo === 'tecnica' && o.dataPrevista?.startsWith(mesSel));
  const ordensAC = state.preventivas.filter(p => p.dataPrevista?.startsWith(mesSel)).map(p => ({
    ...p, areaId: p.ucId, tipo: 'ac'
  }));

  buildCrono('crono-civil-full', 'ÁREA / DIA', ordensCivil);
  buildCrono('crono-tec-full', 'ÁREA / DIA', ordensTec);
  buildCrono('crono-ac-full', 'UC / DIA', ordensAC);

  // Consolidado — todos juntos
  const elCons = $('crono-consolidado-full');
  if (elCons) {
    const todos = [...ordensCivil, ...ordensTec, ...ordensAC];
    buildCrono('crono-consolidado-full', 'ÁREA-UC / DIA', todos);
  }
}

// ── RENDER PEÇAS ──
function renderPecas() {
  const tbody = $('pecas-tbody');
  if (tbody) {
    const search = ($('pecas-search')?.value || '').toLowerCase();
    const filtCat = $('pecas-filtro-cat')?.value || '';
    let rows = state.pecas;
    if (filtCat) rows = rows.filter(p => p.categoria === filtCat);
    if (search) rows = rows.filter(p =>
      (p.codigo || '').toLowerCase().includes(search) ||
      (p.descricao || '').toLowerCase().includes(search) ||
      (p.fabricante || '').toLowerCase().includes(search)
    );
    const allIdx = p => state.pecas.indexOf(p);
    tbody.innerHTML = rows.length
      ? rows.map(p => {
          const idx = allIdx(p);
          const rowStyle = p.estqAtual <= 0 ? 'background:#fdf0ef' : p.estqAtual < p.estqMinimo ? 'background:#fdf8e1' : '';
          return `<tr style="${rowStyle}">
            <td><span class="badge badge-muted">${p.codigo}</span></td>
            <td>${fmt(p.descricao)}</td>
            <td>${fmt(p.categoria)}</td>
            <td>${fmt(p.fabricante)}</td>
            <td>${fmt(p.referencia)}</td>
            <td>${fmt(p.unidade)}</td>
            <td>${p.estqAtual ?? '—'}</td>
            <td>${p.estqMinimo ?? '—'}</td>
            <td>${badgeEstoque(p.estqAtual, p.estqMinimo)}</td>
            <td><div class="row-actions">
              <button class="action-btn" onclick="editarPeca(${idx})">${SVG_EDIT}</button>
              <button class="action-btn danger" onclick="excluirPeca(${idx})">${SVG_TRASH}</button>
            </div></td>
          </tr>`;
        }).join('')
      : '<tr class="empty-row"><td colspan="10">Nenhuma peça encontrada</td></tr>';
  }

  const reqTbody = $('req-tbody');
  if (reqTbody) {
    const search = ($('req-search')?.value || '').toLowerCase();
    const filtStatus = $('req-filtro-status')?.value || '';
    let rows = state.requisicoes;
    if (filtStatus) rows = rows.filter(r => r.status === filtStatus);
    if (search) rows = rows.filter(r =>
      nomePeca(r.pecaId).toLowerCase().includes(search) ||
      (r.destino || '').toLowerCase().includes(search)
    );
    const allIdx = r => state.requisicoes.indexOf(r);
    const badgeReq = s => {
      const map = { 'Solicitado': 'badge-blue', 'Em Compra': 'badge-yellow', 'Recebido': 'badge-green', 'Cancelado': 'badge-red' };
      return `<span class="badge ${map[s] || 'badge-muted'}">${s}</span>`;
    };
    reqTbody.innerHTML = rows.length
      ? rows.map(r => {
          const idx = allIdx(r);
          return `<tr>
            <td><span class="badge badge-muted">${r.id}</span></td>
            <td>${nomePeca(r.pecaId)}</td>
            <td>${r.quantidade ?? '—'}</td>
            <td>${fmt(r.destino)}</td>
            <td>${nomeTec(r.solicitanteId)}</td>
            <td>${fmtD(r.dataNecessidade)}</td>
            <td>${badgeReq(r.status)}</td>
            <td><div class="row-actions">
              <button class="action-btn" onclick="editarRequisicao(${idx})">${SVG_EDIT}</button>
              <button class="action-btn danger" onclick="excluirRequisicao(${idx})">${SVG_TRASH}</button>
            </div></td>
          </tr>`;
        }).join('')
      : '<tr class="empty-row"><td colspan="8">Nenhuma requisição encontrada</td></tr>';
  }
}

// ── RENDER CADASTROS ──
function renderCadastros() {
  // Áreas — grid de cards
  const areasGrid = $('areas-grid');
  if (areasGrid) {
    areasGrid.innerHTML = state.areas.length
      ? state.areas.map((a, idx) => `
        <div class="area-card">
          <div class="area-card-header">
            <div>
              <div class="area-card-nome">${a.nome}</div>
              <div class="area-card-meta">${fmt(a.local)} · ${fmt(a.tipo)}</div>
            </div>
            <div class="row-actions">
              <button class="action-btn" onclick="editarArea(${idx})">${SVG_EDIT}</button>
              <button class="action-btn danger" onclick="excluirArea(${idx})">${SVG_TRASH}</button>
            </div>
          </div>
          <div class="area-card-meta" style="margin-top:6px">${a.metragem ? a.metragem + ' m²' : ''}</div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <span class="freq-tag">Civil: ${fmt(a.freqCivil)}</span>
            <span class="freq-tag">Técnica: ${fmt(a.freqTecnica)}</span>
          </div>
          <div class="area-card-meta" style="margin-top:6px">Resp: ${nomeTec(a.responsavelId)}</div>
        </div>`).join('')
      : '<div style="color:var(--text-muted);font-family:var(--mono);font-size:12px;padding:32px">Nenhuma área cadastrada</div>';
  }

  // Fornecedores
  const fornTbody = $('forn-tbody');
  if (fornTbody) {
    fornTbody.innerHTML = state.fornecedores.length
      ? state.fornecedores.map((f, idx) => `<tr>
          <td>${fmt(f.nome)}</td>
          <td>${fmt(f.tipoServico)}</td>
          <td>${fmt(f.contato)}</td>
          <td>${fmt(f.email)}</td>
          <td><span class="badge ${f.ativo === 'Sim' ? 'badge-green' : 'badge-red'}">${f.ativo || '—'}</span></td>
          <td><div class="row-actions">
            <button class="action-btn" onclick="editarFornecedor(${idx})">${SVG_EDIT}</button>
            <button class="action-btn danger" onclick="excluirFornecedor(${idx})">${SVG_TRASH}</button>
          </div></td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">Nenhum fornecedor cadastrado</td></tr>';
  }

  // Técnicos
  const tecTbody = $('tec-tbody');
  if (tecTbody) {
    tecTbody.innerHTML = state.tecnicos.length
      ? state.tecnicos.map((t, idx) => `<tr>
          <td>${fmt(t.nome)}</td>
          <td><span class="badge badge-muted">${fmt(t.matricula)}</span></td>
          <td>${fmt(t.especialidade)}</td>
          <td>${fmt(t.turno)}</td>
          <td><div class="row-actions">
            <button class="action-btn" onclick="editarTecnico(${idx})">${SVG_EDIT}</button>
            <button class="action-btn danger" onclick="excluirTecnico(${idx})">${SVG_TRASH}</button>
          </div></td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="5">Nenhum técnico cadastrado</td></tr>';
  }
}

// ── RENDER CONFIGURAÇÕES ──
function renderConfiguracoes() {
  const c = state.config;
  if ($('cfg-ciclo-filtro')) $('cfg-ciclo-filtro').value = c.cicloFiltroDias;
  const freqList = $('cfg-frequencias-list');
  if (freqList) {
    const labels = { escritorio:'Escritório', banheiro:'Banheiro', refeitorio:'Refeitório', areaTecnica:'Área Técnica', corredor:'Corredor', almoxarifado:'Almoxarifado' };
    const opts = ['Diário','Semanal','Quinzenal','Mensal','Sob Demanda'];
    freqList.innerHTML = Object.entries(labels).map(([k, lbl]) => `
      <div class="config-item">
        <div><div class="config-label">${lbl}</div></div>
        <select class="config-input-sm" style="width:130px" onchange="state.config.frequencias['${k}']=this.value;agendarSalvamento()">
          ${opts.map(o => `<option${(c.frequencias?.[k]||'Diário')===o?' selected':''}>${o}</option>`).join('')}
        </select>
      </div>`).join('');
  }
}

// ── RENDER AGENDA ──
const HORAS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];

function renderAgenda(tipo) {
  const containerId = tipo === 'civil' ? 'agenda-civil' : 'agenda-tec';
  const lblId = tipo === 'civil' ? 'civil-agenda-lbl' : 'tec-agenda-lbl';
  const dataKey = tipo === 'civil' ? 'agendaCivilData' : 'agendaTecData';
  const el = $(containerId);
  const lbl = $(lblId);
  if (!el) return;

  const dataSel = state[dataKey] || hoje();
  if (lbl) {
    const [y, m, d] = dataSel.split('-');
    const diasSem = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const nomeDia = diasSem[new Date(dataSel + 'T12:00:00').getDay()];
    lbl.textContent = `${nomeDia}, ${d}/${m}/${y}`;
  }

  const ordensHoje = state.ordens.filter(o => o.tipo === tipo && o.dataPrevista === dataSel);
  const responsaveis = [...new Set(ordensHoje.map(o => o.responsavelId).filter(Boolean))];
  const semResp = ordensHoje.filter(o => !o.responsavelId);
  if (semResp.length) responsaveis.push('');

  if (!responsaveis.length) {
    el.innerHTML = `<div class="chart-empty">Nenhuma OS agendada para este dia.<br><span style="font-size:11px">Crie uma OS com data prevista e responsável para aparecer aqui.</span></div>`;
    return;
  }

  const colunas = responsaveis.map(id => id ? nomeTec(id) : 'Sem responsável');

  const header = `<tr><th class="agenda-hora">Hora</th>${colunas.map(c => `<th>${c}</th>`).join('')}</tr>`;

  const rows = HORAS.map(hora => {
    const cells = responsaveis.map(respId => {
      const os = ordensHoje.find(o => {
        const ini = o.horaInicio || '00:00';
        const fim = o.horaFim || '23:59';
        return o.responsavelId === respId && ini <= hora && hora < fim;
      });
      if (os) {
        const idxReal = state.ordens.indexOf(os);
        const cls = tipo === 'civil' ? 'agenda-bloco-civil' : 'agenda-bloco-tecnica';
        return `<td><div class="agenda-bloco ${cls}" onclick="editarOS(${idxReal})" title="${os.id} — ${nomeArea(os.areaId)}">
          <span class="agenda-bloco-text">${nomeArea(os.areaId)}</span>
          <span style="font-size:9px;opacity:0.7">${os.horaInicio}–${os.horaFim}</span>
        </div></td>`;
      }
      return `<td class="agenda-cell" onclick="abrirAgendaSlot('${tipo}','${dataSel}','${hora}','${respId}')" title="Clique para adicionar OS"></td>`;
    }).join('');
    return `<tr><td class="agenda-hora">${hora}</td>${cells}</tr>`;
  }).join('');

  el.innerHTML = `<div class="agenda-wrap"><table class="agenda-table"><thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
}

function abrirAgendaSlot(tipo, data, hora, respId) {
  state.abaTipoOS = tipo;
  const horaFimDef = HORAS[HORAS.indexOf(hora) + 1] || '23:00';
  abrirModalOS();
  setTimeout(() => {
    if ($('os-tipo')) $('os-tipo').value = tipo === 'civil' ? 'Limpeza Civil' : 'Limpeza Técnica';
    if ($('os-prevista')) $('os-prevista').value = data;
    if ($('os-hora-inicio')) $('os-hora-inicio').value = hora;
    if ($('os-hora-fim')) $('os-hora-fim').value = horaFimDef;
    if ($('os-resp') && respId) $('os-resp').value = respId;
  }, 50);
}
function renderRotinas() {
  const tbody = $('rotinas-tbody');
  if (!tbody) return;
  if (!state.rotinas.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhuma rotina cadastrada</td></tr>';
    return;
  }
  const freqLabel = { 'Diario':'Diário','Semanal':'Semanal','Quinzenal':'Quinzenal','Mensal':'Mensal' };
  const diasLabel = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  tbody.innerHTML = state.rotinas.map((r, i) => {
    const tipoCls = r.tipo === 'civil' ? 'badge-civil' : r.tipo === 'tecnica' ? 'badge-tec' : 'badge-ac';
    const tipoNm  = r.tipo === 'civil' ? 'Civil' : r.tipo === 'tecnica' ? 'Técnica' : 'AR';
    const dias = (r.diasSemana || []).map(d => diasLabel[d]).join(', ') || '—';
    return `<tr>
      <td>${r.nome}</td>
      <td><span class="badge ${tipoCls}">${tipoNm}</span></td>
      <td>${nomeArea(r.areaId)}</td>
      <td>${r.responsavelId ? (state.tecnicos.find(t=>t.id===r.responsavelId)?.nome||'—') : '—'}</td>
      <td>${freqLabel[r.frequencia]||r.frequencia}</td>
      <td>${r.frequencia==='Semanal'?dias:'—'}</td>
      <td><span class="badge ${r.ativa?'badge-ativo':'badge-inativo'}">${r.ativa?'Ativa':'Inativa'}</span></td>
      <td>
        <button class="btn-icon" onclick="abrirModalRotina(${i})" title="Editar">✏️</button>
        <button class="btn-icon" onclick="excluirRotina(${i})" title="Excluir">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function abrirModalRotina(idx = -1) {
  state.editIdx_rotina = idx;
  const r = idx >= 0 ? state.rotinas[idx] : null;
  $('modal-rotina-title').textContent = idx >= 0 ? 'Editar Rotina' : 'Nova Rotina';
  $('rot-nome').value        = r?.nome        || '';
  $('rot-tipo').value        = r?.tipo        || 'civil';
  $('rot-area').value        = r?.areaId      || '';
  $('rot-resp').value        = r?.responsavelId || '';
  $('rot-freq').value        = r?.frequencia  || 'Diario';
  $('rot-hora-ini').value    = r?.horaInicio  || '08:00';
  $('rot-hora-fim').value    = r?.horaFim     || '09:00';
  $('rot-ativa').value       = r?.ativa === false ? 'false' : 'true';
  const dias = r?.diasSemana || [];
  document.querySelectorAll('.rot-dia-check').forEach(cb => {
    cb.checked = dias.includes(parseInt(cb.value));
  });
  toggleDiasSemana();
  popularSelectsRotina();
  abrirModal('modal-rotina');
}

function toggleDiasSemana() {
  const wrap = $('rot-dias-wrap');
  if (wrap) wrap.style.display = $('rot-freq').value === 'Semanal' ? 'block' : 'none';
}

function popularSelectsRotina() {
  const selArea = $('rot-area');
  const selResp = $('rot-resp');
  if (selArea) {
    const cur = selArea.value;
    selArea.innerHTML = '<option value="">— Área —</option>' +
      state.areas.map(a => `<option value="${a.id}"${a.id===cur?' selected':''}>${a.nome}</option>`).join('');
  }
  if (selResp) {
    const cur = selResp.value;
    selResp.innerHTML = '<option value="">— Responsável —</option>' +
      state.tecnicos.map(t => `<option value="${t.id}"${t.id===cur?' selected':''}>${t.nome}</option>`).join('');
  }
}

function salvarRotina() {
  const nome = $('rot-nome').value.trim();
  if (!nome) { alert('Informe o nome da rotina.'); return; }
  const diasSemana = [];
  document.querySelectorAll('.rot-dia-check:checked').forEach(cb => diasSemana.push(parseInt(cb.value)));
  const obj = {
    nome,
    tipo:          $('rot-tipo').value,
    areaId:        $('rot-area').value,
    responsavelId: $('rot-resp').value,
    frequencia:    $('rot-freq').value,
    diasSemana,
    horaInicio:    $('rot-hora-ini').value,
    horaFim:       $('rot-hora-fim').value,
    ativa:         $('rot-ativa').value === 'true'
  };
  if (state.editIdx_rotina >= 0) {
    obj.id = state.rotinas[state.editIdx_rotina].id;
    state.rotinas[state.editIdx_rotina] = obj;
  } else {
    obj.id = gerarId('RT', state.rotinas, 'id');
    state.rotinas.push(obj);
  }
  fecharModal('modal-rotina');
  agendarSalvamento();
  renderRotinas();
  gerarOSdasRotinas();
  renderCronograma();
}

function excluirRotina(idx) {
  if (!confirm('Excluir esta rotina?')) return;
  state.rotinas.splice(idx, 1);
  agendarSalvamento();
  renderRotinas();
}

function gerarOSdasRotinas() {
  const meses = [hoje().slice(0,7)];
  const prox = new Date(); prox.setMonth(prox.getMonth()+1);
  meses.push(prox.toISOString().slice(0,7));

  state.rotinas.filter(r => r.ativa).forEach(rotina => {
    meses.forEach(mesStr => {
      const [ano, mes] = mesStr.split('-').map(Number);
      const diasNoMes = new Date(ano, mes, 0).getDate();
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const dow = new Date(dataStr + 'T12:00:00').getDay(); // 0=dom

        let deveGerar = false;
        if (rotina.frequencia === 'Diario') {
          deveGerar = true;
        } else if (rotina.frequencia === 'Semanal') {
          deveGerar = (rotina.diasSemana || []).includes(dow);
        } else if (rotina.frequencia === 'Quinzenal') {
          deveGerar = (dia === 1 || dia === 16);
        } else if (rotina.frequencia === 'Mensal') {
          deveGerar = (dia === 1);
        }

        if (!deveGerar) continue;
        const jaExiste = state.ordens.some(o => o.origemRotina === rotina.id && o.dataPrevista === dataStr);
        if (jaExiste) continue;

        state.ordens.push({
          id:            gerarId('OS', state.ordens, 'id'),
          tipo:          rotina.tipo,
          areaId:        rotina.areaId,
          responsavelId: rotina.responsavelId,
          dataPrevista:  dataStr,
          dataRealizada: '',
          status:        'Programada',
          horaInicio:    rotina.horaInicio,
          horaFim:       rotina.horaFim,
          obs:           `[Auto] Rotina: ${rotina.nome}`,
          origemRotina:  rotina.id
        });
      }
    });
  });
  agendarSalvamento();
}

function renderCronograma() {
  const mesInput = $('crono-mes');
  const mesSel = mesInput?.value || hoje().slice(0,7);
  const [ano, mes] = mesSel.split('-').map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDow = new Date(`${ano}-${String(mes).padStart(2,'0')}-01T12:00:00`).getDay();

  const tabAtiva = document.querySelector('#pane-cronograma .tab-btn.active')?.dataset.tab || 'tab-crono-civil';
  const tipoFiltro = tabAtiva.includes('tec') ? 'tecnica' : tabAtiva.includes('ac') ? 'ac' : tabAtiva.includes('consolidado') ? 'todos' : 'civil';

  function getOsDoDia(dataStr) {
    const osCivil = state.ordens.filter(o => o.tipo==='civil' && o.dataPrevista===dataStr);
    const osTec   = state.ordens.filter(o => o.tipo==='tecnica' && o.dataPrevista===dataStr);
    const osAC    = state.preventivas.filter(p => p.dataPrevista===dataStr);
    if (tipoFiltro==='civil')   return osCivil;
    if (tipoFiltro==='tecnica') return osTec;
    if (tipoFiltro==='ac')      return osAC;
    return [...osCivil, ...osTec, ...osAC];
  }

  function buildChip(o) {
    const isCivil = o.tipo==='civil';
    const isTec   = o.tipo==='tecnica';
    const cls = isCivil?'cal-chip-civil':isTec?'cal-chip-tec':'cal-chip-ac';
    const label = nomeArea(o.areaId||o.ucId)||o.id;
    const idxReal = state.ordens.indexOf(o);
    const click = idxReal>=0 ? `editarOS(${idxReal})` : '';
    return `<div class="cal-chip ${cls}" onclick="${click}" title="${o.id} — ${badgeTxt(o.status)}">${label}</div>`;
  }

  function badgeTxt(s) { return s||'Programada'; }

  const diasSemLabel = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const header = diasSemLabel.map(d=>`<div class="cal-head-cell">${d}</div>`).join('');

  let cells = '';
  for (let i=0;i<primeiroDow;i++) cells += '<div class="cal-cell cal-cell-vazio"></div>';

  for (let dia=1; dia<=diasNoMes; dia++) {
    const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const eHoje = dataStr === hoje();
    const os = getOsDoDia(dataStr);
    const chips = os.map(buildChip).join('');
    cells += `<div class="cal-cell${eHoje?' cal-cell-hoje':''}">
      <div class="cal-cell-num">${dia}</div>
      <div class="cal-cell-chips">${chips}</div>
    </div>`;
  }

  const targetId = tabAtiva.replace('tab-crono-','crono-')+ '-full';
  ['crono-civil-full','crono-tec-full','crono-ac-full','crono-consolidado-full'].forEach(id => {
    const el = $(id);
    if (!el) return;
    const isAtivo = el.closest('.tab-pane')?.classList.contains('active');
    if (!isAtivo && id !== targetId) return;
    el.innerHTML = `<div class="cal-grid"><div class="cal-header">${header}</div><div class="cal-body">${cells}</div></div>`;
  });
}

function renderTudo() {
  renderDashboard();
  renderOrdens('civil');
  renderOrdens('tecnica');
  renderAC();
  renderCronograma();
  renderAgenda('civil');
  renderAgenda('tecnica');
  renderPecas();
  renderCadastros();
  renderConfiguracoes();
}

// ── MODAIS — OS ──
function abrirModalOS(idx = -1) {
  state.editIdx.os = idx;
  const o = idx >= 0 ? state.ordens[idx] : null;
  $('modal-os-title').textContent = idx >= 0 ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço';
  $('os-tipo').value = o?.tipo || state.abaTipoOS;
  popularSelects();
  $('os-area').value = o?.areaId || '';
  $('os-resp').value = o?.responsavelId || '';
  $('os-prevista').value = o?.dataPrevista || '';
  $('os-realizada').value = o?.dataRealizada || '';
  $('os-status').value = o?.status || 'Programada';
  $('os-obs').value = o?.obs || '';
  if ($('os-hora-inicio')) $('os-hora-inicio').value = o?.horaInicio || '08:00';
  if ($('os-hora-fim')) $('os-hora-fim').value = o?.horaFim || '09:00';
  abrirModal('modal-os');
}

function salvarOS() {
  const tipo = $('os-tipo').value;
  const areaId = $('os-area').value;
  const responsavelId = $('os-resp').value;
  const dataPrevista = $('os-prevista').value;
  const dataRealizada = $('os-realizada').value;
  const status = $('os-status').value;
  const obs = $('os-obs').value.trim();

  if (!tipo || !dataPrevista) { alert('Preencha os campos obrigatórios: tipo e data prevista.'); return; }

  const obj = { tipo, areaId, responsavelId, dataPrevista, dataRealizada, status, obs,
    horaInicio: $('os-hora-inicio')?.value || '08:00',
    horaFim: $('os-hora-fim')?.value || '09:00'
  };

  if (state.editIdx.os >= 0) {
    obj.id = state.ordens[state.editIdx.os].id;
    state.ordens[state.editIdx.os] = obj;
  } else {
    obj.id = gerarId('OS', state.ordens, 'id');
    state.ordens.push(obj);
  }
  fecharModal('modal-os');
  agendarSalvamento();
  popularSelects();
  renderTudo();
}

function editarOS(idx) { abrirModalOS(idx); }
function excluirOS(idx) { if (confirm('Excluir esta OS?')) { state.ordens.splice(idx, 1); agendarSalvamento(); renderTudo(); } }

// ── MODAIS — UC ──
function abrirModalUC(idx = -1) {
  state.editIdx.uc = idx;
  const u = idx >= 0 ? state.ucs[idx] : null;
  $('modal-uc-title').textContent = idx >= 0 ? 'Editar Unidade de Climatização' : 'Nova Unidade de Climatização';
  popularSelects();
  $('uc-categoria').value = u?.categoria || 'Ar-Condicionado';
  $('uc-codigo').value = u?.codigo || '';
  $('uc-nome').value = u?.nome || '';
  $('uc-modelo').value = u?.modelo || '';
  $('uc-btu').value = u?.capacidadeBtu || '';
  $('uc-tipo').value = u?.tipo || 'Split';
  $('uc-data-inst').value = u?.dataInstalacao || '';
  $('uc-ciclo-filtro').value = u?.cicloFiltroDias || state.config.cicloFiltroDias;
  $('uc-local-detalhe').value = u?.local || '';
  $('uc-resp').value = u?.responsavelId || '';
  $('uc-obs').value = u?.obs || '';
  abrirModal('modal-uc');
}

function salvarUC() {
  const codigo = ($('uc-codigo').value || '').trim().toUpperCase();
  const nome = ($('uc-nome').value || '').trim();
  if (!codigo || !nome) { alert('Código e nome são obrigatórios.'); return; }
  const obj = {
    categoria: $('uc-categoria').value,
    codigo,
    nome,
    local: $('uc-local-detalhe').value.trim(),
    modelo: $('uc-modelo').value.trim(),
    capacidadeBtu: parseInt($('uc-btu').value) || 0,
    tipo: $('uc-tipo').value,
    dataInstalacao: $('uc-data-inst').value,
    cicloFiltroDias: parseInt($('uc-ciclo-filtro').value) || state.config.cicloFiltroDias,
    responsavelId: $('uc-resp').value,
    obs: $('uc-obs').value.trim()
  };
  if (state.editIdx.uc >= 0) {
    obj.id = state.ucs[state.editIdx.uc].id;
    state.ucs[state.editIdx.uc] = obj;
  } else {
    obj.id = gerarId('UC', state.ucs, 'id');
    state.ucs.push(obj);
  }
  fecharModal('modal-uc');
  agendarSalvamento();
  popularSelects();
  renderTudo();
}

function editarUC(idx) { abrirModalUC(idx); }
function excluirUC(idx) { if (confirm('Excluir esta UC?')) { state.ucs.splice(idx, 1); agendarSalvamento(); renderTudo(); } }

// ── MODAIS — PREVENTIVA ──
function abrirModalPreventiva(idx = -1) {
  state.editIdx.preventiva = idx;
  const p = idx >= 0 ? state.preventivas[idx] : null;
  $('modal-preventiva-title').textContent = idx >= 0 ? 'Editar Preventiva' : 'Nova Preventiva';
  popularSelects();
  $('prev-uc').value = p?.ucId || '';
  $('prev-tec').value = p?.tecnicoId || '';
  $('prev-data-prev').value = p?.dataPrevista || '';
  $('prev-data-real').value = p?.dataRealizada || '';
  $('prev-status').value = p?.status || 'Programada';
  $('prev-obs').value = p?.obs || '';

  // Checklist dinâmico
  const cl = $('prev-checklist-wrap');
  if (cl) {
    cl.innerHTML = state.config.checklistPreventiva.map((item, i) => {
      const checked = p?.checklist?.find(c => c.item === item)?.concluido ? 'checked' : '';
      return `<div class="checklist-item">
        <input type="checkbox" id="clitem-${i}" ${checked} data-item="${item.replace(/"/g, '&quot;')}">
        <label for="clitem-${i}">${item}</label>
      </div>`;
    }).join('');
  }
  abrirModal('modal-preventiva');
}

function salvarPreventiva() {
  const ucId = $('prev-uc').value;
  const dataPrevista = $('prev-data-prev').value;
  if (!ucId || !dataPrevista) { alert('UC e data prevista são obrigatórios.'); return; }

  const checklist = state.config.checklistPreventiva.map((item, i) => ({
    item,
    concluido: !!document.getElementById('clitem-' + i)?.checked
  }));

  const obj = {
    ucId,
    tecnicoId: $('prev-tec').value,
    dataPrevista,
    dataRealizada: $('prev-data-real').value,
    status: $('prev-status').value,
    checklist,
    obs: $('prev-obs').value.trim()
  };
  if (state.editIdx.preventiva >= 0) {
    obj.id = state.preventivas[state.editIdx.preventiva].id;
    state.preventivas[state.editIdx.preventiva] = obj;
  } else {
    obj.id = gerarId('PV', state.preventivas, 'id');
    state.preventivas.push(obj);
  }
  fecharModal('modal-preventiva');
  agendarSalvamento();
  renderTudo();
}

function editarPreventiva(idx) { abrirModalPreventiva(idx); }
function excluirPreventiva(idx) { if (confirm('Excluir esta preventiva?')) { state.preventivas.splice(idx, 1); agendarSalvamento(); renderTudo(); } }

// ── MODAIS — MANUTENÇÃO ──
function abrirModalManutencao(idx = -1) {
  state.editIdx.manutencao = idx;
  const m = idx >= 0 ? state.manutencoes[idx] : null;
  $('modal-manutencao-title').textContent = idx >= 0 ? 'Editar Manutenção' : 'Nova Manutenção Corretiva';
  popularSelects();
  $('man-uc').value = m?.ucId || '';
  $('man-tec').value = m?.tecnicoId || '';
  $('man-falha').value = m?.falha || '';
  $('man-abertura').value = m?.dataAbertura || hoje();
  $('man-fechamento').value = m?.dataFechamento || '';
  $('man-status').value = m?.status || 'Aberta';
  $('man-custo').value = m?.custoEstimado || '';
  $('man-pecas').value = m?.pecasUtilizadas || '';
  $('man-obs').value = m?.obs || '';
  abrirModal('modal-manutencao');
}

function salvarManutencao() {
  const ucId = $('man-uc').value;
  const falha = ($('man-falha').value || '').trim();
  if (!ucId || !falha) { alert('UC e falha são obrigatórios.'); return; }
  const obj = {
    ucId,
    tecnicoId: $('man-tec').value,
    falha,
    dataAbertura: $('man-abertura').value,
    dataFechamento: $('man-fechamento').value,
    status: $('man-status').value,
    custoEstimado: parseFloat($('man-custo').value) || 0,
    pecasUtilizadas: $('man-pecas').value.trim(),
    obs: $('man-obs').value.trim()
  };
  if (state.editIdx.manutencao >= 0) {
    obj.id = state.manutencoes[state.editIdx.manutencao].id;
    state.manutencoes[state.editIdx.manutencao] = obj;
  } else {
    obj.id = gerarId('MN', state.manutencoes, 'id');
    state.manutencoes.push(obj);
  }
  fecharModal('modal-manutencao');
  agendarSalvamento();
  renderTudo();
}

function editarManutencao(idx) { abrirModalManutencao(idx); }
function excluirManutencao(idx) { if (confirm('Excluir esta manutenção?')) { state.manutencoes.splice(idx, 1); agendarSalvamento(); renderTudo(); } }

// ── MODAIS — PEÇA ──
function abrirModalPeca(idx = -1) {
  state.editIdx.peca = idx;
  const p = idx >= 0 ? state.pecas[idx] : null;
  $('modal-peca-title').textContent = idx >= 0 ? 'Editar Peça' : 'Nova Peça';
  $('peca-codigo').value = p?.codigo || '';
  $('peca-desc').value = p?.descricao || '';
  $('peca-cat').value = p?.categoria || 'Outros';
  $('peca-fab').value = p?.fabricante || '';
  $('peca-ref').value = p?.referencia || '';
  $('peca-unid').value = p?.unidade || 'Pç';
  $('peca-estq-atual').value = p?.estqAtual ?? 0;
  $('peca-estq-min').value = p?.estqMinimo ?? 0;
  $('peca-obs').value = p?.obs || '';
  abrirModal('modal-peca');
}

function salvarPeca() {
  const codigo = ($('peca-codigo').value || '').trim().toUpperCase();
  const descricao = ($('peca-desc').value || '').trim();
  if (!codigo || !descricao) { alert('Código e descrição são obrigatórios.'); return; }
  const obj = {
    codigo,
    descricao,
    categoria: $('peca-cat').value,
    fabricante: $('peca-fab').value.trim(),
    referencia: $('peca-ref').value.trim(),
    unidade: $('peca-unid').value.trim() || 'Pç',
    estqAtual: parseInt($('peca-estq-atual').value) || 0,
    estqMinimo: parseInt($('peca-estq-min').value) || 0,
    obs: $('peca-obs').value.trim()
  };
  if (state.editIdx.peca >= 0) {
    obj.id = state.pecas[state.editIdx.peca].id;
    state.pecas[state.editIdx.peca] = obj;
  } else {
    obj.id = gerarId('PC', state.pecas, 'id');
    state.pecas.push(obj);
  }
  fecharModal('modal-peca');
  agendarSalvamento();
  popularSelects();
  renderTudo();
}

function editarPeca(idx) { abrirModalPeca(idx); }
function excluirPeca(idx) { if (confirm('Excluir esta peça?')) { state.pecas.splice(idx, 1); agendarSalvamento(); popularSelects(); renderTudo(); } }

// ── MODAIS — REQUISIÇÃO ──
function abrirModalRequisicao(idx = -1) {
  state.editIdx.requisicao = idx;
  const r = idx >= 0 ? state.requisicoes[idx] : null;
  $('modal-requisicao-title').textContent = idx >= 0 ? 'Editar Requisição' : 'Nova Requisição de Peça';
  popularSelects();
  $('req-peca').value = r?.pecaId || '';
  $('req-qtd').value = r?.quantidade || 1;
  $('req-destino').value = r?.destino || '';
  $('req-sol').value = r?.solicitanteId || '';
  $('req-data').value = r?.dataNecessidade || '';
  $('req-obs').value = r?.obs || '';
  abrirModal('modal-requisicao');
}

function salvarRequisicao() {
  const pecaId = $('req-peca').value;
  const quantidade = parseInt($('req-qtd').value) || 0;
  if (!pecaId || quantidade <= 0) { alert('Peça e quantidade são obrigatórios.'); return; }
  const obj = {
    pecaId,
    quantidade,
    destino: $('req-destino').value.trim(),
    solicitanteId: $('req-sol').value,
    dataNecessidade: $('req-data').value,
    status: 'Solicitado',
    obs: $('req-obs').value.trim()
  };
  if (state.editIdx.requisicao >= 0) {
    obj.id = state.requisicoes[state.editIdx.requisicao].id;
    obj.status = state.requisicoes[state.editIdx.requisicao].status;
    state.requisicoes[state.editIdx.requisicao] = obj;
  } else {
    obj.id = gerarId('RQ', state.requisicoes, 'id');
    state.requisicoes.push(obj);
  }
  fecharModal('modal-requisicao');
  agendarSalvamento();
  renderTudo();
}

function editarRequisicao(idx) { abrirModalRequisicao(idx); }
function excluirRequisicao(idx) { if (confirm('Excluir esta requisição?')) { state.requisicoes.splice(idx, 1); agendarSalvamento(); renderTudo(); } }

// ── MODAIS — ÁREA ──
function abrirModalArea(idx = -1) {
  state.editIdx.area = idx;
  const a = idx >= 0 ? state.areas[idx] : null;
  $('modal-area-title').textContent = idx >= 0 ? 'Editar Área' : 'Nova Área';
  popularSelects();
  $('area-nome').value = a?.nome || '';
  $('area-local').value = a?.local || '';
  $('area-tipo').value = a?.tipo || 'Escritório';
  $('area-metragem').value = a?.metragem || '';
  $('area-freq-civil').value = a?.freqCivil || 'Diário';
  $('area-freq-tec').value = a?.freqTecnica || 'Semanal';
  $('area-resp').value = a?.responsavelId || '';
  $('area-obs').value = a?.obs || '';
  abrirModal('modal-area');
}

function salvarArea() {
  const nome = ($('area-nome').value || '').trim();
  if (!nome) { alert('Nome da área é obrigatório.'); return; }
  const obj = {
    nome,
    local: $('area-local').value.trim(),
    tipo: $('area-tipo').value,
    metragem: parseFloat($('area-metragem').value) || 0,
    freqCivil: $('area-freq-civil').value,
    freqTecnica: $('area-freq-tec').value,
    responsavelId: $('area-resp').value,
    obs: $('area-obs').value.trim()
  };
  if (state.editIdx.area >= 0) {
    obj.id = state.areas[state.editIdx.area].id;
    state.areas[state.editIdx.area] = obj;
  } else {
    obj.id = gerarId('AR', state.areas, 'id');
    state.areas.push(obj);
  }
  fecharModal('modal-area');
  agendarSalvamento();
  popularSelects();
  renderTudo();
}

function editarArea(idx) { abrirModalArea(idx); }
function excluirArea(idx) { if (confirm('Excluir esta área?')) { state.areas.splice(idx, 1); agendarSalvamento(); popularSelects(); renderTudo(); } }

// ── MODAIS — FORNECEDOR ──
function abrirModalFornecedor(idx = -1) {
  state.editIdx.fornecedor = idx;
  const f = idx >= 0 ? state.fornecedores[idx] : null;
  $('modal-fornecedor-title').textContent = idx >= 0 ? 'Editar Fornecedor' : 'Novo Fornecedor';
  $('forn-nome').value = f?.nome || '';
  $('forn-cnpj').value = f?.cnpj || '';
  $('forn-tipo').value = f?.tipoServico || 'Limpeza Civil';
  $('forn-contato').value = f?.contato || '';
  $('forn-tel').value = f?.telefone || '';
  $('forn-email').value = f?.email || '';
  $('forn-ativo').value = f?.ativo || 'Sim';
  abrirModal('modal-fornecedor');
}

function salvarFornecedor() {
  const nome = ($('forn-nome').value || '').trim();
  if (!nome) { alert('Nome é obrigatório.'); return; }
  const obj = {
    nome,
    cnpj: $('forn-cnpj').value.trim(),
    tipoServico: $('forn-tipo').value,
    contato: $('forn-contato').value.trim(),
    telefone: $('forn-tel').value.trim(),
    email: $('forn-email').value.trim(),
    ativo: $('forn-ativo').value
  };
  if (state.editIdx.fornecedor >= 0) {
    obj.id = state.fornecedores[state.editIdx.fornecedor].id;
    state.fornecedores[state.editIdx.fornecedor] = obj;
  } else {
    obj.id = gerarId('FR', state.fornecedores, 'id');
    state.fornecedores.push(obj);
  }
  fecharModal('modal-fornecedor');
  agendarSalvamento();
  renderTudo();
}

function editarFornecedor(idx) { abrirModalFornecedor(idx); }
function excluirFornecedor(idx) { if (confirm('Excluir este fornecedor?')) { state.fornecedores.splice(idx, 1); agendarSalvamento(); renderTudo(); } }

// ── MODAIS — TÉCNICO ──
function abrirModalTecnico(idx = -1) {
  state.editIdx.tecnico = idx;
  const t = idx >= 0 ? state.tecnicos[idx] : null;
  $('modal-tecnico-title').textContent = idx >= 0 ? 'Editar Técnico' : 'Novo Técnico/Responsável';
  $('tec-nome').value = t?.nome || '';
  $('tec-matricula').value = t?.matricula || '';
  $('tec-especialidade').value = t?.especialidade || 'Limpeza';
  $('tec-turno').value = t?.turno || 'Manhã';
  abrirModal('modal-tecnico');
}

function salvarTecnico() {
  const nome = ($('tec-nome').value || '').trim();
  if (!nome) { alert('Nome é obrigatório.'); return; }
  const obj = {
    nome,
    matricula: $('tec-matricula').value.trim(),
    especialidade: $('tec-especialidade').value,
    turno: $('tec-turno').value
  };
  if (state.editIdx.tecnico >= 0) {
    obj.id = state.tecnicos[state.editIdx.tecnico].id;
    state.tecnicos[state.editIdx.tecnico] = obj;
  } else {
    obj.id = gerarId('TC', state.tecnicos, 'id');
    state.tecnicos.push(obj);
  }
  fecharModal('modal-tecnico');
  agendarSalvamento();
  popularSelects();
  renderTudo();
}

function editarTecnico(idx) { abrirModalTecnico(idx); }
function excluirTecnico(idx) { if (confirm('Excluir este técnico?')) { state.tecnicos.splice(idx, 1); agendarSalvamento(); popularSelects(); renderTudo(); } }

function excluirChecklistItem(idx) {
  state.config.checklistPreventiva.splice(idx, 1);
  agendarSalvamento();
  renderConfiguracoes();
}

function exportarJSON() {
  const txt = JSON.stringify(toJSON(), null, 2);
  const blob = new Blob([txt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'conforto-dados.json'; a.click();
  URL.revokeObjectURL(url);
}

async function tentarCarregar(){
  const d = await API.conforto.listar();
  if(d&&d.modulo==='conforto')carregarDeJSON(JSON.stringify(d));
}

document.addEventListener('DOMContentLoaded', () => {
  $('app').style.display = 'block';
  popularSelects();
  gerarOSdasRotinas();
  renderTudo();
  renderRotinas();


  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = $('pane-' + btn.dataset.pane);
      if (pane) pane.classList.add('active');
      if (btn.dataset.pane === 'limpeza-civil')   state.abaTipoOS = 'civil';
      if (btn.dataset.pane === 'limpeza-tecnica')  state.abaTipoOS = 'tecnica';
      if (btn.dataset.pane === 'rotinas')          renderRotinas();
      if (btn.dataset.pane === 'cronograma') {
  const mesInput = document.getElementById('crono-mes');
  if (mesInput && !mesInput.value) mesInput.value = hoje().slice(0, 7);
  renderCronograma();
}
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bar = btn.closest('.tab-bar');
      const pane = btn.closest('.pane');
      if (!bar || !pane) return;
      bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      pane.querySelectorAll(':scope > .tab-pane, :scope > div > .tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = $( btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  $('btn-nova-rotina')?.addEventListener('click', () => abrirModalRotina());
  $('btn-salvar-rotina')?.addEventListener('click', salvarRotina);
  $('rot-freq')?.addEventListener('change', toggleDiasSemana);
  $('modal-rotina-close')?.addEventListener('click',  () => fecharModal('modal-rotina'));
  $('modal-rotina-cancel')?.addEventListener('click', () => fecharModal('modal-rotina'));
  $('btn-nova-os-tec')?.addEventListener('click', () => { state.abaTipoOS = 'tecnica'; abrirModalOS(); });
  $('btn-nova-os')?.addEventListener('click', () => abrirModalOS());
  $('btn-nova-uc')?.addEventListener('click', () => abrirModalUC());
  $('btn-nova-prev')?.addEventListener('click', () => abrirModalPreventiva());
  $('btn-nova-man')?.addEventListener('click', () => abrirModalManutencao());
  $('btn-nova-peca')?.addEventListener('click', () => abrirModalPeca());
  $('btn-nova-req')?.addEventListener('click', () => abrirModalRequisicao());
  $('btn-nova-area')?.addEventListener('click', () => abrirModalArea());
  $('btn-novo-forn')?.addEventListener('click', () => abrirModalFornecedor());
  $('btn-novo-tec')?.addEventListener('click', () => abrirModalTecnico());
  $('btn-export-json')?.addEventListener('click', exportarJSON);
  $('btn-abrir-arquivo')?.addEventListener('click', () => {
    alert('Gerencie os arquivos pelo Hub principal.');
  });
  document.querySelectorAll('.uc-filtro-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.uc-filtro-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderUCGrid();
    });
  });
  document.querySelectorAll('.uc-filtro-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.uc-filtro-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderUCGrid();
    });
  });

  $('btn-salvar-os')?.addEventListener('click', salvarOS);
  $('btn-salvar-uc')?.addEventListener('click', salvarUC);
  $('btn-salvar-prev')?.addEventListener('click', salvarPreventiva);
  $('btn-salvar-man')?.addEventListener('click', salvarManutencao);
  $('btn-salvar-peca')?.addEventListener('click', salvarPeca);
  $('btn-salvar-req')?.addEventListener('click', salvarRequisicao);
  $('btn-salvar-area')?.addEventListener('click', salvarArea);
  $('btn-salvar-forn')?.addEventListener('click', salvarFornecedor);
  $('btn-salvar-tec')?.addEventListener('click', salvarTecnico);

  // 6. Fechar modais
  ['os', 'uc', 'preventiva', 'manutencao', 'peca', 'requisicao', 'area', 'fornecedor', 'tecnico'].forEach(nome => {
    $(`modal-${nome}-close`)?.addEventListener('click', () => fecharModal(`modal-${nome}`));
    $(`modal-${nome}-cancel`)?.addEventListener('click', () => fecharModal(`modal-${nome}`));
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  });

  // 7. Filtros e search
  $('civil-search')?.addEventListener('input', () => renderOrdens('civil'));
  $('civil-filtro-status')?.addEventListener('change', () => renderOrdens('civil'));
  $('civil-filtro-area')?.addEventListener('change', () => renderOrdens('civil'));
  $('tec-search')?.addEventListener('input', () => renderOrdens('tecnica'));
  $('tec-filtro-status')?.addEventListener('change', () => renderOrdens('tecnica'));
  $('tec-filtro-area')?.addEventListener('change', () => renderOrdens('tecnica'));
  $('pecas-search')?.addEventListener('input', renderPecas);
  $('pecas-filtro-cat')?.addEventListener('change', renderPecas);
  $('req-search')?.addEventListener('input', renderPecas);
  $('req-filtro-status')?.addEventListener('change', renderPecas);
  $('crono-mes')?.addEventListener('change', renderCronograma);

  function moverAgenda(tipo, delta) {
    const key = tipo === 'civil' ? 'agendaCivilData' : 'agendaTecData';
    const d = new Date(state[key] + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    state[key] = d.toISOString().slice(0, 10);
    renderAgenda(tipo);
  }
  $('civil-agenda-prev')?.addEventListener('click', () => moverAgenda('civil', -1));
  $('civil-agenda-next')?.addEventListener('click', () => moverAgenda('civil', 1));
  $('civil-agenda-hoje')?.addEventListener('click', () => { state.agendaCivilData = hoje(); renderAgenda('civil'); });
  $('tec-agenda-prev')?.addEventListener('click', () => moverAgenda('tecnica', -1));
  $('tec-agenda-next')?.addEventListener('click', () => moverAgenda('tecnica', 1));
  $('tec-agenda-hoje')?.addEventListener('click', () => { state.agendaTecData = hoje(); renderAgenda('tecnica'); });

  // 8. Config
  $('cfg-ciclo-filtro')?.addEventListener('change', e => { state.config.cicloFiltroDias = parseInt(e.target.value) || 90; agendarSalvamento(); });
  $('cfg-alerta-prev')?.addEventListener('change', e => { state.config.alertaPreventivaDias = parseInt(e.target.value) || 7; agendarSalvamento(); });
  $('cfg-alerta-limp')?.addEventListener('change', e => { state.config.alertaLimpezaDias = parseInt(e.target.value) || 2; agendarSalvamento(); });
  $('cfg-alerta-man')?.addEventListener('change', e => { state.config.alertaManutencaoDias = parseInt(e.target.value) || 3; agendarSalvamento(); });
  $('btn-add-checklist')?.addEventListener('click', () => {
    const val = prompt('Nome do item do checklist:');
    if (!val?.trim()) return;
    state.config.checklistPreventiva.push(val.trim());
    agendarSalvamento();
    renderConfiguracoes();
  });
  setTimeout(tentarCarregar, 300);
});

// ── EXPOR FUNÇÕES GLOBAIS ──
window.editarOS = editarOS;
window.excluirOS = excluirOS;
window.editarUC = editarUC;
window.excluirUC = excluirUC;
window.editarPreventiva = editarPreventiva;
window.excluirPreventiva = excluirPreventiva;
window.editarManutencao = editarManutencao;
window.excluirManutencao = excluirManutencao;
window.editarPeca = editarPeca;
window.excluirPeca = excluirPeca;
window.editarRequisicao = editarRequisicao;
window.excluirRequisicao = excluirRequisicao;
window.editarArea = editarArea;
window.excluirArea = excluirArea;
window.editarFornecedor = editarFornecedor;
window.excluirFornecedor = excluirFornecedor;
window.editarTecnico = editarTecnico;
window.excluirTecnico = excluirTecnico;
window.excluirChecklistItem = excluirChecklistItem;
window.abrirModalOS = abrirModalOS;
window.abrirModalRotina = abrirModalRotina;
window.excluirRotina    = excluirRotina;
window.salvarRotina     = salvarRotina;
window.toggleDiasSemana = toggleDiasSemana;
window.abrirModalUC = abrirModalUC;
window.abrirModalPreventiva = abrirModalPreventiva;
window.abrirModalManutencao = abrirModalManutencao;
window.exportarJSON = exportarJSON;
window.abrirAgendaSlot = abrirAgendaSlot;
window.state = state;
window.agendarSalvamento = agendarSalvamento;