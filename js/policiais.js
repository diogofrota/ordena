const STORAGE_KEY_POLICIAIS = 'policiais';
const FEEDBACK_NAVEGACAO_POLICIAIS_KEY = 'ordenaFeedbackPoliciais';

const POSTOS_GRADUACOES_POLICIAIS = Object.freeze([
    'GCM Coordenador',
    'GCM Supervisor',
    'GCM',
    'SD',
    'CB',
    '3SGT',
    '2SGT',
    '1SGT',
    'SUBTEN',
    'ASP',
    'TEN',
    'CAP',
    'MAJ',
    'TC',
    'CEL'
]);

const parametrosPoliciais = new URLSearchParams(window.location.search);
const filtroUrlPoliciais = parametrosPoliciais.get('filtro');

let statusFiltroPoliciais = filtroUrlPoliciais === 'Inativo' ? 'Inativo' : 'Ativo';
let policialEmEdicaoId = '';
let operacaoPolicialEmAndamento = false;

function inicializarPaginaPoliciais() {
    const lista = document.getElementById('listaPoliciais');
    const formulario = document.getElementById('policialForm');

    if (lista) {
        configurarListaPoliciais();
        atualizarBotoesFiltroPoliciais();
        renderizarPoliciais();
        restaurarFeedbackNavegacaoPoliciais();
    }

    if (formulario) {
        configurarFormularioPolicial(formulario);
        carregarPolicialParaEdicao();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarPaginaPoliciais, { once: true });
} else {
    inicializarPaginaPoliciais();
}

window.addEventListener('storage', (evento) => {
    if (evento.key === STORAGE_KEY_POLICIAIS
        && document.getElementById('listaPoliciais')
        && !operacaoPolicialEmAndamento) {
        renderizarPoliciais();
    }
});

function configurarListaPoliciais() {
    document.getElementById('btnCadastrarPolicial')?.addEventListener('click', () => {
        if (operacaoPolicialEmAndamento) return;
        window.location.href = 'cadastro_policial.html';
    });

    document.getElementById('btnFiltroAtivos')?.addEventListener('click', () => {
        mudarFiltroPoliciais('Ativo');
    });

    document.getElementById('btnFiltroInativos')?.addEventListener('click', () => {
        mudarFiltroPoliciais('Inativo');
    });

    document.getElementById('listaPoliciais')?.addEventListener('click', (evento) => {
        const botao = evento.target.closest('button[data-acao-policial]');
        if (!botao || operacaoPolicialEmAndamento) return;

        const id = botao.dataset.policialId || '';
        if (!id) {
            mostrarFeedbackPoliciais(
                document.getElementById('feedbackListaPoliciais'),
                'error',
                'Não foi possível identificar o policial selecionado.'
            );
            return;
        }

        if (botao.dataset.acaoPolicial === 'editar') {
            const parametros = new URLSearchParams({ id, filtro: statusFiltroPoliciais });
            window.location.href = `cadastro_policial.html?${parametros.toString()}`;
            return;
        }

        if (botao.dataset.acaoPolicial === 'status') {
            alternarStatusPolicial(id, botao);
        }
    });
}

function configurarFormularioPolicial(formulario) {
    const campoNome = document.getElementById('nomeGuerraPolicial');
    const campoRg = document.getElementById('rgPolicial');
    const campoTelefone = document.getElementById('telefonePolicial');

    campoNome?.addEventListener('input', (evento) => {
        evento.target.value = evento.target.value.toLocaleUpperCase('pt-BR');
        limparErroValidacaoPolicial(evento.target);
    });
    campoNome?.addEventListener('blur', (evento) => {
        evento.target.value = normalizarNomeGuerra(evento.target.value);
    });

    campoRg?.addEventListener('input', (evento) => {
        evento.target.value = evento.target.value.toLocaleUpperCase('pt-BR').slice(0, 20);
        limparErroValidacaoPolicial(evento.target);
    });

    campoTelefone?.addEventListener('input', (evento) => {
        evento.target.value = formatarTelefoneBrasileiro(evento.target.value);
        limparErroValidacaoPolicial(evento.target);
    });

    document.getElementById('postoPolicial')?.addEventListener('change', (evento) => {
        limparErroValidacaoPolicial(evento.target);
    });

    formulario.addEventListener('submit', salvarPolicial);
    document.getElementById('btnCancelarEdicaoPolicial')?.addEventListener('click', voltarParaListaPoliciais);
}

