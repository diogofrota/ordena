let graficoFrotaInstance = null;
let graficoSemanalInstance = null;
let graficoHorarioInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    carregarPaginaInicial();
    configurarLimpezaDados();
});

function lerListaStorage(chave) {
    try {
        const dados = JSON.parse(OrdenaStorage.getItem(chave));
        return Array.isArray(dados) ? dados : [];
    } catch (error) {
        console.warn(`Não foi possível ler os dados de "${chave}".`, error);
        return [];
    }
}

function atualizarTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.innerText = valor;
}

function registroEstaAtivo(registro) {
    const status = String(registro && registro.status ? registro.status : '').trim().toLowerCase();
    return status === 'ativo' || status === 'ativa';
}

function obterContextoGrafico(idCanvas) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return null;

    const carregamento = canvas.parentElement ? canvas.parentElement.querySelector('.chart-loading') : null;

    if (typeof Chart === 'undefined') {
        canvas.hidden = true;
        if (carregamento) {
            carregamento.hidden = false;
            carregamento.classList.add('is-error');
            carregamento.textContent = 'Não foi possível carregar o gráfico. Verifique sua conexão e atualize a página.';
        }
        console.error('Chart.js não está disponível para renderizar os indicadores analíticos.');
        return null;
    }

    if (carregamento) carregamento.hidden = true;
    canvas.hidden = false;
    return canvas.getContext('2d');
}

function carregarPaginaInicial() {
    const viaturas = lerListaStorage('viaturas');
    const locais = lerListaStorage('locaisCadastrados');
    const pontosPatrulhamento = lerListaStorage('pontosPatrulhamento');
    const ordens = lerListaStorage('ordensServico');
    const escalasAtivas = lerListaStorage('escalasAtivas');
    const historico = lerListaStorage('historicoEscalas');
    const registrosDeAtividade = [...historico, ...escalasAtivas];

    atualizarTexto('totalViaturas', viaturas.filter(registroEstaAtivo).length);
    atualizarTexto('totalBaseamentos', locais.filter(registroEstaAtivo).length);
    atualizarTexto('totalPatrulhamento', pontosPatrulhamento.filter(registroEstaAtivo).length);
    atualizarTexto('totalOS', ordens.filter(registroEstaAtivo).length);

    renderizarGraficoFrota(calcularComposicaoFrota(viaturas));
    renderizarGraficoSemanal(calcularMediaSemanal(registrosDeAtividade));
    renderizarGraficoHorario(calcularCurva24h(registrosDeAtividade));
}

function calcularComposicaoFrota(viaturas) {
    const contaTipos = { 'Carro': 0, 'Motocicleta': 0, 'Bicicleta': 0, 'Triciclo': 0, 'Outros': 0 };

    viaturas.forEach(viatura => {
        const tipo = String(viatura.tipo || 'Carro');
        if (tipo.includes('Viatura') || tipo.includes('Carro')) contaTipos['Carro']++;
        else if (tipo.includes('Moto')) contaTipos['Motocicleta']++;
        else if (tipo.includes('Bicicleta')) contaTipos['Bicicleta']++;
        else if (tipo.includes('Triciclo')) contaTipos['Triciclo']++;
        else contaTipos['Outros']++;
    });

    return contaTipos;
}

function calcularMediaSemanal(registros) {
    const somaEfetivoDia = [0, 0, 0, 0, 0, 0, 0];
    const datasUnicasDia = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];

    registros.forEach(registro => {
        if (!registro.dataInicio) return;

        const data = new Date(registro.dataInicio);
        if (Number.isNaN(data.getTime())) return;

        const diaSemana = data.getDay();
        const dataFormatada = data.toLocaleDateString('pt-BR');
        const quantidadeEquipe = registro.equipe ? registro.equipe.length : 1;

        somaEfetivoDia[diaSemana] += quantidadeEquipe;
        datasUnicasDia[diaSemana].add(dataFormatada);
    });

    return somaEfetivoDia.map((soma, indice) => {
        const quantidadeDias = datasUnicasDia[indice].size;
        return quantidadeDias === 0 ? 0 : parseFloat((soma / quantidadeDias).toFixed(1));
    });
}

function calcularCurva24h(registros) {
    const curva24h = new Array(24).fill(0);

    registros.forEach(registro => {
        const inicio = new Date(registro.dataInicio);
        const fim = registro.dataFim ? new Date(registro.dataFim) : new Date();
        if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return;

        let horaAtual = inicio.getHours();
        const horaFim = fim.getHours();
        let quantidadeHoras = 0;

        while (quantidadeHoras < 24) {
            curva24h[horaAtual]++;
            if (horaAtual === horaFim) break;
            horaAtual = horaAtual === 23 ? 0 : horaAtual + 1;
            quantidadeHoras++;
        }
    });

    return curva24h;
}

function renderizarGraficoFrota(dados) {
    const contexto = obterContextoGrafico('graficoFrota');
    if (!contexto) return;
    if (graficoFrotaInstance) graficoFrotaInstance.destroy();

    graficoFrotaInstance = new Chart(contexto, {
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
    const contexto = obterContextoGrafico('graficoSemanal');
    if (!contexto) return;
    if (graficoSemanalInstance) graficoSemanalInstance.destroy();

    graficoSemanalInstance = new Chart(contexto, {
        type: 'bar',
        data: {
            labels: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
            datasets: [{
                label: 'Média de Policiais (Por Dia)',
                data: dadosMedia,
                backgroundColor: '#28a745',
                borderRadius: 4,
                barPercentage: 0.6
            }]
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
                        label: context => `${context.raw} Policiais (Média)`
                    }
                }
            }
        }
    });
}

function renderizarGraficoHorario(dados24h) {
    const contexto = obterContextoGrafico('graficoHorario');
    if (!contexto) return;
    if (graficoHorarioInstance) graficoHorarioInstance.destroy();

    const labelsHoras = Array.from({ length: 24 }, (_, indice) => `${indice.toString().padStart(2, '0')}h`);

    graficoHorarioInstance = new Chart(contexto, {
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

function configurarLimpezaDados() {
    const btnClear = document.getElementById('btnClearStorage');
    if (!btnClear) return;

    btnClear.addEventListener('click', () => {
        if (confirm('Isso vai apagar todos os dados salvos neste navegador. Deseja continuar?')) {
            // Legado: OrdenaStorage.clear(); location.reload();
            alert('Limpeza desabilitada. Os dados persistentes devem ser inativados pelos cadastros.');
        }
    });
}
