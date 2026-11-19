'use strict';

async function renderCategory(category) {
  const renderId = ++state.categoryRenderId;
  state.activeSlug = category.slug;
  $('categoryPanel').hidden = false;
  $('rulebookPanel').hidden = true;
  $('boardsPanel').hidden = true;
  $('finalPrintPanel').hidden = true;
  $('pdfButton').hidden = false;
  document.title = `¡Ese gato es mío! — ${category.nombre}`;
  const printableCount = printableCards(category).length;
  const hasCopyCounts = category.cartas.some(card => Number.isInteger(card.copias));
  const typeCount = cardTypeCount(category);
  $('categoryTitle').textContent = category.slug === 'reversos'
    ? 'Reverso reforzado · 63,5 × 88 mm · 720 ppp'
    : hasCopyCounts
    ? `${category.nombre} · ${typeCount} tipos · ${printableCount} copias`
    : `${category.nombre} · ${typeCount} cartas`;
  if (category.iconos && category.iconos.tipo) {
    $('categoryIcon').hidden = false;
    try {
      const typeIconUrl = assetUrl(category, category.iconos.tipo);
      await loadImage(typeIconUrl);
      if (renderId !== state.categoryRenderId) return;
      $('categoryIcon').src = typeIconUrl;
    } catch (error) {
      console.error(error);
      if (renderId !== state.categoryRenderId) return;
      $('categoryIcon').removeAttribute('src');
      $('categoryIcon').hidden = true;
    }
  } else {
    $('categoryIcon').removeAttribute('src');
    $('categoryIcon').hidden = true;
  }
  $('emptyState').hidden = category.cartas.length > 0;
  $('emptyState').textContent = category.cartas.length
    ? ''
    : `Esta categoría aún no contiene cartas. Añade sus datos e ilustraciones a ${category.configPath}.`;
  $('cardGrid').replaceChildren();
  $('pdfButton').disabled = true;
  $('pdfButton').textContent = category.slug === 'reversos'
    ? 'Descargar PDF A4 · reverso'
    : category.slug === 'sinergias'
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

  setStatus(category.slug === 'reversos'
    ? 'Cargando los iconos del reverso…'
    : `Cargando ${category.slug === 'sinergias' ? 'las sinergias' : 'las ilustraciones'} de ${category.cartas.length} cartas…`);
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
    ? `${failed} recursos no se pudieron cargar; corrige sus rutas antes de exportar.`
    : pending
      ? `${category.cartas.length} sinergias listas; ${pending} ilustraciones pendientes se marcarán en el PDF.`
      : category.slug === 'reversos'
        ? 'Reverso listo para descargar en PNG o PDF A4.'
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
  const boardsTab = document.createElement('button');
  boardsTab.id = 'boardsTab';
  boardsTab.type = 'button';
  boardsTab.className = 'tab-button';
  boardsTab.textContent = 'Tableros';
  boardsTab.setAttribute('role', 'tab');
  boardsTab.setAttribute('aria-selected', 'false');
  boardsTab.setAttribute('aria-controls', 'boardsPanel');
  boardsTab.addEventListener('click', showBoards);
  tabs.append(boardsTab);
  const finalPrintTab = document.createElement('button');
  finalPrintTab.id = 'finalPrintTab';
  finalPrintTab.type = 'button';
  finalPrintTab.className = 'tab-button';
  finalPrintTab.textContent = 'Impresión final';
  finalPrintTab.setAttribute('role', 'tab');
  finalPrintTab.setAttribute('aria-selected', 'false');
  finalPrintTab.setAttribute('aria-controls', 'finalPrintPanel');
  finalPrintTab.addEventListener('click', showFinalPrint);
  tabs.append(finalPrintTab);
  renderFinalPrintOptions();
  if (state.categories.length) renderCategory(state.categories[0]);
}

function showRulebook() {
  $('categoryPanel').hidden = true;
  $('rulebookPanel').hidden = false;
  fitRulebookPages();
  $('boardsPanel').hidden = true;
  $('finalPrintPanel').hidden = true;
  $('pdfButton').hidden = true;
  document.title = '¡Ese gato es mío! — Reglamento';
  for (const button of $('categoryTabs').querySelectorAll('[role="tab"]')) {
    button.setAttribute('aria-selected', String(button.id === 'rulebookTab'));
  }
}

function showBoards() {
  $('categoryPanel').hidden = true;
  $('rulebookPanel').hidden = true;
  $('boardsPanel').hidden = false;
  $('finalPrintPanel').hidden = true;
  $('pdfButton').hidden = true;
  document.title = '¡Ese gato es mío! — Tableros';
  for (const button of $('categoryTabs').querySelectorAll('[role="tab"]')) {
    button.setAttribute('aria-selected', String(button.id === 'boardsTab'));
  }
}

