'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ESTADOS_MONITORAMENTO,
    INTERVALO_CONSULTA_GPS_MS,
    LIMITE_GPS_DESATUALIZADO_MS,
    obterApresentacaoEstado,
    avaliarPosicaoNoAlvo,
    avaliarRespostaGps,
    criarControladorMonitoramento
} = require('../js/mapa_tatico_monitoramento.js');

const AGORA_MS = Date.parse('2026-10-10T20:00:00.000Z');
const RAIO_TERRA_METROS = 6371008.8;
const ALVO_BASEAMENTO = Object.freeze({
    tipo: 'baseamento',
    centro: Object.freeze({ lat: 0, lng: 0 })
});

function grausLatitudeParaMetros(distanciaMetros) {
    return (distanciaMetros / RAIO_TERRA_METROS) * (180 / Math.PI);
}

function grausLongitudeParaMetros(distanciaMetros, latitude = 0) {
    return (distanciaMetros / (RAIO_TERRA_METROS * Math.cos(latitude * Math.PI / 180)))
        * (180 / Math.PI);
}

function registroGps({
    identificadorRadio = 'RADIO-1',
    latitude = 0,
    longitude = 0,
    dataHora = new Date(AGORA_MS).toISOString()
} = {}) {
    return { identificadorRadio, latitude, longitude, dataHora };
}

function respostaGps(opcoes) {
    return { posicoes: [registroGps(opcoes)] };
}

function criarPromessaControlada() {
    let resolver;
    let rejeitar;
    const promessa = new Promise((resolve, reject) => {
        resolver = resolve;
        rejeitar = reject;
    });
    return { promessa, resolver, rejeitar };
}

function criarTimersFalsos() {
    let proximoId = 1;
    const agendamentos = [];
    const cancelamentos = [];

    return {
        setIntervalFn(callback, intervaloMs) {
            const agendamento = {
                id: proximoId++,
                callback,
                intervaloMs,
                ativo: true
            };
            agendamentos.push(agendamento);
            return agendamento.id;
        },
        clearIntervalFn(id) {
            cancelamentos.push(id);
            const agendamento = agendamentos.find(item => item.id === id);
            if (agendamento) agendamento.ativo = false;
        },
        executar(id = agendamentos.at(-1)?.id) {
            const agendamento = agendamentos.find(item => item.id === id);
            assert.ok(agendamento, `Timer ${id} deveria existir.`);
            assert.equal(agendamento.ativo, true, `Timer ${id} deveria estar ativo.`);
            agendamento.callback();
        },
        agendamentos,
        cancelamentos
    };
}

function criarAbortControllersFalsos() {
    const controladores = [];

    return {
        criar() {
            const signal = { aborted: false };
            const controlador = {
                signal,
                abortado: false,
                abort() {
                    controlador.abortado = true;
                    signal.aborted = true;
                }
            };
            controladores.push(controlador);
            return controlador;
        },
        controladores
    };
}

async function liberarFilaAssincrona() {
    await new Promise(resolve => setImmediate(resolve));
}

async function esperarAte(condicao, mensagem = 'A condição assíncrona não foi atendida.') {
    for (let tentativa = 0; tentativa < 20; tentativa += 1) {
        if (condicao()) return;
        await liberarFilaAssincrona();
    }
    assert.fail(mensagem);
}

function opcoesControlador({
    servico,
    timers,
    aborts,
    feedbacks,
    mudancas,
    aguardarRenderizacao
} = {}) {
    return {
        servico,
        agora: () => AGORA_MS,
        aguardarRenderizacao: aguardarRenderizacao || (async () => {}),
        setIntervalFn: timers?.setIntervalFn,
        clearIntervalFn: timers?.clearIntervalFn,
        criarAbortController: aborts ? () => aborts.criar() : undefined,
        onFeedback: evento => feedbacks?.push(evento),
        onChange: estado => mudancas?.push(estado)
    };
}

function registrarEquipePadrao(controlador, idEscala = 'escala-1') {
    controlador.registrarEquipe(idEscala, {
        identificadoresRadio: ['RADIO-1'],
        alvo: ALVO_BASEAMENTO
    });
}

