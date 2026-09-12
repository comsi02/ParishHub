// main.js
// church-catechesis 주일학교 & 은총표 관리 애플리케이션 진입점
// v2 - 통합 Person 모델 + 자유 합반(Class) 구조 + Google 인증 및 관리자 승인 체계

import { dataProvider } from './services/DataProvider.js';
import { GRADES, GRADE_SORT_MAP, DEPARTMENTS, PERSON_ROLES, getRecentSaturday, AVAILABLE_SEASONS, getCurrentSeasonId } from './mock/sampleData.js';
import {
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
  maskKoreanName,
  maskBaptismalName,
  maskTeacherName,
  maskPhoneNumber,
  getAllUsers,
  approveUser,
  rejectUser,
  setLocalDemoUserRole
} from './services/auth.js';

// --- State ---
let currentTab = 'dashboard';
let currentAttGradeFilter = 'all';
let currentGraceGradeFilter = 'all';
let currentDirectoryView = 'students'; // 'students' | 'parents' | 'teachers' | 'classes'
let currentUser = null;
let currentUserProfile = null;

function isUserApproved() {
  return Boolean(currentUserProfile && currentUserProfile.isApproved);
}

function isUserAdmin() {
  return Boolean(currentUserProfile && currentUserProfile.isAdmin);
}

// --- DOM References ---
const navTabs = document.querySelectorAll('.nav-tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const toastContainer = document.getElementById('toastContainer');
const btnResetData = document.getElementById('btnResetData');

// --- Helper Functions ---
function getSaturdayDateString() {
  return getRecentSaturday(0);
}

function getTodayDateString() {
  return dataProvider.getPreferredAttendanceDate();
}

// 실제 오늘 날짜 (YYYY-MM-DD) — 모달 기본값 등에 사용
function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fill mobile card list sibling (hidden on desktop via CSS). */
function setMobileCards(el, html) {
  if (el) el.innerHTML = html;
}

function emptyMobileCards(msg) {
  return `<div class="mobile-card-empty">${msg}</div>`;
}

/** Bind click handlers on the same selector across table body + card list. */
function bindInRoots(roots, selector, handler) {
  roots.filter(Boolean).forEach(root => {
    root.querySelectorAll(selector).forEach(el => el.addEventListener('click', handler));
  });
}

function populateSeasonSelects() {
  const optionsHtml = AVAILABLE_SEASONS.map(s =>
    `<option value="${s.id}"${s.isCurrent ? ' selected' : ''}>🎓 ${s.label}</option>`
  ).join('');

  const scheduleFilter = document.getElementById('scheduleSeasonFilter');
  if (scheduleFilter) {
    scheduleFilter.innerHTML = optionsHtml + '<option value="all">전체 시즌</option>';
    scheduleFilter.value = getCurrentSeasonId();
  }

  const statsSelect = document.getElementById('statsSeasonSelect');
  if (statsSelect) {
    statsSelect.innerHTML = optionsHtml;
    statsSelect.value = getCurrentSeasonId();
  }

  const scheduleModalSeason = document.getElementById('newScheduleSeason');
  if (scheduleModalSeason) {
    scheduleModalSeason.innerHTML = AVAILABLE_SEASONS.map(s => {
      const [startY, endY] = s.id.split('-');
      return `<option value="${s.id}"${s.isCurrent ? ' selected' : ''}>${s.id} 시즌 (${startY}.09 ~ ${endY}.06)</option>`;
    }).join('');
  }
}

function updateSeasonHeaderBadge() {
  const badge = document.getElementById('seasonHeaderBadge');
  if (!badge) return;
  const seasonId = getCurrentSeasonId();
  const season = AVAILABLE_SEASONS.find(s => s.id === seasonId);
  badge.textContent = season ? season.label.replace(/ \(.*\)$/, '') : `${seasonId} 학년도`;
  badge.title = `주일학교 시즌: 매년 9월 ~ 이듬해 6월 (${seasonId})`;
}

function updateAttendanceScheduleHint(selectedDate) {
  const hint = document.getElementById('attScheduleHint');
  if (!hint) return;

  const sch = dataProvider.getScheduleByDate(selectedDate);
  const schoolDay = dataProvider.isSchoolDay(selectedDate);

  if (schoolDay === true) {
    hint.style.display = 'block';
    hint.className = 'att-schedule-hint att-schedule-hint--school';
    hint.innerHTML = `🏫 <strong>수업일</strong> — ${sch?.title || '주일학교 모임'}${sch?.notes ? ` · ${sch.notes}` : ''}`;
  } else if (schoolDay === false) {
    hint.style.display = 'block';
    hint.className = 'att-schedule-hint att-schedule-hint--holiday';
    hint.innerHTML = `❄️ <strong>휴교일</strong> — ${sch?.title || '연휴/방학'} (출석 체크는 가능하지만 통계 수업일에는 포함되지 않습니다)`;
  } else {
    hint.style.display = 'block';
    hint.className = 'att-schedule-hint att-schedule-hint--unknown';
    hint.innerHTML = `📅 학사 일정에 없는 날짜입니다. <a href="#" id="attHintGotoSchedule">학사 일정</a>에 등록하면 D-Day·통계와 연동됩니다.`;
    hint.querySelector('#attHintGotoSchedule')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('[data-tab="schedule"]')?.click();
    });
  }
}

function showToast(message, icon = '✅') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

// 모달 닫기 이벤트 등록
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    closeModal(modalId);
  });
});

// 학년 → 반 이름 조회 헬퍼
function getClassNameForGrade(grade) {
  const classes = dataProvider.getClasses();
  const cls = classes.find(c => c.grades && c.grades.includes(grade));
  return cls ? cls.name : grade;
}

// 학년 필터 매칭 헬퍼 (출석/은총표 탭용 전통적 그룹 필터)
function matchGradeGroup(grade, group) {
  if (group === 'all') return true;
  const sortOrder = GRADE_SORT_MAP[grade] ?? 99;
  if (group === 'kinder') return sortOrder <= 1;         // JK, SK
  if (group === 'elementary') return sortOrder >= 2 && sortOrder <= 7;  // G1-G6
  if (group === 'youth') return sortOrder >= 8;          // G7-G12
  return true;
}

// 역할 한글 레이블 목록 (복수 역할 대응)
function getRoleLabels(person) {
  return (person.roles || []).map(r => PERSON_ROLES[r]?.label || r);
}

// 주 교사 역할 레이블
function getPrimaryRoleLabel(person) {
  const info = dataProvider.getPrimaryTeacherRole(person);
  return info ? info.label : (PERSON_ROLES[person.roles?.[0]]?.label || person.roles?.[0] || '-');
}

// ============================================================
//  User Detail Modal
// ============================================================
function showUserDetail(type, id) {
  if (!isUserApproved()) {
    showToast('🔒 주일학교 교사 및 승인된 회원만 상세 정보를 열람하실 수 있습니다.', '🔒');
    return;
  }

  const modal = document.getElementById('modalUserDetail');
  if (!modal) return;

  const avatar = document.getElementById('userDetailAvatar');
  const nameEl = document.getElementById('userDetailName');
  const badgeEl = document.getElementById('userDetailBadge');
  const subEl = document.getElementById('userDetailSub');
  const gridEl = document.getElementById('userDetailGrid');

  const person = dataProvider.getPersonById(id);
  if (!person) return;

  // --- 학생 상세 ---
  if (type === 'student') {
    const st = dataProvider.getStudentById(id);
    if (!st) return;
    const parents = dataProvider.getParentsOfStudent(id);

    document.getElementById('userDetailTitle').textContent = '🧒 학생 상세 정보';
    avatar.textContent = st.name.charAt(0);
    nameEl.textContent = st.name;
    badgeEl.className = 'badge badge-grade';
    badgeEl.textContent = st.studentInfo?.grade || '-';
    subEl.textContent = `세례명: ${st.baptismalName || '미등록'} ${st.studentInfo?.feastDay ? `• 축일: ${st.studentInfo.feastDay}` : ''}`;

    // 학부모 정보 HTML
    let parentHtml = '<span style="color: var(--text-muted);">등록된 학부모 정보가 없습니다.</span>';
    if (parents.length > 0) {
      parentHtml = parents.map((p, idx) => {
        const teacherRoles = dataProvider.getTeacherRoles();
        const isTeacher = p.roles && p.roles.some(r => teacherRoles.includes(r));
        const roleBadge = isTeacher
          ? `<span class="badge badge-sacrament" style="font-size: 0.7rem; padding: 0.1rem 0.35rem;">${getPrimaryRoleLabel(p)}</span>`
          : '';
        return `
          <div>
            <strong>${idx === 0 ? '학부모 1' : '학부모 2'}:</strong>
            <span class="clickable-name" data-detail-type="parent" data-detail-id="${p.id}">${p.name}</span>
            ${p.baptismalName ? `(${p.baptismalName})` : ''} ${roleBadge}
            • 📞 <a href="tel:${p.phone}">${p.phone}</a>
          </div>
        `;
      }).join('');
      const firstParent = parents[0];
      if (firstParent.address) {
        parentHtml += `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.1rem;">📍 주소: ${firstParent.address}</div>`;
      }
    }

    const si = st.studentInfo || {};
    const className = getClassNameForGrade(si.grade || '');

    gridEl.innerHTML = `
      <div class="detail-item">
        <div class="detail-label">성별</div>
        <div class="detail-value">${si.gender || '-'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">반 (소속)</div>
        <div class="detail-value"><span class="badge badge-grade">${si.grade || '-'}</span> ${className !== si.grade ? `<span style="color: var(--text-muted); font-size: 0.82rem;">(${className})</span>` : ''}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">보유 은총표</div>
        <div class="detail-value" style="color: #b45309; font-weight: 700;">🪙 ${(st.totalGracePoints || 0).toLocaleString()} P</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">첫영성체</div>
        <div class="detail-value">${si.firstCommunion ? '✅ 수품 완료' : '미수품'}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">견진성사</div>
        <div class="detail-value">${si.confirmation ? '✅ 수품 완료' : '미수품'}</div>
      </div>
      <div class="detail-item detail-item-full">
        <div class="detail-label">활동 부서</div>
        <div class="detail-value">${(si.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join(' ') || '소속 부서 없음'}</div>
      </div>
      <div class="detail-item detail-item-full">
        <div class="detail-label">학부모 정보 (클릭 시 상세 조회)</div>
        <div class="detail-value">${parentHtml}</div>
      </div>
      <div class="detail-item detail-item-full">
        <div class="detail-label">메모 및 특이사항</div>
        <div class="detail-value" style="font-size: 0.88rem; color: var(--text-muted);">${st.notes || '기록된 메모 없음'}</div>
      </div>
    `;
  }

  // --- 교사 상세 ---
  else if (type === 'teacher') {
    document.getElementById('userDetailTitle').textContent = '✝️ 교사 상세 정보';
    avatar.textContent = person.name.charAt(0);
    nameEl.textContent = person.name;
    const primaryRole = dataProvider.getPrimaryTeacherRole(person);
    badgeEl.className = primaryRole?.role === 'principal' ? 'badge badge-sacrament' :
                        primaryRole?.role === 'vice_principal' ? 'badge badge-grade' : 'badge badge-present';
    badgeEl.textContent = primaryRole?.label || '교사';
    subEl.textContent = `세례명: ${person.baptismalName || '미등록'}`;

    // 담당 반 표시
    const classes = dataProvider.getClasses();
    const assignedClasses = (person.teacherInfo?.assignedClassIds || [])
      .map(cid => classes.find(c => c.id === cid))
      .filter(Boolean);

    // 학부모 겸임 시 자녀 목록
    let childrenSection = '';
    if (person.roles?.includes('parent') && person.parentInfo?.childPersonIds?.length > 0) {
      const children = person.parentInfo.childPersonIds
        .map(cid => dataProvider.getStudentById(cid))
        .filter(Boolean);
      if (children.length > 0) {
        const chList = children.map(c => `
          <div style="margin-top: 0.25rem;">
            🧒 <span class="clickable-name" data-detail-type="student" data-detail-id="${c.id}">${c.name}</span>
            (${c.baptismalName || '세례명 없음'}, <span class="badge badge-grade" style="font-size: 0.7rem;">${c.studentInfo?.grade || '-'}</span>)
            • 🪙 ${c.totalGracePoints} P
          </div>
        `).join('');
        childrenSection = `
          <div class="detail-item detail-item-full" style="background: #eff6ff; border: 1px solid #bfdbfe;">
            <div class="detail-label" style="color: #1e40af; font-weight: 700;">👨‍👩‍👧 학부모 겸임 (재학 자녀)</div>
            <div class="detail-value">${chList}</div>
          </div>
        `;
      }
    }

    // 특수 역할 뱃지들
    const specialRoleBadges = (person.roles || [])
      .filter(r => ['liturgy_teacher', 'acolyte_teacher'].includes(r))
      .map(r => `<span class="badge badge-sacrament" style="font-size: 0.78rem;">${PERSON_ROLES[r]?.label || r}</span>`)
      .join(' ');

    gridEl.innerHTML = `
      <div class="detail-item">
        <div class="detail-label">역할</div>
        <div class="detail-value">
          ${primaryRole?.label || '-'}
          ${specialRoleBadges ? `<div style="margin-top: 0.25rem;">${specialRoleBadges}</div>` : ''}
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">담당 반</div>
        <div class="detail-value">
          ${assignedClasses.length > 0
            ? assignedClasses.map(c => `<div><span class="badge badge-grade">${c.name}</span> <span style="font-size: 0.78rem; color: var(--text-muted);">${c.grades.join(', ')}</span></div>`).join('')
            : '<span style="color: var(--text-muted);">전체 관할</span>'}
        </div>
      </div>
      <div class="detail-item detail-item-full">
        <div class="detail-label">연락처</div>
        <div class="detail-value">📞 <a href="tel:${person.phone}">${person.phone || '-'}</a></div>
      </div>
      ${person.email ? `
      <div class="detail-item detail-item-full">
        <div class="detail-label">이메일</div>
        <div class="detail-value">✉️ <a href="mailto:${person.email}">${person.email}</a></div>
      </div>` : ''}
      ${childrenSection}
    `;
  }

  // --- 학부모 상세 ---
  else if (type === 'parent') {
    document.getElementById('userDetailTitle').textContent = '👨‍👩‍👧 학부모 상세 정보';
    avatar.textContent = person.name.charAt(0);
    nameEl.textContent = person.name;
    badgeEl.className = 'badge badge-present';

    // 교사 겸임 여부 확인
    const teacherRoles = dataProvider.getTeacherRoles();
    const isTeacher = person.roles && person.roles.some(r => teacherRoles.includes(r));
    badgeEl.textContent = isTeacher ? `학부모 (${getPrimaryRoleLabel(person)} 겸임)` : '학부모';
    subEl.textContent = `세례명: ${person.baptismalName || '미등록'}`;

    // 학부모 1 정보 (동일 포맷)
    const parent1Html = `
      <div>
        <strong style="font-size: 0.95rem;">${person.name}</strong>
        ${person.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.85rem;">(${person.baptismalName})</span>` : ''}
        ${isTeacher ? `<span class="badge badge-sacrament" style="font-size: 0.7rem; margin-left: 0.25rem;">${getPrimaryRoleLabel(person)}</span>` : ''}
      </div>
      ${person.phone ? `<div style="font-size: 0.85rem; margin-top: 0.35rem;">📞 <a href="tel:${person.phone}" style="color: var(--primary); font-weight: 600;">${person.phone}</a></div>` : '<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">연락처 미등록</div>'}
    `;

    // 학부모 2 정보 (동일 포맷)
    let parent2Html = '<span style="color: var(--text-muted);">미등록 (한 분만 등록)</span>';
    const spouseId = person.parentInfo?.spousePersonId;
    if (spouseId) {
      const spouse = dataProvider.getPersonById(spouseId);
      if (spouse) {
        const spouseTeacher = spouse.roles && spouse.roles.some(r => teacherRoles.includes(r));
        const spouseBadge = spouseTeacher
          ? `<span class="badge badge-sacrament" style="font-size: 0.7rem; margin-left: 0.25rem;">${getPrimaryRoleLabel(spouse)}</span>`
          : '';
        parent2Html = `
          <div>
            <span class="clickable-name" data-detail-type="parent" data-detail-id="${spouse.id}"><strong style="font-size: 0.95rem;">${spouse.name}</strong></span>
            ${spouse.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.85rem;">(${spouse.baptismalName})</span>` : ''}
            ${spouseBadge}
          </div>
          ${spouse.phone ? `<div style="font-size: 0.85rem; margin-top: 0.35rem;">📞 <a href="tel:${spouse.phone}" style="color: var(--primary); font-weight: 600;">${spouse.phone}</a></div>` : '<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">연락처 미등록</div>'}
        `;
      }
    }

    // 자녀 목록
    const children = (person.parentInfo?.childPersonIds || [])
      .map(cid => dataProvider.getStudentById(cid))
      .filter(Boolean);
    const childrenHtml = children.length > 0
      ? children.map(ch => `
          <div style="margin-top: 0.35rem;">
            🧒 <span class="clickable-name" data-detail-type="student" data-detail-id="${ch.id}">${ch.name}</span>
            (${ch.baptismalName || '세례명 없음'}, <span class="badge badge-grade" style="font-size: 0.72rem;">${ch.studentInfo?.grade || '-'}</span>)
            • 🪙 ${ch.totalGracePoints} P
          </div>
        `).join('')
      : '등록된 자녀가 없습니다.';

    gridEl.innerHTML = `
      <div class="detail-item">
        <div class="detail-label">학부모 1</div>
        <div class="detail-value">${parent1Html}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">학부모 2</div>
        <div class="detail-value">${parent2Html}</div>
      </div>
      <div class="detail-item detail-item-full">
        <div class="detail-label">자택 주소</div>
        <div class="detail-value">📍 ${person.address || '주소 미등록'}</div>
      </div>
      <div class="detail-item detail-item-full">
        <div class="detail-label">등록 자녀 목록 (클릭 시 학생 정보 조회)</div>
        <div class="detail-value">${childrenHtml}</div>
      </div>
    `;
  }

  openModal('modalUserDetail');
}

// ============================================================
//  Google Auth, Admin Approval & Permission Guard Helpers
// ============================================================
function getAccessLockedHtml(tabTitle) {
  if (!currentUser) {
    return `
      <div class="access-locked-card">
        <div class="locked-icon">🔒</div>
        <h3>${tabTitle}은(는) 승인된 교사 전용 화면입니다</h3>
        <p>
          주일학교 학생들의 출석 체크, 은총표 관리 및 명부 열람은 개인정보 보호를 위해 승인된 교사 및 관리자만 이용할 수 있습니다.
        </p>
        <button class="btn btn-primary btn-locked-action btn-login-trigger">
          <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Google 계정으로 로그인하기
        </button>
      </div>
    `;
  } else {
    const name = currentUserProfile?.displayName || currentUser.displayName || '회원';
    const email = currentUserProfile?.email || currentUser.email || '';
    return `
      <div class="access-locked-card pending">
        <div class="locked-icon">⏳</div>
        <h3>가입 승인 심사 중입니다</h3>
        <p>
          <strong>${name}</strong> (${email}) 님의 가입 신청이 접수되었습니다.<br/>
          본당 주일학교 관리자(교장/교감/교사회)의 승인 완료 후 ${tabTitle} 기능을 정상적으로 이용하실 수 있습니다.
        </p>
        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
          <span class="role-badge-tag role-badge-pending">상태: 승인 대기</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">신청일: ${new Date(currentUserProfile?.requestedAt || Date.now()).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    `;
  }
}

