let map;
let markersLayer;
let areasLayer;
let popupFixadoEscalaId = null;
let atualizandoMapaTatico = false;
let roteiroModalEscalaId = null;
let gatilhoModalRoteiro = null;
const equipesCardsExpandidos = new Set();
const moduloMonitoramento = window.OrdenaMapaTaticoMonitoramento;
const adaptadorGpsConfigurado = window.ORDENA_CICOCO_GPS_ADAPTER;
const servicoMonitoramentoGps = adaptadorGpsConfigurado
    && typeof adaptadorGpsConfigurado.validarDisponibilidade === 'function'
    && typeof adaptadorGpsConfigurado.consultarPosicoes === 'function'
    ? adaptadorGpsConfigurado
    // Adaptador indisponível anterior preservado: moduloMonitoramento.criarServicoIndisponivel();
    : moduloMonitoramento.criarServicoRecursos();
const controladorMonitoramento = moduloMonitoramento.criarControladorMonitoramento({
    servico: servicoMonitoramentoGps,
    onChange: atualizarControleMonitoramentoCard,
    onFeedback: ({ tipo, mensagem }) => mostrarFeedbackMonitoramento(tipo, mensagem)
});

document.addEventListener('DOMContentLoaded', () => {
    configurarModalRoteiro();
    iniciarMapa();
    atualizarMapaTatico();
    setInterval(atualizarMapaTatico, 5000);
});

window.addEventListener('pagehide', () => controladorMonitoramento.destruir());

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
    const escalas = JSON.parse(OrdenaStorage.getItem('escalasAtivas')) || [];
    const ordens = JSON.parse(OrdenaStorage.getItem('ordensServico')) || [];
    const viaturas = JSON.parse(OrdenaStorage.getItem('viaturas')) || [];

    const todosLocais = [
        ...(JSON.parse(OrdenaStorage.getItem('locaisCadastrados')) || []),
        ...(JSON.parse(OrdenaStorage.getItem('pontosPatrulhamento')) || []),
        ...(JSON.parse(OrdenaStorage.getItem('cabines')) || []),
        ...(JSON.parse(OrdenaStorage.getItem('setores')) || [])
    ];

    const viaturasPorPrefixo = new Map(
        viaturas
            .filter(v => v && v.prefixo)
            .map(v => [String(v.prefixo), v])
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
        outros: 0,
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

    atualizandoMapaTatico = true;
    if (areasLayer) areasLayer.clearLayers();
    markersLayer.clearLayers();

    escalas.forEach(escala => {
        const equipe = Array.isArray(escala.equipe) ? escala.equipe : [];
        const qtdEquipe = equipe.length > 0 ? equipe.length : 1;
        stats.efetivo += qtdEquipe;

        const tipoRecursoNormalizado = normalizarTipo(escala.tipoRecurso || 'Viatura');
        if (tipoRecursoNormalizado === 'moto') {
            const quantidadeMotos = obterIdsRecursosEscala(escala).length;
            stats.motos += quantidadeMotos > 0 ? quantidadeMotos : 1;
        } else if (tipoRecursoNormalizado === 'setor') stats.setores++;
        else if (tipoRecursoNormalizado === 'cabine') stats.cabines++;
        else if (tipoRecursoNormalizado === 'carro') stats.carros++;
        else stats.outros++;

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
            atividades,
            horaAtualMin,
            agoraMs: agora.getTime(),
            atividadeAtual,
            atividadeReferenciaMapa: referenciaMapa?.atividade || null,
            coords,
            coordsReais,
            viaturasPorPrefixo,
            todosLocais
        });

        equipesCards.push(infoEquipe);

        if (areaPatrulhamentoAtual) {
            adicionarAreaPatrulhamentoNoMapa(areaPatrulhamentoAtual, tipoRecursoNormalizado);
        }

        if (coords) {
            const marker = adicionarPinoNoMapa(infoEquipe, tipoRecursoNormalizado);
            markersByEscalaId.set(String(infoEquipe.idEscala), marker);
        }
    });

    atualizandoMapaTatico = false;

    renderizarPainelEquipesAtivas(equipesCards);
    atualizarKpis(stats);

    if (popupFixadoEscalaId && markersByEscalaId.has(String(popupFixadoEscalaId))) {
        markersByEscalaId.get(String(popupFixadoEscalaId)).openPopup();
    }
}

