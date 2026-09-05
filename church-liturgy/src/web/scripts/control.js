// control.js
// 관리자 전용 (Google 로그인 + admins 권한 체크)

import { getProvider } from './services/index.js';
import { formatKoreanDate, calculateLiturgicalTitle } from './services/FirebaseProvider.js';
import { onAuthStateChanged, signInWithGoogle, signOut, checkIsAdmin } from '../../auth.js';

const provider = getProvider();

let currentMassId = '1';
let currentSlideId = null;
let slides = [];
let massInfo = null;

// onSnapshot 구독 해제 함수
let unsubscribeState = null;

// DOM Elements
const domMassSelect        = document.getElementById('mass-select');
const massComboboxEl       = document.getElementById('mass-combobox');
const massComboboxTrigger  = document.getElementById('mass-combobox-trigger');
const massSelectedTextEl   = document.getElementById('mass-combobox-selected-text');
const massDropdownMenuEl   = document.getElementById('mass-dropdown-menu');
const massSearchInputEl    = document.getElementById('mass-search-input');
const massDropdownListEl   = document.getElementById('mass-dropdown-list');
const tabFilterRecent      = document.getElementById('tab-filter-recent');
const tabFilterAll         = document.getElementById('tab-filter-all');

const domSlideCounter  = document.getElementById('slide-counter');
const domSlideList     = document.getElementById('slide-list');
const domPreviewTitle  = document.getElementById('preview-title');
const domPreviewListTitle = document.getElementById('preview-list-title');
const domPreviewText   = document.getElementById('preview-text');
const btnPrev          = document.getElementById('btn-prev');
const btnNext          = document.getElementById('btn-next');
const btnThemeToggle   = document.getElementById('theme-toggle');
const btnAddSlide      = document.getElementById('btn-add-slide');
const btnDeleteSlide   = document.getElementById('btn-delete-slide');
const btnDeleteMass    = document.getElementById('btn-delete-mass');
const btnBlackout      = document.getElementById('btn-blackout');
const btnFreeze        = document.getElementById('btn-freeze');

let currentDisplayMode = 'normal'; // 'normal' | 'blackout' | 'freeze'
let massFilterMode     = 'recent'; // 'recent' (최근 ±1달) | 'all' (전체)
let massSearchQuery    = '';

// ─────────────────────────────────────────────────
// 인증 게이트
// ─────────────────────────────────────────────────

const loginOverlay = document.getElementById('login-overlay');
const loginBtn     = document.getElementById('btn-google-login');
const noAccessMsg  = document.getElementById('no-access-message');
const currentUserEmailEl = document.getElementById('current-user-email');
const currentUserUidEl   = document.getElementById('current-user-uid');
const cmdInputBox        = document.getElementById('cmd-input-box');
const btnCopyCmd         = document.getElementById('btn-copy-cmd');
const btnReloadPage      = document.getElementById('btn-reload-page');
const btnGrantLocalAdmin = document.getElementById('btn-grant-local-admin');
const btnNoAccessLogout  = document.getElementById('btn-no-access-logout');
const userInfoEl   = document.getElementById('user-info');
const userNameEl   = document.getElementById('user-name');
const btnLogout    = document.getElementById('btn-logout');
const appMain      = document.getElementById('app-main');

let pendingUser = null;

function showLoginOverlay(showNoAccess = false, user = null) {
  if (loginOverlay) loginOverlay.style.display = 'flex';
  if (appMain) appMain.style.display = 'none';
  if (noAccessMsg) noAccessMsg.style.display = showNoAccess ? 'block' : 'none';
  
  if (loginBtn) {
    loginBtn.style.display = showNoAccess ? 'none' : 'inline-flex';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Google 계정으로 로그인';
  }

  if (showNoAccess && user) {
    pendingUser = user;
    if (currentUserEmailEl) currentUserEmailEl.textContent = user.email || '(이메일 없음)';
    if (currentUserUidEl) currentUserUidEl.textContent = user.uid;
    if (cmdInputBox) {
      const email = user.email || 'admin@parish.org';
      const name = user.displayName || '전례관리자';
      cmdInputBox.value = `node scripts/add-admin.mjs "${user.uid}" "${email}" "${name}"`;
    }
  } else {
    pendingUser = null;
  }
}

function hideLoginOverlay(user) {
  if (loginOverlay) loginOverlay.style.display = 'none';
  if (appMain) appMain.style.display = '';
  if (userInfoEl) userInfoEl.style.display = 'flex';
  if (userNameEl) userNameEl.textContent = user.displayName || user.email;
  const popupName = document.getElementById('popup-user-name');
  const popupEmail = document.getElementById('popup-user-email');
  if (popupName) popupName.textContent = user.displayName || '관리자';
  if (popupEmail) popupEmail.textContent = user.email || '';
  if (typeof syncMobileMenuUser === 'function') syncMobileMenuUser();
}

// ─────────────────────────────────────────────────
// 앱 진입점
// ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // 앱 영역 숨기고 로그인 체크 시작
  if (appMain) appMain.style.display = 'none';
  if (loginOverlay) loginOverlay.style.display = 'flex';

  // 모바일 사용자 프로필 팝업 제어
  const btnUserProfile   = document.getElementById('btn-user-profile');
  const userProfilePopup = document.getElementById('user-profile-popup');
  const btnPopupLogout   = document.getElementById('btn-popup-logout');

  if (btnUserProfile && userProfilePopup) {
    btnUserProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      userProfilePopup.classList.toggle('hidden');
      btnUserProfile.setAttribute('aria-expanded', !userProfilePopup.classList.contains('hidden'));
    });

    document.addEventListener('click', (e) => {
      if (!userProfilePopup.classList.contains('hidden')) {
        if (!userProfilePopup.contains(e.target) && !btnUserProfile.contains(e.target)) {
          userProfilePopup.classList.add('hidden');
          btnUserProfile.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  // 로그인 버튼
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      try {
        loginBtn.disabled = true;
        loginBtn.textContent = '로그인 중...';
        await signInWithGoogle();
      } catch (err) {
        console.error('로그인 실패:', err);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Google 계정으로 로그인';
        if (err.code !== 'auth/popup-closed-by-user') {
          alert('로그인에 실패했습니다.\n\n' + (err.message || err));
        }
      }
    });
  }

  // 로그아웃 버튼 (상단, 팝업, 권한없음 화면)
  const handleLogout = async () => {
    if (userProfilePopup) userProfilePopup.classList.add('hidden');
    try {
      if (btnNoAccessLogout) {
        btnNoAccessLogout.disabled = true;
        btnNoAccessLogout.textContent = '로그아웃 중...';
      }
      if (btnLogout) {
        btnLogout.disabled = true;
      }
      if (btnPopupLogout) {
        btnPopupLogout.disabled = true;
      }
      await signOut();
    } catch (e) {
      console.error('로그아웃 에러:', e);
    } finally {
      if (btnNoAccessLogout) {
        btnNoAccessLogout.disabled = false;
        btnNoAccessLogout.textContent = '로그아웃';
      }
      if (btnLogout) {
        btnLogout.disabled = false;
      }
      if (btnPopupLogout) {
        btnPopupLogout.disabled = false;
      }
      if (userInfoEl) userInfoEl.style.display = 'none';
      showLoginOverlay(false);
    }
  };

  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  if (btnPopupLogout) btnPopupLogout.addEventListener('click', handleLogout);
  if (btnNoAccessLogout) btnNoAccessLogout.addEventListener('click', handleLogout);

  // 명령어 복사 버튼
  if (btnCopyCmd && cmdInputBox) {
    btnCopyCmd.addEventListener('click', async () => {
      cmdInputBox.select();
      try {
        await navigator.clipboard.writeText(cmdInputBox.value);
        btnCopyCmd.textContent = '✅ 복사됨!';
        btnCopyCmd.style.background = '#16a34a';
        setTimeout(() => {
          btnCopyCmd.textContent = '복사';
          btnCopyCmd.style.background = '#0284c7';
        }, 2500);
      } catch (e) {
        document.execCommand('copy');
        btnCopyCmd.textContent = '✅ 복사됨!';
        setTimeout(() => {
          btnCopyCmd.textContent = '복사';
        }, 2500);
      }
    });
  }

  // 등록 후 새로고침 버튼
  if (btnReloadPage) {
    btnReloadPage.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Firebase Auth 상태 감지
  onAuthStateChanged(async (user) => {
    if (!user) {
      showLoginOverlay(false);
      return;
    }

    // 로그인됨 → 권한 확인
    const isAdmin = await checkIsAdmin(user.uid);
    if (!isAdmin) {
      showLoginOverlay(true, user); // "권한 없음" 메시지 + 사용자 정보 표시
      return;
    }

    // 관리자 확인 → 앱 초기화
    hideLoginOverlay(user);
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Google 계정으로 로그인';
    }
    await initApp();
  });
});

