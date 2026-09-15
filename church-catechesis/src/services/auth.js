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
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from './firebase-init.js';

const isFirebaseMode = import.meta.env.VITE_PROVIDER === 'firebase';

/** 계정 권한
 * - 학생 / 신부님: 단독(+관리자만 추가 가능)
 * - 학부모 + 교직원: 서로 중복 가능 (학부모 없는 교사도 가능)
 * - 관리자: 가입된 누구에게나 추가 가능
 */
export const ACCOUNT_ROLES = {
  student: { id: 'student', label: '학생' },
  priest: { id: 'priest', label: '신부님' },
  parent: { id: 'parent', label: '학부모' },
  fathers_chair: { id: 'fathers_chair', label: '자부회장' },
  mothers_chair: { id: 'mothers_chair', label: '자모회장' },
  fathers_secretary: { id: 'fathers_secretary', label: '자부회총무' },
  mothers_secretary: { id: 'mothers_secretary', label: '자모회총무' },
  teacher: { id: 'teacher', label: '교리교사' },
  assistant_teacher: { id: 'assistant_teacher', label: '부교사' },
  principal: { id: 'principal', label: '교감' },
  vice_principal: { id: 'vice_principal', label: '부교감' },
  liturgy_teacher: { id: 'liturgy_teacher', label: '전례부교사' },
  acolyte_teacher: { id: 'acolyte_teacher', label: '복사교사' },
  secretary: { id: 'secretary', label: '총무' },
  youth_director: { id: 'youth_director', label: '청소년분과장' },
  admin: { id: 'admin', label: '관리자' },
};

const ACCOUNT_ROLE_IDS = Object.keys(ACCOUNT_ROLES);

/** 단독 전용 역할 */
export const EXCLUSIVE_ACCOUNT_ROLES = ['student', 'priest'];

/** 대표 role 우선순위 (표시·하위호환용) */
const PRIMARY_ROLE_PRIORITY = [
  'admin',
  'priest',
  'principal',
  'vice_principal',
  'youth_director',
  'secretary',
  'fathers_chair',
  'mothers_chair',
  'fathers_secretary',
  'mothers_secretary',
  'liturgy_teacher',
  'acolyte_teacher',
  'teacher',
  'assistant_teacher',
  'parent',
  'student',
];

/** 교직원(교사계열) 역할 — 학부모와 겸임 가능 */
export const STAFF_ACCOUNT_ROLES = [
  'teacher',
  'assistant_teacher',
  'principal',
  'vice_principal',
  'liturgy_teacher',
  'acolyte_teacher',
  'secretary',
  'youth_director',
];

/** 교사 선택 시 UI에 노출하는 직책 (저장되는 실제 role id) */
export const TEACHER_DUTY_ROLES = [
  { id: 'teacher', label: '교리교사' },
  { id: 'liturgy_teacher', label: '전례부교사' },
  { id: 'acolyte_teacher', label: '복사교사' },
  { id: 'principal', label: '교감' },
  { id: 'vice_principal', label: '부교감' },
  { id: 'secretary', label: '총무' },
  { id: 'youth_director', label: '청소년분과장' },
  { id: 'assistant_teacher', label: '부교사' },
];

/** UI 전용: 교사 카테고리 게이트 (DB에 저장하지 않음) */
export const STAFF_ROLE_GATE = '_staff';

/** 자부회·자모회 임원 (학부모와 겸임 가능) */
export const PARENT_LEADER_ROLES = [
  'fathers_chair',
  'mothers_chair',
  'fathers_secretary',
  'mothers_secretary',
];

/** 프로필 연결 없이 이용 가능한 역할 (관리자·신부님) */
const PERSON_OPTIONAL_ROLES = new Set(['admin', 'priest']);

/** 최초 관리자 이메일 — 로그인 시 admin + catechesis_admins 자동 부여 */
const BOOTSTRAP_ADMIN_EMAILS = [
  'stcomsi02@gmail.com',
];