function lerPoliciais() {
    const valor = OrdenaStorage.getItem(STORAGE_KEY_POLICIAIS);
    if (valor == null) return [];

    const policiais = JSON.parse(valor);
    if (!Array.isArray(policiais)) {
        throw new Error('A chave policiais não contém uma lista.');
    }

    return policiais;
}

async function salvarListaPoliciais(policiais) {
    await OrdenaStorage.setItem(STORAGE_KEY_POLICIAIS, JSON.stringify(policiais));
}

function normalizarNomeGuerra(valor) {
    return String(valor ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleUpperCase('pt-BR');
}

function normalizarRg(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function obterDigitosTelefone(valor) {
    return String(valor ?? '').replace(/\D/g, '').slice(0, 11);
}

function formatarTelefoneBrasileiro(valor) {
    const digitos = obterDigitosTelefone(valor);
    if (!digitos) return '';
    if (digitos.length <= 2) return `(${digitos}`;

    const ddd = digitos.slice(0, 2);
    const numero = digitos.slice(2);
    if (numero.length <= 4) return `(${ddd}) ${numero}`;

    if (digitos.length <= 10) {
        return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
    }

    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
}

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, (caractere) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[caractere]);
}

function obterStatusPolicial(policial) {
    const status = String(policial?.status ?? '').trim().toLocaleLowerCase('pt-BR');
    return ['inativo', 'inativa'].includes(status) ? 'Inativo' : 'Ativo';
}

