// auth.js
// church-catechesis Google 인증, 관리자 승인(Approval Workflow) 및 사용자 권한 관리

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from './firebase-init.js';

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Local mode simulated user state & pending users store
const LOCAL_STORAGE_KEY_USER = 'catechesis_local_user';
const LOCAL_STORAGE_KEY_USERS_LIST = 'catechesis_local_users_list';

let localUser = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_USER) || 'null');
const localAuthListeners = [];

function getLocalUsersList() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY_USERS_LIST);
  if (data) return JSON.parse(data);
  const initial = [
    {
      uid: 'demo-admin-01',
      email: 'admin@standrewkimlondon.ca',
      displayName: '관리자 신부님/교감',
      status: 'approved',
      role: 'admin',
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    },
    {
      uid: 'demo-teacher-01',
      email: 'teacher@catechesis.local',
      displayName: '체칠리아 선생님',
      status: 'approved',
      role: 'teacher',
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    },
    {
      uid: 'demo-pending-01',
      email: 'newbie@gmail.com',
      displayName: '신규 교사 지원자',
      status: 'pending',
      role: 'teacher',
      requestedAt: new Date().toISOString(),
      approvedAt: null
    }
  ];
  localStorage.setItem(LOCAL_STORAGE_KEY_USERS_LIST, JSON.stringify(initial));
  return initial;
}

function saveLocalUsersList(list) {
  localStorage.setItem(LOCAL_STORAGE_KEY_USERS_LIST, JSON.stringify(list));
}

/**
 * Google 팝업으로 로그인하고 사용자 프로필을 동기화합니다.
 * @returns {Promise<{user: any, profile: any}>}
 */
export async function signInWithGoogle() {
  if (isFirebaseMode && auth) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const profile = await syncUserProfile(user);
      return { user, profile };
    } catch (error) {
      console.error('[Auth] Google 로그인 실패:', error);
      throw error;
    }
  } else {
    // Local demo mode simulation: toggle to teacher by default
    localUser = {
      uid: 'demo-teacher-01',
      displayName: '체칠리아 선생님',
      email: 'teacher@catechesis.local',
      photoURL: null,
      status: 'approved',
      role: 'teacher',
      isDemo: true
    };
    localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(localUser));
    const profile = { ...localUser, isApproved: true, isAdmin: false };
    localAuthListeners.forEach(cb => cb(localUser, profile));
    return { user: localUser, profile };
  }
}

/**
 * Firestore에 사용자 프로필 동기화 및 승인 상태 확인
 */
export async function syncUserProfile(user) {
  if (!user) return null;
  if (!isFirebaseMode || !db) {
    return {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      status: user.status || 'approved',
      role: user.role || 'teacher',
      isApproved: user.status === 'approved' || !user.status,
      isAdmin: user.role === 'admin'
    };
  }

  const userRef = doc(db, 'catechesis_users', user.uid);
  const snap = await getDoc(userRef);

  // Check if user is in admins collection
  const adminRef = doc(db, 'catechesis_admins', user.uid);
  const adminSnap = await getDoc(adminRef);
  const isAdmin = adminSnap.exists();

  if (!snap.exists()) {
    // New user registered -> default status: 'pending' (unless they are admin)
    const newProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || null,
      status: isAdmin ? 'approved' : 'pending',
      role: isAdmin ? 'admin' : 'teacher',
      requestedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    await setDoc(userRef, newProfile);
    return {
      ...newProfile,
      isApproved: newProfile.status === 'approved',
      isAdmin
    };
  } else {
    const data = snap.data();
    await updateDoc(userRef, {
      lastLoginAt: new Date().toISOString(),
      displayName: user.displayName || data.displayName,
      photoURL: user.photoURL || data.photoURL
    });
    return {
      ...data,
      isApproved: data.status === 'approved' || isAdmin,
      isAdmin: isAdmin || data.role === 'admin'
    };
  }
}

/**
 * 로그아웃합니다.
 */
export async function signOut() {
  if (isFirebaseMode && auth) {
    return firebaseSignOut(auth);
  } else {
    localUser = null;
    localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
    localAuthListeners.forEach(cb => cb(null, null));
  }
}

/**
 * 인증 상태 변경을 구독합니다.
 * @param {(user: any, profile: any) => void} callback
 * @returns {() => void} 구독 해제 함수
 */
