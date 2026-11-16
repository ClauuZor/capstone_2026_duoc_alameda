"""initial schema

Revision ID: 6a280da63aaa
Revises:
Create Date: 2026-10-12 20:17:42.267761

Esquema original (antes de la multiempresa). En la base de desarrollo estas
tablas se habían creado con create_tables.py y esta migración quedó vacía, lo
que impedía crear una base nueva con `alembic upgrade head`. Se reconstruye
aquí a partir del esquema real; las bases ya migradas no la vuelven a ejecutar.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a280da63aaa'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "clientes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("rut", sa.String(length=20), nullable=True),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rut", name="clientes_rut_key"),
    )
    op.create_index(op.f("ix_clientes_id"), "clientes", ["id"], unique=False)
    op.create_index(op.f("ix_clientes_nombre"), "clientes", ["nombre"], unique=False)

    op.create_table(
        "cotizaciones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("numero", sa.String(length=100), nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=True),
        sa.Column("subtotal", sa.Numeric(15, 2), nullable=True),
        sa.Column("iva", sa.Numeric(15, 2), nullable=True),
        sa.Column("total", sa.Numeric(15, 2), nullable=True),
        sa.Column("moneda", sa.String(length=10), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["cliente_id"], ["clientes.id"], name="cotizaciones_cliente_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cotizaciones_id"), "cotizaciones", ["id"], unique=False)
    op.create_index(op.f("ix_cotizaciones_numero"), "cotizaciones", ["numero"], unique=True)
    op.create_index(op.f("ix_cotizaciones_cliente_id"), "cotizaciones", ["cliente_id"], unique=False)

    op.create_table(
        "items_cotizacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cotizacion_id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=100), nullable=True),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 2), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(15, 2), nullable=True),
        sa.Column("total", sa.Numeric(15, 2), nullable=True),
        sa.ForeignKeyConstraint(
            ["cotizacion_id"], ["cotizaciones.id"],
            name="items_cotizacion_cotizacion_id_fkey", ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_items_cotizacion_id"), "items_cotizacion", ["id"], unique=False)
    op.create_index(op.f("ix_items_cotizacion_cotizacion_id"), "items_cotizacion", ["cotizacion_id"], unique=False)

    op.create_table(
        "documentos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cotizacion_id", sa.Integer(), nullable=True),
        sa.Column("google_drive_id", sa.String(length=255), nullable=False),
        sa.Column("nombre_archivo", sa.String(length=255), nullable=False),
        sa.Column("hash_archivo", sa.String(length=64), nullable=True),
        sa.Column("estado", sa.String(length=30), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("fecha_procesamiento", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["cotizacion_id"], ["cotizaciones.id"], name="documentos_cotizacion_id_fkey"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documentos_id"), "documentos", ["id"], unique=False)
    op.create_index(op.f("ix_documentos_cotizacion_id"), "documentos", ["cotizacion_id"], unique=False)
    op.create_index(op.f("ix_documentos_google_drive_id"), "documentos", ["google_drive_id"], unique=True)
    op.create_index(op.f("ix_documentos_hash_archivo"), "documentos", ["hash_archivo"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("documentos")
    op.drop_table("items_cotizacion")
    op.drop_table("cotizaciones")
    op.drop_table("clientes")
