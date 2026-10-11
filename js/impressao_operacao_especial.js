'use strict';

const CHAVE_IMPRESSAO_OPERACAO = 'operacaoOsImpressaoTemp';
const mapasRelatorioOperacao = [];
let relatorioOperacaoAtual = null;
let relatorioOperacaoPronto = false;
let processamentoRelatorioOperacao = false;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnBaixarPdf')?.addEventListener('click', baixarPdfOperacao);
    document.getElementById('btnImprimirRelatorio')?.addEventListener('click', imprimirRelatorioOperacao);
    carregarRelatorioOperacao();
});

function escaparHtmlRelatorio(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obterTextoRelatorio(valor, fallback = '') {
    const texto = typeof valor === 'string' || typeof valor === 'number'
        ? String(valor).trim()
        : '';
    return texto && texto !== '-' ? texto : fallback;
}

function normalizarNomeOperacaoRelatorio(valor) {
    return obterTextoRelatorio(valor)
        .toLocaleUpperCase('pt-BR');
}

function extrairNomeOperacaoAtividadeRelatorio(atividade) {
    const nomeDireto = normalizarNomeOperacaoRelatorio(atividade?.operacao);
    if (nomeDireto) return nomeDireto;

    const detalhes = obterTextoRelatorio(atividade?.detalhes)
        || obterTextoRelatorio(atividade?.detalhe);
    const correspondencia = detalhes.match(/\[OP:\s*([^\]]+)\]/i);
    return correspondencia
        ? normalizarNomeOperacaoRelatorio(correspondencia[1])
        : '';
}

function formatarDataRelatorio(valor, fallback = 'Não informada') {
    const texto = obterTextoRelatorio(valor);
    if (!texto) return fallback;

    const dataCivil = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dataCivil) {
        const [, ano, mes, dia] = dataCivil;
        return `${dia}/${mes}/${ano}`;
    }

    const data = new Date(texto);
    return Number.isNaN(data.getTime())
        ? texto
        : data.toLocaleDateString('pt-BR');
}

function formatarDataHoraImpressaoRelatorio() {
    const agora = new Date();
    return `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}`;
}

function formatarHorarioAtividadeRelatorio(atividade) {
    const inicio = obterTextoRelatorio(atividade?.inicio);
    const fim = obterTextoRelatorio(atividade?.fim);
    if (inicio && fim) return `${inicio} às ${fim}`;
    return inicio || fim || 'Não informado';
}

function obterEnderecoAtividadeRelatorio(atividade) {
    const enderecoObjeto = atividade?.endereco && typeof atividade.endereco === 'object'
        ? atividade.endereco
        : {};
    const enderecoLegado = typeof atividade?.endereco === 'string'
        ? atividade.endereco
        : '';
    const rua = obterTextoRelatorio(atividade?.rua)
        || obterTextoRelatorio(atividade?.logradouro)
        || obterTextoRelatorio(atividade?.nomeRua)
        || obterTextoRelatorio(enderecoObjeto.rua)
        || obterTextoRelatorio(enderecoObjeto.logradouro)
        || obterTextoRelatorio(enderecoLegado);
    const numero = obterTextoRelatorio(atividade?.numero)
        || obterTextoRelatorio(enderecoObjeto.numero);
    const bairro = obterTextoRelatorio(atividade?.bairro)
        || obterTextoRelatorio(enderecoObjeto.bairro);
    const cidade = obterTextoRelatorio(atividade?.cidade)
        || obterTextoRelatorio(atividade?.municipio)
        || obterTextoRelatorio(enderecoObjeto.cidade)
        || obterTextoRelatorio(enderecoObjeto.municipio);

    const logradouro = rua ? `${rua}${numero ? `, ${numero}` : ''}` : '';
    return [logradouro, bairro, cidade].filter(Boolean).join(' - ') || 'Não informado';
}

function obterNumeroValidoRelatorio(valor, minimo, maximo) {
    if (valor == null || (typeof valor === 'string' && !valor.trim())) return NaN;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= minimo && numero <= maximo
        ? numero
        : NaN;
}

