(() => {
    'use strict';

    const STORAGE_KEY_PERFIL = 'ordenaPerfilMock';
    const IDENTIDADE_PADRAO = Object.freeze({
        instituicaoPrefeitura: 'Prefeitura Municipal de Demonstração',
        orgaoBatalhao: 'Secretaria de Segurança Pública'
    });

    function normalizarTexto(valor, fallback) {
        const texto = typeof valor === 'string' ? valor.trim() : '';
        return texto || fallback;
    }

    function obterIdentidadePerfil() {
        try {
            const dados = JSON.parse(OrdenaStorage.getItem(STORAGE_KEY_PERFIL));
            const perfil = dados && typeof dados === 'object' && !Array.isArray(dados)
                ? dados
                : {};

            return {
                instituicaoPrefeitura: normalizarTexto(
                    perfil.instituicaoPrefeitura,
                    IDENTIDADE_PADRAO.instituicaoPrefeitura
                ),
                orgaoBatalhao: normalizarTexto(
                    perfil.orgaoBatalhao,
                    IDENTIDADE_PADRAO.orgaoBatalhao
                )
            };
        } catch (erro) {
            console.warn('[ORDENA Impressão] Não foi possível ler a identidade do perfil.', erro);
            return { ...IDENTIDADE_PADRAO };
        }
    }

    function preencherCabecalhosImpressao() {
        const identidade = obterIdentidadePerfil();

        document.querySelectorAll('[data-perfil-instituicao]').forEach(elemento => {
            elemento.textContent = identidade.instituicaoPrefeitura;
        });

        document.querySelectorAll('[data-perfil-orgao]').forEach(elemento => {
            elemento.textContent = identidade.orgaoBatalhao;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', preencherCabecalhosImpressao);
    } else {
        preencherCabecalhosImpressao();
    }
})();
