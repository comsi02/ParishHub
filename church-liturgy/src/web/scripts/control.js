import { getProvider } from './services/index.js';

const provider = getProvider();

let currentMassId = "1";
let currentSlideId = null;
let slides = [];
let massInfo = null;

// DOM Elements
const domMassSelect = document.getElementById('mass-select');
const domSlideCounter = document.getElementById('slide-counter');
const domSlideList = document.getElementById('slide-list');
const domPreviewTitle = document.getElementById('preview-title');
const domPreviewText = document.getElementById('preview-text');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnThemeToggle = document.getElementById('theme-toggle');
const btnAddSlide = document.getElementById('btn-add-slide');
const btnDeleteSlide = document.getElementById('btn-delete-slide');
const btnBlackout = document.getElementById('btn-blackout');
const btnFreeze = document.getElementById('btn-freeze');

let currentDisplayMode = 'normal'; // 'normal' | 'blackout' | 'freeze'

// Drag and drop state
const dragPlaceholder = document.createElement('li');
dragPlaceholder.className = 'slide-placeholder';
let draggedItem = null;
let dragStartIndex = -1;

function handleDrop() {
  if (!draggedItem || dragStartIndex === -1) return;
  
  const fromIndex = dragStartIndex;
  const children = Array.from(domSlideList.children);
  let toIndex = children.indexOf(dragPlaceholder);
  
  if (toIndex > children.indexOf(draggedItem)) {
    toIndex--; 
  }
  
  if (fromIndex !== toIndex && toIndex >= 0) {
    // 1. Instantly move the DOM node to avoid visual lag
    dragPlaceholder.parentNode.insertBefore(draggedItem, dragPlaceholder);
    draggedItem.classList.remove('dragging');
    if (dragPlaceholder.parentNode) {
      dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    }
    
    // 2. Update array state
    const [movedItem] = slides.splice(fromIndex, 1);
    slides.splice(toIndex, 0, movedItem);
    slides.forEach((s, i) => s.sequence = i + 1);
    
    // 3. Defer full re-render so browser finishes drop event natively without hanging
    setTimeout(() => {
      renderList();
    }, 10);
    
    const baseIds = slides.map(s => String(s.id).split('_p')[0]);
    const uniqueBaseIds = [...new Set(baseIds)];
    provider.reorderSlides(currentMassId, uniqueBaseIds).catch(err => {
      console.error("Failed to reorder slides", err);
      alert("순서 저장에 실패했습니다.");
    });
  }
}

dragPlaceholder.addEventListener('dragover', e => e.preventDefault());
dragPlaceholder.addEventListener('drop', (e) => {
  e.preventDefault();
  handleDrop();
});

// Modal Elements
const btnNewMass = document.getElementById('btn-new-mass');
const modalNewMass = document.getElementById('modal-new-mass');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalCreate = document.getElementById('btn-modal-create');
const inputNewMassDate = document.getElementById('new-mass-date');
const inputNewMassTitle = document.getElementById('new-mass-title');
const selectNewMassSource = document.getElementById('new-mass-source');

let cachedMasses = [];

