document.addEventListener('DOMContentLoaded', () => {
    const dados = JSON.parse(OrdenaStorage.getItem('ativacaoImpressaoTemp'));
    if (!dados || !dados.escala) {
        alert("Erro: Nenhuma ativação selecionada para impressão.");
        window.close();
        return;
    }

    const { escala, os } = dados;
    dadosAtivacaoAtual = dados;
    preencherResumo(escala, os);
    preencherEquipe(escala);
    preencherRoteiro(os);
    preencherPrescricoesERodape(escala, os);
    renderizarCardsPontosAtivacao(os);
});

let dadosAtivacaoAtual = null;
const mapasCardsAtivacao = [];

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

const iconeMarcadorSemSombraAtivacao = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: null,
    shadowSize: null
});

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

function aguardarCamadasMapa(mapa, timeoutMs = 1200) {
    return new Promise((resolve) => {
        let finalizado = false;
        let pendentes = 0;

        const finalizar = () => {
            if (finalizado) return;
            finalizado = true;
            resolve();
        };

        const timeout = setTimeout(finalizar, timeoutMs);

        const concluirSePronto = () => {
            if (finalizado) return;
            if (pendentes > 0) return;
            clearTimeout(timeout);
            requestAnimationFrame(() => requestAnimationFrame(finalizar));
        };

        mapa.eachLayer((layer) => {
            if (typeof layer.isLoading === 'function' && layer.isLoading()) {
                pendentes += 1;
                layer.once('load', () => {
                    pendentes = Math.max(0, pendentes - 1);
                    concluirSePronto();
                });
            }
        });

        concluirSePronto();
    });
}

function estabilizarMapasAntesPdf() {
    const aguardas = mapasCardsAtivacao.map((mapa) => {
        if (!mapa) return;
        try {
            if (typeof mapa.stop === 'function') mapa.stop();
            mapa.invalidateSize({ pan: false, debounceMoveend: true });
            const centro = mapa.getCenter();
            mapa.setView(centro, mapa.getZoom(), { animate: false });
            mapa.eachLayer((layer) => {
                if (typeof layer.redraw === 'function') {
                    layer.redraw();
                }
            });
            return aguardarCamadasMapa(mapa);
        } catch (e) {
            console.warn('Falha ao estabilizar mapa para PDF:', e);
            return Promise.resolve();
        }
    });
    return Promise.all(aguardas)
        .then(() => new Promise((resolve) => setTimeout(resolve, 180)));
}

function preencherResumo(escala, os) {
    const container = document.getElementById('resumoAtivacao');
    const dataIni = new Date(escala.dataInicio);
    const dataIniTxt = isNaN(dataIni) ? '-' : dataIni.toLocaleString('pt-BR');

    const itens = [
        { label: 'Recurso', value: formatarRecursosEscala(escala) },
        { label: 'OS Nº', value: escala.osNumero },
        { label: 'Missão', value: escala.osResumo?.nomeOS || os?.nomeOS || '-' },
        { label: 'Turno', value: `${escala.osResumo?.inicioGeral || os?.inicioGeral || '-'} às ${escala.osResumo?.terminoGeral || os?.terminoGeral || '-'}` },
        { label: 'Tipo de Serviço', value: escala.tipoServico || escala.osResumo?.tipoOrdem || os?.tipoOrdem || '-' },
        { label: 'Início da Ativação', value: dataIniTxt }
    ];

    container.innerHTML = itens.map(i => `
        <div class="grid-item">
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

function preencherPrescricoesERodape(escala, os) {
    const txtPrescricoes = document.getElementById('txtPrescricoesAtivacao');
    const criador = document.getElementById('criadorAtivacao');
    const dataImpressao = document.getElementById('dataImpressaoAtivacao');
    const status = document.getElementById('statusAtivacao');

    if (txtPrescricoes) {
        txtPrescricoes.innerText = (os && os.prescricoes) ? os.prescricoes : "Nenhuma observação adicional.";
    }

    if (criador) {
        criador.innerText = (os && os.criadoPor) ? os.criadoPor : "Coordenação Operacional";
    }

    if (dataImpressao) {
        const agora = new Date();
        dataImpressao.innerText = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR')}`;
    }

    if (status) {
        const ativa = !(escala && escala.dataFim);
        status.className = `status-badge ${ativa ? 'bg-ativa' : 'bg-inativa'}`;
        status.innerText = ativa ? 'ATIVA (VÁLIDA)' : 'INATIVA (ENCERRADA)';
    }
}

