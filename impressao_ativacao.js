document.addEventListener('DOMContentLoaded', () => {
    const dados = JSON.parse(localStorage.getItem('ativacaoImpressaoTemp'));
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
const iconeMarcadorSemSombraAtivacao = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: null,
    shadowSize: null
});

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
        { label: 'Recurso', value: escala.recursoId || '-' },
        { label: 'OS Nº', value: escala.osNumero },
        { label: 'Missão', value: escala.osResumo?.nomeOS || os?.nomeOS || '-' },
        { label: 'Turno', value: `${escala.osResumo?.inicioGeral || os?.inicioGeral || '-'} às ${escala.osResumo?.terminoGeral || os?.terminoGeral || '-'}` },
        { label: 'Tipo de Serviço', value: escala.tipoServico || escala.osResumo?.tipoOrdem || os?.tipoOrdem || '-' },
        { label: 'Início da Ativação', value: dataIniTxt }
    ];

    container.innerHTML = itens.map(i => `
        <div class="grid-item">
            <strong>${i.label}</strong>
            <span>${i.value}</span>
        </div>
    `).join('');
}

function preencherEquipe(escala) {
    const tbody = document.getElementById('tabelaEquipe');
    tbody.innerHTML = '';
    (escala.equipe || []).forEach(m => {
        tbody.innerHTML += `
            <tr>
                <td>${m.funcao || '-'}</td>
                <td>${m.posto || '-'}</td>
                <td>${m.nome || '-'}</td>
                <td>${m.rg || '-'}</td>
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
        const detalheFinal = montarDetalhe(ativ);

        let linkGPS = "-";
        if (ativ.gps && ativ.gps.lat) {
            const lat = parseFloat(ativ.gps.lat);
            const lng = parseFloat(ativ.gps.lng);
            const urlMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            linkGPS = `<a href="${urlMaps}" target="_blank" style="text-decoration:none; background:#28a745; color:white; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:9px; display:inline-block;">IR 📍</a>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${ativ.inicio} às ${ativ.fim}</td>
                <td>${ativ.tipo}</td>
                <td><strong>${ativ.local || '-'}</strong><br>${endereco || '-'}</td>
                <td>${detalheFinal}</td>
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
    const recurso = `${escala.tipoRecurso || 'RECURSO'}_${escala.recursoId || 'ID'}`.replace(/\s+/g, '_');
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

    const cadOps = JSON.parse(localStorage.getItem('cadastrosOperacoes')) || [];

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
                    <span class="badge-tipo">${tipoTxt}</span>
                    <span class="card-title">${localTxt}</span>
                </div>
                <div class="card-meta">
                    <div><strong>Horário:</strong> ${horarioTxt}</div>
                    <div><strong>Endereço:</strong> ${enderecoLinhas.join(' - ') || '-'}</div>
                    ${detalheTxt && detalheTxt !== '-' ? `<div><strong>Detalhes:</strong> ${detalheTxt}</div>` : ''}
                </div>
                ${opNome ? `
                    <div class="card-op">
                        <div><strong>Operação:</strong> ${opNome}</div>
                        ${opInfo && opInfo.descricao ? `<div><strong>Descrição:</strong> ${opInfo.descricao}</div>` : ''}
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

            if ((a.tipo || '').toLowerCase().includes('patrulhamento') && a.gps.raio) {
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

function formatarDataHora(valor) {
    try {
        const d = new Date(valor);
        if (isNaN(d)) return valor;
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return valor;
    }
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
