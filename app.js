'use strict';

const CATEGORY_PATHS = [
  'cartas/gatos/categoria.yml',
  'cartas/ataques/categoria.yml',
  'cartas/estructuras/categoria.yml',
  'cartas/acciones/categoria.yml',
  'cartas/consumibles/categoria.yml',
  'cartas/globales/categoria.yml',
  'cartas/sinergias/categoria.yml'
];
const $ = (id) => document.getElementById(id);
const state = {
  categories: [],
  activeSlug: null,
  categoryRenderId: 0,
  uploadedFiles: null,
  uploadedFileMap: new Map(),
  imageCache: new Map(),
  tintedIconCache: new Map()
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
      if (!['accion', 'objeto', 'respuesta'].includes(card.tipo) || !card.descripcion
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

function paletteForCard(category, card) {
  return card.paleta ? category[`paleta_${card.paleta}`] : category.paleta;
}

function darkenColor(color, factor) {
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error(`Invalid palette color: ${color}`);
  const value = Number.parseInt(color.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255]
    .map(channel => Math.round(channel * factor));
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeProjectPath(path) {
  const parts = String(path).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length > 1) parts.shift();
  return parts.join('/');
}

function resolveProjectPath(configPath, relativePath) {
  const parts = configPath.replace(/\\/g, '/').split('/').slice(0, -1);
  for (const part of relativePath.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

async function loadCategoryFile(path) {
  if (state.uploadedFiles) {
    const file = state.uploadedFileMap.get(path.toLowerCase());
    if (!file) throw new Error(`No se encontró ${path}. Selecciona la carpeta raíz del proyecto.`);
    return parseCategoryYaml(await file.text());
  }

  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo leer ${path} (${response.status}).`);
  return parseCategoryYaml(await response.text());
}

function assetUrl(category, assetPath) {
  const projectPath = resolveProjectPath(category.configPath, assetPath);
  if (state.uploadedFiles) {
    const file = state.uploadedFileMap.get(projectPath.toLowerCase());
    if (!file) throw new Error(`No se encontró el archivo ${projectPath}.`);
    if (!file._cardMakerUrl) file._cardMakerUrl = URL.createObjectURL(file);
    return file._cardMakerUrl;
  }
  return new URL(assetPath, new URL(category.configPath, location.href)).href;
}

function loadImage(url) {
  if (state.imageCache.has(url)) return state.imageCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar una imagen: ${url}`));
    image.src = url;
  });
  state.imageCache.set(url, promise);
  return promise;
}

