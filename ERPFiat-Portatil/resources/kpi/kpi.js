const CACHES = {obras:'obras',capex:'obras',chamados:'chamados',codin:'codin',conforto:'conforto',ergonomia:null,acesso:'codin'};
function lerCache(mod){
  if(!mod)return null;
  if(window['_kpiDados_'+mod])return window['_kpiDados_'+mod];
  try{
    const raw=sessionStorage.getItem('_kpi_'+mod);
    if(raw)return JSON.parse(raw);
  }catch(e){}
  return null;
}
'use strict';
window.onerror=function(msg,src,line,col,err){var b=document.getElementById('debug-bar');if(b){b.style.display='block';b.textContent+='ERRO linha '+line+': '+msg+'\n';}};
window.addEventListener('unhandledrejection',function(e){var b=document.getElementById('debug-bar');if(b){b.style.display='block';b.textContent+='PROMISE: '+(e.reason?.stack||e.reason)+'\n';}});
const $=id=>document.getElementById(id);
const fmt=(v,d=0)=>isNaN(v)?'0':Number(v).toFixed(d);
const fmtRK=v=>{if(v===null||v===undefined)return'—';const n=Number(v);if(Math.abs(n)>=1e6)return'R$'+(n/1e6).toFixed(1)+'M';if(Math.abs(n)>=1e3)return'R$'+(n/1e3).toFixed(1)+'k';return'R$'+Math.round(n);};
const tnome=n=>n&&n.length>18?n.slice(0,16)+'…':n||'—';
const fmtDate=s=>{if(!s)return'—';const p=s.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s;};

function tick(){const n=new Date();$('clock').textContent=[n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');}
tick();setInterval(tick,1000);
async function preencherMicroCards(){
  const d=window.__DADOS__||await(await fetch('/api/kpi/dados')).json();
  window._kpiDados_obras    = d.obras    || null;
window._kpiDados_chamados = d.chamados || null;
window._kpiDados_codin    = d.codin    || null;
window._kpiDados_conforto = d.conforto || null;
try{if(d.obras)   sessionStorage.setItem('_kpi_obras',   JSON.stringify(d.obras));}catch(e){}
  try{if(d.chamados)sessionStorage.setItem('_kpi_chamados',JSON.stringify(d.chamados));}catch(e){}
  try{if(d.codin)   sessionStorage.setItem('_kpi_codin',   JSON.stringify(d.codin));}catch(e){}
  try{if(d.conforto)sessionStorage.setItem('_kpi_conforto',JSON.stringify(d.conforto));}catch(e){}
  const dOb=d.obras||null;
  const dCap=d.capex||null;
  const dCod=d.codin||null;
  const dCnf=d.conforto||null;
  const dErg=d.ergonomia||null;
  const dCh=d.chamados||null;
  if(dOb){
    const obras=dOb.obras||[];
    const lanc=dOb.lancamentos||[];
    const budget=dOb.budget||[];
    const budgTotal=budget.reduce((s,b)=>s+(b.budgetAprov||0),0);
    const real=lanc.reduce((s,l)=>s+l.qtd*l.precoUnit,0);
    const emAnd=obras.filter(o=>o.status==='Em Andamento').length;
    const conc=obras.filter(o=>o.status==='Concluído').length;
    const pct=budgTotal>0?Math.round(real/budgTotal*100):0;
   const plan=obras.filter(o=>o.status==='Planejado'||o.status==='Planejada').length;
    document.getElementById('mkpis-obras').innerHTML=
      mkMicro(obras.length,'Total obras','c-azul',"abrirModuloComDrill('obras','total')")+
      mkMicro(emAnd,'Em andamento','c-laranja',"abrirModuloComDrill('obras','andamento')")+
      mkMicro(conc,'Concluídas','c-verde',"abrirModuloComDrill('obras','concluidas')")+
      mkMicro(plan,'Planejadas','c-azul',"abrirModuloComDrill('obras','planejadas')");
    document.getElementById('mfoot-obras').textContent='';
    const Orçado=Math.max(budgTotal-real,0);
    const labels=['Gasto','Orçado'];
    const vals=[real||0,Orçado||0];
    const cores=['#e3711a','#d0d8e8'];
    setTimeout(()=>desenharMicroDonut('mcv-obras',labels,vals,cores),80);
  }
  if(dCod){
    const pessoas=dCod.pessoas||[];
    const ativos=pessoas.filter(p=>p.status==='Ativo'||!p.status).length;
    const semPonto=pessoas.filter(p=>!p.ponto&&!p.pontoId).length;
    const perfis=new Set(pessoas.map(p=>p.perfil||p.cargo||'Operador')).size;
    document.getElementById('mkpis-codin').innerHTML=
      mkMicro(pessoas.length,'Total pessoas','c-azul',"abrirModuloComDrill('codin','cd-total')")+
mkMicro(ativos,'Ativas','c-verde',"abrirModuloComDrill('codin','cd-total')")+
mkMicro(semPonto,'Sem ponto',semPonto>0?'c-amarelo':'c-verde',"abrirModuloComDrill('codin','cd-ponto')")+
mkMicro(perfis,'Perfis','c-azul',"abrirModuloComDrill('codin','cd-perfis')")
    document.getElementById('mfoot-codin').textContent=Math.round(ativos/Math.max(pessoas.length,1)*100)+'% ativos · '+semPonto+' sem ponto';
    setTimeout(()=>desenharMicroDonut('mcv-codin',['Ativos','Inativos'],[ativos||1,pessoas.length-ativos||1],['#3fb950','#f85149']),80);
  }
  if(dCnf){
    const regs=dCnf.registros||[];
    const conform=regs.filter(r=>r.status==='Conforme'||r.situacao==='OK').length;
    const nconf=regs.filter(r=>r.status==='Não Conforme'||r.situacao==='NOK').length;
    const areas=new Set(regs.map(r=>r.area||r.local||'')).size;
    const pct=regs.length>0?Math.round(conform/regs.length*100):0;
    document.getElementById('mkpis-conforto').innerHTML=
      mkMicro(regs.length,'Registros','c-azul',"abrirModuloComDrill('conforto','cf-total')")+
mkMicro(conform,'Conformes','c-verde',"abrirModuloComDrill('conforto','cf-conf')")+
mkMicro(nconf,'Não conformes',nconf>0?'c-vermelho':'c-verde',"abrirModuloComDrill('conforto','cf-temp')")+
mkMicro(pct+'%','Conformidade',pct>80?'c-verde':'c-vermelho',"abrirModuloComDrill('conforto','cf-areas')")
    document.getElementById('mfoot-conforto').textContent=areas+' áreas · '+pct+'% conformidade';
    setTimeout(()=>desenharMicroDonut('mcv-conforto',['Conforme','Não Conforme'],[conform||1,nconf||1],['#3fb950','#f85149']),80);
  }
  if(dErg){
    const avs=dErg.avaliacoes||[];
    const ok=avs.filter(a=>a.resultado==='OK'||a.status==='Aprovado').length;
    const nok=avs.filter(a=>a.resultado==='NOK'||a.status==='Reprovado').length;
    const pend=avs.length-ok-nok;
    const postos=new Set(avs.map(a=>a.posto||a.local||'')).size;
    document.getElementById('mkpis-ergonomia').innerHTML=
      mkMicro(avs.length,'Avaliações','c-azul',"abrirModuloComDrill('ergonomia','erg-total')")+
mkMicro(ok,'Aprovadas','c-verde',"abrirModuloComDrill('ergonomia','erg-ok')")+
mkMicro(nok,'Reprovadas',nok>0?'c-vermelho':'c-verde',"abrirModuloComDrill('ergonomia','erg-nok')")+
mkMicro(postos,'Postos','c-azul',"abrirModuloComDrill('ergonomia','erg-postos')")
    document.getElementById('mfoot-ergonomia').textContent=avs.length>0?Math.round(ok/avs.length*100)+'% aprovadas · '+pend+' pendentes':'—';
    setTimeout(()=>desenharMicroDonut('mcv-ergonomia',['Aprovadas','Reprovadas','Pendentes'],[ok||1,nok||1,pend||1],['#3fb950','#f85149','#d29922']),80);
  }
  if(dCh){
    const cham=dCh.chamados||(Array.isArray(dCh)?dCh:[]);
    const total=cham.length;
    const abertos=cham.filter(c=>c.status==='Aberto').length;
    const alta=cham.filter(c=>c.status==='Em Andamento'||c.status==='Em Atendimento').length;
    const resolvidos=cham.filter(c=>['Resolvido','Fechado','Concluído'].includes(c.status)).length;
    document.getElementById('mkpis-chamados').innerHTML=
      mkMicro(total,'Total','c-azul',"abrirModuloComDrill('chamados','ch-total')")+
mkMicro(abertos,'Abertos',abertos>0?'c-vermelho':'c-verde',"abrirModuloComDrill('chamados','ch-alta')")+
mkMicro(alta,'Em andamento',alta>0?'c-laranja':'c-verde',"abrirModuloComDrill('chamados','ch-sem')")+
mkMicro(resolvidos,'Concluídos','c-verde',"abrirModuloComDrill('chamados','ch-resol')")
    document.getElementById('mfoot-chamados').textContent=
      Math.round(resolvidos/Math.max(total,1)*100)+'% resolvidos · '+alta+' críticos';
    const sm={};cham.forEach(c=>{const s=c.status||'Aberto';sm[s]=(sm[s]||0)+1;});
    const sl=Object.entries(sm).filter(x=>x[1]);
    setTimeout(()=>desenharMicroDonut('mcv-chamados',sl.map(x=>x[0]),sl.map(x=>x[1]),['#f85149','#e3711a','#3fb950','#58a6ff']),80);
  }
}

function mkMicro(val,lbl,cls,onclick){
  const clk=onclick?` onclick="${onclick}" style="cursor:pointer" title="Abrir ${lbl}"`:'';
  return`<div class="mod-micro-kpi"${clk}><div class="mod-micro-lbl">${lbl}</div><div class="mod-micro-val ${cls}">${val}</div></div>`;
}

function desenharMicroDonut(id,labels,vals,cores){
  const cv=document.getElementById(id);if(!cv)return;
  const pai=cv.parentElement;
  pai.id=pai.id||'donut-'+id;
  desenharDonutSVG(pai.id,labels,vals,cores);
}
(async function loadLogos(){
  const wrap=document.getElementById('kpi-logos');if(!wrap)return;
  try{const cfg = await API.hub.config.ler();(cfg.logos||[]).forEach(src=>{if(!src)return;const img=document.createElement('img');img.src=src;img.style.cssText='height:32px;width:auto;max-width:100px;object-fit:contain;border-radius:4px';wrap.appendChild(img);});}catch(e){}
})();
(async function loadSidebar(){
  try{
    const cfg = await API.hub.config.ler();
    const id=cfg.identidade||{};
    const n=$('kpi-inst-nome'),s=$('kpi-inst-sub'),b=$('kpi-inst-badge');
    if(n)n.textContent=id.instNome||id.brand||'—';
    if(s)s.textContent=id.instSub||'—';
    if(b)b.textContent=id.instBadge||'—';
  }catch(e){}
  try{
    const wrap=$('kpi-acts');
    if(!wrap)return;
    const d = await API.hub.dados();
    const ativs = d.atividades || [];
    if(!raw){wrap.innerHTML='<div style="font-size:10px;color:var(--text-dim);padding:8px 0">Sem atividades carregadas</div>';return;}
    const data=JSON.parse(raw);
    const ativsLocal=Array.isArray(data)?data:(data.atividades||[]);
    if(!ativs.length){wrap.innerHTML='<div style="font-size:10px;color:var(--text-dim);padding:8px 0">Nenhuma atividade encontrada</div>';return;}
    const hoje=new Date().toISOString().slice(0,10);
    const amanha=new Date(Date.now()+86400000).toISOString().slice(0,10);
    const semana=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    const sorted=ativs.slice().sort((a,b)=>{
      const pa=a.prazo||'9999-99-99';
      const pb=b.prazo||'9999-99-99';
      return pa.localeCompare(pb);
    });
    wrap.innerHTML=sorted.slice(0,12).map(a=>{
      const done=a.status==='done';
      const prazo=a.prazo||'';
      const vencida=prazo&&prazo<hoje&&!done;
      const venceHoje=prazo===hoje&&!done;
      const venceAmanha=prazo===amanha&&!done;
      const semana_=prazo&&prazo<=semana&&prazo>amanha&&!done;
      let pilClass='kpi-pl';
      let pilTxt='';
      if(done){pilClass='kpi-pl';pilTxt='OK';}
      else if(vencida){pilClass='kpi-ph';pilTxt='ATRAS.';}
      else if(venceHoje){pilClass='kpi-ph';pilTxt='HOJE';}
      else if(venceAmanha){pilClass='kpi-pm';pilTxt='AMANHÃ';}
      else if(semana_){pilClass='kpi-pm';pilTxt='SEM.';}
      else if(prazo){pilClass='kpi-pl';pilTxt=prazo.slice(8)+'/'+prazo.slice(5,7);}
      const chkClass=done?'done':vencida||venceHoje?'pend':'';
      return`<div class="kpi-act-item">
        <div class="kpi-act-chk ${chkClass}"></div>
        <div class="kpi-act-txt ${done?'done':''}" title="${a.titulo||a.nome||''}">${(a.titulo||a.nome||'Sem título').slice(0,28)}</div>
        ${pilTxt?`<div class="kpi-pil ${pilClass}">${pilTxt}</div>`:''}
      </div>`;
    }).join('');
  }catch(e){
    const wrap=$('kpi-acts');
    if(wrap)wrap.innerHTML='<div style="font-size:10px;color:var(--red);padding:8px 0">Erro ao carregar</div>';
  }
})();


let moduloAtivo=null;
let _obrasData=null,_drillOb=null;
let _confortoDrillAtivo=null,_chamDrillAtivo=null;
let _dtErros=[],_dtInicio=Date.now(),_dtRenderTimes={},_dtConsoleHist=[],_dtConsoleIdx=-1,_dtCacheVizKey=null;
const TODOS_MODULOS=['obras','capex','chamados','codin','conforto','ergonomia','acesso'];
preencherMicroCards();



function alternarModulo(id){
  const card=document.getElementById('mod-'+id);
  if(!card)return;
  if(moduloAtivo===id){
    moduloAtivo=null;
    document.getElementById('painel-expandido-global')?.remove();
    document.querySelector('.modulos-wrap').style.display='';
    TODOS_MODULOS.forEach(m=>{
      const c=document.getElementById('mod-'+m);
      if(c)c.classList.remove('oculto','expandido','ativo');
    });
    return;
  }
  moduloAtivo=id;
  TODOS_MODULOS.forEach(m=>{
    const c=document.getElementById('mod-'+m);
    if(!c)return;
    if(m===id){
      c.classList.remove('oculto');
      c.classList.add('ativo');
    } else {
      c.classList.remove('expandido','ativo');
      c.classList.add('oculto');
    }
  });
  document.querySelector('.modulos-wrap').style.display='none';
  document.getElementById('painel-expandido-global')?.remove();
  const mainScroll=document.querySelector('.main-scroll');
  const painel=document.createElement('div');
  painel.id='painel-expandido-global';
painel.style.cssText='padding:16px 20px 20px';
  const nomes={obras:'Obras',capex:'CAPEX',chamados:'Chamados',codin:'CODIN',conforto:'Conforto',ergonomia:'Ergonomia',acesso:'Controle de Acesso'};
  const header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-shrink:0';
  header.innerHTML=`<div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:2px;height:11px;background:var(--blue-light);border-radius:2px"></span>${nomes[id]}</div>
    <button onclick="alternarModulo('${id}')" style="font-size:10px;color:var(--text-muted);cursor:pointer;padding:4px 12px;border:1px solid var(--border);border-radius:5px;background:var(--surface);font-family:var(--font);transition:all .12s" onmouseover="this.style.color='var(--blue-light)';this.style.borderColor='var(--blue-light)'" onmouseout="this.style.color='var(--text-muted)';this.style.borderColor='var(--border)'">✕ fechar</button>`;
  painel.appendChild(header);
  const conteudo=document.createElement('div');
  conteudo.style.cssText='flex:1;min-height:0';
  painel.appendChild(conteudo);
  mainScroll.appendChild(painel);
  const d=lerCache(CACHES[id]);
  if(id==='obras') dtMedirRender('renderObras',()=>renderObras(conteudo,d));
  else if(id==='chamados') dtMedirRender('renderChamados',()=>renderChamados(conteudo,d));
  else if(id==='capex') dtMedirRender('renderCapex',()=>renderCapex(conteudo,d));
  else if(id==='codin') dtMedirRender('renderCodin',()=>renderCodin(conteudo,d));
  else if(id==='conforto') dtMedirRender('renderConforto',()=>renderConforto(conteudo,d));
  else if(id==='ergonomia') dtMedirRender('renderErgonomia',()=>renderErgonomia(conteudo,d));
else conteudo.innerHTML='<div class="sem-dados" style="margin-top:40px">Módulo em desenvolvimento.<br><span style="font-size:10px">Em breve disponível.</span></div>';
}


function abrirModuloComDrill(modulo,tipo){
  if(moduloAtivo!==modulo){
    moduloAtivo=modulo;
    TODOS_MODULOS.forEach(m=>{
      const c=document.getElementById('mod-'+m);if(!c)return;
      if(m===modulo){c.classList.remove('oculto');c.classList.add('ativo');}
      else{c.classList.remove('expandido','ativo');c.classList.add('oculto');}
    });
    document.querySelector('.modulos-wrap').style.display='none';
    document.getElementById('painel-expandido-global')?.remove();
    const mainScroll=document.querySelector('.main-scroll');
    const painel=document.createElement('div');
    painel.id='painel-expandido-global';
    painel.style.cssText='padding:16px 20px 20px;flex:1;display:flex;flex-direction:column;overflow-y:auto';
    const nomes={obras:'Obras',capex:'CAPEX',chamados:'Chamados',codin:'CODIN',conforto:'Conforto',ergonomia:'Ergonomia'};
    const header=document.createElement('div');
    header.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-shrink:0';
    header.innerHTML=`<div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:2px;height:11px;background:var(--blue-light);border-radius:2px"></span>${nomes[modulo]}</div>
      <button onclick="alternarModulo('${modulo}')" style="font-size:10px;color:var(--text-muted);cursor:pointer;padding:4px 12px;border:1px solid var(--border);border-radius:5px;background:var(--surface);font-family:var(--font)">✕ fechar</button>`;
    painel.appendChild(header);
    const conteudo=document.createElement('div');
    conteudo.style.cssText='flex:1;min-height:0';
    painel.appendChild(conteudo);
    mainScroll.appendChild(painel);
    const d=lerCache(CACHES[modulo]);
    if(modulo==='obras'){
      _obrasData=d;
      setTimeout(()=>toggleObCard(tipo),80);
    } else if(modulo==='conforto'){
      const tmp=document.createElement('div');
      dtMedirRender('renderConforto',()=>renderConforto(tmp,d));
      setTimeout(()=>abrirDrillConforto(tipo,d),80);
    } else if(modulo==='chamados'){
      const tmp=document.createElement('div');
      dtMedirRender('renderChamados',()=>renderChamados(tmp,d));
      setTimeout(()=>abrirDrillChamados(tipo),200);
    } else if(modulo==='capex'){
  dtMedirRender('renderCapex',()=>renderCapex(conteudo,d));
  setTimeout(()=>toggleObCardGenerico('capex',tipo),200);
}
else if(modulo==='codin'){
  dtMedirRender('renderCodin',()=>renderCodin(conteudo,d));
  setTimeout(()=>toggleObCardGenerico('codin',tipo),200);
}
else if(modulo==='ergonomia'){
  dtMedirRender('renderErgonomia',()=>renderErgonomia(conteudo,d));
  setTimeout(()=>toggleObCardGenerico('ergonomia',tipo),200);
}
  } else {
    const d=lerCache(CACHES[modulo]);
    if(modulo==='obras'){_obrasData=_obrasData||d;toggleObCard(tipo);}
    else if(modulo==='conforto') abrirDrillConforto(tipo,d);
    else if(modulo==='chamados') abrirDrillChamados(tipo);
    else if(modulo==='capex') toggleObCardGenerico('capex',tipo);
    else if(modulo==='codin') toggleObCardGenerico('codin',tipo);
    else if(modulo==='ergonomia') toggleObCardGenerico('ergonomia',tipo);
  }
}

function resolveW(id){const cv=$(id);if(!cv)return null;const pw=cv.parentElement?cv.parentElement.clientWidth:0;if(pw>0)cv.width=pw;return cv;}

function desenharBarrasH(id,labels,vals,cores){
  const cv=resolveW(id);if(!cv)return;
  const W=cv.width,H=cv.height,ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);
  if(!vals||!vals.length)return;
  const max=Math.max(...vals.map(Math.abs))||1,n=labels.length;
  const rowH=H/n,barH=Math.min(rowH*.55,18),lW=90,aW=W-lW-62;
  ctx.font='500 10px Plus Jakarta Sans,sans-serif';
  const maxLen=Math.max(...labels.map(l=>String(l).length));
  labels.forEach((lbl,i)=>{
    const v=vals[i],bw=(Math.abs(v)/max)*aW,y=i*rowH+(rowH-barH)/2;
    const cor=Array.isArray(cores)?cores[i%cores.length]:cores;
    ctx.fillStyle='#e8edf5';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(lW,y,aW,barH,3);else ctx.rect(lW,y,aW,barH);ctx.fill();
    ctx.fillStyle=cor;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(lW,y,Math.max(bw,2),barH,3);else ctx.rect(lW,y,Math.max(bw,2),barH);ctx.fill();
    const lblStr=String(lbl).slice(0,12).padEnd(12,' ');
    ctx.fillStyle='#4a5880';ctx.textAlign='right';ctx.fillText(lblStr,lW-6,y+barH/2+3.5);
    ctx.fillStyle=cor;ctx.textAlign='left';
    const t=Math.abs(v)>999?fmtRK(v):Math.round(v).toString();
    ctx.fillText(t,lW+bw+6,y+barH/2+3.5);
  });
}

function desenharSparkComValores(id,labels,vals,cor){
  const cv=resolveW(id);if(!cv)return;
  const W=cv.width,H=cv.height,ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);
  if(!vals||vals.length<2)return;
  const max=Math.max(...vals)||1;
  const pT=50,pB=50,pL=60,pR=60;
  const uw=(W-pL-pR)/(vals.length-1);
  const pts=vals.map((v,i)=>({x:pL+i*uw,y:pT+(1-v/max)*(H-pT-pB)}));
  const g=ctx.createLinearGradient(0,pT,0,H-pB);
  g.addColorStop(0,cor+'55');g.addColorStop(1,cor+'00');
  ctx.beginPath();ctx.moveTo(pts[0].x,H-pB);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x,H-pB);ctx.closePath();
  ctx.fillStyle=g;ctx.fill();
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.strokeStyle=cor;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();
  ctx.fillStyle=cor;
  pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();});
  ctx.font='600 12px IBM Plex Mono,monospace';ctx.textAlign='center';ctx.fillStyle='#4a5880';
  labels.forEach((l,i)=>{
    const mesNomes={'01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun','07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez'};
    const label=mesNomes[l]||l;
    ctx.fillText(label,pts[i].x,H-10);
  });
  ctx.font='700 12px Plus Jakarta Sans,sans-serif';ctx.textAlign='center';
  vals.forEach((v,i)=>{
    const txt=fmtRK(v);
    const tx=pts[i].x;
    const ty=pts[i].y-14;
    const tw=ctx.measureText(txt).width+10;
    ctx.fillStyle='rgba(240,244,248,0.9)';
    ctx.beginPath();if(ctx.roundRect)ctx.roundRect(tx-tw/2,ty-13,tw,16,4);else ctx.rect(tx-tw/2,ty-13,tw,16);ctx.fill();
    ctx.fillStyle=cor;
    ctx.fillText(txt,tx,ty);
  });
}

