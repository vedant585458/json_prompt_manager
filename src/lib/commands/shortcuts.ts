/**
 * Shortcut parsing, matching, and display (TASK-009).
 *
 * Shortcuts are written as strings in command definitions (`Mod+K`, `G L`) and
 * parsed here, so a typo fails at registration rather than at 3am. Matching is
 * pure: it takes a keyboard-event-like object plus the platform, which makes the
 * whole matrix testable without a browser.
 */

import type { CommandDefinition, Platform, Shortcut, ShortcutChord } from '@/lib/commands/types';

const MODIFIERS = new Map<string, 'mod' | 'ctrl' | 'shift' | 'alt'>([
  ['mod', 'mod'],
  ['cmd', 'mod'],
  ['command', 'mod'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['shift', 'shift'],
  ['alt', 'alt'],
  ['option', 'alt'],
]);

/** The subset of `KeyboardEvent` matching needs; keeps tests trivial. */
export interface KeyStroke {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

export type ShortcutMatch =
  { readonly kind: 'command'; readonly command: CommandDefinition } | { readonly kind: 'pending' };

function normalizeKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length === 0) throw new Error('A shortcut key cannot be empty.');
  if (trimmed.toLowerCase() === 'space') return ' ';
  return trimmed.toLowerCase();
}

function parseChord(step: string, shortcut: string): ShortcutChord {
  const tokens = step.split('+');
  const keyToken = tokens[tokens.length - 1];

  if (!keyToken || keyToken.trim().length === 0) {
    throw new Error(`Shortcut "${shortcut}" is missing a key.`);
  }

  let mod = false;
  let ctrl = false;
  let shift = false;
  let alt = false;

  for (const token of tokens.slice(0, -1)) {
    const modifier = MODIFIERS.get(token.trim().toLowerCase());
    if (!modifier) {
      throw new Error(`Unknown modifier "${token}" in shortcut "${shortcut}".`);
    }
    if (modifier === 'mod') mod = true;
    if (modifier === 'ctrl') ctrl = true;
    if (modifier === 'shift') shift = true;
    if (modifier === 'alt') alt = true;
  }

  return {
    key: normalizeKey(keyToken),
    ...(mod ? { mod: true } : {}),
    ...(ctrl ? { ctrl: true } : {}),
    ...(shift ? { shift: true } : {}),
    ...(alt ? { alt: true } : {}),
  };
}

/**
 * Parses `Mod+K`, `Shift+?`, or a two-step sequence written with a space
 * (`G L`). Throws on anything else, including sequences longer than two steps.
 */
export function parseShortcut(input: string): Shortcut {
  const steps = input.trim().split(/\s+/).filter(Boolean);

  if (steps.length === 0) throw new Error('A shortcut cannot be empty.');
  if (steps.length > 2) {
    throw new Error(`Shortcut "${input}" has more than two steps; only pairs are supported.`);
  }

  const first = parseChord(steps[0] ?? '', input);
  if (steps.length === 1) return [first];

  const second = parseChord(steps[1] ?? '', input);
  return [first, second];
}

const parsedCache = new WeakMap<CommandDefinition, Shortcut | null>();

/** Parses a command's shortcut once and reuses it for every keypress. */
export function parsedShortcutOf(command: CommandDefinition): Shortcut | null {
  if (!command.shortcut) return null;

  const cached = parsedCache.get(command);
  if (cached !== undefined) return cached;

  const parsed = parseShortcut(command.shortcut);
  parsedCache.set(command, parsed);
  return parsed;
}

/** Canonical identity of a chord, used to reject conflicting shortcuts. */
export function chordKey(chord: ShortcutChord): string {
  return [
    chord.key,
    chord.mod ? 'mod' : '',
    chord.ctrl ? 'ctrl' : '',
    chord.shift ? 'shift' : '',
    chord.alt ? 'alt' : '',
  ].join('|');
}

export function shortcutKey(shortcut: Shortcut): string {
  return shortcut.map(chordKey).join('>');
}

/**
 * Whether a key itself encodes Shift (punctuation such as `?` or `+`).
 *
 * On a US layout `Shift+/` reports `key: '?'` *and* `shiftKey: true`. Requiring
 * `shiftKey: false` for the chord `?` would make it unreachable, so Shift is
 * ignored for non-alphanumeric single characters and checked everywhere else.
 */
function shiftIsMeaningful(key: string): boolean {
  return key.length > 1 || /[a-z0-9]/i.test(key);
}

