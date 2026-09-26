# Cotiza+

Sistema de automatización y análisis de cotizaciones comerciales almacenadas en documentos PDF.

Proyecto APT (Capstone) · Ingeniería en Informática · Duoc UC

## Problema

Las cotizaciones comerciales se almacenan individualmente como archivos PDF en Google Drive. Datos como cliente, número, fecha, montos e ítems deben revisarse documento por documento, lo que aumenta el tiempo operativo y el riesgo de errores o duplicación de trabajo.

**Cotiza+** automatiza la captura de esa información y la transforma en una fuente estructurada, centralizada y disponible para análisis.

## Flujo del sistema

```
Detectar → Extraer → Normalizar → Almacenar → Consultar
```

1. **Detectar**: nueva cotización subida a Google Drive.
2. **Extraer**: reglas de extracción, con IA como respaldo para casos no cubiertos.
3. **Normalizar**: validación, limpieza y control de duplicados.
4. **Almacenar**: persistencia en PostgreSQL.
5. **Consultar**: API REST + panel web con búsquedas, filtros y métricas.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Python + FastAPI |
| Frontend | React + TypeScript + Tailwind CSS |
| Base de datos | PostgreSQL |
| Origen de datos | Google Drive API |
| Diseño de interfaz | Figma |
| Pruebas | Pytest |
| Documentación de API | Swagger / OpenAPI |
| Pruebas de API | Postman |
| Control de versiones | Git / GitHub |

Seguridad transversal: autenticación, autorización, validación de datos y protección de información en todas las capas.

## Producto Mínimo Viable (PMV)

- **Ingreso automático**: detecta un PDF nuevo en Google Drive y lo descarga.
- **Extracción inteligente**: obtiene campos clave (cliente, número, fecha, montos, ítems) mediante reglas propias, usando IA solo como respaldo.
- **Datos confiables**: normaliza, valida y almacena evitando registros duplicados.
- **Consulta segura**: permite a un usuario autenticado buscar cotizaciones y visualizar métricas (total de cotizaciones, clientes únicos, montos).

## Épicas

- **Épica 001 · Ingesta y extracción automática** — detección y procesamiento de nuevas cotizaciones, extracción de campos, priorización de reglas propias sobre IA, almacenamiento sin duplicados.
- **Épica 002 · Consulta y visualización segura** — autenticación requerida, dashboard con métricas, filtros por cliente y año, control de accesos.

## Estructura del proyecto

```
cotiza-plus/
├── backend/          # API REST (FastAPI), extracción de PDFs, modelo de datos
│   ├── app/
│   ├── tests/
│   └── requirements.txt
├── frontend/         # Aplicación web (React + TypeScript)
│   ├── src/
│   └── package.json
└── README.md
```

> Ajusta esta estructura a la organización real de carpetas del repositorio una vez esté definida.

## Puesta en marcha

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Variables de entorno

Crear un archivo `.env` en `backend/` con, al menos:

```
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/cotiza_plus
GOOGLE_DRIVE_CREDENTIALS=ruta/a/credenciales.json
SECRET_KEY=cambia_esto_en_produccion
```

## Pruebas

```bash
cd backend
pytest
```

## Equipo

- Ignacio González — Backend, integración con Google Drive, procesamiento de PDFs, modelo de datos y API REST.
- Claudio Cornejo — Frontend, diseño de interfaz, consultas y filtros, dashboard y métricas.

## Estado

Proyecto en desarrollo como parte del Capstone (Proyecto APT), con una planificación de 18 semanas distribuida en tres fases: definición y diseño, construcción e integración, y estabilización y cierre.
