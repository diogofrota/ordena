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
    verificarTravamentoCampos(); // <--- Inicializa o estado dos campos
});

// --- NOVO: LÓGICA DE TRAVAMENTO DE CAMPOS ---
function verificarTravamentoCampos() {
    const tipo = document.getElementById('tipoAtividade').value;
    
    // Lista de tipos que NÃO precisam de Local nem Raio
    const isentos = ['Preleção', 'Intervalo', 'Retorno Base', 'Deslocamento'];
    const deveTravar = isentos.includes(tipo);

    const camposParaTravar = ['localAtividade', 'valorRaio', 'unidadeRaio'];

    camposParaTravar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.disabled = deveTravar;
            
            // Lógica visual (Cinza se travado, Branco se livre)
            if (deveTravar) {
                elemento.style.backgroundColor = "#e9ecef";
                elemento.style.color = "#6c757d";
                elemento.value = ""; // Limpa o valor para não salvar lixo
            } else {
                elemento.style.backgroundColor = "#ffffff";
                elemento.style.color = "#333";
            }
        }
    });
}

// --- CÁLCULO AUTOMÁTICO DE HORAS ---
function calcularTerminoAutomatico() {
    const duracao = parseInt(document.getElementById('turnoDuracao').value);
    const inicio = document.getElementById('inicioGeral').value;
    const campoTermino = document.getElementById('terminoGeral');

    if (duracao === 0 || !inicio) {
        campoTermino.readOnly = false;
        return;
    }

    const [hora, minuto] = inicio.split(':').map(Number);
    let novaHora = hora + duracao;
    if (novaHora >= 24) {
        novaHora = novaHora - 24;
    }

    const novaHoraString = novaHora.toString().padStart(2, '0');
    const minutoString = minuto.toString().padStart(2, '0');
    
    campoTermino.value = `${novaHoraString}:${minutoString}`;
}

// --- VALIDAÇÃO DE INTERVALO ---
function validarHorarioDentroDoTurno(horaInicioAtiv, horaFimAtiv) {
    const turnoInicio = document.getElementById('inicioGeral').value;
    const turnoFim = document.getElementById('terminoGeral').value;

    const getMinutos = (h) => {
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
    };

    const tIni = getMinutos(turnoInicio);
    const tFim = getMinutos(turnoFim);
    const aIni = getMinutos(horaInicioAtiv);
    const aFim = getMinutos(horaFimAtiv);

    const turnoCruzaMeiaNoite = tFim < tIni;

    const estaDentro = (tempo, inicio, fim, cruza) => {
        if (cruza) {
            return tempo >= inicio || tempo <= fim;
        } else {
            return tempo >= inicio && tempo <= fim;
        }
    };

    if (!estaDentro(aIni, tIni, tFim, turnoCruzaMeiaNoite)) return false;
    if (!estaDentro(aFim, tIni, tFim, turnoCruzaMeiaNoite)) return false;

    const atividadeCruza = aFim < aIni;
    if (atividadeCruza && !turnoCruzaMeiaNoite) return false;

    return true;
}

// --- FUNÇÕES CRUD E ESTRUTURAIS ---

