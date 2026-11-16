from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import case, distinct, exists, extract, func, select

from app.api import mapeo
from app.api.cotizaciones import FiltrosDep, filtrar_cotizaciones
from app.api.deps import Db, UsuarioActual
from app.models.cliente import Cliente
from app.models.cotizacion import Cotizacion
from app.models.item_cotizacion import ItemCotizacion
from app.schemas.metricas import MetricaDistribucion, MetricaPeriodo, MetricasResumen, OpcionesFiltro

router = APIRouter(prefix="/metricas", tags=["Métricas"])


@router.get("/anios", response_model=list[int])
def anios_disponibles(db: Db, usuario: UsuarioActual):
    anio = extract("year", Cotizacion.fecha)
    filas = db.scalars(
        select(anio).where(Cotizacion.empresa_id == usuario.empresa_id).distinct().order_by(anio.desc())
    ).all()
    return [int(a) for a in filas]


@router.get("/resumen", response_model=MetricasResumen)
def resumen(db: Db, usuario: UsuarioActual, filtros: FiltrosDep):
    con_instalacion = exists().where(
        ItemCotizacion.cotizacion_id == Cotizacion.id, ItemCotizacion.categoria == "Instalación"
    )
    stmt = select(
        func.count(Cotizacion.id),
        func.count(distinct(Cotizacion.cliente_id)),
        func.coalesce(func.sum(Cotizacion.subtotal), 0),
        func.coalesce(func.sum(Cotizacion.total), 0),
        func.coalesce(func.sum(Cotizacion.descuento), 0),
        func.count(case((Cotizacion.descuento > 0, 1))),
        func.count(case((con_instalacion, 1))),
    )
    cantidad, clientes, neto, total, descuento, con_descuento, instalacion = db.execute(
        filtrar_cotizaciones(stmt, usuario.empresa_id, filtros)
    ).one()

    m2 = db.scalar(
        filtrar_cotizaciones(
            select(func.coalesce(func.sum(ItemCotizacion.m2), 0))
            .join(Cotizacion, Cotizacion.id == ItemCotizacion.cotizacion_id)
            .where(ItemCotizacion.es_servicio.is_(False)),
            usuario.empresa_id,
            filtros,
        )
    )
    return MetricasResumen(
        total_cotizaciones=cantidad,
        clientes_unicos=clientes,
        monto_neto_total=mapeo.clp(neto),
        monto_total=mapeo.clp(total),
        descuento_total=mapeo.clp(descuento),
        cotizaciones_con_descuento=con_descuento,
        m2_cotizados=round(float(m2 or 0), 1),
        cotizaciones_con_instalacion=instalacion,
    )


@router.get("/por-periodo", response_model=list[MetricaPeriodo])
def por_periodo(db: Db, usuario: UsuarioActual, filtros: FiltrosDep, granularidad: Literal["mes", "anio"]):
    anio_col = extract("year", Cotizacion.fecha).label("anio")
    columnas = [anio_col]
    if granularidad == "mes":
        columnas.append(extract("month", Cotizacion.fecha).label("mes"))

    stmt = select(*columnas, func.count(Cotizacion.id), func.coalesce(func.sum(Cotizacion.subtotal), 0))
    stmt = filtrar_cotizaciones(stmt, usuario.empresa_id, filtros)
    stmt = stmt.group_by(*columnas).order_by(*columnas)

    resultado = []
    for fila in db.execute(stmt).all():
        if granularidad == "mes":
            a, m, cantidad, monto = fila
            periodo = f"{int(a):04d}-{int(m):02d}"
        else:
            a, cantidad, monto = fila
            periodo = f"{int(a):04d}"
        resultado.append(MetricaPeriodo(periodo=periodo, cantidad=cantidad, monto_neto=mapeo.clp(monto)))
    return resultado


Dimension = Literal["material", "color", "vidrio", "comuna", "vendedor", "tipo_cliente", "cliente", "producto"]


@router.get("/distribucion", response_model=list[MetricaDistribucion])
def distribucion(
    db: Db,
    usuario: UsuarioActual,
    filtros: FiltrosDep,
    dimension: Dimension,
    limite: Annotated[int, Query(ge=1, le=50)] = 10,
):
    """Cotizaciones y monto neto agrupados por un atributo, de mayor a menor monto.

    `producto` agrupa los ítems por categoría (sin servicios): cantidad = unidades, monto = suma de subtotales.
    """
    if dimension == "producto":
        clave = ItemCotizacion.categoria
        stmt = (
            select(clave, func.coalesce(func.sum(ItemCotizacion.cantidad), 0), func.coalesce(func.sum(ItemCotizacion.total), 0))
            .join(Cotizacion, Cotizacion.id == ItemCotizacion.cotizacion_id)
            .where(ItemCotizacion.es_servicio.is_(False), clave.is_not(None))
        )
    else:
        clave = Cliente.nombre if dimension == "cliente" else getattr(Cotizacion, dimension)
        stmt = select(clave, func.count(Cotizacion.id), func.coalesce(func.sum(Cotizacion.subtotal), 0)).where(clave.is_not(None))
        if dimension == "cliente":
            stmt = stmt.join(Cliente, Cliente.id == Cotizacion.cliente_id)

    stmt = filtrar_cotizaciones(stmt, usuario.empresa_id, filtros)
    monto = func.coalesce(func.sum(ItemCotizacion.total if dimension == "producto" else Cotizacion.subtotal), 0)
    filas = db.execute(stmt.group_by(clave).order_by(monto.desc(), clave).limit(limite)).all()
    return [MetricaDistribucion(clave=c, cantidad=int(n), monto_neto=mapeo.clp(m)) for c, n, m in filas]


@router.get("/opciones", response_model=OpcionesFiltro)
def opciones(db: Db, usuario: UsuarioActual):
    """Valores para los filtros por atributo (las comunas, solo las 60 más frecuentes)."""
    resultado = {}
    for atributo in mapeo.ATRIBUTOS:
        columna = getattr(Cotizacion, atributo)
        resultado[atributo] = db.scalars(
            select(columna)
            .where(Cotizacion.empresa_id == usuario.empresa_id, columna.is_not(None))
            .group_by(columna)
            .order_by(func.count().desc(), columna)
            .limit(60 if atributo == "comuna" else 30)
        ).all()
    return OpcionesFiltro(**resultado)