function obterGpsAtividadeRelatorio(atividade) {
    const gps = atividade?.gps && typeof atividade.gps === 'object'
        ? atividade.gps
        : null;
    if (!gps) return null;

    const lat = obterNumeroValidoRelatorio(gps.lat, -90, 90);
    const lng = obterNumeroValidoRelatorio(gps.lng, -180, 180);
    return Number.isFinite(lat) && Number.isFinite(lng)
        ? { ...gps, lat, lng }
        : null;
}

function normalizarPoligonoRelatorio(valor) {
    if (!Array.isArray(valor)) return [];

    const pontos = valor.map((ponto) => {
        const latOriginal = Array.isArray(ponto) ? ponto[0] : ponto?.lat;
        const lngOriginal = Array.isArray(ponto) ? ponto[1] : ponto?.lng;
        const lat = obterNumeroValidoRelatorio(latOriginal, -90, 90);
        const lng = obterNumeroValidoRelatorio(lngOriginal, -180, 180);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }).filter(Boolean);

    if (pontos.length > 3) {
        const primeiro = pontos[0];
        const ultimo = pontos[pontos.length - 1];
        if (primeiro[0] === ultimo[0] && primeiro[1] === ultimo[1]) pontos.pop();
    }

    return new Set(pontos.map(([lat, lng]) => `${lat}|${lng}`)).size >= 3
        ? pontos
        : [];
}

function atividadePermiteMapaRelatorio(atividade) {
    const tipo = obterTextoRelatorio(atividade?.tipo).toLocaleLowerCase('pt-BR');
    return tipo.includes('baseamento') || tipo.includes('patrulhamento');
}

function obterChaveOrdemRelatorio(os, indice) {
    const id = obterTextoRelatorio(os?.id);
    if (id) return `id:${id}`;
    const numero = obterTextoRelatorio(os?.numero);
    return numero ? `numero:${numero}` : `indice:${indice}`;
}

function prepararOrdensRelatorio(ordens, nomeOperacao) {
    const chaves = new Set();
    const resultado = [];

    ordens.forEach((os, indice) => {
        if (!os || typeof os !== 'object' || Array.isArray(os)) return;
        const chave = obterChaveOrdemRelatorio(os, indice);
        if (chaves.has(chave)) return;

        const atividades = (Array.isArray(os.atividades) ? os.atividades : [])
            .filter((atividade) =>
                extrairNomeOperacaoAtividadeRelatorio(atividade) === nomeOperacao
            );
        if (atividades.length === 0) return;

        chaves.add(chave);
        resultado.push({ os, atividades });
    });

    return resultado;
}

function mostrarStatusRelatorio(tipo, mensagem, carregando = false) {
    const status = document.getElementById('statusRelatorio');
    const texto = document.getElementById('textoStatusRelatorio');
    const loading = document.getElementById('loadingStatusRelatorio');
    if (!status || !texto || !loading) return;

    texto.textContent = mensagem;
    status.className = `report-status${tipo ? ` ${tipo}` : ''}`;
    status.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    loading.hidden = !carregando;
}

function definirBotoesRelatorioHabilitados(habilitados) {
    const botaoPdf = document.getElementById('btnBaixarPdf');
    const botaoImprimir = document.getElementById('btnImprimirRelatorio');
    if (botaoPdf) botaoPdf.disabled = !habilitados;
    if (botaoImprimir) botaoImprimir.disabled = !habilitados;
}

function definirProcessamentoRelatorio(ativo, acao = '') {
    processamentoRelatorioOperacao = ativo;
    const botaoPdf = document.getElementById('btnBaixarPdf');
    const botaoImprimir = document.getElementById('btnImprimirRelatorio');
    const textoPdf = document.getElementById('textoBtnBaixarPdf');
    const textoImprimir = document.getElementById('textoBtnImprimirRelatorio');
    const loadingPdf = document.getElementById('loadingBtnBaixarPdf');
    const loadingImprimir = document.getElementById('loadingBtnImprimirRelatorio');

    if (botaoPdf) {
        botaoPdf.disabled = ativo || !relatorioOperacaoPronto;
        botaoPdf.toggleAttribute('aria-busy', ativo && acao === 'pdf');
    }
    if (botaoImprimir) {
        botaoImprimir.disabled = ativo || !relatorioOperacaoPronto;
        botaoImprimir.toggleAttribute('aria-busy', ativo && acao === 'imprimir');
    }
    if (textoPdf) textoPdf.textContent = ativo && acao === 'pdf' ? 'Gerando PDF...' : '⬇️ Baixar PDF';
    if (textoImprimir) {
        textoImprimir.textContent = ativo && acao === 'imprimir'
            ? 'Preparando impressão...'
            : '🖨️ Imprimir / Salvar PDF';
    }
    if (loadingPdf) loadingPdf.hidden = !(ativo && acao === 'pdf');
    if (loadingImprimir) loadingImprimir.hidden = !(ativo && acao === 'imprimir');
}

