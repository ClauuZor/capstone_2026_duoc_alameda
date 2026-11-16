from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from typing import Annotated


class Settings(BaseSettings):
    database_url: str

    # Seguridad
    secret_key: str
    """Clave para firmar los JWT. Generar con: python -c "import secrets; print(secrets.token_urlsafe(48))"."""
    encryption_key: str
    """Clave Fernet para cifrar el refresh token de Google. Generar con:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"."""
    access_token_expire_minutes: int = 60
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Google Drive (OAuth 2.0 por empresa)
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str = "http://127.0.0.1:8000/google/callback"
    google_drive_folder_id: str | None = None
    """Carpeta por defecto si la empresa no tiene una propia."""
    frontend_url: str = "http://localhost:5173"

    # Ingesta automática: cada cuántos minutos se revisa Drive (0 = desactivada).
    ingesta_intervalo_minutos: int = 0
    # Descargas simultáneas desde Drive durante la sincronización.
    ingesta_descargas_paralelas: int = 8

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _separar_origenes(cls, valor):
        if isinstance(valor, str):
            return [o.strip() for o in valor.split(",") if o.strip()]
        return valor

    @property
    def google_configurado(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)


settings = Settings()
