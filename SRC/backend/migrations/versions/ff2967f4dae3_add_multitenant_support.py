"""add multitenant support

Revision ID: ff2967f4dae3
Revises: 6a280da63aaa
Create Date: 2026-10-12 20:44:46.709164

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ff2967f4dae3"
down_revision: Union[str, Sequence[str], None] = "6a280da63aaa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear tabla empresas
    op.create_table(
        "empresas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("rut", sa.String(length=20), nullable=True),
        sa.Column("google_drive_folder_id", sa.String(length=255), nullable=True),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "fecha_creacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_empresas_id"),
        "empresas",
        ["id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_empresas_nombre"),
        "empresas",
        ["nombre"],
        unique=False,
    )

    op.create_index(
        op.f("ix_empresas_rut"),
        "empresas",
        ["rut"],
        unique=True,
    )

    # 2. Agregar empresa_id temporalmente nullable
    op.add_column(
        "clientes",
        sa.Column("empresa_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "cotizaciones",
        sa.Column("empresa_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "documentos",
        sa.Column("empresa_id", sa.Integer(), nullable=True),
    )

    # 3. Crear empresa inicial para los datos de prueba existentes
    op.execute(
        """
        INSERT INTO empresas (
            nombre,
            rut,
            google_drive_folder_id,
            activa
        )
        VALUES (
            'Empresa Inicial',
            NULL,
            NULL,
            TRUE
        )
        """
    )

    # 4. Asignar los registros existentes a la empresa inicial
    op.execute(
        """
        UPDATE clientes
        SET empresa_id = (
            SELECT id
            FROM empresas
            WHERE nombre = 'Empresa Inicial'
            ORDER BY id
            LIMIT 1
        )
        WHERE empresa_id IS NULL
        """
    )

    op.execute(
        """
        UPDATE cotizaciones
        SET empresa_id = (
            SELECT id
            FROM empresas
            WHERE nombre = 'Empresa Inicial'
            ORDER BY id
            LIMIT 1
        )
        WHERE empresa_id IS NULL
        """
    )

    op.execute(
        """
        UPDATE documentos
        SET empresa_id = (
            SELECT id
            FROM empresas
            WHERE nombre = 'Empresa Inicial'
            ORDER BY id
            LIMIT 1
        )
        WHERE empresa_id IS NULL
        """
    )

    # 5. Convertir empresa_id a obligatorio
    op.alter_column(
        "clientes",
        "empresa_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.alter_column(
        "cotizaciones",
        "empresa_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    op.alter_column(
        "documentos",
        "empresa_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 6. Clientes
    op.drop_constraint(
        op.f("clientes_rut_key"),
        "clientes",
        type_="unique",
    )

    op.create_index(
        op.f("ix_clientes_empresa_id"),
        "clientes",
        ["empresa_id"],
        unique=False,
    )

    op.create_unique_constraint(
        "uq_cliente_empresa_rut",
        "clientes",
        ["empresa_id", "rut"],
    )

    op.create_foreign_key(
        "fk_clientes_empresa_id",
        "clientes",
        "empresas",
        ["empresa_id"],
        ["id"],
    )

    # 7. Cotizaciones
    op.drop_index(
        op.f("ix_cotizaciones_numero"),
        table_name="cotizaciones",
    )

    op.create_index(
        op.f("ix_cotizaciones_numero"),
        "cotizaciones",
        ["numero"],
        unique=False,
    )

    op.create_index(
        op.f("ix_cotizaciones_empresa_id"),
        "cotizaciones",
        ["empresa_id"],
        unique=False,
    )

    op.create_unique_constraint(
        "uq_cotizacion_empresa_numero",
        "cotizaciones",
        ["empresa_id", "numero"],
    )

    op.create_foreign_key(
        "fk_cotizaciones_empresa_id",
        "cotizaciones",
        "empresas",
        ["empresa_id"],
        ["id"],
    )

    # 8. Documentos
    op.create_index(
        op.f("ix_documentos_empresa_id"),
        "documentos",
        ["empresa_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_documentos_empresa_id",
        "documentos",
        "empresas",
        ["empresa_id"],
        ["id"],
    )


def downgrade() -> None:
    # Documentos
    op.drop_constraint(
        "fk_documentos_empresa_id",
        "documentos",
        type_="foreignkey",
    )

    op.drop_index(
        op.f("ix_documentos_empresa_id"),
        table_name="documentos",
    )

    op.drop_column(
        "documentos",
        "empresa_id",
    )

    # Cotizaciones
    op.drop_constraint(
        "fk_cotizaciones_empresa_id",
        "cotizaciones",
        type_="foreignkey",
    )

    op.drop_constraint(
        "uq_cotizacion_empresa_numero",
        "cotizaciones",
        type_="unique",
    )

    op.drop_index(
        op.f("ix_cotizaciones_empresa_id"),
        table_name="cotizaciones",
    )

    op.drop_index(
        op.f("ix_cotizaciones_numero"),
        table_name="cotizaciones",
    )

    op.create_index(
        op.f("ix_cotizaciones_numero"),
        "cotizaciones",
        ["numero"],
        unique=True,
    )

    op.drop_column(
        "cotizaciones",
        "empresa_id",
    )

    # Clientes
    op.drop_constraint(
        "fk_clientes_empresa_id",
        "clientes",
        type_="foreignkey",
    )

    op.drop_constraint(
        "uq_cliente_empresa_rut",
        "clientes",
        type_="unique",
    )

    op.drop_index(
        op.f("ix_clientes_empresa_id"),
        table_name="clientes",
    )

    op.create_unique_constraint(
        op.f("clientes_rut_key"),
        "clientes",
        ["rut"],
    )

    op.drop_column(
        "clientes",
        "empresa_id",
    )

    # Empresas
    op.drop_index(
        op.f("ix_empresas_rut"),
        table_name="empresas",
    )

    op.drop_index(
        op.f("ix_empresas_nombre"),
        table_name="empresas",
    )

    op.drop_index(
        op.f("ix_empresas_id"),
        table_name="empresas",
    )

    op.drop_table("empresas")