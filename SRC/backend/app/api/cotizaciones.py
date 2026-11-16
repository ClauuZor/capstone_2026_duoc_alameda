from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func, or_, select
from sqlalchemy.orm import joinedload, selectinload

from app.api import mapeo
from app.api.deps import Db, UsuarioActual
from app.models.cliente import Cliente
from app.models.cotizacion import Cotizacion
from app.models.item_cotizacion import ItemCotizacion
from app.schemas.cotizacion import CotizacionDetalle, CotizacionResumen, Pagina

router = APIRouter(prefix="/cotizaciones", tags=["Cotizaciones"])

Texto = Annotated[str | None, Query(max_length=100)]


@dataclass
class Filtros:
    """Filtros comunes del listado y de las métricas (parámetros de consulta)."""

    cliente_id: Annotated[int | None, Query(gt=0)] = None
    anio: Annotated[int | None, Query(ge=2000, le=2100)] = None
    material: Texto = None
    color: Texto = None
    vidrio: Texto = None
    comuna: Texto = None
    vendedor: Texto = None
    tipo_cliente: Texto = None


FiltrosDep = Annotated[Filtros, Depends()]


def filtrar_cotizaciones(stmt, empresa_id: int, filtros: Filtros | None = None):
    """Aplica los filtros. Siempre limita a la empresa del usuario."""
    stmt = stmt.where(Cotizacion.empresa_id == empresa_id)
    if filtros is None:
        return stmt
    if filtros.cliente_id is not None:
        stmt = stmt.where(Cotizacion.cliente_id == filtros.cliente_id)
    if filtros.anio is not None:
        stmt = stmt.where(extract("year", Cotizacion.fecha) == filtros.anio)
    for atributo in mapeo.ATRIBUTOS:
        valor = getattr(filtros, atributo)
        if valor:
            stmt = stmt.where(getattr(Cotizacion, atributo) == valor)
    return stmt


@router.get("", response_model=Pagina[CotizacionResumen])
def listar_cotizaciones(
    db: Db,
    usuario: UsuarioActual,
    filtros: FiltrosDep,
    q: Annotated[str | None, Query(max_length=100)] = None,
    monto_min: Annotated[int | None, Query(ge=0)] = None,
    monto_max: Annotated[int | None, Query(ge=0)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    cantidad_items = (
        select(func.count(ItemCotizacion.id))
        .where(ItemCotizacion.cotizacion_id == Cotizacion.id)
        .correlate(Cotizacion)
        .scalar_subquery()
    )

    stmt = select(Cotizacion, cantidad_items).join(Cotizacion.cliente)
    stmt = filtrar_cotizaciones(stmt, usuario.empresa_id, filtros)
    if monto_min is not None:
        stmt = stmt.where(Cotizacion.subtotal >= monto_min)
    if monto_max is not None:
        stmt = stmt.where(Cotizacion.subtotal <= monto_max)

    if q and q.strip():
        patron = f"%{q.strip()}%"
        # El RUT se compara también sin puntos, para encontrar "12345678-9" y "12.345.678-9".
        rut_sin_puntos = func.replace(Cliente.rut, ".", "")
        stmt = stmt.where(
            or_(
                Cotizacion.numero.ilike(patron),
                Cliente.nombre.ilike(patron),
                Cliente.rut.ilike(patron),
                rut_sin_puntos.ilike(f"%{q.strip().replace('.', '')}%"),
                Cotizacion.proyecto.ilike(patron),
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))

    filas = db.execute(
        stmt.options(joinedload(Cotizacion.cliente))
        .order_by(Cotizacion.fecha.desc(), Cotizacion.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return Pagina[CotizacionResumen](
        items=[mapeo.cotizacion_resumen(cot, n) for cot, n in filas],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


@router.get("/{cotizacion_id}", response_model=CotizacionDetalle)
def obtener_cotizacion(cotizacion_id: int, db: Db, usuario: UsuarioActual):
    cotizacion = db.scalar(
        select(Cotizacion)
        .options(
            joinedload(Cotizacion.cliente),
            selectinload(Cotizacion.items),
            selectinload(Cotizacion.documentos),
        )
        .where(Cotizacion.id == cotizacion_id, Cotizacion.empresa_id == usuario.empresa_id)
    )

    # Una cotización de otra empresa responde 404, igual que una inexistente.
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    return mapeo.cotizacion_detalle(cotizacion)
