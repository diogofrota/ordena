"""Testes em banco temporário: migrações, segurança, isolamento e fluxos reais."""
import os
import re
from pathlib import Path
import pytest
from sqlalchemy import select, inspect
from werkzeug.security import generate_password_hash, check_password_hash
from backend import create_app
from backend.models import db, Usuario, Prefeitura, MODELS, Sessao

TEMP = 'Senha-temporaria-2026'
NEW = 'Nova-senha-segura-2026'


@pytest.fixture
def app(tmp_path):
    # ORDENA_TEST_DATABASE_URL deve apontar exclusivamente para banco descartável.
    url = os.getenv('ORDENA_TEST_DATABASE_URL', 'sqlite:///' + str(tmp_path / 'test.db'))
    if os.getenv('ORDENA_TEST_DATABASE_URL') and 'ordena_test' not in url:
        pytest.fail('Banco PostgreSQL de teste deve conter ordena_test no nome.')
    app = create_app({'SQLALCHEMY_DATABASE_URI': url, 'WTF_CSRF_ENABLED': True})
    runner = app.test_cli_runner()
    result = runner.invoke(args=['db-upgrade'])
    assert result.exit_code == 0, result.output
    # Para rodar novamente no PostgreSQL use um banco vazio por execução.
    with app.app_context():
        existing = db.session.scalar(select(Usuario).where(Usuario.email == 'a@example.test'))
    if existing is None:
        for city, email in [('Prefeitura A', 'a@example.test'), ('Prefeitura B', 'b@example.test')]:
            result = runner.invoke(args=['admin-cadastrar'], input=f'{city}\nSecretaria de Segurança\nOperador\n{email}\n{TEMP}\n{TEMP}\n')
            assert result.exit_code == 0, result.output
    # Os testes PostgreSQL usam savepoints? Não: restaura somente o banco descartável explicitamente nomeado.
    if os.getenv('ORDENA_TEST_DATABASE_URL'):
        with app.app_context():
            for model in reversed(list(MODELS.values())):
                db.session.query(model).delete()
            from backend.models import Auditoria, LimiteLogin
            db.session.query(Auditoria).delete()
            db.session.query(Sessao).delete()
            db.session.query(LimiteLogin).delete()
            for u in db.session.scalars(select(Usuario)):
                u.senha_hash = generate_password_hash(TEMP, method='pbkdf2:sha256:1000000')
                u.senha_temporaria, u.ativo, u.sessao_versao = True, True, 0
            for p in db.session.scalars(select(Prefeitura)):
                p.versao = 0
            db.session.commit()
    yield app
    with app.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


def token(client, path='/login'):
    text = client.get(path).text
    return re.search(r'name="csrf-token" content="([^"]+)"', text).group(1)


def login(client, email='a@example.test', password=TEMP, next_url=None):
    csrf = token(client)
    return client.post('/login', json={'email': email, 'senha': password, 'next': next_url}, headers={'X-CSRFToken': csrf})


def activated(client, email='a@example.test'):
    assert login(client, email).status_code == 200
    csrf = token(client, '/templates/perfil.html')
    assert client.post('/api/me/senha', json={'senhaAtual': TEMP, 'novaSenha': NEW}, headers={'X-CSRFToken': csrf}).status_code == 200
    return csrf


def save(client, csrf, collections, version=None):
    if version is None:
        version = client.get('/api/dados').json['versao']
    return client.patch('/api/dados', json={'versao': version, 'colecoes': collections}, headers={'X-CSRFToken': csrf})


def test_migrations_and_initial_registration(app):
    with app.app_context():
        assert set(['prefeituras', 'secretarias', 'usuarios', 'sessoes', 'auditoria', 'alembic_version']) <= set(inspect(db.engine).get_table_names())
        user = db.session.scalar(select(Usuario).where(Usuario.email == 'a@example.test'))
        assert user.senha_hash != TEMP
        assert check_password_hash(user.senha_hash, TEMP)
        assert user.senha_temporaria
    result = app.test_cli_runner().invoke(args=['db-upgrade'])
    assert result.exit_code == 0
    assert app.test_cli_runner().invoke(args=['admin-listar']).exit_code == 0


@pytest.mark.parametrize('path', ['/', '/index.html', '/templates/index.html', '/templates/os.html', '/js/os.js', '/api/dados', '/api/me'])
def test_protected_routes(client, path):
    response = client.get(path)
    assert response.status_code == (401 if path.startswith('/api/') else 302)


def test_login_invalid_generic_and_csrf(client):
    assert client.post('/login', json={'email': 'a@example.test', 'senha': TEMP}).status_code == 400
    absent = login(client, 'absent@example.test').json
    wrong = login(client, password='wrong').json
    assert absent == wrong == {'mensagem': 'E-mail ou senha inválidos.'}


