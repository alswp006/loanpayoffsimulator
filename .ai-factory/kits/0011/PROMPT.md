## Task: S3 시뮬레이션 설정(/simulate) 구현 + run 저장/이동
추가상환(extraMonthlyPayment) 입력 후 Snowball/Avalanche 비교 실행을 구현해요. 대출이 2개 미만이면 Empty 안내+홈으로 유도하고, 실행 중 로딩 상태로 버튼을 막아요. buildSimulationRun에서 둘 다 실패면 결과로 이동하지 않고 AlertDialog로 입력 수정 유도해요.

## Acceptance Criteria
1. IF 저장된 대출이 2개 미만이면 THEN 안내 문구 "대출이 2개 이상 있어야 비교할 수 있어요"와 "대출 추가하러 가기" 버튼이 표시되고, 비교 실행 CTA는 렌더되지 않거나 disabled=true다 (AC-S3-1)
2. IF extraMonthlyPayment 입력값이 음수 또는 숫자 파싱 불가면 THEN TextField에 hasError=true와 help 문구가 표시되고 실행 함수가 호출되지 않는다 (AC-S3-2)
3. WHILE 계산 중이면 THEN "계산 중" 텍스트가 표시되고 실행 버튼 disabled=true다 (AC-S3-3)
4. WHEN buildSimulationRun이 ok이고 saveRun이 ok이면 THEN navigate('/result',{state:{runId}})가 1회 호출된다 (AC-S3-5)
5. IF buildSimulationRun이 BOTH_STRATEGIES_FAILED로 실패하면 THEN AlertDialog가 열리고 runs storage는 변경되지 않는다 (AC-S3-4)

## Definition of Done
1. 대출 2개 미만 제약을 S3에서 명시적으로 안내
2. extraMonthlyPayment 숫자 입력/검증/키보드 blur 적용
3. 양 전략 실행→둘 다 실패 게이트→저장→결과 이동 플로우 동작

## Files to create/modify
src/pages/Simulate.tsx

## UI Requirements (TDS 컴포넌트 사용)
## Screen: 시뮬레이션 설정 (`/simulate`)

### Pattern
ButtonStack

### TDS Components (whitelist)
Top, TextField, Button, Spacing, Paragraph.Text, Chip, Toast, AlertDialog

### Layout
```tsx
<Top title={<Top.TitleParagraph>시뮬레이션</Top.TitleParagraph>} />
<Spacing size={16} />

{items.length < 2 ? (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'64px 16px', gap:16 }}>
    <Paragraph.Text typography="st6" color="tertiary">대출이 2개 이상 있어야 비교할 수 있어요</Paragraph.Text>
    <Button variant="weak" size="medium">대출 추가하러 가기</Button>
  </div>
) : (
  <>
    <Paragraph.Text typography="t4">추가상환 금액을 입력해요</Paragraph.Text>
    <Spacing size={12} />

    <TextField
      variant="hero"
      label="매달 추가로 갚을 금액(원)"
      value={extraMonthlyPayment}
      onChange={...}
```

추가 구현 지침:
- 숫자 입력은 inputMode="numeric".
- 실행 CTA: "비교 결과 보기"(Button fill large). 로딩 중 disabled.
- 둘 다 실패(BOTH_STRATEGIES_FAILED) 시 AlertDialog: 왼쪽 버튼 "닫기", 오른쪽 버튼 "입력 수정"(닫기 동작).
- 성공 시 navigate('/result', { state: { runId } }).


## UX Quality (TDS 준수하며 품질 향상)
- .impeccable.md가 있으면 읽어서 사용자/브랜드 컨텍스트 파악 (TDS 미적 방향은 고정)
- 모든 비동기 작업에 로딩 상태 필수 (TDS 컴포넌트 활용)
- 모든 fetch에 에러 상태 필수 (AlertDialog 또는 인라인 에러 메시지)
- 목록이 비어있을 때 빈 상태 UI 필수 (아이콘 + 안내 문구 + CTA)
- Progressive Disclosure: 복잡한 정보는 단계적으로 공개, 첫 화면은 핵심만
- 터치 타겟 44px 이상 (TDS Button/ListRow는 기본 충족, 커스텀 요소 주의)
- 사용자 입력 텍스트는 오버플로 대비 (Paragraph.Text에 말줄임 또는 줄 제한)
- 금지: .claude/skills/ 폴더 내 스킬 파일 참조, Tailwind 클래스 추가, TDS 외 컴포넌트

