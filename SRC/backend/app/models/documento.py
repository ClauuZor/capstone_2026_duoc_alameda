from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class EstadoDocumento:
    PENDIENTE = "pendiente"
    PROCESADO = "procesado"
    DUPLICADO = "duplicado"
    ERROR = "error"


class Documento(Base):
    """PDF de origen de una cotización, detectado en el Google Drive de una empresa."""

    __tablename__ = "documentos"

    # La unicidad es por empresa: dos empresas pueden tener el mismo archivo.
    __table_args__ = (
        UniqueConstraint("empresa_id", "google_drive_id", name="uq_documento_empresa_drive"),
        UniqueConstraint("empresa_id", "hash_archivo", name="uq_documento_empresa_hash"),
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

    cotizacion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("cotizaciones.id"),
        nullable=True,
        index=True
    )

    google_drive_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )

    nombre_archivo: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    hash_archivo: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True
    )

    estado: Mapped[str] = mapped_column(
        String(30),
        default=EstadoDocumento.PENDIENTE,
        nullable=False
    )

    metodo_extraccion: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True
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

    @property
    def url_drive(self) -> Optional[str]:
        if not self.google_drive_id or self.google_drive_id.startswith("local:"):
            return None
        return f"https://drive.google.com/file/d/{self.google_drive_id}/view"