// ─────────────────────────────────────────────────
// 드래그 앤 드롭
// ─────────────────────────────────────────────────

function formatMassOptionText(mass) {
  try {
    const parts = mass.date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const date = parseInt(parts[2], 10);
      const d = new Date(year, month - 1, date);
      const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
      return `${mass.title} [${year}년 ${month}월 ${date}일 ${days[d.getDay()]}]`;
    }
  } catch(e) {}
  return `${mass.title} [${mass.date}]`;
}

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

  if (fromIndex !== toIndex && toIndex >= 0 && toIndex < slides.length) {
    dragPlaceholder.parentNode.insertBefore(draggedItem, dragPlaceholder);
    draggedItem.classList.remove('dragging');
    if (dragPlaceholder.parentNode) {
      dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    }

    // 1. 메모리 상의 slides 배열 순서 변경
    const [movedSlide] = slides.splice(fromIndex, 1);
    slides.splice(toIndex, 0, movedSlide);

    // 2. sequence 번호 재할당
    slides.forEach((slide, idx) => {
      slide.sequence = idx + 1;
    });

    // 3. 변경된 순서의 ID 목록을 provider에 저장
    const slideIds = slides.map(s => String(s.id));
    provider.reorderSlides(currentMassId, slideIds).catch(err => {
      console.error('Failed to reorder slides', err);
      alert('순서 저장에 실패했습니다.');
    });

    renderList();
  } else {
    draggedItem.classList.remove('dragging');
    if (dragPlaceholder.parentNode) {
      dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    }
  }
}

dragPlaceholder.addEventListener('dragover', e => e.preventDefault());
dragPlaceholder.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(); });

// Modal Elements (Create Mass)
const btnNewMass       = document.getElementById('btn-new-mass');
const modalNewMass     = document.getElementById('modal-new-mass');
const btnModalCancel   = document.getElementById('btn-modal-cancel');
const btnModalCreate   = document.getElementById('btn-modal-create');
const inputNewMassDate  = document.getElementById('new-mass-date');
const inputNewMassTitle = document.getElementById('new-mass-title');
const selectNewMassSource = document.getElementById('new-mass-source');

// Modal Elements (Edit Mass)
const btnEditMass          = document.getElementById('btn-edit-mass');
const modalEditMass        = document.getElementById('modal-edit-mass');
const btnModalEditCancel   = document.getElementById('btn-modal-edit-cancel');
const btnModalEditSave     = document.getElementById('btn-modal-edit-save');
const inputEditMassDate    = document.getElementById('edit-mass-date');
const inputEditMassTitle   = document.getElementById('edit-mass-title');

let cachedMasses = [];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// ─────────────────────────────────────────────────
// 작업 모드 관리 (프리젠테이션 vs 수정/편집)
// ─────────────────────────────────────────────────

let currentAppMode = 'presentation'; // 기본값: 프리젠테이션 모드

function setupModeSwitcher() {
  const btnPresentation = document.getElementById('btn-mode-presentation');
  const btnAdmin        = document.getElementById('btn-mode-admin');

  if (btnPresentation) {
    btnPresentation.addEventListener('click', () => setAppMode('presentation'));
  }
  if (btnAdmin) {
    btnAdmin.addEventListener('click', () => setAppMode('admin'));
  }

  setAppMode('presentation'); // 초기 모드 세팅
}

function setAppMode(mode) {
  currentAppMode = mode;
  const appContainer    = document.getElementById('app-main');
  const btnPresentation = document.getElementById('btn-mode-presentation');
  const btnAdmin        = document.getElementById('btn-mode-admin');

  if (appContainer) {
    appContainer.classList.toggle('mode-presentation', mode === 'presentation');
    appContainer.classList.toggle('mode-admin', mode === 'admin');
  }

  if (btnPresentation) btnPresentation.classList.toggle('active', mode === 'presentation');
  if (btnAdmin) btnAdmin.classList.toggle('active', mode === 'admin');

  // 편집 가능 여부 업데이트
  updateContentEditable();

  // 모바일 메뉴 모드 표시 동기화
  if (typeof window.syncMobileMenuMode === 'function') {
    window.syncMobileMenuMode();
  }

  // 프리젠테이션 모드로 전환 시 모바일은 진행 제어 탭으로 이동
  if (mode === 'presentation' && typeof window.switchToMobileControlTab === 'function') {
    window.switchToMobileControlTab();
  }
}

function updateContentEditable() {
  const editable = currentAppMode === 'admin';

  if (domPreviewTitle) {
    domPreviewTitle.setAttribute('contenteditable', editable ? 'true' : 'false');
  }
  if (domPreviewListTitle) {
    domPreviewListTitle.setAttribute('contenteditable', editable ? 'true' : 'false');
  }

  document.querySelectorAll('.preview-text').forEach(p => {
    p.setAttribute('contenteditable', editable ? 'true' : 'false');
  });
}

// ─────────────────────────────────────────────────
// 앱 초기화 (로그인 후)
// ─────────────────────────────────────────────────

async function initApp() {
  setupModeSwitcher();
  setupMassCombobox();
  setupMobileTabs();
  setupMobileMenu();
  setupSwipeGestures();
  setupThemeToggle();
  setupKeyboardControls();
  setupInlineEditing();
  setupAddContentButton();
  setupHideTitleButton();

  try {
    cachedMasses = asArray(await provider.getMasses());

    const state = await provider.getPresentationState();
    let targetSlideId = null;

    if (state) {
      if (state.theme) {
        document.body.setAttribute('data-theme', state.theme);
        if (typeof window.updateControlThemeIcon === 'function') {
          window.updateControlThemeIcon();
        }
      }

      if (state.massId && cachedMasses.find(m => m.id === state.massId)) {
        currentMassId = state.massId;
      } else {
        const massInfo = cachedMasses[0];
        currentMassId = massInfo ? massInfo.id : '1';
      }

      if (state.displayMode) {
        currentDisplayMode = state.displayMode;
        updateDisplayControlButtons();
      }

      targetSlideId = state.slideId || null;
    } else {
      const massInfo = cachedMasses[0];
      currentMassId = massInfo ? massInfo.id : '1';
    }

    populateMassSelect();
    
    // 초기 로드 시에는 다른 클라이언트에 덮어쓰지 않도록 shouldBroadcast = false 전달
    await loadSlidesForCurrentMass(targetSlideId, false);

    domMassSelect.addEventListener('change', async (e) => {
      currentMassId = e.target.value;
      populateMassSelect();
      const shouldBroadcast = currentAppMode === 'presentation';
      await loadSlidesForCurrentMass(null, shouldBroadcast);
    });

    // presentation_state → onSnapshot으로 다른 제어기/화면과 실시간 양방향 동기화
    subscribeToState();

  } catch (err) {
    console.error('Init error', err);
  }

  btnPrev.addEventListener('click', prevSlide);
  btnNext.addEventListener('click', nextSlide);

  if (btnAddSlide) btnAddSlide.addEventListener('click', handleAddSlide);
  if (btnDeleteSlide) btnDeleteSlide.addEventListener('click', handleDeleteSlide);

  if (btnNewMass) btnNewMass.addEventListener('click', openNewMassModal);
  if (btnEditMass) btnEditMass.addEventListener('click', openEditMassModal);
  if (btnDeleteMass) btnDeleteMass.addEventListener('click', handleDeleteMass);
  if (btnModalCancel) btnModalCancel.addEventListener('click', closeNewMassModal);
  if (btnModalCreate) btnModalCreate.addEventListener('click', handleCreateMass);
  if (btnModalEditCancel) btnModalEditCancel.addEventListener('click', closeEditMassModal);
  if (btnModalEditSave) btnModalEditSave.addEventListener('click', handleUpdateMass);

  // 날짜 변경 시 전례 제목 자동 계산 연동
  if (inputNewMassDate && inputNewMassTitle) {
    const handleNewDateChange = () => {
      const title = calculateLiturgicalTitle(inputNewMassDate.value);
      if (title) inputNewMassTitle.value = title;
    };
    inputNewMassDate.addEventListener('input', handleNewDateChange);
    inputNewMassDate.addEventListener('change', handleNewDateChange);
  }

  if (inputEditMassDate && inputEditMassTitle) {
    const handleEditDateChange = () => {
      const title = calculateLiturgicalTitle(inputEditMassDate.value);
      if (title) inputEditMassTitle.value = title;
    };
    inputEditMassDate.addEventListener('input', handleEditDateChange);
    inputEditMassDate.addEventListener('change', handleEditDateChange);
  }

  setupDisplayControls();
}

