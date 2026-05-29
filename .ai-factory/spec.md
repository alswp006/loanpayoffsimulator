# SPEC

## Common Principles

### 기술/플랫폼
- Frontend: **Vite + React + TypeScript**
- UI: **@toss/tds-mobile** 컴포넌트만 사용 (여백/간격은 **TDS Spacing**만 사용)
- Routing: **react-router-dom**
- Persistence: **localStorage** (총 5MB 이하)
- Ads:
  - 배너: 템플릿 제공 **`<AdSlot />`**
  - 리워드 광고 게이트: 템플릿 제공 **`<TossRewardAd>{children}</TossRewardAd>`**
- 외부 서버/백엔드: **없음(MVP)**

### 전략 비교(시뮬레이션) 공통 제약
- **전략 비교 시뮬레이션은 대출이 최소 2개 이상 있어야 실행 가능**하다.
  - 이 제약은 S1(홈)과 S3(시뮬레이션)에서 사용자에게 명시적으로 안내한다.
  - 2개 미만이면 시뮬레이션 실행 CTA는 비활성화 또는 미노출 처리한다(화면 정의/AC 참고).

### 계산/시뮬레이션 원칙(고정금리, 월 단위)
- 모든 대출은 “현재 잔액(principalRemaining)” 기준으로 상환을 시뮬레이션한다.
- 월 이자 = `현재잔액 * (연이율/100) / 12` (소수점은 원 단위 반올림: `Math.round`)
- 각 월의 납입은 다음 순서로 처리:
  1) 월 이자 발생(잔액 증가)
  2) 각 대출에 대해 최소 월납입액(monthlyPayment)을 납입 (단, 해당 월에 잔액+이자보다 큰 금액은 그만큼만 납입)
  3) **추가상환(extraMonthlyPayment)**은 전략에 의해 선택된 “타겟 대출”에 우선 납입
  4) 어떤 대출이 완납되면, 그 대출의 **최소 월납입액**은 다음 달부터 **추가상환 재원**으로 합산되어 남은 타겟 대출에 재배분
- 전략 정의:
  - Snowball(눈덩이): **잔액이 가장 작은 대출**부터 우선 상환
  - Avalanche(사태): **연이율이 가장 높은 대출**부터 우선 상환
- 종료 조건: 모든 대출 잔액이 0원이 되면 종료
- **하드 캡(무한 계산 방지)**:
  - `MAX_SIMULATION_MONTHS = 720`
  - `monthIndex`가 `720`에 도달했는데도 `totalRemainingBalance > 0`이면 시뮬레이션을 **오류로 종료**한다.
- 입력 유효성(핵심):
  - `principalRemaining >= 1`
  - `annualInterestRate`는 `0 <= rate <= 30`
  - `remainingMonths`는 `1 <= months <= 600`
  - `monthlyPayment >= 1`
  - **월납입액이 월이자보다 작아 “원금이 줄지 않는” 상태가 3개월 연속** 발생하면 시뮬레이션을 중단하고 오류로 처리한다(사용자 입력 수정 유도).
- **시뮬레이션 오류 코드(화면/로깅/테스트 계약)**:
  - `STALL_3_MONTHS`: 3개월 연속 원금이 줄지 않음
  - `MAX_MONTHS_REACHED`: `MAX_SIMULATION_MONTHS` 도달 시에도 완납 불가
- **전략별 오류 처리(부분 성공 허용)**:
  - Snowball/Avalanche는 **각각 독립적으로** `ok` 또는 `error`로 종료될 수 있다.
  - **둘 다 `error`** 인 경우: 실행을 실패로 처리하고 결과(run)를 저장/이동하지 않는다(F2 AC 참고).
  - **한쪽만 `error`** 인 경우: run을 저장하고 결과 화면(S4)에서 해당 전략을 오류 상태로 표시한다(F3/F4 AC 참고).

### 접근성/모바일 UX 원칙
- 모든 터치 타겟은 **최소 44px**(TDS Button/ListRow 기본 규격 사용으로 충족).
- 모든 입력 폼은 모바일 키보드에 대응:
  - 숫자 입력은 `inputMode="numeric"` 사용
  - 제출 시 `document.activeElement?.blur()`로 키보드 닫힘 유도
  - 폼 하단 버튼은 스크롤 영역 밖으로 밀리지 않도록 화면 구조를 구성(레이아웃만 커스텀 CSS 허용)

---

## 화면 정의(Screen Definitions) + 네비게이션 상태 계약(필수)

#### S1. 대출 목록/홈
- Route: `/`
- 목적: 저장된 대출 목록 조회, 새 대출 추가/수정/삭제 진입, 시뮬레이션 시작 진입
- TDS 컴포넌트:
  - `Top`, `ListRow`, `Button`, `Spacing`, `Paragraph.Text`, `Chip`, `Toast`, `AlertDialog`
  - 배너 광고: `AdSlot` (목록 하단 섹션 아래, 콘텐츠와 겹치지 않게)
- 상태:
  - Loading: localStorage hydrate 중 “불러오는 중” 텍스트 표시 + 버튼 비활성화
  - Empty: 저장된 대출 0개면 안내 문구 + “대출 추가” 버튼만 표시
  - **Guide(1개 보유)**: 저장된 대출이 1개면 안내 문구 `"대출을 1개 더 추가하면 전략 비교가 가능해요"` 표시 + “시뮬레이션 시작” 버튼 `disabled=true`
  - Error: localStorage 파싱 실패 시 AlertDialog(초기화 옵션 제공)
- 리스트 스크롤:
  - 대출 목록은 일반 스크롤(최대 수십 개 가정). 50개 초과 시에도 성능 이슈가 없도록 ListRow 단순 렌더.
  - **Pagination 계약**: 대출 목록은 localStorage 기반으로 **pagination을 적용하지 않는다**(전체 items를 한 번에 로드). 대신 저장 개수 상한을 둔다(하단 Data Models 참고).
- 터치 인터랙션:
  - 대출 항목 탭(>=44px): 수정 화면 진입
  - 삭제는 ListRow 내 보조 버튼(>=44px) → 확인 다이얼로그
- 시뮬레이션 CTA 규칙:
  - 저장된 대출 개수 `< 2`이면 “시뮬레이션 시작” 버튼은 `disabled=true` 또는 미노출(본 SPEC에서는 `disabled=true` 권장: 사용자 기대치 정렬).
- Navigation contract:
  - Outgoing:
    - “대출 추가” → `navigate('/loan/new')`
    - 대출 항목 탭 → `navigate('/loan/edit', { state: { loanId: string } })`
    - “시뮬레이션 시작” → `navigate('/simulate')`
  - Incoming:
    - 없음

#### S2. 대출 추가/수정 폼
- Route: `/loan/new`, `/loan/edit`
- 목적: 대출 1건 생성/수정
- TDS 컴포넌트:
  - `Top`, `TextField`, `Button`, `Spacing`, `Paragraph.Text`, `Toast`, `AlertDialog`
- 화면 내 가이드:
  - 상단(Top 아래)에 `Paragraph.Text`로 `"대출을 2개 이상 추가하면 Snowball/Avalanche 전략 비교가 가능해요"`를 표시한다.
- 상태:
  - Loading: `/loan/edit`에서 loanId로 로드 전 “불러오는 중” 텍스트 + 저장 버튼 비활성화
  - Error: loanId가 없거나 미존재 시 AlertDialog → “확인” 탭 시 `/`로 이동
