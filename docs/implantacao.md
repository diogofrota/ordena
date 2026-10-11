# Implantação, repositório e recuperação

## Publicação localmente preparada

A pasta recebida não continha `.git`. Não foi criado histórico, commit, repositório remoto nem publicação. O README, dependências, `.env.example`, migrações, comandos e configuração Gunicorn estão preparados para revisão e versionamento.

Após revisar os arquivos localmente, inicialize seu repositório e confira o conteúdo de `git status`/`git diff --cached` antes de qualquer commit. `.gitignore` exclui ambientes, `.env`, bancos locais, backups e arquivos gerados. Não adicione segredos com `git add -f`. As instruções de `.gitignore` não removem um segredo já existente no histórico: nesse caso, substitua a credencial e trate o histórico separadamente.

A inspeção dos arquivos de código fornecidos não identificou credenciais reais de serviços. Não havia histórico Git disponível para verificar segredos anteriormente versionados. Endereços e identidade institucional do protótipo eram fictícios. Não foram inseridas credenciais reais durante o trabalho.

## Produção

1. Defina infraestrutura, domínio, HTTPS, PostgreSQL persistente e usuário do banco com privilégios mínimos. Preserve dados do banco fora do diretório efêmero da aplicação.
2. Instale as dependências numa versão suportada do Python. Injete variáveis pelo gerenciador de segredos/ambiente do provedor; não envie `.env` para o GitHub.
3. Configure `ORDENA_ENV=production`, `SECRET_KEY`, `DATABASE_URL` e `TRUSTED_HOSTS`. Não use a chave fictícia do exemplo. Mantenha a mesma chave em todos os workers; sua substituição invalida cookies existentes.
4. Execute `flask --app wsgi:app db-upgrade` como etapa única de release, após backup e revisão. Não aplique migrações simultaneamente em todos os workers.
5. Execute `admin-cadastrar` por terminal administrativo local/seguro; entregue a senha temporária por canal apropriado. Nunca coloque a senha em argumentos de shell ou SQL.
6. Inicie `gunicorn --config gunicorn.conf.py wsgi:app` sob o supervisor da plataforma. Use um proxy HTTPS e encaminhe todos os caminhos ao Flask. O `Procfile` fornece a mesma entrada WSGI para plataformas compatíveis.
7. Verifique autenticação, troca inicial, isolamento, DNS/HTTPS, backups e restauração antes de inserir dados operacionais reais.

O servidor de desenvolvimento foi usado somente para testes locais. Gunicorn foi verificado separadamente com debug desativado. `/healthz` é público e retorna `{"status":"ok"}` sem dados internos; a monitoração de banco, métricas e alertas operacionais deverá ser configurada externamente.

### Proxy e limites de login

O Flask não habilita `ProxyFix` automaticamente. Não confie em `X-Forwarded-For` arbitrário. Configure a quantidade de proxies confiáveis somente após definir sua infraestrutura. Na configuração atual, IP é o da conexão direta: usuários atrás do mesmo proxy compartilham um limite de 30 tentativas em 15 minutos, além do limite de 10 por e-mail em 15 minutos. Tentativas bem-sucedidas também contam nessa janela. Os contadores são compartilhados entre workers através do banco; a troca de senha usa limite de 10 por usuário.

Cookies Secure exigem HTTPS em produção. O proxy deve preservar o domínio permitido no `Host`; `TRUSTED_HOSTS` restringe os hosts aceitos. HSTS é emitido em produção; não ative o ambiente de produção num endpoint HTTP destinado aos usuários.

### Evolução do esquema

As migrações versionadas representam a estrutura efetiva. A primeira migração é aditiva. Antes de futuras alterações, gere/revise o script em ambiente de desenvolvimento, confira índices, FKs e a preservação de dados, e teste num clone sem dados sensíveis. O projeto não oferece um comando de downgrade destrutivo. Não use `drop_all`, não apague bancos nem use `stamp head` para simular a aplicação de uma migração que falhou.

## Backup e restauração PostgreSQL

Use as ferramentas `pg_dump`, `pg_restore` e `psql` da versão compatível com seu servidor. Proteja credenciais com `.pgpass` (permissões `0600`) ou o mecanismo seguro do provedor; não inclua senhas em comandos. Os exemplos abaixo usam nomes fictícios, sem segredo.

Backup consistente de banco real, sem interromper a aplicação:

```bash
pg_dump --host HOST_DO_BANCO --username USUARIO_BACKUP --dbname ordena \
  --format custom --file /DIRETORIO_PROTEGIDO/ordena.dump
```

Mantenha cópias fora do servidor da aplicação, criptografadas, com retenção e testes periódicos. Backups contêm dados pessoais e hashes; não os publique no GitHub. Defina frequência e retenção de acordo com o uso real.

Teste de restauração em **novo banco vazio**, com acesso restrito:

```bash
createdb --host HOST_DO_BANCO --username USUARIO_ADMIN ordena_restauracao
pg_restore --host HOST_DO_BANCO --username USUARIO_ADMIN \
  --dbname ordena_restauracao --no-owner --no-acl /DIRETORIO_PROTEGIDO/ordena.dump
```

O backup inclui `alembic_version`; após restaurar, revise a versão da aplicação e aplique apenas migrações posteriores quando necessário. Teste integridade e fluxos antes de redirecionar qualquer aplicação. Não use `--clean`, nem restaure sobre um banco em uso sem decisão explícita de recuperação. Reinicie sessões/invalide contas se o procedimento de recuperação exigir isso; não exponha a cópia restaurada publicamente.

Para desenvolvimento SQLite, com a aplicação parada, copie `instance/ordena.db` para um diretório protegido. Para backups com a aplicação em execução, use a API de backup do SQLite. SQLite não é a configuração de produção permitida.

## Dados antigos

O armazenamento do protótipo no navegador não foi apagado. Uma importação futura precisa confirmar a prefeitura proprietária, preservar snapshots, normalizar identidades e passar pela validação do servidor. Não copie manualmente os dados para tabelas sem verificar as relações. Não há importador automático entregue nesta etapa.
