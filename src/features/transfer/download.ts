/**
 * Downloading a generated file (TASK-026).
 *
 * One function, because a browser download has three parts that must all
 * happen: a Blob with the right type, an object URL that is released afterwards,
 * and an anchor with a `download` name. Doing it inline in three components
 * would mean three chances to leak a URL.
 *
 * The pieces are injectable so a jsdom test can assert exactly what this does:
 * the blob's MIME type and contents, the filename handed to the anchor, that the
 * anchor was clicked, and that the URL was revoked.
 */

/** How long to wait before releasing the object URL, in milliseconds. */
export const REVOKE_DELAY_MS = 0;

export interface DownloadOptions {
  readonly document?: Document;
  readonly createObjectURL?: (blob: Blob) => string;
  readonly revokeObjectURL?: (url: string) => void;
  readonly revokeDelayMs?: number;
}

export interface DownloadOutcome {
  readonly blob: Blob;
  readonly fileName: string;
  readonly url: string;
  /** Size of the blob the browser was handed, in bytes. */
  readonly bytes: number;
}

/** Anything a browser could treat as a path or a shell metacharacter. */
const UNSAFE_NAME = /[\\/:*?"<>|]/g;

/** Control characters are replaced separately: a regex for them is unreadable. */
function stripControlCharacters(value: string): string {
  let out = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? '-' : character;
  }
  return out;
}

/**
 * Defensive filename cleaning.
 *
 * The domain already builds names from a slug, so this is a second pair of
 * hands: a caller that passes something else still cannot produce a name with a
 * separator or a quote in it.
 */
export function safeDownloadName(fileName: string): string {
  const cleaned = stripControlCharacters(fileName)
    .replace(UNSAFE_NAME, '-')
    .replace(/^[-.]+/, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'promptforge-export.json';
}

/**
 * Hands `json` to the browser as a downloadable file.
 *
 * The object URL is revoked on the next tick rather than immediately: a
 * synchronous revoke can cancel the download in some browsers, and an
 * unrevoked URL keeps the blob alive for the life of the page.
 */
export function downloadJson(
  fileName: string,
  json: string,
  options: DownloadOptions = {},
): DownloadOutcome {
  const doc = options.document ?? document;
  const createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));

  const blob = new Blob([json], { type: 'application/json' });
  const url = createObjectURL(blob);
  const name = safeDownloadName(fileName);

  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => revokeObjectURL(url), options.revokeDelayMs ?? REVOKE_DELAY_MS);

  return { blob, fileName: name, url, bytes: blob.size };
}
