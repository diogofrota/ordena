"""Validação e transações. Nunca recebe a prefeitura do cliente."""
import re
from datetime import datetime
from sqlalchemy import select, update
from .models import db, Prefeitura, COLLECTIONS, MODELS, Auditoria


class BusinessError(ValueError):
    pass


def snapshot(prefeitura_id):
    result = {}
    for key, model in MODELS.items():
        rows = db.session.scalars(select(model).where(model.prefeitura_id == prefeitura_id, model.arquivado.is_(False)).order_by(model.posicao)).all()
        result[key] = [row.dados for row in rows]
    return result


def identity(key, data):
    field = COLLECTIONS[key][1]
    # O catálogo existente não gera IDs; seu nome é a identidade estável.
    value = data.get(field)
    if key == 'tiposServico':
        value = data.get('nome')
    if isinstance(value, bool) or not isinstance(value, (str, int)) or not str(value).strip() or len(str(value)) > 180:
        raise BusinessError(f'{key}: identificador obrigatório ou inválido ({field}).')
    return str(value).strip()


def validate_json(value, depth=0):
    if depth > 15:
        raise BusinessError('Dados possuem profundidade excessiva.')
    if isinstance(value, dict):
        if len(value) > 150:
            raise BusinessError('Registro possui campos excessivos.')
        for key, item in value.items():
            if not isinstance(key, str) or len(key) > 100:
                raise BusinessError('Campo inválido.')
            validate_json(item, depth + 1)
    elif isinstance(value, list):
        if len(value) > 10000:
            raise BusinessError('Lista excede o limite de registros.')
        for item in value:
            validate_json(item, depth + 1)
    elif isinstance(value, str):
        # Há templates legados que interpolam strings em innerHTML e onclick.
        if len(value) > 20000 or any(c in value for c in ('<', '>', '&', '\x00', '`', '\\', "'", '"')):
            raise BusinessError('Texto contém caracteres não suportados pela interface atual.')
    elif value is not None and not isinstance(value, (bool, int, float)):
        raise BusinessError('Tipo de campo inválido.')
    elif isinstance(value, float):
        import math
        if not math.isfinite(value):
            raise BusinessError('Número inválido.')


