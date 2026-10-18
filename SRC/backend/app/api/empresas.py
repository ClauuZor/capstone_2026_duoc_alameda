from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaCreate, EmpresaResponse


router = APIRouter(
    prefix="/empresas",
    tags=["Empresas"]
)


@router.post("/", response_model=EmpresaResponse)
def crear_empresa(
    empresa: EmpresaCreate,
    db: Session = Depends(get_db)
):
    if empresa.rut:
        existente = (
            db.query(Empresa)
            .filter(Empresa.rut == empresa.rut)
            .first()
        )

        if existente:
            raise HTTPException(
                status_code=400,
                detail="Ya existe una empresa con ese RUT"
            )

    nueva_empresa = Empresa(
        nombre=empresa.nombre,
        rut=empresa.rut,
        google_drive_folder_id=empresa.google_drive_folder_id,
        activa=empresa.activa
    )

    db.add(nueva_empresa)
    db.commit()
    db.refresh(nueva_empresa)

    return nueva_empresa


@router.get("/", response_model=List[EmpresaResponse])
def listar_empresas(
    db: Session = Depends(get_db)
):
    return (
        db.query(Empresa)
        .order_by(Empresa.id.desc())
        .all()
    )


@router.get("/{empresa_id}", response_model=EmpresaResponse)
def obtener_empresa(
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

    return empresa