import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

import { IconButton } from '@/components/ui/IconButton';
import { buildJsonTree, type JsonTreeNode } from '@/domain/jsonTree';
import type { JsonSyntaxError, JsonTextStats } from '@/domain/jsonText';
import type { JsonValue } from '@/domain/types';

/**
 * Inspector scaffold (TASK-014).
 *
 * It holds real facts about the open document — size, structure, depth — and
 * says plainly that schema validation lands in TASK-016. Nothing here is a
 * placeholder button: the panel is either informative or closed.
 */

export interface EditorInspectorProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly stats: JsonTextStats;
  readonly value: JsonValue | null;
  readonly error: JsonSyntaxError | null;
}

function countNodes(node: JsonTreeNode): number {
  return node.children.reduce((total, child) => total + countNodes(child), 1);
}

function maxDepth(node: JsonTreeNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(maxDepth));
}

const KIND_LABEL: Record<JsonTreeNode['kind'], string> = {
  object: 'object',
  array: 'array',
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
};

export function EditorInspector({ open, onToggle, stats, value, error }: EditorInspectorProps) {
  const root = useMemo(() => (value === null ? null : buildJsonTree(value)), [value]);

  return (
    <aside aria-label="Document inspector" className="rounded-md border border-line bg-surface-1">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-xs font-medium tracking-wide text-ink-secondary uppercase">
          Inspector
        </h2>
        <IconButton
          label={open ? 'Hide the inspector' : 'Show the inspector'}
          aria-expanded={open}
          size="sm"
          onClick={onToggle}
        >
          {open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </IconButton>
      </div>

      {open ? (
        <div className="space-y-4 px-3 py-3 text-xs">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <dt className="text-ink-muted">Lines</dt>
            <dd className="text-right font-mono text-ink">{stats.lines}</dd>
            <dt className="text-ink-muted">Characters</dt>
            <dd className="text-right font-mono text-ink">{stats.characters.toLocaleString()}</dd>
            <dt className="text-ink-muted">Nodes</dt>
            <dd className="text-right font-mono text-ink">{root ? countNodes(root) : '—'}</dd>
            <dt className="text-ink-muted">Depth</dt>
            <dd className="text-right font-mono text-ink">{root ? maxDepth(root) : '—'}</dd>
          </dl>

          <div>
            <h3 className="mb-1.5 text-2xs tracking-wide text-ink-muted uppercase">Top level</h3>
            {root && root.children.length > 0 ? (
              <ul className="space-y-1">
                {root.children.map((child) => (
                  <li key={child.path} className="flex items-baseline justify-between gap-2">
                    <code className="truncate font-mono text-ink">{child.key}</code>
                    <span className="shrink-0 text-2xs text-ink-muted">
                      {KIND_LABEL[child.kind]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">
                {error ? 'Available once the document parses.' : 'The document has no keys.'}
              </p>
            )}
          </div>

          <p className="border-t border-line pt-3 text-2xs leading-relaxed text-ink-muted">
            Schema validation and issue lists arrive in TASK-016. This panel is structural only — it
            makes no claim about prompt quality.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
