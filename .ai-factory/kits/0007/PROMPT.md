## Task: Run 생성: 전략 비교 결과 조립 + 둘 다 실패 시 게이트
저장 가능한 SimulationRun을 생성하는 조립 함수를 구현해요. Snowball/Avalanche를 각각 독립 실행하고, 둘 다 error면 실패로 반환해 run을 저장/이동하지 않도록 해요. 한쪽만 error면 run은 저장 가능하며 comparison(절감액 등)은 ok 전략끼리만 계산해요.

## Acceptance Criteria
1. WHEN 두 전략이 모두 {status:'error'}면 THEN buildSimulationRun은 {ok:false,error:'BOTH_STRATEGIES_FAILED'}(또는 동등한 명시적 에러)로 반환되어 run 객체가 생성되지 않는다
2. WHEN 한 전략만 error이고 다른 전략이 ok면 THEN buildSimulationRun은 ok로 반환하며 summaries에 두 전략 결과가 모두 포함된다
3. WHEN loanIds는 실행 시점의 저장된 loans items 순서를 유지한 id 배열이면 THEN SimulationInput.loanIds가 동일한 순서로 저장된다
4. WHEN buildSimulationRun이 ok를 반환하면 THEN runId는 비어있지 않은 문자열이고 createdAt(ms) 숫자가 포함된다

## Definition of Done
1. 전략 2개 결과를 독립 실행 후 단일 SimulationRun으로 조립
2. 둘 다 실패 게이트가 명확(실패 시 저장 불가)
3. runId 생성 유틸이 브라우저 환경에서 동작(crypto.randomUUID fallback 포함)

## Files to create/modify
src/lib/simulation/buildSimulationRun.ts, src/lib/simulation/id.ts

## UI Requirements (TDS 컴포넌트 사용)
해당 없음(계산/조립 로직).

IMPORTANT: Read `.ai-factory/shared-context.md` for shared types, existing codebase exports, and already-implemented packets. Do NOT duplicate what's listed there.

## BEFORE writing code (앱인토스 — 순서 엄수)
1. Read CLAUDE.md for ALL project rules (TDD protocol, code quality, verification gates, TDS rules)
2. 이 패킷의 AC/DoD/UI 요구사항은 아래 프롬프트에 포함됨 — spec.md 전체를 읽을 필요 없음
3. If `.ai-factory/shared-context.md` exists, read it for shared types and existing codebase exports
4. Use Glob (`src/**/*.tsx`, `src/lib/**/*.ts`) to enumerate existing files BEFORE creating new ones — never assume a file doesn't exist
5. Use Grep (e.g. `"export function useXyz"`, `"<MyComponent"`) to check if a hook/component already exists. 추측 금지 — 검색 후 결정
6. Check existing files in src/lib/, src/hooks/, src/components/, src/pages/ — do NOT recreate
7. If `.ai-factory/sprint-contract.md` exists, read it — 이 패킷의 계약서 (만들 항목 + 검증 방법 + 금지 사항)
8. @apps-in-toss/web-framework는 imperative API만 제공: useTossLogin/useTossAd/useTossPayment 같은 훅은 SDK에 없음. 광고는 TossAds.attachBanner 또는 loadFullScreenAd, 결제는 createOneTimePurchaseOrder 직접 호출

CRITICAL: CLAUDE.md contains the TDD protocol, code quality rules, and verification gates — follow them strictly.
The test file `src/__tests__/packet-0000.test.ts` has been pre-written. Make ALL tests pass.

## Shared Types Contract (src/lib/types.ts — IMPORT these, do NOT redefine)
```typescript
// Domain types — add your app-specific types here
export {};

```

## Available exports from existing files (IMPORT, do NOT recreate)
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/lib/storage.ts
export function getItem<T>(key: string): T | null {
export function setItem<T>(key: string, value: T): void {
export function removeItem(key: string): void {

// src/lib/types.ts
export {};

// src/lib/utils.ts
export function cn(...classes: (string | boolean | undefined | null)[]): string {
export function formatNumber(n: number): string {
export function formatCurrency(n: number, currency = 'KRW'): string {

## 선행 패킷 (이미 완료된 것으로 가정)
다음 패킷들이 이 패킷보다 먼저 실행되었습니다. 이 패킷들이 생성한 파일과 export를 사용할 수 있습니다:
- Packet 0001: "도메인/스토리지 타입 + RouteState 계약 정의" (files: src/lib/types.ts)
- Packet 0006: "단일 전략 요약 시뮬레이션(Snowball/Avalanche)" (files: src/lib/simulation/simulateStrategySummary.ts)
이 패킷들의 코드가 워킹 디렉토리에 이미 존재합니다. 기존 파일을 확인하고 활용하세요.

## TDD Workflow (MANDATORY — follow this order)

You MUST follow Test-Driven Development for this packet. Do NOT skip the red phase.

### Step 1: Write Tests FIRST (Red Phase)
Create `src/__tests__/packet-0007.test.ts` with tests for the Acceptance Criteria above.
- Each AC = at least 1 test (name them "AC-1: should ...")
- Write 4-8 focused tests total
- Tests must describe expected behavior with concrete values (not just "truthy")
- Error cases included (invalid input, missing data, etc.)
- Do NOT write any source code yet
- Commit: `git add src/__tests__/packet-0007.test.ts && git commit -m "test: TDD red phase — packet 0007"`

### Step 2: Verify Red (tests should FAIL)
```bash
pnpm test src/__tests__/packet-0007.test.ts
```
Tests MUST fail (source doesn't exist yet). This is intentional.

### Step 3: Implement to Pass (Green Phase)
Now write the source code in the files listed above. Goal: make ALL tests pass.

**절대 원칙: 테스트는 명세다. 테스트를 건드리지 말고 구현을 완성하라.**
- 테스트가 expect하는 값/동작을 소스 코드에서 실제로 구현하라
- 테스트를 수정해서 통과시키는 것은 버그를 숨기는 행위다 → 절대 금지
- 허용되는 테스트 수정: import 경로 오류, mock 구조 불일치만
- 금지: assertion 값 변경, 테스트 케이스 삭제, 조건 완화
- 구현이 어려우면 계속 구현하라 — 테스트를 약하게 만들지 마라
- Commit: `git add <source files> && git commit -m "feat: implement packet 0007"`

### Step 4: Verify Green
```bash
pnpm test src/__tests__/packet-0007.test.ts
```
All tests must pass with the ORIGINAL assertions. If any fail, fix the CODE (not the test).

## Quality Gates (MANDATORY — run before finishing)

After implementing all code, you MUST complete this quality loop. Do NOT finish until all gates pass.

### Gate 1: TypeScript Check
```bash
pnpm typecheck   # or: npx tsc --noEmit
```
If errors exist → fix ALL of them → re-run. Repeat until 0 errors.

### Gate 2: Tests
```bash
pnpm test
```
If tests fail → fix the code (NOT the tests) → re-run. Repeat until all pass.

### Gate 3: Build Verification
```bash
pnpm build   # or: npx next build
```
If build fails → fix the error → re-run.

### Gate 4: Self-Review Checklist
Before finishing, verify:
- [ ] No duplicate code — checked existing exports before creating new functions
- [ ] All imports resolve to real files (no phantom imports)
- [ ] Types match src/lib/types.ts — no inline re-definitions
- [ ] No hardcoded test data left in source files
- [ ] CLAUDE.md rules followed (check the file)

**If any gate fails, fix and re-run. Do NOT finish with known errors.**