// ─────────────────────────────────────────────────
// 모바일 탭 제어 (진행 제어 vs 목록/편집)
// ─────────────────────────────────────────────────

let currentMobileTab = 'control';

function setupMobileTabs() {
  const tabBtnControl = document.getElementById('tab-btn-control');
  const tabBtnList    = document.getElementById('tab-btn-list');
  const appContainer  = document.getElementById('app-main');

  if (!tabBtnControl || !tabBtnList || !appContainer) return;

  const setMobileTab = (tab) => {
    currentMobileTab = tab;
    if (tab === 'control') {
      tabBtnControl.classList.add('active');
      tabBtnList.classList.remove('active');
      appContainer.classList.remove('mobile-view-list');
      appContainer.classList.add('mobile-view-control');
    } else {
      tabBtnList.classList.add('active');
      tabBtnControl.classList.remove('active');
      appContainer.classList.remove('mobile-view-control');
      appContainer.classList.add('mobile-view-list');
    }
  };

  tabBtnControl.addEventListener('click', () => setMobileTab('control'));
  tabBtnList.addEventListener('click', () => setMobileTab('list'));

  setMobileTab('control');
  window.switchToMobileControlTab = () => setMobileTab('control');
  window.switchToMobileListTab = () => setMobileTab('list');
  window.setMobileTab = setMobileTab;
}

// ─────────────────────────────────────────────────
// 모바일 햄버거 메뉴
// ─────────────────────────────────────────────────

function setupMobileMenu() {
  const drawer = document.getElementById('mobile-menu-drawer');
  const btnOpen = document.getElementById('btn-mobile-menu');
  const btnClose = document.getElementById('btn-close-mobile-menu');
  const backdrop = document.getElementById('mobile-menu-backdrop');
  if (!drawer || !btnOpen) return;

  const openMenu = () => {
    syncMobileMenuUser();
    syncMobileMenuTheme();
    syncMobileMenuMode();
    drawer.classList.remove('hidden');
  };
  const closeMenu = () => drawer.classList.add('hidden');

  btnOpen.addEventListener('click', openMenu);
  btnClose?.addEventListener('click', closeMenu);
  backdrop?.addEventListener('click', closeMenu);

  const wire = (id, action) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      closeMenu();
      action();
    });
  };

  wire('mobile-btn-mode-presentation', () => setAppMode('presentation'));
  wire('mobile-btn-mode-admin', () => {
    setAppMode('admin');
    if (typeof window.switchToMobileListTab === 'function') {
      window.switchToMobileListTab();
    }
  });
  wire('mobile-btn-new-mass', () => openNewMassModal());
  wire('mobile-btn-edit-mass', () => openEditMassModal());
  wire('mobile-btn-delete-mass', () => handleDeleteMass());
  wire('mobile-btn-logout', () => btnLogout?.click());

  const mobileThemeBtn = document.getElementById('mobile-btn-theme-toggle');
  if (mobileThemeBtn) {
    mobileThemeBtn.addEventListener('click', () => {
      btnThemeToggle?.click();
      syncMobileMenuTheme();
    });
  }

  window.syncMobileMenuMode = syncMobileMenuMode;
}

function syncMobileMenuUser() {
  const desktopName = document.getElementById('user-name');
  const mobileName = document.getElementById('mobile-user-name');
  if (mobileName && desktopName) {
    mobileName.textContent = desktopName.textContent || '관리자';
  }
}

function syncMobileMenuTheme() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const icon = document.getElementById('mobile-theme-icon');
  const text = document.getElementById('mobile-theme-text');
  if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  if (text) text.textContent = isDark ? '밝은 테마로 전환' : '어두운 테마로 전환';
}

function syncMobileMenuMode() {
  const btnPres = document.getElementById('mobile-btn-mode-presentation');
  const btnAdmin = document.getElementById('mobile-btn-mode-admin');
  btnPres?.classList.toggle('active-mode', currentAppMode === 'presentation');
  btnAdmin?.classList.toggle('active-mode', currentAppMode === 'admin');
}

// ─────────────────────────────────────────────────
// 스와이프 제스처 (슬라이드 넘기기 + 탭 전환)
// ─────────────────────────────────────────────────

function setupSwipeGestures() {
  const previewBox = document.getElementById('preview-box');
  const controlMain = document.querySelector('.control-main');

  // 미리보기: 스마트폰처럼 인터랙티브 슬라이드 스와이프
  if (previewBox) {
    attachPreviewInteractiveSwipe(previewBox);
  }

  // 메인 영역: 넓은 스와이프로 모바일 탭(진행 제어 ↔ 목록) 전환
  // 미리보기 안에서의 제스처는 위 핸들러가 우선 처리
  if (controlMain) {
    attachHorizontalSwipe(controlMain, {
      threshold: 80,
      ignoreSelector: '#preview-box, .slide-list, input, textarea, select, button, [contenteditable="true"]',
      onSwipeLeft: () => {
        if (window.innerWidth > 768) return;
        if (currentMobileTab === 'control' && typeof window.switchToMobileListTab === 'function') {
          window.switchToMobileListTab();
        }
      },
      onSwipeRight: () => {
        if (window.innerWidth > 768) return;
        if (currentMobileTab === 'list' && typeof window.switchToMobileControlTab === 'function') {
          window.switchToMobileControlTab();
        }
      },
    });
  }
}