async function handleGoogleLogin() {
  try {
    const btn = document.getElementById('btnGoogleLogin');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳ 로그인 중...</span>`;
    }
    const { user, profile } = await signInWithGoogle();
    if (profile?.isApproved) {
      showToast(`환영합니다, ${user?.displayName || '선생님'}님!`, '✝️');
    } else {
      showToast(`가입 신청되었습니다. 관리자 승인 후 이용 가능합니다.`, '⏳');
    }
  } catch (err) {
    console.error(err);
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast('로그인에 실패하였습니다. 다시 시도해주세요.', '❌');
    }
  } finally {
    const btn = document.getElementById('btnGoogleLogin');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="google-icon" viewBox="0 0 24 24" width="16" height="16">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Google 로그인</span>
      `;
    }
  }
}

async function renderAdminUsersModal() {
  const tbody = document.getElementById('adminUsersTableBody');
  const cardList = document.getElementById('adminUsersCardList');
  if (!tbody) return;
  const loadingMsg = '사용자 목록을 불러오는 중...';
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">${loadingMsg}</td></tr>`;
  setMobileCards(cardList, emptyMobileCards(loadingMsg));

  const users = await getAllUsers();
  if (users.length === 0) {
    const emptyMsg = '등록된 사용자가 없습니다.';
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">${emptyMsg}</td></tr>`;
    setMobileCards(cardList, emptyMobileCards(emptyMsg));
    return;
  }

  const rows = users.map(u => {
    const isPending = u.status === 'pending';
    const isApproved = u.status === 'approved';
    const statusBadge = isPending
      ? '<span class="role-badge-tag role-badge-pending">승인 대기</span>'
      : isApproved
      ? '<span class="role-badge-tag role-badge-teacher">승인 완료</span>'
      : '<span class="role-badge-tag" style="background:#fee2e2; color:#991b1b;">거절됨</span>';

    const reqDate = u.requestedAt ? new Date(u.requestedAt).toLocaleDateString('ko-KR') : '-';

    let actionBtns = '';
    if (isPending) {
      actionBtns = `
        <button class="btn btn-primary btn-sm btn-approve-user" data-uid="${u.uid}" data-role="teacher" style="padding: 0.25rem 0.55rem; font-size: 0.76rem;">
          ✅ 교사 승인
        </button>
        <button class="btn btn-secondary btn-sm btn-approve-user" data-uid="${u.uid}" data-role="admin" style="padding: 0.25rem 0.55rem; font-size: 0.76rem; background: #fef3c7; color: #92400e; border-color: #fcd34d;">
          🛡️ 관리자 승인
        </button>
        <button class="btn btn-secondary btn-sm btn-reject-user" data-uid="${u.uid}" style="padding: 0.25rem 0.55rem; font-size: 0.76rem; color: #dc2626;">
          거절
        </button>
      `;
    } else {
      actionBtns = `
        <span style="font-size: 0.78rem; color: var(--text-muted);">
          ${u.role === 'admin' ? '🛡️ 관리자' : '✝️ 주일학교 교사'}
        </span>
      `;
    }

    const roleBadge = `
      <span class="badge ${u.role === 'admin' ? 'badge-sacrament' : 'badge-present'}" style="font-size: 0.74rem;">
        ${u.role === 'admin' ? '관리자' : u.role === 'parent' ? '학부모' : '교사'}
      </span>
    `;

    return {
      table: `
      <tr>
        <td>
          <div style="font-weight: 700;">${u.displayName || '이름 없음'}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${u.email || '-'}</div>
        </td>
        <td style="font-size: 0.8rem;">${reqDate}</td>
        <td>${statusBadge}</td>
        <td>${roleBadge}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
            ${actionBtns}
          </div>
        </td>
      </tr>
    `,
      card: `
      <article class="mobile-data-card">
        <div class="mobile-card-top">
          <div>
            <div class="mobile-card-title">${u.displayName || '이름 없음'}</div>
            <div class="mobile-card-sub">${u.email || '-'}</div>
          </div>
          <div class="mobile-card-side">${statusBadge}</div>
        </div>
        <div class="mobile-card-meta">${roleBadge}<span class="mobile-card-points">신청 ${reqDate}</span></div>
        ${isPending ? `<div class="mobile-card-actions">${actionBtns}</div>` : `<div class="mobile-card-meta">${actionBtns}</div>`}
      </article>
    `
    };
  });

  tbody.innerHTML = rows.map(r => r.table).join('');
  setMobileCards(cardList, rows.map(r => r.card).join(''));

  const roots = [tbody, cardList];
  bindInRoots(roots, '.btn-approve-user', async (e) => {
    const btn = e.currentTarget;
    const uid = btn.getAttribute('data-uid');
    const role = btn.getAttribute('data-role') || 'teacher';
    try {
      btn.disabled = true;
      await approveUser(uid, role);
      showToast('사용자가 성공적으로 승인되었습니다!', '🎉');
      renderAdminUsersModal();
      updateAdminBadge();
    } catch (err) {
      console.error(err);
      showToast('승인 처리에 실패하였습니다.', '❌');
    }
  });

  bindInRoots(roots, '.btn-reject-user', async (e) => {
    const btn = e.currentTarget;
    const uid = btn.getAttribute('data-uid');
    if (confirm('해당 사용자의 가입을 거절하시겠습니까?')) {
      try {
        btn.disabled = true;
        await rejectUser(uid);
        showToast('사용자가 거절 처리되었습니다.', 'ℹ️');
        renderAdminUsersModal();
        updateAdminBadge();
      } catch (err) {
        console.error(err);
        showToast('거절 처리에 실패하였습니다.', '❌');
      }
    }
  });
}

async function updateAdminBadge() {
  const users = await getAllUsers();
  const pendingCount = users.filter(u => u.status === 'pending').length;
  const badge = document.getElementById('pendingUsersBadge');
  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
  }
}

