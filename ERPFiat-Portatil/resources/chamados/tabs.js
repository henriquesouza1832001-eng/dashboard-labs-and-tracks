let chartInstances = {};
function setTab(tab) {
  ['lista','dash','config'].forEach(t => {
    const btn = document.getElementById('tab-'+t);
    const view = document.getElementById('view-'+t);
    if(btn) btn.classList.toggle('active', tab === t);
    if(view) view.style.display = tab === t ? '' : 'none';
  });
  const ws = document.getElementById('wrap-search');
  if(ws) ws.style.display = tab === 'lista' ? '' : 'none';
  const ft = document.getElementById('filtro-data');
  const fti = document.getElementById('filtro-tipo');
  const fo = document.getElementById('ordenar-por');
  [ft,fti,fo].forEach(el => { if(el) el.style.display = tab === 'lista' ? '' : 'none'; });
  if (tab === 'dash')   renderDashboard();
  if (tab === 'config') carregarCamposSLA();
}