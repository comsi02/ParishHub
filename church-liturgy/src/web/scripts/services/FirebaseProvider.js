// FirebaseProvider.js
// Firestore 기반 DataProvider 구현

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../../firebase-init.js';
import { DataProvider } from './DataProvider.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * 날짜 문자열(YYYY-MM-DD 등)을 한국어 날짜 형식('YYYY년 M월 D일 요일')으로 변환
 */
export function formatKoreanDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split(/[-./]/).map(Number);
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const [year, month, day] = parts;
    const d = new Date(year, month - 1, day);
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dayName = dayNames[d.getDay()] || '';
    return `${year}년 ${month}월 ${day}일 ${dayName}`.trim();
  }
  return String(dateStr);
}

/**
 * 부활대축일 날짜 계산 (Meeus/Jones/Butcher 알고리즘)
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * 대림 제1주일 날짜 계산 (12월 25일 기준 4주 전 일요일)
 */
function getAdvent1Sunday(year) {
  const dec25 = new Date(year, 11, 25);
  const dayOfWeek = dec25.getDay();
  const daysToPrevSunday = (dayOfWeek === 0) ? 7 : dayOfWeek;
  const advent4 = new Date(year, 11, 25 - daysToPrevSunday);
  return new Date(year, advent4.getMonth(), advent4.getDate() - 21);
}

/**
 * 가톨릭 전례력에 따른 미사 제목(예: '연중 제 22주일', '연중 제 21주간') 자동 계산
 * - 일요일: '연중 제 N주일'
 * - 토요일: 다음날 일요일 기준 '연중 제 N주일'
 * - 월~금: 해당 주간 기준 '연중 제 N주간'
 */
