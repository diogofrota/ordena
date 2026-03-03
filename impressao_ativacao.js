document.addEventListener('DOMContentLoaded', () => {
    const dados = JSON.parse(localStorage.getItem('ativacaoImpressaoTemp'));
    if (!dados || !dados.escala) {
        alert("Erro: Nenhuma ativação selecionada para impressão.");
        window.close();
        return;
    }

    const { escala, os } = dados;
    preencherResumo(escala, os);
    preencherEquipe(escala);
    preencherRoteiro(os);
    renderizarMapa(os);
    renderizarCardsPontosAtivacao(os);
});

function preencherResumo(escala, os) {
    const container = document.getElementById('resumoAtivacao');
    const dataIni = new Date(escala.dataInicio);
    const dataIniTxt = isNaN(dataIni) ? '-' : dataIni.toLocaleString('pt-BR');

    const itens = [
        { label: 'Recurso', value: `${escala.tipoRecurso} ${escala.recursoId}` },
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

function renderizarMapa(os) {
    if (!os || !os.atividades) return;
    const mapEl = document.getElementById('mapAtivacao');
    if (!mapEl) return;

    const map = L.map('mapAtivacao', { zoomControl: false }).setView([-22.9068, -43.1729], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© SGF Mapas'
    }).addTo(map);

    const bounds = [];

    os.atividades.forEach(ativ => {
        if (!ativ.gps || !ativ.gps.lat) return;
        const lat = parseFloat(ativ.gps.lat);
        const lng = parseFloat(ativ.gps.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        const ponto = [lat, lng];
        bounds.push(ponto);

        if ((ativ.tipo || '').toLowerCase().includes('patrulhamento') && ativ.gps.raio) {
            const raio = parseFloat(ativ.gps.raio) || 100;
            L.circle(ponto, {
                radius: raio,
                color: '#d32f2f',
                fillColor: '#f44336',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(map);
        }

        L.marker(ponto).addTo(map)
            .bindPopup(`<b>${ativ.tipo}</b><br>${ativ.local || ''}`);
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
    }
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
                        ${opInfo && opInfo.inicio ? `<div><strong>Início:</strong> ${formatarDataHora(opInfo.inicio)}</div>` : ''}
                        ${opInfo && opInfo.fim ? `<div><strong>Término:</strong> ${formatarDataHora(opInfo.fim)}</div>` : ''}
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

            const m = L.map(mapId, { zoomControl: false, attributionControl: false })
                .setView([lat, lng], 15);

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
                L.marker([lat, lng]).addTo(m);
                m.fitBounds(circle.getBounds(), { padding: [10, 10] });
            } else {
                L.marker([lat, lng]).addTo(m);
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
