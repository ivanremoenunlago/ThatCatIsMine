'use strict';

const W = 1800;
const H = 2494;
const $ = (id) => document.getElementById(id);
const canvas = $('cardCanvas');
const ctx = canvas.getContext('2d');

const defaults = {
  imagen: 'gato_acaparador.png',
  tipo: 'GATO',
  nombre: 'GATO ACAPARADOR',
  descripcion: 'Aumenta tu límite de mano de 7 a 9 cartas.',
  sofa: '3',
  salon: '1',
  emoji_tipo: '🐾',
  emoji_sofa: '🛋️',
  emoji_salon: '🏠',
  color: '#D7AA4D'
};

let imageElement = null;
let imageObjectUrl = null;
let currentYmlName = 'gato_acaparador.yml';
let folderFiles = [];
let renderPending = false;

const fields = ['tipo','nombre','descripcion','sofa','salon','emoji_tipo','emoji_sofa','emoji_salon','color','imagen'];

function getData() {
  const data = {};
  for (const key of fields) data[key] = $(key).value.trim();
  data.tipo ||= 'GATO';
  data.nombre ||= 'SIN NOMBRE';
  data.descripcion ||= '';
  data.sofa = clampNumber(data.sofa, 0, 99, 0);
  data.salon = clampNumber(data.salon, 0, 99, 0);
  data.emoji_tipo ||= '🐾';
  data.emoji_sofa ||= '🛋️';
  data.emoji_salon ||= '🏠';
  data.color = validHex(data.color) ? data.color : '#D7AA4D';
  return data;
}