function isBootstrapAdminEmail(email) {
  return BOOTSTRAP_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

/** Google 계정 이메일 (user.email 또는 providerData) */
function resolveUserEmail(user) {
  if (!user) return '';
  if (user.email) return String(user.email).trim();
  const fromProvider = (user.providerData || []).map(p => p?.email).find(Boolean);
  return fromProvider ? String(fromProvider).trim() : '';
}

/** 오프라인 캐시 대신 서버 우선 조회 (관리자 권한 오판 방지) */
async function getDocPreferServer(ref) {
  try {
    return await getDocFromServer(ref);
  } catch (e) {
    console.warn('[Auth] 서버 조회 실패, 캐시 fallback:', e?.code || e?.message || e);
    return getDoc(ref);
  }
}

/**
 * 단일 role / roles[] / 혼합 문서를 정규화된 roles 배열로 변환
 * @param {object|string|string[]|null|undefined} data
 * @returns {string[]}
 */
export function normalizeAccountRoles(data) {
  if (!data) return [];
  if (typeof data === 'string') {
    return ACCOUNT_ROLE_IDS.includes(data) ? [data] : [];
  }
  if (Array.isArray(data)) {
    return [...new Set(data.filter(r => ACCOUNT_ROLE_IDS.includes(r)))];
  }
  const fromArray = Array.isArray(data.roles)
    ? data.roles.filter(r => ACCOUNT_ROLE_IDS.includes(r))
    : [];
  if (fromArray.length) return [...new Set(fromArray)];
  if (typeof data.role === 'string' && ACCOUNT_ROLE_IDS.includes(data.role)) {
    return [data.role];
  }
  return [];
}

/** 표시·하위호환용 대표 role */
export function primaryAccountRole(roles) {
  const list = normalizeAccountRoles(roles);
  for (const id of PRIMARY_ROLE_PRIORITY) {
    if (list.includes(id)) return id;
  }
  return list[0] || 'none';
}

/**
 * 역할 조합 규칙 적용
 * - 학생 / 신부님: 단독만 (관리자 포함 겸임 불가)
 * - 학부모 + 교직원 + 관리자: 자유 겸임
 * @param {object|string|string[]} rolesInput
 * @param {{ preferred?: string }} [opts] 방금 선택한 역할
 * @returns {string[]}
 */
export function reconcileAccountRoles(rolesInput, opts = {}) {
  let list = normalizeAccountRoles(rolesInput).filter(r => r !== STAFF_ROLE_GATE);
  const preferred = opts.preferred;

  if (preferred === 'student' || (list.includes('student') && preferred !== 'priest')) {
    if (list.includes('student')) return ['student'];
  }
  if (preferred === 'priest' || list.includes('priest')) {
    if (list.includes('priest')) return ['priest'];
  }

  // 학생·신부님은 학부모/교직원/관리자와 겸임 불가
  list = list.filter(r => r !== 'student' && r !== 'priest');
  // 자부·자모 임원이면 학부모도 함께 유지
  if (list.some(r => PARENT_LEADER_ROLES.includes(r)) && !list.includes('parent')) {
    list.push('parent');
  }
  // 교사 게이트만 있고 직책이 없으면 교리교사로 보정
  if (opts.ensureStaffDefault && list.some(r => STAFF_ACCOUNT_ROLES.includes(r)) === false && opts.staffGateOn) {
    list.push('teacher');
  }
  return list;
}

export function hasAccountRole(data, role) {
  return normalizeAccountRoles(data).includes(role);
}

export function isAccountAdmin(data) {
  return hasAccountRole(data, 'admin');
}

export function isAccountStaff(data) {
  const list = normalizeAccountRoles(data);
  return list.some(r => STAFF_ACCOUNT_ROLES.includes(r));
}

/** 프로필 연결이 필요한지 — 관리자·신부님만이면 선택, 그 외(역할 비어 있음 포함)는 Person 필수 */
export function rolesNeedPersonLink(roles) {
  const list = reconcileAccountRoles(roles);
  if (!list.length) return true;
  return list.some(r => !PERSON_OPTIONAL_ROLES.has(r));
}

export function formatAccountRolesLabel(roles) {
  const list = reconcileAccountRoles(roles);
  if (!list.length) return '미지정';
  return ACCOUNT_ROLE_IDS
    .filter(id => list.includes(id))
    .map(r => ACCOUNT_ROLES[r]?.label || r)
    .join(' · ');
}

/** users 컬렉션에 저장할 역할 — 관리자만 */
export function userDocRolesFromAdminFlag(wantAdmin) {
  return wantAdmin ? ['admin'] : [];
}

function withRoleFields(rolesInput) {
  const roles = reconcileAccountRoles(rolesInput);
  return {
    roles,
    role: primaryAccountRole(roles),
  };
}

function enrichProfile(base) {
  const roles = reconcileAccountRoles(base);
  const isAdmin = roles.includes('admin') || Boolean(base?.isAdmin);
  const isStaff = roles.some(r => STAFF_ACCOUNT_ROLES.includes(r));
  const status = typeof base?.status === 'string' ? base.status : '';
  return {
    ...base,
    roles,
    role: primaryAccountRole(roles),
    status: status || base?.status || 'pending',
    isAdmin,
    isApproved: Boolean(base?.isApproved || status === 'approved' || isAdmin),
    isStudent: roles.includes('student'),
    isPriest: roles.includes('priest'),
    isParent: roles.includes('parent')
      || roles.some(r => PARENT_LEADER_ROLES.includes(r)),
    isTeacher: isStaff || roles.includes('teacher'),
    isStaff,
  };
}

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
  if (data) {
    return JSON.parse(data).map(u => ({ ...u, ...withRoleFields(u) }));
  }
  const initial = [
    {
      uid: 'demo-admin-01',
      email: 'admin@standrewkimlondon.ca',
      displayName: '관리자 신부님/교감',
      status: 'approved',
      ...withRoleFields(['admin']),
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    },
    {
      uid: 'demo-teacher-01',
      email: 'teacher@catechesis.local',
      displayName: '체칠리아 선생님',
      status: 'approved',
      ...withRoleFields(['teacher', 'parent']),
      personId: 'demo-person-teacher',
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString()
    },
    {
      uid: 'demo-pending-01',
      email: 'newbie@gmail.com',
      displayName: '신규 교사 지원자',
      status: 'pending',
      ...withRoleFields([]),
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
    localUser = {
      uid: 'demo-teacher-01',
      displayName: '체칠리아 선생님',
      email: 'teacher@catechesis.local',
      photoURL: null,
      status: 'approved',
      ...withRoleFields(['teacher', 'parent']),
      personId: 'demo-person-teacher',
      isDemo: true
    };
    localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(localUser));
    const profile = enrichProfile({ ...localUser, isApproved: true });
    localAuthListeners.forEach(cb => cb(localUser, profile));
    return { user: localUser, profile };
  }
}

