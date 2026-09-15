// sampleData.js
// church-catechesis 주일학교 기본 및 목업 데이터
// v2 - 통합 Person 모델 + 자유 합반(Class) 구조

// ============================================================
//  1. 설정 (Settings)
// ============================================================
export const DEFAULT_SETTINGS = {
  attendancePoints: 10,       // 주일 출석 시 은총표 (출석 시 자동 미사 참례 인정)
  activityPoints: {
    '복사': 15,
    '전례(해설/독서)': 10,
    '성가대': 10,
    '현악': 10,
    '밴드': 10,
    '기타': 5,
  },
  defaultBonusPoints: 5,      // 퀴즈/봉사 기본 보너스
};

// ============================================================
//  2. 역할(Role) 상수 및 메타데이터
// ============================================================
export const PERSON_ROLES = {
  student:          { label: '학생',              icon: '🧒', badgeClass: 'badge-grade' },
  priest:           { label: '신부님',             icon: '✝️', badgeClass: 'badge-sacrament' },
  parent:           { label: '학부모',             icon: '👨‍👩‍👧', badgeClass: 'badge-present' },
  fathers_chair:    { label: '자부회장',           icon: '👔', badgeClass: 'badge-present' },
  mothers_chair:    { label: '자모회장',           icon: '👗', badgeClass: 'badge-present' },
  fathers_secretary:{ label: '자부회총무',         icon: '📋', badgeClass: 'badge-grade' },
  mothers_secretary:{ label: '자모회총무',         icon: '📋', badgeClass: 'badge-grade' },
  teacher:          { label: '교리',               icon: '✝️', badgeClass: 'badge-sacrament' },
  assistant_teacher:{ label: '보조',               icon: '✝️', badgeClass: 'badge-grade' },
  principal:        { label: '교감',               icon: '✝️', badgeClass: 'badge-sacrament' },
  vice_principal:   { label: '부교감',             icon: '✝️', badgeClass: 'badge-grade' },
  liturgy_teacher:  { label: '전례부',             icon: '📖', badgeClass: 'badge-sacrament' },
  acolyte_teacher:  { label: '복사',               icon: '🕯️', badgeClass: 'badge-sacrament' },
  secretary:        { label: '총무',               icon: '📋', badgeClass: 'badge-present' },
  youth_director:   { label: '청소년분과장',       icon: '⛪', badgeClass: 'badge-sacrament' },
};

// ============================================================
//  3. 학년(Grade) 상수
// ============================================================
export const GRADES = [
  { id: 'JK', label: '유치원 JK', sortOrder: 0 },
  { id: 'SK', label: '유치원 SK', sortOrder: 1 },
  { id: 'G1', label: '1학년 (G1)', sortOrder: 2 },
  { id: 'G2', label: '2학년 (G2)', sortOrder: 3 },
  { id: 'G3', label: '3학년 (G3)', sortOrder: 4 },
  { id: 'G4', label: '4학년 (G4)', sortOrder: 5 },
  { id: 'G5', label: '5학년 (G5)', sortOrder: 6 },
  { id: 'G6', label: '6학년 (G6)', sortOrder: 7 },
  { id: 'G7', label: '7학년 (G7)', sortOrder: 8 },
  { id: 'G8', label: '8학년 (G8)', sortOrder: 9 },
  { id: 'G9', label: '9학년 (G9)', sortOrder: 10 },
  { id: 'G10', label: '10학년 (G10)', sortOrder: 11 },
  { id: 'G11', label: '11학년 (G11)', sortOrder: 12 },
  { id: 'G12', label: '12학년 (G12)', sortOrder: 13 },
];

// 학년 → 정렬 순서 맵
export const GRADE_SORT_MAP = Object.fromEntries(GRADES.map(g => [g.id, g.sortOrder]));

// ============================================================
//  4. 활동 부서
// ============================================================
export const DEPARTMENTS = [
  '복사',
  '전례(해설/독서)',
  '현악',
  '밴드',
  '성가대',
  '기타',
];

