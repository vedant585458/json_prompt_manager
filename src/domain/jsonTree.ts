/**
 * Read-only JSON tree model for the editor's tree view (TASK-014).
 *
 * The model is derived once from the parsed document, and the keyboard behavior
 * is a pure function over the visible rows. Keeping both here means the tree
 * view can be tested without a renderer and the arrow keys cannot drift from
 * what is actually on screen.
 */

import { isPlainObject } from '@/domain/promptDocument';
import type { JsonValue } from '@/domain/types';

/** The JSON type of a node, spelled the way the UI labels it. */
export type JsonNodeKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** One node of the read-only tree. Children are built eagerly (documents are small). */
export interface JsonTreeNode {
  /** Path from the root, e.g. `$.instructions[0]`. Also the stable React key. */
  readonly path: string;
  /** Display label: the property name, `[index]`, or `$` for the root. */
  readonly key: string;
  readonly kind: JsonNodeKind;
  readonly depth: number;
  readonly value: JsonValue;
  readonly children: readonly JsonTreeNode[];
  /** True for objects and arrays, even when empty. */
  readonly expandable: boolean;
  /** One-line description shown after the label. */
  readonly summary: string;
}

/** A row the tree view actually renders, given the current expansion state. */
export interface JsonTreeRow {
  readonly node: JsonTreeNode;
  readonly expanded: boolean;
  readonly expandable: boolean;
}

/** Keys the tree view answers to. Everything else is left to the browser. */
export type JsonTreeKey = 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End';

/** What a key press asks the tree to do next. */
export interface JsonTreeAction {
  /** Path that should hold focus afterwards. */
  readonly path: string;
  /** Set when the press toggled a node. */
  readonly expansion?: { readonly path: string; readonly expanded: boolean };
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const PREVIEW_LIMIT = 60;

/** The JSON type of a value, without trusting `typeof`. */
export function jsonNodeKind(value: JsonValue): JsonNodeKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isPlainObject(value)) return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  return 'boolean';
}

/**
 * Formats a path from its segments.
 *
 * Identifier-safe keys use dot notation and everything else uses brackets with
 * single quotes, so the copied path can be pasted into a tool that understands
 * `$.a['b c'][0]`.
 */
export function formatJsonPath(segments: readonly (string | number)[]): string {
  let path = '$';

  for (const segment of segments) {
    if (typeof segment === 'number') {
      path += `[${segment}]`;
      continue;
    }

    path += IDENTIFIER.test(segment)
      ? `.${segment}`
      : `['${segment.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}']`;
  }

  return path;
}

