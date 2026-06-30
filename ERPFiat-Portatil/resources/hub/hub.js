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

let gifLoaded=false;
const savedGif = CFG.gif || null;
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
  const img=$('video-gif');
  img.dataset.src=src;
  img.src='';
  img.classList.add('loaded');
  $('video-placeholder').style.display='none';
  gifLoaded=true;
  CFG.gif = src;
  saveCFG();
};r.readAsDataURL(f);};inp.click();});

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

function setKpi(i,val,sub,bar){
  const update=prefix=>{
    const v=$(prefix+'kpi-val-'+i);const s=$(prefix+'kpi-sub-'+i);const b=$(prefix+'kpi-bar-'+i);
    if(v)v.textContent=val;if(s)s.textContent=sub;if(b){b.style.transition='width .8s ease';b.style.width=Math.min(bar,100)+'%';}
  };
  update('');update('mp-');
  if(CFG.kpisMini[i]){CFG.kpisMini[i].val=val;CFG.kpisMini[i].sub=sub;CFG.kpisMini[i].bar=bar;}
  buildVidKpis();
}

function preencherModCards(d){
  const obraInfo = d.obras || {};
  const chamInfo = d.chamados || {};
  const cardObras = document.querySelector('a[href="/obras"] .mod-card-sub');
  if (cardObras && obraInfo.total != null) cardObras.textContent = obraInfo.total + ' cadastradas';
  const cardCham = document.querySelector('a[href="/chamados"] .mod-card-sub');
  if (cardCham && chamInfo.total != null) cardCham.textContent = chamInfo.abertos + ' em aberto · ' + chamInfo.total + ' total';
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
  const d = await API.hub.dados();
  if(d.obras) {
    setKpi(0, d.obras.andamento, d.obras.total + ' cadastradas', d.obras.total ? Math.round(d.obras.andamento/d.obras.total*100) : 0);
    setKpi(3, d.obras.gasto_total ? (Math.round(d.obras.gasto_total/1000)+'k') : '—', 'budget executado', 0);
  }
  if(d.chamados) {
    setKpi(1, d.chamados.abertos, d.chamados.total + ' total', d.chamados.total ? Math.round(d.chamados.abertos/d.chamados.total*100) : 0);
  }
  preencherModCards(d);
}
loadCache();