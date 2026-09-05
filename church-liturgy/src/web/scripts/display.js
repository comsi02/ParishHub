// display.js
// 비인증 접근 허용 (편집 기능 없음)
// presentation_state → Firestore onSnapshot 실시간 구독

import { getProvider } from './services/index.js';

const provider = getProvider();

let currentMassId    = null;
let currentMassTitle = '';
let currentSlideId   = null;
let slidesCache      = [];
let currentDisplayMode = 'normal'; // 'normal' | 'blackout' | 'freeze'

// onSnapshot 구독 해제 함수
let unsubscribeState  = null;
let unsubscribeSlides = null;

const domSlideContent = document.getElementById('slide-content');
const domLoading      = document.getElementById('loading');
const domSlideTitle   = document.getElementById('slide-title');

async function init() {
  setupThemeToggle();
  setupKeyboardControls();
  setupDisplayControls();
  setupMassSelector();
  setupPptDownload();
  setupResizeObserver();
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
    currentMassId    = state.massId;
    currentMassTitle = state.massTitle || '';
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
    const slideChanged    = state.slideId !== currentSlideId;
    const contentUpdated  = (state.lastUpdated || 0) > (window._lastRenderedAt || 0);

    if (slideChanged || contentUpdated) {
      currentSlideId          = state.slideId;
      window._lastRenderedAt  = state.lastUpdated || 0;
      if (typeof provider.onSlidesChange !== 'function') {
        try {
          const slides = await provider.getSlides(currentMassId);
          slidesCache = slides.slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        } catch (e) {
          console.error('Failed to reload slides in display', e);
        }
      }
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
      updatePptButton();
    });
  } else {
    // LocalProvider 폴백
    provider.getSlides(massId).then((slides) => {
      slidesCache = slides.slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      renderCurrentSlide();
      updatePptButton();
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
  domSlideContent.style.display = 'flex';

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
      p.setAttribute('data-size', cData.size || 'normal');
      p.style.color = cData.color || '';
      // inline font-size 제거 → CSS data-size 규칙이 적용되도록
      p.style.fontSize = '';
    } else {
      p.style.display = 'none';
      p.textContent = '';
      p.removeAttribute('data-size');
      p.style.fontSize = '';
    }
  });

  // 라인 수가 많아 아래가 잘리지 않도록 폰트 크기 비례 자동 축소
  adjustSlideScale();
}

/**
 * 텍스트 라인 수가 많아 화면 아래로 넘칠 경우,
 * 가용 높이에 맞게 --content-scale을 비례적으로 축소하여 한 페이지에 온전히 표시되도록 조정합니다.
 */
function adjustSlideScale() {
  const container = document.getElementById('slide-container');
  const content   = document.getElementById('slide-content');
  if (!container || !content || content.style.display === 'none') return;

  // 1. 기준 스케일 1로 리셋하여 자연스러운 렌더링 높이 측정
  content.style.setProperty('--content-scale', '1');

  // 브라우저 리플로우 강제 후 높이 계산
  const containerStyle = window.getComputedStyle(container);
  const padTop    = parseFloat(containerStyle.paddingTop) || 0;
  const padBottom = parseFloat(containerStyle.paddingBottom) || 0;
  const availH    = container.clientHeight - padTop - padBottom;

  if (availH <= 0) return;

  const contentH = content.scrollHeight;

  // 2. 가용 높이를 초과하면 비율에 맞춰 자동 축소 (5% 안전 마진)
  if (contentH > availH) {
    let scale = (availH / contentH) * 0.95;
    scale = Math.max(0.35, Math.min(1, scale));
    content.style.setProperty('--content-scale', scale.toFixed(3));

    // 미세 오버플로우가 남아있는 경우 2차 보정
    if (content.scrollHeight > availH) {
      const secondScale = scale * (availH / content.scrollHeight) * 0.98;
      content.style.setProperty('--content-scale', Math.max(0.3, secondScale).toFixed(3));
    }
  }
}

