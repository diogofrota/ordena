import os
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def configuration():
    env = os.getenv('ORDENA_ENV', 'development')
    if env not in {'development', 'testing', 'production'}:
        raise RuntimeError('ORDENA_ENV inválido.')
    secret = os.getenv('SECRET_KEY')
    url = os.getenv('DATABASE_URL', 'sqlite:///' + str(ROOT / 'instance' / 'ordena.db'))
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql+psycopg://', 1)
    elif url.startswith('postgresql://'):
        url = url.replace('postgresql://', 'postgresql+psycopg://', 1)
    hosts = [h.strip() for h in os.getenv('TRUSTED_HOSTS', '').split(',') if h.strip()]
    if env == 'production' and (not secret or len(secret) < 32 or 'SUBSTITUA' in secret or not url.startswith('postgresql+psycopg://') or not hosts):
        raise RuntimeError('Produção exige SECRET_KEY aleatória (32+ caracteres), PostgreSQL e TRUSTED_HOSTS.')
    if not secret:
        raise RuntimeError('Defina SECRET_KEY no ambiente; consulte .env.example.')
    return dict(SECRET_KEY=secret, SQLALCHEMY_DATABASE_URI=url,
                SQLALCHEMY_TRACK_MODIFICATIONS=False, TESTING=env == 'testing', DEBUG=False,
                SESSION_COOKIE_SECURE=env == 'production', SESSION_COOKIE_HTTPONLY=True,
                SESSION_COOKIE_SAMESITE='Lax', PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
                WTF_CSRF_TIME_LIMIT=timedelta(hours=8), MAX_CONTENT_LENGTH=8 * 1024 * 1024,
                TRUSTED_HOSTS=hosts or None, ORDENA_ENV=env)
