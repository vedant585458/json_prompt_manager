import { describe, expect, it } from 'vitest';

import {
  ALL_NAV,
  OFF_NAV_LABELS,
  PRIMARY_NAV,
  SECONDARY_NAV,
  crumbsForPath,
  routeLabel,
} from '@/components/layout/navigation';

describe('navigation model', () => {
  it('labels every rail destination by its own label', () => {
    for (const item of ALL_NAV) {
      expect(routeLabel(item.to)).toBe(item.label);
    }
  });

  it('labels the diff screen, which has no rail entry (TASK-030)', () => {
    // Regression: `/diff` used to fall through to "Not found", so the tab, the
    // top bar, and the breadcrumb all told the reader the page did not exist.
    expect(OFF_NAV_LABELS['/diff']).toBe('Diff');
    expect(routeLabel('/diff')).toBe('Diff');
    expect(crumbsForPath('/diff')).toEqual([
      { label: 'Dashboard', to: '/' },
      { label: 'Diff', to: null },
    ]);
  });

  it('treats any prompt screen as one prompt', () => {
    expect(routeLabel('/prompts')).toBe('Prompt');
    expect(routeLabel('/prompts/alpha')).toBe('Prompt');
    expect(routeLabel('/prompts/alpha/history')).toBe('Prompt');
    expect(routeLabel('/prompts/alpha/compose')).toBe('Prompt');
  });

  it('says nothing rather than guessing for a path it does not know', () => {
    expect(routeLabel('/there-is-nothing-here')).toBeNull();
    expect(crumbsForPath('/there-is-nothing-here')).toEqual([{ label: 'Not found', to: null }]);
  });

  it('ignores a trailing slash and keeps the dashboard exact', () => {
    expect(routeLabel('/library/')).toBe('Library');
    expect(routeLabel('/')).toBe('Dashboard');
  });

  it('builds a trail that ends on the current page and links the rest', () => {
    expect(crumbsForPath('/library')).toEqual([
      { label: 'Dashboard', to: '/' },
      { label: 'Library', to: null },
    ]);
    expect(crumbsForPath('/prompts/alpha')).toEqual([
      { label: 'Dashboard', to: '/' },
      { label: 'Library', to: '/library' },
      { label: 'Prompt', to: null },
    ]);
    expect(crumbsForPath('/')).toEqual([{ label: 'Dashboard', to: null }]);
  });

  it('keeps the primary and secondary groups disjoint', () => {
    const primary = new Set(PRIMARY_NAV.map((item) => item.to));
    for (const item of SECONDARY_NAV) expect(primary.has(item.to)).toBe(false);
  });
});
