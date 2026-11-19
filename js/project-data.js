'use strict';

const CATEGORY_PATHS = [
  'cartas/gatos/categoria.yml',
  'cartas/ataques/categoria.yml',
  'cartas/estructuras/categoria.yml',
  'cartas/acciones/categoria.yml',
  'cartas/consumibles/categoria.yml',
  'cartas/sinergias/categoria.yml'
];
const RULEBOOK_PATH = 'reglamento/categoria.yml';
const $ = (id) => document.getElementById(id);
const state = {
  categories: [],
  rulebook: null,
  activeSlug: null,
  categoryRenderId: 0,
  uploadedFiles: null,
  uploadedFileMap: new Map(),
  imageCache: new Map(),
  tintedIconCache: new Map(),
  finalPdfGenerating: false
};

function setStatus(message, isError=false) {
  const status = $('status');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function parseYamlValue(value) {
  const text = value.trim();
  if (!text) return '';
  if (text.startsWith('"')) return JSON.parse(text);
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
  if (text === '[]') return [];
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text.replace(/\s+#.*$/, '').trim();
}

function parsePair(text) {
  const match = text.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
  if (!match) throw new Error(`No se pudo interpretar esta línea del YAML: ${text}`);
  return [match[1], parseYamlValue(match[2])];
}

function parseCategoryYaml(text) {
  const category = {};
  let section = null;
  let currentCard = null;

  for (const rawLine of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    if (indent === 0) {
      const [key, value] = parsePair(line);
      if (value === '') {
        section = key;
        category[key] = key === 'cartas' ? [] : {};
      } else {
        section = null;
        category[key] = value;
      }
      currentCard = null;
      continue;
    }

    if (section === 'cartas') {
      const itemMatch = line.match(/^-\s*(.*)$/);
      if (indent === 2 && itemMatch) {
        currentCard = {};
        category.cartas.push(currentCard);
        const firstPair = itemMatch[1].trim();
        if (firstPair) {
          const [key, value] = parsePair(firstPair);
          currentCard[key] = value;
        }
      } else if (currentCard) {
        const [key, value] = parsePair(line);
        currentCard[key] = value;
      }
      continue;
    }

    if (section) {
      const [key, value] = parsePair(line);
      category[section][key] = value;
    }
  }

  validateCategory(category);
  return category;
}

function validateCategory(category) {
  if (category.slug === 'reglamento') {
    const ruleTypes = new Set(['encabezado', 'seccion', 'nota', 'lista', 'sinergia']);
    if (!category.nombre || !Array.isArray(category.cartas) || !category.cartas.length) {
      throw new Error('El reglamento debe incluir un nombre y al menos un bloque de contenido.');
    }
    for (const block of category.cartas) {
      if (!Number.isInteger(block.pagina) || block.pagina < 1
        || !ruleTypes.has(block.tipo) || !block.texto) {
        throw new Error(`El bloque «${block.titulo || 'sin título'}» del reglamento no es válido.`);
      }
      if (['encabezado', 'seccion', 'nota', 'sinergia'].includes(block.tipo) && !block.titulo) {
        throw new Error(`El bloque ${block.tipo} de la página ${block.pagina} necesita un título.`);
      }
      if (block.tipo === 'lista' && !block.grupo) {
        throw new Error(`Los elementos de lista de la página ${block.pagina} necesitan un grupo.`);
      }
      if (block.columnas !== undefined && ![2, 3].includes(block.columnas)) {
        throw new Error(`La página ${block.pagina} debe usar 2 o 3 columnas.`);
      }
      if (block.ancho !== undefined && block.ancho !== 'completo') {
        throw new Error(`El ancho del bloque «${block.titulo || 'sin título'}» no es válido.`);
      }
    }
    return;
  }

  const isSynergyCategory = category.slug === 'sinergias';
  if (!category.nombre || !category.slug || (!category.iconos && !isSynergyCategory)
    || !category.diseno || !Array.isArray(category.cartas)) {
    throw new Error('Faltan datos obligatorios en el archivo de categoría.');
  }
  const {ancho_mm, alto_mm, dpi} = category.diseno;
  if (![ancho_mm, alto_mm, dpi].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error(`La categoría "${category.nombre}" debe definir ancho_mm, alto_mm y dpi válidos.`);
  }
  if (Object.values(category.diseno).some(value => !Number.isFinite(value))) {
    throw new Error(`La categoría "${category.nombre}" tiene proporciones de diseño no válidas.`);
  }
  const palettes = Object.entries(category)
    .filter(([key]) => key === 'paleta' || key.startsWith('paleta_'));
  if (!category.paleta || palettes.some(([, palette]) =>
    !palette || Object.values(palette).some(color => !/^#[0-9a-fA-F]{6}$/.test(color)))) {
    throw new Error(`La categoría "${category.nombre}" tiene colores no válidos.`);
  }
  if (isSynergyCategory) {
    for (const card of category.cartas) {
      if (!card.nombre || !card.descripcion
        || (card.imagen !== undefined && typeof card.imagen !== 'string')) {
        throw new Error(`La sinergia "${card.nombre || 'sin nombre'}" necesita nombre y explicación válidos.`);
      }
    }
    return;
  }
  if (!category.iconos.tipo) throw new Error(`La categoría "${category.nombre}" no define un icono de tipo.`);
  for (const card of category.cartas) {
    if (!card.nombre || !card.imagen) {
      throw new Error(`La carta "${card.nombre || 'sin nombre'}" necesita nombre e imagen.`);
    }
    if (card.marca_flush !== undefined && typeof card.marca_flush !== 'boolean') {
      throw new Error(`La carta "${card.nombre}" tiene una marca de Flús-Flús no válida.`);
    }
    if (card.marca_flush && !category.iconos.flush) {
      throw new Error(`La carta "${card.nombre}" necesita el icono de Flús-Flús.`);
    }
    if (category.slug === 'gatos' && !card.descripcion) {
      throw new Error(`La carta "${card.nombre}" necesita una descripción.`);
    }
    if (category.slug === 'ataques') {
      if (!['ataque', 'apoyo'].includes(card.tipo) || !Number.isInteger(card.copias) || card.copias < 1) {
        throw new Error(`La carta "${card.nombre}" necesita un tipo y un número de copias válidos.`);
      }
      if (card.tipo === 'ataque' && !Number.isFinite(card.dano) && !card.dano_variable) {
        throw new Error(`La carta "${card.nombre}" necesita daño fijo o una descripción de daño variable.`);
      }
      if (card.tipo === 'apoyo' && !Number.isFinite(card.bonificacion)) {
        throw new Error(`La carta "${card.nombre}" necesita una bonificación válida.`);
      }
    }
    if (category.slug === 'estructuras'
      && (card.tipo !== 'estructura' || !card.descripcion
        || !Number.isInteger(card.copias) || card.copias < 1)) {
      throw new Error(`La carta "${card.nombre}" necesita descripción y cantidad de copias válidas.`);
    }
    if (category.slug === 'acciones') {
      if (!['accion', 'objeto', 'respuesta', 'evento_global'].includes(card.tipo) || !card.descripcion
        || !Number.isInteger(card.copias) || card.copias < 1) {
        throw new Error(`La carta "${card.nombre}" necesita tipo, descripción y cantidad de copias válidos.`);
      }
      if (card.paleta && !category[`paleta_${card.paleta}`]) {
        throw new Error(`La carta "${card.nombre}" hace referencia a una paleta no definida.`);
      }
      if (card.tipo === 'respuesta' && (!Number.isInteger(card.version) || card.version < 1)) {
        throw new Error(`La carta "${card.nombre}" necesita un número de ilustración válido.`);
      }
    }
    if (category.slug === 'consumibles'
      && (card.tipo !== 'consumible' || !card.descripcion
        || !Number.isInteger(card.copias) || card.copias < 1)) {
      throw new Error(`La carta "${card.nombre}" necesita descripción y cantidad de copias válidas.`);
    }
    if (category.slug === 'globales'
      && (card.tipo !== 'evento_global' || !card.descripcion
        || !Number.isInteger(card.copias) || card.copias < 1)) {
      throw new Error(`La carta "${card.nombre}" necesita descripción y cantidad de copias válidas.`);
    }
  }
}

