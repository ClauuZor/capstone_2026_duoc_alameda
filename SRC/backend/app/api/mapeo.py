"""Conversión de modelos SQLAlchemy a los esquemas del contrato (montos como int)."""
from decimal import ROUND_HALF_UP, Decimal

from app.models.cliente import Cliente
from app.models.cotizacion import Cotizacion
from app.models.item_cotizacion import ItemCotizacion
from app.schemas.cotizacion import (
    ClienteResumen,
    CotizacionDetalle,
    CotizacionResumen,
    DocumentoOrigen,
    ItemCotizacion as ItemSchema,
)


def clp(valor: Decimal | int | None) -> int:
    if valor is None:
        return 0
    return int(Decimal(valor).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def cliente_resumen(cliente: Cliente) -> ClienteResumen:
    return ClienteResumen(id=cliente.id, nombre=cliente.nombre, rut=cliente.rut)


ATRIBUTOS = ("tipo_cliente", "comuna", "material", "color", "vidrio", "vendedor")


def cotizacion_resumen(cotizacion: Cotizacion, cantidad_items: int) -> CotizacionResumen:
    return CotizacionResumen(
        id=cotizacion.id,
        numero=cotizacion.numero,
        fecha=cotizacion.fecha,
        cliente=cliente_resumen(cotizacion.cliente),
        cantidad_items=cantidad_items,
        monto_neto=clp(cotizacion.subtotal),
        iva=clp(cotizacion.iva),
        total=clp(cotizacion.total),
        descuento=clp(cotizacion.descuento),
        **{a: getattr(cotizacion, a) for a in ATRIBUTOS},
    )


def _float(valor: Decimal | None) -> float | None:
    return float(valor) if valor is not None else None


def item(item: ItemCotizacion) -> ItemSchema:
    return ItemSchema(
        id=item.id,
        linea=item.linea,
        descripcion=item.descripcion,
        cantidad=float(item.cantidad),
        unidad=item.unidad,
        precio_unitario=clp(item.precio_unitario),
        subtotal=clp(item.total),
        denominacion=item.denominacion,
        ancho_m=_float(item.ancho_m),
        alto_m=_float(item.alto_m),
        m2=_float(item.m2),
        categoria=item.categoria,
        es_servicio=item.es_servicio,
    )


def cotizacion_detalle(cotizacion: Cotizacion) -> CotizacionDetalle:
    items = sorted(cotizacion.items, key=lambda i: (i.linea, i.id))
    resumen = cotizacion_resumen(cotizacion, len(items))

    # El PDF que originó la cotización (el procesado, no los duplicados).
    documentos = sorted(cotizacion.documentos, key=lambda d: (d.estado != "procesado", d.id))
    if documentos:
        documento = DocumentoOrigen(nombre_archivo=documentos[0].nombre_archivo, url_drive=documentos[0].url_drive)
    else:
        documento = DocumentoOrigen(nombre_archivo="Sin documento de origen", url_drive=None)

    return CotizacionDetalle(
        **resumen.model_dump(),
        items=[item(i) for i in items],
        documento=documento,
        proyecto=cotizacion.proyecto,
        direccion=cotizacion.direccion,
        fecha_vencimiento=cotizacion.fecha_vencimiento,
        cliente_telefono=cotizacion.cliente.telefono,
        cliente_email=cotizacion.cliente.email,
        subtotal_bruto=clp(cotizacion.subtotal) + clp(cotizacion.descuento),
    )
