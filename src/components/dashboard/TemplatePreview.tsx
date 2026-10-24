import { ArrowRight, LayoutTemplate } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DashboardSection, SectionEmpty } from '@/components/dashboard/DashboardSection';
import { Badge } from '@/components/ui';
import type { PromptTemplate } from '@/domain/types';

export interface TemplatePreviewProps {
  readonly templates: readonly PromptTemplate[];
}

/**
 * Quick-start templates (TASK-010, wired to the catalogue in TASK-018).
 *
 * Each card deep-links to the templates screen with that template's preview
 * already open (`?template=<id>`), where the preview shows the document and the
 * "Use template" button creates the prompt. Creating here as well would mean two
 * code paths for one operation; one preview, one button (ADR-97).
 */
export function TemplatePreview({ templates }: TemplatePreviewProps) {
  return (
    <DashboardSection
      id="dashboard-templates"
      title="Quick start"
      description="Open a starter document, review it, and start a prompt from it."
      action={{ label: 'All templates', to: '/templates' }}
    >
      {templates.length === 0 ? (
        <SectionEmpty
          title="No templates available"
          description="The starter catalogue ships with a fresh install. Open templates to see whether one was saved from a prompt."
          action={{ label: 'Open templates', to: '/templates' }}
        />
      ) : (
        <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <li key={template.id} className="min-w-0">
              <Link
                to={`/templates?template=${encodeURIComponent(template.id)}`}
                className="group flex h-full min-w-0 flex-col gap-1.5 rounded-md border border-line bg-surface-1 p-3.5 transition-colors duration-[var(--pf-duration-fast)] hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <LayoutTemplate aria-hidden="true" size={13} strokeWidth={1.75} />
                  <span className="metadata-rail truncate">{template.category}</span>
                </span>
                <span className="truncate text-sm font-medium text-ink group-hover:text-accent">
                  {template.name}
                </span>
                <span className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
                  {template.description}
                </span>
                <span className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                  <Badge tone={template.isBuiltIn ? 'info' : 'neutral'}>
                    {template.isBuiltIn ? 'Built-in' : 'Custom'}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-2xs font-medium text-accent">
                    Preview
                    <ArrowRight aria-hidden="true" size={11} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
