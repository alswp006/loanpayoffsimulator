import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Top, Button, TextButton, ListRow, Spacing, Paragraph, AlertDialog, Toast } from "@toss/tds-mobile";
import { PageShell, PageBody } from "@/components/PageShell";
import { AdSlot } from "@/components/AdSlot";
import { useLoansStore } from "@/lib/store/loansStore";
import type { RouteState } from "@/lib/types";

export default function Home() {
  const navigate = useNavigate();
  const { loans, isHydrating, hydrateErrorCode, remove, reset } = useLoansStore();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canSimulate = !isHydrating && loans.length >= 2;
  const showParseError = hydrateErrorCode === "PARSE_ERROR";
  const totalDebt = loans.reduce((sum, l) => sum + l.principalRemaining, 0);

  const goEdit = (loanId: string) => {
    const state: RouteState["/loan/edit"] = { loanId };
    navigate("/loan/edit", { state });
  };

  const confirmDelete = () => {
    if (deleteTargetId == null) return;
    const r = remove(deleteTargetId);
    setDeleteTargetId(null);
    if (r.ok) setToast("삭제했어요");
    else if (r.error === "NOT_FOUND") setToast("삭제할 대출을 찾지 못했어요");
    else setToast("삭제하지 못했어요. 다시 시도해주세요");
  };

  return (
    <PageShell hasBottomCta>
      <Top
        title={<Top.TitleParagraph>대출 비교</Top.TitleParagraph>}
        right={
          <Button variant="weak" disabled={isHydrating} onClick={() => navigate("/loan/new")}>
            대출 추가
          </Button>
        }
      />

      {isHydrating && (
        <PageBody>
          <Spacing size={16} />
          <Paragraph.Text typography="t5">불러오는 중</Paragraph.Text>
        </PageBody>
      )}

      {!isHydrating && !showParseError && loans.length === 0 && (
        <PageBody>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "72px 0" }}>
            <Paragraph.Text typography="t4">아직 등록한 대출이 없어요</Paragraph.Text>
            <Paragraph.Text typography="st8">대출을 2개 이상 추가하면 전략 비교가 가능해요</Paragraph.Text>
            <Button variant="fill" display="block" onClick={() => navigate("/loan/new")}>
              대출 추가
            </Button>
          </div>
        </PageBody>
      )}

      {!isHydrating && loans.length > 0 && (
        <>
          <PageBody>
            <Spacing size={12} />
            <div style={{ padding: 20, borderRadius: 16, backgroundColor: "var(--adaptiveLayeredBackground)" }}>
              <Paragraph.Text typography="st11">총 부채</Paragraph.Text>
              <Spacing size={6} />
              <Paragraph.Text typography="t1">{`${totalDebt.toLocaleString("ko-KR")}원`}</Paragraph.Text>
              <Spacing size={4} />
              <Paragraph.Text typography="st8">{`대출 ${loans.length}건`}</Paragraph.Text>
            </div>
            <Spacing size={16} />
          </PageBody>

          {loans.map((loan) => (
            <ListRow
              key={loan.id}
              border="indented"
              onClick={() => goEdit(loan.id)}
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={loan.name}
                  bottom={`잔액 ${loan.principalRemaining.toLocaleString("ko-KR")}원 · 연 ${loan.annualInterestRate}%`}
                />
              }
              right={
                <TextButton
                  size="small"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    setDeleteTargetId(loan.id);
                  }}
                >
                  삭제
                </TextButton>
              }
            />
          ))}

          <PageBody>
            <Spacing size={16} />
            <AdSlot adGroupId="home-banner" />
            {loans.length === 1 && (
              <>
                <Spacing size={12} />
                <Paragraph.Text typography="st8">대출을 1개 더 추가하면 전략 비교가 가능해요</Paragraph.Text>
              </>
            )}
          </PageBody>
        </>
      )}

      {(isHydrating || loans.length > 0) && (
        <PageBody>
          <Spacing size={16} />
          <Button variant="fill" display="block" disabled={!canSimulate} onClick={() => navigate("/simulate")}>
            시뮬레이션 시작
          </Button>
        </PageBody>
      )}

      <AlertDialog
        open={deleteTargetId !== null}
        title="대출을 삭제할까요?"
        description="삭제한 대출은 되돌릴 수 없어요"
        alertButton={<AlertDialog.AlertButton onClick={confirmDelete}>삭제</AlertDialog.AlertButton>}
        onClose={() => setDeleteTargetId(null)}
      />

      <AlertDialog
        open={showParseError}
        title="데이터를 불러올 수 없어요"
        description="저장된 데이터를 초기화한 뒤 다시 시작할 수 있어요"
        alertButton={<AlertDialog.AlertButton onClick={() => reset()}>초기화</AlertDialog.AlertButton>}
        onClose={() => {}}
      />

      <Toast open={toast !== null} text={toast ?? ""} position="bottom" onClose={() => setToast(null)} />
    </PageShell>
  );
}
