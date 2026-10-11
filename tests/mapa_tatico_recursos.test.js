'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ESTADOS_MONITORAMENTO,
    URL_RECURSOS_GPS,
    criarServicoRecursos,
    criarControladorMonitoramento
} = require('../js/mapa_tatico_monitoramento.js');

const AGORA_MS = Date.parse('2026-10-10T20:00:00.000Z');
const INTERVALO_MS = 180000;
const COLETA = '2026-10-10T19:59:00.000Z';

function respostaRecursos(dados = [
    { identificador: '123456', latitude: -10, longitude: -45 },
    { identificador: '654321', latitude: -11, longitude: -46 }
]) {
    return {
        status: 'com_informacao',
        motivo: null,
        ultima_coleta: COLETA,
        total: dados.length,
        dados
    };
}

function respostaHttp(payload = respostaRecursos(), { ok = true, status = 200 } = {}) {
    return { ok, status, json: async () => payload };
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

function criarFetchControlado() {
    const chamadas = [];
    const fetchFn = (url, opcoes) => {
        const controle = criarPromessaControlada();
        const chamada = { url, opcoes, controle, abortada: false };
        chamadas.push(chamada);
        opcoes.signal.addEventListener('abort', () => {
            chamada.abortada = true;
            const erro = new Error('Consulta cancelada.');
            erro.name = 'AbortError';
            controle.rejeitar(erro);
        }, { once: true });
        return controle.promessa;
    };
    return { fetchFn, chamadas };
}

function criarTimersFalsos() {
    let proximoId = 1;
    const agendamentos = [];
    return {
        agendamentos,
        setTimeoutFn(callback, intervaloMs) {
            const agendamento = { id: proximoId++, callback, intervaloMs, ativo: true };
            agendamentos.push(agendamento);
            return agendamento.id;
        },
        clearTimeoutFn(id) {
            const agendamento = agendamentos.find(item => item.id === id);
            if (agendamento) agendamento.ativo = false;
        }
    };
}

function criarCenario(fetchFn) {
    let instante = AGORA_MS;
    const timers = criarTimersFalsos();
    const servico = criarServicoRecursos({
        fetchFn,
        agora: () => instante,
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn
    });
    return {
        servico,
        timers,
        agora: () => instante,
        avancar(ms) { instante += ms; }
    };
}

async function esperarAte(condicao) {
    for (let tentativa = 0; tentativa < 20; tentativa += 1) {
        if (condicao()) return;
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.fail('A consulta esperada não foi iniciada.');
}

test('o serviço converte todos os recursos e usa a hora de coleta recebida da API', async () => {
    const chamadas = [];
    const { servico } = criarCenario(async (url, opcoes) => {
        chamadas.push({ url, opcoes });
        return respostaHttp();
    });

    assert.equal(URL_RECURSOS_GPS, 'https://cecoco-api-production.up.railway.app/recursos');
    assert.deepEqual(await servico.validarDisponibilidade(), {
        autorizado: true,
        integracaoConfigurada: true
    });
    const resultado = await servico.consultarPosicoes();
    assert.deepEqual(resultado.posicoes, [
        { identificadorRadio: '123456', latitude: -10, longitude: -45, dataHora: COLETA },
        { identificadorRadio: '654321', latitude: -11, longitude: -46, dataHora: COLETA }
    ]);
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, URL_RECURSOS_GPS);
    assert.equal(chamadas[0].opcoes.method, 'GET');
    assert.equal(chamadas[0].opcoes.credentials, 'omit');
    assert.equal(chamadas[0].opcoes.cache, 'no-store');
    servico.encerrar();
});

test('uma resposta válida sem recursos mantém a lista vazia', async () => {
    const { servico } = criarCenario(async () => respostaHttp(respostaRecursos([])));
    assert.deepEqual((await servico.consultarPosicoes()).posicoes, []);
    servico.encerrar();
});

test('consultas concorrentes e dentro de três minutos compartilham um único GET', async () => {
    const fetch = criarFetchControlado();
    const { servico, avancar } = criarCenario(fetch.fetchFn);
    const primeira = servico.consultarPosicoes();
    const segunda = servico.consultarPosicoes();
    await esperarAte(() => fetch.chamadas.length === 1);
    fetch.chamadas[0].controle.resolver(respostaHttp());
    const [a, b] = await Promise.all([primeira, segunda]);
    assert.deepEqual(a, b);

    avancar(INTERVALO_MS - 1);
    assert.deepEqual(await servico.consultarPosicoes(), a);
    assert.equal(fetch.chamadas.length, 1);
    servico.encerrar();
});

test('o cache renova ao completar três minutos desde o início da consulta', async () => {
    const fetch = criarFetchControlado();
    const { servico, avancar } = criarCenario(fetch.fetchFn);
    const primeira = servico.consultarPosicoes();
    await esperarAte(() => fetch.chamadas.length === 1);
    avancar(20000);
    fetch.chamadas[0].controle.resolver(respostaHttp());
    await primeira;

    avancar(INTERVALO_MS - 20000);
    const segunda = servico.consultarPosicoes();
    await esperarAte(() => fetch.chamadas.length === 2);
    const novaColeta = '2026-10-10T20:02:00.000Z';
    const payload = { ...respostaRecursos(), ultima_coleta: novaColeta };
    fetch.chamadas[1].controle.resolver(respostaHttp(payload));
    assert.equal((await segunda).posicoes[0].dataHora, novaColeta);
    servico.encerrar();
});

test('falhas HTTP têm mensagem clara e também são compartilhadas até a próxima consulta', async () => {
    let chamadas = 0;
    const { servico, avancar } = criarCenario(async () => {
        chamadas += 1;
        return respostaHttp(undefined, { ok: false, status: 503 });
    });
    await assert.rejects(servico.consultarPosicoes(), /503|HTTP|indisponível|consultar|GPS|recursos/i);
    avancar(INTERVALO_MS - 1);
    await assert.rejects(servico.consultarPosicoes(), /503|HTTP|indisponível|consultar|GPS|recursos/i);
    assert.equal(chamadas, 1);
    avancar(1);
    await assert.rejects(servico.consultarPosicoes(), /503|HTTP|indisponível|consultar|GPS|recursos/i);
    assert.equal(chamadas, 2);
    servico.encerrar();
});

test('respostas sem informação geram erro em vez de inventar posições ou uma coleta recente', async () => {
    const { servico } = criarCenario(async () => respostaHttp({
        status: 'sem_informacao',
        motivo: 'Coleta indisponível',
        ultima_coleta: null,
        total: 0,
        dados: []
    }));
    await assert.rejects(servico.consultarPosicoes(), /coleta|informação|disponível|GPS|recursos/i);
    servico.encerrar();
});

test('JSON inválido e formato incompatível geram erros úteis', async (t) => {
    await t.test('falha ao ler JSON', async () => {
        const { servico } = criarCenario(async () => ({
            ok: true,
            status: 200,
            json: async () => { throw new SyntaxError('Unexpected token'); }
        }));
        await assert.rejects(servico.consultarPosicoes(), /JSON|resposta|formato|recursos/i);
        servico.encerrar();
    });
    await t.test('dados não são uma lista', async () => {
        const { servico } = criarCenario(async () => respostaHttp({
            ...respostaRecursos(),
            dados: null
        }));
        await assert.rejects(servico.consultarPosicoes(), /JSON|resposta|formato|dados|recursos/i);
        servico.encerrar();
    });
});

test('cancelar um consumidor preserva a consulta usada por outra equipe', async () => {
    const fetch = criarFetchControlado();
    const { servico } = criarCenario(fetch.fetchFn);
    const primeiroController = new AbortController();
    const segundoController = new AbortController();
    const primeira = servico.consultarPosicoes({ signal: primeiroController.signal });
    const segunda = servico.consultarPosicoes({ signal: segundoController.signal });
    const primeiraCancelada = assert.rejects(primeira, erro => erro.name === 'AbortError');
    await esperarAte(() => fetch.chamadas.length === 1);
    primeiroController.abort();
    await primeiraCancelada;
    assert.equal(fetch.chamadas[0].abortada, false);
    fetch.chamadas[0].controle.resolver(respostaHttp());
    assert.equal((await segunda).posicoes.length, 2);
    assert.equal(fetch.chamadas.length, 1);
    servico.encerrar();
});

test('cancelar todos os consumidores interrompe o GET e libera uma nova consulta', async () => {
    const fetch = criarFetchControlado();
    const { servico } = criarCenario(fetch.fetchFn);
    const controllers = [new AbortController(), new AbortController()];
    const promessas = controllers.map(controller => servico.consultarPosicoes({ signal: controller.signal }));
    const canceladas = Promise.all(promessas.map(promessa =>
        assert.rejects(promessa, erro => erro.name === 'AbortError')));
    await esperarAte(() => fetch.chamadas.length === 1);
    controllers.forEach(controller => controller.abort());
    await canceladas;
    assert.equal(fetch.chamadas[0].abortada, true);

    const novaConsulta = servico.consultarPosicoes();
    await esperarAte(() => fetch.chamadas.length === 2);
    fetch.chamadas[1].controle.resolver(respostaHttp());
    assert.equal((await novaConsulta).posicoes.length, 2);
    servico.encerrar();
});

test('o limite de trinta segundos cancela a rede e informa a demora da API', async () => {
    const fetch = criarFetchControlado();
    const { servico, timers } = criarCenario(fetch.fetchFn);
    const consulta = servico.consultarPosicoes();
    const falhou = assert.rejects(consulta, /tempo|demora|limite|30|timeout/i);
    await esperarAte(() => fetch.chamadas.length === 1);
    const timeout = timers.agendamentos.find(item => item.ativo && item.intervaloMs === 30000);
    assert.ok(timeout, 'A chamada à API deve ter um limite de 30 segundos.');
    timeout.callback();
    await falhou;
    assert.equal(fetch.chamadas[0].abortada, true);
    servico.encerrar();
});

test('encerrar cancela a consulta em andamento e limpa o cache para uma nova chamada', async () => {
    const fetch = criarFetchControlado();
    const { servico, timers } = criarCenario(fetch.fetchFn);
    const pendente = servico.consultarPosicoes();
    const cancelada = assert.rejects(pendente, erro => erro.name === 'AbortError');
    await esperarAte(() => fetch.chamadas.length === 1);
    servico.encerrar();
    await cancelada;
    assert.equal(fetch.chamadas[0].abortada, true);
    assert.equal(timers.agendamentos.some(item => item.ativo), false);

    const seguinte = servico.consultarPosicoes();
    await esperarAte(() => fetch.chamadas.length === 2);
    fetch.chamadas[1].controle.resolver(respostaHttp());
    await seguinte;
    servico.encerrar();

    const depoisDoCache = servico.consultarPosicoes();
    await esperarAte(() => fetch.chamadas.length === 3);
    fetch.chamadas[2].controle.resolver(respostaHttp());
    await depoisDoCache;
    servico.encerrar();
});

function criarControladorIntegrado(cenario) {
    const intervalos = [];
    const controlador = criarControladorMonitoramento({
        servico: cenario.servico,
        agora: cenario.agora,
        aguardarRenderizacao: async () => {},
        setIntervalFn(callback, intervaloMs) {
            const agendamento = { callback, intervaloMs, ativo: true };
            intervalos.push(agendamento);
            return agendamento;
        },
        clearIntervalFn(agendamento) { agendamento.ativo = false; }
    });
    const alvo = { tipo: 'baseamento', centro: { lat: -10, lng: -45 } };
    controlador.registrarEquipe('equipe-1', { identificadoresRadio: ['123456'], alvo });
    controlador.registrarEquipe('equipe-2', { identificadoresRadio: ['654321'], alvo });
    return { controlador, intervalos };
}

test('duas equipes confrontam identificadores diferentes com o mesmo GET a cada três minutos', async () => {
    const fetch = criarFetchControlado();
    const cenario = criarCenario(fetch.fetchFn);
    const { controlador, intervalos } = criarControladorIntegrado(cenario);
    const ativacoes = Promise.all([
        controlador.ativar('equipe-1'),
        controlador.ativar('equipe-2')
    ]);
    await esperarAte(() => fetch.chamadas.length === 1);
    fetch.chamadas[0].controle.resolver(respostaHttp());
    assert.deepEqual(await ativacoes, [true, true]);
    assert.equal(controlador.obterEstado('equipe-1').estado, ESTADOS_MONITORAMENTO.NO_PONTO);
    assert.equal(controlador.obterEstado('equipe-2').estado, ESTADOS_MONITORAMENTO.FORA_DO_PONTO);
    assert.equal(intervalos.length, 2);
    assert.ok(intervalos.every(item => item.intervaloMs === INTERVALO_MS));

    cenario.avancar(INTERVALO_MS);
    intervalos.forEach(item => item.callback());
    await esperarAte(() => fetch.chamadas.length === 2);
    assert.equal(controlador.obterEstado('equipe-1').emConsulta, true);
    assert.equal(controlador.obterEstado('equipe-2').emConsulta, true);
    fetch.chamadas[1].controle.resolver(respostaHttp(respostaRecursos([
        { identificador: '123456', latitude: -10.01, longitude: -45 },
        { identificador: '654321', latitude: -10, longitude: -45 }
    ])));
    await esperarAte(() => !controlador.obterEstado('equipe-1').emConsulta
        && !controlador.obterEstado('equipe-2').emConsulta);
    assert.equal(controlador.obterEstado('equipe-1').estado, ESTADOS_MONITORAMENTO.FORA_DO_PONTO);
    assert.equal(controlador.obterEstado('equipe-2').estado, ESTADOS_MONITORAMENTO.NO_PONTO);
    assert.equal(fetch.chamadas.length, 2);
    controlador.destruir();
});

test('desligar a última equipe limpa o snapshot, sem invalidar o usado por outra equipe ativa', async () => {
    let chamadas = 0;
    const cenario = criarCenario(async () => {
        chamadas += 1;
        return respostaHttp();
    });
    const { controlador, intervalos } = criarControladorIntegrado(cenario);
    await Promise.all([controlador.ativar('equipe-1'), controlador.ativar('equipe-2')]);
    assert.equal(chamadas, 1);
    await controlador.desativar('equipe-1');
    await controlador.ativar('equipe-1');
    assert.equal(chamadas, 1, 'Outra equipe ativa conserva a consulta compartilhada.');

    await controlador.desativar('equipe-1');
    await controlador.desativar('equipe-2');
    assert.ok(intervalos.every(item => !item.ativo));
    assert.equal(controlador.obterEstado('equipe-2').estado, ESTADOS_MONITORAMENTO.NAO_MONITORADO);
    await controlador.ativar('equipe-1');
    assert.equal(chamadas, 2, 'Ao religar depois de todas desligadas, a consulta deve ser nova.');
    controlador.destruir();
});

test('trocar alvo ou identificador reavalia o último JSON completo sem novo GET', async () => {
    let chamadas = 0;
    const cenario = criarCenario(async () => {
        chamadas += 1;
        return respostaHttp();
    });
    const { controlador } = criarControladorIntegrado(cenario);
    await controlador.ativar('equipe-1');
    assert.equal(controlador.obterEstado('equipe-1').estado, ESTADOS_MONITORAMENTO.NO_PONTO);
    const novoAlvo = { tipo: 'baseamento', centro: { lat: -11, lng: -46 } };
    controlador.registrarEquipe('equipe-1', {
        identificadoresRadio: ['123456'],
        alvo: novoAlvo
    });
    assert.equal(controlador.obterEstado('equipe-1').estado, ESTADOS_MONITORAMENTO.FORA_DO_PONTO);
    controlador.registrarEquipe('equipe-1', {
        identificadoresRadio: ['654321'],
        alvo: novoAlvo
    });
    assert.equal(controlador.obterEstado('equipe-1').estado, ESTADOS_MONITORAMENTO.NO_PONTO);
    controlador.registrarEquipe('equipe-1', {
        identificadoresRadio: ['999999'],
        alvo: novoAlvo
    });
    assert.equal(controlador.obterEstado('equipe-1').estado, ESTADOS_MONITORAMENTO.SEM_DADOS);
    assert.equal(chamadas, 1);
    controlador.destruir();
});
