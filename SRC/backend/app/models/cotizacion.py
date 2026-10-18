from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    __table_args__ = (
        UniqueConstraint(
            "empresa_id",
            "numero",
            name="uq_cotizacion_empresa_numero"
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

    numero: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )

    cliente_id: Mapped[int] = mapped_column(
        ForeignKey("clientes.id"),
        nullable=False,
        index=True
    )

    fecha: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True
    )

    subtotal: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )

    iva: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )

    total: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )

    moneda: Mapped[str] = mapped_column(
        String(10),
        default="CLP",
        nullable=False
    )

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    empresa: Mapped["Empresa"] = relationship(
        "Empresa",
        back_populates="cotizaciones"
    )

    cliente: Mapped["Cliente"] = relationship(
        "Cliente",
        back_populates="cotizaciones"
    )

    items: Mapped[list["ItemCotizacion"]] = relationship(
        "ItemCotizacion",
        back_populates="cotizacion",
        cascade="all, delete-orphan"
    )

    documentos: Mapped[list["Documento"]] = relationship(
        "Documento",
        back_populates="cotizacion"
    )