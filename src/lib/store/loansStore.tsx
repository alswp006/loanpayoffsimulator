import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Loan } from "@/lib/types";
import { createLoan, deleteLoan, getLoans, resetLoans, updateLoan } from "@/lib/storage/loans";

interface LoansStoreValue {
  loans: Loan[];
  isHydrating: boolean;
  hydrateErrorCode: "PARSE_ERROR" | null;
  /** Re-read loans from storage (used after mutations / dialog reset). */
  reload: () => void;
  create: typeof createLoan;
  update: typeof updateLoan;
  remove: typeof deleteLoan;
  reset: typeof resetLoans;
}

const LoansContext = createContext<LoansStoreValue | null>(null);

export function LoansProvider({ children }: { children: ReactNode }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrateErrorCode, setHydrateErrorCode] = useState<"PARSE_ERROR" | null>(null);

  const reload = useCallback(() => {
    const r = getLoans();
    if (r.ok) {
      setLoans(r.value);
      setHydrateErrorCode(null);
    } else {
      setHydrateErrorCode(r.error);
    }
  }, []);

  useEffect(() => {
    reload();
    setIsHydrating(false);
  }, [reload]);

  const create = useCallback<typeof createLoan>(
    (input) => {
      const r = createLoan(input);
      if (r.ok) reload();
      return r;
    },
    [reload],
  );

  const update = useCallback<typeof updateLoan>(
    (loanId, patch) => {
      const r = updateLoan(loanId, patch);
      if (r.ok) reload();
      return r;
    },
    [reload],
  );

  const remove = useCallback<typeof deleteLoan>(
    (loanId) => {
      const r = deleteLoan(loanId);
      if (r.ok) reload();
      return r;
    },
    [reload],
  );

  const reset = useCallback<typeof resetLoans>(() => {
    const r = resetLoans();
    if (r.ok) reload();
    return r;
  }, [reload]);

  const value = useMemo<LoansStoreValue>(
    () => ({ loans, isHydrating, hydrateErrorCode, reload, create, update, remove, reset }),
    [loans, isHydrating, hydrateErrorCode, reload, create, update, remove, reset],
  );

  return <LoansContext.Provider value={value}>{children}</LoansContext.Provider>;
}

export function useLoansStore(): LoansStoreValue {
  const ctx = useContext(LoansContext);
  if (!ctx) throw new Error("useLoansStore must be used within <LoansProvider>");
  return ctx;
}