function mostrarFeedbackPoliciais(elemento, tipo, mensagem) {
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.className = `page-feedback is-visible ${tipo}`;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparFeedbackPoliciais(elemento) {
    if (!elemento) return;
    elemento.textContent = '';
    elemento.className = 'page-feedback';
    elemento.removeAttribute('role');
}

function salvarFeedbackNavegacaoPoliciais(tipo, mensagem) {
    try {
        sessionStorage.setItem(
            FEEDBACK_NAVEGACAO_POLICIAIS_KEY,
            JSON.stringify({ tipo, mensagem })
        );
        return true;
    } catch (erro) {
        console.warn('Não foi possível preservar a confirmação do cadastro de policiais:', erro);
        return false;
    }
}

function restaurarFeedbackNavegacaoPoliciais() {
    let feedback = null;

    try {
        const valor = sessionStorage.getItem(FEEDBACK_NAVEGACAO_POLICIAIS_KEY);
        sessionStorage.removeItem(FEEDBACK_NAVEGACAO_POLICIAIS_KEY);
        if (valor) feedback = JSON.parse(valor);
    } catch (erro) {
        console.warn('Não foi possível recuperar a confirmação do cadastro de policiais:', erro);
    }

    if (!feedback
        || !['success', 'error'].includes(feedback.tipo)
        || typeof feedback.mensagem !== 'string') {
        return;
    }

    mostrarFeedbackPoliciais(
        document.getElementById('feedbackListaPoliciais'),
        feedback.tipo,
        feedback.mensagem
    );
}

function mudarFiltroPoliciais(status) {
    if (operacaoPolicialEmAndamento || !['Ativo', 'Inativo'].includes(status)) return;

    statusFiltroPoliciais = status;
    atualizarBotoesFiltroPoliciais();

    if (window.history && typeof window.history.replaceState === 'function') {
        const url = new URL(window.location.href);
        url.searchParams.set('filtro', status);
        window.history.replaceState({}, '', url);
    }

    renderizarPoliciais();
}

function atualizarBotoesFiltroPoliciais() {
    const btnAtivos = document.getElementById('btnFiltroAtivos');
    const btnInativos = document.getElementById('btnFiltroInativos');
    const exibindoAtivos = statusFiltroPoliciais === 'Ativo';

    if (btnAtivos) {
        btnAtivos.classList.toggle('active', exibindoAtivos);
        btnAtivos.setAttribute('aria-pressed', String(exibindoAtivos));
    }

    if (btnInativos) {
        btnInativos.classList.toggle('active', !exibindoAtivos);
        btnInativos.setAttribute('aria-pressed', String(!exibindoAtivos));
    }
}

function renderizarPoliciais() {
    const lista = document.getElementById('listaPoliciais');
    const feedback = document.getElementById('feedbackListaPoliciais');
    if (!lista) return;

    let policiais;
    try {
        policiais = lerPoliciais();
    } catch (erro) {
        console.error('Erro ao carregar os policiais:', erro);
        lista.innerHTML = `
            <tr>
                <td colspan="6" style="padding:24px; text-align:center; color:#721c24;">
                    Não foi possível carregar os policiais cadastrados.
                </td>
            </tr>
        `;
        mostrarFeedbackPoliciais(
            feedback,
            'error',
            'Não foi possível carregar os policiais salvos. Os dados existentes foram preservados.'
        );
        return;
    }

    lista.innerHTML = '';
    const filtrados = policiais
        .filter((policial) => policial && typeof policial === 'object')
        .filter((policial) => obterStatusPolicial(policial) === statusFiltroPoliciais)
        .sort((a, b) => normalizarNomeGuerra(a.nomeGuerra).localeCompare(
            normalizarNomeGuerra(b.nomeGuerra),
            'pt-BR',
            { sensitivity: 'base', numeric: true }
        ));

    if (filtrados.length === 0) {
        const status = statusFiltroPoliciais === 'Ativo' ? 'ativo' : 'inativo';
        lista.innerHTML = `
            <tr>
                <td colspan="6" style="padding:24px; text-align:center; color:#666;">
                    Nenhum policial ${status} encontrado.
                </td>
            </tr>
        `;
        return;
    }

    filtrados.forEach((policial) => {
        const id = String(policial.id ?? '').trim();
        const status = obterStatusPolicial(policial);
        const classeStatus = status === 'Ativo' ? 'status-ativa' : 'status-inativa';
        const botaoStatus = status === 'Ativo'
            ? `<button type="button" class="btn-danger" data-acao-policial="status" data-policial-id="${escaparHtml(id)}">Inativar</button>`
            : `<button type="button" class="btn-success" data-acao-policial="status" data-policial-id="${escaparHtml(id)}">Reativar</button>`;
        const botoes = id
            ? `
                <button type="button" class="btn-warning" data-acao-policial="editar" data-policial-id="${escaparHtml(id)}">Editar</button>
                ${botaoStatus}
            `
            : '<span style="color:#721c24;">Cadastro sem identificador</span>';

        lista.insertAdjacentHTML('beforeend', `
            <tr>
                <td data-label="Posto/Grad"><strong>${escaparHtml(policial.posto || '-')}</strong></td>
                <td data-label="Nome de Guerra">${escaparHtml(policial.nomeGuerra || '-')}</td>
                <td data-label="RG">${escaparHtml(policial.rg || '-')}</td>
                <td data-label="Telefone">${escaparHtml(policial.telefone || '-')}</td>
                <td data-label="Status"><span class="status-pill ${classeStatus}">${status}</span></td>
                <td data-label="Ações" style="text-align:center;">
                    <div class="acoes-policial">${botoes}</div>
                </td>
            </tr>
        `);
    });
}

function definirListaPoliciaisProcessando(botaoAcionado, processando, textoProcessando) {
    const container = document.getElementById('tabelaPoliciaisContainer');
    container?.setAttribute('aria-busy', String(processando));

    document.querySelectorAll(
        '#btnCadastrarPolicial, #btnFiltroAtivos, #btnFiltroInativos, [data-acao-policial]'
    ).forEach((botao) => {
        botao.disabled = processando;
    });

    if (processando && botaoAcionado) {
        botaoAcionado.innerHTML = `
            <span>${escaparHtml(textoProcessando)}</span>
            <span class="growing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        `;
        botaoAcionado.setAttribute('aria-busy', 'true');
    }
}

async function alternarStatusPolicial(id, botao) {
    if (operacaoPolicialEmAndamento) return;

    const feedback = document.getElementById('feedbackListaPoliciais');
    let policiais;
    try {
        policiais = lerPoliciais();
    } catch (erro) {
        console.error('Erro ao ler os policiais para alteração de status:', erro);
        mostrarFeedbackPoliciais(feedback, 'error', 'Não foi possível carregar o cadastro selecionado.');
        return;
    }

    const indice = policiais.findIndex((policial) => String(policial?.id ?? '') === id);
    if (indice === -1) {
        mostrarFeedbackPoliciais(feedback, 'error', 'O policial selecionado não foi encontrado. Atualize a página e tente novamente.');
        return;
    }

    const policial = policiais[indice];
    const statusAtual = obterStatusPolicial(policial);
    const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';
    const nome = normalizarNomeGuerra(policial.nomeGuerra) || 'policial selecionado';

    if (!window.confirm(`Alterar o status de “${nome}” para ${novoStatus.toLowerCase()}?`)) return;

    limparFeedbackPoliciais(feedback);
    operacaoPolicialEmAndamento = true;
    definirListaPoliciaisProcessando(
        botao,
        true,
        novoStatus === 'Ativo' ? 'Reativando...' : 'Inativando...'
    );
    await aguardarAtualizacaoVisualPoliciais();

    let alterado = false;
    try {
        policiais = lerPoliciais();
        const indiceAtual = policiais.findIndex((item) => String(item?.id ?? '') === id);
        if (indiceAtual === -1) {
            throw new Error('O policial não foi encontrado para atualização.');
        }

        policiais[indiceAtual] = {
            ...policiais[indiceAtual],
            status: novoStatus,
            atualizadoEm: new Date().toISOString()
        };
        await salvarListaPoliciais(policiais);
        alterado = true;
    } catch (erro) {
        console.error('Erro ao alterar o status do policial:', erro);
        mostrarFeedbackPoliciais(
            feedback,
            'error',
            erro.message === 'O policial não foi encontrado para atualização.'
                ? erro.message
                : 'Não foi possível alterar o status do policial. Tente novamente.'
        );
    } finally {
        operacaoPolicialEmAndamento = false;
        renderizarPoliciais();
        definirListaPoliciaisProcessando(null, false, '');
    }

    if (alterado) {
        mostrarFeedbackPoliciais(
            feedback,
            'success',
            `Policial “${nome}” ${novoStatus === 'Ativo' ? 'reativado' : 'inativado'} com sucesso.`
        );
    }
}

function carregarPolicialParaEdicao() {
    const id = String(parametrosPoliciais.get('id') || '').trim();
    if (!id) return;

    policialEmEdicaoId = id;
    const feedback = document.getElementById('feedbackCadastroPolicial');

    let policiais;
    try {
        policiais = lerPoliciais();
    } catch (erro) {
        console.error('Erro ao carregar o policial para edição:', erro);
        mostrarFeedbackPoliciais(
            feedback,
            'error',
            'Não foi possível carregar os policiais salvos. Nenhum dado será alterado.'
        );
        bloquearFormularioPolicial();
        return;
    }

    const policial = policiais.find((item) => String(item?.id ?? '') === id);
    if (!policial) {
        mostrarFeedbackPoliciais(
            feedback,
            'error',
            'O policial informado para edição não foi encontrado.'
        );
        bloquearFormularioPolicial();
        return;
    }

    const titulo = document.getElementById('tituloCadastroPolicial');
    const descricao = document.getElementById('descricaoCadastroPolicial');
    const botaoSalvar = document.getElementById('btnSalvarPolicial');
    const botaoCancelar = document.getElementById('btnCancelarEdicaoPolicial');

    if (titulo) titulo.textContent = 'Editar Policial';
    if (descricao) descricao.textContent = 'Atualize os dados cadastrais do policial selecionado.';
    if (botaoSalvar) botaoSalvar.textContent = 'Salvar alterações';
    if (botaoCancelar) botaoCancelar.hidden = false;

    document.getElementById('postoPolicial').value = policial.posto || '';
    document.getElementById('nomeGuerraPolicial').value = normalizarNomeGuerra(policial.nomeGuerra);
    document.getElementById('rgPolicial').value = String(policial.rg || '');
    document.getElementById('telefonePolicial').value = formatarTelefoneBrasileiro(policial.telefone);
}

function bloquearFormularioPolicial() {
    document.querySelectorAll('#policialForm input, #policialForm select, #policialForm button')
        .forEach((controle) => {
            controle.disabled = true;
        });
}

function voltarParaListaPoliciais() {
    if (operacaoPolicialEmAndamento) return;
    const filtro = filtroUrlPoliciais === 'Inativo' ? 'Inativo' : 'Ativo';
    window.location.href = `policiais.html?filtro=${encodeURIComponent(filtro)}`;
}

function gerarIdPolicial(policiais) {
    const idsExistentes = new Set(
        policiais.map((policial) => String(policial?.id ?? '')).filter(Boolean)
    );

    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        let id = `policial_${window.crypto.randomUUID()}`;
        while (idsExistentes.has(id)) id = `policial_${window.crypto.randomUUID()}`;
        return id;
    }

    let sequencia = 0;
    let id;
    do {
        sequencia += 1;
        id = `policial_${Date.now()}_${sequencia}`;
    } while (idsExistentes.has(id));
    return id;
}

