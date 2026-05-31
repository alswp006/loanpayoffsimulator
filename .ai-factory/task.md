# TASK

## Epic 1. TypeScript types + interfaces
### Task 1.1 [Define domain/storage types + RouteState contract]
- Description: `Loan`, `SimulationRun`, 스토리지 shape, 시뮬레이션/스케줄 타입, Result/ErrorCode, 그리고 **페이지 간 네비게이션 상태 계약(RouteState)** 을 `src/lib/types.ts`에 **순수 타입만**으로 정의한다.
- DoD:
  - `src/lib/types.ts`에 아래 항목이 **런타임 코드 없이** `export`되고 TypeScript 컴파일 에러가 없다.
    - `Loan`, `LoansStorageV1`
    - `StrategyType`, `SimulationInput`, `SimulationErrorCode`, `StrategySummary`, `SimulationRunComparison`, `SimulationRun`
    - `PerLoanScheduleBreakdown`, `PaymentScheduleRow`, `MonthlyScheduleRow`, `StrategySchedulePayload`
    - `RewardUnlocksV1`, `AppSettingsV1`
    - `StorageErrorCode`, `Result<T,E>`, `VoidResult<E>`
  - **`RouteState`** 타입이 아래 라우트 키를 **정확한 문자열 키**로 포함한다.
    - `"/"`: `{ highlightLoanId: string } | undefined`
    - `"/loan/new"`: `undefined`
    - `"/loan/edit"`: `{ loanId: string }`
    - `"/simulate"`: `undefined`
    - `"/result"`: `{ runId: string }`
    - `"/schedule"`: `{ runId: string; strategy: StrategyType }`
    - `"/settings"`: `undefined`
- Covers:  
  - (Contract) ROUTE STATE CONTRACT (SPEC “ROUTE STATE CONTRACT (CRITICAL)”)
- Files:
  - `src/lib/types.ts`
- Depends on: none

### Epic 1 Risk Analysis
- Complexity: Low
- Risk factors: RouteState 키/타입 누락 시 페이지 간 `location.state` 불일치로 런타임 오류 발생
- Mitigation: 최우선으로 RouteState를 고정하고, 이후 모든 페이지 task에서 import/cast를 DoD로 강제

---

## Epic 2. Data layer (localStorage storage helpers; CRUD + eviction)
### Task 2.1 [Loans storage helpers: get/create/update/delete/reset + validation]
- Description: `lps_loans_v1`에 대한 스토리지 서비스 API를 `src/lib/storage/loans.ts`에 구현한다. (파싱/스키마 체크, 입력 검증, quota 에러 처리 포함)
- DoD:
  - 아래 함수들이 구현되고, 각 함수는 명시된 `Result`/`VoidResult` 타입을 반환한다.
    - `getLoans()`
    - `getLoanById(loanId)`
    - `createLoan(input)`
    - `updateLoan(loanId, patch)`
    - `deleteLoan(loanId)`
    - `resetLoans()`
  - `PARSE_ERROR` 조건(패스/페일):
    - localStorage 값이 존재하고 `JSON.parse` 실패 **또는**
    - 파싱은 성공했으나 `{version:1, items: Loan[]}` 스키마가 아니면 `ok:false, error:'PARSE_ERROR'` 반환
  - `VALIDATION_ERROR` 조건(최소 체크, 하나라도 위반 시 실패):
    - `name.trim().length`가 `1~30`이 아니면 실패
    - `principalRemaining`가 `1~2_000_000_000` 범위 밖이면 실패
    - `annualInterestRate`가 `0~30` 범위 밖이면 실패
    - `remainingMonths`가 `1~600` 범위 밖이면 실패
    - `monthlyPayment`가 `1~50_000_000` 범위 밖이면 실패
    - 생성 시 `items.length >= 200`이면 실패(저장 상한)
  - `QUOTA_EXCEEDED`:
    - `localStorage.setItem`에서 `QuotaExceededError`(또는 동등) throw 시 `ok:false, error:'QUOTA_EXCEEDED'` 반환