function attachPreviewInteractiveSwipe(el) {
  if (!el) return;

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let isHorizontal = null;
  let isAnimating = false;

  const canGoNext = () => {
    const idx = slides.findIndex(s => s.id === currentSlideId);
    return idx >= 0 && idx < slides.length - 1;
  };

  const canGoPrev = () => {
    const idx = slides.findIndex(s => s.id === currentSlideId);
    return idx > 0;
  };

  el.addEventListener('touchstart', (e) => {
    if (isAnimating || e.touches.length !== 1) return;
    // contenteditable 편집 중이거나 폼 요소 입력 중에는 스와이프 무시
    if (e.target.closest?.('[contenteditable="true"], input, textarea, select, button')) return;

    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    tracking = true;
    isHorizontal = null;
    el.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!tracking || isAnimating) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // 초기 방향 결정 (8px 이상 이동 시)
    if (isHorizontal === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (Math.abs(dy) >= Math.abs(dx)) {
          // 세로 스크롤로 판정 → 가로 제스처 취소
          isHorizontal = false;
          tracking = false;
          return;
        } else {
          isHorizontal = true;
        }
      }
    }

    if (isHorizontal === true) {
      if (e.cancelable) e.preventDefault();

      // 경계(더 이상 넘어갈 수 없는 방향)에서는 강한 저항감 적용
      let dragX = dx;
      if ((dx < 0 && !canGoNext()) || (dx > 0 && !canGoPrev())) {
        dragX = dx * 0.22;
      } else {
        dragX = dx * 0.85;
      }

      el.style.transform = `translateX(${dragX}px)`;
      const opacity = Math.max(0.65, 1 - Math.abs(dragX) / 400);
      el.style.opacity = String(opacity);
    }
  }, { passive: false });

  const resetPosition = (duration = 200) => {
    isAnimating = true;
    el.style.transition = `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}ms ease`;
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
    setTimeout(() => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
      isAnimating = false;
    }, duration);
  };

  el.addEventListener('touchend', (e) => {
    if (!tracking || isAnimating) {
      tracking = false;
      return;
    }
    tracking = false;
    if (isHorizontal !== true) return;

    const t = e.changedTouches[0];
    const dx = t ? t.clientX - startX : 0;
    const threshold = 45;

    // 다음 슬라이드로 스와이프 (왼쪽으로 밀기)
    if (dx < -threshold && canGoNext()) {
      isAnimating = true;
      el.style.transition = 'transform 180ms cubic-bezier(0.25, 1, 0.5, 1), opacity 180ms ease';
      el.style.transform = 'translateX(-100%)';
      el.style.opacity = '0';

      setTimeout(() => {
        nextSlide();
        // 새 슬라이드가 오른쪽에서 진입
        el.style.transition = 'none';
        el.style.transform = 'translateX(60px)';
        el.style.opacity = '0';
        void el.offsetWidth; // reflow

        el.style.transition = 'transform 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms ease';
        el.style.transform = 'translateX(0)';
        el.style.opacity = '1';

        setTimeout(() => {
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
          isAnimating = false;
        }, 220);
      }, 180);

    // 이전 슬라이드로 스와이프 (오른쪽으로 밀기)
    } else if (dx > threshold && canGoPrev()) {
      isAnimating = true;
      el.style.transition = 'transform 180ms cubic-bezier(0.25, 1, 0.5, 1), opacity 180ms ease';
      el.style.transform = 'translateX(100%)';
      el.style.opacity = '0';

      setTimeout(() => {
        prevSlide();
        // 새 슬라이드가 왼쪽에서 진입
        el.style.transition = 'none';
        el.style.transform = 'translateX(-60px)';
        el.style.opacity = '0';
        void el.offsetWidth; // reflow

        el.style.transition = 'transform 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms ease';
        el.style.transform = 'translateX(0)';
        el.style.opacity = '1';

        setTimeout(() => {
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
          isAnimating = false;
        }, 220);
      }, 180);

    } else {
      // 덜 밀었거나 더 이상 갈 수 없는 경우 바운스 복귀
      resetPosition(220);
    }
  }, { passive: true });

  el.addEventListener('touchcancel', () => {
    if (tracking) {
      tracking = false;
      resetPosition(200);
    }
  }, { passive: true });
}

function flashSwipe(el) {
  if (!el) return;
  el.classList.remove('swipe-flash');
  // force reflow
  void el.offsetWidth;
  el.classList.add('swipe-flash');
}

function attachHorizontalSwipe(el, { threshold = 50, onSwipeLeft, onSwipeRight, ignoreSelector } = {}) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    if (ignoreSelector && e.target.closest?.(ignoreSelector)) return;
    // contenteditable / 입력 중에는 스와이프 무시
    if (e.target.closest?.('[contenteditable="true"], input, textarea, select')) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    tracking = true;
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) return; // 세로 스크롤 우선
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }, { passive: true });

  el.addEventListener('touchcancel', () => {
    tracking = false;
  }, { passive: true });
}

// ─────────────────────────────────────────────────
// onSnapshot: presentation_state 실시간 동기화
// ─────────────────────────────────────────────────

function subscribeToState() {
  if (unsubscribeState) unsubscribeState();

  if (typeof provider.onPresentationStateChange === 'function') {
    unsubscribeState = provider.onPresentationStateChange(async (state) => {
      if (!state) return;
      
      // 테마 동기화
      if (state.theme) {
        const currentTheme = document.body.getAttribute('data-theme');
        if (state.theme !== currentTheme) {
          document.body.setAttribute('data-theme', state.theme);
          if (typeof window.updateControlThemeIcon === 'function') {
            window.updateControlThemeIcon();
          }
        }
      }
      // displayMode 동기화
      if (state.displayMode && state.displayMode !== currentDisplayMode) {
        currentDisplayMode = state.displayMode;
        updateDisplayControlButtons();
      }
      // 미사 ID 변경 감지 (다른 제어기가 미사를 바꿨을 때)
      if (state.massId && state.massId !== currentMassId) {
        currentMassId = state.massId;
        if (domMassSelect) domMassSelect.value = currentMassId;
        await loadSlidesForCurrentMass(state.slideId || null, false);
        return;
      }
      // 슬라이드 ID 변경 감지 (다른 제어기가 슬라이드를 넘겼을 때)
      if (state.slideId && state.slideId !== currentSlideId) {
        if (slides.some(s => s.id === state.slideId)) {
          currentSlideId = state.slideId;
          renderList();
          updatePreviewUI();
        }
      }
    });
  }
}

// ─────────────────────────────────────────────────
// Display 컨트롤
// ─────────────────────────────────────────────────

function updateDisplayControlButtons() {
  if (!btnBlackout || !btnFreeze) return;

  const isBlackout = currentDisplayMode === 'blackout';
  const isFreeze   = currentDisplayMode === 'freeze';

  btnBlackout.classList.toggle('active', isBlackout);
  btnBlackout.innerHTML = isBlackout
    ? `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg> Display 켜기`
    : `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/><line x1="2" y1="3" x2="22" y2="17"/></svg> Display 끄기`;

  btnFreeze.classList.toggle('active', isFreeze);
  btnFreeze.innerHTML = isFreeze
    ? `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg> Display 재개`
    : `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/></svg> Display 멈추기`;
}

function getCurrentMassTitle() {
  const m = cachedMasses.find(mass => String(mass.id) === String(currentMassId));
  return m ? (m.title || '') : '';
}

