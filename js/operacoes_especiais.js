const filtroUrlOperacoes = new URLSearchParams(window.location.search).get('filtro');
let statusFiltroAtualOperacoes = filtroUrlOperacoes === 'Inativa' ? 'Inativa' : 'Ativa';
let salvamentoOperacaoEmAndamento = false;
let salvamentoFeedbackEmAndamento = false;
let inativacaoOperacaoEmAndamento = false;
let referenciaOperacaoCadastro = null;
let referenciaOperacaoFeedback = null;
let referenciaOperacaoInativacao = null;
let elementoRetornoModalFeedback = null;
let elementoRetornoModalInativacao = null;
let temporizadorAtualizacaoOperacoes = null;
let sequenciaCarregamentoDetalhesOperacao = 0;
let sequenciaCarregamentoAvaliacoesOperacao = 0;
let sequenciaCarregamentoCadastroAvaliacao = 0;
const CHAVE_FEEDBACK_NAVEGACAO_OPERACOES = 'operacoesFeedbackNavegacao';
const CHAVE_FEEDBACK_NAVEGACAO_AVALIACOES = 'avaliacoesOperacaoFeedbackNavegacao';

const AVALIACOES_GERAIS_VALIDAS = [
    'Muito satisfatória',
    'Satisfatória',
    'Parcialmente satisfatória',
    'Insatisfatória'
];
const RESPOSTAS_EFETIVO_VALIDAS = ['Sim', 'Parcialmente', 'Não'];
const LIMITE_TEXTO_AVALIACAO = 2000;

document.addEventListener('DOMContentLoaded', () => {
    const formOperacao = document.getElementById('operacaoForm');
    const listaOperacoes = document.getElementById('listaOperacoes');
    const formFeedback = document.getElementById('feedbackOperacaoForm');
    const formAvaliacao = document.getElementById('avaliacaoOperacaoForm');
    const campoNome = document.getElementById('operacaoNome');
    const campoInicio = document.getElementById('operacaoInicio');
    const campoFim = document.getElementById('operacaoFim');
    const modalFeedback = document.getElementById('modalFeedbackOperacao');
    const modalInativacao = document.getElementById('modalInativarOperacao');
    const formInativacao = document.getElementById('inativarOperacaoForm');

    if (formOperacao) {
        formOperacao.addEventListener('submit', salvarNovaOperacao);
        formOperacao.addEventListener('input', (event) => {
            event.target.removeAttribute('aria-invalid');
            limparMensagem(document.getElementById('cadastroOperacaoFeedback'));
        });
    }
    if (formFeedback) {
        formFeedback.addEventListener('submit', salvarFeedbackOperacao);
        formFeedback.addEventListener('input', (event) => {
            event.target.removeAttribute('aria-invalid');
            limparMensagem(document.getElementById('modalFeedbackMensagem'));
        });
    }
    if (formAvaliacao) {
        formAvaliacao.addEventListener('submit', salvarAvaliacaoOperacao);
        formAvaliacao.addEventListener('input', (event) => {
            event.target.removeAttribute('aria-invalid');
            limparMensagem(document.getElementById('cadastroAvaliacaoFeedback'));
        });
    }
    if (formInativacao) formInativacao.addEventListener('submit', confirmarInativacaoOperacao);
    if (campoNome) {
        campoNome.addEventListener('input', (event) => {
            event.target.value = event.target.value.toUpperCase();
            event.target.removeAttribute('aria-invalid');
        });
    }
    if (campoInicio) campoInicio.addEventListener('change', sincronizarPeriodoCadastro);
    if (campoFim) campoFim.addEventListener('input', () => campoFim.removeAttribute('aria-invalid'));

    document.getElementById('btnCancelarFeedback')?.addEventListener('click', fecharModalFeedback);
    document.getElementById('btnCancelarAvaliacao')?.addEventListener('click', voltarParaAvaliacoesOperacaoAtual);
    document.getElementById('btnCancelarInativacao')?.addEventListener('click', fecharModalInativacao);
    document.getElementById('btnCancelarEdicaoOperacao')?.addEventListener('click', cancelarEdicaoOperacao);
    document.getElementById('btnCadastrarAvaliacao')?.addEventListener('click', abrirCadastroAvaliacaoOperacaoAtual);
    document.getElementById('btnVerAvaliacoesCadastro')?.addEventListener('click', voltarParaAvaliacoesOperacaoAtual);
    configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesAvaliacoes', false);
    configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesCadastroAvaliacao', false);

    if (modalFeedback) {
        modalFeedback.addEventListener('click', (event) => {
            if (event.target === modalFeedback) fecharModalFeedback();
        });
    }
    if (modalInativacao) {
        modalInativacao.addEventListener('click', (event) => {
            if (event.target === modalInativacao) fecharModalInativacao();
        });
    }

    document.addEventListener('keydown', (event) => {
        const modalAberto = [modalInativacao, modalFeedback]
            .find((modal) => modal && !modal.hidden);
        if (!modalAberto) return;
        if (event.key === 'Escape') {
            if (modalAberto === modalInativacao) fecharModalInativacao();
            else fecharModalFeedback();
        }
        if (event.key === 'Tab') manterFocoNoModal(event, modalAberto);
    });

    if (formOperacao) carregarEdicaoOperacaoDaUrl();
    if (listaOperacoes) {
        atualizarBotoesFiltroOperacoes();
        renderizarOperacoes();
        restaurarFeedbackNavegacaoOperacoes();
    }
    if (document.getElementById('detalhesOperacaoConteudo')) {
        document.getElementById('btnVoltarDetalhesOperacao')?.addEventListener('click', voltarParaListaOperacoes);
        document.getElementById('btnAvaliacoesDetalhesOperacao')?.addEventListener('click', abrirAvaliacoesOperacaoAtual);
        renderizarPaginaDetalhesOperacao();
    }
    if (document.getElementById('avaliacoesOperacaoConteudo')) {
        renderizarPaginaAvaliacoesOperacao();
    }
    if (document.getElementById('cadastroAvaliacaoOperacaoConteudo')) {
        carregarPaginaCadastroAvaliacaoOperacao();
    }
});

function definirFundoModalInerte(inerte) {
    ['nav', '#sidebar', '#overlay', 'main'].forEach((seletor) => {
        const elemento = document.querySelector(seletor);
        if (!elemento) return;
        if (inerte) elemento.setAttribute('inert', '');
        else elemento.removeAttribute('inert');
    });
}

function manterFocoNoModal(event, modal) {
    const elementos = Array.from(modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((elemento) => elemento.offsetParent !== null);
    if (elementos.length === 0) return;

    const primeiro = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    const focoAtual = document.activeElement;
    if (!modal.contains(focoAtual)) {
        event.preventDefault();
        primeiro.focus();
        return;
    }
    if (!elementos.includes(focoAtual)) {
        event.preventDefault();
        (event.shiftKey ? ultimo : primeiro).focus();
        return;
    }
    if (event.shiftKey && focoAtual === primeiro) {
        event.preventDefault();
        ultimo.focus();
    } else if (!event.shiftKey && focoAtual === ultimo) {
        event.preventDefault();
        primeiro.focus();
    }
}

window.addEventListener('storage', (event) => {
    if ((event.key === 'cadastrosOperacoes' || event.key === 'ordensServico')
        && document.getElementById('listaOperacoes')) {
        renderizarOperacoes();
    }
    if ((event.key === 'cadastrosOperacoes' || event.key === 'ordensServico')
        && document.getElementById('detalhesOperacaoConteudo')) {
        renderizarPaginaDetalhesOperacao();
    }
    if (event.key === 'cadastrosOperacoes'
        && document.getElementById('avaliacoesOperacaoConteudo')) {
        renderizarPaginaAvaliacoesOperacao();
    }
});

function lerArrayStorage(chave) {
    try {
        const dados = JSON.parse(OrdenaStorage.getItem(chave));
        return Array.isArray(dados) ? dados : [];
    } catch (e) {
        console.error(`Falha ao ler ${chave}:`, e);
        return [];
    }
}

function lerArrayStorageParaGravacao(chave) {
    const valor = OrdenaStorage.getItem(chave);
    if (valor == null) return [];

    const dados = JSON.parse(valor);
    if (!Array.isArray(dados)) {
        throw new Error(`Os dados de ${chave} estão em um formato inválido.`);
    }
    return dados;
}

function mostrarMensagem(elemento, tipo, mensagem) {
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.className = `operacao-feedback is-visible ${tipo}`;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparMensagem(elemento) {
    if (!elemento) return;
    elemento.textContent = '';
    elemento.className = 'operacao-feedback';
    elemento.removeAttribute('role');
}

function salvarFeedbackNavegacaoOperacoes(tipo, mensagem) {
    try {
        sessionStorage.setItem(CHAVE_FEEDBACK_NAVEGACAO_OPERACOES, JSON.stringify({ tipo, mensagem }));
        return true;
    } catch (erro) {
        console.error('Erro ao preparar a confirmação da operação:', erro);
        return false;
    }
}

function restaurarFeedbackNavegacaoOperacoes() {
    let feedback = null;
    try {
        const valor = sessionStorage.getItem(CHAVE_FEEDBACK_NAVEGACAO_OPERACOES);
        sessionStorage.removeItem(CHAVE_FEEDBACK_NAVEGACAO_OPERACOES);
        if (valor) feedback = JSON.parse(valor);
    } catch (erro) {
        console.error('Erro ao recuperar a confirmação da operação:', erro);
    }

    if (!feedback || !['success', 'error'].includes(feedback.tipo) || typeof feedback.mensagem !== 'string') {
        return;
    }

    mostrarMensagem(
        document.getElementById('listaOperacaoFeedback'),
        feedback.tipo,
        feedback.mensagem
    );
}

function salvarFeedbackNavegacaoAvaliacoes(tipo, mensagem) {
    try {
        sessionStorage.setItem(CHAVE_FEEDBACK_NAVEGACAO_AVALIACOES, JSON.stringify({ tipo, mensagem }));
        return true;
    } catch (erro) {
        console.error('Erro ao preparar a confirmação da avaliação:', erro);
        return false;
    }
}

function restaurarFeedbackNavegacaoAvaliacoes() {
    let feedback = null;
    try {
        const valor = sessionStorage.getItem(CHAVE_FEEDBACK_NAVEGACAO_AVALIACOES);
        sessionStorage.removeItem(CHAVE_FEEDBACK_NAVEGACAO_AVALIACOES);
        if (valor) feedback = JSON.parse(valor);
    } catch (erro) {
        console.error('Erro ao recuperar a confirmação da avaliação:', erro);
    }

    if (!feedback || !['success', 'error'].includes(feedback.tipo) || typeof feedback.mensagem !== 'string') {
        return;
    }

    const elementoMensagem = document.getElementById('avaliacoesOperacaoFeedback');
    mostrarMensagem(elementoMensagem, feedback.tipo, feedback.mensagem);
    elementoMensagem?.focus({ preventScroll: true });
}

function carregarEdicaoOperacaoDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const indiceTexto = parametros.get('editar');
    const idOperacao = parametros.get('id');
    if (indiceTexto == null || indiceTexto === '') return;

    let indice = Number(indiceTexto);
    if (idOperacao) {
        try {
            const operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
            indice = operacoes.findIndex((operacao) => String(operacao?.id) === idOperacao);
        } catch (erro) {
            console.error('Erro ao localizar a operação para atualização:', erro);
            indice = -1;
        }
    }

    if (!Number.isInteger(indice) || indice < 0) {
        mostrarMensagem(
            document.getElementById('cadastroOperacaoFeedback'),
            'error',
            'A operação informada para atualização não é válida.'
        );
        return;
    }

    prepararPeriodoOperacao(indice);
}

function definirBotaoProcessando(botao, processando, textoProcessando, textoPadrao) {
    if (!botao) return;
    botao.disabled = processando;
    botao.setAttribute('aria-busy', String(processando));
    if (processando) {
        botao.innerHTML = `
            <span>${escapeHtml(textoProcessando)}</span>
            <span class="growing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        `;
        return;
    }
    botao.textContent = textoPadrao;
}

function aguardarAtualizacaoVisual() {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
            return;
        }
        setTimeout(resolve, 16);
    });
}

