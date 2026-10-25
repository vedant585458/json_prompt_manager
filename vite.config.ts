import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The export manifest records the application version, so it has to come from
// `package.json` rather than a second copy that could drift (TASK-026).
const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
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
      // Every application module is measured from TASK-029 on: domain, data, and
      // store code was gated first (TASK-005…007) and the UI trees were only
      // reported on. Test helpers and the entry point are not application code.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
      // Floors are ratchets, not targets: each sits a few points under the
      // measured value at the time it was set (see `docs/TESTING.md`), so an
      // honest regression fails the gate while a refactor that deletes covered
      // code does not. Raise them when the weakest module in a tree improves.
      thresholds: {
        statements: 88,
        branches: 80,
        functions: 85,
        lines: 88,
        'src/app/**': { statements: 88, branches: 76, functions: 88, lines: 88 },
        'src/components/**': { statements: 78, branches: 75, functions: 74, lines: 78 },
        'src/data/**': { statements: 90, branches: 79, functions: 90, lines: 90 },
        'src/domain/**': { statements: 92, branches: 87, functions: 94, lines: 92 },
        'src/features/**': { statements: 82, branches: 74, functions: 84, lines: 82 },
        'src/lib/**': { statements: 88, branches: 81, functions: 86, lines: 88 },
        'src/routes/**': { statements: 74, branches: 67, functions: 71, lines: 74 },
        'src/store/**': { statements: 90, branches: 83, functions: 92, lines: 90 },
      },
    },
  },
});