async function init() {
  setupThemeToggle();
  setupKeyboardControls();
  setupInlineEditing();

  try {
    cachedMasses = await provider.getMasses();
    
    // Populate select
    domMassSelect.innerHTML = '';
    cachedMasses.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `[${m.date}] ${m.title}`;
      domMassSelect.appendChild(option);
    });

    // Try to restore last used massId from state
    const state = await provider.getPresentationState();
    if (state && state.massId && cachedMasses.find(m => m.id === state.massId)) {
      currentMassId = state.massId;
    } else {
      massInfo = cachedMasses[0];
      currentMassId = massInfo ? massInfo.id : "1";
    }
    
    domMassSelect.value = currentMassId;
    
    await loadSlidesForCurrentMass(state ? state.slideId : null);
    
    // Restore displayMode from saved state
    if (state && state.displayMode) {
      currentDisplayMode = state.displayMode;
      updateDisplayControlButtons();
    }
    
    domMassSelect.addEventListener('change', async (e) => {
      currentMassId = e.target.value;
      await loadSlidesForCurrentMass();
    });
    
    // Start polling for theme + displayMode changes from display
    setInterval(async () => {
      try {
        const polledState = await provider.getPresentationState();
        if (polledState && polledState.theme) {
          const currentTheme = document.body.getAttribute('data-theme');
          if (polledState.theme !== currentTheme) {
            document.body.setAttribute('data-theme', polledState.theme);
            if (typeof window.updateControlThemeIcon === 'function') {
              window.updateControlThemeIcon();
            }
          }
        }
        // Sync displayMode if changed externally
        if (polledState && polledState.displayMode && polledState.displayMode !== currentDisplayMode) {
          currentDisplayMode = polledState.displayMode;
          updateDisplayControlButtons();
        }
      } catch (err) {
        // silently ignore polling errors
      }
    }, 1500);

  } catch (err) {
    console.error("Init error", err);
  }
  
  btnPrev.addEventListener('click', prevSlide);
  btnNext.addEventListener('click', nextSlide);
  
  if (btnAddSlide) btnAddSlide.addEventListener('click', handleAddSlide);
  if (btnDeleteSlide) btnDeleteSlide.addEventListener('click', handleDeleteSlide);
  
  if (btnNewMass) btnNewMass.addEventListener('click', openNewMassModal);
  if (btnModalCancel) btnModalCancel.addEventListener('click', closeNewMassModal);
  if (btnModalCreate) btnModalCreate.addEventListener('click', handleCreateMass);
  
  setupDisplayControls();
}

function updateDisplayControlButtons() {
  if (!btnBlackout || !btnFreeze) return;

  const isBlackout = currentDisplayMode === 'blackout';
  const isFreeze = currentDisplayMode === 'freeze';

  btnBlackout.classList.toggle('active', isBlackout);
  btnBlackout.innerHTML = isBlackout
    ? `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Display 켜기`
    : `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/><line x1="2" y1="3" x2="22" y2="17"/></svg> Display 끄기`;

  btnFreeze.classList.toggle('active', isFreeze);
  btnFreeze.innerHTML = isFreeze
    ? `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg> Display 재개`
    : `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/></svg> Display 멈추기`;
}

async function setDisplayMode(mode) {
  currentDisplayMode = mode;
  updateDisplayControlButtons();
  try {
    await provider.setPresentationState({
      massId: currentMassId,
      slideId: currentSlideId,
      theme: document.body.getAttribute('data-theme') || 'dark',
      displayMode: mode
    });
  } catch (err) {
    console.error("Failed to set display mode", err);
  }
}

function setupDisplayControls() {
  if (btnBlackout) {
    btnBlackout.addEventListener('click', () => {
      const newMode = currentDisplayMode === 'blackout' ? 'normal' : 'blackout';
      setDisplayMode(newMode);
    });
  }
  if (btnFreeze) {
    btnFreeze.addEventListener('click', () => {
      const newMode = currentDisplayMode === 'freeze' ? 'normal' : 'freeze';
      setDisplayMode(newMode);
    });
  }
}

function openNewMassModal() {
  inputNewMassDate.value = new Date().toISOString().split('T')[0];
  inputNewMassTitle.value = '';
  
  selectNewMassSource.innerHTML = '<option value="">선택 안함 (빈 전례)</option>';
  cachedMasses.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = `[${m.date}] ${m.title}`;
    selectNewMassSource.appendChild(option);
  });
  
  selectNewMassSource.value = currentMassId;
  
  modalNewMass.classList.remove('hidden');
}

function closeNewMassModal() {
  modalNewMass.classList.add('hidden');
}

async function handleCreateMass() {
  const date = inputNewMassDate.value;
  const title = inputNewMassTitle.value;
  const sourceMassId = selectNewMassSource.value;
  
  if (!date || !title) {
    alert('날짜와 제목을 모두 입력해주세요.');
    return;
  }
  
  btnModalCreate.disabled = true;
  btnModalCreate.textContent = '생성 중...';
  
  try {
    const newMass = await provider.createMass({ date, title, language: 'ko' }, sourceMassId);
    
    // Refresh mass list
    cachedMasses = await provider.getMasses();
    
    domMassSelect.innerHTML = '';
    cachedMasses.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `[${m.date}] ${m.title}`;
      domMassSelect.appendChild(option);
    });
    
    // Select the new mass
    currentMassId = newMass.id;
    domMassSelect.value = currentMassId;
    
    await loadSlidesForCurrentMass();
    closeNewMassModal();
  } catch (err) {
    console.error("Failed to create mass", err);
    alert('전례 생성에 실패했습니다.');
  } finally {
    btnModalCreate.disabled = false;
    btnModalCreate.textContent = '생성하기';
  }
}

