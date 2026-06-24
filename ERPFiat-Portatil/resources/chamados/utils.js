function fmtDate(iso) {
  if (!iso) return '–';
  try { return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}
function fmtDateShort(iso) {
  if (!iso) return '–';
  try { return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }); }
  catch { return iso; }
}
function statusClass(s) {
  const m = { 'Aberto':'s-aberto','Em Andamento':'s-andamento','Concluído':'s-concluido','Cancelado':'s-cancelado' };
  return m[s] || '';
}
function prioClass(p) {
  const m = { 'Baixa':'p-baixa','Média':'p-media','Alta':'p-alta','Crítica':'p-critica' };
  return m[p] || '';
}
let toastTimer;
function showToast(msg, type='ok') {
  const t = $('toast');
  t.className = `toast ${type} show`;
  $('toast-msg').textContent = msg;
  $('toast-icon').innerHTML = type === 'ok'
    ? '<polyline points="20 6 9 17 4 12"/>'
    : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
function setSave(state, label) {
  const el = $('save-status');
  el.className = 'save-status ' + state;
  $('save-label').textContent = label;
}
function lerPath() { return localStorage.getItem(STORAGE_KEY); }
function salvarPath(v) { localStorage.setItem(STORAGE_KEY, v); }
async function salvarArquivo() {
  const txt = JSON.stringify({ chamados: allChamados }, null, 2);
  localStorage.setItem(DATA_KEY, txt);
  setSave('saved', 'cache local');
}
function abrirArquivo() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = e => {
      try {
        const d = JSON.parse(e.target.result);
        allChamados = d.chamados || (Array.isArray(d) ? d : []);
        localStorage.setItem(DATA_KEY, e.target.result);
        setSave('saved', f.name);
        atualizarContadores();
        aplicarFiltros();
        showToast(`${allChamados.length} chamado(s) carregado(s)`);
      } catch(err) { showToast('Erro ao ler o arquivo.', 'err'); }
    };
    r.readAsText(f);
  };
  inp.click();
}
async function carregarDoArquivo() {
  try {
    const txt = await Neutralino.filesystem.readFile(fileHandle);
    const json = JSON.parse(txt);
    allChamados = json.chamados || [];
    setSave('saved','salvo');
    atualizarContadores();
    aplicarFiltros();
    showToast(`${allChamados.length} chamado(s) carregado(s)`);
  } catch(e) {
    allChamados = [];
    setSave('saved','arquivo novo');
    atualizarContadores();
    aplicarFiltros();
  }
}

function tentarCarregarCache() {
  const txt = localStorage.getItem(DATA_KEY);
  if (!txt) { setSave('saved', 'pronto'); renderTabela(); return; }
  try {
    const json = JSON.parse(txt);
    allChamados = json.chamados || [];
    setSave('saved', 'cache local');
    atualizarContadores();
    atualizarBadgeFiltroAtivo();
    aplicarFiltros();
  } catch(e) {
    setSave('nosave', 'erro ao ler');
    renderTabela();
  }
}
function atualizarContadores() {
  const hoje = new Date().toDateString();
  $('cnt-todos').textContent     = allChamados.length;
  $('cnt-aberto').textContent    = allChamados.filter(c=>c.status==='Aberto').length;
  $('cnt-andamento').textContent = allChamados.filter(c=>c.status==='Em Andamento').length;
  $('cnt-concluido').textContent = allChamados.filter(c=>c.status==='Concluído').length;
  $('cnt-cancelado').textContent = allChamados.filter(c=>c.status==='Cancelado').length;
  $('cnt-call').textContent      = allChamados.length;
  Object.keys(CATS).forEach(k => {
    const el = $('cnt-'+k);
    if (el) el.textContent = allChamados.filter(c=>c.categoria===k).length;
  });
  $('cnt-critica').textContent = allChamados.filter(c=>c.prioridade==='Crítica').length;
  $('cnt-alta').textContent    = allChamados.filter(c=>c.prioridade==='Alta').length;
  $('cnt-media').textContent   = allChamados.filter(c=>c.prioridade==='Média').length;
  $('cnt-baixa').textContent   = allChamados.filter(c=>c.prioridade==='Baixa').length;
  $('stat-hoje').textContent      = allChamados.filter(c=>c.dataAbertura && new Date(c.dataAbertura).toDateString()===hoje).length;
  $('stat-andamento').textContent = allChamados.filter(c=>c.status==='Em Andamento').length;
  $('stat-criticos').textContent  = allChamados.filter(c=>c.prioridade==='Crítica' && c.status==='Aberto').length;
  $('stat-sem-resp').textContent  = allChamados.filter(c=>!c.responsavel).length;
}
tentarCarregarCache();