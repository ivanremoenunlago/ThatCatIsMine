'use strict';

const RULEBOOK_PAGE_WIDTH = 297 * 96 / 25.4;
const RULEBOOK_PAGE_HEIGHT = 210 * 96 / 25.4;
const rulebookIconUrls = [];

function fitRulebookPages() {
  const panel = $('rulebookPanel');
  if (panel.hidden || !panel.clientWidth) return;
  const scale = Math.min(1, panel.clientWidth / RULEBOOK_PAGE_WIDTH);
  for (const page of panel.querySelectorAll('.rulebook-text-page')) {
    page.style.transform = `scale(${scale})`;
    page.style.transformOrigin = 'top left';
    page.style.marginBottom = `${22 - (1 - scale) * RULEBOOK_PAGE_HEIGHT}px`;
  }
}

window.addEventListener('resize', fitRulebookPages);

function printCardLabel(category, card) {
  const sameName = category.cartas.filter(item => item.nombre === card.nombre);
  const variant = Number.isInteger(card.version)
    ? ` · ilustración ${card.version}`
    : sameName.length > 1
      ? ` · ilustración ${sameName.indexOf(card) + 1}/${sameName.length}`
      : '';
  const copies = card.copias || 1;
  return `${card.nombre}${variant}${copies > 1 ? ` · ${copies} copias` : ''}`;
}

function appendRulebookText(container, text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      container.append(strong);
    } else {
      container.append(document.createTextNode(part));
    }
  }
}

function createTurnStepCard(step) {
  const stepCard = document.createElement('article');
  stepCard.className = `turn-step turn-phase-${step.fase} turn-marker-${step.marca}`;
  const number = document.createElement('span');
  number.className = 'turn-step-number';
  number.textContent = step.numero;
  const content = document.createElement('div');
  const stepTitle = document.createElement('h4');
  stepTitle.textContent = step.titulo;
  const paragraph = document.createElement('p');
  appendRulebookText(paragraph, step.texto);
  content.append(stepTitle, paragraph);
  stepCard.append(number, content);
  return stepCard;
}

function releaseRulebookIconUrls() {
  for (const url of rulebookIconUrls.splice(0)) URL.revokeObjectURL(url);
}