- Covers:
  - AC-S1-4
  - AC-S2-5
  - F1-AC-1, F1-AC-2, F1-AC-3, F1-AC-4, F1-AC-6, F1-AC-7, F1-AC-8, F1-AC-9, F1-AC-10
- Files:
  - `src/lib/storage/loans.ts`
  - `src/lib/storage/schema.ts` (스키마 가드/파서 유틸 필요 시)
  - `src/lib/storage/errors.ts` (QuotaExceeded 판별 유틸 필요 시)
- Depends on: Task 1.1

### Task 2.2 [Runs storage helpers: get/save/delete/reset + FIFO eviction(20)]
- Description: `lps_runs_v1` 스토리지 API 구현. `saveSimulationRun()`에서 **동기적으로 FIFO eviction(20개)** 을 적용한다.
- DoD:
  - 아래 함수들이 구현되고 컴파일된다.
    - `getSimulationRuns()`
    - `getSimulationRunById(runId)`
    - `saveSimulationRun(run)`
    - `deleteSimulationRun(runId)`
    - `resetSimulationRuns()`
  - `saveSimulationRun()` eviction 규칙(패스/페일):
    - 기존 items 로드 → 새 run을 **맨 앞(unshift)** 에 추가
    - 길이 20 초과면 **뒤에서부터 pop** 하여 최종 길이가 정확히 20 이하
    - 최종 items를 localStorage에 setItem
  - `PARSE_ERROR/NOT_FOUND/QUOTA_EXCEEDED` 처리가 SPEC Storage Service API와 동일한 error code로 반환된다.
- Covers:
  - AC-S4-3, AC-S5-4 (Expired 상태의 원인이 되는 eviction 계약)
  - F2-AC-1, F2-AC-6
- Files:
  - `src/lib/storage/runs.ts`
- Depends on: Task 1.1, Task 2.1

### Task 2.3 [Reward unlocks + Settings storage helpers (max 50 FIFO)]
- Description: `lps_reward_unlocks_v1`, `lps_settings_v1` 스토리지 헬퍼를 구현한다. unlock은 **중복 금지 + 50개 FIFO** 를 적용한다.
- DoD:
  - 아래 함수들이 구현되고 컴파일된다.
    - `getRewardUnlocks()`
    - `unlockRunId(runId, options?)` (`ensureRunExists` 기본 `true`)
    - `getSettings()`
    - `saveSettings(patch)` (최소: `hasDismissedExternalLinkPolicySheet` 저장/병합)
  - `unlockRunId()` 규칙(패스/페일):
    - 이미 존재하는 runId면 **중복 추가 없이 성공**(스토리지 내용 불변)
    - 추가로 인해 50개 초과 시 **오래된 것부터 제거(FIFO)** 하여 최종 길이 `<= 50`
    - `ensureRunExists=true`일 때 `getSimulationRunById(runId)`가 `NOT_FOUND`면 `NOT_FOUND` 반환
- Covers:
  - AC-S5-2
- Files:
  - `src/lib/storage/rewardUnlocks.ts`
  - `src/lib/storage/settings.ts`
- Depends on: Task 1.1, Task 2.2

### Epic 2 Risk Analysis
- Complexity: Medium
- Risk factors:
  - localStorage 파싱 실패 처리 누락 시 홈 진입 시 크래시
  - QuotaExceeded 처리 누락 시 저장 시 앱 크래시
  - eviction 구현 실수 시 Expired 상태 재현 불가(S4/S5 AC 실패)
- Mitigation:
  - Loans/Runs/Unlocks를 분리 구현해 각 task 크기 축소
  - eviction을 `saveSimulationRun()`에만 적용하도록 범위 고정

---

## Epic 3. State management (hydrate + actions)
### Task 3.1 [Loans store context: hydrate/loading/error + actions]
- Description: Loans 전용 Context/Hook을 만든다. 페이지는 localStorage 직접 접근 대신 store를 사용한다.
- DoD:
  - `LoansProvider` + `useLoansStore()`가 컴파일된다.
  - store state 최소 포함:
    - `isHydrating: boolean` (초기 `true`, hydrate 완료 시 `false`)
    - `loans: Loan[]`
    - `hydrateErrorCode?: 'PARSE_ERROR'`
  - actions 최소 포함:
    - `reload()` (getLoans 재호출)
    - `createLoan(...)`, `updateLoan(...)`, `deleteLoan(...)`, `resetLoans()`
  - hydrate에서 `getLoans()`가 `PARSE_ERROR`면 `hydrateErrorCode === 'PARSE_ERROR'`가 된다.