function limparValidacaoFormularioPolicial() {
    document.querySelectorAll('#policialForm [aria-invalid="true"]')
        .forEach((campo) => campo.removeAttribute('aria-invalid'));
}

function limparErroValidacaoPolicial(campo) {
    campo?.removeAttribute('aria-invalid');

    const feedback = document.getElementById('feedbackCadastroPolicial');
    if (feedback?.classList.contains('error')) {
        limparFeedbackPoliciais(feedback);
    }
}

function falharValidacaoPolicial(campo, mensagem) {
    mostrarFeedbackPoliciais(
        document.getElementById('feedbackCadastroPolicial'),
        'error',
        mensagem
    );
    if (campo) {
        campo.setAttribute('aria-invalid', 'true');
        campo.focus();
    }
    return null;
}

function lerDadosFormularioPolicial() {
    const campoPosto = document.getElementById('postoPolicial');
    const campoNome = document.getElementById('nomeGuerraPolicial');
    const campoRg = document.getElementById('rgPolicial');
    const campoTelefone = document.getElementById('telefonePolicial');

    const posto = String(campoPosto?.value || '').trim();
    const nomeGuerra = normalizarNomeGuerra(campoNome?.value);
    const rg = String(campoRg?.value || '').trim().toLocaleUpperCase('pt-BR');
    const rgNormalizado = normalizarRg(rg);
    const telefoneNormalizado = obterDigitosTelefone(campoTelefone?.value);

    if (!POSTOS_GRADUACOES_POLICIAIS.includes(posto)) {
        return falharValidacaoPolicial(campoPosto, 'Selecione o posto/graduação do policial.');
    }
    if (!nomeGuerra) {
        return falharValidacaoPolicial(campoNome, 'Informe o nome de guerra do policial.');
    }
    if (!rgNormalizado) {
        return falharValidacaoPolicial(campoRg, 'Informe o RG do policial.');
    }
    if (![10, 11].includes(telefoneNormalizado.length)) {
        return falharValidacaoPolicial(campoTelefone, 'Informe um telefone brasileiro válido, com DDD e 10 ou 11 dígitos.');
    }

    if (campoNome) campoNome.value = nomeGuerra;
    if (campoRg) campoRg.value = rg;
    if (campoTelefone) campoTelefone.value = formatarTelefoneBrasileiro(telefoneNormalizado);

    return {
        posto,
        nomeGuerra,
        rg,
        rgNormalizado,
        telefone: formatarTelefoneBrasileiro(telefoneNormalizado)
    };
}

