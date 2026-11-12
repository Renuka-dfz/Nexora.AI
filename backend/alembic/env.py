
"""
Alembic environment configuration for Nexora.AI.

Uses:
- PostgreSQL
- SQLAlchemy 2.x
- Shared SQLAlchemy Base
- Company Intelligence models
- Marketing Performance models
- Lead Qualification models
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.core.database import Base

# Import all models so SQLAlchemy registers their tables.
import app.modules.company_knowledge.models
import app.modules.marketing.models
import app.modules.lead_management.models
import app.modules.identity.models


# Alembic configuration object
config = context.config


# Set PostgreSQL connection URL from root .env
config.set_main_option(
    "sqlalchemy.url",
    settings.DATABASE_URL.replace("%", "%%"),
)


# Configure logging if available
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Shared metadata containing the application tables.
target_metadata = Base.metadata


def run_migrations_offline():
    """Run migrations without a live database connection."""

    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations using the PostgreSQL connection."""

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
