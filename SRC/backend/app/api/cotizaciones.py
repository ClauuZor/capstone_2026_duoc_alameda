from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.empresa import Empresa
from app.models.cliente import Cliente
from app.models.cotizacion import Cotizacion
from app.schemas.cotizacion import (
    CotizacionCreate,
    CotizacionResponse,
    CotizacionDetalleResponse,
)

router = APIRouter(
    prefix="/cotizaciones",
    tags=["Cotizaciones"]
)


@router.post("/", response_model=CotizacionResponse)
def crear_cotizacion(
    cotizacion: CotizacionCreate,
    db: Session = Depends(get_db)
):
    empresa = (
        db.query(Empresa)
        .filter(Empresa.id == cotizacion.empresa_id)
        .first()
    )

    if not empresa:
        raise HTTPException(
            status_code=404,
            detail="Empresa no encontrada"
        )

    cliente = (
        db.query(Cliente)
        .filter(
            Cliente.id == cotizacion.cliente_id,
            Cliente.empresa_id == cotizacion.empresa_id
        )
        .first()
    )

    if not cliente:
        raise HTTPException(
            status_code=404,
            detail="Cliente no encontrado en esta empresa"
        )

    existente = (
        db.query(Cotizacion)
        .filter(
            Cotizacion.empresa_id == cotizacion.empresa_id,
            Cotizacion.numero == cotizacion.numero
        )
        .first()
    )

    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe una cotización con ese número en esta empresa"
        )

    nueva_cotizacion = Cotizacion(
        empresa_id=cotizacion.empresa_id,
        numero=cotizacion.numero,
        cliente_id=cotizacion.cliente_id,
        fecha=cotizacion.fecha,
        subtotal=cotizacion.subtotal,
        iva=cotizacion.iva,
        total=cotizacion.total,
        moneda=cotizacion.moneda
    )

    db.add(nueva_cotizacion)
    db.commit()
    db.refresh(nueva_cotizacion)

    return nueva_cotizacion


@router.get(
    "/empresa/{empresa_id}",
    response_model=List[CotizacionResponse]
)
def listar_cotizaciones_por_empresa(
    empresa_id: int,
    db: Session = Depends(get_db)
):
    empresa = (
        db.query(Empresa)
        .filter(Empresa.id == empresa_id)
        .first()
    )

    if not empresa:
        raise HTTPException(
            status_code=404,
            detail="Empresa no encontrada"
        )

    return (
        db.query(Cotizacion)
        .filter(Cotizacion.empresa_id == empresa_id)
        .order_by(Cotizacion.id.desc())
        .all()
    )


@router.get(
    "/empresa/{empresa_id}/{cotizacion_id}",
    response_model=CotizacionDetalleResponse
)
def obtener_cotizacion(
    empresa_id: int,
    cotizacion_id: int,
    db: Session = Depends(get_db)
):
    cotizacion = (
        db.query(Cotizacion)
        .options(
            joinedload(Cotizacion.cliente),
            joinedload(Cotizacion.items)
        )
        .filter(
            Cotizacion.id == cotizacion_id,
            Cotizacion.empresa_id == empresa_id
        )
        .first()
    )

    if not cotizacion:
        raise HTTPException(
            status_code=404,
            detail="Cotización no encontrada"
        )

    return cotizacion