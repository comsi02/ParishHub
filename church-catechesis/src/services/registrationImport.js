// registrationImport.js
// 주일학교 등록 Google Sheet CSV → Person[] 변환
// 이메일 주소 컬럼은 사용하지 않음 (재임포트 키용만)

/**
 * RFC4180-ish CSV parse (quoted fields, escaped quotes)
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c !== ''));
}

function findCol(headers, predicates) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] || '';
    if (predicates.some(fn => fn(h))) return i;
  }
  return -1;
}

function col(row, idx) {
  if (idx < 0) return '';
  return (row[idx] || '').trim();
}

/** 재임포트 키용 안정 해시 (email|name 원문을 직접 저장하지 않음) */
function stableHash(input) {
  const s = String(input ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  let h2 = 0;
  for (let i = 0; i < s.length; i++) {
    h2 = (h2 * 33 + s.charCodeAt(i)) >>> 0;
  }
  return (h >>> 0).toString(36) + h2.toString(36);
}

/** 시트 이메일 정규화 (Google 계정 자동 매칭에는 사용하지 않음) */
function normalizeRegistrationEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return '';
  return email;
}

function normalizePersonName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/**
 * importKey = hash(email|name)
 * (Google 계정 자동 매칭에는 사용하지 않음)
 */
function makeImportKey(email, name) {
  const raw = `${email}|${normalizePersonName(name)}`.toLowerCase();
  return `imp_${stableHash(raw)}`;
}

/** familyKey = hash(email) */
function makeFamilyKey(email) {
  return `fam_${stableHash(email.toLowerCase())}`;
}

function isPlaceholderName(name) {
  if (!name) return true;
  const n = name.trim();
  if (!n) return true;
  if (n === '확인') return true;
  if (/^자녀\d*$/.test(n)) return true;
  return false;
}

function parseYesNo(v) {
  const s = String(v || '').trim();
  if (s === '예' || s === 'Y' || s === 'y' || s === 'true' || s === 'TRUE') return true;
  return false;
}

function parseDepartments(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  if (/희망\s*안함|부서\s*활동\s*안함|해당\s*없음|없음/.test(s)) return [];

  const parts = [];
  let buf = '';
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === '，') && depth === 0) {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());

  return parts.map(d =>
    d
      .replace(/전례\s*\(\s*해설\s*[,/]\s*독서\s*\)/g, '전례(해설/독서)')
      .replace(/전례\(해설\/독서\)/g, '전례(해설/독서)')
  );
}

function normalizeGrade(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s || s === '확인') return '';
  const m = s.match(/^(JK|SK|G\d{1,2})$/i);
  if (m) return m[1].toUpperCase().replace(/^G0*/, (x) => x.length > 1 && x !== 'G' ? 'G' + parseInt(x.slice(1), 10) : x);
  if (/^G?\d{1,2}$/i.test(s)) return 'G' + parseInt(s.replace(/^G/i, ''), 10);
  return s;
}

