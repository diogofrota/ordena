const parametrosPontosOperacao = new URLSearchParams(window.location.search);
const idOperacaoPontos = parametrosPontosOperacao.get('id');
const nomeOperacaoPontos = normalizarNomeOperacaoPontos(parametrosPontosOperacao.get('nome'));
const filtroRetornoOperacoes = parametrosPontosOperacao.get('filtro') === 'Inativa' ? 'Inativa' : 'Ativa';
let pontosVinculadosRenderizados = [];
let mapaPontoOperacao = null;
let elementoRetornoMapaPonto = null;
let botaoMapaPontoCarregando = null;
let textoOriginalBotaoMapaPonto = '';
let temporizadorMapaPonto = null;
let sequenciaMapaPonto = 0;

document.addEventListener('DOMContentLoaded', () => {
    configurarEventosMapaPontoOperacao();

    document.getElementById('btnVoltarOperacoes')?.addEventListener('click', () => {
        window.location.href = `operacoes_especiais.html?filtro=${encodeURIComponent(filtroRetornoOperacoes)}`;
    });

    document.getElementById('btnCadastrarOperacao')?.addEventListener('click', () => {
        window.location.href = 'cadastro_operacao_especial.html';
    });

    document.getElementById('btnVerOperacoesInativas')?.addEventListener('click', () => {
        window.location.href = 'operacoes_especiais.html?filtro=Inativa';
    });

    document.getElementById('btnImprimirTodasOSOperacao')?.addEventListener('click', (evento) => {
        imprimirTodasOSOperacao(evento.currentTarget);
    });

    if (document.getElementById('listaPontosOperacao')) renderizarPontosOperacao();
});

window.addEventListener('storage', (event) => {
    if ((event.key === 'cadastrosOperacoes' || event.key === 'ordensServico')
        && document.getElementById('listaPontosOperacao')
        && !document.getElementById('secaoPontosOperacaoDetalhes')) {
        renderizarPontosOperacao();
    }
});

function normalizarNomeOperacaoPontos(valor) {
    return typeof valor === 'string' ? valor.trim().toUpperCase() : '';
}