function criarCabecalhoInstitucionalRelatorio() {
    return `
        <div class="header">
            <div class="header-identidade">
                <div class="header-instituicao" data-perfil-instituicao>Prefeitura Municipal de Demonstração</div>
                <div class="header-orgao" data-perfil-orgao>Secretaria de Segurança Pública</div>
            </div>
        </div>
    `;
}

function criarRodapeRelatorio(status, dataImpressao, textoDocumento) {
    const statusTexto = obterTextoRelatorio(status, 'Ativa');
    const statusAtivo = normalizarNomeOperacaoRelatorio(statusTexto) !== 'INATIVA';
    return `
        <div class="footer-info">
            <div>
                <strong>Gerado por:</strong> Coordenação Operacional<br>
                <span>${escaparHtmlRelatorio(textoDocumento)}</span>
            </div>
            <div class="footer-right">
                <div>Impressão: ${escaparHtmlRelatorio(dataImpressao)}</div>
                <div style="margin-top:3px;">
                    Status: <span class="status-badge ${statusAtivo ? 'bg-ativa' : 'bg-inativa'}">${escaparHtmlRelatorio(statusTexto.toLocaleUpperCase('pt-BR'))}</span>
                </div>
            </div>
        </div>
    `;
}

function criarPaginaResumoOperacao(operacao, ordensPreparadas, dataImpressao) {
    const totalAtividades = ordensPreparadas.reduce(
        (total, item) => total + item.atividades.length,
        0
    );
    const totalPontosGps = ordensPreparadas.reduce(
        (total, item) => total + item.atividades.filter((atividade) =>
            atividadePermiteMapaRelatorio(atividade) && obterGpsAtividadeRelatorio(atividade)
        ).length,
        0
    );
    const nome = normalizarNomeOperacaoRelatorio(operacao.nome) || 'OPERAÇÃO SEM NOME';

    return `
        <section class="page page-summary" aria-label="Resumo da operação ${escaparHtmlRelatorio(nome)}">
            ${criarCabecalhoInstitucionalRelatorio()}
            <div class="document-title">Ordens de Serviço da Operação Especial</div>
            <h1 class="operation-name">${escaparHtmlRelatorio(nome)}</h1>
            <div class="operation-description">${escaparHtmlRelatorio(obterTextoRelatorio(operacao.descricao, 'Descrição não informada.'))}</div>

            <div class="summary-grid">
                <div class="summary-item"><strong>Data de início</strong><span>${escaparHtmlRelatorio(formatarDataRelatorio(operacao.inicio))}</span></div>
                <div class="summary-item"><strong>Data de término</strong><span>${escaparHtmlRelatorio(formatarDataRelatorio(operacao.fim, 'Sem data definida'))}</span></div>
                <div class="summary-item"><strong>Status</strong><span>${escaparHtmlRelatorio(obterTextoRelatorio(operacao.status, 'Ativa'))}</span></div>
                <div class="summary-item"><strong>OS relacionadas</strong><span>${ordensPreparadas.length}</span></div>
                <div class="summary-item"><strong>Atividades vinculadas</strong><span>${totalAtividades}</span></div>
                <div class="summary-item"><strong>Pontos com GPS</strong><span>${totalPontosGps}</span></div>
            </div>

            <div class="section-title">Ordens incluídas neste relatório</div>
            <table>
                <thead>
                    <tr>
                        <th scope="col" style="width:16%;">Nº OS</th>
                        <th scope="col" style="width:52%;">Missão</th>
                        <th scope="col" style="width:16%;">Atividades</th>
                        <th scope="col" style="width:16%;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${ordensPreparadas.map(({ os, atividades }) => `
                        <tr>
                            <td><strong>${escaparHtmlRelatorio(obterTextoRelatorio(os.numero, 'Não informado'))}</strong></td>
                            <td>${escaparHtmlRelatorio(obterTextoRelatorio(os.nomeOS, 'Não informada'))}</td>
                            <td>${atividades.length}</td>
                            <td>${escaparHtmlRelatorio(obterTextoRelatorio(os.status, 'Ativa'))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            ${criarRodapeRelatorio(
                operacao.status,
                dataImpressao,
                'Relatório consolidado das Ordens de Serviço relacionadas à operação.'
            )}
        </section>
    `;
}

function criarLinhaAtividadeRelatorio(atividade) {
    const local = obterTextoRelatorio(
        atividade?.local,
        obterTextoRelatorio(atividade?.ponto, obterTextoRelatorio(atividade?.apelido, 'Não informado'))
    );
    const endereco = obterEnderecoAtividadeRelatorio(atividade);
    const gps = obterGpsAtividadeRelatorio(atividade);
    const rota = gps
        ? `<a href="https://www.google.com/maps/dir/?api=1&amp;destination=${gps.lat},${gps.lng}" target="_blank" rel="noopener" class="btn-gps">IR</a>`
        : '-';

    return `
        <tr>
            <td><div class="td-wrap">${escaparHtmlRelatorio(formatarHorarioAtividadeRelatorio(atividade))}</div></td>
            <td><div class="td-wrap">${escaparHtmlRelatorio(obterTextoRelatorio(atividade?.tipo, 'Não informada'))}</div></td>
            <td>
                <div class="td-wrap">
                    <strong>${escaparHtmlRelatorio(local)}</strong>
                    <span>${escaparHtmlRelatorio(endereco)}</span>
                </div>
            </td>
            <td style="text-align:center;"><div class="td-wrap">${rota}</div></td>
        </tr>
    `;
}

function criarCardsMapasRelatorio(atividades, indiceOs, descritoresMapas) {
    const atividadesComMapa = atividades
        .map((atividade, indiceAtividade) => ({ atividade, indiceAtividade }))
        .filter(({ atividade }) =>
            atividadePermiteMapaRelatorio(atividade) && obterGpsAtividadeRelatorio(atividade)
        );

    if (atividadesComMapa.length === 0) {
        return '<div class="empty-maps">Nenhum ponto de baseamento ou patrulhamento com GPS nesta operação.</div>';
    }

    return atividadesComMapa.map(({ atividade, indiceAtividade }) => {
        const gps = obterGpsAtividadeRelatorio(atividade);
        const mapId = `mapa-operacao-os-${indiceOs}-${indiceAtividade}`;
        const tipo = obterTextoRelatorio(atividade?.tipo, 'Ponto');
        const local = obterTextoRelatorio(
            atividade?.local,
            obterTextoRelatorio(atividade?.ponto, obterTextoRelatorio(atividade?.apelido, 'Não informado'))
        );
        descritoresMapas.push({ mapId, gps, tipo });

        return `
            <article class="card-ponto">
                <div class="card-header">
                    <span class="badge-tipo">${escaparHtmlRelatorio(tipo)}</span>
                    <span class="card-title">${escaparHtmlRelatorio(local)}</span>
                </div>
                <div class="card-meta">
                    <div><strong>Horário:</strong> ${escaparHtmlRelatorio(formatarHorarioAtividadeRelatorio(atividade))}</div>
                    <div><strong>Endereço:</strong> ${escaparHtmlRelatorio(obterEnderecoAtividadeRelatorio(atividade))}</div>
                </div>
                <div id="${mapId}" class="card-map" role="img" aria-label="Mapa de ${escaparHtmlRelatorio(local)}"></div>
            </article>
        `;
    }).join('');
}

function criarPaginaOrdemRelatorio(item, indiceOs, nomeOperacao, dataImpressao, descritoresMapas) {
    const { os, atividades } = item;
    const numero = obterTextoRelatorio(os.numero, 'Não informado');
    const cardsMapas = criarCardsMapasRelatorio(atividades, indiceOs, descritoresMapas);

    return `
        <section class="page page-os" aria-label="Ordem de Serviço ${escaparHtmlRelatorio(numero)}">
            ${criarCabecalhoInstitucionalRelatorio()}
            <div class="os-title">Ordem de Serviço Nº ${escaparHtmlRelatorio(numero)}</div>

            <div class="os-grid">
                <div class="os-item"><strong>Missão</strong><span>${escaparHtmlRelatorio(obterTextoRelatorio(os.nomeOS, 'Não informada'))}</span></div>
                <div class="os-item"><strong>Operação</strong><span>${escaparHtmlRelatorio(nomeOperacao)}</span></div>
                <div class="os-item"><strong>Início do turno</strong><span>${escaparHtmlRelatorio(obterTextoRelatorio(os.inicioGeral, 'Não informado'))}</span></div>
                <div class="os-item"><strong>Término do turno</strong><span>${escaparHtmlRelatorio(obterTextoRelatorio(os.terminoGeral, 'Não informado'))}</span></div>
                <div class="os-item"><strong>Status</strong><span>${escaparHtmlRelatorio(obterTextoRelatorio(os.status, 'Ativa'))}</span></div>
            </div>

            <div class="section-title">Atividades vinculadas à operação</div>
            <table>
                <thead>
                    <tr>
                        <th scope="col" style="width:17%;">Horário</th>
                        <th scope="col" style="width:20%;">Atividade</th>
                        <th scope="col" style="width:53%;">Local / Endereço</th>
                        <th scope="col" style="width:10%; text-align:center;">Rota</th>
                    </tr>
                </thead>
                <tbody>${atividades.map(criarLinhaAtividadeRelatorio).join('')}</tbody>
            </table>

            <div class="section-title">Observações gerais / prescrições</div>
            <div class="prescricoes">${escaparHtmlRelatorio(obterTextoRelatorio(os.prescricoes, 'Nenhuma observação adicional.'))}</div>

            <div class="section-title">Mapas dos pontos vinculados</div>
            <div class="cards-grid">${cardsMapas}</div>

            ${criarRodapeRelatorio(
                os.status,
                dataImpressao,
                `Atividades da OS vinculadas à operação ${nomeOperacao}.`
            )}
        </section>
    `;
}

function renderizarRelatorioOperacao(payload) {
    const container = document.getElementById('pdfContainer');
    if (!container) throw new Error('Contêiner do relatório não encontrado.');

    const operacao = payload.operacao;
    const nomeOperacao = normalizarNomeOperacaoRelatorio(operacao.nome);
    const ordensPreparadas = prepararOrdensRelatorio(payload.ordens, nomeOperacao);
    if (ordensPreparadas.length === 0) {
        throw new Error('Nenhuma Ordem de Serviço possui atividades vinculadas a esta operação.');
    }

    const dataImpressao = formatarDataHoraImpressaoRelatorio();
    const descritoresMapas = [];
    container.innerHTML = [
        criarPaginaResumoOperacao(operacao, ordensPreparadas, dataImpressao),
        ...ordensPreparadas.map((item, indice) =>
            criarPaginaOrdemRelatorio(item, indice, nomeOperacao, dataImpressao, descritoresMapas)
        )
    ].join('');
    container.hidden = false;

    relatorioOperacaoAtual = {
        operacao,
        nomeOperacao,
        ordensPreparadas,
        descritoresMapas
    };
    document.title = `ORDENA - OS relacionadas - ${nomeOperacao}`;
    inicializarMapasRelatorio(descritoresMapas);
}

function carregarRelatorioOperacao() {
    const container = document.getElementById('pdfContainer');
    relatorioOperacaoPronto = false;
    definirBotoesRelatorioHabilitados(false);
    mostrarStatusRelatorio('', 'Carregando relatório', true);

    try {
        const valor = OrdenaStorage.getItem(CHAVE_IMPRESSAO_OPERACAO);
        if (!valor) {
            throw new Error('Nenhuma operação foi selecionada para impressão.');
        }

        const payload = JSON.parse(valor);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error('Os dados da impressão estão em um formato inválido.');
        }
        if (!payload.operacao || typeof payload.operacao !== 'object' || Array.isArray(payload.operacao)) {
            throw new Error('Os dados da operação não estão disponíveis para impressão.');
        }
        if (!normalizarNomeOperacaoRelatorio(payload.operacao.nome)) {
            throw new Error('A operação selecionada não possui um nome válido.');
        }
        if (!Array.isArray(payload.ordens)) {
            throw new Error('A lista de Ordens de Serviço está em um formato inválido.');
        }

        renderizarRelatorioOperacao(payload);
        relatorioOperacaoPronto = true;
        definirBotoesRelatorioHabilitados(true);
        const total = relatorioOperacaoAtual.ordensPreparadas.length;
        mostrarStatusRelatorio(
            'success',
            `Relatório pronto: ${total} ${total === 1 ? 'Ordem de Serviço relacionada' : 'Ordens de Serviço relacionadas'}.`
        );
    } catch (erro) {
        console.error('Erro ao preparar relatório da operação especial:', erro);
        if (container) {
            container.hidden = true;
            container.innerHTML = '';
        }
        relatorioOperacaoAtual = null;
        relatorioOperacaoPronto = false;
        definirBotoesRelatorioHabilitados(false);
        mostrarStatusRelatorio(
            'error',
            erro instanceof Error
                ? erro.message
                : 'Não foi possível preparar o relatório desta operação.'
        );
    }
}

function inicializarMapasRelatorio(descritores) {
    if (!Array.isArray(descritores) || descritores.length === 0) return;

    if (typeof L === 'undefined') {
        descritores.forEach(({ mapId }) => {
            const elemento = document.getElementById(mapId);
            if (elemento) elemento.innerHTML = '<div class="map-message">Mapa indisponível. Os demais dados do ponto foram preservados.</div>';
        });
        mostrarStatusRelatorio(
            'warning',
            'Relatório carregado, mas a biblioteca de mapas não está disponível. A impressão continuará sem os mapas.'
        );
        return;
    }

    const iconeMarcador = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: null,
        shadowSize: null
    });

    descritores.forEach(({ mapId, gps, tipo }) => {
        const elemento = document.getElementById(mapId);
        if (!elemento) return;

        try {
            const mapa = L.map(mapId, {
                zoomControl: false,
                attributionControl: false,
                preferCanvas: true,
                zoomAnimation: false,
                fadeAnimation: false,
                markerZoomAnimation: false
            }).setView([gps.lat, gps.lng], 15);

            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(mapa);

            const patrulhamento = tipo.toLocaleLowerCase('pt-BR').includes('patrulhamento');
            const poligono = patrulhamento ? normalizarPoligonoRelatorio(gps.poligono) : [];

            if (poligono.length >= 3) {
                const area = L.polygon(poligono, {
                    color: '#d32f2f',
                    fillColor: '#f44336',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(mapa);
                L.marker([gps.lat, gps.lng], { icon: iconeMarcador }).addTo(mapa);
                mapa.fitBounds(area.getBounds(), { padding: [10, 10], animate: false });
            } else if (patrulhamento && Number(gps.raio) > 0) {
                const area = L.circle([gps.lat, gps.lng], {
                    radius: Number(gps.raio),
                    color: '#d32f2f',
                    fillColor: '#f44336',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(mapa);
                L.marker([gps.lat, gps.lng], { icon: iconeMarcador }).addTo(mapa);
                mapa.fitBounds(area.getBounds(), { padding: [10, 10], animate: false });
            } else {
                L.marker([gps.lat, gps.lng], { icon: iconeMarcador }).addTo(mapa);
            }

            mapa.invalidateSize({ pan: false, debounceMoveend: true });
            mapasRelatorioOperacao.push(mapa);
        } catch (erro) {
            console.warn(`Não foi possível renderizar o mapa ${mapId}:`, erro);
            elemento.innerHTML = '<div class="map-message">Não foi possível carregar este mapa.</div>';
        }
    });
}

function aguardarCamadasMapaRelatorio(mapa, timeoutMs = 1800) {
    return new Promise((resolve) => {
        let finalizado = false;
        let pendentes = 0;

        const finalizar = () => {
            if (finalizado) return;
            finalizado = true;
            resolve();
        };
        const timeout = window.setTimeout(finalizar, timeoutMs);
        const concluirSePronto = () => {
            if (finalizado || pendentes > 0) return;
            window.clearTimeout(timeout);
            requestAnimationFrame(() => requestAnimationFrame(finalizar));
        };

        mapa.eachLayer((camada) => {
            if (typeof camada.isLoading === 'function' && camada.isLoading()) {
                pendentes += 1;
                camada.once('load', () => {
                    pendentes = Math.max(0, pendentes - 1);
                    concluirSePronto();
                });
                camada.once('tileerror', () => {
                    pendentes = Math.max(0, pendentes - 1);
                    concluirSePronto();
                });
            }
        });

        concluirSePronto();
    });
}

function estabilizarMapasRelatorio() {
    const aguardas = mapasRelatorioOperacao.map((mapa) => {
        try {
            if (typeof mapa.stop === 'function') mapa.stop();
            mapa.invalidateSize({ pan: false, debounceMoveend: true });
            const centro = mapa.getCenter();
            mapa.setView(centro, mapa.getZoom(), { animate: false });
            mapa.eachLayer((camada) => {
                if (typeof camada.redraw === 'function') camada.redraw();
            });
            return aguardarCamadasMapaRelatorio(mapa);
        } catch (erro) {
            console.warn('Falha ao estabilizar mapa do relatório:', erro);
            return Promise.resolve();
        }
    });

    return Promise.all(aguardas)
        .then(() => new Promise((resolve) => window.setTimeout(resolve, 180)));
}

function aguardarAtualizacaoVisualRelatorio() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function criarNomeArquivoRelatorio() {
    const nomeOriginal = relatorioOperacaoAtual?.nomeOperacao || 'OPERACAO';
    const nomeSeguro = nomeOriginal
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 70) || 'OPERACAO';
    return `OPERACAO_${nomeSeguro}_OS_RELACIONADAS.pdf`;
}

async function imprimirRelatorioOperacao() {
    if (!relatorioOperacaoPronto || processamentoRelatorioOperacao) return;

    definirProcessamentoRelatorio(true, 'imprimir');
    mostrarStatusRelatorio('', 'Preparando mapas para impressão', true);
    await aguardarAtualizacaoVisualRelatorio();

    try {
        await estabilizarMapasRelatorio();
        mostrarStatusRelatorio('', 'Abrindo opções de impressão...');
        await aguardarAtualizacaoVisualRelatorio();
        window.print();
        mostrarStatusRelatorio('success', 'Relatório enviado para a impressão.');
    } catch (erro) {
        console.error('Erro ao preparar impressão da operação:', erro);
        mostrarStatusRelatorio(
            'error',
            'Não foi possível estabilizar o relatório para impressão. Tente novamente.'
        );
    } finally {
        definirProcessamentoRelatorio(false);
    }
}

async function baixarPdfOperacao() {
    if (!relatorioOperacaoPronto || processamentoRelatorioOperacao) return;

    const container = document.getElementById('pdfContainer');
    if (!container) {
        mostrarStatusRelatorio('error', 'Não foi possível localizar o conteúdo do relatório.');
        return;
    }

    definirProcessamentoRelatorio(true, 'pdf');
    mostrarStatusRelatorio('', 'Preparando mapas e páginas do PDF', true);
    document.body.classList.add('pdf-download-mode');
    await aguardarAtualizacaoVisualRelatorio();

    let fallbackImpressao = false;
    try {
        await estabilizarMapasRelatorio();

        if (typeof html2pdf === 'undefined') {
            fallbackImpressao = true;
            mostrarStatusRelatorio(
                'warning',
                'O gerador de PDF não foi carregado. Abrindo a impressão padrão como alternativa.'
            );
            await aguardarAtualizacaoVisualRelatorio();
            window.print();
            return;
        }

        const opcoes = {
            margin: [0, 0, 0, 0],
            filename: criarNomeArquivoRelatorio(),
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: -window.scrollY
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: {
                mode: ['css', 'legacy'],
                before: '.page-os',
                avoid: ['tr', '.card-ponto', '.card-map', '.footer-info']
            }
        };

        await html2pdf().set(opcoes).from(container).save();
        mostrarStatusRelatorio('success', 'PDF gerado e baixado com sucesso.');
    } catch (erro) {
        console.error('Erro ao gerar PDF das OS relacionadas:', erro);
        fallbackImpressao = true;
        mostrarStatusRelatorio(
            'warning',
            'Não foi possível gerar o PDF automaticamente. Abrindo a impressão padrão como alternativa.'
        );
        await aguardarAtualizacaoVisualRelatorio();
        window.print();
    } finally {
        document.body.classList.remove('pdf-download-mode');
        definirProcessamentoRelatorio(false);
        if (fallbackImpressao) {
            mostrarStatusRelatorio(
                'warning',
                'Use a opção “Salvar como PDF” da janela de impressão para concluir.'
            );
        }
    }
}