function showFinalPrint() {
  $('categoryPanel').hidden = true;
  $('rulebookPanel').hidden = true;
  $('boardsPanel').hidden = true;
  $('finalPrintPanel').hidden = false;
  $('pdfButton').hidden = true;
  document.title = '¡Ese gato es mío! — Impresión final';
  for (const button of $('categoryTabs').querySelectorAll('[role="tab"]')) {
    button.setAttribute('aria-selected', String(button.id === 'finalPrintTab'));
  }
  updateFinalPrintStatus();
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
    if (files || location.protocol === 'file:') await updateBoardImageSources();
    setStatus('Leyendo los archivos de las categorías…');
    const [categories, rulebook] = await Promise.all([
      Promise.all(CATEGORY_PATHS.map(async path => {
        const category = await loadCategoryFile(path);
        category.configPath = path;
        return category;
      })),
      loadCategoryFile(RULEBOOK_PATH)
    ]);
    rulebook.configPath = RULEBOOK_PATH;
    state.categories = categories;
    state.rulebook = rulebook;
    await renderRulebookContent(rulebook);
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

async function updateBoardImageSources() {
  const images = [...$('boardsPanel').querySelectorAll('.board-image-stage img')];
  const localAssetUrls = new Map();
  const localAssetUrl = projectPath => {
    const key = projectPath.toLowerCase();
    if (!localAssetUrls.has(key)) {
      localAssetUrls.set(key, (async () => {
        const response = await fetch(new URL(projectPath, location.href));
        if (!response.ok) throw new Error(`No se pudo leer el archivo ${projectPath} (${response.status}).`);
        return URL.createObjectURL(await response.blob());
      })());
    }
    return localAssetUrls.get(key);
  };
  await Promise.all(images.map(async image => {
    const projectPath = image.dataset.projectPath || image.getAttribute('src');
    if (!projectPath) throw new Error('Uno de los recursos del tablero no tiene una ruta de proyecto.');
    image.dataset.projectPath = projectPath;
    if (image._boardFetchedUrl) URL.revokeObjectURL(image._boardFetchedUrl);
    const imageUrl = state.uploadedFiles
      ? uploadedAssetUrl(projectPath)
      : await localAssetUrl(projectPath);
    image.src = imageUrl;
    if (!state.uploadedFiles) image._boardFetchedUrl = imageUrl;
    await waitForImageLoad(image, `No se pudo cargar el archivo ${projectPath}.`);
  }));
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
      setStatus(`PDF descargado: ${printableCards(category).length} sinergias con anversos y explicaciones en filas alternas.`);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'No se pudo generar el PDF de sinergias.', true);
    } finally {
      $('pdfButton').disabled = category.cartas.some(card => card.imageError);
    }
    return;
  }
  if (category.slug === 'reversos') {
    try {
      $('pdfButton').disabled = true;
      setStatus('Generando el PDF A4 del reverso…');
      const pdf = await createPdf(category);
      downloadBlob(pdf, 'reverso-cartas-a4.pdf');
      setStatus('PDF del reverso listo para descargar.');
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'No se pudo generar el PDF del reverso.', true);
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

$('finalPrintPanel').addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;

  if (input.id === 'includeAllBoards') {
    for (const board of $('finalPrintBoards').querySelectorAll('.final-board-toggle')) {
      board.checked = input.checked;
    }
  } else if (input.classList.contains('final-board-toggle')) {
    syncFinalBoardToggle();
  } else if (input.classList.contains('final-category-toggle')) {
    const fieldset = input.closest('.final-print-category');
    for (const cardInput of fieldset.querySelectorAll('.final-card-toggle')) {
      cardInput.checked = input.checked;
      const quantity = cardInput.closest('.final-print-item').querySelector('.final-print-quantity');
      if (quantity) {
        quantity.disabled = !input.checked;
        if (input.checked) quantity.value = quantity.max;
      }
    }
  } else if (input.classList.contains('final-card-toggle')) {
    const quantity = input.closest('.final-print-item').querySelector('.final-print-quantity');
    if (quantity) {
      quantity.disabled = !input.checked;
      if (input.checked && !Number.isInteger(quantity.valueAsNumber)) quantity.value = quantity.max;
    }
    syncFinalCategoryToggle(input.closest('.final-print-category'));
  }
  updateFinalPrintStatus();
});

$('selectAllFinalPrintButton').addEventListener('click', () => {
  const masterInputs = [
    $('includeRulebook'),
    $('includeAllBoards'),
    ...$('finalPrintCategories').querySelectorAll('.final-category-toggle')
  ];
  for (const input of masterInputs) {
    input.checked = true;
    input.dispatchEvent(new Event('change', {bubbles: true}));
  }
});

$('finalPrintPanel').addEventListener('input', event => {
  if (event.target.id === 'finalReverseQuantity') {
    event.target.dataset.manual = 'true';
  }
  if (event.target.classList.contains('final-print-quantity')) updateFinalPrintStatus();
});

$('downloadFinalPdfButton').addEventListener('click', async () => {
  const button = $('downloadFinalPdfButton');
  const selectAllButton = $('selectAllFinalPrintButton');
  let selection;
  try {
    selection = collectFinalPrintSelection();
    if (!selection.hasSelection) throw new Error('Marca al menos un elemento para preparar el PDF.');
  } catch (error) {
    setFinalPrintStatus(error.message, true);
    return;
  }

  state.finalPdfGenerating = true;
  button.disabled = true;
  selectAllButton.disabled = true;
  for (const fieldset of $('finalPrintPanel').querySelectorAll('fieldset')) fieldset.disabled = true;
  let finalMessage = '';
  let isError = false;
  try {
    const pdf = await createFinalPrintPdf(selection);
    downloadBlob(pdf, 'ese-gato-es-mio-impresion-seleccionada.pdf');
    const pagePlan = finalPrintPagePlan(selection);
    finalMessage = `PDF descargado: ${finalPrintDescription(selection)} · ${pagePlan.ranges.join(' · ')} · ${pagePlan.totalPages} páginas.`;
  } catch (error) {
    console.error(error);
    finalMessage = error.message || 'No se pudo generar el PDF de la selección.';
    isError = true;
  } finally {
    for (const fieldset of $('finalPrintPanel').querySelectorAll('fieldset')) fieldset.disabled = false;
    selectAllButton.disabled = false;
    state.finalPdfGenerating = false;
    updateFinalPrintStatus();
    if (finalMessage) setFinalPrintStatus(finalMessage, isError);
  }
});

$('folderButton').dataset.action = 'reload';
$('folderButton').textContent = 'Recargar catálogo';
loadProject();
