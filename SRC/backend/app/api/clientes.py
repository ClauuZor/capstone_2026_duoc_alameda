from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.cliente import Cliente
from app.models.empresa import Empresa
from app.schemas.cliente import ClienteCreate, ClienteResponse


router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"]
)


@router.post("/", response_model=ClienteResponse)
def crear_cliente(
    cliente: ClienteCreate,
    db: Session = Depends(get_db)
):
    # Verificar que la empresa exista
    empresa = (
        db.query(Empresa)
        .filter(Empresa.id == cliente.empresa_id)
        .first()
    )

    if not empresa:
        raise HTTPException(
            status_code=404,
            detail="Empresa no encontrada"
        )

    # Evitar duplicar un cliente dentro de la misma empresa
    if cliente.rut:
        existente = (
            db.query(Cliente)
            .filter(
                Cliente.empresa_id == cliente.empresa_id,
                Cliente.rut == cliente.rut
            )
            .first()
        )

        if existente:
            raise HTTPException(
                status_code=400,
                detail="Ya existe un cliente con ese RUT en esta empresa"
            )

    nuevo_cliente = Cliente(
        empresa_id=cliente.empresa_id,
        rut=cliente.rut,
        nombre=cliente.nombre,
        email=cliente.email
    )

    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)

    return nuevo_cliente


@router.get(
    "/empresa/{empresa_id}",
    response_model=List[ClienteResponse]
)
def listar_clientes_por_empresa(
    empresa_id: int,
    db: Session = Depends(get_db)
):
    # Verificar que la empresa exista
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
        db.query(Cliente)
        .filter(Cliente.empresa_id == empresa_id)
        .order_by(Cliente.id.desc())
        .all()
    )


@router.get(
    "/empresa/{empresa_id}/{cliente_id}",
    response_model=ClienteResponse
)
def obtener_cliente(
    empresa_id: int,
    cliente_id: int,
    db: Session = Depends(get_db)
):
    cliente = (
        db.query(Cliente)
        .filter(
            Cliente.id == cliente_id,
            Cliente.empresa_id == empresa_id
        )
        .first()
    )

    if not cliente:
        raise HTTPException(
            status_code=404,
            detail="Cliente no encontrado"
        )

    return cliente