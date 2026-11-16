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

    # Fecha de emisión impresa en el PDF (no la de procesamiento).
    fecha: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True
    )

    # Monto neto (sin IVA). En la API se expone como `monto_neto`.
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False
    )

    iva: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False
    )

    total: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        nullable=False
    )

    moneda: Mapped[str] = mapped_column(
        String(10),
        default="CLP",
        nullable=False
    )

    # Descuento sobre el subtotal; el subtotal antes del descuento es subtotal + descuento.
    descuento: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0, server_default="0")

    # Atributos comerciales extraídos del PDF (opcionales).
    fecha_vencimiento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tipo_cliente: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    comuna: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    direccion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    proyecto: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    material: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    vidrio: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    vendedor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

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