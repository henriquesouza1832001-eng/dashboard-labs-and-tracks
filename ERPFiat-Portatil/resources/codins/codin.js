
'use strict';
let state = {
  pessoas: [], pontos: [], acessos: [],
  leitores: ['200','209','270','396','517','559','580','581','588','590',
             '805','834','883','924','927','928','929','930','931','932',
             '933','935','936','937','938','941','942','943','944','359','978'],
  senhaHash: '',
};
let fileHandle = null, saveTimeout = null, editCtx = {tipo:null,idx:-1}, confirmCallback = null;
const SESSION_ID = Date.now().toString(36)+Math.random().toString(36).slice(2);
const DB_NAME = 'obras-db', DB_STORE = 'handles';
function hashSimples(str){ let h=0; for(let i=0;i<str.length;i++)h=Math.imul(31,h)+str.charCodeAt(i)|0; return h.toString(16); }
function toast(msg,tipo=''){ const el=document.getElementById('toast'); el.textContent=msg; el.className='toast show '+tipo; setTimeout(()=>{el.className='toast';},3000); }
function setSaveStatus(s){ const ind=document.getElementById('save-indicator'),txt=document.getElementById('save-text'); ind.className='save-indicator '+s; txt.textContent=s==='saving'?'Salvando...':s==='error'?'Erro':'Salvo'; }
function formatDate(d){ if(!d)return'—'; const[y,m,dia]=d.split('-'); return`${dia}/${m}/${y}`; }
function badge(s){ const map={'Ativo':'badge-ativo','Inativo':'badge-inativo','Bloqueado':'badge-bloqueado','Temporário':'badge-temp'}; return`<span class="badge ${map[s]||'badge-inativo'}">${s}</span>`; }
function badgePonto(t){ return t==='Restrito'?'<span class="badge badge-restrito">🔒 Restrito</span>':'<span class="badge badge-publico">Público</span>'; }
async function salvarDados(){
  await API.codin.salvar(state);
  setSaveStatus('ok');
}
function agendarSalvamento(){ clearTimeout(saveTimeout); saveTimeout=setTimeout(()=>salvarDados(),400); }
function carregarDeJSON(json){
  try{
    const d=JSON.parse(json);
    state.pessoas=d.pessoas||[]; state.pontos=d.pontos||[]; state.acessos=d.acessos||[];
    state.leitores=d.leitores||state.leitores; state.senhaHash=d.senhaHash||'';
    state.pontos.forEach(p=>{if(!p.senhaHash)p.senhaHash='';});
    return true;
  }catch{return false;}
}
async function abrirArquivo(){ return false; }
async function carregarDados(){
  const d = window.__DADOS__ || await API.codin.listar();
 if (d) {
  state.pessoas = Array.isArray(d.pessoas) ? d.pessoas : [];
  state.pontos  = Array.isArray(d.pontos)  ? d.pontos  : [];
}
}
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

  if(status && pane === 'pessoas'){
    const sel = document.getElementById('pessoas-filtro-status');
    if(sel){ sel.value = status; renderPessoas(); }
  }
}
function iniciarApp(){
  document.getElementById('tela-inicio').style.display='none';
  document.getElementById('app-shell').style.display='flex';
  popularBuscaSelects();
  renderAll();
  aplicarFiltroURL();
  carregarSolicitacoes();
}
function renderAll(){ renderPessoas(); renderPontos(); renderAcessos(); renderMatriz(); renderLeitoresCfg(); updateDashboard(); }
async function inicializarCodin(){
  await carregarDados();
  setSaveStatus('ok');
  iniciarApp();
}
setTimeout(inicializarCodin, 300);
document.getElementById('btn-reabrir')?.addEventListener('click',()=>{ toast('Arquivos gerenciados pelo Hub.',''); });
document.getElementById('btn-abrir-dados')?.addEventListener('click',()=>{ iniciarApp(); });
document.getElementById('btn-comecar-vazio')?.addEventListener('click',()=>{ iniciarApp(); });
document.getElementById('btn-trocar-arquivo')?.addEventListener('click',()=>{ toast('Arquivos gerenciados pelo Hub.',''); });
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const page=btn.dataset.page;
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-'+page).classList.add('active');
    if(page==='matriz')renderMatriz();
    if(page==='busca')popularBuscaSelects();
    if(page==='solicitacoes'){ carregarSolicitacoes(); renderQrCodesTab(); }
  });
});

let solicitacoesCache = [];

async function carregarSolicitacoes(){
  try{
    const res = await fetch('/api/codin/solicitacoes');
    const dados = await res.json();
    solicitacoesCache = dados.solicitacoes || [];
    renderSolicitacoes();
    atualizarBadgeSolicitacoes();
    updateDashboard();
  }catch{
    document.getElementById('tbody-solicitacoes').innerHTML='<tr><td colspan="7" class="empty-state">Erro ao carregar solicitações.</td></tr>';
  }
}

function atualizarBadgeSolicitacoes(){
  const pendentes = solicitacoesCache.filter(s=>s.status==='Pendente').length;
  const badge = document.getElementById('nav-badge-solicitacoes');
  if(!badge)return;
  badge.textContent = pendentes;
  badge.style.display = pendentes>0 ? 'inline-flex' : 'none';
}

function badgeSolicitacao(s){
  const map={'Pendente':'badge-temp','Aprovada':'badge-ativo','Rejeitada':'badge-bloqueado'};
  return `<span class="badge ${map[s]||'badge-temp'}">${s}</span>`;
}

