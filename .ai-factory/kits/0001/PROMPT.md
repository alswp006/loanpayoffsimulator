## Task: 도메인/스토리지 타입 + RouteState 계약 정의
대출/시뮬레이션/스케줄/스토리지/에러/Result 유틸 타입과 라우트 간 location.state 계약(RouteState)을 src/lib/types.ts에 순수 타입만으로 정의해요. 이후 모든 페이지에서 state 캐스팅/가드의 기준이 되도록 문자열 키를 정확히 고정해요.

## Acceptance Criteria
1. WHEN src/lib/types.ts를 빌드하면 THEN 런타임 코드(함수/상수/값 export)가 0개이고 TypeScript 에러가 0개다
2. WHEN RouteState 타입을 확인하면 THEN 키가 정확히 "/", "/loan/new", "/loan/edit", "/simulate", "/result", "/schedule", "/settings" 7개이며 각 값 타입이 SPEC과 일치한다
3. WHEN LoansStorageV1/RewardUnlocksV1/AppSettingsV1/SimulationRun 등 주요 타입을 import하면 THEN 모두 export되어 있고 순환 참조 없이 컴파일된다

## Definition of Done
1. types.ts에 interface/type만 존재(런타임 export 금지)
2. RouteState 문자열 키/값 타입이 SPEC과 1:1 매칭
3. 프로젝트 전체 TypeScript 컴파일 통과

## Files to create/modify
src/lib/types.ts

## UI Requirements (TDS 컴포넌트 사용)
해당 없음(타입 정의만). RouteState는 아래를 정확히 포함:
- "/": { highlightLoanId: string } | undefined
- "/loan/new": undefined
- "/loan/edit": { loanId: string }
- "/simulate": undefined
- "/result": { runId: string }
- "/schedule": { runId: string; strategy: StrategyType }
- "/settings": undefined


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

// src/lib/utils.ts
export function cn(...classes: (string | boolean | undefined | null)[]): string {
export function formatNumber(n: number): string {
export function formatCurrency(n: number, currency = 'KRW'): string {

## TDD Workflow (MANDATORY — follow this order)

You MUST follow Test-Driven Development for this packet. Do NOT skip the red phase.

### Step 1: Write Tests FIRST (Red Phase)
Create `src/__tests__/packet-0001.test.ts` with tests for the Acceptance Criteria above.
- Each AC = at least 1 test (name them "AC-1: should ...")
- Write 4-8 focused tests total
- Tests must describe expected behavior with concrete values (not just "truthy")
- Error cases included (invalid input, missing data, etc.)
- Do NOT write any source code yet
- Commit: `git add src/__tests__/packet-0001.test.ts && git commit -m "test: TDD red phase — packet 0001"`

### Step 2: Verify Red (tests should FAIL)
```bash
pnpm test src/__tests__/packet-0001.test.ts
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
- Commit: `git add <source files> && git commit -m "feat: implement packet 0001"`

### Step 4: Verify Green
```bash
pnpm test src/__tests__/packet-0001.test.ts
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