async function setDisplayMode(mode) {
  currentDisplayMode = mode;
  updateDisplayControlButtons();
  try {
    await provider.setPresentationState({
      massId: currentMassId,
      massTitle: getCurrentMassTitle(),
      slideId: currentSlideId,
      theme: document.body.getAttribute('data-theme') || 'dark',
      displayMode: mode,
    });
  } catch (err) {
    console.error('Failed to set display mode', err);
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

// ─────────────────────────────────────────────────
// 미사 목록 생성/수정 모달
// ─────────────────────────────────────────────────

function openNewMassModal() {
  openNewMassModalAsync().catch(err => {
    console.error('Failed to open new mass modal', err);
    alert('미사 목록을 불러오지 못했습니다.\n\n' + (err.message || err));
  });
}

async function openNewMassModalAsync() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  inputNewMassDate.value = todayStr;
  inputNewMassTitle.value = calculateLiturgicalTitle(todayStr);

  selectNewMassSource.innerHTML = '<option value="">선택 안함 (빈 전례)</option>';
  cachedMasses = asArray(await provider.getMasses());
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
  const date       = inputNewMassDate.value;
  const title      = inputNewMassTitle.value;
  const sourceMassId = selectNewMassSource.value;

  if (!date || !title) {
    alert('날짜와 제목을 모두 입력해주세요.');
    return;
  }

  btnModalCreate.disabled = true;
  btnModalCreate.textContent = '생성 중...';

  try {
    const newMass = await provider.createMass({ date, title, language: 'ko' }, sourceMassId);
    if (!newMass || !newMass.id) {
      throw new Error('서버에서 전례 데이터를 반환하지 않았습니다.');
    }

    cachedMasses = asArray(await provider.getMasses());
    populateMassSelect();

    currentMassId = newMass.id;
    domMassSelect.value = currentMassId;

    await loadSlidesForCurrentMass();
    closeNewMassModal();
  } catch (err) {
    console.error('Failed to create mass', err);
    alert('전례 생성에 실패했습니다.\n\n' + (err.message || err));
  } finally {
    btnModalCreate.disabled = false;
    btnModalCreate.textContent = '생성하기';
  }
}

// 미사 수정 모달
function openEditMassModal() {
  if (!currentMassId) {
    showCustomAlert('수정할 미사가 선택되지 않았습니다.');
    return;
  }

  const selectedMass = cachedMasses.find(m => String(m.id) === String(currentMassId));
  if (!selectedMass) return;

  inputEditMassDate.value = selectedMass.date || '';
  inputEditMassTitle.value = selectedMass.title || '';
  modalEditMass.classList.remove('hidden');
}

function closeEditMassModal() {
  modalEditMass.classList.add('hidden');
}

async function handleUpdateMass() {
  const date  = inputEditMassDate.value;
  const title = inputEditMassTitle.value;

  if (!date || !title) {
    alert('날짜와 제목을 모두 입력해주세요.');
    return;
  }

  btnModalEditSave.disabled = true;
  btnModalEditSave.textContent = '저장 중...';

  try {
    await provider.updateMass(currentMassId, { date, title });
    
    // 첫 번째 슬라이드가 있으면 제목과 날짜를 1번 슬라이드에 동기화
    if (slides && slides.length > 0) {
      const firstSlide = slides[0];
      const formattedDate = formatKoreanDate(date);
      const updates = {
        listTitle: '시작',
        title: title,
        contents: [{
          text: formattedDate,
          align: 'center',
          role: 'none',
          bold: true
        }],
        content: formattedDate
      };
      await provider.updateSlide(currentMassId, firstSlide.id, updates);
      Object.assign(firstSlide, updates);
      renderList();
      updatePreviewUI();
    }

    // 캐시 목록 갱신
    cachedMasses = asArray(await provider.getMasses());
    populateMassSelect();

    // 프레젠테이션 상태 갱신
    await provider.setPresentationState({
      massId: currentMassId,
      massTitle: getCurrentMassTitle(),
      slideId: currentSlideId,
      theme: document.body.getAttribute('data-theme') || 'dark',
      displayMode: currentDisplayMode,
    });

    closeEditMassModal();
    showCustomAlert('미사 정보가 수정되었습니다.');
  } catch (err) {
    console.error('Failed to update mass', err);
    alert('미사 정보 수정에 실패했습니다.\n\n' + (err.message || err));
  } finally {
    btnModalEditSave.disabled = false;
    btnModalEditSave.textContent = '저장하기';
  }
}

// ─────────────────────────────────────────────────
// 슬라이드 로드 & 렌더
// ─────────────────────────────────────────────────

async function loadSlidesForCurrentMass(targetSlideId = null, shouldBroadcast = true) {
  slides = asArray(await provider.getSlides(currentMassId));
  slides.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  // 항상 첫 번째 슬라이드를 '시작' 슬라이드로 강제 설정
  const currentMass = cachedMasses.find(m => String(m.id) === String(currentMassId));
  if (currentMass) {
    const formattedDate = formatKoreanDate(currentMass.date);
    const startSlideData = {
      listTitle: '시작',
      title: currentMass.title || '',
      contents: [{ text: formattedDate, align: 'center', role: 'none', bold: true }],
      content: formattedDate,
    };

    if (slides.length === 0) {
      // 슬라이드가 전혀 없으면 '시작' 슬라이드 새로 추가
      const added = await provider.addSlide(currentMassId, {
        ...startSlideData,
        sequence: 1,
        type: 'reading',
        enabled: true,
        hideTitle: false,
      });
      if (added) {
        slides = [{ ...added, ...startSlideData }];
      }
    } else {
      // 슬라이드가 있으면 첫 번째 슬라이드를 무조건 '시작' 내용으로 덮어씀
      const first = slides[0];
      await provider.updateSlide(currentMassId, first.id, startSlideData);
      Object.assign(first, startSlideData);
    }
  }

  if (targetSlideId && slides.find(s => s.id === targetSlideId)) {
    currentSlideId = targetSlideId;
  } else {
    currentSlideId = slides.length > 0 ? slides[0].id : null;
  }
  renderList();
  updatePreviewUI();
  if (shouldBroadcast) {
    await broadcastState();
  }
}

function setupThemeToggle() {
  window.updateControlThemeIcon = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const sunIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    const moonIcon = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    if (btnThemeToggle) {
      btnThemeToggle.innerHTML = isDark ? sunIcon : moonIcon;
      btnThemeToggle.title = isDark ? '밝은 테마로 전환' : '어두운 테마로 전환';
    }
    syncMobileMenuTheme();
  };
  window.updateControlThemeIcon();

  if (!btnThemeToggle) return;

  btnThemeToggle.addEventListener('click', async () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    window.updateControlThemeIcon();
    try {
      await broadcastState();
    } catch (err) {
      console.error('Failed to update theme state', err);
    }
  });
}

function renderList() {
  domSlideList.innerHTML = '';
  slides.forEach((slide, index) => {
    const li = document.createElement('li');
    li.className = 'slide-item';
    if (slide.id === currentSlideId) li.classList.add('active');

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
      if (dragPlaceholder.parentNode) dragPlaceholder.parentNode.removeChild(dragPlaceholder);
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

    li.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(); });

    const titleSpan = document.createElement('span');
    titleSpan.className = 'slide-title-text';
    titleSpan.textContent = (slide.listTitle !== undefined && slide.listTitle.trim() !== '')
      ? slide.listTitle : slide.title;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'slide-drag-handle';
    dragHandle.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
    dragHandle.title = '드래그하여 순서 변경';

    li.appendChild(titleSpan);
    li.appendChild(dragHandle);

    li.addEventListener('click', async () => {
      currentSlideId = slide.id;
      renderList();
      updatePreviewUI();
      if (currentAppMode === 'presentation') {
        await broadcastState();
      }
      // 모바일 화면에서는 항목 선택 시 진행 제어 탭으로 자동 복귀
      if (typeof window.switchToMobileControlTab === 'function') {
        window.switchToMobileControlTab();
      }
    });
    domSlideList.appendChild(li);
  });

  if (slides.length > 0) {
    const currentIndex = slides.findIndex(s => s.id === currentSlideId);
    domSlideCounter.textContent = `${currentIndex + 1} / ${slides.length}`;
  } else {
    domSlideCounter.textContent = '0 / 0';
  }
}

async function selectSlide(id, shouldBroadcast = true) {
  if (currentSlideId === id) return;
  currentSlideId = id;
  renderList();
  updatePreviewUI();
  if (shouldBroadcast) {
    await broadcastState();
  }
}

function nextSlide() {
  const currentIndex = slides.findIndex(s => s.id === currentSlideId);
  if (currentIndex >= 0 && currentIndex < slides.length - 1) {
    selectSlide(slides[currentIndex + 1].id, true);
  }
}

function prevSlide() {
  const currentIndex = slides.findIndex(s => s.id === currentSlideId);
  if (currentIndex > 0) {
    selectSlide(slides[currentIndex - 1].id, true);
  }
}

function setupKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (slides.length > 0) selectSlide(slides[0].id, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (slides.length > 0) selectSlide(slides[slides.length - 1].id, true);
    }
  });
}

