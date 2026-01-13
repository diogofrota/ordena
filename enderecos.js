let map; // Mapa de Cadastro
let marker; // Marcador de Cadastro
let modalMap; // Mapa do Modal (Visualização)
let modalMarker; // Marcador do Modal

// Estado do filtro
let statusFiltroAtual = 'Ativo';

document.addEventListener('DOMContentLoaded', () => {
    migrarLocaisAntigos();
    iniciarMapaCadastro();
    carregarEnderecos();
});

// --- MIGRAÇÃO DE DADOS ---
function migrarLocaisAntigos() {
    let locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    let houveMudanca = false;

    locais.forEach(l => {
        if (!l.status) {
            l.status = 'Ativo'; // Padrão para antigos
            houveMudanca = true;
        }
    });

    if (houveMudanca) {
        localStorage.setItem('locaisCadastrados', JSON.stringify(locais));
    }
}

// --- MAPA DE CADASTRO ---
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

    marker.on('dragend', function(e) {
        const coords = marker.getLatLng();
        atualizarInputs(coords);
        buscarEnderecoPorCoordenadas(coords.lat, coords.lng);
    });

    map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        atualizarInputs(e.latlng);
        buscarEnderecoPorCoordenadas(e.latlng.lat, e.latlng.lng);
    });
}

function atualizarInputs(latlng) {
    document.getElementById('latitude').value = latlng.lat.toFixed(6);
    document.getElementById('longitude').value = latlng.lng.toFixed(6);
}

// --- GEOCODING (Endereço <-> Coordenadas) ---
async function buscarEnderecoPorCoordenadas(lat, lng) {
    const statusMsg = document.getElementById('statusMapa');
    statusMsg.innerText = "Buscando endereço...";
    statusMsg.style.color = "#e65100";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (data && data.address) {
            document.getElementById('nomeRua').value = data.address.road || data.address.pedestrian || data.address.suburb || '';
            document.getElementById('bairro').value = data.address.suburb || data.address.neighbourhood || '';
            document.getElementById('cidade').value = data.address.city || data.address.town || data.address.municipality || 'Rio de Janeiro';
            document.getElementById('numero').value = data.address.house_number || '';
            statusMsg.innerText = "Endereço encontrado!";
            statusMsg.style.color = "#28a745";
        } else {
            statusMsg.innerText = "Endereço não identificado neste ponto.";
        }
    } catch (error) {
        console.error("Erro na geocodificação:", error);
        statusMsg.innerText = "Erro ao buscar endereço.";
    }
}

async function buscarEnderecoNoMapa() {
    const rua = document.getElementById('nomeRua').value;
    const cidade = document.getElementById('cidade').value;
    const estado = "RJ";

    if (!rua) return alert("Digite o nome da rua para buscar.");

    const query = `${rua}, ${cidade}, ${estado}, Brazil`;
    const statusMsg = document.getElementById('statusMapa');
    statusMsg.innerText = "Pesquisando local...";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data && data.length > 0) {
            const lat = data[0].lat;
            const lon = data[0].lon;
            const novaPosicao = [lat, lon];

            map.setView(novaPosicao, 16);
            marker.setLatLng(novaPosicao);
            
            atualizarInputs({ lat: parseFloat(lat), lng: parseFloat(lon) });
            buscarEnderecoPorCoordenadas(lat, lon); 
        } else {
            alert("Endereço não encontrado.");
        }
    } catch (error) {
        alert("Erro de conexão com o serviço de mapas.");
    }
}

// --- CRUD DE LOCAIS ---

