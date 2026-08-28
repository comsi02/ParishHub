// display.js
// 비인증 접근 허용 (편집 기능 없음)
// presentation_state → Firestore onSnapshot 실시간 구독

import { getProvider } from './services/index.js';

const provider = getProvider();

let currentMassId = null;
let currentSlideId = null;
let slidesCache = [];
let currentDisplayMode = 'normal'; // 'normal' | 'blackout' | 'freeze'

// onSnapshot 구독 해제 함수
let unsubscribeState = null;
let unsubscribeSlides = null;

const domSlideContent = document.getElementById('slide-content');
const domLoading = document.getElementById('loading');
const domSlideTitle = document.getElementById('slide-title');

async function init() {
  setupThemeToggle();
  setupKeyboardControls();
  setupDisplayControls();
  subscribeToState();
}

// ─────────────────────────────────────────────────
// Firestore 실시간 구독
// ─────────────────────────────────────────────────

function subscribeToState() {
  // 기존 구독 해제
  if (unsubscribeState) unsubscribeState();

  // FirebaseProvider의 onSnapshot 메서드로 실시간 구독
  if (typeof provider.onPresentationStateChange === 'function') {
    unsubscribeState = provider.onPresentationStateChange(handleStateChange);
  } else {
    // LocalProvider 폴백: 1초 polling
    showLoading('로딩 중...');
    const poll = async () => {
      try {
        const state = await provider.getPresentationState();
        await handleStateChange(state);
      } catch (e) {
        console.error('Polling error:', e);
      }
    };
    poll();
    setInterval(poll, 1000);
  }
}

async function handleStateChange(state) {
  if (!state || !state.massId) {
    showLoading('미사가 선택되지 않았습니다.');
    return;
  }

  // 미사가 바뀐 경우 슬라이드 구독 갱신
  if (state.massId !== currentMassId) {
    currentMassId = state.massId;
    showLoading('미사 준비 중...');
    subscribeToSlides(currentMassId);
  }

  // displayMode 처리
  const newMode = state.displayMode || 'normal';
  if (newMode !== currentDisplayMode) {
    currentDisplayMode = newMode;
    applyDisplayMode();
  }

  // 슬라이드 변경 처리 (freeze/blackout 중에는 화면 변경 안 함)
  if (currentDisplayMode === 'normal') {
    const slideChanged = state.slideId !== currentSlideId;
    const contentUpdated = (state.lastUpdated || 0) > (window._lastRenderedAt || 0);

    if (slideChanged || contentUpdated) {
      currentSlideId = state.slideId;
      window._lastRenderedAt = state.lastUpdated || 0;
      renderCurrentSlide();
    }
  }

  // 테마 동기화
  if (state.theme) {
    const currentTheme = document.body.getAttribute('data-theme');
    if (state.theme !== currentTheme) {
      document.body.setAttribute('data-theme', state.theme);
      if (typeof window.updateDisplayThemeIcon === 'function') {
        window.updateDisplayThemeIcon();
      }
    }
  }
}

function subscribeToSlides(massId) {
  // 기존 슬라이드 구독 해제
  if (unsubscribeSlides) unsubscribeSlides();

  if (typeof provider.onSlidesChange === 'function') {
    unsubscribeSlides = provider.onSlidesChange(massId, (newSlides) => {
      slidesCache = newSlides.slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      localStorage.setItem(`slides_${massId}`, JSON.stringify(slidesCache));
      renderCurrentSlide();
    });
  } else {
    // LocalProvider 폴백
    provider.getSlides(massId).then((slides) => {
      slidesCache = slides.slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      renderCurrentSlide();
    });
  }
}

// ─────────────────────────────────────────────────
// 렌더링
// ─────────────────────────────────────────────────

function applyDisplayMode() {
  const overlay = document.getElementById('display-mode-overlay');
  if (!overlay) return;

  const isBlackout = currentDisplayMode === 'blackout';
  document.body.classList.toggle('blackout-mode', isBlackout);

  if (isBlackout) {
    overlay.style.display = 'flex';
    overlay.style.backgroundColor = '#000000';
    overlay.innerHTML = '';
  } else {
    overlay.style.display = 'none';
    if (currentDisplayMode === 'normal') {
      renderCurrentSlide();
    }
  }

  updateDisplayCtrlButtons();
}

