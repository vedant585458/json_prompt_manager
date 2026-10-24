import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  PARSE_DEBOUNCE_MS,
  isLargeJsonText,
  jsonTextStats,
  scanJson,
  type JsonSyntaxError,
  type JsonTextStats,
} from '@/domain/jsonText';
import type { JsonValue } from '@/domain/types';
import {
  clearStoredDraft,
  readStoredDraft,
  writeStoredDraft,
  type StoredDraft,
} from '@/features/editor/draftStorage';

/** Parse results for the current text. */
export interface DraftParse {
  readonly value: JsonValue | null;
  readonly error: JsonSyntaxError | null;
  /** True while a debounced parse is still pending. */
  readonly checking: boolean;
}

export interface UseDocumentDraftOptions {
  readonly promptId: string;
  /** Text of the stored document — the base a draft is compared against. */
  readonly savedText: string;
  /** `updatedAt` of that stored document, recorded with the draft. */
  readonly savedUpdatedAt: string;
  /** Override for tests; defaults to `PARSE_DEBOUNCE_MS`. */
  readonly debounceMs?: number;
  /** Override for tests; defaults to `window.localStorage`. */
  readonly storage?: Storage | null;
}

export interface DocumentDraft {
  readonly text: string;
  readonly setText: (next: string) => void;
  /** Discards edits and returns to the stored text. */
  readonly reset: () => void;
  readonly dirty: boolean;
  readonly parse: DraftParse;
  readonly stats: JsonTextStats;
  readonly largeDocument: boolean;
  readonly recovery: StoredDraft | null;
  readonly restoreRecovery: () => void;
  readonly discardRecovery: () => void;
  /** True when at least one draft write has landed in storage. */
  readonly draftPersisted: boolean;
}

const DRAFT_WRITE_DELAY_MS = 300;

/**
 * Owns the editor's local draft (TASK-014).
 *
 * The text is component state; the *parse* is debounced so a fast typist does
 * not pay for a parse per keystroke; the recovery copy is written to
 * `localStorage` after a short pause. Nothing here writes to the database — the
 * status bar says so.
 */
export function useDocumentDraft({
  promptId,
  savedText,
  savedUpdatedAt,
  debounceMs = PARSE_DEBOUNCE_MS,
  storage,
}: UseDocumentDraftOptions): DocumentDraft {
  const [text, setTextState] = useState(savedText);
  const [parse, setParse] = useState<DraftParse>(() => {
    const result = scanJson(savedText);
    return {
      value: result.ok ? result.value : null,
      error: result.ok ? null : result.error,
      checking: false,
    };
  });
  const [recovery, setRecovery] = useState<StoredDraft | null>(() => {
    const draft = readStoredDraft(promptId, storage);
    return draft && draft.text !== savedText ? draft : null;
  });
  const [draftPersisted, setDraftPersisted] = useState(false);

  const firstRun = useRef(true);
  const dirty = text !== savedText;
  const largeDocument = isLargeJsonText(text);
  const stats = useMemo(() => jsonTextStats(text), [text]);

  // A different prompt (or a new saved base) means a different draft.
  useEffect(() => {
    const draft = readStoredDraft(promptId, storage);
    const result = scanJson(savedText);

    setTextState(savedText);
    setParse({
      value: result.ok ? result.value : null,
      error: result.ok ? null : result.error,
      checking: false,
    });
    setRecovery(draft && draft.text !== savedText ? draft : null);
    firstRun.current = true;
  }, [promptId, savedText, storage]);

  // Debounced parse. The first render already parsed synchronously, so the
  // effect skips it and the status bar does not flash "Checking…" on mount.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    setParse((current) => ({ ...current, checking: true }));

    const timer = setTimeout(
      () => {
        const result = scanJson(text);
        setParse({
          value: result.ok ? result.value : null,
          error: result.ok ? null : result.error,
          checking: false,
        });
      },
      // A large document is parsed less often; the guard exists so typing stays
      // responsive instead of blocking on a multi-megabyte parse.
      largeDocument ? debounceMs * 3 : debounceMs,
    );

    return () => clearTimeout(timer);
  }, [text, debounceMs, largeDocument]);

  // Recovery copy: write when dirty, remove when clean.
  useEffect(() => {
    if (!dirty) {
      clearStoredDraft(promptId, storage);
      setDraftPersisted(false);
      return;
    }

    const timer = setTimeout(() => {
      const stored = writeStoredDraft(
        { promptId, text, savedAt: new Date().toISOString(), baseUpdatedAt: savedUpdatedAt },
        storage,
      );
      setDraftPersisted(stored);
    }, DRAFT_WRITE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [dirty, promptId, savedUpdatedAt, storage, text]);

  // Browsers only show the native "leave site?" prompt; in-app navigation is
  // guarded by the route's dialog.
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const setText = useCallback((next: string) => setTextState(next), []);

  const reset = useCallback(() => setTextState(savedText), [savedText]);

  const restoreRecovery = useCallback(() => {
    if (!recovery) return;
    setTextState(recovery.text);
    setRecovery(null);
  }, [recovery]);

  const discardRecovery = useCallback(() => {
    clearStoredDraft(promptId, storage);
    setRecovery(null);
  }, [promptId, storage]);

  return {
    text,
    setText,
    reset,
    dirty,
    parse,
    stats,
    largeDocument,
    recovery,
    restoreRecovery,
    discardRecovery,
    draftPersisted,
  };
}
