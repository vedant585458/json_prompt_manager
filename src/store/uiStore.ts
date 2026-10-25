/**
 * Ephemeral interface state (TASK-007).
 *
 * Which panels are open, which row is selected, and what the command palette is
 * doing. None of it is derived from storage, and almost none of it is persisted:
 * a reload returns to a clean workspace.
 *
 * The one exception is the rail (TASK-027). Collapsing the sidebar is a layout
 * preference a person states once on a small laptop, so it is remembered in
 * `localStorage` — the same place the theme lives — and not in the settings
 * record, which belongs to the data being managed. Everything else here stays
 * per-session by design.
 */

import { create } from 'zustand';

export type RightPanel = 'none' | 'inspector' | 'activity';

/** `localStorage` key for the remembered rail state. */
export const SIDEBAR_COLLAPSED_KEY = 'promptforge.sidebar-collapsed';

/** The remembered rail state, or `null` when nothing (readable) is stored. */
export function readStoredSidebarOpen(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (raw === '1') return false;
    if (raw === '0') return true;
    return null;
  } catch {
    // Private modes and blocked storage throw on access; the rail then stays at
    // its default instead of breaking the shell.
    return null;
  }
}

function storeSidebarOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, open ? '0' : '1');
  } catch {
    // Nothing to do: the preference simply does not survive the reload.
  }
}

export interface UiState {
  /** Library sidebar; collapses to a drawer on small screens (TASK-008). */
  readonly sidebarOpen: boolean;
  /** Right-hand panel in the editor workspace. */
  readonly rightPanel: RightPanel;
  readonly paletteOpen: boolean;
  /** Keyboard shortcut help overlay (TASK-009). */
  readonly helpOpen: boolean;
  /** Command ids used most recently, newest first; palette ordering only. */
  readonly recentCommandIds: readonly string[];
  /** Prompt currently open in the editor, or null for the library. */
  readonly selectedPromptId: string | null;
  /** Multi-selection for bulk actions (TASK-013). */
  readonly selectedPromptIds: readonly string[];

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setRightPanel: (panel: RightPanel) => void;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  setHelpOpen: (open: boolean) => void;
  /** Records a command activation, keeping at most five distinct ids. */
  pushRecentCommand: (id: string) => void;
  clearRecentCommands: () => void;
  selectPrompt: (id: string | null) => void;
  setSelection: (ids: readonly string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
}

export type UiStore = ReturnType<typeof createUiStore>;

export interface InitialUiState {
  readonly sidebarOpen?: boolean;
  readonly rightPanel?: RightPanel;
  readonly paletteOpen?: boolean;
  readonly helpOpen?: boolean;
  readonly recentCommandIds?: readonly string[];
  readonly selectedPromptId?: string | null;
  readonly selectedPromptIds?: readonly string[];
}

/** Wide screens start with the sidebar visible; the shell adapts on resize. */
export function createUiStore(initial: InitialUiState = {}) {
  return create<UiState>()((set) => ({
    sidebarOpen: initial.sidebarOpen ?? readStoredSidebarOpen() ?? true,
    rightPanel: initial.rightPanel ?? 'none',
    paletteOpen: initial.paletteOpen ?? false,
    helpOpen: initial.helpOpen ?? false,
    recentCommandIds: [...(initial.recentCommandIds ?? [])],
    selectedPromptId: initial.selectedPromptId ?? null,
    selectedPromptIds: [...(initial.selectedPromptIds ?? [])],

    setSidebarOpen: (open) => {
      storeSidebarOpen(open);
      set({ sidebarOpen: open });
    },
    toggleSidebar: () =>
      set((state) => {
        const next = !state.sidebarOpen;
        storeSidebarOpen(next);
        return { sidebarOpen: next };
      }),
    setRightPanel: (panel) => set({ rightPanel: panel }),
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
    setHelpOpen: (open) => set({ helpOpen: open }),
    pushRecentCommand: (id) =>
      set((state) => ({
        recentCommandIds: [
          id,
          ...state.recentCommandIds.filter((existing) => existing !== id),
        ].slice(0, 5),
      })),
    clearRecentCommands: () => set({ recentCommandIds: [] }),
    selectPrompt: (id) => set({ selectedPromptId: id }),

    setSelection: (ids) => set({ selectedPromptIds: [...ids] }),
    toggleSelection: (id) =>
      set((state) => ({
        selectedPromptIds: state.selectedPromptIds.includes(id)
          ? state.selectedPromptIds.filter((candidate) => candidate !== id)
          : [...state.selectedPromptIds, id],
      })),
    clearSelection: () => set({ selectedPromptIds: [] }),
  }));
}

export const useUiStore = createUiStore();
