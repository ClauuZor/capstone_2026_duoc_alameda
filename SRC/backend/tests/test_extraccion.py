from datetime import date
from decimal import Decimal

import pytest

from app.services.extraccion import (
    ExtraccionError,
    cuadrar_montos,
    extraer_cliente,
    extraer_cotizacion,
    extraer_fecha,
    extraer_items,
    extraer_montos,
    extraer_numero,
    extraer_texto_pdf,
    normalizar_rut,
    parsear_numero,
)
from tests.pdf_simple import generar_pdf

LINEAS_COTIZACION = [
    "VIDRIOS Y ALUMINIOS DEMO SPA",
    "RUT: 76.543.210-3",
    "COTIZACIÓN N° COT-2024-0192",
    "Fecha de emisión: 19/10/2024",
    "Fecha de vencimiento: 18/11/2024",
    "Señores: Hotel Bahía Serena",
    "RUT: 77.581.952-9",
    "N° Descripción Cantidad Unidad Precio Unitario Total",
    "1 Baranda cristal templado 10 mm con perfil U 23,1 ml 155.100 3.582.810",
    "2 Ventana corredera aluminio línea 20 4 un 120.000 480.000",
    "3 Instalación y sellado 1 gl 250.000 250.000",
    "Subtotal: $ 4.312.810",
    "IVA (19%): $ 819.434",
    "Total: $ 5.132.244",
]
TEXTO = "\n".join(LINEAS_COTIZACION)


@pytest.mark.parametrize(
    "entrada, esperado",
    [
        ("1.234.567", Decimal("1234567")),
        ("1,234,567", Decimal("1234567")),
        ("1.234.567,50", Decimal("1234567.50")),
        ("23,1", Decimal("23.1")),
        ("23.1", Decimal("23.1")),
        ("155.100", Decimal("155100")),
        ("$ 480.000", Decimal("480000")),
        ("4", Decimal("4")),
    ],
)
def test_parsear_numero(entrada, esperado):
    assert parsear_numero(entrada) == esperado


def test_normalizar_rut():
    assert normalizar_rut("77581952-9") == "77.581.952-9"
    assert normalizar_rut("77.581.952-0") is None  # dígito verificador incorrecto
    assert normalizar_rut("5.126.663-3") == "5.126.663-3"


def test_numero_y_fecha():
    assert extraer_numero(TEXTO) == "COT-2024-0192"
    assert extraer_numero("Cotización Nro. 1534") == "1534"
    assert extraer_numero("N° de cotización: 88-B") == "88-B"
    assert extraer_fecha(TEXTO) == date(2024, 10, 19)  # emisión, no vencimiento
    assert extraer_fecha("Santiago, 3 de marzo de 2025") == date(2025, 3, 3)
    assert extraer_fecha("Fecha: 2025-01-31") == date(2025, 1, 31)


def test_cliente_ignora_rut_de_la_empresa():
    nombre, rut = extraer_cliente(TEXTO, rut_empresa="76.543.210-3")
    assert nombre == "Hotel Bahía Serena"
    assert rut == "77.581.952-9"


def test_cliente_con_rut_en_la_misma_linea():
    nombre, rut = extraer_cliente("Cliente: Constructora Andes SpA  RUT 76.354.211-4")
    assert nombre == "Constructora Andes SpA"
    assert rut == "76.354.211-4"


def test_montos_no_confunde_subtotal_con_total():
    assert extraer_montos(TEXTO) == (4312810, 819434, 5132244)


def test_cuadrar_montos():
    assert cuadrar_montos(100000, None, None) == (100000, 19000, 119000)
    assert cuadrar_montos(None, None, 119000) == (100000, 19000, 119000)
    with pytest.raises(ExtraccionError):
        cuadrar_montos(100000, 19000, 200000)
    with pytest.raises(ExtraccionError):
        cuadrar_montos(None, None, None)


