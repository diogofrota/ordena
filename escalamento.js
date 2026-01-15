document.addEventListener('DOMContentLoaded', () => {
    migrarEscalasAntigas(); 
    popularSelects();
    exibirMonitoramento();
    setInterval(exibirMonitoramento, 10000); 
});

const DESPACHANTE = {
    nome: "SGT Controle",
    funcao: "Operador de Despacho",
    id: "user_01"
};

// --- MIGRAÇÃO ---
function migrarEscalasAntigas() {
    let escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    let houveMudanca = false;
    escalas.forEach(e => {
        if (e.prefixo && !e.recursoId) { e.recursoId = e.prefixo; e.tipoRecurso = "Viatura"; houveMudanca = true; }
        if (!e.despachante) { e.despachante = { nome: "Sistema (Legado)", funcao: "Automático" }; houveMudanca = true; }
    });
    if (houveMudanca) { localStorage.setItem('escalasAtivas', JSON.stringify(escalas)); }
}

// --- POPULAR SELECTS ---
function popularSelects() {
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const escalasAtivas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    
    const selectRecurso = document.getElementById('selectRecurso');
    const selectOS = document.getElementById('selectOS');

    selectRecurso.innerHTML = '<option value="">Selecione o Recurso...</option>';
    selectOS.innerHTML = '<option value="">Selecione a OS...</option>';

    const recursosEmUso = escalasAtivas.map(e => e.recursoId || e.prefixo);
    const osEmUso = escalasAtivas.map(e => e.osNumero.toString());

    // VIATURAS (Usa o tipo cadastrado: Carro, Moto, etc)
    const vtrsDisponiveis = viaturas.filter(v => v.status === 'Ativa' && !recursosEmUso.includes(v.prefixo));
    if (vtrsDisponiveis.length > 0) {
        const groupVtr = document.createElement('optgroup');
        groupVtr.label = "Frota Veicular";
        vtrsDisponiveis.forEach(v => {
            let opt = document.createElement('option');
            opt.value = v.prefixo;
            // AQUI ESTÁ O TRUQUE: Usa v.tipo se existir, senão 'Viatura'
            opt.dataset.tipo = v.tipo || "Viatura"; 
            opt.innerHTML = `[${opt.dataset.tipo}] ${v.prefixo} (${v.placa})`;
            groupVtr.appendChild(opt);
        });
        selectRecurso.appendChild(groupVtr);
    }

    // CABINES
    const cabinesDisponiveis = cabines.filter(c => c.status === 'Ativa' && !recursosEmUso.includes(c.codigo));
    if (cabinesDisponiveis.length > 0) {
        const groupCab = document.createElement('optgroup');
        groupCab.label = "Cabines Integradas";
        cabinesDisponiveis.forEach(c => {
            let opt = document.createElement('option');
            opt.value = c.codigo;
            opt.dataset.tipo = "Cabine";
            opt.innerHTML = `[Cabine] ${c.codigo} - ${c.nome}`;
            groupCab.appendChild(opt);
        });
        selectRecurso.appendChild(groupCab);
    }

    // SETORES
    const setoresDisponiveis = setores.filter(s => s.status === 'Ativa' && !recursosEmUso.includes(s.codigo));
    if (setoresDisponiveis.length > 0) {
        const groupSetor = document.createElement('optgroup');
        groupSetor.label = "Setores (A pé)";
        setoresDisponiveis.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.codigo;
            opt.dataset.tipo = "Setor";
            opt.innerHTML = `[Setor] ${s.codigo} - ${s.nome}`;
            groupSetor.appendChild(opt);
        });
        selectRecurso.appendChild(groupSetor);
    }

    // OS
    const ordensDisponiveis = ordens.filter(os => os.status === 'Ativa' && !osEmUso.includes(os.numero.toString()));
    ordensDisponiveis.forEach(os => {
        let opt = document.createElement('option');
        opt.value = os.numero;
        opt.innerHTML = `OS: ${os.numero} (${os.tipoRecurso || 'Geral'}) - ${os.nomeOS}`;
        selectOS.appendChild(opt);
    });
}

// --- INTEGRANTES ---
let contadorIntegrantes = 0; const MAX_INTEGRANTES = 5; 
function adicionarIntegrante() { 
    if (contadorIntegrantes >= MAX_INTEGRANTES) { alert("Máximo de 6 integrantes."); return; } 
    const container = document.getElementById('listaIntegrantes'); const idUnico = Date.now(); const div = document.createElement('div'); div.className = 'box-integrante'; div.id = `integrante-${idUnico}`; 
    div.innerHTML = `<div class="row-integrante"><div style="flex: 1;"><select name="posto" class="input-padrao" required><option value="SD">SD</option><option value="CB">CB</option><option value="SGT">SGT</option><option value="SUBTEN">SUBTEN</option><option value="ASP">ASP</option><option value="TEN">TEN</option></select></div><div style="flex: 2;"><input type="text" name="nome" class="input-padrao" placeholder="Nome de Guerra" required></div><div style="flex: 1;"><input type="text" name="rg" class="input-padrao" placeholder="RG" required></div></div><button type="button" class="btn-remove" onclick="removerLinhaIntegrante('${idUnico}')">X</button>`; 
    container.appendChild(div); contadorIntegrantes++; 
}
function removerLinhaIntegrante(id) { document.getElementById(`integrante-${id}`).remove(); contadorIntegrantes--; }

