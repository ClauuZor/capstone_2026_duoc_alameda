from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.cliente import ClienteResponse
from app.schemas.item_cotizacion import ItemCotizacionResponse


class CotizacionBase(BaseModel):
    empresa_id: int
    numero: str
    cliente_id: int
    fecha: Optional[date] = None
    subtotal: Optional[Decimal] = None
    iva: Optional[Decimal] = None
    total: Optional[Decimal] = None
    moneda: str = "CLP"


class CotizacionCreate(CotizacionBase):
    pass


class CotizacionResponse(CotizacionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CotizacionDetalleResponse(CotizacionResponse):
    cliente: ClienteResponse
    items: list[ItemCotizacionResponse]