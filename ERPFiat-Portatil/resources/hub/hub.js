'use strict';
const user = window.__authUser || { nome: '—', role: '—', avatar: '?' };
const $=id=>document.getElementById(id);
const fmtRK=v=>{if(!v&&v!==0)return'—';const n=+v;if(Math.abs(n)>=1e6)return'R$'+(n/1e6).toFixed(1)+'M';if(Math.abs(n)>=1e3)return'R$'+(n/1e3).toFixed(1)+'k';return'R$'+Math.round(n);};

const DEFAULT = {
  identidade: { brand:'Controler', brandEnv:'ERP Facilities', instNome:'—', instSub:'—', instBadge:'—' },
  painelEsq:  { valores:'—', objetivo:'—', objProg:0, objPrazo:'—', missao:'—', metas:[] },
  kpisMini: [
    { lbl:'Obras em andamento',    val:'—', cls:'yw', sub:'carregando...', bar:0, barCor:'var(--yw)' },
    { lbl:'Chamados abertos',      val:'—', cls:'rd', sub:'carregando...', bar:0, barCor:'var(--rd)' },
    { lbl:'Atividades concluídas', val:'—', cls:'gn', sub:'carregando...', bar:0, barCor:'var(--gn)' },
    { lbl:'Budget executado',      val:'—', cls:'bl', sub:'carregando...', bar:0, barCor:'var(--bl)' },
  ],
  acoes:      [],
  atividades: [],
  logos:      ['','','',''],
};

let CFG=JSON.parse(JSON.stringify(DEFAULT));

function buildLogos(){
  const wrap=$('logos-wrap');
  const logos=CFG.logos||['','','',''];
  wrap.innerHTML=logos.map((src,i)=>`
    <div class="logo-slot" title="Clique para carregar logo ${i+1}">
      <img id="logo-img-${i}" class="logo-img${src?' loaded':''}" src="${src||''}" alt="Logo ${i+1}">
      <span class="logo-placeholder" id="logo-ph-${i}" style="${src?'display:none':''}">Logo ${i+1}</span>
      <input type="file" class="logo-input" accept="image/*" data-idx="${i}">
    </div>`).join('');
  wrap.querySelectorAll('.logo-input').forEach(inp=>{
    inp.addEventListener('change',function(){
      const i=+this.dataset.idx;
      const f=this.files[0];if(!f)return;
      const r=new FileReader();
      r.onload=e=>{
        const src=e.target.result;
        CFG.logos[i]=src;
        const img=$('logo-img-'+i);const ph=$('logo-ph-'+i);
        img.src=src;img.classList.add('loaded');ph.style.display='none';
        saveCFG();
      };r.readAsDataURL(f);
    });
  });
}