export function calculateLiturgicalTitle(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split(/[-./]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return '';
  const [year, month, day] = parts;
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeek = targetDate.getDay(); // 0: 일, 1: 월, ..., 6: 토

  // 기준 주일 계산
  // 토요일(6): 다음날 일요일 기준
  // 월~금(1~5): 해당 주일(이전 일요일) 기준
  // 일요일(0): 당일 기준
  let refSunday;
  if (dayOfWeek === 6) {
    refSunday = new Date(year, month - 1, day + 1);
  } else if (dayOfWeek === 0) {
    refSunday = new Date(year, month - 1, day);
  } else {
    refSunday = new Date(year, month - 1, day - dayOfWeek);
  }

  const refYear = refSunday.getFullYear();
  const easter = getEasterSunday(refYear);
  const advent1 = getAdvent1Sunday(refYear);
  const sunday34 = new Date(refYear, advent1.getMonth(), advent1.getDate() - 7);

  // 성령강림대축일 (부활 + 49일)
  const pentecost = new Date(refYear, easter.getMonth(), easter.getDate() + 49);

  // 사순 제1주일 (부활 - 42일)
  const lent1 = new Date(refYear, easter.getMonth(), easter.getDate() - 42);

  // 주님 세례 축일 (1월 6일 이후 첫 일요일)
  const jan6 = new Date(refYear, 0, 6);
  const daysToJanSun = (7 - jan6.getDay()) % 7 || 7;
  const baptism = new Date(refYear, 0, 6 + daysToJanSun);

  const isSundayOrSat = (dayOfWeek === 0 || dayOfWeek === 6);
  const suffix = isSundayOrSat ? '주일' : '주간';

  // 1. 대림 시기 (Advent 1 ~ Dec 24)
  if (refSunday >= advent1) {
    const diffWeeks = Math.round((refSunday - advent1) / (7 * 86400000)) + 1;
    return `대림 제 ${diffWeeks}${suffix}`;
  }

  // 2. 연중 시기 (후반기: 성령강림 후 ~ 대림 전)
  if (refSunday > pentecost && refSunday <= sunday34) {
    const weeksBefore34 = Math.round((sunday34 - refSunday) / (7 * 86400000));
    const weekNum = 34 - weeksBefore34;
    return `연중 제 ${weekNum}${suffix}`;
  }

  // 3. 부활 시기 (Easter ~ Pentecost)
  if (refSunday >= easter && refSunday <= pentecost) {
    const diffWeeks = Math.round((refSunday - easter) / (7 * 86400000)) + 1;
    return `부활 제 ${diffWeeks}${suffix}`;
  }

  // 4. 사순 시기 (Lent 1 ~ Palm Sunday)
  if (refSunday >= lent1 && refSunday < easter) {
    const diffWeeks = Math.round((refSunday - lent1) / (7 * 86400000)) + 1;
    return `사순 제 ${diffWeeks}${suffix}`;
  }

  // 5. 연중 시기 (전반기: 세례 축일 후 ~ 사순 전)
  if (refSunday > baptism && refSunday < lent1) {
    const diffWeeks = Math.round((refSunday - baptism) / (7 * 86400000)) + 1;
    return `연중 제 ${diffWeeks}${suffix}`;
  }

  // Fallback (연중 시기)
  const weeksBefore34 = Math.round((sunday34 - refSunday) / (7 * 86400000));
  const weekNum = Math.max(1, Math.min(34, 34 - weeksBefore34));
  return `연중 제 ${weekNum}${suffix}`;
}

/**
 * Firestore 문서를 앱 객체로 변환 (id 포함)
 */
function docToObj(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

export class FirebaseProvider extends DataProvider {
  // ──────────────────────────────────────────────
  // Masses
  // ──────────────────────────────────────────────

  async getMasses() {
    const q = query(
      collection(db, 'masses'),
      where('status', '==', 'Active')
    );
    const snap = await getDocs(q);
    const masses = snap.docs.map(docToObj);
    // 날짜 내림차순 정렬 (인덱스 생성 대기 없이 즉시 동작)
    return masses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  async createMass(newMassData, sourceMassId) {
    // 1. 새 미사 문서 생성
    const massRef = await addDoc(collection(db, 'masses'), {
      date:      newMassData.date || '',
      title:     newMassData.title || '',
      language:  newMassData.language || 'ko',
      status:    'Active',
      createdAt: serverTimestamp(),
    });

    const newMassId = massRef.id;
    const formattedDate = formatKoreanDate(newMassData.date);

    // 2. 소스 미사의 슬라이드 복사 (있는 경우)
    if (sourceMassId) {
      const slidesSnap = await getDocs(
        query(
          collection(db, 'masses', sourceMassId, 'slides'),
          where('enabled', '==', true)
        )
      );

      if (!slidesSnap.empty) {
        const batch = writeBatch(db);
        const sourceSlides = slidesSnap.docs.map(docToObj)
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

        sourceSlides.forEach((slide, index) => {
          const newSlideRef = doc(collection(db, 'masses', newMassId, 'slides'));
          const { id, ...slideData } = slide;

          // 첫 번째 슬라이드는 자동으로 시작 제목과 날짜로 구성
          if (index === 0) {
            slideData.listTitle = '시작';
            slideData.title = newMassData.title || slideData.title;
            slideData.contents = [{
              text: formattedDate,
              align: 'center',
              role: 'none',
              bold: true
            }];
            slideData.content = formattedDate;
          }

          batch.set(newSlideRef, {
            ...slideData,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } else {
      // 소스 미사가 없는 경우 첫 번째 시작 슬라이드 기본 생성
      await addDoc(collection(db, 'masses', newMassId, 'slides'), {
        sequence:  1,
        type:      'reading',
        listTitle: '시작',
        title:     newMassData.title || '',
        contents:  [{
          text: formattedDate,
          align: 'center',
          role: 'none',
          bold: true
        }],
        content:   formattedDate,
        subtitle:  '',
        notes:     '',
        enabled:   true,
        hideTitle: false,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      id:       newMassId,
      date:     newMassData.date,
      title:    newMassData.title,
      language: newMassData.language || 'ko',
      status:   'Active',
    };
  }

  async updateMass(massId, updates) {
    const massRef = doc(db, 'masses', massId);
    await updateDoc(massRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return true;
  }

  async deleteMass(massId) {
    await updateDoc(doc(db, 'masses', massId), { status: 'Archived' });
    return true;
  }

  // ──────────────────────────────────────────────
  // Slides
  // ──────────────────────────────────────────────

  async getSlides(massId) {
    const q = query(
      collection(db, 'masses', massId, 'slides'),
      where('enabled', '==', true)
    );
    const snap = await getDocs(q);
    const slides = snap.docs.map(docToObj);
    return slides.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }

  async addSlide(massId, slideData) {
    const ref = await addDoc(collection(db, 'masses', massId, 'slides'), {
      sequence:  slideData.sequence || 999,
      type:      slideData.type || 'reading',
      title:     slideData.title || '',
      listTitle: slideData.listTitle || slideData.title || '',
      content:   slideData.content || '',
      contents:  slideData.contents || [{ text: '', align: 'left', role: 'none' }],
      subtitle:  slideData.subtitle || '',
      notes:     slideData.notes || '',
      enabled:   true,
      hideTitle: false,
      updatedAt: serverTimestamp(),
    });
    return { ...slideData, id: ref.id, massId, enabled: true };
  }

  async updateSlide(massId, slideId, updates) {
    const ref = doc(db, 'masses', massId, 'slides', slideId);
    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
    return true;
  }

  async deleteSlide(massId, slideId) {
    const ref = doc(db, 'masses', massId, 'slides', slideId);
    await updateDoc(ref, { enabled: false, updatedAt: serverTimestamp() });
    return true;
  }

  async reorderSlides(massId, orderedSlideIds) {
    const batch = writeBatch(db);
    orderedSlideIds.forEach((slideId, index) => {
      const ref = doc(db, 'masses', massId, 'slides', slideId);
      batch.update(ref, { sequence: index + 1 });
    });
    await batch.commit();
    return true;
  }

  // ──────────────────────────────────────────────
  // Presentation State
  // ──────────────────────────────────────────────

  async getPresentationState() {
    const snap = await getDoc(doc(db, 'presentation_state', 'current'));
    return snap.exists() ? snap.data() : null;
  }

  async setPresentationState(state) {
    await setDoc(doc(db, 'presentation_state', 'current'), {
      ...state,
      lastUpdated: Date.now(),
    }, { merge: true });
    return true;
  }

  /**
   * presentation_state/current를 실시간으로 구독합니다.
   * display.js에서 polling 대신 사용합니다.
   * @param {(state: object|null) => void} callback
   * @returns {() => void} 구독 해제 함수 (unsubscribe)
   */
  onPresentationStateChange(callback) {
    return onSnapshot(
      doc(db, 'presentation_state', 'current'),
      (snap) => {
        callback(snap.exists() ? snap.data() : null);
      },
      (error) => {
        console.error('[FirebaseProvider] presentation_state 구독 오류:', error);
      }
    );
  }

  /**
   * 특정 미사의 슬라이드를 실시간으로 구독합니다.
   * @param {string} massId
   * @param {(slides: object[]) => void} callback
   * @returns {() => void} 구독 해제 함수
   */
  onSlidesChange(massId, callback) {
    const q = query(
      collection(db, 'masses', massId, 'slides'),
      where('enabled', '==', true)
    );
    return onSnapshot(
      q,
      (snap) => {
        const slides = snap.docs.map(docToObj)
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        callback(slides);
      },
      (error) => {
        console.error('[FirebaseProvider] slides 구독 오류:', error);
      }
    );
  }
}