def test_items():
    items = extraer_items(TEXTO)
    assert [i.linea for i in items] == [1, 2, 3]
    assert items[0].descripcion == "Baranda cristal templado 10 mm con perfil U"
    assert items[0].cantidad == Decimal("23.1")
    assert items[0].unidad == "ml"
    assert (items[0].precio_unitario, items[0].subtotal) == (155100, 3582810)
    assert items[1].unidad == "un" and items[1].cantidad == 4


def test_items_descarta_lineas_que_no_cuadran():
    assert extraer_items("Teléfono 22 555 1234 9876") == []
    assert extraer_items("1 Ventana 2 un 100.000 999.999") == []


def test_cotizacion_completa():
    datos = extraer_cotizacion(TEXTO, rut_empresa="76.543.210-3")
    assert datos.numero == "COT-2024-0192"
    assert datos.cliente_rut == "77.581.952-9"
    assert (datos.monto_neto, datos.iva, datos.total) == (4312810, 819434, 5132244)
    assert len(datos.items) == 3


def test_cotizacion_incompleta_indica_lo_que_falta():
    with pytest.raises(ExtraccionError, match="número, fecha"):
        extraer_cotizacion("Señores: Alguien\nTotal: 119.000")


def test_desde_pdf_real():
    texto = extraer_texto_pdf(generar_pdf(LINEAS_COTIZACION))
    datos = extraer_cotizacion(texto, rut_empresa="76.543.210-3")
    assert datos.numero == "COT-2024-0192"
    assert datos.cliente_nombre == "Hotel Bahía Serena"
    assert datos.total == 5132244
    assert len(datos.items) == 3


# Formato de las cotizaciones reales de la empresa (texto en modo layout, datos inventados).
TEXTO_FORMATO_TALLER = """COTIZACION N°00167-2020
27-02-2020
At. Juan Pérez G.
PRESENTE.-
De nuestra consideración, se presenta cotización de productos TALLER, que se detalla a continuación:
CANTIDAD DETALLE Precio Unitario ($) Total ($)
1 Ventana corredera color titanio 1.09 x 1.02 Cristal 5mm 79.100 79.100
2 Ventana proyectante AL25 blanco 0.60 x 0.40 40.000 80.000
-
SUBTOTAL NETO ($) 159.100
Plazo de entrega: Máximo 10 días hábiles. DESCUENTO ($) 10.000
VALOR NETO 149.100
Validez de la cotización: 15 días. I.V.A. ($) 28.329
TOTAL ($) 177.429
2. Estado de pago 2 (Termino): 50% saldo final. $ 88.715 NOMBRE: TALLER
RUT: 76.111.111 - 6
3. Tarjetas de crédito o débito $ 184.526 e-MAIL: ventas@taller.cl"""


def test_formato_taller():
    datos = extraer_cotizacion(TEXTO_FORMATO_TALLER, rut_empresa="76.111.111-6")
    assert datos.numero == "00167-2020"  # no el "15" de "Validez de la cotización: 15 días"
    assert datos.fecha == date(2020, 2, 27)
    assert datos.cliente_nombre == "Juan Pérez G"
    assert datos.cliente_rut is None  # el único RUT es el de la empresa
    assert (datos.monto_neto, datos.iva, datos.total) == (149100, 28329, 177429)  # neto con descuento
    assert [(i.cantidad, i.precio_unitario, i.subtotal) for i in datos.items] == [(1, 79100, 79100), (2, 40000, 80000)]
    assert datos.items[0].descripcion == "Ventana corredera color titanio 1.09 x 1.02 Cristal 5mm"


