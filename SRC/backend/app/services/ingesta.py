"""Ingesta de cotizaciones: Drive -> PDF -> extracción -> base de datos, sin duplicados.

Reglas contra duplicados (por empresa):
1. Un archivo de Drive ya registrado no se vuelve a procesar (google_drive_id).
2. Un PDF con el mismo contenido que otro ya procesado se marca "duplicado" (hash SHA-256).
3. Una cotización cuyo número ya existe no se crea de nuevo: el documento queda "duplicado".

Rendimiento: la descarga desde Drive es lo más lento (~0,6 s por PDF), así que varios
hilos descargan y extraen en paralelo (INGESTA_DESCARGAS_PARALELAS), cada uno con su propia
conexión a Drive. La escritura en la base la hace un solo hilo, en orden.

La sincronización iniciada desde la API corre en segundo plano (`iniciar_sincronizacion`)
y su avance se consulta con `progreso_de`.
"""
from __future__ import annotations

import hashlib
import logging
import re
import threading
import unicodedata
from collections import Counter
from collections.abc import Iterator
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import descifrar
from app.db.database import SessionLocal
from app.models.cliente import Cliente
from app.models.cotizacion import Cotizacion
from app.models.documento import Documento, EstadoDocumento
from app.models.empresa import Empresa
from app.models.integracion_google_drive import IntegracionGoogleDrive
from app.models.item_cotizacion import ItemCotizacion
from app.schemas.ingesta import ResumenIngesta
from app.services import drive
from app.services.extraccion import DatosCotizacion, ExtraccionError, extraer_cotizacion, extraer_texto_pdf

log = logging.getLogger(__name__)

# Evita dos sincronizaciones simultáneas de la misma empresa en este proceso.
_bloqueos: dict[int, threading.Lock] = {}
_bloqueos_lock = threading.Lock()


def _bloqueo(empresa_id: int) -> threading.Lock:
    with _bloqueos_lock:
        return _bloqueos.setdefault(empresa_id, threading.Lock())


class IngestaNoDisponible(Exception):
    """Falta configuración (Google, conexión de la empresa o carpeta) o ya hay una en curso."""


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- análisis (sin base de datos)


@dataclass
class Analisis:
    hash_archivo: str
    datos: DatosCotizacion | None = None
    error: str | None = None


def analizar_pdf(contenido: bytes, rut_empresa: str | None) -> Analisis:
    """Hash + extracción. No toca la base, así que puede correr en paralelo."""
    hash_archivo = hashlib.sha256(contenido).hexdigest()
    try:
        return Analisis(hash_archivo, datos=extraer_cotizacion(extraer_texto_pdf(contenido), rut_empresa))
    except ExtraccionError as e:
        return Analisis(hash_archivo, error=str(e))
    except Exception:
        log.exception("Error inesperado leyendo un PDF")
        return Analisis(hash_archivo, error="Error inesperado al leer el PDF")


# --------------------------------------------------------------------------- guardado (un solo hilo)


def _obtener_o_crear_cliente(db: Session, empresa_id: int, datos: DatosCotizacion) -> Cliente:
    cliente = None
    if datos.cliente_rut:
        cliente = db.scalar(select(Cliente).where(Cliente.empresa_id == empresa_id, Cliente.rut == datos.cliente_rut))
    if cliente is None:
        # Mismo nombre: si el PDF trae RUT, solo se reutiliza un cliente que aún no tenga RUT.
        stmt = select(Cliente).where(
            Cliente.empresa_id == empresa_id,
            func.lower(Cliente.nombre) == datos.cliente_nombre.lower(),
        )
        if datos.cliente_rut:
            stmt = stmt.where(Cliente.rut.is_(None))
        cliente = db.scalars(stmt.order_by(Cliente.id)).first()
        if cliente is not None and datos.cliente_rut:
            cliente.rut = datos.cliente_rut
    if cliente is None:
        cliente = Cliente(empresa_id=empresa_id, nombre=datos.cliente_nombre, rut=datos.cliente_rut)
        db.add(cliente)
        db.flush()
    return cliente


def _items_desde(datos: DatosCotizacion) -> list[ItemCotizacion]:
    return [
        ItemCotizacion(
            linea=i.linea,
            descripcion=i.descripcion,
            cantidad=i.cantidad,
            unidad=i.unidad,
            precio_unitario=i.precio_unitario,
            total=i.subtotal,
            denominacion=i.denominacion,
            ancho_m=i.ancho_m,
            alto_m=i.alto_m,
            m2=i.m2,
            categoria=i.categoria,
            es_servicio=i.es_servicio,
        )
        for i in datos.items
    ]


