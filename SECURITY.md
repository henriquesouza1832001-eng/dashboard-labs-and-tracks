# Security Policy — Controler (ERP interno)

## Versões suportadas

| Versão | Suporte ativo |
|--------|---------------|
| `main` (produção) | ✅ Sim |
| branches de feature | ⚠️ Apenas durante o PR |
| commits fora de `main` | ❌ Não |

Este projeto não tem versionamento semântico público. O ambiente de produção corresponde sempre ao último commit na branch `main`, deployado automaticamente via GitHub Actions para o Databricks App.

---

## Reportando uma vulnerabilidade

### Canal de contato

Vulnerabilidades devem ser reportadas **de forma privada**, sem abertura de issue pública no repositório. Use um dos canais abaixo:

- **GitHub Security Advisories**: vá em `Security → Advisories → New draft security advisory` neste repositório. O conteúdo fica visível apenas para mantenedores até a divulgação controlada.
- **E-mail direto**: entre em contato com o responsável técnico do projeto diretamente (referência no README).

Não abra issues ou pull requests descrevendo a vulnerabilidade antes de um alinhamento inicial.

### O que incluir no reporte

Para agilizar a triagem, inclua:

- Descrição do problema e qual componente afeta (backend FastAPI, autenticação JWT, acesso ao Delta Lake, frontend, deploy)
- Passos para reproduzir ou prova de conceito (PoC), mesmo que parcial
- Impacto potencial: acesso indevido a dados, bypass de autenticação, execução de código, etc.
- Ambiente onde foi identificado: produção, local, CI?

### O que esperar após o reporte

| Prazo | Ação |
|-------|------|
| Até **2 dias úteis** | Confirmação de recebimento e triagem inicial |
| Até **7 dias úteis** | Avaliação de severidade e plano de resposta |
| Até **30 dias** | Correção aplicada em `main` e deployada (dependendo da criticidade) |

Vulnerabilidades críticas (acesso a dados de produção, bypass total de autenticação) serão priorizadas e podem ter ciclo de resposta mais curto.

Se o reporte for aceito, o responsável será mencionado nos créditos da correção (salvo preferência por anonimato). Se for descartado, o motivo será explicado.

---

## Superfície de ataque e áreas sensíveis

Áreas que merecem atenção especial neste projeto:

### Autenticação e sessão
- Login via JWT armazenado em cookie `httponly` + header customizado
- Tokens gerados com `PyJWT` e senhas hasheadas com `bcrypt`
- Qualquer bypass de verificação de token, reutilização de sessão expirada ou força bruta sem rate limit é considerado crítico

### Acesso ao banco (Delta Lake / Databricks SQL Warehouse)
- Queries construídas dinamicamente em `app.py`
- Risco de SQL injection se parâmetros não forem sanitizados corretamente
- Credenciais de acesso ao Databricks devem estar **exclusivamente** em secrets do GitHub Actions (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_USER`) — nunca em código ou arquivos commitados

### Deploy via GitHub Actions
- O workflow `deploy.yml` executa com acesso ao workspace Databricks em produção
- Qualquer modificação no workflow deve ser revisada com atenção redobrada
- Secrets não devem ser expostos em logs de CI

### Upload de arquivos
- O projeto usa `python-multipart` para receber uploads
- Arquivos recebidos devem ter tipo e tamanho validados antes de qualquer processamento

### Frontend (HTML/JS puro)
- Sem framework, sem build — o código vai direto para o navegador
- XSS via inserção de conteúdo não sanitizado no DOM é um risco a considerar em qualquer tela que renderize dados vindos da API

---

## Boas práticas esperadas para contribuições

- Nunca commitar segredos, tokens ou senhas (use o `.gitignore` e revise com `git diff` antes de cada push)
- Variáveis sensíveis devem ser lidas de variáveis de ambiente, nunca hardcoded
- Alterações em rotas de autenticação, manipulação de arquivos ou acesso direto ao banco requerem revisão antes do merge para `main`
- O arquivo `app.yaml` é excluído do upload no deploy propositalmente — não remova essa proteção do workflow

---

## Dependências

As dependências estão listadas em `requirements.txt`. Vulnerabilidades conhecidas em pacotes usados (FastAPI, uvicorn, PyJWT, databricks-sql-connector, bcrypt etc.) devem ser reportadas como descrito acima ou corrigidas diretamente via PR atualizando a versão afetada.

Recomenda-se revisar as dependências periodicamente com:

```bash
pip install pip-audit
pip-audit -r requirements.txt
```
