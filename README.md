# ¡Ese gato es mío! — catálogo de cartas

Galería local para previsualizar las cartas de cada categoría, descargar cada una como PNG e imprimir una categoría completa en PDF A4.

## Abrir el catálogo

Abre `index.html` con Chrome o Edge. El catálogo intenta cargar automáticamente los archivos del proyecto, sin pedir que selecciones la carpeta. Si el navegador bloquea el acceso local, el botón de selección manual permite elegir la carpeta raíz; también puedes servir la carpeta desde un servidor web local. Los archivos se leen localmente y no se suben a Internet.

También se puede servir esta carpeta desde un servidor web local. En ese caso, las categorías se cargan automáticamente.

## Categorías y archivos

- `cartas/gatos/categoria.yml` contiene las 20 cartas de gato, sus ilustraciones, nombres, habilidades, sinergias, puntuaciones, iconos, colores y proporciones del diseño.
- `cartas/gatos/imagenes/` guarda las ilustraciones de gatos.
- `cartas/ataques/categoria.yml` contiene los 17 tipos de ataques y apoyos, sus ilustraciones, daños, bonificaciones y copias. Los daños variables muestran su fórmula en lugar de un valor fijo.
- `cartas/emojis/` guarda los iconos `paw.png`, `sofa.png`, `salon.png` y `ataque.png`.

Las rutas de imágenes e iconos de cada YAML son relativas al archivo de categoría. Las cartas se imprimen a 63,5 × 88 mm (1800 × 2494 píxeles, 720 DPI). Gatos usa marco `#D9B96E`, fondo intermedio `#E7D1A6`, papel `#F5E9CE` y acento `#B98232`; Ataques usa marco `#B94B48`, fondo `#EBC8C3`, papel `#F0D4CF` y acento `#D28A83`. Ataques conserva el mismo tratamiento de bordes y paneles claros que Gatos, con el rojo en el nombre y en el contorno del panel «DAÑO». El PDF coloca hasta nueve cartas por página A4, en una cuadrícula de 3 × 3 con 3 mm de separación y marcas de corte. En Ataques, el PDF respeta las cantidades indicadas en `copias`; cada descarga PNG individual corresponde a un tipo de carta. Al imprimirlo, elige el tamaño real o una escala del 100 %.
