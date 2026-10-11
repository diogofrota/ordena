const CENTRO_INICIAL_BASEAMENTO = [-22.9068, -43.1729];

let map;
let marker;
let modalMap;
let modalMarker;
let ultimoFocoModal = null;
let controladorGeocodificacao = null;
let sequenciaGeocodificacao = 0;
let geocodificacaoEmAndamento = false;
let salvamentoEmAndamento = false;
let erroArmazenamento = false;
let mapaCadastroDisponivel = true;

const filtroUrl = new URLSearchParams(window.location.search).get('filtro');
let statusFiltroAtual = filtroUrl === 'Inativo' ? 'Inativo' : 'Ativo';
const FEEDBACK_NAVEGACAO_BASEAMENTO_KEY = 'ordenaFeedbackBaseamento';

let form = null;
let listaEnderecos = null;
let btnSalvar = null;
let feedbackEndereco = null;
let feedbackListaEnderecos = null;

function inicializarPaginaEnderecos() {
    form = document.getElementById('formEndereco');
    listaEnderecos = document.getElementById('listaEnderecos');
    btnSalvar = document.getElementById('btnSalvar');
    feedbackEndereco = document.getElementById('feedbackEndereco');
    feedbackListaEnderecos = document.getElementById('feedbackListaEnderecos');

    if (form) {
        const elementoMapa = document.getElementById('map');
        iniciarMapaCadastro(elementoMapa);
        gerarProximoCodigo();
        atualizarEstadoBotaoSalvar();
        form.addEventListener('submit', salvarEndereco);
    }

    if (listaEnderecos) {
        atualizarBotoesFiltro();
        exibirLocais();
        configurarEventosModal();
        restaurarFeedbackNavegacao();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarPaginaEnderecos, { once: true });
} else {
    inicializarPaginaEnderecos();
}

