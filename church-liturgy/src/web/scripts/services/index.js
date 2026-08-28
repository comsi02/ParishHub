import { LocalProvider } from './LocalProvider.js';
import { FirebaseProvider } from './FirebaseProvider.js';

export function getProvider() {
  // 로컬 Mock 모드 강제 지정 시
  if (import.meta.env.VITE_PROVIDER === 'local') {
    return new LocalProvider();
  }
  // 기본: Firebase 사용
  return new FirebaseProvider();
}
