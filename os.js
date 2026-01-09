/**
 * LÓGICA DE GERENCIAMENTO DE OS COM LOCAL STORAGE
 */

let listaAtividadesTemporaria = [];
let idEdicaoOS = -1;

document.addEventListener('DOMContentLoaded', () => {
    carregarOS();
    prepararNovoCadastro();
});

function prepararNovoCadastro() {
    listaAtividadesTemporaria = [];
    idEdicaoOS = -1;
    
    document.getElementById('formTitle').innerText = "Nova Ordem de Serviço";
    document.getElementById('btnFinalizar').innerText = "Finalizar e Gravar OS";
    
    // Esconde área de fracionamento
    document.getElementById('areaFracionamento').style.display = 'none';
    document.getElementById('btnCriarOS').style.display = 'inline-flex'; // Volta o botão
    
    // Reseta visual do cabeçalho (remove modo resumo)
    const cabecalho = document.getElementById('cabecalhoOS');
    cabecalho.classList.remove('container-resumo');
    
    const inputs = ['numOS', 'nomeOS', 'inicioGeral', 'terminoGeral'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.disabled = false;
        el.classList.remove('modo-resumo');
    });

    const proxima = localStorage.getItem('proximoOS') || 1001;
    document.getElementById('numOS').value = proxima;
    
    document.getElementById('nomeOS').value = '';
    document.getElementById('inicioGeral').value = '';
    document.getElementById('terminoGeral').value = '';
    renderizarTabelaAtividades();
}

function liberarFracionamento() {
    const nome = document.getElementById('nomeOS').value;
    const ini = document.getElementById('inicioGeral').value;
    const fim = document.getElementById('terminoGeral').value;

    if(!nome || !ini || !fim) {
        alert("Por favor, preencha a Missão e o Turno Geral.");
        return;
    }

    document.getElementById('areaFracionamento').style.display = 'block';
    document.getElementById('btnCriarOS').style.display = 'none';
    
    // Aplica visual de "Resumo"
    const cabecalho = document.getElementById('cabecalhoOS');
    cabecalho.classList.add('container-resumo');

    const inputs = ['numOS', 'nomeOS', 'inicioGeral', 'terminoGeral'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.disabled = true;
        el.classList.add('modo-resumo');
    });
}

function adicionarFracao() {
    const ativ = {
        tipo: document.getElementById('tipoAtividade').value,
        inicio: document.getElementById('inicioFracao').value,
        fim: document.getElementById('terminoFracao').value,
        local: document.getElementById('localAtividade').value
    };

    if (!ativ.inicio || !ativ.fim || !ativ.local) {
        alert("Preencha todos os campos da atividade.");
        return;
    }

    listaAtividadesTemporaria.push(ativ);
    renderizarTabelaAtividades();
    
    document.getElementById('inicioFracao').value = '';
    document.getElementById('terminoFracao').value = '';
    document.getElementById('localAtividade').value = '';
}

function renderizarTabelaAtividades() {
    const tbody = document.getElementById('tabelaFracoesTemp');
    tbody.innerHTML = '';
    listaAtividadesTemporaria.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${item.tipo}</td>
                <td>${item.inicio}</td>
                <td>${item.fim}</td>
                <td>${item.local}</td>
                <td style="text-align: center;">
                    <button class="btn-danger" style="padding: 5px 10px; height: 35px;" onclick="removerFracao(${index})">X</button>
                </td>
            </tr>`;
    });
}

function removerFracao(index) {
    listaAtividadesTemporaria.splice(index, 1);
    renderizarTabelaAtividades();
}

function finalizarOS() {
    if (listaAtividadesTemporaria.length === 0) {
        alert("Adicione ao menos uma atividade antes de finalizar.");
        return;
    }

    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    
    const dadosOS = {
        numero: document.getElementById('numOS').value,
        nomeOS: document.getElementById('nomeOS').value,
        inicioGeral: document.getElementById('inicioGeral').value,
        terminoGeral: document.getElementById('terminoGeral').value,
        atividades: listaAtividadesTemporaria
    };

    if (idEdicaoOS === -1) {
        bancoOS.push(dadosOS);
        localStorage.setItem('proximoOS', parseInt(dadosOS.numero) + 1);
    } else {
        bancoOS[idEdicaoOS] = dadosOS;
    }

    localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
    alert("Ordem de Serviço gravada com sucesso!");
    prepararNovoCadastro();
    carregarOS();
}

function carregarOS() {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const tbody = document.getElementById('corpoTabelaOS');
    tbody.innerHTML = '';

    bancoOS.forEach((os, index) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${os.numero}</b></td>
                <td>${os.nomeOS}</td>
                <td>${os.inicioGeral} - ${os.terminoGeral}</td>
                <td style="text-align: center;">
                    <div class="btn-action-group" style="display:flex; justify-content:center; gap:5px;">
                        <button class="btn-info" onclick="gerarPDF(${index})" style="padding: 0 10px;">PDF</button>
                        <button class="btn-warning" onclick="editarOS(${index})" style="padding: 0 10px;">Editar</button>
                        <button class="btn-danger" onclick="deletarOS(${index})" style="padding: 0 10px;">Excluir</button>
                    </div>
                </td>
            </tr>`;
    });
}

function editarOS(index) {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = bancoOS[index];
    
    idEdicaoOS = index;

    document.getElementById('numOS').value = os.numero;
    document.getElementById('nomeOS').value = os.nomeOS;
    document.getElementById('inicioGeral').value = os.inicioGeral;
    document.getElementById('terminoGeral').value = os.terminoGeral;

    listaAtividadesTemporaria = [...os.atividades];
    renderizarTabelaAtividades();

    document.getElementById('formTitle').innerText = "Editando OS: " + os.numero;
    document.getElementById('btnFinalizar').innerText = "Atualizar OS";
    
    // Força a liberação do fracionamento e aplica o visual
    liberarFracionamento();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deletarOS(index) {
    if (confirm("Deseja excluir definitivamente esta OS?")) {
        let bancoOS = JSON.parse(localStorage.getItem('ordensServico'));
        bancoOS.splice(index, 1);
        localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
        carregarOS();
    }
}

function gerarPDF(index) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const os = JSON.parse(localStorage.getItem('ordensServico'))[index];

    doc.setFontSize(20);
    doc.setTextColor(26, 35, 126);
    doc.text(`ORDEM DE SERVIÇO Nº ${os.numero}`, 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Missão: ${os.nomeOS}`, 14, 32);
    doc.text(`Período do Turno: ${os.inicioGeral} às ${os.terminoGeral}`, 14, 40);

    const data = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
    doc.autoTable({
        startY: 48,
        head: [['Atividade', 'Início', 'Fim', 'Localização']],
        body: data,
        headStyles: { fillColor: [26, 35, 126] },
        theme: 'striped'
    });

    doc.save(`SGF_OS_${os.numero}.pdf`);
}