from alembic import context
from flask import current_app
from backend.models import db
config = context.config
if context.is_offline_mode():
    context.configure(url=current_app.config['SQLALCHEMY_DATABASE_URI'], target_metadata=db.metadata,
                      literal_binds=True, dialect_opts={'paramstyle': 'named'})
    with context.begin_transaction():
        context.run_migrations()
else:
    with db.engine.connect() as connection:
        context.configure(connection=connection, target_metadata=db.metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
