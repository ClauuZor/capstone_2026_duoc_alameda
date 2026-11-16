"""Comandos de administración de Cotiza+.

    python -m app.cli crear-empresa --nombre "Vidrios Ejemplo" --rut 76.123.456-0 --carpeta <folder_id>
    python -m app.cli crear-usuario --empresa-id 1 --email admin@empresa.cl --nombre "Admin"
    python -m app.cli carpeta --empresa-id 1 --carpeta <folder_id>
    python -m app.cli sincronizar --empresa-id 1 [--reintentar-errores]
    python -m app.cli probar-extraccion --empresa-id 1 [--limite 200]
    python -m app.cli procesar-pdf --empresa-id 1 ruta/a/cotizacion.pdf [...]
    python -m app.cli seed-demo
"""
from __future__ import annotations

import argparse
import getpass
import hashlib
import random
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.core.security import hashear_password
from app.db.database import SessionLocal
from app.models import Cliente, Cotizacion, Documento, Empresa, EstadoDocumento, ItemCotizacion, Usuario
from app.services.extraccion import normalizar_rut
from app.services.ingesta import IngestaNoDisponible, probar_extraccion, procesar_y_guardar, sincronizar_empresa


def _empresa(db, empresa_id: int) -> Empresa:
    empresa = db.get(Empresa, empresa_id)
    if empresa is None:
        sys.exit(f"No existe la empresa {empresa_id}")
    return empresa


def crear_empresa(args) -> None:
    rut = None
    if args.rut:
        rut = normalizar_rut(args.rut)
        if rut is None:
            sys.exit("RUT inválido (revisa el dígito verificador)")
    with SessionLocal() as db:
        empresa = Empresa(nombre=args.nombre, rut=rut, google_drive_folder_id=args.carpeta, activa=True)
        db.add(empresa)
        db.commit()
        print(f"Empresa creada con id {empresa.id}")


def crear_usuario(args) -> None:
    password = args.password or getpass.getpass("Contraseña: ")
    if len(password) < 8:
        sys.exit("La contraseña debe tener al menos 8 caracteres")
    with SessionLocal() as db:
        _empresa(db, args.empresa_id)
        email = args.email.strip().lower()
        if db.scalar(select(Usuario).where(Usuario.email == email)):
            sys.exit("Ya existe un usuario con ese correo")
        usuario = Usuario(
            empresa_id=args.empresa_id, email=email, nombre=args.nombre, password_hash=hashear_password(password)
        )
        db.add(usuario)
        db.commit()
        print(f"Usuario creado con id {usuario.id}")


def carpeta(args) -> None:
    with SessionLocal() as db:
        empresa = _empresa(db, args.empresa_id)
        empresa.google_drive_folder_id = args.carpeta
        db.commit()
        print("Carpeta actualizada")


def sincronizar(args) -> None:
    with SessionLocal() as db:
        try:
            resumen = sincronizar_empresa(db, _empresa(db, args.empresa_id), reintentar_errores=args.reintentar_errores)
        except IngestaNoDisponible as e:
            sys.exit(str(e))
        print(resumen.model_dump())


def probar(args) -> None:
    """Mide cuántos PDF reconocen las reglas, con una muestra de Drive y sin guardar nada."""
    import json
    import time

    with SessionLocal() as db:
        inicio = time.perf_counter()
        try:
            resultado = probar_extraccion(db, _empresa(db, args.empresa_id), limite=args.limite)
        except IngestaNoDisponible as e:
            sys.exit(str(e))
        resultado["segundos"] = round(time.perf_counter() - inicio, 1)
        print(json.dumps(resultado, ensure_ascii=False, indent=2))