// 순수 UI 렌더링 (Firestore 쓰기 없음)
function updatePreviewUI() {
  const currentIndex = slides.findIndex(s => s.id === currentSlideId);
  if (currentIndex === -1) return;

  const slide = slides[currentIndex];
  domSlideCounter.textContent = `${currentIndex + 1} / ${slides.length}`;
  domPreviewTitle.textContent = slide.title;
  if (domPreviewListTitle) {
    domPreviewListTitle.textContent = slide.listTitle !== undefined ? slide.listTitle : slide.title;
  }

  if (!slide.contents) {
    slide.contents = [{ text: slide.content || '', align: 'left', role: 'none' }];
  }

  const contentBlocks = document.querySelectorAll('.content-block');
  const visibleCount  = Math.max(1, slide.contents.length);

  contentBlocks.forEach((block, idx) => {
    const cData = slide.contents[idx] || { text: '', align: 'left', role: 'none' };
    if (idx < visibleCount) {
      block.classList.remove('content-block-hidden');
    } else {
      block.classList.add('content-block-hidden');
    }

    const p = block.querySelector('.preview-text');
    p.textContent = cData.text;
    p.setAttribute('data-align', cData.align);
    p.setAttribute('data-role', cData.role);
    p.setAttribute('data-bold', cData.bold ? 'true' : 'false');
    p.setAttribute('data-size', cData.size || 'normal');

    const roleSelect = block.querySelector('.role-select');
    roleSelect.value = cData.role;

    const sizeSelect = block.querySelector('.size-select');
    if (sizeSelect) {
      sizeSelect.value = cData.size || 'normal';
    }

    const colorPicker = block.querySelector('.color-picker');
    const colorClearBtn = block.querySelector('.color-clear-btn');
    if (colorPicker) {
      colorPicker.value = cData.color || '#ffffff';
      p.style.color = cData.color || '';
    }
    if (colorClearBtn) {
      colorClearBtn.classList.toggle('has-color', !!cData.color);
    }

    const alignBtns = block.querySelectorAll('.align-btn');
    alignBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-align') === cData.align);
    });

    const boldBtn = block.querySelector('.bold-btn');
    if (boldBtn) boldBtn.classList.toggle('active', !!cData.bold);
  });

  const btnAddContent = document.getElementById('btn-add-content');
  if (btnAddContent) {
    btnAddContent.disabled = visibleCount >= 10;
    btnAddContent.textContent = visibleCount >= 10 ? '본문 최대 10개' : '+ 본문 추가';
  }

  const btnHideTitle = document.getElementById('btn-hide-title');
  if (btnHideTitle) {
    const isHidden = !!slide.hideTitle;
    btnHideTitle.textContent = isHidden ? '제목 숨김' : '제목 표시';
    btnHideTitle.classList.toggle('title-hidden', isHidden);
  }

  const activeLi = domSlideList.querySelector('.active');
  if (activeLi) activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  updateContentEditable();
}

// Firestore 상태 전송 함수 (명시적 사용자 액션 시에만 호출)
async function broadcastState() {
  if (!currentMassId) return;
  try {
    await provider.setPresentationState({
      massId: currentMassId,
      massTitle: getCurrentMassTitle(),
      slideId: currentSlideId,
      theme: document.body.getAttribute('data-theme') || 'dark',
      displayMode: currentDisplayMode,
    });
  } catch (err) {
    console.error('Failed to broadcast presentation state', err);
  }
}

// 하위 호환용 래퍼
async function updatePreviewAndState() {
  updatePreviewUI();
  await broadcastState();
}

// ─────────────────────────────────────────────────
// Custom Modal
// ─────────────────────────────────────────────────

function showCustomModal(message, isConfirm = false) {
  return new Promise((resolve) => {
    const overlay    = document.getElementById('custom-modal-overlay');
    const msgEl      = document.getElementById('custom-modal-message');
    const btnCancel  = document.getElementById('custom-modal-cancel');
    const btnConfirm = document.getElementById('custom-modal-confirm');

    msgEl.textContent = message;
    if (isConfirm) {
      btnCancel.classList.remove('hidden');
    } else {
      btnCancel.classList.add('hidden');
    }
    overlay.classList.remove('hidden');

    const handleConfirm = () => { cleanup(); resolve(true); };
    const handleCancel  = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      overlay.classList.add('hidden');
      btnConfirm.removeEventListener('click', handleConfirm);
      btnCancel.removeEventListener('click', handleCancel);
    };

    btnConfirm.addEventListener('click', handleConfirm);
    btnCancel.addEventListener('click', handleCancel);
  });
}

const showCustomAlert   = (msg) => showCustomModal(msg, false);
const showCustomConfirm = (msg) => showCustomModal(msg, true);

// ─────────────────────────────────────────────────
// 인라인 편집 (control 전용)
// ─────────────────────────────────────────────────

