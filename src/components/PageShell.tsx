import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  /** Adds bottom clearance so content isn't hidden behind a FixedBottomCTA. */
  hasBottomCta?: boolean;
}

/**
 * Pattern 1 — page SafeArea wrapper. Consistent full-height background + safe-area
 * padding, centered to a phone-width column on desktop. (100dvh, not 100vh.)
 */
export function PageShell({ children, hasBottomCta }: PageShellProps) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        maxWidth: 480,
        marginInline: "auto",
        backgroundColor: "var(--adaptiveBackground)",
        paddingBottom: hasBottomCta
          ? "calc(var(--toss-safe-area-bottom) + 96px)"
          : "calc(var(--toss-safe-area-bottom) + 24px)",
      }}
    >
      {children}
    </div>
  );
}

/** Consistent horizontal gutter for page body content (Top stays full-bleed). */
export function PageBody({ children }: { children: ReactNode }) {
  return <div style={{ padding: "0 20px" }}>{children}</div>;
}

/**
 * Pattern 8 — fixed bottom CTA bar. A layout <div> wrapping a TDS Button, so the
 * markup is a valid <div> > <button> (TDS `FixedBottomCTA` is itself a <button>
 * and would nest <button> > <button>). safe-area handled here.
 */
export function FixedCta({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        maxWidth: 480,
        marginInline: "auto",
        padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
        backgroundColor: "var(--adaptiveBackground)",
      }}
    >
      {children}
    </div>
  );
}
