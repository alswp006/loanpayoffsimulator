import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Top, TextField, Button, Spacing, Paragraph, AlertDialog, Toast } from "@toss/tds-mobile";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { PageShell, PageBody, FixedCta } from "@/components/PageShell";
import { useLoansStore } from "@/lib/store/loansStore";
import type { RouteState } from "@/lib/types";
import { LOAN_BOUNDS } from "@/lib/storage/schema";

type FieldKey = "name" | "principalRemaining" | "annualInterestRate" | "remainingMonths" | "monthlyPayment";
type FormState = Record<FieldKey, string>;
const EMPTY_FORM: FormState = {
  name: "",
  principalRemaining: "",
  annualInterestRate: "",
  remainingMonths: "",
  monthlyPayment: "",
};

interface ParsedInput {
  name: string;
  principalRemaining: number;
  annualInterestRate: number;
  remainingMonths: number;
  monthlyPayment: number;
}

function validate(input: ParsedInput): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {};
  if (input.name.trim().length < 1 || input.name.length > LOAN_BOUNDS.nameMax) {
    e.name = "대출 이름을 입력해주세요";
  }
  if (!Number.isInteger(input.principalRemaining) || input.principalRemaining < LOAN_BOUNDS.principalMin || input.principalRemaining > LOAN_BOUNDS.principalMax) {
    e.principalRemaining = "잔액은 1원 이상 입력해주세요";
  }
  if (!Number.isFinite(input.annualInterestRate) || input.annualInterestRate < LOAN_BOUNDS.rateMin || input.annualInterestRate > LOAN_BOUNDS.rateMax) {
    e.annualInterestRate = "연이율은 0%~30% 사이여야 해요";
  }
  if (!Number.isInteger(input.remainingMonths) || input.remainingMonths < LOAN_BOUNDS.monthsMin || input.remainingMonths > LOAN_BOUNDS.monthsMax) {
    e.remainingMonths = "남은 개월 수는 1~600 사이여야 해요";
  }
  if (!Number.isInteger(input.monthlyPayment) || input.monthlyPayment < LOAN_BOUNDS.monthlyMin || input.monthlyPayment > LOAN_BOUNDS.monthlyMax) {
    e.monthlyPayment = "월납입액은 1원 이상 입력해주세요";
  }
  return e;
}

export default function LoanForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loans, isHydrating, create, update } = useLoansStore();

  const isEdit = location.pathname.includes("/loan/edit");
  const editLoanId = isEdit ? (location.state as RouteState["/loan/edit"] | null)?.loanId : undefined;
  const loan = isEdit && editLoanId ? loans.find((l) => l.id === editLoanId) : undefined;

  const loadingEdit = isEdit && isHydrating;
  const missing = isEdit && !isHydrating && (!editLoanId || !loan);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isEdit && loan && !initialized) {
      setForm({
        name: loan.name,
        principalRemaining: String(loan.principalRemaining),
        annualInterestRate: String(loan.annualInterestRate),
        remainingMonths: String(loan.remainingMonths),
        monthlyPayment: String(loan.monthlyPayment),
      });
      setInitialized(true);
    }
  }, [isEdit, loan, initialized]);

  const setField = (key: FieldKey) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSave = () => {
    // Haptics only work inside the Toss WebView; guard the throw/rejection elsewhere.
    try {
      Promise.resolve(generateHapticFeedback({ type: "success" })).catch(() => {});
    } catch {
      /* no native bridge */
    }
    (document.activeElement as HTMLElement | null)?.blur?.();

    const input: ParsedInput = {
      name: form.name,
      principalRemaining: Number(form.principalRemaining),
      annualInterestRate: Number(form.annualInterestRate),
      remainingMonths: Number(form.remainingMonths),
      monthlyPayment: Number(form.monthlyPayment),
    };

    const fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return; // storage is never touched on invalid input
    }
    setErrors({});

    const payload = { ...input, name: input.name.trim() };
    const r = isEdit && editLoanId ? update(editLoanId, payload) : create(payload);
    if (r.ok) {
      const state: RouteState["/"] = { highlightLoanId: r.value.id };
      setToast("저장했어요");
      navigate("/", { state });
    } else if (r.error === "VALIDATION_ERROR") {
      setErrors(validate(input));
    } else if (r.error === "QUOTA_EXCEEDED") {
      setToast("저장 공간이 부족해요. 일부 대출을 삭제하고 다시 시도해주세요");
    } else {
      setToast("저장하지 못했어요. 다시 시도해주세요");
    }
  };

  return (
    <PageShell hasBottomCta>
      <Top title={<Top.TitleParagraph>{isEdit ? "대출 수정" : "대출 추가"}</Top.TitleParagraph>} />
      <PageBody>
        <Spacing size={12} />
        <Paragraph.Text typography="st8">대출을 2개 이상 추가하면 Snowball/Avalanche 전략 비교가 가능해요</Paragraph.Text>
        <Spacing size={16} />

        {loadingEdit && <Paragraph.Text typography="t5">불러오는 중</Paragraph.Text>}

        {!loadingEdit && !missing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TextField
            variant="box"
            label="대출 이름"
            placeholder="예: 신용대출"
            value={form.name}
            onChange={setField("name")}
            hasError={!!errors.name}
            help={errors.name}
          />
          <TextField
            variant="box"
            label="현재 잔액(원)"
            placeholder="예: 10000000"
            inputMode="numeric"
            value={form.principalRemaining}
            onChange={setField("principalRemaining")}
            hasError={!!errors.principalRemaining}
            help={errors.principalRemaining}
          />
          <TextField
            variant="box"
            label="연이율(%)"
            placeholder="예: 15"
            inputMode="numeric"
            value={form.annualInterestRate}
            onChange={setField("annualInterestRate")}
            hasError={!!errors.annualInterestRate}
            help={errors.annualInterestRate}
          />
          <TextField
            variant="box"
            label="남은 개월 수"
            placeholder="예: 36"
            inputMode="numeric"
            value={form.remainingMonths}
            onChange={setField("remainingMonths")}
            hasError={!!errors.remainingMonths}
            help={errors.remainingMonths}
          />
          <TextField
            variant="box"
            label="최소 월납입액(원)"
            placeholder="예: 300000"
            inputMode="numeric"
            value={form.monthlyPayment}
            onChange={setField("monthlyPayment")}
            hasError={!!errors.monthlyPayment}
            help={errors.monthlyPayment}
          />
        </div>
        )}
      </PageBody>

      <AlertDialog
        open={missing}
        title="대출을 찾을 수 없어요"
        description="홈으로 돌아가서 다시 선택해주세요"
        alertButton={<AlertDialog.AlertButton onClick={() => navigate("/")}>확인</AlertDialog.AlertButton>}
        onClose={() => navigate("/")}
      />

      <Toast open={toast !== null} text={toast ?? ""} position="bottom" onClose={() => setToast(null)} />

      <FixedCta>
        <Button variant="fill" display="block" disabled={loadingEdit || missing} onClick={onSave}>
          저장
        </Button>
      </FixedCta>
    </PageShell>
  );
}
