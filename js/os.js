/**
 * LÓGICA DE GERENCIAMENTO DE OS
 * Ajustes: Ordenação Inteligente de Horário (Turno) + Operação Especial na listagem
 */

let listaAtividadesTemporaria = [];
let idEdicaoOS = -1;
const filtroUrlOS = new URLSearchParams(window.location.search).get('filtro');
let statusFiltroAtual = filtroUrlOS === 'Inativa' ? 'Inativa' : 'Ativa';
let salvamentoOSEmAndamento = false;
let temporizadorListaOperacoes = null;
let atividadeEmEdicao = null;
let valoresEditorAntesEdicao = null;
let mapaAtividade = null;
let elementoRetornoModalMapa = null;
let botaoMapaEmCarregamento = null;
let textoOriginalBotaoMapa = '';
let temporizadorCarregamentoMapa = null;
let sequenciaCarregamentoMapa = 0;
let fracionamentoConfirmado = false;
const FEEDBACK_NAVEGACAO_OS_KEY = 'ordenaFeedbackOrdemServico';

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function lerOrdensServico(estrito) {
    const valor = OrdenaStorage.getItem('ordensServico');
    if (valor == null) return [];

    try {
        const ordens = JSON.parse(valor);
        if (Array.isArray(ordens)) return ordens;
        throw new Error('Formato inválido para ordensServico.');
    } catch (erro) {
        console.error('Erro ao ler ordens de serviço:', erro);
        if (estrito) throw erro;
        mostrarFeedbackOS('error', 'Não foi possível carregar as ordens salvas. Os dados existentes foram preservados.');
        return [];
    }
}

function obterElementoFeedbackOS() {
    return document.getElementById('feedbackCadastroOS')
        || document.getElementById('feedbackListaOS');
}

function mostrarFeedbackOS(tipo, mensagem) {
    const elemento = obterElementoFeedbackOS();
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.className = `page-feedback is-visible ${tipo}`;
    elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
}

function salvarFeedbackNavegacaoOS(tipo, mensagem) {
    try {
        sessionStorage.setItem(FEEDBACK_NAVEGACAO_OS_KEY, JSON.stringify({ tipo, mensagem }));
    } catch (erro) {
        console.warn('Não foi possível preservar a confirmação entre as páginas:', erro);
    }
}

function restaurarFeedbackNavegacaoOS() {
    try {
        const feedbackSalvo = sessionStorage.getItem(FEEDBACK_NAVEGACAO_OS_KEY);
        if (!feedbackSalvo) return;

        sessionStorage.removeItem(FEEDBACK_NAVEGACAO_OS_KEY);
        const dados = JSON.parse(feedbackSalvo);
        if (dados?.mensagem) {
            mostrarFeedbackOS(dados.tipo === 'error' ? 'error' : 'success', dados.mensagem);
        }
    } catch (erro) {
        try {
            sessionStorage.removeItem(FEEDBACK_NAVEGACAO_OS_KEY);
        } catch (_) {
            // A OS já foi preservada; a mensagem temporária é opcional.
        }
        console.warn('Não foi possível restaurar a confirmação do cadastro:', erro);
    }
}

function normalizarNomeCadastroOperacao(valor) {
    return typeof valor === 'string' ? valor.trim().toUpperCase() : '';
}

function lerCadastrosOperacoes(estrito) {
    const valor = OrdenaStorage.getItem('cadastrosOperacoes');
    if (valor == null) return [];

    try {
        const cadastros = JSON.parse(valor);
        if (Array.isArray(cadastros)) return cadastros;
        throw new Error('Formato inválido para cadastrosOperacoes.');
    } catch (erro) {
        console.error('Erro ao ler cadastros de operações:', erro);
        if (estrito) throw erro;
        return [];
    }
}

function parseDataCivilCadastroOperacao(valor) {
    if (typeof valor !== 'string') return null;
    const correspondencia = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!correspondencia) return null;

    const ano = Number(correspondencia[1]);
    const mes = Number(correspondencia[2]);
    const dia = Number(correspondencia[3]);
    const data = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
        return null;
    }
    return data;
}

function parseDataCadastroOperacao(valor) {
    if (typeof valor !== 'string' || !valor.trim().includes('-')) return null;
    const texto = valor.trim();
    const dataCivil = parseDataCivilCadastroOperacao(texto);
    if (dataCivil) return dataCivil;

    const data = new Date(texto);
    return Number.isNaN(data.getTime()) ? null : data;
}

function criarHorarioCadastroOperacao(valor, dataBase) {
    if (typeof valor !== 'string' || !/^\d{2}:\d{2}$/.test(valor.trim())) return null;
    if (!(dataBase instanceof Date) || Number.isNaN(dataBase.getTime())) return null;

    const [hora, minuto] = valor.trim().split(':').map(Number);
    if (!Number.isInteger(hora) || !Number.isInteger(minuto)
        || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
        return null;
    }

    return new Date(
        dataBase.getFullYear(),
        dataBase.getMonth(),
        dataBase.getDate(),
        hora,
        minuto,
        0,
        0
    );
}

function obterPeriodoCadastroOperacao(operacao) {
    const inicioTexto = typeof operacao?.inicio === 'string' ? operacao.inicio.trim() : '';
    const fimTexto = typeof operacao?.fim === 'string' ? operacao.fim.trim() : '';
    if (!inicioTexto) return null;

    const inicioCompleto = parseDataCadastroOperacao(inicioTexto);
    const baseLegada = parseDataCadastroOperacao(operacao?.criadoEm);
    const inicioLegado = inicioCompleto || criarHorarioCadastroOperacao(inicioTexto, baseLegada);
    if (!inicioLegado) return null;

    if (!fimTexto) return { inicio: inicioLegado, fim: null };

    const fimCompletoOriginal = parseDataCadastroOperacao(fimTexto);
    const fimCompleto = fimCompletoOriginal ? new Date(fimCompletoOriginal.getTime()) : null;
    if (fimCompleto && parseDataCivilCadastroOperacao(fimTexto)) {
        fimCompleto.setDate(fimCompleto.getDate() + 1);
    }

    if (inicioCompleto && fimCompleto) {
        return fimCompleto.getTime() > inicioCompleto.getTime()
            ? { inicio: inicioCompleto, fim: fimCompleto }
            : null;
    }

    if (inicioCompleto) {
        const fim = criarHorarioCadastroOperacao(fimTexto, inicioCompleto);
        if (!fim) return null;
        if (fim.getTime() <= inicioCompleto.getTime()) fim.setDate(fim.getDate() + 1);
        return { inicio: inicioCompleto, fim };
    }

    if (fimCompleto) {
        const inicio = criarHorarioCadastroOperacao(inicioTexto, fimCompleto);
        if (!inicio) return null;
        if (inicio.getTime() >= fimCompleto.getTime()) inicio.setDate(inicio.getDate() - 1);
        return { inicio, fim: fimCompleto };
    }

    const inicio = criarHorarioCadastroOperacao(inicioTexto, baseLegada);
    const fim = criarHorarioCadastroOperacao(fimTexto, baseLegada);
    if (!inicio || !fim) return null;
    if (fim.getTime() <= inicio.getTime()) fim.setDate(fim.getDate() + 1);
    return { inicio, fim };
}

function obterFimCadastroOperacao(operacao) {
    return obterPeriodoCadastroOperacao(operacao)?.fim || null;
}

function cadastroOperacaoEstaAtivo(operacao) {
    if (operacao?.status === 'Inativa') return false;

    const periodo = obterPeriodoCadastroOperacao(operacao);
    return !!periodo && (!periodo.fim || periodo.fim.getTime() > Date.now());
}

function osEstaOcultaDaTela(os) {
    return !!(os && (os.ocultaNaTelaOS === true || os.ocultaNaTelaOS === 'true'));
}

