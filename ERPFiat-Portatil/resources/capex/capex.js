'use strict';

// ══════════════════════════════════════════
// API CAPEX (estende api.js existente)
// ══════════════════════════════════════════
const CAPEX_API = {
  listar:          ()        => req('/capex',                               {}, 120000),
  salvar:          (d)       => req('/capex/projetos',                      { method:'POST', body:JSON.stringify({ projetos: Array.isArray(d)?d:[d] }) }),
  excluir:         (id)      => req('/capex/projetos/'+id,                  { method:'DELETE' }),
  uploadArquivo:   (id,d)    => req('/capex/projetos/'+id+'/arquivo',       { method:'POST', body:JSON.stringify(d) }),
  downloadArquivo: (id)      => req('/capex/projetos/'+id+'/arquivo',       {}),
  extraido:        (id)      => req('/capex/projetos/'+id+'/extraido',      {}),
  plantas:         ()        => req('/capex/plantas',                       {}, 600000),
  salvarPlanta:    (d)       => req('/capex/plantas',                       { method:'POST', body:JSON.stringify(d) }),
  invalida: () => { ['/capex','/capex/projetos','/capex/plantas'].forEach(k=>{ if(typeof API!=='undefined'&&API.invalidar) API.invalidar(k); }); },
};

// ══════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════
let _dados      = null;
let _grupos     = [];  
let _plantas    = [];   
let _projetoEd  = null;
let _itensEd    = [];
let _arquivoLocal = { xlsx: null, pptx: null };
let _plantaFiltro = 'all';
let _charts     = {};

let _cotacoes = { USD: 1, EUR: 1, ARS: 1, BRL: 1 };

async function _carregarCotacoes() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/BRL');
    const data = await res.json();
    const r = data.rates || data;
    _cotacoes.USD = 1 / (r.USD || 1);
    _cotacoes.EUR = 1 / (r.EUR || 1);
    _cotacoes.ARS = 1 / (r.ARS || 1);
    _cotacoes.BRL = 1;
    console.log('[capex] cotações carregadas:', _cotacoes);
  } catch(e) {
    console.warn('[capex] cotações indisponíveis, usando 1:1');
  }
}

function _toBRL(valor, moeda) {
  if (!valor || moeda === 'BRL' || !moeda) return valor || 0;
  return valor * (_cotacoes[moeda] || 1);
}

function _fmtCambio(moeda) {
  if (!moeda || moeda === 'BRL') return '';
  const taxa = _cotacoes[moeda] || 1;
  return `1 ${moeda} = ${fmtR(taxa)}`;
}


const GRUPOS_PADRAO = ['ESLM','Proving Grounds','Protótipo','EMAT','Safety Center','NVH'];

