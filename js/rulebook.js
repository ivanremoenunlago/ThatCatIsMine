'use strict';

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

function renderRulebookContent(rulebook) {
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
        for (const item of items) {
          const listItem = document.createElement('li');
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
}

function renderFinalPrintOptions() {
  const boardContainer = $('finalPrintBoards');
  const categoryContainer = $('finalPrintCategories');
  boardContainer.replaceChildren();
  categoryContainer.replaceChildren();

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

  const boardCount = selectedBoardIndexes.size;
  const hasSelection = rulebookPages.length > 0 || boardPages.length > 0 || cards.length > 0 || synergies.length > 0;
  return {rulebookPages, boardPages, includeRulebook, boardCount, cards, synergies, hasSelection};
}

function finalPrintPageCount(selection) {
  return selection.rulebookPages.length
    + selection.boardPages.length
    + Math.ceil(selection.cards.length / 9)
    + Math.ceil(selection.synergies.length / 3);
}

function finalPrintDescription(selection) {
  const parts = [];
  if (selection.includeRulebook) parts.push('el reglamento');
  if (selection.boardCount) parts.push(`${selection.boardCount} ${selection.boardCount === 1 ? 'tablero' : 'tableros'}`);
  if (selection.cards.length) parts.push(`${selection.cards.length} ${selection.cards.length === 1 ? 'carta' : 'cartas'}`);
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
    const pageCount = finalPrintPageCount(selection);
    setFinalPrintStatus(`Selección: ${finalPrintDescription(selection)} · ${pageCount} páginas aproximadamente.`);
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
  if (cardImages.length) pages.push(...createCardGridPages(cardImages, 63.5, 88));

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

