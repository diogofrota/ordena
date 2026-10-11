# Banco de dados do Ordena

## Decisão e fonte de referência

PostgreSQL é o banco de produção: oferece transações, concorrência entre processos e integridade referencial para instituições, usuários e ordens vinculadas às ativações. SQLite usa o mesmo esquema para desenvolvimento/testes. Não se utiliza um arquivo SQLite efêmero como banco de produção.

A migração `migrations/versions/0001_*.py` é a fonte do esquema. `backend/models.py` fornece o mapeamento ORM; nunca cria o esquema automaticamente. `flask --app wsgi:app db-upgrade` cria e atualiza a estrutura; `db-sql` emite SQL a partir das migrações, sem executar. Reversões destrutivas estão bloqueadas. Antes de alterar um banco existente, faça backup e revise a nova migração.

## Instituições e usuários

| Tabela | Finalidade e restrições |
| --- | --- |
| `prefeituras` | Identificador, nome único/obrigatório e versão de concorrência operacional |
| `secretarias` | Secretaria ou setor **administrativo** de uma prefeitura; nome único dentro dela |
| `usuarios` | Uma prefeitura e uma secretaria obrigatórias, nome, e-mail globalmente único, telefone, hash da senha, sinalizadores de conta ativa/senha temporária e versão de sessão |
| `sessoes` | Uma sessão por login; guarda o SHA-256 de um identificador aleatório e prazo de expiração, nunca a senha |
| `limites_login` | Contadores persistentes por chave SHA-256 de IP, e-mail ou usuário na troca de senha |
| `auditoria` | Prefeitura, usuário, horário UTC, ação e nomes de coleções alteradas; não contém senhas nem cópias completas dos registros |

Uma prefeitura possui muitas secretarias e usuários; cada secretaria pode ter muitos usuários. Uma FK composta `(secretaria_id, prefeitura_id)` impede a associação de um usuário a uma secretaria de outra prefeitura. Um usuário pode ter várias sessões e ações de auditoria. Não há níveis funcionais ou tabela de papéis.

**Setor administrativo** (`secretarias`) e **setor operacional de policiamento a pé** (`setores_operacionais`) são conceitos distintos encontrados nos fluxos existentes. O primeiro identifica a lotação do usuário; o segundo pode ser ativado como recurso físico.

## Registros operacionais

Cada coleção existente ganhou uma tabela. Todas possuem `id` (PK técnica), `prefeitura_id` (FK obrigatória e indexada), `chave` (identidade do frontend), `posicao` (ordem da lista), `arquivado` e `dados` (documento JSON obrigatório). `(prefeitura_id, chave)` é único, permitindo que prefeituras diferentes reutilizem prefixos/números locais.

| Chave usada pela interface | Tabela | Identidade do registro | Conteúdo de `dados` |
| --- | --- | --- | --- |
| `viaturas` | `viaturas` | prefixo | Carro/moto, modelo, placa, rádio, status |
| `policiais` | `policiais` | id do policial | Posto, nome de guerra, RG, telefone, status, datas |
| `cabines` | `cabines` | código | Nome, coordenadas e status |
| `setores` | `setores_operacionais` | código | Nome, coordenadas e status |
| `locaisCadastrados` | `baseamentos` | id | Apelido/código, endereço, ponto/raio, status |
| `pontosPatrulhamento` | `patrulhamentos` | id | Identificação, endereço, coordenadas/polígono, status |
| `tiposServico` | `tipos_servico` | nome | Descrição, status e datas; o frontend não cria ID neste catálogo |
| `ordensServico` | `ordens_servico` | número da OS | Missão, turno, prescrições, atividades, status e ocultação |
| `cadastrosOperacoes` | `operacoes_especiais` | id | Nome, período, descrição, status e avaliações |
| `escalasAtivas` | `ativacoes` | id da ativação | OS, recursos, equipe, despachante, início e previsão de fim |
| `historicoEscalas` | `historico_ativacoes` | id da ativação | Snapshot da ativação e metadados de baixa |

Ativações e histórico têm também `os_chave`, com FK composta para `(prefeitura_id, chave)` da OS. Uma ordem pode ter muitas ativações/históricos; cada ativação referencia uma ordem da mesma prefeitura. Não se excluem ordens referenciadas.

## Vínculos dentro dos documentos

O frontend já preserva snapshots para que mudanças cadastrais não reescrevam turnos anteriores. Por isso atividades, membros, avaliações e geometrias foram mantidos como JSON nesta integração incremental.