function montarInfoEquipeMapa({ escala, os, atividades, horaAtualMin, agoraMs, atividadeAtual, atividadeReferenciaMapa, coords, coordsReais, viaturasPorPrefixo, todosLocais }) {
    const comandante = (Array.isArray(escala.equipe) && escala.equipe[0]) ? escala.equipe[0] : {};

    const dataAtivacao = escala.dataAtivacao || formatarDataBr(escala.dataInicio);
    const horaAtivacao = escala.horaAtivacao || formatarHoraBr(escala.dataInicio);
    const horaInicioServico = escala.horaInicioServico || os?.inicioGeral || escala.osResumo?.inicioGeral || '-';
    const horaFimServico = escala.horaFimServico || os?.terminoGeral || escala.osResumo?.terminoGeral || '-';
    const tipoServico = escala.tipoServico || escala.osResumo?.tipoOrdem || '-';
    const localPrevistoNome = atividadeAtual?.local || 'Local não informado';
    const enderecoLocalPrevisto = montarEnderecoTexto(atividadeAtual) || 'Endereço não informado';
    const localAtual = obterTextoLocalAtual(atividadeAtual);
    const atividadeAtualNome = atividadeAtual?.tipo || 'Sem atividade no horário atual';
    const horarioAtividadeAtual = atividadeAtual ? `${atividadeAtual.inicio || '-'} às ${atividadeAtual.fim || '-'}` : '-';
    const localMapa = atividadeReferenciaMapa ? obterTextoLocalAtual(atividadeReferenciaMapa) : localAtual;
    const placasPorPrefixo = new Map(
        Array.from(viaturasPorPrefixo, ([prefixo, viatura]) => [prefixo, viatura.placa || ''])
    );
    const recursoExibicao = obterRecursoExibicao(escala, placasPorPrefixo);
    const recursoIds = obterIdsRecursosEscala(escala);
    const tipoRecursoNormalizado = normalizarTipo(escala.tipoRecurso || '');
    const recursoEhViatura = tipoRecursoNormalizado === 'carro' || tipoRecursoNormalizado === 'moto';
    const viaturasDaEscala = recursoEhViatura
        ? recursoIds.map(id => viaturasPorPrefixo.get(String(id))).filter(Boolean)
        : [];
    const identificadoresRadio = viaturasDaEscala.length === recursoIds.length
        && viaturasDaEscala.every(viatura => String(viatura.radio || '').trim())
        ? viaturasDaEscala.map(viatura => String(viatura.radio).trim())
        : [];
    const recursoDetalheRotulo = tipoRecursoNormalizado === 'carro' || tipoRecursoNormalizado === 'moto'
        ? (recursoIds.length > 1 ? 'Placas' : 'Placa')
        : 'Recurso';
    const temaLocalAtual = obterTemaLocalAtual(atividadeAtualNome);
    const atividadeCompacta = recursoEhViatura ? obterAtividadeCompacta(atividadeAtual) : '';
    const seloAtividadePrincipal = obterSeloAtividadePrincipal(atividadeAtual);
    const minutoAtualRoteiro = obterMinutoAtualRoteiro(
        escala,
        agoraMs,
        horaAtualMin,
        horaInicioServico,
        horaFimServico
    );
    const proximosPontosRoteiro = obterProximosPontosRoteiro(
        atividades,
        minutoAtualRoteiro,
        horaInicioServico,
        horaFimServico
    );
    const roteiroCompleto = obterRoteiroCompleto(atividades, horaInicioServico);
    const indiceAtividadeAtualRoteiro = obterIndiceAtividadeAtualRoteiro(
        roteiroCompleto,
        minutoAtualRoteiro,
        horaInicioServico
    );

    return {
        idEscala: escala.id,
        recursoId: recursoIds.join(', ') || '-',
        recursoIds,
        recursoExibicao,
        recursoDetalheRotulo,
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
        localPrevistoNome,
        enderecoLocalPrevisto,
        localAtual,
        localMapa,
        atividadeAtualNome,
        horarioAtividadeAtual,
        temaLocalAtual,
        atividadeCompacta,
        seloAtividadePrincipal,
        proximosPontosRoteiro,
        roteiroCompleto,
        indiceAtividadeAtualRoteiro,
        atividadeAtual,
        atividadeReferenciaMapa,
        coords,
        coordsReais: coordsReais || coords,
        monitoramentoDisponivel: recursoEhViatura,
        identificadoresRadio,
        alvoMonitoramento: montarAlvoMonitoramento(atividadeAtual, todosLocais)
    };
}