function tintedIcon(category, iconKey, image, palette=category.paleta) {
  const color = palette.detalle || '#B98232';
  const cacheKey = `${assetUrl(category, category.iconos[iconKey])}:${color}`;
  if (state.tintedIconCache.has(cacheKey)) return state.tintedIconCache.get(cacheKey);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  state.tintedIconCache.set(cacheKey, canvas);
  return canvas;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawCover(context, image, x, y, width, height, radius) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

function drawContain(context, image, x, y, width, height) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function fillCardShape(context, x, y, width, height, radius, fill, stroke, lineWidth, shadow) {
  context.save();
  if (shadow) {
    context.shadowColor = shadow.color;
    context.shadowBlur = shadow.blur;
    context.shadowOffsetY = shadow.offsetY;
  }
  roundedRect(context, x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.lineWidth = lineWidth;
    context.strokeStyle = stroke;
    context.stroke();
  }
  context.restore();
}

function fitText(context, text, maxWidth, initialSize, minimumSize, family, weight='700') {
  let size = initialSize;
  while (size > minimumSize) {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  context.font = `${weight} ${size}px ${family}`;
}

function wrapText(context, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (line && context.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawAttackContent(context, category, card, x, y, width, height) {
  const design = category.diseno;
  const palette = paletteForCard(category, card);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const textWidth = width * 0.82;

  context.textAlign = 'center';
  context.textBaseline = 'middle';

  if (card.dano_variable) {
    let fontSize = Math.round(width * design.tamano_fuente_dano_variable);
    let lines = [];
    let lineHeight = 0;
    while (fontSize >= width * 0.025) {
      context.font = `600 ${fontSize}px "Nunito Sans", Arial, Helvetica, sans-serif`;
      lines = wrapText(context, card.dano_variable, textWidth);
      lineHeight = fontSize * 1.18;
      if (lines.length * lineHeight <= height * 0.76) break;
      fontSize -= 2;
    }
    context.fillStyle = palette.detalle;
    const firstLineY = centerY - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => context.fillText(line, centerX, firstLineY + index * lineHeight, textWidth));
    return;
  }

  const isSupport = card.tipo === 'apoyo';
  const hasDescription = Boolean(card.descripcion);
  const label = isSupport ? 'BONIFICACIÓN' : 'DAÑO';
  const value = isSupport ? `+${card.bonificacion}` : String(card.dano);
  const labelY = centerY - height * (hasDescription ? 0.26 : 0.16);
  const valueY = centerY + height * (hasDescription ? -0.02 : 0.08);

  context.fillStyle = palette.marco;
  context.font = `800 ${Math.round(width * design.tamano_fuente_rotulo_ataque)}px "Nunito Sans", Arial, sans-serif`;
  context.fillText(label, centerX, labelY);

  context.fillStyle = palette.marco;
  context.font = `700 ${Math.round(width * design.tamano_fuente_valor_ataque)}px "Lora", Georgia, serif`;
  context.fillText(value, centerX, valueY);

  if (hasDescription) {
    let fontSize = Math.round(width * design.tamano_fuente_detalle_ataque);
    let lines = [];
    let lineHeight = 0;
    while (fontSize >= width * 0.02) {
      context.font = `600 ${fontSize}px "Nunito Sans", Arial, Helvetica, sans-serif`;
      lines = wrapText(context, card.descripcion, textWidth);
      lineHeight = fontSize * 1.18;
      if (lines.length * lineHeight <= height * 0.34) break;
      fontSize -= 2;
    }
    context.fillStyle = palette.detalle;
    const detailY = centerY + height * 0.3;
    const firstLineY = detailY - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => context.fillText(line, centerX, firstLineY + index * lineHeight, textWidth));
  }
}

function drawCard(canvas, category, card, artImage, icons, renderDpi=category.diseno.dpi) {
  const context = canvas.getContext('2d');
  const palette = paletteForCard(category, card);
  const design = category.diseno;
  const width = Math.round(design.ancho_mm * renderDpi / 25.4);
  const height = Math.round(design.alto_mm * renderDpi / 25.4);
  const scale = renderDpi / 720;
  const margin = Math.round(width * design.margen);
  const corner = Math.round(width * design.radio_esquina);
  const artHeight = Math.round(height * design.alto_ilustracion);
  const innerBorder = Math.round(width * design.borde_interior);
  const componentRadius = Math.round(width * design.radio_componente);
  const shadow = {
    color: `rgba(73,51,35,${design.opacidad_sombra})`,
    blur: width * design.desenfoque_sombra,
    offsetY: width * design.desplazamiento_sombra
  };

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  fillCardShape(context, 8 * scale, 8 * scale, width - 16 * scale, height - 16 * scale,
    corner, palette.marco, null, 0, null);
  fillCardShape(context, innerBorder, innerBorder, width - innerBorder * 2, height - innerBorder * 2,
    Math.round(width * design.radio_esquina_interior), palette.fondo || palette.papel, palette.detalle, 4 * scale, null);

  if (artImage) {
    drawCover(context, artImage, margin, margin, width - margin * 2, artHeight,
      Math.round(width * design.radio_ilustracion));
  } else {
    fillCardShape(context, margin, margin, width - margin * 2, artHeight,
      Math.round(width * design.radio_ilustracion), '#E8DCC8', null, 0, null);
    context.fillStyle = palette.tinta;
    context.textAlign = 'center';
    context.font = `600 ${width * 0.035}px Arial, sans-serif`;
    context.fillText('ILUSTRACIÓN NO DISPONIBLE', width / 2, margin + artHeight / 2);
  }

  const typeBoxSize = Math.round(width * design.tamano_caja_icono);
  const iconSize = Math.round(width * design.tamano_icono);
  const typeBoxX = Math.round(width * design.x_insignia);
  const typeBoxY = Math.round(height * design.y_insignia);
  fillCardShape(context, typeBoxX, typeBoxY, typeBoxSize, typeBoxSize,
    Math.round(width * design.radio_componente), palette.papel, palette.detalle,
    7 * scale, shadow);
  if (icons.tipo) drawContain(context, icons.tipo,
    typeBoxX + (typeBoxSize - iconSize) / 2, typeBoxY + (typeBoxSize - iconSize) / 2,
    iconSize, iconSize);
  if (icons.flush) {
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.65)';
    context.shadowBlur = 4 * scale;
    context.shadowOffsetY = scale;
    drawContain(context, icons.flush,
      width - typeBoxX - iconSize, typeBoxY + (typeBoxSize - iconSize) / 2,
      iconSize, iconSize);
    context.restore();
  }

  if (icons.sofa && icons.salon && Number.isFinite(Number(card.sofa)) && Number.isFinite(Number(card.salon))) {
    const scoreWidth = Math.round(width * design.ancho_puntuaciones);
    const scoreHeight = Math.round(height * design.alto_puntuaciones);
    const scoreX = Math.round(width * design.x_panel_puntuacion);
    const scoreY = Math.round(height * design.y_panel_puntuacion);
    fillCardShape(context, scoreX, scoreY, scoreWidth, scoreHeight,
      Math.round(width * design.radio_puntuaciones), palette.papel, palette.detalle,
      7 * scale, shadow);
    context.beginPath();
    context.strokeStyle = palette.detalle;
    context.lineWidth = 5 * scale;
    context.moveTo(scoreX + scoreWidth * 0.16, scoreY + scoreHeight / 2);
    context.lineTo(scoreX + scoreWidth * 0.84, scoreY + scoreHeight / 2);
    context.stroke();
    const sofaWidth = Math.round(width * design.tamano_icono_sofa_x);
    const sofaHeight = Math.round(height * design.tamano_icono_sofa_y);
    const salonWidth = Math.round(width * design.tamano_icono_salon_x);
    const salonHeight = Math.round(height * design.tamano_icono_salon_y);
    const iconX = scoreX + scoreWidth * 0.16;
    const numberX = scoreX + scoreWidth * 0.84;
    const sofaCenterY = scoreY + scoreHeight * 0.25;
    const salonCenterY = scoreY + scoreHeight * 0.75;
    drawContain(context, icons.sofa, iconX, sofaCenterY - sofaHeight / 2, sofaWidth, sofaHeight);
    drawContain(context, icons.salon, iconX, salonCenterY - salonHeight / 2, salonWidth, salonHeight);
    context.fillStyle = palette.tinta;
    context.font = `700 ${Math.round(width * design.tamano_fuente_puntuacion)}px "Lora", Georgia, serif`;
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillText(String(card.sofa), numberX, sofaCenterY);
    context.fillText(String(card.salon), numberX, salonCenterY);
  }

  const bandX = Math.round(width * design.x_banda_nombre);
  const bandY = Math.round(height * design.y_banda_nombre);
  const bandWidth = Math.round(width * design.ancho_banda_nombre);
  const bandHeight = Math.round(height * design.alto_banda_nombre);
  fillCardShape(context, bandX, bandY, bandWidth, bandHeight,
    Math.round(width * design.radio_banda_nombre), palette.detalle, darkenColor(palette.detalle, 0.68),
    8 * scale, shadow);
  const title = card.nombre.toLocaleUpperCase('es-ES');
  const titleSize = Math.round(width * design.tamano_fuente_nombre);
  const titleMinSize = Math.round(width * design.tamano_fuente_nombre_min);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if ('letterSpacing' in context) context.letterSpacing = `${width * design.espaciado_nombre}px`;
  fitText(context, title, bandWidth - width * 0.08, titleSize, titleMinSize,
    '"Lora", Georgia, "Times New Roman", serif');
  context.fillStyle = palette.papel;
  context.fillText(title, bandX + bandWidth / 2, bandY + bandHeight / 2, bandWidth - width * 0.08);
  if ('letterSpacing' in context) context.letterSpacing = '0px';

  const skillX = Math.round(width * design.x_panel_habilidad);
  const skillY = Math.round(height * design.y_panel_habilidad);
  const skillWidth = Math.round(width * design.ancho_panel_habilidad);
  const skillHeight = Math.round(height * design.alto_panel_habilidad);
  fillCardShape(context, skillX, skillY, skillWidth, skillHeight,
    Math.round(width * design.radio_panel_habilidad),
    palette.papel, palette.detalle,
    7 * scale, null);

  if (category.slug === 'ataques') {
    drawAttackContent(context, category, card, skillX, skillY, skillWidth, skillHeight);
    return;
  }

  const descriptionX = Math.round(width * design.x_texto_habilidad);
  const descriptionY = Math.round(height * design.y_texto_habilidad);
  const descriptionWidth = Math.round(width * design.ancho_texto_habilidad);
  const hasSynergy = category.slug === 'gatos' && Boolean(card.sinergia && card.sinergia.trim());
  const descriptionHeight = Math.round(height * (hasSynergy
    ? design.alto_texto_habilidad_con_sinergia
    : design.alto_texto_habilidad));
  const minFontSize = Math.round(width * design.tamano_fuente_habilidad_min);
  let fontSize = Math.round(width * design.tamano_fuente_habilidad);
  let lines = [];
  const defaultLineHeight = height * design.interlineado_habilidad;
  let lineHeight = defaultLineHeight;
  while (fontSize >= minFontSize) {
    context.font = `600 ${fontSize}px "Nunito Sans", Arial, Helvetica, sans-serif`;
    lines = wrapText(context, card.descripcion, descriptionWidth);
    lineHeight = hasSynergy ? Math.min(defaultLineHeight, fontSize * 1.22) : defaultLineHeight;
    if (lines.length * lineHeight <= descriptionHeight) break;
    fontSize -= Math.max(1, Math.round(width * 0.0011));
  }
  lineHeight = hasSynergy ? Math.min(defaultLineHeight, fontSize * 1.22) : defaultLineHeight;
  const textY = descriptionY + Math.max(0, (descriptionHeight - lines.length * lineHeight) / 2);
  context.fillStyle = palette.tinta;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  if ('letterSpacing' in context) context.letterSpacing = `${width * design.espaciado_habilidad}px`;
  lines.forEach((line, index) => context.fillText(line, descriptionX, textY + index * lineHeight, descriptionWidth));
  if ('letterSpacing' in context) context.letterSpacing = '0px';

  if (hasSynergy) {
    const dividerY = Math.round(height * design.y_divisor_sinergia);
    context.beginPath();
    context.strokeStyle = palette.detalle;
    context.lineWidth = 2 * scale;
    context.moveTo(descriptionX, dividerY);
    context.lineTo(descriptionX + descriptionWidth, dividerY);
    context.stroke();

    const synergyY = Math.round(height * design.y_texto_sinergia);
    const synergyFontSize = Math.round(width * design.tamano_fuente_sinergia);
    const synergyLabel = 'SINERGIA CON:';
    context.textBaseline = 'middle';
    context.font = `800 ${synergyFontSize}px "Nunito Sans", Arial, sans-serif`;
    const labelWidth = context.measureText(`${synergyLabel} `).width;
    context.font = `600 ${synergyFontSize}px "Nunito Sans", Arial, sans-serif`;
    const textWidth = context.measureText(card.sinergia).width;
    const synergyX = (width - labelWidth - textWidth) / 2;
    context.font = `800 ${synergyFontSize}px "Nunito Sans", Arial, sans-serif`;
    context.fillStyle = palette.detalle;
    context.fillText(synergyLabel, synergyX, synergyY);
    context.font = `600 ${synergyFontSize}px "Nunito Sans", Arial, sans-serif`;
    context.fillStyle = palette.tinta;
    context.fillText(card.sinergia, synergyX + labelWidth, synergyY,
      width - synergyX - labelWidth);
  }
}

function drawSynergyFace(canvas, category, card, side, artImage, renderDpi=category.diseno.dpi) {
  const width = Math.round(category.diseno.ancho_mm * renderDpi / 25.4);
  const height = Math.round(category.diseno.alto_mm * renderDpi / 25.4);
  const context = canvas.getContext('2d');
  const border = Math.max(2, Math.round(width * 0.035));
  const inset = Math.round(width * 0.055);
  const corner = Math.round(width * 0.055);
  const amber = category.paleta.marco;

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);

  if (side === 'front') {
    context.save();
    roundedRect(context, 0, 0, width, height, corner);
    context.clip();
    if (artImage) {
      drawCover(context, artImage, 0, 0, width, height, 0);
    } else {
      context.fillStyle = '#fffdf8';
      context.fillRect(0, 0, width, height);
      context.fillStyle = category.paleta.tinta;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `700 ${Math.round(width * 0.055)}px Arial, sans-serif`;
      context.fillText(card.imageError ? 'ILUSTRACIÓN NO DISPONIBLE' : 'ILUSTRACIÓN PENDIENTE',
        width / 2, height / 2, width - 2 * inset);
    }
    context.restore();
    roundedRect(context, border / 2, border / 2, width - border, height - border, corner);
    context.lineWidth = border;
    context.strokeStyle = amber;
    context.stroke();
    return;
  }

  fillCardShape(context, 0, 0, width, height, corner, amber, null, 0, null);
  fillCardShape(context, border, border, width - border * 2, height - border * 2,
    Math.max(0, corner - border), category.paleta.papel, null, 0, null);
  const contentX = width * 0.12;
  const contentWidth = width * 0.76;
  const titleY = height * 0.24;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = amber;
  let titleSize = Math.round(width * 0.075);
  let titleLines = [];
  while (titleSize > width * 0.05) {
    context.font = `700 ${titleSize}px Georgia, "Times New Roman", serif`;
    titleLines = wrapText(context, card.nombre, contentWidth);
    if (titleLines.length <= 2) break;
    titleSize -= 2;
  }
  const titleLineHeight = titleSize * 1.15;
  titleLines.forEach((line, index) => {
    context.fillText(line, width / 2, titleY + (index - (titleLines.length - 1) / 2) * titleLineHeight);
  });

  const dividerY = height * 0.39;
  context.beginPath();
  context.strokeStyle = amber;
  context.lineWidth = Math.max(2, width * 0.006);
  context.moveTo(contentX, dividerY);
  context.lineTo(width - contentX, dividerY);
  context.stroke();

  let bodySize = Math.round(width * 0.047);
  let bodyLines = [];
  let lineHeight = 0;
  const bodyHeight = height * 0.43;
  while (bodySize >= width * 0.031) {
    context.font = `600 ${bodySize}px Arial, Helvetica, sans-serif`;
    bodyLines = wrapText(context, card.descripcion, contentWidth);
    lineHeight = bodySize * 1.28;
    if (bodyLines.length * lineHeight <= bodyHeight) break;
    bodySize -= 2;
  }
  context.fillStyle = category.paleta.tinta;
  const firstLineY = height * 0.66 - (bodyLines.length - 1) * lineHeight / 2;
  bodyLines.forEach((line, index) => {
    context.fillText(line, width / 2, firstLineY + index * lineHeight, contentWidth);
  });
}