function fmtR(v, moeda='BRL') {
  if (v==null||isNaN(v)) return '—';
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:moeda||'BRL',minimumFractionDigits:0,maximumFractionDigits:0}).format(v);
}
function fmtBytes(b) {
  if(!b) return '';
  if(b<1024) return b+' B';
  if(b<1024*1024) return (b/1024).toFixed(1)+' KB';
  return (b/1024/1024).toFixed(1)+' MB';
}
function uid() { return 'cap_'+Date.now()+'_'+Math.random().toString(36).slice(2,6); }
function esc(v) { return (v||'').toString().replace(/"/g,'&quot;'); }
function setSaveStatus(s,t) {
  const el=document.getElementById('save-status');
  el.className='save-status '+s;
  document.getElementById('save-txt').textContent=t;
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
async function init() {
  document.getElementById('tt-ano').textContent = new Date().getFullYear()+1;
  await _carregarCotacoes();

  // anos
  const selAno = document.getElementById('sel-ano');
  const base = new Date().getFullYear();
  selAno.innerHTML = '<option value="">Todos os Anos</option>';
  for(let a=base-1;a<=base+3;a++) {
    selAno.innerHTML += `<option value="${a}" ${a===base+1?'selected':''}>${a}</option>`;
  }

  // carregar dados do servidor ou injetados
  if(window.__DADOS__) { _dados=window.__DADOS__; _processar(); }
  try {
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    _processar();
  } catch(e) { console.error('[capex]',e); }

  // eventos filtros
  ['sel-ano','sel-status','inp-busca'].forEach(id=>{
    document.getElementById(id).addEventListener('input', renderAtivo);
  });

  // abas principais
  document.querySelectorAll('.main-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.main-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('pane-'+tab.dataset.tab).classList.add('active');
      if(tab.dataset.tab==='dashboard') renderDashboard();
    });
  });

  // botões topbar
  document.getElementById('btn-novo').addEventListener('click', abrirNovo);
  document.getElementById('btn-config').addEventListener('click', abrirConfig);

  // modal projeto
  document.getElementById('modal-close').addEventListener('click', fecharModal);
  document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
  document.getElementById('btn-salvar').addEventListener('click', salvarProjeto);
  document.getElementById('btn-excluir').addEventListener('click', excluirProjeto);
  document.getElementById('btn-add-item').addEventListener('click', addItem);
  document.querySelectorAll('.mtab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
      if(tab.dataset.tab==='extraido'&&_projetoEd?.id) carregarExtraido(_projetoEd.id);
    });
  });

  // arquivos
  document.getElementById('inp-xlsx').addEventListener('change',e=>selecionarArquivo(e,'xlsx'));
  document.getElementById('inp-pptx').addEventListener('change',e=>selecionarArquivo(e,'pptx'));
  document.getElementById('btn-upload').addEventListener('click', uploadArquivos);
  document.getElementById('btn-download-arq').addEventListener('click', downloadArquivo);
  document.getElementById('btn-del-arq').addEventListener('click', deletarArquivo);

  // modal config
  document.getElementById('config-close').addEventListener('click', ()=>{ document.getElementById('modal-config').style.display='none'; });
  document.getElementById('config-cancelar').addEventListener('click', ()=>{ document.getElementById('modal-config').style.display='none'; });
  document.getElementById('btn-salvar-config').addEventListener('click', salvarConfig);
  document.getElementById('btn-add-grupo').addEventListener('click', ()=>adicionarConfigItem('grupos'));
  document.getElementById('btn-add-planta').addEventListener('click', ()=>adicionarConfigItem('plantas'));
}

// ══════════════════════════════════════════
// PROCESSAR DADOS
// ══════════════════════════════════════════
function _processar() {
  _plantas = (_dados?.plantas||[]).filter(p=>p.ativo!==false);
  if(!_plantas.length) _plantas = [{id:'betim',nome:'Betim'},{id:'goiania_pe',nome:'Goiania-PE'},{id:'porto_real',nome:'Porto Real'},{id:'cordoba',nome:'Cordoba'},{id:'palomar',nome:'Palomar'}];

  // extrair grupos únicos dos projetos (campo categoria)
  const gruposSet = new Set(_dados?.projetos?.map(p=>p.categoria).filter(Boolean));
  _grupos = [...gruposSet].map(g=>({id:g.toLowerCase().replace(/\s/g,'_'),nome:g}));
  if(!_grupos.length) _grupos = GRUPOS_PADRAO.map(g=>({id:g.toLowerCase().replace(/\s/g,'_'),nome:g}));

  renderTudo();
}

function _filtrarProjetos() {
  const ano    = document.getElementById('sel-ano').value;
  const status = document.getElementById('sel-status').value;
  const busca  = document.getElementById('inp-busca').value.toLowerCase().trim();
  return (_dados?.projetos||[]).filter(p=>{
    if(ano    && String(p.ano_orcamento)!==ano)       return false;
    if(status && p.status!==status)                   return false;
    if(busca  && !`${p.titulo} ${p.responsavel} ${p.categoria}`.toLowerCase().includes(busca)) return false;
    if(_plantaFiltro !== 'all' && p.planta_id !== _plantaFiltro) return false;
    return true;
  });
}

function _atualizarTotais(lista) {
  const sol = lista.reduce((s,p)=>s+_toBRL(p.valor_solicitado||0, p.moeda),0);
  const apr = lista.reduce((s,p)=>s+_toBRL(p.valor_aprovado||0,   p.moeda),0);
  document.getElementById('tot-qtd').textContent = lista.length;
  document.getElementById('tot-sol').textContent = fmtR(sol);
  document.getElementById('tot-apr').textContent = fmtR(apr);
}

// ══════════════════════════════════════════
// RENDER GERAL
// ══════════════════════════════════════════
function renderTudo() {
  renderPills();
  renderMatriz();
}

function renderAtivo() {
  renderMatriz();
  // se dashboard visível, atualiza
  if(document.getElementById('pane-dashboard').classList.contains('active')) renderDashboard();
}

