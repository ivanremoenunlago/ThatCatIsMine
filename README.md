# ¡Ese gato es mío! — catálogo y guía del proyecto

## Propósito

Este repositorio contiene una galería web local y los recursos para diseñar, revisar y descargar las cartas del juego de mesa «¡Ese gato es mío!». La galería lee las categorías desde YAML, monta las ilustraciones en una plantilla común y permite descargar PNG individuales o PDFs A4 listos para imprimir. El reglamento también se lee desde YAML y sus cuatro páginas, igual que los cinco tableros, se exportan en A4 horizontal.

La aplicación es estática: HTML, CSS y JavaScript, sin servidor ni proceso de compilación. Los archivos se procesan en el navegador y no se suben a Internet. Para crear PDFs descargables del reglamento se carga html2canvas 1.4.1 desde cdnjs con integridad verificada.

## Estado actual

- **Gatos:** 20 cartas configuradas, con ilustraciones, puntuación de Sofá y Salón, descripciones y sinergias cuando corresponden.
- **Ataques:** 17 tipos de cartas (ataques y apoyos), 27 copias físicas en total, con daño fijo o variable y sus ilustraciones.
- **Estructuras:** 6 tipos y 8 copias físicas, incluido el Arenero.
- **Acciones y Eventos:** 21 tipos y 33 copias físicas (19 acciones, 5 objetos, 4 respuestas y 5 Eventos Globales), con cuatro ilustraciones distintas para Flús-Flús de Agua.
- **Consumibles:** 4 tipos y 8 copias físicas.
- **Sinergias:** 9 cartas de referencia de 63,5 × 88 mm, con tres ilustraciones en la fila superior y sus tres explicaciones en la inferior de cada página; maquetación para imprimir a una cara.
- **Mazo:** 96 cartas físicas según el inventario de la versión de pruebas V3.
- **Reglamento de referencia:** [Ese_gato_es_mio_reglamento_v3_con_esquemas.txt](./Ese_gato_es_mio_reglamento_v3_con_esquemas.txt), la versión de pruebas vigente con esquemas de turno y asuntos pendientes.
- **Reglamento web:** la pestaña **Reglamento** incluye el lore, la preparación, el turno, el combate, las estructuras, los eventos y las sinergias. El texto se edita en `reglamento/categoria.yml`; sus cuatro páginas se muestran y descargan en A4 horizontal, con una clave que explica los iconos y una vista previa que mantiene la distribución de impresión en pantallas pequeñas.
- **Tableros:** tienen una pestaña independiente con las cinco variantes. La impresión final permite incluir tableros sin añadir el reglamento, o viceversa.
- El pie de [index.html](./index.html) incluye el aviso de derechos de autor.

## Abrir la galería

Abre `index.html` con Chrome o Edge. La aplicación intenta cargar automáticamente las categorías y las imágenes desde la carpeta del proyecto.

Al abrir `index.html` directamente, las imágenes de los tableros se cargan como recursos locales exportables para que el navegador no bloquee el PDF. Si el navegador bloquea la lectura local, utiliza **Seleccionar carpeta manualmente** y elige la raíz del proyecto. También puedes servir la carpeta con cualquier servidor web local; no hace falta instalar paquetes ni compilar nada.

Cada categoría tiene una pestaña. La galería muestra una carta por tipo. **Impresión final** permite elegir páginas del reglamento, tableros, categorías completas o cartas individuales y descargarlas juntas en un PDF. **Seleccionar todo** marca el reglamento, todos los tableros y todas las cartas; en cartas con varias copias se puede elegir cuántas incluir. El orden del archivo es reglamento, tableros, cartas y sinergias.

