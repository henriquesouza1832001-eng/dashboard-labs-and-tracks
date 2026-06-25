'use strict';
if (window.__authUser && window.__authUser.role !== 'admin') {
  window.location.href = '../hub/hub.html';
}
const msg = (txt, tipo) => {
  const el = document.getElementById('adm-msg');
  el.textContent = txt;
  el.className = 'adm-msg ' + tipo;
};
async function carregarUsuarios() {
  try {
    const lista = await API.admin.listar();
    const tbody = document.getElementById('adm-tbody');
    tbody.innerHTML = lista.map(u => `
      <tr>
        <td>${u.nome}</td>
        <td style="font-family:var(--mono);font-size:12px">${u.email}</td>
        <td><span class="badge-role ${u.role}">${u.role}</span></td>
        <td style="color:${u.ativo ? 'var(--gn)' : 'var(--rd)'}">${u.ativo ? 'sim' : 'não'}</td>
        <td>
          <button class="btn-toggle" onclick="toggleAtivo(${u.id}, ${u.ativo})">${u.ativo ? 'desativar' : 'ativar'}</button>
          <button class="btn-reset" onclick="resetSenha(${u.id})">reset senha</button>
        </td>
      </tr>`).join('');
  } catch {
    msg('erro ao carregar usuários', 'err');
  }
}
document.getElementById('btn-criar').addEventListener('click', async () => {
  const nome  = document.getElementById('inp-nome').value.trim();
  const email = document.getElementById('inp-email').value.trim();
  const senha = document.getElementById('inp-senha').value;
  const role  = document.getElementById('inp-role').value;
  if (!nome || !email || !senha) { msg('preencha todos os campos', 'err'); return; }
  try {
    await API.admin.criar({ nome, email, senha, role });
    msg('usuário criado', 'ok');
    document.getElementById('inp-nome').value = '';
    document.getElementById('inp-email').value = '';
    document.getElementById('inp-senha').value = '';
    carregarUsuarios();
  } catch {
    msg('erro ao criar usuário', 'err');
  }
});
window.toggleAtivo = async (id, ativo) => {
  try {
    await API.admin.toggleAtivo(id, !ativo);
    carregarUsuarios();
  } catch { msg('erro', 'err'); }
};
window.resetSenha = async (id) => {
  const nova = prompt('Nova senha:');
  if (!nova) return;
  try {
    await API.admin.resetSenha(id, nova);
    msg('senha alterada', 'ok');
  } catch { msg('erro ao alterar senha', 'err'); }
};
carregarUsuarios();