"""Acceso de solo lectura a Google Drive con el refresh token OAuth de cada empresa."""
from __future__ import annotations

from io import BytesIO

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app.core.config import settings

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
TOKEN_URI = "https://oauth2.googleapis.com/token"
TAMANO_MAXIMO_PDF = 20 * 1024 * 1024  # 20 MB
# Reintentos con espera exponencial ante cortes de red, 429 y 5xx (los hace googleapiclient).
REINTENTOS = 5


def crear_flow(state: str | None = None, code_verifier: str | None = None) -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": TOKEN_URI,
                "redirect_uris": [settings.google_redirect_uri],
            }
        },
        scopes=SCOPES,
        state=state,
        redirect_uri=settings.google_redirect_uri,
        code_verifier=code_verifier,
        autogenerate_code_verifier=code_verifier is None,
    )


def servicio_drive(refresh_token: str):
    credenciales = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=TOKEN_URI,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )
    return build("drive", "v3", credentials=credenciales, cache_discovery=False)


def listar_pdfs(servicio, folder_id: str) -> list[dict]:
    """PDF de la carpeta (sin subcarpetas), con id, name, size y modifiedTime."""
    carpeta = folder_id.replace("\\", "\\\\").replace("'", "\\'")
    consulta = f"'{carpeta}' in parents and mimeType = 'application/pdf' and trashed = false"
    archivos: list[dict] = []
    token = None
    while True:
        respuesta = (
            servicio.files()
            .list(
                q=consulta,
                fields="nextPageToken, files(id, name, size, modifiedTime)",
                pageSize=1000,
                pageToken=token,
                orderBy="createdTime",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute(num_retries=REINTENTOS)
        )
        archivos.extend(respuesta.get("files", []))
        token = respuesta.get("nextPageToken")
        if not token:
            return archivos


def descargar(servicio, file_id: str) -> bytes:
    buffer = BytesIO()
    descarga = MediaIoBaseDownload(buffer, servicio.files().get_media(fileId=file_id, supportsAllDrives=True))
    terminado = False
    while not terminado:
        _, terminado = descarga.next_chunk(num_retries=REINTENTOS)
        if buffer.tell() > TAMANO_MAXIMO_PDF:
            raise ValueError("El PDF supera el tamaño máximo permitido (20 MB)")
    return buffer.getvalue()