- **Descargar PNG** descarga ese tipo de carta como PNG a 720 DPI.
- **Descargar PDF A4** genera el conjunto de la categoría, con hasta nueve cartas por página, separación de 3 mm y marcas de corte.
- **Impresión final** descarga únicamente la selección marcada; solo equivale al mazo completo si se marca todo. Incluye reglamento y tableros en A4 horizontal, hasta nueve cartas normales por página y las sinergias en cuadrículas de tres filas con imágenes y textos alternos. Incluye por defecto un reverso por cada carta seleccionada (sinergias excluidas), y permite cambiar manualmente esa cantidad. No añade páginas en blanco; el estado muestra los rangos exactos. Si el bloque anterior tiene un número impar de páginas o las cantidades de anversos y reversos difieren, la impresión a doble cara puede quedar desalineada. Imprime en A4 al **100 % / Tamaño real**, no uses «Ajustar a página».
- La pestaña **Sinergias** tiene su propio botón **Descargar PDF A4**. Cada página coloca nueve caras en una cuadrícula de 3 × 3: para las nueve sinergias, la primera página contiene imágenes/textos/imágenes y la segunda textos/imágenes/textos. Esta composición es para imprimir a una cara, no alinea ambas caras para impresión dúplex. Las ilustraciones aún no asignadas aparecen marcadas como pendientes.
- En Ataques, Estructuras, Acciones y Eventos, y Consumibles, el PDF repite cada carta según su campo `copias`; cada ilustración se puede descargar como PNG individual.

Los PDFs de cartas ya incluyen su tamaño físico. Para conservarlo, selecciona A4 y **100 % / Tamaño real** en el diálogo de impresión; no uses «Ajustar a página».

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

Los gatos se pueden reordenar libremente dentro del Sofá o del Salón por estética, incluso durante Huelga; eso no cuenta como movimiento entre zonas. Al jugar la Cama de Peluche, colócala junto al gato que protege; queda vinculada a él y no cambia de objetivo por la posición de otros gatos. Los tres cojines del Sofá miden aproximadamente 66,0 mm de ancho. Los cuatro recuadros de carta de cada tablero miden 63,5 × 88 mm en la página A4 y, centrados en los cojines, dejan unos 1,25 mm de tapicería a cada lado. Sus bordes superiores quedan a 17,97 mm del borde superior de la página en las plazas del sofá y a 18,99 mm en la zona de Estructuras. La zona útil marcada para el Salón mide 237,6 × 54,6 mm. Imprime el PDF en A4 horizontal al 100 % para conservar estas medidas.

## Diseño de las cartas

Todas las cartas usan tamaño físico **63,5 × 88 mm**, equivalente a **1800 × 2494 píxeles a 720 DPI**. La ilustración se recorta proporcionalmente, sin deformarse, en un área aproximada de **1696 × 1696 píxeles**. El diseño mantiene marco, esquinas, imagen, banda del nombre y panel inferior compartidos.

Las proporciones, posiciones y tamaños de texto se definen en `diseno` dentro de cada YAML; las familias tipográficas y el renderizado están en `js/card-renderer.js`. Si se cambia una medida, comprueba tanto la vista previa como la exportación final.

Mantén las descripciones breves, idealmente en 2-3 líneas impresas; deja los pasos y excepciones detallados para el reglamento. El tamaño de letra debe seguir siendo legible y solo reducirse automáticamente cuando el texto no quepa.

### Códigos de color de las cartas

Estos son los colores de las paletas que usa el renderizador. Se editan en `paleta` (y, para Flús-Flús de Agua, en `paleta_azul`) dentro del YAML de cada categoría.

| Categoría o variante | `marco` | `fondo` | `papel` | `tinta` | `detalle` |
| --- | --- | --- | --- | --- | --- |
| Gatos | `#D9B96E` | `#E7D1A6` | `#F5E9CE` | `#493323` | `#B98232` |
| Ataques | `#DE857E` | `#EBC8C3` | `#F5E4DF` | `#493323` | `#B94B48` |
| Estructuras | `#B8BEC2` | `#DDE2E4` | `#F5F6F6` | `#444B4F` | `#858F95` |
| Acciones y Eventos | `#A997B7` | `#E4DBEA` | `#F5F0F7` | `#493F52` | `#806A91` |
| Flús-Flús de Agua (`paleta_azul`) | `#8EADBB` | `#DDEAF0` | `#F4F8FA` | `#40535C` | `#5E8293` |
| Consumibles | `#A1B38F` | `#E0E8D9` | `#F5F8F2` | `#43523B` | `#70885F` |
| Sinergias | `#C58A2E` | `#F5E9CE` | `#FFF8E9` | `#493323` | `#B98232` |
| Reversos | `#C2A06B` | `#241E2C` | — | — | `#EAD7B3` |

