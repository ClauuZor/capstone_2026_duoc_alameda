from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import false as sa_false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class ItemCotizacion(Base):
    __tablename__ = "items_cotizacion"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    cotizacion_id: Mapped[int] = mapped_column(
        ForeignKey("cotizaciones.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    linea: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    codigo: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )

    descripcion: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    cantidad: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=1
    )

    unidad: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True
    )

    precio_unitario: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )

    # Subtotal de la línea (cantidad × precio unitario), en CLP.
    total: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )

    # Código de la pieza en el plano (V01, P02…).
    denominacion: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Medidas en metros y superficie de la línea (ancho × alto × cantidad).
    ancho_m: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 3), nullable=True)
    alto_m: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 3), nullable=True)
    m2: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    # Corredera, Proyectante, Instalación, Traslado…
    categoria: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    es_servicio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa_false())

    cotizacion: Mapped["Cotizacion"] = relationship(
        "Cotizacion",
        back_populates="items"
    )