export function eventMatchesChord(
  event: KeyStroke,
  chord: ShortcutChord,
  platform: Platform,
): boolean {
  const expectedCtrl = chord.ctrl === true || (chord.mod === true && platform === 'other');
  const expectedMeta = chord.mod === true && platform === 'apple';

  if (Boolean(event.ctrlKey) !== expectedCtrl) return false;
  if (Boolean(event.metaKey) !== expectedMeta) return false;
  if (Boolean(event.altKey) !== (chord.alt === true)) return false;
  if (shiftIsMeaningful(chord.key) && Boolean(event.shiftKey) !== (chord.shift === true))
    return false;

  if (event.key.trim().length === 0) return false;
  return normalizeKey(event.key) === chord.key;
}

export function platformFromUserAgent(userAgent: string): Platform {
  return /mac|iphone|ipad|ipod/i.test(userAgent) ? 'apple' : 'other';
}

/** Platform of the current environment; `other` when there is no navigator. */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  return platformFromUserAgent(navigator.userAgent);
}

/** True when focus is in a control that consumes typed characters. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return target.isContentEditable === true;
}

/** Human token groups for a shortcut: `[["Ctrl","K"]]` or `[["G"],["L"]]`. */
export function shortcutTokens(
  shortcut: Shortcut,
  platform: Platform,
): readonly (readonly string[])[] {
  return shortcut.map((chord) => {
    const tokens: string[] = [];
    if (chord.mod) tokens.push(platform === 'apple' ? '⌘' : 'Ctrl');
    if (chord.ctrl && !chord.mod) tokens.push(platform === 'apple' ? '⌃' : 'Ctrl');
    if (chord.alt) tokens.push(platform === 'apple' ? '⌥' : 'Alt');
    if (chord.shift) tokens.push(platform === 'apple' ? '⇧' : 'Shift');
    tokens.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
    return tokens;
  });
}

/** Plain-language label, e.g. "Ctrl K" or "G then L". */
export function shortcutLabel(shortcut: Shortcut, platform: Platform): string {
  return shortcutTokens(shortcut, platform)
    .map((tokens) => tokens.join(' '))
    .join(' then ');
}

/** `aria-keyshortcuts` value, which uses the DOM's own syntax. */
export function ariaKeyshortcuts(shortcut: Shortcut): string {
  return shortcut
    .map((chord) => {
      const parts: string[] = [];
      if (chord.mod || chord.ctrl) parts.push('Control');
      if (chord.alt) parts.push('Alt');
      if (chord.shift) parts.push('Shift');
      parts.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
      return parts.join('+');
    })
    .join(' ');
}

export interface ShortcutMatcher {
  /**
   * Returns the command to run, `{ kind: 'pending' }` when a sequence prefix was
   * consumed, or `null` when the keystroke is not bound.
   */
  match: (
    event: KeyStroke,
    commands: readonly CommandDefinition[],
    platform: Platform,
    now: number,
  ) => ShortcutMatch | null;
  reset: () => void;
}

/**
 * Stateful matcher for single chords and two-step sequences.
 *
 * Rules: a completed single chord wins over a sequence prefix; a pending
 * sequence expires after `sequenceTimeoutMs`; a pending command that is no
 * longer in the candidate list cannot complete.
 */
export function createShortcutMatcher(sequenceTimeoutMs = 1500): ShortcutMatcher {
  // Several sequences can share a first chord (`G` for `G D`, `G L`, …), so the
  // pending step holds every candidate and the second key picks the winner.
  let pending: {
    readonly candidates: readonly {
      readonly command: CommandDefinition;
      readonly shortcut: readonly [ShortcutChord, ShortcutChord];
    }[];
    readonly startedAt: number;
  } | null = null;

  return {
    reset: () => {
      pending = null;
    },

    match: (event, commands, platform, now) => {
      if (pending) {
        const expired = now - pending.startedAt > sequenceTimeoutMs;
        const completed = expired
          ? undefined
          : pending.candidates.find(
              (candidate) =>
                commands.some((command) => command.id === candidate.command.id) &&
                eventMatchesChord(event, candidate.shortcut[1], platform),
            );
        pending = null;
        if (completed) return { kind: 'command', command: completed.command };
      }

      for (const command of commands) {
        const shortcut = parsedShortcutOf(command);
        if (shortcut && shortcut.length === 1 && eventMatchesChord(event, shortcut[0], platform)) {
          return { kind: 'command', command };
        }
      }

      const candidates = commands.flatMap((command) => {
        const shortcut = parsedShortcutOf(command);
        return shortcut && shortcut.length === 2 && eventMatchesChord(event, shortcut[0], platform)
          ? [{ command, shortcut }]
          : [];
      });

      if (candidates.length > 0) {
        pending = { candidates, startedAt: now };
        return { kind: 'pending' };
      }

      return null;
    },
  };
}
