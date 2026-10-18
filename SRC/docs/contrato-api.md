# Contrato de API — Cotiza+ (frontend ↔ backend)

**Estado:** propuesta del frontend para el acuerdo "Coordinar la estructura de datos entre frontend y backend" (acta del 08/10/2026, plazo S8). Pendiente de revisión y aprobación del backend.
**Fuente de verdad en código:** `SRC/frontend/src/api/types.ts`. Si este documento y ese archivo difieren, se corrigen ambos en el mismo commit.

El contrato cubre **solo lo que exige el PMV** (Épica 002: consulta y visualización segura). Son 8 endpoints. Todo lo que no aparece aquí queda fuera del alcance del semestre.

Mientras el backend no esté publicado, el frontend usa un cliente simulado que respeta exactamente estas reglas (`VITE_API_MODE=mock`). Para conectarse a FastAPI basta con `VITE_API_MODE=http`.

## 1. Convenciones

| Tema | Regla |
| --- | --- |
| URL base | `/api/v1` (en el frontend, `VITE_API_BASE_URL`). |
| Formato | JSON en UTF-8, campos en `snake_case`. |
| Autenticación | `Authorization: Bearer <token>` en todos los endpoints excepto `POST /auth/login`. Sin token válido, la API responde 401. |
| Token | JWT con `sub` (email) y **`exp` obligatorio**. El frontend trata como inválido un token sin `exp`. Duración sugerida: 30 a 60 minutos. |
| Montos | Pesos chilenos como **enteros** (`int`). No usar `Decimal` en los esquemas de respuesta: Pydantic v2 lo serializa como string (`"1234567"`). Puede ser `NUMERIC` en PostgreSQL y convertirse a `int` en el esquema. |
| Fechas | `fecha` de la cotización como `"YYYY-MM-DD"`: fecha de **emisión** impresa en el PDF, no la de procesamiento. |
| Paginación | `page` (desde 1) y `page_size` (máx. 100). Respuesta `{ items, total, page, page_size }`. |
| Errores | Formato estándar de FastAPI: `{"detail": "mensaje"}`. En 5xx no exponer trazas. |
| CORS | En desarrollo, permitir el origen `http://localhost:5173` con el header `Authorization`. |

### Cómo responde la interfaz a cada código

| Código | Cuándo | Qué hace el frontend |
| --- | --- | --- |
| 401 | Token ausente, vencido o inválido | Cierra la sesión, borra los datos en caché y envía al login con "Tu sesión expiró". |
| 401 en `/auth/login` | Credenciales incorrectas | "Correo o contraseña incorrectos." (no distingue si falló el correo o la clave). |
| 404 | Cotización inexistente | Estado vacío con enlace de regreso. |
| 422 | Parámetros inválidos | "Los filtros enviados no son válidos." |
| 5xx o sin red | Falla del servidor o conexión | Reintenta hasta 2 veces y luego muestra "Reintentar". |

## 2. Endpoints

### Autenticación

**`POST /auth/login`** — `application/x-www-form-urlencoded`, compatible con `OAuth2PasswordRequestForm`.

```
username=usuario@empresa.cl&password=********
```

```json
{ "access_token": "eyJhbGciOi...", "token_type": "bearer" }
```

**`GET /auth/me`**

```json
{ "id": 1, "email": "usuario@empresa.cl", "nombre": "Nombre Apellido" }
```

### Cotizaciones

**`GET /cotizaciones`** → `Pagina<CotizacionResumen>`, ordenado por `fecha` descendente y luego `id` descendente (el desempate hace estable la paginación).

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| `q` | string, opcional | Busca en número de cotización, nombre del cliente y RUT, sin distinguir mayúsculas ni tildes (sugerencia: `ILIKE` + extensión `unaccent`). |
| `cliente_id` | int, opcional | Filtra por cliente. |
| `anio` | int, opcional | Año de la fecha de emisión. |
| `page`, `page_size` | int | Paginación. El frontend usa `page_size=20`. |

```json
{
  "items": [
    {
      "id": 61,
      "numero": "COT-2024-0192",
      "fecha": "2024-10-19",
      "cliente": { "id": 6, "nombre": "Hotel Bahía Serena", "rut": "77.581.952-9" },
      "cantidad_items": 6,
      "monto_neto": 8564840,
      "iva": 1627320,
      "total": 10192160
    }
  ],
  "total": 245,
  "page": 1,
  "page_size": 20
}
```

**`GET /cotizaciones/{id}`** → `CotizacionResumen` más `items` y `documento`. 404 si no existe.

```json
{
  "items": [
    { "id": 301, "linea": 1, "descripcion": "Baranda cristal templado 10 mm con perfil U", "cantidad": 23.1, "unidad": "ml", "precio_unitario": 155100, "subtotal": 3582810 }
  ],
  "documento": {
    "nombre_archivo": "Cotizacion_COT-2024-0192.pdf",
    "url_drive": "https://drive.google.com/file/d/<id>/view"
  }
}
```

`cantidad` admite decimales (m², ml). `unidad` y `url_drive` pueden ser `null`.

**`GET /clientes`** → `ClienteResumen[]` (`id`, `nombre`, `rut`), ordenado por nombre. `rut` puede ser `null`.

### Métricas

Se calculan **en el backend sobre el conjunto filtrado completo**, nunca en el frontend a partir de la página visible del listado.

| Endpoint | Parámetros | Respuesta |
| --- | --- | --- |
| `GET /metricas/anios` | — | `number[]`: años con cotizaciones, descendente. |
| `GET /metricas/resumen` | `anio?`, `cliente_id?` | `{ total_cotizaciones, clientes_unicos, monto_neto_total }` |
| `GET /metricas/por-periodo` | `anio?`, `cliente_id?`, `granularidad` = `mes` \| `anio` | `[{ periodo, cantidad, monto_neto }]` ascendente. `periodo` es `"YYYY-MM"` o `"YYYY"`. Solo períodos con datos: el frontend completa los meses vacíos. |

| Métrica | Definición |
| --- | --- |
| `total_cotizaciones` | Cotizaciones registradas. Un PDF duplicado no genera una cotización nueva. |
| `clientes_unicos` | `COUNT(DISTINCT cliente_id)`. |
| `monto_neto_total` | Suma de `monto_neto` (sin IVA). Es monto **cotizado**, no vendido. |
| Monto promedio | No lo entrega la API: el frontend lo calcula como `monto_neto_total / total_cotizaciones`. |

## 3. Esqueleto orientativo para FastAPI

```python
from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

class ClienteResumen(BaseModel):
    id: int
    nombre: str
    rut: str | None

class CotizacionResumen(BaseModel):
    id: int
    numero: str
    fecha: str            # "YYYY-MM-DD"
    cliente: ClienteResumen
    cantidad_items: int
    monto_neto: int       # int, no Decimal
    iva: int
    total: int

@app.get("/api/v1/cotizaciones")
def listar(
    q: str | None = None,
    cliente_id: int | None = Query(None, gt=0),
    anio: int | None = Query(None, ge=2000, le=2100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    usuario=Depends(usuario_actual),   # 401 si el token falta o venció
): ...
```

## 4. Para cerrar el contrato

- [ ] Backend confirma nombres de campos y tipos.
- [ ] Montos expuestos como `int`.
- [ ] El JWT incluye `exp`.
- [ ] Todos los endpoints salvo `/auth/login` exigen token.
- [ ] CORS habilitado para el origen del frontend.
- [ ] Swagger (`/docs`) coincide con este documento antes de la integración (S12).
