import hashlib
import json
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit
from flask import Blueprint, request, session, g, jsonify, redirect, render_template, send_from_directory, current_app
from flask_wtf.csrf import generate_csrf
from sqlalchemy import select, delete
from werkzeug.security import generate_password_hash, check_password_hash
from .config import ROOT
from .models import db, Usuario, Prefeitura, Secretaria, Sessao, LimiteLogin, Auditoria
from .services import snapshot, save_changes, BusinessError

routes = Blueprint('ordena', __name__)
DUMMY_HASH = generate_password_hash(secrets.token_urlsafe(32), method='pbkdf2:sha256:1000000')


def error(message, code=400):
    return jsonify(mensagem=message), code


def safe_next(value):
    if not isinstance(value, str) or '\\' in value or any(ord(c) < 32 for c in value):
        return '/templates/index.html'
    url = urlsplit(value)
    if url.scheme or url.netloc or not url.path.startswith('/templates/') or url.path.startswith('//'):
        return '/templates/index.html'
    if Path(url.path).name not in {p.name for p in (ROOT / 'templates').glob('*.html')}:
        return '/templates/index.html'
    return value


def authenticate():
    if request.path in {'/login', '/healthz', '/css/style.css', '/assets/images/ordenar.png', '/js/login.js'}:
        return None
    sid = session.get('sid', '')
    login_session = db.session.get(Sessao, hashlib.sha256(sid.encode()).hexdigest()) if sid else None
    user = db.session.get(Usuario, login_session.usuario_id) if login_session and login_session.expira_em > datetime.utcnow() else None
    if not user or not user.ativo or session.get('version') != user.sessao_versao:
        session.clear()
        if request.path.startswith('/api/'):
            return error('Autenticação necessária.', 401)
        return redirect('/login?next=' + request.path)
    g.user = user
    allowed = {'/api/me', '/api/me/senha', '/api/me/telefone', '/templates/perfil.html', '/logout'}
    if user.senha_temporaria and request.path not in allowed and not request.path.startswith(('/js/', '/css/', '/assets/')):
        if request.path.startswith('/api/'):
            return error('Altere a senha temporária antes de acessar os dados.', 403)
        return redirect('/templates/perfil.html')


def profile(user):
    return dict(id=user.id, nome=user.nome, email=user.email, telefone=user.telefone,
                instituicaoPrefeitura=db.session.get(Prefeitura, user.prefeitura_id).nome,
                orgaoBatalhao=db.session.get(Secretaria, user.secretaria_id).nome,
                prefeitura_id=user.prefeitura_id, senhaTemporaria=user.senha_temporaria,
                perfilAcesso='Usuário')


def count_attempt(key, maximum):
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    now = datetime.utcnow()
    key = hashlib.sha256(key.encode()).hexdigest()
    factory = pg_insert if db.engine.dialect.name == 'postgresql' else sqlite_insert
    stmt = factory(LimiteLogin).values(chave=key, tentativas=1, inicio=now)
    from sqlalchemy import case
    expired = LimiteLogin.inicio < now - timedelta(minutes=15)
    stmt = stmt.on_conflict_do_update(index_elements=['chave'], set_={
        'tentativas': case((expired, 1), else_=LimiteLogin.tentativas + 1),
        'inicio': case((expired, now), else_=LimiteLogin.inicio)})
    db.session.execute(stmt)
    db.session.commit()
    row = db.session.get(LimiteLogin, key, populate_existing=True)
    return row.tentativas <= maximum


@routes.route('/healthz')
def health():
    return jsonify(status='ok')


