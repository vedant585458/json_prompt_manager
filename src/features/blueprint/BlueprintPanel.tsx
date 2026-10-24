import { List, Network, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, Button, Card, EmptyState, IconButton } from '@/components/ui';
import {
  BLUEPRINT_LEGEND,
  buildBlueprint,
  describeBlueprint,
  hasEnoughStructure,
  type BlueprintNode,
} from '@/domain/graph';
import type { PromptDocument, PromptSchema, PromptTemplate, Snippet } from '@/domain/types';
import { BlueprintGraph } from '@/features/blueprint/BlueprintGraph';
import { GraphInspector } from '@/features/blueprint/GraphInspector';
import { GraphList } from '@/features/blueprint/GraphList';
export interface BlueprintPanelProps {
  /** The document to draw: the editor's draft, not necessarily the saved one. */
  readonly document: PromptDocument;
  readonly promptId: string;
  readonly attachedSchema: PromptSchema | null;
  readonly attachedSchemaId: string | null;
  readonly snippets: readonly Snippet[];
  readonly templates?: readonly PromptTemplate[];
  readonly metadata?: Readonly<Record<string, string>>;
  /** Jumps the raw editor to a document path. */
  readonly onOpenPath: (path: string) => void;
}

const ZOOM_STEPS = [0.7, 0.85, 1, 1.15, 1.3] as const;
const DEFAULT_ZOOM = 2; // index into ZOOM_STEPS: 1×.

/**
 * The editor's Blueprint tab (TASK-023).
 *
 * A read-only picture of how the *draft* is assembled, plus the same information
 * as a list. The graph is a convenience for people who can see and point at it;
 * the list is the source of truth for assistive technology and for narrow
 * screens, where the drawing is hidden rather than squeezed.
 *
 * The panel never edits: every action navigates to the thing that owns the data.
 */
export function BlueprintPanel({
  document,
  promptId,
  attachedSchema,
  attachedSchemaId,
  snippets,
  templates = [],
  metadata = {},
  onOpenPath,
}: BlueprintPanelProps) {
  const graph = useMemo(
    () =>
      buildBlueprint({
        document,
        promptId,
        attachedSchema,
        attachedSchemaId,
        snippets,
        templates,
        metadata,
      }),
    [document, promptId, attachedSchema, attachedSchemaId, snippets, templates, metadata],
  );

  const [view, setView] = useState<'graph' | 'list'>('graph');
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The first node is selected by default so the inspector is never a blank box,
  // and a selection that disappears (after an edit) falls back to it.
  const selected: BlueprintNode | null =
    graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0] ?? null;

  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;
  const enough = hasEnoughStructure(graph);

  if (!enough && !expanded) {
    return (
      <div className="min-w-0">
        <EmptyState
          icon={Network}
          title="This prompt is simple — no blueprint needed"
          description={`${describeBlueprint(graph)} A graph of ${graph.nodes.length} nodes would be more decoration than information. The list below still shows exactly what this document is made of.`}
          action={
            <Button variant="secondary" size="sm" onClick={() => setExpanded(true)}>
              View the blueprint anyway
            </Button>
          }
          className="mb-3"
        />
        <Card className="min-w-0">
          <GraphList graph={graph} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Card className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Blueprint</h2>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-secondary">
              {describeBlueprint(graph)} Derived from the draft as it is now; nothing here is stored
              or edited.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {graph.unresolvedCount > 0 ? (
              <Badge tone="danger">{graph.unresolvedCount} unresolved</Badge>
            ) : (
              <Badge tone="neutral">Every reference resolves</Badge>
            )}
            <span role="group" aria-label="Blueprint view" className="flex items-center gap-1">
              <Button
                variant={view === 'graph' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={view === 'graph'}
                onClick={() => setView('graph')}
              >
                <Network aria-hidden="true" size={12} />
                Graph
              </Button>
              <Button
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <List aria-hidden="true" size={12} />
                List
              </Button>
            </span>
            {view === 'graph' ? (
              <span className="flex items-center gap-1">
                <IconButton
                  label="Zoom out"
                  size="sm"
                  onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
                  disabled={zoomIndex === 0}
                >
                  <ZoomOut aria-hidden="true" size={12} />
                </IconButton>
                <IconButton
                  label="Zoom in"
                  size="sm"
                  onClick={() =>
                    setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))
                  }
                  disabled={zoomIndex === ZOOM_STEPS.length - 1}
                >
                  <ZoomIn aria-hidden="true" size={12} />
                </IconButton>
                <IconButton
                  label="Reset zoom"
                  size="sm"
                  onClick={() => setZoomIndex(DEFAULT_ZOOM)}
                  disabled={zoomIndex === DEFAULT_ZOOM}
                >
                  <RotateCcw aria-hidden="true" size={12} />
                </IconButton>
                <span aria-live="polite" className="tabular text-2xs text-ink-muted">
                  {Math.round(zoom * 100)}%
                </span>
              </span>
            ) : null}
          </div>
        </div>

        {graph.truncated ? (
          <p className="mt-2 rounded-sm border border-warning/35 bg-warning-soft p-2 text-2xs leading-relaxed text-ink-secondary">
            This document is too large to draw in full: {graph.droppedNodes} node
            {graph.droppedNodes === 1 ? '' : 's'} and {graph.droppedEdges} edge
            {graph.droppedEdges === 1 ? '' : 's'} were left out. Unresolved references were kept
            first.
          </p>
        ) : null}

        {view === 'graph' ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="hidden overflow-x-auto rounded-md border border-line bg-surface-sunken md:block">
              <BlueprintGraph
                graph={graph}
                selectedId={selected?.id ?? null}
                zoom={zoom}
                onSelect={setSelectedId}
              />
            </div>
            <p className="text-2xs leading-relaxed text-ink-muted md:hidden">
              The drawing needs a wider screen. The list below holds the same nodes and is keyboard
              operable.
            </p>
            <Legend />
            <div>
              <h3 className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                Nodes
              </h3>
              <div className="mt-1.5">
                <GraphList
                  graph={graph}
                  selectedId={selected?.id ?? null}
                  onSelect={setSelectedId}
                  compact
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <GraphList graph={graph} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </div>
        )}
      </Card>

      <GraphInspector node={selected} promptId={promptId} onOpenPath={onOpenPath} />
    </div>
  );
}

function Legend() {
  return (
    <div className="min-w-0">
      <h3 className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">Legend</h3>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {BLUEPRINT_LEGEND.map((entry) => (
          <li key={entry.kind} className="flex min-w-0 items-baseline gap-1.5 text-2xs">
            <span className="font-semibold text-ink">{entry.label}</span>
            <span className="text-ink-muted">{entry.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
