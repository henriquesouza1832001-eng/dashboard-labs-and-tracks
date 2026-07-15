const CATS = {
  INF: { label: 'Infraestrutura', color: '#58a6ff' },
  ELE: { label: 'Elétrica',       color: '#d29922' },
  HID: { label: 'Hidráulica',     color: '#3fb950' },
  LMP: { label: 'Limpeza',        color: '#bc8cff' },
  AR:  { label: 'Ar Cond.',       color: '#39c5cf' },
};

const $ = id => document.getElementById(id);

let allChamados  = [];
let filteredList = [];
let activeStatus = '';
let activeCat    = '';
let currentId    = null;
let idsCienciados = new Set(); 
carregar('chamados', () => API.chamados.listar(), d => {
  allChamados = d.chamados || [];
  atualizarContadores();
  aplicarFiltros();
});
verificarPermissaoNotif();

function fmtDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtDateShort(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function statusClass(s) {
  return { 'Aberto':'s-aberto','Em Andamento':'s-andamento','Concluído':'s-concluido','Cancelado':'s-cancelado' }[s] || '';
}
function prioClass(p) {
  return { 'Baixa':'p-baixa','Média':'p-media','Alta':'p-alta','Crítica':'p-critica' }[p] || '';
}
let _toastT;
function showToast(msg, type='ok') {
  const t = $('toast');
  t.className = `toast ${type} show`;
  $('toast-msg').textContent = msg;
  $('toast-icon').innerHTML = type === 'ok'
    ? '<polyline points="20 6 9 17 4 12"/>'
    : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove('show'), 3500);
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
  $('stat-hoje').textContent      = allChamados.filter(c=>c.dataAbertura && new Date(c.dataAbertura).toDateString()===hoje).length;
  $('stat-andamento').textContent = allChamados.filter(c=>c.status==='Em Andamento').length;
  $('stat-criticos').textContent  = allChamados.filter(c=>c.prioridade==='Crítica' && c.status==='Aberto').length;
  $('stat-sem-resp').textContent  = allChamados.filter(c=>!c.responsavel && c.status==='Aberto').length;
}

function aplicarFiltros() {
  const q = ($('search-input')?.value||'').toLowerCase();
  const filtroDt = $('filtro-data')?.value||'';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate()-hoje.getDay());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  filteredList = allChamados.filter(c => {
    if (activeStatus && c.status !== activeStatus) return false;
    if (activeCat    && c.categoria !== activeCat) return false;
    if (filtroDt) {
      const dt = c.dataAbertura ? new Date(c.dataAbertura) : null;
      if (!dt) return false;
      if (filtroDt === 'hoje'    && dt < hoje) return false;
      if (filtroDt === 'semana'  && dt < inicioSemana) return false;
      if (filtroDt === 'mes'     && dt < inicioMes) return false;
      if (filtroDt === 'atrasado' && (dentroDeSLA(c) || c.status === 'Concluído' || c.status === 'Cancelado')) return false;
    }
    if (q) {
      const hay = [c.id, c.titulo, c.local, c.setor, c.solicitante, c.responsavel, c.idExterno].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  renderTabela();
}

function renderTabela() {
  const tbody = $('chamados-tbody');
  if (!filteredList.length) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Nenhum chamado encontrado.</p>
      </div>
    </td></tr>`;
    return;
  }
  const ordenar = $('ordenar-por')?.value || 'data-desc';
  const ordemStatus = { 'Aberto':0,'Em Andamento':1,'Cancelado':2,'Concluído':3 };
  const sorted = [...filteredList].sort((a,b) => {
    if (ordenar === 'prio') { const pm={'Crítica':0,'Alta':1,'Média':2,'Baixa':3}; return (pm[a.prioridade]??9)-(pm[b.prioridade]??9); }
    if (ordenar === 'sla')      return diasAberto(b)-diasAberto(a);
    if (ordenar === 'data-asc') return new Date(a.dataAbertura)-new Date(b.dataAbertura);
    const d = (ordemStatus[a.status]??9)-(ordemStatus[b.status]??9);
    return d !== 0 ? d : new Date(b.dataAbertura)-new Date(a.dataAbertura);
  });

  // Identifica IDs "novos" (últimos 30 min)
  const agora = Date.now();
  const novosKey30 = new Set(
    allChamados
      .filter(c => c.dataAbertura && (agora - new Date(c.dataAbertura).getTime()) < 30*60*1000 && c.status === 'Aberto')
      .map(c => c.id)
  );

  tbody.innerHTML = sorted.map(c => {
    const cat = CATS[c.categoria] || { label: c.categoria, color: '#8b949e' };
    const dias = Math.floor(diasAberto(c));
    const slaMax = slaParaPrio(c.prioridade);
    const pctSLA = Math.round(dias/slaMax*100);
    let slaTxt, slaCls;
    if (c.status === 'Concluído' || c.status === 'Cancelado') { slaTxt='—'; slaCls='sla-ok'; }
    else if (pctSLA>=100) { slaTxt=`${dias}d ⚠`; slaCls='sla-out'; }
    else if (pctSLA>=70)  { slaTxt=`${dias}d`;   slaCls='sla-warn'; }
    else                  { slaTxt=`${dias}d`;   slaCls='sla-ok'; }
    const localSetor = [c.local, c.setor].filter(Boolean).join(' · ');
    const rowClass = c.prioridade === 'Crítica' && (c.status==='Aberto'||c.status==='Em Andamento') ? 'row-critica' : '';
    const badgeNovo = novosKey30.has(c.id) ? '<span class="badge-novo">NOVO</span>' : '';
    return `<tr data-id="${c.id}" class="${rowClass}">
      <td><span class="id-badge">${c.id}</span></td>
      <td style="max-width:200px">
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.titulo||'–'}${badgeNovo}</div>
        ${c.tipo?`<span class="tipo-badge">${c.tipo}</span>`:''}
      </td>
      <td><span class="cat-badge"><span class="cat-dot c-${c.categoria}"></span>${cat.label}</span></td>
      <td style="font-size:12px;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${localSetor||'–'}</td>
      <td><span class="status-badge ${statusClass(c.status)}"><span class="dot"></span>${c.status}</span></td>
      <td><span class="prio-badge ${prioClass(c.prioridade)}">${c.prioridade}</span></td>
      <td><span class="${slaCls}">${slaTxt}</span></td>
      <td style="font-size:12px;color:${c.responsavel?'var(--text)':'var(--red)'}">${c.responsavel||'<span style="font-size:11px;color:var(--red)">⚠ sem resp.</span>'}</td>
      <td style="color:var(--text-muted);font-size:12px;font-family:var(--mono)">${fmtDateShort(c.dataAbertura)}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => abrirModal(tr.dataset.id));
  });
}

