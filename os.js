/**
 * LÓGICA DE GERENCIAMENTO DE OS COM LOCAL STORAGE E SUGESTÃO DE LOCAIS
 */

let listaAtividadesTemporaria = [];
let idEdicaoOS = -1;

document.addEventListener('DOMContentLoaded', () => {
    carregarOS();
    prepararNovoCadastro();
    carregarSugestoesLocais(); 
});

function carregarSugestoesLocais() {
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const datalist = document.getElementById('listaLocaisSugestao');
    datalist.innerHTML = '';

    locais.forEach(local => {
        const option = document.createElement('option');
        const textoSugestao = `[${local.apelido}] - ${local.rua}, ${local.numero || 'S/N'} - ${local.bairro}`;
        option.value = textoSugestao;
        datalist.appendChild(option);
    });
}

function prepararNovoCadastro() {
    listaAtividadesTemporaria = [];
    idEdicaoOS = -1;
    
    document.getElementById('formTitle').innerText = "Nova Ordem de Serviço";
    document.getElementById('btnFinalizar').innerText = "Finalizar e Gravar OS";
    
    document.getElementById('areaFracionamento').style.display = 'none';
    document.getElementById('btnCriarOS').style.display = 'inline-flex';
    
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
    
    // Limpa o campo de prescrições
    document.getElementById('prescricoesDiversas').value = '';
    
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

    if (ini >= fim) {
        alert("Erro no Turno Geral: A hora de início deve ser anterior ao término.");
        return;
    }

    document.getElementById('areaFracionamento').style.display = 'block';
    document.getElementById('btnCriarOS').style.display = 'none';
    
    const cabecalho = document.getElementById('cabecalhoOS');
    cabecalho.classList.add('container-resumo');

    const inputs = ['numOS', 'nomeOS', 'inicioGeral', 'terminoGeral'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.disabled = true;
        el.classList.add('modo-resumo');
    });
    
    carregarSugestoesLocais();
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

    if (ativ.inicio >= ativ.fim) {
        alert("Erro: O horário de início da atividade deve ser anterior ao fim.");
        return;
    }

    const temConflito = listaAtividadesTemporaria.some(item => {
        return (ativ.inicio < item.fim && ativ.fim > item.inicio);
    });

    if (temConflito) {
        alert("⚠️ Conflito Detectado!\nJá existe uma atividade cadastrada que ocupa esse horário.\nVerifique os horários e tente novamente.");
        return;
    }

    listaAtividadesTemporaria.push(ativ);

    listaAtividadesTemporaria.sort((a, b) => {
        if (a.inicio < b.inicio) return -1;
        if (a.inicio > b.inicio) return 1;
        return 0;
    });

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
        prescricoes: document.getElementById('prescricoesDiversas').value, // SALVANDO PRESCRIÇÕES
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
    
    // CARREGANDO PRESCRIÇÕES
    document.getElementById('prescricoesDiversas').value = os.prescricoes || '';

    listaAtividadesTemporaria = [...os.atividades];
    
    listaAtividadesTemporaria.sort((a, b) => {
        if (a.inicio < b.inicio) return -1;
        if (a.inicio > b.inicio) return 1;
        return 0;
    });

    renderizarTabelaAtividades();

    document.getElementById('formTitle').innerText = "Editando OS: " + os.numero;
    document.getElementById('btnFinalizar').innerText = "Atualizar OS";
    
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

    // Título
    doc.setFontSize(20);
    doc.setTextColor(26, 35, 126);
    doc.text(`ORDEM DE SERVIÇO Nº ${os.numero}`, 14, 20);
    
    // Dados Principais
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Missão: ${os.nomeOS}`, 14, 32);
    doc.text(`Período do Turno: ${os.inicioGeral} às ${os.terminoGeral}`, 14, 40);

    // Tabela
    const data = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
    doc.autoTable({
        startY: 48,
        head: [['Atividade', 'Início', 'Fim', 'Localização']],
        body: data,
        headStyles: { fillColor: [26, 35, 126] },
        theme: 'striped'
    });

    // Prescrições Diversas no PDF
    if(os.prescricoes) {
        let finalY = doc.lastAutoTable.finalY + 15; // Pega a posição onde a tabela acabou
        
        doc.setFontSize(14);
        doc.setTextColor(26, 35, 126);
        doc.text("Prescrições Diversas / Observações:", 14, finalY);
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        // Quebra o texto automaticamente para não sair da margem
        const splitText = doc.splitTextToSize(os.prescricoes, 180);
        doc.text(splitText, 14, finalY + 8);
    }

    doc.save(`SGF_OS_${os.numero}.pdf`);
}