- Covers:
  - AC-S1-1, AC-S1-4
  - AC-S2-4
- Files:
  - `src/lib/store/loansStore.tsx`
- Depends on: Task 2.1

### Task 3.2 [Runs store context: hydrate + save/getById]
- Description: Runs 전용 Context/Hook 구성. 결과/스케줄 화면에서 run 조회에 사용.
- DoD:
  - `RunsProvider` + `useRunsStore()`가 컴파일된다.
  - state 최소 포함: `isHydrating`, `runs: SimulationRun[]`, `hydrateErrorCode?: 'PARSE_ERROR'`
  - actions 최소 포함:
    - `reload()`
    - `getRunById(runId): Result<SimulationRun,'PARSE_ERROR'|'NOT_FOUND'>` (storage 위임 가능)
    - `saveRun(run): Result<SimulationRun, ...>` (storage 위임 가능)
- Covers:
  - AC-S4-2, AC-S4-3, AC-S5-4
  - F2-AC-1, F2-AC-6
- Files:
  - `src/lib/store/runsStore.tsx`
- Depends on: Task 2.2

### Task 3.3 [Reward unlocks store context]
- Description: 스케줄 잠금해제 여부를 쉽게 판단/저장할 수 있도록 RewardUnlocks Context/Hook을 만든다.
- DoD:
  - `RewardUnlocksProvider` + `useRewardUnlocksStore()` 컴파일
  - state 최소 포함: `unlockedRunIds: string[]`, `isHydrating: boolean`
  - actions 최소 포함:
    - `unlock(runId): VoidResult<...>` (내부에서 `unlockRunId` 호출 후 state 갱신)
    - `reload()` (선택, 있으면 getRewardUnlocks 재호출)
- Covers:
  - AC-S5-1, AC-S5-2
- Files:
  - `src/lib/store/rewardUnlocksStore.tsx`
- Depends on: Task 2.3

### Epic 3 Risk Analysis
- Complexity: Medium
- Risk factors:
  - hydrate 타이밍 꼬임으로 “불러오는 중”/버튼 disabled AC 실패
  - storage 에러를 UI에 전달 못 하면 AlertDialog 조건 불충족
- Mitigation:
  - `isHydrating`/`hydrateErrorCode`를 모든 store에 동일 패턴으로 강제
  - 페이지는 store 상태만 보고 렌더하도록 단순화

---

## Epic 4. Simulation engine (summary + schedule recompute; no persistence for rows)
### Task 4.1 [Engine primitives: monthly interest + termination rules]
- Description: 시뮬레이션 핵심 규칙(월 이자 반올림, 스톨 3개월, MAX 720)을 구현할 기반 유틸/상수와 공통 종료 처리를 만든다.
- DoD:
  - `MAX_SIMULATION_MONTHS = 720`이 export 된다.
  - `calcMonthlyInterest(principalRemaining, annualInterestRate)`가 `Math.round(principal * rate/100/12)`로 계산하며 **정수**를 반환한다.
  - 전략 실행 루프에서 아래 두 종료 케이스를 표현할 수 있는 타입/유틸이 준비된다(예: errorCode 반환):
    - 3개월 연속 원금 감소 없음 → `STALL_3_MONTHS`
    - 720개월 도달 & 잔액 > 0 → `MAX_MONTHS_REACHED` (monthsSimulated=720 유지 가능)
- Covers:
  - AC-ENG-1, AC-ENG-3, AC-ENG-4
  - F2-AC-5, F2-AC-7
- Files:
  - `src/lib/simulation/constants.ts`
  - `src/lib/simulation/interest.ts`
  - `src/lib/simulation/errorCodes.ts` (필요 시)
- Depends on: Task 1.1