async function createSynergyCardTile(category, card) {
  const tile = document.createElement('article');
  tile.className = 'card-tile synergy-tile';
  const title = document.createElement('h3');
  title.textContent = card.nombre;
  const pair = document.createElement('div');
  pair.className = 'synergy-face-pair';
  const front = document.createElement('div');
  front.className = 'synergy-face synergy-face-front';
  front.setAttribute('role', 'img');
  front.setAttribute('aria-label', `Anverso de ${card.nombre}`);
  const back = document.createElement('div');
  back.className = 'synergy-face synergy-face-back';
  const backTitle = document.createElement('h4');
  backTitle.textContent = card.nombre;
  const description = document.createElement('p');
  description.textContent = card.descripcion;
  back.append(backTitle, description);
  pair.append(front, back);
  tile.append(title, pair);

  if (!card.imagen) {
    front.textContent = 'Ilustración pendiente';
    return tile;
  }

  try {
    const imageUrl = assetUrl(category, card.imagen);
    card.artImage = await loadImage(imageUrl);
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    front.append(image);
    card.imageError = false;
  } catch (error) {
    console.error(error);
    card.imageError = true;
    front.textContent = 'Ilustración no disponible';
    setStatus(error.message, true);
  }
  return tile;
}

async function createCardTile(category, card) {
  const tile = document.createElement('article');
  tile.className = 'card-tile';
  const canvas = document.createElement('canvas');
  canvas.className = 'card-art';
  const previewDpi = category.diseno.dpi_vista_previa;
  canvas.width = Math.round(category.diseno.ancho_mm * previewDpi / 25.4);
  canvas.height = Math.round(category.diseno.alto_mm * previewDpi / 25.4);
  const variantCount = card.version
    ? category.cartas.filter(item => item.nombre === card.nombre && item.tipo === card.tipo).length
    : 0;
  const variantLabel = card.version ? ` · ilustración ${card.version}/${variantCount}` : '';
  canvas.setAttribute('aria-label', `Vista previa: ${card.nombre}${variantLabel}`);
  const title = document.createElement('h3');
  title.textContent = card.nombre;
  const score = document.createElement('p');
  score.className = 'card-meta';
  if (category.slug === 'gatos') {
    score.textContent = `Sofá ${card.sofa} · Salón ${card.salon}`;
  } else if (category.slug === 'ataques') {
    const copyLabel = `${card.copias} ${card.copias === 1 ? 'copia' : 'copias'}`;
    const typeLabel = card.tipo === 'apoyo' ? 'Apoyo' : 'Ataque';
    const powerLabel = card.dano_variable ? 'daño variable'
      : card.tipo === 'apoyo' ? `+${card.bonificacion}` : `daño ${card.dano}`;
    score.textContent = `${typeLabel} · ${powerLabel} · ${copyLabel}`;
  } else {
    const copyLabel = `${card.copias} ${card.copias === 1 ? 'copia' : 'copias'}`;
    const typeLabel = card.tipo
      ? card.tipo === 'accion' ? 'Acción'
        : card.tipo === 'evento_global' ? 'Evento global'
        : `${card.tipo[0].toLocaleUpperCase('es-ES')}${card.tipo.slice(1)}`
      : category.nombre;
    score.textContent = `${typeLabel}${variantLabel} · ${copyLabel}`;
  }
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const downloadButton = document.createElement('button');
  downloadButton.className = 'button secondary';
  downloadButton.type = 'button';
  downloadButton.textContent = 'Descargar PNG';
  actions.append(downloadButton);
  tile.append(canvas, title, score, actions);
  card.canvas = canvas;

  try {
    const assets = await loadCardAssets(category, card);
    drawCard(canvas, category, card, assets.artImage, assets.icons, previewDpi);
  } catch (error) {
    console.error(error);
    card.imageError = true;
    drawCard(canvas, category, card, null, {}, previewDpi);
    setStatus(error.message, true);
  }

  downloadButton.addEventListener('click', async () => {
    if (card.imageError) {
      setStatus(`No se puede descargar ${card.nombre}: falta cargar su ilustración.`, true);
      return;
    }
    let exportCanvas = null;
    try {
      downloadButton.disabled = true;
      exportCanvas = document.createElement('canvas');
      drawCard(exportCanvas, category, card, card.artImage, card.icons, category.diseno.dpi);
      const png = await canvasPngWithDpi(exportCanvas, category);
      const filename = card.version ? `${card.nombre}-${card.version}` : card.nombre;
      downloadBlob(png, `${safeFilename(filename)}.png`);
      setStatus(`PNG descargado: ${card.nombre}${variantLabel}.`);
    } catch (error) {
      console.error(error);
      setStatus(error.message || `No se pudo generar ${card.nombre}.`, true);
    } finally {
      if (exportCanvas) {
        exportCanvas.width = 0;
        exportCanvas.height = 0;
      }
      downloadButton.disabled = Boolean(card.imageError);
    }
  });
  return tile;
}

