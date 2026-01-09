document.addEventListener('DOMContentLoaded', () => {
    popularSelects();
    exibirMonitoramento();
    setInterval(exibirMonitoramento, 30000); // Atualiza a cada 30s
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

    ordens.forEach(os => {
        let opt = document.createElement('option');
        opt.value = os.numero;
        opt.innerHTML = `OS: ${os.numero} [${os.inicioGeral}-${os.terminoGeral}]`;
        selectOS.appendChild(opt);
    });
}

document.getElementById('escalamentoForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const novaEscala = {
        prefixo: document.getElementById('selectVtr').value,
        osNumero: document.getElementById('selectOS').value,
        rgComandante: document.getElementById('rgComandante').value,
        telComandante: document.getElementById('telComandante').value,
        id: Date.now()
    };

    let escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    escalas.push(novaEscala);
    localStorage.setItem('escalasAtivas', JSON.stringify(escalas));
    
    document.getElementById('escalamentoForm').reset();
    exibirMonitoramento();
});

function exibirMonitoramento() {
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const corpoTabela = document.getElementById('listaMonitoramento');
    
    const agora = new Date();
    const horaAtual = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;

    corpoTabela.innerHTML = '';

    escalas.forEach((escala, index) => {
        const os = ordens.find(o => o.numero == escala.osNumero);
        let localAtual = "Fora de Turno";
        let emRota = false;

        if (os) {
            const atividade = os.atividades.find(at => horaAtual >= at.inicio && horaAtual <= at.fim);
            if (atividade) {
                localAtual = atividade.local;
                emRota = true;
            }
        }

        corpoTabela.innerHTML += `
            <tr>
                <td><b>${escala.osNumero}</b></td>
                <td>
                    <b>${escala.prefixo}</b><br>
                    <small>RG: ${escala.rgComandante}</small><br>
                    <small style="color: #666;">📞 ${escala.telComandante}</small>
                </td>
                <td>
                    <strong>${localAtual}</strong><br>
                    <small>Ref: ${horaAtual}</small>
                </td>
                <td>
                    <span class="status-badge ${emRota ? 'status-verde' : 'status-vermelho'}">
                        ${emRota ? 'EM POSIÇÃO' : 'FORA DE POSIÇÃO'}
                    </span>
                </td>
                <td style="text-align: center;">
                    <button onclick="gerarPDFEscalamento(${index})" class="btn-info" style="margin-right: 5px;">PDF</button>
                    <button onclick="removerEscala(${escala.id})" class="btn-danger">Finalizar</button>
                </td>
            </tr>
        `;
    });
}

function removerEscala(id) {
    if(confirm("Deseja finalizar o turno desta equipe?")) {
        let escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
        escalas = escalas.filter(e => e.id !== id);
        localStorage.setItem('escalasAtivas', JSON.stringify(escalas));
        exibirMonitoramento();
    }
}

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
    doc.text(`ORDEM DE MISSÃO - OS Nº ${os.numero}`, 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Viatura: ${escala.prefixo}`, 14, 30);
    doc.text(`Comandante (RG): ${escala.rgComandante}`, 14, 38);
    doc.text(`Contato: ${escala.telComandante}`, 14, 46);
    
    doc.setDrawColor(200);
    doc.line(14, 50, 196, 50); 
    doc.text(`Missão: ${os.nomeOS}`, 14, 60);
    doc.text(`Turno Geral: ${os.inicioGeral} às ${os.terminoGeral}`, 14, 68);

    const data = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
    doc.autoTable({
        startY: 75,
        head: [['Atividade', 'Início', 'Fim', 'Localização']],
        body: data,
        headStyles: { fillColor: [26, 35, 126] },
        theme: 'striped'
    });

    const dataGeracao = new Date().toLocaleString();
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Gerado em: ${dataGeracao}`, 14, doc.internal.pageSize.height - 10);

    doc.save(`Escala_OS${os.numero}_VTR${escala.prefixo}.pdf`);
}