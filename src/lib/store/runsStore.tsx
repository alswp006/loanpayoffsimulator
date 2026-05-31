import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SimulationRun } from "@/lib/types";
import {
  deleteSimulationRun,
  getSimulationRunById,
  getSimulationRuns,
  resetSimulationRuns,
  saveSimulationRun,
} from "@/lib/storage/runs";

interface RunsStoreValue {
  runs: SimulationRun[];
  isHydrating: boolean;
  hydrateErrorCode: "PARSE_ERROR" | null;
  reload: () => void;
  save: typeof saveSimulationRun;
  /** Reads straight from storage and returns the Result (AC-3). */
  getRunById: typeof getSimulationRunById;
  remove: typeof deleteSimulationRun;
  reset: typeof resetSimulationRuns;
}

const RunsContext = createContext<RunsStoreValue | null>(null);

export function RunsProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrateErrorCode, setHydrateErrorCode] = useState<"PARSE_ERROR" | null>(null);

  const reload = useCallback(() => {
    const r = getSimulationRuns();
    if (r.ok) {
      setRuns(r.value);
      setHydrateErrorCode(null);
    } else {
      setHydrateErrorCode(r.error);
    }
  }, []);

  useEffect(() => {
    reload();
    setIsHydrating(false);
  }, [reload]);

  const save = useCallback<typeof saveSimulationRun>(
    (run) => {
      const r = saveSimulationRun(run);
      if (r.ok) reload();
      return r;
    },
    [reload],
  );

  const getRunById = useCallback<typeof getSimulationRunById>((runId) => getSimulationRunById(runId), []);

  const remove = useCallback<typeof deleteSimulationRun>(
    (runId) => {
      const r = deleteSimulationRun(runId);
      if (r.ok) reload();
      return r;
    },
    [reload],
  );

  const reset = useCallback<typeof resetSimulationRuns>(() => {
    const r = resetSimulationRuns();
    if (r.ok) reload();
    return r;
  }, [reload]);

  const value = useMemo<RunsStoreValue>(
    () => ({ runs, isHydrating, hydrateErrorCode, reload, save, getRunById, remove, reset }),
    [runs, isHydrating, hydrateErrorCode, reload, save, getRunById, remove, reset],
  );

  return <RunsContext.Provider value={value}>{children}</RunsContext.Provider>;
}

export function useRunsStore(): RunsStoreValue {
  const ctx = useContext(RunsContext);
  if (!ctx) throw new Error("useRunsStore must be used within <RunsProvider>");
  return ctx;
}