### Task 4.2 [Simulate single strategy summary (Snowball/Avalanche)]
- Description: Snowball/Avalanche 한 전략을 실행해 `StrategySummary`를 산출한다. “완납된 대출의 monthlyPayment가 다음 달 extra 재원이 되는 규칙”을 반영한다.
- DoD:
  - `simulateStrategySummary({ loanSnapshot, extraMonthlyPayment, strategy })` (함수명 자유) 구현되어 컴파일된다.
  - 타겟 대출 선택:
    - snowball: 남은 잔액 최소
    - avalanche: 연이율 최대
  - 월 처리 순서가 SPEC과 일치하도록 구현된다:
    1) 월 이자 발생(잔액 증가)
    2) 각 대출 최소 월납입액 납입(잔액+이자보다 크면 그만 납입)
    3) 추가상환(extraMonthlyPayment + freedPayments)을 타겟 대출에 우선 납입
    4) 어떤 대출이 완납되면, 그 대출의 monthlyPayment는 **다음 달부터** 추가상환 재원에 합산
  - 결과 summary는 `status='error'`일 때 `monthsToPayoff=0`, `totalMonths=0`, `payoffDateISO=""`로 저장한다.
- Covers:
  - AC-ENG-2
- Files:
  - `src/lib/simulation/simulateStrategySummary.ts`
- Depends on: Task 4.1

### Task 4.3 [Build run result: independent strategies + comparison + both-error gate]
- Description: 두 전략을 독립 실행하여 `SimulationRun`의 `summaries/comparison`을 만든다. “둘 다 error면 실패(저장/이동 금지)” 판별을 리턴값으로 제공한다.
- DoD:
  - `runSimulationComparison({ loans, extraMonthlyPayment })` (함수명 자유) 구현:
    - 내부에서 snowball/avalanche를 **독립 실행**
    - 한쪽만 error면 `ok:true`로 run 생성 가능
    - 둘 다 error면 `ok:false`로 반환하며 `errorCode`가 `STALL_3_MONTHS` 또는 `MAX_MONTHS_REACHED` 중 하나로 노출된다(페이지 AlertDialog 분기 가능)
  - `comparison` 계산:
    - 둘 중 하나라도 status='error'이면 `interestDiff=0`, `monthsDiff=0`, `winnerByInterest='tie'`
- Covers:
  - AC-ENG-5
  - AC-S3-5
  - F2-AC-8
- Files:
  - `src/lib/simulation/buildRun.ts`
- Depends on: Task 4.2

### Task 4.4 [Schedule generator: rows + totals (runtime only)]
- Description: S5에서 사용할 `StrategySchedulePayload`(rows + totals)를 **매번 재계산**하는 함수를 구현한다. 스케줄은 localStorage에 저장하지 않는다.
- DoD:
  - `buildStrategySchedule({ run, strategy })` 구현되어 컴파일된다.
  - 출력 조건:
    - `rows.length`는 `0~720`
    - 각 row의 `perLoan.length === run.loanSnapshot.length`
    - `totals.months === rows.length`
    - 금액 필드는 모두 정수(원 단위)
  - **저장 금지(패스/페일)**:
    - `src/lib/simulation/buildSchedule.ts` 내에 `localStorage` 접근 코드가 존재하지 않는다.
- Covers:
  - (Data model) “PaymentScheduleRow[]는 localStorage에 절대 저장하지 않는다” 계약
  - AC-S5-6 (UI에서 121행 이상 조건을 만들 수 있도록 rows 생성 지원)
- Files:
  - `src/lib/simulation/buildSchedule.ts`
- Depends on: Task 4.1

### Epic 4 Risk Analysis
- Complexity: High
- Risk factors:
  - 월 처리 순서/재원 재배분 규칙 구현 실수로 요약/스케줄 불일치
  - 스톨 판정 오탐/미탐으로 error 처리 AC 실패
- Mitigation:
  - primitives(이자/종료) → 단일 전략 요약 → 비교(run) → 스케줄 생성 순으로 단계 분리
  - 스케줄을 저장하지 않아 5MB 및 eviction 복잡도 리스크 제거

