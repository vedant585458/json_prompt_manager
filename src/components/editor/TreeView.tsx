import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { CopyIconButton } from '@/components/ui/CopyButton';
import {
  buildJsonTree,
  defaultExpandedPaths,
  treeKeyboardAction,
  visibleJsonTreeRows,
  type JsonTreeKey,
  type JsonTreeNode,
} from '@/domain/jsonTree';
import type { JsonSyntaxError } from '@/domain/jsonText';
import type { JsonValue } from '@/domain/types';
import { cn } from '@/lib/cn';

/**
 * Read-only tree view (TASK-014).
 *
 * Rows are a flattened view of the document with `aria-level` for depth. Focus
 * stays on the `role="tree"` container and `aria-activedescendant` names the
 * active row, so a screen reader announces each move exactly once. The arrow
 * keys follow the WAI-ARIA tree pattern, and the path of the active row is
 * always shown with a copy control.
 *
 * The tree is read-only by design: authoring belongs to the raw editor, and a
 * second write path would be a second source of truth.
 */

export interface TreeViewProps {
  /** Parsed document, or `null` while the text does not parse. */
  readonly value: JsonValue | null;
  readonly error: JsonSyntaxError | null;
}

const KEY_NAMES = new Set<string>([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]);

function rowId(path: string): string {
  return `json-node-${path.replaceAll(/[^a-zA-Z0-9]+/g, '-')}`;
}

const KIND_LABEL: Record<JsonTreeNode['kind'], string> = {
  object: 'object',
  array: 'array',
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
};

export function TreeView({ value, error }: TreeViewProps) {
  const root = useMemo(() => (value === null ? null : buildJsonTree(value)), [value]);
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set(['$']));
  const [focusedPath, setFocusedPath] = useState('$');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // A new document starts from the default expansion, not the previous tree's.
  useEffect(() => {
    if (!root) return;

    setExpandedPaths(defaultExpandedPaths(root));
    setFocusedPath(root.path);
  }, [root]);

  const rows = useMemo(
    () => (root ? visibleJsonTreeRows(root, expandedPaths) : []),
    [root, expandedPaths],
  );

  const toggle = useCallback((path: string, expanded: boolean) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (expanded) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const row = rows.find((candidate) => candidate.node.path === focusedPath);
        if (row?.expandable) {
          event.preventDefault();
          toggle(row.node.path, !row.expanded);
        }
        return;
      }

      if (!KEY_NAMES.has(event.key)) return;

      const index = rows.findIndex((row) => row.node.path === focusedPath);
      const action = treeKeyboardAction(rows, index, event.key as JsonTreeKey, expandedPaths);
      if (!action) return;

      event.preventDefault();
      if (action.expansion) toggle(action.expansion.path, action.expansion.expanded);
      setFocusedPath(action.path);
    },
    [expandedPaths, focusedPath, rows, toggle],
  );

  if (error) {
    return (
      <Alert
        tone="warning"
        title={`The tree needs valid JSON — line ${error.line}, column ${error.column}`}
      >
        <p>{error.message}</p>
        <p className="mt-1 text-ink-muted">
          Nothing is shown here rather than showing a partial tree that would not match your text.
        </p>
      </Alert>
    );
  }

  if (!root) {
    return (
      <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
        This document has no content yet.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface-1">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-xs text-ink-muted">Selected path</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={focusedPath}>
          {focusedPath}
        </code>
        <CopyIconButton value={focusedPath} label="Copy path" size="sm" />
      </div>

      <div
        ref={containerRef}
        role="tree"
        aria-label="Document tree"
        aria-activedescendant={rowId(focusedPath)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="max-h-[60vh] overflow-auto py-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        {rows.map(({ node, expandable, expanded }) => {
          const active = node.path === focusedPath;

          return (
            <div
              key={node.path}
              id={rowId(node.path)}
              role="treeitem"
              aria-level={node.depth + 1}
              aria-expanded={expandable ? expanded : undefined}
              aria-selected={active}
              tabIndex={-1}
              data-path={node.path}
              onClick={() => {
                setFocusedPath(node.path);
                if (expandable) toggle(node.path, !expanded);
                containerRef.current?.focus();
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2 py-1 pr-3 font-mono text-xs',
                'border-l-2 border-transparent hover:bg-surface-2',
                active && 'border-accent bg-surface-2',
              )}
              style={{ paddingLeft: `${0.75 + node.depth * 1.1}rem` }}
            >
              {expandable ? (
                expanded ? (
                  <ChevronDown aria-hidden="true" size={13} className="shrink-0 text-ink-muted" />
                ) : (
                  <ChevronRight aria-hidden="true" size={13} className="shrink-0 text-ink-muted" />
                )
              ) : (
                <span aria-hidden="true" className="w-[13px] shrink-0" />
              )}

              <span className={cn('shrink-0', active ? 'text-ink' : 'text-[var(--pf-editor-key)]')}>
                {node.key}
              </span>
              <span className="shrink-0 rounded-sm border border-line px-1 text-2xs tracking-wide text-ink-muted uppercase">
                {KIND_LABEL[node.kind]}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-muted">{node.summary}</span>
            </div>
          );
        })}
      </div>

      <p className="border-t border-line px-3 py-1.5 text-2xs text-ink-muted">
        Arrow keys move and expand. Read-only view — edit in the Raw JSON tab.
      </p>
    </div>
  );
}
