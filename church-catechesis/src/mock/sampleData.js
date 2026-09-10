// sampleData.js
// church-catechesis 주일학교 기본 및 목업 데이터

export const DEFAULT_SETTINGS = {
  attendancePoints: 10,       // 주일 출석 시 기본 은총표
  massAttendancePoints: 5,    // 주일 미사 참례 추가 은총표
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

export const GRADES = [
  { id: 'JK', label: '유치원 JK', group: 'kinder' },
  { id: 'SK', label: '유치원 SK', group: 'kinder' },
  { id: 'G1', label: '1학년 (G1)', group: 'elementary_low' },
  { id: 'G2', label: '2학년 (G2)', group: 'elementary_low' },
  { id: 'G3', label: '3학년 (G3)', group: 'elementary_mid' },
  { id: 'G4', label: '4학년 (G4)', group: 'elementary_mid' },
  { id: 'G5', label: '5학년 (G5)', group: 'elementary_high' },
  { id: 'G6', label: '6학년 (G6)', group: 'elementary_high' },
  { id: 'G7', label: '7학년 (G7)', group: 'middle' },
  { id: 'G8', label: '8학년 (G8)', group: 'middle' },
  { id: 'G9', label: '9학년 (G9)', group: 'high' },
  { id: 'G10', label: '10학년 (G10)', group: 'high' },
  { id: 'G11', label: '11학년 (G11)', group: 'high' },
  { id: 'G12', label: '12학년 (G12)', group: 'high' },
];

export const GRADE_GROUPS = [
  { id: 'all', label: '전체 학년' },
  { id: 'kinder', label: '유치부 (JK, SK)' },
  { id: 'elementary', label: '초등부 (G1~G6)' },
  { id: 'youth', label: '중고등부 (G7~G12)' },
];

export const DEPARTMENTS = [
  '복사',
  '전례(해설/독서)',
  '현악',
  '밴드',
  '성가대',
  '기타'
];

export const INITIAL_TEACHERS = [
  {
    id: 't-1',
    name: '김민호',
    baptismalName: '미카엘',
    role: '교감',
    assignedGrades: ['전체'],
    phone: '416-555-0101',
    email: 'michael.kim@parish.org'
  },
  {
    id: 't-2',
    name: '이수진',
    baptismalName: '세실리아',
    role: '부교감',
    assignedGrades: ['전체'],
    phone: '416-555-0102',
    email: 'cecilia.lee@parish.org'
  },
  {
    id: 't-3',
    name: '박은혜',
    baptismalName: '루시아',
    role: '교사',
    assignedGrades: ['JK', 'SK'],
    phone: '416-555-0103',
    email: 'lucia.park@parish.org'
  },
  {
    id: 't-4',
    name: '최현우',
    baptismalName: '프란치스코',
    role: '교사',
    assignedGrades: ['G1', 'G2'],
    phone: '416-555-0104',
    email: 'francis.choi@parish.org'
  },
  {
    id: 't-5',
    name: '정유미',
    baptismalName: '안나',
    role: '교사',
    assignedGrades: ['G3', 'G4'],
    phone: '416-555-0105',
    email: 'anna.jung@parish.org'
  },
  {
    id: 't-6',
    name: '강태양',
    baptismalName: '요셉',
    role: '교사',
    assignedGrades: ['G5', 'G6'],
    phone: '416-555-0106',
    email: 'joseph.kang@parish.org'
  },
  {
    id: 't-7',
    name: '윤지훈',
    baptismalName: '라파엘',
    role: '교사',
    assignedGrades: ['G7', 'G8'],
    phone: '416-555-0107',
    email: 'raphael.yoon@parish.org'
  },
  {
    id: 't-8',
    name: '임소라',
    baptismalName: '데레사',
    role: '교사',
    assignedGrades: ['G9', 'G10', 'G11', 'G12'],
    phone: '416-555-0108',
    email: 'theresa.lim@parish.org'
  },
];

export const INITIAL_PARENTS = [
  {
    id: 'p-1',
    name: '김성훈',
    baptismalName: '베드로',
    phone: '416-555-2101',
    address: '123 Finch Ave W, North York, ON',
    studentIds: ['s-1', 's-2'],
    isSingleParent: false,
    spouseName: '한지혜 (마리아)'
  },
  {
    id: 'p-2',
    name: '박지영',
    baptismalName: '헬레나',
    phone: '416-555-2102',
    address: '456 Steeles Ave E, Markham, ON',
    studentIds: ['s-3'],
    isSingleParent: true, // 한부모 가정 지원
    spouseName: null
  },
  {
    id: 'p-3',
    name: '이동규',
    baptismalName: '요한',
    phone: '416-555-2103',
    address: '789 Yonge St, Richmond Hill, ON',
    studentIds: ['s-4', 's-5'],
    isSingleParent: false,
    spouseName: '서민정 (클라라)'
  },
  {
    id: 'p-4',
    name: '최영미',
    baptismalName: '아가타',
    phone: '416-555-2104',
    address: '88 Sheppard Ave E, North York, ON',
    studentIds: ['s-6'],
    isSingleParent: true, // 한부모 가정 지원
    spouseName: null
  },
  {
    id: 'p-5',
    name: '정다운',
    baptismalName: '가브리엘라',
    phone: '416-555-2105',
    address: '250 Bayview Ave, Toronto, ON',
    studentIds: ['s-7'],
    isSingleParent: false,
    spouseName: '오진우 (스테파노)'
  }
];

export const INITIAL_STUDENTS = [
  {
    id: 's-1',
    name: '김다니엘',
    baptismalName: '다니엘',
    grade: 'G5',
    gender: '남',
    feastDay: '07-21',
    firstCommunion: true,
    confirmation: false,
    departments: ['복사', '성가대'],
    parentId: 'p-1',
    notes: '복사단 1년차, 성가대 알토'
  },
  {
    id: 's-2',
    name: '김로사',
    baptismalName: '로사',
    grade: 'G2',
    gender: '여',
    feastDay: '08-23',
    firstCommunion: false,
    confirmation: false,
    departments: ['성가대'],
    parentId: 'p-1',
    notes: '첫영성체 교리반 예정'
  },
  {
    id: 's-3',
    name: '박준우',
    baptismalName: '안토니오',
    grade: 'G8',
    gender: '남',
    feastDay: '06-13',
    firstCommunion: true,
    confirmation: true,
    departments: ['복사', '밴드'],
    parentId: 'p-2',
    notes: '대복사 및 밴드 드럼 봉사'
  },
  {
    id: 's-4',
    name: '이유나',
    baptismalName: '젬마',
    grade: 'G11',
    gender: '여',
    feastDay: '04-11',
    firstCommunion: true,
    confirmation: true,
    departments: ['전례(해설/독서)', '현악'],
    parentId: 'p-3',
    notes: '주일 1독서 봉사 및 바이올린 연주'
  },
  {
    id: 's-5',
    name: '이준호',
    baptismalName: '사도요한',
    grade: 'SK',
    gender: '남',
    feastDay: '12-27',
    firstCommunion: false,
    confirmation: false,
    departments: ['기타'],
    parentId: 'p-3',
    notes: '유치부 새싹단'
  },
  {
    id: 's-6',
    name: '최소율',
    baptismalName: '소피아',
    grade: 'G4',
    gender: '여',
    feastDay: '05-15',
    firstCommunion: true,
    confirmation: false,
    departments: ['전례(해설/독서)'],
    parentId: 'p-4',
    notes: '성경 읽기 우수'
  },
  {
    id: 's-7',
    name: '오하진',
    baptismalName: '', // 아직 세례받지 않은 예비 신자 학생 (축일 없음)
    grade: 'JK',
    gender: '남',
    feastDay: '',
    firstCommunion: false,
    confirmation: false,
    departments: [],
    parentId: 'p-5',
    notes: '유아세례 준비 중'
  },
];

// 최근 주일 날짜 계산용 헬퍼 (최근 일요일)
function getRecentSunday(offsetWeeks = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day - (offsetWeeks * 7);
  const sunday = new Date(d.setDate(diff));
  return sunday.toISOString().split('T')[0];
}

const sundayToday = getRecentSunday(0);
const sundayLastWeek = getRecentSunday(1);

export const INITIAL_ATTENDANCE = [
  {
    id: 'att-1',
    date: sundayToday,
    studentId: 's-1',
    status: '출석',
    massAttended: true,
    pointsEarned: 15, // 10 (출석) + 5 (미사)
    recordedBy: '강태양 (요셉)'
  },
  {
    id: 'att-2',
    date: sundayToday,
    studentId: 's-2',
    status: '출석',
    massAttended: true,
    pointsEarned: 15,
    recordedBy: '최현우 (프란치스코)'
  },
  {
    id: 'att-3',
    date: sundayToday,
    studentId: 's-3',
    status: '출석',
    massAttended: true,
    pointsEarned: 15,
    recordedBy: '윤지훈 (라파엘)'
  },
  {
    id: 'att-4',
    date: sundayToday,
    studentId: 's-4',
    status: '지각',
    massAttended: true,
    pointsEarned: 10,
    recordedBy: '임소라 (데레사)'
  },
  {
    id: 'att-5',
    date: sundayToday,
    studentId: 's-6',
    status: '출석',
    massAttended: false,
    pointsEarned: 10,
    recordedBy: '정유미 (안나)'
  },
];

export const INITIAL_ACTIVITIES = [
  {
    id: 'act-1',
    date: sundayToday,
    studentId: 's-1',
    department: '복사',
    roleDetail: '주일 어린이 미사 복사 서기',
    pointsEarned: 15,
    recordedBy: '김민호 (미카엘)'
  },
  {
    id: 'act-2',
    date: sundayToday,
    studentId: 's-3',
    department: '밴드',
    roleDetail: '미사 전 찬양 드럼 반주',
    pointsEarned: 10,
    recordedBy: '이수진 (세실리아)'
  },
  {
    id: 'act-3',
    date: sundayToday,
    studentId: 's-4',
    department: '전례(해설/독서)',
    roleDetail: '주일 미사 제1독서 봉헌',
    pointsEarned: 10,
    recordedBy: '이수진 (세실리아)'
  },
  {
    id: 'act-4',
    date: sundayToday,
    studentId: 's-4',
    department: '현악',
    roleDetail: '특송 바이올린 독주',
    pointsEarned: 10,
    recordedBy: '이수진 (세실리아)'
  }
];

export const INITIAL_GRACE_LEDGER = [
  // 김다니엘 (s-1)
  {
    id: 'gl-1',
    studentId: 's-1',
    date: sundayToday,
    type: '출석',
    amount: 15,
    reason: '주일 학교 및 미사 출석',
    issuedBy: '강태양 (요셉)'
  },
  {
    id: 'gl-2',
    studentId: 's-1',
    date: sundayToday,
    type: '활동',
    amount: 15,
    reason: '복사단 미사 봉헌',
    issuedBy: '김민호 (미카엘)'
  },
  {
    id: 'gl-3',
    studentId: 's-1',
    date: sundayToday,
    type: '추가점수',
    amount: 10,
    reason: '사순절 성경 구절 암송 우수',
    issuedBy: '김민호 (미카엘)'
  },
  // 박준우 (s-3)
  {
    id: 'gl-4',
    studentId: 's-3',
    date: sundayToday,
    type: '출석',
    amount: 15,
    reason: '주일 학교 및 미사 출석',
    issuedBy: '윤지훈 (라파엘)'
  },
  {
    id: 'gl-5',
    studentId: 's-3',
    date: sundayToday,
    type: '활동',
    amount: 10,
    reason: '찬양 밴드 드럼 봉사',
    issuedBy: '이수진 (세실리아)'
  },
  {
    id: 'gl-6',
    studentId: 's-3',
    date: sundayToday,
    type: '추가점수',
    amount: 5,
    reason: '교리실 뒷정리 모범',
    issuedBy: '윤지훈 (라파엘)'
  },
  // 이유나 (s-4)
  {
    id: 'gl-7',
    studentId: 's-4',
    date: sundayToday,
    type: '출석',
    amount: 10,
    reason: '주일 학교 지각 및 미사 참례',
    issuedBy: '임소라 (데레사)'
  },
  {
    id: 'gl-8',
    studentId: 's-4',
    date: sundayToday,
    type: '활동',
    amount: 20,
    reason: '제1독서 및 바이올린 특송 봉헌',
    issuedBy: '이수진 (세실리아)'
  }
];
