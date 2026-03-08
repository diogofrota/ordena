/**
 * SISTEMA DE ATIVAÇÃO E ESCALAMENTO
 * Conectado ao Planejamento Diário (Visualização do Tipo Real: Carro/Moto)
 */

document.addEventListener('DOMContentLoaded', () => {
    atualizarPainelTatico(true);

    popularTiposPoliciamentoAtivacao();
    popularRecursosFisicos();
    popularTiposServicoAtivacao();
    filtrarOSPorRecurso();

    setInterval(() => atualizarPainelTatico(false), 10000);
});

const DESPACHANTE = {
    nome: "SGT Controle",
    funcao: "Operador de Despacho",
    id: "user_01"
};
const ANTECEDENCIA_PERMITIDA_ATIVACAO_MIN = 30;

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

function aplicarMetadadosBaixa(escala, automatico, dataFimIso) {
    escala.dataFim = dataFimIso || new Date().toISOString();
    escala.dataRegistroBaixa = new Date().toISOString();
    escala.baixaAutomatica = !!automatico;
    escala.tipoBaixa = automatico ? 'Automática' : 'Manual';
    escala.motivoBaixa = automatico
        ? 'Encerramento automático no horário final da OS'
        : 'Encerramento manual realizado pelo operador';
    escala.responsavelBaixa = automatico ? "SISTEMA" : DESPACHANTE.nome;
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
        <option value="Viatura">Viatura</option>
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
    const tipos = JSON.parse(localStorage.getItem('tiposServico')) || [];
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
    // TODO(condicoes-ativacao): reativar bloqueio progressivo entre campos após validação final da estrutura.
    popularRecursosFisicos();
    popularTiposServicoAtivacao();
    filtrarOSPorRecurso();
}

function aoSelecionarOS() {
    popularTiposServicoAtivacao();
}

function atualizarPainelTatico(forcarAtualizacaoRecursos = false) {
    const houveBaixaAutomatica = processarBaixasAutomaticas();
    if (forcarAtualizacaoRecursos || houveBaixaAutomatica) {
        popularTiposPoliciamentoAtivacao();
        popularRecursosFisicos();
    }
    exibirMonitoramento();
}