IMPORTANT: Read `.ai-factory/shared-context.md` for shared types, existing codebase exports, and already-implemented packets. Do NOT duplicate what's listed there.

## Page Type: Settings (TDS 패턴)
참조: tds-patterns.md의 "ListRow + 우측 Switch/Checkbox" 변형.
```tsx
<>
  <Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />
  <Spacing size={8} />
  <ListRow
    contents={<ListRow.Texts type="2RowTypeA" top="알림" bottom="푸시 알림 받기" />}
    right={<Switch checked={notif} onChange={() => setNotif(!notif)} />}
  />
  <ListRow
    contents={<ListRow.Texts type="2RowTypeA" top="다크 모드" bottom="시스템 따라가기" />}
    right={<Switch checked={dark} onChange={() => setDark(!dark)} />}
  />
</>
```

## BEFORE writing code (앱인토스 — 순서 엄수)
1. Read CLAUDE.md for ALL project rules (TDD protocol, code quality, verification gates, TDS rules)
2. Read `.ai-factory/tds-reference.txt` — 토스 공식 TDS LLM 문서 (컴포넌트 API/props 정확한 사용법)
3. Read `.ai-factory/tds-patterns.md` — 출시 미니앱 기반 8개 골든 패턴 (PageShell, Top+우측액션, FixedBottomCTA 등). 새 페이지는 가장 가까운 패턴을 변형하세요.
4. Read `.ai-factory/apps-in-toss-essential.txt` — 실제 SDK API 목록 (없는 API는 사용 금지)
5. 이 패킷의 AC/DoD/UI 요구사항은 아래 프롬프트에 포함됨 — spec.md 전체를 읽을 필요 없음
6. If `.ai-factory/shared-context.md` exists, read it for shared types and existing codebase exports
7. Use Glob (`src/**/*.tsx`, `src/lib/**/*.ts`) to enumerate existing files BEFORE creating new ones — never assume a file doesn't exist
8. Use Grep (e.g. `"export function useXyz"`, `"<MyComponent"`) to check if a hook/component already exists. 추측 금지 — 검색 후 결정
9. Check existing files in src/lib/, src/hooks/, src/components/, src/pages/ — do NOT recreate
10. If `.ai-factory/sprint-contract.md` exists, read it — 이 패킷의 계약서 (만들 항목 + 검증 방법 + 금지 사항)
11. @apps-in-toss/web-framework는 imperative API만 제공: useTossLogin/useTossAd/useTossPayment 같은 훅은 SDK에 없음. 광고는 TossAds.attachBanner 또는 loadFullScreenAd, 결제는 createOneTimePurchaseOrder 직접 호출

CRITICAL: CLAUDE.md contains the TDD protocol, code quality rules, and verification gates — follow them strictly.
The test file `src/__tests__/packet-0000.test.ts` has been pre-written. Make ALL tests pass.

## TDS 핵심 규칙 (반드시 준수)
TDS 핵심 규칙 — 실제 @toss/tds-mobile@2.3.0 .d.ts에서 검증됨 (2026-04 갱신)
위반 시 tsc 에러 발생. 이 파일의 API가 다른 문서와 충돌하면 이 파일이 우선.

📘 새 페이지 작성 시: tds-patterns.md를 먼저 확인 (실제 출시 미니앱 기반 8개 골든 패턴).
   - PageShell, Top+우측액션, StatusPanel, 라디오 다이얼로그,
     인터랙티브 그리드(햅틱), FixedBottomCTA, Portal 오버레이, 버튼 스택
   가까운 패턴이 있으면 새로 만들지 말고 그것을 변형하세요.

=== 스타일 규칙 ===
1. style={{}}에 margin/padding/fontSize/fontWeight 사용 금지 → TDS 컴포넌트 내장 스타일 사용
2. HEX 색상 하드코딩 금지 → var(--tds-color-*) 또는 var(--adaptive*) CSS 변수 사용
3. 커스텀 CSS는 flex/grid 레이아웃에만 허용 (외부 컨테이너 padding/gap OK)