def validate_collections(state):
    required = {'viaturas': ['prefixo', 'placa'], 'policiais': ['id', 'nomeGuerra', 'rg'],
                'cabines': ['codigo', 'nome'], 'setores': ['codigo', 'nome'],
                'locaisCadastrados': ['id', 'apelido'], 'pontosPatrulhamento': ['id', 'apelido'],
                'tiposServico': ['nome'], 'ordensServico': ['numero', 'nomeOS', 'inicioGeral', 'terminoGeral'],
                'cadastrosOperacoes': ['id', 'nome'], 'escalasAtivas': ['id', 'osNumero', 'dataInicio'],
                'historicoEscalas': ['id', 'osNumero', 'dataInicio']}
    for key, rows in state.items():
        if not isinstance(rows, list) or len(rows) > 10000:
            raise BusinessError(f'{key}: lista inválida.')
        seen, natural = set(), set()
        for row in rows:
            if not isinstance(row, dict):
                raise BusinessError(f'{key}: registro inválido.')
            validate_json(row)
            for field in required[key]:
                if row.get(field) is None or not str(row[field]).strip():
                    raise BusinessError(f'{key}: campo obrigatório {field}.')
            if 'status' in row and row['status'] not in {'Ativo', 'Ativa', 'Inativo', 'Inativa'}:
                raise BusinessError(f'{key}: status inválido.')
            if key in {'locaisCadastrados', 'pontosPatrulhamento', 'escalasAtivas', 'historicoEscalas', 'ordensServico'} and 'id' in row:
                if isinstance(row['id'], bool) or not isinstance(row['id'], int) or not 0 < row['id'] <= 9007199254740991:
                    raise BusinessError('ID operacional deve ser um inteiro positivo seguro.')
            if key in {'policiais', 'cadastrosOperacoes'} and not re.fullmatch(r'[A-Za-z0-9_-]+', str(row.get('id', ''))):
                raise BusinessError('ID cadastral inválido.')
            record_id = identity(key, row)
            if record_id in seen:
                raise BusinessError(f'{key}: identificador duplicado.')
            seen.add(record_id)
            if key == 'viaturas':
                if row.get('tipo', 'Carro') not in {'Carro', 'Moto'} or len(str(row['placa']).replace('-', '')) < 7:
                    raise BusinessError('Tipo de veículo ou placa inválidos.')
                if row.get('tipo', 'Carro') == 'Carro' and not row.get('modelo'):
                    raise BusinessError('Informe o modelo da viatura.')
            if key == 'policiais':
                rg = re.sub(r'[^A-Z0-9]', '', str(row['rg']).upper())
                if not rg or rg in natural:
                    raise BusinessError('RG de policial inválido ou duplicado.')
                natural.add(rg)
            for field in ('lat', 'lng'):
                if row.get(field) not in (None, ''):
                    try:
                        coord = float(row[field])
                    except (TypeError, ValueError):
                        raise BusinessError('Coordenada inválida.')
                    if not (-90 <= coord <= 90 if field == 'lat' else -180 <= coord <= 180):
                        raise BusinessError('Coordenada fora dos limites.')
            if key == 'ordensServico':
                if not isinstance(row['numero'], int) or row['numero'] <= 0:
                    raise BusinessError('Número de OS inválido.')
                activities = row.get('atividades')
                if not isinstance(activities, list) or not activities or any(not isinstance(a, dict) for a in activities):
                    raise BusinessError('Informe atividades válidas para a OS.')
                for field in ('inicioGeral', 'terminoGeral'):
                    if not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', str(row[field])):
                        raise BusinessError('Turno da OS inválido.')
                intervals = []
                for activity in activities:
                    for field in ('inicio', 'fim'):
                        if not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', str(activity.get(field, ''))):
                            raise BusinessError('Horário de atividade inválido.')
                    start, end = [int(t[:2])*60+int(t[3:]) for t in (activity['inicio'], activity['fim'])]
                    if end <= start:
                        end += 1440
                    parts = [(start, min(end, 1440))] + ([(0, end-1440)] if end > 1440 else [])
                    for a, b in parts:
                        if any(a < d and c < b for c, d in intervals):
                            raise BusinessError('Atividades com horários sobrepostos.')
                        intervals.append((a, b))
            if key == 'cadastrosOperacoes':
                evaluations = row.get('avaliacoes', [])
                if not isinstance(evaluations, list) or any(not isinstance(a, dict) for a in evaluations):
                    raise BusinessError('Avaliações inválidas.')
    os_ids = {str(r['numero']) for r in state['ordensServico']}
    police = {str(r['id']) for r in state['policiais']}
    resources = {k: {str(r[COLLECTIONS[k][1]]) for r in state[k]} for k in ('viaturas', 'cabines', 'setores')}
    occupied, assigned = set(), set()
    types = {str(r['nome']).strip().upper() for r in state['tiposServico']}
    for key in ('escalasAtivas', 'historicoEscalas'):
        for row in state[key]:
            if str(row['osNumero']) not in os_ids:
                raise BusinessError('Ativação deve vincular uma OS da mesma prefeitura.')
            if not isinstance(row.get('equipe'), list) or not row['equipe'] or any(not isinstance(m, dict) for m in row['equipe']):
                raise BusinessError('Ativação deve informar sua equipe.')
            if key == 'escalasAtivas':
                if not 1 <= len(row['equipe']) <= 6 or row['equipe'][0].get('funcao') != 'Comandante':
                    raise BusinessError('Informe comandante e equipe de até seis integrantes.')
                if str(row.get('tipoServico', '')).strip().upper() not in types:
                    raise BusinessError('Selecione um tipo de serviço da prefeitura.')
                for member in row['equipe']:
                    pid = str(member.get('policialId', ''))
                    if pid not in police or pid in assigned:
                        raise BusinessError('Policial inválido ou já utilizado em uma guarnição ativa.')
                    assigned.add(pid)
                kind = str(row.get('tipoRecurso', ''))
                if kind not in {'Viatura', 'Moto', 'Cabine', 'Setor'}:
                    raise BusinessError('Tipo de recurso inválido.')
                collection = 'cabines' if kind == 'Cabine' else 'setores' if kind == 'Setor' else 'viaturas'
                ids = row.get('recursoIds') or [row.get('recursoId')]
                if not isinstance(ids, list) or not ids or (kind != 'Moto' and len(ids) != 1) or len(ids) > 6:
                    raise BusinessError('Quantidade de recursos inválida para a ativação.')
                for rid in ids:
                    ref = (collection, str(rid))
                    if str(rid) not in resources[collection] or ref in occupied:
                        raise BusinessError('Recurso inválido ou já utilizado em uma guarnição ativa.')
                    occupied.add(ref)