function renderizarPainelEquipesAtivas(equipesCards) {
    const container = document.getElementById('listaEquipesAtivas');
    if (!container) return;

    const equipesMonitoraveis = equipesCards.filter(info => info.monitoramentoDisponivel);
    equipesMonitoraveis.forEach(info => {
        controladorMonitoramento.registrarEquipe(info.idEscala, {
            identificadoresRadio: info.identificadoresRadio,
            alvo: info.alvoMonitoramento
        });
    });
    controladorMonitoramento.sincronizarEquipes(equipesMonitoraveis.map(info => info.idEscala));

    container.innerHTML = '';

    if (equipesCards.length === 0) {
        equipesCardsExpandidos.clear();
        container.innerHTML = '<div class="sidebar-empty">Nenhuma equipe ativa no momento.</div>';
        if (roteiroModalEscalaId !== null) fecharModalRoteiro();
        return;
    }

    const idsAtuais = new Set(equipesCards.map(info => String(info.idEscala)));
    Array.from(equipesCardsExpandidos).forEach(id => {
        if (!idsAtuais.has(String(id))) equipesCardsExpandidos.delete(String(id));
    });

    equipesCards
        .sort((a, b) => {
            const comparacaoServico = a.tipoServico.localeCompare(b.tipoServico, 'pt-BR');
            return comparacaoServico || a.recursoExibicao.localeCompare(b.recursoExibicao, 'pt-BR');
        })
        .forEach(info => {
            const card = document.createElement('div');
            const cardExpandido = equipesCardsExpandidos.has(String(info.idEscala));
            card.className = `equipe-card${cardExpandido ? ' is-expanded' : ' is-collapsed'}${info.monitoramentoDisponivel ? ' has-monitoramento' : ''}`;
            card.dataset.escalaId = String(info.idEscala);
            card.innerHTML = `
                <div class="equipe-card-topo">
                    <div>
                        <div class="equipe-card-titulo">${escaparHtml(info.tipoServico)}</div>
                        ${info.atividadeCompacta ? `
                            <div
                                class="equipe-atividade-compacta"
                                aria-label="Atividade atual: ${escaparHtml(info.atividadeCompacta)}"
                            >
                                <span>Agora:</span> <strong>${escaparHtml(info.atividadeCompacta)}</strong>
                            </div>
                        ` : ''}
                    </div>
                    <div class="equipe-card-topo-acoes">
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

                ${info.seloAtividadePrincipal || info.monitoramentoDisponivel ? `
                    <div class="equipe-card-operacao">
                        ${info.seloAtividadePrincipal ? `
                            <div
                                class="equipe-atividade-resumo"
                                role="group"
                                aria-label="Atividade atual: ${escaparHtml(info.seloAtividadePrincipal.texto)}. Horário previsto: ${escaparHtml(info.horarioAtividadeAtual)}"
                            >
                                <span class="equipe-atividade-selo ${escaparHtml(info.seloAtividadePrincipal.classe)}">
                                    <span class="equipe-atividade-inicial" aria-hidden="true">${escaparHtml(info.seloAtividadePrincipal.inicial)}</span>
                                    <span class="equipe-atividade-conteudo">
                                        <span class="equipe-atividade-texto">${escaparHtml(info.seloAtividadePrincipal.texto)}</span>
                                    </span>
                                </span>
                                <small class="equipe-atividade-horario">${escaparHtml(info.horarioAtividadeAtual)}</small>
                            </div>
                        ` : ''}
                        ${info.monitoramentoDisponivel ? gerarControleMonitoramento(info) : ''}
                    </div>
                ` : ''}

                <div class="equipe-card-detalhes">
                    <div class="equipe-card-grid">
                        <div class="equipe-item equipe-item-os">
                            <span>Ordem de Serviço</span>
                            <strong>OS ${escaparHtml(String(info.osNumero))} • ${escaparHtml(info.missao)}</strong>
                        </div>
                        <div class="equipe-item">
                            <span>${escaparHtml(info.recursoDetalheRotulo)}</span>
                            <strong>${escaparHtml(info.recursoExibicao)}</strong>
                        </div>
                        <div class="equipe-item">
                            <span>Data Início</span>
                            <strong>${escaparHtml(info.dataAtivacao)}</strong>
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
                        <span>Local Previsto na Ordem</span>
                        <strong>${escaparHtml(info.localPrevistoNome)}</strong>
                        <small>${escaparHtml(info.atividadeAtualNome)} • ${escaparHtml(info.enderecoLocalPrevisto)}</small>
                    </div>

                    <div class="equipe-card-acoes-detalhes">
                        <button
                            type="button"
                            class="btn-primary btn-roteiro-equipe"
                            data-escala-id="${escaparHtml(String(info.idEscala))}"
                            aria-haspopup="dialog"
                            aria-controls="modalRoteiroEquipe"
                            aria-label="Ver roteiro da OS ${escaparHtml(String(info.osNumero))} da equipe ${escaparHtml(info.tipoServico)}"
                        >
                            Roteiro
                        </button>
                    </div>
                </div>
            `;

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

            const controleMonitoramento = card.querySelector('.monitoramento-switch-input');
            if (controleMonitoramento) {
                controleMonitoramento.addEventListener('change', async (event) => {
                    await controladorMonitoramento.alternar(info.idEscala, event.currentTarget.checked);
                });
            }

            const btnRoteiro = card.querySelector('.btn-roteiro-equipe');
            if (btnRoteiro) {
                btnRoteiro.addEventListener('click', () => abrirModalRoteiro(info, btnRoteiro));
            }

            container.appendChild(card);
        });

    if (roteiroModalEscalaId !== null) {
        const infoRoteiroAberto = equipesCards.find(info => String(info.idEscala) === roteiroModalEscalaId);
        if (infoRoteiroAberto) preencherModalRoteiro(infoRoteiroAberto);
        else fecharModalRoteiro();
    }
}

function montarAlvoMonitoramento(atividade, listaLocais) {
    const tipo = String(atividade?.tipo || '').toLowerCase();

    if (tipo.includes('baseamento')) {
        return {
            tipo: 'baseamento',
            centro: obterCoordenadasAtividade(atividade, listaLocais),
            raioMetros: obterRaioAtividadeMetros(atividade, listaLocais)
        };
    }

    if (tipo.includes('patrulhamento')) {
        return {
            tipo: 'patrulhamento',
            poligono: obterPoligonoAtividade(atividade, listaLocais)
        };
    }

    return null;
}

function controleMonitoramentoEstaLigado(estado) {
    if (!estado) return false;
    if (estado.acaoPendente === 'ativar') return true;
    if (estado.acaoPendente === 'desativar') return false;
    return estado.ativo;
}

