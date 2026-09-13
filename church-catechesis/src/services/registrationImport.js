// registrationImport.js
// 주일학교 등록 Google Sheet CSV → Person[] 변환
// 이메일 주소 컬럼은 사용하지 않음

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

function slug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣\-]/gi, '')
    .slice(0, 40) || 'x';
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
    // email intentionally unused
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

    const spouseName = col(row, idx.spouseName);
    const address = col(row, idx.address);
    const familyKey = `reg-${slug(applicantName)}-${slug(spouseName || 'none')}-${slug(address).slice(0, 20)}`;
    const applicantId = `${familyKey}-parent-a`;
    const spouseId = spouseName && !isPlaceholderName(spouseName) ? `${familyKey}-parent-b` : null;

    const childIds = [];
    const children = [];

    for (let c = 0; c < idx.children.length; c++) {
      const cmap = idx.children[c];
      const childName = col(row, cmap.name);
      if (isPlaceholderName(childName)) continue;

      const childId = `${familyKey}-child-${c + 1}`;
      childIds.push(childId);
      const student = {
        id: childId,
        importKey: childId,
        familyKey,
        name: childName,
        baptismalName: col(row, cmap.baptismal),
        phone: '',
        email: '',
        address,
        roles: ['student'],
        teacherInfo: null,
        parentInfo: null,
        studentInfo: {
          grade: normalizeGrade(col(row, cmap.grade)) || 'G1',
          gender: col(row, cmap.gender) || '',
          feastDay: normalizeFeast(col(row, cmap.feast)),
          firstCommunion: parseYesNo(col(row, cmap.firstCommunion)),
          confirmation: parseYesNo(col(row, cmap.confirmation)),
          departments: parseDepartments(col(row, cmap.deptHope)),
          departmentsPrev: col(row, cmap.deptPrev) || '',
          parentPersonIds: [applicantId, ...(spouseId ? [spouseId] : [])],
        },
        notes: '',
        source: 'registration_sheet',
      };
      children.push(student);
      persons.push(student);
    }

    const applicant = {
      id: applicantId,
      importKey: applicantId,
      familyKey,
      name: applicantName,
      baptismalName: col(row, idx.applicantBaptismal),
      phone: col(row, idx.applicantPhone),
      email: '',
      address,
      roles: ['parent'],
      teacherInfo: null,
      parentInfo: {
        childPersonIds: [...childIds],
        spousePersonId: spouseId,
      },
      studentInfo: null,
      notes: '',
      source: 'registration_sheet',
      ...FAMILY_CONSENT,
    };
    persons.push(applicant);

    let spouse = null;
    if (spouseId) {
      spouse = {
        id: spouseId,
        importKey: spouseId,
        familyKey,
        name: spouseName,
        baptismalName: col(row, idx.spouseBaptismal),
        phone: col(row, idx.spousePhone),
        email: '',
        address,
        roles: ['parent'],
        teacherInfo: null,
        parentInfo: {
          childPersonIds: [...childIds],
          spousePersonId: applicantId,
        },
        studentInfo: null,
        notes: '',
        source: 'registration_sheet',
        ...FAMILY_CONSENT,
      };
      persons.push(spouse);
    }

    families.push({
      familyKey,
      timestamp: col(row, idx.timestamp),
      applicant,
      spouse,
      children,
      consent: { ...FAMILY_CONSENT },
    });
  }

  const summary = {
    families: families.length,
    parents: persons.filter(p => p.roles?.includes('parent')).length,
    students: persons.filter(p => p.roles?.includes('student')).length,
  };

  return { families, persons, summary, errors };
}
