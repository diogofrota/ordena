let map;
let markersLayer;
let areasLayer;
let popupFixadoEscalaId = null;
let atualizandoMapaTatico = false;
let equipeFiltradaNoMapaId = null;
let centralizarEquipeFiltradaNoMapa = false;
const equipesCardsExpandidos = new Set();

document.addEventListener('DOMContentLoaded', () => {
    iniciarMapa();
    configurarAcoesPainelEquipes();
    atualizarMapaTatico();
    setInterval(atualizarMapaTatico, 5000);
});

function processarBaixasAutomaticasNoMapa() {
    const api = window.ORDENA_STORAGE_NORMALIZER;
    if (!api || typeof api.processarBaixasAutomaticasEscalas !== 'function') return false;
    const resultado = api.processarBaixasAutomaticasEscalas({ save: true });
    return !!(resultado && resultado.changed);
}

function iniciarMapa() {
    map = L.map('mapaOperacional', { closePopupOnClick: false }).setView([-22.9068, -43.1729], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; ORDENA SGO'
    }).addTo(map);

    areasLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    // Ajuste de layout após Leaflet montar o mapa dentro do container flex.
    setTimeout(() => map.invalidateSize(), 100);
}

function atualizarMapaTatico() {
    processarBaixasAutomaticasNoMapa();
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];

    const todosLocais = [
        ...(JSON.parse(localStorage.getItem('locaisCadastrados')) || []),
        ...(JSON.parse(localStorage.getItem('pontosPatrulhamento')) || []),
        ...(JSON.parse(localStorage.getItem('cabines')) || []),
        ...(JSON.parse(localStorage.getItem('setores')) || [])
    ];

    const placasPorPrefixo = new Map(
        viaturas
            .filter(v => v && v.prefixo)
            .map(v => [v.prefixo, v.placa || ''])
    );

    const ordensPorNumero = new Map(
        ordens
            .filter(o => o && o.numero != null)
            .map(o => [String(o.numero), o])
    );

    const stats = {
        efetivo: 0,
        carros: 0,
        motos: 0,
        setores: 0,
        cabines: 0,
        patrulha: 0,
        base: 0,
        desloc: 0,
        intervalo: 0,
        prelecao: 0,
        retorno: 0
    };

    const agora = new Date();
    const horaAtualStr = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const horaAtualMin = horaParaMinutos(horaAtualStr);

    const equipesCards = [];
    const markersByEscalaId = new Map();
    const ocupacaoCoordenadas = new Map();
    let encontrouEquipeFiltrada = !equipeFiltradaNoMapaId;

    atualizandoMapaTatico = true;
    if (areasLayer) areasLayer.clearLayers();
    markersLayer.clearLayers();

    escalas.forEach(escala => {
        const equipe = Array.isArray(escala.equipe) ? escala.equipe : [];
        const qtdEquipe = equipe.length > 0 ? equipe.length : 1;
        stats.efetivo += qtdEquipe;

        const tipoRecursoNormalizado = normalizarTipo(escala.tipoRecurso || 'Viatura');
        if (tipoRecursoNormalizado === 'moto') stats.motos++;
        else if (tipoRecursoNormalizado === 'setor') stats.setores++;
        else if (tipoRecursoNormalizado === 'cabine') stats.cabines++;
        else stats.carros++;

        const os = ordensPorNumero.get(String(escala.osNumero)) || null;
        const atividades = Array.isArray(os?.atividades) ? os.atividades : [];
        const atividadeAtual = obterAtividadeAtual(atividades, horaAtualMin);
        const referenciaMapa = obterReferenciaMapaParaEquipe(atividades, horaAtualMin, todosLocais);

        if (atividadeAtual) {
            contabilizarAtividadeAtual(stats, atividadeAtual.tipo || '');
        }

        const areaPatrulhamentoAtual = obterAreaPatrulhamentoAtual(atividadeAtual, todosLocais);

        const coordsReais = referenciaMapa?.coords || null;
        const coords = coordsReais ? obterCoordenadasPlotagem(coordsReais, ocupacaoCoordenadas) : null;
        const infoEquipe = montarInfoEquipeMapa({
            escala,
            os,
            atividadeAtual,
            atividadeReferenciaMapa: referenciaMapa?.atividade || null,
            coords,
            coordsReais,
            placasPorPrefixo
        });

        equipesCards.push(infoEquipe);
        if (equipeFiltradaNoMapaId && String(infoEquipe.idEscala) === String(equipeFiltradaNoMapaId)) {
            encontrouEquipeFiltrada = true;
        }

        const exibirEquipeNoMapa = !equipeFiltradaNoMapaId || String(infoEquipe.idEscala) === String(equipeFiltradaNoMapaId);
        if (!exibirEquipeNoMapa) {
            return;
        }

        if (areaPatrulhamentoAtual) {
            adicionarAreaPatrulhamentoNoMapa(areaPatrulhamentoAtual, tipoRecursoNormalizado);
        }

        if (coords) {
            const marker = adicionarPinoNoMapa(infoEquipe, tipoRecursoNormalizado);
            markersByEscalaId.set(String(infoEquipe.idEscala), marker);
        }
    });

    if (!encontrouEquipeFiltrada && equipeFiltradaNoMapaId) {
        equipeFiltradaNoMapaId = null;
        centralizarEquipeFiltradaNoMapa = false;
        popupFixadoEscalaId = null;
        atualizandoMapaTatico = false;
        return atualizarMapaTatico();
    }

    atualizandoMapaTatico = false;

    renderizarPainelEquipesAtivas(equipesCards, agora);
    atualizarKpis(stats);

    if (equipeFiltradaNoMapaId && centralizarEquipeFiltradaNoMapa && markersByEscalaId.has(String(equipeFiltradaNoMapaId))) {
        const markerFiltrado = markersByEscalaId.get(String(equipeFiltradaNoMapaId));
        map.panTo(markerFiltrado.getLatLng(), { animate: true, duration: 0.35 });
        centralizarEquipeFiltradaNoMapa = false;
    }

    if (popupFixadoEscalaId && markersByEscalaId.has(String(popupFixadoEscalaId))) {
        markersByEscalaId.get(String(popupFixadoEscalaId)).openPopup();
    }
}