/** A short, single-line description of a value, never multi-line. */
export function jsonValuePreview(value: JsonValue, limit = PREVIEW_LIMIT): string {
  const text = JSON.stringify(value) ?? 'null';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function summarise(node: Pick<JsonTreeNode, 'kind' | 'children' | 'value'>): string {
  if (node.kind === 'object') {
    const count = node.children.length;
    return count === 0 ? 'empty object' : `${count} ${count === 1 ? 'key' : 'keys'}`;
  }

  if (node.kind === 'array') {
    const count = node.children.length;
    return count === 0 ? 'empty array' : `${count} ${count === 1 ? 'item' : 'items'}`;
  }

  if (node.kind === 'string') {
    const text = node.value as string;
    return text.length === 0 ? 'empty string' : jsonValuePreview(node.value);
  }

  return String(node.value);
}

function buildNode(value: JsonValue, segments: readonly (string | number)[]): JsonTreeNode {
  const kind = jsonNodeKind(value);
  const depth = segments.length;
  const last = segments[segments.length - 1];

  const children: readonly JsonTreeNode[] =
    kind === 'object'
      ? Object.entries(value as Readonly<Record<string, JsonValue>>).map(([key, child]) =>
          buildNode(child, [...segments, key]),
        )
      : kind === 'array'
        ? (value as readonly JsonValue[]).map((child, index) =>
            buildNode(child, [...segments, index]),
          )
        : [];

  const key = last === undefined ? '$' : typeof last === 'number' ? `[${last}]` : last;
  const expandable = kind === 'object' || kind === 'array';

  const node: JsonTreeNode = {
    path: formatJsonPath(segments),
    key,
    kind,
    depth,
    value,
    children,
    expandable,
    summary: '',
  };

  return { ...node, summary: summarise(node) };
}

/** Builds the full tree for a parsed document. */
export function buildJsonTree(value: JsonValue): JsonTreeNode {
  return buildNode(value, []);
}

/**
 * Paths expanded by default. `expandDepth` counts levels that are *opened*: the
 * default of 1 opens only the root, so the first level of keys is visible and
 * its containers stay closed until asked for.
 */
export function defaultExpandedPaths(root: JsonTreeNode, expandDepth = 1): Set<string> {
  const expanded = new Set<string>();

  const walk = (node: JsonTreeNode): void => {
    if (!node.expandable) return;
    if (node.depth < expandDepth) {
      expanded.add(node.path);
      node.children.forEach(walk);
    }
  };

  walk(root);
  return expanded;
}

/** The rows currently visible, in render order. */
export function visibleJsonTreeRows(
  root: JsonTreeNode,
  expanded: ReadonlySet<string>,
): JsonTreeRow[] {
  const rows: JsonTreeRow[] = [];

  const walk = (node: JsonTreeNode): void => {
    const isExpanded = node.expandable && expanded.has(node.path);
    rows.push({ node, expanded: isExpanded, expandable: node.expandable });
    if (isExpanded) node.children.forEach(walk);
  };

  walk(root);
  return rows;
}

/** Finds a node by path (used to restore focus after a collapse). */
export function findJsonTreeNode(root: JsonTreeNode, path: string): JsonTreeNode | null {
  if (root.path === path) return root;

  for (const child of root.children) {
    const found = findJsonTreeNode(child, path);
    if (found) return found;
  }

  return null;
}

/**
 * Maps a key press to the next focus target, following the WAI-ARIA tree
 * pattern: Down/Up move through visible rows, Right expands or enters a node,
 * Left collapses or leaves it, Home/End jump to the ends.
 *
 * Returns `null` when the key changes nothing (there is nowhere to go).
 */
export function treeKeyboardAction(
  rows: readonly JsonTreeRow[],
  index: number,
  key: JsonTreeKey,
  expanded: ReadonlySet<string>,
): JsonTreeAction | null {
  const current = rows[index];
  if (!current) return null;

  const focus = (target: JsonTreeRow | undefined): JsonTreeAction | null =>
    target ? { path: target.node.path } : null;

  switch (key) {
    case 'ArrowDown':
      return index >= rows.length - 1 ? null : focus(rows[index + 1]);

    case 'ArrowUp':
      return index <= 0 ? null : focus(rows[index - 1]);

    case 'Home':
      return index === 0 ? null : focus(rows[0]);

    case 'End':
      return index === rows.length - 1 ? null : focus(rows[rows.length - 1]);

    case 'ArrowRight': {
      if (!current.expandable) return null;
      if (!expanded.has(current.node.path)) {
        return { path: current.node.path, expansion: { path: current.node.path, expanded: true } };
      }
      // Already open: step into the first child, which is the next row.
      return index + 1 < rows.length ? focus(rows[index + 1]) : null;
    }

    case 'ArrowLeft': {
      if (current.expandable && expanded.has(current.node.path)) {
        return { path: current.node.path, expansion: { path: current.node.path, expanded: false } };
      }

      // Otherwise climb to the nearest row that is one level shallower.
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const candidate = rows[cursor];
        if (candidate && candidate.node.depth < current.node.depth) return focus(candidate);
      }

      return null;
    }

    default:
      return null;
  }
}

/** The value as text, for the copy-value action. */
export function jsonValueText(value: JsonValue): string {
  return JSON.stringify(value, null, 2) ?? 'null';
}