---

## Epic 5. Core UI pages (src/pages/) — ONE page per task
> 모든 페이지 task는 `RouteState`를 import하고 `location.state as RouteState["/path"]`로 캐스팅해야 함.

### Task 5.1 [S1 HomePage: loan list + empty/guide/loading/error + delete]
- Description: `/` 대출 목록/홈 화면 구현. hydrate 로딩, empty/guide 상태, 삭제 다이얼로그, 파싱 실패 시 초기화 다이얼로그, 하단 배너 광고 배치.
- DoD:
  - 로딩: `isHydrating=true` 동안 `"불러오는 중"` 텍스트 렌더 + `"대출 추가"` 버튼 `disabled=true` + `"시뮬레이션 시작"` 버튼이 렌더링되면 `disabled=true`
  - Empty: loans 0개면 ListRow(대출명 텍스트 포함) 0개 + `"대출 추가"` 버튼 표시
  - Guide(1개): 안내 문구 `"대출을 1개 더 추가하면 전략 비교가 가능해요"` 표시 + `"시뮬레이션 시작"` `disabled=true`
  - 파싱 실패: AlertDialog 제목 `"데이터를 불러올 수 없어요"` 표시 + `"초기화"` 탭 시 `resetLoans()` 호출
  - 삭제: 삭제 보조 버튼 → AlertDialog `"삭제"` 확인 시 실제 삭제 + Toast `"삭제했어요"`
  - `navigate('/loan/edit', { state: { loanId } })`가 ListRow 탭에서 호출된다.
  - AdSlot: 목록 하단 섹션 아래에 **1회 렌더**
  - **RouteState 캐스팅**: `const state = location.state as RouteState["/"]`
- Covers:
  - AC-S1-1, AC-S1-2, AC-S1-3, AC-S1-4, AC-S1-5
  - F1-AC-5, F1-AC-6, F1-AC-9
- Files:
  - `src/pages/Home.tsx`
- Depends on: Task 3.1

### Task 5.2 [S2 LoanFormPage: /loan/new + /loan/edit form with validation + navigation]
- Description: 대출 추가/수정 폼 페이지 구현. edit는 route state의 `loanId`로 로드. 숫자 입력 `inputMode="numeric"`, 저장 시 blur, 유효성 오류 표시, quota 에러 토스트.
- DoD:
  - 상단 가이드 문구 `"대출을 2개 이상 추가하면 Snowball/Avalanche 전략 비교가 가능해요"` 표시
  - `/loan/edit` 진입 시:
    - `location.state`에 loanId 없으면 AlertDialog 표시 + `"확인"` 탭 시 `navigate('/')` 1회 호출
    - loanId가 있어도 저장소에 없으면 AlertDialog 표시 + **입력 TextField가 0개 렌더링**
    - 로딩 중 `"불러오는 중"` + `"저장"` 버튼 `disabled=true`
  - 저장:
    - new: create 성공 시 Toast `"저장했어요"` + `navigate('/', { state: { highlightLoanId } })`
    - edit: update 성공 시 Toast `"저장했어요"` + `navigate('/', { state: { highlightLoanId } })`
  - 유효성(패스/페일):
    - `annualInterestRate=30.1` 저장 시도 시: 저장 수행되지 않고 `"연이율은 0%~30% 사이여야 해요"`가 DOM에 존재
    - `name=""` 저장 시도 시: `"대출 이름을 입력해주세요"`가 DOM에 존재
    - `principalRemaining=0` 저장 시도 시: `"잔액은 1원 이상 입력해주세요"`가 DOM에 존재
  - quota:
    - storage가 `QUOTA_EXCEEDED`를 반환하면 Toast `"저장 공간이 부족해요. 일부 대출을 삭제하고 다시 시도해주세요"` 표시 + `navigate('/')` 미호출
  - 모바일 키보드:
    - 숫자 필드에 `inputMode="numeric"` 존재
    - `"저장"` 탭 시 `document.activeElement?.blur()` 호출
  - **RouteState 캐스팅**
    - new: `RouteState["/loan/new"]`
    - edit: `RouteState["/loan/edit"]`
