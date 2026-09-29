# 이번 주 미사 말씀

한국천주교주교회의 매일미사 월별 JSON 데이터(`MissaLoad`)를 읽어, 일요일부터 토요일까지의 독서·복음 성경 구절을 보여주는 Vite 앱입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

`vite.config.js`의 `/api/cbck` 프록시가 공식 사이트 요청을 중계하므로, 로컬에서는 별도 키 없이 실제 데이터가 표시됩니다.

## 운영 배포 전 필수 설정

공식 매일미사 서버는 브라우저에서 허용하는 CORS 헤더를 반환하지 않습니다. 따라서 정적 호스팅에 배포할 때는 같은 도메인에 다음 요청을 전달하는 서버 측 프록시(Cloudflare Worker, Firebase Function, Apps Script 등)를 하나 두어야 합니다.

```
GET /api/cbck/MissaLoad?start=YYYY-MM-DD&end=YYYY-MM-DD
→ https://missa.cbck.or.kr/MissaLoad?start=YYYY-MM-DD&end=YYYY-MM-DD
```

프록시가 준비되면 `.env.example`을 `.env.production`으로 복사하고 `VITE_MASS_API_URL`에 그 URL을 설정한 뒤 `npm run build` 합니다. 프록시는 GET만 허용하고 `missa.cbck.or.kr`로만 전달하도록 제한하세요.

화면의 모든 카드에는 공식 원문 링크가 남아 있어, 데이터 조회가 실패해도 사용자가 원문을 확인할 수 있습니다.

## 출처 및 유의 사항

- 성경 말씀과 전례 정보 출처: [한국천주교주교회의 매일미사](https://missa.cbck.or.kr/)
- 본 앱은 내용을 복제·저장하지 않고 제목과 성경 구절 표기 및 원문 링크를 표시합니다.
- 공식 사이트의 제공 방식 또는 이용 조건이 변경될 수 있으므로, 본당 공개 배포 전 사용 범위를 공식 기관에 확인하세요.
