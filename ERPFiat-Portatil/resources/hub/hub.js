'use strict';
const $=id=>document.getElementById(id);
const fmtRK=v=>{if(!v&&v!==0)return'—';const n=+v;if(Math.abs(n)>=1e6)return'R$'+(n/1e6).toFixed(1)+'M';if(Math.abs(n)>=1e3)return'R$'+(n/1e3).toFixed(1)+'k';return'R$'+Math.round(n);};

const DEFAULT={
  identidade:{brand:'Controler',brandEnv:'ERP Facilities',instNome:'Stellantis Brasil',instSub:'Infraestrutura Facilities',instBadge:'ISO 55001'},
  painelEsq:{valores:'Excelência Operacional · Segurança · Sustentabilidade',objetivo:'Zero paradas não planejadas. Redução 30% no consumo energético.',objProg:68,objPrazo:'Dez/2026',missao:'Infraestrutura segura, eficiente e sustentável para operações de classe mundial.',metas:['Manutenção preventiva ≥ 95%','Redução chamados corretivos -15%','Conformidade NR-12: 100%']},
  kpisMini:[
    {lbl:'Obras em andamento',val:'—',cls:'yw',sub:'cadastradas',bar:0,barCor:'var(--yw)'},
    {lbl:'Chamados abertos',val:'—',cls:'rd',sub:'total',bar:0,barCor:'var(--rd)'},
    {lbl:'Atividades concluídas',val:'—',cls:'gn',sub:'do total',bar:0,barCor:'var(--gn)'},
    {lbl:'Budget executado',val:'—',cls:'bl',sub:'do aprovado',bar:0,barCor:'var(--bl)'}
  ],
  acoes:[
    {titulo:'Recertificação Sprinklers',status:'urg',prazo:'20 Jun 2026',resp:'RM',visivel:true},
    {titulo:'Modernização Subestação #3',status:'plan',prazo:'Jul 2026',resp:'FS',visivel:true},
    {titulo:'Fotovoltaicos — Fase 2',status:'prog',prazo:'Ago 2026',resp:'KL',visivel:true},
    {titulo:'Retrofit HVAC Pintura',status:'plan',prazo:'Set 2026',resp:'JP',visivel:true},
    {titulo:'Adequação NR-12 Linha 7',status:'rev',prazo:'25 Jun 2026',resp:'AL',visivel:true},
    {titulo:'Reuso de Água Industrial',status:'plan',prazo:'Out 2026',resp:'MC',visivel:true},
    {titulo:'CMMS Preditivo IoT',status:'prog',prazo:'Nov 2026',resp:'TS',visivel:true},
    {titulo:'Reforma Vestiários',status:'plan',prazo:'Dez 2026',resp:'BH',visivel:true}
  ],
  atividades:[
    {texto:'Inspeção HVAC — Bloco A',estado:'done',prio:'pl',ptxt:'OK'},
    {texto:'Teste geradores emergência',estado:'done',prio:'pl',ptxt:'OK'},
    {texto:'Calibração contra incêndio',estado:'pend',prio:'ph',ptxt:'HOJE'},
    {texto:'Manut. preventiva compressores',estado:'pend',prio:'ph',ptxt:'14h'},
    {texto:'Auditoria EPI — Linha 3',estado:'',prio:'pm',ptxt:'AMANHÃ'},
    {texto:'Contrato fornecedor limpeza',estado:'',prio:'pm',ptxt:'SEX'},
    {texto:'Planta elétrica Bloco C',estado:'',prio:'pl',ptxt:'SEM.'},
    {texto:'Vistoria subestação principal',estado:'',prio:'pm',ptxt:'SEM.'}
  ],
  logos:['','','','']
};

const saved=localStorage.getItem('hub-config');
let CFG=JSON.parse(JSON.stringify(DEFAULT));
if(saved){try{const s=JSON.parse(saved);CFG=Object.assign({},DEFAULT,s);CFG.painelEsq=Object.assign({},DEFAULT.painelEsq,s.painelEsq||{});CFG.identidade=Object.assign({},DEFAULT.identidade,s.identidade||{});}catch(e){}}

// ── LOGOS ──
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
        syncCentral();
      };r.readAsDataURL(f);
    });
  });
}

