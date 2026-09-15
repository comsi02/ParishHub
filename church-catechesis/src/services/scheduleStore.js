// scheduleStore.js
// 주일학교 학사 일정 — Firestore / localStorage 동기화

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase-init.js';
import { dataProvider } from './DataProvider.js';
import { INITIAL_SCHEDULES, getSeasonFromDate } from '../mock/sampleData.js';

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';
const SCHEDULES_COLLECTION = 'catechesis_schedules';

export function allocateScheduleId() {
  if (isFirebaseMode && db) {
    return doc(collection(db, SCHEDULES_COLLECTION)).id;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `sch_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `sch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSchedule(raw, fallbackId) {
  const date = raw.date || '';
  return {
    id: raw.id || fallbackId,
    date,
    seasonId: raw.seasonId || getSeasonFromDate(date) || '',
    title: raw.title || '주일학교 모임',
    type: raw.type || 'regular',
    hasSchool: raw.hasSchool !== undefined ? Boolean(raw.hasSchool) : true,
    notes: raw.notes || '',
    updatedAt: raw.updatedAt || null,
  };
}

/** Firestore → 로컬 캐시 반영 (firebase 모드에서 원격이 비면 로컬도 비움) */
export async function loadSchedulesFromFirestore() {
  if (!isFirebaseMode || !db) {
    return dataProvider.getSchedules();
  }
  try {
    const snap = await getDocs(collection(db, SCHEDULES_COLLECTION));
    const remote = snap.docs.map(d => normalizeSchedule({ id: d.id, ...d.data() }, d.id));
    dataProvider._setItem('catechesis_schedules', remote);
    return remote.slice().sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.error('[scheduleStore] Firestore 로드 실패:', e);
    return dataProvider.getSchedules();
  }
}

async function writeScheduleDoc(schedule) {
  if (!isFirebaseMode || !db) return;
  const { id, ...rest } = schedule;
  await setDoc(doc(db, SCHEDULES_COLLECTION, id), {
    ...rest,
    id,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * 일정 추가/수정 (같은 날짜면 덮어씀)
 * @returns {Promise<object>}
 */
export async function saveSchedule(scheduleData) {
  const seasonId = scheduleData.seasonId || getSeasonFromDate(scheduleData.date);
  const existingByDate = dataProvider.getScheduleByDate(scheduleData.date);
  const id = scheduleData.id
    || existingByDate?.id
    || allocateScheduleId();

  const payload = normalizeSchedule({
    ...scheduleData,
    id,
    seasonId,
  }, id);

  // 로컬: 날짜 중복 시 기존 id 유지
  const saved = dataProvider.addSchedule({ ...payload, id });
  const final = normalizeSchedule(saved, id);

  try {
    await writeScheduleDoc(final);
  } catch (e) {
    console.error('[scheduleStore] 저장 실패:', e);
    throw e;
  }
  return final;
}

export async function updateSchedule(id, scheduleData) {
  const updated = dataProvider.updateSchedule(id, scheduleData);
  if (!updated) throw new Error('일정을 찾을 수 없습니다.');
  const final = normalizeSchedule(updated, id);
  try {
    await writeScheduleDoc(final);
  } catch (e) {
    console.error('[scheduleStore] 수정 실패:', e);
    throw e;
  }
  return final;
}

export async function removeSchedule(id) {
  dataProvider.deleteSchedule(id);
  if (!isFirebaseMode || !db) return;
  try {
    await deleteDoc(doc(db, SCHEDULES_COLLECTION, id));
  } catch (e) {
    console.error('[scheduleStore] 삭제 실패:', e);
    throw e;
  }
}

export async function toggleScheduleHasSchool(id) {
  const updated = dataProvider.toggleScheduleHasSchool(id);
  if (!updated) throw new Error('일정을 찾을 수 없습니다.');
  try {
    await writeScheduleDoc(normalizeSchedule(updated, id));
  } catch (e) {
    console.error('[scheduleStore] 수업일 토글 실패:', e);
    throw e;
  }
  return updated;
}

/**
 * 시즌 일정을 샘플로 복구 후 Firestore에 반영
 * @returns {Promise<number>} 시드 건수
 */
export async function resetSeasonSchedules(seasonId = '2026-2027') {
  const others = dataProvider.getSchedules('all')
    .filter(s => (s.seasonId || getSeasonFromDate(s.date)) !== seasonId);

  const seed = INITIAL_SCHEDULES
    .filter(s => s.seasonId === seasonId)
    .map(s => {
      const id = allocateScheduleId();
      return normalizeSchedule({ ...s, id }, id);
    });

  const next = [...others, ...seed];
  dataProvider._setItem('catechesis_schedules', next);

  if (isFirebaseMode && db) {
    // 해당 시즌 원격 문서 삭제 후 시드 기록
    const snap = await getDocs(collection(db, SCHEDULES_COLLECTION));
    const toDelete = snap.docs.filter(d => {
      const data = d.data() || {};
      const sid = data.seasonId || getSeasonFromDate(data.date || '');
      return sid === seasonId;
    });

    const chunkSize = 400;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + chunkSize).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    for (let i = 0; i < seed.length; i += chunkSize) {
      const batch = writeBatch(db);
      seed.slice(i, i + chunkSize).forEach(s => {
        const { id, ...rest } = s;
        batch.set(doc(db, SCHEDULES_COLLECTION, id), {
          ...rest,
          id,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
  }

  return seed.length;
}