- 모바일 키보드:
  - 금액/금리/개월 수/월납입액: `inputMode="numeric"`
  - 저장 탭 시 blur로 키보드 닫기
- Navigation contract:
  - Outgoing:
    - “저장” 성공 → `navigate('/', { state: { highlightLoanId: string } })`
    - “취소/뒤로” → `navigate(-1)`
  - Incoming:
    - `/loan/edit`에서 `location.state = { loanId: string }`

#### S3. 시뮬레이션 설정
- Route: `/simulate`
- 목적: 추가상환 금액 입력, 전략 비교 실행
- **대출 선택(범위) 계약(MVP 고정)**:
  - MVP에서는 대출 선택 UI를 제공하지 않는다.
  - **항상 현재 저장된 전체 대출(`lps_loans_v1.items`)을 대상으로 시뮬레이션**한다.
  - 따라서 `SimulationInput.loanIds`는 실행 시점의 전체 대출 id 배열로 저장된다(정렬은 저장된 items 순서 유지).
- TDS 컴포넌트:
  - `Top`, `TextField`, `Button`, `Spacing`, `Paragraph.Text`, `Chip`, `Toast`, `AlertDialog`
- 상태:
  - Empty: 저장된 대출이 2개 미만이면 안내 + “대출 추가하러 가기” 버튼
  - Loading: “계산 중” 표시(실행 버튼 disabled)
  - Error: 입력 오류(예: extra < 0) 시 필드 하단 오류 문구
- Navigation contract:
  - Outgoing:
    - “비교 결과 보기” 성공 → `navigate('/result', { state: { runId: string } })`
  - Incoming:
    - 없음

#### S4. 결과 요약(전략 비교)
- Route: `/result`
- 목적: Snowball vs Avalanche 총이자/상환기간/절감액 비교 + 월별 타임라인(요약) + 상세 스케줄 진입
- TDS 컴포넌트:
  - `Top`, `Paragraph.Text`, `ListRow`, `Button`, `Spacing`, `Chip`, `Toast`, `BottomSheet`
  - 배너 광고: `AdSlot` (요약 카드 섹션과 상세 버튼 섹션 사이)
- 상태:
  - Loading: runId로 결과 로드 전 “불러오는 중” + 버튼 비활성화
  - Error: runId 누락/미존재 시 안내 + “시뮬레이션으로” 버튼
  - **Expired**: runId가 있었으나 저장소에서 조회되지 않는 경우(예: 20개 초과 유지 정책으로 **eviction**되어 삭제됨) `"결과가 만료되었어요"` 문구를 추가로 표시하고 “시뮬레이션으로” CTA를 제공한다(아래 AC 참고).
- 전략별 오류 렌더링:
  - `summaries[strategy].status === 'error'`인 전략은:
    - 해당 전략 카드/행에 `"계산 실패"` 라벨과 `errorCode`에 따른 설명 문구를 표시한다.
    - 해당 전략으로 “상세 스케줄 보기” 진입은 비활성화하거나, 진입 시 S5에서 에러 상태로 처리한다(MVP 권장: 결과 화면에서 버튼 비활성화).
- Navigation contract:
  - Incoming:
    - `location.state = { runId: string }`
  - Outgoing:
    - “상세 스케줄 보기” → `navigate('/schedule', { state: { runId: string, strategy: 'snowball' | 'avalanche' } })`
    - “결과 복사” → 현재 화면 내 클립보드 복사(라우팅 없음)

#### S5. 전략별 상세 스케줄(리워드 광고 게이트)
- Route: `/schedule`
- 목적: 월별 상환 스케줄 표(잠금 해제), 전략 토글
- TDS 컴포넌트:
  - `Top`, `TabBar`(전략 전환), `ListRow`(행 렌더), `Spacing`, `Paragraph.Text`, `Button`, `Toast`
  - 리워드 게이트: `TossRewardAd`로 스케줄 표 영역을 감싼다.
- 상태:
  - Loading: runId 로드/스케줄 생성 중 “불러오는 중”
  - Empty: 스케줄 행 0개면 “표시할 데이터가 없어요”
  - Error: runId 누락/미존재 시 안내 + “결과로 돌아가기”
  - **Expired**: runId가 있었으나 저장소에서 조회되지 않는 경우(예: eviction) `"결과가 만료되었어요"` 문구를 추가로 표시하고 “시뮬레이션으로” CTA를 제공한다.
  - **StrategyError**: 선택된 `strategy`의 `StrategySummary.status === 'error'`이면 스케줄 표 대신 오류 안내를 표시한다(AC 참고).
- 리스트 스크롤(긴 리스트):
  - 월별 행이 **120개 초과**면 **가상 스크롤(react-window FixedSizeList)** 사용
- Navigation contract:
  - Incoming:
    - `location.state = { runId: string, strategy: 'snowball' | 'avalanche' }`
  - Outgoing:
    - 뒤로 → `navigate(-1)`

#### S6. 설정/도움말
- Route: `/settings`
- 목적: 전략 설명, 입력 가이드, 정책 고지(외부 링크 제한 준수)
- TDS 컴포넌트:
  - `Top`, `ListRow`, `Paragraph.Text`, `Spacing`, `BottomSheet`
- 상태:
  - Loading 없음(정적)
  - Error 없음(정적)
- Navigation contract:
  - Outgoing: 없음(내부 BottomSheet만)
  - Incoming: 없음

---

## Acceptance Criteria (Screens + Simulation Engine)

> 형식: EARS (`WHEN/WHILE/IF … THEN …`) + **구체적 pass/fail 조건**  
> 각 화면/엔진별 **최소 4개**, 그중 **최소 2개는 실패/에러 경로 AC**를 포함한다.

### S1. 대출 목록/홈 — AC
- AC-S1-1 [S][P0] (State-driven): **WHILE** localStorage hydrate가 완료되지 않았으면 **THEN** `"불러오는 중"` 텍스트가 표시되고 주요 버튼은 비활성화된다
  - Pass: `"불러오는 중"` 텍스트가 DOM에 존재한다
  - Pass: `"대출 추가"` Button에 `disabled=true` 속성이 존재한다
  - Pass: `"시뮬레이션 시작"` Button이 렌더링되면 `disabled=true` 속성이 존재한다
- AC-S1-2 [S][P0] (State-driven): **WHEN** 저장된 대출이 0개이면 **THEN** Empty 상태 UI만 표시된다
  - Pass: `"대출 추가"` Button이 표시된다
  - Pass: 대출 ListRow(대출명 표시 텍스트 포함)가 0개 렌더링된다
- AC-S1-3 [W][P0] (Unwanted): **IF** `items.length < 2`이면 **THEN** `"시뮬레이션 시작"` 버튼은 `disabled=true`이다
  - Pass: `items.length === 1`일 때 `"시뮬레이션 시작"` Button에 `disabled=true` 속성이 존재한다
  - Pass: 안내 문구 `"대출을 1개 더 추가하면 전략 비교가 가능해요"`가 표시된다
- AC-S1-4 [W][P0] (Unwanted): **IF** `lps_loans_v1` JSON 파싱이 실패하면 **THEN** AlertDialog가 표시되고 “초기화” 실행 시 스토리지가 재설정된다
  - Pass: AlertDialog 제목이 `"데이터를 불러올 수 없어요"`로 표시된다
  - Pass: `"초기화"` 탭 후 localStorage `lps_loans_v1` 값이 `{"version":1,"items":[]}`와 구조적으로 동일하다(문자열 비교가 아닌 JSON 파싱 후 비교)