function initAuthUI() {
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  const btnSignOut = document.getElementById('btnSignOut');
  const userProfileChip = document.getElementById('userProfileChip');
  const userAvatarImg = document.getElementById('userAvatarImg');
  const userAvatarFallback = document.getElementById('userAvatarFallback');
  const userNameText = document.getElementById('userNameText');
  const userEmailText = document.getElementById('userEmailText');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const btnOpenAdminUsersModal = document.getElementById('btnOpenAdminUsersModal');
  const demoRoleSelect = document.getElementById('demoRoleSelect');
  const envBadge = document.getElementById('envBadge');

  if (import.meta.env.VITE_PROVIDER === 'firebase') {
    if (envBadge) {
      envBadge.innerHTML = `<span class="env-dot" style="background:#3b82f6;" aria-hidden="true"></span><span class="env-badge-text">Firebase 운영 모드</span>`;
      envBadge.style.color = '#1d4ed8';
      envBadge.style.borderColor = '#93c5fd';
      envBadge.style.background = '#eff6ff';
    }
    const demoWrapper = document.getElementById('demoPersonaWrapper');
    if (demoWrapper) demoWrapper.style.display = 'none';
  } else {
    demoRoleSelect?.addEventListener('change', (e) => {
      setLocalDemoUserRole(e.target.value);
    });
    if (demoRoleSelect) {
      try {
        const stored = JSON.parse(localStorage.getItem('catechesis_local_user') || 'null');
        if (!stored) demoRoleSelect.value = 'none';
        else if (stored.status === 'pending') demoRoleSelect.value = 'pending';
        else if (stored.role === 'admin') demoRoleSelect.value = 'admin';
        else if (stored.status === 'approved') demoRoleSelect.value = 'teacher';
      } catch (_) { /* keep HTML default */ }
      setLocalDemoUserRole(demoRoleSelect.value);
    }
  }

  btnGoogleLogin?.addEventListener('click', handleGoogleLogin);

  btnSignOut?.addEventListener('click', async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut();
      showToast('로그아웃 되었습니다.', '👋');
    }
  });

  btnOpenAdminUsersModal?.addEventListener('click', () => {
    openModal('modalAdminUsers');
    renderAdminUsersModal();
  });

  onAuthStateChanged((user, profile) => {
    currentUser = user;
    currentUserProfile = profile;

    if (user) {
      if (btnGoogleLogin) btnGoogleLogin.style.display = 'none';
      if (userProfileChip) userProfileChip.style.display = 'flex';

      const name = profile?.displayName || user.displayName || user.email?.split('@')[0] || '선생님';
      if (userNameText) userNameText.textContent = name;
      if (userEmailText) userEmailText.textContent = user.email || '';

      if (userRoleBadge) {
        if (profile?.isAdmin) {
          userRoleBadge.textContent = '🛡️ 관리자';
          userRoleBadge.className = 'role-badge-tag role-badge-admin';
        } else if (profile?.isApproved) {
          userRoleBadge.textContent = '✅ 교사';
          userRoleBadge.className = 'role-badge-tag role-badge-teacher';
        } else {
          userRoleBadge.textContent = '⏳ 승인 대기';
          userRoleBadge.className = 'role-badge-tag role-badge-pending';
        }
      }

      if (btnOpenAdminUsersModal) {
        btnOpenAdminUsersModal.style.display = profile?.isAdmin ? 'inline-flex' : 'none';
        if (profile?.isAdmin) updateAdminBadge();
      }

      if (user.photoURL) {
        if (userAvatarImg) {
          userAvatarImg.src = user.photoURL;
          userAvatarImg.style.display = 'block';
        }
        if (userAvatarFallback) userAvatarFallback.style.display = 'none';
      } else {
        if (userAvatarImg) userAvatarImg.style.display = 'none';
        if (userAvatarFallback) {
          userAvatarFallback.textContent = name.charAt(0).toUpperCase();
          userAvatarFallback.style.display = 'flex';
        }
      }
    } else {
      if (btnGoogleLogin) btnGoogleLogin.style.display = 'inline-flex';
      if (userProfileChip) userProfileChip.style.display = 'none';
      if (btnOpenAdminUsersModal) btnOpenAdminUsersModal.style.display = 'none';
    }

    // Refresh current view based on permissions
    renderDashboard();
    renderSchedule();
    renderAttendance();
    renderStats();
    renderActivities();
    renderGraceBank();
    renderDirectory();
  });
}

