/**
 * Navigation model (TASK-008).
 *
 * One list drives the desktop rail, the mobile drawer, breadcrumbs, and the
 * document title, so a route cannot appear in one place and go missing in
 * another. Descriptions are the honest one-liners the scaffolds render.
 */

import {
  Activity,
  BookOpen,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  PenLine,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
  /** Match the path exactly (used for the dashboard at `/`). */
  readonly end?: boolean;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    description: 'Library health, recent work, and activity at a glance.',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/library',
    label: 'Library',
    description: 'Every prompt, searchable and filterable.',
    icon: BookOpen,
  },
  {
    to: '/composer',
    label: 'Composer',
    description: 'Build a structured document section by section.',
    icon: PenLine,
  },
  {
    to: '/templates',
    label: 'Templates',
    description: 'Reusable starting points, built-in and your own.',
    icon: LayoutTemplate,
  },
  {
    to: '/validation',
    label: 'Validation',
    description: 'Check documents against rules and JSON Schema.',
    icon: ShieldCheck,
  },
  {
    to: '/health',
    label: 'Health',
    description: 'Find stale prompts, broken references, and duplicates.',
    icon: Activity,
  },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  {
    to: '/settings',
    label: 'Settings',
    description: 'Theme, density, and autosave behaviour.',
    icon: Settings,
  },
  {
    to: '/design',
    label: 'Design system',
    description: 'Every primitive and state, for reference.',
    icon: Palette,
  },
];

export const ALL_NAV: readonly NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];

/** Label used for breadcrumbs and the document title. */
export function routeLabel(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  for (const item of ALL_NAV) {
    if (normalized === item.to) return item.label;
  }

  if (normalized === '/prompts' || normalized.startsWith('/prompts/')) return 'Prompt';
  return null;
}

/** Breadcrumb trail for a pathname; the last entry is the current page. */
export interface Crumb {
  readonly label: string;
  readonly to: string | null;
}

export function crumbsForPath(pathname: string): Crumb[] {
  if (pathname === '/' || pathname === '') return [{ label: 'Dashboard', to: null }];

  const label = routeLabel(pathname);
  if (!label) return [{ label: 'Not found', to: null }];

  if (pathname.startsWith('/prompts/')) {
    return [
      { label: 'Dashboard', to: '/' },
      { label: 'Library', to: '/library' },
      { label: 'Prompt', to: null },
    ];
  }

  return [
    { label: 'Dashboard', to: '/' },
    { label, to: null },
  ];
}
