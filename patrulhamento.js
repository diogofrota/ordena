let map; // Mapa de cadastro (Principal)
let marker; // Pino de cadastro
let circle; // Círculo de cadastro
let modalMap; // Mapa do Modal (Visualização)

let statusFiltroAtual = 'Ativo';

const form = document.getElementById('formPatrulha');
const listaPatrulhamento = document.getElementById('listaPatrulhamento');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');
const inputRaio = document.getElementById('raioAtuacao');

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapaCadastro();
    exibirPontos();
    gerarProximoCodigo();
});

// --- DESENHAR RAIO (CADASTRO) ---
inputRaio.addEventListener('input', desenharRaioNoMapa);

function desenharRaioNoMapa() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);
    const raio = parseFloat(inputRaio.value);

    if (circle) map.removeLayer(circle);

    if (!isNaN(lat) && !isNaN(lng) && raio > 0) {
        circle = L.circle([lat, lng], {
            color: '#d32f2f',
            fillColor: '#f44336',
            fillOpacity: 0.2,
            radius: raio
        }).addTo(map);
    }
}

// --- SEQUENCIAL AUTOMÁTICO ---
function gerarProximoCodigo() {
    const pontos = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];
    const numeros = pontos.map(p => parseInt(p.codigo)).filter(n => !isNaN(n));
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    document.getElementById('codigoFinal').value = proximo;
}

// --- MAPA DE CADASTRO (PRINCIPAL) ---
function iniciarMapaCadastro() {
    map = L.map('map').setView([-22.9068, -43.1729], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    marker = L.marker([-22.9068, -43.1729], {
        draggable: true
    }).addTo(map);

    atualizarInputs(marker.getLatLng());

    marker.on('drag', function(e) {
        const coords = marker.getLatLng();
        atualizarInputs(coords);
        desenharRaioNoMapa();
    });

    marker.on('dragend', function(e) {
        const coords = marker.getLatLng();
        atualizarInputs(coords);
        buscarEnderecoPorCoordenadas(coords.lat, coords.lng);
        desenharRaioNoMapa();
    });

    map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        atualizarInputs(e.latlng);
        buscarEnderecoPorCoordenadas(e.latlng.lat, e.latlng.lng);
        desenharRaioNoMapa();
    });
}

function atualizarInputs(latlng) {
    document.getElementById('latitude').value = latlng.lat.toFixed(6);
    document.getElementById('longitude').value = latlng.lng.toFixed(6);
}

// --- GEOCODING ---
async function buscarEnderecoPorCoordenadas(lat, lng) {
    const statusMsg = document.getElementById('statusMapa');
    statusMsg.innerText = "Buscando endereço...";
    statusMsg.style.color = "#e65100";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (data && data.address) {
            document.getElementById('nomeRua').value = data.address.road || data.address.pedestrian || 'Via Desconhecida';
            document.getElementById('bairro').value = data.address.suburb || data.address.neighbourhood || '';
            document.getElementById('cidade').value = data.address.city || data.address.town || data.address.municipality || 'Rio de Janeiro';
            document.getElementById('numero').value = data.address.house_number || 'S/N';
            
            statusMsg.innerText = "Endereço e Número atualizados!";
            statusMsg.style.color = "#28a745";
        }
    } catch (error) {
        console.error("Erro GPS:", error);
    }
}

// --- CRUD ---
form.addEventListener('submit', (e) => {
    e.preventDefault();

    let pontos = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];
    const codigoAtual = document.getElementById('codigoFinal').value;

    const dados = {
        id: Date.now(), 
        codigo: codigoAtual,
        apelido: document.getElementById('apelido').value,
        raio: document.getElementById('raioAtuacao').value,
        rua: document.getElementById('nomeRua').value,
        numero: document.getElementById('numero').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value,
        status: 'Ativo'
    };

    pontos.push(dados);
    localStorage.setItem('pontosPatrulhamento', JSON.stringify(pontos));
    
    alert("Ponto de Patrulhamento salvo!");
    form.reset();
    
    if(circle) map.removeLayer(circle);
    document.getElementById('statusMapa').innerText = "Arraste o pino...";
    map.setView([-22.9068, -43.1729], 13);
    
    gerarProximoCodigo();
    exibirPontos();
});

// --- LISTAGEM ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativo' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativo' ? 'filter-btn active' : 'filter-btn';
    exibirPontos();
}