// --- SALVAR ---
document.getElementById('escalamentoForm').addEventListener('submit', (e) => { 
    e.preventDefault(); 
    const selectRecurso = document.getElementById('selectRecurso'); 
    const recursoId = selectRecurso.value; 
    const tipoRecurso = selectRecurso.options[selectRecurso.selectedIndex].dataset.tipo || 'Viatura'; 
    const osNumero = document.getElementById('selectOS').value; 
    const comandante = { posto: document.getElementById('postoCmd').value, nome: document.getElementById('nomeCmd').value, rg: document.getElementById('rgCmd').value, tel: document.getElementById('telCmd').value, funcao: "Comandante" }; 
    const integrantesExtras = []; document.querySelectorAll('#listaIntegrantes .box-integrante').forEach(box => { integrantesExtras.push({ posto: box.querySelector('select[name="posto"]').value, nome: box.querySelector('input[name="nome"]').value, rg: box.querySelector('input[name="rg"]').value, funcao: "Auxiliar" }); }); 
    const novaEscala = { id: Date.now(), dataInicio: new Date().toISOString(), recursoId: recursoId, tipoRecurso: tipoRecurso, osNumero: osNumero, despachante: DESPACHANTE, equipe: [comandante, ...integrantesExtras] }; 
    let escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || []; escalas.push(novaEscala); localStorage.setItem('escalasAtivas', JSON.stringify(escalas)); 
    document.getElementById('escalamentoForm').reset(); document.getElementById('listaIntegrantes').innerHTML = ''; contadorIntegrantes = 0; 
    alert("Serviço ativado com sucesso!"); popularSelects(); exibirMonitoramento(); 
});

