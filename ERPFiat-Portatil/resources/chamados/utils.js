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
async function tentarCarregarCache() {
  try {
    const r = await fetch('/api/chamados');
    const d = await r.json();
    allChamados = d.chamados || [];
    setSave('saved', 'carregado');
    atualizarContadores();
    atualizarBadgeFiltroAtivo();
    aplicarFiltros();
  } catch(e) {
    setSave('nosave', 'erro ao carregar');
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