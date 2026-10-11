"""Administração local: sem cadastro público e sem senha em argumentos."""
import click
from pathlib import Path
from alembic import command
from alembic.config import Config
from flask.cli import with_appcontext
from sqlalchemy import select
from werkzeug.security import generate_password_hash
from .config import ROOT
from .models import db, Prefeitura, Secretaria, Usuario


def migration_config():
    cfg = Config(str(ROOT / 'alembic.ini'))
    cfg.set_main_option('script_location', str(ROOT / 'migrations'))
    return cfg


def register_commands(app):
    @app.cli.command('db-upgrade')
    @with_appcontext
    def upgrade():
        """Aplica migrações versionadas (não usa create_all)."""
        command.upgrade(migration_config(), 'head')
        click.echo('Migrações aplicadas com sucesso.')

    @app.cli.command('db-revision')
    @click.option('--mensagem', required=True, help='Descrição da migração proposta.')
    @with_appcontext
    def revision(mensagem):
        """Gera uma proposta local de migração para revisão, sem aplicá-la."""
        if app.config.get('ORDENA_ENV') == 'production':
            raise click.ClickException('Gere e revise migrações em desenvolvimento, nunca em produção.')
        command.revision(migration_config(), message=mensagem, autogenerate=True)
        click.echo('Proposta gerada. Revise o script e a preservação dos dados antes de aplicar.')

    @app.cli.command('db-sql')
    @with_appcontext
    def sql():
        """Emite SQL a partir das migrações para revisão, sem executar."""
        command.upgrade(migration_config(), 'head', sql=True)

    @app.cli.command('admin-cadastrar')
    @with_appcontext
    def create():
        """Cria/reutiliza prefeitura e secretaria, cadastra um novo usuário."""
        prefeitura_nome = click.prompt('Prefeitura').strip()
        secretaria_nome = click.prompt('Secretaria ou setor administrativo').strip()
        nome = click.prompt('Nome completo').strip()
        email = click.prompt('E-mail').strip().lower()
        senha = click.prompt('Senha temporária (12 a 128 caracteres)', hide_input=True, confirmation_prompt=True)
        if not all((prefeitura_nome, secretaria_nome, nome)) or any(len(v) > 180 for v in (prefeitura_nome, secretaria_nome, nome)) or '@' not in email or len(email) > 254 or not 12 <= len(senha) <= 128:
            raise click.ClickException('Dados inválidos. Nenhum registro foi criado.')
        if db.session.scalar(select(Usuario).where(Usuario.email == email)):
            raise click.ClickException('E-mail já cadastrado. Nenhum registro foi alterado.')
        prefeitura = db.session.scalar(select(Prefeitura).where(Prefeitura.nome == prefeitura_nome))
        if prefeitura is None:
            prefeitura = Prefeitura(nome=prefeitura_nome, versao=0)
            db.session.add(prefeitura)
            db.session.flush()
        secretaria = db.session.scalar(select(Secretaria).where(Secretaria.prefeitura_id == prefeitura.id, Secretaria.nome == secretaria_nome))
        if secretaria is None:
            secretaria = Secretaria(nome=secretaria_nome, prefeitura_id=prefeitura.id)
            db.session.add(secretaria)
            db.session.flush()
        db.session.add(Usuario(prefeitura_id=prefeitura.id, secretaria_id=secretaria.id, nome=nome, email=email,
                              senha_hash=generate_password_hash(senha, method='pbkdf2:sha256:1000000'), senha_temporaria=True))
        db.session.commit()
        click.echo('Cadastro concluído. O primeiro acesso exige troca da senha temporária.')

    @app.cli.command('admin-listar')
    @with_appcontext
    def listing():
        """Consulta instituições e usuários, sem exibir hashes ou segredos."""
        for p in db.session.scalars(select(Prefeitura).order_by(Prefeitura.id)):
            click.echo(f'Prefeitura {p.id}: {p.nome}')
            for s in db.session.scalars(select(Secretaria).where(Secretaria.prefeitura_id == p.id)):
                click.echo(f'  Secretaria {s.id}: {s.nome}')
            for u in db.session.scalars(select(Usuario).where(Usuario.prefeitura_id == p.id)):
                click.echo(f'  Usuário {u.id}: {u.nome} | {u.email} | secretaria={u.secretaria_id} | ativo={u.ativo} | senha temporária={u.senha_temporaria}')

    @app.cli.command('admin-usuario')
    @click.argument('email')
    @click.option('--inativar', is_flag=True)
    @click.option('--reativar', is_flag=True)
    @click.option('--redefinir-senha', is_flag=True)
    @with_appcontext
    def manage(email, inativar, reativar, redefinir_senha):
        """Inativa/reativa ou redefine senha temporária; invalida sessões anteriores."""
        if sum((inativar, reativar, redefinir_senha)) != 1:
            raise click.ClickException('Escolha exatamente uma ação.')
        user = db.session.scalar(select(Usuario).where(Usuario.email == email.strip().lower()))
        if user is None:
            raise click.ClickException('Usuário não encontrado.')
        if redefinir_senha:
            senha = click.prompt('Nova senha temporária', hide_input=True, confirmation_prompt=True)
            if not 12 <= len(senha) <= 128:
                raise click.ClickException('Senha deve ter de 12 a 128 caracteres.')
            user.senha_hash = generate_password_hash(senha, method='pbkdf2:sha256:1000000')
            user.senha_temporaria = True
        else:
            user.ativo = reativar
        user.sessao_versao += 1
        db.session.commit()
        click.echo('Usuário atualizado; sessões anteriores invalidadas.')
