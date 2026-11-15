# ¡Ese gato es mío! — catálogo de cartas

Galería local para previsualizar las cartas de cada categoría, descargar cada una como PNG e imprimir una categoría completa en PDF A4.

## Abrir el catálogo

Abre `index.html` con Chrome o Edge. El catálogo intenta cargar automáticamente los archivos del proyecto, sin pedir que selecciones la carpeta. Si el navegador bloquea el acceso local, el botón de selección manual permite elegir la carpeta raíz; también puedes servir la carpeta desde un servidor web local. Los archivos se leen localmente y no se suben a Internet.

También se puede servir esta carpeta desde un servidor web local. En ese caso, las categorías se cargan automáticamente.

## Categorías y archivos

- `cartas/gatos/categoria.yml` contiene las 20 cartas de gato, sus ilustraciones, nombres, habilidades, sinergias, puntuaciones, iconos, colores y proporciones del diseño.
- `cartas/gatos/imagenes/` guarda las ilustraciones de gatos.
- `cartas/ataques/categoria.yml` define la categoría de ataques y su icono. La lista de cartas está vacía hasta que se añadan sus imágenes y datos.
- `cartas/emojis/` guarda los iconos `paw.png`, `sofa.png`, `salon.png` y `ataque.png`.

Las rutas de imágenes e iconos de cada YAML son relativas al archivo de categoría. Las cartas se imprimen a 63,5 × 88 mm (1800 × 2494 píxeles, 720 DPI). El marco usa `#D9B96E`, el papel `#F5E9CE` y los acentos `#B98232`. El PDF coloca hasta nueve cartas por página A4, en una cuadrícula de 3 × 3 con 3 mm de separación y marcas de corte. Al imprimirlo, elige el tamaño real o una escala del 100 %.
