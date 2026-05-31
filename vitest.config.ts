import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright visual specs live in e2e/ — keep them out of the vitest run.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
