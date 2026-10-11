const MIN_VERTICES = 3;
const MAX_VERTICES = 20;
const CENTRO_INICIAL = [-22.9068, -43.1729];

let map;
let camadaAreaCadastro;
let marcadoresVertices = [];
let vertices = [];
let poligonoFechado = false;
let modalMap;
let salvamentoEmAndamento = false;
const filtroUrl = new URLSearchParams(window.location.search).get('filtro');
let statusFiltroAtual = filtroUrl === 'Inativo' ? 'Inativo' : 'Ativo';
const FEEDBACK_NAVEGACAO_KEY = 'ordenaFeedbackPatrulhamento';

const form = document.getElementById('formPatrulha');
const listaPatrulhamento = document.getElementById('listaPatrulhamento');
const btnSalvar = document.getElementById('btnSalvar');
const btnDesfazerVertice = document.getElementById('btnDesfazerVertice');
const btnLimparPoligono = document.getElementById('btnLimparPoligono');
const btnFecharPoligono = document.getElementById('btnFecharPoligono');
const contadorVertices = document.getElementById('contadorVertices');
const statusMapa = document.getElementById('statusMapa');
const feedbackPatrulha = document.getElementById('feedbackPatrulha');
const listaVertices = document.getElementById('listaVertices');
const resumoListaVertices = document.getElementById('resumoListaVertices');

document.addEventListener('DOMContentLoaded', () => {
    if (form) {
        iniciarMapaCadastro();
        configurarEventos();
        gerarProximoCodigo();
        atualizarControlesDesenho();
    }

    if (listaPatrulhamento) {
        atualizarBotoesFiltro();
        exibirPontos();
        restaurarFeedbackNavegacao();
    }
});

function configurarEventos() {
    btnDesfazerVertice?.addEventListener('click', desfazerUltimoVertice);
    btnLimparPoligono?.addEventListener('click', () => limparPoligono());
    btnFecharPoligono?.addEventListener('click', fecharPoligono);
}