/**
 * Firestore에 사용자 프로필 동기화 및 승인 상태 확인
 */
export async function syncUserProfile(user) {
  if (!user) return null;

  const userEmail = resolveUserEmail(user);
  const bootstrapAdmin = isBootstrapAdminEmail(userEmail);

  if (!isFirebaseMode || !db) {
    return enrichProfile({
      uid: user.uid,
      displayName: user.displayName,
      email: userEmail || user.email,
      status: user.status || 'approved',
      ...withRoleFields(bootstrapAdmin ? ['admin'] : (user.roles || user.role || ['teacher'])),
      personId: user.personId || null,
      isApproved: true,
      isAdmin: bootstrapAdmin || isAccountAdmin(user),
    });
  }

  const buildFallbackProfile = (extra = {}) => {
    const roleInput = Array.isArray(extra.roles)
      ? extra.roles
      : (extra.role && extra.role !== 'none' ? extra.role : []);
    const status = bootstrapAdmin
      ? 'approved'
      : (typeof extra.status === 'string' && extra.status ? extra.status : 'pending');
    return enrichProfile({
      uid: user.uid,
      email: userEmail || user.email || null,
      displayName: user.displayName || (userEmail ? userEmail.split('@')[0] : '사용자'),
      photoURL: user.photoURL || null,
      status,
      ...withRoleFields(bootstrapAdmin ? ['admin'] : roleInput),
      personId: extra.personId || null,
      isApproved: bootstrapAdmin || status === 'approved',
      isAdmin: bootstrapAdmin || isAccountAdmin(extra),
      ...extra,
      status,
      isApproved: bootstrapAdmin || status === 'approved' || Boolean(extra.isApproved),
      ...(bootstrapAdmin
        ? { status: 'approved', ...withRoleFields(['admin']), isApproved: true, isAdmin: true }
        : {}),
    });
  };

  try {
    const userRef = doc(db, 'catechesis_users', user.uid);
    const adminRef = doc(db, 'catechesis_admins', user.uid);
    const liturgyAdminRef = doc(db, 'admins', user.uid);

    let snap = null;
    let isAdminDoc = false;

    try {
      snap = await getDocPreferServer(userRef);
    } catch (e) {
      console.error('[Auth] catechesis_users 읽기 실패:', e);
    }

    try {
      const adminSnap = await getDocPreferServer(adminRef);
      isAdminDoc = adminSnap.exists();
    } catch (e) {
      console.error('[Auth] catechesis_admins 읽기 실패 (규칙 미배포 가능):', e);
    }

    if (!isAdminDoc) {
      try {
        const liturgySnap = await getDocPreferServer(liturgyAdminRef);
        if (liturgySnap.exists()) isAdminDoc = true;
      } catch (_) { /* ignore */ }
    }

    if (bootstrapAdmin) isAdminDoc = true;

    const now = new Date().toISOString();

    if (!snap) {
      // 읽기 실패 시 기존 문서를 pending/personId:null 로 덮어쓰지 않음
      console.error('[Auth] catechesis_users 읽기 실패 — 기존 승인·연동 정보를 유지합니다.');
      return buildFallbackProfile({
        email: userEmail || user.email || null,
        status: 'pending',
        personId: null,
      });
    }

    if (!snap.exists()) {
      const roleFields = withRoleFields(isAdminDoc ? ['admin'] : []);
      const newProfile = {
        uid: user.uid,
        email: userEmail || user.email || null,
        displayName: user.displayName || (userEmail ? userEmail.split('@')[0] : '사용자'),
        photoURL: user.photoURL || null,
        status: isAdminDoc ? 'approved' : 'pending',
        ...roleFields,
        personId: null,
        requestedAt: now,
        lastLoginAt: now,
        ...(isAdminDoc ? { approvedAt: now } : {}),
      };
      try {
        await setDoc(userRef, newProfile, { merge: true });
      } catch (e) {
        console.error('[Auth] catechesis_users 생성 실패:', e);
      }
      if (isAdminDoc) {
        try {
          await setDoc(adminRef, {
            email: userEmail || user.email || null,
            adminSince: now,
            source: bootstrapAdmin ? 'bootstrap' : 'sync',
          }, { merge: true });
        } catch (e) {
          console.error('[Auth] catechesis_admins 생성 실패:', e);
        }
      }
      return buildFallbackProfile({
        ...newProfile,
        isApproved: newProfile.status === 'approved' || isAdminDoc,
        isAdmin: isAdminDoc || roleFields.roles.includes('admin'),
      });
    }

    const data = snap.data() || {};
    let isAdmin = isAdminDoc || hasAccountRole(data, 'admin') || bootstrapAdmin;

    // users 문서에는 관리자만 유지 (일반 역할은 Person)
    const userRolesOnly = userDocRolesFromAdminFlag(isAdmin);

    // Person.roles → 세션 권한 병합
    let effectiveRoles = [...userRolesOnly];
    const personId = (typeof data.personId === 'string' && data.personId.trim())
      ? data.personId.trim()
      : null;
    if (personId) {
      try {
        const personSnap = await getDocPreferServer(doc(db, 'catechesis_persons', personId));
        if (personSnap.exists()) {
          const personRoles = normalizeAccountRoles(personSnap.data()?.roles || [])
            .filter(r => r !== 'admin');
          effectiveRoles = reconcileAccountRoles([...personRoles, ...userRolesOnly]);
        }
      } catch (e) {
        console.warn('[Auth] Person 역할 로드 실패:', e?.code || e?.message || e);
        // fallback: 구버전 users.roles
        const legacy = normalizeAccountRoles(data).filter(r => r !== 'admin');
        effectiveRoles = reconcileAccountRoles([...legacy, ...userRolesOnly]);
      }
    } else {
      // 미연결: 구버전 users.roles 를 세션에만 반영 (문서는 admin만 기록)
      const legacy = normalizeAccountRoles(data).filter(r => r !== 'admin');
      if (legacy.length) {
        effectiveRoles = reconcileAccountRoles([...legacy, ...userRolesOnly]);
      }
    }

    // 로그인 시 lastLogin 등만 갱신 — role/roles/status/personId 는 본인 쓰면 규칙에 막혀 전체 패치 실패함
    const profilePatch = {
      lastLoginAt: now,
      displayName: user.displayName || data.displayName || null,
      photoURL: user.photoURL || data.photoURL || null,
    };
    if (userEmail && userEmail !== data.email) {
      profilePatch.email = userEmail;
    }

    try {
      // 관리자 계정만 status/roles 동시 패치
      if (isAdmin && data.status !== 'approved') {
        await setDoc(userRef, {
          ...profilePatch,
          status: 'approved',
          approvedAt: data.approvedAt || now,
          ...withRoleFields(userRolesOnly),
        }, { merge: true });
      } else {
        await setDoc(userRef, profilePatch, { merge: true });
      }
    } catch (e) {
      console.error('[Auth] catechesis_users 업데이트 실패:', e);
    }

    if (isAdmin) {
      try {
        await setDoc(adminRef, {
          email: userEmail || data.email || user.email || null,
          adminSince: data.approvedAt || now,
          source: bootstrapAdmin ? 'bootstrap' : 'sync',
        }, { merge: true });
      } catch (e) {
        console.error('[Auth] catechesis_admins 동기화 실패:', e);
      }
    }

    const rawStatus = typeof data.status === 'string' ? data.status : '';
    const statusAfter = (isAdmin && data.status !== 'approved')
      ? 'approved'
      : (rawStatus || 'pending');
    const merged = { ...data, ...profilePatch, personId, status: statusAfter };
    return buildFallbackProfile({
      ...merged,
      ...withRoleFields(effectiveRoles),
      personId,
      status: statusAfter,
      isApproved: statusAfter === 'approved' || isAdmin,
      isAdmin,
    });
  } catch (e) {
    console.error('[Auth] syncUserProfile 예외:', e);
    return buildFallbackProfile();
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
        let profile = null;
        try {
          profile = await syncUserProfile(user);
        } catch (e) {
          console.error('[Auth] Profile sync error:', e);
          const email = resolveUserEmail(user);
          const bootstrapAdmin = isBootstrapAdminEmail(email);
          profile = enrichProfile({
            uid: user.uid,
            email: email || user.email,
            displayName: user.displayName,
            status: bootstrapAdmin ? 'approved' : 'pending',
            ...withRoleFields(bootstrapAdmin ? ['admin'] : []),
            isApproved: bootstrapAdmin,
            isAdmin: bootstrapAdmin,
          });
        }
        try {
          callback(user, profile);
        } catch (e) {
          // UI 렌더 오류가 승인 프로필을 pending 으로 덮어쓰지 않도록 분리
          console.error('[Auth] Auth UI callback error:', e);
        }
      } else {
        callback(null, null);
      }
    });
  } else {
    localAuthListeners.push(callback);
    const profile = localUser
      ? enrichProfile({ ...localUser, isApproved: localUser.status === 'approved' })
      : null;
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
      return snap.docs.map(d => {
        const raw = d.data() || {};
        // 문서 ID = Auth uid. raw.uid 가 어긋난 경우가 있어 항상 d.id 사용
        const data = {
          ...raw,
          id: d.id,
          uid: d.id,
          status: raw.status || 'pending',
          personId: typeof raw.personId === 'string' && raw.personId.trim()
            ? raw.personId.trim()
            : null,
        };
        return { ...data, ...withRoleFields(data) };
      });
    } catch (e) {
      console.error('[Auth] 사용자 목록 불러오기 실패:', e);
      return [];
    }
  } else {
    return getLocalUsersList();
  }
}

