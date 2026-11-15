'use strict';

const CATEGORY_PATHS = ['cartas/gatos/categoria.yml', 'cartas/ataques/categoria.yml'];
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
  if (!category.nombre || !category.slug || !category.iconos || !category.diseno || !Array.isArray(category.cartas)) {
    throw new Error('Faltan datos obligatorios en el archivo de categoría.');
  }
  const {ancho_mm, alto_mm, dpi} = category.diseno;
  if (![ancho_mm, alto_mm, dpi].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error(`La categoría "${category.nombre}" debe definir ancho_mm, alto_mm y dpi válidos.`);
  }
  if (Object.values(category.diseno).some(value => !Number.isFinite(value))) {
    throw new Error(`La categoría "${category.nombre}" tiene proporciones de diseño no válidas.`);
  }
  if (!category.paleta || Object.values(category.paleta).some(color => !/^#[0-9a-fA-F]{6}$/.test(color))) {
    throw new Error(`La categoría "${category.nombre}" tiene colores no válidos.`);
  }
  if (!category.iconos.tipo) throw new Error(`La categoría "${category.nombre}" no define un icono de tipo.`);
  for (const card of category.cartas) {
    if (!card.nombre || !card.imagen) {
      throw new Error(`La carta "${card.nombre || 'sin nombre'}" necesita nombre e imagen.`);
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
  }
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

function tintedIcon(category, iconKey, image) {
  const color = category.paleta.detalle || '#B98232';
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
  const palette = category.paleta;
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
    context.fillStyle = palette.tinta;
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
    context.fillStyle = palette.tinta;
    const detailY = centerY + height * 0.3;
    const firstLineY = detailY - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => context.fillText(line, centerX, firstLineY + index * lineHeight, textWidth));
  }
}

