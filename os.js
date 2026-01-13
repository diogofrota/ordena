/**
 * LÓGICA DE GERENCIAMENTO DE OS COM VERSIONAMENTO E AUDITORIA
 */

let listaAtividadesTemporaria = [];
let idEdicaoOS = -1; 
let statusFiltroAtual = 'Ativa'; 

document.addEventListener('DOMContentLoaded', () => {
    migrarDadosAntigos(); 
    carregarOS();
    prepararNovoCadastro();
    carregarSugestoesLocais(); 
});

function migrarDadosAntigos() {
    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    let houveMudanca = false;

    bancoOS.forEach(os => {
        if (!os.status) {
            os.status = 'Ativa'; 
            os.dataCriacao = new Date().toISOString(); 
            os.dataEncerramento = null;
            houveMudanca = true;
        }
    });

    if (houveMudanca) {
        localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
    }
}

function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    carregarOS();
}

function carregarSugestoesLocais() {
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const datalist = document.getElementById('listaLocaisSugestao');
    datalist.innerHTML = '';

    const locaisAtivos = locais.filter(l => l.status === 'Ativo');

    locaisAtivos.forEach(local => {
        const option = document.createElement('option');
        const textoSugestao = `[${local.apelido}] - ${local.rua}, ${local.numero || 'S/N'} - ${local.bairro}`;
        option.value = textoSugestao;
        datalist.appendChild(option);
    });
}

// --- CONTROLE VISUAL DO FORMULÁRIO ---

function prepararNovoCadastro() {
    listaAtividadesTemporaria = [];
    idEdicaoOS = -1;
    
    document.getElementById('formTitle').innerText = "Nova Ordem de Serviço";
    document.getElementById('btnFinalizar').innerText = "Finalizar e Gravar OS";
    
    // Reseta inputs e estado
    cancelarCriacao();

    const proxima = localStorage.getItem('proximoOS') || 1001;
    document.getElementById('numOS').value = proxima;
    
    document.getElementById('nomeOS').value = '';
    document.getElementById('inicioGeral').value = '';
    document.getElementById('terminoGeral').value = '';
    document.getElementById('prescricoesDiversas').value = '';
    
    renderizarTabelaAtividades();
}

// Botão "Criar OS e Fracionar" aciona isso:
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

    // 1. TRAVAR INPUTS
    const inputs = ['nomeOS', 'inicioGeral', 'terminoGeral'];
    inputs.forEach(id => document.getElementById(id).disabled = true);

    // 2. MOSTRAR ÁREA INFERIOR
    document.getElementById('areaFracionamento').style.display = 'block';

    // 3. TRANSFORMAR BOTÃO EM "CANCELAR"
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Cancelar";
    btn.className = "btn-cancelar"; // Classe cinza definida no CSS
    btn.setAttribute('onclick', 'cancelarCriacao()'); // Muda a função do clique

    carregarSugestoesLocais();
}

// Botão "Cancelar" aciona isso:
function cancelarCriacao() {
    // 1. DESTRAVAR INPUTS
    const inputs = ['nomeOS', 'inicioGeral', 'terminoGeral'];
    inputs.forEach(id => document.getElementById(id).disabled = false);

    // 2. ESCONDER ÁREA INFERIOR
    document.getElementById('areaFracionamento').style.display = 'none';

    // 3. RESTAURAR BOTÃO ORIGINAL
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Criar OS e Fracionar";
    btn.className = "btn-primary"; // Volta a ser azul
    btn.setAttribute('onclick', 'liberarFracionamento()'); // Volta função original
}

// --- LÓGICA DE ATIVIDADES ---

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
        alert("⚠️ Conflito Detectado!\nJá existe uma atividade cadastrada que ocupa esse horário.");
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
    let numeroParaSalvar = document.getElementById('numOS').value;
    const dataAgora = new Date().toISOString();

    const dadosFormulario = {
        nomeOS: document.getElementById('nomeOS').value,
        inicioGeral: document.getElementById('inicioGeral').value,
        terminoGeral: document.getElementById('terminoGeral').value,
        prescricoes: document.getElementById('prescricoesDiversas').value,
        atividades: listaAtividadesTemporaria,
        status: 'Ativa',
        dataCriacao: dataAgora,
        dataEncerramento: null
    };

    if (idEdicaoOS === -1) {
        const novoObj = {
            ...dadosFormulario,
            numero: numeroParaSalvar,
            osOrigem: null
        };
        bancoOS.push(novoObj);
        localStorage.setItem('proximoOS', parseInt(numeroParaSalvar) + 1);
        alert("Ordem de Serviço criada com sucesso!");

    } else {
        if (bancoOS[idEdicaoOS]) {
            bancoOS[idEdicaoOS].status = 'Inativa';
            bancoOS[idEdicaoOS].dataEncerramento = dataAgora;
        }

        let proximoNum = localStorage.getItem('proximoOS') || 1001;
        const novaVersaoObj = {
            ...dadosFormulario,
            numero: proximoNum,
            osOrigem: bancoOS[idEdicaoOS].numero
        };

        bancoOS.push(novaVersaoObj);
        localStorage.setItem('proximoOS', parseInt(proximoNum) + 1);
        alert(`Ordem atualizada!\n\nA OS ${bancoOS[idEdicaoOS].numero} foi encerrada.\nFoi gerada a nova OS ${proximoNum} com as alterações.`);
    }

    localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
    prepararNovoCadastro();
    carregarOS();
}