// ============================================================
//  5. 반(Class) 초기 데이터 - 자유 합반 구조
//     grades 배열에 원하는 학년들을 자유롭게 조합 가능
// ============================================================
export const INITIAL_CLASSES = [
  {
    id: 'class-1',
    name: '유치부',
    grades: ['JK', 'SK'],
    teacherPersonIds: ['person-3'],   // 박은혜 선생님
    notes: '유치원 합반'
  },
  {
    id: 'class-2',
    name: '초등 저학년 (G1-G3)',
    grades: ['G1', 'G2', 'G3'],
    teacherPersonIds: ['person-4'],   // 최현우 선생님
    notes: ''
  },
  {
    id: 'class-3',
    name: '초등 중학년 (G4-G6)',
    grades: ['G4', 'G5', 'G6'],
    teacherPersonIds: ['person-5', 'person-6'],  // 정유미, 강태양
    notes: ''
  },
  {
    id: 'class-4',
    name: '중학부 (G7-G9)',
    grades: ['G7', 'G8', 'G9'],
    teacherPersonIds: ['person-7'],   // 윤지훈
    notes: ''
  },
  {
    id: 'class-5',
    name: '고등부 (G10-G12)',
    grades: ['G10', 'G11', 'G12'],
    teacherPersonIds: ['person-8'],   // 임소라
    notes: ''
  },
];