function limparValidacaoCampos(campos) {
    campos.forEach((campo) => campo?.removeAttribute('aria-invalid'));
}

function invalidarCampo(campo, elementoMensagem, mensagem) {
    mostrarMensagem(elementoMensagem, 'error', mensagem);
    if (campo) {
        campo.setAttribute('aria-invalid', 'true');
        campo.focus();
    }
}

function sincronizarPeriodoCadastro() {
    const campoInicio = document.getElementById('operacaoInicio');
    const campoFim = document.getElementById('operacaoFim');
    if (!campoInicio || !campoFim) return;

    campoInicio.removeAttribute('aria-invalid');
    campoFim.min = campoInicio.value || '';
    if (campoInicio.value && campoFim.value && campoFim.value < campoInicio.value) {
        campoFim.value = '';
    }
}

function gerarIdOperacao(operacoes) {
    let id = Date.now();
    const idsExistentes = new Set(operacoes.map((operacao) => String(operacao?.id ?? '')));
    while (idsExistentes.has(String(id))) id += 1;
    return id;
}

function criarReferenciaOperacao(operacao, originalIndex) {
    return {
        id: operacao?.id != null ? String(operacao.id) : null,
        criadoEm: typeof operacao?.criadoEm === 'string' ? operacao.criadoEm : '',
        nome: normalizarNomeOperacao(operacao?.nome),
        originalIndex
    };
}

function criarParametrosNavegacaoOperacao(operacao, originalIndex) {
    const parametros = new URLSearchParams();
    const nome = normalizarNomeOperacao(operacao?.nome);

    if (nome) parametros.set('nome', nome);
    if (operacao?.id != null) parametros.set('id', String(operacao.id));
    if (typeof operacao?.criadoEm === 'string' && operacao.criadoEm) {
        parametros.set('criadoEm', operacao.criadoEm);
    }
    if (Number.isInteger(originalIndex) && originalIndex >= 0) {
        parametros.set('indice', String(originalIndex));
    }
    parametros.set('filtro', statusFiltroAtualOperacoes);

    return parametros;
}

function criarUrlPaginaOperacao(pagina, operacao, originalIndex) {
    return `${pagina}?${criarParametrosNavegacaoOperacao(operacao, originalIndex).toString()}`;
}

function restaurarFormularioCadastro({ limparMensagemAtual = true } = {}) {
    referenciaOperacaoCadastro = null;

    const form = document.getElementById('operacaoForm');
    const campoNome = document.getElementById('operacaoNome');
    const campoFim = document.getElementById('operacaoFim');
    const botaoSalvar = document.getElementById('btnSalvarOperacao');
    const botaoCancelar = document.getElementById('btnCancelarEdicaoOperacao');

    form?.reset();
    if (campoNome) campoNome.readOnly = false;
    if (campoFim) campoFim.min = '';
    const tituloCadastro = document.getElementById('tituloCadastroOperacao');
    const descricaoCadastro = document.getElementById('descricaoCadastroOperacao');
    if (tituloCadastro) tituloCadastro.textContent = 'Cadastrar Operação Especial';
    if (descricaoCadastro) {
        descricaoCadastro.innerHTML =
            'Cadastre a operação para disponibilizá-la no campo <strong>Vincular Operação</strong> das Ordens de Serviço.';
    }
    if (botaoSalvar) botaoSalvar.textContent = 'Salvar operação';
    if (botaoCancelar) botaoCancelar.hidden = true;

    const campos = document.querySelectorAll('#operacaoForm input, #operacaoForm textarea');
    limparValidacaoCampos(Array.from(campos));
    if (limparMensagemAtual) limparMensagem(document.getElementById('cadastroOperacaoFeedback'));
}

function cancelarEdicaoOperacao() {
    if (salvamentoOperacaoEmAndamento) return;
    if (referenciaOperacaoCadastro) {
        window.location.href = 'operacoes_especiais.html';
        return;
    }
    restaurarFormularioCadastro();
    document.getElementById('operacaoNome')?.focus();
}

function abrirDetalhesOperacao(originalIndex) {
    const elementoMensagem = document.getElementById('listaOperacaoFeedback');
    limparMensagem(elementoMensagem);

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao abrir os detalhes da operação:', erro);
        mostrarMensagem(elementoMensagem, 'error', 'Não foi possível carregar a operação selecionada.');
        return;
    }

    const operacao = operacoes[originalIndex];
    const nome = normalizarNomeOperacao(operacao?.nome);
    if (!operacao || !nome) {
        mostrarMensagem(elementoMensagem, 'error', 'A operação selecionada não foi encontrada.');
        renderizarOperacoes();
        return;
    }

    window.location.href = criarUrlPaginaOperacao(
        'detalhes_operacao_especial.html',
        operacao,
        originalIndex
    );
}

function abrirAvaliacoesOperacao(originalIndex) {
    const elementoMensagem = document.getElementById('listaOperacaoFeedback');
    limparMensagem(elementoMensagem);

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao abrir as avaliações da operação:', erro);
        mostrarMensagem(elementoMensagem, 'error', 'Não foi possível carregar as avaliações da operação selecionada.');
        return;
    }

    const operacao = operacoes[originalIndex];
    if (!operacao || !normalizarNomeOperacao(operacao.nome)) {
        mostrarMensagem(elementoMensagem, 'error', 'A operação selecionada não foi encontrada.');
        renderizarOperacoes();
        return;
    }

    window.location.href = criarUrlPaginaOperacao(
        'avaliacoes_operacao_especial.html',
        operacao,
        originalIndex
    );
}

function navegarParaPaginaOperacaoAtual(pagina) {
    if (salvamentoFeedbackEmAndamento) return;

    const elementoMensagem = document.getElementById('detalhesOperacaoFeedback')
        || document.getElementById('avaliacoesOperacaoFeedback')
        || document.getElementById('cadastroAvaliacaoFeedback');

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao preparar a navegação da operação:', erro);
        mostrarMensagem(elementoMensagem, 'error', 'Não foi possível carregar a operação selecionada.');
        return;
    }

    const operacao = resolverOperacaoDetalhes(operacoes);
    const originalIndex = operacao ? operacoes.indexOf(operacao) : -1;
    if (!operacao || originalIndex === -1) {
        mostrarMensagem(elementoMensagem, 'error', 'A operação selecionada não foi encontrada.');
        return;
    }

    window.location.href = criarUrlPaginaOperacao(pagina, operacao, originalIndex);
}

function abrirAvaliacoesOperacaoAtual() {
    navegarParaPaginaOperacaoAtual('avaliacoes_operacao_especial.html');
}

function abrirCadastroAvaliacaoOperacaoAtual() {
    navegarParaPaginaOperacaoAtual('cadastro_avaliacao_operacao_especial.html');
}

function voltarParaAvaliacoesOperacaoAtual() {
    navegarParaPaginaOperacaoAtual('avaliacoes_operacao_especial.html');
}

function voltarParaDetalhesOperacaoAtual() {
    navegarParaPaginaOperacaoAtual('detalhes_operacao_especial.html');
}

function voltarParaListaOperacoes() {
    window.location.href = `operacoes_especiais.html?filtro=${encodeURIComponent(statusFiltroAtualOperacoes)}`;
}

function prepararPeriodoOperacao(originalIndex) {
    if (!document.getElementById('operacaoForm')) {
        const parametros = new URLSearchParams({ editar: String(originalIndex) });
        try {
            const operacao = lerArrayStorageParaGravacao('cadastrosOperacoes')[originalIndex];
            if (operacao?.id != null) parametros.set('id', String(operacao.id));
        } catch (erro) {
            console.error('Erro ao preparar a navegação para atualização da operação:', erro);
        }
        window.location.href = `cadastro_operacao_especial.html?${parametros.toString()}`;
        return;
    }

    const elementoMensagem = document.getElementById('listaOperacaoFeedback')
        || document.getElementById('cadastroOperacaoFeedback')
        || document.getElementById('detalhesOperacaoFeedback');
    limparMensagem(elementoMensagem);

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao preparar regularização da operação:', erro);
        mostrarMensagem(elementoMensagem, 'error', 'Não foi possível carregar a operação para atualizar as datas.');
        return;
    }

    const operacao = operacoes[originalIndex];
    if (!operacao) {
        mostrarMensagem(elementoMensagem, 'error', 'A operação selecionada não foi encontrada.');
        renderizarOperacoes();
        return;
    }
    const periodoAtual = obterPeriodoComparavel(operacao);
    if (periodoAtual?.fim) {
        mostrarMensagem(elementoMensagem, 'error', 'Esta operação já possui uma data de término válida.');
        renderizarOperacoes();
        return;
    }

    referenciaOperacaoCadastro = criarReferenciaOperacao(operacao, originalIndex);
    const campoNome = document.getElementById('operacaoNome');
    const campoDescricao = document.getElementById('operacaoDescricao');
    const campoInicio = document.getElementById('operacaoInicio');
    const campoFim = document.getElementById('operacaoFim');

    campoNome.value = referenciaOperacaoCadastro.nome;
    campoNome.readOnly = true;
    campoDescricao.value = typeof operacao.descricao === 'string' ? operacao.descricao : '';
    campoInicio.value = obterDataParaInput(operacao.inicio, operacao.criadoEm);
    campoFim.value = periodoAtual ? '' : obterDataParaInput(operacao.fim, operacao.criadoEm);
    sincronizarPeriodoCadastro();

    const tituloCadastro = document.getElementById('tituloCadastroOperacao');
    const descricaoCadastro = document.getElementById('descricaoCadastroOperacao');
    const botaoSalvar = document.getElementById('btnSalvarOperacao');
    const botaoCancelar = document.getElementById('btnCancelarEdicaoOperacao');
    if (tituloCadastro) {
        tituloCadastro.textContent = periodoAtual
            ? 'Informar término da operação'
            : 'Atualizar datas da operação';
    }
    if (descricaoCadastro) {
        descricaoCadastro.textContent =
            'Informe a data de término para encerrar a operação e liberar a avaliação pós-operação. O nome será preservado para manter os vínculos com as OS.';
    }
    if (botaoSalvar) botaoSalvar.textContent = 'Atualizar operação';
    if (botaoCancelar) botaoCancelar.hidden = false;
    limparMensagem(document.getElementById('cadastroOperacaoFeedback'));

    document.querySelector('main .card-container-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (campoInicio.value ? campoFim : campoInicio).focus();
}

