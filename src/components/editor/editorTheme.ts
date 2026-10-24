import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/**
 * CodeMirror theme for the JSON workspace (TASK-014).
 *
 * Colors are CSS custom properties, not literals, so the editor follows the
 * `data-theme` switch without re-mounting. Every syntax color is checked against
 * `--pf-editor-bg` by `npm run check:contrast` (ADR-74).
 */
export const promptForgeEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--pf-editor-bg)',
      color: 'var(--pf-ink)',
      fontFamily: 'var(--pf-font-mono)',
      fontSize: 'var(--pf-text-base)',
      height: '100%',
    },
    '&.cm-focused': {
      outline: '2px solid var(--pf-focus-ring)',
      outlineOffset: '2px',
    },
    '.cm-scroller': {
      fontFamily: 'var(--pf-font-mono)',
      lineHeight: '1.65',
      overflow: 'auto',
    },
    '.cm-content': {
      padding: '0.75rem 0',
      caretColor: 'var(--pf-ink)',
    },
    '.cm-line': {
      padding: '0 0.75rem',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--pf-editor-bg)',
      color: 'var(--pf-editor-gutter)',
      border: 'none',
      borderRight: '1px solid var(--pf-line)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 0.5rem 0 0.75rem',
      fontVariantNumeric: 'tabular-nums',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--pf-editor-line)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--pf-editor-line)',
      color: 'var(--pf-ink)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--pf-selection-bg)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--pf-ink)',
    },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'var(--pf-accent-soft)',
      outline: '1px solid var(--pf-accent)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--pf-surface-3)',
      border: '1px solid var(--pf-line)',
      color: 'var(--pf-ink-secondary)',
    },
    '.cm-panels': {
      backgroundColor: 'var(--pf-surface-2)',
      color: 'var(--pf-ink)',
      borderBottom: '1px solid var(--pf-line)',
    },
    '.cm-panels input, .cm-panels button': {
      fontFamily: 'var(--pf-font-sans)',
      fontSize: 'var(--pf-text-xs)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'var(--pf-accent-soft)',
      outline: '1px solid var(--pf-accent)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--pf-accent-fill)',
      color: 'var(--pf-accent-foreground)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--pf-surface-2)',
      border: '1px solid var(--pf-line)',
      color: 'var(--pf-ink)',
    },
    '.cm-gutterElement span[title]': {
      color: 'var(--pf-ink-muted)',
    },
  },
  { dark: true },
);

/** JSON token colors. Property names and strings differ; literals are one color. */
export const promptForgeHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--pf-editor-key)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--pf-editor-string)' },
  { tag: tags.number, color: 'var(--pf-editor-number)' },
  { tag: [tags.bool, tags.null], color: 'var(--pf-editor-literal)' },
  {
    tag: [tags.punctuation, tags.bracket, tags.separator, tags.squareBracket, tags.brace],
    color: 'var(--pf-editor-punct)',
  },
  { tag: tags.invalid, color: 'var(--pf-danger)' },
]);

/** Theme plus highlighting, ready for the editor's extension list. */
export const promptForgeEditorExtensions = [
  promptForgeEditorTheme,
  syntaxHighlighting(promptForgeHighlightStyle),
];