function renderSolicitacoes(){
  const filtro = document.getElementById('filtro-status-solicitacao')?.value || '';
  const tb = document.getElementById('tbody-solicitacoes');
  let lista = [...solicitacoesCache].sort((a,b)=>new Date(b.data)-new Date(a.data));
  if(filtro) lista = lista.filter(s=>s.status===filtro);
  if(!lista.length){tb.innerHTML='<tr><td colspan="7" class="empty-state">Nenhuma solicitação encontrada.</td></tr>';return;}
  tb.innerHTML = lista.map(s=>{
    const ponto = state.pontos.find(p=>p.codin===s.codin);
    const dt = s.data ? new Date(s.data).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--text2)">${dt}</td>
      <td>${s.nome}</td>
      <td style="font-family:var(--mono);font-size:11px">${s.email}</td>
      <td><span class="mono">${s.codin}</span>${ponto?`<div style="font-size:10px;color:var(--text2)">${ponto.nome}</div>`:''}</td>
      <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${s.motivo}">${s.motivo}</td>
      <td>${badgeSolicitacao(s.status)}</td>
      <td><div class="row-actions">
        ${s.status==='Pendente'?`
          <button class="btn btn-sm" style="color:var(--green);border-color:var(--green)" onclick="aprovarSolicitacao('${s.id}')">Aprovar</button>
          <button class="btn btn-sm btn-danger" onclick="rejeitarSolicitacao('${s.id}')">Rejeitar</button>
        `:''}
      </div></td>
    </tr>`;
  }).join('');
}

document.getElementById('filtro-status-solicitacao')?.addEventListener('change', renderSolicitacoes);
document.getElementById('btn-recarregar-solicitacoes')?.addEventListener('click', carregarSolicitacoes);

window.aprovarSolicitacao = async function(id){
  await atualizarStatusSolicitacao(id, 'Aprovada');
  const sol = solicitacoesCache.find(s=>s.id===id);
  if(sol){
    document.querySelector('.nav-item[data-page="acessos"]').click();
    document.getElementById('btn-novo-acesso').click();
    setTimeout(()=>{
      const sel = document.getElementById('ac-pessoa');
      const opt = [...sel.options].find(o=>o.textContent.toLowerCase().includes(sol.nome.toLowerCase()));
      if(opt) sel.value = opt.value;
    }, 100);
  }
};

window.rejeitarSolicitacao = async function(id){
  await atualizarStatusSolicitacao(id, 'Rejeitada');
};

async function atualizarStatusSolicitacao(id, status){
  try{
    await fetch(`/api/codin/solicitacoes/${id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({status})
    });
    const sol = solicitacoesCache.find(s=>s.id===id);
    if(sol){ sol.status = status; sol.data_resposta = new Date().toISOString(); }
    renderSolicitacoes();
    atualizarBadgeSolicitacoes();
    updateDashboard();
    toast(status==='Aprovada'?'Solicitação aprovada!':'Solicitação rejeitada.', status==='Aprovada'?'success':'');
  }catch{
    toast('Erro ao atualizar solicitação.','');
  }
}
document.querySelectorAll('.aba-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const grupo = btn.closest('.abas');
    grupo.querySelectorAll('.aba-btn').forEach(b=>b.classList.remove('active'));
    grupo.parentElement.querySelectorAll(':scope > .aba-content').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('aba-'+btn.dataset.aba).classList.add('active');
    if(btn.dataset.aba==='solic-qr') renderQrCodesTab(document.getElementById('busca-qr-pontos')?.value||'');
  });
});
function abrirModal(id){document.getElementById(id).classList.add('open');}
function fecharModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>fecharModal(btn.dataset.close)));
document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)fecharModal(ov.id);}));
function updateDashboard(){
  document.getElementById('m-total').textContent=state.pessoas.length;
  document.getElementById('m-ativos').textContent=state.pessoas.filter(p=>p.status==='Ativo').length;
  document.getElementById('m-bloqueados').textContent=state.pessoas.filter(p=>p.status==='Bloqueado').length;
  document.getElementById('m-temp').textContent=state.pessoas.filter(p=>p.status==='Temporário').length;
  document.getElementById('m-pontos').textContent=state.pontos.length;
  document.getElementById('m-restritos').textContent=state.pontos.filter(p=>p.tipo==='Restrito').length;
  atualizarDashboardSolicitacoes();
}

function atualizarDashboardSolicitacoes(){
  const elTempo=document.getElementById('m-tempo-medio');
  const elAntigas=document.getElementById('m-pendentes-antigas');
  const elMes=document.getElementById('m-solic-mes');
  const elTaxa=document.getElementById('m-taxa-aprovacao');
  const elLista=document.getElementById('dashboard-pendentes-lista');
  if(!elTempo) return;

  const agora = new Date();
  const respondidas = solicitacoesCache.filter(s=>s.data_resposta);
  if(respondidas.length){
    const totalMs = respondidas.reduce((acc,s)=>acc+(new Date(s.data_resposta)-new Date(s.data)),0);
    const mediaHoras = totalMs/respondidas.length/3600000;
    elTempo.textContent = mediaHoras<1 ? Math.round(mediaHoras*60)+'min' : mediaHoras.toFixed(1)+'h';
  } else {
    elTempo.textContent = '—';
  }

  const pendentes = solicitacoesCache.filter(s=>s.status==='Pendente');
  const pendentesAntigas = pendentes.filter(s=>(agora-new Date(s.data))>86400000);
  elAntigas.textContent = pendentesAntigas.length;

  const ultimos30 = solicitacoesCache.filter(s=>(agora-new Date(s.data))<=30*86400000);
  elMes.textContent = ultimos30.length;

  const finalizadas = solicitacoesCache.filter(s=>s.status==='Aprovada'||s.status==='Rejeitada');
  const aprovadas = solicitacoesCache.filter(s=>s.status==='Aprovada');
  elTaxa.textContent = finalizadas.length ? Math.round(aprovadas.length/finalizadas.length*100)+'%' : '0%';

  if(!elLista) return;
  const antigasOrdenadas = [...pendentes].sort((a,b)=>new Date(a.data)-new Date(b.data)).slice(0,5);
  if(!antigasOrdenadas.length){
    elLista.innerHTML = '<div class="empty-state">Nenhuma solicitação pendente.</div>';
    return;
  }
  elLista.innerHTML = antigasOrdenadas.map(s=>{
    const horas = Math.floor((agora-new Date(s.data))/3600000);
    const tempoTxt = horas<1 ? 'há poucos minutos' : horas<24 ? `há ${horas}h` : `há ${Math.floor(horas/24)}d`;
    return `<div class="dashboard-pendente-item">
      <div class="dp-info"><strong>${s.nome}</strong><span style="color:var(--text2)">CODIN ${s.codin} — ${s.motivo}</span></div>
      <span class="dp-tempo">${tempoTxt}</span>
    </div>`;
  }).join('');
}
function renderPessoas(filtroTxt='',filtroStatus=''){
  const tb=document.getElementById('tbody-pessoas');
  let lista=[...state.pessoas];
  if(filtroTxt){const f=filtroTxt.toLowerCase();lista=lista.filter(p=>p.id.toLowerCase().includes(f)||p.nome.toLowerCase().includes(f)||(p.cargo||'').toLowerCase().includes(f)||(p.setor||'').toLowerCase().includes(f));}
  if(filtroStatus)lista=lista.filter(p=>p.status===filtroStatus);
  if(!lista.length){tb.innerHTML='<tr><td colspan="8" class="empty-state">Nenhum registro encontrado.</td></tr>';return;}
  tb.innerHTML=lista.map(p=>{
    const i=state.pessoas.indexOf(p);
    return`<tr><td><span class="mono">${p.id}</span></td><td>${p.nome}</td><td style="color:var(--text2)">${p.cargo||'—'}</td><td style="color:var(--text2)">${p.setor||'—'}</td><td>${badge(p.status)}</td><td style="font-family:var(--mono);font-size:11px;color:var(--text2)">${formatDate(p.lib)}</td><td style="color:var(--text2);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.obs||'—'}</td><td><div class="row-actions"><button class="btn btn-sm" onclick="editarPessoa(${i})"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-sm btn-danger" onclick="confirmarDeletar('pessoa',${i},'${p.nome.replace(/'/g,"\\'")}')"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td></tr>`;
  }).join('');
  updateDashboard();
}
document.getElementById('busca-pessoas').addEventListener('input',()=>renderPessoas(document.getElementById('busca-pessoas').value,document.getElementById('filtro-status-pessoa').value));
document.getElementById('filtro-status-pessoa').addEventListener('change',()=>renderPessoas(document.getElementById('busca-pessoas').value,document.getElementById('filtro-status-pessoa').value));