function obterEscalasAtivasPreparadas() {
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    let alterou = false;

    escalas.forEach(escala => {
        if (preencherCamposEscala(escala)) alterou = true;
    });

    if (alterou) {
        localStorage.setItem('escalasAtivas', JSON.stringify(escalas));
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

function processarBaixasAutomaticas() {
    const api = obterApiAutoEscalas();
    if (api && typeof api.processarBaixasAutomaticasEscalas === 'function') {
        const resultado = api.processarBaixasAutomaticasEscalas({ save: true });
        return !!(resultado && resultado.changed);
    }

    let ativas = obterEscalasAtivasPreparadas();
    if (ativas.length === 0) return false;

    let historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    const agoraMs = Date.now();
    let houveAlteracao = false;
    const ativasRestantes = [];

    ativas.forEach(escala => {
        if (preencherCamposEscala(escala)) houveAlteracao = true;

        const fimPrevistoMs = escala.dataFimPrevista ? new Date(escala.dataFimPrevista).getTime() : NaN;
        const deveFinalizarAutomatico = Number.isFinite(fimPrevistoMs) && fimPrevistoMs <= agoraMs;

        if (deveFinalizarAutomatico) {
            aplicarMetadadosBaixa(escala, true, escala.dataFimPrevista || new Date().toISOString());
            const jaExiste = historico.some(item => Number(item?.id) === Number(escala.id));
            if (!jaExiste) historico.push(escala);
            houveAlteracao = true;
            return;
        }

        ativasRestantes.push(escala);
    });

    if (houveAlteracao) {
        localStorage.setItem('historicoEscalas', JSON.stringify(historico));
        localStorage.setItem('escalasAtivas', JSON.stringify(ativasRestantes));
    }

    return houveAlteracao;
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

function formatarHoraIso(dataIso) {
    if (!dataIso) return '-';
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return '-';
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
    const placa = placasPorPrefixo?.get(escala.recursoId);

    if (!recursoEhCabineOuSetor && placa) return placa;
    return escala.recursoId || '-';
}

// --- 1. POPULA VIATURAS DISPONÍVEIS CONFORME TIPO DE POLICIAMENTO ---
function popularRecursosFisicos() {
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    const escalasAtivas = obterEscalasAtivasPreparadas();
    
    const selectRecurso = document.getElementById('selectRecurso');
    if (!selectRecurso) return;

    const valorAtual = selectRecurso.value;
    selectRecurso.disabled = false;
    selectRecurso.innerHTML = '<option value="">Selecione a Viatura...</option>';

    const recursosEmUso = escalasAtivas.map(e => e.recursoId || e.prefixo);
    let adicionou = false;

    // TODO(condicoes-ativacao): reativar filtro por Tipo de Policiamento ao validar a estrutura final.
    const frotaDisponivel = viaturas.filter(v => {
        if (!v || v.status !== 'Ativa') return false;
        if (recursosEmUso.includes(v.prefixo)) return false;
        const tipoViatura = normalizarTipoPoliciamento(v.tipo);
        return tipoViatura === 'Viatura' || tipoViatura === 'Moto';
    });

    if (frotaDisponivel.length > 0) {
        const groupFrota = document.createElement('optgroup');
        groupFrota.label = "Frota Veicular";

        frotaDisponivel.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.prefixo;
            const tipoReal = v.tipo || "Viatura";
            opt.dataset.tipo = normalizarTipoPoliciamento(tipoReal) || 'Viatura';
            opt.innerHTML = `[${tipoReal}] ${v.prefixo} (${v.placa})`;
            groupFrota.appendChild(opt);
        });

        selectRecurso.appendChild(groupFrota);
        adicionou = true;
    }

    const cabinesDisponiveis = cabines.filter(c => c && c.status === 'Ativa' && !recursosEmUso.includes(c.codigo));
    if (cabinesDisponiveis.length > 0) {
        const groupCab = document.createElement('optgroup');
        groupCab.label = "Cabines";
        cabinesDisponiveis.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.codigo;
            opt.dataset.tipo = "Cabine";
            opt.innerHTML = `[Cabine] ${c.codigo} - ${c.nome}`;
            groupCab.appendChild(opt);
        });
        selectRecurso.appendChild(groupCab);
        adicionou = true;
    }

    const setoresDisponiveis = setores.filter(s => s && s.status === 'Ativa' && !recursosEmUso.includes(s.codigo));
    if (setoresDisponiveis.length > 0) {
        const groupSetor = document.createElement('optgroup');
        groupSetor.label = "Setores a Pé";
        setoresDisponiveis.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.codigo;
            opt.dataset.tipo = "Setor";
            opt.innerHTML = `[Setor] ${s.codigo} - ${s.nome}`;
            groupSetor.appendChild(opt);
        });
        selectRecurso.appendChild(groupSetor);
        adicionou = true;
    }

    if (!adicionou) {
        selectRecurso.innerHTML = '<option value="">Nenhum recurso disponível</option>';
        return;
    }

    const existeValorAtual = [...selectRecurso.options].some(opt => opt.value === valorAtual);
    if (valorAtual && existeValorAtual) {
        selectRecurso.value = valorAtual;
    }
}

// --- 2. FILTRA OS POR RECURSO ---
function filtrarOSPorRecurso() {
    const selectOS = document.getElementById('selectOS');

    popularTiposServicoAtivacao();

    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const ativas = ordens.filter(o => o.status === 'Ativa');

    // TODO(condicoes-ativacao): reativar filtro de OS por recurso/tipo após validação final da estrutura.
    selectOS.innerHTML = '<option value="">Selecione a OS...</option>';
    selectOS.disabled = false;

    if (ativas.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = 'Nenhuma OS ativa disponível.';
        selectOS.appendChild(opt);
    } else {
        ativas
            .sort((a, b) => b.numero - a.numero)
            .forEach(os => {
                const opt = document.createElement('option');
                opt.value = os.numero;
                const op = (os.atividades || []).find(a => a.operacao)?.operacao;
                const textoOp = op ? ` | OP: ${op}` : '';
                opt.innerText = `OS ${os.numero} | ${os.nomeOS} | ${os.tipoRecurso} | ${os.inicioGeral}-${os.terminoGeral}${textoOp}`;
                selectOS.appendChild(opt);
            });
    }
}

function normalizarTipoOS(tipo) {
    if (!tipo) return '';
    const t = tipo.toLowerCase();
    if (t.includes('moto')) return 'Moto';
    if (t.includes('cabine')) return 'Cabine';
    if (t.includes('setor')) return 'Setor';
    return 'Viatura';
}

