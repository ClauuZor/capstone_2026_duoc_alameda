from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow

from app.core.config import settings


router = APIRouter(
    prefix="/google",
    tags=["Google Drive"]
)


SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly"
]


oauth_flows = {}


def crear_flow(
    state: str | None = None,
    code_verifier: str | None = None
) -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [
                    settings.google_redirect_uri
                ],
            }
        },
        scopes=SCOPES,
        state=state,
        redirect_uri=settings.google_redirect_uri,
        code_verifier=code_verifier,
        autogenerate_code_verifier=code_verifier is None,
    )


@router.get("/login")
def google_login(
    empresa_id: int = Query(...)
):
    flow = crear_flow()

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )

    oauth_flows[state] = {
        "code_verifier": flow.code_verifier,
        "empresa_id": empresa_id,
    }

    return RedirectResponse(authorization_url)


@router.get("/callback")
def google_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    try:
        oauth_data = oauth_flows.pop(state, None)

        if not oauth_data:
            raise HTTPException(
                status_code=400,
                detail="No se encontró el flujo OAuth"
            )

        code_verifier = oauth_data["code_verifier"]
        empresa_id = oauth_data["empresa_id"]

        flow = crear_flow(
            state=state,
            code_verifier=code_verifier,
        )

        flow.fetch_token(code=code)

        credentials = flow.credentials

        return {
            "mensaje": "Google Drive conectado correctamente",
            "empresa_id": empresa_id,
            "access_token_recibido": bool(credentials.token),
            "refresh_token_recibido": bool(credentials.refresh_token),
            "scopes": list(credentials.scopes or []),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error conectando Google Drive: {str(e)}"
        )