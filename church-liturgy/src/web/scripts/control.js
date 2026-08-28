// control.js
// 관리자 전용 (Google 로그인 + admins 권한 체크)

import { getProvider } from './services/index.js';
import { onAuthStateChanged, signInWithGoogle, signOut, checkIsAdmin } from '../../auth.js';

const provider = getProvider();

let currentMassId = '1';
let currentSlideId = null;
let slides = [];
let massInfo = null;

// onSnapshot 구독 해제 함수
let unsubscribeState = null;

// DOM Elements
const domMassSelect    = document.getElementById('mass-select');
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
}

// ─────────────────────────────────────────────────
// 앱 진입점
// ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // 앱 영역 숨기고 로그인 체크 시작
  if (appMain) appMain.style.display = 'none';
  if (loginOverlay) loginOverlay.style.display = 'flex';

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

  // 로그아웃 버튼 (상단 및 권한없음 화면)
  const handleLogout = async () => {
    try {
      if (btnNoAccessLogout) {
        btnNoAccessLogout.disabled = true;
        btnNoAccessLogout.textContent = '로그아웃 중...';
      }
      if (btnLogout) {
        btnLogout.disabled = true;
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
      if (userInfoEl) userInfoEl.style.display = 'none';
      showLoginOverlay(false);
    }
  };

  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
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

  if (fromIndex !== toIndex && toIndex >= 0) {
    dragPlaceholder.parentNode.insertBefore(draggedItem, dragPlaceholder);
    draggedItem.classList.remove('dragging');
    if (dragPlaceholder.parentNode) {
      dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    }

    const slideIds = slides.map(s => String(s.id));
    provider.reorderSlides(currentMassId, slideIds).catch(err => {
      console.error('Failed to reorder slides', err);
      alert('순서 저장에 실패했습니다.');
    });
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
// 앱 초기화 (로그인 후)
// ─────────────────────────────────────────────────

async function initApp() {
  setupMobileTabs();
  setupThemeToggle();
  setupKeyboardControls();
  setupInlineEditing();
  setupAddContentButton();
  setupHideTitleButton();

  try {
    cachedMasses = asArray(await provider.getMasses());

    domMassSelect.innerHTML = '';
    cachedMasses.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = formatMassOptionText(m);
      domMassSelect.appendChild(option);
    });

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

    domMassSelect.value = currentMassId;
    
    // 초기 로드 시에는 다른 클라이언트에 덮어쓰지 않도록 shouldBroadcast = false 전달
    await loadSlidesForCurrentMass(targetSlideId, false);

    domMassSelect.addEventListener('change', async (e) => {
      currentMassId = e.target.value;
      await loadSlidesForCurrentMass(null, true);
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

  setupDisplayControls();
}

// ─────────────────────────────────────────────────
// 모바일 탭 제어 (진행 제어 vs 목록/편집)
// ─────────────────────────────────────────────────

function setupMobileTabs() {
  const tabBtnControl = document.getElementById('tab-btn-control');
  const tabBtnList    = document.getElementById('tab-btn-list');
  const appContainer  = document.getElementById('app-main');

  if (!tabBtnControl || !tabBtnList || !appContainer) return;

  const setMobileTab = (tab) => {
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

  // 기본 상태: 진행 제어 모드
  setMobileTab('control');
  window.switchToMobileControlTab = () => setMobileTab('control');
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

async function setDisplayMode(mode) {
  currentDisplayMode = mode;
  updateDisplayControlButtons();
  try {
    await provider.setPresentationState({
      massId: currentMassId,
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
  inputNewMassDate.value = new Date().toISOString().split('T')[0];
  inputNewMassTitle.value = '';

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
    
    // 캐시 목록 갱신
    cachedMasses = asArray(await provider.getMasses());
    populateMassSelect();

    // 프레젠테이션 상태 갱신
    await provider.setPresentationState({
      massId: currentMassId,
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
    btnThemeToggle.innerHTML = isDark ? sunIcon : moonIcon;
    btnThemeToggle.title = isDark ? '밝은 테마로 전환' : '어두운 테마로 전환';
  };
  window.updateControlThemeIcon();

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
      await broadcastState();
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
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
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

    const roleSelect = block.querySelector('.role-select');
    roleSelect.value = cData.role;

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
}

// Firestore 상태 전송 함수 (명시적 사용자 액션 시에만 호출)
async function broadcastState() {
  if (!currentMassId) return;
  try {
    await provider.setPresentationState({
      massId: currentMassId,
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
      await provider.setPresentationState({
        massId: currentMassId,
        slideId: currentSlideId,
        theme: document.body.getAttribute('data-theme') || 'dark',
        displayMode: currentDisplayMode,
      });
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

  const contentBlocks = document.querySelectorAll('.content-block');
  contentBlocks.forEach(block => {
    const idx      = parseInt(block.getAttribute('data-index'), 10);
    const p        = block.querySelector('.preview-text');
    const roleSelect = block.querySelector('.role-select');
    const alignBtns  = block.querySelectorAll('.align-btn');
    const boldBtn    = block.querySelector('.bold-btn');
    const delBtn     = block.querySelector('.delete-block-btn');

    p.addEventListener('blur', handleEdit);
    p.addEventListener('input', handleInput);

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
      await provider.setPresentationState({
        massId: currentMassId,
        slideId: currentSlideId,
        theme: document.body.getAttribute('data-theme') || 'dark',
        displayMode: currentDisplayMode,
      });
    } catch (err) {
      console.error('Failed to save hideTitle', err);
    }
  });
}

// ─────────────────────────────────────────────────
// 미사 삭제
// ─────────────────────────────────────────────────

function populateMassSelect() {
  domMassSelect.innerHTML = '';
  cachedMasses.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = formatMassOptionText(m);
    domMassSelect.appendChild(option);
  });
  domMassSelect.value = currentMassId;
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
