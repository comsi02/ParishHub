// classStore.js
// 주일학교 반 구성 — Firestore / localStorage 동기화

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase-init.js';
import { dataProvider } from './DataProvider.js';
import { INITIAL_CLASSES } from '../mock/sampleData.js';

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';
const CLASSES_COLLECTION = 'catechesis_classes';

export function allocateClassId() {
  if (isFirebaseMode && db) {
    return doc(collection(db, CLASSES_COLLECTION)).id;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `class_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `class_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeClass(raw, fallbackId) {
  return {
    id: raw.id || fallbackId,
    name: raw.name || '새 반',
    grades: Array.isArray(raw.grades) ? raw.grades : [],
    teacherPersonIds: Array.isArray(raw.teacherPersonIds) ? raw.teacherPersonIds : [],
    notes: raw.notes || '',
    updatedAt: raw.updatedAt || null,
  };
}

/** Firestore → 로컬 캐시 (firebase 모드에서 원격이 비면 로컬도 비움) */
export async function loadClassesFromFirestore() {
  if (!isFirebaseMode || !db) {
    return dataProvider.getClasses();
  }
  try {
    const snap = await getDocs(collection(db, CLASSES_COLLECTION));
    const remote = snap.docs.map(d => normalizeClass({ id: d.id, ...d.data() }, d.id));
    dataProvider._setItem('catechesis_classes', remote);
    return remote;
  } catch (e) {
    console.error('[classStore] Firestore 로드 실패:', e);
    return dataProvider.getClasses();
  }
}

async function writeClassDoc(cls) {
  if (!isFirebaseMode || !db) return;
  const { id, ...rest } = cls;
  await setDoc(doc(db, CLASSES_COLLECTION, id), {
    ...rest,
    id,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * 반 추가
 * @returns {Promise<object>}
 */
export async function saveClass(classData) {
  const id = classData.id || allocateClassId();
  const payload = normalizeClass({ ...classData, id }, id);

  const classes = dataProvider.getClasses();
  const idx = classes.findIndex(c => c.id === id);
  if (idx !== -1) {
    classes[idx] = { ...classes[idx], ...payload };
  } else {
    classes.push(payload);
  }
  dataProvider._setItem('catechesis_classes', classes);

  try {
    await writeClassDoc(payload);
  } catch (e) {
    console.error('[classStore] 저장 실패:', e);
    throw e;
  }
  return payload;
}

export async function updateClass(id, classData) {
  const updated = dataProvider.updateClass(id, classData);
  if (!updated) throw new Error('반을 찾을 수 없습니다.');
  const final = normalizeClass(updated, id);
  try {
    await writeClassDoc(final);
  } catch (e) {
    console.error('[classStore] 수정 실패:', e);
    throw e;
  }
  return final;
}

export async function removeClass(id) {
  dataProvider.deleteClass(id);
  if (!isFirebaseMode || !db) return;
  try {
    await deleteDoc(doc(db, CLASSES_COLLECTION, id));
  } catch (e) {
    console.error('[classStore] 삭제 실패:', e);
    throw e;
  }
}

/**
 * 샘플 반 구성으로 Firestore 시드 (빈 상태일 때 선택적 사용)
 * @returns {Promise<number>}
 */
export async function seedClassesFromSample() {
  const seed = INITIAL_CLASSES.map(c => {
    const id = allocateClassId();
    return normalizeClass({ ...c, id, teacherPersonIds: [] }, id);
  });
  dataProvider._setItem('catechesis_classes', seed);

  if (isFirebaseMode && db) {
    for (const cls of seed) {
      await writeClassDoc(cls);
    }
  }
  return seed.length;
}
