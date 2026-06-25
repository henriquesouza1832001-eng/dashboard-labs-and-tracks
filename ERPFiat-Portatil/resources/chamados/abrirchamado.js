function abrirModalNovo() {
  novasFotos = [];
  $('mn-titulo').value      = '';
  $('mn-cat').value         = '';
  $('mn-prio').value        = 'Média';
  $('mn-local').value       = '';
  if($('mn-setor'))         $('mn-setor').value = '';
  if($('mn-tipo'))          $('mn-tipo').value  = '';
  if($('mn-data-desejada')) $('mn-data-desejada').value = '';
  if($('mn-resp-sugerido')) $('mn-resp-sugerido').value = '';
  $('mn-solicitante').value = '';
  $('mn-desc').value        = '';
  renderFotosGrid('mn-fotos-grid', novasFotos, 'mn-add-foto', false);
  $('modal-novo').classList.add('open');
  setTimeout(() => $('mn-titulo').focus(), 100);
}

function fecharModalNovo() {
  $('modal-novo').classList.remove('open');
  novasFotos = [];
}

async function registrarChamado() {
  const titulo = $('mn-titulo').value.trim();
  const cat    = $('mn-cat').value;
  const local  = $('mn-local').value.trim();
  const desc   = $('mn-desc').value.trim();
  if (!titulo || !cat || !local || !desc) {
    showToast('Preencha título, categoria, local e descrição.', 'err');
    return;
  }
  const id = gerarId(cat);
  const novo = {
    id,
    titulo,
    categoria: cat,
    tipo: $('mn-tipo')?.value||'',
    prioridade: $('mn-prio').value,
    local,
    setor: $('mn-setor')?.value.trim()||'',
    solicitante: $('mn-solicitante').value.trim(),
    dataDesejada: $('mn-data-desejada')?.value||'',
    descricao: desc,
    status: 'Aberto',
    responsavel: $('mn-resp-sugerido')?.value.trim()||'',
    idExterno: '',
    dataAbertura: new Date().toISOString(),
    dataConclusao: null,
    fotos: [...novasFotos],
    historico: [{
      data: new Date().toISOString(),
      acao: 'Chamado aberto',
      obs: desc,
      cor: '#58a6ff'
    }]
  };
  await API.chamados.criar(novo);
  API.invalidar('/chamados');
  const dados = await API.chamados.listar();
  allChamados = dados.chamados || [];
  atualizarContadores();
  aplicarFiltros();
  fecharModalNovo();
  showToast(`Chamado ${id} registrado!`);
}
function abrirModalVer(id) {
  const c = allChamados.find(x => x.id === id);
  if (!c) return;
  currentId = id;
  editFotos = c.fotos ? [...c.fotos] : [];

  const cat = CATS[c.categoria] || { label: c.categoria };
  $('mv-titulo').textContent    = c.titulo || '–';
  $('mv-id').textContent        = c.id;
  $('mv-subtitle').textContent  = `${cat.label} • ${c.local || '–'} • aberto por ${c.solicitante || 'desconhecido'}`;
  $('mv-data').textContent      = fmtDate(c.dataAbertura);
  $('mv-cat').value             = c.categoria || '';
  $('mv-local').value           = c.local || '';
  $('mv-desc').value            = c.descricao || '';
  if($('mv-titulo-edit')) $('mv-titulo-edit').value = c.titulo || '';
  $('mv-status').value          = c.status || 'Aberto';
  $('mv-prio').value            = c.prioridade || 'Média';
  $('mv-responsavel').value     = c.responsavel || '';
  $('mv-idext').value           = c.idExterno || '';
  $('mv-dataconclusao').value   = c.dataConclusao ? c.dataConclusao.substring(0,16) : '';
  if($('mv-tipo'))          $('mv-tipo').value = c.tipo||'';
  if($('mv-data-desejada')) $('mv-data-desejada').value = c.dataDesejada||'';
  $('mv-obs').value             = '';

  renderFotosGrid('mv-fotos-grid', editFotos, 'mv-add-foto', true);
  renderTimeline(c.historico || []);
  $('modal-ver').classList.add('open');
}

