'use strict';
const CAPEX_API = {
  listar:          ()        => req('/capex',                                 {}, 120000),
  salvar:          (d)       => req('/capex/projetos',                        { method:'POST', body:JSON.stringify({ projetos: Array.isArray(d) ? d : [d] }) }),
  excluir:         (id)      => req('/capex/projetos/' + id,                  { method:'DELETE' }),
  uploadArquivo:   (id, d)   => req('/capex/projetos/' + id + '/arquivo',     { method:'POST', body:JSON.stringify(d) }),
  downloadArquivo: (id)      => req('/capex/projetos/' + id + '/arquivo',     {}),
  extraido:        (id)      => req('/capex/projetos/' + id + '/extraido',    {}),
  plantas:         ()        => req('/capex/plantas',                         {}, 600000),
  salvarPlanta:    (d)       => req('/capex/plantas',                         { method:'POST', body:JSON.stringify(d) }),
  invalida: () => {
    if (typeof API !== 'undefined' && API.invalidar) {
      API.invalidar('/capex');
      API.invalidar('/capex/projetos');
    }
  },
};

let _dados     = null;  
let _projetoEd = null;  
let _itensEd   = [];    
let _arquivoLocal = { xlsx: null, pptx: null };
let _dirty     = false;
let _saveTimer = null;


function fmtMoeda(v, moeda = 'BRL') {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency: moeda || 'BRL', minimumFractionDigits:0, maximumFractionDigits:0 }).format(v);
}
function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024)          return b + ' B';
  if (b < 1024 * 1024)   return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}
function uid() { return 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }


function setSaveStatus(state, txt) {
  const el = document.getElementById('save-status');
  el.className = 'save-status ' + state;
  document.getElementById('save-txt').textContent = txt;
}


async function init() {
  document.getElementById('tt-ano').textContent = new Date().getFullYear() + 1;

  
  const selAno = document.getElementById('sel-ano');
  const anoBase = new Date().getFullYear();
  selAno.innerHTML = '<option value="">Todos os Anos</option>';
  for (let a = anoBase - 1; a <= anoBase + 3; a++) {
    selAno.innerHTML += `<option value="${a}" ${a === anoBase + 1 ? 'selected' : ''}>${a}</option>`;
  }


  if (window.__DADOS__) {
    _dados = window.__DADOS__;
    renderTudo();
  }


  try {
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    renderTudo();
    Cache.salvar('capex', fresh);
  } catch (e) {
    console.error('[capex] erro ao carregar:', e);
    if (!_dados) {
      document.getElementById('proj-lista').innerHTML =
        '<div class="loading-msg">Erro ao carregar dados. Verifique sua conexão.</div>';
    }
  }


  ['sel-planta','sel-ano','sel-status','inp-busca'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderLista);
  });
  document.getElementById('btn-novo').addEventListener('click', abrirNovo);
  document.getElementById('modal-close').addEventListener('click', fecharModal);
  document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
  document.getElementById('btn-salvar').addEventListener('click', salvarProjeto);
  document.getElementById('btn-excluir').addEventListener('click', excluirProjeto);
  document.getElementById('btn-add-item').addEventListener('click', addItem);
  document.querySelectorAll('.mtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'extraido' && _projetoEd?.id) {
        carregarExtraido(_projetoEd.id);
      }
    });
  });
  document.getElementById('inp-xlsx').addEventListener('change', e => selecionarArquivo(e, 'xlsx'));
  document.getElementById('inp-pptx').addEventListener('change', e => selecionarArquivo(e, 'pptx'));
  document.getElementById('btn-upload').addEventListener('click', uploadArquivos);
  document.getElementById('btn-download-arq').addEventListener('click', downloadArquivo);
  document.getElementById('btn-del-arq').addEventListener('click', deletarArquivo);
}

// ── Render principal ──────────────────────────────────────
function renderTudo() {
  if (!_dados) return;
  popularSelectPlantas();
  renderLista();
}

function popularSelectPlantas() {
  const plantas = _dados.plantas || [];
  const sels = ['sel-planta', 'f-planta'];
  sels.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const primeiro = id === 'sel-planta' ? '<option value="">Todas as Plantas</option>' : '<option value="">Selecionar...</option>';
    el.innerHTML = primeiro + plantas.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
  });
}

