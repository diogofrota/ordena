let statusFiltroAtualOperacoes = 'Ativa';

document.addEventListener('DOMContentLoaded', () => {
    renderizarOperacoes();
});

window.addEventListener('storage', (event) => {
    if (event.key === 'cadastrosOperacoes' || event.key === 'ordensServico') {
        renderizarOperacoes();
    }
});

function lerArrayStorage(chave) {
    try {
        const dados = JSON.parse(localStorage.getItem(chave));
        return Array.isArray(dados) ? dados : [];
    } catch (e) {
        console.error(`Falha ao ler ${chave}:`, e);
        return [];
    }
}

function normalizarNomeOperacao(nome) {
    if (typeof nome !== 'string') return '';
    return nome.trim().toUpperCase();
}

function parseDataHora(valor, aceitarApenasHora) {
    if (typeof valor !== 'string') return null;
    const texto = valor.trim();
    if (!texto) return null;

    if (aceitarApenasHora && /^\d{2}:\d{2}$/.test(texto)) {
        const [h, m] = texto.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        const agora = new Date();
        return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m, 0, 0);
    }

    if (!texto.includes('-')) return null;
    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) return null;
    return data;
}

function formatarDataHora(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return 'Não informado';

    if (/^\d{2}:\d{2}$/.test(valor.trim())) {
        return valor.trim();
    }

    const data = parseDataHora(valor, false);
    if (!data) return valor;
    return data.toLocaleString('pt-BR');
}

function separarDataEHora(valor, dataFallback) {
    if (typeof valor !== 'string' || !valor.trim()) {
        return { data: 'Não informada', hora: 'Não informada' };
    }

    const texto = valor.trim();
    if (/^\d{2}:\d{2}$/.test(texto)) {
        const fallback = parseDataHora(dataFallback, false);
        return {
            data: fallback ? fallback.toLocaleDateString('pt-BR') : 'Não informada',
            hora: texto
        };
    }

    const data = parseDataHora(texto, false);
    if (!data) {
        return { data: 'Não informada', hora: texto };
    }

    return {
        data: data.toLocaleDateString('pt-BR'),
        hora: data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
}

function obterStatusOperacao(operacao) {
    const fim = parseDataHora(operacao.fim, true);
    if (!fim) return 'Ativa';
    return fim.getTime() <= Date.now() ? 'Inativa' : 'Ativa';
}

function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obterNumeroOSNormalizado(os) {
    const numeroOs = Number(os && os.numero);
    if (Number.isFinite(numeroOs)) return String(numeroOs);
    if (os && os.numero != null && String(os.numero).trim()) {
        return String(os.numero).trim();
    }
    return '';
}

function mapearVinculosEmOS(apenasAtivas) {
    const mapa = {};
    const bancoOS = lerArrayStorage('ordensServico');

    bancoOS.forEach((os) => {
        if (apenasAtivas && os && os.status !== 'Ativa') return;
        if (!os || !Array.isArray(os.atividades)) return;

        os.atividades.forEach((atividade) => {
            const nomeOp = normalizarNomeOperacao(atividade && atividade.operacao);
            if (!nomeOp) return;

            if (!mapa[nomeOp]) {
                mapa[nomeOp] = {
                    ordens: new Set()
                };
            }

            const numeroNormalizado = obterNumeroOSNormalizado(os);
            if (numeroNormalizado) mapa[nomeOp].ordens.add(numeroNormalizado);
        });
    });

    return mapa;
}

function ordenarNumerosOS(conjunto) {
    return Array.from(conjunto || []).sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        const aEhNumero = Number.isFinite(numA);
        const bEhNumero = Number.isFinite(numB);
        if (aEhNumero && bEhNumero) return numA - numB;
        if (aEhNumero) return -1;
        if (bEhNumero) return 1;
        return String(a).localeCompare(String(b), 'pt-BR');
    });
}

function obterDataFimComparavel(operacao) {
    const fimTexto = typeof (operacao && operacao.fim) === 'string' ? operacao.fim.trim() : '';
    if (!fimTexto) return null;

    if (fimTexto.includes('-')) {
        return parseDataHora(fimTexto, false);
    }

    if (/^\d{2}:\d{2}$/.test(fimTexto)) {
        const base = parseDataHora(operacao && operacao.inicio, false) || parseDataHora(operacao && operacao.criadoEm, false);
        if (!base) return null;

        const [h, m] = fimTexto.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
    }

    return null;
}