function normalizarTextoComparacao(valor) {
    return String(valor ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

function escaparHtmlPontos(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function lerArrayStoragePontos(chave) {
    const valor = OrdenaStorage.getItem(chave);
    if (valor == null) return [];

    const dados = JSON.parse(valor);
    if (!Array.isArray(dados)) {
        throw new Error(`Os dados de ${chave} estão em um formato inválido.`);
    }
    return dados;
}

function mostrarFeedbackPontos(tipo, mensagem) {
    const elemento = document.getElementById('pontosOperacaoFeedback');
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.className = `pontos-feedback is-visible ${tipo}`;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparFeedbackPontos() {
    const elemento = document.getElementById('pontosOperacaoFeedback');
    if (!elemento) return;

    elemento.textContent = '';
    elemento.className = 'pontos-feedback';
    elemento.removeAttribute('role');
}

function resolverOperacaoPontos(operacoes) {
    if (idOperacaoPontos) {
        const operacaoPorId = operacoes.find((operacao) =>
            String(operacao?.id ?? '') === idOperacaoPontos
        );
        if (operacaoPorId) return operacaoPorId;
    }

    if (!nomeOperacaoPontos) return null;
    return operacoes.find((operacao) =>
        normalizarNomeOperacaoPontos(operacao?.nome) === nomeOperacaoPontos
    ) || null;
}

function obterTextoPreenchido(valor) {
    const texto = typeof valor === 'string' || typeof valor === 'number'
        ? String(valor).trim()
        : '';
    return texto && texto !== '-' ? texto : '';
}

function primeiroTextoPontos(...valores) {
    for (const valor of valores) {
        const texto = obterTextoPreenchido(valor);
        if (texto) return texto;
    }
    return '';
}

function extrairNomeOperacaoAtividade(atividade) {
    const nomeDireto = normalizarNomeOperacaoPontos(atividade?.operacao);
    if (nomeDireto) return nomeDireto;

    const detalheLegado = primeiroTextoPontos(atividade?.detalhes, atividade?.detalhe);
    const correspondencia = detalheLegado.match(/\[OP:\s*([^\]]+)\]/i);
    return correspondencia ? normalizarNomeOperacaoPontos(correspondencia[1]) : '';
}

function formatarEnderecoPonto(atividade) {
    const enderecoObjeto = atividade?.endereco && typeof atividade.endereco === 'object'
        ? atividade.endereco
        : {};
    const enderecoLegado = typeof atividade?.endereco === 'string' ? atividade.endereco : '';
    const rua = primeiroTextoPontos(
        atividade?.rua,
        atividade?.logradouro,
        atividade?.nomeRua,
        enderecoObjeto.rua,
        enderecoObjeto.logradouro,
        enderecoLegado
    );
    const numero = primeiroTextoPontos(atividade?.numero, enderecoObjeto.numero);
    const bairro = primeiroTextoPontos(atividade?.bairro, enderecoObjeto.bairro);
    const cidade = primeiroTextoPontos(
        atividade?.cidade,
        atividade?.municipio,
        enderecoObjeto.cidade,
        enderecoObjeto.municipio
    );

    const logradouro = rua ? `${rua}${numero ? `, ${numero}` : ''}` : '';
    return [logradouro, bairro, cidade].filter(Boolean).join(' - ') || 'Não informado';
}

function formatarHorarioPonto(atividade) {
    const inicio = primeiroTextoPontos(atividade?.inicio);
    const fim = primeiroTextoPontos(atividade?.fim);
    if (inicio && fim) return `${inicio} – ${fim}`;
    return inicio || fim || 'Não informado';
}

function definirBotaoAcaoPontoProcessando(botao, processando, textoProcessando = 'Preparando...') {
    if (!botao) return;

    if (processando) {
        botao.dataset.textoOriginal = botao.textContent;
        botao.dataset.desabilitadoOriginal = String(botao.disabled);
        botao.disabled = true;
        botao.setAttribute('aria-busy', 'true');
        botao.textContent = textoProcessando;
        return;
    }

    botao.disabled = botao.dataset.desabilitadoOriginal === 'true';
    botao.removeAttribute('aria-busy');
    if (botao.dataset.textoOriginal) {
        botao.textContent = botao.dataset.textoOriginal;
        delete botao.dataset.textoOriginal;
    }
    delete botao.dataset.desabilitadoOriginal;
}

function normalizarAtividadeImpressaoPonto(atividade) {
    const tipo = primeiroTextoPontos(atividade?.tipo);
    const tipoNormalizado = normalizarTextoComparacao(tipo);
    let icone = '📝';
    if (tipoNormalizado.includes('patrulhamento')) icone = '🚔';
    else if (tipoNormalizado.includes('baseamento')) icone = '🛡️';
    else if (tipoNormalizado.includes('deslocamento')) icone = '🚚';
    else if (tipoNormalizado.includes('intervalo')) icone = '🍽️';
    else if (tipoNormalizado.includes('prelecao')) icone = '🎯';
    else if (tipoNormalizado.includes('retorno')) icone = '↩️';

    const rua = primeiroTextoPontos(atividade?.rua);
    const numero = primeiroTextoPontos(atividade?.numero);
    const enderecoAlternativo = primeiroTextoPontos(
        atividade?.logradouro,
        typeof atividade?.endereco === 'string' ? atividade.endereco : ''
    );
    const logradouro = rua
        ? `${rua}${numero ? `, ${numero}` : ''}`
        : (enderecoAlternativo || '-');
    const gps = atividade?.gps && typeof atividade.gps === 'object'
        ? { ...atividade.gps }
        : null;
    if (gps && atividade?.raio && !gps.raio) gps.raio = atividade.raio;

    const operacao = normalizarNomeOperacaoPontos(atividade?.operacao);
    const detalhes = primeiroTextoPontos(atividade?.detalhes, atividade?.detalhe);
    const detalheFinal = operacao
        ? `[OP: ${operacao}] ${detalhes}`.trim()
        : (detalhes || '-');

    return {
        tipo: tipo || 'Não informado',
        icone,
        inicio: primeiroTextoPontos(atividade?.inicio) || '-',
        fim: primeiroTextoPontos(atividade?.fim) || '-',
        local: primeiroTextoPontos(atividade?.local, atividade?.ponto, atividade?.apelido) || '-',
        operacao,
        logradouro,
        bairro: primeiroTextoPontos(atividade?.bairro) || '-',
        cidade: primeiroTextoPontos(atividade?.cidade, atividade?.municipio) || '-',
        detalhe: detalheFinal,
        gps
    };
}

function prepararDadosImpressaoOSPonto(os) {
    return {
        numero: os?.numero,
        nomeOS: os?.nomeOS,
        inicioGeral: os?.inicioGeral,
        terminoGeral: os?.terminoGeral,
        dataInicio: os?.dataInicio || '',
        dataTermino: os?.dataTermino || '',
        prescricoes: typeof os?.prescricoes === 'string' ? os.prescricoes : '',
        status: os?.status || 'Ativa',
        criadoPor: os?.criadoPor || '',
        atividades: (Array.isArray(os?.atividades) ? os.atividades : [])
            .map(normalizarAtividadeImpressaoPonto)
    };
}

function abrirEdicaoOSPonto(index) {
    const os = pontosVinculadosRenderizados[index]?.os;
    if (!os || os.id == null || String(os.id).trim() === '') {
        mostrarFeedbackPontos('error', 'Não foi possível identificar esta OS para abrir o cadastro.');
        return;
    }

    window.location.href = `cadastro_os.html?copiar=${encodeURIComponent(String(os.id))}`;
}

function imprimirOSPontoOperacao(index, botao) {
    const os = pontosVinculadosRenderizados[index]?.os;
    if (!os) {
        mostrarFeedbackPontos('error', 'Não foi possível localizar a OS selecionada para impressão.');
        return;
    }

    definirBotaoAcaoPontoProcessando(botao, true);
    try {
        OrdenaStorage.setItem('osImpressaoTemp', JSON.stringify(prepararDadosImpressaoOSPonto(os)));
        const janelaImpressao = window.open('impressao.html', '_blank');
        if (!janelaImpressao) {
            mostrarFeedbackPontos('error', 'O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.');
            definirBotaoAcaoPontoProcessando(botao, false);
            return;
        }

        janelaImpressao.opener = null;
        mostrarFeedbackPontos('success', `OS Nº ${primeiroTextoPontos(os.numero) || '-'} preparada para impressão em uma nova aba.`);
        window.setTimeout(() => definirBotaoAcaoPontoProcessando(botao, false), 600);
    } catch (erro) {
        console.error('Erro ao preparar a impressão da OS:', erro);
        mostrarFeedbackPontos('error', 'Não foi possível preparar a impressão desta OS.');
        definirBotaoAcaoPontoProcessando(botao, false);
    }
}

function coletarOrdensVinculadasParaImpressao(ordens, nomeOperacao) {
    const chavesIncluidas = new Set();
    const relacionadas = [];

    ordens.forEach((os, indice) => {
        if (!os || !(Array.isArray(os.atividades) ? os.atividades : [])
            .some((atividade) => extrairNomeOperacaoAtividade(atividade) === nomeOperacao)) {
            return;
        }

        const chave = os.id != null && String(os.id).trim()
            ? `id:${String(os.id)}`
            : primeiroTextoPontos(os.numero)
                ? `numero:${primeiroTextoPontos(os.numero)}`
                : `indice:${indice}`;
        if (chavesIncluidas.has(chave)) return;
        chavesIncluidas.add(chave);
        relacionadas.push(os);
    });

    return relacionadas.sort(compararNumerosOsDecrescente);
}

function imprimirTodasOSOperacao(botao) {
    limparFeedbackPontos();
    definirBotaoAcaoPontoProcessando(botao, true, 'Preparando impressão...');

    try {
        const operacoes = lerArrayStoragePontos('cadastrosOperacoes');
        const ordens = lerArrayStoragePontos('ordensServico');
        const operacao = resolverOperacaoPontos(operacoes);
        if (!operacao) {
            mostrarFeedbackPontos('error', 'Não foi possível localizar a operação para impressão.');
            definirBotaoAcaoPontoProcessando(botao, false);
            return;
        }

        const nomeOperacao = normalizarNomeOperacaoPontos(operacao.nome);
        const ordensRelacionadas = coletarOrdensVinculadasParaImpressao(ordens, nomeOperacao);
        if (ordensRelacionadas.length === 0) {
            mostrarFeedbackPontos('error', 'Esta operação não possui Ordens de Serviço vinculadas para impressão.');
            definirBotaoAcaoPontoProcessando(botao, false);
            return;
        }

        const statusOperacao = typeof obterStatusOperacao === 'function'
            ? obterStatusOperacao(operacao)
            : (operacao.status || 'Ativa');
        const payload = {
            operacao: {
                id: operacao.id ?? null,
                nome: nomeOperacao,
                descricao: primeiroTextoPontos(operacao.descricao),
                inicio: primeiroTextoPontos(operacao.inicio),
                fim: primeiroTextoPontos(operacao.fim),
                status: statusOperacao
            },
            ordens: ordensRelacionadas,
            geradoEm: new Date().toISOString()
        };

        OrdenaStorage.setItem('operacaoOsImpressaoTemp', JSON.stringify(payload));
        const janelaImpressao = window.open('impressao_operacao_especial.html', '_blank');
        if (!janelaImpressao) {
            mostrarFeedbackPontos('error', 'O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.');
            definirBotaoAcaoPontoProcessando(botao, false);
            return;
        }

        janelaImpressao.opener = null;
        mostrarFeedbackPontos(
            'success',
            `${ordensRelacionadas.length} ${ordensRelacionadas.length === 1 ? 'OS vinculada preparada' : 'OS vinculadas preparadas'} para impressão em uma nova aba.`
        );
        window.setTimeout(() => definirBotaoAcaoPontoProcessando(botao, false), 600);
    } catch (erro) {
        console.error('Erro ao preparar a impressão das OS vinculadas:', erro);
        mostrarFeedbackPontos('error', 'Não foi possível preparar a impressão das OS vinculadas.');
        definirBotaoAcaoPontoProcessando(botao, false);
    }
}

function numeroCoordenadaPonto(valor, minimo, maximo) {
    if (valor == null || (typeof valor === 'string' && !valor.trim())) return NaN;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= minimo && numero <= maximo ? numero : NaN;
}

function obterParCoordenadasPonto(fonte) {
    if (!fonte || typeof fonte !== 'object') return null;

    const lat = numeroCoordenadaPonto(fonte.lat, -90, 90);
    const lng = numeroCoordenadaPonto(fonte.lng, -180, 180);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function normalizarPoligonoPonto(poligono) {
    if (!Array.isArray(poligono) || poligono.length < 3) return null;

    const pontos = [];
    for (const ponto of poligono) {
        const latOriginal = Array.isArray(ponto) ? ponto[0] : ponto?.lat;
        const lngOriginal = Array.isArray(ponto) ? ponto[1] : ponto?.lng;
        const lat = numeroCoordenadaPonto(latOriginal, -90, 90);
        const lng = numeroCoordenadaPonto(lngOriginal, -180, 180);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        pontos.push({ lat, lng });
    }

    const primeiro = pontos[0];
    const ultimo = pontos[pontos.length - 1];
    if (pontos.length > 3 && primeiro.lat === ultimo.lat && primeiro.lng === ultimo.lng) {
        pontos.pop();
    }

    const pontosDistintos = new Set(pontos.map((ponto) => `${ponto.lat}:${ponto.lng}`));
    return pontos.length >= 3 && pontosDistintos.size >= 3 ? pontos : null;
}

function obterRaioMapaPonto(fonte) {
    if (!fonte || typeof fonte !== 'object' || fonte.raio == null || fonte.raio === '') return NaN;
    const raio = Number(fonte.raio);
    return Number.isFinite(raio) && raio > 0 ? raio : NaN;
}

function obterChaveCadastroMapaPonto(tipo) {
    const tipoNormalizado = normalizarTextoComparacao(tipo);
    if (tipoNormalizado === 'baseamento') return 'locaisCadastrados';
    if (tipoNormalizado === 'patrulhamento') return 'pontosPatrulhamento';
    return '';
}

function obterIdentificadorCadastroMapaPonto(local) {
    return primeiroTextoPontos(local?.apelido, local?.nome, local?.codigo);
}

function encontrarCadastroMapaPonto(atividade) {
    const chave = obterChaveCadastroMapaPonto(atividade?.tipo);
    const identificador = normalizarTextoComparacao(primeiroTextoPontos(
        atividade?.local,
        atividade?.ponto,
        atividade?.apelido
    ));
    if (!chave || !identificador) return null;

    try {
        const locais = lerArrayStoragePontos(chave);
        return locais.find((local) =>
            normalizarTextoComparacao(obterIdentificadorCadastroMapaPonto(local)) === identificador
        ) || null;
    } catch (erro) {
        console.error(`Erro ao carregar ${chave} para o mapa do ponto:`, erro);
        return null;
    }
}

function montarDadosMapaPonto(fonte) {
    const poligono = normalizarPoligonoPonto(fonte?.poligono);
    const coordenadas = obterParCoordenadasPonto(fonte);

    return {
        poligono,
        lat: coordenadas?.lat,
        lng: coordenadas?.lng,
        raio: obterRaioMapaPonto(fonte)
    };
}

function obterDadosMapaPonto(atividade) {
    const gps = atividade?.gps && typeof atividade.gps === 'object' ? atividade.gps : null;
    const dadosSnapshot = montarDadosMapaPonto(gps);
    const dadosCadastro = montarDadosMapaPonto(encontrarCadastroMapaPonto(atividade));
    const snapshotPossuiCoordenadas = Number.isFinite(dadosSnapshot.lat) && Number.isFinite(dadosSnapshot.lng);
    const cadastroPossuiCoordenadas = Number.isFinite(dadosCadastro.lat) && Number.isFinite(dadosCadastro.lng);
    const possuiCoordenadas = snapshotPossuiCoordenadas || cadastroPossuiCoordenadas;
    const poligono = dadosSnapshot.poligono || dadosCadastro.poligono;
    if (!poligono && !possuiCoordenadas) return null;

    return {
        poligono,
        lat: snapshotPossuiCoordenadas ? dadosSnapshot.lat : dadosCadastro.lat,
        lng: snapshotPossuiCoordenadas ? dadosSnapshot.lng : dadosCadastro.lng,
        raio: Number.isFinite(dadosSnapshot.raio) ? dadosSnapshot.raio : dadosCadastro.raio
    };
}

function descreverGeometriaMapaPonto(dadosMapa) {
    if (dadosMapa?.poligono) return `Área com ${dadosMapa.poligono.length} pontos`;
    if (Number.isFinite(dadosMapa?.raio)) return `Raio de ${dadosMapa.raio} metros`;
    return `GPS: ${dadosMapa?.lat}, ${dadosMapa?.lng}`;
}

function definirFundoMapaPontoInerte(inerte) {
    ['nav', '#sidebar', '#overlay', 'main'].forEach((seletor) => {
        const elemento = document.querySelector(seletor);
        if (!elemento) return;
        if (inerte) elemento.setAttribute('inert', '');
        else elemento.removeAttribute('inert');
    });
}

function manterFocoMapaPonto(evento, modal) {
    const elementos = Array.from(modal.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )).filter((elemento) => elemento.offsetParent !== null);
    if (elementos.length === 0) return;

    const primeiro = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    if (!modal.contains(document.activeElement)) {
        evento.preventDefault();
        primeiro.focus();
    } else if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
    }
}

function atualizarStatusMapaPonto(tipo, mensagem, carregando) {
    const status = document.getElementById('statusMapaPontoOperacao');
    const texto = document.getElementById('statusMapaPontoOperacaoTexto');
    const loading = document.getElementById('statusMapaPontoOperacaoLoading');
    const mapa = document.getElementById('mapaPontoOperacao');
    if (!status || !texto || !loading) return;

    status.className = `mapa-ponto-status${tipo ? ` ${tipo}` : ''}`;
    texto.textContent = mensagem;
    loading.hidden = !carregando;
    if (mapa) mapa.setAttribute('aria-busy', String(carregando));
}

function restaurarBotaoMapaPonto() {
    if (botaoMapaPontoCarregando?.isConnected) {
        botaoMapaPontoCarregando.disabled = false;
        botaoMapaPontoCarregando.removeAttribute('aria-busy');
        botaoMapaPontoCarregando.textContent = textoOriginalBotaoMapaPonto || '🗺️ Mapa';
    }
    botaoMapaPontoCarregando = null;
    textoOriginalBotaoMapaPonto = '';
}

function finalizarCarregamentoMapaPonto(token, tipo, mensagem) {
    if (token !== sequenciaMapaPonto) return;
    if (temporizadorMapaPonto) {
        clearTimeout(temporizadorMapaPonto);
        temporizadorMapaPonto = null;
    }
    atualizarStatusMapaPonto(tipo, mensagem, false);
    restaurarBotaoMapaPonto();
}

function abrirMapaPontoOperacao(index, botao) {
    const registro = pontosVinculadosRenderizados[index];
    const dadosMapa = obterDadosMapaPonto(registro?.atividade);
    if (!registro || !dadosMapa) {
        mostrarFeedbackPontos('error', 'Este ponto não possui coordenadas válidas para exibição no mapa.');
        return;
    }

    const modal = document.getElementById('modalMapaPontoOperacao');
    const titulo = document.getElementById('tituloMapaPontoOperacao');
    const descricao = document.getElementById('descricaoMapaPontoOperacao');
    if (!modal || !titulo || !descricao) {
        mostrarFeedbackPontos('error', 'Não foi possível abrir a visualização do mapa.');
        return;
    }
    if (!modal.hidden) return;

    limparFeedbackPontos();
    elementoRetornoMapaPonto = botao || document.activeElement;
    botaoMapaPontoCarregando = botao || null;
    if (botaoMapaPontoCarregando) {
        textoOriginalBotaoMapaPonto = botaoMapaPontoCarregando.textContent;
        botaoMapaPontoCarregando.disabled = true;
        botaoMapaPontoCarregando.setAttribute('aria-busy', 'true');
        botaoMapaPontoCarregando.textContent = 'Carregando...';
    }

    const atividade = registro.atividade;
    const tipo = primeiroTextoPontos(atividade?.tipo) || 'Ponto';
    const local = primeiroTextoPontos(atividade?.local, atividade?.ponto, atividade?.apelido)
        || 'Local sem identificação';
    const endereco = formatarEnderecoPonto(atividade);
    titulo.textContent = `${tipo}: ${local}`;
    descricao.textContent = [
        endereco === 'Não informado' ? '' : endereco,
        descreverGeometriaMapaPonto(dadosMapa)
    ].filter(Boolean).join(' • ');

    definirFundoMapaPontoInerte(true);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-mapa-ponto-aberto');
    atualizarStatusMapaPonto('', 'Carregando mapa...', true);

    const token = ++sequenciaMapaPonto;
    if (temporizadorMapaPonto) clearTimeout(temporizadorMapaPonto);

    window.setTimeout(() => {
        if (token !== sequenciaMapaPonto) return;
        let carregamentoFinalizado = false;
        const concluirCarregamento = (tipoStatus, mensagem) => {
            if (carregamentoFinalizado) return;
            carregamentoFinalizado = true;
            finalizarCarregamentoMapaPonto(token, tipoStatus, mensagem);
        };

        if (typeof L === 'undefined') {
            concluirCarregamento('error', 'Não foi possível carregar o recurso de mapas.');
            return;
        }

        try {
            if (mapaPontoOperacao) mapaPontoOperacao.remove();
            mapaPontoOperacao = L.map('mapaPontoOperacao');

            temporizadorMapaPonto = window.setTimeout(() => {
                concluirCarregamento('error', 'O mapa demorou mais que o esperado para carregar.');
            }, 10000);

            const camadaBase = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            });
            camadaBase.once('load', () => {
                concluirCarregamento('success', 'Mapa carregado com sucesso.');
            });
            camadaBase.once('tileerror', () => {
                concluirCarregamento('error', 'Não foi possível carregar todos os detalhes do mapa.');
            });
            camadaBase.addTo(mapaPontoOperacao);

            if (dadosMapa.poligono) {
                const camadaPoligono = L.polygon(
                    dadosMapa.poligono.map((ponto) => [ponto.lat, ponto.lng]),
                    { color: '#d32f2f', weight: 3, fillColor: '#f44336', fillOpacity: 0.2 }
                ).addTo(mapaPontoOperacao);
                mapaPontoOperacao.fitBounds(camadaPoligono.getBounds(), { padding: [25, 25], maxZoom: 17 });
            } else {
                const centro = [dadosMapa.lat, dadosMapa.lng];
                mapaPontoOperacao.setView(centro, 16);
                if (Number.isFinite(dadosMapa.raio)) {
                    const camadaCirculo = L.circle(centro, {
                        radius: dadosMapa.raio,
                        color: '#d32f2f',
                        fillColor: '#f44336',
                        fillOpacity: 0.2
                    }).addTo(mapaPontoOperacao);
                    L.marker(centro).addTo(mapaPontoOperacao);
                    mapaPontoOperacao.fitBounds(camadaCirculo.getBounds(), { padding: [25, 25] });
                } else {
                    L.marker(centro).addTo(mapaPontoOperacao);
                }
            }

            mapaPontoOperacao.invalidateSize();
        } catch (erro) {
            console.error('Erro ao abrir mapa do ponto vinculado:', erro);
            concluirCarregamento('error', 'Não foi possível montar a visualização do mapa.');
        }
    }, 100);

    requestAnimationFrame(() => modal.querySelector('.modal-close-btn')?.focus());
}