async function salvarNovaOperacao(event) {
    event.preventDefault();
    if (salvamentoOperacaoEmAndamento) return;

    const modoEdicaoPeriodo = !!referenciaOperacaoCadastro;
    const textoBotaoPadrao = modoEdicaoPeriodo ? 'Atualizar operação' : 'Salvar operação';
    const campoNome = document.getElementById('operacaoNome');
    const campoDescricao = document.getElementById('operacaoDescricao');
    const campoInicio = document.getElementById('operacaoInicio');
    const campoFim = document.getElementById('operacaoFim');
    const botaoSalvar = document.getElementById('btnSalvarOperacao');
    const botaoCancelar = document.getElementById('btnCancelarEdicaoOperacao');
    const elementoMensagem = document.getElementById('cadastroOperacaoFeedback');
    const campos = [campoNome, campoDescricao, campoInicio, campoFim];

    limparMensagem(elementoMensagem);
    limparValidacaoCampos(campos);

    const nome = modoEdicaoPeriodo
        ? referenciaOperacaoCadastro.nome
        : normalizarNomeOperacao(campoNome?.value);
    const descricao = campoDescricao?.value.trim() || '';
    const inicio = campoInicio?.value || '';
    const fim = campoFim?.value || '';

    if (!nome) {
        invalidarCampo(campoNome, elementoMensagem, 'Informe o nome da operação.');
        return;
    }
    if (!inicio) {
        invalidarCampo(campoInicio, elementoMensagem, 'Informe a data de início da operação.');
        return;
    }
    if (modoEdicaoPeriodo && !fim) {
        invalidarCampo(campoFim, elementoMensagem, 'Informe a data de término da operação.');
        return;
    }

    const dataInicio = parseDataHora(inicio, false);
    const dataFim = fim ? parseDataHora(fim, false) : null;
    if (!dataInicio) {
        invalidarCampo(campoInicio, elementoMensagem, 'A data de início informada não é válida.');
        return;
    }
    if (fim && !dataFim) {
        invalidarCampo(campoFim, elementoMensagem, 'A data de término informada não é válida.');
        return;
    }
    if (dataFim && dataFim.getTime() < dataInicio.getTime()) {
        invalidarCampo(campoFim, elementoMensagem, 'A data de término não pode ser anterior à data de início.');
        return;
    }

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao preparar o cadastro da operação:', erro);
        mostrarMensagem(elementoMensagem, 'error', 'Não foi possível ler os cadastros atuais. Nenhum dado foi alterado.');
        return;
    }

    const indiceEdicao = modoEdicaoPeriodo
        ? localizarIndiceOperacao(operacoes, referenciaOperacaoCadastro)
        : -1;
    if (modoEdicaoPeriodo && indiceEdicao === -1) {
        mostrarMensagem(elementoMensagem, 'error', 'A operação que seria atualizada não foi encontrada.');
        return;
    }

    const nomeDuplicado = !modoEdicaoPeriodo && operacoes.some((operacao) =>
        normalizarNomeOperacao(operacao?.nome) === nome
    );
    if (nomeDuplicado) {
        invalidarCampo(campoNome, elementoMensagem, 'Já existe uma operação cadastrada com esse nome.');
        return;
    }

    salvamentoOperacaoEmAndamento = true;
    definirBotaoProcessando(botaoSalvar, true, 'Salvando', textoBotaoPadrao);
    if (botaoCancelar) botaoCancelar.disabled = true;
    await aguardarAtualizacaoVisual();

    let mensagemSucesso = '';
    let filtroDestino = 'Ativa';
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
        const agora = new Date().toISOString();

        if (modoEdicaoPeriodo) {
            const indiceAtual = localizarIndiceOperacao(operacoes, referenciaOperacaoCadastro);
            if (indiceAtual === -1) {
                throw new Error('A operação não foi encontrada para atualização.');
            }

            operacoes[indiceAtual] = {
                ...operacoes[indiceAtual],
                descricao,
                inicio,
                fim,
                atualizadoEm: agora
            };
            filtroDestino = obterStatusOperacao(operacoes[indiceAtual]);
            mensagemSucesso = `Datas da operação “${nome}” atualizadas com sucesso.`;
        } else {
            const duplicadoAposEspera = operacoes.some((operacao) =>
                normalizarNomeOperacao(operacao?.nome) === nome
            );
            if (duplicadoAposEspera) {
                invalidarCampo(campoNome, elementoMensagem, 'Já existe uma operação cadastrada com esse nome.');
                return;
            }

            const novaOperacao = {
                id: gerarIdOperacao(operacoes),
                nome,
                descricao,
                inicio,
                fim,
                status: 'Ativa',
                criadoEm: agora,
                atualizadoEm: agora
            };
            operacoes.push(novaOperacao);
            filtroDestino = obterStatusOperacao(novaOperacao);
            mensagemSucesso = `Operação “${nome}” cadastrada com sucesso.`;
        }

        await OrdenaStorage.setItem('cadastrosOperacoes', JSON.stringify(operacoes));
    } catch (erro) {
        console.error('Erro ao salvar operação:', erro);
        mensagemSucesso = '';
        const mensagem = erro.message === 'A operação não foi encontrada para atualização.'
            ? erro.message
            : 'Não foi possível salvar a operação. Tente novamente.';
        mostrarMensagem(elementoMensagem, 'error', mensagem);
    } finally {
        salvamentoOperacaoEmAndamento = false;
        definirBotaoProcessando(botaoSalvar, false, 'Salvando', textoBotaoPadrao);
        if (botaoCancelar) botaoCancelar.disabled = false;
    }

    if (mensagemSucesso) {
        const feedbackPreparado = salvarFeedbackNavegacaoOperacoes('success', mensagemSucesso);
        if (!feedbackPreparado) window.alert(mensagemSucesso);
        window.location.href = `operacoes_especiais.html?filtro=${encodeURIComponent(filtroDestino)}`;
    }
}

function normalizarNomeOperacao(nome) {
    if (typeof nome !== 'string') return '';
    return nome.trim().toUpperCase();
}

function parseDataCivilLocal(valor) {
    if (typeof valor !== 'string') return null;
    const correspondencia = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!correspondencia) return null;

    const ano = Number(correspondencia[1]);
    const mes = Number(correspondencia[2]);
    const dia = Number(correspondencia[3]);
    const data = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
        return null;
    }
    return data;
}

function parseDataHora(valor, aceitarApenasHora) {
    if (typeof valor !== 'string') return null;
    const texto = valor.trim();
    if (!texto) return null;

    if (aceitarApenasHora && /^\d{2}:\d{2}$/.test(texto)) {
        const [h, m] = texto.split(':').map(Number);
        if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
            return null;
        }
        const agora = new Date();
        return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m, 0, 0);
    }

    const dataCivil = parseDataCivilLocal(texto);
    if (dataCivil) return dataCivil;

    if (!texto.includes('-')) return null;
    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) return null;
    return data;
}

function formatarDataParaInput(data) {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function obterDataParaInput(valor, dataFallback) {
    const texto = typeof valor === 'string' ? valor.trim() : '';
    if (!texto) return '';

    const dataDireta = parseDataHora(texto, false);
    if (dataDireta) return formatarDataParaInput(dataDireta);

    if (/^\d{2}:\d{2}$/.test(texto)) {
        const base = parseDataHora(dataFallback, false);
        return formatarDataParaInput(base);
    }
    return '';
}

function formatarDataHora(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return 'Não informado';

    if (/^\d{2}:\d{2}$/.test(valor.trim())) {
        return valor.trim();
    }

    const data = parseDataHora(valor, false);
    if (!data) return valor;
    return data.toLocaleString('pt-BR');
}

function formatarDataOperacao(valor, dataFallback, textoAusente = 'Não informada') {
    const texto = typeof valor === 'string' ? valor.trim() : '';
    if (!texto) return textoAusente;

    if (/^\d{2}:\d{2}$/.test(texto)) {
        const fallback = parseDataHora(dataFallback, false);
        return fallback ? fallback.toLocaleDateString('pt-BR') : textoAusente;
    }

    const data = parseDataHora(texto, false);
    return data ? data.toLocaleDateString('pt-BR') : textoAusente;
}

function obterStatusOperacao(operacao) {
    if (operacao?.status === 'Inativa') return 'Inativa';

    const fim = obterDataFimComparavel(operacao);
    if (!fim) return 'Ativa';
    return fim.getTime() <= Date.now() ? 'Inativa' : 'Ativa';
}

function operacaoFoiInativadaManualmente(operacao) {
    return operacao?.status === 'Inativa';
}

function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obterNumeroOSNormalizado(os) {
    const numeroOs = Number(os && os.numero);
    if (Number.isFinite(numeroOs)) return String(numeroOs);
    if (os && os.numero != null && String(os.numero).trim()) {
        return String(os.numero).trim();
    }
    return '';
}

function mapearVinculosEmOS(apenasAtivas, ordensFornecidas) {
    const mapa = {};
    const bancoOS = Array.isArray(ordensFornecidas)
        ? ordensFornecidas
        : lerArrayStorage('ordensServico');

    bancoOS.forEach((os) => {
        if (apenasAtivas && os && (os.status || 'Ativa') !== 'Ativa') return;
        if (!os || !Array.isArray(os.atividades)) return;

        os.atividades.forEach((atividade) => {
            const nomeDireto = normalizarNomeOperacao(atividade && atividade.operacao);
            const detalhesLegados = typeof atividade?.detalhes === 'string' && atividade.detalhes.trim()
                ? atividade.detalhes
                : typeof atividade?.detalhe === 'string'
                    ? atividade.detalhe
                    : '';
            const correspondenciaLegada = detalhesLegados.match(/\[OP:\s*([^\]]+)\]/i);
            const nomeOp = nomeDireto || normalizarNomeOperacao(correspondenciaLegada?.[1]);
            if (!nomeOp) return;

            if (!mapa[nomeOp]) {
                mapa[nomeOp] = {
                    ordens: new Set()
                };
            }

            const numeroNormalizado = obterNumeroOSNormalizado(os);
            if (numeroNormalizado) mapa[nomeOp].ordens.add(numeroNormalizado);
        });
    });

    return mapa;
}

function ordenarNumerosOS(conjunto) {
    return Array.from(conjunto || []).sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        const aEhNumero = Number.isFinite(numA);
        const bEhNumero = Number.isFinite(numB);
        if (aEhNumero && bEhNumero) return numA - numB;
        if (aEhNumero) return -1;
        if (bEhNumero) return 1;
        return String(a).localeCompare(String(b), 'pt-BR');
    });
}

function criarHorarioNaData(valor, dataBase) {
    if (typeof valor !== 'string' || !/^\d{2}:\d{2}$/.test(valor.trim())) return null;
    if (!(dataBase instanceof Date) || Number.isNaN(dataBase.getTime())) return null;

    const [hora, minuto] = valor.trim().split(':').map(Number);
    if (!Number.isInteger(hora) || !Number.isInteger(minuto)
        || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
        return null;
    }

    return new Date(
        dataBase.getFullYear(),
        dataBase.getMonth(),
        dataBase.getDate(),
        hora,
        minuto,
        0,
        0
    );
}