test('expõe as apresentações visuais dos quatro estados de monitoramento', () => {
    const casos = [
        [ESTADOS_MONITORAMENTO.NAO_MONITORADO, 'NÃO MONITORADO', 'is-neutral'],
        [ESTADOS_MONITORAMENTO.NO_PONTO, 'NO PONTO', 'is-success'],
        [ESTADOS_MONITORAMENTO.FORA_DO_PONTO, 'FORA DO PONTO', 'is-danger'],
        [ESTADOS_MONITORAMENTO.SEM_DADOS, 'SEM DADOS', 'is-warning']
    ];

    for (const [estado, texto, classe] of casos) {
        assert.deepEqual(obterApresentacaoEstado(estado), { texto, classe });
    }
});

test('ativa com autorização e configuração, consulta imediatamente e repete em três minutos', async () => {
    const timers = criarTimersFalsos();
    const feedbacks = [];
    const chamadas = [];
    const servico = {
        async validarDisponibilidade({ signal }) {
            chamadas.push({ metodo: 'validarDisponibilidade', signal });
            return { autorizado: true, integracaoConfigurada: true };
        },
        async consultarPosicoes({ identificadoresRadio, signal }) {
            chamadas.push({ metodo: 'consultarPosicoes', identificadoresRadio, signal });
            return respostaGps();
        }
    };
    const controlador = criarControladorMonitoramento(opcoesControlador({
        servico,
        timers,
        feedbacks
    }));
    registrarEquipePadrao(controlador);

    assert.equal(await controlador.ativar('escala-1'), true);
    assert.deepEqual(chamadas.map(chamada => chamada.metodo), [
        'validarDisponibilidade',
        'consultarPosicoes'
    ]);
    assert.deepEqual(chamadas[1].identificadoresRadio, ['RADIO-1']);
    assert.deepEqual(controlador.obterEstado('escala-1'), {
        idEscala: 'escala-1',
        ativo: true,
        processando: false,
        acaoPendente: null,
        emConsulta: false,
        estado: ESTADOS_MONITORAMENTO.NO_PONTO
    });
    assert.equal(timers.agendamentos.length, 1);
    assert.equal(timers.agendamentos[0].intervaloMs, INTERVALO_CONSULTA_GPS_MS);
    assert.equal(INTERVALO_CONSULTA_GPS_MS, 3 * 60 * 1000);
    assert.ok(feedbacks.some(evento => evento.tipo === 'success'));

    timers.executar();
    await esperarAte(
        () => chamadas.filter(chamada => chamada.metodo === 'consultarPosicoes').length === 2,
        'A consulta automática de três minutos não foi iniciada.'
    );
});

test('mantém desligado e informa erro quando a permissão é negada', async () => {
    const timers = criarTimersFalsos();
    const feedbacks = [];
    let consultas = 0;
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        feedbacks,
        servico: {
            async validarDisponibilidade() {
                return {
                    autorizado: false,
                    integracaoConfigurada: true,
                    mensagem: 'Acesso restrito ao supervisor de turno.'
                };
            },
            async consultarPosicoes() {
                consultas += 1;
                return respostaGps();
            }
        }
    }));
    registrarEquipePadrao(controlador);

    assert.equal(await controlador.ativar('escala-1'), false);
    assert.equal(consultas, 0);
    assert.equal(timers.agendamentos.length, 0);
    assert.equal(controlador.obterEstado('escala-1').ativo, false);
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.NAO_MONITORADO);
    assert.ok(feedbacks.some(evento => (
        evento.tipo === 'error'
        && evento.mensagem === 'Acesso restrito ao supervisor de turno.'
    )));
});

test('sem integração CICOCÓ, informa erro e permanece NÃO MONITORADO com o switch desligado', async () => {
    const timers = criarTimersFalsos();
    const feedbacks = [];
    let consultas = 0;
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        feedbacks,
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: false };
            },
            async consultarPosicoes() {
                consultas += 1;
                return respostaGps();
            }
        }
    }));
    registrarEquipePadrao(controlador);

    assert.equal(await controlador.ativar('escala-1'), false);
    assert.equal(consultas, 0);
    assert.equal(timers.agendamentos.length, 0);
    const estadoFinal = controlador.obterEstado('escala-1');
    assert.equal(estadoFinal.ativo, false);
    assert.equal(estadoFinal.acaoPendente, null);
    assert.equal(estadoFinal.estado, ESTADOS_MONITORAMENTO.NAO_MONITORADO);
    assert.deepEqual(obterApresentacaoEstado(estadoFinal.estado), {
        texto: 'NÃO MONITORADO',
        classe: 'is-neutral'
    });
    assert.ok(feedbacks.some(evento => (
        evento.tipo === 'error'
        && /credenciais CICOCÓ não estão configuradas/i.test(evento.mensagem)
    )));
});

