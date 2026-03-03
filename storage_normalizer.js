(function () {
    'use strict';

    const VERSION = '1.0.0';
    const LOG_PREFIX = '[ORDENA StorageNormalizer]';

    const ARRAY_KEYS = [
        'viaturas',
        'cabines',
        'setores',
        'locaisCadastrados',
        'pontosPatrulhamento',
        'ordensServico',
        'ordensEspeciais',
        'planejamentoDiario',
        'escalasAtivas',
        'historicoEscalas',
        'tiposServico',
        'cadastrosOperacoes'
    ];

    const OBJECT_KEYS = [
        'ativacaoImpressaoTemp',
        'historicoImpressaoTemp',
        'osImpressaoTemp'
    ];

    function createCtx() {
        return { changed: false };
    }

    function markChanged(ctx) {
        ctx.changed = true;
    }

    function isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function ensureObject(value, ctx, fallback) {
        if (isObject(value)) return value;
        markChanged(ctx);
        return { ...(fallback || {}) };
    }

    function ensureArray(value, ctx) {
        if (Array.isArray(value)) return value;
        markChanged(ctx);
        return [];
    }

    function ensureStringField(obj, key, fallback, ctx) {
        if (!isObject(obj)) return;
        if (typeof obj[key] !== 'string') {
            obj[key] = fallback;
            markChanged(ctx);
        }
    }

    function ensureNumberOrNullField(obj, key, ctx) {
        if (!isObject(obj)) return;
        const v = obj[key];
        if (v == null) {
            if (obj[key] !== null) {
                obj[key] = null;
                markChanged(ctx);
            }
            return;
        }
        if (typeof v === 'number' && Number.isFinite(v)) return;
        const parsed = Number(v);
        if (Number.isFinite(parsed)) {
            obj[key] = parsed;
            markChanged(ctx);
        } else {
            obj[key] = null;
            markChanged(ctx);
        }
    }

    function ensureStatusField(obj, ctx, fallback) {
        if (!isObject(obj)) return;
        if (typeof obj.status !== 'string' || !obj.status.trim()) {
            obj.status = fallback;
            markChanged(ctx);
        }
    }

    function toDateSafe(value) {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d;
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

    function normalizarMembroEquipe(membro, ctx) {
        const out = ensureObject(membro, ctx, {});
        ensureStringField(out, 'posto', '', ctx);
        ensureStringField(out, 'nome', '', ctx);
        ensureStringField(out, 'rg', '', ctx);
        ensureStringField(out, 'tel', out.tel || '', ctx);
        ensureStringField(out, 'funcao', out.funcao || '', ctx);
        return out;
    }

    function normalizarAtividadeOs(atividade, ctx) {
        const out = ensureObject(atividade, ctx, {});

        ensureStringField(out, 'tipo', out.tipo || '', ctx);
        ensureStringField(out, 'inicio', out.inicio || '', ctx);
        ensureStringField(out, 'fim', out.fim || '', ctx);
        ensureStringField(out, 'local', out.local || '', ctx);
        ensureStringField(out, 'operacao', out.operacao || '', ctx);
        ensureStringField(out, 'rua', out.rua || '', ctx);
        ensureStringField(out, 'numero', out.numero || '', ctx);
        ensureStringField(out, 'bairro', out.bairro || '', ctx);
        ensureStringField(out, 'cidade', out.cidade || '', ctx);
        ensureStringField(out, 'detalhes', out.detalhes || '', ctx);

        if ('gps' in out && out.gps != null) {
            if (!isObject(out.gps)) {
                out.gps = null;
                markChanged(ctx);
            } else {
                ensureNumberOrNullField(out.gps, 'lat', ctx);
                ensureNumberOrNullField(out.gps, 'lng', ctx);
                if ('raio' in out.gps) ensureNumberOrNullField(out.gps, 'raio', ctx);
            }
        }

        return out;
    }

    function normalizarOs(os, ctx) {
        const out = ensureObject(os, ctx, {});

        if (out.numero != null && typeof out.numero !== 'number') {
            const n = Number(out.numero);
            if (Number.isFinite(n)) {
                out.numero = n;
                markChanged(ctx);
            }
        }

        ensureStatusField(out, ctx, 'Ativa');
        ensureStringField(out, 'tipoOrdem', typeof out.tipoOrdem === 'string' ? out.tipoOrdem : '', ctx);
        ensureStringField(out, 'nomeOS', out.nomeOS || '', ctx);
        ensureStringField(out, 'tipoRecurso', out.tipoRecurso || 'Viatura', ctx);
        ensureStringField(out, 'inicioGeral', out.inicioGeral || '', ctx);
        ensureStringField(out, 'terminoGeral', out.terminoGeral || '', ctx);

        out.atividades = ensureArray(out.atividades, ctx).map(a => normalizarAtividadeOs(a, ctx));
        return out;
    }

    function normalizarOsEspecial(os, ctx) {
        const out = ensureObject(os, ctx, {});
        ensureStatusField(out, ctx, 'Ativa');
        if (Array.isArray(out.atividades)) {
            out.atividades = out.atividades.map(a => normalizarAtividadeOs(a, ctx));
        }
        return out;
    }

    function normalizarEscala(escala, ctx, options) {
        const out = ensureObject(escala, ctx, {});
        const isHistorico = !!options?.historico;

        if (out.id != null && typeof out.id !== 'number') {
            const idNum = Number(out.id);
            if (Number.isFinite(idNum)) {
                out.id = idNum;
                markChanged(ctx);
            }
        }

        ensureStringField(out, 'dataInicio', out.dataInicio || '', ctx);
        ensureStringField(out, 'recursoId', out.recursoId || out.prefixo || '', ctx);
        ensureStringField(out, 'tipoRecurso', out.tipoRecurso || 'Viatura', ctx);

        if (out.osNumero != null && typeof out.osNumero !== 'number') {
            const osNum = Number(out.osNumero);
            if (Number.isFinite(osNum)) {
                out.osNumero = osNum;
                markChanged(ctx);
            }
        }

        out.equipe = ensureArray(out.equipe, ctx).map(m => normalizarMembroEquipe(m, ctx));

        if ('despachante' in out && out.despachante != null) {
            out.despachante = ensureObject(out.despachante, ctx, {});
            ensureStringField(out.despachante, 'nome', out.despachante.nome || '', ctx);
            ensureStringField(out.despachante, 'funcao', out.despachante.funcao || '', ctx);
            ensureStringField(out.despachante, 'id', out.despachante.id || '', ctx);
        }

        if ('osResumo' in out && out.osResumo != null) {
            out.osResumo = ensureObject(out.osResumo, ctx, {});
            ensureStringField(out.osResumo, 'nomeOS', out.osResumo.nomeOS || '', ctx);
            ensureStringField(out.osResumo, 'tipoRecurso', out.osResumo.tipoRecurso || '', ctx);
            ensureStringField(out.osResumo, 'inicioGeral', out.osResumo.inicioGeral || '', ctx);
            ensureStringField(out.osResumo, 'terminoGeral', out.osResumo.terminoGeral || '', ctx);
            ensureStringField(out.osResumo, 'tipoOrdem', typeof out.osResumo.tipoOrdem === 'string' ? out.osResumo.tipoOrdem : '', ctx);
            if (out.osResumo.numero != null && typeof out.osResumo.numero !== 'number') {
                const osResumoNum = Number(out.osResumo.numero);
                if (Number.isFinite(osResumoNum)) {
                    out.osResumo.numero = osResumoNum;
                    markChanged(ctx);
                }
            }
        } else if (!out.osResumo) {
            out.osResumo = {
                numero: out.osNumero || null,
                nomeOS: '',
                tipoRecurso: '',
                inicioGeral: '',
                terminoGeral: '',
                tipoOrdem: ''
            };
            markChanged(ctx);
        }

        const dataInicio = toDateSafe(out.dataInicio);
        if (dataInicio) {
            if (typeof out.dataAtivacao !== 'string' || !out.dataAtivacao) {
                out.dataAtivacao = dataInicio.toLocaleDateString('pt-BR');
                markChanged(ctx);
            }

            if (typeof out.horaAtivacao !== 'string' || !out.horaAtivacao) {
                out.horaAtivacao = dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                markChanged(ctx);
            }
        }

        if (typeof out.tipoServico !== 'string' || !out.tipoServico) {
            const tipoServicoFallback = out.osResumo?.tipoOrdem || '';
            if (tipoServicoFallback) {
                out.tipoServico = tipoServicoFallback;
                markChanged(ctx);
            } else if (typeof out.tipoServico !== 'string') {
                out.tipoServico = '';
                markChanged(ctx);
            }
        }

        if (typeof out.horaInicioServico !== 'string' || !out.horaInicioServico) {
            const fallback = out.osResumo?.inicioGeral || '';
            if (fallback || typeof out.horaInicioServico !== 'string') {
                out.horaInicioServico = fallback;
                markChanged(ctx);
            }
        }

        if (typeof out.horaFimServico !== 'string' || !out.horaFimServico) {
            const fallback = out.osResumo?.terminoGeral || '';
            if (fallback || typeof out.horaFimServico !== 'string') {
                out.horaFimServico = fallback;
                markChanged(ctx);
            }
        }

        if (!Number.isFinite(out.duracaoServicoMinutos)) {
            const duracao = calcularDuracaoTurnoMinutos(out.horaInicioServico, out.horaFimServico);
            if (Number.isFinite(duracao)) {
                out.duracaoServicoMinutos = duracao;
                markChanged(ctx);
            } else if (out.duracaoServicoMinutos !== null && out.duracaoServicoMinutos !== undefined) {
                out.duracaoServicoMinutos = null;
                markChanged(ctx);
            }
        }

        if (!out.dataFimPrevista && dataInicio && Number.isFinite(out.duracaoServicoMinutos)) {
            out.dataFimPrevista = new Date(
                dataInicio.getTime() + (out.duracaoServicoMinutos * 60000)
            ).toISOString();
            markChanged(ctx);
        }

        if (isHistorico) {
            if (typeof out.dataFim !== 'string') {
                out.dataFim = out.dataFim || '';
                markChanged(ctx);
            }
            if (typeof out.responsavelBaixa !== 'string' && out.responsavelBaixa != null) {
                out.responsavelBaixa = String(out.responsavelBaixa);
                markChanged(ctx);
            }
        }

        return out;
    }

    function normalizarViatura(item, ctx) {
        const out = ensureObject(item, ctx, {});
        ensureStringField(out, 'tipo', out.tipo || 'Carro', ctx);
        ensureStringField(out, 'prefixo', out.prefixo || '', ctx);
        ensureStringField(out, 'placa', out.placa || '', ctx);
        ensureStringField(out, 'radio', out.radio || '', ctx);
        if (typeof out.temRadio !== 'boolean') {
            out.temRadio = !!out.radio;
            markChanged(ctx);
        }
        ensureStatusField(out, ctx, 'Ativa');
        return out;
    }

    function normalizarCabine(item, ctx) {
        const out = ensureObject(item, ctx, {});
        ensureStringField(out, 'codigo', out.codigo || '', ctx);
        ensureStringField(out, 'nome', out.nome || '', ctx);
        ensureStatusField(out, ctx, 'Ativa');
        if ('lat' in out) ensureNumberOrNullField(out, 'lat', ctx);
        if ('lng' in out) ensureNumberOrNullField(out, 'lng', ctx);
        return out;
    }

    function normalizarSetor(item, ctx) {
        const out = ensureObject(item, ctx, {});
        ensureStringField(out, 'codigo', out.codigo || '', ctx);
        ensureStringField(out, 'nome', out.nome || '', ctx);
        ensureStatusField(out, ctx, 'Ativa');
        if ('lat' in out) ensureNumberOrNullField(out, 'lat', ctx);
        if ('lng' in out) ensureNumberOrNullField(out, 'lng', ctx);
        return out;
    }

    function normalizarLocal(item, ctx) {
        const out = ensureObject(item, ctx, {});
        ensureStringField(out, 'apelido', out.apelido || out.codigo || '', ctx);
        ensureStringField(out, 'rua', out.rua || '', ctx);
        ensureStringField(out, 'numero', out.numero || '', ctx);
        ensureStringField(out, 'bairro', out.bairro || '', ctx);
        ensureStringField(out, 'cidade', out.cidade || '', ctx);
        ensureStringField(out, 'obs', out.obs || '', ctx);
        ensureStatusField(out, ctx, 'Ativo');
        if ('lat' in out) ensureNumberOrNullField(out, 'lat', ctx);
        if ('lng' in out) ensureNumberOrNullField(out, 'lng', ctx);
        if ('raio' in out) ensureNumberOrNullField(out, 'raio', ctx);
        return out;
    }

    function normalizarTipoServico(item, ctx) {
        const out = ensureObject(item, ctx, {});
        ensureStringField(out, 'nome', out.nome || '', ctx);
        ensureStringField(out, 'descricao', out.descricao || '', ctx);
        ensureStatusField(out, ctx, 'Ativa');
        ensureStringField(out, 'criadoEm', out.criadoEm || '', ctx);
        ensureStringField(out, 'atualizadoEm', out.atualizadoEm || '', ctx);
        return out;
    }

    function normalizarCadastroOperacao(item, ctx) {
        const out = ensureObject(item, ctx, {});
        ensureStringField(out, 'nome', out.nome || '', ctx);
        ensureStringField(out, 'descricao', out.descricao || '', ctx);
        ensureStringField(out, 'inicio', out.inicio || '', ctx);
        ensureStringField(out, 'fim', out.fim || '', ctx);
        ensureStringField(out, 'criadoEm', out.criadoEm || '', ctx);
        return out;
    }

    function normalizarPlanejamento(item, ctx) {
        return ensureObject(item, ctx, {});
    }

    function normalizarImpressaoOs(payload, ctx) {
        const out = ensureObject(payload, ctx, {});
        if (Array.isArray(out.atividades)) {
            out.atividades = out.atividades.map(a => normalizarAtividadeOs(a, ctx));
        }
        return out;
    }

    function normalizarImpressaoEscalaPayload(payload, ctx) {
        const out = ensureObject(payload, ctx, {});
        if ('escala' in out && out.escala != null) {
            out.escala = normalizarEscala(out.escala, ctx, { historico: !!out.escala.dataFim });
        }
        if ('os' in out && out.os != null) {
            out.os = normalizarOs(out.os, ctx);
        }
        return out;
    }

    function normalizeRootForKey(key, parsed, ctx) {
        if (key === 'viaturas') return ensureArray(parsed, ctx).map(item => normalizarViatura(item, ctx));
        if (key === 'cabines') return ensureArray(parsed, ctx).map(item => normalizarCabine(item, ctx));
        if (key === 'setores') return ensureArray(parsed, ctx).map(item => normalizarSetor(item, ctx));
        if (key === 'locaisCadastrados') return ensureArray(parsed, ctx).map(item => normalizarLocal(item, ctx));
        if (key === 'pontosPatrulhamento') return ensureArray(parsed, ctx).map(item => normalizarLocal(item, ctx));
        if (key === 'ordensServico') return ensureArray(parsed, ctx).map(item => normalizarOs(item, ctx));
        if (key === 'ordensEspeciais') return ensureArray(parsed, ctx).map(item => normalizarOsEspecial(item, ctx));
        if (key === 'planejamentoDiario') return ensureArray(parsed, ctx).map(item => normalizarPlanejamento(item, ctx));
        if (key === 'escalasAtivas') return ensureArray(parsed, ctx).map(item => normalizarEscala(item, ctx, { historico: false }));
        if (key === 'historicoEscalas') return ensureArray(parsed, ctx).map(item => normalizarEscala(item, ctx, { historico: true }));
        if (key === 'tiposServico') return ensureArray(parsed, ctx).map(item => normalizarTipoServico(item, ctx));
        if (key === 'cadastrosOperacoes') return ensureArray(parsed, ctx).map(item => normalizarCadastroOperacao(item, ctx));
        if (key === 'osImpressaoTemp') return normalizarImpressaoOs(parsed, ctx);
        if (key === 'ativacaoImpressaoTemp' || key === 'historicoImpressaoTemp') return normalizarImpressaoEscalaPayload(parsed, ctx);
        return parsed;
    }

    function expectedRootType(key) {
        if (ARRAY_KEYS.includes(key)) return 'array';
        if (OBJECT_KEYS.includes(key)) return 'object';
        return 'any';
    }

    function rootTypeMatches(key, parsed) {
        const expected = expectedRootType(key);
        if (expected === 'any') return true;
        if (expected === 'array') return Array.isArray(parsed);
        if (expected === 'object') return isObject(parsed);
        return true;
    }

    function parseJsonSafe(key, raw) {
        try {
            return { ok: true, value: JSON.parse(raw) };
        } catch (err) {
            console.warn(`${LOG_PREFIX} JSON inválido na chave "${key}". Mantendo valor original.`, err);
            return { ok: false, error: err };
        }
    }

    function normalizeKey(key, options) {
        const raw = localStorage.getItem(key);
        if (raw == null) {
            return { key, status: 'missing', changed: false };
        }

        const parsedResult = parseJsonSafe(key, raw);
        if (!parsedResult.ok) {
            return { key, status: 'invalid_json', changed: false };
        }

        const parsed = parsedResult.value;
        if (!rootTypeMatches(key, parsed)) {
            console.warn(`${LOG_PREFIX} Tipo inesperado na chave "${key}". Mantendo valor original para evitar perda de dados.`);
            return { key, status: 'unexpected_type', changed: false };
        }

        const ctx = createCtx();
        const normalized = normalizeRootForKey(key, parsed, ctx);

        if (ctx.changed && options.save !== false) {
            try {
                localStorage.setItem(key, JSON.stringify(normalized));
            } catch (err) {
                console.error(`${LOG_PREFIX} Falha ao salvar chave normalizada "${key}".`, err);
                return { key, status: 'save_error', changed: false, error: String(err) };
            }
        }

        return {
            key,
            status: 'ok',
            changed: !!ctx.changed
        };
    }

    function runAll(options) {
        const opts = { save: true, silent: false, ...(options || {}) };
        const keys = [...ARRAY_KEYS, ...OBJECT_KEYS];
        const report = {
            version: VERSION,
            normalizedAt: new Date().toISOString(),
            results: []
        };

        keys.forEach(key => {
            report.results.push(normalizeKey(key, opts));
        });

        if (!opts.silent) {
            const changedCount = report.results.filter(r => r.changed).length;
            const problemCount = report.results.filter(r => r.status !== 'ok' && r.status !== 'missing').length;
            console.info(`${LOG_PREFIX} Execução concluída. Alteradas: ${changedCount}. Avisos: ${problemCount}.`);
        }

        return report;
    }

    function exportSnapshot() {
        const snapshot = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            snapshot[key] = localStorage.getItem(key);
        }
        return {
            exportedAt: new Date().toISOString(),
            version: VERSION,
            storage: snapshot
        };
    }

    window.ORDENA_STORAGE_NORMALIZER = {
        version: VERSION,
        runAll,
        normalizeKey,
        exportSnapshot
    };

    try {
        runAll({ silent: true });
    } catch (err) {
        console.error(`${LOG_PREFIX} Erro inesperado durante normalização automática.`, err);
    }
})();
