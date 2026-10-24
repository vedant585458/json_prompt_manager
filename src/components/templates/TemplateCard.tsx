import { Copy, LayoutTemplate, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '@/components/ui';
import { formatRelativeTime } from '@/lib/dates';
import { summariseTemplate } from '@/domain/templates';
import type { PromptTemplate } from '@/domain/types';

export interface TemplateCardProps {
  readonly template: PromptTemplate;
  readonly now: Date;
  readonly busy: boolean;
  readonly onPreview: () => void;
  readonly onUse: () => void;
  readonly onDuplicate: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/**
 * One template in the catalogue grid (TASK-018).
 *
 * Built-in and custom templates share the card; what differs is stated in words
 * as well as in tone — the badge reads "Built-in" or "Custom", and a built-in's
 * menu offers only duplication, never edit or delete. There is no disabled
 * "Delete" item to mislead a click: the menu does not contain the operation.
 */
export function TemplateCard({
  template,
  now,
  busy,
  onPreview,
  onUse,
  onDuplicate,
  onEdit,
  onDelete,
}: TemplateCardProps) {
  const summary = summariseTemplate(template);
  const headingId = `template-${template.id}-name`;
  const visibleTags = summary.tags.slice(0, 4);

  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface-1 p-3.5 transition-colors duration-[var(--pf-duration-fast)] hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
          <LayoutTemplate aria-hidden="true" size={13} strokeWidth={1.75} />
          <span className="metadata-rail truncate">{template.category}</span>
        </span>
        <Badge tone={template.isBuiltIn ? 'info' : 'accent'}>
          {template.isBuiltIn ? 'Built-in' : 'Custom'}
        </Badge>
      </div>

      <div className="min-w-0">
        <h3 id={headingId} className="text-sm font-semibold text-ink">
          {template.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-secondary">
          {template.description.length > 0 ? template.description : 'No description yet.'}
        </p>
      </div>

      {visibleTags.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label={`Tags for ${template.name}`}>
          {visibleTags.map((tag) => (
            <li
              key={tag}
              className="rounded-pill border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-ink-muted"
            >
              {tag}
            </li>
          ))}
          {summary.tags.length > visibleTags.length ? (
            <li className="px-1 py-0.5 font-mono text-2xs text-ink-muted">
              +{summary.tags.length - visibleTags.length}
            </li>
          ) : null}
        </ul>
      ) : null}

      <dl className="grid grid-cols-3 gap-x-3 border-t border-line pt-2.5 text-2xs">
        <div className="min-w-0">
          <dt className="text-ink-muted">Variables</dt>
          <dd className="truncate font-mono text-ink-secondary">
            {summary.variables.length}
            {summary.requiredVariables > 0 ? ` · ${summary.requiredVariables} req` : ''}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-muted">Sections</dt>
          <dd className="truncate font-mono text-ink-secondary">
            {summary.instructions} instr · {summary.constraints} cns
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-muted">JSON</dt>
          <dd className="truncate font-mono text-ink-secondary">
            {summary.jsonCharacters.toLocaleString()} ch
          </dd>
        </div>
      </dl>

      <p className="text-2xs text-ink-muted">
        {template.isBuiltIn
          ? 'Read-only · duplicate to customise'
          : `Edited ${formatRelativeTime(template.updatedAt, now)}`}
      </p>

      <div className="mt-auto flex items-center gap-1.5 pt-0.5">
        <Button variant="secondary" size="sm" onClick={onPreview} className="min-w-0 flex-1">
          Preview
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onUse}
          disabled={busy}
          className="min-w-0 flex-1"
        >
          <Play aria-hidden="true" size={11} />
          Use
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              label={`More actions for “${template.name}”`}
              size="sm"
              variant="ghost"
              className="data-[state=open]:bg-surface-3 data-[state=open]:text-ink"
            >
              <MoreHorizontal size={15} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy aria-hidden="true" size={14} />
              {template.isBuiltIn ? 'Duplicate to customise' : 'Duplicate'}
            </DropdownMenuItem>
            {template.isBuiltIn ? null : (
              <>
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil aria-hidden="true" size={14} />
                  Rename or re-describe
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={onDelete}>
                  <Trash2 aria-hidden="true" size={14} />
                  Delete template
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
