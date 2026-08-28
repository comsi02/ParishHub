# Catholic Church Liturgy Presentation System (Firebase Edition)

성당 전례(미사) 진행을 위해 기존의 파워포인트(PowerPoint) 방식을 대체하는 웹 기반 실시간 프레젠테이션 시스템입니다.  
**Firebase Hosting + Cloud Firestore + Firebase Authentication + Firebase Local Emulator** 기반으로 구축되어 있습니다.

---

## 1. 주요 특징

- **실시간 즉시 동기화 (Real-time Sync)**: Cloud Firestore `onSnapshot` 리스너를 통해 진행자(Control)의 조작이 프로젝터 화면(Display)에 지연 없이 즉시 반영됩니다.
- **역할 및 권한 분리**:
  - **Display (프로젝터용)**: 인증 없이 누구나 접속 가능하며, 프로젝터 화면 표시 전용(Read-only)으로 안전하게 작동합니다.
  - **Control (진행자용)**: Google 계정 로그인 및 Firestore 관리자 허용 목록(`admins` 컬렉션)에 등록된 승인된 사용자만 접근하여 전례를 제어할 수 있습니다.
- **안전한 화면 제어**:
  - **Display 끄기 (Blackout)**: 미사 중 제대 화면을 검게 암전 처리합니다.
  - **Display 멈추기 (Freeze)**: 현재 화면을 고정시켜 진행자가 슬라이드를 미리 편집하거나 이동해도 프로젝터 화면은 바뀌지 않습니다.
- **다크 / 라이트 테마 전환**: 성당 환경 및 프로젝터 밝기에 맞춰 테마를 즉시 전환할 수 있습니다.
- **미사 및 슬라이드 자유 편집**: 미사 제목/날짜 수정, 슬라이드 추가/삭제/순서 변경(드래그 앤 드롭), 텍스트 역할(사제 ➕, 해설/신자 ◎, 독서 ○, 신자 ●) 및 정렬/굵기 조절이 가능합니다.
- **로컬 에뮬레이터 개발 지원**: Firebase 클라우드 연결 없이도 오프라인/로컬 에뮬레이터 환경에서 개발 및 테스트가 가능합니다.

---

## 2. 화면별 사용 방법

### 2.1 Display 화면 (프로젝터용)
- **접속 주소**: `https://<PROJECT_ID>.web.app/display.html` (로컬: `http://localhost:5173/display.html`)
- **특징**:
  - 16:9 비율 최적화 및 원거리 가독성을 위한 자동 폰트 크기 조절.
  - 별도 로그인 불필요 (전례 중 실수로 인한 오작동 방지).
  - 우측 상단 아이콘: 테마 전환 (☀️/🌙) 및 화면 끄기 (🖥️).

---

### 2.2 Control 화면 (진행자용)
- **접속 주소**: `https://<PROJECT_ID>.web.app/control.html` (로컬: `http://localhost:5173/control.html`)
- **로그인**: 승인된 Google 계정으로 로그인해야 제어 화면에 진입합니다.

#### 주요 제어 기능 및 단축키
| 기능 | 단축키 / 방법 | 설명 |
| :--- | :--- | :--- |
| **다음 슬라이드** | `Space` / `→` (오른쪽 화살표) / `PageDown` | 다음 슬라이드로 이동하고 프로젝터에 즉시 송출 |
| **이전 슬라이드** | `←` (왼쪽 화살표) / `PageUp` | 이전 슬라이드로 이동 |
| **미사 선택** | 상단 드롭다운 | 진행할 미사(전례) 선택 |
| **미사 수정** | 상단 `미사 수정` 버튼 | 현재 미사의 날짜와 제목 변경 |
| **새 미사 생성** | 상단 `+ 새 미사` 버튼 | 기존 미사 양식을 복사하거나 빈 전례 생성 |
| **미사 삭제** | 상단 `미사 삭제` 버튼 | 선택한 미사 및 포함된 슬라이드 일괄 삭제 |
| **슬라이드 순서 변경** | 슬라이드 목록 드래그 앤 드롭 | 좌측 목록에서 항목을 끌어 원하는 순서로 재배치 |
| **슬라이드 추가/삭제** | 좌측 상단 `+` / `-` 버튼 | 새 슬라이드 생성 또는 현재 슬라이드 삭제 |
| **실시간 인라인 편집** | 미리보기 화면에서 텍스트 클릭 | 제목 및 본문 내용을 클릭하여 바로 수정 (자동 저장) |
| **본문 역할 변경** | 역할 태그 클릭 (`전체`, `사제`, `해설`, `신자` 등) | 각 줄 앞에 `➕`, `◎`, `○`, `●` 기호 자동 적용 |
| **Display 끄기** | `Display 끄기` 버튼 | 프로젝터 화면을 즉시 검은 화면으로 전환 |
| **Display 멈추기** | `Display 멈추기` 버튼 | 프로젝터 화면을 현재 상태로 고정(Freeze)하여 화면 변경 차단 |
| **테마 전환** | 우측 상단 ☀️/🌙 아이콘 | 다크/라이트 테마 즉시 동기화 |
| **로그아웃** | 우측 상단 `로그아웃` 버튼 | 구글 계정 세션 종료 |

