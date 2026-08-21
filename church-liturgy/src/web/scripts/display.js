import { getProvider } from './services/index.js';

const provider = getProvider();
const POLLING_INTERVAL = 1000;

let currentMassId = null;
let currentSlideId = null;
let slidesCache = [];
let pollingIntervalId = null;

const domSlideContent = document.getElementById('slide-content');
const domLoading = document.getElementById('loading');
const domSlideTitle = document.getElementById('slide-title');
const domSlideText = document.getElementById('slide-text');

async function init() {
  setupThemeToggle();
  setupKeyboardControls();
  setupInlineEditing();
  await pollState();
  pollingIntervalId = setInterval(pollState, POLLING_INTERVAL);
}

async function pollState() {
  try {
    const state = await provider.getPresentationState();
    if (!state || !state.massId) {
      showLoading("미사가 선택되지 않았습니다.");
      return;
    }

    if (state.massId !== currentMassId) {
      currentMassId = state.massId;
      showLoading("미사 준비 중...");
      slidesCache = await provider.getSlides(currentMassId);
      // Cache locally
      localStorage.setItem(`slides_${currentMassId}`, JSON.stringify(slidesCache));
    }

    if (state.slideId !== currentSlideId) {
      currentSlideId = state.slideId;
      renderCurrentSlide();
    }
    
    // Sync theme
    if (state.theme) {
      const currentTheme = document.body.getAttribute('data-theme');
      if (state.theme !== currentTheme) {
        document.body.setAttribute('data-theme', state.theme);
        if (typeof window.updateDisplayThemeIcon === 'function') {
          window.updateDisplayThemeIcon();
        }
      }
    }
  } catch (error) {
    console.error("Polling error:", error);
    // Keep showing current slide on temporary error
  }
}

function renderCurrentSlide() {
  if (!slidesCache.length) return;

  const slide = slidesCache.find(s => s.id === currentSlideId) || slidesCache[0];

  domLoading.style.display = 'none';
  domSlideContent.style.display = 'block';

  domSlideContent.className = `slide slide-${slide.type}`;
  domSlideTitle.textContent = slide.title;
  domSlideText.textContent = slide.content;
}

function showLoading(msg) {
  domSlideContent.style.display = 'none';
  domLoading.style.display = 'block';
  domLoading.textContent = msg;
}

function setupThemeToggle() {
  const btnThemeToggle = document.getElementById('theme-toggle');
  if (!btnThemeToggle) return;
  
  window.updateDisplayThemeIcon = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const svgOff = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A6 6 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5Z"/></svg>`;
    const svgOn = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #f59e0b;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A6 6 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5Z"/></svg>`;
    
    btnThemeToggle.innerHTML = isDark ? svgOff : svgOn;
    btnThemeToggle.title = isDark ? '어두운 테마 (클릭하여 켜기)' : '밝은 테마 (클릭하여 끄기)';
  };
  window.updateDisplayThemeIcon();

  btnThemeToggle.addEventListener('click', async () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    window.updateDisplayThemeIcon();
    
    try {
      await provider.setPresentationState({
        massId: currentMassId,
        slideId: currentSlideId,
        theme: newTheme
      });
    } catch (err) {
      console.error("Failed to update theme state from display", err);
    }
  });
}

function setupKeyboardControls() {
  document.addEventListener('keydown', async (e) => {
    if (!slidesCache.length) return;
    
    const currentIndex = slidesCache.findIndex(s => s.id === currentSlideId);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      if (currentIndex < slidesCache.length - 1) newIndex = currentIndex + 1;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentIndex > 0) newIndex = currentIndex - 1;
    }

    if (newIndex !== currentIndex && newIndex >= 0) {
      currentSlideId = slidesCache[newIndex].id;
      renderCurrentSlide();
      
      try {
        await provider.setPresentationState({
          massId: currentMassId,
          slideId: currentSlideId
        });
      } catch (err) {
        console.error("Failed to update state from display", err);
      }
    }
  });
}

function setupInlineEditing() {
  const handleEdit = async (e) => {
    if (!currentSlideId) return;
    const target = e.target;
    
    const isTitle = target.id === 'slide-title';
    const isContent = target.id === 'slide-text';
    
    const currentIndex = slidesCache.findIndex(s => s.id === currentSlideId);
    if (currentIndex === -1) return;
    
    const slide = slidesCache[currentIndex];
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
      } catch (err) {
        console.error("Failed to save slide edit", err);
      }
    }
  };

  domSlideTitle.addEventListener('blur', handleEdit);
  domSlideText.addEventListener('blur', handleEdit);
}

document.addEventListener('DOMContentLoaded', init);
