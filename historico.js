document.addEventListener('DOMContentLoaded', () => {
    carregarHistorico();
});

function carregarHistorico() {
    const historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    const tbody = document.getElementById('listaHistorico');
    
    // ORDENAÇÃO: Do mais recente para o mais antigo
    historico.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));

    tbody.innerHTML = '';

    if (historico.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #666;">Nenhum registro encontrado no histórico.</td></tr>';
        return;
    }

    historico.forEach((item, index) => {
        // Tratamento de dados para exibição
        const dataIni = new Date(item.dataInicio);
        const dataFim = new Date(item.dataFim);
        
        // Formata data e hora
        const dataFormatada = dataIni.toLocaleDateString('pt-BR');
        const horaIni = dataIni.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        const horaFim = dataFim.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

        // Cálculo de duração
        const diffMs = dataFim - dataIni;
        const diffHrs = Math.floor((diffMs % 86400000) / 3600000); // horas
        const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutos
        const duracao = `${diffHrs}h ${diffMins}min`;

        // Tratamento do Comandante (compatibilidade com dados antigos)
        let cmdTexto = "N/D";
        let equipeQtd = 0;

        if (item.equipe && Array.isArray(item.equipe)) {
            const cmd = item.equipe[0];
            cmdTexto = `<strong>${cmd.posto} ${cmd.nome}</strong><br><small>RG: ${cmd.rg}</small>`;
            equipeQtd = item.equipe.length;
        } else {
            // Fallback para versões antigas
            cmdTexto = `<strong>Comandante</strong><br><small>RG: ${item.rgComandante || '-'}</small>`;
            equipeQtd = 1;
        }

        // RESPONSIVO: data-label adicionado
        tbody.innerHTML += `
            <tr>
                <td data-label="Data / Período">
                    <strong>${dataFormatada}</strong><br>
                    <small>${horaIni} às ${horaFim}</small>
                </td>
                <td data-label="OS / Viatura">
                    <span style="color:#1a237e; font-weight:bold;">OS ${item.osNumero}</span><br>
                    Viatura: ${item.prefixo}
                </td>
                <td data-label="Comando da Equipe">
                    ${cmdTexto}<br>
                    ${equipeQtd > 1 ? `<small style="color:#28a745">+ ${equipeQtd - 1} Auxiliares</small>` : ''}
                </td>
                <td data-label="Duração">
                    <span class="status-badge" style="background:#6c757d;">${duracao}</span>
                </td>
                <td data-label="Ações" style="text-align: center;">
                    <div style="display:flex; justify-content:flex-end;">
                        <button onclick="reimprimirPDF(${index})" class="btn-info" style="padding: 5px 10px; font-size: 0.8rem;">📄 Relatório</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function filtrarHistorico() {
    const termo = document.getElementById('filtroBusca').value.toLowerCase();
    const linhas = document.querySelectorAll('#listaHistorico tr');

    linhas.forEach(linha => {
        const texto = linha.innerText.toLowerCase();
        linha.style.display = texto.includes(termo) ? '' : 'none';
    });
}

// --- REIMPRESSÃO DE PDF (Lógica Adaptada para Histórico com Prescrições) ---
function reimprimirPDF(index) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Recupera a lista ordenada da mesma forma que foi exibida
    let historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    historico.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
    
    const escala = historico[index];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = ordens.find(o => o.numero == escala.osNumero);

    // Cabeçalho
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text(`RELATÓRIO DE SERVIÇO (FINALIZADO)`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`OS Nº ${escala.osNumero} | Viatura: ${escala.prefixo}`, 14, 28);

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Início: ${new Date(escala.dataInicio).toLocaleString('pt-BR')}`, 14, 38);
    doc.text(`Término: ${new Date(escala.dataFim).toLocaleString('pt-BR')}`, 14, 44);

    // Linha Divisória
    doc.setDrawColor(200);
    doc.line(14, 48, 196, 48);

    // Dados da Equipe
    doc.setFontSize(14);
    doc.setTextColor(26, 35, 126);
    doc.text("Equipe Executora", 14, 58);

    let dadosEquipe = [];
    if (escala.equipe) {
        dadosEquipe = escala.equipe.map(m => [m.funcao, m.posto || '', m.nome || '', m.rg || '']);
    } else {
        dadosEquipe = [['Comandante', '', 'N/D', escala.rgComandante || '-']];
    }

    doc.autoTable({
        startY: 62,
        head: [['Função', 'Posto', 'Nome', 'RG']],
        body: dadosEquipe,
        theme: 'grid',
        headStyles: { fillColor: [108, 117, 125] } // Cinza para histórico
    });

    // Se a OS ainda existir no sistema, mostramos o roteiro
    if (os) {
        let finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.setTextColor(26, 35, 126);
        doc.text("Planejamento da Missão", 14, finalY);
        
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`Missão: ${os.nomeOS}`, 14, finalY + 8);

        const dadosAtividades = os.atividades.map(a => [a.tipo, a.inicio, a.fim, a.local]);
        doc.autoTable({
            startY: finalY + 12,
            head: [['Atividade', 'Início', 'Fim', 'Local']],
            body: dadosAtividades,
            theme: 'striped',
            headStyles: { fillColor: [26, 35, 126] }
        });

        // --- NOVO: INSERIR PRESCRIÇÕES DIVERSAS ---
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
            
            // Quebra o texto automaticamente para caber na página
            const splitText = doc.splitTextToSize(os.prescricoes, 180);
            doc.text(splitText, 14, yPrescricoes + 8);
        }
        // ------------------------------------------

    } else {
        let finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("(Os detalhes desta OS foram excluídos do planejamento, mas o registro da equipe permanece preservado)", 14, finalY);
    }

    doc.save(`Historico_OS${escala.osNumero}_${escala.prefixo}.pdf`);
};