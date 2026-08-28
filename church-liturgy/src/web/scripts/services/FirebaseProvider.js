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

        sourceSlides.forEach((slide) => {
          const newSlideRef = doc(collection(db, 'masses', newMassId, 'slides'));
          const { id, ...slideData } = slide;
          batch.set(newSlideRef, {
            ...slideData,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }

    return {
      id:       newMassId,
      date:     newMassData.date,
      title:    newMassData.title,
      language: newMassData.language || 'ko',
      status:   'Active',
    };
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
    slides.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    // ---PAGE--- 분할 처리 (기존 로직 유지)
    return this._paginateSlides(slides);
  }

  _paginateSlides(slides) {
    const result = [];
    slides.forEach((slide) => {
      const content = String(slide.content || '');
      if (content.indexOf('---PAGE---') !== -1) {
        const parts = content.split('---PAGE---');
        parts.forEach((part, index) => {
          result.push({
            ...slide,
            id:      `${slide.id}_p${index + 1}`,
            title:   `${slide.title} ${index + 1}/${parts.length}`,
            content: part.trim(),
          });
        });
      } else {
        result.push(slide);
      }
    });
    return result;
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
    // 페이지네이션된 ID 처리 (예: "abc123_p1" → "abc123")
    const baseSlideId = String(slideId).split('_p')[0];
    const ref = doc(db, 'masses', massId, 'slides', baseSlideId);
    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
    return true;
  }

  async deleteSlide(massId, slideId) {
    const baseSlideId = String(slideId).split('_p')[0];
    const ref = doc(db, 'masses', massId, 'slides', baseSlideId);
    await updateDoc(ref, { enabled: false, updatedAt: serverTimestamp() });
    return true;
  }

  async reorderSlides(massId, orderedSlideIds) {
    const batch = writeBatch(db);
    orderedSlideIds.forEach((slideId, index) => {
      const baseSlideId = String(slideId).split('_p')[0];
      const ref = doc(db, 'masses', massId, 'slides', baseSlideId);
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
        callback(this._paginateSlides(slides));
      },
      (error) => {
        console.error('[FirebaseProvider] slides 구독 오류:', error);
      }
    );
  }
}
