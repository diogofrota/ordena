let map;
let marker;

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapa();
    carregarEnderecos();
});

function iniciarMapa() {
    // Foca no Rio de Janeiro
    map = L.map('map').setView([-22.9068, -43.1729], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    marker = L.marker([-22.9068, -43.1729], {
        draggable: true
    }).addTo(map);

    atualizarInputs(marker.getLatLng());

    // 1. EVENTO: Ao soltar o pino (Drag End) -> Faz Geocodificação Reversa
    marker.on('dragend', function(e) {
        const coords = marker.getLatLng();
        atualizarInputs(coords);
        buscarEnderecoPorCoordenadas(coords.lat, coords.lng);
    });

    // 2. EVENTO: Ao clicar no mapa -> Move pino e busca endereço
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

// --- FUNÇÃO 1: COORDENADAS -> ENDEREÇO (Reversa) ---
async function buscarEnderecoPorCoordenadas(lat, lng) {
    const statusMsg = document.getElementById('statusMapa');
    statusMsg.innerText = "Buscando endereço...";
    statusMsg.style.color = "#e65100";

    try {
        // Usa a API Gratuita do Nominatim (OpenStreetMap)
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (data && data.address) {
            // Preenche os campos automaticamente
            document.getElementById('nomeRua').value = data.address.road || data.address.pedestrian || data.address.suburb || '';
            document.getElementById('bairro').value = data.address.suburb || data.address.neighbourhood || '';
            document.getElementById('cidade').value = data.address.city || data.address.town || data.address.municipality || 'Rio de Janeiro';
            
            // Tenta pegar o número se disponível
            document.getElementById('numero').value = data.address.house_number || '';

            statusMsg.innerText = "Endereço encontrado!";
            statusMsg.style.color = "#28a745";
        } else {
            statusMsg.innerText = "Endereço não identificado neste ponto.";
        }
    } catch (error) {
        console.error("Erro na geocodificação:", error);
        statusMsg.innerText = "Erro ao buscar endereço (Verifique internet).";
    }
}

// --- FUNÇÃO 2: ENDEREÇO -> MAPA (Direta) ---
async function buscarEnderecoNoMapa() {
    const rua = document.getElementById('nomeRua').value;
    const cidade = document.getElementById('cidade').value;
    const estado = "RJ"; // Fixo para o escopo do projeto

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

            // Move o mapa e o pino
            map.setView(novaPosicao, 16); // Zoom mais perto
            marker.setLatLng(novaPosicao);
            
            // Atualiza os inputs
            atualizarInputs({ lat: parseFloat(lat), lng: parseFloat(lon) });
            
            // Preenche bairro se disponível na busca
            buscarEnderecoPorCoordenadas(lat, lon); 
        } else {
            alert("Endereço não encontrado. Tente mover o pino manualmente.");
        }
    } catch (error) {
        alert("Erro de conexão com o serviço de mapas.");
    }
}

// --- CRUD ---

document.getElementById('formEndereco').addEventListener('submit', (e) => {
    e.preventDefault();

    const novoLocal = {
        id: Date.now(),
        apelido: document.getElementById('apelido').value, // Novo campo
        rua: document.getElementById('nomeRua').value,
        numero: document.getElementById('numero').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value
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
    
    carregarEnderecos();
});

function carregarEnderecos() {
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const tbody = document.getElementById('listaEnderecos');
    tbody.innerHTML = '';

    locais.forEach(local => {
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
                    <span style="font-family: monospace; font-size: 0.85em; color: #1a237e;">
                        ${local.lat}, ${local.lng}
                    </span>
                </td>
                <td style="text-align: center;">
                    <button class="btn-danger" style="padding: 5px 10px; height: 35px;" onclick="deletarLocal(${local.id})">Excluir</button>
                </td>
            </tr>
        `;
    });
}

function deletarLocal(id) {
    if(confirm("Deseja remover este local?")) {
        let locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
        locais = locais.filter(l => l.id !== id);
        localStorage.setItem('locaisCadastrados', JSON.stringify(locais));
        carregarEnderecos();
    }
}