def save_changes(user, payload):
    if not isinstance(payload, dict) or not isinstance(payload.get('versao'), int):
        raise BusinessError('Versão obrigatória.')
    changes = payload.get('colecoes')
    if not isinstance(changes, dict) or not changes or set(changes) - set(COLLECTIONS):
        raise BusinessError('Coleções inválidas.')
    # Compare-and-swap serializa todas as gravações da prefeitura, inclusive entre workers.
    updated = db.session.execute(update(Prefeitura).where(Prefeitura.id == user.prefeitura_id,
                                 Prefeitura.versao == payload['versao']).values(versao=Prefeitura.versao + 1))
    if updated.rowcount != 1:
        db.session.rollback()
        raise BusinessError('CONFLICT')
    current = snapshot(user.prefeitura_id)
    state = {**current, **changes}
    validate_collections(state)
    existing_active = {identity('escalasAtivas', r) for r in current['escalasAtivas']}
    active = lambda r: str(r.get('status', 'Ativo')).lower() in {'ativo', 'ativa'}
    for activation in changes.get('escalasAtivas', []):
        if identity('escalasAtivas', activation) in existing_active:
            continue
        os_row = next(r for r in state['ordensServico'] if str(r['numero']) == str(activation['osNumero']))
        if not active(os_row):
            raise BusinessError('Não é possível ativar uma OS inativa.')
        kind = activation.get('tipoRecurso')
        collection = 'cabines' if kind == 'Cabine' else 'setores' if kind == 'Setor' else 'viaturas'
        for rid in activation.get('recursoIds') or [activation.get('recursoId')]:
            resource = next(r for r in state[collection] if identity(collection, r) == str(rid))
            if not active(resource) or (collection == 'viaturas' and resource.get('tipo', 'Carro') != ('Moto' if kind == 'Moto' else 'Carro')):
                raise BusinessError('Recurso inativo ou incompatível com a ativação.')
        for member in activation['equipe']:
            police_row = next(r for r in state['policiais'] if str(r['id']) == str(member['policialId']))
            if not active(police_row):
                raise BusinessError('Não é possível incluir um policial inativo.')
    for key in COLLECTIONS:
        if key not in changes:
            continue
        data = changes[key]
        model = MODELS[key]
        rows = db.session.scalars(select(model).where(model.prefeitura_id == user.prefeitura_id)).all()
        previous = {r.chave: r for r in rows}
        incoming = {identity(key, r) for r in data}
        missing = {r.chave for r in rows if not r.arquivado} - incoming
        if missing:
            history_ids = {identity('historicoEscalas', r) for r in state['historicoEscalas']}
            if key != 'escalasAtivas' or not missing.issubset(history_ids):
                raise BusinessError('Exclusão de registros não permitida. Utilize a inativação.')
            for rid in missing:
                previous[rid].arquivado = True
        for position, record in enumerate(data):
            rid = identity(key, record)
            row = previous.get(rid)
            if row is None:
                row = model(prefeitura_id=user.prefeitura_id, chave=rid)
                db.session.add(row)
            row.posicao, row.dados, row.arquivado = position, record, False
            if key in {'escalasAtivas', 'historicoEscalas'}:
                row.os_chave = str(record['osNumero'])
    db.session.flush()
    db.session.add(Auditoria(prefeitura_id=user.prefeitura_id, usuario_id=user.id,
                             criado_em=datetime.utcnow(), acao='gravar', colecoes=list(changes)))
    db.session.commit()
    return payload['versao'] + 1
