# Integración del frontend con el backend

El frontend ya consume la API por HTTP; lo que falta es que exista la API real. Esta guía es el procedimiento para el día en que FastAPI publique los endpoints de [`../contrato-api.md`](../contrato-api.md), de modo que integrar sea verificar y no desarrollar.

## Qué ya está probado sin backend

| Pieza | Cómo se probó |
| --- | --- |
| Cliente HTTP (`SRC/frontend/src/api/http.ts`) | Pruebas por la red contra la API simulada: login con `x-www-form-urlencoded`, header `Authorization: Bearer`, parámetros de filtro, 401, 404 y falta de conexión. |
| CORS | Build en modo `http` abierto en Chromium contra la API simulada, que exige CORS igual que `CORSMiddleware`. |
| Forma de las respuestas | Esquemas zod (`SRC/frontend/src/api/esquemas.ts`) que se comprueban en compilación contra `types.ts`. |
| Verificación del contrato | `npm run verificar:api`: 31 comprobaciones, aprobadas contra la API simulada. |

La API simulada (`SRC/frontend/scripts/servidorContrato.ts`) **no es el backend**: no lee Google Drive, no extrae PDFs ni usa PostgreSQL. Solo responde con datos ficticios imitando a FastAPI, para probar el frontend.

## Probar el frontend en modo HTTP hoy

```bash
cd SRC/frontend
npm run api:simulada                 # terminal 1: API simulada en http://localhost:8000/api/v1
```

```bash
cd SRC/frontend
echo "VITE_API_MODE=http" > .env.local
npm run dev                          # terminal 2: http://localhost:5173, usuario demo@cotiza.test / demo1234
```

## El día que exista la API real

1. **Levantar FastAPI** en `http://localhost:8000` con datos de prueba (los PDFs ficticios, nunca cotizaciones reales en el repo).
2. **Verificar el contrato** con un usuario de prueba creado en la base:

   ```bash
   cd SRC/frontend
   VERIFICAR_API_URL=http://localhost:8000/api/v1 \
   VERIFICAR_EMAIL=usuario@prueba.cl VERIFICAR_PASSWORD=... \
   npm run verificar:api
   ```

   Cada ✗ indica qué endpoint, qué campo y qué se esperaba. Las fallas típicas y su causa:

   | Falla | Causa probable |
   | --- | --- |
   | `CORS permite http://localhost:5173 con Authorization` | Falta `CORSMiddleware` o no incluye el origen o el header `Authorization`. |
   | `monto_neto: Expected number, received string` | El esquema Pydantic usa `Decimal`; debe exponer `int`. |
   | `El JWT incluye exp futuro` | El token se emite sin `exp`. |
   | `Login con credenciales válidas: HTTP 422` | El endpoint espera JSON y no `OAuth2PasswordRequestForm`. |
   | `fecha: se esperaba YYYY-MM-DD` | Se serializa un `datetime` en vez de `date`. |
   | `El total del listado coincide con el resumen` | El filtro por año usa la fecha de procesamiento en vez de la de emisión, o no excluye duplicados. |

3. **Corregir** cada falla del lado que corresponda. Si el cambio es del contrato, se actualizan juntos `SRC/docs/contrato-api.md`, `SRC/frontend/src/api/types.ts` y `SRC/frontend/src/api/esquemas.ts`; `npm run typecheck` avisa si quedan desalineados.
4. **Cambiar el frontend a la API real**: en `SRC/frontend/.env.local`, `VITE_API_MODE=http` y `VITE_API_BASE_URL=http://localhost:8000/api/v1`.
5. **Ejecutar el plan de pruebas** ([`../plan-pruebas-frontend.md`](../plan-pruebas-frontend.md)) en modo HTTP, incluida la verificación SQL de métricas, y registrar los resultados.
6. **Agregar la verificación a CI** cuando el backend tenga un ambiente de pruebas accesible, para que cada cambio de API se compare con el contrato.