- AC-S1-5 [E][P1] (Event-driven): **WHEN** 사용자가 대출 ListRow를 탭하면 **THEN** `/loan/edit`로 이동하며 `location.state.loanId`가 설정된다
  - Pass: `navigate('/loan/edit', { state: { loanId } })`가 1회 호출된다

### S2. 대출 추가/수정 폼 — AC
- AC-S2-1 [E][P0] (Event-driven): **WHEN** 사용자가 유효한 값을 입력하고 `"저장"`을 탭하면 **THEN** `lps_loans_v1.items`에 동일 `id` 기준으로 upsert된다
  - Pass: `/loan/new`에서는 저장 후 `items.length`가 +1 된다
  - Pass: `/loan/edit`에서는 저장 후 `items.length`가 변하지 않는다
  - Pass: 저장 후 `navigate('/', { state: { highlightLoanId: string } })`가 호출된다
- AC-S2-2 [W][P0] (Unwanted): **IF** `/loan/edit`에 진입했으나 `location.state.loanId`가 없으면 **THEN** AlertDialog가 표시되고 `"확인"` 탭 시 `/`로 이동한다
  - Pass: AlertDialog가 렌더링된다
  - Pass: `"확인"` 탭 후 `navigate('/')`가 1회 호출된다
- AC-S2-3 [W][P0] (Unwanted): **IF** `loanId`가 있으나 저장소에 존재하지 않으면 **THEN** AlertDialog가 표시되고 편집 폼은 렌더링되지 않는다
  - Pass: 입력 필드(TextField)가 0개이거나 `disabled=true` 상태로만 존재한다(둘 중 하나를 구현 시 고정)
- AC-S2-4 [S][P1] (State-driven): **WHILE** 편집 대상 로딩 중이면 **THEN** `"불러오는 중"` 텍스트가 표시되고 `"저장"` 버튼은 `disabled=true`이다
  - Pass: `"저장"` Button에 `disabled=true` 속성이 존재한다
- AC-S2-5 [W][P1] (Unwanted): **IF** 숫자 필드가 유효 범위를 벗어나면 **THEN** 저장은 수행되지 않고 해당 필드 하단 오류 문구가 표시된다
  - Pass: 예) `annualInterestRate=30.1`에서 저장 탭 시 `lps_loans_v1.items`가 변경되지 않는다
  - Pass: 예) 오류 문구 `"연이율은 0%~30% 사이여야 해요"`가 DOM에 존재한다

### S3. 시뮬레이션 설정 — AC
- AC-S3-1 [S][P0] (State-driven): **WHEN** 저장된 대출이 2개 미만이면 **THEN** 실행 CTA는 비활성화 또는 미노출이다(본 SPEC: 비활성화 권장)
  - Pass: `items.length === 1`일 때 `"비교 결과 보기"` 버튼이 렌더링되면 `disabled=true` 속성이 존재한다  
  - Pass(대안 구현 시): `"비교 결과 보기"` 버튼이 DOM에 존재하지 않는다
- AC-S3-2 [E][P0] (Event-driven): **WHEN** 유효 입력으로 실행을 탭하면 **THEN** `SimulationInput.loanIds`는 실행 시점 `lps_loans_v1.items`의 순서를 그대로 저장한다
  - Pass: 예) items가 `[a,b,c]`이면 run.input.loanIds가 정확히 `["a","b","c"]`이다
- AC-S3-3 [W][P0] (Unwanted): **IF** `extraMonthlyPayment < 0`이면 **THEN** 실행은 거부되고 run은 저장되지 않는다
  - Pass: `lps_runs_v1.items.length`가 실행 전후 동일하다
  - Pass: TextField 하단 오류 문구가 DOM에 존재한다
- AC-S3-4 [S][P1] (State-driven): **WHILE** 계산 중이면 **THEN** 로딩 텍스트가 표시되고 실행 버튼은 `disabled=true`이다
  - Pass: `"계산 중"` 텍스트가 DOM에 존재한다
  - Pass: `"비교 결과 보기"` Button의 `disabled=true`가 존재한다
- AC-S3-5 [W][P1] (Unwanted): **IF** 양 전략이 모두 `error`로 종료되면 **THEN** `/result`로 이동하지 않는다
  - Pass: `navigate('/result', ...)`가 호출되지 않는다
  - Pass: AlertDialog가 표시되고 본문에 `STALL_3_MONTHS` 또는 `MAX_MONTHS_REACHED` 케이스 고정 문구 중 하나가 포함된다

### S4. 결과 요약 — AC
- AC-S4-1 [E][P0] (Event-driven): **WHEN** `runId`로 run 조회가 성공하면 **THEN** 두 전략 요약(총이자/개월수)과 절감액 문구가 표시된다
  - Pass: `summaries.snowball.totalInterestPaid` 및 `summaries.avalanche.totalInterestPaid`가 각각 통화 포맷으로 표시된다(예: `2,100,000원`)
  - Pass: 절감액 문구에 `Math.abs(diff)` 값이 포함된다
- AC-S4-2 [W][P0] (Unwanted): **IF** `location.state.runId`가 누락되면 **THEN** `"결과를 찾을 수 없어요"`가 표시되고 `"시뮬레이션으로"` 버튼 탭 시 `/simulate`로 이동한다
  - Pass: `"시뮬레이션으로"` Button 탭 후 `navigate('/simulate')` 1회 호출
- AC-S4-3 [W][P0] (Unwanted): **IF** `runId`가 존재하나 저장소 조회 결과가 `NOT_FOUND`이면 **THEN** Expired 문구 `"결과가 만료되었어요"`가 추가로 표시된다
  - Pass: `"결과를 찾을 수 없어요"` + `"결과가 만료되었어요"` 두 문구가 모두 DOM에 존재한다
- AC-S4-4 [W][P1] (Unwanted): **IF** 특정 전략이 `status="error"`이면 **THEN** 해당 전략의 “상세 스케줄 보기”는 비활성화된다
  - Pass: 해당 전략 버튼이 렌더링되면 `disabled=true` 속성이 존재한다
- AC-S4-5 [E][P1] (Event-driven): **WHEN** 결과 화면이 정상 렌더링되면 **THEN** `AdSlot`은 “요약 섹션”과 “상세 버튼 섹션” 사이에 1회 렌더링된다
  - Pass: `AdSlot` 컴포넌트가 DOM 트리 상에서 요약 섹션 이후, 상세 버튼 섹션 이전에 존재한다(테스트에서 컨테이너 순서로 판정)

### S5. 상세 스케줄 — AC
- AC-S5-1 [E][P0] (Event-driven): **WHEN** 잠금 해제되지 않은 runId로 진입하면 **THEN** `TossRewardAd` 게이트 내부 콘텐츠(스케줄 표)는 “광고 완료 전”에는 렌더링되지 않는다
  - Pass: 광고 완료 전 `ListRow`(월별 행)가 0개 렌더링된다
- AC-S5-2 [E][P0] (Event-driven): **WHEN** 광고 “시청 완료” 이벤트가 발생하면 **THEN** 스케줄 표가 렌더링되고 `lps_reward_unlocks_v1.unlockedRunIds`에 runId가 저장된다
  - Pass: `unlockedRunIds.includes(runId) === true`
  - Pass: 월별 행(ListRow)이 1개 이상 렌더링된다
