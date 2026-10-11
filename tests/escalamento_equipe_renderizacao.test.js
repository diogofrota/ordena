'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raizProjeto = path.resolve(__dirname, '..');
const fonteEscalamento = fs.readFileSync(
    path.join(raizProjeto, 'js', 'escalamento.js'),
    'utf8'
);
const fonteTemplate = fs.readFileSync(
    path.join(raizProjeto, 'templates', 'escalamento.html'),
    'utf8'
);

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

function extrairBloco(fonte, marcador) {
    const inicio = fonte.indexOf(marcador);
    assert.notEqual(inicio, -1, `Bloco ausente: ${marcador}`);

    const inicioCorpo = fonte.indexOf('{', inicio);
    assert.notEqual(inicioCorpo, -1, `Corpo do bloco ausente: ${marcador}`);

    let profundidade = 0;
    for (let indice = inicioCorpo; indice < fonte.length; indice += 1) {
        if (fonte[indice] === '{') profundidade += 1;
        if (fonte[indice] === '}') profundidade -= 1;
        if (profundidade === 0) return fonte.slice(inicioCorpo + 1, indice);
    }

    assert.fail(`Fim do bloco ausente: ${marcador}`);
}

function criarElemento(propriedades = {}) {
    const classes = new Set();
    const atributos = new Map();

    return {
        value: '',
        hidden: false,
        disabled: false,
        textContent: '',
        className: '',
        placeholder: '',
        focado: false,
        ...propriedades,
        classList: {
            toggle(nome, forcar) {
                const ativo = forcar === undefined ? !classes.has(nome) : Boolean(forcar);
                if (ativo) classes.add(nome);
                else classes.delete(nome);
                return ativo;
            },
            contains(nome) {
                return classes.has(nome);
            }
        },
        setAttribute(nome, valor) {
            atributos.set(nome, String(valor));
        },
        getAttribute(nome) {
            return atributos.get(nome) ?? null;
        },
        removeAttribute(nome) {
            atributos.delete(nome);
        },
        hasAttribute(nome) {
            return atributos.has(nome);
        },
        focus() {
            this.focado = true;
        }
    };
}

function criarDocumento(elementos, elementosInvalidos = []) {
    return {
        getElementById(id) {
            return elementos[id] || null;
        },
        querySelectorAll(seletor) {
            assert.equal(seletor, '#editorEquipe [aria-invalid="true"]');
            return elementosInvalidos;
        }
    };
}

function criarNoDom(tagName, propriedades = {}) {
    const no = criarElemento({
        tagName: tagName.toUpperCase(),
        id: '',
        children: [],
        parentNode: null,
        ...propriedades
    });
    let conteudoHtml = '';

    Object.defineProperty(no, 'innerHTML', {
        get() {
            return conteudoHtml;
        },
        set(valor) {
            conteudoHtml = String(valor);
            if (conteudoHtml === '') {
                this.children.forEach(filho => {
                    filho.parentNode = null;
                });
                this.children = [];
            }
        }
    });

    no.appendChild = function appendChild(filho) {
        filho.parentNode = this;
        this.children.push(filho);
        return filho;
    };
    no.insertAdjacentElement = function insertAdjacentElement(posicao, elemento) {
        assert.equal(posicao, 'afterend');
        assert.ok(this.parentNode, 'O elemento de referência deve estar ligado ao DOM.');
        const indice = this.parentNode.children.indexOf(this);
        assert.notEqual(indice, -1);
        elemento.parentNode = this.parentNode;
        this.parentNode.children.splice(indice + 1, 0, elemento);
        return elemento;
    };
    no.remove = function remove() {
        if (!this.parentNode) return;
        const indice = this.parentNode.children.indexOf(this);
        if (indice >= 0) this.parentNode.children.splice(indice, 1);
        this.parentNode = null;
    };

    return no;
}

