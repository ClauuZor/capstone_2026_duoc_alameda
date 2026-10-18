from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ItemCotizacionBase(BaseModel):
    cotizacion_id: int
    codigo: Optional[str] = None
    descripcion: str
    cantidad: Decimal
    precio_unitario: Optional[Decimal] = None
    total: Optional[Decimal] = None


class ItemCotizacionCreate(ItemCotizacionBase):
    pass


class ItemCotizacionResponse(ItemCotizacionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)