function gerarControleMonitoramento(info) {
    const estado = controladorMonitoramento.obterEstado(info.idEscala);
    const apresentacao = moduloMonitoramento.obterApresentacaoEstado(estado?.estado);
    const ligado = controleMonitoramentoEstaLigado(estado);
    const carregando = !!(estado?.processando || estado?.emConsulta);
    const desabilitado = carregando;
    const descricaoRecurso = info.recursoId && info.recursoId !== '-'
        ? ` da viatura ${info.recursoId}`
        : '';

    return `
        <div class="equipe-monitoramento" role="group" aria-label="Supervisão automática${escaparHtml(descricaoRecurso)}">
            <span class="status-pill monitoramento-status ${apresentacao.classe}" role="status" aria-live="polite">
                ${apresentacao.texto}
            </span>
            <span class="monitoramento-acoes">
                <span class="monitoramento-loading" role="status" aria-label="Consultando posição GPS" ${carregando ? '' : 'hidden'}>
                    <span class="growing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
                </span>
                <label class="monitoramento-switch" title="Supervisão automática${escaparHtml(descricaoRecurso)}">
                    <input
                        type="checkbox"
                        role="switch"
                        class="monitoramento-switch-input"
                        data-escala-id="${escaparHtml(String(info.idEscala))}"
                        aria-label="${ligado ? 'Desligar' : 'Ligar'} supervisão automática${escaparHtml(descricaoRecurso)}"
                        aria-busy="${carregando ? 'true' : 'false'}"
                        ${ligado ? 'checked' : ''}
                        ${desabilitado ? 'disabled' : ''}
                    >
                    <span class="monitoramento-switch-trilho" aria-hidden="true"></span>
                </label>
            </span>
        </div>
    `;
}

function atualizarControleMonitoramentoCard(estado) {
    if (!estado) return;
    const container = document.getElementById('listaEquipesAtivas');
    if (!container) return;

    const card = Array.from(container.querySelectorAll('.equipe-card'))
        .find(elemento => elemento.dataset.escalaId === String(estado.idEscala));
    if (!card) return;

    const apresentacao = moduloMonitoramento.obterApresentacaoEstado(estado.estado);
    const status = card.querySelector('.monitoramento-status');
    const controle = card.querySelector('.monitoramento-switch-input');
    const loading = card.querySelector('.monitoramento-loading');
    const ligado = controleMonitoramentoEstaLigado(estado);
    const carregando = !!(estado.processando || estado.emConsulta);

    if (status) {
        status.textContent = apresentacao.texto;
        status.className = `status-pill monitoramento-status ${apresentacao.classe}`;
    }

    if (controle) {
        const ariaAtual = controle.getAttribute('aria-label') || 'supervisão automática';
        const descricao = ariaAtual.replace(/^(Ligar|Desligar)\s+/i, '');
        controle.checked = ligado;
        controle.disabled = carregando;
        controle.setAttribute('aria-label', `${ligado ? 'Desligar' : 'Ligar'} ${descricao}`);
        controle.setAttribute('aria-busy', carregando ? 'true' : 'false');
    }

    if (loading) loading.hidden = !carregando;
}

function mostrarFeedbackMonitoramento(tipo, mensagem) {
    const elemento = document.getElementById('feedbackMonitoramento');
    if (!elemento) return;

    if (tipo === 'clear') {
        elemento.textContent = '';
        elemento.className = 'monitoramento-feedback';
        elemento.removeAttribute('role');
        return;
    }

    if (!mensagem) return;

    const tipoVisual = tipo === 'success' ? 'success' : 'error';
    elemento.textContent = mensagem;
    elemento.className = `monitoramento-feedback is-visible ${tipoVisual}`;
    elemento.setAttribute('role', tipoVisual === 'error' ? 'alert' : 'status');
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

function obterOperacaoAtividadeRoteiro(atividade) {
    const operacaoDireta = String(atividade?.operacao || '').trim();
    if (operacaoDireta && operacaoDireta !== '-' && operacaoDireta !== '—') {
        return operacaoDireta;
    }

    const detalhes = String(atividade?.detalhes || atividade?.detalhe || '');
    const correspondencia = detalhes.match(/\[OP:\s*([^\]]+)\]/i);
    return correspondencia ? correspondencia[1].trim().toUpperCase() : '';
}

