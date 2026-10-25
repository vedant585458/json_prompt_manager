/**
 * Layer-purity guard (TASK-005).
 *
 * The domain layer must stay framework-free so it can be unit-tested without a
 * DOM and reused later by workers or a CLI. This test reads the actual module
 * sources and fails the build if an import or a browser-only API sneaks in.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DOMAIN_DIR = join(process.cwd(), 'src', 'domain');

function moduleNames(): string[] {
  return readdirSync(DOMAIN_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .sort();
}

function sourceOf(file: string): string {
  return readFileSync(join(DOMAIN_DIR, file), 'utf8');
}

/** Removes comments so prose cannot trip the identifier scans below. */
function codeOf(file: string): string {
  return sourceOf(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** All module specifiers imported by a source file. */
function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /from\s+'([^']+)'/g;
  let match = pattern.exec(source);

  while (match) {
    if (match[1]) specifiers.push(match[1]);
    match = pattern.exec(source);
  }

  return specifiers;
}

describe('domain layer purity', () => {
  it('contains the modules promised by the task', () => {
    expect(moduleNames()).toEqual([
      'composer.ts',
      'diff.ts',
      'errors.ts',
      'factories.ts',
      'graph.ts',
      'index.ts',
      'invariants.ts',
      'jsonSchema.ts',
      'jsonText.ts',
      'jsonTree.ts',
      'lab.ts',
      'promptDocument.ts',
      'quality.ts',
      'render.ts',
      'renderDiff.ts',
      'revisions.ts',
      'search.ts',
      'serialization.ts',
      'templates.ts',
      'textDiff.ts',
      'types.ts',
      'validation.ts',
      'variables.ts',
    ]);
  });

  it('imports only from the domain layer', () => {
    for (const file of moduleNames()) {
      const foreign = importsOf(sourceOf(file)).filter(
        (specifier) => !specifier.startsWith('@/domain/'),
      );
      expect(foreign, `${file} must not import outside the domain`).toEqual([]);
    }
  });

  it('never imports React, stores, storage, or UI code', () => {
    const forbidden =
      /^(react|react-dom|zustand|idb|@\/data|@\/store|@\/components|@\/routes|@\/app|@\/styles)/;

    for (const file of moduleNames()) {
      const offenders = importsOf(sourceOf(file)).filter((specifier) => forbidden.test(specifier));
      expect(offenders, `${file} must stay framework-free`).toEqual([]);
    }
  });

  it('never touches browser-only globals or storage', () => {
    // `document` is also a domain variable name (a `PromptDocument`), so the
    // check targets the DOM APIs rather than the identifier.
    const forbidden = [
      /\bwindow\./,
      /\bglobalThis\.document\b/,
      /\bdocument\.(createElement|querySelector|addEventListener|body|head|cookie)\b/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
    ];

    for (const file of moduleNames()) {
      const source = codeOf(file);
      for (const pattern of forbidden) {
        expect(pattern.test(source), `${file} must not use ${String(pattern)}`).toBe(false);
      }
    }
  });

  it('keeps the domain free of `any`', () => {
    for (const file of moduleNames()) {
      expect(/\bany\b/.test(codeOf(file)), `${file} must not use any`).toBe(false);
    }
  });

  it('re-exports every module from the barrel', () => {
    const barrel = sourceOf('index.ts');
    const exported = importsOf(barrel);

    expect(exported.sort()).toEqual([
      '@/domain/composer',
      '@/domain/diff',
      '@/domain/errors',
      '@/domain/factories',
      '@/domain/graph',
      '@/domain/invariants',
      '@/domain/jsonSchema',
      '@/domain/jsonText',
      '@/domain/jsonTree',
      '@/domain/lab',
      '@/domain/promptDocument',
      '@/domain/quality',
      '@/domain/render',
      '@/domain/renderDiff',
      '@/domain/revisions',
      '@/domain/search',
      '@/domain/serialization',
      '@/domain/templates',
      '@/domain/textDiff',
      '@/domain/types',
      '@/domain/validation',
      '@/domain/variables',
    ]);
  });
});
