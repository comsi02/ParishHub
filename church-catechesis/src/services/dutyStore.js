// dutyStore.js
// 학사 일정(수업일)별 미사·전례 봉사 배정 — Firestore / localStorage

import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase-init.js';
import { dataProvider } from './DataProvider.js';
import { getSeasonFromDate } from '../mock/sampleData.js';

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';
const DUTY_COLLECTION = 'catechesis_duty_assignments';

/**
 * 학사 일정에 배정하는 봉사 역할
 * multi: true → 인원 수 가변 (배열), false → 1명 (문자열 personId)
 */
export const DUTY_ROLE_DEFS = [
  { id: '해설', label: '해설', tone: 'narrator', icon: '🎙️', multi: false, defaultCount: 1, row: 'narrator' },
  { id: '대복사', label: '대복사', tone: 'server', icon: '🕯️', multi: false, defaultCount: 1, row: 'servers' },
  { id: '소복사', label: '소복사', tone: 'server', icon: '✨', multi: false, defaultCount: 1, row: 'servers' },
  { id: '1독서', label: '1독서', tone: 'reader', icon: '📖', multi: false, defaultCount: 1, row: 'reader' },
  { id: '2독서', label: '2독서', tone: 'reader', icon: '📗', multi: false, defaultCount: 1, row: 'reader' },
  { id: '반주', label: '반주', tone: 'music', icon: '🎹', multi: true, defaultCount: 2, fixed: true, row: 'accomp' },
  { id: '성가대', label: '성가대', tone: 'choir', icon: '🎵', multi: true, defaultCount: 3, row: 'choir' },
  { id: '현악', label: '현악', tone: 'strings', icon: '🎻', multi: true, defaultCount: 3, row: 'strings' },
  { id: '밴드', label: '밴드', tone: 'band', icon: '🎸', multi: true, defaultCount: 3, row: 'band' },
];

/** 화면 행 순서 (해설 / 대복사·소복사 / 1·2독서 / 반주(2) / 성가대(3) / 현악(3) / 밴드(3)) */
export const DUTY_ROLE_ROWS = [
  { id: 'narrator', roleIds: ['해설'] },
  { id: 'servers', roleIds: ['대복사', '소복사'] },
  { id: 'reader', roleIds: ['1독서', '2독서'] },
  { id: 'accomp', roleIds: ['반주'] },
  { id: 'choir', roleIds: ['성가대'] },
  { id: 'strings', roleIds: ['현악'] },
  { id: 'band', roleIds: ['밴드'] },
];

export const DUTY_ROLE_IDS = DUTY_ROLE_DEFS.map(r => r.id);

export function getDutyRoleDef(id) {
  return DUTY_ROLE_DEFS.find(r => r.id === id) || null;
}

export function emptyDutyAssignments() {
  return Object.fromEntries(
    DUTY_ROLE_DEFS.map(r => [r.id, r.multi ? [] : ''])
  );
}

/** 역할별 값을 정규화 (단일=string, 다중=string[]) */
export function normalizeAssignmentValue(roleId, raw) {
  const def = getDutyRoleDef(roleId);
  const multi = Boolean(def?.multi);
  if (multi) {
    if (Array.isArray(raw)) {
      return raw.map(v => String(v || '').trim()).filter(Boolean);
    }
    const one = String(raw || '').trim();
    return one ? [one] : [];
  }
  if (Array.isArray(raw)) {
    return String(raw.find(v => v) || '').trim();
  }
  return String(raw || '').trim();
}

export function dutyDocIdForDate(dateStr) {
  return `duty_${String(dateStr || '').replace(/-/g, '')}`;
}

function normalizeDuty(raw, fallbackId) {
  const date = raw.date || '';
  const base = emptyDutyAssignments();
  const incoming = raw.assignments && typeof raw.assignments === 'object'
    ? raw.assignments
    : {};
  DUTY_ROLE_IDS.forEach(id => {
    base[id] = normalizeAssignmentValue(id, incoming[id]);
  });
  return {
    id: raw.id || fallbackId || dutyDocIdForDate(date),
    date,
    seasonId: raw.seasonId || getSeasonFromDate(date) || '',
    scheduleId: raw.scheduleId || null,
    assignments: base,
    updatedAt: raw.updatedAt || null,
    updatedBy: raw.updatedBy || '',
  };
}

export async function loadDutiesFromFirestore() {
  if (!isFirebaseMode || !db) {
    return dataProvider.getDutyAssignments();
  }
  try {
    const snap = await getDocs(collection(db, DUTY_COLLECTION));
    const remote = snap.docs.map(d => normalizeDuty({ id: d.id, ...d.data() }, d.id));
    dataProvider._setItem('catechesis_duty_assignments', remote);
    return remote.slice().sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.error('[dutyStore] Firestore 로드 실패:', e);
    return dataProvider.getDutyAssignments();
  }
}

async function writeDutyDoc(duty) {
  if (!isFirebaseMode || !db) return;
  const { id, ...rest } = duty;
  await setDoc(doc(db, DUTY_COLLECTION, id), {
    ...rest,
    id,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * 수업일 봉사 배정 저장 (관리자)
 * @param {{ date: string, assignments: Record<string, string|string[]>, updatedBy?: string }} payload
 */
export async function saveDutyAssignment(payload) {
  const date = payload.date;
  if (!date) throw new Error('날짜가 필요합니다.');
  const schedule = dataProvider.getScheduleByDate(date);
  const id = dutyDocIdForDate(date);
  const next = normalizeDuty({
    id,
    date,
    seasonId: getSeasonFromDate(date),
    scheduleId: schedule?.id || null,
    assignments: payload.assignments || {},
    updatedBy: payload.updatedBy || '',
  }, id);

  dataProvider.upsertDutyAssignment(next);
  try {
    await writeDutyDoc(next);
  } catch (e) {
    console.error('[dutyStore] 저장 실패:', e);
    throw e;
  }
  return next;
}