function desenharDuplas(id,labels,v1,v2,c1,c2,l1,l2){
  const cv=resolveW(id);if(!cv)return;
  const W=cv.width,H=cv.height,ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);
  if(!v1||!v1.length)return;
  const max=Math.max(...v1,...v2)||1,pT=12,pB=24,pL=5,pR=10;
  const n=labels.length,slot=(W-pL-pR)/n,bw=Math.min(slot*.35,18),aH=H-pT-pB;
  [v1,v2].forEach((vs,gi)=>{vs.forEach((v,i)=>{const h=(v/max)*aH,x=pL+i*slot+gi*(bw+2)+slot*.12,y=H-pB-h;ctx.fillStyle=gi===0?c1:c2;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,bw,h,2);else ctx.rect(x,y,bw,h);ctx.fill();});});
  ctx.fillStyle='#8b949e';ctx.font='9px IBM Plex Mono,monospace';ctx.textAlign='center';
  labels.forEach((l,i)=>ctx.fillText(String(l).slice(0,8),pL+i*slot+slot/2,H-6));
  ctx.fillStyle=c1;ctx.fillRect(W-90,5,8,8);ctx.fillStyle='#8b949e';ctx.textAlign='left';ctx.font='8px IBM Plex Mono,monospace';ctx.fillText(l1,W-79,12);
  ctx.fillStyle=c2;ctx.fillRect(W-90,17,8,8);ctx.fillStyle='#8b949e';ctx.fillText(l2,W-79,24);
}

function desenharDonut(id,labels,vals,cores){
  const cv=resolveW(id);if(!cv)return;
  const W=cv.width,H=cv.height,ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);
  const tot=vals.reduce((a,b)=>a+b,0);if(!tot)return;
  const cx=H/2,cy=H/2,R=Math.min(H/2-6,36);
  let a=-Math.PI/2;
  vals.forEach((v,i)=>{const s=(v/tot)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,a,a+s);ctx.closePath();ctx.fillStyle=cores[i%cores.length];ctx.fill();a+=s;});
  ctx.fillStyle=getComputedStyle(cv.parentElement).backgroundColor||'#1c2333';
  ctx.beginPath();ctx.arc(cx,cy,R*.55,0,Math.PI*2);ctx.fill();
  const lx=H+6;ctx.font='9px IBM Plex Mono,monospace';ctx.textAlign='left';
  labels.forEach((lbl,i)=>{const y=cy-((labels.length-1)*13/2)+i*15;ctx.fillStyle=cores[i%cores.length];ctx.fillRect(lx,y-6,7,7);ctx.fillStyle='#8b949e';ctx.fillText(String(lbl).slice(0,9),lx+10,y+1);});
}

function desenharGauge(id,pct,cor){
  const cv=$(id);if(!cv)return;cv.width=160;cv.height=88;
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,160,88);
  const cx=80,cy=80,R=60;
  ctx.beginPath();ctx.arc(cx,cy,R,Math.PI,2*Math.PI);ctx.lineWidth=11;ctx.strokeStyle='#21262d';ctx.stroke();
  const f=Math.PI+(pct/100)*Math.PI;
  ctx.beginPath();ctx.arc(cx,cy,R,Math.PI,f);ctx.strokeStyle=cor;ctx.lineCap='round';ctx.stroke();
}

function desenharOrçado(id,obras){
  const cv=resolveW(id);if(!cv)return;
  const W=cv.width,H=cv.height,ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);
  const items=obras.map(o=>({nome:tnome(o.nome),Orçado:OrçadoObra(o.cod)})).sort((a,b)=>b.Orçado-a.Orçado);
  if(!items.length)return;
  const max=Math.max(...items.map(x=>Math.abs(x.Orçado)))||1;
  const n=items.length,rowH=H/n,barH=Math.min(rowH*.55,16),lW=68,aW=W-lW-50;
  ctx.font='9px IBM Plex Mono,monospace';
  items.forEach((item,i)=>{
    const v=item.Orçado,bw=(Math.abs(v)/max)*aW,y=i*rowH+(rowH-barH)/2;
    const cor=v>=0?'#3fb950':'#f85149';
    ctx.fillStyle='#e8edf5';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(lW,y,aW,barH,2);else ctx.rect(lW,y,aW,barH);ctx.fill();
    ctx.fillStyle=cor;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(lW,y,bw,barH,2);else ctx.rect(lW,y,bw,barH);ctx.fill();
    ctx.fillStyle='#8b949e';ctx.textAlign='right';ctx.fillText(item.nome.slice(0,12),lW-5,y+barH/2+3.5);
    ctx.fillStyle=cor;ctx.textAlign='left';ctx.fillText(fmtRK(v),lW+bw+4,y+barH/2+3.5);
  });
}

/* ══════════════════════════════════════════════
   OBRAS — novo layout full height com overlay
══════════════════════════════════════════════ */
function calcAvFis(o){
  const et=o.etapas||[];const tot=et.reduce((a,e)=>a+(e.peso||1),0);
  const ex=et.reduce((a,e)=>a+((e.peso||1)*(e.avancoFisico||0)/100),0);
  return tot>0?(ex/tot)*100:0;
}

function budgObra(cod){if(!_obrasData)return 0;return(_obrasData.budget||[]).filter(b=>b.obraCod===cod).reduce((s,b)=>s+(b.budgetAprov||0),0);}
function realObra(cod){if(!_obrasData)return 0;return(_obrasData.lancamentos||[]).filter(l=>l.obraCod===cod).reduce((s,l)=>s+l.qtd*l.precoUnit,0);}
function OrçadoObra(cod){return budgObra(cod)-realObra(cod);}

function renderObras(container,d){
  _obrasData=d;_drillOb=null;
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo de obras carregado.<br><span style="font-size:10px">Selecione o arquivo no hub principal antes de abrir este painel.</span></div>';return;}
  container.style.cssText='';
container.innerHTML='<div class="obras-section"><div class="secao-titulo">Obras</div>'+buildObrasCards(d)+'</div>';
  setTimeout(()=>{
    drawMiniCard('total',d);
    drawMiniCard('andamento',d);
    drawMiniCard('concluidas',d);
    drawMiniCard('planejadas',d);
  },60);
}

function buildObrasCards(d){
  const obras=d.obras||[];
  const budget=d.budget||[];
  const lanc=d.lancamentos||[];
  const budgTotal=budget.reduce((s,b)=>s+(b.budgetAprov||0),0);
  const real=lanc.reduce((s,l)=>s+l.qtd*l.precoUnit,0);
  const Orçado=budgTotal-real;
  const emAnd=obras.filter(o=>o.status==='Em Andamento');
  const conc=obras.filter(o=>o.status==='Concluído');
  const plan=obras.filter(o=>o.status==='Planejado');
  const avFis=obras.length?obras.reduce((s,o)=>s+calcAvFis(o),0)/obras.length:0;
  const planB=budget.filter(b=>plan.map(o=>o.cod).includes(b.obraCod)).reduce((s,b)=>s+(b.budgetAprov||0),0);

  return`<div class="obras-cards-grid" id="obras-grid">
    ${mkCard('total','TOTAL OBRAS',obras.length,'c-azul','#58a6ff',fmtRK(budgTotal)+' budget total',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Orçado</span><span class="ob-mini-val ${Orçado<0?'c-vermelho':'c-verde'}">${fmtRK(Orçado)}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">% Realizado</span><span class="ob-mini-val c-azul">${budgTotal>0?fmt(real/budgTotal*100,1):0}%</span></div>`)}
    ${mkCard('andamento','EM ANDAMENTO',emAnd.length,'c-laranja','#e3711a',fmt(avFis,1)+'% avanço médio',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Budget</span><span class="ob-mini-val c-azul">${fmtRK(emAnd.reduce((s,o)=>s+budgObra(o.cod),0))}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Realizado</span><span class="ob-mini-val c-laranja">${fmtRK(emAnd.reduce((s,o)=>s+realObra(o.cod),0))}</span></div>`)}
    ${mkCard('concluidas','CONCLUÍDAS',conc.length,'c-verde','#3fb950',obras.length>0?fmt(conc.length/obras.length*100,0)+'% do total':'—',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Gasto total</span><span class="ob-mini-val c-laranja">${fmtRK(conc.reduce((s,o)=>s+realObra(o.cod),0))}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Avg. avanço</span><span class="ob-mini-val c-verde">100%</span></div>`)}
    ${mkCard('planejadas','PLANEJADAS',plan.length,'c-azul','#a371f7',fmtRK(planB)+' previsto',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Budget prev.</span><span class="ob-mini-val c-azul">${fmtRK(planB)}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Prazo médio</span><span class="ob-mini-val c-azul">${prazoMedio(plan)}</span></div>`)}
  </div>`;
}

function mkCard(tipo,label,val,valCls,accent,sub,statsHtml){
  return`<div class="ob-card" id="ob-card-${tipo}" onclick="toggleObCard('${tipo}')">
    <div class="ob-card-head">
      <div class="ob-card-accent" style="background:${accent}"></div>
      <div class="ob-card-label">${label}</div>
      <div class="ob-card-val ${valCls}">${val||'—'}</div>
      <div class="ob-card-sub">${sub}</div>
    </div>
    <div class="ob-card-body">
      <div class="ob-chart-wrap"><canvas id="cv-mini-${tipo}"></canvas></div>
      <div class="ob-leg" id="ob-leg-${tipo}"></div>
      <div style="flex:1"></div>
      <div class="ob-leg-sep"></div>
      ${statsHtml}
      <div class="ob-card-hint">▼ ver análise gerencial</div>
    </div>
  </div>`;
}

function prazoMedio(obras){
  const hoje=new Date();
  const com=obras.filter(o=>o.dtFimPrev);
  if(!com.length)return'—';
  const med=com.reduce((s,o)=>s+Math.floor((new Date(o.dtFimPrev+'T00:00:00')-hoje)/86400000),0)/com.length;
  return med<0?'Atrasado':Math.round(med)+'d';
}
function drawMiniCard(tipo,d){
  const obras=d.obras||[];
  const lanc=d.lancamentos||[];
  const cv=document.getElementById('cv-mini-'+tipo);
  if(!cv)return;
  cv.width=140;cv.height=140;

  let labels=[],vals=[],cores=[];
  if(tipo==='total'){
    const sm={};obras.forEach(o=>{sm[o.status]=(sm[o.status]||0)+1;});
    const sl=Object.entries(sm).filter(x=>x[1]);
    labels=sl.map(x=>x[0]);vals=sl.map(x=>x[1]);
    cores=['#e3711a','#3fb950','#58a6ff','#f85149'];
  } else if(tipo==='andamento'){
    const lista=obras.filter(o=>o.status==='Em Andamento');
    if(!lista.length)return;
    labels=lista.map(o=>tnome(o.nome));
    vals=lista.map(o=>Math.max(calcAvFis(o),1));
    cores=['#e3711a','#d29922','#58a6ff','#a371f7','#3fb950'];
  } else if(tipo==='concluidas'){
    const lista=obras.filter(o=>o.status==='Concluído');
    if(!lista.length)return;
    const catM={};lista.forEach(o=>{lanc.filter(l=>l.obraCod===o.cod).forEach(l=>{const c=l.categoria||'Outros';catM[c]=(catM[c]||0)+l.qtd*l.precoUnit;});});
    const top=Object.entries(catM).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(!top.length){labels=['Concluídas'];vals=[lista.length];}
    else{labels=top.map(x=>x[0]);vals=top.map(x=>x[1]);}
    cores=['#3fb950','#58a6ff','#d29922','#a371f7','#e3711a'];
  } else if(tipo==='planejadas'){
    const lista=obras.filter(o=>o.status==='Planejado');
    if(!lista.length)return;
    labels=lista.map(o=>tnome(o.nome));
    vals=lista.map(o=>Math.max(budgObra(o.cod),1));
    cores=['#a371f7','#58a6ff','#2E5FA3','#e3711a','#d29922'];
  }

  desenharDonutResponsivo(cv,labels,vals,cores);

  const tot=vals.reduce((a,b)=>a+b,0);
  const usarValor=(tipo==='total'||tipo==='andamento'||tipo==='planejadas');
  let leg=document.getElementById('ob-leg-'+tipo);
  if(!leg){
    leg=document.createElement('div');
    leg.className='ob-leg';
    cv.parentElement.after(leg);
  }
  const maxLeg=4;
  const temMais=labels.length>maxLeg;
  leg.innerHTML=labels.slice(0,maxLeg).map((l,i)=>{
    const v=usarValor?Math.round(vals[i]):Math.round(vals[i]/tot*100)+'%';
    return`<div class="ob-leg-item">
      <span class="ob-leg-dot" style="background:${cores[i%cores.length]}"></span>
      <span class="ob-leg-txt">${l}</span>
      <span class="ob-leg-val">${v}</span>
    </div>`;
  }).join('')+(temMais?`<div class="ob-leg-mais" onclick="expandirLegenda(event,'${tipo}')" data-labels='${JSON.stringify(labels)}' data-vals='${JSON.stringify(vals)}' data-cores='${JSON.stringify(cores)}' data-usarvalor='${usarValor}'>+ ${labels.length-maxLeg} mais ▼</div>`:'');
}

function desenharDonutResponsivo(cv,labels,vals,cores){
  const W=cv.width,H=cv.height,ctx=cv.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const tot=vals.reduce((a,b)=>a+b,0);if(!tot)return;
  const R=Math.min(W,H)/2-6;
  const cx=W/2,cy=H/2;
  let ang=-Math.PI/2;
  vals.forEach((v,i)=>{
    const s=(v/tot)*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,ang,ang+s);ctx.closePath();
    ctx.fillStyle=cores[i%cores.length];ctx.fill();
    ang+=s;
  });
  ctx.fillStyle='#ffffff';
  ctx.beginPath();ctx.arc(cx,cy,R*.52,0,Math.PI*2);ctx.fill();
  const lblC=vals.reduce((a,b)=>a+b,0);
  const txt=lblC>999?fmtRK(lblC):String(Math.round(lblC));
  ctx.fillStyle='#0f1c3f';
  ctx.font='bold 13px IBM Plex Mono,monospace';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(txt,cx,cy);
}
function desenharDonutSVG(containerId,labels,vals,cores){
  const wrap=document.getElementById(containerId);
  if(!wrap)return;
  const tot=vals.reduce((a,b)=>a+b,0);if(!tot)return;
  const R=40,r=22,cx=50,cy=50;
  let paths='',a=-Math.PI/2;
  vals.forEach((v,i)=>{
    const s=(v/tot)*Math.PI*2;
    const x1=cx+R*Math.cos(a),y1=cy+R*Math.sin(a);
    const a2=a+s;
    const x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
    const large=s>Math.PI?1:0;
    const xi1=cx+r*Math.cos(a),yi1=cy+r*Math.sin(a);
    const xi2=cx+r*Math.cos(a2),yi2=cy+r*Math.sin(a2);
    paths+=`<path d="M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${r},${r} 0 ${large},0 ${xi1},${yi1} Z" fill="${cores[i%cores.length]}"/>`;
    a+=s;
  });
  const legItems=labels.slice(0,5).map((l,i)=>{
    const pct=Math.round(vals[i]/tot*100);
    const txt=String(l).length>14?String(l).slice(0,13)+'…':String(l);
    return`<div class="donut-leg-item">
  <span class="donut-leg-dot" style="background:${cores[i%cores.length]}"></span>
  <span class="donut-leg-txt">${txt}</span>
  <span class="donut-leg-pct">${pct}%</span>
</div>`;
  }).join('');
  wrap.innerHTML=`
    <div class="donut-wrap">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        ${paths}
        <text x="50" y="54" text-anchor="middle" font-size="13" font-weight="700" font-family="IBM Plex Mono,monospace" fill="#0f1c3f">${tot>999999?fmtRK(tot):tot>999?(tot/1000).toFixed(1)+'k':String(Math.round(tot))}</text>
      </svg>
    </div>
    <div class="donut-leg">${legItems}</div>`;
}

function toggleObCard(tipo){
  const existing=document.getElementById('ob-overlay');
  if(existing){
    existing.remove();
    if(_drillOb===tipo){_drillOb=null;return;}
  }
  _drillOb=tipo;
  if(!_obrasData)return;
  const conteudo=document.querySelector('#painel-expandido-global > div:last-child');
  if(!conteudo)return;
  conteudo.innerHTML='';
  const overlay=document.createElement('div');
  overlay.className='ob-overlay';
  overlay.id='ob-overlay';
  overlay.innerHTML=buildOverlayHTML(tipo,_obrasData);
  conteudo.innerHTML='';
  conteudo.style.cssText='';
  conteudo.appendChild(overlay);
  setTimeout(()=>drawOverlayCharts(tipo,_obrasData),60);
}