// ══════════════════════════════════════════
// PILLS DE PLANTA
// ══════════════════════════════════════════
function renderPills() {
  const wrap = document.getElementById('plantas-pills');
  wrap.innerHTML = `<button class="planta-pill planta-all ${_plantaFiltro==='all'?'active':''}" data-id="all">Todas</button>`;
  _plantas.forEach(pl=>{
    wrap.innerHTML += `<button class="planta-pill ${_plantaFiltro===pl.id?'active':''}" data-id="${pl.id}">${pl.nome}</button>`;
  });
  wrap.querySelectorAll('.planta-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      _plantaFiltro = btn.dataset.id;
      renderPills();
      renderMatriz();
    });
  });
}

// ══════════════════════════════════════════
// RENDER MATRIZ
// ══════════════════════════════════════════
function renderMatriz() {
  const lista = _filtrarProjetos();
  _atualizarTotais(lista);

  // plantas a mostrar
  const plantas = _plantaFiltro==='all' ? _plantas : _plantas.filter(pl=>pl.id===_plantaFiltro);

  // thead
  const thead = document.getElementById('matriz-thead');
  thead.innerHTML = `<tr>
    <th style="min-width:220px">Projeto</th>
    <th style="min-width:100px">Status</th>
    ${plantas.map(pl=>`<th class="th-planta">${pl.nome}</th>`).join('')}
    <th style="width:40px"></th>
  </tr>`;

  // agrupar projetos por grupo (categoria)
  const gruposOrdem = _grupos.map(g=>g.nome);
  const semGrupo = lista.filter(p=>!gruposOrdem.includes(p.categoria));
  const grupos = _grupos.map(g=>({
    ...g,
    projetos: lista.filter(p=>p.categoria===g.nome)
  })).filter(g=>g.projetos.length>0);
  if(semGrupo.length) grupos.push({id:'_outros',nome:'Outros',projetos:semGrupo});

  // tbody
  const tbody = document.getElementById('matriz-tbody');
  if(!lista.length) {
    tbody.innerHTML = `<tr><td colspan="${2+plantas.length+1}" style="text-align:center;padding:40px;color:var(--text-muted)">Nenhum projeto encontrado. Clique em "+ Novo Projeto".</td></tr>`;
    document.getElementById('matriz-tfoot').innerHTML='';
    return;
  }

  let html = '';
  grupos.forEach(g=>{
    html += `<tr class="grupo-row">
      <td colspan="${2+plantas.length}">${g.nome}</td>
      <td class="grupo-actions"><button class="btn-add-proj" onclick="abrirNovoNoGrupo('${esc(g.nome)}')">+ Projeto</button></td>
    </tr>`;
    g.projetos.forEach(p=>{
      const arq = (p.arquivos||[])[0];
      html += `<tr class="proj-row">
        <td>
          <div class="proj-nome">${esc(p.titulo||'(sem título)')}</div>
          <div class="proj-resp">${esc(p.responsavel||'')} ${arq?'📎':''}</div>
        </td>
        <td><span class="badge badge-${esc(p.status||'Rascunho')}">${p.status||'Rascunho'}</span></td>
        ${plantas.map(pl=>{
          const match = p.planta_id===pl.id;
          if(match) {
            const sol    = p.valor_solicitado||0;
            const apr    = p.valor_aprovado||0;
            const solBRL = _toBRL(sol, p.moeda);
            const itensHtml = (p.itens||[]).slice(0,3).map(it=>
              `<div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">${esc(it.descricao||'')} — ${fmtR((it.quantidade||1)*(it.preco_unitario||0), it.moeda)}</div>`
            ).join('');
            return `<td class="cell-planta">
              <div class="cell-inner">
                <div class="cell-valor">${fmtR(solBRL)}</div>
                ${p.moeda && p.moeda !== 'BRL' ? `<div style="font-size:10px;color:var(--text-muted);font-family:var(--mono)">${p.moeda} ${sol.toLocaleString('pt-BR')} · ${_fmtCambio(p.moeda)}</div>` : ''}
                <div class="cell-badges">
                  ${arq?'<span class="cell-badge cb-op">OP</span>':''}
                  ${apr>0?'<span class="cell-badge cb-orc">ORC</span>':''}
                </div>
              </div>
              ${itensHtml}
            </td>`;
          } else {
            return `<td class="cell-planta"><div class="cell-inner"><span class="cell-valor empty">—</span></div></td>`;
          }
        }).join('')}
        <td style="text-align:center">
          <button class="btn-sm" onclick="abrirEditar('${p.id}')">✏</button>
        </td>
      </tr>`;
    });
  });
  tbody.innerHTML = html;


  const tfoot = document.getElementById('matriz-tfoot');
  const totPlanta = plantas.map(pl=>{
    const s = lista.filter(p=>p.planta_id===pl.id).reduce((a,p)=>a+_toBRL(p.valor_solicitado||0, p.moeda),0);
    return `<td class="cell-planta" style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--blue);text-align:center">${fmtR(s)}</td>`;
  }).join('');
  tfoot.innerHTML = `<tr class="total-row">
    <td colspan="2">TOTAL</td>
    ${totPlanta}
    <td></td>
  </tr>`;
}

