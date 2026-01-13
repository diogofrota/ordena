document.addEventListener('DOMContentLoaded', () => {
    popularSelects();
    exibirMonitoramento();
    setInterval(exibirMonitoramento, 30000); 
});

function popularSelects() {
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    
    const selectVtr = document.getElementById('selectVtr');
    const selectOS = document.getElementById('selectOS');

    selectVtr.innerHTML = '<option value="">Selecione a Viatura...</option>';
    selectOS.innerHTML = '<option value="">Selecione a OS...</option>';

    viaturas.forEach(v => {
        let opt = document.createElement('option');
        opt.value = v.prefixo;
        opt.innerHTML = `${v.prefixo} (${v.placa})`;
        selectVtr.appendChild(opt);
    });

    // MUDANÇA AQUI: Filtrando apenas OS com status 'Ativa'
    const ordensAtivas = ordens.filter(os => os.status === 'Ativa');

    ordensAtivas.forEach(os => {
        let opt = document.createElement('option');
        opt.value = os.numero;
        opt.innerHTML = `OS: ${os.numero} - ${os.nomeOS} [${os.inicioGeral}-${os.terminoGeral}]`;
        selectOS.appendChild(opt);
    });
}

// --- GERENCIAMENTO DE INTEGRANTES DINÂMICOS ---
let contadorIntegrantes = 0;
const MAX_INTEGRANTES = 5; 

function adicionarIntegrante() {
    if (contadorIntegrantes >= MAX_INTEGRANTES) {
        alert("Máximo de 6 integrantes atingido.");
        return;
    }

    const container = document.getElementById('listaIntegrantes');
    const idUnico = Date.now();
    
    const div = document.createElement('div');
    div.className = 'box-integrante';
    div.id = `integrante-${idUnico}`;
    
    div.innerHTML = `
        <div class="row-integrante">
            <div style="flex: 1;">
                <select name="posto" class="input-padrao" required>
                    <option value="SD">SD</option>
                    <option value="CB">CB</option>
                    <option value="SGT">SGT</option>
                    <option value="SUBTEN">SUBTEN</option>
                    <option value="ASP">ASP</option>
                    <option value="TEN">TEN</option>
                </select>
            </div>
            <div style="flex: 2;">
                <input type="text" name="nome" class="input-padrao" placeholder="Nome de Guerra" required>
            </div>
            <div style="flex: 1;">
                <input type="text" name="rg" class="input-padrao" placeholder="RG" required>
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="removerLinhaIntegrante('${idUnico}')">X</button>
    `;

    container.appendChild(div);
    contadorIntegrantes++;
}

function removerLinhaIntegrante(id) {
    const div = document.getElementById(`integrante-${id}`);
    div.remove();
    contadorIntegrantes--;
}

// --- SALVAR ESCALA ---
document.getElementById('escalamentoForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const prefixo = document.getElementById('selectVtr').value;
    const osNumero = document.getElementById('selectOS').value;

    const comandante = {
        posto: document.getElementById('postoCmd').value,
        nome: document.getElementById('nomeCmd').value,
        rg: document.getElementById('rgCmd').value,
        tel: document.getElementById('telCmd').value,
        funcao: "Comandante"
    };

    const integrantesExtras = [];
    const boxes = document.querySelectorAll('#listaIntegrantes .box-integrante');
    
    boxes.forEach(box => {
        const posto = box.querySelector('select[name="posto"]').value;
        const nome = box.querySelector('input[name="nome"]').value;
        const rg = box.querySelector('input[name="rg"]').value;
        integrantesExtras.push({ posto, nome, rg, funcao: "Auxiliar" });
    });

    const novaEscala = {
        id: Date.now(),
        dataInicio: new Date().toISOString(),
        prefixo: prefixo,
        osNumero: osNumero,
        equipe: [comandante, ...integrantesExtras] 
    };

    let escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    escalas.push(novaEscala);
    localStorage.setItem('escalasAtivas', JSON.stringify(escalas));
    
    document.getElementById('escalamentoForm').reset();
    document.getElementById('listaIntegrantes').innerHTML = '';
    contadorIntegrantes = 0;
    
    exibirMonitoramento();
    alert("Equipe ativada com sucesso!");
});