async function loadCardAssets(category, card) {
  if (card.artImage && card.icons) return {artImage: card.artImage, icons: card.icons};
  const artImage = await loadImage(assetUrl(category, card.imagen));
  const rawIcons = {
    tipo: await loadImage(assetUrl(category, category.iconos.tipo)),
    sofa: category.iconos.sofa ? await loadImage(assetUrl(category, category.iconos.sofa)) : null,
    salon: category.iconos.salon ? await loadImage(assetUrl(category, category.iconos.salon)) : null
  };
  const palette = paletteForCard(category, card);
  const icons = Object.fromEntries(Object.entries(rawIcons)
    .map(([key, image]) => [key, image ? tintedIcon(category, key, image, palette) : null]));
  if (card.marca_flush && category.iconos.flush) {
    const flushIcon = await loadImage(assetUrl(category, category.iconos.flush));
    icons.flush = tintedIcon(category, 'flush', flushIcon, palette);
  }
  card.artImage = artImage;
  card.icons = icons;
  card.imageError = false;
  return {artImage, icons};
}

function safeFilename(name) {
  return String(name || 'carta').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'carta';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function printableCards(category) {
  return category.cartas.flatMap(card =>
    Array.from({length: card.copias || 1}, () => card));
}

function cardTypeCount(category) {
  return new Set(category.cartas.map(card => `${card.tipo || ''}:${card.nombre}`)).size;
}

async function canvasPngWithDpi(canvas, category) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar el PNG.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pixelsPerMeter = Math.round(category.diseno.dpi / 0.0254);
  return new Blob([insertPhysChunk(bytes, pixelsPerMeter, pixelsPerMeter)], {type: 'image/png'});
}

