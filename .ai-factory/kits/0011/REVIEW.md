당신은 패킷 0011 ("S3 시뮬레이션 설정(/simulate) 구현 + run 저장/이동")의 코드 리뷰를 수행합니다.

## 리뷰 대상 파일
src/pages/Simulate.tsx

## 이 패킷의 승인 기준 (AC)
1. IF 저장된 대출이 2개 미만이면 THEN 안내 문구 "대출이 2개 이상 있어야 비교할 수 있어요"와 "대출 추가하러 가기" 버튼이 표시되고, 비교 실행 CTA는 렌더되지 않거나 disabled=true다 (AC-S3-1)
2. IF extraMonthlyPayment 입력값이 음수 또는 숫자 파싱 불가면 THEN TextField에 hasError=true와 help 문구가 표시되고 실행 함수가 호출되지 않는다 (AC-S3-2)
3. WHILE 계산 중이면 THEN "계산 중" 텍스트가 표시되고 실행 버튼 disabled=true다 (AC-S3-3)
4. WHEN buildSimulationRun이 ok이고 saveRun이 ok이면 THEN navigate('/result',{state:{runId}})가 1회 호출된다 (AC-S3-5)
5. IF buildSimulationRun이 BOTH_STRATEGIES_FAILED로 실패하면 THEN AlertDialog가 열리고 runs storage는 변경되지 않는다 (AC-S3-4)

## 테스트 파일
src/__tests__/packet-0011.test.ts

---

## ⚡ 지시: Agent 툴로 3개 리뷰어를 동시에 실행하세요

**순차 실행 금지.** 아래 3개 Agent를 한 번에 병렬 호출해야 합니다.
각 Agent는 독립적인 컨텍스트 윈도우에서 실행됩니다.

---

### Agent 1: 스펙 준수 리뷰어
다음 파일들을 읽으세요:
- .ai-factory/spec.md
- src/pages/Simulate.tsx
- src/__tests__/packet-0011.test.ts (존재하는 경우)

승인 기준 각각에 대해 판정하세요:
1. IF 저장된 대출이 2개 미만이면 THEN 안내 문구 "대출이 2개 이상 있어야 비교할 수 있어요"와 "대출 추가하러 가기" 버튼이 표시되고, 비교 실행 CTA는 렌더되지 않거나 disabled=true다 (AC-S3-1)
2. IF extraMonthlyPayment 입력값이 음수 또는 숫자 파싱 불가면 THEN TextField에 hasError=true와 help 문구가 표시되고 실행 함수가 호출되지 않는다 (AC-S3-2)
3. WHILE 계산 중이면 THEN "계산 중" 텍스트가 표시되고 실행 버튼 disabled=true다 (AC-S3-3)
4. WHEN buildSimulationRun이 ok이고 saveRun이 ok이면 THEN navigate('/result',{state:{runId}})가 1회 호출된다 (AC-S3-5)
5. IF buildSimulationRun이 BOTH_STRATEGIES_FAILED로 실패하면 THEN AlertDialog가 열리고 runs storage는 변경되지 않는다 (AC-S3-4)

**판정 형식:**
- ✅ PASS: 어느 파일의 어느 코드가 이 AC를 충족하는지
- ❌ FAIL: 구현이 없거나 불완전 — 무엇이 빠졌는지 구체적으로
- ⚠️ PARTIAL: 일부만 구현됨 — 무엇이 더 필요한지

스펙에 있지만 완전히 누락된 기능도 추가로 보고하세요.

---

### Agent 2: 조용한 실패 탐지기
각 파일을 읽으세요: src/pages/Simulate.tsx

다음 패턴을 찾아 보고하세요:
1. localStorage 작업에 try/catch 없음 — QuotaExceededError, JSON.parse 실패 무시
2. fetch/async에 에러 처리 없음 — .catch() 또는 try/catch 누락
3. 빈 배열/null 미처리 — items[0].id 같은 패턴에 길이 확인 없음
4. await 없이 Promise 호출 — 결과 무시
5. 에러 상태 UI 없음 — 실패해도 사용자에게 아무것도 표시 안 됨

각 발견 건마다: 파일명, 문제가 되는 코드, 왜 조용히 실패하는지, 수정 방법.

---

### Agent 3: Toss 정책 위반 탐지기
각 파일을 읽으세요: src/pages/Simulate.tsx

다음 위반 사항을 모두 찾아 보고하세요:
1. HEX 색상 하드코딩 — #fff, #333, #1F2937 등 → var(--tds-color-*) 또는 TDS color prop으로 교체
2. 외부 이탈 코드 — window.location.href, window.open → Toss SDK navigate() 사용
3. 비TDS 컴포넌트 — shadcn, MUI, Ant Design import → @toss/tds-mobile만 허용
4. 외부 분석도구 — GoogleAnalytics, Amplitude, gtag import → 앱인토스 정책 위반
5. console.error 잔존 — 프로덕션 검수 반려 원인

각 발견 건마다: 파일명, 문제 코드, 올바른 교체 방법을 명시하세요.

---

## 3개 Agent 완료 후: 결과를 통합하여 리포트 작성

```
════════════════════════════════════════════════
🔍 코드 리뷰 리포트: 0011 — S3 시뮬레이션 설정(/simulate) 구현 + run 저장/이동
════════════════════════════════════════════════

## 1. 스펙 준수
[Agent 1 전체 결과]

## 2. 조용한 실패
[Agent 2 전체 결과]

## 3. Toss 정책 위반
[Agent 3 전체 결과]

────────────────────────────────────────────────
## 종합 판정
❌ 치명적 (즉시 수정 필요):

⚠️  경고 (수정 권장):

✅  통과:

## 수정 우선순위
1. [가장 심각한 문제 + 수정 방법]
2. ...
════════════════════════════════════════════════
```

치명적 문제가 있으면 "지금 바로 수정할까요?" 라고 물어보세요.