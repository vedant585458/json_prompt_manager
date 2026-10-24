import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  // Module boundary (TASK-006): the data layer is UI-agnostic. It must not
  // import React, components, stores, or styling helpers, so it stays testable
  // without a DOM and cannot grow a hidden dependency on the presentation layer.
  {
    files: ['src/data/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react/*',
                'react-dom/*',
                '@/components/*',
                '@/components',
                '@/app/*',
                '@/routes/*',
                '@/store/*',
                '@/styles/*',
                '@/test/*',
                'zustand',
                'lucide-react',
                '@radix-ui/*',
                'clsx',
                'tailwind-merge',
              ],
              message:
                'The data layer must stay UI-agnostic. Move presentation concerns out of src/data.',
            },
          ],
        },
      ],
    },
  },
  // Everything outside the data layer talks to storage through `@/data` only,
  // so adapter selection stays in one place and no screen can couple itself to
  // IndexedDB (TASK-006 boundary).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/data/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data/repositories/*', '@/data/adapters/*', '@/data/db/*'],
              message:
                'Import storage through @/data instead of a concrete adapter or database module.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
);
