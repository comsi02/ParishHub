// main.js
// church-catechesis 주일학교 & 은총표 관리 애플리케이션 진입점
// v2 - 통합 Person 모델 + 자유 합반(Class) 구조

import { dataProvider } from './services/DataProvider.js';
import { GRADES, GRADE_SORT_MAP, DEPARTMENTS, PERSON_ROLES, getRecentSaturday } from './mock/sampleData.js';

// --- State ---
let currentTab = 'dashboard';
let currentAttGradeFilter = 'all';
let currentGraceGradeFilter = 'all';
let currentDirectoryView = 'students'; // 'students' | 'parents' | 'teachers' | 'classes'

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
  return getSaturdayDateString();
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

    // 배우자 정보
    let spouseHtml = '<span style="color: var(--text-muted);">미등록 (한 분만 등록)</span>';
    const spouseId = person.parentInfo?.spousePersonId;
    if (spouseId) {
      const spouse = dataProvider.getPersonById(spouseId);
      if (spouse) {
        const spouseTeacher = spouse.roles && spouse.roles.some(r => teacherRoles.includes(r));
        const spouseBadge = spouseTeacher
          ? `<span class="badge badge-sacrament" style="font-size: 0.7rem;">${getPrimaryRoleLabel(spouse)}</span>`
          : '';
        spouseHtml = `
          <span class="clickable-name" data-detail-type="parent" data-detail-id="${spouse.id}">${spouse.name}</span>
          ${spouse.baptismalName ? `(${spouse.baptismalName})` : ''} ${spouseBadge}
          ${spouse.phone ? `• 📞 <a href="tel:${spouse.phone}">${spouse.phone}</a>` : ''}
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
        <div class="detail-label">학부모 1 (세례명)</div>
        <div class="detail-value">
          ${person.name} ${person.baptismalName ? `(${person.baptismalName})` : ''}
          ${isTeacher ? `<div style="margin-top: 0.2rem;"><span class="badge badge-sacrament" style="font-size: 0.72rem;">✝ ${getPrimaryRoleLabel(person)}</span></div>` : ''}
        </div>
      </div>
      <div class="detail-item">
        <div class="detail-label">학부모 2 / Spouse (세례명)</div>
        <div class="detail-value">${spouseHtml}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">학부모 1 연락처</div>
        <div class="detail-value">📞 <a href="tel:${person.phone}">${person.phone || '-'}</a></div>
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
//  TAB 1: Dashboard
// ============================================================
function renderDashboard() {
  const students = dataProvider.getStudents();
  const teachers = dataProvider.getTeachers();
  const today = document.getElementById('attDatePicker')?.value || getTodayDateString();
  const attendanceToday = dataProvider.getAttendance(today);
  const activitiesToday = dataProvider.getActivities(today);
  const allLedger = dataProvider.getGraceLedger();

  const totalGrace = allLedger.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const attendedCount = attendanceToday.filter(a => a.status === '출석' || a.status === '지각').length;

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
        return `
          <div class="feast-student-item">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div class="avatar" style="width: 38px; height: 38px; font-size: 0.95rem; background: #fef3c7; color: #b45309; border: 1px solid #fcd34d;">
                ${st.name.charAt(0)}
              </div>
              <div>
                <div style="font-weight: 700; font-size: 0.92rem;">
                  <span class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</span>
                  <span style="font-size: 0.8rem; font-weight: normal; color: #92400e;">(${st.baptismalName || '세례명'})</span>
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
  if (top5.length === 0) {
    topTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">학생 데이터가 없습니다.</td></tr>';
  } else {
    topTableBody.innerHTML = top5.map((st, idx) => {
      const rankMedal = idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`;
      const depts = (st.studentInfo?.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '<span style="color: var(--text-muted); font-size: 0.75rem;">-</span>';
      return `
        <tr>
          <td style="font-weight: 700; color: var(--primary);">${rankMedal}</td>
          <td>
            <strong class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</strong>
            ${st.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.8rem;">(${st.baptismalName})</span>` : ''}
          </td>
          <td><span class="badge badge-grade">${st.studentInfo?.grade || '-'}</span></td>
          <td>${depts}</td>
          <td style="text-align: right;">
            <span class="grace-badge"><span class="coin">🪙</span> ${st.totalGracePoints.toLocaleString()} P</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- 교사회 명단 (대시보드 우측) ---
  const teachersContainer = document.getElementById('teachersList');
  if (teachersContainer) {
    teachersContainer.innerHTML = teachers.map(t => {
      const primaryRole = dataProvider.getPrimaryTeacherRole(t);
      const roleBadgeClass = primaryRole?.role === 'principal' ? 'badge-sacrament' :
                              primaryRole?.role === 'vice_principal' ? 'badge-grade' : 'badge-present';
      const parentBadge = t.roles?.includes('parent')
        ? '<span class="badge badge-grade" style="font-size: 0.7rem; margin-left: 0.3rem;">👨‍👩‍👧 학부모</span>'
        : '';
      const specialBadges = (t.roles || [])
        .filter(r => ['liturgy_teacher', 'acolyte_teacher'].includes(r))
        .map(r => `<span class="badge badge-sacrament" style="font-size: 0.65rem; margin-left: 0.2rem;">${PERSON_ROLES[r]?.icon || ''}</span>`)
        .join('');
      return `
        <div style="background: var(--surface-subtle); padding: 0.65rem 0.85rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main); display: flex; align-items: center; flex-wrap: wrap; gap: 0.2rem;">
              <span class="clickable-name" data-detail-type="teacher" data-detail-id="${t.id}">${t.name}</span>
              <span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;">(${t.baptismalName || '-'})</span>
              ${parentBadge}${specialBadges}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">
              📞 <a href="tel:${t.phone}" style="color: inherit; text-decoration: underline;">${t.phone || '-'}</a>
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
  const dateInput = document.getElementById('attDatePicker');
  const selectedDate = dateInput.value || getTodayDateString();
  const students = dataProvider.getStudents();
  const attendanceList = dataProvider.getAttendance(selectedDate);
  const attendanceGrid = document.getElementById('attendanceGrid');

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

        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div class="att-button-row">
            <button class="btn-att-toggle ${status === '출석' ? 'active-present' : ''}" data-status="출석" data-id="${st.id}">
              ✓ 출석 (+10)
            </button>
            <button class="btn-att-toggle ${status === '지각' ? 'active-late' : ''}" data-status="지각" data-id="${st.id}">
              ⏰ 지각 (+5)
            </button>
            <button class="btn-att-toggle ${status === '결석' ? 'active-absent' : ''}" data-status="결석" data-id="${st.id}">
              ✕ 결석
            </button>
          </div>
          <label class="mass-checkbox-label">
            <input type="checkbox" class="att-mass-check" data-id="${st.id}" ${massAttended ? 'checked' : ''} />
            주일 미사 참례 (+5 P)
          </label>
        </div>
      </div>
    `;
  }).join('');

  // 출석 버튼 이벤트
  attendanceGrid.querySelectorAll('.btn-att-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.getAttribute('data-id');
      const newStatus = btn.getAttribute('data-status');
      const card = btn.closest('.student-att-card');
      const massChecked = card.querySelector('.att-mass-check').checked;
      dataProvider.recordAttendance({ date: selectedDate, studentId, status: newStatus, massAttended: massChecked, recordedBy: '담당 선생님' });
      showToast(`${newStatus} 체크 완료 (은총표 자동 반영)`, '✅');
      renderAttendance();
      renderDashboard();
    });
  });

  // 미사 참례 체크
  attendanceGrid.querySelectorAll('.att-mass-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const studentId = chk.getAttribute('data-id');
      const currentAtt = dataProvider.getAttendance(selectedDate).find(
        a => a.studentPersonId === studentId || a.studentId === studentId
      );
      const curStatus = currentAtt ? currentAtt.status : '출석';
      dataProvider.recordAttendance({ date: selectedDate, studentId, status: curStatus, massAttended: chk.checked, recordedBy: '담당 선생님' });
      showToast('미사 참례 여부 변경 완료', '⛪');
      renderAttendance();
      renderDashboard();
    });
  });
}

