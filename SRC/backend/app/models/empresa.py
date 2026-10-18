from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Empresa(Base):
    __tablename__ = "empresas"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    nombre: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )

    rut: Mapped[Optional[str]] = mapped_column(
        String(20),
        unique=True,
        nullable=True,
        index=True
    )

    google_drive_folder_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    activa: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    clientes: Mapped[list["Cliente"]] = relationship(
        "Cliente",
        back_populates="empresa"
    )

    cotizaciones: Mapped[list["Cotizacion"]] = relationship(
        "Cotizacion",
        back_populates="empresa"
    )

    documentos: Mapped[list["Documento"]] = relationship(
        "Documento",
        back_populates="empresa"
    )