let map;
let marker;
let statusFiltroAtual = 'Ativa';

const form = document.getElementById('formSetor');
const listaSetores = document.getElementById('listaSetores');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapa();
    exibirSetores();
    gerarProximoCodigo();
});

// --- AUTO CÓDIGO (SEQUENCIAL) ---
function gerarProximoCodigo() {
    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    const numeros = setores.map(s => parseInt(s.codigo)).filter(n => !isNaN(n));
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    document.getElementById('codigoFinal').value = proximo;
}

// --- MAPA ---
function iniciarMapa() {
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

// --- GEOCODING COM NÚMERO ---
async function buscarEnderecoPorCoordenadas(lat, lng) {
    const statusMsg = document.getElementById('statusMapa');
    statusMsg.innerText = "Buscando endereço...";
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        
        if (data && data.address) {
            document.getElementById('nomeRua').value = data.address.road || data.address.pedestrian || 'Via Desconhecida';
            document.getElementById('bairro').value = data.address.suburb || data.address.neighbourhood || '';
            document.getElementById('cidade').value = data.address.city || data.address.municipality || 'Rio de Janeiro';
            document.getElementById('numero').value = data.address.house_number || 'S/N';
            
            statusMsg.innerText = "Endereço atualizado pelo GPS!";
            statusMsg.style.color = "#28a745";
        }
    } catch (error) { 
        console.error("Erro GPS:", error); 
    }
}

// --- CRUD ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    let setores = JSON.parse(localStorage.getItem('setores')) || [];
    const index = parseInt(editIndexField.value);
    const codigoAtual = document.getElementById('codigoFinal').value;

    const dados = {
        codigo: codigoAtual,
        nome: document.getElementById('nomeSetor').value,
        rua: document.getElementById('nomeRua').value,
        numero: document.getElementById('numero').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value
    };

    if (index === -1) {
        setores.push({ ...dados, status: 'Ativa' });
    } else {
        const original = setores[index];
        setores[index] = { ...dados, status: original.status, codigo: original.codigo };
        cancelarEdicao();
    }

    localStorage.setItem('setores', JSON.stringify(setores));
    if(index === -1) {
        form.reset();
        gerarProximoCodigo();
    }
    
    document.getElementById('statusMapa').innerText = "Arraste o pino...";
    map.setView([-22.9068, -43.1729], 13);
    alert("Salvo com sucesso!");
    exibirSetores();
});

function exibirSetores() {
    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    listaSetores.innerHTML = '';
    const filtrados = setores.map((s, i) => ({...s, i})).filter(s => s.status === statusFiltroAtual);

    if (filtrados.length === 0) { 
        listaSetores.innerHTML = '<tr><td colspan="8" style="text-align:center;">Nenhum setor encontrado.</td></tr>'; return; 
    }

    filtrados.forEach(s => {
        const btnClass = s.status === 'Ativa' ? 'btn-danger' : 'btn-success';
        const btnText = s.status === 'Ativa' ? 'Inativar' : 'Reativar';
        const statusClass = s.status === 'Ativa' ? 'status-ativa' : 'status-inativa';

        // FORMATANDO COORDENADAS
        const latShow = s.lat ? parseFloat(s.lat).toFixed(4) : '-';
        const lngShow = s.lng ? parseFloat(s.lng).toFixed(4) : '-';

listaSetores.innerHTML += `
            <tr>
                <td data-label="Código"><strong>${s.codigo}</strong></td>
                <td data-label="Identificação">${s.nome}</td>
                <td data-label="Logradouro">${s.rua}, ${s.numero || 'S/N'}</td>
                <td data-label="Bairro">${s.bairro || '-'}</td>
                <td data-label="Município">${s.cidade || '-'}</td>

                <td data-label="GPS">
                    <span style="font-family: monospace; color: #1a237e; font-size: 0.85em; white-space: nowrap;">
                        ${latShow}, ${lngShow}
                    </span>
                </td>

                <td data-label="Status"><span class="status-pill ${statusClass}">${s.status}</span></td>
                <td data-label="Ações" style="text-align:center;">
                    <div style="display:flex; justify-content:flex-end; gap:5px;">
                        <button class="btn-warning" onclick="editarSetor(${s.i})">Editar</button>
                        <button class="${btnClass}" onclick="mudarStatus(${s.i})">${btnText}</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    exibirSetores();
}

function mudarStatus(index) {
    let setores = JSON.parse(localStorage.getItem('setores'));
    setores[index].status = setores[index].status === 'Ativa' ? 'Inativa' : 'Ativa';
    localStorage.setItem('setores', JSON.stringify(setores));
    exibirSetores();
}

function editarSetor(index) {
    const s = JSON.parse(localStorage.getItem('setores'))[index];
    
    document.getElementById('codigoFinal').value = s.codigo;
    document.getElementById('nomeSetor').value = s.nome;
    document.getElementById('nomeRua').value = s.rua;
    document.getElementById('numero').value = s.numero || '';
    document.getElementById('bairro').value = s.bairro;
    document.getElementById('cidade').value = s.cidade;
    document.getElementById('latitude').value = s.lat;
    document.getElementById('longitude').value = s.lng;
    
    editIndexField.value = index;
    
    btnSalvar.innerText = "Atualizar";
    btnCancelar.style.display = "inline-block";
    
    if(s.lat && s.lng) {
        const pos = [parseFloat(s.lat), parseFloat(s.lng)];
        map.setView(pos, 16);
        marker.setLatLng(pos);
    }
}

function cancelarEdicao() {
    form.reset();
    editIndexField.value = -1;
    btnSalvar.innerText = "Salvar Setor";
    btnCancelar.style.display = "none";
    gerarProximoCodigo();
}