function obterSnapshotPoligono(poligono) {
    if (!Array.isArray(poligono) || poligono.length < 3) return null;

    const pontos = [];
    for (const ponto of poligono) {
        const latOriginal = Array.isArray(ponto) ? ponto[0] : ponto?.lat;
        const lngOriginal = Array.isArray(ponto) ? ponto[1] : ponto?.lng;
        if (latOriginal == null || lngOriginal == null || latOriginal === '' || lngOriginal === '') return null;
        const lat = Number(latOriginal);
        const lng = Number(lngOriginal);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return null;
        }
        pontos.push({ lat, lng });
    }

    const primeiro = pontos[0];
    const ultimo = pontos[pontos.length - 1];
    if (pontos.length > 3 && primeiro.lat === ultimo.lat && primeiro.lng === ultimo.lng) {
        pontos.pop();
    }

    const pontosDistintos = new Set(pontos.map(ponto => `${ponto.lat}|${ponto.lng}`));
    return pontosDistintos.size >= 3 ? pontos : null;
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const paginaLista = document.getElementById('corpoTabelaOS');
        const paginaCadastro = document.getElementById('formCabecalho');

        if (paginaLista) {
            paginaLista.addEventListener('click', tratarAcaoTabelaOS);
            atualizarBotoesFiltroOS();
            carregarOS();
            restaurarFeedbackNavegacaoOS();
        }

        if (paginaCadastro) {
            carregarListaOperacoes();
            configurarCamposHorario();
            prepararNovoCadastro();

            const campoLocalAtividade = document.getElementById('localAtividade');
            if (campoLocalAtividade) {
                campoLocalAtividade.addEventListener('input', atualizarPreviewEnderecoLocal);
            }

            const campoPrescricoes = document.getElementById('prescricoesOS');
            if (campoPrescricoes) {
                campoPrescricoes.addEventListener('input', atualizarContadorPrescricoesOS);
            }

            atualizarInterfaceAtividade();

            const modalMapa = document.getElementById('modalMapaAtividade');
            if (modalMapa) {
                modalMapa.addEventListener('click', (event) => {
                    if (event.target === modalMapa) fecharMapaAtividade();
                });
            }

            const idCopia = new URLSearchParams(window.location.search).get('copiar');
            if (idCopia) copiarParaEditar(idCopia);
        }
    } catch (e) {
        console.error("Erro na inicialização:", e);
        mostrarFeedbackOS('error', 'Não foi possível iniciar esta página. Atualize e tente novamente.');
    }
});

document.addEventListener('keydown', (event) => {
    const modalMapa = document.getElementById('modalMapaAtividade');
    if (modalMapa?.style.display === 'flex') {
        if (event.key === 'Escape') fecharMapaAtividade();
        if (event.key === 'Tab') manterFocoModalOperacao(event, modalMapa);
        return;
    }

});

window.addEventListener('storage', (event) => {
    if (event.key === 'cadastrosOperacoes' && document.getElementById('listaOperacoes')) {
        carregarListaOperacoes();
    }
    if (event.key === 'ordensServico') {
        if (document.getElementById('corpoTabelaOS')) carregarOS();
        if (document.getElementById('numeroOS')) atualizarProximoNumeroOS();
    }
});

