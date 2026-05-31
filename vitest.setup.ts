/**
 * Vitest setup — runs before each test file.
 *
 * Handles:
 *  - localStorage isolation between tests (prevents cross-test pollution)
 *  - requestAnimationFrame shim for jsdom (needed for animate/countup utilities)
 *  - sessionStorage isolation
 *  - console.error filtering (React Router warnings etc.)
 */

import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// ── Working Storage guarantee (Node 25 compatibility) ──
// Node 25 enables Web Storage by default, but with no valid `--localstorage-file`
// it exposes a BROKEN global `localStorage` (clear/getItem are undefined) that
// shadows jsdom's Storage inside vitest. Install a clean in-memory Storage
// whenever the active one is non-functional, so app code (localStorage.getItem/
// setItem) and per-test isolation both work regardless of the Node version.
function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  const api: Storage = {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  };
  return api;
}

function ensureStorage(name: "localStorage" | "sessionStorage") {
  const current = (globalThis as unknown as Record<string, Storage | undefined>)[name];
  if (current && typeof current.clear === "function" && typeof current.getItem === "function") {
    return; // jsdom/browser Storage already works — leave it alone
  }
  const memory = createMemoryStorage();
  Object.defineProperty(globalThis, name, { value: memory, configurable: true, writable: true });
  const win = (globalThis as { window?: Record<string, unknown> }).window;
  if (win) {
    try {
      Object.defineProperty(win, name, { value: memory, configurable: true, writable: true });
    } catch {
      /* window prop may be locked — the globalThis override is sufficient */
    }
  }
}

ensureStorage("localStorage");
ensureStorage("sessionStorage");

// ── localStorage / sessionStorage isolation ──
// jsdom's storage persists between tests by default. Clear it to prevent pollution.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ── requestAnimationFrame shim for jsdom ──
// jsdom does NOT implement rAF natively, so animate/countup code hangs forever.
// Shim that immediately invokes callback with a monotonic timestamp.
if (typeof globalThis.requestAnimationFrame !== "function") {
  let now = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    now += 16;
    return setTimeout(() => cb(now), 0) as unknown as number;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof globalThis.cancelAnimationFrame;
}

// ── afterEach reset ──
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers(); // in case a test used fake timers
});
