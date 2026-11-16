"""Genera un PDF mínimo con texto seleccionable (una línea por renglón), sin dependencias."""


def _escapar(texto: str) -> bytes:
    return texto.encode("cp1252").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def generar_pdf(lineas: list[str]) -> bytes:
    contenido = b"BT /F1 10 Tf 14 TL 40 800 Td\n"
    for linea in lineas:
        contenido += b"(" + _escapar(linea) + b") Tj T*\n"
    contenido += b"ET"

    objetos = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(contenido)).encode() + b" >>\nstream\n" + contenido + b"\nendstream",
    ]

    pdf = b"%PDF-1.4\n"
    posiciones = []
    for i, obj in enumerate(objetos, start=1):
        posiciones.append(len(pdf))
        pdf += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(pdf)
    pdf += f"xref\n0 {len(objetos) + 1}\n0000000000 65535 f \n".encode()
    for p in posiciones:
        pdf += f"{p:010d} 00000 n \n".encode()
    pdf += f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return pdf
