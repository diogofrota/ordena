document.addEventListener('DOMContentLoaded', () => {
    carregarDadosImpressao();
});

function carregarDadosImpressao() {
    const dados = JSON.parse(localStorage.getItem('osImpressaoTemp'));

    if (!dados) {
        alert("Erro: Nenhuma OS selecionada para impressão.");
        window.close();
        return;
    }

    // --- CABEÇALHO ---
    document.getElementById('numOS').innerText = dados.numero;
    document.getElementById('missaoOS').innerText = dados.nomeOS;
    document.getElementById('recursoOS').innerText = dados.tipoRecurso;
    document.getElementById('inicioOS').innerText = dados.inicioGeral;
    document.getElementById('terminoOS').innerText = dados.terminoGeral;
    
    const criador = dados.criadoPor || "Coordenação Operacional";
    document.getElementById('criadorOS').innerText = criador;
    document.getElementById('txtPrescricoes').innerText = dados.prescricoes || "Nenhuma observação adicional.";

    // --- RODAPÉ: DATA E STATUS ---
    const dataHoje = new Date();
    const dataFormatada = dataHoje.toLocaleDateString('pt-BR') + ' às ' + dataHoje.toLocaleTimeString('pt-BR');
    document.getElementById('dataImpressao').innerText = dataFormatada;

    const elStatus = document.getElementById('statusOS');
    elStatus.innerText = dados.status.toUpperCase();
    if (dados.status === 'Ativa') {
        elStatus.className = "status-badge bg-ativa";
        elStatus.innerText += " (VÁLIDA)";
    } else {
        elStatus.className = "status-badge bg-inativa";
        elStatus.innerText += " (ENCERRADA)";
    }

    // --- MAPA ---
    const map = L.map('mapImpressao', { zoomControl: false }).setView([-22.9068, -43.1729], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© SGF Mapas'
    }).addTo(map);

    const bounds = []; 
    const tbody = document.getElementById('tabelaAtividades');

    // --- LOOP NAS ATIVIDADES ---
    dados.atividades.forEach(ativ => {
        let linkGPS = "-";
        
        // --- MONTAGEM DO ENDEREÇO COMPLETO PARA IMPRESSÃO ---
        // Ex: Base 1 <br> Rua dos Inválidos, 172 - Centro - Rio de Janeiro
        
        let localTexto = `<b>${ativ.local}</b>`; 
        
        if (ativ.logradouro && ativ.logradouro !== "-") {
            localTexto += `<br>${ativ.logradouro}`;
        }
        
        if (ativ.bairro && ativ.bairro !== "-") {
            localTexto += ` - ${ativ.bairro}`;
        }
        
        if (ativ.cidade && ativ.cidade !== "-") {
            localTexto += ` - ${ativ.cidade}`;
        }
        // -----------------------------------------------------

        // Se tiver coordenadas salvas
        if (ativ.gps && ativ.gps.lat) {
            const lat = parseFloat(ativ.gps.lat);
            const lng = parseFloat(ativ.gps.lng);
            const ponto = [lat, lng];
            bounds.push(ponto);

            const urlMaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            linkGPS = `<a href="${urlMaps}" target="_blank" class="btn-gps">IR 📍</a>`;

            if (ativ.tipo === 'Patrulhamento') {
                const raio = ativ.gps.raio ? parseFloat(ativ.gps.raio) : 100;
                L.circle(ponto, { 
                    radius: raio, 
                    color: '#d32f2f',       
                    fillColor: '#f44336',   
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(map);

                L.marker(ponto).addTo(map)
                    .bindPopup(`<b>${ativ.tipo}</b><br>${ativ.local}`);
            
            } else if (ativ.tipo === 'Baseamento') {
                L.marker(ponto).addTo(map)
                    .bindPopup(`<b>${ativ.tipo}</b><br>${ativ.local}`);
            }
        }

        const temEndereco = (ativ.logradouro && ativ.logradouro !== "-") ||
            (ativ.bairro && ativ.bairro !== "-") ||
            (ativ.cidade && ativ.cidade !== "-");
        const rowClass = temEndereco ? '' : 'row-compact';

        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td><div class="td-wrap">${ativ.inicio} às ${ativ.fim}</div></td>
                <td><div class="td-wrap">${ativ.icone} ${ativ.tipo}</div></td>
                <td><div class="td-wrap">${localTexto}</div></td>
                <td><div class="td-wrap">${ativ.detalhe}</div></td>
                <td style="text-align:center;"><div class="td-wrap">${linkGPS}</div></td>
            </tr>
        `;
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
    }

    renderizarCardsPontos(dados);
}

function renderizarCardsPontos(dados) {
    const container = document.getElementById('cardsPontos');
    if (!container) return;

    const cadOps = JSON.parse(localStorage.getItem('cadastrosOperacoes')) || [];

    const atividades = (dados.atividades || []).filter(a => {
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
        const mapId = `mapCard-${idx}`;
        const tipoTxt = (a.tipo || '').toUpperCase();
        const localTxt = a.local || '-';

        const enderecoLinhas = [];
        if (a.logradouro && a.logradouro !== '-') enderecoLinhas.push(a.logradouro);
        if (a.bairro && a.bairro !== '-') enderecoLinhas.push(a.bairro);
        if (a.cidade && a.cidade !== '-') enderecoLinhas.push(a.cidade);

        let opNome = extrairOperacao(a.detalhe || '');
        let opInfo = null;
        if (opNome) {
            opInfo = cadOps.find(op => op.nome === opNome) || null;
        }

        const horarioTxt = (a.inicio && a.fim) ? `${a.inicio} às ${a.fim}` : '-';
        const detalheTxt = a.detalhe && a.detalhe !== '-' ? a.detalhe : '';

        container.innerHTML += `
            <div class="card-ponto">
                <div class="card-header">
                    <span class="badge-tipo">${tipoTxt}</span>
                    <span class="card-title">${localTxt}</span>
                </div>
                <div class="card-meta">
                    <div><strong>Horário:</strong> ${horarioTxt}</div>
                    <div><strong>Endereço:</strong> ${enderecoLinhas.join(' - ') || '-'}</div>
                    ${detalheTxt ? `<div><strong>Detalhes:</strong> ${detalheTxt}</div>` : ''}
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

    // Inicializa mapas após o HTML estar no DOM
    setTimeout(() => {
        atividades.forEach((a, idx) => {
            const mapId = `mapCard-${idx}`;
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
