# Contrato de API — Cotiza+ (frontend ↔ backend)

**Estado:** implementado en FastAPI (`SRC/backend/app/api`) y verificado el 15/11/2026 con `npm run verificar:api` (31 de 31 verificaciones correctas).
**Fuente de verdad en código:** `SRC/frontend/src/api/types.ts` (frontend) y `SRC/backend/app/schemas/` (backend). Si difieren de este documento, se corrigen los tres en el mismo commit.

El contrato cubre **solo lo que exige el PMV** (Épica 002: consulta y visualización segura). Son 8 endpoints. La sección 2.1 agrega los endpoints de la Épica 001 (conexión con Drive e ingesta), que usa la sección "Google Drive" del frontend (`/drive`).

El frontend usa la API real por defecto (`VITE_API_MODE=http`). El cliente simulado (`VITE_API_MODE=mock`) se mantiene para las pruebas y la demo de GitHub Pages.

### Multiempresa

Cada usuario pertenece a **una empresa**. El JWT lleva el `empresa_id` (claim `emp`) y el backend filtra todas las consultas por esa empresa: ningún endpoint recibe el id de empresa por parámetro. Una cotización de otra empresa responde 404, igual que una inexistente. Por eso el contrato del frontend no cambia respecto de la versión de una sola empresa.

## 1. Convenciones

| Tema | Regla |
| --- | --- |
| URL base | `/api/v1` (en el frontend, `VITE_API_BASE_URL`). |
| Formato | JSON en UTF-8, campos en `snake_case`. |
| Autenticación | `Authorization: Bearer <token>` en todos los endpoints excepto `POST /auth/login`. Sin token válido, la API responde 401. |
| Token | JWT HS256 con `sub` (email), `uid` (usuario), `emp` (empresa) y **`exp` obligatorio**. El frontend trata como inválido un token sin `exp`. Duración: `ACCESS_TOKEN_EXPIRE_MINUTES` (60 por defecto). |
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

### Atributos comerciales, filtros y métricas adicionales

Además de lo anterior, cada cotización expone atributos extraídos del PDF (todos pueden ser `null` si el formato no los trae):

| Campo | Dónde | Ejemplo |
| --- | --- | --- |
| `tipo_cliente`, `comuna`, `material`, `color`, `vidrio`, `vendedor` | listado y detalle | `"PARTICULAR"`, `"Providencia"`, `"PVC"`, `"Nogal"`, `"Termopanel"`, `"Ana Pérez S."` |
| `descuento` (int) | listado y detalle | `40000` |
| `proyecto`, `direccion`, `fecha_vencimiento`, `cliente_telefono`, `cliente_email`, `subtotal_bruto` | detalle | |
| ítems: `denominacion`, `ancho_m`, `alto_m`, `m2`, `categoria`, `es_servicio` | detalle | `"V01"`, `1.5`, `1.9`, `2.85`, `"Corredera"`, `false` |

`GET /cotizaciones` y todos los `/metricas/*` aceptan además los filtros `material`, `color`, `vidrio`, `comuna`, `vendedor` y `tipo_cliente` (valor exacto). El listado acepta también `monto_min` y `monto_max` (neto, CLP), y `q` busca también en el proyecto.

| Endpoint | Respuesta |
| --- | --- |
| `GET /metricas/resumen` | Agrega `monto_total` (con IVA), `descuento_total`, `cotizaciones_con_descuento`, `m2_cotizados` y `cotizaciones_con_instalacion`. |
| `GET /metricas/distribucion?dimension=&limite=10` | `[{ clave, cantidad, monto_neto }]` de mayor a menor monto. `dimension`: `material`, `color`, `vidrio`, `comuna`, `vendedor`, `tipo_cliente`, `cliente` o `producto` (ítems por categoría, sin servicios; `cantidad` = unidades). |
| `GET /metricas/opciones` | `{ material: [], color: [], vidrio: [], comuna: [], vendedor: [], tipo_cliente: [] }`: valores existentes, del más al menos frecuente. |

### 2.1 Conexión con Google Drive e ingesta (Épica 001)

Todos exigen token, salvo el callback, que lo llama el navegador al volver de Google.

| Endpoint | Descripción |
| --- | --- |
| `GET /google/estado` | `{ google_configurado, conectado, carpeta_configurada, carpeta_id, fecha_conexion }` de la empresa del usuario. |
| `PUT /google/carpeta` | JSON `{ carpeta }`: ID o enlace de la carpeta (`…/folders/<id>`). Devuelve el estado. 422 si no es válido. |
| `POST /google/autorizar` | `{ authorization_url }`: URL de consentimiento de Google (solo lectura de Drive). El `state` y el `code_verifier` (PKCE) se guardan en `oauth_estados`, son de un solo uso y vencen a los 15 minutos. |
| `GET /google/callback` | Fuera de `/api/v1` (es la `GOOGLE_REDIRECT_URI` registrada en Google Cloud). Guarda el refresh token **cifrado** y redirige a `FRONTEND_URL/drive?drive=conectado` o `?drive=error&motivo=<invalido|vencido|cancelado|rechazado|sin_refresh|no_configurado>`. |
| `DELETE /google/conexion` | Desconecta Drive (204). |
| `POST /ingesta/sincronizar?reintentar_errores=false&reprocesar=false` | `reprocesar=true` vuelve a leer todos los PDF y actualiza las cotizaciones ya importadas (mismos id). Inicia **en segundo plano** el procesamiento de los PDF nuevos de la carpeta (202). Responde el avance. 409 si Drive no está conectado, falta la carpeta o ya hay una en curso. |
| `GET /ingesta/progreso` | `{ estado (inactivo \| en_curso \| terminado \| cancelado \| fallido), encontrados, total, revisados, procesados, duplicados, errores, omitidos, mensaje, inicio, fin }`. El frontend lo consulta cada 1,5 s mientras está en curso. |
| `POST /ingesta/cancelar` | Deja de descargar PDF nuevos; los que estaban en curso se guardan. 409 si no hay una en curso. |
| `GET /documentos?estado=&page=&page_size=` | `Pagina` de documentos detectados con `estado` (`procesado`, `duplicado`, `error`), `error`, `metodo_extraccion`, `cotizacion_id` y `url_drive`. |

Además, `INGESTA_INTERVALO_MINUTOS > 0` activa la sincronización automática de todas las empresas conectadas.

Rendimiento: la descarga desde Drive es lo más lento (~0,6 s por PDF), así que se descargan `INGESTA_DESCARGAS_PARALELAS` (8 por defecto) a la vez, con reintentos ante cortes de red. Medido con 5.350 PDF reales: ~7 PDF/s, unos 13 minutos la primera vez; las siguientes solo procesan los nuevos. El avance vive en memoria del servidor: si se reinicia, la sincronización se corta, pero lo ya guardado se mantiene y la siguiente continúa desde ahí.

## 3. Esqueleto orientativo para FastAPI

> Referencia histórica de la propuesta. La implementación real está en `SRC/backend/app/api/`.

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

- [x] Backend confirma nombres de campos y tipos.
- [x] Montos expuestos como `int`.
- [x] El JWT incluye `exp`.
- [x] Todos los endpoints salvo `/auth/login` (y el callback de Google) exigen token.
- [x] CORS habilitado para el origen del frontend (`CORS_ORIGINS`).
- [x] Swagger (`/docs`) coincide con este documento.
- [ ] Búsqueda sin distinguir tildes (`unaccent`): hoy usa `ILIKE`, que ignora mayúsculas pero no tildes.
