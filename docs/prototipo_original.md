# ORDENA — Sistema de Gestão de Operações

> Cópia da documentação do protótipo recebido, preservada para referência histórica. Para execução atual, use o README da raiz.

Protótipo web para cadastro de recursos, planejamento de ordens de serviço, ativação de guarnições, acompanhamento operacional e emissão de relatórios.

O projeto atual é um frontend estático. Os dados são persistidos no `localStorage` do navegador enquanto as regras de negócio são homologadas antes da criação do backend e do banco de dados.

## Tecnologias

- HTML5, CSS3 e JavaScript sem framework.
- Leaflet e OpenStreetMap para mapas.
- Nominatim para geocodificação reversa.
- Chart.js para os indicadores da página inicial.
- html2pdf.js para download de relatórios em PDF.

As bibliotecas externas e os mapas exigem conexão com a internet.

## Estrutura do projeto

```text
ordena/
├── index.html                 # Entrada e redirecionamento para a aplicação
├── assets/images/             # Favicon e imagens
├── css/style.css              # Estilos compartilhados
├── js/
│   ├── menu.js                # Navegação lateral compartilhada
│   ├── storage_normalizer.js  # Validação e normalização do armazenamento local
│   └── *.js                   # Lógica específica de cada módulo
└── templates/                 # Telas e relatórios da aplicação
```

O menu deve ser alterado somente em `js/menu.js`. As páginas mantêm apenas o contêiner `#sidebar`, preenchido pelo script compartilhado.

## Módulos ativos

| Área | Funcionalidades |
| --- | --- |
| Painel | Totais operacionais e gráficos de frota, efetivo e horários |
| Recursos | Viaturas, motos, cabines e setores |
| Efetivo | Cadastro de policiais e seleção padronizada nas guarnições |
| Locais | Pontos de baseamento e áreas de patrulhamento |
| Planejamento | Tipos de serviço, ordens de serviço e operações especiais |
| Execução | Ativação, baixa, histórico de ativações e mapa tático |
| Perfil | Identificação institucional e dados do usuário |
| Relatórios | OS, ativação e término da ativação |

Cabines e setores não possuem páginas próprias de manutenção. Registros já existentes continuam compatíveis com o escalamento e o mapa tático.

## Dados locais

O normalizador reconhece as seguintes chaves:

| Chave | Conteúdo |
| --- | --- |
| `viaturas` | Carros e motos cadastrados |
| `policiais` | Policiais disponíveis para composição das guarnições |
| `cabines` | Cabines operacionais |
| `setores` | Setores de policiamento a pé |
| `locaisCadastrados` | Pontos de baseamento |
| `pontosPatrulhamento` | Áreas e pontos de patrulhamento |
| `tiposServico` | Catálogo de tipos de serviço |
| `ordensServico` | Ordens e seus roteiros de atividades |
| `cadastrosOperacoes` | Operações especiais e avaliações |
| `escalasAtivas` | Guarnições em serviço |
| `historicoEscalas` | Ativações finalizadas |
| `ordenaPerfilMock` | Perfil temporário do usuário |
| `osImpressaoTemp` | Dados temporários da impressão de OS |
| `ativacaoImpressaoTemp` | Dados temporários da impressão de ativação |
| `historicoImpressaoTemp` | Dados temporários da impressão de término |

Datas completas devem ser armazenadas em ISO 8601. Horários operacionais usam `HH:MM`. Registros inativados são preservados para manter a rastreabilidade histórica.

## Regras centrais

### Ordens de serviço

- O número da OS é gerado automaticamente.
- Atividades não podem ter conflito de horário dentro da mesma ordem.
- O roteiro é ordenado cronologicamente.
- Uma atividade pode vincular local, área de patrulhamento e operação especial.
- A impressão recebe uma cópia temporária dos dados e inclui as prescrições da ordem.

### Ativações

- Cada ativação vincula uma OS, um ou mais recursos e uma equipe.
- Os tipos de recurso aceitos são `Viatura`, `Moto`, `Cabine` e `Setor`.
- O comandante é obrigatório; auxiliares e motos podem ser associados à equipe.
- Os integrantes são selecionados entre os policiais ativos cadastrados; cada ativação preserva uma cópia dos dados usados no turno.
- A baixa move o registro de `escalasAtivas` para `historicoEscalas` e registra data e responsável.
- Não existe encerramento automático: a baixa depende de confirmação do operador.

### Cadastros

- Recursos e locais usam inativação lógica, sem apagar o histórico.
- Policiais também usam inativação lógica e mantêm um identificador estável para correlação entre turnos.
- Somente itens ativos aparecem para novos vínculos.
- Operações especiais preservam seus vínculos com ordens existentes quando inativadas.

## Execução local

Na raiz do projeto, inicie um servidor HTTP:

```bash
python3 -m http.server 8765
```

Depois abra `http://localhost:8765/`. Usar um servidor local evita restrições do navegador que podem ocorrer ao abrir os arquivos diretamente.

## Validação técnica

Não há gerenciador de pacotes nem suíte automatizada configurada neste protótipo. A verificação sintática dos scripts pode ser executada com:

```bash
for arquivo in js/*.js; do node --check "$arquivo" || exit 1; done
```

Antes de uma entrega, também devem ser verificados os links locais, os handlers declarados no HTML e os principais fluxos no navegador.

## Próxima etapa: backend e banco de dados

A migração deve substituir o `localStorage` por uma API autenticada e um banco relacional. Uma separação inicial de entidades é:

- instituições, órgãos/setores e usuários;
- policiais, postos/graduações e vínculos com instituições;
- recursos operacionais e seus tipos;
- locais, coordenadas e polígonos;
- tipos de serviço, ordens e atividades;
- operações especiais, avaliações e vínculos com ordens;
- ativações, integrantes, recursos vinculados e baixas;
- trilha de auditoria para criação, alteração e inativação.

Os contratos já previstos em `js/perfil.js` usam sessão por cookie, proteção CSRF e endpoints sob `/api/me`. A autenticação, autorização, validação no servidor, transações e auditoria devem ser implementadas antes de uso em produção.

## Limitações atuais

- Os dados existem apenas no navegador utilizado.
- Não há autenticação real nem controle de permissões.
- Limpar o armazenamento do navegador remove os dados do protótipo.
- O sistema ainda não é apropriado para armazenar dados operacionais reais.