function montarNomeArquivoPdfAtivacao() {
    if (!dadosAtivacaoAtual || !dadosAtivacaoAtual.escala) return 'ATIVACAO.pdf';
    const escala = dadosAtivacaoAtual.escala;
    const osNumero = escala.osNumero || 'SEM_OS';
    const recursos = obterIdsRecursosEscala(escala).join('_') || 'ID';
    const recurso = `${escala.tipoRecurso || 'RECURSO'}_${recursos}`
        .replace(/[^A-Za-z0-9._-]+/g, '_');
    return `ATIVACAO_${osNumero}_${recurso}.pdf`;
}

function baixarPdfDireto() {
    const container = document.getElementById('pdfContainer');
    if (!container) {
        window.print();
        return;
    }

    if (typeof html2pdf === 'undefined') {
        alert('Biblioteca de PDF não carregada. Abrindo impressão padrão.');
        window.print();
        return;
    }

    const actions = document.querySelector('.no-print');
    const nomeArquivo = montarNomeArquivoPdfAtivacao();

    if (actions) actions.style.display = 'none';
    document.body.classList.add('pdf-download-mode');

    const options = {
        margin: [0, 0, 0, 0],
        filename: nomeArquivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: -window.scrollY },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: '.page-mapas', avoid: ['.card-ponto', '.card-map'] }
    };

    estabilizarMapasAntesPdf()
        .then(() => html2pdf().set(options).from(container).save())
        .catch((err) => {
            console.error(err);
            alert('Falha ao gerar PDF automaticamente. Abrindo impressão padrão.');
            window.print();
        })
        .finally(() => {
            document.body.classList.remove('pdf-download-mode');
            if (actions) actions.style.display = '';
        });
}

function renderizarCardsPontosAtivacao(os) {
    const container = document.getElementById('cardsPontosAtivacao');
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
        const mapId = `mapCardAtiv-${idx}`;
        const tipoTxt = (a.tipo || '').toUpperCase();
        const localTxt = a.local || '-';

        const enderecoLinhas = [];
        const ender = montarEndereco(a);
        if (ender && ender !== '-') enderecoLinhas.push(ender);

        let opNome = a.operacao ? a.operacao.toUpperCase() : extrairOperacao(montarDetalhe(a));
        let opInfo = null;
        if (opNome) {
            opInfo = cadOps.find(op => op.nome === opNome) || null;
        }

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
                    <div><strong>Endereço:</strong> ${escaparHtml(enderecoLinhas.join(' - ') || '-')}</div>
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
            const mapId = `mapCardAtiv-${idx}`;
            const lat = parseFloat(a.gps.lat);
            const lng = parseFloat(a.gps.lng);
            if (isNaN(lat) || isNaN(lng)) return;

            const m = L.map(mapId, {
                zoomControl: false,
                attributionControl: false,
                preferCanvas: true,
                zoomAnimation: false,
                fadeAnimation: false,
                markerZoomAnimation: false
            })
                .setView([lat, lng], 15);
            mapasCardsAtivacao.push(m);
            m.invalidateSize({ pan: false, debounceMoveend: true });

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
                L.marker([lat, lng], { icon: iconeMarcadorSemSombraAtivacao }).addTo(m);
                m.fitBounds(polygon.getBounds(), { padding: [10, 10], animate: false });
            } else if (ehPatrulhamento && a.gps.raio) {
                const raio = parseFloat(a.gps.raio);
                const circle = L.circle([lat, lng], {
                    radius: isNaN(raio) ? 100 : raio,
                    color: '#d32f2f',
                    fillColor: '#f44336',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(m);
                L.marker([lat, lng], { icon: iconeMarcadorSemSombraAtivacao }).addTo(m);
                m.fitBounds(circle.getBounds(), { padding: [10, 10], animate: false });
            } else {
                L.marker([lat, lng], { icon: iconeMarcadorSemSombraAtivacao }).addTo(m);
            }
        });
    }, 120);
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