function migrarDadosAntigos() {
    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    let houveMudanca = false;
    bancoOS.forEach(os => {
        if (!os.status) { os.status = 'Ativa'; os.dataCriacao = new Date().toISOString(); os.dataEncerramento = null; houveMudanca = true; }
        if (!os.duracaoTexto) { os.duracaoTexto = "Indefinido"; houveMudanca = true; } 
        if (!os.tipoRecurso) { os.tipoRecurso = "Viatura"; houveMudanca = true; } 
    });
    if (houveMudanca) localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
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

function prepararNovoCadastro() {
    listaAtividadesTemporaria = [];
    idEdicaoOS = -1;
    document.getElementById('formTitle').innerText = "Nova Ordem de Serviço";
    document.getElementById('btnFinalizar').innerText = "Finalizar e Gravar OS";
    cancelarCriacao();
    const proxima = localStorage.getItem('proximoOS') || 1001;
    document.getElementById('numOS').value = proxima;
    document.getElementById('nomeOS').value = '';
    document.getElementById('inicioGeral').value = '';
    document.getElementById('terminoGeral').value = '';
    document.getElementById('prescricoesDiversas').value = '';
    document.getElementById('turnoDuracao').value = "12";
    document.getElementById('tipoRecursoOS').value = "Viatura"; 
    
    // Zera e atualiza os campos de Raio/Local
    document.getElementById('valorRaio').value = '';
    document.getElementById('tipoAtividade').value = "Preleção"; // Reset para o padrão
    verificarTravamentoCampos(); // Atualiza o estado visual

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

    const inputs = ['nomeOS', 'inicioGeral', 'terminoGeral', 'turnoDuracao', 'tipoRecursoOS'];
    inputs.forEach(id => document.getElementById(id).disabled = true);

    document.getElementById('areaFracionamento').style.display = 'block';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Cancelar";
    btn.className = "btn-cancelar";
    btn.setAttribute('onclick', 'cancelarCriacao()');
    carregarSugestoesLocais();
    verificarTravamentoCampos(); // Garante estado correto ao abrir
}

function cancelarCriacao() {
    const inputs = ['nomeOS', 'inicioGeral', 'terminoGeral', 'turnoDuracao', 'tipoRecursoOS'];
    inputs.forEach(id => document.getElementById(id).disabled = false);
    document.getElementById('areaFracionamento').style.display = 'none';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Criar e Fracionar";
    btn.className = "btn-primary";
    btn.setAttribute('onclick', 'liberarFracionamento()');
}

function adicionarFracao() {
    const tipo = document.getElementById('tipoAtividade').value;
    const inicio = document.getElementById('inicioFracao').value;
    const fim = document.getElementById('terminoFracao').value;
    const local = document.getElementById('localAtividade').value;
    
    const raioValor = document.getElementById('valorRaio').value;
    const raioUnidade = document.getElementById('unidadeRaio').value;

    if (!inicio || !fim) {
        alert("Preencha os horários.");
        return;
    }

    if (!validarHorarioDentroDoTurno(inicio, fim)) {
        alert(`ERRO: O horário da atividade (${inicio} - ${fim}) está FORA dos limites do turno geral!\nVerifique se não há erro na virada do dia.`);
        return;
    }

    // --- VALIDAÇÃO DE OBRIGATORIEDADE DE LOCAL ---
    const isentos = ['Preleção', 'Intervalo', 'Retorno Base', 'Deslocamento'];
    const precisaDeLocal = !isentos.includes(tipo);

    // Se precisa de local e está vazio, bloqueia
    if (precisaDeLocal && !local) {
        alert("Localização é obrigatória para esta atividade (Baseamento ou Patrulhamento).");
        return;
    }

    let nomeAtividadeCompleto = tipo;
    if (raioValor && raioValor > 0) {
        nomeAtividadeCompleto += ` (Raio: ${raioValor}${raioUnidade})`;
    }

    const ativ = {
        tipo: nomeAtividadeCompleto,
        tipoOriginal: tipo,
        inicio: inicio,
        fim: fim,
        local: local || "---"
    };

    listaAtividadesTemporaria.push(ativ);
    listaAtividadesTemporaria.sort((a, b) => a.inicio.localeCompare(b.inicio));
    renderizarTabelaAtividades();
    
    // Limpa campos
    document.getElementById('inicioFracao').value = '';
    document.getElementById('terminoFracao').value = '';
    
    // Limpa e reseta visual
    document.getElementById('localAtividade').value = '';
    document.getElementById('valorRaio').value = ''; 
    // Mantém o tipo selecionado ou volta para padrão? 
    // Geralmente mantemos para facilitar inserts sequenciais, 
    // mas chamamos a verificação para garantir
    verificarTravamentoCampos(); 
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
        alert("Adicione ao menos uma atividade.");
        return;
    }

    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    let numeroParaSalvar = document.getElementById('numOS').value;
    const dataAgora = new Date().toISOString();
    
    const selDuracao = document.getElementById('turnoDuracao');
    const textoDuracao = selDuracao.options[selDuracao.selectedIndex].text;

    const dadosFormulario = {
        tipoRecurso: document.getElementById('tipoRecursoOS').value,
        nomeOS: document.getElementById('nomeOS').value,
        inicioGeral: document.getElementById('inicioGeral').value,
        terminoGeral: document.getElementById('terminoGeral').value,
        duracaoTexto: textoDuracao,
        prescricoes: document.getElementById('prescricoesDiversas').value,
        atividades: listaAtividadesTemporaria,
        status: 'Ativa',
        dataCriacao: dataAgora,
        dataEncerramento: null
    };

    if (idEdicaoOS === -1) {
        const novoObj = { ...dadosFormulario, numero: numeroParaSalvar, osOrigem: null };
        bancoOS.push(novoObj);
        localStorage.setItem('proximoOS', parseInt(numeroParaSalvar) + 1);
        alert("Ordem de Serviço criada!");
    } else {
        if (bancoOS[idEdicaoOS]) {
            bancoOS[idEdicaoOS].status = 'Inativa';
            bancoOS[idEdicaoOS].dataEncerramento = dataAgora;
        }
        let proximoNum = localStorage.getItem('proximoOS') || 1001;
        const novaVersaoObj = { ...dadosFormulario, numero: proximoNum, osOrigem: bancoOS[idEdicaoOS].numero };
        bancoOS.push(novaVersaoObj);
        localStorage.setItem('proximoOS', parseInt(proximoNum) + 1);
        alert(`OS Atualizada! Nova OS gerada: ${proximoNum}`);
    }

    localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
    prepararNovoCadastro();
    carregarOS();
}

