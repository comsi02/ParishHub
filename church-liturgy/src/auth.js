// auth.js
// Google 로그인, 권한(admins 컬렉션) 확인, 로그아웃

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase-init.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Google 팝업으로 로그인합니다.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

/**
 * 로그아웃합니다.
 */
export async function signOut() {
  return firebaseSignOut(auth);
}

/**
 * 현재 로그인한 사용자가 admins 컬렉션에 등록된 관리자인지 확인합니다.
 * @param {string} uid - Firebase Auth UID
 * @returns {Promise<boolean>}
 */
export async function checkIsAdmin(uid) {
  if (!uid) return false;
  try {
    const adminRef = doc(db, 'admins', uid);
    const snap = await getDoc(adminRef);
    return snap.exists();
  } catch (e) {
    console.error('[Auth] 관리자 권한 확인 실패:', e);
    return false;
  }
}

/**
 * 인증 상태 변경을 구독합니다.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns {() => void} 구독 해제 함수
 */
export function onAuthStateChanged(callback) {
  return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * 현재 로그인한 사용자를 반환합니다.
 * @returns {import('firebase/auth').User | null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}
