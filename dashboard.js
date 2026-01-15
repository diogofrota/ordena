let graficoFrotaInstance = null;
let graficoSemanalInstance = null;
let graficoHorarioInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    atualizarDataHeader();
    carregarDadosAnaliticos();
});

function atualizarDataHeader() {
    const agora = new Date();
    const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dataAtual').innerText = agora.toLocaleDateString('pt-BR', opcoes).replace(/^\w/, c => c.toUpperCase());
}

function carregarDadosAnaliticos() {
    // 1. CARREGAR DADOS
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    
    const escalasAtivas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    
    const todosRegistros = [...historico, ...escalasAtivas];

    // --- A. CÁLCULO DE KPIS (CARDS) ---
    let setoresAtivosCount = 0;
    escalasAtivas.forEach(e => {
        if(e.tipoRecurso === 'Setor') setoresAtivosCount++;
    });
    
    document.getElementById('kpiSetoresAtivos').innerText = setoresAtivosCount;
    document.getElementById('kpiTotalOS').innerText = ordens.length;
    document.getElementById('kpiLocais').innerText = locais.length;
    document.getElementById('kpiSetoresTotal').innerText = setores.length;

    // --- B. DADOS PARA GRÁFICOS ---

    // 1. Frota Cadastrada (Rosca)
    let contaTipos = { 'Carro': 0, 'Motocicleta': 0, 'Bicicleta': 0, 'Triciclo': 0, 'Outros': 0 };
    viaturas.forEach(v => {
        let tipo = v.tipo || 'Carro'; 
        if (tipo.includes('Viatura') || tipo.includes('Carro')) contaTipos['Carro']++;
        else if (tipo.includes('Moto')) contaTipos['Motocicleta']++;
        else if (tipo.includes('Bicicleta')) contaTipos['Bicicleta']++;
        else if (tipo.includes('Triciclo')) contaTipos['Triciclo']++;
        else contaTipos['Outros']++;
    });

    // 2. Histórico por Dia da Semana (CÁLCULO DA MÉDIA)
    // Arrays para armazenar a soma total de policiais e as datas únicas para cada dia da semana (0=Dom, 6=Sab)
    let somaEfetivoDia = [0,0,0,0,0,0,0]; 
    let datasUnicasDia = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];

    todosRegistros.forEach(reg => {
        if (!reg.dataInicio) return;
        const dataObj = new Date(reg.dataInicio);
        if (isNaN(dataObj)) return; // Segurança contra datas inválidas

        const diaSemana = dataObj.getDay(); 
        const dataString = dataObj.toLocaleDateString('pt-BR'); // Ex: "15/01/2026"
        
        // Conta tamanho da equipe (Policial + Auxiliares)
        const qtdEquipe = reg.equipe ? reg.equipe.length : 1;
        
        somaEfetivoDia[diaSemana] += qtdEquipe;
        datasUnicasDia[diaSemana].add(dataString);
    });

    // Calcula a média: Soma Total / Quantidade de Dias Únicos com atividade
    let mediaEfetivoDia = somaEfetivoDia.map((soma, i) => {
        const diasUnicos = datasUnicasDia[i].size;
        // Se não houve atividade naquele dia da semana em nenhuma data, média é 0
        // toFixed(1) deixa com uma casa decimal (ex: 5.5)
        return diasUnicos === 0 ? 0 : parseFloat((soma / diasUnicos).toFixed(1));
    });

    // 3. Curva de Atividade 24h
    let curva24h = new Array(24).fill(0);
    todosRegistros.forEach(reg => {
        const inicio = new Date(reg.dataInicio);
        const fim = reg.dataFim ? new Date(reg.dataFim) : new Date();
        
        let horaAtual = inicio.getHours();
        const horaFim = fim.getHours();
        
        let count = 0;
        while (count < 24) { 
            curva24h[horaAtual]++;
            if (horaAtual === horaFim) break;
            horaAtual++;
            if (horaAtual > 23) horaAtual = 0; 
            count++;
        }
    });

    // --- RENDERIZAR GRÁFICOS ---
    renderizarGraficoFrota(contaTipos);
    renderizarGraficoSemanal(mediaEfetivoDia); // Passa a MÉDIA calculada
    renderizarGraficoHorario(curva24h);
}

// --- FUNÇÕES CHART.JS ---

function renderizarGraficoFrota(dados) {
    const ctx = document.getElementById('graficoFrota').getContext('2d');
    if (graficoFrotaInstance) graficoFrotaInstance.destroy();

    graficoFrotaInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Carros', 'Motos', 'Bicicletas', 'Triciclos'],
            datasets: [{
                data: [dados['Carro'], dados['Motocicleta'], dados['Bicicleta'], dados['Triciclo']],
                backgroundColor: ['#1a237e', '#fd7e14', '#28a745', '#17a2b8'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderizarGraficoSemanal(dadosMedia) {
    const ctx = document.getElementById('graficoSemanal').getContext('2d');
    if (graficoSemanalInstance) graficoSemanalInstance.destroy();

    graficoSemanalInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
            datasets: [
                {
                    label: 'Média de Policiais (Por Dia)',
                    data: dadosMedia,
                    backgroundColor: '#28a745', 
                    borderRadius: 4,
                    barPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true,
                    title: { display: true, text: 'Média de Efetivo' }
                } 
            },
            plugins: {
                legend: { display: false }, 
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.raw} Policiais (Média)`;
                        }
                    }
                }
            }
        }
    });
}

function renderizarGraficoHorario(dados24h) {
    const ctx = document.getElementById('graficoHorario').getContext('2d');
    if (graficoHorarioInstance) graficoHorarioInstance.destroy();

    const labelsHoras = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}h`);

    graficoHorarioInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsHoras,
            datasets: [{
                label: 'Volume de Policiamento (Presença)',
                data: dados24h,
                borderColor: '#fd7e14',
                backgroundColor: 'rgba(253, 126, 20, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- EXPORTAR PDF (FIT TO PAGE) ---
window.exportarDashboardPDF = async function() {
    const btn = document.querySelector('.btn-export');
    const conteudo = document.getElementById('conteudoDashboard');
    
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = "⏳ Gerando...";
    btn.disabled = true;
    
    // Oculta o botão temporariamente
    btn.style.opacity = '0'; 

    try {
        const canvas = await html2canvas(conteudo, { 
            scale: 2, 
            useCORS: true,
            scrollY: -window.scrollY 
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4'); 
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Ajusta escala para caber na página (Fit to Page)
        const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        
        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;
        
        // Centraliza
        const x = (pageWidth - finalWidth) / 2;
        const y = 0; 

        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
        pdf.save('Relatorio_Gestao_Integrada.pdf');

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Ocorreu um erro ao gerar o PDF.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
};