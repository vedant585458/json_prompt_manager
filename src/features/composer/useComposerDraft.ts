import { useCallback, useMemo, useState } from 'react';

import { applyComposerPatch, type ComposerPatch } from '@/domain/composer';
import { formatDocumentJson } from '@/domain/serialization';
import type { JsonObject } from '@/domain/types';

/**
 * The composer's draft document (TASK-017).
 *
 * The form edits a raw JSON object, not a normalized document, so an edit is a
 * patch and everything the form does not render survives it. This hook owns that
 * object and the text derived from it; it never writes anything.
 */
export interface ComposerDraftState {
  readonly raw: JsonObject;
  /** Canonical, pretty-printed JSON for the current draft. */
  readonly text: string;
  /** True when the draft differs from the last adopted or saved document. */
  readonly dirty: boolean;
  readonly patch: (patch: ComposerPatch) => void;
  /** Replaces the draft (a starter, or a restore) and keeps it dirty. */
  readonly replace: (next: JsonObject) => void;
  /** Adopts the stored document without marking the form dirty. */
  readonly adopt: (next: JsonObject) => void;
  /** Marks the current draft as the saved one. */
  readonly markClean: () => void;
}

function sameJson(left: JsonObject, right: JsonObject): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useComposerDraft(initial: JsonObject, indent: 2 | 4 = 2): ComposerDraftState {
  const [raw, setRaw] = useState<JsonObject>(initial);
  const [baseline, setBaseline] = useState<JsonObject>(initial);

  const text = useMemo(() => formatDocumentJson(raw, indent), [raw, indent]);
  const dirty = useMemo(() => !sameJson(raw, baseline), [raw, baseline]);

  const patch = useCallback((next: ComposerPatch) => {
    setRaw((current) => applyComposerPatch(current, next));
  }, []);

  const replace = useCallback((next: JsonObject) => {
    setRaw(next);
  }, []);

  const adopt = useCallback((next: JsonObject) => {
    setRaw(next);
    setBaseline(next);
  }, []);

  const markClean = useCallback(() => {
    setBaseline(raw);
  }, [raw]);

  return { raw, text, dirty, patch, replace, adopt, markClean };
}
