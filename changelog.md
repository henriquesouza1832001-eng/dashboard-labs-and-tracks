# Changelog

Aqui vai o histórico de mudanças, bugs e decisões que foram tomadas ao longo do projeto. Não é um changelog por versão, é mais um registro de "isso aconteceu, foi assim que resolvemos, e é bom lembrar por quê".

**Como mantenho isso atualizado:** não dá (e não vale a pena) documentar cada commit. O que faço é, no fim de cada semana ou depois de fechar algum problema mais chato, escrever uma entrada nova aqui contando o que mudou. Ajuste pequeno de CSS ou typo não entra, isso já fica registrado na mensagem do commit. O que entra aqui é decisão de arquitetura, bug que pegou geral, ou algo que eu mesmo vou querer lembrar "por que fiz assim" dentro de alguns meses.

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