function setupInlineEditing() {
  const domSaveStatus = document.getElementById('save-status');
  let saveTimer = null;
  const DEBOUNCE_MS = 1000;

  const showSaveStatus = (status, text) => {
    if (!domSaveStatus) return;
    domSaveStatus.textContent = text;
    domSaveStatus.className = 'save-status show ' + status;
    if (status === 'success') {
      setTimeout(() => { domSaveStatus.classList.remove('show'); }, 2000);
    }
  };

  const saveSlideUpdates = async (slide, updates) => {
    try {
      showSaveStatus('saving', '저장 중...');
      await provider.updateSlide(currentMassId, currentSlideId, updates);
      if (updates.title !== undefined || updates.listTitle !== undefined) renderList();
      // contents(글씨 크기 등) 변경도 display가 즉시 반영하도록 state 갱신
      await broadcastState();
      showSaveStatus('success', '✅ 저장됨');
    } catch (err) {
      console.error('Failed to save slide edit', err);
      showSaveStatus('error', '❌ 저장 실패');
    }
  };

  const executeEdit = (target) => {
    if (!currentSlideId) return;
    const currentIndex = slides.findIndex(s => s.id === currentSlideId);
    if (currentIndex === -1) return;
    const slide = slides[currentIndex];

    if (target.id === 'preview-list-title') {
      const newText = target.innerText;
      if (slide.listTitle !== newText) { slide.listTitle = newText; saveSlideUpdates(slide, { listTitle: newText }); }
      return;
    }
    if (target.id === 'preview-title') {
      const newText = target.innerText;
      if (slide.title !== newText) { slide.title = newText; saveSlideUpdates(slide, { title: newText }); }
      return;
    }
    if (target.classList.contains('preview-text')) {
      const block = target.closest('.content-block');
      const idx   = parseInt(block.getAttribute('data-index'), 10);
      const newText = target.innerText;
      if (!slide.contents) slide.contents = [];
      while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none' });
      if (slide.contents[idx].text !== newText) {
        slide.contents[idx].text = newText;
        saveSlideUpdates(slide, { contents: slide.contents });
      }
    }
  };

  const handleEdit  = (e) => { clearTimeout(saveTimer); executeEdit(e.target); };
  const handleInput = (e) => {
    clearTimeout(saveTimer);
    showSaveStatus('saving', '입력 중...');
    saveTimer = setTimeout(() => { executeEdit(e.target); }, DEBOUNCE_MS);
  };

  const contentPlaceholder = document.createElement('div');
  contentPlaceholder.className = 'content-block-placeholder';
  let draggedContentIndex = -1;
  let currentDropTargetIndex = -1;
  let dropPosition = 'after'; // 'before' | 'after'
  let isDraggingContent = false;

  const handleContentDrop = () => {
    if (!isDraggingContent || draggedContentIndex === -1) return;
    isDraggingContent = false;

    const fromIndex = draggedContentIndex;
    let toIndex = currentDropTargetIndex;

    if (contentPlaceholder.parentNode) {
      contentPlaceholder.parentNode.removeChild(contentPlaceholder);
    }
    const draggingEl = document.querySelector('.content-block.dragging');
    if (draggingEl) draggingEl.classList.remove('dragging');

    draggedContentIndex = -1;

    if (!currentSlideId) return;
    const ci = slides.findIndex(s => s.id === currentSlideId);
    if (ci === -1) return;
    const slide = slides[ci];
    if (!slide.contents || slide.contents.length <= 1) return;

    if (toIndex !== -1 && toIndex !== fromIndex) {
      if (dropPosition === 'before') {
        if (fromIndex < toIndex) toIndex--;
      } else if (dropPosition === 'after') {
        if (fromIndex > toIndex) toIndex++;
      }

      if (toIndex >= 0 && toIndex < slide.contents.length && toIndex !== fromIndex) {
        const moved = slide.contents.splice(fromIndex, 1)[0];
        slide.contents.splice(toIndex, 0, moved);

        saveSlideUpdates(slide, { contents: slide.contents }).then(() => {
          updatePreviewUI();
        });
      }
    }

    currentDropTargetIndex = -1;
  };

  contentPlaceholder.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  contentPlaceholder.addEventListener('drop', (e) => {
    e.preventDefault();
    handleContentDrop();
  });

  const previewContainer = document.getElementById('preview-contents-container');
  if (previewContainer) {
    previewContainer.addEventListener('dragover', (e) => {
      if (isDraggingContent) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
    });
    previewContainer.addEventListener('drop', (e) => {
      if (isDraggingContent) {
        e.preventDefault();
        handleContentDrop();
      }
    });
  }

  const contentBlocks = document.querySelectorAll('.content-block');
  contentBlocks.forEach(block => {
    const idx        = parseInt(block.getAttribute('data-index'), 10);
    const p          = block.querySelector('.preview-text');
    const roleSelect = block.querySelector('.role-select');
    const alignBtns  = block.querySelectorAll('.align-btn');
    const boldBtn    = block.querySelector('.bold-btn');
    const delBtn     = block.querySelector('.delete-block-btn');
    const dragHandle = block.querySelector('.content-drag-handle');

    p.addEventListener('blur', handleEdit);
    p.addEventListener('input', handleInput);

    if (dragHandle) {
      dragHandle.addEventListener('dragstart', (e) => {
        const ci = slides.findIndex(s => s.id === currentSlideId);
        if (ci === -1 || !slides[ci].contents || slides[ci].contents.length <= 1) {
          e.preventDefault();
          return;
        }

        isDraggingContent = true;
        draggedContentIndex = idx;
        currentDropTargetIndex = idx;
        dropPosition = 'after';

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));

        if (e.dataTransfer.setDragImage) {
          e.dataTransfer.setDragImage(block, 20, 20);
        }

        setTimeout(() => {
          block.classList.add('dragging');
          if (block.nextSibling) {
            block.parentNode.insertBefore(contentPlaceholder, block.nextSibling);
          } else {
            block.parentNode.appendChild(contentPlaceholder);
          }
        }, 0);
      });

      dragHandle.addEventListener('dragend', () => {
        isDraggingContent = false;
        block.classList.remove('dragging');
        if (contentPlaceholder.parentNode) {
          contentPlaceholder.parentNode.removeChild(contentPlaceholder);
        }
        draggedContentIndex = -1;
        currentDropTargetIndex = -1;
      });
    }

    block.addEventListener('dragover', (e) => {
      if (!isDraggingContent || draggedContentIndex === -1) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const ci = slides.findIndex(s => s.id === currentSlideId);
      if (ci === -1) return;
      const visibleCount = Math.max(1, slides[ci].contents ? slides[ci].contents.length : 1);
      if (idx >= visibleCount) return;

      const rect = block.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      currentDropTargetIndex = idx;

      if (e.clientY < midY) {
        dropPosition = 'before';
        block.parentNode.insertBefore(contentPlaceholder, block);
      } else {
        dropPosition = 'after';
        block.parentNode.insertBefore(contentPlaceholder, block.nextSibling);
      }
    });

    block.addEventListener('drop', (e) => {
      if (!isDraggingContent) return;
      e.preventDefault();
      handleContentDrop();
    });

    if (boldBtn) {
      boldBtn.addEventListener('click', () => {
        if (!currentSlideId) return;
        const ci = slides.findIndex(s => s.id === currentSlideId);
        if (ci === -1) return;
        const slide = slides[ci];
        if (!slide.contents) slide.contents = [];
        while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none', bold: false });
        slide.contents[idx].bold = !slide.contents[idx].bold;
        const isBold = !!slide.contents[idx].bold;
        p.setAttribute('data-bold', isBold ? 'true' : 'false');
        boldBtn.classList.toggle('active', isBold);
        saveSlideUpdates(slide, { contents: slide.contents });
      });
    }

    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (!currentSlideId) return;
        const ci = slides.findIndex(s => s.id === currentSlideId);
        if (ci === -1) return;
        const slide = slides[ci];
        if (!slide.contents || slide.contents.length <= 1) { showCustomAlert('최소 1개의 본문은 있어야 합니다.'); return; }
        showCustomConfirm('이 본문을 삭제하시겠습니까?').then((confirmed) => {
          if (confirmed) {
            slide.contents.splice(idx, 1);
            saveSlideUpdates(slide, { contents: slide.contents }).then(() => { updatePreviewAndState(slide); });
          }
        });
      });
    }

    roleSelect.addEventListener('change', (e) => {
      if (!currentSlideId) return;
      const ci = slides.findIndex(s => s.id === currentSlideId);
      if (ci === -1) return;
      const slide = slides[ci];
      if (!slide.contents) slide.contents = [];
      while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none' });
      slide.contents[idx].role = e.target.value;
      p.setAttribute('data-role', e.target.value);
      saveSlideUpdates(slide, { contents: slide.contents });
    });

    const sizeSelect = block.querySelector('.size-select');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        if (!currentSlideId) return;
        const ci = slides.findIndex(s => s.id === currentSlideId);
        if (ci === -1) return;
        const slide = slides[ci];
        if (!slide.contents) slide.contents = [];
        while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none' });
        slide.contents[idx].size = e.target.value;
        p.setAttribute('data-size', e.target.value);
        saveSlideUpdates(slide, { contents: slide.contents });
      });
    }

    alignBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!currentSlideId) return;
        const align = e.currentTarget.getAttribute('data-align');
        const ci    = slides.findIndex(s => s.id === currentSlideId);
        if (ci === -1) return;
        const slide = slides[ci];
        if (!slide.contents) slide.contents = [];
        while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none' });
        slide.contents[idx].align = align;
        p.setAttribute('data-align', align);
        alignBtns.forEach(b => b.classList.toggle('active', b === btn));
        saveSlideUpdates(slide, { contents: slide.contents });
      });
    });

    const colorPicker = block.querySelector('.color-picker');
    if (colorPicker) {
      const handleColorChange = (e) => {
        if (!currentSlideId) return;
        const ci = slides.findIndex(s => s.id === currentSlideId);
        if (ci === -1) return;
        const slide = slides[ci];
        if (!slide.contents) slide.contents = [];
        while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none' });
        
        const newColor = e.target.value;
        slide.contents[idx].color = newColor;
        p.style.color = newColor;
        saveSlideUpdates(slide, { contents: slide.contents });
      };
      
      colorPicker.addEventListener('input', handleColorChange);
      colorPicker.addEventListener('change', handleColorChange);
    }

    const colorClearBtn = block.querySelector('.color-clear-btn');
    if (colorClearBtn) {
      colorClearBtn.addEventListener('click', () => {
        if (!currentSlideId) return;
        const ci = slides.findIndex(s => s.id === currentSlideId);
        if (ci === -1) return;
        const slide = slides[ci];
        if (!slide.contents) slide.contents = [];
        while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none' });
        // 색상 제거: null 로 설정하면 테마 기본색(Dark/Light 자동) 적용
        slide.contents[idx].color = null;
        p.style.color = '';
        colorClearBtn.classList.remove('has-color');
        saveSlideUpdates(slide, { contents: slide.contents });
      });
    }
  });

  domPreviewTitle.addEventListener('blur', handleEdit);
  domPreviewTitle.addEventListener('input', handleInput);
  if (domPreviewListTitle) {
    domPreviewListTitle.addEventListener('blur', handleEdit);
    domPreviewListTitle.addEventListener('input', handleInput);
  }
}

// ─────────────────────────────────────────────────
// 슬라이드 추가/삭제
// ─────────────────────────────────────────────────

async function handleAddSlide() {
  const newSlideData = {
    sequence: slides.length + 1,
    type: 'reading',
    title: '새 슬라이드',
    listTitle: '새 슬라이드',
    content: '',
    contents: [{ text: '내용을 입력하세요', align: 'left', role: 'none' }],
    subtitle: '',
    notes: '',
  };
  try {
    const added = await provider.addSlide(currentMassId, newSlideData);
    if (added) await loadSlidesForCurrentMass(added.id);
  } catch (err) {
    console.error('Failed to add slide', err);
    showCustomAlert('슬라이드 추가에 실패했습니다: ' + (err.message || err));
  }
}

async function handleDeleteSlide() {
  if (!currentSlideId) return;
  const confirmed = await showCustomConfirm('현재 슬라이드를 삭제하시겠습니까?');
  if (!confirmed) return;
  try {
    await provider.deleteSlide(currentMassId, currentSlideId);
    await loadSlidesForCurrentMass();
  } catch (err) {
    console.error('Failed to delete slide', err);
    showCustomAlert('슬라이드 삭제에 실패했습니다.');
  }
}

