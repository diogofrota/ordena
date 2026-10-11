# 🚓 ORDENA - Sistema de Gestão de Operações (SGO)

> **Versão:** 1.0.0 (Protótipo/MVP)
> **Status:** Homologação de Regra de Negócio
> **Tecnologia:** HTML5, CSS3, JavaScript (ES6+), LocalStorage

## 📋 Sobre o Projeto

O **ORDENA** é uma plataforma de comando e controle desenvolvida para gerenciar o planejamento tático, a frota de viaturas, o cadastro de pontos sensíveis e a execução de ordens de serviço (OS) de forças de segurança.

Este código atual serve como **Prova de Conceito (PoC)** para validar a lógica de imutabilidade de ordens, validação de choques de horário e monitoramento em tempo real antes da implementação em infraestrutura de servidor.

---

## 🛠 Arquitetura e Tecnologias

O sistema roda inteiramente no navegador do cliente, utilizando o `localStorage` como banco de dados temporário.

* **Frontend:** HTML5 Semântico, CSS3 (Responsivo/Grid/Flexbox).
* **Lógica:** Vanilla JavaScript (Sem frameworks).
* **Persistência:** `window.localStorage`.
* **Mapas & Geocoding:** Leaflet.js + OpenStreetMap + Nominatim API.
* **Relatórios:** jsPDF + jsPDF-AutoTable.

---

## 🧠 Regras de Negócio e Lógica (Passo a Passo)

Esta seção detalha a lógica que **deve ser replicada** no backend ao migrar para produção.

### 1. Gestão de Ordens de Serviço (OS) - `os.js`

A lógica central do sistema baseia-se na **Imutabilidade e Versionamento**.

* **Criação:**
1. O sistema gera um ID sequencial automático.
2. **Validação de Conflito:** Ao adicionar uma atividade (ex: Patrulhamento das 10h às 12h), o algoritmo verifica se o intervalo colide com qualquer outra atividade já listada na mesma OS.
3. **Ordenação:** As atividades são automaticamente reordenadas cronologicamente (08:00 antes de 10:00) independente da ordem de inserção.
4. **Status Inicial:** A OS nasce com status `Ativa` e `dataCriacao`.


* **Edição (Versionamento):**
1. **NUNCA se altera um registro salvo.**
2. Ao editar a OS `1001`, o sistema marca a OS `1001` como `Inativa` (insere `dataEncerramento`).
3. Cria-se uma nova OS (ex: `1002`) contendo os dados novos, mantendo um vínculo lógico (`osOrigem: 1001`) para rastreabilidade.


* **Encerramento Manual:**
1. O usuário pode encerrar uma OS sem criar nova versão. Isso apenas muda o status para `Inativa` e data o fim.



### 2. Gestão de Frota e Locais - `cadastro.js` / `enderecos.js`

Utiliza-se o conceito de **Soft Delete** (Exclusão Lógica).

* **Cadastro:** Validação de campos obrigatórios.
* **Ação de Excluir:**
* O sistema **não deleta** o registro do banco de dados.
* Ele altera a flag `status` de `'Ativa'` para `'Inativa'`.
* **Nos Selects (Dropdowns):** Apenas registros com `status: 'Ativa'` são mostrados para novas operações, mas o histórico antigo preserva os dados das viaturas/locais inativados.



### 3. Inteligência Geográfica - `enderecos.js`

* **Geocodificação Reversa:** Ao arrastar o pino no mapa, o sistema captura `lat/lng` e consulta a API do Nominatim para preencher automaticamente: Rua, Bairro e Cidade.
* **Visualização:** O sistema permite abrir um modal (janela) para visualizar a posição exata de um local cadastrado sem sair da tela de listagem.

### 4. Ativação de Guarnição (Escalamento) - `escalamento.js`

Vincula 3 entidades: **Viatura + Ordem de Serviço + Equipe Humana**.

* **Equipe Dinâmica:**
* Comandante é obrigatório.
* Permite adição dinâmica de até 5 auxiliares (total 6 integrantes).
* Armazena: Posto/Graduação, Nome de Guerra e RG.


* **Monitoramento Simulado:**
* Um `setInterval` roda a cada 30 segundos.
* Ele compara a `Hora Atual` do sistema com os intervalos das atividades da OS vinculada.
* **Lógica:** Se `Hora Atual` estiver dentro de `Inicio` e `Fim` de uma atividade -> Status: **"EM POSIÇÃO"** (Verde). Caso contrário -> **"FORA DE POSIÇÃO"** (Vermelho).


* **Finalização de Turno:**
* Remove a equipe da tabela de "Ativos" (`escalasAtivas`).
* Move os dados para a tabela de "Histórico" (`historicoEscalas`), adicionando a `dataFim` real do término do serviço.



---

## 💾 Estrutura de Dados (Schema JSON)

Ao migrar para SQL/NoSQL, estas são as estruturas de dados esperadas:

**1. Viaturas (`viaturas`)**

```json
{
  "prefixo": "String (PK)",
  "placa": "String",
  "radio": "String",
  "status": "String ('Ativa' | 'Inativa')"
}

```

**2. Locais (`locaisCadastrados`)**

```json
{
  "id": "Timestamp (PK)",
  "apelido": "String",
  "rua": "String",
  "bairro": "String",
  "lat": "Float",
  "lng": "Float",
  "status": "String ('Ativo' | 'Inativo')"
}

```

**3. Ordens de Serviço (`ordensServico`)**

```json
{
  "numero": "Integer (PK)",
  "osOrigem": "Integer (FK - Auto Referência)",
  "nomeOS": "String",
  "inicioGeral": "Time",
  "terminoGeral": "Time",
  "prescricoes": "Text",
  "status": "String ('Ativa' | 'Inativa')",
  "dataCriacao": "DateTime",
  "dataEncerramento": "DateTime",
  "atividades": [
    { "tipo": "String", "inicio": "Time", "fim": "Time", "local": "String" }
  ]
}

```

**4. Escalas/Histórico (`escalasAtivas` / `historicoEscalas`)**

```json
{
  "id": "Timestamp (PK)",
  "dataInicio": "DateTime",
  "dataFim": "DateTime",
  "prefixo": "String (FK)",
  "osNumero": "Integer (FK)",
  "equipe": [
    { "funcao": "Cmd/Aux", "posto": "String", "nome": "String", "rg": "String" }
  ]
}

```

---

## 🚀 Roteiro para Migração em Produção

Para colocar este sistema em ambiente real, as seguintes alterações são mandatórias:

1. **Backend:** Substituir `localStorage` por uma API RESTful (Node.js, Python/Django ou Java/Spring).
2. **Banco de Dados:** Implementar PostgreSQL ou MySQL.
3. **Autenticação:** Criar sistema de Login (JWT) para garantir que apenas oficiais autorizados criem OS.
4. **Mapas:** Para alto volume de acessos, substituir a API gratuita do Nominatim por uma chave paga do Google Maps API ou Mapbox, para evitar bloqueios.
5. **Segurança:** Implementar HTTPS e logs de auditoria no servidor (quem criou, quem inativou).

---

## 📄 Como rodar este protótipo

1. Baixe todos os arquivos (`.html`, `.css`, `.js`) para uma mesma pasta.
2. Certifique-se de que há conexão com a internet (para carregar os mapas do OpenStreetMap e a biblioteca jsPDF).
3. Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Edge, Firefox).
4. **Nota:** Se precisar limpar os dados para testes, use o comando `localStorage.clear()` no console do navegador (F12).

---

> **Desenvolvido para:** Secretaria de Segurança / Planejamento Operacional.
> **Objetivo:** Validação de fluxo operacional.