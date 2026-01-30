/**
 * LÓGICA DE GERENCIAMENTO DE OS (CORRIGIDO: LABELS E COLUNAS)
 */

let listaAtividadesTemporaria = [];
let idEdicaoOS = -1; 
let statusFiltroAtual = 'Ativa'; 

document.addEventListener('DOMContentLoaded', () => {
    try {
        migrarDadosAntigos(); 
        carregarOS();
        prepararNovoCadastro();
        atualizarInterfaceAtividade();
    } catch (e) {
        console.error("Erro na inicialização:", e);
    }
});

// --- INTERFACE ---
function atualizarInterfaceAtividade() {
    try {
        const tipo = document.getElementById('tipoAtividade').value;
        const linhaLocal = document.getElementById('linhaLocalizacao');
        const campoLocal = document.getElementById('localAtividade');
        const labelLocal = document.getElementById('labelLocal');

        if (!linhaLocal || !campoLocal) return;

        if (tipo === 'Baseamento' || tipo === 'Patrulhamento') {
            linhaLocal.style.display = 'flex';
            
            if (tipo === 'Baseamento') {
                labelLocal.innerText = "Selecione o Ponto de Baseamento";
                campoLocal.placeholder = "Busque pelo nome do local...";
            } else {
                labelLocal.innerText = "Selecione a Área de Patrulhamento";
                campoLocal.placeholder = "Busque pelo nome da área...";
            }
            
            carregarSugestoesLocais();
        } else {
            linhaLocal.style.display = 'none';
            campoLocal.value = "";
        }
    } catch (e) { console.error("Erro interface:", e); }
}

// --- CARREGA SUGESTÕES ---
function carregarSugestoesLocais() {
    const datalist = document.getElementById('listaLocaisSugestao');
    const tipoSelecionado = document.getElementById('tipoAtividade').value;
    if(!datalist) return;

    datalist.innerHTML = ''; 
    
    let locaisBase = [];
    let pontosPatrulha = [];
    try {
        locaisBase = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
        pontosPatrulha = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];
    } catch(e) { console.error("Erro localStorage:", e); }

    if (!Array.isArray(locaisBase)) locaisBase = [];
    if (!Array.isArray(pontosPatrulha)) pontosPatrulha = [];

    let locaisParaMostrar = [];

    if (tipoSelecionado === 'Baseamento') {
        locaisParaMostrar = locaisBase
            .filter(l => l && l.status === 'Ativo')
            .map(l => ({
                valor: `[Base] ${l.apelido}`, 
                texto: `${l.apelido} - ${l.rua}`,
            }));

    } else if (tipoSelecionado === 'Patrulhamento') {
        locaisParaMostrar = pontosPatrulha
            .filter(p => p && p.status === 'Ativo')
            .map(p => ({
                valor: `[Patrulha] ${p.apelido}`,
                texto: `${p.apelido} (Raio: ${p.raio}m)`,
            }));
    }

    locaisParaMostrar.sort((a, b) => a.valor.localeCompare(b.valor));
    
    locaisParaMostrar.forEach(item => {
        const option = document.createElement('option');
        option.value = item.valor; 
        option.label = item.texto; 
        datalist.appendChild(option);
    });
}

// --- CÁLCULOS TEMPO ---
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
    if (novaHora >= 24) { novaHora = novaHora - 24; }

    const novaHoraString = novaHora.toString().padStart(2, '0');
    const minutoString = minuto.toString().padStart(2, '0');
    campoTermino.value = `${novaHoraString}:${minutoString}`;
}

function calcularMinutosParaOrdenacao(horaAtividade, inicioTurno) {
    if (!horaAtividade || !inicioTurno) return 0;
    const [hAtiv, mAtiv] = horaAtividade.split(':').map(Number);
    const [hTurno, mTurno] = inicioTurno.split(':').map(Number);
    let minutosAtiv = hAtiv * 60 + mAtiv;
    let minutosTurno = hTurno * 60 + mTurno;
    if (minutosAtiv < minutosTurno) minutosAtiv += 1440; 
    return minutosAtiv;
}

