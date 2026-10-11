document.getElementById('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    if (button.disabled) return;
    const feedback = document.getElementById('loginFeedback');
    button.disabled = true;
    button.textContent = 'Entrando...';
    feedback.className = 'chart-loading';
    feedback.innerHTML = '<span>Autenticando...</span><span class="growing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
    try {
        const response = await fetch('/login', { method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content },
            body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.mensagem || 'Não foi possível entrar.');
        feedback.textContent = data.mensagem;
        window.location.assign(data.destino);
    } catch (error) {
        feedback.className = 'chart-loading is-error';
        feedback.textContent = error.message;
        feedback.setAttribute('role', 'alert');
        button.disabled = false;
        button.textContent = 'Entrar';
    }
});
