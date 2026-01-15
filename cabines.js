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
});

// --- LÓGICA DO MAPA (Leaflet + Nominatim) ---
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

    // Evento: Arrastar pino
    marker.on('dragend', function(e) {
        const coords = marker.getLatLng();
        atualizarInputs(coords);
        buscarEnderecoPorCoordenadas(coords.lat, coords.lng);
    });

    // Evento: Clicar no mapa
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

// --- GEOCODING ---
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
        console.error("Erro GPS:", error);
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
    statusMsg.innerText = "Pesquisando...";

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
        alert("Erro de conexão com o mapa.");
    }
}

// --- LÓGICA DE GERAÇÃO DE CÓDIGO (C-XX-YYYY) ---
function gerarCodigoAutomatico() {
    const convenioInput = document.getElementById('codConvenio').value.trim();
    const codigoFinalInput = document.getElementById('codigoFinal');

    if (convenioInput.length < 1) {
        codigoFinalInput.value = '';
        return;
    }

    if (editIndexField.value !== "-1") return;

    const cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const prefixoBusca = `C-${convenioInput}-`;
    const cabinesDoConvenio = cabines.filter(c => c.codigo && c.codigo.startsWith(prefixoBusca));

    let proximoSeq = 1;
    if (cabinesDoConvenio.length > 0) {
        const sequencias = cabinesDoConvenio.map(c => parseInt(c.codigo.split('-')[2]));
        const maxSeq = Math.max(...sequencias);
        proximoSeq = maxSeq + 1;
    }

    const seqFormatada = proximoSeq.toString().padStart(4, '0');
    codigoFinalInput.value = `C-${convenioInput}-${seqFormatada}`;
}

// --- CRUD ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const index = parseInt(editIndexField.value);

    // Objeto completo com endereço e GPS
    const dadosForm = {
        convenio: document.getElementById('codConvenio').value,
        codigo: document.getElementById('codigoFinal').value,
        nome: document.getElementById('nomeCabine').value,
        // Dados de Endereço e GPS
        rua: document.getElementById('nomeRua').value,
        numero: document.getElementById('numero').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        uf: document.getElementById('estado').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value
    };

    if (index === -1) {
        const novaCabine = { ...dadosForm, status: 'Ativa' };
        cabines.push(novaCabine);
    } else {
        const statusOriginal = cabines[index].status;
        cabines[index] = { ...dadosForm, status: statusOriginal };
        cancelarEdicao();
    }

    localStorage.setItem('cabines', JSON.stringify(cabines));
    form.reset();
    
    // Reset visual do mapa
    document.getElementById('statusMapa').innerText = "Arraste o pino para capturar o endereço...";
    map.setView([-22.9068, -43.1729], 13);
    
    exibirCabines();
});

// --- LISTAGEM E FILTROS ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.getElementById('btnFiltroAtiva').className = status === 'Ativa' ? 'filter-btn active' : 'filter-btn';
    document.getElementById('btnFiltroInativa').className = status === 'Inativa' ? 'filter-btn active' : 'filter-btn';
    exibirCabines();
}

function exibirCabines() {
    const cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    listaCabines.innerHTML = '';

    const filtradas = cabines
        .map((c, i) => ({ ...c, originalIndex: i }))
        .filter(c => c.status === statusFiltroAtual);

    if (filtradas.length === 0) {
        listaCabines.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#666;">Nenhuma cabine ${statusFiltroAtual.toLowerCase()} encontrada.</td></tr>`;
        return;
    }

    filtradas.forEach((c) => {
        const classeStatus = c.status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        
        let btnAcao = '';
        if (c.status === 'Ativa') {
            btnAcao = `<button class="btn-danger" onclick="alternarStatus(${c.originalIndex})" title="Inativar">Inativar</button>`;
        } else {
            btnAcao = `<button class="btn-success" onclick="alternarStatus(${c.originalIndex})" title="Reativar">Reativar</button>`;
        }

        listaCabines.innerHTML += `
            <tr>
                <td><strong>${c.codigo}</strong></td>
                <td>${c.nome}</td>
                <td>
                    ${c.rua}, ${c.numero || 'S/N'}<br>
                    <small>${c.bairro}</small>
                </td>
                <td>
                    <span style="font-family: monospace; color: #1a237e; font-size: 0.85em;">
                        ${c.lat ? c.lat + ', ' + c.lng : 'S/ GPS'}
                    </span>
                </td>
                <td><span class="status-pill ${classeStatus}">${c.status}</span></td>
                <td style="text-align: center;">
                    <button class="btn-warning" style="margin-right: 5px;" onclick="prepararEdicao(${c.originalIndex})">Editar</button>
                    ${btnAcao}
                </td>
            </tr>
        `;
    });
}

function prepararEdicao(index) {
    const cabines = JSON.parse(localStorage.getItem('cabines'));
    const c = cabines[index];

    // Preenche campos principais
    document.getElementById('codConvenio').value = c.convenio;
    document.getElementById('codigoFinal').value = c.codigo;
    document.getElementById('nomeCabine').value = c.nome;
    
    // Preenche endereço
    document.getElementById('nomeRua').value = c.rua || '';
    document.getElementById('numero').value = c.numero || '';
    document.getElementById('bairro').value = c.bairro || '';
    document.getElementById('cidade').value = c.cidade || 'Rio de Janeiro';
    document.getElementById('latitude').value = c.lat || '';
    document.getElementById('longitude').value = c.lng || '';

    // Atualiza o mapa para a posição salva (se houver GPS)
    if (c.lat && c.lng) {
        const pos = [parseFloat(c.lat), parseFloat(c.lng)];
        map.setView(pos, 16);
        marker.setLatLng(pos);
    }

    document.getElementById('codConvenio').disabled = true;

    editIndexField.value = index;
    btnSalvar.innerText = "Atualizar Registro";
    btnSalvar.classList.remove('btn-primary');
    btnSalvar.classList.add('btn-info');
    
    btnCancelar.style.display = "inline-block";
    document.getElementById('tituloForm').innerText = "Editando Cabine: " + c.codigo;
    
    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {
    editIndexField.value = "-1";
    btnSalvar.innerText = "Salvar Cabine";
    btnSalvar.classList.remove('btn-info');
    btnSalvar.classList.add('btn-primary');
    
    document.getElementById('codConvenio').disabled = false;
    btnCancelar.style.display = "none";
    document.getElementById('tituloForm').innerText = "Cadastrar Nova Cabine Integrada";
    form.reset();
    
    // Reseta mapa
    map.setView([-22.9068, -43.1729], 13);
}

function alternarStatus(index) {
    let cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const c = cabines[index];
    
    const novoStatus = c.status === 'Ativa' ? 'Inativa' : 'Ativa';
    const acao = c.status === 'Ativa' ? 'inativar' : 'reativar';

    if(confirm(`Deseja realmente ${acao} a cabine ${c.nome}?`)) {
        cabines[index].status = novoStatus;
        localStorage.setItem('cabines', JSON.stringify(cabines));
        exibirCabines();
    }
}