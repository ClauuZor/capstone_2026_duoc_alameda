from fastapi import APIRouter
from sqlalchemy import select

from app.api import mapeo
from app.api.deps import Db, UsuarioActual
from app.models.cliente import Cliente
from app.schemas.cotizacion import ClienteResumen

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("", response_model=list[ClienteResumen])
def listar_clientes(db: Db, usuario: UsuarioActual):
    clientes = db.scalars(
        select(Cliente)
        .where(Cliente.empresa_id == usuario.empresa_id)
        .order_by(Cliente.nombre, Cliente.id)
    ).all()
    return [mapeo.cliente_resumen(c) for c in clientes]