function criarHarnessRenderizacao({ indiceEdicao = -1 } = {}) {
    const tabela = criarNoDom('table');
    const listaIntegrantes = criarNoDom('tbody', { id: 'listaIntegrantes' });
    const editorEquipe = criarNoDom('tbody', { id: 'editorEquipe' });
    const resumoEquipe = criarNoDom('small', { id: 'resumoEquipe' });
    tabela.appendChild(listaIntegrantes);
    tabela.appendChild(editorEquipe);

    function buscarPorId(no, id) {
        if (no.id === id) return no;
        for (const filho of no.children || []) {
            const encontrado = buscarPorId(filho, id);
            if (encontrado) return encontrado;
        }
        return null;
    }

    const documento = {
        getElementById(id) {
            if (id === 'resumoEquipe') return resumoEquipe;
            return buscarPorId(tabela, id);
        },
        createElement(tagName) {
            return criarNoDom(tagName);
        }
    };
    const membros = [
        { policialId: 'p1', funcao: 'Comandante', rg: '111', nome: 'ALFA', posto: 'TC', tel: '1111' },
        { policialId: 'p2', funcao: 'Auxiliar', rg: '222', nome: 'BRAVO', posto: 'SGT', tel: '2222' },
        { policialId: 'p3', funcao: 'Auxiliar', rg: '333', nome: 'CHARLIE', posto: 'CB', tel: '3333' }
    ];

    const montar = Function(
        'document',
        'estadoInicial',
        `'use strict';
        let membrosEquipe = estadoInicial.membrosEquipe;
        let indiceMembroEmEdicao = estadoInicial.indiceMembroEmEdicao;

        function escaparHtml(valor) { return String(valor ?? ''); }
        function tipoMotoEstaSelecionado() { return false; }
        function obterRotuloMoto() { return '-'; }
        function atualizarColunaMotoEquipe() {}
        function popularPoliciaisEquipe() {}
        function atualizarEstadoEditorEquipe() {}
        function atualizarSelectMotosEditor() {}

        ${extrairFuncao(fonteEscalamento, 'renderizarEquipe')}

        return {
            renderizar: renderizarEquipe,
            definirIndiceEdicao(indice) { indiceMembroEmEdicao = indice; }
        };`
    );

    return {
        tabela,
        listaIntegrantes,
        editorEquipe,
        resumoEquipe,
        api: montar(documento, {
            membrosEquipe: membros,
            indiceMembroEmEdicao: indiceEdicao
        })
    };
}

function criarHarnessEstadoEditor({ rg = '', indiceEdicao = -1, processando = false } = {}) {
    const elementos = {
        editorEquipe: criarElemento(),
        funcaoMembro: criarElemento(),
        btnAdicionarMembro: criarElemento(),
        btnCancelarEdicaoMembro: criarElemento({ hidden: true }),
        btnCadastrarPolicialEquipe: criarElemento({ hidden: true }),
        acoesEditorEquipe: criarElemento(),
        rgMembro: criarElemento({ value: rg }),
        textoBtnAdicionarMembro: criarElemento(),
        loadingAdicionarMembro: criarElemento({ hidden: true })
    };
    const documento = criarDocumento(elementos);
    const membros = [
        { policialId: 'p1', funcao: 'Comandante', rg: '72706' }
    ];

    const montar = Function(
        'document',
        'estadoInicial',
        `'use strict';
        const MAX_MEMBROS_EQUIPE = 6;
        let membrosEquipe = estadoInicial.membrosEquipe;
        let indiceMembroEmEdicao = estadoInicial.indiceMembroEmEdicao;
        let buscaPolicialEmAndamento = estadoInicial.buscaPolicialEmAndamento;
        let rgNaoCadastradoPendente = '';
        ${extrairFuncao(fonteEscalamento, 'normalizarRgPolicial')}
        ${extrairFuncao(fonteEscalamento, 'atualizarEstadoEditorEquipe')}
        return atualizarEstadoEditorEquipe;`
    );

    return {
        elementos,
        atualizar: montar(documento, {
            membrosEquipe: membros,
            indiceMembroEmEdicao: indiceEdicao,
            buscaPolicialEmAndamento: processando
        })
    };
}