function montarInfoEquipeMapa({ escala, os, atividadeAtual, atividadeReferenciaMapa, coords, coordsReais, placasPorPrefixo }) {
    const comandante = (Array.isArray(escala.equipe) && escala.equipe[0]) ? escala.equipe[0] : {};

    const dataAtivacao = escala.dataAtivacao || formatarDataBr(escala.dataInicio);
    const horaAtivacao = escala.horaAtivacao || formatarHoraBr(escala.dataInicio);
    const horaInicioServico = escala.horaInicioServico || os?.inicioGeral || escala.osResumo?.inicioGeral || '-';
    const horaFimServico = escala.horaFimServico || os?.terminoGeral || escala.osResumo?.terminoGeral || '-';
    const tipoServico = escala.tipoServico || escala.osResumo?.tipoOrdem || '-';
    const localAtual = obterTextoLocalAtual(atividadeAtual);
    const atividadeAtualNome = atividadeAtual?.tipo || 'Sem atividade no horário atual';
    const horarioAtividadeAtual = atividadeAtual ? `${atividadeAtual.inicio || '-'} às ${atividadeAtual.fim || '-'}` : '-';
    const localMapa = atividadeReferenciaMapa ? obterTextoLocalAtual(atividadeReferenciaMapa) : localAtual;
    const recursoExibicao = obterRecursoExibicao(escala, placasPorPrefixo);
    const temaLocalAtual = obterTemaLocalAtual(atividadeAtualNome);

    return {
        idEscala: escala.id,
        recursoId: escala.recursoId || '-',
        recursoExibicao,
        tipoRecurso: escala.tipoRecurso || '-',
        osNumero: escala.osNumero || '-',
        missao: os?.nomeOS || escala.osResumo?.nomeOS || '-',
        tipoServico,
        dataAtivacao,
        horaAtivacao,
        horaInicioServico,
        horaFimServico,
        comandanteNome: `${comandante.posto || ''} ${comandante.nome || ''}`.trim() || '-',
        comandanteTelefone: comandante.tel || '-',
        comandanteRg: comandante.rg || '-',
        localAtual,
        localMapa,
        atividadeAtualNome,
        horarioAtividadeAtual,
        temaLocalAtual,
        atividadeAtual,
        atividadeReferenciaMapa,
        coords,
        coordsReais: coordsReais || coords
    };
}