- Uma OS contém várias atividades. Cada atividade pode guardar o local e suas coordenadas/endereço e o **nome** de uma operação especial. Os vínculos existentes não usam sempre IDs uniformes; não foi inventada uma tabela de endereços ou um catálogo de postos independente.
- Uma operação contém várias avaliações; as páginas localizam pontos percorrendo atividades das OS que mencionam o nome da operação.
- Uma ativação contém um ou vários IDs de recursos e vários integrantes, com `policialId` e cópia dos dados utilizados no turno. O frontend exige comandante e mantém motos vinculadas aos integrantes quando aplicável.
- A baixa mantém os dados completos no histórico. A linha original da ativação é arquivada, sem apagar a informação.

A API valida estrutura, campos obrigatórios, identidades únicas, RGs duplicados, coordenadas, horários/conflitos de atividades, OS da prefeitura, policiais/recursos das equipes ativas e conflitos de alocação. O banco garante as FKs institucionais e de OS. Outros vínculos JSON não têm FKs SQL; editar esses documentos por SQL pode violar regras da aplicação. A normalização relacional completa é uma evolução futura, não uma característica entregue.

## Como os fluxos leem e gravam

1. O Flask valida a sessão, a conta ativa e a troca de senha inicial. A prefeitura vem sempre do usuário autenticado, nunca de parâmetros do cliente.
2. Na abertura de uma página, carrega as 11 coleções filtradas por prefeitura e injeta um snapshot seguro antes dos scripts. A página só é entregue após a carga do banco; o adaptador disponibiliza leituras síncronas de memória aos módulos existentes.
3. Cadastros e inativações enviam `PATCH /api/dados` com `versao` e as coleções alteradas. Os formulários aguardam a resposta, mantêm Growing Dots visível e bloqueiam ações concorrentes. Falhas não atualizam o cache nem autorizam um redirecionamento de sucesso.
4. O servidor compara e incrementa a versão da prefeitura atomicamente, valida e grava todas as alterações na mesma transação. Uma versão antiga produz HTTP 409, sem sobrescrever a outra sessão. Falhas revertem também o incremento da versão.
5. Na baixa, histórico e lista ativa são enviados numa única requisição; não existe estado parcialmente baixado após falha.
6. `GET /api/dados` retorna somente dados da prefeitura atual. Impressões recebem snapshots transitórios em `sessionStorage`, separados por prefeitura/usuário; não são tabelas persistentes.
7. Telefone e senha usam `/api/me/telefone` e `/api/me/senha`. Senhas são hashes PBKDF2-SHA256 com salt e um milhão de iterações pelo Werkzeug; nenhuma resposta expõe hashes.

O protocolo envia coleções completas, adequado ao porte atual do protótipo. Muitas sessões/volumes grandes demandam paginação e endpoints por registro. Não há mesclagem automática de edições concorrentes.

## Administração e consultas

Prefira os comandos locais do README. `admin-cadastrar` reutiliza instituições de mesmo nome e cria uma conta sem cadastro público. `admin-usuario` inativa/reativa e redefine senha temporária de forma interativa; não faça alterações de senha por SQL.

Consulta de lotação, sem hashes:

```sql
SELECT p.id AS prefeitura_id, p.nome AS prefeitura,
       s.nome AS secretaria, u.id AS usuario_id, u.nome, u.email,
       u.ativo, u.senha_temporaria
FROM usuarios u
JOIN prefeituras p ON p.id = u.prefeitura_id
JOIN secretarias s ON s.id = u.secretaria_id AND s.prefeitura_id = p.id
ORDER BY p.nome, s.nome, u.nome;
```

Consulta PostgreSQL de frota de uma prefeitura (substitua o identificador de exemplo):

```sql
SELECT chave, dados->>'modelo' AS modelo, dados->>'status' AS status
FROM viaturas
WHERE prefeitura_id = 1 AND arquivado = false
ORDER BY posicao;
```

Auditoria por prefeitura:

```sql
SELECT criado_em, usuario_id, acao, colecoes
FROM auditoria
WHERE prefeitura_id = 1
ORDER BY criado_em DESC;
```

A conta SQL administrativa pode acessar várias prefeituras; o isolamento da aplicação não equivale a Row Level Security do PostgreSQL. Restrinja o acesso ao banco, mantenha credenciais apenas no servidor e não entregue consoles SQL aos usuários de negócio.

## Dados antigos e demonstração

O `localStorage` legado permanece intacto; a aplicação autenticada não o lê. Não há importação silenciosa, pois o navegador não registra a prefeitura proprietária. Para migrar dados reais, exporte/revise o snapshot do navegador e planeje uma importação validada para a prefeitura correta, com backup. Esse importador não foi incluído.

Não são criados cadastros de demonstração ou contas com senhas fixas no banco de execução. Os testes geram instituições e dados sintéticos somente em bancos descartáveis; as senhas das fixtures não são credenciais de execução.
