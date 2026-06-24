'use strict';
const $=id=>document.getElementById(id);

const DEFAULT={
  identidade:{brand:'Controler',brandEnv:'ERP Facilities',instNome:'Stellantis Brasil',instSub:'Infraestrutura Facilities',instBadge:'ISO 55001',userName:'Carlos Souza',userRole:'Gerente Facilities'},
  painelEsq:{valores:'Excelência Operacional · Segurança · Sustentabilidade',objetivo:'Zero paradas não planejadas. Redução 30% no consumo energético.',objProg:68,objPrazo:'Dez/2026',missao:'Infraestrutura segura, eficiente e sustentável para operações de classe mundial.',metas:['Manutenção preventiva ≥ 95%','Redução chamados corretivos -15%','Conformidade NR-12: 100%']},
  layout:{acoesVisiveis:true,vmoVisivel:true,sidebarVisivel:true,sidebarEstado:'expanded'},
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

let CFG=JSON.parse(JSON.stringify(DEFAULT));
const saved=localStorage.getItem('hub-config');
if(saved)try{CFG=Object.assign({},DEFAULT,JSON.parse(saved));}catch(e){}

// ── NAV ──
document.querySelectorAll('.nav-item[data-page]').forEach(btn=>{
  btn.addEventListener('click',function(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    this.classList.add('active');
    $('page-'+this.dataset.page).classList.add('active');
  });
});

// ── LOGOS ──
function buildLogosGrid(){
  const logos=CFG.logos||['','','',''];
  $('cfg-logos-grid').innerHTML=logos.map((src,i)=>`
    <div class="logo-slot-cfg" id="lslot-${i}">
      <img id="lcfg-img-${i}" class="${src?'has':''}" src="${src||''}" alt="">
      ${!src?`<span>Logo ${i+1}</span>`:''}
      ${src?`<button class="logo-clear" onclick="clearLogo(${i});event.stopPropagation()">✕</button>`:''}
      <input type="file" accept="image/*" onchange="uploadLogo(${i},this)">
    </div>`).join('');
}
window.uploadLogo=(i,inp)=>{
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{CFG.logos[i]=e.target.result;buildLogosGrid();};
  r.readAsDataURL(f);
};
window.clearLogo=i=>{CFG.logos[i]='';buildLogosGrid();};

// ── POPULATE FORMS ──
function populate(){
  const id=CFG.identidade||{};
  ['brand','brandEnv','instNome','instSub','instBadge','userName','userRole'].forEach(k=>{const e=$('id-'+k);if(e)e.value=id[k]||'';});
  const pe=CFG.painelEsq||{};
  $('vmo-valores').value=pe.valores||'';
  $('vmo-objetivo').value=pe.objetivo||'';
  $('vmo-prog').value=pe.objProg||0;
  $('vmo-prazo').value=pe.objPrazo||'';
  $('vmo-missao').value=pe.missao||'';
  $('vmo-metas').value=(pe.metas||[]).join('\n');
  const ly=CFG.layout||{};
  $('ly-acoes').checked=ly.acoesVisiveis!==false;
  $('ly-vmo').checked=ly.vmoVisivel!==false;
  $('ly-sidebar').checked=ly.sidebarVisivel!==false;
  $('ly-sbEstado').value=ly.sidebarEstado||'expanded';
  buildLogosGrid();
  buildAcoesList();
  buildAtvList();
}

// ── AÇÕES ──
function buildAcoesList(){
  $('acoes-list').innerHTML=(CFG.acoes||[]).map((a,i)=>`
    <div class="list-item">
      <div class="st-dot st-${a.status}"></div>
      <input type="text" value="${a.titulo||''}" placeholder="Título" style="flex:2" onchange="CFG.acoes[${i}].titulo=this.value">
      <select onchange="CFG.acoes[${i}].status=this.value">
        ${['plan','prog','urg','rev'].map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${s==='plan'?'Plan.':s==='prog'?'And.':s==='urg'?'Urg.':'Rev.'}</option>`).join('')}
      </select>
      <input type="text" value="${a.prazo||''}" placeholder="Prazo" style="width:90px" onchange="CFG.acoes[${i}].prazo=this.value">
      <input type="text" value="${a.resp||''}" placeholder="Resp" style="width:46px;text-transform:uppercase" onchange="CFG.acoes[${i}].resp=this.value">
      <label class="tog" style="flex-shrink:0"><input type="checkbox" ${a.visivel!==false?'checked':''} onchange="CFG.acoes[${i}].visivel=this.checked"><div class="tog-sl"></div></label>
      <button class="btn-rm" onclick="CFG.acoes.splice(${i},1);buildAcoesList()">✕</button>
    </div>`).join('');
}
$('btn-add-acao').onclick=()=>{CFG.acoes.push({titulo:'Nova ação',status:'plan',prazo:'',resp:'',visivel:true});buildAcoesList();};

// ── ATIVIDADES ──
function buildAtvList(){
  $('atv-list').innerHTML=(CFG.atividades||[]).map((a,i)=>`
    <div class="list-item">
      <select onchange="CFG.atividades[${i}].estado=this.value" style="width:72px">
        <option value="" ${a.estado===''?'selected':''}>—</option>
        <option value="pend" ${a.estado==='pend'?'selected':''}>Pend.</option>
        <option value="done" ${a.estado==='done'?'selected':''}>Feito</option>
      </select>
      <input type="text" value="${a.texto||''}" onchange="CFG.atividades[${i}].texto=this.value">
      <input type="text" value="${a.ptxt||''}" placeholder="Label" style="width:60px" onchange="CFG.atividades[${i}].ptxt=this.value">
      <select onchange="CFG.atividades[${i}].prio=this.value" style="width:68px">
        <option value="ph" ${a.prio==='ph'?'selected':''}>Alta</option>
        <option value="pm" ${a.prio==='pm'?'selected':''}>Média</option>
        <option value="pl" ${a.prio==='pl'?'selected':''}>Baixa</option>
      </select>
      <button class="btn-rm" onclick="CFG.atividades.splice(${i},1);buildAtvList()">✕</button>
    </div>`).join('');
}
$('btn-add-atv').onclick=()=>{CFG.atividades.push({texto:'Nova tarefa',estado:'',prio:'pm',ptxt:'HOJ'});buildAtvList();};

// ── COLLECT ──
function collect(){
  const id=CFG.identidade=CFG.identidade||{};
  ['brand','brandEnv','instNome','instSub','instBadge','userName','userRole'].forEach(k=>{const e=$('id-'+k);if(e)id[k]=e.value;});
  const pe=CFG.painelEsq=CFG.painelEsq||{};
  pe.valores=$('vmo-valores').value;pe.objetivo=$('vmo-objetivo').value;
  pe.objProg=+$('vmo-prog').value||0;pe.objPrazo=$('vmo-prazo').value;
  pe.missao=$('vmo-missao').value;
  pe.metas=$('vmo-metas').value.split('\n').map(s=>s.trim()).filter(Boolean);
  CFG.layout={
    acoesVisiveis:$('ly-acoes').checked,
    vmoVisivel:$('ly-vmo').checked,
    sidebarVisivel:$('ly-sidebar').checked,
    sidebarEstado:$('ly-sbEstado').value
  };
}

// ── TOAST ──
function toast(msg){const t=$('toast');t.textContent=msg||'Salvo!';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}

// ── BOTÕES ──
$('btn-sal').onclick=()=>{collect();localStorage.setItem('hub-config',JSON.stringify(CFG));toast('Configuração salva!');if(window.opener&&!window.opener.closed)window.opener.location.reload();};
$('btn-exp').onclick=()=>{collect();const b=new Blob([JSON.stringify(CFG,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='hub-config.json';a.click();};
$('btn-imp').onclick=()=>{const i=document.createElement('input');i.type='file';i.accept='.json';i.onchange=()=>{if(!i.files[0])return;const r=new FileReader();r.onload=e=>{try{CFG=JSON.parse(e.target.result);localStorage.setItem('hub-config',JSON.stringify(CFG));populate();toast('Importado!');}catch(ex){alert('JSON inválido.');}};r.readAsText(i.files[0]);};i.click();};
$('btn-rst').onclick=()=>{if(!confirm('Resetar tudo para o padrão?'))return;CFG=JSON.parse(JSON.stringify(DEFAULT));localStorage.removeItem('hub-config');populate();toast('Resetado!');};

// ── INIT ──
populate();