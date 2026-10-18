# Despliegue del frontend

El frontend es un sitio estático: `npm run build` genera la carpeta `SRC/frontend/dist/` con HTML, CSS y JavaScript, sin servidor propio. Se puede publicar en cualquier hosting estático.

## Demo con datos simulados (disponible ahora)

Para mostrar avance sin backend, el workflow **Demo del frontend** publica la versión con datos simulados en GitHub Pages:

1. Una sola vez: en GitHub, **Settings → Pages → Source: GitHub Actions**.
2. **Actions → Demo del frontend → Run workflow**.
3. La demo queda en `https://<usuario>.github.io/<repositorio>/`. Usuario `demo@cotiza.test`, contraseña `demo1234`.

La demo no contiene datos reales: clientes, RUT y montos son ficticios. Antes de compartirla con la empresa o el docente, aclarar que es una demostración y no el sistema conectado.

## Despliegue real (S17–S18)

Requiere la API publicada con HTTPS. Variables de entorno del build:

| Variable | Valor |
| --- | --- |
| `VITE_API_MODE` | `http` |
| `VITE_API_BASE_URL` | URL pública de la API, por ejemplo `https://api.cotizaplus.example/api/v1` |
| `VITE_ROUTER_MODE` | `browser` si el hosting permite redirigir todas las rutas a `index.html`; si no, `hash` |

Comando de build: `npm ci && npm run build`. Carpeta publicada: `SRC/frontend/dist`.

Con `VITE_ROUTER_MODE=browser`, el hosting debe responder `index.html` para cualquier ruta (por ejemplo `/cotizaciones/12`); si no, recargar una página interna da 404. Cómo se configura según el hosting:

| Hosting | Configuración |
| --- | --- |
| Vercel | Proyecto con raíz `frontend`; agregar un `vercel.json` con `{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}`. |
| Netlify | Raíz `SRC/frontend`, carpeta `dist`; agregar `SRC/frontend/public/_redirects` con `/* /index.html 200`. |
| GitHub Pages | No permite reescrituras: usar `VITE_ROUTER_MODE=hash`. |

## Lista de verificación antes de publicar

- [ ] `npm run verificar:api` contra la API de producción sin fallas.
- [ ] El backend permite por CORS el dominio del frontend publicado (no solo `localhost`).
- [ ] La API usa HTTPS: el navegador bloquea llamadas HTTP desde un sitio HTTPS.
- [ ] `VITE_API_MODE=http`: con `mock`, el sitio mostraría datos simulados.
- [ ] Login, filtros, detalle y resumen probados en el sitio publicado.
