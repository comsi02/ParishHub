// firebase-init.js
// Firebase 앱 초기화 + 로컬 Emulator 자동 연결

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);

// 로컬 개발 환경에서는 Firebase Emulator에 자동 연결
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  // 이미 연결된 경우 중복 연결 방지
  if (!db._settingsFrozen) {
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  console.info('[Firebase] Emulator 모드로 실행 중 (Firestore: 8080, Auth: 9099)');
}
