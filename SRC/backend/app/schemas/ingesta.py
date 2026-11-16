from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ResumenIngesta(BaseModel):
    encontrados: int = 0
    procesados: int = 0
    duplicados: int = 0
    errores: int = 0
    omitidos: int = 0
    """Archivos ya registrados en una sincronización anterior."""


class ProgresoIngesta(BaseModel):
    estado: Literal["inactivo", "en_curso", "terminado", "cancelado", "fallido"]
    encontrados: int = 0
    total: int = 0
    """PDF nuevos (o a reintentar) que se van a procesar en esta sincronización."""
    revisados: int = 0
    procesados: int = 0
    duplicados: int = 0
    errores: int = 0
    omitidos: int = 0
    mensaje: str | None = None
    inicio: datetime | None = None
    fin: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentoResponse(BaseModel):
    id: int
    nombre_archivo: str
    estado: str
    metodo_extraccion: str | None
    error: str | None
    cotizacion_id: int | None
    url_drive: str | None
    fecha_creacion: datetime
    fecha_procesamiento: datetime | None

    model_config = ConfigDict(from_attributes=True)


class EstadoDrive(BaseModel):
    google_configurado: bool
    conectado: bool
    carpeta_configurada: bool
    carpeta_id: str | None
    fecha_conexion: datetime | None


class CarpetaDrive(BaseModel):
    carpeta: str = Field(min_length=1, max_length=500)
    """ID de la carpeta o su enlace (https://drive.google.com/drive/folders/<id>)."""


class AutorizacionDrive(BaseModel):
    authorization_url: str
