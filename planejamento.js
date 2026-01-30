/**
 * GESTÃO DE PLANEJAMENTO DIÁRIO
 * Funcionalidade: Copiar dia anterior com validação de OE/OS
 */

let dataSelecionada = null;
let listaPlanejamento = []; 
let idEdicao = null; 

document.addEventListener('DOMContentLoaded', () => {
    inicializarDatas();
    carregarPlanejamento();
    
    // Seleciona hoje por padrão
    const hoje = new Date().toISOString().split('T')[0];
    selecionarData(hoje);
});

// --- 1. DATAS ---
function inicializarDatas() {
    const container = document.getElementById('barraDias');
    container.innerHTML = '';
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hoje = new Date();

    for (let i = 0; i < 7; i++) {
        const d = new Date(hoje);
        d.setDate(hoje.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        const labelDia = i === 0 ? 'HOJE' : dias[d.getDay()];
        const labelData = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;

        const div = document.createElement('div');
        div.className = 'dia-tab';
        div.id = `tab-${iso}`;
        div.onclick = () => selecionarData(iso);
        div.innerHTML = `<span class="semana">${labelDia}</span><span class="data">${labelData}</span>`;
        container.appendChild(div);
    }
}

function selecionarData(dataISO) {
    dataSelecionada = dataISO;
    document.querySelectorAll('.dia-tab').forEach(d => d.classList.remove('ativo'));
    const tab = document.getElementById(`tab-${dataISO}`);
    if(tab) tab.classList.add('ativo');
    
    const [y,m,d] = dataISO.split('-');
    document.getElementById('dataDisplay').innerText = `${d}/${m}/${y}`;
    
    // Reseta form
    document.getElementById('selRecurso').value = "";
    document.getElementById('selOSNormal').innerHTML = '<option value="">Selecione o Recurso...</option>';
    document.getElementById('selOSNormal').disabled = true;
    document.getElementById('selOE').innerHTML = '<option value="">Selecione o Recurso...</option>';
    document.getElementById('selOE').disabled = true;
    document.getElementById('selSubOE').innerHTML = '<option value="">...</option>';
    document.getElementById('selSubOE').disabled = true;
    
    renderizarTabela();
}

// --- FUNÇÃO INTELIGENTE: COPIAR DIA ANTERIOR ---
function copiarDiaAnterior() {
    if (!confirm(`Deseja copiar o planejamento do dia anterior para ${dataSelecionada}?`)) return;

    // 1. Calcula Data Anterior
    const parts = dataSelecionada.split('-');
    const dataObj = new Date(parts[0], parts[1]-1, parts[2]); // Construtor seguro para local
    dataObj.setDate(dataObj.getDate() - 1);
    
    const y = dataObj.getFullYear();
    const m = String(dataObj.getMonth() + 1).padStart(2, '0');
    const d = String(dataObj.getDate()).padStart(2, '0');
    const dataAnteriorISO = `${y}-${m}-${d}`;

    // 2. Busca itens do dia anterior
    const itensAnteriores = listaPlanejamento.filter(i => i.data === dataAnteriorISO);

    if (itensAnteriores.length === 0) {
        alert("Não há planejamento no dia anterior (" + dataAnteriorISO + ") para copiar.");
        return;
    }

    // 3. Carrega Bancos para Validação
    const ordensServico = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const ordensEspeciais = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    
    let copiadosCount = 0;
    let modificadosCount = 0;

    itensAnteriores.forEach(item => {
        // Valida se a OS de Rotina ainda existe e está Ativa
        // (Converte para string para garantir comparação)
        const osValida = ordensServico.find(o => o.numero.toString() === item.osNum.toString() && o.status === 'Ativa');
        
        if (!osValida) {
            // Se a OS foi encerrada, não copiamos este item
            return; 
        }

        // Cria novo objeto (cópia)
        let novoItem = JSON.parse(JSON.stringify(item));
        novoItem.id = Date.now() + Math.floor(Math.random() * 1000); // Novo ID
        novoItem.data = dataSelecionada; // Nova Data

        // --- VALIDAÇÃO DA OE (EVENTO ESPECIAL) ---
        if (novoItem.oeId) {
            const evento = ordensEspeciais.find(e => e.id == novoItem.oeId);
            let oeValida = false;

            if (evento && evento.status === 'Ativa') {
                // Verifica Datas do Evento
                // Convertendo para timestamp zero hora para comparar apenas dias
                const alvoTimestamp = new Date(dataSelecionada + 'T00:00:00').getTime();
                const iniEvento = new Date(evento.inicio.split('T')[0] + 'T00:00:00').getTime();
                const fimEvento = new Date(evento.termino.split('T')[0] + 'T00:00:00').getTime();

                if (alvoTimestamp >= iniEvento && alvoTimestamp <= fimEvento) {
                    oeValida = true;
                }
            }

            if (!oeValida) {
                // SE EXPIROU: Remove dados da OE, mantém como Rotina
                novoItem.oeId = null;
                novoItem.nomeOE = "-";
                novoItem.horaInicioOE = "-";
                novoItem.horaFimOE = "-";
                novoItem.subSeq = null;
                novoItem.textoSub = "-";
                modificadosCount++;
            }
        }

        listaPlanejamento.push(novoItem);
        copiadosCount++;
    });

    localStorage.setItem('planejamentoDiario', JSON.stringify(listaPlanejamento));
    renderizarTabela();

    let msg = `${copiadosCount} itens copiados de ${dataAnteriorISO}.`;
    if (modificadosCount > 0) {
        msg += `\n\nNota: ${modificadosCount} itens tiveram o Evento (OE) removido pois expirou na data de hoje.`;
    }
    alert(msg);
}

// --- 2. FILTROS CASCATA ---

function atualizarFiltros() {
    const recurso = document.getElementById('selRecurso').value;
    filtrarOSRotina(recurso);
    filtrarOEsPorRecurso(recurso);
    document.getElementById('selSubOE').innerHTML = '<option value="">Selecione a OE...</option>';
    document.getElementById('selSubOE').disabled = true;
}

function filtrarOSRotina(recurso) {
    const selOS = document.getElementById('selOSNormal');
    selOS.innerHTML = '<option value="">Selecione...</option>';
    
    if (!recurso) { selOS.disabled = true; return; }
    selOS.disabled = false;

    const osDiarias = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const compativeis = osDiarias.filter(os => os.status === 'Ativa' && os.tipoRecurso === recurso);

    const osUsadasNoDia = listaPlanejamento
        .filter(item => item.data === dataSelecionada)
        .map(item => item.osNum.toString());

    const disponiveis = compativeis.filter(os => !osUsadasNoDia.includes(os.numero.toString()));

    if (disponiveis.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = "(Sem OS disponível)";
        selOS.appendChild(opt);
        selOS.disabled = true;
    } else {
        disponiveis.forEach(os => {
            const opt = document.createElement('option');
            opt.value = os.numero;
            opt.innerText = `${os.numero} - ${os.nomeOS} (${os.inicioGeral}-${os.terminoGeral})`;
            selOS.appendChild(opt);
        });
    }
}

function filtrarOEsPorRecurso(recurso) {
    const selOE = document.getElementById('selOE');
    selOE.innerHTML = '<option value="">Nenhuma (Rotina Pura)</option>';
    
    if(!recurso) { selOE.disabled = true; return; }
    selOE.disabled = false;

    const oes = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    const dataRef = new Date(dataSelecionada + 'T00:00:00').getTime();

    const oesValidas = oes.filter(e => {
        if (e.status !== 'Ativa') return false;
        const ini = new Date(e.inicio.split('T')[0] + 'T00:00:00').getTime();
        const fim = new Date(e.termino.split('T')[0] + 'T00:00:00').getTime();
        if (dataRef < ini || dataRef > fim) return false;
        return e.subOrdens.some(sub => sub.tipo === recurso);
    });

    oesValidas.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.innerText = `OE-${e.id} | ${e.nome}`;
        selOE.appendChild(opt);
    });
}

