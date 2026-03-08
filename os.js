/**
 * LÓGICA DE GERENCIAMENTO DE OS
 * Ajustes: Ordenação Inteligente de Horário (Turno) + Operação na coluna Detalhes
 */

let listaAtividadesTemporaria = [];
let idEdicaoOS = -1; 
let statusFiltroAtual = 'Ativa'; 

function osEstaOcultaDaTela(os) {
    return !!(os && (os.ocultaNaTelaOS === true || os.ocultaNaTelaOS === 'true'));
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        carregarOS();
        carregarListaOperacoes(); 
        prepararNovoCadastro();
        atualizarInterfaceAtividade();
    } catch (e) {
        console.error("Erro na inicialização:", e);
    }
});

// --- GERENCIAMENTO DE OPERAÇÕES ---
function carregarListaOperacoes() {
    const cadastros = JSON.parse(localStorage.getItem('cadastrosOperacoes')) || [];
    const nomesSimples = cadastros.map(op => op.nome);
    const listaCompleta = [...new Set(nomesSimples)].sort();

    const datalist = document.getElementById('listaOperacoes');
    if (!datalist) return;
    datalist.innerHTML = '';
    listaCompleta.forEach(nome => {
        const opt = document.createElement('option');
        opt.value = nome;
        datalist.appendChild(opt);
    });
}

function abrirModalOperacao() {
    const textoAtual = document.getElementById('nomeOperacao').value;
    document.getElementById('modalOpNome').value = textoAtual;
    document.getElementById('modalOpDesc').value = "";
    document.getElementById('modalOpInicio').value = "";
    document.getElementById('modalOpFim').value = "";
    document.getElementById('modalOperacao').style.display = 'flex';
}

function fecharModalOperacao() {
    document.getElementById('modalOperacao').style.display = 'none';
}

function salvarOperacaoDetalhada() {
    const nome = document.getElementById('modalOpNome').value.toUpperCase().trim();
    const desc = document.getElementById('modalOpDesc').value;
    const inicio = document.getElementById('modalOpInicio').value;
    const fim = document.getElementById('modalOpFim').value;

    if (!nome) return alert("O Nome da Operação é obrigatório.");

    let cadastros = JSON.parse(localStorage.getItem('cadastrosOperacoes')) || [];
    const existe = cadastros.find(op => op.nome === nome);
    if (existe) { alert("Já existe uma operação com este nome."); return; }

    const novaOp = { id: Date.now(), nome, descricao: desc, inicio, fim, criadoEm: new Date().toISOString() };
    cadastros.push(novaOp);
    localStorage.setItem('cadastrosOperacoes', JSON.stringify(cadastros));
    
    carregarListaOperacoes();
    document.getElementById('nomeOperacao').value = nome;
    fecharModalOperacao();
    alert("Operação cadastrada!");
}

// --- INTERFACE ---
function atualizarInterfaceAtividade() {
    const tipo = document.getElementById('tipoAtividade').value;
    const linhaLocal = document.getElementById('linhaLocalizacao');
    const campoLocal = document.getElementById('localAtividade');
    const labelLocal = document.getElementById('labelLocal');

    if (!linhaLocal || !campoLocal) return;

    if (tipo === 'Baseamento' || tipo === 'Patrulhamento') {
        linhaLocal.style.display = 'flex';
        if (tipo === 'Baseamento') {
            labelLocal.innerText = "Selecione o Ponto";
            campoLocal.placeholder = "Busque o ponto...";
        } else {
            labelLocal.innerText = "Selecione a Área";
            campoLocal.placeholder = "Busque a área...";
        }
        carregarSugestoesLocais(tipo);
    } else {
        linhaLocal.style.display = 'none';
        campoLocal.value = "";
        document.getElementById('nomeOperacao').value = ""; 
    }
}

function carregarSugestoesLocais(tipoSelecionado) {
    const lista = document.getElementById('listaLocais');
    if (!lista) return;
    lista.innerHTML = '';
    const locais = JSON.parse(localStorage.getItem('locaisCadastrados')) || [];
    const patrulhas = JSON.parse(localStorage.getItem('pontosPatrulhamento')) || [];

    let fonte = [];
    if (tipoSelecionado === 'Baseamento') {
        fonte = locais.filter(l => l && l.status !== 'Inativo');
    } else if (tipoSelecionado === 'Patrulhamento') {
        fonte = patrulhas.filter(p => p && p.status !== 'Inativo');
    } else {
        fonte = [...locais, ...patrulhas];
    }

    fonte.forEach(l => {
        const option = document.createElement('option');
        option.value = l.apelido;
        lista.appendChild(option);
    });
}

