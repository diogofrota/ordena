/* Lógica e conteúdo compartilhado do Menu Lateral (Sidebar) */

const MENU_PADRAO = [
    { texto: 'Início', href: 'index.html' },
    { texto: 'Cadastro de Viaturas', href: 'cadastro.html' },
    { texto: 'Local de Baseamento', href: 'enderecos.html' },
    { texto: 'Local de Patrulhamento', href: 'patrulhamento.html' },
    { texto: 'Ordens de Serviço', href: 'os.html' },
    { texto: 'Tipos de Serviço', href: 'tipos_servico.html' },
    { texto: 'Operações Especiais', href: 'operacoes_especiais.html' },
    { texto: 'Ativação do Serviço', href: 'escalamento.html' },
    { texto: 'Histórico de Ativações', href: 'historico.html' },
    { texto: 'Meu Perfil', href: 'perfil.html' }
];

function obterPaginaAtual() {
    const pagina = (window.location.pathname || '').split('/').pop();
    const paginaAtual = pagina || 'index.html';

    if (paginaAtual === 'cadastro_viatura.html') {
        return 'cadastro.html';
    }

    if (paginaAtual === 'cadastro_policial.html') {
        return 'policiais.html';
    }

    if (paginaAtual === 'cadastro_tipo_servico.html') {
        return 'tipos_servico.html';
    }

    if (paginaAtual === 'cadastro_baseamento.html') {
        return 'enderecos.html';
    }

    if (paginaAtual === 'cadastro_patrulhamento.html') {
        return 'patrulhamento.html';
    }

    if (paginaAtual === 'cadastro_os.html') {
        return 'os.html';
    }

    if (paginaAtual === 'cadastro_operacao_especial.html'
        || paginaAtual === 'pontos_operacao_especial.html'
        || paginaAtual === 'detalhes_operacao_especial.html'
        || paginaAtual === 'avaliacoes_operacao_especial.html'
        || paginaAtual === 'cadastro_avaliacao_operacao_especial.html') {
        return 'operacoes_especiais.html';
    }

    return paginaAtual;
}

function criarLinkMenu(item, paginaAtual) {
    const paginaAtiva = item.href === paginaAtual;
    const classeAtiva = paginaAtiva ? ' class="current-page"' : '';
    const paginaCorrente = paginaAtiva ? ' aria-current="page"' : '';

    return `<li><a href="${item.href}"${classeAtiva}${paginaCorrente}>${item.texto}</a></li>`;
}

function criarItemMenu(item, paginaAtual) {
    if (!item.filhos) {
        return criarLinkMenu(item, paginaAtual);
    }

    const submenuAberto = item.filhos.some(filho => filho.href === paginaAtual);
    const classeLink = submenuAberto ? ' class="active-link"' : '';
    const classeSubmenu = submenuAberto ? 'submenu open' : 'submenu';
    const links = item.filhos.map(filho => criarLinkMenu(filho, paginaAtual)).join('');

    return `
        <li class="has-submenu">
            <a href="javascript:void(0)" onclick="toggleSubmenu(this)"${classeLink} aria-expanded="${submenuAberto}">${item.texto} ▾</a>
            <ul class="${classeSubmenu}">${links}</ul>
        </li>`;
}