function atualizarSubOrdens() {
    const oeId = document.getElementById('selOE').value;
    const recurso = document.getElementById('selRecurso').value;
    const selSub = document.getElementById('selSubOE');
    
    selSub.innerHTML = '<option value="">...</option>';
    selSub.disabled = true;

    if (!oeId || !recurso) return;

    const todosEventos = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    const evento = todosEventos.find(e => e.id == oeId);

    if (!evento || !evento.subOrdens) return;

    const subsDoRecurso = evento.subOrdens.filter(sub => sub.tipo === recurso);

    const subsUsadasHoje = listaPlanejamento
        .filter(item => item.data === dataSelecionada && item.oeId == oeId && item.subSeq)
        .map(item => item.subSeq.toString());

    const disponiveis = subsDoRecurso.filter(sub => !subsUsadasHoje.includes(sub.seq.toString()));

    if (disponiveis.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = "(Todas alocadas)";
        selSub.appendChild(opt);
    } else {
        selSub.disabled = false;
        selSub.innerHTML = '<option value="">Selecione a Sub-Ordem...</option>';
        disponiveis.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.seq; 
            const nomeDisplay = sub.nomeEspecifico ? sub.nomeEspecifico : `OE-${evento.id}-${sub.seq}`;
            opt.innerText = nomeDisplay;
            selSub.appendChild(opt);
        });
    }
}

// --- 3. CRUD ---

function carregarPlanejamento() {
    listaPlanejamento = JSON.parse(localStorage.getItem('planejamentoDiario')) || [];
}