def clave_texto(texto: str) -> str:
    """Para comparar nombres sin tildes, mayúsculas ni puntos: "Ramírez H." == "ramirez h"."""
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ]+", " ", sin_tildes.lower()).strip()


def con_tildes(texto: str) -> int:
    return sum(1 for c in texto if ord(c) > 127)


def _canonizar(db: Session, empresa_id: int, campo: str, valor: str | None) -> str | None:
    """Si ya existe el mismo valor escrito distinto (tildes, mayúsculas), usa una sola escritura:
    la que tiene tildes ("Maipú" antes que "Maipu")."""
    if not valor:
        return valor
    columna = getattr(Cotizacion, campo)
    existentes = db.scalars(
        select(columna).where(Cotizacion.empresa_id == empresa_id, columna.is_not(None)).group_by(columna).order_by(func.count().desc())
    ).all()
    clave = clave_texto(valor)
    iguales = [e for e in existentes if clave_texto(e) == clave] + [valor]
    return max(iguales, key=con_tildes)


def _asignar_datos(cotizacion: Cotizacion, datos: DatosCotizacion) -> None:
    """Copia fecha, montos, atributos e ítems extraídos a la cotización."""
    cotizacion.fecha = datos.fecha
    cotizacion.subtotal = datos.monto_neto
    cotizacion.iva = datos.iva
    cotizacion.total = datos.total
    cotizacion.descuento = datos.descuento
    for campo in ("fecha_vencimiento", "tipo_cliente", "comuna", "direccion", "proyecto", "material", "color", "vidrio", "vendedor"):
        valor = getattr(datos, campo)
        setattr(cotizacion, campo, valor[:255] if isinstance(valor, str) else valor)
    cotizacion.items = _items_desde(datos)


def _completar_contacto(cliente: Cliente, datos: DatosCotizacion) -> None:
    if datos.cliente_telefono and not cliente.telefono:
        cliente.telefono = datos.cliente_telefono[:30]
    if datos.cliente_email and not cliente.email:
        cliente.email = datos.cliente_email[:255]


def _aplicar_analisis(
    db: Session,
    empresa_id: int,
    *,
    google_drive_id: str,
    nombre_archivo: str,
    analisis: Analisis,
    reprocesar: bool = False,
) -> Documento:
    """Deja el Documento procesado o duplicado. Lanza ExtraccionError si el análisis falló. No hace commit.

    Con `reprocesar`, un documento ya procesado actualiza su cotización con lo que se extrajo ahora
    (útil cuando mejoran las reglas). Si la nueva extracción falla, se conserva lo anterior.
    """
    if analisis.datos:
        for campo in ("vendedor", "comuna"):
            setattr(analisis.datos, campo, _canonizar(db, empresa_id, campo, getattr(analisis.datos, campo)))

    documento = db.scalar(
        select(Documento).where(Documento.empresa_id == empresa_id, Documento.google_drive_id == google_drive_id)
    )
    if documento is None:
        documento = Documento(empresa_id=empresa_id, google_drive_id=google_drive_id, nombre_archivo=nombre_archivo[:255])
        db.add(documento)
    elif documento.estado in (EstadoDocumento.PROCESADO, EstadoDocumento.DUPLICADO):
        if reprocesar and documento.estado == EstadoDocumento.PROCESADO and documento.cotizacion and analisis.datos:
            _asignar_datos(documento.cotizacion, analisis.datos)
            _completar_contacto(documento.cotizacion.cliente, analisis.datos)
            documento.metodo_extraccion = analisis.datos.metodo
            documento.fecha_procesamiento = _ahora()
            db.flush()
        return documento  # ya registrado: sin reprocesar, procesar de nuevo no cambia nada
    documento.nombre_archivo = nombre_archivo[:255]
    documento.error = None
    documento.hash_archivo = None
    documento.fecha_procesamiento = _ahora()
    db.flush()

    igual = db.scalar(
        select(Documento).where(
            Documento.empresa_id == empresa_id,
            Documento.hash_archivo == analisis.hash_archivo,
            Documento.id != documento.id,
        )
    )
    if igual is not None:
        documento.estado = EstadoDocumento.DUPLICADO
        documento.cotizacion_id = igual.cotizacion_id
        documento.error = f"Mismo contenido que «{igual.nombre_archivo}»"
        return documento

    if analisis.error or analisis.datos is None:
        raise ExtraccionError(analisis.error or "No se pudo extraer la cotización")
    datos = analisis.datos
    documento.hash_archivo = analisis.hash_archivo
    documento.metodo_extraccion = datos.metodo

    existente = db.scalar(
        select(Cotizacion).where(Cotizacion.empresa_id == empresa_id, Cotizacion.numero == datos.numero)
    )
    if existente is not None:
        documento.estado = EstadoDocumento.DUPLICADO
        documento.cotizacion_id = existente.id
        documento.error = f"La cotización {datos.numero} ya estaba registrada"
        return documento

    cliente = _obtener_o_crear_cliente(db, empresa_id, datos)
    _completar_contacto(cliente, datos)
    cotizacion = Cotizacion(empresa_id=empresa_id, numero=datos.numero, cliente_id=cliente.id, moneda="CLP")
    _asignar_datos(cotizacion, datos)
    db.add(cotizacion)
    db.flush()

    documento.cotizacion_id = cotizacion.id
    documento.estado = EstadoDocumento.PROCESADO
    return documento