async function colorizeRulebookIcons(container) {
  releaseRulebookIconUrls();
  try {
    for (const image of container.querySelectorAll('.rulebook-icon')) {
      await waitForImageLoad(image, `No se pudo cargar un icono del reglamento: ${image.src}`);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo preparar el icono del reglamento.');
        context.drawImage(image, 0, 0);
        context.globalCompositeOperation = 'source-in';
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('No se pudo convertir a negro un icono del reglamento.');
        const url = URL.createObjectURL(blob);
        rulebookIconUrls.push(url);
        image.src = url;
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } catch (error) {
    releaseRulebookIconUrls();
    throw error;
  }
}

async function renderRulebookContent(rulebook) {
  const container = $('rulebookPages');
  container.replaceChildren();
  const pages = new Map();
  for (const block of rulebook.cartas) {
    if (!pages.has(block.pagina)) pages.set(block.pagina, []);
    pages.get(block.pagina).push(block);
  }

  for (const [pageNumber, blocks] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {
    const heading = blocks.find(block => block.tipo === 'encabezado');
    if (!heading) throw new Error(`La página ${pageNumber} del reglamento necesita un encabezado.`);

    const page = document.createElement('article');
    page.className = 'rulebook-page rulebook-text-page';
    page.setAttribute('aria-label', `Página ${pageNumber}: ${heading.titulo}`);

    const header = document.createElement('header');
    header.className = 'rulebook-page-header';
    const title = document.createElement('h2');
    title.textContent = heading.titulo;
    header.append(title);
    for (const paragraphText of String(heading.texto).split(/\n\s*\n/)) {
      const intro = document.createElement('p');
      intro.className = 'rulebook-lead';
      appendRulebookText(intro, paragraphText.trim());
      header.append(intro);
    }

    const sections = document.createElement('div');
    const columns = heading.columnas || 2;
    sections.className = `rulebook-sections rulebook-sections-${columns}`;

    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      if (block === heading) continue;

      if (block.tipo === 'paso_turno') {
        const turnSteps = [block];
        while (blocks[index + 1]?.tipo === 'paso_turno') {
          turnSteps.push(blocks[++index]);
        }
        const diagrams = document.createElement('div');
        diagrams.className = 'turn-diagrams';

        for (const group of [...new Set(turnSteps.map(step => step.grupo))]) {
          const groupSteps = turnSteps.filter(step => step.grupo === group);
          const diagram = document.createElement('section');
          diagram.className = `turn-diagram turn-diagram-${group}`;
          diagram.setAttribute('aria-label', groupSteps[0].titulo_grupo);
          const diagramTitle = document.createElement('h3');
          diagramTitle.className = 'turn-diagram-title';
          diagramTitle.textContent = groupSteps[0].titulo_grupo;
          diagram.append(diagramTitle);

          for (let stepIndex = 0; stepIndex < groupSteps.length; stepIndex++) {
            const step = groupSteps[stepIndex];
            if (!step.alternativa) {
              diagram.append(createTurnStepCard(step));
              continue;
            }

            const alternatives = [step];
            while (groupSteps[stepIndex + 1]?.alternativa === step.alternativa) {
              alternatives.push(groupSteps[++stepIndex]);
            }
            const choice = document.createElement('div');
            choice.className = 'turn-choice';
            choice.setAttribute('role', 'group');
            choice.setAttribute('aria-label', 'Elige una de estas opciones');
            alternatives.forEach((alternative, optionIndex) => {
              if (optionIndex > 0) {
                const separator = document.createElement('span');
                separator.className = 'turn-choice-separator';
                separator.setAttribute('aria-hidden', 'true');
                separator.textContent = 'O';
                choice.append(separator);
              }
              choice.append(createTurnStepCard(alternative));
            });
            diagram.append(choice);
          }
          diagrams.append(diagram);
        }
        sections.append(diagrams);
        continue;
      }

      if (block.tipo === 'lista') {
        const items = [block];
        while (blocks[index + 1]
          && blocks[index + 1].tipo === 'lista'
          && blocks[index + 1].grupo === block.grupo) {
          items.push(blocks[++index]);
        }
        const section = document.createElement('section');
        section.className = `rulebook-block${block.ancho === 'completo' ? ' rulebook-block-full' : ''}`;
        if (block.titulo) {
          const sectionTitle = document.createElement('h3');
          sectionTitle.textContent = block.titulo;
          section.append(sectionTitle);
        }
        const list = document.createElement(block.ordenada ? 'ol' : 'ul');
        if (items.some(item => item.icono)) list.classList.add('rulebook-icon-list');
        for (const item of items) {
          const listItem = document.createElement('li');
          if (item.icono) {
            const icon = document.createElement('img');
            icon.className = 'rulebook-icon';
            icon.src = state.uploadedFiles
              ? uploadedAssetUrl(item.icono)
              : new URL(item.icono, location.href).href;
            icon.alt = '';
            icon.setAttribute('aria-hidden', 'true');
            listItem.append(icon, document.createTextNode(' '));
          }
          appendRulebookText(listItem, item.texto);
          list.append(listItem);
        }
        section.append(list);
        sections.append(section);
        continue;
      }

      const section = document.createElement(block.tipo === 'nota' ? 'aside' : 'section');
      section.className = `rulebook-block${block.ancho === 'completo' ? ' rulebook-block-full' : ''}${block.tipo === 'nota' ? ' rulebook-note-block' : ''}${block.tipo === 'sinergia' ? ' rulebook-synergy' : ''}`;
      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = block.titulo;
      const paragraph = document.createElement('p');
      appendRulebookText(paragraph, block.texto);
      section.append(sectionTitle, paragraph);
      sections.append(section);
    }

    page.append(header, sections);
    container.append(page);
  }
  await colorizeRulebookIcons(container);
}

function renderFinalPrintOptions() {
  const boardContainer = $('finalPrintBoards');
  const categoryContainer = $('finalPrintCategories');
  boardContainer.replaceChildren();
  categoryContainer.replaceChildren();
  $('finalReverseQuantity').value = '0';
  $('finalReverseQuantity').dataset.manual = 'false';

  const rulebookPages = [...$('rulebookPages').querySelectorAll('.rulebook-page')];
  $('includeRulebookLabel').textContent = `Reglamento completo · ${rulebookPages.length} páginas`;
  const boardPages = [...$('boardsPanel').querySelectorAll('.rulebook-board-page')];
  boardPages.forEach((page, index) => {
    const label = document.createElement('label');
    label.className = 'final-print-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'final-board-toggle';
    input.dataset.boardIndex = String(index);
    input.id = `final-board-${index}`;
    const title = page.querySelector('.board-screen-title')?.textContent.trim()
      || page.getAttribute('aria-label')
      || `Tablero ${index + 1}`;
    const text = document.createElement('span');
    text.textContent = title;
    label.append(input, text);
    boardContainer.append(label);
  });

  state.categories.forEach((category, categoryIndex) => {
    if (category.slug === 'reversos') return;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'final-print-category';
    const legend = document.createElement('legend');
    legend.textContent = `${category.nombre} · ${cardTypeCount(category)} tipos`;

    const masterLabel = document.createElement('label');
    masterLabel.className = 'final-print-option final-print-master';
    const master = document.createElement('input');
    master.type = 'checkbox';
    master.className = 'final-category-toggle';
    master.dataset.categorySlug = category.slug;
    master.id = `final-category-${safeFilename(category.slug)}`;
    const masterText = document.createElement('span');
    masterText.textContent = 'Seleccionar toda la categoría';
    masterLabel.append(master, masterText);

    const itemContainer = document.createElement('div');
    itemContainer.className = 'final-print-items';
    category.cartas.forEach((card, cardIndex) => {
      const row = document.createElement('div');
      row.className = 'final-print-item';
      const label = document.createElement('label');
      label.className = 'final-print-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'final-card-toggle';
      input.dataset.categoryIndex = String(categoryIndex);
      input.dataset.cardIndex = String(cardIndex);
      input.id = `final-card-${safeFilename(category.slug)}-${cardIndex}`;
      const text = document.createElement('span');
      text.textContent = printCardLabel(category, card);
      label.append(input, text);
      row.append(label);

      const copies = card.copias || 1;
      if (copies > 1) {
        const quantity = document.createElement('input');
        quantity.type = 'number';
        quantity.className = 'final-print-quantity';
        quantity.min = '1';
        quantity.max = String(copies);
        quantity.step = '1';
        quantity.value = String(copies);
        quantity.disabled = true;
        quantity.setAttribute('aria-label', `Copias de ${card.nombre}`);
        row.append(quantity);
      }
      itemContainer.append(row);
    });

    fieldset.append(legend, masterLabel, itemContainer);
    categoryContainer.append(fieldset);
  });
  updateFinalPrintStatus();
}

function collectFinalPrintSelection() {
  const includeRulebook = $('includeRulebook').checked;
  const selectedBoardIndexes = new Set(
    [...$('finalPrintBoards').querySelectorAll('.final-board-toggle:checked')]
      .map(input => Number(input.dataset.boardIndex))
  );
  const rulebookPages = includeRulebook
    ? [...$('rulebookPages').querySelectorAll('.rulebook-text-page')]
    : [];
  const boardPages = [...$('boardsPanel').querySelectorAll('.rulebook-board-page')]
    .filter((page, index) => selectedBoardIndexes.has(index));
  const cards = [];
  const synergies = [];

  for (const input of $('finalPrintCategories').querySelectorAll('.final-card-toggle:checked')) {
    const category = state.categories[Number(input.dataset.categoryIndex)];
    const card = category && category.cartas[Number(input.dataset.cardIndex)];
    if (!category || !card) throw new Error('No se pudo identificar una de las cartas seleccionadas.');
    if (category.slug === 'reversos') continue;
    const quantityInput = input.closest('.final-print-item').querySelector('.final-print-quantity');
    const quantity = quantityInput ? quantityInput.valueAsNumber : 1;
    const maxCopies = card.copias || 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxCopies) {
      throw new Error(`El número de copias de «${card.nombre}» debe estar entre 1 y ${maxCopies}.`);
    }
    const selected = {category, card};
    if (category.slug === 'sinergias') {
      synergies.push(selected);
    } else {
      for (let copy = 0; copy < quantity; copy++) cards.push(selected);
    }
  }

  const reverseQuantityInput = $('finalReverseQuantity');
  if (reverseQuantityInput.dataset.manual !== 'true') {
    reverseQuantityInput.value = String(cards.length);
  }
  const reverseCount = reverseQuantityInput.valueAsNumber;
  if (!Number.isInteger(reverseCount) || reverseCount < 0) {
    throw new Error('El número de reversos debe ser un entero igual o mayor que cero.');
  }
  const reverseCategory = state.categories.find(category => category.slug === 'reversos');
  if (reverseCount && (!reverseCategory || !reverseCategory.cartas[0])) {
    throw new Error('No se encontró el reverso necesario para las cartas seleccionadas.');
  }
  const boardCount = selectedBoardIndexes.size;
  const hasSelection = rulebookPages.length > 0 || boardPages.length > 0
    || cards.length > 0 || reverseCount > 0 || synergies.length > 0;
  return {
    rulebookPages,
    boardPages,
    includeRulebook,
    boardCount,
    cards,
    synergies,
    reverseCount,
    reverseCategory,
    reverseCard: reverseCategory && reverseCategory.cartas[0],
    hasSelection
  };
}

