(function () {
    'use strict';

    const DEMO_VERSION = 'rio_seed_v2';
    const DEMO_TAG = 'DEMO_RIO_V1';
    const CIDADE_DEMO = 'Rio de Janeiro';

    // Pontos de referencia (ficticios) distribuidos pelo municipio do Rio para teste visual.
    const RIO_MUNICIPIO_AREAS = [
        { slug: 'centro', nome: 'CENTRO', rua: 'AV RIO BRANCO', numero: '156', bairro: 'CENTRO', lat: -22.9068, lng: -43.1729 },
        { slug: 'lapa', nome: 'LAPA', rua: 'AV MEM DE SA', numero: '120', bairro: 'LAPA', lat: -22.9135, lng: -43.1795 },
        { slug: 'copacabana', nome: 'COPACABANA', rua: 'AV NOSSA SENHORA DE COPACABANA', numero: '980', bairro: 'COPACABANA', lat: -22.9697, lng: -43.1867 },
        { slug: 'ipanema', nome: 'IPANEMA', rua: 'RUA VISCONDE DE PIRAJA', numero: '220', bairro: 'IPANEMA', lat: -22.9847, lng: -43.1986 },
        { slug: 'leblon', nome: 'LEBLON', rua: 'AV ATAULFO DE PAIVA', numero: '450', bairro: 'LEBLON', lat: -22.9858, lng: -43.2249 },
        { slug: 'botafogo', nome: 'BOTAFOGO', rua: 'RUA VOLUNTARIOS DA PATRIA', numero: '190', bairro: 'BOTAFOGO', lat: -22.9511, lng: -43.1823 },
        { slug: 'flamengo', nome: 'FLAMENGO', rua: 'RUA PAISSANDU', numero: '70', bairro: 'FLAMENGO', lat: -22.9339, lng: -43.1742 },
        { slug: 'tijuca', nome: 'TIJUCA', rua: 'RUA CONDE DE BONFIM', numero: '420', bairro: 'TIJUCA', lat: -22.9245, lng: -43.2336 },
        { slug: 'maracana', nome: 'MARACANA', rua: 'RUA SAO FRANCISCO XAVIER', numero: '290', bairro: 'MARACANA', lat: -22.9122, lng: -43.2302 },
        { slug: 'meier', nome: 'MEIER', rua: 'RUA DIAS DA CRUZ', numero: '330', bairro: 'MEIER', lat: -22.9024, lng: -43.2816 },
        { slug: 'madureira', nome: 'MADUREIRA', rua: 'RUA CAROLINA MACHADO', numero: '55', bairro: 'MADUREIRA', lat: -22.8741, lng: -43.3419 },
        { slug: 'iraja', nome: 'IRAJA', rua: 'AV MONSENHOR FELIX', numero: '650', bairro: 'IRAJA', lat: -22.8389, lng: -43.3230 },
        { slug: 'penha', nome: 'PENHA', rua: 'LARGO DA PENHA', numero: '18', bairro: 'PENHA', lat: -22.8381, lng: -43.2764 },
        { slug: 'bonsucesso', nome: 'BONSUCESSO', rua: 'AV BRASIL', numero: '18000', bairro: 'BONSUCESSO', lat: -22.8653, lng: -43.2536 },
        { slug: 'ilha', nome: 'ILHA DO GOVERNADOR', rua: 'ESTRADA DO GALEAO', numero: '2450', bairro: 'JARDIM GUANABARA', lat: -22.8143, lng: -43.2068 },
        { slug: 'barra', nome: 'BARRA DA TIJUCA', rua: 'AV DAS AMERICAS', numero: '5000', bairro: 'BARRA DA TIJUCA', lat: -23.0016, lng: -43.3659 },
        { slug: 'recreio', nome: 'RECREIO', rua: 'AV ALFREDO BALTHAZAR DA SILVEIRA', numero: '580', bairro: 'RECREIO', lat: -23.0306, lng: -43.4652 },
        { slug: 'jacarepagua', nome: 'JACAREPAGUA', rua: 'ESTRADA DOS BANDEIRANTES', numero: '3200', bairro: 'JACAREPAGUA', lat: -22.9240, lng: -43.3640 },
        { slug: 'bangu', nome: 'BANGU', rua: 'RUA FONSECA', numero: '240', bairro: 'BANGU', lat: -22.8768, lng: -43.4657 },
        { slug: 'campo_grande', nome: 'CAMPO GRANDE', rua: 'RUA CORONEL AGOSTINHO', numero: '90', bairro: 'CAMPO GRANDE', lat: -22.9037, lng: -43.5591 }
    ];

    function parseJsonSafe(raw, fallback) {
        if (raw == null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.warn('[ORDENA DemoSeed] JSON invalido no localStorage, usando fallback.', err);
            return fallback;
        }
    }

    function readArray(key) {
        const parsed = parseJsonSafe(localStorage.getItem(key), []);
        return Array.isArray(parsed) ? parsed : [];
    }

    function writeArray(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function normalizeStatus(value, fallback) {
        const text = (value || '').toString().trim();
        return text || fallback;
    }

    function normalizeTipoOS(tipo) {
        const t = (tipo || '').toString().toLowerCase();
        if (t.includes('moto')) return 'Moto';
        if (t.includes('cabine')) return 'Cabine';
        if (t.includes('setor')) return 'Setor';
        return 'Viatura';
    }

    function normalizeTipoRecursoVtr(tipo) {
        const t = (tipo || '').toString().toLowerCase();
        return t.includes('moto') ? 'Moto' : 'Viatura';
    }

    function normalizarNomeTipoServico(nome) {
        return (nome || '').toString().trim().toUpperCase();
    }

    function horaParaMinutos(hora) {
        if (!hora || typeof hora !== 'string' || !hora.includes(':')) return null;
        const [h, m] = hora.split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        return (h * 60) + m;
    }

    function calcularDuracaoTurnoMinutos(horaInicio, horaFim) {
        const inicio = horaParaMinutos(horaInicio);
        const fim = horaParaMinutos(horaFim);
        if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null;
        let diff = fim - inicio;
        if (diff <= 0) diff += 24 * 60;
        return diff;
    }

    function pushIfMissing(list, record, matcher) {
        const exists = list.some(item => matcher(item, record));
        if (exists) return false;
        list.push(record);
        return true;
    }

    function getNowIso() {
        return new Date().toISOString();
    }

    function demoMeta(chaveDemo) {
        return {
            origemDemo: DEMO_TAG,
            versaoDemo: DEMO_VERSION,
            chaveDemo
        };
    }

    function toLatLngString(value) {
        return Number(value).toFixed(6);
    }

    function formatarTituloArea(nome) {
        return (nome || '').toString().trim().toUpperCase();
    }

    function getDemoCadastrosRio() {
        const locaisCadastrados = RIO_MUNICIPIO_AREAS.map((area, idx) => ({
            id: 9701000 + idx + 1,
            codigo: String(9701 + idx),
            apelido: `BASE ${formatarTituloArea(area.nome)}`,
            rua: area.rua,
            numero: area.numero,
            bairro: area.bairro,
            cidade: CIDADE_DEMO,
            lat: toLatLngString(area.lat),
            lng: toLatLngString(area.lng),
            status: 'Ativo',
            ...demoMeta(`base_${area.slug}`)
        }));

        const pontosPatrulhamento = RIO_MUNICIPIO_AREAS.map((area, idx) => ({
            id: 9801000 + idx + 1,
            codigo: String(9801 + idx),
            apelido: `PTR ${formatarTituloArea(area.nome)}`,
            raio: String(180 + ((idx % 5) * 40)),
            rua: area.rua,
            numero: area.numero,
            bairro: area.bairro,
            cidade: CIDADE_DEMO,
            lat: toLatLngString(area.lat + (((idx % 2 === 0) ? 1 : -1) * 0.0021)),
            lng: toLatLngString(area.lng + (((idx % 3 === 0) ? 1 : -1) * 0.0018)),
            status: 'Ativo',
            ...demoMeta(`ptr_${area.slug}`)
        }));

        return {
            viaturas: [
                {
                    tipo: 'Carro',
                    prefixo: '80-9901',
                    placa: 'RJO9A11',
                    radio: '990001',
                    temRadio: true,
                    status: 'Ativa',
                    ...demoMeta('viatura_carro_1')
                },
                {
                    tipo: 'Carro',
                    prefixo: '80-9902',
                    placa: 'RJO9A12',
                    radio: '990002',
                    temRadio: true,
                    status: 'Ativa',
                    ...demoMeta('viatura_carro_2')
                },
                {
                    tipo: 'Moto',
                    prefixo: '90-9901',
                    placa: 'RJO9M01',
                    radio: '990101',
                    temRadio: true,
                    status: 'Ativa',
                    ...demoMeta('viatura_moto_1')
                }
            ],
            cabines: [
                {
                    codigo: '9901',
                    nome: 'CABINE LAPA',
                    rua: 'AV MEM DE SA',
                    numero: '85',
                    bairro: 'LAPA',
                    cidade: 'Rio de Janeiro',
                    uf: 'RJ',
                    lat: '-22.913730',
                    lng: '-43.180140',
                    status: 'Ativa',
                    ...demoMeta('cabine_lapa')
                },
                {
                    codigo: '9902',
                    nome: 'CABINE COPACABANA',
                    rua: 'AV ATLANTICA',
                    numero: '1702',
                    bairro: 'COPACABANA',
                    cidade: 'Rio de Janeiro',
                    uf: 'RJ',
                    lat: '-22.968170',
                    lng: '-43.182420',
                    status: 'Ativa',
                    ...demoMeta('cabine_copacabana')
                }
            ],
            setores: [
                {
                    codigo: '9951',
                    nome: 'SETOR LAPA A PE',
                    rua: 'RUA DO LAVRADIO',
                    numero: '120',
                    bairro: 'LAPA',
                    cidade: 'Rio de Janeiro',
                    lat: '-22.911980',
                    lng: '-43.182040',
                    status: 'Ativa',
                    ...demoMeta('setor_lapa')
                },
                {
                    codigo: '9952',
                    nome: 'SETOR SAARA A PE',
                    rua: 'RUA DA ALFANDEGA',
                    numero: '245',
                    bairro: 'CENTRO',
                    cidade: 'Rio de Janeiro',
                    lat: '-22.903860',
                    lng: '-43.178360',
                    status: 'Ativa',
                    ...demoMeta('setor_saara')
                }
            ],
            locaisCadastrados,
            pontosPatrulhamento
        };
    }

    function executarNormalizadorSilent(logContexto) {
        if (window.ORDENA_STORAGE_NORMALIZER && typeof window.ORDENA_STORAGE_NORMALIZER.runAll === 'function') {
            try {
                window.ORDENA_STORAGE_NORMALIZER.runAll({ save: true, silent: true });
            } catch (err) {
                console.warn(`[ORDENA DemoSeed] Falha ao normalizar apos ${logContexto}.`, err);
            }
        }
    }

    function matcherCadastroDemoPorChave(key, atual, novo) {
        if (!atual || !novo) return false;
        if (atual.chaveDemo && novo.chaveDemo) return atual.chaveDemo === novo.chaveDemo;
        if (key === 'viaturas') return atual.prefixo === novo.prefixo;
        if (key === 'cabines' || key === 'setores') return String(atual.codigo) === String(novo.codigo);
        if (key === 'locaisCadastrados' || key === 'pontosPatrulhamento') {
            return (atual.apelido || '').toUpperCase() === (novo.apelido || '').toUpperCase();
        }
        return false;
    }

    function seedListaCadastroDemo(key, itensDemo) {
        const lista = Array.isArray(itensDemo) ? itensDemo : [];
        const existing = readArray(key);
        let added = 0;

        lista.forEach(item => {
            const inserted = pushIfMissing(existing, item, (atual, novo) => matcherCadastroDemoPorChave(key, atual, novo));
            if (inserted) added++;
        });

        if (added > 0) writeArray(key, existing);
        executarNormalizadorSilent(`carga de ${key}`);

        return {
            [key]: added,
            total: added
        };
    }

    function getDemoViaturasSomenteCarro() {
        return Array.from({ length: 10 }, (_, idx) => {
            const numero = idx + 1;
            const prefixoNumero = String(9900 + numero).padStart(4, '0');
            const radioNumero = String(990000 + numero);
            const placaNumero = String(10 + numero).padStart(2, '0');

            return {
                tipo: 'Carro',
                prefixo: `80-${prefixoNumero}`,
                placa: `RJO9A${placaNumero}`,
                radio: radioNumero,
                temRadio: true,
                status: 'Ativa',
                ...demoMeta(`viatura_carro_${numero}`)
            };
        });
    }

    function seedCadastrosDemoPorChaves(chaves) {
        const demo = getDemoCadastrosRio();
        const keys = (Array.isArray(chaves) && chaves.length > 0)
            ? chaves.filter(key => Array.isArray(demo[key]))
            : Object.keys(demo);

        const result = { total: 0 };

        keys.forEach(key => {
            const existing = readArray(key);
            let added = 0;

            demo[key].forEach(item => {
                const inserted = pushIfMissing(existing, item, (atual, novo) => matcherCadastroDemoPorChave(key, atual, novo));
                if (inserted) added++;
            });

            if (added > 0) writeArray(key, existing);
            result[key] = added;
            result.total += added;
        });

        executarNormalizadorSilent('carga de cadastros');
        return result;
    }

    function seedViaturas() {
        return seedListaCadastroDemo('viaturas', getDemoViaturasSomenteCarro());
    }

    function seedCabines() {
        return seedCadastrosDemoPorChaves(['cabines']);
    }

    function seedSetores() {
        return seedCadastrosDemoPorChaves(['setores']);
    }

    function seedBaseamentos() {
        return seedCadastrosDemoPorChaves(['locaisCadastrados']);
    }

    function seedPatrulhamentos() {
        return seedCadastrosDemoPorChaves(['pontosPatrulhamento']);
    }

    function seedCadastrosLocais() {
        return seedCadastrosDemoPorChaves(['viaturas', 'cabines', 'setores', 'locaisCadastrados', 'pontosPatrulhamento']);
    }

    function minutosParaHora(totalMinutos) {
        let m = Number(totalMinutos);
        if (!Number.isFinite(m)) return '00:00';
        m = ((m % 1440) + 1440) % 1440;
        const h = String(Math.floor(m / 60)).padStart(2, '0');
        const min = String(m % 60).padStart(2, '0');
        return `${h}:${min}`;
    }

    function somarMinutos(hora, deltaMin) {
        const base = horaParaMinutos(hora);
        if (!Number.isFinite(base)) return hora;
        return minutosParaHora(base + deltaMin);
    }

    function atividadeSemEndereco(tipo) {
        const t = (tipo || '').toString().toLowerCase();
        return t.includes('prele') || t.includes('desloc') || t.includes('interval') || t.includes('retorno');
    }

    function criarAtividadeGeo(tipo, inicio, fim, localObj, operacao, detalhesCustom) {
        const semEndereco = atividadeSemEndereco(tipo);
        const gps = localObj && localObj.lat != null && localObj.lng != null
            ? {
                lat: localObj.lat,
                lng: localObj.lng,
                ...(localObj.raio ? { raio: localObj.raio } : {})
            }
            : null;

        return {
            id: Date.now() + Math.floor(Math.random() * 100000),
            tipo,
            inicio,
            fim,
            local: semEndereco ? '' : (localObj?.apelido || ''),
            operacao: semEndereco ? '' : (operacao || '').toUpperCase(),
            rua: semEndereco ? '' : (localObj?.rua || ''),
            numero: semEndereco ? '' : (localObj?.numero || ''),
            bairro: semEndereco ? '' : (localObj?.bairro || ''),
            cidade: semEndereco ? '' : (localObj?.cidade || CIDADE_DEMO),
            detalhes: semEndereco ? '' : (detalhesCustom || (localObj?.raio ? `Raio ${localObj.raio}m` : 'Ponto Fixo')),
            gps: semEndereco ? null : gps
        };
    }

    function horaEstaNoRush(hora) {
        const min = horaParaMinutos(hora);
        if (!Number.isFinite(min)) return false;
        const manha = min >= (6 * 60) && min < (10 * 60);
        const tarde = min >= (16 * 60) && min < (20 * 60);
        return manha || tarde;
    }

    function localEhFaixaPraia(localObj) {
        const texto = `${localObj?.apelido || ''} ${localObj?.bairro || ''}`.toUpperCase();
        return ['COPACABANA', 'IPANEMA', 'LEBLON', 'BARRA', 'RECREIO', 'FLAMENGO'].some(tag => texto.includes(tag));
    }

    function escolherOperacaoParaPatrulhamento(horaInicioAtividade, localObj) {
        if (localEhFaixaPraia(localObj)) return 'OPERACAO PRAIA';
        if (horaEstaNoRush(horaInicioAtividade)) return 'PERCURSO SEGURO';
        return '';
    }

    function criarFracionamentoTurno(config) {
        const inicioTurno = config.horaInicio;
        const duracaoHoras = Number(config.duracaoHoras);
        const bases = Array.isArray(config.bases) ? config.bases.filter(Boolean) : [];
        const patrulhas = Array.isArray(config.patrulhas) ? config.patrulhas.filter(Boolean) : [];

        if (!Number.isFinite(duracaoHoras) || duracaoHoras <= 0) return [];
        if (bases.length === 0 || patrulhas.length === 0) return [];

        const atividades = [];
        let cursor = horaParaMinutos(inicioTurno);
        if (!Number.isFinite(cursor)) return [];

        const slotIntervalo = duracaoHoras >= 12 ? 6 : 4;
        let idxBase = 0;
        let idxPtr = 0;

        function nextBase() {
            const item = bases[idxBase % bases.length];
            idxBase += 1;
            return item;
        }

        function nextPatrulha() {
            const item = patrulhas[idxPtr % patrulhas.length];
            idxPtr += 1;
            return item;
        }

        function peekBase() {
            return bases[idxBase % bases.length];
        }

        function peekPatrulha() {
            return patrulhas[idxPtr % patrulhas.length];
        }

        function addAtividade(tipo, duracaoMin, localObj, operacao, detalhes) {
            const inicio = minutosParaHora(cursor);
            cursor += duracaoMin;
            const fim = minutosParaHora(cursor);
            atividades.push(criarAtividadeGeo(tipo, inicio, fim, localObj, operacao, detalhes));
        }

        for (let slot = 0; slot < duracaoHoras; slot++) {
            let tipoPrincipal = 'Patrulhamento';
            let localPrincipal = patrulhas[0] || bases[0];
            let operacaoPrincipal = '';
            let detalhesPrincipal = '';

            if (slot === 0) {
                tipoPrincipal = 'Preleção';
                localPrincipal = bases[0];
                detalhesPrincipal = 'Briefing operacional, distribuicao de missao e checagem de material.';
            } else if (slot === slotIntervalo) {
                tipoPrincipal = 'Intervalo';
                localPrincipal = nextBase();
                detalhesPrincipal = 'Pausa regulamentar da equipe.';
            } else if (slot % 2 === 0) {
                tipoPrincipal = 'Baseamento';
                localPrincipal = nextBase();
                detalhesPrincipal = 'Ponto de baseamento preventivo.';
            } else {
                tipoPrincipal = 'Patrulhamento';
                localPrincipal = nextPatrulha();
                operacaoPrincipal = escolherOperacaoParaPatrulhamento(minutosParaHora(cursor), localPrincipal);
                detalhesPrincipal = localPrincipal?.raio ? `Raio ${localPrincipal.raio}m` : 'Patrulhamento de area';
            }

            addAtividade(tipoPrincipal, 50, localPrincipal, operacaoPrincipal, detalhesPrincipal);

            const destinoDesloc = (slot === duracaoHoras - 1)
                ? peekBase()
                : (slot % 2 === 0 ? peekPatrulha() : peekBase());

            addAtividade('Deslocamento', 10, destinoDesloc, '', 'Transicao de ponto (janela de deslocamento: 10 min).');
        }

        return atividades;
    }

    function criarModeloOSFracionada(config) {
        const horaInicio = config.horaInicio;
        const duracaoHoras = Number(config.duracaoHoras);
        const terminoGeral = somarMinutos(horaInicio, duracaoHoras * 60);
        const atividades = criarFracionamentoTurno(config);

        return {
            chaveDemo: config.chaveDemo,
            nomeOS: config.nomeOS,
            tipoRecurso: config.tipoRecurso,
            inicioGeral: horaInicio,
            terminoGeral,
            atividades
        };
    }

    function sanitizarAtividadeSemEndereco(atividade) {
        if (!atividade || !atividadeSemEndereco(atividade.tipo)) return false;

        let changed = false;
        const camposTexto = ['local', 'operacao', 'rua', 'numero', 'bairro', 'cidade', 'detalhes'];
        camposTexto.forEach(campo => {
            if ((atividade[campo] || '') !== '') {
                atividade[campo] = '';
                changed = true;
            }
        });

        if (atividade.gps != null) {
            atividade.gps = null;
            changed = true;
        }

        return changed;
    }

    function sanitizarOrdensDemoSemEndereco(bancoOS) {
        if (!Array.isArray(bancoOS)) return 0;
        let alteradas = 0;

        bancoOS.forEach(os => {
            if (!os || os.origemDemo !== DEMO_TAG || !Array.isArray(os.atividades)) return;
            let mudouOS = false;
            os.atividades.forEach(atividade => {
                if (sanitizarAtividadeSemEndereco(atividade)) mudouOS = true;
            });
            if (mudouOS) alteradas += 1;
        });

        return alteradas;
    }

    function getTipoServicoDemoList() {
        const now = getNowIso();
        const descricoes = [
            'Patrulhamento preventivo em area central de grande circulacao.',
            'Patrulhamento preventivo em corredores comerciais e acessos principais.',
            'Baseamento preventivo com resposta rapida em ponto fixo.',
            'Patrulhamento em apoio a escolas, comercio e servicos essenciais.',
            'Patrulhamento com foco em visibilidade e saturacao de area.',
            'Baseamento e ronda de curta distancia em area de interesse.',
            'Patrulhamento preventivo em horario de maior fluxo de pessoas.',
            'Apoio de prevencao em entorno de terminais e vias estruturais.',
            'Patrulhamento orientado por pontos sensiveis e demandas locais.',
            'Emprego preventivo combinado de baseamento e patrulhamento.'
        ];

        return descricoes.map((descricao, index) => ({
            nome: `APREV-${index + 1}`,
            descricao,
            status: 'Ativa',
            criadoEm: now,
            atualizadoEm: now,
            ...demoMeta(`tipo_servico_aprev_${index + 1}`)
        }));
    }

    function getOperacoesEspeciaisDemo() {
        const now = getNowIso();
        return [
            {
                id: Date.now() + 701,
                nome: 'OPERACAO PRAIA',
                descricao: 'Emprego especial em orla/praia para grande fluxo de banhistas e eventos.',
                inicio: '08:00',
                fim: '18:00',
                criadoEm: now,
                ...demoMeta('operacao_praia')
            },
            {
                id: Date.now() + 702,
                nome: 'PERCURSO SEGURO',
                descricao: 'Acompanhamento em corredores de fluxo nos horarios de rush (manha e fim de tarde).',
                inicio: '06:00',
                fim: '20:00',
                criadoEm: now,
                ...demoMeta('operacao_percurso_seguro')
            }
        ];
    }

    function localizarPorChaveDemo(chaveStorage, chaveDemo) {
        const lista = readArray(chaveStorage);
        return lista.find(item => item && item.chaveDemo === chaveDemo) || null;
    }

    function getFallbackPontos() {
        const demo = getDemoCadastrosRio();
        const baseMap = Object.fromEntries(demo.locaisCadastrados.map(l => [l.chaveDemo, l]));
        const ptrMap = Object.fromEntries(demo.pontosPatrulhamento.map(p => [p.chaveDemo, p]));
        return { baseMap, ptrMap };
    }

    function montarLookupLocais() {
        const fallback = getFallbackPontos();
        const basesDB = readArray('locaisCadastrados');
        const ptrDB = readArray('pontosPatrulhamento');

        return {
            baseByKey(chave) {
                return basesDB.find(item => item && item.chaveDemo === chave) || fallback.baseMap[chave] || null;
            },
            ptrByKey(chave) {
                return ptrDB.find(item => item && item.chaveDemo === chave) || fallback.ptrMap[chave] || null;
            }
        };
    }

    function mapKeysLocais(keys, resolver) {
        return keys.map(k => resolver(k)).filter(Boolean);
    }

    function montarOSDemo(options) {
        const opts = options || {};
        const tipoRecursoForcado = opts.forcarTipoRecurso ? String(opts.forcarTipoRecurso) : '';
        const loc = montarLookupLocais();

        const modelos = [
            {
                chaveDemo: 'os_viatura_zs_12h',
                nomeOS: 'VIATURA ZONA SUL',
                tipoRecurso: 'Viatura',
                horaInicio: '06:00',
                duracaoHoras: 12,
                bases: ['base_copacabana', 'base_botafogo', 'base_leblon', 'base_flamengo'],
                patrulhas: ['ptr_copacabana', 'ptr_ipanema', 'ptr_leblon', 'ptr_botafogo', 'ptr_flamengo']
            },
            {
                chaveDemo: 'os_viatura_centro_8h',
                nomeOS: 'VIATURA CENTRO/LAPA',
                tipoRecurso: 'Viatura',
                horaInicio: '14:00',
                duracaoHoras: 8,
                bases: ['base_centro', 'base_lapa', 'base_tijuca'],
                patrulhas: ['ptr_centro', 'ptr_lapa', 'ptr_maracana', 'ptr_tijuca']
            },
            {
                chaveDemo: 'os_viatura_zo_12h',
                nomeOS: 'VIATURA ZONA OESTE',
                tipoRecurso: 'Viatura',
                horaInicio: '18:00',
                duracaoHoras: 12,
                bases: ['base_barra', 'base_recreio', 'base_jacarepagua'],
                patrulhas: ['ptr_barra', 'ptr_recreio', 'ptr_jacarepagua', 'ptr_bangu']
            },
            {
                chaveDemo: 'os_moto_orla_8h',
                nomeOS: 'MOTO PATRULHA ORLA',
                tipoRecurso: 'Moto',
                horaInicio: '08:00',
                duracaoHoras: 8,
                bases: ['base_copacabana', 'base_ipanema'],
                patrulhas: ['ptr_copacabana', 'ptr_ipanema', 'ptr_leblon', 'ptr_flamengo']
            },
            {
                chaveDemo: 'os_moto_corredor_12h',
                nomeOS: 'MOTO CORREDOR SEGURO',
                tipoRecurso: 'Moto',
                horaInicio: '07:00',
                duracaoHoras: 12,
                bases: ['base_tijuca', 'base_maracana', 'base_centro'],
                patrulhas: ['ptr_tijuca', 'ptr_maracana', 'ptr_centro', 'ptr_meier']
            },
            {
                chaveDemo: 'os_cabine_lapa_12h',
                nomeOS: 'CABINE LAPA APOIO',
                tipoRecurso: 'Cabine',
                horaInicio: '07:00',
                duracaoHoras: 12,
                bases: ['base_lapa', 'base_centro'],
                patrulhas: ['ptr_lapa', 'ptr_centro', 'ptr_maracana']
            },
            {
                chaveDemo: 'os_cabine_copa_8h',
                nomeOS: 'CABINE COPACABANA APOIO',
                tipoRecurso: 'Cabine',
                horaInicio: '12:00',
                duracaoHoras: 8,
                bases: ['base_copacabana', 'base_botafogo'],
                patrulhas: ['ptr_copacabana', 'ptr_botafogo', 'ptr_flamengo']
            },
            {
                chaveDemo: 'os_setor_centro_8h',
                nomeOS: 'SETOR A PE CENTRO',
                tipoRecurso: 'Setor',
                horaInicio: '09:00',
                duracaoHoras: 8,
                bases: ['base_centro', 'base_lapa'],
                patrulhas: ['ptr_centro', 'ptr_lapa', 'ptr_tijuca', 'ptr_maracana']
            },
            {
                chaveDemo: 'os_setor_madureira_12h',
                nomeOS: 'SETOR A PE MADUREIRA',
                tipoRecurso: 'Setor',
                horaInicio: '10:00',
                duracaoHoras: 12,
                bases: ['base_madureira', 'base_iraja', 'base_penha'],
                patrulhas: ['ptr_madureira', 'ptr_iraja', 'ptr_penha', 'ptr_bonsucesso']
            }
        ];

        return modelos.map(modelo => criarModeloOSFracionada({
            ...modelo,
            tipoRecurso: tipoRecursoForcado || modelo.tipoRecurso,
            bases: mapKeysLocais(modelo.bases, loc.baseByKey),
            patrulhas: mapKeysLocais(modelo.patrulhas, loc.ptrByKey)
        })).filter(os => Array.isArray(os.atividades) && os.atividades.length > 0);
    }

    function matcherPorNomeOuChaveDemo(atual, novo) {
        if (!atual || !novo) return false;
        if (atual.chaveDemo && novo.chaveDemo) return atual.chaveDemo === novo.chaveDemo;
        return normalizarNomeTipoServico(atual.nome) === normalizarNomeTipoServico(novo.nome);
    }

    function seedTiposServicoDemo() {
        const tipos = readArray('tiposServico');
        let added = 0;

        getTipoServicoDemoList().forEach(tipo => {
            const inserted = pushIfMissing(tipos, tipo, matcherPorNomeOuChaveDemo);
            if (inserted) added++;
        });

        if (added > 0) writeArray('tiposServico', tipos);
        executarNormalizadorSilent('carga de tipos de servico');

        return {
            tiposServico: added,
            total: added
        };
    }

    function seedOperacoesEspeciais() {
        const operacoes = readArray('cadastrosOperacoes');
        let added = 0;

        getOperacoesEspeciaisDemo().forEach(op => {
            const inserted = pushIfMissing(operacoes, op, matcherPorNomeOuChaveDemo);
            if (inserted) added++;
        });

        if (added > 0) writeArray('cadastrosOperacoes', operacoes);
        executarNormalizadorSilent('carga de operacoes especiais');

        return {
            cadastrosOperacoes: added,
            total: added
        };
    }

    function seedOrdensServicoDemo(options) {
        const opts = options || {};
        const resumo = { ordensServico: 0, ordensAjustadas: 0, total: 0 };
        const agora = getNowIso();
        const bancoOS = readArray('ordensServico');
        const ordensDemoAjustadas = sanitizarOrdensDemoSemEndereco(bancoOS);
        resumo.ordensAjustadas = ordensDemoAjustadas;
        const modelosDemo = montarOSDemo(opts);
        const modeloPorChave = new Map(modelosDemo.map(modelo => [modelo.chaveDemo, modelo]));

        bancoOS.forEach(os => {
            if (!os || os.origemDemo !== DEMO_TAG || !os.chaveDemo) return;
            const modelo = modeloPorChave.get(os.chaveDemo);
            if (!modelo) return;
            if (os.tipoRecurso !== modelo.tipoRecurso) {
                os.tipoRecurso = modelo.tipoRecurso;
                resumo.ordensAjustadas += 1;
            }
        });

        let maxNumero = bancoOS.reduce((max, os) => {
            const n = Number(os && os.numero);
            return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 1000);

        modelosDemo.forEach(modelo => {
            const exists = bancoOS.some(os => (os && os.chaveDemo === modelo.chaveDemo));
            if (exists) return;
            maxNumero += 1;
            bancoOS.push({
                numero: maxNumero,
                id: Date.now() + maxNumero,
                criadoEm: agora,
                status: 'Ativa',
                tipoOrdem: '',
                nomeOS: modelo.nomeOS,
                tipoRecurso: modelo.tipoRecurso,
                inicioGeral: modelo.inicioGeral,
                terminoGeral: modelo.terminoGeral,
                atividades: modelo.atividades,
                ...demoMeta(modelo.chaveDemo)
            });
            resumo.ordensServico++;
        });

        if (resumo.ordensServico > 0 || ordensDemoAjustadas > 0) {
            writeArray('ordensServico', bancoOS);
        }

        executarNormalizadorSilent('carga de ordens de servico');
        resumo.total = resumo.ordensServico;
        return resumo;
    }

    function seedTiposEOS() {
        const rTipos = seedTiposServicoDemo();
        const rOps = seedOperacoesEspeciais();
        const rOrdens = seedOrdensServicoDemo();

        return {
            tiposServico: rTipos.tiposServico || 0,
            cadastrosOperacoes: rOps.cadastrosOperacoes || 0,
            ordensServico: rOrdens.ordensServico || 0,
            ordensAjustadas: rOrdens.ordensAjustadas || 0,
            total: (rTipos.total || 0) + (rOps.total || 0) + (rOrdens.total || 0)
        };
    }

    function getAtivosPorTipoRecurso() {
        const viaturas = readArray('viaturas').filter(v => v && normalizeStatus(v.status, 'Ativa') === 'Ativa');
        const cabines = readArray('cabines').filter(c => c && normalizeStatus(c.status, 'Ativa') === 'Ativa');
        const setores = readArray('setores').filter(s => s && normalizeStatus(s.status, 'Ativa') === 'Ativa');

        return {
            Viatura: viaturas.filter(v => normalizeTipoRecursoVtr(v.tipo) === 'Viatura'),
            Moto: viaturas.filter(v => normalizeTipoRecursoVtr(v.tipo) === 'Moto'),
            Cabine: cabines,
            Setor: setores
        };
    }

    function getOrdensAtivasPorTipo() {
        const ordens = readArray('ordensServico').filter(os => os && normalizeStatus(os.status, 'Ativa') === 'Ativa');
        return {
            Viatura: ordens.filter(os => normalizeTipoOS(os.tipoRecurso) === 'Viatura'),
            Moto: ordens.filter(os => normalizeTipoOS(os.tipoRecurso) === 'Moto'),
            Cabine: ordens.filter(os => normalizeTipoOS(os.tipoRecurso) === 'Cabine'),
            Setor: ordens.filter(os => normalizeTipoOS(os.tipoRecurso) === 'Setor')
        };
    }

    function escolherTipoServico(index) {
        const tiposAtivos = readArray('tiposServico')
            .filter(t => t && normalizeStatus(t.status, 'Ativa') === 'Ativa' && t.nome)
            .map(t => normalizarNomeTipoServico(t.nome));

        if (tiposAtivos.length === 0) return null;
        return tiposAtivos[index % tiposAtivos.length];
    }

    function escolherTipoServicoPorIndice(index) {
        const tiposAtivos = readArray('tiposServico')
            .filter(t => t && normalizeStatus(t.status, 'Ativa') === 'Ativa' && t.nome)
            .map(t => normalizarNomeTipoServico(t.nome));

        if (tiposAtivos.length === 0) return null;
        const idx = Number.isFinite(Number(index)) ? Number(index) : 0;
        const seguro = ((idx % tiposAtivos.length) + tiposAtivos.length) % tiposAtivos.length;
        return tiposAtivos[seguro];
    }

    function montarComandanteDemo(tipoRecurso, posicao) {
        const base = [
            { posto: 'SGT', nome: 'SILVA', rg: '100001', tel: '(21) 99901-0001' },
            { posto: 'CB', nome: 'COSTA', rg: '100002', tel: '(21) 99902-0002' },
            { posto: 'SGT', nome: 'OLIVEIRA', rg: '100003', tel: '(21) 99903-0003' },
            { posto: 'CB', nome: 'SANTOS', rg: '100004', tel: '(21) 99904-0004' }
        ];
        const ref = base[posicao % base.length];
        return {
            posto: ref.posto,
            nome: ref.nome,
            rg: ref.rg,
            tel: ref.tel,
            funcao: 'Comandante'
        };
    }

    function normalizarNomeComandanteDemo(nome) {
        const valor = String(nome || '').trim();
        if (!valor) return valor;
        return valor.replace(/\s+(viatura|moto|cabine|setor)$/i, '').trim();
    }

    function corrigirNomesComandanteEmEscalasDemo(escalas) {
        if (!Array.isArray(escalas)) return false;
        let alterou = false;

        escalas.forEach(escala => {
            if (!escala || escala.origemDemo !== DEMO_TAG) return;
            if (!Array.isArray(escala.equipe) || !escala.equipe[0]) return;

            const comandante = escala.equipe[0];
            const nomeOriginal = comandante?.nome;
            const nomeCorrigido = normalizarNomeComandanteDemo(nomeOriginal);

            if (nomeCorrigido && nomeCorrigido !== nomeOriginal) {
                comandante.nome = nomeCorrigido;
                alterou = true;
            }
        });

        return alterou;
    }

    function montarAuxiliaresDemo(qtd, posicao) {
        const nomes = ['PEREIRA', 'ROCHA', 'MENDES', 'LIMA', 'TEIXEIRA', 'BARROS'];
        const postos = ['SD', 'CB', 'SD', 'SD', 'CB', 'SD'];
        const out = [];
        for (let i = 0; i < qtd; i++) {
            const idx = (posicao + i) % nomes.length;
            out.push({
                posto: postos[idx],
                nome: nomes[idx],
                rg: String(200000 + (posicao * 10) + i),
                tel: '',
                funcao: 'Auxiliar'
            });
        }
        return out;
    }

    function obterTextoTipoRecursoReal(recurso, tipoLogico) {
        if (!recurso) return tipoLogico;
        if (tipoLogico === 'Viatura' || tipoLogico === 'Moto') {
            return recurso.tipo || tipoLogico;
        }
        return tipoLogico;
    }

    function recursoViaturaEhCarro(recurso) {
        const tipo = (recurso?.tipo || '').toString().toLowerCase();
        return tipo.includes('carro');
    }

    function seedAtivacoes() {
        const escalas = readArray('escalasAtivas');
        const historico = readArray('historicoEscalas');
        let alterouExistentes = corrigirNomesComandanteEmEscalasDemo(escalas);
        const recursosEmUso = new Set(escalas.map(e => e && (e.recursoId || e.prefixo)).filter(Boolean).map(String));

        const recursosPorTipo = getAtivosPorTipoRecurso();
        const ordensPorTipo = getOrdensAtivasPorTipo();

        const planos = [
            { tipo: 'Viatura', preferDemoRecurso: 'viatura_carro_1', preferDemoOS: 'os_viatura_zs_12h', auxiliares: 1 },
            { tipo: 'Moto', preferDemoRecurso: 'viatura_moto_1', preferDemoOS: 'os_moto_orla_8h', auxiliares: 0 },
            { tipo: 'Cabine', preferDemoRecurso: 'cabine_lapa', preferDemoOS: 'os_cabine_lapa_12h', auxiliares: 1 },
            { tipo: 'Setor', preferDemoRecurso: 'setor_lapa', preferDemoOS: 'os_setor_centro_8h', auxiliares: 2 }
        ];

        let created = 0;
        const detalhes = [];
        let sequencia = 0;

        planos.forEach((plano, idx) => {
            const recursos = recursosPorTipo[plano.tipo] || [];
            const ordens = ordensPorTipo[plano.tipo] || [];

            if (recursos.length === 0) {
                detalhes.push(`${plano.tipo}: sem recurso ativo disponivel`);
                return;
            }
            if (ordens.length === 0) {
                detalhes.push(`${plano.tipo}: sem OS ativa compativel`);
                return;
            }

            const recurso = recursos.find(r => r && r.chaveDemo === plano.preferDemoRecurso && !recursosEmUso.has(String(r.prefixo || r.codigo)))
                || recursos.find(r => r && !recursosEmUso.has(String(r.prefixo || r.codigo)));

            if (!recurso) {
                detalhes.push(`${plano.tipo}: todos os recursos ja estao em uso`);
                return;
            }

            const os = ordens.find(o => o && o.chaveDemo === plano.preferDemoOS)
                || ordens[0];

            const tipoServicoSelecionado = escolherTipoServico(idx);
            if (!tipoServicoSelecionado) {
                detalhes.push(`${plano.tipo}: nenhum tipo de servico ativo cadastrado`);
                return;
            }

            const recursoId = String(recurso.prefixo || recurso.codigo || '');
            if (!recursoId) {
                detalhes.push(`${plano.tipo}: recurso sem identificador`);
                return;
            }

            const agora = new Date(Date.now() + (sequencia * 1000));
            sequencia += 1;
            const dataInicioIso = agora.toISOString();
            const duracaoServicoMinutos = calcularDuracaoTurnoMinutos(os.inicioGeral, os.terminoGeral);
            const dataFimPrevista = Number.isFinite(duracaoServicoMinutos)
                ? new Date(agora.getTime() + (duracaoServicoMinutos * 60000)).toISOString()
                : null;

            const comandante = montarComandanteDemo(plano.tipo, idx);
            const auxiliares = montarAuxiliaresDemo(plano.auxiliares, idx + 1);

            escalas.push({
                id: Date.now() + Math.floor(Math.random() * 100000) + idx,
                dataInicio: dataInicioIso,
                dataAtivacao: agora.toLocaleDateString('pt-BR'),
                horaAtivacao: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                recursoId,
                tipoRecurso: obterTextoTipoRecursoReal(recurso, plano.tipo),
                osNumero: Number(os.numero),
                tipoServico: tipoServicoSelecionado,
                horaInicioServico: os.inicioGeral || '',
                horaFimServico: os.terminoGeral || '',
                duracaoServicoMinutos: Number.isFinite(duracaoServicoMinutos) ? duracaoServicoMinutos : null,
                dataFimPrevista,
                osResumo: {
                    numero: Number(os.numero),
                    nomeOS: os.nomeOS || '',
                    tipoRecurso: os.tipoRecurso || plano.tipo,
                    inicioGeral: os.inicioGeral || '',
                    terminoGeral: os.terminoGeral || '',
                    tipoOrdem: tipoServicoSelecionado
                },
                despachante: {
                    nome: 'SGT Controle',
                    funcao: 'Operador de Despacho',
                    id: 'demo_seed'
                },
                equipe: [comandante, ...auxiliares],
                ...demoMeta(`ativacao_${plano.tipo.toLowerCase()}_${recursoId.replace(/\W/g, '')}`)
            });

            recursosEmUso.add(recursoId);
            created += 1;
            detalhes.push(`${plano.tipo}: ativada em ${recursoId} (OS ${os.numero})`);
        });

        if (created > 0 || alterouExistentes) {
            writeArray('escalasAtivas', escalas);
        }

        // Garante que a chave exista e evita paginas antigas tratando null
        if (!Array.isArray(historico)) {
            writeArray('historicoEscalas', []);
        } else if (localStorage.getItem('historicoEscalas') == null) {
            writeArray('historicoEscalas', historico);
        }

        if (window.ORDENA_STORAGE_NORMALIZER && typeof window.ORDENA_STORAGE_NORMALIZER.runAll === 'function') {
            try {
                window.ORDENA_STORAGE_NORMALIZER.runAll({ save: true, silent: true });
            } catch (err) {
                console.warn('[ORDENA DemoSeed] Falha ao normalizar apos carga de ativacoes.', err);
            }
        }

        return {
            escalasAtivas: created,
            total: created,
            detalhes
        };
    }

    function seedAtivacoesSomenteCarros(options) {
        const opts = options || {};
        const quantidadeAlvo = Math.max(1, Math.min(20, Number(opts.quantidade) || 4));
        const exemplos = Array.isArray(opts.exemplos) ? opts.exemplos : [];

        const escalas = readArray('escalasAtivas');
        const historico = readArray('historicoEscalas');
        let alterouExistentes = corrigirNomesComandanteEmEscalasDemo(escalas);
        const recursosEmUso = new Set(escalas.map(e => e && (e.recursoId || e.prefixo)).filter(Boolean).map(String));

        const recursosViaturaCarro = (getAtivosPorTipoRecurso().Viatura || [])
            .filter(recursoViaturaEhCarro);
        const ordensViatura = (getOrdensAtivasPorTipo().Viatura || []);

        let created = 0;
        const detalhes = [];
        let sequencia = 0;

        if (recursosViaturaCarro.length === 0) {
            return {
                escalasAtivas: 0,
                total: 0,
                detalhes: ['Viatura (Carro): sem recurso ativo disponível']
            };
        }

        if (ordensViatura.length === 0) {
            return {
                escalasAtivas: 0,
                total: 0,
                detalhes: ['Viatura (Carro): sem OS ativa compatível']
            };
        }

        const ordensPreferidas = [...ordensViatura].sort((a, b) => {
            const aDemo = a?.origemDemo === DEMO_TAG ? 0 : 1;
            const bDemo = b?.origemDemo === DEMO_TAG ? 0 : 1;
            if (aDemo !== bDemo) return aDemo - bDemo;
            return Number(a?.numero || 0) - Number(b?.numero || 0);
        });

        const recursosDisponiveis = recursosViaturaCarro.filter(r => !recursosEmUso.has(String(r.prefixo || r.codigo)));
        const quantidadeCriar = Math.min(quantidadeAlvo, recursosDisponiveis.length);
        const recursosPorChaveDemo = new Map(recursosDisponiveis.filter(r => r?.chaveDemo).map(r => [r.chaveDemo, r]));
        const recursosPorPrefixo = new Map(recursosDisponiveis.filter(r => r?.prefixo).map(r => [String(r.prefixo), r]));
        const ordensPorChaveDemo = new Map(ordensPreferidas.filter(o => o?.chaveDemo).map(o => [o.chaveDemo, o]));

        for (let idx = 0; idx < quantidadeCriar; idx++) {
            const exemplo = exemplos[idx] || null;
            let recurso = null;
            if (exemplo?.recursoChaveDemo) recurso = recursosPorChaveDemo.get(exemplo.recursoChaveDemo) || null;
            if (!recurso && exemplo?.recursoPrefixo) recurso = recursosPorPrefixo.get(String(exemplo.recursoPrefixo)) || null;
            if (!recurso) recurso = recursosDisponiveis[idx];

            let os = null;
            if (exemplo?.osChaveDemo) os = ordensPorChaveDemo.get(exemplo.osChaveDemo) || null;
            if (!os && Number.isFinite(Number(exemplo?.osNumero))) {
                os = ordensPreferidas.find(item => Number(item?.numero) === Number(exemplo.osNumero)) || null;
            }
            if (!os) os = ordensPreferidas[idx % ordensPreferidas.length];

            const tipoServicoSelecionado = (exemplo && 'tipoServicoIndex' in exemplo)
                ? escolherTipoServicoPorIndice(exemplo.tipoServicoIndex)
                : escolherTipoServico(idx);

            if (!recurso) break;
            if (!os) {
                detalhes.push('Viatura (Carro): sem OS ativa compatível');
                break;
            }
            if (!tipoServicoSelecionado) {
                detalhes.push('Viatura (Carro): nenhum tipo de serviço ativo cadastrado');
                break;
            }

            const recursoId = String(recurso.prefixo || '');
            if (!recursoId) continue;

            const agora = new Date(Date.now() + (sequencia * 1000));
            sequencia += 1;
            const dataInicioIso = agora.toISOString();
            const duracaoServicoMinutos = calcularDuracaoTurnoMinutos(os.inicioGeral, os.terminoGeral);
            const dataFimPrevista = Number.isFinite(duracaoServicoMinutos)
                ? new Date(agora.getTime() + (duracaoServicoMinutos * 60000)).toISOString()
                : null;

            const comandante = montarComandanteDemo('Viatura', idx);
            const qtdAuxiliares = Number.isFinite(Number(exemplo?.auxiliares))
                ? Math.max(0, Math.min(5, Number(exemplo.auxiliares)))
                : ((idx % 2) + 1);
            const auxiliares = montarAuxiliaresDemo(qtdAuxiliares, idx + 1);

            escalas.push({
                id: Date.now() + Math.floor(Math.random() * 100000) + idx,
                dataInicio: dataInicioIso,
                dataAtivacao: agora.toLocaleDateString('pt-BR'),
                horaAtivacao: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                recursoId,
                tipoRecurso: obterTextoTipoRecursoReal(recurso, 'Viatura'),
                osNumero: Number(os.numero),
                tipoServico: tipoServicoSelecionado,
                horaInicioServico: os.inicioGeral || '',
                horaFimServico: os.terminoGeral || '',
                duracaoServicoMinutos: Number.isFinite(duracaoServicoMinutos) ? duracaoServicoMinutos : null,
                dataFimPrevista,
                osResumo: {
                    numero: Number(os.numero),
                    nomeOS: os.nomeOS || '',
                    tipoRecurso: os.tipoRecurso || 'Viatura',
                    inicioGeral: os.inicioGeral || '',
                    terminoGeral: os.terminoGeral || '',
                    tipoOrdem: tipoServicoSelecionado
                },
                despachante: {
                    nome: 'SGT Controle',
                    funcao: 'Operador de Despacho',
                    id: 'demo_seed'
                },
                equipe: [comandante, ...auxiliares],
                ...demoMeta(`ativacao_viatura_carro_${recursoId.replace(/\W/g, '')}`)
            });

            recursosEmUso.add(recursoId);
            created += 1;
            detalhes.push(`Carro: ativada em ${recursoId} (OS ${os.numero})`);
        }

        if (quantidadeCriar < quantidadeAlvo) {
            detalhes.push(`Carro: criadas ${quantidadeCriar}/${quantidadeAlvo} (faltam viaturas livres).`);
        }

        if (created > 0 || alterouExistentes) {
            writeArray('escalasAtivas', escalas);
        }

        if (!Array.isArray(historico)) {
            writeArray('historicoEscalas', []);
        } else if (localStorage.getItem('historicoEscalas') == null) {
            writeArray('historicoEscalas', historico);
        }

        executarNormalizadorSilent('carga de ativacoes');

        return {
            escalasAtivas: created,
            total: created,
            detalhes
        };
    }

    function seedAtivacoesComDependencias(options) {
        const opts = options || {};

        if (opts.somenteCarros) {
            const rViaturas = seedViaturas();
            const rBases = seedBaseamentos();
            const rPtr = seedPatrulhamentos();
            const rTipos = seedTiposServicoDemo();
            const rOps = seedOperacoesEspeciais();
            const rOrdens = seedOrdensServicoDemo({ forcarTipoRecurso: 'Viatura' });
            const rAtiv = seedAtivacoesSomenteCarros({
                quantidade: opts.quantidade || 4,
                exemplos: opts.exemplos || []
            });

            return {
                cadastrosBase: (rViaturas.total || 0) + (rBases.total || 0) + (rPtr.total || 0),
                tiposEOrdens: (rTipos.total || 0) + (rOps.total || 0) + (rOrdens.total || 0),
                escalasAtivas: rAtiv.escalasAtivas || 0,
                total: (rViaturas.total || 0) + (rBases.total || 0) + (rPtr.total || 0) + (rTipos.total || 0) + (rOps.total || 0) + (rOrdens.total || 0) + (rAtiv.total || 0),
                detalhes: rAtiv.detalhes || []
            };
        }

        const rCad = seedCadastrosLocais();
        const rTiposOs = seedTiposEOS();
        const rAtiv = seedAtivacoes();

        return {
            cadastrosBase: rCad.total || 0,
            tiposEOrdens: rTiposOs.total || 0,
            escalasAtivas: rAtiv.escalasAtivas || 0,
            total: (rCad.total || 0) + (rTiposOs.total || 0) + (rAtiv.total || 0),
            detalhes: rAtiv.detalhes || []
        };
    }

    window.ORDENA_DEMO_SEED = {
        version: DEMO_VERSION,
        seedViaturas,
        seedCabines,
        seedSetores,
        seedBaseamentos,
        seedPatrulhamentos,
        seedCadastrosLocais,
        seedTiposServicoDemo,
        seedOperacoesEspeciais,
        seedOrdensServicoDemo,
        seedTiposEOS,
        seedAtivacoes,
        seedAtivacoesComDependencias
    };
})();