function mostrarFeedback(elemento, tipo, mensagem) {
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.className = 'page-feedback is-visible ' + tipo;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparFeedback(elemento) {
    if (!elemento) return;
    elemento.textContent = '';
    elemento.className = 'page-feedback';
    elemento.removeAttribute('role');
}

function lerLocais() {
    erroArmazenamento = false;

    try {
        const conteudo = OrdenaStorage.getItem('locaisCadastrados');
        if (conteudo === null) return [];

        const locais = JSON.parse(conteudo);
        if (!Array.isArray(locais)) {
            throw new Error('A chave locaisCadastrados não contém uma lista.');
        }

        return locais;
    } catch (error) {
        erroArmazenamento = true;
        console.error('Erro ao ler os locais cadastrados:', error);
        const mensagem = 'Não foi possível carregar os locais salvos. Os dados existentes foram preservados.';
        mostrarFeedback(feedbackEndereco, 'error', mensagem);
        mostrarFeedback(feedbackListaEnderecos, 'error', mensagem);
        return [];
    }
}

// --- SEQUENCIAL AUTOMÁTICO ---
function gerarProximoCodigo() {
    const codigoFinal = document.getElementById('codigoFinal');
    if (!codigoFinal) return;

    const locais = lerLocais();
    const numeros = locais
        .map(local => parseInt(local && local.codigo, 10))
        .filter(Number.isFinite);
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;

    codigoFinal.value = proximo;
    atualizarEstadoBotaoSalvar();
}

// --- MAPA DE CADASTRO ---
function iniciarMapaCadastro(elementoMapa) {
    if (!elementoMapa || !elementoMapa.isConnected || map) return;

    if (typeof L === 'undefined') {
        mostrarFeedback(feedbackEndereco, 'error', 'Não foi possível carregar o mapa. Verifique sua conexão e tente novamente.');
        mapaCadastroDisponivel = false;
        atualizarEstadoBotaoSalvar();
        return;
    }

    try {
        map = L.map(elementoMapa).setView(CENTRO_INICIAL_BASEAMENTO, 13);
    } catch (error) {
        console.error('Erro ao iniciar o mapa de cadastro:', error);
        mostrarFeedback(feedbackEndereco, 'error', 'Não foi possível iniciar o mapa. Atualize a página e tente novamente.');
        mapaCadastroDisponivel = false;
        atualizarEstadoBotaoSalvar();
        return;
    }

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    marker = L.marker(CENTRO_INICIAL_BASEAMENTO, { draggable: true }).addTo(map);

    marker.on('dragend', () => {
        const coordenadas = marker.getLatLng();
        selecionarCoordenadas(coordenadas);
    });

    map.on('click', evento => {
        marker.setLatLng(evento.latlng);
        selecionarCoordenadas(evento.latlng);
    });
}

function selecionarCoordenadas(coordenadas) {
    atualizarInputs(coordenadas);
    limparCamposEnderecoAutomatico();
    limparFeedback(feedbackEndereco);
    buscarEnderecoPorCoordenadas(coordenadas.lat, coordenadas.lng);
}

function atualizarInputs(latlng) {
    const latitude = document.getElementById('latitude');
    const longitude = document.getElementById('longitude');
    if (!latitude || !longitude) return;

    latitude.value = Number(latlng.lat).toFixed(6);
    longitude.value = Number(latlng.lng).toFixed(6);
}

function limparCamposEnderecoAutomatico() {
    const campos = {
        nomeRua: '',
        numero: '',
        bairro: '',
        cidade: 'Rio de Janeiro',
        estado: 'RJ'
    };

    Object.entries(campos).forEach(([id, valor]) => {
        const campo = document.getElementById(id);
        if (campo) campo.value = valor;
    });
}

function definirStatusMapa(mensagem, tipo, carregando) {
    const statusMapa = document.getElementById('statusMapa');
    const statusTexto = document.getElementById('statusMapaTexto');
    const statusLoading = document.getElementById('statusMapaLoading');
    if (!statusMapa || !statusTexto) return;

    const cores = {
        loading: '#e65100',
        success: '#155724',
        error: '#721c24',
        info: '#666'
    };

    statusTexto.textContent = mensagem;
    statusMapa.style.color = cores[tipo] || cores.info;

    if (statusLoading) {
        statusLoading.hidden = !carregando;
        statusLoading.setAttribute('aria-hidden', String(!carregando));
    }
}

function atualizarEstadoBotaoSalvar() {
    if (!btnSalvar) return;

    const processando = geocodificacaoEmAndamento || salvamentoEmAndamento;
    btnSalvar.disabled = processando || erroArmazenamento || !mapaCadastroDisponivel;
    btnSalvar.setAttribute('aria-busy', String(processando));

    if (salvamentoEmAndamento) {
        btnSalvar.textContent = 'Salvando...';
    } else if (geocodificacaoEmAndamento) {
        btnSalvar.textContent = 'Buscando endereço...';
    } else {
        btnSalvar.textContent = 'Salvar Localização';
    }
}

// --- GEOCODIFICAÇÃO ---
async function buscarEnderecoPorCoordenadas(lat, lng) {
    const requisicaoAtual = ++sequenciaGeocodificacao;

    if (controladorGeocodificacao) {
        controladorGeocodificacao.abort();
    }

    controladorGeocodificacao = typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    geocodificacaoEmAndamento = true;
    atualizarEstadoBotaoSalvar();
    definirStatusMapa('Buscando endereço...', 'loading', true);

    try {
        const opcoes = controladorGeocodificacao
            ? { signal: controladorGeocodificacao.signal }
            : {};
        const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat='
            + encodeURIComponent(lat)
            + '&lon='
            + encodeURIComponent(lng);
        const response = await fetch(url, opcoes);

        if (!response.ok) {
            throw new Error('Falha na geocodificação: HTTP ' + response.status);
        }

        const data = await response.json();
        if (requisicaoAtual !== sequenciaGeocodificacao) return;

        if (!data || !data.address) {
            definirStatusMapa('Endereço não identificado para este ponto.', 'error', false);
            mostrarFeedback(feedbackEndereco, 'error', 'O ponto foi marcado, mas o endereço não pôde ser identificado.');
            return;
        }

        const endereco = data.address;
        const nomeRua = document.getElementById('nomeRua');
        const bairro = document.getElementById('bairro');
        const cidade = document.getElementById('cidade');
        const numero = document.getElementById('numero');
        const estado = document.getElementById('estado');

        if (nomeRua) nomeRua.value = endereco.road || endereco.pedestrian || endereco.footway || 'Via Desconhecida';
        if (bairro) bairro.value = endereco.suburb || endereco.neighbourhood || endereco.city_district || '';
        if (cidade) cidade.value = endereco.city || endereco.town || endereco.municipality || 'Rio de Janeiro';
        if (numero) numero.value = endereco.house_number || 'S/N';

        const codigoEstado = endereco['ISO3166-2-lvl4'];
        if (estado && typeof codigoEstado === 'string' && codigoEstado.includes('-')) {
            estado.value = codigoEstado.split('-').pop();
        }

        limparFeedback(feedbackEndereco);
        definirStatusMapa('Endereço atualizado pelo GPS.', 'success', false);
    } catch (error) {
        if (error && error.name === 'AbortError') return;
        if (requisicaoAtual !== sequenciaGeocodificacao) return;

        console.error('Erro na geocodificação:', error);
        definirStatusMapa('Erro ao buscar o endereço.', 'error', false);
        mostrarFeedback(feedbackEndereco, 'error', 'Não foi possível consultar o endereço. Tente selecionar o ponto novamente.');
    } finally {
        if (requisicaoAtual === sequenciaGeocodificacao) {
            controladorGeocodificacao = null;
            geocodificacaoEmAndamento = false;
            atualizarEstadoBotaoSalvar();
        }
    }
}

// --- CADASTRO ---
async function salvarEndereco(evento) {
    evento.preventDefault();
    if (salvamentoEmAndamento || geocodificacaoEmAndamento || erroArmazenamento) return;

    limparFeedback(feedbackEndereco);

    const apelidoCampo = document.getElementById('apelido');
    const latitudeCampo = document.getElementById('latitude');
    const longitudeCampo = document.getElementById('longitude');
    const apelido = apelidoCampo ? apelidoCampo.value.trim() : '';
    const latitude = latitudeCampo ? Number(latitudeCampo.value) : NaN;
    const longitude = longitudeCampo ? Number(longitudeCampo.value) : NaN;

    if (!apelido) {
        mostrarFeedback(feedbackEndereco, 'error', 'Informe o apelido do local.');
        if (apelidoCampo) apelidoCampo.focus();
        return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        mostrarFeedback(feedbackEndereco, 'error', 'Selecione a localização no mapa antes de salvar.');
        definirStatusMapa('Clique no mapa ou arraste o pino para selecionar o local.', 'error', false);
        return;
    }

    salvamentoEmAndamento = true;
    atualizarEstadoBotaoSalvar();

    await new Promise(resolve => window.requestAnimationFrame(resolve));

    try {
        const locais = lerLocais();
        if (erroArmazenamento) {
            throw new Error('Armazenamento local indisponível.');
        }

        const valor = id => {
            const campo = document.getElementById(id);
            return campo ? campo.value : '';
        };
        const dados = {
            id: Date.now(),
            codigo: valor('codigoFinal'),
            apelido: apelido,
            rua: valor('nomeRua'),
            numero: valor('numero'),
            bairro: valor('bairro'),
            cidade: valor('cidade'),
            lat: valor('latitude'),
            lng: valor('longitude'),
            status: 'Ativo'
        };

        locais.push(dados);
        await OrdenaStorage.setItem('locaisCadastrados', JSON.stringify(locais));

        mostrarFeedback(feedbackEndereco, 'success', 'Local salvo com sucesso. Abrindo a lista de locais ativos...');
        definirStatusMapa('Local salvo com sucesso.', 'success', false);
        btnSalvar.textContent = 'Salvo!';
        salvarFeedbackNavegacao('success', 'Local “' + dados.apelido + '” salvo com sucesso.');

        window.setTimeout(() => {
            window.location.href = 'enderecos.html?filtro=Ativo';
        }, 700);
    } catch (error) {
        console.error('Erro ao salvar local:', error);
        salvamentoEmAndamento = false;
        mostrarFeedback(feedbackEndereco, 'error', 'Não foi possível salvar o local. Tente novamente.');
        atualizarEstadoBotaoSalvar();
    }
}

function salvarFeedbackNavegacao(tipo, mensagem) {
    try {
        sessionStorage.setItem(
            FEEDBACK_NAVEGACAO_BASEAMENTO_KEY,
            JSON.stringify({ tipo, mensagem })
        );
    } catch (error) {
        console.warn('Não foi possível preservar a confirmação entre as páginas:', error);
    }
}

function restaurarFeedbackNavegacao() {
    try {
        const feedbackSalvo = sessionStorage.getItem(FEEDBACK_NAVEGACAO_BASEAMENTO_KEY);
        if (!feedbackSalvo) return;

        sessionStorage.removeItem(FEEDBACK_NAVEGACAO_BASEAMENTO_KEY);
        const dadosFeedback = JSON.parse(feedbackSalvo);
        if (dadosFeedback && dadosFeedback.mensagem) {
            mostrarFeedback(
                feedbackListaEnderecos,
                dadosFeedback.tipo === 'error' ? 'error' : 'success',
                dadosFeedback.mensagem
            );
        }
    } catch (error) {
        try {
            sessionStorage.removeItem(FEEDBACK_NAVEGACAO_BASEAMENTO_KEY);
        } catch (_) {
            // O cadastro já foi preservado; a confirmação temporária é opcional.
        }
        console.warn('Não foi possível restaurar a confirmação do cadastro:', error);
    }
}

// --- LISTAGEM E FILTROS ---
function mudarFiltro(status) {
    if (status !== 'Ativo' && status !== 'Inativo') return;

    statusFiltroAtual = status;
    atualizarBotoesFiltro();

    if (window.history && typeof window.history.replaceState === 'function') {
        const url = new URL(window.location.href);
        url.searchParams.set('filtro', status);
        window.history.replaceState({}, '', url);
    }

    exibirLocais();
}

function atualizarBotoesFiltro() {
    const btnFiltroAtiva = document.getElementById('btnFiltroAtiva');
    const btnFiltroInativa = document.getElementById('btnFiltroInativa');

    if (btnFiltroAtiva) {
        const ativoSelecionado = statusFiltroAtual === 'Ativo';
        btnFiltroAtiva.classList.toggle('active', ativoSelecionado);
        btnFiltroAtiva.setAttribute('aria-pressed', String(ativoSelecionado));
    }

    if (btnFiltroInativa) {
        const inativoSelecionado = statusFiltroAtual === 'Inativo';
        btnFiltroInativa.classList.toggle('active', inativoSelecionado);
        btnFiltroInativa.setAttribute('aria-pressed', String(inativoSelecionado));
    }
}

function escaparHtml(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>'"]/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[caractere]);
}

function numeroCoordenada(valor) {
    if (valor === null || valor === undefined || valor === '') return NaN;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

function exibirLocais() {
    if (!listaEnderecos) return;

    const locais = lerLocais();
    listaEnderecos.innerHTML = '';

    if (erroArmazenamento) {
        listaEnderecos.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#721c24;">Não foi possível carregar os locais.</td></tr>';
        return;
    }

    const locaisFiltrados = locais
        .map((local, originalIndex) => ({ local: local || {}, originalIndex }))
        .filter(item => item.local.status === statusFiltroAtual)
        .sort((a, b) => String(a.local.apelido || '').localeCompare(
            String(b.local.apelido || ''),
            'pt-BR',
            { sensitivity: 'base' }
        ));

    if (locaisFiltrados.length === 0) {
        listaEnderecos.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#666;">Nenhum local '
            + (statusFiltroAtual === 'Ativo' ? 'ativo' : 'inativo')
            + ' encontrado.</td></tr>';
        return;
    }

    locaisFiltrados.forEach(item => {
        const local = item.local;
        const indexOriginal = item.originalIndex;
        const classeStatus = local.status === 'Ativo' ? 'status-ativa' : 'status-inativa';
        const lat = numeroCoordenada(local.lat);
        const lng = numeroCoordenada(local.lng);
        const coordenadasValidas = Number.isFinite(lat) && Number.isFinite(lng);
        const gps = coordenadasValidas ? lat.toFixed(4) + ', ' + lng.toFixed(4) : '-';
        const logradouro = local.rua
            ? String(local.rua) + ', ' + String(local.numero || 'S/N')
            : '-';
        const botaoMapa = coordenadasValidas
            ? '<button type="button" class="btn-info" onclick="abrirMapaModal(' + indexOriginal + ')" style="padding:5px 10px;">🗺️ Mapa</button>'
            : '<button type="button" class="btn-info" disabled aria-disabled="true" title="Coordenadas indisponíveis" style="padding:5px 10px;">🗺️ Mapa</button>';
        const botaoStatus = local.status === 'Ativo'
            ? '<button type="button" class="btn-danger" onclick="alternarStatus(' + indexOriginal + ')" style="padding:5px 10px;">Inativar</button>'
            : '<button type="button" class="btn-success" onclick="alternarStatus(' + indexOriginal + ')" style="padding:5px 10px;">Reativar</button>';

        listaEnderecos.insertAdjacentHTML('beforeend',
            '<tr>'
            + '<td data-label="Código"><strong>' + escaparHtml(local.codigo || '-') + '</strong></td>'
            + '<td data-label="Apelido">' + escaparHtml(local.apelido || '-') + '</td>'
            + '<td data-label="Logradouro">' + escaparHtml(logradouro) + '</td>'
            + '<td data-label="Bairro">' + escaparHtml(local.bairro || '-') + '</td>'
            + '<td data-label="Município">' + escaparHtml(local.cidade || '-') + '</td>'
            + '<td data-label="GPS"><span style="font-family:monospace; color:#1a237e; font-size:0.85em; white-space:nowrap;">' + escaparHtml(gps) + '</span></td>'
            + '<td data-label="Status"><span class="status-pill ' + classeStatus + '">' + escaparHtml(local.status) + '</span></td>'
            + '<td data-label="Ações" style="text-align:center;"><div class="acoes-endereco">' + botaoMapa + botaoStatus + '</div></td>'
            + '</tr>'
        );
    });
}

async function alternarStatus(index) {
    const locais = lerLocais();
    const local = locais[index];
    if (erroArmazenamento || !local) {
        mostrarFeedback(feedbackListaEnderecos, 'error', 'Não foi possível localizar o registro selecionado.');
        return;
    }

    const novoStatus = local.status === 'Ativo' ? 'Inativo' : 'Ativo';
    if (!window.confirm('Alterar status de "' + String(local.apelido || 'local') + '"?')) return;

    try {
        locais[index].status = novoStatus;
        await OrdenaStorage.setItem('locaisCadastrados', JSON.stringify(locais));
        exibirLocais();
        mostrarFeedback(
            feedbackListaEnderecos,
            'success',
            'Status de "' + String(local.apelido || 'Local') + '" alterado para ' + novoStatus.toLowerCase() + '.'
        );
    } catch (error) {
        console.error('Erro ao alterar status do local:', error);
        mostrarFeedback(feedbackListaEnderecos, 'error', 'Não foi possível alterar o status. Tente novamente.');
    }
}

// --- MODAL DE MAPA ---
function abrirMapaModal(index) {
    const modal = document.getElementById('modalVisualizacao');
    const tituloModal = document.getElementById('tituloModal');
    const descModal = document.getElementById('descModal');
    const elementoMapaModal = document.getElementById('mapaModal');
    if (!modal || !tituloModal || !descModal || !elementoMapaModal || !elementoMapaModal.isConnected) return;

    if (typeof L === 'undefined') {
        mostrarFeedback(feedbackListaEnderecos, 'error', 'Não foi possível carregar o mapa. Verifique sua conexão e tente novamente.');
        return;
    }

    const locais = lerLocais();
    const local = locais[index];
    if (erroArmazenamento || !local) {
        mostrarFeedback(feedbackListaEnderecos, 'error', 'Não foi possível localizar o registro selecionado.');
        return;
    }

    const lat = numeroCoordenada(local.lat);
    const lng = numeroCoordenada(local.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        mostrarFeedback(feedbackListaEnderecos, 'error', 'Este local não possui coordenadas válidas para exibição.');
        return;
    }

    ultimoFocoModal = document.activeElement;
    tituloModal.textContent = local.apelido || 'Visualização de Local';
    descModal.textContent = 'Coordenadas: ' + lat + ', ' + lng;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    if (!modalMap) {
        try {
            modalMap = L.map(elementoMapaModal);
        } catch (error) {
            console.error('Erro ao iniciar o mapa de visualização:', error);
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            mostrarFeedback(feedbackListaEnderecos, 'error', 'Não foi possível abrir o mapa deste local. Atualize a página e tente novamente.');
            return;
        }

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(modalMap);
        modalMarker = L.marker([lat, lng]).addTo(modalMap);
    } else {
        modalMarker.setLatLng([lat, lng]);
    }

    window.setTimeout(() => {
        modalMap.invalidateSize();
        modalMap.setView([lat, lng], 15);
    }, 100);

    modal.querySelector('.modal-close-btn')?.focus();
}

function fecharMapaModal() {
    const modal = document.getElementById('modalVisualizacao');
    if (!modal) return;

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    if (ultimoFocoModal && typeof ultimoFocoModal.focus === 'function') {
        ultimoFocoModal.focus();
    }
}

function configurarEventosModal() {
    const modal = document.getElementById('modalVisualizacao');
    if (!modal) return;

    modal.addEventListener('click', evento => {
        if (evento.target === modal) fecharMapaModal();
    });

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && modal.style.display === 'flex') {
            fecharMapaModal();
        }
    });
}
