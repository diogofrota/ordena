let map;
let marker;
let statusFiltroAtual = 'Ativa';

// Elementos do DOM
const form = document.getElementById('formCabine');
const listaCabines = document.getElementById('listaCabines');
const editIndexField = document.getElementById('editIndex');
const btnSalvar = document.getElementById('btnSalvar');
const btnCancelar = document.getElementById('btnCancelar');

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapa();
    exibirCabines();
    gerarProximoCodigo();
});

// --- SEQUENCIAL AUTOMÁTICO ---
function gerarProximoCodigo() {
    const cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const numeros = cabines.map(c => parseInt(c.codigo)).filter(n => !isNaN(n));
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    document.getElementById('codigoFinal').value = proximo;
}

// --- MAPA ---
function iniciarMapa() {
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

// --- GEOCODING COM NÚMERO ---
async function buscarEnderecoPorCoordenadas(lat, lng) {
    const statusMsg = document.getElementById('statusMapa');
    statusMsg.innerText = "Buscando endereço exato...";
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
        } else {
            statusMsg.innerText = "Endereço não identificado.";
        }
    } catch (error) {
        console.error("Erro GPS:", error);
        statusMsg.innerText = "Erro ao buscar endereço.";
    }
}

// --- CRUD ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    let cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const index = parseInt(editIndexField.value);
    const codigoAtual = document.getElementById('codigoFinal').value;

    const dadosForm = {
        codigo: codigoAtual,
        nome: document.getElementById('nomeCabine').value,
        rua: document.getElementById('nomeRua').value,
        numero: document.getElementById('numero').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        uf: document.getElementById('estado').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value
    };

    if (index === -1) {
        cabines.push({ ...dadosForm, status: 'Ativa' });
    } else {
        const original = cabines[index];
        cabines[index] = { 
            ...dadosForm, 
            status: original.status,
            codigo: original.codigo 
        };
        cancelarEdicao();
    }

    localStorage.setItem('cabines', JSON.stringify(cabines));
    if(index === -1) {
        form.reset();
        gerarProximoCodigo();
    }
    
    document.getElementById('statusMapa').innerText = "Arraste o pino...";
    map.setView([-22.9068, -43.1729], 13);
    alert("Salvo com sucesso!");
    exibirCabines();
});

// --- EXIBIÇÃO ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    exibirCabines();
}

function exibirCabines() {
    const cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    listaCabines.innerHTML = '';
    const filtradas = cabines.map((c, i) => ({ ...c, originalIndex: i })).filter(c => c.status === statusFiltroAtual);

    if (filtradas.length === 0) {
        listaCabines.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#666;">Nenhuma cabine encontrada.</td></tr>`;
        return;
    }

    filtradas.forEach((c) => {
        const classeStatus = c.status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        let btnAcao = c.status === 'Ativa' 
            ? `<button class="btn-danger" onclick="alternarStatus(${c.originalIndex})">Inativar</button>` 
            : `<button class="btn-success" onclick="alternarStatus(${c.originalIndex})">Reativar</button>`;

        // FORMATANDO COORDENADAS PARA EXIBIÇÃO
        const latShow = c.lat ? parseFloat(c.lat).toFixed(4) : '-';
        const lngShow = c.lng ? parseFloat(c.lng).toFixed(4) : '-';

   listaCabines.innerHTML += `
            <tr>
                <td data-label="Código"><strong>${c.codigo}</strong></td>
                <td data-label="Cabine">${c.nome}</td>
                <td data-label="Logradouro">${c.rua}, ${c.numero || 'S/N'}</td>
                <td data-label="Bairro">${c.bairro || '-'}</td>
                <td data-label="Município">${c.cidade || '-'}</td>
                
                <td data-label="GPS">
                    <span style="font-family: monospace; color: #1a237e; font-size: 0.85em; white-space: nowrap;">
                        ${latShow}, ${lngShow}
                    </span>
                </td>

                <td data-label="Status"><span class="status-pill ${classeStatus}">${c.status}</span></td>
                <td data-label="Ações" style="text-align: center;">
                    <div style="display:flex; justify-content:flex-end; gap:5px;">
                        <button class="btn-warning" onclick="prepararEdicao(${c.originalIndex})">Editar</button>
                        ${btnAcao}
                    </div>
                </td>
            </tr>
        `;
    });
}

function prepararEdicao(index) {
    const cabines = JSON.parse(localStorage.getItem('cabines'));
    const c = cabines[index];

    document.getElementById('codigoFinal').value = c.codigo;
    document.getElementById('nomeCabine').value = c.nome;
    document.getElementById('nomeRua').value = c.rua || '';
    document.getElementById('numero').value = c.numero || '';
    document.getElementById('bairro').value = c.bairro || '';
    document.getElementById('cidade').value = c.cidade || 'Rio de Janeiro';
    document.getElementById('latitude').value = c.lat || '';
    document.getElementById('longitude').value = c.lng || '';

    if (c.lat && c.lng) {
        const pos = [parseFloat(c.lat), parseFloat(c.lng)];
        map.setView(pos, 16);
        marker.setLatLng(pos);
    }

    editIndexField.value = index;
    btnSalvar.innerText = "Atualizar";
    btnSalvar.classList.remove('btn-primary');
    btnSalvar.classList.add('btn-info');
    
    btnCancelar.style.display = "inline-block";
    document.getElementById('tituloForm').innerText = "Editando: " + c.codigo;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {
    editIndexField.value = "-1";
    btnSalvar.innerText = "Salvar Cabine";
    btnSalvar.classList.remove('btn-info');
    btnSalvar.classList.add('btn-primary');
    btnCancelar.style.display = "none";
    document.getElementById('tituloForm').innerText = "Cadastrar Nova Cabine Integrada";
    form.reset();
    map.setView([-22.9068, -43.1729], 13);
    gerarProximoCodigo();
}

function alternarStatus(index) {
    let cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const c = cabines[index];
    const novoStatus = c.status === 'Ativa' ? 'Inativa' : 'Ativa';
    if(confirm(`Alterar status da cabine ${c.nome}?`)) {
        cabines[index].status = novoStatus;
        localStorage.setItem('cabines', JSON.stringify(cabines));
        exibirCabines();
    }
}