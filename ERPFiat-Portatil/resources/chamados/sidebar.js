function toggleSection(id) {
  document.getElementById(id)?.classList.toggle('collapsed');
}

function atualizarBadgeFiltroAtivo() {
  const badge = document.getElementById('sb-filtro-ativo');
  const txt   = document.getElementById('sb-filtro-txt');
  const partes = [];
  if (activeStatus) partes.push(activeStatus);
  if (activeCat)    partes.push(CATS[activeCat]?.label || activeCat);
  if (activePrio)   partes.push(activePrio);
  if (partes.length) {
    txt.textContent = partes.join(' · ');
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
  // destaque visual nos resumos
  const criticos = parseInt(document.getElementById('stat-criticos')?.textContent || '0');
  const semResp  = parseInt(document.getElementById('stat-sem-resp')?.textContent  || '0');
  const rowC = document.getElementById('row-criticos');
  const rowR = document.getElementById('row-semresp');
  if (rowC) rowC.style.opacity = criticos > 0 ? '1' : '.4';
  if (rowR) rowR.style.opacity = semResp  > 0 ? '1' : '.4';
}

function limparTodosFiltros() {
  activeStatus = ''; activeCat = ''; activePrio = '';
  document.querySelectorAll('[data-filter="status"]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('[data-filter="cat"]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('[data-filter="prio"]').forEach(b => b.classList.remove('active'));
  // reativa "Todos" no status
  const todos = document.querySelector('[data-filter="status"][data-val=""]');
  if (todos) todos.classList.add('active');
  document.getElementById('sb-filtro-ativo').style.display = 'none';
  aplicarFiltros();
}