function renderizarPainelEquipesAtivas(equipesCards, agora) {
    const container = document.getElementById('listaEquipesAtivas');
    const meta = document.getElementById('metaEquipesAtivas');
    const btnMostrarTodas = document.getElementById('btnMostrarTodasMapa');
    if (!container) return;

    const horaAtualizada = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
    if (meta) {
        const sufixoFiltro = equipeFiltradaNoMapaId ? ' • mapa filtrado em 1 equipe' : '';
        meta.innerText = `${equipesCards.length} equipe(s) ativa(s) • Atualizado ${horaAtualizada}${sufixoFiltro}`;
    }
    if (btnMostrarTodas) btnMostrarTodas.disabled = !equipeFiltradaNoMapaId;

    container.innerHTML = '';

    if (equipesCards.length === 0) {
        equipesCardsExpandidos.clear();
        container.innerHTML = '<div class="sidebar-empty">Nenhuma equipe ativa no momento.</div>';
        return;
    }

    const idsAtuais = new Set(equipesCards.map(info => String(info.idEscala)));
    Array.from(equipesCardsExpandidos).forEach(id => {
        if (!idsAtuais.has(String(id))) equipesCardsExpandidos.delete(String(id));
    });

    equipesCards
        .sort((a, b) => a.recursoExibicao.localeCompare(b.recursoExibicao, 'pt-BR'))
        .forEach(info => {
            const card = document.createElement('div');
            const selecionadoNoMapa = equipeFiltradaNoMapaId && String(info.idEscala) === String(equipeFiltradaNoMapaId);
            const cardExpandido = equipesCardsExpandidos.has(String(info.idEscala));
            card.className = `equipe-card equipe-card-clickable${selecionadoNoMapa ? ' is-map-selected' : ''}${cardExpandido ? ' is-expanded' : ' is-collapsed'}`;
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.dataset.escalaId = String(info.idEscala);
            card.title = 'Clique para mostrar somente esta equipe no mapa';
            card.innerHTML = `
                <div class="equipe-card-topo">
                    <div>
                        <div class="equipe-card-titulo">${escaparHtml(info.recursoExibicao)}</div>
                        <small style="color:#555;">OS ${escaparHtml(String(info.osNumero))} • ${escaparHtml(info.missao)}</small>
                    </div>
                    <div class="equipe-card-topo-acoes">
                        <span class="badge-servico">${escaparHtml(info.tipoServico)}</span>
                        <button
                            type="button"
                            class="btn-expandir-card-equipe"
                            data-escala-id="${escaparHtml(String(info.idEscala))}"
                            aria-expanded="${cardExpandido ? 'true' : 'false'}"
                            aria-label="${cardExpandido ? 'Recolher detalhes da equipe' : 'Expandir detalhes da equipe'}"
                            title="${cardExpandido ? 'Recolher detalhes' : 'Expandir detalhes'}"
                        >
                            <span class="chevron">${cardExpandido ? '▴' : '▾'}</span>
                        </button>
                    </div>
                </div>

                <div class="equipe-card-detalhes">
                    <div class="equipe-card-grid">
                        <div class="equipe-item">
                            <span>Data Início</span>
                            <strong>${escaparHtml(info.dataAtivacao)}</strong>
                        </div>
                        <div class="equipe-item">
                            <span>Hora Ativação</span>
                            <strong>${escaparHtml(info.horaAtivacao)}</strong>
                        </div>
                        <div class="equipe-item">
                            <span>Hora Início</span>
                            <strong>${escaparHtml(info.horaInicioServico)}</strong>
                        </div>
                        <div class="equipe-item">
                            <span>Hora Término</span>
                            <strong>${escaparHtml(info.horaFimServico)}</strong>
                        </div>
                        <div class="equipe-item">
                            <span>Comandante</span>
                            <strong>${escaparHtml(info.comandanteNome)}</strong>
                        </div>
                        <div class="equipe-item">
                            <span>Telefone</span>
                            <strong>${escaparHtml(info.comandanteTelefone)}</strong>
                        </div>
                    </div>

                    <div class="equipe-local-atual tema-${info.temaLocalAtual || 'blue'}">
                        <span>Local Atual</span>
                        <strong>${escaparHtml(info.localAtual)}</strong>
                        <small>${escaparHtml(info.atividadeAtualNome)} • ${escaparHtml(info.horarioAtividadeAtual)}</small>
                    </div>
                </div>
            `;

            const acionarFiltro = () => filtrarMapaPorEquipe(info.idEscala);
            card.addEventListener('click', acionarFiltro);
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    acionarFiltro();
                }
            });

            const btnExpandir = card.querySelector('.btn-expandir-card-equipe');
            if (btnExpandir) {
                btnExpandir.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    alternarExpansaoCardEquipe(info.idEscala, card, btnExpandir);
                });
                btnExpandir.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.stopPropagation();
                    }
                });
            }

            container.appendChild(card);
        });
}

