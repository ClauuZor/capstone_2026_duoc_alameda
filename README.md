# Cotiza+

**Nombre del proyecto:** Cotiza+, sistema de automatización y análisis de cotizaciones comerciales.

Proyecto APT (Capstone) · Ingeniería en Informática · Duoc UC, sede Alameda

## Descripción

Una empresa del rubro del vidrio y aluminio almacena sus cotizaciones comerciales como archivos PDF individuales en Google Drive. Datos como cliente, número, fecha, montos e ítems deben revisarse documento por documento, lo que dificulta su búsqueda y análisis, aumenta el tiempo operativo y eleva el riesgo de errores o duplicación de trabajo.

**Cotiza+** automatiza la extracción, normalización y almacenamiento de los datos contenidos en las cotizaciones, y los pone a disposición en una aplicación web protegida mediante autenticación, con búsquedas, filtros y métricas comerciales.

```
Detectar → Extraer → Normalizar → Almacenar → Consultar
```

### Objetivo general

Desarrollar una solución de software que automatice la extracción, almacenamiento y análisis de información contenida en cotizaciones comerciales en formato PDF, permitiendo centralizar los datos y facilitar su consulta mediante una aplicación web.

### Objetivos específicos

1. Implementar un proceso automatizado para detectar y procesar cotizaciones almacenadas en Google Drive.
2. Desarrollar un mecanismo de extracción que identifique los principales datos contenidos en las cotizaciones.
3. Diseñar e implementar un modelo de datos relacional que permita almacenar y consultar la información extraída.
4. Construir una API REST que permita administrar y consultar la información procesada.
5. Desarrollar una aplicación web que permita visualizar cotizaciones, realizar búsquedas, aplicar filtros y consultar métricas comerciales.
6. Implementar mecanismos de autenticación, autorización y protección de la información.
7. Validar el funcionamiento de la solución mediante pruebas funcionales, de integración y aceptación.

### Producto Mínimo Viable (PMV)

- **Ingreso automático:** detectar un PDF nuevo en Google Drive y descargarlo.
- **Extracción inteligente:** obtener los campos clave mediante reglas y usar IA solo como respaldo.
- **Datos confiables:** normalizar, validar y almacenar evitando registros duplicados.
- **Consulta segura:** permitir a un usuario autenticado buscar cotizaciones y visualizar métricas.

### Épicas

**Épica 001 · Ingesta y extracción automática.** Como usuario administrador quiero que el sistema extraiga automáticamente los datos de las cotizaciones en PDF.

- Detectar y procesar nuevas cotizaciones.
- Extraer correctamente número, cliente, fecha, monto e ítems.
- Priorizar reglas propias y usar IA solo cuando sea necesario.
- Almacenar la información sin generar duplicados.

**Épica 002 · Consulta y visualización segura.** Como usuario quiero consultar las cotizaciones y sus métricas desde un panel web protegido.

- Requerir autenticación para acceder al panel y a la API.
- Mostrar el total de cotizaciones, los clientes únicos y los montos.
- Permitir filtros y búsquedas por cliente y año.
- Proteger la información y restringir accesos.

## Tecnologías utilizadas

| Capa | Tecnología |
| --- | --- |
| Backend y procesamiento | Python + FastAPI |
| Frontend | React + TypeScript + Tailwind CSS |
| Base de datos | PostgreSQL |
| Origen de datos | Google Drive API |
| Diseño de interfaz | Figma |
| Pruebas | Pytest y Postman (backend), Vitest (frontend) |
| Documentación de API | Swagger / OpenAPI |
| Control de versiones | Git / GitHub |

Seguridad transversal: autenticación, autorización, validación de datos y protección de la información.

## Instrucciones para ejecutar el proyecto localmente

### Backend

Requisitos: Python 3.12 o superior y PostgreSQL.

```bash
cd SRC/backend
python -m venv venv
source venv/bin/activate        # en Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # completar DATABASE_URL, SECRET_KEY y ENCRYPTION_KEY
alembic upgrade head            # crea o actualiza las tablas
python -m app.cli seed-demo     # opcional: empresa y 150 cotizaciones de ejemplo
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pytest
```

Las variables están explicadas en [`SRC/backend/.env.example`](SRC/backend/.env.example). Swagger queda en http://127.0.0.1:8000/docs (botón **Authorize** con el correo y la contraseña).

Administración por consola (`python -m app.cli --help`):