// --- MONITORAMENTO (ATUALIZADO) ---
function exibirMonitoramento() {
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const corpoTabela = document.getElementById('listaMonitoramento');
    const agora = new Date();

    corpoTabela.innerHTML = '';

    if (escalas.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#666;">Nenhuma guarnição ativa no momento.</td></tr>';
        return;
    }

    escalas.forEach((escala, index) => {
        const os = ordens.find(o => o.numero == escala.osNumero);
        
        let textoTempo = "--:--";
        let classeTempo = "";
        let deveFinalizar = false;

        if (os && os.terminoGeral) {
            const [hFim, mFim] = os.terminoGeral.split(':').map(Number);
            let dataFimOS = new Date();
            dataFimOS.setHours(hFim, mFim, 0, 0);
            const [hIni, mIni] = os.inicioGeral.split(':').map(Number);
            if (hFim < hIni && agora.getHours() >= hIni) { dataFimOS.setDate(dataFimOS.getDate() + 1); }
            const diffMs = dataFimOS - agora;
            if (diffMs <= 0) { deveFinalizar = true; } 
            else {
                const horasRest = Math.floor(diffMs / (1000 * 60 * 60));
                const minsRest = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                textoTempo = `${horasRest}h ${minsRest}m`;
                if (horasRest === 0 && minsRest < 30) classeTempo = "timer-danger"; 
                else if (horasRest === 0) classeTempo = "timer-warning"; 
                else classeTempo = "timer-box";
            }
        }

        if (deveFinalizar) { finalizarTurno(escala.id, true); return; }

        let cmd = escala.equipe ? escala.equipe[0] : { posto: '', nome: 'Comandante', rg: escala.rgComandante || '-' };
        let totalIntegrantes = escala.equipe ? escala.equipe.length : 1;
        
        // --- Status e Local ---
        let atividadeInfo = `<span style="color:#777;">Aguardando Início</span>`;
        let missaoNome = os ? os.nomeOS : "MISSÃO INDEFINIDA";

        if (os) {
            const horaStr = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`;
            const atividade = os.atividades.find(at => {
                return horaStr >= at.inicio && horaStr <= at.fim;
            });

            if (atividade) {
                // Sem ícones, apenas texto limpo
                atividadeInfo = `
                    <div style="margin-bottom: 2px;">
                        <span class="atividade-titulo" style="color:#28a745;">● ${atividade.tipo}</span>
                        <span class="atividade-horario">${atividade.inicio} - ${atividade.fim}</span>
                    </div>
                    <div class="atividade-local">${atividade.local}</div>
                `;
            }
        }

        // TIPO EXATO (Sem imagem)
        // escala.tipoRecurso deve vir como "Carro", "Moto", etc do select
        const tipoExato = escala.tipoRecurso || 'Viatura'; 

        corpoTabela.innerHTML += `
            <tr>
                <td>
                    <strong style="color:#1a237e; font-size:1.1rem;">${tipoExato}: ${escala.recursoId || escala.prefixo}</strong><br>
                    <small style="color:#555;">OS ${escala.osNumero} (${os ? os.inicioGeral : ''} - ${os ? os.terminoGeral : ''})</small>
                </td>
                <td>
                    <strong>${cmd.posto} ${cmd.nome}</strong><br>
                    <small>+ ${totalIntegrantes - 1} Auxiliares</small>
                </td>
                <td>
                    <span class="missao-destaque">MISSÃO: ${missaoNome}</span>
                    ${atividadeInfo}
                </td>
                <td style="text-align:center;">
                    <span class="${classeTempo}">${textoTempo}</span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <button onclick="verificarCheckGPS('${escala.id}')" class="btn-check-gps" title="Validar Posição">GPS</button>
                    
                    <button onclick="gerarPDFEscalamento(${index})" class="btn-info" style="margin-right: 5px;">PDF</button>
                    <button onclick="finalizarTurno(${escala.id}, false)" class="btn-danger">Baixa</button>
                </td>
            </tr>
        `;
    });
}

function verificarCheckGPS(escalaId) {
    // Integração futura com API
    console.log(`Check GPS ID: ${escalaId}`);
    alert("API GPS: Posição Validada com Sucesso.");
}

function finalizarTurno(id, automatico = false) {
    let ativas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    let historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    const index = ativas.findIndex(e => e.id === id);
    if (index > -1) {
        const escala = ativas[index];
        if (!automatico && !confirm(`Confirma a baixa manual do recurso ${escala.recursoId || escala.prefixo}?`)) return;
        escala.dataFim = new Date().toISOString();
        escala.baixaAutomatica = automatico;
        escala.responsavelBaixa = automatico ? "SISTEMA AUTOMÁTICO" : DESPACHANTE.nome;
        historico.push(escala);
        localStorage.setItem('historicoEscalas', JSON.stringify(historico));
        ativas.splice(index, 1);
        localStorage.setItem('escalasAtivas', JSON.stringify(ativas));
        if(!automatico) { popularSelects(); exibirMonitoramento(); }
    }
}

function gerarPDFEscalamento(index) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const escala = escalas[index];
    const os = ordens.find(o => o.numero == escala.osNumero);
    if (!os) return alert("Erro: OS não encontrada.");

    doc.setFontSize(18); doc.setTextColor(26, 35, 126); doc.text(`ORDEM DE ATIVAÇÃO DE SERVIÇO`, 14, 20);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 26);
    doc.setDrawColor(0); doc.line(14, 30, 196, 30);
    doc.setTextColor(0); doc.setFontSize(11);
    doc.text(`Recurso: ${escala.tipoRecurso || 'Viatura'} ${escala.recursoId || escala.prefixo}`, 14, 40);
    doc.text(`Ordem de Serviço: Nº ${os.numero} - ${os.nomeOS}`, 14, 46);
    const dataAtiv = new Date(escala.dataInicio).toLocaleString('pt-BR'); doc.text(`Ativado em: ${dataAtiv}`, 14, 52);
    const nomeDespachante = escala.despachante ? escala.despachante.nome : 'N/D';
    doc.setFontSize(10); doc.setTextColor(26, 35, 126); doc.text(`Despachado por: ${nomeDespachante}`, 14, 60);
    doc.setTextColor(26, 35, 126); doc.setFontSize(14); doc.text("Composição da Guarnição", 14, 75);
    let dadosEquipe = [];
    if(escala.equipe) { dadosEquipe = escala.equipe.map(m => [m.funcao, m.posto || '', m.nome || '', m.rg || '', m.tel || '-']); } 
    else { dadosEquipe = [['Comandante', '', 'Comandante', escala.rgComandante || '-', '-']]; }
    doc.autoTable({ startY: 80, head: [['Função', 'Posto', 'Nome', 'RG', 'Telefone']], body: dadosEquipe, theme: 'grid', headStyles: { fillColor: [40, 167, 69] } });
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14); doc.setTextColor(26, 35, 126); doc.text("Roteiro Operacional", 14, finalY);
    const dadosAtividades = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
    doc.autoTable({ startY: finalY + 5, head: [['Atividade', 'Início', 'Fim', 'Local']], body: dadosAtividades, theme: 'striped', headStyles: { fillColor: [26, 35, 126] } });
    doc.save(`Ativacao_${escala.recursoId || escala.prefixo}.pdf`);
}