test('impede ativações concorrentes e não cria timers duplicados', async () => {
    const timers = criarTimersFalsos();
    const validacao = criarPromessaControlada();
    let validacoes = 0;
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        servico: {
            validarDisponibilidade() {
                validacoes += 1;
                return validacao.promessa;
            },
            async consultarPosicoes() {
                return respostaGps();
            }
        }
    }));
    registrarEquipePadrao(controlador);

    const primeiraAtivacao = controlador.ativar('escala-1');
    const ativacaoDuplicada = controlador.ativar('escala-1');
    assert.equal(await ativacaoDuplicada, false);
    await esperarAte(() => validacoes === 1);
    validacao.resolver({ autorizado: true, integracaoConfigurada: true });

    assert.equal(await primeiraAtivacao, true);
    assert.equal(await controlador.ativar('escala-1'), false);
    assert.equal(validacoes, 1);
    assert.equal(timers.agendamentos.length, 1);
    assert.equal(timers.agendamentos.filter(item => item.ativo).length, 1);
});

test('não valida disponibilidade após remoção durante a espera de renderização da ativação', async t => {
    for (const [nome, remover] of [
        ['sincronizarEquipes', controlador => controlador.sincronizarEquipes([])],
        ['destruir', controlador => controlador.destruir()]
    ]) {
        await t.test(nome, async () => {
            const renderizacao = criarPromessaControlada();
            const timers = criarTimersFalsos();
            const aborts = criarAbortControllersFalsos();
            const feedbacks = [];
            const mudancas = [];
            let validacoes = 0;
            let consultas = 0;
            const controlador = criarControladorMonitoramento(opcoesControlador({
                timers,
                aborts,
                feedbacks,
                mudancas,
                aguardarRenderizacao: () => renderizacao.promessa,
                servico: {
                    async validarDisponibilidade() {
                        validacoes += 1;
                        return { autorizado: true, integracaoConfigurada: true };
                    },
                    async consultarPosicoes() {
                        consultas += 1;
                        return respostaGps();
                    }
                }
            }));
            registrarEquipePadrao(controlador);

            const ativacao = controlador.ativar('escala-1');
            assert.equal(controlador.obterEstado('escala-1').processando, true);
            assert.equal(controlador.obterEstado('escala-1').acaoPendente, 'ativar');
            assert.equal(aborts.controladores.length, 1);

            remover(controlador);
            assert.equal(aborts.controladores[0].abortado, true);
            assert.equal(controlador.obterEstado('escala-1'), null);
            const mudancasAposRemocao = mudancas.length;
            renderizacao.resolver();

            assert.equal(await ativacao, false);
            assert.equal(validacoes, 0);
            assert.equal(consultas, 0);
            assert.equal(timers.agendamentos.length, 0);
            assert.equal(feedbacks.length, 0);
            assert.equal(mudancas.length, mudancasAposRemocao);
        });
    }
});

test('ao desligar, cancela timer e requisição e ignora resposta GPS antiga', async () => {
    const timers = criarTimersFalsos();
    const aborts = criarAbortControllersFalsos();
    const consultaPendente = criarPromessaControlada();
    let consultas = 0;
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        aborts,
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: true };
            },
            consultarPosicoes() {
                consultas += 1;
                return consultas === 1 ? Promise.resolve(respostaGps()) : consultaPendente.promessa;
            }
        }
    }));
    registrarEquipePadrao(controlador);
    await controlador.ativar('escala-1');

    timers.executar();
    await esperarAte(() => consultas === 2 && controlador.obterEstado('escala-1').emConsulta);
    const abortDaConsulta = aborts.controladores.at(-1);

    assert.equal(await controlador.desativar('escala-1'), true);
    assert.deepEqual(timers.cancelamentos, [timers.agendamentos[0].id]);
    assert.equal(abortDaConsulta.abortado, true);
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.NAO_MONITORADO);

    consultaPendente.resolver(respostaGps({ latitude: grausLatitudeParaMetros(100) }));
    await liberarFilaAssincrona();
    assert.deepEqual(controlador.obterEstado('escala-1'), {
        idEscala: 'escala-1',
        ativo: false,
        processando: false,
        acaoPendente: null,
        emConsulta: false,
        estado: ESTADOS_MONITORAMENTO.NAO_MONITORADO
    });
});

