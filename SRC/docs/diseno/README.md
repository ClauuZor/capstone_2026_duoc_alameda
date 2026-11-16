# Diagramas UML

Fuentes PlantUML (`.puml`) e imágenes (`.png`) de los diagramas del Documento 05 (Documento de Diseño). Cuando cambie el diseño, se edita el `.puml`, se regenera la imagen y ambos se suben en el mismo pull request.

| Fuente | Imagen | Diagrama |
| --- | --- | --- |
| `01a-casos-de-uso-consulta.puml` | `casos-de-uso-consulta.png` | Casos de uso, Épica 002 |
| `01b-casos-de-uso-ingesta.puml` | `casos-de-uso-ingesta.png` | Casos de uso, Épica 001 |
| `02-modelo-er.puml` | `modelo-er.png` | Modelo entidad-relación |
| `03a-clases-modelos.puml` | `clases-modelos.png` | Clases: modelos de datos |
| `03b-clases-servicios.puml` | `clases-servicios.png` | Clases: ingesta y servicios |
| `04-secuencia-ingesta.puml` | `secuencia-ingesta.png` | Secuencia: ingesta de una cotización |
| `05-secuencia-consulta.puml` | `secuencia-consulta.png` | Secuencia: login y consulta |
| `06-componentes.puml` | `componentes.png` | Componentes y despliegue |

`_estilo.iuml` define los colores y la tipografía comunes.

## Regenerar las imágenes

Con Java y Graphviz instalados y el jar de PlantUML descargado:

```bash
cd SRC/docs/diseno
java -jar plantuml.jar -tpng *.puml
```

También se puede usar la extensión "PlantUML" de VS Code (vista previa con Alt+D y exportación desde la paleta de comandos).

Los diagramas reflejan el backend implementado (`SRC/backend/app`): modelo **multiempresa** (cada usuario pertenece a una empresa y solo ve sus datos) y conexión con Google Drive mediante **OAuth 2.0 por empresa** (no cuenta de servicio). Las fuentes `.puml` se actualizaron el 15/11/2026; las imágenes `.png` deben regenerarse con los comandos de arriba antes de insertarlas en el Documento 05.
