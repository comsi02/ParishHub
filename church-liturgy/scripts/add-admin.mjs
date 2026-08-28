// scripts/add-admin.mjs
// 관리자 UID를 Firestore admins 컬렉션에 등록합니다.
// 사용법: node scripts/add-admin.mjs <UID> [EMAIL] [NAME]

import admin from 'firebase-admin';

const uid = process.argv[2];
const email = process.argv[3] || 'admin@liturgy.local';
const name = process.argv[4] || 'Admin';

if (!uid) {
  console.log(`
사용법:
  node scripts/add-admin.mjs <FIREBASE_AUTH_UID> [EMAIL] [NAME]

예시:
  node scripts/add-admin.mjs "demo-user-uid" "liturgy@parish.org" "전례봉사자"
`);
  process.exit(1);
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-project';

admin.initializeApp({
  projectId: projectId
});

const db = admin.firestore();

async function addAdmin() {
  try {
    const adminRef = db.collection('admins').doc(uid);
    await adminRef.set({
      email,
      name,
      addedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ 관리자 등록 완료:`);
    console.log(`   - UID:   ${uid}`);
    console.log(`   - Email: ${email}`);
    console.log(`   - Name:  ${name}`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ 관리자 등록 실패:`, err);
    process.exit(1);
  }
}

addAdmin();
