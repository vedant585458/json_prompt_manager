/**
 * Download tests (TASK-026).
 *
 * jsdom has no download, so the helper's contract is asserted instead: the
 * blob it builds, the name the anchor gets, that the click happens, and that
 * the object URL is released afterwards.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadJson, safeDownloadName } from '@/features/transfer/download';

const clicked: HTMLAnchorElement[] = [];

function stubAnchorClick(): void {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
}

afterEach(() => {
  clicked.length = 0;
});

describe('downloadJson', () => {
  it('builds a JSON blob and clicks an anchor with the file name', async () => {
    stubAnchorClick();
    const createObjectURL = vi.fn(() => 'blob:promptforge/1');
    const revokeObjectURL = vi.fn();

    const outcome = downloadJson('promptforge-backup-2026-10-25.json', '{"a":1}', {
      createObjectURL,
      revokeObjectURL,
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(outcome.url).toBe('blob:promptforge/1');
    expect(outcome.fileName).toBe('promptforge-backup-2026-10-25.json');
    expect(outcome.blob.type).toBe('application/json');
    await expect(outcome.blob.text()).resolves.toBe('{"a":1}');
    expect(outcome.bytes).toBe(7);

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe('promptforge-backup-2026-10-25.json');
    expect(clicked[0]?.getAttribute('rel')).toBe('noopener');
    // The anchor is not left behind in the document.
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });

  it('revokes the object URL after the click', async () => {
    vi.useFakeTimers();
    stubAnchorClick();
    const revokeObjectURL = vi.fn();

    downloadJson('file.json', '{}', {
      createObjectURL: () => 'blob:x',
      revokeObjectURL,
    });

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
  });

  it('cleans a name that could be read as a path', () => {
    stubAnchorClick();
    const outcome = downloadJson('../../etc/passwd', '{}', {
      createObjectURL: () => 'blob:y',
      revokeObjectURL: () => undefined,
    });

    expect(outcome.fileName).toBe('etc-passwd');
    expect(clicked[0]?.download).not.toContain('/');
  });
});

describe('safeDownloadName', () => {
  it('keeps ordinary names', () => {
    expect(safeDownloadName('promptforge-prompt-refund-triage-2026-10-25.json')).toBe(
      'promptforge-prompt-refund-triage-2026-10-25.json',
    );
  });

  it('replaces separators, quotes, and control characters', () => {
    expect(safeDownloadName('a/b\\c:d*e?f"g<h>i|j.json')).toBe('a-b-c-d-e-f-g-h-i-j.json');
    expect(safeDownloadName('bad\u0000name.json')).toBe('bad-name.json');
  });

  it('falls back when the name has nothing left', () => {
    expect(safeDownloadName('   ')).toBe('promptforge-export.json');
    expect(safeDownloadName('...')).toBe('promptforge-export.json');
  });
});
