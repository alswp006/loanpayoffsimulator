import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, Tab, ListRow, Spacing, Paragraph, Button } from "@toss/tds-mobile";
import { PageShell } from "@/components/PageShell";
import { TossRewardAd } from "@/components/TossRewardAd";
import { useRunsStore } from "@/lib/store/runsStore";
import { useRewardUnlocksStore } from "@/lib/store/rewardUnlocksStore";
import { generateStrategySchedule } from "@/lib/simulation/generateSchedule";
import type { MonthlyScheduleRow, RouteState, StrategyType } from "@/lib/types";

/** Rows beyond this threshold switch to windowed rendering (perf guard). */
const VIRTUALIZE_THRESHOLD = 120;
const ROW_HEIGHT = 64;
const VIEWPORT_HEIGHT = 480;
const OVERSCAN = 4;

/** Minimal windowed list (react-window is not bundled in this kit). Keeps the
 *  initial DOM row count small for long schedules. */
function WindowedRows({ rows }: { rows: MonthlyScheduleRow[] }) {
  const [scrollTop, setScrollTop] = useState(0);
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visible = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(rows.length, start + visible);

  return (
    <div
      data-testid="virtual-list"
      style={{ height: VIEWPORT_HEIGHT, overflowY: "auto" }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: rows.length * ROW_HEIGHT, position: "relative" }}>
        {rows.slice(start, end).map((row, i) => (
          <div key={start + i} style={{ position: "absolute", top: (start + i) * ROW_HEIGHT, left: 0, right: 0 }}>
            <ScheduleRow row={row} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleRow({ row }: { row: MonthlyScheduleRow }) {
  return (
    <ListRow
      contents={
        <ListRow.Texts
          type="2RowTypeA"
          top={`${row.monthIndex}개월차`}
          bottom={`이자 ${row.totalInterest.toLocaleString("ko-KR")}원 · 납입 ${row.totalPayment.toLocaleString("ko-KR")}원 · 잔액 ${row.totalRemainingBalance.toLocaleString("ko-KR")}원`}
        />
      }
    />
  );
}

export default function Schedule() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as RouteState["/schedule"] | null;
  const runId = incoming?.runId;

  const { isHydrating, getRunById } = useRunsStore();
  const { isUnlocked, unlock } = useRewardUnlocksStore();
  const [strategy, setStrategy] = useState<StrategyType>(incoming?.strategy ?? "snowball");

  const goSimulate = () => navigate("/simulate");

  if (isHydrating) {
    return (
      <PageShell>
        <Top title={<Top.TitleParagraph>상세 스케줄</Top.TitleParagraph>} />
        <Spacing size={16} />
        <Paragraph.Text typography="t5">불러오는 중</Paragraph.Text>
      </PageShell>
    );
  }

  if (!runId) {
    return (
      <PageShell>
        <Top title={<Top.TitleParagraph>상세 스케줄</Top.TitleParagraph>} />
        <Spacing size={16} />
        <Paragraph.Text typography="t5">스케줄을 열 수 없어요</Paragraph.Text>
        <Spacing size={12} />
        <Button variant="fill" onClick={goSimulate}>
          시뮬레이션으로
        </Button>
      </PageShell>
    );
  }

  const lookup = getRunById(runId);
  if (!lookup.ok) {
    return (
      <PageShell>
        <Top title={<Top.TitleParagraph>상세 스케줄</Top.TitleParagraph>} />
        <Spacing size={16} />
        <Paragraph.Text typography="t5">결과가 만료되었어요</Paragraph.Text>
        <Spacing size={12} />
        <Button variant="fill" onClick={goSimulate}>
          시뮬레이션으로
        </Button>
      </PageShell>
    );
  }

  const run = lookup.value;
  const scheduleResult = generateStrategySchedule(run, strategy);
  const unlocked = isUnlocked(runId);

  const renderBody = () => {
    if (!scheduleResult.ok) {
      return <Paragraph.Text typography="t5">이 전략은 계산에 실패해서 스케줄을 만들 수 없어요</Paragraph.Text>;
    }
    const rows = scheduleResult.value.rows;
    if (rows.length === 0) {
      return <Paragraph.Text typography="t5">표시할 데이터가 없어요</Paragraph.Text>;
    }
    const table =
      rows.length > VIRTUALIZE_THRESHOLD ? (
        <WindowedRows rows={rows} />
      ) : (
        <div>
          {rows.map((row) => (
            <ScheduleRow key={row.monthIndex} row={row} />
          ))}
        </div>
      );

    if (unlocked) return table;
    return (
      <TossRewardAd slotId="schedule-unlock" onRewarded={() => unlock(runId)}>
        {table}
      </TossRewardAd>
    );
  };

  return (
    <>
      <Top title={<Top.TitleParagraph>상세 스케줄</Top.TitleParagraph>} />
      <Tab onChange={(index) => setStrategy(index === 0 ? "snowball" : "avalanche")}>
        <Tab.Item selected={strategy === "snowball"}>Snowball</Tab.Item>
        <Tab.Item selected={strategy === "avalanche"}>Avalanche</Tab.Item>
      </Tab>
      <Spacing size={16} />
      {renderBody()}
    </>
  );
}