// ============================================================
//  Theme Management (Dark / Light Mode)
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('catechesis_theme', theme);
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  if (btnThemeToggle) {
    const icon = btnThemeToggle.querySelector('.theme-toggle-icon');
    const text = btnThemeToggle.querySelector('.theme-toggle-text');
    if (theme === 'dark') {
      if (icon) icon.textContent = '☀️';
      if (text) text.textContent = '라이트 모드';
      btnThemeToggle.setAttribute('title', '라이트 모드로 전환');
    } else {
      if (icon) icon.textContent = '🌙';
      if (text) text.textContent = '다크 모드';
      btnThemeToggle.setAttribute('title', '다크 모드로 전환');
    }
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('catechesis_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(initialTheme);

  const btnThemeToggle = document.getElementById('btnThemeToggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }
}

// ============================================================
//  Sunday School D-Day & Progress Calculation
// ============================================================
function renderDDayProgress() {
  const now = new Date();
  const daysOfWeek = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayNamesShort = ['일', '월', '화', '수', '목', '금', '토'];
  const currentDayIndex = now.getDay();

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const dayFullName = daysOfWeek[currentDayIndex];

  // 📅 등록된 학사 일정 기반 다음 모임일 계산
  const nextSchool = dataProvider.getNextUpcomingSchoolDate(now);
  const daysLeft = nextSchool.daysLeft;
  const targetDateStr = nextSchool.targetDate
    ? `${nextSchool.targetDate.getFullYear()}년 ${nextSchool.targetDate.getMonth() + 1}월 ${nextSchool.targetDate.getDate()}일`
    : '';
  const schoolTitle = nextSchool.title || '토요 주일학교';

  // 진행률: 등록된 다음 모임일까지 주 중 경과일 비율
  const progressPercent = daysLeft === 0 ? 100 : Math.max(5, Math.round(((7 - daysLeft) / 7) * 100));

  // DOM Elements
  const todayBadge = document.getElementById('ddayTodayDateBadge');
  const highlightBadge = document.getElementById('ddayHighlightBadge');
  const headline = document.getElementById('ddayHeadline');
  const subquote = document.getElementById('ddaySubquote');
  const stepsRow = document.getElementById('ddayStepsRow');
  const progressBarFill = document.getElementById('ddayProgressBarFill');
  const nextSatText = document.getElementById('ddayNextSatText');
  const progressPercentText = document.getElementById('ddayProgressPercentText');

  if (todayBadge) {
    todayBadge.textContent = `📅 오늘: ${year}년 ${month}월 ${date}일 (${dayFullName})`;
  }

  if (highlightBadge && headline && subquote) {
    if (daysLeft === 0) {
      highlightBadge.textContent = '🔥 D-Day 오늘';
      highlightBadge.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      headline.textContent = `🎉 오늘은 주일학교 날이에요! — ${schoolTitle}`;
      subquote.textContent = '친구들과 선생님을 만나는 기쁜 날! 즐겁게 미사와 교리에 참여해요 ✝️';
    } else if (daysLeft === 1) {
      highlightBadge.textContent = '🏃 D-1';
      highlightBadge.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      headline.textContent = `🏃 주일학교까지 딱 하루! — ${schoolTitle}`;
      subquote.textContent = '내일은 토요 주일학교! 교리 책과 성경을 미리 챙겨두어요 🎒';
    } else {
      highlightBadge.textContent = `🏃 D-${daysLeft}`;
      highlightBadge.style.background = 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
      headline.textContent = `다음 주일학교까지 D-${daysLeft}일 — ${schoolTitle}`;
      subquote.textContent = '평일에도 예수님 사랑 실천하며 즐거운 마음으로 성당 갈 준비를 해요 ✨';
    }
  }

  if (stepsRow) {
    stepsRow.innerHTML = dayNamesShort.map((name, idx) => {
      const isCompleted = idx < currentDayIndex;
      const isActive = idx === currentDayIndex;
      // 다음 모임 요일을 target으로 표시
      const targetDayIdx = nextSchool.targetDate ? nextSchool.targetDate.getDay() : 6;
      const isTarget = idx === targetDayIdx && idx !== currentDayIndex;

      let classes = ['dday-step-node'];
      if (isCompleted) classes.push('completed');
      if (isActive) classes.push('active');
      if (isTarget) classes.push('target');

      let circleContent = name;
      if (isCompleted) circleContent = '✓';
      else if (isTarget) circleContent = '⛪';

      return `
        <div class="${classes.join(' ')}">
          <div class="dday-node-circle">${circleContent}</div>
          <span class="dday-node-label">${name}${isTarget ? ' (성당)' : ''}</span>
        </div>
      `;
    }).join('');
  }

  if (progressBarFill) {
    progressBarFill.style.width = `${progressPercent}%`;
  }

  if (nextSatText) {
    nextSatText.textContent = nextSchool.date
      ? `⛪ 다음 주일학교: ${targetDateStr} — ${schoolTitle}`
      : '⛪ 다음 주일학교 일정 미등록';
  }

  if (progressPercentText) {
    progressPercentText.textContent = `진행률 ${progressPercent}%`;
  }
}

// ============================================================
//  TAB 1: Dashboard
// ============================================================
function renderDashboard() {
  renderDDayProgress();

  const isApproved = isUserApproved();
  const students = dataProvider.getStudents();
  const teachers = dataProvider.getTeachers();
  const today = document.getElementById('attDatePicker')?.value || getTodayDateString();
  const attendanceToday = dataProvider.getAttendance(today);
  const activitiesToday = dataProvider.getActivities(today);
  const allLedger = dataProvider.getGraceLedger();

  const totalGrace = allLedger.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const attendedCount = attendanceToday.filter(a => a.status === '출석').length;

  document.getElementById('statTotalStudents').textContent = `${students.length}명`;
  document.getElementById('statTodayAttendance').textContent = `${attendedCount}명 출석`;
  document.getElementById('statTodayActivities').textContent = `${activitiesToday.length}건 봉사`;
  document.getElementById('statTotalGrace').textContent = `${totalGrace.toLocaleString()} P`;

  document.getElementById('badgeAttendedCount').textContent = attendedCount;
  document.getElementById('badgeActivityCount').textContent = activitiesToday.length;

  // --- 이번 달 축일 대상자 ---
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const monthNum = now.getMonth() + 1;

  const feastHeaderTitle = document.getElementById('feastHeaderTitle');
  if (feastHeaderTitle) feastHeaderTitle.textContent = `🎂 이번 달(${monthNum}월) 축일을 맞이한 친구들`;

  const feastStudents = students.filter(s => s.studentInfo?.feastDay?.startsWith(currentMonth));
  feastStudents.sort((a, b) => a.studentInfo.feastDay.localeCompare(b.studentInfo.feastDay));

  const feastGrid = document.getElementById('feastStudentsGrid');
  const feastCountBadge = document.getElementById('feastCountBadge');
  if (feastGrid && feastCountBadge) {
    if (feastStudents.length === 0) {
      feastCountBadge.textContent = '0명';
      feastGrid.innerHTML = `
        <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.7); padding: 0.85rem; border-radius: 8px; font-size: 0.85rem; color: #92400e; text-align: center;">
          이번 달(${monthNum}월)에는 축일 대상 학생이 없습니다.
        </div>
      `;
    } else {
      feastCountBadge.textContent = `${feastStudents.length}명 축하 👏`;
      feastGrid.innerHTML = feastStudents.map(st => {
        const [m, d] = st.studentInfo.feastDay.split('-');
        const displayName = isApproved ? st.name : maskKoreanName(st.name);
        const displayBaptismal = isApproved
          ? `(${st.baptismalName || '세례명'})`
          : maskBaptismalName(st.baptismalName);
        const avatarInitial = isApproved ? st.name.charAt(0) : '🎉';
        const nameMarkup = isApproved
          ? `<span class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${displayName}</span>`
          : `<span style="color: var(--text-muted); cursor: default;" title="로그인 후 상세 확인 가능">${displayName}</span>`;

        return `
          <div class="feast-student-item">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div class="avatar" style="width: 38px; height: 38px; font-size: 0.95rem; background: #fef3c7; color: #b45309; border: 1px solid #fcd34d;">
                ${avatarInitial}
              </div>
              <div>
                <div style="font-weight: 700; font-size: 0.92rem;">
                  ${nameMarkup}
                  <span style="font-size: 0.8rem; font-weight: normal; color: #92400e;">${displayBaptismal}</span>
                </div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">
                  <span class="badge badge-grade" style="font-size: 0.68rem; padding: 0.1rem 0.35rem;">${st.studentInfo.grade}</span>
                  ${(st.studentInfo.departments || []).length > 0 ? `• ${st.studentInfo.departments[0]}` : ''}
                </div>
              </div>
            </div>
            <span class="feast-date-badge">📅 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일</span>
          </div>
        `;
      }).join('');
    }
  }

  // --- TOP 5 은총표 랭킹 ---
  const sortedStudents = [...students].sort((a, b) => b.totalGracePoints - a.totalGracePoints);
  const top5 = sortedStudents.slice(0, 5);
  const topTableBody = document.querySelector('#topGraceTable tbody');
  const topCardList = document.getElementById('topGraceCardList');
  if (top5.length === 0) {
    const emptyMsg = '학생 데이터가 없습니다.';
    topTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">${emptyMsg}</td></tr>`;
    setMobileCards(topCardList, emptyMobileCards(emptyMsg));
  } else {
    const rows = top5.map((st, idx) => {
      const rankMedal = idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`;
      const depts = (st.studentInfo?.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '<span style="color: var(--text-muted); font-size: 0.75rem;">-</span>';
      const displayName = isApproved ? st.name : maskKoreanName(st.name);
      const displayBaptismal = isApproved
        ? (st.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.8rem;">(${st.baptismalName})</span>` : '')
        : (st.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.8rem;">${maskBaptismalName(st.baptismalName)}</span>` : '');
      const nameMarkup = isApproved
        ? `<strong class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${displayName}</strong>`
        : `<strong style="color: var(--text-muted); cursor: default;" title="로그인 후 상세 확인 가능">${displayName}</strong>`;
      const gradeBadge = `<span class="badge badge-grade">${st.studentInfo?.grade || '-'}</span>`;
      const points = `<span class="grace-badge"><span class="coin">🪙</span> ${st.totalGracePoints.toLocaleString()} P</span>`;

      return {
        table: `
        <tr>
          <td style="font-weight: 700; color: var(--primary);">${rankMedal}</td>
          <td>
            ${nameMarkup}
            ${displayBaptismal}
          </td>
          <td>${gradeBadge}</td>
          <td>${depts}</td>
          <td style="text-align: right;">
            ${points}
          </td>
        </tr>
      `,
        card: `
        <article class="mobile-data-card">
          <div class="mobile-card-top">
            <div>
              <div class="mobile-card-title">${rankMedal} · ${nameMarkup} ${displayBaptismal}</div>
              <div class="mobile-card-meta" style="margin-top: 0.35rem;">${gradeBadge}${depts}</div>
            </div>
            <div class="mobile-card-side">${points}</div>
          </div>
        </article>
      `
      };
    });
    topTableBody.innerHTML = rows.map(r => r.table).join('');
    setMobileCards(topCardList, rows.map(r => r.card).join(''));
  }

  // --- 교사회 명단 (대시보드 우측) ---
  const teachersContainer = document.getElementById('teachersList');
  if (teachersContainer) {
    teachersContainer.innerHTML = teachers.map(t => {
      const primaryRole = dataProvider.getPrimaryTeacherRole(t);
      const roleBadgeClass = primaryRole?.role === 'principal' ? 'badge-sacrament' :
                              primaryRole?.role === 'vice_principal' ? 'badge-grade' : 'badge-present';
      const parentBadge = isApproved && t.roles?.includes('parent')
        ? '<span class="badge badge-grade" style="font-size: 0.7rem; margin-left: 0.3rem;">👨‍👩‍👧 학부모</span>'
        : '';
      const specialBadges = isApproved
        ? (t.roles || [])
            .filter(r => ['liturgy_teacher', 'acolyte_teacher'].includes(r))
            .map(r => `<span class="badge badge-sacrament" style="font-size: 0.65rem; margin-left: 0.2rem;">${PERSON_ROLES[r]?.icon || ''}</span>`)
            .join('')
        : '';

      const displayName = isApproved ? t.name : maskTeacherName(t.name);
      const displayBaptismal = isApproved
        ? (t.baptismalName ? `<span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;">(${t.baptismalName})</span>` : '')
        : '';

      const nameMarkup = isApproved
        ? `<span class="clickable-name" data-detail-type="teacher" data-detail-id="${t.id}">${displayName}</span>`
        : `<span style="color: var(--text-muted); font-weight: 600;">${displayName}</span>`;

      const phoneMarkup = isApproved
        ? `📞 <a href="tel:${t.phone}" style="color: inherit; text-decoration: underline;">${t.phone || '-'}</a>`
        : `<span class="privacy-masked-badge">🔒 로그인 후 확인</span>`;

      return `
        <div style="background: var(--surface-subtle); padding: 0.65rem 0.85rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main); display: flex; align-items: center; flex-wrap: wrap; gap: 0.2rem;">
              ${nameMarkup}
              ${displayBaptismal}
              ${parentBadge}${specialBadges}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">
              ${phoneMarkup}
            </div>
          </div>
          <span class="badge ${roleBadgeClass}">${primaryRole?.label || '교사'}</span>
        </div>
      `;
    }).join('');
  }
}

// ============================================================
//  TAB 2: Attendance
// ============================================================
function renderAttendance() {
  const protectedEl = document.getElementById('attendanceProtectedContent');
  const lockedEl = document.getElementById('attendanceLockedNotice');

  if (!isUserApproved()) {
    if (protectedEl) protectedEl.style.display = 'none';
    if (lockedEl) {
      lockedEl.style.display = 'block';
      lockedEl.innerHTML = getAccessLockedHtml('주일 출석 체크');
      lockedEl.querySelector('.btn-login-trigger')?.addEventListener('click', handleGoogleLogin);
    }
    return;
  }
  if (protectedEl) protectedEl.style.display = '';
  if (lockedEl) lockedEl.style.display = 'none';

  const dateInput = document.getElementById('attDatePicker');
  const selectedDate = dateInput?.value || getTodayDateString();
  if (dateInput && !dateInput.value) dateInput.value = selectedDate;
  updateAttendanceScheduleHint(selectedDate);

  const students = dataProvider.getStudents();
  const attendanceList = dataProvider.getAttendance(selectedDate);
  const attendanceGrid = document.getElementById('attendanceGrid');

  const schoolDay = dataProvider.isSchoolDay(selectedDate);
  const filtered = students.filter(st => matchGradeGroup(st.studentInfo?.grade || '', currentAttGradeFilter));

  if (filtered.length === 0) {
    attendanceGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">해당 학년의 학생이 없습니다.</div>';
    return;
  }

  attendanceGrid.innerHTML = filtered.map(st => {
    const si = st.studentInfo || {};
    const att = attendanceList.find(a => a.studentPersonId === st.id || a.studentId === st.id);
    const status = att ? att.status : '미체크';
    const massAttended = att ? att.massAttended : false;
    const depts = (si.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('');
    const className = getClassNameForGrade(si.grade);

    return `
      <div class="student-att-card" data-student-id="${st.id}">
        <div>
          <div class="att-card-header">
            <div class="student-profile-wrap">
              <div class="avatar">${st.name.charAt(0)}</div>
              <div>
                <div class="student-main-name">
                  <span class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</span>
                  <span class="badge badge-grade">${si.grade || '-'}</span>
                </div>
                <div class="baptismal-sub">
                  ${st.baptismalName ? `세례명: ${st.baptismalName}` : '세례명 미등록'}
                  ${si.feastDay ? `• 축일: ${si.feastDay}` : ''}
                  <span style="color: var(--text-subtle); margin-left: 0.3rem;">${className !== si.grade ? className : ''}</span>
                </div>
              </div>
            </div>
            <span class="grace-badge">
              <span class="coin">🪙</span> ${st.totalGracePoints} P
            </span>
          </div>
          <div style="margin-top: 0.6rem;">
            ${depts || '<span style="font-size: 0.72rem; color: var(--text-muted);">활동 부서 없음</span>'}
          </div>
        </div>

        <div>
          <div class="att-button-row">
            <button class="btn-att-toggle ${status === '출석' ? 'active-present' : ''}" data-status="출석" data-id="${st.id}">
              ✓ 출석 (+10 P)
            </button>
            <button class="btn-att-toggle ${status === '결석' ? 'active-absent' : ''}" data-status="결석" data-id="${st.id}">
              ✕ 결석
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 출석 버튼 이벤트 (원클릭으로 출석 체크 완료)
  attendanceGrid.querySelectorAll('.btn-att-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.getAttribute('data-id');
      const newStatus = btn.getAttribute('data-status');
      if (schoolDay === false) {
        const ok = confirm('선택한 날짜는 학사 일정 상 휴교일입니다. 그래도 출석을 기록할까요?');
        if (!ok) return;
      }
      dataProvider.recordAttendance({ date: selectedDate, studentId, status: newStatus, recordedBy: '담당 선생님' });
      showToast(`${newStatus} 체크 완료 (은총표 자동 반영)`, '✅');
      renderAttendance();
      renderDashboard();
      renderStats();
    });
  });
}

// ============================================================
//  TAB 3: Activities
// ============================================================
function renderActivities() {
  const protectedEl = document.getElementById('activitiesProtectedContent');
  const lockedEl = document.getElementById('activitiesLockedNotice');

  if (!isUserApproved()) {
    if (protectedEl) protectedEl.style.display = 'none';
    if (lockedEl) {
      lockedEl.style.display = 'block';
      lockedEl.innerHTML = getAccessLockedHtml('활동 부서 봉사');
      lockedEl.querySelector('.btn-login-trigger')?.addEventListener('click', handleGoogleLogin);
    }
    return;
  }
  if (protectedEl) protectedEl.style.display = 'grid';
  if (lockedEl) lockedEl.style.display = 'none';

  const students = dataProvider.getStudents();
  const allActivities = dataProvider.getActivities();
  const select = document.getElementById('actStudentSelect');
  const tableBody = document.querySelector('#activityHistoryTable tbody');
  const cardList = document.getElementById('activityHistoryCardList');

  const prevVal = select.value;
  select.innerHTML = '<option value="">봉사 학생을 선택하세요...</option>' +
    students.map(s => `<option value="${s.id}">${s.name} (${s.baptismalName || '세례명 없음'}, ${s.studentInfo?.grade || '-'})</option>`).join('');
  if (prevVal) select.value = prevVal;

  const sorted = [...allActivities].reverse();
  document.getElementById('activityListCount').textContent = `${sorted.length}건`;

  if (sorted.length === 0) {
    const emptyMsg = '기록된 활동 봉사 내역이 없습니다.';
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${emptyMsg}</td></tr>`;
    setMobileCards(cardList, emptyMobileCards(emptyMsg));
    return;
  }

  const rows = sorted.map(act => {
    const st = students.find(s => s.id === (act.studentPersonId || act.studentId));
    const stName = st ? `${st.name} (${st.baptismalName || '-'}, ${st.studentInfo?.grade || '-'})` : '알 수 없음';
    const nameMarkup = `<strong class="clickable-name" data-detail-type="student" data-detail-id="${act.studentPersonId || act.studentId}">${stName}</strong>`;
    const dept = `<span class="dept-tag">${act.department}</span>`;
    const points = `<span class="grace-badge"><span class="coin">🪙</span> +${act.pointsEarned} P</span>`;
    return {
      table: `
      <tr>
        <td style="white-space: nowrap;">${act.date}</td>
        <td>${nameMarkup}</td>
        <td>${dept}</td>
        <td>${act.roleDetail || '-'}</td>
        <td style="text-align: right;">${points}</td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${act.recordedBy || '선생님'}</td>
      </tr>
    `,
      card: `
      <article class="mobile-data-card">
        <div class="mobile-card-top">
          <div>
            <div class="mobile-card-title">${nameMarkup}</div>
            <div class="mobile-card-sub">${act.date} · ${act.recordedBy || '선생님'}</div>
          </div>
          <div class="mobile-card-side">${points}</div>
        </div>
        <div class="mobile-card-meta">${dept}<span class="mobile-card-points">${act.roleDetail || '-'}</span></div>
      </article>
    `
    };
  });
  tableBody.innerHTML = rows.map(r => r.table).join('');
  setMobileCards(cardList, rows.map(r => r.card).join(''));
}

// ============================================================
//  TAB 4: Grace Bank
// ============================================================
function renderGraceBank() {
  const protectedEl = document.getElementById('graceProtectedContent');
  const lockedEl = document.getElementById('graceLockedNotice');

  if (!isUserApproved()) {
    if (protectedEl) protectedEl.style.display = 'none';
    if (lockedEl) {
      lockedEl.style.display = 'block';
      lockedEl.innerHTML = getAccessLockedHtml('은총표 관리소');
      lockedEl.querySelector('.btn-login-trigger')?.addEventListener('click', handleGoogleLogin);
    }
    return;
  }
  if (protectedEl) protectedEl.style.display = '';
  if (lockedEl) lockedEl.style.display = 'none';

  const students = dataProvider.getStudents();
  const ledger = dataProvider.getGraceLedger();
  const search = document.getElementById('graceSearchInput')?.value.trim().toLowerCase() || '';
  const tableBody = document.querySelector('#graceOverviewTable tbody');
  const cardList = document.getElementById('graceOverviewCardList');

  let filtered = students.filter(st => {
    const matchSearch = !search ||
      st.name.toLowerCase().includes(search) ||
      (st.baptismalName && st.baptismalName.toLowerCase().includes(search));
    const matchGrade = matchGradeGroup(st.studentInfo?.grade || '', currentGraceGradeFilter);
    return matchSearch && matchGrade;
  });

  if (filtered.length === 0) {
    const emptyMsg = '일치하는 학생이 없습니다.';
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">${emptyMsg}</td></tr>`;
    setMobileCards(cardList, emptyMobileCards(emptyMsg));
    return;
  }

  const rows = filtered.map(st => {
    const studentLedger = ledger.filter(l => l.studentPersonId === st.id || l.studentId === st.id);
    const attPts = studentLedger.filter(l => l.type === '출석').reduce((s, i) => s + Number(i.amount || 0), 0);
    const actPts = studentLedger.filter(l => l.type === '활동').reduce((s, i) => s + Number(i.amount || 0), 0);
    const bonusPts = studentLedger.filter(l => l.type === '추가점수' || l.type === '사용/차감').reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalPts = attPts + actPts + bonusPts;
    const depts = (st.studentInfo?.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '-';
    const nameMarkup = `
          <strong class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</strong>
          ${st.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.82rem;">(${st.baptismalName})</span>` : ''}
    `;
    const gradeBadge = `<span class="badge badge-grade">${st.studentInfo?.grade || '-'}</span>`;
    const totalBadge = `
          <span class="grace-badge" style="font-size: 0.95rem;">
            <span class="coin">🪙</span> ${totalPts.toLocaleString()} P
          </span>
    `;
    const actions = `
          <button class="btn btn-secondary btn-sm btn-view-ledger" data-id="${st.id}">원장 조회</button>
          <button class="btn btn-grace btn-sm btn-quick-bonus" data-id="${st.id}">+ 점수</button>
    `;

    return {
      table: `
      <tr>
        <td>${nameMarkup}</td>
        <td>${gradeBadge}</td>
        <td>${depts}</td>
        <td style="text-align: center; color: #059669; font-weight: 600;">+${attPts}</td>
        <td style="text-align: center; color: #7c3aed; font-weight: 600;">+${actPts}</td>
        <td style="text-align: center; font-weight: 600; color: ${bonusPts >= 0 ? '#2563eb' : '#dc2626'};">${bonusPts >= 0 ? '+' : ''}${bonusPts}</td>
        <td style="text-align: right;">${totalBadge}</td>
        <td style="text-align: center;">${actions}</td>
      </tr>
    `,
      card: `
      <article class="mobile-data-card">
        <div class="mobile-card-top">
          <div>
            <div class="mobile-card-title">${nameMarkup}</div>
            <div class="mobile-card-meta" style="margin-top: 0.3rem;">${gradeBadge}${depts}</div>
          </div>
          <div class="mobile-card-side">${totalBadge}</div>
        </div>
        <div class="mobile-card-points">
          <span>출석 +${attPts}</span>
          <span>활동 +${actPts}</span>
          <span>보너스 ${bonusPts >= 0 ? '+' : ''}${bonusPts}</span>
        </div>
        <div class="mobile-card-actions">${actions}</div>
      </article>
    `
    };
  });

  tableBody.innerHTML = rows.map(r => r.table).join('');
  setMobileCards(cardList, rows.map(r => r.card).join(''));

  const roots = [tableBody, cardList];
  bindInRoots(roots, '.btn-view-ledger', (e) => {
    showGraceLedgerModal(e.currentTarget.getAttribute('data-id'));
  });
  bindInRoots(roots, '.btn-quick-bonus', (e) => {
    document.getElementById('bonusStudentSelect').value = e.currentTarget.getAttribute('data-id');
    openModal('modalBonusPoints');
  });
}

function showGraceLedgerModal(studentId) {
  const st = dataProvider.getStudentById(studentId);
  if (!st) return;
  const ledger = dataProvider.getGraceLedger(studentId).reverse();
  document.getElementById('ledgerStudentInfo').textContent = `${st.name} (${st.baptismalName || '세례명 미등록'}, ${st.studentInfo?.grade || '-'})`;
  document.getElementById('ledgerStudentSub').textContent = `활동부서: ${(st.studentInfo?.departments || []).join(', ') || '없음'}`;
  document.getElementById('ledgerTotalBadge').innerHTML = `🪙 ${st.totalGracePoints.toLocaleString()} P`;

  const rows = document.getElementById('ledgerHistoryRows');
  if (ledger.length === 0) {
    rows.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">은총표 기록 내역이 없습니다.</td></tr>';
  } else {
    rows.innerHTML = ledger.map(item => {
      const isPositive = Number(item.amount) >= 0;
      return `
        <tr>
          <td style="white-space: nowrap; font-size: 0.8rem;">${item.date}</td>
          <td><span class="badge ${item.type === '출석' ? 'badge-present' : item.type === '활동' ? 'badge-sacrament' : 'badge-grade'}">${item.type}</span></td>
          <td>${item.reason || '-'}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${item.issuedBy || '-'}</td>
          <td style="text-align: right; font-weight: 700; color: ${isPositive ? '#059669' : '#dc2626'};">
            ${isPositive ? '+' : ''}${item.amount} P
          </td>
        </tr>
      `;
    }).join('');
  }
  openModal('modalGraceLedger');
}

// ============================================================
//  TAB 5: Directory (학생 / 학부모 / 교사 / 반 구성)
// ============================================================
function renderDirectory() {
  const protectedEl = document.getElementById('studentsProtectedContent');
  const lockedEl = document.getElementById('studentsLockedNotice');

  if (!isUserApproved()) {
    if (protectedEl) protectedEl.style.display = 'none';
    if (lockedEl) {
      lockedEl.style.display = 'block';
      lockedEl.innerHTML = getAccessLockedHtml('학생 및 학부모 명부');
      lockedEl.querySelector('.btn-login-trigger')?.addEventListener('click', handleGoogleLogin);
    }
    return;
  }
  if (protectedEl) protectedEl.style.display = '';
  if (lockedEl) lockedEl.style.display = 'none';

  const search = document.getElementById('directorySearchInput')?.value.trim().toLowerCase() || '';

  if (currentDirectoryView === 'students') renderStudentsDirectory(search);
  else if (currentDirectoryView === 'parents') renderParentsDirectory(search);
  else if (currentDirectoryView === 'teachers') renderTeachersDirectory(search);
  else if (currentDirectoryView === 'classes') renderClassesView();
}

function renderStudentsDirectory(search = '') {
  const students = dataProvider.getStudents();
  const classes = dataProvider.getClasses();
  const studentsBody = document.querySelector('#studentsTable tbody');
  const cardList = document.getElementById('studentsCardList');

  const filtered = students.filter(s => {
    if (!search) return true;
    const si = s.studentInfo || {};
    return s.name.toLowerCase().includes(search) ||
           (s.baptismalName && s.baptismalName.toLowerCase().includes(search)) ||
           (si.grade && si.grade.toLowerCase().includes(search));
  });

  // 학년 순 정렬
  filtered.sort((a, b) => {
    const ao = GRADE_SORT_MAP[a.studentInfo?.grade] ?? 99;
    const bo = GRADE_SORT_MAP[b.studentInfo?.grade] ?? 99;
    return ao - bo;
  });

  if (filtered.length === 0) {
    const emptyMsg = '등록된 학생이 없습니다.';
    studentsBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">${emptyMsg}</td></tr>`;
    setMobileCards(cardList, emptyMobileCards(emptyMsg));
    return;
  }

  const rows = filtered.map(st => {
    const si = st.studentInfo || {};
    const parents = dataProvider.getParentsOfStudent(st.id);
    const parentInfo = parents.length > 0
      ? parents.map(p => `<span class="clickable-name" data-detail-type="parent" data-detail-id="${p.id}">${p.name}${p.baptismalName ? ` <span style="font-size: 0.75rem; color: var(--text-muted);">(${p.baptismalName})</span>` : ''}</span>`).join(', ')
      : '<span style="color: var(--text-muted);">-</span>';
    const sacraments = [];
    if (si.firstCommunion) sacraments.push('<span class="badge badge-sacrament">첫영성체</span>');
    if (si.confirmation) sacraments.push('<span class="badge badge-sacrament">견진</span>');
    const depts = (si.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '-';
    const className = getClassNameForGrade(si.grade || '');
    const nameMarkup = `
          <strong class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</strong>
          ${st.baptismalName ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${st.baptismalName}</div>` : ''}
    `;
    const gradeCell = `
          <span class="badge badge-grade">${si.grade || '-'}</span>
          ${className !== si.grade ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">${className}</div>` : ''}
    `;
    const points = `<span class="grace-badge"><span class="coin">🪙</span> ${st.totalGracePoints} P</span>`;
    const action = `<button class="btn btn-secondary btn-sm btn-quick-bonus" data-id="${st.id}">+ 점수</button>`;

    return {
      table: `
      <tr>
        <td>${nameMarkup}</td>
        <td>${gradeCell}</td>
        <td>${si.gender || '-'}</td>
        <td>${si.feastDay ? `📅 ${si.feastDay}` : '<span style="color: var(--text-muted); font-size: 0.78rem;">해당없음</span>'}</td>
        <td>${sacraments.join(' ') || '<span style="color: var(--text-muted); font-size: 0.78rem;">미수품</span>'}</td>
        <td>${depts}</td>
        <td>${parentInfo}</td>
        <td>${points}</td>
        <td>${action}</td>
      </tr>
    `,
      card: `
      <article class="mobile-data-card">
        <div class="mobile-card-top">
          <div>
            <div class="mobile-card-title">
              <strong class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</strong>
              ${st.baptismalName ? `<span style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem;"> (${st.baptismalName})</span>` : ''}
            </div>
            <div class="mobile-card-meta" style="margin-top: 0.3rem;">
              <span class="badge badge-grade">${si.grade || '-'}</span>
              ${depts}
              ${sacraments.join('')}
            </div>
          </div>
          <div class="mobile-card-side">${points}</div>
        </div>
        <div class="mobile-card-sub">학부모: ${parentInfo}</div>
        <div class="mobile-card-actions">${action}</div>
      </article>
    `
    };
  });

  studentsBody.innerHTML = rows.map(r => r.table).join('');
  setMobileCards(cardList, rows.map(r => r.card).join(''));

  bindInRoots([studentsBody, cardList], '.btn-quick-bonus', (e) => {
    document.getElementById('bonusStudentSelect').value = e.currentTarget.getAttribute('data-id');
    openModal('modalBonusPoints');
  });
}

function renderParentsDirectory(search = '') {
  const parents = dataProvider.getParents();
  const parentsBody = document.querySelector('#parentsTable tbody');
  const cardList = document.getElementById('parentsCardList');

  const filtered = parents.filter(p => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search) ||
           (p.baptismalName && p.baptismalName.toLowerCase().includes(search)) ||
           (p.phone && p.phone.includes(search)) ||
           (p.address && p.address.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    const emptyMsg = '등록된 학부모가 없습니다.';
    parentsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${emptyMsg}</td></tr>`;
    setMobileCards(cardList, emptyMobileCards(emptyMsg));
    return;
  }

  const rows = filtered.map(p => {
    const teacherRoles = dataProvider.getTeacherRoles();
    const isTeacher = p.roles && p.roles.some(r => teacherRoles.includes(r));
    const p1TeacherBadge = isTeacher
      ? `<span class="badge badge-sacrament" style="font-size: 0.68rem; margin-left: 0.25rem;">${getPrimaryRoleLabel(p)}</span>`
      : '';

    // 배우자 정보
    let spouseCell = '<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>';
    let spouseShort = '';
    const spouseId = p.parentInfo?.spousePersonId;
    if (spouseId) {
      const spouse = dataProvider.getPersonById(spouseId);
      if (spouse) {
        const spouseTeacher = spouse.roles && spouse.roles.some(r => teacherRoles.includes(r));
        const spouseBadge = spouseTeacher
          ? `<span class="badge badge-sacrament" style="font-size: 0.68rem; margin-left: 0.25rem;">${getPrimaryRoleLabel(spouse)}</span>`
          : '';
        spouseCell = `
          <strong class="clickable-name" data-detail-type="parent" data-detail-id="${spouse.id}">${spouse.name}</strong>
          ${spouse.baptismalName ? `<span style="font-size: 0.82rem; color: var(--text-muted);">(${spouse.baptismalName})</span>` : ''}
          ${spouseBadge}
        `;
        spouseShort = ` · 배우자 ${spouse.name}`;
      }
    }

    const childNames = (p.parentInfo?.childPersonIds || []).map(cid => {
      const s = dataProvider.getStudentById(cid);
      return s ? `<span class="clickable-name" data-detail-type="student" data-detail-id="${s.id}">${s.name}</span>(${s.studentInfo?.grade || '-'})` : '';
    }).filter(Boolean).join(', ') || '등록 자녀 없음';

    const detailBtn = `<button class="btn btn-secondary btn-sm" onclick="showUserDetailGlobal('parent', '${p.id}')">상세 보기</button>`;

    return {
      table: `
      <tr>
        <td>
          <strong class="clickable-name" data-detail-type="parent" data-detail-id="${p.id}">${p.name}</strong>
          ${p.baptismalName ? `<span style="font-size: 0.82rem; color: var(--text-muted);">(${p.baptismalName})</span>` : ''}
          ${p1TeacherBadge}
        </td>
        <td>${spouseCell}</td>
        <td><a href="tel:${p.phone}" style="color: var(--primary); font-weight: 600;">📞 ${p.phone || '-'}</a></td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${p.address || '-'}</td>
        <td><span style="font-size: 0.85rem;">${childNames}</span></td>
        <td>${detailBtn}</td>
      </tr>
    `,
      card: `
      <article class="mobile-data-card">
        <div class="mobile-card-top">
          <div>
            <div class="mobile-card-title">
              <strong class="clickable-name" data-detail-type="parent" data-detail-id="${p.id}">${p.name}</strong>
              ${p.baptismalName ? `<span style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem;"> (${p.baptismalName})</span>` : ''}
              ${p1TeacherBadge}
            </div>
            <div class="mobile-card-sub">${p.phone ? `📞 ${p.phone}` : ''}${spouseShort}</div>
          </div>
        </div>
        <div class="mobile-card-meta">자녀: ${childNames}</div>
        <div class="mobile-card-actions">${detailBtn}</div>
      </article>
    `
    };
  });

  parentsBody.innerHTML = rows.map(r => r.table).join('');
  setMobileCards(cardList, rows.map(r => r.card).join(''));
}

function renderTeachersDirectory(search = '') {
  const teachers = dataProvider.getTeachers();
  const classes = dataProvider.getClasses();
  const teachersBody = document.querySelector('#teachersTable tbody');
  const cardList = document.getElementById('teachersCardList');

  const filtered = teachers.filter(t => {
    if (!search) return true;
    return t.name.toLowerCase().includes(search) ||
           (t.baptismalName && t.baptismalName.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    const emptyMsg = '등록된 교사가 없습니다.';
    teachersBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">${emptyMsg}</td></tr>`;
    setMobileCards(cardList, emptyMobileCards(emptyMsg));
    return;
  }

  const rows = filtered.map(t => {
    const primaryRole = dataProvider.getPrimaryTeacherRole(t);
    const roleBadgeClass = primaryRole?.role === 'principal' ? 'badge-sacrament' :
                            primaryRole?.role === 'vice_principal' ? 'badge-grade' : 'badge-present';
    const roleBadge = `<span class="badge ${roleBadgeClass}">${primaryRole?.label || '교사'}</span>`;

    // 담당 반
    const assignedClasses = (t.teacherInfo?.assignedClassIds || [])
      .map(cid => classes.find(c => c.id === cid))
      .filter(Boolean);
    const assignedClassHtml = assignedClasses.length > 0
      ? assignedClasses.map(c => `<span class="badge badge-grade" style="font-size: 0.75rem;">${c.name}</span>`).join(' ')
      : '<span style="color: var(--text-muted); font-size: 0.82rem;">전체 관할</span>';

    // 겸임 정보
    const dualRoles = [];
    if (t.roles?.includes('parent')) dualRoles.push('학부모 겸임');
    if (t.roles?.includes('liturgy_teacher')) dualRoles.push('전례부');
    if (t.roles?.includes('acolyte_teacher')) dualRoles.push('복사담당');
    const dualHtml = dualRoles.length > 0
      ? dualRoles.map(r => `<span class="badge badge-grade" style="font-size: 0.7rem;">${r}</span>`).join(' ')
      : '<span style="color: var(--text-muted);">-</span>';

    const detailBtn = `<button class="btn btn-secondary btn-sm" onclick="showUserDetailGlobal('teacher', '${t.id}')">상세 보기</button>`;

    return {
      table: `
      <tr>
        <td>
          <strong class="clickable-name" data-detail-type="teacher" data-detail-id="${t.id}">${t.name}</strong>
          ${t.baptismalName ? `<div style="font-size: 0.78rem; color: var(--text-muted);">(${t.baptismalName})</div>` : ''}
        </td>
        <td>${roleBadge}</td>
        <td>${assignedClassHtml}</td>
        <td><a href="tel:${t.phone}" style="color: var(--primary);">📞 ${t.phone || '-'}</a></td>
        <td>${dualHtml}</td>
        <td>${detailBtn}</td>
      </tr>
    `,
      card: `
      <article class="mobile-data-card">
        <div class="mobile-card-top">
          <div>
            <div class="mobile-card-title">
              <strong class="clickable-name" data-detail-type="teacher" data-detail-id="${t.id}">${t.name}</strong>
              ${t.baptismalName ? `<span style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem;"> (${t.baptismalName})</span>` : ''}
            </div>
            <div class="mobile-card-meta" style="margin-top: 0.3rem;">${roleBadge}${assignedClassHtml}</div>
          </div>
        </div>
        <div class="mobile-card-sub">${t.phone ? `📞 ${t.phone}` : ''}${dualRoles.length ? ` · ${dualRoles.join(', ')}` : ''}</div>
        <div class="mobile-card-actions">${detailBtn}</div>
      </article>
    `
    };
  });

  teachersBody.innerHTML = rows.map(r => r.table).join('');
  setMobileCards(cardList, rows.map(r => r.card).join(''));
}

function renderClassesView() {
  const classes = dataProvider.getClasses();
  const grid = document.getElementById('classesGrid');
  if (!grid) return;

  if (classes.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">등록된 반이 없습니다.</div>';
    return;
  }

  grid.innerHTML = classes.map(cls => {
    const teacherPersons = (cls.teacherPersonIds || [])
      .map(tid => dataProvider.getPersonById(tid))
      .filter(Boolean);
    const teacherHtml = teacherPersons.length > 0
      ? teacherPersons.map(t => `<span class="clickable-name" data-detail-type="teacher" data-detail-id="${t.id}">${t.name}</span>`).join(', ')
      : '<span style="color: var(--text-muted);">미배정</span>';

    // 해당 반 학생 수
    const students = dataProvider.getStudents();
    const classStudents = students.filter(s => cls.grades.includes(s.studentInfo?.grade || ''));

    return `
      <div class="data-table-container" style="padding: 1.1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <div style="font-size: 1.02rem; font-weight: 700; color: var(--primary-dark);">🏫 ${cls.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">${cls.notes || ''}</div>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-secondary btn-sm btn-edit-class" data-id="${cls.id}">편집</button>
            <button class="btn btn-sm btn-delete-class" style="background: #fee2e2; color: #dc2626; border: none; cursor: pointer; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.78rem;" data-id="${cls.id}">삭제</button>
          </div>
        </div>
        <div style="margin-bottom: 0.6rem;">
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem;">학년 구성</div>
          <div>${cls.grades.map(g => `<span class="badge badge-grade" style="margin-right: 0.2rem;">${g}</span>`).join('')}</div>
        </div>
        <div style="margin-bottom: 0.6rem;">
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.3rem;">담당 교사</div>
          <div style="font-size: 0.88rem;">${teacherHtml}</div>
        </div>
        <div style="background: var(--surface-subtle); border-radius: 6px; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">등록 학생</span>
          <span style="font-weight: 700; color: var(--primary);">${classStudents.length}명</span>
        </div>
      </div>
    `;
  }).join('');

  // 편집/삭제 이벤트
  grid.querySelectorAll('.btn-edit-class').forEach(btn => {
    btn.addEventListener('click', () => openEditClassModal(btn.getAttribute('data-id')));
  });
  grid.querySelectorAll('.btn-delete-class').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('이 반을 삭제하시겠습니까?')) {
        dataProvider.deleteClass(btn.getAttribute('data-id'));
        showToast('반이 삭제되었습니다.', '🗑️');
        renderClassesView();
      }
    });
  });
}

// ============================================================
//  반 관리 Modal
// ============================================================
function populateClassModal(editClassId = null) {
  const teachers = dataProvider.getTeachers();
  const teacherCheckboxContainer = document.getElementById('classTeacherCheckboxes');
  teacherCheckboxContainer.innerHTML = teachers.map(t => {
    const primaryRole = dataProvider.getPrimaryTeacherRole(t);
    return `
      <label class="checkbox-item">
        <input type="checkbox" value="${t.id}" class="class-teacher-check" />
        ${t.name} (${t.baptismalName || '-'}) - ${primaryRole?.label || '교사'}
      </label>
    `;
  }).join('');

  if (editClassId) {
    const cls = dataProvider.getClassById(editClassId);
    if (!cls) return;
    document.getElementById('editClassId').value = editClassId;
    document.getElementById('newClassName').value = cls.name;
    document.getElementById('newClassNotes').value = cls.notes || '';
    document.getElementById('addClassModalTitle').textContent = '🏫 반 편집';
    document.getElementById('addClassSubmitBtn').textContent = '변경 저장';

    // 학년 체크
    document.querySelectorAll('#classGradeCheckboxes input[type="checkbox"]').forEach(cb => {
      cb.checked = cls.grades.includes(cb.value);
    });
    // 교사 체크
    document.querySelectorAll('.class-teacher-check').forEach(cb => {
      cb.checked = cls.teacherPersonIds?.includes(cb.value) || false;
    });
  } else {
    document.getElementById('editClassId').value = '';
    document.getElementById('newClassName').value = '';
    document.getElementById('newClassNotes').value = '';
    document.getElementById('addClassModalTitle').textContent = '🏫 새 반 추가';
    document.getElementById('addClassSubmitBtn').textContent = '반 추가';
    document.querySelectorAll('#classGradeCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('.class-teacher-check').forEach(cb => cb.checked = false);
  }
}

function openEditClassModal(classId) {
  populateClassModal(classId);
  openModal('modalAddClass');
}

document.getElementById('btnOpenAddClassModal')?.addEventListener('click', () => {
  populateClassModal(null);
  openModal('modalAddClass');
});

document.getElementById('addClassForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const editId = document.getElementById('editClassId').value;
  const name = document.getElementById('newClassName').value.trim();
  const notes = document.getElementById('newClassNotes').value.trim();
  const grades = Array.from(document.querySelectorAll('#classGradeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
  const teacherPersonIds = Array.from(document.querySelectorAll('.class-teacher-check:checked')).map(cb => cb.value);

  if (editId) {
    dataProvider.updateClass(editId, { name, grades, teacherPersonIds, notes });
    showToast(`"${name}" 반 정보가 수정되었습니다.`, '✏️');
  } else {
    dataProvider.addClass({ name, grades, teacherPersonIds, notes });
    showToast(`"${name}" 반이 추가되었습니다!`, '🏫');
  }
  closeModal('modalAddClass');
  document.getElementById('addClassForm').reset();
  renderClassesView();
  renderDashboard();
});

// ============================================================
//  Season Statistics & Analytics (시즌별 출석 통계 & 그래프)
// ============================================================
function renderStats() {
  const lockedState = document.getElementById('statsLockedState');
  const authContent = document.getElementById('statsAuthContent');

  if (!isUserApproved()) {
    if (lockedState) {
      lockedState.style.display = 'flex';
      lockedState.querySelector('.btn-locked-action')?.addEventListener('click', handleGoogleLogin);
    }
    if (authContent) authContent.style.display = 'none';
    return;
  }

  if (lockedState) lockedState.style.display = 'none';
  if (authContent) authContent.style.display = 'block';

  // 1. Season & Class selectors
  const seasonSelect = document.getElementById('statsSeasonSelect');
  const classSelect = document.getElementById('statsClassSelect');
  const selectedSeason = seasonSelect ? seasonSelect.value : '2026-2027';
  const selectedClass = classSelect ? classSelect.value : 'all';

  // Populate Class Select options if empty
  if (classSelect && classSelect.options.length <= 1) {
    const classes = dataProvider.getClasses();
    classSelect.innerHTML = '<option value="all">🏫 전체 반 통합</option>' +
      classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  // Update Season Period Info Badge
  const periodBadge = document.getElementById('statsSeasonPeriodInfo');
  if (periodBadge) {
    const [startYear, endYear] = selectedSeason.split('-');
    const schoolDays = stats.schoolDayCount || stats.totalWeeks;
    periodBadge.textContent = `📅 시즌 기간: ${startYear}년 9월 ~ ${endYear}년 6월 (학사 수업일 ${schoolDays}회)`;
  }

  // 2. Fetch Aggregated Statistics
  const stats = dataProvider.getSeasonStatistics(selectedSeason, selectedClass);

  // 3. Update KPI Summary Cards
  const kpiOverallRate = document.getElementById('kpiOverallRate');
  const kpiOverallCount = document.getElementById('kpiOverallCount');
  const kpiAvgAttended = document.getElementById('kpiAvgAttended');
  const kpiAvgAttendedSub = document.getElementById('kpiAvgAttendedSub');
  const kpiTotalWeeks = document.getElementById('kpiTotalWeeks');
  const kpiTotalStudents = document.getElementById('kpiTotalStudents');
  const kpiHonoredCount = document.getElementById('kpiHonoredCount');
  const kpiHonoredSub = document.getElementById('kpiHonoredSub');

  const avgAttendedPerWeek = stats.totalWeeks > 0 ? (stats.attendedCount / stats.totalWeeks).toFixed(1) : '0';

  if (kpiOverallRate) kpiOverallRate.textContent = `${stats.overallRate}%`;
  if (kpiOverallCount) kpiOverallCount.textContent = `총 ${stats.attendedCount}회 출석 (출석률 ${stats.overallRate}%)`;
  if (kpiAvgAttended) kpiAvgAttended.textContent = `${avgAttendedPerWeek}명`;
  if (kpiAvgAttendedSub) kpiAvgAttendedSub.textContent = `주차별 평균 출석 (전체 ${stats.totalStudents}명 중)`;
  if (kpiTotalWeeks) kpiTotalWeeks.textContent = `${stats.totalWeeks}주차`;
  if (kpiTotalStudents) kpiTotalStudents.textContent = `등록 학생 ${stats.totalStudents}명`;

  const perfectStudents = stats.topStudents.filter(s => s.isPerfect);
  const honoredStudents = stats.topStudents.filter(s => s.isHonored && !s.isPerfect);
  if (kpiHonoredCount) kpiHonoredCount.textContent = `${perfectStudents.length + honoredStudents.length}명`;
  if (kpiHonoredSub) kpiHonoredSub.textContent = `개근 ${perfectStudents.length}명 • 정근 ${honoredStudents.length}명`;

  // 4. Monthly Attendance Bar Chart (9월 ~ 6월 10개 월)
  const barChartContainer = document.getElementById('monthlyBarChartContainer');
  if (barChartContainer) {
    barChartContainer.innerHTML = `
      <div class="bar-target-line"></div>
      ${stats.monthlyStats.map(m => {
        const heightPct = m.possible > 0 ? Math.min(100, Math.max(m.rate, 0)) : 0;
        const barFillHeight = heightPct > 0 ? `${heightPct}%` : '4px';
        const isTargetMet = m.rate >= 85;
        const colorGradient = isTargetMet
          ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
          : 'linear-gradient(180deg, var(--primary-light) 0%, var(--primary) 100%)';

        return `
          <div class="monthly-bar-col" title="${m.label}: 출석률 ${m.rate}% (${m.attended}/${m.possible}회)">
            <span class="bar-value-label">${m.possible > 0 ? `${m.rate}%` : '-'}</span>
            <div class="bar-track">
              <div class="bar-fill" style="height: ${barFillHeight}; background: ${m.possible > 0 ? colorGradient : 'var(--border)'};"></div>
            </div>
            <span class="bar-month-label">${m.label}</span>
          </div>
        `;
      }).join('')}
    `;
  }

  // 5. Class Breakdown Ranking Progress Bars
  const classRankingList = document.getElementById('classRankingList');
  if (classRankingList) {
    if (stats.classStats.length === 0) {
      classRankingList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">등록된 반이 없습니다.</p>';
    } else {
      classRankingList.innerHTML = stats.classStats.map((c, idx) => {
        const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🏷️'));
        return `
          <div class="class-rank-item">
            <div class="class-rank-header">
              <span style="display: flex; align-items: center; gap: 0.4rem; color: var(--text-main);">
                <span>${medal}</span>
                <span>${c.className}</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">(${c.studentCount}명)</span>
              </span>
              <span style="font-weight: 800; color: var(--primary); font-family: 'Nunito', sans-serif;">
                ${c.rate}%
              </span>
            </div>
            <div class="class-rank-bar-bg">
              <div class="class-rank-bar-fill" style="width: ${c.rate}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 6. Honor Students List (개근 & 정근)
  const honorList = document.getElementById('honorStudentsList');
  if (honorList) {
    const honored = stats.topStudents.filter(s => s.isHonored || s.isPerfect);
    if (honored.length === 0) {
      honorList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">해당 조건의 우수 학생이 없습니다.</p>';
    } else {
      honorList.innerHTML = honored.map(s => {
        const student = s.student;
        const badge = s.isPerfect
          ? '<span class="honor-badge-perfect">🌟 개근상 (100%)</span>'
          : `<span class="honor-badge-good">🏅 정근 (${s.rate}%)</span>`;

        return `
          <div class="honor-student-card">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.2rem;">${s.isPerfect ? '👑' : '⭐'}</span>
              <div>
                <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">
                  ${student.name}
                  <span style="font-size: 0.75rem; color: var(--text-muted);">(${student.baptismalName || '-'})</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                  ${student.studentInfo?.grade || '-'} • ${s.attendedWeeks}/${s.totalWeeks}주 출석 (${s.rate}%)
                </div>
              </div>
            </div>
            <div>${badge}</div>
          </div>
        `;
      }).join('');
    }
  }

  // 7. Weekly History Table
  const weeklyTbody = document.getElementById('statsWeeklyTableBody');
  const weeklyCards = document.getElementById('statsWeeklyCardList');
  if (weeklyTbody) {
    if (stats.weeklyHistory.length === 0) {
      const emptyMsg = '출석 기록이 없습니다.';
      weeklyTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">${emptyMsg}</td></tr>`;
      setMobileCards(weeklyCards, emptyMobileCards(emptyMsg));
    } else {
      const rows = stats.weeklyHistory.map(w => {
        const rateBadgeClass = w.rate >= 85 ? 'badge-present' : (w.rate >= 70 ? 'badge-grace' : 'badge-absent');
        const rateBadge = `
              <span class="badge ${rateBadgeClass}" style="font-family: 'Nunito', sans-serif; font-weight: 800;">
                ${w.rate}%
              </span>
        `;
        return {
          table: `
          <tr>
            <td style="font-weight: 700; font-family: 'Nunito', sans-serif;">📅 ${w.date}</td>
            <td>${rateBadge}</td>
            <td><span style="color: var(--success); font-weight: 700;">${w.present}명</span></td>
            <td><span style="color: var(--danger); font-weight: 700;">${w.absent}명</span></td>
          </tr>
        `,
          card: `
          <article class="mobile-data-card">
            <div class="mobile-card-top">
              <div class="mobile-card-title">📅 ${w.date}</div>
              <div class="mobile-card-side">${rateBadge}</div>
            </div>
            <div class="mobile-card-points">
              <span style="color: var(--success);">출석 ${w.present}명</span>
              <span style="color: var(--danger);">결석 ${w.absent}명</span>
            </div>
          </article>
        `
        };
      });
      weeklyTbody.innerHTML = rows.map(r => r.table).join('');
      setMobileCards(weeklyCards, rows.map(r => r.card).join(''));
    }
  }
}

// ============================================================
//  TAB: Schedule (학사 일정 관리)
// ============================================================
const SCHEDULE_TYPE_LABELS = {
  regular: { label: '정규 수업', icon: '🏫', badgeClass: 'badge-present' },
  special: { label: '특별 행사', icon: '🎉', badgeClass: 'badge-sacrament' },
  holiday: { label: '연휴/방학', icon: '❄️', badgeClass: 'badge-absent' },
};

function canEditSchedule() {
  return isUserApproved();
}

function requireScheduleEditPermission(actionLabel = '일정 수정') {
  if (canEditSchedule()) return true;
  showToast(`🔒 ${actionLabel}은(는) 승인된 교사만 가능합니다. 로그인 후 이용해 주세요.`, '🔒');
  return false;
}

function renderSchedule() {
  const canEdit = canEditSchedule();
  const editActions = document.getElementById('scheduleEditActions');
  const readonlyNotice = document.getElementById('scheduleViewOnlyNotice');
  if (editActions) editActions.style.display = canEdit ? 'flex' : 'none';
  if (readonlyNotice) readonlyNotice.style.display = canEdit ? 'none' : 'block';

  const seasonId = document.getElementById('scheduleSeasonFilter')?.value || '2026-2027';
  const typeFilter = document.getElementById('scheduleTypeFilter')?.value || 'all';
  const now = new Date();
  const todayStr = getTodayISO();

  let schedules = dataProvider.getSchedules(seasonId);

  // Type filter
  if (typeFilter === 'school_only') schedules = schedules.filter(s => s.hasSchool);
  else if (typeFilter === 'special') schedules = schedules.filter(s => s.type === 'special');
  else if (typeFilter === 'holiday') schedules = schedules.filter(s => s.type === 'holiday' || !s.hasSchool);

  // KPI summary
  const allSeason = dataProvider.getSchedules(seasonId);
  const schoolDays = allSeason.filter(s => s.hasSchool).length;
  const specialDays = allSeason.filter(s => s.type === 'special').length;
  const nextSchool = dataProvider.getNextUpcomingSchoolDate(now);

  const kpiTotal = document.getElementById('schStatTotalCount');
  const kpiSchool = document.getElementById('schStatSchoolCount');
  const kpiSpecial = document.getElementById('schStatSpecialCount');
  const kpiDDay = document.getElementById('schStatNextDDay');
  const kpiTitle = document.getElementById('schStatNextTitle');

  if (kpiTotal) kpiTotal.textContent = `${allSeason.length}개`;
  if (kpiSchool) kpiSchool.textContent = `${schoolDays}회`;
  if (kpiSpecial) kpiSpecial.textContent = `${specialDays}일`;
  if (kpiDDay) kpiDDay.textContent = nextSchool ? `D-${nextSchool.daysLeft}` : '-';
  if (kpiTitle) kpiTitle.textContent = nextSchool ? (nextSchool.title || '다음 모임일') : '다음 모임일';

  // Table
  const tbody = document.getElementById('scheduleTableBody');
  const cardList = document.getElementById('scheduleCardList');
  if (!tbody) return;

  // 관리 열 헤더 표시 여부
  const manageHeader = document.querySelector('#scheduleTable thead th:last-child');
  if (manageHeader) manageHeader.style.display = canEdit ? '' : 'none';

  if (schedules.length === 0) {
    const emptyMsg = '등록된 일정이 없습니다.';
    tbody.innerHTML = `<tr><td colspan="${canEdit ? 6 : 5}" style="text-align:center; color:var(--text-muted); padding: 2rem;">${emptyMsg}</td></tr>`;
    setMobileCards(cardList, emptyMobileCards(emptyMsg));
    return;
  }

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const rows = schedules.map(sch => {
    const d = new Date(sch.date + 'T00:00:00');
    const dow = weekDays[d.getDay()];
    const isPast = sch.date < todayStr;
    const isToday = sch.date === todayStr;
    const typeInfo = SCHEDULE_TYPE_LABELS[sch.type] || SCHEDULE_TYPE_LABELS.regular;
    const rowStyle = isPast ? 'opacity: 0.55;' : isToday ? 'background: var(--primary-soft); font-weight: 700;' : '';
    const cardClass = `mobile-data-card${isPast ? ' is-past' : ''}${isToday ? ' is-today' : ''}`;
    const typeBadge = `<span class="badge ${typeInfo.badgeClass}" style="font-size: 0.75rem;">${typeInfo.icon} ${typeInfo.label}</span>`;
    const hasSchoolCell = canEdit
      ? (sch.hasSchool
        ? `<button class="badge badge-present btn-toggle-school" data-id="${sch.id}" style="cursor:pointer; border:none; padding: 0.3rem 0.75rem; font-size: 0.78rem;">🏫 수업 있음</button>`
        : `<button class="badge badge-absent btn-toggle-school" data-id="${sch.id}" style="cursor:pointer; border:none; padding: 0.3rem 0.75rem; font-size: 0.78rem;">❌ 휴교</button>`)
      : (sch.hasSchool
        ? `<span class="badge badge-present" style="padding: 0.3rem 0.75rem; font-size: 0.78rem;">🏫 수업 있음</span>`
        : `<span class="badge badge-absent" style="padding: 0.3rem 0.75rem; font-size: 0.78rem;">❌ 휴교</span>`);

    const manageBtns = canEdit
      ? `
          <button class="btn btn-secondary btn-sm btn-edit-schedule" data-id="${sch.id}" style="font-size: 0.75rem; padding: 0.2rem 0.55rem;">수정</button>
          <button class="btn btn-secondary btn-sm btn-delete-schedule" data-id="${sch.id}" style="font-size: 0.75rem; padding: 0.2rem 0.55rem; color: var(--danger);">삭제</button>
        `
      : '';
    const manageCell = canEdit
      ? `<td style="white-space: nowrap;">${manageBtns}</td>`
      : '';

    return {
      table: `
      <tr style="${rowStyle}">
        <td style="font-family: 'Nunito', sans-serif; font-weight: 700; white-space: nowrap;">
          ${isToday ? '⭐ ' : ''}${sch.date}<br>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">(${dow}요일)</span>
        </td>
        <td>${typeBadge}</td>
        <td>${hasSchoolCell}</td>
        <td style="font-weight: 600; font-size: 0.88rem;">${sch.title}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${sch.notes || ''}</td>
        ${manageCell}
      </tr>
    `,
      card: `
      <article class="${cardClass}">
        <div class="mobile-card-top">
          <div>
            <div class="mobile-card-sub">${isToday ? '⭐ ' : ''}${sch.date} (${dow})</div>
            <div class="mobile-card-title">${sch.title}</div>
          </div>
          <div class="mobile-card-side">${typeBadge}</div>
        </div>
        <div class="mobile-card-meta">${hasSchoolCell}</div>
        ${sch.notes ? `<div class="mobile-card-sub">${sch.notes}</div>` : ''}
        ${canEdit ? `<div class="mobile-card-actions">${manageBtns}</div>` : ''}
      </article>
    `
    };
  });

  tbody.innerHTML = rows.map(r => r.table).join('');
  setMobileCards(cardList, rows.map(r => r.card).join(''));

  if (!canEdit) return;

  const roots = [tbody, cardList];

  // Toggle school button
  bindInRoots(roots, '.btn-toggle-school', (e) => {
    const btn = e.currentTarget;
    if (!requireScheduleEditPermission('수업/휴교 전환')) return;
    const id = btn.getAttribute('data-id');
    dataProvider.toggleScheduleHasSchool(id);
    renderSchedule();
    renderDashboard();
  });

  // Edit button
  bindInRoots(roots, '.btn-edit-schedule', (e) => {
    const btn = e.currentTarget;
    if (!requireScheduleEditPermission('일정 수정')) return;
    const id = btn.getAttribute('data-id');
    const sch = dataProvider.getScheduleById(id);
    if (!sch) return;

    document.getElementById('editScheduleId').value = sch.id;
    document.getElementById('modalScheduleTitle').textContent = '✏️ 주일학교 학사 일정 수정';
    document.getElementById('newScheduleSeason').value = sch.seasonId || '2026-2027';
    document.getElementById('newScheduleDate').value = sch.date;
    document.getElementById('newScheduleTitle').value = sch.title;
    document.getElementById('newScheduleType').value = sch.type || 'regular';
    document.getElementById('newScheduleHasSchool').checked = sch.hasSchool !== false;
    document.getElementById('newScheduleNotes').value = sch.notes || '';
    openModal('modalAddSchedule');
  });

  // Delete button
  bindInRoots(roots, '.btn-delete-schedule', (e) => {
    const btn = e.currentTarget;
    if (!requireScheduleEditPermission('일정 삭제')) return;
    const id = btn.getAttribute('data-id');
    const sch = dataProvider.getScheduleById(id);
    if (sch && confirm(`"${sch.title}" 일정을 삭제하시겠습니까?`)) {
      dataProvider.deleteSchedule(id);
      showToast('일정이 삭제되었습니다.', '🗑️');
      renderSchedule();
      renderDashboard();
    }
  });
}

// Schedule event listeners
document.getElementById('scheduleSeasonFilter')?.addEventListener('change', renderSchedule);
document.getElementById('scheduleTypeFilter')?.addEventListener('change', renderSchedule);

// 새 일정 등록 버튼 (모달 열기)
document.getElementById('btnOpenAddSchedule')?.addEventListener('click', () => {
  if (!requireScheduleEditPermission('일정 등록')) return;
  document.getElementById('editScheduleId').value = '';
  document.getElementById('modalScheduleTitle').textContent = '📅 새 학사 일정 등록';
  document.getElementById('addScheduleForm').reset();
  const currentSeason = document.getElementById('scheduleSeasonFilter')?.value || '2026-2027';
  document.getElementById('newScheduleSeason').value = currentSeason === 'all' ? getCurrentSeasonId() : currentSeason;
  document.getElementById('newScheduleHasSchool').checked = true;
  
  // 기본 날짜: 오늘 날짜
  const todayStr = getTodayISO();
  document.getElementById('newScheduleDate').value = todayStr;
  
  openModal('modalAddSchedule');
});

// 일정 구분 변경 시 hasSchool 자동 토글
document.getElementById('newScheduleType')?.addEventListener('change', (e) => {
  const hasSchoolCheckbox = document.getElementById('newScheduleHasSchool');
  if (hasSchoolCheckbox) {
    if (e.target.value === 'holiday') {
      hasSchoolCheckbox.checked = false;
    } else {
      hasSchoolCheckbox.checked = true;
    }
  }
});

// 학사 일정 폼 제출 (추가 / 수정)
document.getElementById('addScheduleForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!requireScheduleEditPermission('일정 저장')) return;
  const id = document.getElementById('editScheduleId')?.value;
  const seasonId = document.getElementById('newScheduleSeason')?.value || '2026-2027';
  const date = document.getElementById('newScheduleDate')?.value;
  const title = document.getElementById('newScheduleTitle')?.value?.trim();
  const type = document.getElementById('newScheduleType')?.value || 'regular';
  const hasSchool = document.getElementById('newScheduleHasSchool')?.checked ?? true;
  const notes = document.getElementById('newScheduleNotes')?.value?.trim() || '';

  if (!date || !title) {
    showToast('날짜와 일정 제목을 입력해주세요.', '⚠️');
    return;
  }

  if (id) {
    dataProvider.updateSchedule(id, { seasonId, date, title, type, hasSchool, notes });
    showToast(`✅ "${title}" 일정이 수정되었습니다.`, '📅');
  } else {
    dataProvider.addSchedule({ seasonId, date, title, type, hasSchool, notes });
    showToast(`✅ "${title}" 일정이 등록되었습니다.`, '📅');
  }

  closeModal('modalAddSchedule');
  renderSchedule();
  renderDashboard();
});

// 시즌 일정 초기화 (학사 일정만 — 출석/학생/은총 유지)
document.getElementById('btnResetSeasonSchedules')?.addEventListener('click', () => {
  if (!requireScheduleEditPermission('시즌 일정 초기화')) return;
  const seasonId = document.getElementById('scheduleSeasonFilter')?.value || getCurrentSeasonId();
  if (seasonId === 'all') {
    showToast('시즌을 선택한 뒤 초기화해 주세요.', '⚠️');
    return;
  }
  if (confirm(`${seasonId} 시즌 학사 일정을 기본 샘플로 초기화합니까?\n(출석·학생·은총 데이터는 유지됩니다)`)) {
    const count = dataProvider.resetSeasonSchedules(seasonId);
    showToast(count > 0
      ? `${seasonId} 학사 일정 ${count}건으로 복구했습니다.`
      : `${seasonId} 기본 시드가 없어 일정을 비웠습니다.`, '⚡');
    renderSchedule();
    renderDashboard();
    renderStats();
    renderAttendance();
  }
});

// D-day 배너의 일정 관리 바로가기 버튼
document.getElementById('btnQuickSchedule')?.addEventListener('click', () => {
  navTabs.forEach(b => b.classList.remove('active'));
  tabPanels.forEach(p => p.classList.remove('active'));
  const scheduleTab = document.querySelector('[data-tab="schedule"]');
  if (scheduleTab) scheduleTab.classList.add('active');
  const schedulePanel = document.getElementById('panel-schedule');
  if (schedulePanel) schedulePanel.classList.add('active');
  currentTab = 'schedule';
  renderSchedule();
});

// ============================================================
//  Tab Switching & Events
// ============================================================
navTabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    navTabs.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) targetPanel.classList.add('active');
    currentTab = tabName;
    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'schedule') renderSchedule();
    if (tabName === 'attendance') renderAttendance();
    if (tabName === 'stats') renderStats();
    if (tabName === 'activities') renderActivities();
    if (tabName === 'grace') renderGraceBank();
    if (tabName === 'students') renderDirectory();
  });
});

// Stats Filter Listeners
document.getElementById('statsSeasonSelect')?.addEventListener('change', () => renderStats());
document.getElementById('statsClassSelect')?.addEventListener('change', () => renderStats());

// Directory view switch (학생/학부모/교사/반)
document.querySelectorAll('#directoryTabSwitch .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#directoryTabSwitch .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDirectoryView = btn.getAttribute('data-dir');

    // 컨테이너 표시/숨김
    const containers = {
      students: document.getElementById('studentsContainer'),
      parents: document.getElementById('parentsContainer'),
      teachers: document.getElementById('teachersContainer'),
      classes: document.getElementById('classesContainer'),
    };
    Object.entries(containers).forEach(([key, el]) => {
      if (el) el.style.display = (key === currentDirectoryView) ? 'block' : 'none';
    });

    // 추가 버튼 표시/숨김 (반 구성에서는 숨김)
    const actionBtns = document.getElementById('directoryActionBtns');
    if (actionBtns) {
      actionBtns.style.display = (currentDirectoryView === 'classes' || currentDirectoryView === 'teachers') ? 'none' : '';
    }

    renderDirectory();
  });
});

// Date pickers
const attDatePicker = document.getElementById('attDatePicker');
if (attDatePicker) {
  attDatePicker.value = getTodayDateString();
  attDatePicker.addEventListener('change', () => { renderAttendance(); renderDashboard(); });
}
const actDateInput = document.getElementById('actDate');
if (actDateInput) actDateInput.value = getTodayDateString();

// Attendance grade filter
document.querySelectorAll('#attGradeFilterGroup .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#attGradeFilterGroup .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAttGradeFilter = btn.getAttribute('data-filter');
    renderAttendance();
  });
});

