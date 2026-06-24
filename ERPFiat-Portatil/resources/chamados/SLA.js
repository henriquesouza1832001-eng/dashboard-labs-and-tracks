// ── DEBUG BAR ──────────────────────────────────────────────
(function(){
  var _logs=[], _erros=0;
  function _bar(){ return document.getElementById('debug-bar'); }
  function _linha(tipo, msg, sub){
    var cor={err:'#f85149',warn:'#d29922',log:'#8b949e',info:'#58a6ff'}[tipo]||'#8b949e';
    _logs.push({tipo,msg,sub,ts:new Date().toLocaleTimeString()});
    var bar=_bar(); if(!bar)return;
    bar.style.display='flex';
    var linha=document.createElement('div');
    linha.style.cssText='display:flex;gap:8px;align-items:flex-start;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)';
    linha.innerHTML='<span style="color:'+cor+';font-size:10px;flex-shrink:0;min-width:36px">'+tipo.toUpperCase()+'</span>'+
      '<span style="color:#8b949e;font-size:10px;flex-shrink:0">'+new Date().toLocaleTimeString()+'</span>'+
      '<span style="color:'+cor+';flex:1;word-break:break-word">'+String(msg).replace(/</g,'&lt;')+'</span>'+
      (sub?'<span style="color:#555e6a;font-size:10px;flex-shrink:0">'+sub+'</span>':'');
    var body=document.getElementById('db-body');
    if(body){ body.appendChild(linha); body.scrollTop=body.scrollHeight; }
    if(tipo==='err'){
      _erros++;
      var badge=document.getElementById('db-badge');
      if(badge){badge.textContent=_erros;badge.style.display='inline-block';}
    }
  }
  // interceptar console
  ['log','warn','error','info'].forEach(function(t){
    var orig=console[t].bind(console);
    console[t]=function(){
      var args=Array.from(arguments).map(function(a){
        try{return typeof a==='object'?JSON.stringify(a):String(a);}catch{return String(a);}
      });
      orig.apply(console,arguments);
      _linha(t==='error'?'err':t==='warn'?'warn':t==='info'?'info':'log', args.join(' '));
    };
  });
  window.onerror=function(msg,src,line,col,err){
    var arquivo=src?src.split('/').pop():'?';
    _linha('err', msg, arquivo+':'+line);
    return false;
  };
  window.addEventListener('unhandledrejection',function(e){
    _linha('err','Promise: '+(e.reason&&e.reason.message?e.reason.message:String(e.reason)));
  });
  window._dbLog=function(msg,tipo){ _linha(tipo||'info',msg); };
  window._dbLogs=function(){ return _logs; };
})();
const $ = id => document.getElementById(id);
const SLA_KEY = 'chamados-sla-config';

const CATS = {
  INF: { label: 'Infraestrutura', prefix: 'INF', color: '#58a6ff' },
  ELE: { label: 'Elétrica',       prefix: 'ELE', color: '#d29922' },
  HID: { label: 'Hidráulica',     prefix: 'HID', color: '#3fb950' },
  LMP: { label: 'Limpeza',        prefix: 'LMP', color: '#bc8cff' },
  AR:  { label: 'Ar Cond.',       prefix: 'AR',  color: '#39c5cf' },
};
function lerSLA() {
  try { return JSON.parse(localStorage.getItem(SLA_KEY)) || {}; } catch(e) { return {}; }
}
function slaParaPrio(prio) {
  const sla = lerSLA();
  const pad = { 'Crítica':1, 'Alta':3, 'Média':5, 'Baixa':7 };
  return (sla[prio] || pad[prio] || 7);
}
function diasAberto(c) {
  const inicio = new Date(c.dataAbertura);
  const fim = c.dataConclusao ? new Date(c.dataConclusao) : new Date();
  return Math.max(0, (fim - inicio) / 86400000);
}
function dentroDeSLA(c) {
  return diasAberto(c) <= slaParaPrio(c.prioridade);
}
function salvarSLA() {
  const cfg = {
    'Crítica': parseInt($('sla-critica').value) || 1,
    'Alta':    parseInt($('sla-alta').value)    || 3,
    'Média':   parseInt($('sla-media').value)   || 5,
    'Baixa':   parseInt($('sla-baixa').value)   || 7,
  };
  localStorage.setItem(SLA_KEY, JSON.stringify(cfg));
  showToast('SLA salvo!');
  renderDashboard();
}
function carregarCamposSLA() {
  const sla = lerSLA();
  $('sla-critica').value = sla['Crítica'] || 1;
  $('sla-alta').value    = sla['Alta']    || 3;
  $('sla-media').value   = sla['Média']   || 5;
  $('sla-baixa').value   = sla['Baixa']   || 7;
}
let allChamados    = [];
let filteredList   = [];
let activeStatus   = '';
let activeCat      = '';
let activePrio     = '';
let currentId      = null;  
let fileHandle     = null;   
let novasFotos     = [];    
let editFotos      = [];     
