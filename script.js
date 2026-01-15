const form = document.getElementById('viaturaForm');
const listaViaturas = document.getElementById('listaViaturas');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');

// Estado do filtro
let statusFiltroAtual = 'Ativa';

document.addEventListener('DOMContentLoaded', () => {
    migrarViaturasAntigas();
    exibirViaturas();
});

// --- MIGRAÇÃO DE DADOS (Agora inclui a flag temRadio) ---
function migrarViaturasAntigas() {
    let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    let houveMudanca = false;

    viaturas.forEach(v => {
        // 1. Garante Status
        if (!v.status) {
            v.status = 'Ativa';
            houveMudanca = true;
        }
        // 2. Garante Tipo
        if (!v.tipo) {
            v.tipo = 'Carro';
            houveMudanca = true;
        }
        // 3. Garante a Flag Booleana de Rádio (NOVO)
        if (v.temRadio === undefined) {
            // Se existir texto no rádio, é true. Se for vazio/null, é false.
            v.temRadio = (v.radio && v.radio.trim() !== "") ? true : false;
            houveMudanca = true;
        }
    });

    if (houveMudanca) {
        localStorage.setItem('viaturas', JSON.stringify(viaturas));
        console.log("Banco de dados atualizado com flags de rádio.");
    }
}

// --- FILTRO ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    exibirViaturas();
}

// --- CRUD ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const index = parseInt(editIndexField.value);

    // Captura o valor do input rádio e remove espaços em branco extras
    const radioInputValor = document.getElementById('radio').value.trim();

    // Monta o objeto com a nova coluna booleana 'temRadio'
    const dadosForm = {
        tipo: document.getElementById('tipoVeiculo').value,
        prefixo: document.getElementById('prefixo').value,
        placa: document.getElementById('placa').value,
        radio: radioInputValor, 
        temRadio: (radioInputValor !== "") // Se tiver texto é true, se vazio é false
    };

    if (index === -1) {
        // Nova Viatura (nasce Ativa)
        const novaViatura = { ...dadosForm, status: 'Ativa' };
        viaturas.push(novaViatura);
    } else {
        // Edição (Preserva o status atual)
        const statusAtual = viaturas[index].status;
        viaturas[index] = { ...dadosForm, status: statusAtual };
        cancelarEdicao();
    }

    localStorage.setItem('viaturas', JSON.stringify(viaturas));
    form.reset();
    exibirViaturas();
});

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
            btnAcao = `<button class="btn-danger" onclick="alternarStatus(${v.originalIndex})" title="Tirar de operação">Inativar</button>`;
        } else {
            btnAcao = `<button class="btn-success" onclick="alternarStatus(${v.originalIndex})" title="Colocar em operação">Reativar</button>`;
        }

        let icone = ''; 
        if (v.tipo === 'Moto') icone = '';
        if (v.tipo === 'Bicicleta') icone = '';
        if (v.tipo === 'Triciclo') icone = '';

        // Usa a flag booleana ou o texto para decidir o que mostrar
        // Se temRadio for true, mostra o ID. Se false, mostra um traço.
        const radioVisual = v.temRadio ? `<span style="color:#1a237e; font-weight:bold;">${v.radio}</span>` : '<span style="color:#999;">-</span>';

        listaViaturas.innerHTML += `
            <tr>
                <td>${icone} ${v.tipo}</td>
                <td><strong>${v.prefixo}</strong></td>
                <td>${v.placa}</td>
                <td>${radioVisual}</td>
                <td><span class="status-pill ${classeStatus}">${v.status}</span></td>
                <td style="text-align: center;">
                    <button class="btn-warning" style="margin-right: 5px;" onclick="prepararEdicao(${v.originalIndex})">Editar</button>
                    ${btnAcao}
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
    document.getElementById('radio').value = v.radio; // Carrega o valor real (texto) para editar
    
    editIndexField.value = index;
    btnSalvar.innerText = "Atualizar Registro";
    btnSalvar.classList.remove('btn-primary');
    btnSalvar.classList.add('btn-info');
    
    btnCancelar.style.display = "inline-block";
    document.getElementById('tituloForm').innerText = "Editando Viatura " + v.prefixo;
}

function cancelarEdicao() {
    editIndexField.value = "-1";
    btnSalvar.innerText = "Salvar Registro";
    
    btnSalvar.classList.remove('btn-info');
    btnSalvar.classList.add('btn-primary');
    
    btnCancelar.style.display = "none";
    document.getElementById('tituloForm').innerText = "Cadastrar Nova Viatura";
    form.reset();
}

function alternarStatus(index) {
    let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const v = viaturas[index];
    
    const novoStatus = v.status === 'Ativa' ? 'Inativa' : 'Ativa';
    const acaoTexto = v.status === 'Ativa' ? 'inativar' : 'reativar';

    if(confirm(`Deseja realmente ${acaoTexto} a viatura ${v.prefixo}?`)) {
        viaturas[index].status = novoStatus;
        localStorage.setItem('viaturas', JSON.stringify(viaturas));
        exibirViaturas();
    }
}