function formatPageRange(start, count) {
  if (!count) return '';
  const end = start + count - 1;
  return count === 1 ? String(start) : `${start}–${end}`;
}

function formatPageNumbers(numbers) {
  if (numbers.length < 2) return numbers.join('');
  const first = numbers[0];
  const step = numbers[1] - first;
  const isRegular = (step === 1 || step === 2)
    && numbers.every((page, index) => page === first + index * step);
  if (!isRegular) return numbers.join(', ');
  const parity = step === 2 ? ` (${first % 2 ? 'impares' : 'pares'})` : '';
  return `${first}–${numbers[numbers.length - 1]}${parity}`;
}

function finalPrintPagePlan(selection) {
  const ranges = [];
  let nextPage = 1;
  const addRange = (label, count) => {
    if (!count) return;
    ranges.push(`${label} ${formatPageRange(nextPage, count)}`);
    nextPage += count;
  };

  addRange('Reglamento', selection.rulebookPages.length);
  addRange('Tableros', selection.boardPages.length);
  const frontSheets = Math.ceil(selection.cards.length / 9);
  const reverseSheets = Math.ceil(selection.reverseCount / 9);
  const duplexSheets = Math.max(frontSheets, reverseSheets);
  if (duplexSheets) {
    const frontPageNumbers = [];
    const reversePageNumbers = [];
    for (let index = 0; index < duplexSheets; index++) {
      if (index < frontSheets) frontPageNumbers.push(nextPage++);
      if (index < reverseSheets) reversePageNumbers.push(nextPage++);
    }
    if (frontPageNumbers.length) ranges.push(`Anversos ${formatPageNumbers(frontPageNumbers)}`);
    if (reversePageNumbers.length) ranges.push(`Reversos ${formatPageNumbers(reversePageNumbers)}`);
  }

  const synergyPages = Math.ceil(selection.synergies.length * 2 / 9);
  addRange('Sinergias', synergyPages);
  return {ranges, totalPages: nextPage - 1};
}

