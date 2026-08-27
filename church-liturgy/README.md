# Catholic Church Liturgy Presentation System

성당 전례(미사) 진행을 위해 기존의 파워포인트(PowerPoint) 방식을 대체하는 웹 기반 프레젠테이션 시스템 MVP입니다.
Google Sheets를 데이터베이스 및 콘텐츠 관리 도구로 사용하며, Google Apps Script를 통해 구동됩니다.

## 1. 로컬 개발 환경

Google 계정이나 인터넷 연결 없이도 Mock 데이터를 사용하여 로컬에서 개발 및 테스트가 가능합니다.

### 실행 방법

```bash
npm install
npm run dev
```

- 디스플레이 (프로젝터용): `http://localhost:5173/display.html`
- 컨트롤러 (진행자용): `http://localhost:5173/control.html`

## 2. 테마 설정 (라이트 / 다크 모드)

- 디스플레이 화면은 프로젝터 가독성을 위해 기본 **다크 모드**
- 컨트롤러 화면은 기본 **라이트 모드** (우측 상단 버튼으로 전환 가능)
- `src/web/styles/base.css`의 CSS 변수(`--bg-color`, `--text-color` 등)로 테마 커스터마이즈 가능

## 3. Google Apps Script 배포

### 사전 준비

1. [Node.js](https://nodejs.org/) 설치
2. Google 계정 준비
3. [Google Apps Script API](https://script.google.com/home/usersettings) **켜기 (ON)**
4. 의존성 설치:

```bash
npm install
```

### 1단계: clasp 로그인

```bash
npm run clasp:login
```

브라우저가 열리면 Google 계정으로 로그인하고 모든 권한을 허용합니다.

> `Insufficient Permission` 오류가 나면:
> 1. [Apps Script API](https://script.google.com/home/usersettings)가 켜져 있는지 확인
> 2. 1~2분 대기
> 3. `npx clasp logout` → `npm run clasp:login` 재실행

로그인 확인:

```bash
npx clasp show-authorized-user
npx clasp list-scripts
```

프로젝트 목록이 출력되면 API 설정이 정상입니다.

### 2단계: Apps Script 프로젝트 생성

**방법 A — clasp로 새 프로젝트 생성 (권장)**

```bash
npm run build
npx clasp create --type standalone --title "Church Liturgy System" --rootDir dist/gas
```

`.clasp.json` 파일이 생성됩니다.

**방법 B — 브라우저에서 수동 생성**

1. https://script.google.com/create 에서 새 프로젝트 생성
2. 프로젝트 설정(⚙) → **스크립트 ID** 복사
3. `church-liturgy/.clasp.json` 파일 생성:

```json
{
  "scriptId": "여기에_스크립트_ID",
  "rootDir": "dist/gas"
}
```

> `--type webapp`은 clasp 3.x에서 지원되지 않습니다. `standalone`으로 생성하고, 웹앱 배포는 아래 4단계에서 진행합니다.

### 3단계: 코드 빌드 및 업로드

```bash
npm run clasp:push
```

이 명령은 GAS용 빌드(`dist/gas/`) 후 Apps Script에 코드를 업로드합니다.

빌드 결과물:

```
dist/gas/
├── display.html      # 프로젝터 화면 (JS/CSS 인라인)
├── control.html      # 컨트롤러 화면 (JS/CSS 인라인)
├── Code.js           # 라우팅 진입점
├── Config.js
├── SheetService.js
├── PresentationService.js
└── appsscript.json
```

### 4단계: 웹앱 배포

**방법 A — CLI**

```bash
npx clasp deploy --description "Production v1"
npx clasp deployments
```

**방법 B — Apps Script 편집기**

```bash
npx clasp open-script
```

1. **배포** → **새 배포**
2. 유형: **웹 앱**
3. 실행 주체: **나**
4. 접근 권한: 교회 내부용이면 **Google 계정이 있는 모든 사용자**
5. **배포** 클릭 후 **웹 앱 URL** 복사

### 5단계: Google Sheets 데이터베이스 설정

1. 새 Google Spreadsheet 생성
2. URL에서 **Spreadsheet ID** 복사  
   (예: `https://docs.google.com/spreadsheets/d/[여기가_ID]/edit`)
3. 시트 구성:

**Masses** 시트 (1행 헤더):

| Id | Date | Title | Language | Status |
|----|------|-------|----------|--------|

**Slides** 시트 (1행 헤더):

| Id | MassId | Sequence | Type | Title | Content | Subtitle | Notes | Enabled |
|----|--------|----------|------|-------|---------|----------|-------|---------|

4. `mock/masses.json`, `mock/slides.json`을 참고해 데이터 입력  
   (긴 텍스트는 `---PAGE---`로 구분하면 여러 슬라이드로 자동 분할)

### 6단계: 스크립트 속성 설정

```bash
npx clasp open-script
```

1. **프로젝트 설정(⚙)** → **스크립트 속성**
2. 속성 추가:
   - 속성: `SPREADSHEET_ID`
   - 값: 5단계에서 복사한 스프레드시트 ID
3. 저장

### 7단계: 접속

배포된 웹앱 URL 기준:

- **디스플레이 (프로젝터):** `[웹앱 URL]?page=display`
- **컨트롤러 (진행자):** `[웹앱 URL]?page=control`

`page` 파라미터를 생략하면 기본값은 `display`입니다.

유용한 명령:

```bash
npx clasp deployments    # 배포 URL 확인
npx clasp open-web-app   # 브라우저에서 웹앱 열기
```

## 4. 코드 수정 후 재배포

```bash
npm run clasp:push
npx clasp deploy --description "업데이트 설명"
```

## 5. 문제 해결

| 오류 | 해결 방법 |
|------|-----------|
| `Insufficient Permission` | [Apps Script API](https://script.google.com/home/usersettings) 켜기 → `npx clasp logout` → `npm run clasp:login` |
| `Invalid container file type` | `--type standalone` 사용 (`webapp` 사용 불가) |
| 슬라이드가 안 보임 | 스크립트 속성 `SPREADSHEET_ID` 확인, Sheets 데이터 확인 |
| 디스플레이/컨트롤러 동기화 안 됨 | 같은 웹앱 URL 사용, 컨트롤러에서 미사 선택 확인 |
