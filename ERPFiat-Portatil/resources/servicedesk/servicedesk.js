'use strict';

const $ = id => document.getElementById(id);

let chamados = [];
let verConcluidos = false;
let abaAtiva = 'abertos';
let filtroData = 'todos';
let painelAberto = null;
let fotosNovas = {};

function mostrarToast(msg) {
  const t = $('sd-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function fmtData(iso) {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function statusClasse(s) {
  const m = { 'Aberto': 'st-aberto', 'Em Andamento': 'st-andamento', 'Concluído': 'st-concluido', 'Cancelado': 'st-andamento' };
  return m[s] || 'st-aberto';
}

function dentroDoFiltroData(c) {
  if (filtroData === 'todos') return true;
  if (!c.dataAbertura) return filtroData === 'antigos';
  const abertura = new Date(c.dataAbertura);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());

  if (filtroData === 'hoje') return abertura >= hoje;
  if (filtroData === 'semana') return abertura >= inicioSemana;
  if (filtroData === 'antigos') return abertura < inicioSemana;
  return true;
}

function renderLista() {
  const busca = ($('sd-busca').value || '').toLowerCase();

  const lista = chamados.filter(c => {
    if (!verConcluidos && c.status === 'Concluído') return false;
    if (c.status === 'Cancelado' && !verConcluidos) return false;

    if (abaAtiva === 'andamento') {
      if (c.status !== 'Em Andamento') return false;
    } else {
      if (c.status === 'Em Andamento') return false;
      if (!dentroDoFiltroData(c)) return false;
    }

    if (!busca) return true;
    const alvo = [c.id, c.titulo, c.local].join(' ').toLowerCase();
    return alvo.includes(busca);
  });

  const container = $('sd-lista');

  if (!lista.length) {
    container.innerHTML = '<div class="sd-vazio">Nenhum chamado encontrado.</div>';
    return;
  }

  container.innerHTML = lista.map(c => {
    const aberto = painelAberto === c.id;
    const fotosAtuais = (fotosNovas[c.id] || c.fotos || []);
    return `
    <div class="sd-card ${c.status === 'Concluído' ? 'concluido' : ''}" data-id="${c.id}">
      <div class="sd-head" data-toggle="${c.id}">
        <div class="sd-info">
          <div class="sd-id">${c.id}</div>
          <div class="sd-titulo">${c.titulo || '–'}</div>
          <div class="sd-meta">${c.local || '–'} · aberto em ${fmtData(c.dataAbertura)}${c.idExterno ? ' · ID ext: ' + c.idExterno : ''}</div>
          <span class="sd-status ${statusClasse(c.status)}">${c.status || 'Aberto'}</span>
        </div>
        <div class="sd-toggle">${aberto ? '▲ fechar' : '▼ abrir'}</div>
      </div>

      <div class="sd-painel ${aberto ? 'open' : ''}" data-painel="${c.id}">
        <div class="sd-desc">${c.descricao || 'Sem descrição.'}</div>

        <div class="sd-row">
          <select data-status="${c.id}">
            <option value="Aberto" ${c.status === 'Aberto' ? 'selected' : ''}>Aberto</option>
            <option value="Em Andamento" ${c.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
            <option value="Concluído" ${c.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
            <option value="Cancelado" ${c.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
          <input type="text" placeholder="ID externo" value="${c.idExterno || ''}" data-idext="${c.id}">
        </div>

        <textarea class="sd-comentario" placeholder="Adicionar comentário sobre o atendimento..." data-comentario="${c.id}"></textarea>

        <div class="sd-fotos" data-fotosgrid="${c.id}">
          ${fotosAtuais.map((f, i) => `
            <div class="sd-thumb">
              <img src="${f}" alt="foto ${i + 1}">
              <button data-rmfoto="${c.id}" data-i="${i}">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
        <button class="sd-btn-foto" data-addfoto="${c.id}">+ Adicionar foto</button>

        <div class="sd-acoes">
          <button data-salvar="${c.id}">Salvar atendimento</button>
        </div>

        ${(c.historico || []).length ? `
          <div class="sd-historico">
            <div class="sd-historico-titulo">Histórico</div>
            ${c.historico.slice().reverse().map(h => `
              <div class="sd-hist-item">
                <span class="sd-hist-data">${fmtData(h.data)}</span>
                <span>${h.acao || ''}${h.obs ? ' — ' + h.obs : ''}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
  }).join('');

  ligarEventos();
}

function ligarEventos() {
  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.toggle;
      painelAberto = painelAberto === id ? null : id;
      renderLista();
    });
  });

  document.querySelectorAll('[data-addfoto]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const input = $('sd-foto-input');
      input.dataset.alvo = btn.dataset.addfoto;
      input.click();
    });
  });

  document.querySelectorAll('[data-rmfoto]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.rmfoto;
      const idx = parseInt(btn.dataset.i);
      const chamado = chamados.find(c => c.id === id);
      const lista = fotosNovas[id] || [...(chamado.fotos || [])];
      lista.splice(idx, 1);
      fotosNovas[id] = lista;
      renderLista();
    });
  });

  document.querySelectorAll('[data-salvar]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      salvarAtendimento(btn.dataset.salvar);
    });
  });

  document.querySelectorAll('.sd-painel').forEach(p => {
    p.addEventListener('click', e => e.stopPropagation());
  });
}

