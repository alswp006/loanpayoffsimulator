import { useState } from "react";
import { Top, ListRow, Paragraph, Spacing, BottomSheet, Button, Toast } from "@toss/tds-mobile";
import { PageShell } from "@/components/PageShell";

type SheetKey = "strategy" | "input" | null;

export default function Settings() {
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [toast, setToast] = useState<string | null>(null);

  const open = (key: Exclude<SheetKey, null>) => {
    try {
      setSheet(key);
    } catch {
      // BottomSheet failed to open — keep the screen alive and notify (S6-AC-4).
      setToast("열 수 없어요. 다시 시도해주세요");
    }
  };

  const row = (label: string, onClick: () => void) => (
    <ListRow
      withArrow
      border="indented"
      contents={<ListRow.Texts type="1RowTypeA" top={label} />}
      onClick={onClick}
    />
  );

  return (
    <PageShell>
      <Top title={<Top.TitleParagraph>설정</Top.TitleParagraph>} />
      <Spacing size={8} />

      {row("Snowball vs Avalanche", () => open("strategy"))}
      {row("입력 가이드", () => open("input"))}
      {row("데이터 안내", () => setToast("결과는 최대 20개까지만 저장돼요"))}

      <BottomSheet open={sheet === "strategy"} onClose={() => setSheet(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
          <Paragraph.Text typography="t3">Snowball vs Avalanche</Paragraph.Text>
          <Paragraph.Text typography="t5">Snowball: 잔액이 작은 대출부터 갚아요</Paragraph.Text>
          <Paragraph.Text typography="t5">Avalanche: 금리가 높은 대출부터 갚아요</Paragraph.Text>
          <Spacing size={8} />
          <Button variant="weak" onClick={() => setSheet(null)}>
            닫기
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "input"} onClose={() => setSheet(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
          <Paragraph.Text typography="t3">입력 가이드</Paragraph.Text>
          <Paragraph.Text typography="t5">연이율은 0~30% 사이로 입력해요</Paragraph.Text>
          <Paragraph.Text typography="t5">남은 개월 수는 1~600개월이에요</Paragraph.Text>
          <Paragraph.Text typography="t5">월납입액은 1원 이상이에요</Paragraph.Text>
          <Paragraph.Text typography="t5">대출이 2개 이상 있어야 비교할 수 있어요</Paragraph.Text>
          <Spacing size={8} />
          <Button variant="weak" onClick={() => setSheet(null)}>
            닫기
          </Button>
        </div>
      </BottomSheet>

      <Toast open={toast !== null} text={toast ?? ""} position="bottom" onClose={() => setToast(null)} />
    </PageShell>
  );
}
