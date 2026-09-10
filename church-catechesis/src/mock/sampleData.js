// sampleData.js
// church-catechesis 주일학교 기본 및 목업 데이터
// v2 - 통합 Person 모델 + 자유 합반(Class) 구조

// ============================================================
//  1. 설정 (Settings)
// ============================================================
export const DEFAULT_SETTINGS = {
  attendancePoints: 10,       // 주일 출석 시 기본 은총표
  massAttendancePoints: 5,    // 주일 미사 참례 추가 은총표
  latePoints: 5,              // 지각 시 은총표
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
  student:          { label: '학생',           icon: '🧒', badgeClass: 'badge-grade' },
  parent:           { label: '학부모',          icon: '👨‍👩‍👧', badgeClass: 'badge-present' },
  teacher:          { label: '교사',            icon: '✝️', badgeClass: 'badge-sacrament' },
  vice_principal:   { label: '부교감',          icon: '✝️', badgeClass: 'badge-grade' },
  principal:        { label: '교감',            icon: '✝️', badgeClass: 'badge-sacrament' },
  liturgy_teacher:  { label: '전례부선생님',    icon: '📖', badgeClass: 'badge-sacrament' },
  acolyte_teacher:  { label: '복사담당선생님',  icon: '🕯️', badgeClass: 'badge-sacrament' },
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
//  7. 최근 토요일 날짜 계산 헬퍼
// ============================================================
export function getRecentSaturday(offsetWeeks = 0) {
  const d = new Date();
  const day = d.getDay(); // 0(일)~6(토)
  const diffToSaturday = (day === 6) ? 0 : (day + 1);
  d.setDate(d.getDate() - diffToSaturday - (offsetWeeks * 7));
  return d.toISOString().split('T')[0];
}

const saturdayToday = getRecentSaturday(0);

// ============================================================
//  8. 출석 초기 데이터
// ============================================================
export const INITIAL_ATTENDANCE = [
  {
    id: 'att-1',
    date: saturdayToday,
    studentPersonId: 'person-10',
    status: '출석',
    massAttended: true,
    pointsEarned: 15,
    recordedBy: '강태양 (요셉)'
  },
  {
    id: 'att-2',
    date: saturdayToday,
    studentPersonId: 'person-11',
    status: '출석',
    massAttended: true,
    pointsEarned: 15,
    recordedBy: '최현우 (프란치스코)'
  },
  {
    id: 'att-3',
    date: saturdayToday,
    studentPersonId: 'person-12',
    status: '출석',
    massAttended: true,
    pointsEarned: 15,
    recordedBy: '윤지훈 (라파엘)'
  },
  {
    id: 'att-4',
    date: saturdayToday,
    studentPersonId: 'person-13',
    status: '지각',
    massAttended: true,
    pointsEarned: 10,
    recordedBy: '임소라 (데레사)'
  },
  {
    id: 'att-5',
    date: saturdayToday,
    studentPersonId: 'person-15',
    status: '출석',
    massAttended: false,
    pointsEarned: 10,
    recordedBy: '정유미 (안나)'
  },
];

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
  { id: 'gl-1', studentPersonId: 'person-10', date: saturdayToday, type: '출석', amount: 15, reason: '주일 학교 및 미사 출석', issuedBy: '강태양 (요셉)' },
  { id: 'gl-2', studentPersonId: 'person-10', date: saturdayToday, type: '활동', amount: 15, reason: '복사단 미사 봉헌', issuedBy: '김민호 (미카엘)' },
  { id: 'gl-3', studentPersonId: 'person-10', date: saturdayToday, type: '추가점수', amount: 10, reason: '사순절 성경 구절 암송 우수', issuedBy: '김민호 (미카엘)' },
  { id: 'gl-4', studentPersonId: 'person-12', date: saturdayToday, type: '출석', amount: 15, reason: '주일 학교 및 미사 출석', issuedBy: '윤지훈 (라파엘)' },
  { id: 'gl-5', studentPersonId: 'person-12', date: saturdayToday, type: '활동', amount: 10, reason: '찬양 밴드 드럼 봉사', issuedBy: '이수진 (세실리아)' },
  { id: 'gl-6', studentPersonId: 'person-12', date: saturdayToday, type: '추가점수', amount: 5, reason: '교리실 뒷정리 모범', issuedBy: '윤지훈 (라파엘)' },
  { id: 'gl-7', studentPersonId: 'person-13', date: saturdayToday, type: '출석', amount: 10, reason: '주일 학교 지각 및 미사 참례', issuedBy: '임소라 (데레사)' },
  { id: 'gl-8', studentPersonId: 'person-13', date: saturdayToday, type: '활동', amount: 20, reason: '제1독서 및 바이올린 특송 봉헌', issuedBy: '이수진 (세실리아)' },
];