async function loadSlidesForCurrentMass(targetSlideId = null) {
  slides = await provider.getSlides(currentMassId);
  // Sort by sequence
  slides.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  
  if (targetSlideId && slides.find(s => s.id === targetSlideId)) {
    currentSlideId = targetSlideId;
  } else {
    currentSlideId = slides.length > 0 ? slides[0].id : null;
  }
  renderList();
  updatePreviewAndState();
}

function setupThemeToggle() {
  window.updateControlThemeIcon = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const svgOff = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A6 6 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5Z"/></svg>`;
    const svgOn = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #f59e0b;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A6 6 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5Z"/></svg>`;
    
    btnThemeToggle.innerHTML = isDark ? svgOff : svgOn;
    btnThemeToggle.title = isDark ? '어두운 테마 (클릭하여 켜기)' : '밝은 테마 (클릭하여 끄기)';
  };
  window.updateControlThemeIcon();

  btnThemeToggle.addEventListener('click', async () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    window.updateControlThemeIcon();
    
    // Save theme to presentation state
    try {
      await provider.setPresentationState({
        massId: currentMassId,
        slideId: currentSlideId,
        theme: newTheme,
        displayMode: currentDisplayMode  // Always preserve the current display mode
      });
    } catch (err) {
      console.error("Failed to update theme state", err);
    }
  });
}

function renderList() {
  domSlideList.innerHTML = '';
  slides.forEach((slide, index) => {
    const li = document.createElement('li');
    li.className = 'slide-item';
    if (slide.id === currentSlideId) li.classList.add('active');
    
    // Enable Drag and Drop
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      draggedItem = li;
      dragStartIndex = index;
      e.dataTransfer.setData('text/plain', index);
      setTimeout(() => {
        li.classList.add('dragging');
        li.parentNode.insertBefore(dragPlaceholder, li.nextSibling);
      }, 0);
    });
    
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      if (dragPlaceholder.parentNode) {
        dragPlaceholder.parentNode.removeChild(dragPlaceholder);
      }
      draggedItem = null;
      dragStartIndex = -1;
    });
    
    li.addEventListener('dragover', (e) => {
      e.preventDefault(); 
      if (!draggedItem || draggedItem === li) return;
      
      const rect = li.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        li.parentNode.insertBefore(dragPlaceholder, li);
      } else {
        li.parentNode.insertBefore(dragPlaceholder, li.nextSibling);
      }
    });
    
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      handleDrop();
    });
    
    // Create title container
    const titleSpan = document.createElement('span');
    titleSpan.className = 'slide-title-text';
    titleSpan.textContent = slide.title;
    
    // Create drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'slide-drag-handle';
    dragHandle.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
    dragHandle.title = "드래그하여 순서 변경";
    
    li.appendChild(titleSpan);
    li.appendChild(dragHandle);
    
    li.addEventListener('click', async () => {
      currentSlideId = slide.id;
      renderList();
      await updatePreviewAndState();
    });
    domSlideList.appendChild(li);
  });
  
  if (slides.length > 0) {
    const currentIndex = slides.findIndex(s => s.id === currentSlideId);
    domSlideCounter.textContent = `${currentIndex + 1} / ${slides.length}`;
  } else {
    domSlideCounter.textContent = `0 / 0`;
  }
}

async function handleReorder(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= slides.length) return;
  
  // Swap in the local array
  const temp = slides[index];
  slides[index] = slides[newIndex];
  slides[newIndex] = temp;
  
  // Update sequence property locally to reflect new order
  slides.forEach((s, i) => {
    s.sequence = i + 1;
  });
  
  // Re-render list immediately for responsiveness
  renderList();
  
  // Send the new order of base IDs to the provider
  const baseIds = slides.map(s => String(s.id).split('_p')[0]);
  // Remove duplicates (in case of paginated slides)
  const uniqueBaseIds = [...new Set(baseIds)];
  
  try {
    await provider.reorderSlides(currentMassId, uniqueBaseIds);
  } catch (err) {
    console.error("Failed to reorder slides", err);
    alert("순서 저장에 실패했습니다.");
  }
}

