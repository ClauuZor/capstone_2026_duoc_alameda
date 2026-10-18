from typing import Optional

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Cliente(Base):
    __tablename__ = "clientes"

    __table_args__ = (
        UniqueConstraint(
            "empresa_id",
            "rut",
            name="uq_cliente_empresa_rut"
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id"),
        nullable=False,
        index=True
    )

    rut: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True
    )

    nombre: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )

    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    empresa: Mapped["Empresa"] = relationship(
        "Empresa",
        back_populates="clientes"
    )

    cotizaciones: Mapped[list["Cotizacion"]] = relationship(
        "Cotizacion",
        back_populates="cliente"
    )