function finalPrintPageCount(selection) {
  return finalPrintPagePlan(selection).totalPages;
}

function finalPrintDescription(selection) {
  const parts = [];
  if (selection.includeRulebook) parts.push('el reglamento');
  if (selection.boardCount) parts.push(`${selection.boardCount} ${selection.boardCount === 1 ? 'tablero' : 'tableros'}`);
  if (selection.cards.length || selection.reverseCount) {
    const frontCount = selection.cards.length;
    const reverseCount = selection.reverseCount;
    parts.push(`${frontCount} ${frontCount === 1 ? 'carta' : 'cartas'} + ${reverseCount} ${reverseCount === 1 ? 'reverso' : 'reversos'}`);
  }
  if (selection.synergies.length) parts.push(`${selection.synergies.length} ${selection.synergies.length === 1 ? 'sinergia' : 'sinergias'}`);
  return parts.join(', ');
}

function setFinalPrintStatus(message, isError=false) {
  const status = $('finalPrintStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function updateFinalPrintStatus() {
  const button = $('downloadFinalPdfButton');
  try {
    const selection = collectFinalPrintSelection();
    button.disabled = !selection.hasSelection || state.finalPdfGenerating;
    if (!selection.hasSelection) {
      setFinalPrintStatus('Marca al menos un elemento para preparar el PDF.');
      return;
    }
    const pagePlan = finalPrintPagePlan(selection);
    setFinalPrintStatus(`Selección: ${finalPrintDescription(selection)} · ${pagePlan.ranges.join(' · ')} · ${pagePlan.totalPages} páginas.`);
  } catch (error) {
    button.disabled = true;
    setFinalPrintStatus(error.message, true);
  }
}

async function createFinalPrintPdf(selection) {
  const pages = [];
  if (selection.rulebookPages.length) {
    pages.push(...await renderLandscapePdfPages(selection.rulebookPages, setFinalPrintStatus, 'reglamento'));
  }
  if (selection.boardPages.length) {
    pages.push(...await renderLandscapePdfPages(selection.boardPages, setFinalPrintStatus, 'tableros'));
  }

  const cardImages = [];
  for (let index = 0; index < selection.cards.length; index++) {
    const {category, card} = selection.cards[index];
    setFinalPrintStatus(`Preparando carta ${index + 1} de ${selection.cards.length}: ${card.nombre}…`);
    await new Promise(resolve => setTimeout(resolve, 0));
    cardImages.push(await createCardImage(category, card));
  }
  const frontPages = createCardGridPages(cardImages, 63.5, 88);
  let reversePages = [];
  if (selection.reverseCount) {
    setFinalPrintStatus(`Preparando ${selection.reverseCount} reversos…`);
    const reverseImage = await createCardImage(selection.reverseCategory, selection.reverseCard);
    reversePages = createCardGridPages(Array(selection.reverseCount).fill(reverseImage), 63.5, 88);
  }
  const duplexSheets = Math.max(frontPages.length, reversePages.length);
  for (let index = 0; index < duplexSheets; index++) {
    if (frontPages[index]) pages.push(frontPages[index]);
    if (reversePages[index]) pages.push(reversePages[index]);
  }

  if (selection.synergies.length) {
    const category = selection.synergies[0].category;
    const cards = selection.synergies.map(item => item.card);
    const images = await createSynergyImages(category, (index, total, card) => {
      setFinalPrintStatus(`Preparando sinergia ${index + 1} de ${total}: ${card.nombre}…`);
    }, cards);
    pages.push(...createSynergyPages(images, category));
  }
  return createPdfDocument(pages);
}

function syncFinalCategoryToggle(fieldset) {
  const items = [...fieldset.querySelectorAll('.final-card-toggle')];
  const selectedCount = items.filter(input => input.checked).length;
  const master = fieldset.querySelector('.final-category-toggle');
  master.checked = items.length > 0 && selectedCount === items.length;
  master.indeterminate = selectedCount > 0 && selectedCount < items.length;
}

function syncFinalBoardToggle() {
  const boards = [...$('finalPrintBoards').querySelectorAll('.final-board-toggle')];
  const selectedCount = boards.filter(input => input.checked).length;
  const master = $('includeAllBoards');
  master.checked = boards.length > 0 && selectedCount === boards.length;
  master.indeterminate = selectedCount > 0 && selectedCount < boards.length;
}

