import { ChevronLeft, ChevronRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, IconButton, SimpleTabs } from '@/components/ui';
import { IssueList } from '@/components/validation/IssueList';
import { ValidationScopeNote, ValidationSummary } from '@/components/validation/ValidationSummary';
import { buildJsonTree, type JsonTreeNode } from '@/domain/jsonTree';
import type { JsonSyntaxError, JsonTextStats } from '@/domain/jsonText';
import type { JsonValue } from '@/domain/types';
import type { ValidationIssue, ValidationReport } from '@/domain/validation';

/**
 * Inspector (TASK-014, extended in TASK-016).
 *
 * Two honest panels: the document's structure (facts only), and its validation
 * report (syntax, schema, and shape findings). The validation tab never claims a
 * document is a *good prompt* — the scope note says what was actually checked.
 */

export interface EditorInspectorProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly stats: JsonTextStats;
  readonly value: JsonValue | null;
  readonly error: JsonSyntaxError | null;
  /** The report for the current draft, or `null` while there is no prompt. */
  readonly report?: ValidationReport | null;
  readonly schemaName?: string | null;
  readonly promptId?: string;
  readonly onRevalidate?: () => void;
  readonly onFocusPath?: (issue: ValidationIssue) => void;
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

export function EditorInspector({
  open,
  onToggle,
  stats,
  value,
  error,
  report = null,
  schemaName = null,
  promptId,
  onRevalidate,
  onFocusPath,
}: EditorInspectorProps) {
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
        <SimpleTabs
          label="Inspector panels"
          defaultValue="structure"
          className="px-3 py-3"
          items={[
            {
              value: 'structure',
              label: 'Structure',
              content: (
                <div className="space-y-4 text-xs">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <dt className="text-ink-muted">Lines</dt>
                    <dd className="text-right font-mono text-ink">{stats.lines}</dd>
                    <dt className="text-ink-muted">Characters</dt>
                    <dd className="text-right font-mono text-ink">
                      {stats.characters.toLocaleString()}
                    </dd>
                    <dt className="text-ink-muted">Nodes</dt>
                    <dd className="text-right font-mono text-ink">
                      {root ? countNodes(root) : '—'}
                    </dd>
                    <dt className="text-ink-muted">Depth</dt>
                    <dd className="text-right font-mono text-ink">{root ? maxDepth(root) : '—'}</dd>
                  </dl>

                  <div>
                    <h3 className="mb-1.5 text-2xs tracking-wide text-ink-muted uppercase">
                      Top level
                    </h3>
                    {root && root.children.length > 0 ? (
                      <ul className="space-y-1">
                        {root.children.map((child) => (
                          <li
                            key={child.path}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <code className="truncate font-mono text-ink">{child.key}</code>
                            <span className="shrink-0 text-2xs text-ink-muted">
                              {KIND_LABEL[child.kind]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-ink-muted">
                        {error
                          ? 'Available once the document parses.'
                          : 'The document has no keys.'}
                      </p>
                    )}
                  </div>

                  <p className="border-t border-line pt-3 text-2xs leading-relaxed text-ink-muted">
                    Structural facts only. Validation lives on its own tab.
                  </p>
                </div>
              ),
            },
            {
              value: 'validation',
              label: 'Validation',
              content: (
                <div className="space-y-3 text-xs">
                  {report ? (
                    <>
                      <ValidationSummary report={report} schemaName={schemaName} />

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={onRevalidate}>
                          <RefreshCw aria-hidden="true" size={11} />
                          Re-check
                        </Button>
                        {promptId ? (
                          <Link
                            to={`/validation?prompt=${promptId}`}
                            className="text-2xs text-ink-secondary underline underline-offset-2 hover:text-ink"
                          >
                            Open the studio
                          </Link>
                        ) : null}
                      </div>

                      <IssueList
                        label="Validation findings for this draft"
                        issues={report.issues.slice(0, 8)}
                        onFocusPath={onFocusPath}
                        emptyMessage="No findings. The text parses and matches the shape it was checked against."
                      />

                      {report.issues.length > 8 ? (
                        <p className="text-2xs text-ink-muted">
                          Showing 8 of {report.issues.length}. The studio lists them all.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-ink-muted">The report appears once the prompt has loaded.</p>
                  )}

                  <div className="space-y-1.5 border-t border-line pt-3">
                    <p className="flex items-center gap-1.5 text-2xs text-ink-muted">
                      <Badge tone="neutral" className="gap-1">
                        <ShieldCheck aria-hidden="true" size={10} />
                        scope
                      </Badge>
                      Syntax and structure.
                    </p>
                    <ValidationScopeNote className="text-2xs leading-relaxed text-ink-muted" />
                  </div>
                </div>
              ),
            },
          ]}
        />
      ) : null}
    </aside>
  );
}
