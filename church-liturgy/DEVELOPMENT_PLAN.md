# 가톨릭 성당 전례 프레젠테이션 시스템 MVP - 개발 계획

본 문서는 기존의 파워포인트 기반 성당 전례 프레젠테이션 방식을 대체하기 위한 웹 기반 프레젠테이션 시스템(MVP)의 구현 계획을 정리한 문서입니다.

## 1. 아키텍처 개요
본 시스템은 향후 백엔드(데이터베이스 및 서버)를 교체할 수 있도록 관심사를 분리하여 설계되었습니다. 

- **데이터베이스 및 호스팅:** Google Sheets (콘텐츠 관리) + Google Apps Script (백엔드 및 정적 파일 호스팅)
- **프론트엔드:** 순수 HTML, CSS, Vanilla JavaScript 사용 (경량화 목적)
- **로컬 개발 환경:** Vite 기반의 로컬 서버 제공, Mock 데이터를 통한 독립적인 오프라인 개발 지원

### 프로젝트 폴더 구조
```text
church-liturgy/
├── src/
│   ├── appsscript/           # Google Apps Script 백엔드 코드
│   │   ├── Code.js           # 라우팅 및 진입점
│   │   ├── Config.js         # 설정 환경 변수 (스프레드시트 ID 등)
│   │   ├── SheetService.js   # 구글 시트 데이터 읽기
│   │   └── Presentation.js   # 프레젠테이션 현재 상태 관리 (캐시/프로퍼티)
│   ├── web/                  # 프론트엔드 (UI)
│   │   ├── styles/           # CSS 스타일 (라이트/다크 테마 포함)
│   │   ├── scripts/          # 클라이언트 JavaScript
│   │   │   ├── display.js    # 프로젝터(디스플레이) 화면 로직
│   │   │   ├── control.js    # 진행자(컨트롤러) 화면 로직
│   │   └── services/         # 데이터 제공자 추상화 레이어
│   │       ├── DataProvider.js       # 인터페이스
│   │       ├── LocalProvider.js      # 로컬 개발용 Mock 데이터 통신
│   │       └── GasProvider.js        # 운영용 google.script.run 통신
├── mock/                     # 로컬 테스트용 가상 데이터
│   ├── masses.json
│   └── slides.json
├── display.html              # 디스플레이 화면 HTML
├── control.html              # 컨트롤러 화면 HTML
├── index.html                # 로컬 개발용 라우터 (Vite 전용)
├── package.json              # npm 패키지 및 스크립트 정보
├── vite.config.js            # Vite 빌드 설정
├── appsscript.json           # Apps Script 매니페스트 (권한 설정)
└── README.md                 # 사용자 안내 문서
```

## 2. 핵심 기능

### 2.1 프론트엔드 웹 앱
- **데이터 공급자(Data Provider) 추상화:** 구동 환경에 따라 `LocalProvider`(Mock JSON)와 `GasProvider`(Google Apps Script)가 동적으로 전환되어 로컬 환경에서는 구글 서버 없이 완전한 테스트가 가능합니다.
- **디스플레이 화면 (프로젝터용):** 16:9 비율에 최적화된 큰 글씨와 다크 테마를 사용하며, 폴링(Polling) 방식으로 지속적으로 현재 프레젠테이션 상태를 확인하고 화면을 업데이트합니다.
- **컨트롤 화면 (진행자용):** 슬라이드 목록, 미리보기, 키보드 네비게이션(화살표 및 스페이스바)을 지원합니다. 슬라이드 변경 시 상태값을 갱신하여 디스플레이 화면을 조작합니다.
- **긴 텍스트 자동 분할 (Pagination):** 성경 독서 등 긴 텍스트는 `---PAGE---` 구분자를 사용하여 여러 슬라이드로 분리되도록 렌더링 로직에 반영되었습니다.

### 2.2 Google Apps Script 백엔드
- `doGet(e)` 함수를 통해 `?page=display` 또는 `?page=control` 파라미터에 따라 적절한 HTML 문서를 서빙합니다.
- Apps Script의 `CacheService`와 `PropertiesService`를 활용하여 실시간 미사 상태(현재 슬라이드 등)를 관리하고, 구글 시트 읽기 비용과 시간을 최소화합니다.

### 2.3 데이터베이스 모델 (Google Sheets)
비전문가인 성당 봉사자도 쉽게 편집할 수 있도록 다음과 같이 RDB 형태의 시트를 유지합니다.
- **Masses 시트:** 미사 기본 정보 (ID, 날짜, 제목 등)
- **Slides 시트:** 개별 슬라이드 콘텐츠 (순서, 타입, 제목, 본문, 사용 여부 등)

## 3. 향후 발전 및 검증 계획
- 로컬 브라우저의 `localStorage`를 활용한 상태 유지와 오프라인 복원력 보강 (이미 MVP 버전에 부분 반영됨)
- 향후 완전한 백엔드 시스템(MySQL, .NET API 등)이 도입될 경우, `DataProvider` 인터페이스를 구현하는 새로운 Provider 클래스만 추가하여 무중단 전환을 목표로 합니다.