async function syncAdminDoc(uid, roles, email = null) {
  if (!isFirebaseMode || !db) return;
  const adminRef = doc(db, 'catechesis_admins', uid);
  try {
    if (roles.includes('admin')) {
      await setDoc(adminRef, {
        ...(email ? { email } : {}),
        adminSince: new Date().toISOString(),
        source: 'approve',
      }, { merge: true });
    } else {
      await deleteDoc(adminRef);
    }
  } catch (e) {
    // 권한 저장 본흐름을 막지 않음 (없는 문서 삭제 등)
    if (e?.code !== 'not-found') {
      console.warn('[Auth] catechesis_admins 동기화 경고:', e?.code || e?.message || e);
    }
  }
}

/**
 * 사용자를 승인합니다. users 에는 관리자 여부만 저장합니다.
 * @param {string} uid
 * @param {string|string[]|{ admin?: boolean }} rolesInput 관리자 플래그 또는 ['admin']
 */
export async function approveUser(uid, rolesInput = []) {
  const wantAdmin = typeof rolesInput === 'object' && !Array.isArray(rolesInput)
    ? Boolean(rolesInput.admin)
    : reconcileAccountRoles(rolesInput).includes('admin');
  const roleFields = withRoleFields(userDocRolesFromAdminFlag(wantAdmin));
  const approvedAt = new Date().toISOString();

  if (isFirebaseMode && db) {
    const userRef = doc(db, 'catechesis_users', uid);
    const snap = await getDocPreferServer(userRef).catch(() => getDoc(userRef));
    const email = snap.exists() ? snap.data()?.email : null;
    await setDoc(userRef, {
      status: 'approved',
      ...roleFields,
      approvedAt,
      ...(email ? { email } : {}),
    }, { merge: true });
    await syncAdminDoc(uid, roleFields.roles, email);
  } else {
    const list = getLocalUsersList();
    const target = list.find(u => u.uid === uid);
    if (target) {
      target.status = 'approved';
      Object.assign(target, roleFields);
      target.approvedAt = approvedAt;
      saveLocalUsersList(list);
    }
  }
}

