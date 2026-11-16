from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class IntegracionGoogleDrive(Base):
    """Conexión OAuth de una empresa con Google Drive.

    La carpeta a revisar se define en Empresa.google_drive_folder_id.
    El refresh token se guarda cifrado con Fernet (ENCRYPTION_KEY).
    """

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