- AC-S5-3 [W][P0] (Unwanted): **IF** `runId`가 누락되면 **THEN** `"스케줄을 열 수 없어요"`가 표시되고 스케줄 표는 렌더링되지 않는다
  - Pass: `"스케줄을 열 수 없어요"` 존재
  - Pass: 월별 ListRow 0개
- AC-S5-4 [W][P0] (Unwanted): **IF** `runId`가 조회되지 않으면 **THEN** Expired 문구 `"결과가 만료되었어요"`가 표시되고 `"시뮬레이션으로"` 버튼이 렌더링된다
  - Pass: `"시뮬레이션으로"` 버튼 탭 시 `navigate('/simulate')` 1회 호출
- AC-S5-5 [W][P1] (Unwanted): **IF** 선택 전략이 `status="error"`이면 **THEN** 스케줄 표 대신 오류 문구가 표시된다
  - Pass: 월별 ListRow 0개
  - Pass: `"이 전략은 계산에 실패해서 스케줄을 만들 수 없어요"` 문구 존재
- AC-S5-6 [E][P1] (Event-driven): **WHEN** 스케줄 행이 121개 이상이면 **THEN** `FixedSizeList`를 사용하고 초기 DOM 행 수는 30개 이하이다
  - Pass: `FixedSizeList` 컴포넌트가 렌더링된다
  - Pass: 초기 렌더 직후 월별 행(ListRow) DOM 노드 수 `<= 30`

### S6. 설정/도움말 — AC
- AC-S6-1 [E][P1] (Event-driven): **WHEN** 사용자가 설정 화면에 진입하면 **THEN** Top 타이틀과 전략 설명 진입 ListRow가 표시된다
  - Pass: `"설정"`(또는 지정 타이틀) 텍스트가 Top 영역에 존재한다
  - Pass: `"Snowball vs Avalanche"` 설명을 여는 ListRow가 존재한다
- AC-S6-2 [E][P1] (Event-driven): **WHEN** 사용자가 전략 설명 ListRow를 탭하면 **THEN** BottomSheet가 열리고 두 전략 설명 텍스트가 모두 표시된다
  - Pass: BottomSheet 제목 `"Snowball vs Avalanche"` 존재
  - Pass: 본문에 `"Snowball: 잔액이 작은 대출부터"` 텍스트 존재
  - Pass: 본문에 `"Avalanche: 금리가 높은 대출부터"` 텍스트 존재
- AC-S6-3 [W][P1] (Unwanted): **IF** 설정 화면에서 외부 링크 이동 코드(`window.open`/`location.href`)가 호출되려고 하면 **THEN** 해당 호출은 실행되지 않는다
  - Pass: 테스트 더블에서 `window.open` 호출 횟수 `0`
  - Pass: 테스트 더블에서 `location.href` 변경 `0`
- AC-S6-4 [W][P2] (Unwanted): **IF** BottomSheet가 열리지 않는 예외가 발생하면 **THEN** 화면은 크래시 없이 유지되며 Toast로 오류를 표시한다
  - Pass: React error boundary(또는 try/catch) 처리 후 화면이 언마운트되지 않는다
  - Pass: Toast `"열 수 없어요. 다시 시도해주세요"`(고정 문구) 표시

### Simulation Engine (계산/스케줄 생성) — AC
- AC-ENG-1 [E][P0] (Event-driven): **WHEN** 월 이자를 계산하면 **THEN** `Math.round(principal * rate/100 / 12)` 규칙으로 원 단위 반올림된 정수로 산출된다
  - Pass: 반환값이 `Number.isInteger(value) === true`
- AC-ENG-2 [E][P0] (Event-driven): **WHEN** 어떤 대출이 완납되면 **THEN** 해당 대출의 `monthlyPayment`는 다음 달부터 추가상환 재원으로 합산된다
  - Pass: 완납된 다음 month의 `totalPayment`가 이전 month 대비 (다른 조건 동일 시) 감소하지 않고 동일 또는 증가한다(테스트 입력 고정)
- AC-ENG-3 [W][P0] (Unwanted): **IF** 3개월 연속 원금이 줄지 않으면 **THEN** 해당 전략은 `status="error"` 및 `errorCode="STALL_3_MONTHS"`로 종료한다
  - Pass: 반환 summary.status가 `"error"`
  - Pass: summary.errorCode가 `"STALL_3_MONTHS"`
- AC-ENG-4 [W][P0] (Unwanted): **IF** `MAX_SIMULATION_MONTHS(720)`에 도달했는데 `totalRemainingBalance > 0`이면 **THEN** `errorCode="MAX_MONTHS_REACHED"`로 종료한다
  - Pass: `monthsSimulated === 720`
  - Pass: summary.errorCode가 `"MAX_MONTHS_REACHED"`
- AC-ENG-5 [E][P1] (Event-driven): **WHEN** 전략별로 독립 실행하면 **THEN** 한쪽이 error여도 다른 한쪽 결과는 유지되며, run 저장 판단은 “둘 다 error인지 여부”로 결정된다
  - Pass: `snowball.status="error"`, `avalanche.status="ok"`인 케이스에서 run 저장이 수행된다
  - Pass: `snowball.status="error"`, `avalanche.status="error"`인 케이스에서 run 저장이 수행되지 않는다

---

## Data Models

### Loan — 대출 1건
```ts
export interface Loan {
  id: string; // uuid
  name: string; // 1~30자
  principalRemaining: number; // 원 단위, 1~2_000_000_000
  annualInterestRate: number; // 0~30 (percent)
  remainingMonths: number; // 1~600
  monthlyPayment: number; // 원 단위, 1~50_000_000
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```
- localStorage
  - Key: `lps_loans_v1`
  - Shape:
    ```ts
    export interface LoansStorageV1 {
      version: 1;
      items: Loan[];
    }
    ```
- **List/Pagination 계약**
  - `items`는 **pagination 없이 전체를 한 번에 로드**하여 UI에 전달한다.
  - 저장 상한: `items.length <= 200` (pagination 미적용을 전제로 한 성능/5MB 예산 안전장치)
- Size estimation:
  - Loan 1건 ~ 250B~500B(문자열 포함) 추정
  - 200건 저장 시 ~100KB 수준

