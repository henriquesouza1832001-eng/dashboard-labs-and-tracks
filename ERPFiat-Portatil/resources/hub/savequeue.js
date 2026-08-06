'use strict';
const SaveQueue = (() => {
  let fila = Promise.resolve();
  let pendentes = 0;

  function setIndicador(estado) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.classList.remove('saved', 'saving', 'err', 'nosave');
    el.classList.add(estado);
    const label = document.getElementById('save-label') || document.getElementById('save-txt');
    if (label) label.textContent = estado === 'saving' ? 'salvando...' : estado === 'err' ? 'erro ao salvar' : 'salvo';
  }

  function run(fn, opts = {}) {
    pendentes++;
    setIndicador('saving');
    fila = fila.then(async () => {
      try {
        await fn();
        pendentes--;
        if (pendentes === 0) setIndicador('saved');
        opts.onOk?.();
      } catch (e) {
        pendentes--;
        setIndicador('err');
        console.error('[SaveQueue]', opts.label || '', e);
        showToast(`Erro ao salvar${opts.label ? ' ' + opts.label : ''}. Tentando de novo em 3s...`, 'err');
        setTimeout(() => run(fn, opts), 3000); // 1 retry automático
        opts.onErr?.(e);
      }
    });
    return fila;
  }

  return { run };
})();