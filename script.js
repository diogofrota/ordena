const form = document.getElementById('viaturaForm');
const listaViaturas = document.getElementById('listaViaturas');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');

document.addEventListener('DOMContentLoaded', exibirViaturas);

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const viatura = {
        prefixo: document.getElementById('prefixo').value,
        placa: document.getElementById('placa').value,
        radio: document.getElementById('radio').value
    };

    let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const index = parseInt(editIndexField.value);

    if (index === -1) {
        viaturas.push(viatura);
    } else {
        viaturas[index] = viatura;
        cancelarEdicao();
    }

    localStorage.setItem('viaturas', JSON.stringify(viaturas));
    form.reset();
    exibirViaturas();
});

function exibirViaturas() {
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    listaViaturas.innerHTML = '';

    viaturas.forEach((v, index) => {
        listaViaturas.innerHTML += `
            <tr>
                <td>${v.prefixo}</td>
                <td>${v.placa}</td>
                <td>${v.radio}</td>
                <td>
                    <button class="btn-warning" style="margin-right: 5px;" onclick="prepararEdicao(${index})">Editar</button>
                    <button class="btn-danger" onclick="excluirViatura(${index})">Excluir</button>
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
    btnSalvar.innerText = "Atualizar Viatura";
    btnSalvar.classList.remove('btn-primary'); // Troca cor do botão
    btnSalvar.classList.add('btn-info');
    
    btnCancelar.style.display = "inline-block";
    document.getElementById('tituloForm').innerText = "Editando Viatura";
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

function excluirViatura(index) {
    if(confirm("Deseja excluir esta viatura?")) {
        let viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
        viaturas.splice(index, 1);
        localStorage.setItem('viaturas', JSON.stringify(viaturas));
        exibirViaturas();
    }
}