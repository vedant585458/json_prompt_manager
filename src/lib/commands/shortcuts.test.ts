import { describe, expect, it } from 'vitest';

import {
  createShortcutMatcher,
  detectPlatform,
  eventMatchesChord,
  isTypingTarget,
  parsedShortcutOf,
  parseShortcut,
  platformFromUserAgent,
  shortcutLabel,
  shortcutTokens,
  ariaKeyshortcuts,
} from '@/lib/commands/shortcuts';
import type { CommandDefinition } from '@/lib/commands/types';

function command(id: string, shortcut?: string): CommandDefinition {
  return {
    id,
    title: id,
    group: 'General',
    ...(shortcut ? { shortcut } : {}),
    run: () => undefined,
  };
}

describe('parseShortcut', () => {
  it('parses a modifier chord', () => {
    expect(parseShortcut('Mod+K')).toEqual([{ key: 'k', mod: true }]);
  });

  it('parses literal modifiers and punctuation', () => {
    expect(parseShortcut('Shift+?')).toEqual([{ key: '?', shift: true }]);
    expect(parseShortcut('Ctrl+Alt+ArrowUp')).toEqual([{ key: 'arrowup', ctrl: true, alt: true }]);
  });

  it('parses a two-step sequence', () => {
    expect(parseShortcut('G L')).toEqual([{ key: 'g' }, { key: 'l' }]);
  });

  it('rejects unknown modifiers, missing keys, and long sequences', () => {
    expect(() => parseShortcut('Hyper+K')).toThrow(/Unknown modifier/);
    expect(() => parseShortcut('Mod+')).toThrow(/missing a key/);
    expect(() => parseShortcut('G L X')).toThrow(/more than two steps/);
    expect(() => parseShortcut('   ')).toThrow(/cannot be empty/);
  });

  it('caches the parse per command definition', () => {
    const definition = command('test', 'Mod+J');
    expect(parsedShortcutOf(definition)).toEqual([{ key: 'j', mod: true }]);
    expect(parsedShortcutOf(definition)).toBe(parsedShortcutOf(definition));
    expect(parsedShortcutOf(command('no-shortcut'))).toBeNull();
  });
});

describe('eventMatchesChord', () => {
  it('treats Mod as Control off Apple and Command on Apple', () => {
    const chord = { key: 'k', mod: true } as const;

    expect(eventMatchesChord({ key: 'k', ctrlKey: true }, chord, 'other')).toBe(true);
    expect(eventMatchesChord({ key: 'k', metaKey: true }, chord, 'other')).toBe(false);
    expect(eventMatchesChord({ key: 'k', metaKey: true }, chord, 'apple')).toBe(true);
    expect(eventMatchesChord({ key: 'k', ctrlKey: true }, chord, 'apple')).toBe(false);
  });

  it('requires exact modifier state', () => {
    expect(
      eventMatchesChord(
        { key: 'k', ctrlKey: true, shiftKey: true },
        { key: 'k', mod: true },
        'other',
      ),
    ).toBe(false);
    expect(
      eventMatchesChord(
        { key: 'l', ctrlKey: true, shiftKey: true },
        { key: 'l', mod: true, shift: true },
        'other',
      ),
    ).toBe(true);
    expect(eventMatchesChord({ key: 'l', altKey: true }, { key: 'l' }, 'other')).toBe(false);
  });

  it('ignores Shift for punctuation that encodes it, but not for letters', () => {
    expect(eventMatchesChord({ key: '?', shiftKey: true }, { key: '?' }, 'other')).toBe(true);
    expect(eventMatchesChord({ key: 'k', shiftKey: true }, { key: 'k' }, 'other')).toBe(false);
  });

  it('matches letters case-insensitively and rejects empty keys', () => {
    expect(eventMatchesChord({ key: 'K' }, { key: 'k' }, 'other')).toBe(true);
    expect(eventMatchesChord({ key: ' ' }, { key: 'k' }, 'other')).toBe(false);
  });
});