// ============================================================
//  6. 통합 Person 초기 데이터
//     roles 배열로 여러 역할 동시 보유 가능
//     teacherInfo / studentInfo / parentInfo 는 해당 역할이 있을 때만 의미 있음
// ============================================================
export const INITIAL_PERSONS = [

  // ----------------------------------------------------------
  //  교사진
  // ----------------------------------------------------------
  {
    id: 'person-1',
    name: '김민호',
    baptismalName: '미카엘',
    phone: '416-555-0101',
    email: 'michael.kim@parish.org',
    address: '123 Finch Ave W, North York, ON',
    roles: ['principal', 'parent'],   // 교감 + 학부모 겸임
    teacherInfo: {
      assignedClassIds: [],            // 교감: 전체 관할
      specialRole: null,
    },
    parentInfo: {
      childPersonIds: ['person-10', 'person-11'],  // 자녀: 김다니엘, 김로사
      spousePersonId: 'person-2',
    },
    studentInfo: null,
    notes: '교감 선생님',
  },
  {
    id: 'person-2',
    name: '한지혜',
    baptismalName: '마리아',
    phone: '416-555-2111',
    email: '',
    address: '123 Finch Ave W, North York, ON',
    roles: ['parent'],
    teacherInfo: null,
    parentInfo: {
      childPersonIds: ['person-10', 'person-11'],
      spousePersonId: 'person-1',
    },
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-3',
    name: '이수진',
    baptismalName: '세실리아',
    phone: '416-555-0102',
    email: 'cecilia.lee@parish.org',
    address: '',
    roles: ['vice_principal'],
    teacherInfo: {
      assignedClassIds: [],
      specialRole: null,
    },
    parentInfo: null,
    studentInfo: null,
    notes: '부교감 선생님',
  },
  {
    id: 'person-4',
    name: '박은혜',
    baptismalName: '루시아',
    phone: '416-555-0103',
    email: 'lucia.park@parish.org',
    address: '',
    roles: ['teacher'],
    teacherInfo: {
      assignedClassIds: ['class-1'],   // 유치부 담임
      specialRole: null,
    },
    parentInfo: null,
    studentInfo: null,
    notes: '유치부 담임',
  },
  {
    id: 'person-5',
    name: '최현우',
    baptismalName: '프란치스코',
    phone: '416-555-0104',
    email: 'francis.choi@parish.org',
    address: '88 Sheppard Ave E, North York, ON',
    roles: ['teacher', 'parent'],      // 교사 + 학부모 겸임
    teacherInfo: {
      assignedClassIds: ['class-2'],   // 초등 저학년 담임
      specialRole: null,
    },
    parentInfo: {
      childPersonIds: ['person-15'],   // 자녀: 최소율
      spousePersonId: 'person-6-spouse',
    },
    studentInfo: null,
    notes: '초등 저학년 담임, 학부모 겸임',
  },
  {
    id: 'person-6',
    name: '정유미',
    baptismalName: '안나',
    phone: '416-555-0105',
    email: 'anna.jung@parish.org',
    address: '',
    roles: ['teacher'],
    teacherInfo: {
      assignedClassIds: ['class-3'],
      specialRole: null,
    },
    parentInfo: null,
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-7',
    name: '강태양',
    baptismalName: '요셉',
    phone: '416-555-0106',
    email: 'joseph.kang@parish.org',
    address: '',
    roles: ['teacher', 'acolyte_teacher'],  // 교사 + 복사담당선생님
    teacherInfo: {
      assignedClassIds: ['class-3'],
      specialRole: 'acolyte_teacher',
    },
    parentInfo: null,
    studentInfo: null,
    notes: '복사단 지도 담당',
  },
  {
    id: 'person-8',
    name: '윤지훈',
    baptismalName: '라파엘',
    phone: '416-555-0107',
    email: 'raphael.yoon@parish.org',
    address: '',
    roles: ['teacher'],
    teacherInfo: {
      assignedClassIds: ['class-4'],
      specialRole: null,
    },
    parentInfo: null,
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-9',
    name: '임소라',
    baptismalName: '데레사',
    phone: '416-555-0108',
    email: 'theresa.lim@parish.org',
    address: '',
    roles: ['teacher', 'liturgy_teacher'],  // 교사 + 전례부선생님
    teacherInfo: {
      assignedClassIds: ['class-5'],
      specialRole: 'liturgy_teacher',
    },
    parentInfo: null,
    studentInfo: null,
    notes: '전례부 지도 담당',
  },

  // ----------------------------------------------------------
  //  학부모 (교사 미겸임)
  // ----------------------------------------------------------
  {
    id: 'person-16',
    name: '박지영',
    baptismalName: '헬레나',
    phone: '416-555-2102',
    email: '',
    address: '456 Steeles Ave E, Markham, ON',
    roles: ['parent'],               // 학부모만 (한 분만 등록)
    teacherInfo: null,
    parentInfo: {
      childPersonIds: ['person-12'],
      spousePersonId: null,          // 배우자 없음
    },
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-17',
    name: '이동규',
    baptismalName: '요한',
    phone: '416-555-2103',
    email: '',
    address: '789 Yonge St, Richmond Hill, ON',
    roles: ['parent'],
    teacherInfo: null,
    parentInfo: {
      childPersonIds: ['person-13', 'person-14'],
      spousePersonId: 'person-18',
    },
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-18',
    name: '서민정',
    baptismalName: '클라라',
    phone: '416-555-2113',
    email: '',
    address: '789 Yonge St, Richmond Hill, ON',
    roles: ['parent'],               // 학부모만 (배우자도 학부모)
    teacherInfo: null,
    parentInfo: {
      childPersonIds: ['person-13', 'person-14'],
      spousePersonId: 'person-17',
    },
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-19',
    name: '최영미',
    baptismalName: '아가타',
    phone: '416-555-2104',
    email: '',
    address: '88 Sheppard Ave E, North York, ON',
    roles: ['parent'],
    teacherInfo: null,
    parentInfo: {
      childPersonIds: ['person-15'],
      spousePersonId: 'person-5',
    },
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-20',
    name: '정다운',
    baptismalName: '가브리엘라',
    phone: '416-555-2105',
    email: '',
    address: '250 Bayview Ave, Toronto, ON',
    roles: ['parent'],
    teacherInfo: null,
    parentInfo: {
      childPersonIds: ['person-16-child'],
      spousePersonId: 'person-21',
    },
    studentInfo: null,
    notes: '',
  },
  {
    id: 'person-21',
    name: '오진우',
    baptismalName: '스테파노',
    phone: '416-555-2115',
    email: '',
    address: '250 Bayview Ave, Toronto, ON',
    roles: ['parent'],
    teacherInfo: null,
    parentInfo: {
      childPersonIds: ['person-16-child'],
      spousePersonId: 'person-20',
    },
    studentInfo: null,
    notes: '',
  },

  // ----------------------------------------------------------
  //  학생
  // ----------------------------------------------------------
  {
    id: 'person-10',
    name: '김다니엘',
    baptismalName: '다니엘',
    phone: '',
    email: '',
    address: '',
    roles: ['student'],
    teacherInfo: null,
    parentInfo: null,
    studentInfo: {
      grade: 'G5',
      gender: '남',
      feastDay: '09-29',
      firstCommunion: true,
      confirmation: false,
      departments: ['복사', '성가대'],
      parentPersonIds: ['person-1', 'person-2'],
    },
    notes: '복사단 1년차, 성가대 알토',
  },
  {
    id: 'person-11',
    name: '김로사',
    baptismalName: '로사',
    phone: '',
    email: '',
    address: '',
    roles: ['student'],
    teacherInfo: null,
    parentInfo: null,
    studentInfo: {
      grade: 'G2',
      gender: '여',
      feastDay: '08-23',
      firstCommunion: false,
      confirmation: false,
      departments: ['성가대'],
      parentPersonIds: ['person-1', 'person-2'],
    },
    notes: '첫영성체 교리반 예정',
  },
  {
    id: 'person-12',
    name: '박준우',
    baptismalName: '안드레아',
    phone: '',
    email: '',
    address: '',
    roles: ['student'],
    teacherInfo: null,
    parentInfo: null,
    studentInfo: {
      grade: 'G8',
      gender: '남',
      feastDay: '09-20',
      firstCommunion: true,
      confirmation: true,
      departments: ['복사', '밴드'],
      parentPersonIds: ['person-16'],
    },
    notes: '대복사 및 밴드 드럼 봉사',
  },
  {
    id: 'person-13',
    name: '이유나',
    baptismalName: '젬마',
    phone: '',
    email: '',
    address: '',
    roles: ['student'],
    teacherInfo: null,
    parentInfo: null,
    studentInfo: {
      grade: 'G11',
      gender: '여',
      feastDay: '04-11',
      firstCommunion: true,
      confirmation: true,
      departments: ['전례(해설/독서)', '현악'],
      parentPersonIds: ['person-17', 'person-18'],
    },
    notes: '토요 미사 1독서 봉사 및 바이올린 연주',
  },
  {
    id: 'person-14',
    name: '이준호',
    baptismalName: '사도요한',
    phone: '',
    email: '',
    address: '',
    roles: ['student'],
    teacherInfo: null,
    parentInfo: null,
    studentInfo: {
      grade: 'SK',
      gender: '남',
      feastDay: '12-27',
      firstCommunion: false,
      confirmation: false,
      departments: ['기타'],
      parentPersonIds: ['person-17', 'person-18'],
    },
    notes: '유치부 새싹단',
  },
  {
    id: 'person-15',
    name: '최소율',
    baptismalName: '소피아',
    phone: '',
    email: '',
    address: '',
    roles: ['student'],
    teacherInfo: null,
    parentInfo: null,
    studentInfo: {
      grade: 'G4',
      gender: '여',
      feastDay: '05-15',
      firstCommunion: true,
      confirmation: false,
      departments: ['전례(해설/독서)'],
      parentPersonIds: ['person-5', 'person-19'],
    },
    notes: '성경 읽기 우수',
  },
  {
    id: 'person-16-child',
    name: '오하진',
    baptismalName: '',
    phone: '',
    email: '',
    address: '',
    roles: ['student'],
    teacherInfo: null,
    parentInfo: null,
    studentInfo: {
      grade: 'JK',
      gender: '남',
      feastDay: '',
      firstCommunion: false,
      confirmation: false,
      departments: [],
      parentPersonIds: ['person-20', 'person-21'],
    },
    notes: '유아세례 준비 중',
  },
];

