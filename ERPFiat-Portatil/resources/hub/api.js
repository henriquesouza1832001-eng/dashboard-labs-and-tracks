'use strict';

const _mem = {};
const _exp = {};

async function req(endpoint, opts = {}, ttl = 0, _retry = false) {
  if (ttl > 0 && _mem[endpoint] && Date.now() < _exp[endpoint]) {
    return _mem[endpoint];
  }
  const res = await fetch('/api' + endpoint, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Ctrl-Token': localStorage.getItem('ctrl-token') || sessionStorage.getItem('ctrl-token') || '', ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 302 || res.status === 303 || res.redirected) {
    if (!_retry) return req(endpoint, opts, ttl, true);
    window.location.href = '/login';
    return;
  }
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/login';
    return;
  }
  if (!res.ok) {
    let detalhe = res.status;
    try {
      const body = await res.json();
      if (body && body.erro) detalhe = body.erro;
    } catch (_) {}
    throw new Error('API ' + endpoint + ': ' + detalhe);
  }
  const data = await res.json();
  if (ttl > 0) { _mem[endpoint] = data; _exp[endpoint] = Date.now() + ttl; }
  return data;
}

const API = {
  chamados: {
    listar:    ()      => req('/chamados',          {},                           60000),
    criar:     (d)     => req('/chamados',          { method: 'POST',  body: JSON.stringify(d) }),
    atualizar: (id, d) => req('/chamados/' + id,    { method: 'PUT',   body: JSON.stringify(d) }),
    excluir:   (id)    => req('/chamados/' + id,    { method: 'DELETE' }),
    sla:       ()      => req('/chamados/sla',      {},                          300000),
    salvarSla: (cfg)   => req('/chamados/sla',      { method: 'POST',  body: JSON.stringify(cfg) }),
  },
  obras: {
    listar:        ()      => req('/obras', {}, 120000),
    salvar:        (d)     => req('/obras', { method: 'POST', body: JSON.stringify(d) }),
    excluirObra:   (cod)   => req('/obras/' + cod, { method: 'DELETE' }),
    excluirBudget: (id)    => req('/obras/budget/' + id, { method: 'DELETE' }),
    excluirLanc:      (id)              => req('/obras/lancamento/' + id, { method: 'DELETE' }),
    registrarAvanco:  (cod, etapaId, d) => req('/obras/' + cod + '/etapas/' + etapaId + '/avanco', { method: 'POST', body: JSON.stringify(d) }),
    avancos:          (cod)             => req('/obras/' + cod + '/avancos', {}, 30000),
},
  codin: {
    listar: ()    => req('/codin',    {},                          60000),
    salvar: (d)   => req('/codin',    { method: 'POST', body: JSON.stringify(d) }),
  },
  conforto: {
    listar: ()    => req('/conforto', {},                          60000),
    salvar: (d)   => req('/conforto', { method: 'POST', body: JSON.stringify(d) }),
  },
  kpi: {
    dados: ()     => req('/kpi/dados', {},                         300000),
  },
  hub: {
    dados:  ()    => req('/hub/dados',   {},                       120000),
    config: {
      ler:    ()  => req('/hub/config',  {},                       600000),
      salvar: (d) => req('/hub/config',  { method: 'POST', body: JSON.stringify(d) }),
    },
    
  },
  
  atividades: {
    listar: () => req('/atividades', {}, 60000),
  },
  invalidar: (endpoint) => {
  delete _mem[endpoint];
  delete _exp[endpoint];
},
  admin: {
  listar:      ()          => req('/admin/usuarios',              {},                          0),
  criar:       (d)         => req('/admin/usuarios',              { method: 'POST',  body: JSON.stringify(d) }),
  toggleAtivo: (id, ativo) => req('/admin/usuarios/' + id,        { method: 'PUT',   body: JSON.stringify({ ativo }) }),
  resetSenha:  (id, senha) => req('/admin/usuarios/' + id + '/senha', { method: 'PUT', body: JSON.stringify({ senha }) }),
},
};