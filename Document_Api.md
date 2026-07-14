# API do Controler

Referência das rotas do backend. Não é tutorial, é descrição de comportamento: o que cada rota faz de verdade, incluindo o que é persistido em batch, o que atualiza no cache, e efeitos colaterais que não ficam óbvios só olhando o corpo da requisição.

---

## Visão geral

**Base URL:** a URL do Databricks App onde o Controler está publicado. Todas as rotas abaixo são relativas a ela, sob o prefixo `/api/`. O resto das rotas (fora de `/api/`) serve página HTML ou arquivo estático do frontend.

**Autenticação:** login em `/api/auth/login` devolve um JWT assinado com HS256. Esse token vai pro cliente de duas formas ao mesmo tempo: um cookie `ctrl-token`, `httponly` e `secure`, que o servidor usa pra proteger as páginas HTML (tentar abrir uma rota protegida sem cookie válido redireciona pro login); e uma cópia guardada no navegador que o `hub/api.js` usa pra mandar em todo request via header `X-Ctrl-Token`. As rotas de backend aceitam o token por qualquer um dos dois caminhos. Rotas administrativas checam além disso se o token tem `role: admin`; sem isso, devolvem 403 mesmo com um token válido de usuário comum.

O portal QR do Conforto tem uma autenticação à parte, mais simples: um PIN em vez de usuário e senha, que devolve um JWT de vida curta, escopado só pras rotas do portal.

**Convenção de resposta:** sucesso normalmente devolve `{"ok": true}`, às vezes com dado extra relevante junto (como `duracaoTotal` no fechamento de manutenção). Falha devolve `{"erro": "..."}` com uma mensagem descrevendo o que quebrou. Validação de corpo malformado ou autenticação ausente usa os status HTTP padrão (401 sem token, 403 sem permissão, 404 quando o recurso não existe, 500 quando algo quebra no meio do caminho, geralmente na conversa com o SQL Warehouse).

---

## Auth e Admin

**`POST /api/auth/login`** — recebe `email` e `senha`. Confere a senha contra o hash guardado no banco usando `bcrypt`. Se bater, monta o JWT com os dados do usuário (incluindo `role`), assina, e devolve tanto no cookie `ctrl-token` quanto no corpo da resposta em JSON, pro frontend guardar e usar no header das próximas chamadas.

**`GET /api/admin/refresh-cache`** — só admin. Dispara `_load_X()` de todos os módulos (Obras, Chamados, CODIN, Conforto, Atividades) na hora, fora do ciclo normal de 5 minutos. Existe pra quando algo foi alterado direto no banco, fora do fluxo normal da aplicação, e precisa refletir no cache sem esperar o próximo ciclo automático.

**`GET/POST /api/admin/usuarios`** — GET lista os usuários cadastrados; POST cria um novo, com a senha já convertida pra hash `bcrypt` antes de gravar (nunca guarda senha em texto puro).

**`PUT /api/admin/usuarios/{uid}`** — ativa ou desativa o usuário. Usuário desativado continua existindo no banco, só não consegue mais autenticar.

**`PUT /api/admin/usuarios/{uid}/senha`** — reseta a senha de um usuário, gerando o hash novo a partir do valor recebido.

**`POST /api/admin/recalcular-avanco-obras`** — rota de manutenção pontual. Passa por todas as sub-tarefas e etapas do banco e recalcula `avanco_fisico` de cada uma a partir dos itens de checklist já salvos, usando a mesma fórmula ponderada por duração do resto do sistema. Foi criada pra corrigir um lote de dados históricos que ficou com o campo zerado (o valor só era recalculado quando alguém abria e resalvava a sub-tarefa manualmente). É pra rodar uma vez e remover depois, não uma rota que deveria continuar exposta indefinidamente.

---

## Chamados

**`GET /api/chamados`** — devolve direto do cache em memória, sem tocar no banco. O payload já vem com fotos e histórico aninhados dentro de cada chamado, não como coleções separadas que o frontend precisaria juntar.

**`POST /api/chamados`** — insere o chamado principal e, se vieram fotos junto, insere todas elas num único `INSERT` em lote (não um insert por foto). Depois de gravar, atualiza o cache com o chamado novo sem precisar recarregar a lista inteira.

**`PUT /api/chamados/{cid}`** — atualiza os campos do chamado. Fotos e histórico não são atualizados incrementalmente: a rota apaga tudo que existia (`DELETE`) e insere de novo em lote (`INSERT`) a partir do que veio no corpo. Como o volume por chamado costuma ser pequeno, reescrever tudo é mais simples de manter correto do que calcular um diff.

**`DELETE /api/chamados/{cid}`** — exclui o chamado e as linhas dependentes (fotos, histórico), e remove a entrada do cache.

**`GET /api/chamados/por-email/{email}`** — filtra os chamados abertos por um email específico, direto do cache.

**`GET/POST/DELETE /api/chamados/areas-qr`** — CRUD das áreas cadastradas pra abertura de chamado via QR code, sem passar pelo login completo.