def unificar_nombres(args) -> None:
    """Unifica variantes de vendedor y comuna ya guardadas ("Ramirez" / "Ramírez") a la escritura más frecuente."""
    from collections import Counter, defaultdict

    from sqlalchemy import func, update

    from app.services.extraccion import limpiar_comuna
    from app.services.ingesta import clave_texto, con_tildes

    with SessionLocal() as db:
        # Primero se limpian las comunas guardadas ("Ñuñoa, R.m" -> "Ñuñoa").
        for (valor,) in db.execute(select(Cotizacion.comuna).where(Cotizacion.empresa_id == args.empresa_id, Cotizacion.comuna.is_not(None)).distinct()).all():
            limpia = limpiar_comuna(valor)
            if limpia != valor:
                db.execute(update(Cotizacion).where(Cotizacion.empresa_id == args.empresa_id, Cotizacion.comuna == valor).values(comuna=limpia))
        db.flush()

        for campo in ("vendedor", "comuna"):
            columna = getattr(Cotizacion, campo)
            conteos = db.execute(
                select(columna, func.count()).where(Cotizacion.empresa_id == args.empresa_id, columna.is_not(None)).group_by(columna)
            ).all()
            grupos: dict[str, Counter] = defaultdict(Counter)
            for valor, n in conteos:
                grupos[clave_texto(valor)][valor] = n
            for variantes in grupos.values():
                if len(variantes) < 2:
                    continue
                # La escritura con tildes; a igualdad, la más frecuente.
                canonico = max(variantes, key=lambda v: (con_tildes(v), variantes[v]))
                otras = [v for v in variantes if v != canonico]
                db.execute(
                    update(Cotizacion)
                    .where(Cotizacion.empresa_id == args.empresa_id, columna.in_(otras))
                    .values({campo: canonico})
                )
                print(f"{campo}: {otras} -> {canonico!r}")
        db.commit()


def procesar_pdf(args) -> None:
    """Procesa PDF locales con el mismo pipeline que Drive (útil para ajustar las reglas)."""
    with SessionLocal() as db:
        empresa = _empresa(db, args.empresa_id)
        for ruta in args.archivos:
            contenido = Path(ruta).read_bytes()
            id_local = "local:" + hashlib.sha256(contenido).hexdigest()[:32]
            estado = procesar_y_guardar(
                db, empresa, google_drive_id=id_local, nombre_archivo=Path(ruta).name, contenido=contenido
            )
            doc = db.scalar(select(Documento).where(Documento.empresa_id == empresa.id, Documento.google_drive_id == id_local))
            detalle = f" ({doc.error})" if doc and doc.error else ""
            print(f"{Path(ruta).name}: {estado}{detalle}")


# --------------------------------------------------------------------------- demo

CLIENTES_DEMO = [
    ("Constructora Andes Sur SpA", "76.354.211-5"),
    ("Hotel Bahía Serena", "77.581.952-9"),
    ("Inmobiliaria Los Robles Ltda.", "78.112.630-4"),
    ("Clínica Santa Elena S.A.", "96.874.320-1"),
    ("Restaurante El Muelle", "77.902.115-3"),
    ("Colegio San Agustín", "65.110.876-2"),
    ("Oficinas Torre Alameda", "76.998.412-6"),
    ("María José Fuentes", "15.432.876-5"),
]

PRODUCTOS_DEMO = [
    ("Ventana corredera aluminio línea 20, cristal 5 mm", "un", 89_000, 260_000),
    ("Baranda cristal templado 10 mm con perfil U", "ml", 120_000, 180_000),
    ("Shower door cristal templado 8 mm", "un", 220_000, 420_000),
    ("Espejo biselado 4 mm a medida", "m2", 45_000, 75_000),
    ("Ventanal termopanel DVH 5-12-5", "m2", 110_000, 190_000),
    ("Puerta aluminio línea 45 con cerradura", "un", 280_000, 520_000),
    ("Fachada cristal templado 10 mm", "m2", 160_000, 240_000),
    ("Instalación y sellado con silicona estructural", "gl", 60_000, 250_000),
    ("Mampara de oficina cristal 6 mm", "m2", 95_000, 150_000),
    ("Celosía de aluminio para ventilación", "un", 35_000, 70_000),
]


def _rut_valido(rut: str) -> str:
    """Corrige el dígito verificador de los RUT de ejemplo."""
    cuerpo = rut.replace(".", "").split("-")[0]
    for dv in "0123456789K":
        normal = normalizar_rut(f"{cuerpo}-{dv}")
        if normal:
            return normal
    raise ValueError(rut)