function encontrarRgDuplicado(policiais, rgNormalizado, idIgnorado) {
    return policiais.some((policial) => {
        if (!policial || typeof policial !== 'object') return false;
        if (String(policial.id ?? '') === idIgnorado) return false;
        return normalizarRg(policial.rgNormalizado || policial.rg) === rgNormalizado;
    });
}

function definirFormularioPolicialProcessando(processando, editando) {
    const formulario = document.getElementById('policialForm');
    const botaoSalvar = document.getElementById('btnSalvarPolicial');
    const botaoCancelar = document.getElementById('btnCancelarEdicaoPolicial');

    formulario?.setAttribute('aria-busy', String(processando));
    ['postoPolicial', 'nomeGuerraPolicial', 'rgPolicial', 'telefonePolicial'].forEach((id) => {
        const campo = document.getElementById(id);
        if (campo) campo.disabled = processando;
    });

    document.querySelectorAll('.cadastro-form-actions button').forEach((botao) => {
        botao.disabled = processando;
    });

    if (botaoCancelar) botaoCancelar.disabled = processando;
    if (!botaoSalvar) return;

    botaoSalvar.disabled = processando;
    botaoSalvar.setAttribute('aria-busy', String(processando));
    if (processando) {
        botaoSalvar.innerHTML = `
            <span>${editando ? 'Atualizando...' : 'Salvando...'}</span>
            <span class="growing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        `;
    } else {
        botaoSalvar.textContent = editando ? 'Salvar alterações' : 'Salvar policial';
    }
}