export function onAuthStateChanged(callback) {
  if (isFirebaseMode && auth) {
    return firebaseOnAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await syncUserProfile(user);
          callback(user, profile);
        } catch (e) {
          console.error('[Auth] Profile sync error:', e);
          callback(user, { uid: user.uid, status: 'pending', isApproved: false });
        }
      } else {
        callback(null, null);
      }
    });
  } else {
    localAuthListeners.push(callback);
    const profile = localUser ? { ...localUser, isApproved: localUser.status === 'approved', isAdmin: localUser.role === 'admin' } : null;
    setTimeout(() => callback(localUser, profile), 0);
    return () => {
      const idx = localAuthListeners.indexOf(callback);
      if (idx !== -1) localAuthListeners.splice(idx, 1);
    };
  }
}

/**
 * 모든 사용자 목록을 가져옵니다 (관리자용).
 */
export async function getAllUsers() {
  if (isFirebaseMode && db) {
    try {
      const colRef = collection(db, 'catechesis_users');
      const snap = await getDocs(colRef);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('[Auth] 사용자 목록 불러오기 실패:', e);
      return [];
    }
  } else {
    return getLocalUsersList();
  }
}

/**
 * 사용자를 승인합니다 (관리자용).
 * @param {string} uid
 * @param {string} role 'teacher' | 'admin' | 'parent'
 */
export async function approveUser(uid, role = 'teacher') {
  if (isFirebaseMode && db) {
    const userRef = doc(db, 'catechesis_users', uid);
    await updateDoc(userRef, {
      status: 'approved',
      role: role,
      approvedAt: new Date().toISOString()
    });
    if (role === 'admin') {
      const adminRef = doc(db, 'catechesis_admins', uid);
      await setDoc(adminRef, { adminSince: new Date().toISOString() }, { merge: true });
    }
  } else {
    const list = getLocalUsersList();
    const target = list.find(u => u.uid === uid);
    if (target) {
      target.status = 'approved';
      target.role = role;
      target.approvedAt = new Date().toISOString();
      saveLocalUsersList(list);
    }
  }
}

/**
 * 사용자를 거절/보류 처리합니다 (관리자용).
 * @param {string} uid
 */
export async function rejectUser(uid) {
  if (isFirebaseMode && db) {
    const userRef = doc(db, 'catechesis_users', uid);
    await updateDoc(userRef, {
      status: 'rejected',
      rejectedAt: new Date().toISOString()
    });
  } else {
    const list = getLocalUsersList();
    const target = list.find(u => u.uid === uid);
    if (target) {
      target.status = 'rejected';
      saveLocalUsersList(list);
    }
  }
}

/**
 * 데모 모드에서 사용자 역할을 직접 전환 (테스트용)
 */
export function setLocalDemoUserRole(type) {
  if (type === 'none') {
    localUser = null;
  } else if (type === 'pending') {
    localUser = {
      uid: 'demo-pending-01',
      displayName: '신규 교사 지원자',
      email: 'newbie@gmail.com',
      photoURL: null,
      status: 'pending',
      role: 'teacher',
      isDemo: true
    };
  } else if (type === 'teacher') {
    localUser = {
      uid: 'demo-teacher-01',
      displayName: '체칠리아 선생님',
      email: 'teacher@catechesis.local',
      photoURL: null,
      status: 'approved',
      role: 'teacher',
      isDemo: true
    };
  } else if (type === 'admin') {
    localUser = {
      uid: 'demo-admin-01',
      displayName: '김대건 주임신부님 (관리자)',
      email: 'pastor@standrewkimlondon.ca',
      photoURL: null,
      status: 'approved',
      role: 'admin',
      isDemo: true
    };
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(localUser));
  const profile = localUser ? { ...localUser, isApproved: localUser.status === 'approved', isAdmin: localUser.role === 'admin' } : null;
  localAuthListeners.forEach(cb => cb(localUser, profile));
}

/**
 * 개인정보 익명화/마스킹 헬퍼
 * 비로그인 및 미승인 상태에서 실명/세례명을 전혀 유추할 수 없도록 완전 마스킹 처리
 */
export function maskKoreanName(name) {
  if (!name) return '-';
  return '***';
}

export function maskBaptismalName(bName) {
  if (!bName) return '';
  return '(***)';
}

export function maskTeacherName(name) {
  return '*** (비공개)';
}

export function maskPhoneNumber(phone) {
  if (!phone) return '-';
  return '🔒 로그인 후 확인';
}

export function getCurrentUser() {
  if (isFirebaseMode) {
    return auth.currentUser;
  }
  return localUser;
}
