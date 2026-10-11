/**
 * SISTEMA DE ATIVAÇÃO E ESCALAMENTO
 * Conectado aos cadastros de recursos, serviços e Ordens de Serviço.
 */

document.addEventListener('DOMContentLoaded', () => {
    configurarFluxoCadastroPolicialNaAtivacao();
    popularTiposPoliciamentoAtivacao();
    popularRecursosFisicos(false);
    popularTiposServicoAtivacao();
    filtrarOSPorRecurso();
    renderizarEquipe();
    atualizarPainelTatico(false);
    alternarVisualizacaoAtivacao('painel', false);
});

/* Identificação estática do protótipo:
const DESPACHANTE = {
    nome: "SGT Controle",
    funcao: "Operador de Despacho",
    id: "user_01"
};
*/
const DESPACHANTE = { id: String(window.ORDENA_BOOT.perfil.id), nome: window.ORDENA_BOOT.perfil.nome, funcao: "Usuário" };
const ANTECEDENCIA_PERMITIDA_ATIVACAO_MIN = 30;
const MAX_MEMBROS_EQUIPE = 6;
const POSTOS_GRADUACOES_POLICIAIS = Object.freeze([
    'GCM Coordenador',
    'GCM Supervisor',
    'GCM',
    'SD',
    'CB',
    '3SGT',
    '2SGT',
    '1SGT',
    'SUBTEN',
    'ASP',
    'TEN',
    'CAP',
    'MAJ',
    'TC',
    'CEL'
]);

