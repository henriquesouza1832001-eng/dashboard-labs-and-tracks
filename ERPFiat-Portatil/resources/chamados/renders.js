function renderTabela() {
  const tbody = $('chamados-tbody');
  if (!allChamados.length) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Nenhum chamado registrado.</p>
      </div>
    </td></tr>`;
    return;
  }
  if (!filteredList.length) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Nenhum chamado encontrado com os filtros aplicados.</p>
      </div>
    </td></tr>`;
    return;
  }
  const ordenar = $('ordenar-por')?.value || 'data-desc';
  const ordemStatus = { 'Aberto':0,'Em Andamento':1,'Cancelado':2,'Concluído':3 };
  const sorted = [...filteredList].sort((a,b) => {
    if (ordenar === 'prio') {
      const pm = {'Crítica':0,'Alta':1,'Média':2,'Baixa':3};
      return (pm[a.prioridade]??9)-(pm[b.prioridade]??9);
    }
    if (ordenar === 'sla') return diasAberto(b)-diasAberto(a);
    if (ordenar === 'data-asc') return new Date(a.dataAbertura)-new Date(b.dataAbertura);
    // data-desc (default): abertos primeiro, depois mais recentes
    const d = (ordemStatus[a.status]??9)-(ordemStatus[b.status]??9);
    return d !== 0 ? d : new Date(b.dataAbertura)-new Date(a.dataAbertura);
  });
  tbody.innerHTML = sorted.map(c => {
    const cat = CATS[c.categoria] || { label: c.categoria, color: '#8b949e' };
    const dias = Math.floor(diasAberto(c));
    const slaMax = slaParaPrio(c.prioridade);
    const pctSLA = Math.round(dias/slaMax*100);
    let slaTxt, slaCls;
    if (c.status === 'Concluído' || c.status === 'Cancelado') {
      slaTxt = '—'; slaCls = 'sla-ok';
    } else if (pctSLA >= 100) {
      slaTxt = `${dias}d ⚠`; slaCls = 'sla-out';
    } else if (pctSLA >= 70) {
      slaTxt = `${dias}d`; slaCls = 'sla-warn';
    } else {
      slaTxt = `${dias}d`; slaCls = 'sla-ok';
    }
    const localSetor = [c.local, c.setor].filter(Boolean).join(' · ');
    const rowClass = c.prioridade === 'Crítica' && (c.status==='Aberto'||c.status==='Em Andamento') ? 'row-critica' : '';
    return `<tr data-id="${c.id}" class="${rowClass}">
      <td><span class="id-badge">${c.id}</span></td>
      <td style="max-width:200px">
        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.titulo||'–'}</div>
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
    tr.addEventListener('click', () => abrirModalVer(tr.dataset.id));
  });
}

function aplicarFiltros() {
  const q = ($('search-input')?.value||'').toLowerCase();
  const filtroDt = $('filtro-data')?.value||'';
  const filtroTipo = $('filtro-tipo')?.value||'';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate()-hoje.getDay());
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  filteredList = allChamados.filter(c => {
    if (activeStatus && c.status !== activeStatus) return false;
    if (activeCat    && c.categoria !== activeCat) return false;
    if (activePrio   && c.prioridade !== activePrio) return false;
    if (filtroTipo   && c.tipo !== filtroTipo) return false;
    const filtroCat = document.getElementById('filtro-cat')?.value||'';
    if (filtroCat    && c.categoria !== filtroCat) return false;
    if (filtroDt) {
      const dt = c.dataAbertura ? new Date(c.dataAbertura) : null;
      if (!dt) return false;
      if (filtroDt === 'hoje'    && dt < hoje) return false;
      if (filtroDt === 'semana'  && dt < inicioSemana) return false;
      if (filtroDt === 'mes'     && dt < inicioMes) return false;
      if (filtroDt === 'atrasado' && (dentroDeSLA(c) || c.status === 'Concluído' || c.status === 'Cancelado')) return false;
    }
    if (q) {
      const hay = [c.id, c.titulo, c.local, c.setor, c.solicitante, c.responsavel, c.idExterno, c.tipo].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  renderTabela();
}