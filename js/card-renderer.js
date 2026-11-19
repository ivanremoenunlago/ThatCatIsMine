'use strict';

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