function tick(){
  const n=new Date();
  $('el-clock').textContent=[n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
  const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  $('el-date').textContent=n.getDate()+' '+months[n.getMonth()]+' '+n.getFullYear();
}
tick();setInterval(tick,1000);

function applyIdent(){
  const id=CFG.identidade||{};
  if(id.brand)$('el-brand').textContent=id.brand;
  if(id.brandEnv)$('el-brand-env').textContent=id.brandEnv;
  if(id.instNome)$('el-inst-nome').textContent=id.instNome;
  if(id.instSub)$('el-inst-sub').textContent=id.instSub;
  if(id.instBadge)$('el-inst-badge').textContent=id.instBadge;
}

function buildActs(){}
function updateActPct(){}

function renderAlertas(kpiDados){
  const wrap=$('sb-alertas');
  if(!wrap)return;
  const alertas=[];
  // Chamados críticos abertos
  const cham=(kpiDados?.chamados?.chamados)||[];
  const criticos=cham.filter(c=>c.prioridade==='Critica'&&!['Resolvido','Fechado','Concluido','Concluído'].includes(c.status));
  if(criticos.length){
    alertas.push({cor:'var(--rd)',ico:'🔴',txt:`${criticos.length} chamado${criticos.length>1?'s':''} crítico${criticos.length>1?'s':''} em aberto`,href:'/chamados'});
  }
  // Obras com prazo vencido
  const obras=(kpiDados?.obras?.obras)||[];
  const hoje=new Date();
  const atrasadas=obras.filter(o=>o.dtFimPrev&&!o.dtFimReal&&new Date(o.dtFimPrev+'T00:00:00')<hoje&&o.status==='Em Andamento');
  if(atrasadas.length){
    alertas.push({cor:'var(--or)',ico:'🟠',txt:`${atrasadas.length} obra${atrasadas.length>1?'s':''} com prazo vencido`,href:'/obras'});
  }
  // Preventivas vencendo
  const ucs=(kpiDados?.conforto?.ucs)||[];
  const prevs=(kpiDados?.conforto?.preventivas)||[];
  const vencendo=ucs.filter(u=>{
    const ult=prevs.filter(p=>p.ucId===u.id&&p.status==='Realizada').sort((a,b)=>new Date(b.dataRealizada)-new Date(a.dataRealizada))[0];
    if(!ult)return true;
    return Math.floor((hoje-new Date(ult.dataRealizada))/86400000)>=(u.cicloFiltroDias||90)-14;
  });
  if(vencendo.length){
    alertas.push({cor:'var(--yw)',ico:'🟡',txt:`${vencendo.length} UC${vencendo.length>1?'s':''} com preventiva vencendo`,href:'/conforto'});
  }
  // Solicitações CODIN pendentes
  const solics=(kpiDados?.codin?.solicitacoes)||[];
  const solicPend=solics.filter(s=>s.status==='Pendente');
  if(solicPend.length){
    alertas.push({cor:'var(--blue-mid)',ico:'🔵',txt:`${solicPend.length} solicitação${solicPend.length>1?'s':''} de acesso pendente${solicPend.length>1?'s':''}`,href:'/codin'});
  }
  if(!alertas.length){
    wrap.innerHTML=`<div class="sb-alerta-ok"><span style="font-size:16px">✅</span><span>Nenhuma pendência no momento</span></div>`;
    return;
  }
  wrap.innerHTML=alertas.map(a=>`
    <a class="sb-alerta-item" href="${a.href}" style="border-left-color:${a.cor}">
      <span class="sb-alerta-ico">${a.ico}</span>
      <span class="sb-alerta-txt">${a.txt}</span>
    </a>`).join('');
}
function buildKpiMini(){
  const kpis=CFG.kpisMini||[];
  $('el-kpi-mini').innerHTML=kpis.map((k,i)=>`
    <div class="kpi-box">
      <div class="kpi-lbl">${k.lbl}</div>
      <div class="kpi-val ${k.cls}" id="kpi-val-${i}">${k.val}</div>
      <div class="kpi-sub" id="kpi-sub-${i}">${k.sub}</div>
      <div class="kpi-bar"><div class="kpi-bar-fill" id="kpi-bar-${i}" style="width:${k.bar}%;background:${k.barCor}"></div></div>
    </div>`).join('');
}
function buildVidKpis(){}

function buildAcoes(){
  const acoes=(CFG.acoes||[]).filter(a=>a.visivel!==false);
  $('el-acoes-count').textContent=acoes.length+' planejadas';
  $('el-acoes').innerHTML=acoes.map(a=>`
    <div class="acard ${a.status}">
      <div class="acard-top">
        <div class="acard-ttl">${a.titulo}</div>
        <div class="acard-st st-${a.status}">${a.status==='urg'?'Urgente':a.status==='prog'?'Andamento':a.status==='rev'?'Revisão':'Planejado'}</div>
      </div>
      <div class="acard-ft">
        <div class="acard-dt">${a.prazo}</div>
        <div class="acard-av">${a.resp}</div>
      </div>
    </div>`).join('');
}

function buildVMO(){
  const pe=CFG.painelEsq||{};
  const prog=pe.objProg||0;
  const cores=['var(--gn)','var(--yw)','var(--blue-mid)'];
  const metasHTML=(pe.metas||[]).map((m,i)=>`<div class="meta-item"><div class="meta-dot" style="background:${cores[i%3]}"></div>${m}</div>`).join('');
  $('el-vmo').innerHTML=`
    <div class="vmo-item">
      <div class="vmo-lbl">Valores</div>
      <div class="vmo-val">${pe.valores||'—'}</div>
    </div>
    <div class="vmo-item">
      <div class="vmo-lbl">Objetivo 2026</div>
      <div class="vmo-val">${pe.objetivo||'—'}</div>
      <div class="vmo-bar"><div class="vmo-fill" style="width:0" id="obj-fill"></div></div>
      <div class="vmo-prog">${prog}% — ${pe.objPrazo||''}</div>
    </div>
    <div class="vmo-item">
      <div class="vmo-lbl">Missão</div>
      <div class="vmo-val">${pe.missao||'—'}</div>
    </div>
    <div class="vmo-item">
      <div class="vmo-lbl">Metas do Mês</div>
      <div class="metas-list">${metasHTML}</div>
    </div>`;
  setTimeout(()=>{const f=$('obj-fill');if(f){f.style.transition='width 1.2s ease';f.style.width=prog+'%';}},400);
}

let _painelDados = null;
let _painelMod = 'obras';

function fmtRKs(v){ if(!v&&v!==0)return'—';const n=+v;if(Math.abs(n)>=1e6)return'R$'+(n/1e6).toFixed(1)+'M';if(Math.abs(n)>=1e3)return'R$'+(n/1e3).toFixed(1)+'k';return'R$'+Math.round(n); }
function hpBar(pct,cor){ return `<div class="hp-bar-wrap"><div class="hp-bar-fill" style="width:${Math.min(pct,100)}%;background:${cor}"></div></div>`; }
function hpBadge(txt,cls){ return `<span class="hp-row-badge hp-badge-${cls}">${txt}</span>`; }

function renderPainelObras(d){
  const obras=(d.obras?.obras||[]).filter(o=>o.status==='Em Andamento'||o.status==='Planejado'||o.status==='Em Estudo');
  if(!obras.length) return '<div class="hp-vazio">Nenhuma obra ativa.</div>';
  const corStatus={  'Em Andamento':'orange','Planejado':'blue','Em Estudo':'gray','Concluído':'green','Suspenso':'red'};
  return `<div class="hp-sec">Obras ativas — ${obras.length}</div>`+obras.slice(0,8).map(o=>{
    const av=o.etapas?.length?Math.round(o.etapas.reduce((s,e)=>s+(e.avancoFisico||0),0)/o.etapas.length):0;
    const corAv=av>=80?'#1a7f4b':av>=40?'#b07d00':'#2E5FA3';
    return`<div class="hp-row">
      <div style="flex:1;min-width:0"><div class="hp-row-nome">${o.nome}</div><div class="hp-row-sub">${o.responsavel||o.respNome||'—'} · ${o.local||'—'}</div></div>
      ${hpBar(av,corAv)}
      <span style="font-family:var(--mono);font-size:11px;color:${corAv};min-width:32px;text-align:right">${av}%</span>
      ${hpBadge(o.status,corStatus[o.status]||'gray')}
    </div>`;
  }).join('');
}

function renderPainelCapex(d){
  const budget=d.obras?.budget||[];
  const lanc=d.obras?.lancamentos||[];
  const obras=d.obras?.obras||[];
  const totalB=budget.reduce((s,b)=>s+(b.budgetAprov||0),0);
  const totalR=lanc.reduce((s,l)=>s+l.qtd*l.precoUnit,0);
  const pct=totalB>0?Math.round(totalR/totalB*100):0;
  const cor=pct>=100?'#c0392b':pct>=80?'#b07d00':'#2E5FA3';
  const porObra=obras.map(o=>({
    nome:o.nome,cod:o.cod,
    budget:budget.filter(b=>b.obraCod===o.cod).reduce((s,b)=>s+(b.budgetAprov||0),0),
    real:lanc.filter(l=>l.obraCod===o.cod).reduce((s,l)=>s+l.qtd*l.precoUnit,0)
  })).filter(x=>x.budget>0).sort((a,b)=>b.real-a.real).slice(0,7);
  return`<div class="hp-sec">Resumo geral</div>
    <div class="hp-row">
      <div style="flex:1"><div class="hp-row-nome">Budget total aprovado</div></div>
      <div class="hp-row-val">${fmtRKs(totalB)}</div>
    </div>
    <div class="hp-row">
      <div style="flex:1"><div class="hp-row-nome">Executado</div></div>
      ${hpBar(pct,cor)}
      <div class="hp-row-val" style="color:${cor}">${fmtRKs(totalR)}</div>
    </div>
    <div class="hp-row">
      <div style="flex:1"><div class="hp-row-nome">Disponível</div></div>
      <div class="hp-row-val" style="color:#1a7f4b">${fmtRKs(Math.max(totalB-totalR,0))}</div>
    </div>
    <div class="hp-sec">Por obra</div>`+
  porObra.map(o=>{
    const p=o.budget>0?Math.round(o.real/o.budget*100):0;
    const c=p>=100?'#c0392b':p>=80?'#b07d00':'#2E5FA3';
    return`<div class="hp-row">
      <div style="flex:1;min-width:0"><div class="hp-row-nome">${o.nome}</div><div class="hp-row-sub">Budget: ${fmtRKs(o.budget)}</div></div>
      ${hpBar(p,c)}
      <div class="hp-row-val" style="color:${c}">${fmtRKs(o.real)}</div>
    </div>`;
  }).join('');
}

function renderPainelAtividades(d){
  const ativs=d.atividades?.atividades||[];
  if(!ativs.length) return '<div class="hp-vazio">Nenhuma atividade cadastrada.</div>';
  const hoje=new Date().toISOString().slice(0,10);
  const pendentes=ativs.filter(a=>a.status==='todo'||a.status==='doing'||a.status==='blocked');
  const concHoje=ativs.filter(a=>a.status==='done'&&(a.atualizado_em||'').slice(0,10)===hoje);
  const corStatus={todo:'gray',doing:'orange',blocked:'red',done:'green'};
  const lblStatus={todo:'A Fazer',doing:'Em Andamento',blocked:'Bloqueado',done:'Concluído'};
  return`<div class="hp-sec">Pendentes — ${pendentes.length}</div>`+
  pendentes.slice(0,6).map(a=>`<div class="hp-row">
    <div style="flex:1;min-width:0"><div class="hp-row-nome">${a.titulo}</div><div class="hp-row-sub">${a.responsavel||'—'}${a.prazo?' - '+a.prazo.split('-').reverse().join('/'):''}</div></div>
    ${hpBadge(lblStatus[a.status]||a.status,corStatus[a.status]||'gray')}
  </div>`).join('')+
  (concHoje.length?`<div class="hp-sec">Concluídas hoje — ${concHoje.length}</div>`+concHoje.slice(0,3).map(a=>`<div class="hp-row">
    <div style="flex:1;min-width:0"><div class="hp-row-nome" style="color:var(--text-muted)">${a.titulo}</div></div>
    ${hpBadge('Concluído','green')}
  </div>`).join(''):'');
}

function renderPainelConforto(d){
  const ucs=d.conforto?.ucs||[];
  const prevs=d.conforto?.preventivas||[];
  const hoje=new Date();
  const vencendo=ucs.filter(u=>{
    const ult=prevs.filter(p=>p.ucId===u.id&&p.status==='Realizada').sort((a,b)=>new Date(b.dataRealizada)-new Date(a.dataRealizada))[0];
    if(!ult)return true;
    return Math.floor((hoje-new Date(ult.dataRealizada))/86400000)>=(u.cicloFiltroDias||90)-14;
  });
  const ultPrevs=prevs.filter(p=>p.status==='Realizada').sort((a,b)=>new Date(b.dataRealizada)-new Date(a.dataRealizada)).slice(0,5);
  return`<div class="hp-sec">UCs: ${ucs.length} | Preventivas vencendo (14d): ${vencendo.length}</div>`+
  (vencendo.length?vencendo.slice(0,4).map(u=>`<div class="hp-row">
    <div style="flex:1;min-width:0"><div class="hp-row-nome">${u.nome||u.codigo||u.id}</div><div class="hp-row-sub">${u.local||'—'} - ${u.modelo||'—'}</div></div>
    ${hpBadge('Vence em breve','red')}
  </div>`).join(''):'<div class="hp-vazio" style="padding:8px 0">Nenhuma preventiva vencendo.</div>')+
  (ultPrevs.length?`<div class="hp-sec">Últimas preventivas realizadas</div>`+ultPrevs.map(p=>{
    const uc=ucs.find(u=>u.id===p.ucId);
    const dt=p.dataRealizada?new Date(p.dataRealizada).toLocaleDateString('pt-BR'):'—';
    return`<div class="hp-row">
      <div style="flex:1;min-width:0"><div class="hp-row-nome">${uc?.nome||p.ucId||'—'}</div><div class="hp-row-sub">${p.tecnicoId||'—'} - ${dt}</div></div>
      ${hpBadge('Realizada','green')}
    </div>`;
  }).join(''):'');
}

function renderPainelAcesso(d){
  const pessoas=d.codin?.pessoas||[];
  const pontos=d.codin?.pontos||[];
  const solicitacoes=d.codin?.solicitacoes||[];
  const ativos=pessoas.filter(p=>p.status==='Ativo'||!p.status).length;
  const pendentes=solicitacoes.filter(s=>s.status==='Pendente');
  return`<div class="hp-sec">Pessoas: ${pessoas.length} | ${ativos} ativas</div>`+
  `<div class="hp-row"><div style="flex:1"><div class="hp-row-nome">Total de pessoas</div></div><div class="hp-row-val">${pessoas.length}</div></div>`+
  `<div class="hp-row"><div style="flex:1"><div class="hp-row-nome">Ativas</div></div>${hpBar(pessoas.length?Math.round(ativos/pessoas.length*100):0,'#1a7f4b')}<div class="hp-row-val" style="color:#1a7f4b">${ativos}</div></div>`+
  `<div class="hp-row"><div style="flex:1"><div class="hp-row-nome">Pontos CODIN</div></div><div class="hp-row-val">${pontos.length}</div></div>`+
  (pendentes.length?`<div class="hp-sec">Solicitações pendentes — ${pendentes.length}</div>`+pendentes.slice(0,4).map(s=>`<div class="hp-row">
    <div style="flex:1;min-width:0"><div class="hp-row-nome">${s.nome||s.email||'—'}</div><div class="hp-row-sub">CODIN ${s.codin||'—'} - ${s.data?new Date(s.data).toLocaleDateString('pt-BR'):'—'}</div></div>
    ${hpBadge('Pendente','orange')}
  </div>`).join(''):`<div class="hp-sec">Solicitações</div><div class="hp-vazio" style="padding:8px 0">Nenhuma pendente.</div>`);
}

function renderPainelErgonomia(){
  return`<div class="hp-vazio" style="padding:40px 0">
    <div style="font-size:24px;margin-bottom:8px">🚧</div>
    <div style="font-weight:600;color:var(--text);margin-bottom:4px">Ergonomia</div>
    <div>Módulo em desenvolvimento</div>
  </div>`;
}

function renderPainel(mod){
  const body=$('hp-body');
  if(!body)return;
  _painelMod=mod;
  if(!_painelDados){body.innerHTML='<div class="hp-loading">Carregando dados...</div>';return;}
  const renders={
    obras:()=>renderPainelObras(_painelDados),
    capex:()=>renderPainelCapex(_painelDados),
    atividades:()=>renderPainelAtividades(_painelDados),
    conforto:()=>renderPainelConforto(_painelDados),
    acesso:()=>renderPainelAcesso(_painelDados),
    ergonomia:()=>renderPainelErgonomia(),
  };
  body.innerHTML=(renders[mod]||renders.obras)();
}

document.getElementById('hp-tabs').querySelectorAll('.hp-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.hp-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderPainel(btn.dataset.mod);
  });
});