function obterPeriodoComparavel(operacao) {
    const inicioTexto = typeof (operacao && operacao.inicio) === 'string' ? operacao.inicio.trim() : '';
    const fimTexto = typeof (operacao && operacao.fim) === 'string' ? operacao.fim.trim() : '';
    if (!inicioTexto) return null;

    const inicioCompleto = parseDataHora(inicioTexto, false);
    const baseLegada = parseDataHora(operacao && operacao.criadoEm, false);
    const inicioLegado = inicioCompleto || criarHorarioNaData(inicioTexto, baseLegada);
    if (!inicioLegado) return null;

    if (!fimTexto) {
        return { inicio: inicioLegado, fim: null };
    }

    const fimCompletoOriginal = parseDataHora(fimTexto, false);
    const fimCompleto = fimCompletoOriginal ? new Date(fimCompletoOriginal.getTime()) : null;
    if (fimCompleto && parseDataCivilLocal(fimTexto)) {
        fimCompleto.setDate(fimCompleto.getDate() + 1);
    }

    if (inicioCompleto && fimCompleto) {
        return fimCompleto.getTime() > inicioCompleto.getTime()
            ? { inicio: inicioCompleto, fim: fimCompleto }
            : null;
    }

    if (inicioCompleto) {
        const fim = criarHorarioNaData(fimTexto, inicioCompleto);
        if (!fim) return null;
        if (fim.getTime() <= inicioCompleto.getTime()) {
            fim.setDate(fim.getDate() + 1);
        }
        return { inicio: inicioCompleto, fim };
    }

    if (fimCompleto) {
        const inicio = criarHorarioNaData(inicioTexto, fimCompleto);
        if (!inicio) return null;
        if (inicio.getTime() >= fimCompleto.getTime()) {
            inicio.setDate(inicio.getDate() - 1);
        }
        return { inicio, fim: fimCompleto };
    }

    const inicio = criarHorarioNaData(inicioTexto, baseLegada);
    const fim = criarHorarioNaData(fimTexto, baseLegada);
    if (!inicio || !fim) return null;
    if (fim.getTime() <= inicio.getTime()) fim.setDate(fim.getDate() + 1);
    return { inicio, fim };
}

function obterDataFimComparavel(operacao) {
    return obterPeriodoComparavel(operacao)?.fim || null;
}

function ehObjetoSimples(valor) {
    return !!valor && typeof valor === 'object' && !Array.isArray(valor);
}

function normalizarQuantidadeEfetivo(valor) {
    if (valor == null || valor === '') return null;
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 0 || numero > 9999) return null;
    return numero;
}

function obterFeedbackOperacao(operacao) {
    const feedback = operacao?.feedback;
    if (!ehObjetoSimples(feedback)) return null;

    const avaliacaoGeral = typeof feedback.avaliacaoGeral === 'string'
        ? feedback.avaliacaoGeral.trim()
        : '';
    const efetivoSuficiente = typeof feedback.efetivoSuficiente === 'string'
        ? feedback.efetivoSuficiente.trim()
        : '';
    const pontosPositivos = typeof feedback.pontosPositivos === 'string'
        ? feedback.pontosPositivos.trim()
        : '';
    const melhorias = typeof feedback.melhorias === 'string'
        ? feedback.melhorias.trim()
        : typeof feedback.melhoriasProximaOperacao === 'string'
            ? feedback.melhoriasProximaOperacao.trim()
            : '';

    if (!AVALIACOES_GERAIS_VALIDAS.includes(avaliacaoGeral)
        || !RESPOSTAS_EFETIVO_VALIDAS.includes(efetivoSuficiente)
        || !melhorias) {
        return null;
    }

    return {
        avaliacaoGeral,
        efetivoSuficiente,
        efetivoPrevisto: normalizarQuantidadeEfetivo(feedback.efetivoPrevisto),
        efetivoEmpregado: normalizarQuantidadeEfetivo(feedback.efetivoEmpregado),
        pontosPositivos,
        melhorias,
        observacoes: typeof feedback.observacoes === 'string' ? feedback.observacoes.trim() : '',
        registradoEm: typeof feedback.registradoEm === 'string' ? feedback.registradoEm : '',
        atualizadoEm: typeof feedback.atualizadoEm === 'string' ? feedback.atualizadoEm : ''
    };
}

function criarTextoFeedbackLegado(feedback) {
    if (!feedback) return '';

    const linhas = [
        `Avaliação geral: ${feedback.avaliacaoGeral}`,
        `Efetivo suficiente: ${feedback.efetivoSuficiente}`
    ];

    if (Number.isInteger(feedback.efetivoPrevisto)) {
        linhas.push(`Efetivo previsto: ${feedback.efetivoPrevisto}`);
    }
    if (Number.isInteger(feedback.efetivoEmpregado)) {
        linhas.push(`Efetivo empregado: ${feedback.efetivoEmpregado}`);
    }
    if (feedback.pontosPositivos) linhas.push(`O que funcionou bem: ${feedback.pontosPositivos}`);
    if (feedback.melhorias) linhas.push(`Melhorias: ${feedback.melhorias}`);
    if (feedback.observacoes) linhas.push(`Observações: ${feedback.observacoes}`);

    return linhas.join('\n');
}

function obterNomeUsuarioAvaliacao() {
    // Usa o perfil local; o nome padrão corresponde ao perfil de demonstração existente.
    const perfil = JSON.parse(OrdenaStorage.getItem('ordenaPerfilMock') || '{}');
    return typeof perfil?.nomeCompleto === 'string' && perfil.nomeCompleto.trim()
        ? perfil.nomeCompleto.trim()
        : 'Usuário de Demonstração';
}

function obterAvaliacoesOperacao(operacao) {
    const avaliacoes = (Array.isArray(operacao?.avaliacoes) ? operacao.avaliacoes : [])
        .map((registro, indice) => {
            if (!ehObjetoSimples(registro)) return null;

            const texto = typeof registro.texto === 'string' ? registro.texto.trim() : '';
            if (!texto) return null;

            return {
                id: registro.id != null ? String(registro.id) : `avaliacao-${indice}`,
                data: typeof registro.data === 'string' ? registro.data.trim() : '',
                texto,
                criadoEm: typeof registro.criadoEm === 'string' ? registro.criadoEm : '',
                registradoPor: typeof registro.registradoPor === 'string' ? registro.registradoPor.trim() : '',
                legado: false
            };
        })
        .filter(Boolean);

    const feedbackLegado = obterFeedbackOperacao(operacao);
    if (feedbackLegado) {
        const dataRegistro = feedbackLegado.atualizadoEm || feedbackLegado.registradoEm;
        const dataRegistroParseada = parseDataHora(dataRegistro, false);
        avaliacoes.push({
            id: 'feedback-legado',
            data: formatarDataParaInput(dataRegistroParseada),
            texto: criarTextoFeedbackLegado(feedbackLegado),
            criadoEm: dataRegistro,
            registradoPor: typeof operacao.feedback?.registradoPor === 'string' ? operacao.feedback.registradoPor.trim() : '',
            legado: true
        });
    }

    return avaliacoes;
}

function ordenarAvaliacoesMaisRecentes(avaliacoes) {
    return [...avaliacoes].sort((a, b) => {
        const comparacaoData = String(b.data || '').localeCompare(String(a.data || ''));
        if (comparacaoData !== 0) return comparacaoData;

        const instanteA = parseDataHora(a.criadoEm, false)?.getTime() || 0;
        const instanteB = parseDataHora(b.criadoEm, false)?.getTime() || 0;
        return instanteB - instanteA;
    });
}

function formatarDataAvaliacao(valor) {
    const data = parseDataCivilLocal(valor);
    return data ? data.toLocaleDateString('pt-BR') : 'Data não informada';
}

function renderizarHistoricoAvaliacoes(operacao) {
    const container = document.getElementById('listaAvaliacoesOperacao');
    if (!container) return;

    const avaliacoes = ordenarAvaliacoesMaisRecentes(obterAvaliacoesOperacao(operacao));
    if (avaliacoes.length === 0) {
        container.innerHTML = '<p class="avaliacoes-vazio">Nenhuma avaliação registrada até o momento.</p>';
        return;
    }

    container.innerHTML = avaliacoes.map((avaliacao) => `
        <article class="avaliacao-card" role="listitem">
            <div class="avaliacao-card-data">
                <time${avaliacao.data ? ` datetime="${escapeHtml(avaliacao.data)}"` : ''}>${escapeHtml(formatarDataAvaliacao(avaliacao.data))}</time>
                ${avaliacao.legado ? '<span class="status-pill status-feedback-concluido">Registro anterior</span>' : ''}
            </div>
            <p class="avaliacao-card-texto">${escapeHtml(avaliacao.texto)}</p>
        </article>
    `).join('');
}

function gerarIdAvaliacao(avaliacoes) {
    let id = Date.now();
    const idsExistentes = new Set(
        (Array.isArray(avaliacoes) ? avaliacoes : [])
            .map((avaliacao) => String(avaliacao?.id ?? ''))
    );
    while (idsExistentes.has(String(id))) id += 1;
    return id;
}

function agendarAtualizacaoPorTermino(operacoes) {
    if (temporizadorAtualizacaoOperacoes) {
        clearTimeout(temporizadorAtualizacaoOperacoes);
        temporizadorAtualizacaoOperacoes = null;
    }

    const agora = Date.now();
    const proximosTerminos = operacoes
        .map((operacao) => obterDataFimComparavel(operacao))
        .filter((data) => data && data.getTime() > agora)
        .map((data) => data.getTime());
    if (proximosTerminos.length === 0) return;

    const proximoTermino = Math.min(...proximosTerminos);
    const atrasoMaximo = 2147483000;
    const atraso = Math.min(Math.max((proximoTermino - agora) + 250, 250), atrasoMaximo);
    temporizadorAtualizacaoOperacoes = setTimeout(() => {
        temporizadorAtualizacaoOperacoes = null;
        renderizarOperacoes();
        renderizarPaginaDetalhesOperacao();
    }, atraso);
}

function localizarIndiceOperacao(operacoes, referencia) {
    if (!referencia || !Array.isArray(operacoes)) return -1;

    if (referencia.id != null) {
        const indicePorId = operacoes.findIndex((operacao) => String(operacao?.id) === referencia.id);
        if (indicePorId !== -1) return indicePorId;
    }

    if (referencia.criadoEm) {
        const indicePorCriacao = operacoes.findIndex((operacao) =>
            operacao?.criadoEm === referencia.criadoEm
            && normalizarNomeOperacao(operacao?.nome) === referencia.nome
        );
        if (indicePorCriacao !== -1) return indicePorCriacao;
    }

    const itemNoIndice = operacoes[referencia.originalIndex];
    if (itemNoIndice && normalizarNomeOperacao(itemNoIndice.nome) === referencia.nome) {
        return referencia.originalIndex;
    }

    return -1;
}

function abrirModalInativacao(originalIndex) {
    const elementoMensagemLista = document.getElementById('listaOperacaoFeedback');
    limparMensagem(elementoMensagemLista);

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao abrir a confirmação de inativação:', erro);
        mostrarMensagem(elementoMensagemLista, 'error', 'Não foi possível carregar a operação para inativação.');
        return;
    }

    const operacao = operacoes[originalIndex];
    if (!operacao) {
        mostrarMensagem(elementoMensagemLista, 'error', 'A operação selecionada não foi encontrada. Atualize a página e tente novamente.');
        renderizarOperacoes();
        return;
    }
    if (obterStatusOperacao(operacao) !== 'Ativa') {
        mostrarMensagem(elementoMensagemLista, 'error', 'A operação selecionada já está inativa.');
        renderizarOperacoes();
        return;
    }

    const nome = normalizarNomeOperacao(operacao.nome) || 'Operação sem nome';
    referenciaOperacaoInativacao = criarReferenciaOperacao(operacao, originalIndex);
    const resumoAtivo = mapearVinculosEmOS(true)[nome];
    const totalOsAtivas = resumoAtivo?.ordens.size || 0;
    const textoVinculos = totalOsAtivas > 0
        ? ` Os vínculos existentes com ${totalOsAtivas} OS ativa(s) serão preservados.`
        : '';

    const nomeModal = document.getElementById('nomeOperacaoInativacao');
    const descricaoModal = document.getElementById('descricaoInativacaoOperacao');
    if (nomeModal) nomeModal.textContent = nome;
    if (descricaoModal) {
        descricaoModal.textContent = `A operação deixará de estar disponível para novos vínculos em Ordens de Serviço.${textoVinculos}`;
    }
    limparMensagem(document.getElementById('modalInativacaoMensagem'));

    const modal = document.getElementById('modalInativarOperacao');
    if (!modal) {
        mostrarMensagem(elementoMensagemLista, 'error', 'Não foi possível abrir a confirmação de inativação.');
        referenciaOperacaoInativacao = null;
        return;
    }

    elementoRetornoModalInativacao = document.activeElement;
    definirFundoModalInerte(true);
    modal.hidden = false;
    document.body.classList.add('modal-aberto');
    requestAnimationFrame(() => document.getElementById('btnCancelarInativacao')?.focus());
}