// ============================================================
//  TAB 3: Activities
// ============================================================
function renderActivities() {
  const students = dataProvider.getStudents();
  const allActivities = dataProvider.getActivities();
  const select = document.getElementById('actStudentSelect');
  const tableBody = document.querySelector('#activityHistoryTable tbody');

  const prevVal = select.value;
  select.innerHTML = '<option value="">봉사 학생을 선택하세요...</option>' +
    students.map(s => `<option value="${s.id}">${s.name} (${s.baptismalName || '세례명 없음'}, ${s.studentInfo?.grade || '-'})</option>`).join('');
  if (prevVal) select.value = prevVal;

  const sorted = [...allActivities].reverse();
  document.getElementById('activityListCount').textContent = `${sorted.length}건`;

  if (sorted.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">기록된 활동 봉사 내역이 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = sorted.map(act => {
    const st = students.find(s => s.id === (act.studentPersonId || act.studentId));
    const stName = st ? `${st.name} (${st.baptismalName || '-'}, ${st.studentInfo?.grade || '-'})` : '알 수 없음';
    return `
      <tr>
        <td style="white-space: nowrap;">${act.date}</td>
        <td><strong class="clickable-name" data-detail-type="student" data-detail-id="${act.studentPersonId || act.studentId}">${stName}</strong></td>
        <td><span class="dept-tag">${act.department}</span></td>
        <td>${act.roleDetail || '-'}</td>
        <td style="text-align: right;"><span class="grace-badge"><span class="coin">🪙</span> +${act.pointsEarned} P</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${act.recordedBy || '선생님'}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================
//  TAB 4: Grace Bank
// ============================================================
function renderGraceBank() {
  const students = dataProvider.getStudents();
  const ledger = dataProvider.getGraceLedger();
  const search = document.getElementById('graceSearchInput')?.value.trim().toLowerCase() || '';
  const tableBody = document.querySelector('#graceOverviewTable tbody');

  let filtered = students.filter(st => {
    const matchSearch = !search ||
      st.name.toLowerCase().includes(search) ||
      (st.baptismalName && st.baptismalName.toLowerCase().includes(search));
    const matchGrade = matchGradeGroup(st.studentInfo?.grade || '', currentGraceGradeFilter);
    return matchSearch && matchGrade;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">일치하는 학생이 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = filtered.map(st => {
    const studentLedger = ledger.filter(l => l.studentPersonId === st.id || l.studentId === st.id);
    const attPts = studentLedger.filter(l => l.type === '출석').reduce((s, i) => s + Number(i.amount || 0), 0);
    const actPts = studentLedger.filter(l => l.type === '활동').reduce((s, i) => s + Number(i.amount || 0), 0);
    const bonusPts = studentLedger.filter(l => l.type === '추가점수' || l.type === '사용/차감').reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalPts = attPts + actPts + bonusPts;
    const depts = (st.studentInfo?.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '-';

    return `
      <tr>
        <td>
          <strong class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</strong>
          ${st.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.82rem;">(${st.baptismalName})</span>` : ''}
        </td>
        <td><span class="badge badge-grade">${st.studentInfo?.grade || '-'}</span></td>
        <td>${depts}</td>
        <td style="text-align: center; color: #059669; font-weight: 600;">+${attPts}</td>
        <td style="text-align: center; color: #7c3aed; font-weight: 600;">+${actPts}</td>
        <td style="text-align: center; font-weight: 600; color: ${bonusPts >= 0 ? '#2563eb' : '#dc2626'};">${bonusPts >= 0 ? '+' : ''}${bonusPts}</td>
        <td style="text-align: right;">
          <span class="grace-badge" style="font-size: 0.95rem;">
            <span class="coin">🪙</span> ${totalPts.toLocaleString()} P
          </span>
        </td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-sm btn-view-ledger" data-id="${st.id}">원장 조회</button>
          <button class="btn btn-grace btn-sm btn-quick-bonus" data-id="${st.id}" style="margin-left: 0.25rem;">+ 점수</button>
        </td>
      </tr>
    `;
  }).join('');

  tableBody.querySelectorAll('.btn-view-ledger').forEach(btn => {
    btn.addEventListener('click', () => showGraceLedgerModal(btn.getAttribute('data-id')));
  });
  tableBody.querySelectorAll('.btn-quick-bonus').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('bonusStudentSelect').value = btn.getAttribute('data-id');
      openModal('modalBonusPoints');
    });
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
    studentsBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">등록된 학생이 없습니다.</td></tr>';
    return;
  }

  studentsBody.innerHTML = filtered.map(st => {
    const si = st.studentInfo || {};
    const parents = dataProvider.getParentsOfStudent(st.id);
    const parentInfo = parents.length > 0
      ? parents.map(p => `<span class="clickable-name" data-detail-type="parent" data-detail-id="${p.id}">${p.name}</span>`).join(' / ')
        + (parents[0]?.phone ? ` (<a href="tel:${parents[0].phone}" style="color: var(--primary);">${parents[0].phone}</a>)` : '')
      : '<span style="color: var(--text-muted);">-</span>';
    const sacraments = [];
    if (si.firstCommunion) sacraments.push('<span class="badge badge-sacrament">첫영성체</span>');
    if (si.confirmation) sacraments.push('<span class="badge badge-sacrament">견진</span>');
    const depts = (si.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '-';
    const className = getClassNameForGrade(si.grade || '');

    return `
      <tr>
        <td>
          <strong class="clickable-name" data-detail-type="student" data-detail-id="${st.id}">${st.name}</strong>
          ${st.baptismalName ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${st.baptismalName}</div>` : ''}
        </td>
        <td>
          <span class="badge badge-grade">${si.grade || '-'}</span>
          ${className !== si.grade ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">${className}</div>` : ''}
        </td>
        <td>${si.gender || '-'}</td>
        <td>${si.feastDay ? `📅 ${si.feastDay}` : '<span style="color: var(--text-muted); font-size: 0.78rem;">해당없음</span>'}</td>
        <td>${sacraments.join(' ') || '<span style="color: var(--text-muted); font-size: 0.78rem;">미수품</span>'}</td>
        <td>${depts}</td>
        <td>${parentInfo}</td>
        <td><span class="grace-badge"><span class="coin">🪙</span> ${st.totalGracePoints} P</span></td>
        <td>
          <button class="btn btn-secondary btn-sm btn-quick-bonus" data-id="${st.id}">+ 점수</button>
        </td>
      </tr>
    `;
  }).join('');

  studentsBody.querySelectorAll('.btn-quick-bonus').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('bonusStudentSelect').value = btn.getAttribute('data-id');
      openModal('modalBonusPoints');
    });
  });
}

function renderParentsDirectory(search = '') {
  const parents = dataProvider.getParents();
  const parentsBody = document.querySelector('#parentsTable tbody');

  const filtered = parents.filter(p => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search) ||
           (p.baptismalName && p.baptismalName.toLowerCase().includes(search)) ||
           (p.phone && p.phone.includes(search)) ||
           (p.address && p.address.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    parentsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">등록된 학부모가 없습니다.</td></tr>';
    return;
  }

  parentsBody.innerHTML = filtered.map(p => {
    const teacherRoles = dataProvider.getTeacherRoles();
    const isTeacher = p.roles && p.roles.some(r => teacherRoles.includes(r));
    const p1TeacherBadge = isTeacher
      ? `<span class="badge badge-sacrament" style="font-size: 0.68rem; margin-left: 0.25rem;">${getPrimaryRoleLabel(p)}</span>`
      : '';

    // 배우자 정보
    let spouseCell = '<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>';
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
      }
    }

    const childNames = (p.parentInfo?.childPersonIds || []).map(cid => {
      const s = dataProvider.getStudentById(cid);
      return s ? `<span class="clickable-name" data-detail-type="student" data-detail-id="${s.id}">${s.name}</span>(${s.studentInfo?.grade || '-'})` : '';
    }).filter(Boolean).join(', ') || '등록 자녀 없음';

    return `
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
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showUserDetailGlobal('parent', '${p.id}')">상세 보기</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderTeachersDirectory(search = '') {
  const teachers = dataProvider.getTeachers();
  const classes = dataProvider.getClasses();
  const teachersBody = document.querySelector('#teachersTable tbody');

  const filtered = teachers.filter(t => {
    if (!search) return true;
    return t.name.toLowerCase().includes(search) ||
           (t.baptismalName && t.baptismalName.toLowerCase().includes(search));
  });

  if (filtered.length === 0) {
    teachersBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">등록된 교사가 없습니다.</td></tr>';
    return;
  }

  teachersBody.innerHTML = filtered.map(t => {
    const primaryRole = dataProvider.getPrimaryTeacherRole(t);
    const roleBadgeClass = primaryRole?.role === 'principal' ? 'badge-sacrament' :
                            primaryRole?.role === 'vice_principal' ? 'badge-grade' : 'badge-present';

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

    return `
      <tr>
        <td>
          <strong class="clickable-name" data-detail-type="teacher" data-detail-id="${t.id}">${t.name}</strong>
          ${t.baptismalName ? `<div style="font-size: 0.78rem; color: var(--text-muted);">(${t.baptismalName})</div>` : ''}
        </td>
        <td><span class="badge ${roleBadgeClass}">${primaryRole?.label || '교사'}</span></td>
        <td>${assignedClassHtml}</td>
        <td><a href="tel:${t.phone}" style="color: var(--primary);">📞 ${t.phone || '-'}</a></td>
        <td>
          ${dualRoles.length > 0
            ? dualRoles.map(r => `<span class="badge badge-grade" style="font-size: 0.7rem;">${r}</span>`).join(' ')
            : '<span style="color: var(--text-muted);">-</span>'}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showUserDetailGlobal('teacher', '${t.id}')">상세 보기</button>
        </td>
      </tr>
    `;
  }).join('');
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
            <button class="btn btn-sm" style="background: #fee2e2; color: #dc2626; border: none; cursor: pointer; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.78rem;" class="btn-delete-class" data-id="${cls.id}">삭제</button>
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
  grid.querySelectorAll('[data-id]').forEach(btn => {
    if (btn.textContent.trim() === '삭제') {
      btn.addEventListener('click', () => {
        if (confirm('이 반을 삭제하시겠습니까?')) {
          dataProvider.deleteClass(btn.getAttribute('data-id'));
          showToast('반이 삭제되었습니다.', '🗑️');
          renderClassesView();
        }
      });
    }
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
    if (tabName === 'attendance') renderAttendance();
    if (tabName === 'activities') renderActivities();
    if (tabName === 'grace') renderGraceBank();
    if (tabName === 'students') renderDirectory();
  });
});

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
  const students = dataProvider.getStudents();
  const filtered = students.filter(st => matchGradeGroup(st.studentInfo?.grade || '', currentAttGradeFilter));
  filtered.forEach(st => {
    dataProvider.recordAttendance({ date: selectedDate, studentId: st.id, status: '출석', massAttended: true, recordedBy: '교사회 일괄 체크' });
  });
  showToast(`${filtered.length}명 전원 출석(+미사) 체크 완료!`, '🎉');
  renderAttendance();
  renderDashboard();
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
    renderAttendance();
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
  renderDashboard();
  renderAttendance();
  renderActivities();
  renderGraceBank();
  renderDirectory();
}

window.addEventListener('DOMContentLoaded', initApp);
