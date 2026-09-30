# 이번 주 미사 말씀

한국천주교주교회의 매일미사 월별 JSON 데이터(`MissaLoad`)를 읽어, 일요일부터 토요일까지의 독서·복음 성경 구절을 보여주는 Vite 앱입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

`vite.config.js`의 `/api/cbck` 프록시가 공식 사이트 요청을 중계하므로, 로컬에서는 별도 키 없이 실제 데이터가 표시됩니다.

## 운영 배포

`firebase.json`과 `functions/`에 Firebase Hosting용 프록시가 포함되어 있습니다. 이는 공식 서버가 브라우저 CORS 헤더를 반환하지 않는 문제를 해결하며, 상세 HTML에서 제1독서·제2독서·복음 본문을 파싱해 JSON으로 전달합니다.

상세 원문은 처음 요청될 때 `dailyMissaCache/YYYYMMDD` Firestore 문서에 저장됩니다. 이후 모든 사용자는 공식 사이트를 다시 요청하지 않고 이 공유 캐시를 받습니다. 캐시는 Cloud Function만 읽고 쓸 수 있으며, 브라우저의 Firestore 직접 접근은 차단됩니다.

```
GET /api/cbck/MissaLoad?start=YYYY-MM-DD&end=YYYY-MM-DD
→ https://missa.cbck.or.kr/MissaLoad?start=YYYY-MM-DD&end=YYYY-MM-DD

GET /api/missa/YYYYMMDD
→ https://missa.cbck.or.kr/DailyMissa/YYYYMMDD (서버에서 독서·복음 JSON으로 파싱)
```

Firebase CLI 로그인 및 프로젝트 연결 후 다음 순서로 배포합니다.

```bash
npm install
(cd functions && npm install)
npm run deploy
```

`npm run deploy`는 프런트엔드 빌드 후 Firebase Hosting, Cloud Functions, Firestore 보안 규칙을 함께 배포합니다. Firebase CLI가 설치되어 있지 않다면 먼저 `npm install -g firebase-tools`를 실행하세요.

첫 배포 전 Firebase Console에서 프로젝트의 **Cloud Firestore 데이터베이스를 Native mode로 생성**하세요. Firestore 사용량(문서 읽기·쓰기)에는 Firebase 요금제가 적용될 수 있습니다.

목록과 상세 본문은 같은 Firebase Hosting의 `/api/cbck/MissaLoad`, `/api/missa/YYYYMMDD`로 자동 요청됩니다. 별도 환경 변수 없이 사용할 수 있습니다.

화면의 모든 카드에는 공식 원문 링크가 남아 있어, 데이터 조회가 실패해도 사용자가 원문을 확인할 수 있습니다.

## 출처 및 유의 사항

- 성경 말씀과 전례 정보 출처: [한국천주교주교회의 매일미사](https://missa.cbck.or.kr/)
- 본 앱은 내용을 복제·저장하지 않고 제목과 성경 구절 표기 및 원문 링크를 표시합니다.
- 공식 사이트의 제공 방식 또는 이용 조건이 변경될 수 있으므로, 본당 공개 배포 전 사용 범위를 공식 기관에 확인하세요.
