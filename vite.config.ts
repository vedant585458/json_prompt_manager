import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The sandbox live-preview proxy forwards requests from a different host
    // than localhost, so host checking must not reject them.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Domain (TASK-005) and data (TASK-006) code is measured; UI coverage
      // arrives with the integration suites in TASK-029.
      include: ['src/domain/**/*.ts', 'src/data/**/*.ts'],
      exclude: [
        'src/domain/**/*.test.ts',
        'src/domain/index.ts',
        'src/data/**/*.test.ts',
        'src/data/index.ts',
      ],
      // Separate floors: data code has unavoidable platform-failure branches
      // that a fake IndexedDB cannot reach as densely as pure domain logic.
      thresholds: {
        'src/domain/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/data/**': { statements: 90, branches: 82, functions: 88, lines: 92 },
      },
    },
  },
});