function selectSlide(id) {
  if (currentSlideId === id) return;
  currentSlideId = id;
  renderList();
  updatePreviewAndState();
}

function nextSlide() {
  const currentIndex = slides.findIndex(s => s.id === currentSlideId);
  if (currentIndex >= 0 && currentIndex < slides.length - 1) {
    selectSlide(slides[currentIndex + 1].id);
  }
}

function prevSlide() {
  const currentIndex = slides.findIndex(s => s.id === currentSlideId);
  if (currentIndex > 0) {
    selectSlide(slides[currentIndex - 1].id);
  }
}

function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    // Disable global slide navigation if we are typing inside an input or contenteditable
    if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (slides.length > 0) selectSlide(slides[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (slides.length > 0) selectSlide(slides[slides.length - 1].id);
    }
  });
}

async function updatePreviewAndState() {
  const currentIndex = slides.findIndex(s => s.id === currentSlideId);
  if (currentIndex === -1) return;
  
  const slide = slides[currentIndex];
  
  domSlideCounter.textContent = `${currentIndex + 1} / ${slides.length}`;
  domPreviewTitle.textContent = slide.title;
  domPreviewText.textContent = slide.content;
  
  // Ensure the active item is visible in the list scroll
  const activeLi = domSlideList.querySelector('.active');
  if (activeLi) {
    activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  try {
    await provider.setPresentationState({
      massId: currentMassId,
      slideId: currentSlideId,
      theme: document.body.getAttribute('data-theme') || 'dark',
      displayMode: currentDisplayMode  // Always preserve the current display mode
    });
  } catch (err) {
    console.error("Failed to update state", err);
  }
}

function setupInlineEditing() {
  const handleEdit = async (e) => {
    if (!currentSlideId) return;
    const target = e.target;
    
    const isTitle = target.id === 'preview-title';
    const isContent = target.id === 'preview-text';
    
    const currentIndex = slides.findIndex(s => s.id === currentSlideId);
    if (currentIndex === -1) return;
    
    const slide = slides[currentIndex];
    const newText = target.innerText;
    
    let changed = false;
    const updates = {};
    
    if (isTitle && slide.title !== newText) {
      slide.title = newText;
      updates.title = newText;
      changed = true;
    }
    if (isContent && slide.content !== newText) {
      slide.content = newText;
      updates.content = newText;
      changed = true;
    }
    
    if (changed) {
      try {
        await provider.updateSlide(currentMassId, currentSlideId, updates);
        renderList(); // Update list if title changed
      } catch (err) {
        console.error("Failed to save slide edit", err);
      }
    }
  };

  domPreviewTitle.addEventListener('blur', handleEdit);
  domPreviewText.addEventListener('blur', handleEdit);
}

document.addEventListener('DOMContentLoaded', init);

async function handleAddSlide() {
  const newSlideData = {
    sequence: slides.length + 1,
    type: "reading",
    title: "새 슬라이드",
    content: "내용을 입력하세요",
    subtitle: "",
    notes: ""
  };
  
  try {
    const added = await provider.addSlide(currentMassId, newSlideData);
    if (added) {
      await loadSlidesForCurrentMass(added.id); // Reload and select the new slide
    }
  } catch (err) {
    console.error("Failed to add slide", err);
    alert("슬라이드 추가에 실패했습니다.");
  }
}

async function handleDeleteSlide() {
  if (!currentSlideId) return;
  if (!confirm("현재 슬라이드를 삭제하시겠습니까?")) return;
  
  try {
    await provider.deleteSlide(currentMassId, currentSlideId);
    await loadSlidesForCurrentMass(); // Reload slides, it will select the first one automatically
  } catch (err) {
    console.error("Failed to delete slide", err);
    alert("슬라이드 삭제에 실패했습니다.");
  }
}
