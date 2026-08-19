import { getProvider } from './services/index.js';

const provider = getProvider();
const POLLING_INTERVAL = 2000;

let currentMassId = null;
let currentSlideId = null;
let slidesCache = [];
let pollingIntervalId = null;

const domSlideContent = document.getElementById('slide-content');
const domLoading = document.getElementById('loading');
const domSlideTitle = document.getElementById('slide-title');
const domSlideText = document.getElementById('slide-text');

async function init() {
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

document.addEventListener('DOMContentLoaded', init);
