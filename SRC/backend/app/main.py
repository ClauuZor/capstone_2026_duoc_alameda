import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from urllib.parse import urlparse

from fastapi import APIRouter, FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.clientes import router as clientes_router
from app.api.cotizaciones import router as cotizaciones_router
from app.api.google_drive import google_callback, router as google_router
from app.api.ingesta import router as ingesta_router
from app.api.metricas import router as metricas_router
from app.core.config import settings
from app.db.database import SessionLocal, engine
from app.services.ingesta import sincronizar_todas

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("cotiza")


def _sincronizar_todas() -> None:
    with SessionLocal() as db:
        sincronizar_todas(db)


async def _ingesta_programada(minutos: int) -> None:
    while True:
        await asyncio.sleep(minutos * 60)
        try:
            await run_in_threadpool(_sincronizar_todas)
        except Exception:
            log.exception("Falló la ingesta programada")


@asynccontextmanager
async def lifespan(app: FastAPI):
    tarea = None
    if settings.ingesta_intervalo_minutos > 0:
        log.info("Ingesta programada cada %s minutos", settings.ingesta_intervalo_minutos)
        tarea = asyncio.create_task(_ingesta_programada(settings.ingesta_intervalo_minutos))
    yield
    if tarea:
        tarea.cancel()
        with suppress(asyncio.CancelledError):
            await tarea


app = FastAPI(
    title="Cotiza+ API",
    description="API para procesamiento y análisis de cotizaciones comerciales",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(Exception)
async def error_inesperado(request: Request, exc: Exception):
    # Nunca se exponen trazas ni mensajes internos al cliente.
    log.exception("Error no controlado en %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


api_v1 = APIRouter(prefix="/api/v1")
for router in (auth_router, cotizaciones_router, clientes_router, metricas_router, ingesta_router, google_router):
    api_v1.include_router(router)
app.include_router(api_v1)

# La URI de redirección ya está registrada en Google Cloud, por eso queda fuera de /api/v1.
app.add_api_route(
    urlparse(settings.google_redirect_uri).path or "/google/callback",
    google_callback,
    methods=["GET"],
    tags=["Google Drive"],
    include_in_schema=False,
)


@app.get("/")
def root():
    return {"name": "Cotiza+", "status": "running", "docs": "/docs"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/db-check")
def database_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"database": "connected"}
