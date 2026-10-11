# Ordena — Gestão de Operações

O Ordena organiza recursos, efetivo, locais, ordens de serviço e ativações operacionais de uma prefeitura. A interface HTML/CSS/JavaScript existente foi mantida e integrada a um backend Python/Flask com banco persistente e autenticação.

Todos os usuários têm as mesmas permissões funcionais. Cada conta pertence a **uma prefeitura e uma secretaria/setor administrativo** e acessa somente os dados dessa prefeitura. Secretarias da mesma prefeitura compartilham seus dados operacionais. Não há cadastro público.

## Funcionalidades

- Painel de indicadores; cadastro e inativação de carros, motos e policiais.
- Pontos de baseamento e áreas de patrulhamento com mapas e polígonos.
- Tipos de serviço, ordens com atividades e horários, cópia e impressão de OS.
- Operações especiais, períodos, avaliações e consulta de pontos vinculados.
- Ativação de equipes/recursos, baixa manual, histórico e relatórios de impressão/PDF.
- Mapa tático com programação da OS e monitoramento GPS pela API Cecoco, comparando a posição da viatura com a atividade planejada no navegador.
- Login/logout, telefone do perfil e troca da própria senha; troca obrigatória no primeiro acesso.
- Cabines e setores operacionais mantêm o suporte legado, mas não possuem telas próprias de cadastro.

## Tecnologias e estrutura

Python 3.9 ou superior (prefira uma versão suportada atual em produção), Flask, Flask-SQLAlchemy/SQLAlchemy, Flask-WTF para CSRF, Alembic para migrações, PostgreSQL/psycopg e Gunicorn. SQLite serve ao desenvolvimento e aos testes locais. HTML, CSS e JavaScript continuam sem framework; Leaflet/OpenStreetMap, Nominatim, Chart.js e html2pdf.js exigem internet. O CSS próprio, inclusive Growing Dots, foi reutilizado; o projeto não usa Bootstrap.

```text
backend/             configuração, modelos, rotas, validação/transações e CLI
migrations/          esquema versionado (fonte de referência)
templates/           páginas existentes e login.html
js/                  módulos existentes, api_storage.js e login.js
css/, assets/        identidade visual existente
wsgi.py              entrada WSGI
gunicorn.conf.py     configuração do servidor de produção
requirements.txt     dependências diretas com versões compatíveis
tests/               testes Python e JavaScript
docs/                banco, implantação, análise e verificações
instance/            banco local, ignorado pelo Git
```

O menu permanece em `js/menu.js`. O adaptador `js/api_storage.js` mantém um cache **em memória**, carregado pelo Flask antes dos scripts das páginas. As alterações aguardam a API autenticada; o navegador deixa de ser o armazenamento principal. Impressões usam dados temporários em `sessionStorage`, separados por conta/prefeitura. O `localStorage` antigo permanece intacto e não é importado automaticamente.

## Monitoramento GPS no mapa tático

O controle de monitoramento dos cartões consulta diretamente `GET https://cecoco-api-production.up.railway.app/recursos`. A API é pública, permite acesso por CORS e é chamada sem credenciais. O campo `radio` cadastrado na viatura deve corresponder ao campo `identificador` do JSON; a posição usa `latitude` e `longitude`, e a atualidade usa `ultima_coleta`.

Ao ligar o primeiro cartão, a consulta é imediata. Enquanto houver cartões ligados, uma consulta compartilhada atualiza as equipes monitoradas a cada **três minutos**. O navegador seleciona os identificadores das viaturas da ativação e compara as posições com a atividade atual da OS. Para baseamento, vale um raio de **20 metros** em torno do ponto, independentemente do raio exibido no mapa. Para patrulhamento, a posição deve estar no interior ou na borda do polígono, sem margem externa.

Os cartões indicam **NÃO MONITORADO**, **NO PONTO**, **FORA DO PONTO** ou **SEM DADOS**, com o indicador de carregamento existente durante a consulta. Identificador ausente, coordenadas inválidas, falha da API ou `ultima_coleta` com mais de dez minutos resultam em **SEM DADOS**. Desligar o último cartão interrompe as consultas. O monitoramento funciona somente enquanto a página está aberta; as posições e comparações GPS não são processadas pelo backend nem gravadas no banco.