describe('display helpers', () => {
  it('renders platform-specific tokens and sequence labels', () => {
    expect(shortcutTokens(parseShortcut('Mod+K'), 'other')).toEqual([['Ctrl', 'K']]);
    expect(shortcutTokens(parseShortcut('Mod+K'), 'apple')).toEqual([['⌘', 'K']]);
    expect(shortcutTokens(parseShortcut('G L'), 'other')).toEqual([['G'], ['L']]);
    expect(shortcutLabel(parseShortcut('G L'), 'other')).toBe('G then L');
    expect(ariaKeyshortcuts(parseShortcut('Mod+Shift+L'))).toBe('Control+Shift+L');
  });

  it('detects Apple platforms from the user agent', () => {
    expect(platformFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('apple');
    expect(platformFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('other');
    expect(typeof detectPlatform()).toBe('string');
  });
});

describe('isTypingTarget', () => {
  it('recognises fields and contenteditable regions', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(editable)).toBe(true);

    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('createShortcutMatcher', () => {
  const single = command('single', 'Mod+K');
  const sequence = command('sequence', 'G L');
  const other = command('other', 'Mod+B');

  it('dispatches a single chord', () => {
    const matcher = createShortcutMatcher();
    const result = matcher.match({ key: 'k', ctrlKey: true }, [single, sequence], 'other', 0);
    expect(result).toEqual({ kind: 'command', command: single });
  });

  it('requires both steps of a sequence inside the timeout', () => {
    const matcher = createShortcutMatcher(1000);

    expect(matcher.match({ key: 'g' }, [sequence], 'other', 0)).toEqual({ kind: 'pending' });
    expect(matcher.match({ key: 'l' }, [sequence], 'other', 400)).toEqual({
      kind: 'command',
      command: sequence,
    });
  });

  it('expires a pending sequence', () => {
    const matcher = createShortcutMatcher(1000);
    matcher.match({ key: 'g' }, [sequence], 'other', 0);
    expect(matcher.match({ key: 'l' }, [sequence], 'other', 2000)).toBeNull();
  });

  it('clears the pending step on a mismatch', () => {
    const matcher = createShortcutMatcher();
    matcher.match({ key: 'g' }, [sequence], 'other', 0);
    expect(matcher.match({ key: 'x' }, [sequence], 'other', 10)).toBeNull();
    expect(matcher.match({ key: 'l' }, [sequence], 'other', 20)).toBeNull();
  });

  it('cannot complete a sequence whose command disappeared', () => {
    const matcher = createShortcutMatcher();
    matcher.match({ key: 'g' }, [sequence], 'other', 0);
    expect(matcher.match({ key: 'l' }, [other], 'other', 10)).toBeNull();
  });

  it('does not lock onto the first sequence that shares a prefix', () => {
    const library = command('library', 'G L');
    const composer = command('composer', 'G C');
    const matcher = createShortcutMatcher();

    expect(matcher.match({ key: 'g' }, [composer, library], 'other', 0)).toEqual({
      kind: 'pending',
    });
    expect(matcher.match({ key: 'l' }, [composer, library], 'other', 100)).toEqual({
      kind: 'command',
      command: library,
    });
  });

  it('prefers a completed single chord over a sequence prefix', () => {
    const g = command('g', 'G');
    const matcher = createShortcutMatcher();
    expect(matcher.match({ key: 'g' }, [g, sequence], 'other', 0)).toEqual({
      kind: 'command',
      command: g,
    });
  });

  it('returns null for unbound keys and resets cleanly', () => {
    const matcher = createShortcutMatcher();
    expect(matcher.match({ key: 'z' }, [single], 'other', 0)).toBeNull();
    matcher.match({ key: 'g' }, [sequence], 'other', 0);
    matcher.reset();
    expect(matcher.match({ key: 'l' }, [sequence], 'other', 5)).toBeNull();
  });
});
