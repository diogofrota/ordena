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

        const cmd = item.equipe[0];
        const cmdTexto = `${cmd.posto} ${cmd.nome}`;
        const equipeQtd = item.equipe.length;

        const recursoId = item.recursoId || '-';
        const tipoRecurso = item.tipoRecurso || '-';
        const osResumo = item.osResumo || {};
        const missao = osResumo.nomeOS || '-';

        // RESPONSIVO: data-label adicionado
        tbody.innerHTML += `
            <tr>
                <td data-label="Data"><strong>${dataFormatada}</strong></td>
                <td data-label="Início">${horaIni}</td>
                <td data-label="Fim">${horaFim}</td>
                <td data-label="OS"><span style="color:#1a237e; font-weight:bold;">${item.osNumero}</span></td>
                <td data-label="Missão">${missao}</td>
                <td data-label="Recurso">${tipoRecurso} ${recursoId}</td>
                <td data-label="Comandante">${cmdTexto}<br><small>RG: ${cmd.rg}</small></td>
                <td data-label="Auxiliares">${equipeQtd > 1 ? `+ ${equipeQtd - 1}` : '0'}</td>
                <td data-label="Duração"><span style="font-weight:600; color:#333;">${duracao}</span></td>
                <td data-label="Ações" style="text-align:center;">
                    <button onclick="reimprimirPDF(${index})" class="btn-info" style="padding: 6px 12px; font-size: 0.85rem;">📄 Relatório</button>
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
    // Recupera a lista ordenada da mesma forma que foi exibida
    let historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    historico.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));
    
    const escala = historico[index];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = ordens.find(o => o.numero == escala.osNumero);

    localStorage.setItem('historicoImpressaoTemp', JSON.stringify({ escala, os }));
    window.open('impressao_historico.html', '_blank');
};