function gerarLinhasTabelaRoteiro(atividadesRoteiro, indiceAtividadeAtual = -1) {
    if (!Array.isArray(atividadesRoteiro) || atividadesRoteiro.length === 0) {
        return `
            <tr class="roteiro-mensagem-row">
                <td colspan="4">Nenhuma atividade prevista nesta Ordem de Serviço.</td>
            </tr>
        `;
    }

    return atividadesRoteiro.map((atividade, indice) => {
        const horario = `${atividade.inicio || '-'} às ${atividade.fim || '-'}`;
        const endereco = montarEnderecoTexto(atividade);
        const local = [atividade.local, atividade.ponto, atividade.apelido]
            .map(valor => String(valor || '').trim())
            .find(valor => valor && valor !== '-' && valor !== '—')
            || '-';
        const enderecoExibicao = endereco && endereco !== local
            ? endereco
            : '';
        const operacao = obterOperacaoAtividadeRoteiro(atividade);
        const atividadeAtual = indice === indiceAtividadeAtual;

        return `
            <tr class="${atividadeAtual ? 'roteiro-atividade-atual' : ''}"${atividadeAtual ? ' aria-current="step"' : ''}>
                <td data-label="Horário" class="roteiro-horario">${escaparHtml(horario)}</td>
                <td data-label="Atividade" class="roteiro-atividade">
                    <span>${escaparHtml(atividade.tipo || '-')}</span>
                    ${atividadeAtual ? '<span class="roteiro-agora">Agora</span>' : ''}
                </td>
                <td data-label="Local / Endereço" class="roteiro-local">
                    <strong>${escaparHtml(local)}</strong>
                    ${enderecoExibicao ? `<small>${escaparHtml(enderecoExibicao)}</small>` : ''}
                </td>
                <td data-label="Operação" class="roteiro-operacao">
                    ${operacao
                        ? `<span class="roteiro-operacao-badge">OP: ${escaparHtml(operacao)}</span>`
                        : '<span class="roteiro-sem-operacao">-</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

function preencherModalRoteiro(info) {
    const titulo = document.getElementById('tituloModalRoteiro');
    const descricao = document.getElementById('descricaoModalRoteiro');
    const corpoTabela = document.getElementById('tabelaRoteiroEquipe');
    if (!info || !titulo || !descricao || !corpoTabela) return;

    titulo.textContent = `Roteiro da OS ${info.osNumero || '-'}`;
    descricao.textContent = `${info.tipoServico || 'Equipe'} • ${info.missao || 'Missão não informada'}`;
    const linhasRoteiro = gerarLinhasTabelaRoteiro(
        info.roteiroCompleto,
        info.indiceAtividadeAtualRoteiro
    );
    if (corpoTabela.ordenaRoteiroHtml !== linhasRoteiro) {
        corpoTabela.innerHTML = linhasRoteiro;
        corpoTabela.ordenaRoteiroHtml = linhasRoteiro;
    }
}

function alternarFundoModalRoteiro(inativo) {
    document.querySelectorAll('nav, #sidebar, #overlay, .kpi-bar, .operational-layout').forEach(elemento => {
        if (inativo && !elemento.hasAttribute('inert')) {
            elemento.setAttribute('inert', '');
            elemento.dataset.inertModalRoteiro = 'true';
        } else if (!inativo && elemento.dataset.inertModalRoteiro === 'true') {
            elemento.removeAttribute('inert');
            delete elemento.dataset.inertModalRoteiro;
        }
    });
}

function abrirModalRoteiro(info, gatilho) {
    const modal = document.getElementById('modalRoteiroEquipe');
    if (!modal || !info) return;

    roteiroModalEscalaId = String(info.idEscala);
    gatilhoModalRoteiro = gatilho || null;
    preencherModalRoteiro(info);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-roteiro-aberto');
    alternarFundoModalRoteiro(true);

    window.requestAnimationFrame(() => {
        document.getElementById('btnFecharModalRoteiro')?.focus();
    });
}

function fecharModalRoteiro() {
    const modal = document.getElementById('modalRoteiroEquipe');
    if (!modal || modal.hidden) {
        roteiroModalEscalaId = null;
        gatilhoModalRoteiro = null;
        return;
    }

    const escalaIdAnterior = roteiroModalEscalaId;
    const gatilhoAnterior = gatilhoModalRoteiro;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-roteiro-aberto');
    alternarFundoModalRoteiro(false);
    roteiroModalEscalaId = null;
    gatilhoModalRoteiro = null;

    window.requestAnimationFrame(() => {
        const gatilhoAtual = gatilhoAnterior?.isConnected
            ? gatilhoAnterior
            : Array.from(document.querySelectorAll('.btn-roteiro-equipe'))
                .find(botao => botao.dataset.escalaId === String(escalaIdAnterior));
        const focoRetorno = gatilhoAtual
            || document.querySelector('.btn-expandir-card-equipe')
            || document.querySelector('.menu-toggle');
        focoRetorno?.focus();
    });
}

function manterFocoModalRoteiro(event, modal) {
    const elementosFocaveis = Array.from(modal.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(elemento => !elemento.hidden);
    if (elementosFocaveis.length === 0) {
        event.preventDefault();
        return;
    }

    const primeiro = elementosFocaveis[0];
    const ultimo = elementosFocaveis[elementosFocaveis.length - 1];
    if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
    }
}

function configurarModalRoteiro() {
    const modal = document.getElementById('modalRoteiroEquipe');
    const btnFechar = document.getElementById('btnFecharModalRoteiro');
    if (!modal || !btnFechar) return;

    btnFechar.addEventListener('click', fecharModalRoteiro);
    modal.addEventListener('click', event => {
        if (event.target === modal) fecharModalRoteiro();
    });
    document.addEventListener('keydown', event => {
        if (modal.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            fecharModalRoteiro();
        } else if (event.key === 'Tab') {
            manterFocoModalRoteiro(event, modal);
        }
    });
}

function atualizarKpis(stats) {
    document.getElementById('kpiEfetivo').innerText = stats.efetivo;
    document.getElementById('kpiCarros').innerText = stats.carros;
    document.getElementById('kpiMotos').innerText = stats.motos;
    document.getElementById('kpiSetores').innerText = stats.setores;
    document.getElementById('kpiCabines').innerText = stats.cabines;
    document.getElementById('kpiOutros').innerText = stats.outros;

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
    if (tipo.includes('patrulhamento')) return 'green';
    if (tipo.includes('baseamento')) return 'purple';
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

function obterSeloAtividadePrincipal(atividade) {
    const tipo = String(atividade?.tipo || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');

    if (tipo.includes('patrulhamento')) {
        return { texto: 'Patrulhamento', inicial: 'P', classe: 'is-patrulhamento' };
    }
    if (tipo.includes('baseamento')) {
        return { texto: 'Baseamento', inicial: 'B', classe: 'is-baseamento' };
    }
    return null;
}

function obterAtividadeCompacta(atividade) {
    const textoConfigurado = String(atividade?.tipo || '').trim();
    if (!textoConfigurado) return '';

    const tipo = textoConfigurado
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
    const deveExibir = tipo.includes('prelecao')
        || tipo.includes('deslocamento')
        || tipo.includes('intervalo')
        || tipo.includes('retorno');

    return deveExibir ? textoConfigurado : '';
}

function obterAtividadeAtual(atividades, horaAtualMin) {
    if (!Array.isArray(atividades) || !Number.isFinite(horaAtualMin)) return null;

    return atividades.find(atividade => horarioContemMomento(atividade.inicio, atividade.fim, horaAtualMin)) || null;
}

function obterIndiceAtividadeAtual(atividades, horaAtualMin) {
    if (!Array.isArray(atividades) || !Number.isFinite(horaAtualMin)) return -1;
    return atividades.findIndex(atividade => horarioContemMomento(atividade.inicio, atividade.fim, horaAtualMin));
}

function obterMinutoAtualRoteiro(escala, agoraMs, horaAtualMin, horaInicioTurno, horaFimTurno) {
    const inicioTurnoMin = horaParaMinutos(horaInicioTurno);
    const fimTurnoMin = horaParaMinutos(horaFimTurno);
    let duracaoTurnoMin = NaN;

    if (Number.isFinite(inicioTurnoMin) && Number.isFinite(fimTurnoMin)) {
        duracaoTurnoMin = fimTurnoMin - inicioTurnoMin;
        if (duracaoTurnoMin <= 0) duracaoTurnoMin += 1440;
    }
    if (!Number.isFinite(duracaoTurnoMin) || duracaoTurnoMin <= 0) {
        duracaoTurnoMin = Number(escala?.duracaoServicoMinutos);
    }

    const fimPrevistoMs = Date.parse(escala?.dataFimPrevista || '');
    if (Number.isFinite(agoraMs)
        && Number.isFinite(fimPrevistoMs)
        && Number.isFinite(inicioTurnoMin)
        && Number.isFinite(duracaoTurnoMin)
        && duracaoTurnoMin > 0) {
        const inicioPrevistoMs = fimPrevistoMs - (duracaoTurnoMin * 60000);
        const minutosDesdeInicio = Math.floor((agoraMs - inicioPrevistoMs) / 60000);
        return inicioTurnoMin + minutosDesdeInicio;
    }

    return horaAtualMin;
}

function obterRoteiroCompleto(atividades, horaInicioTurno) {
    if (!Array.isArray(atividades)) return [];

    const inicioTurnoMin = horaParaMinutos(horaInicioTurno);

    return atividades
        .map((atividade, indiceOriginal) => {
            if (!atividade || typeof atividade !== 'object') return null;

            const inicioAtividadeMin = horaParaMinutos(atividade.inicio);
            let inicioOrdenacao = Number.isFinite(inicioAtividadeMin)
                ? inicioAtividadeMin
                : Number.POSITIVE_INFINITY;

            if (Number.isFinite(inicioTurnoMin)
                && Number.isFinite(inicioAtividadeMin)
                && inicioAtividadeMin < inicioTurnoMin) {
                inicioOrdenacao += 1440;
            }

            return { atividade, indiceOriginal, inicioOrdenacao };
        })
        .filter(Boolean)
        .sort((a, b) => a.inicioOrdenacao - b.inicioOrdenacao || a.indiceOriginal - b.indiceOriginal)
        .map(item => item.atividade);
}

function obterIndiceAtividadeAtualRoteiro(roteiroCompleto, minutoAtualRoteiro, horaInicioTurno) {
    if (!Array.isArray(roteiroCompleto) || !Number.isFinite(minutoAtualRoteiro)) return -1;

    const inicioTurnoMin = horaParaMinutos(horaInicioTurno);
    const minutoRelogio = ((minutoAtualRoteiro % 1440) + 1440) % 1440;
    const possuiReferenciaAbsoluta = minutoAtualRoteiro < 0 || minutoAtualRoteiro >= 1440;
    const minutoAtualOrdenacao = !possuiReferenciaAbsoluta
        && Number.isFinite(inicioTurnoMin)
        && minutoRelogio < inicioTurnoMin
        ? minutoRelogio + 1440
        : minutoAtualRoteiro;

    return roteiroCompleto.findIndex(atividade => {
        const inicioAtividadeMin = horaParaMinutos(atividade?.inicio);
        const fimAtividadeMin = horaParaMinutos(atividade?.fim);
        if (!Number.isFinite(inicioAtividadeMin) || !Number.isFinite(fimAtividadeMin)) return false;

        let inicioOrdenacao = inicioAtividadeMin;
        if (Number.isFinite(inicioTurnoMin) && inicioAtividadeMin < inicioTurnoMin) {
            inicioOrdenacao += 1440;
        }

        let duracaoAtividadeMin = fimAtividadeMin - inicioAtividadeMin;
        if (duracaoAtividadeMin < 0) duracaoAtividadeMin += 1440;
        const fimOrdenacao = inicioOrdenacao + duracaoAtividadeMin;

        // Intervalo semiaberto: na transição exata, a nova atividade recebe o destaque.
        return minutoAtualOrdenacao >= inicioOrdenacao && minutoAtualOrdenacao < fimOrdenacao;
    });
}

function obterProximosPontosRoteiro(atividades, horaAtualMin, horaInicioTurno, horaFimTurno) {
    if (!Array.isArray(atividades) || !Number.isFinite(horaAtualMin)) return [];

    const inicioTurnoMin = horaParaMinutos(horaInicioTurno);
    const fimTurnoMin = horaParaMinutos(horaFimTurno);
    const horaAtualRelogio = ((horaAtualMin % 1440) + 1440) % 1440;
    const possuiReferenciaAbsoluta = horaAtualMin < 0 || horaAtualMin >= 1440;
    const turnoAtravessaMeiaNoite = Number.isFinite(inicioTurnoMin)
        && Number.isFinite(fimTurnoMin)
        && fimTurnoMin < inicioTurnoMin;
    const horaAtualOrdenacao = !possuiReferenciaAbsoluta
        && turnoAtravessaMeiaNoite
        && horaAtualRelogio <= fimTurnoMin
        ? horaAtualRelogio + 1440
        : horaAtualMin;
    const atividadesOrdenadas = atividades
        .map((atividade, indiceOriginal) => {
            if (!atividade) return null;

            const inicioAtividadeMin = horaParaMinutos(atividade.inicio);
            const fimAtividadeMin = horaParaMinutos(atividade.fim);
            if (!Number.isFinite(inicioAtividadeMin)) return null;

            let inicioOrdenacao = inicioAtividadeMin;
            if (Number.isFinite(inicioTurnoMin) && inicioAtividadeMin < inicioTurnoMin) {
                inicioOrdenacao = inicioAtividadeMin + 1440;
            }

            let fimOrdenacao = NaN;
            if (Number.isFinite(fimAtividadeMin)) {
                let duracaoAtividadeMin = fimAtividadeMin - inicioAtividadeMin;
                if (duracaoAtividadeMin < 0) duracaoAtividadeMin += 1440;
                fimOrdenacao = inicioOrdenacao + duracaoAtividadeMin;
            }

            const textosLocal = [atividade.local, atividade.ponto, atividade.apelido]
                .map(valor => String(valor || '').trim())
                .filter(valor => valor && valor !== '-' && valor !== '—');
            const enderecoLegado = atividade.endereco;
            const enderecoObjeto = enderecoLegado && typeof enderecoLegado === 'object'
                ? enderecoLegado
                : {};
            const possuiEndereco = [
                atividade.rua,
                atividade.logradouro,
                typeof enderecoLegado === 'string' ? enderecoLegado : '',
                enderecoObjeto.rua,
                enderecoObjeto.logradouro
            ].some(valor => {
                const texto = String(valor || '').trim();
                return texto && texto !== '-' && texto !== '—';
            });
            const latGps = atividade?.gps?.lat;
            const lngGps = atividade?.gps?.lng;
            const possuiGps = latGps != null && lngGps != null
                && String(latGps).trim() !== '' && String(lngGps).trim() !== ''
                && Number.isFinite(Number(latGps)) && Number.isFinite(Number(lngGps));
            const possuiPoligono = Array.isArray(atividade?.gps?.poligono)
                && atividade.gps.poligono.length >= 3;

            return {
                atividade,
                indiceOriginal,
                inicioOrdenacao,
                fimOrdenacao,
                possuiPonto: textosLocal.length > 0 || possuiEndereco || possuiGps || possuiPoligono
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.inicioOrdenacao - b.inicioOrdenacao || a.indiceOriginal - b.indiceOriginal);
    const indiceAtual = atividadesOrdenadas.findIndex(item =>
        Number.isFinite(item.fimOrdenacao)
        && horaAtualOrdenacao >= item.inicioOrdenacao
        && horaAtualOrdenacao <= item.fimOrdenacao
    );

    return atividadesOrdenadas
        .filter((item, indiceOrdenado) => item.possuiPonto
            && (indiceAtual >= 0
                ? indiceOrdenado > indiceAtual && item.inicioOrdenacao >= horaAtualOrdenacao
                : item.inicioOrdenacao > horaAtualOrdenacao))
        .map(item => item.atividade);
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

function normalizarCoordenadasMapa(valor) {
    if (!valor || typeof valor !== 'object' || valor.lat == null || valor.lng == null) return null;
    if (String(valor.lat).trim() === '' || String(valor.lng).trim() === '') return null;

    const lat = Number(valor.lat);
    const lng = Number(valor.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }

    return { lat, lng };
}

function obterCoordenadasAtividade(atividade, listaLocais) {
    if (!atividade) return null;

    const coordenadasGps = normalizarCoordenadasMapa(atividade.gps);
    if (coordenadasGps) return coordenadasGps;

    if (atividade.local) {
        return encontrarCoordenadas(atividade.local, listaLocais);
    }

    return null;
}

function normalizarPoligonoPatrulhamento(poligono) {
    if (!Array.isArray(poligono) || poligono.length < 3) return null;

    const pontos = [];
    const coordenadaVazia = valor => valor == null || (typeof valor === 'string' && !valor.trim());
    for (const ponto of poligono) {
        const latBruta = Array.isArray(ponto) ? ponto[0] : ponto?.lat;
        const lngBruta = Array.isArray(ponto) ? ponto[1] : ponto?.lng;
        if (coordenadaVazia(latBruta) || coordenadaVazia(lngBruta)) return null;

        const lat = Number(latBruta);
        const lng = Number(lngBruta);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return null;
        }
        pontos.push({ lat, lng });
    }

    const primeiro = pontos[0];
    const ultimo = pontos[pontos.length - 1];
    if (pontos.length > 3 && primeiro.lat === ultimo.lat && primeiro.lng === ultimo.lng) {
        pontos.pop();
    }

    const pontosDistintos = new Set(pontos.map(ponto => `${ponto.lat}|${ponto.lng}`));
    return pontosDistintos.size >= 3 ? pontos : null;
}

function obterPoligonoAtividade(atividade, listaLocais) {
    if (!atividade) return null;

    const poligonoGps = normalizarPoligonoPatrulhamento(atividade?.gps?.poligono);
    if (poligonoGps) return poligonoGps;

    if (atividade.local) {
        const local = encontrarLocalNoCadastro(atividade.local, listaLocais);
        const poligonoLocal = normalizarPoligonoPatrulhamento(local?.poligono);
        if (poligonoLocal) return poligonoLocal;
    }

    return null;
}

function obterAreaPatrulhamentoAtual(atividade, listaLocais) {
    if (!atividade) return null;
    const tipo = (atividade.tipo || '').toLowerCase();
    if (!tipo.includes('patrulhamento')) return null;

    const coords = obterCoordenadasAtividade(atividade, listaLocais);
    const poligono = obterPoligonoAtividade(atividade, listaLocais);
    if (poligono) return { coords, poligono };

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
    if (!areasLayer || !area) return;

    let corClasse = 'pin-viatura';
    if (tipoRecursoNormalizado === 'moto') corClasse = 'pin-moto';
    if (tipoRecursoNormalizado === 'setor') corClasse = 'pin-setor';
    if (tipoRecursoNormalizado === 'cabine') corClasse = 'pin-cabine';
    const cor = getCorHex(corClasse);

    const estiloArea = {
        color: cor,
        weight: 2,
        opacity: 0.75,
        fillColor: cor,
        fillOpacity: 0.14,
        interactive: false
    };

    const poligono = normalizarPoligonoPatrulhamento(area.poligono);
    if (poligono) {
        L.polygon(poligono.map(ponto => [ponto.lat, ponto.lng]), estiloArea).addTo(areasLayer);
        return;
    }

    if (!area.coords) return;
    const lat = Number(area.coords.lat);
    const lng = Number(area.coords.lng);
    const raio = Number(area.raio);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(raio) || raio <= 0) return;

    L.circle([lat, lng], { ...estiloArea, radius: raio }).addTo(areasLayer);
}

function normalizarTipo(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t.includes('moto')) return 'moto';
    if (t.includes('setor') || t.includes('a pé') || t.includes('a pe')) return 'setor';
    if (t.includes('cabine')) return 'cabine';
    if (t.includes('viatura') || t.includes('carro')) return 'carro';
    return 'outros';
}

function obterIdsRecursosEscala(escala) {
    const idsNovos = Array.isArray(escala?.recursoIds)
        ? escala.recursoIds
            .map(id => String(id ?? '').trim())
            .filter(Boolean)
        : [];

    if (idsNovos.length > 0) return [...new Set(idsNovos)];

    const idLegado = String(escala?.recursoId ?? '').trim();
    return idLegado ? [idLegado] : [];
}

function obterRecursoExibicao(escala, placasPorPrefixo) {
    const tipo = (escala.tipoRecurso || '').toLowerCase();
    const recursoIds = obterIdsRecursosEscala(escala);

    if (recursoIds.length === 0) return '-';
    if (tipo.includes('cabine') || tipo.includes('setor')) return recursoIds.join(', ');

    return recursoIds
        .map(recursoId => placasPorPrefixo.get(recursoId) || recursoId)
        .join(', ');
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

    const textoValido = valor => {
        const texto = String(valor ?? '').trim();
        return texto && texto !== '-' && texto !== '—' ? texto : '';
    };
    const enderecoLegado = atividade.endereco;
    const enderecoObjeto = enderecoLegado && typeof enderecoLegado === 'object'
        ? enderecoLegado
        : {};
    const enderecoTexto = typeof enderecoLegado === 'string'
        ? textoValido(enderecoLegado)
        : '';
    const rua = textoValido(
        atividade.rua
        || atividade.logradouro
        || enderecoObjeto.rua
        || enderecoObjeto.logradouro
    );
    const numero = textoValido(atividade.numero || enderecoObjeto.numero);
    const bairro = textoValido(atividade.bairro || enderecoObjeto.bairro);
    const cidade = textoValido(
        atividade.cidade
        || atividade.municipio
        || enderecoObjeto.cidade
        || enderecoObjeto.municipio
    );

    if (!rua && enderecoTexto) return enderecoTexto;

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
    return normalizarCoordenadasMapa(match);
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
