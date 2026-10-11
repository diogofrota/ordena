# Verificações da implementação

Verificações da implementação inicial realizadas em 11/10/2026. Nenhum banco de produção foi usado. Os resultados abaixo descrevem o alcance efetivamente testado nessa etapa; as verificações da integração GPS posterior estão indicadas separadamente.

## Testes automatizados

| Verificação | Resultado |
| --- | --- |
| `python -m pytest tests/test_backend.py -q` em SQLite temporário | 19 testes passaram |
| Mesma suíte em PostgreSQL local descartável `ordena_test` | 19 testes passaram |
| `node --test tests/*.test.js` | 82 testes passaram |
| `node --check` para todos os scripts `js/*.js` | Sem erros de sintaxe |
| Compilação dos módulos Python e migrações | Sem erros |
| `pip check` | Dependências compatíveis |
| Diagramas Mermaid do README | Os três foram analisados e renderizados sem erro |
| Migração versus metadados ORM | Nenhuma diferença de esquema |
| Links locais da documentação | Nenhum link quebrado |

A suíte Python aplica as migrações em banco vazio, repete a atualização sem alteração destrutiva, executa o cadastro interativo e consulta administrativa, verifica hashes e FKs institucionais, e exercita:

- Login válido/inválido com resposta genérica; rejeição de POST sem CSRF.
- Páginas, scripts de negócio e APIs bloqueados sem sessão.
- Primeiro acesso bloqueando negócio até trocar senha temporária.
- Senha atual inválida, nova senha insuficiente, troca válida e rejeição da anterior.
- Revogação de sessões antigas após troca, logout e perda de acesso.
- Limite de tentativas persistindo entre clientes distintos.
- Isolamento de duas prefeituras em APIs e no HTML de carga inicial.
- Persistência das 11 coleções; inativação/arquivo em vez de remoção indiscriminada.
- Conflito de versão 409 sem sobrescrever dados e sem incrementar versão após falha.
- Cadastro de OS/recursos/policiais/tipos de serviço, ativação e baixa atômica com histórico.
- Rejeição de conflitos de recursos/policiais, equipe sem comandante, recurso inativo, JSON aninhado malformado e entradas de injeção HTML/JavaScript.
- Validação e persistência de telefone; administração de conta e redefinição temporária.
- Renderização pelo Flask de todas as páginas de negócio existentes.
- Configuração de produção com cookies Secure e recusa de SQLite.

Os testes JavaScript da etapa inicial cobrem editor/equipe, colunas de moto na impressão, mapa tático e estados assíncronos do controlador GPS com adaptadores de teste. Os resultados dessa etapa não validam a integração posterior com a API Cecoco.

## Integração GPS e novas verificações

A integração do mapa tático consulta `GET https://cecoco-api-production.up.railway.app/recursos` diretamente no frontend, sem credenciais, usando o acesso público por CORS. O `radio` cadastrado na viatura corresponde ao `identificador` do JSON. As posições são comparadas com a programação no navegador; não há processamento GPS no backend nem gravação no banco.

Verificações automatizadas executadas para essa integração (100 testes JavaScript passaram; os 19 testes Python também passaram em SQLite temporário):

- Consulta imediata ao ligar o primeiro monitoramento; consultas compartilhadas entre os cartões a cada três minutos, sem envio de credenciais.
- Seleção do `identificador` correto em uma resposta com vários recursos e uso de `latitude`, `longitude` e `ultima_coleta`.
- Baseamento com limite de 20 metros, independente do raio exibido no mapa; patrulhamento no interior ou na borda do polígono, sem margem externa.
- SEM DADOS para identificador ausente, coordenadas inválidas, falha da API e coleta com mais de dez minutos.
- Growing Dots durante a consulta, prevenção de ações duplicadas e mensagens de sucesso/erro no padrão existente.
- Atualização do estado ao mudar a atividade planejada; desligamento do último cartão interrompendo as consultas e encerramento ao sair da página.

No Chrome headless, a página real do mapa com cadastro fictício confirmou Growing Dots, interruptor desabilitado durante a consulta, identificador correto, NO PONTO/FORA DO PONTO, reavaliação de atividade sem novo GET, desligamento e erro HTTP 503 mantendo a supervisão ativa. Uma consulta real pelo navegador confirmou CORS e o contrato da API, sem erros JavaScript não tratados. O teste não usou banco ou cadastro operacional real.

Os testes usam recursos fictícios e validam cancelamento individual/compartilhado, timeout de 30 segundos, cache de respostas e falhas e renovação ao desligar/religar. A API real respondeu HTTP 200 com CORS público e o contrato descrito; dados operacionais retornados não foram versionados.

## Navegador

Verificação com Chrome headless/Playwright em servidor Flask local e SQLite descartável, com senha de fixture gerada aleatoriamente:

- Login e redirecionamento ao perfil de primeiro acesso; aviso explícito da troca obrigatória.
- Troca de senha inicial através do formulário real e dados institucionais corretos.
- Falha controlada de gravação: Growing Dots visível, botão desabilitado, mensagem de erro e campos preservados.
- Nova tentativa bem-sucedida, cadastro de carro e moto, navegação para a lista e persistência após recarregar.
- Abertura das páginas de negócio, sem erros JavaScript não tratados.
- Logout pelo botão Sair e redirecionamento ao login ao tentar abrir página protegida.
- Inspeção visual de login desktop/mobile e perfil, preservando fonte, cores, cartões e campos da aplicação.

Os testes visuais não automatizam todos os desenhos de mapa, cada atividade de uma OS ou o download completo de PDF. Esses fluxos herdados têm cobertura parcial pelos testes de renderização existentes e persistência da API; a homologação operacional completa continua recomendada antes de dados reais.

## Servidor de produção

Gunicorn iniciou com dois workers, `ORDENA_ENV=production`, debug desativado e PostgreSQL de teste. Foram verificados HTTP 200 em `/healthz` e `/login`, os atributos Secure/HttpOnly/SameSite=Lax do cookie, HSTS e resposta 400 para Host não permitido.

Não foi realizado deploy externo nem configurado certificado/domínio real. O teste HTTP local verifica os atributos de produção; a navegação HTTPS completa depende da configuração final do proxy/plataforma.

## Segurança e repositório

A inspeção dos arquivos fornecidos não identificou credenciais reais de serviços. Não havia `.git`, portanto não houve análise de histórico remoto ou de segredos anteriormente versionados. `.gitignore` foi incluído para impedir versionamento de ambiente, bancos, segredos e backups. Nenhum usuário ou banco real foi criado.

## Reproduzir

Use os comandos do README após instalar as dependências. Os testes padrão criam bancos SQLite temporários. A opção PostgreSQL exige banco **descartável** explicitamente selecionado por `ORDENA_TEST_DATABASE_URL`; não use dados reais. O roteiro do navegador pode ser repetido manualmente seguindo os itens acima, simulando indisponibilidade da API nas ferramentas de desenvolvimento.
