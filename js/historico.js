let historicoRenderizadoPorChave = new Map();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('listaHistorico')?.addEventListener('click', tratarCliqueHistorico);
    carregarHistorico();
});

window.addEventListener('storage', evento => {
    if (evento.key === 'historicoEscalas' || evento.key === 'viaturas') {
        carregarHistorico();
    }
});

window.addEventListener('pageshow', evento => {
    if (evento.persisted) carregarHistorico();
});

function escaparHtmlHistorico(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function mostrarErroHistorico(mensagem) {
    const elemento = document.getElementById('feedbackHistorico');
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.className = 'page-feedback is-visible error';
    elemento.setAttribute('role', 'alert');
}

function limparFeedbackHistorico() {
    const elemento = document.getElementById('feedbackHistorico');
    if (!elemento) return;
    elemento.textContent = '';
    elemento.className = 'page-feedback';
    elemento.removeAttribute('role');
}

function lerListaLocalStorageHistorico(chave) {
    try {
        const valorSalvo = OrdenaStorage.getItem(chave);
        if (valorSalvo == null) return [];

        const valor = JSON.parse(valorSalvo);
        if (!Array.isArray(valor)) {
            throw new TypeError(`A chave ${chave} não contém uma lista.`);
        }
        return valor;
    } catch (erro) {
        console.error(`Erro ao carregar ${chave}:`, erro);
        mostrarErroHistorico('Não foi possível carregar o histórico. Atualize a página e tente novamente.');
        return null;
    }
}

function obterDataHistorico(valor) {
    if (!valor) return null;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
}

function registroHistoricoValido(item) {
    return !!item && typeof item === 'object' && !Array.isArray(item);
}

function obterDataBaixaHistorico(item) {
    return obterDataHistorico(item?.dataRegistroBaixa) || obterDataHistorico(item?.dataFim);
}

function obterHistoricoBaixado() {
    const historico = lerListaLocalStorageHistorico('historicoEscalas');
    if (historico === null) return null;

    return historico
        .filter(registroHistoricoValido)
        .sort((a, b) => {
            const dataBaixaA = obterDataBaixaHistorico(a)?.getTime()
                || obterDataHistorico(a.dataInicio)?.getTime()
                || 0;
            const dataBaixaB = obterDataBaixaHistorico(b)?.getTime()
                || obterDataHistorico(b.dataInicio)?.getTime()
                || 0;
            return dataBaixaB - dataBaixaA;
        });
}

function obterIdsRecursosHistorico(escala) {
    const api = window.ORDENA_STORAGE_NORMALIZER;
    if (api && typeof api.obterIdsRecursosEscala === 'function') {
        const idsApi = api.obterIdsRecursosEscala(escala);
        if (Array.isArray(idsApi)) return idsApi;
    }

    const idsInformados = Array.isArray(escala?.recursoIds)
        ? escala.recursoIds
        : [];
    const idsNormalizados = [...new Set(idsInformados
        .map(id => String(id ?? '').trim())
        .filter(Boolean))];

    if (idsNormalizados.length > 0) return idsNormalizados;

    const idLegado = String(escala?.recursoId || escala?.prefixo || '').trim();
    return idLegado ? [idLegado] : [];
}

function obterTextoRecursoHistorico(escala, placasPorPrefixo) {
    const tipoRecurso = String(escala?.tipoRecurso || '').toLowerCase();
    const recursoEhCabineOuSetor = tipoRecurso.includes('cabine') || tipoRecurso.includes('setor');
    const ids = obterIdsRecursosHistorico(escala);
    if (ids.length === 0) return '-';

    return ids.map(id => {
        const placa = placasPorPrefixo.get(id);
        return !recursoEhCabineOuSetor && placa ? `${id} (${placa})` : id;
    }).join(', ');
}

function obterEquipeHistorico(escala) {
    const equipe = Array.isArray(escala?.equipe)
        ? escala.equipe.filter(membro => membro && typeof membro === 'object')
        : [];
    const indiceComandanteEncontrado = equipe.findIndex(membro => {
        const funcao = String(membro?.funcao || '').trim().toLowerCase();
        return funcao === 'comandante' || funcao === 'cmd';
    });
    const indiceComandante = indiceComandanteEncontrado >= 0 ? indiceComandanteEncontrado : 0;

    return {
        comandante: equipe[indiceComandante] || { posto: '', nome: 'Comandante', tel: '' },
        auxiliares: equipe.filter((_, index) => index !== indiceComandante)
    };
}

function formatarDataHistorico(valor) {
    const data = obterDataHistorico(valor);
    return data ? data.toLocaleDateString('pt-BR') : '-';
}

function criarChaveRegistroHistorico(item, index) {
    const id = String(item?.id ?? '').trim();
    return `${id ? `id:${id}` : 'sem-id'}:${index}`;
}

function criarLinhaMensagemHistorico(mensagem, id = '') {
    const atributoId = id ? ` id="${escaparHtmlHistorico(id)}"` : '';
    return `
        <tr${atributoId} class="linha-mensagem">
            <td colspan="11" style="text-align:center; padding:20px; color:#666;">${escaparHtmlHistorico(mensagem)}</td>
        </tr>
    `;
}

function carregarHistorico() {
    limparFeedbackHistorico();

    const historico = obterHistoricoBaixado();
    const tbody = document.getElementById('listaHistorico');
    if (!tbody) return;

    tbody.innerHTML = '';
    historicoRenderizadoPorChave = new Map();

    if (historico === null) {
        tbody.innerHTML = criarLinhaMensagemHistorico('Não foi possível carregar os serviços baixados.');
        return;
    }

    if (historico.length === 0) {
        tbody.innerHTML = criarLinhaMensagemHistorico('Nenhum serviço baixado foi encontrado no histórico.');
        return;
    }

    const viaturas = lerListaLocalStorageHistorico('viaturas');
    const placasPorPrefixo = new Map(
        (viaturas || [])
            .filter(viatura => viatura && viatura.prefixo)
            .map(viatura => [String(viatura.prefixo), viatura.placa || ''])
    );

    const linhas = historico.map((item, index) => {
        const chaveRegistro = criarChaveRegistroHistorico(item, index);
        historicoRenderizadoPorChave.set(chaveRegistro, item);

        const { comandante, auxiliares } = obterEquipeHistorico(item);
        const nomeComandante = `${comandante.posto || ''} ${comandante.nome || comandante.nomeGuerra || ''}`.trim() || '-';
        const auxiliaresHtml = auxiliares.length > 0
            ? `<div class="auxiliares-lista">${auxiliares.map(membro => {
                const identificacao = `${membro.posto || ''} ${membro.nome || membro.nomeGuerra || ''}`.trim() || '-';
                return `<span class="auxiliar-item">${escaparHtmlHistorico(identificacao)}</span>`;
            }).join('')}</div>`
            : '-';

        const osResumo = item.osResumo || {};
        const dataAtivacao = item.dataAtivacao || formatarDataHistorico(item.dataInicio);
        const recurso = obterTextoRecursoHistorico(item, placasPorPrefixo);
        const osNumero = String(item.osNumero ?? '').trim() || '-';
        const tipoServico = item.tipoServico || osResumo.tipoOrdem || '-';
        const missao = osResumo.nomeOS || '-';
        const horaInicio = item.horaInicioServico || osResumo.inicioGeral || '-';
        const horaFim = item.horaFimServico || osResumo.terminoGeral || '-';
        const valorDataBaixa = obterDataBaixaHistorico(item);
        const dataBaixa = valorDataBaixa ? valorDataBaixa.toLocaleDateString('pt-BR') : '-';

        return `
            <tr data-registro-historico>
                <td data-label="Data">${escaparHtmlHistorico(dataAtivacao)}</td>
                <td data-label="Recurso"><strong>${escaparHtmlHistorico(recurso)}</strong></td>
                <td data-label="Comandante">${escaparHtmlHistorico(nomeComandante)}</td>
                <td data-label="Auxiliares">${auxiliaresHtml}</td>
                <td data-label="OS">${escaparHtmlHistorico(osNumero)}</td>
                <td data-label="Tipo">${escaparHtmlHistorico(tipoServico)}</td>
                <td data-label="Missão">${escaparHtmlHistorico(missao)}</td>
                <td data-label="Hora Início">${escaparHtmlHistorico(horaInicio)}</td>
                <td data-label="Hora Fim">${escaparHtmlHistorico(horaFim)}</td>
                <td data-label="Data da Baixa">
                    <div class="baixa-detalhes">
                        <strong>${escaparHtmlHistorico(dataBaixa)}</strong>
                    </div>
                </td>
                <td data-label="Ações">
                    <div class="acoes-inline">
                        <button
                            type="button"
                            class="btn-info"
                            data-acao="reimprimir-historico"
                            data-registro-chave="${escaparHtmlHistorico(chaveRegistro)}"
                            aria-label="Abrir PDF do serviço ${escaparHtmlHistorico(recurso)}"
                            title="Abrir PDF"
                        >PDF</button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = linhas.join('');
}

function tratarCliqueHistorico(evento) {
    const botao = evento.target.closest('button[data-acao="reimprimir-historico"]');
    if (!botao) return;
    reimprimirPDF(botao.dataset.registroChave);
}

function reimprimirPDF(chaveRegistro) {
    limparFeedbackHistorico();

    const escala = historicoRenderizadoPorChave.get(chaveRegistro);
    if (!escala) {
        mostrarErroHistorico('O serviço selecionado não está mais disponível. Atualize a página e tente novamente.');
        return;
    }

    const ordens = lerListaLocalStorageHistorico('ordensServico');
    if (ordens === null) return;
    const os = ordens.find(ordem => String(ordem?.numero) === String(escala.osNumero));

    try {
        OrdenaStorage.setItem('historicoImpressaoTemp', JSON.stringify({ escala, os }));
        const janelaRelatorio = window.open('impressao_historico.html', '_blank');
        if (!janelaRelatorio) {
            mostrarErroHistorico('O navegador bloqueou a abertura do PDF. Permita pop-ups para este site e tente novamente.');
        }
    } catch (erro) {
        console.error('Erro ao preparar relatório do histórico:', erro);
        mostrarErroHistorico('Não foi possível preparar o PDF deste serviço. Tente novamente.');
    }
}