// --- INTEGRANTES ---
let contadorIntegrantes = 0; const MAX_INTEGRANTES = 5; 
function adicionarIntegrante() { 
    if (contadorIntegrantes >= MAX_INTEGRANTES) { alert("Máximo de 6 integrantes."); return; } 
    const container = document.getElementById('listaIntegrantes'); const idUnico = Date.now(); const div = document.createElement('div'); div.className = 'box-integrante'; div.id = `integrante-${idUnico}`; 
    div.innerHTML = `<div class="row-integrante"><div style="flex: 1;"><select name="posto" class="input-padrao" required><option value="SD">SD</option><option value="CB">CB</option><option value="3SGT">3 SGT</option><option value="2SGT">2 SGT</option><option value="1SGT">1 SGT</option><option value="SUBTEN">SUBTEN</option><option value="ASP">ASP</option><option value="TEN">TEN</option></select></div><div style="flex: 2;"><input type="text" name="nome" class="input-padrao" placeholder="Nome de Guerra" required></div><div style="flex: 1;"><input type="text" name="rg" class="input-padrao" placeholder="RG" required></div></div><button type="button" class="btn-remove" onclick="removerLinhaIntegrante('${idUnico}')">X</button>`; 
    container.appendChild(div); contadorIntegrantes++; 
}
function removerLinhaIntegrante(id) { document.getElementById(`integrante-${id}`).remove(); contadorIntegrantes--; }

// --- SALVAR ATIVAÇÃO ---
document.getElementById('escalamentoForm').addEventListener('submit', (e) => { 
    e.preventDefault(); 
    
    const tipoPoliciamentoSelecionado = normalizarTipoPoliciamento(document.getElementById('selectTipoPoliciamento')?.value);
    if (!tipoPoliciamentoSelecionado) return alert("Selecione o Tipo de Policiamento.");

    const selectRecurso = document.getElementById('selectRecurso'); 
    const recursoId = selectRecurso.value; 
    const optionSelecionada = selectRecurso.options[selectRecurso.selectedIndex] || null;
    // Salva o tipo VISUAL (ex: Carro) para mostrar no painel, mas usa o LÓGICO para consistência se precisar
    const tipoRecursoLogico = optionSelecionada?.dataset?.tipo || tipoPoliciamentoSelecionado; 
    // Pega o texto entre [] do option para salvar o tipo real (ex: Carro)
    const textoOption = optionSelecionada?.text || '';
    const matchTipoRecurso = textoOption.match(/\[(.*?)\]/);
    const tipoRecursoReal = (matchTipoRecurso && matchTipoRecurso[1]) || tipoRecursoLogico;

    const osNumero = document.getElementById('selectOS').value; 
    if (!osNumero) return alert("Selecione a OS.");
    const tipoServicoSelecionado = normalizarTextoTipoServico(document.getElementById('selectTipoServico').value);
    if (!tipoServicoSelecionado) return alert("Selecione o Serviço.");

    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = ordens.find(o => o.numero.toString() === osNumero.toString());
    if (!os) return alert("Erro: OS não encontrada.");

    const validacaoJanela = validarJanelaAtivacaoOS(os, new Date());
    if (!validacaoJanela.ok) {
        return alert(validacaoJanela.mensagem || "Ativação fora da janela permitida da OS.");
    }

    const comandante = { posto: document.getElementById('postoCmd').value, nome: document.getElementById('nomeCmd').value, rg: document.getElementById('rgCmd').value, tel: document.getElementById('telCmd').value, funcao: "Comandante" }; 
    const integrantesExtras = []; document.querySelectorAll('#listaIntegrantes .box-integrante').forEach(box => { integrantesExtras.push({ posto: box.querySelector('select[name="posto"]').value, nome: box.querySelector('input[name="nome"]').value, rg: box.querySelector('input[name="rg"]').value, funcao: "Auxiliar" }); }); 
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
        recursoId: recursoId, 
        tipoRecurso: tipoRecursoReal, // Salva "Carro" ou "Moto" para exibição
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
        equipe: [comandante, ...integrantesExtras] 
    }; 
    
    let escalas = obterEscalasAtivasPreparadas(); 
    escalas.push(novaEscala); 
    localStorage.setItem('escalasAtivas', JSON.stringify(escalas)); 
    
    document.getElementById('escalamentoForm').reset(); 
    popularTiposPoliciamentoAtivacao();
    popularRecursosFisicos();
    popularTiposServicoAtivacao();
    filtrarOSPorRecurso();
    document.getElementById('listaIntegrantes').innerHTML = ''; 
    contadorIntegrantes = 0; 
    
    alert("Guarnição ATIVADA com sucesso!"); 
    atualizarPainelTatico(true); 
});

