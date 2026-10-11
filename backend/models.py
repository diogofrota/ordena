"""Modelos institucionais e coleções compatíveis com o frontend existente."""
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint, ForeignKeyConstraint

db = SQLAlchemy()


class Prefeitura(db.Model):
    __tablename__ = 'prefeituras'
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(180), nullable=False, unique=True)
    versao = db.Column(db.Integer, nullable=False, default=0)


class Secretaria(db.Model):
    __tablename__ = 'secretarias'
    id = db.Column(db.Integer, primary_key=True)
    prefeitura_id = db.Column(db.Integer, db.ForeignKey('prefeituras.id'), nullable=False, index=True)
    nome = db.Column(db.String(180), nullable=False)
    __table_args__ = (UniqueConstraint('prefeitura_id', 'nome'), UniqueConstraint('id', 'prefeitura_id'))


class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    prefeitura_id = db.Column(db.Integer, db.ForeignKey('prefeituras.id'), nullable=False, index=True)
    secretaria_id = db.Column(db.Integer, nullable=False)
    nome = db.Column(db.String(180), nullable=False)
    email = db.Column(db.String(254), nullable=False, unique=True)
    telefone = db.Column(db.String(30), nullable=False, default='')
    senha_hash = db.Column(db.String(256), nullable=False)
    senha_temporaria = db.Column(db.Boolean, nullable=False, default=True)
    ativo = db.Column(db.Boolean, nullable=False, default=True)
    sessao_versao = db.Column(db.Integer, nullable=False, default=0)
    __table_args__ = (ForeignKeyConstraint(['secretaria_id', 'prefeitura_id'], ['secretarias.id', 'secretarias.prefeitura_id']),)


class Sessao(db.Model):
    __tablename__ = 'sessoes'
    id = db.Column(db.String(64), primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False, index=True)
    expira_em = db.Column(db.DateTime, nullable=False, index=True)


class LimiteLogin(db.Model):
    __tablename__ = 'limites_login'
    chave = db.Column(db.String(64), primary_key=True)
    tentativas = db.Column(db.Integer, nullable=False)
    inicio = db.Column(db.DateTime, nullable=False, index=True)


class Auditoria(db.Model):
    __tablename__ = 'auditoria'
    id = db.Column(db.Integer, primary_key=True)
    prefeitura_id = db.Column(db.Integer, db.ForeignKey('prefeituras.id'), nullable=False, index=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=False)
    criado_em = db.Column(db.DateTime, nullable=False)
    acao = db.Column(db.String(60), nullable=False)
    colecoes = db.Column(db.JSON, nullable=False)


# Documentos JSON preservam atividades, equipes e snapshots históricos reais.
# Cada registro é uma linha persistente, com identidade única dentro da prefeitura.
COLLECTIONS = {
    'viaturas': ('viaturas', 'prefixo'),
    'policiais': ('policiais', 'id'),
    'cabines': ('cabines', 'codigo'),
    'setores': ('setores_operacionais', 'codigo'),
    'locaisCadastrados': ('baseamentos', 'id'),
    'pontosPatrulhamento': ('patrulhamentos', 'id'),
    'tiposServico': ('tipos_servico', 'id'),
    'ordensServico': ('ordens_servico', 'numero'),
    'cadastrosOperacoes': ('operacoes_especiais', 'id'),
    'escalasAtivas': ('ativacoes', 'id'),
    'historicoEscalas': ('historico_ativacoes', 'id'),
}
MODELS = {}
for key, (table, identity) in COLLECTIONS.items():
    attrs = {
        '__tablename__': table,
        'id': db.Column(db.Integer, primary_key=True),
        'prefeitura_id': db.Column(db.Integer, db.ForeignKey('prefeituras.id'), nullable=False, index=True),
        'chave': db.Column(db.String(180), nullable=False),
        'arquivado': db.Column(db.Boolean, nullable=False, default=False),
        'posicao': db.Column(db.Integer, nullable=False),
        'dados': db.Column(db.JSON, nullable=False),
        '__table_args__': (UniqueConstraint('prefeitura_id', 'chave'),),
    }
    if key in {'escalasAtivas', 'historicoEscalas'}:
        attrs['os_chave'] = db.Column(db.String(180), nullable=False)
        attrs['__table_args__'] += (ForeignKeyConstraint(['prefeitura_id', 'os_chave'], ['ordens_servico.prefeitura_id', 'ordens_servico.chave']),)
    MODELS[key] = type(table.title().replace('_', ''), (db.Model,), attrs)
