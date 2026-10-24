import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { Alert, Badge, Button, Card, buttonVariants } from '@/components/ui';
import { describeNodeKind, type BlueprintNode } from '@/domain/graph';
import { cn } from '@/lib/cn';

export interface GraphInspectorProps {
  readonly node: BlueprintNode | null;
  readonly promptId: string;
  /** Jumps the raw editor to a document path; supplied by the editor screen. */
  readonly onOpenPath: (path: string) => void;
}

/**
 * Details of one blueprint node (TASK-023).
 *
 * The inspector is where a picture becomes actionable: every node either opens
 * the thing it describes or explains what is missing and where to go to fix it.
 * Nothing here edits the document.
 */
export function GraphInspector({ node, promptId, onOpenPath }: GraphInspectorProps) {
  if (!node) {
    return (
      <Card className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">Details</h3>
        <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
          Select a node to see what it is and where it comes from.
        </p>
      </Card>
    );
  }

  const problem = node.meta.find((entry) => entry.label === 'Problem');
  const rows = node.meta.filter((entry) => entry.label !== 'Problem');

  return (
    <Card className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
            {describeNodeKind(node.kind)}
          </p>
          <h3 className="mt-0.5 truncate font-mono text-sm font-semibold text-ink">{node.label}</h3>
        </div>
        {node.unresolved ? (
          <Badge tone="danger">
            <AlertTriangle aria-hidden="true" size={10} className="mr-1" />
            Unresolved
          </Badge>
        ) : (
          <Badge tone="neutral">Resolved</Badge>
        )}
      </div>

      <p className="mt-1 text-2xs leading-relaxed text-ink-secondary">{node.detail}</p>

      {problem ? (
        <Alert tone="warning" title="What needs fixing" className="mt-2">
          <p>{problem.value}</p>
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-2xs">
          {rows.map((row) => (
            <Fragment key={row.label}>
              <dt className="text-ink-muted">{row.label}</dt>
              <dd className="min-w-0 break-words text-ink-secondary">{row.value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}

      <div className="mt-3">
        <NodeAction node={node} promptId={promptId} onOpenPath={onOpenPath} />
      </div>
    </Card>
  );
}

function NodeAction({
  node,
  promptId,
  onOpenPath,
}: {
  readonly node: BlueprintNode;
  readonly promptId: string;
  readonly onOpenPath: (path: string) => void;
}) {
  const label = <span className="inline-flex items-center gap-1">Open {linkText(node)}</span>;

  switch (node.target?.kind) {
    case 'section':
      return (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (node.target?.kind === 'section') onOpenPath(node.target.path);
          }}
        >
          <ArrowRight aria-hidden="true" size={12} />
          Jump to “{node.label}” in the editor
        </Button>
      );
    case 'playground':
      return (
        <Link
          to={`/prompts/${promptId}/playground`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          {label}
        </Link>
      );
    case 'snippets':
      return (
        <Link
          to={`/prompts/${promptId}/compose`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          {label}
        </Link>
      );
    case 'validation':
      return (
        <Link
          to={`/validation?prompt=${encodeURIComponent(promptId)}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          {label}
        </Link>
      );
    case 'templates':
      return (
        <Link to="/templates" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
          {label}
        </Link>
      );
    default:
      return null;
  }
}

function linkText(node: BlueprintNode): string {
  switch (node.target?.kind) {
    case 'playground':
      return 'the playground';
    case 'snippets':
      return 'the snippet library';
    case 'validation':
      return 'the validation studio';
    case 'templates':
      return 'the templates';
    default:
      return 'the source';
  }
}