function exibirPontos() {
    const pontos = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];
    listaPatrulhamento.innerHTML = '';

    let filtrados = pontos.filter(p => p.status === statusFiltroAtual);
    filtrados.sort((a, b) => parseInt(a.codigo) - parseInt(b.codigo));

    if (filtrados.length === 0) {
        listaPatrulhamento.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#666;">Nenhum ponto ${statusFiltroAtual.toLowerCase()} encontrado.</td></tr>`;
        return;
    }

    filtrados.forEach((p, index) => {
        const indexOriginal = pontos.findIndex(item => item.id === p.id);
        
        const classeStatus = p.status === 'Ativo' ? 'status-ativa' : 'status-inativa';
        let btnAcao = p.status === 'Ativo' 
            ? `<button class="btn-delete" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px; background-color: #dc3545;">Inativar</button>` 
            : `<button class="btn-success" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px;">Reativar</button>`;

        const latShow = p.lat ? parseFloat(p.lat).toFixed(4) : '-';
        const lngShow = p.lng ? parseFloat(p.lng).toFixed(4) : '-';

        listaPatrulhamento.innerHTML += `
            <tr>
                <td data-label="Código"><strong>${p.codigo}</strong></td>
                <td data-label="Identificação">${p.apelido}</td>
                <td data-label="Raio">
                    <span style="color:#d32f2f; font-weight:bold; font-size: 1.1em;">${p.raio} m</span>
                </td>
                <td data-label="Logradouro">${p.rua}, ${p.numero || 'S/N'}</td>
                <td data-label="Bairro">${p.bairro || '-'}</td>
                <td data-label="Município">${p.cidade || '-'}</td>
                <td data-label="GPS">
                    <span style="font-family: monospace; color: #1a237e; font-size: 0.85em; white-space: nowrap;">
                        ${latShow}, ${lngShow}
                    </span>
                </td>
                <td data-label="Status"><span class="status-pill ${classeStatus}">${p.status}</span></td>
                <td data-label="Ações" style="text-align: center;">
                    <div style="display:flex; justify-content:flex-end; gap:5px;">
                        <button class="btn-info" onclick="abrirMapaModal(${p.lat}, ${p.lng}, ${p.raio}, '${p.apelido}')" style="padding: 5px 10px;">🗺️ Área</button>
                        ${btnAcao}
                    </div>
                </td>
            </tr>
        `;
    });
}

function alternarStatus(index) {
    let pontos = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];
    const p = pontos[index];
    const novoStatus = p.status === 'Ativo' ? 'Inativo' : 'Ativo';
    
    if(confirm(`Alterar status de "${p.apelido}"?`)) {
        pontos[index].status = novoStatus;
        localStorage.setItem('pontosPatrulhamento', JSON.stringify(pontos));
        exibirPontos();
    }
}

// --- MODAL DE VISUALIZAÇÃO (SOLUÇÃO DEFINITIVA PARA MAPA CINZA) ---
function abrirMapaModal(lat, lng, raio, titulo) {
    const modal = document.getElementById('modalVisualizacao');
    modal.style.display = 'flex'; // Torna visível primeiro
    
    document.getElementById('tituloModal').innerText = titulo;
    document.getElementById('descModal').innerText = `Raio: ${raio} metros | GPS: ${lat}, ${lng}`;

    lat = parseFloat(lat);
    lng = parseFloat(lng);
    raio = parseFloat(raio);

    // ESTRATÉGIA: REMOVER E RECRIAR O MAPA
    // Isso garante que ele renderize do zero no tamanho correto do modal visível.
    if (modalMap) {
        modalMap.remove(); // Destrói o mapa anterior
        modalMap = null;
    }

    // Aguarda 100ms para garantir que o CSS do modal foi aplicado
    setTimeout(() => {
        modalMap = L.map('mapaModal').setView([lat, lng], 16);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { 
            maxZoom: 19, 
            attribution: '&copy; OpenStreetMap' 
        }).addTo(modalMap);

        // Adiciona Marcador
        L.marker([lat, lng]).addTo(modalMap);

        // Adiciona Círculo Vermelho
        const modalCircle = L.circle([lat, lng], { 
            radius: raio, 
            color: '#d32f2f',
            fillColor: '#f44336',
            fillOpacity: 0.2
        }).addTo(modalMap);

        // Força ajuste de zoom para mostrar todo o círculo
        modalMap.fitBounds(modalCircle.getBounds());
    }, 100);
}

function fecharMapaModal() {
    document.getElementById('modalVisualizacao').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modalVisualizacao');
    if (event.target == modal) fecharMapaModal();
}