function buildOverlayHTML(tipo,d){
  if(tipo==='total') return buildOverlayTotal(d);
  if(tipo==='andamento') return buildOverlayAndamento(d);
  if(tipo==='concluidas') return buildOverlayConcluidas(d);
  if(tipo==='planejadas') return buildOverlayPlanejadas(d);
  return buildOverlayTotal(d);
}
function _obOvBase(d,tipo){
  const obras=d.obras||[];const hoje=new Date();
  const filtros={total:obras,andamento:obras.filter(o=>o.status==='Em Andamento'),concluidas:obras.filter(o=>o.status==='Concluído'),planejadas:obras.filter(o=>o.status==='Planejado')};
  const titulos={total:'Todas as Obras',andamento:'Em Andamento',concluidas:'Concluídas',planejadas:'Planejadas'};
  const lista=filtros[tipo]||[];
  const totalB=lista.reduce((s,o)=>s+budgObra(o.cod),0);
  const totalR=lista.reduce((s,o)=>s+realObra(o.cod),0);
  const Orçado=totalB-totalR;
  const avgFis=lista.length?lista.reduce((s,o)=>s+calcAvFis(o),0)/lista.length:0;
  const pb=(v,c)=>`<div class="ob-mini-prog"><div class="ob-mbar"><div class="ob-mfill" style="width:${Math.min(v,100)}%;background:${c}"></div></div><span style="font-size:9px;font-family:var(--mono);color:var(--text-muted);min-width:30px">${fmt(v,1)}%</span></div>`;
  const badgeSt=s=>{const m={'Em Andamento':'badge-and','Concluído':'badge-conc','Planejado':'badge-plan','Suspenso':'badge-susp'};return`<span class="badge-sm ${m[s]||'badge-plan'}">${s}</span>`;};
  const linhas=lista.map(o=>{
    const b=budgObra(o.cod),r=realObra(o.cod),af=calcAvFis(o),pf=b>0?(r/b)*100:0;
    const prazo=o.dtFimPrev?Math.floor((new Date(o.dtFimPrev+'T00:00:00')-hoje)/86400000):null;
    const corP=prazo===null?'var(--text-dim)':prazo<0?'var(--red)':prazo<=30?'var(--yellow)':'var(--green)';
    return`<tr style="cursor:pointer" onclick="abrirDetalheObra('${o.cod}')" title="${o.nome}">
      <td style="font-weight:500;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tnome(o.nome)}</td>
      <td>${badgeSt(o.status)}</td>
      <td>${pb(af,'#58a6ff')}</td>
      <td>${pb(pf,pf>85?'#f85149':pf>60?'#d29922':'#3fb950')}</td>
      <td style="font-family:var(--mono);font-size:10px;color:${b-r<0?'var(--red)':'var(--green)'}">${fmtRK(b-r)}</td>
      <td style="font-family:var(--mono);font-size:10px;color:${corP}">${prazo===null?'—':prazo<0?'Atrasado':prazo+'d'}</td>
      <td style="color:var(--blue-light);font-size:11px">›</td>
    </tr>`;
  }).join('');
  const header=`
  <div class="ob-ov-header">
    <div class="ob-ov-title">${titulos[tipo]} &mdash; Análise Gerencial (${lista.length} obras)</div>
    <div class="ob-ov-header-btns"><button class="ob-ov-close" onclick="voltarParaSubCards()">← voltar</button></div>
  </div>
  <div class="ob-ov-kpis">
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Budget Total</div><div class="ob-ov-kpi-val c-azul">${fmtRK(totalB)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Gasto</div><div class="ob-ov-kpi-val c-laranja">${fmtRK(totalR)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Orçado</div><div class="ob-ov-kpi-val ${Orçado<0?'c-vermelho':'c-verde'}">${fmtRK(Orçado)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Avanço Físico Médio - Obras em andamento</div><div class="ob-ov-kpi-val ${avgFis>70?'c-verde':avgFis>40?'c-amarelo':'c-laranja'}">${fmt(avgFis,1)}%</div></div>
  </div>
  <div class="ob-ov-tbox" style="margin-bottom:16px">
    <div class="ob-ov-ctit" style="margin-bottom:8px">Detalhamento das ${lista.length} obra(s)</div>
    <table class="ob-ov-table">
      <thead><tr><th>Obra</th><th>Status</th><th>% Físico</th><th>% Financeiro</th><th>Orçado</th><th>Prazo</th><th></th></tr></thead>
      <tbody>${linhas||'<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:16px">Nenhuma obra</td></tr>'}</tbody>
    </table>
  </div>`;
  return{header,lista,totalB,totalR,Orçado};
}
function buildOverlayTotal(d){
  const {header}=_obOvBase(d,'total');
  return header+`
  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div class="ob-ov-cbox" style="width:220px;flex-shrink:0">
      <div class="ob-ov-ctit">Gasto × Orçado</div>
      <canvas id="cv-ov-pizza2" width="190" height="190" style="width:190px;height:190px;display:block"></canvas>
      <div id="leg-ov-pizza2" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
    </div>
    <div class="ob-ov-cbox" style="flex:1;min-width:0">
      <div class="ob-ov-ctit">Gastos por Categoria</div>
      <canvas id="cv-ov-barras" width="400" height="220" style="width:100%;height:220px;display:block"></canvas>
    </div>
    <div class="ob-ov-cbox" style="flex:1;min-width:0">
      <div class="ob-ov-ctit" id="cv-ov-pizza1-titulo">Avanço por Obras em Andamento</div>
      <canvas id="cv-ov-pizza1" width="400" height="220" style="width:100%;height:220px;display:block"></canvas>
    </div>
  </div>`;
}
function buildOverlayAndamento(d){
  const {header}=_obOvBase(d,'andamento');
  return header+`
  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div class="ob-ov-cbox" style="width:220px;flex-shrink:0">
      <div class="ob-ov-ctit">Gasto × Orçado</div>
      <canvas id="cv-ov-pizza2" width="190" height="190" style="width:190px;height:190px;display:block"></canvas>
      <div id="leg-ov-pizza2" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
    </div>
    <div class="ob-ov-cbox" style="flex:1;min-width:0">
      <div class="ob-ov-ctit">Gastos por Categoria</div>
      <canvas id="cv-ov-barras" width="400" height="220" style="width:100%;height:220px;display:block"></canvas>
    </div>
    <div class="ob-ov-cbox" style="flex:1;min-width:0">
      <div class="ob-ov-ctit" id="cv-ov-pizza1-titulo">Avanço por Obras em Andamento</div>
      <canvas id="cv-ov-pizza1" width="400" height="220" style="width:100%;height:220px;display:block"></canvas>
    </div>
  </div>`;
}
function buildOverlayConcluidas(d){
  const {header}=_obOvBase(d,'concluidas');
  return header+`
  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div class="ob-ov-cbox" style="width:220px;flex-shrink:0">
      <div class="ob-ov-ctit">Gasto × Orçado</div>
      <canvas id="cv-ov-pizza2" width="190" height="190" style="width:190px;height:190px;display:block"></canvas>
      <div id="leg-ov-pizza2" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
    </div>
    <div class="ob-ov-cbox" style="flex:1;min-width:0">
      <div class="ob-ov-ctit">Gastos por Categoria</div>
      <canvas id="cv-ov-barras" width="400" height="220" style="width:100%;height:220px;display:block"></canvas>
    </div>
  </div>`;
}
function buildOverlayPlanejadas(d){
  const {header}=_obOvBase(d,'planejadas');
  return header;
}
function drawOverlayCharts(tipo,d){
  const obras=d.obras||[];const lanc=d.lancamentos||[];
  const filtros={total:obras,andamento:obras.filter(o=>o.status==='Em Andamento'),concluidas:obras.filter(o=>o.status==='Concluído'),planejadas:obras.filter(o=>o.status==='Planejado')};
  const lista=filtros[tipo]||[];
  const avTop=lista.slice(0,8).map(o=>({nome:tnome(o.nome),av:calcAvFis(o)})).filter(x=>x.av>0&&x.av<100);
  const cv1=document.getElementById('cv-ov-pizza1');
  if(cv1){
    cv1.width=cv1.parentElement.clientWidth||400;
    if(avTop.length){
      desenharBarrasH(cv1.id,avTop.map(x=>x.nome),avTop.map(x=>x.av),['#2E5FA3','#3fb950','#e3711a','#d29922','#a371f7','#58a6ff','#f85149','#8b949e']);
    } else {
      const fins=lista.slice(0,8).map(o=>{
        const b=budgObra(o.cod),r=realObra(o.cod);
        return{nome:tnome(o.nome),pct:b>0?Math.round(r/b*100):0};
      }).filter(x=>x.pct>0);
      if(fins.length){
        const cores=fins.map(x=>x.pct>100?'#f85149':x.pct>80?'#3fb950':'#2E5FA3');
        desenharBarrasH(cv1.id,fins.map(x=>x.nome),fins.map(x=>x.pct),cores);
      }
    }
  }
  const totalB=lista.reduce((s,o)=>s+budgObra(o.cod),0);
  const totalR=lista.reduce((s,o)=>s+realObra(o.cod),0);
  const Orçado=Math.max(totalB-totalR,0);
  const cv2=document.getElementById('cv-ov-pizza2');
  if(cv2&&(totalR||Orçado))desenharDonutResponsivo(cv2,['Realizado','Orçado'],[totalR||1,Orçado||1],['#e3711a','#2E5FA3']);
  const legP2=document.getElementById('leg-ov-pizza2');
  if(legP2){
    const itens=[{l:'Realizado',v:totalR,c:'#e3711a'},{l:'Orçado',v:Math.max(Orçado,0),c:'#2E5FA3'}];
    legP2.innerHTML=itens.map(x=>`<span style="display:flex;align-items:center;gap:6px;font-size:10px"><span style="width:8px;height:8px;border-radius:2px;background:${x.c};flex-shrink:0"></span><span style="color:var(--text-muted)">${x.l}:</span><b style="font-family:var(--mono);color:var(--text)">${fmtRK(x.v)}</b></span>`).join('');
  }
  const catM={};lista.forEach(o=>{lanc.filter(l=>l.obraCod===o.cod).forEach(l=>{const c=l.categoria||'Outros';catM[c]=(catM[c]||0)+l.qtd*l.precoUnit;});});
  const top=Object.entries(catM).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const cvb=document.getElementById('cv-ov-barras');
  if(cvb&&top.length){
    const pw=cvb.parentElement.clientWidth||400;cvb.width=pw;
    desenharBarrasH('cv-ov-barras',top.map(x=>x[0]),top.map(x=>x[1]),['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7','#58a6ff','#f85149','#8b949e']);
  }
}
function abrirDetalheObra(cod){
  if(!_obrasData)return;
  const o=(_obrasData.obras||[]).find(x=>x.cod===cod);
  if(!o)return;

  const b=budgObra(cod),r=realObra(cod),af=calcAvFis(o),pf=b>0?(r/b)*100:0,ef=af-pf;
  const lancsObra=(_obrasData.lancamentos||[]).filter(l=>l.obraCod===cod);
  const mensal={};lancsObra.forEach(l=>{const m=l.dtLanc?l.dtLanc.slice(0,7):'';if(m)mensal[m]=(mensal[m]||0)+l.qtd*l.precoUnit;});
  const mKeys=Object.keys(mensal).sort().slice(-8);
  const catMap={};lancsObra.forEach(l=>{const c=l.categoria||'Outros';catMap[c]=(catMap[c]||0)+l.qtd*l.precoUnit;});
  const topCat=Object.entries(catMap).sort((a,b2)=>b2[1]-a[1]);
  const etapas=o.etapas||[];
  const hoje=new Date();
  const fimRef=o.dtFimReal||null;
  const fimPrev=o.dtFimPrev||null;
  let prazo=null,prazoTxt='—',corP='var(--text-dim)';
  if(fimPrev){
    if(fimRef){
      // obra concluída — compara fim real vs fim previsto
      const dias=Math.floor((new Date(fimRef+'T00:00:00')-new Date(fimPrev+'T00:00:00'))/86400000);
      if(dias>0){prazoTxt=dias+'d atraso';corP='var(--red)';}
      else if(dias<0){prazoTxt=Math.abs(dias)+'d adiantado';corP='var(--green)';}
      else{prazoTxt='No prazo';corP='var(--green)';}
    } else {
      // obra em aberto — compara hoje vs fim previsto
      prazo=Math.floor((new Date(fimPrev+'T00:00:00')-hoje)/86400000);
      if(prazo<0){prazoTxt=Math.abs(prazo)+'d atraso';corP='var(--red)';}
      else if(prazo===0){prazoTxt='Vence hoje';corP='var(--yellow)';}
      else if(prazo<=30){prazoTxt=prazo+'d restantes';corP='var(--yellow)';}
      else{prazoTxt=prazo+'d restantes';corP='var(--green)';}
    }
  }
  const pb2=(v,c)=>`<div class="ob-mini-prog"><div class="ob-mbar"><div class="ob-mfill" style="width:${Math.min(v,100)}%;background:${c}"></div></div><span style="font-size:9px;font-family:var(--mono);color:var(--text-muted);min-width:34px">${fmt(v,1)}%</span></div>`;
  const badgeSt=s=>{const m={'Em Andamento':'badge-and','Concluído':'badge-conc','Planejado':'badge-plan','Suspenso':'badge-susp'};return`<span class="badge-sm ${m[s]||'badge-plan'}">${s}</span>`;};

  const conteudo=document.querySelector('#painel-expandido-global > div:last-child');
  if(!conteudo)return;

  conteudo.innerHTML=`
  <div class="ob-ov-header">
    <div class="ob-ov-title">${o.nome} — Detalhamento</div>
    <div style="display:flex;gap:8px">
      <button class="ob-ov-close" onclick="voltarParaLista()">← voltar</button>
    </div>
  </div>

  <div class="ob-ov-kpis" style="margin-bottom:12px">
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Budget</div><div class="ob-ov-kpi-val c-azul">${fmtRK(b)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Realizado</div><div class="ob-ov-kpi-val c-laranja">${fmtRK(r)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Orçado</div><div class="ob-ov-kpi-val ${b-r<0?'c-vermelho':'c-verde'}">${fmtRK(b-r)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Eficiência</div><div class="ob-ov-kpi-val ${ef>5?'c-verde':ef<-5?'c-vermelho':'c-amarelo'}">${ef>=0?'+':''}${fmt(ef,1)}%</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Status</div><div class="ob-ov-kpi-val" style="font-size:13px">${badgeSt(o.status)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Prazo</div><div class="ob-ov-kpi-val" style="font-size:14px;color:${corP}">${prazoTxt}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Avanço Físico</div><div class="ob-ov-kpi-val ${af>70?'c-verde':af>40?'c-amarelo':'c-laranja'}">${fmt(af,1)}%</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">% Financeiro</div><div class="ob-ov-kpi-val c-azul">${fmt(pf,1)}%</div></div>
  </div>

  <div class="ob-ov-charts" style="margin-bottom:12px">
    <div class="ob-ov-cbox">
      <div class="ob-ov-ctit">Gastos mensais</div>
      <canvas id="cv-det-spark" width="300" height="140" style="width:100%;height:140px;display:block"></canvas>
    </div>
    <div class="ob-ov-cbox" style="flex:1">
      <div class="ob-ov-ctit">Por categoria</div>
      <canvas id="cv-det-cat" width="500" height="200" style="width:100%;height:200px;display:block"></canvas>
      <div id="leg-det-cat" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
  </div>

  <div class="ob-ov-tbox" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="ob-ov-ctit">Observações</div>
      <button onclick="
        const ta=document.getElementById('obs-det-obra');
        const btn=this;
        if(ta.readOnly){ta.readOnly=false;ta.style.background='var(--surface)';ta.style.borderColor='var(--blue-mid)';ta.focus();btn.textContent='💾 salvar';}
        else{
          const obs=ta.value.trim();
          const obras=_obrasData.obras||[];
          const ob=obras.find(x=>x.cod==='${cod}');
          if(ob){ob.observacao=obs; API.obras.salvar(_obrasData);}
          ta.readOnly=true;ta.style.background='var(--bg)';ta.style.borderColor='var(--border)';btn.textContent='✏️ editar';
        }
      " style="font-size:10px;padding:3px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text-muted);cursor:pointer;font-family:var(--font)">✏️ editar</button>
    </div>
    <textarea id="obs-det-obra" readonly rows="4" style="width:100%;font-size:12px;color:var(--text);line-height:1.6;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:var(--font);resize:vertical;box-sizing:border-box;outline:none">${o.observacao||o.obs||o.observacoes||''}</textarea>
  </div>

  ${lancsObra.length?`
  <div class="ob-ov-tbox">
    <div class="ob-ov-ctit" style="margin-bottom:8px">Lançamentos (${lancsObra.length})</div>
    <table class="ob-ov-table">
      <thead><tr><th>ID</th><th>CRESP</th><th>Categoria</th><th>Subcategoria</th><th>Descrição</th><th style="text-align:center">Unid</th><th style="text-align:right">Qtd</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th><th>Data</th></tr></thead>
      <tbody id="lanc-tbody-det"></tbody>
      <tfoot><tr><td colspan="8" style="font-weight:600;font-size:11px">TOTAL</td><td style="font-family:var(--mono);font-weight:700;text-align:right;color:var(--blue-light)">${fmtRK(lancsObra.reduce((s,l)=>s+l.qtd*l.precoUnit,0))}</td><td></td></tr></tfoot>
    </table>
    <div id="lanc-pag" style="display:flex;align-items:center;gap:4px;margin-top:10px;flex-wrap:wrap"></div>
  </div>`:''}`;

  requestAnimationFrame(()=>{
    if(mKeys.length>=2){
      const cvspark=document.getElementById('cv-det-spark');
      if(cvspark){const pw=cvspark.parentElement.clientWidth||300;cvspark.width=pw;desenharSparkComValores('cv-det-spark',mKeys.map(k=>k.slice(5)),mKeys.map(k=>mensal[k]),'#58a6ff');}
    }
    if(topCat.length){
      const cvcat=document.getElementById('cv-det-cat');
      const cores=['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7','#39c5cf','#bc8cff','#f85149'];
      if(cvcat){const pw=cvcat.parentElement.clientWidth||400;cvcat.width=pw;desenharBarrasH('cv-det-cat',topCat.map(x=>x[0]),topCat.map(x=>x[1]),cores);}
      const leg=document.getElementById('leg-det-cat');
      if(leg)leg.innerHTML=topCat.map((x,i)=>`<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted)"><span style="width:8px;height:8px;border-radius:2px;background:${cores[i%cores.length]};flex-shrink:0"></span>${x[0]}: <b style="color:var(--text);font-family:var(--mono)">${fmtRK(x[1])}</b></span>`).join('');
    }
    const lancSorted=lancsObra.slice().sort((a,b2)=>(b2.dtLanc||'').localeCompare(a.dtLanc||''));
    const perPag=10;
    let pagAtual=1;
    function renderPagLanc(){
      const inicio=(pagAtual-1)*perPag;
      const pagina=lancSorted.slice(inicio,inicio+perPag);
      const tbody=document.getElementById('lanc-tbody-det');
      if(!tbody)return;
      tbody.innerHTML=pagina.map(l=>{const tot=l.qtd*l.precoUnit;return`<tr>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${l.id||'—'}</td>
        <td><span style="background:var(--blue-pale);color:var(--blue-mid);border-radius:4px;padding:1px 5px;font-family:var(--mono);font-size:10px">${l.cresp||'—'}</span></td>
        <td style="font-size:10px">${l.categoria||'—'}</td>
        <td style="font-size:10px;color:var(--text-muted)">${l.subcategoria||'—'}</td>
        <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.descricao||'—'}</td>
        <td style="font-family:var(--mono);font-size:10px;text-align:center">${l.unid||'—'}</td>
        <td style="font-family:var(--mono);font-size:10px;text-align:right">${fmt(l.qtd,2)}</td>
        <td style="font-family:var(--mono);font-size:10px;text-align:right">${fmtRK(l.precoUnit)}</td>
        <td style="font-family:var(--mono);font-size:11px;font-weight:600;text-align:right;color:var(--blue-light)">${fmtRK(tot)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${l.dtLanc?l.dtLanc.split('-').reverse().join('/'):'—'}</td>
      </tr>`;}).join('');
      const totalPags=Math.ceil(lancSorted.length/perPag);
      const pag=document.getElementById('lanc-pag');
      if(!pag)return;
      const btnStyle=(ativo)=>`cursor:pointer;padding:4px 10px;border-radius:5px;font-family:var(--mono);font-size:11px;border:1px solid ${ativo?'var(--blue-mid)':'var(--border)'};background:${ativo?'var(--blue-pale)':'var(--surface)'};color:${ativo?'var(--blue-mid)':'var(--text-muted)'}`;
      let html=`<button style="${btnStyle(false)}" onclick="window._lancPag(${pagAtual-1})" ${pagAtual===1?'disabled':''}>← ant</button>`;
      for(let i=1;i<=totalPags;i++){
        if(totalPags<=7||i===1||i===totalPags||Math.abs(i-pagAtual)<=1){
          html+=`<button style="${btnStyle(i===pagAtual)}" onclick="window._lancPag(${i})">${i}</button>`;
        } else if(Math.abs(i-pagAtual)===2){
          html+=`<span style="color:var(--text-muted);padding:0 2px">…</span>`;
        }
      }
      html+=`<button style="${btnStyle(false)}" onclick="window._lancPag(${pagAtual+1})" ${pagAtual===totalPags?'disabled':''}>próx →</button>`;
      html+=`<span style="font-size:10px;color:var(--text-muted);margin-left:6px">${inicio+1}–${Math.min(inicio+perPag,lancSorted.length)} de ${lancSorted.length}</span>`;
      pag.innerHTML=html;
    }
    window._lancPag=function(p){
      const total=Math.ceil(lancSorted.length/perPag);
      if(p<1||p>total)return;
      pagAtual=p;
      renderPagLanc();
    };
    renderPagLanc();
    // botão editar obs
    const btnObs=document.getElementById('btn-obs-edit');
    const taObs=document.getElementById('obs-det-obra');
    if(btnObs&&taObs){
      btnObs.addEventListener('click', async ()=>{
        if(taObs.readOnly){
          taObs.readOnly=false;
          taObs.style.background='var(--surface)';
          taObs.style.borderColor='var(--blue-mid)';
          taObs.focus();
          btnObs.textContent='💾 salvar';
        } else {
          const obs=taObs.value.trim();
          const ob=(_obrasData.obras||[]).find(x=>x.cod===cod);
          if(ob){ob.observacao=obs; await API.obras.salvar(_obrasData);}
          taObs.readOnly=true;
          taObs.style.background='var(--bg)';
          taObs.style.borderColor='var(--border)';
          btnObs.textContent='✏️ editar';
        }
      });
    }
  });
}
function renderAtividades(container,d){
  const ativs=Array.isArray(d)?d:(Array.isArray(d?.atividades)?d.atividades:[]);
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo de atividades carregado.<br><span style="font-size:10px">Selecione o arquivo no hub principal.</span></div>';return;}
  const hoje=new Date().toISOString().slice(0,10);
  const total=ativs.length;
  const done=ativs.filter(a=>a.status==='done').length;
  const venc=ativs.filter(a=>a.prazo&&a.prazo<hoje&&a.status!=='done').length;
  const semResp=ativs.filter(a=>!a.responsavel&&!a.assignee).length;
  const doing=ativs.filter(a=>a.status==='doing').length;
  const blocked=ativs.filter(a=>a.status==='blocked').length;
  const todo=ativs.filter(a=>!a.status||a.status==='todo').length;
  const pct=total>0?Math.round(done/total*100):0;
  const statusMap={};ativs.forEach(a=>{const s=a.status||'todo';statusMap[s]=(statusMap[s]||0)+1;});
  const prioMap={};ativs.forEach(a=>{const p=a.prioridade||a.priority||'Normal';prioMap[p]=(prioMap[p]||0)+1;});
  const respMap={};ativs.forEach(a=>{const r=a.responsavel||a.assignee||'';if(r)respMap[r]=(respMap[r]||0)+1;});
  const topResp=Object.entries(respMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const mensal={};ativs.forEach(a=>{const m=(a.criadoEm||a.createdAt||'').slice(0,7);if(m)mensal[m]=(mensal[m]||0)+1;});
  const mKeys=Object.keys(mensal).sort().slice(-6);

  // guarda dados globais para o overlay
  window._ativsData={ativs,statusMap,prioMap,topResp,mensal,mKeys,hoje};
  window._ativDrill=null;

  container.innerHTML=`<div class="mod-section">
    <div class="secao-titulo">Atividades</div>
    <div class="mod-cards-grid" id="ativs-grid">
      ${mkModCard('at-total','TOTAL TAREFAS',total,'c-azul','#58a6ff',`${total-done} em aberto`,
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Concluídas</span><span class="ob-mini-val c-verde">${done}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">% Concluído</span><span class="ob-mini-val c-azul">${pct}%</span></div>`)}
      ${mkModCard('at-venc','VENCIDAS',venc,venc>0?'c-vermelho':'c-verde','#f85149','fora do prazo',
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Em andamento</span><span class="ob-mini-val c-laranja">${doing}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Bloqueadas</span><span class="ob-mini-val c-vermelho">${blocked}</span></div>`)}
      ${mkModCard('at-sem','SEM RESPONSÁVEL',semResp,semResp>0?'c-amarelo':'c-verde','#d29922','atribuição pendente',
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">A fazer</span><span class="ob-mini-val c-azul">${todo}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Top resp.</span><span class="ob-mini-val c-azul">${topResp[0]?topResp[0][0]:'—'}</span></div>`)}
      ${mkModCard('at-done','CONCLUÍDAS',done,'c-verde','#3fb950',`${pct}% do total`,
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Nos últimos</span><span class="ob-mini-val c-verde">${mKeys.length} meses</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Bloqueadas</span><span class="ob-mini-val c-vermelho">${blocked}</span></div>`)}
    </div>
  </div>`;

  setTimeout(()=>{
    // total → pizza de status
    const sl=Object.entries(statusMap).filter(x=>x[1]);
    drawModMiniCard('cv-mod-at-total',sl.map(x=>x[0]),sl.map(x=>x[1]),['#58a6ff','#e3711a','#3fb950','#f85149','#d29922']);
    // vencidas → pizza de prioridade
    const pl=Object.entries(prioMap).filter(x=>x[1]);
    drawModMiniCard('cv-mod-at-venc',pl.map(x=>x[0]),pl.map(x=>x[1]),['#f85149','#d29922','#3fb950','#58a6ff']);
    // sem resp → pizza por responsável (top)
    drawModMiniCard('cv-mod-at-sem',topResp.map(x=>x[0]),topResp.map(x=>x[1]),['#2E5FA3','#a371f7','#3fb950','#d29922','#e3711a']);
    // concluídas → pizza por mês
    drawModMiniCard('cv-mod-at-done',mKeys.map(k=>k.slice(5)),mKeys.map(k=>mensal[k]),['#3fb950','#58a6ff','#2E5FA3','#a371f7','#d29922','#e3711a']);
  },60);
}

/* ══════════════════════════════════════════════
   CHAMADOS
══════════════════════════════════════════════ */
async function renderChamados(container,d){
  const cham=d?.chamados||(Array.isArray(d)?d:[]);
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo de chamados carregado.<br><span style="font-size:10px">Selecione o arquivo no hub principal.</span></div>';return;}
  const total=cham.length;
  const abertos=cham.filter(c=>c.status==='Aberto').length;
  const emAt=cham.filter(c=>c.status==='Em Andamento'||c.status==='Em Atendimento').length;
  const alta=cham.filter(c=>c.status==='Em Andamento'||c.status==='Em Atendimento').length;
  const semResp=cham.filter(c=>!c.responsavel&&!c.atendente).length;
  const resolvidos=cham.filter(c=>c.status==='Resolvido'||c.status==='Fechado'||c.status==='Concluído').length;
  const pct=total>0?Math.round(resolvidos/total*100):0;
  const statusMap={};cham.forEach(c=>{const s=c.status||'Aberto';statusMap[s]=(statusMap[s]||0)+1;});
  const catMap={};cham.forEach(c=>{const cat=c.categoria||'Geral';catMap[cat]=(catMap[cat]||0)+1;});
  const topCat=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const respMap={};cham.forEach(c=>{const r=c.responsavel||c.atendente||'';if(r)respMap[r]=(respMap[r]||0)+1;});
  const topResp=Object.entries(respMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const prioMap={};cham.forEach(c=>{const p=c.prioridade||'Média';prioMap[p]=(prioMap[p]||0)+1;});
  const mensal={};cham.forEach(c=>{const m=(c.dtAbertura||c.criadoEm||'').slice(0,7);if(m)mensal[m]=(mensal[m]||0)+1;});
  const mKeys=Object.keys(mensal).sort().slice(-6);

  window._chamData={cham,statusMap,catMap,topCat,respMap,topResp,prioMap,mensal,mKeys};
  window._chamDrill=null;

  container.innerHTML=`<div class="mod-section">
    <div class="secao-titulo">Chamados</div>
    <div class="mod-cards-grid" id="cham-grid">
      ${mkModCard('ch-total','TOTAL CHAMADOS',total,'c-azul','#58a6ff',`${abertos} abertos`,
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Em atendimento</span><span class="ob-mini-val c-laranja">${emAt}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Concluídos</span><span class="ob-mini-val c-verde">${resolvidos}</span></div>`)}
      ${mkModCard('ch-alta','ALTA PRIORIDADE',alta,alta>0?'c-vermelho':'c-verde','#f85149',`${emAt} em atendimento`,
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Críticos</span><span class="ob-mini-val c-vermelho">${cham.filter(c=>c.prioridade==='Crítica').length}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Abertos alta</span><span class="ob-mini-val c-laranja">${cham.filter(c=>(c.prioridade==='Alta'||c.prioridade==='Crítica')&&c.status==='Aberto').length}</span></div>`)}
      ${mkModCard('ch-sem','SEM RESPONSÁVEL',semResp,semResp>0?'c-amarelo':'c-verde','#d29922','atribuição pendente',
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Top categ.</span><span class="ob-mini-val c-azul">${topCat[0]?topCat[0][0]:'—'}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Top atend.</span><span class="ob-mini-val c-azul">${topResp[0]?topResp[0][0]:'—'}</span></div>`)}
      ${mkModCard('ch-resol','RESOLVIDOS',resolvidos,'c-verde','#3fb950',`${pct}% do total`,
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Taxa resolução</span><span class="ob-mini-val c-verde">${pct}%</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Pendentes</span><span class="ob-mini-val c-amarelo">${total-resolvidos}</span></div>`)}
    </div>
  </div>`;
  const slaKey='chamados-sla-config';
  const slaCfg = await API.chamados.sla();
  const _slaD=p=>slaCfg[p]||({'Crítica':1,'Alta':3,'Média':5,'Baixa':7}[p]||7);
  const _diasD=c=>{const i=new Date(c.dtAbertura||c.dataAbertura||c.criadoEm||Date.now());const f=c.dataConclusao?new Date(c.dataConclusao):new Date();return Math.max(0,(f-i)/86400000);};
  const comData=cham.filter(x=>x.dtAbertura||x.dataAbertura||x.criadoEm);
  const noSLA=comData.filter(c=>_diasD(c)<=_slaD(c.prioridade)).length;
  const pctSLA=comData.length?Math.round(noSLA/comData.length*100):100;
  document.getElementById('mfoot-chamados').textContent=
    Math.round(resolvidos/Math.max(total,1)*100)+'% resolvidos · SLA: '+pctSLA+'%';

  setTimeout(()=>{
    const sl=Object.entries(statusMap).filter(x=>x[1]);
    drawModMiniCard('cv-mod-ch-total',sl.map(x=>x[0]),sl.map(x=>x[1]),['#f85149','#e3711a','#3fb950','#58a6ff']);
    const pl=Object.entries(prioMap).filter(x=>x[1]);
    drawModMiniCard('cv-mod-ch-alta',pl.map(x=>x[0]),pl.map(x=>x[1]),['#f85149','#e3711a','#d29922','#3fb950']);
    drawModMiniCard('cv-mod-ch-sem',topCat.map(x=>x[0]),topCat.map(x=>x[1]),['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7']);
    drawModMiniCard('cv-mod-ch-resol',mKeys.map(k=>k.slice(5)),mKeys.map(k=>mensal[k]),['#3fb950','#58a6ff','#2E5FA3','#d29922','#e3711a','#a371f7']);
    document.querySelectorAll('#cham-grid .ob-card').forEach(card=>{
      card.style.cursor='pointer';
    });
  },120);
}

function abrirDrillChamados(tipo){
  const conteudo=document.querySelector('#painel-expandido-global > div:last-child');
  if(!conteudo||!window._chamData)return;
  _chamDrillAtivo=tipo;
  conteudo.style.cssText='flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
  const overlay=document.createElement('div');
  overlay.className='ob-overlay';
  overlay.id='ch-overlay';
  overlay.innerHTML=buildDrillChamados(tipo);
  conteudo.innerHTML='';
  conteudo.appendChild(overlay);
  setTimeout(()=>{
    drawDrillChamadosCharts(tipo);
    const totalLista=window._chamDrillLista?.length||0;
    const _perPag2=50,_inicio2=(window._chamDrillPag-1)*_perPag2;
    const totalPags=Math.ceil(totalLista/_perPag2);
    const pag=overlay.querySelector('#cham-pag-ctrl');
    if(pag&&totalPags>1){
      const bs=(ativo,txt,p,dis)=>`<button onclick="window._chamIrPag(${p})" ${dis?'disabled':''} style="cursor:pointer;padding:4px 10px;border-radius:5px;font-family:var(--mono);font-size:11px;border:1px solid ${ativo?'var(--blue-mid)':'var(--border)'};background:${ativo?'var(--blue-pale)':'var(--surface)'};color:${ativo?'var(--blue-mid)':'var(--text-muted)'}">${txt}</button>`;
      let html=bs(false,'← ant',window._chamDrillPag-1,window._chamDrillPag===1);
      for(let i=1;i<=totalPags;i++){
        if(totalPags<=7||i===1||i===totalPags||Math.abs(i-window._chamDrillPag)<=1)html+=bs(i===window._chamDrillPag,i,i,false);
        else if(Math.abs(i-window._chamDrillPag)===2)html+=`<span style="color:var(--text-muted)">…</span>`;
      }
      html+=bs(false,'próx →',window._chamDrillPag+1,window._chamDrillPag===totalPags);
      html+=`<span style="font-size:10px;color:var(--text-muted);margin-left:6px">${_inicio2+1}–${Math.min(_inicio2+_perPag2,totalLista)} de ${totalLista}</span>`;
      pag.innerHTML=html;
    }
  },60);
  window._chamIrPag=function(p){
    const tot=Math.ceil((window._chamDrillLista?.length||0)/50);
    if(p<1||p>tot)return;
    window._chamDrillPag=p;
    abrirDrillChamados(tipo);
  };
}

function buildDrillChamados(tipo){
  const {cham,statusMap,prioMap,topCat,topResp,mensal,mKeys}=window._chamData;
  const titulos={
    'ch-total':'Todos os Chamados',
    'ch-alta':'Alta Prioridade',
    'ch-sem':'Sem Responsável',
    'ch-resol':'Concluídos'
  };
  const filtros={
    'ch-total':cham,
    'ch-alta':cham.filter(c=>c.prioridade==='Alta'||c.prioridade==='Crítica'),
    'ch-sem':cham.filter(c=>!c.responsavel&&!c.atendente),
    'ch-resol':cham.filter(c=>['Resolvido','Fechado','Concluído'].includes(c.status))
  };
  const lista=filtros[tipo]||cham;
  const total=lista.length;
  const abertos=lista.filter(c=>c.status==='Aberto').length;
  const emAt=lista.filter(c=>c.status==='Em Andamento'||c.status==='Em Atendimento').length;
  const resolvidos=lista.filter(c=>['Resolvido','Fechado','Concluído'].includes(c.status)).length;
  const pct=total>0?Math.round(resolvidos/total*100):0;
  const badgePrio=p=>{const m={'Alta':'badge-and','Crítica':'badge-susp','Média':'badge-plan','Baixa':'badge-conc'};return`<span class="badge-sm ${m[p]||'badge-plan'}">${p||'—'}</span>`;};
  const badgeSt=s=>{const m={'Aberto':'badge-and','Em Andamento':'badge-plan','Resolvido':'badge-conc','Fechado':'badge-conc','Concluído':'badge-conc','Cancelado':'badge-susp'};return`<span class="badge-sm ${m[s]||'badge-plan'}">${s||'—'}</span>`;};
  if(!window._chamDrillTipo||window._chamDrillTipo!==tipo)window._chamDrillPag=1;
  window._chamDrillTipo=tipo;
  window._chamDrillLista=lista.slice().sort((a,b)=>{
    const ord={'Aberto':0,'Em Andamento':1,'Crítica':0,'Alta':1,'Média':2,'Baixa':3};
    return(ord[a.status]??9)-(ord[b.status]??9)||(ord[a.prioridade]??9)-(ord[b.prioridade]??9);
  });
  const _perPag=50,_inicio=(window._chamDrillPag-1)*_perPag;
  const linhas=window._chamDrillLista.slice(_inicio,_inicio+_perPag).map(c=>`<tr style="cursor:pointer" onclick="abrirDetalheChamado('${c.id}')">
    <td style="font-family:var(--mono);font-size:10px;color:var(--blue-light)">${c.id||'—'}</td>
    <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${c.titulo||''}">${c.titulo||'—'}</td>
    <td>${badgeSt(c.status)}</td>
    <td>${badgePrio(c.prioridade)}</td>
    <td style="font-size:10px;color:var(--text-muted)">${c.categoria||'—'}</td>
    <td style="font-size:10px;color:${c.responsavel?'var(--text)':'var(--red)'}">${c.responsavel||c.atendente||'⚠ sem resp.'}</td>
    <td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${c.dtAbertura||c.dataAbertura||c.criadoEm?((c.dtAbertura||c.dataAbertura||c.criadoEm).slice(0,10).split('-').reverse().join('/')):'—'}</td>
    <td style="color:var(--blue-light);font-size:11px">›</td>
  </tr>`).join('');

  return`
  <div class="ob-ov-header">
    <div class="ob-ov-title">${titulos[tipo]||'Chamados'} — Análise (${total})</div>
    <button class="ob-ov-close" onclick="voltarParaChamados()">← voltar</button>
  </div>
  <div class="ob-ov-kpis">
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Total</div><div class="ob-ov-kpi-val c-azul">${total}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Abertos</div><div class="ob-ov-kpi-val ${abertos>0?'c-vermelho':'c-verde'}">${abertos}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Em atendimento</div><div class="ob-ov-kpi-val c-laranja">${emAt}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Concluídos</div><div class="ob-ov-kpi-val c-verde">${resolvidos}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Taxa resolução</div><div class="ob-ov-kpi-val ${pct>70?'c-verde':pct>40?'c-amarelo':'c-vermelho'}">${pct}%</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Média atendimento</div><div class="ob-ov-kpi-val c-azul">${(()=>{const conc=lista.filter(c=>['Resolvido','Fechado','Concluído'].includes(c.status)&&(c.dtAbertura||c.dataAbertura||c.criadoEm)&&(c.dataConclusao||c.dtConclusao||c.dtFechamento||c.resolvidoEm));if(!conc.length)return'—';const media=conc.reduce((s,c)=>{const ini=new Date(c.dtAbertura||c.dataAbertura||c.criadoEm);const fim=new Date(c.dataConclusao||c.dtConclusao||c.dtFechamento||c.resolvidoEm);return s+Math.max(0,(fim-ini)/86400000);},0)/conc.length;return Math.round(media)+'d';})()}</div></div>
  </div>
  <div class="ob-ov-charts">
    <div class="ob-ov-cbox">
      <div class="ob-ov-ctit">Status</div>
      <canvas id="cv-ch-ov-status" width="160" height="160" style="width:160px;height:160px;display:block"></canvas>
      <div id="leg-ch-status" style="margin-top:8px;display:flex;flex-direction:column;gap:3px"></div>
    </div>
    <div class="ob-ov-cbox">
      <div class="ob-ov-ctit">Prioridade</div>
      <canvas id="cv-ch-ov-prio" width="160" height="160" style="width:160px;height:160px;display:block"></canvas>
      <div id="leg-ch-prio" style="margin-top:8px;display:flex;flex-direction:column;gap:3px"></div>
    </div>
    <div class="ob-ov-cbox" style="flex:1">
      <div class="ob-ov-ctit">Por categoria</div>
      <canvas id="cv-ch-ov-cat" width="400" height="140" style="width:100%;height:140px;display:block"></canvas>
    </div>
  </div>
  <div class="ob-ov-tbox">
    <div class="ob-ov-ctit" style="margin-bottom:8px">Chamados (${_inicio+1}–${Math.min(_inicio+_perPag,window._chamDrillLista.length)} de ${window._chamDrillLista.length})</div>
    <table class="ob-ov-table">
      <thead><tr><th>ID</th><th>Título</th><th>Status</th><th>Prioridade</th><th>Categoria</th><th>Responsável</th><th>Abertura</th><th></th></tr></thead>
      <tbody>${linhas||'<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:16px">Nenhum chamado</td></tr>'}</tbody>
    </table>
    <div id="cham-pag-ctrl" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;flex-wrap:wrap"></div>
  </div>`;
}

function drawDrillChamadosCharts(tipo){
  const {cham,statusMap,prioMap,topCat}=window._chamData;
  const filtros={
    'ch-total':cham,
    'ch-alta':cham.filter(c=>c.prioridade==='Alta'||c.prioridade==='Crítica'),
    'ch-sem':cham.filter(c=>!c.responsavel&&!c.atendente),
    'ch-resol':cham.filter(c=>['Resolvido','Fechado','Concluído'].includes(c.status))
  };
  const lista=filtros[tipo]||cham;
  const sm={};lista.forEach(c=>{const s=c.status||'Aberto';sm[s]=(sm[s]||0)+1;});
  const pm={};lista.forEach(c=>{const p=c.prioridade||'Média';pm[p]=(pm[p]||0)+1;});
  const cm={};lista.forEach(c=>{const cat=c.categoria||'Geral';cm[cat]=(cm[cat]||0)+1;});
  const slSt=Object.entries(sm).filter(x=>x[1]);
  const slPr=Object.entries(pm).filter(x=>x[1]);
  const topC=Object.entries(cm).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const corSt=s=>({'Aberto':'#58a6ff','Em Andamento':'#d29922','Concluído':'#3fb950','Resolvido':'#3fb950','Fechado':'#3fb950','Cancelado':'#8b949e'}[s]||'#8b949e');
  const corPr=p=>({'Crítica':'#f85149','Alta':'#e3711a','Média':'#58a6ff','Baixa':'#8b949e'}[p]||'#8b949e');
  const cv1=document.getElementById('cv-ch-ov-status');
  if(cv1&&slSt.length)desenharDonutResponsivo(cv1,slSt.map(x=>x[0]),slSt.map(x=>x[1]),slSt.map(x=>corSt(x[0])));
  const leg1=document.getElementById('leg-ch-status');
  if(leg1)leg1.innerHTML=slSt.map(x=>`<span style="display:flex;align-items:center;gap:5px;font-size:10px"><span style="width:8px;height:8px;border-radius:2px;background:${corSt(x[0])};flex-shrink:0"></span><span style="color:var(--text-muted)">${x[0]}:</span><b style="font-family:var(--mono);color:var(--text)">${x[1]}</b></span>`).join('');
  const cv2=document.getElementById('cv-ch-ov-prio');
  if(cv2&&slPr.length)desenharDonutResponsivo(cv2,slPr.map(x=>x[0]),slPr.map(x=>x[1]),slPr.map(x=>corPr(x[0])));
  const leg2=document.getElementById('leg-ch-prio');
  if(leg2)leg2.innerHTML=slPr.map(x=>`<span style="display:flex;align-items:center;gap:5px;font-size:10px"><span style="width:8px;height:8px;border-radius:2px;background:${corPr(x[0])};flex-shrink:0"></span><span style="color:var(--text-muted)">${x[0]}:</span><b style="font-family:var(--mono);color:var(--text)">${x[1]}</b></span>`).join('');
  const cv3=document.getElementById('cv-ch-ov-cat');
  if(cv3&&topC.length){const pw=cv3.parentElement.clientWidth||400;cv3.width=pw;desenharBarrasH('cv-ch-ov-cat',topC.map(x=>x[0]),topC.map(x=>x[1]),['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7','#58a6ff','#f85149','#8b949e']);}
}

function abrirDetalheChamado(id){
  const {cham}=window._chamData||{};
  if(!cham)return;
  const c=cham.find(x=>x.id===id);
  if(!c)return;
  const conteudo=document.querySelector('#painel-expandido-global > div:last-child');
  if(!conteudo)return;
  const badgePrio=p=>{const m={'Alta':'badge-and','Crítica':'badge-susp','Média':'badge-plan','Baixa':'badge-conc'};return`<span class="badge-sm ${m[p]||'badge-plan'}">${p||'—'}</span>`;};
  const badgeSt=s=>{const m={'Aberto':'badge-and','Em Andamento':'badge-plan','Resolvido':'badge-conc','Fechado':'badge-conc','Concluído':'badge-conc','Cancelado':'badge-susp'};return`<span class="badge-sm ${m[s]||'badge-plan'}">${s||'—'}</span>`;};
  const dtFmt=s=>s?(s.slice(0,10).split('-').reverse().join('/')):'—';
  const hist=c.historico||c.comentarios||[];
  conteudo.innerHTML=`
  <div class="ob-ov-header">
    <div class="ob-ov-title">${c.id} — ${c.titulo||'Sem título'}</div>
    <button class="ob-ov-close" onclick="voltarParaDrillChamados()">← voltar</button>
  </div>
  <div class="ob-ov-kpis" style="margin-bottom:12px">
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Status</div><div class="ob-ov-kpi-val" style="margin-top:2px">${badgeSt(c.status)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Prioridade</div><div class="ob-ov-kpi-val" style="margin-top:2px">${badgePrio(c.prioridade)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Categoria</div><div class="ob-ov-kpi-val c-azul" style="font-size:13px">${c.categoria||'—'}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Local</div><div class="ob-ov-kpi-val c-azul" style="font-size:13px">${c.local||'—'}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Responsável</div><div class="ob-ov-kpi-val" style="font-size:13px;color:${c.responsavel||c.atendente?'var(--green)':'var(--red)'}">${c.responsavel||c.atendente||'⚠ sem resp.'}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Solicitante</div><div class="ob-ov-kpi-val" style="font-size:13px">${c.solicitante||'—'}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Abertura</div><div class="ob-ov-kpi-val c-azul" style="font-size:13px">${dtFmt(c.dtAbertura||c.dataAbertura||c.criadoEm)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Conclusão</div><div class="ob-ov-kpi-val c-verde" style="font-size:13px">${dtFmt(c.dtConclusao||c.dtFechamento||c.resolvidoEm)}</div></div>
  </div>
  ${c.descricao?`<div class="ob-ov-tbox" style="margin-bottom:12px"><div class="ob-ov-ctit" style="margin-bottom:6px">Descrição</div><div style="font-size:12px;color:var(--text-muted);line-height:1.6">${c.descricao}</div></div>`:''}
  ${hist.length?`<div class="ob-ov-tbox"><div class="ob-ov-ctit" style="margin-bottom:8px">Histórico (${hist.length})</div><table class="ob-ov-table"><thead><tr><th>Data</th><th>Ação / Observação</th><th>Responsável</th></tr></thead><tbody>${hist.map(h=>`<tr><td style="font-family:var(--mono);font-size:10px;color:var(--text-muted);white-space:nowrap">${dtFmt(h.data||h.dt||h.criadoEm)}</td><td style="font-size:11px">${h.acao||h.obs||h.texto||h.descricao||'—'}</td><td style="font-size:11px;color:var(--text-muted)">${h.responsavel||h.autor||'—'}</td></tr>`).join('')}</tbody></table></div>`:''}`;
}

function voltarParaChamados(){
  alternarModulo('chamados');
}

function voltarParaDrillChamados(){
  voltarParaChamados();
}
/* ══════════════════════════════════════════════
   CONTROLE DE ACESSO
══════════════════════════════════════════════ */
function renderAcesso(container,d){
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo de acesso carregado.<br><span style="font-size:10px">Selecione o arquivo no hub principal.</span></div>';return;}
  const pessoas=d.pessoas||[];
  const pontos=d.pontos||[];
  const total=pessoas.length;
  const ativos=pessoas.filter(p=>p.status==='Ativo'||!p.status).length;
  const inativos=total-ativos;
  const semPonto=pessoas.filter(p=>!p.ponto&&!p.pontoId).length;
  const perfilMap={};pessoas.forEach(p=>{const pf=p.perfil||p.cargo||'Operador';perfilMap[pf]=(perfilMap[pf]||0)+1;});
  const deptoMap={};pessoas.forEach(p=>{const dep=p.departamento||p.setor||'';if(dep)deptoMap[dep]=(deptoMap[dep]||0)+1;});
  const topDepto=Object.entries(deptoMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const pontoMap={};pessoas.forEach(p=>{const pt=p.ponto||p.pontoId||'';if(pt)pontoMap[pt]=(pontoMap[pt]||0)+1;});
  const topPonto=Object.entries(pontoMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const totalPontos=pontos.length||Object.keys(pontoMap).length;

  window._acessoData={pessoas,pontos,perfilMap,deptoMap,topDepto,pontoMap,topPonto,ativos,inativos,semPonto};
  window._acessoDrill=null;

  container.innerHTML=`<div class="mod-section">
    <div class="secao-titulo">Controle de Acesso</div>
    <div class="mod-cards-grid" id="acesso-grid">
      ${mkModCard('ac-total','TOTAL PESSOAS',total,'c-azul','#58a6ff',`${ativos} ativas`,
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Ativas</span><span class="ob-mini-val c-verde">${ativos}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Inativas</span><span class="ob-mini-val c-vermelho">${inativos}</span></div>`)}
      ${mkModCard('ac-sem','SEM PONTO',semPonto,semPonto>0?'c-amarelo':'c-verde','#d29922','ponto não atribuído',
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Com ponto</span><span class="ob-mini-val c-verde">${total-semPonto}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">% atribuído</span><span class="ob-mini-val c-azul">${total>0?Math.round((total-semPonto)/total*100):0}%</span></div>`)}
      ${mkModCard('ac-perfis','PERFIS DISTINTOS',Object.keys(perfilMap).length,'c-azul','#a371f7','níveis de acesso',
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Maior perfil</span><span class="ob-mini-val c-azul">${Object.entries(perfilMap).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Departamentos</span><span class="ob-mini-val c-azul">${Object.keys(deptoMap).length}</span></div>`)}
      ${mkModCard('ac-pontos','PONTOS CADASTR.',totalPontos,'c-azul','#58a6ff','leitores / portas',
        `<div class="ob-mini-stat"><span class="ob-mini-lbl">Mais usado</span><span class="ob-mini-val c-azul">${topPonto[0]?topPonto[0][0]:'—'}</span></div>
         <div class="ob-mini-stat"><span class="ob-mini-lbl">Pessoas/ponto</span><span class="ob-mini-val c-azul">${totalPontos>0?Math.round((total-semPonto)/totalPontos):0}</span></div>`)}
    </div>
  </div>`;

  setTimeout(()=>{
    drawModMiniCard('cv-mod-ac-total',['Ativos','Inativos'],[ativos,inativos],['#3fb950','#f85149']);
    const pl=Object.entries(perfilMap).sort((a,b)=>b[1]-a[1]);
    drawModMiniCard('cv-mod-ac-sem',pl.map(x=>x[0]),pl.map(x=>x[1]),['#2E5FA3','#a371f7','#e3711a','#d29922','#3fb950']);
    drawModMiniCard('cv-mod-ac-perfis',topDepto.map(x=>x[0]),topDepto.map(x=>x[1]),['#2E5FA3','#58a6ff','#3fb950','#d29922','#a371f7']);
    drawModMiniCard('cv-mod-ac-pontos',topPonto.map(x=>x[0]),topPonto.map(x=>x[1]),['#58a6ff','#2E5FA3','#3fb950','#e3711a','#a371f7']);
  },60);
}
function abrirDetalheObra(cod){
  if(!_obrasData)return;
  const o=(_obrasData.obras||[]).find(x=>x.cod===cod);
  if(!o)return;
  const b=budgObra(cod),r=realObra(cod),af=calcAvFis(o),pf=b>0?(r/b)*100:0,ef=af-pf;
  const lancsObra=(_obrasData.lancamentos||[]).filter(l=>l.obraCod===cod);
  const mensal={};lancsObra.forEach(l=>{const m=(l.dtLanc||'').slice(0,7);if(m)mensal[m]=(mensal[m]||0)+l.qtd*l.precoUnit;});
  const mKeys=Object.keys(mensal).sort().slice(-8);
  const catMap={};lancsObra.forEach(l=>{const c=l.categoria||'Outros';catMap[c]=(catMap[c]||0)+l.qtd*l.precoUnit;});
  const topCat=Object.entries(catMap).sort((a,b2)=>b2[1]-a[1]).slice(0,6);
  const etapas=o.etapas||[];
  const hoje=new Date();
  const fimRef=o.dtFimReal||null;
  const fimPrev=o.dtFimPrev||null;
  let prazo=null,prazoTxt='—',corP='var(--text-dim)';
  if(fimPrev){
    if(fimRef){
      // obra concluída — compara fim real vs fim previsto
      const dias=Math.floor((new Date(fimRef+'T00:00:00')-new Date(fimPrev+'T00:00:00'))/86400000);
      if(dias>0){prazoTxt=dias+'d atraso';corP='var(--red)';}
      else if(dias<0){prazoTxt=Math.abs(dias)+'d adiantado';corP='var(--green)';}
      else{prazoTxt='No prazo';corP='var(--green)';}
    } else {
      // obra em aberto — compara hoje vs fim previsto
      prazo=Math.floor((new Date(fimPrev+'T00:00:00')-hoje)/86400000);
      if(prazo<0){prazoTxt=Math.abs(prazo)+'d atraso';corP='var(--red)';}
      else if(prazo===0){prazoTxt='Vence hoje';corP='var(--yellow)';}
      else if(prazo<=30){prazoTxt=prazo+'d restantes';corP='var(--yellow)';}
      else{prazoTxt=prazo+'d restantes';corP='var(--green)';}
    }
  }
  const pb2=(v,c)=>`<div class="ob-mini-prog"><div class="ob-mbar"><div class="ob-mfill" style="width:${Math.min(v,100)}%;background:${c}"></div></div><span style="font-size:9px;font-family:var(--mono);color:var(--text-muted);min-width:34px">${fmt(v,1)}%</span></div>`;
  const badgeSt=s=>{const m={'Em Andamento':'badge-and','Concluído':'badge-conc','Planejado':'badge-plan','Suspenso':'badge-susp'};return`<span class="badge-sm ${m[s]||'badge-plan'}">${s}</span>`;};
  const conteudo=document.querySelector('#painel-expandido-global > div:last-child');
  if(!conteudo)return;

  conteudo.innerHTML=`
  <div class="ob-ov-header">
    <div class="ob-ov-title">${o.nome} — Detalhamento</div>
    <button class="ob-ov-close" onclick="voltarParaLista()">← voltar</button>
  </div>

  <div class="ob-ov-kpis" style="grid-template-columns:repeat(8,1fr);margin-bottom:14px">
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Budget</div><div class="ob-ov-kpi-val c-azul">${fmtRK(b)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Realizado</div><div class="ob-ov-kpi-val c-laranja">${fmtRK(r)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Orçado</div><div class="ob-ov-kpi-val ${b-r<0?'c-vermelho':'c-verde'}">${fmtRK(b-r)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Eficiência</div><div class="ob-ov-kpi-val ${ef>5?'c-verde':ef<-5?'c-vermelho':'c-amarelo'}">${ef>=0?'+':''}${fmt(ef,1)}%</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Status</div><div class="ob-ov-kpi-val" style="font-size:13px;margin-top:2px">${badgeSt(o.status)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Prazo</div><div class="ob-ov-kpi-val" style="font-size:14px;color:${corP}">${prazoTxt}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Avanço Físico</div><div class="ob-ov-kpi-val ${af>70?'c-verde':af>40?'c-amarelo':'c-laranja'}">${fmt(af,1)}%</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">% Financeiro</div><div class="ob-ov-kpi-val c-azul">${fmt(pf,1)}%</div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 260px;gap:10px;margin-bottom:14px">
  <div class="ob-ov-cbox">
    <div class="ob-ov-ctit">Gastos mensais</div>
    <canvas id="cv-det-spark" height="200" style="width:100%;height:200px;display:block"></canvas>
  </div>
  <div class="ob-ov-cbox">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div class="ob-ov-ctit">Por categoria</div>
      <button id="btn-edit-cat-vis" onclick="document.getElementById('edit-cat-vis-panel').style.display=document.getElementById('edit-cat-vis-panel').style.display==='none'?'block':'none'" style="font-size:9px;color:var(--text-muted);background:none;border:none;cursor:pointer;opacity:0.3" title="Configurar exibição">⚙</button>
    </div>
    <div id="edit-cat-vis-panel" style="display:none;font-size:11px;padding:6px 0;color:var(--text-muted)">Configuração de exibição em desenvolvimento</div>
    <canvas id="cv-det-cat" width="260" height="160" style="width:260px;height:160px;display:block"></canvas>
      <div id="leg-det-cat" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>
  </div>
</div>

  <div style="margin-bottom:12px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div class="ob-ov-ctit">Observações</div>
    </div>
    <textarea id="obs-det-obra" readonly rows="2" style="width:100%;font-size:12px;color:var(--text);line-height:1.6;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:var(--font);resize:none;box-sizing:border-box;outline:none;transition:border-color .15s;overflow:hidden">${o.observacao||o.obs||o.observacoes||''}</textarea>
  </div>

  ${lancsObra.length?`
  <div class="ob-ov-tbox">
    <div class="ob-ov-ctit" style="margin-bottom:8px">Lançamentos (${lancsObra.length})</div>
    <table class="ob-ov-table">
      <thead><tr><th>ID</th><th>CRESP</th><th>Categoria</th><th>Subcategoria</th><th>Descrição</th><th style="text-align:center">Unid</th><th style="text-align:right">Qtd</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th><th>Data</th></tr></thead>
      <tbody id="lanc-tbody-det"></tbody>
      <tfoot><tr><td colspan="8" style="font-weight:600;font-size:11px">TOTAL</td><td style="font-family:var(--mono);font-weight:700;text-align:right;color:var(--blue-light)">${fmtRK(lancsObra.reduce((s,l)=>s+l.qtd*l.precoUnit,0))}</td><td></td></tr></tfoot>
    </table>
    <div id="lanc-pag" style="display:flex;align-items:center;gap:4px;margin-top:10px;flex-wrap:wrap"></div>
  </div>`:'<div class="sem-dados">Sem lançamentos registrados</div>'}`;

  requestAnimationFrame(()=>{
    const cvspark=document.getElementById('cv-det-spark');
    if(cvspark){
      const pw=cvspark.parentElement.clientWidth||400;
      cvspark.width=pw;cvspark.height=160;
      if(mKeys.length>=2){
        desenharSparkComValores('cv-det-spark',mKeys.map(k=>k.slice(5)),mKeys.map(k=>mensal[k]),'#58a6ff');
      } else if(mKeys.length===1){
        const ctx=cvspark.getContext('2d');
        ctx.fillStyle='#2E5FA3';
        ctx.fillRect(20,20,pw-40,120);
        ctx.fillStyle='#8b949e';ctx.font='15px IBM Plex Mono,monospace';ctx.textAlign='center';
        ctx.fillText(mKeys[0].slice(5)+': '+fmtRK(mensal[mKeys[0]]),pw/2,100);
      } else {
        const ctx=cvspark.getContext('2d');
        ctx.fillStyle='#555e6a';ctx.font='15px IBM Plex Mono,monospace';ctx.textAlign='center';
        ctx.fillText('Sem dados mensais',pw/2,80);
      }
    }
    const cvcat=document.getElementById('cv-det-cat');
    const coresCat=['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7','#58a6ff','#39c5cf','#f85149'];
    if(cvcat&&topCat.length){
      desenharDonutResponsivo(cvcat,topCat.map(x=>x[0]),topCat.map(x=>x[1]),coresCat);
    }
    const legCat=document.getElementById('leg-det-cat');
    if(legCat)legCat.innerHTML=topCat.map((x,i)=>`<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted)"><span style="width:8px;height:8px;border-radius:2px;background:${coresCat[i%coresCat.length]};flex-shrink:0"></span>${x[0]}: <b style="color:var(--text);font-family:var(--mono)">${fmtRK(x[1])}</b></span>`).join('');

    const lancSorted=lancsObra.slice().sort((a,b2)=>(b2.dtLanc||'').localeCompare(a.dtLanc||''));
    const perPag=10;
    let pagAtual=1;
    function renderPagLanc(){
      const inicio=(pagAtual-1)*perPag;
      const pagina=lancSorted.slice(inicio,inicio+perPag);
      const tbody=document.getElementById('lanc-tbody-det');
      if(!tbody)return;
      tbody.innerHTML=pagina.map(l=>{const tot=l.qtd*l.precoUnit;return`<tr>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${l.id||'—'}</td>
        <td><span style="background:var(--blue-pale);color:var(--blue-mid);border-radius:4px;padding:1px 5px;font-family:var(--mono);font-size:10px">${l.cresp||'—'}</span></td>
        <td style="font-size:10px">${l.categoria||'—'}</td>
        <td style="font-size:10px;color:var(--text-muted)">${l.subcategoria||'—'}</td>
        <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.descricao||'—'}</td>
        <td style="font-family:var(--mono);font-size:10px;text-align:center">${l.unid||'—'}</td>
        <td style="font-family:var(--mono);font-size:10px;text-align:right">${fmt(l.qtd,2)}</td>
        <td style="font-family:var(--mono);font-size:10px;text-align:right">${fmtRK(l.precoUnit)}</td>
        <td style="font-family:var(--mono);font-size:11px;font-weight:600;text-align:right;color:var(--blue-light)">${fmtRK(tot)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${l.dtLanc?l.dtLanc.split('-').reverse().join('/'):'—'}</td>
      </tr>`;}).join('');
      const totalPags=Math.ceil(lancSorted.length/perPag);
      const pag=document.getElementById('lanc-pag');
      if(!pag)return;
      const btnStyle=(ativo)=>`cursor:pointer;padding:4px 10px;border-radius:5px;font-family:var(--mono);font-size:11px;border:1px solid ${ativo?'var(--blue-mid)':'var(--border)'};background:${ativo?'var(--blue-pale)':'var(--surface)'};color:${ativo?'var(--blue-mid)':'var(--text-muted)'}`;
      let html=`<button style="${btnStyle(false)}" onclick="window._lancPag(${pagAtual-1})" ${pagAtual===1?'disabled':''}>← ant</button>`;
      for(let i=1;i<=totalPags;i++){
        if(totalPags<=7||i===1||i===totalPags||Math.abs(i-pagAtual)<=1){
          html+=`<button style="${btnStyle(i===pagAtual)}" onclick="window._lancPag(${i})">${i}</button>`;
        } else if(Math.abs(i-pagAtual)===2){
          html+=`<span style="color:var(--text-muted);padding:0 2px">…</span>`;
        }
      }
      html+=`<button style="${btnStyle(false)}" onclick="window._lancPag(${pagAtual+1})" ${pagAtual===totalPags?'disabled':''}>próx →</button>`;
      html+=`<span style="font-size:10px;color:var(--text-muted);margin-left:6px">${inicio+1}–${Math.min(inicio+perPag,lancSorted.length)} de ${lancSorted.length}</span>`;
      pag.innerHTML=html;
    }
    window._lancPag=function(p){
      const total=Math.ceil(lancSorted.length/perPag);
      if(p<1||p>total)return;
      pagAtual=p;
      renderPagLanc();
    };
    renderPagLanc();
  });
}
function voltarParaSubCards(){
  alternarModulo('obras');
}
function voltarParaLista(){
  const conteudo=document.querySelector('#painel-expandido-global > div:last-child');
  if(!conteudo||!_obrasData)return;
  const tipo=_drillOb||'total';
  conteudo.innerHTML='';
  conteudo.style.cssText='flex:1;min-height:0';
  const overlay=document.createElement('div');
  overlay.className='ob-overlay';
  overlay.id='ob-overlay';
  overlay.innerHTML=buildOverlayHTML(tipo,_obrasData);
  conteudo.appendChild(overlay);
  setTimeout(()=>drawOverlayCharts(tipo,_obrasData),60);
}

function filtrarObraNoOverlay(cod){
  if(!_obrasData)return;
  const o=(_obrasData.obras||[]).find(x=>x.cod===cod);
  if(!o)return;
  const overlay=document.getElementById('ob-overlay');
  if(!overlay)return;
  const b=budgObra(cod),r=realObra(cod),af=calcAvFis(o),pf=b>0?(r/b)*100:0;
  const saldo=Math.max(b-r,0);
  const lancsObra=(_obrasData.lancamentos||[]).filter(l=>l.obraCod===cod);
  const catMap={};lancsObra.forEach(l=>{const c=l.categoria||'Outros';catMap[c]=(catMap[c]||0)+l.qtd*l.precoUnit;});
  const topCat=Object.entries(catMap).sort((a,b2)=>b2[1]-a[1]);
  const titulo=overlay.querySelector('.ob-ov-title');
  if(titulo)titulo.textContent=`${o.nome} — Análise`;
  const kpisEl=overlay.querySelector('.ob-ov-kpis');
  if(kpisEl)kpisEl.innerHTML=`
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Budget</div><div class="ob-ov-kpi-val c-azul">${fmtRK(b)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Realizado</div><div class="ob-ov-kpi-val c-laranja">${fmtRK(r)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Orçado</div><div class="ob-ov-kpi-val ${b-r<0?'c-vermelho':'c-verde'}">${fmtRK(b-r)}</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Avanço Físico</div><div class="ob-ov-kpi-val ${af>70?'c-verde':af>40?'c-amarelo':'c-laranja'}">${fmt(af,1)}%</div></div>
    <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">% Financeiro</div><div class="ob-ov-kpi-val c-azul">${fmt(pf,1)}%</div></div>
  `;
  const headerBtns=overlay.querySelector('.ob-ov-header-btns');
  if(headerBtns)headerBtns.innerHTML=`
    <button class="ob-ov-close" onclick="voltarParaListaGeral()">← voltar ao geral</button>
    <button class="ob-ov-close" style="margin-left:6px;background:#eef2fb;border-color:#3a6bc7;color:#243782" onclick="abrirDetalheObra('${cod}')">📋 extrato completo</button>
  `;
  requestAnimationFrame(()=>{
    const cv2=document.getElementById('cv-ov-pizza2');
    if(cv2)desenharMicroDonut('cv-ov-pizza2',['Gasto','Orçado'],[r||0,saldo||0],['#e3711a','#d0d8e8']);
    const cvb=document.getElementById('cv-ov-barras');
    if(cvb&&topCat.length)desenharBarrasH('cv-ov-barras',topCat.map(x=>x[0]),topCat.map(x=>x[1]),['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7']);
    const cv1=document.getElementById('cv-ov-pizza1');
    if(cv1){const tit=document.getElementById('cv-ov-pizza1-titulo');if(tit)tit.textContent='Avanço por Etapas';desenharBarrasH('cv-ov-pizza1',[o.nome.slice(0,20)],[af],['#3a6bc7']);}
  });
}
function voltarParaListaGeral(){
  voltarParaLista();
}
function toggleObCardGenerico(modulo, tipo){
  const card=document.getElementById('ob-card-'+tipo);
  if(card)card.click();
}
function mkModCard(id,label,val,valCls,accent,sub,statsHtml){
  return`<div class="ob-card" id="ob-card-${id}">
    <div class="ob-card-head">
      <div class="ob-card-accent" style="background:${accent}"></div>
      <div class="ob-card-label">${label}</div>
      <div class="ob-card-val ${valCls}">${val!==null&&val!==undefined?val:'—'}</div>
      <div class="ob-card-sub">${sub}</div>
    </div>
    <div class="ob-card-body">
      <div class="ob-chart-wrap"><canvas id="cv-mod-${id}"></canvas></div>
      ${statsHtml}
    </div>
  </div>`;
}

function drawModMiniCard(canvasId,labels,vals,cores){
  const cv=document.getElementById(canvasId);
  if(!cv)return;
  const pw=cv.parentElement.clientWidth||180;
  const ph=cv.parentElement.clientHeight||120;
  cv.width=pw;cv.height=ph;
  if(!labels.length||!vals.length)return;
  desenharDonutResponsivo(cv,labels,vals,cores);
}
function renderCapex(container,d){
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo CAPEX carregado.</div>';return;}
  const obras=d.obras||[];
  const budget=d.budget||[];
  const lanc=d.lancamentos||[];
  const budgTotal=budget.reduce((s,b)=>s+(b.budgetAprov||0),0);
  const real=lanc.reduce((s,l)=>s+l.qtd*l.precoUnit,0);
  const Orçado=budgTotal-real;
  const pct=budgTotal>0?Math.round(real/budgTotal*100):0;
  const emAnd=obras.filter(o=>o.status==='Em Andamento');
  const conc=obras.filter(o=>o.status==='Concluído');
  const plan=obras.filter(o=>o.status==='Planejado');
  const budgCx=cod=>budget.filter(b=>b.obraCod===cod).reduce((s,b)=>s+(b.budgetAprov||0),0);
const realCx=cod=>lanc.filter(l=>l.obraCod===cod).reduce((s,l)=>s+l.qtd*l.precoUnit,0);
const OrçadoCx=cod=>budgCx(cod)-realCx(cod);
  const catMap={};lanc.forEach(l=>{const c=l.categoria||'Outros';catMap[c]=(catMap[c]||0)+l.qtd*l.precoUnit;});
  const topCat=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  container.innerHTML=`<div class="obras-section"><div class="secao-titulo">CAPEX</div><div class="obras-cards-grid" id="capex-grid">
    ${mkCard('cx-budget','BUDGET TOTAL',fmtRK(budgTotal),'c-azul','#2E5FA3',pct+'% realizado',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Realizado</span><span class="ob-mini-val c-laranja">${fmtRK(real)}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Orçado</span><span class="ob-mini-val ${Orçado<0?'c-vermelho':'c-verde'}">${fmtRK(Orçado)}</span></div>`)}
    ${mkCard('cx-andamento','EM ANDAMENTO',emAnd.length,'c-laranja','#e3711a',fmtRK(emAnd.reduce((s,o)=>s+budgObra(o.cod),0))+' budget',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Realizado</span><span class="ob-mini-val c-laranja">${fmtRK(emAnd.reduce((s,o)=>s+realObra(o.cod),0))}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Orçado</span><span class="ob-mini-val c-verde">${fmtRK(emAnd.reduce((s,o)=>s+OrçadoObra(o.cod),0))}</span></div>`)}
    ${mkCard('cx-conc','CONCLUÍDAS',conc.length,'c-verde','#3fb950',fmtRK(conc.reduce((s,o)=>s+realObra(o.cod),0))+' gasto',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">% do total</span><span class="ob-mini-val c-verde">${obras.length>0?Math.round(conc.length/obras.length*100):0}%</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Obras</span><span class="ob-mini-val c-verde">${conc.length}</span></div>`)}
    ${mkCard('cx-cat','POR CATEGORIA',topCat.length,'c-azul','#a371f7',topCat[0]?topCat[0][0]+': '+fmtRK(topCat[0][1]):'—',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Top categoria</span><span class="ob-mini-val c-azul">${topCat[0]?topCat[0][0]:'—'}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Categorias</span><span class="ob-mini-val c-azul">${Object.keys(catMap).length}</span></div>`)}
  </div></div>`;
  setTimeout(()=>{
    const sm={};obras.forEach(o=>{sm[o.status]=(sm[o.status]||0)+1;});
    const sl=Object.entries(sm).filter(x=>x[1]);
    desenharDonutNaCanvas('cv-mini-cx-budget',sl.map(x=>x[0]),sl.map(x=>x[1]),['#e3711a','#3fb950','#2E5FA3','#f85149']);
    desenharDonutNaCanvas('cv-mini-cx-andamento',emAnd.map(o=>tnome(o.nome)),emAnd.map(o=>Math.max(budgObra(o.cod),1)),['#e3711a','#d29922','#2E5FA3','#a371f7']);
    desenharDonutNaCanvas('cv-mini-cx-conc',['Realizado','Budget restante'],[real||1,Math.max(budgTotal-real,0)||1],['#3fb950','#2E5FA3']);
    desenharDonutNaCanvas('cv-mini-cx-cat',topCat.map(x=>x[0]),topCat.map(x=>x[1]),['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7']);
  },60);
}

function renderCodin(container,d){
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo CODIN carregado.</div>';return;}
  const pessoas=d.pessoas||[];
  const pontos=d.pontos||[];
  const total=pessoas.length;
  const ativos=pessoas.filter(p=>p.status==='Ativo'||!p.status).length;
  const inativos=total-ativos;
  const semPonto=pessoas.filter(p=>!p.ponto&&!p.pontoId).length;
  const perfilMap={};pessoas.forEach(p=>{const pf=p.perfil||p.cargo||'Operador';perfilMap[pf]=(perfilMap[pf]||0)+1;});
  const deptoMap={};pessoas.forEach(p=>{const dep=p.departamento||p.setor||'';if(dep)deptoMap[dep]=(deptoMap[dep]||0)+1;});
  const totalPontos=pontos.length||Object.keys({...pessoas.reduce((m,p)=>{if(p.ponto||p.pontoId)m[p.ponto||p.pontoId]=1;return m;},{})}).length;
  container.innerHTML=`<div class="obras-section"><div class="secao-titulo">CODIN — Controle de Acesso</div><div class="obras-cards-grid" id="codin-grid">
    ${mkCard('cd-total','TOTAL PESSOAS',total,'c-azul','#2E5FA3',ativos+' ativas',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Ativas</span><span class="ob-mini-val c-verde">${ativos}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Inativas</span><span class="ob-mini-val c-vermelho">${inativos}</span></div>`)}
    ${mkCard('cd-ponto','SEM PONTO',semPonto,semPonto>0?'c-amarelo':'c-verde','#d29922','ponto não atribuído',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Com ponto</span><span class="ob-mini-val c-verde">${total-semPonto}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">% atribuído</span><span class="ob-mini-val c-azul">${total>0?Math.round((total-semPonto)/total*100):0}%</span></div>`)}
    ${mkCard('cd-perfis','PERFIS',Object.keys(perfilMap).length,'c-azul','#a371f7','níveis de acesso',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Maior perfil</span><span class="ob-mini-val c-azul">${Object.entries(perfilMap).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Departamentos</span><span class="ob-mini-val c-azul">${Object.keys(deptoMap).length}</span></div>`)}
    ${mkCard('cd-pontos','PONTOS CADASTR.',totalPontos,'c-azul','#58a6ff','leitores / portas',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Pessoas/ponto</span><span class="ob-mini-val c-azul">${totalPontos>0?Math.round((total-semPonto)/totalPontos):0}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Sem ponto</span><span class="ob-mini-val c-amarelo">${semPonto}</span></div>`)}
  </div></div>`;
  setTimeout(()=>{
    desenharDonutNaCanvas('cv-mini-cd-total',['Ativos','Inativos'],[ativos||1,inativos||1],['#3fb950','#f85149']);
    desenharDonutNaCanvas('cv-mini-cd-ponto',['Com ponto','Sem ponto'],[total-semPonto||1,semPonto||1],['#2E5FA3','#d29922']);
    const pl=Object.entries(perfilMap).sort((a,b)=>b[1]-a[1]);
    desenharDonutNaCanvas('cv-mini-cd-perfis',pl.map(x=>x[0]),pl.map(x=>x[1]),['#2E5FA3','#a371f7','#e3711a','#d29922','#3fb950']);
    const topDep=Object.entries(deptoMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    desenharDonutNaCanvas('cv-mini-cd-pontos',topDep.map(x=>x[0]),topDep.map(x=>x[1]),['#58a6ff','#2E5FA3','#3fb950','#d29922','#a371f7']);
  },60);
}


function renderConforto(container,d){
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo de Conforto carregado.</div>';return;}
  const ordens=d.ordens||[];
  const ucs=d.ucs||[];
  const preventivas=d.preventivas||[];
  const manutencoes=d.manutencoes||[];
  const areas=d.areas||[];
  const hoje=new Date().toISOString().slice(0,10);
  const ordensAbertas=ordens.filter(o=>o.status==='Programada'||o.status==='Em Execução').length;
  const ordensConcluidas=ordens.filter(o=>o.status==='Concluída').length;
  const prevAtrasadas=preventivas.filter(p=>p.status!=='Realizada'&&p.dataPrevista&&p.dataPrevista<hoje).length;
  const manAbertas=manutencoes.filter(m=>m.status==='Aberta'||m.status==='Em Andamento').length;
  const total=ordens.length||1;
  const conform=ordensConcluidas;
  const nconf=ordens.filter(o=>o.status==='Cancelada').length;
  const tempMedia=0;
  container.innerHTML=`<div class="obras-section"><div class="secao-titulo">Conforto</div><div class="obras-cards-grid" id="conforto-grid">
    ${mkCard('cf-total','ORDENS DE SERVIÇO',ordens.length,'c-azul','#2E5FA3',ordensAbertas+' em aberto',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Concluídas</span><span class="ob-mini-val c-verde">${ordensConcluidas}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Canceladas</span><span class="ob-mini-val c-vermelho">${nconf}</span></div>`)}
    ${mkCard('cf-conf','CLIMATIZAÇÃO',ucs.length,'c-azul','#3fb950',manAbertas+' manutenções abertas',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Prev. atrasadas</span><span class="ob-mini-val ${prevAtrasadas>0?'c-vermelho':'c-verde'}">${prevAtrasadas}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Preventivas</span><span class="ob-mini-val c-azul">${preventivas.length}</span></div>`)}
    ${mkCard('cf-temp','PREVENTIVAS',preventivas.length,prevAtrasadas>0?'c-vermelho':'c-verde','#e3711a',prevAtrasadas+' atrasadas',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Realizadas</span><span class="ob-mini-val c-verde">${preventivas.filter(p=>p.status==='Realizada').length}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Programadas</span><span class="ob-mini-val c-azul">${preventivas.filter(p=>p.status==='Programada').length}</span></div>`)}
    ${mkCard('cf-areas','ÁREAS ATENDIDAS',areas.length,'c-azul','#a371f7',ucs.length+' UCs cadastradas',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Man. abertas</span><span class="ob-mini-val ${manAbertas>0?'c-laranja':'c-verde'}">${manAbertas}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Manutenções</span><span class="ob-mini-val c-azul">${manutencoes.length}</span></div>`)}
  </div></div>`;
  setTimeout(()=>{
    const smOrd={};ordens.forEach(o=>{smOrd[o.tipo||'civil']=(smOrd[o.tipo||'civil']||0)+1;});
    const slOrd=Object.entries(smOrd).filter(x=>x[1]);
    desenharDonutNaCanvas('cv-mini-cf-total',slOrd.map(x=>x[0]),slOrd.map(x=>x[1]),['#3fb950','#e3711a','#2E5FA3']);
    desenharDonutNaCanvas('cv-mini-cf-conf',['UCs OK','Man. abertas','Prev. atrasadas'],[Math.max(ucs.length-manAbertas,0)||1,manAbertas||1,prevAtrasadas||1],['#3fb950','#e3711a','#f85149']);
    desenharDonutNaCanvas('cv-mini-cf-temp',['Realizadas','Programadas','Atrasadas'],[preventivas.filter(p=>p.status==='Realizada').length||1,preventivas.filter(p=>p.status==='Programada').length||1,prevAtrasadas||1],['#3fb950','#58a6ff','#f85149']);
    const catMap={};areas.forEach(a=>{const t=a.tipo||'Outros';catMap[t]=(catMap[t]||0)+1;});
    const topA=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(topA.length)desenharDonutNaCanvas('cv-mini-cf-areas',topA.map(x=>x[0]),topA.map(x=>x[1]),['#2E5FA3','#58a6ff','#3fb950','#d29922','#a371f7']);
    document.querySelectorAll('#conforto-grid .ob-card').forEach(card=>{
      card.style.cursor='pointer';
    });
  },120);
}

function abrirDrillConforto(tipo,d){
  const conteudo=document.querySelector('#painel-expandido-global > div:last-child');
  if(!conteudo||!d)return;
  _confortoDrillAtivo=tipo;
  const overlay=document.createElement('div');
  overlay.className='ob-overlay';
  overlay.id='cnf-overlay';
  overlay.innerHTML=buildDrillConforto(tipo,d);
  conteudo.innerHTML='';
  conteudo.style.cssText='flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
  conteudo.appendChild(overlay);
  setTimeout(()=>drawDrillConfortoCharts(tipo,d),80);
}

function buildDrillConforto(tipo,d){
  const ordens=d.ordens||[];
  const ucs=d.ucs||[];
  const preventivas=d.preventivas||[];
  const manutencoes=d.manutencoes||[];
  const areas=d.areas||[];
  const pecas=d.pecas||[];
  const hoje=new Date().toISOString().slice(0,10);

  const titulos={
    'cf-total':'Ordens de Serviço',
    'cf-conf':'Climatização — UCs',
    'cf-temp':'Preventivas',
    'cf-areas':'Áreas Atendidas'
  };

  const badgeSt=s=>{
    const m={'Programada':'badge-plan','Em Execução':'badge-and','Concluída':'badge-conc','Cancelada':'badge-susp','Realizada':'badge-conc','Atrasada':'badge-susp','Aberta':'badge-and','Em Andamento':'badge-and','Aguardando Peça':'badge-susp'};
    return`<span class="badge-sm ${m[s]||'badge-plan'}">${s||'—'}</span>`;
  };
  const dtFmt=s=>s?(s.slice(0,10).split('-').reverse().join('/')):' — ';

  let kpisHTML='', tabelaHTML='', titulo=titulos[tipo]||'Conforto';

  if(tipo==='cf-total'){
    const abertas=ordens.filter(o=>o.status==='Programada'||o.status==='Em Execução').length;
    const conc=ordens.filter(o=>o.status==='Concluída').length;
    const pct=ordens.length>0?Math.round(conc/ordens.length*100):0;
    kpisHTML=`
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Total OS</div><div class="ob-ov-kpi-val c-azul">${ordens.length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Em Aberto</div><div class="ob-ov-kpi-val ${abertas>0?'c-laranja':'c-verde'}">${abertas}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Concluídas</div><div class="ob-ov-kpi-val c-verde">${conc}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">% Conclusão</div><div class="ob-ov-kpi-val ${pct>70?'c-verde':pct>40?'c-amarelo':'c-vermelho'}">${pct}%</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Limpeza Civil</div><div class="ob-ov-kpi-val c-azul">${ordens.filter(o=>o.tipo==='civil'||o.tipo==='Limpeza Civil').length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Limpeza Técnica</div><div class="ob-ov-kpi-val c-azul">${ordens.filter(o=>o.tipo==='tecnica'||o.tipo==='Limpeza Técnica').length}</div></div>`;
    const linhas=ordens.slice().sort((a,b)=>{
      const ord={'Programada':0,'Em Execução':1,'Concluída':2,'Cancelada':3};
      return (ord[a.status]??9)-(ord[b.status]??9);
    }).map(o=>{
      const area=areas.find(a=>a.id===o.areaId);
      return`<tr>
        <td style="font-family:var(--mono);font-size:10px;color:var(--blue-light)">${o.id||'—'}</td>
        <td style="font-size:11px">${area?.nome||o.areaId||'—'}</td>
        <td style="font-size:11px;color:var(--text-muted)">${o.tipo||'—'}</td>
        <td>${badgeSt(o.status)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${dtFmt(o.dataPrevista)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--green)">${dtFmt(o.dataRealizada)}</td>
        <td style="font-size:11px;color:var(--text-muted)">${o.responsavelId||'—'}</td>
      </tr>`;
    }).join('');
    tabelaHTML=`<table class="ob-ov-table"><thead><tr><th>OS#</th><th>Área</th><th>Tipo</th><th>Status</th><th>Prevista</th><th>Realizada</th><th>Responsável</th></tr></thead><tbody>${linhas||'<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:16px">Nenhuma OS</td></tr>'}</tbody></table>`;
  }

  else if(tipo==='cf-conf'){
    const manAbertas=manutencoes.filter(m=>m.status==='Aberta'||m.status==='Em Andamento').length;
    const prevAtrasadas=preventivas.filter(p=>p.status!=='Realizada'&&p.dataPrevista&&p.dataPrevista<hoje).length;
    kpisHTML=`
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Total UCs</div><div class="ob-ov-kpi-val c-azul">${ucs.length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Manutenções Abertas</div><div class="ob-ov-kpi-val ${manAbertas>0?'c-vermelho':'c-verde'}">${manAbertas}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Prev. Atrasadas</div><div class="ob-ov-kpi-val ${prevAtrasadas>0?'c-vermelho':'c-verde'}">${prevAtrasadas}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Ar-Condicionado</div><div class="ob-ov-kpi-val c-azul">${ucs.filter(u=>(u.categoria||'Ar-Condicionado')==='Ar-Condicionado').length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Bebedouros</div><div class="ob-ov-kpi-val c-azul">${ucs.filter(u=>u.categoria==='Bebedouro').length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Climatizadores</div><div class="ob-ov-kpi-val c-azul">${ucs.filter(u=>u.categoria==='Climatizador').length}</div></div>`;
    const linhas=ucs.map(u=>{
      const prevUC=preventivas.filter(p=>p.ucId===u.id);
      const manUC=manutencoes.filter(m=>m.ucId===u.id&&(m.status==='Aberta'||m.status==='Em Andamento'));
      const proxPrev=prevUC.filter(p=>p.status!=='Realizada').sort((a,b)=>a.dataPrevista?.localeCompare(b.dataPrevista||''))[0];
      const atrasada=proxPrev&&proxPrev.dataPrevista<hoje;
      return`<tr>
        <td style="font-family:var(--mono);font-size:10px;color:var(--blue-light)">${u.codigo||u.id}</td>
        <td style="font-size:11px;font-weight:500">${u.nome||'—'}</td>
        <td style="font-size:11px;color:var(--text-muted)">${u.local||'—'}</td>
        <td style="font-size:10px;color:var(--text-muted)">${u.categoria||'Ar-Condicionado'}</td>
        <td style="font-family:var(--mono);font-size:10px;color:${atrasada?'var(--red)':'var(--text-muted)'}">${dtFmt(proxPrev?.dataPrevista)||'—'}</td>
        <td style="font-size:11px;color:${manUC.length>0?'var(--red)':'var(--green)'}">${manUC.length>0?manUC.length+' aberta(s)':'OK'}</td>
      </tr>`;
    }).join('');
    tabelaHTML=`<table class="ob-ov-table"><thead><tr><th>Código</th><th>Nome</th><th>Local</th><th>Categoria</th><th>Próx. Prev.</th><th>Manutenção</th></tr></thead><tbody>${linhas||'<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:16px">Nenhuma UC</td></tr>'}</tbody></table>`;
  }

  else if(tipo==='cf-temp'){
    const realizadas=preventivas.filter(p=>p.status==='Realizada').length;
    const programadas=preventivas.filter(p=>p.status==='Programada').length;
    const atrasadas=preventivas.filter(p=>p.status!=='Realizada'&&p.dataPrevista&&p.dataPrevista<hoje).length;
    kpisHTML=`
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Total</div><div class="ob-ov-kpi-val c-azul">${preventivas.length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Realizadas</div><div class="ob-ov-kpi-val c-verde">${realizadas}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Programadas</div><div class="ob-ov-kpi-val c-azul">${programadas}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Atrasadas</div><div class="ob-ov-kpi-val ${atrasadas>0?'c-vermelho':'c-verde'}">${atrasadas}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">% Realizado</div><div class="ob-ov-kpi-val ${realizadas/Math.max(preventivas.length,1)>0.7?'c-verde':'c-amarelo'}">${preventivas.length>0?Math.round(realizadas/preventivas.length*100):0}%</div></div>`;
    const linhas=preventivas.slice().sort((a,b)=>(a.dataPrevista||'').localeCompare(b.dataPrevista||'')).map(p=>{
      const uc=ucs.find(u=>u.id===p.ucId);
      const atrasada=p.status!=='Realizada'&&p.dataPrevista&&p.dataPrevista<hoje;
      const itensOk=p.checklist?p.checklist.filter(c=>c.concluido).length:0;
      const itensTotal=p.checklist?p.checklist.length:0;
      return`<tr>
        <td style="font-family:var(--mono);font-size:10px;color:var(--blue-light)">${p.id||'—'}</td>
        <td style="font-size:11px">${uc?.nome||p.ucId||'—'}</td>
        <td style="font-size:11px;color:var(--text-muted)">${p.tecnicoId||'—'}</td>
        <td style="font-family:var(--mono);font-size:10px;color:${atrasada?'var(--red)':'var(--text-muted)'}">${dtFmt(p.dataPrevista)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--green)">${dtFmt(p.dataRealizada)}</td>
        <td>${badgeSt(p.status)}</td>
        <td style="font-family:var(--mono);font-size:10px">${itensTotal>0?itensOk+'/'+itensTotal:'—'}</td>
      </tr>`;
    }).join('');
    tabelaHTML=`<table class="ob-ov-table"><thead><tr><th>PREV#</th><th>UC</th><th>Técnico</th><th>Prevista</th><th>Realizada</th><th>Status</th><th>Checklist</th></tr></thead><tbody>${linhas||'<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:16px">Nenhuma preventiva</td></tr>'}</tbody></table>`;
  }

  else if(tipo==='cf-areas'){
    const manAbertas=manutencoes.filter(m=>m.status==='Aberta'||m.status==='Em Andamento').length;
    kpisHTML=`
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Total Áreas</div><div class="ob-ov-kpi-val c-azul">${areas.length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">UCs Cadastradas</div><div class="ob-ov-kpi-val c-azul">${ucs.length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Manutenções Abertas</div><div class="ob-ov-kpi-val ${manAbertas>0?'c-vermelho':'c-verde'}">${manAbertas}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Peças Cadastradas</div><div class="ob-ov-kpi-val c-azul">${pecas.length}</div></div>
      <div class="ob-ov-kpi"><div class="ob-ov-kpi-lbl">Peças Abaixo Min.</div><div class="ob-ov-kpi-val ${pecas.filter(p=>p.estqAtual<=p.estqMinimo).length>0?'c-vermelho':'c-verde'}">${pecas.filter(p=>p.estqAtual<=p.estqMinimo).length}</div></div>`;
    const linhasMat=manutencoes.slice().sort((a,b)=>{
      const ord={'Aberta':0,'Em Andamento':1,'Aguardando Peça':2,'Concluída':3};
      return (ord[a.status]??9)-(ord[b.status]??9);
    }).map(m=>{
      const uc=ucs.find(u=>u.id===m.ucId);
      return`<tr>
        <td style="font-family:var(--mono);font-size:10px;color:var(--blue-light)">${m.id||'—'}</td>
        <td style="font-size:11px">${uc?.nome||m.ucId||'—'}</td>
        <td style="font-size:11px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.falha||'—'}</td>
        <td>${badgeSt(m.status)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text-muted)">${dtFmt(m.dataAbertura)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--green)">${dtFmt(m.dataFechamento)}</td>
      </tr>`;
    }).join('');
    tabelaHTML=`<table class="ob-ov-table"><thead><tr><th>MAN#</th><th>UC</th><th>Falha</th><th>Status</th><th>Abertura</th><th>Fechamento</th></tr></thead><tbody>${linhasMat||'<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:16px">Nenhuma manutenção</td></tr>'}</tbody></table>`;
  }

  return`
  <div class="ob-ov-header">
    <div class="ob-ov-title">${titulo}</div>
    <button class="ob-ov-close" onclick="voltarParaConforto()">← voltar</button>
  </div>
  <div class="ob-ov-kpis">${kpisHTML}</div>
  <div class="ob-ov-charts">
    <div class="ob-ov-cbox"><div class="ob-ov-ctit">Distribuição</div><canvas id="cv-cnf-ov-1" width="190" height="140" style="width:190px;height:140px;display:block"></canvas></div>
    <div class="ob-ov-cbox"><div class="ob-ov-ctit">Por Tipo</div><canvas id="cv-cnf-ov-2" width="190" height="140" style="width:190px;height:140px;display:block"></canvas></div>
    <div class="ob-ov-cbox" style="flex:1"><div class="ob-ov-ctit">Detalhamento</div><canvas id="cv-cnf-ov-3" width="400" height="140" style="width:100%;height:140px;display:block"></canvas></div>
  </div>
  <div class="ob-ov-tbox">
    <div class="ob-ov-ctit" style="margin-bottom:8px">Registros</div>
    ${tabelaHTML}
  </div>`;
}

function drawDrillConfortoCharts(tipo,d){
  const ordens=d.ordens||[];
  const ucs=d.ucs||[];
  const preventivas=d.preventivas||[];
  const manutencoes=d.manutencoes||[];
  const areas=d.areas||[];
  const hoje=new Date().toISOString().slice(0,10);

  if(tipo==='cf-total'){
    const sm={};ordens.forEach(o=>{sm[o.status||'Programada']=(sm[o.status||'Programada']||0)+1;});
    const sl=Object.entries(sm).filter(x=>x[1]);
    const cv1=document.getElementById('cv-cnf-ov-1');
    if(cv1&&sl.length)desenharDonutResponsivo(cv1,sl.map(x=>x[0]),sl.map(x=>x[1]),['#3fb950','#e3711a','#2E5FA3','#f85149']);
    const tm={};ordens.forEach(o=>{const t=o.tipo||'civil';tm[t]=(tm[t]||0)+1;});
    const tl=Object.entries(tm).filter(x=>x[1]);
    const cv2=document.getElementById('cv-cnf-ov-2');
    if(cv2&&tl.length)desenharDonutResponsivo(cv2,tl.map(x=>x[0]),tl.map(x=>x[1]),['#2E5FA3','#e3711a','#a371f7']);
    const rm={};ordens.forEach(o=>{if(o.responsavelId)rm[o.responsavelId]=(rm[o.responsavelId]||0)+1;});
    const rl=Object.entries(rm).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const cv3=document.getElementById('cv-cnf-ov-3');
    if(cv3&&rl.length){const pw=cv3.parentElement.clientWidth||400;cv3.width=pw;desenharBarrasH('cv-cnf-ov-3',rl.map(x=>x[0]),rl.map(x=>x[1]),['#2E5FA3','#e3711a','#3fb950','#d29922','#a371f7','#f85149']);}
  }
  else if(tipo==='cf-conf'){
    const cm={};ucs.forEach(u=>{const c=u.categoria||'Ar-Condicionado';cm[c]=(cm[c]||0)+1;});
    const cl=Object.entries(cm).filter(x=>x[1]);
    const cv1=document.getElementById('cv-cnf-ov-1');
    if(cv1&&cl.length)desenharDonutResponsivo(cv1,cl.map(x=>x[0]),cl.map(x=>x[1]),['#2E5FA3','#3fb950','#e3711a','#a371f7']);
    const manAb=manutencoes.filter(m=>m.status==='Aberta'||m.status==='Em Andamento');
    const ucMan={};manAb.forEach(m=>{const uc=ucs.find(u=>u.id===m.ucId);const n=uc?.nome||m.ucId||'?';ucMan[n]=(ucMan[n]||0)+1;});
    const ml=Object.entries(ucMan).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const cv2=document.getElementById('cv-cnf-ov-2');
    if(cv2&&ml.length)desenharDonutResponsivo(cv2,ml.map(x=>x[0]),ml.map(x=>x[1]),['#f85149','#e3711a','#d29922','#2E5FA3','#a371f7']);
    const lm={};ucs.forEach(u=>{const l=u.local||'Sem local';lm[l]=(lm[l]||0)+1;});
    const ll=Object.entries(lm).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const cv3=document.getElementById('cv-cnf-ov-3');
    if(cv3&&ll.length){const pw=cv3.parentElement.clientWidth||400;cv3.width=pw;desenharBarrasH('cv-cnf-ov-3',ll.map(x=>x[0]),ll.map(x=>x[1]),['#2E5FA3','#3fb950','#e3711a','#d29922','#a371f7','#58a6ff']);}
  }
  else if(tipo==='cf-temp'){
    const sm={'Realizada':preventivas.filter(p=>p.status==='Realizada').length,'Programada':preventivas.filter(p=>p.status==='Programada').length,'Atrasada':preventivas.filter(p=>p.status!=='Realizada'&&p.dataPrevista&&p.dataPrevista<hoje).length};
    const sl=Object.entries(sm).filter(x=>x[1]);
    const cv1=document.getElementById('cv-cnf-ov-1');
    if(cv1&&sl.length)desenharDonutResponsivo(cv1,sl.map(x=>x[0]),sl.map(x=>x[1]),['#3fb950','#2E5FA3','#f85149']);
    const mensal={};preventivas.forEach(p=>{const m=(p.dataPrevista||'').slice(0,7);if(m)mensal[m]=(mensal[m]||0)+1;});
    const mKeys=Object.keys(mensal).sort().slice(-6);
    const cv2=document.getElementById('cv-cnf-ov-2');
    if(cv2&&mKeys.length)desenharDonutResponsivo(cv2,mKeys.map(k=>k.slice(5)),mKeys.map(k=>mensal[k]),['#2E5FA3','#3fb950','#e3711a','#d29922','#a371f7','#58a6ff']);
    const ucPrev={};preventivas.forEach(p=>{const uc=ucs.find(u=>u.id===p.ucId);const n=uc?.nome||p.ucId||'?';ucPrev[n]=(ucPrev[n]||0)+1;});
    const ul=Object.entries(ucPrev).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const cv3=document.getElementById('cv-cnf-ov-3');
    if(cv3&&ul.length){const pw=cv3.parentElement.clientWidth||400;cv3.width=pw;desenharBarrasH('cv-cnf-ov-3',ul.map(x=>x[0]),ul.map(x=>x[1]),['#2E5FA3','#3fb950','#e3711a','#d29922','#a371f7','#58a6ff']);}
  }
  else if(tipo==='cf-areas'){
    const sm={};manutencoes.forEach(m=>{sm[m.status||'Aberta']=(sm[m.status||'Aberta']||0)+1;});
    const sl=Object.entries(sm).filter(x=>x[1]);
    const cv1=document.getElementById('cv-cnf-ov-1');
    if(cv1&&sl.length)desenharDonutResponsivo(cv1,sl.map(x=>x[0]),sl.map(x=>x[1]),['#f85149','#e3711a','#3fb950','#d29922']);
    const am={};areas.forEach(a=>{const t=a.tipo||'Outros';am[t]=(am[t]||0)+1;});
    const al=Object.entries(am).filter(x=>x[1]);
    const cv2=document.getElementById('cv-cnf-ov-2');
    if(cv2&&al.length)desenharDonutResponsivo(cv2,al.map(x=>x[0]),al.map(x=>x[1]),['#2E5FA3','#3fb950','#e3711a','#d29922','#a371f7']);
    const pm={};manutencoes.forEach(m=>{const uc=ucs.find(u=>u.id===m.ucId);const n=uc?.nome||m.ucId||'?';pm[n]=(pm[n]||0)+1;});
    const pl=Object.entries(pm).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const cv3=document.getElementById('cv-cnf-ov-3');
    if(cv3&&pl.length){const pw=cv3.parentElement.clientWidth||400;cv3.width=pw;desenharBarrasH('cv-cnf-ov-3',pl.map(x=>x[0]),pl.map(x=>x[1]),['#f85149','#e3711a','#d29922','#2E5FA3','#a371f7','#3fb950']);}
  }
}

function voltarParaConforto(){
  alternarModulo('conforto');
}

function renderErgonomia(container,d){
  if(!d){container.innerHTML='<div class="sem-dados">Nenhum arquivo de Ergonomia carregado.</div>';return;}
  const avaliacoes=d.avaliacoes||[];
  const total=avaliacoes.length;
  const ok=avaliacoes.filter(a=>a.resultado==='OK'||a.status==='Aprovado').length;
  const nok=avaliacoes.filter(a=>a.resultado==='NOK'||a.status==='Reprovado').length;
  const pendentes=total-ok-nok;
  const postos=new Set(avaliacoes.map(a=>a.posto||a.local||'')).size;
  container.innerHTML=`<div class="obras-section"><div class="secao-titulo">Ergonomia</div><div class="obras-cards-grid" id="ergonomia-grid">
    ${mkCard('eg-total','AVALIAÇÕES',total,'c-azul','#2E5FA3',postos+' postos avaliados',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Aprovadas</span><span class="ob-mini-val c-verde">${ok}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Reprovadas</span><span class="ob-mini-val c-vermelho">${nok}</span></div>`)}
    ${mkCard('eg-ok','APROVADAS',ok,'c-verde','#3fb950',total>0?Math.round(ok/total*100)+'% do total':'—',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Taxa aprovação</span><span class="ob-mini-val c-verde">${total>0?Math.round(ok/total*100):0}%</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Postos OK</span><span class="ob-mini-val c-verde">${ok}</span></div>`)}
    ${mkCard('eg-nok','REPROVADAS',nok,nok>0?'c-vermelho':'c-verde','#f85149',nok>0?'ação necessária':'dentro do padrão',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Pendentes</span><span class="ob-mini-val c-amarelo">${pendentes}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Críticas</span><span class="ob-mini-val c-vermelho">${avaliacoes.filter(a=>a.criticidade==='Alta'||a.risco==='Alto').length}</span></div>`)}
    ${mkCard('eg-postos','POSTOS',postos||'—','c-azul','#a371f7','avaliados',
      `<div class="ob-mini-stat"><span class="ob-mini-lbl">Pendentes</span><span class="ob-mini-val c-amarelo">${pendentes}</span></div>
       <div class="ob-mini-stat"><span class="ob-mini-lbl">Concluídos</span><span class="ob-mini-val c-verde">${ok+nok}</span></div>`)}
  </div></div>`;
  setTimeout(()=>{
    desenharDonutNaCanvas('cv-mini-eg-total',['Aprovadas','Reprovadas','Pendentes'],[ok||1,nok||1,pendentes||1],['#3fb950','#f85149','#d29922']);
    desenharDonutNaCanvas('cv-mini-eg-ok',['Aprovadas','Restantes'],[ok||1,(nok+pendentes)||1],['#3fb950','#d0d8e8']);
    desenharDonutNaCanvas('cv-mini-eg-nok',['Reprovadas','Aprovadas','Pendentes'],[nok||1,ok||1,pendentes||1],['#f85149','#3fb950','#d29922']);
    const postoMap={};avaliacoes.forEach(a=>{const p=a.posto||a.local||'Sem posto';postoMap[p]=(postoMap[p]||0)+1;});
    const topP=Object.entries(postoMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    desenharDonutNaCanvas('cv-mini-eg-postos',topP.map(x=>x[0]),topP.map(x=>x[1]),['#2E5FA3','#58a6ff','#3fb950','#d29922','#a371f7']);
  },60);
}

function desenharDonutNaCanvas(canvasId,labels,vals,cores){
  const cv=document.getElementById(canvasId);
  if(!cv)return;
  cv.width=cv.parentElement.clientWidth||180;
  cv.height=cv.parentElement.clientHeight||120;
  desenharDonutResponsivo(cv,labels,vals,cores);
}
function expandirLegenda(e,tipo){
  e.stopPropagation();
  const btn=e.currentTarget;
  const labels=JSON.parse(btn.dataset.labels);
  const vals=JSON.parse(btn.dataset.vals);
  const cores=JSON.parse(btn.dataset.cores);
  const usarValor=btn.dataset.usarvalor==='true';
  const tot=vals.reduce((a,b)=>a+b,0);
  const overlay=document.createElement('div');
  overlay.id='leg-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(15,28,63,.45);z-index:500;display:flex;align-items:center;justify-content:center';
  overlay.onclick=()=>overlay.remove();
  const box=document.createElement('div');
  box.style.cssText='background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px 24px;min-width:320px;max-width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(36,55,130,.18)';
  box.onclick=e=>e.stopPropagation();
  box.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)">Legenda completa</span>
    <button onclick="document.getElementById('leg-overlay').remove()" style="background:none;border:1px solid var(--border);border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;color:var(--text-muted);font-family:var(--font)">✕ fechar</button>
  </div>
  ${labels.map((l,i)=>{
    const v=usarValor?Math.round(vals[i]):Math.round(vals[i]/tot*100)+'%';
    return`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
      <span style="width:10px;height:10px;border-radius:50%;background:${cores[i%cores.length]};flex-shrink:0;display:inline-block"></span>
      <span style="flex:1;font-size:12px;color:var(--text)">${l}</span>
      <span style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--text)">${v}</span>
    </div>`;
  }).join('')}`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}
function carregarCache(chave){return!!localStorage.getItem(chave);}

/* ══════════════════════════════════════════════
   DEVTOOLS — Ctrl+Shift+D
══════════════════════════════════════════════ */
const DT_MAPA=[
  {secao:'Init & Utilitários'},
  {fn:'tick',linha:12,tipo:'util'},{fn:'preencherMicroCards',linha:14,tipo:'render'},
  {fn:'mkMicro',linha:119,tipo:'helper'},{fn:'desenharMicroDonut',linha:123,tipo:'canvas'},
  {fn:'loadLogos',linha:129,tipo:'init'},{fn:'loadSidebar',linha:133,tipo:'init'},
  {fn:'lerCache / carregarCache',linha:187,tipo:'util'},
  {secao:'Navegação'},
  {fn:'alternarModulo',linha:195,tipo:'nav'},
  {secao:'Canvas Helpers'},
  {fn:'resolveW',linha:249,tipo:'canvas'},{fn:'desenharBarrasH',linha:251,tipo:'canvas'},
  {fn:'desenharSpark',linha:270,tipo:'canvas'},{fn:'desenharDuplas',linha:288,tipo:'canvas'},
  {fn:'desenharDonut',linha:301,tipo:'canvas'},{fn:'desenharGauge',linha:314,tipo:'canvas'},
  {fn:'desenharOrçado',linha:323,tipo:'canvas'},{fn:'desenharDonutSVG',linha:503,tipo:'canvas'},
  {fn:'desenharDonutResponsivo',linha:481,tipo:'canvas'},{fn:'desenharDonutNaCanvas',linha:1400,tipo:'canvas'},
  {secao:'Módulo Obras'},
  {fn:'calcAvFis',linha:344,tipo:'calc'},{fn:'budgObra/realObra/OrçadoObra',linha:352,tipo:'calc'},
  {fn:'renderObras',linha:356,tipo:'render'},{fn:'buildObrasCards',linha:369,tipo:'render'},
  {fn:'mkCard',linha:398,tipo:'helper'},{fn:'prazoMedio',linha:417,tipo:'calc'},
  {fn:'drawMiniCard',linha:424,tipo:'canvas'},{fn:'toggleObCard',linha:539,tipo:'nav'},
  {fn:'buildOverlayHTML',linha:559,tipo:'render'},{fn:'drawOverlayCharts',linha:622,tipo:'canvas'},
  {fn:'abrirDetalheObra',linha:645,tipo:'nav'},{fn:'voltarParaSubCards',linha:1208,tipo:'nav'},
  {fn:'voltarParaLista',linha:1222,tipo:'nav'},
  {secao:'Módulo Chamados'},
  {fn:'renderChamados',linha:750,tipo:'render'},{fn:'abrirDrillChamados',linha:850,tipo:'nav'},
  {fn:'buildDrillChamadosHTML',linha:870,tipo:'render'},{fn:'drawDrillChamadosCharts',linha:947,tipo:'canvas'},
  {fn:'abrirDetalheChamado',linha:970,tipo:'nav'},{fn:'voltarParaChamados',linha:1000,tipo:'nav'},
  {fn:'voltarParaDrillChamados',linha:1009,tipo:'nav'},
  {secao:'Módulos CAPEX / CODIN / Conforto / Ergonomia'},
  {fn:'renderCapex',linha:1260,tipo:'render'},{fn:'renderCodin',linha:1301,tipo:'render'},
  {fn:'renderConforto',linha:1336,tipo:'render'},{fn:'renderErgonomia',linha:1368,tipo:'render'},
  {secao:'Utilitários UI'},
  {fn:'mkModCard',linha:1236,tipo:'helper'},{fn:'drawModMiniCard',linha:1251,tipo:'canvas'},
  {fn:'expandirLegenda',linha:1407,tipo:'ui'},
];

const DT_CACHES=[
  {key:'obras-dados-cache',label:'Obras',mod:'obras'},
  {key:'capex-dados-cache',label:'CAPEX',mod:'capex'},
  {key:'chamados-facilities-dados',label:'Chamados',mod:'chamados'},
  {key:'codin-dados-cache',label:'CODIN',mod:'codin'},
  {key:'conforto-dados-cache',label:'Conforto',mod:'conforto'},
  {key:'ergonomia-dados-cache',label:'Ergonomia',mod:'ergonomia'},
  {key:'controle-acesso-dados',label:'Acesso',mod:'acesso'},
  {key:'hub-atividades',label:'Atividades',mod:'hub'},
  {key:'hub-config',label:'Config Hub',mod:'hub'},
  {key:'intranet-central',label:'Central',mod:'hub'},
  {key:'conforto-hub-resumo',label:'Conforto Resumo Hub',mod:'conforto'},
];
(function interceptConsole(){
  ['log','warn','error','info'].forEach(t=>{
    const orig=console[t].bind(console);
    console[t]=function(...args){
      orig(...args);
      _dtErros.push({tipo:t==='error'?'err':t==='warn'?'warn':t==='info'?'info':'log',
        msg:args.map(a=>{try{return typeof a==='object'?JSON.stringify(a,null,1):String(a);}catch{return String(a);}}).join(' '),
        ts:new Date().toLocaleTimeString()});
      dtAtualizarAbaBadge();
    };
  });
})();

(function dtInit(){
  const origOnError=window.onerror;
  window.onerror=function(msg,src,line,col,err){
    _dtErros.push({tipo:'err',msg:`${msg} (${src?.split('/').pop()}:${line}:${col})`,ts:new Date().toLocaleTimeString(),linha:line});
    dtAtualizarAbaBadge();
    if(origOnError)origOnError(msg,src,line,col,err);
    const bar=document.getElementById('debug-bar');
    if(bar){bar.style.display='block';bar.textContent=`[ERRO] ${msg} (${src}:${line}:${col})`;}
    return false;
  };
  window.addEventListener('unhandledrejection',e=>{
    _dtErros.push({tipo:'warn',msg:e.reason?.stack||String(e.reason),ts:new Date().toLocaleTimeString()});
    dtAtualizarAbaBadge();
  });
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&e.shiftKey&&(e.key==='D'||e.key==='d')){e.preventDefault();dtToggle();}
    if(e.key==='F8'){e.preventDefault();dtToggle();}
  });
  document.getElementById('dt-close')?.addEventListener('click',dtClose);
  document.querySelectorAll('.dt-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.dt-tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.dt-pane').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      const pane=document.getElementById(btn.dataset.tab);
      if(pane){pane.classList.add('active');dtRenderPane(btn.dataset.tab);}
    });
  });
  // Console input
  const inp=document.getElementById('dt-console-input');
  const run=document.getElementById('dt-console-run');
  const clr=document.getElementById('dt-console-clear');
  inp?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){dtConsoleRun();return;}
    if(e.key==='ArrowUp'){e.preventDefault();if(_dtConsoleIdx<_dtConsoleHist.length-1){_dtConsoleIdx++;inp.value=_dtConsoleHist[_dtConsoleHist.length-1-_dtConsoleIdx]||'';}}
    if(e.key==='ArrowDown'){e.preventDefault();if(_dtConsoleIdx>0){_dtConsoleIdx--;inp.value=_dtConsoleHist[_dtConsoleHist.length-1-_dtConsoleIdx]||'';}else{_dtConsoleIdx=-1;inp.value='';}}
  });
  run?.addEventListener('click',dtConsoleRun);
  clr?.addEventListener('click',()=>{const o=document.getElementById('dt-console-output');if(o)o.innerHTML='';});
  // Panel resize — arrastar borda superior
  const panel=document.getElementById('devtools-panel');
  const topbar=document.getElementById('devtools-topbar');
  let resizing=false,startY=0,startH=0;
  topbar?.addEventListener('mousedown',e=>{
    if(e.target!==topbar&&!e.target.id==='devtools-topbar')return;
    resizing=true;startY=e.clientY;startH=panel.offsetHeight;
    document.body.style.userSelect='none';
  });
  document.addEventListener('mousemove',e=>{if(!resizing)return;const delta=startY-e.clientY;panel.style.height=Math.max(200,Math.min(window.innerHeight*.8,startH+delta))+'px';});
  document.addEventListener('mouseup',()=>{resizing=false;document.body.style.userSelect='';});
})();

