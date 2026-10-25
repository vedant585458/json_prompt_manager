/**
 * The save pipeline (TASK-015).
 *
 * One place owns the editor draft's relationship with storage:
 *
 * - the **text** stays local until a save is confirmed; a status can say
 *   "Saving…" but never "Saved" before the write resolves;
 * - **writes are serialized** per prompt through the shared write queue, so a
 *   slow save cannot land after a newer one;
 * - **autosave** is a debounce driven by the autosave preferences, and an
 *   explicit `Mod+S` always writes immediately;
 * - a **stale write** (another tab, or a version this draft was not based on) is
 *   a conflict with three explicit outcomes — never a silent overwrite;
 * - a **recovery draft** is mirrored to `localStorage` while dirty and cleared
 *   only after storage confirmed the write;
 * - **ephemeral mode** disables saving outright while keeping recovery drafts.
 *
 * The hook deliberately owns no rendering: the editor composes `SaveStatus` and
 * the conflict dialog from the values returned here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StaleWriteError, type WriteBroadcaster, type WriteQueue } from '@/data';
import { scanJson } from '@/domain/jsonText';
import { validatePromptDocument } from '@/domain/promptDocument';
import { formatDocument } from '@/domain/serialization';
import type { Prompt, PromptDocument, PromptRevision } from '@/domain/types';
import { useDocumentDraft } from '@/features/editor/useDocumentDraft';
import {
  canRecover,
  clearRecovery,
  readRecovery,
  writeRecovery,
  type RecoveryCandidate,
} from '@/features/save/recoveryStorage';
import { getSaveQueue, getWriteBroadcaster } from '@/features/save/saveBus';
import { describeDataError, type DataStore } from '@/store/dataStore';
import { usePreferencesStore, type PreferencesStore } from '@/store/preferences';

/** The single state the save status component renders. */
export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'disabled';

export type SaveReason = 'auto' | 'manual' | 'retry';

/** A save that lost a version race, with what storage holds now. */
export interface SaveConflict {
  /** Version the draft was based on when the conflict was detected. */
  readonly baseVersion: number;
  /** Version currently in storage (equal to `baseVersion` when unreadable). */
  readonly storedVersion: number;
  /** Canonical text of the stored document; `null` when it could not be read. */
  readonly storedText: string | null;
  readonly storedUpdatedAt: string | null;
  readonly detectedAt: string;
}

/** A write by another tab, surfaced without touching this tab's draft. */
export interface RemoteWriteNotice {
  readonly version: number;
  readonly at: string;
}

/** Revision creation, delegated so TASK-019 can replace the implementation. */
export interface SnapshotService {
  createSnapshot: (promptId: string, label?: string | null) => Promise<PromptRevision>;
}

export type SnapshotResult =
  | { readonly ok: true; readonly revision: PromptRevision }
  | { readonly ok: false; readonly reason: string };

export interface UseSavePipelineOptions {
  readonly prompt: Prompt | null;
  readonly store: DataStore;
  readonly preferences?: PreferencesStore;
  /** Recovery storage; defaults to `window.localStorage`. */
  readonly storage?: Storage | null;
  readonly queue?: WriteQueue;
  readonly broadcaster?: WriteBroadcaster;
  readonly snapshotService?: SnapshotService;
  readonly now?: () => Date;
  /** How long a dirty draft waits before it is mirrored; defaults to 400 ms. */
  readonly recoveryDelayMs?: number;
  readonly parseDebounceMs?: number;
  /** The indent the canonical stored text is rendered with. */
  readonly indent?: 2 | 4;
  /**
   * A sentence explaining why this draft must not be written yet (TASK-017).
   *
   * When set, autosave and explicit saves are skipped rather than writing a
   * document the caller knows is wrong. The route renders the reason; the
   * pipeline stays honest about the draft being dirty and unsaved.
   */
  readonly blockedReason?: string | null;
  /**
   * Re-opens storage after it failed to open (TASK-015 follow-up).
   *
   * In ephemeral mode there is nothing a save can do, so Retry asks this to
   * boot storage again instead of repeating a write that cannot land.
   */
  readonly onReconnectStorage?: (() => void) | null;
}