function configurarAcoesPainelEquipes() {
    const btnMostrarTodas = document.getElementById('btnMostrarTodasMapa');
    if (!btnMostrarTodas) return;

    btnMostrarTodas.addEventListener('click', () => {
        if (!equipeFiltradaNoMapaId) return;
        equipeFiltradaNoMapaId = null;
        centralizarEquipeFiltradaNoMapa = false;
        popupFixadoEscalaId = null;
        atualizarMapaTatico();
    });
}

function filtrarMapaPorEquipe(idEscala) {
    if (idEscala == null) return;
    equipeFiltradaNoMapaId = String(idEscala);
    popupFixadoEscalaId = String(idEscala);
    centralizarEquipeFiltradaNoMapa = true;
    atualizarMapaTatico();
}

function alternarExpansaoCardEquipe(idEscala, cardElement, btnElement) {
    const id = String(idEscala);
    const estavaExpandido = equipesCardsExpandidos.has(id);
    const expandido = !estavaExpandido;

    if (expandido) equipesCardsExpandidos.add(id);
    else equipesCardsExpandidos.delete(id);

    if (cardElement) {
        cardElement.classList.toggle('is-expanded', expandido);
        cardElement.classList.toggle('is-collapsed', !expandido);
    }

    if (btnElement) {
        btnElement.setAttribute('aria-expanded', expandido ? 'true' : 'false');
        btnElement.setAttribute('aria-label', expandido ? 'Recolher detalhes da equipe' : 'Expandir detalhes da equipe');
        btnElement.setAttribute('title', expandido ? 'Recolher detalhes' : 'Expandir detalhes');
        const chevron = btnElement.querySelector('.chevron');
        if (chevron) chevron.textContent = expandido ? '▴' : '▾';
    }
}

function atualizarKpis(stats) {
    document.getElementById('kpiEfetivo').innerText = stats.efetivo;
    document.getElementById('kpiCarros').innerText = stats.carros;
    document.getElementById('kpiMotos').innerText = stats.motos;
    document.getElementById('kpiSetores').innerText = stats.setores;

    document.getElementById('kpiPatrulha').innerText = stats.patrulha;
    document.getElementById('kpiBase').innerText = stats.base;
    document.getElementById('kpiDesloc').innerText = stats.desloc;
    document.getElementById('kpiRetorno').innerText = stats.retorno;
    document.getElementById('kpiIntervalo').innerText = stats.intervalo;
    document.getElementById('kpiPrelecao').innerText = stats.prelecao;
}

function contabilizarAtividadeAtual(stats, tipoAtividade) {
    const tipo = (tipoAtividade || '').toLowerCase();
    if (tipo.includes('patrulhamento')) stats.patrulha++;
    else if (tipo.includes('baseamento')) stats.base++;
    else if (tipo.includes('deslocamento')) stats.desloc++;
    else if (tipo.includes('intervalo')) stats.intervalo++;
    else if (tipo.includes('preleção') || tipo.includes('prelecao')) stats.prelecao++;
    else if (tipo.includes('retorno')) stats.retorno++;
}

function obterTemaLocalAtual(tipoAtividade) {
    const tipo = (tipoAtividade || '').toLowerCase();
    if (tipo.includes('patrulhamento') || tipo.includes('baseamento')) return 'green';
    if (
        tipo.includes('deslocamento') ||
        tipo.includes('retorno') ||
        tipo.includes('intervalo') ||
        tipo.includes('preleção') ||
        tipo.includes('prelecao')
    ) {
        return 'orange';
    }
    return 'blue';
}

function obterAtividadeAtual(atividades, horaAtualMin) {
    if (!Array.isArray(atividades) || !Number.isFinite(horaAtualMin)) return null;

    return atividades.find(atividade => horarioContemMomento(atividade.inicio, atividade.fim, horaAtualMin)) || null;
}