// Grace bank grade filter
document.querySelectorAll('#graceGradeFilter .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#graceGradeFilter .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentGraceGradeFilter = btn.getAttribute('data-filter');
    renderGraceBank();
  });
});

document.getElementById('graceSearchInput')?.addEventListener('input', () => renderGraceBank());
document.getElementById('directorySearchInput')?.addEventListener('input', () => renderDirectory());

// 전원 출석
document.getElementById('btnMarkAllPresent')?.addEventListener('click', () => {
  const selectedDate = attDatePicker.value || getTodayDateString();
  if (dataProvider.isSchoolDay(selectedDate) === false) {
    const ok = confirm('선택한 날짜는 학사 일정 상 휴교일입니다. 그래도 전원 출석을 기록할까요?');
    if (!ok) return;
  }
  const students = dataProvider.getStudents();
  const filtered = students.filter(st => matchGradeGroup(st.studentInfo?.grade || '', currentAttGradeFilter));
  filtered.forEach(st => {
    dataProvider.recordAttendance({ date: selectedDate, studentId: st.id, status: '출석', massAttended: true, recordedBy: '교사회 일괄 체크' });
  });
  showToast(`${filtered.length}명 전원 출석(+미사) 체크 완료!`, '🎉');
  renderAttendance();
  renderDashboard();
  renderStats();
});