function formatarDataHoraAlerta(data) {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) return 'Data/hora não informada';
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function construirAlertasOperacoesVencidas(operacoes, vinculosAtivos) {
    const agora = Date.now();
    const alertas = [];

    operacoes.forEach((op) => {
        const nome = normalizarNomeOperacao(op && op.nome);
        if (!nome) return;

        const resumoAtivo = vinculosAtivos[nome];
        const totalAtivas = resumoAtivo ? resumoAtivo.ordens.size : 0;
        if (!totalAtivas) return;

        const fimComparavel = obterDataFimComparavel(op);
        if (!fimComparavel) return;
        if (fimComparavel.getTime() > agora) return;

        const numerosAtivos = ordenarNumerosOS(resumoAtivo.ordens);
        alertas.push({
            nome,
            fim: fimComparavel,
            totalAtivas,
            numeros: numerosAtivos.join(', ')
        });
    });

    alertas.sort((a, b) => a.fim.getTime() - b.fim.getTime());
    return alertas;
}

function renderizarPainelAlertas(alertas) {
    const painel = document.getElementById('painelAlertasOperacoes');
    if (!painel) return;

    if (!Array.isArray(alertas) || alertas.length === 0) {
        painel.classList.remove('ativo');
        painel.innerHTML = '';
        return;
    }

    const limite = 5;
    const itens = alertas.slice(0, limite).map((item) => `
        <li>
            <strong>${escapeHtml(item.nome)}</strong>: término em ${escapeHtml(formatarDataHoraAlerta(item.fim))},
            vinculada em ${item.totalAtivas} OS ativas (${escapeHtml(item.numeros)}).
        </li>
    `).join('');
    const restante = alertas.length > limite
        ? `<li>... e mais ${alertas.length - limite} operação(ões).</li>`
        : '';

    painel.innerHTML = `
        <div class="alertas-titulo">
            Atenção: ${alertas.length} operação(ões) com prazo finalizado ainda vinculada(s) em OS ativas.
        </div>
        <ul class="alertas-lista">
            ${itens}
            ${restante}
        </ul>
    `;
    painel.classList.add('ativo');
}

function atualizarResumo(operacoes) {
    const total = operacoes.length;
    const ativas = operacoes.filter((op) => obterStatusOperacao(op) === 'Ativa').length;
    const inativas = total - ativas;

    document.getElementById('resumoTotal').innerText = total;
    document.getElementById('resumoAtivas').innerText = ativas;
    document.getElementById('resumoInativas').innerText = inativas;
}

function ordenarOperacoes(operacoes) {
    return operacoes.sort((a, b) => {
        const dataA = parseDataHora(a.fim, false) || parseDataHora(a.inicio, false) || parseDataHora(a.criadoEm, false) || new Date(0);
        const dataB = parseDataHora(b.fim, false) || parseDataHora(b.inicio, false) || parseDataHora(b.criadoEm, false) || new Date(0);
        return dataB.getTime() - dataA.getTime();
    });
}