// ══════════════════════════════════════════
// DASHBOARD — GRÁFICOS
// ══════════════════════════════════════════
function renderDashboard() {
  const lista = _filtrarProjetos();
  const sol = lista.reduce((s,p)=>s+(p.valor_solicitado||0),0);
  const apr = lista.reduce((s,p)=>s+(p.valor_aprovado||0),0);
  const aprov = lista.filter(p=>p.status==='Aprovado'||p.status==='Concluído'||p.status==='Em Execução').length;

  document.getElementById('kpi-total').textContent = lista.length;
  document.getElementById('kpi-sol').textContent   = fmtR(lista.reduce((s,p)=>s+_toBRL(p.valor_solicitado||0, p.moeda),0));
  document.getElementById('kpi-apr').textContent   = fmtR(lista.reduce((s,p)=>s+_toBRL(p.valor_aprovado||0,   p.moeda),0));
  document.getElementById('kpi-taxa').textContent  = lista.length ? Math.round(aprov/lista.length*100)+'%' : '0%';

  // cores
  const CORES = ['#243782','#2E5FA3','#3a6bc7','#6b8fd4','#9db5e6','#c5d4f0'];
  const CORES_STATUS = {
    'Rascunho':'#d0d8e8','Em Análise':'#b07d00','Aprovado':'#1a7f4b',
    'Reprovado':'#c0392b','Em Execução':'#2E5FA3','Concluído':'#4ade80'
  };

  // 1. Barras por planta
  const dadosPlantas = _plantas.map(pl=>({
    nome: pl.nome,
    sol:  lista.filter(p=>p.planta_id===pl.id).reduce((a,p)=>a+_toBRL(p.valor_solicitado||0, p.moeda),0),
    apr:  lista.filter(p=>p.planta_id===pl.id).reduce((a,p)=>a+_toBRL(p.valor_aprovado||0,   p.moeda),0),
  }));
  _renderChart('chart-plantas','bar',{
    labels: dadosPlantas.map(d=>d.nome),
    datasets:[
      { label:'Solicitado', data:dadosPlantas.map(d=>d.sol), backgroundColor:'#3a6bc7', borderRadius:4 },
      { label:'Aprovado',   data:dadosPlantas.map(d=>d.apr), backgroundColor:'#1a7f4b', borderRadius:4 },
    ]
  },{
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ position:'top', labels:{ font:{size:11}, boxWidth:12 } } },
    scales:{ y:{ ticks:{ callback:v=>fmtR(v), font:{size:10} }, grid:{ color:'#e8edf5' } }, x:{ grid:{display:false} } }
  });

  // 2. Donut status
  const statusMap = {};
  lista.forEach(p=>{ statusMap[p.status||'Rascunho']=(statusMap[p.status||'Rascunho']||0)+1; });
  const statusLabels = Object.keys(statusMap);
  _renderChart('chart-status','doughnut',{
    labels: statusLabels,
    datasets:[{ data:statusLabels.map(s=>statusMap[s]), backgroundColor:statusLabels.map(s=>CORES_STATUS[s]||'#d0d8e8'), borderWidth:2, borderColor:'#fff' }]
  },{
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ position:'right', labels:{ font:{size:11}, boxWidth:12 } } },
    cutout:'65%'
  });

  // 3. Barras horizontais por grupo
  const dadosGrupos = _grupos.map(g=>({
    nome: g.nome,
    sol:  lista.filter(p=>p.categoria===g.nome).reduce((a,p)=>a+_toBRL(p.valor_solicitado||0, p.moeda),0),
    apr:  lista.filter(p=>p.categoria===g.nome).reduce((a,p)=>a+_toBRL(p.valor_aprovado||0,   p.moeda),0),
  })).filter(d=>d.sol>0||d.apr>0);
  _renderChart('chart-grupos','bar',{
    labels: dadosGrupos.map(d=>d.nome),
    datasets:[
      { label:'Solicitado', data:dadosGrupos.map(d=>d.sol), backgroundColor:'#3a6bc7', borderRadius:4 },
      { label:'Aprovado',   data:dadosGrupos.map(d=>d.apr), backgroundColor:'#1a7f4b', borderRadius:4 },
    ]
  },{
    responsive:true, maintainAspectRatio:false, indexAxis:'y',
    plugins:{ legend:{ position:'top', labels:{ font:{size:11}, boxWidth:12 } } },
    scales:{ x:{ ticks:{ callback:v=>fmtR(v), font:{size:10} }, grid:{ color:'#e8edf5' } }, y:{ grid:{display:false} } }
  });
}

