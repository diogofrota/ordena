let map;
let markersLayer; // Camada para agrupar os marcadores e limpar fácil

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapa();
    atualizarMapaTatico();
    
    // Atualiza tudo a cada 5 segundos (Tempo Real)
    setInterval(atualizarMapaTatico, 5000);
});

function iniciarMapa() {
    // Inicia focado no RJ (será ajustado automaticamente depois)
    map = L.map('mapaOperacional').setView([-22.9068, -43.1729], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; ORDENA SGO'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

function atualizarMapaTatico() {
    // 1. CARREGAR DADOS DO BANCO
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    
    // Precisamos de um "Dicionário de Locais" para achar lat/lng pelo nome
    // Vamos juntar Locais, Cabines e Setores em uma lista única de busca
    const todosLocais = [
        ...(JSON.parse(localStorage.getItem('locaisCadastrados')) || []),
        ...(JSON.parse(localStorage.getItem('cabines')) || []),
        ...(JSON.parse(localStorage.getItem('setores')) || [])
    ];

    // Variáveis de Contagem (Dashboard)
    let stats = {
        efetivo: 0,
        carros: 0,
        motos: 0,
        setores: 0,
        cabines: 0
    };

    // Limpa marcadores antigos para redesenhar
    markersLayer.clearLayers();

    const agora = new Date();
    const horaAtualStr = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`;

    // 2. PROCESSAR CADA EQUIPE NA RUA
    escalas.forEach(escala => {
        // A. Contabilizar Stats
        const qtdEquipe = escala.equipe ? escala.equipe.length : 1;
        stats.efetivo += qtdEquipe;

        // Categoriza o recurso
        const tipoRecurso = normalizarTipo(escala.tipoRecurso || 'Viatura');
        if (tipoRecurso === 'moto') stats.motos++;
        else if (tipoRecurso === 'setor') stats.setores++;
        else if (tipoRecurso === 'cabine') stats.cabines++;
        else stats.carros++; // Default (Viatura/Carro/Triciclo)

        // B. Descobrir Onde Eles Estão (Geolocalização)
        const os = ordens.find(o => o.numero == escala.osNumero);
        if (!os) return;

        // Encontra a atividade atual baseada na hora
        // (Reutiliza lógica simplificada de hora)
        const atividadeAtual = os.atividades.find(at => {
            return horaAtualStr >= at.inicio && horaAtualStr <= at.fim;
        });

        if (atividadeAtual && atividadeAtual.local) {
            // Tenta achar as coordenadas deste local no nosso banco
            const localEncontrado = encontrarCoordenadas(atividadeAtual.local, todosLocais);

            if (localEncontrado) {
                adicionarPinoNoMapa(escala, localEncontrado, atividadeAtual, tipoRecurso);
            }
        }
    });

    // 3. ATUALIZAR DASHBOARD HTML
    document.getElementById('kpiEfetivo').innerText = stats.efetivo;
    document.getElementById('kpiCarros').innerText = stats.carros;
    document.getElementById('kpiMotos').innerText = stats.motos;
    document.getElementById('kpiSetores').innerText = stats.setores;
    document.getElementById('kpiCabines').innerText = stats.cabines;
}

// --- FUNÇÕES AUXILIARES ---

function normalizarTipo(tipo) {
    tipo = tipo.toLowerCase();
    if (tipo.includes('moto')) return 'moto';
    if (tipo.includes('setor')) return 'setor';
    if (tipo.includes('cabine')) return 'cabine';
    return 'carro';
}

function encontrarCoordenadas(textoLocal, listaLocais) {
    // O textoLocal na OS vem como "[Apelido] - Rua tal..."
    // Tentamos dar match pelo Apelido ou ID que está entre colchetes ou no início
    
    // Estratégia 1: Busca exata pelo texto completo (difícil acontecer)
    let match = listaLocais.find(l => {
        const textoCompletoBanco = `[${l.apelido || l.codigo}] - ${l.rua}, ${l.numero || 'S/N'} - ${l.bairro}`;
        return textoLocal === textoCompletoBanco;
    });

    // Estratégia 2: Busca por lat/lng se já estiver salvo na OS (futuro)
    
    // Estratégia 3: Busca inteligente por Apelido/Código dentro da string
    if (!match) {
        match = listaLocais.find(l => {
            // Verifica se o código (ex: S-21-0001) ou Apelido está contido na string da OS
            const chave = l.codigo || l.apelido;
            return chave && textoLocal.includes(chave);
        });
    }

    if (match && match.lat && match.lng) {
        return { lat: match.lat, lng: match.lng };
    }
    return null;
}

function adicionarPinoNoMapa(escala, coords, atividade, tipo) {
    let iconeEmoji = '🚓';
    let corPin = 'pin-viatura';

    if (tipo === 'moto') { iconeEmoji = '🏍️'; corPin = 'pin-moto'; }
    if (tipo === 'setor') { iconeEmoji = '👮'; corPin = 'pin-setor'; }
    if (tipo === 'cabine') { iconeEmoji = '🏠'; corPin = 'pin-cabine'; }

    // Cria o ícone HTML customizado
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style='background-color:${getCorHex(corPin)}' class='marker-pin'></div><div class='marker-icon'>${iconeEmoji}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });

    const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(markersLayer);

    // Conteúdo do Popup
    const comandante = escala.equipe[0];
    const htmlPopup = `
        <div class="popup-header">${iconeEmoji} ${escala.recursoId}</div>
        <div class="popup-body">
            <strong>Missão:</strong> ${atividade.tipo}<br>
            <strong>Local:</strong> ${atividade.local}<br>
            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
            <strong>Cmd:</strong> ${comandante.posto} ${comandante.nome}<br>
            <strong>Tel:</strong> ${comandante.tel || '-'}<br>
            <small>OS nº ${escala.osNumero} (${escala.tipoRecurso})</small>
        </div>
    `;

    marker.bindPopup(htmlPopup);
}

function getCorHex(classe) {
    if (classe === 'pin-moto') return '#fd7e14';
    if (classe === 'pin-setor') return '#28a745';
    if (classe === 'pin-cabine') return '#6f42c1';
    return '#1a237e'; // Azul padrão
}