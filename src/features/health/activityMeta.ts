/**
 * One shared description of every activity type (TASK-025).
 *
 * The dashboard rail and the health timeline both render events from the same
 * log, so the icon, the label, and the sentence explaining the type come from
 * here rather than from two parallel tables that could disagree.
 */

import {
  Archive,
  Download,
  History,
  LayoutTemplate,
  PencilLine,
  PlusCircle,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ActivityType } from '@/domain/types';

export interface ActivityTypeMeta {
  readonly icon: LucideIcon;
  /** Short label, used as the visible heading for a filter option. */
  readonly label: string;
  /** What actually produced the event, in one sentence. */
  readonly description: string;
}

export const ACTIVITY_TYPE_META: Readonly<Record<ActivityType, ActivityTypeMeta>> = {
  created: {
    icon: PlusCircle,
    label: 'Created',
    description: 'A new prompt was added, by hand or from a template.',
  },
  updated: {
    icon: PencilLine,
    label: 'Updated',
    description: 'A saved prompt changed: its content, title, or metadata.',
  },
  deleted: {
    icon: Trash2,
    label: 'Deleted',
    description: 'A prompt was removed. The event keeps its title, not its content.',
  },
  restored: {
    icon: RotateCcw,
    label: 'Restored',
    description: 'A deleted prompt was brought back.',
  },
  archived: {
    icon: Archive,
    label: 'Archived',
    description: 'A prompt left the working set, or came back into it.',
  },
  imported: {
    icon: Upload,
    label: 'Imported',
    description: 'Prompts were read from a file you supplied.',
  },
  exported: {
    icon: Download,
    label: 'Exported',
    description: 'Prompts were written out to a file.',
  },
  snapshot: {
    icon: History,
    label: 'Snapshot',
    description: 'A revision was captured in the prompt’s history.',
  },
  validation: {
    icon: ShieldCheck,
    label: 'Validation',
    description: 'A document was checked, by you or by an automatic gate.',
  },
  template: {
    icon: LayoutTemplate,
    label: 'Template',
    description: 'A prompt was composed from a template.',
  },
  settings: {
    icon: SettingsIcon,
    label: 'Settings',
    description: 'A preference was saved. This is the one event with no prompt.',
  },
};

/** Every type, in the order the timeline filter lists them. */
export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'created',
  'updated',
  'deleted',
  'restored',
  'archived',
  'snapshot',
  'validation',
  'imported',
  'exported',
  'template',
  'settings',
];
