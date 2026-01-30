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

        tbody.innerHTML += `
            <tr>
                <td>${ativ.inicio} às ${ativ.fim}</td>
                <td>${ativ.icone} ${ativ.tipo}</td>
                <td>${localTexto}</td>
                <td>${ativ.detalhe}</td>
                <td style="text-align:center;">${linkGPS}</td>
            </tr>
        `;
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
    }
}