def _registrar_error(db: Session, empresa_id: int, google_drive_id: str, nombre_archivo: str, mensaje: str) -> None:
    documento = db.scalar(
        select(Documento).where(Documento.empresa_id == empresa_id, Documento.google_drive_id == google_drive_id)
    )
    if documento is None:
        documento = Documento(empresa_id=empresa_id, google_drive_id=google_drive_id, nombre_archivo=nombre_archivo[:255])
        db.add(documento)
    documento.estado = EstadoDocumento.ERROR
    documento.hash_archivo = None
    documento.cotizacion_id = None
    documento.error = mensaje[:1000]
    documento.fecha_procesamiento = _ahora()


def guardar_analisis(
    db: Session, empresa_id: int, *, google_drive_id: str, nombre_archivo: str, analisis: Analisis, reprocesar: bool = False
) -> str:
    """Guarda el resultado de un PDF con commit propio. Devuelve el estado final del documento."""
    try:
        documento = _aplicar_analisis(
            db, empresa_id, google_drive_id=google_drive_id, nombre_archivo=nombre_archivo, analisis=analisis, reprocesar=reprocesar
        )
        db.commit()
        return documento.estado
    except ExtraccionError as e:
        db.rollback()
        mensaje = str(e)
    except Exception:
        db.rollback()
        log.exception("Error inesperado guardando %s (empresa %s)", nombre_archivo, empresa_id)
        mensaje = "Error inesperado al guardar la cotización"
    _registrar_error(db, empresa_id, google_drive_id, nombre_archivo, mensaje)
    db.commit()
    return EstadoDocumento.ERROR


def procesar_y_guardar(db: Session, empresa: Empresa, *, google_drive_id: str, nombre_archivo: str, contenido: bytes) -> str:
    """Procesa un PDF ya descargado (usado por la CLI con archivos locales)."""
    analisis = analizar_pdf(contenido, empresa.rut)
    return guardar_analisis(db, empresa.id, google_drive_id=google_drive_id, nombre_archivo=nombre_archivo, analisis=analisis)


# --------------------------------------------------------------------------- descarga en paralelo


@dataclass
class ResultadoArchivo:
    archivo: dict
    analisis: Analisis | None = None
    error_descarga: str | None = None


def _descargar_y_analizar(
    refresh_token: str,
    archivos: list[dict],
    rut_empresa: str | None,
    cancelar: threading.Event | None = None,
) -> Iterator[ResultadoArchivo]:
    """Descarga y analiza en varios hilos; entrega los resultados a medida que terminan.

    Mantiene acotada la cantidad de PDF en memoria (2 por hilo). Si se cancela, deja de
    pedir archivos nuevos y termina los que ya estaban en curso.
    """
    hilos = max(1, settings.ingesta_descargas_paralelas)
    local = threading.local()  # el cliente de Drive (httplib2) no es seguro entre hilos

    def trabajo(archivo: dict) -> ResultadoArchivo:
        if int(archivo.get("size") or 0) > drive.TAMANO_MAXIMO_PDF:
            return ResultadoArchivo(archivo, error_descarga="El PDF supera 20 MB")
        if not hasattr(local, "servicio"):
            local.servicio = drive.servicio_drive(refresh_token)
        try:
            contenido = drive.descargar(local.servicio, archivo["id"])
        except Exception:
            log.warning("No se pudo descargar %s", archivo["id"], exc_info=True)
            return ResultadoArchivo(archivo, error_descarga="No se pudo descargar desde Drive")
        return ResultadoArchivo(archivo, analisis=analizar_pdf(contenido, rut_empresa))

    pendientes = iter(archivos)
    with ThreadPoolExecutor(max_workers=hilos, thread_name_prefix="ingesta") as pool:
        en_curso = set()

        def llenar():
            while len(en_curso) < hilos * 2 and not (cancelar and cancelar.is_set()):
                archivo = next(pendientes, None)
                if archivo is None:
                    return
                en_curso.add(pool.submit(trabajo, archivo))

        llenar()
        while en_curso:
            listos, _ = wait(en_curso, return_when=FIRST_COMPLETED)
            for futuro in listos:
                en_curso.discard(futuro)
                yield futuro.result()
            llenar()


