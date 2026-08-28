# Catholic Church Liturgy Presentation System (Firebase Edition)

성당 전례(미사) 진행을 위해 기존의 파워포인트(PowerPoint) 방식을 대체하는 웹 기반 실시간 프레젠테이션 시스템입니다.  
**Firebase Hosting + Cloud Firestore + Firebase Authentication + Firebase Local Emulator** 기반으로 구축되어 있습니다.

---

## 1. 주요 특징

- **실시간 즉시 반영 (Real-time Sync)**: Cloud Firestore `onSnapshot` 리스너를 통해 진행자(Controller)의 조작이 프로젝터 화면(Display)에 지연 없이 즉시 반영됩니다.
- **역할 및 권한 분리**:
  - **Display (프로젝터용)**: 인증 없이 누구나 접근 가능하며, 프로젝터 표시 전용으로 인라인 편집 기능이 비활성화되어 있습니다.
  - **Control (진행자용)**: Google 계정 로그인 및 Firestore 관리자 허용 목록(`admins` 컬렉션)에 등록된 사용자만 접근할 수 있습니다.
- **로컬 에뮬레이터 개발 환경 지원**: 실제 Firebase 클라우드 연결 없이도 Local Emulator를 통해 오프라인/로컬에서 완전한 개발 및 테스트가 가능합니다.

---

## 2. 로컬 개발 환경 (Firebase Local Emulator)

### 사전 준비
- Node.js (v18 이상 권장)
- Java JRE (Firebase Emulator 실행용)
- Firebase CLI 설치:
  ```bash
  npm install -g firebase-tools
  ```

### 실행 방법

#### 터미널 1: Firebase 에뮬레이터 실행 (Auth, Firestore, Hosting)
```bash
npm run emulator
```
- 에뮬레이터 UI: `http://localhost:4000` (Firestore/Auth 데이터 실시간 조회 및 수정 가능)
- Firestore 포트: `8080` / Auth 포트: `9099`

#### 터미널 2: 초기 데이터 시딩 및 관리자 등록
```bash
# 1. 초기 미사 및 슬라이드 Mock 데이터 Firestore에 주입
npm run seed

# 2. 로컬 테스트용 관리자 계정 등록 (원하는 Auth UID 지정)
npm run add-admin <USER_UID> <USER_EMAIL> <USER_NAME>
# 예시:
node scripts/add-admin.mjs "demo-admin-uid" "admin@parish.org" "전례봉사자"
```

#### 터미널 3: Vite 개발 서버 실행
```bash
npm run dev
```
- **Display 화면 (프로젝터)**: `http://localhost:5173/display.html`
- **Control 화면 (진행자)**: `http://localhost:5173/control.html`

---

## 3. Firebase 클라우드 프로젝트 생성 및 배포 안내

### 1단계: Firebase 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com)에 접속하여 **프로젝트 추가**를 클릭합니다.
2. 프로젝트 이름을 입력하고 생성합니다 (예: `parish-hub-liturgy`).

### 2단계: Firestore Database 활성화
1. 좌측 메뉴에서 **Firestore Database** 선택 → **데이터베이스 만들기**
2. 리전: `asia-northeast3` (서울) 선택
3. 시작 모드: **테스트 모드**로 시작 (보안 규칙은 `firestore.rules` 배포 시 자동 적용됨)

### 3단계: Authentication 활성화
1. 좌측 메뉴에서 **Authentication** 선택 → **시작하기**
2. **로그인 방법** 탭에서 **Google** 활성화 후 지원 이메일 지정하고 저장합니다.

### 4단계: 웹 앱 등록 및 환경변수 설정
1. **프로젝트 설정(⚙)** → **내 앱** → 웹(`</>`) 추가
2. 앱 닉네임 입력 및 **Firebase Hosting도 설정** 체크
3. 표시되는 `firebaseConfig` 값을 `.env.production` 파일에 작성:
   ```env
   VITE_USE_EMULATOR=false
   VITE_PROVIDER=firebase
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=parish-hub-liturgy.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=parish-hub-liturgy
   VITE_FIREBASE_STORAGE_BUCKET=parish-hub-liturgy.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=1:...
   ```
4. `.firebaserc` 파일의 `default` 프로젝트 ID를 본인의 Firebase 프로젝트 ID로 변경합니다.

### 5단계: 관리자(Allowlist) 등록
Firebase 콘솔 → Firestore Database에서 `admins` 컬렉션을 생성하고 문서를 추가합니다:
- **컬렉션 ID**: `admins`
- **문서 ID**: 관리자 사용자의 Firebase Auth `UID` (사용자가 최초 로그인 후 Auth 탭에서 확인 가능)
- **필드**: `email` (string), `name` (string), `addedAt` (timestamp)

### 6단계: 빌드 및 배포
```bash
# Firebase CLI 로그인
firebase login

# 빌드 및 전체 배포 (Hosting + Firestore Rules + Indexes)
npm run deploy
```

배포가 완료되면 안내되는 Hosting URL로 접속하여 사용할 수 있습니다.
- Display: `https://<PROJECT_ID>.web.app/display`
- Control: `https://<PROJECT_ID>.web.app/control`

---

## 4. 디렉터리 구조

```
church-liturgy/
├── firebase.json              # Firebase Hosting, Firestore, Emulator 설정
├── .firebaserc                # Firebase 프로젝트 Alias
├── firestore.rules            # Firestore 보안 및 권한 규칙 (admins allowlist)
├── firestore.indexes.json     # Firestore 쿼리 인덱스
├── .env.development           # 로컬 에뮬레이터용 환경 변수
├── .env.production.example    # 운영 환경 변수 템플릿
├── scripts/
│   ├── seed-firestore.mjs     # Firestore 데이터 시드 스크립트
│   └── add-admin.mjs          # 관리자 UID 등록 스크립트
├── src/
│   ├── firebase-init.js       # Firebase 앱 및 에뮬레이터 초기화
│   ├── auth.js                # Google 인증 및 관리자 권한 확인
│   └── web/
│       ├── scripts/
│       │   ├── display.js     # 프로젝터 화면 로직 (onSnapshot 실시간 수신)
│       │   ├── control.js     # 진행자 컨트롤러 로직 (Auth 게이트 + 상태 제어)
│       │   └── services/
│       │       ├── DataProvider.js     # 데이터 제공자 추상 인터페이스
│       │       ├── FirebaseProvider.js # Firestore 구현체
│       │       └── LocalProvider.js    # 오프라인 Mock 구현체
│       └── styles/            # 테마 및 UI 스타일시트
├── display.html               # 프로젝터 화면 진입점
├── control.html               # 진행자 화면 진입점
└── package.json
```