/**
 * users 문서의 관리자 여부만 변경합니다.
 * @param {string} uid
 * @param {boolean} wantAdmin
 */
export async function updateUserAdminFlag(uid, wantAdmin) {
  const roleFields = withRoleFields(userDocRolesFromAdminFlag(wantAdmin));

  if (isFirebaseMode && db) {
    const userRef = doc(db, 'catechesis_users', uid);
    const snap = await getDoc(userRef);
    const email = snap.exists() ? snap.data()?.email : null;
    await updateDoc(userRef, roleFields);
    await syncAdminDoc(uid, roleFields.roles, email);
  } else {
    const list = getLocalUsersList();
    const target = list.find(u => u.uid === uid);
    if (target) {
      Object.assign(target, roleFields);
      saveLocalUsersList(list);
    }
    if (localUser && localUser.uid === uid) {
      localUser = { ...localUser, ...roleFields };
      localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(localUser));
      localAuthListeners.forEach(cb => cb(localUser, enrichProfile({
        ...localUser,
        isApproved: localUser.status === 'approved',
      })));
    }
  }
}

/**
 * @deprecated 일반 역할은 Person에 저장하세요. 호환용으로 관리자만 users에 반영합니다.
 */
export async function updateUserRoles(uid, rolesInput) {
  const wantAdmin = reconcileAccountRoles(rolesInput).includes('admin');
  return updateUserAdminFlag(uid, wantAdmin);
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
 * Google 계정 ↔ Person 연결 (관리자 전용)
 * Person 연결과 승인은 별개입니다. 연결만 변경하고 status는 건드리지 않습니다.
 * @param {string} uid
 * @param {string|null} personId
 */
export async function linkUserToPerson(uid, personId) {
  const value = personId || null;
  const now = new Date().toISOString();
  if (isFirebaseMode && db) {
    const userRef = doc(db, 'catechesis_users', uid);
    await updateDoc(userRef, {
      personId: value,
      personLinkedAt: value ? now : null,
    });
  } else {
    const list = getLocalUsersList();
    const target = list.find(u => u.uid === uid);
    if (target) {
      target.personId = value;
      target.personLinkedAt = value ? now : null;
      saveLocalUsersList(list);
    }
    if (localUser && localUser.uid === uid) {
      localUser = { ...localUser, personId: value };
      localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(localUser));
      const profile = enrichProfile({
        ...localUser,
        isApproved: localUser.status === 'approved',
      });
      localAuthListeners.forEach(cb => cb(localUser, profile));
    }
  }
}

