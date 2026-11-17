# ¡Ese gato es mío! — catálogo y guía del proyecto

## Propósito

Este repositorio contiene una galería web local y los recursos para diseñar, revisar e imprimir las cartas del juego de mesa «¡Ese gato es mío!». La galería lee las categorías desde YAML, monta las ilustraciones en una plantilla común y permite descargar PNG individuales o un PDF A4 listo para imprimir.

La aplicación es estática: HTML, CSS y JavaScript, sin servidor, dependencias ni proceso de compilación. Los archivos se procesan en el navegador y no se suben a Internet.

## Estado actual

- **Gatos:** 20 cartas configuradas, con ilustraciones, puntuación de Sofá y Salón, descripciones y sinergias cuando corresponden.
- **Ataques:** 17 tipos de cartas (ataques y apoyos), 27 copias físicas en total, con daño fijo o variable y sus ilustraciones.
- **Estructuras:** 5 tipos y 7 copias físicas.
- **Acciones:** 16 tipos en la galería (19 acciones, 4 objetos y 4 respuestas), con cuatro ilustraciones distintas para Flús-Flús de Agua.
- **Consumibles:** 4 tipos y 8 copias físicas.
- **Eventos Globales:** 2 tipos y 2 copias físicas integrados; falta la ilustración de Cambio de Arenero.
- **Mazo:** 92 cartas según las cantidades detalladas acordadas.
- **Reglamento de referencia:** [Ese_gato_es_mio_reglamento_v0.48.txt](./Ese_gato_es_mio_reglamento_v0.48.txt). El archivo v0.47 es una versión anterior.
- El pie de [index.html](./index.html) incluye el aviso de derechos de autor.

## Abrir la galería

Abre `index.html` con Chrome o Edge. La aplicación intenta cargar automáticamente las categorías y las imágenes desde la carpeta del proyecto.

Si el navegador bloquea la lectura local, utiliza **Seleccionar carpeta manualmente** y elige la raíz del proyecto. También puedes servir la carpeta con cualquier servidor web local; no hace falta instalar paquetes ni compilar nada.

Cada categoría tiene una pestaña. La galería muestra una carta por tipo:

- **Descargar PNG** descarga ese tipo de carta como PNG a 720 DPI.
- **Descargar PDF A4** genera el conjunto de la categoría, con hasta nueve cartas por página, separación de 3 mm y marcas de corte.
- En Ataques, Estructuras, Acciones, Consumibles y Eventos Globales, el PDF repite cada carta según su campo `copias`; cada ilustración se puede descargar como PNG individual.

Al imprimir, selecciona tamaño real o escala del 100 % para conservar las dimensiones.

## Estructura de archivos

```text
index.html
styles.css
app.js
README.md
Ese_gato_es_mio_reglamento_v0.48.txt
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
    categoria.yml
    imagenes/
```

- `index.html`: estructura de la página y aviso de derechos.
- `styles.css`: presentación de la galería, pestañas, botones y tarjetas de vista previa.
- `app.js`: lectura y validación de categorías, carga de imágenes, renderizado en canvas y exportación PNG/PDF.
- Los archivos `categoria.yml` dentro de cada categoría contienen sus datos y configuración visual.
- `cartas/emojis/`: iconos comunes de tipo, huella, sofá y salón.
- `cartas/<categoria>/imagenes/`: ilustraciones de esa categoría.

Las rutas `imagen` e `iconos` de cada YAML son relativas al propio archivo de categoría. El nombre y la extensión deben coincidir exactamente con el archivo en disco.

## Diseño de las cartas

Todas las cartas usan tamaño físico **63,5 × 88 mm**, equivalente a **1800 × 2494 píxeles a 720 DPI**. La ilustración se recorta proporcionalmente, sin deformarse, en un área aproximada de **1696 × 1696 píxeles**. El diseño mantiene marco, esquinas, imagen, banda del nombre y panel inferior compartidos.

Las proporciones, posiciones y tamaños de texto se definen en `diseno` dentro de cada YAML; las familias tipográficas y el renderizado están en `app.js`. Si se cambia una medida, comprueba tanto la vista previa como la exportación final.

Mantén las descripciones breves, idealmente en 2-3 líneas impresas; deja los pasos y excepciones detallados para el reglamento. El tamaño de letra debe seguir siendo legible y solo reducirse automáticamente cuando el texto no quepa.

Paletas actuales:

| Categoría | Marco | Fondo | Superficies de texto/panel | Detalle |
| --- | --- | --- | --- | --- |
| Gatos | `#D9B96E` | `#E7D1A6` | `#F5E9CE` | `#B98232` |
| Ataques | `#DE857E` | `#EBC8C3` | `#F5E4DF` | `#B94B48` |
| Estructuras | `#B8BEC2` | `#DDE2E4` | `#F5F6F6` | `#858F95` |
| Acciones | `#A997B7` | `#E4DBEA` | `#F5F0F7` | `#806A91` |
| Eventos Globales | `#A997B7` | `#E4DBEA` | `#F5F0F7` | `#806A91` |
| Flús-Flús de Agua | `#8EADBB` | `#DDEAF0` | `#F4F8FA` | `#5E8293` |
| Consumibles | `#A1B38F` | `#E0E8D9` | `#F5F8F2` | `#70885F` |

