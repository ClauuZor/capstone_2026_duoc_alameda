from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Documento(Base):
    __tablename__ = "documentos"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id"),
        nullable=False,
        index=True
    )

    cotizacion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cotizaciones.id"),
        nullable=True,
        index=True
    )

    google_drive_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    nombre_archivo: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    hash_archivo: Mapped[Optional[str]] = mapped_column(
        String(64),
        unique=True,
        nullable=True,
        index=True
    )

    estado: Mapped[str] = mapped_column(
        String(30),
        default="pendiente",
        nullable=False
    )

    error: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    fecha_procesamiento: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    empresa: Mapped["Empresa"] = relationship(
        "Empresa",
        back_populates="documentos"
    )

    cotizacion: Mapped[Optional["Cotizacion"]] = relationship(
        "Cotizacion",
        back_populates="documentos"
    )