document.getElementById('btn-nova-pessoa').addEventListener('click',()=>{
  editCtx={tipo:'pessoa',idx:-1};
  document.getElementById('modal-pessoa-title').textContent='Novo cadastro';
  ['p-id','p-nome','p-cargo','p-setor','p-lib','p-obs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('p-status').value='Ativo';
  document.getElementById('p-err').textContent='';
  document.getElementById('p-id').removeAttribute('readonly');
  abrirModal('modal-pessoa');
});
window.editarPessoa=function(i){
  const p=state.pessoas[i]; editCtx={tipo:'pessoa',idx:i};
  document.getElementById('modal-pessoa-title').textContent='Editar cadastro';
  document.getElementById('p-id').value=p.id; document.getElementById('p-id').setAttribute('readonly',true);
  document.getElementById('p-nome').value=p.nome; document.getElementById('p-cargo').value=p.cargo||'';
  document.getElementById('p-setor').value=p.setor||''; document.getElementById('p-status').value=p.status;
  document.getElementById('p-lib').value=p.lib||''; document.getElementById('p-obs').value=p.obs||'';
  document.getElementById('p-err').textContent=''; abrirModal('modal-pessoa');
};
document.getElementById('btn-salvar-pessoa').addEventListener('click',()=>{
  const id=document.getElementById('p-id').value.trim(),nome=document.getElementById('p-nome').value.trim(),err=document.getElementById('p-err');
  if(!id||!nome){err.textContent='ID e Nome são obrigatórios.';return;}
  if(editCtx.idx===-1&&state.pessoas.some(p=>p.id===id)){err.textContent='ID já cadastrado.';return;}
  const obj={id,nome,cargo:document.getElementById('p-cargo').value.trim(),setor:document.getElementById('p-setor').value.trim(),status:document.getElementById('p-status').value,lib:document.getElementById('p-lib').value,obs:document.getElementById('p-obs').value.trim()};
  if(editCtx.idx>=0)state.pessoas[editCtx.idx]=obj; else state.pessoas.push(obj);
  fecharModal('modal-pessoa');renderPessoas();agendarSalvamento();
  toast(editCtx.idx>=0?'Atualizado!':'Cadastrado!','success');
});
window.filtrarPontos=function(){ renderPontos((document.getElementById('busca-pontos').value||'').toLowerCase()); };
function renderPontos(filtro=''){
  const tb=document.getElementById('tbody-pontos');
  let lista=state.pontos;
  if(filtro)lista=lista.filter(p=>p.nome.toLowerCase().includes(filtro)||(p.codin||'').toLowerCase().includes(filtro));
  if(!lista.length){tb.innerHTML='<tr><td colspan="6" class="empty-state">Nenhum ponto encontrado.</td></tr>';return;}
  tb.innerHTML=lista.map((p,idx)=>{
    const i=state.pontos.indexOf(p);
    return`<tr><td style="color:var(--text2);font-family:var(--mono);font-size:11px">${idx+1}</td><td>${p.nome}</td><td><span class="mono">${p.codin||'—'}</span></td><td>${badgePonto(p.tipo)}${p.tipo==='Restrito'?`<span style="color:${p.senhaHash?'var(--green)':'var(--red)'};font-size:10px;margin-left:6px">${p.senhaHash?'● senha ok':'● sem senha'}</span>`:''}</td><td style="max-width:240px">${p.leitores.length?p.leitores.map(l=>`<span class="chip">${l}</span>`).join(''):'<span style="color:var(--text2)">—</span>'}</td><td><div class="row-actions">${p.codin?`<button class="btn btn-sm" title="Gerar QR Code" onclick="abrirQrPonto('${p.codin}','${p.nome.replace(/'/g,"\\'")}')"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg></button>`:''}<button class="btn btn-sm" onclick="editarPonto(${i})"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-sm btn-danger" onclick="confirmarDeletar('ponto',${i},'${p.nome.replace(/'/g,"\\'")}')"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td></tr>`;
  }).join('');
  updateDashboard();
}