function clampNumber(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function validHex(value) { return /^#[0-9a-fA-F]{6}$/.test(value); }
function setStatus(message, kind='') {
  const el = $('status');
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}
function roundedRectPath(c, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w/2, h/2));
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x+w, y, x+w, y+h, radius);
  c.arcTo(x+w, y+h, x, y+h, radius);
  c.arcTo(x, y+h, x, y, radius);
  c.arcTo(x, y, x+w, y, radius);
  c.closePath();
}
function fillRounded(c, x, y, w, h, r, fill, stroke=null, lineWidth=1) {
  roundedRectPath(c,x,y,w,h,r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lineWidth; c.strokeStyle = stroke; c.stroke(); }
}
function linearGradient(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0,y0,x1,y1);
  for (const [pos,color] of stops) g.addColorStop(pos,color);
  return g;
}
function drawCover(c, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w/iw, h/ih);
  const sw = w/scale;
  const sh = h/scale;
  const sx = (iw-sw)/2;
  // Mantiene el centro del motivo en el eje vertical; recorte horizontal centrado.
  const sy = (ih-sh)/2;
  c.save();
  roundedRectPath(c,x,y,w,h,62);
  c.clip();
  c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  c.restore();
}
function drawTextFit(c, text, x, y, maxWidth, initialSize, minSize, family, weight='700', color='#493323', align='center') {
  let size = initialSize;
  c.textAlign = align;
  c.textBaseline = 'middle';
  while (size > minSize) {
    c.font = `${weight} ${size}px ${family}`;
    if (c.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  c.font = `${weight} ${size}px ${family}`;
  c.fillStyle = color;
  c.fillText(text, x, y, maxWidth);
}
function wrapParagraph(c, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (c.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function drawAbilityText(c, text) {
  const x = 180;
  const top = 1960;
  const maxWidth = 1440;
  const maxHeight = 390;
  const family = 'Arial, Helvetica, sans-serif';
  const paragraphs = String(text || '').split(/\n/);
  let chosen = null;
  for (let size = 56; size >= 44; size -= 2) {
    c.font = `600 ${size}px ${family}`;
    let lines = [];
    for (const paragraph of paragraphs) {
      const wrapped = wrapParagraph(c, paragraph, maxWidth);
      lines.push(...(wrapped.length ? wrapped : ['']));
    }
    const lineHeight = Math.round(size * 1.28);
    if (lines.length * lineHeight <= maxHeight) {
      chosen = {size, lines, lineHeight};
      break;
    }
  }
  if (!chosen) {
    const size = 44;
    c.font = `600 ${size}px ${family}`;
    const lines = [];
    for (const paragraph of paragraphs) lines.push(...wrapParagraph(c, paragraph, maxWidth));
    chosen = {size, lines, lineHeight: 56};
  }
  c.font = `600 ${chosen.size}px ${family}`;
  c.fillStyle = '#493323';
  c.textAlign = 'left';
  c.textBaseline = 'top';
  const totalHeight = chosen.lines.length * chosen.lineHeight;
  let y = top + Math.max(0, (maxHeight-totalHeight)/2);
  for (const line of chosen.lines) {
    c.fillText(line, x, y, maxWidth);
    y += chosen.lineHeight;
  }
}
function drawCard() {
  const d = getData();
  ctx.clearRect(0,0,W,H);

  // Marco exterior de color de categoría.
  const frameGrad = linearGradient(ctx,0,0,0,H,[
    [0, lighten(d.color,0.19)], [0.48,d.color], [1,darken(d.color,0.10)]
  ]);
  fillRounded(ctx,8,8,W-16,H-16,110,frameGrad);

  // Papel interior.
  const paperGrad = linearGradient(ctx,0,24,0,H-24,[
    [0,'#FFFCF3'],[0.52,'#F8F0E1'],[1,'#F0E0BF']
  ]);
  fillRounded(ctx,28,28,W-56,H-56,94,paperGrad,'#A87A33',4);

  // Ilustración principal.
  if (imageElement) {
    drawCover(ctx,imageElement,52,52,1696,1630);
  } else {
    ctx.save();
    roundedRectPath(ctx,52,52,1696,1630,62);
    ctx.clip();
    ctx.fillStyle = '#E8D9BE';
    ctx.fillRect(52,52,1696,1630);
    ctx.fillStyle = '#927B5C';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='600 42px Arial, sans-serif';
    ctx.fillText('CARGA LA ILUSTRACIÓN DEL GATO',900,850);
    ctx.restore();
  }

  // Insignia de tipo: fondo claro y emoji configurable.
  ctx.save();
  ctx.shadowColor='rgba(55,37,17,0.16)'; ctx.shadowBlur=18; ctx.shadowOffsetY=7;
  fillRounded(ctx,92,88,198,198,55,'#FFF8E9',darken(d.color,0.28),7);
  ctx.restore();
  ctx.save();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='112px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText(d.emoji_tipo,191,188,150);
  ctx.restore();

  // Recuadro de puntuaciones.
  ctx.save();
  ctx.shadowColor='rgba(55,37,17,0.16)'; ctx.shadowBlur=18; ctx.shadowOffsetY=7;
  fillRounded(ctx,1382,88,326,432,48,'#FFF8E9',darken(d.color,0.28),7);
  ctx.restore();
  ctx.strokeStyle=darken(d.color,0.15); ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(1420,304); ctx.lineTo(1670,304); ctx.stroke();

  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='91px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillStyle='#A5752B';
  ctx.fillText(d.emoji_sofa,1488,196,112);
  ctx.fillText(d.emoji_salon,1488,412,112);
  ctx.font='700 108px Georgia, "Times New Roman", serif';
  ctx.fillStyle='#493323';
  ctx.fillText(String(d.sofa),1620,196);
  ctx.fillText(String(d.salon),1620,412);

  // Banda del nombre, superpuesta a la ilustración.
  ctx.save();
  ctx.shadowColor='rgba(73,51,35,0.17)'; ctx.shadowBlur=20; ctx.shadowOffsetY=9;
  fillRounded(ctx,78,1575,1644,226,56,
    linearGradient(ctx,0,1575,0,1801,[[0,'#FFF9ED'],[1,'#F3E0B7']]),
    darken(d.color,0.12),8);
  ctx.restore();
  drawTextFit(ctx,d.nombre.toLocaleUpperCase('es-ES'),900,1688,1500,88,48,'Georgia, "Times New Roman", serif','700','#493323','center');

  // Panel de habilidad.
  fillRounded(ctx,78,1830,1644,590,56,
    linearGradient(ctx,0,1830,0,2420,[[0,'#FFF9ED'],[1,'#F4E5C9']]),
    darken(d.color,0.12),7);

  // Etiqueta centrada, solapada sobre el borde superior.
  fillRounded(ctx,640,1790,520,108,54,darken(d.color,0.18),null,0);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#FFFFFF'; ctx.font='800 44px Arial, Helvetica, sans-serif';
  ctx.fillText('HABILIDAD',900,1844);

  drawAbilityText(ctx,d.descripcion);

  // Color de categoría en el editor.
  $('colorValue').textContent = d.color.toUpperCase();
}
function lighten(hex, amount) { return mix(hex,'#FFFFFF',amount); }
function darken(hex, amount) { return mix(hex,'#000000',amount); }
function mix(a,b,t) {
  const pa = hexRgb(a), pb = hexRgb(b);
  const out = pa.map((v,i)=>Math.round(v*(1-t)+pb[i]*t));
  return '#'+out.map(v=>v.toString(16).padStart(2,'0')).join('');
}
function hexRgb(hex) {
  const v=hex.replace('#','');
  return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)];
}
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => { renderPending=false; drawCard(); });
}