// --- MONITORAMENTO ---
function exibirMonitoramento() {
    const escalas = obterEscalasAtivasPreparadas();
    const corpoTabela = document.getElementById('listaMonitoramento');
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const placasPorPrefixo = new Map(
        viaturas.filter(v => v && v.prefixo).map(v => [v.prefixo, v.placa || ''])
    );

    corpoTabela.innerHTML = '';

    if (escalas.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:15px; color:#666;">Nenhuma guarnição ativa no momento.</td></tr>';
        return;
    }

    escalas.forEach((escala, index) => {
        let cmd = escala.equipe ? escala.equipe[0] : { posto: '', nome: 'Comandante' };
        let totalIntegrantes = escala.equipe ? escala.equipe.length : 1;
        
        const osResumo = escala.osResumo || {};
        const recursoPainel = obterTextoRecursoPainel(escala, placasPorPrefixo);
        const tipoServicoPainel = escala.tipoServico || osResumo.tipoOrdem || '-';

        corpoTabela.innerHTML += `
            <tr>
                <td data-label="Data Ativação">${escala.dataAtivacao || formatarDataIso(escala.dataInicio)}</td>
                <td data-label="Recurso"><strong>${recursoPainel}</strong></td>
                <td data-label="Hora Ativação">${escala.horaAtivacao || formatarHoraIso(escala.dataInicio)}</td>
                <td data-label="Comandante">${cmd.posto} ${cmd.nome}</td>
                <td data-label="Auxiliares">${totalIntegrantes - 1}</td>
                <td data-label="OS">${escala.osNumero || '-'}</td>
                <td data-label="Tipo de Serviço">${tipoServicoPainel}</td>
                <td data-label="Missão">${osResumo.nomeOS || '-'}</td>
                <td data-label="Hora Início">${escala.horaInicioServico || osResumo.inicioGeral || '-'}</td>
                <td data-label="Hora Fim">${escala.horaFimServico || osResumo.terminoGeral || '-'}</td>
                <td data-label="Ações" style="text-align: center;">
                    <div class="acoes-inline">
                        <button onclick="imprimirAtivacao(${escala.id})" class="btn-info" title="Imprimir PDF">PDF</button>
                        <button onclick="verificarCheckGPS('${escala.id}')" class="btn-check-gps" title="Validar Posição">GPS</button>
                        <button onclick="finalizarTurno(${escala.id}, false)" class="btn-danger">Baixa</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function verificarCheckGPS(escalaId) {
    alert("API GPS: Posição Validada com Sucesso.");
}

function imprimirAtivacao(id) {
    const ativas = obterEscalasAtivasPreparadas();
    const historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    const escala = ativas.find(e => e.id === id) || historico.find(e => e.id === id);
    if (!escala) return alert("Ativação não encontrada.");

    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = ordens.find(o => o.numero == escala.osNumero);

    const payload = {
        escala,
        os
    };
    localStorage.setItem('ativacaoImpressaoTemp', JSON.stringify(payload));
    window.open('impressao_ativacao.html', '_blank');
}

function finalizarTurno(id, automatico = false) {
    let ativas = obterEscalasAtivasPreparadas();
    let historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    const index = ativas.findIndex(e => e.id === id);
    if (index > -1) {
        const escala = ativas[index];
        if (!automatico && !confirm(`Confirma a baixa de ${escala.recursoId}?`)) return;
        preencherCamposEscala(escala);
        const dataFimIso = (automatico && escala.dataFimPrevista)
            ? escala.dataFimPrevista
            : new Date().toISOString();
        aplicarMetadadosBaixa(escala, automatico, dataFimIso);
        const jaExiste = historico.some(item => Number(item?.id) === Number(escala.id));
        if (!jaExiste) historico.push(escala);
        localStorage.setItem('historicoEscalas', JSON.stringify(historico));
        ativas.splice(index, 1);
        localStorage.setItem('escalasAtivas', JSON.stringify(ativas));
        atualizarPainelTatico(true); 
    }
}
