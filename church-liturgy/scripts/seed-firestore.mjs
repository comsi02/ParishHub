// scripts/seed-firestore.mjs
// mock/masses.json 및 mock/slides.json의 데이터를 Firestore (또는 Emulator)에 시딩합니다.
// firebase-admin을 사용하여 보안 규칙을 우회(Bypass Security Rules)하고 Admin 권한으로 쓰기 작업을 수행합니다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 에뮬레이터 환경변수 설정 (기본값: localhost:8080)
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-project';

// Firebase Admin 앱 초기화
admin.initializeApp({
  projectId: projectId
});

const db = admin.firestore();

console.log(`[Seed] Firestore 에뮬레이터(${process.env.FIRESTORE_EMULATOR_HOST})에 연결 중...`);

async function runSeed() {
  try {
    const massesRaw = fs.readFileSync(path.join(rootDir, 'mock', 'masses.json'), 'utf-8');
    const slidesRaw = fs.readFileSync(path.join(rootDir, 'mock', 'slides.json'), 'utf-8');

    const masses = JSON.parse(massesRaw);
    const slides = JSON.parse(slidesRaw);

    console.log(`[Seed] 미사 ${masses.length}개, 슬라이드 ${slides.length}개 로드됨.`);

    // 1. Masses & Slides 서브컬렉션 입력
    for (const mass of masses) {
      const massId = String(mass.id);
      const massRef = db.collection('masses').doc(massId);
      
      await massRef.set({
        date: mass.date || '',
        title: mass.title || '',
        language: mass.language || 'ko',
        status: mass.status || 'Active',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`[Seed] 미사 생성: [${massId}] ${mass.title}`);

      // 해당 미사에 속한 슬라이드들
      const massSlides = slides.filter(s => String(s.massId) === massId);
      const batch = db.batch();

      for (const slide of massSlides) {
        const slideId = String(slide.id);
        const slideRef = db.collection('masses').doc(massId).collection('slides').doc(slideId);

        // contents 배열 보정
        let contents = slide.contents;
        if (!contents) {
          contents = [{ text: slide.content || '', align: 'left', role: 'none', bold: false }];
        }

        batch.set(slideRef, {
          sequence: slide.sequence || 1,
          type: slide.type || 'reading',
          title: slide.title || '',
          listTitle: slide.listTitle || slide.title || '',
          content: slide.content || '',
          contents: contents,
          subtitle: slide.subtitle || '',
          notes: slide.notes || '',
          enabled: slide.enabled !== false,
          hideTitle: !!slide.hideTitle,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
      console.log(`[Seed]  └─ 슬라이드 ${massSlides.length}개 등록 완료`);
    }

    // 2. presentation_state 초기화
    const stateRef = db.collection('presentation_state').doc('current');
    await stateRef.set({
      massId: masses.length > 0 ? String(masses[0].id) : "1",
      slideId: slides.length > 0 ? String(slides[0].id) : "1",
      theme: "dark",
      displayMode: "normal",
      lastUpdated: Date.now()
    });
    console.log(`[Seed] presentation_state/current 초기화 완료.`);

    console.log(`\n🎉 Firestore 시드 완료!`);
    process.exit(0);
  } catch (err) {
    console.error(`[Seed] 오류 발생:`, err);
    process.exit(1);
  }
}

runSeed();