### SimulationRun — 1회 시뮬레이션 결과(요약+참조)
```ts
export type StrategyType = 'snowball' | 'avalanche';

export interface SimulationInput {
  /**
   * MVP 계약: 항상 "실행 시점에 저장된 전체 대출"의 id 목록을 저장한다.
   * - 대출 선택 UI 없음
   * - 정렬은 실행 시점 loanSnapshot 배열 순서를 따른다.
   */
  loanIds: string[];
  extraMonthlyPayment: number; // 원/월, 0~50_000_000
}

export type SimulationErrorCode = 'STALL_3_MONTHS' | 'MAX_MONTHS_REACHED';

export interface StrategySummary {
  strategy: StrategyType;

  /**
   * 전략별 실행 상태
   * - ok: 정상 완납까지 계산됨
   * - error: 오류로 중단됨(아래 errorCode로 원인 식별)
   */
  status: 'ok' | 'error';
  errorCode?: SimulationErrorCode;

  /**
   * 누적 합계(단위: 원)
   * - totalPrincipalPaid: 원금 상환 총합(>=0)
   * - totalInterestPaid: 이자 납입 총합(>=0)
   * - totalPaid: totalPrincipalPaid + totalInterestPaid (>=0)
   *
   * 제약:
   * - status='ok'인 경우에도 모두 정수(원 단위)로 저장한다.
   * - status='error'인 경우에도 "오류가 발생하기 전까지" 누적된 값을 저장한다(디버그/표시용).
   */
  totalInterestPaid: number; // 원, integer, >= 0
  totalPrincipalPaid: number; // 원, integer, >= 0
  totalPaid: number; // 원, integer, >= 0

  /**
   * 총 상환 기간(단위: 개월)
   * - monthsToPayoff: 완납까지 걸린 개월 수
   * - totalMonths: monthsToPayoff와 동일 의미(명시적 필드; S4/S5 검증/표기용)
   *
   * status === 'ok'인 경우에만 의미가 있다.
   * status === 'error'인 경우 monthsToPayoff/totalMonths/payoffDateISO는 0/0/""로 저장한다(명시적).
   */
  monthsToPayoff: number; // integer, 0~720
  totalMonths: number; // integer, 0~720
  payoffDateISO: string; // ISO (YYYY-MM-DD 권장) or "" when error

  /**
   * 비교 표시용(단위: 원/월)
   * - monthlySavingsVsOtherByInterest:
   *   두 전략 중 "총이자가 더 큰 전략"을 기준으로 월평균 이자 절감액을 저장한다.
   *   = abs(interestDiff) / max(1, min(monthsToPayoff_of_both_ok, 720))
   *
   * 제약:
   * - 둘 중 하나라도 status='error'면 0으로 저장한다(비교 의미 없음).
   * - 원 단위 반올림(Math.round)된 정수로 저장한다.
   */
  monthlySavingsVsOtherByInterest: number; // 원/월, integer, >= 0
}

export interface SimulationRunComparison {
  /**
   * interestDiff = snowball.totalInterestPaid - avalanche.totalInterestPaid
   * - 양수면 Avalanche가 이자를 덜 냄
   * - 음수면 Snowball이 이자를 덜 냄
   * - 0이면 동일
   *
   * 제약:
   * - 둘 중 하나라도 status='error'이면 0으로 저장한다.
   */
  interestDiff: number; // 원, integer

  /**
   * monthsDiff = snowball.monthsToPayoff - avalanche.monthsToPayoff
   * - 양수면 Avalanche가 더 빨리 끝남
   * - 음수면 Snowball이 더 빨리 끝남
   * - 0이면 동일
   *
   * 제약:
   * - 둘 중 하나라도 status='error'이면 0으로 저장한다.
   */
  monthsDiff: number; // 개월, integer

  /**
   * winnerByInterest:
   * - 'snowball' | 'avalanche' | 'tie'
   * 제약:
   * - 둘 중 하나라도 status='error'이면 'tie'로 저장한다.
   */
  winnerByInterest: StrategyType | 'tie';
}

export interface SimulationRun {
  runId: string; // uuid
  createdAt: string; // ISO
  input: SimulationInput;

  /**
   * 실행 시점 스냅샷(결과 재현용)
   * - loanSnapshot은 "deep copy"로 저장한다.
   * - 이후 Loan가 수정/삭제되어도, 기존 SimulationRun의 loanSnapshot 및 결과는 변하지 않는다(오브젝트 참조 공유 금지).
   */
  loanSnapshot: Loan[];

  summaries: Record<StrategyType, StrategySummary>;

  /**
   * 화면(S4)에서 절감액/우승 전략 표시를 안정적으로 검증하기 위한 비교 필드(저장형).
   */
  comparison: SimulationRunComparison;
}
```
- **관계/삭제(캐스케이드) 규칙**
  - `Loan` 삭제는 기존 `SimulationRun`에 **영향이 없다**(캐스케이드 없음, orphan 스냅샷 허용).
  - `SimulationRun`은 실행 시점의 `loanSnapshot`만으로 결과를 재계산/표시할 수 있어야 한다.
  - S4/S5는 “live Loan 재조회”가 아니라 **run의 snapshot 및 저장된 summaries/comparison**만으로 렌더링할 수 있어야 한다.
- localStorage
  - Key: `lps_runs_v1`
  - Shape:
    ```ts
    export interface RunsStorageV1 {
      version: 1;
      items: SimulationRun[]; // maxItems: 20 (초과 시 FIFO로 오래된 것 삭제)
    }
    ```
- **최근 20개 유지(eviction) 타이밍/계약**
  - `maxItems = 20`
  - eviction rule: **FIFO** (가장 오래된 run부터 삭제)
  - eviction은 `saveSimulationRun()` 호출 시점에 **동기적으로** 수행한다.
    - (1) 기존 items를 로드 → (2) 새 run을 맨 앞에 추가 → (3) 길이가 20 초과면 뒤에서부터 제거 → (4) 최종 items를 localStorage에 setItem
  - 앱 초기화/조회(read) 시에는 eviction을 수행하지 않는다(저장 시에만 발생).
  - eviction으로 삭제된 runId를 사용자가 뒤로가기/재진입 등으로 열려고 하면 S4/S5는 **Expired 상태**로 처리한다(화면 정의/AC 참고).
- Size estimation:
  - run 1개에 loanSnapshot 포함(예: 5개) 시 ~2KB~6KB
  - 20개 유지 시 ~40KB~120KB

### PaymentScheduleRow — 상세 스케줄 표 1행(런타임 생성, 저장 최소화)
```ts
export interface PerLoanScheduleBreakdown {
  loanId: string;
  paymentTotal: number; // 해당 월 이 loan에 납입한 총액(원) = interestPaid + principalPaid, integer, >= 0
  interestPaid: number; // 해당 월 이 loan의 이자 납입(원), integer, >= 0
  principalPaid: number; // 해당 월 이 loan의 원금 납입(원), integer, >= 0
  remainingBalance: number; // 월 말 기준 이 loan의 잔액(원), integer, >= 0
}

export interface PaymentScheduleRow {
  monthIndex: number; // 1부터, integer, 1~720
  totalPayment: number; // 해당 월 총 납입(원), integer, >= 0
  totalInterest: number; // 해당 월 총 이자(원), integer, >= 0
  totalRemainingBalance: number; // 월 말 기준 전체 잔액 합(원), integer, >= 0

  focusedLoanId: string; // 해당 월 타겟 대출 id (loanSnapshot 내 id 중 하나)

  /**
   * 대출별 breakdown (표에서 "총합 + 대출별 분해" 표시/검증 가능)
   * - loanSnapshot에 포함된 loanId만 포함한다.
   * - 배열 길이는 해당 run의 loanSnapshot 길이와 동일해야 한다.
   */
  perLoan: PerLoanScheduleBreakdown[];
}

/**
 * MonthlyScheduleRow / schedule payload type (명시적 공개 타입)
 * - 본 SPEC에서 "월별 스케줄 행"은 MonthlyScheduleRow == PaymentScheduleRow로 정의한다.
 */
export type MonthlyScheduleRow = PaymentScheduleRow;

export interface StrategySchedulePayload {
  runId: string; // uuid
  strategy: StrategyType;
  rows: MonthlyScheduleRow[]; // length: 0~720

  /**
   * schedule 생성 검증용 totals (S5 합계 노출/테스트용)
   */
  totals: {
    totalInterestPaid: number; // 원, integer, >= 0 (rows 합계와 동일)
    totalPrincipalPaid: number; // 원, integer, >= 0 (rows 합계와 동일)
    totalPaid: number; // 원, integer, >= 0
    months: number; // 개월, integer, 0~720 (rows.length와 동일)
  };
}
```
- **저장하지 않음**(runId + strategy로 필요 시 재계산)
- **런타임 생성/폐기 계약(명시)**
  - `PaymentScheduleRow[]`는 S5에서 `/schedule` 진입 후 **마운트 시점에** `SimulationRun.loanSnapshot` + `SimulationRun.input.extraMonthlyPayment` + `strategy`로부터 **매번 재계산(recompute)** 한다.
  - `PaymentScheduleRow[]`는 localStorage에 **절대 저장하지 않는다**.
  - S5 언마운트 시 `PaymentScheduleRow[]`는 메모리에서 폐기(discard)된다.
