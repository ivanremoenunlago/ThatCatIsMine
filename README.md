# ¡Ese gato es mío! — catálogo y guía del proyecto

## Propósito

Este repositorio contiene una galería web local y los recursos para diseñar, revisar y descargar las cartas del juego de mesa «¡Ese gato es mío!». La galería lee las categorías desde YAML, monta las ilustraciones en una plantilla común y permite descargar PNG individuales o PDFs A4 listos para imprimir. El reglamento también se lee desde YAML y sus ocho páginas, igual que los cinco tableros, se exportan en A4 horizontal.

La aplicación es estática: HTML, CSS y JavaScript, sin servidor ni proceso de compilación. Los archivos se procesan en el navegador y no se suben a Internet. Para crear PDFs descargables del reglamento se carga html2canvas 1.4.1 desde cdnjs con integridad verificada.

## Estado actual

- **Gatos:** 20 cartas configuradas, con ilustraciones, puntuación de Sofá y Salón, descripciones y sinergias cuando corresponden.
- **Ataques:** 17 tipos de cartas (ataques y apoyos), 27 copias físicas en total, con daño fijo o variable y sus ilustraciones.
- **Estructuras:** 6 tipos y 8 copias físicas, incluido el Arenero.
- **Acciones y Eventos:** 21 tipos y 33 copias físicas (19 acciones, 5 objetos, 4 respuestas y 5 Eventos Globales), con cuatro ilustraciones distintas para Flús-Flús de Agua.
- **Consumibles:** 4 tipos y 8 copias físicas.
- **Sinergias:** 9 cartas de referencia de 63,5 × 88 mm, con la imagen ocupando todo el anverso y la explicación al lado; ambos lados llevan borde ámbar.
- **Mazo:** 96 cartas físicas según el inventario de la versión de pruebas V3.
- **Reglamento de referencia:** [Ese_gato_es_mio_reglamento_v3_con_esquemas.txt](./Ese_gato_es_mio_reglamento_v3_con_esquemas.txt), la versión de pruebas vigente con esquemas de turno y asuntos pendientes.
- **Reglamento web:** la pestaña **Reglamento** incluye el lore, la preparación, el turno, el combate, las estructuras, los eventos y las sinergias. El texto se edita en `reglamento/categoria.yml`; sus ocho páginas se muestran y descargan en A4 horizontal.
- **Tableros:** tienen una pestaña independiente con las cinco variantes. La impresión final permite incluir tableros sin añadir el reglamento, o viceversa.
- El pie de [index.html](./index.html) incluye el aviso de derechos de autor.

## Abrir la galería

Abre `index.html` con Chrome o Edge. La aplicación intenta cargar automáticamente las categorías y las imágenes desde la carpeta del proyecto.

Si el navegador bloquea la lectura local, utiliza **Seleccionar carpeta manualmente** y elige la raíz del proyecto. También puedes servir la carpeta con cualquier servidor web local; no hace falta instalar paquetes ni compilar nada.

Cada categoría tiene una pestaña. La galería muestra una carta por tipo. **Impresión final** permite elegir páginas del reglamento, tableros, categorías completas o cartas individuales y descargarlas juntas en un PDF. En cartas con varias copias se puede elegir cuántas incluir. El orden del archivo es reglamento, tableros, cartas y sinergias.

- **Descargar PNG** descarga ese tipo de carta como PNG a 720 DPI.
- **Descargar PDF A4** genera el conjunto de la categoría, con hasta nueve cartas por página, separación de 3 mm y marcas de corte.
- **Impresión final** descarga únicamente la selección marcada: reglamento y tableros en A4 horizontal, cartas normales hasta nueve por página y sinergias con sus dos caras lado a lado. No abre el diálogo de impresión.
- La pestaña **Sinergias** tiene su propio botón **Descargar PDF A4**. Cada pareja ocupa dos cartas normales de 63,5 × 88 mm, colocadas una al lado de la otra; no se prepara para impresión dúplex. Las ilustraciones aún no asignadas aparecen marcadas como pendientes.
- En Ataques, Estructuras, Acciones y Eventos, y Consumibles, el PDF repite cada carta según su campo `copias`; cada ilustración se puede descargar como PNG individual.

