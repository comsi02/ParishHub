// personStore.js
// Person 목록 Firestore / localStorage 동기화

import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase-init.js';
import { dataProvider } from './DataProvider.js';

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';
const PERSONS_COLLECTION = 'catechesis_persons';

/**
 * 로컬 DataProvider persons 에 upsert (id 기준)
 * @param {object[]} persons
 */
export function upsertPersonsLocal(persons) {
  const existing = dataProvider.getPersons();
  const byId = new Map(existing.map(p => [p.id, p]));
  persons.forEach(p => {
    const prev = byId.get(p.id);
    byId.set(p.id, prev ? { ...prev, ...p } : { ...p });
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

  upsertPersonsLocal(persons);

  if (isFirebaseMode && db) {
    const chunkSize = 400;
    for (let i = 0; i < persons.length; i += chunkSize) {
      const chunk = persons.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(p => {
        const ref = doc(db, PERSONS_COLLECTION, p.id);
        const { id, ...rest } = p;
        batch.set(ref, { ...rest, id, updatedAt: new Date().toISOString() }, { merge: true });
      });
      await batch.commit();
    }
  }

  return { count: persons.length };
}

/**
 * 검색 (이름/세례명)
 */
export function searchPersons(query, { role } = {}) {
  const q = (query || '').trim().toLowerCase();
  let list = dataProvider.getPersons();
  if (role) list = list.filter(p => p.roles?.includes(role));
  if (!q) return list.slice(0, 50);
  return list.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.baptismalName || '').toLowerCase().includes(q)
  ).slice(0, 50);
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