function abrirModal(id) {
  const c = allChamados.find(x => x.id === id);
  if (!c) return;
  currentId = id;

  const cat = CATS[c.categoria] || { label: c.categoria };
  $('mv-titulo').textContent       = c.titulo || '–';
  $('mv-id').textContent           = c.id;
  $('mv-subtitle').textContent     = `${cat.label} • ${c.local||'–'} • ${c.solicitante?'por '+c.solicitante:'solicitante não informado'}`;
  $('mv-data').textContent         = fmtDate(c.dataAbertura);
  $('mv-cat-info').textContent     = cat.label;
  $('mv-local-info').textContent   = [c.local, c.setor].filter(Boolean).join(' · ') || '–';
  $('mv-solicitante-info').textContent = c.solicitante || '–';
  $('mv-prio-info').textContent    = c.prioridade || '–';
  $('mv-desc-box').textContent     = c.descricao || '–';

  $('mv-status').value       = c.status || 'Aberto';
  $('mv-responsavel').value  = c.responsavel || '';
  $('mv-idext').value        = c.idExterno || '';
  $('mv-dataconclusao').value= c.dataConclusao ? c.dataConclusao.substring(0,16) : '';
  $('mv-obs').value          = '';

  // Fotos readonly
  const fotosSec = $('mv-fotos-section');
  const fotosWrap = $('mv-fotos-readonly');
  if (c.fotos && c.fotos.length) {
    fotosSec.style.display = '';
    fotosWrap.innerHTML = c.fotos.map(b64 =>
      `<div class="foto-readonly-thumb" onclick="abrirFotoViewer('${b64}')"><img src="${b64}"></div>`
    ).join('');
  } else {
    fotosSec.style.display = 'none';
  }

  // Timeline
  const tl = $('mv-timeline');
  const hist = c.historico || [];
  if (!hist.length) {
    tl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">Sem histórico.</div>';
  } else {
    tl.innerHTML = [...hist].reverse().map((h,i,arr) => `
      <div class="tl-item">
        <div class="tl-dot-col">
          <div class="tl-dot" style="background:${h.cor||'var(--blue-mid)'}"></div>
          ${i < arr.length-1 ? '<div class="tl-line"></div>' : ''}
        </div>
        <div class="tl-content">
          <div class="tl-action">${h.acao}</div>
          ${h.obs ? `<div style="color:var(--text-muted);font-size:12px;margin-top:3px">${h.obs}</div>` : ''}
          <div class="tl-meta">${fmtDate(h.data)}</div>
        </div>
      </div>
    `).join('');
  }

  $('modal-ver').classList.add('open');

  // Marca como lido
  marcarComoLido(id);
}

function fecharModal() {
  $('modal-ver').classList.remove('open');
  currentId = null;
}