export interface SavePipeline {
  // The draft (owned by `useDocumentDraft`, persisted here).
  readonly text: string;
  readonly setText: (next: string) => void;
  readonly dirty: boolean;
  readonly parse: ReturnType<typeof useDocumentDraft>['parse'];
  readonly stats: ReturnType<typeof useDocumentDraft>['stats'];
  readonly largeDocument: boolean;

  // Saving.
  readonly state: SaveState;
  readonly saving: boolean;
  readonly durable: boolean;
  readonly lastSavedAt: string | null;
  readonly error: { readonly message: string; readonly detail: string | null } | null;
  /** True when pressing Retry can plausibly help (not for a refused document). */
  readonly retryable: boolean;
  /** Explains an explicit save that had nothing to write; `null` otherwise. */
  readonly notice: string | null;
  /** True when storage can be re-opened from the save bar. */
  readonly canReconnect: boolean;
  readonly saveNow: (reason?: SaveReason) => Promise<boolean>;
  readonly retry: () => Promise<boolean>;

  // Conflicts.
  readonly conflict: SaveConflict | null;
  /** Opens the conflict dialog for a write announced by another tab. */
  readonly reviewConflict: () => Promise<void>;
  readonly reloadStoredVersion: () => Promise<boolean>;
  readonly keepDraftAsNew: () => Promise<boolean>;
  readonly dismissConflict: () => void;

  // Another tab.
  readonly remote: RemoteWriteNotice | null;
  readonly dismissRemote: () => void;

  // Recovery.
  readonly recovery: RecoveryCandidate | null;
  readonly recoveryAvailable: boolean;
  readonly restoreRecovery: () => void;
  readonly discardRecovery: () => void;

  // Revisions.
  readonly canSnapshot: boolean;
  readonly snapshot: (label?: string | null) => Promise<SnapshotResult>;
}

interface Baseline {
  /** Text known to be in storage (the text a save sent, or the stored text). */
  readonly text: string;
  readonly version: number;
  readonly updatedAt: string | null;
}

type SaveResult =
  | { readonly kind: 'saved' }
  /** An explicit save of a draft that already matches storage: nothing was written. */
  | { readonly kind: 'unchanged' }
  /**
   * A save the caller asked the pipeline to hold back (TASK-017).
   *
   * The draft stays dirty and no error is raised — the reason belongs to the
   * route — but the attempt is reported rather than swallowed, so pressing the
   * shortcut on a held draft says why nothing happened.
   */
  | { readonly kind: 'held'; readonly message: string | null }
  | {
      readonly kind: 'error';
      readonly message: string;
      readonly detail: string | null;
      /**
       * Whether pressing Retry could plausibly change anything. A refused
       * document or a blocked draft fails the same way until the text or the
       * reason changes, so offering "Retry" there would be a dead control.
       */
      readonly retryable: boolean;
    };

/** What a queued write produced; the caller decides what the UI says. */
type SaveAttempt =
  | {
      readonly kind: 'invalid';
      readonly text: string;
      readonly message: string;
      readonly detail: string | null;
    }
  | { readonly kind: 'saved'; readonly text: string; readonly saved: Prompt };

const RECOVERY_DELAY_MS = 400;

/**
 * Marks a refusal that is identical to the previous one.
 *
 * Pressing Save now twice on the same broken document produces the same words;
 * without this note the screen would look frozen. It is a statement about the
 * draft, not a success message.
 */
function describeRepeated(detail: string | null, repeated: boolean): string | null {
  if (!repeated) return detail;
  const note = 'This is the same text as the last attempt, so nothing changed.';
  return detail ? `${detail} — ${note}` : note;
}