async function carregarPainel(){
  try{
    const kpi=await API.kpi.dados();
    _painelDados=kpi;
    renderPainel(_painelMod);
    renderAlertas(kpi);
  }catch(e){
    const b=$('hp-body');
    if(b)b.innerHTML='<div class="hp-vazio">Erro ao carregar dados.</div>';
    const w=$('sb-alertas');
    if(w)w.innerHTML='<div class="sb-alerta-loading">Erro ao carregar.</div>';
  }
}

function setKpi(i,val,sub,bar){
  const update=prefix=>{
    const v=$(prefix+'kpi-val-'+i);const s=$(prefix+'kpi-sub-'+i);const b=$(prefix+'kpi-bar-'+i);
    if(v)v.textContent=val;if(s)s.textContent=sub;if(b){b.style.transition='width .8s ease';b.style.width=Math.min(bar,100)+'%';}
  };
  update('');update('mp-');
  if(CFG.kpisMini[i]){CFG.kpisMini[i].val=val;CFG.kpisMini[i].sub=sub;CFG.kpisMini[i].bar=bar;}
}

function mkMini(items){ return items.map(([val,lbl])=>`<div class="mod-mini-kpi"><div class="mod-mini-kpi-val">${val}</div><div class="mod-mini-kpi-lbl">${lbl}</div></div>`).join(''); }

