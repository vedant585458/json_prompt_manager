import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui';
import {
  BLUEPRINT_COLUMNS,
  describeNodeKind,
  type BlueprintGraph,
  type BlueprintNode,
} from '@/domain/graph';
import { cn } from '@/lib/cn';

export interface GraphListProps {
  readonly graph: BlueprintGraph;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  /** Tighter rows for the list that sits under the drawing. */
  readonly compact?: boolean;
}

/**
 * The blueprint as a semantic list (TASK-023).
 *
 * This is the accessible representation, not a consolation prize: every node the
 * drawing shows appears here as a real `<button>` inside a real list, grouped by
 * stage, with its kind written out and unresolved references named in words as
 * well as marked with an icon.
 */
export function GraphList({ graph, selectedId, onSelect, compact = false }: GraphListProps) {
  return (
    <div className={cn('flex min-w-0 flex-col', compact ? 'gap-3' : 'gap-5')}>
      {BLUEPRINT_COLUMNS.map((column) => {
        const nodes = graph.nodes.filter((node) => node.column === column.id);
        if (nodes.length === 0) return null;

        const headingId = `blueprint-list-${column.id}`;

        return (
          <section key={column.id} aria-labelledby={headingId} className="min-w-0">
            <h4 id={headingId} className="text-2xs font-semibold tracking-wide text-ink uppercase">
              {column.title}
              <span className="ml-1.5 font-normal text-ink-muted normal-case">
                {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
              </span>
            </h4>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{column.subtitle}</p>
            <ul className="mt-1.5 flex min-w-0 flex-col gap-1">
              {nodes.map((node) => (
                <li key={node.id} className="min-w-0">
                  <NodeRow
                    node={node}
                    selected={node.id === selectedId}
                    onSelect={onSelect}
                    compact={compact}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function NodeRow({
  node,
  selected,
  onSelect,
  compact,
}: {
  readonly node: BlueprintNode;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
  readonly compact: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      aria-pressed={selected}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 rounded-sm border px-2 text-left transition-colors duration-[var(--pf-duration-fast)]',
        compact ? 'py-1' : 'py-1.5',
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-line bg-surface-1 hover:border-line-strong hover:bg-surface-2',
      )}
    >
      <span className="mt-0.5 w-16 shrink-0 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
        {describeNodeKind(node.kind)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate font-mono text-xs text-ink">{node.label}</span>
          {node.unresolved ? (
            <Badge tone="danger">
              <AlertTriangle aria-hidden="true" size={10} className="mr-1" />
              Unresolved
            </Badge>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-2xs text-ink-secondary">{node.detail}</span>
      </span>
    </button>
  );
}