function _renderChart(id, type, data, options) {
  const canvas = document.getElementById(id);
  if(!canvas) return;
  if(_charts[id]) { _charts[id].destroy(); }
  _charts[id] = new Chart(canvas.getContext('2d'), { type, data, options });
}

// ══════════════════════════════════════════
// MODAL PROJETO
// ══════════════════════════════════════════
function _popularSelects() {
  const fg = document.getElementById('f-grupo');
  const fp = document.getElementById('f-planta');
  fg.innerHTML = '<option value="">Selecionar...</option>' + _grupos.map(g=>`<option value="${esc(g.nome)}">${g.nome}</option>`).join('');
  fp.innerHTML = '<option value="">Selecionar...</option>' + _plantas.map(p=>`<option value="${esc(p.id)}">${p.nome}</option>`).join('');
}

function abrirNovo() {
  _projetoEd = { id:uid(), planta_id:'', categoria:'', titulo:'', descricao:'', ano_orcamento:new Date().getFullYear()+1, responsavel:'', status:'Rascunho', prioridade:'Média', valor_solicitado:0, valor_aprovado:0, moeda:'BRL', justificativa:'', retorno_previsto:'', obs:'', itens:[], arquivos:[] };
  _itensEd = [];
  _arquivoLocal = { xlsx:null, pptx:null };
  _popularSelects();
  _preencherModal();
  document.getElementById('btn-excluir').style.display='none';
  document.getElementById('modal-ttl').textContent='Novo Projeto CAPEX';
  document.getElementById('modal').style.display='flex';
}

window.abrirNovoNoGrupo = function(grupo) {
  abrirNovo();
  document.getElementById('f-grupo').value = grupo;
  _projetoEd.categoria = grupo;
};

window.abrirEditar = function(id) {
  const p = (_dados?.projetos||[]).find(x=>x.id===id);
  if(!p) return;
  _projetoEd = JSON.parse(JSON.stringify(p));
  _itensEd   = JSON.parse(JSON.stringify(p.itens||[]));
  _arquivoLocal = { xlsx:null, pptx:null };
  _popularSelects();
  _preencherModal();
  document.getElementById('btn-excluir').style.display='inline-block';
  document.getElementById('modal-ttl').textContent='Editar — '+(p.titulo||'Projeto');
  document.getElementById('modal').style.display='flex';
};

function _preencherModal() {
  const p = _projetoEd;
  document.getElementById('f-grupo').value       = p.categoria||'';
  document.getElementById('f-planta').value      = p.planta_id||'';
  document.getElementById('f-ano').value         = p.ano_orcamento||'';
  document.getElementById('f-status').value      = p.status||'Rascunho';
  document.getElementById('f-prioridade').value  = p.prioridade||'Média';
  document.getElementById('f-titulo').value      = p.titulo||'';
  document.getElementById('f-responsavel').value = p.responsavel||'';
  document.getElementById('f-descricao').value   = p.descricao||'';
  document.getElementById('f-val-sol').value     = p.valor_solicitado||0;
  document.getElementById('f-val-apr').value     = p.valor_aprovado||0;
  document.getElementById('f-moeda').value       = p.moeda||'BRL';
  document.getElementById('f-retorno').value     = p.retorno_previsto||'';
  document.getElementById('f-justificativa').value = p.justificativa||'';
  document.getElementById('f-obs').value         = p.obs||'';
  // reset tabs
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(t=>t.classList.remove('active'));
  document.querySelector('.mtab[data-tab="geral"]').classList.add('active');
  document.getElementById('tab-geral').classList.add('active');
  renderItens();
  renderArquivos();
  document.getElementById('extraido-wrap').innerHTML='<div class="extraido-vazio">Clique na aba para carregar.</div>';
}

