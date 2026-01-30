/**
 * GESTÃO DE ORDENS ESPECIAIS (GRID SÓLIDO + TABELA LIMPA)
 */

let eventoAtual = { nome: '', inicio: '', termino: '', subOrdens: [] };
let indiceEdicaoAtual = -1;
let idEventoParaEncerrar = null;
let idEdicaoGlobal = null; 

document.addEventListener('DOMContentLoaded', () => {
    migrarBancoEspeciais();
    carregarEventosAtivos(); 
    carregarSugestoesLocais(); 
});

// --- LISTAGEM ---
function carregarEventosAtivos() {
    const container = document.getElementById('listaEventosAtivos');
    const banco = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    container.innerHTML = '';

    const ativas = banco.filter(e => e.status === 'Ativa');

    if (ativas.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#666; padding: 20px;">Nenhuma operação especial em andamento.</p>';
        return;
    }

    ativas.sort((a,b) => b.id - a.id).forEach(evento => {
        const dataIni = new Date(evento.inicio).toLocaleString('pt-BR');
        const dataFim = new Date(evento.termino).toLocaleString('pt-BR');
        
        const totalOS = evento.subOrdens.length;
        let concluidas = 0;
        const counts = { Viatura: 0, Moto: 0, Cabine: 0, Setor: 0 };
        
        evento.subOrdens.forEach(os => {
            if(counts[os.tipo] !== undefined) counts[os.tipo]++;
            else counts[os.tipo] = 1;
            if (os.statusEdicao === 'ok') concluidas++;
        });

        const porcentagem = totalOS > 0 ? Math.round((concluidas / totalOS) * 100) : 0;

        const card = document.createElement('div');
        card.className = 'card-evento';
        card.innerHTML = `
            <div class="header-evento">
                <div><span style="font-size:0.85rem; color:#999;">OE-${evento.id}</span><br><span class="titulo-evento">${evento.nome}</span></div>
                <div class="badges-container">
                    <span class="status-pill status-blue">${porcentagem}% PLANEJADO</span>
                    <span class="status-pill status-ativa">EM ANDAMENTO</span>
                </div>
            </div>
            <div style="font-size:0.9rem; color:#444; margin-bottom:10px;"><strong>Início:</strong> ${dataIni}  |  <strong>Término:</strong> ${dataFim}</div>
            <div class="recursos-grid">
                <div class="recurso-item"><span class="recurso-num">${counts.Viatura}</span><span class="recurso-label">Vtr</span></div>
                <div class="recurso-item"><span class="recurso-num">${counts.Moto}</span><span class="recurso-label">Motos</span></div>
                <div class="recurso-item"><span class="recurso-num">${counts.Cabine}</span><span class="recurso-label">Cabines</span></div>
                <div class="recurso-item"><span class="recurso-num">${counts.Setor}</span><span class="recurso-label">Setores</span></div>
            </div>
            <div style="margin-top:15px; display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn-warning" style="padding:8px 15px; font-weight:bold;" onclick="editarEvento(${evento.id})">✏️ Atualizar / Planejar</button>
                <button class="btn-danger" style="padding:8px 15px;" onclick="abrirModalEncerrar(${evento.id})">Encerrar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- FLUXO PRINCIPAL ---
function editarEvento(id) {
    const banco = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    const evento = banco.find(e => e.id === id);
    if(!evento) return;

    idEdicaoGlobal = id;
    eventoAtual = JSON.parse(JSON.stringify(evento));

    document.getElementById('nomeEvento').value = eventoAtual.nome;
    document.getElementById('inicioEvento').value = eventoAtual.inicio;
    document.getElementById('terminoEvento').value = eventoAtual.termino;

    document.getElementById('tituloCriacao').innerText = `Editando: ${eventoAtual.nome} (OE-${id})`;
    document.getElementById('containerCriacao').style.display = 'block';
    document.getElementById('listaEventosAtivos').style.display = 'none';
    document.getElementById('btnNovoEvento').style.display = 'none';

    configurarCard(1, 'concluido');
    configurarCard(2, 'ativo'); 
    renderizarListaSubOS();
}

function iniciarNovoEvento() {
    idEdicaoGlobal = null;
    document.getElementById('tituloCriacao').innerText = "Criando Nova Operação";
    document.getElementById('containerCriacao').style.display = 'block';
    document.getElementById('listaEventosAtivos').style.display = 'none';
    document.getElementById('btnNovoEvento').style.display = 'none';
    resetarFluxoCriacao();
}

function cancelarCriacaoEvento() {
    document.getElementById('containerCriacao').style.display = 'none';
    document.getElementById('listaEventosAtivos').style.display = 'block';
    document.getElementById('btnNovoEvento').style.display = 'block';
}

function resetarFluxoCriacao() {
    document.getElementById('nomeEvento').value = '';
    document.getElementById('inicioEvento').value = '';
    document.getElementById('terminoEvento').value = '';
    eventoAtual = { subOrdens: [] };
    configurarCard(1, 'ativo');
    configurarCard(2, 'oculto');
}

function configurarCard(n, estado) {
    const card = document.getElementById(`cardPasso${n}`);
    const inputs = card.querySelectorAll('input, select');
    const btns = document.getElementById(`btnsPasso${n}`);
    card.classList.remove('step-ativo', 'step-concluido', 'step-hidden');
    if(estado==='ativo'){ card.classList.add('step-ativo'); inputs.forEach(i=>i.disabled=false); if(btns) btns.style.display='flex'; }
    else if(estado==='concluido'){ card.classList.add('step-concluido'); inputs.forEach(i=>i.disabled=true); if(btns) btns.style.display='none'; }
    else { card.classList.add('step-hidden'); }
}

function avancarParaPasso2() {
    if(!document.getElementById('nomeEvento').value) return alert("Preencha o nome.");
    eventoAtual.nome = document.getElementById('nomeEvento').value;
    eventoAtual.inicio = document.getElementById('inicioEvento').value;
    eventoAtual.termino = document.getElementById('terminoEvento').value;
    configurarCard(1, 'concluido');
    configurarCard(2, 'ativo');
    renderizarListaSubOS();
}

function voltarParaPasso1() {
    document.getElementById('editorOS').style.display='none';
    configurarCard(2, 'oculto');
    configurarCard(1, 'ativo');
}

// --- GRID E RECURSOS ---
function adicionarRecurso(tipo) {
    const maiorSeq = eventoAtual.subOrdens.reduce((max, os) => os.seq > max ? os.seq : max, 0);
    const novoSeq = maiorSeq + 1;
    eventoAtual.subOrdens.push({
        seq: novoSeq,
        tipo: tipo,
        nomeEspecifico: '', 
        atividades: [],
        statusEdicao: 'pendente'
    });
    renderizarListaSubOS();
}

function removerOS(indexReal, event) {
    if(event) event.stopPropagation();
    if(!confirm("Remover esta Ordem?")) return;
    eventoAtual.subOrdens.splice(indexReal, 1);
    document.getElementById('editorOS').style.display = 'none';
    renderizarListaSubOS();
}

function renderizarListaSubOS() {
    const container = document.getElementById('gridSubOSGeradas');
    container.innerHTML = '';
    const tipos = ['Viatura', 'Moto', 'Cabine', 'Setor'];

    let idVisual = idEdicaoGlobal;
    if (idVisual === null) {
        const banco = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
        const maxId = banco.length > 0 ? Math.max(...banco.map(e => e.id)) : 0;
        idVisual = maxId + 1;
    }

    tipos.forEach(tipo => {
        const col = document.createElement('div');
        col.className = 'coluna-os';
        col.innerHTML = `<div class="coluna-titulo">${tipo}</div>`;

        eventoAtual.subOrdens.forEach((os, index) => {
            if (os.tipo === tipo) {
                const card = document.createElement('div');
                const classeStatus = os.statusEdicao === 'ok' ? 'status-ok' : 'status-pendente';
                const iconeStatus = os.statusEdicao === 'ok' ? '✅' : '✏️';
                const codigoCompleto = `OE-${idVisual}-${os.seq}`;
                const nomeCustom = os.nomeEspecifico ? os.nomeEspecifico : `(Sem nome)`;
                const nomeExibicao = `${eventoAtual.nome} - ${nomeCustom}`;

                card.className = `card-os-item ${classeStatus}`;
                card.onclick = () => abrirEditorOS(index);
                
                card.innerHTML = `
                    <div class="card-header-row">
                        <span class="card-codigo">${codigoCompleto}</span>
                        <button class="btn-remove-os" onclick="removerOS(${index}, event)">X</button>
                    </div>
                    <div class="card-nome-display">${nomeExibicao}</div>
                    <div style="width:100%; text-align:right; font-size:0.8rem; color:#666;">${iconeStatus}</div>
                `;
                col.appendChild(card);
            }
        });

        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add-recurso';
        btnAdd.innerText = '+ Adicionar';
        btnAdd.onclick = () => adicionarRecurso(tipo);
        col.appendChild(btnAdd);
        container.appendChild(col);
    });
}

// --- EDITOR INTELIGENTE (IGUAL OS.JS) ---
function abrirEditorOS(i) {
    indiceEdicaoAtual = i; 
    const os = eventoAtual.subOrdens[i];
    
    document.getElementById('editorOS').style.display='block';
    
    let idVisual = idEdicaoGlobal;
    if (idVisual === null) {
        const banco = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
        const maxId = banco.length > 0 ? Math.max(...banco.map(e => e.id)) : 0;
        idVisual = maxId + 1;
    }

    document.getElementById('tituloEditor').innerText = `Editando: OE-${idVisual}-${os.seq} (${os.tipo})`;
    document.getElementById('nomeSubOrdem').value = os.nomeEspecifico || '';
    
    document.getElementById('localEditor').value=''; 
    document.getElementById('iniEditor').value=''; document.getElementById('fimEditor').value='';
    
    atualizarInterfaceEditor(); // Mostra/Esconde campo de local
    renderizarTabelaEditor(os.atividades);
    document.getElementById('editorOS').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function fecharEditor() { document.getElementById('editorOS').style.display='none'; }

function adicionarLinhaEditor() {
    const t = document.getElementById('tipoAtividadeEditor').value;
    const i = document.getElementById('iniEditor').value;
    const f = document.getElementById('fimEditor').value;
    const localInput = document.getElementById('localEditor').value;
    
    if(!i || !f) return alert("Horários obrigatórios.");

    if ((t === 'Baseamento' || t === 'Patrulhamento') && !localInput) {
        return alert("Selecione um local.");
    }

    let logradouro = "-";
    let bairro = "-";
    let cidade = "-";
    let detalhe = "-";
    let nomeLocalLimpo = localInput || "---";

    if (t === 'Baseamento' || t === 'Patrulhamento') {
        try {
            if (t === 'Patrulhamento') {
                const pontosPatrulha = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];
                const ponto = pontosPatrulha.find(p => p && p.apelido && localInput.includes(p.apelido));
                if (ponto) {
                    detalhe = `${ponto.raio} m`;
                    bairro = ponto.bairro || "-";
                    cidade = ponto.cidade || "-";
                    logradouro = `${ponto.rua || ''}, ${ponto.numero || 'S/N'}`;
                    nomeLocalLimpo = ponto.apelido;
                }
            } else if (t === 'Baseamento') {
                const locaisBase = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
                const local = locaisBase.find(l => l && l.apelido && localInput.includes(l.apelido));
                if (local) {
                    detalhe = "Ponto Fixo";
                    bairro = local.bairro || "-";
                    cidade = local.cidade || "-";
                    logradouro = `${local.rua || ''}, ${local.numero || 'S/N'}`;
                    nomeLocalLimpo = local.apelido;
                }
            }
        } catch(e) { console.error(e); }
    }

    // VALIDAÇÃO DE HORÁRIO
    const diaBase = eventoAtual.inicio.split('T')[0];
    let ativInicio = new Date(`${diaBase}T${i}`);
    let ativFim = new Date(`${diaBase}T${f}`);
    if (ativFim <= ativInicio) ativFim.setDate(ativFim.getDate() + 1);

    const evtInicio = new Date(eventoAtual.inicio);
    const evtFim = new Date(eventoAtual.termino);
    
    if (ativInicio < evtInicio) {
        ativInicio.setDate(ativInicio.getDate() + 1);
        ativFim.setDate(ativFim.getDate() + 1);
    }

    if (ativInicio < evtInicio || ativFim > evtFim) {
       if(!confirm(`Horário (${i}-${f}) fora do evento. Confirmar?`)) return;
    }

    eventoAtual.subOrdens[indiceEdicaoAtual].atividades.push({
        tipo: t, inicio: i, fim: f, 
        local: nomeLocalLimpo,
        logradouro: logradouro,
        bairro: bairro,
        cidade: cidade,
        detalhe: detalhe
    });
    
    eventoAtual.subOrdens[indiceEdicaoAtual].atividades.sort((a, b) => a.inicio.localeCompare(b.inicio));
    renderizarTabelaEditor(eventoAtual.subOrdens[indiceEdicaoAtual].atividades);
    document.getElementById('localEditor').value = '';
}

function renderizarTabelaEditor(l) {
    const tb = document.getElementById('tabelaEditor'); tb.innerHTML='';
    l.forEach((item,ix) => {
        let textoEndereco = "-";
        if(item.logradouro && item.logradouro !== "-") {
            textoEndereco = `${item.logradouro}<br><small>${item.bairro} - ${item.cidade}</small>`;
        }

        let icone = "📝";
        if (item.tipo === 'Baseamento') icone = "🛡️";
        else if (item.tipo === 'Patrulhamento') icone = "🚔";
        else if (item.tipo === 'Deslocamento') icone = "🚚";
        else if (item.tipo === 'Intervalo') icone = "🍽️";

        // SEM BOTÃO DE IR (REMOVIDO)
        tb.innerHTML += `
            <tr>
                <td>${icone} ${item.tipo}</td>
                <td>${item.inicio}</td>
                <td>${item.fim}</td>
                <td><strong>${item.local}</strong></td>
                <td>${textoEndereco}</td>
                <td style="text-align:center;">
                    <button onclick="removerItem(${ix})" style="color:#dc3545;border:none;background:none;font-weight:bold;cursor:pointer;font-size:1.1rem;">X</button>
                </td>
            </tr>`;
    });
}

function removerItem(ix) {
    eventoAtual.subOrdens[indiceEdicaoAtual].atividades.splice(ix,1);
    renderizarTabelaEditor(eventoAtual.subOrdens[indiceEdicaoAtual].atividades);
}

function confirmarEdicaoIndividual() {
    const nomeInput = document.getElementById('nomeSubOrdem').value;
    eventoAtual.subOrdens[indiceEdicaoAtual].nomeEspecifico = nomeInput;
    eventoAtual.subOrdens[indiceEdicaoAtual].statusEdicao = 'ok';
    renderizarListaSubOS(); 
    fecharEditor();
}

function finalizarEvento() {
    if(eventoAtual.subOrdens.length === 0) return alert("Adicione recursos.");
    if(!confirm("Salvar?")) return;
    
    let banco = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    
    if (idEdicaoGlobal !== null) {
        const index = banco.findIndex(e => e.id === idEdicaoGlobal);
        if (index !== -1) banco[index] = { ...banco[index], ...eventoAtual };
    } else {
        const id = banco.length > 0 ? Math.max(...banco.map(e=>e.id)) + 1 : 1;
        banco.push({ id: id, ...eventoAtual, status: 'Ativa', criadoEm: new Date().toISOString() });
    }

    localStorage.setItem('ordensEspeciais', JSON.stringify(banco));
    cancelarCriacaoEvento();
    carregarEventosAtivos();
}

function abrirModalEncerrar(id) { idEventoParaEncerrar = id; document.getElementById('modalEncerrar').style.display = 'flex'; }
function fecharModalEncerrar() { document.getElementById('modalEncerrar').style.display = 'none'; }
function confirmarEncerramento() {
    if (!idEventoParaEncerrar) return;
    let banco = JSON.parse(localStorage.getItem('ordensEspeciais')) || [];
    const index = banco.findIndex(e => e.id === idEventoParaEncerrar);
    if (index !== -1) {
        banco[index].status = 'Inativa';
        banco[index].observacoesEncerramento = document.getElementById('obsEncerramento').value;
        localStorage.setItem('ordensEspeciais', JSON.stringify(banco));
        fecharModalEncerrar();
        carregarEventosAtivos();
    }
}

function migrarBancoEspeciais() { if(!localStorage.getItem('ordensEspeciais')) localStorage.setItem('ordensEspeciais', JSON.stringify([])); }
function atualizarInterfaceEditor() {
    const t = document.getElementById('tipoAtividadeEditor').value;
    document.getElementById('linhaLocalEditor').style.display = (t==='Baseamento'||t==='Patrulhamento')?'flex':'none';
}
function carregarSugestoesLocais() {
    const dl = document.getElementById('listaLocaisSugestao'); if(!dl) return;
    const l = JSON.parse(localStorage.getItem('locaisCadastrados'))||[];
    const p = JSON.parse(localStorage.getItem('pontosPatrulhamento'))||[];
    dl.innerHTML = '';
    [...l,...p].forEach(x => { const o = document.createElement('option'); o.value = x.apelido; dl.appendChild(o); });
}