function parseYml(text) {
  // Lector ligero del subconjunto YAML usado por estas cartas.
  // Admite pares clave: valor, cadenas entre comillas y bloques de texto | / >.
  const lines = String(text).replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  const values = {};
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    i++;
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = raw.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    let value = match[2].trim();

    if (value === '|' || value === '|-' || value === '|+' || value === '>' || value === '>-' || value === '>+') {
      const folded = value.startsWith('>');
      const block = [];
      while (i < lines.length) {
        const next = lines[i];
        if (next.trim() && !/^\s/.test(next)) break;
        if (!next.trim()) {
          block.push('');
          i++;
          continue;
        }
        block.push(next.replace(/^\s{1,}/, ''));
        i++;
      }
      value = folded ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').replace(/\n+$/, '');
    } else if (value.startsWith('"')) {
      try { value = JSON.parse(value); }
      catch { value = value.slice(1, value.endsWith('"') ? -1 : undefined); }
    } else if (value.startsWith("'")) {
      value = value.slice(1, value.endsWith("'") ? -1 : undefined).replace(/''/g, "'");
    } else {
      // En este esquema los valores con espacios se guardan entre comillas.
      value = value.replace(/\s+#.*$/, '').trim();
    }
    values[key] = value;
  }

  return {
    imagen: values.imagen,
    tipo: values.tipo,
    nombre: values.nombre,
    descripcion: values.descripcion,
    sofa: values.sofa,
    salon: values.salon,
    emoji_tipo: values.emoji_tipo,
    emoji_sofa: values.emoji_sofa,
    emoji_salon: values.emoji_salon,
    color: values.color
  };
}
function applyData(values) {
  for (const key of fields) {
    if (values[key] !== undefined && values[key] !== null) $(key).value = String(values[key]).replace(/\\n/g,'\n');
  }
  scheduleRender();
}
function basename(path) { return String(path).split(/[\\/]/).pop().toLowerCase(); }
function findImageFile(files, imageName) {
  const wanted = basename(imageName || '');
  if (!wanted) return null;
  const list = Array.from(files || []);
  return list.find(f => basename(f.webkitRelativePath || f.name) === wanted)
    || list.find(f => (f.webkitRelativePath || f.name).toLowerCase().endsWith('/'+wanted))
    || null;
}
async function loadImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('El archivo elegido no parece ser una imagen.','error');
    return;
  }
  if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
  imageObjectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    imageElement = img;
    setStatus(`Imagen cargada: ${file.name}`,'ok');
    scheduleRender();
  };
  img.onerror = () => setStatus('No se pudo abrir la imagen. Prueba con PNG o JPG.','error');
  img.src = imageObjectUrl;
}
function loadDefaultImage() {
  const img = new Image();
  img.onload = () => {
    imageElement = img;
    setStatus(`Imagen cargada: ${defaults.imagen}`,'ok');
    scheduleRender();
  };
  img.onerror = () => {
    imageElement = null;
    setStatus(`No se pudo cargar ${defaults.imagen}. Comprueba que esté junto a index.html.`,'error');
    scheduleRender();
  };
  img.src = new URL(defaults.imagen, document.baseURI).href;
}
async function loadYmlFile(file, availableFiles=[]) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = parseYml(text);
    currentYmlName = file.name.replace(/\.[^.]+$/,'') + '.yml';
    applyData(data);
    const matched = findImageFile(availableFiles, data.imagen);
    if (matched) {
      await loadImageFile(matched);
    } else {
      imageElement = null;
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
      imageObjectUrl = null;
      scheduleRender();
      setStatus(`YAML cargado. Selecciona la imagen: ${data.imagen || '(sin indicar)'}`,'ok');
    }
  } catch (err) {
    console.error(err);
    setStatus('No se pudo leer el archivo .yml. Comprueba que sea texto UTF-8 y YAML válido.','error');
  }
}
function yamlQuote(value) {
  return JSON.stringify(String(value ?? ''));
}
function serializeYml(d) {
  return `# Datos de una carta de ¡Ese gato es mío!\n# Guarda este archivo junto a la imagen indicada en "imagen".\n# Formato: YAML UTF-8.\n\nimagen: ${yamlQuote(d.imagen)}\ntipo: ${yamlQuote(d.tipo)}\nnombre: ${yamlQuote(d.nombre)}\ndescripcion: ${yamlQuote(d.descripcion)}\nsofa: ${Number(d.sofa)}\nsalon: ${Number(d.salon)}\nemoji_tipo: ${yamlQuote(d.emoji_tipo)}\nemoji_sofa: ${yamlQuote(d.emoji_sofa)}\nemoji_salon: ${yamlQuote(d.emoji_salon)}\ncolor: ${yamlQuote(d.color)}\n`;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function safeFilename(name) {
  return (name || 'carta').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').toLowerCase() || 'carta';
}
async function canvasToPngWithDpi() {
  const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
  if (!blob) throw new Error('No se pudo generar el PNG.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([insertPhysChunk(bytes,28346,28346)],{type:'image/png'});
}
function insertPhysChunk(png, xppm, yppm) {
  // Inserta pHYs (píxeles por metro) tras IHDR para indicar 720 DPI.
  const signature = png.slice(0,8);
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  const type = new TextEncoder().encode('pHYs');
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0,xppm,false);
  view.setUint32(4,yppm,false);
  data[8] = 1;
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0,9,false);
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type,0); crcInput.set(data,type.length);
  const crc = crc32(crcInput);
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0,crc,false);
  const chunk = concatBytes(length,type,data,crcBytes);
  return concatBytes(signature,png.slice(8,ihdrEnd),chunk,png.slice(ihdrEnd));
}
function concatBytes(...arrays) {
  const total=arrays.reduce((s,a)=>s+a.length,0);
  const out=new Uint8Array(total); let offset=0;
  for(const a of arrays){out.set(a,offset);offset+=a.length;}
  return out;
}
const crcTable = (() => {
  const table = new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
    table[n]=c>>>0;
  }
  return table;
})();
function crc32(bytes) {
  let crc=0xFFFFFFFF;
  for(const b of bytes) crc=crcTable[(crc^b)&0xFF]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}