---

## 3. 로컬 개발 환경 (Local Emulator)

### 사전 준비
- **Node.js**: v18 이상 권장
- **Java JRE**: Firebase Local Emulator 실행에 필요
- **Firebase CLI 설치**:
  ```bash
  npm install -g firebase-tools
  ```

### 실행 단계

#### 1) 종속성 설치
```bash
npm install
```

#### 2) 터미널 1: Firebase 에뮬레이터 실행 (Auth, Firestore, Hosting)
```bash
npm run emulator
```
- Emulator UI: `http://localhost:4000` (Auth 및 Firestore 데이터베이스 실시간 확인)
- Firestore 포트: `8080`, Auth 포트: `9099`, Hosting 포트: `5005`

#### 3) 터미널 2: 초기 데이터 시딩 및 관리자 등록
```bash
# 1. 초기 미사 및 슬라이드 예제 데이터 주입
npm run seed

# 2. 로컬 테스트용 관리자 계정 등록 (사용자 UID 지정)
node scripts/add-admin.mjs "<YOUR_UID>" "<EMAIL>" "<NAME>"
# 예시:
node scripts/add-admin.mjs "demo-admin-uid" "admin@parish.org" "전례봉사자"
```

#### 4) 터미널 3: 프론트엔드 개발 서버 구동
```bash
npm run dev
```
- Display: `http://localhost:5173/display.html`
- Control: `http://localhost:5173/control.html`

---

## 4. Firebase 클라우드 배포 가이드

