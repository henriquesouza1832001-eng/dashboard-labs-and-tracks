# Controler: ERP interno (Labs and Tracks)

Esse é um ERP interno que comecei a construir pra resolver um problema bem prático: a gestão de obras, manutenção, climatização, controle de acesso e atividades do time estava espalhada em planilha, WhatsApp e memória de quem cuidava de cada coisa. O Controler junta isso em um painel só, com dados guardados em banco de verdade, não mais uma planilha compartilhada que trava quando duas pessoas abrem ao mesmo tempo.

É um Databricks App por baixo: backend em Python/FastAPI, banco em Delta Lake acessado via SQL Warehouse, frontend em HTML/CSS/JS puro, sem framework, um módulo por pasta.

> Este README documenta o que o sistema é e como funciona hoje, incluindo schema de dados e o caminho real de algumas operações. Para o histórico de bugs, decisões e o processo de chegar até aqui, tem um relato mais corrido em [`CHANGELOG.md`](./CHANGELOG.md).

---

## Sumário

- [Stack e por quê](#stack-e-por-quê)
- [Como as peças se encaixam](#como-as-peças-se-encaixam)
- [Os módulos, um por um](#os-módulos-um-por-um)
- [Autenticação](#autenticação)
- [Cache em memória](#cache-em-memória)
- [Banco de dados e schema](#banco-de-dados-e-schema)
- [Cronograma de obras: como o avanço é calculado](#cronograma-de-obras-como-o-avanço-é-calculado)
- [Três fluxos completos, do clique ao banco](#três-fluxos-completos-do-clique-ao-banco)
- [API completa](#api-completa)
- [Frontend por dentro](#frontend-por-dentro)
- [PWA e Service Worker](#pwa-e-service-worker)
- [Deploy](#deploy)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Rodando local](#rodando-local)
- [O que ainda não está redondo](#o-que-ainda-não-está-redondo)

---

## Stack e por quê

| Camada | O que uso |
|---|---|
| Backend | Python + FastAPI, rodando com `uvicorn` |
| Onde hospeda | Databricks Apps |
| Banco | Delta Lake, via `databricks-sql-connector` |
| Frontend | HTML + CSS + JS puro, sem build, sem framework |
| Login | JWT (`PyJWT`), cookie `httponly` + header customizado |
| Offline/instalável | Service Worker |
| Deploy | GitHub Actions, automático no push para `main` |

Não tem React nem Vue de propósito. Cada tela é um punhado de arquivos estáticos servidos direto, e toda comunicação com o backend passa por um cliente HTTP central (`hub/api.js`). Isso deixa o projeto mais simples de manter sozinho, sem precisar de build step nem de aprender um framework novo a cada mudança pequena. O custo é que não tenho reatividade automática de UI, então cada tela cuida manualmente de re-renderizar o que mudou.

O banco ser Delta Lake em vez de, por exemplo, um Postgres comum, veio de aproveitar a infraestrutura que já existia no Databricks (é o ambiente onde os dados da empresa já vivem). Essa conveniência trouxe um conjunto de restrições que moldou bastante decisão de código, e tem uma seção só sobre isso mais abaixo.

---

## Como as peças se encaixam

```
Navegador (PWA)
   │
   ├─ Service Worker: guarda o "shell" da aplicação em cache,
   │  mas deixa toda chamada de API passar direto, sem se meter
   │
   ▼
FastAPI (app.py), roda dentro de um Databricks App
   │
   ├─ Cache em memória (um dict Python global): responde
   │        praticamente todo GET sem tocar no banco
   │
   ├─ Rotas de escrita (POST/PUT/DELETE): gravam no banco e,
   │        na mesma resposta, já recolocam o cache atualizado
   │
   ▼
SQL Warehouse do Databricks (Serverless, 2X-Small)
   │
   ▼
Delta Lake, um schema por módulo
```

A ideia central, que só ficou clara depois de bastante dor de cabeça com performance, é que nenhuma leitura bate direto no banco. O que chega quando alguém abre uma tela é o que já está guardado em memória no processo do backend. O banco só entra quando alguém salva algo, e mesmo aí a gente tenta ler de volta só o que mudou, não o módulo inteiro. Isso importa porque o SQL Warehouse tem uma latência por consulta que é ótima para volume (uma query que processa milhões de linhas), mas péssima se você faz uma query só para responder um clique de botão: cada ida e volta custa uns 200 a 500ms de conversa com o warehouse, e isso se soma rápido se você faz vários por requisição.

---

## Os módulos, um por um

### Hub
A porta de entrada. Mostra atalhos pros outros módulos e alguns números agregados (total de chamados, obras em andamento), vindos de `/api/hub/dados`. Também guarda a configuração central compartilhada entre módulos: pessoas, CRESP (código de responsabilidade), tipos de obra, categorias de custo, leitores de acesso. Obras e CODIN vão buscar isso quando precisam popular um `<select>`.

### KPI
O dashboard gerencial, e o módulo mais pesado de frontend (quase 2.800 linhas de JS), porque concentra os gráficos: curva S de avanço físico e realizado, comparativos financeiros, indicadores de chamados por status e prioridade. Lê o payload consolidado de `/api/kpi/dados`, que junta Obras, Chamados, Atividades e Conforto numa resposta só, já que a tela precisa de um pedaço de cada módulo para montar os cards.

### Obras
O módulo mais complexo do sistema, e também o que mais deu trabalho para acertar a performance (tem uma seção de fluxo completo sobre isso mais abaixo). Uma obra tem etapas; cada etapa tem sub-tarefas; cada sub-tarefa tem itens de checklist. O avanço físico é calculado de baixo para cima, ponderado pela duração de cada item, próximo do jeito que o MS Project calcula, não uma contagem simples de quantos eu concluí. Tem uma seção só sobre esse cálculo mais abaixo, porque é a parte mais elaborada do sistema. Além do cronograma físico, tem budget/CAPEX por obra, lançamentos financeiros (o que de fato foi gasto) e revisões de budget (quando um aditivo muda o valor aprovado).

### Chamados
Chamado de manutenção/suporte: abre, acompanha status, tem SLA configurável por prioridade (quantos dias até vencer), histórico de quem fez o quê, e fotos anexadas. É o único módulo dividido em vários arquivos JS pequenos por responsabilidade (`SLA.js`, `fotos.js`, `dashboard.js`, `sidebar.js`, entre outros) em vez de um arquivo grande só. Ficou mais fácil de organizar assim porque a tela de chamados tem bastante interação diferente acontecendo ao mesmo tempo.

### Conforto
Cuida de climatização, ar-condicionado principalmente. Tem cadastro de UC (cada unidade de ar-condicionado), preventivas agendadas com checklist, manutenções corretivas com controle de peças usadas e tempo gasto (soma de sessões de trabalho, incluindo pausas), estoque de peças, requisição de peça quando falta algo, fornecedores, técnicos e rotinas de limpeza recorrente. É o módulo com mais tabelas relacionadas entre si, e por isso foi o que teve mais bug esquisito de coluna renomeada ou restrição que não devia estar ali. A seção de schema mais abaixo mostra bem essa complexidade.

### Portal QR do Conforto
Não é um módulo separado, é uma porta de entrada mais simples para o mesmo Conforto. Cada equipamento físico tem um QR code colado, e escaneando ele o técnico cai numa tela mais leve, sem precisar do login completo do sistema, para registrar que fez a preventiva daquele mês ou abrir uma corretiva ali mesmo. A autenticação desse fluxo é só um PIN, bem mais simples que o login normal.

### CODIN
Controle de acesso físico. Cadastra pessoas, pontos de acesso (portas, catracas), quais leitores cada ponto usa, e um fluxo de solicitação: alguém pede liberação de acesso a um ponto, e isso vira uma solicitação pendente até ser aprovada ou rejeitada. Tem também uma página pública de solicitação via QR code, parecida em espírito com o portal do Conforto.

### Atividades
O mais simples dos módulos: uma lista de tarefas do time, com prioridade, responsável, prazo, vínculo opcional com uma obra, progresso e comentários. Tem visão em lista e em kanban. É o único módulo cujo JavaScript vive inteiro dentro do próprio HTML, em vez de um arquivo `.js` separado. Não é o padrão do resto do projeto, mas funciona porque o módulo é pequeno.

### Admin
Gestão dos usuários que têm acesso ao sistema: criar, desativar, resetar senha. Rota protegida por `role == 'admin'` no token.

### Login
Autenticação simples: usuário e senha, valida contra o hash guardado no banco, devolve o token.

### Meus Chamados, Service Desk e Operador
Três variações de tela em cima do mesmo módulo de Chamados, pensadas para públicos diferentes. "Meus Chamados" é a visão de quem abriu o chamado, "Service Desk" é o painel de quem tria e distribui, e "Operador" é uma tela mais direta para o time de facilities executar. Não passaram pela mesma revisão de performance e cache que os módulos principais. Funcionam sobre as mesmas rotas de `/api/chamados`, então herdam o comportamento de lá, mas as telas em si nunca foram abertas linha por linha numa auditoria.

---

## Autenticação

Login manda usuário e senha para `/api/auth/login`, que confere a senha (hash com `bcrypt`) e devolve um JWT assinado com `HS256`. Esse token sai de duas formas ao mesmo tempo:

- Um cookie `ctrl-token`, `httponly` e `secure`, válido por 12 horas, que protege as páginas HTML no servidor (tentar abrir `/obras` sem esse cookie válido redireciona direto para `/login`).
- Uma cópia no `localStorage`/`sessionStorage` do navegador, que o cliente JS (`hub/api.js`) usa para anexar um header (`X-Ctrl-Token`) em toda chamada de API.

O `/admin` tem uma checagem extra: além de estar logado, o token precisa ter `role: admin`.

---

## Cache em memória

Cada módulo (Obras, Chamados, CODIN, Conforto, Atividades) segue o mesmo desenho, com duas funções.

A carga completa (`_load_X()`) lê todas as tabelas daquele módulo do banco, transforma o resultado no formato que o frontend espera (nomes de campo certos, data formatada como string, listas aninhadas) e guarda isso em memória com `cache_set`. Roda uma vez quando o app sobe, no evento `startup`, antes de aceitar tráfego, e depois de novo a cada 5 minutos, numa thread em background, como rede de segurança contra qualquer deriva.

A atualização parcial (`_atualizar_cache_X_parcial(ids)`) faz a mesma transformação, só que para um subconjunto: relê do banco apenas os registros que uma escrita específica tocou, e troca só essas entradas dentro do cache que já existia, sem reprocessar o módulo inteiro.

A parcial existe porque, sem ela, qualquer salvamento, mesmo de 1 campo, disparava o recarregamento do módulo inteiro. No caso de Obras isso significava reler e reprocessar as quase 29 obras do sistema, com todas as etapas e sub-tarefas, a cada clique de salvar. Isso foi a causa principal de um bug de performance feio, contado em detalhe no changelog.

Regra que sigo ao adicionar uma rota de escrita nova: nunca invalidar o cache sem, na mesma resposta, também recolocar ele atualizado (parcial ou completo) antes de devolver a resposta ao usuário. Invalidar sem recarregar cria uma janela em que a próxima leitura cai no recarregamento completo dentro da requisição de alguém, e foi assim que um clique de salvar virou 17 segundos de espera.

---

## Banco de dados e schema

Cada módulo tem seu próprio schema dentro do catálogo `eng_lab`:

- Chamados: `eng_lab.dashboard_labs_and_tracks_chamados`
- Obras: `eng_lab.dashboard_labs_and_tracks_obras`
- CODIN: `eng_lab.dashboard_labs_and_tracks_codin`
- Conforto: `eng_lab.dashboard_labs_and_tracks_conforto`
- Atividades: `eng_lab.dashboard_labs_and_tracks_atividades`
- Hub (config compartilhada): `eng_lab.dashboard_labs_and_tracks_hub`

A maioria das tabelas já existia no Delta Lake antes do `app.py`. Foram criadas direto no workspace do Databricks, não por uma migração versionada no código. A única exceção é `etapas_avancos`, criada automaticamente no startup do app com `CREATE TABLE IF NOT EXISTS` porque foi adicionada depois, junto com o recurso de registrar avanço pontual de etapa.

Abaixo, a estrutura das tabelas centrais de Obras e Conforto, reconstruída a partir dos `INSERT`/`MERGE` reais do backend, já que não existe um arquivo de DDL versionado à parte.

### `obras.obras`

| Coluna | Tipo | Observação |
|---|---|---|
| `cod` | STRING | chave, código da obra (ex: `OB-024`) |
| `nome` | STRING | |
| `tipo` | STRING | |
| `local` | STRING | |
| `responsavel` | STRING | id da pessoa (referencia `hub.pessoas`) |
| `respNome` | STRING | nome já resolvido, guardado junto pra evitar join no frontend |
| `cresp` | STRING | código de responsabilidade financeira |
| `status` | STRING | `Em Estudo`, `Planejado`, `Em Andamento`, `Concluído`, `Suspenso` |
| `dtInicioPrev`, `dtFimPrev` | DATE | previsão |
| `dtInicioReal`, `dtFimReal` | DATE | realizado |
| `obs` | STRING | |
| `atualizado_em` | TIMESTAMP | preenchido por `current_timestamp()` no MERGE |
| `atualizado_por` | STRING | usuário que fez a última escrita |

### `obras.etapas`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | STRING | chave |
| `obra_cod` | STRING | referencia `obras.cod` |
| `nome` | STRING | |
| `dt_inicio`, `dt_fim` | DATE | previsto |
| `dt_inicio_real`, `dt_fim_real` | DATE | realizado |
| `responsavel` | STRING | |
| `peso` | DOUBLE | calculado no frontend a partir da duração relativa entre as etapas da obra |
| `avanco_fisico` | DOUBLE | 0 a 100, soma ponderada dos itens concluídos nas sub-tarefas |
| `orcamento` | DOUBLE | |
| `ordem` | INT | posição de exibição |
| `obs` | STRING | |
| `atualizado_por` | STRING | |

### `obras.etapa_subtarefas`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | STRING | chave |
| `etapa_id` | STRING | referencia `etapas.id` |
| `obra_cod` | STRING | duplicado aqui de propósito, pra poder filtrar por obra sem join |
| `nome` | STRING | |
| `responsavel` | STRING | |
| `dt_inicio`, `dt_fim`, `dt_inicio_real`, `dt_fim_real` | DATE | |
| `orcamento` | DOUBLE | |
| `peso` | DOUBLE | |
| `avanco_fisico` | DOUBLE | |
| `status` | STRING | `Pendente`, `Em Andamento`, `Concluída`, `Bloqueada` |
| `itens` | STRING (JSON) | lista de itens de checklist, guardada como texto JSON dentro da coluna, não normalizada em tabela própria |
| `obs` | STRING | |
| `ordem` | INT | |
| `atualizado_por`, `atualizado_em` | STRING, TIMESTAMP | |

A coluna `itens` guardar JSON dentro de uma coluna STRING, em vez de uma tabela `etapa_itens` normalizada, foi uma escolha consciente. Os itens de checklist são pequenos, sempre lidos e escritos junto com a sub-tarefa inteira, e nunca precisam ser consultados isoladamente. Normalizar teria significado mais uma tabela e mais um JOIN pra algo que, na prática, sempre viaja junto.

### `obras.budget` e `obras.lancamentos`

`budget` guarda o valor aprovado por obra e CRESP (`budgetAprov`, `capex`, `opex`, `contingencia`). `lancamentos` guarda o que de fato foi gasto: cada linha é uma nota/documento (`qtd`, `precoUnit`, `nfDoc`, `fornecedor`, `dtLanc`). O realizado de uma obra é sempre `soma(qtd × precoUnit)` dos lançamentos vinculados a ela, calculado no frontend, não guardado como coluna própria.

### `conforto.preventivas` e tabelas relacionadas

Preventiva é o registro central; checklist e técnicos vinculados vivem em tabelas próprias, ligadas por `preventiva_id`:

| Tabela | Colunas principais |
|---|---|
| `preventivas` | `id`, `uc_id`, `tecnico_id`, `data_prevista`, `data_realizada`, `status`, `obs`, `origem` (`manual` ou `qr`), `inicio_em`, `fim_em`, `duracao_min`, `num_pessoas`, `foto_url` |
| `preventiva_checklist` | `preventiva_id`, `item`, `concluido` (booleano), `ordem` |
| `preventiva_tecnicos` | `preventiva_id`, `nome_tecnico` |

### `conforto.manutencoes` e tabelas relacionadas

Mesma lógica, para corretivas:

| Tabela | Colunas principais |
|---|---|
| `manutencoes` | `id`, `uc_id`, `tecnico_id`, `tipo`, `falha`, `data_abertura`, `data_fechamento`, `status`, `custo_estimado`, `obs`, `origem`, `foto_url` |
| `manutencao_sessoes` | `manutencao_id`, `tipo_sessao` (`trabalho` ou `pausa`), `inicio_em`, `fim_em`, `duracao_min`, `motivo_pausa` |
| `manutencao_tecnicos` | `manutencao_id`, `nome_tecnico` |
| `manutencao_pecas` | `manutencao_id`, `peca_id`, `nome_peca`, `quantidade` |

O tempo total gasto numa manutenção não é uma coluna. É calculado somando `duracao_min` de todas as sessões com `tipo_sessao = 'trabalho'` daquela manutenção (pausas não contam). Isso é o que permite um técnico pausar no meio de uma corretiva (foi almoçar, faltou peça) e o sistema continuar sabendo quanto tempo de trabalho efetivo foi gasto, sem contar o tempo parado.

---

## Cronograma de obras: como o avanço é calculado

Essa é a parte mais elaborada do sistema, então merece uma explicação separada.

A ideia geral é próxima do que o MS Project faz: o avanço de uma obra não é "quantas tarefas eu já concluí", é uma média ponderada pelo peso de cada pedaço, e esse peso é derivado da duração planejada, não escolhido manualmente. Isso funciona em três camadas, de baixo pra cima.

Na base estão os itens de checklist dentro de uma sub-tarefa. Cada item tem data de início e fim previstas. O peso de um item dentro da sua sub-tarefa é a duração dele (em dias) dividida pela soma das durações de todos os itens daquela sub-tarefa. Um item de 10 dias pesa mais que um de 2 dias. Se nenhum item tem data cadastrada, todos ficam com peso igual, pra não quebrar o cálculo por falta de dado.

```js
function calcularPesosItens(itens) {
  const totalDias = itens.reduce((s, it) => s + diasEntre(it.dtInicio, it.dtFim), 0);
  if (totalDias === 0) {
    const pesoIgual = itens.length ? 1 / itens.length : 0;
    return itens.map(it => ({ ...it, peso: pesoIgual }));
  }
  return itens.map(it => ({ ...it, peso: diasEntre(it.dtInicio, it.dtFim) / totalDias }));
}
```

O avanço físico da sub-tarefa é a soma dos pesos dos itens já concluídos. Se você concluiu os itens que juntos representam 60% da duração total da sub-tarefa, ela está 60% avançada, mesmo que isso seja só 2 itens de 8.

Subindo um nível: o peso de cada sub-tarefa dentro da sua etapa segue a mesma lógica, mas usando a duração da sub-tarefa inteira (do primeiro ao último item) em vez da duração de um item isolado. E o peso de cada etapa dentro da obra segue de novo a mesma lógica, uma camada acima.

O resultado prático é que uma etapa maior e mais longa pesa mais no avanço físico total da obra do que uma etapa curta, mesmo que as duas tenham a mesma quantidade de sub-tarefas. E dentro de uma etapa, uma sub-tarefa que representa metade do cronograma daquela etapa pesa metade do avanço dela, não um quarto (se houver 4 sub-tarefas) por padrão.

Duas decisões de design que valem registrar. A primeira: as datas de início e fim de uma etapa não são digitadas manualmente, são calculadas automaticamente a partir da menor e maior data entre todos os itens de checklist dela (`recalcularDatasEtapa`). Isso evita a inconsistência clássica de alguém mudar a data de um item e esquecer de atualizar a data da etapa que contém ele.

A segunda: um item concluído sempre conta 100% do peso dele, mesmo se foi terminado com atraso. O atraso não penaliza o número do avanço físico, ele aparece de outro jeito, como a distância visual entre a curva planejada e a curva realizada no gráfico do KPI. A lógica por trás disso é que "58% concluído com atraso" e "58% concluído no prazo" são, de fato, 58% de trabalho feito. Misturar isso com uma penalização numérica ia deixar o número mentiroso sobre quanto já foi entregue.

O gráfico de curva S, no módulo KPI, usa esse mesmo peso em cascata (etapa × sub-tarefa × item) pra desenhar duas linhas: o planejado, que distribui o progresso esperado de cada item entre a data de início e fim previstas, e o realizado, que faz o mesmo só que usando as datas reais. A curva do realizado para exatamente no mês atual, ela não projeta nem inventa dado que ainda não existe.

---

## Três fluxos completos, do clique ao banco

### 1. Salvar um item de budget em uma obra

Esse é o fluxo que mais mudou ao longo do projeto, então vale contar como ele funciona hoje comparado a como funcionava antes.

Você abre o detalhe de uma obra, vai na aba Budget/CAPEX, preenche o modal e clica em salvar. No frontend, isso adiciona (ou substitui) um objeto dentro de `state.budget`, o array que guarda todo o budget do sistema em memória, no navegador. Junto com isso, o id desse item é marcado como alterado num `Set` que rastreia o que mudou desde o último salvamento (`marcarSujo('budget', obj.id)`).

Isso chama `agendarSalvamento()`, que não dispara a requisição na hora. Ele espera 400ms de silêncio (via `setTimeout`) antes de chamar `salvarDados()`, pra agrupar várias edições rápidas em uma só chamada.

Quando `salvarDados()` roda, ele filtra `state.obras`, `state.budget` e `state.lancamentos` para conter apenas os itens marcados como alterados, e manda isso, não o estado inteiro, para `POST /api/obras`.

No backend, `save_obras` recebe o corpo, monta um único `MERGE` (usando `UNION ALL` de `SELECT`s parametrizados como fonte, já que o Databricks SQL não tem `executemany`) para a tabela `budget`, e executa via `arun_exec_retry`, que tenta de novo automaticamente se pegar um erro de escrita concorrente do Delta Lake.

Depois da escrita confirmada, o backend chama `_atualizar_cache_obras_parcial` só com os códigos de obra tocados. Relê do banco apenas essas obras (e o budget/lançamentos associados a elas), aplica a mesma transformação que o carregamento completo usa, e substitui essas entradas dentro do cache em memória que já existia, sem tocar nas outras obras do sistema.

Só então a resposta `{"ok": true}` volta pro frontend, que limpa o `Set` de itens alterados e atualiza o indicador visual de salvo.

Isso não foi assim desde o início. Antes, o frontend mandava sempre o estado inteiro (todas as obras, todo o budget, todos os lançamentos), e o backend recarregava o módulo inteiro a cada escrita. O resultado era 17 a 50 segundos para salvar 1 campo. O changelog conta a investigação completa disso.

### 2. Uma manutenção corretiva criada e concluída via portal QR

Um técnico escaneia o QR code colado no ar-condicionado. Isso abre `/conforto-prev/{uc_id}`, uma página independente do sistema de login principal. A autenticação aqui é só um PIN, verificado em `POST /api/conforto/portal/auth`.

Escolhendo corretiva, o técnico registra a falha, e isso vira `POST /api/conforto/manutencoes-qr`. O backend insere a linha em `manutencoes` com `origem = 'qr'` e `status = 'Em Aberto'`, insere os técnicos vinculados (se mais de um estiver no local) em `manutencao_tecnicos`, e se o técnico já marcou o horário de início, cria a primeira sessão de trabalho em `manutencao_sessoes`.

Enquanto o técnico trabalha, se precisar pausar (foi buscar uma peça, por exemplo), isso vira uma chamada a `PUT /api/conforto/manutencoes/{mid}` com uma pausa no corpo. Isso grava uma nova linha em `manutencao_sessoes` com `tipo_sessao = 'pausa'`, sem apagar a sessão de trabalho anterior.

Quando termina, `POST /api/conforto/manutencoes/{mid}/concluir` fecha a última sessão de trabalho, soma `duracao_min` de todas as sessões com `tipo_sessao = 'trabalho'` daquela manutenção (ignorando as pausas), atualiza `status` para `Concluída` e `data_fechamento`, e devolve esse tempo total somado na resposta. É isso que aparece pro gestor depois como quanto tempo essa corretiva levou de fato.

Cada uma dessas escritas passa por `_atualizar_cache_conforto_manutencoes([mid])` no final, relendo do banco só essa manutenção (com suas sessões, técnicos e peças) e atualizando o cache de Conforto sem tocar nas outras UCs.

### 3. Um chamado sendo aberto e resolvido

Alguém abre um chamado pelo formulário (ou pelo QR code de área, se for esse o fluxo). Isso vira `POST /api/chamados` com o corpo do chamado mais, opcionalmente, fotos anexadas. O backend insere a linha principal em `chamados`, e se vieram fotos, monta um único `INSERT` em lote em `fotos`, não um insert por foto.

Cada mudança de status ou responsável, feita por quem está atendendo, vira `PUT /api/chamados/{cid}`. Essa rota reescreve o histórico inteiro do chamado (`DELETE` seguido de `INSERT` em lote) em vez de tentar calcular um diff do que mudou. Como o histórico de um chamado normalmente tem poucas entradas (não centenas), reescrever tudo de novo é mais simples de manter correto do que tentar sincronizar incrementalmente, e o custo de fazer isso é pequeno.

O SLA (quantos dias até vencer, por prioridade) é uma configuração separada, guardada em `hub.sla` e lida com cache de 5 minutos no frontend. Não é recalculado por chamado, é comparado no momento de exibir a lista.

---

## API completa

Tudo que é API vive sob `/api/`. O resto das rotas serve página HTML ou arquivo estático.

### Login e Admin
- `POST /api/auth/login`: autentica, devolve o token
- `GET/POST /api/admin/usuarios`: lista e cria usuário
- `PUT /api/admin/usuarios/{uid}`: ativa/desativa
- `PUT /api/admin/usuarios/{uid}/senha`: reseta senha
- `GET /api/admin/refresh-cache`: força recarregar tudo do banco
- `GET /api/admin/debug-conforto`: rota de diagnóstico do Conforto

### Chamados
- `GET/POST /api/chamados`: lista e cria (fotos e histórico já em lote)
- `PUT /api/chamados/{cid}`: atualiza (substitui fotos e histórico)
- `DELETE /api/chamados/{cid}`: exclui
- `GET /api/chamados/por-email/{email}`: chamados de um usuário
- `GET/POST/DELETE /api/chamados/areas-qr`: áreas cadastradas para abertura via QR
- `GET/POST /api/chamados/sla`: configuração de prazo por prioridade

### Obras
- `GET/POST /api/obras`: lista e salva obras, etapas, sub-tarefas, budget e lançamentos (só o que mudou)
- `DELETE /api/obras/{cod}`: exclui obra
- `DELETE /api/obras/{cod}/etapas/{etapa_id}`: exclui etapa
- `DELETE /api/obras/budget/{bid}`: exclui item de budget
- `DELETE /api/obras/lancamento/{lid}`: exclui lançamento
- `POST /api/obras/{cod}/etapas/{etapa_id}/avanco`: registra avanço pontual
- `GET /api/obras/{cod}/avancos`: histórico de avanços

### CODIN
- `GET/POST /api/codin`: lista e salva pessoas, pontos e leitores
- `GET/POST /api/codin/solicitacoes`: lista e cria solicitação de acesso
- `PUT /api/codin/solicitacoes/{sid}`: aprova ou rejeita
- `GET /codin-qr/{codin_id}`: página pública de solicitação

### Conforto
- `GET/POST /api/conforto`: lista e salva UCs, preventivas, manutenções, peças, requisições, áreas, fornecedores, técnicos, rotinas e configuração geral
- `DELETE /api/conforto/preventivas/{pid}`: exclui preventiva
- `GET /api/conforto/manutencoes/{mid}`: detalhe de uma manutenção
- `PUT /api/conforto/manutencoes/{mid}`: atualiza status, pausas, observação
- `POST /api/conforto/manutencoes/{mid}/concluir`: conclui e soma o tempo trabalhado
- `GET /api/conforto/manutencoes/{mid}/custo-pecas`: custo total de peças usadas
- `POST /api/conforto/preventivas`: cria via portal QR
- `POST /api/conforto/manutencoes-qr`: cria corretiva via portal QR
- `POST /api/conforto/requisicoes-qr`: pede peça via portal QR
- `POST /api/conforto/portal/auth`: login simplificado do portal (PIN)
- `GET /api/conforto/portal/atividades`: pendências do técnico no portal

### Atividades
- `GET/POST /api/atividades`: lista e salva (só as modificadas)
- `DELETE /api/atividades/{aid}`: exclui
- `POST /api/atividades/{aid}/comentarios`: adiciona comentário
- `POST /api/atividades/{aid}/comentarios/rewrite`: substitui todos os comentários

### Hub e KPI
- `GET/POST /api/hub/config`: configuração central compartilhada
- `GET /api/hub/dados`: números agregados para o Hub
- `GET /api/kpi/dados`: payload consolidado de tudo, para o dashboard

---

## Frontend por dentro

Sem bundler, sem etapa de build. Cada módulo é servido como arquivo estático mesmo. Alguns padrões que se repetem em quase todo módulo:

`hub/api.js` é o único lugar que fala com o backend. Tem cache em memória por endpoint com um TTL configurável (a lista de SLA, por exemplo, fica em cache 5 minutos, já que muda pouco), e se uma resposta vier como redirect (normalmente sessão expirada), tenta de novo automaticamente antes de forçar reload da página.

`hub/auth.js` decodifica o token no próprio navegador para saber quem é o usuário logado sem precisar perguntar ao servidor de novo.

Cada módulo guarda seu próprio `state` (um objeto grande em memória, como `state.obras` ou `state.pecas`) que é populado quando a tela abre e vai sendo alterado localmente conforme o uso. Só vira uma chamada de rede quando alguém efetivamente salva.

Salvamento com espera: toda mudança chama `agendarSalvamento()`, que espera 400ms de silêncio antes de mandar ao servidor. Isso evita uma requisição por tecla digitada, e junta várias mudanças rápidas em um envio só.

Delta em Obras: diferente dos outros módulos, Obras guarda também quais itens específicos (por código ou id) foram alterados desde o último salvamento, e manda só esses no corpo da requisição, não o estado inteiro. Foi uma correção feita depois, pensada pontualmente para esse módulo por ser o mais pesado. Os outros ainda mandam o estado completo a cada save.

---

## PWA e Service Worker

O `sw.js` guarda em cache o esqueleto da aplicação (HTML/CSS/JS de cada módulo), para abrir rápido e funcionar parcialmente offline. A regra mais importante dele: nunca intercepta chamada de API. Tudo que é `/api/*` passa direto ao servidor, sem cache, sem atraso. Também cuida de notificação push e do prompt de instalar como app.

Uma coisa manual que precisa lembrar: toda vez que algum arquivo do shell muda, o nome da versão do cache (`CACHE_NAME`) dentro do `sw.js` precisa mudar também, ou os navegadores que já instalaram o app antes continuam servindo a versão antiga em cache.

---

## Deploy

Empurra para `main`, o GitHub Actions instala a CLI do Databricks e manda fazer o deploy direto do Git, sem etapa de build no meio. Houve uma fase em que os deploys ficavam travados esperando um runner do GitHub ficar livre (contada em detalhe no changelog). Hoje o workflow cancela deploys empilhados automaticamente e tem um segundo workflow que detecta quando um deploy fica preso e força ele a tentar de novo.

---

## Variáveis de ambiente

Ficam no `app.yaml` local ou na configuração do Databricks App em produção:

- `DATABRICKS_HOST`: endereço do workspace
- `DATABRICKS_TOKEN`: token de acesso
- `DATABRICKS_WAREHOUSE_ID`: qual SQL Warehouse usar
- `JWT_SECRET`: segredo que assina os tokens de sessão

Vale reforçar: nenhum valor real dessas variáveis deve ficar commitado. Se um valor real acabar indo para o repositório por engano, mesmo removendo do arquivo depois ele continua recuperável no histórico do Git. O jeito certo de resolver é trocar a credencial na origem, não só apagar a linha.

O SQL Warehouse usado hoje é Serverless, tamanho 2X-Small, com Auto Stop em 45 minutos de inatividade.

---

## Rodando local

```bash
pip install -r requirements.txt
# defina as variáveis de ambiente listadas acima antes de rodar
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Precisa que as tabelas já existam nos schemas do Delta Lake. Só a tabela de avanços de etapa (`etapas_avancos`) é criada automaticamente no primeiro start, se ainda não existir.

---

## O que ainda não está redondo

- A configuração central do Hub (`save_hub_config`) ainda substitui as tabelas inteiras a cada salvamento, sem o delta que Obras já tem. Hoje não é um problema porque o volume é pequeno, mas é o mesmo padrão que já causou dor de cabeça em Obras. Se um dia isso crescer, é o próximo lugar óbvio para aplicar a mesma correção.
- As solicitações de acesso do CODIN não entraram no cache em memória do módulo. Toda leitura dessa lista específica ainda bate direto no banco.
- Meus Chamados, Service Desk e Operador nunca passaram por uma revisão de código linha a linha como os módulos principais. Funcionam bem, mas não foram auditados.
- Cold start ainda pode acontecer se o próprio processo do app for reciclado pela plataforma depois de um tempo sem uso. Isso é independente do SQL Warehouse (que já tem 45 minutos de tolerância) e não é algo que o código em si controla.
- Não existe um arquivo de DDL versionado para as tabelas. O schema documentado acima foi reconstruído a partir dos `INSERT`/`MERGE` do backend. Se uma tabela nova for criada direto no Databricks sem atualizar este README, essa documentação começa a ficar desatualizada.