TEXTO_FORMATO_2024 = """COTIZACION N°05083-2024
18-07-2024
NOMBRE ANA SOTO RUT
TIPO PARTICULAR
PROYECTO: PVC NOGAL TELEFONO 900000000
At.
De nuestra consideración, se presenta cotización de productos TALLER, que se detalla a continuación:
CANT. DETALLE PRECIO UNIT. Total ($)
1 Ventana en L Corredera 756 x 150 $ 1.730.000$ 1.730.000
1 Traslado + Instalacion $ 120.000 $ 120.000
SUBTOTAL NETO ($) $ 1.850.000
2 Elementos DESCUENTO ($) $ -
VALOR NETO $ 1.850.000
I.V.A. ($) $ 351.500
Plazo de entrega: 10 días hábiles promedio. (Confirmar stock) TOTAL ($) $ 2.201.500
2. Estado de pago 2 (Termino): 50% saldo final. $ 1.100.750 NOMBRE: TALLER"""

TEXTO_FORMATO_2025 = """COTIZACIÓN Nº: 6779
FECHA COT: 05-06-25
FECHA VENC: 15-06-25
NOMBRE: LUIS ROJAS RUT: 12.345.678-5
TIPO: PARTICULAR
De nuestra consideración, se presenta cotización de productos TALLER, que se detalla a continuación:
CANTIDAD PRODUCTO DETALLE PRECIO UNIT. TOTAL
1 V01 Corredera 2H 180 x 190 $ 629.000 $ 629.000
1 Desinstalación ALUMINIO $ -$ -
1 Traslado + Instalación PUENTE ALTO $ 126.000 $ 126.000
3 Elementos SUB-TOTAL: $ 755.000
DESCUENTO:
Plazo de entrega 15-20 días hábiles promedio VALOR NETO: $ 755.000
I.V.A.: $ 143.450
TOTAL: $ 898.450
NOMBRE: TALLER"""


def test_formato_2024():
    datos = extraer_cotizacion(TEXTO_FORMATO_2024)
    assert (datos.numero, datos.fecha, datos.cliente_nombre, datos.cliente_rut) == ("05083-2024", date(2024, 7, 18), "ANA SOTO", None)
    assert (datos.monto_neto, datos.iva, datos.total) == (1850000, 351500, 2201500)
    assert [(i.descripcion, i.subtotal) for i in datos.items] == [
        ("Ventana en L Corredera 756 x 150", 1730000),
        ("Traslado + Instalacion", 120000),
    ]


def test_formato_2025():
    datos = extraer_cotizacion(TEXTO_FORMATO_2025)
    assert (datos.numero, datos.fecha) == ("6779", date(2025, 6, 5))  # fecha de la cotización, no de vencimiento
    assert (datos.cliente_nombre, datos.cliente_rut) == ("LUIS ROJAS", "12.345.678-5")
    assert (datos.monto_neto, datos.iva, datos.total) == (755000, 143450, 898450)
    assert [(i.denominacion, i.descripcion) for i in datos.items] == [("V01", "Corredera 2H 180 x 190"), (None, "Traslado + Instalación PUENTE ALTO")]


TEXTO_FORMATO_2025_COMPLETO = """COTIZACIÓN Nº: 7374
FECHA COT: 23/9/2025
FECHA VENC: 3/10/2025
NOMBRE: CLAUDIO CAMPOS RUT:
TIPO: PARTICULAR
COMUNA: PEDRO AGUIRRE CERDA TELEFONO: 964729518
PROYECTO: PVC, BLANCO, TERMOPANEL e-MAIL:
De nuestra consideración, se presenta cotización de productos TALLER, que se detalla a continuación:
CANTIDAD DENOMINACIÓN PRODUCTO DETALLE (Ancho x Alto) PRECIO UNIT. TOTAL
1 V01 Corredera 2H 150 x 190 $ 414.000$ 414.000
2 V02 Proyectante 60 x 40 $ 100.000$ 200.000
1 Desinstalación ALUMINIO $ -$ -
1 Traslado + Instalacion PEDRO AGUIRRE CERDA $ 190.000$ 190.000
5 SUB-TOTAL: $ 804.000
DESCUENTO:
MATERIAL PLAZOS DE ENTREGA MARCA VALOR NETO: $ 764.000
PVC 15 - 20 días hábiles prom.DECEUNINCK (Origen: EUROPA ) I.V.A.: $ 145.160
VIDRIO TEMPLADO 8 - 10 días hábiles prom. LIRQUEN (NACIONAL) TOTAL: $ 909.160
PAGO 1 50% para aprobar cotización $ 454.580 NOMBRE: OTRA
PERFILERÍA: PVC
COLOR PERFILERÍA: BLANCO
VIDRIOS: TERMOPANEL (4+4) (MONOLITICO INC - MONOLITICO INC)
SE DESPIDE ATENTAMENTE:
Ana Pérez Soto
TELÉFONO: +56 9 5658 53 27
e-MAIL: VENTAS@TALLER.CL"""