document.getElementById('formEndereco').addEventListener('submit', (e) => {
    e.preventDefault();

    const novoLocal = {
        id: Date.now(),
        apelido: document.getElementById('apelido').value,
        rua: document.getElementById('nomeRua').value,
        numero: document.getElementById('numero').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value,
        status: 'Ativo' // Novo local nasce ativo
    };

    let locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    locais.push(novoLocal);
    localStorage.setItem('locaisCadastrados', JSON.stringify(locais));

    alert("Local salvo com sucesso!");
    document.getElementById('formEndereco').reset();
    
    // Reset visual
    document.getElementById('estado').value = "RJ"; 
    document.getElementById('cidade').value = "Rio de Janeiro";
    document.getElementById('statusMapa').innerText = "Arraste o pino para capturar o endereço...";
    map.setView([-22.9068, -43.1729], 13);
    marker.setLatLng([-22.9068, -43.1729]);
    
    carregarEnderecos();
});

// --- FILTRO E LISTAGEM ---

function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativo' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativo' ? 'filter-btn active' : 'filter-btn';
    carregarEnderecos();
}

function carregarEnderecos() {
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const tbody = document.getElementById('listaEnderecos');
    tbody.innerHTML = '';

    const locaisFiltrados = locais.filter(l => l.status === statusFiltroAtual);

    if (locaisFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#666;">Nenhum local ${statusFiltroAtual.toLowerCase()} encontrado.</td></tr>`;
        return;
    }

    locaisFiltrados.forEach((local, index) => {
        // Encontrar índice original no array principal para editar corretamente
        const indexOriginal = locais.findIndex(l => l.id === local.id);
        
        const classeStatus = local.status === 'Ativo' ? 'status-ativa' : 'status-inativa';
        
        let btnAcao = '';
        if (local.status === 'Ativo') {
            btnAcao = `<button class="btn-delete" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px; background-color: #dc3545;" title="Inativar Local">Inativar</button>`;
        } else {
            btnAcao = `<button class="btn-success" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px;" title="Reativar Local">Reativar</button>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>
                    <strong>${local.apelido}</strong>
                </td>
                <td>
                    ${local.rua}, ${local.numero || 'S/N'}<br>
                    <small style="color:#666">${local.bairro} - ${local.cidade}</small>
                </td>
                <td>
                    <span class="status-pill ${classeStatus}">${local.status}</span>
                </td>
                <td style="text-align: center;">
                    <button class="btn-info" onclick="abrirMapaModal(${local.lat}, ${local.lng}, '${local.apelido}')" style="padding: 5px 10px; margin-right: 5px;">🗺️ Ver no Mapa</button>
                    ${btnAcao}
                </td>
            </tr>
        `;
    });
}

function alternarStatus(index) {
    let locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const local = locais[index];
    
    const novoStatus = local.status === 'Ativo' ? 'Inativo' : 'Ativo';
    const acaoTexto = local.status === 'Ativo' ? 'inativar' : 'reativar';

    if(confirm(`Deseja realmente ${acaoTexto} o local "${local.apelido}"?`)) {
        locais[index].status = novoStatus;
        localStorage.setItem('locaisCadastrados', JSON.stringify(locais));
        carregarEnderecos();
    }
}

// --- MODAL DE VISUALIZAÇÃO ---

function abrirMapaModal(lat, lng, titulo) {
    const modal = document.getElementById('modalVisualizacao');
    modal.style.display = 'flex';
    
    document.getElementById('tituloModal').innerText = titulo;
    document.getElementById('descModal').innerText = `Coordenadas: ${lat}, ${lng}`;

    // Se o mapa do modal ainda não existe, cria. Se existe, apenas atualiza.
    if (!modalMap) {
        modalMap = L.map('mapaModal');
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(modalMap);
        modalMarker = L.marker([lat, lng]).addTo(modalMap);
    } else {
        modalMarker.setLatLng([lat, lng]);
    }

    // Delay pequeno para o Leaflet recalcular o tamanho da div do modal
    setTimeout(() => {
        modalMap.invalidateSize();
        modalMap.setView([lat, lng], 15);
    }, 200);
}

function fecharMapaModal() {
    document.getElementById('modalVisualizacao').style.display = 'none';
}

// Fechar modal clicando fora
window.onclick = function(event) {
    const modal = document.getElementById('modalVisualizacao');
    if (event.target == modal) {
        fecharMapaModal();
    }
}