from fastapi import FastAPI
from sqlalchemy import text

from app.db.database import engine
from app.api.clientes import router as clientes_router
from app.api.cotizaciones import router as cotizaciones_router
from app.api.items_cotizacion import router as items_router
from app.api.empresas import router as empresas_router
from app.api.google_drive import router as google_drive_router


app = FastAPI(
    title="Cotiza+ API",
    description="API para procesamiento y análisis de cotizaciones comerciales",
    version="0.1.0",
)


app.include_router(clientes_router)
app.include_router(cotizaciones_router)
app.include_router(items_router)
app.include_router(empresas_router)
app.include_router(google_drive_router)

@app.get("/")
def root():
    return {
        "name": "Cotiza+",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }


@app.get("/db-check")
def database_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "database": "connected"
    }