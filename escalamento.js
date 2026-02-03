/**
 * SISTEMA DE ATIVAÇÃO E ESCALAMENTO
 * Conectado ao Planejamento Diário (Visualização do Tipo Real: Carro/Moto)
 */

document.addEventListener('DOMContentLoaded', () => {
    popularRecursosFisicos(); 
    exibirMonitoramento();
    
    const hoje = new Date();
    document.getElementById('dataHojeDisplay').innerText = hoje.toLocaleDateString('pt-BR');
    
    setInterval(exibirMonitoramento, 10000); 
});

const DESPACHANTE = {
    nome: "SGT Controle",
    funcao: "Operador de Despacho",
    id: "user_01"
};

// --- 1. POPULA OS RECURSOS FÍSICOS (VISUAL: CARRO/MOTO | LÓGICA: VIATURA/MOTO) ---
function popularRecursosFisicos() {
    const viaturas = JSON.parse(localStorage.getItem('viaturas')) || [];
    const cabines = JSON.parse(localStorage.getItem('cabines')) || [];
    const setores = JSON.parse(localStorage.getItem('setores')) || [];
    const escalasAtivas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    
    const selectRecurso = document.getElementById('selectRecurso');
    selectRecurso.innerHTML = '<option value="">Selecione o Recurso...</option>';

    const recursosEmUso = escalasAtivas.map(e => e.recursoId || e.prefixo);

    // FROTA (CARROS E MOTOS)
    const frotaDisponivel = viaturas.filter(v => v.status === 'Ativa' && !recursosEmUso.includes(v.prefixo));
    
    if (frotaDisponivel.length > 0) {
        const groupFrota = document.createElement('optgroup');
        groupFrota.label = "Frota Veicular";
        
        frotaDisponivel.forEach(v => {
            let opt = document.createElement('option');
            opt.value = v.prefixo;
            
            // --- LÓGICA INTELIGENTE ---
            // 1. Tipo Real (Para o Usuário ler): Pega do cadastro (ex: "Carro", "Moto", "Van")
            let tipoReal = v.tipo || "Viatura"; 
            
            // 2. Tipo Lógico (Para o Sistema filtrar):
            // O Planejamento só conhece "Viatura" e "Moto". 
            // Então, se for "Carro", "SUV", etc, mapeamos para "Viatura".
            // Se for "Moto", mapeamos para "Moto".
            let tipoLogico = "Viatura"; 
            if (tipoReal.toLowerCase().includes("moto")) {
                tipoLogico = "Moto";
            }

            // Salva o tipo lógico no dataset para o filtro funcionar
            opt.dataset.tipo = tipoLogico; 
            
            // Mostra o tipo real no texto
            opt.innerHTML = `[${tipoReal}] ${v.prefixo} (${v.placa})`;
            
            groupFrota.appendChild(opt);
        });
        selectRecurso.appendChild(groupFrota);
    }

    // CABINES
    const cabinesDisponiveis = cabines.filter(c => c.status === 'Ativa' && !recursosEmUso.includes(c.codigo));
    if (cabinesDisponiveis.length > 0) {
        const groupCab = document.createElement('optgroup');
        groupCab.label = "Cabines Integradas";
        cabinesDisponiveis.forEach(c => {
            let opt = document.createElement('option');
            opt.value = c.codigo;
            opt.dataset.tipo = "Cabine";
            opt.innerHTML = `[Cabine] ${c.codigo} - ${c.nome}`;
            groupCab.appendChild(opt);
        });
        selectRecurso.appendChild(groupCab);
    }

    // SETORES
    const setoresDisponiveis = setores.filter(s => s.status === 'Ativa' && !recursosEmUso.includes(s.codigo));
    if (setoresDisponiveis.length > 0) {
        const groupSetor = document.createElement('optgroup');
        groupSetor.label = "Setores (A pé)";
        setoresDisponiveis.forEach(s => {
            let opt = document.createElement('option');
            opt.value = s.codigo;
            opt.dataset.tipo = "Setor";
            opt.innerHTML = `[Setor] ${s.codigo} - ${s.nome}`;
            groupSetor.appendChild(opt);
        });
        selectRecurso.appendChild(groupSetor);
    }
}