// Activity dept -> points
document.getElementById('actDeptSelect')?.addEventListener('change', (e) => {
  const settings = dataProvider.getSettings();
  const pts = settings.activityPoints[e.target.value] || 10;
  document.getElementById('actPoints').value = pts;
});

// Activity form
document.getElementById('activityForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('actDate').value;
  const studentId = document.getElementById('actStudentSelect').value;
  const department = document.getElementById('actDeptSelect').value;
  const roleDetail = document.getElementById('actRoleDetail').value;
  const points = Number(document.getElementById('actPoints').value);
  dataProvider.recordActivity({ date, studentId, department, roleDetail, pointsEarned: points, recordedBy: '담당 교사' });
  showToast(`활동 봉사 기록 및 은총표 +${points} P 적립 완료`, '🕊️');
  document.getElementById('actRoleDetail').value = '';
  renderActivities();
  renderDashboard();
});

// Bonus points modal
document.getElementById('btnOpenBonusModal')?.addEventListener('click', () => {
  const students = dataProvider.getStudents();
  const sel = document.getElementById('bonusStudentSelect');
  sel.innerHTML = '<option value="">학생을 선택하세요...</option>' +
    students.map(s => `<option value="${s.id}">${s.name} (${s.baptismalName || '세례명 없음'}, ${s.studentInfo?.grade || '-'})</option>`).join('');
  openModal('modalBonusPoints');
});

