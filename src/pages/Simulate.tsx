import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Top, TextField, Button, Spacing, Paragraph, AlertDialog, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { PageShell, PageBody, FixedCta } from "@/components/PageShell";
import { useLoansStore } from "@/lib/store/loansStore";
import { useRunsStore } from "@/lib/store/runsStore";
import { buildSimulationRun } from "@/lib/simulation/buildSimulationRun";
import { simulateStrategySummary } from "@/lib/simulation/simulateStrategySummary";
import type { RouteState } from "@/lib/types";

interface FailDialog {
  title: string;
  body: string;
}

export default function Simulate() {
  const navigate = useNavigate();
  const { loans, isHydrating } = useLoansStore();
  const { save } = useRunsStore();

  const [extra, setExtra] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [failDialog, setFailDialog] = useState<FailDialog | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canCompare = loans.length >= 2;

  const onRun = () => {
    // Haptics only work inside the Toss WebView; guard the throw/rejection elsewhere.
    try {
      Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
    } catch {
      /* no native bridge */
    }
    (document.activeElement as HTMLElement | null)?.blur?.();

    const extraNum = Number(extra === "" ? "0" : extra);
    if (!Number.isFinite(extraNum) || extraNum < 0) {
      setFieldError("추가 상환 금액은 0원 이상이어야 해요");
      return;
    }
    setFieldError(null);
    setIsCalculating(true);

    // Defer the heavy computation so the "계산 중" loading state paints first.
    setTimeout(() => {
      const built = buildSimulationRun(loans, extraNum);
      if (!built.ok) {
        const code = simulateStrategySummary(loans, "snowball", extraNum).errorCode;
        setIsCalculating(false);
        setFailDialog(
          code === "MAX_MONTHS_REACHED"
            ? { title: "상환 기간이 너무 길어요", body: "720개월 안에 완납되지 않아 계산을 중단했어요. 입력값을 조정해 다시 시도해주세요" }
            : { title: "상환이 진행되지 않아요", body: "월납입액이 이자보다 작아 잔액이 줄지 않습니다. 월납입액 또는 추가상환 금액을 늘려주세요" },
        );
        return;
      }
      const saved = save(built.value);
      setIsCalculating(false);
      if (saved.ok) {
        const state: RouteState["/result"] = { runId: built.value.runId };
        navigate("/result", { state });
      } else if (saved.error === "QUOTA_EXCEEDED") {
        setToast("저장 공간이 부족해요. 이전 결과를 삭제하고 다시 시도해주세요");
      } else {
        setToast("저장하지 못했어요. 다시 시도해주세요");
      }
    }, 0);
  };

  return (
    <PageShell hasBottomCta={canCompare}>
      <Top title={<Top.TitleParagraph>시뮬레이션</Top.TitleParagraph>} />
      <PageBody>
        <Spacing size={16} />

        {isHydrating && <Paragraph.Text typography="t5">불러오는 중</Paragraph.Text>}

        {!isHydrating && !canCompare && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 0", gap: 16 }}>
            <Paragraph.Text typography="st6">대출이 2개 이상 있어야 비교할 수 있어요</Paragraph.Text>
            <Button variant="weak" display="block" onClick={() => navigate("/loan/new")}>
              대출 추가하러 가기
            </Button>
          </div>
        )}

        {!isHydrating && canCompare && (
          <>
            <Paragraph.Text typography="t4">추가상환 금액을 입력해요</Paragraph.Text>
            <Spacing size={12} />
            <TextField
              variant="box"
              label="매달 추가로 갚을 금액(원)"
              placeholder="예: 100000"
              inputMode="numeric"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              hasError={!!fieldError}
              help={fieldError ?? undefined}
            />
            {isCalculating && (
              <>
                <Spacing size={12} />
                <Paragraph.Text typography="t5">계산 중</Paragraph.Text>
              </>
            )}
          </>
        )}
      </PageBody>

      {!isHydrating && canCompare && (
        <FixedCta>
          <Button variant="fill" display="block" disabled={isCalculating} onClick={onRun}>
            비교 결과 보기
          </Button>
        </FixedCta>
      )}

      <AlertDialog
        open={failDialog !== null}
        title={failDialog?.title ?? ""}
        description={failDialog?.body ?? ""}
        alertButton={<AlertDialog.AlertButton onClick={() => setFailDialog(null)}>확인</AlertDialog.AlertButton>}
        onClose={() => setFailDialog(null)}
      />

      <Toast open={toast !== null} text={toast ?? ""} position="bottom" onClose={() => setToast(null)} />
    </PageShell>
  );
}
