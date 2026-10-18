from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class EmpresaBase(BaseModel):
    nombre: str
    rut: Optional[str] = None
    google_drive_folder_id: Optional[str] = None
    activa: bool = True


class EmpresaCreate(EmpresaBase):
    pass


class EmpresaResponse(EmpresaBase):
    id: int
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)