function dtAtualizarAbaBadge(){
  const errs=_dtErros.filter(e=>e.tipo==='err').length;
  const warns=_dtErros.filter(e=>e.tipo==='warn').length;
  const tab=document.querySelector('.dt-tab[data-tab="dt-erros"]');
  if(!tab)return;
  tab.textContent=errs?`Erros (${errs})`:warns?`Erros (${warns})`:'Erros';
  tab.className='dt-tab'+(errs?' dt-tab-err':warns?' dt-tab-warn':'');
  if(document.querySelector('.dt-tab[data-tab="dt-erros"].active'))dtRenderPane('dt-erros');
}

function dtToggle(){const p=document.getElementById('devtools-panel');p.classList.contains('open')?dtClose():dtOpen();}
function dtOpen(){document.getElementById('devtools-panel').classList.add('open');dtRenderPane(document.querySelector('.dt-tab.active')?.dataset.tab||'dt-mapa');}
function dtClose(){document.getElementById('devtools-panel').classList.remove('open');}

function dtRenderPane(id){
  const el=document.getElementById(id);if(!el)return;
  if(id==='dt-mapa')dtRenderMapa(el);
  else if(id==='dt-cache')dtRenderCache(el);
  else if(id==='dt-erros')dtRenderErros(el);
  else if(id==='dt-perf')dtRenderPerf(el);
  else if(id==='dt-estado')dtRenderEstado(el);
}

