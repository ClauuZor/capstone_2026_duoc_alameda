from typing import Optional

from pydantic import BaseModel, ConfigDict


class ClienteBase(BaseModel):
    empresa_id: int
    rut: Optional[str] = None
    nombre: str
    email: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteResponse(ClienteBase):
    id: int

    model_config = ConfigDict(from_attributes=True)