- Size estimation: 저장 안 함으로 5MB 제한 리스크 감소

### RewardUnlocks — 리워드 광고로 잠금 해제된 runId 목록
```ts
export interface RewardUnlocksV1 {
  version: 1;
  unlockedRunIds: string[]; // 최대 50개 유지(초과 시 오래된 것 삭제)
}
```
- localStorage
  - Key: `lps_reward_unlocks_v1`
- Size estimation: runId 36자 기준 50개 ~ 2KB 내외

### AppSettings — 앱 설정/검수 관련 플래그
```ts
export interface AppSettingsV1 {
  version: 1;
  hasDismissedExternalLinkPolicySheet: boolean; // 기본 false
}
```
- localStorage
  - Key: `lps_settings_v1`
- Size estimation: 수십 바이트

---

## Storage Service API (localStorage Internal API)

> MVP는 백엔드가 없으므로, 본 섹션은 앱 내부 “스토리지 서비스 레이어”의 **API 계약(typed function signature + 에러 코드)** 이다.  
> “method/path” 요구 충족을 위해 각 함수에 대응하는 **Equivalent Method/Path**를 함께 명시한다.

### 공통 타입
```ts
export type StorageErrorCode =
  | 'QUOTA_EXCEEDED'   // localStorage 용량 초과(QuotaExceededError)
  | 'PARSE_ERROR'      // JSON.parse 실패 또는 스키마 불일치로 복구 불가
  | 'NOT_FOUND'        // id로 조회했으나 없음
  | 'VALIDATION_ERROR' // 입력값 유효성 실패(서비스 레이어에서 검증하는 경우)
  | 'UNKNOWN_ERROR';   // 그 외 예외

export type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type VoidResult<E extends string> = Result<null, E>;
```

### Loans Storage API
- Key: `lps_loans_v1`

```ts
// Equivalent: GET /storage/loans
export function getLoans(): Result<Loan[], 'PARSE_ERROR'>;

// Equivalent: GET /storage/loans/:loanId
export function getLoanById(loanId: string): Result<Loan, 'PARSE_ERROR' | 'NOT_FOUND'>;

// Equivalent: POST /storage/loans  (생성)
export function createLoan(
  input: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>
): Result<Loan, 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;

// Equivalent: PUT /storage/loans/:loanId (수정)
export function updateLoan(
  loanId: string,
  patch: Partial<Pick<Loan, 'name' | 'principalRemaining' | 'annualInterestRate' | 'remainingMonths' | 'monthlyPayment'>>
): Result<Loan, 'PARSE_ERROR' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;

// Equivalent: DELETE /storage/loans/:loanId
export function deleteLoan(
  loanId: string
): VoidResult<'PARSE_ERROR' | 'NOT_FOUND' | 'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;

// Equivalent: POST /storage/loans/reset
export function resetLoans(): VoidResult<'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;
```

**에러 조건(구체)**
- `PARSE_ERROR`: localStorage 값이 존재하나 `JSON.parse` 실패 또는 `{version:1, items: Loan[]}` 스키마가 아니면 반환
- `VALIDATION_ERROR`: 입력값이 Data Models 제약을 위반하면 반환(예: name 길이 0, principalRemaining < 1, rate > 30 등)
- `NOT_FOUND`: `loanId`로 탐색했으나 items에 없으면 반환
- `QUOTA_EXCEEDED`: `setItem`에서 `QuotaExceededError` throw 시 반환

### Runs Storage API
- Key: `lps_runs_v1`
- Max items: `20` (FIFO eviction)

```ts
// Equivalent: GET /storage/runs
export function getSimulationRuns(): Result<SimulationRun[], 'PARSE_ERROR'>;

// Equivalent: GET /storage/runs/:runId
export function getSimulationRunById(runId: string): Result<SimulationRun, 'PARSE_ERROR' | 'NOT_FOUND'>;

// Equivalent: POST /storage/runs
// - 저장 시점에 FIFO eviction 적용(max 20)
export function saveSimulationRun(
  run: SimulationRun
): Result<SimulationRun, 'PARSE_ERROR' | 'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;

// Equivalent: DELETE /storage/runs/:runId
export function deleteSimulationRun(
  runId: string
): VoidResult<'PARSE_ERROR' | 'NOT_FOUND' | 'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;

// Equivalent: POST /storage/runs/reset
export function resetSimulationRuns(): VoidResult<'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;
```

**에러 조건(구체)**
- `PARSE_ERROR`: localStorage 값 파싱 실패 또는 `{version:1, items: SimulationRun[]}`가 아니면 반환
- `NOT_FOUND`: id 조회/삭제 시 존재하지 않으면 반환
- `QUOTA_EXCEEDED`: 저장/삭제 후 setItem에서 quota 에러 발생 시 반환

### Reward Unlocks Storage API
- Key: `lps_reward_unlocks_v1`
- Max items: `50` (FIFO eviction)

```ts
// Equivalent: GET /storage/reward-unlocks
export function getRewardUnlocks(): Result<RewardUnlocksV1, 'PARSE_ERROR'>;

// Equivalent: POST /storage/reward-unlocks/:runId
// - 중복 금지
// - 길이 50 초과 시 FIFO로 오래된 것 제거
export function unlockRunId(
  runId: string,
  options?: { ensureRunExists?: boolean } // default true
): VoidResult<'PARSE_ERROR' | 'NOT_FOUND' | 'QUOTA_EXCEEDED' | 'UNKNOWN_ERROR'>;
```

---

## Feature List

### F1. 대출 항목 CRUD(추가/수정/삭제) + 입력 검증
- Description: 사용자는 대출 이름, 잔액, 연이율, 잔여개월, 월납입액을 입력해 여러 대출을 저장할 수 있다. 저장된 대출은 목록에서 조회되며 탭하여 수정할 수 있고, 삭제 확인 후 제거할 수 있다.
- Data: `Loan`, `LoansStorageV1`
- API: N/A
- Requirements:

- AC-1 [E][P0] (Event-driven): **WHEN** 사용자가 유효한 신규 대출을 저장하면 **THEN** localStorage에 1건이 추가된다
  - Given localStorage에 `lps_loans_v1`가 `{ "version": 1, "items": [] }`로 존재할 때
  - When 사용자가 대출 추가 폼에서 `{ name: "학자금", principalRemaining: 12000000, annualInterestRate: 4.2, remainingMonths: 48, monthlyPayment: 270000 }`를 입력하고 “저장” 버튼을 탭할 때
  - Then localStorage `lps_loans_v1.items` 길이는 `1`이 된다
  - And 저장된 첫 항목의 `name`은 `"학자금"`이다
  - And 토스트 `"저장했어요"`가 표시된다