function normalizeFeast(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '확인') return '';
  // "4. 28" / "4.28" → "04-28"
  const m = s.match(/(\d{1,2})\s*[./]\s*(\d{1,2})/);
  if (m) {
    return `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return s;
}

function buildHeaderIndex(headers) {
  return {
    timestamp: findCol(headers, [h => h.includes('타임스탬프')]),
    // 재임포트 키로만 사용 (Google 계정 자동 매칭에는 사용하지 않음)
    email: findCol(headers, [h => h.includes('이메일')]),
    applicantName: findCol(headers, [h => h.includes('이름') && h.includes('신청자')]),
    applicantBaptismal: findCol(headers, [h => h.includes('세례명') && h.includes('신청자')]),
    applicantPhone: findCol(headers, [h => h.includes('전화') && h.includes('신청자')]),
    address: findCol(headers, [h => h.startsWith('주소') || h.includes('주소 예')]),
    spouseName: findCol(headers, [h => h.includes('이름') && h.includes('배우자')]),
    spouseBaptismal: findCol(headers, [h => h.includes('세례명') && h.includes('배우자')]),
    spousePhone: findCol(headers, [h => h.includes('전화') && h.includes('배우자')]),
    childCount: findCol(headers, [h => h.includes('자녀수')]),
    children: [1, 2, 3, 4].map(n => ({
      name: findCol(headers, [h => h.includes(`이름(자녀${n})`)]),
      baptismal: findCol(headers, [h => h.includes(`세례명(자녀${n})`)]),
      gender: findCol(headers, [h => h.includes(`성별(자녀${n})`)]),
      grade: findCol(headers, [h => h.includes(`학년(자녀${n})`)]),
      feast: findCol(headers, [h => h.includes(`축일(자녀${n})`)]),
      firstCommunion: findCol(headers, [h => h.includes(`첫`) && h.includes(`영성체`) && h.includes(`자녀${n}`)]),
      confirmation: findCol(headers, [h => h.includes(`견진`) && h.includes(`자녀${n}`)]),
      deptPrev: findCol(headers, [h => h.includes('2025-2026') && h.includes(`자녀${n}`)]),
      deptHope: findCol(headers, [h => h.includes('2026-2027') && h.includes(`자녀${n}`)]),
    })),
  };
}

const FAMILY_CONSENT = {
  photoVideoConsent: true,
  firstCommunionNoticeAck: true,
  ministryServicePledge: true,
  tuitionTransferAck: true,
};

/** 시트와 동일한 논리 헤더 (폼/붙여넣기 안내용) */
export const REGISTRATION_SHEET_HEADERS = [
  '타임스탬프',
  '이메일 주소',
  '이름(신청자)',
  '세례명(신청자)',
  '전화번호(신청자)',
  '주소',
  '이름(배우자)',
  '세례명(배우자)',
  '전화번호(배우자)',
  '자녀수',
  ...[1, 2, 3, 4].flatMap(n => [
    `이름(자녀${n})`,
    `세례명(자녀${n})`,
    `성별(자녀${n})`,
    `학년(자녀${n})`,
    `축일(자녀${n})`,
    `첫영성체(자녀${n})`,
    `견진(자녀${n})`,
    `2025-2026 부서(자녀${n})`,
    `2026-2027 희망부서(자녀${n})`,
  ]),
];

/**
 * 신규 가족 1건 → Person[] (시트 import와 동일 스키마)
 * @param {{
 *   registrationEmail: string,
 *   timestamp?: string,
 *   address?: string,
 *   applicant: { name: string, baptismalName?: string, phone?: string },
 *   spouse?: { name?: string, baptismalName?: string, phone?: string } | null,
 *   children?: Array<{
 *     name: string,
 *     baptismalName?: string,
 *     gender?: string,
 *     grade?: string,
 *     feastDay?: string,
 *     firstCommunion?: boolean|string,
 *     confirmation?: boolean|string,
 *     departmentsPrev?: string,
 *     departments?: string|string[],
 *   }>
 * }} record
 * @returns {{ family: object|null, persons: object[], errors: string[] }}
 */
export function buildPersonsFromFamilyRecord(record) {
  const errors = [];
  const applicantName = normalizePersonName(record?.applicant?.name);
  if (isPlaceholderName(applicantName)) {
    errors.push('신청자(학부모) 이름이 필요합니다.');
    return { family: null, persons: [], errors };
  }

  const registrationEmail = normalizeRegistrationEmail(record?.registrationEmail);
  if (!registrationEmail) {
    errors.push('등록용 이메일(재임포트 키)이 필요합니다.');
    return { family: null, persons: [], errors };
  }

  const address = String(record?.address || '').trim();
  const familyKey = makeFamilyKey(registrationEmail);
  const applicantKey = makeImportKey(registrationEmail, applicantName);

  const spouseName = normalizePersonName(record?.spouse?.name);
  const spouseKey = spouseName && !isPlaceholderName(spouseName)
    ? makeImportKey(registrationEmail, spouseName)
    : null;

  const childKeys = [];
  const children = [];
  const persons = [];

  (record?.children || []).forEach((ch) => {
    const childName = normalizePersonName(ch?.name);
    if (isPlaceholderName(childName)) return;

    const childKey = makeImportKey(registrationEmail, childName);
    childKeys.push(childKey);

    const departments = Array.isArray(ch.departments)
      ? ch.departments
      : parseDepartments(ch.departments || ch.departmentsHope || '');

    const student = {
      id: childKey,
      importKey: childKey,
      familyKey,
      registrationEmail,
      name: childName,
      baptismalName: String(ch.baptismalName || '').trim(),
      phone: '',
      email: '',
      address,
      roles: ['student'],
      teacherInfo: null,
      parentInfo: null,
      studentInfo: {
        grade: normalizeGrade(ch.grade) || 'G1',
        gender: String(ch.gender || '').trim(),
        feastDay: normalizeFeast(ch.feastDay || ch.feast),
        firstCommunion: typeof ch.firstCommunion === 'boolean' ? ch.firstCommunion : parseYesNo(ch.firstCommunion),
        confirmation: typeof ch.confirmation === 'boolean' ? ch.confirmation : parseYesNo(ch.confirmation),
        departments,
        departmentsPrev: String(ch.departmentsPrev || '').trim(),
        parentPersonIds: [applicantKey, ...(spouseKey ? [spouseKey] : [])],
      },
      notes: '',
      source: record?.source || 'family_form',
    };
    children.push(student);
    persons.push(student);
  });

  const applicant = {
    id: applicantKey,
    importKey: applicantKey,
    familyKey,
    registrationEmail,
    name: applicantName,
    baptismalName: String(record?.applicant?.baptismalName || '').trim(),
    phone: String(record?.applicant?.phone || '').trim(),
    email: '',
    address,
    roles: ['parent'],
    teacherInfo: null,
    parentInfo: {
      childPersonIds: [...childKeys],
      spousePersonId: spouseKey,
    },
    studentInfo: null,
    notes: '',
    source: record?.source || 'family_form',
    ...FAMILY_CONSENT,
  };
  persons.push(applicant);

  let spouse = null;
  if (spouseKey) {
    spouse = {
      id: spouseKey,
      importKey: spouseKey,
      familyKey,
      registrationEmail,
      name: spouseName,
      baptismalName: String(record?.spouse?.baptismalName || '').trim(),
      phone: String(record?.spouse?.phone || '').trim(),
      email: '',
      address,
      roles: ['parent'],
      teacherInfo: null,
      parentInfo: {
        childPersonIds: [...childKeys],
        spousePersonId: applicantKey,
      },
      studentInfo: null,
      notes: '',
      source: record?.source || 'family_form',
      ...FAMILY_CONSENT,
    };
    persons.push(spouse);
  }

  const family = {
    familyKey,
    timestamp: String(record?.timestamp || '').trim(),
    applicant,
    spouse,
    children,
    consent: { ...FAMILY_CONSENT },
  };

  return { family, persons, errors };
}

/**
 * @param {string} csvText
 * @returns {{ families: object[], persons: object[], summary: object, errors: string[] }}
 */
export function parseRegistrationCsv(csvText) {
  const table = parseCsv(csvText);
  const errors = [];
  if (table.length < 2) {
    return { families: [], persons: [], summary: { families: 0, parents: 0, students: 0 }, errors: ['CSV에 데이터가 없습니다.'] };
  }

  const headers = table[0];
  const idx = buildHeaderIndex(headers);
  if (idx.applicantName < 0) {
    errors.push('헤더에서 "이름(신청자)" 컬럼을 찾지 못했습니다.');
  }

  const families = [];
  const persons = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const applicantName = col(row, idx.applicantName);
    if (isPlaceholderName(applicantName)) continue;

    const registrationEmail = normalizeRegistrationEmail(col(row, idx.email));
    if (!registrationEmail) {
      errors.push(`${r + 1}행: 이메일이 없어 건너뜁니다. (${applicantName || '이름 없음'})`);
      continue;
    }

    const children = [];
    for (let c = 0; c < idx.children.length; c++) {
      const cmap = idx.children[c];
      const childName = col(row, cmap.name);
      if (isPlaceholderName(childName)) continue;
      children.push({
        name: childName,
        baptismalName: col(row, cmap.baptismal),
        gender: col(row, cmap.gender),
        grade: col(row, cmap.grade),
        feastDay: col(row, cmap.feast),
        firstCommunion: col(row, cmap.firstCommunion),
        confirmation: col(row, cmap.confirmation),
        departmentsPrev: col(row, cmap.deptPrev),
        departments: col(row, cmap.deptHope),
      });
    }

    const built = buildPersonsFromFamilyRecord({
      registrationEmail,
      timestamp: col(row, idx.timestamp),
      address: col(row, idx.address),
      applicant: {
        name: applicantName,
        baptismalName: col(row, idx.applicantBaptismal),
        phone: col(row, idx.applicantPhone),
      },
      spouse: {
        name: col(row, idx.spouseName),
        baptismalName: col(row, idx.spouseBaptismal),
        phone: col(row, idx.spousePhone),
      },
      children,
      source: 'registration_sheet',
    });

    if (built.errors.length) {
      built.errors.forEach(e => errors.push(`${r + 1}행: ${e}`));
      continue;
    }
    if (built.family) families.push(built.family);
    persons.push(...built.persons);
  }

  const summary = {
    families: families.length,
    parents: persons.filter(p => p.roles?.includes('parent')).length,
    students: persons.filter(p => p.roles?.includes('student')).length,
  };

  return { families, persons, summary, errors };
}
