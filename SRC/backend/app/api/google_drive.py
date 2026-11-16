"""Conexión OAuth 2.0 de cada empresa con su Google Drive (solo lectura).

1. El usuario autenticado llama a POST /api/v1/google/autorizar y el frontend abre la URL devuelta.
2. Google redirige a GOOGLE_REDIRECT_URI (/google/callback), que es público porque
   lo llama el navegador sin token: la empresa se identifica por el `state`, que se
   guarda en la base y es de un solo uso.
3. El refresh token se guarda cifrado en integraciones_google_drive y el navegador
   vuelve a la sección "Google Drive" del frontend con el resultado.
"""
import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select

from app.api.deps import Db, UsuarioActual
from app.core.config import settings
from app.core.security import cifrar
from app.models.integracion_google_drive import IntegracionGoogleDrive
from app.models.oauth_estado import OAuthEstado
from app.models.usuario import Usuario
from app.schemas.ingesta import AutorizacionDrive, CarpetaDrive, EstadoDrive
from app.services.drive import crear_flow

log = logging.getLogger(__name__)

router = APIRouter(prefix="/google", tags=["Google Drive"])

VIGENCIA_ESTADO = timedelta(minutes=15)


def _estado(db, usuario: Usuario) -> EstadoDrive:
    integracion = db.scalar(
        select(IntegracionGoogleDrive).where(
            IntegracionGoogleDrive.empresa_id == usuario.empresa_id, IntegracionGoogleDrive.activa.is_(True)
        )
    )
    carpeta = usuario.empresa.google_drive_folder_id or settings.google_drive_folder_id
    return EstadoDrive(
        google_configurado=settings.google_configurado,
        conectado=integracion is not None,
        carpeta_configurada=bool(carpeta),
        carpeta_id=carpeta,
        fecha_conexion=integracion.fecha_conexion if integracion else None,
    )


@router.get("/estado", response_model=EstadoDrive)
def estado(db: Db, usuario: UsuarioActual):
    return _estado(db, usuario)


def extraer_id_carpeta(valor: str) -> str | None:
    """Acepta el ID o un enlace de Drive (…/folders/<id>, …?id=<id>)."""
    valor = valor.strip()
    m = re.search(r"/folders/([\w-]+)", valor) or re.search(r"[?&]id=([\w-]+)", valor)
    candidato = m.group(1) if m else valor
    return candidato if re.fullmatch(r"[\w-]{10,200}", candidato) else None


@router.put("/carpeta", response_model=EstadoDrive)
def definir_carpeta(datos: CarpetaDrive, db: Db, usuario: UsuarioActual):
    carpeta = extraer_id_carpeta(datos.carpeta)
    if carpeta is None:
        raise HTTPException(status_code=422, detail="No es un ID ni un enlace válido de carpeta de Google Drive")
    usuario.empresa.google_drive_folder_id = carpeta
    db.commit()
    db.refresh(usuario)
    return _estado(db, usuario)


@router.post("/autorizar", response_model=AutorizacionDrive)
def autorizar(db: Db, usuario: UsuarioActual):
    if not settings.google_configurado:
        raise HTTPException(status_code=503, detail="Google Drive no está configurado en el servidor")
    flow = crear_flow()
    url, state = flow.authorization_url(access_type="offline", include_granted_scopes="true", prompt="consent")

    limite = datetime.now(timezone.utc) - VIGENCIA_ESTADO
    db.execute(delete(OAuthEstado).where(OAuthEstado.fecha_creacion < limite))
    db.add(OAuthEstado(state=state, empresa_id=usuario.empresa_id, code_verifier=flow.code_verifier))
    db.commit()
    return AutorizacionDrive(authorization_url=url)


@router.delete("/conexion", status_code=204)
def desconectar(db: Db, usuario: UsuarioActual):
    db.execute(delete(IntegracionGoogleDrive).where(IntegracionGoogleDrive.empresa_id == usuario.empresa_id))
    db.commit()


def _volver(resultado: str, motivo: str | None = None) -> RedirectResponse:
    """Vuelve a la sección Google Drive del frontend con el resultado en la URL."""
    params = {"drive": resultado, **({"motivo": motivo} if motivo else {})}
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/drive?{urlencode(params)}", status_code=303)


def google_callback(
    db: Db,
    state: str = Query(..., max_length=128),
    code: str | None = Query(None),
    error: str | None = Query(None),
):
    """Ruta pública registrada en Google Cloud como URI de redirección."""
    oauth = db.get(OAuthEstado, state)
    if oauth is None:
        return _volver("error", "invalido")
    empresa_id, code_verifier, creado = oauth.empresa_id, oauth.code_verifier, oauth.fecha_creacion
    db.delete(oauth)  # un solo uso
    db.commit()

    if creado < datetime.now(timezone.utc) - VIGENCIA_ESTADO:
        return _volver("error", "vencido")
    if error or not code:
        return _volver("error", "cancelado")
    if not settings.google_configurado:
        return _volver("error", "no_configurado")

    try:
        flow = crear_flow(state=state, code_verifier=code_verifier)
        flow.fetch_token(code=code)
        refresh_token = flow.credentials.refresh_token
    except Exception:
        log.exception("Falló el intercambio del código OAuth (empresa %s)", empresa_id)
        return _volver("error", "rechazado")

    if not refresh_token:
        return _volver("error", "sin_refresh")

    integracion = db.scalar(select(IntegracionGoogleDrive).where(IntegracionGoogleDrive.empresa_id == empresa_id))
    if integracion is None:
        integracion = IntegracionGoogleDrive(empresa_id=empresa_id, refresh_token_encrypted="")
        db.add(integracion)
    integracion.refresh_token_encrypted = cifrar(refresh_token)
    integracion.activa = True
    integracion.fecha_conexion = datetime.now(timezone.utc)
    db.commit()

    return _volver("conectado")