function renderizarOperacoes() {
    const container = document.getElementById('listaOperacoes');
    const operacoes = lerArrayStorage('cadastrosOperacoes');
    const vinculos = mapearVinculosEmOS(false);
    const vinculosAtivos = mapearVinculosEmOS(true);
    const alertas = construirAlertasOperacoesVencidas(operacoes, vinculosAtivos);
    container.innerHTML = '';
    renderizarPainelAlertas(alertas);

    atualizarResumo(operacoes);

    const filtradas = operacoes.filter((op) => {
        const status = obterStatusOperacao(op);
        if (statusFiltroAtualOperacoes === 'Todas') return true;
        return status === statusFiltroAtualOperacoes;
    });

    ordenarOperacoes(filtradas);

    if (filtradas.length === 0) {
        const msg = statusFiltroAtualOperacoes === 'Todas'
            ? 'Nenhuma operação especial cadastrada.'
            : `Nenhuma operação ${statusFiltroAtualOperacoes.toLowerCase()} encontrada.`;
        container.innerHTML = `<div class="vazio-msg">${msg}</div>`;
        return;
    }

    filtradas.forEach((op) => {
        const nome = normalizarNomeOperacao(op.nome) || 'SEM NOME';
        const status = obterStatusOperacao(op);
        const classeStatus = status === 'Ativa' ? 'status-ativa' : 'status-inativa';
        const classeCard = status === 'Ativa' ? '' : 'inativa';
        const resumoVinculo = vinculos[nome] || { ordens: new Set() };
        const resumoVinculoAtivo = vinculosAtivos[nome] || { ordens: new Set() };
        const totalOrdens = resumoVinculo.ordens.size || 0;
        const totalOrdensAtivas = resumoVinculoAtivo.ordens.size || 0;
        const numerosOs = ordenarNumerosOS(resumoVinculo.ordens);
        const numerosOsAtivos = ordenarNumerosOS(resumoVinculoAtivo.ordens);
        const numerosTexto = numerosOs.length > 0 ? numerosOs.join(', ') : 'Nenhuma OS vinculada';
        const numerosAtivosTexto = numerosOsAtivos.length > 0 ? numerosOsAtivos.join(', ') : '-';
        const inicioInfo = separarDataEHora(op.inicio, op.criadoEm);
        const fimInfo = separarDataEHora(op.fim, op.criadoEm);
        const fimComparavel = obterDataFimComparavel(op);
        const operacaoFinalizadaEmUso = !!fimComparavel && fimComparavel.getTime() <= Date.now() && totalOrdensAtivas > 0;
        const classeAviso = operacaoFinalizadaEmUso ? ' com-alerta' : '';

        const card = document.createElement('div');
        card.className = `card-operacao ${classeCard}${classeAviso}`;
        card.innerHTML = `
            <div class="header-op">
                <div class="nome-op">${escapeHtml(nome)}</div>
                <div class="header-actions">
                    ${operacaoFinalizadaEmUso ? '<span class="status-pill status-warning">ALERTA</span>' : ''}
                    <span class="status-pill ${classeStatus}">${status}</span>
                    <button type="button" class="btn-expandir" onclick="alternarDetalhesOperacao(this)" aria-expanded="false" aria-label="Expandir detalhes da operação ${escapeHtml(nome)}">
                        <span class="seta-expansao">⌄</span>
                    </button>
                </div>
            </div>

            <div class="detalhes-op" hidden>
                ${operacaoFinalizadaEmUso ? `
                    <div class="alerta-op">
                        <strong>Aviso:</strong> operação com término em ${escapeHtml(formatarDataHoraAlerta(fimComparavel))}
                        ainda vinculada em <strong>${totalOrdensAtivas} OS ativas</strong> (${escapeHtml(numerosAtivosTexto)}).
                    </div>
                ` : ''}
                <div class="meta-criacao">Criada em: ${escapeHtml(formatarDataHora(op.criadoEm))}</div>

                <div class="descricao-op">
                    <strong>Descrição:</strong> ${escapeHtml(op.descricao ? op.descricao : 'Não informada.')}
                </div>

                <div class="meta-grid">
                    <div class="meta-item">
                        <span>Início Previsto</span>
                        <strong>Data: ${escapeHtml(inicioInfo.data)}</strong>
                        <span class="meta-secundaria">Hora: ${escapeHtml(inicioInfo.hora)}</span>
                    </div>
                    <div class="meta-item">
                        <span>Término Previsto</span>
                        <strong>Data: ${escapeHtml(fimInfo.data)}</strong>
                        <span class="meta-secundaria">Hora: ${escapeHtml(fimInfo.hora)}</span>
                    </div>
                    <div class="meta-item">
                        <span>Quantidade de OS</span>
                        <strong>${totalOrdens} OS</strong>
                    </div>
                    <div class="meta-item">
                        <span>Números das OS</span>
                        <strong>${escapeHtml(numerosTexto)}</strong>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function mudarFiltro(status) {
    statusFiltroAtualOperacoes = status;
    document.querySelectorAll('.filter-btn').forEach((botao) => botao.classList.remove('active'));
    const btn = document.getElementById(`btnFiltro${status}`);
    if (btn) btn.classList.add('active');
    renderizarOperacoes();
}

function alternarDetalhesOperacao(botao) {
    const card = botao.closest('.card-operacao');
    if (!card) return;

    const detalhes = card.querySelector('.detalhes-op');
    if (!detalhes) return;

    const estaAberto = !detalhes.hasAttribute('hidden');
    if (estaAberto) {
        detalhes.setAttribute('hidden', '');
        card.classList.remove('aberto');
        botao.setAttribute('aria-expanded', 'false');
        return;
    }

    detalhes.removeAttribute('hidden');
    card.classList.add('aberto');
    botao.setAttribute('aria-expanded', 'true');
}
