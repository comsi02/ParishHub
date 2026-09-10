// DataProvider.js
// church-catechesis 통합 데이터 서비스 v2
// 통합 Person 모델 + 자유 합반(Class) 구조

import {
  DEFAULT_SETTINGS,
  INITIAL_PERSONS,
  INITIAL_CLASSES,
  INITIAL_ATTENDANCE,
  INITIAL_ACTIVITIES,
  INITIAL_GRACE_LEDGER,
  PERSON_ROLES,
} from '../mock/sampleData.js';

class DataProvider {
  constructor() {
    this.mode = import.meta.env.VITE_PROVIDER || 'local';
    this.initLocalStorage();
  }

  // ============================================================
  //  초기화
  // ============================================================
  initLocalStorage() {
    const DATA_VERSION = '2026_09_v4_person';
    if (localStorage.getItem('catechesis_data_version') !== DATA_VERSION) {
      this.resetToDefaults();
      localStorage.setItem('catechesis_data_version', DATA_VERSION);
    }
  }

  resetToDefaults() {
    localStorage.setItem('catechesis_settings', JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem('catechesis_persons', JSON.stringify(INITIAL_PERSONS));
    localStorage.setItem('catechesis_classes', JSON.stringify(INITIAL_CLASSES));
    localStorage.setItem('catechesis_attendance', JSON.stringify(INITIAL_ATTENDANCE));
    localStorage.setItem('catechesis_activities', JSON.stringify(INITIAL_ACTIVITIES));
    localStorage.setItem('catechesis_grace_ledger', JSON.stringify(INITIAL_GRACE_LEDGER));
    localStorage.setItem('catechesis_initialized', 'true');
    localStorage.setItem('catechesis_data_version', '2026_09_v4_person');
  }

  _getItem(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  _setItem(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ============================================================
  //  설정 (Settings)
  // ============================================================
  getSettings() {
    const raw = localStorage.getItem('catechesis_settings');
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  }

  // ============================================================
  //  반 (Classes)
  // ============================================================
  getClasses() {
    return this._getItem('catechesis_classes');
  }

  getClassById(id) {
    return this.getClasses().find(c => c.id === id) || null;
  }

  addClass(classData) {
    const classes = this.getClasses();
    const newClass = {
      id: 'class-' + Date.now(),
      name: classData.name || '새 반',
      grades: classData.grades || [],
      teacherPersonIds: classData.teacherPersonIds || [],
      notes: classData.notes || '',
    };
    classes.push(newClass);
    this._setItem('catechesis_classes', classes);
    return newClass;
  }

  updateClass(id, classData) {
    const classes = this.getClasses();
    const idx = classes.findIndex(c => c.id === id);
    if (idx !== -1) {
      classes[idx] = { ...classes[idx], ...classData };
      this._setItem('catechesis_classes', classes);
      return classes[idx];
    }
    return null;
  }

  deleteClass(id) {
    const classes = this.getClasses().filter(c => c.id !== id);
    this._setItem('catechesis_classes', classes);
  }

  // ============================================================
  //  통합 Person CRUD
  // ============================================================
  getPersons() {
    return this._getItem('catechesis_persons');
  }

  getPersonById(id) {
    return this.getPersons().find(p => p.id === id) || null;
  }

  /** role이 roles 배열에 포함된 사람들 필터링 */
  getPersonsByRole(role) {
    return this.getPersons().filter(p => p.roles && p.roles.includes(role));
  }

  addPerson(personData) {
    const persons = this.getPersons();
    const newPerson = {
      id: 'person-' + Date.now(),
      name: personData.name || '',
      baptismalName: personData.baptismalName || '',
      phone: personData.phone || '',
      email: personData.email || '',
      address: personData.address || '',
      roles: personData.roles || [],
      teacherInfo: personData.teacherInfo || null,
      parentInfo: personData.parentInfo || null,
      studentInfo: personData.studentInfo || null,
      notes: personData.notes || '',
    };
    persons.push(newPerson);
    this._setItem('catechesis_persons', persons);
    return newPerson;
  }

  updatePerson(id, updates) {
    const persons = this.getPersons();
    const idx = persons.findIndex(p => p.id === id);
    if (idx !== -1) {
      persons[idx] = { ...persons[idx], ...updates };
      this._setItem('catechesis_persons', persons);
      return persons[idx];
    }
    return null;
  }

  // ============================================================
  //  편의 헬퍼 - 학생(Student) 목록 (은총표 자동 계산 포함)
  // ============================================================
  getStudents() {
    const ledger = this._getItem('catechesis_grace_ledger');
    return this.getPersonsByRole('student').map(p => {
      const entries = ledger.filter(l => l.studentPersonId === p.id);
      const totalGracePoints = entries.reduce((sum, l) => sum + Number(l.amount || 0), 0);
      return { ...p, totalGracePoints };
    });
  }

  getStudentById(id) {
    return this.getStudents().find(s => s.id === id) || null;
  }

  /** 학생 추가 (편의 메서드) */
  addStudent(studentData) {
    const newPerson = this.addPerson({
      name: studentData.name,
      baptismalName: studentData.baptismalName || '',
      phone: '',
      email: '',
      address: '',
      roles: ['student'],
      teacherInfo: null,
      parentInfo: null,
      studentInfo: {
        grade: studentData.grade || 'G1',
        gender: studentData.gender || '남',
        feastDay: studentData.feastDay || '',
        firstCommunion: !!studentData.firstCommunion,
        confirmation: !!studentData.confirmation,
        departments: studentData.departments || [],
        parentPersonIds: studentData.parentPersonIds || [],
      },
      notes: studentData.notes || '',
    });

    // 연결된 학부모 parentInfo에 자녀 ID 추가
    (studentData.parentPersonIds || []).forEach(pid => {
      const parent = this.getPersonById(pid);
      if (parent && parent.parentInfo) {
        const cids = parent.parentInfo.childPersonIds || [];
        if (!cids.includes(newPerson.id)) {
          cids.push(newPerson.id);
          this.updatePerson(pid, {
            parentInfo: { ...parent.parentInfo, childPersonIds: cids }
          });
        }
      }
    });

    return newPerson;
  }

  updateStudent(id, studentData) {
    const person = this.getPersonById(id);
    if (!person) return null;
    return this.updatePerson(id, {
      ...studentData,
      studentInfo: { ...person.studentInfo, ...(studentData.studentInfo || {}) },
    });
  }

  // ============================================================
  //  편의 헬퍼 - 학부모(Parent) 목록
  // ============================================================
  getParents() {
    return this.getPersonsByRole('parent');
  }

  getParentById(id) {
    return this.getParents().find(p => p.id === id) || null;
  }

  /** 학부모 추가 (편의 메서드) */
  addParent(parentData) {
    return this.addPerson({
      name: parentData.name,
      baptismalName: parentData.baptismalName || '',
      phone: parentData.phone || '',
      email: parentData.email || '',
      address: parentData.address || '',
      roles: parentData.isTeacher ? ['parent', 'teacher'] : ['parent'],
      teacherInfo: parentData.isTeacher ? {
        assignedClassIds: [],
        specialRole: parentData.teacherSpecialRole || null,
      } : null,
      parentInfo: {
        childPersonIds: parentData.childPersonIds || [],
        spousePersonId: parentData.spousePersonId || null,
      },
      studentInfo: null,
      notes: parentData.notes || '',
    });
  }

  // ============================================================
  //  편의 헬퍼 - 교사진 (역할이 teacher/principal/vice_principal/liturgy_teacher/acolyte_teacher 중 하나인 사람)
  // ============================================================
  getTeacherRoles() {
    return ['principal', 'vice_principal', 'teacher', 'liturgy_teacher', 'acolyte_teacher'];
  }

  getTeachers() {
    const teacherRoles = this.getTeacherRoles();
    return this.getPersons().filter(p =>
      p.roles && p.roles.some(r => teacherRoles.includes(r))
    );
  }

  /** 사람의 가장 높은(표시용) 교사 역할 반환 */
  getPrimaryTeacherRole(person) {
    const priority = ['principal', 'vice_principal', 'liturgy_teacher', 'acolyte_teacher', 'teacher'];
    for (const r of priority) {
      if (person.roles && person.roles.includes(r)) {
        return { role: r, label: PERSON_ROLES[r]?.label || r };
      }
    }
    return null;
  }

  /** 학부모이면서 교사인 사람들 */
  getTeacherParents() {
    return this.getPersons().filter(p =>
      p.roles && p.roles.includes('parent') &&
      p.roles.some(r => this.getTeacherRoles().includes(r))
    );
  }

  // ============================================================
  //  편의 헬퍼 - 학생의 부모 목록 조회
  // ============================================================
  getParentsOfStudent(studentId) {
    const student = this.getPersonById(studentId);
    if (!student || !student.studentInfo) return [];
    return (student.studentInfo.parentPersonIds || [])
      .map(pid => this.getPersonById(pid))
      .filter(Boolean);
  }

  // ============================================================
  //  출석 기록 (Attendance) - studentPersonId 사용
  // ============================================================
  getAttendance(date) {
    const all = this._getItem('catechesis_attendance');
    if (!date) return all;
    return all.filter(a => a.date === date);
  }

  recordAttendance({ date, studentId, status, massAttended, recordedBy = '선생님' }) {
    let attendance = this._getItem('catechesis_attendance');
    let ledger = this._getItem('catechesis_grace_ledger');
    const settings = this.getSettings();

    let points = 0;
    if (status === '출석') points += settings.attendancePoints || 10;
    else if (status === '지각') points += settings.latePoints || 5;
    if (massAttended) points += settings.massAttendancePoints || 5;

    const existIdx = attendance.findIndex(
      a => a.date === date && (a.studentPersonId === studentId || a.studentId === studentId)
    );
    const attId = existIdx !== -1 ? attendance[existIdx].id : 'att-' + Date.now();

    const record = {
      id: attId,
      date,
      studentPersonId: studentId,  // v2 key
      studentId: studentId,         // 하위 호환
      status,
      massAttended: !!massAttended,
      pointsEarned: points,
      recordedBy,
    };

    if (existIdx !== -1) attendance[existIdx] = record;
    else attendance.push(record);
    this._setItem('catechesis_attendance', attendance);

    // 은총표 원장 동기화
    ledger = ledger.filter(
      l => !(
        (l.studentPersonId === studentId || l.studentId === studentId) &&
        l.date === date && l.type === '출석'
      )
    );
    if (points > 0) {
      ledger.push({
        id: 'gl-att-' + Date.now(),
        studentPersonId: studentId,
        studentId: studentId,
        date,
        type: '출석',
        amount: points,
        reason: `주일 출석 (${status}${massAttended ? ' + 미사참례' : ''})`,
        issuedBy: recordedBy,
      });
    }
    this._setItem('catechesis_grace_ledger', ledger);
    return record;
  }

  // ============================================================
  //  활동 기록 (Activities)
  // ============================================================
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

    const record = { id: newId, date, studentPersonId: studentId, studentId, department, roleDetail, pointsEarned: points, recordedBy };
    activities.push(record);
    this._setItem('catechesis_activities', activities);

    ledger.push({
      id: 'gl-act-' + Date.now(),
      studentPersonId: studentId,
      studentId,
      date,
      type: '활동',
      amount: points,
      reason: `${department} 봉사 활동 (${roleDetail || '활동 참례'})`,
      issuedBy: recordedBy,
    });
    this._setItem('catechesis_grace_ledger', ledger);
    return record;
  }

  // ============================================================
  //  은총표 원장 (Grace Ledger)
  // ============================================================
  getGraceLedger(studentId = null) {
    const ledger = this._getItem('catechesis_grace_ledger');
    if (!studentId) return ledger;
    return ledger.filter(l => l.studentPersonId === studentId || l.studentId === studentId);
  }

  addBonusPoints({ studentId, amount, reason, issuedBy = '교감 선생님' }) {
    const ledger = this._getItem('catechesis_grace_ledger');
    const today = new Date().toISOString().split('T')[0];
    const entry = {
      id: 'gl-bonus-' + Date.now(),
      studentPersonId: studentId,
      studentId,
      date: today,
      type: Number(amount) >= 0 ? '추가점수' : '사용/차감',
      amount: Number(amount),
      reason,
      issuedBy,
    };
    ledger.push(entry);
    this._setItem('catechesis_grace_ledger', ledger);
    return entry;
  }
}

export const dataProvider = new DataProvider();