function fecharModal() { document.getElementById('modal').style.display='none'; _projetoEd=null; }

async function salvarProjeto() {
  const p = _projetoEd;
  p.categoria         = document.getElementById('f-grupo').value;
  p.planta_id         = document.getElementById('f-planta').value;
  p.ano_orcamento     = parseInt(document.getElementById('f-ano').value)||new Date().getFullYear()+1;
  p.status            = document.getElementById('f-status').value;
  p.prioridade        = document.getElementById('f-prioridade').value;
  p.titulo            = document.getElementById('f-titulo').value.trim();
  p.responsavel       = document.getElementById('f-responsavel').value.trim();
  p.descricao         = document.getElementById('f-descricao').value.trim();
  p.valor_solicitado  = parseFloat(document.getElementById('f-val-sol').value)||0;
  p.valor_aprovado    = parseFloat(document.getElementById('f-val-apr').value)||0;
  p.moeda             = document.getElementById('f-moeda').value;
  p.retorno_previsto  = document.getElementById('f-retorno').value.trim();
  p.justificativa     = document.getElementById('f-justificativa').value.trim();
  p.obs               = document.getElementById('f-obs').value.trim();
  p.itens             = _itensEd;

  if(!p.titulo)    { alert('Informe o título do projeto.'); return; }
  if(!p.planta_id) { alert('Selecione uma planta.'); return; }
  if(!p.categoria) { alert('Selecione um grupo.'); return; }

  setSaveStatus('saving','salvando...');
  try {
    await CAPEX_API.salvar(p);
    CAPEX_API.invalida();
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    _processar();
    setSaveStatus('saved','salvo');
    fecharModal();
    setTimeout(()=>setSaveStatus('nosave','sem alterações'),3000);
  } catch(e) {
    setSaveStatus('error','erro ao salvar');
    alert('Erro: '+e.message);
  }
}

async function excluirProjeto() {
  if(!confirm('Excluir este projeto? Esta ação não pode ser desfeita.')) return;
  try {
    await CAPEX_API.excluir(_projetoEd.id);
    CAPEX_API.invalida();
    const fresh = await CAPEX_API.listar();
    _dados = fresh;
    _processar();
    fecharModal();
  } catch(e) { alert('Erro: '+e.message); }
}

// ══════════════════════════════════════════
// ITENS
// ══════════════════════════════════════════
function renderItens() {
  const tbody = document.getElementById('itens-body');
  if(!_itensEd.length) {
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--text-muted)">Nenhum item. Clique em "+ Item".</td></tr>';
    document.getElementById('itens-total').textContent='Total: R$ 0,00';
    return;
  }
  tbody.innerHTML = _itensEd.map((it,i)=>`
    <tr data-idx="${i}">
      <td><input value="${esc(it.descricao)}"    onchange="editItem(${i},'descricao',this.value)"   placeholder="Descrição"></td>
      <td><input value="${esc(it.categoria)}"    onchange="editItem(${i},'categoria',this.value)"   placeholder="Categoria"></td>
      <td><input value="${esc(it.fornecedor)}"   onchange="editItem(${i},'fornecedor',this.value)"  placeholder="Fornecedor"></td>
      <td><input class="num" type="number" value="${it.quantidade||1}" onchange="editItem(${i},'quantidade',+this.value)" style="width:60px"></td>
      <td><input value="${esc(it.unidade)}"      onchange="editItem(${i},'unidade',this.value)"     placeholder="un" style="width:48px"></td>
      <td><input class="num" type="number" value="${it.preco_unitario||0}" onchange="editItem(${i},'preco_unitario',+this.value)" style="width:100px"></td>
      <td class="num">${fmtR((it.quantidade||1)*(it.preco_unitario||0))}</td>
      <td><button class="btn-rm-item" onclick="rmItem(${i})">×</button></td>
    </tr>`).join('');
  const total = _itensEd.reduce((s,it)=>s+(it.quantidade||1)*(it.preco_unitario||0),0);
  document.getElementById('itens-total').textContent='Total: '+fmtR(total);
}

