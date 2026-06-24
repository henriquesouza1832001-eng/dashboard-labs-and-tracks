function renderFotosGrid(gridId, arr, addBtnId, editMode) {
  const grid = $(gridId);
  // mantém o botão de adicionar, remove thumbs anteriores
  const addBtn = $(addBtnId);
  grid.innerHTML = '';
  arr.forEach((b64, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'foto-thumb';
    thumb.innerHTML = `
      <img src="${b64}" alt="foto ${i+1}">
      <button class="rm-foto" data-i="${i}" title="Remover foto">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    thumb.querySelector('img').addEventListener('click', () => abrirFotoViewer(b64));
    thumb.querySelector('.rm-foto').addEventListener('click', e => {
      e.stopPropagation();
      arr.splice(i, 1);
      renderFotosGrid(gridId, arr, addBtnId, editMode);
    });
    grid.appendChild(thumb);
  });
  grid.appendChild(addBtn);
}

function abrirFotoViewer(src) {
  $('foto-viewer-img').src = src;
  $('foto-viewer').classList.add('open');
}

function lerImagens(input, arr, gridId, addBtnId, editMode) {
  const files = Array.from(input.files);
  if (!files.length) return;
  let loaded = 0;
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = e => {
      arr.push(e.target.result);
      loaded++;
      if (loaded === files.length) renderFotosGrid(gridId, arr, addBtnId, editMode);
    };
    reader.readAsDataURL(f);
  });
  input.value = '';
}