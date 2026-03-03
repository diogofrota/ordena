const STORAGE_KEY_TIPOS_SERVICO = 'tiposServico';

const formTipoServico = document.getElementById('tipoServicoForm');
const listaTiposServico = document.getElementById('listaTiposServico');
const editIndexFieldTipoServico = document.getElementById('editIndex');
const btnSalvarTipoServico = document.getElementById('btnSalvar');
const btnCancelarTipoServico = document.getElementById('btnCancelar');

let statusFiltroTiposServico = 'Ativa';

document.addEventListener('DOMContentLoaded', () => {
    aplicarMascaraNomeServico();
    exibirTiposServico();
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
    return JSON.parse(localStorage.getItem(STORAGE_KEY_TIPOS_SERVICO)) || [];
}

function salvarTiposServico(lista) {
    localStorage.setItem(STORAGE_KEY_TIPOS_SERVICO, JSON.stringify(lista));
}

function aplicarMascaraNomeServico() {
    const input = document.getElementById('nomeServico');
    if (!input) return;

    input.addEventListener('input', (e) => {
        e.target.value = normalizarNomeServico(e.target.value);
    });
}

formTipoServico.addEventListener('submit', (e) => {
    e.preventDefault();

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
    const indexEdicao = parseInt(editIndexFieldTipoServico.value, 10);

    const nomeDuplicado = tipos.some((item, idx) =>
        idx !== indexEdicao && normalizarNomeServico(item.nome) === nome
    );

    if (nomeDuplicado) {
        alert("Já existe um tipo de serviço com esse nome.");
        return;
    }

    const dados = {
        nome,
        descricao,
        atualizadoEm: new Date().toISOString()
    };

    if (indexEdicao === -1) {
        tipos.push({
            ...dados,
            status: 'Ativa',
            criadoEm: new Date().toISOString()
        });
    } else {
        const registroAtual = tipos[indexEdicao];
        if (!registroAtual) {
            alert("Registro não encontrado para edição.");
            cancelarEdicao();
            exibirTiposServico();
            return;
        }

        tipos[indexEdicao] = {
            ...registroAtual,
            ...dados
        };
        cancelarEdicao();
    }

    salvarTiposServico(tipos);
    formTipoServico.reset();
    document.getElementById('nomeServico').value = '';
    alert("Tipo de serviço salvo com sucesso!");
    exibirTiposServico();
});

function mudarFiltro(status) {
    statusFiltroTiposServico = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    exibirTiposServico();
}

function exibirTiposServico() {
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
        listaTiposServico.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color:#666; padding:20px;">
                    Nenhum tipo de serviço ${statusFiltroTiposServico.toLowerCase()} encontrado.
                </td>
            </tr>
        `;
        return;
    }

    filtrados.forEach(item => {
        const status = item.status || 'Ativa';
        const classeStatus = status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        const btnAcao = status === 'Ativa'
            ? `<button class="btn-danger" onclick="alternarStatus(${item.originalIndex})">Inativar</button>`
            : `<button class="btn-success" onclick="alternarStatus(${item.originalIndex})">Reativar</button>`;

        listaTiposServico.innerHTML += `
            <tr>
                <td data-label="Nome"><strong>${escaparHtml(item.nome)}</strong></td>
                <td data-label="Descrição" class="descricao-cell">${escaparHtml(item.descricao)}</td>
                <td data-label="Status"><span class="status-pill ${classeStatus}">${status}</span></td>
                <td data-label="Ações" style="text-align:center;">
                    <div style="display:flex; gap:5px; justify-content:flex-end;">
                        <button class="btn-warning" onclick="prepararEdicao(${item.originalIndex})">Editar</button>
                        ${btnAcao}
                    </div>
                </td>
            </tr>
        `;
    });
}

function prepararEdicao(index) {
    const tipos = obterTiposServico();
    const item = tipos[index];
    if (!item) return;

    document.getElementById('nomeServico').value = normalizarNomeServico(item.nome);
    document.getElementById('descricaoServico').value = item.descricao || '';

    editIndexFieldTipoServico.value = index;
    btnSalvarTipoServico.innerText = "Atualizar Registro";
    btnSalvarTipoServico.classList.remove('btn-primary');
    btnSalvarTipoServico.classList.add('btn-info');

    if (btnCancelarTipoServico) btnCancelarTipoServico.style.display = 'inline-block';

    document.querySelector('.card-container-main').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicao() {
    editIndexFieldTipoServico.value = '-1';
    btnSalvarTipoServico.innerText = "Salvar Registro";
    btnSalvarTipoServico.classList.remove('btn-info');
    btnSalvarTipoServico.classList.add('btn-primary');
    if (btnCancelarTipoServico) btnCancelarTipoServico.style.display = 'none';
    formTipoServico.reset();
    document.getElementById('nomeServico').value = '';
}

function alternarStatus(index) {
    const tipos = obterTiposServico();
    const item = tipos[index];
    if (!item) return;

    const novoStatus = (item.status || 'Ativa') === 'Ativa' ? 'Inativa' : 'Ativa';
    if (!confirm(`Alterar status do tipo "${item.nome}" para ${novoStatus}?`)) return;

    tipos[index].status = novoStatus;
    tipos[index].atualizadoEm = new Date().toISOString();
    salvarTiposServico(tipos);
    exibirTiposServico();
}
