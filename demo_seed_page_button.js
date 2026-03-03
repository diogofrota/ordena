(function () {
    'use strict';

    function getPageName() {
        const path = (window.location.pathname || '').split('/').pop();
        return path || 'index.html';
    }

    function safeCall(fnName, args) {
        if (typeof window[fnName] === 'function') {
            try {
                return window[fnName].apply(window, args || []);
            } catch (err) {
                console.warn(`[ORDENA DemoSeedUI] Falha ao executar ${fnName}.`, err);
            }
        }
        return undefined;
    }

    function atualizarPaginaAtual(page) {
        if (page === 'cadastro.html') {
            safeCall('exibirViaturas');
            return;
        }
        if (page === 'cabines.html') {
            safeCall('exibirCabines');
            safeCall('gerarProximoCodigo');
            return;
        }
        if (page === 'setores.html') {
            safeCall('exibirSetores');
            safeCall('gerarProximoCodigo');
            return;
        }
        if (page === 'enderecos.html') {
            safeCall('exibirLocais');
            safeCall('gerarProximoCodigo');
            return;
        }
        if (page === 'patrulhamento.html') {
            safeCall('exibirPontos');
            safeCall('gerarProximoCodigo');
            return;
        }
        if (page === 'os.html') {
            safeCall('carregarListaOperacoes');
            safeCall('carregarOS');
            return;
        }
        if (page === 'tipos_servico.html') {
            safeCall('exibirTiposServico');
            return;
        }
        if (page === 'escalamento.html') {
            safeCall('popularRecursosFisicos');
            safeCall('popularTiposServicoAtivacao');
            safeCall('atualizarPainelTatico', [true]);
        }
    }

    function formatarResumo(titulo, resumo, ordemCampos) {
        const linhas = [titulo];
        (ordemCampos || []).forEach(campo => {
            if (resumo && Object.prototype.hasOwnProperty.call(resumo, campo)) {
                linhas.push(`- ${campo}: ${resumo[campo]}`);
            }
        });
        if (resumo && Array.isArray(resumo.detalhes) && resumo.detalhes.length > 0) {
            linhas.push('', 'Detalhes:');
            resumo.detalhes.forEach(item => linhas.push(`- ${item}`));
        }
        return linhas.join('\n');
    }

    function criarBotaoDemo(config) {
        const main = document.querySelector('main');
        if (!main) return;
        if (document.getElementById('demoSeedPageToolbar')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'demoSeedPageToolbar';
        wrapper.style.cssText = [
            'display:flex',
            'justify-content:flex-end',
            'margin:10px 0 12px 0',
            'padding:0 4px'
        ].join(';');

        const box = document.createElement('div');
        box.style.cssText = [
            'display:flex',
            'align-items:center',
            'gap:10px',
            'flex-wrap:wrap',
            'justify-content:flex-end'
        ].join(';');

        const info = document.createElement('small');
        info.textContent = config.infoText || 'Carga de teste desta página (sem apagar dados existentes)';
        info.style.cssText = 'color:#666; font-size:0.8rem;';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = config.className || 'btn-info';
        btn.textContent = config.label;
        btn.style.cssText = 'font-size:0.85rem; white-space:nowrap;';

        btn.addEventListener('click', () => {
            if (!window.ORDENA_DEMO_SEED) {
                alert('Gerador de dados de teste não carregado.');
                return;
            }

            btn.disabled = true;
            const textoOriginal = btn.textContent;
            btn.textContent = 'Carregando...';

            try {
                const resumo = config.run(window.ORDENA_DEMO_SEED) || { total: 0 };
                atualizarPaginaAtual(config.page);
                alert(formatarResumo(config.alertTitle, resumo, config.fields));
            } catch (err) {
                console.error('[ORDENA DemoSeedUI] Erro ao executar carga de teste da página.', err);
                alert('Erro ao carregar dados de teste desta página. Veja o console para detalhes.');
            } finally {
                btn.disabled = false;
                btn.textContent = textoOriginal;
            }
        });

        box.appendChild(info);
        box.appendChild(btn);
        wrapper.appendChild(box);
        main.insertBefore(wrapper, main.firstChild);
    }

    function criarResumoComposto(partes, extra) {
        const resumo = Object.assign({}, extra || {});
        let total = 0;
        (partes || []).forEach(item => {
            if (!item || !item.data) return;
            Object.keys(item.data).forEach(chave => {
                if (chave === 'total' || chave === 'detalhes') return;
                if (typeof item.data[chave] === 'number') {
                    resumo[chave] = (resumo[chave] || 0) + item.data[chave];
                }
            });
            if (typeof item.data.total === 'number') total += item.data.total;
        });
        resumo.total = total;
        return resumo;
    }

    const PAGE_ACTIONS = {
        'cadastro.html': {
            page: 'cadastro.html',
            label: 'Popular teste: Viaturas',
            className: 'btn-info',
            alertTitle: 'Carga de teste (Viaturas) concluída.',
            fields: ['viaturas', 'total'],
            run: (api) => api.seedViaturas()
        },
        'cabines.html': {
            page: 'cabines.html',
            label: 'Popular teste: Cabines',
            className: 'btn-info',
            alertTitle: 'Carga de teste (Cabines) concluída.',
            fields: ['cabines', 'total'],
            run: (api) => api.seedCabines()
        },
        'setores.html': {
            page: 'setores.html',
            label: 'Popular teste: Setores',
            className: 'btn-info',
            alertTitle: 'Carga de teste (Setores) concluída.',
            fields: ['setores', 'total'],
            run: (api) => api.seedSetores()
        },
        'enderecos.html': {
            page: 'enderecos.html',
            label: 'Popular teste: Baseamento',
            className: 'btn-info',
            alertTitle: 'Carga de teste (Baseamentos) concluída.',
            fields: ['locaisCadastrados', 'total'],
            run: (api) => api.seedBaseamentos()
        },
        'patrulhamento.html': {
            page: 'patrulhamento.html',
            label: 'Popular teste: Patrulhamento',
            className: 'btn-info',
            alertTitle: 'Carga de teste (Patrulhamento) concluída.',
            fields: ['pontosPatrulhamento', 'total'],
            run: (api) => api.seedPatrulhamentos()
        },
        'tipos_servico.html': {
            page: 'tipos_servico.html',
            label: 'Popular teste: Tipos de Serviço',
            className: 'btn-primary',
            alertTitle: 'Carga de teste (Tipos de Serviço) concluída.',
            fields: ['tiposServico', 'total'],
            run: (api) => api.seedTiposServicoDemo()
        },
        'os.html': {
            page: 'os.html',
            label: 'Popular teste: Ordens + Operações',
            className: 'btn-primary',
            alertTitle: 'Carga de teste (OS + Operações) concluída.',
            fields: ['cadastrosOperacoes', 'ordensServico', 'ordensAjustadas', 'total'],
            run: (api) => {
                const rOps = api.seedOperacoesEspeciais();
                const rOs = api.seedOrdensServicoDemo({ forcarTipoRecurso: 'Viatura' });
                return criarResumoComposto([{ data: rOps }, { data: rOs }]);
            }
        },
        'escalamento.html': {
            page: 'escalamento.html',
            label: 'Popular teste: Ativação',
            className: 'btn-success',
            infoText: 'Exemplo de ativação (carga de teste) entre os horários de 08:00 às 16:00.',
            alertTitle: 'Carga de teste (Ativação) concluída.',
            fields: ['cadastrosBase', 'tiposEOrdens', 'escalasAtivas', 'total'],
            run: (api) => api.seedAtivacoesComDependencias({
                somenteCarros: true,
                quantidade: 2,
                exemplos: [
                    { recursoChaveDemo: 'viatura_carro_1', osChaveDemo: 'os_viatura_zs_12h', tipoServicoIndex: 0, auxiliares: 1 },
                    { recursoChaveDemo: 'viatura_carro_4', osChaveDemo: 'os_moto_orla_8h', tipoServicoIndex: 3, auxiliares: 2 }
                ]
            })
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const page = getPageName();
        const config = PAGE_ACTIONS[page];
        if (!config) return;
        criarBotaoDemo(config);
    });
})();