function setupResizeObserver() {
  window.addEventListener('resize', adjustSlideScale);
  document.addEventListener('fullscreenchange', adjustSlideScale);
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
    // Dark 모드일 때는 해 아이콘(밝은 테마로 전환), Light 모드일 때는 달 아이콘(어두운 테마로 전환)
    const sunIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    const moonIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    btnThemeToggle.innerHTML = isDark ? sunIcon : moonIcon;
    btnThemeToggle.title = isDark ? '밝은 테마로 전환' : '어두운 테마로 전환';
  };
  window.updateDisplayThemeIcon();

  // display는 비인증이므로 setPresentationState를 직접 호출하지 않음
  // 테마 변경은 control에서만 가능 (display 로컬 토글만 수행)
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
    // 모달이 열린 경우 무시
    const modal = document.getElementById('mass-select-modal');
    if (modal && !modal.classList.contains('mass-modal-hidden')) return;

    const currentIndex = slidesCache.findIndex(s => s.id === currentSlideId);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      if (currentIndex < slidesCache.length - 1) newIndex = currentIndex + 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) newIndex = currentIndex - 1;
    } else if (e.key === 'Escape') {
      closeMassModal();
      return;
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

// ─────────────────────────────────────────────────
// 미사 선택 모달
// ─────────────────────────────────────────────────

function setupMassSelector() {
  const btnOpen    = document.getElementById('display-btn-mass-select');
  const btnClose   = document.getElementById('btn-close-mass-modal');
  const backdrop   = document.getElementById('mass-modal-backdrop');

  if (btnOpen)  btnOpen.addEventListener('click',  openMassModal);
  if (btnClose) btnClose.addEventListener('click', closeMassModal);
  if (backdrop) backdrop.addEventListener('click', closeMassModal);
}

async function openMassModal() {
  const modal = document.getElementById('mass-select-modal');
  const body  = document.getElementById('mass-modal-body');
  if (!modal) return;

  // 모달 열기
  modal.classList.remove('mass-modal-hidden');
  modal.classList.add('mass-modal-visible');

  // 로딩 상태 표시
  body.innerHTML = `
    <div class="mass-modal-state">
      <div class="mass-modal-spinner"></div>
      <span>미사 목록 불러오는 중…</span>
    </div>`;

  try {
    const masses = await provider.getMasses();
    renderMassList(masses);
  } catch (e) {
    console.error('Failed to load masses:', e);
    body.innerHTML = `
      <div class="mass-modal-state mass-modal-error">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>목록을 불러오지 못했습니다.</span>
      </div>`;
  }
}

function closeMassModal() {
  const modal = document.getElementById('mass-select-modal');
  if (!modal) return;
  modal.classList.remove('mass-modal-visible');
  modal.classList.add('mass-modal-hidden');
}

function renderMassList(masses) {
  const body = document.getElementById('mass-modal-body');
  if (!body) return;

  if (!masses || masses.length === 0) {
    body.innerHTML = `
      <div class="mass-modal-state">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>생성된 미사가 없습니다.</span>
      </div>`;
    return;
  }

  const list = document.createElement('ul');
  list.className = 'mass-list';

  masses.forEach(mass => {
    const li = document.createElement('li');
    li.className = 'mass-list-item' + (mass.id === currentMassId ? ' mass-list-item--active' : '');
    li.dataset.massId = mass.id;

    const dateParts = (mass.date || '').split(/[-./]/);
    const dateLabel = dateParts.length >= 3
      ? `${dateParts[0]}. ${parseInt(dateParts[1], 10)}. ${parseInt(dateParts[2], 10)}.`
      : (mass.date || '');

    li.innerHTML = `
      <div class="mass-list-item-inner">
        <span class="mass-date-chip">${dateLabel}</span>
        <span class="mass-title-text">${mass.title || '(제목 없음)'}</span>
        ${mass.id === currentMassId
          ? `<span class="mass-active-badge">표시 중</span>`
          : `<svg class="mass-arrow" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="9 18 15 12 9 6"/></svg>`
        }
      </div>`;

    li.addEventListener('click', () => selectMass(mass));
    list.appendChild(li);
  });

  body.innerHTML = '';
  body.appendChild(list);
}

async function selectMass(mass) {
  currentMassId    = mass.id;
  currentMassTitle = mass.title || '';
  currentSlideId   = null;

  closeMassModal();
  showLoading('미사 준비 중…');
  subscribeToSlides(mass.id);
}

// ─────────────────────────────────────────────────
// PPT 다운로드
// ─────────────────────────────────────────────────

function updatePptButton() {
  const btn = document.getElementById('display-btn-ppt');
  if (!btn) return;
  const hasSlides = slidesCache.length > 0;
  btn.disabled = !hasSlides;
  btn.title = hasSlides ? 'PPT 다운로드' : '미사를 먼저 선택하세요';
}

function setupPptDownload() {
  const btn = document.getElementById('display-btn-ppt');
  if (btn) {
    btn.addEventListener('click', downloadAsPptx);
  }
  updatePptButton();
}

async function downloadAsPptx() {
  if (!slidesCache.length) return;

  if (!window.PptxGenJS) {
    alert('PPT 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  const btn = document.getElementById('display-btn-ppt');
  if (btn) {
    btn.disabled = true;
    btn.title = 'PPT 생성 중…';
  }

  try {
    const pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 16:9 — 10" × 5.625"

    const isDark = document.body.getAttribute('data-theme') === 'dark';

    // ── 색상: base.css 와 완전히 동일 ──────────────
    // dark : bg #000000, text #FFFFFF
    // light: bg #FFFFFF, text #000000
    const BG_COLOR   = isDark ? '000000' : 'FFFFFF';
    const TEXT_COLOR = isDark ? 'FFFFFF' : '000000';

    // ── 폰트 크기: CSS vw → PPT pt 변환 ───────────
    // 슬라이드 너비 10", 1" = 72pt
    // --title-size   : 5vw → 5% × 10" × 72 = 36pt
    // --content-size : 4vw → 4% × 10" × 72 = 28.8pt ≈ 29pt
    // large  : ×1.35 → 39pt  (display.css 와 동일 비율)
    // small  : ×0.75 → 22pt
    const TITLE_PT  = 36;
    const NORMAL_PT = 29;
    const LARGE_PT  = Math.round(NORMAL_PT * 1.35); // 39
    const SMALL_PT  = Math.round(NORMAL_PT * 0.75); // 22
    const FONT_PT   = { large: LARGE_PT, normal: NORMAL_PT, small: SMALL_PT };

    // ── Role prefix: display.css ::before 와 동일 ──
    const ROLE_PREFIX = {
      priest:      '✚ ',
      leader_cong: '◎ ',
      leader:      '○ ',
      cong:        '● ',
    };

    // ── 레이아웃 상수 (인치) ───────────────────────
    // PptxGenJS LAYOUT_WIDE: 16:9 와이드스크린 (13.333" × 7.5", 현대 PowerPoint 16:9 표준)
    const SLIDE_W    = 13.333;
    const SLIDE_H    = 7.5;
    // 텍스트 박스를 기존(8.65")보다 1.85인치 더 넓혀 10.5인치로 설정 (한글 약 4~4.5글자 더 수용)
    // 좌우 여백을 약 1.4인치로 균형 배치하여 시각적 정중앙 정렬 및 이전 위치보다 살짝 오른쪽 이동
    const CONTENT_X  = 1.4;              // 왼쪽 시작 위치 (1.4인치)
    const CONTENT_W  = 10.5;             // 텍스트 박스 너비 (10.5인치, 오른쪽 여백 약 1.43인치)

    for (const slide of slidesCache) {
      const pSlide = pptx.addSlide();
      pSlide.background = { color: BG_COLOR };

      // 공백이나 줄바꿈만 있는 빈 제목은 제목 없음으로 처리
      const hasTitle = !slide.hideTitle && slide.title && slide.title.trim() !== '';
      const contents = slide.contents
        || [{ text: slide.content || '', align: 'left', role: 'none' }];
      const validContents = contents.filter(c => c && c.text && c.text.trim() !== '');

      // ── Step 1: 폰트 스케일 계산 ──
      const maxHeightPt = (SLIDE_H - 1.2) * 72;

      const estimateLines = (text, charsPerLine) =>
        (text || '').split('\n').reduce((acc, line) =>
          acc + Math.max(1, Math.ceil((line.trim().length + 2) / charsPerLine)), 0);

      const titleLines = hasTitle ? estimateLines(slide.title.trim(), 26) : 0;
      let totalContentLines = 0;
      validContents.forEach(c => {
        totalContentLines += estimateLines(c.text, 30); // 너비 확장 반영 (한 줄당 30자 수용)
      });

      const titleHeightPt   = titleLines * TITLE_PT * 1.25;
      const titleGapPt      = (hasTitle && validContents.length > 0) ? 18 : 0;
      const contentHeightPt = totalContentLines * NORMAL_PT * 1.3;
      const contentGapsPt   = Math.max(0, validContents.length - 1) * 10;
      const totalNeededPt   = titleHeightPt + titleGapPt + contentHeightPt + contentGapsPt;

      let fontScale = 1.0;
      if (totalNeededPt > maxHeightPt) {
        fontScale = Math.max(0.45, maxHeightPt / totalNeededPt);
      }

      // ── Step 2: 실제 텍스트 블록 높이 계산 → y 좌표 정중앙 배치 ──
      const actualTitleH   = titleLines * TITLE_PT * fontScale * 1.25 / 72;
      const actualTitleGap = titleGapPt * fontScale / 72;
      const actualContentH = totalContentLines * NORMAL_PT * fontScale * 1.3 / 72;
      const actualGapsH    = contentGapsPt * fontScale / 72;
      const textBlockH     = actualTitleH + actualTitleGap + actualContentH + actualGapsH;

      const boxH = Math.min(textBlockH * 1.1 + 0.1, SLIDE_H - 0.6);
      // 텍스트 상자 y: 슬라이드 세로 중앙 (7.5인치 기준), 최소 0.6인치 상단 여백 확보
      const boxY = Math.max(0.6, (SLIDE_H - boxH) / 2);

      // ── Step 3: 텍스트 객체 빌드 ──
      // · 슬라이드 제목: center (텍스트 상자 너비 기준 가운데)
      // · 본문 텍스트 : left  (텍스트 상자 내에서 왼쪽 정렬, 블록 자체가 가운데에 있으므로 자연스럽게 중앙으로 보임)
      const textObjects = [];

      if (hasTitle) {
        textObjects.push({
          text: slide.title.trim(),
          options: {
            fontSize: Math.round(TITLE_PT * fontScale),
            fontFace: 'Malgun Gothic',
            color:    TEXT_COLOR,
            bold:     false,
            align:    'center',
            breakLine: validContents.length > 0,
            paraSpaceAfter: validContents.length > 0 ? Math.round(16 * fontScale) : 0,
            lineSpacingMultiple: 1.25,
          }
        });
      }

      validContents.forEach((content, idx) => {
        const hasRole  = content.role && content.role !== 'none' && ROLE_PREFIX[content.role];
        const prefix   = hasRole ? ROLE_PREFIX[content.role] : '';
        const rawText  = (content.text || '').replace(/\r/g, '');
        const fullText = prefix + rawText;
        const baseSize = FONT_PT[content.size] || FONT_PT.normal;
        const fontSize = Math.round(baseSize * fontScale);

        const color = content.color
          ? content.color.replace('#', '')
          : TEXT_COLOR;

        const isLast = idx === validContents.length - 1;

        // Display 에서 설정한 정렬을 PPT 에서도 그대로 유지:
        // · 'center' 로 지정된 경우: 텍스트 상자 너비 기준 가운데 정렬
        // · 'right'  로 지정된 경우: 오른쪽 정렬
        // · 그 외 (기본 'left' 포함, 역할 텍스트): 왼쪽 정렬 (텍스트 상자 자체가 중앙에 있으므로 자연스럽게 중앙으로 보임)
        const pptAlign = content.align === 'center' ? 'center'
                       : content.align === 'right'  ? 'right'
                       : 'left';

        textObjects.push({
          text: fullText,
          options: {
            fontSize,
            fontFace: 'Malgun Gothic',
            color,
            bold:     !!content.bold,
            align:    pptAlign,
            breakLine: !isLast,
            paraSpaceAfter: isLast ? 0 : Math.round(10 * fontScale),
            lineSpacingMultiple: 1.3,
          }
        });
      });

      // ── Step 4: 텍스트 상자를 슬라이드 가로/세로 정중앙에 배치 ──
      if (textObjects.length > 0) {
        pSlide.addText(textObjects, {
          x:      CONTENT_X,   // 좌우 1.2인치 여백으로 슬라이드 가로 중앙
          y:      boxY,         // 계산된 y로 슬라이드 세로 중앙
          w:      CONTENT_W,
          h:      boxH,
          valign: 'top',
          margin: 0,
          wrap:   true,
        });
      }
    }

    // ── 파일 저장 및 역할 구분 문자 들여쓰기(Hanging Indent) 후처리 ──
    const safeName = (currentMassTitle || '미사').replace(/[/\\?%*:|"<>]/g, '_');
    const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${safeName}_${dateStr}.pptx`;

    if (window.JSZip) {
      const blob = await pptx.write({ outputType: 'blob' });
      const zip  = await window.JSZip.loadAsync(blob);

      // 역할 기호 문단에 Hanging Indent 적용 (left 정렬 문단에서만 동작)
      const slideFiles = Object.keys(zip.files).filter(
        name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
      );

      for (const filePath of slideFiles) {
        let xml = await zip.file(filePath).async('string');
        let modified = false;
        let currentHangingEmu = 0;

        xml = xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (match) => {
          const isRoleStart = /[✚➕◎○●]/.test(match);

          if (isRoleStart) {
            const szMatch = match.match(/sz="(\d+)"/);
            const pt = szMatch ? parseInt(szMatch[1], 10) / 100 : 28;
            currentHangingEmu = Math.round(1.2 * pt * 12700);
            modified = true;
            // 첫 줄: 역할 기호부터 맨 앞에서 시작, 자동 줄바꿈 시 기호 너비만큼 들여쓰기
            return match.replace(
              /indent="0"\s+marL="0"/,
              `indent="-${currentHangingEmu}" marL="${currentHangingEmu}"`
            );
          } else if (currentHangingEmu > 0) {
            const textMatch = match.match(/<a:t>([\s\S]*?)<\/a:t>/);
            const text = textMatch ? textMatch[1].trim() : '';
            // 빈 줄이거나 center 정렬(소제목)이면 역할 블록 종료
            if (!text || match.includes('algn="ctr"')) {
              currentHangingEmu = 0;
              return match;
            }
            // 엔터로 이어진 후속 줄: 기호 너비만큼 들여쓰기
            modified = true;
            return match.replace(
              /indent="0"\s+marL="0"/,
              `indent="0" marL="${currentHangingEmu}"`
            );
          }

          return match;
        });

        if (modified) zip.file(filePath, xml);
      }

      const finalBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } else {
      await pptx.writeFile({ fileName });
    }

  } catch (err) {
    console.error('PPT 생성 실패:', err);
    alert('PPT 생성 중 오류가 발생했습니다: ' + err.message);
  } finally {
    updatePptButton();
  }
}

document.addEventListener('DOMContentLoaded', init);