test('não emite sucesso nem mudança tardia após destruir durante a renderização da desativação', async () => {
    const renderizacaoDaDesativacao = criarPromessaControlada();
    const timers = criarTimersFalsos();
    const feedbacks = [];
    const mudancas = [];
    let renderizacoes = 0;
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        feedbacks,
        mudancas,
        aguardarRenderizacao() {
            renderizacoes += 1;
            return renderizacoes === 1
                ? Promise.resolve()
                : renderizacaoDaDesativacao.promessa;
        },
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: true };
            },
            async consultarPosicoes() {
                return respostaGps();
            }
        }
    }));
    registrarEquipePadrao(controlador);
    await controlador.ativar('escala-1');

    const desativacao = controlador.desativar('escala-1');
    assert.equal(renderizacoes, 2);
    assert.deepEqual(controlador.obterEstado('escala-1'), {
        idEscala: 'escala-1',
        ativo: false,
        processando: true,
        acaoPendente: 'desativar',
        emConsulta: false,
        estado: ESTADOS_MONITORAMENTO.NAO_MONITORADO
    });
    assert.equal(timers.cancelamentos.length, 1);
    assert.equal(
        feedbacks.some(evento => evento.mensagem === 'Supervisão automática desativada.'),
        false
    );
    const feedbacksAntesDeDestruir = feedbacks.length;
    const mudancasAntesDeDestruir = mudancas.length;

    controlador.destruir();
    renderizacaoDaDesativacao.resolver();

    assert.equal(await desativacao, false);
    assert.equal(controlador.obterEstado('escala-1'), null);
    assert.equal(feedbacks.length, feedbacksAntesDeDestruir);
    assert.equal(mudancas.length, mudancasAntesDeDestruir);
    assert.equal(timers.cancelamentos.length, 1);
    assert.equal(
        feedbacks.some(evento => evento.mensagem === 'Supervisão automática desativada.'),
        false
    );
});

test('limpa timer e requisição ao remover equipe ou destruir o controlador', async t => {
    async function prepararControlador() {
        const timers = criarTimersFalsos();
        const aborts = criarAbortControllersFalsos();
        const consultaPendente = criarPromessaControlada();
        let consultas = 0;
        const controlador = criarControladorMonitoramento(opcoesControlador({
            timers,
            aborts,
            servico: {
                async validarDisponibilidade() {
                    return { autorizado: true, integracaoConfigurada: true };
                },
                consultarPosicoes() {
                    consultas += 1;
                    return consultas === 1 ? Promise.resolve(respostaGps()) : consultaPendente.promessa;
                }
            }
        }));
        registrarEquipePadrao(controlador);
        await controlador.ativar('escala-1');
        timers.executar();
        await esperarAte(() => consultas === 2 && controlador.obterEstado('escala-1').emConsulta);
        return { controlador, timers, aborts, consultaPendente };
    }

    await t.test('sincronizarEquipes remove uma equipe ausente', async () => {
        const { controlador, timers, aborts, consultaPendente } = await prepararControlador();
        const abortDaConsulta = aborts.controladores.at(-1);

        controlador.sincronizarEquipes([]);

        assert.equal(controlador.obterEstado('escala-1'), null);
        assert.deepEqual(timers.cancelamentos, [timers.agendamentos[0].id]);
        assert.equal(abortDaConsulta.abortado, true);
        consultaPendente.resolver(respostaGps());
        await liberarFilaAssincrona();
    });

    await t.test('destruir limpa todas as equipes', async () => {
        const { controlador, timers, aborts, consultaPendente } = await prepararControlador();
        const abortDaConsulta = aborts.controladores.at(-1);

        controlador.destruir();

        assert.equal(controlador.obterEstado('escala-1'), null);
        assert.deepEqual(timers.cancelamentos, [timers.agendamentos[0].id]);
        assert.equal(abortDaConsulta.abortado, true);
        consultaPendente.resolver(respostaGps());
        await liberarFilaAssincrona();
    });
});