// ── MAPA ──
function dtRenderMapa(el){
  const tipos=['render','canvas','nav','helper','calc','util','init','ui'];
  const coresTipo={render:'#79c0ff',canvas:'#d2a8ff',nav:'#ffa657',helper:'#7ee787',calc:'#e3b341',util:'#8b949e',init:'#58a6ff',ui:'#ff7b72'};
  el.innerHTML=`
    <div class="dt-mapa-toolbar">
      <input class="dt-search" id="dt-mapa-search" placeholder="Buscar função…" type="text">
      <div class="dt-filter-btns" id="dt-mapa-filtros">
        <button class="dt-filter-btn active" data-tipo="">tudo</button>
        ${tipos.map(t=>`<button class="dt-filter-btn" data-tipo="${t}" style="border-left:2px solid ${coresTipo[t]}">${t}</button>`).join('')}
      </div>
    </div>
    <div class="dt-mapa-scroll" id="dt-mapa-lista"></div>`;

  function renderLista(busca='',tipoFiltro=''){
    const lista=document.getElementById('dt-mapa-lista');if(!lista)return;
    let html='';let secAtual='';
    const b=busca.toLowerCase();
    DT_MAPA.forEach(item=>{
      if(item.secao){secAtual=item.secao;return;}
      if(tipoFiltro&&item.tipo!==tipoFiltro)return;
      if(b&&!item.fn.toLowerCase().includes(b)&&!item.tipo.toLowerCase().includes(b))return;
      if(secAtual&&html.indexOf(`data-sec="${secAtual}"`)===-1){
        html+=`<div class="dt-section-title" data-sec="${secAtual}">${secAtual}</div>`;
      }
      const cor=coresTipo[item.tipo]||'#8b949e';
      html+=`<div class="dt-fn-row" onclick="dtIrParaLinha(${item.linha})" title="Copiar kpi.js:${item.linha}">
        <span class="dt-fn-name">${item.fn}</span>
        <span class="dt-fn-type" style="color:${cor}">${item.tipo}</span>
        <span class="dt-fn-line">L:${item.linha}</span>
      </div>`;
    });
    lista.innerHTML=html||'<div style="color:#555e6a;padding:20px;text-align:center;font-size:11px">Nenhuma função encontrada</div>';
  }
  renderLista();
  setTimeout(()=>{
    document.getElementById('dt-mapa-search')?.addEventListener('input',e=>{
      const tf=document.querySelector('.dt-filter-btn.active')?.dataset.tipo||'';
      renderLista(e.target.value,tf);
    });
    document.getElementById('dt-mapa-filtros')?.addEventListener('click',e=>{
      const btn=e.target.closest('.dt-filter-btn');if(!btn)return;
      document.querySelectorAll('.dt-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const busca=document.getElementById('dt-mapa-search')?.value||'';
      renderLista(busca,btn.dataset.tipo);
    });
  },50);
}

// ── CACHE ──
function dtRenderCache(el){
  const loaded=DT_CACHES.filter(c=>localStorage.getItem(c.key)).length;
  el.innerHTML=`
    <div class="dt-cache-toolbar">
      <span style="font-size:10px;color:#555e6a">${loaded}/${DT_CACHES.length} chaves carregadas</span>
      <input class="dt-search" id="dt-cache-search" placeholder="Filtrar…" style="max-width:180px">
      <button class="dt-cache-btn" onclick="dtLimparTodoCache()" style="margin-left:auto;color:#f85149">limpar tudo</button>
    </div>
    <div class="dt-cache-list" id="dt-cache-list-inner"></div>
    <div class="dt-json-panel hidden" id="dt-json-panel">
      <div class="dt-json-header">
        <span class="dt-json-title" id="dt-json-title">—</span>
        <div style="display:flex;gap:6px">
          <button class="dt-cache-btn" id="dt-json-copy" style="color:#58a6ff">copiar JSON</button>
          <button class="dt-json-close" onclick="dtFecharJSON()">✕</button>
        </div>
      </div>
      <div class="dt-json-body" id="dt-json-body"></div>
    </div>`;
  dtRenderCacheLista('');
  setTimeout(()=>{
    document.getElementById('dt-cache-search')?.addEventListener('input',e=>dtRenderCacheLista(e.target.value));
    document.getElementById('dt-json-copy')?.addEventListener('click',()=>{
      const raw=localStorage.getItem(_dtCacheVizKey||'');
      if(raw)navigator.clipboard?.writeText(raw);
    });
  },50);
}

function dtRenderCacheLista(busca){
  const el=document.getElementById('dt-cache-list-inner');if(!el)return;
  const b=busca.toLowerCase();
  const items=DT_CACHES.filter(c=>!b||c.label.toLowerCase().includes(b)||c.key.toLowerCase().includes(b));
  el.innerHTML=items.map(c=>{
    const raw=localStorage.getItem(c.key);
    const size=raw?Math.round(raw.length/1024*10)/10:0;
    let preview='—';
    if(raw){try{const d=JSON.parse(raw);const ks=Object.keys(d);preview=ks.slice(0,4).join(', ')+(ks.length>4?' …':'');}catch{preview=raw.slice(0,50);}}
    const cor=raw?'#3fb950':'#555e6a';
    return`<div class="dt-cache-item" onclick="dtVerCache('${c.key}','${c.label}')">
      <span style="width:7px;height:7px;border-radius:50%;background:${cor};flex-shrink:0;display:inline-block"></span>
      <span class="dt-cache-key">${c.label}</span>
      <span class="dt-cache-val" title="${c.key}">${preview}</span>
      <span class="dt-cache-size">${raw?size+'kb':'—'}</span>
      ${raw?`<button class="dt-cache-btn" onclick="event.stopPropagation();dtLimparCache('${c.key}')">✕</button>`:''}
    </div>`;
  }).join('')||'<div style="color:#555e6a;padding:20px;text-align:center;font-size:11px">Nenhum cache encontrado</div>';
}

function dtVerCache(key,label){
  _dtCacheVizKey=key;
  const panel=document.getElementById('dt-json-panel');
  const title=document.getElementById('dt-json-title');
  const body=document.getElementById('dt-json-body');
  if(!panel||!body)return;
  const raw=localStorage.getItem(key);
  if(!raw){body.innerHTML='<span style="color:#555e6a">Cache vazio</span>';panel.classList.remove('hidden');title.textContent=label+' (vazio)';return;}
  try{
    const d=JSON.parse(raw);
    title.textContent=`${label} — ${raw.length} chars`;
    body.innerHTML=dtColorirJSON(JSON.stringify(d,null,2));
  }catch{
    title.textContent=label+' (raw)';
    body.textContent=raw.slice(0,5000);
  }
  panel.classList.remove('hidden');
}

function dtFecharJSON(){document.getElementById('dt-json-panel')?.classList.add('hidden');_dtCacheVizKey=null;}

function dtColorirJSON(txt){
  return txt
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,m=>{
      if(/^"/.test(m)){if(/:$/.test(m))return`<span class="dt-json-key">${m}</span>`;return`<span class="dt-json-str">${m}</span>`;}
      if(/true|false/.test(m))return`<span class="dt-json-bool">${m}</span>`;
      if(/null/.test(m))return`<span class="dt-json-null">${m}</span>`;
      return`<span class="dt-json-num">${m}</span>`;
    });
}

function dtLimparCache(key){if(!confirm('Limpar "'+key+'"?'))return;localStorage.removeItem(key);dtRenderCacheLista(document.getElementById('dt-cache-search')?.value||'');}
function dtLimparTodoCache(){if(!confirm('Limpar TODOS os caches do ERP?'))return;DT_CACHES.forEach(c=>localStorage.removeItem(c.key));dtRenderCacheLista('');}

// ── ERROS ──
function dtRenderErros(el){
  const filtros=['tudo','err','warn','log','info'];
  el.innerHTML=`
    <div class="dt-erros-toolbar">
      <div class="dt-filter-btns" id="dt-err-filtros">
        ${filtros.map((f,i)=>`<button class="dt-filter-btn${i===0?' active':''}" data-tipo="${f==='tudo'?'':f}">${f} ${f!=='tudo'&&_dtErros.filter(e=>e.tipo===f).length?'('+_dtErros.filter(e=>e.tipo===f).length+')':''}</button>`).join('')}
      </div>
      <button class="dt-cache-btn" onclick="_dtErros=[];dtRenderPane('dt-erros');dtAtualizarAbaBadge()" style="margin-left:auto">limpar</button>
    </div>
    <div class="dt-err-list" id="dt-err-list-inner"></div>`;
  dtRenderErroLista('');
  setTimeout(()=>{
    document.getElementById('dt-err-filtros')?.addEventListener('click',e=>{
      const btn=e.target.closest('.dt-filter-btn');if(!btn)return;
      document.querySelectorAll('#dt-err-filtros .dt-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      dtRenderErroLista(btn.dataset.tipo);
    });
  },50);
}

function dtRenderErroLista(tipo){
  const el=document.getElementById('dt-err-list-inner');if(!el)return;
  const lista=tipo?_dtErros.filter(e=>e.tipo===tipo):_dtErros;
  if(!lista.length){el.innerHTML='<div class="dt-err-empty">✓ Nenhum registro</div>';return;}
  el.innerHTML=lista.slice().reverse().map(e=>`
    <div class="dt-err-row ${e.tipo}">
      <div class="dt-err-time">${e.ts}${e.linha?' · linha '+e.linha:''}</div>
      <div class="dt-err-msg">${e.msg}</div>
    </div>`).join('');
}
function dtRenderPerf(el){
  const now=Date.now();
  const uptime=((now-_dtInicio)/1000).toFixed(1);
  const cachekb=Math.round(cacheTotal/1024);
  const modulos=DT_CACHES.slice(0,7);
  const renders=Object.entries(_dtRenderTimes).sort((a,b)=>b[1]-a[1]);
  const maxMs=renders.length?renders[0][1]:1;
  el.innerHTML=`
    <div class="dt-perf-scroll">
      <div style="font-size:9px;color:#555e6a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Sistema</div>
      <div class="dt-perf-row"><span class="dt-perf-label">Sessão ativa</span><div class="dt-perf-bar-wrap"><div class="dt-perf-bar" style="width:100%;background:#2E5FA3"></div></div><span class="dt-perf-val">${uptime}s</span></div>
      <div class="dt-perf-row"><span class="dt-perf-label">Cache localStorage</span><div class="dt-perf-bar-wrap"><div class="dt-perf-bar" style="width:${Math.min(cachekb/50*100,100)}%;background:#d29922"></div></div><span class="dt-perf-val">${cachekb}kb</span></div>
      <div class="dt-perf-row"><span class="dt-perf-label">Módulos carregados</span><div class="dt-perf-bar-wrap"><div class="dt-perf-bar" style="width:${Math.round(loaded/modulos.length*100)}%;background:#3fb950"></div></div><span class="dt-perf-val">${loaded}/${modulos.length}</span></div>
      <div class="dt-perf-row"><span class="dt-perf-label">Erros nesta sessão</span><div class="dt-perf-bar-wrap"><div class="dt-perf-bar" style="width:${Math.min(_dtErros.filter(e=>e.tipo==='err').length*10,100)}%;background:#f85149"></div></div><span class="dt-perf-val">${_dtErros.filter(e=>e.tipo==='err').length}</span></div>
      ${renders.length?`
      <div style="font-size:9px;color:#555e6a;letter-spacing:.1em;text-transform:uppercase;margin:12px 0 6px">Tempo de render por função (ms)</div>
      ${renders.map(([fn,ms])=>`<div class="dt-render-row">
        <span class="dt-render-fn">${fn}</span>
        <div class="dt-render-bar"><div class="dt-render-fill" style="width:${Math.round(ms/maxMs*100)}%;background:${ms>100?'#f85149':ms>50?'#d29922':'#3fb950'}"></div></div>
        <span class="dt-render-ms">${ms}ms</span>
      </div>`).join('')}`:'<div style="color:#555e6a;font-size:11px;margin-top:12px">Nenhum tempo de render medido ainda.<br>Os renders são medidos automaticamente ao abrir módulos.</div>'}
    </div>`;
}

// ── ESTADO ──
function dtRenderEstado(el){
  const dados=DT_CACHES.map(c=>{
    const raw=localStorage.getItem(c.key);
    if(!raw)return{label:c.label,mod:c.mod,vazio:true};
    try{
      const d=JSON.parse(raw);
      const contagens=[];
      const arrays=['obras','lancamentos','budget','chamados','pessoas','pontos',
        'ordens','ucs','preventivas','manutencoes','pecas','requisicoes','areas',
        'fornecedores','tecnicos','avaliacoes','registros','atividades','codins'];
      arrays.forEach(k=>{if(Array.isArray(d[k]))contagens.push({k,n:d[k].length});});
      if(!contagens.length){
        const ks=Object.keys(d).filter(k=>Array.isArray(d[k]));
        ks.slice(0,5).forEach(k=>contagens.push({k,n:d[k].length}));
      }
      return{label:c.label,mod:c.mod,vazio:false,contagens,raw:raw.length};
    }catch{return{label:c.label,mod:c.mod,vazio:false,contagens:[],raw:raw.length};}
  });

  const carregados=dados.filter(d=>!d.vazio);
  const vazios=dados.filter(d=>d.vazio);

  el.innerHTML=`
    <div style="font-size:9px;color:#555e6a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">
      ${carregados.length} módulo(s) com dados · ${vazios.length} sem dados
    </div>
    <div class="dt-estado-grid">
      ${carregados.map(d=>`
        <div class="dt-estado-card">
          <div class="dt-estado-mod">${d.label}</div>
          ${d.contagens.length?d.contagens.map(c=>`
            <div class="dt-estado-row">
              <span class="dt-estado-lbl">${c.k}</span>
              <span class="dt-estado-val dt-estado-${c.n>0?'ok':'warn'}">${c.n}</span>
            </div>`).join(''):`<div class="dt-estado-row"><span class="dt-estado-lbl">raw</span><span class="dt-estado-val">${Math.round(d.raw/1024*10)/10}kb</span></div>`}
        </div>`).join('')}
      ${vazios.length?`<div class="dt-estado-card" style="opacity:.4">
        <div class="dt-estado-mod" style="color:#555e6a">Sem dados</div>
        ${vazios.map(d=>`<div class="dt-estado-row"><span class="dt-estado-lbl dt-estado-err">○ ${d.label}</span></div>`).join('')}
      </div>`:''}
    </div>`;
}

// ── CONSOLE ──
function dtConsoleRun(){
  const inp=document.getElementById('dt-console-input');
  const out=document.getElementById('dt-console-output');
  if(!inp||!out)return;
  const code=inp.value.trim();
  if(!code)return;
  _dtConsoleHist.push(code);_dtConsoleIdx=-1;
  dtConsoleLinha('›',code,'out-input',out);
  try{
    // eslint-disable-next-line no-eval
    const result=eval(code);
    const txt=result===undefined?'undefined':typeof result==='object'?JSON.stringify(result,null,2):String(result);
    dtConsoleLinha('←',txt,'out-result',out);
  }catch(e){
    dtConsoleLinha('✕',e.message,'out-err',out);
  }
  inp.value='';
  out.scrollTop=out.scrollHeight;
}

function dtConsoleLinha(prompt,msg,cls,out){
  const div=document.createElement('div');
  div.className='dt-con-line';
  div.innerHTML=`<span class="dt-con-prompt">${prompt}</span><span class="dt-con-out ${cls}">${msg.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
  out.appendChild(div);
}

// ── IR PARA LINHA ──
function dtIrParaLinha(linha){
  const ref=`kpi.js:${linha}`;
  if(navigator.clipboard){
    navigator.clipboard.writeText(ref).then(()=>{
      const hint=document.getElementById('dt-atalho-hint');
      if(hint){const orig=hint.textContent;hint.textContent=`✓ Copiado: ${ref}`;setTimeout(()=>hint.textContent=orig,2000);}
    });
  }
}

// ── MEDIR RENDER ──
function dtMedirRender(nome,fn){
  const r=fn();
  if(r&&typeof r.then==='function'){
    const t0=performance.now();
    r.then(()=>{
      const ms=Math.round(performance.now()-t0);
      try{if(typeof _dtRenderTimes!=='undefined')_dtRenderTimes[nome]=ms;}catch(e){}
    });
  } else {
    const t0=performance.now();
    const ms=Math.round(performance.now()-t0);
    try{if(typeof _dtRenderTimes!=='undefined')_dtRenderTimes[nome]=ms;}catch(e){}
  }
}