async function salvarPolicial(evento) {
    evento.preventDefault();
    if (operacaoPolicialEmAndamento) return;

    const feedback = document.getElementById('feedbackCadastroPolicial');
    limparFeedbackPoliciais(feedback);
    limparValidacaoFormularioPolicial();

    const dados = lerDadosFormularioPolicial();
    if (!dados) return;

    let policiais;
    try {
        policiais = lerPoliciais();
    } catch (erro) {
        console.error('Erro ao ler os policiais antes do salvamento:', erro);
        mostrarFeedbackPoliciais(
            feedback,
            'error',
            'Não foi possível ler os cadastros atuais. Nenhum dado foi alterado.'
        );
        return;
    }

    if (encontrarRgDuplicado(policiais, dados.rgNormalizado, policialEmEdicaoId)) {
        falharValidacaoPolicial(
            document.getElementById('rgPolicial'),
            'Já existe um policial cadastrado com esse RG, inclusive entre os inativos.'
        );
        return;
    }

    const editando = Boolean(policialEmEdicaoId);
    if (editando && !policiais.some((policial) => String(policial?.id ?? '') === policialEmEdicaoId)) {
        mostrarFeedbackPoliciais(feedback, 'error', 'O policial selecionado para edição não foi encontrado.');
        return;
    }

    operacaoPolicialEmAndamento = true;
    definirFormularioPolicialProcessando(true, editando);
    await aguardarAtualizacaoVisualPoliciais();

    let mensagemSucesso = '';
    let filtroDestino = 'Ativo';
    try {
        policiais = lerPoliciais();
        if (encontrarRgDuplicado(policiais, dados.rgNormalizado, policialEmEdicaoId)) {
            falharValidacaoPolicial(
                document.getElementById('rgPolicial'),
                'Já existe um policial cadastrado com esse RG, inclusive entre os inativos.'
            );
            return;
        }

        const agora = new Date().toISOString();
        if (editando) {
            const indice = policiais.findIndex(
                (policial) => String(policial?.id ?? '') === policialEmEdicaoId
            );
            if (indice === -1) throw new Error('O policial não foi encontrado para atualização.');

            policiais[indice] = {
                ...policiais[indice],
                ...dados,
                id: policiais[indice].id,
                atualizadoEm: agora
            };
            filtroDestino = obterStatusPolicial(policiais[indice]);
            mensagemSucesso = `Cadastro de “${dados.nomeGuerra}” atualizado com sucesso.`;
        } else {
            policiais.push({
                id: gerarIdPolicial(policiais),
                ...dados,
                status: 'Ativo',
                criadoEm: agora,
                atualizadoEm: agora
            });
            mensagemSucesso = `Policial “${dados.nomeGuerra}” cadastrado com sucesso.`;
        }

        await salvarListaPoliciais(policiais);
    } catch (erro) {
        console.error('Erro ao salvar o policial:', erro);
        mensagemSucesso = '';
        mostrarFeedbackPoliciais(
            feedback,
            'error',
            erro.message === 'O policial não foi encontrado para atualização.'
                ? erro.message
                : 'Não foi possível salvar o policial. Tente novamente.'
        );
    } finally {
        operacaoPolicialEmAndamento = false;
        definirFormularioPolicialProcessando(false, editando);
    }

    if (!mensagemSucesso) return;

    const feedbackPreparado = salvarFeedbackNavegacaoPoliciais('success', mensagemSucesso);
    if (!feedbackPreparado) window.alert(mensagemSucesso);
    window.location.href = `policiais.html?filtro=${encodeURIComponent(filtroDestino)}`;
}

function aguardarAtualizacaoVisualPoliciais() {
    return new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
            return;
        }
        window.setTimeout(resolve, 16);
    });
}