function salvarModal() {
  if (!currentId) return;
  const idx = allChamados.findIndex(c => c.id === currentId);
  if (idx < 0) return;
  const c = allChamados[idx];

  const novoStatus = $('mv-status').value;
  const respNovo   = $('mv-responsavel').value.trim();
  const extNovo    = $('mv-idext').value.trim();
  const obs        = $('mv-obs').value.trim();

  const ent = [];
  if (novoStatus !== c.status)         ent.push(`Status: ${c.status} → ${novoStatus}`);
  if (respNovo !== (c.responsavel||'')) ent.push(`Responsável: ${respNovo||'–'}`);
  if (extNovo !== (c.idExterno||''))    ent.push(`ID Externo: ${extNovo}`);

  const corMap = { 'Aberto':'#58a6ff','Em Andamento':'#d29922','Concluído':'#3fb950','Cancelado':'#8b949e' };
  if (ent.length || obs) {
    const historico = c.historico || [];
    historico.push({ data: new Date().toISOString(), acao: ent.length ? ent.join(' · ') : 'Observação adicionada', obs: obs||'', cor: corMap[novoStatus]||'var(--blue-mid)' });
    c.historico = historico;
  }

  c.status      = novoStatus;
  c.responsavel = respNovo;
  c.idExterno   = extNovo;
  c.dataConclusao = $('mv-dataconclusao').value ? new Date($('mv-dataconclusao').value).toISOString() : c.dataConclusao;

  await API.chamados.atualizar(c.id, c);
  API.invalidar('/chamados');
  atualizarContadores();
  aplicarFiltros();
  fecharModal();
  showToast('Chamado atualizado!');
}


function abrirFotoViewer(src) {
  $('foto-viewer-img').src = src;
  $('foto-viewer').classList.add('open');
}


let _snapshotIds = new Set(allChamados.map(c => c.id));

async function poll() {
  try {
    API.invalidar('/chamados');
    const d = await API.chamados.listar();
    const lista = d.chamados || [];
    const novosIds = lista.map(c => c.id).filter(id => !_snapshotIds.has(id));
    if (novosIds.length) {
      novosIds.forEach(id => _snapshotIds.add(id));
      allChamados = lista;
      atualizarContadores();
      aplicarFiltros();
      notificarNovos(novosIds, lista);
    }
    const now = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    $('poll-label').textContent = 'atualizado ' + now;
  } catch {}
}
setInterval(poll, 30000);

function notificarNovos(ids, lista) {
  const banner = $('notif-banner');
  const txt = ids.length === 1 ? 'Novo chamado registrado!' : `${ids.length} novos chamados registrados!`;
  $('notif-txt').textContent = txt;
  $('notif-ids').textContent = ids.join(', ');
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 10000);

  // Notification API
  if (Notification.permission === 'granted') {
    ids.forEach(id => {
      const c = lista.find(x => x.id === id);
      new Notification(`📋 Novo chamado: ${id}`, {
        body: `${c?.titulo||'–'} · ${c?.local||'–'}`,
        icon: ''
      });
    });
  }

  showToast(`${ids.length > 1 ? ids.length + ' novos chamados' : 'Novo chamado ' + ids[0]}!`);
}

function focarNovos() {
  activeStatus = 'Aberto';
  document.querySelectorAll('[data-filter="status"]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('[data-filter="status"][data-val="Aberto"]');
  if (btn) btn.classList.add('active');
  atualizarBadgeFiltro();
  aplicarFiltros();
  fecharBanner();
}
function fecharBanner() { $('notif-banner').classList.remove('show'); }

function verificarPermissaoNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    $('notif-perm-box').style.display = 'flex';
  }
}
function pedirPermissao() {
  Notification.requestPermission().then(p => {
    $('notif-perm-box').style.display = 'none';
    if (p === 'granted') showToast('Notificações ativadas!');
    else showToast('Notificações negadas pelo browser.', 'err');
  });
}

document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.filter;
    const val  = btn.dataset.val;
    document.querySelectorAll(`[data-filter="${type}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (type === 'status') activeStatus = val;
    if (type === 'cat')    activeCat    = val;
    atualizarBadgeFiltro();
    aplicarFiltros();
  });
});

function atualizarBadgeFiltro() {
  const badge = $('sb-filtro-ativo');
  const txt   = $('sb-filtro-txt');
  const partes = [];
  if (activeStatus) partes.push(activeStatus);
  if (activeCat)    partes.push(CATS[activeCat]?.label || activeCat);
  if (partes.length) { txt.textContent = partes.join(' · '); badge.style.display = 'flex'; }
  else badge.style.display = 'none';
}

function limparFiltros() {
  activeStatus = ''; activeCat = '';
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
  const todos = document.querySelector('[data-filter="status"][data-val=""]');
  if (todos) todos.classList.add('active');
  $('sb-filtro-ativo').style.display = 'none';
  aplicarFiltros();
}

$('search-input').addEventListener('input', aplicarFiltros);
$('filtro-data').addEventListener('change', aplicarFiltros);
$('ordenar-por').addEventListener('change', renderTabela);

$('mv-close').addEventListener('click', fecharModal);
$('mv-cancelar').addEventListener('click', fecharModal);
$('mv-salvar').addEventListener('click', salvarModal);
$('modal-ver').addEventListener('click', e => { if (e.target === $('modal-ver')) fecharModal(); });
$('foto-viewer-close').addEventListener('click', () => $('foto-viewer').classList.remove('open'));
$('foto-viewer').addEventListener('click', e => { if (e.target === $('foto-viewer')) $('foto-viewer').classList.remove('open'); });