Los PDFs de cartas ya incluyen su tamaño físico y no necesitan que se seleccione una escala en un diálogo de impresión.

## Estructura de archivos

```text
index.html
css/
  base.css
  cards.css
  print.css
js/
  project-data.js
  card-renderer.js
  pdf-export.js
  rulebook.js
  app.js
README.md
reglamento/
  categoria.yml
tableros/
  (cinco variantes de imagen para el tablero)
Ese_gato_es_mio_reglamento_revisado.txt
Ese_gato_es_mio_reglamento_revisado_v2.txt
Ese_gato_es_mio_reglamento_v0.48.txt
Ese_gato_es_mio_reglamento_v3.txt
Ese_gato_es_mio_reglamento_v3_con_esquemas.txt
cartas/
  emojis/
  gatos/
    categoria.yml
    imagenes/
  ataques/
    categoria.yml
    imagenes/
  estructuras/
    categoria.yml
    imagenes/
  acciones/
    categoria.yml
    imagenes/
  consumibles/
    categoria.yml
    imagenes/
  globales/
    categoria.yml (referencia anterior, ya no se carga en la galería)
    imagenes/
```

- `index.html`: estructura de la página, pestañas, tableros y aviso de derechos.
- `css/base.css`: estilos globales y estructura de la interfaz.
- `css/cards.css`: cartas, sinergias y su presentación adaptable.
- `css/print.css`: reglamento, tableros, selector de impresión y reglas de impresión A4.
- `js/project-data.js`: configuración, estado, lectura/validación del YAML y resolución de archivos e imágenes.
- `js/card-renderer.js`: composición de las cartas y sinergias, y generación de sus vistas previas.
- `js/pdf-export.js`: creación de imágenes para imprimir y armado de PDFs.
- `js/rulebook.js`: presentación del reglamento y selección de elementos para la impresión final.
- `js/app.js`: arranque de la aplicación, navegación por categorías y eventos de la interfaz.
- `index.html` carga esos scripts en ese orden. Son scripts clásicos, no módulos, para conservar el uso directo desde `file://` y la selección manual de la carpeta.
- Los archivos `categoria.yml` dentro de cada categoría contienen sus datos y configuración visual.
- `reglamento/categoria.yml`: contenido del reglamento, incluida la introducción y los esquemas de turno. Los pasos se editan como bloques `paso_turno`; `grupo`, `fase` y `marca` determinan su columna y color. Usa `alternativa` en pasos consecutivos para presentarlos como opciones excluyentes.
- `cartas/emojis/`: iconos comunes de tipo, huella, sofá y salón.
- `cartas/<categoria>/imagenes/`: ilustraciones de esa categoría.
- `tableros/`: los cinco PNG activos de tablero son de 3508 × 2480 px a 300 ppp. Se ajustan prácticamente a A4 horizontal (297 × 210 mm) y se colocan en páginas de ese tamaño sin ampliación ni recorte. Sus posiciones se configuran en `css/print.css`; el PDF los rasteriza a aproximadamente 300 ppp.

Las rutas `imagen` e `iconos` de cada YAML son relativas al propio archivo de categoría. El nombre y la extensión deben coincidir exactamente con el archivo en disco.

Los gatos se pueden reordenar libremente dentro del Sofá o del Salón; eso no cuenta como movimiento. Al jugar la Cama de Peluche, colócala junto al gato que protege; queda vinculada a él y no cambia de objetivo por la posición de otros gatos. Los tres cojines del Sofá miden aproximadamente 66,0 mm de ancho. Los cuatro recuadros de carta de cada tablero miden 63,5 × 88 mm en la página A4 y, centrados en los cojines, dejan unos 1,25 mm de tapicería a cada lado. Sus bordes superiores quedan a 17,97 mm del borde superior de la página en las plazas del sofá y a 18,99 mm en la zona de Estructuras. La zona útil marcada para el Salón mide 237,6 × 54,6 mm. Imprime el PDF en A4 horizontal al 100 % para conservar estas medidas.