function obterIndiceAtividadeAtual(atividades, horaAtualMin) {
    if (!Array.isArray(atividades) || !Number.isFinite(horaAtualMin)) return -1;
    return atividades.findIndex(atividade => horarioContemMomento(atividade.inicio, atividade.fim, horaAtualMin));
}

function obterReferenciaMapaParaEquipe(atividades, horaAtualMin, listaLocais) {
    if (!Array.isArray(atividades) || atividades.length === 0) return null;

    const idxAtual = obterIndiceAtividadeAtual(atividades, horaAtualMin);
    const tentarAtividade = (atividade) => {
        if (!atividade) return null;
        const coords = obterCoordenadasAtividade(atividade, listaLocais);
        if (!coords) return null;
        return { atividade, coords };
    };

    if (idxAtual >= 0) {
        // Só plota marcador quando a atividade do horário atual tiver ponto georreferenciado.
        return tentarAtividade(atividades[idxAtual]);
    }

    return null;
}

function horarioContemMomento(horaInicio, horaFim, horaAtualMin) {
    const inicioMin = horaParaMinutos(horaInicio);
    const fimMin = horaParaMinutos(horaFim);
    if (!Number.isFinite(inicioMin) || !Number.isFinite(fimMin)) return false;

    if (fimMin >= inicioMin) {
        return horaAtualMin >= inicioMin && horaAtualMin <= fimMin;
    }

    // Faixa atravessa meia-noite (ex.: 23:00 -> 02:00)
    return horaAtualMin >= inicioMin || horaAtualMin <= fimMin;
}

function horaParaMinutos(hora) {
    if (!hora || typeof hora !== 'string' || !hora.includes(':')) return NaN;
    const [h, m] = hora.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return (h * 60) + m;
}

function obterCoordenadasAtividade(atividade, listaLocais) {
    if (!atividade) return null;

    if (atividade.gps && atividade.gps.lat && atividade.gps.lng) {
        return { lat: atividade.gps.lat, lng: atividade.gps.lng };
    }

    if (atividade.local) {
        return encontrarCoordenadas(atividade.local, listaLocais);
    }

    return null;
}

function obterAreaPatrulhamentoAtual(atividade, listaLocais) {
    if (!atividade) return null;
    const tipo = (atividade.tipo || '').toLowerCase();
    if (!tipo.includes('patrulhamento')) return null;

    const coords = obterCoordenadasAtividade(atividade, listaLocais);
    const raio = obterRaioAtividadeMetros(atividade, listaLocais);

    if (!coords) return null;
    if (!Number.isFinite(raio) || raio <= 0) return null;

    return { coords, raio };
}

function obterRaioAtividadeMetros(atividade, listaLocais) {
    if (!atividade) return null;

    const raioGps = Number(atividade?.gps?.raio);
    if (Number.isFinite(raioGps) && raioGps > 0) return raioGps;

    if (atividade.local) {
        const local = encontrarLocalNoCadastro(atividade.local, listaLocais);
        const raioLocal = Number(local?.raio);
        if (Number.isFinite(raioLocal) && raioLocal > 0) return raioLocal;
    }

    const detalhes = String(atividade.detalhes || '');
    const matchRaio = detalhes.match(/raio\s*(\d+(?:[.,]\d+)?)\s*m/i);
    if (matchRaio) {
        const valor = Number(matchRaio[1].replace(',', '.'));
        if (Number.isFinite(valor) && valor > 0) return valor;
    }

    return null;
}

function obterCoordenadasPlotagem(coords, ocupacaoCoordenadas) {
    if (!coords) return null;
    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    if (!(ocupacaoCoordenadas instanceof Map)) {
        return { lat, lng };
    }

    const chave = `${lat.toFixed(6)}|${lng.toFixed(6)}`;
    const indice = ocupacaoCoordenadas.get(chave) || 0;
    ocupacaoCoordenadas.set(chave, indice + 1);

    if (indice === 0) return { lat, lng };

    // Espalha pinos coincidentes em volta do ponto real para evitar sobreposição visual.
    const raioMetros = 30 + (Math.floor((indice - 1) / 6) * 18);
    const angulo = ((indice - 1) % 6) * (Math.PI / 3);
    const deltaLat = (raioMetros / 111320) * Math.cos(angulo);
    const cosLat = Math.cos(lat * (Math.PI / 180));
    const divisorLng = 111320 * (Math.abs(cosLat) > 0.0001 ? cosLat : 0.0001);
    const deltaLng = (raioMetros / divisorLng) * Math.sin(angulo);

    return {
        lat: lat + deltaLat,
        lng: lng + deltaLng
    };
}