function drawCard(canvas, category, card, artImage, icons, renderDpi=category.diseno.dpi) {
  const context = canvas.getContext('2d');
  const palette = category.paleta;
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
    Math.round(width * design.radio_banda_nombre), palette.papel, palette.detalle,
    8 * scale, shadow);
  const title = card.nombre.toLocaleUpperCase('es-ES');
  const titleSize = Math.round(width * design.tamano_fuente_nombre);
  const titleMinSize = Math.round(width * design.tamano_fuente_nombre_min);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if ('letterSpacing' in context) context.letterSpacing = `${width * design.espaciado_nombre}px`;
  fitText(context, title, bandWidth - width * 0.08, titleSize, titleMinSize,
    '"Lora", Georgia, "Times New Roman", serif');
  context.fillStyle = category.slug === 'ataques' ? palette.marco : palette.tinta;
  context.fillText(title, bandX + bandWidth / 2, bandY + bandHeight / 2, bandWidth - width * 0.08);
  if ('letterSpacing' in context) context.letterSpacing = '0px';

  const skillX = Math.round(width * design.x_panel_habilidad);
  const skillY = Math.round(height * design.y_panel_habilidad);
  const skillWidth = Math.round(width * design.ancho_panel_habilidad);
  const skillHeight = Math.round(height * design.alto_panel_habilidad);
  fillCardShape(context, skillX, skillY, skillWidth, skillHeight,
    Math.round(width * design.radio_panel_habilidad),
    palette.papel, category.slug === 'ataques' ? palette.marco : palette.detalle,
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

async function createCardTile(category, card) {
  const tile = document.createElement('article');
  tile.className = 'card-tile';
  const canvas = document.createElement('canvas');
  canvas.className = 'card-art';
  const previewDpi = category.diseno.dpi_vista_previa;
  canvas.width = Math.round(category.diseno.ancho_mm * previewDpi / 25.4);
  canvas.height = Math.round(category.diseno.alto_mm * previewDpi / 25.4);
  canvas.setAttribute('aria-label', `Vista previa: ${card.nombre}`);
  const title = document.createElement('h3');
  title.textContent = card.nombre;
  const score = document.createElement('p');
  score.className = 'card-meta';
  if (category.slug === 'gatos') {
    score.textContent = `Sofá ${card.sofa} · Salón ${card.salon}`;
  } else {
    const copyLabel = `${card.copias} ${card.copias === 1 ? 'copia' : 'copias'}`;
    const typeLabel = card.tipo === 'apoyo' ? 'Apoyo' : 'Ataque';
    const powerLabel = card.dano_variable ? 'daño variable'
      : card.tipo === 'apoyo' ? `+${card.bonificacion}` : `daño ${card.dano}`;
    score.textContent = `${typeLabel} · ${powerLabel} · ${copyLabel}`;
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
    const art = await loadImage(assetUrl(category, card.imagen));
    const rawIcons = {
      tipo: await loadImage(assetUrl(category, category.iconos.tipo)),
      sofa: category.iconos.sofa ? await loadImage(assetUrl(category, category.iconos.sofa)) : null,
      salon: category.iconos.salon ? await loadImage(assetUrl(category, category.iconos.salon)) : null
    };
    const icons = Object.fromEntries(Object.entries(rawIcons)
      .map(([key, image]) => [key, image ? tintedIcon(category, key, image) : null]));
    card.artImage = art;
    card.icons = icons;
    drawCard(canvas, category, card, art, icons, previewDpi);
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
      downloadBlob(png, `${safeFilename(card.nombre)}.png`);
      setStatus(`PNG descargado: ${card.nombre}.`);
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

function dataUrlBytes(dataUrl) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
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

async function createPdf(category) {
  const cards = printableCards(category);
  const pageCount = Math.ceil(cards.length / 9);
  const pageWidth = 595.276;
  const pageHeight = 841.89;
  const imageWidth = Math.round(category.diseno.ancho_mm * category.diseno.dpi / 25.4);
  const imageHeight = Math.round(category.diseno.alto_mm * category.diseno.dpi / 25.4);
  const cardWidth = category.diseno.ancho_mm * 72 / 25.4;
  const cardHeight = category.diseno.alto_mm * 72 / 25.4;
  const gap = 3 * 72 / 25.4;
  const gridWidth = 3 * cardWidth + 2 * gap;
  const gridHeight = 3 * cardHeight + 2 * gap;
  const marginX = (pageWidth - gridWidth) / 2;
  const marginY = (pageHeight - gridHeight) / 2;
  const markGap = 0.3 * 72 / 25.4;
  const markLength = 1.2 * 72 / 25.4;
  const images = [];
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index];
    setStatus(`Preparando imagen ${index + 1} de ${cards.length} para el PDF…`);
    await new Promise(resolve => requestAnimationFrame(resolve));
    const canvas = document.createElement('canvas');
    drawCard(canvas, category, card, card.artImage, card.icons, category.diseno.dpi);
    images.push(dataUrlBytes(canvas.toDataURL('image/jpeg', 0.94)));
    canvas.width = 0;
    canvas.height = 0;
  }
  const objects = [];
  const pageInfo = [];

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageObject = 3 + pageIndex * 2;
    const contentObject = pageObject + 1;
    const firstCard = pageIndex * 9;
    const pageCards = cards.slice(firstCard, firstCard + 9);
    const imageReferences = pageCards.map((_, slot) => {
      const imageObject = 3 + pageCount * 2 + firstCard + slot;
      return `/Im${slot} ${imageObject} 0 R`;
    });
    const pageContent = [];

    pageCards.forEach((card, slot) => {
      const localIndex = slot;
      const row = Math.floor(localIndex / 3);
      const itemsInRow = Math.min(3, pageCards.length - row * 3);
      const firstColumn = (3 - itemsInRow) / 2;
      const column = firstColumn + localIndex % 3;
      const x = marginX + column * (cardWidth + gap);
      const y = pageHeight - marginY - (row + 1) * cardHeight - row * gap;
      pageContent.push(`q\n${cardWidth} 0 0 ${cardHeight} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im${slot} Do\nQ`);
      pageContent.push('0.5 w\n' + cropMarks(x, y, cardWidth, cardHeight, markGap, markLength));
    });

    const content = pageContent.join('\n') + '\n';
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << ${imageReferences.join(' ')} >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${textBytes(content).length} >>\nstream\n${content}endstream`;
    pageInfo.push({pageObject});
  }

  const pageIds = pageInfo.map(page => `${page.pageObject} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${pageIds}] /Count ${pageCount} >>`;
  for (let index = 0; index < cards.length; index++) {
    const objectId = 3 + pageCount * 2 + index;
    const jpeg = images[index];
    objects[objectId] = concatBytes(
      textBytes(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
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

async function renderCategory(category) {
  const renderId = ++state.categoryRenderId;
  state.activeSlug = category.slug;
  const printableCount = printableCards(category).length;
  $('categoryTitle').textContent = category.slug === 'ataques'
    ? `${category.nombre} · ${category.cartas.length} tipos · ${printableCount} copias`
    : `${category.nombre} · ${category.cartas.length} cartas`;
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
  $('emptyState').hidden = category.cartas.length > 0;
  $('emptyState').textContent = category.cartas.length
    ? ''
    : `Esta categoría aún no contiene cartas. Añade sus datos e ilustraciones a ${category.configPath}.`;
  $('cardGrid').replaceChildren();
  $('pdfButton').disabled = true;
  $('pdfButton').textContent = printableCount
    ? `Descargar PDF A4 · ${printableCount} ${category.slug === 'ataques' ? 'copias' : 'cartas'}`
    : 'PDF A4 no disponible';

  for (const button of $('categoryTabs').querySelectorAll('button')) {
    button.setAttribute('aria-selected', String(button.dataset.slug === category.slug));
  }
  if (!category.cartas.length) {
    setStatus(`${category.nombre}: todavía no hay cartas.`);
    return;
  }

  setStatus(`Cargando las ilustraciones de ${category.cartas.length} cartas…`);
  const tiles = await Promise.all(category.cartas.map(card => createCardTile(category, card)));
  if (renderId !== state.categoryRenderId) return;
  $('cardGrid').replaceChildren(...tiles);
  const failed = category.cartas.filter(card => card.imageError).length;
  $('pdfButton').disabled = failed > 0;
  for (const card of category.cartas) {
    const button = card.canvas.closest('.card-tile').querySelector('.card-actions button');
    button.disabled = Boolean(card.imageError);
  }
  setStatus(failed ? `${failed} ilustraciones no se pudieron cargar; corrige sus rutas antes de exportar.` : `${category.cartas.length} cartas listas para descargar.`);
}

function showCategories() {
  const tabs = $('categoryTabs');
  tabs.replaceChildren();
  for (const category of state.categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-button';
    button.textContent = `${category.nombre} (${category.cartas.length})`;
    button.dataset.slug = category.slug;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.addEventListener('click', () => renderCategory(category));
    tabs.append(button);
  }
  if (state.categories.length) renderCategory(state.categories[0]);
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

$('folderButton').dataset.action = 'reload';
$('folderButton').textContent = 'Recargar catálogo';
loadProject();