/**
 * 가입 승인 / 미승인 전환 (관리자 전용). Person 연동은 유지합니다.
 * @param {string} uid
 * @param {boolean} approved
 */
export async function setUserApprovalStatus(uid, approved) {
  if (!uid) throw new Error('사용자 ID가 없습니다.');

  if (isFirebaseMode && db) {
    const userRef = doc(db, 'catechesis_users', uid);
    const snap = await getDocPreferServer(userRef).catch(() => getDoc(userRef));
    if (!snap.exists()) {
      throw new Error('해당 Google 가입 문서를 찾을 수 없습니다. 상대방이 한 번 로그인한 뒤 다시 시도하세요.');
    }
    const data = snap.data() || {};
    const wantAdmin = hasAccountRole(data, 'admin');
    if (approved) {
      await approveUser(uid, { admin: wantAdmin });
    } else {
      await setDoc(userRef, {
        status: 'pending',
        approvedAt: null,
      }, { merge: true });
    }

    const verify = await getDocPreferServer(userRef).catch(() => getDoc(userRef));
    const got = verify.exists() ? verify.data()?.status : null;
    const expect = approved ? 'approved' : 'pending';
    if (got !== expect) {
      throw new Error(`승인 상태 저장에 실패했습니다 (현재: ${got || '없음'}). Firestore 규칙 배포·관리자 권한을 확인하세요.`);
    }
  } else {
    const list = getLocalUsersList();
    const target = list.find(u => u.uid === uid);
    if (target) {
      target.status = approved ? 'approved' : 'pending';
      target.approvedAt = approved ? new Date().toISOString() : null;
      saveLocalUsersList(list);
    }
    if (localUser && localUser.uid === uid) {
      localUser = {
        ...localUser,
        status: approved ? 'approved' : 'pending',
        approvedAt: approved ? new Date().toISOString() : null,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(localUser));
      localAuthListeners.forEach(cb => cb(localUser, enrichProfile({
        ...localUser,
        isApproved: approved,
      })));
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
      ...withRoleFields([]),
      isDemo: true
    };
  } else if (type === 'teacher') {
    localUser = {
      uid: 'demo-teacher-01',
      displayName: '체칠리아 선생님',
      email: 'teacher@catechesis.local',
      photoURL: null,
      status: 'approved',
      ...withRoleFields(['teacher', 'parent']),
      personId: 'demo-person-teacher',
      isDemo: true
    };
  } else if (type === 'admin') {
    localUser = {
      uid: 'demo-admin-01',
      displayName: '김대건 주임신부님 (관리자)',
      email: 'pastor@standrewkimlondon.ca',
      photoURL: null,
      status: 'approved',
      ...withRoleFields(['admin']),
      isDemo: true
    };
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(localUser));
  const profile = localUser
    ? enrichProfile({ ...localUser, isApproved: localUser.status === 'approved' })
    : null;
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