// --- FLUXO DE CRIAÇÃO ---
function liberarFracionamento() {
    const nome = document.getElementById('nomeOS').value;
    const recurso = document.getElementById('tipoRecursoOS').value;
    const ini = document.getElementById('inicioGeral').value;
    const fim = document.getElementById('terminoGeral').value;

    if(!recurso || !nome || !ini || !fim) {
        alert("Preencha Tipo de Patrulhamento, Missão e Turno.");
        return;
    }

    ['nomeOS', 'inicioGeral', 'terminoGeral', 'tipoRecursoOS'].forEach(id => {
        document.getElementById(id).disabled = true;
    });

    document.getElementById('areaFracionamento').style.display = 'block';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Cancelar / Editar Cabeçalho";
    btn.className = "btn-secondary";
    btn.setAttribute('onclick', 'cancelarCriacao()');
    
    atualizarInterfaceAtividade();
}

function cancelarCriacao() {
    ['nomeOS', 'inicioGeral', 'terminoGeral', 'tipoRecursoOS'].forEach(id => {
        document.getElementById(id).disabled = false;
    });
    document.getElementById('areaFracionamento').style.display = 'none';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Criar e Fracionar";
    btn.className = "btn-primary";
    btn.setAttribute('onclick', 'liberarFracionamento()');
    idEdicaoOS = -1;
}

// --- ADICIONAR ATIVIDADE ---
function adicionarAtividade() {
    const tipo = document.getElementById('tipoAtividade').value;
    const inicio = document.getElementById('horaInicioAtiv').value;
    const fim = document.getElementById('horaFimAtiv').value;
    const local = document.getElementById('localAtividade').value;
    const operacao = document.getElementById('nomeOperacao').value.toUpperCase().trim();

    if (!inicio || !fim) return alert("Preencha os horários.");
    if ((tipo === 'Baseamento' || tipo === 'Patrulhamento') && !local) return alert("Selecione o local.");

    let detalhes = "-";
    let rua = "-";
    let numero = "-";
    let bairro = "-";
    let cidade = "-";
    let gps = null;

    if (local) {
        const locaisDB = [...(JSON.parse(localStorage.getItem('locaisCadastrados'))||[]), ...(JSON.parse(localStorage.getItem('pontosPatrulhamento'))||[])];
        const localObj = locaisDB.find(l => l.apelido === local);
        if (localObj) {
            detalhes = localObj.obs || (localObj.raio ? `Raio ${localObj.raio}m` : "Ponto Fixo");
            rua = localObj.rua || "-";
            numero = localObj.numero || "S/N";
            bairro = localObj.bairro || "-";
            cidade = localObj.cidade || "-";
            if (localObj.lat) {
                gps = { lat: localObj.lat, lng: localObj.lng };
                if (localObj.raio) gps.raio = localObj.raio;
            }
        }
    }

    const novaAtiv = { id: Date.now(), tipo, inicio, fim, local, operacao, rua, numero, bairro, cidade, detalhes, gps };

    listaAtividadesTemporaria.push(novaAtiv);
    
    // --- NOVA ORDENAÇÃO INTELIGENTE (CONSIDERA O INÍCIO DO TURNO) ---
    ordenarAtividadesPorTurno();
    
    document.getElementById('localAtividade').value = "";
    document.getElementById('nomeOperacao').value = "";
    renderizarTabelaAtividades();
}