El reverso también define colores propios: `medallon: #392B40`, `placa: #302538`, `cobre: #A88973` y `separador: #88748B`. En el YAML de Reversos se escriben como `paleta.medallon`, `paleta.placa`, `paleta.cobre` y `paleta.separador`.

#### Dónde se usa cada clave

- **`marco`**: relleno del borde exterior y color de acento. En el reverso dibuja el aro dorado, los rombos y la línea del medallón.
- **`fondo`**: superficie interior de las cartas normales; en el reverso, fondo ciruela y base del gradiente. En las sinergias rellena las etiquetas de gatos.
- **`papel`**: paneles claros (insignia, puntuación y habilidad), texto claro de la banda del nombre y superficie de la explicación de las sinergias.
- **`tinta`**: descripciones, valores de puntuación y demás texto oscuro.
- **`detalle`**: banda del nombre, títulos y líneas de énfasis, bordes de paneles y tintado de los iconos PNG. En Ataques no colorea el texto de daño, bonificación ni sus descripciones, que usan `dano`.
- **`medallon` y `placa`**: los dos extremos del gradiente del medallón y el relleno de las placas circulares del reverso.
- **`cobre`**: segundo marco fino del reverso.
- **`separador`**: aros y líneas separadoras del reverso, además del contorno de las placas de iconos.

El borde de la banda del nombre se genera automáticamente oscureciendo `detalle` al 68 %; no hay que introducir otro color para él. El fondo superior e inferior del reverso se oscurece al 90 % de `fondo`. Los cuatro Flús-Flús de Agua tienen `paleta: "azul"` y `paletteForCard` selecciona para ellos `paleta_azul`; el resto de Acciones y Eventos usa la paleta lila.

Los YAML también contienen a veces una clave superior `color` que repite el acento de la categoría; el dibujo de la carta toma sus colores de `paleta`, no de esa clave. Los Eventos Globales forman parte de Acciones y Eventos y usan la misma paleta lila.

Ataques admite `paleta.dano`; en esta versión es `#922F34` y se usa para todos los textos del panel de Ataque: rótulos, valores fijos o variables, bonificaciones y descripciones.

Valores `color` superiores que aún aparecen en YAML: Gatos `#D9B96E`; Ataques `#B94B48`; Estructuras `#B8BEC2`; Acciones y Eventos `#A997B7`; Consumibles `#A1B38F`. No sustituyen ningún valor de `paleta`.

Colores auxiliares del código, no paletas de cartas: `#E8DCC8` es el relleno cuando falta una ilustración; `#fffdf8` se usa para la cara ilustrada pendiente de una sinergia; `#B98232` es el tinte de icono de reserva si falta `detalle`; `#FFFFFF` es el papel blanco que se pone detrás de las esquinas transparentes al crear el PDF. La vista previa muestra el fondo `#eee5d5` de `css/cards.css`; no forma parte del PNG ni del diseño impreso. Las sombras usan `rgba(73,51,35,opacidad)` en cartas normales, `rgba(12,8,16,0.48)` en los iconos del reverso y `rgba(0,0,0,0.65)` en el icono de Flús-Flús.

### Parámetros de diseño de las cartas normales

Los campos `diseno` de Gatos, Ataques, Estructuras, Acciones y Eventos, y Consumibles son proporciones de la carta, salvo `ancho_mm`, `alto_mm`, `dpi`, `dpi_vista_previa`, `opacidad_sombra` y los grosores de trazo. Los valores `x_*` se calculan sobre el ancho; los `y_*` y las alturas, sobre el alto. Las familias tipográficas y la conversión de proporciones a píxeles están en `js/card-renderer.js`.