| Comando | Para qué |
| --- | --- |
| `crear-empresa --nombre ... --rut ... --carpeta <folder_id>` | Registra una empresa y su carpeta de Google Drive. |
| `crear-usuario --empresa-id 1 --email ... --nombre ...` | Crea un usuario de la aplicación web (pide la contraseña). |
| `carpeta --empresa-id 1 --carpeta <folder_id>` | Cambia la carpeta de Drive de una empresa. |
| `sincronizar --empresa-id 1` | Procesa los PDF nuevos de Drive (lo mismo que `POST /api/v1/ingesta/sincronizar`). |
| `procesar-pdf --empresa-id 1 archivo.pdf` | Procesa PDF locales, útil para ajustar las reglas de extracción. |
| `seed-demo` | Crea la empresa demo con el usuario `demo@cotiza.test` / `demo1234`. |

**Conectar Google Drive:** con sesión iniciada, `POST /api/v1/google/autorizar` (desde Swagger) entrega una URL; al abrirla y aceptar, Google vuelve a `GOOGLE_REDIRECT_URI` y el token queda guardado cifrado. Luego `POST /api/v1/ingesta/sincronizar` procesa la carpeta.

### Frontend

```bash
cd SRC/frontend
npm install
cp .env.example .env.local      # VITE_API_MODE=http apunta al backend local
npm run dev                     # http://localhost:5173
npm test
```

Con el backend corriendo y `seed-demo` cargado, se entra con `demo@cotiza.test` / `demo1234`. Para usar datos simulados sin backend, `VITE_API_MODE=mock`. Más detalles en [`SRC/frontend/README.md`](SRC/frontend/README.md).

Para comprobar que el backend cumple el contrato: `npm run verificar:api` (en `SRC/frontend`, con el backend corriendo).

## Integrantes del equipo y roles

| Integrante | Rol Scrum | Responsabilidades |
| --- | --- | --- |
| Claudio Cornejo | Product Owner, Scrum Master y Developer | Frontend, diseño de interfaces, consultas y filtros, dashboard y métricas, documentación y pruebas. |
| Ignacio Gonzalez | Developer | Arquitectura, backend, integración con Google Drive, procesamiento de PDF, base de datos y API REST. |

## Metodología de trabajo

El proyecto se desarrolla con **Scrum**, de forma iterativa e incremental, en sprints de dos semanas dentro de la planificación de 18 semanas de la asignatura. Cada incremento se valida con pruebas antes de considerarse terminado.

Documentación ágil en [`Fase 2/Evidencia proyecto`](<Fase 2/Evidencia proyecto>):

- Documento 01 · Product Vision
- Documento 02 · Product Backlog
- Documento 03 · Sprint Planning
- Documento 04 · Definition of Done
- Documento 05 · Documento de Diseño

## Arquitectura de la solución

```
Google Drive  →  Python (procesamiento)  →  FastAPI (servicios REST)  →  PostgreSQL
                                                     ↓
                                     React + TypeScript (aplicación web y dashboard)
```

![Diagrama de componentes](SRC/docs/diseno/componentes.png)

Los PDF se obtienen desde Google Drive y se procesan con Python, priorizando reglas de extracción (el respaldo con IA está pendiente). La información normalizada se almacena en PostgreSQL y se expone mediante una API REST en FastAPI, que consume la aplicación web en React. La seguridad (autenticación, autorización y validación de datos) es transversal a todas las capas.

El sistema es **multiempresa**: cada empresa conecta su propio Google Drive mediante OAuth 2.0 (solo lectura, token cifrado en la base) y cada usuario ve únicamente los datos de su empresa, que el backend toma del JWT. Los diagramas actualizados están en [`SRC/docs/diseno`](SRC/docs/diseno) y el contrato de la API en [`SRC/docs/contrato-api.md`](SRC/docs/contrato-api.md).

## Estructura del repositorio

```
├── Fase 1/          Evidencias de la Fase 1
├── Fase 2/          Evidencias de la Fase 2, incluida la documentación ágil
└── SRC/
    ├── backend/     API REST, procesamiento de PDF y modelo de datos (Python + FastAPI)
    ├── frontend/    Aplicación web (React + TypeScript)
    └── docs/        Contrato de API, plan de pruebas y diagramas
```

## Estado

Proyecto en desarrollo como parte del Capstone (Proyecto APT), con una planificación de 18 semanas distribuida en tres fases: definición y diseño, construcción e integración, y estabilización y cierre.