document.getElementById('bonusPointsForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const studentId = document.getElementById('bonusStudentSelect').value;
  const amount = Number(document.getElementById('bonusAmount').value);
  const reason = document.getElementById('bonusReason').value;
  const issuer = document.getElementById('bonusIssuer').value;
  dataProvider.addBonusPoints({ studentId, amount, reason, issuedBy: issuer });
  showToast(`은총표 ${amount >= 0 ? '+' : ''}${amount} P 처리 완료!`, '🪙');
  closeModal('modalBonusPoints');
  renderGraceBank();
  renderDashboard();
  renderDirectory();
});

// Add Student modal
document.getElementById('btnOpenAddStudentModal')?.addEventListener('click', () => {
  const parents = dataProvider.getParents();
  const sel = document.getElementById('newStudentParent');
  sel.innerHTML = '<option value="">학부모를 선택하세요 (선택)...</option>' +
    parents.map(p => `<option value="${p.id}">${p.name} (${p.baptismalName || '-'}, ${p.phone || '-'})</option>`).join('');
  openModal('modalAddStudent');
});

document.getElementById('addStudentForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('newStudentName').value.trim();
  const baptismalName = document.getElementById('newStudentBaptismal').value.trim();
  const grade = document.getElementById('newStudentGrade').value;
  const gender = document.getElementById('newStudentGender').value;
  const feastDay = document.getElementById('newStudentFeastDay').value.trim();
  const parentId = document.getElementById('newStudentParent').value;
  const firstCommunion = document.getElementById('newStudentFirstCommunion').checked;
  const confirmation = document.getElementById('newStudentConfirmation').checked;
  const notes = document.getElementById('newStudentNotes').value.trim();
  const departments = Array.from(document.querySelectorAll('#deptCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);

  dataProvider.addStudent({
    name, baptismalName, grade, gender, feastDay,
    parentPersonIds: parentId ? [parentId] : [],
    firstCommunion, confirmation, departments, notes,
  });
  showToast(`${name} 학생이 성공적으로 등록되었습니다!`, '🎉');
  closeModal('modalAddStudent');
  document.getElementById('addStudentForm').reset();
  renderDirectory();
  renderDashboard();
  renderAttendance();
});

// Add Parent modal
document.getElementById('btnOpenAddParentModal')?.addEventListener('click', () => openModal('modalAddParent'));

document.getElementById('addParentForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('newParentName').value.trim();
  const baptismalName = document.getElementById('newParentBaptismal').value.trim();
  const phone = document.getElementById('newParentPhone').value.trim();
  const isTeacher = document.getElementById('newParentIsTeacher').checked;
  const parent2Name = document.getElementById('newParent2Name').value.trim();
  const parent2Baptismal = document.getElementById('newParent2Baptismal').value.trim();
  const parent2Phone = document.getElementById('newParent2Phone').value.trim();
  const parent2IsTeacher = document.getElementById('newParent2IsTeacher').checked;
  const address = document.getElementById('newParentAddress').value.trim();

  // 학부모 1 등록
  const newParent1 = dataProvider.addParent({ name, baptismalName, phone, isTeacher, address });

  // 학부모 2가 있는 경우 별도 등록 후 배우자 연결
  if (parent2Name) {
    const newParent2 = dataProvider.addParent({
      name: parent2Name, baptismalName: parent2Baptismal,
      phone: parent2Phone, isTeacher: parent2IsTeacher, address,
      spousePersonId: newParent1.id,
    });
    // 배우자 ID 상호 연결
    dataProvider.updatePerson(newParent1.id, {
      parentInfo: { ...newParent1.parentInfo, spousePersonId: newParent2.id }
    });
  }

  showToast(`${name} 학부모님이 성공적으로 등록되었습니다!`, '🎉');
  closeModal('modalAddParent');
  document.getElementById('addParentForm').reset();
  renderDirectory();
});