function validarHorarioDentroDoTurno(horaInicioAtiv, horaFimAtiv) {
    const turnoInicio = document.getElementById('inicioGeral').value;
    const turnoFim = document.getElementById('terminoGeral').value;
    if (!turnoInicio || !turnoFim) return true;
    const getMinutos = (h) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
    const tIni = getMinutos(turnoInicio);
    const tFim = getMinutos(turnoFim);
    const aIni = getMinutos(horaInicioAtiv);
    const aFim = getMinutos(horaFimAtiv);
    const turnoCruzaMeiaNoite = tFim < tIni;
    const estaDentro = (tempo, inicio, fim, cruza) => {
        if (cruza) return tempo >= inicio || tempo <= fim;
        else return tempo >= inicio && tempo <= fim;
    };
    if (!estaDentro(aIni, tIni, tFim, turnoCruzaMeiaNoite)) return false;
    if (!estaDentro(aFim, tIni, tFim, turnoCruzaMeiaNoite)) return false;
    return true;
}

// --- ADICIONAR ATIVIDADE ---
function adicionarFracao() {
    const tipo = document.getElementById('tipoAtividade').value;
    const inicio = document.getElementById('inicioFracao').value;
    const fim = document.getElementById('terminoFracao').value;
    const localInputValue = document.getElementById('localAtividade').value;
    const inicioGeralOS = document.getElementById('inicioGeral').value; 

    if (!inicio || !fim) { alert("Preencha os horários."); return; }
    if (!validarHorarioDentroDoTurno(inicio, fim)) {
        alert(`ERRO: O horário (${inicio} - ${fim}) está FORA dos limites do turno!`);
        return;
    }

    if ((tipo === 'Baseamento' || tipo === 'Patrulhamento') && !localInputValue) {
        alert("Selecione o local/área cadastrada.");
        return;
    }

    let icone = "📝";
    if (tipo === 'Baseamento') icone = "🛡️";
    else if (tipo === 'Patrulhamento') icone = "🚔";
    else if (tipo === 'Deslocamento') icone = "🚚";
    else if (tipo === 'Intervalo') icone = "🍽️";

    let infoRaio = "-";
    let bairro = "-";
    let cidade = "-";
    let logradouro = "-"; 
    let nomeLocalLimpo = localInputValue;
    let coordenadas = null; 

    try {
        if (tipo === 'Patrulhamento') {
            const pontosPatrulha = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];
            const pontoEncontrado = pontosPatrulha.find(p => p && p.apelido && localInputValue.includes(p.apelido));
            
            if (pontoEncontrado) {
                infoRaio = `${pontoEncontrado.raio} m`;
                bairro = pontoEncontrado.bairro || "-";
                cidade = pontoEncontrado.cidade || "-";
                logradouro = `${pontoEncontrado.rua || ''}, ${pontoEncontrado.numero || 'S/N'}`;
                nomeLocalLimpo = pontoEncontrado.apelido;
                coordenadas = { lat: pontoEncontrado.lat, lng: pontoEncontrado.lng, raio: pontoEncontrado.raio };
            }
        } else if (tipo === 'Baseamento') {
            const locaisBase = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
            const localEncontrado = locaisBase.find(l => l && l.apelido && localInputValue.includes(l.apelido));
            
            infoRaio = "Ponto Fixo";
            if (localEncontrado) {
                bairro = localEncontrado.bairro || "-";
                cidade = localEncontrado.cidade || "-";
                logradouro = `${localEncontrado.rua || ''}, ${localEncontrado.numero || 'S/N'}`;
                nomeLocalLimpo = localEncontrado.apelido;
                coordenadas = { lat: localEncontrado.lat, lng: localEncontrado.lng, raio: null };
            }
        }
    } catch(e) { console.error("Erro dados local:", e); }

    if (tipo !== 'Baseamento' && tipo !== 'Patrulhamento') {
        nomeLocalLimpo = "---";
    }

    const ativ = {
        tipo: tipo,
        icone: icone,
        inicio: inicio,
        fim: fim,
        local: nomeLocalLimpo,
        logradouro: logradouro,
        bairro: bairro,
        cidade: cidade,
        detalhe: infoRaio,
        gps: coordenadas 
    };

    listaAtividadesTemporaria.push(ativ);
    
    listaAtividadesTemporaria.sort((a, b) => {
        const minA = calcularMinutosParaOrdenacao(a.inicio, inicioGeralOS);
        const minB = calcularMinutosParaOrdenacao(b.inicio, inicioGeralOS);
        return minA - minB;
    });

    renderizarTabelaAtividades();
    
    document.getElementById('inicioFracao').value = '';
    document.getElementById('terminoFracao').value = '';
    document.getElementById('localAtividade').value = '';
}

