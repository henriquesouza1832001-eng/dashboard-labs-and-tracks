# Changelog

Aqui vai o histórico de mudanças, bugs e decisões que foram tomadas ao longo do projeto. Não é um changelog por versão, é mais um registro de "isso aconteceu, foi assim que resolvemos, e é bom lembrar por quê".

**Como mantenho isso atualizado:** não dá (e não vale a pena) documentar cada commit. O que faço é, no fim de cada semana ou depois de fechar algum problema mais chato, escrever uma entrada nova aqui contando o que mudou. Ajuste pequeno de CSS ou typo não entra, isso já fica registrado na mensagem do commit. O que entra aqui é decisão de arquitetura, bug que pegou geral, ou algo que eu mesmo vou querer lembrar "por que fiz assim" dentro de alguns meses.

---

## Credenciais removidas do repositório de verdade

A entrada anterior deste changelog fala que eu tinha revogado e trocado os valores. O que faltou contar ali é que só trocar o valor não resolve: o `app.yaml` continuava versionado, com o `DATABRICKS_TOKEN` e o `JWT_SECRET` em texto puro desde o primeiro commit que criou o arquivo. O repositório sempre foi privado, então não houve exposição pública nesse tempo todo, mas pra poder abrir o repo (ou só dormir tranquilo sabendo que qualquer colaborador futuro não esbarra num token válido no histórico) não dava pra deixar assim.

Revoguei os dois tokens de novo, dessa vez de verdade na origem, e reescrevi o histórico do Git com `git filter-repo` pra tirar o `app.yaml` de todos os commits, não só do atual. Depois disso, `app.yaml` foi pro `.gitignore`, e as quatro variáveis (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `JWT_SECRET`) passaram a viver nos secrets/variáveis de ambiente do Databricks Apps em produção, e num `app.yaml` local que nunca sai da máquina de quem tá desenvolvendo. O `deploy.yml` já usava `secrets.DATABRICKS_TOKEN` do GitHub, então essa parte não precisou mudar.

---

## Tipos de UC e checklist por tipo, no Conforto

O problema era simples de descrever e chato de resolver: toda preventiva usava o mesmo checklist global, mas um Split tem uma lista de verificação completamente diferente de um Bebedouro Refrigerado, e forçar os dois pelo mesmo checklist significava ou item demais irrelevante ou item de menos.

Criei uma tabela `tipos_uc` no banco, com CRUD próprio em Configurações, onde cada tipo pode ter seu checklist específico. No portal QR, a escolha de qual checklist mostrar pro técnico segue uma hierarquia: primeiro o checklist da própria UC, se ela tiver um customizado; senão o checklist do tipo daquela UC; senão o checklist global, como fallback final. Os 9 tipos que antes estavam hardcoded direto no HTML foram migrados: na primeira inicialização depois dessa mudança, eles são inseridos automaticamente na tabela nova, então nenhuma UC existente ficou sem tipo.

---

## Avanço físico batendo diferente entre o KPI e Obras

Achei um bug incômodo: a curva S do gráfico no KPI e o card de percentual de avanço físico, na mesma obra, mostravam números diferentes. Óbvio que algo tava calculando errado em algum dos dois lados, a questão era achar onde.

A causa era uma divergência entre as duas implementações do mesmo cálculo. No KPI, `calcAvFis` simplesmente pulava (com um `return` antecipado) qualquer item de checklist sem data cadastrada. Já no `obras.js`, a lógica tinha um fallback: item sem data entrava no cálculo com peso igual entre os itens da mesma sub-tarefa, em vez de ser descartado. Duas fórmulas ligeiramente diferentes pro mesmo número, cada uma escrita num momento diferente do projeto sem eu perceber que tinham desalinhado.

Corrigi alinhando as duas pela lógica do `obras.js`, que é a mais correta: item sem data não desaparece do cálculo, ele entra com peso igual dividido entre os itens da sub-tarefa que não têm data.

Isso resolveu o cálculo daqui pra frente, mas não os dados que já estavam errados no banco. Como `avanco_fisico` só era recalculado quando alguém abria e salvava a sub-tarefa manualmente, um bocado de sub-tarefa antiga ficou com o campo zerado ou desatualizado, sem ninguém ter mexido nela de novo. Pra não depender de reabrir e resalvar uma por uma, criei `POST /api/admin/recalcular-avanco-obras`, uma rota de manutenção que passa por todas as sub-tarefas e etapas do banco e recalcula o avanço a partir dos itens de checklist já salvos. É rota de uso pontual, não pra ficar exposta depois de rodar uma vez.

---

## Por que salvar em Obras demorava 17 a 50 segundos

Essa foi a investigação mais longa até agora. Salvar qualquer coisa em Obras, mesmo só 1 campo de budget, demorava um absurdo, e se duas pessoas tentassem salvar coisas diferentes ao mesmo tempo, uma delas quebrava.

Fui descascando isso em camadas, e cada vez que achava a causa e corrigia, o problema voltava com outra cara.

Primeiro achei que era o jeito que o backend salvava: fazia uma chamada ao banco por etapa e por sub-tarefa, em loop, em vez de mandar tudo de uma vez. Mudei pra um único INSERT/MERGE em lote (o Databricks SQL não deixa usar executemany, então isso é feito montando um VALUES gigante com todos os parâmetros juntos).

