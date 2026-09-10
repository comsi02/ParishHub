# church-catechesis (가톨릭 주일학교 & 은총표 관리 시스템)

`ParishHub` 생태계의 주일학교 교리교육 및 출석, 활동 봉사, 은총표(Grace Points) 통합 관리 시스템입니다.
기존 `church-liturgy`와 동일한 Firebase 프로젝트(`parish-hub-liturgy`)를 공유하며, 멀티 호스팅 및 컬렉션 분리 방식으로 설계되었습니다.

---

## 🌟 주요 기능

1. **대시보드 (Dashboard)**
   - 재적 학생 수, 금일 출석 현황, 활동 봉사자 수, 총 발행 은총표 실시간 집계
   - 이번 학기 은총표 랭킹 TOP 5 실시간 표출
   - 교사회(교감, 부교감, 학년별 담임 교사) 명단 및 연락처 바로가기

2. **주일 출석 체크 (Smart Attendance)**
   - 일자별 출석 기록 (출석 +10 P, 지각 +5 P, 결석)
   - 주일 미사 참례 여부 원터치 체크 (+5 P)
   - 모바일/태블릿 친화적 터치 UI (전원 출석 완료 지원)
   - 출석 시 은총표 자동 적립 및 실시간 대시보드 반영

3. **활동 부서 봉사 관리 (Ministry Activities)**
   - 복사단 (+15 P), 전례부(해설/독서 +10 P), 성가대 (+10 P), 현악 (+10 P), 밴드 (+10 P), 기타 (+5 P)
   - 주일 미사 당일 활동 봉사자 체크인 및 활동 은총표 자동 적립
   - 최근 활동 히스토리 조회

4. **은총표 관리소 (Grace Bank)**
   - 학생별 은총표 자동 계산: `출석 점수 + 활동 점수 + 보너스/추가 점수`
   - 보너스/추가 점수 부여 (사유, 교사 기록)
   - 은총잔치/달란트 시장용 은총표 차감/사용 지원
   - 학생별 상세 은총표 원장(Ledger) 모달 조회

5. **학생 및 학부모 명부 (Directory)**
   - **학생**: 이름, 세례명, 학년(JK, SK, G1~G12), 성별, 축일(선택), 첫영성체/견진 여부, 활동 부서, 보호자 연락처
   - **학부모**: 이름, 세례명, 전화번호, 주소, 자녀 목록, 한부모 가정 표시 지원

---

## 🚀 로컬 실행 방법

```bash
cd church-catechesis
npm install
npm run dev
```

브라우저에서 `http://localhost:5174`로 접속하시면 즉시 모든 기능을 체험할 수 있습니다. (기본 Mock/Local 모드로 동작하여 Firebase 설정 없이도 즉시 완벽 작동)

---

## 🌐 Firebase 멀티 사이트 호스팅 배포 가이드

1. **Firebase 콘솔에서 새 사이트 추가 (최초 1회, 무료)**
   * Firebase 콘솔 → Hosting → 사이트 추가 클릭
   * 사이트 ID 입력: `parish-hub-catechesis` 생성

2. **호스팅 타겟 등록 및 배포**
   ```bash
   firebase target:apply hosting catechesis parish-hub-catechesis
   npm run build
   firebase deploy --only hosting:catechesis
   ```
   배포 후 `https://parish-hub-catechesis.web.app` 주소로 접속 가능합니다.