function adicionarPlanejamento() {
    const recurso = document.getElementById('selRecurso').value;
    const osNum = document.getElementById('selOSNormal').value;
    const oeId = document.getElementById('selOE').value;
    const subSeq = document.getElementById('selSubOE').value;
    const obs = document.getElementById('obsPlanejamento').value;

    if (!recurso) return alert("Selecione o Recurso.");
    if (!osNum) return alert("Selecione a OS de Rotina.");

    if (oeId && !subSeq) {
        const selSub = document.getElementById('selSubOE');
        if (!selSub.disabled && selSub.value === "") {
            return alert("Selecione a Sub-Ordem do evento.");
        }
    }

    const todasOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const osOriginal = todasOS.find(o => o.numero.toString() === osNum.toString());
    
    if(!osOriginal) return alert("Erro: OS não encontrada.");

    const horaInicioOS = osOriginal.inicioGeral || '-';
    const horaFimOS = osOriginal.terminoGeral || '-';
    const missaoOS = osOriginal.nomeOS || '';

    let nomeOE = "-";
    let textoSub = "-";
    let horaInicioOE = "-";
    let horaFimOE = "-";

    if (oeId) {
        const todosEventos = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
        const evt = todosEventos.find(e => e.id == oeId);
        if (evt) {
            nomeOE = evt.nome;
            try {
                horaInicioOE = new Date(evt.inicio).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                horaFimOE = new Date(evt.termino).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
            } catch(e) {}
            
            if (subSeq) {
                const subObj = evt.subOrdens.find(s => s.seq.toString() === subSeq.toString());
                if (subObj) {
                    textoSub = subObj.nomeEspecifico || `OE-${oeId}-${subSeq}`;
                } else {
                    textoSub = `OE-${oeId}-${subSeq}`;
                }
            }
        }
    }

    const novoItem = {
        id: Date.now(),
        data: dataSelecionada,
        recurso, osNum, missaoOS,
        horaInicioOS, horaFimOS,
        oeId, nomeOE, horaInicioOE, horaFimOE,
        subSeq, textoSub,
        obs
    };

    listaPlanejamento.push(novoItem);
    document.getElementById('obsPlanejamento').value = '';
    
    atualizarFiltros(); 

    localStorage.setItem('planejamentoDiario', JSON.stringify(listaPlanejamento));
    renderizarTabela();
}

function renderizarTabela() {
    const tbody = document.getElementById('tabelaPlanejamento');
    tbody.innerHTML = '';
    
    const doDia = listaPlanejamento.filter(i => i.data === dataSelecionada);
    document.getElementById('contadorItens').innerText = `${doDia.length} Itens`;

    if(doDia.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px;">Nada planejado para hoje.</td></tr>';
        return;
    }

    doDia.forEach((item, index) => {
        let icone = '🔹';
        if(item.recurso === 'Viatura') icone = '🚔';
        if(item.recurso === 'Moto') icone = '🏍️';
        if(item.recurso === 'Cabine') icone = '🏠';
        if(item.recurso === 'Setor') icone = '🚶';

        let oeContent = '<span style="color:#ccc">---</span>';
        if(item.oeId) {
            oeContent = `
                <div class="cell-info">
                    <span class="col-oe-title">${item.nomeOE}</span>
                    <span class="badge-time time-oe">${item.horaInicioOE} - ${item.horaFimOE}</span>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-seq">${index + 1}</td>
            <td class="col-recurso">${icone}<br><span style="font-size:0.75rem;">${item.recurso}</span></td>
            
            <td>
                <div class="cell-info">
                    <span class="info-titulo">OS ${item.osNum}</span>
                    <span class="info-sub">${item.missaoOS}</span>
                    <span class="badge-time time-os">${item.horaInicioOS} - ${item.horaFimOS}</span>
                </div>
            </td>
            
            <td>${oeContent}</td>
            
            <td class="col-sub">${item.textoSub}</td>
            <td class="col-obs">${item.obs || ''}</td>
            <td style="text-align:center;">
                <button class="btn-icon btn-print" onclick="imprimirItem(${item.id})">🖨️</button>
                <button class="btn-icon btn-del" onclick="removerItem(${item.id})">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function removerItem(id) {
    if(!confirm("Remover linha?")) return;
    const itemRemovido = listaPlanejamento.find(i => i.id === id);
    listaPlanejamento = listaPlanejamento.filter(i => i.id !== id);
    localStorage.setItem('planejamentoDiario', JSON.stringify(listaPlanejamento));
    
    renderizarTabela();
    
    // Atualiza Selects para liberar o que foi removido (se estiver na mesma tela)
    const recursoAtual = document.getElementById('selRecurso').value;
    if(itemRemovido && recursoAtual === itemRemovido.recurso) {
        filtrarOSRotina(recursoAtual);
        if(itemRemovido.oeId) atualizarSubOrdens();
    }
}

// --- 5. IMPRESSÃO ---
function imprimirItem(id) {
    const item = listaPlanejamento.find(i => i.id === id);
    if(!item) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`CARTÃO DE PLANEJAMENTO`, 14, 20);
    doc.setFontSize(12); doc.text(`Data: ${item.data.split('-').reverse().join('/')}`, 14, 30);
    
    doc.autoTable({
        startY: 40,
        head: [['OS', 'Missão', 'Turno', 'Evento', 'Recurso', 'Obs']],
        body: [[
            item.osNum, item.missaoOS, 
            `${item.horaInicioOS}-${item.horaFimOS}`,
            item.nomeOE, item.textoSub, item.obs||'-'
        ]]
    });
    doc.save(`Plan_${item.id}.pdf`);
}