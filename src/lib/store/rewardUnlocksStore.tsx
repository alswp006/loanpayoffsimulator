import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getRewardUnlocks, unlockRunId } from "@/lib/storage/rewardUnlocks";

interface RewardUnlocksStoreValue {
  unlockedRunIds: string[];
  isHydrating: boolean;
  hydrateErrorCode: "PARSE_ERROR" | null;
  reload: () => void;
  unlock: typeof unlockRunId;
  isUnlocked: (runId: string) => boolean;
}

const RewardUnlocksContext = createContext<RewardUnlocksStoreValue | null>(null);

export function RewardUnlocksProvider({ children }: { children: ReactNode }) {
  const [unlockedRunIds, setUnlockedRunIds] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hydrateErrorCode, setHydrateErrorCode] = useState<"PARSE_ERROR" | null>(null);

  const reload = useCallback(() => {
    const r = getRewardUnlocks();
    if (r.ok) {
      setUnlockedRunIds(r.value.unlockedRunIds);
      setHydrateErrorCode(null);
    } else {
      setHydrateErrorCode(r.error);
    }
  }, []);

  useEffect(() => {
    reload();
    setIsHydrating(false);
  }, [reload]);

  const unlock = useCallback<typeof unlockRunId>(
    (runId, options) => {
      const r = unlockRunId(runId, options);
      if (r.ok) reload();
      return r;
    },
    [reload],
  );

  const isUnlocked = useCallback((runId: string) => unlockedRunIds.includes(runId), [unlockedRunIds]);

  const value = useMemo<RewardUnlocksStoreValue>(
    () => ({ unlockedRunIds, isHydrating, hydrateErrorCode, reload, unlock, isUnlocked }),
    [unlockedRunIds, isHydrating, hydrateErrorCode, reload, unlock, isUnlocked],
  );

  return <RewardUnlocksContext.Provider value={value}>{children}</RewardUnlocksContext.Provider>;
}

export function useRewardUnlocksStore(): RewardUnlocksStoreValue {
  const ctx = useContext(RewardUnlocksContext);
  if (!ctx) throw new Error("useRewardUnlocksStore must be used within <RewardUnlocksProvider>");
  return ctx;
}
