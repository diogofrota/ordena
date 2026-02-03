let map; 
let marker; 
let modalMap; 
let modalMarker; 

let statusFiltroAtual = 'Ativo';

const form = document.getElementById('formEndereco');
const listaEnderecos = document.getElementById('listaEnderecos');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapaCadastro();
    exibirLocais();
    gerarProximoCodigo();
});

// --- SEQUENCIAL AUTOMÁTICO ---
function gerarProximoCodigo() {
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const numeros = locais.map(l => parseInt(l.codigo)).filter(n => !isNaN(n));
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    document.getElementById('codigoFinal').value = proximo;
}

// --- MAPA ---
function iniciarMapaCadastro() {
    map = L.map('map').setView([-22.9068, -43.1729], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    marker = L.marker([-22.9068, -43.1729], { draggable: true }).addTo(map);

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

// --- GEOCODING (TRAVADO) ---
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
            
            statusMsg.innerText = "Endereço atualizado pelo GPS!";
            statusMsg.style.color = "#28a745";
        } else {
            statusMsg.innerText = "Endereço não identificado.";
        }
    } catch (error) {
        console.error("Erro geocoding:", error);
        statusMsg.innerText = "Erro ao buscar endereço.";
    }
}

// --- CRUD (SÓ CRIAÇÃO) ---
form.addEventListener('submit', (e) => {
    e.preventDefault();

    let locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    
    // Sempre cria novo (editIndex será sempre -1 pois removemos a função de editar)
    const codigoAtual = document.getElementById('codigoFinal').value;

    const dados = {
        id: Date.now(), 
        codigo: codigoAtual,
        apelido: document.getElementById('apelido').value,
        rua: document.getElementById('nomeRua').value,
        numero: document.getElementById('numero').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value,
        status: 'Ativo'
    };

    locais.push(dados);
    localStorage.setItem('locaisCadastrados', JSON.stringify(locais));
    
    alert("Local salvo com sucesso!");
    form.reset();
    gerarProximoCodigo();
    
    document.getElementById('statusMapa').innerText = "Arraste o pino...";
    map.setView([-22.9068, -43.1729], 13);
    
    exibirLocais();
});

// --- LISTAGEM ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativo' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativo' ? 'filter-btn active' : 'filter-btn';
    exibirLocais();
}

function exibirLocais() {
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    listaEnderecos.innerHTML = '';

    let locaisFiltrados = locais.filter(l => l.status === statusFiltroAtual);

    locaisFiltrados.sort((a, b) => {
        return a.apelido.localeCompare(b.apelido, 'pt-BR', { sensitivity: 'base' });
    });

    if (locaisFiltrados.length === 0) {
        listaEnderecos.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#666;">Nenhum local ${statusFiltroAtual.toLowerCase()} encontrado.</td></tr>`;
        return;
    }

    locaisFiltrados.forEach((local) => {
        const indexOriginal = locais.findIndex(l => l.id === local.id);
        const classeStatus = local.status === 'Ativo' ? 'status-ativa' : 'status-inativa';
        
        let btnAcao = '';
        if (local.status === 'Ativo') {
            btnAcao = `<button class="btn-delete" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px; background-color: #dc3545;" title="Inativar">Inativar</button>`;
        } else {
            btnAcao = `<button class="btn-success" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px;" title="Reativar">Reativar</button>`;
        }

        const codigoShow = local.codigo || '-';
        const latShow = local.lat ? parseFloat(local.lat).toFixed(4) : '-';
        const lngShow = local.lng ? parseFloat(local.lng).toFixed(4) : '-';

        // --- BOTÃO DE EDITAR REMOVIDO AQUI ---
        listaEnderecos.innerHTML += `
            <tr>
                <td data-label="Código"><strong>${codigoShow}</strong></td>
                <td data-label="Apelido">${local.apelido}</td>
                
                <td data-label="Logradouro">${local.rua}, ${local.numero || 'S/N'}</td>
                <td data-label="Bairro">${local.bairro || '-'}</td>
                <td data-label="Município">${local.cidade || '-'}</td>

                <td data-label="GPS">
                    <span style="font-family: monospace; color: #1a237e; font-size: 0.85em; white-space: nowrap;">
                        ${latShow}, ${lngShow}
                    </span>
                </td>

                <td data-label="Status">
                    <span class="status-pill ${classeStatus}">${local.status}</span>
                </td>
                <td data-label="Ações" style="text-align: center;">
                    <div style="display:flex; justify-content:flex-end; gap:5px;">
                        <button class="btn-info" onclick="abrirMapaModal(${local.lat}, ${local.lng}, '${local.apelido}')" style="padding: 5px 10px;">🗺️ Mapa</button>
                        ${btnAcao}
                    </div>
                </td>
            </tr>
        `;
    });
}

function alternarStatus(index) {
    let locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const local = locais[index];
    const novoStatus = local.status === 'Ativo' ? 'Inativo' : 'Ativo';
    
    if(confirm(`Alterar status de "${local.apelido}"?`)) {
        locais[index].status = novoStatus;
        localStorage.setItem('locaisCadastrados', JSON.stringify(locais));
        exibirLocais();
    }
}

// --- MODAL DE MAPA ---
function abrirMapaModal(lat, lng, titulo) {
    const modal = document.getElementById('modalVisualizacao');
    modal.style.display = 'flex';
    document.getElementById('tituloModal').innerText = titulo;
    document.getElementById('descModal').innerText = `Coordenadas: ${lat}, ${lng}`;

    if (!modalMap) {
        modalMap = L.map('mapaModal');
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(modalMap);
        modalMarker = L.marker([lat, lng]).addTo(modalMap);
    } else {
        modalMarker.setLatLng([lat, lng]);
    }
    setTimeout(() => { modalMap.invalidateSize(); modalMap.setView([lat, lng], 15); }, 200);
}

function fecharMapaModal() {
    document.getElementById('modalVisualizacao').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modalVisualizacao');
    if (event.target == modal) fecharMapaModal();
}
