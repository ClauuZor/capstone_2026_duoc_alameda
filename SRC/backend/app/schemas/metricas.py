from pydantic import BaseModel


class MetricasResumen(BaseModel):
    total_cotizaciones: int
    clientes_unicos: int
    monto_neto_total: int
    monto_total: int = 0
    """Suma de totales con IVA."""
    descuento_total: int = 0
    cotizaciones_con_descuento: int = 0
    m2_cotizados: float = 0
    """Superficie de los ítems que traen medidas (sin servicios)."""
    cotizaciones_con_instalacion: int = 0


class MetricaPeriodo(BaseModel):
    periodo: str
    cantidad: int
    monto_neto: int


class MetricaDistribucion(BaseModel):
    clave: str
    cantidad: int
    """Cotizaciones; en la dimensión "producto", unidades cotizadas."""
    monto_neto: int


class OpcionesFiltro(BaseModel):
    """Valores existentes de cada atributo, del más al menos frecuente."""

    material: list[str]
    color: list[str]
    vidrio: list[str]
    comuna: list[str]
    vendedor: list[str]
    tipo_cliente: list[str]
