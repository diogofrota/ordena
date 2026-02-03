// Elementos do DOM (Específicos para Viaturas)
const form = document.getElementById('viaturaForm');
const listaViaturas = document.getElementById('listaViaturas');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');

// Estado do filtro
let statusFiltroAtual = 'Ativa';

document.addEventListener('DOMContentLoaded', () => {
    exibirViaturas();
    aplicarMascaras();
});

// --- MÁSCARAS E VALIDAÇÕES ---
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
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Validação de Placa
    const placa = document.getElementById('placa').value;
    const placaLimpa = placa.replace('-', '');
    if (placaLimpa.length < 7) {
        alert("Erro: A Placa deve conter no mínimo 7 caracteres.");
        return;
    }

    let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const index = parseInt(editIndexField.value);
    const radioInputValor = document.getElementById('radio').value.trim();

    const dadosForm = {
        tipo: document.getElementById('tipoVeiculo').value,
        prefixo: document.getElementById('prefixo').value,
        placa: placa,
        radio: radioInputValor, 
        temRadio: (radioInputValor !== "") 
    };

    if (index === -1) {
        // Nova Viatura
        const novaViatura = { ...dadosForm, status: 'Ativa' };
        viaturas.push(novaViatura);
    } else {
        // Edição (Mantém o status original)
        const statusAtual = viaturas[index].status;
        viaturas[index] = { ...dadosForm, status: statusAtual };
        cancelarEdicao();
    }

    localStorage.setItem('viaturas', JSON.stringify(viaturas));
    form.reset();
    alert("Viatura salva com sucesso!");
    exibirViaturas();
});

// --- LISTAGEM E FILTROS ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    exibirViaturas();
}

function exibirViaturas() {
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    listaViaturas.innerHTML = '';

    const viaturasFiltradas = viaturas
        .map((v, i) => ({ ...v, originalIndex: i }))
        .filter(v => v.status === statusFiltroAtual);

    if (viaturasFiltradas.length === 0) {
        listaViaturas.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#666;">Nenhuma viatura ${statusFiltroAtual.toLowerCase()} encontrada.</td></tr>`;
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

        let icone = v.tipo === 'Moto' ? '🏍️' : '🚓';
        const radioVisual = v.temRadio ? `<span style="color:#1a237e; font-weight:bold;">${v.radio}</span>` : '<span style="color:#999;">-</span>';

        // --- AQUI ESTÁ O LAYOUT RESPONSIVO (data-label) ---
        listaViaturas.innerHTML += `
            <tr>
                <td data-label="Tipo">${icone} ${v.tipo}</td>
                <td data-label="Prefixo"><strong>${v.prefixo}</strong></td>
                <td data-label="Placa">${v.placa}</td>
                <td data-label="Rádio">${radioVisual}</td>
                <td data-label="Status"><span class="status-pill ${classeStatus}">${v.status}</span></td>
                <td data-label="Ações" style="text-align: center;">
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                        <button class="btn-warning" onclick="prepararEdicao(${v.originalIndex})">Editar</button>
                        ${btnAcao}
                    </div>
                </td>
            </tr>
        `;
    });
}

function prepararEdicao(index) {
    const viaturas = JSON.parse(localStorage.getItem('viaturas'));
    const v = viaturas[index];

    document.getElementById('tipoVeiculo').value = v.tipo;
    document.getElementById('prefixo').value = v.prefixo;
    document.getElementById('placa').value = v.placa;
    document.getElementById('radio').value = v.radio; 
    
    editIndexField.value = index;
    btnSalvar.innerText = "Atualizar Registro";
    btnSalvar.classList.remove('btn-primary');
    btnSalvar.classList.add('btn-info');
    
    // Mostra o botão cancelar
    if(btnCancelar) btnCancelar.style.display = "inline-block";
    
    // Rola para o topo
    document.querySelector('.card-container-main').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicao() {
    editIndexField.value = "-1";
    btnSalvar.innerText = "Salvar Registro";
    btnSalvar.classList.remove('btn-info');
    btnSalvar.classList.add('btn-primary');
    if (btnCancelar) btnCancelar.style.display = "none";
    form.reset();
}

function alternarStatus(index) {
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const v = viaturas[index];
    if (!v) return;
    const novoStatus = v.status === 'Ativa' ? 'Inativa' : 'Ativa';
    if (confirm(`Alterar status da viatura ${v.prefixo}?`)) {
        viaturas[index].status = novoStatus;
        localStorage.setItem('viaturas', JSON.stringify(viaturas));
        exibirViaturas();
    }
}