function renderCurrentSlide() {
  if (!slidesCache.length) return;

  const slide = slidesCache.find(s => s.id === currentSlideId) || slidesCache[0];

  domLoading.style.display = 'none';
  domSlideContent.style.display = 'block';

  domSlideContent.className = `slide slide-${slide.type}`;
  if (!slide.contents) {
    slide.contents = [{ text: slide.content || '', align: 'left', role: 'none' }];
  }

  domSlideTitle.textContent = slide.title;
  domSlideTitle.style.display = slide.hideTitle ? 'none' : '';

  const contentBlocks = document.querySelectorAll('.slide-text');
  contentBlocks.forEach((p, idx) => {
    const cData = slide.contents[idx];
    if (cData && cData.text) {
      p.style.display = 'block';
      p.textContent = cData.text;
      p.setAttribute('data-align', cData.align || 'left');
      p.setAttribute('data-role', cData.role || 'none');
      p.setAttribute('data-bold', cData.bold ? 'true' : 'false');
    } else {
      p.style.display = 'none';
      p.textContent = '';
    }
  });
}

function showLoading(msg) {
  domSlideContent.style.display = 'none';
  domLoading.style.display = 'block';
  domLoading.textContent = msg;
}

// ─────────────────────────────────────────────────
// 테마 토글 (읽기 전용: 현재 state 테마 표시)
// ─────────────────────────────────────────────────

function setupThemeToggle() {
  const btnThemeToggle = document.getElementById('theme-toggle');
  if (!btnThemeToggle) return;

  window.updateDisplayThemeIcon = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const svgOff = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A6 6 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5Z"/></svg>`;
    const svgOn  = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #f59e0b;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A6 6 0 1 0 7.5 11.5c.76.76 1.23 1.52 1.41 2.5Z"/></svg>`;
    btnThemeToggle.innerHTML = isDark ? svgOff : svgOn;
    btnThemeToggle.title = isDark ? '어두운 테마 (클릭하여 켜기)' : '밝은 테마 (클릭하여 끄기)';
  };
  window.updateDisplayThemeIcon();

  // display는 비인증이므로 setPresentationState를 직접 호출하지 않음
  // 테마 변경은 control에서만 가능
  btnThemeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    window.updateDisplayThemeIcon();
  });
}

// ─────────────────────────────────────────────────
// 키보드 컨트롤 (읽기 전용 탐색)
// ─────────────────────────────────────────────────

function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
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

    // display는 읽기 전용: state 업데이트 없이 로컬 렌더만
    if (newIndex !== currentIndex && newIndex >= 0) {
      currentSlideId = slidesCache[newIndex].id;
      renderCurrentSlide();
    }
  });
}

// ─────────────────────────────────────────────────
// Blackout 버튼 (display 로컬 전용)
// ─────────────────────────────────────────────────

function updateDisplayCtrlButtons() {
  const btnBlackout = document.getElementById('display-btn-blackout');
  if (!btnBlackout) return;

  const isBlackout = currentDisplayMode === 'blackout';
  btnBlackout.classList.toggle('active', isBlackout);
  btnBlackout.title = isBlackout ? 'Display 켜기 (현재: 꺼짐)' : 'Display 끄기';
  btnBlackout.innerHTML = isBlackout
    ? `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/><line x1="2" y1="3" x2="22" y2="17"/></svg>`;
}

function setupDisplayControls() {
  const btnBlackout = document.getElementById('display-btn-blackout');
  if (btnBlackout) {
    btnBlackout.addEventListener('click', (e) => {
      e.stopPropagation();
      // display 페이지의 blackout은 로컬 전용 (state 저장 없음, 비인증이므로)
      const newMode = currentDisplayMode === 'blackout' ? 'normal' : 'blackout';
      currentDisplayMode = newMode;
      applyDisplayMode();
    });
  }
  updateDisplayCtrlButtons();
}

document.addEventListener('DOMContentLoaded', init);