Ataques sigue la estructura de bordes y paneles claros de Gatos. El coral del marco se usa en los rótulos y valores fijos de ataque o apoyo. Estructuras usa tonos blancos y grisáceos apagados; Acciones y Eventos Globales, morados suaves; y Consumibles, verdes suaves. Flús-Flús de Agua se mantiene en la pestaña Acciones, pero usa una paleta azul propia. Las paletas están en el YAML de cada categoría.

La banda del nombre usa el color de detalle de cada categoría como fondo, una versión más oscura de ese color como borde y el color claro de la superficie para el texto. En Acciones, Eventos Globales, Flús-Flús y Consumibles, el marco exterior y el detalle interior tienen tonos más separados para distinguir mejor los dos bordes. En Ataques, el rojo de detalle también se usa en las fórmulas de daño y descripciones; los rótulos y valores fijos mantienen el coral del marco.

## Cómo editar o añadir cartas

Los YAML son la fuente de datos del catálogo: evita duplicar nombres, daños, textos o rutas dentro de `app.js`.

### Gatos

Cada entrada define `nombre`, `imagen`, `sofa`, `salon` y `descripcion`. `sinergia` es opcional; solo se muestra si está presente. Las cartas de Gatos no se duplican en el PDF.

### Ataques y apoyos

Cada entrada define `nombre`, `imagen`, `tipo` (`ataque` o `apoyo`) y `copias`.

- Para un ataque de daño fijo, usa `dano: <número>`.
- Para un daño variable, usa `dano_variable: "<fórmula en texto>"`; la carta muestra la fórmula en vez de un valor fijo.
- Para un apoyo, usa `bonificacion: <número>` y `descripcion`.
- La galería llama **DAÑO** al valor fijo. El reglamento conserva el término «potencia» en sus reglas de ataque, defensa y bonificaciones; no cambies esa terminología del reglamento sin revisar las reglas y confirmarlo.

### Estructuras

Cada entrada define `nombre`, `imagen`, `tipo: "estructura"`, `copias` y `descripcion`. El PDF genera las copias indicadas; el PNG individual se descarga una sola vez por tipo.

### Acciones, objetos y respuestas

La pestaña Acciones reúne acciones, objetos y respuestas. Cada entrada define `nombre`, `imagen`, `tipo` (`accion`, `objeto` o `respuesta`), `copias` y `descripcion`. Las cartas que muestran la marca de Flús-Flús llevan `marca_flush: true`; el icono se configura en `iconos.flush`, aparece sin recuadro en la parte superior derecha y usa el color de detalle de la paleta de la carta. Esta marca es visual: no determina por sí sola si una carta puede cancelarse. Las cartas con `paleta: "azul"` usan la paleta azul específica de Flús-Flús. Cada ilustración de Flús es una entrada independiente para que sus cuatro copias salgan distintas en el PDF y puedan descargarse por separado.

### Consumibles

Cada consumible define `nombre`, `imagen`, `tipo: "consumible"`, `copias` y `descripcion`.

### Eventos Globales

Cada evento define `nombre`, `imagen`, `tipo: "evento_global"`, `copias` y `descripcion`. Los eventos globales no son cancelables según el reglamento. La categoría incluye por ahora Hora de la Siesta y Perro del Vecino; Cambio de Arenero queda pendiente de su ilustración.

### Añadir una categoría nueva

1. Crea `cartas/<categoria>/categoria.yml` e `imagenes/` siguiendo el formato de las categorías existentes.
2. Usa rutas relativas al YAML y comprueba que cada imagen exista.
3. Añade la ruta del YAML a `CATEGORY_PATHS` en `app.js`.
4. Si la categoría necesita datos o una composición distintos, actualiza también `validateCategory` y el renderizado específico de `drawCard`.
5. Comprueba carga de todas las imágenes, PNG individual, PDF, cantidades de copias y tamaño físico.

El lector YAML integrado admite un subconjunto sencillo: claves de texto/número booleano y listas de cartas planas. Mantén las claves en ASCII con `snake_case` y los textos y rutas entre comillas dobles, como en los ejemplos actuales; no dependas de construcciones YAML avanzadas.

## Flujo recomendado

1. Confirma nombre, texto, estadísticas y cantidad de copias con el reglamento vigente; no inventes datos que falten.
2. Coloca cada ilustración en la carpeta `imagenes/` de su categoría y registra su ruta exacta en el YAML.
3. Usa el YAML para cambiar datos de cartas y paletas. Modifica `app.js` solo cuando haga falta comportamiento o composición nuevos.
4. Recarga la galería y revisa todas las cartas afectadas; prueba al menos un PNG individual y el PDF A4.

El reglamento v0.48 está disponible como archivo de texto. Una página o maquetación específica para manuales todavía no forma parte de la aplicación.

## Criterios para futuros cambios

- Usa el reglamento v0.48 como referencia, pero no inventes ni cambies mecánicas para corregir el diseño. Si hay una contradicción o falta información, consulta antes de modificar las reglas.
- Conserva la plantilla y las medidas entre cartas de una misma categoría; cambia ilustración y datos, no la distribución, salvo petición expresa.
- Mantén separados los recursos por categoría y no renombres una imagen sin actualizar su referencia YAML.
- Después de editar, abre la galería, confirma que no faltan ilustraciones y revisa visualmente PNG y PDF. Ejecuta también `git diff --check`.
- No se necesita un build ni instalar dependencias para trabajar en este proyecto.