function insertPhysChunk(png, xPixelsPerMeter, yPixelsPerMeter) {
  const signature = png.slice(0, 8);
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  const type = new TextEncoder().encode('pHYs');
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, xPixelsPerMeter, false);
  view.setUint32(4, yPixelsPerMeter, false);
  data[8] = 1;
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length, false);
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type);
  crcInput.set(data, type.length);
  const crc = crc32(crcInput);
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0, crc, false);
  return concatBytes(signature, png.slice(8, ihdrEnd), length, type, data, crcBytes, png.slice(ihdrEnd));
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xFFFFFFFF;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xFF] ^ (value >>> 8);
  return (value ^ 0xFFFFFFFF) >>> 0;
}

function concatBytes(...arrays) {
  const output = new Uint8Array(arrays.reduce((total, array) => total + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    output.set(array, offset);
    offset += array.length;
  }
  return output;
}

function textBytes(text) {
  return new TextEncoder().encode(text);
}

async function canvasJpegBytes(canvas, quality) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('No se pudo codificar una imagen del PDF.');
  return new Uint8Array(await blob.arrayBuffer());
}

function cropMarks(x, y, width, height, gap, length) {
  const commands = [];
  const line = (x1, y1, x2, y2) => commands.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  line(x - gap - length, y, x - gap, y);
  line(x, y - gap - length, x, y - gap);
  line(x + width + gap, y, x + width + gap + length, y);
  line(x + width, y - gap - length, x + width, y - gap);
  line(x - gap - length, y + height, x - gap, y + height);
  line(x, y + height + gap, x, y + height + gap + length);
  line(x + width + gap, y + height, x + width + gap + length, y + height);
  line(x + width, y + height + gap, x + width, y + height + gap + length);
  return commands.join('\n');
}

