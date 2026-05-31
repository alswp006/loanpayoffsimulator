import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Button, Spacing, Paragraph, Toast, Badge } from "@toss/tds-mobile";
import { setClipboardText } from "@apps-in-toss/web-framework";
import { PageShell, PageBody } from "@/components/PageShell";
import { AdSlot } from "@/components/AdSlot";
import { useRunsStore } from "@/lib/store/runsStore";
import type { RouteState, SimulationRun, StrategySummary, StrategyType } from "@/lib/types";

const STRATEGY_LABEL: Record<StrategyType, string> = { snowball: "Snowball", avalanche: "Avalanche" };

function errorReason(summary: StrategySummary): string {
  if (summary.errorCode === "MAX_MONTHS_REACHED") return "720개월 안에 완납되지 않았어요";
  if (summary.errorCode === "STALL_3_MONTHS") return "월납입액이 이자보다 작아 잔액이 줄지 않아요";
  return "계산할 수 없어요";
}

function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function savingsText(run: SimulationRun): string | null {
  const { snowball, avalanche } = run.summaries;
  if (snowball.status !== "ok" || avalanche.status !== "ok") return null;
  const diff = Math.abs(run.comparison.interestDiff);
  if (diff === 0) return "두 전략의 총 이자가 같아요";
  const winner = run.comparison.winnerByInterest === "avalanche" ? "Avalanche" : "Snowball";
  return `${winner}가 ${won(diff)} 이자를 덜 내요`;
}

function buildCopyText(run: SimulationRun): string {
  const line = (s: StrategySummary) =>
    s.status === "ok"
      ? `${STRATEGY_LABEL[s.strategy]}: 총 이자 ${won(s.totalInterestPaid)}, ${s.monthsToPayoff}개월`
      : `${STRATEGY_LABEL[s.strategy]}: 계산 실패`;
  const saving = savingsText(run);
  return [line(run.summaries.snowball), line(run.summaries.avalanche), saving].filter(Boolean).join("\n");
}

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isHydrating, getRunById } = useRunsStore();
  const [toast, setToast] = useState<string | null>(null);

  const runId = (location.state as RouteState["/result"] | null)?.runId;
  const goSimulate = () => navigate("/simulate");

  if (isHydrating) {
    return (
      <PageShell>
        <Top title={<Top.TitleParagraph>비교 결과</Top.TitleParagraph>} />
        <PageBody>
          <Spacing size={16} />
          <Paragraph.Text typography="t5">불러오는 중</Paragraph.Text>
          <Spacing size={16} />
          <Button variant="weak" display="block" disabled>
            상세 스케줄 보기
          </Button>
        </PageBody>
      </PageShell>
    );
  }

  const lookup = runId ? getRunById(runId) : null;
  const run = lookup && lookup.ok ? lookup.value : null;
  const expired = !!runId && lookup != null && !lookup.ok;

  if (!run) {
    return (
      <PageShell>
        <Top title={<Top.TitleParagraph>비교 결과</Top.TitleParagraph>} />
        <PageBody>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "72px 0" }}>
            <Paragraph.Text typography="t4">결과를 찾을 수 없어요</Paragraph.Text>
            {expired && <Paragraph.Text typography="st8">결과가 만료되었어요</Paragraph.Text>}
            <Button variant="fill" display="block" onClick={goSimulate}>
              시뮬레이션으로
            </Button>
          </div>
        </PageBody>
      </PageShell>
    );
  }

  const onCopy = () => {
    const text = buildCopyText(run);
    try {
      Promise.resolve(setClipboardText(text)).catch(() => {
        void navigator.clipboard?.writeText(text).catch(() => {});
      });
    } catch {
      void navigator.clipboard?.writeText(text).catch(() => {});
    }
    setToast("결과를 복사했어요");
  };

  const saving = savingsText(run);

  const renderCard = (strategy: StrategyType) => {
    const s = run.summaries[strategy];
    const isWinner = s.status === "ok" && run.comparison.winnerByInterest === strategy;
    return (
      <div
        key={strategy}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 16,
          borderRadius: 16,
          border: "1px solid var(--adaptiveGrey100)",
          backgroundColor: "var(--adaptiveLayeredBackground)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Paragraph.Text typography="t4">{STRATEGY_LABEL[strategy]}</Paragraph.Text>
          {isWinner && (
            <Badge size="small" variant="weak" color="blue">
              이자 최소
            </Badge>
          )}
        </div>
        {s.status === "ok" ? (
          <>
            <Paragraph.Text typography="t3">{`총 이자 ${won(s.totalInterestPaid)}`}</Paragraph.Text>
            <Paragraph.Text typography="st8">{`총 ${s.monthsToPayoff}개월`}</Paragraph.Text>
          </>
        ) : (
          <>
            <Paragraph.Text typography="t5">계산 실패</Paragraph.Text>
            <Paragraph.Text typography="st8">{errorReason(s)}</Paragraph.Text>
          </>
        )}
      </div>
    );
  };

  return (
    <PageShell>
      <Top title={<Top.TitleParagraph>비교 결과</Top.TitleParagraph>} />
      <PageBody>
        <Spacing size={16} />

        <div data-testid="summary-section">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {renderCard("snowball")}
            {renderCard("avalanche")}
          </div>
          {saving && (
            <div
              style={{
                marginTop: 16,
                padding: "20px 16px",
                borderRadius: 16,
                backgroundColor: "var(--adaptiveBlue50)",
                textAlign: "center",
              }}
            >
              <Paragraph.Text typography="t1">{saving}</Paragraph.Text>
            </div>
          )}
        </div>

        <Spacing size={16} />
        <AdSlot adGroupId="result-banner" />
        <Spacing size={16} />

        <div data-testid="detail-section" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(["snowball", "avalanche"] as StrategyType[]).map((strategy) => (
            <Button
              key={strategy}
              variant="weak"
              display="block"
              disabled={run.summaries[strategy].status === "error"}
              onClick={() => {
                const state: RouteState["/schedule"] = { runId: run.runId, strategy };
                navigate("/schedule", { state });
              }}
            >
              {`${STRATEGY_LABEL[strategy]} 상세 스케줄 보기`}
            </Button>
          ))}
          <Button variant="weak" display="block" onClick={onCopy}>
            결과 복사
          </Button>
        </div>
      </PageBody>

      <Toast open={toast !== null} text={toast ?? ""} position="bottom" onClose={() => setToast(null)} />
    </PageShell>
  );
}