| Parámetros | Qué controlan | Valores actuales |
| --- | --- | --- |
| `ancho_mm`, `alto_mm`, `dpi`, `dpi_vista_previa` | Tamaño físico, resolución de exportación y resolución de la vista. | `63.5`, `88`, `720`, `240` |
| `margen`, `alto_ilustracion`, `radio_ilustracion` | Margen de la imagen, altura del área ilustrada y su redondeo. | `0.0289`, `0.68`, `0.0344` |
| `radio_esquina`, `radio_esquina_interior`, `borde_interior` | Radio de la silueta, radio interior y separación del marco interior respecto al borde. | `0.0611`, `0.0528`, `0.0156` |
| `tamano_caja_icono`, `tamano_icono`, `x_insignia`, `y_insignia`, `radio_componente` | Caja, tamaño y posición del icono de tipo, y radio de sus esquinas. | `0.11`, `0.0722`, `0.0511`, `0.0353`, `0.0306` |
| `x_panel_puntuacion`, `y_panel_puntuacion`, `ancho_puntuaciones`, `alto_puntuaciones`, `radio_puntuaciones` | Posición, tamaño y radio del panel Sofá/Salón. Solo se dibuja si la carta tiene esos iconos y puntuaciones. | `0.7889`, `0.0353`, `0.16`, `0.145`, `0.0222` |
| `tamano_icono_sofa_x/y`, `tamano_icono_salon_x/y`, `tamano_fuente_puntuacion` | Dimensiones de los iconos y tamaño del valor de puntuación. | `0.06`, `0.0366`, `0.06`, `0.0432`, `0.05` |
| `x_banda_nombre`, `y_banda_nombre`, `ancho_banda_nombre`, `alto_banda_nombre`, `radio_banda_nombre` | Caja y radio de la banda del nombre. | `0.0433`, `0.6315`, `0.9133`, `0.0906`, `0.0311` |
| `tamano_fuente_nombre`, `tamano_fuente_nombre_min`, `espaciado_nombre` | Tamaño inicial y mínimo del nombre, y espaciado entre letras. | `0.0489`, `0.0267`, `0.00083` |
| `x_panel_habilidad`, `y_panel_habilidad`, `ancho_panel_habilidad`, `alto_panel_habilidad`, `radio_panel_habilidad` | Caja de la descripción y radio de sus esquinas. | `0.0433`, `0.7338`, `0.9133`, `0.2366`, `0.0311` |
| `x_texto_habilidad`, `y_texto_habilidad`, `ancho_texto_habilidad`, `alto_texto_habilidad` | Posición y caja de texto de la descripción. | `0.1`, `0.755`, `0.8`; altura `0.195` en Gatos/Ataques y `0.21` en las demás categorías |
| `tamano_fuente_habilidad`, `tamano_fuente_habilidad_min`, `interlineado_habilidad`, `espaciado_habilidad` | Tamaño inicial/mínimo del texto, interlineado y espaciado. | `0.0311`, `0.0256`, `0.0289`, `0` |
| `opacidad_sombra`, `desplazamiento_sombra`, `desenfoque_sombra` | Intensidad, desplazamiento y desenfoque de la sombra de insignias y paneles. | `0.18`, `0.0044`, `0.01` |

En las cartas normales, el marco exterior se dibuja a 8 píxeles escalados del borde del lienzo con `radio_esquina` y relleno `marco`. El marco/superficie interior empieza a `borde_interior × ancho` y se dibuja con `radio_esquina_interior`, relleno `fondo` y un trazo de `4 × escala` en `detalle`. La ilustración queda dentro de `margen`. La insignia, el panel de puntuación y el panel de habilidad llevan trazos de `7 × escala`; la banda del nombre usa `8 × escala` y un borde oscurecido de `detalle`. Todos los paneles usan las coordenadas `x_*`/`y_*` de la tabla.

Valores específicos:

- Gatos: `alto_texto_habilidad_con_sinergia: 0.137`, `y_divisor_sinergia: 0.905`, `y_texto_sinergia: 0.938` y `tamano_fuente_sinergia: 0.0244`.
- Ataques: `tamano_fuente_rotulo_ataque: 0.028`, `tamano_fuente_valor_ataque: 0.12`, `tamano_fuente_detalle_ataque: 0.036` y `tamano_fuente_dano_variable: 0.041`.
- `inicio_nombre`, `alto_nombre`, `inicio_descripcion` y `alto_descripcion` siguen presentes en los YAML antiguos, pero el renderizador actual no los lee; las posiciones activas son las de la banda del nombre y el panel de habilidad.

### Sinergias

Las sinergias miden también **63,5 × 88 mm a 720 DPI**. Su YAML contiene la paleta y el tamaño físico; la composición se fija en `drawSynergyFace` en `js/card-renderer.js`.

| Parámetro fijo | Valor |
| --- | --- |
| Borde | `0.035 × ancho` |
| Margen de contenido y radio de esquina | `0.055 × ancho` |
| Caja de texto | x `0.10 × ancho`, ancho `0.80 × ancho` |
| Título del reverso | y `0.065 × alto`, alto `0.17 × alto`; fuente entre `0.067 × ancho` y `0.045 × ancho` |
| Divisor | y `0.25 × alto`, grosor `max(2 px, 0.006 × ancho)` |
| Efecto | y `0.29 × alto`, alto `0.31 × alto`; fuente entre `0.043 × ancho` y `0.029 × ancho` |
| Lore | y `0.63 × alto`, alto `0.19 × alto`; fuente entre `0.029 × ancho` y `0.022 × ancho` |
| Etiquetas de gatos | y `0.87 × alto`, alto `0.06 × alto`; fuente entre `0.024 × ancho` y `0.018 × ancho` |

El anverso recorta la ilustración dentro de la silueta y usa `marco`; el reverso usa `marco` en el borde, `papel` en la superficie interior, `detalle` en título/divisor/etiquetas, `tinta` en los textos y `fondo` en las etiquetas de gatos. Las etiquetas se dimensionan según el texto, con separación `0.012 × ancho`, relleno horizontal `0.014 × ancho` y un ancho total máximo de `0.84 × ancho`.

### Reverso: coordenadas y bordes

El reverso conserva el tamaño físico de una carta: **63,5 × 88 mm**, **720 DPI** (1800 × 2494 px). `lienzo_px: [750, 1040]` es la cuadrícula de referencia del diseño, no la resolución final. Las coordenadas se miden desde la esquina superior izquierda. Los marcos usan `[izquierda, arriba, derecha, abajo, radio, grosor]`; `fondo_carta` no tiene grosor porque es un relleno, no un borde visible.

| Elemento | Parámetro actual | Color |
| --- | --- | --- |
| Silueta/fondo redondeado, sin filete exterior | `fondo_carta: [3.3, 3.3, 746.7, 1036.7, 46]` | Gradiente de `fondo` |
| Marco principal | `marco_exterior: [46, 46, 703, 993, 46, 9]` | `marco` |
| Filete interior | `marco_interior: [57, 57, 692, 982, 39, 3]` | `cobre` |
| Separadores superior/inferior | De `(142,333)` a `(607,333)` y de `(142,706)` a `(607,706)`, grosor `4` | `separador` |
| Medallón | Centro `(374.5,519.5)`, radio `155.5`, aro `5` | Gradiente `placa`→`medallon`, aro `marco` |
| Aro interior del medallón | Centro `(374.5,519.5)`, radio `143.5`, grosor `2` | `separador` |
| Línea interior del medallón | De `(311,519)` a `(438,519)`, grosor `4` | `marco` |
| Rombos de esquina | Centros `(75,75)`, `(674,75)`, `(75,964)`, `(674,964)`, tamaño `14` | `marco` |
| Rombo central | Centro `(375,519)`, tamaño `16` | `marco` |
| Puntos de separadores | `(142,333)`, `(607,333)`, `(142,706)`, `(607,706)`, radio `3` | `marco` |

El reverso conserva únicamente las dos huellas centrales, situadas a ambos lados de la línea del medallón. Sus cajas se indican como `[x, y, tamaño]`; la huella inferior se gira 180°:

