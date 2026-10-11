from pathlib import Path
from flask import Flask, jsonify
from flask_wtf.csrf import CSRFProtect, CSRFError
from dotenv import load_dotenv
from sqlalchemy import event
from sqlalchemy.engine import Engine
from .config import configuration, ROOT
from .models import db


@event.listens_for(Engine, 'connect')
def sqlite_foreign_keys(connection, _):
    if connection.__class__.__module__.startswith('sqlite3'):
        connection.execute('PRAGMA foreign_keys=ON')


def create_app(test_config=None):
    load_dotenv(ROOT / '.env')
    app = Flask(__name__, static_folder=None, template_folder=str(ROOT / 'templates'), instance_path=str(ROOT / 'instance'))
    if test_config is None:
        app.config.update(configuration())
    else:
        app.config.update(SECRET_KEY='test-only-key', SQLALCHEMY_DATABASE_URI='sqlite://', TESTING=True,
                          MAX_CONTENT_LENGTH=8 * 1024 * 1024, SESSION_COOKIE_HTTPONLY=True,
                          SESSION_COOKIE_SAMESITE='Lax', DEBUG=False)
        app.config.update(test_config)
    Path(app.instance_path).mkdir(exist_ok=True)
    db.init_app(app)
    CSRFProtect(app)
    from .routes import routes, authenticate
    from .cli import register_commands
    app.register_blueprint(routes)
    app.before_request(authenticate)
    register_commands(app)

    @app.errorhandler(CSRFError)
    def csrf_error(error):
        return jsonify(mensagem='Sessão de segurança expirada. Atualize a página e tente novamente.'), 400

    @app.errorhandler(413)
    def too_large(error):
        return jsonify(mensagem='Dados excedem o limite permitido.'), 413

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify(mensagem='Não foi possível concluir a operação. Consulte os logs do servidor.'), 500

    @app.after_request
    def security_headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'same-origin'
        if app.config.get('SESSION_COOKIE_SECURE'):
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        return response
    return app
