from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class OAuthEstado(Base):
    """Flujo OAuth de Google en curso (entre /google/autorizar y /google/callback).

    Se guarda en la base de datos para que sobreviva a reinicios del servidor
    y funcione con varios procesos. Se elimina al usarse o al vencer.
    """

    __tablename__ = "oauth_estados"

    state: Mapped[str] = mapped_column(String(128), primary_key=True)

    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )

    code_verifier: Mapped[str] = mapped_column(String(128), nullable=False)

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