test('não inicia requisições concorrentes para a mesma viatura', async () => {
    const timers = criarTimersFalsos();
    const consultaPendente = criarPromessaControlada();
    let consultas = 0;
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: true };
            },
            consultarPosicoes() {
                consultas += 1;
                return consultas === 1 ? Promise.resolve(respostaGps()) : consultaPendente.promessa;
            }
        }
    }));
    registrarEquipePadrao(controlador);
    await controlador.ativar('escala-1');

    timers.executar();
    timers.executar();
    const consultaManual = controlador.consultarAgora('escala-1');
    await esperarAte(() => consultas === 2);

    assert.equal(consultas, 2);
    assert.deepEqual(await consultaManual, { executada: false });
    consultaPendente.resolver(respostaGps());
    await liberarFilaAssincrona();
    assert.equal(controlador.obterEstado('escala-1').emConsulta, false);
});

test('mudança de contexto aborta consulta pendente e impede aplicação da resposta antiga', async () => {
    const timers = criarTimersFalsos();
    const aborts = criarAbortControllersFalsos();
    const feedbacks = [];
    const respostaAntigaPendente = criarPromessaControlada();
    const chamadas = [];
    const novoAlvo = {
        tipo: 'baseamento',
        centro: { lat: 1, lng: 1 }
    };
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        aborts,
        feedbacks,
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: true };
            },
            consultarPosicoes(argumentos) {
                chamadas.push(argumentos);
                if (chamadas.length === 1) return Promise.resolve(respostaGps());
                if (chamadas.length === 2) return respostaAntigaPendente.promessa;
                return Promise.resolve(respostaGps({
                    identificadorRadio: 'RADIO-2',
                    latitude: 1,
                    longitude: 1
                }));
            }
        }
    }));
    registrarEquipePadrao(controlador);
    await controlador.ativar('escala-1');
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.NO_PONTO);

    const consultaAntiga = controlador.consultarAgora('escala-1');
    await esperarAte(() => chamadas.length === 2 && controlador.obterEstado('escala-1').emConsulta);
    assert.deepEqual(chamadas[1].identificadoresRadio, ['RADIO-1']);
    const signalDaConsultaAntiga = chamadas[1].signal;
    const feedbacksAntesDaMudanca = feedbacks.length;

    const estadoAposMudanca = controlador.registrarEquipe('escala-1', {
        identificadoresRadio: ['RADIO-2'],
        alvo: novoAlvo
    });
    assert.equal(signalDaConsultaAntiga.aborted, true);
    assert.equal(estadoAposMudanca.ativo, true);
    assert.equal(estadoAposMudanca.estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
    assert.deepEqual(await controlador.consultarAgora('escala-1'), { executada: false });

    respostaAntigaPendente.resolver({
        posicoes: [
            registroGps({ identificadorRadio: 'RADIO-1', latitude: 0, longitude: 0 }),
            registroGps({ identificadorRadio: 'RADIO-2', latitude: 1, longitude: 1 })
        ]
    });
    assert.deepEqual(await consultaAntiga, { executada: false });

    assert.equal(controlador.obterEstado('escala-1').ativo, true);
    assert.equal(controlador.obterEstado('escala-1').emConsulta, false);
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
    assert.equal(feedbacks.length, feedbacksAntesDaMudanca);
    assert.equal(timers.agendamentos.length, 1);

    const novaConsulta = await controlador.consultarAgora('escala-1');
    assert.equal(novaConsulta.executada, true);
    assert.equal(novaConsulta.estado, ESTADOS_MONITORAMENTO.NO_PONTO);
    assert.deepEqual(chamadas[2].identificadoresRadio, ['RADIO-2']);
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.NO_PONTO);
});