Enquanto tava nisso, percebi que nenhuma escrita tinha retry para quando o Delta Lake reclama de escrita concorrente (o erro DELTA_CONCURRENT_APPEND, que acontece quando duas escritas batem na mesma tabela ao mesmo tempo). Sem isso, a segunda pessoa que tentasse salvar simplesmente recebia erro. Adicionei uma função de retry com espera crescente entre tentativas em todas as rotas de escrita do sistema.

Só que ao revisar essa função de retry, descobri que ela tinha sido definida errado: chamava a si mesma em loop, sem nunca de fato executar a query no banco. Ou seja, nada tava sendo salvo até estourar as tentativas e dar erro mesmo assim. Corrigi isso.

Depois de tudo isso, ainda tava em 17 segundos. Voltei a investigar e percebi que o cache do sistema tava sendo recarregado por completo (todas as quase 29 obras, com tudo dentro) a cada salvamento, e isso rodava de um jeito que, se o GET seguinte do frontend caísse no momento errado, ele esperava esse recarregamento inteiro terminar antes de responder. Troquei isso por uma atualização parcial: só relê do banco o que de fato mudou, em vez do sistema inteiro.

E mesmo assim, de novo, 17 segundos, toda vez, de forma consistente. Nesse ponto já tinha descartado cold start do warehouse (o Auto Stop dele é de 45 minutos, e os testes eram bem mais rápidos que isso) e o Service Worker (ele já deixa passar direto qualquer chamada de API, sem interceptar). A causa real, que eu não tinha olhado ainda: o frontend sempre mandava o estado inteiro da aplicação no salvamento, todas as obras, todo o budget, todos os lançamentos, não importa se você só editou 1 campo numa aba. O backend já estava rápido, mas recebia o sistema inteiro pra processar toda vez.

A correção final foi no frontend: agora ele guarda quais itens foram de fato alterados desde o último salvamento e manda só isso no payload.

**Resultado:** de 17 a 50 segundos pra cerca de 2 segundos, no mesmo teste.

**O que eu aprendi com isso:** quando algo tá lento, checar na ordem certa. O backend tá fazendo muita chamada? Tá lendo mais do banco do que precisa? E só depois, o frontend tá mandando mais dado do que devia? Essa última foi a que demorei mais pra enxergar, porque os sintomas (tempo alto, resposta pequena) apontavam só pro servidor.

---

## Bug de segurança achado no meio do caminho

Durante essa mesma revisão, achei que a rota de registrar avanço físico de uma etapa montava parte do SQL colando os valores direto na string, em vez de usar parâmetro. Isso é SQL injection clássico, mesmo sem intenção de ter feito assim. Corrigido pra usar parâmetro em tudo. Depois disso, revisei o resto do arquivo procurando o mesmo padrão e não achei outro caso igual.

---

## Auditoria do módulo Conforto

Fiz uma revisão grande no salvamento do Conforto e apareceu bastante coisa:

- Tinha uma rota GET duplicada que confundia o registro de rotas. Removida.
- Uma coluna que não existia mais na tabela de manutenções (foi normalizada pra outra tabela) ainda tava sendo referenciada. Corrigido.
- A leitura de checklist próprio de UC usava uma coluna que não existe. Corrigido pra ler da tabela certa.
- Uma condição no MERGE de manutenções impedia o dashboard de fechar manutenções que tinham sido criadas via QR code. Removida essa restrição.
- Todas as 10 funções de salvar do Conforto foram reestruturadas pra lote. Isso sozinho resolveu um timeout que acontecia com muitas UCs ou manutenções de uma vez.
- Achei um bug de digitação na rota de criar requisição via QR: a chave usada pra buscar o id da peça no corpo da requisição tava escrita errada, então toda peça salva por ali ficava sem vínculo nenhum, sem nenhum erro aparecer, só ficava silenciosamente quebrado. Corrigido.

---

## Curva S por item de checklist, em Obras

Implementei o cálculo de avanço no estilo MS Project: peso por duração de cada item, sub-tarefa e etapa, em vez de contagem simples de quantos concluí. O README tem uma seção detalhada de como isso funciona.

No caminho, dois bugs visuais que valem registrar:

- A linha do realizado no gráfico continuava reta até o fim do período mesmo depois do mês atual. Devia parar no mês corrente, não simular dado que não existe.
- Os rótulos de porcentagem no gráfico ficavam cortados pela linha tracejada de referência. Agora sempre aparecem acima do ponto, com um fundo levemente opaco pra não se perder no fundo.

---

## GitHub Actions travando na fila

Por um tempo, os deploys ficavam travados esperando um runner do GitHub ficar disponível, sem nem chegar a rodar nenhum step. Investiguei bastante achando que era algo de configuração do lado de cá, mas era instabilidade mesmo do pool de runners compartilhados do GitHub. Ajustei o workflow pra cancelar deploys empilhados automaticamente e criei um segundo workflow que detecta quando um deploy fica esperando por mais de 2 minutos e força ele a tentar de novo.

---

## Credenciais no repositório

Em algum momento notei que o arquivo de configuração do app tinha o token do Databricks e o segredo do JWT escritos direto no arquivo, versionados no Git. O repositório sempre foi privado, então não foi uma exposição pública, mas não é uma prática legal de manter, então já revoguei e troquei os dois valores.