# --------------------------------------------------------------------------- sincronización


@dataclass
class Progreso:
    """Avance de una sincronización. Se lee desde la API mientras corre en otro hilo."""

    empresa_id: int
    estado: str = "en_curso"  # en_curso | terminado | cancelado | fallido
    encontrados: int = 0
    total: int = 0  # PDF nuevos (o a reintentar) que se van a procesar
    revisados: int = 0
    procesados: int = 0
    duplicados: int = 0
    errores: int = 0
    omitidos: int = 0
    mensaje: str | None = None
    inicio: datetime = field(default_factory=_ahora)
    fin: datetime | None = None
    cancelar: threading.Event = field(default_factory=threading.Event, repr=False)

    def contar(self, estado: str) -> None:
        self.revisados += 1
        if estado == EstadoDocumento.PROCESADO:
            self.procesados += 1
        elif estado == EstadoDocumento.DUPLICADO:
            self.duplicados += 1
        else:
            self.errores += 1


def _preparar(db: Session, empresa: Empresa) -> tuple[str, str]:
    """Valida la configuración y devuelve (refresh_token, carpeta)."""
    if not settings.google_configurado:
        raise IngestaNoDisponible("Google Drive no está configurado en el servidor")
    integracion = db.scalar(
        select(IntegracionGoogleDrive).where(
            IntegracionGoogleDrive.empresa_id == empresa.id, IntegracionGoogleDrive.activa.is_(True)
        )
    )
    if integracion is None:
        raise IngestaNoDisponible("La empresa no ha conectado Google Drive")
    carpeta = empresa.google_drive_folder_id or settings.google_drive_folder_id
    if not carpeta:
        raise IngestaNoDisponible("La empresa no tiene una carpeta de Google Drive configurada")
    return descifrar(integracion.refresh_token_encrypted), carpeta


def sincronizar_empresa(
    db: Session,
    empresa: Empresa,
    *,
    reintentar_errores: bool = False,
    reprocesar: bool = False,
    progreso: Progreso | None = None,
) -> ResumenIngesta:
    """Revisa la carpeta de Drive de la empresa y procesa los PDF nuevos (bloqueante).

    `reprocesar` vuelve a leer todos los PDF (también los ya procesados) y actualiza sus
    cotizaciones con las reglas actuales; implica reintentar los que tenían error.
    """
    refresh_token, carpeta = _preparar(db, empresa)
    progreso = progreso or Progreso(empresa_id=empresa.id)

    bloqueo = _bloqueo(empresa.id)
    if not bloqueo.acquire(blocking=False):
        raise IngestaNoDisponible("Ya hay una sincronización en curso para esta empresa")
    try:
        archivos = drive.listar_pdfs(drive.servicio_drive(refresh_token), carpeta)
        registrados = dict(
            db.execute(select(Documento.google_drive_id, Documento.estado).where(Documento.empresa_id == empresa.id)).all()
        )
        reintentar_errores = reintentar_errores or reprocesar
        pendientes = [
            a
            for a in archivos
            if a["id"] not in registrados
            or (reintentar_errores and registrados[a["id"]] == EstadoDocumento.ERROR)
            or (reprocesar and registrados[a["id"]] == EstadoDocumento.PROCESADO)
        ]
        progreso.encontrados = len(archivos)
        progreso.omitidos = len(archivos) - len(pendientes)
        progreso.total = len(pendientes)
        log.info("Ingesta empresa %s: %s PDF, %s por procesar", empresa.id, len(archivos), len(pendientes))

        empresa_id, rut = empresa.id, empresa.rut
        for r in _descargar_y_analizar(refresh_token, pendientes, rut, progreso.cancelar):
            if r.error_descarga:
                _registrar_error(db, empresa_id, r.archivo["id"], r.archivo["name"], r.error_descarga)
                db.commit()
                progreso.contar(EstadoDocumento.ERROR)
            else:
                estado = guardar_analisis(
                    db,
                    empresa_id,
                    google_drive_id=r.archivo["id"],
                    nombre_archivo=r.archivo["name"],
                    analisis=r.analisis,
                    reprocesar=reprocesar,
                )
                progreso.contar(estado)

        resumen = ResumenIngesta(
            encontrados=progreso.encontrados,
            procesados=progreso.procesados,
            duplicados=progreso.duplicados,
            errores=progreso.errores,
            omitidos=progreso.omitidos,
        )
        log.info("Ingesta empresa %s terminada: %s", empresa_id, resumen.model_dump())
        return resumen
    finally:
        bloqueo.release()