$('sd-foto-input').addEventListener('change', e => {
  const id = e.target.dataset.alvo;
  const arquivos = Array.from(e.target.files);
  if (!arquivos.length) return;
  const chamado = chamados.find(c => c.id === id);
  const lista = fotosNovas[id] || [...(chamado.fotos || [])];
  let carregadas = 0;
  arquivos.forEach(arq => {
    const leitor = new FileReader();
    leitor.onload = ev => {
      lista.push(ev.target.result);
      carregadas++;
      if (carregadas === arquivos.length) {
        fotosNovas[id] = lista;
        renderLista();
      }
    };
    leitor.readAsDataURL(arq);
  });
  e.target.value = '';
});

async function salvarAtendimento(id) {
  const chamado = chamados.find(c => c.id === id);
  if (!chamado) return;

  const novoStatus = document.querySelector(`[data-status="${id}"]`).value;
  const idExterno = document.querySelector(`[data-idext="${id}"]`).value.trim();
  const comentario = document.querySelector(`[data-comentario="${id}"]`).value.trim();
  const fotosFinal = fotosNovas[id] || chamado.fotos || [];

  const corMap = { 'Aberto': '#58a6ff', 'Em Andamento': '#d29922', 'Concluído': '#3fb950', 'Cancelado': '#8b949e' };
  const historico = chamado.historico || [];

  if (novoStatus !== chamado.status) {
    historico.push({
      data: new Date().toISOString(),
      acao: `Status: ${chamado.status} → ${novoStatus}`,
      obs: comentario || '',
      cor: corMap[novoStatus] || '#58a6ff'
    });
  } else if (comentario) {
    historico.push({
      data: new Date().toISOString(),
      acao: 'Comentário do Service Desk',
      obs: comentario,
      cor: '#58a6ff'
    });
  }

  chamado.status = novoStatus;
  chamado.idExterno = idExterno;
  chamado.fotos = fotosFinal;
  chamado.historico = historico;
  if (novoStatus === 'Concluído' && !chamado.dataConclusao) {
    chamado.dataConclusao = new Date().toISOString();
  }

  try {
    const res = await fetch(`/api/chamados/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chamado)
    });
    if (!res.ok) throw new Error('falha');
    delete fotosNovas[id];
    document.querySelector(`[data-comentario="${id}"]`).value = '';
    mostrarToast('Atendimento atualizado.');
    renderLista();
  } catch {
    mostrarToast('Erro ao salvar. Tente novamente.');
  }
}

async function carregar() {
  try {
    const dados = window.__DADOS__ || await fetch('/api/chamados').then(r => r.json());
    chamados = (dados.chamados || []).sort((a, b) =>
      new Date(b.dataAbertura) - new Date(a.dataAbertura)
    );
    renderLista();
  } catch {
    $('sd-lista').innerHTML = '<div class="sd-erro">Erro ao carregar chamados.</div>';
  }
}

$('sd-busca').addEventListener('input', renderLista);
$('sd-ver-concluidos').addEventListener('change', e => {
  verConcluidos = e.target.checked;
  renderLista();
});
$('sd-filtro-data').addEventListener('change', e => {
  filtroData = e.target.value;
  renderLista();
});
document.querySelectorAll('.aba-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    abaAtiva = btn.dataset.aba;
    document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtroDataEl = $('sd-filtro-data');
    filtroDataEl.style.display = abaAtiva === 'andamento' ? 'none' : '';
    renderLista();
  });
});

carregar();