- Covers:
  - AC-S2-1, AC-S2-2, AC-S2-3, AC-S2-4, AC-S2-5
  - F1-AC-1, F1-AC-2, F1-AC-3, F1-AC-4, F1-AC-7, F1-AC-8
- Files:
  - `src/pages/LoanForm.tsx`
- Depends on: Task 3.1

### Task 5.3 [S3 SimulatePage: extra payment input + run save + both-error dialog]
- Description: `/simulate`에서 추가상환 입력, 대출 2개 미만 가이드/CTA, 엔진 실행(두 전략), 저장/이동, 입력/엔진 오류 처리 구현.
- DoD:
  - 대출 2개 미만:
    - 문구 `"대출을 2개 이상 추가해주세요"` 표시
    - `"대출 추가하러 가기"` 버튼 탭 시 `navigate('/loan/new')` 호출
    - `"비교 결과 보기"` 버튼은 `disabled=true` **또는** 미렌더(둘 중 하나로 고정 구현)
  - 입력 검증:
    - `extraMonthlyPayment < 0`이면 실행 거부 + TextField 하단 `"추가 상환 금액은 0원 이상이어야 해요"` + run 저장 없음
  - 실행:
    - 탭 시 `"계산 중"` 텍스트 + 버튼 `disabled=true`
    - `SimulationInput.loanIds`는 실행 시점 loans 배열 순서 그대로 저장된다(예: `[a,b,c] -> ["a","b","c"]`)
    - 성공 시 `saveSimulationRun` 호출 + `navigate('/result', { state: { runId } })`
  - 양 전략 모두 error:
    - `/result`로 navigate 하지 않음
    - AlertDialog 표시
      - `STALL_3_MONTHS`면 제목 `"상환이 진행되지 않아요"` + 본문 고정 문구 포함
      - `MAX_MONTHS_REACHED`면 제목 `"상환 기간이 너무 길어요"` + 본문 고정 문구 포함
    - run 저장 없음
  - run 저장 `QUOTA_EXCEEDED`:
    - Toast `"저장 공간이 부족해요. 이전 결과를 삭제하고 다시 시도해주세요"`
    - `/result`로 이동하지 않음
  - **RouteState 캐스팅**: `RouteState["/simulate"]`
- Covers:
  - AC-S3-1, AC-S3-2, AC-S3-3, AC-S3-4, AC-S3-5
  - F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-4, F2-AC-5, F2-AC-6, F2-AC-7, F2-AC-8
- Files:
  - `src/pages/Simulate.tsx`
- Depends on: Task 3.1, Task 3.2, Task 4.3

### Task 5.4 [S4 ResultPage: summary render + expired/missing + copy + AdSlot placement]
- Description: `/result`에서 runId로 결과 조회 후 Snowball/Avalanche 요약 비교를 렌더. runId 누락/만료 처리, 전략 error 버튼 disabled, 결과 복사, 배너 광고 위치 준수.
- DoD:
  - `location.state.runId` 누락:
    - `"결과를 찾을 수 없어요"` 표시
    - `"시뮬레이션으로"` 버튼 탭 시 `navigate('/simulate')` 1회 호출
  - runId 존재 + 저장소 `NOT_FOUND`:
    - `"결과를 찾을 수 없어요"` + `"결과가 만료되었어요"` **둘 다** DOM에 존재
  - 정상:
    - 두 전략의 `totalInterestPaid`가 각각 `toLocaleString('ko-KR') + '원'` 형태로 DOM에 표시
    - 절감액 문구에 `Math.abs(diff)` 값이 포함
    - 전략 `status="error"`인 경우 해당 전략의 `"상세 스케줄 보기"` 버튼이 렌더링되면 `disabled=true`
  - 로딩:
    - `"불러오는 중"` 텍스트 + `"상세 스케줄 보기"` 버튼 `disabled=true`
  - AdSlot:
    - “요약 섹션” 이후, “상세 버튼 섹션” 이전에 **1회** 렌더
  - 결과 복사:
    - `"결과 복사"` 탭 시 `navigator.clipboard.writeText(...)` 호출을 시도하고 성공/실패에 따라 Toast가 1회 표시된다(문구는 구현 고정)
  - **RouteState 캐스팅**: `RouteState["/result"]`