- AC-2 [E][P0] (Event-driven): **WHEN** 사용자가 기존 대출을 수정 저장하면 **THEN** 해당 필드가 갱신된다
  - Given localStorage `lps_loans_v1.items`에 `{ id: "loan-1", name: "신용대출", principalRemaining: 8000000, annualInterestRate: 6.5, remainingMonths: 36, monthlyPayment: 250000 }`가 있을 때
  - When 사용자가 수정 폼에서 `monthlyPayment`를 `320000`으로 변경 후 “저장”을 탭할 때
  - Then localStorage `lps_loans_v1.items`에서 `id === "loan-1"`인 항목의 `monthlyPayment`는 `320000`이다
  - And 토스트 `"저장했어요"`가 표시된다

- AC-3 [W][P1] (Unwanted): **IF** 사용자가 이름을 비워 저장을 시도하면 **THEN** 저장을 거부하고 오류를 표시한다
  - Given 사용자가 대출 추가 폼 화면에 있을 때
  - When `{ name: "", principalRemaining: 12000000, annualInterestRate: 4.2, remainingMonths: 48, monthlyPayment: 270000 }`로 “저장”을 탭할 때
  - Then `name` 필드 하단에 오류 메시지 `"대출 이름을 입력해주세요"`가 표시된다
  - And localStorage `lps_loans_v1.items` 길이는 변경되지 않는다

- AC-4 [W][P1] (Unwanted): **IF** 사용자가 잔액을 0으로 저장을 시도하면 **THEN** 저장을 거부하고 오류를 표시한다
  - Given 사용자가 대출 추가 폼 화면에 있을 때
  - When `{ name: "자동차할부", principalRemaining: 0, annualInterestRate: 3.1, remainingMonths: 24, monthlyPayment: 300000 }`로 “저장”을 탭할 때
  - Then `principalRemaining` 필드 하단에 오류 메시지 `"잔액은 1원 이상 입력해주세요"`가 표시된다
  - And localStorage `lps_loans_v1.items` 길이는 변경되지 않는다

- AC-5 [E][P1] (Event-driven): **WHEN** 홈에 대출이 0개면 **THEN** 빈 상태 가이드를 표시한다
  - Given localStorage `lps_loans_v1`가 `{ "version": 1, "items": [] }`일 때
  - When 사용자가 `/`에 진입할 때
  - Then 화면에 문구 `"대출을 2개 이상 추가하면 전략 비교가 가능해요"`가 표시된다
  - And `"대출 추가"` TDS Button이 표시된다

- AC-6 [W][P1] (Unwanted): **IF** localStorage 파싱에 실패하면 **THEN** 초기화 다이얼로그를 표시한다
  - Given localStorage `lps_loans_v1` 값이 문자열 `"NOT_JSON"`일 때
  - When 사용자가 `/`에 진입할 때
  - Then AlertDialog 제목 `"데이터를 불러올 수 없어요"`가 표시된다
  - And 본문에 `"저장된 데이터를 초기화한 뒤 다시 시작할 수 있어요"`가 표시된다
  - And 사용자가 다이얼로그에서 `"초기화"`를 탭하면 localStorage `lps_loans_v1`는 `{ "version": 1, "items": [] }`로 재설정된다

- AC-7 [W][P1] (Unwanted): **IF** 연이율이 30%를 초과하면 **THEN** 저장을 거부한다
  - Given 사용자가 대출 추가 폼 화면에 있을 때
  - When `{ name: "고금리대출", principalRemaining: 1000000, annualInterestRate: 30.1, remainingMonths: 12, monthlyPayment: 100000 }`로 “저장”을 탭할 때
  - Then `annualInterestRate` 필드 하단에 오류 메시지 `"연이율은 0%~30% 사이여야 해요"`가 표시된다
  - And localStorage `lps_loans_v1.items` 길이는 변경되지 않는다

- AC-8 [W][P1] (Unwanted): **IF** localStorage 용량 초과가 발생하면 **THEN** 저장 실패 토스트를 표시하고 이동하지 않는다
  - Given `localStorage.setItem` 호출이 `QuotaExceededError`를 throw하도록 테스트 더블이 설정되어 있을 때
  - When 사용자가 대출 추가 폼에서 유효한 값으로 “저장”을 탭할 때
  - Then 토스트 `"저장 공간이 부족해요. 일부 대출을 삭제하고 다시 시도해주세요"`가 표시된다
  - And localStorage `lps_loans_v1.items` 길이는 변경되지 않는다
  - And `navigate('/')`가 호출되지 않는다

- AC-9 [E][P1] (Event-driven): **WHEN** 사용자가 삭제를 확인하면 **THEN** 해당 대출이 제거된다
  - Given localStorage `lps_loans_v1.items`에 `{ id:"loan-1", name:"신용대출", principalRemaining: 8000000, annualInterestRate: 6.5, remainingMonths: 36, monthlyPayment: 250000 }`가 존재할 때
  - When 사용자가 `/`에서 해당 대출의 “삭제” 보조 버튼을 탭하고 AlertDialog에서 `"삭제"`를 탭할 때
  - Then localStorage `lps_loans_v1.items`에서 `id === "loan-1"`인 항목은 존재하지 않는다
  - And 토스트 `"삭제했어요"`가 표시된다

- AC-10 [W][P2] (Unwanted): **IF** 존재하지 않는 대출 삭제가 호출되면 **THEN** 저장소를 변경하지 않는다
  - Given localStorage `lps_loans_v1.items`에 `id:"loan-1"`만 존재할 때
  - When 사용자가 삭제 액션이 `loanId="loan-404"`로 호출되는 경로를 타게 될 때
  - Then 토스트 `"삭제할 대출을 찾지 못했어요"`가 표시된다
  - And localStorage `lps_loans_v1.items`는 변경되지 않는다

---

### F2. 시뮬레이션 실행(추가상환 입력) + 전략 비교 산출
- Description: 사용자는 매달 추가로 상환할 금액을 입력해 Snowball/Avalanche 두 전략을 동시에 계산한다. 계산 결과는 runId로 저장되어 결과 화면에서 재조회 가능하다.
- Data: `Loan`, `SimulationRun`, `RunsStorageV1`
- API: N/A
- Requirements:

- AC-1 [E][P0] (Event-driven): **WHEN** 사용자가 비교 실행을 탭하면 **THEN** run이 저장되고 결과 화면으로 이동한다
  - Given localStorage `lps_loans_v1.items`에 아래 2개 대출이 있을 때  
    1) `{ id:"a", name:"학자금", principalRemaining:12000000, annualInterestRate:4.2, remainingMonths:48, monthlyPayment:270000 }`  
    2) `{ id:"b", name:"신용대출", principalRemaining:8000000, annualInterestRate:6.5, remainingMonths:36, monthlyPayment:250000 }`
  - When 사용자가 시뮬레이션 화면에서 `extraMonthlyPayment = 100000`을 입력하고 `"비교 결과 보기"`를 탭할 때
  - Then localStorage `lps_runs_v1.items`에 `runId`가 생성된 항목이 1개 추가된다
  - And 저장된 run의 `input.extraMonthlyPayment`는 `100000`이다
  - And 저장된 run의 `input.loanIds`는 `["a","b"]`이다
  - And `summaries.snowball.strategy`는 `"snowball"`이다
  - And `summaries.avalanche.strategy`는 `"avalanche"`이다
  - And `/result`로 `navigate('/result', { state: { runId: string } })`가 호출된다