@routes.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html', next_url=safe_next(request.args.get('next')), csrf=generate_csrf())
    data = request.get_json(silent=True) or request.form
    if not hasattr(data, 'get'):
        return error('Dados de login inválidos.')
    email = str(data.get('email', '')).strip().lower()[:254]
    password = str(data.get('senha', ''))
    allowed_ip = count_attempt('ip:' + (request.remote_addr or ''), 30)
    allowed_email = count_attempt('email:' + email, 10)
    if not allowed_ip or not allowed_email:
        return error('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429)
    user = db.session.scalar(select(Usuario).where(Usuario.email == email))
    valid = check_password_hash(user.senha_hash if user else DUMMY_HASH, password[:1024])
    if not user or not user.ativo or not valid or len(password) > 1024:
        return error('E-mail ou senha inválidos.', 401)
    session.clear()
    sid = secrets.token_urlsafe(48)
    session.update(sid=sid, version=user.sessao_versao)
    session.permanent = True
    db.session.add(Sessao(id=hashlib.sha256(sid.encode()).hexdigest(), usuario_id=user.id,
                          expira_em=datetime.utcnow() + timedelta(hours=8)))
    db.session.commit()
    return jsonify(mensagem='Login realizado com sucesso.', destino='/templates/perfil.html' if user.senha_temporaria else safe_next(data.get('next')))


@routes.route('/logout', methods=['POST'])
def logout():
    sid = session.get('sid', '')
    db.session.execute(delete(Sessao).where(Sessao.id == hashlib.sha256(sid.encode()).hexdigest()))
    db.session.commit()
    session.clear()
    return jsonify(mensagem='Sessão encerrada com sucesso.', destino='/login')


@routes.route('/')
@routes.route('/index.html')
def home():
    return redirect('/templates/index.html')


@routes.route('/templates/<name>')
def page(name):
    path = ROOT / 'templates' / name
    if not name.endswith('.html') or Path(name).name != name or not path.is_file() or name == 'login.html':
        return error('Página não encontrada.', 404)
    user = g.user
    version = db.session.get(Prefeitura, user.prefeitura_id).versao
    data = dict(colecoes=snapshot(user.prefeitura_id) if not user.senha_temporaria else {},
                versao=version, perfil=profile(user))
    serialized = json.dumps(data, ensure_ascii=True).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    boot = f'<meta name="csrf-token" content="{generate_csrf()}"><script>window.ORDENA_BOOT={serialized};</script><script src="/js/api_storage.js"></script>'
    html = path.read_text().replace('<head>', '<head>\n' + boot, 1)
    return current_app.response_class(html, mimetype='text/html')


@routes.route('/js/<path:name>')
def scripts(name):
    return send_from_directory(ROOT / 'js', name)


@routes.route('/css/<path:name>')
def styles(name):
    return send_from_directory(ROOT / 'css', name)


@routes.route('/assets/<path:name>')
def assets(name):
    return send_from_directory(ROOT / 'assets', name)


@routes.route('/api/dados', methods=['GET', 'PATCH'])
def data_api():
    if request.method == 'GET':
        version = db.session.get(Prefeitura, g.user.prefeitura_id).versao
        return jsonify(colecoes=snapshot(g.user.prefeitura_id), versao=version)
    try:
        version = save_changes(g.user, request.get_json(silent=True))
        return jsonify(versao=version, mensagem='Dados salvos com sucesso.')
    except BusinessError as exc:
        db.session.rollback()
        if str(exc) == 'CONFLICT':
            return error('Os dados foram alterados em outra sessão. Atualize a página antes de salvar.', 409)
        return error(str(exc))


@routes.route('/api/me')
def me():
    return jsonify(profile(g.user))


@routes.route('/api/me/telefone', methods=['PATCH'])
def phone():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return error('Dados de telefone inválidos.')
    value = data.get('telefone', '')
    import re
    if not isinstance(value, str) or not re.fullmatch(r'[0-9()+ .-]{8,20}', value):
        return error('Informe um telefone válido (8 a 20 caracteres).')
    g.user.telefone = value
    db.session.commit()
    return jsonify(telefone=value, mensagem='Telefone atualizado com sucesso.')


@routes.route('/api/me/senha', methods=['POST'])
def password():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return error('Dados de senha inválidos.')
    old, new = data.get('senhaAtual', ''), data.get('novaSenha', '')
    if not count_attempt('password:' + str(g.user.id), 10):
        return error('Muitas tentativas. Aguarde 15 minutos.', 429)
    if not isinstance(old, str) or not isinstance(new, str) or len(old) > 1024 or not check_password_hash(g.user.senha_hash, old):
        return error('Senha atual inválida.')
    if len(new) < 12 or len(new) > 128 or old == new:
        return error('Use uma nova senha diferente, de 12 a 128 caracteres.')
    g.user.senha_hash = generate_password_hash(new, method='pbkdf2:sha256:1000000')
    g.user.senha_temporaria = False
    g.user.sessao_versao += 1
    db.session.execute(delete(Sessao).where(Sessao.usuario_id == g.user.id))
    sid = secrets.token_urlsafe(48)
    session.update(sid=sid, version=g.user.sessao_versao)
    db.session.add(Sessao(id=hashlib.sha256(sid.encode()).hexdigest(), usuario_id=g.user.id, expira_em=datetime.utcnow() + timedelta(hours=8)))
    db.session.add(Auditoria(prefeitura_id=g.user.prefeitura_id, usuario_id=g.user.id,
                             criado_em=datetime.utcnow(), acao='alterar_senha', colecoes=[]))
    db.session.commit()
    return jsonify(mensagem='Senha alterada com sucesso. Acesse Início pelo menu.')
