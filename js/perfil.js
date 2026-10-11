(() => {
    'use strict';

    const STORAGE_KEY_PERFIL_MOCK = 'ordenaPerfilMock';

    /*
     * Troque usarMock para false quando a API Flask estiver disponível.
     * Contratos previstos:
     * PATCH /api/me/telefone -> { telefone }
     * POST  /api/me/senha    -> { senhaAtual, novaSenha }
     * Em sessão Flask por cookie, injete o token em <meta name="csrf-token">.
     */
    const PERFIL_API_CONFIG = Object.freeze({
        usarMock: false,
        latenciaMockMs: 300,
        endpoints: Object.freeze({
            atualizarTelefone: '/api/me/telefone',
            alterarSenha: '/api/me/senha'
        }),
        csrf: Object.freeze({
            metaName: 'csrf-token',
            headerName: 'X-CSRFToken'
        })
    });

    let elementos = {};

    function aguardar(ms) {
        return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    function lerPerfilMock() {
        try {
            const dados = JSON.parse(OrdenaStorage.getItem(STORAGE_KEY_PERFIL_MOCK));
            return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
        } catch (erro) {
            console.warn('[ORDENA Perfil] Não foi possível ler os dados temporários.', erro);
            return {};
        }
    }

    function lerTelefoneMock() {
        const dados = lerPerfilMock();
        return typeof dados.telefone === 'string' ? dados.telefone : '';
    }

    function salvarPerfilMock(dadosParciais) {
        try {
            const dadosAtuais = lerPerfilMock();
            OrdenaStorage.setItem(STORAGE_KEY_PERFIL_MOCK, JSON.stringify({
                ...dadosAtuais,
                ...dadosParciais
            }));
        } catch (erro) {
            throw new Error('Não foi possível salvar os dados do perfil neste navegador.');
        }
    }

    function salvarTelefoneMock(telefone) {
        salvarPerfilMock({ telefone });
    }

    function obterTokenCsrf() {
        const meta = document.querySelector(`meta[name="${PERFIL_API_CONFIG.csrf.metaName}"]`);
        return meta ? meta.getAttribute('content') : '';
    }

    async function requisitarApi(url, options = {}) {
        const metodo = (options.method || 'GET').toUpperCase();
        const requisicaoDeAlteracao = !['GET', 'HEAD', 'OPTIONS'].includes(metodo);
        const csrfToken = requisicaoDeAlteracao ? obterTokenCsrf() : '';

        if (requisicaoDeAlteracao && !csrfToken) {
            throw new Error('Token de segurança CSRF não configurado.');
        }

        const resposta = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(csrfToken ? { [PERFIL_API_CONFIG.csrf.headerName]: csrfToken } : {}),
                ...(options.headers || {})
            }
        });

        const texto = await resposta.text();
        let dados = {};

        if (texto) {
            try {
                dados = JSON.parse(texto);
            } catch (erro) {
                dados = {};
            }
        }

        if (!resposta.ok) {
            const mensagem = dados.mensagem || dados.erro || 'Não foi possível concluir a operação.';
            throw new Error(mensagem);
        }

        return dados;
    }

    const perfilService = {
        async atualizarTelefone(telefone) {
            if (PERFIL_API_CONFIG.usarMock) {
                await aguardar(PERFIL_API_CONFIG.latenciaMockMs);
                salvarTelefoneMock(telefone);
                return { telefone, mensagem: 'Telefone atualizado com sucesso.' };
            }

            return requisitarApi(PERFIL_API_CONFIG.endpoints.atualizarTelefone, {
                method: 'PATCH',
                body: JSON.stringify({ telefone })
            });
        },

        async alterarSenha(payload) {
            if (PERFIL_API_CONFIG.usarMock) {
                await aguardar(PERFIL_API_CONFIG.latenciaMockMs);
                return { mensagem: 'Simulação concluída. Nenhuma senha real foi alterada.' };
            }

            return requisitarApi(PERFIL_API_CONFIG.endpoints.alterarSenha, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }
    };

    function capturarElementos() {
        elementos = {
            telefoneForm: document.getElementById('telefoneForm'),
            senhaForm: document.getElementById('senhaForm'),
            perfilFeedback: document.getElementById('perfilFeedback'),
            senhaFeedback: document.getElementById('senhaFeedback'),
            btnSalvarTelefone: document.getElementById('btnSalvarTelefone'),
            btnAlterarSenha: document.getElementById('btnAlterarSenha'),
            telefone: document.getElementById('telefone'),
            instituicaoPrefeitura: document.getElementById('instituicaoPrefeitura'),
            orgaoBatalhao: document.getElementById('orgaoBatalhao'),
            senhaAtual: document.getElementById('senhaAtual'),
            novaSenha: document.getElementById('novaSenha'),
            confirmarNovaSenha: document.getElementById('confirmarNovaSenha')
        };
    }

    function mostrarFeedback(elemento, tipo, mensagem) {
        elemento.textContent = mensagem;
        elemento.className = `profile-feedback is-visible ${tipo}`;
        elemento.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    }

    function limparFeedback(elemento) {
        elemento.textContent = '';
        elemento.className = 'profile-feedback';
        elemento.removeAttribute('role');
    }

    function definirBotaoProcessando(botao, processando, textoProcessando, textoPadrao) {
        botao.disabled = processando;
        botao.textContent = processando ? textoProcessando : textoPadrao;
        botao.setAttribute('aria-busy', String(processando));
        if (processando) window.OrdenaApi.feedback(textoProcessando, 'info', true);
    }

    function limparValidacaoSenha() {
        [elementos.senhaAtual, elementos.novaSenha, elementos.confirmarNovaSenha]
            .forEach(campo => campo.removeAttribute('aria-invalid'));
    }

    function limparCamposSenha() {
        elementos.senhaForm.reset();
        limparValidacaoSenha();
    }

    function sincronizarIdentidadeMock() {
        const instituicaoPrefeitura = elementos.instituicaoPrefeitura.value.trim();
        const orgaoBatalhao = elementos.orgaoBatalhao.value.trim();

        try {
            salvarPerfilMock({ instituicaoPrefeitura, orgaoBatalhao });
        } catch (erro) {
            console.warn('[ORDENA Perfil] Não foi possível sincronizar os dados institucionais.', erro);
        }
    }

    async function salvarTelefone(evento) {
        evento.preventDefault();
        if (elementos.btnSalvarTelefone.disabled) return;

        const telefone = elementos.telefone.value.trim();
        limparFeedback(elementos.perfilFeedback);

        if (!telefone) {
            mostrarFeedback(elementos.perfilFeedback, 'error', 'Informe o telefone antes de salvar.');
            elementos.telefone.setAttribute('aria-invalid', 'true');
            elementos.telefone.focus();
            return;
        }

        elementos.telefone.removeAttribute('aria-invalid');

        definirBotaoProcessando(elementos.btnSalvarTelefone, true, 'Salvando...', 'Salvar telefone');

        try {
            const resposta = await perfilService.atualizarTelefone(telefone);
            elementos.telefone.value = resposta.telefone || telefone;
            window.OrdenaApi.feedback(resposta.mensagem, 'success');
            mostrarFeedback(
                elementos.perfilFeedback,
                'success',
                resposta.mensagem || 'Telefone atualizado com sucesso.'
            );
        } catch (erro) {
            window.OrdenaApi.feedback(erro.message, 'error');
            mostrarFeedback(
                elementos.perfilFeedback,
                'error',
                erro.message || 'Não foi possível atualizar o telefone.'
            );
        } finally {
            definirBotaoProcessando(elementos.btnSalvarTelefone, false, 'Salvando...', 'Salvar telefone');
        }
    }

    async function alterarSenha(evento) {
        evento.preventDefault();
        if (elementos.btnAlterarSenha.disabled) return;

        const senhaAtual = elementos.senhaAtual.value;
        const novaSenha = elementos.novaSenha.value;
        const confirmarNovaSenha = elementos.confirmarNovaSenha.value;
        limparFeedback(elementos.senhaFeedback);
        limparValidacaoSenha();

        if (!senhaAtual.trim() || !novaSenha.trim() || !confirmarNovaSenha.trim()) {
            mostrarFeedback(elementos.senhaFeedback, 'error', 'Preencha todos os campos obrigatórios.');
            const primeiroVazio = [elementos.senhaAtual, elementos.novaSenha, elementos.confirmarNovaSenha]
                .find(campo => !campo.value.trim());
            primeiroVazio.setAttribute('aria-invalid', 'true');
            primeiroVazio.focus();
            return;
        }

        if (novaSenha !== confirmarNovaSenha) {
            mostrarFeedback(elementos.senhaFeedback, 'error', 'A nova senha e a confirmação precisam ser iguais.');
            elementos.confirmarNovaSenha.setAttribute('aria-invalid', 'true');
            elementos.confirmarNovaSenha.focus();
            return;
        }

        definirBotaoProcessando(elementos.btnAlterarSenha, true, 'Alterando...', 'Alterar senha');

        try {
            const resposta = await perfilService.alterarSenha({ senhaAtual, novaSenha });
            limparCamposSenha();
            window.ORDENA_BOOT.perfil.senhaTemporaria = false;
            window.OrdenaApi.feedback(resposta.mensagem, 'success');
            mostrarFeedback(
                elementos.senhaFeedback,
                'success',
                resposta.mensagem || 'Senha alterada com sucesso.'
            );
        } catch (erro) {
            window.OrdenaApi.feedback(erro.message, 'error');
            mostrarFeedback(
                elementos.senhaFeedback,
                'error',
                erro.message || 'Não foi possível alterar a senha.'
            );
            limparCamposSenha();
            elementos.senhaAtual.focus();
        } finally {
            definirBotaoProcessando(elementos.btnAlterarSenha, false, 'Alterando...', 'Alterar senha');
        }
    }

    function inicializarPagina() {
        capturarElementos();
        const perfil = window.ORDENA_BOOT.perfil;
        elementos.telefone.value = perfil.telefone;
        for (const [id, value] of Object.entries({ nomeCompleto: perfil.nome, email: perfil.email, instituicaoPrefeitura: perfil.instituicaoPrefeitura, orgaoBatalhao: perfil.orgaoBatalhao, perfilAcesso: perfil.perfilAcesso })) {
            document.getElementById(id).value = value;
        }
        // Legado: sincronizarIdentidadeMock();
        if (perfil.senhaTemporaria) mostrarFeedback(elementos.senhaFeedback, 'error', 'Primeiro acesso: altere sua senha temporária para liberar as funcionalidades. Use de 12 a 128 caracteres.');
        elementos.telefoneForm.addEventListener('submit', salvarTelefone);
        elementos.senhaForm.addEventListener('submit', alterarSenha);
        elementos.telefoneForm.addEventListener('input', () => {
            limparFeedback(elementos.perfilFeedback);
            elementos.telefone.removeAttribute('aria-invalid');
        });
        elementos.senhaForm.addEventListener('input', evento => {
            limparFeedback(elementos.senhaFeedback);
            evento.target.removeAttribute('aria-invalid');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarPagina);
    } else {
        inicializarPagina();
    }
})();