def test_first_access_password_logout_and_session_revocation(app, client):
    assert login(client, next_url='https://evil.example').json['destino'] == '/templates/perfil.html'
    assert client.get('/api/dados').status_code == 403
    assert client.get('/templates/index.html').location.endswith('/templates/perfil.html')
    csrf = token(client, '/templates/perfil.html')
    assert client.post('/api/me/senha', json={'senhaAtual': 'wrong', 'novaSenha': NEW}, headers={'X-CSRFToken': csrf}).status_code == 400
    assert client.post('/api/me/senha', json={'senhaAtual': TEMP, 'novaSenha': 'short'}, headers={'X-CSRFToken': csrf}).status_code == 400
    old_cookie = client.get_cookie('session').value
    assert client.post('/api/me/senha', json={'senhaAtual': TEMP, 'novaSenha': NEW}, headers={'X-CSRFToken': csrf}).status_code == 200
    stolen = app.test_client()
    stolen.set_cookie('session', old_cookie)
    assert stolen.get('/api/dados').status_code == 401
    assert client.get('/api/dados').status_code == 200
    assert client.post('/logout', headers={'X-CSRFToken': csrf}).status_code == 200
    assert client.get('/api/dados').status_code == 401
    assert login(client, password=TEMP).status_code == 401
    assert login(client, password=NEW, next_url='//evil.test').json['destino'] == '/templates/index.html'


def test_limiter_persists_across_clients(app, client):
    for _ in range(10):
        assert login(client, password='wrong').status_code == 401
    other = app.test_client()
    assert login(other, password='wrong').status_code == 429


def test_isolation_persistence_conflicts_and_csrf(app, client):
    csrf = activated(client)
    row = {'prefixo': 'V01', 'modelo': 'Modelo', 'placa': 'ABC1234', 'tipo': 'Carro', 'status': 'Ativa'}
    assert client.patch('/api/dados', json={'versao': 0, 'colecoes': {'viaturas': [row]}}).status_code == 400
    assert save(client, csrf, {'viaturas': [row]}, 0).status_code == 200
    assert save(client, csrf, {'viaturas': [row]}, 0).status_code == 409
    assert save(client, csrf, {'viaturas': []}).status_code == 400
    assert client.get('/api/dados').json['colecoes']['viaturas'] == [row]
    other = app.test_client()
    activated(other, 'b@example.test')
    assert other.get('/api/dados').json['colecoes']['viaturas'] == []
    assert 'V01' not in other.get('/templates/index.html').text
    with app.app_context():
        assert db.session.scalar(select(MODELS['viaturas'])).dados == row


def test_operational_collections_activation_and_atomic_close(app, client):
    csrf = activated(client)
    data = {
        'viaturas': [{'prefixo': 'V1', 'modelo': 'Teste', 'placa': 'ABC1234'}],
        'policiais': [{'id': 'p1', 'nomeGuerra': 'Operador', 'rg': '123'}],
        'cabines': [{'codigo': 'C1', 'nome': 'Cabine'}],
        'setores': [{'codigo': 'S1', 'nome': 'Setor'}],
        'locaisCadastrados': [{'id': 1, 'apelido': 'Praça', 'lat': -3.7, 'lng': -38.5}],
        'pontosPatrulhamento': [{'id': 2, 'apelido': 'Área', 'poligono': []}],
        'tiposServico': [{'nome': 'Patrulhamento'}],
        'ordensServico': [{'numero': 1, 'nomeOS': 'Missão', 'inicioGeral': '08:00', 'terminoGeral': '16:00', 'atividades': [{'inicio': '08:00', 'fim': '09:00', 'tipo': 'Baseamento', 'local': 'Praça'}]}],
        'cadastrosOperacoes': [{'id': 'op1', 'nome': 'Operação', 'avaliacoes': [{'descricao': 'Teste'}]}]
    }
    assert save(client, csrf, data).status_code == 200
    activation = {'id': 1, 'osNumero': 1, 'dataInicio': '2026-10-11T11:00:00Z', 'tipoRecurso': 'Viatura', 'tipoServico': 'PATRULHAMENTO', 'recursoIds': ['V1'], 'equipe': [{'policialId': 'p1', 'funcao': 'Comandante'}]}
    assert save(client, csrf, {'escalasAtivas': [activation]}).status_code == 200
    second = {**activation, 'id': 2}
    assert save(client, csrf, {'escalasAtivas': [activation, second]}).status_code == 400
    assert save(client, csrf, {'escalasAtivas': []}).status_code == 400
    ended = {**activation, 'dataRegistroBaixa': '2026-10-11T19:00:00Z'}
    assert save(client, csrf, {'historicoEscalas': [ended], 'escalasAtivas': []}).status_code == 200
    result = client.get('/api/dados').json['colecoes']
    for key, rows in data.items():
        assert result[key] == rows
    assert result['escalasAtivas'] == [] and result['historicoEscalas'] == [ended]
    with app.app_context():
        assert db.session.scalar(select(MODELS['escalasAtivas'])).arquivado