function filtrarProjetos() {
  if (!_dados?.projetos) return [];
  const planta = document.getElementById('sel-planta').value;
  const ano    = document.getElementById('sel-ano').value;
  const status = document.getElementById('sel-status').value;
  const busca  = document.getElementById('inp-busca').value.toLowerCase().trim();
  return _dados.projetos.filter(p => {
    if (planta && p.planta_id !== planta) return false;
    if (ano    && String(p.ano_orcamento) !== ano) return false;
    if (status && p.status !== status) return false;
    if (busca  && !`${p.titulo} ${p.responsavel} ${p.categoria}`.toLowerCase().includes(busca)) return false;
    return true;
  });
}

function renderLista() {
  const lista = filtrarProjetos();
  const el = document.getElementById('proj-lista');

  let solTotal = 0, aprTotal = 0;
  lista.forEach(p => {
    solTotal += p.valor_solicitado || 0;
    aprTotal += p.valor_aprovado   || 0;
  });
  document.getElementById('tot-qtd').textContent = lista.length;
  document.getElementById('tot-sol').textContent = fmtMoeda(solTotal);
  document.getElementById('tot-apr').textContent = fmtMoeda(aprTotal);

  if (!lista.length) {
    el.innerHTML = '<div class="loading-msg">Nenhum projeto encontrado.</div>';
    return;
  }

  el.innerHTML = lista.map(p => {
    const nPlanta = (_dados.plantas || []).find(pl => pl.id === p.planta_id)?.nome || p.planta_id || '—';
    const badgeCls = 'badge-status badge-' + (p.status || 'Rascunho').replace(/ /g,'.');
    const arqIcon = (p.arquivos || []).length
      ? '<span class="proj-card-arq">📎 ZIP</span>' : '';
    return `
    <div class="proj-card" onclick="abrirEditar('${p.id}')">
      <div class="proj-card-planta">${nPlanta}</div>
      <div class="proj-card-body">
        <div class="proj-card-titulo">${p.titulo || '(sem título)'}</div>
        <div class="proj-card-sub">
          <span>${p.categoria || '—'}</span>
          <span>${p.responsavel || '—'}</span>
          <span>${p.ano_orcamento || '—'}</span>
        </div>
      </div>
      ${arqIcon}
      <span class="${badgeCls}">${p.status || 'Rascunho'}</span>
      <div class="proj-card-valores">
        <div class="proj-card-val">${fmtMoeda(p.valor_solicitado, p.moeda)}<small>solicitado</small></div>
        ${p.valor_aprovado ? `<div class="proj-card-val">${fmtMoeda(p.valor_aprovado, p.moeda)}<small>aprovado</small></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Modal ─────────────────────────────────────────────────
function abrirNovo() {
  _projetoEd = {
    id: uid(), planta_id: '', titulo: '', descricao: '', ano_orcamento: new Date().getFullYear() + 1,
    categoria: '', responsavel: '', status: 'Rascunho', prioridade: 'Média',
    valor_solicitado: 0, valor_aprovado: 0, moeda: 'BRL',
    justificativa: '', retorno_previsto: '', obs: '', itens: [], arquivos: [],
  };
  _itensEd = [];
  _arquivoLocal = { xlsx: null, pptx: null };
  preencherModal();
  document.getElementById('btn-excluir').style.display = 'none';
  document.getElementById('modal-ttl').textContent = 'Novo Projeto CAPEX';
  abrirModal();
}

window.abrirEditar = function(id) {
  const p = (_dados?.projetos || []).find(x => x.id === id);
  if (!p) return;
  _projetoEd = JSON.parse(JSON.stringify(p));
  _itensEd   = JSON.parse(JSON.stringify(p.itens || []));
  _arquivoLocal = { xlsx: null, pptx: null };
  preencherModal();
  document.getElementById('btn-excluir').style.display = 'inline-flex';
  document.getElementById('modal-ttl').textContent = 'Editar — ' + (p.titulo || 'Projeto');
  abrirModal();
};

function preencherModal() {
  const p = _projetoEd;
  document.getElementById('f-planta').value      = p.planta_id || '';
  document.getElementById('f-ano').value         = p.ano_orcamento || '';
  document.getElementById('f-status').value      = p.status || 'Rascunho';
  document.getElementById('f-prioridade').value  = p.prioridade || 'Média';
  document.getElementById('f-titulo').value      = p.titulo || '';
  document.getElementById('f-categoria').value   = p.categoria || '';
  document.getElementById('f-responsavel').value = p.responsavel || '';
  document.getElementById('f-descricao').value   = p.descricao || '';
  document.getElementById('f-val-sol').value     = p.valor_solicitado || 0;
  document.getElementById('f-val-apr').value     = p.valor_aprovado || 0;
  document.getElementById('f-moeda').value       = p.moeda || 'BRL';
  document.getElementById('f-retorno').value     = p.retorno_previsto || '';
  document.getElementById('f-justificativa').value = p.justificativa || '';
  document.getElementById('f-obs').value         = p.obs || '';
  document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
  document.querySelector('.mtab[data-tab="geral"]').classList.add('active');
  document.getElementById('tab-geral').classList.add('active');

  renderItens();
  renderArquivos();
  document.getElementById('extraido-wrap').innerHTML = '<div class="extraido-vazio">Clique na aba para carregar dados extraídos.</div>';
}

function abrirModal()  { document.getElementById('modal').style.display = 'flex'; }
function fecharModal() { document.getElementById('modal').style.display = 'none'; _projetoEd = null; }

// ── Salvar ────────────────────────────────────────────────
async function salvarProjeto() {
  const p = _projetoEd;
  p.planta_id         = document.getElementById('f-planta').value;
  p.ano_orcamento     = parseInt(document.getElementById('f-ano').value) || new Date().getFullYear() + 1;
  p.status            = document.getElementById('f-status').value;
  p.prioridade        = document.getElementById('f-prioridade').value;
  p.titulo            = document.getElementById('f-titulo').value.trim();
  p.categoria         = document.getElementById('f-categoria').value.trim();
  p.responsavel       = document.getElementById('f-responsavel').value.trim();
  p.descricao         = document.getElementById('f-descricao').value.trim();
  p.valor_solicitado  = parseFloat(document.getElementById('f-val-sol').value) || 0;
  p.valor_aprovado    = parseFloat(document.getElementById('f-val-apr').value) || 0;
  p.moeda             = document.getElementById('f-moeda').value;
  p.retorno_previsto  = document.getElementById('f-retorno').value.trim();
  p.justificativa     = document.getElementById('f-justificativa').value.trim();
  p.obs               = document.getElementById('f-obs').value.trim();
  p.itens             = _itensEd;

  if (!p.titulo) { alert('Informe o título do projeto.'); return; }
  if (!p.planta_id) { alert('Selecione uma planta.'); return; }

  setSaveStatus('saving', 'salvando...');
  try {
    await CAPEX_API.salvar(p);
    CAPEX_API.invalida();
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    renderTudo();
    setSaveStatus('saved', 'salvo');
    fecharModal();
    setTimeout(() => setSaveStatus('nosave', 'sem alterações'), 3000);
  } catch (e) {
    setSaveStatus('error', 'erro ao salvar');
    console.error('[capex] salvar:', e);
    alert('Erro ao salvar: ' + e.message);
  }
}

async function excluirProjeto() {
  if (!confirm('Excluir este projeto CAPEX? Esta ação não pode ser desfeita.')) return;
  try {
    await CAPEX_API.excluir(_projetoEd.id);
    CAPEX_API.invalida();
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    renderTudo();
    fecharModal();
  } catch (e) {
    alert('Erro ao excluir: ' + e.message);
  }
}

// ── Itens ─────────────────────────────────────────────────
function renderItens() {
  const tbody = document.getElementById('itens-body');
  if (!_itensEd.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--text-muted)">Nenhum item. Clique em "+ Item".</td></tr>`;
    document.getElementById('itens-total').textContent = 'Total: R$ 0,00';
    return;
  }
  tbody.innerHTML = _itensEd.map((it, i) => `
    <tr data-idx="${i}">
      <td><input value="${esc(it.descricao)}"     onchange="editItem(${i},'descricao',this.value)"    placeholder="Descrição"></td>
      <td><input value="${esc(it.categoria)}"      onchange="editItem(${i},'categoria',this.value)"    placeholder="Categoria"></td>
      <td><input value="${esc(it.fornecedor)}"     onchange="editItem(${i},'fornecedor',this.value)"   placeholder="Fornecedor"></td>
      <td><input class="num" type="number" value="${it.quantidade||1}" onchange="editItem(${i},'quantidade',+this.value)" style="width:60px"></td>
      <td><input value="${esc(it.unidade)}"        onchange="editItem(${i},'unidade',this.value)"      placeholder="un" style="width:50px"></td>
      <td><input class="num" type="number" value="${it.preco_unitario||0}" onchange="editItem(${i},'preco_unitario',+this.value)" style="width:100px"></td>
      <td class="num">${fmtMoeda((it.quantidade||1)*(it.preco_unitario||0), _projetoEd?.moeda)}</td>
      <td><button class="btn-rm-item" onclick="rmItem(${i})">×</button></td>
    </tr>`).join('');
  const total = _itensEd.reduce((s, it) => s + (it.quantidade||1)*(it.preco_unitario||0), 0);
  document.getElementById('itens-total').textContent = 'Total: ' + fmtMoeda(total, _projetoEd?.moeda);
}

function esc(v) { return (v||'').toString().replace(/"/g,'&quot;'); }

window.editItem = function(idx, campo, valor) {
  _itensEd[idx][campo] = valor;
  const total = (_itensEd[idx].quantidade||1) * (_itensEd[idx].preco_unitario||0);
  const cells = document.querySelectorAll(`[data-idx="${idx}"] td.num`);
  if (cells[0]) cells[0].textContent = fmtMoeda(total, _projetoEd?.moeda);
  const globalTotal = _itensEd.reduce((s, it) => s + (it.quantidade||1)*(it.preco_unitario||0), 0);
  document.getElementById('itens-total').textContent = 'Total: ' + fmtMoeda(globalTotal, _projetoEd?.moeda);
};

function addItem() {
  _itensEd.push({ id: uid(), descricao:'', categoria:'', fornecedor:'', quantidade:1, unidade:'un', preco_unitario:0, moeda: _projetoEd?.moeda || 'BRL', obs:'' });
  renderItens();
}

window.rmItem = function(idx) {
  _itensEd.splice(idx, 1);
  renderItens();
};

// ── Arquivos ──────────────────────────────────────────────
function renderArquivos() {
  const arquivos = _projetoEd?.arquivos || [];
  const existente = arquivos[0];
  const el = document.getElementById('arq-existente');
  if (existente) {
    el.style.display = 'flex';
    document.getElementById('arq-ex-nome').textContent = existente.nome || 'arquivo.zip';
    document.getElementById('arq-ex-size').textContent = fmtBytes(existente.tamanho_bytes);
  } else {
    el.style.display = 'none';
  }
  document.getElementById('nome-xlsx').textContent = 'Nenhum arquivo';
  document.getElementById('nome-pptx').textContent = 'Nenhum arquivo';
  document.getElementById('btn-upload').disabled = true;
  document.getElementById('arq-status').textContent = '';
}

function selecionarArquivo(e, tipo) {
  const file = e.target.files[0];
  if (!file) return;
  _arquivoLocal[tipo] = file;
  document.getElementById(`nome-${tipo}`).textContent = file.name;
  document.getElementById('btn-upload').disabled = !(_arquivoLocal.xlsx || _arquivoLocal.pptx);
}

async function lerArquivoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadArquivos() {
  if (!_projetoEd?.id) return;
  const btn = document.getElementById('btn-upload');
  const statusEl = document.getElementById('arq-status');
  btn.disabled = true;
  statusEl.textContent = 'Preparando...';

  try {
    const body = {};
    if (_arquivoLocal.xlsx) {
      body.xlsx_b64  = await lerArquivoBase64(_arquivoLocal.xlsx);
      body.xlsx_nome = _arquivoLocal.xlsx.name;
    }
    if (_arquivoLocal.pptx) {
      body.pptx_b64  = await lerArquivoBase64(_arquivoLocal.pptx);
      body.pptx_nome = _arquivoLocal.pptx.name;
    }

    statusEl.textContent = 'Salvando no Delta Lake...';
    const t0 = performance.now();
    const res = await CAPEX_API.uploadArquivo(_projetoEd.id, body);
    const ms  = Math.round(performance.now() - t0);

    statusEl.textContent = `✓ Salvo em ${ms}ms${res.extraindo ? ' — extração em background' : ''}`;

    // atualiza projeto em memória sem fechar modal
    CAPEX_API.invalida();
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    _projetoEd = (fresh.projetos || []).find(p => p.id === _projetoEd.id) || _projetoEd;
    renderArquivos();
    renderLista();
  } catch (e) {
    statusEl.textContent = '✗ Erro: ' + e.message;
    btn.disabled = false;
  }
}

async function downloadArquivo() {
  if (!_projetoEd?.id) return;
  try {
    const res = await CAPEX_API.downloadArquivo(_projetoEd.id);
    if (!res.zip_b64) { alert('Arquivo não encontrado.'); return; }
    const bin  = atob(res.zip_b64);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/zip' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = res.nome || 'capex.zip';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) { alert('Erro ao baixar: ' + e.message); }
}

async function deletarArquivo() {
  if (!confirm('Remover arquivo do Delta Lake?')) return;
  try {
    await fetch('/api/capex/projetos/' + _projetoEd.id + '/arquivo', {
      method: 'DELETE',
      headers: { 'X-Ctrl-Token': localStorage.getItem('ctrl-token') || '' },
    });
    CAPEX_API.invalida();
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    _projetoEd = (fresh.projetos || []).find(p => p.id === _projetoEd.id) || _projetoEd;
    renderArquivos();
    renderLista();
  } catch (e) { alert('Erro: ' + e.message); }
}

// ── Dados Extraídos ───────────────────────────────────────
async function carregarExtraido(pid) {
  const wrap = document.getElementById('extraido-wrap');
  wrap.innerHTML = '<div class="extraido-vazio">Carregando...</div>';
  try {
    const res = await CAPEX_API.extraido(pid);
    if (!res.extraido) {
      wrap.innerHTML = `<div class="extraido-vazio">
        ${res.status === 'pendente'
          ? 'Extração ainda em andamento... aguarde alguns segundos e atualize.'
          : 'Nenhum dado extraído. Faça o upload do Excel e/ou PPTX.'}
      </div>`;
      return;
    }
    renderExtraido(res.extraido, wrap);
  } catch (e) {
    wrap.innerHTML = '<div class="extraido-vazio">Erro ao carregar dados extraídos.</div>';
  }
}

function renderExtraido(dados, wrap) {
  let html = '';

  // PPTX
  if (dados.pptx?.slides?.length) {
    html += `<div class="extraido-sec"><h3>One Pager — ${dados.pptx.total_slides} slide(s)</h3>`;
    dados.pptx.slides.forEach(s => {
      if (!s.textos?.length && !s.notas) return;
      html += `<div class="extraido-slide">
        <div class="snum">Slide ${s.slide}</div>
        ${s.textos?.length ? '<ul>' + s.textos.slice(0,8).map(t => `<li>${esc(t)}</li>`).join('') + '</ul>' : ''}
        ${s.notas ? `<div style="margin-top:4px;font-size:11px;color:var(--text-muted)">Notas: ${esc(s.notas)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  }

  // XLSX
  if (dados.xlsx?.itens_principais?.length) {
    const itens = dados.xlsx.itens_principais.slice(0, 50);
    const cols  = Object.keys(itens[0] || {}).slice(0, 10);
    html += `<div class="extraido-sec"><h3>Excel — ${itens.length} linha(s)</h3>
      <table class="extraido-tbl"><thead><tr>${cols.map(c => `<th>${esc(String(c))}</th>`).join('')}</tr></thead>
      <tbody>${itens.map(row => `<tr>${cols.map(c => `<td>${esc(row[c] != null ? String(row[c]) : '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
  } else if (dados.xlsx?.planilhas) {
    html += `<div class="extraido-sec"><h3>Excel — planilhas detectadas</h3>`;
    Object.entries(dados.xlsx.resumo || {}).forEach(([aba, info]) => {
      html += `<div class="extraido-slide"><strong>${esc(aba)}</strong> — ${info.total_linhas} linhas, colunas: ${(info.colunas||[]).map(esc).join(', ')}</div>`;
    });
    html += '</div>';
  }

  if (!html) {
    html = '<div class="extraido-vazio">Nenhum conteúdo extraído reconhecido.</div>';
  }

  wrap.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', init);
