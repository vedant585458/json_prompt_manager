import { vi, type Mock } from 'vitest';

/**
 * jsdom has neither `URL.createObjectURL` nor a download, so export tests
 * replace both (TASK-026).
 *
 * The returned `clicks` records the anchors that were clicked, which is how a
 * test asserts the filename a browser would save. Call `restore()` when done.
 */
export interface DownloadStub {
  readonly createObjectURL: Mock<(blob: Blob) => string>;
  readonly revokeObjectURL: Mock<(url: string) => void>;
  readonly clicks: HTMLAnchorElement[];
  /** File name of the most recent download, or `null`. */
  lastFileName: () => string | null;
  restore: () => void;
}

export function stubDownloads(): DownloadStub {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:promptforge-export');
  const revokeObjectURL = vi.fn<(url: string) => void>();
  const clicks: HTMLAnchorElement[] = [];

  const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  Object.defineProperty(URL, 'createObjectURL', {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    configurable: true,
    writable: true,
  });

  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this);
  });

  return {
    createObjectURL,
    revokeObjectURL,
    clicks,
    lastFileName: () => clicks[clicks.length - 1]?.download ?? null,
    restore: () => {
      click.mockRestore();
      if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor);
      if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
    },
  };
}