// --- MAPA E DESENHO DO POLÍGONO ---
function iniciarMapaCadastro() {
    map = L.map('map').setView(CENTRO_INICIAL, 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    map.getContainer().classList.add('is-drawing');
    map.on('click', event => adicionarVertice(event.latlng));
}

function adicionarVertice(latlng) {
    limparFeedback();

    if (poligonoFechado) {
        definirStatusMapa('O polígono já está fechado. Arraste os pontos para ajustar ou limpe para começar novamente.', 'info');
        return;
    }

    if (vertices.length >= MAX_VERTICES) {
        definirStatusMapa(`Limite de ${MAX_VERTICES} pontos atingido. Feche o polígono para continuar.`, 'error');
        return;
    }

    const novoVertice = { lat: Number(latlng.lat), lng: Number(latlng.lng) };
    if (vertices.some(vertice => map.distance(vertice, novoVertice) < 2)) {
        definirStatusMapa('Esse ponto está muito próximo de outro. Marque um limite diferente.', 'error');
        return;
    }

    const candidatos = [...vertices, novoVertice];
    if (poligonoTemAutoIntersecao(candidatos, false)) {
        definirStatusMapa('Esse ponto faria uma borda cruzar outra. Escolha outro local.', 'error');
        return;
    }

    vertices = candidatos;
    redesenharAreaCadastro();
    recriarMarcadoresVertices();
    atualizarControlesDesenho();

    if (vertices.length < MIN_VERTICES) {
        const faltam = MIN_VERTICES - vertices.length;
        definirStatusMapa(`Adicione mais ${faltam} ${faltam === 1 ? 'ponto' : 'pontos'} para formar o polígono.`, 'info');
    } else if (vertices.length === MAX_VERTICES) {
        definirStatusMapa('Limite atingido. Clique no primeiro ponto azul ou em “Fechar polígono”.', 'info');
    } else {
        definirStatusMapa('Continue marcando os limites ou feche o polígono.', 'info');
    }
}

function redesenharAreaCadastro() {
    if (camadaAreaCadastro) {
        map.removeLayer(camadaAreaCadastro);
        camadaAreaCadastro = null;
    }

    if (vertices.length < 2) return;

    if (poligonoFechado) {
        camadaAreaCadastro = L.polygon(vertices, {
            color: '#d32f2f',
            weight: 3,
            fillColor: '#f44336',
            fillOpacity: 0.2
        }).addTo(map);
    } else {
        camadaAreaCadastro = L.polyline(vertices, {
            color: '#d32f2f',
            weight: 3,
            dashArray: '8 6'
        }).addTo(map);
    }
}

function recriarMarcadoresVertices() {
    marcadoresVertices.forEach(marcador => map.removeLayer(marcador));
    marcadoresVertices = vertices.map((vertice, indice) => criarMarcadorVertice(vertice, indice));
}

function criarMarcadorVertice(vertice, indice) {
    const primeiro = indice === 0;
    const icone = L.divIcon({
        className: '',
        html: `<div class="vertex-marker${primeiro ? ' is-first' : ''}">${indice + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const marcador = L.marker(vertice, {
        icon: icone,
        draggable: true,
        bubblingMouseEvents: false,
        title: primeiro && !poligonoFechado ? 'Primeiro ponto: clique para fechar' : `Ponto ${indice + 1}`
    }).addTo(map);

    if (primeiro && !poligonoFechado) {
        marcador.bindTooltip(
            vertices.length >= MIN_VERTICES ? 'Clique para fechar o polígono' : 'Primeiro ponto',
            { direction: 'top', offset: [0, -12] }
        );
        marcador.on('click', fecharPoligono);
    }

    let posicaoAnterior = { ...vertice };

    marcador.on('dragstart', () => {
        posicaoAnterior = { ...vertices[indice] };
    });

    marcador.on('drag', event => {
        const posicao = event.target.getLatLng();
        vertices[indice] = { lat: Number(posicao.lat), lng: Number(posicao.lng) };
        atualizarLatLngsCamada();
    });

    marcador.on('dragend', event => {
        const posicao = event.target.getLatLng();
        vertices[indice] = { lat: Number(posicao.lat), lng: Number(posicao.lng) };

        if (!geometriaAtualEhValida()) {
            vertices[indice] = posicaoAnterior;
            event.target.setLatLng(posicaoAnterior);
            atualizarLatLngsCamada();
            atualizarListaVertices();
            definirStatusMapa('O ajuste foi desfeito porque criaria pontos repetidos, área nula ou bordas cruzadas.', 'error');
            return;
        }

        atualizarLatLngsCamada();
        atualizarListaVertices();
        if (poligonoFechado) {
            definirStatusMapa('Ponto ajustado. O polígono continua fechado e pronto para salvar.', 'success');
        } else {
            definirStatusMapa('Ponto ajustado. Continue o desenho ou feche o polígono.', 'info');
        }
    });

    return marcador;
}

function atualizarLatLngsCamada() {
    if (camadaAreaCadastro) camadaAreaCadastro.setLatLngs(vertices);
}

function geometriaAtualEhValida() {
    const pontosDistintos = vertices.every((vertice, indice) => (
        vertices.every((outro, outroIndice) => indice === outroIndice || map.distance(vertice, outro) >= 2)
    ));

    if (!pontosDistintos) return false;
    if (poligonoTemAutoIntersecao(vertices, poligonoFechado)) return false;
    if (poligonoFechado && Math.abs(calcularAreaAssinada(vertices)) < 1e-12) return false;
    return true;
}

function fecharPoligono() {
    limparFeedback();

    if (poligonoFechado) return;
    if (vertices.length < MIN_VERTICES) {
        definirStatusMapa(`Adicione pelo menos ${MIN_VERTICES} pontos antes de fechar o polígono.`, 'error');
        return;
    }

    if (poligonoTemAutoIntersecao(vertices, true)) {
        definirStatusMapa('Não foi possível fechar: a última borda cruzaria outra borda.', 'error');
        return;
    }

    if (Math.abs(calcularAreaAssinada(vertices)) < 1e-12) {
        definirStatusMapa('Os pontos não formam uma área válida. Ajuste um dos limites.', 'error');
        return;
    }

    poligonoFechado = true;
    redesenharAreaCadastro();
    recriarMarcadoresVertices();
    atualizarControlesDesenho();

    if (camadaAreaCadastro) {
        map.fitBounds(camadaAreaCadastro.getBounds(), { padding: [30, 30], maxZoom: 17 });
    }

    definirStatusMapa('Polígono fechado. Revise os pontos e salve a área.', 'success');
}

function desfazerUltimoVertice() {
    if (vertices.length === 0) return;

    poligonoFechado = false;
    vertices.pop();
    redesenharAreaCadastro();
    recriarMarcadoresVertices();
    atualizarControlesDesenho();

    if (vertices.length === 0) {
        definirStatusMapa('Clique no mapa para adicionar o primeiro ponto.', 'info');
    } else {
        definirStatusMapa('Último ponto removido. Continue marcando os limites.', 'info');
    }
}

function limparPoligono(opcoes = {}) {
    vertices = [];
    poligonoFechado = false;

    if (camadaAreaCadastro) {
        map.removeLayer(camadaAreaCadastro);
        camadaAreaCadastro = null;
    }

    marcadoresVertices.forEach(marcador => map.removeLayer(marcador));
    marcadoresVertices = [];
    atualizarControlesDesenho();

    if (!opcoes.manterStatus) {
        definirStatusMapa('Clique no mapa para adicionar o primeiro ponto.', 'info');
    }
}

function atualizarControlesDesenho() {
    const quantidade = vertices.length;
    contadorVertices.textContent = `${quantidade}/${MAX_VERTICES} ${quantidade === 1 ? 'ponto' : 'pontos'}${poligonoFechado ? ' • fechado' : ''}`;
    btnDesfazerVertice.disabled = quantidade === 0 || salvamentoEmAndamento;
    btnLimparPoligono.disabled = quantidade === 0 || salvamentoEmAndamento;
    btnFecharPoligono.disabled = poligonoFechado || quantidade < MIN_VERTICES || salvamentoEmAndamento;
    btnFecharPoligono.textContent = poligonoFechado ? 'Polígono fechado' : 'Fechar polígono';
    btnSalvar.disabled = !poligonoFechado || salvamentoEmAndamento;
    map?.getContainer().classList.toggle('is-drawing', !poligonoFechado);
    atualizarListaVertices();
}

function atualizarListaVertices() {
    const quantidade = vertices.length;
    resumoListaVertices.textContent = `${quantidade} ${quantidade === 1 ? 'ponto definido' : 'pontos definidos'}${poligonoFechado ? ' • fechado' : ''}`;
    listaVertices.innerHTML = '';

    if (quantidade === 0) {
        const vazio = document.createElement('p');
        vazio.className = 'vertices-empty';
        vazio.textContent = 'Clique no mapa para adicionar o primeiro ponto.';
        listaVertices.appendChild(vazio);
        return;
    }

    vertices.forEach((vertice, indice) => {
        const item = document.createElement('div');
        item.className = `vertex-list-item${indice === 0 ? ' is-first' : ''}`;
        item.setAttribute('role', 'listitem');

        const identificador = document.createElement('span');
        identificador.className = 'vertex-list-index';
        identificador.textContent = `P${indice + 1}`;

        const latitude = document.createElement('span');
        latitude.className = 'vertex-coordinate';
        latitude.innerHTML = `<small>Latitude</small>${Number(vertice.lat).toFixed(6)}`;

        const longitude = document.createElement('span');
        longitude.className = 'vertex-coordinate';
        longitude.innerHTML = `<small>Longitude</small>${Number(vertice.lng).toFixed(6)}`;

        item.append(identificador, latitude, longitude);
        listaVertices.appendChild(item);
    });
}

// --- VALIDAÇÃO GEOMÉTRICA ---
function calcularAreaAssinada(pontos) {
    return pontos.reduce((soma, ponto, indice) => {
        const proximo = pontos[(indice + 1) % pontos.length];
        return soma + ((ponto.lng * proximo.lat) - (proximo.lng * ponto.lat));
    }, 0) / 2;
}

function poligonoTemAutoIntersecao(pontos, fechado) {
    const quantidadeSegmentos = fechado ? pontos.length : Math.max(0, pontos.length - 1);

    for (let i = 0; i < quantidadeSegmentos; i++) {
        const a1 = pontos[i];
        const a2 = pontos[(i + 1) % pontos.length];

        for (let j = i + 1; j < quantidadeSegmentos; j++) {
            const segmentosAdjacentes = Math.abs(i - j) === 1;
            const primeiroEUltimo = fechado && i === 0 && j === quantidadeSegmentos - 1;
            if (segmentosAdjacentes || primeiroEUltimo) continue;

            const b1 = pontos[j];
            const b2 = pontos[(j + 1) % pontos.length];
            if (segmentosIntersectam(a1, a2, b1, b2)) return true;
        }
    }

    return false;
}

function segmentosIntersectam(a, b, c, d) {
    const orientacao = (p, q, r) => {
        const valor = ((q.lng - p.lng) * (r.lat - p.lat)) - ((q.lat - p.lat) * (r.lng - p.lng));
        if (Math.abs(valor) < 1e-12) return 0;
        return valor > 0 ? 1 : -1;
    };

    const estaNoSegmento = (p, q, r) => (
        q.lng <= Math.max(p.lng, r.lng) + 1e-12 &&
        q.lng >= Math.min(p.lng, r.lng) - 1e-12 &&
        q.lat <= Math.max(p.lat, r.lat) + 1e-12 &&
        q.lat >= Math.min(p.lat, r.lat) - 1e-12
    );

    const o1 = orientacao(a, b, c);
    const o2 = orientacao(a, b, d);
    const o3 = orientacao(c, d, a);
    const o4 = orientacao(c, d, b);

    if ((o1 * o2) < 0 && (o3 * o4) < 0) return true;
    if (o1 === 0 && estaNoSegmento(a, c, b)) return true;
    if (o2 === 0 && estaNoSegmento(a, d, b)) return true;
    if (o3 === 0 && estaNoSegmento(c, a, d)) return true;
    if (o4 === 0 && estaNoSegmento(c, b, d)) return true;
    return false;
}

function calcularCentroide(pontos) {
    const areaAssinada = calcularAreaAssinada(pontos);

    if (Math.abs(areaAssinada) < 1e-12) {
        const soma = pontos.reduce((acc, ponto) => ({ lat: acc.lat + ponto.lat, lng: acc.lng + ponto.lng }), { lat: 0, lng: 0 });
        return { lat: soma.lat / pontos.length, lng: soma.lng / pontos.length };
    }

    let centroLng = 0;
    let centroLat = 0;

    pontos.forEach((ponto, indice) => {
        const proximo = pontos[(indice + 1) % pontos.length];
        const fator = (ponto.lng * proximo.lat) - (proximo.lng * ponto.lat);
        centroLng += (ponto.lng + proximo.lng) * fator;
        centroLat += (ponto.lat + proximo.lat) * fator;
    });

    return {
        lat: centroLat / (6 * areaAssinada),
        lng: centroLng / (6 * areaAssinada)
    };
}

function definirStatusMapa(mensagem, tipo = 'info') {
    const cores = {
        info: '#666',
        success: '#28a745',
        error: '#b71c1c'
    };

    statusMapa.textContent = mensagem;
    statusMapa.style.color = cores[tipo] || cores.info;
}

// --- SEQUENCIAL E PERSISTÊNCIA ---
function lerPontosPatrulhamento() {
    try {
        const pontos = JSON.parse(OrdenaStorage.getItem('pontosPatrulhamento'));
        return Array.isArray(pontos) ? pontos : [];
    } catch (error) {
        console.error('Erro ao ler pontos de patrulhamento:', error);
        return [];
    }
}

function gerarProximoCodigo() {
    const pontos = lerPontosPatrulhamento();
    const numeros = pontos.map(ponto => parseInt(ponto.codigo, 10)).filter(Number.isFinite);
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    document.getElementById('codigoFinal').value = proximo;
}

if (form) {
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (salvamentoEmAndamento) return;
        limparFeedback();

        if (!poligonoFechado || vertices.length < MIN_VERTICES || !geometriaAtualEhValida()) {
            mostrarFeedback('error', 'Feche um polígono válido com pelo menos 3 pontos antes de salvar.');
            definirStatusMapa('O polígono precisa estar válido e fechado.', 'error');
            return;
        }

        const centro = calcularCentroide(vertices);
        if (!Number.isFinite(centro.lat) || !Number.isFinite(centro.lng)) {
            mostrarFeedback('error', 'Não foi possível determinar o centro da área. Ajuste os pontos e tente novamente.');
            return;
        }

        salvamentoEmAndamento = true;
        btnSalvar.textContent = 'Salvando...';
        btnSalvar.setAttribute('aria-busy', 'true');
        atualizarControlesDesenho();

        // Permite que o estado visual de processamento seja renderizado antes da gravação local.
        await new Promise(resolve => requestAnimationFrame(resolve));

        try {
            const pontos = lerPontosPatrulhamento();
            const dados = {
                id: Date.now(),
                codigo: document.getElementById('codigoFinal').value,
                apelido: document.getElementById('apelido').value.trim(),
                poligono: vertices.map(vertice => ({
                    lat: Number(vertice.lat.toFixed(6)),
                    lng: Number(vertice.lng.toFixed(6))
                })),
                lat: Number(centro.lat.toFixed(6)),
                lng: Number(centro.lng.toFixed(6)),
                status: 'Ativo'
            };

            pontos.push(dados);
            await OrdenaStorage.setItem('pontosPatrulhamento', JSON.stringify(pontos));

            salvarFeedbackNavegacao('success', `Área de patrulhamento “${dados.apelido}” salva com sucesso.`);
            window.location.href = 'patrulhamento.html?filtro=Ativo';
        } catch (error) {
            console.error('Erro ao salvar ponto de patrulhamento:', error);
            mostrarFeedback('error', 'Não foi possível salvar a área de patrulhamento. Tente novamente.');
        } finally {
            salvamentoEmAndamento = false;
            btnSalvar.textContent = 'Salvar Área';
            btnSalvar.setAttribute('aria-busy', 'false');
            atualizarControlesDesenho();
        }
    });
}

function mostrarFeedback(tipo, mensagem) {
    if (!feedbackPatrulha) return;
    feedbackPatrulha.textContent = mensagem;
    feedbackPatrulha.className = `patrol-feedback is-visible ${tipo}`;
    feedbackPatrulha.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparFeedback() {
    if (!feedbackPatrulha) return;
    feedbackPatrulha.textContent = '';
    feedbackPatrulha.className = 'patrol-feedback';
    feedbackPatrulha.removeAttribute('role');
}

function salvarFeedbackNavegacao(tipo, mensagem) {
    try {
        sessionStorage.setItem(FEEDBACK_NAVEGACAO_KEY, JSON.stringify({ tipo, mensagem }));
    } catch (error) {
        console.warn('Não foi possível preservar a confirmação entre as páginas:', error);
    }
}

function restaurarFeedbackNavegacao() {
    try {
        const feedbackSalvo = sessionStorage.getItem(FEEDBACK_NAVEGACAO_KEY);
        if (!feedbackSalvo) return;

        sessionStorage.removeItem(FEEDBACK_NAVEGACAO_KEY);
        const dadosFeedback = JSON.parse(feedbackSalvo);
        if (dadosFeedback?.mensagem) {
            mostrarFeedback(dadosFeedback.tipo === 'error' ? 'error' : 'success', dadosFeedback.mensagem);
        }
    } catch (error) {
        try {
            sessionStorage.removeItem(FEEDBACK_NAVEGACAO_KEY);
        } catch (_) {
            // O cadastro já foi preservado no OrdenaStorage; a confirmação temporária é opcional.
        }
        console.warn('Não foi possível restaurar a confirmação do cadastro:', error);
    }
}

// --- LISTAGEM ---
function mudarFiltro(status) {
    statusFiltroAtual = status;
    atualizarBotoesFiltro();
    exibirPontos();
}

function atualizarBotoesFiltro() {
    const btnFiltroAtiva = document.getElementById('btnFiltroAtiva');
    const btnFiltroInativa = document.getElementById('btnFiltroInativa');

    if (btnFiltroAtiva) {
        const estaAtivo = statusFiltroAtual === 'Ativo';
        btnFiltroAtiva.classList.toggle('active', estaAtivo);
        btnFiltroAtiva.setAttribute('aria-pressed', String(estaAtivo));
    }

    if (btnFiltroInativa) {
        const estaAtivo = statusFiltroAtual === 'Inativo';
        btnFiltroInativa.classList.toggle('active', estaAtivo);
        btnFiltroInativa.setAttribute('aria-pressed', String(estaAtivo));
    }
}

function normalizarPoligono(poligono) {
    if (!Array.isArray(poligono)) return [];

    return poligono.map(vertice => {
        const latOriginal = Array.isArray(vertice) ? vertice[0] : vertice?.lat;
        const lngOriginal = Array.isArray(vertice) ? vertice[1] : vertice?.lng;
        if (latOriginal == null || lngOriginal == null || latOriginal === '' || lngOriginal === '') return null;
        const lat = Number(latOriginal);
        const lng = Number(lngOriginal);
        return { lat, lng };
    }).filter(vertice => vertice && (
        Number.isFinite(vertice.lat) && Number.isFinite(vertice.lng) &&
        vertice.lat >= -90 && vertice.lat <= 90 && vertice.lng >= -180 && vertice.lng <= 180
    ));
}

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[caractere]);
}

function exibirPontos() {
    if (!listaPatrulhamento) return;
    const pontos = lerPontosPatrulhamento();
    listaPatrulhamento.innerHTML = '';

    const filtrados = pontos
        .map((ponto, indexOriginal) => ({ ponto, indexOriginal }))
        .filter(item => item.ponto.status === statusFiltroAtual)
        .sort((a, b) => parseInt(a.ponto.codigo, 10) - parseInt(b.ponto.codigo, 10));

    if (filtrados.length === 0) {
        const statusArea = statusFiltroAtual === 'Ativo' ? 'ativa' : 'inativa';
        listaPatrulhamento.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#666;">Nenhuma área ${statusArea} encontrada.</td></tr>`;
        return;
    }

    filtrados.forEach(({ ponto, indexOriginal }) => {
        const classeStatus = ponto.status === 'Ativo' ? 'status-ativa' : 'status-inativa';
        const botaoStatus = ponto.status === 'Ativo'
            ? `<button type="button" class="btn-danger" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px;">Inativar</button>`
            : `<button type="button" class="btn-success" onclick="alternarStatus(${indexOriginal})" style="padding: 5px 10px;">Reativar</button>`;

        const poligono = normalizarPoligono(ponto.poligono);
        const descricaoArea = poligono.length >= MIN_VERTICES
            ? `<span style="color:#d32f2f; font-weight:bold;">${poligono.length} pontos</span>`
            : (Number(ponto.raio) > 0
                ? `<span style="color:#8a5a00; font-weight:bold;">Legado: raio ${escaparHtml(ponto.raio)} m</span>`
                : '<span style="color:#666;">Não definida</span>');

        listaPatrulhamento.innerHTML += `
            <tr>
                <td data-label="Código"><strong>${escaparHtml(ponto.codigo)}</strong></td>
                <td data-label="Identificação">${escaparHtml(ponto.apelido)}</td>
                <td data-label="Polígono">${descricaoArea}</td>
                <td data-label="Status"><span class="status-pill ${classeStatus}">${escaparHtml(ponto.status)}</span></td>
                <td data-label="Ações" style="text-align: center;">
                    <div class="acoes-patrulhamento">
                        <button type="button" class="btn-info" onclick="abrirMapaModal(${indexOriginal})" style="padding: 5px 10px;">🗺️ Área</button>
                        ${botaoStatus}
                    </div>
                </td>
            </tr>
        `;
    });
}

async function alternarStatus(index) {
    const pontos = lerPontosPatrulhamento();
    const ponto = pontos[index];
    if (!ponto) return;

    const novoStatus = ponto.status === 'Ativo' ? 'Inativo' : 'Ativo';
    if (!confirm(`Alterar status de "${ponto.apelido}"?`)) return;

    try {
        pontos[index].status = novoStatus;
        await OrdenaStorage.setItem('pontosPatrulhamento', JSON.stringify(pontos));
        exibirPontos();
        mostrarFeedback('success', `Status de “${ponto.apelido}” alterado para ${novoStatus.toLowerCase()}.`);
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        mostrarFeedback('error', 'Não foi possível alterar o status da área. Tente novamente.');
    }
}

// --- MODAL DE VISUALIZAÇÃO ---
function abrirMapaModal(index) {
    const ponto = lerPontosPatrulhamento()[index];
    if (!ponto) {
        mostrarFeedback('error', 'Não foi possível localizar a área selecionada.');
        return;
    }

    const modal = document.getElementById('modalVisualizacao');
    const mapaModal = document.getElementById('mapaModal');
    if (!modal || !mapaModal) {
        mostrarFeedback('error', 'Não foi possível abrir a visualização da área.');
        return;
    }
    const poligono = normalizarPoligono(ponto.poligono);
    const lat = ponto.lat == null || ponto.lat === '' ? NaN : Number(ponto.lat);
    const lng = ponto.lng == null || ponto.lng === '' ? NaN : Number(ponto.lng);
    const raio = ponto.raio == null || ponto.raio === '' ? NaN : Number(ponto.raio);

    modal.style.display = 'flex';
    document.getElementById('tituloModal').textContent = ponto.apelido || 'Área de Patrulhamento';

    if (poligono.length >= MIN_VERTICES) {
        document.getElementById('descModal').textContent = `Polígono com ${poligono.length} pontos`;
    } else if (Number.isFinite(raio) && raio > 0) {
        document.getElementById('descModal').textContent = `Cadastro legado por raio: ${raio} metros | GPS: ${lat}, ${lng}`;
    } else {
        document.getElementById('descModal').textContent = `GPS: ${lat}, ${lng}`;
    }

    if (modalMap) {
        modalMap.remove();
        modalMap = null;
    }

    setTimeout(() => {
        const centroValido = Number.isFinite(lat) && Number.isFinite(lng);
        const centro = centroValido ? [lat, lng] : CENTRO_INICIAL;
        modalMap = L.map('mapaModal').setView(centro, 16);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(modalMap);

        if (poligono.length >= MIN_VERTICES) {
            const camadaPoligono = L.polygon(poligono, {
                color: '#d32f2f',
                weight: 3,
                fillColor: '#f44336',
                fillOpacity: 0.2
            }).addTo(modalMap);
            modalMap.fitBounds(camadaPoligono.getBounds(), { padding: [25, 25], maxZoom: 17 });
        } else if (centroValido && Number.isFinite(raio) && raio > 0) {
            const camadaCirculo = L.circle(centro, {
                radius: raio,
                color: '#d32f2f',
                fillColor: '#f44336',
                fillOpacity: 0.2
            }).addTo(modalMap);
            L.marker(centro).addTo(modalMap);
            modalMap.fitBounds(camadaCirculo.getBounds(), { padding: [25, 25] });
        } else if (centroValido) {
            L.marker(centro).addTo(modalMap);
        }
    }, 100);
}

function fecharMapaModal() {
    const modal = document.getElementById('modalVisualizacao');
    if (modal) modal.style.display = 'none';
}

window.addEventListener('click', event => {
    const modal = document.getElementById('modalVisualizacao');
    if (event.target === modal) fecharMapaModal();
});
