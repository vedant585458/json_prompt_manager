/**
 * Network guard (TASK-029).
 *
 * PromptForge is local-first: prompt text never leaves the browser (ADR-01). That
 * promise is easy to keep in review and easy to break by accident — one analytics
 * import, one `fetch` added "just for a health check" — so the test environment
 * makes it impossible instead of trusting intent.
 *
 * Every outbound primitive is replaced with a spy that records the attempt and
 * throws. `src/test/setup.ts` installs the guard for the whole suite and fails a
 * test that attempts a request, so "no external transmission" is a gate rather
 * than a claim.
 */

export interface NetworkAttempt {
  readonly kind: 'fetch' | 'xhr' | 'websocket' | 'eventsource' | 'beacon';
  readonly target: string;
}

let attempts: NetworkAttempt[] = [];
let installed = false;

function record(kind: NetworkAttempt['kind'], target: string): never {
  attempts.push({ kind, target });
  throw new Error(
    `Network access is not allowed in tests (${kind} → ${target}). ` +
      'PromptForge is local-first: nothing may leave the browser. ' +
      'Stub the call in the test instead of letting it reach the network.',
  );
}

/** Replaces every outbound primitive with a recording, throwing spy. */
export function installNetworkGuard(): void {
  if (installed) return;
  installed = true;

  const describeTarget = (input: unknown): string => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (typeof input === 'object' && input !== null && 'url' in input) {
      return String((input as { url: unknown }).url);
    }
    return String(input);
  };

  // `fetch` is the one real apps reach for.
  globalThis.fetch = ((input: unknown) => {
    record('fetch', describeTarget(input));
  }) as unknown as typeof fetch;

  class BlockedXhr {
    open(_method: string, url: string): void {
      record('xhr', url);
    }
    send(): void {
      record('xhr', 'unknown');
    }
  }
  globalThis.XMLHttpRequest = BlockedXhr as unknown as typeof XMLHttpRequest;

  class BlockedWebSocket {
    constructor(url: string) {
      record('websocket', url);
    }
  }
  globalThis.WebSocket = BlockedWebSocket as unknown as typeof WebSocket;

  class BlockedEventSource {
    constructor(url: string) {
      record('eventsource', url);
    }
  }
  globalThis.EventSource = BlockedEventSource as unknown as typeof EventSource;

  if (typeof navigator !== 'undefined') {
    navigator.sendBeacon = ((url: string) => {
      record('beacon', url);
    }) as typeof navigator.sendBeacon;
  }
}

/** Clears the record between tests. */
export function resetNetworkAttempts(): void {
  attempts = [];
}

/** Every attempt recorded since the last reset. */
export function networkAttempts(): readonly NetworkAttempt[] {
  return [...attempts];
}

/**
 * Asserts that nothing tried to leave the browser.
 *
 * `src/test/setup.ts` calls this after every test; a suite can also call it in the
 * middle when the claim under test is specifically "this action makes no request".
 */
export function expectNoNetworkAttempts(): void {
  if (attempts.length === 0) return;

  const listed = attempts.map((attempt) => `${attempt.kind} → ${attempt.target}`).join(', ');
  throw new Error(`This test attempted network access: ${listed}. Nothing may leave the browser.`);
}