=== Provider 셋업 (main.tsx) ===
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
<TDSMobileAITProvider>{children}</TDSMobileAITProvider>
- 내부적으로 TDSMobileProvider + GlobalCSSVariables + SafeAreaInsets 통합
- userAgent 자동 파싱, 브랜드 컬러는 granite.config.ts에서 자동
- ⚠️ colorPreference: 'light' 강제 (다크모드 비활성). 다크모드 필요 시 TDSMobileProvider 직접 사용
- CSS import 불필요 (emotion Global로 자동 주입)

=== 컴포넌트별 필수 API (Required props 반드시 포함) ===


Top (상단 내비게이션):
  - title: ReactNode (REQUIRED!)
  - 사용법: <Top title={<Top.TitleParagraph>제목</Top.TitleParagraph>} />
  - ❌ 잘못된 사용: <Top><Top.TitleParagraph>제목</Top.TitleParagraph></Top>
  - 선택: right?, upper?, lower?, subtitleTop?, subtitleBottom?
  - right에 IconButton 자주 사용: right={<IconButton aria-label="..." name="..." onClick={...} />}

Button:
  - variant: 'fill' | 'weak' (ONLY 이 2개)
  - ❌ 잘못된 값: 'primary', 'secondary', 'ghost', 'outline' — 존재하지 않음
  - 선택: color?, size?, disabled?, onClick

TextField:
  - variant: 'box' | 'line' | 'big' | 'hero' (REQUIRED!)
  - ❌ variant 없이 사용하면 tsc 에러
  - 선택: label?, help? (NOT helperText), hasError?, suffix?, inputMode?, value, onChange

AlertDialog (open/onClose 직접 관리):
  - open?: boolean, title?: ReactNode, description?: ReactNode
  - alertButton: ReactNode (AlertDialog.AlertButton 사용)
  - onClose: () => void (REQUIRED for dismissal)
  - 닫기 버튼 텍스트는 반드시 "닫기" (NOT "취소" — 토스 UX)

useDialog (대부분의 경우 권장 — overlay declarative API):
  - 반환: { close, openAlert, openConfirm, openAsyncConfirm }
  - openAlert({ title, alertButton, description?, closeOnDimmerClick? }): Promise<void>
  - openConfirm({ title, confirmButton, cancelButton, ... }): Promise<boolean>
  - alertButton/confirmButton은 string 또는 ReactElement (AlertDialog.AlertButton)
  - 사용법:
    const dialog = useDialog();
    await dialog.openAlert({ title: '완료', alertButton: '닫기' });
    const ok = await dialog.openConfirm({
      title: '삭제하시겠어요?',
      confirmButton: '삭제',
      cancelButton: '취소',
    });

Toast (open/position 직접 관리):
  - open: boolean (REQUIRED!)
  - position: 'top' | 'bottom' (REQUIRED!)
  - onClose?: () => void

useToast (대부분의 경우 권장):
  - 반환: { openToast }
  - openToast(message: string, options?): void
  - 사용법:
    const toast = useToast();
    toast.openToast('저장되었습니다');

Spacing:
  - size: string | number (REQUIRED!)
  - ❌ size 없이 <Spacing /> 사용하면 에러
  - direction?: 'vertical' | 'horizontal' (default vertical)

Paragraph.Text (Typography):
  - typography: string (t1~t7, st1~st13)
  - ❌ 'heading1', 'body1', 'caption1' 등은 존재하지 않음
  - 일반 가이드 (정확한 크기는 디자인에 의존):
    t1~t3 — 큰 제목
    t4~t5 — 본문
    t6~t7 — 작은 텍스트
    st1~st13 — 시맨틱 토큰 (제목/본문/라벨/캡션 등)