/**
 * Why the explicit save cannot run right now, in words.
 *
 * A disabled control with no explanation reads as a broken control, which is
 * exactly how the save bar was reported. Every disabled state has a sentence.
 */
export function describeSaveDisabled(
  save: Pick<SavePipeline, 'durable' | 'saving' | 'conflict'>,
): string | null {
  if (!save.durable) {
    return 'Saving is off: storage did not open, so nothing can be written in this mode.';
  }
  if (save.saving) return 'A save is already in progress.';
  if (save.conflict) return 'Resolve the version conflict before saving.';
  return null;
}

/**
 * The editor's save pipeline.
 *
 * `prompt` is `null` before the record is known; the hook then does nothing and
 * reports `clean`, which is honest — there is no draft to save.
 */
export function useSavePipeline({
  prompt,
  store,
  preferences = usePreferencesStore,
  storage,
  queue,
  broadcaster,
  snapshotService,
  now,
  recoveryDelayMs = RECOVERY_DELAY_MS,
  parseDebounceMs,
  indent = 2,
  blockedReason = null,
  onReconnectStorage = null,
}: UseSavePipelineOptions): SavePipeline {
  const blocked = blockedReason !== null && blockedReason.length > 0;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const blockedReasonRef = useRef(blockedReason);
  blockedReasonRef.current = blockedReason;
  const reconnectRef = useRef(onReconnectStorage);
  reconnectRef.current = onReconnectStorage;

  const promptId = prompt?.id ?? '';
  const mode = store((state) => state.mode);
  const durable = mode === 'durable';
  const autosaveEnabled = preferences((state) => state.autosaveEnabled);
  const autosaveDelayMs = preferences((state) => state.autosaveDelayMs);

  const savedText = useMemo(
    () => (prompt ? formatDocument(prompt.content, indent) : ''),
    [prompt, indent],
  );

  const draft = useDocumentDraft({
    promptId,
    savedText,
    savedUpdatedAt: prompt?.updatedAt ?? '',
    ...(parseDebounceMs === undefined ? {} : { debounceMs: parseDebounceMs }),
    ...(storage === undefined ? {} : { storage }),
    // The pipeline owns recovery (it records the base version) and never resets
    // the text from a store echo (that would drop characters typed mid-write).
    manageRecovery: false,
    resetOnSavedChange: false,
  });

  const writeQueue = queue ?? getSaveQueue();
  const writeBroadcaster = broadcaster ?? getWriteBroadcaster();
  const nowRef = useRef(now ?? (() => new Date()));
  const storageRef = useRef(storage);

  const [baseline, setBaseline] = useState<Baseline>(() => ({
    text: savedText,
    version: prompt?.version ?? 0,
    updatedAt: prompt?.updatedAt ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const [remote, setRemote] = useState<RemoteWriteNotice | null>(null);
  const [recovery, setRecovery] = useState<RecoveryCandidate | null>(null);

  const baselineRef = useRef(baseline);
  const promptIdRef = useRef(promptId);
  const savedTextRef = useRef(savedText);
  const savedUpdatedAtRef = useRef(prompt?.updatedAt ?? '');
  const savedVersionRef = useRef(prompt?.version ?? 0);
  const { setText: setDraftText } = draft;
  const textRef = useRef(draft.text);
  const setTextRef = useRef(setDraftText);
  const baseVersionRef = useRef(prompt?.version ?? 0);
  const savingRef = useRef(false);
  const conflictRef = useRef<SaveConflict | null>(null);
  const recoveryRef = useRef<RecoveryCandidate | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const previousPromptIdRef = useRef(promptId);
  const failedTextRef = useRef<string | null>(null);
  const savingReasonRef = useRef<SaveReason>('manual');

  promptIdRef.current = promptId;
  savedTextRef.current = savedText;
  savedUpdatedAtRef.current = prompt?.updatedAt ?? '';
  savedVersionRef.current = prompt?.version ?? 0;
  textRef.current = draft.text;
  setTextRef.current = setDraftText;
  savingRef.current = saving;
  conflictRef.current = conflict;
  recoveryRef.current = recovery;

  const applyBaseline = useCallback((next: Baseline) => {
    baselineRef.current = next;
    setBaseline(next);
  }, []);

  /**
   * Moves both the draft and the persisted baseline to `text`.
   *
   * Used when the editor must show what storage holds (a reload after a
   * conflict): the baseline moves first so the text never looks dirty for a
   * frame.
   */
  const setTextAndBaseline = useCallback(
    (text: string, version: number, updatedAt: string | null) => {
      applyBaseline({ text, version, updatedAt });
      setTextRef.current(text);
      setDraftText(text);
    },
    [applyBaseline, setDraftText],
  );

  const dirty = draft.text !== baseline.text;

  // ------------------------------------------------------------------------- //
  // Lifecycle: a new prompt means a new baseline, and a new recovery check.
  // ------------------------------------------------------------------------- //
  useEffect(() => {
    if (previousPromptIdRef.current === promptId) return;
    previousPromptIdRef.current = promptId;

    const next: Baseline = {
      text: savedTextRef.current,
      version: savedVersionRef.current,
      updatedAt: savedUpdatedAtRef.current || null,
    };
    applyBaseline(next);
    baseVersionRef.current = next.version;
    setSaving(false);
    setResult(null);
    setConflict(null);
    setRemote(null);
    setLastSavedAt(null);
    inFlightRef.current = null;
  }, [applyBaseline, promptId]);

  // Recovery is offered once, when the prompt is opened (or changed).
  useEffect(() => {
    if (!promptId) {
      setRecovery(null);
      return;
    }

    setRecovery(
      readRecovery({
        promptId,
        storedText: savedTextRef.current,
        storedVersion: savedVersionRef.current,
        ...(storageRef.current === undefined ? {} : { storage: storageRef.current }),
      }),
    );
  }, [promptId]);

  // ------------------------------------------------------------------------- //
  // External writes: adopt metadata-only bumps, surface content changes.
  // ------------------------------------------------------------------------- //
  useEffect(() => {
    if (!prompt || !promptId) return;
    if (prompt.version === baseVersionRef.current) return;
    if (savingRef.current) return;
    if (prompt.version < baseVersionRef.current) return;

    const storedNow = savedTextRef.current;

    // A version bump that did not change the document (a title edit, a favorite)
    // is not a conflict: adopt it so the next save is not rejected for nothing.
    if (storedNow === baselineRef.current.text) {
      baseVersionRef.current = prompt.version;
      applyBaseline({
        text: baselineRef.current.text,
        version: prompt.version,
        updatedAt: prompt.updatedAt,
      });
      return;
    }

    baseVersionRef.current = prompt.version;

    if (textRef.current === baselineRef.current.text) {
      // Nothing local to lose: move the editor to what is stored now.
      setTextAndBaseline(storedNow, prompt.version, prompt.updatedAt);
      setRemote(null);
      clearRecovery(promptId, storageRef.current);
      return;
    }

    setRemote((current) =>
      current && current.version >= prompt.version
        ? current
        : { version: prompt.version, at: prompt.updatedAt },
    );
  }, [applyBaseline, prompt, promptId, setTextAndBaseline]);

  // ------------------------------------------------------------------------- //
  // Cross-tab announcements.
  // ------------------------------------------------------------------------- //
  useEffect(() => {
    if (!writeBroadcaster.supported) return;

    return writeBroadcaster.subscribe((announcement) => {
      if (announcement.type !== 'prompt-written') return;
      if (announcement.promptId !== promptIdRef.current) return;
      if (announcement.version <= baseVersionRef.current) return;

      setRemote({ version: announcement.version, at: announcement.at });
    });
  }, [writeBroadcaster]);

  // ------------------------------------------------------------------------- //
  // Recovery mirroring: written while dirty, cleared only after a write lands.
  // ------------------------------------------------------------------------- //
  useEffect(() => {
    if (!promptId) return;

    if (!dirty) {
      clearRecovery(promptId, storageRef.current);
      return;
    }

    const text = draft.text;
    const timer = setTimeout(() => {
      writeRecovery({
        promptId,
        text,
        baseVersion: baseVersionRef.current,
        baseUpdatedAt: savedUpdatedAtRef.current,
        now: nowRef.current,
        ...(storageRef.current === undefined ? {} : { storage: storageRef.current }),
      });
    }, recoveryDelayMs);

    return () => clearTimeout(timer);
  }, [dirty, draft.text, promptId, recoveryDelayMs]);

  // ------------------------------------------------------------------------- //
  // Saving.
  // ------------------------------------------------------------------------- //
  const describeConflict = useCallback(
    async (id: string, baseVersion: number): Promise<SaveConflict> => {
      const detectedAt = nowRef.current().toISOString();
      let storedText: string | null = null;
      let storedVersion = baseVersion;
      let storedUpdatedAt: string | null = null;

      try {
        const stored = await store.getState().readStoredPrompt(id);
        if (stored) {
          storedVersion = stored.version;
          storedUpdatedAt = stored.updatedAt;
          storedText = formatDocument(stored.content, indent);
        }
      } catch {
        // The dialog still opens, without a preview, and a retry can read it.
      }

      return { baseVersion, storedVersion, storedText, storedUpdatedAt, detectedAt };
    },
    [indent, store],
  );

  const openConflict = useCallback(
    async (id: string, baseVersion: number) => {
      setResult(null);
      setConflict({
        baseVersion,
        storedVersion: baseVersion,
        storedText: null,
        storedUpdatedAt: null,
        detectedAt: nowRef.current().toISOString(),
      });
      setConflict(await describeConflict(id, baseVersion));
    },
    [describeConflict],
  );

  const prepareContent = useCallback(
    (
      text: string,
    ):
      | { readonly ok: true; readonly content: PromptDocument }
      | { readonly ok: false; readonly message: string; readonly detail: string | null } => {
      const scanned = scanJson(text);
      if (!scanned.ok) {
        return {
          ok: false,
          message: 'This text is not valid JSON, so it was not saved.',
          detail: `Line ${scanned.error.line}, column ${scanned.error.column}: ${scanned.error.message}`,
        };
      }

      const validated = validatePromptDocument(scanned.value);
      if (!validated.ok) {
        const issue = validated.issues.find((candidate) => candidate.severity === 'error');
        return {
          ok: false,
          message: 'This document is not a valid prompt, so it was not saved.',
          detail: issue ? `${issue.path || 'document'}: ${issue.message}` : null,
        };
      }

      return { ok: true, content: validated.value };
    },
    [],
  );

  const saveNow = useCallback(
    async (reason: SaveReason = 'manual'): Promise<boolean> => {
      const id = promptIdRef.current;
      if (!id) return false;

      if (!durable) {
        setResult({
          kind: 'error',
          message: 'Saving is off in ephemeral mode.',
          detail:
            'Storage did not open, so nothing can be written. Your draft is still kept in this browser.',
          // Re-opening storage is the only retry that can change this.
          retryable: reconnectRef.current !== null,
        });
        return false;
      }

      if (blockedRef.current) {
        // Pressing the shortcut on a draft the route refused to write says why,
        // instead of doing nothing. The state stays "unsaved changes": nothing
        // failed, the write is being held back on purpose.
        setResult({ kind: 'held', message: blockedReasonRef.current });
        return false;
      }

      if (conflictRef.current) return false;

      const inFlight = inFlightRef.current;
      if (inFlight) return inFlight;

      // Nothing changed since the last confirmed write: do not bump a version for
      // an empty save, and do not claim a write happened.
      if (textRef.current === baselineRef.current.text) {
        setResult({ kind: 'unchanged' });
        return true;
      }

      // Any new attempt leaves the previous failure behind, so the status region
      // visibly changes even when the attempt fails the same way again.
      setResult(null);

      // Fail fast on the text as it is now, so a syntax error is reported on the
      // keystroke instead of after a round trip.
      const text = textRef.current;
      const prepared = prepareContent(text);
      if (!prepared.ok) {
        // The same text cannot start working on its own: mark it not retryable,
        // and say so when the same refusal happens twice.
        const repeated = failedTextRef.current === text;
        failedTextRef.current = text;
        setResult({
          kind: 'error',
          message: prepared.message,
          detail: describeRepeated(prepared.detail, repeated),
          retryable: false,
        });
        return false;
      }

      failedTextRef.current = null;
      savingReasonRef.current = reason;
      setSaving(true);

      const attempt = writeQueue
        .run(id, async (): Promise<SaveAttempt> => {
          // The queue may have waited behind an earlier write; save the text as it
          // is *now*, so a fast edit is not silently left behind.
          const snapshot = textRef.current;
          const latest = prepareContent(snapshot);

          if (!latest.ok) {
            return {
              kind: 'invalid',
              text: snapshot,
              message: latest.message,
              detail: latest.detail,
            };
          }

          const saved = await store
            .getState()
            .editPrompt(
              id,
              { content: latest.content },
              { expectedVersion: baseVersionRef.current },
            );

          return { kind: 'saved', text: snapshot, saved };
        })
        .then((outcome) => {
          if (outcome.kind === 'invalid') {
            const repeated = failedTextRef.current === outcome.text;
            failedTextRef.current = outcome.text;
            setResult({
              kind: 'error',
              message: outcome.message,
              detail: describeRepeated(outcome.detail, repeated),
              retryable: false,
            });
            return false;
          }

          const { saved, text: written } = outcome;
          baseVersionRef.current = saved.version;

          if (textRef.current === written) {
            // Safe to canonicalize: nothing was typed while the write was in flight.
            setTextAndBaseline(
              formatDocument(saved.content, indent),
              saved.version,
              saved.updatedAt,
            );
          } else {
            // The user kept typing; their text wins, and it stays unsaved.
            applyBaseline({ text: written, version: saved.version, updatedAt: saved.updatedAt });
          }

          clearRecovery(id, storageRef.current);
          failedTextRef.current = null;
          setLastSavedAt(saved.updatedAt);
          setResult({ kind: 'saved' });
          setRemote(null);

          if (writeBroadcaster.supported) {
            writeBroadcaster.announcePromptWrite({ id, version: saved.version });
          }

          return true;
        })
        .catch(async (caught: unknown) => {
          if (caught instanceof StaleWriteError) {
            await openConflict(id, baseVersionRef.current);
            return false;
          }

          failedTextRef.current = textRef.current;
          setResult({
            kind: 'error',
            message: 'The prompt was not saved.',
            detail: describeDataError(caught),
            retryable: true,
          });
          return false;
        })
        .finally(() => {
          inFlightRef.current = null;
          setSaving(false);
        });

      inFlightRef.current = attempt;
      return attempt;
    },
    [
      applyBaseline,
      durable,
      indent,
      openConflict,
      prepareContent,
      setTextAndBaseline,
      store,
      writeBroadcaster,
      writeQueue,
    ],
  );

  const retry = useCallback(async (): Promise<boolean> => {
    const reconnect = reconnectRef.current;

    // With storage closed there is nothing to write to: retrying the save would
    // repeat a doomed call. Re-opening storage is the retry that can work.
    if (!durable && reconnect) {
      setResult(null);
      reconnect();
      return false;
    }

    return saveNow('retry');
  }, [durable, saveNow]);

  // `Mod+S` / `Ctrl+S` writes immediately, from anywhere on the screen.
  useEffect(() => {
    if (!promptId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== 's') return;

      event.preventDefault();
      void saveNow('manual');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [promptId, saveNow]);

  // Autosave: a debounce over the latest text, restarted by every keystroke.
  useEffect(() => {
    if (!durable || blocked || !autosaveEnabled || !dirty || conflict || saving) return;
    if (draft.parse.error) return;
    // The same text already failed once (a rejected document): retrying it on a
    // timer would hammer storage with a write that cannot succeed.
    if (failedTextRef.current === draft.text) return;

    const timer = setTimeout(() => void saveNow('auto'), autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [
    autosaveDelayMs,
    autosaveEnabled,
    blocked,
    conflict,
    dirty,
    draft.parse.error,
    durable,
    saveNow,
    saving,
    // Restart the countdown on every edit.
    draft.text,
  ]);

  // ------------------------------------------------------------------------- //
  // Conflict resolution.
  // ------------------------------------------------------------------------- //
  const reloadStoredVersion = useCallback(async (): Promise<boolean> => {
    const id = promptIdRef.current;
    if (!id) return false;

    try {
      const stored = await store.getState().readStoredPrompt(id);
      if (!stored) {
        setResult({
          kind: 'error',
          message: 'The stored version could not be read.',
          detail: 'The prompt may have been deleted in another tab.',
          retryable: false,
        });
        return false;
      }

      const text = formatDocument(stored.content, indent);
      baseVersionRef.current = stored.version;
      setTextAndBaseline(text, stored.version, stored.updatedAt);
      clearRecovery(id, storageRef.current);
      setConflict(null);
      setRemote(null);
      setResult(null);
      setLastSavedAt(stored.updatedAt);

      // Bring the rest of the app (title, lists, activity) back in step.
      await store.getState().hydrate();
      return true;
    } catch (caught) {
      setResult({
        kind: 'error',
        message: 'The stored version could not be read.',
        detail: describeDataError(caught),
        retryable: true,
      });
      return false;
    }
  }, [indent, setTextAndBaseline, store]);

  const keepDraftAsNew = useCallback(async (): Promise<boolean> => {
    const id = promptIdRef.current;
    if (!id) return false;

    const text = textRef.current;
    const scanned = scanJson(text);
    if (!scanned.ok) {
      setResult({
        kind: 'error',
        message: 'Your draft is not valid JSON, so it could not be saved over the stored version.',
        detail: `Line ${scanned.error.line}, column ${scanned.error.column}: ${scanned.error.message}`,
        retryable: false,
      });
      return false;
    }

    const validated = validatePromptDocument(scanned.value);
    if (!validated.ok) {
      const issue = validated.issues.find((candidate) => candidate.severity === 'error');
      setResult({
        kind: 'error',
        message: 'Your draft is not a valid prompt, so it could not be saved.',
        detail: issue ? `${issue.path || 'document'}: ${issue.message}` : null,
        retryable: false,
      });
      return false;
    }

    const content = validated.value;
    setSaving(true);

    try {
      const stored = await store.getState().readStoredPrompt(id);
      const saved = await writeQueue.run(id, () =>
        store
          .getState()
          .editPrompt(id, { content }, stored ? { expectedVersion: stored.version } : undefined),
      );

      baseVersionRef.current = saved.version;

      if (textRef.current === text) {
        setTextAndBaseline(formatDocument(saved.content, indent), saved.version, saved.updatedAt);
      } else {
        applyBaseline({ text, version: saved.version, updatedAt: saved.updatedAt });
      }

      clearRecovery(id, storageRef.current);
      setLastSavedAt(saved.updatedAt);
      setConflict(null);
      setRemote(null);
      setResult({ kind: 'saved' });

      if (writeBroadcaster.supported) {
        writeBroadcaster.announcePromptWrite({ id, version: saved.version });
      }

      return true;
    } catch (caught) {
      if (caught instanceof StaleWriteError) {
        await openConflict(id, baseVersionRef.current);
      } else {
        setResult({
          kind: 'error',
          message: 'Your draft was not saved over the stored version.',
          detail: describeDataError(caught),
          retryable: true,
        });
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    applyBaseline,
    indent,
    openConflict,
    setTextAndBaseline,
    store,
    writeBroadcaster,
    writeQueue,
  ]);

  const reviewConflict = useCallback(async () => {
    const id = promptIdRef.current;
    if (id) await openConflict(id, baseVersionRef.current);
  }, [openConflict]);

  const dismissConflict = useCallback(() => setConflict(null), []);
  const dismissRemote = useCallback(() => setRemote(null), []);

  // ------------------------------------------------------------------------- //
  // Recovery actions.
  // ------------------------------------------------------------------------- //
  const restoreRecovery = useCallback(() => {
    const candidate = recoveryRef.current;
    if (!candidate) return;

    setTextRef.current(candidate.draft.text);
    setRecovery(null);
  }, []);

  const discardRecovery = useCallback(() => {
    if (promptIdRef.current) clearRecovery(promptIdRef.current, storageRef.current);
    setRecovery(null);
  }, []);

  // ------------------------------------------------------------------------- //
  // Revisions.
  // ------------------------------------------------------------------------- //
  const snapshotServiceRef = useRef<SnapshotService>(
    snapshotService ?? {
      createSnapshot: (id, label) => store.getState().snapshotPrompt(id, label ?? null),
    },
  );
  snapshotServiceRef.current =
    snapshotService ??
    ({
      createSnapshot: (id, label) => store.getState().snapshotPrompt(id, label ?? null),
    } satisfies SnapshotService);

  const canSnapshot = durable && !dirty && !saving && conflict === null;

  const snapshot = useCallback(
    async (label?: string | null): Promise<SnapshotResult> => {
      const id = promptIdRef.current;
      if (!id) return { ok: false, reason: 'There is no prompt to snapshot.' };
      if (!canSnapshot) {
        return { ok: false, reason: 'Save the draft before taking a snapshot.' };
      }

      try {
        const revision = await snapshotServiceRef.current!.createSnapshot(id, label ?? null);
        return { ok: true, revision };
      } catch (caught) {
        const detail = describeDataError(caught);
        setResult({
          kind: 'error',
          message: 'The snapshot was not created.',
          detail,
          retryable: true,
        });
        return { ok: false, reason: detail };
      }
    },
    [canSnapshot],
  );

  const state: SaveState = !durable
    ? 'disabled'
    : conflict
      ? 'conflict'
      : saving
        ? 'saving'
        : result?.kind === 'error'
          ? 'error'
          : dirty
            ? 'dirty'
            : result?.kind === 'saved'
              ? 'saved'
              : 'clean';

  return {
    text: draft.text,
    setText: draft.setText,
    dirty,
    parse: draft.parse,
    stats: draft.stats,
    largeDocument: draft.largeDocument,

    state,
    saving,
    durable,
    lastSavedAt,
    error: result?.kind === 'error' ? { message: result.message, detail: result.detail } : null,
    retryable: result?.kind === 'error' ? result.retryable : false,
    notice:
      result?.kind === 'unchanged'
        ? 'Already saved — this draft matches what is stored, so nothing was written.'
        : result?.kind === 'held'
          ? (result.message ?? 'This draft is not being saved yet.')
          : null,
    canReconnect: onReconnectStorage !== null,
    saveNow,
    retry,

    conflict,
    reviewConflict,
    reloadStoredVersion,
    keepDraftAsNew,
    dismissConflict,

    remote,
    dismissRemote,

    recovery,
    recoveryAvailable: canRecover(storage),
    restoreRecovery,
    discardRecovery,

    canSnapshot,
    snapshot,
  };
}
