# Plan de pruebas del frontend — Cotiza+

**Alcance:** Épica 002 "Consulta y visualización segura". **Responsable:** Claudio Cornejo.
Apoya la actividad "Pruebas funcionales y de integración" (S14–S15), pero las pruebas automatizadas se escriben junto con cada funcionalidad, no al final.

Cada caso tiene un identificador `CP-Fxx`. Las pruebas automatizadas llevan ese identificador en su nombre, para encontrarlas con `grep -r "CP-F09" SRC/frontend/`.

## 1. Niveles de prueba

| Nivel | Herramienta | Qué valida | Cuándo corre |
| --- | --- | --- | --- |
| Unitarias | Vitest | Formato de montos y fechas, filtros en la URL, completado de meses, expiración del token. | `npm test` y en GitHub Actions en cada push. |
| Contrato | Vitest + zod | Que los tipos del frontend y los esquemas del contrato coincidan (en compilación), y que las respuestas tengan la forma acordada. | `npm test` y `npm run typecheck`. |
| Interfaz | Vitest + Testing Library | Flujos completos sobre la aplicación montada: login, rutas protegidas, filtros, estados vacíos, detalle y resumen. | `npm test`. |
| Integración HTTP | Vitest + API simulada | El cliente HTTP real por la red: login con formulario, header `Bearer`, parámetros, 401, 404, 422 y CORS. | `npm test`. |
| Verificación del backend | `npm run verificar:api` | 31 comprobaciones del contrato contra la API de FastAPI. | Desde que exista la API (S12). |
| Integración real | Navegador + FastAPI + PostgreSQL | Lo mismo con datos reales, más la verificación SQL de métricas. | S12–S15, con registro de evidencia. |
| Aceptación | Demostración guiada | Criterios de aceptación de la Épica 002. | S17–S18. |

## 2. Casos de prueba

| ID | Criterio (Épica 002) | Caso | Resultado esperado | Tipo |
| --- | --- | --- | --- | --- |
| CP-F01 | Requerir autenticación | Abrir `/cotizaciones?anio=2025` sin sesión | Redirige al login; al entrar vuelve a la misma ruta con el filtro | Automatizada |
| CP-F02 | Requerir autenticación | Credenciales incorrectas | "Correo o contraseña incorrectos.", sin indicar cuál falló | Automatizada |
| CP-F03 | Requerir autenticación | Enviar el formulario vacío | Validación en pantalla, sin llamar a la API | Automatizada |
| CP-F04 | Proteger la información | Recargar con un token vencido | Vuelve al login con "Tu sesión expiró" | Automatizada |
| CP-F05 | Proteger la información | La API responde 401 durante el uso | Se cierra la sesión y se limpia la caché de datos | Automatizada (simulado y HTTP) |
| CP-F08 | Proteger la información | Cerrar sesión | Se borra el token y se vuelve al login | Automatizada |
| CP-F09 | Filtros por cliente y año | Filtrar por año y por cliente | Solo aparecen cotizaciones de ese año o cliente; el filtro queda en la URL | Automatizada |
| CP-F10 | Búsquedas | Buscar por número, nombre sin tildes y RUT | Se encuentran las cotizaciones correspondientes | Automatizada |
| CP-F11 | Búsquedas | Búsqueda sin resultados | Estado vacío con botón "Limpiar filtros" | Automatizada |
| CP-F12 | Filtros | URL manipulada (`anio=abc&page=0`) | Se ignoran los valores inválidos, sin error | Automatizada |
| CP-F13 | Total de cotizaciones, clientes únicos y montos | Abrir el resumen de un año | Se muestran los cuatro indicadores y el gráfico mensual | Automatizada |
| CP-F14 | Métricas coherentes | Comparar indicadores con el listado | Totales, clientes únicos y suma mensual cuadran | Automatizada; SQL en integración |
| CP-F15 | Métricas por período | Año en curso y año cerrado | Meses sin datos aparecen en 0; no se muestran meses futuros | Automatizada |
| CP-F17 | Consulta | Recorrer todas las páginas | Ningún registro se repite ni se pierde | Automatizada |
| CP-F18 | Consulta | Abrir `/cotizaciones/999999` | "No encontramos esta cotización" con enlace de regreso | Automatizada |
| CP-F19 | Consulta | Fecha `2026-03-01` en Chile | Se muestra "1 mar 2026", no el 28 de febrero | Automatizada |
| CP-F20 | Consulta | API apagada | Mensaje de falta de conexión y botón "Reintentar" | Automatizada |
| CP-F21 | Integración | Verificación del contrato | 31 de 31 comprobaciones correctas; detecta montos enviados como texto | Automatizada (simulado); manual (FastAPI) |
| CP-F22 | Integración | Origen del frontend no permitido por CORS | La verificación lo informa como falla | Automatizada |
| CP-F23 | Robustez | Una pantalla recibe datos fuera del contrato | Mensaje "Algo falló al mostrar esta pantalla" en vez de pantalla en blanco | Automatizada |

