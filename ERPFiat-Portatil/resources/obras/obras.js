window.onerror = function(msg, src, line, col, err) {
  var bar = document.getElementById('debug-bar');
  if(bar){ bar.style.display='block'; bar.textContent += 'ERRO linha '+line+': '+msg+'\n'; }
};
window.addEventListener('unhandledrejection', function(e){
  var bar = document.getElementById('debug-bar');
  if(bar){ bar.style.display='block'; bar.textContent += 'PROMISE: '+(e.reason?.stack||e.reason)+'\n'; }
});
'use strict';
let state = {
  obras: [], budget: [], lancamentos: [], revisoes: [],
  central: { pessoas: [], cresp: [], tiposObra: [], categoriasCusto: [], leitores: [] },
  editIdx: { obra: -1, lanc: -1, budget: -1, rev: -1, cresp: -1, etapa: -1 },
  obraAtiva: null  
};
let saveTimeout = null, centralSaveTimeout = null;
const $ = id => document.getElementById(id);
const fmt = (v, dec=0) => (v||0).toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const fmtR = v => 'R$ '+fmt(v,2);
const fmtD = s => s ? s.split('-').reverse().join('/') : '—';
const hoje = () => new Date().toISOString().slice(0,10);
const clamp = (v,min,max) => Math.min(Math.max(v,min),max);
async function salvarCentral() {
  if (typeof API === 'undefined') return;
  try {
    await API.hub.config.salvar({
      pessoas:         state.central.pessoas,
      cresp:           state.central.cresp,
      tiposObra:       state.central.tiposObra,
      categoriasCusto: state.central.categoriasCusto,
      leitores:        state.central.leitores,
    });
  } catch (err) {
    setSaveStatus('error', 'Erro ao salvar configurações: ' + err.message);
    console.error('salvarCentral falhou:', err);
  }
}
function abrirDB(){ return Promise.resolve(); }