**`GET/POST /api/chamados/sla`** — configuração de prazo (em dias) por prioridade. É lida com cache de 5 minutos no frontend e comparada no momento de exibir a lista, não recalculada por chamado.

---

## Obras

**`GET /api/obras`** — devolve o payload completo do cache: todas as obras, cada uma já com suas etapas e sub-tarefas aninhadas, mais budget, lançamentos e avanços. É o maior payload do sistema, e por isso é o módulo que mais se beneficiou de nunca bater no banco numa leitura comum.

**`POST /api/obras`** — salva delta, não o estado inteiro. Corpo esperado: `{obras: [...], budget: [...], lancamentos: [...]}`, contendo só os itens que de fato mudaram desde o último salvamento (o frontend rastreia isso e filtra antes de mandar). Etapas e sub-tarefas são gravadas com `DELETE` seguido de `INSERT` em lote por `obra_cod`; obras, budget e lançamentos usam `MERGE`, montado com `UNION ALL` de `SELECT`s parametrizados como fonte, já que o Databricks SQL não tem `executemany`. Toda a escrita passa por `arun_exec_retry`, que reexecuta automaticamente em caso de `DELTA_CONCURRENT_APPEND`. Depois da escrita confirmada, chama `_atualizar_cache_obras_parcial` só com os códigos de obra tocados, relendo do banco apenas essas obras e substituindo essas entradas no cache já existente.

**`DELETE /api/obras/{cod}`** — exclui a obra do banco e atualiza o cache em memória diretamente removendo a entrada, sem reler nada do banco depois.

**`DELETE /api/obras/{cod}/etapas/{etapa_id}`** — exclui a etapa junto com suas sub-tarefas e os avanços pontuais registrados pra ela.

**`DELETE /api/obras/budget/{bid}`** — exclui um item de budget/CAPEX.

**`DELETE /api/obras/lancamento/{lid}`** — exclui um lançamento financeiro.

**`POST /api/obras/{cod}/etapas/{etapa_id}/avanco`** — registra um avanço pontual, fora do cálculo automático por checklist. Corpo: `valor`, `nomeEtapa`, `registradoPor`. Grava uma linha nova em `etapas_avancos` (a única tabela criada automaticamente pelo app no startup, via `CREATE TABLE IF NOT EXISTS`).

**`GET /api/obras/{cod}/avancos`** — histórico de avanços pontuais registrados pra uma obra, em ordem cronológica.

---

## CODIN

**`GET/POST /api/codin`** — GET lista pessoas, pontos de acesso e leitores; POST salva o que vier no corpo, seguindo o mesmo padrão de escrita em lote dos outros módulos.

**`GET/POST /api/codin/solicitacoes`** — lista solicitações de liberação de acesso e cria uma nova. Diferente do resto do CODIN, essa lista não entrou no cache em memória do módulo: toda leitura bate direto no banco.

**`PUT /api/codin/solicitacoes/{sid}`** — aprova ou rejeita uma solicitação. Corpo: `status`, com valor `aprovado` ou `rejeitado`.

---

## Conforto

**`GET /api/conforto`** — devolve o payload completo do cache: UCs, preventivas, manutenções, peças, requisições, áreas, fornecedores, técnicos, rotinas, tipos de UC e configuração geral do módulo, tudo numa resposta só.

**`POST /api/conforto`** — salva o que vier no corpo. O comportamento de cache depende da tabela: as que fazem replace total (técnicos, ordens, peças, entre outras) disparam um `_load_conforto()` completo depois de gravar; as que têm merge seletivo (UCs, preventivas, manutenções) usam as funções `_atualizar_cache_conforto_*` parciais, relendo do banco só os registros tocados.

**`DELETE /api/conforto/preventivas/{pid}`** — exclui uma preventiva e o checklist e técnicos vinculados a ela.

**`GET /api/conforto/manutencoes/{mid}`** — detalhe completo de uma manutenção corretiva: sessões de trabalho e pausa, técnicos envolvidos, peças usadas.

**`PUT /api/conforto/manutencoes/{mid}`** — atualiza status, registra pausa e atualiza observação. Uma pausa nova vira uma linha em `manutencao_sessoes` com `tipo_sessao = 'pausa'`, sem apagar a sessão de trabalho anterior.

**`POST /api/conforto/manutencoes/{mid}/concluir`** — fecha a manutenção. Soma `duracao_min` de todas as sessões com `tipo_sessao = 'trabalho'` daquela manutenção, ignorando as sessões de pausa, atualiza `status` pra `Concluída` e `data_fechamento`, e devolve esse total somado como `duracaoTotal` na resposta.

**`GET /api/conforto/manutencoes/{mid}/custo-pecas`** — soma `quantidade × custo_unitario` de todas as peças vinculadas à manutenção, e devolve o total.

**`POST /api/conforto/preventivas`** — cria uma preventiva via portal QR. Campos: `ucId`, `tecnicoId`, `checklist`, `obs`, `fotoUrl`.