window.editItem = function(idx,campo,valor) {
  _itensEd[idx][campo]=valor;
  const total=(_itensEd[idx].quantidade||1)*(_itensEd[idx].preco_unitario||0);
  const cells=document.querySelectorAll(`[data-idx="${idx}"] td.num`);
  if(cells[0]) cells[0].textContent=fmtR(total);
  const gt=_itensEd.reduce((s,it)=>s+(it.quantidade||1)*(it.preco_unitario||0),0);
  document.getElementById('itens-total').textContent='Total: '+fmtR(gt);
};

function addItem() {
  _itensEd.push({id:uid(),descricao:'',categoria:'',fornecedor:'',quantidade:1,unidade:'un',preco_unitario:0,moeda:'BRL',obs:''});
  renderItens();
}

window.rmItem = function(idx) { _itensEd.splice(idx,1); renderItens(); };

// ══════════════════════════════════════════
// ARQUIVOS
// ══════════════════════════════════════════
function renderArquivos() {
  const arq = (_projetoEd?.arquivos||[])[0];
  const ex  = document.getElementById('arq-existente');
  if(arq) {
    ex.style.display='flex';
    document.getElementById('arq-ex-nome').textContent = arq.nome||'arquivo.zip';
    document.getElementById('arq-ex-size').textContent = fmtBytes(arq.tamanho_bytes);
  } else { ex.style.display='none'; }
  document.getElementById('nome-xlsx').textContent='Nenhum arquivo';
  document.getElementById('nome-pptx').textContent='Nenhum arquivo';
  document.getElementById('btn-upload').disabled=true;
  document.getElementById('arq-status').textContent='';
}

function selecionarArquivo(e,tipo) {
  const f=e.target.files[0]; if(!f) return;
  _arquivoLocal[tipo]=f;
  document.getElementById('nome-'+tipo).textContent=f.name;
  document.getElementById('btn-upload').disabled=!(_arquivoLocal.xlsx||_arquivoLocal.pptx);
}

async function lerBase64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file); });
}

async function uploadArquivos() {
  if(!_projetoEd?.id) return;
  const btn=document.getElementById('btn-upload');
  const st=document.getElementById('arq-status');
  btn.disabled=true; st.textContent='Preparando...';
  try {
    const body={};
    if(_arquivoLocal.xlsx) { body.xlsx_b64=await lerBase64(_arquivoLocal.xlsx); body.xlsx_nome=_arquivoLocal.xlsx.name; }
    if(_arquivoLocal.pptx) { body.pptx_b64=await lerBase64(_arquivoLocal.pptx); body.pptx_nome=_arquivoLocal.pptx.name; }
    st.textContent='Salvando no Delta Lake...';
    const t0=performance.now();
    const res=await CAPEX_API.uploadArquivo(_projetoEd.id,body);
    st.textContent=`✓ Salvo em ${Math.round(performance.now()-t0)}ms${res.extraindo?' — extração em background':''}`;
    CAPEX_API.invalida();
    const fresh=await CAPEX_API.listar();
    _dados=fresh; _processar();
    _projetoEd=(_dados.projetos||[]).find(p=>p.id===_projetoEd.id)||_projetoEd;
    renderArquivos();
  } catch(e) { st.textContent='✗ Erro: '+e.message; btn.disabled=false; }
}

async function downloadArquivo() {
  if(!_projetoEd?.id) return;
  try {
    const res=await CAPEX_API.downloadArquivo(_projetoEd.id);
    if(!res.zip_b64) { alert('Arquivo não encontrado.'); return; }
    const bin=atob(res.zip_b64); const arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([arr],{type:'application/zip'}));
    const a=document.createElement('a'); a.href=url; a.download=res.nome||'capex.zip'; a.click();
    URL.revokeObjectURL(url);
  } catch(e) { alert('Erro: '+e.message); }
}

