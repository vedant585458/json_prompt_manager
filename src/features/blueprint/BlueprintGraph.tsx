import {
  BLUEPRINT_COLUMNS,
  BLUEPRINT_LIMITS,
  type BlueprintGraph as BlueprintGraphModel,
  type BlueprintNode,
} from '@/domain/graph';

export interface BlueprintGraphProps {
  readonly graph: BlueprintGraphModel;
  readonly selectedId: string | null;
  readonly zoom: number;
  readonly onSelect: (id: string) => void;
}

/** Shortens a label to the space a node actually has. */
function fit(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

const NODE_FILL = 'var(--pf-surface-2)';
const NODE_FILL_UNRESOLVED = 'var(--pf-danger-soft)';
const NODE_STROKE = 'var(--pf-line)';
const NODE_STROKE_UNRESOLVED = 'var(--pf-danger)';
const NODE_STROKE_SELECTED = 'var(--pf-accent)';
const EDGE_STROKE = 'var(--pf-line-strong)';

/**
 * The layered blueprint drawing (TASK-023).
 *
 * Deliberately `aria-hidden`: an SVG full of `<text>` is a poor screen-reader
 * experience, and the same nodes are rendered as a semantic list beside it. Mouse
 * users can click a node to inspect it; keyboard and assistive-technology users
 * use the list, which is always present — so nothing here is mouse-only.
 *
 * There is no panning and no wheel handler: the drawing is sized by its own
 * layout, scaled only by the zoom buttons, and scrolls inside its container the
 * way any other overflowing element does. That is what keeps a two-finger scroll
 * on a phone from being captured by a canvas.
 */
export function BlueprintGraph({ graph, selectedId, zoom, onSelect }: BlueprintGraphProps) {
  const { padding, headerHeight } = BLUEPRINT_LIMITS;
  const headerY = padding + headerHeight - 10;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      data-blueprint-graph="true"
      viewBox={`0 0 ${graph.width} ${graph.height}`}
      width={Math.round(graph.width * zoom)}
      height={Math.round(graph.height * zoom)}
      className="block max-w-none"
    >
      {BLUEPRINT_COLUMNS.map((column, index) => (
        <text
          key={column.id}
          x={padding + index * (BLUEPRINT_LIMITS.nodeWidth + BLUEPRINT_LIMITS.columnGap)}
          y={headerY}
          fontSize={10}
          fontWeight={600}
          letterSpacing={0.8}
          style={{ fill: 'var(--pf-ink-muted)' }}
        >
          {column.title.toUpperCase()}
        </text>
      ))}

      {graph.edges.map((edge) => {
        const bend = Math.max(18, (edge.x2 - edge.x1) / 2);
        return (
          <path
            key={edge.id}
            d={`M ${edge.x1} ${edge.y1} C ${edge.x1 + bend} ${edge.y1}, ${edge.x2 - bend} ${edge.y2}, ${edge.x2} ${edge.y2}`}
            fill="none"
            stroke={EDGE_STROKE}
            strokeWidth={1}
            strokeDasharray={edge.kind === 'contains' ? '4 3' : undefined}
            opacity={0.75}
          />
        );
      })}

      {graph.nodes.map((node) => (
        <GraphNode
          key={node.id}
          node={node}
          selected={node.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}

function GraphNode({
  node,
  selected,
  onSelect,
}: {
  readonly node: BlueprintNode;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const labelY = node.y + 18;
  const detailY = node.y + 32;

  return (
    <g
      onClick={() => onSelect(node.id)}
      className="cursor-pointer"
      data-node-id={node.id}
      data-selected={selected ? 'true' : undefined}
    >
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={8}
        fill={node.unresolved ? NODE_FILL_UNRESOLVED : NODE_FILL}
        stroke={
          selected ? NODE_STROKE_SELECTED : node.unresolved ? NODE_STROKE_UNRESOLVED : NODE_STROKE
        }
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={node.x + 10}
        y={labelY}
        fontSize={11.5}
        fontWeight={600}
        style={{ fill: 'var(--pf-ink)' }}
      >
        {fit(node.label, 22)}
      </text>
      <text x={node.x + 10} y={detailY} fontSize={9.5} style={{ fill: 'var(--pf-ink-muted)' }}>
        {fit(node.detail, 28)}
      </text>
      {node.unresolved ? (
        <>
          <circle cx={node.x + node.width - 12} cy={node.y + 13} r={6} fill="var(--pf-danger)" />
          <text
            x={node.x + node.width - 12}
            y={node.y + 16.5}
            fontSize={9}
            fontWeight={700}
            textAnchor="middle"
            style={{ fill: 'var(--pf-surface-1)' }}
          >
            !
          </text>
        </>
      ) : null}
    </g>
  );
}