function adicionarAreaPatrulhamentoNoMapa(area, tipoRecursoNormalizado) {
    if (!areasLayer || !area?.coords) return;
    const lat = Number(area.coords.lat);
    const lng = Number(area.coords.lng);
    const raio = Number(area.raio);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(raio) || raio <= 0) return;

    let corClasse = 'pin-viatura';
    if (tipoRecursoNormalizado === 'moto') corClasse = 'pin-moto';
    if (tipoRecursoNormalizado === 'setor') corClasse = 'pin-setor';
    if (tipoRecursoNormalizado === 'cabine') corClasse = 'pin-cabine';
    const cor = getCorHex(corClasse);

    L.circle([lat, lng], {
        radius: raio,
        color: cor,
        weight: 2,
        opacity: 0.75,
        fillColor: cor,
        fillOpacity: 0.14,
        interactive: false
    }).addTo(areasLayer);
}

function normalizarTipo(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t.includes('moto')) return 'moto';
    if (t.includes('setor')) return 'setor';
    if (t.includes('cabine')) return 'cabine';
    return 'carro';
}

function obterRecursoExibicao(escala, placasPorPrefixo) {
    const tipo = (escala.tipoRecurso || '').toLowerCase();
    const placa = placasPorPrefixo.get(escala.recursoId);

    if (!tipo.includes('cabine') && !tipo.includes('setor') && placa) {
        return placa;
    }
    return escala.recursoId || '-';
}

function obterTextoLocalAtual(atividade) {
    if (!atividade) return 'Sem atividade no horário atual';
    if (atividade.local) return atividade.local;

    const endereco = montarEnderecoTexto(atividade);
    if (endereco) return endereco;

    return 'Local não informado';
}

function montarEnderecoTexto(atividade) {
    if (!atividade) return '';

    const rua = atividade.rua && atividade.rua !== '-' ? atividade.rua : '';
    const numero = atividade.numero && atividade.numero !== '-' ? atividade.numero : '';
    const bairro = atividade.bairro && atividade.bairro !== '-' ? atividade.bairro : '';
    const cidade = atividade.cidade && atividade.cidade !== '-' ? atividade.cidade : '';

    const parteLogradouro = rua ? `${rua}${numero ? `, ${numero}` : ''}` : '';
    const parteBairroCidade = [bairro, cidade].filter(Boolean).join(' - ');

    return [parteLogradouro, parteBairroCidade].filter(Boolean).join(' | ');
}

function formatarDataBr(dataIso) {
    if (!dataIso) return '-';
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return '-';
    return data.toLocaleDateString('pt-BR');
}

function formatarHoraBr(dataIso) {
    if (!dataIso) return '-';
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return '-';
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function encontrarCoordenadas(textoLocal, listaLocais) {
    const match = encontrarLocalNoCadastro(textoLocal, listaLocais);
    if (match && match.lat && match.lng) {
        return { lat: match.lat, lng: match.lng };
    }
    return null;
}

function encontrarLocalNoCadastro(textoLocal, listaLocais) {
    if (!textoLocal || !Array.isArray(listaLocais)) return null;

    let match = listaLocais.find(l => {
        if (!l) return false;
        const codigoOuApelido = l.apelido || l.codigo || '';
        const rua = l.rua || '';
        const numero = l.numero || 'S/N';
        const bairro = l.bairro || '';
        const textoCompletoBanco = `[${codigoOuApelido}] - ${rua}, ${numero} - ${bairro}`;
        return textoLocal === textoCompletoBanco;
    });

    if (!match) {
        match = listaLocais.find(l => {
            if (!l) return false;
            const chave = l.codigo || l.apelido;
            return chave && textoLocal.includes(chave);
        });
    }

    return match || null;
}

function adicionarPinoNoMapa(infoEquipe, tipoRecursoNormalizado) {
    let corPin = 'pin-viatura';

    if (tipoRecursoNormalizado === 'moto') corPin = 'pin-moto';
    if (tipoRecursoNormalizado === 'setor') corPin = 'pin-setor';
    if (tipoRecursoNormalizado === 'cabine') corPin = 'pin-cabine';

    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div style="background-color:${getCorHex(corPin)}" class="marker-pin"></div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
    });

    const marker = L.marker([infoEquipe.coords.lat, infoEquipe.coords.lng], {
        icon: customIcon,
        title: `${infoEquipe.recursoExibicao} - ${infoEquipe.tipoServico}`
    }).addTo(markersLayer);

    const popupHtml = gerarPopupEquipe(infoEquipe);
    marker.bindPopup(popupHtml, {
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        maxWidth: 340
    });

    marker.bindTooltip(escaparHtml(infoEquipe.tipoServico || '-'), {
        permanent: true,
        direction: 'right',
        offset: [18, -2],
        className: 'marker-service-label',
        opacity: 1,
        interactive: false
    });

    const idEscalaStr = String(infoEquipe.idEscala);
    marker.on('popupopen', () => {
        popupFixadoEscalaId = idEscalaStr;
    });
    marker.on('popupclose', () => {
        if (atualizandoMapaTatico) return;
        if (popupFixadoEscalaId === idEscalaStr) popupFixadoEscalaId = null;
    });

    return marker;
}

