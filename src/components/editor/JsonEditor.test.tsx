import type { EditorView } from '@codemirror/view';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  JsonEditor,
  type JsonEditorHandle,
  type JsonEditorProps,
} from '@/components/editor/JsonEditor';
import { createRef } from 'react';

const DOCUMENT = '{\n  "name": "Extractor"\n}';

/** A controlled host, so the editor behaves as it does inside the route. */
function Harness({
  initial = DOCUMENT,
  onChange,
  onReady,
  handleRef,
  ariaLabel = 'JSON document',
}: {
  initial?: string;
  onChange?: JsonEditorProps['onChange'];
  onReady?: JsonEditorProps['onReady'];
  handleRef?: React.RefObject<JsonEditorHandle | null>;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState(initial);

  return (
    <JsonEditor
      ref={handleRef}
      value={value}
      ariaLabel={ariaLabel}
      indent={2}
      onReady={onReady}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe('JsonEditor', () => {
  it('mounts CodeMirror with the document and an accessible name', () => {
    render(<Harness />);

    expect(screen.getByRole('textbox', { name: 'JSON document' })).toBeInTheDocument();
    expect(screen.getByText(/"name"/)).toBeInTheDocument();
    // Line numbers are part of the gutters, not the document text.
    expect(document.querySelector('.cm-lineNumbers')).not.toBeNull();
  });

  it('reports edits made through a CodeMirror transaction', () => {
    const onChange = vi.fn();
    let view: EditorView | null = null;

    render(
      <Harness
        onChange={onChange}
        onReady={(next) => {
          view = next;
        }}
      />,
    );

    expect(view).not.toBeNull();
    const editor = view as EditorView | null;

    act(() => {
      editor?.dispatch({ changes: { from: 0, insert: '// edited\n' } });
    });

    expect(onChange).toHaveBeenCalledWith(`// edited\n${DOCUMENT}`);
  });

  it('jumps the caret to an offset and focuses the document', () => {
    const ref = createRef<JsonEditorHandle>();
    let view: EditorView | null = null;

    render(<Harness handleRef={ref} onReady={(next) => (view = next)} />);

    const offset = DOCUMENT.indexOf('"name"');

    act(() => {
      ref.current?.jumpToOffset(offset);
    });

    const editor = view as EditorView | null;
    expect(editor?.state.selection.main.head).toBe(offset);
    expect(editor?.hasFocus).toBe(true);
  });

  it('selects the whole document on demand', () => {
    const ref = createRef<JsonEditorHandle>();
    let view: EditorView | null = null;

    render(<Harness handleRef={ref} onReady={(next) => (view = next)} />);

    act(() => {
      ref.current?.selectAll();
    });

    const editor = view as EditorView | null;
    expect(editor?.state.selection.main.from).toBe(0);
    expect(editor?.state.selection.main.to).toBe(DOCUMENT.length);
  });
});
