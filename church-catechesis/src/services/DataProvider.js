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
  INITIAL_SCHEDULES,
  PERSON_ROLES,
  getSeasonFromDate,
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
    const DATA_VERSION = '2026_09_v13_ops_firestore';
    if (localStorage.getItem('catechesis_data_version') !== DATA_VERSION) {
      this.resetToDefaults();
      localStorage.setItem('catechesis_data_version', DATA_VERSION);
    }
  }

  resetToDefaults() {
    const isFirebase = this.mode === 'firebase';
    localStorage.setItem('catechesis_settings', JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem('catechesis_persons', JSON.stringify(isFirebase ? [] : INITIAL_PERSONS));
    localStorage.setItem('catechesis_classes', JSON.stringify(isFirebase ? [] : INITIAL_CLASSES));
    localStorage.setItem('catechesis_attendance', JSON.stringify(isFirebase ? [] : INITIAL_ATTENDANCE));
    localStorage.setItem('catechesis_activities', JSON.stringify(isFirebase ? [] : INITIAL_ACTIVITIES));
    localStorage.setItem('catechesis_grace_ledger', JSON.stringify(isFirebase ? [] : INITIAL_GRACE_LEDGER));
    // firebase 모드는 Firestore가 원본 — 로컬 샘플로 덮지 않음
    localStorage.setItem('catechesis_schedules', JSON.stringify(isFirebase ? [] : INITIAL_SCHEDULES));
    localStorage.setItem('catechesis_initialized', 'true');
    localStorage.setItem('catechesis_data_version', '2026_09_v13_ops_firestore');
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
      id: personData.id || ('person-' + Date.now()),
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

  /**
   * Person 삭제 + 배우자/자녀/학부모/반 교사 링크 정리
   * @param {string} id
   * @returns {{ deleted: object|null, touched: object[], touchedClasses: object[] }}
   */
  deletePerson(id) {
    const persons = this.getPersons();
    const target = persons.find(p => p.id === id);
    if (!target) return { deleted: null, touched: [], touchedClasses: [] };

    const touched = [];
    const next = persons
      .filter(p => p.id !== id)
      .map(p => {
        let changed = false;
        let copy = p;

        if (p.parentInfo) {
          const childPersonIds = (p.parentInfo.childPersonIds || []).filter(cid => cid !== id);
          const spousePersonId = p.parentInfo.spousePersonId === id ? null : p.parentInfo.spousePersonId;
          if (childPersonIds.length !== (p.parentInfo.childPersonIds || []).length
            || spousePersonId !== p.parentInfo.spousePersonId) {
            copy = {
              ...copy,
              parentInfo: { ...copy.parentInfo, childPersonIds, spousePersonId },
            };
            changed = true;
          }
        }

        if (p.studentInfo?.parentPersonIds) {
          const parentPersonIds = p.studentInfo.parentPersonIds.filter(pid => pid !== id);
          if (parentPersonIds.length !== p.studentInfo.parentPersonIds.length) {
            copy = {
              ...copy,
              studentInfo: { ...copy.studentInfo, parentPersonIds },
            };
            changed = true;
          }
        }

        if (changed) touched.push(copy);
        return copy;
      });

    this._setItem('catechesis_persons', next);

    const touchedClasses = [];
    const classes = this.getClasses().map(cls => {
      const teacherPersonIds = (cls.teacherPersonIds || []).filter(tid => tid !== id);
      if (teacherPersonIds.length === (cls.teacherPersonIds || []).length) return cls;
      const updated = { ...cls, teacherPersonIds };
      touchedClasses.push(updated);
      return updated;
    });
    this._setItem('catechesis_classes', classes);

    return { deleted: target, touched, touchedClasses };
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
      id: studentData.id,
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
    const leaderRoles = ['fathers_chair', 'mothers_chair', 'fathers_secretary', 'mothers_secretary'];
    return this.getPersons().filter(p =>
      p.roles?.includes('parent') ||
      p.roles?.some(r => leaderRoles.includes(r))
    );
  }

  getParentById(id) {
    return this.getParents().find(p => p.id === id) || null;
  }

  /** 학부모 추가 (편의 메서드) */
  addParent(parentData) {
    return this.addPerson({
      id: parentData.id,
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

  /** 교사 추가 (편의 메서드) — 학부모/학생 없이 교사만 등록 */
  addTeacher(teacherData) {
    const dutyRoles = (teacherData.roles || []).filter(r => this.getTeacherRoles().includes(r));
    const roles = dutyRoles.length ? dutyRoles : ['teacher'];
    return this.addPerson({
      id: teacherData.id,
      name: teacherData.name,
      baptismalName: teacherData.baptismalName || '',
      phone: teacherData.phone || '',
      email: teacherData.email || '',
      address: teacherData.address || '',
      roles,
      teacherInfo: {
        assignedClassIds: teacherData.assignedClassIds || [],
        specialRole: teacherData.specialRole || null,
      },
      parentInfo: null,
      studentInfo: null,
      notes: teacherData.notes || '',
    });
  }

  // ============================================================
  //  편의 헬퍼 - 교사진 (교사·교감·부교감·담당·총무·청소년분과장)
  // ============================================================
  getTeacherRoles() {
    return [
      'principal',
      'vice_principal',
      'youth_director',
      'secretary',
      'liturgy_teacher',
      'acolyte_teacher',
      'teacher',
      'assistant_teacher',
    ];
  }

  getTeachers() {
    const teacherRoles = this.getTeacherRoles();
    return this.getPersons().filter(p =>
      p.roles && p.roles.some(r => teacherRoles.includes(r))
    );
  }

  /** 사람의 가장 높은(표시용) 교사 역할 반환 */
  getPrimaryTeacherRole(person) {
    const priority = [
      'priest',
      'principal',
      'vice_principal',
      'youth_director',
      'secretary',
      'liturgy_teacher',
      'acolyte_teacher',
      'teacher',
      'assistant_teacher',
    ];
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

  recordAttendance({ date, studentId, status, recordedBy = '선생님' }) {
    let attendance = this._getItem('catechesis_attendance');
    let ledger = this._getItem('catechesis_grace_ledger');
    const settings = this.getSettings();

    let points = 0;
    if (status === '출석') points = settings.attendancePoints || 10;

    const safeKey = `${date}_${studentId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const attId = `att_${safeKey}`;
    const ledgerId = `gl_att_${safeKey}`;

    const existIdx = attendance.findIndex(
      a => a.id === attId || (a.date === date && (a.studentPersonId === studentId || a.studentId === studentId))
    );

    const record = {
      id: attId,
      date,
      studentPersonId: studentId,
      studentId,
      status,
      massAttended: (status === '출석'),
      pointsEarned: points,
      recordedBy,
    };

    if (existIdx !== -1) attendance[existIdx] = record;
    else attendance.push(record);
    this._setItem('catechesis_attendance', attendance);

    // 은총표 원장 동기화 (출석 항목은 안정적 id)
    ledger = ledger.filter(
      l => !(
        l.id === ledgerId ||
        (
          (l.studentPersonId === studentId || l.studentId === studentId) &&
          l.date === date && l.type === '출석'
        )
      )
    );
    if (points > 0) {
      ledger.push({
        id: ledgerId,
        studentPersonId: studentId,
        studentId: studentId,
        date,
        type: '출석',
        amount: points,
        reason: `주일 출석 (${status})`,
        issuedBy: recordedBy,
      });
    }
    this._setItem('catechesis_grace_ledger', ledger);
    return { record, ledgerId, ledgerRemoved: points <= 0 };
  }

  // ============================================================
  //  활동 기록 (Activities)
  // ============================================================
  getActivities(date) {
    const all = this._getItem('catechesis_activities');
    if (!date) return all;
    return all.filter(a => a.date === date);
  }

  recordActivity({ date, studentId, department, roleDetail = '', pointsEarned = null, recordedBy = '선생님', id = null }) {
    const activities = this._getItem('catechesis_activities');
    const ledger = this._getItem('catechesis_grace_ledger');
    const settings = this.getSettings();

    const points = pointsEarned !== null ? Number(pointsEarned) : (settings.activityPoints[department] || 10);
    const newId = id || ('act-' + Date.now());
    const ledgerId = `gl_${newId}`;

    const record = { id: newId, date, studentPersonId: studentId, studentId, department, roleDetail, pointsEarned: points, recordedBy };
    activities.push(record);
    this._setItem('catechesis_activities', activities);

    const ledgerEntry = {
      id: ledgerId,
      studentPersonId: studentId,
      studentId,
      date,
      type: '활동',
      amount: points,
      reason: `${department} 봉사 활동 (${roleDetail || '활동 참례'})`,
      issuedBy: recordedBy,
    };
    ledger.push(ledgerEntry);
    this._setItem('catechesis_grace_ledger', ledger);
    return { record, ledgerEntry };
  }

  // ============================================================
  //  은총표 원장 (Grace Ledger)
  // ============================================================
  getGraceLedger(studentId = null) {
    const ledger = this._getItem('catechesis_grace_ledger');
    if (!studentId) return ledger;
    return ledger.filter(l => l.studentPersonId === studentId || l.studentId === studentId);
  }

  addBonusPoints({ studentId, amount, reason, issuedBy = '교감 선생님', id = null }) {
    const ledger = this._getItem('catechesis_grace_ledger');
    const today = this._localDateISO();
    const entry = {
      id: id || ('gl-bonus-' + Date.now()),
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

  _localDateISO(referenceDate = new Date()) {
    const y = referenceDate.getFullYear();
    const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const d = String(referenceDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ============================================================
  //  시즌별 통계 (Season Statistics & Analytics)
  // ============================================================
  getAttendanceBySeason(seasonId = '2026-2027') {
    const all = this.getAttendance();
    return all.filter(a => getSeasonFromDate(a.date) === seasonId);
  }

  getSeasonStatistics(seasonId = '2026-2027', classId = 'all') {
    const students = this.getStudents();
    const classes = this.getClasses();
    
    // 반 필터링 적용
    let targetStudents = students;
    if (classId !== 'all') {
      const cls = classes.find(c => c.id === classId);
      if (cls) {
        targetStudents = students.filter(s => cls.grades && cls.grades.includes(s.studentInfo?.grade));
      }
    }
    const targetStudentIdSet = new Set(targetStudents.map(s => s.id));

    const seasonAttendance = this.getAttendanceBySeason(seasonId)
      .filter(a => targetStudentIdSet.has(a.studentPersonId || a.studentId));

    // 학사 일정 수업일 우선, 없으면 출석 기록 날짜로 주차 산정
    // 미래 날짜는 통계에서 제외 (오늘까지)
    const todayStr = this._localDateISO();
    const schoolDatesAll = this.getSchoolDates(seasonId);
    const attendanceDates = Array.from(new Set(seasonAttendance.map(a => a.date))).sort();
    const schoolDates = schoolDatesAll.filter(d => d <= todayStr);
    const sortedDates = (schoolDatesAll.length > 0 ? schoolDatesAll : attendanceDates)
      .filter(d => d <= todayStr);
    const totalWeeks = sortedDates.length;
    const schoolDateSet = new Set(sortedDates);

    const totalPossible = totalWeeks * targetStudents.length;
    const presentRecords = seasonAttendance.filter(a => a.status === '출석' && schoolDateSet.has(a.date));
    const absentRecords = seasonAttendance.filter(a => a.status === '결석' && schoolDateSet.has(a.date));
    const attendedCount = presentRecords.length;

    const overallRate = totalPossible > 0 ? Math.round((attendedCount / totalPossible) * 1000) / 10 : 0;

    // 월별 통계 (9월부터 다음해 6월까지)
    const monthOrder = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
    const monthLabels = {
      9: '9월', 10: '10월', 11: '11월', 12: '12월',
      1: '1월', 2: '2월', 3: '3월', 4: '4월', 5: '5월', 6: '6월'
    };

    const monthlyStats = monthOrder.map(m => {
      const monthDates = sortedDates.filter(dateStr => parseInt(dateStr.split('-')[1], 10) === m);
      const mWeeks = monthDates.length;
      const monthDateSet = new Set(monthDates);
      const monthAtt = seasonAttendance.filter(a => monthDateSet.has(a.date));
      const mPossible = mWeeks * targetStudents.length;
      const mAttended = monthAtt.filter(a => a.status === '출석').length;
      const mRate = mPossible > 0 ? Math.round((mAttended / mPossible) * 1000) / 10 : 0;

      return {
        month: m,
        label: monthLabels[m],
        weeksCount: mWeeks,
        possible: mPossible,
        attended: mAttended,
        rate: mRate,
      };
    });

    // 반별 출석률 랭킹
    const classStats = classes.map(cls => {
      const clsStudents = students.filter(s => cls.grades && cls.grades.includes(s.studentInfo?.grade));
      const clsStudentIds = new Set(clsStudents.map(s => s.id));
      const clsAtt = seasonAttendance.filter(a =>
        clsStudentIds.has(a.studentPersonId || a.studentId) && schoolDateSet.has(a.date)
      );
      const clsPossible = totalWeeks * clsStudents.length;
      const clsAttended = clsAtt.filter(a => a.status === '출석').length;
      const clsRate = clsPossible > 0 ? Math.round((clsAttended / clsPossible) * 1000) / 10 : 0;

      return {
        classId: cls.id,
        className: cls.name,
        grades: cls.grades,
        studentCount: clsStudents.length,
        rate: clsRate,
        attendedCount: clsAttended,
        possibleCount: clsPossible
      };
    }).sort((a, b) => b.rate - a.rate);

    // 학생별 출석 순위 및 개근/정근 통계
    const topStudents = targetStudents.map(s => {
      const sAtt = seasonAttendance.filter(a =>
        (a.studentPersonId || a.studentId) === s.id && schoolDateSet.has(a.date)
      );
      const sPresent = sAtt.filter(a => a.status === '출석').length;
      const sAbsent = sAtt.filter(a => a.status === '결석').length;
      const sAttended = sPresent;
      const sRate = totalWeeks > 0 ? Math.round((sAttended / totalWeeks) * 1000) / 10 : 0;

      return {
        studentId: s.id,
        student: s,
        attendedWeeks: sAttended,
        presentWeeks: sPresent,
        absentWeeks: sAbsent,
        totalWeeks,
        rate: sRate,
        isPerfect: totalWeeks > 0 && sPresent === totalWeeks, // 100% 출석 (개근)
        isHonored: totalWeeks > 0 && sAttended >= Math.ceil(totalWeeks * 0.9), // 90% 이상 (정근)
      };
    }).sort((a, b) => b.rate - a.rate);

    // 주차별(토요 일자별) 히스토리 — 학사 수업일 기준
    const weeklyHistory = sortedDates.map(dStr => {
      const dAtt = seasonAttendance.filter(a => a.date === dStr);
      const present = dAtt.filter(a => a.status === '출석').length;
      const absent = dAtt.filter(a => a.status === '결석').length;
      const total = targetStudents.length;
      const attended = present;
      const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;
      const schedule = this.getScheduleByDate(dStr);

      return {
        date: dStr,
        total,
        present,
        absent,
        attended,
        rate,
        title: schedule?.title || '',
        type: schedule?.type || 'regular',
      };
    }).reverse(); // 최근 날짜가 위로

    return {
      seasonId,
      totalWeeks,
      schoolDayCount: schoolDates.length,
      totalStudents: targetStudents.length,
      totalPossible,
      attendedCount,
      presentCount: presentRecords.length,
      absentCount: absentRecords.length,
      overallRate,
      monthlyStats,
      classStats,
      topStudents,
      weeklyHistory,
    };
  }

  // ============================================================
  //  주일학교 학사 일정 (Schedules & Calendar)
  // ============================================================
  getSchedules(seasonId = null) {
    const schedules = this._getItem('catechesis_schedules');
    if (!seasonId || seasonId === 'all') {
      return schedules.sort((a, b) => a.date.localeCompare(b.date));
    }
    return schedules
      .filter(s => (s.seasonId || getSeasonFromDate(s.date)) === seasonId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getScheduleById(id) {
    return this.getSchedules().find(s => s.id === id) || null;
  }

  getScheduleByDate(dateStr) {
    if (!dateStr) return null;
    return this._getItem('catechesis_schedules').find(s => s.date === dateStr) || null;
  }

  /** 시즌의 주일학교 수업일(hasSchool) 날짜 목록 */
  getSchoolDates(seasonId = null) {
    return this.getSchedules(seasonId || 'all')
      .filter(s => s.hasSchool)
      .map(s => s.date);
  }

  /** 해당 날짜가 수업일인지 (학사 일정 기준). 일정이 없으면 null */
  isSchoolDay(dateStr) {
    const sch = this.getScheduleByDate(dateStr);
    if (!sch) return null;
    return Boolean(sch.hasSchool);
  }

  addSchedule(scheduleData) {
    const schedules = this._getItem('catechesis_schedules');
    const seasonId = scheduleData.seasonId || getSeasonFromDate(scheduleData.date);
    const newSchedule = {
      id: scheduleData.id || 'sch-' + Date.now(),
      date: scheduleData.date,
      seasonId,
      title: scheduleData.title || '주일학교 모임',
      type: scheduleData.type || 'regular', // 'regular' | 'special' | 'holiday'
      hasSchool: scheduleData.hasSchool !== undefined ? Boolean(scheduleData.hasSchool) : true,
      notes: scheduleData.notes || '',
    };
    
    const existIdx = schedules.findIndex(s => s.date === newSchedule.date);
    if (existIdx !== -1) {
      schedules[existIdx] = { ...schedules[existIdx], ...newSchedule, id: schedules[existIdx].id };
    } else {
      schedules.push(newSchedule);
    }

    this._setItem('catechesis_schedules', schedules);
    return newSchedule;
  }

  updateSchedule(id, scheduleData) {
    const schedules = this._getItem('catechesis_schedules');
    const idx = schedules.findIndex(s => s.id === id);
    if (idx !== -1) {
      const seasonId = scheduleData.seasonId || getSeasonFromDate(scheduleData.date || schedules[idx].date);
      schedules[idx] = { ...schedules[idx], ...scheduleData, seasonId };
      this._setItem('catechesis_schedules', schedules);
      return schedules[idx];
    }
    return null;
  }

  deleteSchedule(id) {
    const schedules = this._getItem('catechesis_schedules').filter(s => s.id !== id);
    this._setItem('catechesis_schedules', schedules);
  }

  toggleScheduleHasSchool(id) {
    const schedules = this._getItem('catechesis_schedules');
    const item = schedules.find(s => s.id === id);
    if (item) {
      item.hasSchool = !item.hasSchool;
      this._setItem('catechesis_schedules', schedules);
      return item;
    }
    return null;
  }

  /**
   * 특정 시즌 학사 일정만 시드 데이터로 복구 (출석/학생/은총 등은 유지)
   */
  resetSeasonSchedules(seasonId = '2026-2027') {
    const others = this._getItem('catechesis_schedules')
      .filter(s => (s.seasonId || getSeasonFromDate(s.date)) !== seasonId);
    const seed = INITIAL_SCHEDULES.filter(s => s.seasonId === seasonId);
    this._setItem('catechesis_schedules', [...others, ...seed]);
    return seed.length;
  }

  /**
   * 오늘 이후(오늘 포함) 가장 가까운 주일학교 모임일(hasSchool === true) 반환
   */
  getNextUpcomingSchoolDate(referenceDate = new Date()) {
    const todayStr = this._localDateISO(referenceDate);
    const allSchedules = this._getItem('catechesis_schedules');
    
    // 1. 등록된 일정 중 오늘 이후 주일학교 모이는 날 (hasSchool: true)
    const upcoming = allSchedules
      .filter(s => s.hasSchool && s.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length > 0) {
      const target = upcoming[0];
      const targetDate = new Date(target.date + 'T00:00:00');
      const todayZero = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      const diffMs = targetDate.getTime() - todayZero.getTime();
      const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

      return {
        ...target,
        targetDate,
        daysLeft,
        isToday: daysLeft === 0,
      };
    }

    // 2. 등록된 일정이 없는 경우 기본 다가오는 토요일 계산
    const currentDay = referenceDate.getDay();
    const daysUntilSat = (6 - currentDay + 7) % 7;
    const nextSat = new Date(referenceDate);
    nextSat.setDate(referenceDate.getDate() + daysUntilSat);
    const dateStr = this._localDateISO(nextSat);

    return {
      id: 'fallback-sat',
      date: dateStr,
      seasonId: getSeasonFromDate(dateStr),
      title: '토요 주일학교',
      type: 'regular',
      hasSchool: true,
      notes: '',
      targetDate: nextSat,
      daysLeft: daysUntilSat,
      isToday: daysUntilSat === 0,
    };
  }

  /** 출석 체크용 기본 날짜: 오늘이 수업일이면 오늘, 아니면 가장 최근 지난 수업일 */
  getPreferredAttendanceDate(referenceDate = new Date()) {
    const todayStr = this._localDateISO(referenceDate);
    if (this.isSchoolDay(todayStr) === true) return todayStr;

    const pastSchool = this.getSchoolDates()
      .filter(d => d <= todayStr)
      .sort();
    if (pastSchool.length > 0) return pastSchool[pastSchool.length - 1];

    return this.getNextUpcomingSchoolDate(referenceDate).date;
  }
}

export const dataProvider = new DataProvider();