function criarHarnessCancelamento({ indiceEdicao = -1, rascunho = null } = {}) {
    const campoInvalido = criarElemento();
    campoInvalido.setAttribute('aria-invalid', 'true');

    const elementos = {
        policialMembro: criarElemento({ value: 'p2' }),
        nomeMembro: criarElemento({ value: 'SILVA', placeholder: 'Policial localizado' }),
        postoMembro: criarElemento({ value: 'CB' }),
        rgMembro: criarElemento({ value: '78909' }),
        telMembro: criarElemento({ value: '(21) 90000-0000' }),
        motoMembro: criarElemento({ value: 'MOTO-1' }),
        detalhesPolicialSelecionado: criarElemento({ textContent: 'Policial localizado.' }),
        btnCadastrarPolicialEquipe: criarElemento({ hidden: false }),
        btnAtivarGuarnicao: criarElemento()
    };
    const documento = criarDocumento(elementos, [campoInvalido]);
    const membros = [
        { policialId: 'p1', funcao: 'Comandante', rg: '72706' },
        { policialId: 'p3', funcao: 'Auxiliar', rg: '45678' }
    ];
    const eventos = {
        renderizacoes: 0,
        rascunhosRestaurados: [],
        feedbacks: [],
        focosNoEditor: 0
    };

    const montar = Function(
        'document',
        'estadoInicial',
        'eventos',
        `'use strict';
        let membrosEquipe = estadoInicial.membrosEquipe;
        let indiceMembroEmEdicao = estadoInicial.indiceMembroEmEdicao;
        let rascunhoEditorAntesEdicao = estadoInicial.rascunhoEditorAntesEdicao;
        let rgNaoCadastradoPendente = estadoInicial.rgNaoCadastradoPendente;

        function renderizarEquipe() { eventos.renderizacoes += 1; }
        function restaurarRascunhoEditorEquipe(rascunho) {
            eventos.rascunhosRestaurados.push(rascunho);
        }
        function mostrarFeedbackAtivacao(tipo, mensagem) {
            eventos.feedbacks.push({ tipo, mensagem });
        }
        function focarEditorOuResumoEquipe() { eventos.focosNoEditor += 1; }

        ${extrairFuncao(fonteEscalamento, 'normalizarRgPolicial')}
        ${extrairFuncao(fonteEscalamento, 'editorEquipeTemDados')}
        ${extrairFuncao(fonteEscalamento, 'limparEditorEquipe')}
        ${extrairFuncao(fonteEscalamento, 'cancelarEdicaoMembro')}

        return {
            cancelar: cancelarEdicaoMembro,
            temDadosPendentes: editorEquipeTemDados,
            obterEstado() {
                return {
                    membrosEquipe,
                    indiceMembroEmEdicao,
                    rascunhoEditorAntesEdicao,
                    rgNaoCadastradoPendente
                };
            }
        };`
    );

    return {
        campoInvalido,
        elementos,
        eventos,
        membros,
        api: montar(documento, {
            membrosEquipe: membros,
            indiceMembroEmEdicao: indiceEdicao,
            rascunhoEditorAntesEdicao: rascunho,
            rgNaoCadastradoPendente: '78909'
        }, eventos)
    };
}

test('markup oferece um botão secundário explícito para cancelar inclusão ou edição', () => {
    const correspondencia = fonteTemplate.match(
        /<button\b[^>]*id="btnCancelarEdicaoMembro"[^>]*>[\s\S]*?<\/button>/
    );

    assert.ok(correspondencia, 'O botão de cancelamento da equipe deveria existir.');
    const botao = correspondencia[0];
    assert.match(botao, /type="button"/);
    assert.match(botao, /class="btn-secondary"/);
    assert.match(botao, /onclick="cancelarEdicaoMembro\(\)"/);
    assert.match(botao, /\shidden(?:\s|>)/);
    assert.match(botao, />\s*Cancelar\s*<\/button>/);
});

test('editor limita a busca à coluna RG e acomoda os botões no espaço disponível', () => {
    assert.match(
        fonteTemplate,
        /<td\b[^>]*class="equipe-campo-rg"[^>]*colspan="1"[^>]*>/
    );

    const cssDesktop = extrairBloco(fonteTemplate, '@media (min-width: 769px)');
    assert.match(cssDesktop, /\.equipe-busca-rg\s*{[^}]*flex-wrap:\s*wrap;/);
    assert.match(
        cssDesktop,
        /\.equipe-editor-acoes\.com-cancelamento\s*{[^}]*display:\s*contents;/
    );

    const cssMobile = extrairBloco(fonteTemplate, '@media (max-width: 768px)');
    assert.match(cssMobile, /\.equipe-busca-rg\s*{[^}]*flex-direction:\s*column;/);
    assert.match(
        cssMobile,
        /\.equipe-busca-rg\s+\.equipe-editor-acoes\s*{[^}]*width:\s*100%;[^}]*flex-wrap:\s*wrap;/
    );
});

test('renderização substitui a linha editada pelo editor e restaura a lista ao encerrar a edição', () => {
    const harness = criarHarnessRenderizacao({ indiceEdicao: 1 });

    harness.api.renderizar();

    assert.deepEqual(
        harness.tabela.children.map(elemento => elemento.id),
        ['listaIntegrantes', 'editorEquipe', 'listaIntegrantesDepoisEditor']
    );
    const listaDepoisEditor = harness.tabela.children[2];
    assert.equal(harness.listaIntegrantes.children.length, 1);
    assert.equal(listaDepoisEditor.children.length, 1);
    assert.match(harness.listaIntegrantes.children[0].innerHTML, /ALFA/);
    assert.match(listaDepoisEditor.children[0].innerHTML, /CHARLIE/);
    assert.doesNotMatch(
        `${harness.listaIntegrantes.children[0].innerHTML}${listaDepoisEditor.children[0].innerHTML}`,
        /BRAVO/
    );

    harness.api.definirIndiceEdicao(-1);
    harness.api.renderizar();

    assert.deepEqual(
        harness.tabela.children.map(elemento => elemento.id),
        ['listaIntegrantes', 'editorEquipe']
    );
    assert.equal(harness.listaIntegrantes.children.length, 3);
    const linhasRestauradas = harness.listaIntegrantes.children
        .map(linha => linha.innerHTML)
        .join('');
    for (const nome of ['ALFA', 'BRAVO', 'CHARLIE']) {
        assert.equal((linhasRestauradas.match(new RegExp(nome, 'g')) || []).length, 1);
    }
});