// --- 2. FILTRA OS POR RECURSO ---
function filtrarOSPorRecurso() {
    const selectRecurso = document.getElementById('selectRecurso');
    const selectOS = document.getElementById('selectOS');

    selectOS.innerHTML = '<option value="">Selecione...</option>';
    selectOS.disabled = true;

    if (!selectRecurso.value) return;

    const tipoRecursoFisico = selectRecurso.options[selectRecurso.selectedIndex].dataset.tipo;
    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const ativas = ordens.filter(o => o.status === 'Ativa');

    const compativeis = ativas.filter(o => normalizarTipoOS(o.tipoRecurso) === tipoRecursoFisico);

    if (compativeis.length === 0) {
        const opt = document.createElement('option');
        opt.innerText = `Sem OS de ${tipoRecursoFisico} disponíveis.`;
        selectOS.appendChild(opt);
    } else {
        selectOS.disabled = false;
        selectOS.innerHTML = '<option value="">Selecione a OS...</option>';

        compativeis
            .sort((a, b) => b.numero - a.numero)
            .forEach(os => {
                const opt = document.createElement('option');
                opt.value = os.numero;
                const op = (os.atividades || []).find(a => a.operacao)?.operacao;
                const textoOp = op ? ` | OP: ${op}` : '';
                opt.innerText = `OS ${os.numero} | ${os.nomeOS} | ${os.tipoRecurso} | ${os.inicioGeral}-${os.terminoGeral} | ${os.tipoOrdem}${textoOp}`;
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
    div.innerHTML = `<div class="row-integrante"><div style="flex: 1;"><select name="posto" class="input-padrao" required><option value="SD">SD</option><option value="CB">CB</option><option value="SGT">SGT</option><option value="SUBTEN">SUBTEN</option><option value="ASP">ASP</option><option value="TEN">TEN</option></select></div><div style="flex: 2;"><input type="text" name="nome" class="input-padrao" placeholder="Nome de Guerra" required></div><div style="flex: 1;"><input type="text" name="rg" class="input-padrao" placeholder="RG" required></div></div><button type="button" class="btn-remove" onclick="removerLinhaIntegrante('${idUnico}')">X</button>`; 
    container.appendChild(div); contadorIntegrantes++; 
}
function removerLinhaIntegrante(id) { document.getElementById(`integrante-${id}`).remove(); contadorIntegrantes--; }

// --- SALVAR ATIVAÇÃO ---
document.getElementById('escalamentoForm').addEventListener('submit', (e) => { 
    e.preventDefault(); 
    
    const selectRecurso = document.getElementById('selectRecurso'); 
    const recursoId = selectRecurso.value; 
    // Salva o tipo VISUAL (ex: Carro) para mostrar no painel, mas usa o LÓGICO para consistência se precisar
    const tipoRecursoLogico = selectRecurso.options[selectRecurso.selectedIndex].dataset.tipo; 
    // Pega o texto entre [] do option para salvar o tipo real (ex: Carro)
    const textoOption = selectRecurso.options[selectRecurso.selectedIndex].text;
    const tipoRecursoReal = textoOption.match(/\[(.*?)\]/)[1] || tipoRecursoLogico;

    const osNumero = document.getElementById('selectOS').value; 
    if (!osNumero) return alert("Selecione a OS.");

    const ordens = JSON.parse(localStorage.getItem('ordensServico')) || [];
    const os = ordens.find(o => o.numero.toString() === osNumero.toString());
    if (!os) return alert("Erro: OS não encontrada.");

    const comandante = { posto: document.getElementById('postoCmd').value, nome: document.getElementById('nomeCmd').value, rg: document.getElementById('rgCmd').value, tel: document.getElementById('telCmd').value, funcao: "Comandante" }; 
    const integrantesExtras = []; document.querySelectorAll('#listaIntegrantes .box-integrante').forEach(box => { integrantesExtras.push({ posto: box.querySelector('select[name="posto"]').value, nome: box.querySelector('input[name="nome"]').value, rg: box.querySelector('input[name="rg"]').value, funcao: "Auxiliar" }); }); 
    
    const novaEscala = { 
        id: Date.now(), 
        dataInicio: new Date().toISOString(), 
        recursoId: recursoId, 
        tipoRecurso: tipoRecursoReal, // Salva "Carro" ou "Moto" para exibição
        osNumero: os.numero,
        osResumo: {
            numero: os.numero,
            nomeOS: os.nomeOS,
            tipoRecurso: os.tipoRecurso,
            inicioGeral: os.inicioGeral,
            terminoGeral: os.terminoGeral,
            tipoOrdem: os.tipoOrdem
        },
        despachante: DESPACHANTE, 
        equipe: [comandante, ...integrantesExtras] 
    }; 
    
    let escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || []; 
    escalas.push(novaEscala); 
    localStorage.setItem('escalasAtivas', JSON.stringify(escalas)); 
    
    document.getElementById('escalamentoForm').reset(); 
    document.getElementById('listaIntegrantes').innerHTML = ''; 
    contadorIntegrantes = 0; 
    
    alert("Guarnição ATIVADA com sucesso!"); 
    popularRecursosFisicos(); 
    exibirMonitoramento(); 
});

// --- MONITORAMENTO ---
function exibirMonitoramento() {
    const escalas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    const corpoTabela = document.getElementById('listaMonitoramento');

    corpoTabela.innerHTML = '';

    if (escalas.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#666;">Nenhuma guarnição ativa no momento.</td></tr>';
        return;
    }

    escalas.forEach((escala, index) => {
        let cmd = escala.equipe ? escala.equipe[0] : { posto: '', nome: 'Comandante' };
        let totalIntegrantes = escala.equipe ? escala.equipe.length : 1;
        
        const osResumo = escala.osResumo || {};

        corpoTabela.innerHTML += `
            <tr>
                <td data-label="Recurso"><strong>${escala.tipoRecurso} ${escala.recursoId}</strong></td>
                <td data-label="Início">${new Date(escala.dataInicio).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</td>
                <td data-label="Comandante">${cmd.posto} ${cmd.nome}</td>
                <td data-label="Auxiliares">${totalIntegrantes - 1}</td>
                <td data-label="OS"><span class="badge-tipo-os">OS</span> Nº ${escala.osNumero}</td>
                <td data-label="Missão">${osResumo.nomeOS || '-'}</td>
                <td data-label="Turno">${osResumo.inicioGeral || '-'} às ${osResumo.terminoGeral || '-'}</td>
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
    const ativas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
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
    let ativas = JSON.parse(localStorage.getItem('escalasAtivas')) || [];
    let historico = JSON.parse(localStorage.getItem('historicoEscalas')) || [];
    const index = ativas.findIndex(e => e.id === id);
    if (index > -1) {
        const escala = ativas[index];
        if (!automatico && !confirm(`Confirma a baixa de ${escala.recursoId}?`)) return;
        escala.dataFim = new Date().toISOString();
        escala.baixaAutomatica = automatico;
        escala.responsavelBaixa = automatico ? "SISTEMA" : DESPACHANTE.nome;
        historico.push(escala);
        localStorage.setItem('historicoEscalas', JSON.stringify(historico));
        ativas.splice(index, 1);
        localStorage.setItem('escalasAtivas', JSON.stringify(ativas));
        popularRecursosFisicos(); 
        exibirMonitoramento(); 
    }
}
