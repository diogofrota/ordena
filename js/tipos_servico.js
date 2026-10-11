const STORAGE_KEY_TIPOS_SERVICO = 'tiposServico';

const formTipoServico = document.getElementById('tipoServicoForm');
const listaTiposServico = document.getElementById('listaTiposServico');
const btnSalvarTipoServico = document.getElementById('btnSalvar');

const parametrosTiposServico = new URLSearchParams(window.location.search);
const filtroUrlTiposServico = parametrosTiposServico.get('filtro');
const statusRetornoTiposServico = filtroUrlTiposServico === 'Inativa' ? 'Inativa' : 'Ativa';

let statusFiltroTiposServico = statusRetornoTiposServico;
let salvamentoTipoServicoEmAndamento = false;

document.addEventListener('DOMContentLoaded', () => {
    if (formTipoServico) {
        aplicarMascaraNomeServico();
        formTipoServico.addEventListener('submit', salvarTipoServico);
    }

    if (listaTiposServico) {
        atualizarBotoesFiltroTiposServico();
        exibirTiposServico();
    }
});

function normalizarNomeServico(valor) {
    return (valor || '').toString().trim().toUpperCase();
}

function escaparHtml(texto) {
    return (texto || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function obterTiposServico() {
    return JSON.parse(OrdenaStorage.getItem(STORAGE_KEY_TIPOS_SERVICO)) || [];
}

async function salvarTiposServico(lista) {
    await OrdenaStorage.setItem(STORAGE_KEY_TIPOS_SERVICO, JSON.stringify(lista));
}

function aplicarMascaraNomeServico() {
    document.getElementById('nomeServico')?.addEventListener('input', (e) => {
        e.target.value = normalizarNomeServico(e.target.value);
    });
}

function obterUrlListaTiposServico(status = statusRetornoTiposServico) {
    return status === 'Inativa'
        ? 'tipos_servico.html?filtro=Inativa'
        : 'tipos_servico.html';
}

function voltarParaListaTiposServico() {
    window.location.href = obterUrlListaTiposServico();
}

function atualizarEstadoBotaoSalvarTipoServico(processando) {
    if (!btnSalvarTipoServico) return;

    btnSalvarTipoServico.disabled = processando;
    btnSalvarTipoServico.innerText = processando ? 'Salvando...' : 'Salvar Registro';
}

async function salvarTipoServico(e) {
    e.preventDefault();
    if (salvamentoTipoServicoEmAndamento) return;

    const nome = normalizarNomeServico(document.getElementById('nomeServico').value);
    const descricao = document.getElementById('descricaoServico').value.trim();

    if (!nome) {
        alert("Informe o nome do serviço.");
        return;
    }

    if (!descricao) {
        alert("Informe a descrição.");
        return;
    }

    const tipos = obterTiposServico();
    const nomeDuplicado = tipos.some(item => normalizarNomeServico(item.nome) === nome);

    if (nomeDuplicado) {
        alert("Já existe um tipo de serviço com esse nome.");
        return;
    }

    const dados = {
        nome,
        descricao,
        atualizadoEm: new Date().toISOString()
    };

    salvamentoTipoServicoEmAndamento = true;
    atualizarEstadoBotaoSalvarTipoServico(true);

    tipos.push({
        ...dados,
        status: 'Ativa',
        criadoEm: new Date().toISOString()
    });

    try {
        await salvarTiposServico(tipos);
        alert("Tipo de serviço salvo com sucesso!");
        window.location.href = obterUrlListaTiposServico('Ativa');
    } catch (error) {
        console.error('Erro ao salvar tipo de serviço:', error);
        alert("Não foi possível salvar o tipo de serviço. Tente novamente.");
        salvamentoTipoServicoEmAndamento = false;
        atualizarEstadoBotaoSalvarTipoServico(false);
    }
}

function mudarFiltro(status) {
    statusFiltroTiposServico = status === 'Inativa' ? 'Inativa' : 'Ativa';
    atualizarBotoesFiltroTiposServico();
    exibirTiposServico();
}

function atualizarBotoesFiltroTiposServico() {
    const btnFiltroAtiva = document.getElementById('btnFiltroAtiva');
    const btnFiltroInativa = document.getElementById('btnFiltroInativa');

    if (btnFiltroAtiva) {
        const estaAtivo = statusFiltroTiposServico === 'Ativa';
        btnFiltroAtiva.classList.toggle('active', estaAtivo);
        btnFiltroAtiva.setAttribute('aria-pressed', String(estaAtivo));
    }

    if (btnFiltroInativa) {
        const estaAtivo = statusFiltroTiposServico === 'Inativa';
        btnFiltroInativa.classList.toggle('active', estaAtivo);
        btnFiltroInativa.setAttribute('aria-pressed', String(estaAtivo));
    }
}

function exibirTiposServico() {
    if (!listaTiposServico) return;

    const tipos = obterTiposServico();
    listaTiposServico.innerHTML = '';

    const filtrados = tipos
        .map((item, originalIndex) => ({ ...item, originalIndex }))
        .filter(item => (item.status || 'Ativa') === statusFiltroTiposServico)
        .sort((a, b) => normalizarNomeServico(a.nome).localeCompare(
            normalizarNomeServico(b.nome),
            'pt-BR',
            { numeric: true }
        ));

    if (filtrados.length === 0) {
        const statusExibicao = statusFiltroTiposServico === 'Ativa' ? 'ativo' : 'inativo';
        listaTiposServico.innerHTML = `
            <tr class="tipos-servico-empty-row">
                <td colspan="4">Nenhum tipo de serviço ${statusExibicao} encontrado.</td>
            </tr>
        `;
        return;
    }

    filtrados.forEach(item => {
        const status = item.status || 'Ativa';
        const classeStatus = status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        const btnAcao = status === 'Ativa'
            ? `<button type="button" class="btn-danger" onclick="alternarStatus(${item.originalIndex})">Inativar</button>`
            : `<button type="button" class="btn-success" onclick="alternarStatus(${item.originalIndex})">Reativar</button>`;

        listaTiposServico.innerHTML += `
            <tr>
                <td data-label="Nome"><strong>${escaparHtml(item.nome)}</strong></td>
                <td data-label="Descrição" class="descricao-cell">${escaparHtml(item.descricao)}</td>
                <td data-label="Status"><span class="status-pill ${classeStatus}">${status}</span></td>
                <td data-label="Ações" style="text-align:center;">
                    <div class="acoes-tipo-servico">
                        ${btnAcao}
                    </div>
                </td>
            </tr>
        `;
    });
}

async function alternarStatus(index) {
    const tipos = obterTiposServico();
    const item = tipos[index];
    if (!item) return;

    const novoStatus = (item.status || 'Ativa') === 'Ativa' ? 'Inativa' : 'Ativa';
    if (!confirm(`Alterar status do tipo "${item.nome}" para ${novoStatus}?`)) return;

    tipos[index].status = novoStatus;
    tipos[index].atualizadoEm = new Date().toISOString();

    try {
        await salvarTiposServico(tipos);
        alert(novoStatus === 'Ativa'
            ? "Tipo de serviço reativado com sucesso!"
            : "Tipo de serviço inativado com sucesso!");
        exibirTiposServico();
    } catch (error) {
        console.error('Erro ao alterar status do tipo de serviço:', error);
        alert("Não foi possível alterar o status do tipo de serviço. Tente novamente.");
    }
}
