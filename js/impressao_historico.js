document.addEventListener('DOMContentLoaded', () => {
    const dados = JSON.parse(OrdenaStorage.getItem('historicoImpressaoTemp'));
    if (!dados || !dados.escala) {
        alert("Erro: Nenhum histórico selecionado para impressão.");
        window.close();
        return;
    }

    const { escala, os } = dados;
    preencherResumo(escala, os);
    preencherEquipe(escala);
    preencherRoteiro(os);
    preencherPrescricoes(os);
    renderizarCardsPontos(os);
    renderizarCardsConferencia(os);
});

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obterIdsRecursosEscala(escala) {
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

function formatarRecursosEscala(escala) {
    const ids = obterIdsRecursosEscala(escala);
    return ids.length > 0 ? ids.join(', ') : '-';
}

function deveExibirColunaMotoEquipe(escala) {
    // A atribuição individual de moto só existe quando a própria guarnição usa motos.
    // O campo legado tipoPoliciamento mantém a impressão correta de ativações antigas.
    const tipoRecurso = String(escala?.tipoRecurso || escala?.tipoPoliciamento || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    return /^(?:moto|motocicleta)s?$/.test(tipoRecurso.trim());
}

function configurarColunaMotoEquipe(escala) {
    const exibirColuna = deveExibirColunaMotoEquipe(escala);

    document.querySelectorAll('[data-coluna-moto-equipe]').forEach(coluna => {
        coluna.hidden = !exibirColuna;
    });

    return exibirColuna;
}

function obterDataBaixa(escala) {
    const valores = [escala?.dataRegistroBaixa, escala?.dataFim];
    for (const valor of valores) {
        if (!valor) continue;
        const data = new Date(valor);
        if (!Number.isNaN(data.getTime())) return data;
    }
    return null;
}

function formatarDataHoraBaixa(escala) {
    const data = obterDataBaixa(escala);
    return data
        ? `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : '-';
}

function obterResponsavelBaixa(escala) {
    const responsavel = String(escala?.responsavelBaixa || '').trim();
    if (responsavel) return responsavel;
    return escala?.baixaAutomatica === true ? 'SISTEMA' : '-';
}

function normalizarPoligonoGps(valor) {
    if (!Array.isArray(valor)) return [];

    const pontos = valor.map((ponto) => {
        const latOriginal = Array.isArray(ponto) ? ponto[0] : ponto?.lat;
        const lngOriginal = Array.isArray(ponto) ? ponto[1] : ponto?.lng;
        if (latOriginal == null || lngOriginal == null || latOriginal === '' || lngOriginal === '') return null;

        const lat = Number(latOriginal);
        const lng = Number(lngOriginal);
        return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
            ? [lat, lng]
            : null;
    }).filter(Boolean);

    if (pontos.length >= 2) {
        const primeiro = pontos[0];
        const ultimo = pontos[pontos.length - 1];
        if (primeiro[0] === ultimo[0] && primeiro[1] === ultimo[1]) pontos.pop();
    }

    const pontosUnicos = new Set(pontos.map(([lat, lng]) => `${lat}|${lng}`));
    return pontosUnicos.size >= 3 ? pontos : [];
}

function preencherResumo(escala, os) {
    const container = document.getElementById('resumoHistorico');
    const dataIni = new Date(escala.dataInicio);
    const dataFim = escala.dataFim ? new Date(escala.dataFim) : null;
    const dataIniTxt = isNaN(dataIni) ? '-' : dataIni.toLocaleString('pt-BR');
    const dataFimTxt = dataFim && !isNaN(dataFim) ? dataFim.toLocaleString('pt-BR') : '-';

    const itens = [
        { label: 'Recurso', value: formatarRecursosEscala(escala) },
        { label: 'OS Nº', value: escala.osNumero },
        { label: 'Missão', value: escala.osResumo?.nomeOS || os?.nomeOS || '-' },
        { label: 'Turno', value: `${escala.osResumo?.inicioGeral || os?.inicioGeral || '-'} às ${escala.osResumo?.terminoGeral || os?.terminoGeral || '-'}` },
        { label: 'Tipo de Serviço', value: escala.tipoServico || escala.osResumo?.tipoOrdem || os?.tipoOrdem || '-', fullWidth: true },
        { label: 'Início da Ativação', value: dataIniTxt },
        { label: 'Término da Ativação', value: dataFimTxt },
        { label: 'Baixa registrada em', value: formatarDataHoraBaixa(escala) },
        { label: 'Baixa realizada por', value: obterResponsavelBaixa(escala) }
    ];

    container.innerHTML = itens.map(i => `
        <div class="grid-item${i.fullWidth ? ' grid-item-full' : ''}">
            <strong>${escaparHtml(i.label)}</strong>
            <span>${escaparHtml(i.value)}</span>
        </div>
    `).join('');
}

function preencherEquipe(escala) {
    const tbody = document.getElementById('tabelaEquipe');
    const exibirColunaMoto = configurarColunaMotoEquipe(escala);
    tbody.innerHTML = '';
    (escala.equipe || []).forEach(m => {
        tbody.innerHTML += `
            <tr>
                <td>${escaparHtml(m.funcao || '-')}</td>
                <td>${escaparHtml(m.posto || '-')}</td>
                <td>${escaparHtml(m.nome || '-')}</td>
                <td>${escaparHtml(m.rg || '-')}</td>
                ${exibirColunaMoto ? `<td>${escaparHtml(m.motoPrefixo || '-')}</td>` : ''}
            </tr>
        `;
    });
}

function preencherRoteiro(os) {
    const tbody = document.getElementById('tabelaOS');
    tbody.innerHTML = '';
    if (!os || !os.atividades) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">OS não encontrada no sistema.</td></tr>';
        return;
    }

    os.atividades.forEach(ativ => {
        const endereco = montarEndereco(ativ);
        const operacao = String(
            ativ.operacao || extrairOperacao(ativ.detalhe || ativ.detalhes || '')
        ).trim();
        const operacaoTexto = operacao ? escaparHtml(operacao) : '-';

        let linkGPS = "-";
        if (ativ.gps && ativ.gps.lat) {
            const lat = parseFloat(ativ.gps.lat);
            const lng = parseFloat(ativ.gps.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                const urlMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                linkGPS = `<a href="${urlMaps}" target="_blank" rel="noopener" style="text-decoration:none; background:#28a745; color:white; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:9px; display:inline-block;">IR</a>`;
            }
        }

        tbody.innerHTML += `
            <tr>
                <td>${escaparHtml(ativ.inicio)} às ${escaparHtml(ativ.fim)}</td>
                <td>${escaparHtml(ativ.tipo)}</td>
                <td><strong>${escaparHtml(ativ.local || '-')}</strong><br>${escaparHtml(endereco || '-')}</td>
                <td>${operacaoTexto}</td>
                <td style="text-align:center;">${linkGPS}</td>
            </tr>
        `;
    });
}

function preencherPrescricoes(os) {
    const txtPrescricoes = document.getElementById('txtPrescricoesHistorico');
    if (!txtPrescricoes) return;

    txtPrescricoes.innerText = (os && os.prescricoes)
        ? os.prescricoes
        : "Nenhuma observação adicional.";
}

function renderizarCardsPontos(os) {
    const container = document.getElementById('cardsPontosHistorico');
    if (!container) return;

    if (!os || !os.atividades) {
        container.innerHTML = '<div style="font-size:11px; color:#777;">OS não encontrada para gerar cards.</div>';
        return;
    }

    const cadOps = JSON.parse(OrdenaStorage.getItem('cadastrosOperacoes')) || [];

    const atividades = os.atividades.filter(a => {
        if (!a || !a.gps) return false;
        const tipo = (a.tipo || '').toLowerCase();
        return tipo.includes('baseamento') || tipo.includes('patrulhamento');
    });

    if (atividades.length === 0) {
        container.innerHTML = '<div style="font-size:11px; color:#777;">Nenhum ponto com GPS para Baseamento/Patrulhamento.</div>';
        return;
    }

    container.innerHTML = '';

    atividades.forEach((a, idx) => {
        const mapId = `mapCardHist-${idx}`;
        const tipoTxt = (a.tipo || '').toUpperCase();
        const localTxt = a.local || '-';

        const ender = montarEndereco(a);
        const opNome = a.operacao ? a.operacao.toUpperCase() : extrairOperacao(montarDetalhe(a));
        const opInfo = opNome ? cadOps.find(op => op.nome === opNome) || null : null;

        const horarioTxt = (a.inicio && a.fim) ? `${a.inicio} às ${a.fim}` : '-';
        const detalheTxt = montarDetalhe(a);

        container.innerHTML += `
            <div class="card-ponto">
                <div class="card-header">
                    <span class="badge-tipo">${escaparHtml(tipoTxt)}</span>
                    <span class="card-title">${escaparHtml(localTxt)}</span>
                </div>
                <div class="card-meta">
                    <div><strong>Horário:</strong> ${escaparHtml(horarioTxt)}</div>
                    <div><strong>Endereço:</strong> ${escaparHtml(ender || '-')}</div>
                    ${detalheTxt && detalheTxt !== '-' ? `<div><strong>Detalhes:</strong> ${escaparHtml(detalheTxt)}</div>` : ''}
                </div>
                ${opNome ? `
                    <div class="card-op">
                        <div><strong>Operação:</strong> ${escaparHtml(opNome)}</div>
                        ${opInfo && opInfo.descricao ? `<div><strong>Descrição:</strong> ${escaparHtml(opInfo.descricao)}</div>` : ''}
                    </div>
                ` : ''}
                <div id="${mapId}" class="card-map"></div>
            </div>
        `;
    });

    setTimeout(() => {
        atividades.forEach((a, idx) => {
            const mapId = `mapCardHist-${idx}`;
            const lat = parseFloat(a.gps.lat);
            const lng = parseFloat(a.gps.lng);
            if (isNaN(lat) || isNaN(lng)) return;

            const m = L.map(mapId, { zoomControl: false, attributionControl: false })
                .setView([lat, lng], 15);

            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© SGF Mapas'
            }).addTo(m);

            const ehPatrulhamento = (a.tipo || '').toLowerCase().includes('patrulhamento');
            const poligono = ehPatrulhamento ? normalizarPoligonoGps(a.gps.poligono) : [];

            if (poligono.length >= 3) {
                const polygon = L.polygon(poligono, {
                    color: '#d32f2f',
                    fillColor: '#f44336',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(m);
                L.marker([lat, lng]).addTo(m);
                m.fitBounds(polygon.getBounds(), { padding: [10, 10] });
            } else if (ehPatrulhamento && a.gps.raio) {
                const raio = parseFloat(a.gps.raio);
                const circle = L.circle([lat, lng], {
                    radius: isNaN(raio) ? 100 : raio,
                    color: '#d32f2f',
                    fillColor: '#f44336',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(m);
                L.marker([lat, lng]).addTo(m);
                m.fitBounds(circle.getBounds(), { padding: [10, 10] });
            } else {
                L.marker([lat, lng]).addTo(m);
            }
        });
    }, 120);
}

function renderizarCardsConferencia(os) {
    const container = document.getElementById('cardsConferenciaHistorico');
    if (!container) return;

    if (!os || !os.atividades) {
        container.innerHTML = '<div style="font-size:11px; color:#777;">OS não encontrada para gerar conferência.</div>';
        return;
    }

    const atividades = os.atividades.filter(a => {
        const tipo = (a.tipo || '').toLowerCase();
        return tipo.includes('baseamento') || tipo.includes('patrulhamento');
    });

    if (atividades.length === 0) {
        container.innerHTML = '<div style="font-size:11px; color:#777;">Nenhum ponto de Baseamento/Patrulhamento para conferência.</div>';
        return;
    }

    container.innerHTML = '';

    atividades.forEach(a => {
        const horarioTxt = (a.inicio && a.fim) ? `${a.inicio} às ${a.fim}` : '-';
        const endereco = montarEndereco(a);
        const detalhe = montarDetalhe(a);

        container.innerHTML += `
            <div class="card-conf">
                <div class="conf-header">
                    <span class="badge-tipo">${escaparHtml((a.tipo || '').toUpperCase())}</span>
                    <span class="conf-badge">100% CONFORME (EXEMPLO)</span>
                </div>
                <div class="conf-meta">
                    <div><strong>Local:</strong> ${escaparHtml(a.local || '-')}</div>
                    <div><strong>Horário Planejado:</strong> ${escaparHtml(horarioTxt)}</div>
                    <div><strong>Endereço:</strong> ${escaparHtml(endereco)}</div>
                    ${detalhe && detalhe !== '-' ? `<div><strong>Detalhes:</strong> ${escaparHtml(detalhe)}</div>` : ''}
                </div>
                <div class="conf-note">* Exemplo ilustrativo. Futuramente a conferência será feita via GPS x planejamento.</div>
            </div>
        `;
    });
}

function extrairOperacao(texto) {
    const m = texto.match(/\[OP:\s*([^\]]+)\]/i);
    return m ? m[1].trim().toUpperCase() : '';
}

function montarEndereco(ativ) {
    const parts = [];
    if (ativ.rua && ativ.rua !== '-') {
        const numero = (ativ.numero && ativ.numero !== '-') ? `, ${ativ.numero}` : '';
        parts.push(`${ativ.rua}${numero}`);
    }
    if (ativ.bairro && ativ.bairro !== '-') parts.push(ativ.bairro);
    if (ativ.cidade && ativ.cidade !== '-') parts.push(ativ.cidade);
    return parts.join(' - ') || '-';
}

function montarDetalhe(ativ) {
    const base = (ativ.detalhes && ativ.detalhes !== '-') ? ativ.detalhes : '';
    if (ativ.operacao) {
        return `[OP: ${ativ.operacao}] ${base}`.trim();
    }
    return base || '-';
}