// --- EXIBIÇÃO SEGURA ---
function exibirMonitoramento() {
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const corpoTabela = document.getElementById('listaMonitoramento');
    
    const agora = new Date();
    const horaAtual = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;

    corpoTabela.innerHTML = '';

    escalas.forEach((escala, index) => {
        const os = ordens.find(o => o.numero == escala.osNumero);
        
        // Proteção contra dados antigos
        let cmd, totalIntegrantes;
        if (escala.equipe && Array.isArray(escala.equipe) && escala.equipe.length > 0) {
            cmd = escala.equipe[0];
            totalIntegrantes = escala.equipe.length;
        } else {
            cmd = {
                posto: '',
                nome: 'Comandante',
                rg: escala.rgComandante || 'S/D',
                tel: escala.telComandante || '-'
            };
            totalIntegrantes = 1;
        }

        let localAtual = "Fora de Turno";
        let emRota = false;

        if (os) {
            const atividade = os.atividades.find(at => horaAtual >= at.inicio && horaAtual <= at.fim);
            if (atividade) {
                localAtual = atividade.local;
                emRota = true;
            }
        }

        const dataAtivacao = escala.dataInicio ? new Date(escala.dataInicio).toLocaleString('pt-BR') : '-';

        corpoTabela.innerHTML += `
            <tr>
                <td>
                    <strong style="font-size: 1.1em; color:#1a237e;">OS ${escala.osNumero}</strong><br>
                    <small>${os ? os.nomeOS : ''}</small><br>
                    Vtr: <b>${escala.prefixo}</b><br>
                    <small style="color:#666">Início: ${dataAtivacao}</small>
                </td>
                <td>
                    <strong>${cmd.posto} ${cmd.nome}</strong> (Cmd)<br>
                    <small>RG: ${cmd.rg} | Tel: ${cmd.tel}</small><br>
                    ${totalIntegrantes > 1 ? `<small style="color: #28a745; font-weight:bold;">+ ${totalIntegrantes - 1} Auxiliares</small>` : ''}
                </td>
                <td>
                    <div style="margin-bottom: 5px;">
                        <span class="status-badge ${emRota ? 'status-verde' : 'status-vermelho'}">
                            ${emRota ? 'EM POSIÇÃO' : 'FORA DE POSIÇÃO'}
                        </span>
                    </div>
                    <strong>${localAtual}</strong>
                </td>
                <td style="text-align: center;">
                    <button onclick="gerarPDFEscalamento(${index})" class="btn-info" style="margin-right: 5px;">PDF</button>
                    <button onclick="finalizarTurno(${escala.id})" class="btn-danger">Finalizar</button>
                </td>
            </tr>
        `;
    });
}

function finalizarTurno(id) {
    if(!confirm("Deseja encerrar o turno desta equipe e arquivar o registro?")) return;

    let ativas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    let historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];

    const escalaIndex = ativas.findIndex(e => e.id === id);
    if (escalaIndex > -1) {
        const escala = ativas[escalaIndex];
        escala.dataFim = new Date().toISOString(); 

        historico.push(escala);
        localStorage.setItem('historicoEscalas', JSON.stringify(historico));

        ativas.splice(escalaIndex, 1);
        localStorage.setItem('escalasAtivas', JSON.stringify(ativas));
        
        exibirMonitoramento();
    }
}

// --- PDF ATUALIZADO ---
function gerarPDFEscalamento(index) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    
    const escala = escalas[index];
    const os = ordens.find(o => o.numero == escala.osNumero);

    if (!os) return alert("Ordem de serviço vinculada não encontrada!");

    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text(`RELATÓRIO DE MISSÃO - OS Nº ${os.numero}`, 14, 20);
    
    // Tratamento para PDF
    let equipeLista = escala.equipe;
    if (!equipeLista) {
        equipeLista = [{
            funcao: "Comandante",
            posto: "",
            nome: "Comandante",
            rg: escala.rgComandante || "-",
            tel: escala.telComandante || "-"
        }];
    }

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Viatura: ${escala.prefixo}`, 14, 30);
    doc.text(`Início do Turno: ${escala.dataInicio ? new Date(escala.dataInicio).toLocaleString('pt-BR') : '-'}`, 14, 36);
    
    doc.setDrawColor(200);
    doc.line(14, 42, 196, 42);
    doc.setFontSize(14);
    doc.setTextColor(26, 35, 126);
    doc.text("Composição da Guarnição", 14, 50);

    const dadosEquipe = equipeLista.map(m => [m.funcao, m.posto || '', m.nome || '', m.rg || '', m.tel || '-']);
    
    doc.autoTable({
        startY: 55,
        head: [['Função', 'Posto', 'Nome', 'RG', 'Telefone']],
        body: dadosEquipe,
        theme: 'grid',
        headStyles: { fillColor: [40, 167, 69] }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(26, 35, 126);
    doc.text("Roteiro da Ordem de Serviço", 14, finalY);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Missão: ${os.nomeOS}`, 14, finalY + 8);
    doc.text(`Horário Previsto: ${os.inicioGeral} às ${os.terminoGeral}`, 14, finalY + 14);

    const dadosAtividades = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
    doc.autoTable({
        startY: finalY + 20,
        head: [['Atividade', 'Início', 'Fim', 'Localização']],
        body: dadosAtividades,
        theme: 'striped',
        headStyles: { fillColor: [26, 35, 126] }
    });

    // AJUSTE 2: INSERIR PRESCRIÇÕES DIVERSAS SE HOUVER
    if (os.prescricoes) {
        let yPrescricoes = doc.lastAutoTable.finalY + 15;
        
        // Verifica se precisa de nova página
        if (yPrescricoes > 250) {
            doc.addPage();
            yPrescricoes = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(26, 35, 126);
        doc.text("Prescrições Diversas / Observações:", 14, yPrescricoes);
        
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        const splitText = doc.splitTextToSize(os.prescricoes, 180);
        doc.text(splitText, 14, yPrescricoes + 8);
    }

    const dataGeracao = new Date().toLocaleString();
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Documento gerado pelo sistema ORDENA em: ${dataGeracao}`, 14, doc.internal.pageSize.height - 10);

    doc.save(`Escala_OS${os.numero}_VTR${escala.prefixo}.pdf`);
}