function normalizarHorario(valor) {
    const texto = String(valor ?? '').trim();
    let horas;
    let minutos;

    const partes = texto.match(/^(\d{1,2}):(\d{2})$/);
    if (partes) {
        horas = Number(partes[1]);
        minutos = Number(partes[2]);
    } else if (/^\d{3,4}$/.test(texto)) {
        const digitos = texto.padStart(4, '0');
        horas = Number(digitos.slice(0, 2));
        minutos = Number(digitos.slice(2));
    } else {
        return '';
    }

    if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return '';
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

function aplicarMascaraHorario(campo) {
    const valor = campo.value;

    if (valor.includes(':')) {
        const [parteHoras, ...partesMinutos] = valor.split(':');
        const horas = parteHoras.replace(/\D/g, '').slice(0, 2);
        const minutos = partesMinutos.join('').replace(/\D/g, '').slice(0, 2);
        campo.value = `${horas}:${minutos}`;
        return;
    }

    const digitos = valor.replace(/\D/g, '').slice(0, 4);
    if (digitos.length === 3 && Number(digitos.slice(0, 2)) > 23) {
        campo.value = `0${digitos.charAt(0)}:${digitos.slice(1)}`;
        return;
    }

    campo.value = digitos.length > 2
        ? `${digitos.slice(0, 2)}:${digitos.slice(2)}`
        : digitos;
}

function configurarCamposHorario() {
    document.querySelectorAll('.campo-horario').forEach((campo) => {
        campo.addEventListener('input', () => aplicarMascaraHorario(campo));
        campo.addEventListener('blur', () => {
            const horario = normalizarHorario(campo.value);
            if (horario) campo.value = horario;
        });
    });
}

function validarEFormatarHorario(campo, descricao) {
    const horario = normalizarHorario(campo.value);
    if (!horario) {
        alert(`Informe ${descricao} no formato HH:MM (00:00 a 23:59).`);
        campo.focus();
        return '';
    }

    campo.value = horario;
    return horario;
}

// --- GERENCIAMENTO DE OPERAÇÕES ---
function agendarAtualizacaoListaOperacoes(cadastros) {
    if (temporizadorListaOperacoes) {
        clearTimeout(temporizadorListaOperacoes);
        temporizadorListaOperacoes = null;
    }

    const agora = Date.now();
    const proximosTerminos = cadastros
        .map(obterFimCadastroOperacao)
        .filter((fim) => fim && fim.getTime() > agora)
        .map((fim) => fim.getTime());
    if (proximosTerminos.length === 0) return;

    const atrasoMaximo = 2147483000;
    const atraso = Math.min(
        Math.max(Math.min(...proximosTerminos) - agora + 250, 250),
        atrasoMaximo
    );
    temporizadorListaOperacoes = setTimeout(() => {
        temporizadorListaOperacoes = null;
        carregarListaOperacoes();
    }, atraso);
}

function carregarListaOperacoes() {
    const cadastros = lerCadastrosOperacoes(false);
    agendarAtualizacaoListaOperacoes(cadastros);
    const nomesSimples = cadastros
        .filter(cadastroOperacaoEstaAtivo)
        .map(op => normalizarNomeCadastroOperacao(op?.nome))
        .filter(Boolean);
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

function manterFocoModalOperacao(event, modal) {
    const elementos = Array.from(modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((elemento) => elemento.offsetParent !== null);
    if (elementos.length === 0) return;

    const primeiro = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    if (!modal.contains(document.activeElement)) {
        event.preventDefault();
        primeiro.focus();
    } else if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
    }
}

function definirFundoModalMapaInerte(inerte) {
    ['nav', '#sidebar', '#overlay', 'main'].forEach((seletor) => {
        const elemento = document.querySelector(seletor);
        if (!elemento) return;
        if (inerte) elemento.setAttribute('inert', '');
        else elemento.removeAttribute('inert');
    });
}

function numeroCoordenadaAtividade(valor) {
    if (valor == null || valor === '') return NaN;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

function normalizarTipoAtividade(valor) {
    return String(valor ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

function tipoAtividadeEh(valor, tipoEsperado) {
    return normalizarTipoAtividade(valor) === normalizarTipoAtividade(tipoEsperado);
}

function tipoAtividadePermiteVinculos(valor) {
    return tipoAtividadeEh(valor, 'Baseamento') || tipoAtividadeEh(valor, 'Patrulhamento');
}

function obterDadosMapaAtividade(atividade) {
    const localCadastrado = encontrarLocalAtividade(atividade?.tipo, atividade?.local, true);
    const gps = atividade?.gps && typeof atividade.gps === 'object' ? atividade.gps : {};
    const poligono = obterSnapshotPoligono(gps.poligono)
        || obterSnapshotPoligono(localCadastrado?.poligono);
    const latGps = numeroCoordenadaAtividade(gps.lat);
    const lngGps = numeroCoordenadaAtividade(gps.lng);
    const latLocal = numeroCoordenadaAtividade(localCadastrado?.lat);
    const lngLocal = numeroCoordenadaAtividade(localCadastrado?.lng);
    const lat = Number.isFinite(latGps) ? latGps : latLocal;
    const lng = Number.isFinite(lngGps) ? lngGps : lngLocal;
    const raioGps = numeroCoordenadaAtividade(gps.raio);
    const raioLocal = numeroCoordenadaAtividade(localCadastrado?.raio);
    const raio = Number.isFinite(raioGps) && raioGps > 0
        ? raioGps
        : Number.isFinite(raioLocal) && raioLocal > 0
            ? raioLocal
            : NaN;

    return { lat, lng, raio, poligono };
}

function atualizarStatusMapaAtividade(tipo, mensagem, carregando) {
    const status = document.getElementById('statusMapaAtividade');
    const texto = document.getElementById('statusMapaAtividadeTexto');
    const loading = document.getElementById('statusMapaAtividadeLoading');
    if (!status || !texto || !loading) return;

    status.className = `mapa-atividade-status${tipo ? ` ${tipo}` : ''}`;
    texto.textContent = mensagem;
    loading.hidden = !carregando;
}

function restaurarBotaoMapaAtividade() {
    if (botaoMapaEmCarregamento?.isConnected) {
        botaoMapaEmCarregamento.disabled = false;
        botaoMapaEmCarregamento.removeAttribute('aria-busy');
        botaoMapaEmCarregamento.textContent = textoOriginalBotaoMapa || '🗺️ Mapa';
    }
    botaoMapaEmCarregamento = null;
    textoOriginalBotaoMapa = '';
}

function finalizarCarregamentoMapaAtividade(token, tipo, mensagem) {
    if (token !== sequenciaCarregamentoMapa) return;
    if (temporizadorCarregamentoMapa) {
        clearTimeout(temporizadorCarregamentoMapa);
        temporizadorCarregamentoMapa = null;
    }
    atualizarStatusMapaAtividade(tipo, mensagem, false);
    restaurarBotaoMapaAtividade();
}

function abrirMapaAtividade(index, botao) {
    const atividade = listaAtividadesTemporaria[index];
    const tipoComMapa = tipoAtividadePermiteVinculos(atividade?.tipo);
    if (!atividade || !tipoComMapa) return;

    const dadosMapa = obterDadosMapaAtividade(atividade);
    const possuiCoordenadas = Number.isFinite(dadosMapa.lat) && Number.isFinite(dadosMapa.lng);
    if (!dadosMapa.poligono && !possuiCoordenadas) {
        mostrarFeedbackOS('error', 'Esta atividade não possui coordenadas válidas para visualização no mapa.');
        return;
    }

    const modal = document.getElementById('modalMapaAtividade');
    const titulo = document.getElementById('tituloMapaAtividade');
    const descricao = document.getElementById('descricaoMapaAtividade');
    if (!modal || !titulo || !descricao) {
        mostrarFeedbackOS('error', 'Não foi possível abrir a visualização do mapa.');
        return;
    }

    elementoRetornoModalMapa = botao || document.activeElement;
    botaoMapaEmCarregamento = botao || null;
    if (botaoMapaEmCarregamento) {
        textoOriginalBotaoMapa = botaoMapaEmCarregamento.textContent;
        botaoMapaEmCarregamento.disabled = true;
        botaoMapaEmCarregamento.setAttribute('aria-busy', 'true');
        botaoMapaEmCarregamento.textContent = 'Carregando...';
    }

    titulo.textContent = `${atividade.tipo}: ${atividade.local || 'Local sem identificação'}`;
    const endereco = [
        [atividade.rua, atividade.numero].filter(valor => valor && valor !== '-').join(', '),
        atividade.bairro,
        atividade.cidade
    ].filter(valor => valor && valor !== '-').join(' - ');
    const descricaoGeometria = dadosMapa.poligono
        ? `Área com ${dadosMapa.poligono.length} pontos`
        : Number.isFinite(dadosMapa.raio)
            ? `Raio de ${dadosMapa.raio} metros`
            : `GPS: ${dadosMapa.lat}, ${dadosMapa.lng}`;
    descricao.textContent = [endereco, descricaoGeometria].filter(Boolean).join(' • ');

    definirFundoModalMapaInerte(true);
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-mapa-aberto');
    atualizarStatusMapaAtividade('', 'Carregando mapa...', true);

    const token = ++sequenciaCarregamentoMapa;
    if (temporizadorCarregamentoMapa) clearTimeout(temporizadorCarregamentoMapa);

    window.setTimeout(() => {
        if (token !== sequenciaCarregamentoMapa) return;
        let carregamentoFinalizado = false;
        const concluirCarregamento = (tipo, mensagem) => {
            if (carregamentoFinalizado) return;
            carregamentoFinalizado = true;
            finalizarCarregamentoMapaAtividade(token, tipo, mensagem);
        };

        if (typeof L === 'undefined') {
            concluirCarregamento('error', 'Não foi possível carregar o recurso de mapas.');
            return;
        }

        try {
            if (mapaAtividade) mapaAtividade.remove();
            mapaAtividade = L.map('mapaAtividade');

            temporizadorCarregamentoMapa = window.setTimeout(() => {
                concluirCarregamento('error', 'O mapa demorou mais que o esperado para carregar.');
            }, 10000);

            const camadaBase = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap'
            });
            camadaBase.once('load', () => {
                concluirCarregamento('success', 'Mapa carregado com sucesso.');
            });
            camadaBase.once('tileerror', () => {
                concluirCarregamento('error', 'Não foi possível carregar todos os detalhes do mapa.');
            });
            camadaBase.addTo(mapaAtividade);

            if (dadosMapa.poligono) {
                const camadaPoligono = L.polygon(
                    dadosMapa.poligono.map(ponto => [ponto.lat, ponto.lng]),
                    { color: '#d32f2f', weight: 3, fillColor: '#f44336', fillOpacity: 0.2 }
                ).addTo(mapaAtividade);
                mapaAtividade.fitBounds(camadaPoligono.getBounds(), { padding: [25, 25], maxZoom: 17 });
            } else {
                const centro = [dadosMapa.lat, dadosMapa.lng];
                if (Number.isFinite(dadosMapa.raio)) {
                    const camadaCirculo = L.circle(centro, {
                        radius: dadosMapa.raio,
                        color: '#d32f2f',
                        fillColor: '#f44336',
                        fillOpacity: 0.2
                    }).addTo(mapaAtividade);
                    L.marker(centro).addTo(mapaAtividade);
                    mapaAtividade.fitBounds(camadaCirculo.getBounds(), { padding: [25, 25] });
                } else {
                    L.marker(centro).addTo(mapaAtividade);
                    mapaAtividade.setView(centro, 16);
                }
            }

            mapaAtividade.invalidateSize();
        } catch (erro) {
            console.error('Erro ao abrir mapa da atividade:', erro);
            concluirCarregamento('error', 'Não foi possível montar a visualização do mapa.');
        }
    }, 100);

    requestAnimationFrame(() => modal.querySelector('.modal-close-btn')?.focus());
}

function fecharMapaAtividade() {
    const modal = document.getElementById('modalMapaAtividade');
    if (!modal || modal.style.display !== 'flex') return;

    sequenciaCarregamentoMapa += 1;
    if (temporizadorCarregamentoMapa) {
        clearTimeout(temporizadorCarregamentoMapa);
        temporizadorCarregamentoMapa = null;
    }
    if (mapaAtividade) {
        mapaAtividade.remove();
        mapaAtividade = null;
    }

    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-mapa-aberto');
    definirFundoModalMapaInerte(false);
    restaurarBotaoMapaAtividade();

    if (elementoRetornoModalMapa?.isConnected) elementoRetornoModalMapa.focus();
    elementoRetornoModalMapa = null;
}

function validarOperacaoParaVinculo(nomeInformado, cadastros) {
    const nome = normalizarNomeCadastroOperacao(nomeInformado);
    if (!nome) return { valido: true, nome: '' };

    const cadastrosCorrespondentes = cadastros.filter((item) =>
        normalizarNomeCadastroOperacao(item?.nome) === nome
    );
    if (cadastrosCorrespondentes.length === 0) {
        return {
            valido: false,
            mensagem: 'Selecione uma operação cadastrada na tela de Operações Especiais ou deixe o campo em branco.'
        };
    }

    const cadastroAtivo = cadastrosCorrespondentes.find(cadastroOperacaoEstaAtivo);
    if (cadastroAtivo) {
        return { valido: true, nome: normalizarNomeCadastroOperacao(cadastroAtivo.nome) };
    }

    const foiInativadaManualmente = cadastrosCorrespondentes.some((cadastro) =>
        cadastro?.status === 'Inativa'
    );
    if (foiInativadaManualmente) {
        return {
            valido: false,
            mensagem: 'A operação selecionada foi inativada e não pode ser vinculada a uma nova atividade.'
        };
    }

    const possuiPeriodoInvalido = cadastrosCorrespondentes.some((cadastro) =>
        !obterPeriodoCadastroOperacao(cadastro)
    );
    if (possuiPeriodoInvalido) {
        return {
            valido: false,
            mensagem: 'A operação selecionada está sem um período válido. Complete o período na tela de Operações Especiais antes de vinculá-la.'
        };
    }

    return {
        valido: false,
        mensagem: 'A operação selecionada já foi encerrada e não pode ser vinculada a uma nova atividade.'
    };
}

// --- INTERFACE ---
function atualizarInterfaceAtividade() {
    const tipo = document.getElementById('tipoAtividade').value;
    const linhaLocal = document.getElementById('linhaLocalizacao');
    const campoLocal = document.getElementById('localAtividade');
    const campoOperacao = document.getElementById('nomeOperacao');
    const labelLocal = document.getElementById('labelLocal');
    const permiteVinculos = tipoAtividadePermiteVinculos(tipo);

    if (!linhaLocal || !campoLocal || !campoOperacao || !labelLocal) return;

    campoLocal.disabled = !permiteVinculos;
    campoOperacao.disabled = !permiteVinculos;
    if (permiteVinculos) {
        campoLocal.removeAttribute('aria-disabled');
        campoOperacao.removeAttribute('aria-disabled');
        campoOperacao.placeholder = 'Selecione uma operação cadastrada...';

        if (tipoAtividadeEh(tipo, 'Baseamento')) {
            labelLocal.innerText = "Ponto de Baseamento";
            campoLocal.placeholder = "Busque o ponto...";
        } else {
            labelLocal.innerText = "Área de Patrulhamento";
            campoLocal.placeholder = "Busque a área...";
        }

        if (campoLocal.dataset.tipoAtividade && campoLocal.dataset.tipoAtividade !== tipo) {
            campoLocal.value = "";
        }
        campoLocal.dataset.tipoAtividade = tipo;
        carregarSugestoesLocais(tipo);
    } else {
        campoLocal.setAttribute('aria-disabled', 'true');
        campoOperacao.setAttribute('aria-disabled', 'true');
        labelLocal.innerText = "Baseamento / Patrulhamento";
        campoLocal.placeholder = "Selecione Baseamento ou Patrulhamento";
        campoOperacao.placeholder = "Selecione Baseamento ou Patrulhamento";
        campoLocal.value = "";
        campoOperacao.value = "";
        delete campoLocal.dataset.tipoAtividade;
        const listaLocais = document.getElementById('listaLocais');
        if (listaLocais) listaLocais.innerHTML = '';
    }

    atualizarPreviewEnderecoLocal();
}

function primeiroTextoLocal(...valores) {
    for (const valor of valores) {
        if (valor == null) continue;
        const texto = String(valor).trim();
        if (texto && texto !== '-') return texto;
    }
    return '';
}

function normalizarIdentificadorLocal(valor) {
    return String(valor ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

function obterIdentificadorLocal(local) {
    return primeiroTextoLocal(local?.apelido, local?.nome, local?.codigo);
}

function obterFonteLocaisAtividade(tipo, incluirInativos = false) {
    const chave = tipoAtividadeEh(tipo, 'Baseamento')
        ? 'locaisCadastrados'
        : tipoAtividadeEh(tipo, 'Patrulhamento')
            ? 'pontosPatrulhamento'
            : '';
    if (!chave) return [];

    try {
        const fonte = JSON.parse(OrdenaStorage.getItem(chave)) || [];
        return Array.isArray(fonte)
            ? fonte.filter(local => local && (incluirInativos || local.status !== 'Inativo'))
            : [];
    } catch (erro) {
        console.error(`Erro ao carregar ${chave}:`, erro);
        return [];
    }
}

function encontrarLocalAtividade(tipo, identificador, incluirInativos = false) {
    const identificadorNormalizado = normalizarIdentificadorLocal(identificador);
    if (!identificadorNormalizado) return null;

    return obterFonteLocaisAtividade(tipo, incluirInativos).find(local =>
        normalizarIdentificadorLocal(obterIdentificadorLocal(local)) === identificadorNormalizado
    ) || null;
}

function atividadeEmEdicaoUsaLocal(tipo, identificador) {
    return !!atividadeEmEdicao
        && tipoAtividadeEh(atividadeEmEdicao.tipo, tipo)
        && normalizarIdentificadorLocal(atividadeEmEdicao.local) === normalizarIdentificadorLocal(identificador);
}

function montarDadosLocalAtividade(tipo, local) {
    if (!local) {
        return { rua: '-', numero: '-', bairro: '-', cidade: '-', detalhes: '-', gps: null };
    }

    const enderecoObjeto = local.endereco && typeof local.endereco === 'object'
        ? local.endereco
        : {};
    const enderecoTexto = typeof local.endereco === 'string' ? local.endereco : '';
    const rua = primeiroTextoLocal(
        local.rua,
        local.logradouro,
        local.nomeRua,
        enderecoObjeto.rua,
        enderecoObjeto.logradouro,
        enderecoTexto
    ) || '-';
    const numeroInformado = primeiroTextoLocal(local.numero, enderecoObjeto.numero);
    const numero = numeroInformado || (rua !== '-' ? 'S/N' : '-');
    const bairro = primeiroTextoLocal(local.bairro, enderecoObjeto.bairro) || '-';
    const cidade = primeiroTextoLocal(
        local.cidade,
        local.municipio,
        enderecoObjeto.cidade,
        enderecoObjeto.municipio
    ) || '-';
    const poligono = tipoAtividadeEh(tipo, 'Patrulhamento') ? obterSnapshotPoligono(local.poligono) : null;
    const detalhes = poligono
        ? `Polígono com ${poligono.length} pontos`
        : (primeiroTextoLocal(local.obs) || (local.raio ? `Raio ${local.raio}m` : 'Ponto Fixo'));

    const possuiCoordenadas = local.lat != null && local.lat !== '' && local.lng != null && local.lng !== '';
    let gps = null;
    if (possuiCoordenadas || poligono) {
        gps = {};
        if (possuiCoordenadas) {
            gps.lat = local.lat;
            gps.lng = local.lng;
        }
        if (poligono) gps.poligono = poligono;
        if (local.raio) gps.raio = local.raio;
    }

    return { rua, numero, bairro, cidade, detalhes, gps };
}

function formatarEnderecoAtividade(rua, numero, bairro, cidade, enderecoLegado = '') {
    const parteValida = valor => {
        const texto = String(valor || '').trim();
        return texto && texto !== '-' ? texto : '';
    };

    const ruaTexto = parteValida(rua);
    const numeroTexto = parteValida(numero);
    const legado = typeof enderecoLegado === 'string' ? parteValida(enderecoLegado) : '';
    const ruaBase = ruaTexto || legado;
    const logradouro = ruaBase
        ? `${ruaBase}${numeroTexto ? `, ${numeroTexto}` : ''}`
        : '';
    const endereco = [logradouro, parteValida(bairro), parteValida(cidade)].filter(Boolean);

    return endereco.length ? endereco.join(' - ') : '-';
}

function atualizarPreviewEnderecoLocal() {
    const campoTipo = document.getElementById('tipoAtividade');
    const campoLocal = document.getElementById('localAtividade');
    if (!campoTipo || !campoLocal) return;

    const incluirInativoAtual = atividadeEmEdicaoUsaLocal(campoTipo.value, campoLocal.value);
    const local = encontrarLocalAtividade(campoTipo.value, campoLocal.value, incluirInativoAtual);
    const dados = montarDadosLocalAtividade(campoTipo.value, local);
    const campos = {
        previewEnderecoAtividade: formatarEnderecoAtividade(dados.rua, dados.numero, dados.bairro, dados.cidade)
    };

    Object.entries(campos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = valor;
    });
}

function carregarSugestoesLocais(tipoSelecionado) {
    const lista = document.getElementById('listaLocais');
    if (!lista) return;
    lista.innerHTML = '';
    const identificadoresIncluidos = new Set();

    obterFonteLocaisAtividade(tipoSelecionado).forEach(local => {
        const identificador = obterIdentificadorLocal(local);
        const chaveIdentificador = normalizarIdentificadorLocal(identificador);
        if (!identificador || identificadoresIncluidos.has(chaveIdentificador)) return;

        identificadoresIncluidos.add(chaveIdentificador);
        const option = document.createElement('option');
        option.value = identificador;
        lista.appendChild(option);
    });
}

// --- FLUXO DE CRIAÇÃO ---
function calcularProximoNumeroOS(bancoOS) {
    const numeros = (Array.isArray(bancoOS) ? bancoOS : [])
        .map(os => Number.parseInt(os?.numero, 10))
        .filter(Number.isFinite);

    return numeros.reduce((maior, numero) => Math.max(maior, numero), 1000) + 1;
}

function atualizarProximoNumeroOS(bancoOS) {
    const ordens = Array.isArray(bancoOS)
        ? bancoOS
        : lerOrdensServico(false);
    const proximoNumero = calcularProximoNumeroOS(ordens);
    const campoNumero = document.getElementById('numeroOS');

    if (campoNumero) campoNumero.value = proximoNumero;
    return proximoNumero;
}

function liberarFracionamento() {
    const nome = document.getElementById('nomeOS').value;
    const campoInicio = document.getElementById('inicioGeral');
    const campoTermino = document.getElementById('terminoGeral');

    if(!nome || !campoInicio.value || !campoTermino.value) {
        alert("Preencha Missão e Turno.");
        return;
    }

    if (!validarEFormatarHorario(campoInicio, 'o início do turno')) return;
    if (!validarEFormatarHorario(campoTermino, 'o término do turno')) return;

    ['nomeOS', 'inicioGeral', 'terminoGeral', 'tipoRecursoOS'].forEach(id => {
        document.getElementById(id).disabled = true;
    });

    fracionamentoConfirmado = false;
    atualizarEtapaCadastroOS();
    document.getElementById('areaFracionamento').style.display = 'block';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Editar Cabeçalho";
    btn.className = "btn-secondary";
    btn.setAttribute('onclick', 'cancelarCriacao()');

    if (listaAtividadesTemporaria.length === 0) {
        document.getElementById('horaInicioAtiv').value = campoInicio.value;
        document.getElementById('horaFimAtiv').focus();
    }

    atualizarInterfaceAtividade();
}

function cancelarCriacao() {
    if (atividadeEmEdicao) cancelarEdicaoAtividade(false);
    fracionamentoConfirmado = false;
    atualizarEtapaCadastroOS();
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

function atualizarContadorPrescricoesOS() {
    const campo = document.getElementById('prescricoesOS');
    const contador = document.getElementById('contadorPrescricoesOS');
    if (!campo || !contador) return;

    const limite = Number(campo.maxLength) > 0 ? Number(campo.maxLength) : 1500;
    contador.textContent = `${campo.value.length}/${limite}`;
}

function atualizarEtapaCadastroOS() {
    const editor = document.getElementById('editorAtividade');
    const etapaConfirmacao = document.getElementById('etapaConfirmacaoFracionamento');
    const etapaObservacoes = document.getElementById('etapaObservacoesOS');
    const botaoConfirmar = document.getElementById('btnConfirmarFracionamento');
    const botaoCabecalho = document.getElementById('btnCriarOS');

    if (editor) editor.hidden = fracionamentoConfirmado;
    if (etapaConfirmacao) etapaConfirmacao.hidden = fracionamentoConfirmado;
    if (etapaObservacoes) etapaObservacoes.hidden = !fracionamentoConfirmado;
    if (botaoConfirmar) botaoConfirmar.setAttribute('aria-expanded', String(fracionamentoConfirmado));
    if (botaoCabecalho) {
        botaoCabecalho.disabled = fracionamentoConfirmado;
        botaoCabecalho.setAttribute('aria-disabled', String(fracionamentoConfirmado));
        if (fracionamentoConfirmado) {
            botaoCabecalho.title = 'Volte ao fracionamento para editar o cabeçalho.';
        } else {
            botaoCabecalho.removeAttribute('title');
        }
    }

    atualizarContadorPrescricoesOS();
}

function confirmarFracionamento() {
    if (salvamentoOSEmAndamento || fracionamentoConfirmado) return;
    if (atividadeEmEdicao) return alert('Salve ou cancele a edição da atividade antes de confirmar o fracionamento.');
    if (listaAtividadesTemporaria.length === 0) return alert('Adicione atividades antes de confirmar o fracionamento.');
    if (!validarVinculosAntesDeFinalizar()) return;

    fracionamentoConfirmado = true;
    atualizarEtapaCadastroOS();
    renderizarTabelaAtividades();
    mostrarFeedbackOS('info', 'Fracionamento confirmado. Revise as observações gerais e clique em “Criar Ordem de Serviço”.');

    window.requestAnimationFrame(() => {
        const etapa = document.getElementById('etapaObservacoesOS');
        const campo = document.getElementById('prescricoesOS');
        etapa?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        campo?.focus();
    });
}

function voltarAoFracionamento() {
    if (salvamentoOSEmAndamento) return;

    fracionamentoConfirmado = false;
    atualizarEtapaCadastroOS();
    renderizarTabelaAtividades();
    mostrarFeedbackOS('info', 'Fracionamento reaberto para edição. As observações digitadas foram preservadas.');

    window.requestAnimationFrame(() => {
        document.getElementById('tipoAtividade')?.focus();
    });
}

// --- ADICIONAR / EDITAR ATIVIDADE ---
function obterValoresEditorAtividade() {
    return {
        tipo: document.getElementById('tipoAtividade').value,
        inicio: document.getElementById('horaInicioAtiv').value,
        fim: document.getElementById('horaFimAtiv').value,
        local: document.getElementById('localAtividade').value,
        operacao: document.getElementById('nomeOperacao').value
    };
}

function preencherEditorAtividade(valores) {
    const dados = valores || {};
    const campoTipo = document.getElementById('tipoAtividade');
    const opcaoTipo = Array.from(campoTipo.options).find(option =>
        tipoAtividadeEh(option.value, dados.tipo)
    );

    campoTipo.value = opcaoTipo?.value || 'Preleção';
    atualizarInterfaceAtividade();
    document.getElementById('horaInicioAtiv').value = dados.inicio || '';
    document.getElementById('horaFimAtiv').value = dados.fim || '';
    document.getElementById('localAtividade').value = dados.local || '';
    document.getElementById('nomeOperacao').value = dados.operacao || '';
    atualizarPreviewEnderecoLocal();
}

function atualizarEstadoEditorAtividade() {
    const editando = !!atividadeEmEdicao;
    const editor = document.getElementById('editorAtividade');
    const acoes = document.getElementById('acoesEditorAtividade');
    const botaoSalvar = document.getElementById('btnAdicionarAtividade');
    const botaoCancelar = document.getElementById('btnCancelarEdicaoAtividade');
    if (!acoes || !botaoSalvar || !botaoCancelar) return;

    if (editor) {
        editor.classList.toggle('atividade-em-edicao', editando);
        editor.setAttribute('aria-label', editando ? 'Editar atividade selecionada' : 'Adicionar nova atividade');
    }
    acoes.classList.toggle('em-edicao', editando);
    botaoSalvar.textContent = editando ? 'Salvar edição' : '+ Adicionar';
    botaoSalvar.className = editando ? 'btn-success' : 'btn-info';
    botaoCancelar.hidden = !editando;
}

function editarAtividade(index) {
    const atividade = listaAtividadesTemporaria[index];
    if (!atividade || atividadeEmEdicao || fracionamentoConfirmado) return;

    const campoTipo = document.getElementById('tipoAtividade');
    const tipoDisponivel = Array.from(campoTipo?.options || []).some(option =>
        tipoAtividadeEh(option.value, atividade.tipo)
    );
    if (!tipoDisponivel) {
        mostrarFeedbackOS('error', `A atividade “${atividade.tipo || 'sem tipo'}” usa um tipo legado que não está disponível para edição.`);
        return;
    }

    valoresEditorAntesEdicao = obterValoresEditorAtividade();
    atividadeEmEdicao = atividade;
    preencherEditorAtividade(atividade);
    atualizarEstadoEditorAtividade();
    renderizarTabelaAtividades();

    document.querySelector('.fracionamento-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('tipoAtividade')?.focus();
    mostrarFeedbackOS('info', `Editando atividade de ${atividade.inicio || '-'} a ${atividade.fim || '-'}. Salve ou cancele a alteração.`);
}

function cancelarEdicaoAtividade(exibirFeedback = true) {
    if (!atividadeEmEdicao) return;

    atividadeEmEdicao = null;
    preencherEditorAtividade(valoresEditorAntesEdicao);
    valoresEditorAntesEdicao = null;
    atualizarEstadoEditorAtividade();
    renderizarTabelaAtividades();

    if (exibirFeedback) mostrarFeedbackOS('info', 'Edição da atividade cancelada. Nenhum dado foi alterado.');
}

function adicionarAtividade() {
    if (fracionamentoConfirmado) return;

    const tipo = document.getElementById('tipoAtividade').value;
    const campoInicio = document.getElementById('horaInicioAtiv');
    const campoFim = document.getElementById('horaFimAtiv');
    const campoLocal = document.getElementById('localAtividade');
    let local = campoLocal.value.trim();
    let operacao = normalizarNomeCadastroOperacao(document.getElementById('nomeOperacao').value);

    if (!campoInicio.value || !campoFim.value) return alert("Preencha os horários.");
    const inicio = validarEFormatarHorario(campoInicio, 'o início da atividade');
    if (!inicio) return;
    const fim = validarEFormatarHorario(campoFim, 'o término da atividade');
    if (!fim) return;
    const permiteVinculos = tipoAtividadePermiteVinculos(tipo);
    if (permiteVinculos && !local) return alert("Selecione o local.");

    const incluirInativoAtual = atividadeEmEdicaoUsaLocal(tipo, local);
    const localObj = local ? encontrarLocalAtividade(tipo, local, incluirInativoAtual) : null;
    if (permiteVinculos && !localObj) {
        alert("Selecione um local cadastrado na lista.");
        campoLocal.focus();
        return;
    }

    if (localObj) local = obterIdentificadorLocal(localObj);

    if (operacao) {
        let cadastrosOperacoes;
        try {
            cadastrosOperacoes = lerCadastrosOperacoes(true);
        } catch (erro) {
            alert('Não foi possível validar a operação selecionada. Tente novamente.');
            return;
        }

        const validacaoOperacao = validarOperacaoParaVinculo(operacao, cadastrosOperacoes);
        if (!validacaoOperacao.valido) {
            alert(validacaoOperacao.mensagem);
            carregarListaOperacoes();
            document.getElementById('nomeOperacao').focus();
            return;
        }
        operacao = validacaoOperacao.nome;
    }

    const { detalhes, rua, numero, bairro, cidade, gps } = montarDadosLocalAtividade(tipo, localObj);
    const editando = !!atividadeEmEdicao;
    const dadosAtividade = {
        id: atividadeEmEdicao?.id || Date.now(),
        tipo,
        inicio,
        fim,
        local,
        operacao,
        rua,
        numero,
        bairro,
        cidade,
        detalhes,
        gps
    };

    if (editando) {
        if (!listaAtividadesTemporaria.includes(atividadeEmEdicao)) {
            mostrarFeedbackOS('error', 'A atividade em edição não foi encontrada. Reabra a edição e tente novamente.');
            cancelarEdicaoAtividade(false);
            return;
        }
        Object.assign(atividadeEmEdicao, dadosAtividade);
    } else {
        listaAtividadesTemporaria.push(dadosAtividade);
    }

    // --- NOVA ORDENAÇÃO INTELIGENTE (CONSIDERA O INÍCIO DO TURNO) ---
    ordenarAtividadesPorTurno();

    atividadeEmEdicao = null;
    valoresEditorAntesEdicao = null;
    document.getElementById('localAtividade').value = "";
    document.getElementById('nomeOperacao').value = "";
    atualizarPreviewEnderecoLocal();
    atualizarEstadoEditorAtividade();
    renderizarTabelaAtividades();

    // Facilita a sequência: o término atual sugere o início da próxima atividade.
    // O campo continua habilitado para o usuário ajustar o horário, se necessário.
    document.getElementById('horaInicioAtiv').value = fim;
    document.getElementById('horaFimAtiv').value = '';
    document.getElementById('horaFimAtiv').focus();
    mostrarFeedbackOS('success', editando ? 'Atividade atualizada com sucesso.' : 'Atividade adicionada com sucesso.');
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
    const editor = document.getElementById('editorAtividade');
    if (!tbody || !editor) return;

    document.getElementById('tabelaAtividadesDepoisEditor')?.remove();
    tbody.innerHTML = '';

    const indiceEdicao = atividadeEmEdicao
        ? listaAtividadesTemporaria.indexOf(atividadeEmEdicao)
        : -1;
    let tbodyDepoisEditor = null;

    if (indiceEdicao >= 0) {
        tbodyDepoisEditor = document.createElement('tbody');
        tbodyDepoisEditor.id = 'tabelaAtividadesDepoisEditor';
        editor.insertAdjacentElement('afterend', tbodyDepoisEditor);
    }

    listaAtividadesTemporaria.forEach((ativ, index) => {
        const classeLinha = ativ.operacao ? "tr-operacao" : "";
        const linhaEmEdicao = atividadeEmEdicao === ativ;
        const edicaoBloqueada = !!atividadeEmEdicao || fracionamentoConfirmado;
        const tipoComMapa = tipoAtividadePermiteVinculos(ativ.tipo);

        // Durante a edição, o formulário ocupa exatamente o lugar da linha selecionada.
        if (linhaEmEdicao) return;

        const localTexto = `<strong>${escaparHtml(ativ.local || '-')}</strong>`;
        const operacaoTexto = ativ.operacao
            ? `<span class="badge-operacao">OP: ${escaparHtml(ativ.operacao)}</span>`
            : '-';
        const enderecoTexto = escaparHtml(formatarEnderecoAtividade(
            ativ.rua,
            ativ.numero,
            ativ.bairro,
            ativ.cidade,
            ativ.logradouro || ativ.endereco
        ));
        const tr = document.createElement('tr');
        tr.className = [classeLinha, linhaEmEdicao ? 'atividade-em-edicao' : ''].filter(Boolean).join(' ');
        tr.innerHTML = `
            <td data-label="Atividade">${escaparHtml(ativ.tipo)}</td>
            <td data-label="Início">${escaparHtml(ativ.inicio)}</td>
            <td data-label="Fim">${escaparHtml(ativ.fim)}</td>
            <td data-label="Local">${localTexto}</td>
            <td data-label="Operação">${operacaoTexto}</td>
            <td data-label="Endereço">${enderecoTexto}</td>
            <td data-label="Ações">
                <div class="acoes-fracionamento" role="group" aria-label="Ações da atividade de ${escaparHtml(ativ.inicio || '-')} a ${escaparHtml(ativ.fim || '-')}">
                    <button type="button" onclick="editarAtividade(${index})" class="btn-warning" ${edicaoBloqueada ? 'disabled aria-disabled="true"' : ''} aria-label="Editar atividade de ${escaparHtml(ativ.inicio || '-')} a ${escaparHtml(ativ.fim || '-')}">${linhaEmEdicao ? 'Editando' : 'Editar'}</button>
                    <button type="button" onclick="abrirMapaAtividade(${index}, this)" class="btn-info" ${tipoComMapa ? '' : 'disabled aria-disabled="true"'} aria-label="${tipoComMapa ? 'Visualizar atividade no mapa' : 'Mapa indisponível para esta atividade'}" title="${tipoComMapa ? 'Visualizar atividade no mapa' : 'Mapa disponível apenas para Baseamento e Patrulhamento'}">🗺️ Mapa</button>
                    <button type="button" onclick="removerAtividade(${index})" class="btn-danger" ${fracionamentoConfirmado ? 'disabled aria-disabled="true"' : ''} aria-label="Remover atividade de ${escaparHtml(ativ.inicio || '-')} a ${escaparHtml(ativ.fim || '-')}">Remover</button>
                </div>
            </td>
        `;
        const destino = indiceEdicao >= 0 && index > indiceEdicao
            ? tbodyDepoisEditor
            : tbody;
        destino.appendChild(tr);
    });
}

function removerAtividade(index) {
    if (fracionamentoConfirmado) return;

    const atividade = listaAtividadesTemporaria[index];
    if (!atividade) return;
    if (atividadeEmEdicao === atividade) cancelarEdicaoAtividade(false);
    listaAtividadesTemporaria.splice(index, 1);
    renderizarTabelaAtividades();
    mostrarFeedbackOS('success', 'Atividade removida com sucesso.');
}

// --- FINALIZAR OS ---
function validarVinculosAntesDeFinalizar() {
    const atividadesComOperacao = listaAtividadesTemporaria.filter((atividade) =>
        normalizarNomeCadastroOperacao(atividade?.operacao)
    );
    if (atividadesComOperacao.length === 0) return true;

    let cadastros;
    try {
        cadastros = lerCadastrosOperacoes(true);
    } catch (erro) {
        alert('Não foi possível validar as operações vinculadas. Tente novamente.');
        return false;
    }

    for (const atividade of atividadesComOperacao) {
        const validacao = validarOperacaoParaVinculo(atividade.operacao, cadastros);
        if (!validacao.valido) {
            alert(`Não foi possível finalizar a OS. ${validacao.mensagem}`);
            carregarListaOperacoes();
            return false;
        }
        atividade.operacao = validacao.nome;
    }

    return true;
}

async function finalizarOS() {
    if (salvamentoOSEmAndamento) return;
    if (!fracionamentoConfirmado) {
        mostrarFeedbackOS('error', 'Confirme o fracionamento antes de criar a Ordem de Serviço.');
        document.getElementById('btnConfirmarFracionamento')?.focus();
        return;
    }
    if (atividadeEmEdicao) return alert("Salve ou cancele a edição da atividade antes de finalizar a OS.");
    if (listaAtividadesTemporaria.length === 0) return alert("Adicione atividades.");
    if (!validarVinculosAntesDeFinalizar()) return;

    const botaoCriar = document.getElementById('btnCriarOSFinal');
    const botaoVoltar = document.getElementById('btnVoltarFracionamento');
    const campoPrescricoes = document.getElementById('prescricoesOS');
    const textoBotaoCriar = document.getElementById('textoBtnCriarOSFinal');
    const loadingBotaoCriar = document.getElementById('loadingCriarOSFinal');
    if (!botaoCriar || !campoPrescricoes || !textoBotaoCriar || !loadingBotaoCriar) return;

    const limitePrescricoes = Number(campoPrescricoes.maxLength) > 0
        ? Number(campoPrescricoes.maxLength)
        : 1500;
    if (campoPrescricoes.value.length > limitePrescricoes) {
        mostrarFeedbackOS('error', `As observações devem ter no máximo ${limitePrescricoes} caracteres.`);
        campoPrescricoes.focus();
        return;
    }

    const prescricoes = campoPrescricoes.value.trim();
    salvamentoOSEmAndamento = true;
    botaoCriar.disabled = true;
    botaoCriar.setAttribute('aria-busy', 'true');
    if (botaoVoltar) botaoVoltar.disabled = true;
    campoPrescricoes.disabled = true;
    textoBotaoCriar.textContent = 'Criando OS...';
    loadingBotaoCriar.hidden = false;
    mostrarFeedbackOS('info', 'Criando a ordem de serviço...');

    // Permite que o estado visual de processamento apareça antes da gravação local.
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
        const bancoOS = lerOrdensServico(true);
        const novoNumero = atualizarProximoNumeroOS(bancoOS);
        const baseadaEmCopia = idEdicaoOS !== -1;

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
            dataInicio: '',
            dataTermino: '',
            prescricoes,
            atividades: listaAtividadesTemporaria
        };

        bancoOS.push(novaOS);
        await OrdenaStorage.setItem('ordensServico', JSON.stringify(bancoOS));

        let mensagem = `Ordem de Serviço Nº ${novoNumero} criada com sucesso.`;
        if (baseadaEmCopia) mensagem += ' Ela foi gerada a partir da cópia selecionada.';

        mostrarFeedbackOS('success', `${mensagem} Abrindo a lista de OS ativas...`);
        salvarFeedbackNavegacaoOS('success', mensagem);
        textoBotaoCriar.textContent = 'OS criada!';
        loadingBotaoCriar.hidden = true;

        window.setTimeout(() => {
            window.location.href = 'os.html?filtro=Ativa';
        }, 700);
    } catch (erro) {
        console.error('Erro ao salvar ordem de serviço:', erro);
        salvamentoOSEmAndamento = false;
        botaoCriar.disabled = false;
        botaoCriar.removeAttribute('aria-busy');
        if (botaoVoltar) botaoVoltar.disabled = false;
        campoPrescricoes.disabled = false;
        textoBotaoCriar.textContent = 'Criar Ordem de Serviço';
        loadingBotaoCriar.hidden = true;
        mostrarFeedbackOS('error', 'Não foi possível salvar a ordem de serviço. Nenhum dado foi alterado.');
    }
}

// --- TABELA PRINCIPAL ---
function carregarOS() {
    const tbody = document.getElementById('corpoTabelaOS');
    if (!tbody) return;

    const bancoOS = lerOrdensServico(false);
    tbody.innerHTML = '';

    const filtradas = bancoOS.filter(os => os.status === statusFiltroAtual && !osEstaOcultaDaTela(os));
    filtradas.sort((a,b) => b.numero - a.numero);

    if (filtradas.length === 0) {
        const descricaoStatus = statusFiltroAtual === 'Ativa' ? 'ativa' : 'inativa';
        tbody.innerHTML = `
            <tr class="os-empty-row">
                <td colspan="6">Nenhuma ordem de serviço ${descricaoStatus} encontrada.</td>
            </tr>
        `;
        return;
    }

    filtradas.forEach(os => {
        const atividades = Array.isArray(os.atividades) ? os.atividades : [];
        const operacaoEncontrada = atividades.find(a => a && a.operacao);
        let detalhesOp = '<span style="color:#999; font-size:0.8rem;">-</span>';

        if (operacaoEncontrada) {
            detalhesOp = `<span class="badge-op-table">${escaparHtml(operacaoEncontrada.operacao)}</span>`;
        }

        const tr = document.createElement('tr');
        const idSeguro = escaparHtml(os.id);
        const botaoInativar = statusFiltroAtual === 'Ativa'
            ? `<button type="button" data-os-action="inativar" data-os-id="${idSeguro}" class="btn-secondary" style="padding:6px 10px;">Inativar</button>`
            : '';
        const botaoOcultar = statusFiltroAtual === 'Inativa'
            ? `<button type="button" data-os-action="ocultar" data-os-id="${idSeguro}" class="btn-danger" style="padding:6px 10px;">Ocultar</button>`
            : '';

        tr.innerHTML = `
            <td data-label="Nº OS"><strong>${escaparHtml(os.numero)}</strong></td>
            <td data-label="Missão">${escaparHtml(os.nomeOS || '-')}</td>
            <td data-label="Início">${escaparHtml(os.inicioGeral || '-')}</td>
            <td data-label="Término">${escaparHtml(os.terminoGeral || '-')}</td>
            <td data-label="Operação Especial">
                <div style="line-height:1.2;">
                    ${detalhesOp}
                </div>
            </td>
            <td data-label="Ações" style="text-align: center;">
                <div class="acoes-os">
                    <button type="button" data-os-action="copiar" data-os-id="${idSeguro}" class="btn-warning" style="padding:6px 10px;">Editar</button>
                    <button type="button" data-os-action="imprimir" data-os-id="${idSeguro}" class="btn-info" style="padding:6px 10px;">Imprimir</button>
                    ${botaoInativar}
                    ${botaoOcultar}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function tratarAcaoTabelaOS(event) {
    const botao = event.target.closest('[data-os-action][data-os-id]');
    if (!botao) return;

    const id = botao.dataset.osId;
    const acao = botao.dataset.osAction;
    if (acao === 'copiar') copiarParaEditar(id);
    if (acao === 'imprimir') imprimirOS(id);
    if (acao === 'inativar') inativarOS(id);
    if (acao === 'ocultar') ocultarOSDaTela(id);
}

function copiarParaEditar(id) {
    if (!document.getElementById('formCabecalho')) {
        window.location.href = `cadastro_os.html?copiar=${encodeURIComponent(String(id))}`;
        return;
    }

    const bancoOS = lerOrdensServico(false);
    const os = bancoOS.find(o => String(o?.id) === String(id));
    if (!os) {
        mostrarFeedbackOS('error', 'Não foi possível localizar a OS selecionada para gerar a cópia.');
        return;
    }

    document.getElementById('nomeOS').value = os.nomeOS || '';
    document.getElementById('tipoRecursoOS').value = os.tipoRecurso || 'Geral';
    document.getElementById('inicioGeral').value = os.inicioGeral || '';
    document.getElementById('terminoGeral').value = os.terminoGeral || '';
    document.getElementById('prescricoesOS').value = typeof os.prescricoes === 'string' ? os.prescricoes : '';
    atualizarContadorPrescricoesOS();
    atualizarProximoNumeroOS();

    listaAtividadesTemporaria = JSON.parse(JSON.stringify(
        Array.isArray(os.atividades) ? os.atividades : []
    ));

    // Reordena ao carregar para garantir
    // Mas precisamos setar o valor do input primeiro, o que já foi feito acima
    ordenarAtividadesPorTurno();

    liberarFracionamento();
    renderizarTabelaAtividades();

    idEdicaoOS = os.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('btnConfirmarFracionamento').innerText = 'Confirmar Fracionamento e Continuar';
    mostrarFeedbackOS('info', `Cópia da OS Nº ${os.numero || '-'} carregada. Ao confirmar e criar, uma nova OS será gerada.`);
}

async function inativarOS(id) {
    if(!confirm("Inativar esta OS?")) return;

    try {
        const bancoOS = lerOrdensServico(true);
        const index = bancoOS.findIndex(o => String(o?.id) === String(id));
        if(index === -1) {
            mostrarFeedbackOS('error', 'A OS selecionada não foi encontrada.');
            return;
        }

        bancoOS[index].status = 'Inativa';
        await OrdenaStorage.setItem('ordensServico', JSON.stringify(bancoOS));
        carregarOS();
        mostrarFeedbackOS('success', `OS Nº ${bancoOS[index].numero || '-'} inativada com sucesso.`);
    } catch (erro) {
        console.error('Erro ao inativar ordem de serviço:', erro);
        mostrarFeedbackOS('error', 'Não foi possível inativar a OS. Tente novamente.');
    }
}

async function ocultarOSDaTela(id) {
    if (!confirm("Ocultar esta OS da tela? Ela será mantida no banco de dados.")) return;

    try {
        const bancoOS = lerOrdensServico(true);
        const index = bancoOS.findIndex(o => String(o?.id) === String(id));
        if (index === -1) {
            mostrarFeedbackOS('error', 'A OS selecionada não foi encontrada.');
            return;
        }

        bancoOS[index].ocultaNaTelaOS = true;
        bancoOS[index].ocultaEm = new Date().toISOString();
        await OrdenaStorage.setItem('ordensServico', JSON.stringify(bancoOS));
        carregarOS();
        mostrarFeedbackOS('success', `OS Nº ${bancoOS[index].numero || '-'} ocultada da listagem. Os dados foram mantidos.`);
    } catch (erro) {
        console.error('Erro ao ocultar ordem de serviço:', erro);
        mostrarFeedbackOS('error', 'Não foi possível ocultar a OS. Tente novamente.');
    }
}

function mudarFiltro(status) {
    if (status !== 'Ativa' && status !== 'Inativa') return;

    statusFiltroAtual = status;
    atualizarBotoesFiltroOS();

    if (window.history && typeof window.history.replaceState === 'function') {
        const url = new URL(window.location.href);
        url.searchParams.set('filtro', status);
        window.history.replaceState({}, '', url);
    }

    carregarOS();
}

function atualizarBotoesFiltroOS() {
    const botaoAtivas = document.getElementById('btnFiltroAtiva');
    const botaoInativas = document.getElementById('btnFiltroInativa');

    if (botaoAtivas) {
        const selecionado = statusFiltroAtual === 'Ativa';
        botaoAtivas.classList.toggle('active', selecionado);
        botaoAtivas.setAttribute('aria-pressed', String(selecionado));
    }

    if (botaoInativas) {
        const selecionado = statusFiltroAtual === 'Inativa';
        botaoInativas.classList.toggle('active', selecionado);
        botaoInativas.setAttribute('aria-pressed', String(selecionado));
    }
}

function prepararNovoCadastro() {
    if (!document.getElementById('formCabecalho')) return;

    atualizarProximoNumeroOS();
    document.getElementById('nomeOS').value = '';
    document.getElementById('tipoRecursoOS').value = 'Geral';
    document.getElementById('inicioGeral').value = '';
    document.getElementById('terminoGeral').value = '';
    document.getElementById('horaInicioAtiv').value = '';
    document.getElementById('horaFimAtiv').value = '';
    const campoPrescricoes = document.getElementById('prescricoesOS');
    if (campoPrescricoes) {
        campoPrescricoes.value = '';
        campoPrescricoes.disabled = false;
    }

    ['nomeOS', 'inicioGeral', 'terminoGeral', 'tipoRecursoOS'].forEach(id => {
        document.getElementById(id).disabled = false;
    });

    document.getElementById('areaFracionamento').style.display = 'none';
    const btn = document.getElementById('btnCriarOS');
    btn.innerText = "Criar e Fracionar";
    btn.className = "btn-primary";
    btn.setAttribute('onclick', 'liberarFracionamento()');

    const botaoConfirmar = document.getElementById('btnConfirmarFracionamento');
    if (botaoConfirmar) {
        botaoConfirmar.innerText = 'Confirmar Fracionamento e Continuar';
        botaoConfirmar.disabled = false;
        botaoConfirmar.removeAttribute('aria-busy');
    }

    const botaoCriar = document.getElementById('btnCriarOSFinal');
    const botaoVoltar = document.getElementById('btnVoltarFracionamento');
    const textoBotaoCriar = document.getElementById('textoBtnCriarOSFinal');
    const loadingBotaoCriar = document.getElementById('loadingCriarOSFinal');
    if (botaoCriar) {
        botaoCriar.disabled = false;
        botaoCriar.removeAttribute('aria-busy');
    }
    if (botaoVoltar) botaoVoltar.disabled = false;
    if (textoBotaoCriar) textoBotaoCriar.textContent = 'Criar Ordem de Serviço';
    if (loadingBotaoCriar) loadingBotaoCriar.hidden = true;

    listaAtividadesTemporaria = [];
    idEdicaoOS = -1;
    atividadeEmEdicao = null;
    valoresEditorAntesEdicao = null;
    fracionamentoConfirmado = false;
    salvamentoOSEmAndamento = false;
    atualizarEstadoEditorAtividade();
    atualizarEtapaCadastroOS();
    renderizarTabelaAtividades();
}

// --- IMPRESSÃO PDF ---
function imprimirOS(id) {
    const bancoOS = lerOrdensServico(false);
    const os = bancoOS.find(o => String(o?.id) === String(id));
    if (!os) {
        mostrarFeedbackOS('error', 'Não foi possível localizar a OS selecionada para impressão.');
        return;
    }

    const atividades = (Array.isArray(os.atividades) ? os.atividades : []).map(ativ => {
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
            operacao: ativ.operacao || '',
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
        dataInicio: os.dataInicio || '',
        dataTermino: os.dataTermino || '',
        prescricoes: typeof os.prescricoes === 'string' ? os.prescricoes : '',
        status: os.status || 'Ativa',
        atividades
    };

    try {
        OrdenaStorage.setItem('osImpressaoTemp', JSON.stringify(dadosImpressao));
        const janelaImpressao = window.open('impressao.html', '_blank');
        if (!janelaImpressao) {
            mostrarFeedbackOS('error', 'O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.');
        }
    } catch (erro) {
        console.error('Erro ao preparar impressão da OS:', erro);
        mostrarFeedbackOS('error', 'Não foi possível preparar a impressão desta OS.');
    }
}
