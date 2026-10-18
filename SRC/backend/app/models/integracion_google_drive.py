from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class IntegracionGoogleDrive(Base):
    __tablename__ = "integraciones_google_drive"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    folder_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    refresh_token_encrypted: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    activa: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    fecha_conexion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    empresa: Mapped["Empresa"] = relationship(
        "Empresa"
    )