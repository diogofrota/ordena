/**
 * LÓGICA DE HISTÓRICO - ORDENS ESPECIAIS (APENAS INATIVAS)
 */

document.addEventListener('DOMContentLoaded', () => {
    renderizarHistorico();
});

function renderizarHistorico() {
    const container = document.getElementById('listaHistoricoEventos');
    const banco = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    container.innerHTML = '';

    // FILTRO: APENAS INATIVAS
    const inativas = banco.filter(e => e.status === 'Inativa');

    if (inativas.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666; padding: 40px;">Nenhuma operação encerrada no histórico.</p>';
        return;
    }

    inativas.sort((a,b) => b.id - a.id).forEach(evento => {
        const dataIni = new Date(evento.inicio).toLocaleString('pt-BR');
        const dataFim = new Date(evento.termino).toLocaleString('pt-BR');
        
        // Contagem de Recursos
        const counts = { Viatura: 0, Moto: 0, Cabine: 0, Setor: 0 };
        evento.subOrdens.forEach(os => {
            if(counts[os.tipo] !== undefined) counts[os.tipo]++;
            else counts[os.tipo] = 1;
        });

        const card = document.createElement('div');
        card.className = 'card-evento';
        card.innerHTML = `
            <div class="header-evento">
                <div><span style="font-size: 0.85rem; color: #999;">OE-${evento.id}</span><br><span class="titulo-evento">${evento.nome}</span></div>
                <span class="status-pill status-inativa">ENCERRADA</span>
            </div>
            
            <div style="font-size: 0.9rem; color: #555; margin-bottom: 10px;">
                <strong>Início:</strong> ${dataIni} &nbsp;|&nbsp; <strong>Término:</strong> ${dataFim}
            </div>

            <div class="recursos-grid">
                <div class="recurso-item"><span class="recurso-num">${counts.Viatura}</span><span class="recurso-label">Vtr</span></div>
                <div class="recurso-item"><span class="recurso-num">${counts.Moto}</span><span class="recurso-label">Motos</span></div>
                <div class="recurso-item"><span class="recurso-num">${counts.Cabine}</span><span class="recurso-label">Cabines</span></div>
                <div class="recurso-item"><span class="recurso-num">${counts.Setor}</span><span class="recurso-label">Setores</span></div>
            </div>

            <div class="obs-box">
                <strong>Observações Finais:</strong><br>
                ${evento.observacoesEncerramento || 'Nenhuma observação registrada.'}
            </div>

            <div style="margin-top: 15px; text-align: right;">
                <button class="btn-info" style="padding: 8px 20px;" onclick="alert('Funcionalidade de reimpressão em breve!')">🖨️ Reimprimir Documentos</button>
            </div>
        `;
        container.appendChild(card);
    });
}