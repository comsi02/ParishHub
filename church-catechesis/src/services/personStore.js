// personStore.js
// Person 목록 Firestore / localStorage 동기화

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

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';
const PERSONS_COLLECTION = 'catechesis_persons';

/** Firestore 기본 자동 ID (또는 로컬 대체) */
export function allocatePersonId() {
  if (isFirebaseMode && db) {
    return doc(collection(db, PERSONS_COLLECTION)).id;
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  }
  return `person_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * importKey 기준으로 기존 id 재사용, 없으면 자동 id 발급.
 * 가족 관계 필드(parent/child/spouse)도 실제 id 로 재매핑.
 * @param {object[]} persons
 */
export function resolvePersonIdsForUpsert(persons) {
  if (!persons?.length) return [];

  const existing = dataProvider.getPersons();
  const idByImportKey = new Map();

  existing.forEach(p => {
    if (p.importKey) idByImportKey.set(p.importKey, p.id);
  });

  persons.forEach(p => {
    const key = p.importKey || p.id;
    let id = null;
    if (p.importKey) {
      id = idByImportKey.get(p.importKey) || null;
    } else if (p.id) {
      id = p.id;
    }
    if (!id) id = allocatePersonId();
    if (key) idByImportKey.set(key, id);
    if (p.importKey) idByImportKey.set(p.importKey, id);
    if (p.id) idByImportKey.set(p.id, id);
  });

  const remap = (ref) => {
    if (!ref) return ref;
    return idByImportKey.get(ref) || ref;
  };

  return persons.map(p => {
    const key = p.importKey || p.id;
    const id = idByImportKey.get(key) || allocatePersonId();
    const next = { ...p, id, importKey: p.importKey || key };

    if (next.parentInfo) {
      next.parentInfo = {
        ...next.parentInfo,
        spousePersonId: remap(next.parentInfo.spousePersonId),
        childPersonIds: (next.parentInfo.childPersonIds || []).map(remap),
      };
    }
    if (next.studentInfo) {
      next.studentInfo = {
        ...next.studentInfo,
        parentPersonIds: (next.studentInfo.parentPersonIds || []).map(remap),
      };
    }
    return next;
  });
}

/**
 * 로컬 DataProvider persons 에 upsert (id + importKey)
 * @param {object[]} persons
 */
export function upsertPersonsLocal(persons) {
  const existing = dataProvider.getPersons();
  const byId = new Map(existing.map(p => [p.id, { ...p }]));
  const byImportKey = new Map(
    existing.filter(p => p.importKey).map(p => [p.importKey, p.id])
  );

  persons.forEach(p => {
    let targetId = p.id;
    if (p.importKey && byImportKey.has(p.importKey)) {
      targetId = byImportKey.get(p.importKey);
    }
    const prev = byId.get(targetId);
    const merged = prev ? { ...prev, ...p, id: targetId } : { ...p, id: targetId };
    byId.set(targetId, merged);
    if (merged.importKey) byImportKey.set(merged.importKey, targetId);
  });

  const merged = Array.from(byId.values());
  dataProvider._setItem('catechesis_persons', merged);
  return merged;
}

/**
 * Firestore 에서 전체 persons 로드 후 로컬 캐시에 반영
 */
export async function loadPersonsFromFirestore() {
  if (!isFirebaseMode || !db) return dataProvider.getPersons();
  try {
    const snap = await getDocs(collection(db, PERSONS_COLLECTION));
    const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (remote.length > 0) {
      dataProvider._setItem('catechesis_persons', remote);
    }
    return dataProvider.getPersons();
  } catch (e) {
    console.error('[personStore] Firestore 로드 실패:', e);
    return dataProvider.getPersons();
  }
}

/**
 * persons 를 Firestore + local 에 upsert
 * @param {object[]} persons
 */
export async function upsertPersons(persons) {
  if (!persons?.length) return { count: 0 };

  await loadPersonsFromFirestore();
  const resolved = resolvePersonIdsForUpsert(persons);
  upsertPersonsLocal(resolved);

  if (isFirebaseMode && db) {
    const chunkSize = 400;
    for (let i = 0; i < resolved.length; i += chunkSize) {
      const chunk = resolved.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(p => {
        const ref = doc(db, PERSONS_COLLECTION, p.id);
        const { id, ...rest } = p;
        batch.set(ref, { ...rest, id, updatedAt: new Date().toISOString() }, { merge: true });
      });
      await batch.commit();
    }
  }

  return { count: resolved.length, persons: resolved };
}

/**
 * 검색 (이름/세례명/이메일/전화)
 * @param {string} query
 * @param {{ role?: string, limit?: number|null }} [opts] limit null이면 전체
 */
export function searchPersons(query, { role, limit = 50 } = {}) {
  const q = (query || '').trim().toLowerCase();
  let list = dataProvider.getPersons();
  if (role) list = list.filter(p => p.roles?.includes(role));
  if (q) {
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.baptismalName || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      String(p.phone || '').toLowerCase().includes(q)
    );
  }
  list = list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  if (limit == null || limit < 0) return list;
  return list.slice(0, limit);
}

export async function getPersonByIdAsync(id) {
  const local = dataProvider.getPersonById(id);
  if (local) return local;
  if (isFirebaseMode && db) {
    await loadPersonsFromFirestore();
    return dataProvider.getPersonById(id);
  }
  return null;
}

/**
 * Person 일부 필드 패치 (로컬 + Firestore)
 * @param {string} id
 * @param {object} updates
 */
export async function patchPerson(id, updates) {
  if (!id || !updates) return null;
  const updated = dataProvider.updatePerson(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return null;
  if (isFirebaseMode && db) {
    const { id: _omit, ...rest } = updated;
    await setDoc(doc(db, PERSONS_COLLECTION, id), { ...rest, id }, { merge: true });
  }
  return updated;
}

/**
 * Person 삭제 (로컬 관계 정리 + Firestore 문서 삭제 + 연관 Person 저장)
 * upsertPersons 를 쓰지 않음 (로드 시 삭제 대상이 다시 살아날 수 있음)
 * @param {string} id
 */
export async function deletePersonRemote(id) {
  if (!id) return { ok: false };
  await loadPersonsFromFirestore();
  const { deleted, touched, touchedClasses } = dataProvider.deletePerson(id);
  if (!deleted) return { ok: false };

  if (isFirebaseMode && db) {
    await deleteDoc(doc(db, PERSONS_COLLECTION, id));
    const now = new Date().toISOString();
    for (const p of touched) {
      const { id: pid, ...rest } = p;
      await setDoc(
        doc(db, PERSONS_COLLECTION, pid),
        { ...rest, id: pid, updatedAt: now },
        { merge: true }
      );
    }
    for (const cls of touchedClasses || []) {
      const { id: cid, ...rest } = cls;
      await setDoc(
        doc(db, 'catechesis_classes', cid),
        { ...rest, id: cid, updatedAt: now },
        { merge: true }
      );
    }
  }

  return { ok: true, deleted, touched, touchedClasses };
}
