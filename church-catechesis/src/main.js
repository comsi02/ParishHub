// main.js
// church-catechesis 주일학교 & 은총표 관리 애플리케이션 진입점

import { dataProvider } from './services/DataProvider.js';
import { GRADES, GRADE_GROUPS, DEPARTMENTS } from './mock/sampleData.js';

// --- State ---
let currentTab = 'dashboard';
let currentAttGradeFilter = 'all';
let currentGraceGradeFilter = 'all';
let currentDirectoryView = 'students'; // 'students' | 'parents'

// --- DOM References ---
const navTabs = document.querySelectorAll('.nav-tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const toastContainer = document.getElementById('toastContainer');
const btnResetData = document.getElementById('btnResetData');

// --- Helper Functions ---
function getTodayDateString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
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

// 학년 필터 매칭 헬퍼
function matchGradeGroup(grade, group) {
  if (group === 'all') return true;
  const gObj = GRADES.find(g => g.id === grade);
  if (!gObj) return true;
  if (group === 'kinder') return gObj.group === 'kinder';
  if (group === 'elementary') return gObj.group.startsWith('elementary');
  if (group === 'youth') return gObj.group === 'middle' || gObj.group === 'high';
  return true;
}

// --- TAB 1: Dashboard Render ---
function renderDashboard() {
  const students = dataProvider.getStudents();
  const parents = dataProvider.getParents();
  const teachers = dataProvider.getTeachers();
  const today = document.getElementById('attDatePicker')?.value || getTodayDateString();
  const attendanceToday = dataProvider.getAttendance(today);
  const activitiesToday = dataProvider.getActivities(today);
  const allLedger = dataProvider.getGraceLedger();

  // Summary Metrics
  const totalGrace = allLedger.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const attendedCount = attendanceToday.filter(a => a.status === '출석' || a.status === '지각').length;

  document.getElementById('statTotalStudents').textContent = `${students.length}명`;
  document.getElementById('statTodayAttendance').textContent = `${attendedCount}명 출석`;
  document.getElementById('statTodayActivities').textContent = `${activitiesToday.length}건 봉사`;
  document.getElementById('statTotalGrace').textContent = `${totalGrace.toLocaleString()} P`;

  // Badges in Header Nav
  document.getElementById('badgeAttendedCount').textContent = attendedCount;
  document.getElementById('badgeActivityCount').textContent = activitiesToday.length;

  // TOP 5 Grace Leaderboard
  const sortedStudents = [...students].sort((a, b) => b.totalGracePoints - a.totalGracePoints);
  const top5 = sortedStudents.slice(0, 5);
  const topTableBody = document.querySelector('#topGraceTable tbody');
  
  if (top5.length === 0) {
    topTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">학생 데이터가 없습니다.</td></tr>';
  } else {
    topTableBody.innerHTML = top5.map((st, idx) => {
      const rankMedal = idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`;
      const depts = (st.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '<span style="color: var(--text-muted); font-size: 0.75rem;">-</span>';
      return `
        <tr>
          <td style="font-weight: 700; color: var(--primary);">${rankMedal}</td>
          <td>
            <strong>${st.name}</strong>
            ${st.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.8rem;">(${st.baptismalName})</span>` : ''}
          </td>
          <td><span class="badge badge-grade">${st.grade}</span></td>
          <td>${depts}</td>
          <td style="text-align: right;">
            <span class="grace-badge"><span class="coin">🪙</span> ${st.totalGracePoints.toLocaleString()} P</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Teachers List
  const teachersContainer = document.getElementById('teachersList');
  teachersContainer.innerHTML = teachers.map(t => {
    const roleBadge = t.role === '교감' ? 'badge-sacrament' : t.role === '부교감' ? 'badge-grade' : 'badge-present';
    return `
      <div style="background: var(--surface-subtle); padding: 0.65rem 0.85rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">
            ${t.name} <span style="font-weight: normal; color: var(--text-muted); font-size: 0.8rem;">(${t.baptismalName})</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            담당: ${t.assignedGrades.join(', ')} • 📞 <a href="tel:${t.phone}" style="color: inherit; text-decoration: underline;">${t.phone}</a>
          </div>
        </div>
        <span class="badge ${roleBadge}">${t.role}</span>
      </div>
    `;
  }).join('');
}

// --- TAB 2: Attendance Render ---
function renderAttendance() {
  const dateInput = document.getElementById('attDatePicker');
  const selectedDate = dateInput.value || getTodayDateString();
  const students = dataProvider.getStudents();
  const attendanceList = dataProvider.getAttendance(selectedDate);
  const attendanceGrid = document.getElementById('attendanceGrid');

  const filtered = students.filter(st => matchGradeGroup(st.grade, currentAttGradeFilter));

  if (filtered.length === 0) {
    attendanceGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">해당 학년의 학생이 없습니다.</div>';
    return;
  }

  attendanceGrid.innerHTML = filtered.map(st => {
    const att = attendanceList.find(a => a.studentId === st.id);
    const status = att ? att.status : '미체크';
    const massAttended = att ? att.massAttended : false;
    const initialChar = st.name ? st.name.charAt(0) : '?';
    const depts = (st.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('');

    return `
      <div class="student-att-card" data-student-id="${st.id}">
        <div>
          <div class="att-card-header">
            <div class="student-profile-wrap">
              <div class="avatar">${initialChar}</div>
              <div>
                <div class="student-main-name">
                  ${st.name}
                  <span class="badge badge-grade">${st.grade}</span>
                </div>
                <div class="baptismal-sub">
                  ${st.baptismalName ? `세례명: ${st.baptismalName}` : '세례명 미등록'}
                  ${st.feastDay ? `• 축일: ${st.feastDay}` : ''}
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

  // 출석 버튼 이벤트 바인딩
  attendanceGrid.querySelectorAll('.btn-att-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const studentId = btn.getAttribute('data-id');
      const newStatus = btn.getAttribute('data-status');
      const card = btn.closest('.student-att-card');
      const massChecked = card.querySelector('.att-mass-check').checked;

      dataProvider.recordAttendance({
        date: selectedDate,
        studentId,
        status: newStatus,
        massAttended: massChecked,
        recordedBy: '담당 선생님'
      });

      showToast(`${newStatus} 체크 완료 (은총표 자동 반영)`, '✅');
      renderAttendance();
      renderDashboard();
    });
  });

  // 미사 참례 체크박스 변경 시 자동 반영
  attendanceGrid.querySelectorAll('.att-mass-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const studentId = chk.getAttribute('data-id');
      const currentAtt = dataProvider.getAttendance(selectedDate).find(a => a.studentId === studentId);
      const curStatus = currentAtt ? currentAtt.status : '출석';

      dataProvider.recordAttendance({
        date: selectedDate,
        studentId,
        status: curStatus,
        massAttended: chk.checked,
        recordedBy: '담당 선생님'
      });

      showToast(`미사 참례 여부 변경 완료`, '⛪');
      renderAttendance();
      renderDashboard();
    });
  });
}

// --- TAB 3: Activities Render ---
function renderActivities() {
  const students = dataProvider.getStudents();
  const allActivities = dataProvider.getActivities();
  const select = document.getElementById('actStudentSelect');
  const tableBody = document.querySelector('#activityHistoryTable tbody');

  // 학생 셀렉트 박스 채우기
  const prevVal = select.value;
  select.innerHTML = '<option value="">봉사 학생을 선택하세요...</option>' +
    students.map(s => `<option value="${s.id}">${s.name} (${s.baptismalName || '세례명 없음'}, ${s.grade})</option>`).join('');
  if (prevVal) select.value = prevVal;

  // 최근 활동 테이블 (최신순)
  const sorted = [...allActivities].reverse();
  document.getElementById('activityListCount').textContent = `${sorted.length}건`;

  if (sorted.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">기록된 활동 봉사 내역이 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = sorted.map(act => {
    const st = students.find(s => s.id === act.studentId);
    const stName = st ? `${st.name} (${st.baptismalName || '-'}, ${st.grade})` : '알 수 없음';
    return `
      <tr>
        <td style="white-space: nowrap;">${act.date}</td>
        <td><strong>${stName}</strong></td>
        <td><span class="dept-tag">${act.department}</span></td>
        <td>${act.roleDetail || '-'}</td>
        <td style="text-align: right;"><span class="grace-badge"><span class="coin">🪙</span> +${act.pointsEarned} P</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${act.recordedBy || '선생님'}</td>
      </tr>
    `;
  }).join('');
}

// --- TAB 4: Grace Bank Render ---
function renderGraceBank() {
  const students = dataProvider.getStudents();
  const ledger = dataProvider.getGraceLedger();
  const search = document.getElementById('graceSearchInput')?.value.trim().toLowerCase() || '';
  const tableBody = document.querySelector('#graceOverviewTable tbody');

  let filtered = students.filter(st => {
    const matchSearch = !search || st.name.toLowerCase().includes(search) || (st.baptismalName && st.baptismalName.toLowerCase().includes(search));
    const matchGrade = matchGradeGroup(st.grade, currentGraceGradeFilter);
    return matchSearch && matchGrade;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">일치하는 학생이 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = filtered.map(st => {
    const studentLedger = ledger.filter(l => l.studentId === st.id);
    const attPts = studentLedger.filter(l => l.type === '출석').reduce((s, i) => s + Number(i.amount || 0), 0);
    const actPts = studentLedger.filter(l => l.type === '활동').reduce((s, i) => s + Number(i.amount || 0), 0);
    const bonusPts = studentLedger.filter(l => l.type === '추가점수' || l.type === '사용/차감').reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalPts = attPts + actPts + bonusPts;
    const depts = (st.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '-';

    return `
      <tr>
        <td>
          <strong>${st.name}</strong>
          ${st.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.82rem;">(${st.baptismalName})</span>` : ''}
        </td>
        <td><span class="badge badge-grade">${st.grade}</span></td>
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
          <button class="btn btn-secondary btn-sm btn-view-ledger" data-id="${st.id}">
            원장 조회
          </button>
          <button class="btn btn-grace btn-sm btn-quick-bonus" data-id="${st.id}" style="margin-left: 0.25rem;">
            + 점수
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // 원장 상세조회 버튼 이벤트
  tableBody.querySelectorAll('.btn-view-ledger').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.getAttribute('data-id');
      showGraceLedgerModal(studentId);
    });
  });

  // 개별 점수부여 버튼 이벤트
  tableBody.querySelectorAll('.btn-quick-bonus').forEach(btn => {
    btn.addEventListener('click', () => {
      const studentId = btn.getAttribute('data-id');
      document.getElementById('bonusStudentSelect').value = studentId;
      openModal('modalBonusPoints');
    });
  });
}

function showGraceLedgerModal(studentId) {
  const st = dataProvider.getStudentById(studentId);
  if (!st) return;

  const ledger = dataProvider.getGraceLedger(studentId).reverse();
  document.getElementById('ledgerStudentInfo').textContent = `${st.name} (${st.baptismalName || '세례명 미등록'}, ${st.grade})`;
  document.getElementById('ledgerStudentSub').textContent = `활동부서: ${(st.departments || []).join(', ') || '없음'}`;
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

// --- TAB 5: Students & Parents Directory Render ---
function renderDirectory() {
  const search = document.getElementById('directorySearchInput')?.value.trim().toLowerCase() || '';
  const students = dataProvider.getStudents();
  const parents = dataProvider.getParents();

  // 1. 학생 목록 렌더링
  const studentsBody = document.querySelector('#studentsTable tbody');
  const filteredStudents = students.filter(s => {
    if (!search) return true;
    return s.name.toLowerCase().includes(search) || 
           (s.baptismalName && s.baptismalName.toLowerCase().includes(search)) ||
           s.grade.toLowerCase().includes(search);
  });

  if (filteredStudents.length === 0) {
    studentsBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">등록된 학생이 없습니다.</td></tr>';
  } else {
    studentsBody.innerHTML = filteredStudents.map(st => {
      const parent = dataProvider.getParentById(st.parentId);
      const parentInfo = parent 
        ? `${parent.name} (<a href="tel:${parent.phone}" style="color: var(--primary); text-decoration: underline;">${parent.phone}</a>)` 
        : '<span style="color: var(--text-muted);">-</span>';
      const sacraments = [];
      if (st.firstCommunion) sacraments.push('<span class="badge badge-sacrament">첫영성체</span>');
      if (st.confirmation) sacraments.push('<span class="badge badge-sacrament">견진</span>');
      const depts = (st.departments || []).map(d => `<span class="dept-tag">${d}</span>`).join('') || '-';

      return `
        <tr>
          <td>
            <strong>${st.name}</strong>
            ${st.baptismalName ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${st.baptismalName}</div>` : ''}
          </td>
          <td><span class="badge badge-grade">${st.grade}</span></td>
          <td>${st.gender}</td>
          <td>${st.feastDay ? `📅 ${st.feastDay}` : '<span style="color: var(--text-muted); font-size: 0.78rem;">해당없음</span>'}</td>
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

  // 2. 학부모 목록 렌더링
  const parentsBody = document.querySelector('#parentsTable tbody');
  const filteredParents = parents.filter(p => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search) || 
           (p.baptismalName && p.baptismalName.toLowerCase().includes(search)) ||
           (p.phone && p.phone.includes(search)) ||
           (p.address && p.address.toLowerCase().includes(search));
  });

  if (filteredParents.length === 0) {
    parentsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">등록된 학부모가 없습니다.</td></tr>';
  } else {
    parentsBody.innerHTML = filteredParents.map(p => {
      const childNames = (p.studentIds || []).map(sId => {
        const s = dataProvider.getStudentById(sId);
        return s ? `${s.name}(${s.grade})` : '';
      }).filter(Boolean).join(', ') || '등록 자녀 없음';

      return `
        <tr>
          <td>
            <strong>${p.name}</strong>
            ${p.baptismalName ? `<span style="color: var(--text-muted); font-size: 0.82rem;">(${p.baptismalName})</span>` : ''}
          </td>
          <td>
            ${p.isSingleParent ? '<span class="badge badge-single-parent">한부모 가정</span>' : '<span style="font-size: 0.8rem; color: var(--text-muted);">' + (p.spouseName || '일반 가정') + '</span>'}
          </td>
          <td><a href="tel:${p.phone}" style="color: var(--primary); font-weight: 600;">📞 ${p.phone}</a></td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${p.address || '-'}</td>
          <td><span class="badge badge-grade">${childNames}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="alert('학부모 연락 및 상담 기능 준비 중')">상담 기록</button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// --- TAB Switching & Events ---
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

// --- Date & Filter Handlers ---
const attDatePicker = document.getElementById('attDatePicker');
if (attDatePicker) {
  attDatePicker.value = getTodayDateString();
  attDatePicker.addEventListener('change', () => {
    renderAttendance();
    renderDashboard();
  });
}

const actDateInput = document.getElementById('actDate');
if (actDateInput) {
  actDateInput.value = getTodayDateString();
}

// Attendance Grade Filter Buttons
document.querySelectorAll('#attGradeFilterGroup .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#attGradeFilterGroup .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAttGradeFilter = btn.getAttribute('data-filter');
    renderAttendance();
  });
});

// Grace Bank Grade Filter Buttons
document.querySelectorAll('#graceGradeFilter .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#graceGradeFilter .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentGraceGradeFilter = btn.getAttribute('data-filter');
    renderGraceBank();
  });
});

// Grace Search
document.getElementById('graceSearchInput')?.addEventListener('input', () => {
  renderGraceBank();
});

// Directory View Switch (Students vs Parents)
document.querySelectorAll('#directoryTabSwitch .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#directoryTabSwitch .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDirectoryView = btn.getAttribute('data-dir');
    if (currentDirectoryView === 'students') {
      document.getElementById('studentsContainer').style.display = 'block';
      document.getElementById('parentsContainer').style.display = 'none';
    } else {
      document.getElementById('studentsContainer').style.display = 'none';
      document.getElementById('parentsContainer').style.display = 'block';
    }
  });
});

// Directory Search
document.getElementById('directorySearchInput')?.addEventListener('input', () => {
  renderDirectory();
});

// 전원 출석 완료 일괄 처리
document.getElementById('btnMarkAllPresent')?.addEventListener('click', () => {
  const selectedDate = attDatePicker.value || getTodayDateString();
  const students = dataProvider.getStudents();
  const filtered = students.filter(st => matchGradeGroup(st.grade, currentAttGradeFilter));

  filtered.forEach(st => {
    dataProvider.recordAttendance({
      date: selectedDate,
      studentId: st.id,
      status: '출석',
      massAttended: true,
      recordedBy: '교사회 일괄 체크'
    });
  });

  showToast(`${filtered.length}명 전원 출석(+미사) 체크 완료!`, '🎉');
  renderAttendance();
  renderDashboard();
});

// Activity Dept Change -> 포인트 자동 변경
document.getElementById('actDeptSelect')?.addEventListener('change', (e) => {
  const settings = dataProvider.getSettings();
  const pts = settings.activityPoints[e.target.value] || 10;
  document.getElementById('actPoints').value = pts;
});

// Activity Form Submit
document.getElementById('activityForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('actDate').value;
  const studentId = document.getElementById('actStudentSelect').value;
  const department = document.getElementById('actDeptSelect').value;
  const roleDetail = document.getElementById('actRoleDetail').value;
  const points = Number(document.getElementById('actPoints').value);

  dataProvider.recordActivity({
    date,
    studentId,
    department,
    roleDetail,
    pointsEarned: points,
    recordedBy: '담당 교사'
  });

  showToast(`활동 봉사 기록 및 은총표 +${points} P 적립 완료`, '🕊️');
  document.getElementById('actRoleDetail').value = '';
  renderActivities();
  renderDashboard();
});

// Bonus Points Modal & Form
document.getElementById('btnOpenBonusModal')?.addEventListener('click', () => {
  // 모달 내 학생 셀렉트 박스 채우기
  const students = dataProvider.getStudents();
  const sel = document.getElementById('bonusStudentSelect');
  sel.innerHTML = '<option value="">학생을 선택하세요...</option>' +
    students.map(s => `<option value="${s.id}">${s.name} (${s.baptismalName || '세례명 없음'}, ${s.grade})</option>`).join('');
  openModal('modalBonusPoints');
});

document.getElementById('bonusPointsForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const studentId = document.getElementById('bonusStudentSelect').value;
  const amount = Number(document.getElementById('bonusAmount').value);
  const reason = document.getElementById('bonusReason').value;
  const issuer = document.getElementById('bonusIssuer').value;

  dataProvider.addBonusPoints({
    studentId,
    amount,
    reason,
    issuedBy: issuer
  });

  showToast(`은총표 ${amount >= 0 ? '+' : ''}${amount} P 처리 완료!`, '🪙');
  closeModal('modalBonusPoints');
  renderGraceBank();
  renderDashboard();
  renderDirectory();
});

// Add Student Modal & Form
document.getElementById('btnOpenAddStudentModal')?.addEventListener('click', () => {
  // 부모 셀렉트 박스 채우기
  const parents = dataProvider.getParents();
  const sel = document.getElementById('newStudentParent');
  sel.innerHTML = '<option value="">학부모를 선택하세요 (선택)...</option>' +
    parents.map(p => `<option value="${p.id}">${p.name} (${p.baptismalName || '세례명 없음'}, ${p.phone})</option>`).join('');
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

  const deptCheckboxes = document.querySelectorAll('#deptCheckboxes input[type="checkbox"]:checked');
  const departments = Array.from(deptCheckboxes).map(cb => cb.value);

  dataProvider.addStudent({
    name,
    baptismalName,
    grade,
    gender,
    feastDay,
    parentId,
    firstCommunion,
    confirmation,
    departments,
    notes
  });

  showToast(`${name} 학생이 성공적으로 등록되었습니다!`, '🎉');
  closeModal('modalAddStudent');
  document.getElementById('addStudentForm').reset();
  renderDirectory();
  renderDashboard();
  renderAttendance();
});

// Add Parent Modal & Form
document.getElementById('btnOpenAddParentModal')?.addEventListener('click', () => {
  openModal('modalAddParent');
});

// 한부모 체크 시 배우자 입력 필드 토글
document.getElementById('newParentIsSingle')?.addEventListener('change', (e) => {
  const spouseGroup = document.getElementById('spouseNameGroup');
  if (e.target.checked) {
    spouseGroup.style.display = 'none';
  } else {
    spouseGroup.style.display = 'block';
  }
});

document.getElementById('addParentForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('newParentName').value.trim();
  const baptismalName = document.getElementById('newParentBaptismal').value.trim();
  const phone = document.getElementById('newParentPhone').value.trim();
  const address = document.getElementById('newParentAddress').value.trim();
  const isSingleParent = document.getElementById('newParentIsSingle').checked;
  const spouseName = document.getElementById('newParentSpouse').value.trim();

  dataProvider.addParent({
    name,
    baptismalName,
    phone,
    address,
    isSingleParent,
    spouseName: isSingleParent ? null : spouseName,
  });

  showToast(`${name} 학부모님이 성공적으로 등록되었습니다!`, '🎉');
  closeModal('modalAddParent');
  document.getElementById('addParentForm').reset();
  renderDirectory();
});

// Reset Data Handler
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

// Initial Boot
function initApp() {
  renderDashboard();
  renderAttendance();
  renderActivities();
  renderGraceBank();
  renderDirectory();
}

window.addEventListener('DOMContentLoaded', initApp);