function renderizarTabelaAtividades() {
    const tbody = document.getElementById('tabelaFracoesTemp');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    listaAtividadesTemporaria.forEach((item, index) => {
        const bairroShow = item.bairro || '-';
        const cidadeShow = item.cidade || '-';
        const detalheShow = item.detalhe || '-';
        const logradouroShow = item.logradouro || '-';

        // Correção: data-label adicionado em todas as colunas
        tbody.innerHTML += `
            <tr>
                <td data-label="Atividade"><span style="font-size:1.1rem; margin-right:5px;">${item.icone}</span> ${item.tipo}</td>
                <td data-label="Início">${item.inicio}</td>
                <td data-label="Fim">${item.fim}</td>
                <td data-label="Local"><strong>${item.local}</strong></td>
                <td data-label="Logradouro">${logradouroShow}</td>
                <td data-label="Bairro">${bairroShow}</td>
                <td data-label="Município">${cidadeShow}</td>
                <td data-label="Detalhes"><span style="color:${item.tipo === 'Patrulhamento' ? '#d32f2f' : '#555'}; font-weight:bold;">${detalheShow}</span></td>
                <td data-label="Ação" style="text-align: center;"><button class="btn-danger" style="padding: 5px 10px; height: 35px;" onclick="removerFracao(${index})">X</button></td>
            </tr>`;
    });
}

function removerFracao(index) {
    listaAtividadesTemporaria.splice(index, 1);
    renderizarTabelaAtividades();
}