window.abrirQrPonto = function(codin, nome){
  const url = `${window.location.origin}/codin-qr/${codin}`;
  document.getElementById('qr-ponto-titulo').textContent = nome;
  document.getElementById('qr-ponto-link').textContent = url;
  document.getElementById('qr-ponto-canvas').innerHTML = '';
  new QRCode(document.getElementById('qr-ponto-canvas'), {
    text: url, width: 180, height: 180,
    colorDark: '#0f1c3f', colorLight: '#ffffff'
  });
  window._qrPontoUrl = url;
  window._qrPontoSlug = codin;
  abrirModal('modal-qr-ponto');
};

window.baixarQrPonto = function(){
  const wrap = document.getElementById('qr-ponto-canvas');
  const img = wrap.querySelector('img');
  const canvas = wrap.querySelector('canvas');
  const link = document.createElement('a');
  link.download = `qrcode-codin-${window._qrPontoSlug}.png`;
  link.href = img ? img.src : canvas.toDataURL('image/png');
  link.click();
};

function renderQrCodesTab(filtro=''){
  const wrap = document.getElementById('qr-pontos-lista');
  if(!wrap) return;
  let lista = state.pontos.filter(p=>p.codin);
  if(filtro) lista = lista.filter(p=>p.nome.toLowerCase().includes(filtro.toLowerCase())||p.codin.toLowerCase().includes(filtro.toLowerCase()));
  if(!lista.length){ wrap.innerHTML = '<div class="empty-state">Nenhum ponto com CODIN cadastrado.</div>'; return; }
  wrap.innerHTML = lista.map(p=>`
    <div class="qr-ponto-card">
      <div class="qpc-nome">${p.nome}</div>
      <div class="qpc-codin">CODIN ${p.codin}</div>
      <button class="btn btn-sm btn-primary" onclick="abrirQrPonto('${p.codin}','${p.nome.replace(/'/g,"\\'")}')">Gerar QR Code</button>
    </div>
  `).join('');
}
function renderLeitoresCheckModal(selecionados=[]){
  const c=document.getElementById('pt-leitores-check');
  c.innerHTML=state.leitores.length?state.leitores.map(l=>`<label class="check-item"><input type="checkbox" value="${l}" ${selecionados.includes(l)?'checked':''}>${l}</label>`).join(''):'<span style="color:var(--text2);font-size:12px">Adicione leitores em Configurações.</span>';
}
document.getElementById('pt-tipo').addEventListener('change',function(){ document.getElementById('pt-senha-block').style.display=this.value==='Restrito'?'flex':'none'; });
document.getElementById('btn-novo-ponto').addEventListener('click',()=>{
  editCtx={tipo:'ponto',idx:-1};
  document.getElementById('modal-ponto-title').textContent='Novo ponto';
  ['pt-nome','pt-codin','pt-senha-nova','pt-senha-conf'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pt-tipo').value='Público';
  document.getElementById('pt-senha-block').style.display='none';
  document.getElementById('pt-err').textContent='';
  renderLeitoresCheckModal(); abrirModal('modal-ponto');
});
window.editarPonto=function(i){
  const p=state.pontos[i]; editCtx={tipo:'ponto',idx:i};
  document.getElementById('modal-ponto-title').textContent='Editar ponto';
  document.getElementById('pt-nome').value=p.nome; document.getElementById('pt-codin').value=p.codin||'';
  document.getElementById('pt-tipo').value=p.tipo;
  document.getElementById('pt-senha-nova').value=''; document.getElementById('pt-senha-conf').value='';
  document.getElementById('pt-senha-block').style.display=p.tipo==='Restrito'?'flex':'none';
  const statusEl=document.getElementById('pt-senha-status');
  if(p.tipo==='Restrito'){statusEl.textContent=p.senhaHash?'✓ Senha definida — preencha para alterar.':'⚠ Nenhuma senha definida.';statusEl.style.color=p.senhaHash?'var(--green)':'var(--orange)';}
  document.querySelector('.senha-titulo-codin').textContent=`Senha do ponto${p.codin?' (CODIN '+p.codin+')':''}`;
  document.getElementById('pt-err').textContent='';
  renderLeitoresCheckModal(p.leitores||[]); abrirModal('modal-ponto');
};
document.getElementById('btn-salvar-ponto').addEventListener('click',()=>{
  const nome=document.getElementById('pt-nome').value.trim(),tipo=document.getElementById('pt-tipo').value,err=document.getElementById('pt-err');
  if(!nome){err.textContent='Nome obrigatório.';return;}
  let senhaHash=editCtx.idx>=0?(state.pontos[editCtx.idx].senhaHash||''):'';
  if(tipo==='Restrito'){
    const nova=document.getElementById('pt-senha-nova').value,conf=document.getElementById('pt-senha-conf').value;
    if(nova||conf){if(nova!==conf){err.textContent='Senhas não coincidem.';return;}if(nova.length<3){err.textContent='Senha muito curta.';return;}senhaHash=hashSimples(nova);}
    else if(!senhaHash){err.textContent='Defina uma senha para ponto restrito.';return;}
  }else{senhaHash='';}
  const leitoresSel=[...document.querySelectorAll('#pt-leitores-check input:checked')].map(x=>x.value);
  const idExistente = editCtx.idx>=0 ? state.pontos[editCtx.idx].id : null;
  const obj={id:idExistente||('pt-'+Date.now().toString(36)),nome,codin:document.getElementById('pt-codin').value.trim(),tipo,leitores:leitoresSel,senhaHash};
  if(editCtx.idx>=0)state.pontos[editCtx.idx]=obj; else state.pontos.push(obj);
  fecharModal('modal-ponto');renderPontos();agendarSalvamento();
  toast(editCtx.idx>=0?'Ponto atualizado!':'Ponto cadastrado!','success');
});
window.filtrarAcessos=function(){ renderAcessos((document.getElementById('busca-acessos').value||'').toLowerCase()); };
function renderAcessos(filtro=''){
  const tb=document.getElementById('tbody-acessos');
  let lista=state.acessos;
  if(filtro)lista=lista.filter(a=>a.pessoaId.toLowerCase().includes(filtro)||a.pessoaNome.toLowerCase().includes(filtro));
  if(!lista.length){tb.innerHTML='<tr><td colspan="6" class="empty-state">Nenhuma permissão atribuída.</td></tr>';return;}
  tb.innerHTML=lista.map((a,idx)=>{
    const i=state.acessos.indexOf(a);
    return`<tr><td><span class="mono">${a.pessoaId}</span></td><td>${a.pessoaNome}</td><td style="max-width:200px">${a.pub&&a.pub.length?a.pub.map(p=>`<span class="chip">${p}</span>`).join(''):'<span style="color:var(--text2)">—</span>'}</td><td style="max-width:200px">${a.priv&&a.priv.length?a.priv.map(p=>`<span class="chip chip-restrito">🔒 ${p}</span>`).join(''):'<span style="color:var(--text2)">—</span>'}</td><td style="font-family:var(--mono);font-size:11px;color:var(--text2)">${a.ini?formatDate(a.ini):'—'}${a.fim?' → '+formatDate(a.fim):''}</td><td><div class="row-actions"><button class="btn btn-sm" onclick="editarAcesso(${i})"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-sm btn-danger" onclick="confirmarDeletar('acesso',${i},'${(a.pessoaNome||'').replace(/'/g,"\\'")}')"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button></div></td></tr>`;
  }).join('');
}
function prepararModalAcesso(acessoExistente=null){
  const sel=document.getElementById('ac-pessoa');
  sel.innerHTML='<option value="">— selecione —</option>'+state.pessoas.map(p=>`<option value="${p.id}">${p.id} — ${p.nome}</option>`).join('');
  const ponPub=state.pontos.filter(p=>p.tipo!=='Restrito'),ponPriv=state.pontos.filter(p=>p.tipo==='Restrito');
  const selPub=acessoExistente?.pub||[],selPriv=acessoExistente?.priv||[];
  document.getElementById('ac-pontos-pub').innerHTML=ponPub.length?ponPub.map(p=>`<label class="check-item"><input type="checkbox" class="ac-pub" value="${p.nome}" ${selPub.includes(p.nome)?'checked':''}>${p.nome}</label>`).join(''):'<span style="color:var(--text2);font-size:12px">Nenhum ponto público.</span>';
  document.getElementById('ac-pontos-priv').innerHTML=ponPriv.length?ponPriv.map(p=>`<label class="check-item restrito"><input type="checkbox" class="ac-priv" value="${p.nome}" ${selPriv.includes(p.nome)?'checked':''} onchange="atualizarSenhasRestritas()">🔒 ${p.nome}</label>`).join(''):'<span style="color:var(--text2);font-size:12px">Nenhum ponto restrito.</span>';
  document.getElementById('ac-ini').value=acessoExistente?.ini||'';
  document.getElementById('ac-fim').value=acessoExistente?.fim||'';
  if(acessoExistente)sel.value=acessoExistente.pessoaId;
  atualizarSenhasRestritas();
  document.getElementById('ac-err').textContent='';
}
window.atualizarSenhasRestritas=function(){
  const privSel=[...document.querySelectorAll('.ac-priv:checked')].map(x=>x.value);
  const container=document.getElementById('ac-senhas-restritas');
  if(!privSel.length){container.style.display='none';container.innerHTML='';return;}
  container.style.display='flex';
  container.innerHTML=privSel.map(nome=>`<div class="senha-ponto-item"><span>🔒 <strong>${nome}</strong></span><input type="password" placeholder="Senha do ponto" data-ponto="${nome}" class="senha-ponto-inp"></div>`).join('');
};
document.getElementById('btn-novo-acesso').addEventListener('click',()=>{ editCtx={tipo:'acesso',idx:-1}; document.getElementById('modal-acesso-title').textContent='Atribuir permissão'; prepararModalAcesso(); abrirModal('modal-acesso'); });
window.editarAcesso=function(i){ editCtx={tipo:'acesso',idx:i}; document.getElementById('modal-acesso-title').textContent='Editar permissão'; prepararModalAcesso(state.acessos[i]); abrirModal('modal-acesso'); };
document.getElementById('btn-salvar-acesso').addEventListener('click',()=>{
  const pessoaId=document.getElementById('ac-pessoa').value,err=document.getElementById('ac-err');
  err.textContent='';
  if(!pessoaId){err.textContent='Selecione uma pessoa.';return;}
  const pubSel=[...document.querySelectorAll('.ac-pub:checked')].map(x=>x.value);
  const privSel=[...document.querySelectorAll('.ac-priv:checked')].map(x=>x.value);
  if(!pubSel.length&&!privSel.length){err.textContent='Selecione ao menos um ponto.';return;}
  if(privSel.length){
    for(const inp of document.querySelectorAll('.senha-ponto-inp')){
      const ponto=state.pontos.find(p=>p.nome===inp.dataset.ponto);
      if(!ponto)continue;
      if(!ponto.senhaHash){err.textContent=`Ponto "${inp.dataset.ponto}" sem senha definida.`;return;}
      if(!inp.value){err.textContent=`Informe a senha de "${inp.dataset.ponto}".`;inp.focus();return;}
      if(hashSimples(inp.value)!==ponto.senhaHash){err.textContent=`Senha incorreta para "${inp.dataset.ponto}".`;inp.value='';inp.focus();return;}
    }
  }
  const pessoa=state.pessoas.find(p=>p.id===pessoaId);
  const obj={pessoaId,pessoaNome:pessoa?.nome||pessoaId,pub:pubSel,priv:privSel,ini:document.getElementById('ac-ini').value,fim:document.getElementById('ac-fim').value};
  if(editCtx.idx>=0)state.acessos[editCtx.idx]=obj; else state.acessos.push(obj);
  fecharModal('modal-acesso');renderAcessos();agendarSalvamento();
  toast(editCtx.idx>=0?'Permissão atualizada!':'Permissão atribuída!','success');
});
function popularBuscaSelects(){
  document.getElementById('bq-pessoa-sel').innerHTML='<option value="">— ou selecione —</option>'+state.pessoas.map(p=>`<option value="${p.id}">${p.id} — ${p.nome}</option>`).join('');
  document.getElementById('bq-codin-sel').innerHTML='<option value="">— ou selecione ponto —</option>'+state.pontos.map(p=>`<option value="${p.codin||p.nome}">${p.codin?p.codin+' — ':''} ${p.nome}</option>`).join('');
  document.getElementById('bq-ponto-sel').innerHTML='<option value="">Qualquer ponto</option>'+state.pontos.map(p=>`<option value="${p.nome}">${p.nome}</option>`).join('');
}
window.buscaPorPessoa=function(){
  const txt=(document.getElementById('bq-pessoa').value||'').toLowerCase(),sel=document.getElementById('bq-pessoa-sel').value,res=document.getElementById('resultado-pessoa');
  const filtro=sel||txt; if(!filtro){res.innerHTML='';return;}
  const pessoa=sel?state.pessoas.find(p=>p.id===sel):state.pessoas.find(p=>p.id.toLowerCase().includes(txt)||p.nome.toLowerCase().includes(txt));
  if(!pessoa){res.innerHTML='<div style="color:var(--text2);font-size:12px;margin-top:8px">Nenhuma pessoa encontrada.</div>';return;}
  const acesso=state.acessos.find(a=>a.pessoaId===pessoa.id);
  res.innerHTML=`<div class="resultado-card"><div style="margin-bottom:8px"><strong>${pessoa.nome}</strong> <span class="mono" style="color:var(--text2)">${pessoa.id}</span> ${badge(pessoa.status)}</div><div style="font-size:12px;color:var(--text2);margin-bottom:6px">${pessoa.cargo||''}${pessoa.setor?' — '+pessoa.setor:''}</div>${acesso?`<div style="font-size:12px;margin-bottom:4px;color:var(--text2)">Pontos públicos:</div><div style="margin-bottom:8px">${acesso.pub&&acesso.pub.length?acesso.pub.map(p=>`<span class="chip">${p}</span>`).join(''):'<span style="color:var(--text2)">Nenhum</span>'}</div><div style="font-size:12px;margin-bottom:4px;color:var(--text2)">Pontos restritos:</div><div>${acesso.priv&&acesso.priv.length?acesso.priv.map(p=>`<span class="chip chip-restrito">🔒 ${p}</span>`).join(''):'<span style="color:var(--text2)">Nenhum</span>'}</div>${acesso.ini||acesso.fim?`<div style="font-size:11px;color:var(--text2);margin-top:8px;font-family:monospace">Vigência: ${acesso.ini?formatDate(acesso.ini):'—'} → ${acesso.fim?formatDate(acesso.fim):'sem fim'}</div>`:''}`:'<div style="color:var(--orange);font-size:12px">⚠ Nenhuma permissão atribuída.</div>'}</div>`;
};
window.buscaPorCodin=function(){
  const txt=(document.getElementById('bq-codin').value||'').toLowerCase();
  if(!txt){document.getElementById('resultado-codin').innerHTML='';return;}
  mostrarResultadoCodin(state.pontos.find(p=>(p.codin||'').toLowerCase().includes(txt)||p.nome.toLowerCase().includes(txt)));
};
window.buscaPorCodinSel=function(){
  const val=document.getElementById('bq-codin-sel').value;
  if(!val){document.getElementById('resultado-codin').innerHTML='';return;}
  mostrarResultadoCodin(state.pontos.find(p=>(p.codin||p.nome)===val));
};
function mostrarResultadoCodin(ponto){
  const res=document.getElementById('resultado-codin');
  if(!ponto){res.innerHTML='<div style="color:var(--text2);font-size:12px;margin-top:8px">Nenhum ponto encontrado.</div>';return;}
  const comAcesso=state.acessos.filter(a=>(a.pub||[]).includes(ponto.nome)||(a.priv||[]).includes(ponto.nome));
  res.innerHTML=`<div class="resultado-card"><div style="margin-bottom:8px"><strong>${ponto.nome}</strong> ${ponto.codin?`<span class="mono" style="color:var(--blue)">CODIN: ${ponto.codin}</span>`:''} ${badgePonto(ponto.tipo)}</div><div style="font-size:12px;color:var(--text2);margin-bottom:8px">Leitores: ${ponto.leitores.length?ponto.leitores.map(l=>`<span class="chip">${l}</span>`).join(''):'nenhum'}</div><div style="font-size:12px;font-weight:600;margin-bottom:6px">Pessoas com acesso (${comAcesso.length}):</div>${comAcesso.length?comAcesso.map(a=>{const pessoa=state.pessoas.find(p=>p.id===a.pessoaId);const restrito=(a.priv||[]).includes(ponto.nome);return`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px"><span class="mono" style="color:var(--text2)">${a.pessoaId}</span><span>${a.pessoaNome}</span>${pessoa?badge(pessoa.status):''}${restrito?'<span class="badge badge-restrito">🔒 restrito</span>':'<span class="badge badge-publico">público</span>'}</div>`;}).join(''):'<div style="color:var(--text2);font-size:12px">Nenhuma pessoa com acesso.</div>'}</div>`;
}
window.buscaPorPermissao=function(){
  const tipo=document.getElementById('bq-tipo-acesso').value,ponto=document.getElementById('bq-ponto-sel').value,res=document.getElementById('resultado-permissao');
  let lista=state.acessos;
  if(tipo==='publico')lista=lista.filter(a=>a.pub&&a.pub.length&&(!a.priv||!a.priv.length));
  if(tipo==='restrito')lista=lista.filter(a=>a.priv&&a.priv.length);
  if(tipo==='sem'){const comAcesso=new Set(state.acessos.map(a=>a.pessoaId));const semAcesso=state.pessoas.filter(p=>!comAcesso.has(p.id));res.innerHTML=semAcesso.length?`<div class="resultado-card"><div style="font-size:12px;font-weight:600;margin-bottom:8px">Sem permissão (${semAcesso.length}):</div>${semAcesso.map(p=>`<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;display:flex;gap:8px;align-items:center"><span class="mono" style="color:var(--text2)">${p.id}</span><span>${p.nome}</span>${badge(p.status)}</div>`).join('')}</div>`:'<div class="resultado-card">Todas as pessoas têm permissão.</div>';return;}
  if(ponto)lista=lista.filter(a=>(a.pub||[]).includes(ponto)||(a.priv||[]).includes(ponto));
  res.innerHTML=lista.length?`<div class="resultado-card"><div style="font-size:12px;font-weight:600;margin-bottom:8px">Resultados (${lista.length}):</div>${lista.map(a=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px"><span class="mono" style="color:var(--text2)">${a.pessoaId}</span><span>${a.pessoaNome}</span></div><div>${(a.pub||[]).map(p=>`<span class="chip">${p}</span>`).join('')}${(a.priv||[]).map(p=>`<span class="chip chip-restrito">🔒 ${p}</span>`).join('')}</div></div>`).join('')}</div>`:'<div style="color:var(--text2);font-size:12px;margin-top:8px">Nenhum resultado.</div>';
};
function renderMatriz(){
  const wrap=document.getElementById('matriz-wrap');
  if(!state.pontos.length||!state.leitores.length){wrap.innerHTML='<div class="empty-state" style="padding:48px">Configure pontos e leitores.</div>';return;}
  let html='<table class="table matriz-table"><thead><tr><th>Ponto</th><th>Tipo</th><th>CODIN</th>';
  state.leitores.forEach(l=>{html+=`<th style="text-align:center;font-family:var(--mono)">${l}</th>`;});
  html+='</tr></thead><tbody>';
  state.pontos.forEach(p=>{html+=`<tr><td>${p.nome}</td><td>${badgePonto(p.tipo)}</td><td><span class="mono">${p.codin||'—'}</span></td>`;state.leitores.forEach(l=>{html+=p.leitores.includes(l)?'<td class="matriz-cell-ok">✓</td>':'<td class="matriz-cell-empty">·</td>';});html+='</tr>';});
  html+='</tbody></table>';
  wrap.innerHTML=html;
}
function renderLeitoresCfg(){ document.getElementById('leitores-list').innerHTML=state.leitores.map((l,i)=>`<span class="chip-tag">${l}<button onclick="removerLeitor(${i})" title="Remover">×</button></span>`).join(''); }
document.getElementById('btn-add-leitor').addEventListener('click',adicionarLeitor);
document.getElementById('novo-leitor-inp').addEventListener('keydown',e=>{if(e.key==='Enter')adicionarLeitor();});
function adicionarLeitor(){
  const val=document.getElementById('novo-leitor-inp').value.trim(); if(!val)return;
  const novos=val.split(',').map(x=>x.trim()).filter(x=>x&&!state.leitores.includes(x));
  if(!novos.length){toast('Leitor já existe.');return;}
  state.leitores.push(...novos); state.leitores.sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b));
  document.getElementById('novo-leitor-inp').value=''; renderLeitoresCfg(); agendarSalvamento();
  toast(`${novos.length} leitor(es) adicionado(s).`,'success');
}
window.removerLeitor=function(i){state.leitores.splice(i,1);renderLeitoresCfg();agendarSalvamento();};
document.getElementById('btn-exportar').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`backup-codin-${new Date().toISOString().slice(0,10)}.json`;a.click();
  toast('Backup exportado!','success');
});
window.confirmarDeletar=function(tipo,idx,nome){
  const msgs={pessoa:`Remover "${nome}"?`,ponto:`Remover o ponto "${nome}"?`,acesso:`Remover o acesso de "${nome}"?`};
  document.getElementById('confirm-msg').textContent=msgs[tipo];
  confirmCallback=()=>{
    if(tipo==='pessoa'){state.pessoas.splice(idx,1);renderPessoas();}
    if(tipo==='ponto'){state.pontos.splice(idx,1);renderPontos();renderMatriz();}
    if(tipo==='acesso'){state.acessos.splice(idx,1);renderAcessos();}
    updateDashboard();agendarSalvamento();toast('Removido!','success');
  };
  abrirModal('modal-confirm');
};
document.getElementById('btn-confirm-del').addEventListener('click',()=>{if(confirmCallback){confirmCallback();confirmCallback=null;}fecharModal('modal-confirm');});
let modoAcesso = 'leitor';
let leitorSelecionado = null;
window.setModoAcesso = function(modo){
  modoAcesso = modo;
  document.querySelectorAll('.modo-btn').forEach(b=>b.classList.toggle('active', b.dataset.modo===modo));
  document.querySelectorAll('.modo-panel').forEach(p=>p.classList.toggle('active', p.id==='modo-'+modo));
};
function renderLeitorChips(){
  const container = document.getElementById('leitor-chips');
  if(!state.leitores.length){
    container.innerHTML='<span style="color:var(--text2);font-size:12px">Nenhum leitor cadastrado em Configurações.</span>';
    return;
  }
  container.innerHTML = state.leitores.map(l=>`
    <span class="leitor-chip" data-leitor="${l}" onclick="selecionarLeitor('${l}')">${l}</span>
  `).join('');
}
window.selecionarLeitor = function(leitor){
  leitorSelecionado = leitor;
  document.querySelectorAll('.leitor-chip').forEach(c=>{
    c.classList.toggle('selected', c.dataset.leitor===leitor);
  });
  const pontos = state.pontos.filter(p=>(p.leitores||[]).includes(leitor));
  const container = document.getElementById('pontos-do-leitor');
  const lista = document.getElementById('lista-pontos-leitor');
  const title = document.getElementById('pontos-leitor-title');
  if(!pontos.length){
    container.style.display='block';
    lista.innerHTML='<div style="color:var(--text2);font-size:12px;padding:8px 0">Nenhum ponto associado ao leitor '+leitor+'.</div>';
    document.getElementById('ac-senhas-restritas-leitor').style.display='none';
    return;
  }
  title.textContent = `Pontos do leitor ${leitor} (${pontos.length})`;
  container.style.display='block';
  lista.innerHTML = pontos.map(p=>`
    <div class="ponto-item-leitor">
      <label>
        <input type="checkbox" class="ac-ponto-leitor" value="${p.nome}" data-tipo="${p.tipo}"
          onchange="atualizarSenhasLeitor()">
        <span class="ponto-nome">${p.nome}</span>
        ${p.codin?`<span class="ponto-codin">CODIN: ${p.codin}</span>`:''}
      </label>
      ${p.tipo==='Restrito'?'<span class="badge badge-restrito" style="font-size:10px">🔒 Restrito</span>':'<span class="badge badge-publico" style="font-size:10px">Público</span>'}
    </div>
  `).join('');
  atualizarSenhasLeitor();
};
window.atualizarSenhasLeitor = function(){
  const privSel = [...document.querySelectorAll('.ac-ponto-leitor:checked')]
    .filter(x=>x.dataset.tipo==='Restrito')
    .map(x=>x.value);
  const container = document.getElementById('ac-senhas-restritas-leitor');
  if(!privSel.length){ container.style.display='none'; container.innerHTML=''; return; }
  container.style.display='flex';
  container.innerHTML = privSel.map(nome=>`
    <div class="senha-ponto-item">
      <span>🔒 <strong>${nome}</strong> — informe a senha do ponto</span>
      <input type="password" placeholder="Senha do ponto" data-ponto="${nome}" class="senha-ponto-inp-leitor">
    </div>`).join('');
};
const _prepararModalAcessoOrig = window.prepararModalAcesso || function(){};
function prepararModalAcesso(acessoExistente=null){
  const sel=document.getElementById('ac-pessoa');
  sel.innerHTML='<option value="">— selecione —</option>'+state.pessoas.map(p=>`<option value="${p.id}">${p.id} — ${p.nome}</option>`).join('');
  const ponPub=state.pontos.filter(p=>p.tipo!=='Restrito'),ponPriv=state.pontos.filter(p=>p.tipo==='Restrito');
  const selPub=acessoExistente?.pub||[],selPriv=acessoExistente?.priv||[];
  document.getElementById('ac-pontos-pub').innerHTML=ponPub.length?ponPub.map(p=>`<label class="check-item"><input type="checkbox" class="ac-pub" value="${p.nome}" ${selPub.includes(p.nome)?'checked':''}>${p.nome}</label>`).join(''):'<span style="color:var(--text2);font-size:12px">Nenhum ponto público.</span>';
  document.getElementById('ac-pontos-priv').innerHTML=ponPriv.length?ponPriv.map(p=>`<label class="check-item restrito"><input type="checkbox" class="ac-priv" value="${p.nome}" ${selPriv.includes(p.nome)?'checked':''} onchange="atualizarSenhasRestritas()">🔒 ${p.nome}</label>`).join(''):'<span style="color:var(--text2);font-size:12px">Nenhum ponto restrito.</span>';
  document.getElementById('ac-ini').value=acessoExistente?.ini||'';
  document.getElementById('ac-fim').value=acessoExistente?.fim||'';
  if(acessoExistente)sel.value=acessoExistente.pessoaId;
  atualizarSenhasRestritas();
  document.getElementById('ac-err').textContent='';
  leitorSelecionado=null;
  document.getElementById('pontos-do-leitor').style.display='none';
  renderLeitorChips();
  setModoAcesso('leitor');
}
document.getElementById('btn-salvar-acesso').addEventListener('click',()=>{
  const pessoaId=document.getElementById('ac-pessoa').value,err=document.getElementById('ac-err');
  err.textContent='';
  if(!pessoaId){err.textContent='Selecione uma pessoa.';return;}

  let pubSel=[], privSel=[];

  if(modoAcesso==='leitor'){
    if(!leitorSelecionado){err.textContent='Selecione um leitor.';return;}
    const checked=[...document.querySelectorAll('.ac-ponto-leitor:checked')];
    if(!checked.length){err.textContent='Selecione ao menos um ponto do leitor.';return;}
    checked.forEach(x=>{
      if(x.dataset.tipo==='Restrito') privSel.push(x.value);
      else pubSel.push(x.value);
    });
    if(privSel.length){
      for(const inp of document.querySelectorAll('.senha-ponto-inp-leitor')){
        const ponto=state.pontos.find(p=>p.nome===inp.dataset.ponto);
        if(!ponto)continue;
        if(!ponto.senhaHash){err.textContent=`Ponto "${inp.dataset.ponto}" sem senha definida.`;return;}
        if(!inp.value){err.textContent=`Informe a senha de "${inp.dataset.ponto}".`;inp.focus();return;}
        if(hashSimples(inp.value)!==ponto.senhaHash){err.textContent=`Senha incorreta para "${inp.dataset.ponto}".`;inp.value='';inp.focus();return;}
      }
    }
  } else {
    pubSel=[...document.querySelectorAll('.ac-pub:checked')].map(x=>x.value);
    privSel=[...document.querySelectorAll('.ac-priv:checked')].map(x=>x.value);
    if(!pubSel.length&&!privSel.length){err.textContent='Selecione ao menos um ponto.';return;}
    if(privSel.length){
      for(const inp of document.querySelectorAll('.senha-ponto-inp')){
        const ponto=state.pontos.find(p=>p.nome===inp.dataset.ponto);
        if(!ponto)continue;
        if(!ponto.senhaHash){err.textContent=`Ponto "${inp.dataset.ponto}" sem senha definida.`;return;}
        if(!inp.value){err.textContent=`Informe a senha de "${inp.dataset.ponto}".`;inp.focus();return;}
        if(hashSimples(inp.value)!==ponto.senhaHash){err.textContent=`Senha incorreta para "${inp.dataset.ponto}".`;inp.value='';inp.focus();return;}
      }
    }
  }

  const pessoa=state.pessoas.find(p=>p.id===pessoaId);
  let objFinal = {pessoaId,pessoaNome:pessoa?.nome||pessoaId,pub:pubSel,priv:privSel,ini:document.getElementById('ac-ini').value,fim:document.getElementById('ac-fim').value};
  if(editCtx.idx>=0 && modoAcesso==='leitor'){
    const existing=state.acessos[editCtx.idx];
    const mergedPub=[...new Set([...(existing.pub||[]),...pubSel])];
    const mergedPriv=[...new Set([...(existing.priv||[]),...privSel])];
    objFinal={...objFinal,pub:mergedPub,priv:mergedPriv};
  }
  if(editCtx.idx>=0)state.acessos[editCtx.idx]=objFinal; else state.acessos.push(objFinal);
  fecharModal('modal-acesso');renderAcessos();agendarSalvamento();
  toast(editCtx.idx>=0?'Permissão atualizada!':'Permissão atribuída!','success');
});