let membrosEquipe = [];
let indiceMembroEmEdicao = -1;
let rascunhoEditorAntesEdicao = null;
let ultimoTipoPoliciamento = '';
let ativacaoEmAndamento = false;
let buscaPolicialEmAndamento = false;
let cadastroPolicialEmAndamento = false;
let rgNaoCadastradoPendente = '';
let elementoRetornoModalCadastroPolicial = null;
const estadosInertesAntesModalCadastroPolicial = new Map();

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function mostrarFeedbackAtivacao(tipo, mensagem) {
    const elemento = document.getElementById('feedbackAtivacao');
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.className = `page-feedback is-visible ${tipo}`;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparFeedbackAtivacao() {
    const elemento = document.getElementById('feedbackAtivacao');
    if (!elemento) return;
    elemento.textContent = '';
    elemento.className = 'page-feedback';
    elemento.removeAttribute('role');
}

function mostrarFeedbackPainelAtivacoes(tipo, mensagem) {
    const elemento = document.getElementById('feedbackPainelAtivacoes');
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.className = `page-feedback is-visible ${tipo}`;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparFeedbackPainelAtivacoes() {
    const elemento = document.getElementById('feedbackPainelAtivacoes');
    if (!elemento) return;
    elemento.textContent = '';
    elemento.className = 'page-feedback';
    elemento.removeAttribute('role');
}

function alternarVisualizacaoAtivacao(visualizacao, focarTitulo = true) {
    const formulario = document.getElementById('secaoFormularioAtivacao');
    const painel = document.getElementById('secaoPainelAtivacoes');
    if (!formulario || !painel) return;

    const exibirFormulario = visualizacao === 'formulario';
    formulario.hidden = !exibirFormulario;
    painel.hidden = exibirFormulario;

    if (!focarTitulo) return;
    const titulo = document.getElementById(
        exibirFormulario ? 'tituloFormularioAtivacao' : 'tituloPainelAtivacoes'
    );
    titulo?.focus({ preventScroll: true });
    const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    window.scrollTo({ top: 0, behavior: reduzirMovimento ? 'auto' : 'smooth' });
}

function formularioAtivacaoTemDados() {
    const camposSelecao = [
        'selectTipoPoliciamento',
        'selectRecurso',
        'selectTipoServico',
        'selectOS'
    ];

    return membrosEquipe.length > 0
        || indiceMembroEmEdicao >= 0
        || editorEquipeTemDados()
        || camposSelecao.some(id => !!document.getElementById(id)?.value);
}

function abrirCadastroPoliciais(evento) {
    if (ativacaoEmAndamento) {
        evento?.preventDefault();
        return false;
    }

    if (formularioAtivacaoTemDados()
        && !confirm('Sair desta ativação para abrir o cadastro de policiais? Os dados ainda não ativados serão descartados.')) {
        evento?.preventDefault();
        return false;
    }

    return true;
}

function abrirNovaAtivacao() {
    if (ativacaoEmAndamento) return;
    limparFeedbackAtivacao();
    limparFeedbackPainelAtivacoes();
    resetarFormularioAtivacao();
    alternarVisualizacaoAtivacao('formulario');
}

function voltarAoPainelAtivacoes() {
    if (ativacaoEmAndamento) return;
    if (formularioAtivacaoTemDados()
        && !confirm('Descartar os dados desta nova ativação e voltar ao Painel Tático?')) {
        return;
    }

    limparFeedbackAtivacao();
    resetarFormularioAtivacao();
    atualizarPainelTatico(false);
    alternarVisualizacaoAtivacao('painel');
}

function falharValidacaoAtivacao(mensagem, elemento) {
    mostrarFeedbackAtivacao('error', mensagem);
    const alvoIndisponivel = !elemento
        || elemento.disabled
        || elemento.hidden
        || elemento.closest?.('[hidden], [inert]');
    const alvo = alvoIndisponivel
        ? document.getElementById('feedbackAtivacao')
        : elemento;
    if (alvo === document.getElementById('feedbackAtivacao')) {
        alvo?.setAttribute('tabindex', '-1');
    }
    alvo?.focus();
    alvo?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    return false;
}

function lerListaLocalStorage(chave) {
    try {
        const valor = JSON.parse(OrdenaStorage.getItem(chave));
        return Array.isArray(valor) ? valor : [];
    } catch (erro) {
        console.error(`Erro ao carregar ${chave}:`, erro);
        const mensagem = 'Não foi possível carregar todos os dados cadastrados. Atualize a página e tente novamente.';
        mostrarFeedbackAtivacao('error', mensagem);
        mostrarFeedbackPainelAtivacoes('error', mensagem);
        return [];
    }
}

function obterIdsRecursosEscala(escala) {
    const ids = Array.isArray(escala?.recursoIds)
        ? escala.recursoIds
        : [escala?.recursoId || escala?.prefixo];

    return [...new Set(ids
        .map(id => String(id || '').trim())
        .filter(Boolean))];
}

function obterApiAutoEscalas() {
    return window.ORDENA_STORAGE_NORMALIZER || null;
}

function calcularDataFimPrevistaEscala(dataAtivacaoIso, horaInicioServico, horaFimServico) {
    const api = obterApiAutoEscalas();
    if (api && typeof api.calcularDataFimPrevistaEscala === 'function') {
        return api.calcularDataFimPrevistaEscala(
            dataAtivacaoIso,
            horaInicioServico,
            horaFimServico,
            ANTECEDENCIA_PERMITIDA_ATIVACAO_MIN
        );
    }

    const dataAtivacao = new Date(dataAtivacaoIso);
    if (Number.isNaN(dataAtivacao.getTime())) return null;
    const duracao = calcularDuracaoTurnoMinutos(horaInicioServico, horaFimServico);
    if (!Number.isFinite(duracao)) return null;
    return new Date(dataAtivacao.getTime() + (duracao * 60000)).toISOString();
}

function aplicarMetadadosBaixa(escala, dataFimIso) {
    const dataRegistroBaixa = dataFimIso || new Date().toISOString();
    escala.dataFim = dataRegistroBaixa;
    escala.dataRegistroBaixa = dataRegistroBaixa;
    escala.baixaAutomatica = false;
    escala.tipoBaixa = 'Manual';
    escala.motivoBaixa = 'Encerramento manual realizado pelo operador';
    escala.responsavelBaixaId = DESPACHANTE.id;
    escala.responsavelBaixa = DESPACHANTE.nome;
}

function normalizarTextoTipoServico(texto) {
    return (texto || '').toString().trim().toUpperCase();
}

function normalizarTipoPoliciamento(texto) {
    const t = (texto || '').toString().trim().toLowerCase();
    if (!t) return '';
    if (t.includes('moto')) return 'Moto';
    if (t.includes('cabine')) return 'Cabine';
    if (t.includes('setor')) return 'Setor';
    if (t.includes('viatura') || t.includes('carro')) return 'Viatura';
    return 'Viatura';
}

function popularTiposPoliciamentoAtivacao() {
    const selectTipoPoliciamento = document.getElementById('selectTipoPoliciamento');
    if (!selectTipoPoliciamento) return;

    const valorAtual = normalizarTipoPoliciamento(selectTipoPoliciamento.value);
    selectTipoPoliciamento.innerHTML = `
        <option value="">Selecione...</option>
        <option value="Viatura">Carro</option>
        <option value="Moto">Moto</option>
        <option value="Cabine">Cabine</option>
        <option value="Setor">Setor a Pé</option>
    `;
    selectTipoPoliciamento.disabled = false;

    const valoresPermitidos = ['Viatura', 'Moto', 'Cabine', 'Setor'];
    if (valorAtual && valoresPermitidos.includes(valorAtual)) {
        selectTipoPoliciamento.value = valorAtual;
    }
}

function obterTiposServicoAtivos() {
    const tipos = lerListaLocalStorage('tiposServico');
    return tipos
        .filter(t => t && t.status !== 'Inativa' && t.nome)
        .sort((a, b) => normalizarTextoTipoServico(a.nome).localeCompare(
            normalizarTextoTipoServico(b.nome),
            'pt-BR',
            { numeric: true }
        ));
}

function popularTiposServicoAtivacao() {
    const selectTipoServico = document.getElementById('selectTipoServico');
    if (!selectTipoServico) return;
    const valorAtual = normalizarTextoTipoServico(selectTipoServico.value);

    selectTipoServico.innerHTML = '';

    const tiposAtivos = obterTiposServicoAtivos();
    if (tiposAtivos.length === 0) {
        selectTipoServico.disabled = true;
        selectTipoServico.innerHTML = '<option value="">Nenhum tipo de serviço cadastrado</option>';
        return;
    }

    selectTipoServico.disabled = false;
    selectTipoServico.innerHTML = '<option value="">Selecione o Serviço...</option>';

    tiposAtivos.forEach(tipo => {
        const opt = document.createElement('option');
        opt.value = normalizarTextoTipoServico(tipo.nome);
        opt.innerText = normalizarTextoTipoServico(tipo.nome);
        selectTipoServico.appendChild(opt);
    });

    if (valorAtual) {
        const existe = [...selectTipoServico.options].some(opt => opt.value === valorAtual);
        if (existe) selectTipoServico.value = valorAtual;
    }
}

function aoSelecionarTipoPoliciamento() {
    if (ativacaoEmAndamento) return;
    limparFeedbackAtivacao();

    const tipoSelecionado = normalizarTipoPoliciamento(
        document.getElementById('selectTipoPoliciamento')?.value
    );
    const mudouTipo = tipoSelecionado !== ultimoTipoPoliciamento;
    ultimoTipoPoliciamento = tipoSelecionado;

    if (mudouTipo) {
        membrosEquipe = membrosEquipe.map(membro => ({ ...membro, motoPrefixo: '' }));
        cancelarEdicaoMembro(false);
    }

    popularRecursosFisicos(!mudouTipo);
    popularTiposServicoAtivacao();
    filtrarOSPorRecurso();
    renderizarEquipe();
}

function aoSelecionarOS() {
    if (ativacaoEmAndamento) return;
    limparFeedbackAtivacao();
    popularTiposServicoAtivacao();
}

function aoSelecionarRecurso() {
    if (ativacaoEmAndamento) return;
    limparFeedbackAtivacao();

    const tipoSelecionado = normalizarTipoPoliciamento(
        document.getElementById('selectTipoPoliciamento')?.value
    );
    const recursosSelecionados = obterIdsRecursosSelecionados();
    let removeuVinculo = false;

    if (tipoSelecionado === 'Moto') {
        const motosSelecionadas = new Set(recursosSelecionados);
        membrosEquipe = membrosEquipe.map(membro => {
            if (membro.motoPrefixo && !motosSelecionadas.has(membro.motoPrefixo)) {
                removeuVinculo = true;
                return { ...membro, motoPrefixo: '' };
            }
            return membro;
        });
    }

    atualizarAjudaSelecaoRecurso();
    renderizarEquipe();
    filtrarOSPorRecurso();

    if (tipoSelecionado === 'Moto' && recursosSelecionados.length > MAX_MEMBROS_EQUIPE) {
        mostrarFeedbackAtivacao('error', `Selecione no máximo ${MAX_MEMBROS_EQUIPE} motos por guarnição.`);
    } else if (removeuVinculo) {
        mostrarFeedbackAtivacao('info', 'Uma moto retirada da seleção foi desvinculada da equipe. Revise os policiais antes de ativar.');
    }
}

function atualizarPainelTatico(forcarAtualizacaoRecursos = false) {
    if (forcarAtualizacaoRecursos) {
        popularTiposPoliciamentoAtivacao();
        popularRecursosFisicos(true);
    }
    exibirMonitoramento();
}

function obterEscalasAtivasPreparadas() {
    const escalas = lerListaLocalStorage('escalasAtivas');
    let alterou = false;

    escalas.forEach(escala => {
        if (preencherCamposEscala(escala)) alterou = true;
    });

    if (alterou) {
        OrdenaStorage.setCached('escalasAtivas', JSON.stringify(escalas));
    }

    return escalas;
}

function preencherCamposEscala(escala) {
    if (!escala || !escala.dataInicio) return false;

    let alterou = false;
    const dataInicio = new Date(escala.dataInicio);
    if (Number.isNaN(dataInicio.getTime())) return false;

    if (!escala.dataAtivacao) {
        escala.dataAtivacao = dataInicio.toLocaleDateString('pt-BR');
        alterou = true;
    }

    if (!escala.horaAtivacao) {
        escala.horaAtivacao = dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        alterou = true;
    }

    if (!escala.tipoServico && escala.osResumo?.tipoOrdem) {
        escala.tipoServico = escala.osResumo.tipoOrdem;
        alterou = true;
    }

    if (!escala.horaInicioServico && escala.osResumo?.inicioGeral) {
        escala.horaInicioServico = escala.osResumo.inicioGeral;
        alterou = true;
    }

    if (!escala.horaFimServico && escala.osResumo?.terminoGeral) {
        escala.horaFimServico = escala.osResumo.terminoGeral;
        alterou = true;
    }

    if (!Number.isFinite(escala.duracaoServicoMinutos)) {
        const duracaoMin = calcularDuracaoTurnoMinutos(escala.horaInicioServico, escala.horaFimServico);
        if (Number.isFinite(duracaoMin)) {
            escala.duracaoServicoMinutos = duracaoMin;
            alterou = true;
        }
    }

    const dataFimPrevistaCalculada = calcularDataFimPrevistaEscala(
        escala.dataInicio,
        escala.horaInicioServico,
        escala.horaFimServico
    );
    const dataFimAtualMs = escala.dataFimPrevista ? new Date(escala.dataFimPrevista).getTime() : NaN;
    const dataFimCalculadaMs = dataFimPrevistaCalculada ? new Date(dataFimPrevistaCalculada).getTime() : NaN;

    if (Number.isFinite(dataFimCalculadaMs) && dataFimAtualMs !== dataFimCalculadaMs) {
        escala.dataFimPrevista = dataFimPrevistaCalculada;
        alterou = true;
    }

    return alterou;
}

function calcularDuracaoTurnoMinutos(horaInicio, horaFim) {
    const inicioMin = horaParaMinutos(horaInicio);
    const fimMin = horaParaMinutos(horaFim);

    if (!Number.isFinite(inicioMin) || !Number.isFinite(fimMin)) return null;

    let diff = fimMin - inicioMin;
    if (diff <= 0) diff += 24 * 60; // Trata virada de dia (ex.: 23:00 -> 11:00)
    return diff;
}

function horaParaMinutos(hora) {
    if (!hora || typeof hora !== 'string' || !hora.includes(':')) return null;
    const [h, m] = hora.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return (h * 60) + m;
}

function minutosParaHoraTexto(totalMinutos) {
    if (!Number.isFinite(totalMinutos)) return '--:--';
    const normalizado = ((totalMinutos % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = String(Math.floor(normalizado / 60)).padStart(2, '0');
    const m = String(normalizado % 60).padStart(2, '0');
    return `${h}:${m}`;
}

function horarioDentroFaixaCircular(inicioMin, fimMin, alvoMin) {
    if (![inicioMin, fimMin, alvoMin].every(Number.isFinite)) return false;
    if (inicioMin <= fimMin) {
        return alvoMin >= inicioMin && alvoMin <= fimMin;
    }
    // Faixa atravessa meia-noite
    return alvoMin >= inicioMin || alvoMin <= fimMin;
}

function validarJanelaAtivacaoOS(os, agora = new Date()) {
    const horaInicio = os?.inicioGeral;
    const horaFim = os?.terminoGeral;
    const inicioMin = horaParaMinutos(horaInicio);
    const fimMin = horaParaMinutos(horaFim);

    if (!Number.isFinite(inicioMin) || !Number.isFinite(fimMin)) {
        return {
            ok: false,
            motivo: 'horario_invalido',
            mensagem: 'A OS selecionada não possui horário de início/fim válido para ativação.'
        };
    }

    const agoraMin = (agora.getHours() * 60) + agora.getMinutes();
    const janelaInicioMin = inicioMin - ANTECEDENCIA_PERMITIDA_ATIVACAO_MIN;
    const dentroJanela = horarioDentroFaixaCircular(janelaInicioMin, fimMin, agoraMin);

    if (dentroJanela) {
        return {
            ok: true,
            inicioMin,
            fimMin,
            janelaInicioMin,
            agoraMin
        };
    }

    const dataAtual = agora.toLocaleDateString('pt-BR');
    const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const horaJanela = minutosParaHoraTexto(janelaInicioMin);

    return {
        ok: false,
        motivo: 'fora_da_janela',
        inicioMin,
        fimMin,
        janelaInicioMin,
        agoraMin,
        mensagem:
            `Ativação fora do horário permitido da OS.\n` +
            `Data/Hora atual: ${dataAtual} ${horaAtual}\n` +
            `OS ${os.numero}: ${horaInicio} às ${horaFim}\n` +
            `A ativação só pode ser realizada a partir de ${horaJanela} (30 min antes do início) até ${horaFim}.`
    };
}

function formatarDataIso(dataIso) {
    if (!dataIso) return '-';
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return '-';
    return data.toLocaleDateString('pt-BR');
}

function obterTextoRecursoPainel(escala, placasPorPrefixo) {
    if (!escala) return '-';

    const tipoRecurso = (escala.tipoRecurso || '').toLowerCase();
    const recursoEhCabineOuSetor = tipoRecurso.includes('cabine') || tipoRecurso.includes('setor');
    const ids = obterIdsRecursosEscala(escala);
    if (ids.length === 0) return '-';

    return ids.map(id => {
        const placa = placasPorPrefixo?.get(id);
        return !recursoEhCabineOuSetor && placa ? `${id} (${placa})` : id;
    }).join(', ');
}

function obterChaveRecurso(tipo, id) {
    return `${normalizarTipoPoliciamento(tipo)}::${String(id || '').trim()}`;
}

function obterRecursosDisponiveis(tipoSelecionado) {
    const viaturas = lerListaLocalStorage('viaturas');
    const cabines = lerListaLocalStorage('cabines');
    const setores = lerListaLocalStorage('setores');
    const escalasAtivas = obterEscalasAtivasPreparadas();

    const chavesEmUso = new Set();
    escalasAtivas.forEach(escala => {
        const tipoEscala = normalizarTipoPoliciamento(escala?.tipoPoliciamento || escala?.tipoRecurso);
        obterIdsRecursosEscala(escala).forEach(id => {
            chavesEmUso.add(obterChaveRecurso(tipoEscala, id));
        });
    });

    let recursos = [];
    const rotuloTipoSelecionado = tipoSelecionado === 'Viatura' ? 'Carro' : tipoSelecionado;

    if (tipoSelecionado === 'Viatura' || tipoSelecionado === 'Moto') {
        recursos = viaturas
            .filter(v => v && v.status === 'Ativa' && v.prefixo)
            .filter(v => normalizarTipoPoliciamento(v.tipo) === tipoSelecionado)
            .filter(v => !chavesEmUso.has(obterChaveRecurso(tipoSelecionado, v.prefixo)))
            .map(v => ({
                id: String(v.prefixo),
                tipo: tipoSelecionado,
                texto: `${rotuloTipoSelecionado} • ${v.prefixo}${v.placa ? ` (${v.placa})` : ''}`
            }));
    } else if (tipoSelecionado === 'Cabine') {
        recursos = cabines
            .filter(c => c && c.status === 'Ativa' && c.codigo)
            .filter(c => !chavesEmUso.has(obterChaveRecurso('Cabine', c.codigo)))
            .map(c => ({
                id: String(c.codigo),
                tipo: 'Cabine',
                texto: `Cabine • ${c.codigo}${c.nome ? ` - ${c.nome}` : ''}`
            }));
    } else if (tipoSelecionado === 'Setor') {
        recursos = setores
            .filter(s => s && s.status === 'Ativa' && s.codigo)
            .filter(s => !chavesEmUso.has(obterChaveRecurso('Setor', s.codigo)))
            .map(s => ({
                id: String(s.codigo),
                tipo: 'Setor',
                texto: `Setor a Pé • ${s.codigo}${s.nome ? ` - ${s.nome}` : ''}`
            }));
    }

    return [...new Map(recursos.map(recurso => [recurso.id, recurso])).values()]
        .sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR', { numeric: true }));
}

function obterIdsRecursosSelecionados() {
    // Para motos, os recursos da ativação são os vínculos feitos na equipe.
    if (tipoMotoEstaSelecionado()) {
        return [...new Set(membrosEquipe.map(membro => membro.motoPrefixo).filter(Boolean))];
    }

    const selectRecurso = document.getElementById('selectRecurso');
    if (!selectRecurso || selectRecurso.disabled) return [];

    return [...new Set([...selectRecurso.selectedOptions]
        .map(option => String(option.value || '').trim())
        .filter(Boolean))];
}

function atualizarAjudaSelecaoRecurso(totalDisponivel) {
    const tipoSelecionado = normalizarTipoPoliciamento(
        document.getElementById('selectTipoPoliciamento')?.value
    );
    const ajuda = document.getElementById('ajudaSelecaoRecurso');
    const selectRecurso = document.getElementById('selectRecurso');
    if (!ajuda || !selectRecurso) return;

    const total = Number.isFinite(totalDisponivel)
        ? totalDisponivel
        : [...selectRecurso.options].filter(option => option.value).length;

    if (!tipoSelecionado) {
        ajuda.textContent = 'O campo será liberado conforme o tipo selecionado.';
        return;
    }

    if (tipoSelecionado === 'Moto') {
        ajuda.textContent = 'Selecione a moto ao lado do nome do integrante.';
        return;
    }

    if (total === 0) {
        const mensagens = {
            Viatura: 'Nenhum carro ativo e disponível.',
            Moto: 'Nenhuma moto ativa e disponível.',
            Cabine: 'Nenhuma cabine ativa e disponível.',
            Setor: 'Nenhum setor a pé ativo e disponível.'
        };
        ajuda.textContent = mensagens[tipoSelecionado] || 'Nenhum recurso ativo e disponível.';
        return;
    }

    if (tipoSelecionado === 'Moto') {
        const quantidade = obterIdsRecursosSelecionados().length;
        ajuda.textContent = quantidade > 0
            ? `${quantidade} moto(s) selecionada(s). No computador, use Ctrl/⌘ + clique para alterar várias.`
            : `Selecione uma ou mais motos, até ${MAX_MEMBROS_EQUIPE} (no computador, use Ctrl/⌘ + clique). Depois, vincule cada uma ao condutor.`;
        return;
    }

    const textos = {
        Viatura: 'Selecione um carro cadastrado e disponível.',
        Cabine: 'Selecione uma cabine cadastrada e disponível.',
        Setor: 'Selecione um setor a pé cadastrado e disponível.'
    };
    ajuda.textContent = textos[tipoSelecionado] || '';
}

// --- 1. POPULA RECURSOS CONFORME O TIPO DE POLICIAMENTO ---
function popularRecursosFisicos(preservarSelecao = true) {
    const selectRecurso = document.getElementById('selectRecurso');
    const labelRecurso = document.getElementById('labelSelecionarRecurso');
    if (!selectRecurso || !labelRecurso) return;

    const tipoSelecionado = normalizarTipoPoliciamento(
        document.getElementById('selectTipoPoliciamento')?.value
    );
    const tipoAnterior = selectRecurso.dataset.tipoPoliciamento || '';
    const valoresAtuais = preservarSelecao && tipoAnterior === tipoSelecionado
        ? obterIdsRecursosSelecionados()
        : [];

    // A seleção de motos é feita somente no editor da equipe.
    selectRecurso.hidden = tipoSelecionado === 'Moto';
    selectRecurso.required = tipoSelecionado !== 'Moto';
    if (tipoSelecionado === 'Moto') {
        labelRecurso.textContent = '2. Vincular Moto';
        selectRecurso.disabled = true;
        selectRecurso.setAttribute('aria-disabled', 'true');
        selectRecurso.dataset.tipoPoliciamento = tipoSelecionado;
        atualizarAjudaSelecaoRecurso();
        return;
    }

    selectRecurso.innerHTML = '';
    selectRecurso.multiple = tipoSelecionado === 'Moto';
    selectRecurso.removeAttribute('size');
    selectRecurso.dataset.tipoPoliciamento = tipoSelecionado;

    const configuracoes = {
        Viatura: { label: '2. Selecionar Carro', placeholder: 'Selecione o Carro...' },
        Moto: { label: '2. Selecionar Moto(s)', placeholder: '' },
        Cabine: { label: '2. Selecionar Cabine', placeholder: 'Selecione a Cabine...' },
        Setor: { label: '2. Selecionar Setor a Pé', placeholder: 'Selecione o Setor a Pé...' }
    };

    if (!tipoSelecionado) {
        labelRecurso.textContent = '2. Selecionar Recurso';
        selectRecurso.disabled = true;
        selectRecurso.setAttribute('aria-disabled', 'true');
        selectRecurso.innerHTML = '<option value="">Selecione primeiro o tipo de policiamento...</option>';
        atualizarAjudaSelecaoRecurso(0);
        return;
    }

    const configuracao = configuracoes[tipoSelecionado];
    labelRecurso.textContent = configuracao.label;
    const recursos = obterRecursosDisponiveis(tipoSelecionado);

    if (tipoSelecionado !== 'Moto') {
        const optionInicial = document.createElement('option');
        optionInicial.value = '';
        optionInicial.textContent = configuracao.placeholder;
        selectRecurso.appendChild(optionInicial);
    } else {
        selectRecurso.size = Math.min(Math.max(recursos.length, 2), 5);
    }

    recursos.forEach(recurso => {
        const option = document.createElement('option');
        option.value = recurso.id;
        option.dataset.tipo = recurso.tipo;
        option.textContent = recurso.texto;
        option.selected = valoresAtuais.includes(recurso.id);
        selectRecurso.appendChild(option);
    });

    const possuiRecursos = recursos.length > 0;
    selectRecurso.disabled = !possuiRecursos;
    selectRecurso.setAttribute('aria-disabled', String(!possuiRecursos));

    if (!possuiRecursos) {
        const optionVazia = document.createElement('option');
        optionVazia.value = '';
        optionVazia.textContent = 'Nenhum recurso disponível';
        selectRecurso.appendChild(optionVazia);
    }

    atualizarAjudaSelecaoRecurso(recursos.length);
}

// --- 2. FILTRA OS POR RECURSO ---
function filtrarOSPorRecurso() {
    const selectOS = document.getElementById('selectOS');
    if (!selectOS) return;

    popularTiposServicoAtivacao();

    const valorAtual = selectOS.value;
    const tipoSelecionado = normalizarTipoPoliciamento(
        document.getElementById('selectTipoPoliciamento')?.value
    );
    const ordens = lerListaLocalStorage('ordensServico');
    const ativas = ordens.filter(o => {
        if (!o || o.status !== 'Ativa') return false;
        const tipoOS = normalizarTipoOS(o.tipoRecurso);
        return !tipoSelecionado || !tipoOS || tipoOS === 'Geral' || tipoOS === tipoSelecionado;
    });

    selectOS.innerHTML = '<option value="">Selecione a OS...</option>';
    selectOS.disabled = ativas.length === 0;
    selectOS.setAttribute('aria-disabled', String(ativas.length === 0));

    if (ativas.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = 'Nenhuma OS ativa disponível';
        selectOS.appendChild(opt);
    } else {
        ativas
            .sort((a, b) => b.numero - a.numero)
            .forEach(os => {
                const opt = document.createElement('option');
                opt.value = os.numero;
                const op = (os.atividades || []).find(a => a.operacao)?.operacao;
                const textoOp = op ? ` | OP: ${op}` : '';
                opt.innerText = `OS ${os.numero} | ${os.nomeOS} | ${os.inicioGeral}-${os.terminoGeral}${textoOp}`;
                selectOS.appendChild(opt);
            });

        const aindaExiste = [...selectOS.options].some(option => option.value === valorAtual);
        if (valorAtual && aindaExiste) selectOS.value = valorAtual;
    }
}

function normalizarTipoOS(tipo) {
    if (!tipo) return '';
    const t = tipo.toLowerCase();
    if (t.includes('geral')) return 'Geral';
    if (t.includes('moto')) return 'Moto';
    if (t.includes('cabine')) return 'Cabine';
    if (t.includes('setor')) return 'Setor';
    if (t.includes('viatura') || t.includes('carro')) return 'Viatura';
    return '';
}

// --- EQUIPE, NO PADRÃO DE LANÇAMENTO PONTO A PONTO ---
function obterNomeGuerraPolicial(policial) {
    return String(policial?.nomeGuerra || policial?.nome || '').trim();
}

function normalizarPolicialId(policialId) {
    return String(policialId || '').trim();
}

function normalizarRgPolicial(rg) {
    return String(rg || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
}

function normalizarNomeGuerraPolicial(valor) {
    return String(valor || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleUpperCase('pt-BR');
}

function obterDigitosTelefonePolicial(valor) {
    return String(valor || '').replace(/\D/g, '').slice(0, 11);
}

function formatarTelefonePolicial(valor) {
    const digitos = obterDigitosTelefonePolicial(valor);
    if (!digitos) return '';
    if (digitos.length <= 2) return `(${digitos}`;

    const ddd = digitos.slice(0, 2);
    const numero = digitos.slice(2);
    if (numero.length <= 4) return `(${ddd}) ${numero}`;
    if (digitos.length <= 10) return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
}

function lerPoliciaisParaGravacao() {
    const valor = OrdenaStorage.getItem('policiais');
    if (valor == null) return [];

    const policiais = JSON.parse(valor);
    if (!Array.isArray(policiais)) {
        throw new Error('A chave policiais não contém uma lista.');
    }
    return policiais;
}

function encontrarPolicialCadastradoPorRg(policiais, rgNormalizado) {
    if (!rgNormalizado) return null;
    return policiais.find(policial => policial
        && typeof policial === 'object'
        && normalizarRgPolicial(policial.rgNormalizado || policial.rg) === rgNormalizado) || null;
}

function gerarIdPolicialAtivacao(policiais) {
    const idsExistentes = new Set(
        policiais.map(policial => String(policial?.id || '')).filter(Boolean)
    );

    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        let id = `policial_${window.crypto.randomUUID()}`;
        while (idsExistentes.has(id)) id = `policial_${window.crypto.randomUUID()}`;
        return id;
    }

    let sequencia = 0;
    let id;
    do {
        sequencia += 1;
        id = `policial_${Date.now()}_${sequencia}`;
    } while (idsExistentes.has(id));
    return id;
}

function aguardarAtualizacaoVisualAtivacao() {
    return new Promise(resolve => {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
            return;
        }
        window.setTimeout(resolve, 16);
    });
}

function mostrarFeedbackModalCadastroPolicial(tipo, mensagem) {
    const elemento = document.getElementById('feedbackModalCadastroPolicial');
    if (!elemento) return;
    elemento.textContent = mensagem;
    elemento.className = `page-feedback is-visible ${tipo}`;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function limparFeedbackModalCadastroPolicial() {
    const elemento = document.getElementById('feedbackModalCadastroPolicial');
    if (!elemento) return;
    elemento.textContent = '';
    elemento.className = 'page-feedback';
    elemento.removeAttribute('role');
}

function limparValidacaoModalCadastroPolicial() {
    document.querySelectorAll('#formModalCadastroPolicial [aria-invalid="true"]')
        .forEach(campo => campo.removeAttribute('aria-invalid'));
}

function falharValidacaoModalCadastroPolicial(campo, mensagem) {
    mostrarFeedbackModalCadastroPolicial('error', mensagem);
    campo?.setAttribute('aria-invalid', 'true');
    campo?.focus();
    return null;
}

function definirFundoCadastroPolicialInerte(inerte) {
    ['nav', '#sidebar', '#overlay', 'main'].forEach(seletor => {
        const elemento = document.querySelector(seletor);
        if (!elemento) return;
        if (inerte) {
            estadosInertesAntesModalCadastroPolicial.set(elemento, elemento.hasAttribute('inert'));
            elemento.setAttribute('inert', '');
            return;
        }
        if (estadosInertesAntesModalCadastroPolicial.get(elemento)) elemento.setAttribute('inert', '');
        else elemento.removeAttribute('inert');
    });
    if (!inerte) estadosInertesAntesModalCadastroPolicial.clear();
}

function manterFocoNoModalCadastroPolicial(evento, modal) {
    if (evento.key !== 'Tab') return;
    const elementos = Array.from(modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(elemento => elemento.offsetParent !== null);
    if (elementos.length === 0) return;

    const primeiro = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    if (!modal.contains(document.activeElement)) {
        evento.preventDefault();
        primeiro.focus();
    } else if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
    }
}

function configurarFluxoCadastroPolicialNaAtivacao() {
    const campoRg = document.getElementById('rgMembro');
    const campoNome = document.getElementById('nomeNovoPolicial');
    const campoTelefone = document.getElementById('telefoneNovoPolicial');
    const modal = document.getElementById('modalCadastroPolicial');

    campoRg?.addEventListener('input', evento => {
        evento.target.value = evento.target.value.toLocaleUpperCase('pt-BR').slice(0, 20);
        evento.target.removeAttribute('aria-invalid');
        rgNaoCadastradoPendente = '';
        limparIdentificacaoPolicialEditor(true);
        atualizarEstadoEditorEquipe();
        if (document.getElementById('feedbackAtivacao')?.classList.contains('error')) {
            limparFeedbackAtivacao();
        }
    });
    campoRg?.addEventListener('keydown', evento => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        adicionarIntegrante();
    });

    campoNome?.addEventListener('input', evento => {
        evento.target.value = evento.target.value.toLocaleUpperCase('pt-BR');
        evento.target.removeAttribute('aria-invalid');
        limparFeedbackModalCadastroPolicial();
    });
    campoTelefone?.addEventListener('input', evento => {
        evento.target.value = formatarTelefonePolicial(evento.target.value);
        evento.target.removeAttribute('aria-invalid');
        limparFeedbackModalCadastroPolicial();
    });
    document.getElementById('postoNovoPolicial')?.addEventListener('change', evento => {
        evento.target.removeAttribute('aria-invalid');
        limparFeedbackModalCadastroPolicial();
    });
    document.getElementById('motoMembro')?.addEventListener('change', evento => {
        evento.target.removeAttribute('aria-invalid');
    });

    document.getElementById('btnCadastrarPolicialEquipe')
        ?.addEventListener('click', abrirModalCadastroPolicial);
    document.getElementById('btnFecharCadastroPolicial')
        ?.addEventListener('click', fecharModalCadastroPolicial);
    document.getElementById('btnVoltarAtivacao')
        ?.addEventListener('click', fecharModalCadastroPolicial);
    document.getElementById('formModalCadastroPolicial')
        ?.addEventListener('submit', salvarPolicialPelaAtivacao);

    modal?.addEventListener('click', evento => {
        if (evento.target === modal) fecharModalCadastroPolicial();
    });
    document.addEventListener('keydown', evento => {
        if (!modal || modal.hidden) return;
        if (evento.key === 'Escape') {
            fecharModalCadastroPolicial();
            return;
        }
        manterFocoNoModalCadastroPolicial(evento, modal);
    });
}

function limparIdentificacaoPolicialEditor(manterRg = false) {
    const campoRg = document.getElementById('rgMembro');
    const select = document.getElementById('policialMembro');
    if (select) select.value = '';
    ['nomeMembro', 'postoMembro', 'telMembro'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
    });
    const campoNome = document.getElementById('nomeMembro');
    if (campoNome) campoNome.placeholder = 'Preenchido pelo RG';
    if (!manterRg && campoRg) campoRg.value = '';
    const detalhes = document.getElementById('detalhesPolicialSelecionado');
    if (detalhes) detalhes.textContent = '';
    const botaoCadastro = document.getElementById('btnCadastrarPolicialEquipe');
    if (botaoCadastro) botaoCadastro.hidden = true;
}

function mostrarOpcaoCadastroPolicial(rgDigitado) {
    rgNaoCadastradoPendente = normalizarRgPolicial(rgDigitado);
    limparIdentificacaoPolicialEditor(true);
    const nome = document.getElementById('nomeMembro');
    if (nome) nome.placeholder = 'Policial não cadastrado';
    const detalhes = document.getElementById('detalhesPolicialSelecionado');
    if (detalhes) detalhes.textContent = `Nenhum policial cadastrado com o RG ${rgDigitado}.`;
    const botaoCadastro = document.getElementById('btnCadastrarPolicialEquipe');
    if (botaoCadastro) botaoCadastro.hidden = false;
}

function abrirModalCadastroPolicial() {
    if (ativacaoEmAndamento || buscaPolicialEmAndamento || cadastroPolicialEmAndamento) return;
    const campoRgEquipe = document.getElementById('rgMembro');
    const rg = String(campoRgEquipe?.value || '').trim().toLocaleUpperCase('pt-BR');
    const rgNormalizado = normalizarRgPolicial(rg);
    if (!rgNormalizado || rgNormalizado !== rgNaoCadastradoPendente) {
        falharValidacaoAtivacao('Digite o RG e toque em Buscar antes de cadastrar o policial.', campoRgEquipe);
        return;
    }

    try {
        const policialExistente = encontrarPolicialCadastradoPorRg(
            lerPoliciaisParaGravacao(),
            rgNormalizado
        );
        if (policialExistente) {
            rgNaoCadastradoPendente = '';
            document.getElementById('btnCadastrarPolicialEquipe').hidden = true;
            const mensagem = policialEstaAtivo(policialExistente)
                ? 'Esse RG já foi cadastrado. Toque em Buscar para consultar novamente.'
                : 'Esse RG pertence a um policial inativo e não pode ser cadastrado novamente.';
            falharValidacaoAtivacao(mensagem, campoRgEquipe);
            return;
        }
    } catch (erro) {
        console.error('Erro ao conferir o RG antes do cadastro:', erro);
        mostrarFeedbackAtivacao('error', 'Não foi possível ler os cadastros atuais. Nenhum dado foi alterado.');
        return;
    }

    const formulario = document.getElementById('formModalCadastroPolicial');
    formulario?.reset();
    limparValidacaoModalCadastroPolicial();
    limparFeedbackModalCadastroPolicial();
    const campoRgModal = document.getElementById('rgNovoPolicial');
    if (campoRgModal) campoRgModal.value = rg;

    const modal = document.getElementById('modalCadastroPolicial');
    if (!modal) return;
    elementoRetornoModalCadastroPolicial = document.activeElement;
    definirFundoCadastroPolicialInerte(true);
    modal.hidden = false;
    document.body.classList.add('modal-aberto');
    window.requestAnimationFrame(() => document.getElementById('postoNovoPolicial')?.focus());
}

function fecharModalCadastroPolicial(opcoes = {}) {
    if (cadastroPolicialEmAndamento) return;
    const modal = document.getElementById('modalCadastroPolicial');
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    document.body.classList.remove('modal-aberto');
    definirFundoCadastroPolicialInerte(false);
    document.getElementById('formModalCadastroPolicial')?.reset();
    limparValidacaoModalCadastroPolicial();
    limparFeedbackModalCadastroPolicial();

    if (opcoes.restaurarFoco !== false) {
        const destino = elementoRetornoModalCadastroPolicial?.isConnected
            ? elementoRetornoModalCadastroPolicial
            : document.getElementById('rgMembro');
        destino?.focus();
    }
    elementoRetornoModalCadastroPolicial = null;
}

function lerDadosModalCadastroPolicial() {
    const campoPosto = document.getElementById('postoNovoPolicial');
    const campoNome = document.getElementById('nomeNovoPolicial');
    const campoRg = document.getElementById('rgNovoPolicial');
    const campoTelefone = document.getElementById('telefoneNovoPolicial');
    const posto = String(campoPosto?.value || '').trim();
    const nomeGuerra = normalizarNomeGuerraPolicial(campoNome?.value);
    const rg = String(campoRg?.value || '').trim().toLocaleUpperCase('pt-BR');
    const rgNormalizado = normalizarRgPolicial(rg);
    const telefoneDigitos = obterDigitosTelefonePolicial(campoTelefone?.value);

    if (!POSTOS_GRADUACOES_POLICIAIS.includes(posto)) {
        return falharValidacaoModalCadastroPolicial(campoPosto, 'Selecione o posto/graduação do policial.');
    }
    if (!nomeGuerra) {
        return falharValidacaoModalCadastroPolicial(campoNome, 'Informe o nome de guerra do policial.');
    }
    if (!rgNormalizado || rgNormalizado !== rgNaoCadastradoPendente) {
        return falharValidacaoModalCadastroPolicial(campoRg, 'O RG da ativação mudou. Volte e faça a consulta novamente.');
    }
    if (![10, 11].includes(telefoneDigitos.length)) {
        return falharValidacaoModalCadastroPolicial(campoTelefone, 'Informe um telefone válido, com DDD e 10 ou 11 dígitos.');
    }

    if (campoNome) campoNome.value = nomeGuerra;
    if (campoTelefone) campoTelefone.value = formatarTelefonePolicial(telefoneDigitos);
    return {
        posto,
        nomeGuerra,
        rg,
        rgNormalizado,
        telefone: formatarTelefonePolicial(telefoneDigitos)
    };
}

function definirCadastroPolicialProcessando(processando) {
    cadastroPolicialEmAndamento = processando;
    const formulario = document.getElementById('formModalCadastroPolicial');
    const botaoSalvar = document.getElementById('btnSalvarCadastroPolicial');
    const texto = document.getElementById('textoBtnSalvarCadastroPolicial');
    const loading = document.getElementById('loadingSalvarCadastroPolicial');
    formulario?.setAttribute('aria-busy', String(processando));
    ['postoNovoPolicial', 'nomeNovoPolicial', 'telefoneNovoPolicial', 'btnVoltarAtivacao', 'btnFecharCadastroPolicial']
        .forEach(id => {
            const controle = document.getElementById(id);
            if (controle) controle.disabled = processando;
        });
    if (!botaoSalvar || !texto || !loading) return;
    botaoSalvar.disabled = processando;
    botaoSalvar.setAttribute('aria-busy', String(processando));
    texto.textContent = processando ? 'Cadastrando...' : 'Cadastrar e incluir';
    loading.hidden = !processando;
}

async function salvarPolicialPelaAtivacao(evento) {
    evento.preventDefault();
    if (cadastroPolicialEmAndamento) return;
    limparFeedbackModalCadastroPolicial();
    limparValidacaoModalCadastroPolicial();
    const dados = lerDadosModalCadastroPolicial();
    if (!dados) return;

    try {
        const policiaisAtuais = lerPoliciaisParaGravacao();
        if (encontrarPolicialCadastradoPorRg(policiaisAtuais, dados.rgNormalizado)) {
            falharValidacaoModalCadastroPolicial(
                document.getElementById('rgNovoPolicial'),
                'Já existe um policial cadastrado com esse RG, inclusive entre os inativos.'
            );
            return;
        }
    } catch (erro) {
        console.error('Erro ao ler os policiais antes do cadastro:', erro);
        mostrarFeedbackModalCadastroPolicial('error', 'Não foi possível ler os cadastros atuais. Nenhum dado foi alterado.');
        return;
    }

    definirCadastroPolicialProcessando(true);
    await aguardarAtualizacaoVisualAtivacao();

    let policialCriado = null;
    try {
        const policiais = lerPoliciaisParaGravacao();
        if (encontrarPolicialCadastradoPorRg(policiais, dados.rgNormalizado)) {
            throw new Error('Já existe um policial cadastrado com esse RG, inclusive entre os inativos.');
        }

        const agora = new Date().toISOString();
        policialCriado = {
            id: gerarIdPolicialAtivacao(policiais),
            ...dados,
            status: 'Ativo',
            criadoEm: agora,
            atualizadoEm: agora
        };
        policiais.push(policialCriado);
        await OrdenaStorage.setItem('policiais', JSON.stringify(policiais));
    } catch (erro) {
        console.error('Erro ao cadastrar o policial pela ativação:', erro);
        policialCriado = null;
        mostrarFeedbackModalCadastroPolicial(
            'error',
            erro.message === 'Já existe um policial cadastrado com esse RG, inclusive entre os inativos.'
                ? erro.message
                : 'Não foi possível cadastrar o policial. Tente novamente.'
        );
    } finally {
        definirCadastroPolicialProcessando(false);
    }

    if (!policialCriado) return;
    rgNaoCadastradoPendente = '';
    fecharModalCadastroPolicial({ restaurarFoco: false });
    const campoRgEquipe = document.getElementById('rgMembro');
    if (campoRgEquipe) campoRgEquipe.value = policialCriado.rg;
    await adicionarIntegrante({ policialCadastradoAgora: policialCriado });
}

function policialEstaAtivo(policial) {
    const status = String(policial?.status || 'Ativo')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    return status === 'ativo' || status === 'ativa';
}

function obterPoliciaisAtivos() {
    return lerListaLocalStorage('policiais')
        .filter(policial => policial
            && normalizarPolicialId(policial.id)
            && policialEstaAtivo(policial))
        .sort((a, b) => obterNomeGuerraPolicial(a).localeCompare(
            obterNomeGuerraPolicial(b),
            'pt-BR',
            { numeric: true, sensitivity: 'base' }
        ));
}

function obterPolicialAtivoPorId(policialId) {
    const id = normalizarPolicialId(policialId);
    if (!id) return null;
    return obterPoliciaisAtivos().find(policial =>
        normalizarPolicialId(policial.id) === id
    ) || null;
}

function obterVinculosPoliciaisEmServico() {
    const ids = new Set();
    const rgs = new Set();

    lerListaLocalStorage('escalasAtivas').forEach(escala => {
        if (!Array.isArray(escala?.equipe)) return;
        escala.equipe.forEach(membro => {
            const policialId = normalizarPolicialId(membro?.policialId);
            const rg = normalizarRgPolicial(membro?.rg);
            if (policialId) ids.add(policialId);
            if (rg) rgs.add(rg);
        });
    });

    return { ids, rgs };
}

function policialEstaEmServico(policial, vinculos) {
    const policialId = normalizarPolicialId(policial?.id);
    const rg = normalizarRgPolicial(policial?.rg);
    return (policialId && vinculos.ids.has(policialId))
        || (rg && vinculos.rgs.has(rg));
}

function obterRotuloPolicial(policial) {
    const identificacao = [policial?.posto, obterNomeGuerraPolicial(policial)]
        .map(valor => String(valor || '').trim())
        .filter(Boolean)
        .join(' — ');
    const rg = String(policial?.rg || '').trim();
    return `${identificacao || 'Policial'}${rg ? ` — RG ${rg}` : ''}`;
}

function popularPoliciaisEquipe(valorPreferido) {
    const select = document.getElementById('policialMembro');
    if (!select) return;

    const rgDigitado = document.getElementById('rgMembro')?.value || '';
    const editando = indiceMembroEmEdicao >= 0;
    const membroEditado = editando ? membrosEquipe[indiceMembroEmEdicao] : null;
    const valorAtual = normalizarPolicialId(
        valorPreferido !== undefined
            ? valorPreferido
            : (select.value || membroEditado?.policialId || '')
    );
    const idsJaAdicionados = new Set(
        membrosEquipe
            .filter((_, index) => index !== indiceMembroEmEdicao)
            .map(membro => normalizarPolicialId(membro.policialId))
            .filter(Boolean)
    );
    const policiaisAtivos = obterPoliciaisAtivos();
    const vinculosEmServico = obterVinculosPoliciaisEmServico();
    const policiaisForaDeServico = policiaisAtivos.filter(policial =>
        !policialEstaEmServico(policial, vinculosEmServico)
    );
    const policiaisDisponiveis = policiaisForaDeServico.filter(policial => {
        const policialId = normalizarPolicialId(policial.id);
        return !idsJaAdicionados.has(policialId) || policialId === valorAtual;
    });

    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    if (policiaisAtivos.length === 0) {
        placeholder.textContent = 'Nenhum policial ativo cadastrado';
    } else if (policiaisForaDeServico.length === 0) {
        placeholder.textContent = 'Nenhum policial ativo disponível';
    } else if (policiaisDisponiveis.length === 0) {
        placeholder.textContent = 'Todos os policiais ativos já foram adicionados';
    } else {
        placeholder.textContent = 'Selecione o policial...';
    }
    select.appendChild(placeholder);

    policiaisDisponiveis.forEach(policial => {
        const option = document.createElement('option');
        option.value = normalizarPolicialId(policial.id);
        option.textContent = obterRotuloPolicial(policial);
        select.appendChild(option);
    });

    const valorDisponivel = [...select.options].some(option => option.value === valorAtual);
    if (valorAtual
        && !valorDisponivel
        && normalizarPolicialId(membroEditado?.policialId) === valorAtual) {
        const option = document.createElement('option');
        option.value = valorAtual;
        option.textContent = `${obterRotuloPolicial({
            posto: membroEditado.posto,
            nomeGuerra: membroEditado.nome,
            rg: membroEditado.rg
        })} — indisponível`;
        option.disabled = true;
        select.appendChild(option);
    }

    if ([...select.options].some(option => option.value === valorAtual)) {
        select.value = valorAtual;
    }

    select.disabled = policiaisDisponiveis.length === 0 && !editando;
    select.setAttribute('aria-disabled', String(select.disabled));
    const policialSelecionado = policiaisAtivos.find(policial =>
        normalizarPolicialId(policial.id) === select.value
    );
    preencherDadosPolicialSelecionado(
        policialSelecionado,
        select.value && normalizarPolicialId(membroEditado?.policialId) === select.value
            ? membroEditado
            : null
    );
    if (!policialSelecionado && !select.value && rgDigitado) {
        document.getElementById('rgMembro').value = rgDigitado;
    }
}

function preencherDadosPolicialSelecionado(policial, fallback) {
    const dados = policial || fallback || {};
    const nome = document.getElementById('nomeMembro');
    const posto = document.getElementById('postoMembro');
    const rg = document.getElementById('rgMembro');
    const telefone = document.getElementById('telMembro');
    const detalhes = document.getElementById('detalhesPolicialSelecionado');
    if (nome) {
        nome.value = obterNomeGuerraPolicial(dados);
        nome.placeholder = 'Preenchido pelo RG';
    }
    if (posto) posto.value = String(dados.posto || '');
    if (rg) rg.value = String(dados.rg || '');
    if (telefone) telefone.value = String(dados.telefone || dados.tel || '');
    if (detalhes) {
        const nomeGuerra = obterNomeGuerraPolicial(dados);
        detalhes.textContent = nomeGuerra
            ? `Policial localizado: ${String(dados.posto || '').trim()} ${nomeGuerra}, RG ${String(dados.rg || '').trim()}, telefone ${String(dados.telefone || dados.tel || '').trim()}.`
            : '';
    }
}

function aoSelecionarPolicialEquipe() {
    if (ativacaoEmAndamento) return;
    limparFeedbackAtivacao();
    const policialId = document.getElementById('policialMembro')?.value || '';
    preencherDadosPolicialSelecionado(obterPolicialAtivoPorId(policialId));
}

function tipoMotoEstaSelecionado() {
    return normalizarTipoPoliciamento(
        document.getElementById('selectTipoPoliciamento')?.value
    ) === 'Moto';
}

function obterMotosSelecionadasComRotulo() {
    if (!tipoMotoEstaSelecionado()) return [];
    return obterRecursosDisponiveis('Moto').map(moto => ({
        id: moto.id,
        texto: moto.texto.replace(/^Moto\s*•\s*/i, '')
    }));
    // const selectRecurso = document.getElementById('selectRecurso');
    // if (!selectRecurso || !tipoMotoEstaSelecionado()) return [];
    // 
    // const motos = new Map();
    // [...selectRecurso.selectedOptions]
    // .filter(option => option.value)
    // .forEach(option => {
    // const id = String(option.value);
    // if (!motos.has(id)) {
    // motos.set(id, {
    // id,
    // texto: option.textContent.replace(/^Moto\s*•\s*/i, '')
    // });
    // }
    // });
    // return [...motos.values()];
}

function obterRotuloMoto(prefixo) {
    if (!prefixo) return '-';
    return obterMotosSelecionadasComRotulo().find(moto => moto.id === prefixo)?.texto || prefixo;
}

function atualizarColunaMotoEquipe() {
    const exibir = tipoMotoEstaSelecionado();
    document.querySelectorAll('.coluna-moto-equipe').forEach(elemento => {
        elemento.hidden = !exibir;
    });
}

function atualizarSelectMotosEditor(valorPreferido) {
    const selectMoto = document.getElementById('motoMembro');
    if (!selectMoto) return;

    const valorAtual = valorPreferido !== undefined ? valorPreferido : selectMoto.value;
    const motosAtribuidas = new Set(
        membrosEquipe
            .filter((_, index) => index !== indiceMembroEmEdicao)
            .map(membro => membro.motoPrefixo)
            .filter(Boolean)
    );
    const motos = obterMotosSelecionadasComRotulo();

    selectMoto.innerHTML = '<option value="">Sem moto vinculada</option>';
    motos.filter(moto => !motosAtribuidas.has(moto.id)).forEach(moto => {
        const option = document.createElement('option');
        option.value = moto.id;
        option.textContent = moto.texto;
        option.disabled = motosAtribuidas.has(moto.id) && moto.id !== valorAtual;
        option.selected = moto.id === valorAtual;
        selectMoto.appendChild(option);
    });

    const opcoesLivres = motos.filter(moto => !motosAtribuidas.has(moto.id));
    if (!valorAtual && indiceMembroEmEdicao === -1 && opcoesLivres.length === 1) {
        selectMoto.value = opcoesLivres[0].id;
    }
}

function atualizarEstadoEditorEquipe() {
    const editor = document.getElementById('editorEquipe');
    const funcao = document.getElementById('funcaoMembro');
    const btnSalvar = document.getElementById('btnAdicionarMembro');
    const btnCancelar = document.getElementById('btnCancelarEdicaoMembro');
    const btnCadastrar = document.getElementById('btnCadastrarPolicialEquipe');
    const acoes = document.getElementById('acoesEditorEquipe');
    const campoRg = document.getElementById('rgMembro');
    const textoBtnSalvar = document.getElementById('textoBtnAdicionarMembro');
    const loadingBtnSalvar = document.getElementById('loadingAdicionarMembro');
    if (!editor || !funcao || !btnSalvar || !btnCancelar || !acoes || !campoRg) return;

    const editando = indiceMembroEmEdicao >= 0;
    const funcaoAtual = editando
        ? membrosEquipe[indiceMembroEmEdicao]?.funcao
        : (membrosEquipe.length === 0 ? 'Comandante' : 'Auxiliar');
    const comandante = funcaoAtual === 'Comandante';

    editor.hidden = !editando && membrosEquipe.length >= MAX_MEMBROS_EQUIPE;
    editor.classList.toggle('equipe-em-edicao', editando);
    editor.setAttribute('aria-label', editando ? 'Editar policial da equipe' : 'Adicionar policial à equipe');
    funcao.textContent = comandante ? 'Comandante' : 'Integrante';
    // const textoPadrao = editando ? 'Buscar e atualizar' : 'Buscar';
    const textoPadrao = 'Buscar';
    if (textoBtnSalvar) {
        textoBtnSalvar.textContent = buscaPolicialEmAndamento ? 'Buscando...' : textoPadrao;
    }
    if (loadingBtnSalvar) loadingBtnSalvar.hidden = !buscaPolicialEmAndamento;
    btnSalvar.className = editando ? 'btn-success' : 'btn-info';
    const possuiRg = Boolean(normalizarRgPolicial(campoRg.value));
    btnSalvar.disabled = !possuiRg || buscaPolicialEmAndamento;
    btnSalvar.setAttribute('aria-disabled', String(btnSalvar.disabled));
    btnSalvar.setAttribute('aria-busy', String(buscaPolicialEmAndamento));
    campoRg.disabled = buscaPolicialEmAndamento;
    btnCancelar.hidden = !editando && !possuiRg;
    btnCancelar.disabled = buscaPolicialEmAndamento;
    // btnCancelar.textContent = editando ? 'Cancelar edição' : 'Cancelar inclusão';
    btnCancelar.textContent = 'Cancelar';
    if (btnCadastrar) {
        const rgAtual = normalizarRgPolicial(campoRg.value);
        btnCadastrar.hidden = !rgNaoCadastradoPendente
            || rgAtual !== rgNaoCadastradoPendente;
        btnCadastrar.disabled = buscaPolicialEmAndamento;
    }
    acoes.classList.toggle('em-edicao', editando);
    acoes.classList.toggle('com-cancelamento', editando || possuiRg);
}

function definirBuscaPolicialProcessando(processando) {
    buscaPolicialEmAndamento = processando;
    const editor = document.getElementById('editorEquipe');
    if (editor) editor.setAttribute('aria-busy', String(processando));
    const campoMoto = document.getElementById('motoMembro');
    if (campoMoto) campoMoto.disabled = processando;
    atualizarEstadoEditorEquipe();
}

function renderizarEquipe() {
    const tbody = document.getElementById('listaIntegrantes');
    const editor = document.getElementById('editorEquipe');
    const resumo = document.getElementById('resumoEquipe');
    if (!tbody || !editor || !resumo) return;

    document.getElementById('listaIntegrantesDepoisEditor')?.remove();
    tbody.innerHTML = '';
    let tbodyDepoisEditor = null;
    if (indiceMembroEmEdicao >= 0) {
        tbodyDepoisEditor = document.createElement('tbody');
        tbodyDepoisEditor.id = 'listaIntegrantesDepoisEditor';
        editor.insertAdjacentElement('afterend', tbodyDepoisEditor);
    }

    membrosEquipe.forEach((membro, index) => {
        const comandante = membro.funcao === 'Comandante' || index === 0;
        // Durante a edição, o formulário ocupa exatamente o lugar da linha selecionada.
        if (index === indiceMembroEmEdicao) return;

        const linha = document.createElement('tr');
        const classeAcoes = comandante ? 'equipe-acoes' : 'equipe-acoes com-remocao';
        const botaoRemover = comandante
            ? ''
            : `<button type="button" class="btn-danger" onclick="removerLinhaIntegrante(${index})" ${indiceMembroEmEdicao >= 0 ? 'disabled aria-disabled="true"' : ''}>Remover</button>`;

        linha.innerHTML = `
            <td data-label="Função"><strong>${comandante ? 'Comandante' : 'Integrante'}</strong></td>
            <td data-label="RG">${escaparHtml(membro.rg)}</td>
            <td data-label="Nome de Guerra">${escaparHtml(membro.nome)}</td>
            <td data-label="Posto/Grad">${escaparHtml(membro.posto)}</td>
            <td data-label="Telefone">${escaparHtml(membro.tel || '-')}</td>
            <td data-label="Moto" class="coluna-moto-equipe" ${tipoMotoEstaSelecionado() ? '' : 'hidden'}>${escaparHtml(obterRotuloMoto(membro.motoPrefixo))}</td>
            <td data-label="Ações">
                <div class="${classeAcoes}">
                    <button type="button" class="btn-warning" onclick="editarMembroEquipe(${index})" ${indiceMembroEmEdicao >= 0 ? 'disabled aria-disabled="true"' : ''}>${index === indiceMembroEmEdicao ? 'Editando' : 'Editar'}</button>
                    ${botaoRemover}
                </div>
            </td>
        `;
        const destino = indiceMembroEmEdicao >= 0 && index > indiceMembroEmEdicao
            ? tbodyDepoisEditor
            : tbody;
        destino.appendChild(linha);
    });

    const motosAtribuidas = membrosEquipe.filter(membro => membro.motoPrefixo).length;
    resumo.textContent = membrosEquipe.length === 0
        ? 'Nenhum policial adicionado.'
        : `${membrosEquipe.length} policial(is) adicionado(s)${tipoMotoEstaSelecionado() ? ` • ${motosAtribuidas} moto(s) vinculada(s)` : ''}.`;

    atualizarColunaMotoEquipe();
    popularPoliciaisEquipe();
    atualizarEstadoEditorEquipe();
    atualizarSelectMotosEditor();
}

function lerDadosEditorEquipe() {
    const policialId = document.getElementById('policialMembro')?.value || '';
    const policial = obterPolicialAtivoPorId(policialId);
    return {
        policialId: normalizarPolicialId(policial?.id || policialId),
        posto: String(policial?.posto || '').trim(),
        nome: obterNomeGuerraPolicial(policial),
        rg: String(policial?.rg || '').trim(),
        tel: String(policial?.telefone || policial?.tel || '').trim(),
        motoPrefixo: tipoMotoEstaSelecionado()
            ? (document.getElementById('motoMembro')?.value || '')
            : ''
    };
}

function criarSnapshotCadastroPolicial(policial) {
    return {
        policialId: normalizarPolicialId(policial?.id),
        posto: String(policial?.posto || '').trim(),
        nome: obterNomeGuerraPolicial(policial),
        rg: String(policial?.rg || '').trim(),
        tel: String(policial?.telefone || policial?.tel || '').trim()
    };
}

function cadastroPolicialEstaCompleto(policial) {
    const snapshot = criarSnapshotCadastroPolicial(policial);
    return Boolean(
        snapshot.policialId
        && snapshot.posto
        && snapshot.nome
        && snapshot.rg
        && snapshot.tel
    );
}

function dadosCadastraisMembroMudaram(membro, policial) {
    const snapshot = criarSnapshotCadastroPolicial(policial);
    return snapshot.policialId !== normalizarPolicialId(membro?.policialId)
        || snapshot.posto !== String(membro?.posto || '').trim()
        || snapshot.nome !== String(membro?.nome || '').trim()
        || snapshot.rg !== String(membro?.rg || '').trim()
        || snapshot.tel !== String(membro?.tel || '').trim();
}

function editorEquipeTemDados() {
    return Boolean(normalizarRgPolicial(document.getElementById('rgMembro')?.value));
}

function limparEditorEquipe() {
    rgNaoCadastradoPendente = '';
    ['policialMembro', 'nomeMembro', 'postoMembro', 'rgMembro', 'telMembro', 'motoMembro'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
    });
    const campoNome = document.getElementById('nomeMembro');
    if (campoNome) campoNome.placeholder = 'Preenchido pelo RG';
    const detalhes = document.getElementById('detalhesPolicialSelecionado');
    if (detalhes) detalhes.textContent = '';
    const botaoCadastro = document.getElementById('btnCadastrarPolicialEquipe');
    if (botaoCadastro) botaoCadastro.hidden = true;
    document.querySelectorAll('#editorEquipe [aria-invalid="true"]')
        .forEach(campo => campo.removeAttribute('aria-invalid'));
}

function preencherEditorEquipe(membro) {
    const dados = membro || {};
    const policialId = normalizarPolicialId(dados.policialId);
    const rgDigitado = String(dados.rgDigitado || dados.rg || '');
    rgNaoCadastradoPendente = '';
    popularPoliciaisEquipe(policialId);
    const policialSelecionadoId = normalizarPolicialId(
        document.getElementById('policialMembro')?.value
    );
    preencherDadosPolicialSelecionado(
        obterPolicialAtivoPorId(policialSelecionadoId),
        policialId && policialSelecionadoId === policialId ? dados : null
    );
    if (!policialSelecionadoId && rgDigitado) {
        limparIdentificacaoPolicialEditor(true);
        document.getElementById('rgMembro').value = rgDigitado;
    }
    atualizarSelectMotosEditor(dados.motoPrefixo || '');
    atualizarEstadoEditorEquipe();
}

function restaurarRascunhoEditorEquipe(rascunho) {
    if (!rascunho) return;

    const motosAtribuidas = new Set(membrosEquipe.map(membro => membro.motoPrefixo).filter(Boolean));
    preencherEditorEquipe({
        ...rascunho,
        motoPrefixo: motosAtribuidas.has(rascunho.motoPrefixo) ? '' : rascunho.motoPrefixo
    });
}

async function adicionarIntegrante(opcoes = {}) {
    if (ativacaoEmAndamento || buscaPolicialEmAndamento) return false;
    if (indiceMembroEmEdicao === -1 && membrosEquipe.length >= MAX_MEMBROS_EQUIPE) {
        mostrarFeedbackAtivacao('error', `A equipe pode ter no máximo ${MAX_MEMBROS_EQUIPE} policiais.`);
        return false;
    }

    const campoRg = document.getElementById('rgMembro');
    const rgDigitado = String(campoRg?.value || '').trim().toLocaleUpperCase('pt-BR');
    const rgNormalizado = normalizarRgPolicial(rgDigitado);
    if (!rgNormalizado) {
        return falharValidacaoAtivacao('Digite o RG do policial.', campoRg);
    }

    const funcao = indiceMembroEmEdicao >= 0
        ? membrosEquipe[indiceMembroEmEdicao].funcao
        : (membrosEquipe.length === 0 ? 'Comandante' : 'Auxiliar');
    let alvoFocoAposBusca = null;
    const falharBusca = (mensagem, alvo = campoRg) => {
        mostrarFeedbackAtivacao('error', mensagem);
        alvo?.setAttribute('aria-invalid', 'true');
        alvoFocoAposBusca = alvo;
        return false;
    };

    limparFeedbackAtivacao();
    campoRg?.removeAttribute('aria-invalid');
    document.getElementById('motoMembro')?.removeAttribute('aria-invalid');
    rgNaoCadastradoPendente = '';
    limparIdentificacaoPolicialEditor(true);
    definirBuscaPolicialProcessando(true);
    await aguardarAtualizacaoVisualAtivacao();

    try {
        const policiais = lerPoliciaisParaGravacao();
        const policialCadastrado = encontrarPolicialCadastradoPorRg(policiais, rgNormalizado);
        if (!policialCadastrado) {
            mostrarOpcaoCadastroPolicial(rgDigitado);
            return falharBusca('Policial não cadastrado. Confira o RG ou escolha Cadastrar.');
        }

        preencherDadosPolicialSelecionado(policialCadastrado);
        const policialId = normalizarPolicialId(policialCadastrado.id);
        if (!policialEstaAtivo(policialCadastrado)) {
            return falharBusca('Esse RG pertence a um policial inativo. Reative o cadastro antes de incluí-lo.');
        }
        if (!policialId) {
            return falharBusca('O cadastro encontrado está sem identificador. Atualize o cadastro antes de montar a equipe.');
        }

        const policialDuplicado = membrosEquipe.some((membro, index) =>
            index !== indiceMembroEmEdicao
                && normalizarPolicialId(membro.policialId) === policialId
        );
        if (policialDuplicado) {
            return falharBusca('Esse policial já foi adicionado à equipe.');
        }
        if (policialEstaEmServico(policialCadastrado, obterVinculosPoliciaisEmServico())) {
            return falharBusca('Esse policial já integra outra guarnição ativa e não está disponível.');
        }
        if (!cadastroPolicialEstaCompleto(policialCadastrado)) {
            return falharBusca('O cadastro do policial está incompleto. Atualize-o antes de montar a equipe.');
        }

        popularPoliciaisEquipe(policialId);
        const selectPolicial = document.getElementById('policialMembro');
        if (!selectPolicial || normalizarPolicialId(selectPolicial.value) !== policialId) {
            return falharBusca('Esse policial não está disponível para inclusão nesta equipe.');
        }
        preencherDadosPolicialSelecionado(policialCadastrado);
        const dados = lerDadosEditorEquipe();

        if (dados.motoPrefixo) {
            const motosSelecionadas = new Set(obterRecursosDisponiveis('Moto').map(moto => moto.id));
            if (!motosSelecionadas.has(dados.motoPrefixo)) {
                return falharBusca(
                    'Selecione uma moto ativa e disponível ao lado do nome do integrante.',
                    document.getElementById('motoMembro')
                );
            }
            const motoDuplicada = membrosEquipe.some((membro, index) =>
                index !== indiceMembroEmEdicao && membro.motoPrefixo === dados.motoPrefixo
            );
            if (motoDuplicada) {
                return falharBusca(
                    'Essa moto já está vinculada a outro policial.',
                    document.getElementById('motoMembro')
                );
            }
        }

        const membro = { ...dados, funcao };
        const editando = indiceMembroEmEdicao >= 0;
        if (editando) membrosEquipe[indiceMembroEmEdicao] = membro;
        else membrosEquipe.push(membro);

        const rascunhoAnterior = editando ? rascunhoEditorAntesEdicao : null;
        indiceMembroEmEdicao = -1;
        rascunhoEditorAntesEdicao = null;
        limparEditorEquipe();
        renderizarEquipe();
        restaurarRascunhoEditorEquipe(rascunhoAnterior);
        const mensagemSucesso = opcoes.policialCadastradoAgora
            ? `Policial “${obterNomeGuerraPolicial(opcoes.policialCadastradoAgora)}” cadastrado e incluído como ${funcao === 'Comandante' ? 'comandante' : 'integrante'}.`
            : (editando
                ? 'Policial atualizado na equipe.'
                : `${funcao === 'Comandante' ? 'Comandante' : 'Integrante'} adicionado à equipe.`);
        mostrarFeedbackAtivacao('success', mensagemSucesso);
        window.requestAnimationFrame(focarEditorOuResumoEquipe);
        return true;
    } catch (erro) {
        console.error('Erro ao consultar o policial pelo RG:', erro);
        return falharBusca('Não foi possível consultar os policiais cadastrados. Tente novamente.');
    } finally {
        definirBuscaPolicialProcessando(false);
        if (alvoFocoAposBusca) {
            window.requestAnimationFrame(() => {
                alvoFocoAposBusca.removeAttribute('disabled');
                alvoFocoAposBusca.focus();
                alvoFocoAposBusca.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            });
        }
    }
}

function focarEditorOuResumoEquipe() {
    const editor = document.getElementById('editorEquipe');
    const campoRg = document.getElementById('rgMembro');
    if (editor && !editor.hidden && campoRg && !campoRg.disabled) {
        campoRg.focus();
        return;
    }
    document.getElementById('resumoEquipe')?.focus();
}

function editarMembroEquipe(index) {
    if (ativacaoEmAndamento || indiceMembroEmEdicao >= 0 || !membrosEquipe[index]) return;
    rascunhoEditorAntesEdicao = {
        ...lerDadosEditorEquipe(),
        rgDigitado: document.getElementById('rgMembro')?.value || ''
    };
    indiceMembroEmEdicao = index;
    preencherEditorEquipe(membrosEquipe[index]);
    renderizarEquipe();
    document.getElementById('rgMembro')?.focus();
    mostrarFeedbackAtivacao('info', `Editando ${index === 0 ? 'o comandante' : 'o integrante selecionado'}. Busque o RG desejado ou cancele a alteração.`);
}

function cancelarEdicaoMembro(exibirFeedback = true) {
    const estavaEditando = indiceMembroEmEdicao >= 0;
    const tinhaInclusaoPendente = !estavaEditando && editorEquipeTemDados();
    const rascunhoAnterior = estavaEditando ? rascunhoEditorAntesEdicao : null;
    indiceMembroEmEdicao = -1;
    rascunhoEditorAntesEdicao = null;
    limparEditorEquipe();
    renderizarEquipe();
    restaurarRascunhoEditorEquipe(rascunhoAnterior);
    if (estavaEditando && exibirFeedback) {
        mostrarFeedbackAtivacao('info', 'Edição cancelada. Nenhum dado da equipe foi alterado.');
    } else if (tinhaInclusaoPendente && exibirFeedback) {
        const equipePossuiComandante = membrosEquipe.length > 0
            && membrosEquipe[0]?.funcao === 'Comandante';
        const mensagem = equipePossuiComandante
            ? 'Inclusão cancelada. Os policiais já adicionados foram mantidos.'
            : 'Inclusão cancelada. Nenhum policial foi adicionado.';
        mostrarFeedbackAtivacao('info', mensagem);
    }
    if (tinhaInclusaoPendente
        && exibirFeedback
        && membrosEquipe[0]?.funcao === 'Comandante') {
        document.getElementById('btnAtivarGuarnicao')?.focus();
        return;
    }
    focarEditorOuResumoEquipe();
}

function removerLinhaIntegrante(index) {
    if (ativacaoEmAndamento || indiceMembroEmEdicao >= 0 || index <= 0 || !membrosEquipe[index]) return;
    membrosEquipe.splice(index, 1);
    renderizarEquipe();
    mostrarFeedbackAtivacao('success', 'Integrante removido da equipe.');
    focarEditorOuResumoEquipe();
}

function definirEstadoAtivacaoEmAndamento(emAndamento) {
    ativacaoEmAndamento = emAndamento;
    const formulario = document.getElementById('escalamentoForm');
    const botao = document.getElementById('btnAtivarGuarnicao');
    const texto = document.getElementById('textoBtnAtivarGuarnicao');
    const loading = document.getElementById('loadingAtivarGuarnicao');

    if (formulario) {
        formulario.classList.toggle('is-processing', emAndamento);
        formulario.setAttribute('aria-busy', String(emAndamento));
        formulario.toggleAttribute('inert', emAndamento);
    }
    if (!botao || !texto || !loading) return;

    botao.disabled = emAndamento;
    botao.setAttribute('aria-busy', String(emAndamento));
    texto.textContent = emAndamento ? 'Ativando guarnição...' : 'Ativar Guarnição e Iniciar Turno';
    loading.hidden = !emAndamento;
}

function resetarFormularioAtivacao() {
    document.getElementById('escalamentoForm')?.reset();
    membrosEquipe = [];
    indiceMembroEmEdicao = -1;
    rascunhoEditorAntesEdicao = null;
    ultimoTipoPoliciamento = '';
    limparEditorEquipe();
    popularTiposPoliciamentoAtivacao();
    popularRecursosFisicos(false);
    popularTiposServicoAtivacao();
    filtrarOSPorRecurso();
    renderizarEquipe();
}

// --- SALVAR ATIVAÇÃO ---
document.getElementById('escalamentoForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (ativacaoEmAndamento) return;
    limparFeedbackAtivacao();

    const selectTipo = document.getElementById('selectTipoPoliciamento');
    const selectRecurso = document.getElementById('selectRecurso');
    const selectServico = document.getElementById('selectTipoServico');
    const selectOS = document.getElementById('selectOS');
    const tipoPoliciamentoSelecionado = normalizarTipoPoliciamento(selectTipo?.value);
    if (!tipoPoliciamentoSelecionado) {
        return falharValidacaoAtivacao('Selecione o tipo de policiamento.', selectTipo);
    }

    const recursoIds = obterIdsRecursosSelecionados();
    if (recursoIds.length === 0) {
        return falharValidacaoAtivacao(`Selecione ${tipoPoliciamentoSelecionado === 'Moto' ? 'ao menos uma moto ao lado do nome do integrante' : 'o recurso da guarnição'}.`, selectRecurso);
    }
    if (tipoPoliciamentoSelecionado !== 'Moto' && recursoIds.length !== 1) {
        return falharValidacaoAtivacao('Selecione apenas um recurso para esse tipo de policiamento.', selectRecurso);
    }
    if (tipoPoliciamentoSelecionado === 'Moto' && recursoIds.length > MAX_MEMBROS_EQUIPE) {
        return falharValidacaoAtivacao(`Selecione no máximo ${MAX_MEMBROS_EQUIPE} motos por guarnição.`, selectRecurso);
    }

    const idsAindaDisponiveis = new Set(
        obterRecursosDisponiveis(tipoPoliciamentoSelecionado).map(recurso => recurso.id)
    );
    if (recursoIds.some(id => !idsAindaDisponiveis.has(id))) {
        popularRecursosFisicos(false);
        return falharValidacaoAtivacao('Um dos recursos selecionados não está mais disponível. Faça a seleção novamente.', selectRecurso);
    }

    const tipoServicoSelecionado = normalizarTextoTipoServico(selectServico?.value);
    if (!tipoServicoSelecionado) {
        return falharValidacaoAtivacao('Selecione o serviço cadastrado.', selectServico);
    }
    const servicoAindaAtivo = obterTiposServicoAtivos().some(tipo =>
        normalizarTextoTipoServico(tipo.nome) === tipoServicoSelecionado
    );
    if (!servicoAindaAtivo) {
        popularTiposServicoAtivacao();
        return falharValidacaoAtivacao('O serviço selecionado não está mais ativo. Selecione outro serviço.', selectServico);
    }

    const osNumero = selectOS?.value;
    if (!osNumero) return falharValidacaoAtivacao('Selecione a Ordem de Serviço.', selectOS);

    if (indiceMembroEmEdicao >= 0 || editorEquipeTemDados()) {
        return falharValidacaoAtivacao('Conclua ou cancele a inclusão ou edição do policial antes de ativar a guarnição.', document.getElementById('btnCancelarEdicaoMembro'));
    }
    if (membrosEquipe.length === 0 || membrosEquipe[0]?.funcao !== 'Comandante') {
        return falharValidacaoAtivacao('Adicione o comandante da equipe antes de ativar a guarnição.', document.getElementById('rgMembro'));
    }

    const policiaisAtivosPorId = new Map(
        obterPoliciaisAtivos().map(policial => [normalizarPolicialId(policial.id), policial])
    );
    const idsPoliciaisEquipe = membrosEquipe.map(membro => normalizarPolicialId(membro.policialId));
    if (new Set(idsPoliciaisEquipe).size !== idsPoliciaisEquipe.length) {
        return falharValidacaoAtivacao('Revise a equipe: o mesmo policial foi adicionado mais de uma vez.', document.getElementById('resumoEquipe'));
    }
    const membroIndisponivel = membrosEquipe.find(membro =>
        !normalizarPolicialId(membro.policialId)
            || !policiaisAtivosPorId.has(normalizarPolicialId(membro.policialId))
    );
    if (membroIndisponivel) {
        renderizarEquipe();
        return falharValidacaoAtivacao(
            `O policial ${membroIndisponivel.nome || 'selecionado'} não está mais ativo. Remova-o ou selecione outro antes de ativar.`,
            document.getElementById('resumoEquipe')
        );
    }
    const membroComCadastroIncompleto = membrosEquipe.find(membro =>
        !cadastroPolicialEstaCompleto(
            policiaisAtivosPorId.get(normalizarPolicialId(membro.policialId))
        )
    );
    if (membroComCadastroIncompleto) {
        return falharValidacaoAtivacao(
            `O cadastro de ${membroComCadastroIncompleto.nome || 'um policial da equipe'} está incompleto. Atualize-o antes de ativar.`,
            document.getElementById('resumoEquipe')
        );
    }
    const vinculosEmServico = obterVinculosPoliciaisEmServico();
    const membroEmOutraGuarnicao = membrosEquipe.find(membro =>
        policialEstaEmServico(
            policiaisAtivosPorId.get(normalizarPolicialId(membro.policialId)),
            vinculosEmServico
        )
    );
    if (membroEmOutraGuarnicao) {
        renderizarEquipe();
        return falharValidacaoAtivacao(
            `${membroEmOutraGuarnicao.nome || 'O policial selecionado'} já integra outra guarnição ativa. Revise a equipe.`,
            document.getElementById('resumoEquipe')
        );
    }
    const cadastroFoiAtualizado = membrosEquipe.some(membro =>
        dadosCadastraisMembroMudaram(
            membro,
            policiaisAtivosPorId.get(normalizarPolicialId(membro.policialId))
        )
    );
    if (cadastroFoiAtualizado) {
        membrosEquipe = membrosEquipe.map(membro => ({
            ...membro,
            ...criarSnapshotCadastroPolicial(
                policiaisAtivosPorId.get(normalizarPolicialId(membro.policialId))
            )
        }));
        renderizarEquipe();
        return falharValidacaoAtivacao(
            'Um cadastro da equipe foi atualizado. Confira os dados exibidos e clique em ativar novamente.',
            document.getElementById('resumoEquipe')
        );
    }

    if (tipoPoliciamentoSelecionado === 'Moto') {
        const atribuicoes = membrosEquipe.map(membro => membro.motoPrefixo).filter(Boolean);
        const atribuicoesUnicas = new Set(atribuicoes);
        if (atribuicoesUnicas.size !== atribuicoes.length) {
            return falharValidacaoAtivacao('Cada moto deve estar vinculada a apenas um policial.', document.getElementById('resumoEquipe'));
        }
        if (atribuicoes.some(prefixo => !recursoIds.includes(prefixo))) {
            return falharValidacaoAtivacao('Revise as motos vinculadas à equipe: existe uma moto que não está mais selecionada.', document.getElementById('resumoEquipe'));
        }
        const motosSemCondutor = recursoIds.filter(id => !atribuicoesUnicas.has(id));
        if (motosSemCondutor.length > 0) {
            return falharValidacaoAtivacao(`Vincule ${motosSemCondutor.join(', ')} ao policial que conduzirá cada moto.`, document.getElementById('motoMembro'));
        }
    }

    const ordens = lerListaLocalStorage('ordensServico');
    const os = ordens.find(ordem => String(ordem.numero) === String(osNumero) && ordem.status === 'Ativa');
    if (!os) return falharValidacaoAtivacao('A OS selecionada não está mais disponível.', selectOS);
    const tipoRecursoOS = normalizarTipoOS(os.tipoRecurso);
    if (tipoRecursoOS && tipoRecursoOS !== 'Geral' && tipoRecursoOS !== tipoPoliciamentoSelecionado) {
        filtrarOSPorRecurso();
        return falharValidacaoAtivacao('A OS selecionada não atende ao tipo de policiamento informado.', selectOS);
    }

    const validacaoJanela = validarJanelaAtivacaoOS(os, new Date());
    if (!validacaoJanela.ok) {
        return falharValidacaoAtivacao(
            validacaoJanela.mensagem || 'Ativação fora da janela permitida da OS.',
            selectOS
        );
    }

    let equipeValidada = membrosEquipe.map(membro => {
        const policial = policiaisAtivosPorId.get(normalizarPolicialId(membro.policialId));
        const snapshot = criarSnapshotCadastroPolicial(policial);
        return {
            ...snapshot,
            funcao: membro.funcao,
            motoPrefixo: tipoPoliciamentoSelecionado === 'Moto' ? membro.motoPrefixo : ''
        };
    });

    definirEstadoAtivacaoEmAndamento(true);
    mostrarFeedbackAtivacao('info', 'Ativando a guarnição...');
    await new Promise(resolve => requestAnimationFrame(resolve));

    let escalaSalva = false;
    try {
        const policiaisAtuaisPorId = new Map(
            obterPoliciaisAtivos().map(policial => [normalizarPolicialId(policial.id), policial])
        );
        const cadastroIndisponivelAntesDeSalvar = equipeValidada.find(membro => {
            const policial = policiaisAtuaisPorId.get(normalizarPolicialId(membro.policialId));
            return !policial || !cadastroPolicialEstaCompleto(policial);
        });
        if (cadastroIndisponivelAntesDeSalvar) {
            const erroCadastro = new Error('Um policial da equipe foi inativado ou está com o cadastro incompleto.');
            erroCadastro.codigo = 'CADASTRO_POLICIAL_INDISPONIVEL';
            throw erroCadastro;
        }

        const equipeAtualizadaAntesDeSalvar = equipeValidada.map(membro => ({
            ...membro,
            ...criarSnapshotCadastroPolicial(
                policiaisAtuaisPorId.get(normalizarPolicialId(membro.policialId))
            )
        }));
        const cadastroMudouAntesDeSalvar = equipeAtualizadaAntesDeSalvar.some((membro, index) =>
            dadosCadastraisMembroMudaram(
                equipeValidada[index],
                policiaisAtuaisPorId.get(normalizarPolicialId(membro.policialId))
            )
        );
        if (cadastroMudouAntesDeSalvar) {
            membrosEquipe = membrosEquipe.map((membro, index) => ({
                ...membro,
                ...criarSnapshotCadastroPolicial(
                    policiaisAtuaisPorId.get(normalizarPolicialId(equipeAtualizadaAntesDeSalvar[index].policialId))
                )
            }));
            const erroCadastroAtualizado = new Error('Um cadastro da equipe foi atualizado durante a ativação.');
            erroCadastroAtualizado.codigo = 'CADASTRO_POLICIAL_ATUALIZADO';
            throw erroCadastroAtualizado;
        }
        equipeValidada = equipeAtualizadaAntesDeSalvar;

        const vinculosAntesDeSalvar = obterVinculosPoliciaisEmServico();
        const policialFicouIndisponivel = equipeValidada.some(membro =>
            vinculosAntesDeSalvar.ids.has(normalizarPolicialId(membro.policialId))
                || vinculosAntesDeSalvar.rgs.has(normalizarRgPolicial(membro.rg))
        );
        if (policialFicouIndisponivel) {
            const erroConflito = new Error('Um policial da equipe passou a integrar outra guarnição ativa.');
            erroConflito.codigo = 'POLICIAL_INDISPONIVEL';
            throw erroConflito;
        }

        const agora = new Date();
        const dataInicioIso = agora.toISOString();
        const duracaoServicoMinutos = calcularDuracaoTurnoMinutos(os.inicioGeral, os.terminoGeral);
        const dataFimPrevista = calcularDataFimPrevistaEscala(
            dataInicioIso,
            os.inicioGeral,
            os.terminoGeral
        );
        const novaEscala = {
            id: Date.now(),
            dataInicio: dataInicioIso,
            dataAtivacao: agora.toLocaleDateString('pt-BR'),
            horaAtivacao: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            tipoPoliciamento: tipoPoliciamentoSelecionado,
            recursoIds,
            recursoId: recursoIds[0],
            tipoRecurso: tipoPoliciamentoSelecionado,
            osNumero: os.numero,
            tipoServico: tipoServicoSelecionado,
            horaInicioServico: os.inicioGeral || null,
            horaFimServico: os.terminoGeral || null,
            duracaoServicoMinutos: Number.isFinite(duracaoServicoMinutos) ? duracaoServicoMinutos : null,
            dataFimPrevista,
            osResumo: {
                numero: os.numero,
                nomeOS: os.nomeOS,
                tipoRecurso: os.tipoRecurso,
                inicioGeral: os.inicioGeral,
                terminoGeral: os.terminoGeral,
                tipoOrdem: tipoServicoSelecionado
            },
            despachante: DESPACHANTE,
            equipe: equipeValidada
        };

        const escalas = obterEscalasAtivasPreparadas();
        escalas.push(novaEscala);
        await OrdenaStorage.setItem('escalasAtivas', JSON.stringify(escalas));
        escalaSalva = true;

        resetarFormularioAtivacao();
        atualizarPainelTatico(true);
        alternarVisualizacaoAtivacao('painel');
        mostrarFeedbackPainelAtivacoes('success', 'Guarnição ativada com sucesso e turno iniciado.');
    } catch (erro) {
        console.error('Erro ao ativar guarnição:', erro);
        mostrarFeedbackAtivacao(
            'error',
            erro?.codigo === 'CADASTRO_POLICIAL_ATUALIZADO'
                ? `${erro.message} Confira os dados exibidos e tente novamente.`
                : erro?.codigo === 'CADASTRO_POLICIAL_INDISPONIVEL'
                ? `${erro.message} Revise a equipe e tente novamente.`
                : erro?.codigo === 'POLICIAL_INDISPONIVEL'
                ? `${erro.message} Revise a equipe e tente novamente.`
                : escalaSalva
                ? 'A guarnição foi ativada, mas a tela não pôde ser atualizada. Recarregue a página para visualizar o turno.'
                : 'Não foi possível ativar a guarnição. Nenhum novo turno foi iniciado.'
        );
        if (['POLICIAL_INDISPONIVEL', 'CADASTRO_POLICIAL_INDISPONIVEL', 'CADASTRO_POLICIAL_ATUALIZADO']
            .includes(erro?.codigo)) {
            renderizarEquipe();
        }
    } finally {
        definirEstadoAtivacaoEmAndamento(false);
    }
});

// --- MONITORAMENTO ---
function exibirMonitoramento() {
    const escalas = obterEscalasAtivasPreparadas();
    const corpoTabela = document.getElementById('listaMonitoramento');
    const viaturas = lerListaLocalStorage('viaturas');
    const placasPorPrefixo = new Map(
        viaturas.filter(v => v && v.prefixo).map(v => [v.prefixo, v.placa || ''])
    );

    corpoTabela.innerHTML = '';

    if (escalas.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:15px; color:#666;">Nenhum serviço ativo no momento.</td></tr>';
        return;
    }

    escalas.forEach(escala => {
        const equipe = Array.isArray(escala.equipe)
            ? escala.equipe.filter(membro => membro && typeof membro === 'object')
            : [];
        const indiceComandanteEncontrado = equipe.findIndex(membro => {
            const funcao = String(membro?.funcao || '').trim().toLowerCase();
            return funcao === 'comandante' || funcao === 'cmd';
        });
        const indiceComandante = indiceComandanteEncontrado >= 0 ? indiceComandanteEncontrado : 0;
        const cmd = equipe[indiceComandante] || { posto: '', nome: 'Comandante', tel: '' };
        const auxiliares = equipe.filter((_, index) => index !== indiceComandante);
        const auxiliaresHtml = auxiliares.length > 0
            ? `<div class="auxiliares-lista">${auxiliares.map(membro => {
                const identificacao = `${membro.posto || ''} ${membro.nome || membro.nomeGuerra || ''}`.trim() || '-';
                return `<span class="auxiliar-item">${escaparHtml(identificacao)}</span>`;
            }).join('')}</div>`
            : '-';
        const nomeComandante = `${cmd.posto || ''} ${cmd.nome || cmd.nomeGuerra || ''}`.trim() || '-';
        const telefoneComandante = String(cmd.tel || cmd.telefone || '').trim() || '-';

        const osResumo = escala.osResumo || {};
        const recursoPainel = obterTextoRecursoPainel(escala, placasPorPrefixo);
        const tipoServicoPainel = escala.tipoServico || osResumo.tipoOrdem || '-';

        corpoTabela.innerHTML += `
            <tr>
                <td data-label="Data Ativação">${escaparHtml(escala.dataAtivacao || formatarDataIso(escala.dataInicio))}</td>
                <td data-label="Recurso"><strong>${escaparHtml(recursoPainel)}</strong></td>
                <td data-label="Comandante">${escaparHtml(nomeComandante)}</td>
                <td data-label="Telefone">${escaparHtml(telefoneComandante)}</td>
                <td data-label="Auxiliares">${auxiliaresHtml}</td>
                <td data-label="OS">${escaparHtml(escala.osNumero || '-')}</td>
                <td data-label="Tipo de Serviço">${escaparHtml(tipoServicoPainel)}</td>
                <td data-label="Missão">${escaparHtml(osResumo.nomeOS || '-')}</td>
                <td data-label="Hora Início">${escaparHtml(escala.horaInicioServico || osResumo.inicioGeral || '-')}</td>
                <td data-label="Hora Fim">${escaparHtml(escala.horaFimServico || osResumo.terminoGeral || '-')}</td>
                <td data-label="Ações">
                    <div class="acoes-inline">
                        <button type="button" onclick="imprimirAtivacao(${escala.id})" class="btn-info" title="Imprimir PDF">PDF</button>
                        <button type="button" onclick="finalizarTurno(${escala.id})" class="btn-danger">Baixa</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function imprimirAtivacao(id) {
    const ativas = obterEscalasAtivasPreparadas();
    const historico = lerListaLocalStorage('historicoEscalas');
    const escala = ativas.find(e => e.id === id) || historico.find(e => e.id === id);
    if (!escala) return alert("Ativação não encontrada.");

    const ordens = lerListaLocalStorage('ordensServico');
    const os = ordens.find(o => o.numero == escala.osNumero);

    const payload = {
        escala,
        os
    };
    OrdenaStorage.setItem('ativacaoImpressaoTemp', JSON.stringify(payload));
    window.open('impressao_ativacao.html', '_blank');
}

async function finalizarTurno(id) {
    let ativas = obterEscalasAtivasPreparadas();
    let historico = lerListaLocalStorage('historicoEscalas');
    const index = ativas.findIndex(e => e.id === id);
    if (index > -1) {
        const escala = ativas[index];
        const recursos = obterIdsRecursosEscala(escala).join(', ') || escala.recursoId || 'recurso';
        if (!confirm(`Confirma a baixa de ${recursos}?`)) return;

        try {
            preencherCamposEscala(escala);
            aplicarMetadadosBaixa(escala, new Date().toISOString());
            const jaExiste = historico.some(item => Number(item?.id) === Number(escala.id));
            if (!jaExiste) historico.push(escala);
            // Legado: duas gravações separadas de histórico e ativações.
            // OrdenaStorage.setItem('historicoEscalas', JSON.stringify(historico));
            ativas.splice(index, 1);
            // OrdenaStorage.setItem('escalasAtivas', JSON.stringify(ativas));
            await OrdenaStorage.setMany({ historicoEscalas: historico, escalasAtivas: ativas });
            atualizarPainelTatico(true);
            mostrarFeedbackPainelAtivacoes('success', `Turno de ${recursos} finalizado com sucesso.`);
        } catch (erro) {
            console.error('Erro ao finalizar turno:', erro);
            mostrarFeedbackPainelAtivacoes('error', 'Não foi possível dar baixa no serviço. Tente novamente.');
        }
    }
}