def seed_demo(args) -> None:
    rng = random.Random(42)
    with SessionLocal() as db:
        if db.scalar(select(Usuario).where(Usuario.email == args.email)):
            sys.exit(f"Ya existe el usuario {args.email}; los datos demo ya están cargados")

        empresa = Empresa(nombre="Vidrios y Aluminios Demo", rut=_rut_valido("76.543.210-0"), activa=True)
        db.add(empresa)
        db.flush()
        db.add(
            Usuario(
                empresa_id=empresa.id,
                email=args.email,
                nombre="Usuario Demo",
                password_hash=hashear_password(args.password),
            )
        )

        clientes = [Cliente(empresa_id=empresa.id, nombre=n, rut=_rut_valido(r)) for n, r in CLIENTES_DEMO]
        db.add_all(clientes)
        db.flush()

        inicio = date(2023, 1, 1)
        dias = (date(2025, 12, 31) - inicio).days
        fechas = sorted(inicio + timedelta(days=rng.randint(0, dias)) for _ in range(args.cantidad))
        for n, fecha in enumerate(fechas, start=1):
            numero = f"COT-{fecha.year}-{n:04d}"
            cot = Cotizacion(
                empresa_id=empresa.id, numero=numero, cliente_id=rng.choice(clientes).id, fecha=fecha,
                subtotal=0, iva=0, total=0, moneda="CLP",
            )
            neto = 0
            for linea, (desc, unidad, pmin, pmax) in enumerate(rng.sample(PRODUCTOS_DEMO, rng.randint(1, 6)), start=1):
                cantidad = Decimal(rng.randint(1, 12)) if unidad in ("un", "gl") else Decimal(rng.randint(10, 400)) / 10
                precio = rng.randrange(pmin, pmax, 100)
                subtotal = int((cantidad * precio).to_integral_value())
                neto += subtotal
                cot.items.append(
                    ItemCotizacion(linea=linea, descripcion=desc, cantidad=cantidad, unidad=unidad,
                                   precio_unitario=precio, total=subtotal)
                )
            iva = round(neto * 0.19)
            cot.subtotal, cot.iva, cot.total = neto, iva, neto + iva
            db.add(cot)
            db.flush()
            db.add(
                Documento(
                    empresa_id=empresa.id, cotizacion_id=cot.id, google_drive_id=f"local:demo-{n:04d}",
                    nombre_archivo=f"Cotizacion_{numero}.pdf", estado=EstadoDocumento.PROCESADO,
                    metodo_extraccion="reglas", fecha_procesamiento=fecha,
                )
            )
        db.commit()
        print(f"Empresa demo {empresa.id} con {args.cantidad} cotizaciones. Usuario: {args.email} / {args.password}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="Administración de Cotiza+")
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("crear-empresa")
    p.add_argument("--nombre", required=True)
    p.add_argument("--rut")
    p.add_argument("--carpeta", help="ID de la carpeta de Google Drive")
    p.set_defaults(func=crear_empresa)

    p = sub.add_parser("crear-usuario")
    p.add_argument("--empresa-id", type=int, required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--nombre", required=True)
    p.add_argument("--password", help="Si se omite, se pide por consola")
    p.set_defaults(func=crear_usuario)

    p = sub.add_parser("carpeta", help="Define la carpeta de Google Drive de una empresa")
    p.add_argument("--empresa-id", type=int, required=True)
    p.add_argument("--carpeta", required=True)
    p.set_defaults(func=carpeta)

    p = sub.add_parser("sincronizar", help="Procesa los PDF nuevos de la carpeta de Drive")
    p.add_argument("--empresa-id", type=int, required=True)
    p.add_argument("--reintentar-errores", action="store_true")
    p.set_defaults(func=sincronizar)

    p = sub.add_parser("probar-extraccion", help="Prueba las reglas con una muestra de Drive, sin guardar nada")
    p.add_argument("--empresa-id", type=int, required=True)
    p.add_argument("--limite", type=int, default=200)
    p.set_defaults(func=probar)

    p = sub.add_parser("unificar-nombres", help="Unifica variantes de vendedor y comuna (tildes, mayúsculas)")
    p.add_argument("--empresa-id", type=int, required=True)
    p.set_defaults(func=unificar_nombres)

    p = sub.add_parser("procesar-pdf", help="Procesa PDF locales (para probar la extracción)")
    p.add_argument("--empresa-id", type=int, required=True)
    p.add_argument("archivos", nargs="+")
    p.set_defaults(func=procesar_pdf)

    p = sub.add_parser("seed-demo", help="Crea una empresa, un usuario y cotizaciones de ejemplo")
    p.add_argument("--email", default="demo@cotiza.test")
    p.add_argument("--password", default="demo1234")
    p.add_argument("--cantidad", type=int, default=150)
    p.set_defaults(func=seed_demo)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