- Covers:
  - AC-S4-1, AC-S4-2, AC-S4-3, AC-S4-4, AC-S4-5
  - F3-AC-1, F3-AC-2, F3-AC-3
- Files:
  - `src/pages/Result.tsx`
- Depends on: Task 3.2

### Task 5.5 [S5 SchedulePage: reward gate + strategy tab + virtualization]
- Description: `/schedule`에서 runId+strategy로 진입. 리워드 잠금(미해제 시 TossRewardAd 게이트), 전략 탭 전환(TabBar), 전략 error 상태 처리, 만료/누락 처리, 121행 이상이면 react-window 가상 스크롤 적용.
- DoD:
  - runId 누락:
    - `"스케줄을 열 수 없어요"` 표시
    - 월별 ListRow 0개
  - runId 존재 + `NOT_FOUND`:
    - `"결과가 만료되었어요"` 표시
    - `"시뮬레이션으로"` 버튼 탭 시 `navigate('/simulate')` 1회 호출
  - 선택 전략이 `status="error"`:
    - `"이 전략은 계산에 실패해서 스케줄을 만들 수 없어요"` 표시
    - 월별 ListRow 0개
  - 리워드 게이트:
    - `unlockedRunIds`에 runId가 없으면 스케줄 표 영역을 `<TossRewardAd>{children}</TossRewardAd>`로 감싼다.
    - **광고 완료 전** children 영역에서 월별 ListRow가 0개여야 한다.
    - TossRewardAd의 실제 “완료 콜백” prop/패턴은 템플릿 컴포넌트 구현(`src/components/TossRewardAd.tsx` 등)을 확인해 연결한다.
    - **광고 완료 후** `unlock(runId)`가 호출되고 `unlockedRunIds.includes(runId) === true`가 된다.
  - 전략 탭(TabBar):
    - Tab 전환 시 화면 상태 strategy가 변경된다.
    - 전환 직후 `navigate('/schedule', { state: { runId, strategy }, replace: true })`를 호출해 RouteState 계약을 유지한다.
  - 스케줄 생성:
    - unlocked 상태에서 `buildStrategySchedule({ run, strategy })` 결과 rows를 렌더링한다.
  - 가상 스크롤:
    - `rows.length >= 121`이면 `react-window`의 `FixedSizeList`가 렌더링된다.
    - 초기 렌더 직후 월별 행(ListRow) DOM 노드 수가 `<= 30`이다.
  - **RouteState 캐스팅**: `RouteState["/schedule"]`
- Covers:
  - AC-S5-1, AC-S5-2, AC-S5-3, AC-S5-4, AC-S5-5, AC-S5-6
- Files:
  - `src/pages/Schedule.tsx`
  - `package.json` (react-window 미설치 시 의존성 추가)
- Depends on: Task 3.2, Task 3.3, Task 4.4

### Task 5.6 [S6 SettingsPage: strategy explanation bottom sheet + no external links + toast on failure]
- Description: `/settings` 정적 도움말. 전략 설명 ListRow → BottomSheet. 외부 링크 호출 금지. 예외 시 Toast 노출.
- DoD:
  - 진입 시 Top 타이틀 `"설정"` + `"Snowball vs Avalanche"` ListRow 렌더
  - ListRow 탭 시 BottomSheet 오픈:
    - 제목 `"Snowball vs Avalanche"` 존재
    - 본문에 `"Snowball: 잔액이 작은 대출부터"` 포함
    - 본문에 `"Avalanche: 금리가 높은 대출부터"` 포함
  - 외부 링크 이동 코드 금지(패스/페일):
    - `Settings.tsx`에 `window.open` 호출 코드가 없다.
    - `Settings.tsx`에 `location.href =` 또는 `document.location.href =` 변경 코드가 없다.
  - BottomSheet 오픈 실패 처리:
    - 탭 핸들러를 try/catch로 감싸고, catch 시 Toast `"열 수 없어요. 다시 시도해주세요"` 표시
    - catch 이후에도 컴포넌트가 언마운트되지 않고 화면이 유지된다(에러 throw 금지)
  - **RouteState 캐스팅**: `RouteState["/settings"]`
