import { useLocation, useNavigate } from "react-router-dom";

const TABS = [
  { label: "대출", path: "/" },
  { label: "설정", path: "/settings" },
] as const;

/**
 * Global bottom navigation. TDS web has no TabBar export, so this is a small
 * custom bar: a label color-tint marks the active tab (native Toss style), not a
 * filled button. Only shown on tab-root routes so it never overlaps page CTAs.
 */
export function MainTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isTabRoot = TABS.some((t) => t.path === pathname);
  if (!isTabRoot) return null;

  return (
    <nav
      data-testid="main-tabbar"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        borderTop: "1px solid var(--adaptiveGrey100)",
        backgroundColor: "var(--adaptiveBackground)",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
      }}
    >
      {TABS.map((tab) => {
        const selected = pathname === tab.path;
        return (
          <button
            key={tab.path}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => {
              if (!selected) navigate(tab.path);
            }}
            style={{
              flex: 1,
              minHeight: 52,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: selected ? 700 : 500,
              color: selected ? "var(--adaptiveBlue500)" : "var(--adaptiveGrey500)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
