from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.cotizacion import Cotizacion
from app.models.item_cotizacion import ItemCotizacion
from app.schemas.item_cotizacion import (
    ItemCotizacionCreate,
    ItemCotizacionResponse,
)

router = APIRouter(
    prefix="/items",
    tags=["Items Cotizacion"]
)


@router.post("/", response_model=ItemCotizacionResponse)
def crear_item(
    item: ItemCotizacionCreate,
    db: Session = Depends(get_db)
):
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == item.cotizacion_id
    ).first()

    if not cotizacion:
        raise HTTPException(
            status_code=404,
            detail="Cotización no encontrada"
        )

    nuevo_item = ItemCotizacion(
        cotizacion_id=item.cotizacion_id,
        codigo=item.codigo,
        descripcion=item.descripcion,
        cantidad=item.cantidad,
        precio_unitario=item.precio_unitario,
        total=item.total
    )

    db.add(nuevo_item)
    db.commit()
    db.refresh(nuevo_item)

    return nuevo_item


@router.get(
    "/cotizacion/{cotizacion_id}",
    response_model=List[ItemCotizacionResponse]
)
def listar_items_por_cotizacion(
    cotizacion_id: int,
    db: Session = Depends(get_db)
):
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id
    ).first()

    if not cotizacion:
        raise HTTPException(
            status_code=404,
            detail="Cotización no encontrada"
        )

    return db.query(ItemCotizacion).filter(
        ItemCotizacion.cotizacion_id == cotizacion_id
    ).order_by(ItemCotizacion.id.asc()).all()