**`POST /api/conforto/manutencoes-qr`** — cria uma corretiva via portal QR. Campos: `ucId`, `falha`, `tecnicoId`, `inicioEm`, `numPessoas`. A linha em `manutencoes` já sai com `origem = 'qr'`; se o horário de início veio preenchido, já cria a primeira sessão de trabalho junto.

**`POST /api/conforto/requisicoes-qr`** — cria requisição de peça via portal QR. Campo: `requisicoes`, uma lista de objetos `{id, pecaId, quantidade, destino, solicitante}`, permitindo pedir mais de uma peça numa única chamada.

**`POST /api/conforto/portal/auth`** — autenticação do portal QR. Campo: `pin`. Se válido, devolve um JWT de vida curta, escopado só pras rotas do portal, diferente do token de login normal do sistema.

**`GET /api/conforto/portal/atividades`** — devolve manutenções e preventivas pendentes pro técnico autenticado via PIN, filtradas pelo escopo do token do portal.

**`GET/POST /api/conforto/tipos-uc`** — GET lista os tipos de UC cadastrados, cada um com seu checklist próprio (se tiver); POST salva um tipo novo ou atualiza um existente. É a rota por trás do CRUD de tipos em Configurações.

**`DELETE /api/conforto/tipos-uc/{tid}`** — exclui um tipo de UC. UCs que apontam pra esse tipo não são apagadas junto; elas simplesmente deixam de ter checklist de tipo, e o portal QR cai pro checklist global como fallback.

---

## Atividades

**`GET/POST /api/atividades`** — GET lista todas; POST salva só as que foram marcadas como modificadas no frontend (via `marcarSujo`), seguindo o mesmo espírito do delta de Obras, embora de forma mais simples.

**`DELETE /api/atividades/{aid}`** — exclui a atividade e os comentários vinculados a ela.

**`POST /api/atividades/{aid}/comentarios`** — adiciona um comentário novo à atividade, sem tocar nos que já existiam.

**`POST /api/atividades/{aid}/comentarios/rewrite`** — substitui todos os comentários da atividade de uma vez, em vez de adicionar. Usado quando o frontend precisa sincronizar a lista inteira de uma tacada.

---

## Hub e KPI

**`GET/POST /api/hub/config`** — configuração central compartilhada entre módulos: pessoas, CRESP, tipos de obra, categorias de custo, leitores de acesso. Obras e CODIN consultam isso pra popular seus próprios formulários.

**`GET /api/hub/dados`** — indicadores agregados pro card do Hub (total de chamados, obras em andamento, esse tipo de número resumido).

**`GET /api/kpi/dados`** — payload consolidado, juntando pedaços de Obras, Chamados, Atividades e Conforto numa resposta só. É o que alimenta o dashboard gerencial, já que os gráficos ali precisam de dado de mais de um módulo ao mesmo tempo.

---

## Restrições do Databricks SQL

Três limitações do SQL Warehouse que moldaram boa parte de como as rotas de escrita são implementadas:

**Sem `executemany`.** O conector não suporta inserir várias linhas com uma lista de parâmetros de uma vez, no estilo comum de outros bancos. O jeito de inserir em lote é montar um único `INSERT` com múltiplos `VALUES`, ou um `MERGE` usando `UNION ALL` de `SELECT`s parametrizados como fonte de dados. Todas as rotas que gravam mais de uma linha (fotos de chamado, checklist de preventiva, etapas de obra) usam um desses dois padrões, nunca um loop de inserts individuais.

**Sem transação multi-statement.** Não dá pra abrir uma transação, rodar várias queries e só então decidir se commita ou reverte tudo junto. Cada `INSERT`/`MERGE`/`DELETE` é atômico por si só, mas uma sequência de várias operações não é atômica como conjunto. Isso influencia a ordem em que as rotas gravam (por exemplo, apagar antes de inserir de novo, em vez de tentar um upsert mais sofisticado que dependeria de transação).

**`DELTA_CONCURRENT_APPEND`.** Erro que o Delta Lake devolve quando duas escritas concorrentes tentam mexer na mesma tabela ao mesmo tempo. Em vez de deixar isso virar erro pro usuário, toda rota de escrita passa pela função `arun_exec_retry`, que reexecuta a query automaticamente, com espera crescente entre tentativas, até ter sucesso ou esgotar o número de tentativas.

---

## Service Worker e cache do frontend

O frontend tem dois níveis de cache, e vale não confundir os dois. O `hub/api.js` mantém um cache em memória, no navegador, com TTL configurável por endpoint (a lista de SLA, por exemplo, fica 5 minutos, já que muda pouco). Isso não tem nada a ver com o `sw.js`, o Service Worker, que guarda em cache os arquivos estáticos do shell da aplicação (HTML/CSS/JS de cada módulo) pra abrir rápido e funcionar parcialmente offline. O `sw.js` nunca intercepta chamada de API, tudo que é `/api/*` passa direto ao servidor.

Toda vez que um deploy muda algum arquivo JS ou CSS do shell, é preciso incrementar `CACHE_NAME` dentro do `sw.js`. Sem isso, navegadores que já instalaram o app antes continuam servindo a versão antiga em cache, mesmo depois do deploy novo no ar.
