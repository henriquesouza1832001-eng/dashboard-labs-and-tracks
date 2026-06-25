'use strict';

const _mem = {};
const _exp = {};

async function req(endpoint, opts = {}, ttl = 0) {
  if (ttl > 0 && _mem[endpoint] && Date.now() < _exp[endpoint]) {
    return _mem[endpoint];
  }
  const res = await fetch('/api' + endpoint, {
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (sessionStorage.getItem('ctrl-token') || ''), ...(opts.headers || {}) },
    ...opts
  });
  if (!res.ok) throw new Error('API ' + endpoint + ': ' + res.status);
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
    listar: ()    => req('/obras',    {},                          120000),
    salvar: (d)   => req('/obras',    { method: 'POST', body: JSON.stringify(d) }),
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
  invalidar: (endpoint) => { delete _mem[endpoint]; delete _exp[endpoint]; },
  admin: {
  listar:      ()          => req('/admin/usuarios',              {},                          0),
  criar:       (d)         => req('/admin/usuarios',              { method: 'POST',  body: JSON.stringify(d) }),
  toggleAtivo: (id, ativo) => req('/admin/usuarios/' + id,        { method: 'PUT',   body: JSON.stringify({ ativo }) }),
  resetSenha:  (id, senha) => req('/admin/usuarios/' + id + '/senha', { method: 'PUT', body: JSON.stringify({ senha }) }),
},
};