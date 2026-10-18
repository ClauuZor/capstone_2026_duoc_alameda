# Cotiza+ — Frontend

Aplicación web de Cotiza+ para la Épica 002 "Consulta y visualización segura": inicio de sesión, consulta de cotizaciones con búsqueda y filtros por cliente y año, detalle con ítems, y dashboard con métricas.

Stack del plan de trabajo: React 18, TypeScript (modo estricto), Vite y Tailwind CSS. Además: React Router (navegación), TanStack Query (caché y estados de carga), Recharts (gráfico) y Vitest + Testing Library (pruebas).

## Ejecutar

```bash
npm install
npm run dev          # http://localhost:5173
```

Por defecto usa **datos simulados**, porque la API todavía no está publicada. Credenciales de prueba: `demo@cotiza.test` / `demo1234`.

Para conectarse a la API real de FastAPI, copiar `.env.example` a `.env.local` y definir:

```
VITE_API_MODE=http
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

| Script | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm test` | Pruebas automatizadas (58), incluidas las de integración HTTP contra la API simulada. |
| `npm run api:simulada` | API simulada en `http://localhost:8000/api/v1`, para usar el frontend en modo `http` sin backend. |
| `npm run verificar:api` | Verifica una API contra el contrato (31 comprobaciones). Ver [integración con el backend](../docs/frontend/integracion-backend.md). |
| `npm run typecheck` | Verificación de tipos. |
| `npm run build` | Build de producción en `dist/`. |
| `npm run build:demo` | Un solo `index.html` autocontenido con datos simulados, para mostrar la aplicación sin servidor. |

## Alcance

| Criterio de aceptación (Épica 002) | Dónde |
| --- | --- |
| Requerir autenticación para acceder al panel | Login, rutas protegidas, cierre de sesión al vencer el token o ante un 401. |
| Mostrar total de cotizaciones, clientes únicos y montos | Resumen: cotizaciones, clientes únicos, monto cotizado y monto promedio. |
| Métricas por período | Gráfico mensual del año elegido, o anual con "Todos los años". |
| Filtros y búsquedas por cliente y año | Listado de cotizaciones (búsqueda por número, cliente o RUT) y Resumen. |
| Consultar el detalle | Ítems, neto, IVA, total y enlace al PDF en Google Drive. |
| Proteger la información | Token en memoria y `sessionStorage` (se borra al cerrar la pestaña); la caché de datos se limpia al cerrar sesión. |

Fuera de alcance por decisión del PMV: roles de usuario, administración de usuarios, carga manual de PDFs, edición de cotizaciones, exportación y vistas de monitoreo de la extracción.

## Estructura

```
src/
  api/
    types.ts         Tipos del contrato (espejo de los esquemas Pydantic)
    http.ts          Cliente real: fetch + JWT + errores de FastAPI
    mock/            Cliente simulado con las mismas reglas del contrato
    client.ts        Elige mock o http según VITE_API_MODE
  auth/              Sesión, expiración del token y rutas protegidas
  hooks/             Consultas con caché
  lib/               Formato CLP y fechas, filtros en la URL, métricas
  components/        Marco de la aplicación, estados de carga/error/vacío, paginación
  pages/             Login, Resumen, Cotizaciones, Detalle, No encontrada
scripts/
  servidorContrato.ts    API simulada que imita a FastAPI (no es el backend)
  verificarContrato.ts   Comprobaciones del contrato contra cualquier API
  integracion.test.ts    Pruebas del cliente HTTP real por la red
```

## Documentación

| Documento | Contenido |
| --- | --- |
| [`../docs/contrato-api.md`](../docs/contrato-api.md) | Endpoints acordados con backend. |
| [`../docs/plan-pruebas-frontend.md`](../docs/plan-pruebas-frontend.md) | Casos CP-F, verificación SQL de métricas y últimos resultados. |
| [`../docs/frontend/integracion-backend.md`](../docs/frontend/integracion-backend.md) | Procedimiento para conectar la API real. |
| [`../docs/frontend/diseno-interfaz.md`](../docs/frontend/diseno-interfaz.md) | Decisiones de diseño, sistema visual, estados y accesibilidad. |
| [`../docs/frontend/manual-usuario.md`](../docs/frontend/manual-usuario.md) | Manual para el usuario final. |
| [`../docs/frontend/despliegue.md`](../docs/frontend/despliegue.md) | Demo en GitHub Pages y despliegue real. |

## Decisiones técnicas

**Contrato primero y cliente simulado.** El frontend no espera a que la API exista: trabaja contra un cliente simulado que aplica las mismas reglas del contrato (401, 404, paginación, métricas). Cambiar a la API real es una variable de entorno; ningún componente sabe de dónde vienen los datos.

**Métricas en el backend.** Los indicadores se piden ya calculados sobre el conjunto filtrado. Calcularlos a partir del listado paginado daría los totales de una sola página.

**Filtros en la URL.** Búsqueda, cliente, año y página son parámetros de la URL: se pueden compartir, sobreviven a una recarga y "atrás" funciona. Valores inválidos se ignoran.

**Sesión.** La interfaz cierra la sesión a la hora de `exp` del JWT o ante cualquier 401. La protección de rutas solo evita mostrar pantallas; la seguridad real es que la API exige el token.

**Fechas.** `"2026-03-01"` no se convierte con `new Date()`, que la interpreta en UTC: en Chile se mostraría como el 28 de febrero.

## Trazabilidad con el plan de trabajo

| Actividad | Semanas | Estado del frontend |
| --- | --- | --- |
| Estructura base del frontend | S5–S6 | Completa. |
| Autenticación y control de acceso | S8–S10 | Completa del lado del frontend. Falta probarla con el JWT real de FastAPI. |
| Módulo de consulta de cotizaciones | S8–S11 | Completo contra datos simulados. |
| Dashboard y métricas | S10–S12 | Completo contra datos simulados. |
| Integración completa | S12–S14 | Preparada: cliente HTTP probado por la red y en navegador contra la API simulada, y verificación del contrato lista. Falta ejecutarla contra FastAPI. |
| Pruebas funcionales y de integración | S14–S15 | 58 pruebas automatizadas y 0 problemas de accesibilidad (axe). Faltan las pruebas contra la API real y la verificación SQL de métricas. |
| Documentación | S16–S17 | Manual de usuario, diseño de interfaz y guías de integración y despliegue escritos. |
| Despliegue | S17–S18 | Demo publicable en GitHub Pages; despliegue real documentado, pendiente de la API publicada. |

## Datos simulados

Clientes, RUT y montos del modo simulado son ficticios y se generan con una semilla fija, para que las pruebas y las capturas sean reproducibles. El repositorio no contiene cotizaciones reales.