### 1단계: Firebase 프로젝트 생성 및 설정
1. [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트를 생성합니다 (예: `parish-hub-liturgy`).
2. **Firestore Database 활성화**:
   - 위치: `asia-northeast3` (Seoul) 권장.
   - 모드: 프로덕션 모드 또는 테스트 모드 (배포 시 `firestore.rules`가 자동 적용됨).
3. **Authentication 활성화**:
   - `로그인 방법` 탭에서 **Google** 공급업체 활성화.
4. **웹 앱 등록**:
   - 프로젝트 설정(⚙) → 내 앱 → 웹 앱 추가(`</>`).
   - 발급된 설정값을 `.env.production` 파일에 작성합니다.

### 2단계: 환경 변수 설정 (`.env.production`)
프로젝트 루트 디렉터리에 `.env.production` 파일을 생성합니다:
```env
VITE_USE_EMULATOR=false
VITE_PROVIDER=firebase
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=parish-hub-liturgy.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=parish-hub-liturgy
VITE_FIREBASE_STORAGE_BUCKET=parish-hub-liturgy.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789...
VITE_FIREBASE_APP_ID=1:123456789:web:...
```

`.firebaserc` 파일의 프로젝트 ID를 본인 프로젝트로 일치시킵니다:
```json
{
  "projects": {
    "default": "parish-hub-liturgy"
  }
}
```

### 3단계: 관리자(Allowlist) 등록
Firebase 콘솔 → Firestore Database에서 `admins` 컬렉션에 승인할 관리자 문서를 생성합니다:
- **컬렉션 ID**: `admins`
- **문서 ID**: 관리자 사용자의 Google Auth `UID` (사용자가 Control 화면에 최초 로그인 시 화면에 표시되는 명령어를 복사하여 실행하거나 직접 추가)
- **필드**:
  - `email` (string): `admin@example.com`
  - `name` (string): `홍길동`
  - `addedAt` (timestamp): 현재 시간

### 4단계: 빌드 및 배포
```bash
# Firebase 로그인
firebase login

# 빌드 및 전체 배포 (Hosting + Firestore Rules + Indexes)
npm run deploy
```

배포 완료 후 제공되는 Firebase Hosting URL로 접속하여 운영할 수 있습니다:
- **Display (프로젝터)**: `https://<PROJECT_ID>.web.app/display.html`
- **Control (진행자)**: `https://<PROJECT_ID>.web.app/control.html`

---

## 5. Firestore 데이터 모델 구조

```
/masses/{massId}
  ├── title: string          # 예: "연중 제23주일"
  ├── date: string           # 예: "2026-09-06"
  ├── language: string       # "ko"
  ├── status: string         # "Active"
  └── slides/{slideId}
        ├── sequence: number # 슬라이드 순서 (1, 2, 3...)
        ├── type: string     # "ordinary", "reading", "gospel", "hymn" 등
        ├── title: string    # 화면/목록 제목
        ├── listTitle: string # 목록 전용 제목
        ├── hideTitle: boolean # Display 화면에서 제목 숨김 여부
        └── contents: Array<{
              text: string,
              align: "left" | "center" | "right",
              role: "none" | "priest" | "leader" | "cong" | "leader_cong",
              bold: boolean
            }>

/presentation_state/current
  ├── massId: string         # 현재 진행 중인 미사 ID
  ├── slideId: string        # 현재 송출 중인 슬라이드 ID
  ├── displayMode: string    # "normal" | "blackout" | "freeze"
  ├── theme: string          # "light" | "dark"
  └── lastUpdated: timestamp # 상태 갱신 일시

/admins/{uid}
  ├── email: string          # 관리자 이메일
  ├── name: string           # 관리자 이름
  └── addedAt: timestamp     # 등록 일시
```

---

## 6. 디렉터리 구조

```
church-liturgy/
├── firebase.json              # Hosting, Firestore, Emulator 설정
├── .firebaserc                # Firebase 프로젝트 Alias
├── firestore.rules            # Firestore 보안 및 권한 규칙 (admins allowlist)
├── firestore.indexes.json     # Firestore 쿼리 인덱스
├── .env.development           # 로컬 에뮬레이터용 환경 변수
├── .env.production.example    # 운영 환경 변수 예제
├── scripts/
│   ├── seed-firestore.mjs     # Firestore 초기 데이터 시딩 스크립트
│   └── add-admin.mjs          # 관리자 등록 스크립트
├── src/
│   ├── firebase-init.js       # Firebase 초기화 및 에뮬레이터 바인딩
│   ├── auth.js                # Google Auth 및 관리자 권한 검증
│   └── web/
│       ├── scripts/
│       │   ├── display.js     # 프로젝터 화면 로직 (실시간 onSnapshot 수신)
│       │   ├── control.js     # 진행자 컨트롤러 로직 (Auth 게이트 + 프레젠테이션 제어)
│       │   └── services/
│       │       ├── DataProvider.js     # 데이터 제공자 인터페이스
│       │       ├── FirebaseProvider.js # Firestore 구현체
│       │       └── LocalProvider.js    # 오프라인 Mock 구현체
│       └── styles/            # 테마 및 UI 스타일시트
├── display.html               # 프로젝터 화면 진입점
├── control.html               # 진행자 화면 진입점
├── vite.config.js             # Vite 빌드 설정
└── package.json
```

---

## 7. 시스템 아키텍처 및 확장성 (Architecture & Extensibility)

본 시스템은 향후 백엔드(데이터베이스 및 API 서버)가 변경되거나 확장되더라도 유연하게 대응할 수 있도록 관심사(Separation of Concerns)를 분리하여 설계되었습니다.

- **데이터 계층 추상화 (`DataProvider`)**:
  - 프론트엔드 UI 컴포넌트(`display.js`, `control.js`)는 구체적인 백엔드 통신 방식을 직접 참조하지 않고 `DataProvider` 인터페이스를 통해 통신합니다.
  - 현재 로컬 개발용 `LocalProvider`와 운영용 `FirebaseProvider`가 구현되어 있으며, 향후 별도의 독자 백엔드(REST API, GraphQL, PostgreSQL, .NET Core 등)가 도입되더라도 새 Provider 클래스만 구현하면 프론트엔드 수정 없이 전환할 수 있습니다.
- **프론트엔드 경량화**:
  - 프레임워크 오버헤드 없이 순수 HTML5, CSS3, Vanilla JavaScript(ES Modules)로 구현되어 빠른 로딩 속도와 안정적인 렌더링 성능을 보장합니다.
- **오프라인 및 복원력**:
  - 로컬 브라우저 세션 및 Firestore 오프라인 캐시를 통해 네트워크 불안정 상황에서도 프레젠테이션 진행이 중단되지 않도록 지원합니다.