function fecharMapaPontoOperacao() {
    const modal = document.getElementById('modalMapaPontoOperacao');
    if (!modal || modal.hidden) return;

    sequenciaMapaPonto += 1;
    if (temporizadorMapaPonto) {
        clearTimeout(temporizadorMapaPonto);
        temporizadorMapaPonto = null;
    }
    if (mapaPontoOperacao) {
        mapaPontoOperacao.remove();
        mapaPontoOperacao = null;
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-mapa-ponto-aberto');
    definirFundoMapaPontoInerte(false);
    restaurarBotaoMapaPonto();

    if (elementoRetornoMapaPonto?.isConnected) elementoRetornoMapaPonto.focus();
    elementoRetornoMapaPonto = null;
}

function configurarEventosMapaPontoOperacao() {
    const modal = document.getElementById('modalMapaPontoOperacao');
    if (!modal || modal.dataset.eventosMapaConfigurados === 'true') return;
    modal.dataset.eventosMapaConfigurados = 'true';

    modal.addEventListener('click', (evento) => {
        if (evento.target === modal) fecharMapaPontoOperacao();
    });

    document.addEventListener('keydown', (evento) => {
        if (modal.hidden) return;
        if (evento.key === 'Escape') fecharMapaPontoOperacao();
        if (evento.key === 'Tab') manterFocoMapaPonto(evento, modal);
    });
}

function compararNumerosOsDecrescente(a, b) {
    const numeroA = Number(a?.numero);
    const numeroB = Number(b?.numero);
    const aEhNumero = Number.isFinite(numeroA);
    const bEhNumero = Number.isFinite(numeroB);

    if (aEhNumero && bEhNumero) return numeroB - numeroA;
    if (aEhNumero) return -1;
    if (bEhNumero) return 1;
    return String(b?.numero ?? '').localeCompare(String(a?.numero ?? ''), 'pt-BR', { numeric: true });
}

function coletarPontosVinculados(ordens, nomeOperacao) {
    const pontos = [];
    let totalOsRelacionadas = 0;

    const ordensAtivas = ordens
        .filter((os) => os && (os.status || 'Ativa') === 'Ativa')
        .sort(compararNumerosOsDecrescente);

    ordensAtivas.forEach((os) => {
        const atividades = Array.isArray(os.atividades) ? os.atividades : [];
        let osPossuiVinculo = false;

        atividades.forEach((atividade, indiceAtividade) => {
            if (extrairNomeOperacaoAtividade(atividade) !== nomeOperacao) return;

            osPossuiVinculo = true;
            pontos.push({ os, atividade, indiceAtividade });
        });

        if (osPossuiVinculo) totalOsRelacionadas += 1;
    });

    return { pontos, totalOsRelacionadas };
}

function atualizarCabecalhoPontos(operacao) {
    const nome = normalizarNomeOperacaoPontos(operacao?.nome) || 'OPERAÇÃO SEM NOME';
    const titulo = document.getElementById('tituloPontosOperacao');
    const descricao = document.getElementById('descricaoPontosOperacao');
    const descricaoCadastro = primeiroTextoPontos(operacao?.descricao);
    const integradoAosDetalhes = !!document.getElementById('secaoPontosOperacaoDetalhes');

    if (titulo) titulo.textContent = integradoAosDetalhes ? 'Pontos vinculados' : `Pontos vinculados — ${nome}`;
    if (descricao) {
        descricao.textContent = integradoAosDetalhes
            ? 'Somente pontos vinculados em Ordens de Serviço ativas são exibidos.'
            : descricaoCadastro
                ? `${descricaoCadastro} Somente pontos vinculados em Ordens de Serviço ativas são exibidos.`
                : 'Somente pontos vinculados em Ordens de Serviço ativas são exibidos.';
    }
    if (!integradoAosDetalhes) document.title = `ORDENA - Pontos vinculados - ${nome}`;
}

function atualizarResumoPontos(totalPontos, totalOs) {
    const totalPontosElemento = document.getElementById('totalPontosVinculados');
    const totalOsElemento = document.getElementById('totalOsRelacionadas');
    const rotuloPontosElemento = document.getElementById('rotuloTotalPontosVinculados');
    const rotuloOsElemento = document.getElementById('rotuloTotalOsRelacionadas');
    if (totalPontosElemento) totalPontosElemento.textContent = String(totalPontos);
    if (totalOsElemento) totalOsElemento.textContent = String(totalOs);
    if (rotuloPontosElemento) {
        rotuloPontosElemento.textContent = totalPontos === 1 ? 'ponto vinculado' : 'pontos vinculados';
    }
    if (rotuloOsElemento) {
        rotuloOsElemento.textContent = totalOs === 1 ? 'OS relacionada' : 'OS relacionadas';
    }
}

function renderizarMensagemTabelaPontos(mensagem, classe = '') {
    const corpoTabela = document.getElementById('listaPontosOperacao');
    if (!corpoTabela) return;
    pontosVinculadosRenderizados = [];

    const classeAdicional = classe ? ` ${classe}` : '';
    corpoTabela.innerHTML = `
        <tr class="pontos-mensagem-row${classeAdicional}">
            <td colspan="7">${escaparHtmlPontos(mensagem)}</td>
        </tr>
    `;
}

function renderizarLinhasPontos(pontos) {
    const corpoTabela = document.getElementById('listaPontosOperacao');
    if (!corpoTabela) return;
    pontosVinculadosRenderizados = pontos;
    corpoTabela.innerHTML = '';

    pontos.forEach(({ os, atividade }, index) => {
        const linha = document.createElement('tr');
        const numeroOs = primeiroTextoPontos(os?.numero) || 'Não informado';
        const missao = primeiroTextoPontos(os?.nomeOS) || 'Não informada';
        const tipoAtividade = primeiroTextoPontos(atividade?.tipo) || 'Não informado';
        const local = primeiroTextoPontos(
            atividade?.local,
            atividade?.ponto,
            atividade?.apelido
        ) || 'Não informado';
        const possuiMapa = !!obterDadosMapaPonto(atividade);
        const descricaoBotaoMapa = possuiMapa
            ? `Abrir mapa de ${local}, OS ${numeroOs}`
            : `Mapa indisponível para ${local}, OS ${numeroOs}`;
        const atributosBotaoMapa = possuiMapa
            ? `onclick="abrirMapaPontoOperacao(${index}, this)"`
            : 'disabled aria-disabled="true" title="Coordenadas indisponíveis"';
        const possuiIdentificadorOS = os?.id != null && String(os.id).trim() !== '';
        const atributosBotaoEditar = possuiIdentificadorOS
            ? `onclick="abrirEdicaoOSPonto(${index})"`
            : 'disabled aria-disabled="true" title="Identificador da OS indisponível"';

        linha.innerHTML = `
            <td data-label="Nº OS"><strong>${escaparHtmlPontos(numeroOs)}</strong></td>
            <td data-label="Missão">${escaparHtmlPontos(missao)}</td>
            <td data-label="Atividade">${escaparHtmlPontos(tipoAtividade)}</td>
            <td data-label="Horário">${escaparHtmlPontos(formatarHorarioPonto(atividade))}</td>
            <td data-label="Ponto / Área"><strong>${escaparHtmlPontos(local)}</strong></td>
            <td data-label="Endereço" class="texto-longo-ponto">${escaparHtmlPontos(formatarEnderecoPonto(atividade))}</td>
            <td data-label="Ações" class="ponto-acoes-cell">
                <div class="ponto-acoes-grupo" role="group" aria-label="Ações da OS ${escaparHtmlPontos(numeroOs)}">
                    <button type="button" class="btn-info btn-mapa-ponto btn-acao-ponto" ${atributosBotaoMapa} aria-label="${escaparHtmlPontos(descricaoBotaoMapa)}">🗺️ Mapa</button>
                    <button type="button" class="btn-warning btn-acao-ponto" ${atributosBotaoEditar} aria-label="Abrir OS ${escaparHtmlPontos(numeroOs)} no cadastro para edição">Editar OS</button>
                    <button type="button" class="btn-primary btn-acao-ponto" onclick="imprimirOSPontoOperacao(${index}, this)" aria-label="Imprimir OS ${escaparHtmlPontos(numeroOs)} em uma nova aba">Imprimir</button>
                </div>
            </td>
        `;
        corpoTabela.appendChild(linha);
    });
}

function renderizarPontosOperacao() {
    limparFeedbackPontos();

    let operacoes;
    try {
        operacoes = lerArrayStoragePontos('cadastrosOperacoes');
    } catch (erro) {
        console.error('Erro ao carregar as operações especiais:', erro);
        atualizarResumoPontos(0, 0);
        renderizarMensagemTabelaPontos('Não foi possível carregar a operação selecionada.', 'erro');
        mostrarFeedbackPontos('error', 'Os dados das operações estão inválidos ou indisponíveis.');
        return;
    }

    const operacao = resolverOperacaoPontos(operacoes);
    if (!operacao) {
        const titulo = document.getElementById('tituloPontosOperacao');
        if (titulo) titulo.textContent = 'Operação especial não encontrada';
        atualizarResumoPontos(0, 0);
        renderizarMensagemTabelaPontos('Não foi possível localizar a operação informada.', 'erro');
        mostrarFeedbackPontos('error', 'Volte para a listagem e selecione uma operação cadastrada.');
        return;
    }

    atualizarCabecalhoPontos(operacao);
    const nomeOperacao = normalizarNomeOperacaoPontos(operacao.nome);

    let ordens;
    try {
        ordens = lerArrayStoragePontos('ordensServico');
    } catch (erro) {
        console.error('Erro ao carregar as Ordens de Serviço:', erro);
        atualizarResumoPontos(0, 0);
        renderizarMensagemTabelaPontos('Não foi possível carregar as Ordens de Serviço.', 'erro');
        mostrarFeedbackPontos('error', 'Os dados das Ordens de Serviço estão inválidos ou indisponíveis.');
        return;
    }

    const resultado = coletarPontosVinculados(ordens, nomeOperacao);
    atualizarResumoPontos(resultado.pontos.length, resultado.totalOsRelacionadas);

    if (resultado.pontos.length === 0) {
        renderizarMensagemTabelaPontos('Nenhum ponto vinculado a esta operação em Ordens de Serviço ativas.');
        return;
    }

    renderizarLinhasPontos(resultado.pontos);
}