## Diseño de las cartas

Todas las cartas usan tamaño físico **63,5 × 88 mm**, equivalente a **1800 × 2494 píxeles a 720 DPI**. La ilustración se recorta proporcionalmente, sin deformarse, en un área aproximada de **1696 × 1696 píxeles**. El diseño mantiene marco, esquinas, imagen, banda del nombre y panel inferior compartidos.

Las proporciones, posiciones y tamaños de texto se definen en `diseno` dentro de cada YAML; las familias tipográficas y el renderizado están en `js/card-renderer.js`. Si se cambia una medida, comprueba tanto la vista previa como la exportación final.

Mantén las descripciones breves, idealmente en 2-3 líneas impresas; deja los pasos y excepciones detallados para el reglamento. El tamaño de letra debe seguir siendo legible y solo reducirse automáticamente cuando el texto no quepa.

Paletas actuales:

| Categoría | Marco | Fondo | Superficies de texto/panel | Detalle |
| --- | --- | --- | --- | --- |
| Gatos | `#D9B96E` | `#E7D1A6` | `#F5E9CE` | `#B98232` |
| Ataques | `#DE857E` | `#EBC8C3` | `#F5E4DF` | `#B94B48` |
| Estructuras | `#B8BEC2` | `#DDE2E4` | `#F5F6F6` | `#858F95` |
| Acciones y Eventos | `#A997B7` | `#E4DBEA` | `#F5F0F7` | `#806A91` |
| Flús-Flús de Agua | `#8EADBB` | `#DDEAF0` | `#F4F8FA` | `#5E8293` |
| Consumibles | `#A1B38F` | `#E0E8D9` | `#F5F8F2` | `#70885F` |

Ataques sigue la estructura de bordes y paneles claros de Gatos. El coral del marco se usa en los rótulos y valores fijos de ataque o apoyo. Estructuras usa tonos blancos y grisáceos apagados; Acciones y Eventos, morados suaves; y Consumibles, verdes suaves. Flús-Flús de Agua se mantiene en la pestaña Acciones y Eventos, pero usa una paleta azul propia. Las paletas están en el YAML de cada categoría.

La banda del nombre usa el color de detalle de cada categoría como fondo, una versión más oscura de ese color como borde y el color claro de la superficie para el texto. En Acciones y Eventos, Flús-Flús y Consumibles, el marco exterior y el detalle interior tienen tonos más separados para distinguir mejor los dos bordes. En Ataques, el rojo de detalle también se usa en las fórmulas de daño y descripciones; los rótulos y valores fijos mantienen el coral del marco.

## Cómo editar o añadir cartas

Los YAML son la fuente de datos del catálogo: evita duplicar nombres, daños, textos o rutas dentro del código JavaScript.

### Gatos

Cada entrada define `nombre`, `imagen`, `sofa`, `salon`, `habilidad` y `descripcion`. El nombre de la habilidad aparece integrado al inicio del efecto. `sinergia` es opcional; solo se muestra si está presente. Las cartas de Gatos no se duplican en el PDF.

### Ataques y apoyos

Cada entrada define `nombre`, `imagen`, `tipo` (`ataque` o `apoyo`) y `copias`.

- Para un ataque de daño fijo, usa `dano: <número>`.
- Para un daño variable, usa `dano_variable: "<fórmula en texto>"`; la carta muestra la fórmula en vez de un valor fijo.
- Para un apoyo, usa `bonificacion: <número>` y `descripcion`.
- La galería llama **DAÑO** al valor fijo. El reglamento conserva el término «potencia» en sus reglas de ataque, defensa y bonificaciones; no cambies esa terminología del reglamento sin revisar las reglas y confirmarlo.

### Estructuras

Cada entrada define `nombre`, `imagen`, `tipo: "estructura"`, `copias` y `descripcion`. El PDF genera las copias indicadas; el PNG individual se descarga una sola vez por tipo.

### Acciones y Eventos

