// firebase-init.js
// Firebase 앱 초기화 및 Firestore/Auth 인스턴스 (parish-hub-liturgy 프로젝트 공유)

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

let app = null;
let db = null;
let auth = null;

if (import.meta.env.VITE_PROVIDER === 'firebase') {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    if (!db._settingsFrozen) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.info('[Catechesis Firebase] Emulator 모드로 실행 중');
  }
}

export { app, db, auth };
