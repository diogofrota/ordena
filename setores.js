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
});

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

// --- GEOCODING ---
async function buscarEnderecoPorCoordenadas(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.address) {
            document.getElementById('nomeRua').value = data.address.road || data.address.suburb || '';
            document.getElementById('bairro').value = data.address.suburb || data.address.neighbourhood || '';
            document.getElementById('cidade').value = data.address.city || data.address.municipality || 'Rio de Janeiro';
        }
    } catch (error) { console.error("Erro GPS:", error); }
}

async function buscarEnderecoNoMapa() {
    const rua = document.getElementById('nomeRua').value;
    const cidade = document.getElementById('cidade').value;
    if (!rua) return alert("Digite o nome da rua/local para buscar.");
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rua + ", " + cidade + ", Brazil")}`);
        const data = await response.json();
        if (data && data.length > 0) {
            const lat = data[0].lat;
            const lon = data[0].lon;
            map.setView([lat, lon], 16);
            marker.setLatLng([lat, lon]);
            atualizarInputs({ lat: parseFloat(lat), lng: parseFloat(lon) });
        } else { alert("Local não encontrado."); }
    } catch (error) { alert("Erro de conexão."); }
}

// --- GERAÇÃO DE CÓDIGO (S-XX-YYYY) ---
function gerarCodigoAutomatico() {
    const convenioInput = document.getElementById('codConvenio').value.trim();
    const codigoFinalInput = document.getElementById('codigoFinal');

    if (convenioInput.length < 1) { codigoFinalInput.value = ''; return; }
    if (editIndexField.value !== "-1") return;

    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    const prefixoBusca = `S-${convenioInput}-`;
    const setoresDoConvenio = setores.filter(s => s.codigo && s.codigo.startsWith(prefixoBusca));

    let proximoSeq = 1;
    if (setoresDoConvenio.length > 0) {
        const sequencias = setoresDoConvenio.map(s => parseInt(s.codigo.split('-')[2]));
        proximoSeq = Math.max(...sequencias) + 1;
    }
    codigoFinalInput.value = `S-${convenioInput}-${proximoSeq.toString().padStart(4, '0')}`;
}

// --- CRUD ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    let setores = JSON.parse(localStorage.getItem('setores')) || [];
    const index = parseInt(editIndexField.value);

    const dados = {
        convenio: document.getElementById('codConvenio').value,
        codigo: document.getElementById('codigoFinal').value,
        nome: document.getElementById('nomeSetor').value,
        rua: document.getElementById('nomeRua').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        lat: document.getElementById('latitude').value,
        lng: document.getElementById('longitude').value
    };

    if (index === -1) {
        setores.push({ ...dados, status: 'Ativa' });
    } else {
        setores[index] = { ...dados, status: setores[index].status };
        cancelarEdicao();
    }

    localStorage.setItem('setores', JSON.stringify(setores));
    form.reset();
    exibirSetores();
});

function exibirSetores() {
    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    listaSetores.innerHTML = '';
    const filtrados = setores.map((s, i) => ({...s, i})).filter(s => s.status === statusFiltroAtual);

    if (filtrados.length === 0) { listaSetores.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum setor encontrado.</td></tr>'; return; }

    filtrados.forEach(s => {
        const btnClass = s.status === 'Ativa' ? 'btn-danger' : 'btn-success';
        const btnText = s.status === 'Ativa' ? 'Inativar' : 'Reativar';
        const statusClass = s.status === 'Ativa' ? 'status-ativa' : 'status-inativa';

        listaSetores.innerHTML += `
            <tr>
                <td><strong>${s.codigo}</strong></td>
                <td>${s.nome}</td>
                <td>${s.rua} - ${s.bairro}</td>
                <td><small>${s.lat || '-'}<br>${s.lng || '-'}</small></td>
                <td><span class="status-pill ${statusClass}">${s.status}</span></td>
                <td style="text-align:center;">
                    <button class="btn-warning" onclick="editarSetor(${s.i})">Editar</button>
                    <button class="${btnClass}" onclick="mudarStatus(${s.i})">${btnText}</button>
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
    document.getElementById('codConvenio').value = s.convenio;
    document.getElementById('codigoFinal').value = s.codigo;
    document.getElementById('nomeSetor').value = s.nome;
    document.getElementById('nomeRua').value = s.rua;
    document.getElementById('bairro').value = s.bairro;
    document.getElementById('cidade').value = s.cidade;
    document.getElementById('latitude').value = s.lat;
    document.getElementById('longitude').value = s.lng;
    
    document.getElementById('codConvenio').disabled = true;
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
    document.getElementById('codConvenio').disabled = false;
    btnSalvar.innerText = "Salvar Setor";
    btnCancelar.style.display = "none";
}