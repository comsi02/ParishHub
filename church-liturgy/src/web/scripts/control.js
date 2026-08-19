import { getProvider } from './services/index.js';

const provider = getProvider();

let currentMassId = "1";
let currentSlideId = null;
let slides = [];
let massInfo = null;

// DOM Elements
const domMassTitle = document.getElementById('mass-title');
const domSlideCounter = document.getElementById('slide-counter');
const domSlideList = document.getElementById('slide-list');
const domPreviewTitle = document.getElementById('preview-title');
const domPreviewText = document.getElementById('preview-text');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnThemeToggle = document.getElementById('theme-toggle');

async function init() {
  setupThemeToggle();
  setupKeyboardControls();

  try {
    const masses = await provider.getMasses();
    massInfo = masses.find(m => m.id === currentMassId) || masses[0];
    
    if (massInfo) {
      currentMassId = massInfo.id;
      domMassTitle.textContent = massInfo.title;
      slides = await provider.getSlides(currentMassId);
      
      const state = await provider.getPresentationState();
      if (state && state.massId === currentMassId) {
        currentSlideId = state.slideId;
      } else {
        currentSlideId = slides.length > 0 ? slides[0].id : null;
      }
      
      renderList();
      updatePreviewAndState();
    }
  } catch (err) {
    console.error("Init error", err);
    domMassTitle.textContent = "미사를 불러올 수 없습니다.";
  }
  
  btnPrev.addEventListener('click', prevSlide);
  btnNext.addEventListener('click', nextSlide);
}

function setupThemeToggle() {
  btnThemeToggle.addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    btnThemeToggle.textContent = isDark ? '다크 모드' : '라이트 모드';
  });
}

function renderList() {
  domSlideList.innerHTML = '';
  slides.forEach((slide, index) => {
    const li = document.createElement('li');
    li.className = `slide-item ${slide.id === currentSlideId ? 'active' : ''}`;
    li.textContent = slide.title;
    li.onclick = () => selectSlide(slide.id);
    domSlideList.appendChild(li);
  });
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
    if (e.key === 'ArrowRight' || e.key === ' ') {
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
      slideId: currentSlideId
    });
  } catch (err) {
    console.error("Failed to update state", err);
  }
}

document.addEventListener('DOMContentLoaded', init);
