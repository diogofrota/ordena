/* Lógica do Menu Lateral (Sidebar) */

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function toggleSubmenu(element) {
    // Encontra a lista UL irmã do link clicado
    const submenu = element.nextElementSibling;
    
    if (submenu) {
        // Alterna a classe 'open' para mostrar/esconder
        submenu.classList.toggle('open');
        // Alterna a setinha (opcional)
        element.classList.toggle('active-link');
    }
}

// Fecha o menu se clicar no botão "Voltar" do navegador ou carregar a página
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
});