/* Adaptador de compatibilidade: banco no servidor, cache apenas em memória. */
(() => {
    'use strict';
    const boot = window.ORDENA_BOOT;
    if (!boot) return;
    const cache = new Map(Object.entries(boot.colecoes).map(([key, value]) => [key, JSON.stringify(value)]));
    cache.set('ordenaPerfilMock', JSON.stringify(boot.perfil));
    const temporary = new Set(['osImpressaoTemp', 'ativacaoImpressaoTemp', 'historicoImpressaoTemp', 'operacaoOsImpressaoTemp']);
    const prefix = `ordena:${boot.perfil.prefeitura_id}:${boot.perfil.id}:`;
    let busy = false;
    const csrf = () => document.querySelector('meta[name="csrf-token"]').content;
    let panel;
    function feedback(message, type, loading = false) {
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'apiFeedback';
            document.body.append(panel);
        }
        panel.className = `api-feedback ${type}`;
        panel.setAttribute('role', type === 'error' ? 'alert' : 'status');
        panel.replaceChildren();
        const text = document.createElement('span');
        text.textContent = message;
        panel.append(text);
        if (loading) {
            const dots = document.createElement('span');
            dots.className = 'growing-dots';
            dots.innerHTML = '<span></span><span></span><span></span>';
            dots.setAttribute('aria-hidden', 'true');
            panel.append(dots);
        }
    }
    async function request(url, options = {}) {
        const response = await fetch(url, { credentials: 'same-origin', ...options,
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf(), ...(options.headers || {}) } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensagem || 'Não foi possível concluir a operação.');
        return data;
    }
    async function setMany(changes) {
        if (busy) throw new Error('Aguarde a operação em andamento.');
        busy = true;
        const buttons = [...document.querySelectorAll('button, input[type="submit"]')].map(button => [button, button.disabled]);
        const action = buttons.find(([button, disabled]) => button === document.activeElement && !disabled && !button.children.length)?.[0];
        const label = action?.textContent;
        if (action) { action.textContent = 'Salvando...'; action.setAttribute('aria-busy', 'true'); }
        buttons.forEach(([button]) => { button.disabled = true; });
        document.body.classList.add('api-processing');
        feedback('Salvando dados...', 'info', true);
        try {
            const result = await request('/api/dados', { method: 'PATCH', body: JSON.stringify({ versao: boot.versao, colecoes: changes }) });
            boot.versao = result.versao;
            for (const [key, value] of Object.entries(changes)) cache.set(key, JSON.stringify(value));
            feedback(result.mensagem, 'success');
            return result;
        } catch (error) {
            feedback(error.message, 'error');
            throw error;
        } finally {
            if (action) { action.textContent = label; action.removeAttribute('aria-busy'); }
            buttons.forEach(([button, disabled]) => { button.disabled = disabled; });
            document.body.classList.remove('api-processing');
            busy = false;
        }
    }
    window.OrdenaStorage = {
        get length() { return cache.size; },
        key(index) { return [...cache.keys()][index] || null; },
        getItem(key) { return temporary.has(key) ? sessionStorage.getItem(prefix + key) : cache.get(key) ?? null; },
        setCached(key, value) {
            if (temporary.has(key)) sessionStorage.setItem(prefix + key, value);
            else cache.set(key, value);
        },
        async setItem(key, value) {
            if (temporary.has(key)) { sessionStorage.setItem(prefix + key, value); return; }
            if (key === 'ordenaPerfilMock') { cache.set(key, value); return; }
            return setMany({ [key]: JSON.parse(value) });
        },
        setMany,
        clear() { throw new Error('A limpeza do banco pela interface está desabilitada. Utilize inativação.'); }
    };
    window.OrdenaApi = { request, feedback };
    window.addEventListener('beforeunload', event => {
        if (busy) { event.preventDefault(); event.returnValue = ''; }
    });
    document.addEventListener('click', event => {
        if (busy) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('submit', event => {
        if (busy) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('DOMContentLoaded', () => {
        const logout = document.createElement('button');
        logout.className = 'btn-danger';
        logout.textContent = 'Sair';
        logout.type = 'button';
        document.querySelector('nav')?.append(logout);
        logout.addEventListener('click', async () => {
            logout.disabled = true;
            logout.textContent = 'Saindo...';
            feedback('Encerrando sessão...', 'info', true);
            try {
                const result = await request('/logout', { method: 'POST', body: '{}' });
                try {
                    for (let i = sessionStorage.length - 1; i >= 0; i--) {
                        const key = sessionStorage.key(i);
                        if (key.startsWith(prefix)) sessionStorage.removeItem(key);
                    }
                } catch (storageError) {
                    console.warn('A sessão foi encerrada; não foi possível limpar os dados temporários de impressão.');
                }
                feedback(result.mensagem, 'success');
                window.location.assign(result.destino);
            } catch (error) {
                feedback(error.message, 'error');
                logout.disabled = false;
                logout.textContent = 'Sair';
            }
        });
    });
})();
