function renderDashboard() {
  const c = allChamados;
  const total = c.length;
  const abertos    = c.filter(x => x.status === 'Aberto').length;
  const andamento  = c.filter(x => x.status === 'Em Andamento').length;
  const concluidos = c.filter(x => x.status === 'Concluído').length;
  const cancelados = c.filter(x => x.status === 'Cancelado').length;
  const criticos   = c.filter(x => x.prioridade === 'Crítica' && x.status !== 'Concluído').length;
  const semResp    = c.filter(x => !x.responsavel).length;
  const pctConclusao = total ? Math.round(concluidos / total * 100) : 0;
const comData   = c.filter(x => x.dataAbertura);
const noSLA     = comData.filter(x => dentroDeSLA(x)).length;
const foraSLA   = comData.length - noSLA;
const pctSLA    = comData.length ? Math.round(noSLA / comData.length * 100) : 100;
const slaMeta   = 90;
const prioSLA = ['Crítica','Alta','Média','Baixa'].map(p => {
  const lista = comData.filter(x => x.prioridade === p);
  const ok    = lista.filter(x => dentroDeSLA(x)).length;
  const pct   = lista.length ? Math.round(ok / lista.length * 100) : 100;
  return { p, total: lista.length, ok, pct };
});

$('indicadores-list').innerHTML = [
  { label: 'Total de chamados',    val: total,            color: 'var(--text)' },
  { label: 'Taxa de conclusão',    val: pctConclusao+'%', color: 'var(--green)' },
  { label: 'Críticos em aberto',   val: criticos,         color: criticos > 0 ? 'var(--red)' : 'var(--green)' },
  { label: 'Sem responsável',      val: semResp,          color: semResp > 0 ? 'var(--yellow)' : 'var(--green)' },
  { label: 'Em andamento',         val: andamento,        color: 'var(--yellow)' },
].map(r => `
  <div class="indicador-row">
    <span>${r.label}</span>
    <span class="indicador-val" style="color:${r.color}">${r.val}</span>
  </div>
`).join('');
const corSLA = pctSLA >= slaMeta ? 'var(--green)' : pctSLA >= 70 ? 'var(--yellow)' : 'var(--red)';
const slaEl = document.getElementById('sla-painel');
if (slaEl) {
  slaEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">SLA Geral</span>
      <span style="font-family:var(--mono);font-size:22px;font-weight:700;color:${corSLA}">${pctSLA}%</span>
    </div>
    <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:4px">
      <div style="height:100%;width:${pctSLA}%;background:${corSLA};border-radius:3px;transition:width .4s"></div>
    </div>
    <div style="font-size:10px;color:var(--text-muted);margin-bottom:14px">Meta: ${slaMeta}% · ${noSLA} dentro · ${foraSLA} fora</div>
    ${prioSLA.map(x => {
      const cor = x.pct >= slaMeta ? 'var(--green)' : x.pct >= 70 ? 'var(--yellow)' : 'var(--red)';
      const cores = {'Crítica':'var(--red)','Alta':'var(--orange)','Média':'var(--blue-light)','Baixa':'var(--text-muted)'};
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:11px;color:${cores[x.p]||'var(--text-muted)'};min-width:52px">${x.p}</span>
        <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${x.pct}%;background:${cor};border-radius:3px"></div>
        </div>
        <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${cor};min-width:36px;text-align:right">${x.pct}%</span>
        <span style="font-size:10px;color:var(--text-muted);min-width:40px">${x.ok}/${x.total}</span>
      </div>`;
    }).join('')}
  `;
}

const gridC = 'rgba(0,0,0,0.07)', textC = '#4a5880';
const baseScale = { grid: { color: gridC }, ticks: { color: textC, font: { size: 10, family: 'IBM Plex Mono' } } };
  Object.values(chartInstances).forEach(ch => ch.destroy());
  chartInstances = {};
  chartInstances.status = new Chart($('chart-status'), {
    type: 'doughnut',
    data: {
      labels: ['Aberto', 'Em Andamento', 'Concluído', 'Cancelado'],
      datasets: [{ data: [abertos, andamento, concluidos, cancelados],
        backgroundColor: ['#58a6ff', '#d29922', '#3fb950', '#8b949e'],
        borderWidth: 0, hoverOffset: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: '#4a5880', font: { size: 11, family: 'IBM Plex Sans' }, boxWidth: 10, padding: 16 } } } }
  });
  const catLabels = Object.values(CATS).map(c => c.label);
  const catVals   = Object.keys(CATS).map(k => allChamados.filter(x => x.categoria === k).length);
  const catColors = ['#58a6ff', '#d29922', '#3fb950', '#bc8cff', '#39c5cf'];
  chartInstances.cat = new Chart($('chart-cat'), {
    type: 'bar',
    data: { labels: catLabels, datasets: [{ data: catVals, backgroundColor: catColors, borderRadius: 4, borderSkipped: false }] },
    options: {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: gridC },
      ticks: { color: textC, font: { size: 10, family: 'IBM Plex Mono' }, stepSize: 1 },
      border: { display: false }
    },
    y: {
      grid: { display: false },
      ticks: { color: textC, font: { size: 11, family: 'IBM Plex Sans' } },
      border: { display: false }
    }
  }
}
  });
  const prioLabels = ['Crítica', 'Alta', 'Média', 'Baixa'];
  const prioVals   = prioLabels.map(p => allChamados.filter(x => x.prioridade === p && x.status !== 'Concluído' && x.status !== 'Cancelado').length);
  const prioColors = ['#f85149', '#e3711a', '#58a6ff', '#8b949e'];
  chartInstances.prio = new Chart($('chart-prio'), {
    type: 'bar',
    data: { labels: prioLabels, datasets: [{ data: prioVals, backgroundColor: prioColors, borderRadius: 4, borderSkipped: false }] },
    options: {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: textC, font: { size: 11, family: 'IBM Plex Sans' } },
      border: { display: false }
    },
    y: {
      grid: { color: gridC },
      ticks: { color: textC, font: { size: 10, family: 'IBM Plex Mono' }, stepSize: 1 },
      border: { display: false }
    }
  }
}
  });
  const statusFiltro = document.getElementById('filtro-mes-status')?.value ?? 'Aberto';
  const qtdMeses = parseInt(document.getElementById('filtro-mes-qtd')?.value || '12');
  const hoje2 = new Date();
  const mesesLabels = [], mesesVals = [];
  for(let i = qtdMeses-1; i >= 0; i--){
    const d = new Date(hoje2.getFullYear(), hoje2.getMonth()-i, 1);
    const chave = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    mesesLabels.push(String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2));
    const lista = c.filter(x => (x.dataAbertura||'').startsWith(chave));
    mesesVals.push(lista.length);
  }
  if(chartInstances.mes) chartInstances.mes.destroy();
  chartInstances.mes = new Chart($('chart-mes'), {
    type: 'bar',
    data: {
      labels: mesesLabels,
      datasets: [{
        label: statusFiltro || 'Todos',
        data: mesesVals,
        backgroundColor: '#3a6bc7',
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textC, font: { size: 10, family: 'IBM Plex Mono' } }, border: { display: false } },
        y: { grid: { color: gridC }, ticks: { color: textC, font: { size: 10, family: 'IBM Plex Mono' }, stepSize: 1 }, border: { display: false } }
      }
    }
  });
  const totalMesesAbertos = mesesVals.reduce((s,v)=>s+v,0);
  const mediaAbertos = qtdMeses > 0 ? (totalMesesAbertos / qtdMeses).toFixed(1) : '0';
  const elMA = document.getElementById('kpi-media-abertos');
  if(elMA) elMA.textContent = mediaAbertos;
  const qtdMesesFech = parseInt(document.getElementById('filtro-mes-qtd-fech')?.value || '12');
  const mesesLabelsFech = [], mesesValsFech = [];
  for(let i = qtdMesesFech-1; i >= 0; i--){
    const d = new Date(hoje2.getFullYear(), hoje2.getMonth()-i, 1);
    const chave = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    mesesLabelsFech.push(String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2));
    mesesValsFech.push(c.filter(x =>
      ['Concluído','Fechado','Resolvido'].includes(x.status) &&
      (x.dataConclusao||x.dataAbertura||'').startsWith(chave)
    ).length);
  }
  const totalMesesFech = mesesValsFech.reduce((s,v)=>s+v,0);
  const mediaFechados = qtdMesesFech > 0 ? (totalMesesFech / qtdMesesFech).toFixed(1) : '0';
  const elMF = document.getElementById('kpi-media-fechados');
  if(elMF) elMF.textContent = mediaFechados;

  if(chartInstances.mesFech) chartInstances.mesFech.destroy();
  chartInstances.mesFech = new Chart($('chart-mes-fech'), {
    type: 'bar',
    data: {
      labels: mesesLabelsFech,
      datasets: [{
        label: 'Fechados',
        data: mesesValsFech,
        backgroundColor: '#1a7f4b',
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textC, font: { size: 10, family: 'IBM Plex Mono' } }, border: { display: false } },
        y: { grid: { color: gridC }, ticks: { color: textC, font: { size: 10, family: 'IBM Plex Mono' }, stepSize: 1 }, border: { display: false } }
      }
    }
  });
  ['filtro-mes-status','filtro-mes-qtd','filtro-mes-qtd-fech'].forEach(id => {
    const el = document.getElementById(id);
    if(el && !el._bound){ el.addEventListener('change', renderDashboard); el._bound = true; }
  });
}