test('classifica GPS ausente, malformado ou desatualizado como SEM DADOS', async t => {
    const casos = [
        {
            nome: 'identificador da viatura ausente',
            identificadoresRadio: [],
            resposta: respostaGps()
        },
        {
            nome: 'registro correspondente ausente',
            identificadoresRadio: ['RADIO-1'],
            resposta: respostaGps({ identificadorRadio: 'OUTRO-RADIO' })
        },
        {
            nome: 'resposta malformada',
            identificadoresRadio: ['RADIO-1'],
            resposta: { resultado: 'inesperado' }
        },
        {
            nome: 'coordenada inválida',
            identificadoresRadio: ['RADIO-1'],
            resposta: respostaGps({ latitude: 'não-é-uma-latitude' })
        },
        {
            nome: 'timestamp inválido',
            identificadoresRadio: ['RADIO-1'],
            resposta: respostaGps({ dataHora: 'data inválida' })
        },
        {
            nome: 'posição desatualizada',
            identificadoresRadio: ['RADIO-1'],
            resposta: respostaGps({
                dataHora: new Date(AGORA_MS - LIMITE_GPS_DESATUALIZADO_MS - 1).toISOString()
            })
        }
    ];

    for (const caso of casos) {
        await t.test(caso.nome, () => {
            const avaliacao = avaliarRespostaGps({
                identificadoresRadio: caso.identificadoresRadio,
                resposta: caso.resposta,
                alvo: ALVO_BASEAMENTO,
                agoraMs: AGORA_MS
            });
            assert.equal(avaliacao.estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
        });
    }
});

test('correlaciona a posição GPS pelo identificador de rádio normalizado', () => {
    const resposta = {
        posicoes: [
            registroGps({ identificadorRadio: 'OUTRO-RADIO', latitude: grausLatitudeParaMetros(100) }),
            registroGps({ identificadorRadio: 'RADIO-1', latitude: 0 })
        ]
    };

    const correspondente = avaliarRespostaGps({
        identificadoresRadio: ['  radio-1  '],
        resposta,
        alvo: ALVO_BASEAMENTO,
        agoraMs: AGORA_MS
    });
    const semCorrespondencia = avaliarRespostaGps({
        identificadoresRadio: ['RADIO-INEXISTENTE'],
        resposta,
        alvo: ALVO_BASEAMENTO,
        agoraMs: AGORA_MS
    });

    assert.equal(correspondente.estado, ESTADOS_MONITORAMENTO.NO_PONTO);
    assert.equal(semCorrespondencia.estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
});

test('avalia baseamento dentro, fora e nos limites de tolerância', async t => {
    const casos = [
        {
            nome: 'coordenada pontual dentro de 20 metros',
            distanciaMetros: 10,
            alvo: ALVO_BASEAMENTO,
            esperado: true,
            limite: 20
        },
        {
            nome: 'coordenada pontual exatamente a 20 metros',
            distanciaMetros: 20,
            alvo: ALVO_BASEAMENTO,
            esperado: true,
            limite: 20
        },
        {
            nome: 'coordenada pontual fora de 20 metros',
            distanciaMetros: 20.001,
            alvo: ALVO_BASEAMENTO,
            esperado: false,
            limite: 20
        },
        {
            nome: 'baseamento cadastrado com 50 metros mantém limite de supervisão de 20',
            distanciaMetros: 20,
            alvo: { ...ALVO_BASEAMENTO, raioMetros: 50 },
            esperado: true,
            limite: 20
        },
        {
            nome: 'baseamento cadastrado com 50 metros não aceita 20.001 metros',
            distanciaMetros: 20.001,
            alvo: { ...ALVO_BASEAMENTO, raioMetros: 50 },
            esperado: false,
            limite: 20
        }
    ];

    for (const caso of casos) {
        await t.test(caso.nome, () => {
            const avaliacao = avaliarPosicaoNoAlvo(
                { lat: grausLatitudeParaMetros(caso.distanciaMetros), lng: 0 },
                caso.alvo
            );
            assert.equal(avaliacao.valido, true);
            assert.equal(avaliacao.noPonto, caso.esperado);
            assert.equal(avaliacao.limiteMetros, caso.limite);
        });
    }
});

test('avalia polígono por interior e borda sem margem externa', async t => {
    const poligono = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.001 },
        { lat: 0.001, lng: 0.001 },
        { lat: 0.001, lng: 0 }
    ];
    const alvo = { tipo: 'patrulhamento', poligono };
    const longitudeDaBorda = 0.001;
    const latitudeDoMeio = 0.0005;

    await t.test('ponto dentro do polígono', () => {
        const avaliacao = avaliarPosicaoNoAlvo({ lat: latitudeDoMeio, lng: 0.0005 }, alvo);
        assert.equal(avaliacao.valido, true);
        assert.equal(avaliacao.noPonto, true);
        assert.equal(avaliacao.distanciaMetros, 0);
    });

    for (const [nome, distanciaMetros, esperado] of [
        ['ponto exatamente na borda', 0, true],
        ['ponto um milímetro fora da borda', 0.001, false],
        ['ponto 19 metros fora da borda', 19, false],
        ['ponto exatamente 20 metros fora da borda', 20, false],
        ['ponto mais de 20 metros fora da borda', 20.001, false]
    ]) {
        await t.test(nome, () => {
            const avaliacao = avaliarPosicaoNoAlvo({
                lat: latitudeDoMeio,
                lng: longitudeDaBorda + grausLongitudeParaMetros(distanciaMetros, latitudeDoMeio)
            }, alvo);
            assert.equal(avaliacao.valido, true);
            assert.equal(avaliacao.noPonto, esperado);
        });
    }
});