// ============================================================
//  7. 시즌(Season) 및 날짜 헬퍼
//     시즌 규정: 매년 9월 ~ 이듬해 6월 (예: 2026-09 ~ 2027-06 => 2026-2027 시즌)
// ============================================================
export const AVAILABLE_SEASONS = [
  { id: '2026-2027', label: '2026-2027 학년도 (현재 시즌)', startDate: '2026-09-01', endDate: '2027-06-30', isCurrent: true },
  { id: '2025-2026', label: '2025-2026 학년도 (지난 시즌)', startDate: '2025-09-01', endDate: '2026-06-30', isCurrent: false },
  { id: '2024-2025', label: '2024-2025 학년도 (2년 전 시즌)', startDate: '2024-09-01', endDate: '2025-06-30', isCurrent: false },
];

export const SEASON_MONTHS = [
  { month: 9, label: '9월' },
  { month: 10, label: '10월' },
  { month: 11, label: '11월' },
  { month: 12, label: '12월' },
  { month: 1, label: '1월' },
  { month: 2, label: '2월' },
  { month: 3, label: '3월' },
  { month: 4, label: '4월' },
  { month: 5, label: '5월' },
  { month: 6, label: '6월' },
];

/** 날짜 문자열(YYYY-MM-DD)로부터 해당 시즌 ID 반환 */
export function getSeasonFromDate(dateStr) {
  if (!dateStr) return '2026-2027';
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (month >= 9) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/** 최근 토요일 날짜 계산 헬퍼 (로컬 타임존) */
export function getRecentSaturday(offsetWeeks = 0) {
  const d = new Date();
  const day = d.getDay(); // 0(일)~6(토)
  const diffToSaturday = (day === 6) ? 0 : (day + 1);
  d.setDate(d.getDate() - diffToSaturday - (offsetWeeks * 7));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

export function getCurrentSeasonId() {
  const current = AVAILABLE_SEASONS.find(s => s.isCurrent);
  if (current) return current.id;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return getSeasonFromDate(`${y}-${m}-${d}`);
}

const saturdayToday = getRecentSaturday(0);

// ============================================================
//  8. 출석 초기 데이터 (시즌별 다주차 풍부한 목업 데이터)
// ============================================================
function generateMockAttendanceHistory() {
  const records = [];
  let attId = 1;

  // 학생 ID 목록
  const studentIds = ['person-10', 'person-11', 'person-12', 'person-13', 'person-14', 'person-15', 'person-16-child'];
  const teachers = ['강태양 (요셉)', '최현우 (프란치스코)', '윤지훈 (라파엘)', '정유미 (안나)', '임소라 (데레사)'];

  // 1. 2026-2027 — 학사 일정 수업일(hasSchool)과 일치 (휴교일·미등록일 제외)
  const currentSeasonSaturdays = [
    '2026-09-12', '2026-09-19', '2026-09-26',
    '2026-10-03', '2026-10-17', '2026-10-24', '2026-10-31',
    '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28',
    '2026-12-05', '2026-12-12', '2026-12-19',
    '2027-01-09', '2027-01-16', '2027-01-23', '2027-01-30',
    '2027-02-06', '2027-02-13', '2027-02-20', '2027-02-27',
    '2027-03-06', '2027-03-20', '2027-03-27',
    '2027-04-03', '2027-04-10', '2027-04-17', '2027-04-24',
    '2027-05-01', '2027-05-08', '2027-05-15', '2027-05-29',
    '2027-06-05', '2027-06-12', '2027-06-19'
  ];

  // 2. 2025-2026 지난 시즌 토요일들
  const prevSeasonSaturdays = [
    '2025-09-06', '2025-09-13', '2025-09-20', '2025-09-27',
    '2025-10-04', '2025-10-11', '2025-10-18', '2025-10-25',
    '2025-11-08', '2025-11-15', '2025-11-22', '2025-11-29',
    '2025-12-06', '2025-12-13', '2025-12-20',
    '2026-01-10', '2026-01-17', '2026-01-24', '2026-01-31',
    '2026-02-07', '2026-02-14', '2026-02-21', '2026-02-28',
    '2026-03-07', '2026-03-14', '2026-03-21', '2026-03-28',
    '2026-04-04', '2026-04-11', '2026-04-18', '2026-04-25',
    '2026-05-02', '2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30',
    '2026-06-06', '2026-06-13', '2026-06-20'
  ];

  // 가상의 일관된 출석 상태 생성 함수
  function populateForDates(dates) {
    dates.forEach((dateStr, dateIdx) => {
      studentIds.forEach((sId, sIdx) => {
        // 학생별 출석 성향 (김다니엘, 박준우, 이유나는 95%+ 출석, 김로사 90%, 이서준 80% 등)
        const hash = (dateIdx * 13 + sIdx * 7) % 100;
        let status = '출석';

        if (sId === 'person-10' || sId === 'person-12') {
          // 우수 학생 (개근권)
          status = hash < 95 ? '출석' : '결석';
        } else if (sId === 'person-13' || sId === 'person-15') {
          status = hash < 90 ? '출석' : '결석';
        } else {
          status = hash < 84 ? '출석' : '결석';
        }

        const points = status === '출석' ? 10 : 0;

        records.push({
          id: `att-${attId++}`,
          date: dateStr,
          studentPersonId: sId,
          status,
          massAttended: status === '출석',
          pointsEarned: points,
          recordedBy: teachers[dateIdx % teachers.length]
        });
      });
    });
  }

  populateForDates(prevSeasonSaturdays);
  populateForDates(currentSeasonSaturdays);

  return records;
}

export const INITIAL_ATTENDANCE = generateMockAttendanceHistory();

// ============================================================
//  9. 활동 초기 데이터
// ============================================================
export const INITIAL_ACTIVITIES = [
  {
    id: 'act-1',
    date: saturdayToday,
    studentPersonId: 'person-10',
    department: '복사',
    roleDetail: '주일 어린이 미사 복사 서기',
    pointsEarned: 15,
    recordedBy: '김민호 (미카엘)'
  },
  {
    id: 'act-2',
    date: saturdayToday,
    studentPersonId: 'person-12',
    department: '밴드',
    roleDetail: '미사 전 찬양 드럼 반주',
    pointsEarned: 10,
    recordedBy: '이수진 (세실리아)'
  },
  {
    id: 'act-3',
    date: saturdayToday,
    studentPersonId: 'person-13',
    department: '전례(해설/독서)',
    roleDetail: '주일 미사 제1독서 봉헌',
    pointsEarned: 10,
    recordedBy: '이수진 (세실리아)'
  },
  {
    id: 'act-4',
    date: saturdayToday,
    studentPersonId: 'person-13',
    department: '현악',
    roleDetail: '특송 바이올린 독주',
    pointsEarned: 10,
    recordedBy: '이수진 (세실리아)'
  },
];

// ============================================================
//  10. 은총표 원장 초기 데이터
// ============================================================
export const INITIAL_GRACE_LEDGER = [
  { id: 'gl-1', studentPersonId: 'person-10', date: saturdayToday, type: '출석', amount: 10, reason: '주일 학교 출석', issuedBy: '강태양 (요셉)' },
  { id: 'gl-2', studentPersonId: 'person-10', date: saturdayToday, type: '활동', amount: 15, reason: '복사단 미사 봉헌', issuedBy: '김민호 (미카엘)' },
  { id: 'gl-3', studentPersonId: 'person-10', date: saturdayToday, type: '추가점수', amount: 10, reason: '사순절 성경 구절 암송 우수', issuedBy: '김민호 (미카엘)' },
  { id: 'gl-4', studentPersonId: 'person-12', date: saturdayToday, type: '출석', amount: 10, reason: '주일 학교 출석', issuedBy: '윤지훈 (라파엘)' },
  { id: 'gl-5', studentPersonId: 'person-12', date: saturdayToday, type: '활동', amount: 10, reason: '찬양 밴드 드럼 봉사', issuedBy: '이수진 (세실리아)' },
  { id: 'gl-6', studentPersonId: 'person-12', date: saturdayToday, type: '추가점수', amount: 5, reason: '교리실 뒷정리 모범', issuedBy: '윤지훈 (라파엘)' },
  { id: 'gl-7', studentPersonId: 'person-13', date: saturdayToday, type: '출석', amount: 10, reason: '주일 학교 출석', issuedBy: '임소라 (데레사)' },
  { id: 'gl-8', studentPersonId: 'person-13', date: saturdayToday, type: '활동', amount: 20, reason: '제1독서 및 바이올린 특송 봉헌', issuedBy: '이수진 (세실리아)' },
];

// ============================================================
//  11. 주일학교 학사 일정 (Schedules)
// ============================================================
export function generateInitialSchedules() {
  return [
    { id: 'sch-2026-09-12', date: '2026-09-12', seasonId: '2026-2027', title: '2026-2027 학년도 개학 미사 & 첫 만남', type: 'special', hasSchool: true, notes: '개학 오리엔테이션 및 반 배정' },
    { id: 'sch-2026-09-19', date: '2026-09-19', seasonId: '2026-2027', title: '토요 주일학교 & 성 김대건 안드레아 대축일 특강', type: 'regular', hasSchool: true, notes: '본당 주보성인 축일 기념 행사' },
    { id: 'sch-2026-09-26', date: '2026-09-26', seasonId: '2026-2027', title: '정규 토요 주일학교 (2회차)', type: 'regular', hasSchool: true, notes: '성경 교리 수업' },
    { id: 'sch-2026-10-03', date: '2026-10-03', seasonId: '2026-2027', title: '정규 토요 주일학교 (3회차)', type: 'regular', hasSchool: true, notes: '성체 성사 교리' },
    { id: 'sch-2026-10-10', date: '2026-10-10', seasonId: '2026-2027', title: '🍁 Thanksgiving 연휴 (휴교)', type: 'holiday', hasSchool: false, notes: '추수감사절 연휴로 주일학교 쉼' },
    { id: 'sch-2026-10-17', date: '2026-10-17', seasonId: '2026-2027', title: '정규 토요 주일학교 (4회차)', type: 'regular', hasSchool: true, notes: '묵주기도 성월 특별 교리' },
    { id: 'sch-2026-10-24', date: '2026-10-24', seasonId: '2026-2027', title: '정규 토요 주일학교 (5회차)', type: 'regular', hasSchool: true, notes: '묵주기도 성월' },
    { id: 'sch-2026-10-31', date: '2026-10-31', seasonId: '2026-2027', title: '정규 토요 주일학교 & 모든 성인 대축일 전야', type: 'special', hasSchool: true, notes: '성인 성녀 코스튬 및 나눔' },
    { id: 'sch-2026-11-07', date: '2026-11-07', seasonId: '2026-2027', title: '정규 토요 주일학교 (6회차)', type: 'regular', hasSchool: true, notes: '위령 성월 기도' },
    { id: 'sch-2026-11-14', date: '2026-11-14', seasonId: '2026-2027', title: '정규 토요 주일학교 (7회차)', type: 'regular', hasSchool: true, notes: '찬양 교리' },
    { id: 'sch-2026-11-21', date: '2026-11-21', seasonId: '2026-2027', title: '정규 토요 주일학교 (8회차)', type: 'regular', hasSchool: true, notes: '전례력 마감 교리' },
    { id: 'sch-2026-11-28', date: '2026-11-28', seasonId: '2026-2027', title: '대림 제1주일 전야 & 대림초 점등', type: 'special', hasSchool: true, notes: '대림 시기 시작' },
    { id: 'sch-2026-12-05', date: '2026-12-05', seasonId: '2026-2027', title: '정규 토요 주일학교 (9회차)', type: 'regular', hasSchool: true, notes: '성탄 맞이 고해성사 준비' },
    { id: 'sch-2026-12-12', date: '2026-12-12', seasonId: '2026-2027', title: '정규 토요 주일학교 (10회차)', type: 'regular', hasSchool: true, notes: '성탄 축하 발표회 리허설' },
    { id: 'sch-2026-12-19', date: '2026-12-19', seasonId: '2026-2027', title: '🎄 성탄 축하 은총잔치 & 달란트 시장', type: 'special', hasSchool: true, notes: '1학기 은총표 사용 및 잔치' },
    { id: 'sch-2026-12-26', date: '2026-12-26', seasonId: '2026-2027', title: '❄️ 성탄/연말 방학 (휴교)', type: 'holiday', hasSchool: false, notes: '겨울 방학' },
    { id: 'sch-2027-01-02', date: '2027-01-02', seasonId: '2026-2027', title: '🌅 신년 연휴 (휴교)', type: 'holiday', hasSchool: false, notes: '새해 첫 주 방학' },
    { id: 'sch-2027-01-09', date: '2027-01-09', seasonId: '2026-2027', title: '새해 첫 주일학교 개강 (11회차)', type: 'regular', hasSchool: true, notes: '2학기 시작' },
    { id: 'sch-2027-01-16', date: '2027-01-16', seasonId: '2026-2027', title: '정규 토요 주일학교 (12회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-01-23', date: '2027-01-23', seasonId: '2026-2027', title: '정규 토요 주일학교 (13회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-01-30', date: '2027-01-30', seasonId: '2026-2027', title: '정규 토요 주일학교 (14회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-02-06', date: '2027-02-06', seasonId: '2026-2027', title: '정규 토요 주일학교 (15회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-02-13', date: '2027-02-13', seasonId: '2026-2027', title: '사순 시기 준비 교리 (16회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-02-20', date: '2027-02-20', seasonId: '2026-2027', title: 'Family Day 연휴 (17회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-02-27', date: '2027-02-27', seasonId: '2026-2027', title: '정규 토요 주일학교 (18회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-03-06', date: '2027-03-06', seasonId: '2026-2027', title: '정규 토요 주일학교 (19회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-03-13', date: '2027-03-13', seasonId: '2026-2027', title: '🌸 March Break 봄방학 (휴교)', type: 'holiday', hasSchool: false, notes: '온타리오 봄방학 기간' },
    { id: 'sch-2027-03-20', date: '2027-03-20', seasonId: '2026-2027', title: '정규 토요 주일학교 (20회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-03-27', date: '2027-03-27', seasonId: '2026-2027', title: '성주간 및 주님 수난 성지주일 교리', type: 'special', hasSchool: true, notes: '' },
    { id: 'sch-2027-04-03', date: '2027-04-03', seasonId: '2026-2027', title: '🐣 주님 부활 대축일 은총 미사 & 달걀 찾기', type: 'special', hasSchool: true, notes: '부활 대축일 행사' },
    { id: 'sch-2027-04-10', date: '2027-04-10', seasonId: '2026-2027', title: '정규 토요 주일학교 (21회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-04-17', date: '2027-04-17', seasonId: '2026-2027', title: '정규 토요 주일학교 (22회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-04-24', date: '2027-04-24', seasonId: '2026-2027', title: '정규 토요 주일학교 (23회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-05-01', date: '2027-05-01', seasonId: '2026-2027', title: '성모 성월 화관식 & 첫영성체반 특별 교리', type: 'special', hasSchool: true, notes: '' },
    { id: 'sch-2027-05-08', date: '2027-05-08', seasonId: '2026-2027', title: '정규 토요 주일학교 (24회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-05-15', date: '2027-05-15', seasonId: '2026-2027', title: '정규 토요 주일학교 (25회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-05-22', date: '2027-05-22', seasonId: '2026-2027', title: 'Victoria Day 연휴 (휴교)', type: 'holiday', hasSchool: false, notes: '연휴' },
    { id: 'sch-2027-05-29', date: '2027-05-29', seasonId: '2026-2027', title: '정규 토요 주일학교 (26회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-06-05', date: '2027-06-05', seasonId: '2026-2027', title: '정규 토요 주일학교 (27회차)', type: 'regular', hasSchool: true, notes: '' },
    { id: 'sch-2027-06-12', date: '2027-06-12', seasonId: '2026-2027', title: '학기말 성경 퀴즈대회 (28회차)', type: 'special', hasSchool: true, notes: '' },
    { id: 'sch-2027-06-19', date: '2027-06-19', seasonId: '2026-2027', title: '🎓 2026-2027 학년도 종업식, 시상식 & 여름 은총잔치', type: 'special', hasSchool: true, notes: '학년도 마지막 모임 및 개근상 수여' }
  ];
}

export const INITIAL_SCHEDULES = generateInitialSchedules();