function renderTimeline(hist) {
  const tl = $('mv-timeline');
  if (!hist.length) {
    tl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">Nenhuma atualização ainda.</div>';
    return;
  }
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

function fecharModalVer() {
  $('modal-ver').classList.remove('open');
  currentId = null;
  editFotos = [];
}

async function salvarChamado() {
  if (!currentId) return;
  const idx = allChamados.findIndex(c => c.id === currentId);
  if (idx < 0) return;
  const c = allChamados[idx];
  const novoStatus = $('mv-status').value;
  const novaPrio   = $('mv-prio').value;
  const obs        = $('mv-obs').value.trim();
  const ent = [];
  if (novoStatus !== c.status)    ent.push(`Status: ${c.status} → ${novoStatus}`);
  if (novaPrio !== c.prioridade)  ent.push(`Prioridade: ${c.prioridade} → ${novaPrio}`);
  const respNovo = $('mv-responsavel').value.trim();
  if (respNovo !== (c.responsavel||'')) ent.push(`Responsável: ${respNovo||'–'}`);
  const extNovo = $('mv-idext').value.trim();
  if (extNovo !== (c.idExterno||'')) ent.push(`ID Externo: ${extNovo||'–'}`);
  if($('mv-titulo-edit')?.value.trim() && $('mv-titulo-edit').value.trim() !== c.titulo)
    ent.push(`Título alterado`);
  if($('mv-cat').value && $('mv-cat').value !== c.categoria)
    ent.push(`Categoria: ${c.categoria} → ${$('mv-cat').value}`);
  if (obs) ent.push(obs ? null : null); // obs vai como campo separado

  const corMap = { 'Aberto':'#58a6ff','Em Andamento':'#d29922','Concluído':'#3fb950','Cancelado':'#8b949e' };
  if (ent.length || obs) {
    const historico = c.historico || [];
    historico.push({
      data: new Date().toISOString(),
      acao: ent.length ? ent.join(' · ') : 'Atualização',
      obs: obs || '',
      cor: corMap[novoStatus] || 'var(--blue-mid)'
    });
    c.historico = historico;
  }

  c.status        = novoStatus;
  c.prioridade    = novaPrio;
  c.responsavel   = respNovo;
  c.categoria     = $('mv-cat').value || c.categoria;
  c.local         = $('mv-local').value.trim() || c.local;
  c.descricao     = $('mv-desc').value.trim() || c.descricao;
  if($('mv-titulo-edit')?.value.trim()) c.titulo = $('mv-titulo-edit').value.trim();
  c.idExterno     = extNovo;
  c.tipo          = $('mv-tipo')?.value||c.tipo||'';
  c.dataDesejada  = $('mv-data-desejada')?.value||c.dataDesejada||'';
  c.dataConclusao = $('mv-dataconclusao').value ? new Date($('mv-dataconclusao').value).toISOString() : c.dataConclusao;
  if (obs) c.ultimaObs = obs;
  c.fotos = [...editFotos];

  await API.chamados.atualizar(c.id, c);
  API.invalidar('/chamados');
  atualizarContadores();
  aplicarFiltros();
  fecharModalVer();
  showToast('Chamado atualizado!');
}

async function excluirChamado() {
  if (!currentId) return;
  if (!confirm(`Excluir o chamado ${currentId}? Não é possível desfazer.`)) return;
  await API.chamados.excluir(currentId);
  API.invalidar('/chamados');
  const dados = await API.chamados.listar();
  allChamados = dados.chamados || [];
  atualizarContadores();
  aplicarFiltros();
  fecharModalVer();
  showToast('Chamado excluído.');
}
function gerarId(cat) {
  const ano = new Date().getFullYear();
  const prefix = cat + '-' + ano + '-';
  const existentes = allChamados
    .filter(c => c.id && c.id.startsWith(prefix))
    .map(c => parseInt(c.id.replace(prefix, '')) || 0);
  const prox = existentes.length ? Math.max(...existentes) + 1 : 1;
  return prefix + String(prox).padStart(3, '0');
}