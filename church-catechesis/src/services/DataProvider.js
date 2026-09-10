// DataProvider.js
// church-catechesis 통합 데이터 서비스 (LocalStorage Mock & Firestore 연결 지원)

import {
  DEFAULT_SETTINGS,
  INITIAL_TEACHERS,
  INITIAL_PARENTS,
  INITIAL_STUDENTS,
  INITIAL_ATTENDANCE,
  INITIAL_ACTIVITIES,
  INITIAL_GRACE_LEDGER,
} from '../mock/sampleData.js';

class DataProvider {
  constructor() {
    this.mode = import.meta.env.VITE_PROVIDER || 'local';
    this.initLocalStorage();
  }

  initLocalStorage() {
    if (!localStorage.getItem('catechesis_initialized')) {
      this.resetToDefaults();
    }
  }

  resetToDefaults() {
    localStorage.setItem('catechesis_settings', JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem('catechesis_teachers', JSON.stringify(INITIAL_TEACHERS));
    localStorage.setItem('catechesis_parents', JSON.stringify(INITIAL_PARENTS));
    localStorage.setItem('catechesis_students', JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem('catechesis_attendance', JSON.stringify(INITIAL_ATTENDANCE));
    localStorage.setItem('catechesis_activities', JSON.stringify(INITIAL_ACTIVITIES));
    localStorage.setItem('catechesis_grace_ledger', JSON.stringify(INITIAL_GRACE_LEDGER));
    localStorage.setItem('catechesis_initialized', 'true');
  }

  _getItem(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  _setItem(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- 설정 (Settings) ---
  getSettings() {
    const raw = localStorage.getItem('catechesis_settings');
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  }

  // --- 교사 (Teachers) ---
  getTeachers() {
    return this._getItem('catechesis_teachers');
  }

  // --- 학부모 (Parents) ---
  getParents() {
    return this._getItem('catechesis_parents');
  }

  getParentById(id) {
    const parents = this.getParents();
    return parents.find(p => p.id === id) || null;
  }

  addParent(parentData) {
    const parents = this.getParents();
    const newId = 'p-' + Date.now();
    const newParent = {
      id: newId,
      name: parentData.name,
      baptismalName: parentData.baptismalName || '',
      phone: parentData.phone || '',
      address: parentData.address || '',
      studentIds: parentData.studentIds || [],
      isSingleParent: !!parentData.isSingleParent,
      spouseName: parentData.spouseName || null,
    };
    parents.push(newParent);
    this._setItem('catechesis_parents', parents);
    return newParent;
  }

  // --- 학생 (Students) ---
  getStudents() {
    const students = this._getItem('catechesis_students');
    const ledger = this._getItem('catechesis_grace_ledger');

    // 학생별 실시간 은총표 계산
    return students.map(st => {
      const studentEntries = ledger.filter(l => l.studentId === st.id);
      const totalGrace = studentEntries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return {
        ...st,
        totalGracePoints: totalGrace,
      };
    });
  }

  getStudentById(id) {
    const students = this.getStudents();
    return students.find(s => s.id === id) || null;
  }

  addStudent(studentData) {
    const students = this._getItem('catechesis_students');
    const newId = 's-' + Date.now();
    const newStudent = {
      id: newId,
      name: studentData.name,
      baptismalName: studentData.baptismalName || '',
      grade: studentData.grade || 'G1',
      gender: studentData.gender || '남',
      feastDay: studentData.feastDay || '',
      firstCommunion: !!studentData.firstCommunion,
      confirmation: !!studentData.confirmation,
      departments: studentData.departments || [],
      parentId: studentData.parentId || '',
      notes: studentData.notes || '',
    };
    students.push(newStudent);
    this._setItem('catechesis_students', students);

    // 부모 객체에도 자녀 ID 추가
    if (newStudent.parentId) {
      const parents = this.getParents();
      const parent = parents.find(p => p.id === newStudent.parentId);
      if (parent) {
        if (!parent.studentIds) parent.studentIds = [];
        if (!parent.studentIds.includes(newId)) {
          parent.studentIds.push(newId);
          this._setItem('catechesis_parents', parents);
        }
      }
    }
    return newStudent;
  }

  updateStudent(id, studentData) {
    const students = this._getItem('catechesis_students');
    const idx = students.findIndex(s => s.id === id);
    if (idx !== -1) {
      students[idx] = { ...students[idx], ...studentData };
      this._setItem('catechesis_students', students);
      return students[idx];
    }
    return null;
  }

  // --- 출석 기록 (Attendance) ---
  getAttendance(date) {
    const all = this._getItem('catechesis_attendance');
    if (!date) return all;
    return all.filter(a => a.date === date);
  }

  recordAttendance({ date, studentId, status, massAttended, recordedBy = '선생님' }) {
    let attendance = this._getItem('catechesis_attendance');
    let ledger = this._getItem('catechesis_grace_ledger');
    const settings = this.getSettings();

    // 점수 계산: 출석 여부에 따른 점수
    let points = 0;
    if (status === '출석') {
      points += settings.attendancePoints || 10;
    } else if (status === '지각') {
      points += Math.floor((settings.attendancePoints || 10) / 2);
    }
    if (massAttended) {
      points += settings.massAttendancePoints || 5;
    }

    // 기존 당일 출석 체크 확인
    const existIdx = attendance.findIndex(a => a.date === date && a.studentId === studentId);
    const attId = existIdx !== -1 ? attendance[existIdx].id : 'att-' + Date.now();

    const record = {
      id: attId,
      date,
      studentId,
      status,
      massAttended: !!massAttended,
      pointsEarned: points,
      recordedBy
    };

    if (existIdx !== -1) {
      attendance[existIdx] = record;
    } else {
      attendance.push(record);
    }
    this._setItem('catechesis_attendance', attendance);

    // 은총표 원장(Ledger) 동기화 (기존 당일 출석 점수 항목 대체 또는 추가)
    ledger = ledger.filter(l => !(l.studentId === studentId && l.date === date && l.type === '출석'));
    if (points > 0) {
      ledger.push({
        id: 'gl-att-' + Date.now(),
        studentId,
        date,
        type: '출석',
        amount: points,
        reason: `주일 출석 (${status}${massAttended ? ' + 미사참례' : ''})`,
        issuedBy: recordedBy
      });
    }
    this._setItem('catechesis_grace_ledger', ledger);

    return record;
  }

  // --- 활동 기록 (Activities) ---
  getActivities(date) {
    const all = this._getItem('catechesis_activities');
    if (!date) return all;
    return all.filter(a => a.date === date);
  }

  recordActivity({ date, studentId, department, roleDetail = '', pointsEarned = null, recordedBy = '선생님' }) {
    const activities = this._getItem('catechesis_activities');
    const ledger = this._getItem('catechesis_grace_ledger');
    const settings = this.getSettings();

    const points = pointsEarned !== null ? Number(pointsEarned) : (settings.activityPoints[department] || 10);
    const newId = 'act-' + Date.now();

    const record = {
      id: newId,
      date,
      studentId,
      department,
      roleDetail,
      pointsEarned: points,
      recordedBy
    };
    activities.push(record);
    this._setItem('catechesis_activities', activities);

    // 은총표 원장에 기록
    ledger.push({
      id: 'gl-act-' + Date.now(),
      studentId,
      date,
      type: '활동',
      amount: points,
      reason: `${department} 봉사 활동 (${roleDetail || '활동 참례'})`,
      issuedBy: recordedBy
    });
    this._setItem('catechesis_grace_ledger', ledger);

    return record;
  }

  // --- 은총표 원장 (Grace Ledger) & 보너스 점수 ---
  getGraceLedger(studentId = null) {
    const ledger = this._getItem('catechesis_grace_ledger');
    if (!studentId) return ledger;
    return ledger.filter(l => l.studentId === studentId);
  }

  addBonusPoints({ studentId, amount, reason, issuedBy = '교감 선생님' }) {
    const ledger = this._getItem('catechesis_grace_ledger');
    const today = new Date().toISOString().split('T')[0];

    const entry = {
      id: 'gl-bonus-' + Date.now(),
      studentId,
      date: today,
      type: Number(amount) >= 0 ? '추가점수' : '사용/차감',
      amount: Number(amount),
      reason,
      issuedBy
    };
    ledger.push(entry);
    this._setItem('catechesis_grace_ledger', ledger);
    return entry;
  }
}

export const dataProvider = new DataProvider();
