from decimal import Decimal
from typing import Optional

from sqlalchemy import ForeignKey, Numeric, String, Text
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

    precio_unitario: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )

    total: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )

    cotizacion: Mapped["Cotizacion"] = relationship(
        "Cotizacion",
        back_populates="items"
    )