- AC-2 [S][P1] (State-driven): **WHILE** 계산이 진행 중이면 **THEN** 로딩 UI를 표시하고 실행 버튼을 비활성화한다
  - Given 사용자가 시뮬레이션 화면에서 대출이 2개 이상 존재하는 상태일 때
  - When 사용자가 `"비교 결과 보기"`를 탭해 계산이 시작될 때
  - Then 버튼 `"비교 결과 보기"`는 `disabled=true`가 된다
  - And 화면에 `"계산 중"` 텍스트가 표시된다

- AC-3 [E][P1] (Event-driven): **WHEN** 저장된 대출이 2개 미만인 상태로 진입하면 **THEN** 실행 불가 가이드를 표시한다
  - Given localStorage `lps_loans_v1.items`가 1개만 있을 때
  - When 사용자가 `/simulate`에 진입할 때
  - Then 문구 `"대출을 2개 이상 추가해주세요"`가 표시된다
  - And `"대출 추가하러 가기"` 버튼이 표시된다
  - And `"비교 결과 보기"` 버튼은 `disabled=true`이거나 화면에 렌더링되지 않는다
  - And 사용자가 `"대출 추가하러 가기"` 버튼을 탭하면 `navigate('/loan/new')`가 호출된다

- AC-4 [W][P1] (Unwanted): **IF** 추가상환 금액이 음수이면 **THEN** 실행을 거부하고 오류를 표시한다
  - Given localStorage `lps_loans_v1.items`에 대출이 2개 이상 있을 때
  - When 사용자가 `extraMonthlyPayment = -1`을 입력하고 `"비교 결과 보기"`를 탭할 때
  - Then `extraMonthlyPayment` 필드 하단에 오류 메시지 `"추가 상환 금액은 0원 이상이어야 해요"`가 표시된다
  - And localStorage `lps_runs_v1.items` 길이는 변경되지 않는다

- AC-5 [W][P1] (Unwanted): **IF** (양 전략 모두) 3개월 연속 원금이 줄지 않으면 **THEN** 실행을 중단하고 run을 저장하지 않는다
  - Given localStorage `lps_loans_v1.items`에 `{ id:"c", name:"고금리", principalRemaining:10000000, annualInterestRate:24, remainingMonths:60, monthlyPayment:100000 }`와 다른 대출 1개가 더 있을 때
  - When 사용자가 `extraMonthlyPayment = 0`으로 `"비교 결과 보기"`를 탭할 때
  - Then AlertDialog 제목 `"상환이 진행되지 않아요"`가 표시된다
  - And 본문에 `"월납입액이 이자보다 작아 잔액이 줄지 않습니다. 월납입액 또는 추가상환 금액을 늘려주세요"`가 표시된다
  - And (내부 오류 코드) `STALL_3_MONTHS`가 설정된다
  - And localStorage `lps_runs_v1.items` 길이는 변경되지 않는다

- AC-6 [W][P1] (Unwanted): **IF** localStorage 용량 초과로 run 저장이 실패하면 **THEN** 결과 화면으로 이동하지 않는다
  - Given `localStorage.setItem` 호출이 `QuotaExceededError`를 throw하도록 테스트 더블이 설정되어 있을 때
  - When 사용자가 `extraMonthlyPayment = 100000`으로 `"비교 결과 보기"`를 탭할 때
  - Then 토스트 `"저장 공간이 부족해요. 이전 결과를 삭제하고 다시 시도해주세요"`가 표시된다
  - And `/result`로 이동하지 않는다

- AC-7 [W][P1] (Unwanted): **IF** (양 전략 모두) 720개월 하드 캡에 도달하면 **THEN** 실행을 중단하고 run을 저장하지 않는다
  - Given localStorage `lps_loans_v1.items`에 대출이 2개 이상 있고, 해당 입력 조합이 `720개월` 내 완납되지 않는 케이스일 때
  - When 사용자가 `"비교 결과 보기"`를 탭해 계산을 실행할 때
  - Then AlertDialog 제목 `"상환 기간이 너무 길어요"`가 표시된다
  - And 본문에 `"720개월 안에 완납되지 않아 계산을 중단했어요. 입력값을 조정해 다시 시도해주세요"`가 표시된다
  - And (내부 오류 코드) `MAX_MONTHS_REACHED`가 설정된다
  - And localStorage `lps_runs_v1.items` 길이는 변경되지 않는다
  - And `/result`로 이동하지 않는다

- AC-8 [E][P1] (Event-driven): **WHEN** 한 전략만 오류로 종료되면 **THEN** run을 저장하고 결과 화면에서 해당 전략을 오류로 표시한다
  - Given localStorage `lps_loans_v1.items`에 대출이 2개 이상 있고
  - And Snowball은 `MAX_MONTHS_REACHED`로 종료되지만 Avalanche는 정상 완납되는 입력 케이스일 때
  - When 사용자가 `"비교 결과 보기"`를 탭할 때
  - Then localStorage `lps_runs_v1.items`에 run이 1개 추가된다
  - And 저장된 run의 `summaries.snowball.status`는 `"error"`이다
  - And 저장된 run의 `summaries.snowball.errorCode`는 `"MAX_MONTHS_REACHED"`이다
  - And 저장된 run의 `summaries.avalanche.status`는 `"ok"`이다
  - And `/result`로 `navigate('/result', { state: { runId: string } })`가 호출된다

---

### F3. 결과 요약 화면(전략 비교 + 절감액 + 월별 타임라인 요약)
- Description: 결과 화면은 두 전략의 총 이자, 상환 완료까지 남은 개월 수, 절감액(차이)을 한 화면에서 비교한다. 사용자는 요약 타임라인(월별 잔액 추이 요약)을 보고 상세 스케줄로 이동할 수 있다.
- Data: `SimulationRun`, `RunsStorageV1`, (런타임) `PaymentScheduleRow` 요약 샘플
- API: N/A
- Requirements:

- AC-1 [E][P0] (Event-driven): **WHEN** runId로 결과를 조회하면 **THEN** 요약 비교가 렌더링된다
  - Given localStorage `lps_runs_v1.items`에 `{ runId:"run-1", ... , summaries: { snowball: { totalInterestPaid: 2100000, totalPrincipalPaid: 20000000, monthsToPayoff: 40, payoffDateISO:"2030-01-01" }, avalanche: { totalInterestPaid: 1900000, totalPrincipalPaid: 20000000, monthsToPayoff: 39, payoffDateISO:"2029-12-01" } } }`가 있을 때
  - When 사용자가 `/result`에 `location.state = { runId: "run-1" }`로 진입할 때
  - Then 화면에 `"Snowball"`과 `"Avalanche"` 비교 섹션이 표시된다
  - And `"총 이자 2,100,000원"` 텍스트가 표시된다
  - And `"총 이자 1,900,000원"` 텍스트가 표시된다
  - And 절감액 텍스트 `"Avalanche가 200,000원 이자를 덜 내요"`가 표시된다

- AC-2 [S][P1] (State-driven): **WHILE** 결과 run 로딩 중이면 **THEN** 로딩 텍스트를 표시하고 버튼을 비활성화한다
  - Given 사용자가 `/result`에 진입했지만 아직 localStorage에서 run 조회가 완료되지 않은 상태일 때
  - When 결과 컴포넌트가 마운트될 때
  - Then 화면에 `"불러오는 중"` 텍스트가 표시된다
  - And `"상세 스케줄 보기"` 버튼은 `disabled=true`이다

- AC-3 [W][P1] (Unwanted): **IF** runId가 누락되면 **THEN** 오류 안내와 시뮬레이션 이동 CTA를 표시한다
  - Given localStorage `lps_runs_v1.items`가 비어있지 않더라도 사용자가 `/