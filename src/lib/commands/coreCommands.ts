/**
 * Core commands (TASK-009).
 *
 * Only behaviour that exists today is registered here: navigation to real
 * routes, the palette itself, the shortcut help overlay, theme switching, and
 * the navigation rail. Save, format, validate, and create commands belong to the
 * tasks that implement those features — registering them now would put a
 * command in the palette that cannot do anything.
 */

import { ALL_NAV } from '@/components/layout/navigation';
import { hasPromptValidation } from '@/lib/commands/promptActions';
import { commandRegistry, type CommandRegistry } from '@/lib/commands/registry';
import type { CommandDefinition } from '@/lib/commands/types';

/** The palette's own binding, shared with the top bar's hint (one source). */
export const PALETTE_SHORTCUT = 'Mod+K';

/** Sequence shortcuts for the main destinations; `G` then the initial. */
const NAV_SEQUENCES: Readonly<Record<string, string>> = {
  '/': 'G D',
  '/library': 'G L',
  '/composer': 'G C',
  '/templates': 'G T',
  '/validation': 'G V',
  '/health': 'G H',
  '/settings': 'G S',
};

function idForPath(path: string): string {
  return path === '/' ? 'dashboard' : path.replace(/^\//, '').replaceAll('/', '-');
}

function searchTerms(...values: readonly string[]): readonly string[] {
  const terms = new Set<string>();
  for (const value of values) {
    for (const word of value.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length > 2) terms.add(word);
    }
  }
  return [...terms];
}

export function createCoreCommands(): readonly CommandDefinition[] {
  const navigation: CommandDefinition[] = ALL_NAV.map((destination) => {
    const sequence = NAV_SEQUENCES[destination.to];
    return {
      id: `navigation.${idForPath(destination.to)}`,
      title: `Go to ${destination.label}`,
      group: 'Navigation',
      description: destination.description,
      keywords: searchTerms(destination.label, destination.description),
      ...(sequence ? { shortcut: sequence } : {}),
      run: (context) => context.navigate(destination.to),
    };
  });

  return [
    {
      id: 'palette.open',
      title: 'Open the command palette',
      group: 'General',
      description: 'Jump to a screen or run an action without leaving the keyboard.',
      keywords: searchTerms('search find jump commands run'),
      shortcut: PALETTE_SHORTCUT,
      allowInInput: true,
      when: (context) => !context.paletteOpen,
      run: (context) => context.setPaletteOpen(true),
    },
    {
      id: 'help.shortcuts',
      title: 'Show keyboard shortcuts',
      group: 'General',
      description: 'Every shortcut the application currently registers.',
      keywords: searchTerms('help keys keyboard shortcuts overlay'),
      shortcut: '?',
      when: (context) => !context.helpOpen,
      run: (context) => context.setHelpOpen(true),
    },
    {
      id: 'appearance.toggle-theme',
      title: 'Toggle dark and light theme',
      group: 'Appearance',
      description: 'Switch between the designed dark and light palettes.',
      keywords: searchTerms('theme colour color dark light appearance'),
      shortcut: 'Mod+Shift+L',
      run: (context) => context.toggleTheme(),
    },
    {
      id: 'workspace.toggle-rail',
      title: 'Toggle the navigation rail',
      group: 'Workspace',
      description: 'Collapse the rail to icons or expand it to full labels.',
      keywords: searchTerms('sidebar rail navigation collapse expand layout'),
      shortcut: 'Mod+B',
      run: (context) => context.toggleRail(),
    },
    {
      id: 'library.focus-search',
      title: 'Search the library',
      group: 'Workspace',
      description: 'Put the cursor in the library search field.',
      keywords: searchTerms('search find filter library prompts'),
      shortcut: '/',
      when: (context) => context.pathname === '/library',
      run: (context) => context.focusLibrarySearch(),
    },
    {
      id: 'prompt.new',
      title: 'New prompt',
      group: 'Workspace',
      description: 'Create a prompt with its title, tags, folder, and collections.',
      keywords: searchTerms('create new add prompt library compose'),
      run: (context) => context.navigate('/library?new=prompt'),
    },
    {
      id: 'composer.new',
      title: 'Compose a prompt',
      group: 'Workspace',
      description: 'Build a document section by section instead of hand-writing JSON.',
      keywords: searchTerms('compose composer form guided sections new prompt'),
      run: (context) => context.navigate('/composer'),
    },
    {
      id: 'folder.new',
      title: 'New folder',
      group: 'Workspace',
      description: 'Create a folder to group prompts by area of work.',
      keywords: searchTerms('create new add folder group organize library'),
      run: (context) => context.navigate('/library?new=folder'),
    },
    {
      id: 'prompt.toggle-favorite',
      title: 'Toggle favorite on the open prompt',
      group: 'Workspace',
      description: 'Works only while a prompt is open in the workspace.',
      keywords: searchTerms('favorite star bookmark prompt workspace'),
      when: (context) => /^\/prompts\/[^/]+$/.test(context.pathname),
      run: (context) => context.togglePromptFavorite(),
    },
    {
      id: 'validation.validate-prompt',
      title: 'Validate the open prompt',
      group: 'Workspace',
      description: 'Opens the validation studio for the prompt in the workspace.',
      keywords: searchTerms('validate validation schema check syntax studio prompt'),
      // Available only while a workspace has registered the action, so the
      // palette never offers a command that would do nothing.
      when: (context) => /^\/prompts\/[^/]+$/.test(context.pathname) && hasPromptValidation(),
      run: (context) => context.validatePrompt(),
    },
    {
      id: 'library.favorites',
      title: 'Show favorite prompts',
      group: 'Workspace',
      description: 'Opens the library filtered to favorites.',
      keywords: searchTerms('favorites starred library filter'),
      run: (context) => context.navigate('/library?favorites=1'),
    },
    {
      id: 'library.archived',
      title: 'Show archived prompts',
      group: 'Workspace',
      description: 'Opens the library archive; archived prompts can be restored from there.',
      keywords: searchTerms('archive archived library filter restore'),
      run: (context) => context.navigate('/library?archived=1'),
    },
    {
      id: 'development.design-gallery',
      title: 'Open the design system gallery',
      group: 'Development',
      description: 'Primitives, states, and tokens. Development builds only.',
      keywords: searchTerms('design system gallery primitives tokens dev'),
      when: (context) => context.dev,
      run: (context) => context.navigate('/design'),
    },
    ...navigation,
  ];
}

let registered = false;

/**
 * Registers the core commands once per session.
 *
 * The shell can remount (React StrictMode, hot reload, tests) without stacking
 * duplicate definitions; the registry itself rejects duplicates, so a second
 * registration would otherwise throw.
 */
export function ensureCoreCommands(registry: CommandRegistry = commandRegistry): void {
  if (registered) return;
  registry.registerAll(createCoreCommands());
  registered = true;
}