// ── CLOCK ──
function tick(){
  const n=new Date();
  $('el-clock').textContent=[n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
  const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  $('el-date').textContent=n.getDate()+' '+months[n.getMonth()]+' '+n.getFullYear();
  $('el-now-lbl').textContent=n.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
tick();setInterval(tick,1000);

// ── IDENTIDADE ──
function applyIdent(){
  const id=CFG.identidade||{};
  if(id.brand)$('el-brand').textContent=id.brand;
  if(id.brandEnv)$('el-brand-env').textContent=id.brandEnv;
  if(id.instNome)$('el-inst-nome').textContent=id.instNome;
  if(id.instSub)$('el-inst-sub').textContent=id.instSub;
  if(id.instBadge)$('el-inst-badge').textContent=id.instBadge;
}

// ── ATIVIDADES ──
function buildActs(){
  const atv=CFG.atividades||[];
  let done=atv.filter(a=>a.estado==='done').length;
  $('el-acts').innerHTML=atv.map((a,i)=>`
    <div class="act" data-i="${i}">
      <div class="chk ${a.estado}"></div>
      <div class="at ${a.estado==='done'?'done-t':''}">${a.texto}</div>
      <div class="pil ${a.prio||'pl'}">${a.ptxt||''}</div>
    </div>`).join('');
  updateActPct(done,atv.length);
  $('el-acts').querySelectorAll('.act').forEach(el=>el.addEventListener('click',function(){
    const i=+this.dataset.i;
    if(CFG.atividades[i].estado==='done')return;
    CFG.atividades[i].estado='done';
    this.querySelector('.chk').className='chk done';
    this.querySelector('.at').classList.add('done-t');
    updateActPct(CFG.atividades.filter(a=>a.estado==='done').length,CFG.atividades.length);
    syncCentral();
  }));
}
function updateActPct(d,t){
  $('el-act-pct').textContent=d+'/'+t;
  const pct=t?Math.round(d/t*100):0;
  $('el-act-bar').style.transition='width .8s ease';
  $('el-act-bar').style.width=pct+'%';
}

// ── KPI MINI (top-left) ──
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
function buildVidKpis(){
  const kpis=CFG.kpisMini||[];
  const html=kpis.map(k=>`
    <div class="vid-kpi-box">
      <div class="vid-kpi-lbl">${k.lbl}</div>
      <div class="vid-kpi-val" style="color:var(--${k.cls==='bl'?'bl':k.cls==='gn'?'gn':k.cls==='rd'?'rd':'yw'})">${k.val}</div>
      <div class="vid-kpi-sub">${k.sub}</div>
    </div>`).join('');
  const el=$('vid-kpis-1');if(el)el.innerHTML=html;
}

// ── AÇÕES FUTURAS ──
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

// ── VAL/OBJ/MISSÃO/METAS ──
function buildVMO(){
  const pe=CFG.painelEsq||{};
  const prog=pe.objProg||0;
  const cores=['var(--gn)','var(--yw)','var(--bl)'];
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

// ── VIDEO / GIF ──
let gifLoaded=false;
const savedGif=localStorage.getItem('hub-gif');
function dbg(){}
if(savedGif){
  const img=$('video-gif');
  img.dataset.src=savedGif;
  img.removeAttribute('src');
  $('video-placeholder').style.display='none';
  gifLoaded=true;
  const cv=document.createElement('canvas');
  cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
  cv.id='gif-canvas';
  $('video-inner').insertBefore(cv,$('video-gif'));
  const tmp=new Image();
  tmp.onload=()=>{
    cv.width=tmp.naturalWidth;cv.height=tmp.naturalHeight;
    cv.getContext('2d').drawImage(tmp,0,0);
  };
  tmp.src=savedGif;
}
$('btn-gif-upload').addEventListener('click',e=>{e.stopPropagation();const inp=document.createElement('input');inp.type='file';inp.accept='image/gif,image/*';inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{
  const src=ev.target.result;
  localStorage.setItem('hub-gif',src);
  const img=$('video-gif');
  img.dataset.src=src;  
  img.src='';            
  img.classList.add('loaded');
  $('video-placeholder').style.display='none';
  gifLoaded=true;
};;r.readAsDataURL(f);};inp.click();});
function openMetrics(){$('metrics-panel').classList.add('open');}
$('btn-mp-close').addEventListener('click',()=>$('metrics-panel').classList.remove('open'));
const vi=$('video-inner');
let hoverTimer=null;
vi.addEventListener('mouseover',()=>{
  clearTimeout(hoverTimer);
  const img=$('video-gif');
  if(img.dataset.src&&!img.classList.contains('playing')){
    img.src=img.dataset.src;
    img.classList.add('playing');
    const cv=$('gif-canvas');if(cv)cv.style.opacity='0';
  }
});
vi.addEventListener('mouseout',e=>{
  if(vi.contains(e.relatedTarget))return;
  hoverTimer=setTimeout(()=>{
    const img=$('video-gif');
    img.removeAttribute('src');
    img.classList.remove('playing');
    const cv=$('gif-canvas');if(cv)cv.style.opacity='1';
  },80);
});
$('btn-kpi-toggle').addEventListener('click',e=>{
  e.stopPropagation();
  $('video-overlay').classList.toggle('open');
});

// ── METRICS PANEL KPIs ──
function buildMetricsPanel(){
  const kpis=CFG.kpisMini||[];
  $('el-mp-kpis').innerHTML=kpis.map((k,i)=>`
    <div class="kpi-box">
      <div class="kpi-lbl">${k.lbl}</div>
      <div class="kpi-val ${k.cls}" id="mp-kpi-val-${i}">${k.val}</div>
      <div class="kpi-sub" id="mp-kpi-sub-${i}">${k.sub}</div>
      <div class="kpi-bar"><div class="kpi-bar-fill" id="mp-kpi-bar-${i}" style="width:${k.bar}%;background:${k.barCor}"></div></div>
    </div>`).join('');
  const ffiles=[
    {key:'obras',cache:'obras-dados-cache',lbl:'obras.json',fn:atualizarObras},
    {key:'cham',cache:'chamados-facilities-dados',lbl:'chamados.json',fn:atualizarCham},
    {key:'ativ',cache:'hub-atividades',lbl:'atividades.json',fn:atualizarAtiv},
    {key:'codin',cache:'controle-acesso-dados',lbl:'codin.json',fn:atualizarCodin},
    {key:'conforto',cache:'conforto-dados-cache',lbl:'conforto-dados.json',fn:atualizarConforto}
  ];
  $('el-mp-files').innerHTML=ffiles.map(f=>`<button class="mod-pill" data-key="${f.key}" style="cursor:pointer">📂 ${f.lbl}</button>`).join('');
  $('el-mp-files').querySelectorAll('button').forEach((btn,i)=>{
    btn.addEventListener('click',()=>loadFile(ffiles[i]));
  });
  // File rows no top-left
  $('el-file-rows').innerHTML=ffiles.map(f=>`
  <div style="display:flex;align-items:center;gap:6px">
    <div style="width:5px;height:5px;border-radius:50%;background:var(--bor);flex-shrink:0" id="fdot-${f.key}"></div>
    <span style="font-size:10px;color:var(--td);font-family:var(--mono);flex:1" id="fname-${f.key}">${f.lbl}</span>
    <button style="background:none;border:1px solid var(--bor);border-radius:4px;color:var(--td);font-size:9px;padding:2px 6px;cursor:pointer;font-family:var(--mono)" onclick="loadFileByKey('${f.key}')">📂</button>
  </div>`).join('');

const centralRow=document.createElement('div');
centralRow.style.cssText='display:flex;align-items:center;gap:6px';
centralRow.innerHTML=`
  <div style="width:5px;height:5px;border-radius:50%;background:${localStorage.getItem('intranet-central')?'var(--gn)':'var(--bor)'};flex-shrink:0" id="fdot-central"></div>
  <span style="font-size:10px;color:var(--td);font-family:var(--mono);flex:1" id="fname-central">${localStorage.getItem('neu-name-central')||'central.json'}</span>
  <button style="background:none;border:1px solid var(--bor);border-radius:4px;color:var(--td);font-size:9px;padding:2px 6px;cursor:pointer;font-family:var(--mono)" onclick="loadCentral()">📂</button>`;
$('el-file-rows').appendChild(centralRow);
const expRow=document.createElement('div');
expRow.style.cssText='display:flex;justify-content:flex-end;margin-top:4px';
expRow.innerHTML=`<button style="background:none;border:1px solid var(--bor);border-radius:4px;color:var(--td);font-size:9px;padding:2px 8px;cursor:pointer;font-family:var(--mono)" onclick="exportarCentral()">⬇ exportar central</button>`;
$('el-file-rows').appendChild(expRow);
const imgRow=document.createElement('div');
imgRow.style.cssText='display:flex;align-items:center;gap:6px;margin-top:2px';
imgRow.innerHTML=`
  <div style="width:5px;height:5px;border-radius:50%;background:${(CFG.logos||[]).some(l=>l)||localStorage.getItem('hub-gif')?'var(--gn)':'var(--bor)'};flex-shrink:0" id="fdot-imagens"></div>
  <span style="font-size:10px;color:var(--td);font-family:var(--mono);flex:1" id="fname-imagens">${localStorage.getItem('neu-name-imagens')||'imagens.json'}</span>
  <button style="background:none;border:1px solid var(--bor);border-radius:4px;color:var(--td);font-size:9px;padding:2px 6px;cursor:pointer;font-family:var(--mono)" onclick="loadImagens()">📂</button>
  <button style="background:none;border:1px solid var(--bor);border-radius:4px;color:var(--td);font-size:9px;padding:2px 6px;cursor:pointer;font-family:var(--mono)" onclick="exportarImagens()">⬇</button>`;
$('el-file-rows').appendChild(imgRow);
}

function loadFile(ff){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{try{const d=JSON.parse(e.target.result);localStorage.setItem(ff.cache,e.target.result);localStorage.setItem('neu-cache-'+ff.key,e.target.result);localStorage.setItem('neu-name-'+ff.key,f.name);ff.fn(d);const c=JSON.parse(localStorage.getItem('intranet-central')||'{}');
if(ff.key==='obras'){c.obras=d.obras;c.budget=d.budget;c.lancamentos=d.lancamentos;}
if(ff.key==='cham')c.chamados=d.chamados||(Array.isArray(d)?d:[]);
if(ff.key==='ativ')c.atividades=Array.isArray(d)?d:(d.atividades||[]);
if(ff.key==='codin')c.pessoas=d.pessoas||[];
if(ff.key==='conforto'){c.conforto={ordens:d.ordens||[],ucs:d.ucs||[],preventivas:d.preventivas||[],manutencoes:d.manutencoes||[]};}
localStorage.setItem('intranet-central',JSON.stringify(c));}catch(err){console.error('Error loading file:',err);}};r.readAsText(f);};inp.click();
}
const FILE_MAP={
  obras:{cache:'obras-dados-cache',fn:atualizarObras},
  cham:{cache:'chamados-facilities-dados',fn:atualizarCham},
  ativ:{cache:'hub-atividades',fn:atualizarAtiv},
  codin:{cache:'controle-acesso-dados',fn:atualizarCodin},
  conforto:{cache:'conforto-dados-cache',fn:atualizarConforto}
};
window.loadFileByKey=key=>{const ff=FILE_MAP[key];if(ff)loadFile({key,...ff,lbl:key+'.json'});};
function setDot(key,ok){const e=$('fdot-'+key);if(e)e.style.background=ok?'var(--gn)':'var(--bor)';}
function setFname(key,n){const e=$('fname-'+key);if(e)e.textContent=n;}

// ── KPI UPDATERS ──
function setKpi(i,val,sub,bar){
  const update=prefix=>{
    const v=$(prefix+'kpi-val-'+i);const s=$(prefix+'kpi-sub-'+i);const b=$(prefix+'kpi-bar-'+i);
    if(v)v.textContent=val;if(s)s.textContent=sub;if(b){b.style.transition='width .8s ease';b.style.width=Math.min(bar,100)+'%';}
  };
  update('');update('mp-');
  if(CFG.kpisMini[i]){CFG.kpisMini[i].val=val;CFG.kpisMini[i].sub=sub;CFG.kpisMini[i].bar=bar;}
buildVidKpis();
  
}
function atualizarObras(d){
  const obras=d.obras||[];
  const and=obras.filter(o=>o.status==='Em Andamento').length;
  const conc=obras.filter(o=>o.status==='Concluído').length;
  const totalB=(d.budget||[]).reduce((s,b)=>s+(b.budgetAprov||0),0);
  const totalR=(d.lancamentos||[]).reduce((s,l)=>s+l.qtd*l.precoUnit,0);
  const pct=totalB?Math.round(totalR/totalB*100):0;
  setKpi(0,and,obras.length+' cadastradas',obras.length?Math.round(and/obras.length*100):0);
  setKpi(3,pct+'%',fmtRK(totalB)+' aprovado',pct);
}
function atualizarCham(d){
  const c=d.chamados||(Array.isArray(d)?d:[]);
  const ab=c.filter(x=>x.status==='Aberto').length;
  const total=c.length;
  setKpi(1,ab,total+' total',total?Math.round(ab/total*100):0);
}
function atualizarAtiv(d){
  const a=Array.isArray(d)?d:(d.atividades||[]);
  const total=a.length,done=a.filter(x=>x.status==='done').length;
  const pct=total?Math.round(done/total*100):0;
  setKpi(2,pct+'%',done+'/'+total+' concluídas',pct);
}
function atualizarCodin(d){
  const pessoas=d.pessoas||[];
  const total=pessoas.length;
  const ativos=pessoas.filter(p=>p.status==='Ativo'||!p.status).length;
  const pct=total?Math.round(ativos/total*100):0;
}
function atualizarConforto(d){
  const ordens=d.ordens||[];
  const ucs=d.ucs||[];
  const prev=d.preventivas||[];
  const man=d.manutencoes||[];
  const hoje_=new Date().toISOString().slice(0,10);
  const prevAtrasadas=prev.filter(p=>p.status!=='Realizada'&&p.dataPrevista&&p.dataPrevista<hoje_).length;
  const manAbertas=man.filter(m=>m.status==='Aberta'||m.status==='Em Andamento').length;
  localStorage.setItem('conforto-hub-resumo', JSON.stringify({
    ordensAbertas: ordens.filter(o=>o.status==='Programada'||o.status==='Em Execução').length,
    totalUCs: ucs.length,
    prevAtrasadas,
    manAbertas
  }));
}

// ── CARREGAR CACHE ──
function loadCache(){
     const central=localStorage.getItem('intranet-central');
  if(central)try{
    const d=JSON.parse(central);
    if(d.obras)atualizarObras({obras:d.obras,budget:d.budget||[],lancamentos:d.lancamentos||[]});
if(d.chamados)atualizarCham({chamados:d.chamados});
if(d.atividades)atualizarAtiv(d.atividades);
if(d.pessoas)atualizarCodin({pessoas:d.pessoas});
if(d.atividades_turno){CFG.atividades=d.atividades_turno;buildActs();}
if(d.logos){CFG.logos=d.logos;buildLogos();saveCFG();}
if(d.acoes){CFG.acoes=d.acoes;buildAcoes();}
if(d.identidade){CFG.identidade=Object.assign({},CFG.identidade,d.identidade);applyIdent();}
if(d.painelEsq){CFG.painelEsq=Object.assign({},CFG.painelEsq,d.painelEsq);buildVMO();}
  }catch(e){}
  const m=[
    {key:'obras',cache:'obras-dados-cache',fn:atualizarObras},
    {key:'cham',cache:'chamados-facilities-dados',fn:atualizarCham},
    {key:'ativ',cache:'hub-atividades',fn:a=>atualizarAtiv(JSON.parse(a))},
    {key:'codin',cache:'controle-acesso-dados',fn:atualizarCodin}
  ];
  m.forEach(({key,cache,fn})=>{
    const txt=localStorage.getItem('neu-cache-'+key)||localStorage.getItem(cache);
    const nm=localStorage.getItem('neu-name-'+key);
    if(!txt)return;
    if(nm)setFname(key,nm);setDot(key,true);
    try{fn(JSON.parse(txt));}catch(e){}
  });
}
window.loadCentral=()=>{
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();
    r.onload=e=>{try{
      const d=JSON.parse(e.target.result);
      localStorage.setItem('intranet-central',e.target.result);
      localStorage.setItem('neu-name-central',f.name);
const dot=$('fdot-central');if(dot)dot.style.background='var(--gn)';
const nm=$('fname-central');if(nm)nm.textContent=f.name;
      if(d.obras)atualizarObras({obras:d.obras,budget:d.budget||[],lancamentos:d.lancamentos||[]});
if(d.chamados)atualizarCham({chamados:d.chamados});
if(d.atividades)atualizarAtiv(d.atividades);
if(d.pessoas)atualizarCodin({pessoas:d.pessoas});
if(d.atividades_turno){CFG.atividades=d.atividades_turno;buildActs();}
if(d.logos){CFG.logos=d.logos;buildLogos();saveCFG();}
if(d.acoes){CFG.acoes=d.acoes;buildAcoes();}
if(d.identidade){CFG.identidade=Object.assign({},CFG.identidade,d.identidade);applyIdent();}
if(d.painelEsq){CFG.painelEsq=Object.assign({},CFG.painelEsq,d.painelEsq);buildVMO();}
if(d.gif){localStorage.setItem('hub-gif',d.gif);}
    }catch(ex){}};r.readAsText(f);};inp.click();
};
window.exportarImagens=()=>{
  const obj={
    logos:CFG.logos||['','','',''],
    gif:localStorage.getItem('hub-gif')||''
  };
  const b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='imagens.json';a.click();
};
window.loadImagens=()=>{
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();
    r.onload=e=>{try{
      const d=JSON.parse(e.target.result);
      if(d.logos){CFG.logos=d.logos;buildLogos();saveCFG();}
      if(d.gif){
        localStorage.setItem('hub-gif',d.gif);
        const img=$('video-gif');
        img.dataset.src=d.gif;
        img.removeAttribute('src');
        $('video-placeholder').style.display='none';
        gifLoaded=true;
        let cv=$('gif-canvas');
        if(!cv){cv=document.createElement('canvas');cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover';cv.id='gif-canvas';$('video-inner').insertBefore(cv,$('video-gif'));}
        const tmp=new Image();
        tmp.onload=()=>{cv.width=tmp.naturalWidth;cv.height=tmp.naturalHeight;cv.getContext('2d').drawImage(tmp,0,0);};
        tmp.src=d.gif;
      }
      const dot=$('fdot-imagens');if(dot)dot.style.background='var(--gn)';
      const nm=$('fname-imagens');if(nm)nm.textContent=f.name;
      localStorage.setItem('neu-name-imagens',f.name);
    }catch(ex){}};r.readAsText(f);};inp.click();
};
window.exportarCentral=()=>{
  const c=JSON.parse(localStorage.getItem('intranet-central')||'{}');
  if(CFG.logos&&CFG.logos.some(l=>l))c.logos=CFG.logos;
  c.atividades_turno=CFG.atividades;
  c.acoes=CFG.acoes;
  c.identidade=Object.assign({},c.identidade||{},CFG.identidade);
  c.painelEsq=Object.assign({},c.painelEsq||{},CFG.painelEsq);
  const b=new Blob([JSON.stringify(c,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='central.json';a.click();
};

// ── ANIMAÇÕES ──
setTimeout(()=>{document.querySelectorAll('[data-w]').forEach(el=>{el.style.transition='width 1s ease';el.style.width=el.getAttribute('data-w')+'%';});},400);
function syncCentral(){
  const c=JSON.parse(localStorage.getItem('intranet-central')||'{}');
  if(CFG.logos&&CFG.logos.some(l=>l))c.logos=CFG.logos;
  c.atividades_turno=CFG.atividades;
  c.acoes=CFG.acoes;
  c.identidade=Object.assign({},c.identidade||{},CFG.identidade);
  c.painelEsq=Object.assign({},c.painelEsq||{},CFG.painelEsq);
  const gif=localStorage.getItem('hub-gif');
  if(gif)c.gif=gif;
  try{
    localStorage.setItem('intranet-central',JSON.stringify(c));
  }catch(err){
    alert('Central.json muito grande para o localStorage. Use Exportar para salvar em arquivo.');
  }
}
// ── SAVE CFG ──
function saveCFG(){localStorage.setItem('hub-config',JSON.stringify(CFG));}

// ── INIT ──
applyIdent();
buildLogos();
buildActs();
buildKpiMini();
buildVidKpis();
buildAcoes();
buildVMO();
buildMetricsPanel();
loadCache();
window.addEventListener('storage', e => {
  const mapaInverso = {
    'obras-dados-cache': 'obras',
    'neu-cache-obras': 'obras',
    'chamados-facilities-dados': 'cham',
    'hub-atividades': 'ativ',
    'controle-acesso-dados': 'codin',
    'conforto-dados-cache': 'conforto',
    'neu-cache-conforto': 'conforto'
  };
  const mod = mapaInverso[e.key];
  if (!mod || !e.newValue) return;
  const ff = ffiles?.find ? ffiles.find(f => f.key === mod) : null;
  if (!ff) return;
  try {
    const d = JSON.parse(e.newValue);
    if (ff.fn) ff.fn(d);
    buildMetricsPanel();
  } catch(err) {}
});
if(typeof Neutralino!=='undefined'&&!window._ni){window._ni=true;Neutralino.init();}