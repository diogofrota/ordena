
# 🚓 ORDENA - Sistema de Gestão de Ordens de Serviço (MVP)

> **Status:** Em Desenvolvimento (MVP / Frontend Logic)
> **Versão:** 1.2 (Responsivo & Visual Otimizado)

O **ORDENA** (anteriormente SGF) é uma aplicação web robusta desenvolvida para a gestão operacional de segurança pública e privada. O sistema facilita o cadastro de frotas, o planejamento estratégico de Ordens de Serviço (OS) com horários fracionados e oferece um **monitoramento tático em tempo real**, indicando se as guarnições estão na posição correta com base no horário atual.

Este projeto opera inteiramente no navegador (Client-Side), utilizando **LocalStorage** para simular um banco de dados persistente, ideal para apresentações e provas de conceito de alta fidelidade.

---

## 📌 Funcionalidades Principais

### 1. 📊 Dashboard Executivo (`index.html`)
- **Painel de Controle:** Cards interativos que exibem o total de viaturas, OS cadastradas e equipes ativas.
- **Responsividade:** Layout adaptável que exibe as informações de forma clara em desktops, tablets e celulares.
- **Visualização Rápida:** Ao clicar nos cards, tabelas detalhadas se expandem para conferência rápida.

### 2. 🚔 Gestão de Frotas (`cadastro.html`)
- **CRUD Completo:** Cadastro, Listagem, Edição e Exclusão de viaturas.
- **Dados:** Gerenciamento de Prefixo Operacional, Placa Oficial e Identificador de Rádio.
- **Interface Limpa:** Formulários que se ajustam automaticamente ao tamanho da tela.

### 3. 📝 Ordem de Serviço Inteligente (`os.html`)
- **Fluxo de Trabalho em Duas Etapas:**
  1.  **Planejamento Macro:** Definição da Missão e do Turno Geral (ex: 08:00 às 20:00).
  2.  **Roteiro Detalhado:** Após criar o cabeçalho, o sistema bloqueia visualmente os dados principais (transformando inputs em texto estático) e libera a adição de atividades fracionadas (ex: 10:00-12:00 Patrulhamento no Centro).
- **Exportação PDF:** Geração automática da OS em formato PDF pronto para impressão e assinatura.
- **Edição Avançada:** Permite reabrir uma OS salva para ajustes de horários ou locais.

### 4. 📡 Escalamento e Monitoramento Tático (`escalamento.html`)
- **Ativação de Guarnição:** Vínculo operacional entre uma **Viatura Disponível**, uma **OS Planejada** e um **Comandante** (RG/Telefone).
- **Motor de Monitoramento (Real-Time):**
  - O sistema verifica o relógio do dispositivo a cada **30 segundos**.
  - **Status VERDE (EM POSIÇÃO):** A hora atual coincide com uma atividade planejada na OS.
  - **Status VERMELHO (FORA DE POSIÇÃO):** A hora atual não possui atividade prevista ou está fora do turno.
- **Relatório de Missão (PDF):** Gera um documento individual para a guarnição, contendo seus dados específicos e o roteiro completo da OS vinculada.

---

## 🛠️ Tecnologias e Arquitetura

O projeto foi construído com foco em código limpo e sem dependências pesadas de frameworks, garantindo leveza e facilidade de manutenção.

* **HTML5:** Estrutura semântica e acessível.
* **CSS3 (Moderno):**
    * Uso de **Flexbox** e **CSS Grid** para layouts complexos.
    * **Media Queries** para total responsividade (Mobile First).
    * Variáveis CSS (`:root`) para fácil manutenção da paleta de cores institucional.
* **JavaScript (ES6+):**
    * Manipulação reativa do DOM.
    * Lógica temporal (`Date Object`) para o monitoramento.
    * Gestão de estado via `LocalStorage`.
* **Bibliotecas de Terceiros:**
    * `jspdf`: Motor de geração de arquivos PDF.
    * `jspdf-autotable`: Plugin para criar tabelas complexas dentro dos PDFs.

---

## 📂 Estrutura do Projeto

```text
/
├── index.html          # Dashboard principal (Visão Geral)
├── cadastro.html       # Módulo de Gestão de Frotas
├── os.html             # Módulo de Planejamento de Ordens de Serviço
├── escalamento.html    # Módulo de Operações e Monitoramento
├── style.css           # Estilos globais, tema e regras de responsividade
├── script.js           # Lógica das Viaturas e Dashboard
├── os.js               # Lógica complexa da OS (Fluxo visual, PDF, Edição)
└── escalamento.js      # Motor de Monitoramento e Comparação de Horários

```

---

## 🧠 Lógica do Sistema (Backend Simulado)

### Persistência de Dados

O sistema utiliza o `LocalStorage` do navegador como banco de dados NoSQL chave-valor:

1. **`viaturas`**: Lista de objetos contendo os dados dos veículos.
2. **`ordensServico`**: Estrutura complexa contendo o cabeçalho da OS e um array aninhado de atividades.
3. **`escalasAtivas`**: Tabela de relacionamento que une IDs de Viaturas e OSs aos dados temporários da guarnição.

### O "Motor" de Monitoramento (`escalamento.js`)

A função `exibirMonitoramento()` é executada automaticamente:

1. Recupera as escalas ativas.
2. Cruza o ID da OS da escala com o banco de OSs.
3. Obtém a hora exata do sistema (`HH:MM`).
4. Percorre todas as frações de horário daquela OS.
5. Se `HoraAtual` estiver entre `Inicio` e `Fim` de uma atividade:
* Define o **Local Atual** como o local da atividade.
* Define o **Status** como `true` (Verde/Em Posição).


6. Caso contrário, define como `false` (Vermelho/Fora de Posição).

---

## 🚀 Como Executar

1. Baixe ou clone este repositório.
2. Garanta que você tenha conexão com a internet na primeira execução (para carregar a biblioteca `jspdf` via CDN).
3. Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Edge, Firefox, Safari).
4. O sistema está pronto para uso! (Os dados ficam salvos no seu navegador).

---

## 🔮 Roadmap (Próximos Passos)

* [ ] **Backend Real:** Migração para API REST (Node.js/Python) com banco de dados PostgreSQL.
* [ ] **Autenticação:** Níveis de acesso (Comandante, Oficial de Dia, Operador).
* [ ] **Geolocalização:** Integração com GPS dos tablets das viaturas para comparar posição real vs. planejada.
* [ ] **Histórico de Logs:** Auditoria de quem criou ou editou cada OS.

---

**Desenvolvido para modernizar a gestão operacional de segurança.**

```

```