// Event listeners.
for (const key of fields) {
  $(key).addEventListener('input', scheduleRender);
}
$('color').addEventListener('input', () => { $('colorValue').textContent=$('color').value.toUpperCase(); });
$('folderButton').addEventListener('click', () => $('folderInput').click());
$('ymlButton').addEventListener('click', () => $('ymlInput').click());
$('imageButton').addEventListener('click', () => $('imageInput').click());
$('folderInput').addEventListener('change', async (event) => {
  folderFiles = Array.from(event.target.files || []);
  const yml = folderFiles.find(f => /\.ya?ml$/i.test(f.name));
  if (!yml) { setStatus('La carpeta no contiene ningún archivo .yml o .yaml.','error'); return; }
  await loadYmlFile(yml,folderFiles);
  if (!imageElement) setStatus(`Datos cargados. No encontré ${$('imagen').value}; pulsa Cargar imagen.`,'error');
});
$('ymlInput').addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  await loadYmlFile(file,folderFiles);
});
$('imageInput').addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  await loadImageFile(file);
});
$('downloadButton').addEventListener('click', async () => {
  try {
    drawCard();
    const blob = await canvasToPngWithDpi();
    downloadBlob(blob,`${safeFilename(getData().nombre)}.png`);
    setStatus('PNG generado correctamente.','ok');
  } catch (err) {
    console.error(err); setStatus(err.message || 'Error al generar el PNG.','error');
  }
});
$('saveYmlButton').addEventListener('click', () => {
  const blob = new Blob([serializeYml(getData())],{type:'text/yaml;charset=utf-8'});
  downloadBlob(blob,currentYmlName || `${safeFilename(getData().nombre)}.yml`);
});
$('resetButton').addEventListener('click', () => {
  applyData(defaults);
  imageElement = null;
  if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
  imageObjectUrl = null;
  setStatus('Cargando la ilustración del ejemplo...');
  loadDefaultImage();
});

// Primera vista, con los datos de ejemplo.
applyData(defaults);
drawCard();
setStatus('Cargando la ilustración del ejemplo...');
loadDefaultImage();