function fecharModalInativacao(opcoes = {}) {
    if (inativacaoOperacaoEmAndamento) return;

    const restaurarFoco = opcoes?.restaurarFoco !== false;

    const modal = document.getElementById('modalInativarOperacao');
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    document.body.classList.remove('modal-aberto');
    definirFundoModalInerte(false);
    limparMensagem(document.getElementById('modalInativacaoMensagem'));
    referenciaOperacaoInativacao = null;

    if (restaurarFoco && elementoRetornoModalInativacao?.isConnected) {
        elementoRetornoModalInativacao.focus();
    }
    elementoRetornoModalInativacao = null;
}

async function confirmarInativacaoOperacao(event) {
    event.preventDefault();
    if (inativacaoOperacaoEmAndamento || !referenciaOperacaoInativacao) return;

    const elementoMensagem = document.getElementById('modalInativacaoMensagem');
    const botaoConfirmar = document.getElementById('btnConfirmarInativacao');
    const botaoCancelar = document.getElementById('btnCancelarInativacao');
    limparMensagem(elementoMensagem);

    inativacaoOperacaoEmAndamento = true;
    definirBotaoProcessando(botaoConfirmar, true, 'Inativando', 'Inativar operação');
    if (botaoCancelar) botaoCancelar.disabled = true;
    await aguardarAtualizacaoVisual();

    let nomeOperacaoInativada = '';
    try {
        const operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
        const indiceOperacao = localizarIndiceOperacao(operacoes, referenciaOperacaoInativacao);
        if (indiceOperacao === -1) {
            throw new Error('A operação não foi encontrada para inativação.');
        }

        const operacao = operacoes[indiceOperacao];
        if (obterStatusOperacao(operacao) !== 'Ativa') {
            throw new Error('A operação selecionada já está inativa.');
        }

        const agora = new Date().toISOString();
        operacao.status = 'Inativa';
        operacao.dataEncerramento = agora;
        operacao.atualizadoEm = agora;
        await OrdenaStorage.setItem('cadastrosOperacoes', JSON.stringify(operacoes));
        nomeOperacaoInativada = normalizarNomeOperacao(operacao.nome) || 'Operação';
    } catch (erro) {
        console.error('Erro ao inativar a operação:', erro);
        mostrarMensagem(
            elementoMensagem,
            'error',
            erro.message || 'Não foi possível inativar a operação. Tente novamente.'
        );
    } finally {
        inativacaoOperacaoEmAndamento = false;
        definirBotaoProcessando(botaoConfirmar, false, 'Inativando', 'Inativar operação');
        if (botaoCancelar) botaoCancelar.disabled = false;
    }

    if (nomeOperacaoInativada) {
        fecharModalInativacao({ restaurarFoco: false });
        renderizarOperacoes();
        const feedbackLista = document.getElementById('listaOperacaoFeedback');
        mostrarMensagem(
            feedbackLista,
            'success',
            `Operação “${nomeOperacaoInativada}” inativada com sucesso. Os vínculos existentes foram preservados.`
        );
        feedbackLista?.focus();
    }
}

function abrirModalFeedback(originalIndex) {
    const elementoMensagemLista = document.getElementById('listaOperacaoFeedback')
        || document.getElementById('detalhesOperacaoFeedback');
    limparMensagem(elementoMensagemLista);

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao abrir avaliação da operação:', erro);
        mostrarMensagem(elementoMensagemLista, 'error', 'Não foi possível carregar a operação para avaliação.');
        return;
    }

    const operacao = operacoes[originalIndex];
    if (!operacao) {
        mostrarMensagem(elementoMensagemLista, 'error', 'A operação selecionada não foi encontrada. Atualize a página e tente novamente.');
        renderizarOperacoes();
        return;
    }

    referenciaOperacaoFeedback = criarReferenciaOperacao(operacao, originalIndex);

    document.getElementById('nomeOperacaoFeedback').textContent = referenciaOperacaoFeedback.nome || 'Operação sem nome';
    document.getElementById('feedbackOperacaoForm')?.reset();

    const hoje = formatarDataParaInput(new Date());
    const campoData = document.getElementById('feedbackData');
    if (campoData) {
        campoData.value = hoje;
        campoData.max = hoje;
    }
    renderizarHistoricoAvaliacoes(operacao);

    const camposFeedback = document.querySelectorAll('#feedbackOperacaoForm input, #feedbackOperacaoForm textarea');
    limparValidacaoCampos(Array.from(camposFeedback));
    limparMensagem(document.getElementById('modalFeedbackMensagem'));

    const modal = document.getElementById('modalFeedbackOperacao');
    if (!modal) {
        mostrarMensagem(elementoMensagemLista, 'error', 'Não foi possível abrir o formulário de avaliação.');
        return;
    }
    elementoRetornoModalFeedback = document.activeElement;
    definirFundoModalInerte(true);
    modal.hidden = false;
    document.body.classList.add('modal-aberto');

    requestAnimationFrame(() => {
        const cartaoModal = modal.querySelector('.modal-card');
        if (cartaoModal) cartaoModal.scrollTop = 0;
        document.getElementById('tituloModalFeedback')?.focus({ preventScroll: true });
    });
}

function fecharModalFeedback() {
    if (salvamentoFeedbackEmAndamento) return;

    const modal = document.getElementById('modalFeedbackOperacao');
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    document.body.classList.remove('modal-aberto');
    definirFundoModalInerte(false);
    document.getElementById('feedbackOperacaoForm')?.reset();
    limparMensagem(document.getElementById('modalFeedbackMensagem'));
    referenciaOperacaoFeedback = null;

    if (elementoRetornoModalFeedback?.isConnected) {
        elementoRetornoModalFeedback.focus();
    } else {
        document.getElementById('listaOperacaoFeedback')?.focus();
    }
    elementoRetornoModalFeedback = null;
}

async function salvarFeedbackOperacao(event) {
    event.preventDefault();
    if (salvamentoFeedbackEmAndamento || !referenciaOperacaoFeedback) return;

    const campoData = document.getElementById('feedbackData');
    const campoTexto = document.getElementById('feedbackTexto');
    const elementoMensagem = document.getElementById('modalFeedbackMensagem');
    const botaoSalvar = document.getElementById('btnSalvarFeedback');
    const botaoCancelar = document.getElementById('btnCancelarFeedback');
    const campos = [campoData, campoTexto];

    limparMensagem(elementoMensagem);
    limparValidacaoCampos(campos);

    const data = campoData?.value.trim() || '';
    const texto = campoTexto?.value.trim() || '';
    const hoje = formatarDataParaInput(new Date());

    if (!parseDataCivilLocal(data)) {
        invalidarCampo(campoData, elementoMensagem, 'Informe uma data válida para a avaliação.');
        return;
    }
    if (data > hoje) {
        invalidarCampo(campoData, elementoMensagem, 'A data da avaliação não pode ser futura.');
        return;
    }
    if (!texto) {
        invalidarCampo(campoTexto, elementoMensagem, 'Escreva a avaliação da operação.');
        return;
    }
    if (texto.length > LIMITE_TEXTO_AVALIACAO) {
        invalidarCampo(campoTexto, elementoMensagem, `A avaliação deve ter no máximo ${LIMITE_TEXTO_AVALIACAO} caracteres.`);
        return;
    }

    salvamentoFeedbackEmAndamento = true;
    definirBotaoProcessando(botaoSalvar, true, 'Salvando', 'Salvar avaliação');
    if (botaoCancelar) botaoCancelar.disabled = true;
    await aguardarAtualizacaoVisual();

    let nomeOperacaoSalva = '';
    let operacaoAtualizada = null;
    try {
        const operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
        const indiceOperacao = localizarIndiceOperacao(operacoes, referenciaOperacaoFeedback);
        if (indiceOperacao === -1) {
            throw new Error('A operação não foi encontrada para atualização.');
        }

        const operacao = operacoes[indiceOperacao];
        const agora = new Date().toISOString();
        const avaliacoes = Array.isArray(operacao.avaliacoes) ? [...operacao.avaliacoes] : [];
        avaliacoes.push({
            id: gerarIdAvaliacao(avaliacoes),
            data,
            texto,
            registradoPor: obterNomeUsuarioAvaliacao(),
            criadoEm: agora
        });
        operacao.avaliacoes = avaliacoes;
        operacao.atualizadoEm = agora;

        await OrdenaStorage.setItem('cadastrosOperacoes', JSON.stringify(operacoes));
        nomeOperacaoSalva = normalizarNomeOperacao(operacao.nome) || 'Operação';
        operacaoAtualizada = operacao;
    } catch (erro) {
        console.error('Erro ao salvar avaliação da operação:', erro);
        mostrarMensagem(
            elementoMensagem,
            'error',
            erro.message || 'Não foi possível salvar a avaliação. Tente novamente.'
        );
    } finally {
        salvamentoFeedbackEmAndamento = false;
        definirBotaoProcessando(botaoSalvar, false, 'Salvando', 'Salvar avaliação');
        if (botaoCancelar) botaoCancelar.disabled = false;
    }

    if (nomeOperacaoSalva && operacaoAtualizada) {
        renderizarOperacoes();
        const novoBotaoRetorno = document.querySelector(
            `.btn-avaliacoes-operacao[data-operacao-index="${referenciaOperacaoFeedback.originalIndex}"]`
        );
        if (novoBotaoRetorno) elementoRetornoModalFeedback = novoBotaoRetorno;
        renderizarHistoricoAvaliacoes(operacaoAtualizada);
        if (campoData) {
            campoData.value = hoje;
            campoData.max = hoje;
        }
        if (campoTexto) campoTexto.value = '';
        mostrarMensagem(
            elementoMensagem,
            'success',
            `Avaliação da operação “${nomeOperacaoSalva}” registrada com sucesso.`
        );
        const cartaoModal = document.querySelector('#modalFeedbackOperacao .modal-card');
        if (cartaoModal) cartaoModal.scrollTop = 0;
        elementoMensagem?.focus({ preventScroll: true });
    }
}

function definirNavegacaoAvaliacaoDesabilitada(desabilitada) {
    [
        'btnCadastrarAvaliacao',
        'btnVoltarDetalhesAvaliacoes',
        'btnVerAvaliacoesCadastro',
        'btnVoltarDetalhesCadastroAvaliacao',
        'btnCancelarAvaliacao'
    ].forEach((id) => {
        const botao = document.getElementById(id);
        if (botao) botao.disabled = desabilitada;
    });
}

function configurarBotaoRetornoPaginaAvaliacao(idBotao, voltarParaLista) {
    const botao = document.getElementById(idBotao);
    if (!botao) return;

    botao.removeEventListener('click', voltarParaDetalhesOperacaoAtual);
    botao.removeEventListener('click', voltarParaListaOperacoes);
    botao.addEventListener(
        'click',
        voltarParaLista ? voltarParaListaOperacoes : voltarParaDetalhesOperacaoAtual
    );
    botao.textContent = voltarParaLista ? 'Voltar para operações' : 'Voltar para operação';
    if (voltarParaLista) botao.disabled = false;
}

