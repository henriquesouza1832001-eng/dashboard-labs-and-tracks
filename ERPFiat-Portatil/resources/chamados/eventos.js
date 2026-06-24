$('btn-open-file')?.addEventListener('click', () => showToast('Arquivos gerenciados pelo Hub.', 'err'));
$('btn-novo').addEventListener('click', abrirModalNovo);
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.filter;
    const val  = btn.dataset.val;
    document.querySelectorAll(`[data-filter="${type}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (type === 'status') activeStatus = val;
    if (type === 'cat')    activeCat    = val;
    if (type === 'prio')   activePrio   = val;
    atualizarBadgeFiltroAtivo();
    aplicarFiltros();
  });
});
$('search-input').addEventListener('input', aplicarFiltros);
$('filtro-data')?.addEventListener('change', aplicarFiltros);
$('filtro-tipo')?.addEventListener('change', aplicarFiltros);
$('filtro-cat')?.addEventListener('change', aplicarFiltros);
$('ordenar-por')?.addEventListener('change', () => renderTabela());
$('mv-close').addEventListener('click', fecharModalVer);
$('mv-cancelar').addEventListener('click', fecharModalVer);
$('mv-salvar').addEventListener('click', salvarChamado);
$('mv-excluir').addEventListener('click', excluirChamado);
$('modal-ver').addEventListener('click', e => { if (e.target === $('modal-ver')) fecharModalVer(); });

$('mv-add-foto').addEventListener('click', () => $('mv-file-input').click());
$('mv-file-input').addEventListener('change', e => {
  lerImagens(e.target, editFotos, 'mv-fotos-grid', 'mv-add-foto', true);
});
$('mn-close').addEventListener('click', fecharModalNovo);
$('mn-cancelar').addEventListener('click', fecharModalNovo);
$('mn-salvar').addEventListener('click', registrarChamado);
$('modal-novo').addEventListener('click', e => { if (e.target === $('modal-novo')) fecharModalNovo(); });

$('mn-add-foto').addEventListener('click', () => $('mn-file-input').click());
$('mn-file-input').addEventListener('change', e => {
  lerImagens(e.target, novasFotos, 'mn-fotos-grid', 'mn-add-foto', false);
});
$('foto-viewer-close').addEventListener('click', () => $('foto-viewer').classList.remove('open'));
$('foto-viewer').addEventListener('click', e => { if (e.target === $('foto-viewer')) $('foto-viewer').classList.remove('open'); });
$('mn-titulo').addEventListener('keydown', e => { if (e.key === 'Enter') $('mn-cat').focus(); });
