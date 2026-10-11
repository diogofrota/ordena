// Elementos do DOM (Específicos para Viaturas)
let form = null;
let listaViaturas = null;

// Estado do filtro
const filtroUrl = new URLSearchParams(window.location.search).get('filtro');
let statusFiltroAtual = filtroUrl === 'Inativa' ? 'Inativa' : 'Ativa';

document.addEventListener('DOMContentLoaded', () => {
    form = document.getElementById('viaturaForm');
    listaViaturas = document.getElementById('listaViaturas');

    if (listaViaturas) {
        atualizarBotoesFiltro();
        exibirViaturas();
    }

    if (form) {
        aplicarMascaras();
        configurarModeloPorTipo();
        form.addEventListener('submit', salvarViatura);
    }
});

// --- MÁSCARAS E VALIDAÇÕES ---
function configurarModeloPorTipo() {
    const tipoVeiculo = document.getElementById('tipoVeiculo');
    const modelo = document.getElementById('modelo');

    if (!tipoVeiculo || !modelo) return;

    const atualizarEstadoModelo = () => {
        const carroSelecionado = tipoVeiculo.value === 'Carro';

        modelo.disabled = !carroSelecionado;
        modelo.setAttribute('aria-disabled', String(!carroSelecionado));

        if (!carroSelecionado) {
            modelo.value = '';
        }
    };

    tipoVeiculo.addEventListener('change', atualizarEstadoModelo);
    atualizarEstadoModelo();
}

function aplicarMascaras() {
    // 1. PLACA: Maiúsculas e limita tamanho
    const inputPlaca = document.getElementById('placa');
    if (inputPlaca) {
        inputPlaca.addEventListener('input', function(e) {
            let valor = e.target.value.toUpperCase();
            valor = valor.replace(/[^A-Z0-9-]/g, ''); // Apenas Letras, Números e Traço
            if (valor.length > 8) valor = valor.slice(0, 8);
            e.target.value = valor;
        });
    }

    // 2. RÁDIO: Apenas números
    const inputRadio = document.getElementById('radio');
    if (inputRadio) {
        inputRadio.addEventListener('input', function(e) {
            let valor = e.target.value.replace(/\D/g, ''); // Remove não números
            if (valor.length > 7) valor = valor.slice(0, 7);
            e.target.value = valor;
        });
    }
}

// --- CRUD (SALVAR) ---
async function salvarViatura(e) {
    e.preventDefault();

    // Validação de Placa
    const placa = document.getElementById('placa').value;
    const placaLimpa = placa.replace('-', '');
    if (placaLimpa.length < 7) {
        alert("Erro: A Placa deve conter no mínimo 7 caracteres.");
        return;
    }

    let viaturas = JSON.parse(OrdenaStorage.getItem('viaturas')) || [];
    const tipoVeiculoValor = document.getElementById('tipoVeiculo').value;
    const modeloInput = document.getElementById('modelo');
    const modeloInputValor = tipoVeiculoValor === 'Carro' ? modeloInput.value.trim() : '';
    const radioInputValor = document.getElementById('radio').value.trim();

    if (tipoVeiculoValor === 'Carro' && !modeloInputValor) {
        alert("Erro: Informe o modelo da viatura.");
        modeloInput.focus();
        return;
    }

    const dadosForm = {
        tipo: tipoVeiculoValor,
        modelo: modeloInputValor,
        prefixo: document.getElementById('prefixo').value,
        placa: placa,
        radio: radioInputValor,
        temRadio: (radioInputValor !== "")
    };

    const novaViatura = { ...dadosForm, status: 'Ativa' };
    viaturas.push(novaViatura);

    try {
        await OrdenaStorage.setItem('viaturas', JSON.stringify(viaturas));
    } catch (erro) {
        window.OrdenaApi.feedback(erro.message, 'error');
        return;
    }
    form.reset();
    alert("Viatura salva com sucesso!");
    window.location.href = 'cadastro.html';
}

// --- LISTAGEM E FILTROS ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    atualizarBotoesFiltro();
    exibirViaturas();
}

function atualizarBotoesFiltro() {
    const btnFiltroAtiva = document.getElementById('btnFiltroAtiva');
    const btnFiltroInativa = document.getElementById('btnFiltroInativa');

    if (btnFiltroAtiva) {
        const estaAtivo = statusFiltroAtual === 'Ativa';
        btnFiltroAtiva.classList.toggle('active', estaAtivo);
        btnFiltroAtiva.setAttribute('aria-pressed', String(estaAtivo));
    }

    if (btnFiltroInativa) {
        const estaAtivo = statusFiltroAtual === 'Inativa';
        btnFiltroInativa.classList.toggle('active', estaAtivo);
        btnFiltroInativa.setAttribute('aria-pressed', String(estaAtivo));
    }
}

function exibirViaturas() {
    if (!listaViaturas) return;

    const viaturas = JSON.parse(OrdenaStorage.getItem('viaturas')) || [];
    listaViaturas.innerHTML = '';

    const viaturasFiltradas = viaturas
        .map((v, i) => ({ ...v, originalIndex: i }))
        .filter(v => v.status === statusFiltroAtual);

    if (viaturasFiltradas.length === 0) {
        listaViaturas.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#666;">Nenhuma viatura ${statusFiltroAtual.toLowerCase()} encontrada.</td></tr>`;
        return;
    }

    viaturasFiltradas.forEach((v) => {
        const classeStatus = v.status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        
        let btnAcao = '';
        if (v.status === 'Ativa') {
            btnAcao = `<button class="btn-danger" onclick="alternarStatus(${v.originalIndex})">Inativar</button>`;
        } else {
            btnAcao = `<button class="btn-success" onclick="alternarStatus(${v.originalIndex})">Reativar</button>`;
        }

        // let icone = v.tipo === 'Moto' ? '🏍️' : '🚓';
        const modeloVisual = typeof v.modelo === 'string' && v.modelo.trim() ? v.modelo : '-';
        const radioVisual = v.temRadio ? `<span style="color:#1a237e; font-weight:bold;">${v.radio}</span>` : '<span style="color:#999;">-</span>';

        // --- AQUI ESTÁ O LAYOUT RESPONSIVO (data-label) ---
        listaViaturas.innerHTML += `
            <tr>
                <td data-label="Tipo">${v.tipo}</td>
                <td data-label="Modelo">${modeloVisual}</td>
                <td data-label="Prefixo"><strong>${v.prefixo}</strong></td>
                <td data-label="Placa">${v.placa}</td>
                <td data-label="Rádio">${radioVisual}</td>
                <td data-label="Status"><span class="status-pill ${classeStatus}">${v.status}</span></td>
                <td data-label="Ações" style="text-align: center;">
                    <div class="acoes-viatura">
                        ${btnAcao}
                    </div>
                </td>
            </tr>
        `;
    });
}

async function alternarStatus(index) {
    const viaturas = JSON.parse(OrdenaStorage.getItem('viaturas')) || [];
    const v = viaturas[index];
    if (!v) return;
    const novoStatus = v.status === 'Ativa' ? 'Inativa' : 'Ativa';
    if (confirm(`Alterar status da viatura ${v.prefixo}?`)) {
        viaturas[index].status = novoStatus;
        try {
            await OrdenaStorage.setItem('viaturas', JSON.stringify(viaturas));
            exibirViaturas();
        } catch (erro) {
            window.OrdenaApi.feedback(erro.message, 'error');
        }
    }
}