- Covers:
  - AC-S6-1, AC-S6-2, AC-S6-3, AC-S6-4
- Files:
  - `src/pages/Settings.tsx`
- Depends on: Task 1.1

### Epic 5 Risk Analysis
- Complexity: Medium
- Risk factors:
  - RouteState 캐스팅 누락으로 state undefined 접근 크래시
  - TDS 여백을 커스텀 스타일로 덮어써 검수 반려
  - Schedule의 “게이트 + 가상스크롤” 결합에서 DOM 30개 이하 조건 위반 가능
- Mitigation:
  - 각 페이지 DoD에 RouteState 캐스팅을 필수로 명시
  - 간격은 Spacing만 사용(페이지 구현 시 금지사항 준수)
  - Schedule은 unlocked 이후에만 rows 렌더 → 121+에서 FixedSizeList로 제한

---

## Epic 6. Integration + polish (routing wiring, provider wiring)
### Task 6.1 [Router wiring + Provider wiring + build check]
- Description: React Router에 모든 라우트를 연결하고, `App` 루트에 Providers(Loans/Runs/RewardUnlocks)를 직접 감싼다. (템플릿 제공 AdSlot/TossRewardAd는 재설계하지 않음)
- DoD:
  - `react-router-dom` 라우팅이 아래 경로를 모두 렌더한다.
    - `/` → `HomePage`
    - `/loan/new` → `LoanFormPage`
    - `/loan/edit` → `LoanFormPage`
    - `/simulate` → `SimulatePage`
    - `/result` → `ResultPage`
    - `/schedule` → `SchedulePage`
    - `/settings` → `SettingsPage`
  - App 루트에서 아래 Provider가 적용되어, 각 페이지에서 훅 사용 시 Provider 미설정 에러가 발생하지 않는다.
    - `LoansProvider`
    - `RunsProvider`
    - `RewardUnlocksProvider`
  - 빌드:
    - `npm run build` 수행 시 TypeScript 에러 없이 빌드된다(프로젝트 표준 스크립트 기준)
- Covers:
  - (간접 전제) 모든 Screen AC 수행을 위한 라우팅/프로바이더 연결
- Files:
  - `src/App.tsx` (또는 템플릿의 라우팅 엔트리 파일)
- Depends on: Task 5.1 ~ Task 5.6

### Epic 6 Risk Analysis
- Complexity: Low
- Risk factors:
  - 라우트 누락으로 특정 화면 접근 불가
  - Provider 누락으로 런타임 크래시
- Mitigation:
  - 라우팅/Provider wiring을 마지막 1개 task로 묶고, 이전 task는 컴포넌트 단위로 컴파일되게 분리

---

## AC Coverage
- Total ACs in SPEC (visible in prompt): **56**
- Covered by tasks: **56**
  - AC-S1-1~5 → Task 5.1
  - AC-S2-1~5 → Task 5.2 (+ 저장/검증 근거 Task 2.1)
  - AC-S3-1~5 → Task 5.3 (+ 엔진/저장 근거 Task 4.3, Task 2.2)
  - AC-S4-1~5 → Task 5.4 (+ run 조회 근거 Task 2.2/3.2)
  - AC-S5-1~6 → Task 5.5 (+ unlock 저장 Task 2.3, schedule 생성 Task 4.4)
  - AC-S6-1~4 → Task 5.6
  - AC-ENG-1 → Task 4.1
  - AC-ENG-2 → Task 4.2
  - AC-ENG-3~4 → Task 4.1
  - AC-ENG-5 → Task 4.3
  - F1-AC-1~4,7,8 → Task 5.2 (+ storage Task 2.1)
  - F1-AC-5,6,9,10 → Task 5.1 (+ storage Task 2.1)
  - F2-AC-1~8 → Task 5.3 (+ runs storage Task 2.2, engine Task 4.3)
  - F3-AC-1~3 → Task 5.4
- Uncovered: **0**