## Instalação local

Pré-requisitos: Python com `venv` e `pip`; Node.js para os testes JavaScript. PostgreSQL é obrigatório em produção.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Cole a chave gerada em `SECRET_KEY` no `.env`; não use o marcador do exemplo e não publique a chave. O arquivo `.env` é lido pela aplicação e ignorado pelo Git.

| Variável | Finalidade |
| --- | --- |
| `ORDENA_ENV` | `development`, `testing` ou `production`; padrão `development` |
| `SECRET_KEY` | Chave aleatória de sessão e CSRF; obrigatória, 32+ caracteres em produção |
| `DATABASE_URL` | Desenvolvimento: `sqlite:///ordena.db` (em `instance/`). Produção: `postgresql+psycopg://usuario:senha@host:5432/ordena` |
| `TRUSTED_HOSTS` | Hosts separados por vírgula; obrigatório em produção, sem protocolo ou caminho |
| `GUNICORN_BIND` | Padrão `127.0.0.1:8000`; ajuste conforme o proxy/plataforma |
| `GUNICORN_WORKERS` | Padrão `2`; dimensionar conforme a infraestrutura |
| `ORDENA_TEST_DATABASE_URL` | Opcional, exclusivamente PostgreSQL descartável cujo nome contenha `ordena_test` |

Senhas com caracteres reservados na URL do banco precisam de codificação de URL. Configure TLS do PostgreSQL conforme seu provedor, por exemplo com `?sslmode=verify-full` e o certificado apropriado.

### Banco e migrações

No PostgreSQL, crie antes um banco vazio e um usuário próprio da aplicação, usando a administração do seu ambiente. Não use o superusuário do banco como conta da aplicação.

```bash
flask --app wsgi:app db-upgrade
flask --app wsgi:app admin-cadastrar
flask --app wsgi:app admin-listar
flask --app wsgi:app run --host 127.0.0.1 --port 8765
```

Acesse `http://127.0.0.1:8765/`. O comando `admin-cadastrar` solicita prefeitura, secretaria/setor, nome, e-mail e senha temporária de 12 a 128 caracteres. A senha é digitada de modo oculto, com confirmação, sem argumentos de terminal. Instituições de mesmo nome são reutilizadas; e-mails são únicos em todo o sistema. Não há senha inicial fixa.

`db-upgrade` aplica as migrações até `head`, inclusive numa instalação vazia, e pode ser repetido. Não há `create_all` em produção. A primeira migração apenas cria estruturas; se um banco já possuir tabelas incompatíveis, pare e revise a origem dele, sem usar `stamp` ou apagar dados para contornar o erro. Downgrades destrutivos estão desabilitados.

SQL para revisão é **gerado a partir das mesmas migrações**, no dialeto de `DATABASE_URL`, sem executar:

```bash
flask --app wsgi:app db-sql > /tmp/ordena-schema.sql
```

Não mantenha esse arquivo como uma segunda definição independente do esquema. Para uma futura evolução, gere em desenvolvimento com `flask --app wsgi:app db-revision --mensagem "Descrição da mudança"` e revise o script antes de aplicá-lo; consulte [o banco](docs/banco.md).

### Login, primeiro acesso e administração

O primeiro login abre Meu Perfil e exige a senha atual e uma nova senha diferente de 12 a 128 caracteres. Até a troca, as páginas e APIs de negócio permanecem bloqueadas. Depois da confirmação, abra Início pelo menu. Trocas de senha revogam as demais sessões; logout revoga a sessão atual no servidor. Cookies são HttpOnly/SameSite=Lax e Secure em produção HTTPS; sessões expiram em oito horas.

```bash
flask --app wsgi:app admin-usuario operador@example.test --inativar
flask --app wsgi:app admin-usuario operador@example.test --reativar
flask --app wsgi:app admin-usuario operador@example.test --redefinir-senha
```

A redefinição solicita uma senha temporária oculta e reativa a exigência de troca; não reativa uma conta inativa automaticamente. As ações invalidam as sessões anteriores. Consulta SQL e relações estão em [docs/banco.md](docs/banco.md); senhas nunca devem ser gravadas em texto puro por SQL.

## Produção