def test_malicious_and_invalid_data(client):
    csrf = activated(client)
    assert save(client, csrf, {'invalid': []}).status_code == 400
    assert save(client, csrf, {'tiposServico': [{'nome': '<script>alert(1)</script>'}]}).status_code == 400
    assert save(client, csrf, {'tiposServico': [{'nome': 'x&#39;);alert(1);//'}]}).status_code == 400
    assert save(client, csrf, {'tiposServico': [{'nome': 'A'}, {'nome': 'A'}]}).status_code == 400
    assert save(client, csrf, {'locaisCadastrados': [{'id': 1, 'apelido': 'Praça', 'lat': 999}]}).status_code == 400
    assert client.get('/api/dados').json['versao'] == 0


def test_profile_server_validation(client):
    csrf = activated(client)
    assert client.patch('/api/me/telefone', json={'telefone': 'bad'}, headers={'X-CSRFToken': csrf}).status_code == 400
    assert client.patch('/api/me/telefone', json={'telefone': '(85) 99999-9999'}, headers={'X-CSRFToken': csrf}).status_code == 200
    assert client.get('/api/me').json['telefone'] == '(85) 99999-9999'


def test_all_business_pages_render(client):
    activated(client)
    for path in (Path(__file__).resolve().parent.parent / 'templates').glob('*.html'):
        if path.name == 'login.html':
            continue
        response = client.get('/templates/' + path.name)
        assert response.status_code == 200
        assert 'window.ORDENA_BOOT=' in response.text


def test_administration_disable_reset_and_production_configuration(app, client):
    from backend.config import configuration
    runner = app.test_cli_runner()
    activated(client)
    result = runner.invoke(args=['admin-usuario', 'a@example.test', '--inativar'])
    assert result.exit_code == 0
    assert client.get('/api/dados').status_code == 401
    result = runner.invoke(args=['admin-usuario', 'a@example.test', '--reativar'])
    assert result.exit_code == 0
    result = runner.invoke(args=['admin-usuario', 'a@example.test', '--redefinir-senha'], input=f'{TEMP}\n{TEMP}\n')
    assert result.exit_code == 0
    assert login(client).json['destino'] == '/templates/perfil.html'
    with pytest.MonkeyPatch.context() as monkey:
        monkey.setenv('ORDENA_ENV', 'production')
        monkey.setenv('SECRET_KEY', 'x' * 40)
        monkey.setenv('DATABASE_URL', 'postgresql://fake:fake@localhost/ordena_test')
        monkey.setenv('TRUSTED_HOSTS', 'ordena.example.test')
        config = configuration()
        assert config['SESSION_COOKIE_SECURE'] and not config['DEBUG']
        monkey.setenv('DATABASE_URL', 'sqlite://')
        with pytest.raises(RuntimeError):
            configuration()


def test_nested_validation_commander_and_inactive_resources(client):
    csrf = activated(client)
    base = {'viaturas': [{'prefixo': 'V1', 'modelo': 'Modelo', 'placa': 'ABC1234', 'status': 'Inativa'}],
            'policiais': [{'id': 'p1', 'nomeGuerra': 'Operador', 'rg': '123', 'status': 'Ativo'}],
            'tiposServico': [{'nome': 'Patrulhamento'}],
            'ordensServico': [{'numero': 1, 'nomeOS': 'Missão', 'inicioGeral': '08:00', 'terminoGeral': '16:00', 'atividades': [{'inicio': '08:00', 'fim': '09:00'}]}]}
    assert save(client, csrf, base).status_code == 200
    activation = {'id': 1, 'osNumero': 1, 'dataInicio': '2026-10-11T11:00:00Z', 'tipoRecurso': 'Viatura', 'tipoServico': 'PATRULHAMENTO', 'recursoIds': ['V1'], 'equipe': [{'policialId': 'p1', 'funcao': 'Auxiliar'}]}
    assert save(client, csrf, {'escalasAtivas': [activation]}).status_code == 400
    activation['equipe'][0]['funcao'] = 'Comandante'
    assert save(client, csrf, {'escalasAtivas': [activation]}).status_code == 400
    activation['equipe'] = ['invalid']
    assert save(client, csrf, {'escalasAtivas': [activation]}).status_code == 400
    invalid_os = {**base['ordensServico'][0], 'atividades': ['invalid']}
    assert save(client, csrf, {'ordensServico': [invalid_os]}).status_code == 400
    assert client.get('/api/dados').json['versao'] == 1


def test_database_institutional_foreign_keys(app):
    from sqlalchemy.exc import IntegrityError
    with app.app_context():
        user_a = db.session.scalar(select(Usuario).where(Usuario.email == 'a@example.test'))
        user_b = db.session.scalar(select(Usuario).where(Usuario.email == 'b@example.test'))
        user_a.secretaria_id = user_b.secretaria_id
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()