function gerarPopupEquipe(info) {
    const marcadorAjustado = !!(
        info?.coords && info?.coordsReais &&
        (Number(info.coords.lat) !== Number(info.coordsReais.lat) || Number(info.coords.lng) !== Number(info.coordsReais.lng))
    );
    const localMapaInfo = (info.localMapa && info.localMapa !== info.localAtual)
        ? `
            <div class="popup-local" style="margin-top:6px; border-color:#ede9fe; background:#f5f3ff;">
                <small>Posição no Mapa</small>
                <strong>${escaparHtml(info.localMapa)}</strong>
                <span>Referência georreferenciada para visualização</span>
            </div>
        `
        : '';
    const sobreposicaoInfo = marcadorAjustado
        ? `
            <div class="popup-local" style="margin-top:6px; border-color:#e5e7eb; background:#f9fafb;">
                <small>Visualização</small>
                <strong>Marcador reposicionado</strong>
                <span>Ajuste visual para evitar sobreposição com outro recurso no mesmo ponto.</span>
            </div>
        `
        : '';

    return `
        <div class="popup-header">${escaparHtml(info.recursoExibicao)} • ${escaparHtml(info.tipoServico)}</div>
        <div class="popup-body">
            <div style="font-weight:700; color:#1f2937; margin-bottom:4px;">${escaparHtml(info.missao)}</div>
            <div style="color:#4b5563; font-size:0.8rem;">OS ${escaparHtml(String(info.osNumero))}</div>

            <div class="popup-grid">
                <div class="popup-item">
                    <small>Data Início</small>
                    <strong>${escaparHtml(info.dataAtivacao)}</strong>
                </div>
                <div class="popup-item">
                    <small>Hora Ativação</small>
                    <strong>${escaparHtml(info.horaAtivacao)}</strong>
                </div>
                <div class="popup-item">
                    <small>Hora Início</small>
                    <strong>${escaparHtml(info.horaInicioServico)}</strong>
                </div>
                <div class="popup-item">
                    <small>Hora Término</small>
                    <strong>${escaparHtml(info.horaFimServico)}</strong>
                </div>
                <div class="popup-item">
                    <small>Comandante</small>
                    <strong>${escaparHtml(info.comandanteNome)}</strong>
                </div>
                <div class="popup-item">
                    <small>Telefone</small>
                    <strong>${escaparHtml(info.comandanteTelefone)}</strong>
                </div>
            </div>

            <div class="popup-local">
                <small>Local Atual</small>
                <strong>${escaparHtml(info.localAtual)}</strong>
                <span>${escaparHtml(info.atividadeAtualNome)} • ${escaparHtml(info.horarioAtividadeAtual)}</span>
            </div>

            ${localMapaInfo}
            ${sobreposicaoInfo}
        </div>
    `;
}

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getCorHex(classe) {
    if (classe === 'pin-moto') return '#fd7e14';
    if (classe === 'pin-setor') return '#28a745';
    if (classe === 'pin-cabine') return '#6f42c1';
    return '#1a237e';
}
