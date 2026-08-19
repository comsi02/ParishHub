# Catholic Church Liturgy Presentation System

성당 전례(미사) 진행을 위해 기존의 파워포인트(PowerPoint) 방식을 대체하는 웹 기반 프레젠테이션 시스템 MVP입니다.
Google Sheets를 데이터베이스 및 콘텐츠 관리 도구로 사용하며, Google Apps Script를 통해 구동됩니다.

## 1. 로컬 개발 환경 (Local Development)

Google 계정이나 인터넷 연결 없이도 가상의 모의 데이터(Mock Data)를 사용하여 로컬에서 개발 및 테스트가 가능합니다.

### 실행 방법
1. Node.js가 설치되어 있어야 합니다.
2. 패키지 설치:
   ```bash
   npm install
   ```
3. 개발 서버 실행:
   ```bash
   npm run dev
   ```
4. 실행 후 터미널에 표시된 URL (예: `http://localhost:5173/`)을 엽니다.
   - 디스플레이 화면 (프로젝터용): `http://localhost:5173/display.html`
   - 컨트롤러 화면 (진행자용): `http://localhost:5173/control.html`

## 2. 테마 설정 (라이트 / 다크 모드)
- 디스플레이 화면은 프로젝터 가독성을 위해 기본적으로 **다크 모드**로 설정되어 있습니다.
- 컨트롤러 화면은 조작 편의성을 위해 **라이트 모드**로 설정되어 있으며, 우측 상단의 '다크 모드' 버튼을 통해 전환이 가능합니다.
- `src/web/styles/base.css` 파일의 CSS 변수(`--bg-color`, `--text-color` 등)를 수정하여 원하는 테마로 자유롭게 변경할 수 있습니다.

## 3. Google Apps Script 배포 준비 (clasp)

### 구글 계정 및 Apps Script 설정
1. Google 계정을 준비합니다.
2. [Google Apps Script API](https://script.google.com/home/usersettings) 페이지에 접속하여 **Google Apps Script API를 켭니다(ON)**.
3. 터미널에서 구글 계정으로 로그인합니다:
   ```bash
   npm run clasp:login
   ```
4. 새로운 Apps Script 프로젝트를 생성하거나 기존 프로젝트에 연결합니다 (`.clasp.json` 파일 생성).
   ```bash
   npx clasp create --type webapp --title "Church Liturgy System"
   ```

## 4. Google Sheets 데이터베이스 설정

프레젠테이션 데이터를 관리할 Google Sheets를 생성해야 합니다.

1. 새 Google Spreadsheet를 생성합니다.
2. 스프레드시트의 URL에서 **Spreadsheet ID**를 복사합니다. (예: `https://docs.google.com/spreadsheets/d/[여기가_ID입니다]/edit`)
3. 첫 번째 시트 이름을 **Masses**로 변경하고, 다음 헤더를 1행에 작성합니다:
   `Id` | `Date` | `Title` | `Language` | `Status`
4. 두 번째 시트 이름을 **Slides**로 변경하고, 다음 헤더를 1행에 작성합니다:
   `Id` | `MassId` | `Sequence` | `Type` | `Title` | `Content` | `Subtitle` | `Notes` | `Enabled`
5. 데이터를 적절히 입력합니다. (긴 텍스트는 `---PAGE---`로 구분하면 자동으로 여러 페이지로 나뉩니다.)

### Spreadsheet ID 환경 변수 설정
코드를 배포한 후, Apps Script 편집기에서:
1. `프로젝트 설정(톱니바퀴)` > `스크립트 속성(Script Properties)`으로 이동합니다.
2. 속성 추가:
   - 속성: `SPREADSHEET_ID`
   - 값: 복사해둔 스프레드시트 ID
3. 저장합니다.

## 5. 빌드 및 배포

1. 코드를 빌드하고 Apps Script에 푸시합니다:
   ```bash
   npm run clasp:push
   ```
2. Apps Script 편집기(`npx clasp open`)를 열어 **배포(Deploy) > 새 배포(New deployment)** 를 선택합니다.
3. 유형을 **웹 앱(Web App)**으로 선택합니다.
4. '실행 주체(Execute as)'는 **나(Me)**로 설정하고, '접근 권한(Who has access)'은 필요에 따라 설정합니다. (교회 내부용이라면 'Google 계정이 있는 모든 사용자' 정도가 적합합니다.)
5. 발급된 **웹 앱 URL**을 복사합니다.
   - 디스플레이 화면: `[웹앱 URL]?page=display`
   - 컨트롤러 화면: `[웹앱 URL]?page=control`