// Função Auxiliar para converter "HH:MM" em minutos
function getMinutos(hora) {
    if (!hora) return 0;
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

// Função principal de ordenação
function ordenarAtividadesPorTurno() {
    const inicioTurnoStr = document.getElementById('inicioGeral').value;
    if (!inicioTurnoStr) return; // Se não tiver início, não ordena ou usa padrão

    const inicioTurnoMin = getMinutos(inicioTurnoStr);

    listaAtividadesTemporaria.sort((a, b) => {
        let minA = getMinutos(a.inicio);
        let minB = getMinutos(b.inicio);

        // Lógica da Virada: Se o horário da atividade for MENOR que o início do turno,
        // assume-se que é no dia seguinte (soma 24h = 1440 min).
        // Ex: Início Turno 22:00 (1320m). Atividade 02:00 (120m).
        // 120 < 1320 -> 120 + 1440 = 1560m. Agora 1560 > 1320 (Fica depois).
        
        if (minA < inicioTurnoMin) minA += 1440;
        if (minB < inicioTurnoMin) minB += 1440;

        return minA - minB;
    });
}

function renderizarTabelaAtividades() {
    const tbody = document.getElementById('tabelaAtividades');
    tbody.innerHTML = '';

    listaAtividadesTemporaria.forEach((ativ, index) => {
        const classeLinha = ativ.operacao ? "tr-operacao" : "";
        
        const localTexto = `<strong>${ativ.local || '-'}</strong>`;
        const operacaoTexto = ativ.operacao ? `<span class="badge-operacao">OP: ${ativ.operacao}</span>` : '-';
        const ruaTexto = ativ.rua || '-';
        const bairroTexto = ativ.bairro || '-';
        const numeroTexto = ativ.numero || '-';
        const cidadeTexto = ativ.cidade || '-';
        const detalhesTexto = ativ.detalhes || '-';

        const tr = document.createElement('tr');
        tr.className = classeLinha;
        tr.innerHTML = `
            <td>${ativ.tipo}</td>
            <td>${ativ.inicio}</td>
            <td>${ativ.fim}</td>
            <td>${localTexto}</td>
            <td>${operacaoTexto}</td>
            <td>${ruaTexto}</td>
            <td>${numeroTexto}</td>
            <td>${bairroTexto}</td>
            <td>${cidadeTexto}</td>
            <td>${detalhesTexto}</td>
            <td><button onclick="removerAtividade(${index})" class="btn-remove-sm" style="color:red;border:none;background:none;font-weight:bold;">X</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function removerAtividade(index) {
    listaAtividadesTemporaria.splice(index, 1);
    renderizarTabelaAtividades();
}

// --- FINALIZAR OS ---
function finalizarOS() {
    if (listaAtividadesTemporaria.length === 0) return alert("Adicione atividades.");

    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const novoNumero = bancoOS.length > 0 ? Math.max(...bancoOS.map(o => o.numero)) + 1 : 1001;

    const novaOS = {
        numero: novoNumero,
        id: Date.now(),
        criadoEm: new Date().toISOString(),
        status: 'Ativa',
        tipoOrdem: '',
        nomeOS: document.getElementById('nomeOS').value,
        tipoRecurso: document.getElementById('tipoRecursoOS').value,
        inicioGeral: document.getElementById('inicioGeral').value,
        terminoGeral: document.getElementById('terminoGeral').value,
        atividades: listaAtividadesTemporaria
    };

    bancoOS.push(novaOS);
    localStorage.setItem('ordensServico', JSON.stringify(bancoOS));

    let msg = `Nova Ordem de Serviço criada: Nº ${novoNumero}.`;
    if (idEdicaoOS !== -1) msg += `\n(Gerada a partir da cópia de uma OS anterior).`;
    alert(msg);

    prepararNovoCadastro();
    carregarOS();
}

// --- TABELA PRINCIPAL ---
function carregarOS() {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const tbody = document.getElementById('corpoTabelaOS');
    tbody.innerHTML = '';

    const filtradas = bancoOS.filter(os => os.status === statusFiltroAtual && !osEstaOcultaDaTela(os));
    filtradas.sort((a,b) => b.numero - a.numero);

    filtradas.forEach(os => {
        // Verifica se tem operação
        const operacaoEncontrada = os.atividades.find(a => a.operacao);
        let detalhesOp = '<span style="color:#999; font-size:0.8rem;">Rotina</span>';
        
        if (operacaoEncontrada) {
            detalhesOp = `<span class="badge-op-table">[OP] ${operacaoEncontrada.operacao}</span>`;
        }

        const tr = document.createElement('tr');
        const botaoInativar = statusFiltroAtual === 'Ativa'
            ? `<button onclick="inativarOS(${os.id})" class="btn-secondary" style="padding:6px 10px;">Inativar</button>`
            : '';
        const botaoOcultar = statusFiltroAtual === 'Inativa'
            ? `<button onclick="ocultarOSDaTela(${os.id})" class="btn-danger" style="padding:6px 10px;">Deletar</button>`
            : '';

        tr.innerHTML = `
            <td><strong>${os.numero}</strong></td>
            <td>${os.tipoRecurso}</td>
            <td>${os.nomeOS}</td>
            <td>${os.inicioGeral || '-'}</td>
            <td>${os.terminoGeral || '-'}</td>
            <td>
                <div style="line-height:1.2;">
                    ${detalhesOp}
                </div>
            </td>
            <td style="text-align: center;">
                <button onclick="copiarParaEditar(${os.id})" class="btn-warning" style="padding:6px 10px;">Editar</button>
                <button onclick="imprimirOS(${os.id})" class="btn-info" style="padding:6px 10px;">Imprimir</button>
                ${botaoInativar}
                ${botaoOcultar}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function copiarParaEditar(id) {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = bancoOS.find(o => o.id === id);
    if (!os) return;

    document.getElementById('nomeOS').value = os.nomeOS;
    document.getElementById('tipoRecursoOS').value = os.tipoRecurso;
    document.getElementById('inicioGeral').value = os.inicioGeral;
    document.getElementById('terminoGeral').value = os.terminoGeral;

    listaAtividadesTemporaria = JSON.parse(JSON.stringify(os.atividades));
    
    // Reordena ao carregar para garantir
    // Mas precisamos setar o valor do input primeiro, o que já foi feito acima
    ordenarAtividadesPorTurno();

    liberarFracionamento();
    renderizarTabelaAtividades();

    idEdicaoOS = id; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('btnFinalizar').innerText = "Gerar Nova OS (Baseada na Edição)";
}

function inativarOS(id) {
    if(!confirm("Inativar esta OS?")) return;
    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const index = bancoOS.findIndex(o => o.id === id);
    if(index !== -1) {
        bancoOS[index].status = 'Inativa';
        localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
        carregarOS();
    }
}

// Mantido para compatibilidade com chamadas antigas.
function arquivarOS(id) {
    inativarOS(id);
}

function ocultarOSDaTela(id) {
    if (!confirm("Ocultar esta OS da tela? Ela será mantida no banco de dados.")) return;
    let bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const index = bancoOS.findIndex(o => o.id === id);
    if (index === -1) return;

    bancoOS[index].ocultaNaTelaOS = true;
    bancoOS[index].ocultaEm = new Date().toISOString();
    localStorage.setItem('ordensServico', JSON.stringify(bancoOS));
    carregarOS();
}

function mudarFiltro(status) {
    statusFiltroAtual = status;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btnFiltro${status}`).classList.add('active');
    carregarOS();
}

function prepararNovoCadastro() {
    document.getElementById('nomeOS').value = '';
    document.getElementById('tipoRecursoOS').value = '';
    document.getElementById('inicioGeral').value = '';
    document.getElementById('terminoGeral').value = '';
    
    ['nomeOS', 'inicioGeral', 'terminoGeral', 'tipoRecursoOS'].forEach(id => {
        document.getElementById(id).disabled = false;
    });

    document.getElementById('areaFracionamento').style.display = 'none';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Criar e Fracionar";
    btn.className = "btn-primary";
    btn.setAttribute('onclick', 'liberarFracionamento()');
    
    document.getElementById('btnFinalizar').innerText = "Finalizar e Gravar Nova OS";

    listaAtividadesTemporaria = [];
    idEdicaoOS = -1;
    renderizarTabelaAtividades();
}

// --- IMPRESSÃO PDF ---
function imprimirOS(id) {
    const bancoOS = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = bancoOS.find(o => o.id === id);
    if (!os) return;

    const atividades = os.atividades.map(ativ => {
        const icone = (() => {
            if (!ativ.tipo) return '';
            const t = ativ.tipo.toLowerCase();
            if (t.includes('patrulhamento')) return '🚔';
            if (t.includes('baseamento')) return '🛡️';
            if (t.includes('deslocamento')) return '🚚';
            if (t.includes('intervalo')) return '🍽️';
            if (t.includes('preleção') || t.includes('prelecao')) return '🎯';
            if (t.includes('retorno')) return '↩️';
            return '📝';
        })();

        const logradouro = ativ.rua && ativ.rua !== '-'
            ? `${ativ.rua}${ativ.numero && ativ.numero !== '-' ? `, ${ativ.numero}` : ''}`
            : (ativ.endereco || '-');

        const gps = ativ.gps ? { ...ativ.gps } : null;
        if (gps && ativ.raio) gps.raio = ativ.raio;

        const detalheFinal = ativ.operacao
            ? `[OP: ${ativ.operacao}] ${ativ.detalhes || ''}`.trim()
            : (ativ.detalhes || '-');

        return {
            tipo: ativ.tipo,
            icone,
            inicio: ativ.inicio,
            fim: ativ.fim,
            local: ativ.local || '-',
            logradouro: logradouro || '-',
            bairro: ativ.bairro || '-',
            cidade: ativ.cidade || '-',
            detalhe: detalheFinal,
            gps
        };
    });

    const dadosImpressao = {
        numero: os.numero,
        nomeOS: os.nomeOS,
        tipoRecurso: os.tipoRecurso,
        inicioGeral: os.inicioGeral,
        terminoGeral: os.terminoGeral,
        status: os.status || 'Ativa',
        atividades
    };

    localStorage.setItem('osImpressaoTemp', JSON.stringify(dadosImpressao));
    window.open('impressao.html', '_blank');
}
