## Task: Loans localStorage API 구현 (파싱/검증/Quota/Reset)
lps_loans_v1에 대한 CRUD 스토리지 헬퍼를 구현해요. JSON 파싱 실패/스키마 불일치 시 PARSE_ERROR를 반환하고, 입력 검증(이름/잔액/금리/개월/월납입/200개 상한)을 통과해야만 저장해요. QuotaExceededError도 Result로 변환해요.

## Acceptance Criteria
1. IF localStorage의 lps_loans_v1 값이 JSON.parse 실패 또는 {version:1,items:Array} 스키마가 아니면 THEN getLoans()는 {ok:false,error:'PARSE_ERROR'}를 반환한다
2. WHEN createLoan(input) 호출 시 name 길이(1~30) 또는 principalRemaining(1~2,000,000,000) 또는 annualInterestRate(0~30) 또는 remainingMonths(1~600) 또는 monthlyPayment(1~50,000,000) 또는 items.length>=200 중 1개라도 위반하면 THEN {ok:false,error:'VALIDATION_ERROR'}이고 localStorage 값은 변경되지 않는다
3. WHEN resetLoans()를 호출하면 THEN localStorage의 lps_loans_v1이 JSON 파싱 후 {version:1,items:[]} 구조와 동일하다
4. IF localStorage.setItem에서 quota 초과 예외가 throw 되면 THEN 해당 API는 {ok:false,error:'QUOTA_EXCEEDED'}를 반환한다

## Definition of Done
1. get/create/update/delete/reset 함수 모두 Result/VoidResult로 반환
2. PARSE_ERROR/VALIDATION_ERROR/QUOTA_EXCEEDED 조건이 코드로 분기됨
3. 빌드 및 기본 수동 테스트(저장/수정/삭제/초기화)에서 크래시 없음

## Files to create/modify
src/lib/storage/schema.ts, src/lib/storage/errors.ts, src/lib/storage/loans.ts

## UI Requirements (TDS 컴포넌트 사용)
해당 없음(스토리지 유틸). 다음 키를 사용: localStorage key = 'lps_loans_v1'. 스키마: { version: 1, items: Loan[] }

IMPORTANT: Read `.ai-factory/shared-context.md` for shared types, existing codebase exports, and already-implemented packets. Do NOT duplicate what's listed there.

## BEFORE writing code (앱인토스 — 순서 엄수)
1. Read CLAUDE.md for ALL project rules (TDD protocol, code quality, verification gates, TDS rules)
2. Read `.ai-factory/apps-in-toss-essential.txt` — 실제 SDK API 목록 (없는 API는 사용 금지)
3. 이 패킷의 AC/DoD/UI 요구사항은 아래 프롬프트에 포함됨 — spec.md 전체를 읽을 필요 없음
4. If `.ai-factory/shared-context.md` exists, read it for shared types and existing codebase exports
5. Use Glob (`src/**/*.tsx`, `src/lib/**/*.ts`) to enumerate existing files BEFORE creating new ones — never assume a file doesn't exist
6. Use Grep (e.g. `"export function useXyz"`, `"<MyComponent"`) to check if a hook/component already exists. 추측 금지 — 검색 후 결정
7. Check existing files in src/lib/, src/hooks/, src/components/, src/pages/ — do NOT recreate
8. If `.ai-factory/sprint-contract.md` exists, read it — 이 패킷의 계약서 (만들 항목 + 검증 방법 + 금지 사항)
9. @apps-in-toss/web-framework는 imperative API만 제공: useTossLogin/useTossAd/useTossPayment 같은 훅은 SDK에 없음. 광고는 TossAds.attachBanner 또는 loadFullScreenAd, 결제는 createOneTimePurchaseOrder 직접 호출

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
이 패킷들의 코드가 워킹 디렉토리에 이미 존재합니다. 기존 파일을 확인하고 활용하세요.

## TDD Workflow (MANDATORY — follow this order)

You MUST follow Test-Driven Development for this packet. Do NOT skip the red phase.

### Step 1: Write Tests FIRST (Red Phase)
Create `src/__tests__/packet-0002.test.ts` with tests for the Acceptance Criteria above.
- Each AC = at least 1 test (name them "AC-1: should ...")
- Write 4-8 focused tests total
- Tests must describe expected behavior with concrete values (not just "truthy")
- Error cases included (invalid input, missing data, etc.)
- Do NOT write any source code yet
- Commit: `git add src/__tests__/packet-0002.test.ts && git commit -m "test: TDD red phase — packet 0002"`

### Step 2: Verify Red (tests should FAIL)
```bash
pnpm test src/__tests__/packet-0002.test.ts
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
- Commit: `git add <source files> && git commit -m "feat: implement packet 0002"`

### Step 4: Verify Green
```bash
pnpm test src/__tests__/packet-0002.test.ts
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