test('cancelamento aparece ao digitar RG, adapta o rótulo na edição e bloqueia durante a busca', () => {
    const inclusao = criarHarnessEstadoEditor();
    inclusao.atualizar();
    assert.equal(inclusao.elementos.editorEquipe.classList.contains('equipe-em-edicao'), false);
    assert.equal(inclusao.elementos.btnCancelarEdicaoMembro.hidden, true);
    assert.equal(inclusao.elementos.btnCancelarEdicaoMembro.textContent, 'Cancelar');

    inclusao.elementos.rgMembro.value = '78.909';
    inclusao.atualizar();
    assert.equal(inclusao.elementos.btnCancelarEdicaoMembro.hidden, false);
    assert.equal(inclusao.elementos.btnCancelarEdicaoMembro.disabled, false);
    assert.equal(
        inclusao.elementos.acoesEditorEquipe.classList.contains('com-cancelamento'),
        true
    );

    const edicao = criarHarnessEstadoEditor({ rg: '72706', indiceEdicao: 0 });
    edicao.atualizar();
    assert.equal(edicao.elementos.editorEquipe.classList.contains('equipe-em-edicao'), true);
    assert.equal(edicao.elementos.btnCancelarEdicaoMembro.hidden, false);
    assert.equal(edicao.elementos.btnCancelarEdicaoMembro.textContent, 'Cancelar');

    const duranteBusca = criarHarnessEstadoEditor({ rg: '78909', processando: true });
    duranteBusca.atualizar();
    assert.equal(duranteBusca.elementos.btnCancelarEdicaoMembro.hidden, false);
    assert.equal(duranteBusca.elementos.btnCancelarEdicaoMembro.disabled, true);
});

test('cancelar inclusão preserva a equipe, limpa todo o rascunho e confirma a manutenção dos integrantes', () => {
    const harness = criarHarnessCancelamento();
    const equipeAntes = structuredClone(harness.membros);

    assert.equal(harness.api.temDadosPendentes(), true);
    harness.api.cancelar();

    const estado = harness.api.obterEstado();
    assert.deepEqual(estado.membrosEquipe, equipeAntes);
    assert.equal(estado.indiceMembroEmEdicao, -1);
    assert.equal(estado.rascunhoEditorAntesEdicao, null);
    assert.equal(estado.rgNaoCadastradoPendente, '');
    assert.equal(harness.api.temDadosPendentes(), false);

    for (const id of [
        'policialMembro',
        'nomeMembro',
        'postoMembro',
        'rgMembro',
        'telMembro',
        'motoMembro'
    ]) {
        assert.equal(harness.elementos[id].value, '', `${id} deveria ser limpo.`);
    }
    assert.equal(harness.elementos.nomeMembro.placeholder, 'Preenchido pelo RG');
    assert.equal(harness.elementos.detalhesPolicialSelecionado.textContent, '');
    assert.equal(harness.elementos.btnCadastrarPolicialEquipe.hidden, true);
    assert.equal(harness.campoInvalido.hasAttribute('aria-invalid'), false);
    assert.equal(harness.eventos.renderizacoes, 1);
    assert.deepEqual(harness.eventos.feedbacks, [{
        tipo: 'info',
        mensagem: 'Inclusão cancelada. Os policiais já adicionados foram mantidos.'
    }]);
    assert.equal(harness.elementos.btnAtivarGuarnicao.focado, true);
    assert.equal(harness.eventos.focosNoEditor, 0);
});

test('cancelar edição mantém os integrantes e restaura o rascunho anterior com feedback próprio', () => {
    const rascunhoAnterior = { rgDigitado: '99999', motoPrefixo: 'MOTO-2' };
    const harness = criarHarnessCancelamento({
        indiceEdicao: 1,
        rascunho: rascunhoAnterior
    });
    const equipeAntes = structuredClone(harness.membros);

    harness.api.cancelar();

    const estado = harness.api.obterEstado();
    assert.deepEqual(estado.membrosEquipe, equipeAntes);
    assert.equal(estado.indiceMembroEmEdicao, -1);
    assert.equal(estado.rascunhoEditorAntesEdicao, null);
    assert.deepEqual(harness.eventos.rascunhosRestaurados, [rascunhoAnterior]);
    assert.deepEqual(harness.eventos.feedbacks, [{
        tipo: 'info',
        mensagem: 'Edição cancelada. Nenhum dado da equipe foi alterado.'
    }]);
    assert.equal(harness.elementos.btnAtivarGuarnicao.focado, false);
    assert.equal(harness.eventos.focosNoEditor, 1);
});
