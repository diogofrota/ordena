/**
 * HISTÓRICO DE PLANEJAMENTO
 * Funcionalidade: Consultar planejamentos passados (Somente Leitura)
 */

let todosPlanejamentos = [];
let diasDisponiveis = [];

document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    
    // Define o mês atual no input
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const inputMes = document.getElementById('filtroMes');
    
    inputMes.value = `${ano}-${mes}`;
    
    // Evento de mudança
    inputMes.addEventListener('change', filtrarDiasPorMes);

    // Carrega inicial
    filtrarDiasPorMes();
});

// --- 1. CARREGAMENTO DE DADOS ---
function carregarDados() {
    try {
        todosPlanejamentos = JSON.parse(localStorage.getItem('planejamentoDiario')) || [];
        
        // Extrai datas únicas
        const datasSet = new Set(todosPlanejamentos.map(item => item.data));
        
        // ORDENAÇÃO CRESCENTE (1 -> 31)
        // O método .sort() padrão já ordena strings ISO (YYYY-MM-DD) de forma crescente corretamente
        diasDisponiveis = Array.from(datasSet).sort(); 

    } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        todosPlanejamentos = [];
    }
}

// --- 2. FILTRAGEM POR MÊS ---
function filtrarDiasPorMes() {
    const valorMes = document.getElementById('filtroMes').value; // Formato YYYY-MM
    if (!valorMes) return;

    const containerDias = document.getElementById('listaDias');
    const resumo = document.getElementById('resumoMes');
    containerDias.innerHTML = '';
    
    // Oculta detalhes se mudar o filtro
    document.getElementById('detalhesContainer').style.display = 'none';

    // Filtra dias que começam com "YYYY-MM"
    const diasDoMes = diasDisponiveis.filter(dataISO => dataISO.startsWith(valorMes));

    if (diasDoMes.length === 0) {
        containerDias.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#999; padding: 20px;">Nenhum planejamento encontrado neste mês.</p>`;
        resumo.innerText = "0 dias encontrados";
        return;
    }

    resumo.innerText = `${diasDoMes.length} dias com planejamento registrado`;

    // Renderiza Cards dos Dias
    diasDoMes.forEach(dataISO => {
        // Conta itens desse dia
        const qtdItens = todosPlanejamentos.filter(p => p.data === dataISO).length;
        
        // Formata data para exibição
        const [ano, mes, dia] = dataISO.split('-');
        // Cria data usando fuso local para não perder o dia
        const dataObj = new Date(ano, mes - 1, dia);
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const nomeSemana = diasSemana[dataObj.getDay()];

        const card = document.createElement('div');
        card.className = 'card-dia';
        card.onclick = () => verDetalhesDia(dataISO, card);
        card.innerHTML = `
            <span class="dia-semana">${nomeSemana}</span>
            <span class="dia-numero">${dia}/${mes}</span>
            <span class="dia-itens">${qtdItens} Itens</span>
        `;
        containerDias.appendChild(card);
    });
}

// --- 3. EXIBIÇÃO DETALHADA (TABELA) ---
function verDetalhesDia(dataISO, cardElement) {
    // Visual: Marca card selecionado
    document.querySelectorAll('.card-dia').forEach(c => c.classList.remove('selecionado'));
    if(cardElement) cardElement.classList.add('selecionado');

    const container = document.getElementById('detalhesContainer');
    const tbody = document.getElementById('tabelaDetalhes');
    const titulo = document.getElementById('dataDetalheDisplay');

    // Formata Título
    const [ano, mes, dia] = dataISO.split('-');
    titulo.innerText = `${dia}/${mes}/${ano}`;

    // Filtra Itens
    const itensDoDia = todosPlanejamentos.filter(p => p.data === dataISO);
    
    // Renderiza Tabela (Mesmo padrão do planejamento.js)
    tbody.innerHTML = '';
    
    itensDoDia.forEach((item, index) => {
        // Ícones
        let icone = '🔹';
        if(item.recurso === 'Viatura') icone = '🚔';
        if(item.recurso === 'Moto') icone = '🏍️';
        if(item.recurso === 'Cabine') icone = '🏠';
        if(item.recurso === 'Setor') icone = '🚶';

        // Lógica visual da OE
        let oeContent = '<span style="color:#ccc; font-size:0.85em;">- Sem Evento -</span>';
        if(item.oeId) {
            oeContent = `
                <div class="cell-info">
                    <span class="col-oe-title">${item.nomeOE}</span>
                    <span class="badge-time time-oe">${item.horaInicioOE || '?'} - ${item.horaFimOE || '?'}</span>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-seq">${index + 1}</td>
            <td class="col-recurso">
                ${icone} <span>${item.recurso}</span>
            </td>
            
            <td>
                <div class="cell-info">
                    <span class="info-titulo">OS ${item.osNum}</span>
                    <span class="info-sub">${item.missaoOS || ''}</span>
                    <span class="badge-time time-os">${item.horaInicioOS || ''} - ${item.horaFimOS || ''}</span>
                </div>
            </td>
            
            <td>${oeContent}</td>
            
            <td class="col-sub">${item.textoSub || '-'}</td>
            <td style="font-size:0.9rem; color:#555;">${item.obs || ''}</td>
            
            <td style="text-align:center;">
                <button class="btn-print" onclick="imprimirItemIndividual('${item.id}')" title="Reimprimir Cartão">🖨️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Mostra a tabela
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fecharDetalhes() {
    document.getElementById('detalhesContainer').style.display = 'none';
    document.querySelectorAll('.card-dia').forEach(c => c.classList.remove('selecionado'));
}

// --- 4. REIMPRESSÃO (OPCIONAL) ---
function imprimirItemIndividual(id) {
    const item = todosPlanejamentos.find(i => i.id == id);
    if(!item) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(`CARTÃO DE PLANEJAMENTO (HISTÓRICO)`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Data Original: ${item.data.split('-').reverse().join('/')}`, 14, 30);
    
    doc.autoTable({
        startY: 40,
        head: [['OS', 'Missão', 'Turno', 'Evento', 'Recurso', 'Obs']],
        body: [[
            item.osNum, 
            item.missaoOS, 
            `${item.horaInicioOS}-${item.horaFimOS}`,
            item.nomeOE, 
            item.textoSub, 
            item.obs || '-'
        ]]
    });
    
    doc.save(`Historico_Plan_${item.id}.pdf`);
}