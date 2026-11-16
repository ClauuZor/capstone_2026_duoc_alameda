import logging
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.api.deps import Db, UsuarioActual
from app.models.documento import Documento
from app.schemas.cotizacion import Pagina
from app.schemas.ingesta import DocumentoResponse, ProgresoIngesta
from app.services.ingesta import IngestaNoDisponible, cancelar_sincronizacion, iniciar_sincronizacion, progreso_de

log = logging.getLogger(__name__)

router = APIRouter(tags=["Ingesta"])


def _respuesta(progreso) -> ProgresoIngesta:
    if progreso is None:
        return ProgresoIngesta(estado="inactivo")
    return ProgresoIngesta.model_validate(progreso)


@router.post("/ingesta/sincronizar", response_model=ProgresoIngesta, status_code=202)
def sincronizar(usuario: UsuarioActual, reintentar_errores: bool = False, reprocesar: bool = False):
    """Inicia en segundo plano la revisión de la carpeta de Drive. El avance se consulta en /ingesta/progreso.

    `reprocesar=true` vuelve a leer todos los PDF y actualiza las cotizaciones con las reglas actuales.
    """
    try:
        return _respuesta(
            iniciar_sincronizacion(usuario.empresa_id, reintentar_errores=reintentar_errores, reprocesar=reprocesar)
        )
    except IngestaNoDisponible as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/ingesta/progreso", response_model=ProgresoIngesta)
def progreso(usuario: UsuarioActual):
    return _respuesta(progreso_de(usuario.empresa_id))


@router.post("/ingesta/cancelar", response_model=ProgresoIngesta)
def cancelar(usuario: UsuarioActual):
    """Deja de descargar PDF nuevos; los que ya estaban en curso se terminan de guardar."""
    progreso = cancelar_sincronizacion(usuario.empresa_id)
    if progreso is None or progreso.estado != "en_curso":
        raise HTTPException(status_code=409, detail="No hay una sincronización en curso")
    return _respuesta(progreso)


@router.get("/documentos", response_model=Pagina[DocumentoResponse])
def listar_documentos(
    db: Db,
    usuario: UsuarioActual,
    estado: Literal["pendiente", "procesado", "duplicado", "error"] | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Seguimiento de los PDF detectados y su resultado."""
    stmt = select(Documento).where(Documento.empresa_id == usuario.empresa_id)
    if estado:
        stmt = stmt.where(Documento.estado == estado)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    documentos = db.scalars(
        stmt.order_by(Documento.fecha_creacion.desc(), Documento.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Pagina[DocumentoResponse](
        items=[DocumentoResponse.model_validate(d) for d in documentos],
        total=total or 0,
        page=page,
        page_size=page_size,
    )
