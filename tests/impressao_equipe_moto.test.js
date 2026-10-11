'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raizProjeto = path.resolve(__dirname, '..');
const impressoes = [
    {
        nome: 'ativação',
        fonte: fs.readFileSync(path.join(raizProjeto, 'js', 'impressao_ativacao.js'), 'utf8'),
        template: fs.readFileSync(path.join(raizProjeto, 'templates', 'impressao_ativacao.html'), 'utf8')
    },
    {
        nome: 'histórico',
        fonte: fs.readFileSync(path.join(raizProjeto, 'js', 'impressao_historico.js'), 'utf8'),
        template: fs.readFileSync(path.join(raizProjeto, 'templates', 'impressao_historico.html'), 'utf8')
    }
];

function extrairFuncao(fonte, nome) {
    const assinatura = `function ${nome}`;
    const inicio = fonte.indexOf(assinatura);
    assert.notEqual(inicio, -1, `Função ausente: ${nome}`);

    const inicioCorpo = fonte.indexOf('{', inicio);
    assert.notEqual(inicioCorpo, -1, `Corpo da função ausente: ${nome}`);

    let profundidade = 0;
    for (let indice = inicioCorpo; indice < fonte.length; indice += 1) {
        if (fonte[indice] === '{') profundidade += 1;
        if (fonte[indice] === '}') profundidade -= 1;
        if (profundidade === 0) return fonte.slice(inicio, indice + 1);
    }

    assert.fail(`Fim da função ausente: ${nome}`);
}

function criarHarness(fonte) {
    const cabecalhoMoto = { hidden: true };
    const tabelaEquipe = { innerHTML: '' };
    const seletoresConsultados = [];
    const document = {
        getElementById(id) {
            return id === 'tabelaEquipe' ? tabelaEquipe : null;
        },
        querySelectorAll(seletor) {
            seletoresConsultados.push(seletor);
            return seletor === '[data-coluna-moto-equipe]' ? [cabecalhoMoto] : [];
        }
    };

    const montar = Function(
        'document',
        `'use strict';
        function escaparHtml(valor) {
            return String(valor ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        ${extrairFuncao(fonte, 'deveExibirColunaMotoEquipe')}
        ${extrairFuncao(fonte, 'configurarColunaMotoEquipe')}
        ${extrairFuncao(fonte, 'preencherEquipe')}
        return {
            deveExibir: deveExibirColunaMotoEquipe,
            preencher: preencherEquipe
        };`
    );

    return {
        api: montar(document),
        cabecalhoMoto,
        tabelaEquipe,
        seletoresConsultados
    };
}

function quantidadeCelulas(html) {
    return (html.match(/<td\b/g) || []).length;
}

for (const impressao of impressoes) {
    test(`impressão de ${impressao.nome} mantém a decisão da coluna Moto em função separada`, () => {
        const harness = criarHarness(impressao.fonte);

        ['Moto', ' MOTO ', 'moto', 'Motocicleta', 'MOTOCICLETAS'].forEach(tipoRecurso => {
            assert.equal(harness.api.deveExibir({ tipoRecurso }), true);
        });

        assert.equal(
            harness.api.deveExibir({ tipoPoliciamento: 'Moto' }),
            true,
            'O campo legado deve continuar identificando guarnições de moto.'
        );
        assert.equal(
            harness.api.deveExibir({ tipoRecurso: 'Carro', tipoPoliciamento: 'Moto' }),
            false,
            'O tipo de recurso atual deve prevalecer sobre o campo legado.'
        );

        [
            'Carro',
            'Setor',
            'Cabine',
            'A pé',
            'Motorizado',
            '',
            null,
            undefined
        ].forEach(tipoRecurso => {
            assert.equal(harness.api.deveExibir({ tipoRecurso }), false);
        });
        assert.equal(harness.api.deveExibir(null), false);
    });

    test(`impressão de ${impressao.nome} mostra a coluna e a moto de cada policial para recurso Moto`, () => {
        const harness = criarHarness(impressao.fonte);
        harness.api.preencher({
            tipoRecurso: 'Moto',
            equipe: [
                {
                    funcao: 'Comandante',
                    posto: 'SGT',
                    nome: 'ALFA',
                    rg: '12345',
                    motoPrefixo: 'MOTO-01'
                },
                {
                    funcao: 'Integrante',
                    posto: 'CB',
                    nome: 'BRAVO',
                    rg: '67890',
                    motoPrefixo: 'MOTO-02'
                }
            ]
        });

        assert.equal(harness.cabecalhoMoto.hidden, false);
        assert.deepEqual(harness.seletoresConsultados, ['[data-coluna-moto-equipe]']);
        assert.equal(quantidadeCelulas(harness.tabelaEquipe.innerHTML), 10);
        assert.match(harness.tabelaEquipe.innerHTML, />MOTO-01<\/td>/);
        assert.match(harness.tabelaEquipe.innerHTML, />MOTO-02<\/td>/);
    });

    test(`impressão de ${impressao.nome} omite toda a coluna Moto para Carro e demais recursos`, () => {
        for (const tipoRecurso of ['Carro', 'Setor', 'Cabine', undefined]) {
            const harness = criarHarness(impressao.fonte);
            harness.api.preencher({
                tipoRecurso,
                equipe: [{
                    funcao: 'Comandante',
                    posto: 'TC',
                    nome: 'FROTA',
                    rg: '72706',
                    motoPrefixo: 'VALOR-LEGADO-QUE-NAO-DEVE-APARECER'
                }]
            });

            assert.equal(harness.cabecalhoMoto.hidden, true, `Cabeçalho visível para ${tipoRecurso}`);
            assert.deepEqual(harness.seletoresConsultados, ['[data-coluna-moto-equipe]']);
            assert.equal(quantidadeCelulas(harness.tabelaEquipe.innerHTML), 4);
            assert.doesNotMatch(harness.tabelaEquipe.innerHTML, /VALOR-LEGADO/);
        }
    });

    test(`template da impressão de ${impressao.nome} inicia o cabeçalho Moto oculto e identificável`, () => {
        assert.match(
            impressao.template,
            /<th\b(?=[^>]*\bdata-coluna-moto-equipe\b)(?=[^>]*\bhidden\b)[^>]*>\s*Moto\s*<\/th>/i
        );
    });
}
