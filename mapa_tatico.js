let map;
let markersLayer;

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapa();
    atualizarMapaTatico();
    setInterval(atualizarMapaTatico, 5000);
});

function iniciarMapa() {
    map = L.map('mapaOperacional').setView([-22.9068, -43.1729], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; ORDENA SGO'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

function atualizarMapaTatico() {
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    
    const todosLocais = [
        ...(JSON.parse(localStorage.getItem('locaisCadastrados')) || []),
        ...(JSON.parse(localStorage.getItem('cabines')) || []),
        ...(JSON.parse(localStorage.getItem('setores')) || [])
    ];

    let stats = {
        efetivo: 0, carros: 0, motos: 0, setores: 0, cabines: 0,
        patrulha: 0, base: 0, 
        // Agora separados novamente
        desloc: 0, intervalo: 0, prelecao: 0, retorno: 0
    };

    markersLayer.clearLayers();

    const agora = new Date();
    const horaAtualStr = `${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`;

    escalas.forEach(escala => {
        const qtdEquipe = escala.equipe ? escala.equipe.length : 1;
        stats.efetivo += qtdEquipe;

        const tipoRecurso = normalizarTipo(escala.tipoRecurso || 'Viatura');
        if (tipoRecurso === 'moto') stats.motos++;
        else if (tipoRecurso === 'setor') stats.setores++;
        else if (tipoRecurso === 'cabine') stats.cabines++;
        else stats.carros++; 

        const os = ordens.find(o => o.numero == escala.osNumero);
        if (!os) return;

        const atividadeAtual = os.atividades.find(at => {
            return horaAtualStr >= at.inicio && horaAtualStr <= at.fim;
        });

        if (atividadeAtual) {
            const tipoAtiv = atividadeAtual.tipo.toLowerCase();
            
            // Contagem Granular
            if (tipoAtiv.includes('patrulhamento')) stats.patrulha++;
            else if (tipoAtiv.includes('baseamento')) stats.base++;
            else if (tipoAtiv.includes('deslocamento')) stats.desloc++;
            else if (tipoAtiv.includes('intervalo')) stats.intervalo++;
            else if (tipoAtiv.includes('preleção') || tipoAtiv.includes('prelecao')) stats.prelecao++;
            else if (tipoAtiv.includes('retorno')) stats.retorno++;

            if (atividadeAtual.local) {
                const localEncontrado = encontrarCoordenadas(atividadeAtual.local, todosLocais);
                if (localEncontrado) {
                    adicionarPinoNoMapa(escala, localEncontrado, atividadeAtual, tipoRecurso);
                }
            }
        }
    });

    // ATUALIZAR HTML (Recursos)
    document.getElementById('kpiEfetivo').innerText = stats.efetivo;
    document.getElementById('kpiCarros').innerText = stats.carros;
    document.getElementById('kpiMotos').innerText = stats.motos;
    document.getElementById('kpiSetores').innerText = stats.setores;
    
    // ATUALIZAR HTML (Atividades)
    document.getElementById('kpiPatrulha').innerText = stats.patrulha;
    document.getElementById('kpiBase').innerText = stats.base;
    document.getElementById('kpiDesloc').innerText = stats.desloc;
    
    // Atualiza os cards separados
    document.getElementById('kpiRetorno').innerText = stats.retorno;
    document.getElementById('kpiIntervalo').innerText = stats.intervalo;
    document.getElementById('kpiPrelecao').innerText = stats.prelecao;
}

function normalizarTipo(tipo) {
    tipo = tipo.toLowerCase();
    if (tipo.includes('moto')) return 'moto';
    if (tipo.includes('setor')) return 'setor';
    if (tipo.includes('cabine')) return 'cabine';
    return 'carro';
}

function encontrarCoordenadas(textoLocal, listaLocais) {
    let match = listaLocais.find(l => {
        const textoCompletoBanco = `[${l.apelido || l.codigo}] - ${l.rua}, ${l.numero || 'S/N'} - ${l.bairro}`;
        return textoLocal === textoCompletoBanco;
    });

    if (!match) {
        match = listaLocais.find(l => {
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

    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style='background-color:${getCorHex(corPin)}' class='marker-pin'></div><div class='marker-icon'>${iconeEmoji}</div>`,
        iconSize: [36, 36], 
        iconAnchor: [18, 36]
    });

    const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(markersLayer);

    const comandante = escala.equipe[0];
    const htmlPopup = `
        <div class="popup-header">${iconeEmoji} ${escala.recursoId}</div>
        <div class="popup-body">
            <strong>Missão:</strong> ${atividade.tipo}<br>
            <strong>Local:</strong> ${atividade.local}<br>
            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
            <strong>Cmd:</strong> ${comandante.posto} ${comandante.nome}<br>
            <small>OS nº ${escala.osNumero}</small>
        </div>
    `;

    marker.bindPopup(htmlPopup);
}

function getCorHex(classe) {
    if (classe === 'pin-moto') return '#fd7e14';
    if (classe === 'pin-setor') return '#28a745';
    if (classe === 'pin-cabine') return '#6f42c1';
    return '#1a237e'; 
}