# Trabajos en segundo plano (uno por empresa). Viven en memoria: si el servidor se
# reinicia, la sincronización se corta, pero todo lo ya guardado se mantiene.
_trabajos: dict[int, Progreso] = {}
_trabajos_lock = threading.Lock()


def progreso_de(empresa_id: int) -> Progreso | None:
    return _trabajos.get(empresa_id)


def iniciar_sincronizacion(empresa_id: int, *, reintentar_errores: bool = False, reprocesar: bool = False) -> Progreso:
    with _trabajos_lock:
        actual = _trabajos.get(empresa_id)
        if actual and actual.estado == "en_curso":
            raise IngestaNoDisponible("Ya hay una sincronización en curso para esta empresa")
        with SessionLocal() as db:
            empresa = db.get(Empresa, empresa_id)
            _preparar(db, empresa)  # falla rápido si falta configuración
        progreso = Progreso(empresa_id=empresa_id)
        _trabajos[empresa_id] = progreso

    def ejecutar():
        with SessionLocal() as db:
            try:
                sincronizar_empresa(
                    db, db.get(Empresa, empresa_id), reintentar_errores=reintentar_errores, reprocesar=reprocesar, progreso=progreso
                )
                progreso.estado = "cancelado" if progreso.cancelar.is_set() else "terminado"
            except IngestaNoDisponible as e:
                progreso.estado, progreso.mensaje = "fallido", str(e)
            except Exception:
                db.rollback()
                log.exception("Falló la sincronización de la empresa %s", empresa_id)
                progreso.estado, progreso.mensaje = "fallido", "No se pudo acceder a Google Drive. Inténtalo de nuevo."
            finally:
                progreso.fin = _ahora()

    threading.Thread(target=ejecutar, name=f"sincronizacion-{empresa_id}", daemon=True).start()
    return progreso


def cancelar_sincronizacion(empresa_id: int) -> Progreso | None:
    progreso = _trabajos.get(empresa_id)
    if progreso and progreso.estado == "en_curso":
        progreso.cancelar.set()
    return progreso


def sincronizar_todas(db: Session) -> None:
    """Usado por la tarea programada: sincroniza cada empresa activa con Drive conectado."""
    empresas = db.scalars(
        select(Empresa)
        .join(IntegracionGoogleDrive, IntegracionGoogleDrive.empresa_id == Empresa.id)
        .where(Empresa.activa.is_(True), IntegracionGoogleDrive.activa.is_(True))
    ).all()
    for empresa in empresas:
        try:
            sincronizar_empresa(db, empresa)
        except IngestaNoDisponible as e:
            log.info("Empresa %s omitida: %s", empresa.id, e)
        except Exception:
            db.rollback()
            log.exception("Falló la sincronización de la empresa %s", empresa.id)


# --------------------------------------------------------------------------- prueba en seco


def probar_extraccion(db: Session, empresa: Empresa, *, limite: int = 200) -> dict:
    """Descarga y extrae una muestra de la carpeta SIN escribir en la base.

    Sirve para medir cuántos PDF reconocen las reglas antes de una sincronización completa.
    """
    refresh_token, carpeta = _preparar(db, empresa)
    archivos = drive.listar_pdfs(drive.servicio_drive(refresh_token), carpeta)
    # Muestra repartida en toda la carpeta (distintos años y formatos).
    paso = max(1, len(archivos) // limite) if limite else 1
    muestra = archivos[::paso][:limite]

    errores: Counter[str] = Counter()
    ejemplos: dict[str, str] = {}
    extraidos = sin_items = 0
    for r in _descargar_y_analizar(refresh_token, muestra, empresa.rut):
        mensaje = r.error_descarga or (r.analisis.error if r.analisis else None)
        if mensaje:
            errores[mensaje] += 1
            ejemplos.setdefault(mensaje, r.archivo["name"])
        else:
            extraidos += 1
            sin_items += not r.analisis.datos.items
    return {
        "pdf_en_carpeta": len(archivos),
        "muestra": len(muestra),
        "extraidos": extraidos,
        "sin_items": sin_items,
        "errores": [{"mensaje": m, "cantidad": n, "ejemplo": ejemplos[m]} for m, n in errores.most_common()],
    }
