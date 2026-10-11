# Análise do projeto recebido e integração

## Estado encontrado

A pasta continha HTML/CSS/JavaScript estáticos, 27 páginas de negócio/relatórios, um redirecionador na raiz, imagens e quatro arquivos de testes JavaScript. Não havia backend, dependências Python, banco, autenticação, migrações, `.env`, `.gitignore` nem diretório Git. As instruções AGENTS.md fornecidas na conversa foram aplicadas; não havia outro AGENTS.md dentro do projeto.

O design utiliza CSS próprio (`css/style.css`), cores institucionais azuis/verdes, formulários `input-padrao`, cartões e navegação compartilhada em `js/menu.js`. Não foi encontrado Bootstrap. Growing Dots já estava implementado em gráficos e diversos formulários; seus estilos e animação foram reutilizados.

## Funcionalidades verificadas no código

| Módulo | Implementação original | Integração realizada |
| --- | --- | --- |
| Painel | Totais e gráficos calculados das coleções locais | Mesmos cálculos sobre snapshot do servidor |
| Frota | Carros/motos, prefixo, modelo condicionado ao tipo, placa/rádio, inativação | Gravação aguardada na API, preservando formulário em falhas |
| Policiais | ID estável, RG normalizado, nome/posto/telefone, inativação e cadastro no modal de ativação | Persistência da mesma coleção e validação no servidor |
| Baseamento | Ponto, endereço, geocodificação reversa Nominatim | Registros persistentes; integração de mapa existente mantida |
| Patrulhamento | Desenho/validação de polígonos, identificação e inativação | Registro persistente do documento existente |
| Tipos de serviço | Nome/descrição/status, sem ID original | Identidade natural pelo nome, persistência no banco |
| OS | Numeração, atividades/turno, conflitos de horário, cópia, inativação, ocultação e impressão | Persistência e detecção de concorrência; impressão temporária separada |
| Operações | Datas, inativação, avaliações aninhadas e pontos encontrados nas OS | Documento persistente, preservando estrutura de avaliações |
| Ativações | OS, recursos, comandante/auxiliares, policiais por RG, snapshots e baixa manual | Gravação autenticada; baixa em transação única, original arquivado |
| Histórico/relatórios | Registros finalizados e snapshots para impressão/PDF | Histórico persistente; snapshots de impressão em sessionStorage por conta/prefeitura |
| Mapa tático | Lê escala/OS/recursos/locais; adaptador GPS configurável | Dados do servidor; consulta GPS Cecoco direta no navegador, compartilhada a cada três minutos, comparada à atividade atual |
| Perfil | Identidade fictícia, telefone no navegador e simulação de troca de senha | Dados reais do usuário autenticado e endpoints Flask reais |

Os antigos caminhos mock de perfil permanecem no código, mas `usarMock` está desativado e não são usados pela execução Flask. O despachante fixo do protótipo foi preservado em comentário e substituído pelo usuário autenticado. Não foi ativada nenhuma integração GPS simulada como se fosse um serviço real.

## Integração GPS Cecoco

O monitoramento usa `GET https://cecoco-api-production.up.railway.app/recursos` diretamente no frontend, sem credenciais e com acesso público por CORS. O `radio` cadastrado na viatura corresponde ao `identificador` recebido no JSON. O navegador seleciona os recursos da ativação, lê `latitude`, `longitude` e `ultima_coleta`, e compara a posição com a atividade vigente da OS.

A primeira ativação do monitoramento inicia a consulta imediatamente. Os cartões ligados compartilham as consultas seguintes, a cada três minutos, e desligar o último encerra as consultas. O baseamento utiliza um raio de 20 metros, independentemente do raio desenhado no mapa. O patrulhamento exige posição dentro do polígono ou na sua borda, sem tolerância fora da área.

Identificador ausente, coordenadas inválidas, falha da API ou coleta com mais de dez minutos recebem o estado SEM DADOS. Os estados de posição e os controles de ligar/desligar permanecem nos cartões existentes, com carregamento e mensagens de resultado. A consulta funciona enquanto o mapa tático está aberto; não há processamento GPS no backend nem gravação das posições no banco.

## Persistência e relações

Foram identificadas 11 coleções operacionais no normalizador. OS têm atividades; ativações referenciam OS e vários recursos/policiais, preservando suas cópias; operações têm avaliações e são mencionadas por nome nas atividades. Cabines e setores operacionais são recursos suportados sem formulários próprios.

A lotação institucional original não tinha persistência: o perfil continha apenas valores fictícios. Após esclarecimento na conversa, foi implementado isolamento por prefeitura. Prefeitura tem muitas secretarias/setores administrativos; usuário pertence a exatamente uma prefeitura e uma secretaria. Secretarias da mesma prefeitura compartilham a base operacional e todos os usuários têm as mesmas permissões funcionais.

O esquema mantém cada registro em uma linha própria e usa documentos JSON para atividades, equipes, avaliações e geometria, preservando os contratos existentes. Há FKs institucionais e FKs compostas da ativação/histórico para OS; os demais vínculos internos não foram convertidos em FKs SQL. Consulte `banco.md` e os diagramas do README.

## Problemas corrigidos

- Páginas/APIs antes públicas receberam autenticação no servidor.
- Simulação de senha substituída por hash, verificação da senha atual e primeiro acesso obrigatório.
- Armazenamento principal no navegador substituído pelo banco; dados antigos do navegador não foram apagados.
- Formulários passaram a aguardar confirmação da API antes de mensagens de sucesso/redirecionamento.
- Baixa em duas gravações separadas substituída por transação única.
- Edições simultâneas receberam controle de versão e erro 409.
- Limpeza indiscriminada do armazenamento foi desativada na execução autenticada; inativação mantém o histórico.
- Execução estática substituída por Flask/Gunicorn, com configuração por ambiente e cookies de produção.
- Monitoramento GPS ligado à API informada, com consulta compartilhada e confronto geográfico no navegador.

## Credenciais e histórico

Não foram identificadas credenciais reais nos arquivos de código fornecidos. Como não havia `.git`, não foi possível verificar histórico de segredos versionados. Nenhum segredo foi colocado em arquivos publicáveis. Ambientes e bancos de teste ficam em caminhos ignorados ou temporários.

## Preservação e limites

Não foi reescrita a interface, substituído seu CSS ou removido módulo existente. As alterações concentram-se na camada de armazenamento, perfil/identidade, feedback, infraestrutura necessária ao backend e integração GPS do mapa tático. A documentação anterior foi preservada em `prototipo_original.md` como referência histórica. Limitações verificadas, inclusive o funcionamento GPS enquanto a página estiver aberta, importação manual futura e vínculos JSON, estão explicitadas no README.
