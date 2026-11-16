"""usuarios, estados OAuth y ajustes para la ingesta y el contrato de API

Revision ID: b7c41e2d9f10
Revises: a8927a543e09
Create Date: 2026-11-15 12:00:00

- Tabla usuarios (login con JWT, cada usuario pertenece a una empresa).
- Tabla oauth_estados (flujos OAuth de Google persistidos en la base).
- items_cotizacion: columnas linea y unidad.
- documentos: metodo_extraccion y unicidad de Drive ID / hash por empresa.
- cotizaciones: fecha y montos obligatorios.
- integraciones_google_drive: se elimina folder_id (la carpeta vive en empresas).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c41e2d9f10"
down_revision: Union[str, Sequence[str], None] = "a8927a543e09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Usuarios
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["empresa_id"], ["empresas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usuarios_id"), "usuarios", ["id"], unique=False)
    op.create_index(op.f("ix_usuarios_email"), "usuarios", ["email"], unique=True)
    op.create_index(op.f("ix_usuarios_empresa_id"), "usuarios", ["empresa_id"], unique=False)

    # Estados OAuth
    op.create_table(
        "oauth_estados",
        sa.Column("state", sa.String(length=128), nullable=False),
        sa.Column("empresa_id", sa.Integer(), nullable=False),
        sa.Column("code_verifier", sa.String(length=128), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["empresa_id"], ["empresas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("state"),
    )

    # Ítems: número de línea y unidad
    op.add_column("items_cotizacion", sa.Column("linea", sa.Integer(), nullable=True))
    op.add_column("items_cotizacion", sa.Column("unidad", sa.String(length=20), nullable=True))
    op.execute(
        """
        UPDATE items_cotizacion AS i
        SET linea = n.linea
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY cotizacion_id ORDER BY id) AS linea
            FROM items_cotizacion
        ) AS n
        WHERE i.id = n.id
        """
    )
    op.alter_column("items_cotizacion", "linea", existing_type=sa.Integer(), nullable=False)

    # Documentos
    op.add_column("documentos", sa.Column("metodo_extraccion", sa.String(length=20), nullable=True))
    op.drop_index(op.f("ix_documentos_google_drive_id"), table_name="documentos")
    op.drop_index(op.f("ix_documentos_hash_archivo"), table_name="documentos")
    op.create_index(op.f("ix_documentos_google_drive_id"), "documentos", ["google_drive_id"], unique=False)
    op.create_index(op.f("ix_documentos_hash_archivo"), "documentos", ["hash_archivo"], unique=False)
    op.create_unique_constraint("uq_documento_empresa_drive", "documentos", ["empresa_id", "google_drive_id"])
    op.create_unique_constraint("uq_documento_empresa_hash", "documentos", ["empresa_id", "hash_archivo"])

    # Cotizaciones: fecha y montos obligatorios
    op.execute("UPDATE cotizaciones SET fecha = fecha_creacion::date WHERE fecha IS NULL")
    op.execute("UPDATE cotizaciones SET iva = 0 WHERE iva IS NULL")
    op.execute("UPDATE cotizaciones SET subtotal = COALESCE(total, 0) - iva WHERE subtotal IS NULL")
    op.execute("UPDATE cotizaciones SET total = subtotal + iva WHERE total IS NULL")
    for columna, tipo in (("fecha", sa.Date()), ("subtotal", sa.Numeric(15, 2)), ("iva", sa.Numeric(15, 2)), ("total", sa.Numeric(15, 2))):
        op.alter_column("cotizaciones", columna, existing_type=tipo, nullable=False)
    op.create_index(op.f("ix_cotizaciones_fecha"), "cotizaciones", ["fecha"], unique=False)

    # Integración: la carpeta se define solo en empresas
    op.execute(
        """
        UPDATE empresas AS e
        SET google_drive_folder_id = i.folder_id
        FROM integraciones_google_drive AS i
        WHERE i.empresa_id = e.id AND e.google_drive_folder_id IS NULL AND i.folder_id IS NOT NULL
        """
    )
    op.drop_column("integraciones_google_drive", "folder_id")


def downgrade() -> None:
    op.add_column("integraciones_google_drive", sa.Column("folder_id", sa.String(length=255), nullable=True))

    op.drop_index(op.f("ix_cotizaciones_fecha"), table_name="cotizaciones")
    for columna, tipo in (("fecha", sa.Date()), ("subtotal", sa.Numeric(15, 2)), ("iva", sa.Numeric(15, 2)), ("total", sa.Numeric(15, 2))):
        op.alter_column("cotizaciones", columna, existing_type=tipo, nullable=True)

    op.drop_constraint("uq_documento_empresa_hash", "documentos", type_="unique")
    op.drop_constraint("uq_documento_empresa_drive", "documentos", type_="unique")
    op.drop_index(op.f("ix_documentos_hash_archivo"), table_name="documentos")
    op.drop_index(op.f("ix_documentos_google_drive_id"), table_name="documentos")
    op.create_index(op.f("ix_documentos_hash_archivo"), "documentos", ["hash_archivo"], unique=True)
    op.create_index(op.f("ix_documentos_google_drive_id"), "documentos", ["google_drive_id"], unique=True)
    op.drop_column("documentos", "metodo_extraccion")

    op.drop_column("items_cotizacion", "unidad")
    op.drop_column("items_cotizacion", "linea")

    op.drop_table("oauth_estados")

    op.drop_index(op.f("ix_usuarios_empresa_id"), table_name="usuarios")
    op.drop_index(op.f("ix_usuarios_email"), table_name="usuarios")
    op.drop_index(op.f("ix_usuarios_id"), table_name="usuarios")
    op.drop_table("usuarios")
