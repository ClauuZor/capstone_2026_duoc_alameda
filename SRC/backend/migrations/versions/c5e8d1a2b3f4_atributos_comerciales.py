"""atributos comerciales de cotizaciones e ítems

Revision ID: c5e8d1a2b3f4
Revises: b7c41e2d9f10
Create Date: 2026-11-15 22:00:00

Datos que se extraen del PDF para filtros y métricas: tipo de cliente, comuna,
proyecto, material, color, vidrio, vendedor, vencimiento y descuento; en los ítems,
código, medidas, m² y categoría; en el cliente, teléfono.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5e8d1a2b3f4"
down_revision: Union[str, Sequence[str], None] = "b7c41e2d9f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ATRIBUTOS_INDEXADOS = ("tipo_cliente", "comuna", "material", "color", "vidrio", "vendedor")


def upgrade() -> None:
    op.add_column("cotizaciones", sa.Column("descuento", sa.Numeric(15, 2), nullable=False, server_default="0"))
    op.add_column("cotizaciones", sa.Column("fecha_vencimiento", sa.Date(), nullable=True))
    op.add_column("cotizaciones", sa.Column("tipo_cliente", sa.String(length=50), nullable=True))
    op.add_column("cotizaciones", sa.Column("comuna", sa.String(length=100), nullable=True))
    op.add_column("cotizaciones", sa.Column("direccion", sa.String(length=255), nullable=True))
    op.add_column("cotizaciones", sa.Column("proyecto", sa.String(length=255), nullable=True))
    op.add_column("cotizaciones", sa.Column("material", sa.String(length=50), nullable=True))
    op.add_column("cotizaciones", sa.Column("color", sa.String(length=50), nullable=True))
    op.add_column("cotizaciones", sa.Column("vidrio", sa.String(length=50), nullable=True))
    op.add_column("cotizaciones", sa.Column("vendedor", sa.String(length=100), nullable=True))
    for columna in ATRIBUTOS_INDEXADOS:
        op.create_index(op.f(f"ix_cotizaciones_{columna}"), "cotizaciones", [columna], unique=False)

    op.add_column("items_cotizacion", sa.Column("denominacion", sa.String(length=20), nullable=True))
    op.add_column("items_cotizacion", sa.Column("ancho_m", sa.Numeric(8, 3), nullable=True))
    op.add_column("items_cotizacion", sa.Column("alto_m", sa.Numeric(8, 3), nullable=True))
    op.add_column("items_cotizacion", sa.Column("m2", sa.Numeric(10, 2), nullable=True))
    op.add_column("items_cotizacion", sa.Column("categoria", sa.String(length=50), nullable=True))
    op.add_column("items_cotizacion", sa.Column("es_servicio", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index(op.f("ix_items_cotizacion_categoria"), "items_cotizacion", ["categoria"], unique=False)

    op.add_column("clientes", sa.Column("telefono", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("clientes", "telefono")

    op.drop_index(op.f("ix_items_cotizacion_categoria"), table_name="items_cotizacion")
    for columna in ("es_servicio", "categoria", "m2", "alto_m", "ancho_m", "denominacion"):
        op.drop_column("items_cotizacion", columna)

    for columna in ATRIBUTOS_INDEXADOS:
        op.drop_index(op.f(f"ix_cotizaciones_{columna}"), table_name="cotizaciones")
    for columna in ("vendedor", "vidrio", "color", "material", "proyecto", "direccion", "comuna", "tipo_cliente", "fecha_vencimiento", "descuento"):
        op.drop_column("cotizaciones", columna)
