(function (escopoGlobal, fabrica) {
    'use strict';

    const api = fabrica();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (escopoGlobal) {
        escopoGlobal.OrdenaMapaTaticoMonitoramento = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ESTADOS_MONITORAMENTO = Object.freeze({
        NAO_MONITORADO: 'nao-monitorado',
        NO_PONTO: 'no-ponto',
        FORA_DO_PONTO: 'fora-do-ponto',
        SEM_DADOS: 'sem-dados'
    });

    const APRESENTACOES_ESTADO = Object.freeze({
        [ESTADOS_MONITORAMENTO.NAO_MONITORADO]: Object.freeze({
            texto: 'NÃO MONITORADO',
            classe: 'is-neutral'
        }),
        [ESTADOS_MONITORAMENTO.NO_PONTO]: Object.freeze({
            texto: 'NO PONTO',
            classe: 'is-success'
        }),
        [ESTADOS_MONITORAMENTO.FORA_DO_PONTO]: Object.freeze({
            texto: 'FORA DO PONTO',
            classe: 'is-danger'
        }),
        [ESTADOS_MONITORAMENTO.SEM_DADOS]: Object.freeze({
            texto: 'SEM DADOS',
            classe: 'is-warning'
        })
    });

    const INTERVALO_CONSULTA_GPS_MS = 3 * 60 * 1000;
    const TOLERANCIA_GEOGRAFICA_METROS = 20;
    const URL_RECURSOS_GPS = 'https://cecoco-api-production.up.railway.app/recursos';

    // A API informa ultima_coleta; posições com coleta antiga não confirmam presença atual.
    const LIMITE_GPS_DESATUALIZADO_MS = 10 * 60 * 1000;
    const RAIO_TERRA_METROS = 6371008.8;

    function obterApresentacaoEstado(estado) {
        return APRESENTACOES_ESTADO[estado] || APRESENTACOES_ESTADO[ESTADOS_MONITORAMENTO.NAO_MONITORADO];
    }

    function normalizarIdentificadorRadio(valor) {
        return String(valor == null ? '' : valor).trim().toUpperCase();
    }

    function numeroCoordenada(valor, minimo, maximo) {
        if (valor == null || valor === '') return NaN;
        const numero = Number(valor);
        return Number.isFinite(numero) && numero >= minimo && numero <= maximo ? numero : NaN;
    }

    function normalizarPonto(valor) {
        if (!valor || typeof valor !== 'object') return null;
        const lat = numeroCoordenada(valor.lat, -90, 90);
        const lng = numeroCoordenada(valor.lng, -180, 180);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }

    function normalizarPoligono(poligono) {
        if (!Array.isArray(poligono) || poligono.length < 3) return null;

        const pontos = poligono.map(normalizarPonto);
        if (pontos.some(ponto => !ponto)) return null;

        const pontosDistintos = new Set(pontos.map(ponto => `${ponto.lat}|${ponto.lng}`));
        if (pontosDistintos.size < 3) return null;

        const areaAssinada = pontos.reduce((soma, ponto, indice) => {
            const proximo = pontos[(indice + 1) % pontos.length];
            return soma + ((ponto.lng * proximo.lat) - (proximo.lng * ponto.lat));
        }, 0) / 2;

        return Math.abs(areaAssinada) > 1e-12 ? pontos : null;
    }

    function grausParaRadianos(valor) {
        return valor * (Math.PI / 180);
    }

    function distanciaEntrePontosMetros(origem, destino) {
        const pontoA = normalizarPonto(origem);
        const pontoB = normalizarPonto(destino);
        if (!pontoA || !pontoB) return NaN;

        const leaflet = typeof globalThis !== 'undefined' ? globalThis.L : null;
        if (leaflet && typeof leaflet.latLng === 'function') {
            return leaflet.latLng(pontoA.lat, pontoA.lng).distanceTo(
                leaflet.latLng(pontoB.lat, pontoB.lng)
            );
        }

        const lat1 = grausParaRadianos(pontoA.lat);
        const lat2 = grausParaRadianos(pontoB.lat);
        const deltaLat = lat2 - lat1;
        const deltaLng = grausParaRadianos(pontoB.lng - pontoA.lng);
        const haversine = (Math.sin(deltaLat / 2) ** 2)
            + (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(deltaLng / 2) ** 2));
        const angulo = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)));
        return RAIO_TERRA_METROS * angulo;
    }

    function pontoEstaDentroPoligono(ponto, poligono) {
        let dentro = false;

        for (let atual = 0, anterior = poligono.length - 1; atual < poligono.length; anterior = atual++) {
            const pontoAtual = poligono[atual];
            const pontoAnterior = poligono[anterior];
            const cruzaLatitude = (pontoAtual.lat > ponto.lat) !== (pontoAnterior.lat > ponto.lat);
            const longitudeIntersecao = ((pontoAnterior.lng - pontoAtual.lng)
                * (ponto.lat - pontoAtual.lat)
                / (pontoAnterior.lat - pontoAtual.lat)) + pontoAtual.lng;

            if (cruzaLatitude && ponto.lng < longitudeIntersecao) dentro = !dentro;
        }

        return dentro;
    }

    function projetarEmMetros(ponto, referencia) {
        const latitudeMedia = grausParaRadianos((ponto.lat + referencia.lat) / 2);
        return {
            x: grausParaRadianos(ponto.lng - referencia.lng) * RAIO_TERRA_METROS * Math.cos(latitudeMedia),
            y: grausParaRadianos(ponto.lat - referencia.lat) * RAIO_TERRA_METROS
        };
    }

    function distanciaPontoSegmentoMetros(ponto, inicio, fim) {
        const a = projetarEmMetros(inicio, ponto);
        const b = projetarEmMetros(fim, ponto);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const comprimentoQuadrado = (dx * dx) + (dy * dy);

        if (comprimentoQuadrado === 0) return Math.hypot(a.x, a.y);

        const projecao = Math.max(0, Math.min(1, -((a.x * dx) + (a.y * dy)) / comprimentoQuadrado));
        return Math.hypot(a.x + (projecao * dx), a.y + (projecao * dy));
    }

    function distanciaAteBordaPoligonoMetros(ponto, poligono) {
        let menorDistancia = Infinity;

        poligono.forEach((inicio, indice) => {
            const fim = poligono[(indice + 1) % poligono.length];
            menorDistancia = Math.min(menorDistancia, distanciaPontoSegmentoMetros(ponto, inicio, fim));
        });

        return menorDistancia;
    }

    function avaliarPosicaoNoAlvo(posicao, alvo, toleranciaMetros = TOLERANCIA_GEOGRAFICA_METROS) {
        const ponto = normalizarPonto(posicao);
        const tolerancia = Number(toleranciaMetros);
        if (!ponto || !Number.isFinite(tolerancia) || tolerancia < 0 || !alvo || typeof alvo !== 'object') {
            return { valido: false, noPonto: false, motivo: 'Geometria de referência ausente ou inválida.' };
        }

        if (alvo.tipo === 'baseamento') {
            const centro = normalizarPonto(alvo.centro);
            if (!centro) {
                return { valido: false, noPonto: false, motivo: 'Geometria de baseamento ausente ou inválida.' };
            }

            const raioInformado = alvo.raioMetros == null || alvo.raioMetros === ''
                ? null
                : Number(alvo.raioMetros);
            if (raioInformado != null && (!Number.isFinite(raioInformado) || raioInformado <= 0)) {
                return { valido: false, noPonto: false, motivo: 'Raio de baseamento inválido.' };
            }

            // Regra anterior preservada: const limite = (raioInformado || 0) + tolerancia;
            // O raio cadastrado continua no mapa; a supervisão usa os 20 metros solicitados.
            const limite = tolerancia;
            const distanciaMetros = distanciaEntrePontosMetros(ponto, centro);
            return {
                valido: Number.isFinite(distanciaMetros),
                noPonto: Number.isFinite(distanciaMetros) && distanciaMetros <= limite,
                distanciaMetros,
                limiteMetros: limite
            };
        }

        if (alvo.tipo === 'patrulhamento') {
            const poligono = normalizarPoligono(alvo.poligono);
            if (!poligono) {
                return { valido: false, noPonto: false, motivo: 'Polígono de patrulhamento ausente ou inválido.' };
            }

            if (pontoEstaDentroPoligono(ponto, poligono)) {
                return { valido: true, noPonto: true, distanciaMetros: 0, limiteMetros: 0 };
            }

            const distanciaMetros = distanciaAteBordaPoligonoMetros(ponto, poligono);
            return {
                valido: Number.isFinite(distanciaMetros),
                // A borda pertence à área, sem permitir a antiga margem externa de 20 metros.
                noPonto: Number.isFinite(distanciaMetros) && distanciaMetros <= 0.000001,
                distanciaMetros,
                limiteMetros: 0
            };
        }

        return { valido: false, noPonto: false, motivo: 'Atividade sem geometria monitorável.' };
    }

    function extrairRegistrosGps(resposta) {
        if (Array.isArray(resposta)) return resposta;
        if (!resposta || typeof resposta !== 'object') return null;
        if (Array.isArray(resposta.posicoes)) return resposta.posicoes;
        if ('identificadorRadio' in resposta) return [resposta];
        return null;
    }

    function validarRegistroGps(registro, agoraMs, limiteDesatualizacaoMs) {
        if (!registro || typeof registro !== 'object') {
            return { valido: false, motivo: 'Resposta de GPS inválida.' };
        }

        const identificadorRadio = normalizarIdentificadorRadio(registro.identificadorRadio);
        const lat = numeroCoordenada(registro.latitude, -90, 90);
        const lng = numeroCoordenada(registro.longitude, -180, 180);
        const timestampMs = typeof registro.dataHora === 'string' || typeof registro.dataHora === 'number'
            ? Date.parse(String(registro.dataHora))
            : NaN;

        if (!identificadorRadio) return { valido: false, motivo: 'Identificador de rádio ausente no GPS.' };
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return { valido: false, motivo: 'Latitude ou longitude inválida.' };
        }
        if (!Number.isFinite(timestampMs)) return { valido: false, motivo: 'Data/hora da posição ausente ou inválida.' };
        if ((agoraMs - timestampMs) > limiteDesatualizacaoMs) {
            return { valido: false, motivo: 'A posição GPS está desatualizada.' };
        }

        return { valido: true, identificadorRadio, lat, lng, timestampMs };
    }

    function avaliarRespostaGps({
        identificadoresRadio,
        resposta,
        alvo,
        agoraMs = Date.now(),
        limiteDesatualizacaoMs = LIMITE_GPS_DESATUALIZADO_MS,
        toleranciaMetros = TOLERANCIA_GEOGRAFICA_METROS
    }) {
        const ids = Array.from(new Set((Array.isArray(identificadoresRadio) ? identificadoresRadio : [])
            .map(normalizarIdentificadorRadio)
            .filter(Boolean)));

        if (ids.length === 0) {
            return { estado: ESTADOS_MONITORAMENTO.SEM_DADOS, motivo: 'A viatura está sem identificador de rádio cadastrado.' };
        }

        const registros = extrairRegistrosGps(resposta);
        if (!registros) {
            return { estado: ESTADOS_MONITORAMENTO.SEM_DADOS, motivo: 'A resposta de GPS é inválida.' };
        }

        const registrosPorRadio = new Map();
        registros.forEach(registro => {
            const id = normalizarIdentificadorRadio(registro?.identificadorRadio);
            if (id && !registrosPorRadio.has(id)) registrosPorRadio.set(id, registro);
        });

        const avaliacoes = [];
        for (const id of ids) {
            const registro = registrosPorRadio.get(id);
            if (!registro) {
                return { estado: ESTADOS_MONITORAMENTO.SEM_DADOS, motivo: `Nenhuma posição encontrada para o rádio ${id}.` };
            }

            const gps = validarRegistroGps(registro, Number(agoraMs), Number(limiteDesatualizacaoMs));
            if (!gps.valido) return { estado: ESTADOS_MONITORAMENTO.SEM_DADOS, motivo: gps.motivo };

            const avaliacao = avaliarPosicaoNoAlvo(
                { lat: gps.lat, lng: gps.lng },
                alvo,
                toleranciaMetros
            );
            if (!avaliacao.valido) {
                return { estado: ESTADOS_MONITORAMENTO.SEM_DADOS, motivo: avaliacao.motivo };
            }
            avaliacoes.push(avaliacao);
        }

        const foraDoPonto = avaliacoes.some(avaliacao => !avaliacao.noPonto);
        return {
            estado: foraDoPonto ? ESTADOS_MONITORAMENTO.FORA_DO_PONTO : ESTADOS_MONITORAMENTO.NO_PONTO,
            motivo: foraDoPonto ? 'Viatura fora da área prevista.' : 'Viatura dentro da área prevista.'
        };
    }

    function criarErroIntegracao(mensagem, codigo) {
        const erro = new Error(mensagem);
        erro.codigo = codigo;
        return erro;
    }

    function criarServicoRecursos(opcoes = {}) {
        const fetchFn = opcoes.fetchFn || ((...args) => globalThis.fetch(...args));
        const agora = opcoes.agora || Date.now;
        const setTimeoutFn = opcoes.setTimeoutFn || setTimeout;
        const clearTimeoutFn = opcoes.clearTimeoutFn || clearTimeout;
        let consultaCompartilhada = null;

        function erroAbortado() {
            const erro = new Error('Consulta GPS cancelada.');
            erro.name = 'AbortError';
            return erro;
        }

        function normalizarRespostaRecursos(resposta) {
            if (!resposta || !Array.isArray(resposta.dados) || typeof resposta.status !== 'string') {
                throw criarErroIntegracao('A API retornou um JSON de recursos inválido.', 'RESPOSTA_INVALIDA');
            }
            if (resposta.status !== 'com_informacao') {
                // O motivo externo não é inserido como HTML nem expõe detalhes de infraestrutura.
                throw criarErroIntegracao('A API GPS está sem informação disponível.', 'SEM_INFORMACAO');
            }
            if (!Number.isFinite(Date.parse(resposta.ultima_coleta))) {
                throw criarErroIntegracao('A API não informou uma data de coleta válida.', 'COLETA_INVALIDA');
            }
            return {
                posicoes: resposta.dados.map(registro => ({
                    identificadorRadio: normalizarIdentificadorRadio(registro?.identificador),
                    latitude: registro?.latitude,
                    longitude: registro?.longitude,
                    dataHora: resposta.ultima_coleta
                }))
            };
        }

        function iniciarConsulta() {
            const consulta = {
                inicioMs: agora(),
                controlador: new AbortController(),
                consumidores: new Set(),
                concluida: false,
                promessa: null
            };
            consultaCompartilhada = consulta;
            let expirou = false;
            const timeoutId = setTimeoutFn(() => {
                expirou = true;
                consulta.controlador.abort();
            }, 30000);
            consulta.promessa = (async () => {
                try {
                    const resposta = await fetchFn(URL_RECURSOS_GPS, {
                        method: 'GET',
                        mode: 'cors',
                        credentials: 'omit',
                        cache: 'no-store',
                        headers: { Accept: 'application/json' },
                        signal: consulta.controlador.signal
                    });
                    if (!resposta.ok) {
                        throw criarErroIntegracao(`A API GPS retornou HTTP ${resposta.status}.`, 'HTTP_GPS');
                    }
                    const dados = await resposta.json();
                    if (consulta.controlador.signal.aborted) throw erroAbortado();
                    return normalizarRespostaRecursos(dados);
                } catch (erro) {
                    if (expirou) throw criarErroIntegracao('A consulta GPS excedeu 30 segundos. Nova tentativa em três minutos.', 'TIMEOUT_GPS');
                    if (erro?.name === 'AbortError' || erro?.codigo) throw erro;
                    if (erro instanceof SyntaxError) throw criarErroIntegracao('A API GPS retornou um JSON inválido.', 'RESPOSTA_INVALIDA');
                    throw criarErroIntegracao('Não foi possível consultar a API GPS. Verifique a conexão e tente novamente.', 'FALHA_GPS');
                } finally {
                    clearTimeoutFn(timeoutId);
                    consulta.concluida = true;
                }
            })();
            return consulta;
        }

        function consultarPosicoes({ signal } = {}) {
            if (signal?.aborted) return Promise.reject(erroAbortado());
            const consulta = consultaCompartilhada
                && (!consultaCompartilhada.concluida || agora() - consultaCompartilhada.inicioMs < INTERVALO_CONSULTA_GPS_MS)
                ? consultaCompartilhada
                : iniciarConsulta();
            return new Promise((resolve, reject) => {
                const consumidor = {};
                consulta.consumidores.add(consumidor);
                let finalizado = false;
                function concluir(callback, valor) {
                    if (finalizado) return;
                    finalizado = true;
                    signal?.removeEventListener('abort', cancelar);
                    consulta.consumidores.delete(consumidor);
                    callback(valor);
                }
                function cancelar() {
                    concluir(reject, erroAbortado());
                    if (!consulta.concluida && consulta.consumidores.size === 0) {
                        consulta.controlador.abort();
                        if (consultaCompartilhada === consulta) consultaCompartilhada = null;
                    }
                }
                signal?.addEventListener('abort', cancelar, { once: true });
                consulta.promessa.then(valor => concluir(resolve, valor), erro => concluir(reject, erro));
            });
        }

        function encerrar() {
            consultaCompartilhada?.controlador.abort();
            consultaCompartilhada = null;
        }

        return Object.freeze({
            validarDisponibilidade: async () => ({ autorizado: true, integracaoConfigurada: true }),
            consultarPosicoes,
            encerrar
        });
    }

    /*
     * Fronteira de integração esperada em window.ORDENA_CICOCO_GPS_ADAPTER:
     * - validarDisponibilidade({ signal })
     *     -> { autorizado: boolean, integracaoConfigurada: boolean, mensagem?: string }
     * - consultarPosicoes({ identificadoresRadio, signal })
     *     -> { posicoes: [{ identificadorRadio, latitude, longitude, dataHora }] }
     *
     * Alternativa histórica preservada (não utilizada pelo serviço público /recursos):
     * TODO(backend): implementar o adapter com o cliente HTTP autenticado do ORDENA
     * (sessão same-origin por cookie/credentials include e CSRF quando aplicável), autorização
     * no servidor, verificação apenas da presença das credenciais CICOCÓ no perfil, proxy
     * servidor-a-servidor para o CICOCÓ e mapeamento do contrato JSON definitivo. Nenhuma
     * credencial ou token da integração deve ser entregue, lido ou registrado no navegador.
     */
    function criarServicoIndisponivel() {
        const erroIndisponivel = () => Promise.reject(criarErroIntegracao(
            'Monitoramento não ativado: a integração com o CICOCÓ não está disponível.',
            'INTEGRACAO_INDISPONIVEL'
        ));

        return Object.freeze({
            validarDisponibilidade: erroIndisponivel,
            consultarPosicoes: erroIndisponivel
        });
    }

    function criarControladorMonitoramento(opcoes = {}) {
        const servico = opcoes.servico || criarServicoIndisponivel();
        const onChange = typeof opcoes.onChange === 'function' ? opcoes.onChange : function () {};
        const onFeedback = typeof opcoes.onFeedback === 'function' ? opcoes.onFeedback : function () {};
        const agora = typeof opcoes.agora === 'function' ? opcoes.agora : Date.now;
        const setIntervalFn = opcoes.setIntervalFn || setInterval;
        const clearIntervalFn = opcoes.clearIntervalFn || clearInterval;
        const criarAbortController = opcoes.criarAbortController
            || (() => (typeof AbortController === 'function' ? new AbortController() : null));
        const aguardarRenderizacao = opcoes.aguardarRenderizacao || (() => new Promise(resolve => {
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
            else setTimeout(resolve, 0);
        }));
        const intervaloConsultaMs = Number.isFinite(opcoes.intervaloConsultaMs)
            ? opcoes.intervaloConsultaMs
            : INTERVALO_CONSULTA_GPS_MS;
        const limiteDesatualizacaoMs = Number.isFinite(opcoes.limiteDesatualizacaoMs)
            ? opcoes.limiteDesatualizacaoMs
            : LIMITE_GPS_DESATUALIZADO_MS;
        const toleranciaMetros = Number.isFinite(opcoes.toleranciaMetros)
            ? opcoes.toleranciaMetros
            : TOLERANCIA_GEOGRAFICA_METROS;
        const estados = new Map();

        function criarEstado(idEscala) {
            return {
                idEscala: String(idEscala),
                ativo: false,
                processando: false,
                acaoPendente: null,
                emConsulta: false,
                estado: ESTADOS_MONITORAMENTO.NAO_MONITORADO,
                contexto: { identificadoresRadio: [], alvo: null },
                assinaturaContexto: '',
                versaoContexto: 0,
                timerId: null,
                abortController: null,
                geracao: 0,
                erroAutomaticoNotificado: false,
                ultimaResposta: null
            };
        }

        function estadoPublico(estado) {
            if (!estado) return null;
            return {
                idEscala: estado.idEscala,
                ativo: estado.ativo,
                processando: estado.processando,
                acaoPendente: estado.acaoPendente,
                emConsulta: estado.emConsulta,
                estado: estado.estado
            };
        }

        function notificarMudanca(estado) {
            onChange(estadoPublico(estado));
        }

        function emitirFeedback(tipo, mensagem, estado) {
            onFeedback({ tipo, mensagem, idEscala: estado.idEscala });
        }

        function registrarEquipe(idEscala, contexto = {}) {
            const id = String(idEscala);
            const estado = estados.get(id) || criarEstado(id);
            const novoContexto = {
                identificadoresRadio: Array.isArray(contexto.identificadoresRadio)
                    ? contexto.identificadoresRadio.slice()
                    : [],
                alvo: contexto.alvo || null
            };
            const novaAssinatura = JSON.stringify(novoContexto);

            if (novaAssinatura !== estado.assinaturaContexto) {
                estado.contexto = novoContexto;
                estado.assinaturaContexto = novaAssinatura;
                estado.versaoContexto += 1;

                if (estado.ativo) {
                    // Antes aguardava a próxima consulta; reaproveita o JSON completo ao mudar a atividade.
                    estado.estado = estado.ultimaResposta ? avaliarRespostaGps({
                        identificadoresRadio: novoContexto.identificadoresRadio,
                        resposta: estado.ultimaResposta,
                        alvo: novoContexto.alvo,
                        agoraMs: agora(),
                        limiteDesatualizacaoMs,
                        toleranciaMetros
                    }).estado : ESTADOS_MONITORAMENTO.SEM_DADOS;
                    if (estado.emConsulta && estado.abortController) estado.abortController.abort();
                }
            }
            estados.set(id, estado);
            return estadoPublico(estado);
        }

        function obterEstado(idEscala) {
            return estadoPublico(estados.get(String(idEscala)));
        }

        function limparRecursos(estado) {
            if (estado.timerId != null) {
                clearIntervalFn(estado.timerId);
                estado.timerId = null;
            }
            if (estado.abortController) {
                estado.abortController.abort();
                estado.abortController = null;
            }
        }

        function cancelarSemFeedback(estado) {
            estado.geracao += 1;
            limparRecursos(estado);
            estado.ativo = false;
            estado.processando = false;
            estado.acaoPendente = null;
            estado.emConsulta = false;
            estado.estado = ESTADOS_MONITORAMENTO.NAO_MONITORADO;
            estado.erroAutomaticoNotificado = false;
            estado.ultimaResposta = null;
            encerrarServicoSemEquipes();
        }

        function encerrarServicoSemEquipes() {
            if (!Array.from(estados.values()).some(estado => estado.ativo || estado.acaoPendente === 'ativar')) {
                servico.encerrar?.();
            }
        }

        function sincronizarEquipes(idsAtuais) {
            const ids = new Set(Array.from(idsAtuais || [], id => String(id)));
            estados.forEach((estado, id) => {
                if (ids.has(id)) return;
                cancelarSemFeedback(estado);
                estados.delete(id);
            });
        }

        function mensagemValidacaoNegada(validacao) {
            if (validacao && typeof validacao.mensagem === 'string' && validacao.mensagem.trim()) {
                return validacao.mensagem.trim();
            }
            if (!validacao || validacao.autorizado !== true) {
                return 'Você não tem permissão para usar a supervisão automática.';
            }
            return 'As credenciais CICOCÓ não estão configuradas no seu perfil.';
        }

        async function consultarEstado(estado, origem, geracaoEsperada) {
            if (!estado.ativo || estado.emConsulta || geracaoEsperada !== estado.geracao) {
                return { executada: false };
            }

            const versaoContextoEsperada = estado.versaoContexto;
            const contextoConsulta = {
                identificadoresRadio: estado.contexto.identificadoresRadio.slice(),
                alvo: estado.contexto.alvo
            };

            if (contextoConsulta.identificadoresRadio.length === 0) {
                estado.estado = ESTADOS_MONITORAMENTO.SEM_DADOS;
                if (origem === 'automatica' && !estado.erroAutomaticoNotificado) {
                    emitirFeedback('error', 'Sem dados de GPS: a viatura está sem identificador de rádio cadastrado.', estado);
                    estado.erroAutomaticoNotificado = true;
                }
                notificarMudanca(estado);
                return {
                    executada: true,
                    estado: estado.estado,
                    motivo: 'A viatura está sem identificador de rádio cadastrado.'
                };
            }

            estado.emConsulta = true;
            const controlador = criarAbortController();
            estado.abortController = controlador;
            notificarMudanca(estado);

            try {
                const resposta = await servico.consultarPosicoes({
                    identificadoresRadio: contextoConsulta.identificadoresRadio.slice(),
                    signal: controlador?.signal
                });

                if (
                    !estado.ativo
                    || geracaoEsperada !== estado.geracao
                    || versaoContextoEsperada !== estado.versaoContexto
                ) {
                    return { executada: false };
                }

                estado.ultimaResposta = resposta;
                const avaliacao = avaliarRespostaGps({
                    identificadoresRadio: contextoConsulta.identificadoresRadio,
                    resposta,
                    alvo: contextoConsulta.alvo,
                    agoraMs: agora(),
                    limiteDesatualizacaoMs,
                    toleranciaMetros
                });
                estado.estado = avaliacao.estado;

                if (avaliacao.estado === ESTADOS_MONITORAMENTO.SEM_DADOS) {
                    if (origem === 'automatica' && !estado.erroAutomaticoNotificado) {
                        emitirFeedback('error', `Sem dados de GPS: ${avaliacao.motivo}`, estado);
                        estado.erroAutomaticoNotificado = true;
                    }
                } else {
                    const haviaErroAutomatico = estado.erroAutomaticoNotificado;
                    estado.erroAutomaticoNotificado = false;
                    if (origem === 'automatica' && haviaErroAutomatico) {
                        onFeedback({ tipo: 'clear', mensagem: '', idEscala: estado.idEscala });
                    }
                }

                return { executada: true, ...avaliacao };
            } catch (erro) {
                if (
                    !estado.ativo
                    || geracaoEsperada !== estado.geracao
                    || versaoContextoEsperada !== estado.versaoContexto
                    || erro?.name === 'AbortError'
                ) {
                    return { executada: false };
                }

                estado.estado = ESTADOS_MONITORAMENTO.SEM_DADOS;
                const mensagem = erro?.message || 'Não foi possível consultar a posição GPS.';
                if (origem !== 'automatica' || !estado.erroAutomaticoNotificado) {
                    const prefixo = origem === 'inicial'
                        ? 'Supervisão automática ativada, mas sem dados de GPS:'
                        : 'Sem dados de GPS:';
                    emitirFeedback('error', `${prefixo} ${mensagem}`, estado);
                    estado.erroAutomaticoNotificado = true;
                }
                return { executada: true, estado: estado.estado, motivo: mensagem, erro: true };
            } finally {
                if (geracaoEsperada === estado.geracao) {
                    estado.emConsulta = false;
                    if (estado.abortController === controlador) estado.abortController = null;
                    notificarMudanca(estado);
                }
            }
        }

        function iniciarTimer(estado, geracaoEsperada) {
            if (estado.timerId != null || !estado.ativo || geracaoEsperada !== estado.geracao) return;
            estado.timerId = setIntervalFn(() => {
                consultarEstado(estado, 'automatica', geracaoEsperada);
            }, intervaloConsultaMs);
        }

        async function ativar(idEscala) {
            const estado = estados.get(String(idEscala));
            if (!estado || estado.ativo || estado.processando) return false;

            estado.processando = true;
            estado.acaoPendente = 'ativar';
            estado.estado = ESTADOS_MONITORAMENTO.NAO_MONITORADO;
            estado.erroAutomaticoNotificado = false;
            const geracaoEsperada = ++estado.geracao;
            const controlador = criarAbortController();
            estado.abortController = controlador;
            notificarMudanca(estado);
            await aguardarRenderizacao();

            if (geracaoEsperada !== estado.geracao || estados.get(estado.idEscala) !== estado) return false;

            try {
                const validacao = await servico.validarDisponibilidade({ signal: controlador?.signal });
                if (geracaoEsperada !== estado.geracao) return false;

                if (!validacao || validacao.autorizado !== true || validacao.integracaoConfigurada !== true) {
                    throw criarErroIntegracao(mensagemValidacaoNegada(validacao), 'ACESSO_NEGADO');
                }

                if (estado.abortController === controlador) estado.abortController = null;
                estado.ativo = true;
                const primeiraConsulta = await consultarEstado(estado, 'inicial', geracaoEsperada);
                if (geracaoEsperada !== estado.geracao) return false;

                iniciarTimer(estado, geracaoEsperada);
                if (!primeiraConsulta.erro) {
                    if (primeiraConsulta.estado === ESTADOS_MONITORAMENTO.SEM_DADOS) {
                        emitirFeedback(
                            'error',
                            `Supervisão automática ativada, mas sem dados de GPS: ${primeiraConsulta.motivo}`,
                            estado
                        );
                        estado.erroAutomaticoNotificado = true;
                    } else {
                        emitirFeedback('success', 'Supervisão automática ativada.', estado);
                    }
                }
                return true;
            } catch (erro) {
                if (geracaoEsperada !== estado.geracao || erro?.name === 'AbortError') return false;

                limparRecursos(estado);
                estado.ativo = false;
                estado.estado = ESTADOS_MONITORAMENTO.NAO_MONITORADO;
                emitirFeedback('error', erro?.message || 'Não foi possível ativar a supervisão automática.', estado);
                return false;
            } finally {
                if (geracaoEsperada === estado.geracao) {
                    estado.processando = false;
                    estado.acaoPendente = null;
                    if (estado.abortController === controlador) estado.abortController = null;
                    notificarMudanca(estado);
                }
            }
        }

        async function desativar(idEscala) {
            const estado = estados.get(String(idEscala));
            if (!estado || estado.processando || !estado.ativo) return false;

            estado.processando = true;
            estado.acaoPendente = 'desativar';
            notificarMudanca(estado);
            const geracaoDesativacao = ++estado.geracao;
            limparRecursos(estado);
            estado.ativo = false;
            estado.emConsulta = false;
            estado.estado = ESTADOS_MONITORAMENTO.NAO_MONITORADO;
            estado.erroAutomaticoNotificado = false;
            notificarMudanca(estado);
            encerrarServicoSemEquipes();
            await aguardarRenderizacao();
            if (estado.geracao !== geracaoDesativacao || estados.get(estado.idEscala) !== estado) return false;
            estado.processando = false;
            estado.acaoPendente = null;
            notificarMudanca(estado);
            emitirFeedback('success', 'Supervisão automática desativada.', estado);
            return true;
        }

        async function alternar(idEscala, ativarSupervisao) {
            return ativarSupervisao ? ativar(idEscala) : desativar(idEscala);
        }

        async function consultarAgora(idEscala) {
            const estado = estados.get(String(idEscala));
            if (!estado) return { executada: false };
            return consultarEstado(estado, 'manual', estado.geracao);
        }

        function destruir() {
            estados.forEach(cancelarSemFeedback);
            estados.clear();
        }

        return Object.freeze({
            registrarEquipe,
            obterEstado,
            sincronizarEquipes,
            alternar,
            ativar,
            desativar,
            consultarAgora,
            destruir
        });
    }

    return Object.freeze({
        ESTADOS_MONITORAMENTO,
        INTERVALO_CONSULTA_GPS_MS,
        TOLERANCIA_GEOGRAFICA_METROS,
        URL_RECURSOS_GPS,
        LIMITE_GPS_DESATUALIZADO_MS,
        obterApresentacaoEstado,
        normalizarIdentificadorRadio,
        distanciaEntrePontosMetros,
        avaliarPosicaoNoAlvo,
        avaliarRespostaGps,
        criarServicoIndisponivel,
        criarServicoRecursos,
        criarControladorMonitoramento
    });
});