async function deletarArquivo() {
  if(!confirm('Remover arquivo do Delta Lake?')) return;
  try {
    await fetch('/api/capex/projetos/'+_projetoEd.id+'/arquivo',{method:'DELETE',headers:{'X-Ctrl-Token':localStorage.getItem('ctrl-token')||''}});
    CAPEX_API.invalida();
    const fresh=await CAPEX_API.listar();
    _dados=fresh; _processar();
    _projetoEd=(_dados.projetos||[]).find(p=>p.id===_projetoEd.id)||_projetoEd;
    renderArquivos();
  } catch(e) { alert('Erro: '+e.message); }
}

async function carregarExtraido(pid) {
  const wrap=document.getElementById('extraido-wrap');
  wrap.innerHTML='<div class="extraido-vazio">Carregando...</div>';
  try {
    const res=await CAPEX_API.extraido(pid);
    if(!res.extraido) { wrap.innerHTML=`<div class="extraido-vazio">${res.status==='pendente'?'Extração em andamento... aguarde.':'Nenhum dado extraído.'}</div>`; return; }
    let html='';
    if(res.extraido.pptx?.slides?.length) {
      html+=`<div class="extraido-sec"><h3>One Pager — ${res.extraido.pptx.total_slides} slide(s)</h3>`;
      res.extraido.pptx.slides.forEach(s=>{ if(s.textos?.length) html+=`<div class="extraido-slide"><strong>Slide ${s.slide}</strong><ul>${s.textos.slice(0,6).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`; });
      html+='</div>';
    }
    if(res.extraido.xlsx?.itens_principais?.length) {
      const itens=res.extraido.xlsx.itens_principais.slice(0,40);
      const cols=Object.keys(itens[0]||{}).slice(0,8);
      html+=`<div class="extraido-sec"><h3>Excel — ${itens.length} linha(s)</h3>
        <table class="extraido-tbl"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${itens.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c]!=null?String(r[c]):'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    wrap.innerHTML=html||'<div class="extraido-vazio">Nenhum conteúdo reconhecido.</div>';
  } catch(e) { wrap.innerHTML='<div class="extraido-vazio">Erro ao carregar.</div>'; }
}

// ══════════════════════════════════════════
// CONFIG — GRUPOS & PLANTAS
// ══════════════════════════════════════════
function abrirConfig() {
  _renderConfigLista('grupos', _grupos);
  _renderConfigLista('plantas', _plantas);
  document.getElementById('modal-config').style.display='flex';
}

function _renderConfigLista(tipo, lista) {
  const el=document.getElementById(tipo+'-list');
  el.innerHTML=lista.map((item,i)=>`
    <div class="config-item" data-tipo="${tipo}" data-idx="${i}">
      <input value="${esc(item.nome)}" placeholder="Nome..." data-field="nome">
      <button class="config-item-del" onclick="removerConfigItem('${tipo}',${i})">×</button>
    </div>`).join('');
}

function adicionarConfigItem(tipo) {
  if(tipo==='grupos') { _grupos.push({id:uid(),nome:''}); _renderConfigLista('grupos',_grupos); }
  else { _plantas.push({id:uid(),nome:'',ativo:true}); _renderConfigLista('plantas',_plantas); }
}

window.removerConfigItem = function(tipo,idx) {
  if(tipo==='grupos') { _grupos.splice(idx,1); _renderConfigLista('grupos',_grupos); }
  else { _plantas.splice(idx,1); _renderConfigLista('plantas',_plantas); }
};

async function salvarConfig() {
  // ler valores editados
  document.querySelectorAll('#grupos-list .config-item').forEach((el,i)=>{
    const v=el.querySelector('input').value.trim();
    if(_grupos[i]) { _grupos[i].nome=v; _grupos[i].id=v.toLowerCase().replace(/\s/g,'_'); }
  });
  document.querySelectorAll('#plantas-list .config-item').forEach((el,i)=>{
    const v=el.querySelector('input').value.trim();
    if(_plantas[i]) { _plantas[i].nome=v; }
  });
  _grupos  = _grupos.filter(g=>g.nome.trim());
  _plantas = _plantas.filter(p=>p.nome.trim());

  try {
    // salvar plantas no servidor
    for(const pl of _plantas) {
      await CAPEX_API.salvarPlanta(pl);
    }
    CAPEX_API.invalida();
    const fresh=await CAPEX_API.listar();
    _dados=fresh; _processar();
    document.getElementById('modal-config').style.display='none';
  } catch(e) { alert('Erro ao salvar: '+e.message); }
}

// ══════════════════════════════════════════
// START
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);