// Reset data
btnResetData?.addEventListener('click', () => {
  if (confirm('모든 데이터를 초기 샘플 데이터로 복구하시겠습니까?')) {
    dataProvider.resetToDefaults();
    showToast('샘플 데이터로 초기화되었습니다.', '🔄');
    renderDashboard();
    renderSchedule();
    renderAttendance();
    renderStats();
    renderActivities();
    renderGraceBank();
    renderDirectory();
  }
});

// Global click delegate for clickable names & parent detail buttons
document.addEventListener('click', (e) => {
  const target = e.target.closest('.clickable-name');
  if (target) {
    const type = target.getAttribute('data-detail-type');
    const id = target.getAttribute('data-detail-id');
    if (type && id) showUserDetail(type, id);
  }
});

// Global function for inline onclick calls in rendered HTML
window.showUserDetailGlobal = (type, id) => showUserDetail(type, id);

// ============================================================
//  Initial Boot
// ============================================================
function initApp() {
  initTheme();
  initAuthUI();
  populateSeasonSelects();
  updateSeasonHeaderBadge();
  renderDashboard();
  renderSchedule();
  renderAttendance();
  renderStats();
  renderActivities();
  renderGraceBank();
  renderDirectory();
}

window.addEventListener('DOMContentLoaded', initApp);
