import { redo, undo } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { indentUnit } from '@codemirror/language';
import { openSearchPanel } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';

import { promptForgeEditorExtensions } from '@/components/editor/editorTheme';
import { cn } from '@/lib/cn';

/**
 * CodeMirror host for the JSON workspace (TASK-014).
 *
 * The component stays deliberately thin: it owns the editor instance and the
 * imperative operations the toolbar and the error panel need (focus, jump to an
 * offset, select all). Document state, parsing, and persistence live in the
 * route, so the editor never decides what a keystroke means.
 *
 * This module is imported lazily by the route, which keeps CodeMirror out of the
 * initial bundle (ADR-75).
 */

export interface JsonEditorHandle {
  /** Moves focus into the document. */
  focus: () => void;
  /** Places the caret at a 0-based offset and scrolls it into view. */
  jumpToOffset: (offset: number) => void;
  /** Selects the whole document, for "copy all" style actions. */
  selectAll: () => void;
  /** Opens CodeMirror's own find/replace panel. */
  openSearch: () => void;
  /** Steps back through CodeMirror's history. */
  undo: () => void;
  /** Steps forward through CodeMirror's history. */
  redo: () => void;
}

export interface JsonEditorProps {
  readonly value: string;
  /** Omitted only when `readOnly` is set. */
  readonly onChange?: (next: string) => void;
  /** Indent width in spaces, from the saved preference. */
  readonly indent: 2 | 4;
  /** Accessible name for the editable document. */
  readonly ariaLabel: string;
  readonly className?: string;
  /** Called once the underlying `EditorView` exists (used by tests and tooling). */
  readonly onReady?: (view: EditorView) => void;
  /** Reports the caret position (1-based) for the status bar. */
  readonly onCaretChange?: (position: { line: number; column: number }) => void;
  /**
   * Renders the document for reading only (TASK-019).
   *
   * The text is still selectable and searchable, which is what a revision
   * viewer needs; only edits and the history keymap are disabled.
   */
  readonly readOnly?: boolean;
}

export const JsonEditor = forwardRef<JsonEditorHandle, JsonEditorProps>(function JsonEditor(
  { value, onChange, indent, ariaLabel, className, onReady, onCaretChange, readOnly = false },
  ref,
) {
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(
    () => [
      json(),
      ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
      indentUnit.of(' '.repeat(indent)),
      EditorView.contentAttributes.of({
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
        spellcheck: 'false',
        autocapitalize: 'off',
        autocomplete: 'off',
      }),
      EditorView.updateListener.of((update) => {
        if (!onCaretChange) return;
        if (!update.selectionSet && !update.docChanged && !update.focusChanged) return;

        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        onCaretChange({ line: line.number, column: head - line.from + 1 });
      }),
      ...promptForgeEditorExtensions,
    ],
    [ariaLabel, indent, onCaretChange, readOnly],
  );

  const handleCreate = useCallback(
    (view: EditorView) => {
      viewRef.current = view;
      onReady?.(view);
    },
    [onReady],
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      jumpToOffset: (offset: number) => {
        const view = viewRef.current;
        if (!view) return;

        const target = Math.max(0, Math.min(offset, view.state.doc.length));
        view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
        view.focus();
      },
      selectAll: () => {
        const view = viewRef.current;
        if (!view) return;

        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
        view.focus();
      },
      openSearch: () => {
        const view = viewRef.current;
        if (!view) return;

        openSearchPanel(view);
        view.focus();
      },
      undo: () => {
        const view = viewRef.current;
        if (!view) return;

        undo(view);
        view.focus();
      },
      redo: () => {
        const view = viewRef.current;
        if (!view) return;

        redo(view);
        view.focus();
      },
    }),
    [],
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-line bg-[var(--pf-editor-bg)]',
        'focus-within:border-line-strong',
        className,
      )}
      data-editor-host="json"
    >
      <CodeMirror
        value={value}
        onChange={readOnly ? undefined : onChange}
        onCreateEditor={handleCreate}
        extensions={extensions}
        height="100%"
        className="h-full text-[length:var(--pf-text-base)]"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          highlightSelectionMatches: true,
          autocompletion: false,
          searchKeymap: true,
          history: !readOnly,
          indentOnInput: true,
          tabSize: indent,
        }}
      />
    </div>
  );
});

export default JsonEditor;