La pestaña **Acciones y Eventos** reúne acciones, objetos, respuestas y Eventos Globales. Cada entrada define `nombre`, `imagen`, `tipo` (`accion`, `objeto`, `respuesta` o `evento_global`), `copias` y `descripcion`. Los eventos globales conservan `tipo: "evento_global"` aunque compartan la pestaña. Las cartas que muestran la marca de Flús-Flús llevan `marca_flush: true`; Sabotaje Vecinal no lleva la marca y no se puede cancelar. El icono de Flús-Flús se configura en `iconos.flush`, aparece sin recuadro en la parte superior derecha y usa el color de detalle de la paleta de la carta. Las cartas con `paleta: "azul"` usan la paleta azul específica de Flús-Flús. Cada ilustración de Flús es una entrada independiente para que sus cuatro copias salgan distintas en el PDF y puedan descargarse por separado.

### Consumibles

Cada consumible define `nombre`, `imagen`, `tipo: "consumible"`, `copias` y `descripcion`.

Las ilustraciones de Eventos Globales siguen en `cartas/globales/imagenes/`, pero sus entradas de catálogo están en `cartas/acciones/categoria.yml`. El antiguo `cartas/globales/categoria.yml` se conserva como referencia y ya no se carga.

### Sinergias

Las nueve sinergias se mantienen en `cartas/sinergias/categoria.yml`. Cada una define `nombre`, `descripcion`, `lore` y `gatos`; `gatos` es una lista de los nombres que activan la sinergia (tres para Los Trillizos). `imagen` es opcional; al añadir una ilustración, registra su ruta relativa al YAML. La carta muestra la ilustración en un lado y, en el otro, el nombre, el efecto, el lore entre comillas en cursiva y los gatos requeridos al pie.

### Añadir una categoría nueva

1. Crea `cartas/<categoria>/categoria.yml` e `imagenes/` siguiendo el formato de las categorías existentes.
2. Usa rutas relativas al YAML y comprueba que cada imagen exista.
3. Añade la ruta del YAML a `CATEGORY_PATHS` en `js/project-data.js`.
4. Si la categoría necesita datos o una composición distintos, actualiza `validateCategory` en `js/project-data.js` y el renderizado específico de `drawCard` en `js/card-renderer.js`.
5. Comprueba carga de todas las imágenes, PNG individual, PDF, cantidades de copias y tamaño físico.

El lector YAML integrado admite un subconjunto sencillo: claves de texto/número booleano, listas de cartas planas y listas inline de cadenas con sintaxis JSON. Mantén las claves en ASCII con `snake_case` y los textos y rutas entre comillas dobles, como en los ejemplos actuales; no dependas de construcciones YAML avanzadas.

## Flujo recomendado

1. Confirma nombre, texto, estadísticas y cantidad de copias con el reglamento vigente; no inventes datos que falten.
2. Coloca cada ilustración en la carpeta `imagenes/` de su categoría y registra su ruta exacta en el YAML.
3. Usa el YAML para cambiar datos de cartas y paletas. Modifica el archivo JavaScript de la responsabilidad correspondiente solo cuando haga falta comportamiento o composición nuevos.
4. Recarga la galería y revisa todas las cartas afectadas; prueba al menos un PNG individual y el PDF A4.

El reglamento V3 con esquemas es el borrador de trabajo vigente. Las versiones anteriores se conservan como referencia; no deben usarse para completar reglas que sigan pendientes en V3.

## Criterios para futuros cambios

- Usa el reglamento V3 con esquemas y las decisiones confirmadas como fuente actual; los borradores anteriores son referencias históricas. No inventes reglas para completar una contradicción: consulta antes de cambiar una mecánica.
- Conserva la plantilla y las medidas entre cartas de una misma categoría; cambia ilustración y datos, no la distribución, salvo petición expresa.
- Mantén separados los recursos por categoría y no renombres una imagen sin actualizar su referencia YAML.
- Después de editar, abre la galería, confirma que no faltan ilustraciones y revisa visualmente PNG y PDF. Ejecuta también `git diff --check`.
- No se necesita un build ni instalar dependencias para trabajar en este proyecto.