Configure `ORDENA_ENV=production`, PostgreSQL, uma chave aleatória e `TRUSTED_HOSTS` com o domínio real. A inicialização recusa SQLite, a chave de exemplo e hosts ausentes nesse ambiente. Não habilite debug.

```bash
flask --app wsgi:app db-upgrade
gunicorn --config gunicorn.conf.py wsgi:app
```

Use HTTPS em um proxy reverso/plataforma e encaminhe as requisições ao Gunicorn. **Encaminhe também `/templates`, `/js` e `/api` ao Flask**: não publique `templates/` como arquivos estáticos, pois a autenticação e a carga inicial são feitas no servidor. Não sirva a raiz do repositório com `python -m http.server` em produção. Os únicos caminhos públicos são `/login`, `/healthz`, o script de login, CSS compartilhado e favicon. `/healthz` informa apenas a disponibilidade HTTP, sem testar o banco.

Não confie em cabeçalhos de proxy recebidos diretamente da internet. O limitador usa o IP da conexão e o e-mail: atrás de proxy, o limite por IP será compartilhado até configurar uma cadeia confiável de proxies. Consulte [implantação](docs/implantacao.md), com backup e restauração. Não houve publicação no GitHub nem implantação externa.

As configurações seguem as orientações oficiais de [segurança do Flask](https://flask.palletsprojects.com/en/stable/web-security/) e [servidores de produção](https://flask.palletsprojects.com/en/stable/deploying/).

## Testes

```bash
python -m pytest tests/test_backend.py -q
node --test tests/*.test.js
for arquivo in js/*.js; do node --check "$arquivo" || exit 1; done
```

A suíte Python usa bancos SQLite temporários, cria o esquema por migração e exercita o cadastro administrativo. Para testar PostgreSQL, crie **um banco descartável isolado**, com nome contendo `ordena_test`, e configure `ORDENA_TEST_DATABASE_URL` somente no processo de teste. A suíte limpa os registros desse banco entre testes. **Nunca aponte essa variável para um banco real**, nem execute os testes com credenciais de produção.

Resultados e alcance das verificações estão em [docs/verificacao.md](docs/verificacao.md).

## Arquitetura implementada

```mermaid
flowchart LR
    U[Usuário] --> UI[HTML / CSS / JavaScript existente]
    UI -->|Cookie + CSRF / leitura e gravação| F[Flask]
    F --> A[Autenticação / sessão revogável / senha temporária]
    F --> V[Validação / isolamento por prefeitura / transação com versão]
    A --> DB[(PostgreSQL em produção)]
    V --> DB
    CLI[Comandos administrativos locais] --> F
    MIG[Migrações Alembic] --> DB
    UI --> EXT[Mapas / gráficos / PDF externos]
    UI -->|GPS a cada três minutos| GPS[API Cecoco / recursos]
```

## Modelo de dados implementado

`dados` preserva documentos operacionais existentes: atividades de OS, equipes, coordenadas, avaliações e snapshots. Os relacionamentos institucionais e a vinculação da ativação à OS têm chaves estrangeiras; os vínculos internos dos documentos são descritos em [docs/banco.md](docs/banco.md).

```mermaid
erDiagram
    prefeituras ||--o{ secretarias : possui
    prefeituras ||--o{ usuarios : vincula
    secretarias ||--o{ usuarios : lota
    usuarios ||--o{ sessoes : autentica
    usuarios ||--o{ auditoria : registra
    prefeituras ||--o{ auditoria : delimita
    prefeituras ||--o{ viaturas : possui
    prefeituras ||--o{ policiais : possui
    prefeituras ||--o{ cabines : possui
    prefeituras ||--o{ setores_operacionais : possui
    prefeituras ||--o{ baseamentos : possui
    prefeituras ||--o{ patrulhamentos : possui
    prefeituras ||--o{ tipos_servico : possui
    prefeituras ||--o{ operacoes_especiais : possui
    prefeituras ||--o{ ordens_servico : possui
    prefeituras ||--o{ ativacoes : possui
    prefeituras ||--o{ historico_ativacoes : possui
    ordens_servico ||--o{ ativacoes : referencia
    ordens_servico ||--o{ historico_ativacoes : referencia
    prefeituras { int id PK string nome UK int versao }
    secretarias { int id PK int prefeitura_id FK string nome }
    usuarios { int id PK int prefeitura_id FK int secretaria_id FK string email UK string senha_hash boolean senha_temporaria boolean ativo int sessao_versao }
    sessoes { string id PK int usuario_id FK datetime expira_em }
    limites_login { string chave PK int tentativas datetime inicio }
    auditoria { int id PK int prefeitura_id FK int usuario_id FK datetime criado_em string acao json colecoes }
    viaturas { int id PK int prefeitura_id FK string chave json dados }
    policiais { int id PK int prefeitura_id FK string chave json dados }
    cabines { int id PK int prefeitura_id FK string chave json dados }
    setores_operacionais { int id PK int prefeitura_id FK string chave json dados }
    baseamentos { int id PK int prefeitura_id FK string chave json dados }
    patrulhamentos { int id PK int prefeitura_id FK string chave json dados }
    tipos_servico { int id PK int prefeitura_id FK string chave json dados }
    operacoes_especiais { int id PK int prefeitura_id FK string chave json dados }
    ordens_servico { int id PK int prefeitura_id FK string chave json dados }
    ativacoes { int id PK int prefeitura_id FK string chave string os_chave FK boolean arquivado json dados }
    historico_ativacoes { int id PK int prefeitura_id FK string chave string os_chave FK json dados }
```

Todas as tabelas operacionais também possuem `posicao` e `arquivado`; a combinação `(prefeitura_id, chave)` é única. A FK de OS e a FK de secretaria são compostas e impedem vínculos entre prefeituras.

## Fluxo de autenticação implementado

```mermaid
flowchart TD
    P[Página ou API protegida] --> S{Sessão válida e conta ativa?}
    S -->|Não| L[Login / API retorna 401]
    L --> C[CSRF + limite de tentativas + verificação do hash]
    C -->|Falha| E[Erro genérico ou limite 429]
    C -->|Sucesso| T{Senha temporária?}
    S -->|Sim| T
    T -->|Sim| M[Meu Perfil / negócio bloqueado]
    M --> N[Senha atual + nova senha válida]
    N --> R[Grava hash / revoga outras sessões]
    R --> B[Negócio da prefeitura vinculada]
    T -->|Não| B
    B --> O[Logout POST com CSRF]
    O --> X[Revoga sessão no banco / limpa cookie]
    X --> L
```

## Limitações e configuração externa

- A migração é incremental: atividades, avaliações e equipes continuam documentos JSON, sem tabelas próprias. Não há integridade SQL para todos os vínculos internos, apenas validação do servidor para os acessos implementados; não edite JSON diretamente em produção.
- O modelo de compatibilidade envia coleções inteiras e usa uma versão global por prefeitura. Edições simultâneas detectadas exigem atualizar a tela e repetir a alteração. Para volumes grandes, serão necessários endpoints por registro e paginação.
- A interface legada usa interpolação HTML em alguns módulos. A API rejeita textos com `<`, `>`, `&`, aspas, crase, barra invertida e NUL para bloquear injeção nesses caminhos. Uma evolução localizada desses renderizadores permitirá ampliar os caracteres aceitos com segurança.
- A auditoria registra usuário, instante, ação e coleções, sem snapshots completos de antes/depois.
- O mapa exibe a programação carregada ao abrir a página; alterações feitas em outras sessões exigem recarregamento. As posições GPS são atualizadas pela consulta externa enquanto o monitoramento estiver ligado nessa página.
- O navegador antigo não é importado automaticamente. Os dados antigos foram preservados; uma importação deve ser revisada e vinculada explicitamente à prefeitura correta.
- Nenhum banco operacional real, usuário real, credencial de produção, domínio, proxy HTTPS, serviço de hospedagem ou backup agendado foi configurado. A administração deve realizar esses passos antes do uso real.
- Bibliotecas externas são carregadas por CDN conforme o frontend original; disponibilidade offline e hospedagem local desses ativos não foram implementadas.

A [documentação original](docs/prototipo_original.md) permanece como registro do protótipo; seus comandos de servidor estático e descrição de armazenamento local não se aplicam à execução autenticada. Use este README para a aplicação atual. No GitHub, os arquivos antigos na raiz foram preservados para manter o protótipo existente no GitHub Pages. A versão atual com autenticação e banco deve ser executada pelo Flask/Gunicorn; páginas estáticas não substituem esse servidor.
