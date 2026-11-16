"""Esquemas de respuesta del contrato de API (SRC/docs/contrato-api.md).

Los montos se exponen como enteros (CLP). Pydantic v2 serializa Decimal como
string, por eso los esquemas usan int y la conversión se hace en app.api.mapeo.
"""
from datetime import date
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ClienteResumen(BaseModel):
    id: int
    nombre: str
    rut: str | None


class AtributosCotizacion(BaseModel):
    """Atributos comerciales extraídos del PDF; null si el formato no los trae."""

    tipo_cliente: str | None = None
    comuna: str | None = None
    material: str | None = None
    color: str | None = None
    vidrio: str | None = None
    vendedor: str | None = None


class CotizacionResumen(AtributosCotizacion):
    id: int
    numero: str
    fecha: date
    cliente: ClienteResumen
    cantidad_items: int
    monto_neto: int
    iva: int
    total: int
    descuento: int = 0


class ItemCotizacion(BaseModel):
    id: int
    linea: int
    descripcion: str
    cantidad: float
    unidad: str | None
    precio_unitario: int
    subtotal: int
    denominacion: str | None = None
    ancho_m: float | None = None
    alto_m: float | None = None
    m2: float | None = None
    categoria: str | None = None
    es_servicio: bool = False


class DocumentoOrigen(BaseModel):
    nombre_archivo: str
    url_drive: str | None


class CotizacionDetalle(CotizacionResumen):
    items: list[ItemCotizacion]
    documento: DocumentoOrigen
    proyecto: str | None = None
    direccion: str | None = None
    fecha_vencimiento: date | None = None
    cliente_telefono: str | None = None
    cliente_email: str | None = None
    subtotal_bruto: int


class Pagina(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