function setSaveStatus(s,txt){ const el=$('save-status'); el.className='save-status '+s; $('save-txt').textContent=txt||s; }
function gerarId(prefix,arr,campo){ let n=arr.length+1; while(arr.find(x=>x[campo]===`${prefix}-${String(n).padStart(3,'0')}`))n++; return `${prefix}-${String(n).padStart(3,'0')}`; }
function realizado(obraCod){ return state.lancamentos.filter(l=>l.obraCod===obraCod).reduce((s,l)=>s+(l.qtd*l.precoUnit),0); }
function budgetObra(obraCod){ return state.budget.filter(b=>b.obraCod===obraCod).reduce((s,b)=>s+(b.budgetAprov||0),0); }
function totalRealizado(){ return state.lancamentos.reduce((s,l)=>s+(l.qtd*l.precoUnit),0); }
function totalBudget(){ return state.budget.reduce((s,b)=>s+(b.budgetAprov||0),0); }
function avancFisico(obraCod){
  const o = state.obras.find(x=>x.cod===obraCod);
  if(!o || !o.etapas || !o.etapas.length) return 0;
  const total = o.etapas.reduce((s,e)=>s+(e.peso||1),0);
  const exec = o.etapas.reduce((s,e)=>s+((e.peso||1)*(e.avancoFisico||0)/100),0);
  return total>0?(exec/total)*100:0;
}
function badgeStatus(s){ const map={'Em Andamento':'badge-orange','Planejado':'badge-blue','Concluído':'badge-green','Suspenso':'badge-red'}; return `<span class="badge ${map[s]||'badge-muted'}">${s}</span>`; }
function badgeBudget(pct){ if(pct>=100)return'badge-red'; if(pct>=85)return'badge-yellow'; return'badge-green'; }
function progressBar(pct,cor){ const cls=cor||(pct>=100?'red':pct>=85?'yellow':''); const p=Math.min(pct,100); return `<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill ${cls}" style="width:${p}%"></div></div><span class="progress-pct">${fmt(pct,1)}%</span></div>`; }
function carregarCentral(txt){
  try {
    const d=JSON.parse(txt);
    state.central.pessoas=Array.isArray(d.pessoas)?d.pessoas:[];
    state.central.cresp=Array.isArray(d.cresp)?d.cresp:[];
    state.central.tiposObra=Array.isArray(d.tiposObra)?d.tiposObra:['Banheiro','Escritório','Cozinha/Refeitório','Área Técnica','Fachada/Externo','Almoxarifado','Sala de Reunião','Laboratório','Área de Lazer','Outros'];
    state.central.categoriasCusto=Array.isArray(d.categoriasCusto)?d.categoriasCusto:[];
    state.central.leitores=Array.isArray(d.leitores)?d.leitores:[];
    return true;
  } catch(e){ console.error(e); return false; }
}
let _salvando = false;
async function salvarDados() {
  if (typeof API === 'undefined') return;
  if (_salvando) { agendarSalvamento(); return; }
  if (!state.obras.length && !state.lancamentos.length && !state.budget.length) return;
  _salvando = true;
  try {
    await API.obras.salvar({
      versao:       '2.0',
      obras:        state.obras,
      budget:       state.budget,
      lancamentos:  state.lancamentos,
      revisoes:     state.revisoes,
    });
    setSaveStatus('saved', 'salvo');
  } catch(err) {
    setSaveStatus('error', 'erro ao salvar');
    console.error('salvarDados falhou:', err);
  } finally {
    _salvando = false;
  }
}
function agendarSalvamento(){ setSaveStatus('saving','salvando…'); clearTimeout(saveTimeout); saveTimeout=setTimeout(()=>salvarDados(),400); }
function agendarSalvamentoCentral(){ clearTimeout(centralSaveTimeout); centralSaveTimeout=setTimeout(()=>salvarCentral(),400); }
function acquireLock(){}
function checkLock(){ return true; }
function aplicarFiltroURL(){
  const p = new URLSearchParams(location.search);
  const pane = p.get('page');
  const status = p.get('status');

  if(pane){
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(el => el.classList.remove('active'));
    const btn = document.querySelector(`.nav-item[data-pane="${pane}"]`);
    if(btn) btn.classList.add('active');
    const paneEl = document.getElementById('pane-' + pane);
    if(paneEl) paneEl.classList.add('active');
  }

  if(status && pane === 'obras'){
    const sel = document.getElementById('obras-filtro-status');
    if(sel){ sel.value = status; renderObras(); }
  }
}
function mostrarErroInicio(msg){ $('inicio-err').style.display='flex'; $('inicio-err-txt').textContent=msg; }
function iniciarApp(){ const ti=$('tela-inicio'); if(ti)ti.style.display='none'; $('app').style.display='block'; popularSelects(); renderTudo(); aplicarFiltroURL(); }
function popularSelects(){
  const tipos=state.central.tiposObra.length?state.central.tiposObra:['Banheiro','Escritório','Cozinha/Refeitório','Outros'];
  $('ob-tipo').innerHTML=tipos.map(t=>`<option>${t}</option>`).join('');
  const respOpts='<option value="">—</option>'+state.central.pessoas.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  $('ob-resp').innerHTML=respOpts;
  const crespOpts='<option value="">—</option>'+state.central.cresp.map(c=>`<option value="${c.id}">${c.id} — ${c.descricao}</option>`).join('');
  ['ob-cresp','lanc-cresp','bgt-cresp','rev-cresp'].forEach(id=>{if($(id))$(id).innerHTML=crespOpts;});
  const obraOpts='<option value="">—</option>'+state.obras.map(o=>`<option value="${o.cod}">${o.cod} — ${o.nome}</option>`).join('');
  ['lanc-obra','bgt-obra','rev-obra'].forEach(id=>{if($(id))$(id).innerHTML=obraOpts;});
  $('lanc-filtro-obra').innerHTML='<option value="">Todas as obras</option>'+state.obras.map(o=>`<option value="${o.cod}">${o.cod}</option>`).join('');
  const cats=state.central.categoriasCusto;
  $('lanc-cat').innerHTML='<option value="">—</option>'+cats.map(c=>`<option>${c.categoria}</option>`).join('');
  $('lanc-filtro-cat').innerHTML='<option value="">Todas as categorias</option>'+cats.map(c=>`<option>${c.categoria}</option>`).join('');
  $('lanc-cat').onchange=()=>{
    const found=cats.find(c=>c.categoria===$('lanc-cat').value);
    $('lanc-subcat').innerHTML='<option value="">—</option>'+(found?found.subcategorias.map(s=>`<option>${s}</option>`).join(''):'');
  };
}
function renderDashboard(){
  const totalB=totalBudget(),totalR=totalRealizado(),saldo=totalB-totalR,pct=totalB>0?(totalR/totalB)*100:0;
  const andamento=state.obras.filter(o=>o.status==='Em Andamento').length;
  const avgFisico=state.obras.length?state.obras.reduce((s,o)=>s+avancFisico(o.cod),0)/state.obras.length:0;
  $('kpi-grid').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">TOTAL OBRAS</div><div class="kpi-val blue">${state.obras.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">EM ANDAMENTO</div><div class="kpi-val orange">${andamento}</div></div>
    <div class="kpi-card"><div class="kpi-label">CONCLUÍDAS</div><div class="kpi-val green">${state.obras.filter(o=>o.status==='Concluído').length}</div></div>
    <div class="kpi-card"><div class="kpi-label">BUDGET APROVADO</div><div class="kpi-val blue">${fmtR(totalB)}</div></div>
    <div class="kpi-card"><div class="kpi-label">TOTAL REALIZADO</div><div class="kpi-val yellow">${fmtR(totalR)}</div></div>
    <div class="kpi-card"><div class="kpi-label">SALDO DISPONÍVEL</div><div class="kpi-val ${saldo<0?'red':'green'}">${fmtR(saldo)}</div></div>`;
  const tbody=$('dash-tbody');
  if(!state.obras.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">nenhuma obra cadastrada</td></tr>';$('dash-tfoot').innerHTML='';return;}
  let tB=0,tR=0;
  tbody.innerHTML=state.obras.map(o=>{
    const b=budgetObra(o.cod),r=realizado(o.cod),sal=b-r,p=b>0?(r/b)*100:0,af=avancFisico(o.cod);
    tB+=b;tR+=r;
    const desvio=af-p; 
    return `<tr style="cursor:pointer" onclick="abrirDetalheObra('${o.cod}')">
      <td><span style="font-family:var(--mono);font-size:11px">${o.cod}</span></td>
      <td><strong>${o.nome}</strong></td>
      <td><span class="badge badge-muted">${o.tipo}</span></td>
      <td><span class="badge badge-blue">${o.cresp}</span></td>
      <td>${badgeStatus(o.status)}</td>
      <td style="font-family:var(--mono);font-size:12px">${fmtR(b)}</td>
      <td style="font-family:var(--mono);font-size:12px">${fmtR(r)}</td>
      <td>${progressBar(p)}</td>
      <td>${progressBar(af,'blue')}</td>
      <td style="font-family:var(--mono);font-size:11px;color:${desvio<-10?'var(--red)':desvio>10?'var(--green)':'var(--text-muted)'}">${desvio>=0?'+':''}${fmt(desvio,1)}%</td>
    </tr>`;
  }).join('');
  const tSaldo=tB-tR;
  $('dash-tfoot').innerHTML=`<td colspan="5">TOTAL GERAL</td><td>${fmtR(tB)}</td><td>${fmtR(tR)}</td><td>${progressBar(tB>0?(tR/tB)*100:0)}</td><td colspan="2"></td>`;
  renderChartGastoMes(); renderChartBudgetVsReal(); renderChartDonut();
}
function abrirDetalheObra(cod){
  state.obraAtiva = cod;
  const o = state.obras.find(x=>x.cod===cod);
  if(!o) return;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  $('pane-detalhe').classList.add('active');
  renderDetalheObra();
}
function renderDetalheObra(){
  const cod = state.obraAtiva;
  const o = state.obras.find(x=>x.cod===cod);
  if(!o){ $('pane-detalhe').innerHTML=''; return; }
  const b=budgetObra(cod), r=realizado(cod), sal=b-r, pct=b>0?(r/b)*100:0, af=avancFisico(cod);
  const resp=state.central.pessoas.find(p=>p.id===o.responsavel);
  $('detalhe-titulo').textContent = `${o.cod} — ${o.nome}`;
  $('detalhe-status').innerHTML = badgeStatus(o.status);
  $('detalhe-kpis').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">BUDGET</div><div class="kpi-val blue">${fmtR(b)}</div></div>
    <div class="kpi-card"><div class="kpi-label">REALIZADO</div><div class="kpi-val yellow">${fmtR(r)}</div></div>
    <div class="kpi-card"><div class="kpi-label">SALDO</div><div class="kpi-val ${sal<0?'red':'green'}">${fmtR(sal)}</div></div>
    <div class="kpi-card"><div class="kpi-label">% FINANCEIRO</div><div class="kpi-val ${pct>=100?'red':pct>=85?'yellow':'green'}">${fmt(pct,1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">AVANÇO FÍSICO</div><div class="kpi-val blue">${fmt(af,1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">RESPONSÁVEL</div><div class="kpi-val" style="font-size:13px">${resp?resp.nome:(o.respNome||'—')}</div></div>`;
  const abaAtiva = document.querySelector('.detalhe-tab.active')?.dataset.tab || 'lancamentos';
  renderAbaDetalhe(abaAtiva);
}
function renderAbaDetalhe(aba){
  document.querySelectorAll('.detalhe-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===aba));
  document.querySelectorAll('.detalhe-pane').forEach(p=>p.classList.toggle('active', p.id==='detalhe-'+aba));
  const cod = state.obraAtiva;
  if(aba==='lancamentos') renderDetalheLancamentos(cod);
  if(aba==='budget') renderDetalheBudget(cod);
  if(aba==='revisoes') renderDetalheRevisoes(cod);
  if(aba==='cronograma') renderCronograma(cod);
}
function renderDetalheLancamentos(cod){
  const lancamentos = state.lancamentos.filter(l=>l.obraCod===cod);
  const filtCat = $('detalhe-filtro-cat')?.value || '';
  const search = ($('detalhe-lanc-search')?.value||'').toLowerCase();
  const rows = lancamentos.filter(l=>
    (!filtCat||l.categoria===filtCat) &&
    (!search||l.descricao.toLowerCase().includes(search)||(l.fornecedor||'').toLowerCase().includes(search))
  );
  const total = rows.reduce((s,l)=>s+l.qtd*l.precoUnit,0);
  const tbody = $('detalhe-lanc-tbody');
  if(!rows.length){tbody.innerHTML='<tr class="empty-row"><td colspan="11">nenhum lançamento</td></tr>';$('detalhe-lanc-tfoot').innerHTML='';return;}
  tbody.innerHTML=rows.map(l=>{
    const idx=state.lancamentos.indexOf(l),tot=l.qtd*l.precoUnit;
    return `<tr>
      <td><span style="font-family:var(--mono);font-size:10px">${l.id}</span></td>
      <td><span class="badge badge-blue">${l.cresp}</span></td>
      <td>${l.categoria}</td>
      <td style="color:var(--text-muted);font-size:12px">${l.subcategoria||'—'}</td>
      <td>${l.descricao}</td>
      <td style="font-family:var(--mono);font-size:11px;text-align:center">${l.unid||'—'}</td>
      <td style="font-family:var(--mono);font-size:11px;text-align:right">${fmt(l.qtd,2)}</td>
      <td style="font-family:var(--mono);font-size:11px;text-align:right">${fmtR(l.precoUnit)}</td>
      <td style="font-family:var(--mono);font-size:12px;text-align:right;font-weight:600">${fmtR(tot)}</td>
      <td style="font-family:var(--mono);font-size:11px">${fmtD(l.dtLanc)}</td>
      <td><div class="row-actions">
        <button class="action-btn" onclick="editarLanc(${idx})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-btn danger" onclick="excluirLanc(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
  $('detalhe-lanc-tfoot').innerHTML=`<td colspan="8">TOTAL</td><td style="text-align:right;font-weight:600">${fmtR(total)}</td><td colspan="2"></td>`;
}
function renderDetalheBudget(cod){
  const budgets = state.budget.filter(b=>b.obraCod===cod);
  const tbody = $('detalhe-budget-tbody');
  if(!budgets.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">nenhum budget</td></tr>';return;}
  tbody.innerHTML=budgets.map((b,i)=>{
    const idx=state.budget.indexOf(b);
    const real=state.lancamentos.filter(l=>l.obraCod===cod&&l.cresp===b.cresp).reduce((s,l)=>s+l.qtd*l.precoUnit,0);
    const totalDisp=(b.budgetAprov||0)+(b.contingencia||0),saldo=totalDisp-real,pct=totalDisp>0?(real/totalDisp)*100:0;
    return `<tr>
      <td><span class="badge badge-blue">${b.cresp}</span></td>
      <td><span class="badge ${b.tipoVerba==='CAPEX'?'badge-yellow':'badge-blue'}">${b.tipoVerba}</span></td>
      <td style="font-family:var(--mono);font-size:12px">${fmtR(b.budgetAprov)}</td>
      <td style="font-family:var(--mono);font-size:12px">${fmtR(b.contingencia||0)}</td>
      <td style="font-family:var(--mono);font-size:12px">${fmtR(totalDisp)}</td>
      <td style="font-family:var(--mono);font-size:12px">${fmtR(real)}</td>
      <td>${progressBar(pct)}</td>
      <td style="font-family:var(--mono);font-size:12px;color:${saldo<0?'var(--red)':'var(--green)'}">${fmtR(saldo)}</td>
      <td><span class="badge ${badgeBudget(pct)}">${pct>=100?'ESTOURADO':pct>=85?'ATENÇÃO':'OK'}</span></td>
      <td><div class="row-actions">
        <button class="action-btn" onclick="editarBudget(${idx})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-btn danger" onclick="excluirBudget(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
}
function renderDetalheRevisoes(cod){
  const revisoes = state.revisoes.filter(r=>r.obraCod===cod);
  const tbody = $('detalhe-rev-tbody');
  if(!revisoes.length){tbody.innerHTML='<tr class="empty-row"><td colspan="8">nenhuma revisão</td></tr>';return;}
  tbody.innerHTML=revisoes.map((r,i)=>{
    const idx=state.revisoes.indexOf(r);
    return `<tr>
      <td style="font-family:var(--mono);text-align:center">${r.nRev}</td>
      <td><span class="badge badge-blue">${r.cresp}</span></td>
      <td style="font-family:var(--mono);font-size:11px">${fmtD(r.dataRevisao)}</td>
      <td style="font-family:var(--mono);font-size:12px">${fmtR(r.budgetAnterior)}</td>
      <td style="font-family:var(--mono);font-size:12px;color:${(r.valorAditivo||0)<0?'var(--red)':'var(--green)'}">${fmtR(r.valorAditivo)}</td>
      <td style="font-family:var(--mono);font-size:12px;font-weight:600">${fmtR((r.budgetAnterior||0)+(r.valorAditivo||0))}</td>
      <td>${r.motivo}</td>
      <td><button class="action-btn danger" onclick="excluirRevisao(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></td>
    </tr>`;
  }).join('');
}
function renderCronograma(cod){
  const o = state.obras.find(x=>x.cod===cod);
  if(!o) return;
  if(!o.etapas) o.etapas=[];
  const etapas = o.etapas;
  const b=budgetObra(cod), r=realizado(cod), af=avancFisico(cod), pct=b>0?(r/b)*100:0;
  const desvio=af-pct;
  $('crono-kpis').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">AVANÇO FÍSICO</div><div class="kpi-val blue">${fmt(af,1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">AVANÇO FINANCEIRO</div><div class="kpi-val yellow">${fmt(pct,1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">DESVIO (FÍS-FIN)</div><div class="kpi-val ${desvio<-10?'red':desvio>10?'green':'text-muted'}">${desvio>=0?'+':''}${fmt(desvio,1)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">ETAPAS</div><div class="kpi-val">${etapas.length}</div></div>`;
  $('crono-progresso').innerHTML=`
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px">
        <span>Avanço Físico</span><span>${fmt(af,1)}%</span>
      </div>
      <div class="progress-bar" style="height:14px"><div class="progress-fill blue" style="width:${Math.min(af,100)}%"></div></div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px">
        <span>Avanço Financeiro</span><span>${fmt(pct,1)}%</span>
      </div>
      <div class="progress-bar" style="height:14px"><div class="progress-fill ${pct>=100?'red':pct>=85?'yellow':''}" style="width:${Math.min(pct,100)}%"></div></div>
    </div>`;
  if(!etapas.length){
    $('crono-gantt').innerHTML='<div class="chart-empty" style="padding:32px;text-align:center;color:var(--text-muted)">Nenhuma etapa cadastrada. Adicione etapas abaixo.</div>';
  } else {
    const datas = etapas.flatMap(e=>[e.dtInicio,e.dtFim]).filter(Boolean).sort();
    const dtMin = datas[0]||hoje(), dtMax = datas[datas.length-1]||hoje();
    const msMin = new Date(dtMin).getTime(), msMax = new Date(dtMax).getTime();
    const range = Math.max(msMax-msMin, 1);
    const W=100; 
    $('crono-gantt').innerHTML=`
      <div style="overflow-x:auto">
        <div style="min-width:600px">
          <div style="display:grid;grid-template-columns:200px 1fr;gap:0;font-size:11px;margin-bottom:8px;color:var(--text-muted)">
            <div style="padding:4px 8px">ETAPA</div>
            <div style="padding:4px 8px;display:flex;justify-content:space-between"><span>${fmtD(dtMin)}</span><span>${fmtD(dtMax)}</span></div>
          </div>
          ${etapas.map((e,i)=>{
            const s=e.dtInicio?new Date(e.dtInicio).getTime():msMin;
            const f=e.dtFim?new Date(e.dtFim).getTime():msMax;
            const left=((s-msMin)/range)*100;
            const width=Math.max(((f-s)/range)*100,1);
            const af=e.avancoFisico||0;
            const resp=state.central.pessoas.find(p=>p.id===e.responsavel);
            return `<div style="display:grid;grid-template-columns:200px 1fr;gap:0;margin-bottom:6px;align-items:center">
              <div style="padding:4px 8px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${e.nome}">${e.nome}</div>
              <div style="position:relative;height:28px;background:var(--surface2);border-radius:4px">
                <div style="position:absolute;left:${left}%;width:${width}%;height:100%;background:var(--blue-mid);border-radius:4px;opacity:0.7"></div>
                <div style="position:absolute;left:${left}%;width:${width*af/100}%;height:100%;background:var(--blue-light);border-radius:4px;opacity:0.9"></div>
                <span style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:10px;font-family:var(--mono);color:var(--text)">${af}%</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }
  $('crono-tbody').innerHTML = etapas.length ? etapas.map((e,i)=>{
    const resp=state.central.pessoas.find(p=>p.id===e.responsavel);
    return `<tr>
      <td>${e.nome}</td>
      <td style="font-family:var(--mono);font-size:11px">${fmtD(e.dtInicio)}</td>
      <td style="font-family:var(--mono);font-size:11px">${fmtD(e.dtFim)}</td>
      <td>${resp?resp.nome:'—'}</td>
      <td style="font-family:var(--mono);font-size:11px;text-align:center">${e.peso||1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="range" min="0" max="100" value="${e.avancoFisico||0}" 
            style="flex:1;accent-color:var(--blue-light)"
            oninput="atualizarAvancoEtapa('${cod}',${i},this.value);this.nextElementSibling.textContent=this.value+'%'">
          <span style="font-family:var(--mono);font-size:11px;min-width:36px">${e.avancoFisico||0}%</span>
        </div>
      </td>
      <td><div class="row-actions">
        <button class="action-btn" onclick="editarEtapa('${cod}',${i})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-btn danger" onclick="excluirEtapa('${cod}',${i})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div></td>
    </tr>`;
  }).join('') : '<tr class="empty-row"><td colspan="7">nenhuma etapa cadastrada</td></tr>';
}
function atualizarAvancoEtapa(cod, idx, val){
  const o = state.obras.find(x=>x.cod===cod);
  if(!o||!o.etapas[idx]) return;
  o.etapas[idx].avancoFisico = parseInt(val);
  const af=avancFisico(cod), b=budgetObra(cod), r=realizado(cod), pct=b>0?(r/b)*100:0;
  agendarSalvamento();
  clearTimeout(window._cronoTimeout);
  window._cronoTimeout = setTimeout(()=>renderCronograma(cod), 500);
}
function editarEtapa(cod, idx){
  const o = state.obras.find(x=>x.cod===cod);
  const e = o?.etapas?.[idx];
  state.editIdx.etapa = idx;
  $('modal-etapa-title').textContent = e ? 'Editar Etapa' : 'Nova Etapa';
  $('etapa-nome').value = e?.nome||'';
  $('etapa-dt-inicio').value = e?.dtInicio||'';
  $('etapa-dt-fim').value = e?.dtFim||'';
  $('etapa-resp').value = e?.responsavel||'';
  $('etapa-peso').value = e?.peso||1;
  $('etapa-af').value = e?.avancoFisico||0;
  $('etapa-obs').value = e?.obs||'';
  abrirModal('modal-etapa');
}
function excluirEtapa(cod, idx){
  if(!confirm('Excluir esta etapa?')) return;
  const o = state.obras.find(x=>x.cod===cod);
  if(o?.etapas) o.etapas.splice(idx,1);
  agendarSalvamento();
  renderCronograma(cod);
}
function renderObras(){
  const search=($('obras-search').value||'').toLowerCase(),filtSt=$('obras-filtro-status').value;
  const rows=state.obras.filter(o=>(!search||o.cod.toLowerCase().includes(search)||o.nome.toLowerCase().includes(search))&&(!filtSt||o.status===filtSt));
  const tbody=$('obras-tbody');
  if(!rows.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">nenhuma obra encontrada</td></tr>';return;}
  tbody.innerHTML=rows.map(o=>{
    const idx=state.obras.indexOf(o),resp=state.central.pessoas.find(p=>p.id===o.responsavel);
    const af=avancFisico(o.cod);
    return `<tr>
      <td><span style="font-family:var(--mono);font-size:11px">${o.cod}</span></td>
      <td><a href="#" onclick="abrirDetalheObra('${o.cod}');return false;" style="color:var(--blue-light)">${o.nome}</a></td>
      <td><span class="badge badge-muted">${o.tipo||'—'}</span></td>
      <td>${o.local||'—'}</td>
      <td>${resp?resp.nome:(o.respNome||'—')}</td>
      <td><span class="badge badge-blue">${o.cresp||'—'}</span></td>
      <td>${badgeStatus(o.status)}</td>
      <td>${progressBar(af,'blue')}</td>
      <td style="font-family:var(--mono);font-size:11px">${fmtD(o.dtFimPrev)}</td>
      <td><div class="row-actions">
        <button class="action-btn" onclick="editarObra(${idx})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="action-btn danger" onclick="excluirObra(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
      </div></td>
    </tr>`;
  }).join('');
}
function renderLancamentos(){
  const search=($('lanc-search').value||'').toLowerCase(),filtObra=$('lanc-filtro-obra').value,filtCat=$('lanc-filtro-cat').value;
  const rows=state.lancamentos.filter(l=>(!search||l.descricao.toLowerCase().includes(search)||(l.fornecedor||'').toLowerCase().includes(search))&&(!filtObra||l.obraCod===filtObra)&&(!filtCat||l.categoria===filtCat));
  const tbody=$('lanc-tbody');let total=0;
  if(!rows.length){tbody.innerHTML='<tr class="empty-row"><td colspan="13">nenhum lançamento</td></tr>';$('lanc-tfoot').innerHTML='';return;}
  tbody.innerHTML=rows.map(l=>{ const idx=state.lancamentos.indexOf(l),tot=l.qtd*l.precoUnit;total+=tot; return `<tr><td><span style="font-family:var(--mono);font-size:10px">${l.id}</span></td><td><span class="badge badge-muted">${l.obraCod}</span></td><td><span class="badge badge-blue">${l.cresp}</span></td><td>${l.categoria}</td><td style="color:var(--text-muted);font-size:12px">${l.subcategoria||'—'}</td><td>${l.descricao}</td><td style="font-family:var(--mono);font-size:11px;text-align:center">${l.unid||'—'}</td><td style="font-family:var(--mono);font-size:11px;text-align:right">${fmt(l.qtd,2)}</td><td style="font-family:var(--mono);font-size:11px;text-align:right">${fmtR(l.precoUnit)}</td><td style="font-family:var(--mono);font-size:12px;text-align:right;font-weight:600">${fmtR(tot)}</td><td style="font-family:var(--mono);font-size:11px">${l.nfDoc||'—'}</td><td style="font-family:var(--mono);font-size:11px">${fmtD(l.dtLanc)}</td><td><div class="row-actions"><button class="action-btn" onclick="editarLanc(${idx})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="action-btn danger" onclick="excluirLanc(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td></tr>`; }).join('');
  $('lanc-tfoot').innerHTML=`<td colspan="9">TOTAL</td><td style="text-align:right">${fmtR(total)}</td><td colspan="3"></td>`;
}
function renderBudget(){
  const tbody=$('budget-tbody');
  if(!state.budget.length){tbody.innerHTML='<tr class="empty-row"><td colspan="13">nenhum budget</td></tr>';$('budget-tfoot').innerHTML='';return;}
  let tB=0,tC=0,tO=0,tCont=0,tR=0;
  tbody.innerHTML=state.budget.map((b,idx)=>{ const real=state.lancamentos.filter(l=>l.obraCod===b.obraCod&&l.cresp===b.cresp).reduce((s,l)=>s+l.qtd*l.precoUnit,0); const totalDisp=(b.budgetAprov||0)+(b.contingencia||0),saldo=totalDisp-real,pct=totalDisp>0?(real/totalDisp)*100:0; tB+=b.budgetAprov||0;tC+=b.capex||0;tO+=b.opex||0;tCont+=b.contingencia||0;tR+=real; return `<tr><td><span class="badge badge-muted">${b.obraCod}</span></td><td><span class="badge badge-blue">${b.cresp}</span></td><td><span class="badge ${b.tipoVerba==='CAPEX'?'badge-yellow':'badge-blue'}">${b.tipoVerba}</span></td><td style="font-family:var(--mono);font-size:12px">${fmtR(b.budgetAprov)}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(b.capex)}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(b.opex)}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(b.contingencia)}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(totalDisp)}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(real)}</td><td>${progressBar(pct)}</td><td style="font-family:var(--mono);font-size:12px;color:${saldo<0?'var(--red)':'var(--green)'}">${fmtR(saldo)}</td><td><span class="badge ${badgeBudget(pct)}">${pct>=100?'ESTOURADO':pct>=85?'ATENÇÃO':'OK'}</span></td><td style="position:sticky;right:0;background:#0d1117;z-index:1"><div class="row-actions"><button class="action-btn" onclick="editarBudget(${idx})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="action-btn danger" onclick="excluirBudget(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td></tr>`; }).join('');
  const tDisp=tB+tCont,tSaldo=tDisp-tR;
  $('budget-tfoot').innerHTML=`<td colspan="3">TOTAL</td><td>${fmtR(tB)}</td><td>${fmtR(tC)}</td><td>${fmtR(tO)}</td><td>${fmtR(tCont)}</td><td>${fmtR(tDisp)}</td><td>${fmtR(tR)}</td><td>${progressBar(tDisp>0?(tR/tDisp)*100:0)}</td><td style="color:${tSaldo<0?'var(--red)':'var(--green)'}">${fmtR(tSaldo)}</td><td colspan="2"></td>`;
}
function renderRevisoes(){
  const tbody=$('rev-tbody');
  if(!state.revisoes.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">nenhuma revisão</td></tr>';return;}
  tbody.innerHTML=state.revisoes.map((r,idx)=>`<tr><td style="font-family:var(--mono);text-align:center">${r.nRev}</td><td><span class="badge badge-muted">${r.obraCod}</span></td><td><span class="badge badge-blue">${r.cresp}</span></td><td style="font-family:var(--mono);font-size:11px">${fmtD(r.dataRevisao)}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(r.budgetAnterior)}</td><td style="font-family:var(--mono);font-size:12px;color:${(r.valorAditivo||0)<0?'var(--red)':'var(--green)'}">${fmtR(r.valorAditivo)}</td><td style="font-family:var(--mono);font-size:12px;font-weight:600">${fmtR((r.budgetAnterior||0)+(r.valorAditivo||0))}</td><td>${r.motivo}</td><td>${r.aprovadoPor||'—'}</td><td><button class="action-btn danger" onclick="excluirRevisao(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></td></tr>`).join('');
}
function renderCresp(){
  const tbody=$('cresp-tbody');
  if(!state.central.cresp.length){tbody.innerHTML='<tr class="empty-row"><td colspan="7">nenhum CRESP</td></tr>';return;}
  tbody.innerHTML=state.central.cresp.map(c=>{ const gasto=state.lancamentos.filter(l=>l.cresp===c.id).reduce((s,l)=>s+l.qtd*l.precoUnit,0); const bgt=state.budget.filter(b=>b.cresp===c.id).reduce((s,b)=>s+b.budgetAprov,0); const sal=bgt-gasto,pct=bgt>0?(gasto/bgt)*100:0; return `<tr><td><span class="badge badge-blue">${c.id}</span></td><td>${c.descricao}</td><td style="color:var(--text-muted)">${c.area||'—'}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(bgt)}</td><td style="font-family:var(--mono);font-size:12px">${fmtR(gasto)}</td><td style="font-family:var(--mono);font-size:12px;color:${sal<0?'var(--red)':'var(--green)'}">${fmtR(sal)}</td><td>${progressBar(pct)}</td></tr>`; }).join('');
}
function renderConfiguracoes(){
  $('config-cresp-tbody').innerHTML=state.central.cresp.map((c,idx)=>`<tr><td><span class="badge badge-blue">${c.id}</span></td><td>${c.descricao}</td><td style="color:var(--text-muted)">${c.area||'—'}</td><td><div class="row-actions"><button class="action-btn" onclick="editarCresp(${idx})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="action-btn danger" onclick="excluirCresp(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td></tr>`).join('')||'<tr class="empty-row"><td colspan="4">nenhum CRESP cadastrado</td></tr>';
  const tiposList = $('tipos-list');
  if(tiposList){
    const tipos = state.central.tiposObra||[];
    tiposList.innerHTML = tipos.map((t,i)=>`
      <span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px">
        ${t}
        <button onclick="excluirTipo(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;line-height:1;padding:0" title="Remover">×</button>
      </span>`).join('') || '<span style="color:var(--text-muted);font-size:12px">Nenhum tipo cadastrado</span>';
  }
  const catTbody = $('config-cat-tbody');
  if(catTbody){
    const cats = state.central.categoriasCusto||[];
    catTbody.innerHTML = cats.map((c,idx)=>`
      <tr>
        <td><strong>${c.categoria}</strong></td>
        <td style="font-size:12px;color:var(--text-muted)">${(c.subcategorias||[]).join(', ')||'—'}</td>
        <td><div class="row-actions">
          <button class="action-btn" onclick="editarCategoria(${idx})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn danger" onclick="excluirCategoria(${idx})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div></td>
      </tr>`).join('') || '<tr class="empty-row"><td colspan="3">nenhuma categoria cadastrada</td></tr>';
  }
}

function excluirTipo(idx){
  if(!confirm('Remover este tipo de obra?'))return;
  state.central.tiposObra.splice(idx,1);
  agendarSalvamentoCentral();
  renderConfiguracoes();
  popularSelects();
}

function editarCategoria(idx){
  const c = state.central.categoriasCusto[idx];
  state.editIdx.cresp = idx; // reusa editIdx
  $('modal-cat-title').textContent = 'Editar Categoria';
  $('cat-nome').value = c.categoria;
  $('cat-subs').value = (c.subcategorias||[]).join(', ');
  $('cat-err').textContent = '';
  abrirModal('modal-cat');
}

function excluirCategoria(idx){
  if(!confirm('Excluir esta categoria? Os lançamentos vinculados não serão alterados.'))return;
  state.central.categoriasCusto.splice(idx,1);
  agendarSalvamentoCentral();
  renderConfiguracoes();
  popularSelects();
}

function renderTudo(){ renderDashboard(); renderObras(); renderLancamentos(); renderBudget(); renderRevisoes(); renderCresp(); renderConfiguracoes(); popularSelects(); }
function svgChart(id,w,h,content){ return `<svg id="${id}" viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">${content}</svg>`; }

function renderChartGastoMes(){
  const el=$('chart-gasto-mes'); if(!el)return;
  const meses={};
  state.lancamentos.forEach(l=>{ const m=l.dtLanc?l.dtLanc.slice(0,7):''; if(!m)return; meses[m]=(meses[m]||0)+l.qtd*l.precoUnit; });
  const keys=Object.keys(meses).sort();
  if(!keys.length){el.innerHTML='<div class="chart-empty">Sem lançamentos com data</div>';return;}
  const vals=keys.map(k=>meses[k]);
  const max=Math.max(...vals)||1;
  const W=560,H=200,pad={t:20,r:20,b:40,l:70};
  const iw=W-pad.l-pad.r, ih=H-pad.t-pad.b, n=keys.length;
  const pts=keys.map((k,i)=>{ const x=pad.l+(i/(Math.max(n-1,1)))*iw; const y=pad.t+ih-(vals[i]/max)*ih; return `${x},${y}`; });
  const area=`M${pts[0]} `+pts.slice(1).map(p=>`L${p}`).join(' ')+` L${pad.l+iw},${pad.t+ih} L${pad.l},${pad.t+ih} Z`;
  const line=`M${pts[0]} `+pts.slice(1).map(p=>`L${p}`).join(' ');
  const gridLines=[0,0.25,0.5,0.75,1].map(r=>{ const y=pad.t+ih-(r*ih); return `<line x1="${pad.l}" y1="${y}" x2="${pad.l+iw}" y2="${y}" stroke="#30363d" stroke-width="1"/><text x="${pad.l-8}" y="${y+4}" text-anchor="end" fill="#8b949e" font-size="10" font-family="IBM Plex Mono">R$${((r*max)/1000).toFixed(0)}k</text>`; }).join('');
  const labels=keys.map((k,i)=>{ const x=pad.l+(i/(Math.max(n-1,1)))*iw; return `<text x="${x}" y="${H-8}" text-anchor="middle" fill="#8b949e" font-size="9" font-family="IBM Plex Mono">${k.slice(5)}</text>`; }).join('');
  const dots=pts.map((p,i)=>{ const [x,y]=p.split(','); return `<circle cx="${x}" cy="${y}" r="3" fill="#58a6ff"><title>${keys[i]}: ${fmtR(vals[i])}</title></circle>`; }).join('');
  el.innerHTML=svgChart('svg-gasto-mes',W,H,`<defs><linearGradient id="grad-line" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#58a6ff" stop-opacity="0.25"/><stop offset="100%" stop-color="#58a6ff" stop-opacity="0"/></linearGradient></defs>${gridLines}<path d="${area}" fill="url(#grad-line)"/><path d="${line}" fill="none" stroke="#58a6ff" stroke-width="2"/>${dots}${labels}`);
}
function renderChartBudgetVsReal(){
  const el=$('chart-budget-real'); if(!el)return;
  if(!state.obras.length){el.innerHTML='<div class="chart-empty">Sem obras</div>';return;}
  const obras=state.obras.slice(0,8);
  const W=560,H=220,pad={t:20,r:20,b:50,l:80};
  const iw=W-pad.l-pad.r, ih=H-pad.t-pad.b;
  const bw=iw/obras.length, gw=4, barW=(bw-gw*3)/2;
  const maxVal=Math.max(...obras.map(o=>Math.max(budgetObra(o.cod),realizado(o.cod))))||1;
  const gridLines=[0,0.25,0.5,0.75,1].map(r=>{ const y=pad.t+ih-r*ih; return `<line x1="${pad.l}" y1="${y}" x2="${pad.l+iw}" y2="${y}" stroke="#30363d" stroke-width="1"/><text x="${pad.l-8}" y="${y+4}" text-anchor="end" fill="#8b949e" font-size="10" font-family="IBM Plex Mono">R$${((r*maxVal)/1000).toFixed(0)}k</text>`; }).join('');
  const bars=obras.map((o,i)=>{ const b=budgetObra(o.cod),r=realizado(o.cod); const bh=(b/maxVal)*ih,rh=(r/maxVal)*ih; const x=pad.l+i*bw+gw; return `<rect x="${x}" y="${pad.t+ih-bh}" width="${barW}" height="${bh}" fill="#2E5FA3" rx="2" opacity="0.8"><title>${o.nome}: Budget ${fmtR(b)}</title></rect><rect x="${x+barW+gw}" y="${pad.t+ih-rh}" width="${barW}" height="${rh}" fill="#d29922" rx="2" opacity="0.9"><title>${o.nome}: Realizado ${fmtR(r)}</title></rect><text x="${x+barW}" y="${H-10}" text-anchor="middle" fill="#8b949e" font-size="9" font-family="IBM Plex Mono">${o.cod.slice(0,6)}</text>`; }).join('');
  const legend=`<rect x="${pad.l}" y="${H-32}" width="10" height="10" fill="#2E5FA3" rx="2"/><text x="${pad.l+14}" y="${H-23}" fill="#8b949e" font-size="10" font-family="IBM Plex Sans">Budget</text><rect x="${pad.l+70}" y="${H-32}" width="10" height="10" fill="#d29922" rx="2"/><text x="${pad.l+84}" y="${H-23}" fill="#8b949e" font-size="10" font-family="IBM Plex Sans">Realizado</text>`;
  el.innerHTML=svgChart('svg-bvr',W,H,gridLines+bars+legend);
}
function renderChartDonut(){
  const el=$('chart-donut'); if(!el)return;
  const crespData=state.central.cresp.map(c=>({id:c.id,val:state.lancamentos.filter(l=>l.cresp===c.id).reduce((s,l)=>s+l.qtd*l.precoUnit,0)})).filter(c=>c.val>0);
  if(!crespData.length){el.innerHTML='<div class="chart-empty">Sem lançamentos</div>';return;}
  const total=crespData.reduce((s,c)=>s+c.val,0);
  const colors=['#58a6ff','#d29922','#3fb950','#f85149','#e3702a','#a371f7','#39d353'];
  const CX=110,CY=110,R=80,r=48; let angle=-Math.PI/2;
  const slices=crespData.map((c,i)=>{ const pct=c.val/total,sweep=pct*2*Math.PI; const x1=CX+R*Math.cos(angle),y1=CY+R*Math.sin(angle); angle+=sweep; const x2=CX+R*Math.cos(angle),y2=CY+R*Math.sin(angle); const large=sweep>Math.PI?1:0; const xi1=CX+r*Math.cos(angle-sweep),yi1=CY+r*Math.sin(angle-sweep); const xi2=CX+r*Math.cos(angle),yi2=CY+r*Math.sin(angle); return `<path d="M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${r},${r} 0 ${large},0 ${xi1},${yi1} Z" fill="${colors[i%colors.length]}" opacity="0.85"><title>${c.id}: ${fmtR(c.val)} (${(pct*100).toFixed(1)}%)</title></path>`; }).join('');
  const legend=crespData.map((c,i)=>`<rect x="230" y="${16+i*22}" width="10" height="10" fill="${colors[i%colors.length]}" rx="2"/><text x="246" y="${26+i*22}" fill="#e6edf3" font-size="11" font-family="IBM Plex Sans">${c.id}</text><text x="390" y="${26+i*22}" text-anchor="end" fill="#8b949e" font-size="10" font-family="IBM Plex Mono">${(c.val/total*100).toFixed(1)}%</text>`).join('');
  el.innerHTML=svgChart('svg-donut',420,220,`${slices}<circle cx="${CX}" cy="${CY}" r="${r-2}" fill="#161b22"/><text x="${CX}" y="${CY-6}" text-anchor="middle" fill="#58a6ff" font-size="11" font-family="IBM Plex Mono">TOTAL</text><text x="${CX}" y="${CY+10}" text-anchor="middle" fill="#e6edf3" font-size="10" font-family="IBM Plex Mono">R$${(total/1000).toFixed(0)}k</text>${legend}`);
}
function abrirModal(id){ $(id).classList.add('open'); }
function fecharModal(id){ $(id).classList.remove('open'); }

function editarObra(idx){ const o=state.obras[idx]; state.editIdx.obra=idx; $('modal-obra-title').textContent='Editar Obra'; $('ob-cod').value=o.cod; $('ob-status').value=o.status; $('ob-nome').value=o.nome; $('ob-tipo').value=o.tipo||''; $('ob-local').value=o.local||''; $('ob-resp').value=o.responsavel||''; $('ob-cresp').value=o.cresp||''; $('ob-dt-ini-prev').value=o.dtInicioPrev||''; $('ob-dt-fim-prev').value=o.dtFimPrev||''; $('ob-dt-ini-real').value=o.dtInicioReal||''; $('ob-dt-fim-real').value=o.dtFimReal||''; $('ob-obs').value=o.obs||''; $('ob-err').textContent=''; abrirModal('modal-obra'); }
async function excluirObra(idx){
  if(!confirm('Excluir esta obra?'))return;
  const o=state.obras[idx];
  state.obras.splice(idx,1);
  renderTudo();
  try{ await API.obras.excluirObra(o.cod); }
  catch(e){ console.error('Erro ao excluir obra:', e); }
}
function editarLanc(idx){ const l=state.lancamentos[idx]; state.editIdx.lanc=idx; $('modal-lanc-title').textContent='Editar Lançamento'; $('lanc-obra').value=l.obraCod; $('lanc-cresp').value=l.cresp; $('lanc-cat').value=l.categoria; $('lanc-cat').dispatchEvent(new Event('change')); setTimeout(()=>{$('lanc-subcat').value=l.subcategoria||'';},50); $('lanc-desc').value=l.descricao; $('lanc-unid').value=l.unid||''; $('lanc-qtd').value=l.qtd; $('lanc-preco').value=l.precoUnit; $('lanc-nf').value=l.nfDoc||''; $('lanc-data').value=l.dtLanc||''; $('lanc-forn').value=l.fornecedor||''; $('lanc-obs').value=l.obs||''; $('lanc-err').textContent=''; abrirModal('modal-lanc'); }
async function excluirLanc(idx){
  if(!confirm('Excluir este lançamento?'))return;
  const l=state.lancamentos[idx];
  state.lancamentos.splice(idx,1);
  renderTudo();
  if(state.obraAtiva) renderDetalheLancamentos(state.obraAtiva);
  try{ await API.obras.excluirLanc(l.id); }
  catch(e){ console.error('Erro ao excluir lançamento:', e); }
}function editarBudget(idx){ const b=state.budget[idx]; state.editIdx.budget=idx; $('modal-budget-title').textContent='Editar Budget'; $('bgt-obra').value=b.obraCod; $('bgt-cresp').value=b.cresp; $('bgt-tipo').value=b.tipoVerba; $('bgt-aprov').value=b.budgetAprov; $('bgt-capex').value=b.capex||''; $('bgt-opex').value=b.opex||''; $('bgt-cont').value=b.contingencia||''; $('bgt-obs').value=b.obs||''; $('bgt-err').textContent=''; abrirModal('modal-budget'); }
async function excluirBudget(idx){
  if(!confirm('Excluir este budget?'))return;
  const b=state.budget[idx];
  state.budget.splice(idx,1);
  renderTudo();
  try{ await API.obras.excluirBudget(b.id); }
  catch(e){ console.error('Erro ao excluir budget:', e); }
}
function excluirRevisao(idx){ if(!confirm('Excluir esta revisão?'))return; state.revisoes.splice(idx,1); agendarSalvamento(); renderRevisoes(); renderDashboard(); }
function editarCresp(idx){ const c=state.central.cresp[idx]; state.editIdx.cresp=idx; $('modal-cresp-title').textContent='Editar CRESP'; $('cresp-id').value=c.id; $('cresp-desc').value=c.descricao; $('cresp-area').value=c.area||''; $('cresp-err').textContent=''; abrirModal('modal-cresp'); }
function excluirCresp(idx){
  if(!confirm('Excluir este CRESP?'))return;
  const idRemovido=state.central.cresp[idx].id;
  state.central.cresp.splice(idx,1);
  state.obras.forEach(o=>{ if(o.cresp===idRemovido)o.cresp=''; });
  state.budget=state.budget.filter(b=>b.cresp!==idRemovido);
  state.lancamentos.forEach(l=>{ if(l.cresp===idRemovido)l.cresp=''; });
  agendarSalvamentoCentral(); agendarSalvamento(); renderTudo();
}

function exportarPDF(){
  const totalB=totalBudget(),totalR=totalRealizado(),saldo=totalB-totalR;
  const linhas=state.obras.map(o=>{ const b=budgetObra(o.cod),r=realizado(o.cod),sal=b-r,p=b>0?(r/b)*100:0,af=avancFisico(o.cod); return `<tr><td>${o.cod}</td><td>${o.nome}</td><td>${o.status}</td><td>${o.cresp}</td><td>R$ ${fmt(b,2)}</td><td>R$ ${fmt(r,2)}</td><td>${fmt(p,1)}%</td><td>${fmt(af,1)}%</td><td style="color:${sal<0?'#c00':'#060'}">R$ ${fmt(sal,2)}</td></tr>`; }).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório Obras</title><style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:24px}h1{font-size:18px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#1B3A6B;color:#fff;padding:7px 10px;text-align:left;font-size:10px}td{padding:6px 10px;border-bottom:1px solid #eee;font-size:10px}tr:nth-child(even) td{background:#f8f9fa}</style></head><body><h1>Relatório — Obras & CAPEX</h1><div style="color:#888;font-size:10px">Gerado em: ${new Date().toLocaleString('pt-BR')}</div><table><thead><tr><th>Código</th><th>Nome</th><th>Status</th><th>CRESP</th><th>Budget</th><th>Realizado</th><th>% Fin.</th><th>% Fís.</th><th>Saldo</th></tr></thead><tbody>${linhas}</tbody></table></body></html>`;
  const w=window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500);
}
window.excluirObra=excluirObra; window.editarObra=editarObra;
window.excluirLanc=excluirLanc; window.editarLanc=editarLanc;
window.excluirBudget=excluirBudget; window.editarBudget=editarBudget;
window.excluirRevisao=excluirRevisao;
window.editarCresp=editarCresp; window.excluirCresp=excluirCresp;
window.abrirDetalheObra=abrirDetalheObra;
window.editarEtapa=editarEtapa; window.excluirEtapa=excluirEtapa;
window.atualizarAvancoEtapa=atualizarAvancoEtapa;
window.excluirTipo=excluirTipo;
window.editarCategoria=editarCategoria; window.excluirCategoria=excluirCategoria;
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [dObras, dCentral] = await Promise.all([
  window.__DADOS__ ? Promise.resolve(window.__DADOS__) : API.obras.listar(),
  API.hub.config.ler()
]);
if (dObras) {
  state.obras        = Array.isArray(dObras.obras)        ? dObras.obras        : [];
  state.budget       = Array.isArray(dObras.budget)       ? dObras.budget       : [];
  state.lancamentos  = Array.isArray(dObras.lancamentos)  ? dObras.lancamentos  : [];
  state.revisoes     = Array.isArray(dObras.revisoes)     ? dObras.revisoes     : [];
  state.obras.forEach(o => { if (!o.obs) o.obs = ''; if (!o.etapas) o.etapas = []; });
  state.lancamentos.forEach(l => { if (!l.id) l.id = gerarId('L', state.lancamentos, 'id'); });
  state.budget.forEach((b, i) => { if (!b.id) b.id = Date.now() + i; });
}
if (dCentral && Object.keys(dCentral).length) {
  state.central.pessoas         = Array.isArray(dCentral.pessoas)        ? dCentral.pessoas        : [];
  state.central.cresp           = Array.isArray(dCentral.cresp)          ? dCentral.cresp          : [];
  state.central.tiposObra       = Array.isArray(dCentral.tiposObra)      ? dCentral.tiposObra      : [];
  state.central.categoriasCusto = Array.isArray(dCentral.categoriasCusto)? dCentral.categoriasCusto: [];
  state.central.leitores        = Array.isArray(dCentral.leitores)       ? dCentral.leitores       : [];
}
    setSaveStatus('saved', 'carregado');
  } catch(e) {
    setSaveStatus('nosave', 'erro ao carregar');
  }
  $('app').style.display = 'block';
  popularSelects(); renderTudo(); aplicarFiltroURL();
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const pane = btn.dataset.pane;
    if (!pane) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const paneEl = document.getElementById('pane-' + pane);
    if (paneEl) paneEl.classList.add('active');
    const url = new URL(window.location);
    url.searchParams.set('page', pane);
    history.pushState({}, '', url);
  });
});
$('btn-vincular-arquivo')?.addEventListener('click', () => {
  alert('Gerencie os arquivos pelo Hub principal.');
});
$('_placeholder_vincular')?.addEventListener('click', () => {
  alert('Dados carregados automaticamente do banco.');
});
  document.querySelectorAll('.detalhe-tab').forEach(tab => {
    tab.addEventListener('click', () => renderAbaDetalhe(tab.dataset.tab));
  });
  $('btn-voltar-detalhe').addEventListener('click', () => {
    state.obraAtiva = null;
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
    document.querySelector('.nav-item[data-pane="obras"]').classList.add('active');
    $('pane-obras').classList.add('active');
  });
  $('btn-novo-lanc-detalhe')?.addEventListener('click', () => {
    state.editIdx.lanc=-1;
    $('modal-lanc-title').textContent='Novo Lançamento';
    ['lanc-desc','lanc-unid','lanc-nf','lanc-forn','lanc-obs'].forEach(id=>$(id).value='');
    $('lanc-qtd').value='';$('lanc-preco').value='';$('lanc-data').value=hoje();
    $('lanc-obra').value=state.obraAtiva||'';
    $('lanc-cresp').value='';$('lanc-cat').value='';
    $('lanc-subcat').innerHTML='<option>—</option>';$('lanc-err').textContent='';
    abrirModal('modal-lanc');
  });
  $('btn-nova-etapa')?.addEventListener('click', () => {
    state.editIdx.etapa=-1;
    $('modal-etapa-title').textContent='Nova Etapa';
    ['etapa-nome','etapa-obs'].forEach(id=>$(id).value='');
    $('etapa-dt-inicio').value='';$('etapa-dt-fim').value='';
    $('etapa-resp').value='';$('etapa-peso').value=1;$('etapa-af').value=0;
    $('etapa-err').textContent='';
    abrirModal('modal-etapa');
  });

  $('btn-salvar-etapa')?.addEventListener('click', () => {
    const nome=$('etapa-nome').value.trim();
    if(!nome){$('etapa-err').textContent='Nome obrigatório.';return;}
    const o=state.obras.find(x=>x.cod===state.obraAtiva);
    if(!o)return;
    if(!o.etapas)o.etapas=[];
    const obj={nome,dtInicio:$('etapa-dt-inicio').value,dtFim:$('etapa-dt-fim').value,responsavel:$('etapa-resp').value,peso:parseFloat($('etapa-peso').value)||1,avancoFisico:parseInt($('etapa-af').value)||0,obs:$('etapa-obs').value.trim()};
    const idx=state.editIdx.etapa;
    if(idx>=0)o.etapas[idx]=obj; else o.etapas.push(obj);
    fecharModal('modal-etapa');agendarSalvamento();renderCronograma(state.obraAtiva);
  });
  ['modal-etapa-close','modal-etapa-cancel'].forEach(id=>$(id)?.addEventListener('click',()=>fecharModal('modal-etapa')));
  $('detalhe-filtro-cat')?.addEventListener('change', ()=>renderDetalheLancamentos(state.obraAtiva));
  $('detalhe-lanc-search')?.addEventListener('input', ()=>renderDetalheLancamentos(state.obraAtiva));
  $('obras-search').addEventListener('input', renderObras);
  $('obras-filtro-status').addEventListener('change', renderObras);
  $('lanc-search').addEventListener('input', renderLancamentos);
  $('lanc-filtro-obra').addEventListener('change', renderLancamentos);
  $('lanc-filtro-cat').addEventListener('change', renderLancamentos);
  $('btn-nova-obra').addEventListener('click', () => { state.editIdx.obra=-1; $('modal-obra-title').textContent='Nova Obra'; ['ob-cod','ob-nome','ob-local','ob-obs'].forEach(id=>$(id).value=''); $('ob-status').value='Planejado'; $('ob-dt-ini-prev').value=$('ob-dt-fim-prev').value=$('ob-dt-ini-real').value=$('ob-dt-fim-real').value=''; $('ob-resp').value='';$('ob-cresp').value='';$('ob-err').textContent=''; abrirModal('modal-obra'); });
  $('btn-salvar-obra').addEventListener('click', () => { const cod=$('ob-cod').value.trim(),nome=$('ob-nome').value.trim(); if(!cod||!nome){$('ob-err').textContent='Código e nome obrigatórios.';return;} const idx=state.editIdx.obra; if(idx===-1&&state.obras.find(o=>o.cod===cod)){$('ob-err').textContent='Código já existe.';return;} const resp=$('ob-resp').value,pessoa=state.central.pessoas.find(p=>p.id===resp); const obj={cod,nome,tipo:$('ob-tipo').value,local:$('ob-local').value.trim(),responsavel:resp,respNome:pessoa?pessoa.nome:'',cresp:$('ob-cresp').value,status:$('ob-status').value,dtInicioPrev:$('ob-dt-ini-prev').value,dtFimPrev:$('ob-dt-fim-prev').value,dtInicioReal:$('ob-dt-ini-real').value,dtFimReal:$('ob-dt-fim-real').value,obs:$('ob-obs').value.trim(),etapas:idx>=0?(state.obras[idx].etapas||[]):[] }; if(idx===-1)state.obras.push(obj);else state.obras[idx]=obj; fecharModal('modal-obra');agendarSalvamento();renderTudo(); });
  ['modal-obra-close','modal-obra-cancel'].forEach(id=>$(id).addEventListener('click',()=>fecharModal('modal-obra')));
  $('btn-novo-lanc').addEventListener('click', () => { state.editIdx.lanc=-1; $('modal-lanc-title').textContent='Novo Lançamento'; ['lanc-desc','lanc-unid','lanc-nf','lanc-forn','lanc-obs'].forEach(id=>$(id).value=''); $('lanc-qtd').value='';$('lanc-preco').value='';$('lanc-data').value=hoje();$('lanc-obra').value='';$('lanc-cresp').value='';$('lanc-cat').value='';$('lanc-subcat').innerHTML='<option>—</option>';$('lanc-err').textContent=''; abrirModal('modal-lanc'); });
  $('btn-salvar-lanc').addEventListener('click', () => { const obra=$('lanc-obra').value,cresp=$('lanc-cresp').value,desc=$('lanc-desc').value.trim(),qtd=parseFloat($('lanc-qtd').value),preco=parseFloat($('lanc-preco').value); if(!obra||!cresp||!desc||isNaN(qtd)||isNaN(preco)){$('lanc-err').textContent='Preencha todos os campos obrigatórios.';return;} const idx=state.editIdx.lanc; const obj={id:idx===-1?gerarId('L',state.lancamentos,'id'):state.lancamentos[idx].id,obraCod:obra,cresp,categoria:$('lanc-cat').value,subcategoria:$('lanc-subcat').value,descricao:desc,unid:$('lanc-unid').value.trim(),qtd,precoUnit:preco,nfDoc:$('lanc-nf').value.trim(),dtLanc:$('lanc-data').value,fornecedor:$('lanc-forn').value.trim(),obs:$('lanc-obs').value.trim()}; if(idx===-1)state.lancamentos.push(obj);else state.lancamentos[idx]=obj; fecharModal('modal-lanc');agendarSalvamento();renderTudo(); if(state.obraAtiva)renderDetalheLancamentos(state.obraAtiva); });
  ['modal-lanc-close','modal-lanc-cancel'].forEach(id=>$(id).addEventListener('click',()=>fecharModal('modal-lanc')));
  $('btn-novo-budget').addEventListener('click', () => { state.editIdx.budget=-1; $('modal-budget-title').textContent='Novo Budget'; ['bgt-aprov','bgt-capex','bgt-opex','bgt-cont','bgt-obs'].forEach(id=>$(id).value=''); $('bgt-obra').value=state.obraAtiva||'';$('bgt-cresp').value='';$('bgt-tipo').value='CAPEX';$('bgt-err').textContent=''; abrirModal('modal-budget'); });
  $('btn-salvar-budget').addEventListener('click', () => { const obra=$('bgt-obra').value,cresp=$('bgt-cresp').value,aprov=parseFloat($('bgt-aprov').value); if(!obra||!cresp||isNaN(aprov)){$('bgt-err').textContent='Obra, CRESP e budget obrigatórios.';return;} const idx=state.editIdx.budget; const obj={id:idx===-1?Date.now():state.budget[idx].id,obraCod:obra,cresp,tipoVerba:$('bgt-tipo').value,budgetAprov:aprov,capex:parseFloat($('bgt-capex').value)||0,opex:parseFloat($('bgt-opex').value)||0,contingencia:parseFloat($('bgt-cont').value)||0,obs:$('bgt-obs').value.trim()}; if(idx===-1)state.budget.push(obj);else state.budget[idx]=obj; fecharModal('modal-budget');agendarSalvamento();renderTudo(); if(state.obraAtiva)renderDetalheBudget(state.obraAtiva); });
  ['modal-budget-close','modal-budget-cancel'].forEach(id=>$(id).addEventListener('click',()=>fecharModal('modal-budget')));
  $('btn-nova-revisao').addEventListener('click', () => { state.editIdx.rev=-1; ['rev-ant','rev-adit','rev-motivo','rev-aprov'].forEach(id=>$(id).value=''); $('rev-data').value=hoje();$('rev-obra').value=state.obraAtiva||'';$('rev-cresp').value='';$('rev-err').textContent=''; abrirModal('modal-rev'); });
  $('btn-salvar-rev').addEventListener('click', () => { const obra=$('rev-obra').value,cresp=$('rev-cresp').value,adit=parseFloat($('rev-adit').value),motivo=$('rev-motivo').value.trim(); if(!obra||!cresp||isNaN(adit)||!motivo){$('rev-err').textContent='Obra, CRESP, aditivo e motivo obrigatórios.';return;} const nRev=state.revisoes.filter(r=>r.obraCod===obra).length+1; const obj={id:gerarId('R',state.revisoes,'id'),nRev,obraCod:obra,cresp,dataRevisao:$('rev-data').value,budgetAnterior:parseFloat($('rev-ant').value)||0,valorAditivo:adit,motivo,aprovadoPor:$('rev-aprov').value.trim()}; state.revisoes.push(obj);fecharModal('modal-rev');agendarSalvamento();renderRevisoes();renderDashboard(); if(state.obraAtiva)renderDetalheRevisoes(state.obraAtiva); });
  ['modal-rev-close','modal-rev-cancel'].forEach(id=>$(id).addEventListener('click',()=>fecharModal('modal-rev')));
  $('btn-novo-cresp').addEventListener('click', () => { state.editIdx.cresp=-1; $('modal-cresp-title').textContent='Novo CRESP'; ['cresp-id','cresp-desc','cresp-area'].forEach(id=>$(id).value=''); $('cresp-err').textContent=''; abrirModal('modal-cresp'); });
  $('btn-salvar-cresp').addEventListener('click', () => { const id=$('cresp-id').value.trim().toUpperCase(),desc=$('cresp-desc').value.trim(),area=$('cresp-area').value.trim(); if(!id||!desc){$('cresp-err').textContent='ID e descrição obrigatórios.';return;} const idx=state.editIdx.cresp; if(idx===-1&&state.central.cresp.find(c=>c.id===id)){$('cresp-err').textContent='ID já existe.';return;} const obj={id,descricao:desc,area}; if(idx===-1)state.central.cresp.push(obj);else state.central.cresp[idx]=obj; fecharModal('modal-cresp');agendarSalvamentoCentral();renderTudo(); });
  ['modal-cresp-close','modal-cresp-cancel'].forEach(id=>$(id).addEventListener('click',()=>fecharModal('modal-cresp')));
  $('btn-add-tipo')?.addEventListener('click', () => {
    const nome = prompt('Nome do tipo de obra:');
    if(!nome?.trim()) return;
    if(!state.central.tiposObra) state.central.tiposObra=[];
    if(state.central.tiposObra.includes(nome.trim())){alert('Tipo já existe.');return;}
    state.central.tiposObra.push(nome.trim());
    agendarSalvamentoCentral();
    renderConfiguracoes();
    popularSelects();
  });
  $('btn-nova-cat')?.addEventListener('click', () => {
    state.editIdx.cresp = -1;
    $('modal-cat-title').textContent = 'Nova Categoria';
    $('cat-nome').value = '';
    $('cat-subs').value = '';
    $('cat-err').textContent = '';
    abrirModal('modal-cat');
  });
  $('btn-salvar-cat')?.addEventListener('click', () => {
    const nome = $('cat-nome').value.trim();
    if(!nome){$('cat-err').textContent='Nome obrigatório.';return;}
    const subs = $('cat-subs').value.split(',').map(s=>s.trim()).filter(Boolean);
    const idx = state.editIdx.cresp;
    if(!state.central.categoriasCusto) state.central.categoriasCusto=[];
    if(idx===-1 && state.central.categoriasCusto.find(c=>c.categoria===nome)){
      $('cat-err').textContent='Categoria já existe.';return;
    }
    const obj = {categoria:nome, subcategorias:subs};
    if(idx===-1) state.central.categoriasCusto.push(obj);
    else state.central.categoriasCusto[idx]=obj;
    fecharModal('modal-cat');
    agendarSalvamentoCentral();
    renderConfiguracoes();
    popularSelects();
  });
  ['modal-cat-close','modal-cat-cancel'].forEach(id=>$(id)?.addEventListener('click',()=>fecharModal('modal-cat')));

  document.querySelectorAll('.modal-overlay').forEach(ov=>{ ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');}); });
});