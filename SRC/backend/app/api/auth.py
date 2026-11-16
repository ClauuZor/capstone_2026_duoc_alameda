from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select

from app.api.deps import Db, UsuarioActual
from app.core.security import crear_access_token, hashear_password, verificar_password
from app.models.usuario import Usuario
from app.schemas.auth import TokenResponse, UsuarioResponse

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# Hash de referencia para que un correo inexistente tarde lo mismo que una clave incorrecta.
_HASH_FALSO = hashear_password("cotiza-plus-hash-de-relleno")


@router.post("/login", response_model=TokenResponse)
def login(db: Db, form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    usuario = db.scalar(select(Usuario).where(func.lower(Usuario.email) == form.username.strip().lower()))

    password_ok = verificar_password(form.password, usuario.password_hash if usuario else _HASH_FALSO)
    if not usuario or not password_ok or not usuario.activo or not usuario.empresa.activa:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = crear_access_token(usuario_id=usuario.id, email=usuario.email, empresa_id=usuario.empresa_id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UsuarioResponse)
def me(usuario: UsuarioActual):
    return UsuarioResponse(id=usuario.id, email=usuario.email, nombre=usuario.nombre)