// --- FINALIZAR ---
function finalizarOS() {
    if (listaAtividadesTemporaria.length === 0) {
        alert("Adicione ao menos uma atividade.");
        return;
    }

    let bancoOS = [];
    try { bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || []; } catch(e) { bancoOS = []; }
    if(!Array.isArray(bancoOS)) bancoOS = [];

    let numeroParaSalvar = document.getElementById('numOS').value;
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
        dataCriacao: new Date().toISOString(),
        dataEncerramento: null,
        criadoPor: "Coordenação"
    };

    if (idEdicaoOS === -1) {
        const novoObj = { ...dadosFormulario, numero: numeroParaSalvar, osOrigem: null };
        bancoOS.push(novoObj);
        localStorage.setItem('proximoOS', parseInt(numeroParaSalvar) + 1);
        alert("Ordem de Serviço criada!");
    } else {
        if (bancoOS[idEdicaoOS]) {
            bancoOS[idEdicaoOS].status = 'Inativa';
            bancoOS[idEdicaoOS].dataEncerramento = new Date().toISOString();
        }
        let proximoNum = localStorage.getItem('proximoOS') || 1001;
        const novaVersaoObj = { ...dadosFormulario, numero: proximoNum, osOrigem: bancoOS[idEdicaoOS].numero };
        bancoOS.push(novaVersaoObj);
        localStorage.setItem('proximoOS', parseInt(proximoNum) + 1);
        alert(`OS Atualizada! Nova OS: ${proximoNum}`);
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

// --- EXIBIÇÃO BANCO (CORRIGIDA COM DATA-LABEL e BOTÕES) ---
function carregarOS() {
    let bancoOS = [];
    try { bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || []; } catch (e) { bancoOS = []; }
    if (!Array.isArray(bancoOS)) bancoOS = [];

    const tbody = document.getElementById('corpoTabelaOS');
    if (!tbody) return;
    tbody.innerHTML = '';

    const osFiltradas = bancoOS.map((os, index) => ({ ...os, originalIndex: index }))
        .filter(os => os.status === statusFiltroAtual)
        .sort((a, b) => b.numero - a.numero);

    if (osFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Nenhuma OS.</td></tr>`;
        return;
    }

    osFiltradas.forEach((os) => {
        const duracaoShow = os.duracaoTexto || 'Personalizado';
        let botoesAcao = os.status === 'Ativa' 
            ? `<button class="btn-warning" onclick="editarOS(${os.originalIndex})">Atualizar</button>
               <button class="btn-delete" onclick="encerrarOS(${os.originalIndex})">Encerrar</button>`
            : `<small style="color: #d32f2f;">Encerrada</small>`;

        // AQUI ESTÁ A CORREÇÃO: data-label ADICIONADOS e acoes-container
        tbody.innerHTML += `
            <tr>
                <td data-label="Nº OS"><b>${os.numero}</b></td>
                <td data-label="Recurso">${os.tipoRecurso}</td> 
                <td data-label="Missão">${os.nomeOS}</td>
                <td data-label="Duração">${duracaoShow}</td>
                <td data-label="Turno">${os.inicioGeral} - ${os.terminoGeral}</td> 
                <td data-label="Ações" style="text-align: center;">
                    <div class="acoes-container">
                        <button class="btn-info" onclick="abrirImpressao(${os.originalIndex})" style="padding: 5px 10px;">📄 Imprimir</button>
                        ${botoesAcao}
                    </div>
                </td>
            </tr>`;
    });
}

function abrirImpressao(index) {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const osParaImprimir = bancoOS[index];
    localStorage.setItem('osImpressaoTemp', JSON.stringify(osParaImprimir));
    window.open('impressao.html', '_blank');
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
    listaAtividadesTemporaria.sort((a, b) => {
        const minA = calcularMinutosParaOrdenacao(a.inicio, os.inicioGeral);
        const minB = calcularMinutosParaOrdenacao(b.inicio, os.inicioGeral);
        return minA - minB;
    });

    renderizarTabelaAtividades();
    document.getElementById('formTitle').innerText = `Atualizando OS: ${os.numero}`;
    document.getElementById('btnFinalizar').innerText = "Gerar Nova Versão";
    liberarFracionamento();
    document.getElementById('btnCriarOS').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    
    document.getElementById('tipoAtividade').value = "Preleção"; 
    atualizarInterfaceAtividade();
    renderizarTabelaAtividades();
}

function liberarFracionamento() {
    const nome = document.getElementById('nomeOS').value;
    const ini = document.getElementById('inicioGeral').value;
    const fim = document.getElementById('terminoGeral').value;

    if(!nome || !ini || !fim) {
        alert("Preencha Missão e Turno.");
        return;
    }

    const inputs = ['nomeOS', 'inicioGeral', 'terminoGeral', 'turnoDuracao', 'tipoRecursoOS'];
    inputs.forEach(id => document.getElementById(id).disabled = true);

    document.getElementById('areaFracionamento').style.display = 'block';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Cancelar";
    btn.className = "btn-cancelar";
    btn.setAttribute('onclick', 'cancelarCriacao()');
    
    atualizarInterfaceAtividade();
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

function migrarDadosAntigos() {
    let bancoOS = [];
    try { bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || []; } catch(e) { bancoOS = []; }
    if(!Array.isArray(bancoOS)) bancoOS = [];
    let houveMudanca = false;
    bancoOS.forEach(os => {
        if (!os.status) { os.status = 'Ativa'; houveMudanca = true; }
    });
    if (houveMudanca) localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
}