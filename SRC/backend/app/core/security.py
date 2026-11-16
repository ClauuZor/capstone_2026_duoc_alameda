from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

ALGORITMO_JWT = "HS256"


def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def crear_access_token(*, usuario_id: int, email: str, empresa_id: int) -> str:
    ahora = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "uid": usuario_id,
        "emp": empresa_id,
        "iat": ahora,
        "exp": ahora + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITMO_JWT)


def decodificar_access_token(token: str) -> dict:
    """Lanza jwt.PyJWTError si el token es inválido, está vencido o no trae exp."""
    return jwt.decode(
        token,
        settings.secret_key,
        algorithms=[ALGORITMO_JWT],
        options={"require": ["exp", "sub", "uid", "emp"]},
    )


def _fernet() -> Fernet:
    return Fernet(settings.encryption_key.encode("utf-8"))


def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode("utf-8")).decode("utf-8")


def descifrar(texto_cifrado: str) -> str:
    try:
        return _fernet().decrypt(texto_cifrado.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("No se pudo descifrar el token almacenado") from e