function setupAddContentButton() {
  const btn = document.getElementById('btn-add-content');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!currentSlideId) return;
    const allBlocks = document.querySelectorAll('.content-block');
    let revealed = false;
    allBlocks.forEach(block => {
      if (!revealed && block.classList.contains('content-block-hidden')) {
        block.classList.remove('content-block-hidden');
        revealed = true;
        const ci = slides.findIndex(s => s.id === currentSlideId);
        if (ci !== -1) {
          const slide = slides[ci];
          if (!slide.contents) slide.contents = [];
          const idx = parseInt(block.getAttribute('data-index'), 10);
          while (slide.contents.length <= idx) slide.contents.push({ text: '', align: 'left', role: 'none' });
        }
        block.querySelector('.preview-text').focus();
      }
    });
    const visibleCount = document.querySelectorAll('.content-block:not(.content-block-hidden)').length;
    btn.disabled = visibleCount >= 10;
    btn.textContent = visibleCount >= 10 ? '본문 최대 10개' : '+ 본문 추가';
  });
}

function setupHideTitleButton() {
  const btn = document.getElementById('btn-hide-title');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!currentSlideId) return;
    const ci = slides.findIndex(s => s.id === currentSlideId);
    if (ci === -1) return;
    const slide = slides[ci];
    slide.hideTitle = !slide.hideTitle;
    btn.textContent = slide.hideTitle ? '제목 숨김' : '제목 표시';
    btn.classList.toggle('title-hidden', slide.hideTitle);
    try {
      await provider.updateSlide(currentMassId, currentSlideId, { hideTitle: slide.hideTitle });
      if (currentAppMode === 'presentation') {
        await broadcastState();
      }
    } catch (err) {
      console.error('Failed to save hideTitle', err);
    }
  });
}

// ─────────────────────────────────────────────────
// 검색 가능한 미사 콤보박스 (Searchable Mass Combobox)
// ─────────────────────────────────────────────────

function isWithinOneMonth(dateStr) {
  if (!dateStr) return false;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthAgo = new Date(today);
    oneMonthAgo.setDate(today.getDate() - 31);

    const oneMonthLater = new Date(today);
    oneMonthLater.setDate(today.getDate() + 31);

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return targetDate >= oneMonthAgo && targetDate <= oneMonthLater;
    }
  } catch (e) {}
  return false;
}

function setupMassCombobox() {
  if (!massComboboxEl || !massComboboxTrigger || !massDropdownMenuEl) return;

  // 트리거 클릭 시 드롭다운 토글
  massComboboxTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = massComboboxEl.classList.contains('open');
    if (isOpen) {
      closeMassDropdown();
    } else {
      openMassDropdown();
    }
  });

  // 검색창 입력 이벤트
  if (massSearchInputEl) {
    massSearchInputEl.addEventListener('input', (e) => {
      massSearchQuery = e.target.value.trim().toLowerCase();
      renderMassDropdown();
    });
    massSearchInputEl.addEventListener('click', (e) => e.stopPropagation());
  }

  // 필터 탭 (최근 ±1달 vs 전체)
  if (tabFilterRecent && tabFilterAll) {
    tabFilterRecent.addEventListener('click', (e) => {
      e.stopPropagation();
      massFilterMode = 'recent';
      tabFilterRecent.classList.add('active');
      tabFilterAll.classList.remove('active');
      renderMassDropdown();
    });

    tabFilterAll.addEventListener('click', (e) => {
      e.stopPropagation();
      massFilterMode = 'all';
      tabFilterAll.classList.add('active');
      tabFilterRecent.classList.remove('active');
      renderMassDropdown();
    });
  }

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', (e) => {
    if (!massComboboxEl.contains(e.target)) {
      closeMassDropdown();
    }
  });

  // Esc 키 입력 시 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && massComboboxEl.classList.contains('open')) {
      closeMassDropdown();
    }
  });
}

function openMassDropdown() {
  massComboboxEl.classList.add('open');
  massDropdownMenuEl.classList.remove('hidden');
  massComboboxTrigger.setAttribute('aria-expanded', 'true');
  renderMassDropdown();
  if (massSearchInputEl) {
    massSearchInputEl.value = '';
    massSearchQuery = '';
    setTimeout(() => massSearchInputEl.focus(), 50);
  }
}

function closeMassDropdown() {
  massComboboxEl.classList.remove('open');
  massDropdownMenuEl.classList.add('hidden');
  massComboboxTrigger.setAttribute('aria-expanded', 'false');
}

function renderMassDropdown() {
  if (!massDropdownListEl) return;
  massDropdownListEl.innerHTML = '';

  let filtered = cachedMasses.filter(m => {
    // 1. 검색어 필터링
    if (massSearchQuery) {
      const titleMatch = (m.title || '').toLowerCase().includes(massSearchQuery);
      const dateMatch  = (m.date || '').toLowerCase().includes(massSearchQuery);
      return titleMatch || dateMatch;
    }
    // 2. 검색어가 없을 때는 최근 1달 필터 적용 (단, 현재 선택된 미사는 항상 목록에 노출)
    if (massFilterMode === 'recent') {
      if (String(m.id) === String(currentMassId)) return true;
      return isWithinOneMonth(m.date);
    }
    return true;
  });

  if (filtered.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'mass-dropdown-empty';
    emptyLi.textContent = massSearchQuery ? '일치하는 미사가 없습니다.' : '최근 ±1달 이내의 미사가 없습니다.';
    massDropdownListEl.appendChild(emptyLi);
    return;
  }

  filtered.forEach(m => {
    const li = document.createElement('li');
    li.className = 'mass-dropdown-item';
    if (String(m.id) === String(currentMassId)) {
      li.classList.add('selected');
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'mass-dropdown-item-title';
    titleSpan.textContent = m.title;

    const dateSpan = document.createElement('span');
    dateSpan.className = 'mass-dropdown-item-date';
    dateSpan.textContent = m.date;

    li.appendChild(titleSpan);
    li.appendChild(dateSpan);

    li.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (currentMassId !== m.id) {
        currentMassId = m.id;
        populateMassSelect();
        const shouldBroadcast = currentAppMode === 'presentation';
        await loadSlidesForCurrentMass(null, shouldBroadcast);
      }
      closeMassDropdown();
    });

    massDropdownListEl.appendChild(li);
  });
}

function populateMassSelect() {
  // 1. 콤보박스 선택 텍스트 갱신
  const selected = cachedMasses.find(m => String(m.id) === String(currentMassId));
  if (massSelectedTextEl) {
    if (selected) {
      massSelectedTextEl.textContent = formatMassOptionText(selected);
      massSelectedTextEl.title = formatMassOptionText(selected);
    } else {
      massSelectedTextEl.textContent = '미사 선택...';
      massSelectedTextEl.title = '';
    }
  }

  // 2. 하위 호환 네이티브 select 동기화
  if (domMassSelect) {
    domMassSelect.innerHTML = '';
    cachedMasses.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = formatMassOptionText(m);
      domMassSelect.appendChild(option);
    });
    domMassSelect.value = currentMassId;
  }

  // 3. 드롭다운 뷰 갱신
  renderMassDropdown();
}

async function handleDeleteMass() {
  if (!currentMassId) return;
  if (cachedMasses.length <= 1) {
    showCustomAlert('최소 1개의 미사는 유지되어야 하므로 삭제할 수 없습니다.');
    return;
  }
  const selectedMass = cachedMasses.find(m => String(m.id) === String(currentMassId));
  const massTitle = selectedMass ? selectedMass.title : '선택된 미사';
  const confirmed = await showCustomConfirm(`'${massTitle}' 미사를 정말 삭제하시겠습니까?`);
  if (!confirmed) return;

  try {
    await provider.deleteMass(currentMassId);
    cachedMasses = asArray(await provider.getMasses());
    currentMassId = cachedMasses.length > 0 ? cachedMasses[0].id : null;
    populateMassSelect();
    if (currentMassId) await loadSlidesForCurrentMass();
    showCustomAlert('미사가 삭제되었습니다.');
  } catch (err) {
    console.error('Failed to delete mass', err);
    showCustomAlert('미사 삭제에 실패했습니다.');
  }
}
