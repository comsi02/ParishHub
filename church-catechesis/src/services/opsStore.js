// opsStore.js
// 출석 · 활동 · 은총표 · 설정 — Firestore / localStorage 동기화

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
import { DEFAULT_SETTINGS } from '../mock/sampleData.js';

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';

const ATT_COL = 'catechesis_attendance';
const ACT_COL = 'catechesis_activities';
const LEDGER_COL = 'catechesis_grace_ledger';
const SETTINGS_COL = 'catechesis_settings';
const SETTINGS_DOC = 'default';

async function writeDoc(col, id, data) {
  if (!isFirebaseMode || !db || !id) return;
  const { id: _omit, ...rest } = data;
  await setDoc(doc(db, col, id), { ...rest, id }, { merge: true });
}

async function removeDoc(col, id) {
  if (!isFirebaseMode || !db || !id) return;
  try {
    await deleteDoc(doc(db, col, id));
  } catch (e) {
    if (e?.code !== 'not-found') throw e;
  }
}

async function loadCollection(col) {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 출석·활동·은총·설정을 Firestore에서 로드해 로컬 캐시에 반영 */
export async function loadOpsFromFirestore() {
  if (!isFirebaseMode || !db) {
    return {
      attendance: dataProvider.getAttendance(),
      activities: dataProvider.getActivities(),
      ledger: dataProvider.getGraceLedger(),
      settings: dataProvider.getSettings(),
    };
  }

  try {
    const [attendance, activities, ledger, settingsSnap] = await Promise.all([
      loadCollection(ATT_COL),
      loadCollection(ACT_COL),
      loadCollection(LEDGER_COL),
      getDocs(collection(db, SETTINGS_COL)),
    ]);

    dataProvider._setItem('catechesis_attendance', attendance);
    dataProvider._setItem('catechesis_activities', activities);
    dataProvider._setItem('catechesis_grace_ledger', ledger);

    if (settingsSnap.docs.length) {
      const settingsDoc = settingsSnap.docs.find(d => d.id === SETTINGS_DOC) || settingsSnap.docs[0];
      const settings = { ...DEFAULT_SETTINGS, ...settingsDoc.data() };
      delete settings.id;
      localStorage.setItem('catechesis_settings', JSON.stringify(settings));
    }

    return {
      attendance,
      activities,
      ledger,
      settings: dataProvider.getSettings(),
    };
  } catch (e) {
    console.error('[opsStore] Firestore 로드 실패:', e);
    return {
      attendance: dataProvider.getAttendance(),
      activities: dataProvider.getActivities(),
      ledger: dataProvider.getGraceLedger(),
      settings: dataProvider.getSettings(),
    };
  }
}

export async function saveSettings(settings) {
  const next = { ...DEFAULT_SETTINGS, ...settings };
  localStorage.setItem('catechesis_settings', JSON.stringify(next));
  if (isFirebaseMode && db) {
    await setDoc(doc(db, SETTINGS_COL, SETTINGS_DOC), { ...next, id: SETTINGS_DOC }, { merge: true });
  }
  return next;
}

export async function ensureSettingsInFirestore() {
  if (!isFirebaseMode || !db) return dataProvider.getSettings();
  try {
    const snap = await getDocs(collection(db, SETTINGS_COL));
    if (snap.empty) {
      return saveSettings(dataProvider.getSettings() || DEFAULT_SETTINGS);
    }
  } catch (e) {
    console.warn('[opsStore] settings ensure:', e);
  }
  return dataProvider.getSettings();
}

/**
 * 출석 기록 + Firestore 동기화
 */
export async function recordAttendanceRemote(payload) {
  const result = dataProvider.recordAttendance(payload);
  const record = result?.record || result;
  const ledgerId = result?.ledgerId || `gl_att_${payload.date}_${payload.studentId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    await writeDoc(ATT_COL, record.id, record);
    if (result?.ledgerRemoved || record.pointsEarned <= 0) {
      await removeDoc(LEDGER_COL, ledgerId);
    } else {
      const entry = dataProvider.getGraceLedger().find(l => l.id === ledgerId);
      if (entry) await writeDoc(LEDGER_COL, entry.id, entry);
    }
  } catch (e) {
    console.error('[opsStore] 출석 저장 실패:', e);
    throw e;
  }
  return record;
}

/**
 * 여러 학생 일괄 출석 (전원 출석)
 */
export async function recordAttendanceBatch(list) {
  const records = [];
  for (const item of list) {
    records.push(dataProvider.recordAttendance(item));
  }

  if (!isFirebaseMode || !db) return records;

  const chunkSize = 400;
  const ops = [];
  for (const result of records) {
    const record = result?.record || result;
    const ledgerId = result?.ledgerId;
    ops.push({ type: 'att', record });
    if (result?.ledgerRemoved) {
      ops.push({ type: 'delLedger', id: ledgerId });
    } else if (ledgerId) {
      const entry = dataProvider.getGraceLedger().find(l => l.id === ledgerId);
      if (entry) ops.push({ type: 'ledger', entry });
    }
  }

  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db);
    ops.slice(i, i + chunkSize).forEach(op => {
      if (op.type === 'att') {
        const { id, ...rest } = op.record;
        batch.set(doc(db, ATT_COL, id), { ...rest, id }, { merge: true });
      } else if (op.type === 'ledger') {
        const { id, ...rest } = op.entry;
        batch.set(doc(db, LEDGER_COL, id), { ...rest, id }, { merge: true });
      } else if (op.type === 'delLedger' && op.id) {
        batch.delete(doc(db, LEDGER_COL, op.id));
      }
    });
    await batch.commit();
  }
  return records;
}

export async function recordActivityRemote(payload) {
  let activityId = payload.id;
  if (!activityId && isFirebaseMode && db) {
    activityId = doc(collection(db, ACT_COL)).id;
  }
  const result = dataProvider.recordActivity({ ...payload, id: activityId });
  const record = result?.record || result;
  const entry = result?.ledgerEntry || null;

  try {
    await writeDoc(ACT_COL, record.id, record);
    if (entry) await writeDoc(LEDGER_COL, entry.id, entry);
  } catch (e) {
    console.error('[opsStore] 활동 저장 실패:', e);
    throw e;
  }
  return record;
}

export async function addBonusPointsRemote(payload) {
  let entryId = payload.id;
  if (!entryId && isFirebaseMode && db) {
    entryId = doc(collection(db, LEDGER_COL)).id;
  }
  const entry = dataProvider.addBonusPoints({ ...payload, id: entryId });
  try {
    await writeDoc(LEDGER_COL, entry.id, entry);
  } catch (e) {
    console.error('[opsStore] 은총표 저장 실패:', e);
    throw e;
  }
  return entry;
}
