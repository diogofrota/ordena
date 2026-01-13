const form = document.getElementById('viaturaForm');
const listaViaturas = document.getElementById('listaViaturas');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');

// Estado do filtro
let statusFiltroAtual = 'Ativa';

document.addEventListener('DOMContentLoaded', () => {
    migrarViaturasAntigas(); // Garante que dados antigos tenham status
    exibirViaturas();
});

// --- MIGRAÇÃO DE DADOS ---
function migrarViaturasAntigas() {
    let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    let houveMudanca = false;

    viaturas.forEach(v => {
        if (!v.status) {
            v.status = 'Ativa'; // Define padrão para antigas
            houveMudanca = true;
        }
    });

    if (houveMudanca) {
        localStorage.setItem('viaturas', JSON.stringify(viaturas));
    }
}

// --- FILTRO ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    
    // Atualiza visual dos botões
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    
    exibirViaturas();
}

// --- CRUD ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const index = parseInt(editIndexField.value);

    // Captura dados do form
    const dadosForm = {
        prefixo: document.getElementById('prefixo').value,
        placa: document.getElementById('placa').value,
        radio: document.getElementById('radio').value
    };

    if (index === -1) {
        // Nova Viatura (sempre nasce Ativa)
        const novaViatura = { ...dadosForm, status: 'Ativa' };
        viaturas.push(novaViatura);
    } else {
        // Edição (Mantém o status que já tinha)
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

    // Filtra e mapeia índice original para edição correta
    const viaturasFiltradas = viaturas
        .map((v, i) => ({ ...v, originalIndex: i }))
        .filter(v => v.status === statusFiltroAtual);

    if (viaturasFiltradas.length === 0) {
        listaViaturas.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666;">Nenhuma viatura ${statusFiltroAtual.toLowerCase()} encontrada.</td></tr>`;
        return;
    }

    viaturasFiltradas.forEach((v) => {
        const classeStatus = v.status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        
        // Define o botão de ação (Inativar ou Reativar)
        let btnAcao = '';
        if (v.status === 'Ativa') {
            btnAcao = `<button class="btn-danger" onclick="alternarStatus(${v.originalIndex})" title="Tirar de operação">Inativar</button>`;
        } else {
            btnAcao = `<button class="btn-success" onclick="alternarStatus(${v.originalIndex})" title="Colocar em operação">Reativar</button>`;
        }

        listaViaturas.innerHTML += `
            <tr>
                <td>${v.prefixo}</td>
                <td>${v.placa}</td>
                <td>${v.radio}</td>
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

    document.getElementById('prefixo').value = v.prefixo;
    document.getElementById('placa').value = v.placa;
    document.getElementById('radio').value = v.radio;
    
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

// Substitui excluirViatura por alternarStatus
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