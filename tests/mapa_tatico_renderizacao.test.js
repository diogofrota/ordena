'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    ESTADOS_MONITORAMENTO,
    obterApresentacaoEstado
} = require('../js/mapa_tatico_monitoramento.js');

const raizProjeto = path.resolve(__dirname, '..');
const fonteMapaTatico = fs.readFileSync(path.join(raizProjeto, 'js', 'mapa_tatico.js'), 'utf8');
const fonteTemplate = fs.readFileSync(path.join(raizProjeto, 'templates', 'mapa_tatico.html'), 'utf8');

function trechoEntre(fonte, marcadorInicial, marcadorFinal) {
    const inicio = fonte.indexOf(marcadorInicial);
    const fim = fonte.indexOf(marcadorFinal, inicio + marcadorInicial.length);
    assert.notEqual(inicio, -1, `Marcador inicial ausente: ${marcadorInicial}`);
    assert.notEqual(fim, -1, `Marcador final ausente: ${marcadorFinal}`);
    return fonte.slice(inicio, fim);
}

function escaparRegex(valor) {
    return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extrairFuncao(fonte, nome) {
    const assinatura = `function ${nome}`;
    const inicio = fonte.indexOf(assinatura);
    assert.notEqual(inicio, -1, `Função ausente: ${nome}`);

    const inicioCorpo = fonte.indexOf('{', inicio);
    assert.notEqual(inicioCorpo, -1, `Corpo da função ausente: ${nome}`);

    let profundidade = 0;
    for (let indice = inicioCorpo; indice < fonte.length; indice++) {
        if (fonte[indice] === '{') profundidade++;
        if (fonte[indice] === '}') profundidade--;
        if (profundidade === 0) return fonte.slice(inicio, indice + 1);
    }

    assert.fail(`Fim da função ausente: ${nome}`);
}

function carregarApiRoteiroCompleto() {
    return Function(`
        'use strict';
        ${extrairFuncao(fonteMapaTatico, 'horaParaMinutos')}
        ${extrairFuncao(fonteMapaTatico, 'obterRoteiroCompleto')}
        ${extrairFuncao(fonteMapaTatico, 'obterIndiceAtividadeAtualRoteiro')}
        return { obterRoteiroCompleto, obterIndiceAtividadeAtualRoteiro };
    `)();
}

function carregarMinutoAtualRoteiro() {
    return Function(`
        'use strict';
        ${extrairFuncao(fonteMapaTatico, 'horaParaMinutos')}
        ${extrairFuncao(fonteMapaTatico, 'obterMinutoAtualRoteiro')}
        return obterMinutoAtualRoteiro;
    `)();
}

function carregarGeradorLinhasRoteiro() {
    return Function(`
        'use strict';
        ${extrairFuncao(fonteMapaTatico, 'escaparHtml')}
        ${extrairFuncao(fonteMapaTatico, 'montarEnderecoTexto')}
        ${extrairFuncao(fonteMapaTatico, 'obterOperacaoAtividadeRoteiro')}
        ${extrairFuncao(fonteMapaTatico, 'gerarLinhasTabelaRoteiro')}
        return gerarLinhasTabelaRoteiro;
    `)();
}

function extrairDeclaracoesCss(fonte, seletor) {
    const correspondencia = fonte.match(
        new RegExp(`(?:^|})\\s*${escaparRegex(seletor)}\\s*\\{([^}]*)\\}`)
    );
    assert.ok(correspondencia, `Regra CSS ausente: ${seletor}`);
    return correspondencia[1];
}

function extrairValorCss(declaracoes, propriedade) {
    const correspondencia = declaracoes.match(
        new RegExp(`(?:^|;)\\s*${escaparRegex(propriedade)}\\s*:\\s*([^;]+)`, 'i')
    );
    assert.ok(correspondencia, `Propriedade CSS ausente: ${propriedade}`);
    return correspondencia[1].trim().toLowerCase();
}

test('markup do card renderiza badge acessível, Growing Dots e switch com estados assíncronos', () => {
    const geracao = trechoEntre(
        fonteMapaTatico,
        'function gerarControleMonitoramento(info)',
        'function atualizarControleMonitoramentoCard(estado)'
    );
    const atualizacao = trechoEntre(
        fonteMapaTatico,
        'function atualizarControleMonitoramentoCard(estado)',
        'function mostrarFeedbackMonitoramento(tipo, mensagem)'
    );

    assert.match(
        geracao,
        /class="status-pill monitoramento-status \$\{apresentacao\.classe\}"[^>]*role="status"[^>]*aria-live="polite"[\s\S]*?\$\{apresentacao\.texto\}/
    );
    assert.match(
        geracao,
        /class="monitoramento-loading"[^>]*role="status"[^>]*aria-label="Consultando posição GPS"[^>]*\$\{carregando\s*\?\s*''\s*:\s*'hidden'\}/
    );
    assert.match(geracao, /class="growing-dots"[^>]*aria-hidden="true"/);
    assert.match(
        geracao,
        /<input[\s\S]*?role="switch"[\s\S]*?class="monitoramento-switch-input"[\s\S]*?aria-busy="\$\{carregando\s*\?\s*'true'\s*:\s*'false'\}"[\s\S]*?\$\{desabilitado\s*\?\s*'disabled'\s*:\s*''\}/
    );
    assert.match(geracao, /\$\{ligado\s*\?\s*'checked'\s*:\s*''\}/);

    assert.match(atualizacao, /status\.textContent\s*=\s*apresentacao\.texto/);
    assert.match(
        atualizacao,
        /status\.className\s*=\s*`status-pill monitoramento-status \$\{apresentacao\.classe\}`/
    );
    assert.match(atualizacao, /controle\.checked\s*=\s*ligado/);
    assert.match(atualizacao, /controle\.disabled\s*=\s*carregando/);
    assert.match(atualizacao, /controle\.setAttribute\('aria-busy',\s*carregando\s*\?\s*'true'\s*:\s*'false'\)/);
    assert.match(atualizacao, /loading\.hidden\s*=\s*!carregando/);
});

test('os quatro estados possuem texto, classe e regra visual no CSS do Mapa Tático', () => {
    const casos = [
        [ESTADOS_MONITORAMENTO.NAO_MONITORADO, 'NÃO MONITORADO', 'is-neutral'],
        [ESTADOS_MONITORAMENTO.NO_PONTO, 'NO PONTO', 'is-success'],
        [ESTADOS_MONITORAMENTO.FORA_DO_PONTO, 'FORA DO PONTO', 'is-danger'],
        [ESTADOS_MONITORAMENTO.SEM_DADOS, 'SEM DADOS', 'is-warning']
    ];

    for (const [estado, texto, classe] of casos) {
        assert.deepEqual(obterApresentacaoEstado(estado), { texto, classe });
        assert.match(
            fonteTemplate,
            new RegExp(`\\.monitoramento-status\\.${escaparRegex(classe)}\\s*\\{[^}]*color\\s*:[^;}]+;[^}]*background\\s*:`)
        );
    }

    assert.match(
        fonteTemplate,
        /\.monitoramento-loading\[hidden\]\s*\{[^}]*display\s*:\s*none/
    );
    assert.match(
        fonteTemplate,
        /\.monitoramento-loading\s+\.growing-dots\s+span\s*\{[^}]*animation\s*:/
    );
    assert.match(
        fonteTemplate,
        /\.monitoramento-switch-input:disabled\s*\+\s*\.monitoramento-switch-trilho\s*\{[^}]*opacity\s*:/
    );
});

test('atividade compacta preserva o texto configurado somente nos quatro tipos previstos', () => {
    const declaracao = extrairFuncao(fonteMapaTatico, 'obterAtividadeCompacta');
    const obterAtividadeCompacta = Function(
        `'use strict'; ${declaracao}; return obterAtividadeCompacta;`
    )();

    const atividadesVisiveis = [
        'Preleção',
        'Prelecao operacional',
        'Deslocamento para o setor',
        'Intervalo/Refeição',
        'Retorno Base'
    ];

    atividadesVisiveis.forEach(tipo => {
        assert.equal(obterAtividadeCompacta({ tipo }), tipo);
    });

    [
        null,
        undefined,
        {},
        { tipo: '' },
        { tipo: 'Baseamento' },
        { tipo: 'Patrulhamento' },
        { tipo: 'Operação Especial' }
    ].forEach(atividade => {
        assert.equal(obterAtividadeCompacta(atividade), '');
    });
});

test('card compacto mostra a atividade atual configurada e omite o bloco quando ela não se aplica', () => {
    const montagemInfo = trechoEntre(
        fonteMapaTatico,
        'function montarInfoEquipeMapa',
        'function renderizarPainelEquipesAtivas'
    );
    const renderizacao = trechoEntre(
        fonteMapaTatico,
        'function renderizarPainelEquipesAtivas',
        'function montarAlvoMonitoramento'
    );

    assert.match(
        montagemInfo,
        /const atividadeCompacta\s*=\s*recursoEhViatura\s*\?\s*obterAtividadeCompacta\(atividadeAtual\)\s*:\s*''/
    );
    assert.match(montagemInfo, /\n\s*atividadeCompacta,/);
    assert.match(
        renderizacao,
        /\$\{info\.atividadeCompacta\s*\?[\s\S]*?class="equipe-atividade-compacta"[\s\S]*?:\s*''\s*\}/
    );
    assert.match(
        renderizacao,
        /aria-label="Atividade atual:\s*\$\{escaparHtml\(info\.atividadeCompacta\)\}"/
    );
    assert.match(
        renderizacao,
        /<span>Agora:<\/span>\s*<strong>\$\{escaparHtml\(info\.atividadeCompacta\)\}<\/strong>/
    );
    assert.match(
        fonteTemplate,
        /\.equipe-atividade-compacta\s*\{[^}]*font-size\s*:/
    );
});

test('selo principal reconhece somente Patrulhamento e Baseamento sem depender de caixa ou acento', () => {
    const declaracao = extrairFuncao(fonteMapaTatico, 'obterSeloAtividadePrincipal');
    const obterSeloAtividadePrincipal = Function(
        `'use strict'; ${declaracao}; return obterSeloAtividadePrincipal;`
    )();

    [
        'Patrulhamento',
        'PATRULHAMENTO ESCOLAR',
        'patrulhámento tático'
    ].forEach(tipo => {
        assert.deepEqual(obterSeloAtividadePrincipal({ tipo }), {
            texto: 'Patrulhamento',
            inicial: 'P',
            classe: 'is-patrulhamento'
        });
    });

    [
        'Baseamento',
        'BASEAMENTO OPERACIONAL',
        'baseaménto temporário'
    ].forEach(tipo => {
        assert.deepEqual(obterSeloAtividadePrincipal({ tipo }), {
            texto: 'Baseamento',
            inicial: 'B',
            classe: 'is-baseamento'
        });
    });

    [
        null,
        undefined,
        {},
        { tipo: '' },
        { tipo: 'Preleção' },
        { tipo: 'Deslocamento' },
        { tipo: 'Intervalo/Refeição' },
        { tipo: 'Retorno à Base' },
        { tipo: 'Operação Especial' }
    ].forEach(atividade => {
        assert.equal(obterSeloAtividadePrincipal(atividade), null);
    });
});

test('dados do card expõem o selo calculado a partir da atividade atual', () => {
    const montagemInfo = trechoEntre(
        fonteMapaTatico,
        'function montarInfoEquipeMapa',
        'function renderizarPainelEquipesAtivas'
    );

    assert.match(
        montagemInfo,
        /const seloAtividadePrincipal\s*=\s*obterSeloAtividadePrincipal\(atividadeAtual\)/
    );
    assert.match(montagemInfo, /\n\s*seloAtividadePrincipal,/);
});

test('OS e missão saem do cabeçalho recolhido e aparecem como item nos detalhes expandidos', () => {
    const renderizacao = trechoEntre(
        fonteMapaTatico,
        'function renderizarPainelEquipesAtivas',
        'function montarAlvoMonitoramento'
    );
    const cabecalho = trechoEntre(
        renderizacao,
        '<div class="equipe-card-topo">',
        '<div class="equipe-card-detalhes">'
    );
    const detalhes = trechoEntre(
        renderizacao,
        '<div class="equipe-card-detalhes">',
        'const btnExpandir = card.querySelector'
    );

    assert.doesNotMatch(cabecalho, /info\.osNumero/);
    assert.doesNotMatch(cabecalho, /info\.missao/);
    assert.match(
        detalhes,
        /class="equipe-item[^"]*"[\s\S]*?<span>Ordem de Servi(?:ç|&ccedil;)o<\/span>[\s\S]*?<strong>\s*OS\s+\$\{escaparHtml\(String\(info\.osNumero\)\)\}\s*•\s*\$\{escaparHtml\(info\.missao\)\}\s*<\/strong>/
    );
});