function renderizarMenuPadrao() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const paginaAtual = obterPaginaAtual();
    const itens = MENU_PADRAO.map(item => criarItemMenu(item, paginaAtual)).join('');

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <span id="menu-title">MENU</span>
            <button type="button" class="close-btn" onclick="toggleSidebar()" aria-label="Fechar Menu">✕</button>
        </div>
        <ul class="sidebar-menu">${itens}</ul>`;

    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    sidebar.setAttribute('aria-labelledby', 'menu-title');
}

let ultimoBotaoMenu = null;

function prepararControlesMenu() {
    document.querySelectorAll('.menu-toggle').forEach(botao => {
        const logo = botao.closest('nav')?.querySelector('.logo');
        if (logo && logo.previousElementSibling !== botao) {
            logo.before(botao);
        }

        botao.type = 'button';
        botao.setAttribute('aria-controls', 'sidebar');
        botao.setAttribute('aria-expanded', 'false');
        botao.setAttribute('aria-label', 'Abrir menu de navegação');
    });

    const botaoFechar = document.querySelector('#sidebar .close-btn');
    if (botaoFechar) {
        botaoFechar.type = 'button';
        botaoFechar.setAttribute('aria-label', 'Fechar menu de navegação');
    }

    document.querySelectorAll('.has-submenu > a').forEach((controle, indice) => {
        const submenu = controle.nextElementSibling;
        if (!submenu) return;

        const submenuId = `submenu-${indice + 1}`;
        const submenuAberto = submenu.classList.contains('open');

        submenu.id = submenuId;
        controle.setAttribute('role', 'button');
        controle.setAttribute('aria-controls', submenuId);
        atualizarAcessibilidadeSubmenu(controle, submenuAberto);

        controle.addEventListener('keydown', evento => {
            if (evento.key === ' ') {
                evento.preventDefault();
                toggleSubmenu(controle);
            }
        });
    });
}

function atualizarAcessibilidadeSubmenu(controle, submenuAberto) {
    const submenu = controle.nextElementSibling;
    if (!submenu) return;

    controle.setAttribute('aria-expanded', String(submenuAberto));
    submenu.setAttribute('aria-hidden', String(!submenuAberto));
    submenu.toggleAttribute('inert', !submenuAberto);
}

function atualizarEstadoMenu(menuAberto) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (!sidebar || !overlay) return;

    sidebar.classList.toggle('active', menuAberto);
    sidebar.setAttribute('aria-hidden', String(!menuAberto));
    sidebar.toggleAttribute('inert', !menuAberto);
    overlay.classList.toggle('active', menuAberto);
    document.body.classList.toggle('menu-open', menuAberto);

    document.querySelectorAll('.menu-toggle').forEach(botao => {
        botao.setAttribute('aria-expanded', String(menuAberto));
        botao.setAttribute('aria-label', menuAberto
            ? 'Fechar menu de navegação'
            : 'Abrir menu de navegação');
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (sidebar && overlay) {
        const menuAberto = !sidebar.classList.contains('active');

        if (menuAberto && document.activeElement?.classList.contains('menu-toggle')) {
            ultimoBotaoMenu = document.activeElement;
        }

        atualizarEstadoMenu(menuAberto);

        if (menuAberto) {
            window.requestAnimationFrame(() => {
                document.querySelector('#sidebar .close-btn')?.focus();
            });
        } else if (ultimoBotaoMenu) {
            ultimoBotaoMenu.focus();
        }
    }
}

function toggleSubmenu(element) {
    const submenu = element.nextElementSibling;

    if (submenu) {
        const submenuAberto = submenu.classList.toggle('open');
        element.classList.toggle('active-link', submenuAberto);
        atualizarAcessibilidadeSubmenu(element, submenuAberto);
    }
}

function manterFocoNoMenu(evento, sidebar) {
    if (evento.key !== 'Tab' || !sidebar.classList.contains('active')) return;

    const elementosFocaveis = Array.from(
        sidebar.querySelectorAll('button:not([disabled]), a[href]')
    ).filter(elemento => !elemento.closest('[inert]'));

    if (!elementosFocaveis.length) return;

    const primeiroElemento = elementosFocaveis[0];
    const ultimoElemento = elementosFocaveis[elementosFocaveis.length - 1];

    if (evento.shiftKey && document.activeElement === primeiroElemento) {
        evento.preventDefault();
        ultimoElemento.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimoElemento) {
        evento.preventDefault();
        primeiroElemento.focus();
    }
}

function inicializarMenu() {
    renderizarMenuPadrao();
    prepararControlesMenu();

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar && overlay) atualizarEstadoMenu(false);

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && sidebar?.classList.contains('active')) {
            toggleSidebar();
            return;
        }

        if (sidebar) manterFocoNoMenu(evento, sidebar);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarMenu, { once: true });
} else {
    inicializarMenu();
}