function preencherModCards(d){
  const obraInfo = d.obras || {};
  const chamInfo = d.chamados || {};
  const cardObras = document.querySelector('a[href="/obras"] .mod-card-sub');
  if (cardObras && obraInfo.total != null) cardObras.textContent = obraInfo.total + ' cadastradas';
  const cardCham = document.querySelector('a[href="/chamados"] .mod-card-sub');
  if (cardCham && chamInfo.total != null) cardCham.textContent = chamInfo.abertos + ' em aberto · ' + chamInfo.total + ' total';
}

function preencherModCardsKpi(kpi){
  // Atividades
  const ativs = kpi.atividades?.atividades || [];
  const atPend = ativs.filter(a=>a.status==='todo'||a.status==='doing').length;
  const atConc = ativs.filter(a=>a.status==='done').length;
  const miniAtiv = $('mini-atividades');
  if(miniAtiv) miniAtiv.innerHTML = mkMini([[atPend,'pendentes'],[atConc,'concluídas']]);

  // Conforto
  const ucs = kpi.conforto?.ucs || [];
  const prevs = kpi.conforto?.preventivas || [];
  const hoje = new Date();
  const vencendo = ucs.filter(u=>{
    const ult = prevs.filter(p=>p.ucId===u.id&&p.status==='Realizada').sort((a,b)=>new Date(b.dataRealizada)-new Date(a.dataRealizada))[0];
    if(!ult) return true;
    return Math.floor((hoje-new Date(ult.dataRealizada))/86400000)>=(u.cicloFiltroDias||90)-14;
  }).length;
  const miniConf = $('mini-conforto');
  if(miniConf) miniConf.innerHTML = mkMini([[ucs.length,'UCs'],[vencendo,'vencendo']]);

  // Acesso
  const pessoas = kpi.codin?.pessoas || [];
  const solics = kpi.codin?.solicitacoes || [];
  const solicPend = solics.filter(s=>s.status==='Pendente').length;
  const miniAces = $('mini-acesso');
  if(miniAces) miniAces.innerHTML = mkMini([[pessoas.length,'pessoas'],[solicPend,'pendentes']]);
}

