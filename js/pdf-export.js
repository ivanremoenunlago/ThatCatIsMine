'use strict';

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

async function createSynergyImages(category, progress, cards=printableCards(category)) {
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

async function renderLandscapePdfPages(selectedPages, setProgress, pageKind) {
  if (typeof window.html2canvas !== 'function') {
    throw new Error('No se pudo cargar el componente necesario para generar el PDF del reglamento. Recarga la página e inténtalo de nuevo.');
  }
  if (!selectedPages.length) throw new Error('No se encontraron páginas para exportar.');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const pdfPages = [];
  const panel = selectedPages[0].closest('.rulebook-panel');
  if (!panel || selectedPages.some(page => page.closest('.rulebook-panel') !== panel)) {
    throw new Error('Las páginas seleccionadas deben pertenecer al mismo panel.');
  }
  const wasHidden = panel.hidden;
  const previousStyle = panel.style.cssText;
  if (wasHidden) {
    panel.hidden = false;
    panel.style.cssText = `${previousStyle};position:fixed;left:0;top:-10000px;width:297mm;max-width:none;margin:0;z-index:-1;pointer-events:none;`;
  }

  try {
    for (let index = 0; index < selectedPages.length; index++) {
      const page = selectedPages[index];
      const widthMm = 297;
      const heightMm = 210;
      const widthPx = Math.round(widthMm * 96 / 25.4);
      const heightPx = Math.round(heightMm * 96 / 25.4);
      const renderScale = page.classList.contains('rulebook-board-page') ? 300 / 96 : 2;
      setProgress(pageKind === 'tableros'
        ? `Preparando tablero ${index + 1} de ${selectedPages.length}…`
        : `Preparando página ${index + 1} de ${selectedPages.length} del reglamento…`);
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
        }));
        const canvas = await window.html2canvas(page, {
          backgroundColor: '#fffdf8',
          scale: renderScale,
          logging: false,
          useCORS: true,
          width: widthPx,
          height: heightPx,
          windowWidth: widthPx,
          windowHeight: heightPx
        });
        if (!canvas.width || !canvas.height) throw new Error('La página se ha renderizado vacía.');
        pdfPages.push({
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
  } finally {
    if (wasHidden) {
      panel.hidden = true;
      panel.style.cssText = previousStyle;
    }
  }
  return pdfPages;
}

