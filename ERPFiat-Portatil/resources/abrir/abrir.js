const CATS = {
  INF: 'Infraestrutura',
  ELE: 'Elétrica',
  HID: 'Hidráulica',
  LMP: 'Limpeza',
  AR:  'Ar Cond.',
};

let fotos = [];
let catSelecionada = '';

const params = new URLSearchParams(location.search);
const localParam = params.get('local') || '';
const catParam   = params.get('cat')   || '';
if (localParam) {
  document.getElementById('f-local').value    = localParam;
  document.getElementById('f-local').readOnly = true;
  document.getElementById('badge-local-txt').textContent = localParam;
}

if (catParam && CATS[catParam]) {
  selecionarCat(catParam);
}

document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => selecionarCat(pill.dataset.cat));
});

function selecionarCat(cat) {
  catSelecionada = cat;
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('selected', p.dataset.cat === cat);
  });
  const radio = document.querySelector(`input[name="cat"][value="${cat}"]`);
  if (radio) radio.checked = true;
}

document.getElementById('foto-input').addEventListener('change', e => {
  const files = Array.from(e.target.files);
  let loaded = 0;
  files.forEach(f => {
    const r = new FileReader();
    r.onload = ev => {
      fotos.push(ev.target.result);
      loaded++;
      if (loaded === files.length) renderFotos();
    };
    r.readAsDataURL(f);
  });
  e.target.value = '';
});

function renderFotos() {
  const wrap = document.getElementById('fotos-wrap');
  wrap.innerHTML = '';
  fotos.forEach((b64, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'foto-thumb';
    thumb.innerHTML = `<img src="${b64}"><button class="rm" onclick="removerFoto(${i})">✕</button>`;
    wrap.appendChild(thumb);
  });
  const addBtn = document.createElement('div');
  addBtn.className = 'foto-add';
  addBtn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Adicionar`;
  addBtn.onclick = () => document.getElementById('foto-input').click();
  wrap.appendChild(addBtn);
}

function removerFoto(i) {
  fotos.splice(i, 1);
  renderFotos();
}


async function gerarId(cat) {
  const dados = (await API.chamados.listar()).chamados || [];
  const ano = new Date().getFullYear();
  const prefix = cat + '-' + ano + '-';
  const existentes = dados
    .filter(c => c.id && c.id.startsWith(prefix))
    .map(c => parseInt(c.id.replace(prefix, '')) || 0);
  const prox = existentes.length ? Math.max(...existentes) + 1 : 1;
  return prefix + String(prox).padStart(3, '0');
}



async function registrar() {
  const titulo = document.getElementById('f-titulo').value.trim();
  const local  = document.getElementById('f-local').value.trim();
  const desc   = document.getElementById('f-desc').value.trim();

  if (!catSelecionada) { toast('Selecione uma categoria.', true); return; }
  if (!titulo)          { toast('Descreva o problema.', true); return; }
  if (!local)           { toast('Informe o local.', true); return; }

  const btn = document.getElementById('btn-registrar');
  btn.disabled = true;
  btn.textContent = 'Registrando…';

  const id = await gerarId(catSelecionada);

  const novo = {
    id,
    titulo,
    categoria:   catSelecionada,
    tipo:        '',
    prioridade:  'Média',
    local,
    setor:       document.getElementById('f-setor').value.trim(),
    solicitante: document.getElementById('f-solicitante').value.trim(),
    dataDesejada:'',
    descricao:   desc || titulo,
    status:      'Aberto',
    responsavel: '',
    idExterno:   '',
    dataAbertura: new Date().toISOString(),
    dataConclusao: null,
    fotos:       [...fotos],
    historico: [{
      data: new Date().toISOString(),
      acao: 'Chamado aberto via QR Code',
      obs:  desc || titulo,
      cor:  '#58a6ff'
    }]
  };

  await API.chamados.criar(novo);
  API.invalidar('/chamados');
  setTimeout(() => {
    document.getElementById('tela-form').style.display = 'none';
    document.getElementById('sucesso-id').textContent = id;
    document.getElementById('tela-sucesso').style.display = 'block';
  }, 400);
}

function reiniciar() {
  fotos = [];
  catSelecionada = '';
  document.getElementById('f-titulo').value = '';
  if (!localParam) document.getElementById('f-local').value = '';
  document.getElementById('f-setor').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-solicitante').value = '';
  renderFotos();
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('selected'));
  if (catParam) selecionarCat(catParam);
  const btn = document.getElementById('btn-registrar');
  btn.disabled = false;
  btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Registrar Chamado`;
  document.getElementById('tela-sucesso').style.display = 'none';
  document.getElementById('tela-form').style.display = 'block';
}

let _toastT;
function toast(msg, err) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => el.classList.remove('show'), 3000);
}