| Icono | Caja superior `[x,y,tamaño]` | Caja inferior `[x,y,tamaño]` |
| --- | --- | --- |
| Huella | `[330,408,90]` | `[330,542,90]` |

Las huellas se tintan con `detalle`. Para cambiar sus posiciones se editan los arrays `icono_huella_*` de `diseno` en `cartas/reversos/categoria.yml`; para cambiar sus colores, `paleta` en ese mismo YAML. Los marcos, medallón, rombos, puntos y líneas decorativas se mantienen.

## Cómo editar o añadir cartas

Los YAML son la fuente de datos del catálogo: evita duplicar nombres, daños, textos o rutas dentro del código JavaScript.

### Gatos

Cada entrada define `nombre`, `imagen`, `sofa`, `salon`, `habilidad` y `descripcion`. `sofa` admite una puntuación fija o un rango condicional como `0/7`, que se muestra en el panel superior; la habilidad explica cuándo corresponde cada valor. El nombre de la habilidad aparece integrado al inicio del efecto. `recordatorio` es opcional y se presenta por separado antes de la habilidad; `sinergia` también es opcional. Las cartas de Gatos no se duplican en el PDF.

### Ataques y apoyos

Cada entrada define `nombre`, `imagen`, `tipo` (`ataque` o `apoyo`) y `copias`.

- Para un ataque de daño fijo, usa `dano: <número>`.
- Para un daño variable, usa `dano_variable: "<fórmula en texto>"`; la carta muestra la fórmula en vez de un valor fijo.
- Para un apoyo, usa `bonificacion: <número>` y `descripcion`.
- `paleta.dano` es opcional para la categoría; colorea todos los textos del panel de Ataque y Apoyo (rótulos, daño, bonificaciones, fórmulas variables y descripciones). En esta versión es `#922F34`.
- La galería llama **DAÑO** al valor fijo. El reglamento conserva el término «potencia» en sus reglas de ataque, defensa y bonificaciones; no cambies esa terminología del reglamento sin revisar las reglas y confirmarlo.

### Estructuras

Cada entrada define `nombre`, `imagen`, `tipo: "estructura"`, `copias` y `descripcion`. El PDF genera las copias indicadas; el PNG individual se descarga una sola vez por tipo.

### Acciones y Eventos

La pestaña **Acciones y Eventos** reúne acciones, objetos, Eventos Globales y respuestas. Cada entrada define `nombre`, `imagen`, `tipo` (`accion`, `objeto`, `evento_global` o `respuesta`), `copias` y `descripcion`. Los eventos globales conservan `tipo: "evento_global"`; aparecen después de las acciones y objetos, y las respuestas de Flús-Flús quedan al final. Las cartas que muestran la marca de Flús-Flús llevan `marca_flush: true`; Sabotaje Vecinal no lleva la marca y no se puede cancelar. El icono de Flús-Flús se configura en `iconos.flush`, aparece sin recuadro en la parte superior derecha y usa el color de detalle de la paleta de la carta. Las cartas con `paleta: "azul"` usan la paleta azul específica de Flús-Flús. Cada ilustración de Flús es una entrada independiente para que sus cuatro copias salgan distintas en el PDF y puedan descargarse por separado.

### Consumibles

Cada consumible define `nombre`, `imagen`, `tipo: "consumible"`, `copias` y `descripcion`.

Las entradas y las ilustraciones de Eventos Globales están integradas en `cartas/acciones/categoria.yml` y `cartas/acciones/imagenes/`; ya no hay una categoría o carpeta separada para ellas.

### Sinergias

Las nueve sinergias se mantienen en `cartas/sinergias/categoria.yml`. Cada una define `nombre`, `descripcion`, `lore` y `gatos`; `gatos` es una lista de los nombres que activan la sinergia (tres para Los Trillizos). `imagen` es opcional; al añadir una ilustración, registra su ruta relativa al YAML. En el PDF A4, las caras se distribuyen en una cuadrícula de 3 × 3, alternando filas de ilustraciones y texto; las nueve sinergias ocupan dos páginas. La maquetación no alinea las caras para dúplex.

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