Los casos CP-F06, CP-F07 y CP-F16 de la versión anterior se retiraron al ajustar el alcance al PMV: correspondían a roles de usuario y a la validación de montos en la interfaz, que no forman parte de la Épica 002.

## 3. Verificación de métricas contra PostgreSQL (CP-F14 en integración)

Ejecutar estas consultas y comparar con lo que muestra el Resumen para el mismo año. **Los nombres de tablas y columnas son supuestos** y deben ajustarse al modelo que implemente el backend.

```sql
-- Indicadores del resumen para 2025
SELECT COUNT(*)                   AS total_cotizaciones,
       COUNT(DISTINCT cliente_id) AS clientes_unicos,
       SUM(monto_neto)            AS monto_neto_total
FROM cotizacion
WHERE EXTRACT(YEAR FROM fecha) = 2025;

-- Serie mensual del gráfico
SELECT TO_CHAR(fecha, 'YYYY-MM') AS periodo, COUNT(*) AS cantidad, SUM(monto_neto) AS monto_neto
FROM cotizacion
WHERE EXTRACT(YEAR FROM fecha) = 2025
GROUP BY 1 ORDER BY 1;

-- Mismo resumen filtrado por un cliente
SELECT COUNT(*), SUM(monto_neto)
FROM cotizacion
WHERE EXTRACT(YEAR FROM fecha) = 2025 AND cliente_id = :cliente_id;
```

Criterio: los valores deben coincidir exactamente. Una diferencia se registra como defecto en GitHub Issues, indicando si está en el endpoint, en el filtro o en la interfaz.

## 4. Revisión de calidad de la interfaz

| Aspecto | Cómo se revisa | Criterio | Último resultado |
| --- | --- | --- | --- |
| Accesibilidad | axe-core (WCAG 2.1 A/AA y buenas prácticas) en Chromium, sobre login, resumen, listado, detalle, sin resultados y 404, en modo claro y oscuro, y el resumen en móvil | 0 problemas | 0 problemas en las 13 combinaciones |
| Responsivo | Chromium a 390 px y 1280 px | Sin desplazamiento horizontal de la página; las tablas se desplazan dentro de su contenedor | Cumple |
| Teclado | Navegar con Tab, Enter y Espacio | Todo es alcanzable y el foco es visible | Cumple |
| Modo oscuro | Sistema operativo en modo oscuro | Textos, gráfico y avisos legibles | Cumple |
| HTTP en navegador | Build con `VITE_API_MODE=http` contra la API simulada, en Chromium | Login, listado, detalle, resumen y sesión expirada funcionan sin errores de consola ni de CORS | Cumple |

## 5. Últimos resultados

Fecha: 18 de octubre de 2026. Ambiente: datos simulados y API simulada; **no hay resultados contra el backend real todavía**.

| Medición | Resultado |
| --- | --- |
| Pruebas automatizadas | 58 de 58 aprobadas |
| Verificación del contrato contra la API simulada | 31 de 31 comprobaciones correctas |
| Accesibilidad (axe-core) | 0 problemas |

## 6. Registro de evidencias

Cada ejecución manual se registra con ID del caso, fecha, ambiente (`mock`, `simulada` o `http` + commit), resultado, captura y, si falla, el enlace al issue. Las capturas actuales de cada pantalla están en `SRC/docs/frontend/capturas/`.
