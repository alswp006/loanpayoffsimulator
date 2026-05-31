import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoansProvider } from "@/lib/store/loansStore";
import { RunsProvider } from "@/lib/store/runsStore";
import { RewardUnlocksProvider } from "@/lib/store/rewardUnlocksStore";
import { MainTabBar } from "@/components/MainTabBar";
import Home from "@/pages/Home";
import LoanForm from "@/pages/LoanForm";
import Simulate from "@/pages/Simulate";
import Result from "@/pages/Result";
import Schedule from "@/pages/Schedule";
import Settings from "@/pages/Settings";

// Dev-only TDS Gallery route — tree-shaken from production builds.
const DevTdsGallery = import.meta.env.DEV ? lazy(() => import("./pages/__TdsGallery")) : null;

export default function App() {
  return (
    <LoansProvider>
      <RunsProvider>
        <RewardUnlocksProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/loan/new" element={<LoanForm />} />
            <Route path="/loan/edit" element={<LoanForm />} />
            <Route path="/simulate" element={<Simulate />} />
            <Route path="/result" element={<Result />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/settings" element={<Settings />} />
            {DevTdsGallery && (
              <Route
                path="/__tds-gallery"
                element={
                  <Suspense fallback={null}>
                    <DevTdsGallery />
                  </Suspense>
                }
              />
            )}
          </Routes>
          <MainTabBar />
        </RewardUnlocksProvider>
      </RunsProvider>
    </LoansProvider>
  );
}