function encerrarOS(index) {
    if (!confirm("Deseja encerrar esta OS?")) return;
    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    if (bancoOS[index]) {
        bancoOS[index].status = 'Inativa';
        bancoOS[index].dataEncerramento = new Date().toISOString();
        localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
        carregarOS();
    }
}

// --- EXIBIÇÃO NA TABELA ---
function carregarOS() {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const tbody = document.getElementById('corpoTabelaOS');
    tbody.innerHTML = '';

    const osFiltradas = bancoOS
        .map((os, index) => ({ ...os, originalIndex: index })) 
        .filter(os => os.status === statusFiltroAtual)
        .sort((a, b) => b.numero - a.numero);

    const mapaNomes = {
        'Viatura': 'Carro',
        'Moto': 'Motocicleta',
        'Bicicleta': 'Bicicleta',
        'Triciclo': 'Triciclo',
        'Cabine': 'Cabine',
        'Setor': 'Setor'
    };

    if (osFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#666;">Nenhuma OS encontrada.</td></tr>`;
        return;
    }

    osFiltradas.forEach((os) => {
        let dataExibicao = '-';
        if (os.dataCriacao) {
            const d = new Date(os.dataCriacao);
            dataExibicao = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        }
        
        const duracaoShow = os.duracaoTexto || 'Personalizado';
        const codigoTipo = os.tipoRecurso || 'Viatura'; 
        const tipoShow = mapaNomes[codigoTipo] || codigoTipo; 
        const horarioShow = `${os.inicioGeral} às ${os.terminoGeral}`;

        let botoesAcao = '';
        if (os.status === 'Ativa') {
            botoesAcao = `
                <button class="btn-warning" onclick="editarOS(${os.originalIndex})" style="padding: 5px 10px; margin-right: 5px;">Atualizar</button>
                <button class="btn-delete" onclick="encerrarOS(${os.originalIndex})" style="padding: 5px 10px; background-color: #dc3545;">Encerrar</button>
            `;
        } else {
            const dataFim = os.dataEncerramento ? new Date(os.dataEncerramento).toLocaleDateString('pt-BR') : '-';
            botoesAcao = `<small style="color: #d32f2f;">Encerrada: ${dataFim}</small>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><b>${os.numero}</b></td>
                <td><span style="font-weight:bold; color:#1a237e;">${tipoShow}</span></td> <td>${os.nomeOS}</td>
                <td>${duracaoShow}</td>
                <td>${horarioShow}</td> 
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
    document.getElementById('tipoRecursoOS').value = os.tipoRecurso || 'Viatura';
    document.getElementById('inicioGeral').value = os.inicioGeral;
    document.getElementById('terminoGeral').value = os.terminoGeral;
    document.getElementById('prescricoesDiversas').value = os.prescricoes || '';
    document.getElementById('turnoDuracao').value = "0"; 

    listaAtividadesTemporaria = [...os.atividades];
    renderizarTabelaAtividades();

    document.getElementById('formTitle').innerText = `Atualizando OS: ${os.numero}`;
    document.getElementById('btnFinalizar').innerText = "Gerar Nova Versão";
    liberarFracionamento();
    document.getElementById('btnCriarOS').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function gerarPDF(index) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const os = JSON.parse(localStorage.getItem('ordensServico'))[index];

    const mapaNomes = {
        'Viatura': 'Carro',
        'Moto': 'Motocicleta',
        'Bicicleta': 'Bicicleta',
        'Triciclo': 'Triciclo',
        'Cabine': 'Cabine',
        'Setor': 'Setor'
    };
    const codigoTipo = os.tipoRecurso || 'Viatura';
    const tipoNomePDF = mapaNomes[codigoTipo] || codigoTipo;

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
    if(os.dataCriacao) dataCriacao = new Date(os.dataCriacao).toLocaleDateString('pt-BR') + " " + new Date(os.dataCriacao).toLocaleTimeString('pt-BR');
    doc.text(`Criada em: ${dataCriacao}`, 14, 28);
    doc.text(`Criada por: Subsecretário de Segurança / Coordenador do Projeto`, 14, 33);

    if (os.osOrigem) doc.text(`Atualização da OS Nº: ${os.osOrigem}`, 14, 38);

    doc.setDrawColor(200);
    doc.line(14, 42, 196, 42);
    
    doc.setFontSize(12);
    doc.text(`Missão: ${os.nomeOS}`, 14, 50);
    doc.text(`Aplicação: ${tipoNomePDF}`, 14, 56);
    
    const txtDuracao = os.duracaoTexto ? ` (${os.duracaoTexto})` : '';
    doc.text(`Período do Turno: ${os.inicioGeral} às ${os.terminoGeral}${txtDuracao}`, 14, 62);

    const data = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
    doc.autoTable({
        startY: 70,
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