function createPdfDocument(pages) {
  if (!pages.length) throw new Error('No hay páginas disponibles para el PDF.');
  const objects = [];
  const pageObjectIds = [];
  const firstImageObjectId = 3 + pages.length * 2;
  const imageObjects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';

  pages.forEach((page, pageIndex) => {
    const pageObject = 3 + pageIndex * 2;
    const contentObject = pageObject + 1;
    const imageReferences = [];
    const pageContent = [];

    page.images.forEach((image, imageIndex) => {
      const objectId = firstImageObjectId + imageObjects.length;
      const resourceName = `Im${imageIndex}`;
      imageReferences.push(`/${resourceName} ${objectId} 0 R`);
      pageContent.push(`q\n${image.width} 0 0 ${image.height} ${image.x.toFixed(2)} ${image.y.toFixed(2)} cm\n/${resourceName} Do\nQ`);
      if (image.cropMarks) {
        pageContent.push('0.5 w\n' + cropMarks(
          image.x, image.y, image.width, image.height,
          image.cropMarks.gap, image.cropMarks.length
        ));
      }
      imageObjects.push({objectId, image});
    });
    pageContent.push(...(page.commands || []));

    const resources = imageReferences.length
      ? `/Resources << /XObject << ${imageReferences.join(' ')} >> >>`
      : '/Resources << >>';
    const content = pageContent.join('\n') + '\n';
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ${resources} /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${textBytes(content).length} >>\nstream\n${content}endstream`;
    pageObjectIds.push(`${pageObject} 0 R`);
  });

  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.join(' ')}] /Count ${pages.length} >>`;
  for (const {objectId, image} of imageObjects) {
    objects[objectId] = concatBytes(
      textBytes(`<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
      image.bytes,
      textBytes('\nendstream')
    );
  }

  const chunks = [textBytes('%PDF-1.4\n')];
  const offsets = [0];
  let byteLength = chunks[0].length;
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = byteLength;
    const body = typeof objects[id] === 'string' ? textBytes(objects[id]) : objects[id];
    const objectBytes = concatBytes(textBytes(`${id} 0 obj\n`), body, textBytes('\nendobj\n'));
    chunks.push(objectBytes);
    byteLength += objectBytes.length;
  }
  const xrefOffset = byteLength;
  const xref = [`xref\n0 ${objects.length}\n`, '0000000000 65535 f \n'];
  for (let id = 1; id < objects.length; id++) xref.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  chunks.push(textBytes(xref.join('')));
  return new Blob([concatBytes(...chunks)], {type: 'application/pdf'});
}

function createCardGridPages(images, widthMm, heightMm) {
  const pageWidth = 595.276;
  const pageHeight = 841.89;
  const cardWidth = widthMm * 72 / 25.4;
  const cardHeight = heightMm * 72 / 25.4;
  const gap = 3 * 72 / 25.4;
  const gridWidth = 3 * cardWidth + 2 * gap;
  const gridHeight = 3 * cardHeight + 2 * gap;
  const marginX = (pageWidth - gridWidth) / 2;
  const marginY = (pageHeight - gridHeight) / 2;
  const cropGap = 0.3 * 72 / 25.4;
  const cropLength = 1.2 * 72 / 25.4;
  const pages = [];

  for (let firstImage = 0; firstImage < images.length; firstImage += 9) {
    const pageImages = images.slice(firstImage, firstImage + 9).map((image, slot, pageImages) => {
      const row = Math.floor(slot / 3);
      const itemsInRow = Math.min(3, pageImages.length - row * 3);
      const firstColumn = (3 - itemsInRow) / 2;
      const column = firstColumn + slot % 3;
      const x = marginX + column * (cardWidth + gap);
      const y = pageHeight - marginY - (row + 1) * cardHeight - row * gap;
      return {
        ...image,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        cropMarks: {gap: cropGap, length: cropLength}
      };
    });
    pages.push({width: pageWidth, height: pageHeight, images: pageImages});
  }
  return pages;
}

function createSynergyPages(cards, category) {
  const pageWidth = 595.276;
  const pageHeight = 841.89;
  const cardWidth = category.diseno.ancho_mm * 72 / 25.4;
  const cardHeight = category.diseno.alto_mm * 72 / 25.4;
  const pairGap = 3 * 72 / 25.4;
  const rowGap = 8 * 72 / 25.4;
  const pairWidth = 2 * cardWidth + pairGap;
  const marginX = (pageWidth - pairWidth) / 2;
  const gridHeight = 3 * cardHeight + 2 * rowGap;
  const marginY = (pageHeight - gridHeight) / 2;
  const cropGap = 0.3 * 72 / 25.4;
  const cropLength = 1.2 * 72 / 25.4;
  const pages = [];

  for (let firstCard = 0; firstCard < cards.length; firstCard += 3) {
    const images = [];
    cards.slice(firstCard, firstCard + 3).forEach((card, row) => {
      const y = pageHeight - marginY - (row + 1) * cardHeight - row * rowGap;
      [card.front, card.back].forEach((image, side) => {
        const x = marginX + side * (cardWidth + pairGap);
        images.push({
          ...image,
          x,
          y,
          width: cardWidth,
          height: cardHeight,
          cropMarks: {gap: cropGap, length: cropLength}
        });
      });
    });
    pages.push({width: pageWidth, height: pageHeight, images});
  }
  return pages;
}

async function createCardImage(category, card) {
  const {artImage, icons} = await loadCardAssets(category, card).catch(error => {
    throw new Error(`No se puede incluir «${card.nombre}»: ${error.message}`);
  });
  const canvas = document.createElement('canvas');
  try {
    drawCard(canvas, category, card, artImage, icons, category.diseno.dpi);
    return {
      bytes: await canvasJpegBytes(canvas, 0.94),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height
    };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function createSynergyImages(category, progress) {
  const cards = printableCards(category);
  const images = [];
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index];
    if (progress) progress(index, cards.length, card);
    await new Promise(resolve => setTimeout(resolve, 0));
    const artImage = card.imagen
      ? await loadImage(assetUrl(category, card.imagen)).catch(error => {
        throw new Error(`No se puede cargar la ilustración de «${card.nombre}»: ${error.message}`);
      })
      : null;
    const faces = {};
    for (const side of ['front', 'back']) {
      const canvas = document.createElement('canvas');
      try {
        drawSynergyFace(canvas, category, card, side, artImage, category.diseno.dpi);
        faces[side] = {
          bytes: await canvasJpegBytes(canvas, 0.96),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height
        };
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    images.push(faces);
  }
  return images;
}

async function createPdf(category) {
  const cards = printableCards(category);
  const images = [];
  for (let index = 0; index < cards.length; index++) {
    setStatus(`Preparando imagen ${index + 1} de ${cards.length} para el PDF…`);
    await new Promise(resolve => setTimeout(resolve, 0));
    images.push(await createCardImage(category, cards[index]));
  }
  return createPdfDocument(createCardGridPages(images, category.diseno.ancho_mm, category.diseno.alto_mm));
}

async function createSynergyPdf(category) {
  const images = await createSynergyImages(category, (index, total, card) => {
    setStatus(`Preparando sinergia ${index + 1} de ${total}: ${card.nombre}…`);
  });
  return createPdfDocument(createSynergyPages(images, category));
}

function completeDeckCardCount() {
  return state.categories.reduce((total, category) =>
    total + category.cartas.reduce((count, card) => count + (card.copias || 1), 0), 0);
}

function standardDeckCardCount() {
  return state.categories
    .filter(category => category.slug !== 'sinergias')
    .reduce((total, category) =>
      total + category.cartas.reduce((count, card) => count + (card.copias || 1), 0), 0);
}

function synergyCardCount() {
  const category = state.categories.find(item => item.slug === 'sinergias');
  return category ? printableCards(category).length : 0;
}

function setCompletePdfStatus(message) {
  $('completePdfStatus').textContent = message;
}

async function renderRulebookPdfPages() {
  if (typeof window.html2canvas !== 'function') {
    throw new Error('No se pudo cargar el componente necesario para generar el PDF del reglamento. Recarga la página e inténtalo de nuevo.');
  }
  const rulebookPages = [...$('rulebookPanel').querySelectorAll('.rulebook-page')];
  if (!rulebookPages.length) throw new Error('No se encontraron páginas del reglamento para exportar.');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const pages = [];

  for (let index = 0; index < rulebookPages.length; index++) {
    const page = rulebookPages[index];
    const isLandscape = page.classList.contains('rulebook-board-page');
    const widthMm = isLandscape ? 297 : 210;
    const heightMm = isLandscape ? 210 : 297;
    const widthPx = Math.round(widthMm * 96 / 25.4);
    const heightPx = Math.round(heightMm * 96 / 25.4);
    setCompletePdfStatus(`Preparando página ${index + 1} de ${rulebookPages.length} del reglamento…`);
    page.classList.add('pdf-export-page');
    try {
      await Promise.all([...page.querySelectorAll('img')].map(async image => {
        if (!image.complete) {
          await new Promise((resolve, reject) => {
            image.addEventListener('load', resolve, {once: true});
            image.addEventListener('error', () => reject(new Error(`No se pudo cargar una imagen del reglamento: ${image.src}`)), {once: true});
          });
        }
        if (!image.naturalWidth) throw new Error(`No se pudo cargar una imagen del reglamento: ${image.src}`);
        if (image.decode) await image.decode();
      }));
      const canvas = await window.html2canvas(page, {
        backgroundColor: '#fffdf8',
        scale: 2,
        logging: false,
        useCORS: true,
        width: widthPx,
        height: heightPx,
        windowWidth: widthPx,
        windowHeight: heightPx
      });
      if (!canvas.width || !canvas.height) throw new Error('La página se ha renderizado vacía.');
      pages.push({
        width: widthMm * 72 / 25.4,
        height: heightMm * 72 / 25.4,
        images: [{
          bytes: await canvasJpegBytes(canvas, 0.94),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          x: 0,
          y: 0,
          width: widthMm * 72 / 25.4,
          height: heightMm * 72 / 25.4
        }]
      });
      canvas.width = 0;
      canvas.height = 0;
    } catch (error) {
      throw new Error(`No se pudo generar «${page.getAttribute('aria-label') || `página ${index + 1}`}»: ${error.message}`);
    } finally {
      page.classList.remove('pdf-export-page');
    }
  }
  return pages;
}

async function createRulebookPdf() {
  return createPdfDocument(await renderRulebookPdfPages());
}

async function createCompletePdf() {
  const pages = await renderRulebookPdfPages();
  const cards = state.categories.flatMap(category =>
    category.slug === 'sinergias' ? [] : printableCards(category).map(card => ({category, card})));
  const cardImages = [];
  for (let index = 0; index < cards.length; index++) {
    const {category, card} = cards[index];
    setCompletePdfStatus(`Preparando carta ${index + 1} de ${cards.length}: ${card.nombre}…`);
    await new Promise(resolve => setTimeout(resolve, 0));
    cardImages.push(await createCardImage(category, card));
  }
  pages.push(...createCardGridPages(cardImages, 63.5, 88));

  const synergies = state.categories.find(category => category.slug === 'sinergias');
  if (synergies) {
    const synergyImages = await createSynergyImages(synergies, (index, total, card) => {
      setCompletePdfStatus(`Preparando sinergia ${index + 1} de ${total}: ${card.nombre}…`);
    });
    pages.push(...createSynergyPages(synergyImages, synergies));
  }
  return createPdfDocument(pages);
}

async function renderCategory(category) {
  const renderId = ++state.categoryRenderId;
  state.activeSlug = category.slug;
  $('categoryPanel').hidden = false;
  $('rulebookPanel').hidden = true;
  $('pdfButton').hidden = false;
  document.title = `¡Ese gato es mío! — ${category.nombre}`;
  const printableCount = printableCards(category).length;
  const hasCopyCounts = category.cartas.some(card => Number.isInteger(card.copias));
  const typeCount = cardTypeCount(category);
  $('categoryTitle').textContent = hasCopyCounts
    ? `${category.nombre} · ${typeCount} tipos · ${printableCount} copias`
    : `${category.nombre} · ${typeCount} cartas`;
  if (category.iconos && category.iconos.tipo) {
    try {
      const typeIconUrl = assetUrl(category, category.iconos.tipo);
      await loadImage(typeIconUrl);
      if (renderId !== state.categoryRenderId) return;
      $('categoryIcon').src = typeIconUrl;
    } catch (error) {
      console.error(error);
      if (renderId !== state.categoryRenderId) return;
      $('categoryIcon').removeAttribute('src');
    }
  } else {
    $('categoryIcon').removeAttribute('src');
  }
  $('emptyState').hidden = category.cartas.length > 0;
  $('emptyState').textContent = category.cartas.length
    ? ''
    : `Esta categoría aún no contiene cartas. Añade sus datos e ilustraciones a ${category.configPath}.`;
  $('cardGrid').replaceChildren();
  $('pdfButton').disabled = true;
  $('pdfButton').textContent = category.slug === 'sinergias'
    ? printableCount ? `Descargar PDF A4 · ${printableCount} sinergias` : 'Sinergias no disponibles'
    : printableCount
      ? `Descargar PDF A4 · ${printableCount} ${hasCopyCounts ? 'copias' : 'cartas'}`
      : 'PDF A4 no disponible';

  for (const button of $('categoryTabs').querySelectorAll('button')) {
    button.setAttribute('aria-selected', String(button.dataset.slug === category.slug));
  }
  if (!category.cartas.length) {
    setStatus(`${category.nombre}: todavía no hay cartas.`);
    return;
  }

  setStatus(`Cargando ${category.slug === 'sinergias' ? 'las sinergias' : 'las ilustraciones'} de ${category.cartas.length} cartas…`);
  const tiles = await Promise.all(category.cartas.map(card =>
    category.slug === 'sinergias'
      ? createSynergyCardTile(category, card)
      : createCardTile(category, card)));
  if (renderId !== state.categoryRenderId) return;
  $('cardGrid').classList.toggle('synergy-card-grid', category.slug === 'sinergias');
  $('cardGrid').replaceChildren(...tiles);
  const failed = category.cartas.filter(card => card.imageError).length;
  $('pdfButton').disabled = failed > 0;
  if (category.slug !== 'sinergias') {
    for (const card of category.cartas) {
      const button = card.canvas.closest('.card-tile').querySelector('.card-actions button');
      button.disabled = Boolean(card.imageError);
    }
  }
  const pending = category.slug === 'sinergias'
    ? category.cartas.filter(card => !card.imagen).length
    : 0;
  setStatus(failed
    ? `${failed} ilustraciones no se pudieron cargar; corrige sus rutas antes de exportar.`
    : pending
      ? `${category.cartas.length} sinergias listas; ${pending} ilustraciones pendientes se marcarán en el PDF.`
      : `${category.cartas.length} ${category.slug === 'sinergias' ? 'sinergias listas para descargar.' : 'cartas listas para descargar.'}`);
}

function showCategories() {
  const tabs = $('categoryTabs');
  tabs.replaceChildren();
  for (const category of state.categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-button';
    button.textContent = `${category.nombre} (${cardTypeCount(category)})`;
    button.dataset.slug = category.slug;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.setAttribute('aria-controls', 'categoryPanel');
    button.addEventListener('click', () => renderCategory(category));
    tabs.append(button);
  }
  const rulebookTab = document.createElement('button');
  rulebookTab.id = 'rulebookTab';
  rulebookTab.type = 'button';
  rulebookTab.className = 'tab-button';
  rulebookTab.textContent = 'Reglamento';
  rulebookTab.setAttribute('role', 'tab');
  rulebookTab.setAttribute('aria-selected', 'false');
  rulebookTab.setAttribute('aria-controls', 'rulebookPanel');
  rulebookTab.addEventListener('click', showRulebook);
  tabs.append(rulebookTab);
  const totalCards = completeDeckCardCount();
  const deckCount = standardDeckCardCount();
  const synergiesCount = synergyCardCount();
  $('completePdfButton').disabled = totalCards === 0;
  $('completePdfButton').textContent = totalCards
    ? `Descargar PDF completo · ${deckCount} cartas + ${synergiesCount} sinergias`
    : 'PDF completo no disponible';
  if (state.categories.length) renderCategory(state.categories[0]);
}

function showRulebook() {
  $('categoryPanel').hidden = true;
  $('rulebookPanel').hidden = false;
  $('pdfButton').hidden = true;
  document.title = '¡Ese gato es mío! — Reglamento';
  for (const button of $('categoryTabs').querySelectorAll('[role="tab"]')) {
    button.setAttribute('aria-selected', String(button.id === 'rulebookTab'));
  }
}

async function loadProject(files=null) {
  try {
    if (files) {
      for (const file of state.uploadedFileMap.values()) {
        if (file._cardMakerUrl) URL.revokeObjectURL(file._cardMakerUrl);
      }
      state.uploadedFiles = true;
      state.uploadedFileMap = new Map();
      for (const file of files) {
        const path = normalizeProjectPath(file.webkitRelativePath || file.name);
        state.uploadedFileMap.set(path.toLowerCase(), file);
      }
      state.imageCache.clear();
      state.tintedIconCache.clear();
    }
    setStatus('Leyendo los archivos de las categorías…');
    const categories = await Promise.all(CATEGORY_PATHS.map(async path => {
      const category = await loadCategoryFile(path);
      category.configPath = path;
      return category;
    }));
    state.categories = categories;
    showCategories();
  } catch (error) {
    console.error(error);
    if (location.protocol === 'file:' && !state.uploadedFiles) {
      $('folderButton').textContent = 'Seleccionar carpeta manualmente';
      $('folderButton').dataset.action = 'choose';
      setStatus(`${error.message || 'No se pudo cargar el catálogo.'} Puedes seleccionar la carpeta raíz manualmente.`, true);
    } else {
      setStatus(error.message || 'No se pudo cargar el catálogo.', true);
    }
    $('categoryTitle').textContent = 'No se pudo cargar el catálogo';
  }
}

$('folderButton').addEventListener('click', () => {
  if ($('folderButton').dataset.action === 'choose') {
    $('projectFolderInput').click();
    return;
  }
  loadProject();
});
$('projectFolderInput').addEventListener('change', event => {
  if (event.target.files && event.target.files.length) {
    $('folderButton').dataset.action = 'reload';
    $('folderButton').textContent = 'Recargar catálogo';
    loadProject(event.target.files);
  }
});
$('pdfButton').addEventListener('click', async () => {
  const category = state.categories.find(item => item.slug === state.activeSlug);
  if (!category || !category.cartas.length) return;
  if (category.slug === 'sinergias') {
    try {
      $('pdfButton').disabled = true;
      setStatus('Generando el PDF A4 de sinergias…');
      const pdf = await createSynergyPdf(category);
      downloadBlob(pdf, 'sinergias-cartas-a4.pdf');
      setStatus(`PDF descargado: ${printableCards(category).length} sinergias, con anverso y explicación lado a lado.`);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'No se pudo generar el PDF de sinergias.', true);
    } finally {
      $('pdfButton').disabled = category.cartas.some(card => card.imageError);
    }
    return;
  }
  const printableCount = printableCards(category).length;
  try {
    $('pdfButton').disabled = true;
    setStatus(`Preparando el PDF A4 de ${category.nombre}…`);
    const pdf = await createPdf(category);
    downloadBlob(pdf, `${safeFilename(category.slug)}-cartas-a4.pdf`);
    setStatus(`PDF A4 listo: ${printableCount} cartas en ${Math.ceil(printableCount / 9)} páginas.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'No se pudo generar el PDF.', true);
  } finally {
    $('pdfButton').disabled = !category.cartas.length || category.cartas.some(card => card.imageError);
  }
});

$('rulebookPdfButton').addEventListener('click', async () => {
  const button = $('rulebookPdfButton');
  if ($('rulebookPanel').hidden) return;
  button.disabled = true;
  try {
    setCompletePdfStatus('Generando el PDF del reglamento y sus cinco tableros…');
    const pdf = await createRulebookPdf();
    downloadBlob(pdf, 'ese-gato-es-mio-reglamento.pdf');
    setCompletePdfStatus('PDF del reglamento descargado: siete páginas de reglas y cinco tableros.');
  } catch (error) {
    console.error(error);
    setCompletePdfStatus(error.message || 'No se pudo generar el PDF del reglamento.');
  } finally {
    button.disabled = false;
  }
});

$('completePdfButton').addEventListener('click', async () => {
  const button = $('completePdfButton');
  if ($('rulebookPanel').hidden || !state.categories.length) return;
  button.disabled = true;
  try {
    const deckCount = standardDeckCardCount();
    const synergiesCount = synergyCardCount();
    setCompletePdfStatus(`Generando PDF completo: reglamento, ${deckCount} cartas y ${synergiesCount} sinergias…`);
    const pdf = await createCompletePdf();
    downloadBlob(pdf, 'ese-gato-es-mio-completo.pdf');
    setCompletePdfStatus(`PDF completo descargado: reglamento y cinco tableros; después ${deckCount} cartas y ${synergiesCount} sinergias con sus caras lado a lado.`);
  } catch (error) {
    console.error(error);
    setCompletePdfStatus(error.message || 'No se pudo preparar el PDF completo.');
  } finally {
    button.disabled = false;
  }
});

$('folderButton').dataset.action = 'reload';
$('folderButton').textContent = 'Recargar catálogo';
loadProject();