async function saveCFG(){ await API.hub.config.salvar(CFG); }

applyIdent();
buildLogos();
buildActs();
buildKpiMini();
buildVidKpis();
buildAcoes();
buildVMO();
if ($('el-avatar')) $('el-avatar').textContent = user.avatar;
if ($('el-uname'))  $('el-uname').textContent  = user.nome;
if ($('el-urole'))  $('el-urole').textContent  = user.role;
if (user.role === 'admin') { const p = $('pill-admin'); if(p) p.style.display = ''; }

async function loadCache(){
  try{
    const d = await API.hub.dados();
    if(d.obras){
      setKpi(0, d.obras.andamento, d.obras.total+' cadastradas', d.obras.total?Math.round(d.obras.andamento/d.obras.total*100):0);
      setKpi(3, d.obras.gasto_total?(Math.round(d.obras.gasto_total/1000)+'k'):'—', 'budget executado', 0);
    }
    if(d.chamados){
      setKpi(1, d.chamados.abertos, d.chamados.total+' total', d.chamados.total?Math.round(d.chamados.abertos/d.chamados.total*100):0);
    }
    preencherModCards(d);
  }catch(e){
    console.warn('[hub] loadCache falhou, tentando novamente em 5s:', e);
    setTimeout(loadCache, 5000);
  }
}

async function carregarPainel(){
  const b=$('hp-body');
  try{
    const kpi = await API.kpi.dados();
    _painelDados = kpi;
    renderPainel(_painelMod);
    renderAlertas(kpi);
    preencherModCardsKpi(kpi);
    const ativs=(kpi.atividades?.atividades)||[];
    const concluidas=ativs.filter(a=>a.status==='done').length;
    const total=ativs.length;
    setKpi(2, concluidas, total+' total', total?Math.round(concluidas/total*100):0);
  }catch(e){
    console.warn('[hub] carregarPainel falhou, tentando novamente em 8s:', e);
    if(b) b.innerHTML=`<div class="hp-vazio" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 0">
      <div>Erro ao carregar dados.</div>
      <button onclick="location.reload()" style="font-size:11px;padding:6px 14px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:var(--surface);font-family:var(--font)">Tentar novamente</button>
    </div>`;
    setTimeout(carregarPainel, 8000);
  }
}
const _initTimeout = setTimeout(()=>{
  const b=$('hp-body');
  if(b&&b.innerHTML.includes('Carregando')) location.reload();
}, 15000);

Promise.all([loadCache(), carregarPainel()]).then(()=>clearTimeout(_initTimeout));