=== CSS 변수 (TDSMobileAITProvider 적용 시 자동 노출) ===
- 색상: var(--adaptiveBlue500), var(--adaptiveGrey700) 등 (light/dark 자동 분기)
- 시맨틱: var(--adaptiveBackground), var(--adaptiveLayeredBackground) 등
- Safe area: var(--toss-safe-area-top), var(--toss-safe-area-bottom)
- 토큰: var(--tToastBackground), var(--tBlueBadgeColor) 등 (theme tokens)

=== 환각 방지: "모르면 지어내지 말고 확인하라" ===
- 이 파일에 없는 컴포넌트나 prop을 사용하려면 → tds-reference.txt를 먼저 확인
- tds-reference.txt에도 없으면 → 그 컴포넌트/prop은 존재하지 않는다고 판단
- 존재하지 않는 prop을 추측해서 사용하면 tsc 에러 발생 → 절대 금지
- TDS로 구현이 불확실한 UI → 기본 HTML(<div>, <span>) + var(--adaptive*) CSS 변수로 대체
- 대체 시에도 Tailwind 클래스 금지, inline style의 flex/grid 레이아웃만 허용
- IconButton에 children 넣지 말 것 — name 또는 src prop 사용
- ListRow에 texts prop 사용하지 말 것 — contents prop 사용

=== import 패턴 ===
import {
  Top, Button, TextField, TextArea, TextButton, Tab, ListRow,
  Switch, Checkbox, IconButton, Asset,
  AlertDialog, BottomSheet, Toast,
  Spacing, Paragraph, Badge, Border, Skeleton,
  SearchField, SegmentedControl, ProgressBar,
  Loader, FullScreenLoader, Tooltip,
  CTAButton, BottomCTA, FixedBottomCTA,
  useDialog, useToast, useBottomSheet,
  useHaptic, useAppearance, usePlatform, useViewport,
  useSafeAreaBottomHeight,
} from '@toss/tds-mobile';


## TDS Layer 1 패턴 라이브러리 (새 페이지는 이 패턴들 변형)
# TDS Layer 1 Pattern Library

실제 출시 토스 미니앱(`with-contacts-viral`)에서 추출한 재사용 가능한 8개 UI/UX 패턴.

이 파일은 AI 코딩 에이전트가 새 페이지를 설계할 때 **레퍼런스로 우선 참조**해야 합니다. 패턴이 맞지 않으면 새로 만들지 말고 가장 가까운 패턴을 변형하세요. tds-essential.txt와 충돌 시 tds-essential.txt가 우선 (검증된 d.ts 기반).

---

## Pattern 1 — 페이지 SafeArea 래퍼

**언제**: 모든 페이지의 최상위 컨테이너로. TDSMobileAITProvider가 자동으로 `--toss-safe-area-*` CSS 변수를 주입하지만, 페이지마다 일관된 outer padding을 원할 때 한 번 더 감싸는 패턴.

```tsx
import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(var(--toss-safe-area-top) + 16px)',
        paddingBottom: 'calc(var(--toss-safe-area-bottom) + 16px)',
        backgroundColor: 'var(--adaptiveBackground)',
      }}
    >
      {children}
    </div>
  );
}
```

**핵심**: `100dvh` (NOT `100vh`), `calc(var(--toss-safe-area-*) + N)` 패턴.

---

## Pattern 2 — Top + 우측 액션 (BottomSheet 트리거)

**언제**: 페이지 헤더 우측에 설정/필터/메뉴 같은 보조 액션이 필요할 때. AlertDialog가 아닌 BottomSheet 권장 (모바일 UX).

```tsx
import { Top, IconButton, BottomSheet } from '@toss/tds-mobile';
import { useState } from 'react';

export function HeaderWithSettings() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Top
        title={<Top.TitleParagraph>PAGE_TITLE</Top.TitleParagraph>}
        right={
          <IconButton
            aria-label="설정"
            name="iconSettingRegular"
            onClick={() => setOpen(true)}
          />
        }
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title="설정">
        {/* content */}
      </BottomSheet>
    </>
  );
}
```

**핵심**: Top의 `right` prop, IconButton의 `aria-label` 필수 (접근성), BottomSheet의 `open + onClose` 직접 관리.

---

## Pattern 3 — 상태 요약 패널 (아이콘 + 값)