function renderizarTabelaAvaliacoesOperacao(operacao) {
    const container = document.getElementById('listaAvaliacoesOperacaoTabela');
    if (!container) return;

    const avaliacoes = ordenarAvaliacoesMaisRecentes(obterAvaliacoesOperacao(operacao));
    if (avaliacoes.length === 0) {
        container.innerHTML = `
            <tr class="avaliacoes-mensagem-row">
                <td colspan="3">Nenhuma avaliação registrada até o momento.</td>
            </tr>
        `;
        return;
    }

    container.innerHTML = avaliacoes.map((avaliacao) => {
        const dataExibicao = formatarDataAvaliacao(avaliacao.data);
        // Data e hora do registro preservadas nos dados; a coluna exibe o autor.
        const registroExibicao = avaliacao.registradoPor || 'Não informado';

        return `
            <tr>
                <td data-label="Data">
                    <time${avaliacao.data ? ` datetime="${escapeHtml(avaliacao.data)}"` : ''}>${escapeHtml(dataExibicao)}</time>
                </td>
                <td data-label="Avaliação" class="avaliacao-texto-cell">${escapeHtml(avaliacao.texto)}</td>
                <td data-label="Registrada por" class="avaliacao-registro-cell">
                    <span>${escapeHtml(registroExibicao)}</span>
                    ${avaliacao.legado ? '<span class="status-pill status-feedback-concluido">Registro anterior</span>' : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function renderizarPaginaAvaliacoesOperacao() {
    const conteudo = document.getElementById('avaliacoesOperacaoConteudo');
    if (!conteudo) return;

    const carregamento = document.getElementById('avaliacoesOperacaoLoading');
    const elementoMensagem = document.getElementById('avaliacoesOperacaoFeedback');
    const nomeElemento = document.getElementById('nomeOperacaoAvaliacoes');
    const tituloPagina = document.getElementById('tituloAvaliacoesOperacao');
    const sequenciaAtual = ++sequenciaCarregamentoAvaliacoesOperacao;

    referenciaOperacaoFeedback = null;
    limparMensagem(elementoMensagem);
    definirNavegacaoAvaliacaoDesabilitada(true);
    conteudo.hidden = true;
    if (carregamento) carregamento.hidden = false;
    await aguardarAtualizacaoVisual();
    if (sequenciaAtual !== sequenciaCarregamentoAvaliacoesOperacao) return;

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao carregar as avaliações da operação:', erro);
        if (tituloPagina) tituloPagina.textContent = 'Avaliações da Operação';
        mostrarMensagem(
            elementoMensagem,
            'error',
            'Não foi possível carregar as avaliações. Volte à listagem de operações e tente novamente.'
        );
        configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesAvaliacoes', true);
        if (carregamento) carregamento.hidden = true;
        return;
    }

    const operacao = resolverOperacaoDetalhes(operacoes);
    const originalIndex = operacao ? operacoes.indexOf(operacao) : -1;
    if (!operacao || originalIndex === -1) {
        if (tituloPagina) tituloPagina.textContent = 'Operação especial não encontrada';
        document.title = 'ORDENA - Operação não encontrada';
        mostrarMensagem(
            elementoMensagem,
            'error',
            'Não foi possível localizar a operação informada. Volte à listagem e selecione um cadastro válido.'
        );
        configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesAvaliacoes', true);
        if (carregamento) carregamento.hidden = true;
        return;
    }

    const nome = normalizarNomeOperacao(operacao.nome) || 'OPERAÇÃO SEM NOME';
    referenciaOperacaoFeedback = criarReferenciaOperacao(operacao, originalIndex);
    if (tituloPagina) tituloPagina.textContent = 'Avaliações da Operação';
    if (nomeElemento) nomeElemento.textContent = nome;
    document.title = `ORDENA - Avaliações - ${nome}`;

    renderizarTabelaAvaliacoesOperacao(operacao);
    configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesAvaliacoes', false);
    definirNavegacaoAvaliacaoDesabilitada(false);
    conteudo.hidden = false;
    if (carregamento) carregamento.hidden = true;
    restaurarFeedbackNavegacaoAvaliacoes();
}

async function carregarPaginaCadastroAvaliacaoOperacao() {
    const conteudo = document.getElementById('cadastroAvaliacaoOperacaoConteudo');
    if (!conteudo) return;

    const carregamento = document.getElementById('cadastroAvaliacaoLoading');
    const elementoMensagem = document.getElementById('cadastroAvaliacaoFeedback');
    const nomeElemento = document.getElementById('nomeOperacaoCadastroAvaliacao');
    const tituloPagina = document.getElementById('tituloCadastroAvaliacao');
    const form = document.getElementById('avaliacaoOperacaoForm');
    const sequenciaAtual = ++sequenciaCarregamentoCadastroAvaliacao;

    referenciaOperacaoFeedback = null;
    limparMensagem(elementoMensagem);
    definirNavegacaoAvaliacaoDesabilitada(true);
    form?.querySelectorAll('input, textarea, button').forEach((controle) => {
        controle.disabled = true;
    });
    conteudo.hidden = true;
    if (carregamento) carregamento.hidden = false;
    await aguardarAtualizacaoVisual();
    if (sequenciaAtual !== sequenciaCarregamentoCadastroAvaliacao) return;

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao carregar o cadastro da avaliação:', erro);
        mostrarMensagem(
            elementoMensagem,
            'error',
            'Não foi possível carregar a operação para cadastrar a avaliação.'
        );
        configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesCadastroAvaliacao', true);
        if (carregamento) carregamento.hidden = true;
        return;
    }

    const operacao = resolverOperacaoDetalhes(operacoes);
    const originalIndex = operacao ? operacoes.indexOf(operacao) : -1;
    if (!operacao || originalIndex === -1) {
        if (tituloPagina) tituloPagina.textContent = 'Operação especial não encontrada';
        document.title = 'ORDENA - Operação não encontrada';
        mostrarMensagem(
            elementoMensagem,
            'error',
            'Não foi possível localizar a operação informada. Volte à listagem e selecione um cadastro válido.'
        );
        configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesCadastroAvaliacao', true);
        if (carregamento) carregamento.hidden = true;
        return;
    }

    const nome = normalizarNomeOperacao(operacao.nome) || 'OPERAÇÃO SEM NOME';
    referenciaOperacaoFeedback = criarReferenciaOperacao(operacao, originalIndex);
    if (tituloPagina) tituloPagina.textContent = 'Cadastrar Avaliação';
    if (nomeElemento) nomeElemento.textContent = nome;
    document.title = `ORDENA - Cadastrar Avaliação - ${nome}`;

    form?.reset();
    const hoje = formatarDataParaInput(new Date());
    const campoData = document.getElementById('avaliacaoData');
    if (campoData) {
        campoData.value = hoje;
        campoData.max = hoje;
    }
    const campos = Array.from(form?.querySelectorAll('input, textarea') || []);
    limparValidacaoCampos(campos);
    form?.querySelectorAll('input, textarea, button').forEach((controle) => {
        controle.disabled = false;
    });
    configurarBotaoRetornoPaginaAvaliacao('btnVoltarDetalhesCadastroAvaliacao', false);
    definirNavegacaoAvaliacaoDesabilitada(false);
    conteudo.hidden = false;
    if (carregamento) carregamento.hidden = true;
}

async function salvarAvaliacaoOperacao(event) {
    event.preventDefault();

    const elementoMensagem = document.getElementById('cadastroAvaliacaoFeedback');
    if (salvamentoFeedbackEmAndamento) return;
    if (!referenciaOperacaoFeedback) {
        mostrarMensagem(elementoMensagem, 'error', 'A operação desta avaliação não está disponível. Recarregue a página.');
        return;
    }

    const campoData = document.getElementById('avaliacaoData');
    const campoTexto = document.getElementById('avaliacaoTexto');
    const botaoSalvar = document.getElementById('btnSalvarAvaliacao');
    const textoBotaoSalvar = document.getElementById('secaoAvaliacoesOperacaoDetalhes')
        ? '+ Adicionar avaliação'
        : 'Salvar avaliação';
    const campos = [campoData, campoTexto];

    limparMensagem(elementoMensagem);
    limparValidacaoCampos(campos);

    const hoje = formatarDataParaInput(new Date());
    if (document.getElementById('secaoAvaliacoesOperacaoDetalhes')) {
        campoData.value = hoje;
        const dataExibida = document.getElementById('avaliacaoDataAtual');
        dataExibida.dateTime = hoje;
        dataExibida.textContent = formatarDataAvaliacao(hoje);
    }
    const data = campoData?.value.trim() || '';
    const texto = campoTexto?.value.trim() || '';

    if (!parseDataCivilLocal(data)) {
        invalidarCampo(campoData, elementoMensagem, 'Informe uma data válida para a avaliação.');
        return;
    }
    if (data > hoje) {
        invalidarCampo(campoData, elementoMensagem, 'A data da avaliação não pode ser futura.');
        return;
    }
    if (!texto) {
        invalidarCampo(campoTexto, elementoMensagem, 'Escreva a avaliação da operação.');
        return;
    }
    if (texto.length > LIMITE_TEXTO_AVALIACAO) {
        invalidarCampo(campoTexto, elementoMensagem, `A avaliação deve ter no máximo ${LIMITE_TEXTO_AVALIACAO} caracteres.`);
        return;
    }

    salvamentoFeedbackEmAndamento = true;
    definirBotaoProcessando(botaoSalvar, true, 'Salvando', textoBotaoSalvar);
    definirNavegacaoAvaliacaoDesabilitada(true);
    campos.forEach((campo) => {
        if (campo) campo.disabled = true;
    });
    await aguardarAtualizacaoVisual();

    let operacaoAtualizada = null;
    let indiceOperacaoAtualizada = -1;
    let mensagemSucesso = '';
    try {
        const operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
        const indiceOperacao = localizarIndiceOperacao(operacoes, referenciaOperacaoFeedback);
        if (indiceOperacao === -1) {
            throw new Error('A operação não foi encontrada para atualização.');
        }

        const operacao = operacoes[indiceOperacao];
        const agora = new Date().toISOString();
        const avaliacoes = Array.isArray(operacao.avaliacoes) ? [...operacao.avaliacoes] : [];
        avaliacoes.push({
            id: gerarIdAvaliacao(avaliacoes),
            data,
            texto,
            registradoPor: obterNomeUsuarioAvaliacao(),
            criadoEm: agora
        });
        operacao.avaliacoes = avaliacoes;
        operacao.atualizadoEm = agora;

        await OrdenaStorage.setItem('cadastrosOperacoes', JSON.stringify(operacoes));
        operacaoAtualizada = operacao;
        indiceOperacaoAtualizada = indiceOperacao;
        const nome = normalizarNomeOperacao(operacao.nome) || 'Operação';
        mensagemSucesso = `Avaliação da operação “${nome}” registrada com sucesso.`;
    } catch (erro) {
        console.error('Erro ao salvar avaliação da operação:', erro);
        mostrarMensagem(
            elementoMensagem,
            'error',
            erro.message || 'Não foi possível salvar a avaliação. Tente novamente.'
        );
    } finally {
        salvamentoFeedbackEmAndamento = false;
        definirBotaoProcessando(botaoSalvar, false, 'Salvando', textoBotaoSalvar);
        definirNavegacaoAvaliacaoDesabilitada(false);
        campos.forEach((campo) => {
            if (campo) campo.disabled = false;
        });
    }

    if (operacaoAtualizada && indiceOperacaoAtualizada !== -1 && mensagemSucesso) {
        if (document.getElementById('secaoAvaliacoesOperacaoDetalhes')) {
            renderizarTabelaAvaliacoesOperacao(operacaoAtualizada);
            document.getElementById('totalAvaliacoesDetalhes').textContent = obterTextoStatusAvaliacao(operacaoAtualizada);
            campoTexto.value = '';
            campoData.value = formatarDataParaInput(new Date());
            campoData.max = campoData.value;
            mostrarMensagem(elementoMensagem, 'success', mensagemSucesso);
            campoTexto.focus();
            return;
        }
        const feedbackPreparado = salvarFeedbackNavegacaoAvaliacoes('success', mensagemSucesso);
        if (!feedbackPreparado) window.alert(mensagemSucesso);
        window.location.href = criarUrlPaginaOperacao(
            'avaliacoes_operacao_especial.html',
            operacaoAtualizada,
            indiceOperacaoAtualizada
        );
    }
}

function construirAlertasOperacoesVencidas(operacoes, vinculosAtivos) {
    const alertas = [];

    operacoes.forEach((op) => {
        const nome = normalizarNomeOperacao(op && op.nome);
        if (!nome) return;

        const resumoAtivo = vinculosAtivos[nome];
        const totalAtivas = resumoAtivo ? resumoAtivo.ordens.size : 0;
        if (!totalAtivas) return;

        if (obterStatusOperacao(op) !== 'Inativa') return;

        const inativadaManualmente = operacaoFoiInativadaManualmente(op);
        const dataReferencia = inativadaManualmente
            ? parseDataHora(op.dataEncerramento, false)
            : obterDataFimComparavel(op);
        const encerramentoExibicao = inativadaManualmente
            ? formatarDataHora(op.dataEncerramento)
            : formatarDataOperacao(op.fim, op.criadoEm);

        const numerosAtivos = ordenarNumerosOS(resumoAtivo.ordens);
        alertas.push({
            nome,
            dataReferencia: dataReferencia || new Date(0),
            encerramentoExibicao,
            totalAtivas,
            numeros: numerosAtivos.join(', ')
        });
    });

    alertas.sort((a, b) => a.dataReferencia.getTime() - b.dataReferencia.getTime());
    return alertas;
}

function renderizarPainelAlertas(alertas) {
    const painel = document.getElementById('painelAlertasOperacoes');
    if (!painel) return;

    if (!Array.isArray(alertas) || alertas.length === 0) {
        painel.classList.remove('ativo');
        painel.innerHTML = '';
        return;
    }

    const limite = 5;
    const itens = alertas.slice(0, limite).map((item) => `
        <li>
            <strong>${escapeHtml(item.nome)}</strong>: encerrada em ${escapeHtml(item.encerramentoExibicao)},
            vinculada em ${item.totalAtivas} OS ativas (${escapeHtml(item.numeros)}).
        </li>
    `).join('');
    const restante = alertas.length > limite
        ? `<li>... e mais ${alertas.length - limite} operação(ões).</li>`
        : '';

    painel.innerHTML = `
        <div class="alertas-titulo">
            Atenção: ${alertas.length} operação(ões) inativa(s) ainda vinculada(s) em OS ativas.
        </div>
        <ul class="alertas-lista">
            ${itens}
            ${restante}
        </ul>
    `;
    painel.classList.add('ativo');
}

function ordenarOperacoes(operacoes) {
    return operacoes.sort((a, b) => {
        const dataA = parseDataHora(a.fim, false) || parseDataHora(a.inicio, false) || parseDataHora(a.criadoEm, false) || new Date(0);
        const dataB = parseDataHora(b.fim, false) || parseDataHora(b.inicio, false) || parseDataHora(b.criadoEm, false) || new Date(0);
        return dataB.getTime() - dataA.getTime();
    });
}

function renderizarMensagemTabelaOperacoes(container, mensagem, classe = '') {
    if (!container) return;
    const classeAdicional = classe ? ` ${classe}` : '';
    container.innerHTML = `
        <tr class="mensagem-tabela-operacoes${classeAdicional}">
            <td colspan="7">${escapeHtml(mensagem)}</td>
        </tr>
    `;
}

function renderizarOperacoes() {
    const container = document.getElementById('listaOperacoes');
    if (!container) return;

    let operacoes;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao carregar operações:', erro);
        agendarAtualizacaoPorTermino([]);
        renderizarPainelAlertas([]);
        renderizarMensagemTabelaOperacoes(
            container,
            'Não foi possível carregar as operações cadastradas.',
            'erro'
        );
        mostrarMensagem(
            document.getElementById('listaOperacaoFeedback'),
            'error',
            'Os dados das operações estão inválidos ou indisponíveis. Nenhuma alteração foi realizada.'
        );
        return;
    }

    agendarAtualizacaoPorTermino(operacoes);
    const vinculos = mapearVinculosEmOS(false);
    const vinculosAtivos = mapearVinculosEmOS(true);
    const alertas = construirAlertasOperacoesVencidas(operacoes, vinculosAtivos);
    container.innerHTML = '';
    renderizarPainelAlertas(alertas);

    const filtradas = operacoes
        .map((operacao, originalIndex) => ({ ...operacao, originalIndex }))
        .filter((op) => {
            const status = obterStatusOperacao(op);
            if (statusFiltroAtualOperacoes === 'Todas') return true;
            return status === statusFiltroAtualOperacoes;
        });

    ordenarOperacoes(filtradas);

    if (filtradas.length === 0) {
        const msg = statusFiltroAtualOperacoes === 'Todas'
            ? 'Nenhuma operação especial cadastrada.'
            : `Nenhuma operação ${statusFiltroAtualOperacoes.toLowerCase()} encontrada.`;
        renderizarMensagemTabelaOperacoes(container, msg);
        return;
    }

    filtradas.forEach((op) => {
        const nome = normalizarNomeOperacao(op.nome) || 'SEM NOME';
        const status = obterStatusOperacao(op);
        const periodoIncompleto = !obterPeriodoComparavel(op);
        const classeStatus = status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        const textoStatus = status;
        const resumoVinculo = vinculos[nome] || { ordens: new Set() };
        const resumoVinculoAtivo = vinculosAtivos[nome] || { ordens: new Set() };
        const totalOrdens = resumoVinculo.ordens.size || 0;
        const totalOrdensAtivas = resumoVinculoAtivo.ordens.size || 0;
        const inicioData = formatarDataOperacao(op.inicio, op.criadoEm);
        const fimData = formatarDataOperacao(op.fim, op.criadoEm, 'Sem data definida');
        const operacaoFinalizadaEmUso = status === 'Inativa' && totalOrdensAtivas > 0;
        const totalAvaliacoes = obterAvaliacoesOperacao(op).length;
        const avaliacaoVisual = totalAvaliacoes > 0
            ? `<span class="status-pill status-feedback-concluido">${totalAvaliacoes} ${totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'}</span>`
            : '<span class="avaliacao-indisponivel">Sem registros</span>';
        const textoBotaoAvaliacao = 'Avaliações';
        const classeAviso = operacaoFinalizadaEmUso || periodoIncompleto ? ' com-alerta' : '';
        const botaoInativar = status === 'Ativa'
            ? `<button type="button" class="btn-danger btn-inativar-operacao" onclick="abrirModalInativacao(${op.originalIndex})" aria-label="Inativar a operação ${escapeHtml(nome)}">Inativar</button>`
            : '';

        const linha = document.createElement('tr');
        linha.className = `operacao-row${classeAviso}`;
        linha.innerHTML = `
            <td data-label="Operação"><strong class="nome-op">${escapeHtml(nome)}</strong></td>
            <td data-label="Início">${escapeHtml(inicioData)}</td>
            <td data-label="Término">${escapeHtml(fimData)}</td>
            <td data-label="OS vinculadas">${totalOrdens}</td>
            <td data-label="Status">
                <div class="status-operacao-cell">
                    ${operacaoFinalizadaEmUso ? '<span class="status-pill status-warning">ALERTA</span>' : ''}
                    <span class="status-pill ${classeStatus}">${textoStatus}</span>
                    ${periodoIncompleto ? '<span class="status-pill status-warning">PERÍODO INCOMPLETO</span>' : ''}
                </div>
            </td>
            <td data-label="Avaliações">${avaliacaoVisual}</td>
            <td data-label="Ações" class="acoes-operacao-cell">
                <div class="acoes-operacao">
                    <!-- Avaliações agora disponíveis nos detalhes da operação.
                    <button type="button" class="btn-info btn-avaliacoes-operacao" data-operacao-index="${op.originalIndex}" onclick="abrirAvaliacoesOperacao(${op.originalIndex})" aria-label="Ver avaliações da operação ${escapeHtml(nome)}">${escapeHtml(textoBotaoAvaliacao)}</button>
                    -->
                    <button type="button" class="btn-secondary btn-detalhes-operacao" onclick="abrirDetalhesOperacao(${op.originalIndex})" aria-label="Visualizar os detalhes da operação ${escapeHtml(nome)}">Visualizar detalhes</button>
                    ${botaoInativar}
                </div>
            </td>
        `;

        container.append(linha);
    });
}

function resolverOperacaoDetalhes(operacoes) {
    const parametros = new URLSearchParams(window.location.search);
    const idOperacao = parametros.get('id');
    const nomeOperacao = normalizarNomeOperacao(parametros.get('nome'));
    const criadoEmOperacao = parametros.get('criadoEm') || '';
    const indiceTexto = parametros.get('indice');
    const indiceOperacao = indiceTexto != null && indiceTexto !== ''
        ? Number(indiceTexto)
        : Number.NaN;

    if (idOperacao) {
        const operacaoPorId = operacoes.find((operacao) =>
            String(operacao?.id ?? '') === idOperacao
        );
        if (operacaoPorId) return operacaoPorId;
    }

    if (criadoEmOperacao && nomeOperacao) {
        const operacaoPorCriacao = operacoes.find((operacao) =>
            operacao?.criadoEm === criadoEmOperacao
            && normalizarNomeOperacao(operacao?.nome) === nomeOperacao
        );
        if (operacaoPorCriacao) return operacaoPorCriacao;
    }

    if (Number.isInteger(indiceOperacao) && indiceOperacao >= 0) {
        const operacaoPorIndice = operacoes[indiceOperacao];
        if (operacaoPorIndice
            && (!nomeOperacao || normalizarNomeOperacao(operacaoPorIndice.nome) === nomeOperacao)) {
            return operacaoPorIndice;
        }
    }

    if (!nomeOperacao) return null;
    return operacoes.find((operacao) =>
        normalizarNomeOperacao(operacao?.nome) === nomeOperacao
    ) || null;
}

function obterTextoStatusAvaliacao(operacao) {
    const total = obterAvaliacoesOperacao(operacao).length;
    if (total === 0) return 'Nenhuma registrada';
    return `${total} ${total === 1 ? 'registrada' : 'registradas'}`;
}

async function renderizarPaginaDetalhesOperacao() {
    const conteudo = document.getElementById('detalhesOperacaoConteudo');
    if (!conteudo) return;

    const carregamento = document.getElementById('detalhesOperacaoLoading');
    const elementoMensagem = document.getElementById('detalhesOperacaoFeedback');
    const tituloPagina = document.getElementById('tituloDetalhesOperacao');
    const botaoAvaliacoes = document.getElementById('btnAvaliacoesDetalhesOperacao');
    const botaoImprimirTodasOS = document.getElementById('btnImprimirTodasOSOperacao');
    const sequenciaAtual = ++sequenciaCarregamentoDetalhesOperacao;

    limparMensagem(elementoMensagem);
    if (botaoAvaliacoes) botaoAvaliacoes.disabled = true;
    if (botaoImprimirTodasOS) botaoImprimirTodasOS.disabled = true;
    conteudo.hidden = true;
    if (carregamento) carregamento.hidden = false;
    await aguardarAtualizacaoVisual();
    if (sequenciaAtual !== sequenciaCarregamentoDetalhesOperacao) return;

    let operacoes;
    let ordens;
    try {
        operacoes = lerArrayStorageParaGravacao('cadastrosOperacoes');
        ordens = lerArrayStorageParaGravacao('ordensServico');
    } catch (erro) {
        console.error('Erro ao carregar os detalhes da operação:', erro);
        if (tituloPagina) tituloPagina.textContent = 'Detalhes da Operação Especial';
        mostrarMensagem(
            elementoMensagem,
            'error',
            'Não foi possível carregar todos os dados da operação. Volte à listagem e tente novamente.'
        );
        if (carregamento) carregamento.hidden = true;
        return;
    }

    agendarAtualizacaoPorTermino(operacoes);

    const operacao = resolverOperacaoDetalhes(operacoes);
    if (!operacao) {
        if (tituloPagina) tituloPagina.textContent = 'Operação especial não encontrada';
        document.title = 'ORDENA - Operação não encontrada';
        mostrarMensagem(
            elementoMensagem,
            'error',
            'Não foi possível localizar a operação informada. Volte à listagem e selecione um cadastro válido.'
        );
        if (carregamento) carregamento.hidden = true;
        return;
    }

    const nome = normalizarNomeOperacao(operacao.nome) || 'OPERAÇÃO SEM NOME';
    const status = obterStatusOperacao(operacao);
    const periodoIncompleto = !obterPeriodoComparavel(operacao);
    const classeStatus = status === 'Ativa' ? 'status-ativa' : 'status-inativa';
    const inicioData = formatarDataOperacao(operacao.inicio, operacao.criadoEm);
    const fimData = formatarDataOperacao(operacao.fim, operacao.criadoEm, 'Sem data definida');
    const vinculos = mapearVinculosEmOS(false, ordens)[nome] || { ordens: new Set() };
    const vinculosAtivos = mapearVinculosEmOS(true, ordens)[nome] || { ordens: new Set() };
    const numerosOs = ordenarNumerosOS(vinculos.ordens);
    const numerosOsAtivos = ordenarNumerosOS(vinculosAtivos.ordens);
    const totalOrdens = numerosOs.length;
    const totalOrdensAtivas = numerosOsAtivos.length;
    const numerosTexto = totalOrdens > 0 ? numerosOs.join(', ') : 'Nenhuma OS vinculada';
    const dataEncerramento = operacaoFoiInativadaManualmente(operacao)
        ? formatarDataHora(operacao.dataEncerramento)
        : '';
    const avisoVinculoAtivo = status === 'Inativa' && totalOrdensAtivas > 0
        ? `
            <div class="alerta-op">
                <strong>Aviso:</strong> esta operação está inativa, mas permanece vinculada a
                <strong>${totalOrdensAtivas} OS ativa(s)</strong>
                (${escapeHtml(numerosOsAtivos.join(', '))}). Os vínculos existentes foram preservados.
            </div>
        `
        : '';
    const avisoPeriodo = periodoIncompleto
        ? '<span class="status-pill status-warning">PERÍODO INCOMPLETO</span>'
        : '';
    const metaEncerramento = dataEncerramento
        ? `
            <div class="meta-item">
                <span>Inativada em</span>
                <strong>${escapeHtml(dataEncerramento)}</strong>
            </div>
        `
        : '';

    if (tituloPagina) tituloPagina.textContent = 'Detalhes da Operação Especial';
    document.title = `ORDENA - Detalhes - ${nome}`;
    if (botaoAvaliacoes) botaoAvaliacoes.disabled = false;
    if (botaoImprimirTodasOS) {
        const possuiOrdensVinculadas = totalOrdens > 0;
        botaoImprimirTodasOS.disabled = !possuiOrdensVinculadas;
        botaoImprimirTodasOS.title = possuiOrdensVinculadas
            ? `Imprimir todas as ${totalOrdens} OS vinculada(s) a ${nome}`
            : 'Nenhuma OS vinculada para impressão';
    }
    conteudo.innerHTML = `
        <div class="detalhes-operacao-header">
            <div>
                <span class="detalhes-operacao-label">Operação especial</span>
                <h3>${escapeHtml(nome)}</h3>
            </div>
            <div class="detalhes-operacao-status" aria-label="Status da operação">
                <span class="status-pill ${classeStatus}">${escapeHtml(status)}</span>
                ${avisoPeriodo}
            </div>
        </div>

        ${avisoVinculoAtivo}

        <div class="descricao-op">
            <strong>Descrição / objetivo</strong>
            <p>${escapeHtml(operacao.descricao || 'Não informada.')}</p>
        </div>

        <div class="meta-grid">
            <div class="meta-item">
                <span>Data de início</span>
                <strong>${escapeHtml(inicioData)}</strong>
            </div>
            <div class="meta-item">
                <span>Data de término</span>
                <strong>${escapeHtml(fimData)}</strong>
            </div>
            <div class="meta-item">
                <span>Status</span>
                <strong>${escapeHtml(status)}</strong>
            </div>
            <div class="meta-item">
                <span>Avaliações</span>
                <strong id="totalAvaliacoesDetalhes">${escapeHtml(obterTextoStatusAvaliacao(operacao))}</strong>
            </div>
            <div class="meta-item">
                <span>OS vinculadas</span>
                <strong>${totalOrdens}</strong>
            </div>
            <div class="meta-item">
                <span>OS ativas vinculadas</span>
                <strong>${totalOrdensAtivas}</strong>
            </div>
            <div class="meta-item meta-item-wide">
                <span>Números das OS</span>
                <strong>${escapeHtml(numerosTexto)}</strong>
            </div>
            ${metaEncerramento}
        </div>

        <!-- Datas de registro ocultadas na apresentação dos detalhes.
        <div class="detalhes-registro">
            <span>Criada em: <strong>${escapeHtml(formatarDataHora(operacao.criadoEm))}</strong></span>
            <span>Última atualização: <strong>${escapeHtml(formatarDataHora(operacao.atualizadoEm))}</strong></span>
        </div>
        -->

        <section id="secaoPontosOperacaoDetalhes" class="pontos-detalhes-section" aria-labelledby="tituloPontosOperacao">
            <div class="pontos-detalhes-header">
                <div class="pontos-title-area">
                    <h4 id="tituloPontosOperacao">Pontos vinculados</h4>
                    <div class="pontos-resumo-inline" aria-label="Resumo dos vínculos">
                        <span class="pontos-resumo-item">
                            <strong id="totalPontosVinculados">0</strong>
                            <span id="rotuloTotalPontosVinculados">pontos vinculados</span>
                        </span>
                        <span class="pontos-resumo-item">
                            <strong id="totalOsRelacionadas">0</strong>
                            <span id="rotuloTotalOsRelacionadas">OS relacionadas</span>
                        </span>
                    </div>
                </div>
            </div>

            <p id="descricaoPontosOperacao" class="pontos-page-description">Somente pontos vinculados em Ordens de Serviço ativas são exibidos.</p>
            <div id="pontosOperacaoFeedback" class="pontos-feedback" aria-live="polite"></div>

            <div class="table-responsive pontos-table-wrapper">
                <table class="pontos-table">
                    <thead>
                        <tr>
                            <th scope="col">Nº OS</th>
                            <th scope="col">Missão</th>
                            <th scope="col">Atividade</th>
                            <th scope="col">Horário</th>
                            <th scope="col">Ponto / Área</th>
                            <th scope="col">Endereço</th>
                            <th scope="col">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="listaPontosOperacao" aria-live="polite">
                        <tr class="pontos-loading-row">
                            <td colspan="7">
                                <div class="pontos-loading" role="status">
                                    Carregando pontos vinculados
                                    <span class="growing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
        <section id="secaoAvaliacoesOperacaoDetalhes" class="pontos-detalhes-section" aria-labelledby="tituloAvaliacoesDetalhes">
            <div class="pontos-detalhes-header">
                <h4 id="tituloAvaliacoesDetalhes">Avaliações</h4>
            </div>
            <p class="pontos-page-description">Consulte as avaliações e registre uma nova na linha abaixo.</p>
            <div id="cadastroAvaliacaoFeedback" class="operacao-feedback" aria-live="polite" tabindex="-1"></div>
            <form id="avaliacaoOperacaoForm" novalidate>
                <div class="table-responsive pontos-table-wrapper">
                    <table class="avaliacoes-detalhes-table">
                        <thead>
                            <tr>
                                <th scope="col">Data</th>
                                <th scope="col">Avaliação</th>
                                <th scope="col">Registrada por / Ação</th>
                            </tr>
                        </thead>
                        <tbody id="listaAvaliacoesOperacaoTabela" aria-live="polite"></tbody>
                        <tbody class="fracionamento-editor" aria-label="Adicionar nova avaliação">
                            <tr>
                                <td data-label="Data">
                                    <!-- Campo editável anterior preservado:
                                    <input type="date" id="avaliacaoData" class="input-padrao" aria-label="Data da avaliação" required aria-required="true">
                                    -->
                                    <input type="hidden" id="avaliacaoData">
                                    <time id="avaliacaoDataAtual"></time>
                                </td>
                                <td data-label="Avaliação" class="avaliacao-texto-cell">
                                    <textarea id="avaliacaoTexto" class="input-padrao" rows="2" maxlength="2000" placeholder="Registre a avaliação da operação." aria-label="Avaliação" required aria-required="true"></textarea>
                                </td>
                                <td data-label="Ação">
                                    <button type="submit" id="btnSalvarAvaliacao" class="btn-info">+ Adicionar avaliação</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </form>
        </section>
    `;

    referenciaOperacaoFeedback = criarReferenciaOperacao(operacao, operacoes.indexOf(operacao));
    renderizarTabelaAvaliacoesOperacao(operacao);
    const campoDataAvaliacao = document.getElementById('avaliacaoData');
    campoDataAvaliacao.value = formatarDataParaInput(new Date());
    campoDataAvaliacao.max = campoDataAvaliacao.value;
    const dataAvaliacaoExibida = document.getElementById('avaliacaoDataAtual');
    dataAvaliacaoExibida.dateTime = campoDataAvaliacao.value;
    dataAvaliacaoExibida.textContent = formatarDataAvaliacao(campoDataAvaliacao.value);
    const formAvaliacaoDetalhes = document.getElementById('avaliacaoOperacaoForm');
    formAvaliacaoDetalhes.addEventListener('submit', salvarAvaliacaoOperacao);
    formAvaliacaoDetalhes.addEventListener('input', (event) => {
        event.target.removeAttribute('aria-invalid');
        limparMensagem(document.getElementById('cadastroAvaliacaoFeedback'));
    });

    if (typeof renderizarPontosOperacao === 'function') {
        renderizarPontosOperacao();
    }

    conteudo.hidden = false;
    if (carregamento) carregamento.hidden = true;
}

function atualizarBotoesFiltroOperacoes() {
    ['Ativa', 'Inativa'].forEach((status) => {
        const botao = document.getElementById(`btnFiltro${status}`);
        if (!botao) return;
        const selecionado = statusFiltroAtualOperacoes === status;
        botao.classList.toggle('active', selecionado);
        botao.setAttribute('aria-pressed', String(selecionado));
    });
}

function mudarFiltro(status) {
    if (!['Ativa', 'Inativa'].includes(status)) return;
    statusFiltroAtualOperacoes = status;
    atualizarBotoesFiltroOperacoes();
    renderizarOperacoes();
}
