"""Extracción de datos de cotizaciones en PDF mediante reglas (expresiones regulares).

Flujo: PDF -> texto (pypdf) -> campos (número, fecha, cliente, RUT, montos, ítems).

Las reglas buscan etiquetas habituales en cotizaciones chilenas ("Cotización N°",
"Fecha", "Cliente/Señores", "RUT", "Neto", "IVA", "Total"). Deben ajustarse con
PDF reales de la empresa: cada ajuste se acompaña de un caso en
tests/test_extraccion.py. El respaldo con IA (Épica 001) se conecta en
`extraer_cotizacion` cuando las reglas no bastan; por ahora no está implementado.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from io import BytesIO

METODO_REGLAS = "reglas"
TASA_IVA = Decimal("0.19")


class ExtraccionError(Exception):
    """El PDF no se pudo leer o le faltan datos obligatorios."""


@dataclass
class ItemExtraido:
    linea: int
    descripcion: str
    cantidad: Decimal
    unidad: str | None
    precio_unitario: int
    subtotal: int
    denominacion: str | None = None
    ancho_m: Decimal | None = None
    alto_m: Decimal | None = None
    m2: Decimal | None = None
    categoria: str | None = None
    es_servicio: bool = False


@dataclass
class DatosCotizacion:
    numero: str
    fecha: date
    cliente_nombre: str
    cliente_rut: str | None
    monto_neto: int
    iva: int
    total: int
    items: list[ItemExtraido] = field(default_factory=list)
    metodo: str = METODO_REGLAS
    # Atributos comerciales (opcionales: los formatos antiguos no siempre los traen).
    fecha_vencimiento: date | None = None
    tipo_cliente: str | None = None
    comuna: str | None = None
    direccion: str | None = None
    proyecto: str | None = None
    material: str | None = None
    color: str | None = None
    vidrio: str | None = None
    vendedor: str | None = None
    descuento: int = 0
    cliente_telefono: str | None = None
    cliente_email: str | None = None


# ---------------------------------------------------------------- texto del PDF


def _texto_pagina(pagina) -> str:
    """Texto en modo "layout": conserva cada fila de la tabla de ítems en una sola línea
    (en el modo normal, la descripción puede quedar lejos de su cantidad y precio).
    Los espacios de alineación se reducen a uno para que las reglas trabajen por línea."""
    try:
        texto = pagina.extract_text(extraction_mode="layout") or ""
    except Exception:
        texto = ""
    if not texto.strip():
        texto = pagina.extract_text() or ""
    lineas = (re.sub(r"[ \t ]+", " ", linea).strip() for linea in texto.splitlines())
    return "\n".join(l for l in lineas if l)


def extraer_texto_pdf(contenido: bytes) -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        lector = PdfReader(BytesIO(contenido))
        if lector.is_encrypted:
            raise ExtraccionError("El PDF está protegido con contraseña")
        texto = "\n".join(_texto_pagina(pagina) for pagina in lector.pages)
    except ExtraccionError:
        raise
    except (PdfReadError, ValueError, KeyError, TypeError) as e:
        raise ExtraccionError("El archivo no es un PDF válido o está dañado") from e

    if not texto.strip():
        # Probablemente un PDF escaneado (imagen): requiere OCR o IA.
        raise ExtraccionError("El PDF no contiene texto seleccionable (¿es un escaneo?)")
    return texto


# ---------------------------------------------------------------- utilidades


def parsear_numero(valor: str) -> Decimal:
    """Convierte "1.234.567", "1,234,567", "1.234.567,50", "23,1" o "23.1" a Decimal."""
    s = valor.strip().replace("$", "").replace(" ", "")
    if not s:
        raise ValueError("vacío")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        partes = s.split(",")
        s = s.replace(",", "") if len(partes) > 2 or len(partes[-1]) == 3 else s.replace(",", ".")
    elif "." in s:
        partes = s.split(".")
        if len(partes) > 2 or len(partes[-1]) == 3:
            s = s.replace(".", "")
    try:
        return Decimal(s)
    except InvalidOperation as e:
        raise ValueError(f"número inválido: {valor!r}") from e


def a_clp(valor: Decimal) -> int:
    return int(valor.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def normalizar_rut(rut: str) -> str | None:
    """Devuelve el RUT como "12.345.678-5" si el dígito verificador es correcto."""
    limpio = re.sub(r"[^0-9kK]", "", rut).upper()
    if len(limpio) < 2:
        return None
    cuerpo, dv = limpio[:-1], limpio[-1]
    if not cuerpo.isdigit():
        return None
    suma, factor = 0, 2
    for d in reversed(cuerpo):
        suma += int(d) * factor
        factor = 2 if factor == 7 else factor + 1
    esperado = 11 - suma % 11
    dv_calc = "0" if esperado == 11 else "K" if esperado == 10 else str(esperado)
    if dv != dv_calc:
        return None
    return f"{int(cuerpo):,}".replace(",", ".") + f"-{dv}"


def _sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}

MONTO = r"\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)"
RUT = r"(\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK])"


# ---------------------------------------------------------------- campos


def extraer_numero(texto: str) -> str | None:
    # De más a menos específico. La forma sin "N°" exige 3 dígitos para no tomar
    # frases como "Validez de la cotización: 15 días".
    patrones = [
        r"cotizaci[oó]n\s*(?:n[°ºo]\.?|nro\.?|n[uú]mero|#)\s*[:\-]?\s*([A-Z]{0,6}-?\d[\w\-/]*)",
        r"(?:n[°ºo]\.?|nro\.?|n[uú]mero)\s*(?:de\s+)?cotizaci[oó]n\s*[:\-]?\s*([A-Z]{0,6}-?\d[\w\-/]*)",
        r"\b(COT[\-\s]?\d[\w\-/]*)",
        r"cotizaci[oó]n\s*[:\-]?\s*([A-Z]{0,6}-?\d{3,}[\w\-/]*)",
    ]
    for patron in patrones:
        m = re.search(patron, texto, re.IGNORECASE)
        if m:
            return re.sub(r"\s+", "-", m.group(1).strip().upper()).rstrip("-/.")
    return None


def _fecha_valida(anio: int, mes: int, dia: int) -> date | None:
    if anio < 100:
        anio += 2000
    try:
        return date(anio, mes, dia)
    except ValueError:
        return None


def extraer_fecha(texto: str) -> date | None:
    etiqueta = r"fecha(?:\s+(?:de\s+)?emisi[oó]n|\s+cot(?:izaci[oó]n)?\.?)?\s*[:\-]?\s*"
    numerica = r"(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})\b"
    iso = r"(\d{4})-(\d{2})-(\d{2})"
    larga = r"(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de(?:l)?\s+)?(\d{4})"

    def desde(m, tipo):
        if tipo == "num":
            return _fecha_valida(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if tipo == "iso":
            return _fecha_valida(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        mes = MESES.get(_sin_tildes(m.group(2).lower()))
        return _fecha_valida(int(m.group(3)), mes, int(m.group(1))) if mes else None

    # Primero con la etiqueta "Fecha" o "Fecha de emisión"; luego cualquier fecha del documento.
    for prefijo in (etiqueta, ""):
        for patron, tipo in ((iso, "iso"), (numerica, "num"), (larga, "larga")):
            for m in re.finditer(prefijo + patron, texto, re.IGNORECASE):
                fecha = desde(m, tipo)
                if fecha:
                    return fecha
    return None


ETIQUETAS_CLIENTE = r"(?:cliente|se[ñn]or(?:es)?|sr(?:es|a)?\.?|raz[oó]n\s+social)"
# "At. Nombre", "Atención: Nombre", "NOMBRE: Nombre" o "NOMBRE Nombre" (dos puntos opcionales).
ETIQUETAS_ATENCION = r"(?:at\.|atte?n\.?|atenci[oó]n\s*:?|nombre(?:\s+(?:del\s+)?cliente)?\s*:?)"
# El encabezado con los datos del cliente termina donde empieza la tabla de ítems; más abajo
# hay otros "NOMBRE:" (datos de transferencia de la empresa) que no son el cliente.
FIN_ENCABEZADO = re.compile(r"^\s*cant(?:idad|\.)(?:\s|$)", re.IGNORECASE)


def extraer_cliente(texto: str, rut_empresa: str | None = None) -> tuple[str | None, str | None]:
    """Devuelve (nombre, rut) del cliente. Ignora el RUT de la empresa emisora."""
    rut_propio = normalizar_rut(rut_empresa) if rut_empresa else None
    lineas = texto.splitlines()

    fin = next((i for i, l in enumerate(lineas) if FIN_ENCABEZADO.search(l)), len(lineas))

    nombre, linea_cliente = None, None
    for i, linea in enumerate(lineas[:fin]):
        m = re.match(rf"\s*{ETIQUETAS_CLIENTE}\s*[:\-]\s*(.+)", linea, re.IGNORECASE) or re.match(
            rf"\s*{ETIQUETAS_ATENCION}\s*(.+)", linea, re.IGNORECASE
        )
        if m:
            # "NOMBRE: Juan Pérez RUT: ..." -> "Juan Pérez"; "NOMBRE: RUT:" -> vacío.
            candidato = re.split(r"(?:^|\s+)r\.?\s*u\.?\s*t\.?(?:\s|:|$)", m.group(1), flags=re.IGNORECASE)[0]
            candidato = candidato.strip(" .,:;-")
            if re.search(r"[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}", candidato):
                nombre, linea_cliente = candidato, i
                break

    def ruts_en(lista):
        for linea in lista:
            for m in re.finditer(RUT, linea):
                rut = normalizar_rut(m.group(1))
                if rut and rut != rut_propio:
                    yield rut

    rut = None
    if linea_cliente is not None:
        # El RUT del cliente suele estar en la misma línea o en las 3 siguientes.
        rut = next(ruts_en(lineas[linea_cliente : linea_cliente + 4]), None)
    if rut is None:
        etiquetadas = [l for l in lineas if re.search(r"cliente", l, re.IGNORECASE)]
        rut = next(ruts_en(etiquetadas), None)
    return nombre, rut


def _ultimo_monto(texto: str, patron_etiqueta: str, excluir=None) -> int | None:
    encontrado = None
    for linea in texto.splitlines():
        # Entre la etiqueta y el monto se admite texto corto como " ($): ".
        for m in re.finditer(patron_etiqueta + r"[^\d\n]{0,15}?" + MONTO, linea, re.IGNORECASE):
            if excluir and excluir(linea, m):
                continue
            try:
                encontrado = a_clp(parsear_numero(m.group(1)))
            except ValueError:
                continue
    return encontrado


def extraer_montos(texto: str) -> tuple[int | None, int | None, int | None]:
    neto = _ultimo_monto(texto, r"(?:\bsub\s*-?\s*total|\btotal\s+neto|\bmonto\s+neto|\bvalor\s+neto|\bneto)\b")
    iva = _ultimo_monto(texto, r"(?:\biva\b|\bi\.v\.a\.?)(?:\s*\(?\s*19\s*%\s*\)?)?")

    def no_es_total_final(linea, m):
        antes = linea[: m.start()]
        resto = linea[m.start():].lower()
        return bool(re.search(r"sub\s*-?\s*$", antes, re.IGNORECASE)) or resto.startswith(("total neto", "total iva"))

    total = _ultimo_monto(texto, r"(?<![\w-])total(?:\s+(?:a\s+pagar|general|final|con\s+iva))?\b", no_es_total_final)
    return neto, iva, total


def cuadrar_montos(neto: int | None, iva: int | None, total: int | None) -> tuple[int, int, int]:
    if neto is not None and iva is not None and total is not None:
        if abs(neto + iva - total) > 2:
            raise ExtraccionError(f"Los montos no cuadran: neto {neto} + IVA {iva} ≠ total {total}")
        return neto, iva, total
    if neto is not None and total is not None:
        return neto, total - neto, total
    if neto is not None and iva is not None:
        return neto, iva, neto + iva
    if total is not None:
        neto = a_clp(Decimal(total) / (1 + TASA_IVA))
        return neto, total - neto, total
    if neto is not None:
        iva = a_clp(Decimal(neto) * TASA_IVA)
        return neto, iva, neto + iva
    raise ExtraccionError("No se encontraron los montos (neto, IVA o total)")


UNIDADES = r"m2|m²|m3|ml|mts?2?|mt|un|und|unid|uds?|u|kg|gl|jgo|pza|c/u|m"
# Precio y total separados por espacio o por "$" (a veces vienen pegados: "$ 1.730.000$ 1.730.000").
_MONTO_ITEM = r"\$?\s*(?P<precio>\d{1,3}(?:\.\d{3})+|\d+)(?:\s+\$?|\s*\$)\s*(?P<subtotal>\d{1,3}(?:\.\d{3})+|\d+)\s*$"
_DESC = r"(?P<desc>.*?[A-Za-zÁÉÍÓÚáéíóúñÑ].*?)"
_CANT = r"(?P<cant>\d+(?:[.,]\d+)?)\s*(?P<unidad>" + UNIDADES + r")?\.?"

# Formatos de fila aceptados (se usa el primero cuyos números cuadren):
ITEMS = [
    # [n°] descripción cantidad [unidad] precio total
    re.compile(r"^\s*(?:\d{1,3}[\s.)\-]+)?" + _DESC + r"\s+" + _CANT + r"\s+" + _MONTO_ITEM, re.IGNORECASE),
    # cantidad [unidad] descripción precio total
    re.compile(r"^\s*" + _CANT + r"\s+" + _DESC + r"\s+" + _MONTO_ITEM, re.IGNORECASE),
]


def _item_de_linea(linea: str, numero: int) -> ItemExtraido | None:
    for patron in ITEMS:
        m = patron.match(linea)
        if not m:
            continue
        try:
            cantidad = parsear_numero(m.group("cant"))
            precio = parsear_numero(m.group("precio"))
            subtotal = parsear_numero(m.group("subtotal"))
        except ValueError:
            continue
        if cantidad <= 0 or subtotal <= 0:
            continue
        if abs(cantidad * precio - subtotal) > max(Decimal(2), subtotal * Decimal("0.01")):
            continue
        unidad = m.group("unidad")
        descripcion = m.group("desc").strip(" .-")
        denominacion = None
        codigo = re.match(r"([A-Z]{1,3}\d{1,3})\s+(.+)", descripcion)
        if codigo:
            denominacion, descripcion = codigo.group(1), codigo.group(2)
        ancho, alto = medidas_en_metros(descripcion)
        categoria, es_servicio = categoria_item(descripcion)
        return ItemExtraido(
            linea=numero,
            descripcion=descripcion,
            cantidad=cantidad,
            unidad=unidad.lower().replace("²", "2") if unidad else None,
            precio_unitario=a_clp(precio),
            subtotal=a_clp(subtotal),
            denominacion=denominacion,
            ancho_m=ancho,
            alto_m=alto,
            m2=(ancho * alto * cantidad).quantize(Decimal("0.01")) if ancho and alto and not es_servicio else None,
            categoria=categoria,
            es_servicio=es_servicio,
        )
    return None


def medidas_en_metros(descripcion: str) -> tuple[Decimal | None, Decimal | None]:
    """"150 x 190" -> (1.50, 1.90). Las unidades varían entre formatos (m, cm o mm):
    valores < 10 son metros, >= 1000 son milímetros, y en el resto se elige cm salvo que
    eso dé una superficie inverosímil para una sola pieza (> 30 m²), en cuyo caso son mm."""
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)", descripcion)
    if not m:
        return None, None
    try:
        a, b = parsear_numero(m.group(1)), parsear_numero(m.group(2))
    except ValueError:
        return None, None
    if a <= 0 or b <= 0:
        return None, None
    if a < 10 and b < 10:
        divisor = Decimal(1)
    elif max(a, b) >= 1000 or a * b / 10_000 > 30:
        divisor = Decimal(1000)
    else:
        divisor = Decimal(100)
    return (a / divisor).quantize(Decimal("0.001")), (b / divisor).quantize(Decimal("0.001"))


# (patrón, categoría, es_servicio). El orden importa: "Desinstalación" antes que "Instalación",
# y "Traslado + Instalación" cuenta como instalación.
CATEGORIAS_ITEM = [
    (r"desinstal|retiro", "Desinstalación", True),
    (r"instalaci", "Instalación", True),
    (r"traslado|flete|despacho", "Traslado", True),
    (r"recargo", "Recargo", True),
    (r"rectificaci|visita", "Visita técnica", True),
    (r"corredera", "Corredera", False),
    (r"proyectante", "Proyectante", False),
    (r"oscilo", "Oscilobatiente", False),
    (r"abatible|batiente", "Abatible", False),
    (r"guillotina", "Guillotina", False),
    (r"bow\s*window", "Bow window", False),
    (r"shower|receptácul", "Shower door", False),
    (r"puerta", "Puerta", False),
    (r"ventanal", "Ventanal", False),
    (r"\bfijo|paño", "Paño fijo", False),
    (r"espejo", "Espejo", False),
    (r"baranda", "Baranda", False),
    (r"mampara", "Mampara", False),
    (r"celos[ií]a", "Celosía", False),
    (r"cierre\s+de\s+terraza|cortina\s+de\s+cristal", "Cierre de terraza", False),
    (r"vidrio|cristal|termopanel", "Vidrio", False),
    (r"ventana", "Ventana", False),
]


def categoria_item(descripcion: str) -> tuple[str | None, bool]:
    for patron, categoria, servicio in CATEGORIAS_ITEM:
        if re.search(patron, descripcion, re.IGNORECASE):
            return categoria, servicio
    return None, False


# --------------------------------------------------------------------------- atributos comerciales

# Etiquetas que delimitan los campos del encabezado ("COMUNA: X TELEFONO: Y").
_CORTES = r"(?:RUT|TEL[EÉ]FONO|E-?MAIL|COMUNA|DIRECCI[OÓ]N|TIPO|PROYECTO|CONTACTO)\b"


def _campo(lineas: list[str], etiqueta: str) -> str | None:
    """Valor de "ETIQUETA: valor" (dos puntos opcionales) hasta la siguiente etiqueta conocida."""
    patron = re.compile(rf"(?:^|\s){etiqueta}\s*[:.]?\s*(.*?)\s*(?=\s{_CORTES}|$)", re.IGNORECASE)
    for linea in lineas:
        m = patron.search(linea)
        if m:
            valor = m.group(1).strip(" .,:;-")
            if valor and valor.upper() not in ("N/A", "NA", "-"):
                return valor
            return None
    return None


def _titulo(texto: str | None) -> str | None:
    if not texto:
        return None
    pequenas = {"de", "del", "la", "las", "los", "y"}
    palabras = texto.strip(" .").lower().split()
    return " ".join(p if i and p in pequenas else p.capitalize() for i, p in enumerate(palabras)) or None


def limpiar_comuna(comuna: str | None) -> str | None:
    """"ñuñoa, R.M." -> "Ñuñoa"; "R.M." o "Región Metropolitana" solos no son una comuna."""
    if not comuna:
        return None
    region = r"(?:r\.?\s*m\.?|regi[oó]n\s+metropolitana|chile)"
    comuna = re.sub(rf"\s*[,.\-]\s*{region}\s*\.?$", "", comuna.strip(" ´`'\""), flags=re.IGNORECASE)
    if not comuna or re.fullmatch(rf"{region}|santiago\s*,?\s*chile", comuna, re.IGNORECASE):
        return None
    return _titulo(comuna)


MATERIALES = [(r"\bPVC\b", "PVC"), (r"alumin|\bAL\s?\d{2}\b|\bAM\s?\d{2}\b|l[ií]nea\s+\d{2}", "Aluminio")]
COLORES = [
    "blanco", "nogal", "antracita", "titanio", "roble", "negro", "mate", "bronce", "gris", "grafito",
    "mañío", "mañio", "champagne", "natural", "plata", "golden oak", "madera", "café",
]
VIDRIOS = [
    (r"termopanel|\bDVH\b", "Termopanel"),
    (r"templad", "Templado"),
    (r"laminad", "Laminado"),
    (r"monol[ií]tic|incoloro|\bmono\b", "Monolítico"),
    (r"espejo", "Espejo"),
]


def _primero(fuentes: list[str | None], opciones: list[tuple[str, str]]) -> str | None:
    for fuente in fuentes:
        if not fuente:
            continue
        for patron, valor in opciones:
            if re.search(patron, fuente, re.IGNORECASE):
                return valor
    return None


def _vendedor(lineas: list[str]) -> str | None:
    """Firma al pie: el nombre está justo antes de la línea con el teléfono de la empresa."""
    nombre = re.compile(r"^[A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ.]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ.]*){1,4}$")
    for i in range(len(lineas) - 1, 0, -1):
        if re.match(r"^(?:TEL[EÉ]FONO\s*:?\s*)?\+?\s*56\s*9", lineas[i], re.IGNORECASE):
            candidato = lineas[i - 1].strip(" .")
            if nombre.match(candidato):
                # "Ana Pérez Soto" y "Ana Pérez S." son la misma persona: nombre, apellido e inicial.
                partes = candidato.split()
                return " ".join(partes[:2]) + (f" {partes[2][0].upper()}." if len(partes) > 2 else "")
    return None


def _fecha_vencimiento(texto: str, emision: date) -> date | None:
    m = re.search(r"fecha\s+venc\w*\.?\s*:?\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})\b", texto, re.IGNORECASE)
    if m:
        fecha = _fecha_valida(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if fecha:
            return fecha
    m = re.search(r"validez\s+de\s+la\s+cotizaci[oó]n\s*:?\s*(\d{1,3})\s*d[ií]as", texto, re.IGNORECASE)
    if m:
        return emision + timedelta(days=int(m.group(1)))
    return None


def extraer_atributos(texto: str, datos: "DatosCotizacion") -> None:
    """Completa los atributos comerciales de `datos` (todos opcionales)."""
    lineas = texto.splitlines()
    # El encabezado termina en la tabla de ítems; si no se reconoce, en las formas de pago.
    fin = next(
        (i for i, l in enumerate(lineas) if FIN_ENCABEZADO.search(l)),
        next((i for i, l in enumerate(lineas) if re.match(r"^\s*FORMAS?\s+DE\s+PAGO", l, re.IGNORECASE)), len(lineas)),
    )
    encabezado = lineas[:fin]

    tipo = (_campo(encabezado, r"TIPO(?!\s+CTA)") or "").upper()
    datos.tipo_cliente = {"PERSONAL": "PARTICULAR", "PERSONA": "PARTICULAR"}.get(tipo, tipo) or None
    datos.proyecto = _campo(encabezado, "PROYECTO")
    comuna = _campo(encabezado, "COMUNA")
    direccion = _campo(encabezado, r"DIRECCI[OÓ]N")
    # En el formato 2024 "DIRECCIÓN" contiene solo la comuna (sin números).
    if not comuna and direccion and not re.search(r"\d", direccion) and len(direccion) <= 30:
        comuna, direccion = direccion, None
    datos.comuna = limpiar_comuna(comuna)
    datos.direccion = direccion

    telefono = _campo(encabezado, r"TEL[EÉ]FONO")
    if telefono and len(re.sub(r"\D", "", telefono)) >= 8:
        datos.cliente_telefono = re.sub(r"[^\d+ ]", "", telefono).strip()
    correo = next((m.group(0) for l in encabezado for m in [re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", l)] if m), None)
    datos.cliente_email = correo.lower() if correo else None

    datos.fecha_vencimiento = _fecha_vencimiento(texto, datos.fecha)
    datos.vendedor = _vendedor(lineas)

    bruto = _ultimo_monto(texto, r"\bsub\s*-?\s*total(?:\s+neto)?")
    if bruto and bruto > datos.monto_neto:
        datos.descuento = bruto - datos.monto_neto

    # Bloque "PROVISIÓN" (2024-2026) o frases del formato 2020.
    # Con ":" o "." tras la etiqueta, para no confundirlas con la tabla fija de plazos ("VIDRIO TEMPLADO 8 - 10 días…").
    perfileria = _campo([l for l in lineas if re.match(r"^\s*PERFILER[IÍ]A\s*[:.]", l, re.IGNORECASE)], r"PERFILER[IÍ]A")
    color_perf = _campo([l for l in lineas if re.match(r"^\s*COLOR\s+PERFILER[IÍ]A\s*[:.]", l, re.IGNORECASE)], r"COLOR\s+PERFILER[IÍ]A")
    vidrios = _campo([l for l in lineas if re.match(r"^\s*VIDRIOS?\s*[:.]", l, re.IGNORECASE)], r"VIDRIOS?")
    frase_perf = next((m.group(1) for l in lineas for m in [re.search(r"perfiler[ií]a\s+usada\s+ser[aá]\s+(.+)", l, re.IGNORECASE)] if m), None)
    frase_vidrio = next((m.group(1) for l in lineas for m in [re.search(r"acristalamiento\s+ser[aá]\s+con\s+(.+)", l, re.IGNORECASE)] if m), None)
    descripciones = " ".join(i.descripcion for i in datos.items if not i.es_servicio)

    datos.material = _primero([perfileria, frase_perf, datos.proyecto, descripciones], MATERIALES)
    datos.vidrio = _primero([vidrios, frase_vidrio, datos.proyecto, descripciones], VIDRIOS)
    if datos.material is None and datos.vidrio and (perfileria is None or perfileria.upper() == "N/A"):
        datos.material = "Solo vidrio"
    datos.color = _primero(
        [color_perf, frase_perf, datos.proyecto, descripciones],
        [(rf"\b{re.escape(c)}\b", _titulo(c)) for c in COLORES],
    )


def extraer_items(texto: str) -> list[ItemExtraido]:
    """Filas de la tabla de ítems. Solo acepta la línea si cantidad × precio ≈ total,
    para descartar falsos positivos."""
    items: list[ItemExtraido] = []
    for linea in texto.splitlines():
        item = _item_de_linea(linea, len(items) + 1)
        if item:
            items.append(item)
    return items


# ---------------------------------------------------------------- orquestación


def extraer_cotizacion(texto: str, rut_empresa: str | None = None) -> DatosCotizacion:
    numero = extraer_numero(texto)
    fecha = extraer_fecha(texto)
    cliente, rut = extraer_cliente(texto, rut_empresa)

    faltantes = [n for n, v in (("número", numero), ("fecha", fecha), ("cliente", cliente)) if not v]
    try:
        neto, iva, total = cuadrar_montos(*extraer_montos(texto))
    except ExtraccionError:
        if not faltantes:
            raise
        faltantes.append("montos")

    if faltantes:
        # Punto de conexión del respaldo con IA: si existiera, se llamaría aquí.
        raise ExtraccionError("No se encontraron: " + ", ".join(faltantes))

    datos = DatosCotizacion(
        numero=numero,
        fecha=fecha,
        cliente_nombre=cliente[:255],
        cliente_rut=rut,
        monto_neto=neto,
        iva=iva,
        total=total,
        items=extraer_items(texto),
    )
    extraer_atributos(texto, datos)
    return datos