test('card reúne selo, intervalo e monitoramento na mesma faixa operacional', () => {
    const renderizacao = trechoEntre(
        fonteMapaTatico,
        'function renderizarPainelEquipesAtivas',
        'function montarAlvoMonitoramento'
    );
    const cabecalho = trechoEntre(
        renderizacao,
        '<div class="equipe-card-topo">',
        '<div class="equipe-card-operacao">'
    );
    const operacao = trechoEntre(
        renderizacao,
        '<div class="equipe-card-operacao">',
        '<div class="equipe-card-detalhes">'
    );
    const inicioResumo = operacao.indexOf('class="equipe-atividade-resumo"');
    const inicioMonitoramento = operacao.indexOf('gerarControleMonitoramento(info)');
    const operacaoCss = extrairDeclaracoesCss(fonteTemplate, '.equipe-card-operacao');
    const monitoramentoNaOperacaoCss = extrairDeclaracoesCss(
        fonteTemplate,
        '.equipe-card-operacao .equipe-monitoramento'
    );
    const resumoCss = extrairDeclaracoesCss(fonteTemplate, '.equipe-atividade-resumo');
    const statusCss = extrairDeclaracoesCss(fonteTemplate, '.monitoramento-status');

    assert.match(cabecalho, /class="equipe-card-titulo"/);
    assert.match(cabecalho, /class="btn-expandir-card-equipe"/);
    assert.doesNotMatch(cabecalho, /class="equipe-atividade-resumo"/);
    assert.doesNotMatch(cabecalho, /gerarControleMonitoramento\(info\)/);
    assert.ok(inicioResumo >= 0, 'Resumo da atividade ausente da faixa operacional');
    assert.ok(
        inicioMonitoramento > inicioResumo,
        'O monitoramento deve ficar depois do selo para ser alinhado à direita'
    );
    assert.match(
        operacao,
        /\$\{info\.seloAtividadePrincipal\s*\?[\s\S]*?class="equipe-atividade-resumo"[\s\S]*?\$\{info\.monitoramentoDisponivel\s*\?\s*gerarControleMonitoramento\(info\)\s*:\s*''\}/
    );
    assert.match(
        operacao,
        /class="equipe-atividade-resumo"[^>]*role="group"[^>]*aria-label="Atividade atual:\s*\$\{escaparHtml\(info\.seloAtividadePrincipal\.texto\)\}\. Horário previsto:\s*\$\{escaparHtml\(info\.horarioAtividadeAtual\)\}"/
    );
    assert.match(
        operacao,
        /class="equipe-atividade-resumo"[\s\S]*?class="equipe-atividade-selo \$\{escaparHtml\(info\.seloAtividadePrincipal\.classe\)\}"[\s\S]*?<\/span>\s*<small class="equipe-atividade-horario"[^>]*>\s*\$\{escaparHtml\(info\.horarioAtividadeAtual\)\}\s*<\/small>/
    );
    assert.doesNotMatch(
        operacao,
        /class="equipe-atividade-selo[^\"]*"[^>]*aria-label=/
    );
    assert.match(
        operacao,
        /class="equipe-atividade-inicial"[^>]*aria-hidden="true"[^>]*>\s*\$\{escaparHtml\(info\.seloAtividadePrincipal\.inicial\)\}/
    );
    assert.match(
        operacao,
        /class="equipe-atividade-texto"[^>]*>\s*\$\{escaparHtml\(info\.seloAtividadePrincipal\.texto\)\}/
    );
    assert.match(
        operacao,
        /<small class="equipe-atividade-horario"[^>]*>\s*\$\{escaparHtml\(info\.horarioAtividadeAtual\)\}\s*<\/small>/
    );
    assert.equal(extrairValorCss(operacaoCss, 'display'), 'grid');
    assert.equal(extrairValorCss(operacaoCss, 'align-items'), 'center');
    assert.match(
        extrairValorCss(operacaoCss, 'grid-template-columns'),
        /^minmax\(0,\s*1fr\)\s+auto$/
    );
    assert.equal(extrairValorCss(operacaoCss, 'min-width'), '0');
    assert.equal(extrairValorCss(monitoramentoNaOperacaoCss, 'grid-column'), '2');
    assert.equal(extrairValorCss(monitoramentoNaOperacaoCss, 'justify-content'), 'flex-end');
    assert.equal(extrairValorCss(monitoramentoNaOperacaoCss, 'margin'), '0');
    assert.equal(extrairValorCss(resumoCss, 'display'), 'inline-flex');
    assert.equal(extrairValorCss(resumoCss, 'align-items'), 'center');
    assert.equal(extrairValorCss(resumoCss, 'justify-content'), 'flex-start');
    assert.equal(extrairValorCss(resumoCss, 'white-space'), 'nowrap');
    assert.equal(extrairValorCss(statusCss, 'white-space'), 'nowrap');
});

test('iniciais P e B usam letra branca sobre cores distintas', () => {
    const inicial = extrairDeclaracoesCss(fonteTemplate, '.equipe-atividade-inicial');
    const patrulhamento = extrairDeclaracoesCss(
        fonteTemplate,
        '.equipe-atividade-selo.is-patrulhamento .equipe-atividade-inicial'
    );
    const baseamento = extrairDeclaracoesCss(
        fonteTemplate,
        '.equipe-atividade-selo.is-baseamento .equipe-atividade-inicial'
    );

    assert.match(extrairValorCss(inicial, 'color'), /^(?:#fff(?:fff)?|white)$/);
    assert.notEqual(
        extrairValorCss(patrulhamento, 'background'),
        extrairValorCss(baseamento, 'background')
    );
});

test('Baseamento usa roxo no KPI e no local previsto enquanto Patrulhamento permanece verde', () => {
    const declaracao = extrairFuncao(fonteMapaTatico, 'obterTemaLocalAtual');
    const obterTemaLocalAtual = Function(
        `'use strict'; ${declaracao}; return obterTemaLocalAtual;`
    )();

    assert.equal(obterTemaLocalAtual('Patrulhamento'), 'green');
    assert.equal(obterTemaLocalAtual('PATRULHAMENTO ESCOLAR'), 'green');
    assert.equal(obterTemaLocalAtual('Baseamento'), 'purple');
    assert.equal(obterTemaLocalAtual('BASEAMENTO OPERACIONAL'), 'purple');

    assert.match(
        fonteTemplate,
        /<div class="kpi-mini-card theme-green">\s*<span>Patrulhamento<\/span><strong id="kpiPatrulha">/
    );
    assert.match(
        fonteTemplate,
        /<div class="kpi-mini-card theme-purple">\s*<span>Baseamento<\/span><strong id="kpiBase">/
    );
    assert.match(fonteTemplate, /\.theme-purple\s*\{[^}]*border-top\s*:/);
    assert.match(fonteTemplate, /\.theme-purple\s+strong\s*\{[^}]*color\s*:/);
    assert.match(fonteTemplate, /\.equipe-local-atual\.tema-green\s*\{[^}]*background\s*:/);
    assert.match(fonteTemplate, /\.equipe-local-atual\.tema-purple\s*\{[^}]*background\s*:/);
    assert.match(
        fonteMapaTatico,
        /class="equipe-local-atual tema-\$\{info\.temaLocalAtual \|\| 'blue'\}"/
    );
});

test('endereco previsto preserva o snapshot cadastrado na atividade da Ordem de Servico', () => {
    const declaracao = extrairFuncao(fonteMapaTatico, 'montarEnderecoTexto');
    const montarEnderecoTexto = Function(
        `'use strict'; ${declaracao}; return montarEnderecoTexto;`
    )();

    assert.equal(
        montarEnderecoTexto({
            rua: 'Avenida Brasil',
            numero: '100',
            bairro: 'Centro',
            cidade: 'Rio de Janeiro'
        }),
        'Avenida Brasil, 100 | Centro - Rio de Janeiro'
    );
    assert.equal(
        montarEnderecoTexto({
            rua: 'Rua das Flores',
            numero: '-',
            bairro: 'Tijuca',
            cidade: '-'
        }),
        'Rua das Flores | Tijuca'
    );
});

test('card expandido identifica o local previsto na OS e exibe nome, atividade e endereco', () => {
    const montagemInfo = trechoEntre(
        fonteMapaTatico,
        'function montarInfoEquipeMapa',
        'function renderizarPainelEquipesAtivas'
    );
    const renderizacao = trechoEntre(
        fonteMapaTatico,
        'function renderizarPainelEquipesAtivas',
        'function montarAlvoMonitoramento'
    );
    const detalhes = trechoEntre(
        renderizacao,
        '<div class="equipe-card-detalhes">',
        'const btnExpandir = card.querySelector'
    );

    assert.match(
        montagemInfo,
        /const localPrevistoNome\s*=\s*atividadeAtual\?\.local\s*\|\|\s*'Local não informado'/
    );
    assert.match(
        montagemInfo,
        /const enderecoLocalPrevisto\s*=\s*montarEnderecoTexto\(atividadeAtual\)\s*\|\|\s*'Endereço não informado'/
    );
    assert.match(montagemInfo, /\n\s*localPrevistoNome,/);
    assert.match(montagemInfo, /\n\s*enderecoLocalPrevisto,/);

    assert.doesNotMatch(detalhes, /<span>Local Atual<\/span>/);
    assert.match(detalhes, /<span>Local Previsto na Ordem<\/span>/);
    assert.match(
        detalhes,
        /<strong>\$\{escaparHtml\(info\.localPrevistoNome\)\}<\/strong>/
    );
    assert.match(
        detalhes,
        /<small>\$\{escaparHtml\(info\.atividadeAtualNome\)\}\s*•\s*\$\{escaparHtml\(info\.enderecoLocalPrevisto\)\}<\/small>/
    );
});

test('roteiro completo inclui todas as etapas em ordem sem alterar a OS', () => {
    const { obterRoteiroCompleto } = carregarApiRoteiroCompleto();
    const atividades = [
        { id: 3, inicio: '10:00', fim: '10:30', tipo: 'Deslocamento', local: '' },
        { id: 1, inicio: '08:00', fim: '09:00', tipo: 'Preleção' },
        { id: 4, inicio: '11:00', fim: '12:00', tipo: 'Intervalo', local: '   ' },
        { id: 2, inicio: '09:00', fim: '10:00', tipo: 'Baseamento', local: 'Base 1' }
    ];
    const snapshot = structuredClone(atividades);

    const resultado = obterRoteiroCompleto(atividades, '08:00');

    assert.deepEqual(resultado.map(atividade => atividade.id), [1, 2, 3, 4]);
    assert.deepEqual(
        resultado.map(atividade => atividade.tipo),
        ['Preleção', 'Baseamento', 'Deslocamento', 'Intervalo']
    );
    assert.deepEqual(atividades, snapshot, 'A montagem do roteiro não deve reordenar nem alterar a OS.');
});

test('roteiro completo mantém a cronologia da OS quando o turno atravessa a meia-noite', () => {
    const { obterRoteiroCompleto } = carregarApiRoteiroCompleto();
    const atividades = [
        { id: 4, inicio: '02:00', fim: '03:00', tipo: 'Retorno Base' },
        { id: 2, inicio: '23:00', fim: '00:15', tipo: 'Patrulhamento', local: 'Setor atual' },
        { id: 1, inicio: '22:00', fim: '23:00', tipo: 'Baseamento', local: 'Base noturna' },
        { id: 3, inicio: '00:15', fim: '01:00', tipo: 'Intervalo/Refeição' }
    ];

    const resultado = obterRoteiroCompleto(atividades, '22:00');

    assert.deepEqual(resultado.map(atividade => atividade.id), [1, 2, 3, 4]);
});

test('atividade atual do roteiro usa intervalos semiabertos e não marca lacunas', async t => {
    const {
        obterRoteiroCompleto,
        obterIndiceAtividadeAtualRoteiro
    } = carregarApiRoteiroCompleto();
    const roteiro = obterRoteiroCompleto([
        { id: 1, inicio: '08:00', fim: '09:00', tipo: 'Preleção' },
        { id: 2, inicio: '09:00', fim: '10:00', tipo: 'Baseamento', local: 'Base 1' },
        { id: 3, inicio: '10:30', fim: '11:30', tipo: 'Patrulhamento', local: 'Setor 2' }
    ], '08:00');

    const casos = [
        ['no início da primeira atividade', 8 * 60, 0],
        ['durante a primeira atividade', 8 * 60 + 59, 0],
        ['na transição destaca a atividade que inicia', 9 * 60, 1],
        ['no fim da segunda atividade', 10 * 60, -1],
        ['na lacuna', 10 * 60 + 15, -1],
        ['no início da última atividade', 10 * 60 + 30, 2],
        ['no fim da última atividade', 11 * 60 + 30, -1],
        ['antes do roteiro', 7 * 60 + 59, -1]
    ];

    for (const [nome, minutoAtual, indiceEsperado] of casos) {
        await t.test(nome, () => {
            assert.equal(
                obterIndiceAtividadeAtualRoteiro(roteiro, minutoAtual, '08:00'),
                indiceEsperado
            );
        });
    }
});

test('atividade atual do roteiro reconhece a madrugada e não reaparece após o turno', () => {
    const obterMinutoAtualRoteiro = carregarMinutoAtualRoteiro();
    const {
        obterRoteiroCompleto,
        obterIndiceAtividadeAtualRoteiro
    } = carregarApiRoteiroCompleto();
    const roteiro = obterRoteiroCompleto([
        { id: 1, inicio: '22:00', fim: '23:00', tipo: 'Baseamento', local: 'Base noturna' },
        { id: 2, inicio: '23:00', fim: '00:15', tipo: 'Patrulhamento', local: 'Setor 1' },
        { id: 3, inicio: '00:15', fim: '01:00', tipo: 'Baseamento', local: 'Base madrugada' },
        { id: 4, inicio: '02:00', fim: '03:00', tipo: 'Retorno Base' }
    ], '22:00');

    assert.equal(
        obterIndiceAtividadeAtualRoteiro(roteiro, 24 * 60 + 30, '22:00'),
        2
    );
    assert.equal(
        obterIndiceAtividadeAtualRoteiro(roteiro, 24 * 60 + 15, '22:00'),
        2,
        'Na fronteira deve prevalecer a atividade que está iniciando.'
    );

    const fimPrevistoMs = Date.parse('2026-10-11T09:00:00.000Z');
    const minutoDepoisDoTurno = obterMinutoAtualRoteiro(
        {
            dataFimPrevista: new Date(fimPrevistoMs).toISOString(),
            duracaoServicoMinutos: 480
        },
        fimPrevistoMs + 60000,
        6 * 60 + 1,
        '22:00',
        '06:00'
    );

    assert.equal(minutoDepoisDoTurno, 1801);
    assert.equal(
        obterIndiceAtividadeAtualRoteiro(roteiro, minutoDepoisDoTurno, '22:00'),
        -1
    );
});

test('dados do card expõem o roteiro completo e o índice da atividade atual', () => {
    const montagemInfo = trechoEntre(
        fonteMapaTatico,
        'function montarInfoEquipeMapa',
        'function renderizarPainelEquipesAtivas'
    );

    assert.match(
        fonteMapaTatico,
        /function obterRoteiroCompleto\(\s*atividades\s*,\s*horaInicioTurno\s*\)/
    );
    assert.match(
        fonteMapaTatico,
        /function obterIndiceAtividadeAtualRoteiro\(\s*roteiroCompleto\s*,\s*minutoAtualRoteiro\s*,\s*horaInicioTurno\s*\)/
    );
    assert.match(montagemInfo, /obterRoteiroCompleto\s*\(/);
    assert.match(montagemInfo, /obterIndiceAtividadeAtualRoteiro\s*\(/);
    assert.match(montagemInfo, /obterMinutoAtualRoteiro\s*\(/);
    assert.match(montagemInfo, /\n\s*roteiroCompleto\s*(?:,|:)/);
    assert.match(montagemInfo, /\n\s*indiceAtividadeAtualRoteiro\s*(?:,|:)/);

    const preenchimentoModal = trechoEntre(
        fonteMapaTatico,
        'function preencherModalRoteiro',
        'function alternarFundoModalRoteiro'
    );
    assert.match(
        preenchimentoModal,
        /gerarLinhasTabelaRoteiro\(\s*info\.roteiroCompleto\s*,\s*info\.indiceAtividadeAtualRoteiro\s*\)/
    );
});

test('card expandido oferece botão acessível para abrir o roteiro em diálogo', () => {
    const renderizacao = trechoEntre(
        fonteMapaTatico,
        'function renderizarPainelEquipesAtivas',
        'function montarAlvoMonitoramento'
    );
    const detalhes = trechoEntre(
        renderizacao,
        '<div class="equipe-card-detalhes">',
        'const btnExpandir = card.querySelector'
    );
    const correspondenciaBotao = detalhes.match(
        /<button\b[^>]*class="[^"]*\bbtn-roteiro-equipe\b[^"]*"[^>]*>[\s\S]*?<\/button>/
    );

    assert.ok(correspondenciaBotao, 'Botão Roteiro ausente dos detalhes expandidos.');
    assert.match(correspondenciaBotao[0], /\btype="button"/);
    assert.match(correspondenciaBotao[0], /\baria-haspopup="dialog"/);
    assert.match(correspondenciaBotao[0], /\baria-controls="modalRoteiroEquipe"/);
    assert.match(
        correspondenciaBotao[0],
        /\baria-label="Ver roteiro da OS \$\{escaparHtml\(String\(info\.osNumero\)\)\} da equipe \$\{escaparHtml\(info\.tipoServico\)\}"/
    );
    assert.match(correspondenciaBotao[0], />[\s\S]*Roteiro[\s\S]*<\/button>/);
});

test('modal do roteiro é acessível e apresenta tabela de quatro colunas', () => {
    const correspondenciaModal = fonteTemplate.match(
        /<([a-z][\w-]*)\b[^>]*\bid="modalRoteiroEquipe"[^>]*>/i
    );

    assert.ok(correspondenciaModal, 'Modal do roteiro ausente do template.');
    assert.match(correspondenciaModal[0], /\brole="dialog"/);
    assert.match(correspondenciaModal[0], /\baria-modal="true"/);
    assert.match(correspondenciaModal[0], /\baria-labelledby="[^"]+"/);
    const idTitulo = correspondenciaModal[0].match(/\baria-labelledby="([^"]+)"/)[1];
    assert.match(fonteTemplate, new RegExp(`\\bid="${escaparRegex(idTitulo)}"`));
    assert.match(
        fonteTemplate,
        /<th[^>]*>\s*Horário\s*<\/th>[\s\S]*?<th[^>]*>\s*Atividade\s*<\/th>[\s\S]*?<th[^>]*>\s*Local\s*\/\s*Endereço\s*<\/th>[\s\S]*?<th[^>]*>\s*Operação\s*<\/th>/
    );
    assert.match(
        fonteTemplate,
        /<td[^>]*colspan="4"[^>]*>\s*Nenhuma atividade prevista nesta Ordem de Serviço\.\s*<\/td>/
    );
});

test('roteiro renderiza operação vinculada, fallback legado e ausência com quatro colunas', () => {
    const gerarLinhasTabelaRoteiro = carregarGeradorLinhasRoteiro();
    const html = gerarLinhasTabelaRoteiro([
        {
            inicio: '08:00',
            fim: '09:00',
            tipo: 'Baseamento',
            local: 'Base 1',
            operacao: 'Operação Águia'
        },
        {
            inicio: '09:00',
            fim: '10:00',
            tipo: 'Patrulhamento',
            local: 'Setor 2',
            operacao: '   '
        },
        {
            inicio: '10:00',
            fim: '11:00',
            tipo: 'Deslocamento',
            detalhes: '[OP: Operação Legada] Apoio no deslocamento'
        },
        {
            inicio: '11:00',
            fim: '12:00',
            tipo: 'Retorno Base',
            detalhe: '[OP: Operação Antiga] Registro legado singular'
        }
    ], -1);

    const celulasOperacao = html.match(
        /<td[^>]*data-label="Operação"[^>]*>[\s\S]*?<\/td>/g
    ) || [];
    assert.equal(celulasOperacao.length, 4);
    assert.match(celulasOperacao[0], /Operação Águia/);
    assert.match(celulasOperacao[1], />\s*-\s*</);
    assert.match(celulasOperacao[2], /Operação Legada/i);
    assert.match(celulasOperacao[3], /Operação Antiga/i);
    assert.doesNotMatch(html, /roteiro-atividade-atual|aria-current|roteiro-agora/);

    const estadoVazio = gerarLinhasTabelaRoteiro([], -1);
    assert.match(
        estadoVazio,
        /<td[^>]*colspan="4"[^>]*>\s*Nenhuma atividade prevista nesta Ordem de Serviço\.\s*<\/td>/
    );
});

test('roteiro escapa todos os campos, inclusive a operação vinculada', () => {
    const gerarLinhasTabelaRoteiro = carregarGeradorLinhasRoteiro();
    const linha = gerarLinhasTabelaRoteiro([{
        inicio: '<b>08:00</b>',
        fim: '<i>09:00</i>',
        tipo: '<script>tipo</script>',
        local: '<img src=x onerror=alert(1)>',
        rua: '<svg onload=alert(2)>',
        numero: '10',
        bairro: 'Centro',
        cidade: 'Rio de Janeiro',
        operacao: '<iframe src=javascript:alert(3)>operação</iframe>'
    }], -1);

    assert.doesNotMatch(linha, /<(?:b|i|script|img|svg|iframe)\b/i);
    assert.match(linha, /&lt;b&gt;08:00&lt;\/b&gt;\s*às\s*&lt;i&gt;09:00&lt;\/i&gt;/);
    assert.match(linha, /&lt;script&gt;tipo&lt;\/script&gt;/);
    assert.match(linha, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(linha, /&lt;svg onload=alert\(2\)&gt;, 10 \| Centro - Rio de Janeiro/);
    assert.match(linha, /&lt;iframe src=javascript:alert\(3\)&gt;operação&lt;\/iframe&gt;/);
});

test('somente a atividade atual recebe destaque semântico e selo Agora', () => {
    const gerarLinhasTabelaRoteiro = carregarGeradorLinhasRoteiro();
    const html = gerarLinhasTabelaRoteiro([
        { id: 1, inicio: '08:00', fim: '09:00', tipo: 'Preleção' },
        { id: 2, inicio: '09:00', fim: '10:00', tipo: 'Baseamento', local: 'Base atual' },
        { id: 3, inicio: '10:00', fim: '11:00', tipo: 'Patrulhamento', local: 'Setor seguinte' }
    ], 1);
    const linhas = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) || [];

    assert.equal(linhas.length, 3);
    assert.doesNotMatch(linhas[0], /roteiro-atividade-atual|aria-current|roteiro-agora/);
    assert.match(linhas[1], /class="[^"]*\broteiro-atividade-atual\b[^"]*"/);
    assert.match(linhas[1], /aria-current="step"/);
    assert.match(linhas[1], /class="[^"]*\broteiro-agora\b[^"]*"[^>]*>\s*Agora\s*</);
    assert.doesNotMatch(linhas[2], /roteiro-atividade-atual|aria-current|roteiro-agora/);

    assert.match(fonteTemplate, /\.roteiro-atividade-atual[^\{]*\{/);
    assert.match(fonteTemplate, /\.roteiro-agora[^\{]*\{/);
});