function encerrarOS(index) {
    if (!confirm("Deseja realmente encerrar esta Ordem de Serviço? Ela ficará inativa e sairá da lista de ativas.")) {
        return;
    }

    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const dataAgora = new Date().toISOString();

    if (bancoOS[index]) {
        bancoOS[index].status = 'Inativa';
        bancoOS[index].dataEncerramento = dataAgora;
        localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
        alert(`OS Nº ${bancoOS[index].numero} encerrada com sucesso!`);
        carregarOS();
    }
}

function carregarOS() {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const tbody = document.getElementById('corpoTabelaOS');
    tbody.innerHTML = '';

    const osFiltradas = bancoOS
        .map((os, index) => ({ ...os, originalIndex: index })) 
        .filter(os => os.status === statusFiltroAtual)
        .sort((a, b) => b.numero - a.numero);

    if (osFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666;">Nenhuma OS ${statusFiltroAtual.toLowerCase()} encontrada.</td></tr>`;
        return;
    }

    osFiltradas.forEach((os) => {
        let dataExibicao = '-';
        if (os.dataCriacao) {
            const d = new Date(os.dataCriacao);
            dataExibicao = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        }

        const classeStatus = os.status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        
        let botoesAcao = '';
        if (os.status === 'Ativa') {
            botoesAcao = `
                <button class="btn-warning" onclick="editarOS(${os.originalIndex})" style="padding: 5px 10px; margin-right: 5px;" title="Criar nova versão baseada nesta">Atualizar</button>
                <button class="btn-delete" onclick="encerrarOS(${os.originalIndex})" style="padding: 5px 10px; background-color: #dc3545;" title="Encerrar OS sem criar nova">Encerrar</button>
            `;
        } else {
            const dataFim = os.dataEncerramento ? new Date(os.dataEncerramento).toLocaleDateString('pt-BR') : '-';
            botoesAcao = `<small style="color: #d32f2f;">Encerrada em: ${dataFim}</small>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><b>${os.numero}</b></td>
                <td>${dataExibicao}</td>
                <td>${os.nomeOS}</td>
                <td><span class="status-pill ${classeStatus}">${os.status}</span></td>
                <td style="text-align: center;">
                    <div style="display:flex; justify-content:center; gap:5px; align-items:center;">
                        <button class="btn-info" onclick="gerarPDF(${os.originalIndex})" style="padding: 5px 10px;">PDF</button>
                        ${botoesAcao}
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
    document.getElementById('prescricoesDiversas').value = os.prescricoes || '';

    listaAtividadesTemporaria = [...os.atividades];
    renderizarTabelaAtividades();

    document.getElementById('formTitle').innerText = `Atualizando OS: ${os.numero} (Gerará Novo Número)`;
    document.getElementById('btnFinalizar').innerText = "Gerar Nova Versão da OS";
    
    // Entra em modo "Criado" para permitir edição das frações
    liberarFracionamento();
    
    // O botão principal de criar precisa sumir na edição, pois usamos o botão "Finalizar" lá embaixo
    document.getElementById('btnCriarOS').style.display = 'none';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function gerarPDF(index) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const os = JSON.parse(localStorage.getItem('ordensServico'))[index];

    doc.setFontSize(20);
    doc.setTextColor(26, 35, 126);
    doc.text(`ORDEM DE SERVIÇO Nº ${os.numero}`, 14, 20);
    
    doc.setFontSize(10);
    if (os.status === 'Ativa') {
        doc.setTextColor(40, 167, 69); 
        doc.text("[ DOCUMENTO VÁLIDO - ATIVA ]", 150, 20);
    } else {
        doc.setTextColor(220, 53, 69); 
        const dataEnc = os.dataEncerramento ? new Date(os.dataEncerramento).toLocaleDateString('pt-BR') : '';
        doc.text(`[ INATIVA / ENCERRADA EM ${dataEnc} ]`, 120, 20);
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    let dataCriacao = '-';
    if(os.dataCriacao) {
        dataCriacao = new Date(os.dataCriacao).toLocaleDateString('pt-BR') + " " + new Date(os.dataCriacao).toLocaleTimeString('pt-BR');
    }
    doc.text(`Criada em: ${dataCriacao}`, 14, 28);
    
    if (os.osOrigem) {
        doc.text(`Atualização da OS Nº: ${os.osOrigem}`, 14, 33);
    }

    doc.setDrawColor(200);
    doc.line(14, 36, 196, 36);
    
    doc.setFontSize(12);
    doc.text(`Missão: ${os.nomeOS}`, 14, 45);
    doc.text(`Período do Turno: ${os.inicioGeral} às ${os.terminoGeral}`, 14, 52);

    const data = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
    doc.autoTable({
        startY: 60,
        head: [['Atividade', 'Início', 'Fim', 'Localização']],
        body: data,
        headStyles: { fillColor: [26, 35, 126] },
        theme: 'striped'
    });

    if(os.prescricoes) {
        let finalY = doc.lastAutoTable.finalY + 15;
        if (finalY > 250) { doc.addPage(); finalY = 20; }

        doc.setFontSize(14);
        doc.setTextColor(26, 35, 126);
        doc.text("Prescrições Diversas / Observações:", 14, finalY);
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        const splitText = doc.splitTextToSize(os.prescricoes, 180);
        doc.text(splitText, 14, finalY + 8);
    }

    doc.save(`SGF_OS_${os.numero}.pdf`);
}