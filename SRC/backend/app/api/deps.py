from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decodificar_access_token
from app.db.database import get_db
from app.models.usuario import Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

Db = Annotated[Session, Depends(get_db)]


def _no_autorizado() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o sesión vencida",
        headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_actual(db: Db, token: Annotated[str, Depends(oauth2_scheme)]) -> Usuario:
    try:
        payload = decodificar_access_token(token)
    except jwt.PyJWTError:
        raise _no_autorizado()

    usuario = db.get(Usuario, payload["uid"])
    if (
        usuario is None
        or not usuario.activo
        or usuario.email != payload["sub"]
        or usuario.empresa_id != payload["emp"]
        or not usuario.empresa.activa
    ):
        raise _no_autorizado()
    return usuario


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]