def test_atributos_formato_2025():
    d = extraer_cotizacion(TEXTO_FORMATO_2025_COMPLETO)
    assert (d.tipo_cliente, d.comuna, d.cliente_telefono, d.cliente_email) == ("PARTICULAR", "Pedro Aguirre Cerda", "964729518", None)
    assert d.proyecto == "PVC, BLANCO, TERMOPANEL"
    assert (d.material, d.color, d.vidrio) == ("PVC", "Blanco", "Termopanel")  # no "Templado" de la tabla de plazos
    assert d.fecha_vencimiento == date(2025, 10, 3)
    assert d.vendedor == "Ana Pérez S."  # nombre, apellido e inicial: unifica variantes de la firma
    assert (d.monto_neto, d.descuento) == (764000, 40000)
    v01, v02, traslado = d.items
    assert (v01.denominacion, v01.descripcion, v01.categoria, v01.ancho_m, v01.alto_m, v01.m2) == (
        "V01", "Corredera 2H 150 x 190", "Corredera", Decimal("1.5"), Decimal("1.9"), Decimal("2.85"),
    )
    assert (v02.categoria, v02.m2) == ("Proyectante", Decimal("0.48"))  # 0,6 × 0,4 × 2
    assert (traslado.categoria, traslado.es_servicio, traslado.m2) == ("Instalación", True, None)


def test_atributos_formato_2020():
    texto = TEXTO_FORMATO_TALLER + """
5) La perfilería usada será Aluminio linea AL25 color titanio.
4) El acristalamiento será con cristal monolitico incoloro de 5mm.
Luisa Morales T.
+569 56 58 53 27"""
    d = extraer_cotizacion(texto)
    assert (d.material, d.color, d.vidrio, d.vendedor) == ("Aluminio", "Titanio", "Monolítico", "Luisa Morales T.")
    assert d.fecha_vencimiento == date(2020, 3, 13)  # 27-02-2020 + 15 días de validez
    assert d.descuento == 10000
    assert d.items[0].ancho_m == Decimal("1.090")  # "1.09 x 1.02" está en metros


@pytest.mark.parametrize(
    "detalle, esperado",
    [
        ("Corredera 2H 150 x 190", ("1.500", "1.900")),
        ("Ventana corredera 1775 x 2125. Termopanel", ("1.775", "2.125")),
        ("Ventana en L Corredera 756 x 150", ("7.560", "1.500")),
        ("Espejo 800 x 900", ("0.800", "0.900")),
        ("Traslado + Instalacion", (None, None)),
    ],
)
def test_medidas_en_metros(detalle, esperado):
    from app.services.extraccion import medidas_en_metros

    assert tuple(str(v) if v is not None else None for v in medidas_en_metros(detalle)) == esperado


def test_cliente_sin_nombre_no_toma_el_de_la_empresa():
    texto = TEXTO_FORMATO_2025.replace("NOMBRE: LUIS ROJAS RUT: 12.345.678-5", "NOMBRE: RUT:")
    with pytest.raises(ExtraccionError, match="cliente"):
        extraer_cotizacion(texto)


def test_archivo_que_no_es_pdf():
    with pytest.raises(ExtraccionError, match="PDF"):
        extraer_texto_pdf(b"esto no es un pdf")