**언제**: 페이지 상단에 핵심 지표 2~3개를 가로로 나열할 때 (스코어, 잔여 횟수, 진행률 등).

```tsx
import { Asset, Paragraph } from '@toss/tds-mobile';

interface StatusPanelProps {
  items: Array<{ icon: string; label: string; value: string | number }>;
}

export function StatusPanel({ items }: StatusPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '12px 16px',
        backgroundColor: 'var(--adaptiveLayeredBackground)',
        borderRadius: 12,
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Asset.ContentIcon name={item.icon} alt={item.label} style={{ width: 24, height: 24 }} />
          <Paragraph.Text typography="t5">{item.value}</Paragraph.Text>
        </div>
      ))}
    </div>
  );
}
```

**핵심**: `Asset.ContentIcon` (CDN 아이콘), 24px 표준, `var(--adaptiveLayeredBackground)` 카드 색상.

---

## Pattern 4 — 라디오 선택 다이얼로그

**언제**: 사용자가 옵션 N개 중 하나를 골라야 할 때. AlertDialog 대신 useDialog 사용 (declarative).

```tsx
import { useDialog, Checkbox, Paragraph, Spacing } from '@toss/tds-mobile';
import { useState } from 'react';

interface Option { value: string; label: string }

export function useOptionPicker(options: Option[], initial: string) {
  const dialog = useDialog();
  const [selected, setSelected] = useState(initial);

  const open = async () => {
    const ok = await dialog.openConfirm({
      title: '옵션을 선택해주세요',
      description: (
        <div>
          {options.map((opt) => (
            <Checkbox.Circle
              key={opt.value}
              inputType="radio"
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
            >
              {opt.label}
            </Checkbox.Circle>
          ))}
        </div>
      ),
      confirmButton: '확인',
      cancelButton: '취소',
    });
    return ok ? selected : null;
  };

  return { open, selected };
}
```

**핵심**: `Checkbox.Circle` + `inputType="radio"` (실제 검증됨), `useDialog().openConfirm()` boolean 반환.

---

## Pattern 5 — 인터랙티브 그리드 (햅틱 피드백)

**언제**: 셀/타일 그리드에서 각 탭마다 햅틱 피드백을 주고 싶을 때 (게임, 선택 UI 등).

```

## 이 화면의 SPEC 정의 (반드시 구현)
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
  - Loading: `/loan/edit`에서 loanId로 로드 전 

위 SPEC의 incoming/outgoing navigate state, 로딩/에러/빈 상태를 모두 구현하세요.

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
- Packet 0004: "Loans/Runs/RewardUnlocks Store Provider 구성 (hydrate + actions)" (files: src/lib/store/loansStore.tsx, src/lib/store/runsStore.tsx, src/lib/store/rewardUnlocksStore.tsx)
- Packet 0007: "Run 생성: 전략 비교 결과 조립 + 둘 다 실패 시 게이트" (files: src/lib/simulation/buildSimulationRun.ts, src/lib/simulation/id.ts)
- Packet 0001: "도메인/스토리지 타입 + RouteState 계약 정의" (files: src/lib/types.ts)
이 패킷들의 코드가 워킹 디렉토리에 이미 존재합니다. 기존 파일을 확인하고 활용하세요.

## TDD Workflow (MANDATORY — follow this order)

You MUST follow Test-Driven Development for this packet. Do NOT skip the red phase.

### Step 1: Write Tests FIRST (Red Phase)
Create `src/__tests__/packet-0011.test.ts` with tests for the Acceptance Criteria above.
- Each AC = at least 1 test (name them "AC-1: should ...")
- Write 4-8 focused tests total
- Tests must describe expected behavior with concrete values (not just "truthy")
- Error cases included (invalid input, missing data, etc.)
- Do NOT write any source code yet
- Commit: `git add src/__tests__/packet-0011.test.ts && git commit -m "test: TDD red phase — packet 0011"`

### Step 2: Verify Red (tests should FAIL)
```bash
pnpm test src/__tests__/packet-0011.test.ts
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
- Commit: `git add <source files> && git commit -m "feat: implement packet 0011"`

### Step 4: Verify Green
```bash
pnpm test src/__tests__/packet-0011.test.ts
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