test('geometria ausente ou inválida produz SEM DADOS', () => {
    const avaliacao = avaliarRespostaGps({
        identificadoresRadio: ['RADIO-1'],
        resposta: respostaGps(),
        alvo: { tipo: 'patrulhamento', poligono: [{ lat: 0, lng: 0 }] },
        agoraMs: AGORA_MS
    });

    assert.equal(avaliacao.estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
});

test('falha na consulta GPS inicial mantém supervisão ativa para nova tentativa', async () => {
    const timers = criarTimersFalsos();
    const feedbacks = [];
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        feedbacks,
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: true };
            },
            async consultarPosicoes() {
                throw new Error('Falha temporária na primeira consulta.');
            }
        }
    }));
    registrarEquipePadrao(controlador);

    assert.equal(await controlador.ativar('escala-1'), true);
    assert.equal(controlador.obterEstado('escala-1').ativo, true);
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
    assert.equal(timers.agendamentos.length, 1);
    assert.equal(timers.agendamentos[0].ativo, true);
    assert.equal(feedbacks.filter(evento => evento.tipo === 'error').length, 1);
    assert.equal(feedbacks.filter(evento => evento.tipo === 'success').length, 0);
});

test('primeira resposta GPS avaliada como SEM DADOS emite erro, não sucesso, e mantém supervisão ativa', async () => {
    const timers = criarTimersFalsos();
    const feedbacks = [];
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        feedbacks,
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: true };
            },
            async consultarPosicoes() {
                return { posicoes: [] };
            }
        }
    }));
    registrarEquipePadrao(controlador);

    assert.equal(await controlador.ativar('escala-1'), true);
    assert.equal(controlador.obterEstado('escala-1').ativo, true);
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
    assert.equal(timers.agendamentos.length, 1);
    assert.equal(timers.agendamentos[0].ativo, true);
    assert.equal(feedbacks.filter(evento => evento.tipo === 'success').length, 0);
    assert.equal(feedbacks.filter(evento => evento.tipo === 'error').length, 1);
    assert.match(
        feedbacks.find(evento => evento.tipo === 'error').mensagem,
        /sem dados de GPS/i
    );
});

test('falha da API mantém supervisão ativa, muda para SEM DADOS e evita spam', async () => {
    const timers = criarTimersFalsos();
    const feedbacks = [];
    let consultas = 0;
    const controlador = criarControladorMonitoramento(opcoesControlador({
        timers,
        feedbacks,
        servico: {
            async validarDisponibilidade() {
                return { autorizado: true, integracaoConfigurada: true };
            },
            async consultarPosicoes() {
                consultas += 1;
                if (consultas === 1) return respostaGps();
                throw new Error('CICOCÓ temporariamente indisponível.');
            }
        }
    }));
    registrarEquipePadrao(controlador);
    await controlador.ativar('escala-1');

    timers.executar();
    await esperarAte(() => (
        consultas === 2
        && controlador.obterEstado('escala-1').estado === ESTADOS_MONITORAMENTO.SEM_DADOS
        && !controlador.obterEstado('escala-1').emConsulta
    ));

    assert.equal(controlador.obterEstado('escala-1').ativo, true);
    assert.equal(timers.agendamentos[0].ativo, true);
    assert.equal(feedbacks.filter(evento => evento.tipo === 'error').length, 1);

    timers.executar();
    await esperarAte(() => consultas === 3 && !controlador.obterEstado('escala-1').emConsulta);
    assert.equal(controlador.obterEstado('escala-1').ativo, true);
    assert.equal(controlador.obterEstado('escala-1').estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
    assert.equal(feedbacks.filter(evento => evento.tipo === 'error').length, 1);
});
